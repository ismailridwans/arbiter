import { describe, it, expect } from 'vitest';
import { classifyMarket, buildGraph } from '../src/coherence/graph';
import { detectEdges } from '../src/coherence/detector';
import type { Market, OutcomeToken, OrderBook, RiskContext } from '../src/types';

const tok = (tokenId: string, outcome: string, price: number): OutcomeToken => ({
  tokenId,
  outcome,
  price,
});

function market(opts: {
  id: string;
  question: string;
  group: string;
  eventSlug: string;
  eventTitle?: string;
  yesPrice: number;
  yesTok: string;
  noTok: string;
}): Market {
  return {
    id: opts.id,
    slug: opts.id,
    question: opts.question,
    active: true,
    closed: false,
    tags: [],
    group: opts.group,
    eventSlug: opts.eventSlug,
    eventTitle: opts.eventTitle ?? '',
    outcomes: [tok(opts.yesTok, 'Yes', opts.yesPrice), tok(opts.noTok, 'No', 1 - opts.yesPrice)],
  };
}

const champ = (yesPrice: number) =>
  market({
    id: 'champ-bos',
    question: 'Will the Boston Celtics win the 2026 NBA Finals?',
    group: 'Boston Celtics',
    eventSlug: '2026-nba-champion',
    yesPrice,
    yesTok: 'cy',
    noTok: 'cn',
  });

const conf = (yesPrice: number) =>
  market({
    id: 'conf-bos',
    question: 'Will the Boston Celtics win the NBA Eastern Conference Finals?',
    group: 'Boston Celtics',
    eventSlug: 'nba-playoffs-eastern-conference-champion',
    eventTitle: 'NBA Playoffs: Eastern Conference Champion',
    yesPrice,
    yesTok: 'ey',
    noTok: 'en',
  });

const ob = (tokenId: string, ask: number): OrderBook => ({
  tokenId,
  asks: [{ price: ask, size: 1000 }],
  bids: [{ price: Math.max(0, ask - 0.02), size: 1000 }],
  timestamp: 0,
});

const RISK: RiskContext = {
  bankrollUsd: 1000,
  deployedUsd: 0,
  minEdge: 0.02,
  kellyFraction: 0.25,
  maxStakePerLegUsd: 50,
  takerFeeBps: 0,
};

describe('classifyMarket', () => {
  it('classifies a championship market with team + conference', () => {
    const c = classifyMarket(champ(0.2));
    expect(c.kind).toBe('championship');
    expect(c.team).toBe('Boston Celtics');
    expect(c.conference).toBe('East');
  });

  it('classifies a conference market (disambiguated from "Finals")', () => {
    const c = classifyMarket(conf(0.4));
    expect(c.kind).toBe('conference');
    expect(c.team).toBe('Boston Celtics');
  });
});

describe('buildGraph', () => {
  it('builds nodes and the champion ⊑ conference implication', () => {
    const g = buildGraph([champ(0.2), conf(0.4)]);
    expect(g.nodes.size).toBe(2);
    expect(g.implications).toHaveLength(1);
    expect(g.implications[0]!.sub).toBe('Boston Celtics:championship');
    expect(g.implications[0]!.sup).toBe('Boston Celtics:conference');
  });
});

describe('detectEdges', () => {
  it('finds an implication arb when P(champion) > P(conference)', () => {
    const g = buildGraph([champ(0.6), conf(0.5)]); // raw violation 0.10
    const books = new Map<string, OrderBook>([
      ['cn', ob('cn', 0.45)], // buy NO(champion) @ 0.45
      ['ey', ob('ey', 0.45)], // buy YES(conference) @ 0.45
      ['cy', ob('cy', 0.62)], // keep complementary sums ≥ 1 to isolate the implication
      ['en', ob('en', 0.6)],
    ]);
    const edges = detectEdges(g, books, RISK);
    const impl = edges.find((e) => e.type === 'implication');
    expect(impl).toBeDefined();
    expect(impl!.rawEdge).toBeCloseTo(0.1, 9);
    expect(impl!.netEdge).toBeCloseTo(0.1, 9); // 1 - (0.45 + 0.45)
    expect(impl!.legs).toHaveLength(2);
  });

  it('finds a complementary arb when ask(YES) + ask(NO) < 1', () => {
    const g = buildGraph([champ(0.5)]);
    const books = new Map<string, OrderBook>([
      ['cy', ob('cy', 0.4)],
      ['cn', ob('cn', 0.5)], // 0.4 + 0.5 = 0.9 < 1
    ]);
    const edges = detectEdges(g, books, RISK);
    const comp = edges.find((e) => e.type === 'complementary');
    expect(comp).toBeDefined();
    expect(comp!.netEdge).toBeCloseTo(0.1, 9);
  });

  it('returns no edges when the market is coherent and tight', () => {
    const g = buildGraph([champ(0.4), conf(0.5)]); // champion < conference: coherent
    const books = new Map<string, OrderBook>([
      ['cy', ob('cy', 0.42)],
      ['cn', ob('cn', 0.6)],
      ['ey', ob('ey', 0.52)],
      ['en', ob('en', 0.5)],
    ]);
    expect(detectEdges(g, books, RISK)).toHaveLength(0);
  });
});
