import type {
  Strategy,
  Market,
  CoherenceEdge,
  SizedOrder,
  Fill,
  Broker,
  RiskContext,
  OrderBook,
} from '../types';
import type { PolymarketClient } from '../polymarket/client';
import { buildGraph, type CoherenceGraph } from '../coherence/graph';
import { detectEdges, tokensToPrice } from '../coherence/detector';
import { maxSharesPreservingEdgeMulti } from '../risk/sizing';
import { simulateBuy } from '../coherence/pricing';
import { SEED_EVENT_SLUGS, NBA_TAG_IDS } from '../nba/league';

export interface CoherenceStrategyOptions {
  /** Minimum implied probability for a node to have its book fetched. */
  minProb: number;
  /** Max events to pull per discovery tag. */
  maxEvents: number;
}

const EMPTY_GRAPH: CoherenceGraph = { nodes: new Map(), implications: [], partitions: [] };

/**
 * The NBA coherence-arbitrage strategy. Implements Canon's
 * `fetch → analyze → decide → execute` contract. It never forecasts outcomes —
 * it harvests market-neutral edges wherever the market's own prices break the
 * logic that relates them.
 */
export class CoherenceStrategy implements Strategy {
  readonly name = 'arbiter';
  graph: CoherenceGraph = EMPTY_GRAPH;
  books: Map<string, OrderBook> = new Map();

  constructor(
    private readonly client: PolymarketClient,
    private readonly risk: RiskContext,
    private readonly opts: CoherenceStrategyOptions,
  ) {}

  fetchMarkets(): Promise<Market[]> {
    return this.client.fetchNbaUniverse({
      seedEventSlugs: SEED_EVENT_SLUGS,
      tagIds: NBA_TAG_IDS,
      maxEvents: this.opts.maxEvents,
    });
  }

  async analyze(markets: Market[]): Promise<CoherenceEdge[]> {
    this.graph = buildGraph(markets);
    const tokenIds = tokensToPrice(this.graph, this.opts.minProb);
    this.books = await this.client.fetchOrderBooks(tokenIds);
    return detectEdges(this.graph, this.books, this.risk);
  }

  async decide(edges: CoherenceEdge[], ctx: RiskContext): Promise<SizedOrder[]> {
    const orders: SizedOrder[] = [];
    const maxSumPrice = 1 - ctx.minEdge - ctx.takerFeeBps / 10_000;
    let deployed = ctx.deployedUsd;

    for (const edge of edges) {
      if (edge.netEdge < ctx.minEdge) continue;
      const askBooks = edge.legs.map((l) => this.books.get(l.token.tokenId)?.asks ?? []);
      if (askBooks.some((a) => a.length === 0)) continue;

      const sumRef = edge.legs.reduce((s, l) => s + l.refPrice, 0);
      const maxRef = Math.max(...edge.legs.map((l) => l.refPrice));
      const notionalCap = maxRef > 0 ? ctx.maxStakePerLegUsd / maxRef : 0;
      const bankrollCap = sumRef > 0 ? Math.max(0, ctx.bankrollUsd - deployed) / sumRef : 0;
      const hardCap = Math.min(notionalCap, bankrollCap);

      const shares = maxSharesPreservingEdgeMulti(askBooks, maxSumPrice, hardCap);
      if (shares < 1) continue;

      for (const leg of edge.legs) {
        const book = this.books.get(leg.token.tokenId);
        if (!book) continue;
        const fill = simulateBuy(book, shares);
        orders.push({
          ...leg,
          edgeId: edge.id,
          size: shares,
          limitPrice: fill.worstPrice,
          expectedAvgPrice: fill.avgPrice,
          notionalUsd: fill.cash,
        });
        deployed += fill.cash;
      }
    }
    return orders;
  }

  async execute(orders: SizedOrder[], broker: Broker): Promise<Fill[]> {
    const fills: Fill[] = [];
    for (const order of orders) {
      fills.push(await broker.submit(order));
    }
    return fills;
  }
}
