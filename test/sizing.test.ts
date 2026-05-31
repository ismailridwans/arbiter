import { describe, it, expect } from 'vitest';
import {
  clamp01,
  fractionalKelly,
  sharesForNotional,
  maxSharesPreservingEdge,
  maxSharesPreservingEdgeMulti,
} from '../src/risk/sizing';
import type { OrderBookLevel } from '../src/types';

const lvl = (price: number, size: number): OrderBookLevel => ({ price, size });

describe('clamp01', () => {
  it('bounds to [0,1]', () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(0.3)).toBe(0.3);
    expect(clamp01(5)).toBe(1);
  });
});

describe('fractionalKelly', () => {
  it('computes full Kelly when there is an edge', () => {
    // price 0.5, trueProb 0.6: b=1, full Kelly = (1*0.6 - 0.4)/1 = 0.2
    expect(fractionalKelly(0.5, 0.6, 1)).toBeCloseTo(0.2, 9);
  });
  it('scales by the fraction', () => {
    expect(fractionalKelly(0.5, 0.6, 0.25)).toBeCloseTo(0.05, 9);
  });
  it('returns 0 with no edge or degenerate prices', () => {
    expect(fractionalKelly(0.5, 0.5, 1)).toBe(0);
    expect(fractionalKelly(0, 0.6, 1)).toBe(0);
    expect(fractionalKelly(1, 0.6, 1)).toBe(0);
  });
});

describe('sharesForNotional', () => {
  it('divides notional by price', () => {
    expect(sharesForNotional(50, 0.25)).toBe(200);
    expect(sharesForNotional(50, 0)).toBe(0);
  });
});

describe('maxSharesPreservingEdgeMulti', () => {
  it('fills full depth when the combined price stays under budget', () => {
    const n = maxSharesPreservingEdgeMulti([[lvl(0.4, 100)], [lvl(0.5, 100)]], 0.95, 1000);
    expect(n).toBe(100); // capped by joint depth; avg 0.9 ≤ 0.95
  });

  it('returns 0 when even the first share breaks the budget', () => {
    const n = maxSharesPreservingEdgeMulti([[lvl(0.4, 100)], [lvl(0.5, 100)]], 0.85, 1000);
    expect(n).toBe(0); // marginal 0.9 > 0.85
  });

  it('solves the partial fill inside the breaking segment', () => {
    // A: 50@0.4 then 50@0.6 ; B: 100@0.5 ; budget 0.95
    // N=50 -> (20+25)/50 = 0.90 ok ; N=100 -> 100/100 = 1.0 too high
    // crossing: marginal 1.1, nStar = (50*1.1 - 45)/(1.1-0.95) = 10/0.15 = 66.67
    const n = maxSharesPreservingEdgeMulti(
      [[lvl(0.4, 50), lvl(0.6, 50)], [lvl(0.5, 100)]],
      0.95,
      1000,
    );
    expect(n).toBeCloseTo(66.667, 2);
  });

  it('respects the hard share cap', () => {
    const n = maxSharesPreservingEdgeMulti([[lvl(0.4, 1000)], [lvl(0.5, 1000)]], 0.95, 30);
    expect(n).toBe(30);
  });

  it('returns 0 for empty input', () => {
    expect(maxSharesPreservingEdgeMulti([], 0.95, 100)).toBe(0);
  });
});

describe('maxSharesPreservingEdge (2-leg wrapper)', () => {
  it('matches the multi-leg solver', () => {
    const a = [lvl(0.4, 50), lvl(0.6, 50)];
    const b = [lvl(0.5, 100)];
    expect(maxSharesPreservingEdge(a, b, 0.95, 1000)).toBeCloseTo(
      maxSharesPreservingEdgeMulti([a, b], 0.95, 1000),
      9,
    );
  });
});
