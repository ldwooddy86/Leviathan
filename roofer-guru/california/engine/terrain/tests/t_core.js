/* Core check at one place: the ground's height under the camera against the known elevation, a building's base on the
   ground, no page errors, one picture.
   node t_core.js <page.html> "<address>" <lat> <lon> <known metres> <tolerance> <out.png> [mode] [yaw] [pitch] */
const L = require('./lib.js'), { ok } = L;
const [FILE, ADDR, LAT, LON, KNOWN, TOL, OUT, MODE, YAW, PITCH] = process.argv.slice(2);
(async () => {
  const T = await L.start(FILE, ADDR, { gfx: MODE === 'metro' || MODE === 'bird' ? { wide: true } : null });
  await T.open(+LAT, +LON, +(YAW || 0), { mode: MODE || 'street' }); if (PITCH != null) await T.ev(p => { const en = MODI.rooftops.api.en(); en.world.pitch = p; en.engine.requestRender(3); }, +PITCH);
  const s = await T.ready(120000, true); console.log('ready', JSON.stringify(s));
  const r = await T.ev(a => { const en = MODI.rooftops.api.en(), S = en.world, st = en.state(), q = S.toL(a[0], a[1]);
    const ph = en.engine.physics, pr = ph.prisms.slice(0, 400).map(p => { let lo = 1e9, hi = -1e9; p.ring.forEach(c => { const y = S.gy(c[0], c[1]); if (y < lo) lo = y; if (y > hi) hi = y; }); return { foot: p.y0 - lo, floorOverHigh: null, lo, hi, y0: p.y0 }; });
    const lab = en.debug().cells.length;
    return { gyAt: S.gy(q[0], q[1]) + S.y0, elevAt: S.elevAt(a[0], a[1]), y0: S.y0, st: { elev: st.elev, agl: st.agl, ground: st.ground, mode: st.mode, built: st.built, t: st.terrain }, prisms: ph.prisms.length, footMin: Math.min(...pr.map(p => p.foot)), footMax: Math.max(...pr.map(p => p.foot)), cells: lab, far: en.debug().far }; }, [+LAT, +LON]);
  console.log(JSON.stringify(r));
  ok(Math.abs(r.gyAt - KNOWN) <= +TOL, 'ground under the place is ' + r.gyAt.toFixed(1) + ' m above the sea (known ' + KNOWN + ', within ' + TOL + ')');
  ok(Math.abs(r.elevAt - r.gyAt) < 3, 'S.elevAt agrees with the drawn ground', [r.elevAt, r.gyAt]);
  ok(r.st.t.ok > 0 && !r.st.t.loading, 'elevation tiles loaded', r.st.t);
  if (r.prisms) ok(r.footMax <= -0.9 && r.footMin > -60, 'every building\'s solid starts below the lowest ground under it', [r.footMin, r.footMax]);
  if (!MODE || MODE === 'street') ok(Math.abs(r.st.agl - 1.7) < 0.2, 'the eye is 1.7 m above the ground', r.st.agl);
  await T.shot(OUT, 9000);
  ok(!T.errs.length, 'no page errors', T.errs.slice(0, 3));
  await T.browser.close(); process.exit(L.bad() ? 1 : 0);
})().catch(e => { console.error('ERROR', e); process.exit(2); });
