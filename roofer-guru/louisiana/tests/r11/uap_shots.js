/* The flying saucer and the Tic Tac in the Scout Engine: take each out, look at it, warp one across the state, and try the
   Alta X in a storm. node uap_shots.js <atlas.html> <outdir> [address] */
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const FILE = path.resolve(process.argv[2]), OUT = path.resolve(process.argv[3] || '.'), ADDR = process.argv[4] || '632 Woodgate Blvd, Baton Rouge, LA';
const Q = process.env.Q || 'low', VW = +(process.env.VW || 1100), VH = +(process.env.VH || 760);
fs.mkdirSync(OUT, { recursive: true });
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
  const browser = await chromium.launch({ proxy, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1 })).newPage();
  const errs = [], logs = []; page.on('pageerror', e => errs.push('pageerror: ' + (e && e.stack || e))); page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text().slice(0, 500)); });
  await page.goto('file://' + FILE + '#rooftops', { waitUntil: 'load', timeout: 180000 }); await wait(1500);
  const settle = async (max) => { const t0 = Date.now(); while (Date.now() - t0 < (max || 120000)) { await wait(2000); const st = await page.evaluate(() => MODI.rooftops.api.status()); if (!(st.queued + st.running) && !st.tiles.some(t => t.st === 'load' || t.st === 'queued') && st.tiles.some(t => t.st === 'ok' || t.st === 'err')) return st; } return null; };
  await page.fill('#scFind', ADDR); await page.press('#scFind', 'Enter'); await settle(150000); await wait(2500);
  await page.click('#scMode button[data-v="eng"]');
  for (let i = 0; i < 25; i++) { await wait(3000); const s = await page.evaluate(() => { const en = MODI.rooftops.api.en(); if (!en) return null; const st = en.state(); return { built: st.built, queued: st.queued, roads: st.roads }; }); if (s && s.built > 20 && !s.queued && s.roads && i > 5) break; }
  await page.evaluate(q => { const en = MODI.rooftops.api.en(); en.setGraphics({ q, sun: 15, weather: 'cloudy' }); }, Q);
  await page.click('#scEnBar [data-a="full"]').catch(() => {}); await wait(3000);
  const box = await page.evaluate(() => { const r = document.querySelector('.se-canvas').getBoundingClientRect(); return { x: Math.max(0, r.left), y: Math.max(0, r.top), width: Math.min(r.width, innerWidth - Math.max(0, r.left)), height: Math.min(r.height, innerHeight - Math.max(0, r.top)) }; });
  const shot = name => page.screenshot({ clip: box, timeout: 120000, animations: 'disabled', path: path.join(OUT, name + '.png') });
  const st = () => page.evaluate(() => { const en = MODI.rooftops.api.en(), s = en.state(), g = en.graphics(); return { mode: s.mode, uap: s.uap, lat: +s.lat.toFixed(4), lon: +s.lon.toFixed(4), built: s.built, fps: g.fps, refused: g.refused, broken: g.broken, hud: (document.querySelector('.se-hud') || {}).innerText }; });
  await page.evaluate(() => MODI.rooftops.api.en().setHeight('saucer')); await wait(6000); await shot('uap-1-saucer-chase'); console.log('saucer', JSON.stringify(await st()).slice(0, 700));
  await page.evaluate(() => { const w = MODI.rooftops.api.en().world; w.uchase.yaw = 150; w.uchase.pitch = 6; w.uchase.dist = 22; }); await wait(5000); await shot('uap-2-saucer-below');
  await page.evaluate(() => { const w = MODI.rooftops.api.en().world; w.uchase.yaw = 40; w.uchase.pitch = -24; w.uchase.dist = 24; }); await wait(5000); await shot('uap-3-saucer-above');
  await page.evaluate(() => { const en = MODI.rooftops.api.en(); en.setHeight('tictac'); const w = en.world; w.uchase.yaw = 60; w.uchase.pitch = -8; w.uchase.dist = 26; }); await wait(6000); await shot('uap-4-tictac'); console.log('tictac', JSON.stringify(await st()).slice(0, 400));
  /* warp the saucer to New Orleans */
  await page.evaluate(() => { const en = MODI.rooftops.api.en(); en.setHeight('saucer'); const w = en.world; w.uchase.yaw = 0; w.uchase.pitch = -12; w.uchase.dist = 38; }); await wait(3000);
  console.log('warp asked:', await page.evaluate(() => MODI.rooftops.api.en().uap.warp(29.9584, -90.0644, {})));
  for (let i = 0; i < 14; i++) { await wait(700); const s = await st(); console.log('  t' + i, JSON.stringify(s.uap), s.lat, s.lon); if (i === 2 || i === 4) await shot('uap-5-warp-' + i); if (!s.uap || !s.uap.warp) break; }
  await wait(15000); await shot('uap-6-arrived'); console.log('arrived', JSON.stringify(await st()).slice(0, 700));
  /* the Alta X in a storm */
  await page.evaluate(() => { const en = MODI.rooftops.api.en(); en.storm(6); en.setHeight('alta'); }); await wait(1500);
  console.log('alta in a Category 2:', JSON.stringify(await page.evaluate(() => { const en = MODI.rooftops.api.en(), w = document.querySelector('.se-warn'); return { mode: en.state().mode, warn: w && !w.hidden ? w.textContent : null }; })));
  await shot('uap-7-alta-warning');
  await page.evaluate(() => { const en = MODI.rooftops.api.en(); en.storm(1); en.setHeight('alta'); }); await wait(4000);
  console.log('alta in light rain:', JSON.stringify(await page.evaluate(() => { const en = MODI.rooftops.api.en(); return { mode: en.state().mode, alta: en.state().alta }; })));
  await page.evaluate(() => MODI.rooftops.api.en().storm(4)); await wait(5000);
  console.log('storm raised under it:', JSON.stringify(await page.evaluate(() => { const en = MODI.rooftops.api.en(), w = document.querySelector('.se-warn'); return { alta: en.state().alta, warn: w && !w.hidden ? w.textContent : null }; })));
  console.log('PAGE ERRORS:', errs.length ? errs.join('\n') : 'none'); console.log('CONSOLE:', logs.length ? [...new Set(logs)].filter(l => !/overpass|ERR_FAILED|504|willReadFrequently/.test(l)).slice(0, 12).join('\n') || 'only the known network notes' : 'none');
  await browser.close();
})().catch(e => { console.error('ERROR', e); process.exit(2); });
