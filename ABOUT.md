# About — the Arbiter automation flow

Arbiter is an automated, market-neutral arbitrage system for prediction markets. It runs a continuous `fetch → analyze → decide → execute` loop (Canon's pipeline) and never takes a directional view on any game — it only profits when the market's own prices are logically inconsistent.

## Automation flow (one cycle)

```
   ┌──────────┐   ┌───────────┐   ┌──────────┐   ┌───────────┐
   │ ① FETCH  │ → │ ② ANALYZE │ → │ ③ DECIDE │ → │ ④ EXECUTE │ → logs → repeat
   └──────────┘   └───────────┘   └──────────┘   └───────────┘
   live markets   lattice+edges    sized orders   paper fills
```

### ① FETCH — `PolymarketClient.fetchNbaUniverse`
Pulls the live NBA market universe from Polymarket's public **Gamma API**: the 30-team `2026-nba-champion` event plus both conference-champion events (seeded slugs), augmented by tag-based discovery (`NBA`=745, `2026 NBA Playoffs`=104587). Gamma's JSON-encoded list fields (`outcomes`, `outcomePrices`, `clobTokenIds`) are normalized into a typed `Market[]`. Closed / untradeable markets are filtered out.

### ② ANALYZE — `buildGraph` + `detectEdges`
1. **Classify** each market into the coherence lattice — *championship / conference / series* for a given team — using a deterministic NBA classifier (or the AI classifier for arbitrary markets).
2. **Build the lattice:** nodes carry market-implied probabilities; edges encode the logical relations `champion ⊑ conference ⊑ series` and the exhaustive partitions (`Σ P(champion) = 1`, one champion per conference).
3. **Fetch live order books** (CLOB API) for the priced nodes' YES/NO tokens.
4. **Detect violations** across three layers and compute, for each, the gross `rawEdge` (mid-price) and the `netEdge` that survives crossing the live spread:
   - **L0 complementary** — `ask(YES)+ask(NO) < 1` in one market.
   - **L1 Dutch book** — `Σ ask(YES) < 1` across an exhaustive set.
   - **L2 implication** — `P(champion) > P(conference)` for a team across two books.

### ③ DECIDE — `ArbiterStrategy.decide`
For every edge with `netEdge ≥ MIN_EDGE`, compute the largest size that keeps the *combined* fill price under budget across all legs (`maxSharesPreservingEdge`), bounded by fractional Kelly, a per-leg stake cap, and the bankroll. Produces concrete `SizedOrder`s with book-walked limit prices. Coherent or sub-cost edges produce **no orders** — the engine sits patiently.

### ④ EXECUTE — `PaperBroker`
Each leg is filled by walking the **live order book** (so simulated fills reflect real liquidity + slippage) with no on-chain capital committed. Positions, costs, and fees are tracked. A `--live` on-chain CLOB path is stubbed behind config for the real-capital extension.

### Logging & monitoring
Every stage, edge, order, and fill is appended as JSONL to **`.canon/execution/`**. The live **Automation System View** dashboard redraws each cycle: pipeline status, the coherence lattice, detected edges, and running P&L. `report` summarizes any recorded session.

## Backtest flow — `runBacktest`
Replays real Polymarket **price history** (`/prices-history`) for each team's champion and conference tokens, aligns the two series by nearest timestamp, and books the locked minimum profit at the start of each contiguous `champion ⊑ conference` violation — net of a configurable per-leg spread haircut. Outputs opportunities, capital deployed, locked profit, ROI, an equity curve, and per-team attribution.

## Cross-venue flow — `runCrossVenue`
Fetches the *same* 2026 NBA Champion market from **Polymarket** (`2026-nba-champion`) and **Kalshi** (`KXNBA-26-*`), maps both to canonical teams (Kalshi via ticker abbreviation, so LAL/LAC never collide), and pulls live Polymarket order books for contender teams. For each matched team it evaluates both arbitrage directions — buy YES on the cheaper venue + NO on the dearer — and computes the net edge after the **Kalshi taker fee** (`0.07·p·(1−p)`). Because the two venues are independent order books settling on the same real-world event, any disagreement beyond fees is a locked, market-neutral cross-venue arbitrage. The engine reports the live comparison every run and flags any direction whose net edge clears the threshold.
