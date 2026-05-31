# Arbiter

**An AI-driven probabilistic-coherence arbitrage engine for prediction markets — built on Canon for the DEGA NBA Playoffs Prediction Market Hackathon.**

> **It doesn't predict who wins. It enforces the math the market forgot.**

🎥 **[Demo video (3 min)](https://youtu.be/dGCtlMwpMoo)** · 🚀 **[Live dashboard](https://arbiter-peach.vercel.app)**

Most prediction-market bots try to forecast outcomes better than the crowd — a hard, low-edge game. **Arbiter** does something different and provably market-neutral: it harvests the moments when a market's **own prices contradict the logic that relates them**.

A team's `P(win championship)` can never exceed its `P(win conference)`, which can never exceed its `P(win current series)`. The probabilities of all 30 teams winning the title must sum to 1. `ask(YES) + ask(NO)` for one market can't drop below 1 without handing you free money. These relationships are *logical certainties* — yet because each market is a **separate order book** with fragmented liquidity, they break constantly. When they do, there's a **risk-free, model-free, market-neutral** profit waiting, regardless of who actually wins.

---

## Why this is different from every other submission

| Most teams build | Arbiter builds |
|---|---|
| A model that predicts winners (needs alpha, high variance) | A model-free engine that needs **no view on outcomes** |
| Naive same-question arbitrage (rare, crowded) | A **lattice of logical relations** across the whole NBA market tree |
| A single hardcoded strategy | An AI-classified graph that **generalizes to any sport or event** |
| "Trust me, it's profitable" | A live engine + a **transparent backtest** + an honest efficiency study |

This is the kind of **market-neutral structural edge** a quant desk or investor actually respects — the opposite of gambling on a game.

---

## The core idea: the coherence lattice

Arbiter builds a graph of propositions — *"team T achieves event E"* — each carrying its market-implied probability, then checks the logical constraints that a coherent market must satisfy:

```
              P(T wins championship)
                       ⊑                 (implies)
              P(T wins conference)
                       ⊑
              P(T wins current series)

   Σ over all 30 teams  P(T champion)  = 1     (exhaustive partition)
   ask(YES_m) + ask(NO_m) ≥ 1  for every binary market m
```

It then scans **three layers** of violations, easiest-to-find first:

- **L0 — within-market (complementary):** `ask(YES) + ask(NO) < 1` → buy both sides, collect a guaranteed \$1. 2 legs, tiny cost.
- **L1 — Dutch book (single event):** the 30 champion markets are mutually exclusive and exhaustive, so `Σ ask(YES) < 1` lets you buy *every* outcome for under \$1 and bank the certain payout.
- **L2 — cross-event implication:** `P(champion) > P(conference)` for the *same* team across two *different* order books. This is the sophisticated, hard-to-copy edge.

### Why an implication violation is a locked, risk-free arbitrage

Suppose the market shows `P(T champion) = a` but `P(T wins conference) = b`, with **a > b** (incoherent, since champion ⊑ conference). Buy **NO** on the championship at `(1−a)` and **YES** on the conference at `b`:

| Outcome | NO(champion) pays | YES(conference) pays | Total |
|---|---|---|---|
| T wins title (⇒ wins conf) | 0 | 1 | **\$1** |
| T loses, but wins conference | 1 | 1 | **\$2** |
| T loses conference | 1 | 0 | **\$1** |
| T wins title but *not* conference | — | — | **impossible** (the implication) |

Cost today = `(1−a) + b`. The minimum payout in every possible world is **\$1**, so the guaranteed profit is `1 − (1−a) − b = a − b > 0`, with upside in the middle branch. The impossible row is exactly what the implication rules out — that's where the free money comes from. **No forecast required.**

The engine only acts on the **net** edge after walking the live order book and subtracting the spread/fees you'd actually cross (`netEdge`), never the mid-price illusion (`rawEdge`).

---

## The four required core technologies

| Pillar | How Arbiter uses it |
|---|---|
| **Canon CLI** | The project mirrors Canon's `init → start` workflow and `fetch → analyze → decide → execute` pipeline; every run streams to `.canon/execution/`. See [Running with Canon](#running-with-canon). |
| **TypeScript** | End-to-end typed domain model ([`src/types.ts`](src/types.ts)) — `Market`, `OrderBook`, `ArbiterEdge`, `SizedOrder`, and a `Strategy` interface whose four methods *are* the Canon pipeline stages. Strict mode, `noUncheckedIndexedAccess`. |
| **AI capabilities** | A provider-agnostic, **free-tier** LLM layer ([`src/ai/`](src/ai)) classifies arbitrary markets into the lattice (so the engine generalizes beyond NBA) and writes plain-language edge rationales. Fully **degradable** — the engine is identical with no API key. |
| **Automation Systems** | A continuous monitoring loop with a live terminal **Automation System View** ([`src/dashboard/`](src/dashboard)) rendering each pipeline stage, the lattice, detected edges, and running P&L. |

---

## What the engine found against live data (honest results)

Run on the live **2026 NBA Finals (Spurs vs Knicks)** market tree — **615 active markets, 30-team championship field, both conference events**:

**1. Headline markets are efficient.** Spurs `P(champion) = 64.3%` ≤ `P(West) = 100%` ✓ — coherent. Clean arbs at the Finals stage are rare, exactly as theory predicts for the most-liquid markets (14 of the top-20 Polymarket wallets are bots competing these away).

**2. The long tail is *not* — the engine flags it.** Arbiter's overround metric reports the 30-team championship field summing to **Σ = 1.485 (a +48.5% overround)**: eliminated teams still carry stale probability mass (an out team quoted at ~8% when its true probability is 0). Real, large structural incoherence — though harvesting it cleanly is liquidity-constrained on dead-team books (the honest catch).

**3. Backtest + cost sensitivity** (real Polymarket price history): the `champion ⊑ conference` relation was violated **88 times** over the season. As the assumed per-leg cost rises, only the fattest, genuinely-tradeable edges survive — and those are net positive and market-neutral:

| Cost / leg | Opportunities | Deployed | Locked profit | ROI |
|---|---|---|---|---|
| 0.0% | 88 | $4,400 | $24.38 | 0.55% |
| 0.3% | 8 | $400 | $15.68 | 3.92% |
| 0.5% | 5 | $250 | $14.27 | 5.71% |
| 0.8% | 2 | $100 | $13.57 | 13.57% |

*Snapshot as of 2026-05-31 — these are **recomputed live** from Polymarket's `/prices-history` on every run, so the exact counts drift upward as the season's history grows. Note profit falls monotonically with cost ($24→$13) while ROI rises, because higher assumed cost filters out the marginal edges and leaves only the fattest. Run it yourself: `npx tsx src/cli.ts backtest --sensitivity` (CLI defaults now match this dashboard view: daily resolution, 0.5%/leg).*

**4. Cross-venue (the real frontier).** The engine fetches the *same* 2026 NBA Champion market from **both Polymarket and Kalshi** and matches all 30 teams. Live right now: Spurs `PM 64.3% vs Kalshi 63.5%`, Knicks `PM 35.4% vs Kalshi 36.5%` — independent order books, small disagreements that Kalshi's fee currently eats (the engine reports "no arb clears right now — watching"). But this is *where fat arbs persist*: two venues that can't both be right, with fee-aware detection armed to fire the instant they diverge. (`npx tsx src/cli.ts crossvenue`)

**We deliberately do not claim a fantasy return.** A clear-eyed efficiency study + a market-neutral risk profile is more credible than an overfit "300%" number — and the same engine pointed at a less-efficient surface (earlier rounds, thinner markets, or a second venue) is where the fat edges live. See [Scaling beyond the hackathon](#scaling-beyond-the-hackathon).

---

## Risk management

Arbiter is **market-neutral by construction** — it never holds directional exposure to a game result. On top of that:

- **Net-edge gating:** trade only when `netEdge ≥ MIN_EDGE` *after* walking the live book (spread + fees), never on mid prices.
- **Liquidity-aware sizing:** [`maxSharesPreservingEdge`](src/risk/sizing.ts) finds the largest size that keeps the *combined* fill price under budget across all legs — it stops before slippage eats the edge.
- **Fractional Kelly + hard caps:** `KELLY_FRACTION` (default quarter-Kelly), `MAX_STAKE_PER_LEG`, and a bankroll cap bound every position.
- **Graceful degradation:** a rate-limited or absent LLM never blocks trading; a failed order book is skipped, not fatal; one bad cycle never crashes the loop.

---

## Quickstart

```bash
npm install
cp .env.example .env        # optional: add a free LLM key (Groq / Gemini / OpenRouter / Ollama)

# 0. Web app (live) — landing at http://localhost:7777/ , dashboard at /dashboard
npm run serve

# 1. Scan the live NBA market tree for coherence violations (read-only)
npm run scan

# 2. Run the live automation loop with the dashboard (paper trading vs live book)
npm run start                       # Ctrl+C to stop
#   or a bounded run:  npx tsx src/cli.ts start --max-cycles 5

# 3. Backtest the strategy on real historical prices
npx tsx src/cli.ts backtest --fidelity 1440 --haircut 0.005 --save

# 4. Demonstrate AI lattice classification (falls back to rules with no key)
npx tsx src/cli.ts classify --limit 8

# 5. Compare the SAME market across Polymarket vs Kalshi (cross-venue arbitrage)
npx tsx src/cli.ts crossvenue

# 6. Summarize a recorded session
npx tsx src/cli.ts report
```

No wallet, API key, or KYC is needed: Polymarket's Gamma + CLOB read endpoints are public, and execution runs in **paper mode** against the live book by default. Run `arbiter start --live` (or set `EXECUTION_MODE=live`) to switch to the **live broker**, which builds and logs the exact CLOB order each leg would place in **dry-run** (no capital, no credentials); real submission is gated behind a funded wallet + `@polymarket/clob-client`.

### Free LLM setup (optional)

The engine runs fully without an LLM. To enable AI classification + explanations, set one in `.env`:

```bash
LLM_PROVIDER=groq            # or gemini | openrouter | ollama
GROQ_API_KEY=...             # free at console.groq.com/keys
```

---

## Running with Canon

Canon is **public on GitHub** (no Discord or registration required) — two open-source components:
- **Canon TUI** — the `canon` terminal binary: [`DEGAorg/canon-tui`](https://github.com/DEGAorg/canon-tui)
- **DEGA Core** — the agent harness providing the `/canon-init` & `/canon-start` slash commands, strategy templates, and AI agents: [`DEGAorg/claude-code-config`](https://github.com/DEGAorg/claude-code-config)

```bash
# Canon TUI (Linux/macOS/WSL)
uv tool install "canon-tui @ git+https://github.com/DEGAorg/canon-tui.git@main" --force
# DEGA Core — provides /canon-init, /canon-start, agents, templates
git clone https://github.com/DEGAorg/claude-code-config.git && cd claude-code-config && claude   # then: /apply-core
```
Then inside a strategy project: `/canon-init` (scaffold + burner wallet + `.canon/`) → `/canon-start` (drive the pipeline; `--live` only after a validated dry-run).

**Arbiter maps 1:1 onto Canon's real contract:**

| Canon (DEGA Core) | Arbiter |
|---|---|
| pipeline `init → scaffold → strategy → develop → run → live` | `fetch → analyze → decide → execute` loop (`arbiter start`) |
| agents `market-analyst · strategy-architect · dev · qa` | the same four agents — [`src/ai/agents.ts`](src/ai/agents.ts) (`arbiter agents`) |
| `develop` gate: `tsc --noEmit` + lint + `vitest run` | typecheck clean + **42 vitest tests** |
| dry-run default; `/canon-start --live` (gated, funded wallet) | `arbiter start` (paper) · `arbiter start --live` (gated dry-run; real submit needs wallet) |
| state/logs under `.canon/` | [`ExecutionLogger`](src/execution/logger.ts) → `.canon/execution/` |
| canon-cli `wallet`/`order`/`onboard` (on-chain exec) | Arbiter emits the order intents; Canon's `canon-cli order` executes them (see [`live-broker.ts`](src/execution/live-broker.ts)) |

To run Arbiter *through* Canon: `/canon-init` in this repo, then point the scaffold's strategy entry at [`src/strategy/coherence-strategy.ts`](src/strategy/coherence-strategy.ts). See [ABOUT.md](ABOUT.md) for the flow.

---

## Testing

```bash
npm test            # 39 tests across the pure logic
npm run test:cov    # with coverage
```

The arbitrage math, sizing solver, classifier, detector, backtest alignment, and Gamma JSON parsing are pure functions with focused unit tests (`sizing.ts` and `pricing.ts` at 100% line coverage). I/O layers are validated by the live runs above.

---

## Scaling beyond the hackathon

The engine has exactly **one** NBA-specific module ([`src/nba/league.ts`](src/nba/league.ts)). Everything else operates on the abstract lattice. Swap that module — or let the **AI classifier** build the lattice automatically from market text — and Arbiter becomes a general **coherence-arbitrage desk** for:

- **Other sports** (soccer/World Cup, NFL playoffs): identical champion ⊑ conference/group ⊑ match structure.
- **Politics** (`P(win presidency) ⊑ P(win nomination) ⊑ P(win primary)`).
- **Cross-venue — *already built*:** the engine matches the same 2026 NBA Champion market on **Polymarket and Kalshi** (`crossvenue` command) with fee-aware arb detection. Adding more venues/sportsbooks lets the same detector capture the fat, persistent arbs that live across independent books.

That generality is the product thesis: **a market-neutral coherence layer that sits across every prediction market and never has to be right about an outcome.**

---

## Project structure

```
src/
  types.ts                     core domain model + the Strategy (Canon pipeline) contract
  config.ts                    typed env/config (zod)
  polymarket/
    client.ts                  live Gamma + CLOB read client
    schema.ts                  zod schemas + Gamma JSON-string normalizer
    history.ts                 historical price API
  kalshi/
    client.ts                  read-only Kalshi market-data client (cross-venue)
  crossvenue/
    detector.ts                cross-venue arbitrage detection (pure)
    run.ts                     Polymarket ↔ Kalshi orchestration
  coherence/
    graph.ts                   classifier + lattice + implications + partitions
    detector.ts                L0/L1/L2 violation detection → tradeable edges
    pricing.ts                 order-book-aware pricing primitives (pure)
  risk/
    sizing.ts                  fractional Kelly + liquidity-aware edge-preserving sizing (pure)
  ai/
    llm.ts                     provider-agnostic free-tier LLM client
    classifier.ts              AI lattice classification (rule fallback)
    explain.ts                 plain-language edge rationales
  execution/
    paper-broker.ts            fills against the live book; tracks positions/P&L
    logger.ts                  .canon/execution/ JSONL logging
  strategy/coherence-strategy.ts   the Strategy implementation
  pipeline.ts                  one fetch→analyze→decide→execute cycle
  dashboard/dashboard.ts       the Automation System View
  report.ts                    scan + backtest rendering
  cli.ts                       scan · start · backtest · classify · crossvenue · report
test/                          39 unit tests
```

---

## License

MIT — see [LICENSE](LICENSE).
