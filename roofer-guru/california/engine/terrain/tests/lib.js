/* Shared by the terrain tests: opens the California test bed at an address, switches to the Scout Engine and hands back
   the page and a few helpers. The engine is reached in the page as MODI.rooftops.api.en(). */
const { chromium } = require('playwright');
const path = require('path');
const wait = ms => new Promise(r => setTimeout(r, ms));
exports.wait = wait;
exports.start = async (file, addr, o) => {
  o = o || {};
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
  const browser = await chromium.launch({ proxy, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: o.w || 800, height: o.h || 600 }, deviceScaleFactor: 1 });
  if (o.blockElevation) await ctx.route(/elevation-tiles-prod/, r => r.abort());
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push('pageerror: ' + (e && e.stack || e)));
  page.on('crash', () => { errs.push('PAGE CRASHED'); console.log('PAGE CRASHED'); });
  if (o.console) page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 300)); });
  await page.goto('file://' + path.resolve(file) + '#rooftops', { waitUntil: 'load', timeout: 180000 }); await wait(1500);
  const settle = async max => { const t0 = Date.now(); while (Date.now() - t0 < (max || 120000)) { await wait(2000); const st = await page.evaluate(() => MODI.rooftops.api.status()); if (!(st.queued + st.running) && !st.tiles.some(t => t.st === 'load' || t.st === 'queued') && st.tiles.some(t => t.st === 'ok' || t.st === 'err')) return st; } return null; };
  await page.fill('#scFind', addr); await page.press('#scFind', 'Enter'); await settle(150000); await wait(2000);
  await page.click('#scMode button[data-v="eng"]');
  for (let i = 0; i < 30; i++) { await wait(2500); const ok = await page.evaluate(() => { const en = MODI.rooftops.api.en(); return !!(en && en.state().lat); }); if (ok && i > 1) break; }
  await page.evaluate(q => { const en = MODI.rooftops.api.en(); en.setGraphics(Object.assign({ q: 'low', sun: 14, weather: 'clear', life: false, wide: false, trees: false, lamps: false }, q || {})); }, o.gfx || null);
  const T = { browser, page, errs, wait };
  /* wait until the elevation has come and every ground mesh and cell that waits on it is built */
  T.ready = async (max, needCells) => { const t0 = Date.now(); let s = null; while (Date.now() - t0 < (max || 90000)) { await wait(1500); s = await page.evaluate(() => { const en = MODI.rooftops.api.en(), st = en.state(), d = en.debug(); return { t: st.terrain, built: st.built, queued: st.queued, cells: d.cells.length, cellsBuilt: d.cells.filter(c => c.built).length, roads: st.roads }; }); if (!s.t.loading && !s.t.queue && !s.queued && (!needCells || s.cellsBuilt >= s.cells)) break; } return s; };
  T.shot = async (file2, ms) => { await wait(ms == null ? 6000 : ms); const box = await page.evaluate(() => { const c = document.querySelector('canvas.se-canvas'); c.scrollIntoView({ block: 'center' }); const r = c.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }); await wait(800);
    await page.screenshot({ path: file2, timeout: 240000, clip: { x: Math.max(0, box.x), y: Math.max(0, box.y), width: Math.min(1100, box.width), height: Math.min(800, box.height) } }); };
  T.open = async (lat, lon, yaw, o2) => { await page.evaluate(a => MODI.rooftops.api.en().open(a[0], a[1], a[2], a[3] || {}), [lat, lon, yaw, o2]); await wait(1500); };
  T.ev = (f, a) => page.evaluate(f, a);
  return T;
};
let bad = 0;
exports.ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + JSON.stringify(d) : '')); if (!c) bad++; return c; };
exports.bad = () => bad;
