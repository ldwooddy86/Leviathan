/* The roofing patterns close up: a house roof in Covering and Shingle style from a few metres, and what the layer draws for
   each pattern kind (the shader is given each kind in turn on the same roof). node pattern_shots.js <atlas.html> <outdir> */
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const FILE = path.resolve(process.argv[2]), OUT = path.resolve(process.argv[3] || '.'), ADDR = '632 Woodgate Blvd, Baton Rouge, LA';
fs.mkdirSync(OUT, { recursive: true });
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
  const browser = await chromium.launch({ proxy, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: 900, height: 900 }, deviceScaleFactor: 1 })).newPage();
  const errs = []; page.on('pageerror', e => errs.push('pageerror: ' + (e && e.stack || e)));
  await page.goto('file://' + FILE + '#rooftops', { waitUntil: 'load', timeout: 180000 }); await wait(1500);
  const settle = async (max) => { const t0 = Date.now(); while (Date.now() - t0 < (max || 120000)) { await wait(2000); const st = await page.evaluate(() => MODI.rooftops.api.status()); if (!(st.queued + st.running) && !st.tiles.some(t => t.st === 'load' || t.st === 'queued') && st.tiles.some(t => t.st === 'ok' || t.st === 'err')) return st; } return null; };
  await page.fill('#scFind', ADDR); await page.press('#scFind', 'Enter'); await settle(150000); await wait(2500);
  await page.click('#scMode button[data-v="eng"]'); await wait(16000);
  await page.evaluate(() => { const en = MODI.rooftops.api.en(); en.setGraphics({ q: 'high', sun: 15, weather: 'clear', life: false, trees: false, wide: false }); en.engine.autoQuality = false; });
  await page.click('#scEnBar [data-a="full"]').catch(() => {}); await wait(2500);
  const box = await page.evaluate(() => { const r = document.querySelector('.se-canvas').getBoundingClientRect(); return { x: Math.max(0, r.left), y: Math.max(0, r.top), width: Math.min(r.width, innerWidth - Math.max(0, r.left)), height: Math.min(r.height, innerHeight - Math.max(0, r.top)) }; });
  const shot = name => page.screenshot({ clip: box, timeout: 240000, animations: 'disabled', path: path.join(OUT, name + '.png') });
  await page.evaluate(() => { const en = MODI.rooftops.api.en(); en.setHeight('orbit'); const w = en.world; w.orbit.dist = 9; w.orbit.pitch = -42; w.orbitSpin = false; en.setGraphics({ lens: 'cover' }); });
  const ready = async () => { for (let i = 0; i < 40; i++) { await wait(2000); const g = await page.evaluate(() => { const g = MODI.rooftops.api.en().graphics(); return [g.lensN, g.lensPending]; }); if (g[0] > 1 && !g[1]) break; } await wait(6000); };
  await ready(); await shot('pat-cover');
  /* each pattern kind on the same roofs: the module's reading is replaced for the test */
  for (const [k, name] of [[7, 'tab3'], [8, 'lam'], [9, 'seam'], [10, 'rib'], [11, 'tile'], [12, 'slate'], [13, 'white'], [14, 'dark']]) {
    await page.evaluate(kind => { const L = MODI.rooftops.api.lens, en = MODI.rooftops.api.en(); if (!L._ready0) L._ready0 = L.ready; L.ready = R => { const r = L._ready0(R); if (r && R.lens === 'cover') { const row = kind === 13 ? 12 : kind === 14 ? 11 : kind === 11 || kind === 12 ? 10 : kind >= 9 ? 9 : 8, cv = [0.9, 1, kind, row]; r.vertex = () => cv; } return r; }; en.lensRefresh(); }, k);
    await ready(); await shot('pat-' + k + '-' + name);
  }
  console.log('fps/tier:', JSON.stringify(await page.evaluate(() => { const g = MODI.rooftops.api.en().graphics(); return [g.fps, g.tier, g.refused]; })), 'PAGE ERRORS:', errs.length ? errs.join('\n') : 'none');
  await browser.close();
})().catch(e => { console.error('ERROR', e); process.exit(2); });
