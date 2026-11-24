/* On the slope of Filbert Street with the street's life, trees and lamps on: pointing meets the ground that is drawn, the
   roof views lie on the lifted roofs, streets are laid on the ground's triangles, and two pictures for the eye.
   node t_misc.js <page.html> <shots dir> */
const L = require('./lib.js'), { ok, wait } = L;
const FILE = process.argv[2], SH = process.argv[3] || '.';
(async () => {
  const T = await L.start(FILE, '1000 Filbert St, San Francisco, CA', { gfx: { life: true, trees: true, lamps: true, wide: false } });
  await T.open(37.80032, -122.4177, 261, { mode: 'drone' }); await T.ev(() => { MODI.rooftops.api.en().world.pitch = -24; }); await T.ready(150000, true); await wait(6000); await T.ready(60000, true);
  /* pointing: rays from the camera meet the ground where S.gy says it is */
  const pk = await T.ev(() => { const en = MODI.rooftops.api.en(), S = en.world, ph = en.engine.physics, cp = en.engine.camera.position, out = []; for (let i = 0; i < 60; i++) { const yaw = i * 6 * Math.PI / 180, pit = -(8 + (i % 7) * 9) * Math.PI / 180, d = [Math.sin(yaw) * Math.cos(pit), Math.sin(pit), -Math.cos(yaw) * Math.cos(pit)], h = ph.raycast([cp[0], cp[1], cp[2]], d, 4000); if (h && h.ground) out.push(Math.abs(h.point[1] - S.gy(h.point[0], h.point[2]))); }
    const t0 = performance.now(); for (let i = 0; i < 2000; i++) { const yaw = i * 0.7, d = [Math.sin(yaw) * 0.9, -0.2, -Math.cos(yaw) * 0.9]; ph.raycast([cp[0], cp[1], cp[2]], d, 4000); } return { n: out.length, worst: Math.max(...out), usPerRay: (performance.now() - t0) / 2000 * 1000 }; });
  ok(pk.n > 20 && pk.worst < 0.05, pk.n + ' rays met the ground within ' + pk.worst.toFixed(3) + ' m of the drawn surface (' + pk.usPerRay.toFixed(0) + ' microseconds a ray)');
  /* the streets: every vertex of the asphalt within reach lies 7 to 12 cm over the 8 m lattice */
  const rd = await T.ev(() => { const en = MODI.rooftops.api.en(), S = en.world, K = en.kit, Bd = new (window.__SCOUT_ENGINE__.MeshBuilder)({ aux: true }); let n = 0, worst = 0, worst2 = 0, near = 0; S.terr.center(S.x, S.z); S.roads.slice(0, 60).forEach(r => { const spec = K.ROADW[r.kind] || K.ROADW.street; K.ribbon(Bd, r.pts, spec[0], spec[1], spec[2]); const P = Bd.p.a; for (let i = n * 3; i < Bd.p.n; i += 3) { if (Math.hypot(P[i] - S.x, P[i + 2] - S.z) > 250) continue; near++; const e = Math.abs(P[i + 1] - S.terr.gyL(P[i], P[i + 2]) - spec[1]), e2 = Math.abs(P[i + 1] - S.gy(P[i], P[i + 2]) - spec[1]); if (e > worst) worst = e; if (e2 > worst2) worst2 = e2; } n = Bd.p.n / 3; }); return { verts: near, worstOverDrawn: worst2, tris: Bd.tris, worst, roads: S.roads.length }; });
  ok(rd.verts > 500 && rd.worst < 0.02 && rd.worstOverDrawn < 0.02, 'street surface: ' + rd.verts + ' vertices within 250 m, of 60 streets, all within ' + (rd.worst * 100).toFixed(1) + ' cm of their lift over the ground', rd);
  await T.shot(SH + '/sf_filbert_drone_life.png', 12000);
  /* roof views on: each roof's layer lies between its building's eave and its top, on the building's own floor */
  await T.ev(() => MODI.rooftops.api.en().setGraphics({ lens: MODI.rooftops.api.en().graphics().lens === 'off' ? 'cover' : 'cover' }));
  for (let i = 0; i < 40; i++) { await wait(2500); const g = await T.ev(() => { const g = MODI.rooftops.api.en().graphics(); return [g.lens, g.lensN, g.lensPending]; }); if (g[1] > 5 && !g[2]) break; }
  const ln = await T.ev(() => { const en = MODI.rooftops.api.en(), S = en.world, ph = en.engine.physics, byId = new Map(); ph.prisms.forEach(p => { const id = p.userData && p.userData.id; if (id == null) return; let hi = -1e9; p.ring.forEach(c => { hi = Math.max(hi, S.gy(c[0], c[1])); }); const e = byId.get(id) || { top: -1e9, hi: -1e9 }; e.top = Math.max(e.top, p.y1); e.hi = Math.max(e.hi, hi); byId.set(id, e); });
    let n = 0, bad = 0, worst = 0; en.lensMap.forEach((m, id) => { if (!m.mesh) return; const e = byId.get(id); if (!e) return; n++; const b = m.mesh.bounds, over = b.max[1] - e.top, under = e.hi + 1.8 - b.min[1]; if (over > 0.3 || under > 0) { bad++; worst = Math.max(worst, over, under); } }); return { lens: en.graphics().lens, n, bad, worst }; });
  ok(ln.n > 5 && ln.bad === 0, 'roof view "' + ln.lens + '": ' + ln.n + ' roofs painted, every one between its eave and its ridge on the lifted building', ln);
  await T.shot(SH + '/sf_filbert_roof_view.png', 12000);
  ok(!T.errs.length, 'no page errors', T.errs.slice(0, 3));
  await T.browser.close(); process.exit(L.bad() ? 1 : 0);
})().catch(e => { console.error('ERROR', e); process.exit(2); });
