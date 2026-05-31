import { describe, it, expect } from 'vitest';
import { alignViolations, type BacktestParams } from '../src/backtest/backtest';
import type { PricePoint } from '../src/polymarket/history';

const params = (over: Partial<BacktestParams> = {}): BacktestParams => ({
  fidelityMin: 2, // tolerance = 120s
  threshold: 0,
  spreadHaircut: 0,
  sizeUsd: 50,
  ...over,
});

const series = (...pts: [number, number][]): PricePoint[] => pts.map(([t, p]) => ({ t, p }));

describe('alignViolations', () => {
  it('captures a single violation episode and prices the locked profit', () => {
    const sub = series([0, 0.5], [100, 0.7], [200, 0.5]); // champion
    const sup = series([0, 0.6], [100, 0.6], [200, 0.6]); // conference
    const eps = alignViolations(sub, sup, params());
    expect(eps).toHaveLength(1);
    expect(eps[0]!.rawEdge).toBeCloseTo(0.1, 9);
    // costPerPair = (1-0.7)+0.6 = 0.9 ; shares = 50/0.9 ; profit = 0.1 * shares
    expect(eps[0]!.profitUsd).toBeCloseTo((0.1 * 50) / 0.9, 6);
  });

  it('enters ONCE per contiguous violation (no over-counting)', () => {
    const sub = series([0, 0.5], [100, 0.7], [200, 0.72], [300, 0.5]);
    const sup = series([0, 0.6], [100, 0.6], [200, 0.6], [300, 0.6]);
    expect(alignViolations(sub, sup, params())).toHaveLength(1);
  });

  it('drops episodes once the spread haircut erases the edge', () => {
    const sub = series([100, 0.7]);
    const sup = series([100, 0.6]);
    expect(alignViolations(sub, sup, params({ spreadHaircut: 0.06 }))).toHaveLength(0); // 0.1 - 0.12 < 0
  });

  it('joins by nearest timestamp within tolerance', () => {
    expect(alignViolations(series([100, 0.7]), series([101, 0.6]), params())).toHaveLength(1);
  });

  it('ignores observations outside the tolerance window', () => {
    expect(alignViolations(series([100, 0.7]), series([10_000, 0.6]), params())).toHaveLength(0);
  });

  it('returns nothing for empty inputs', () => {
    expect(alignViolations([], series([1, 0.5]), params())).toHaveLength(0);
    expect(alignViolations(series([1, 0.5]), [], params())).toHaveLength(0);
  });
});
