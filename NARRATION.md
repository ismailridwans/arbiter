# 🎥 Arbiter — Demo Video Narration (≈4:15)

Record-ready, dashboard-forward script. **[SCREEN]** = what to show. *Quoted* text = exactly what you read aloud (short sentences, TTS-friendly). Every number is real and verified against the live build.

Live site for recording: **https://arbiter-peach.vercel.app** (landing) and **/dashboard**.

---

### 0:00–0:25 · The hook
**[SCREEN]** Landing page — slow scroll over the hero.

> "Almost every prediction-market bot tries to guess who wins. That's hard, and everyone's already doing it. Arbiter does the opposite. It never predicts an outcome. It hunts the moments a market's own prices contradict each other — and collects the difference. Risk-free, no matter who wins the game."

---

### 0:25–1:05 · The insight
**[SCREEN]** Dashboard — the lattice / coherence diagram in view.

> "Here's the idea. A team can't be more likely to win the championship than to win its own conference — winning the title requires winning the conference first. All thirty title odds have to add up to one hundred percent. And 'yes' plus 'no' can never cost less than a dollar. These aren't predictions. They're logical certainties. But every market is a separate order book — so they drift out of line. And the instant they do, there's free money sitting on the table."

---

### 1:05–1:55 · The live engine
**[SCREEN]** Dashboard scanning — market count ticks to 618, lattice nodes populate, Coherence Score gauge fills, agent feed scrolls.

> "This is Arbiter running live against the real 2026 NBA markets. Six hundred and eighteen Polymarket markets, pulled in real time, sorted into a logical lattice. It checks three layers of consistency at once — championship versus conference, the sum of all odds, and yes-plus-no pricing. Right now the headline markets are coherent — which is exactly right, the most liquid markets are efficient. So Arbiter waits. It sits armed, watching every order book, ready to fire the instant the math breaks."

---

### 1:55–2:30 · It actually profits
**[SCREEN]** Click **Demo** / show the backtest equity curve + capture table.

> "But does the edge actually exist? Yes. Replayed across the full playoff season of real price history, the champion-implies-conference rule broke dozens of times. After charging a realistic half-percent cost on every leg, Arbiter still captured a handful of genuinely risk-free opportunities. Small — but real, and completely market-neutral. We don't fake a three-hundred-percent return. An honest market-neutral engine, with the receipts, is the credible result."

---

### 2:30–3:10 · Cross-venue — the real frontier
**[SCREEN]** Cross-venue panel — Polymarket vs Kalshi, Spurs row highlighted.

> "And this is where it gets powerful. Arbiter pulls the same 2026 NBA Champion market from two completely independent exchanges — Polymarket and Kalshi — and lines up the teams. The Spurs: sixty-four-point-three percent on one venue, sixty-three-point-five on the other. Two order books that can't both be right. Today that gap sits just inside Kalshi's fee, so Arbiter honestly says 'no arb clears — watching.' But the moment they diverge, it strikes. And cross-venue is exactly where the fat, persistent arbitrage actually lives."

---

### 3:10–3:40 · AI + automation
**[SCREEN]** Agent panel (Analyst → Architect → Developer → QA), `provider: groq` visible; then cut to terminal `npx tsx src/cli.ts start`.

> "Under the hood, a team of AI agents — analyst, strategist, developer, and QA — reason over every scan, running on a free-tier model. And the whole loop is wired through Canon's fetch, analyze, decide, execute pipeline, logging every decision to disk. Drop in any market and the same engine generalizes — soccer, the World Cup, elections. With no API key it still runs end to end. The AI augments. It never blocks."

---

### 3:40–4:15 · Close
**[SCREEN]** `npm test` green, then the project structure / GitHub repo.

> "Fully typed TypeScript, a passing test suite, every execution logged, market-neutral by construction, and deployed live on the web. Arbiter doesn't try to predict the game. It enforces the math the market forgot. Thanks for watching."

---

## Recording tips
- **Runtime** ≈4:15 at a calm pace — inside the 3–5 min limit. To hit 3:00, cut the AI+automation section to one sentence.
- **Use the live site** for 0:00–3:10 (more visual than the terminal); keep the terminal only for the `start` pipeline + `npm test`.
- **Pre-load** the dashboard and click Demo *before* narrating that section so charts are already painted.
- **Read what's on screen** for live numbers — they drift (it's live data), and saying so is a plus. Reference figures: ~618 markets · Spurs 64.3% / 63.5% · backtest at 0.5%/leg.
- For TTS: paste each quoted block separately.

## Where the scripts live
- **This file** (`NARRATION.md`) — polished, dashboard-forward, TTS-ready.
- **`DEMO.md`** — original terminal-focused script mapped tightly to the four judging criteria.
