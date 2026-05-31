# Runbook — enabling the credentialed features

Three optional unlocks. Arbiter runs fully without any of them (paper mode, rule-based agents).

## 1. Enable the AI agents with Groq (free)

1. Get a free key: https://console.groq.com/keys → **Create API Key** → copy the `gsk_...` value.
2. Paste it into `.env` (already pre-wired for Groq):
   ```
   LLM_PROVIDER=groq
   GROQ_API_KEY=gsk_your_key_here
   LLM_MODEL=llama-3.3-70b-versatile
   ```
3. Restart any running server (`Ctrl+C` then `npm run serve`) so it picks up the key.
4. Verify — the agents go from `[rule]` to `[llm]`:
   ```
   npx tsx src/cli.ts agents      # outputs now show "groq" + [llm]
   npx tsx src/cli.ts scan        # edges get LLM-written explanations
   ```
   No key? Everything still works — it just uses the deterministic fallback.

## 2. Real on-chain broadcast (real money — read every line)

> ⚠️ Real funds. Polymarket is geo-restricted (US blocked; others vary) and may require KYC. Use a **fresh burner wallet**, never your main key. Start with a tiny bankroll.

1. Install Canon / DEGA Core (see §3) — this provides `canon-cli` at `~/.degacore/bin/canon-cli`.
2. Create + fund a burner wallet:
   ```
   ~/.degacore/bin/canon-cli wallet ensure --pretty   # prints a fresh burner address
   ```
   Send a small amount of **USDC on Polygon** (e.g. $5–10) to that address.
3. Point Arbiter at Canon + the wallet:
   ```
   export CANON_CLI=~/.degacore/bin/canon-cli
   export WALLET_PRIVATE_KEY=0x...        # the burner
   ```
4. **Dry-run first** (logs the exact `canon-cli order create ...` it would run; commits nothing):
   ```
   npx tsx src/cli.ts start --live
   ```
5. Go live (signs + broadcasts via Canon, only when an edge clears):
   ```
   npx tsx src/cli.ts start --live --confirm-real
   ```
   Since the markets are efficient right now (0 edges), nothing will actually fire until a real dislocation appears — so you can safely confirm the plumbing.

## 3. Run through Canon (`/canon-init` → `/canon-start`) on Linux/macOS/WSL

Canon TUI isn't native-Windows — on Windows use WSL.

```bash
# Windows only: install WSL (PowerShell as admin), then reboot and open Ubuntu
wsl --install

# In Linux/macOS/WSL — prereqs
curl -LsSf https://astral.sh/uv/install.sh | sh
sudo apt-get install -y jq tmux        # (or brew install jq tmux on macOS)
npm i -g pnpm

# Canon TUI (the `canon` binary)
uv tool install "canon-tui @ git+https://github.com/DEGAorg/canon-tui.git@main" --force

# DEGA Core (provides /canon-init, /canon-start, agents, templates)
git clone https://github.com/DEGAorg/claude-code-config.git
cd claude-code-config
claude            # (or gemini / codex) — then inside the session:
#   /apply-core   # installs DEGA Core to ~/.degacore
```

Then, in your Arbiter project (copied/cloned into WSL), open an agent session and run:
```
/canon-init                 # scaffolds .canon/, burner wallet, launcher
/canon-start                # drives the pipeline (dry-run)
/canon-start --live         # live (after a validated dry-run)
```
When `/canon-init` asks for a strategy, point it at `src/strategy/coherence-strategy.ts`, or paste a one-page spec describing the coherence-arbitrage approach (see [ABOUT.md](ABOUT.md)).

> Tip (no Python/TUI): DEGA Core's `/canon-init` writes a `canon.sh` that **falls back to tmux** when the `canon` binary isn't present — so DEGA Core + `tmux` + `jq` + `node` + `pnpm` is enough to run the whole pipeline.
