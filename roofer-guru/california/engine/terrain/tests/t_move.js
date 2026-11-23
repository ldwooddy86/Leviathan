/* Moving on the ground: a walk down and up Filbert Street, the Alta X flown up a slope, a warp between two places at
   different elevations, and a change of origin (every 12 km) that must not move any height.
   node t_move.js <page.html> <shots dir> */
const L = require('./lib.js'), { ok, wait } = L;
const FILE = process.argv[2], SH = process.argv[3] || '.';
(async () => {
  const T = await L.start(FILE, '1000 Filbert St, San Francisco, CA');
  await T.open(37.80016, -122.41857, 90, { mode: 'street' }); await T.ready(120000, true);
  const hyde = await T.ev(() => { const st = MODI.rooftops.api.en().state(); return [st.lat, st.lon]; });

  /* 1. walking: east down Filbert from Hyde (a 31 percent grade), then back up; the feet stay on the ground */
  const walk = async (yaw, secs) => { await T.ev(y => { const en = MODI.rooftops.api.en(); en.setHeight('walk'); en.world.yaw = y; en.canvas.focus(); en.engine.playing = true; en.hold('fwd', true); }, yaw); const out = [];
    for (let i = 0; i < secs; i++) { await wait(1000); out.push(await T.ev(() => { const en = MODI.rooftops.api.en(), S = en.world, st = en.state(); return { x: +S.x.toFixed(1), z: +S.z.toFixed(1), feet: +(S.y - S.gy(S.x, S.z)).toFixed(3), agl: +st.agl.toFixed(2), ground: +st.ground.toFixed(1) }; })); }
    await T.ev(() => MODI.rooftops.api.en().hold('fwd', false)); return out; };
  const w0 = await T.ev(() => { const en = MODI.rooftops.api.en(); en.setHeight('walk'); return en.state().ground; });
  const dn = await walk(90, 22), up = await walk(270, 22);
  console.log('walk down', JSON.stringify(dn.filter((_, i) => i % 4 === 3))); console.log('walk up  ', JSON.stringify(up.filter((_, i) => i % 4 === 3)));
  const all = dn.concat(up), moved = Math.hypot(dn[dn.length - 1].x - dn[0].x, dn[dn.length - 1].z - dn[0].z), drop = w0 - dn[dn.length - 1].ground, back = up[up.length - 1].ground - dn[dn.length - 1].ground;
  ok(moved > 8 && drop > 1.5, 'walked ' + moved.toFixed(0) + ' m down the street and came down ' + drop.toFixed(1) + ' m');
  ok(back > 1, 'walked back up ' + back.toFixed(1) + ' m');
  ok(all.every(s => s.feet > -0.05 && s.feet < 3.5), 'the feet were never under the ground (or more than a step and a roof above it)', [Math.min(...all.map(s => s.feet)), Math.max(...all.map(s => s.feet))]);
  ok(all.filter(s => Math.abs(s.feet) < 0.05).length >= all.length * 0.8, 'the feet were on the ground at ' + all.filter(s => Math.abs(s.feet) < 0.05).length + ' of ' + all.length + ' looks');
  await T.shot(SH + '/sf_walk_filbert.png', 3000);

  /* 2. the Alta X: taken off at Hyde, sent 160 m west along Filbert and up the hill's own slope from Leavenworth; it never goes under the ground */
  await T.open(37.8003, -122.4169, 270, { mode: 'street' }); await T.ready(60000, true);
  await T.ev(() => { const en = MODI.rooftops.api.en(); en.setHeight('alta'); en.engine.playing = true; });
  const al = []; let sent = false;
  for (let i = 0; i < 46; i++) { await wait(1000); const a = await T.ev(() => { const en = MODI.rooftops.api.en(), S = en.world, A = en.alta.craft.state; return { mode: A.mode, x: +A.x.toFixed(1), y: +A.y.toFixed(1), over: +(A.y - S.gy(A.x, A.z)).toFixed(2), g: +(S.gy(A.x, A.z) + S.y0).toFixed(1), alt: +en.state().alta.alt.toFixed(2) }; }); al.push(a);
    if (!sent && a.mode !== 'Taking off' && a.mode !== 'Landed' && i > 3) { sent = true; await T.ev(h => { const en = MODI.rooftops.api.en(), A = en.alta.craft, q = en.world.toL(h[0], h[1]); A.state.y = en.world.gy(A.state.x, A.state.z) + 4; A.goTo(q[0], q[1]); }, hyde); } }
  console.log('alta', JSON.stringify(al.filter((_, i) => i % 5 === 4)));
  ok(sent && Math.abs(al[al.length - 1].x - al[5].x) > 30, 'the drone flew ' + Math.abs(al[al.length - 1].x - al[5].x).toFixed(0) + ' m along the street');
  ok(al.every(a => a.over > -0.05), 'the drone was never under the ground', Math.min(...al.map(a => a.over)));
  ok(al[al.length - 1].g - Math.min(...al.map(a => a.g)) > 3, 'the ground under it rose ' + (al[al.length - 1].g - Math.min(...al.map(a => a.g))).toFixed(1) + ' m and it rose with it');
  await T.shot(SH + '/sf_alta_filbert.png', 2000);

  /* 3. gravity warp: San Francisco (86 m) to Mammoth Lakes (2,399 m): it arrives over the ground there */
  await T.ev(() => { const en = MODI.rooftops.api.en(); en.setHeight('saucer'); en.engine.playing = true; }); await wait(3000);
  const before = await T.ev(() => { const st = MODI.rooftops.api.en().state(); return { alt: st.uap.alt, asl: st.uap.asl, y0: MODI.rooftops.api.en().world.y0 }; });
  await T.ev(() => MODI.rooftops.api.en().uap.warp(37.6485, -118.9721));
  for (let i = 0; i < 90; i++) { await wait(1500); if (!(await T.ev(() => MODI.rooftops.api.en().uap.warping))) break; }
  const rdy = await T.ready(90000, false); await wait(4000);
  const aft = await T.ev(() => { const en = MODI.rooftops.api.en(), st = en.state(), S = en.world, q = S.toL(37.6485, -118.9721); return { alt: st.uap.alt, asl: st.uap.asl, y0: S.y0, ground: S.gy(q[0], q[1]) + S.y0, lat: st.lat, lon: st.lon, t: st.terrain }; });
  console.log('warp', JSON.stringify(before), JSON.stringify(aft));
  ok(Math.abs(aft.ground - 2399.2) < 8, 'the ground at Mammoth Lakes is ' + aft.ground.toFixed(1) + ' m (known 2399.2)');
  ok(aft.alt > 20 && aft.alt < 110, 'the saucer hangs ' + aft.alt.toFixed(1) + ' m over the ground there (' + aft.asl.toFixed(0) + ' m above the sea; it left from ' + before.asl.toFixed(0) + ')');
  ok(Math.abs(aft.y0 - 2399) < 150, 'the datum moved with the origin', [before.y0, aft.y0]);
  await T.shot(SH + '/mammoth_saucer_after_warp.png', 9000);

  /* 4. a change of origin while flying: the craft is put 11.95 km east of the origin, read, then pushed past 12 km; its height above the sea and above the ground are the same after */
  await T.ev(() => { const en = MODI.rooftops.api.en(), U = en.uap.craft.state, S = en.world; U.x = 11950; U.z = 0; U.vx = U.vz = U.vy = 0; U.y = S.gy(U.x, U.z) + 300; }); await wait(5000); await T.ready(60000, false);
  const r0 = await T.ev(() => { const en = MODI.rooftops.api.en(), st = en.state(), S = en.world, U = en.uap.craft.state, ll = [st.lat, st.lon]; return { lat0: S.lat0, lon0: S.lon0, y0: S.y0, asl: st.uap.asl, alt: st.uap.alt, ll, raw: S.elevAt(ll[0], ll[1]) }; });
  await T.ev(() => { const en = MODI.rooftops.api.en(), U = en.uap.craft.state; U.x = 12080; });
  for (let i = 0; i < 40; i++) { await wait(1000); if (await T.ev(a => MODI.rooftops.api.en().world.lon0 !== a, r0.lon0)) break; }
  const r1 = await T.ev(() => { const en = MODI.rooftops.api.en(), st = en.state(), S = en.world; return { lat0: S.lat0, lon0: S.lon0, y0: S.y0, asl: st.uap.asl, alt: st.uap.alt, ll: [st.lat, st.lon], x: en.uap.craft.state.x }; });
  await T.ready(60000, false);
  const r2 = await T.ev(a => { const en = MODI.rooftops.api.en(), st = en.state(), S = en.world, q = S.toL(a[0], a[1]); return { asl: st.uap.asl, alt: st.uap.alt, at0: S.gy(q[0], q[1]) + S.y0 }; }, r0.ll);
  console.log('recentre', JSON.stringify(r0), JSON.stringify(r1), JSON.stringify(r2));
  ok(r1.lon0 !== r0.lon0 && Math.abs(r1.x) < 400, 'the origin moved to the craft');
  ok(r1.y0 !== r0.y0, 'the datum changed (' + r0.y0 + ' to ' + r1.y0 + ' m)');
  ok(Math.abs(r1.asl - r0.asl) < 1.5 && Math.abs(r2.asl - r0.asl) < 1.5, 'the craft is as high above the sea as before', [r0.asl, r1.asl, r2.asl]);
  ok(Math.abs(r2.at0 - r0.raw) < 6, 'the ground where it was reads the same from the new origin', [r0.raw, r2.at0]);
  ok(!T.errs.length, 'no page errors', T.errs.slice(0, 3));
  await T.browser.close(); process.exit(L.bad() ? 1 : 0);
})().catch(e => { console.error('ERROR', e); process.exit(2); });
