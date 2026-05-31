import { describe, it, expect } from 'vitest';
import {
  clampProb,
  walk,
  bestAsk,
  bestBid,
  midPrice,
  spread,
  simulateBuy,
  simulateSell,
  depthWithinPrice,
  feeUsd,
} from '../src/coherence/pricing';
import type { OrderBook } from '../src/types';

const book = (asks: [number, number][], bids: [number, number][]): OrderBook => ({
  tokenId: 't',
  asks: asks.map(([price, size]) => ({ price, size })),
  bids: bids.map(([price, size]) => ({ price, size })),
  timestamp: 0,
});

describe('clampProb', () => {
  it('clamps to [0,1] and maps NaN to 0', () => {
    expect(clampProb(0.5)).toBe(0.5);
    expect(clampProb(-1)).toBe(0);
    expect(clampProb(2)).toBe(1);
    expect(clampProb(Number.NaN)).toBe(0);
  });
});

describe('walk', () => {
  it('fills across levels and computes VWAP + worst price', () => {
    const r = walk([{ price: 0.5, size: 10 }, { price: 0.6, size: 10 }], 15);
    expect(r.filled).toBe(15);
    expect(r.cash).toBeCloseTo(0.5 * 10 + 0.6 * 5, 9);
    expect(r.avgPrice).toBeCloseTo(8 / 15, 9);
    expect(r.worstPrice).toBe(0.6);
  });

  it('stops at available depth', () => {
    const r = walk([{ price: 0.4, size: 5 }], 100);
    expect(r.filled).toBe(5);
    expect(r.avgPrice).toBeCloseTo(0.4, 9);
  });

  it('returns zeros on empty book', () => {
    const r = walk([], 10);
    expect(r.filled).toBe(0);
    expect(r.avgPrice).toBe(0);
    expect(r.cash).toBe(0);
  });
});

describe('top-of-book helpers', () => {
  const b = book([[0.55, 100], [0.6, 50]], [[0.45, 80], [0.4, 60]]);
  it('reads best ask/bid, mid, and spread', () => {
    expect(bestAsk(b)).toBe(0.55);
    expect(bestBid(b)).toBe(0.45);
    expect(midPrice(b)).toBeCloseTo(0.5, 9);
    expect(spread(b)).toBeCloseTo(0.1, 9);
  });
  it('handles one-sided books', () => {
    expect(midPrice(book([[0.7, 10]], []))).toBe(0.7);
    expect(spread(book([[0.7, 10]], []))).toBeUndefined();
  });
});

describe('simulateBuy / simulateSell', () => {
  const b = book([[0.55, 100]], [[0.45, 100]]);
  it('buys against asks and sells against bids', () => {
    expect(simulateBuy(b, 10).avgPrice).toBeCloseTo(0.55, 9);
    expect(simulateSell(b, 10).avgPrice).toBeCloseTo(0.45, 9);
  });
});

describe('depthWithinPrice / feeUsd', () => {
  it('sums depth at or below a limit price', () => {
    const levels = [{ price: 0.5, size: 10 }, { price: 0.55, size: 20 }, { price: 0.7, size: 30 }];
    expect(depthWithinPrice(levels, 0.55)).toBe(30);
    expect(depthWithinPrice(levels, 0.49)).toBe(0);
  });
  it('computes basis-point fees', () => {
    expect(feeUsd(100, 0)).toBe(0);
    expect(feeUsd(100, 50)).toBeCloseTo(0.5, 9);
  });
});
