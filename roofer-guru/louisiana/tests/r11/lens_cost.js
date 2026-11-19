/* What one roof costs the roof views in the engine, apart from drawing: with a view on and every roof read, ask for all of
   them again and time single passes of the engine's own sync (each pass reads roofs until its few milliseconds are spent).
   node lens_cost.js <atlas.html> [lens] */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2]), LENS = process.argv[3] || 'time', ADDR = '632 Woodgate Blvd, Baton Rouge, LA';
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
  const browser = await chromium.launch({ proxy, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: 1000, height: 640 }, deviceScaleFactor: 1 })).newPage();
  const errs = []; page.on('pageerror', e => errs.push('pageerror: ' + (e && e.stack || e)));
  await page.goto('file://' + FILE + '#rooftops', { waitUntil: 'load', timeout: 180000 }); await wait(1500);
  const settle = async (max) => { const t0 = Date.now(); while (Date.now() - t0 < (max || 120000)) { await wait(2000); const st = await page.evaluate(() => MODI.rooftops.api.status()); if (!(st.queued + st.running) && !st.tiles.some(t => t.st === 'load' || t.st === 'queued') && st.tiles.some(t => t.st === 'ok' || t.st === 'err')) return st; } return null; };
  await page.fill('#scFind', ADDR); await page.press('#scFind', 'Enter'); await settle(150000); await wait(2500);
  await page.click('#scMode button[data-v="eng"]');
  for (let i = 0; i < 25; i++) { await wait(3000); const s = await page.evaluate(() => { const en = MODI.rooftops.api.en(); if (!en) return null; const st = en.state(); return { built: st.built, queued: st.queued, roads: st.roads }; }); if (s && s.built > 20 && !s.queued && s.roads && i > 5) break; }
  await page.evaluate(l => { const en = MODI.rooftops.api.en(); en.setGraphics({ q: 'low', day: 'summer', sun: 15, weather: 'clear', life: false, live: false, wide: false, lens: l, year: 7 }); en.setHeight('drone'); }, LENS);
  for (let i = 0; i < 60; i++) { await wait(2000); const g = await page.evaluate(() => { const g = MODI.rooftops.api.en().graphics(); return [g.lensN, g.lensPending]; }); if (g[0] > 5 && !g[1]) break; }
  const out = await page.evaluate(() => {
    const en = MODI.rooftops.api.en(), L = MODI.rooftops.api.lens, res = []; let calls = 0; const b0 = L.begin; L.begin = function () { calls++; return b0.apply(this, arguments); };
    for (let k = 0; k < 6; k++) { const c0 = calls, t = performance.now(); if (k === 0) en.lensRefresh(); else en.setGraphics({ year: 7 + k }); const ms = performance.now() - t; res.push({ pass: k, roofs: calls - c0, ms: +ms.toFixed(1), each: calls - c0 ? +(ms / (calls - c0)).toFixed(2) : null, pending: en.graphics().lensPending }); }
    L.begin = b0; const g = en.graphics(); return { res, n: g.lensN, tier: g.tier, tris: [...en.lensMap.values()].reduce((t, x) => t + (x.mesh ? x.mesh.tris || 0 : 0), 0), meshes: [...en.lensMap.values()].filter(x => x.mesh).length };
  });
  console.log(JSON.stringify(out)); console.log('PAGE ERRORS:', errs.length ? errs.join('\n') : 'none');
  await browser.close();
})().catch(e => { console.error('ERROR', e); process.exit(2); });
