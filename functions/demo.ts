import type { IncomingMessage, ServerResponse } from 'node:http';
import { demoData } from './_engine';

export default async function handler(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(await demoData()));
}
