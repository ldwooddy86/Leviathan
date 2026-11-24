/* California Roofer Guru: smoke test of the assembled page. Opens every module, then the Scout tab at an address, the
   Scout Engine, the weather scales, the aircraft kit, and (if present) the terrain and the M3. One picture at the end.
   node ca_smoke.js <page.html> ["address"] [out.png] */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2]), ADDR = process.argv[3] || '1100 Orange Ave, Coronado, CA', OUT = process.argv[4] || 'ca_smoke.png';
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
  const browser = await chromium.launch({ proxy, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: 900, height: 700 }, deviceScaleFactor: 1 })).newPage();
  const errs = []; page.on('pageerror', e => errs.push('pageerror: ' + (e && e.stack || e).toString().slice(0, 600)));
  let bad = 0; const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + JSON.stringify(d).slice(0, 700) : '')); if (!c) bad++; };
  await page.goto('file://' + FILE, { waitUntil: 'load', timeout: 240000 }); await wait(2500);
  ok(/California Roofer Guru/.test(await page.title()), 'title', await page.title());
  /* every module mounts with no error and no Louisiana word in its text */
  const mods = await page.evaluate(() => Object.keys(typeof MODI !== 'undefined' ? MODI : {}));
  ok(mods.length >= 18, 'modules registered', mods);
  const BAN = /Louisiana|parish|hurricane|Baton Rouge|New Orleans|FORTIFIED|LSLBC|storm surge|Category [1-5]/i;
  for (const k of mods) {
    const e0 = errs.length; await page.evaluate(k => { location.hash = '#' + k; }, k); await wait(1800);
    const r = await page.evaluate(() => { const m = document.querySelector('main') || document.body; const t = m.innerText || ''; return { n: t.length, undef: (t.match(/\bundefined\b|\bNaN\b|\[object Object\]/g) || []).length, t: t.slice(0, 200000) }; });
    const hit = r.t.match(BAN);
    ok(errs.length === e0 && r.n > 300 && !r.undef && !hit, 'module ' + k, { chars: r.n, undef: r.undef, banned: hit && hit[0], ctx: hit ? r.t.slice(Math.max(0, hit.index - 60), hit.index + 60) : undefined, errs: errs.slice(e0).map(x => x.slice(0, 200)) });
  }
  /* the Scout tab at an address */
  await page.evaluate(() => { location.hash = '#rooftops'; }); await wait(2500);
  const settle = async (max) => { const t0 = Date.now(); while (Date.now() - t0 < (max || 120000)) { await wait(2000); const st = await page.evaluate(() => MODI.rooftops.api.status()); if (!(st.queued + st.running) && !st.tiles.some(t => t.st === 'load' || t.st === 'queued') && st.tiles.some(t => t.st === 'ok' || t.st === 'err')) return st; } return null; };
  await page.fill('#scFind', ADDR); await page.press('#scFind', 'Enter'); const st = await settle(150000); await wait(3000);
  ok(st && st.tiles.some(t => t.st === 'ok'), 'scout loads buildings at ' + ADDR, st && { tiles: st.tiles.length, ok: st.tiles.filter(t => t.st === 'ok').length });
  const topo = await page.evaluate(() => ({ ctl: !!document.querySelector('.leaflet-control [class*="topo"], [class*="sc-topo"], [id*="Topo"], [id*="topo"]'), glob: Object.keys(window).filter(k => /TOPO/i.test(k)) }));
  ok(topo.ctl || topo.glob.length, 'topography block present', topo);
  await page.click('#scMode button[data-v="eng"]');
  let s = null;
  for (let i = 0; i < 40; i++) { await wait(3000); s = await page.evaluate(() => { const en = MODI.rooftops.api.en(); if (!en) return null; const st = en.state(); return { built: st.built, queued: st.queued, roads: st.roads, lat: +st.lat.toFixed(4), lon: +st.lon.toFixed(4), mode: st.mode, elev: st.elev, agl: st.agl }; }); if (s && s.built > 20 && !s.queued && s.roads && i > 5) break; }
  ok(s && s.built > 5, 'engine opens', s);
  await page.evaluate(() => MODI.rooftops.api.en().setGraphics({ q: 'low', sun: 15, life: true, wide: false }));
  const api = await page.evaluate(() => { const en = MODI.rooftops.api.en(); return { storm: typeof en.storm, wind: typeof en.wind, sky: typeof en.sky, air: typeof en.air, car: typeof en.car, uap: typeof en.uap, alta: typeof en.alta, STORM: (window.__SCOUT_ENGINE__.STORM || []).map(x => x.id || x.k || x.key), WIND: (window.__SCOUT_ENGINE__.WIND || []).map(x => x.id || x.k || x.key), gy: typeof en.world.gy, traffic: !!en.world.traffic, deckAt: typeof en.world.deckAt, patterns: en.lensPatterns }; });
  console.log('     api', JSON.stringify(api));
  ok(api.storm === 'function' && api.STORM.length === 9, 'weather scale has nine steps', api.STORM);
  if (api.wind === 'function') { const w = await page.evaluate(() => { const en = MODI.rooftops.api.en(); en.storm('ar3'); en.wind('sa2'); const a = en.state(); en.wind('calm'); return { stormKey: a.stormKey, windKey: a.windKey, windName: a.windName, gust: a.gustMph, alta: a.altaCanFly, weather: a.weather }; }); ok(w.stormKey === 'ar3' && w.windKey === 'sa2' && w.alta === false, 'rain and wind scales set', w); }
  const nofly = await page.evaluate(() => MODI.rooftops.api.en().NOFLY); ok(nofly === "Don't waste a $40,000 drone, stupid. Use the UAPs.", 'Alta X warning text', nofly);
  if (api.air === 'object') { const a = await page.evaluate(() => { const i = MODI.rooftops.api.en().air.info(); return { airport: i.airport || i.name || i.nearest, km: i.km || i.dist, flights: (i.flights || []).length, built: i.built }; }); ok(true, 'aircraft kit answers', a); }
  if (api.car === 'object') { await page.evaluate(() => MODI.rooftops.api.en().setHeight('m3')); await wait(6000); const c = await page.evaluate(() => { const st = MODI.rooftops.api.en().state(); return { mode: st.mode, car: st.car }; }); ok(c.mode === 'm3' && c.car, 'the M3 comes out', c); await page.evaluate(() => MODI.rooftops.api.en().setHeight('street')); }
  await page.evaluate(() => { const en = MODI.rooftops.api.en(); en.storm('dry'); en.setHeight('drone'); }); await wait(12000);
  const tr = await page.evaluate(() => { const en = MODI.rooftops.api.en(), w = en.world; const d = w.traffic && w.traffic.debug ? w.traffic.debug() : null; return { state: (({ mode, cars, elev, agl, air }) => ({ mode, cars, elev, agl, air }))(en.state()), traffic: d && JSON.stringify(d).slice(0, 300) }; });
  console.log('     scene', JSON.stringify(tr));
  const bar = await page.evaluate(() => { const b = document.querySelector('.sc-enbar, #scEnBar, .sc-en'); return b ? b.innerText.replace(/\s+/g, ' ').slice(0, 900) : null; });
  console.log('     bar:', bar);
  ok(bar && !BAN.test(bar), 'engine bar has no Louisiana or hurricane wording');
  const box = await page.evaluate(() => { const en = MODI.rooftops.api.en(); const c = (en.canvas && (typeof en.canvas === 'function' ? en.canvas() : en.canvas)) || en.engine.device.gl.canvas; c.scrollIntoView({ block: 'center' }); const r = c.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
  await wait(1500);
  try { await page.screenshot({ path: OUT, timeout: 240000, clip: { x: Math.max(0, box.x), y: Math.max(0, box.y), width: Math.min(900, box.width), height: Math.min(700, box.height) } }); console.log('     picture', OUT); } catch (e) { console.log('     no picture: ' + String(e).slice(0, 120)); }
  console.log('PAGE ERRORS:', errs.length ? errs.length + '\n' + [...new Set(errs)].slice(0, 12).join('\n') : 'none'); console.log(bad ? bad + ' FAILED' : 'all pass');
  await browser.close(); process.exit(bad || errs.length ? 1 : 0);
})().catch(e => { console.error('ERROR', e); process.exit(2); });
