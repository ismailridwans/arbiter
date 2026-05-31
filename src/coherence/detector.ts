import type { CoherenceEdge, OrderBook, TradeLeg, RiskContext, LatticeNode } from '../types';
import type { CoherenceGraph } from './graph';
import { yesToken, noToken } from './graph';
import { bestAsk } from './pricing';

/**
 * Turns a coherence graph + live order books into tradeable {@link CoherenceEdge}s.
 *
 * Every edge is a MARKET-NEUTRAL, model-free arbitrage: we never predict who
 * wins — we only harvest the gap when the market's own prices contradict the
 * logic that relates them. `rawEdge` is the mid/last-price violation; `netEdge`
 * is what survives crossing the live spread (the only number we trade on).
 */

const EMPTY_BOOK: OrderBook = { tokenId: '', asks: [], bids: [], timestamp: 0 };

/** Which token books we must fetch to price the graph's edges. */
export function tokensToPrice(graph: CoherenceGraph, minProb: number): string[] {
  const ids = new Set<string>();
  for (const n of graph.nodes.values()) {
    if (n.prob < minProb) continue;
    for (const t of [yesToken(n.market), noToken(n.market)]) {
      if (t?.tokenId) ids.add(t.tokenId);
    }
  }
  return [...ids];
}

const feeAdj = (risk: RiskContext): number => risk.takerFeeBps / 10_000;

export function detectEdges(
  graph: CoherenceGraph,
  books: Map<string, OrderBook>,
  risk: RiskContext,
): CoherenceEdge[] {
  const edges: CoherenceEdge[] = [];
  const ts = Date.now();
  const ask = (tokenId?: string): number | undefined =>
    tokenId ? bestAsk(books.get(tokenId) ?? EMPTY_BOOK) : undefined;

  // L2 — implication violations: P(sub) > P(sup) ⇒ buy NO(sub) + YES(sup).
  for (const impl of graph.implications) {
    const sub = graph.nodes.get(impl.sub);
    const sup = graph.nodes.get(impl.sup);
    if (!sub || !sup) continue;
    const raw = sub.prob - sup.prob;
    if (raw <= 0) continue; // coherent ordering — nothing to harvest

    const subNo = noToken(sub.market);
    const supYes = yesToken(sup.market);
    const aNo = ask(subNo?.tokenId);
    const aYes = ask(supYes?.tokenId);
    if (aNo === undefined || aYes === undefined || !subNo || !supYes) continue;

    const net = 1 - (aNo + aYes) - feeAdj(risk);
    const legs: TradeLeg[] = [
      { market: sub.market, token: subNo, side: 'SELL', refPrice: aNo },
      { market: sup.market, token: supYes, side: 'BUY', refPrice: aYes },
    ];
    edges.push({
      id: `impl:${impl.sub}>${impl.sup}`,
      type: 'implication',
      legs,
      rawEdge: raw,
      netEdge: net,
      rationale: `${impl.rationale}; market shows P=${sub.prob.toFixed(3)} > P=${sup.prob.toFixed(3)} (Δ=${raw.toFixed(3)})`,
      nodes: [sub, sup],
      timestamp: ts,
    });
  }

  // L0 — complementary: ask(YES) + ask(NO) < 1 within one binary market.
  const seenMarket = new Set<string>();
  for (const n of graph.nodes.values()) {
    if (seenMarket.has(n.market.id)) continue;
    seenMarket.add(n.market.id);
    const yes = yesToken(n.market);
    const no = noToken(n.market);
    const aYes = ask(yes?.tokenId);
    const aNo = ask(no?.tokenId);
    if (aYes === undefined || aNo === undefined || !yes || !no) continue;
    const net = 1 - (aYes + aNo) - feeAdj(risk);
    if (net <= 0) continue;
    edges.push({
      id: `comp:${n.market.id}`,
      type: 'complementary',
      legs: [
        { market: n.market, token: yes, side: 'BUY', refPrice: aYes },
        { market: n.market, token: no, side: 'SELL', refPrice: aNo },
      ],
      rawEdge: net,
      netEdge: net,
      rationale: `${n.market.question}: YES ${aYes.toFixed(3)} + NO ${aNo.toFixed(3)} = ${(aYes + aNo).toFixed(3)} < 1`,
      nodes: [n],
      timestamp: ts,
    });
  }

  // L1 — Dutch book: Σ ask(YES) < 1 across an exhaustive partition ⇒ buy all YES.
  // Requires FULL coverage (every outcome priced) to guarantee the $1 payout.
  for (const part of graph.partitions) {
    const members = part.nodeKeys
      .map((k) => graph.nodes.get(k))
      .filter((x): x is LatticeNode => Boolean(x));
    const legs: TradeLeg[] = [];
    let sum = 0;
    let priced = 0;
    for (const m of members) {
      const yes = yesToken(m.market);
      const a = ask(yes?.tokenId);
      if (a === undefined || !yes) continue;
      sum += a;
      priced += 1;
      legs.push({ market: m.market, token: yes, side: 'BUY', refPrice: a });
    }
    if (priced < members.length || priced < 2) continue;
    const net = 1 - sum - feeAdj(risk);
    if (net <= 0) continue;
    edges.push({
      id: `dutch:${part.id}`,
      type: 'dutchbook',
      legs,
      rawEdge: net,
      netEdge: net,
      rationale: `${part.label}: Σ YES asks = ${sum.toFixed(3)} < 1 across ${priced} mutually-exclusive outcomes`,
      nodes: members,
      timestamp: ts,
    });
  }

  return edges.sort((a, b) => b.netEdge - a.netEdge);
}

export interface PartitionStat {
  id: string;
  label: string;
  /** Σ of implied probabilities across the partition (should be ~1). */
  sum: number;
  /** Deviation from a coherent sum of 1 (the market's overround / vig). */
  overround: number;
  count: number;
}

/** Quantify market coherence: how far each exhaustive partition's prices sum from 1. */
export function partitionStats(graph: CoherenceGraph): PartitionStat[] {
  return graph.partitions.map((p) => {
    const nodes = p.nodeKeys
      .map((k) => graph.nodes.get(k))
      .filter((x): x is LatticeNode => Boolean(x));
    const sum = nodes.reduce((s, n) => s + n.prob, 0);
    return { id: p.id, label: p.label, sum, overround: sum - p.expectedSum, count: nodes.length };
  });
}
