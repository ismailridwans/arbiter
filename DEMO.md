# Demo video script (3–5 min)

A tight, judge-facing script mapped to the four judging criteria. Record in a wide terminal; use a free TTS (e.g. Fish Audio) for clean narration if desired.

---

### 0:00–0:30 — The hook (Innovation)
> "Most prediction-market bots try to predict who wins. That's hard and crowded. **Arbiter** never predicts an outcome. It exploits the moments a market's *own prices* contradict the logic that connects them — a market-neutral, model-free edge."

Show the title card / README hook line.

### 0:30–1:15 — The insight (Innovation)
> "A team can't be more likely to win the championship than to win its conference — champion *implies* conference. The 30 title odds must sum to 1. YES plus NO can't cost less than a dollar. These are logical certainties. But every market is a *separate order book*, so they break — and when they do, there's risk-free profit, no matter who wins."

Show the lattice diagram + the locked-profit payoff table from the README.

### 1:15–2:15 — Live engine (Technical + Automation)
Run `npm run scan`:
> "Here it is against the **live 2026 Finals** — 615 real Polymarket markets. It classifies every market into the lattice, pulls live order books, and scans three layers of coherence violations."

Then `npx tsx src/cli.ts start --max-cycles 4`:
> "This is the Automation System View — Canon's fetch-analyze-decide-execute pipeline, live. Right now it reports the Finals markets are **coherent** — which is correct; the most-liquid markets are efficient. The engine sits patiently, armed to fire the instant a dislocation appears."

Point at the dashboard stages, lattice, coherence status, and `.canon/execution/` logging.

### 2:15–3:15 — It actually profits (Real-World Utility + Risk)
Run `npx tsx src/cli.ts backtest --fidelity 1440 --haircut 0.005 --save`:
> "On the full playoff season of real price history, the champion-implies-conference relation broke dozens of times. After a realistic half-percent-per-leg cost, the engine captured a handful of **risk-free opportunities** — small, but **real and market-neutral**. We don't fake a 300% return; a market-neutral engine plus an honest efficiency study is the credible result. Risk is managed by net-edge gating, liquidity-aware sizing, and quarter-Kelly caps."

Show the backtest table + equity curve + `report`.

### 3:15–4:00 — Cross-venue, the real frontier (Innovation + Utility)
Run `npx tsx src/cli.ts crossvenue`:
> "Now the frontier. The engine pulls the *same* 2026 NBA Champion market from **two independent venues — Polymarket and Kalshi** — and matches all 30 teams. Spurs: 64.3% on Polymarket, 63.5% on Kalshi. Two order books that can't both be right. Today the gap is inside Kalshi's fee, so it honestly says 'no arb clears — watching.' But the instant they diverge, it fires — and *this* is where persistent, fat arbs actually live."

### 4:00–4:15 — AI + scale (Innovation)
Run `npx tsx src/cli.ts classify --limit 6`:
> "An optional free-tier LLM classifies *any* market into the lattice — so the same engine generalizes to soccer, the World Cup, or elections. It's identical with no API key: AI augments, never blocks."

### 4:15–4:45 — Close (Technical + Presentation)
> "Fully typed TypeScript on Canon's pipeline, 35 passing tests, logging to `.canon/execution/`, market-neutral by construction. Arbiter: it doesn't predict the game — it enforces the math the market forgot."

Show `npm test` green + the project structure.
