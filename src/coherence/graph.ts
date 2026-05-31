import type {
  Market,
  OutcomeToken,
  LatticeNode,
  Implication,
  MarketClassification,
  MarketKind,
} from '../types';
import { canonicalTeam, conferenceOf, type Conference } from '../nba/league';

/**
 * Builds the "coherence lattice": a graph of propositions ("team T achieves
 * event E") carrying market-implied probabilities, plus the logical relations
 * those probabilities MUST satisfy if the market is coherent:
 *   - implications:  champion ⊑ conference ⊑ series   ⇒  P(sub) ≤ P(sup)
 *   - partitions:    exactly one champion (per conference / overall) ⇒ Σ P = 1
 * The detector then looks for prices that violate these relations.
 */

/** An exhaustive, mutually-exclusive set of propositions whose probs sum to 1. */
export interface Partition {
  id: string;
  label: string;
  nodeKeys: string[];
  expectedSum: number;
}

export interface CoherenceGraph {
  nodes: Map<string, LatticeNode>;
  implications: Implication[];
  partitions: Partition[];
}

export function yesToken(m: Market): OutcomeToken | undefined {
  return m.outcomes.find((o) => /^yes$/i.test(o.outcome)) ?? m.outcomes[0];
}

export function noToken(m: Market): OutcomeToken | undefined {
  return m.outcomes.find((o) => /^no$/i.test(o.outcome)) ?? m.outcomes[1];
}

/** Rule-based classification of an NBA market into the lattice (LLM-free path). */
export function classifyMarket(m: Market): MarketClassification {
  const text = `${m.eventTitle ?? ''} ${m.question} ${m.eventSlug ?? ''} ${m.tags.join(' ')}`.toLowerCase();
  const team = canonicalTeam(m.group) ?? canonicalTeam(m.question);
  const conference: Conference | undefined =
    (team ? conferenceOf(team) : undefined) ??
    (/eastern/.test(text) ? 'East' : /western/.test(text) ? 'West' : undefined);

  let kind: MarketKind = 'other';
  if (/conference/.test(text)) kind = 'conference';
  else if (/nba finals|nba champion/.test(text) || m.eventSlug === '2026-nba-champion')
    kind = 'championship';
  else if (/\bseries\b|round \d|first round|second round|semifinal/.test(text)) kind = 'series';

  return {
    kind,
    team,
    conference,
    confidence: team && kind !== 'other' ? 0.9 : 0.3,
    source: 'rule',
  };
}

const LATTICE_KINDS: ReadonlySet<MarketKind> = new Set(['championship', 'conference', 'series']);

function nodeKey(team: string, kind: MarketKind): string {
  return `${team}:${kind}`;
}

/**
 * Build the coherence graph from a market universe. `classify` is injectable so
 * an AI classifier can be swapped in for non-NBA / unseen markets.
 */
export function buildGraph(
  markets: Market[],
  classify: (m: Market) => MarketClassification = classifyMarket,
): CoherenceGraph {
  const nodes = new Map<string, LatticeNode>();

  for (const m of markets) {
    const c = classify(m);
    if (!c.team || !LATTICE_KINDS.has(c.kind)) continue;
    const yes = yesToken(m);
    if (!yes?.tokenId) continue;
    const key = nodeKey(c.team, c.kind);
    const existing = nodes.get(key);
    // On collision keep the more liquid market (better fills, truer price).
    if (!existing || (m.volumeUsd ?? 0) > (existing.market.volumeUsd ?? 0)) {
      nodes.set(key, { key, team: c.team, kind: c.kind, prob: yes.price, market: m, token: yes });
    }
  }

  const implications: Implication[] = [];
  const addImpl = (team: string, sub: MarketKind, sup: MarketKind, why: string): void => {
    if (nodes.has(nodeKey(team, sub)) && nodes.has(nodeKey(team, sup))) {
      implications.push({ sub: nodeKey(team, sub), sup: nodeKey(team, sup), rationale: why });
    }
  };
  for (const n of nodes.values()) {
    if (n.kind === 'championship') {
      addImpl(n.team, 'championship', 'conference', `${n.team} must win its conference to win the title`);
      addImpl(n.team, 'championship', 'series', `${n.team} must win its current series to win the title`);
    } else if (n.kind === 'conference') {
      addImpl(n.team, 'conference', 'series', `${n.team} must win its current series to reach the Finals`);
    }
  }

  const partitions: Partition[] = [];
  const champions = [...nodes.values()].filter((n) => n.kind === 'championship');
  if (champions.length >= 2) {
    partitions.push({
      id: 'champion',
      label: 'NBA Champion (all teams)',
      nodeKeys: champions.map((n) => n.key),
      expectedSum: 1,
    });
  }
  for (const conf of ['East', 'West'] as const) {
    const members = [...nodes.values()].filter(
      (n) => n.kind === 'conference' && conferenceOf(n.team) === conf,
    );
    if (members.length >= 2) {
      partitions.push({
        id: `conference-${conf}`,
        label: `${conf === 'East' ? 'Eastern' : 'Western'} Conference Champion`,
        nodeKeys: members.map((n) => n.key),
        expectedSum: 1,
      });
    }
  }

  return { nodes, implications, partitions };
}
