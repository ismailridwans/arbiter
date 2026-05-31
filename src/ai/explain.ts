import type { LlmClient } from './llm';
import type { CoherenceEdge } from '../types';

/**
 * Turn a detected edge into a one-line, trader-readable rationale. Falls back to
 * the engine's deterministic rationale when the LLM is disabled or errors.
 */
export async function explainEdge(llm: LlmClient, edge: CoherenceEdge): Promise<string> {
  if (!llm.enabled) return edge.rationale;
  try {
    const prompt =
      `Explain this prediction-market coherence arbitrage in ONE concise sentence for a trader. ` +
      `Be concrete and avoid hype.\n` +
      `Type: ${edge.type}\nDetail: ${edge.rationale}\nNet edge: ${(edge.netEdge * 100).toFixed(1)}%`;
    const text = (await llm.complete(prompt, { maxTokens: 120 })).trim();
    return text.length > 0 ? text : edge.rationale;
  } catch {
    return edge.rationale;
  }
}

/** Enrich up to `limit` edges with AI explanations (bounded for free-tier rate limits). */
export async function enrichEdges(
  llm: LlmClient,
  edges: CoherenceEdge[],
  limit = 5,
): Promise<CoherenceEdge[]> {
  if (!llm.enabled || edges.length === 0) return edges;
  const targets = edges.slice(0, limit);
  await Promise.all(
    targets.map(async (e) => {
      e.explanation = await explainEdge(llm, e);
    }),
  );
  return edges;
}
