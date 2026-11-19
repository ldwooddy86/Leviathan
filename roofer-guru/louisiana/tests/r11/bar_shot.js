/* The engine's bar at a desk width and a phone width: a picture of each, and whether anything is wider than the page.
   node bar_shot.js <atlas.html> <outdir> */
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const FILE = path.resolve(process.argv[2]), OUT = path.resolve(process.argv[3] || '.'), ADDR = '632 Woodgate Blvd, Baton Rouge, LA';
fs.mkdirSync(OUT, { recursive: true });
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
  const browser = await chromium.launch({ proxy, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  for (const [vw, vh, tag] of [[1400, 900, 'desk'], [390, 800, 'phone']]) {
    const page = await (await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1 })).newPage();
    const errs = []; page.on('pageerror', e => errs.push(String(e && e.stack || e)));
    await page.goto('file://' + FILE + '#rooftops', { waitUntil: 'load', timeout: 180000 }); await wait(1500);
    const settle = async (max) => { const t0 = Date.now(); while (Date.now() - t0 < (max || 120000)) { await wait(2000); const st = await page.evaluate(() => MODI.rooftops.api.status()); if (!(st.queued + st.running) && !st.tiles.some(t => t.st === 'load' || t.st === 'queued') && st.tiles.some(t => t.st === 'ok' || t.st === 'err')) return st; } return null; };
    await page.fill('#scFind', ADDR); await page.press('#scFind', 'Enter'); await settle(150000); await wait(2500);
    await page.click('#scMode button[data-v="eng"]'); await wait(14000);
    await page.evaluate(() => { const en = MODI.rooftops.api.en(); en.setGraphics({ q: 'low', life: false, storm: 8 }); en.setHeight('saucer'); en.setGraphics({ lens: 'style' }); }); await wait(5000);
    await page.evaluate(() => document.querySelector('#scEnBar').scrollIntoView({ block: 'start' })); await wait(800);
    await page.screenshot({ path: path.join(OUT, 'bar-' + tag + '.png'), timeout: 120000, animations: 'disabled' });
    const o = await page.evaluate(() => { const W = document.documentElement.clientWidth, wide = []; document.querySelectorAll('#scEnBar *, #scEnW *').forEach(e => { const r = e.getBoundingClientRect(); if (r.width && r.right > W + 1 && !e.closest('.se-labels')) wide.push((e.className || e.tagName) + ' ' + Math.round(r.right - W)); }); return { W, scrollW: document.documentElement.scrollWidth, wide: [...new Set(wide)].slice(0, 8), title: document.title, tab: (document.querySelector('.sc h1, .sc .mast h1, .sc [class*="title"]') || {}).textContent }; });
    console.log(tag, JSON.stringify(o), 'errors:', errs.length ? errs.join(' | ').slice(0, 300) : 'none');
    await page.close();
  }
  await browser.close();
})().catch(e => { console.error('ERROR', e); process.exit(2); });
