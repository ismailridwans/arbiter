import chalk from 'chalk';
import Table from 'cli-table3';
import type { CoherenceEdge, EdgeType, Market, OrderBook, RiskContext } from './types';
import type { CoherenceGraph } from './coherence/graph';
import { partitionStats } from './coherence/detector';
import type { BacktestResult, SensitivityRow } from './backtest/backtest';
import type { CrossVenueResult } from './crossvenue/run';
import type { AgentReport } from './ai/agents';

/** Human-readable rendering of a scan: lattice, raw violations, tradeable edges. */

export interface ScanView {
  markets: Market[];
  graph: CoherenceGraph;
  books: Map<string, OrderBook>;
  edges: CoherenceEdge[];
  risk: RiskContext;
}

const pct = (x: number): string => `${(x * 100).toFixed(1)}%`;
const usd = (x: number): string => `$${x.toFixed(2)}`;
const day = (unixSec: number): string =>
  unixSec > 0 ? new Date(unixSec * 1000).toISOString().slice(0, 10) : '—';
const indent = (s: string): string =>
  s
    .split('\n')
    .map((l) => '  ' + l)
    .join('\n');

function wrapText(s: string, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of s.split(/\s+/)) {
    if ((line + ' ' + word).trim().length > width) {
      if (line) lines.push(line);
      line = word;
    } else {
      line = (line + ' ' + word).trim();
    }
  }
  if (line) lines.push(line);
  return lines;
}

function sparkline(values: number[]): string {
  if (values.length === 0) return '';
  const blocks = '▁▂▃▄▅▆▇█';
  const min = Math.min(...values);
  const range = Math.max(...values) - min || 1;
  return values
    .map((v) => blocks.charAt(Math.floor(((v - min) / range) * (blocks.length - 1))))
    .join('');
}

const TYPE_LABEL: Record<EdgeType, string> = {
  implication: chalk.magenta('implication'),
  complementary: chalk.blue('complementary'),
  dutchbook: chalk.cyan('dutch-book'),
  partition: chalk.gray('partition'),
};

export function renderScan(v: ScanView): void {
  const nodes = [...v.graph.nodes.values()].sort((a, b) => b.prob - a.prob).slice(0, 12);
  const nt = new Table({ head: ['Team', 'Kind', 'Implied P'].map((h) => chalk.gray(h)) });
  for (const n of nodes) nt.push([n.team, n.kind, pct(n.prob)]);
  console.log('\n' + chalk.bold('Lattice — top nodes by implied probability'));
  console.log(nt.toString());

  const stats = partitionStats(v.graph);
  if (stats.length > 0) {
    console.log('\n' + chalk.bold('Market coherence — partition sums (a coherent market sums to 1.000)'));
    for (const s of stats) {
      const tag = Math.abs(s.overround) < 0.01 ? chalk.green('tight') : chalk.yellow('loose');
      console.log(
        `  ${s.label}: Σ=${s.sum.toFixed(3)} (${s.overround >= 0 ? '+' : ''}${pct(s.overround)} overround, ${s.count} outcomes) ${tag}`,
      );
    }
  }

  const raws = v.graph.implications
    .map((im) => ({ sub: v.graph.nodes.get(im.sub), sup: v.graph.nodes.get(im.sup) }))
    .filter((r): r is { sub: NonNullable<typeof r.sub>; sup: NonNullable<typeof r.sup> } =>
      Boolean(r.sub && r.sup && r.sub.prob > r.sup.prob),
    )
    .sort((a, b) => b.sub.prob - b.sup.prob - (a.sub.prob - a.sup.prob))
    .slice(0, 10);
  console.log('\n' + chalk.bold('Raw coherence violations (implied-price level)'));
  if (raws.length === 0) {
    console.log(chalk.gray('  none — the lattice is internally consistent at mid prices'));
  } else {
    const rt = new Table({
      head: ['Team', 'Relation', 'P(sub)', 'P(sup)', 'Δ'].map((h) => chalk.gray(h)),
    });
    for (const r of raws) {
      rt.push([
        r.sub.team,
        `${r.sub.kind} ⊑ ${r.sup.kind}`,
        pct(r.sub.prob),
        pct(r.sup.prob),
        chalk.yellow('+' + pct(r.sub.prob - r.sup.prob)),
      ]);
    }
    console.log(rt.toString());
  }

  const tradeable = v.edges.filter((e) => e.netEdge >= v.risk.minEdge);
  console.log(
    '\n' + chalk.bold(`Tradeable edges — net ≥ ${pct(v.risk.minEdge)} after crossing the live spread`),
  );
  if (tradeable.length === 0) {
    console.log(chalk.gray('  none currently clear the spread — coherence holds at tradeable prices'));
  } else {
    const et = new Table({
      head: ['Type', 'Net edge', 'Legs', 'Rationale'].map((h) => chalk.gray(h)),
      colWidths: [15, 10, 6, 58],
      wordWrap: true,
    });
    for (const e of tradeable) {
      et.push([
        TYPE_LABEL[e.type],
        chalk.green(pct(e.netEdge)),
        String(e.legs.length),
        e.explanation ?? e.rationale,
      ]);
    }
    console.log(et.toString());
  }
  console.log('');
}

/** Render a historical backtest: summary, equity sparkline, top captured edges. */
export function renderBacktest(r: BacktestResult): void {
  console.log(
    '\n' + chalk.bold('Backtest — champion ⊑ conference coherence arbitrage (historical replay)'),
  );
  console.log(
    chalk.gray(
      `  window ${day(r.window.from)} → ${day(r.window.to)}  ·  fidelity ${r.params.fidelityMin}m  ·  ` +
        `threshold ${pct(r.params.threshold)}  ·  haircut ${pct(r.params.spreadHaircut)}/leg  ·  size ${usd(r.params.sizeUsd)}/edge`,
    ),
  );

  const summary = new Table();
  summary.push(
    [chalk.gray('team pairs tested'), String(r.pairsTested)],
    [chalk.gray('opportunities captured'), String(r.opportunities)],
    [chalk.gray('capital deployed'), usd(r.totalDeployedUsd)],
    [chalk.gray('locked profit'), chalk.green.bold(usd(r.totalProfitUsd))],
    [chalk.gray('ROI on deployed capital'), chalk.green.bold(r.roiPct.toFixed(2) + '%')],
  );
  console.log(indent(summary.toString()));

  if (r.equity.length > 0) {
    console.log('  equity curve  ' + chalk.green(sparkline(r.equity.map((e) => e.cum))));
  }

  if (r.trades.length === 0) {
    console.log(chalk.gray('\n  no violations cleared the threshold in this window'));
    return;
  }

  const top = [...r.trades].sort((a, b) => b.profitUsd - a.profitUsd).slice(0, 10);
  const tt = new Table({
    head: ['Date', 'Team', 'Δ raw', 'Net', 'Shares', 'Profit'].map((h) => chalk.gray(h)),
  });
  for (const t of top) {
    tt.push([
      day(t.ts),
      t.team,
      chalk.yellow('+' + pct(t.rawEdge)),
      pct(t.netEdge),
      t.shares.toFixed(1),
      chalk.green(usd(t.profitUsd)),
    ]);
  }
  console.log('\n' + chalk.bold('  Top captured edges'));
  console.log(indent(tt.toString()));
  console.log('');
}

/** Render the cost-sensitivity sweep: captured P&L at each per-leg cost assumption. */
export function renderSensitivity(rows: SensitivityRow[], pairsTested: number): void {
  console.log('\n' + chalk.bold('Edge sensitivity — captured P&L vs per-leg cost assumption'));
  console.log(chalk.gray(`  ${pairsTested} team pairs · champion ⊑ conference · market-neutral`));
  const t = new Table({
    head: ['Cost/leg', 'Opportunities', 'Deployed', 'Profit', 'ROI'].map((h) => chalk.gray(h)),
  });
  for (const r of rows) {
    const color = r.profitUsd >= 0 ? chalk.green : chalk.red;
    t.push([
      pct(r.haircut),
      String(r.opportunities),
      usd(r.deployedUsd),
      color(usd(r.profitUsd)),
      color(r.roiPct.toFixed(2) + '%'),
    ]);
  }
  console.log(indent(t.toString()));
  console.log('');
}

/** Render the live cross-venue comparison (Polymarket vs Kalshi) + detected arbs. */
export function renderCrossVenue(res: CrossVenueResult, minEdge: number): void {
  console.log(
    '\n' + chalk.bold('Cross-venue — Polymarket vs Kalshi (same 2026 NBA Champion market)'),
  );
  console.log(
    chalk.gray(
      `  ${res.pmCount} Polymarket teams · ${res.kalshiCount} Kalshi teams · ${res.matches.length} matched`,
    ),
  );
  if (res.edges.length === 0) {
    console.log(chalk.gray('  no overlapping liquid markets to compare right now'));
    return;
  }
  const t = new Table({
    head: ['Team', 'PM YES', 'Kalshi YES', 'Best arb', 'Net edge'].map((h) => chalk.gray(h)),
    colWidths: [20, 9, 11, 26, 10],
  });
  for (const e of res.edges) {
    const tradeable = e.netEdge >= minEdge;
    t.push([
      e.team,
      e.pmYesMid != null ? pct(e.pmYesMid) : '—',
      e.kalshiYesMid != null ? pct(e.kalshiYesMid) : '—',
      `${e.legA} + ${e.legB}`,
      (tradeable ? chalk.green : chalk.gray)((e.netEdge >= 0 ? '+' : '') + pct(e.netEdge)),
    ]);
  }
  console.log(indent(t.toString()));
  const best = res.edges[0];
  if (best && best.netEdge >= minEdge) {
    console.log(
      '  ' +
        chalk.green(`✓ tradeable: ${best.team} — ${best.legA} + ${best.legB} for +${pct(best.netEdge)} locked`),
    );
  } else {
    console.log(
      '  ' + chalk.gray('venues are in line after fees — no arb clears right now (engine keeps watching)'),
    );
  }
  console.log('');
}

/** Render the AI Agent Workflow report (analyst → architect → developer → QA). */
export function renderAgents(report: AgentReport, provider: string): void {
  console.log(
    '\n' + chalk.bold('AI Agent Workflow') + chalk.gray(`  analyst → architect → developer → QA · ${provider}`),
  );
  const agents = [report.analyst, report.architect, report.developer, report.qa];
  const colors = [chalk.cyan, chalk.magenta, chalk.yellow, report.qa.approved ? chalk.green : chalk.red];
  agents.forEach((a, i) => {
    const color = colors[i] ?? chalk.white;
    console.log('\n  ' + color('●') + ' ' + chalk.bold(a.role) + '  ' + chalk.gray('[' + a.source + ']'));
    for (const line of wrapText(a.content, 90)) console.log('    ' + line);
  });
  console.log('');
}
