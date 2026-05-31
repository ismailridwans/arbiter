import { z } from 'zod';
import type { Market, OutcomeToken } from '../types';
import { clampProb } from '../coherence/pricing';

/**
 * Zod schemas + normalizers for the Polymarket Gamma (metadata/prices) and CLOB
 * (order book) APIs. Gamma encodes its list fields — `outcomes`, `outcomePrices`,
 * `clobTokenIds` — as JSON *strings*, so we tolerate both string and array forms.
 */

const StringifiedArray = z.preprocess((v) => {
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return Array.isArray(v) ? v : [];
}, z.array(z.union([z.string(), z.number()])).default([]));

const idLike = z.union([z.string(), z.number()]).transform(String);

export const GammaTagSchema = z
  .object({ id: idLike.optional(), label: z.string().optional(), slug: z.string().optional() })
  .passthrough();

export const GammaMarketSchema = z
  .object({
    id: idLike,
    question: z.string().default(''),
    slug: z.string().default(''),
    description: z.string().optional(),
    active: z.boolean().default(false),
    closed: z.boolean().default(true),
    endDate: z.string().optional(),
    groupItemTitle: z.string().optional(),
    outcomes: StringifiedArray,
    outcomePrices: StringifiedArray,
    clobTokenIds: StringifiedArray,
    volume: z.coerce.number().optional(),
    liquidity: z.coerce.number().optional(),
  })
  .passthrough();
export type GammaMarket = z.infer<typeof GammaMarketSchema>;

export const GammaEventSchema = z
  .object({
    id: idLike,
    ticker: z.string().optional(),
    slug: z.string().default(''),
    title: z.string().default(''),
    description: z.string().optional(),
    active: z.boolean().default(false),
    closed: z.boolean().default(true),
    tags: z.array(GammaTagSchema).default([]),
    markets: z.array(GammaMarketSchema).default([]),
  })
  .passthrough();
export type GammaEvent = z.infer<typeof GammaEventSchema>;

export const ClobLevelSchema = z
  .object({ price: z.coerce.number(), size: z.coerce.number() })
  .passthrough();

export const ClobBookSchema = z
  .object({
    asset_id: z.string().optional(),
    market: z.string().optional(),
    bids: z.array(ClobLevelSchema).default([]),
    asks: z.array(ClobLevelSchema).default([]),
  })
  .passthrough();
export type ClobBook = z.infer<typeof ClobBookSchema>;

interface EventContext {
  slug?: string;
  title?: string;
  tags?: { label?: string; slug?: string }[];
}

/** Normalize a Gamma market (+ optional parent event) into our domain {@link Market}. */
export function normalizeMarket(m: GammaMarket, event?: EventContext): Market {
  const outcomes = m.outcomes.map(String);
  const prices = m.outcomePrices.map((x) => Number(x));
  const tokenIds = m.clobTokenIds.map(String);
  const tokens: OutcomeToken[] = outcomes.map((outcome, i) => ({
    outcome,
    price: clampProb(prices[i] ?? Number.NaN),
    tokenId: tokenIds[i] ?? '',
  }));
  const tagLabels = (event?.tags ?? [])
    .map((t) => t.label ?? t.slug ?? '')
    .filter((s): s is string => s.length > 0);
  return {
    id: m.id,
    slug: m.slug,
    question: m.question,
    description: m.description,
    active: m.active,
    closed: m.closed,
    endDate: m.endDate,
    group: m.groupItemTitle,
    eventSlug: event?.slug,
    eventTitle: event?.title,
    tags: tagLabels,
    outcomes: tokens,
    liquidityUsd: m.liquidity,
    volumeUsd: m.volume,
  };
}
