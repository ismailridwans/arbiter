import chalk from 'chalk';
import Table from 'cli-table3';
import type { CycleResult } from '../pipeline';

/**
 * The "Automation System View" — a live terminal dashboard rendering the
 * `fetch → analysis → decision → execution` pipeline, the coherence lattice,
 * detected edges, and running paper-trading performance. Redrawn every cycle.
 */
export interface DashboardState {
  startedAt: number;
  mode: 'paper' | 'live';
  minEdge: number;
  bankrollUsd: number;
  cycles: number;
  totalCapturedUsd: number;
  totalFills: number;
  openPositions: number;
  investedUsd: number;
  feesUsd: number;
  last?: CycleResult;
  recentEvents: string[];
}

const pct = (x: number): string => `${(x * 100).toFixed(1)}%`;
const usd = (x: number): string => `$${x.toFixed(2)}`;
const indent = (s: string): string =>
  s
    .split('\n')
    .map((l) => '  ' + l)
    .join('\n');

function stage(label: string, ok: boolean, detail: string): string {
  return `${ok ? chalk.green('✓') : chalk.red('✗')} ${chalk.white(label)} ${chalk.gray(detail)}`;
}

export function renderDashboard(state: DashboardState): void {
  const r = state.last;
  console.clear();
  const out: string[] = [];

  out.push(
    '  ' + chalk.bold.cyan('COHERENCE') + chalk.gray('  ·  prediction-market coherence-arbitrage engine'),
  );
  out.push(chalk.gray('  ' + '─'.repeat(66)));

  const uptime = Math.floor((Date.now() - state.startedAt) / 1000);
  const modeTag = state.mode === 'paper' ? chalk.bgYellow.black(' PAPER ') : chalk.bgRed.white(' LIVE ');
  out.push(
    `  ${modeTag}   cycle ${chalk.white(state.cycles)}   uptime ${chalk.white(uptime + 's')}   min-edge ${chalk.white(pct(state.minEdge))}   bankroll ${chalk.white(usd(state.bankrollUsd))}`,
  );

  if (r) {
    out.push(
      '  ' +
        [
          stage('FETCH', !r.error, `${r.marketCount} mkts`),
          stage('ANALYZE', !r.error, `${r.graph.nodes.size} nodes`),
          stage('DECIDE', !r.error, `${r.orders.length} orders`),
          stage('EXECUTE', !r.error, `${r.fills.length} fills`),
        ].join(chalk.gray('  →  ')),
    );
  }
  out.push('');
  console.log(out.join('\n'));

  if (r) {
    const nodes = [...r.graph.nodes.values()].sort((a, b) => b.prob - a.prob).slice(0, 6);
    if (nodes.length > 0) {
      const nt = new Table({ head: ['Team', 'Kind', 'Implied P'].map((h) => chalk.gray(h)) });
      for (const n of nodes) nt.push([n.team, n.kind, pct(n.prob)]);
      console.log(chalk.bold('  Coherence lattice'));
      console.log(indent(nt.toString()));
    }

    const violations = r.graph.implications
      .map((im) => ({ sub: r.graph.nodes.get(im.sub), sup: r.graph.nodes.get(im.sup) }))
      .filter((x) => x.sub && x.sup && x.sub.prob > x.sup.prob);
    const coherence =
      violations.length > 0
        ? chalk.yellow(`⚠ ${violations.length} raw violation(s)`)
        : chalk.green('✓ coherent at mid prices');
    const tradeTag =
      r.tradeable.length > 0
        ? chalk.bgGreen.black(` ${r.tradeable.length} TRADEABLE `)
        : chalk.gray('0 tradeable after spread');
    console.log(`  coherence ${coherence}    edges ${tradeTag}`);

    if (r.tradeable.length > 0) {
      const et = new Table({
        head: ['Type', 'Net', 'Legs', 'Rationale'].map((h) => chalk.gray(h)),
        colWidths: [14, 8, 6, 50],
        wordWrap: true,
      });
      for (const e of r.tradeable) {
        et.push([e.type, chalk.green(pct(e.netEdge)), String(e.legs.length), e.rationale]);
      }
      console.log(indent(et.toString()));
    }
  }

  console.log('');
  console.log(chalk.bold('  Performance') + chalk.gray('  (paper fills against the live book)'));
  console.log(
    `  locked profit ${chalk.green(usd(state.totalCapturedUsd))}   fills ${chalk.white(state.totalFills)}   open positions ${chalk.white(state.openPositions)}   invested ${chalk.white(usd(state.investedUsd))}   fees ${chalk.white(usd(state.feesUsd))}`,
  );

  if (state.recentEvents.length > 0) {
    console.log('\n' + chalk.bold('  Recent'));
    for (const e of state.recentEvents.slice(-5)) console.log('  ' + chalk.gray(e));
  }
  console.log('\n  ' + chalk.gray('Ctrl+C to stop  ·  logs → .canon/execution/'));
}
