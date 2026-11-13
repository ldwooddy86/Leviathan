// Render the atlas mark (the header brandmark) to app/icons/icon{16,32,48,128}.png with headless Chromium.
//   node tools/icons.mjs
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const OUT = join(resolve(dirname(fileURLToPath(import.meta.url)), '..'), 'app', 'icons');
mkdirSync(OUT, { recursive: true });
// the 36 x 36 mark from the shell header, drawn edge to edge
const svg = s => `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 36 36"><rect x="0.5" y="0.5" width="35" height="35" rx="9" fill="#0b6f6d"/><path d="M8 18.5 18 10l10 8.5" fill="none" stroke="#fff" stroke-width="${s <= 16 ? 3 : 2.4}" stroke-linecap="round" stroke-linejoin="round"/><path d="M11 17v10h14V17" fill="none" stroke="#fff" stroke-width="${s <= 16 ? 3 : 2.4}" stroke-linejoin="round"/>${s <= 16 ? '' : '<path d="M15.5 27v-5.2a2.5 2.5 0 0 1 5 0V27" fill="none" stroke="#fff" stroke-width="2"/>'}<circle cx="27.5" cy="9" r="${s <= 16 ? 4.6 : 3.8}" fill="#f39c61"/></svg>`;
const browser = await chromium.launch();
for (const s of [16, 32, 48, 128]) {
  const page = await browser.newPage({ viewport: { width: s, height: s }, deviceScaleFactor: 1 });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg(s)}</body></html>`);
  await page.screenshot({ path: join(OUT, `icon${s}.png`), omitBackground: true, clip: { x: 0, y: 0, width: s, height: s } });
  await page.close();
}
await browser.close();
console.log('icons → app/icons/');
