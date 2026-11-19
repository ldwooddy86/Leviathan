/* The flood on the coast: warp the saucer to Grand Isle in a Category 4, look at the water from the craft, from drone height
   and from the street; then a roof close up in the Covering view. node surge_shots.js <atlas.html> <outdir> */
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const FILE = path.resolve(process.argv[2]), OUT = path.resolve(process.argv[3] || '.'), ADDR = '632 Woodgate Blvd, Baton Rouge, LA';
const Q = process.env.Q || 'medium', VW = +(process.env.VW || 1000), VH = +(process.env.VH || 700);
fs.mkdirSync(OUT, { recursive: true });
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
  const browser = await chromium.launch({ proxy, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1 })).newPage();
  const errs = [], logs = []; page.on('pageerror', e => errs.push('pageerror: ' + (e && e.stack || e))); page.on('console', m => { if (m.type() === 'error') logs.push(m.text().slice(0, 400)); });
  await page.goto('file://' + FILE + '#rooftops', { waitUntil: 'load', timeout: 180000 }); await wait(1500);
  const settle = async (max) => { const t0 = Date.now(); while (Date.now() - t0 < (max || 120000)) { await wait(2000); const st = await page.evaluate(() => MODI.rooftops.api.status()); if (!(st.queued + st.running) && !st.tiles.some(t => t.st === 'load' || t.st === 'queued') && st.tiles.some(t => t.st === 'ok' || t.st === 'err')) return st; } return null; };
  await page.fill('#scFind', ADDR); await page.press('#scFind', 'Enter'); await settle(150000); await wait(2500);
  await page.click('#scMode button[data-v="eng"]'); await wait(16000);
  await page.evaluate(q => { const en = MODI.rooftops.api.en(); en.setGraphics({ q, sun: 15, weather: 'cloudy', life: false }); }, Q);
  await page.click('#scEnBar [data-a="full"]').catch(() => {}); await wait(2500);
  const box = await page.evaluate(() => { const r = document.querySelector('.se-canvas').getBoundingClientRect(); return { x: Math.max(0, r.left), y: Math.max(0, r.top), width: Math.min(r.width, innerWidth - Math.max(0, r.left)), height: Math.min(r.height, innerHeight - Math.max(0, r.top)) }; });
  const shot = name => page.screenshot({ clip: box, timeout: 180000, animations: 'disabled', path: path.join(OUT, name + '.png') });
  /* a roof close up in the Covering view and the Shingle style view: the patterns */
  await page.evaluate(() => { const en = MODI.rooftops.api.en(); en.setHeight('orbit'); const w = en.world; w.orbit.dist = 22; w.orbit.pitch = -38; w.orbitSpin = false; en.setGraphics({ lens: 'cover' }); });
  for (let i = 0; i < 30; i++) { await wait(1500); const g = await page.evaluate(() => { const g = MODI.rooftops.api.en().graphics(); return [g.lensN, g.lensPending]; }); if (g[0] > 3 && !g[1]) break; } await wait(3000); await shot('close-cover');
  await page.evaluate(() => MODI.rooftops.api.en().setGraphics({ lens: 'style' })); for (let i = 0; i < 30; i++) { await wait(1500); const g = await page.evaluate(() => { const g = MODI.rooftops.api.en().graphics(); return [g.lensN, g.lensPending]; }); if (g[0] > 3 && !g[1]) break; } await wait(3000); await shot('close-style');
  await page.evaluate(() => { const en = MODI.rooftops.api.en(); en.setGraphics({ lens: 'off' }); en.setHeight('saucer'); en.storm(8); }); await wait(4000);
  console.log('warp:', await page.evaluate(() => MODI.rooftops.api.en().uap.warp(29.2366, -89.9873, {})));
  for (let i = 0; i < 40; i++) { await wait(1500); const w = await page.evaluate(() => MODI.rooftops.api.en().state().uap.warp); if (!w && i > 2) break; }
  await settle(90000); await wait(20000);
  console.log('at Grand Isle:', JSON.stringify(await page.evaluate(() => { const en = MODI.rooftops.api.en(), s = en.state(), g = en.graphics(); return { lat: +s.lat.toFixed(4), lon: +s.lon.toFixed(4), built: s.built, surge: g.surge, note: g.surgeNote, fps: g.fps, tier: g.tier, refused: g.refused }; })));
  await shot('surge-saucer');
  await page.evaluate(() => MODI.rooftops.api.en().setHeight('drone')); await wait(14000); await shot('surge-drone');
  await page.evaluate(() => MODI.rooftops.api.en().setHeight('street')); await wait(14000); await shot('surge-street');
  console.log('PAGE ERRORS:', errs.length ? errs.join('\n') : 'none'); console.log('CONSOLE ERRORS:', [...new Set(logs)].filter(l => !/overpass|ERR_FAILED|504/.test(l)).slice(0, 8).join('\n') || 'none but the known network notes');
  await browser.close();
})().catch(e => { console.error('ERROR', e); process.exit(2); });
