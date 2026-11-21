/* Draw the toolbar and store icons: node tools/icons.mjs
   The mark is an empty silhouette, nobody in particular. Playwright's Chromium rasterizes the SVG at 16, 32, 48 and
   128 pixels, once in colour (icons/icon*.png) and once in grey for "off" or "paused here" (icons/off*.png). */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
let chromium;
try { ({ chromium } = await import('playwright')); } catch (e) { ({ chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs')); }
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function mark(size, off) {
  const bg = off ? '#3b4246' : '#123029', fg = off ? '#a7b0b5' : '#7fe6c4', edge = off ? '#5b6469' : '#2f6b5d';
  const w = size <= 16 ? 2.9 : size <= 32 ? 2.6 : 2.2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">` +
    `<rect x="1" y="1" width="30" height="30" rx="8" fill="${bg}" stroke="${edge}" stroke-width="1"/>` +
    `<circle cx="16" cy="12.2" r="4.9" fill="none" stroke="${fg}" stroke-width="${w}"/>` +
    `<path d="M7.6 26.2c1.3-4.7 4.6-7.3 8.4-7.3s7.1 2.6 8.4 7.3" fill="none" stroke="${fg}" stroke-width="${w}" stroke-linecap="round"/>` +
    (size >= 48 ? `<path d="M10.2 12.2h11.6" stroke="${bg}" stroke-width="1.6" stroke-linecap="round"/>` : '') +
    '</svg>';
}

if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  let browser;
  try { browser = await chromium.launch({ channel: 'chromium', headless: true, args: ['--no-sandbox'] }); }
  catch (e) { browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] }); }
  const page = await browser.newPage();
  for (const off of [false, true]) {
    for (const size of [16, 32, 48, 128]) {
      await page.setViewportSize({ width: size, height: size });
      await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent">${mark(size, off)}</body></html>`);
      const file = path.join(ROOT, 'icons', `${off ? 'off' : 'icon'}${size}.png`);
      await page.screenshot({ path: file, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
      console.log(path.relative(ROOT, file));
    }
  }
  await browser.close();
}
