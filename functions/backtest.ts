import type { IncomingMessage, ServerResponse } from 'node:http';
import { backtestData } from './_engine';

export const config = { maxDuration: 60 };

export default async function handler(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(await backtestData()));
}
