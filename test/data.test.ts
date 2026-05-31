import { describe, it, expect } from 'vitest';
import { GammaMarketSchema, normalizeMarket } from '../src/polymarket/schema';
import { PaperBroker } from '../src/execution/paper-broker';
import type { OrderBook, SizedOrder } from '../src/types';
import type { PolymarketClient } from '../src/polymarket/client';

describe('normalizeMarket', () => {
  it('parses Gamma JSON-encoded string fields into a typed Market', () => {
    const raw = GammaMarketSchema.parse({
      id: 123,
      question: 'Will the Boston Celtics win the 2026 NBA Finals?',
      slug: 'will-bos',
      active: true,
      closed: false,
      groupItemTitle: 'Boston Celtics',
      outcomes: '["Yes", "No"]',
      outcomePrices: '["0.2", "0.8"]',
      clobTokenIds: '["t1", "t2"]',
      volume: '500',
      liquidity: '1000',
    });
    const m = normalizeMarket(raw, {
      slug: '2026-nba-champion',
      title: '2026 NBA Champion',
      tags: [{ label: 'NBA' }, { label: 'NBA Champion' }],
    });
    expect(m.id).toBe('123');
    expect(m.group).toBe('Boston Celtics');
    expect(m.eventSlug).toBe('2026-nba-champion');
    expect(m.tags).toContain('NBA');
    expect(m.outcomes).toHaveLength(2);
    expect(m.outcomes[0]).toEqual({ outcome: 'Yes', price: 0.2, tokenId: 't1' });
    expect(m.outcomes[1]).toEqual({ outcome: 'No', price: 0.8, tokenId: 't2' });
    expect(m.volumeUsd).toBe(500);
  });

  it('tolerates malformed list fields without throwing', () => {
    const raw = GammaMarketSchema.parse({
      id: 'x',
      outcomes: 'not-json',
      outcomePrices: '[]',
      clobTokenIds: '[]',
    });
    const m = normalizeMarket(raw);
    expect(m.outcomes).toHaveLength(0);
  });
});

describe('PaperBroker', () => {
  it('fills against the live book and tracks the position', async () => {
    const book: OrderBook = {
      tokenId: 't1',
      asks: [{ price: 0.5, size: 100 }],
      bids: [{ price: 0.48, size: 100 }],
      timestamp: 0,
    };
    const fakeClient = { fetchOrderBook: async () => book } as unknown as PolymarketClient;
    const broker = new PaperBroker(fakeClient, 0);

    const order = {
      market: { question: 'Will the Boston Celtics win the 2026 NBA Finals?' },
      token: { tokenId: 't1', outcome: 'Yes', price: 0.5 },
      side: 'BUY',
      refPrice: 0.5,
      edgeId: 'e1',
      size: 10,
      limitPrice: 0.5,
      expectedAvgPrice: 0.5,
      notionalUsd: 5,
    } as unknown as SizedOrder;

    const fill = await broker.submit(order);
    expect(fill.filledSize).toBe(10);
    expect(fill.avgPrice).toBeCloseTo(0.5, 9);
    expect(fill.costUsd).toBeCloseTo(5, 9);
    expect(broker.getPositions()).toHaveLength(1);
    expect(broker.getInvestedUsd()).toBeCloseTo(5, 9);
  });
});
