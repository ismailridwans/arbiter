import type { LlmClient } from './llm';
import { extractJson } from './llm';
import type { Market, MarketClassification, MarketKind } from '../types';
import { classifyMarket } from '../coherence/graph';
import { canonicalTeam } from '../nba/league';

/**
 * AI market classifier. The deterministic rule classifier handles NBA; the LLM
 * generalizes the SAME lattice abstraction to arbitrary markets/sports/events
 * (the "scales beyond the hackathon" story). Always falls back to rules on any
 * failure, so the engine is never blocked on the model.
 */

const SYSTEM =
  'You classify prediction markets into a probability lattice used for coherence ' +
  'arbitrage. A more specific event implies a broader one (championship ⊑ conference ⊑ ' +
  'series ⊑ game). Respond with JSON only, no prose.';

const KINDS: ReadonlySet<string> = new Set([
  'championship',
  'conference',
  'division',
  'series',
  'game',
  'prop',
  'other',
]);

interface RawClassification {
  kind?: string;
  team?: string | null;
  conference?: string | null;
  scope?: string;
  confidence?: number;
}

export async function aiClassifyMarket(
  llm: LlmClient,
  market: Market,
): Promise<MarketClassification> {
  if (!llm.enabled) return classifyMarket(market);
  try {
    const prompt =
      `Classify this prediction market.\n` +
      `Question: ${market.question}\n` +
      `Event: ${market.eventTitle ?? ''}\n` +
      `Group: ${market.group ?? ''}\n` +
      `Tags: ${market.tags.join(', ')}\n\n` +
      `Return JSON: {"kind":"championship|conference|division|series|game|prop|other",` +
      `"team":"<canonical team name or null>","conference":"East|West|null",` +
      `"scope":"<short label>","confidence":<0..1>}`;
    const raw = JSON.parse(extractJson(await llm.complete(prompt, { system: SYSTEM, json: true, maxTokens: 200 }))) as RawClassification;
    const kind = (KINDS.has(raw.kind ?? '') ? raw.kind : 'other') as MarketKind;
    const team = raw.team ? (canonicalTeam(raw.team) ?? raw.team) : undefined;
    const conference =
      raw.conference === 'East' || raw.conference === 'West' ? raw.conference : undefined;
    return {
      kind,
      team,
      conference,
      scope: raw.scope,
      confidence: typeof raw.confidence === 'number' ? raw.confidence : 0.5,
      source: 'llm',
    };
  } catch {
    return classifyMarket(market);
  }
}
