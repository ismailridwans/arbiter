import type { OrderBookLevel } from '../types';

/**
 * Pure position-sizing math: fractional Kelly for probabilistic signals, plus a
 * liquidity-aware "max shares that still preserve the edge" solver for risk-free
 * arbitrage legs. Pure functions → high unit-test coverage.
 */

const EPS = 1e-12;

export function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/**
 * Fractional-Kelly stake as a fraction of bankroll for buying a YES share at
 * `price` given estimated true probability `trueProb`. Returns 0 with no edge
 * or degenerate prices.
 */
export function fractionalKelly(price: number, trueProb: number, fraction: number): number {
  if (price <= 0 || price >= 1) return 0;
  const b = (1 - price) / price; // net decimal odds for a 1-unit stake
  const q = clamp01(trueProb);
  const p = 1 - q;
  const fullKelly = (b * q - p) / b;
  return clamp01(fullKelly * clamp01(fraction));
}

export function sharesForNotional(notionalUsd: number, price: number): number {
  return price > 0 ? notionalUsd / price : 0;
}

/** Cumulative cost to buy `n` shares from ascending asks. */
function cumCost(asks: OrderBookLevel[], n: number): number {
  let rem = n;
  let cost = 0;
  for (const lvl of asks) {
    if (rem <= EPS) break;
    const take = Math.min(rem, lvl.size);
    cost += take * lvl.price;
    rem -= take;
  }
  return cost;
}

function totalDepth(levels: OrderBookLevel[]): number {
  return levels.reduce((s, l) => s + l.size, 0);
}

/**
 * Largest share count `N` (≤ `hardShareCap` and ≤ joint depth) such that buying
 * `N` shares on BOTH ask books keeps the combined average price ≤ `maxSumPrice`.
 *
 * The combined average price is monotonically non-decreasing in `N` (you consume
 * progressively worse levels), so we evaluate at every level boundary across both
 * books and solve the linear crossing inside the segment where the budget breaks.
 */
/**
 * Largest share count `N` (≤ `hardShareCap` and joint depth) such that buying
 * `N` shares across ALL `askBooks` keeps the COMBINED average price ≤ `maxSumPrice`.
 *
 * The combined average is monotonically non-decreasing in `N` (you consume
 * progressively worse levels), so we evaluate at every level boundary across the
 * books and solve the linear crossing inside the segment where the budget breaks.
 */
export function maxSharesPreservingEdgeMulti(
  askBooks: OrderBookLevel[][],
  maxSumPrice: number,
  hardShareCap: number,
): number {
  if (askBooks.length === 0) return 0;
  const cap = Math.min(hardShareCap, ...askBooks.map(totalDepth));
  if (cap <= 0) return 0;

  const breakpoints = new Set<number>();
  for (const book of askBooks) {
    let acc = 0;
    for (const lvl of book) {
      acc += lvl.size;
      if (acc <= cap) breakpoints.add(acc);
    }
  }
  breakpoints.add(cap);
  const xs = [...breakpoints].filter((x) => x > 0).sort((a, b) => a - b);

  let best = 0;
  let prevN = 0;
  let prevCost = 0;
  for (const n of xs) {
    const cost = askBooks.reduce((sum, book) => sum + cumCost(book, n), 0);
    if (cost / n <= maxSumPrice + EPS) {
      best = n;
      prevN = n;
      prevCost = cost;
      continue;
    }
    // Budget breaks inside (prevN, n]; the marginal sum-price is constant here.
    const marginal = (cost - prevCost) / (n - prevN);
    const denom = marginal - maxSumPrice;
    if (denom > EPS) {
      const nStar = (prevN * marginal - prevCost) / denom;
      if (nStar > best) best = Math.min(nStar, n);
    }
    break;
  }
  return Math.max(0, best);
}

/** Two-leg convenience wrapper (e.g. an implication or complementary arb). */
export function maxSharesPreservingEdge(
  asksA: OrderBookLevel[],
  asksB: OrderBookLevel[],
  maxSumPrice: number,
  hardShareCap: number,
): number {
  return maxSharesPreservingEdgeMulti([asksA, asksB], maxSumPrice, hardShareCap);
}
