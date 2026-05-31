// Bundle each Vercel serverless function into a self-contained ESM file under
// api/. The createRequire banner lets CommonJS deps (e.g. dotenv) that call
// require() work inside the ESM bundle ("Dynamic require of 'fs'" fix).
import { build } from 'esbuild';

await build({
  entryPoints: [
    'functions/scan.ts',
    'functions/crossvenue.ts',
    'functions/demo.ts',
    'functions/agents.ts',
    'functions/backtest.ts',
  ],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  outdir: 'api',
  banner: {
    js: "import { createRequire as __createRequire } from 'module'; const require = __createRequire(import.meta.url);",
  },
});
console.log('build-functions: bundled api/*.js');
