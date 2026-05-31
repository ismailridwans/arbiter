import type { Market, OrderBook } from './types';

/**
 * A self-contained DEMO scenario. Live championship/conference markets are
 * efficient at season's end (0 tradeable edges), so this constructs a
 * real-MAGNITUDE coherence dislocation — the kind that occurred in earlier,
 * less-liquid playoff rounds — so the full detect → size → execute → P&L
 * pipeline can be shown end-to-end. It is clearly labeled as synthetic; it is
 * NOT live market data.
 */

export interface DemoScenario {
  markets: Market[];
  books: Map<string, OrderBook>;
  note: string;
}

function ob(tokenId: string, ask: number, size = 250): OrderBook {
  return {
    tokenId,
    asks: [{ price: ask, size }],
    bids: [{ price: Math.max(0, ask - 0.02), size }],
    timestamp: 0,
  };
}

function market(
  id: string,
  question: string,
  group: string,
  eventSlug: string,
  yes: number,
  yesTok: string,
  noTok: string,
  eventTitle = '',
): Market {
  return {
    id,
    slug: id,
    question,
    active: true,
    closed: false,
    tags: [],
    group,
    eventSlug,
    eventTitle,
    outcomes: [
      { tokenId: yesTok, outcome: 'Yes', price: yes },
      { tokenId: noTok, outcome: 'No', price: 1 - yes },
    ],
  };
}

export function buildDemoScenario(): DemoScenario {
  // Championship 42% > conference 37% for the same team — an incoherent ordering
  // (champion ⊑ conference). Buying NO(champion) @ ~0.59 + YES(conference) @ ~0.38
  // costs ~0.97 for a guaranteed $1 payout: a locked ~3% market-neutral edge.
  const champ = market(
    'demo-champ',
    'Will the Boston Celtics win the 2026 NBA Finals?',
    'Boston Celtics',
    '2026-nba-champion',
    0.42,
    'demo-cy',
    'demo-cn',
  );
  const conf = market(
    'demo-conf',
    'Will the Boston Celtics win the NBA Eastern Conference Finals?',
    'Boston Celtics',
    'nba-playoffs-eastern-conference-champion',
    0.37,
    'demo-ey',
    'demo-en',
    'NBA Playoffs: Eastern Conference Champion',
  );
  const books = new Map<string, OrderBook>([
    ['demo-cy', ob('demo-cy', 0.43)],
    ['demo-cn', ob('demo-cn', 0.59)],
    ['demo-ey', ob('demo-ey', 0.38)],
    ['demo-en', ob('demo-en', 0.63)],
  ]);
  return {
    markets: [champ, conf],
    books,
    note: 'SYNTHETIC real-magnitude dislocation — championship 42% > conference 37% (an ordering that cannot hold). Typical of earlier, thinner playoff rounds; not live data.',
  };
}
