import { appendFile, mkdir, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Append-only JSONL execution logger. Writes to `.canon/execution/` — the exact
 * location the hackathon requires submissions to capture run logs in. Every
 * pipeline stage and trade is recorded for auditability and the `report` command.
 */

export const EXECUTION_DIR = join('.canon', 'execution');

export type LogKind = 'session' | 'cycle' | 'edge' | 'order' | 'fill' | 'pnl' | 'info' | 'error';

export interface LogRecord {
  ts: number;
  kind: LogKind;
  [key: string]: unknown;
}

export class ExecutionLogger {
  readonly sessionId: string;
  readonly path: string;

  constructor(sessionId?: string) {
    // Epoch-based id: filesystem-safe (no colons) and naturally sortable.
    this.sessionId = sessionId ?? `session-${Date.now()}`;
    this.path = join(EXECUTION_DIR, `${this.sessionId}.jsonl`);
  }

  async init(): Promise<void> {
    await mkdir(EXECUTION_DIR, { recursive: true });
  }

  async log(kind: LogKind, data: Record<string, unknown> = {}): Promise<void> {
    const record: LogRecord = { ts: Date.now(), kind, ...data };
    await appendFile(this.path, JSON.stringify(record) + '\n', 'utf8');
  }
}

export async function listSessions(): Promise<string[]> {
  try {
    return (await readdir(EXECUTION_DIR)).filter((f) => f.endsWith('.jsonl')).sort();
  } catch {
    return [];
  }
}

export async function readSession(file: string): Promise<LogRecord[]> {
  const text = await readFile(join(EXECUTION_DIR, file), 'utf8');
  return text
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as LogRecord);
}
