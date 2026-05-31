import { z } from 'zod';

/** A single historical price observation for a CLOB token. */
export interface PricePoint {
  /** Unix timestamp (seconds). */
  t: number;
  /** Implied price in [0,1]. */
  p: number;
}

export const PriceHistorySchema = z.object({
  history: z
    .array(z.object({ t: z.coerce.number(), p: z.coerce.number() }))
    .default([]),
});
