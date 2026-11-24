/* Shared by the integration tests: opens the assembled California page at an address, switches to the Scout Engine and
   hands back the page and helpers. The engine is reached in the page as MODI.rooftops.api.en().
   Overpass is answered from the saved boxes (CA/dl/scout/streets, CA/engine/sky/dl) unless o.osm === false, in which case
   the page is left to the network (here: the Census TIGER fallback). A hard timeout closes the browser. */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const wait = ms => new Promise(r => setTimeout(r, ms));
const CA = path.resolve(__dirname, '..', '..', '..'), DL = path.join(CA, 'dl', 'scout', 'streets'), SKY = path.join(CA, 'engine', 'sky', 'dl');
exports.wait = wait; exports.SHOTS = path.resolve(__dirname, '..', 'shots');
const saved = {};
const load = n => { if (saved[n]) return saved[n]; const f = n.startsWith('sky:') ? path.join(SKY, n.slice(4) + '.json') : path.join(DL, 'overpass_' + n + '.json'); return (saved[n] = JSON.parse(fs.readFileSync(f, 'utf8')).elements); };
/* which saved box answers a query's box (south, west, north, east), or null (then the answer is an error and the page falls back) */
const boxFor = (s, w, n, e) => { const la = (s + n) / 2, lo = (w + e) / 2; if (la > 37.79 && la < 37.85 && lo < -122.455 && lo > -122.5) return 'sky:ggroads'; if (la > 37.77 && la < 37.815 && lo > -122.425 && lo < -122.38) return 'sf_northeast'; if (la > 33.9 && la < 34.2 && lo > -118.4 && lo < -118.1) return 'la_central'; if (la > 32.64 && la < 32.73 && lo > -117.245 && lo < -117.12) return 'coronado'; if (la > 33.74 && la < 33.77 && lo > -118.3 && lo < -118.24) return 'sky:vtroads'; return null; };
exports.start = async (file, addr, o) => {
  o = o || {};
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
  const browser = await chromium.launch({ proxy, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-precise-memory-info'] });
  const killer = setTimeout(() => { console.log('HARD TIMEOUT: closing the browser'); browser.close().catch(() => {}).then(() => process.exit(3)); }, o.maxMs || 900000);
  const ctx = await browser.newContext({ viewport: { width: o.w || 800, height: o.h || 600 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage(), errs = [], asks = [];
  page.on('pageerror', e => errs.push('pageerror: ' + (e && e.stack || e).toString().slice(0, 700)));
  page.on('crash', () => { errs.push('PAGE CRASHED'); console.log('PAGE CRASHED'); });
  browser.on('disconnected', () => console.log('browser closed', new Date().toISOString()));
  if (o.console) page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errs.push('console: ' + m.text().slice(0, 300)); });
  if (o.osm !== false) await page.route(/overpass|maps\.mail\.ru/, async route => { const q = decodeURIComponent((route.request().postData() || '').replace(/^data=/, '')), m = /\(([-\d.]+),([-\d.]+),([-\d.]+),([-\d.]+)\)/.exec(q); if (!m) return route.fulfill({ status: 400, body: 'bad' });
    const [s, w, n, e] = m.slice(1).map(Number), box = boxFor(s, w, n, e); if (!box) { asks.push('no saved box'); return route.fulfill({ status: 504, body: 'no saved answer' }); }
    const only = /\^motorway/.test(q), els = load(box).filter(el => el.type === 'way' ? (el.geometry && (only ? /^motorway/.test((el.tags || {}).highway || '') : ((el.tags || {}).highway || ((el.tags || {}).railway === 'tram' && (el.tags || {}).cable_tram))) && el.geometry.some(g => g.lat > s && g.lat < n && g.lon > w && g.lon < e)) : el.type === 'node' && !only && el.tags && /^(traffic_signals|stop)$/.test(el.tags.highway || '') && el.lat > s && el.lat < n && el.lon > w && el.lon < e);
    asks.push((only ? 'freeways ' : 'streets ') + els.length + ' ' + box); return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ elements: els }) }); });
  await page.goto('file://' + path.resolve(file) + '#rooftops', { waitUntil: 'load', timeout: 240000 }); await wait(1500);
  const settle = async max => { const t0 = Date.now(); while (Date.now() - t0 < (max || 120000)) { await wait(2000); const st = await page.evaluate(() => MODI.rooftops.api.status()); if (!(st.queued + st.running) && !st.tiles.some(t => t.st === 'load' || t.st === 'queued') && st.tiles.some(t => t.st === 'ok' || t.st === 'err')) return st; } return null; };
  await page.fill('#scFind', addr); await page.press('#scFind', 'Enter'); await settle(150000); await wait(2000);
  await page.click('#scMode button[data-v="eng"]', { timeout: 240000, noWaitAfter: true });
  for (let i = 0; i < 40; i++) { await wait(2500); const ok = await page.evaluate(() => { const en = MODI.rooftops.api.en(); return !!(en && en.state().lat); }); if (ok && i > 1) break; }
  await page.evaluate(q => { const en = MODI.rooftops.api.en(); en.setGraphics(Object.assign({ q: 'low', sun: 14, weather: 'clear', life: true, wide: false }, q || {})); }, o.gfx || null);
  if (!o.hud) await page.addStyleTag({ content: '.se-note,.se-labels,.se-lbl,.sc-enpad,.sc-ennote{display:none!important}' });
  const T = { browser, page, errs, asks, wait, ctx };
  T.ev = (f, a) => page.evaluate(f, a);
  /* wait until the elevation has come and the cells that wait on it are built (the engine runs by itself meanwhile) */
  T.ready = async max => { const t0 = Date.now(); let s = null; while (Date.now() - t0 < (max || 90000)) { await wait(2000); s = await page.evaluate(() => { const en = MODI.rooftops.api.en(), st = en.state(); return { t: st.terrain, built: st.built, queued: st.queued, roads: st.roads, elev: st.elev }; }); if (s.t && !s.t.loading && !s.t.queue && !s.queued && s.roads) break; } return s; };
  /* step the engine's clock by hand: n updates of dt seconds, `what` (a function of en, given as source) sampled every k steps */
  T.step = (n, dt, k, what) => T.ev(a => { const en = MODI.rooftops.api.en(), E = en.engine, f = a[3] ? new Function('en', 'return (' + a[3] + ')(en)') : null, out = []; E.stop(); E.playing = true; for (let i = 0; i < a[0]; i++) { E.emit('update', a[1]); if (f && i % a[2] === a[2] - 1) out.push(f(en)); } return out; }, [n, dt, k || n, what ? String(what) : null]);
  /* let what was asked for arrive and be built, with the clock stopped: small updates, real time between them */
  T.settle = async (max, quiet) => { let s = 0; for (let i = 0; i < (max || 40); i++) { await wait(700); s = await T.ev(() => { const en = MODI.rooftops.api.en(); en.engine.stop(); for (let q = 0; q < 20; q++) en.engine.emit('update', 0.001); const st = en.state(); return (st.terrain ? st.terrain.loading + st.terrain.queue : 0) + st.queued; }); if (!s && i > (quiet || 2)) break; } return s; };
  /* a picture of the view as it stands: the engine draws by itself with its clock held (nothing moves), then is stopped again */
  T.shot = async (name, ms) => { await T.ev(() => { const en = MODI.rooftops.api.en(); en.setGraphics({ playing: false }); en.engine.start(); en.labels && 0; });
    const f0 = await T.ev(() => MODI.rooftops.api.en().engine.time.frame); for (let i = 0; i < 30; i++) { await wait(ms == null ? 1500 : ms / 4); await page.mouse.move(300 + i, 300); const f = await T.ev(() => MODI.rooftops.api.en().engine.time.frame); if (f - f0 >= 4 && i >= 3) break; }
    const box = await T.ev(() => { const c = MODI.rooftops.api.en().canvas; c.scrollIntoView({ block: 'center' }); const r = c.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }); await wait(600);
    const file2 = path.isAbsolute(name) ? name : path.join(exports.SHOTS, name); await page.screenshot({ path: file2, timeout: 240000, clip: { x: Math.max(0, box.x), y: Math.max(0, box.y), width: Math.min(1100, box.width), height: Math.min(800, box.height) } });
    await T.ev(() => { const en = MODI.rooftops.api.en(); en.engine.stop(); en.setGraphics({ playing: true }); en.engine.stop(); }); console.log('shot', path.basename(file2)); };
  T.close = async () => { clearTimeout(killer); console.log('asked:', asks.join(', ') || 'nothing'); console.log('PAGE ERRORS:', errs.length ? errs.length + '\n' + [...new Set(errs)].slice(0, 10).join('\n') : 'none'); await browser.close(); };
  return T;
};
let bad = 0;
exports.ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + JSON.stringify(d).slice(0, 900) : '')); if (!c) bad++; return c; };
exports.bad = () => bad;
