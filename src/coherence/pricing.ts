import type { OrderBook, OrderBookLevel } from '../types';

/**
 * Order-book-aware pricing primitives. All functions here are PURE and
 * deterministic, which keeps them trivially unit-testable (Technical Execution
 * rubric: test coverage). They assume the convention enforced by the Polymarket
 * client: `asks` are sorted ascending by price, `bids` descending.
 */

const EPS = 1e-9;

/** Clamp a probability to [0,1], mapping NaN to 0. */
export function clampProb(p: number): number {
  if (Number.isNaN(p)) return 0;
  return Math.max(0, Math.min(1, p));
}

export interface WalkResult {
  /** Shares actually fillable from the supplied depth. */
  filled: number;
  /** Volume-weighted average price across filled shares (0 if none filled). */
  avgPrice: number;
  /** Price of the deepest level touched — the limit you would post. */
  worstPrice: number;
  /** USD paid (buying) or received (selling). */
  cash: number;
}

/**
 * Consume `shares` from one side of the book, best level first. `levels` must
 * already be ordered in consumption order (ascending for asks, descending for
 * bids).
 */
export function walk(levels: OrderBookLevel[], shares: number): WalkResult {
  let remaining = shares;
  let cash = 0;
  let filled = 0;
  let worstPrice = 0;
  for (const lvl of levels) {
    if (remaining <= EPS) break;
    const take = Math.min(remaining, lvl.size);
    cash += take * lvl.price;
    filled += take;
    worstPrice = lvl.price;
    remaining -= take;
  }
  return { filled, avgPrice: filled > 0 ? cash / filled : 0, worstPrice, cash };
}

export function bestAsk(book: OrderBook): number | undefined {
  return book.asks[0]?.price;
}

export function bestBid(book: OrderBook): number | undefined {
  return book.bids[0]?.price;
}

export function midPrice(book: OrderBook): number | undefined {
  const a = bestAsk(book);
  const b = bestBid(book);
  if (a === undefined || b === undefined) return a ?? b;
  return (a + b) / 2;
}

export function spread(book: OrderBook): number | undefined {
  const a = bestAsk(book);
  const b = bestBid(book);
  if (a === undefined || b === undefined) return undefined;
  return a - b;
}

/** Cost to BUY `shares` of a token, walking its ask side. */
export function simulateBuy(book: OrderBook, shares: number): WalkResult {
  return walk(book.asks, shares);
}

/** Proceeds from SELLING `shares` of a token, walking its bid side. */
export function simulateSell(book: OrderBook, shares: number): WalkResult {
  return walk(book.bids, shares);
}

/** Total shares available at or below `limitPrice` on the ask side. */
export function depthWithinPrice(levels: OrderBookLevel[], limitPrice: number): number {
  let total = 0;
  for (const lvl of levels) {
    if (lvl.price > limitPrice + EPS) break;
    total += lvl.size;
  }
  return total;
}

/** Taker fee in USD for a given notional and fee rate (basis points). */
export function feeUsd(notionalUsd: number, takerFeeBps: number): number {
  return (notionalUsd * takerFeeBps) / 10_000;
}
