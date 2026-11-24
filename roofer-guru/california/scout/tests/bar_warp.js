/* The engine bar against the real stack, part 3: the saucer and the Tic Tac warp to an address, to coordinates and to
   a mountain town, a desert town and the coast from the place list; the craft comes down over real ground at the right
   elevation, and the weather read-outs follow (snow at Mammoth under an AR3, rain at Palm Springs).
   node bar_warp.js <page.html> [shot dir] [only: comma list of step numbers] */
const L = require('./lib.js'), path = require('path');
const FILE = process.argv[2], DIR = process.argv[3] || '', ONLY = (process.argv[4] || '').split(',').filter(Boolean).map(Number);
const STEPS = [
  { how: 'address', q: '1315 10th St, Sacramento, CA', la: 38.5766, lo: -121.4934, elev: 8, tol: 15, craft: 'saucer' },
  { how: 'coords', q: '37.7456, -119.5936', la: 37.7456, lo: -119.5936, elev: 1209, tol: 40, craft: 'saucer', name: 'Yosemite Valley' },
  { how: 'place', q: 'Mammoth Lakes', la: 37.6485, lo: -118.9721, elev: 2400, tol: 90, craft: 'saucer', snowAt: 'ar3' },
  { how: 'place', q: 'Palm Springs', la: 33.8303, lo: -116.5453, elev: 146, tol: 30, craft: 'tictac', snowAt: 'ar3' },
  { how: 'place', q: 'Santa Cruz', la: 36.9741, lo: -122.0308, elev: 6, tol: 15, craft: 'tictac' },
];
(async () => {
  const { page, errs, close } = await L.launch({ w: 900, h: 720, hard: 22 }); const C = L.checker(), wait = L.wait;
  await L.openPage(page, FILE); await L.find(page, '1100 Orange Ave, Coronado, CA');
  const s0 = await L.engine(page, {}); C.ok(s0 && s0.built > 5, 'engine opens', s0);
  const ev = (f, a) => page.evaluate(f, a);
  const st = () => ev(() => { const en = MODI.rooftops.api.en(), s = en.state(), w = en.world; let ea = null; try { ea = w.elevAt ? w.elevAt(s.lat, s.lon) : null; } catch (e) { ea = 'err'; } let ti = null; try { ti = w.terr && w.terr.info ? w.terr.info() : null; } catch (e) { ti = null; }
    return { mode: s.mode, lat: +s.lat.toFixed(4), lon: +s.lon.toFixed(4), elev: s.elev != null ? Math.round(s.elev) : null, agl: s.agl != null ? +(+s.agl).toFixed(1) : null, ground: s.ground, terrain: typeof s.terrain === 'object' ? JSON.stringify(s.terrain).slice(0, 200) : s.terrain, elevAt: typeof ea === 'number' ? Math.round(ea) : ea, uap: s.uap && { mode: s.uap.mode, alt: Math.round(s.uap.alt), asl: s.uap.asl != null ? Math.round(s.uap.asl) : null, mph: Math.round(s.uap.speed * 2.237) }, built: s.built, queued: s.queued, roads: s.roads, precip: s.precip, snowM: s.snowLevelM, stormKey: s.stormKey, ti: ti && JSON.stringify(ti).slice(0, 260), warpDis: (document.querySelector('#scWarp') || {}).disabled, where: (document.querySelector('#scEnWhere') || {}).innerText.slice(0, 200), line: (document.querySelector('#scEnStormO') || {}).innerText.slice(0, 300), hud: (document.querySelector('.se-hud') || {}).innerText }; });
  await page.click('#scEnBar [data-h="saucer"]'); await wait(5000); let s = await st(); C.ok(s.mode === 'saucer' && s.uap, 'the saucer comes out by its button', s.uap);
  const form = await ev(() => { const f = document.querySelector('#scWarpF'); return f && { label: f.querySelector('label').textContent, ph: f.querySelector('input').placeholder, places: f.querySelectorAll('option').length - 1 }; }); C.ok(form && form.places > 40, 'the warp form and its place list', form);
  const dist = (a, b, c, d) => Math.hypot((a - c) * 111000, (b - d) * 111000 * Math.cos(a * Math.PI / 180));
  for (let i = 0; i < STEPS.length; i++) { const T = STEPS[i]; if (ONLY.length && !ONLY.includes(i)) continue;
    if (T.craft !== (await st()).mode) { await page.click('#scEnBar [data-h="' + T.craft + '"]'); await wait(5000); s = await st(); C.ok(s.mode === T.craft, 'the ' + T.craft + ' comes out by its button', s.uap); }
    await ev(() => document.querySelector('#scEnBar').scrollIntoView({ block: 'start' }));
    if (T.how === 'place') await page.selectOption('#scWarpTo', { label: T.q }); else { await page.fill('#scWarp', T.q); await page.press('#scWarp', 'Enter'); }
    let there = false, t0 = Date.now(); for (let k = 0; k < 60; k++) { await wait(3000); s = await st(); if (dist(s.lat, s.lon, T.la, T.lo) < 400 && s.warpDis === false && s.uap && s.uap.mph < 30) { there = true; break; } }
    const took = Math.round((Date.now() - t0) / 1000);
    /* the ground firms up as tiles arrive, the buildings come in */
    for (let k = 0; k < 14; k++) { await wait(3000); s = await st(); if (s.built > 3 && !s.queued) break; }
    C.ok(there, 'warp by ' + T.how + ' to ' + (T.name || T.q) + ' (' + T.craft + ')', { took, lat: s.lat, lon: s.lon, off: Math.round(dist(s.lat, s.lon, T.la, T.lo)) });
    C.ok(s.ground != null && Math.abs(s.ground - T.elev) <= T.tol, '  ground elevation there', { ground: Math.round(s.ground), camera: s.elev, want: T.elev, elevAt: s.elevAt, agl: s.agl, uap: s.uap, ground: s.ground, terrain: s.terrain, built: s.built, ti: s.ti });
    C.ok(s.uap && s.uap.alt > 1 && s.uap.alt < 400 && (s.uap.asl == null || Math.abs(s.uap.asl - s.uap.alt - T.elev) < T.tol + 25), '  the craft stands over the ground, not under it or at sea level', s.uap);
    C.ok(new RegExp('ground ' + (Math.round(s.ground * 3.281 / 10) * 10).toLocaleString('en-US') + ' ft').test(s.where), '  the bar gives the ground height in feet', s.where);
    if (T.snowAt) { await page.focus('#scEnRain'); for (let k = 0; k < 6; k++) { await page.keyboard.press('ArrowRight'); await wait(700); } await wait(2500); const w = await st(); const want = T.elev >= 2200 ? 'snow' : 'rain';
      C.ok(w.stormKey === 'ar3' && w.snowM === 2200 && w.precip === want, '  AR3 there: ' + want, { precip: w.precip, snowM: w.snowM, ground: Math.round(w.ground), line: w.line });
      if (DIR) await L.shot(page, path.join(DIR, 'warp_' + T.q.replace(/\W+/g, '_') + '_ar3.png'));
      await page.focus('#scEnRain'); await page.keyboard.press('Home'); await wait(1500); }
    else if (DIR) await L.shot(page, path.join(DIR, 'warp_' + (T.name || T.q).replace(/\W+/g, '_').slice(0, 24) + '.png'));
  }
  /* outside the state, and a bad address */
  await ev(() => document.querySelector('#scEnBar').scrollIntoView({ block: 'start' })); await page.fill('#scWarp', '36.17, -115.14'); await page.press('#scWarp', 'Enter'); await wait(2500);
  const t = await ev(() => [...document.querySelectorAll('.toast, [class*="toast"]')].map(e => e.textContent).filter(Boolean).slice(-1)[0]); C.ok(/outside the state/.test(t || ''), 'Las Vegas is refused: California only', t);
  console.log('PAGE ERRORS:', errs.length ? errs.length + '\n' + [...new Set(errs)].slice(0, 8).join('\n') : 'none'); console.log(C.bad ? C.bad + ' FAILED' : 'all pass');
  await close(); process.exit(C.bad || errs.length ? 1 : 0);
})().catch(e => { console.error('ERROR', e); process.exit(2); });
