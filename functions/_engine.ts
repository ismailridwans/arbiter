// Shared serverless engine for the Vercel deployment. Files in api/ prefixed
// with "_" are treated as helpers (not routes). This wraps the same Arbiter
// engine modules the local server uses, with module-scoped caches that stay
// warm across invocations.
import { loadConfig } from '../src/config';
import { PolymarketClient } from '../src/polymarket/client';
import { KalshiClient } from '../src/kalshi/client';
import { buildGraph } from '../src/coherence/graph';
import { detectEdges, tokensToPrice, partitionStats } from '../src/coherence/detector';
import { runCrossVenue } from '../src/crossvenue/run';
import { aggregate, fetchPairHistories } from '../src/backtest/backtest';
import { createLlm } from '../src/ai/llm';
import { runAgentWorkflow } from '../src/ai/agents';
import { buildDemoScenario } from '../src/demo';
import { CoherenceStrategy } from '../src/strategy/coherence-strategy';
import { PaperBroker } from '../src/execution/paper-broker';
import { SEED_EVENT_SLUGS, NBA_TAG_IDS } from '../src/nba/league';
import type { RiskContext } from '../src/types';

const cfg = loadConfig();
const pm = new PolymarketClient(cfg.polymarket.gammaUrl, cfg.polymarket.clobUrl);
const kalshi = new KalshiClient();
const llm = createLlm(cfg.llm);
const risk: RiskContext = {
  bankrollUsd: cfg.risk.bankrollUsd,
  deployedUsd: 0,
  minEdge: cfg.risk.minEdge,
  kellyFraction: cfg.risk.kellyFraction,
  maxStakePerLegUsd: cfg.risk.maxStakePerLegUsd,
  takerFeeBps: cfg.risk.takerFeeBps,
};

interface Cache<T> {
  at: number;
  data: T;
}
const TTL = 10_000;
let scanCache: Cache<unknown> | null = null;
let xvCache: Cache<unknown> | null = null;
let btCache: Cache<unknown> | null = null;
let agentsCache: Cache<unknown> | null = null;

export async function scanData(): Promise<unknown> {
  if (scanCache && Date.now() - scanCache.at < TTL) return scanCache.data;
  const markets = await pm.fetchNbaUniverse({ seedEventSlugs: SEED_EVENT_SLUGS, tagIds: NBA_TAG_IDS, maxEvents: 40 });
  const graph = buildGraph(markets);
  const books = await pm.fetchOrderBooks(tokensToPrice(graph, 0.01));
  const edges = detectEdges(graph, books, risk);
  const data = {
    ts: Date.now(),
    marketCount: markets.length,
    nodeCount: graph.nodes.size,
    tradeableCount: edges.filter((e) => e.netEdge >= risk.minEdge).length,
    minEdge: risk.minEdge,
    nodes: [...graph.nodes.values()].sort((a, b) => b.prob - a.prob).map((n) => ({ team: n.team, kind: n.kind, prob: n.prob })),
    partitions: partitionStats(graph),
    edges: edges.map((e) => ({ type: e.type, netEdge: e.netEdge, rawEdge: e.rawEdge, rationale: e.rationale, legs: e.legs.length, tradeable: e.netEdge >= risk.minEdge })),
  };
  scanCache = { at: Date.now(), data };
  return data;
}

export async function crossVenueData(): Promise<unknown> {
  if (xvCache && Date.now() - xvCache.at < TTL) return xvCache.data;
  try {
    const r = await runCrossVenue(pm, kalshi, { minProb: 0.02 });
    const data = {
      pmCount: r.pmCount,
      kalshiCount: r.kalshiCount,
      matched: r.matches.length,
      rows: r.edges.map((e) => ({ team: e.team, pmYes: e.pmYesMid, kalshiYes: e.kalshiYesMid, dir: `${e.legA} + ${e.legB}`, netEdge: e.netEdge, tradeable: e.netEdge >= 0.01 })),
    };
    xvCache = { at: Date.now(), data };
    return data;
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'cross-venue error', rows: [] };
  }
}

export async function demoData(): Promise<unknown> {
  const { markets, books, note } = buildDemoScenario();
  const graph = buildGraph(markets);
  const edges = detectEdges(graph, books, risk).filter((e) => e.netEdge >= risk.minEdge);
  const stub = { fetchOrderBook: async (id: string) => books.get(id) } as unknown as PolymarketClient;
  const strat = new CoherenceStrategy(stub, risk, { minProb: 0, maxEvents: 0 });
  strat.graph = graph;
  strat.books = books;
  const orders = await strat.decide(edges, risk);
  const broker = new PaperBroker(stub, cfg.risk.takerFeeBps);
  const fills = await strat.execute(orders, broker);
  const sharesByEdge = new Map<string, number>();
  for (const o of orders) if (!sharesByEdge.has(o.edgeId)) sharesByEdge.set(o.edgeId, o.size);
  let captured = 0;
  for (const e of edges) captured += e.netEdge * (sharesByEdge.get(e.id) ?? 0);
  return {
    note,
    capturedUsd: captured,
    orders: orders.length,
    fills: fills.length,
    edges: edges.map((e) => ({ type: e.type, netEdge: e.netEdge, rationale: e.rationale, legs: e.legs.length })),
  };
}

export async function agentsData(): Promise<unknown> {
  const TTL_A = 60_000;
  if (agentsCache && Date.now() - agentsCache.at < TTL_A) return agentsCache.data;
  const markets = await pm.fetchNbaUniverse({ seedEventSlugs: SEED_EVENT_SLUGS, tagIds: NBA_TAG_IDS, maxEvents: 40 });
  const graph = buildGraph(markets);
  const books = await pm.fetchOrderBooks(tokensToPrice(graph, 0.01));
  const edges = detectEdges(graph, books, risk);
  const report = await runAgentWorkflow(llm, { marketCount: markets.length, graph, edges, partitions: partitionStats(graph), minEdge: risk.minEdge });
  const data = { provider: llm.enabled ? llm.label : 'rule-based', analyst: report.analyst, architect: report.architect, developer: report.developer, qa: report.qa };
  agentsCache = { at: Date.now(), data };
  return data;
}

export async function backtestData(): Promise<unknown> {
  const TTL_BT = 600_000;
  if (btCache && Date.now() - btCache.at < TTL_BT) return btCache.data;
  try {
    const base = { fidelityMin: 1440, threshold: 0, spreadHaircut: 0.005, sizeUsd: 50 };
    const histories = await fetchPairHistories(pm, base.fidelityMin);
    const result = aggregate(histories, { ...base, spreadHaircut: 0 });
    const rows = [0, 0.0025, 0.005, 0.0075, 0.01].map((h) => {
      const r = aggregate(histories, { ...base, spreadHaircut: h });
      return { haircut: h, opportunities: r.opportunities, deployedUsd: r.totalDeployedUsd, profitUsd: r.totalProfitUsd, roiPct: r.roiPct };
    });
    const data = { pairsTested: histories.length, rows, equity: result.equity, opportunities: result.opportunities, totalProfitUsd: result.totalProfitUsd };
    btCache = { at: Date.now(), data };
    return data;
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'backtest error', rows: [] };
  }
}
