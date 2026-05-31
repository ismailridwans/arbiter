import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import { loadConfig, type Config } from './config';
import { PolymarketClient } from './polymarket/client';
import { SEED_EVENT_SLUGS, NBA_TAG_IDS } from './nba/league';
import { buildGraph } from './coherence/graph';
import { detectEdges, tokensToPrice, partitionStats } from './coherence/detector';
import { renderScan, renderBacktest, renderSensitivity, renderCrossVenue, renderAgents } from './report';
import { runBacktest, runSensitivity } from './backtest/backtest';
import { KalshiClient } from './kalshi/client';
import { runCrossVenue } from './crossvenue/run';
import { runAgentWorkflow } from './ai/agents';
import { buildDemoScenario } from './demo';
import { startServer } from './web/server';
import { createLlm } from './ai/llm';
import { enrichEdges } from './ai/explain';
import { aiClassifyMarket } from './ai/classifier';
import { CoherenceStrategy } from './strategy/coherence-strategy';
import { PaperBroker } from './execution/paper-broker';
import { LiveBroker } from './execution/live-broker';
import { ExecutionLogger, listSessions, readSession } from './execution/logger';
import { runCycle } from './pipeline';
import { renderDashboard, type DashboardState } from './dashboard/dashboard';
import type { RiskContext } from './types';

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
const toInt = (v: string): number => parseInt(v, 10);

function riskFrom(cfg: Config): RiskContext {
  return {
    bankrollUsd: cfg.risk.bankrollUsd,
    deployedUsd: 0,
    minEdge: cfg.risk.minEdge,
    kellyFraction: cfg.risk.kellyFraction,
    maxStakePerLegUsd: cfg.risk.maxStakePerLegUsd,
    takerFeeBps: cfg.risk.takerFeeBps,
  };
}

const program = new Command();
program
  .name('arbiter')
  .description('Arbiter — a market-neutral coherence-arbitrage engine for prediction markets')
  .version('0.1.0');

program
  .command('scan')
  .description('Scan live NBA markets for coherence violations (read-only, no trading)')
  .option('--min-edge <n>', 'override minimum net edge to flag as tradeable', parseFloat)
  .option('--min-prob <n>', 'minimum implied probability to fetch a book for', parseFloat, 0.01)
  .action(async (opts: { minEdge?: number; minProb: number }) => {
    const cfg = loadConfig();
    const risk = riskFrom(cfg);
    if (opts.minEdge !== undefined) risk.minEdge = opts.minEdge;
    const client = new PolymarketClient(cfg.polymarket.gammaUrl, cfg.polymarket.clobUrl);
    const llm = createLlm(cfg.llm);

    console.log(chalk.cyan('① FETCH  ') + 'pulling live NBA market universe…');
    const markets = await client.fetchNbaUniverse({
      seedEventSlugs: SEED_EVENT_SLUGS,
      tagIds: NBA_TAG_IDS,
      maxEvents: 40,
    });
    console.log(`         ${markets.length} active markets`);

    console.log(chalk.cyan('② GRAPH  ') + 'classifying markets into the coherence lattice…');
    const graph = buildGraph(markets);
    console.log(
      `         ${graph.nodes.size} nodes · ${graph.implications.length} implications · ${graph.partitions.length} partitions`,
    );

    console.log(chalk.cyan('③ BOOKS  ') + 'fetching live order books for priced nodes…');
    const tokenIds = tokensToPrice(graph, opts.minProb);
    const books = await client.fetchOrderBooks(tokenIds);
    console.log(`         ${books.size}/${tokenIds.length} order books fetched`);

    console.log(chalk.cyan('④ DETECT ') + 'scanning for coherence violations…');
    const edges = detectEdges(graph, books, risk);
    console.log(`         ${edges.length} candidate edges`);

    if (llm.enabled) {
      console.log(chalk.cyan('⑤ AI    ') + `explaining edges via ${llm.label}…`);
      await enrichEdges(llm, edges.filter((e) => e.netEdge >= risk.minEdge));
    } else {
      console.log(chalk.gray('   AI    disabled — deterministic classifier (set LLM_PROVIDER in .env)'));
    }

    renderScan({ markets, graph, books, edges, risk });
  });

program
  .command('start')
  .description('Run the live automation loop with the Automation System View dashboard')
  .option('--min-edge <n>', 'override minimum net edge to trade', parseFloat)
  .option('--min-prob <n>', 'minimum implied probability to fetch a book for', parseFloat, 0.01)
  .option('--interval <ms>', 'poll interval in ms', toInt)
  .option('--max-cycles <n>', 'stop after N cycles (default: run until Ctrl+C)', toInt)
  .option('--live', 'use the live broker (dry-run order construction; no real capital unless configured)', false)
  .option('--confirm-real', 'with --live: actually broadcast via canon-cli (needs CANON_CLI + WALLET_PRIVATE_KEY)', false)
  .action(
    async (opts: {
      minEdge?: number;
      minProb: number;
      interval?: number;
      maxCycles?: number;
      live: boolean;
      confirmReal: boolean;
    }) => {
    const cfg = loadConfig();
    const risk = riskFrom(cfg);
    if (opts.minEdge !== undefined) risk.minEdge = opts.minEdge;
    const interval = opts.interval ?? cfg.pollIntervalMs;
    const maxCycles = opts.maxCycles ?? Number.POSITIVE_INFINITY;

    const client = new PolymarketClient(cfg.polymarket.gammaUrl, cfg.polymarket.clobUrl);
    const strategy = new CoherenceStrategy(client, risk, { minProb: opts.minProb, maxEvents: 40 });
    const live = opts.live || cfg.executionMode === 'live';
    const broker = live
      ? new LiveBroker(client, !opts.confirmReal)
      : new PaperBroker(client, cfg.risk.takerFeeBps);
    const logger = new ExecutionLogger();
    await logger.init();
    await logger.log('session', {
      strategy: strategy.name,
      mode: live ? 'live' : 'paper',
      minEdge: risk.minEdge,
      bankrollUsd: risk.bankrollUsd,
    });

    const state: DashboardState = {
      startedAt: Date.now(),
      mode: live ? 'live' : 'paper',
      minEdge: risk.minEdge,
      bankrollUsd: risk.bankrollUsd,
      cycles: 0,
      totalCapturedUsd: 0,
      totalFills: 0,
      openPositions: 0,
      investedUsd: 0,
      feesUsd: 0,
      recentEvents: [],
    };

    let stop = false;
    process.on('SIGINT', () => {
      stop = true;
    });

    for (let c = 1; !stop && c <= maxCycles; c++) {
      risk.deployedUsd = broker.getInvestedUsd();
      const result = await runCycle(strategy, broker, risk, logger, c);
      state.cycles = c;
      state.last = result;
      state.totalCapturedUsd += result.capturedUsd;
      state.totalFills += result.fills.length;
      state.openPositions = broker.getPositions().length;
      state.investedUsd = broker.getInvestedUsd();
      state.feesUsd = broker.getFeesUsd();
      state.recentEvents.push(
        result.error
          ? `cycle ${c}: error — ${result.error}`
          : `cycle ${c}: ${result.tradeable.length} tradeable · ${result.fills.length} fills · +${result.capturedUsd.toFixed(2)} locked`,
      );
      renderDashboard(state);
      if (!stop && c < maxCycles) await sleep(interval);
    }

    await logger.log('info', { event: 'stopped', cycles: state.cycles });
    console.log('\nstopped. session log: ' + logger.path);
  });

program
  .command('backtest')
  .description('Replay historical Polymarket prices and report coherence-arbitrage P&L')
  .option('--fidelity <min>', 'history resolution in minutes (60=hourly, 1440=daily)', toInt, 1440)
  .option('--threshold <n>', 'minimum raw violation to act on', parseFloat, 0)
  .option('--haircut <n>', 'per-leg spread/slippage haircut in price units', parseFloat, 0.005)
  .option('--size <usd>', 'notional per captured edge', parseFloat, 50)
  .option('--sensitivity', 'also sweep the per-leg cost assumption', false)
  .option('--save', 'write the run to .canon/execution/', false)
  .action(
    async (opts: {
      fidelity: number;
      threshold: number;
      haircut: number;
      size: number;
      sensitivity: boolean;
      save: boolean;
    }) => {
      const cfg = loadConfig();
      const client = new PolymarketClient(cfg.polymarket.gammaUrl, cfg.polymarket.clobUrl);
      const params = {
        fidelityMin: opts.fidelity,
        threshold: opts.threshold,
        spreadHaircut: opts.haircut,
        sizeUsd: opts.size,
      };
      console.log(chalk.cyan('replaying historical NBA prices…'));
      const result = await runBacktest(client, params);
      renderBacktest(result);

      if (opts.sensitivity) {
        const sweep = await runSensitivity(client, params, [0, 0.0025, 0.005, 0.0075, 0.01]);
        renderSensitivity(sweep.rows, sweep.pairsTested);
      }
      if (opts.save) {
        const logger = new ExecutionLogger(`backtest-${Date.now()}`);
        await logger.init();
        await logger.log('info', {
          event: 'backtest',
          params: result.params,
          opportunities: result.opportunities,
          totalProfitUsd: result.totalProfitUsd,
          roiPct: result.roiPct,
          window: result.window,
        });
        for (const t of result.trades) await logger.log('fill', { ...t, simulated: true, backtest: true });
        console.log('saved: ' + logger.path);
      }
    },
  );

program
  .command('classify')
  .description('Demonstrate AI lattice classification on live markets (rule vs LLM)')
  .option('--limit <n>', 'number of markets to classify', toInt, 8)
  .action(async (opts: { limit: number }) => {
    const cfg = loadConfig();
    const llm = createLlm(cfg.llm);
    const client = new PolymarketClient(cfg.polymarket.gammaUrl, cfg.polymarket.clobUrl);
    const markets = await client.fetchNbaUniverse({
      seedEventSlugs: SEED_EVENT_SLUGS,
      tagIds: NBA_TAG_IDS,
      maxEvents: 40,
    });
    console.log(
      `AI provider: ${llm.enabled ? chalk.green(llm.label) : chalk.gray('disabled — rule fallback')}\n`,
    );
    for (const m of markets.slice(0, opts.limit)) {
      const c = await aiClassifyMarket(llm, m);
      console.log(
        `${chalk.white(m.question)}\n  → kind=${chalk.cyan(c.kind)} team=${c.team ?? '—'} conf=${c.conference ?? '—'} ${chalk.gray(`(${c.source}, confidence ${c.confidence.toFixed(2)})`)}`,
      );
    }
  });

program
  .command('serve')
  .description('Serve the Coherence dashboard in your browser at http://localhost:<port>')
  .option('--port <n>', 'port to listen on', toInt, 7777)
  .action(async (opts: { port: number }) => {
    await startServer(opts.port);
    // The HTTP server keeps the process alive; Ctrl+C to stop.
  });

program
  .command('crossvenue')
  .description('Compare Polymarket vs Kalshi on the same NBA Champion market and detect cross-venue arbs')
  .option('--min-prob <n>', 'min implied prob to fetch a Polymarket book', parseFloat, 0.02)
  .option('--min-edge <n>', 'min net edge to flag as tradeable', parseFloat, 0.01)
  .action(async (opts: { minProb: number; minEdge: number }) => {
    const cfg = loadConfig();
    const pm = new PolymarketClient(cfg.polymarket.gammaUrl, cfg.polymarket.clobUrl);
    const kalshi = new KalshiClient();
    console.log(chalk.cyan('fetching the 2026 NBA Champion market from Polymarket + Kalshi…'));
    const res = await runCrossVenue(pm, kalshi, { minProb: opts.minProb });
    renderCrossVenue(res, opts.minEdge);
  });

program
  .command('report')
  .description('Summarize a recorded session from .canon/execution/')
  .option('--file <name>', 'session file to report on (default: most recent)')
  .action(async (opts: { file?: string }) => {
    const files = await listSessions();
    if (files.length === 0) {
      console.log(chalk.gray('no sessions found in .canon/execution/ — run `start` or `backtest --save` first'));
      return;
    }
    const file = opts.file ?? files[files.length - 1]!;
    const records = await readSession(file);
    const num = (v: unknown): number => Number(v) || 0;

    console.log('\n' + chalk.bold(`Session report — ${file}`));
    const cycles = records.filter((r) => r.kind === 'cycle');
    const fills = records.filter((r) => r.kind === 'fill');
    const edges = records.filter((r) => r.kind === 'edge');
    const errors = records.filter((r) => r.kind === 'error');
    const backtest = records.find((r) => r.kind === 'info' && r['event'] === 'backtest');

    const t = new Table();
    if (backtest) {
      t.push(
        [chalk.gray('mode'), 'backtest'],
        [chalk.gray('opportunities'), String(num(backtest['opportunities']))],
        [chalk.gray('locked profit'), chalk.green('$' + num(backtest['totalProfitUsd']).toFixed(2))],
        [chalk.gray('ROI on deployed'), chalk.green(num(backtest['roiPct']).toFixed(2) + '%')],
      );
    } else {
      const captured = cycles.reduce((s, r) => s + num(r['capturedUsd']), 0);
      t.push(
        [chalk.gray('mode'), 'live / paper'],
        [chalk.gray('cycles'), String(cycles.length)],
        [chalk.gray('edges logged'), String(edges.length)],
        [chalk.gray('fills'), String(fills.length)],
        [chalk.gray('captured (locked)'), chalk.green('$' + captured.toFixed(2))],
        [chalk.gray('errors'), String(errors.length)],
      );
    }
    console.log(t.toString());

    if (fills.length > 0) {
      const ft = new Table({
        head: ['Market', 'Outcome', 'Size', 'Avg', 'Cost'].map((h) => chalk.gray(h)),
        colWidths: [44, 10, 9, 8, 9],
        wordWrap: true,
      });
      for (const f of fills.slice(-10)) {
        ft.push([
          String(f['market'] ?? ''),
          String(f['outcome'] ?? ''),
          num(f['size'] ?? f['shares']).toFixed(1),
          num(f['avgPrice'] ?? f['subP']).toFixed(3),
          '$' + num(f['costUsd']).toFixed(2),
        ]);
      }
      console.log(chalk.bold('  Fills (last 10)'));
      console.log(ft.toString());
    }
    console.log('');
  });

program
  .command('demo')
  .description('Self-contained DEMO: capture a coherence edge end-to-end (synthetic real-magnitude dislocation)')
  .action(async () => {
    const cfg = loadConfig();
    const risk = riskFrom(cfg);
    const { markets, books, note } = buildDemoScenario();
    const graph = buildGraph(markets);
    const edges = detectEdges(graph, books, risk).filter((e) => e.netEdge >= risk.minEdge);
    const stub = { fetchOrderBook: async (id: string) => books.get(id) } as unknown as PolymarketClient;
    const strat = new CoherenceStrategy(stub, risk, { minProb: 0, maxEvents: 0 });
    strat.graph = graph;
    strat.books = books;
    const orders = await strat.decide(edges, risk);
    const broker = new PaperBroker(stub, cfg.risk.takerFeeBps);
    const fills = await strat.execute(orders, broker);

    const sharesByEdge = new Map<string, number>();
    for (const o of orders) if (!sharesByEdge.has(o.edgeId)) sharesByEdge.set(o.edgeId, o.size);
    let captured = 0;
    for (const e of edges) captured += e.netEdge * (sharesByEdge.get(e.id) ?? 0);

    console.log('\n' + chalk.bgYellow.black(' DEMO ') + ' ' + chalk.gray(note));
    console.log('\n' + chalk.bold('Detected coherence edges: ') + edges.length);
    for (const e of edges) {
      console.log(
        '  • ' + chalk.magenta(e.type) + '  net ' + chalk.green((e.netEdge * 100).toFixed(1) + '%') + '  ' + chalk.gray(e.rationale),
      );
    }
    console.log(chalk.bold('Orders placed: ') + orders.length + '    ' + chalk.bold('Fills: ') + fills.length);
    console.log(
      chalk.bold('Locked profit captured: ') + chalk.green('$' + captured.toFixed(2)) + chalk.gray('  (market-neutral)'),
    );
    const logger = new ExecutionLogger(`demo-${Date.now()}`);
    await logger.init();
    await logger.log('info', { event: 'demo', note, edges: edges.length, orders: orders.length, capturedUsd: captured });
    for (const f of fills) {
      await logger.log('fill', {
        edgeId: f.order.edgeId,
        market: f.order.market.question,
        outcome: f.order.token.outcome,
        size: f.filledSize,
        avgPrice: f.avgPrice,
        costUsd: f.costUsd,
        demo: true,
      });
    }
    console.log(chalk.gray('logged → ' + logger.path) + '\n');
  });

program
  .command('agents')
  .description('Run the AI agent workflow (analyst → architect → developer → QA) over live markets')
  .option('--min-prob <n>', 'min implied probability to fetch a book for', parseFloat, 0.01)
  .action(async (opts: { minProb: number }) => {
    const cfg = loadConfig();
    const risk = riskFrom(cfg);
    const client = new PolymarketClient(cfg.polymarket.gammaUrl, cfg.polymarket.clobUrl);
    const llm = createLlm(cfg.llm);
    console.log(chalk.cyan('scanning live markets for the agent workflow…'));
    const markets = await client.fetchNbaUniverse({
      seedEventSlugs: SEED_EVENT_SLUGS,
      tagIds: NBA_TAG_IDS,
      maxEvents: 40,
    });
    const graph = buildGraph(markets);
    const books = await client.fetchOrderBooks(tokensToPrice(graph, opts.minProb));
    const edges = detectEdges(graph, books, risk);
    const report = await runAgentWorkflow(llm, {
      marketCount: markets.length,
      graph,
      edges,
      partitions: partitionStats(graph),
      minEdge: risk.minEdge,
    });
    renderAgents(report, llm.enabled ? llm.label : 'rule-based fallback');
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(chalk.red('fatal:'), err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
