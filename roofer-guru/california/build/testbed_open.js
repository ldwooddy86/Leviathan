/* Opens the California test bed at an address, switches to the Scout Engine and takes one picture. A starting point
   for engine tests: copy it and add checks.
   node testbed_open.js <page.html> "<address>" <out.png> [street|drone|bird|metro] */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2]), ADDR = process.argv[3] || '200 N Spring St, Los Angeles, CA', OUT = process.argv[4] || 'testbed.png', H = process.argv[5] || 'bird';
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
  const browser = await chromium.launch({ proxy, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 1 })).newPage();
  const errs = []; page.on('pageerror', e => errs.push('pageerror: ' + (e && e.stack || e)));
  await page.goto('file://' + FILE + '#rooftops', { waitUntil: 'load', timeout: 180000 }); await wait(1500);
  const settle = async (max) => { const t0 = Date.now(); while (Date.now() - t0 < (max || 120000)) { await wait(2000); const st = await page.evaluate(() => MODI.rooftops.api.status()); if (!(st.queued + st.running) && !st.tiles.some(t => t.st === 'load' || t.st === 'queued') && st.tiles.some(t => t.st === 'ok' || t.st === 'err')) return st; } return null; };
  await page.fill('#scFind', ADDR); await page.press('#scFind', 'Enter'); const st = await settle(150000); await wait(2500);
  console.log('scout status', JSON.stringify(st && { tiles: st.tiles.length, ok: st.tiles.filter(t => t.st === 'ok').length, err: st.tiles.filter(t => t.st === 'err').length }));
  await page.click('#scMode button[data-v="eng"]');
  let s = null;
  for (let i = 0; i < 30; i++) { await wait(3000); s = await page.evaluate(() => { const en = MODI.rooftops.api.en(); if (!en) return null; const st = en.state(); return { built: st.built, queued: st.queued, roads: st.roads, lat: st.lat, lon: st.lon, mode: st.mode }; }); if (s && s.built > 20 && !s.queued && s.roads && i > 5) break; }
  console.log('engine', JSON.stringify(s));
  await page.evaluate(h => { const en = MODI.rooftops.api.en(); en.setGraphics({ q: 'low', sun: 15, weather: 'clear', life: false, wide: false }); en.setHeight(h); }, H); await wait(12000);
  const box = await page.evaluate(() => { const c = document.querySelector('#scEng canvas, .sc-eng canvas, canvas.se-canvas') || [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height)[0]; c.scrollIntoView({ block: 'center' }); const r = c.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
  await wait(1500);
  await page.screenshot({ path: OUT, timeout: 180000, clip: { x: Math.max(0, box.x), y: Math.max(0, box.y), width: Math.min(1100, box.width), height: Math.min(800, box.height) } });
  console.log('PAGE ERRORS:', errs.length ? errs.join('\n') : 'none');
  await browser.close();
})().catch(e => { console.error('ERROR', e); process.exit(2); });
