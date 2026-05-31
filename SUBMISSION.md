# Submission checklist — DEGA NBA Playoffs Prediction Market Hackathon

**Deadline: 2026-06-01 05:59 UTC.** Submit the BUIDL at https://dorahacks.io/hackathon/nba-prediction-market/buidl

## Required deliverables → where they are

| Requirement | Status | Location |
|---|---|---|
| **Project description** (strategy + automation behavior) | ✅ | paste-ready below + [README](README.md) |
| **Source code** (public GitHub) | ✅ | **https://github.com/ismailridwans/arbiter** (public) |
| **Live demo** (hosted, judges can click) | ✅ | **https://arbiter-peach.vercel.app** (landing + `/dashboard`) |
| **Documentation** (setup + `about` flow) | ✅ | [README](README.md) (setup) + [ABOUT.md](ABOUT.md) (flow) |
| **Demo video** (3 min) | ✅ | **https://youtu.be/dGCtlMwpMoo** |
| **Automation logs** (`.canon/execution/`) | ✅ | `.canon/execution/*.jsonl` (committed sample runs) |

## Paste-ready project description

> **Arbiter** is an AI-driven, **market-neutral** coherence-arbitrage engine for NBA prediction markets, built on Canon. Instead of forecasting who wins, it harvests the moments a market's *own prices contradict the logic that relates them*: `P(champion) ≤ P(conference) ≤ P(series)`, the 30 title odds summing to 1, and `ask(YES)+ask(NO) ≥ 1`. Because each market is a separate Polymarket order book, these logical certainties break — and each break is a risk-free, model-free profit regardless of the outcome.
>
> It runs Canon's `fetch → analyze → decide → execute` pipeline continuously: it pulls 600+ live markets via the Polymarket Gamma API, classifies each into a probability lattice (deterministically, or via an optional free-tier LLM that generalizes to any sport/event), fetches live CLOB order books, detects three layers of violations (within-market complementary, single-event Dutch book, cross-event implication), sizes each opportunity with liquidity-aware fractional Kelly under hard caps, and paper-trades against the live book — all visualized in a live "Automation System View" dashboard and logged to `.canon/execution/`. It also runs **cross-venue**: fetching the *same* championship market from both Polymarket and Kalshi and detecting fee-aware arbitrage when the two independent order books disagree. A historical backtest on real Polymarket price data validates the methodology and quantifies edge sensitivity to transaction costs. The engine is market-neutral by construction, fully typed (43 passing tests), and generalizes — via its one swappable league module, the AI classifier, or additional venues — into a coherence-arbitrage layer for any prediction market. **Live demo: https://arbiter-peach.vercel.app · Source: https://github.com/ismailridwans/arbiter**

## Submission links (paste into the BUIDL form)
- **Source code:** https://github.com/ismailridwans/arbiter  *(public — verified; `.env`/secrets excluded)*
- **Live demo:** https://arbiter-peach.vercel.app  *(landing + `/dashboard`, real-time data + Groq AI agents)*
- **Demo video:** https://youtu.be/dGCtlMwpMoo  *(3 min)*

## What's left — only you can do these
1. 📤 **File the BUIDL** at the hackathon page above (your DoraHacks account → submit form → paste the three links: source, live demo, video).
2. 🔐 **Rotate the secrets** that were shared in chat (Groq key, GitHub PAT, Vercel token); after rotating Groq, update `GROQ_API_KEY` in Vercel env + redeploy so the live AI keeps working.

*(Demo video ✅ recorded & uploaded: https://youtu.be/dGCtlMwpMoo)*

## Talk track per judging criterion
- **Innovation (25%)** — market-neutral *coherence* arbitrage; you never predict an outcome. The AI-built lattice generalizes to any event.
- **Technical (30%)** — typed TS on Canon's pipeline, 43 tests (core math 100%), zod-validated I/O, `.canon/execution/` logging, clean module boundaries, deployed live as serverless functions.
- **Cross-venue edge** — the engine watches the same market on Polymarket *and* Kalshi and arbs disagreements (fee-aware) — a differentiator few teams will have.
- **Real-world utility (30%)** — runs on 600+ live markets; market-neutral risk + liquidity-aware sizing + ¼-Kelly caps; backtest shows real (if modest) net-positive captures and a +48.5% detected overround in the long tail.
- **Presentation (15%)** — README + ABOUT + the live dashboard + the [DEMO.md](DEMO.md) script.

## Optional power-ups before recording
- Drop a free `LLM_PROVIDER` + key in `.env` so the demo shows live AI classification/explanations.
- Run Arbiter *through* Canon (it's public on GitHub — `DEGAorg/canon-tui` + `DEGAorg/claude-code-config`): install DEGA Core (`/apply-core`), then `/canon-init` in this repo and point the strategy entry at `src/strategy/coherence-strategy.ts`; `/canon-start` drives it (`--live` after a validated dry-run).
- Regenerate fresh logs right before recording: `npx tsx src/cli.ts start --max-cycles 5` and `npx tsx src/cli.ts backtest --sensitivity --save`.
