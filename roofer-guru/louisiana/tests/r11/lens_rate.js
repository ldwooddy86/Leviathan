/* How fast the roof views read roofs in the engine, and whether any roof is read again and again: open the engine on an
   address, turn a view on, and every 1.5 s print how many roofs are read and waiting, how many readings the module has been
   asked for, over how many buildings, and the most any one building was read. node lens_rate.js <atlas.html> [lens] [seconds] */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2]), LENS = process.argv[3] || 'wear', SECS = +(process.argv[4] || 40), ADDR = '632 Woodgate Blvd, Baton Rouge, LA';
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
  const browser = await chromium.launch({ proxy, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: 1500, height: 950 }, deviceScaleFactor: 1 })).newPage();
  const errs = []; page.on('pageerror', e => errs.push('pageerror: ' + (e && e.stack || e)));
  await page.goto('file://' + FILE + '#rooftops', { waitUntil: 'load', timeout: 180000 }); await wait(1500);
  const settle = async (max) => { const t0 = Date.now(); while (Date.now() - t0 < (max || 120000)) { await wait(2000); const st = await page.evaluate(() => MODI.rooftops.api.status()); if (!(st.queued + st.running) && !st.tiles.some(t => t.st === 'load' || t.st === 'queued') && st.tiles.some(t => t.st === 'ok' || t.st === 'err')) return st; } return null; };
  await page.fill('#scFind', ADDR); await page.press('#scFind', 'Enter'); await settle(150000); await wait(2500);
  await page.click('#scMode button[data-v="eng"]');
  for (let i = 0; i < 25; i++) { await wait(3000); const s = await page.evaluate(() => { const en = MODI.rooftops.api.en(); if (!en) return null; const st = en.state(); return { built: st.built, queued: st.queued, roads: st.roads }; }); if (s && s.built > 20 && !s.queued && s.roads && i > 5) break; }
  await page.evaluate(() => { const en = MODI.rooftops.api.en(); en.setGraphics({ q: 'medium', day: 'summer', sun: 15, weather: 'clear', life: false, live: false, wide: false }); en.setHeight('drone'); });
  await page.click('#scEnBar [data-a="full"]'); await wait(8000);
  /* count the module's readings by building, and the frames */
  await page.evaluate(() => { const L = MODI.rooftops.api.lens, b0 = L.begin, C = window.__cnt = { calls: 0, by: new Map(), ms: 0, frames: 0, mixes: new Map(), mixChanges: 0 }; L.begin = function (lens, b, ctx) { C.calls++; C.by.set(b.id, (C.by.get(b.id) || 0) + 1); const m = C.mixes.get(b.id); if (m && m !== b.mix) C.mixChanges++; C.mixes.set(b.id, b.mix); const t = performance.now(), r = b0.apply(this, arguments); C.ms += performance.now() - t; return r; }; const tick = () => { C.frames++; requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
  const t0 = Date.now(); await page.evaluate(l => MODI.rooftops.api.en().setGraphics({ lens: l, year: 7 }), LENS);
  let last = '';
  while (Date.now() - t0 < SECS * 1000) { await wait(1500); const g = await page.evaluate(() => { const g = MODI.rooftops.api.en().graphics(), C = window.__cnt, top = [...C.by.values()].sort((a, b) => b - a); return { n: g.lensN, pending: g.lensPending, fps: g.fps, calls: C.calls, roofs: C.by.size, most: top[0] || 0, over2: top.filter(v => v > 2).length, beginMs: Math.round(C.ms), raf: C.frames, mixChanges: C.mixChanges }; }); last = `${((Date.now() - t0) / 1000).toFixed(1)}s ${JSON.stringify(g)}`; console.log(last); if (g.n > 5 && !g.pending && Date.now() - t0 > 6000) break; }
  if (LENS === 'time') { const t1 = Date.now(); await page.evaluate(() => MODI.rooftops.api.en().setGraphics({ year: 8 })); for (let i = 0; i < 14; i++) { await wait(1000); const g = await page.evaluate(() => { const g = MODI.rooftops.api.en().graphics(); return { n: g.lensN, pending: g.lensPending, fps: g.fps, calls: window.__cnt.calls }; }); console.log(`year step: ${((Date.now() - t1) / 1000).toFixed(1)}s ${JSON.stringify(g)}`); if (!g.pending && i > 0) break; } }
  console.log('PAGE ERRORS:', errs.length ? errs.join('\n') : 'none');
  await browser.close();
})().catch(e => { console.error('ERROR', e); process.exit(2); });
