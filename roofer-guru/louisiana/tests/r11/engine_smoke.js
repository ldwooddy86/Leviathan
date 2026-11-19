/* The Scout Engine in the Louisiana atlas: open it on a searched address, let the world build, read its state, take pictures.
   node engine_smoke.js <atlas.html> <outdir> [address] */
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const FILE = path.resolve(process.argv[2]), OUT = path.resolve(process.argv[3] || '.'), ADDR = process.argv[4] || '632 Woodgate Blvd, Baton Rouge, LA';
fs.mkdirSync(OUT, { recursive: true });
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
  const browser = await chromium.launch({ proxy, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1100 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errs = [], logs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + (e && e.stack || e)));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text().slice(0, 300)); });
  await page.goto('file://' + FILE + '#rooftops', { waitUntil: 'load', timeout: 180000 });
  await wait(1500);
  const settle = async (max) => { const t0 = Date.now(); while (Date.now() - t0 < (max || 120000)) { await wait(2000); const st = await page.evaluate(() => MODI.rooftops.api.status()); if (!(st.queued + st.running) && !st.tiles.some(t => t.st === 'load' || t.st === 'queued') && st.tiles.some(t => t.st === 'ok' || t.st === 'err')) return st; } return null; };
  await page.fill('#scFind', ADDR); await page.press('#scFind', 'Enter');
  await settle(150000); await wait(2500);
  console.log('picked:', await page.evaluate(() => { const t = document.querySelector('#scName'); return t && t.textContent; }));
  const caps = await page.evaluate(() => { const c = document.createElement('canvas'), gl = c.getContext('webgl2'); if (!gl) return null; const d = gl.getExtension('WEBGL_debug_renderer_info'); return { float: !!gl.getExtension('EXT_color_buffer_float'), half: !!gl.getExtension('EXT_color_buffer_half_float'), linear: !!gl.getExtension('OES_texture_float_linear'), gpu: d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : '' }; });
  console.log('webgl2:', JSON.stringify(caps));
  console.log('engine script:', await page.evaluate(() => ({ SE: typeof window.__SCOUT_ENGINE__, E3D: typeof window.__SCOUT_E3D__, ver: window.__SCOUT_ENGINE__ && window.__SCOUT_ENGINE__.version })));
  await page.click('#scMode button[data-v="eng"]');
  const t0 = Date.now(); let last = '';
  for (let i = 0; i < 30; i++) { await wait(3000); const s = await page.evaluate(() => { const en = MODI.rooftops.api.en(); if (!en) return null; const st = en.state(), g = en.graphics(); return { mode: st.mode, built: st.built, queued: st.queued, cells: st.cells, roads: st.roads, trees: st.trees, fps: g.fps, tris: g.tris, tier: g.tier, broken: g.broken, refused: g.refused, note: st.note }; }); const j = JSON.stringify(s); if (j !== last) { console.log(((Date.now() - t0) / 1000).toFixed(0) + 's', j); last = j; } if (s && s.built > 20 && !s.queued && s.roads && i > 6) break; }
  await page.screenshot({ path: path.join(OUT, 'en-01-street.png'), timeout: 240000, animations: 'disabled' });
  console.log('bar:', (await page.evaluate(() => document.querySelector('#scEnBar').innerText)).replace(/\s+/g, ' ').slice(0, 900));
  console.log('note:', await page.evaluate(() => document.querySelector('#scModeNote').textContent));
  for (const m of ['drone', 'bird', 'orbit']) { await page.evaluate(k => MODI.rooftops.api.en().setHeight(k), m); await wait(7000); await page.screenshot({ path: path.join(OUT, 'en-02-' + m + '.png'), timeout: 240000, animations: 'disabled' }); }
  const dbg = await page.evaluate(() => { const d = MODI.rooftops.api.en().debug(); return { cells: d.cells.length, built: d.cells.filter(c => c.built).length, n: d.cells.reduce((t, c) => t + c.n, 0), trees: d.cells.reduce((t, c) => t + c.trees, 0), far: d.far, prisms: d.prisms, lamps: d.lamps, labels: d.labels, programs: d.programs, textures: d.textures, quality: d.quality, err: d.err, draws: d.stats.draws, tris: d.stats.tris }; });
  console.log('debug:', JSON.stringify(dbg));
  console.log('PAGE ERRORS:', errs.length ? errs.join('\n') : 'none');
  console.log('CONSOLE:', logs.length ? [...new Set(logs)].slice(0, 20).join('\n') : 'none');
  await browser.close();
})().catch(e => { console.error('ERROR', e); process.exit(2); });
