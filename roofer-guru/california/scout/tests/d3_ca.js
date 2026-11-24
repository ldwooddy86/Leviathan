/* The three.js 3D view and Google's Street View in California, and the 3D view's drawing of the traffic job's road
   kinds. Overpass is answered from the saved boxes (CA/dl/scout/streets), cut to the box asked, as the traffic job's
   tests do, so a freeway, its ramps and the cable car tracks are in the answer whatever the network does.
   node d3_ca.js <page.html> <outdir> */
const L = require('./lib.js'), path = require('path'), fs = require('fs');
const FILE = process.argv[2], OUT = path.resolve(process.argv[3] || '.'); fs.mkdirSync(OUT, { recursive: true });
const DL = path.resolve(__dirname, '..', '..', 'dl', 'scout', 'streets'), saved = {};
const load = n => saved[n] || (saved[n] = JSON.parse(fs.readFileSync(path.join(DL, 'overpass_' + n + '.json'), 'utf8')).elements);
(async () => {
  const { page, errs, close } = await L.launch({ w: 1100, h: 900, hard: 16 }); const wait = L.wait, C = L.checker(), asks = [];
  await page.route(/overpass|maps\.mail\.ru/, async route => { const q = decodeURIComponent((route.request().postData() || '').replace(/^data=/, '')), m = /\(([-\d.]+),([-\d.]+),([-\d.]+),([-\d.]+)\)/.exec(q); if (!m) return route.fulfill({ status: 400, body: 'bad' });
    const [s, w, n, e] = m.slice(1).map(Number), box = s > 36 ? 'sf_northeast' : s > 33.5 ? 'la_central' : 'coronado', only = /\^motorway/.test(q), els = load(box).filter(el => el.type === 'way' ? (el.geometry && (only ? /^motorway/.test((el.tags || {}).highway || '') : ((el.tags || {}).highway || ((el.tags || {}).railway === 'tram' && (el.tags || {}).cable_tram))) && el.geometry.some(g => g.lat > s && g.lat < n && g.lon > w && g.lon < e)) : el.type === 'node' && !only && el.tags && /^(traffic_signals|stop)$/.test(el.tags.highway || '') && el.lat > s && el.lat < n && el.lon > w && el.lon < e);
    asks.push((only ? 'freeways ' : 'streets ') + els.length); return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ elements: els }) }); });
  await L.openPage(page, FILE);
  const open3d = async (addr, tag) => {
    await page.evaluate(() => { const b = document.querySelector('#scMode button[data-v="map"]'); if (b) b.click(); }); await wait(1500);
    await L.find(page, addr); const name = await page.evaluate(() => document.querySelector('#scName').textContent);
    await page.evaluate(() => { setTimeout(() => document.querySelector('#scMode button[data-v="3d"]').click(), 0); });
    let st = null; const t0 = Date.now();
    while (Date.now() - t0 < 200000) { await wait(4000); st = await page.evaluate(() => { const d = MODI.rooftops.api.d3(); if (!d) return null; const s = d.state(), g = d.graphics ? d.graphics() : {}; return { built: s.built, roads: s.roads, done: s.roadsDone, mode: s.mode, road: s.road, kind: s.roadKind, note: (document.querySelector('#sc3dNote') || {}).textContent, q: g.label, info: d.roadsInfo ? d.roadsInfo() : null }; }).catch(() => null); if (st && st.built > 0 && st.done) break; }
    C.ok(st && st.built > 0 && st.roads > 0, tag + ': the 3D view opens at ' + name, st);
    await page.evaluate(() => { const d = MODI.rooftops.api.d3(); d.setGraphics({ q: 'medium', ai: false }); d.setHeight('bird'); }); await wait(9000);
    await page.evaluate(() => document.querySelector('#sc3d, .sc-3d').scrollIntoView({ block: 'center' })); await wait(800);
    const box = await page.evaluate(() => { const c = document.querySelector('#sc3d canvas, .sc-3d canvas'); const r = c.getBoundingClientRect(); return { x: Math.max(0, r.x), y: Math.max(0, r.y), width: Math.min(innerWidth, r.width), height: Math.min(innerHeight - Math.max(0, r.y), r.height) }; });
    await L.shot(page, path.join(OUT, 'd3_' + tag + '_bird.png'), box);
    await page.evaluate(() => MODI.rooftops.api.d3().setHeight('drone')); await wait(7000); await L.shot(page, path.join(OUT, 'd3_' + tag + '_drone.png'), box);
    return st;
  };
  /* San Francisco, California St at Powell: two cable car lines cross here */
  let s = await open3d('900 California St, San Francisco, CA', 'sf_cable');
  C.ok(s && s.info && s.info.cable > 0 && !('cable' in s.info.kinds), 'cable car tracks are rails on the street, not streets', s && s.info);
  /* Coronado side of the bridge: State Route 75 and the bridge's freeway */
  s = await open3d('1100 Orange Ave, Coronado, CA', 'coronado');
  console.log('     roads at Coronado', JSON.stringify(s && s.info));
  /* Los Angeles, by the 101 at Hollywood */
  s = await open3d('1750 N Argyle Ave, Los Angeles, CA', 'la_101');
  C.ok(s && s.info && (s.info.kinds.freeway > 0 || s.info.kinds.ramp > 0), 'a freeway and its ramps are kinds of their own in the 3D view', s && s.info);
  const walk = await page.evaluate(() => { const d = MODI.rooftops.api.d3(); d.setHeight('street'); const st = d.state(); return { mode: st.mode, road: st.road, kind: st.roadKind }; });
  C.ok(walk.kind !== 'freeway' && walk.kind !== 'ramp', 'the walk starts on a street, not on the freeway', walk);
  /* glTF export still works */
  const glb = await page.evaluate(async () => { const d = MODI.rooftops.api.d3(); try { const b = await d.exportGLB(); return b.size; } catch (e) { return 'failed: ' + e.message; } }); C.ok(glb > 10000, 'glTF export', glb);
  /* Street View: without a key the card shows Google's embedded player aimed from the street */
  await page.evaluate(() => { setTimeout(() => document.querySelector('#scMode button[data-v="sv"]').click(), 0); }); await wait(6000);
  const sv = await page.evaluate(() => { const f = document.querySelector('#scSvW iframe, .sc-svf iframe, iframe[src*="google"]'), a = [...document.querySelectorAll('a[href*="google.com/maps"]')].map(x => x.href)[0], note = (document.querySelector('#scModeNote') || {}).textContent, st = MODI.rooftops.api.sv(); return { iframe: f ? f.src.slice(0, 160) : null, link: a ? a.slice(0, 160) : null, note: (note || '').slice(0, 160), sv: st }; });
  C.ok((sv.iframe && /google\.com\/maps/.test(sv.iframe)) || sv.link, 'Street View opens for the building', sv);
  await page.screenshot({ path: path.join(OUT, 'sv_la.png'), timeout: 60000 }).catch(() => 0);
  console.log('     overpass asks', asks.join(', '));
  console.log('PAGE ERRORS:', errs.length ? errs.length + '\n' + [...new Set(errs)].slice(0, 8).join('\n') : 'none'); console.log(C.bad ? C.bad + ' FAILED' : 'all pass');
  await close(); process.exit(C.bad || errs.length ? 1 : 0);
})().catch(e => { console.error('ERROR', e); process.exit(2); });
