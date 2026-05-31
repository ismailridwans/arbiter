import { z } from 'zod';
import type { Market, OrderBook } from '../types';
import { GammaEventSchema, ClobBookSchema, normalizeMarket } from './schema';
import { PriceHistorySchema, type PricePoint } from './history';

/**
 * Read-only client for Polymarket's public Gamma + CLOB APIs. No auth/KYC is
 * required to read live prices and order books, which is exactly what powers
 * our "paper trading against LIVE data" mode.
 */

export interface NbaUniverseOptions {
  /** Known event slugs to seed from (reliable). */
  seedEventSlugs: string[];
  /** Tag ids to auto-discover related events (scalable). */
  tagIds: string[];
  /** Max events to pull per tag. */
  maxEvents: number;
}

const TIMEOUT_MS = 12_000;
const EventsResponse = z.array(GammaEventSchema).catch([]);

export class PolymarketClient {
  constructor(
    private readonly gammaUrl: string,
    private readonly clobUrl: string,
  ) {}

  private async getJson(url: string, retries = 2): Promise<unknown> {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const res = await fetch(url, {
          signal: controller.signal,
          headers: { accept: 'application/json' },
        });
        if (!res.ok) throw new Error(`GET ${url} -> ${res.status} ${res.statusText}`);
        return (await res.json()) as unknown;
      } catch (err) {
        lastErr = err;
        if (attempt < retries) await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastErr;
  }

  async fetchEventBySlug(slug: string): Promise<Market[]> {
    const data = await this.getJson(`${this.gammaUrl}/events?slug=${encodeURIComponent(slug)}`);
    return EventsResponse.parse(data).flatMap((e) => e.markets.map((m) => normalizeMarket(m, e)));
  }

  async fetchEventsByTag(tagId: string, maxEvents: number): Promise<Market[]> {
    const url = `${this.gammaUrl}/events?tag_id=${encodeURIComponent(tagId)}&closed=false&limit=${maxEvents}`;
    const data = await this.getJson(url);
    return EventsResponse.parse(data).flatMap((e) => e.markets.map((m) => normalizeMarket(m, e)));
  }

  /**
   * Build the active NBA market universe from seed events + tag discovery,
   * deduped by market id and filtered to tradeable, open markets.
   */
  async fetchNbaUniverse(opts: NbaUniverseOptions): Promise<Market[]> {
    const results = await Promise.allSettled([
      ...opts.seedEventSlugs.map((s) => this.fetchEventBySlug(s)),
      ...opts.tagIds.map((t) => this.fetchEventsByTag(t, opts.maxEvents)),
    ]);

    const byId = new Map<string, Market>();
    for (const r of results) {
      if (r.status !== 'fulfilled') continue;
      for (const m of r.value) {
        if (m.closed) continue;
        if (m.outcomes.length < 2) continue;
        if (m.outcomes.some((o) => !o.tokenId)) continue;
        if (!byId.has(m.id)) byId.set(m.id, m);
      }
    }
    return [...byId.values()];
  }

  /** Fetch a single token's live order book, normalized to our sort convention. */
  async fetchOrderBook(tokenId: string): Promise<OrderBook> {
    const data = await this.getJson(`${this.clobUrl}/book?token_id=${encodeURIComponent(tokenId)}`);
    const book = ClobBookSchema.parse(data);
    return {
      tokenId,
      asks: book.asks.map((l) => ({ price: l.price, size: l.size })).sort((a, b) => a.price - b.price),
      bids: book.bids.map((l) => ({ price: l.price, size: l.size })).sort((a, b) => b.price - a.price),
      timestamp: Date.now(),
    };
  }

  /** Fetch a token's full historical price series (used by the backtest). */
  async fetchPriceHistory(tokenId: string, fidelityMin: number): Promise<PricePoint[]> {
    const url = `${this.clobUrl}/prices-history?market=${encodeURIComponent(tokenId)}&interval=max&fidelity=${fidelityMin}`;
    const data = await this.getJson(url);
    return PriceHistorySchema.parse(data).history;
  }

  /** Fetch books for many tokens concurrently; failed lookups are dropped. */
  async fetchOrderBooks(tokenIds: string[]): Promise<Map<string, OrderBook>> {
    const unique = [...new Set(tokenIds.filter(Boolean))];
    const settled = await Promise.allSettled(unique.map((id) => this.fetchOrderBook(id)));
    const books = new Map<string, OrderBook>();
    settled.forEach((s, i) => {
      if (s.status === 'fulfilled') books.set(unique[i]!, s.value);
    });
    return books;
  }
}
