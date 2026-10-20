// Lighthouse audit of the production build (mobile, simulated throttling) — pwa §9 "performance ≥ 90 on mobile".
// Usage: npm run build && npm run preview   (in another terminal)  then  npm run lighthouse [url]
// Uses Playwright's Chromium, so no separate Chrome install is needed.
import { spawnSync } from 'node:child_process';
import { chromium } from '@playwright/test';

const url = process.argv[2] ?? 'http://localhost:4173/';
const out = 'lighthouse-report.html';
const result = spawnSync(
  'npx',
  [
    '--yes',
    'lighthouse@12',
    url,
    '--form-factor=mobile',
    '--throttling-method=simulate',
    '--only-categories=performance,accessibility,best-practices',
    '--chrome-flags=--headless=new',
    '--output=html',
    `--output-path=${out}`,
    '--quiet',
  ],
  { stdio: 'inherit', env: { ...process.env, CHROME_PATH: chromium.executablePath() } },
);
if (result.status === 0) console.log(`Report written to ${out}`);
process.exit(result.status ?? 1);
