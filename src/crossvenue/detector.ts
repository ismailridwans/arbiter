import type { KalshiMarket } from '../kalshi/client';

/**
 * Cross-venue arbitrage: the SAME real-world event (e.g. "Team T wins the 2026
 * title") priced on two INDEPENDENT order books — Polymarket and Kalshi. If the
 * venues disagree, buying YES on the cheaper venue and NO on the dearer locks a
 * payout of $1 for less than $1, regardless of who wins.
 *
 * This is where persistent, fat arbs actually live — and it's the engine's
 * generalization beyond a single venue. All functions here are pure/testable.
 */

export interface VenueQuote {
  yesAsk?: number;
  yesBid?: number;
  noAsk?: number;
  noBid?: number;
  yesMid?: number;
}

export interface MatchedMarket {
  team: string;
  pm: VenueQuote;
  kalshi: VenueQuote;
}

export type ArbDirection = 'pm-yes-kalshi-no' | 'kalshi-yes-pm-no';

export interface CrossVenueEdge {
  team: string;
  direction: ArbDirection;
  legA: string;
  legB: string;
  costA: number;
  costB: number;
  kalshiFee: number;
  /** 1 − (costA + costB) − kalshiFee. Positive ⇒ locked cross-venue arbitrage. */
  netEdge: number;
  pmYesMid?: number;
  kalshiYesMid?: number;
}

/** Kalshi taker fee ≈ 0.07 × price × (1−price) per contract (their published formula). */
const KALSHI_FEE_RATE = 0.07;
export function kalshiFee(price: number): number {
  return KALSHI_FEE_RATE * price * (1 - price);
}

function midOf(bid?: number, ask?: number): number | undefined {
  if (bid != null && ask != null) return (bid + ask) / 2;
  return ask ?? bid;
}

/** Best (highest-net-edge) cross-venue arbitrage for one matched market, or null. */
export function crossVenueEdge(m: MatchedMarket): CrossVenueEdge | null {
  const candidates: CrossVenueEdge[] = [];

  if (m.pm.yesAsk != null && m.kalshi.noAsk != null) {
    const fee = kalshiFee(m.kalshi.noAsk);
    candidates.push({
      team: m.team,
      direction: 'pm-yes-kalshi-no',
      legA: 'Polymarket YES',
      legB: 'Kalshi NO',
      costA: m.pm.yesAsk,
      costB: m.kalshi.noAsk,
      kalshiFee: fee,
      netEdge: 1 - (m.pm.yesAsk + m.kalshi.noAsk) - fee,
      pmYesMid: m.pm.yesMid,
      kalshiYesMid: m.kalshi.yesMid,
    });
  }

  if (m.kalshi.yesAsk != null && m.pm.noAsk != null) {
    const fee = kalshiFee(m.kalshi.yesAsk);
    candidates.push({
      team: m.team,
      direction: 'kalshi-yes-pm-no',
      legA: 'Kalshi YES',
      legB: 'Polymarket NO',
      costA: m.kalshi.yesAsk,
      costB: m.pm.noAsk,
      kalshiFee: fee,
      netEdge: 1 - (m.kalshi.yesAsk + m.pm.noAsk) - fee,
      pmYesMid: m.pm.yesMid,
      kalshiYesMid: m.kalshi.yesMid,
    });
  }

  if (candidates.length === 0) return null;
  return candidates.reduce((best, c) => (c.netEdge > best.netEdge ? c : best));
}

export function detectCrossVenue(matches: MatchedMarket[]): CrossVenueEdge[] {
  return matches
    .map(crossVenueEdge)
    .filter((e): e is CrossVenueEdge => e !== null)
    .sort((a, b) => b.netEdge - a.netEdge);
}

/** Join Polymarket per-team quotes with Kalshi markets by canonical team name. */
export function matchByTeam(
  pm: Map<string, VenueQuote>,
  kalshi: KalshiMarket[],
): MatchedMarket[] {
  const out: MatchedMarket[] = [];
  for (const k of kalshi) {
    const p = pm.get(k.team);
    if (!p) continue;
    out.push({
      team: k.team,
      pm: p,
      kalshi: { yesAsk: k.yesAsk, yesBid: k.yesBid, noAsk: k.noAsk, noBid: k.noBid, yesMid: midOf(k.yesBid, k.yesAsk) },
    });
  }
  return out;
}
