import type { PolymarketClient } from '../polymarket/client';
import type { KalshiClient } from '../kalshi/client';
import { canonicalTeam } from '../nba/league';
import { yesToken, noToken } from '../coherence/graph';
import { bestAsk } from '../coherence/pricing';
import {
  matchByTeam,
  detectCrossVenue,
  type VenueQuote,
  type CrossVenueEdge,
  type MatchedMarket,
} from './detector';

export interface CrossVenueResult {
  edges: CrossVenueEdge[];
  matches: MatchedMarket[];
  pmCount: number;
  kalshiCount: number;
}

/**
 * Fetch the 2026 NBA Champion market from both Polymarket and Kalshi, align by
 * team, and detect cross-venue arbitrage. Polymarket order books are fetched
 * only for contender teams (implied prob ≥ minProb) to bound network calls.
 */
export async function runCrossVenue(
  pm: PolymarketClient,
  kalshi: KalshiClient,
  opts: { minProb: number },
): Promise<CrossVenueResult> {
  const [pmMarkets, kalshiMarkets] = await Promise.all([
    pm.fetchEventBySlug('2026-nba-champion'),
    kalshi.fetchChampionMarkets(),
  ]);

  const pmQuotes = new Map<string, VenueQuote>();
  const bookFetches: Promise<void>[] = [];
  for (const m of pmMarkets) {
    const team = canonicalTeam(m.group) ?? canonicalTeam(m.question);
    if (!team) continue;
    const yes = yesToken(m);
    const no = noToken(m);
    const quote: VenueQuote = { yesMid: yes?.price };
    pmQuotes.set(team, quote);
    if ((yes?.price ?? 0) >= opts.minProb && yes?.tokenId && no?.tokenId) {
      bookFetches.push(
        (async () => {
          const [yesBook, noBook] = await Promise.all([
            pm.fetchOrderBook(yes.tokenId).catch(() => null),
            pm.fetchOrderBook(no.tokenId).catch(() => null),
          ]);
          if (yesBook) quote.yesAsk = bestAsk(yesBook);
          if (noBook) quote.noAsk = bestAsk(noBook);
        })(),
      );
    }
  }
  await Promise.all(bookFetches);

  const matches = matchByTeam(pmQuotes, kalshiMarkets);
  return {
    edges: detectCrossVenue(matches),
    matches,
    pmCount: pmQuotes.size,
    kalshiCount: kalshiMarkets.length,
  };
}
