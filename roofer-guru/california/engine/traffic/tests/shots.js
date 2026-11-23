/* The test bed with the traffic port and the scout.js road patch, at one address, at given hours: a picture and the
   traffic's own numbers each time. Overpass is answered from the saved boxes (CA/dl/scout/streets), cut to the box asked.
   node shots.js <page.html> "<address>" <out prefix> <height> <hours, e.g. 3,17> [yaw] */
const { chromium } = require('playwright'), fs = require('fs'), path = require('path');
const FILE = path.resolve(process.argv[2]), ADDR = process.argv[3], OUT = process.argv[4], H = process.argv[5] || 'bird', HOURS = (process.argv[6] || '17').split(',').map(Number);
const wait = ms => new Promise(r => setTimeout(r, ms)), DL = path.resolve(__dirname, '..', '..', '..', 'dl', 'scout', 'streets'), saved = {};
const load = n => saved[n] || (saved[n] = JSON.parse(fs.readFileSync(path.join(DL, 'overpass_' + n + '.json'), 'utf8')).elements);
(async () => {
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
  const browser = await chromium.launch({ proxy, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: 900, height: 640 }, deviceScaleFactor: 1 })).newPage();
  const errs = [], asks = []; page.on('pageerror', e => errs.push('pageerror: ' + (e && e.stack || e).toString().slice(0, 600)));
  await page.route(/overpass|maps\.mail\.ru/, async route => { const q = decodeURIComponent((route.request().postData() || '').replace(/^data=/, '')), m = /\(([-\d.]+),([-\d.]+),([-\d.]+),([-\d.]+)\)/.exec(q); if (!m) return route.fulfill({ status: 400, body: 'bad' });
    const [s, w, n, e] = m.slice(1).map(Number), box = s > 36 ? 'sf_northeast' : s > 33.5 ? 'la_central' : 'coronado', only = /\^motorway/.test(q), els = load(box).filter(el => el.type === 'way' ? (el.geometry && (only ? /^motorway/.test((el.tags || {}).highway || '') : ((el.tags || {}).highway || ((el.tags || {}).railway === 'tram' && (el.tags || {}).cable_tram))) && el.geometry.some(g => g.lat > s && g.lat < n && g.lon > w && g.lon < e)) : el.type === 'node' && !only && el.tags && /^(traffic_signals|stop)$/.test(el.tags.highway || '') && el.lat > s && el.lat < n && el.lon > w && el.lon < e);
    asks.push((only ? 'freeways ' : 'streets ') + els.length); return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ elements: els }) }); });
  await page.goto('file://' + FILE + '#rooftops', { waitUntil: 'load', timeout: 180000 }); await wait(1500);
  const settle = async (max) => { const t0 = Date.now(); while (Date.now() - t0 < (max || 120000)) { await wait(2000); const st = await page.evaluate(() => MODI.rooftops.api.status()); if (!(st.queued + st.running) && !st.tiles.some(t => t.st === 'load' || t.st === 'queued') && st.tiles.some(t => t.st === 'ok' || t.st === 'err')) return st; } return null; };
  await page.fill('#scFind', ADDR); await page.press('#scFind', 'Enter'); await settle(150000); await wait(2500);
  await page.click('#scMode button[data-v="eng"]'); let s = null;
  for (let i = 0; i < 30; i++) { await wait(3000); s = await page.evaluate(() => { const en = MODI.rooftops.api.en(); if (!en) return null; const st = en.state(); return { built: st.built, queued: st.queued, roads: st.roads, lat: st.lat, lon: st.lon, mode: st.mode }; }); if (s && s.built > 20 && !s.queued && s.roads && i > 5) break; }
  console.log('engine', JSON.stringify(s), 'asked:', asks.join(', '));
  const box = async () => page.evaluate(() => { const c = document.querySelector('#scEng canvas, .sc-eng canvas, canvas.se-canvas') || [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height)[0]; c.scrollIntoView({ block: 'center' }); const r = c.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
  for (const hr of HOURS) {
    await page.evaluate(([h, hr]) => { const en = MODI.rooftops.api.en(); en.setGraphics({ q: 'low', sun: hr, weather: 'clear', life: true, wide: false }); en.setHeight(h); }, [H, hr]);
    /* keep the engine awake and let the traffic run: the clock is stepped by the page's own frames */
    for (let i = 0; i < 8; i++) { await page.mouse.move(300 + i * 5, 300); await wait(2500); }
    const d = await page.evaluate(() => { const en = MODI.rooftops.api.en(), T = en.world.traffic; return { dbg: T ? T.debug() : null, street: en.street.stats, sunAlt: en.world.sunAlt, roads: en.world.roads.length, kinds: en.world.roads.reduce((a, r) => { a[r.kind] = (a[r.kind] || 0) + 1; return a; }, {}), oneway: en.world.roads.filter(r => r.ow).length, up: en.world.roads.filter(r => r.up).length }; });
    console.log(hr + 'h', JSON.stringify(d)); const b = await box(); await wait(800);
    await page.screenshot({ path: OUT + '_' + String(hr).padStart(2, '0') + '.png', timeout: 240000, clip: { x: Math.max(0, b.x), y: Math.max(0, b.y), width: Math.min(900, b.width), height: Math.min(640, b.height) } }); }
  console.log('PAGE ERRORS:', errs.length ? errs.join('\n') : 'none'); await browser.close();
})().catch(e => { console.error('ERROR', e); process.exit(2); });
