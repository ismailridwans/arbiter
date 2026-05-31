import { describe, it, expect } from 'vitest';
import {
  kalshiFee,
  crossVenueEdge,
  detectCrossVenue,
  matchByTeam,
  type MatchedMarket,
  type VenueQuote,
} from '../src/crossvenue/detector';
import type { KalshiMarket } from '../src/kalshi/client';

describe('kalshiFee', () => {
  it('follows 0.07·p·(1−p) and is zero at the bounds', () => {
    expect(kalshiFee(0.5)).toBeCloseTo(0.0175, 9);
    expect(kalshiFee(0)).toBe(0);
    expect(kalshiFee(1)).toBe(0);
  });
});

describe('crossVenueEdge', () => {
  it('picks the cheaper-YES / dearer-NO direction', () => {
    const m: MatchedMarket = {
      team: 'San Antonio Spurs',
      pm: { yesAsk: 0.35, noAsk: 0.66, yesMid: 0.35 },
      kalshi: { yesAsk: 0.42, noAsk: 0.6, yesMid: 0.41 },
    };
    const e = crossVenueEdge(m);
    expect(e).not.toBeNull();
    expect(e!.direction).toBe('pm-yes-kalshi-no');
    expect(e!.netEdge).toBeCloseTo(1 - 0.35 - 0.6 - kalshiFee(0.6), 9);
  });

  it('returns null when no complete pair of legs is quotable', () => {
    expect(crossVenueEdge({ team: 'X', pm: { yesMid: 0.5 }, kalshi: { yesMid: 0.5 } })).toBeNull();
  });
});

describe('matchByTeam + detectCrossVenue', () => {
  it('joins by canonical team and sorts edges by net descending', () => {
    const pm = new Map<string, VenueQuote>([
      ['San Antonio Spurs', { yesAsk: 0.35, noAsk: 0.66, yesMid: 0.35 }],
      ['New York Knicks', { yesAsk: 0.66, noAsk: 0.35, yesMid: 0.66 }],
    ]);
    const kalshi: KalshiMarket[] = [
      { team: 'San Antonio Spurs', ticker: 'KXNBA-26-SAS', yesAsk: 0.42, noAsk: 0.6 },
      { team: 'New York Knicks', ticker: 'KXNBA-26-NYK', yesAsk: 0.4, noAsk: 0.62 },
      { team: 'Miami Heat', ticker: 'KXNBA-26-MIA', yesAsk: 0.01, noAsk: 1.0 }, // no PM match
    ];
    const matches = matchByTeam(pm, kalshi);
    expect(matches).toHaveLength(2);
    const edges = detectCrossVenue(matches);
    expect(edges.length).toBeGreaterThan(0);
    for (let i = 1; i < edges.length; i++) {
      expect(edges[i - 1]!.netEdge).toBeGreaterThanOrEqual(edges[i]!.netEdge);
    }
  });
});
