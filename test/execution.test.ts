import { describe, it, expect } from 'vitest';
import { buildClobOrder, LiveBroker, toCanonOrderArgs, canonOrderCommand } from '../src/execution/live-broker';
import { PaperBroker } from '../src/execution/paper-broker';
import { CoherenceStrategy } from '../src/strategy/coherence-strategy';
import type { Market, OrderBook, RiskContext, SizedOrder } from '../src/types';
import type { PolymarketClient } from '../src/polymarket/client';

const RISK: RiskContext = {
  bankrollUsd: 1000,
  deployedUsd: 0,
  minEdge: 0.02,
  kellyFraction: 0.25,
  maxStakePerLegUsd: 50,
  takerFeeBps: 0,
};

const ob = (tokenId: string, ask: number): OrderBook => ({
  tokenId,
  asks: [{ price: ask, size: 1000 }],
  bids: [{ price: Math.max(0, ask - 0.02), size: 1000 }],
  timestamp: 0,
});

function mkt(o: {
  id: string;
  question: string;
  group: string;
  eventSlug: string;
  eventTitle?: string;
  yes: number;
  yesTok: string;
  noTok: string;
}): Market {
  return {
    id: o.id,
    slug: o.id,
    question: o.question,
    active: true,
    closed: false,
    tags: [],
    group: o.group,
    eventSlug: o.eventSlug,
    eventTitle: o.eventTitle ?? '',
    outcomes: [
      { tokenId: o.yesTok, outcome: 'Yes', price: o.yes },
      { tokenId: o.noTok, outcome: 'No', price: 1 - o.yes },
    ],
  };
}

const sizedOrder = (tokenId: string, price: number, size: number): SizedOrder => ({
  market: mkt({ id: 'm', question: 'Q', group: 'Boston Celtics', eventSlug: '2026-nba-champion', yes: price, yesTok: tokenId, noTok: 'n' }),
  token: { tokenId, outcome: 'Yes', price },
  side: 'BUY',
  refPrice: price,
  edgeId: 'e',
  size,
  limitPrice: price,
  expectedAvgPrice: price,
  notionalUsd: price * size,
});

describe('buildClobOrder', () => {
  it('builds an FOK BUY at the limit price', () => {
    expect(buildClobOrder(sizedOrder('t1', 0.45, 10))).toEqual({
      tokenId: 't1',
      side: 'BUY',
      price: 0.45,
      size: 10,
      orderType: 'FOK',
    });
  });
});

describe('toCanonOrderArgs / canonOrderCommand', () => {
  it('maps a sized leg to canon-cli order create arguments', () => {
    expect(toCanonOrderArgs(sizedOrder('t1', 0.45, 10))).toEqual([
      'order', 'create', '--token-id', 't1', '--side', 'buy', '--size', '10', '--price', '0.45', '--type', 'limit',
    ]);
    expect(canonOrderCommand(sizedOrder('t1', 0.45, 10))).toContain('canon-cli order create --token-id t1');
  });
});

describe('LiveBroker (dry-run)', () => {
  it('constructs an order but does not fill', async () => {
    const fake = { fetchOrderBook: async () => ob('t1', 0.45) } as unknown as PolymarketClient;
    const broker = new LiveBroker(fake, true);
    const fill = await broker.submit(sizedOrder('t1', 0.45, 10));
    expect(fill.filledSize).toBe(0);
    expect(fill.simulated).toBe(false);
    expect(broker.getPositions()).toHaveLength(0);
  });
});

describe('CoherenceStrategy end-to-end (mock client)', () => {
  it('fetches → analyzes → decides → executes an implication arb', async () => {
    const champ = mkt({ id: 'champ', question: 'Will the Boston Celtics win the 2026 NBA Finals?', group: 'Boston Celtics', eventSlug: '2026-nba-champion', yes: 0.6, yesTok: 'cy', noTok: 'cn' });
    const conf = mkt({ id: 'conf', question: 'Will the Boston Celtics win the NBA Eastern Conference Finals?', group: 'Boston Celtics', eventSlug: 'nba-playoffs-eastern-conference-champion', eventTitle: 'NBA Playoffs: Eastern Conference Champion', yes: 0.5, yesTok: 'ey', noTok: 'en' });
    const books = new Map<string, OrderBook>([
      ['cy', ob('cy', 0.62)],
      ['cn', ob('cn', 0.45)],
      ['ey', ob('ey', 0.45)],
      ['en', ob('en', 0.6)],
    ]);
    const mock = {
      fetchNbaUniverse: async () => [champ, conf],
      fetchOrderBooks: async (ids: string[]) =>
        new Map(ids.filter((id) => books.has(id)).map((id) => [id, books.get(id)!])),
      fetchOrderBook: async (id: string) => books.get(id) ?? ob(id, 0.99),
    } as unknown as PolymarketClient;

    const strategy = new CoherenceStrategy(mock, RISK, { minProb: 0.01, maxEvents: 40 });
    const markets = await strategy.fetchMarkets();
    expect(markets).toHaveLength(2);

    const edges = await strategy.analyze(markets);
    const impl = edges.find((e) => e.type === 'implication');
    expect(impl).toBeDefined();
    expect(impl!.netEdge).toBeCloseTo(0.1, 9);

    const orders = await strategy.decide(edges.filter((e) => e.netEdge >= RISK.minEdge), RISK);
    expect(orders.length).toBe(2);

    const fills = await strategy.execute(orders, new PaperBroker(mock, 0));
    expect(fills).toHaveLength(2);
    expect(fills.every((f) => f.filledSize > 0)).toBe(true);
  });
});
