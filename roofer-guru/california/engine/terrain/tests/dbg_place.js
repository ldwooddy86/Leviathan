/* debugging aid: at a place, the highest ground by bearing and distance (drawn and raw), and the tiles that failed and why.
   node dbg_place.js <page.html> <lat> <lon> [out.png] [mode] [yaw] [pitch] */
const L = require('./lib.js'), { wait } = L;
const [FILE, LAT, LON, OUT, MODE, YAW, PITCH] = process.argv.slice(2);
(async () => {
  const T = await L.start(FILE, '200 N Spring St, Los Angeles, CA', { gfx: { wide: true } });
  await T.open(+LAT, +LON, +(YAW || 0), { mode: MODE || 'bird' }); if (PITCH != null) await T.ev(p => { MODI.rooftops.api.en().world.pitch = p; }, +PITCH);
  console.log('ready', JSON.stringify(await T.ready(150000, true)));
  const r = await T.ev(() => { const en = MODI.rooftops.api.en(), S = en.world, out = { y0: S.y0, tiles: S.terr.tiles().map(l => l.filter(t => !/:ok$/.test(t))), peaks: [] };
    for (let b = 0; b < 360; b += 10) { let best = null; for (let d = 500; d <= 110000; d += d < 16000 ? 250 : 1000) { const x = S.x + Math.sin(b * Math.PI / 180) * d, z = S.z - Math.cos(b * Math.PI / 180) * d, g = S.gy(x, z) + S.y0, ang = Math.atan2(g - (S.gy(S.x, S.z) + S.y0 + 120), d) * 180 / Math.PI; if (!best || ang > best[0]) { const ll = [S.lat0 - z / S.ky, S.lon0 + x / S.kx]; best = [+ang.toFixed(2), d, Math.round(g), Math.round(S.elevAt(ll[0], ll[1])), +ll[0].toFixed(3), +ll[1].toFixed(3)]; } } out.peaks.push([b].concat(best)); }
    out.bad = out.peaks.filter(p => Math.abs(p[3] - p[4]) > 80).map(p => { const la = p[5], lo = p[6], T = S.terr, q = S.toL(la, lo), r = { at: [la, lo], gy: Math.round(S.gy(q[0], q[1]) + S.y0), byZoom: [0, 1, 2, 3, 4].map(li => Math.round(T.elev(la, lo, li))), tiles: [] };
      T.reg.forEach(g => { if (!g.built || q[0] < g.r.x0 || q[0] > g.r.x1 || q[1] < g.r.zN || q[1] > g.r.zS) return; const k = g.kids.find(k2 => q[0] >= k2.r.x0 && q[0] <= k2.r.x1 && q[1] >= k2.r.zN && q[1] <= k2.r.zS), ci = g.kids.indexOf(k); r.tiles.push({ z: g.z, X: g.X, Y: g.Y, v: g.v, kid: ci, hidden: g.mesh.clusters[ci * 2].hidden, lo: k && Math.round(k.lo + S.y0), hi: k && Math.round(k.hi + S.y0), m: k && k.m }); }); return r; });
    return out; });
  console.log('datum', r.y0); console.log('tiles not ok', JSON.stringify(r.tiles));
  console.log('bearing: highest skyline angle seen from 120 m up [deg, distance m, drawn m, raw m, lat, lon]'); r.peaks.forEach(p => console.log('  ', JSON.stringify(p)));
  console.log('where drawn and raw differ'); r.bad.forEach(b => console.log('  ', JSON.stringify(b)));
  if (OUT) await T.shot(OUT, 12000);
  console.log('errors', T.errs.length ? T.errs.slice(0, 3) : 'none'); await T.browser.close(); process.exit(0);
})().catch(e => { console.error('ERROR', e); process.exit(2); });
