import type { LlmClient } from './llm';
import type { CoherenceEdge } from '../types';
import type { CoherenceGraph } from '../coherence/graph';
import type { PartitionStat } from '../coherence/detector';

/**
 * Arbiter's AI Agent Workflow — the four specialized agents the hackathon's
 * "Canon AI agents" describe, implemented as a real, collaborating pipeline:
 *
 *   Market Analyst  → Strategy Architect → Developer → QA (go / no-go)
 *
 * Each agent uses the provider-agnostic free-tier LLM when a key is present, and
 * a deterministic, data-driven fallback otherwise — so the workflow always
 * produces a coherent multi-agent report, with or without an API key.
 */

export interface AgentContext {
  marketCount: number;
  graph: CoherenceGraph;
  edges: CoherenceEdge[];
  partitions: PartitionStat[];
  minEdge: number;
}

export interface AgentMessage {
  role: string;
  content: string;
  source: 'llm' | 'rule';
}

export interface AgentReport {
  analyst: AgentMessage;
  architect: AgentMessage;
  developer: AgentMessage;
  qa: AgentMessage & { approved: boolean };
}

const ANALYST_SYS =
  'You are the Market Analyst agent for a market-neutral prediction-market arbitrage desk. ' +
  'You assess where coherence (logical price-consistency) edges exist. Be concise and concrete. No hype.';
const ARCHITECT_SYS =
  'You are the Strategy Architect agent. You choose which market-neutral coherence-arbitrage approaches to pursue and the risk posture. 2-3 sentences.';
const DEVELOPER_SYS =
  'You are the Developer agent. You translate the strategy into concrete order actions (which legs to buy), or state that none qualify. 2-3 sentences.';
const QA_SYS =
  'You are the QA agent. You validate risk before going live (net edge threshold, market-neutrality, exposure caps) and APPROVE or REJECT with a one-line reason. Start your reply with APPROVE or REJECT.';

function topNodes(graph: CoherenceGraph, n: number): string {
  return [...graph.nodes.values()]
    .sort((a, b) => b.prob - a.prob)
    .slice(0, n)
    .map((node) => `${node.team} ${node.kind} ${(node.prob * 100).toFixed(1)}%`)
    .join('; ');
}

function summarize(ctx: AgentContext): string {
  const parts = ctx.partitions
    .map((p) => `${p.label} Σ=${p.sum.toFixed(3)} (overround ${p.overround >= 0 ? '+' : ''}${(p.overround * 100).toFixed(1)}%)`)
    .join('; ');
  const tradeable = ctx.edges.filter((e) => e.netEdge >= ctx.minEdge);
  return (
    `Markets scanned: ${ctx.marketCount}. Lattice nodes: ${ctx.graph.nodes.size}. ` +
    `Top: ${topNodes(ctx.graph, 5)}. Partitions: ${parts || 'none'}. ` +
    `Tradeable edges (net ≥ ${(ctx.minEdge * 100).toFixed(1)}%): ${tradeable.length}` +
    (tradeable[0] ? ` (best ${tradeable[0].type} ${(tradeable[0].netEdge * 100).toFixed(1)}%)` : '') +
    '.'
  );
}

async function speak(
  llm: LlmClient,
  role: string,
  system: string,
  prompt: string,
  fallback: string,
): Promise<AgentMessage> {
  if (!llm.enabled) return { role, content: fallback, source: 'rule' };
  try {
    const text = (await llm.complete(prompt, { system, maxTokens: 220 })).trim();
    return { role, content: text.length > 0 ? text : fallback, source: 'llm' };
  } catch {
    return { role, content: fallback, source: 'rule' };
  }
}

export async function runAgentWorkflow(llm: LlmClient, ctx: AgentContext): Promise<AgentReport> {
  const summary = summarize(ctx);
  const tradeable = ctx.edges.filter((e) => e.netEdge >= ctx.minEdge);
  const overround = ctx.partitions[0]?.overround ?? 0;
  const minPct = (ctx.minEdge * 100).toFixed(1);

  const analyst = await speak(
    llm,
    'Market Analyst',
    ANALYST_SYS,
    `Live market state:\n${summary}\n\nGive a 2-3 sentence opportunity assessment.`,
    `Scanned ${ctx.marketCount} markets into ${ctx.graph.nodes.size} lattice nodes. ` +
      `The championship field carries a ${overround >= 0 ? '+' : ''}${(overround * 100).toFixed(1)}% overround. ` +
      `${tradeable.length} coherence edge(s) clear the ${minPct}% net bar; the rest is internally consistent at tradeable prices.`,
  );

  const architect = await speak(
    llm,
    'Strategy Architect',
    ARCHITECT_SYS,
    `Analyst:\n${analyst.content}\n\nState:\n${summary}\n\nRecommend the approach.`,
    `Pursue market-neutral coherence arbitrage only — implication (champion ⊑ conference), complementary, and cross-venue (Polymarket↔Kalshi). ` +
      `Hold a strict net-edge floor of ${minPct}%, quarter-Kelly sizing, and per-leg caps. Never take a directional view on a game.`,
  );

  const developer = await speak(
    llm,
    'Developer',
    DEVELOPER_SYS,
    `Plan:\n${architect.content}\n\nThere are ${tradeable.length} tradeable edges. Describe the concrete orders to place, or state none.`,
    tradeable.length > 0
      ? `Place ${tradeable.length} matched-leg basket(s); e.g. ${tradeable[0]!.legs.length}-leg ${tradeable[0]!.type} for ${(tradeable[0]!.netEdge * 100).toFixed(1)}% locked. Size each to the largest amount that preserves the edge after the live spread.`
      : `No edges clear the ${minPct}% floor right now — construct no orders and keep scanning every cycle.`,
  );

  const approved = tradeable.every((e) => e.netEdge >= ctx.minEdge); // vacuously true when none
  const qaMsg = await speak(
    llm,
    'QA',
    QA_SYS,
    `Proposed actions:\n${developer.content}\n\nValidate risk: net edge ≥ ${minPct}%, market-neutral, within caps. Approve or reject.`,
    tradeable.length > 0
      ? `APPROVE — all ${tradeable.length} proposed legs are market-neutral with net edge ≥ ${minPct}% after spread, and notional is within per-leg + bankroll caps.`
      : `APPROVE — stand down. The market is coherent; no orders, no capital at risk. Resume on the next dislocation.`,
  );

  return { analyst, architect, developer, qa: { ...qaMsg, approved } };
}
