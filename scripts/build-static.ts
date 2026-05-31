// Vercel build step: render the LANDING + DASHBOARD pages (from src/web/page.ts)
// into static HTML under public/. The api/ serverless functions serve the JSON.
import { mkdir, writeFile } from 'node:fs/promises';
import { LANDING, DASHBOARD } from '../src/web/page';

await mkdir('public/dashboard', { recursive: true });
await writeFile('public/index.html', LANDING, 'utf8');
await writeFile('public/dashboard/index.html', DASHBOARD, 'utf8');
console.log('build-static: wrote public/index.html and public/dashboard/index.html');
