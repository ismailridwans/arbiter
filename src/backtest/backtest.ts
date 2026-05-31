import type { PolymarketClient } from '../polymarket/client';
import type { PricePoint } from '../polymarket/history';
import type { Market, MarketKind } from '../types';
import { classifyMarket, yesToken } from '../coherence/graph';
import { SEED_EVENT_SLUGS } from '../nba/league';

/**
 * Historical backtest of the coherence-arbitrage strategy. Replays real
 * Polymarket price history over the playoff season and books the locked minimum
 * profit each time the champion ⊑ conference ordering was violated.
 *
 * Fills are modeled at the historical mid price minus a per-leg `spreadHaircut`
 * (order-book depth isn't available historically). We enter ONCE per contiguous
 * violation episode — not every tick — to avoid over-counting persistent gaps.
 */

export interface BacktestParams {
  /** History resolution in minutes (e.g. 60 = hourly, 1440 = daily). */
  fidelityMin: number;
  /** Minimum raw violation (P(sub) − P(sup)) required to act. */
  threshold: number;
  /** Modeled per-leg execution cost in price units (spread/slippage haircut). */
  spreadHaircut: number;
  /** Target notional per captured edge (USD). */
  sizeUsd: number;
}

export interface ViolationEpisode {
  ts: number;
  subP: number;
  supP: number;
  rawEdge: number;
  netEdge: number;
  shares: number;
  costUsd: number;
  profitUsd: number;
}

export interface BacktestTrade extends ViolationEpisode {
  team: string;
  relation: string;
}

export interface BacktestResult {
  params: BacktestParams;
  pairsTested: number;
  opportunities: number;
  totalProfitUsd: number;
  totalDeployedUsd: number;
  roiPct: number;
  trades: BacktestTrade[];
  equity: { ts: number; cum: number }[];
  byTeam: Record<string, number>;
  window: { from: number; to: number };
}

/**
 * PURE: detect champion ⊑ sup violation episodes between two aligned price
 * series, entering once at the start of each contiguous violation. Exported for
 * unit testing.
 */
export function alignViolations(
  subHist: PricePoint[],
  supHist: PricePoint[],
  params: BacktestParams,
): ViolationEpisode[] {
  if (subHist.length === 0 || supHist.length === 0) return [];
  // The two tokens publish on slightly different timestamp grids, so we join by
  // NEAREST observation within one fidelity bucket rather than exact timestamp.
  const sup = [...supHist].sort((a, b) => a.t - b.t);
  const sub = [...subHist].sort((a, b) => a.t - b.t);
  const tolSec = params.fidelityMin * 60;

  const episodes: ViolationEpisode[] = [];
  let inViolation = false;
  let j = 0;
  for (const pt of sub) {
    while (j + 1 < sup.length && sup[j + 1]!.t <= pt.t) j++;
    let cand = sup[j]!;
    const next = sup[j + 1];
    if (next && Math.abs(next.t - pt.t) < Math.abs(cand.t - pt.t)) cand = next;
    if (Math.abs(cand.t - pt.t) > tolSec) continue; // no nearby observation
    const supP = cand.p;
    const rawEdge = pt.p - supP;
    const violated = rawEdge > params.threshold;
    if (violated && !inViolation) {
      const netEdge = rawEdge - 2 * params.spreadHaircut;
      if (netEdge > 0) {
        const costPerPair = 1 - pt.p + supP; // buy NO(sub) @ (1−subP) + YES(sup) @ supP
        const shares = costPerPair > 0 ? params.sizeUsd / costPerPair : 0;
        episodes.push({
          ts: pt.t,
          subP: pt.p,
          supP,
          rawEdge,
          netEdge,
          shares,
          costUsd: shares * costPerPair,
          profitUsd: netEdge * shares,
        });
      }
    }
    inViolation = violated;
  }
  return episodes;
}

interface Pair {
  team: string;
  subKind: MarketKind;
  supKind: MarketKind;
  subToken: string;
  supToken: string;
}

function buildPairs(markets: Market[]): Pair[] {
  const byKey = new Map<string, Market>();
  for (const m of markets) {
    const c = classifyMarket(m);
    if (!c.team || (c.kind !== 'championship' && c.kind !== 'conference')) continue;
    const key = `${c.team}:${c.kind}`;
    if (!byKey.has(key)) byKey.set(key, m);
  }
  const pairs: Pair[] = [];
  for (const [key, market] of byKey) {
    if (!key.endsWith(':championship')) continue;
    const team = key.slice(0, key.length - ':championship'.length);
    const conf = byKey.get(`${team}:conference`);
    const subToken = yesToken(market)?.tokenId;
    const supToken = conf ? yesToken(conf)?.tokenId : undefined;
    if (subToken && supToken) {
      pairs.push({ team, subKind: 'championship', supKind: 'conference', subToken, supToken });
    }
  }
  return pairs;
}

export interface PairHistory {
  team: string;
  relation: string;
  subHist: PricePoint[];
  supHist: PricePoint[];
}

/** Fetch champion + conference price history for every team pair (once). */
export async function fetchPairHistories(
  client: PolymarketClient,
  fidelityMin: number,
): Promise<PairHistory[]> {
  // Pull raw markets (including now-closed ones) so eliminated teams' historical
  // conference tokens are still available to replay.
  const raw = (
    await Promise.all(SEED_EVENT_SLUGS.map((s) => client.fetchEventBySlug(s).catch(() => [])))
  ).flat();
  const pairs = buildPairs(raw);
  // Fetch all pairs' histories concurrently (keeps the backtest within
  // serverless time limits; the local CLI benefits too).
  return Promise.all(
    pairs.map(async (pair) => {
      const [subHist, supHist] = await Promise.all([
        client.fetchPriceHistory(pair.subToken, fidelityMin).catch(() => [] as PricePoint[]),
        client.fetchPriceHistory(pair.supToken, fidelityMin).catch(() => [] as PricePoint[]),
      ]);
      return { team: pair.team, relation: `${pair.subKind} ⊑ ${pair.supKind}`, subHist, supHist };
    }),
  );
}

/** PURE: aggregate pre-fetched histories into a result for a given param set. */
export function aggregate(histories: PairHistory[], params: BacktestParams): BacktestResult {
  const trades: BacktestTrade[] = [];
  const byTeam: Record<string, number> = {};
  for (const h of histories) {
    if (h.subHist.length === 0 || h.supHist.length === 0) continue;
    for (const ep of alignViolations(h.subHist, h.supHist, params)) {
      trades.push({ ...ep, team: h.team, relation: h.relation });
      byTeam[h.team] = (byTeam[h.team] ?? 0) + ep.profitUsd;
    }
  }
  trades.sort((a, b) => a.ts - b.ts);
  let cum = 0;
  const equity = trades.map((t) => {
    cum += t.profitUsd;
    return { ts: t.ts, cum };
  });
  const totalDeployedUsd = trades.reduce((s, t) => s + t.costUsd, 0);
  const tsValues = trades.map((t) => t.ts);
  return {
    params,
    pairsTested: histories.length,
    opportunities: trades.length,
    totalProfitUsd: cum,
    totalDeployedUsd,
    roiPct: totalDeployedUsd > 0 ? (cum / totalDeployedUsd) * 100 : 0,
    trades,
    equity,
    byTeam,
    window: {
      from: tsValues.length ? Math.min(...tsValues) : 0,
      to: tsValues.length ? Math.max(...tsValues) : 0,
    },
  };
}

export async function runBacktest(
  client: PolymarketClient,
  params: BacktestParams,
): Promise<BacktestResult> {
  return aggregate(await fetchPairHistories(client, params.fidelityMin), params);
}

export interface SensitivityRow {
  haircut: number;
  opportunities: number;
  deployedUsd: number;
  profitUsd: number;
  roiPct: number;
}

/** Sweep the per-leg cost assumption over one set of fetched histories. */
export async function runSensitivity(
  client: PolymarketClient,
  base: BacktestParams,
  haircuts: number[],
): Promise<{ rows: SensitivityRow[]; pairsTested: number }> {
  const histories = await fetchPairHistories(client, base.fidelityMin);
  const rows = haircuts.map((h) => {
    const r = aggregate(histories, { ...base, spreadHaircut: h });
    return {
      haircut: h,
      opportunities: r.opportunities,
      deployedUsd: r.totalDeployedUsd,
      profitUsd: r.totalProfitUsd,
      roiPct: r.roiPct,
    };
  });
  return { rows, pairsTested: histories.length };
}
