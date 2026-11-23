/* Moving on the ground: a walk down and up Filbert Street, the Alta X flown up the same slope, a warp between two places
   at different elevations, and a change of origin (every 12 km) that must not move any height.
   The engine's clock is stepped by hand (its own 'update' is called with a fixed step while its frame loop is stopped):
   the software renderer here draws a frame in seconds, and a test that waits on real frames measures the renderer.
   node t_move.js <page.html> <shots dir> */
const L = require('./lib.js'), { ok, wait } = L;
const FILE = process.argv[2], SH = process.argv[3] || '.';
(async () => {
  const T = await L.start(FILE, '1000 Filbert St, San Francisco, CA');
  await T.open(37.80016, -122.41857, 90, { mode: 'street' }); await T.ready(120000, true);
  const hyde = await T.ev(() => { const st = MODI.rooftops.api.en().state(); return [st.lat, st.lon]; });
  await T.open(37.8003, -122.4169, 279, { mode: 'street' }); await wait(2000);
  const leav = await T.ev(() => { const st = MODI.rooftops.api.en().state(); return [st.lat, st.lon]; });
  await T.open(hyde[0], hyde[1], 90, { mode: 'street' }); await wait(2000);
  const bearing = await T.ev(a => { const S = MODI.rooftops.api.en().world, p = S.toL(a[0][0], a[0][1]), q = S.toL(a[1][0], a[1][1]); return (Math.atan2(q[0] - p[0], -(q[1] - p[1])) * 180 / Math.PI + 360) % 360; }, [hyde, leav]); console.log('Filbert runs', bearing.toFixed(1), 'degrees from Hyde to Leavenworth', JSON.stringify(hyde), JSON.stringify(leav));
  /* n steps of dt seconds of the engine's own update, with the frame loop stopped; what(en) is read after every k-th step */
  const step = (n, dt, k, what) => T.ev(a => { const en = MODI.rooftops.api.en(), E = en.engine, f = new Function('en', 'return (' + a[3] + ')(en)'), out = []; E.stop(); E.playing = true; for (let i = 0; i < a[0]; i++) { E.emit('update', a[1]); if (i % a[2] === a[2] - 1) out.push(f(en)); } return out; }, [n, dt, k, String(what)]);
  const settle = async () => { for (let i = 0; i < 40; i++) { await wait(700); const s = await T.ev(() => { const en = MODI.rooftops.api.en(); for (let q = 0; q < 30; q++) en.engine.emit('update', 0.001); const st = en.state(); return st.terrain.loading + st.terrain.queue + st.queued; }); if (!s && i > 2) break; } };
  const show = async file => { await T.ev(() => { const en = MODI.rooftops.api.en(); en.engine.playing = false; en.start(); en.engine.requestRender(4); }); await T.shot(file, 9000); };

  /* 1. walking: east down Filbert from Hyde (a 31 percent grade), then back up; the feet stay on the ground */
  const feet = en => { const S = en.world; return { x: +S.x.toFixed(1), z: +S.z.toFixed(1), feet: +(S.y - S.gy(S.x, S.z)).toFixed(3), g: +(S.gy(S.x, S.z) + S.y0).toFixed(1) }; };
  await T.ev(a => { const en = MODI.rooftops.api.en(); en.engine.stop(); en.setHeight('walk'); en.world.yaw = a; en.world.keys.fwd = true; }, bearing);
  const g0 = (await step(1, 0.02, 1, feet))[0], dn = await step(500, 0.04, 10, feet);
  await T.ev(a => { MODI.rooftops.api.en().world.yaw = (a + 180) % 360; }, bearing); const up = await step(500, 0.04, 10, feet);
  await T.ev(() => { MODI.rooftops.api.en().world.keys.fwd = false; });
  console.log('walk down', JSON.stringify(dn.filter((_, i) => i % 10 === 9))); console.log('walk up  ', JSON.stringify(up.filter((_, i) => i % 10 === 9)));
  const all = dn.concat(up), end = dn[dn.length - 1], moved = Math.hypot(end.x - g0.x, end.z - g0.z), drop = g0.g - end.g, back = up[up.length - 1].g - end.g;
  ok(moved > 40 && drop > 8, 'walked ' + moved.toFixed(0) + ' m down the street and came down ' + drop.toFixed(1) + ' m');
  ok(back > 8, 'walked back up ' + back.toFixed(1) + ' m');
  ok(all.every(s => s.feet > -0.01), 'the feet were never under the ground', Math.min(...all.map(s => s.feet)));
  ok(all.filter(s => Math.abs(s.feet) < 0.02).length >= all.length * 0.9, 'the feet were on the ground at ' + all.filter(s => Math.abs(s.feet) < 0.02).length + ' of ' + all.length + ' looks (the rest: on a kerb or a roof)', Math.max(...all.map(s => s.feet)));
  await show(SH + '/sf_walk_filbert.png');

  /* 2. the Alta X: taken off at Leavenworth, sent up Filbert to Hyde 4 m over the street; the hill comes up under it and it rides up the face */
  await T.open(leav[0], leav[1], 279, { mode: 'street' }); await settle();
  await T.ev(() => { const en = MODI.rooftops.api.en(); en.engine.stop(); en.setHeight('alta'); });
  const alta = en => { const S = en.world, A = en.alta.craft.state; return { mode: A.mode, x: +A.x.toFixed(1), over: +(A.y - S.gy(A.x, A.z)).toFixed(2), g: +(S.gy(A.x, A.z) + S.y0).toFixed(1), alt: +en.state().alta.alt.toFixed(2) }; };
  const a0 = await step(400, 0.04, 40, alta);
  await T.ev(h => { const en = MODI.rooftops.api.en(), A = en.alta.craft, q = en.world.toL(h[0], h[1]); A.state.y = en.world.gy(A.state.x, A.state.z) + 4; A.state.mode = 'Position hold'; A.goTo(q[0], q[1]); }, hyde);
  const al = await step(900, 0.04, 30, alta);
  console.log('alta takeoff', JSON.stringify(a0.slice(-2))); console.log('alta flight', JSON.stringify(al.filter((_, i) => i % 4 === 3)));
  ok(Math.abs(al[al.length - 1].x - al[0].x) > 40, 'the drone flew ' + Math.abs(al[al.length - 1].x - al[0].x).toFixed(0) + ' m up the street');
  ok(al.every(a => a.over > -0.01) && a0.every(a => a.over > -0.01), 'the drone was never under the ground', Math.min(...al.map(a => a.over)));
  ok(al.filter(a => a.mode === 'Go to').every(a => a.over > 1.5), 'and kept clear of the rising street on its way', Math.min(...al.filter(a => a.mode === 'Go to').map(a => a.over)));
  ok(al[al.length - 1].g - al[0].g > 8, 'the ground under it rose ' + (al[al.length - 1].g - al[0].g).toFixed(1) + ' m and it rose with it');
  ok(al.every(a => Math.abs(a.alt - a.over) < 0.01), 'state().alta.alt is its height above the ground');
  await show(SH + '/sf_alta_filbert.png');

  /* 3. gravity warp: San Francisco to Mammoth Lakes (2,399 m): it arrives over the ground there */
  await T.ev(() => { const en = MODI.rooftops.api.en(); en.engine.stop(); en.setHeight('saucer'); });
  const uap = en => { const st = en.state(); return { alt: +st.uap.alt.toFixed(1), asl: +st.uap.asl.toFixed(1), y0: en.world.y0, warp: st.uap.warp }; };
  const before = (await step(50, 0.04, 50, uap))[0];
  await T.ev(() => MODI.rooftops.api.en().uap.warp(37.6485, -118.9721)); await wait(4000);     /* the tiles at the place are asked for as it turns */
  for (let i = 0; i < 12; i++) { const w = await step(40, 0.04, 40, uap); if (!w[0].warp) break; }
  const land = (await step(5, 0.04, 5, uap))[0]; await settle(); await step(50, 0.04, 50, uap);
  const aft = await T.ev(() => { const en = MODI.rooftops.api.en(), st = en.state(), S = en.world, q = S.toL(37.6485, -118.9721); return { alt: st.uap.alt, asl: st.uap.asl, y0: S.y0, ground: S.gy(q[0], q[1]) + S.y0, lat: st.lat, lon: st.lon, t: st.terrain }; });
  console.log('warp', JSON.stringify(before), JSON.stringify(land), JSON.stringify(aft));
  ok(Math.abs(aft.lat - 37.6485) < 0.01 && Math.abs(aft.ground - 2399.2) < 8, 'the ground at Mammoth Lakes is ' + aft.ground.toFixed(1) + ' m (known 2399.2)');
  ok(land.alt > 25 && land.alt < 110, 'the saucer came out of the warp ' + land.alt + ' m over the ground as it was known then (' + land.asl + ' m above the sea; it left from ' + before.asl + ')');
  ok(aft.alt > 20 && aft.alt < 130, 'and hangs ' + aft.alt.toFixed(1) + ' m over the ground once all the elevation is in');
  ok(Math.abs(aft.y0 - 2399) < 200, 'the datum moved with the origin', [before.y0, aft.y0]);
  await show(SH + '/mammoth_saucer_after_warp.png');

  /* 4. a change of origin while flying: the craft is put 11.95 km east of the origin, read, then pushed past 12 km; its height above the sea and above the ground are the same after */
  await T.ev(() => { const en = MODI.rooftops.api.en(), U = en.uap.craft.state, S = en.world; en.engine.stop(); U.x = 11950; U.z = 0; U.vx = U.vz = U.vy = 0; U.target = null; U.y = S.gy(U.x, U.z) + 300; });
  await step(5, 0.02, 5, uap); await settle();
  const rd = en => { const st = en.state(), S = en.world; return { lat0: S.lat0, lon0: S.lon0, y0: S.y0, asl: st.uap.asl, alt: st.uap.alt, ll: [st.lat, st.lon], raw: S.elevAt(st.lat, st.lon), x: en.uap.craft.state.x }; };
  const r0 = (await step(3, 0.02, 3, rd))[0];
  await T.ev(() => { MODI.rooftops.api.en().uap.craft.state.x = 12080; });
  const r1 = (await step(3, 0.02, 3, rd))[0]; await settle();
  const r2 = (await step(3, 0.02, 3, rd))[0], at0 = await T.ev(a => { const S = MODI.rooftops.api.en().world, q = S.toL(a[0], a[1]); return S.gy(q[0], q[1]) + S.y0; }, r0.ll);
  console.log('recentre', JSON.stringify(r0), JSON.stringify(r1), JSON.stringify(r2), at0);
  ok(r1.lon0 !== r0.lon0 && Math.abs(r1.x) < 400, 'past 12 km the origin moved to the craft', [r0.lon0, r1.lon0, r1.x]);
  ok(r1.y0 !== r0.y0, 'the datum changed (' + r0.y0 + ' to ' + r1.y0 + ' m)');
  ok(Math.abs(r1.asl - r0.asl) < 1.5 && Math.abs(r2.asl - r0.asl) < 1.5, 'the craft is as high above the sea as before', [r0.asl, r1.asl, r2.asl]);
  ok(Math.abs(r2.alt - r2.asl + r2.raw) < 4, 'and as high above the ground under it', [r2.alt, r2.asl - r2.raw]);
  ok(Math.abs(at0 - r0.raw) < 5, 'the ground where it was reads the same from the new origin', [r0.raw, at0]);
  ok(!T.errs.length, 'no page errors', T.errs.slice(0, 3));
  await T.browser.close(); process.exit(L.bad() ? 1 : 0);
})().catch(e => { console.error('ERROR', e); process.exit(2); });
