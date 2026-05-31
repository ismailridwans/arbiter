/**
 * Core domain model for Coherence.
 *
 * The {@link Strategy} interface intentionally mirrors Canon's documented
 * automation pipeline — `fetch → analysis → decision → execution` — so a
 * Coherence strategy drops directly into a `canon init` scaffold and is driven
 * by `canon start`.
 */

/** A single tradeable outcome token on a prediction-market venue. */
export interface OutcomeToken {
  /** CLOB ERC-1155 token id; used to look up the live order book. */
  tokenId: string;
  /** Human label for the outcome, e.g. "Yes" or a team name. */
  outcome: string;
  /** Market-implied price in [0,1] (≈ probability of this outcome). */
  price: number;
}

/** A normalized prediction market (one question) with its outcomes. */
export interface Market {
  id: string;
  slug: string;
  question: string;
  description?: string;
  active: boolean;
  closed: boolean;
  endDate?: string;
  tags: string[];
  /** Group label from Polymarket — the team name for a per-team market. */
  group?: string;
  /** Parent event context, used by the classifier to place the market in the lattice. */
  eventSlug?: string;
  eventTitle?: string;
  outcomes: OutcomeToken[];
  liquidityUsd?: number;
  volumeUsd?: number;
}

/** Where in the prediction-market "probability lattice" a market sits. */
export type MarketKind =
  | 'championship' // wins the title (most specific / smallest set)
  | 'conference' // wins the conference
  | 'division'
  | 'series' // wins the current playoff series
  | 'game' // wins a single game
  | 'prop'
  | 'other';

/** Result of classifying a market into the lattice (rule-based or LLM). */
export interface MarketClassification {
  kind: MarketKind;
  /** Canonical team that is the subject of the claim, if any. */
  team?: string;
  conference?: 'East' | 'West';
  opponent?: string;
  /** Free-form scope, e.g. "2026 Finals", "Round 2". */
  scope?: string;
  confidence: number; // 0..1
  source: 'rule' | 'llm';
}

/**
 * A node in the coherence lattice: the proposition "team T achieves event E",
 * carrying the market-implied probability for that proposition.
 */
export interface LatticeNode {
  /** Canonical identity, e.g. "OKC Thunder:championship". */
  key: string;
  team: string;
  kind: MarketKind;
  /** Market-implied probability of this proposition in [0,1]. */
  prob: number;
  market: Market;
  /** The specific YES token that pays out if the proposition is true. */
  token: OutcomeToken;
}

/**
 * A logical implication `sub ⊑ sup`: event `sub` implies event `sup`, therefore
 * a coherent market must satisfy `P(sub) ≤ P(sup)`. e.g. champion ⊑ conference.
 */
export interface Implication {
  sub: string; // node key of the more specific (subset) event
  sup: string; // node key of the broader (superset) event
  rationale: string;
}

export type EdgeType =
  | 'implication' // P(sub) > P(sup): the lattice ordering is violated (champion ⊑ conference)
  | 'complementary' // ask(YES) + ask(NO) < 1 within a single binary market
  | 'dutchbook' // Σ ask(YES) < 1 across a mutually-exclusive, exhaustive set
  | 'partition'; // Σ P over an exhaustive partition deviates from 1 (soft signal)

/** One leg of a market-neutral trade that harvests a coherence violation. */
export interface TradeLeg {
  market: Market;
  token: OutcomeToken;
  /** BUY = buy YES shares; SELL = buy the complementary NO side. */
  side: 'BUY' | 'SELL';
  /** Reference (pre-trade) price for this leg. */
  refPrice: number;
}

/** A detected, tradeable coherence violation. */
export interface CoherenceEdge {
  id: string;
  type: EdgeType;
  legs: TradeLeg[];
  /** Gross probability gap implied by the violation. */
  rawEdge: number;
  /** Edge remaining after fees + slippage + spread; this is what we act on. */
  netEdge: number;
  rationale: string;
  /** Optional plain-language explanation (LLM-generated). */
  explanation?: string;
  /** Lattice nodes involved, for display/logging. */
  nodes: LatticeNode[];
  timestamp: number;
}

/** A trade leg sized into a concrete, executable order under risk limits. */
export interface SizedOrder extends TradeLeg {
  /** Number of shares to transact. */
  size: number;
  /** Worst acceptable price derived from walking the live book. */
  limitPrice: number;
  /** Expected average fill price from the book walk. */
  expectedAvgPrice: number;
  notionalUsd: number;
  /** Id of the edge this order belongs to. */
  edgeId: string;
}

/** The realized (or simulated) result of submitting an order. */
export interface Fill {
  order: SizedOrder;
  filledSize: number;
  avgPrice: number;
  costUsd: number;
  feeUsd: number;
  timestamp: number;
  /** True when filled against the live book in paper mode. */
  simulated: boolean;
}

/** One side of the live order book. */
export interface OrderBookLevel {
  price: number;
  size: number;
}

export interface OrderBook {
  tokenId: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  timestamp: number;
}

/** A running position in a single outcome token. */
export interface Position {
  tokenId: string;
  market: string; // question text, for display
  outcome: string;
  shares: number;
  avgPrice: number;
  costUsd: number;
}

/** Risk context passed into the decision stage. */
export interface RiskContext {
  bankrollUsd: number;
  deployedUsd: number;
  minEdge: number;
  kellyFraction: number;
  maxStakePerLegUsd: number;
  takerFeeBps: number;
}

/** Broker abstraction shared by the paper and live execution back-ends. */
export interface Broker {
  readonly mode: 'paper' | 'live';
  getBook(tokenId: string): Promise<OrderBook>;
  submit(order: SizedOrder): Promise<Fill>;
}

/**
 * The Coherence strategy contract. Each method maps 1:1 to a stage of Canon's
 * automation pipeline, which the live dashboard renders as
 * `fetch → analysis → decision → execution`.
 */
export interface Strategy {
  readonly name: string;
  /** Stage 1 — FETCH: pull live market data. */
  fetchMarkets(): Promise<Market[]>;
  /** Stage 2 — ANALYZE: turn raw markets into detected edges. */
  analyze(markets: Market[]): Promise<CoherenceEdge[]>;
  /** Stage 3 — DECIDE: size edges into concrete orders under risk limits. */
  decide(edges: CoherenceEdge[], ctx: RiskContext): Promise<SizedOrder[]>;
  /** Stage 4 — EXECUTE: route orders to the broker (paper or live). */
  execute(orders: SizedOrder[], broker: Broker): Promise<Fill[]>;
}
