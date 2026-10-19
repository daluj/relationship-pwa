/**
 * Renders the Kin mark to PNG app icons using Playwright's Chromium.
 * Run: `node --experimental-strip-types scripts/generate-icons.ts` (needs `npx playwright install chromium`).
 */
import { chromium } from '@playwright/test';

const ACCENT = '#14B8A6';
const mark = (fill: string) => `
  <circle cx="12" cy="11" r="5" fill="${fill}"/>
  <circle cx="21" cy="13" r="4" fill="${fill}" opacity=".6"/>
  <path d="M3 27c0-5 4-9 9-9s9 4 9 9z" fill="${fill}"/>
  <path d="M15 27c0-4 3-7 6-7s8 3 8 7z" fill="${fill}" opacity=".6"/>`;

// `inset` = fraction of the canvas the mark occupies (maskable needs a ~80% safe zone).
const icons = [
  { file: 'icon-192.png', size: 192, inset: 0.72, bg: '#FFFFFF', radius: 0.22 },
  { file: 'icon-512.png', size: 512, inset: 0.72, bg: '#FFFFFF', radius: 0.22 },
  { file: 'icon-maskable-512.png', size: 512, inset: 0.56, bg: '#FFFFFF', radius: 0 },
  { file: 'apple-touch-icon.png', size: 180, inset: 0.68, bg: '#FFFFFF', radius: 0 },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const { file, size, inset, bg, radius } of icons) {
  const inner = size * inset;
  const offset = (size - inner) / 2;
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
      <rect width="${size}" height="${size}" rx="${size * radius}" fill="${bg}"/>
      <svg x="${offset}" y="${offset}" width="${inner}" height="${inner}" viewBox="0 0 32 32">${mark(ACCENT)}</svg>
    </svg></body></html>`);
  await page.screenshot({ path: `public/icons/${file}`, omitBackground: true });
  console.log(`public/icons/${file}`);
}
await browser.close();
