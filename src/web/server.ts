import { createServer } from 'node:http';
import { loadConfig } from '../config';
import { PolymarketClient } from '../polymarket/client';
import { KalshiClient } from '../kalshi/client';
import { buildGraph } from '../coherence/graph';
import { detectEdges, tokensToPrice, partitionStats } from '../coherence/detector';
import { runCrossVenue } from '../crossvenue/run';
import { aggregate, fetchPairHistories } from '../backtest/backtest';
import { createLlm } from '../ai/llm';
import { runAgentWorkflow } from '../ai/agents';
import { buildDemoScenario } from '../demo';
import { CoherenceStrategy } from '../strategy/coherence-strategy';
import { PaperBroker } from '../execution/paper-broker';
import { SEED_EVENT_SLUGS, NBA_TAG_IDS } from '../nba/league';
import { LANDING, DASHBOARD } from './page';
import type { RiskContext } from '../types';

/** Lightweight browser dashboard for the live engine. Built on node:http (no deps). */

interface Cache<T> {
  at: number;
  data: T;
}
const TTL_MS = 10_000;

export async function startServer(port: number): Promise<void> {
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

  let scanCache: Cache<unknown> | null = null;
  let xvCache: Cache<unknown> | null = null;
  let btCache: Cache<unknown> | null = null;
  let agentsCache: Cache<unknown> | null = null;

  async function scan(): Promise<unknown> {
    if (scanCache && Date.now() - scanCache.at < TTL_MS) return scanCache.data;
    const markets = await pm.fetchNbaUniverse({
      seedEventSlugs: SEED_EVENT_SLUGS,
      tagIds: NBA_TAG_IDS,
      maxEvents: 40,
    });
    const graph = buildGraph(markets);
    const books = await pm.fetchOrderBooks(tokensToPrice(graph, 0.01));
    const edges = detectEdges(graph, books, risk);
    const data = {
      ts: Date.now(),
      marketCount: markets.length,
      nodeCount: graph.nodes.size,
      tradeableCount: edges.filter((e) => e.netEdge >= risk.minEdge).length,
      minEdge: risk.minEdge,
      nodes: [...graph.nodes.values()]
        .sort((a, b) => b.prob - a.prob)
        .map((n) => ({ team: n.team, kind: n.kind, prob: n.prob })),
      partitions: partitionStats(graph),
      edges: edges.map((e) => ({
        type: e.type,
        netEdge: e.netEdge,
        rawEdge: e.rawEdge,
        rationale: e.rationale,
        legs: e.legs.length,
        tradeable: e.netEdge >= risk.minEdge,
      })),
    };
    scanCache = { at: Date.now(), data };
    return data;
  }

  async function crossVenue(): Promise<unknown> {
    if (xvCache && Date.now() - xvCache.at < TTL_MS) return xvCache.data;
    try {
      const r = await runCrossVenue(pm, kalshi, { minProb: 0.02 });
      const data = {
        pmCount: r.pmCount,
        kalshiCount: r.kalshiCount,
        matched: r.matches.length,
        rows: r.edges.map((e) => ({
          team: e.team,
          pmYes: e.pmYesMid,
          kalshiYes: e.kalshiYesMid,
          dir: `${e.legA} + ${e.legB}`,
          netEdge: e.netEdge,
          tradeable: e.netEdge >= 0.01,
        })),
      };
      xvCache = { at: Date.now(), data };
      return data;
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'cross-venue error', rows: [] };
    }
  }

  async function backtest(): Promise<unknown> {
    const TTL_BT = 600_000; // backtest is heavy; cache 10 min
    if (btCache && Date.now() - btCache.at < TTL_BT) return btCache.data;
    try {
      const base = { fidelityMin: 1440, threshold: 0, spreadHaircut: 0.005, sizeUsd: 50 };
      const histories = await fetchPairHistories(pm, base.fidelityMin);
      const result = aggregate(histories, { ...base, spreadHaircut: 0 });
      const rows = [0, 0.0025, 0.005, 0.0075, 0.01].map((h) => {
        const r = aggregate(histories, { ...base, spreadHaircut: h });
        return {
          haircut: h,
          opportunities: r.opportunities,
          deployedUsd: r.totalDeployedUsd,
          profitUsd: r.totalProfitUsd,
          roiPct: r.roiPct,
        };
      });
      const data = {
        pairsTested: histories.length,
        rows,
        equity: result.equity,
        opportunities: result.opportunities,
        totalProfitUsd: result.totalProfitUsd,
      };
      btCache = { at: Date.now(), data };
      return data;
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'backtest error', rows: [] };
    }
  }

  async function agents(): Promise<unknown> {
    const TTL_A = 60_000; // LLM calls — cache a minute
    if (agentsCache && Date.now() - agentsCache.at < TTL_A) return agentsCache.data;
    const markets = await pm.fetchNbaUniverse({ seedEventSlugs: SEED_EVENT_SLUGS, tagIds: NBA_TAG_IDS, maxEvents: 40 });
    const graph = buildGraph(markets);
    const books = await pm.fetchOrderBooks(tokensToPrice(graph, 0.01));
    const edges = detectEdges(graph, books, risk);
    const report = await runAgentWorkflow(llm, {
      marketCount: markets.length,
      graph,
      edges,
      partitions: partitionStats(graph),
      minEdge: risk.minEdge,
    });
    const data = {
      provider: llm.enabled ? llm.label : 'rule-based',
      analyst: report.analyst,
      architect: report.architect,
      developer: report.developer,
      qa: report.qa,
    };
    agentsCache = { at: Date.now(), data };
    return data;
  }

  async function demoRun(): Promise<unknown> {
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

  const server = createServer((req, res) => {
    void (async () => {
      try {
        const url = req.url ?? '/';
        if (url === '/' || url.startsWith('/?')) {
          res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
          res.end(LANDING);
        } else if (url === '/dashboard' || url.startsWith('/dashboard') || url === '/app') {
          res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
          res.end(DASHBOARD);
        } else if (url.startsWith('/api/scan')) {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify(await scan()));
        } else if (url.startsWith('/api/crossvenue')) {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify(await crossVenue()));
        } else if (url.startsWith('/api/backtest')) {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify(await backtest()));
        } else if (url.startsWith('/api/agents')) {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify(await agents()));
        } else if (url.startsWith('/api/demo')) {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify(await demoRun()));
        } else {
          res.writeHead(404, { 'content-type': 'text/plain' });
          res.end('not found');
        }
      } catch (err) {
        res.writeHead(500, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'error' }));
      }
    })();
  });

  await new Promise<void>((resolve) => server.listen(port, resolve));
  console.log(`Arbiterlanding   → http://localhost:${port}/`);
  console.log(`Arbiterdashboard → http://localhost:${port}/dashboard`);
}
