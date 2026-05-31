import type { Broker, CoherenceEdge, Fill, OrderBook, RiskContext, SizedOrder } from './types';
import type { CoherenceStrategy } from './strategy/coherence-strategy';
import type { CoherenceGraph } from './coherence/graph';
import type { ExecutionLogger } from './execution/logger';

/** Result of one automation cycle — the unit the dashboard renders. */
export interface CycleResult {
  cycle: number;
  ts: number;
  marketCount: number;
  graph: CoherenceGraph;
  books: Map<string, OrderBook>;
  edges: CoherenceEdge[];
  tradeable: CoherenceEdge[];
  orders: SizedOrder[];
  fills: Fill[];
  /** Locked minimum profit captured this cycle (USD). */
  capturedUsd: number;
  error?: string;
}

/**
 * Run a single `fetch → analyze → decide → execute` cycle, logging every stage
 * to `.canon/execution/`. Errors are caught and surfaced (never crash the loop).
 */
export async function runCycle(
  strategy: CoherenceStrategy,
  broker: Broker,
  risk: RiskContext,
  logger: ExecutionLogger,
  cycle: number,
): Promise<CycleResult> {
  const ts = Date.now();
  try {
    const markets = await strategy.fetchMarkets();
    const edges = await strategy.analyze(markets);
    const tradeable = edges.filter((e) => e.netEdge >= risk.minEdge);
    const orders = await strategy.decide(tradeable, risk);
    const fills = await strategy.execute(orders, broker);

    // Locked minimum profit = Σ (per-share netEdge × shares) over executed edges.
    const sharesByEdge = new Map<string, number>();
    for (const o of orders) if (!sharesByEdge.has(o.edgeId)) sharesByEdge.set(o.edgeId, o.size);
    let capturedUsd = 0;
    for (const e of tradeable) capturedUsd += e.netEdge * (sharesByEdge.get(e.id) ?? 0);

    await logger.log('cycle', {
      cycle,
      marketCount: markets.length,
      nodes: strategy.graph.nodes.size,
      edges: edges.length,
      tradeable: tradeable.length,
      orders: orders.length,
      fills: fills.length,
      capturedUsd,
    });
    for (const e of tradeable) {
      await logger.log('edge', {
        id: e.id,
        type: e.type,
        netEdge: e.netEdge,
        rawEdge: e.rawEdge,
        rationale: e.rationale,
      });
    }
    for (const o of orders) {
      await logger.log('order', {
        edgeId: o.edgeId,
        market: o.market.question,
        outcome: o.token.outcome,
        side: o.side,
        size: o.size,
        limitPrice: o.limitPrice,
        notionalUsd: o.notionalUsd,
      });
    }
    for (const f of fills) {
      await logger.log('fill', {
        edgeId: f.order.edgeId,
        market: f.order.market.question,
        outcome: f.order.token.outcome,
        side: f.order.side,
        size: f.filledSize,
        avgPrice: f.avgPrice,
        costUsd: f.costUsd,
        feeUsd: f.feeUsd,
        simulated: f.simulated,
      });
    }

    return {
      cycle,
      ts,
      marketCount: markets.length,
      graph: strategy.graph,
      books: strategy.books,
      edges,
      tradeable,
      orders,
      fills,
      capturedUsd,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logger.log('error', { cycle, message });
    return {
      cycle,
      ts,
      marketCount: 0,
      graph: strategy.graph,
      books: strategy.books,
      edges: [],
      tradeable: [],
      orders: [],
      fills: [],
      capturedUsd: 0,
      error: message,
    };
  }
}
