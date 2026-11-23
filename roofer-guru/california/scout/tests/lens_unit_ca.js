/* Rooftop Scout, California: the roof views' readings without the engine. Opens the page at an address, takes the
   buildings read there and runs every roof view's begin / setPlanes / ready / vertex / legend / label on a house's
   roof of four planes, for the weather on each step of the rain scale and the dry wind scale, with and without snow
   and smoke. Checks: every reading is a finite number between 0 and 1, leak chance grows with the rain scale's rank,
   wind damage grows with the gust, snow reads only above the snow level, no legend says a word it must not.
   node lens_unit_ca.js <page.html> "<address>" */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2]), ADDR = process.argv[3] || '1626 N Las Palmas Ave, Los Angeles, CA';
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
  const browser = await chromium.launch({ proxy, args: ['--disable-gpu'] });
  const page = await (await browser.newContext({ viewport: { width: 1000, height: 800 } })).newPage();
  const errs = []; page.on('pageerror', e => errs.push('pageerror: ' + String((e && e.stack) || e).slice(0, 700)));
  await page.goto('file://' + FILE + '#rooftops', { waitUntil: 'load', timeout: 180000 });
  for (let i = 0; i < 30; i++) { if (await page.evaluate(() => typeof MODI !== 'undefined' && !!(MODI.rooftops && MODI.rooftops.api))) break; await wait(1500); }
  const settle = async (max) => { const t0 = Date.now(); while (Date.now() - t0 < (max || 120000)) { await wait(2000); const st = await page.evaluate(() => MODI.rooftops.api.status()); if (!(st.queued + st.running) && !st.tiles.some(t => t.st === 'load' || t.st === 'queued') && st.tiles.some(t => t.st === 'ok' || t.st === 'err')) return st; } return null; };
  await page.fill('#scFind', ADDR); await page.press('#scFind', 'Enter'); await settle(180000); await wait(2000);
  const out = await page.evaluate(() => {
    const api = MODI.rooftops.api, L = api.lens, bs = api.buildings().filter(b => b.roof && b.roof.keys && b.roof.keys.length), fails = [], ok = (c, m, x) => { if (!c) fails.push(m + (x !== undefined ? ' ' + JSON.stringify(x) : '')); };
    const s = Math.SQRT1_2 * 0.632, planes = [{ n: [0, 0.894, 0.447], area: 60 }, { n: [0, 0.894, -0.447], area: 60 }, { n: [0.447, 0.894, 0], area: 25 }, { n: [-0.447, 0.894, 0], area: 25 }], zone = { edge: 0.5, corner: 0.1, ridge: 0.3 };
    const ctx0 = { year: 8, lum: 0.35, canopy: 0.2, sun: { alt: 55, dir: [0.4, 0.82, 0.41] }, month: 6, hour: 14, sunAlt: 55, weather: 'clear', dayLabel: 'July 21', weatherLabel: 'clear sky' };
    const run = (lens, b, extra) => { const ctx = Object.assign({}, ctx0, extra || {}); let R = L.begin(lens, b, ctx); if (!R) return null; R.setPlanes(planes); R = L.ready(R); if (!R || !R.vertex) return null; const vs = planes.map(p => R.vertex(p.n, zone, 0.1, false)); return { R, vs, leg: L.legend(lens, R, ctx), label: L.label(lens, R) }; };
    const BAD = /hurricane|Louisiana|parish|Gulf|surge|Category|undefined|NaN|\[object/i, res = { n: bs.length, views: {}, steps: {} };
    const house = bs.find(b => b.cls === 'sf') || bs[0], big = bs.find(b => b.roof.slope === 'low') || bs[0];
    L.list.forEach(([k]) => { if (k === 'off') return; [house, big].forEach((b, i) => { let r = null; try { r = run(k, b); } catch (e) { fails.push(k + ' threw: ' + String(e.stack || e).slice(0, 300)); return; }
      ok(!!r, k + ' gave no reading for ' + b.cls); if (!r) return; r.vs.forEach(v => ok(v.length === 4 && v.every(Number.isFinite) && v[0] >= 0 && v[0] <= 1 && v[1] >= 0 && v[1] <= 1 && v[3] >= 0 && v[3] < L.pal.length, k + ' vertex out of range', v));
      ok(typeof r.leg === 'string' && r.leg.length > 80 && !BAD.test(r.leg.replace(/<[^>]+>/g, ' ')), k + ' legend', r.leg.replace(/<[^>]+>/g, ' ').slice(0, 200)); if (!i) res.views[k] = { label: r.label, v: r.vs[0].map(x => +x.toFixed(3)), leg: r.leg.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(-330) }; }); });
    /* the scales */
    const leaks = L.rain.map(st => { const r = run('storm', house, { stormStep: { id: st.id } }); return r ? +r.R.st.leak.toFixed(5) : null; }); res.steps.leak = leaks;
    for (let i = 4; i < leaks.length - 1; i++) ok(leaks[i + 1] >= leaks[i], 'leak chance falls from ' + L.rain[i].id + ' to ' + L.rain[i + 1].id, leaks);
    ok(leaks[0] === 0, 'dry has a leak chance', leaks[0]);
    const winds = L.wind.map(st => { const r = run('storm', house, { windStep: { id: st.id } }); return r ? +r.R.st.any.toFixed(6) : null; }); res.steps.wind = winds;
    for (let i = 0; i < winds.length - 1; i++) ok(winds[i + 1] >= winds[i], 'wind damage falls from ' + L.wind[i].id + ' to ' + L.wind[i + 1].id, winds);
    ok(winds[1] === 0 && winds[5] > 0 && winds[5] < 0.2, 'wind damage out of range', winds);
    const lo = run('storm', house, { stormStep: { id: 'ar4' }, wx: { elevationM: 300 } }), hi = run('storm', house, { stormStep: { id: 'ar4' }, wx: { elevationM: 2600 } });
    ok(lo && !lo.R.st.snowing, 'snow at 300 m'); ok(hi && hi.R.st.snowing && hi.R.st.add > 0, 'no snow at 2,600 m in a rank 4 atmospheric river', hi && hi.R.st);
    res.steps.snow = hi && { add: +hi.R.st.add.toFixed(1), pg: hi.R.st.pg, label: hi.label };
    const sm = run('storm', house, { sky: 'smoke', windStep: { id: 'sa3' } }); ok(sm && sm.R.st.ember > 0 && sm.R.st.ember <= 1, 'ember exposure', sm && sm.R.st.ember); res.steps.ember = sm && +sm.R.st.ember.toFixed(3);
    /* the fire view's classes add to one; the cool roof rule answers for every class */
    const fc = L.fireClass(house, api.outlook(house, {})); ok(Math.abs(fc.p.reduce((a, c) => a + c, 0) - 1) < 1e-6, 'fire classes do not add to one', fc.p); res.fire = fc.p.map(x => +x.toFixed(3));
    res.cool = [house, big].map(b => { const c = L.coolRule(b); return [b.cls, c.cz, c.slope, c.req ? c.req.sr : null]; });
    /* the sun on a plane: a south plane takes more than a north one, and both are in range */
    const sS = L.sunYear([0, 0.894, 0.447], house.lat, house.lon), sN = L.sunYear([0, 0.894, -0.447], house.lat, house.lon); ok(sS > sN && sN > 500 && sS < 2600, 'sun on the planes', [sS, sN]); res.sun = [Math.round(sS), Math.round(sN)];
    /* the outlook over every building: finite, between 0 and 1, and never falling with the years */
    let bad = 0; bs.forEach(b => { const O = api.outlook(b, {}); if (!O) return; const A = O.all; ['any', 'rep'].forEach(k => { for (let t = 1; t <= 15; t++) if (!(A[k][t] >= A[k][t - 1] - 1e-9) || !(A[k][t] >= 0 && A[k][t] <= 1)) bad++; }); ['wind', 'rain', 'fire', 'hail', 'wear'].forEach(c => { if (!(A.C[c][15] >= -1e-9 && A.C[c][15] <= 1)) bad++; }); });
    ok(bad === 0, 'outlook values out of order', bad); res.house = { addr: house.addr, yb: house.yb, keys: house.roof.keys.map(k => [k[0], +k[1].toFixed(2)]) };
    res.fails = fails; return res;
  });
  console.log(JSON.stringify(out, null, 1));
  console.log(out.fails.length ? 'FAIL ' + out.fails.length : 'PASS', '· PAGE ERRORS:', errs.length ? errs.join('\n') : 'none');
  await browser.close();
})().catch(e => { console.error('ERROR', e); process.exit(2); });
