import { z } from 'zod';
import { KALSHI_TEAM_ABBR } from '../nba/league';

/**
 * Read-only client for Kalshi's public market-data API (no auth required for
 * reads). Used to fetch the parallel 2026 NBA Champion market (series `KXNBA`,
 * per-team binary markets `KXNBA-26-XXX`) for cross-venue arbitrage vs Polymarket.
 * Kalshi reports prices in dollars [0,1].
 */

const KalshiMarketSchema = z
  .object({
    ticker: z.string(),
    yes_sub_title: z.string().optional(),
    no_sub_title: z.string().optional(),
    status: z.string().optional(),
    yes_bid_dollars: z.coerce.number().optional(),
    yes_ask_dollars: z.coerce.number().optional(),
    no_bid_dollars: z.coerce.number().optional(),
    no_ask_dollars: z.coerce.number().optional(),
    last_price_dollars: z.coerce.number().optional(),
  })
  .passthrough();

const KalshiMarketsResponse = z
  .object({
    markets: z.array(KalshiMarketSchema).default([]),
    cursor: z.string().optional(),
  })
  .catch({ markets: [], cursor: '' });

export interface KalshiMarket {
  team: string;
  ticker: string;
  yesBid?: number;
  yesAsk?: number;
  noBid?: number;
  noAsk?: number;
  last?: number;
  status?: string;
}

const TIMEOUT_MS = 12_000;

export class KalshiClient {
  constructor(private readonly baseUrl = 'https://api.elections.kalshi.com/trade-api/v2') {}

  private async getJson(url: string): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json' } });
      if (!res.ok) throw new Error(`GET ${url} -> ${res.status} ${res.statusText}`);
      return (await res.json()) as unknown;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Fetch the per-team 2026 NBA Champion markets, mapped to canonical team
   * names via the ticker abbreviation (handles LAL/LAC unambiguously).
   */
  async fetchChampionMarkets(
    seriesTicker = 'KXNBA',
    seasonPrefix = 'KXNBA-26-',
  ): Promise<KalshiMarket[]> {
    const data = await this.getJson(
      `${this.baseUrl}/markets?series_ticker=${encodeURIComponent(seriesTicker)}&limit=200`,
    );
    const parsed = KalshiMarketsResponse.parse(data);
    const out: KalshiMarket[] = [];
    for (const m of parsed.markets) {
      if (!m.ticker.startsWith(seasonPrefix)) continue;
      const abbr = m.ticker.slice(seasonPrefix.length).toUpperCase();
      const team = KALSHI_TEAM_ABBR[abbr];
      if (!team) continue;
      out.push({
        team,
        ticker: m.ticker,
        yesBid: m.yes_bid_dollars,
        yesAsk: m.yes_ask_dollars,
        noBid: m.no_bid_dollars,
        noAsk: m.no_ask_dollars,
        last: m.last_price_dollars,
        status: m.status,
      });
    }
    return out;
  }
}
