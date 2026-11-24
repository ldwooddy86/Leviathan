/* Rooftop Scout, California: what every browser test here shares. One software-rendered browser at a time, a hard
   stop after `hard` minutes, a small window. */
const { chromium } = require('playwright');
const path = require('path');
const wait = ms => new Promise(r => setTimeout(r, ms));
async function launch(o) {
  o = o || {};
  const hard = setTimeout(() => { console.log('HARD TIMEOUT after ' + (o.hard || 12) + ' min'); process.exit(3); }, (o.hard || 12) * 60000);
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
  const browser = await chromium.launch({ proxy, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext(Object.assign({ viewport: { width: o.w || 900, height: o.h || 700 }, deviceScaleFactor: 1 }, o.ctx || {}));
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push('pageerror: ' + String((e && e.stack) || e).slice(0, 700)));
  page.on('crash', () => { console.log('PAGE CRASHED'); });
  const close = async () => { clearTimeout(hard); try { await browser.close(); } catch (e) { /* gone */ } };
  return { browser, ctx, page, errs, close };
}
async function openPage(page, file, hash) {
  await page.goto('file://' + path.resolve(file) + (hash === undefined ? '#rooftops' : hash), { waitUntil: 'load', timeout: 240000 });
  for (let i = 0; i < 40; i++) { if (await page.evaluate(() => typeof MODI !== 'undefined' && !!(MODI.rooftops && MODI.rooftops.api))) return true; await wait(1500); }
  return false;
}
async function settle(page, max) {
  const t0 = Date.now();
  while (Date.now() - t0 < (max || 120000)) { await wait(2000); const st = await page.evaluate(() => MODI.rooftops.api.status()); if (!(st.queued + st.running) && !st.tiles.some(t => t.st === 'load' || t.st === 'queued') && st.tiles.some(t => t.st === 'ok' || t.st === 'err')) return st; }
  return null;
}
async function find(page, addr, max) { await page.fill('#scFind', addr); await page.press('#scFind', 'Enter'); const st = await settle(page, max || 150000); await wait(2500); return st; }
/* the engine, at low quality from its first frame; g = more graphics settings */
async function engine(page, g, minBuilt) {
  await page.evaluate(() => { setTimeout(() => document.querySelector('#scMode button[data-v="eng"]').click(), 0); });
  const G = Object.assign({ q: 'low', sun: 15, weather: 'clear', life: false, wide: false, trees: false }, g || {});
  for (let i = 0; i < 80; i++) { await wait(500); const ok = await page.evaluate(G => { const en = MODI.rooftops.api.en(); if (!en) return false; en.setGraphics(G); return true; }, G).catch(() => false); if (ok) break; }
  let s = null;
  for (let i = 0; i < 45; i++) { await wait(3000); s = await page.evaluate(() => { const en = MODI.rooftops.api.en(); if (!en) return null; const st = en.state(); return { built: st.built, queued: st.queued, roads: st.roads, mode: st.mode, elev: st.elev, lat: st.lat, lon: st.lon }; }).catch(() => null); if (s && s.built >= (minBuilt || 8) && !s.queued && s.roads && i > 3) break; }
  await page.evaluate(G => MODI.rooftops.api.en().setGraphics(G), G);
  return s;
}
/* a picture of the engine's canvas (or of a clip) with a long timeout */
async function shot(page, file, clip) {
  if (!clip) clip = await page.evaluate(() => { const c = MODI.rooftops.api.en().canvas; c.scrollIntoView({ block: 'center' }); const r = c.getBoundingClientRect(); return { x: Math.max(0, r.x), y: Math.max(0, r.y), width: Math.min(innerWidth - Math.max(0, r.x), r.width), height: Math.min(innerHeight - Math.max(0, r.y), r.height) }; });
  await wait(600);
  try { await page.screenshot({ path: file, timeout: 240000, clip }); return true; } catch (e) { console.log('no picture ' + file + ': ' + String(e).slice(0, 100)); return false; }
}
const checker = () => { const c = { bad: 0, ok(v, m, d) { console.log((v ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + JSON.stringify(d).slice(0, 900) : '')); if (!v) c.bad++; return v; } }; return c; };
module.exports = { wait, launch, openPage, settle, find, engine, shot, checker };
