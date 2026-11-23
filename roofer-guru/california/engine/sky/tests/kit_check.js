/* Sky job: the kit run in Node against a stand-in for the engine (no drawing): sites build without error, decks give the
   heights the evidence asks for, ships fit their piers, and a move of the world's origin changes nothing on the ground.
   node tests/kit_check.js */
const fs = require('fs'), path = require('path'), D = path.dirname(__dirname);
global.SE = {}; global.clamp = (v, a, b) => (v < a ? a : v > b ? b : v); global.lerp = (a, b, t) => a + (b - a) * t; global.smoothstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
let meshes = 0, tris = 0;
global.Material = class { constructor(o) { Object.assign(this, o); } };
global.InstanceBuffer = class { constructor() { this.n = 0; this.rows = []; } add(...a) { this.rows.push(a); return this.n++; } addMatrix(m, c) { this.rows.push([m[12], m[13], m[14]]); return this.n++; } clear() { this.n = 0; this.rows = []; } dispose() {} get count() { return this.n; } };
global.MeshBuilder = class { constructor() { this.t = 0; this.mn = [1e18, 1e18, 1e18]; this.mx = [-1e18, -1e18, -1e18]; } get empty() { return !this.t; }
  _p(p) { for (let i = 0; i < 3; i++) { if (!(p[i] === p[i]) || !isFinite(p[i])) throw new Error('bad vertex ' + p); if (p[i] < this.mn[i]) this.mn[i] = p[i]; if (p[i] > this.mx[i]) this.mx[i] = p[i]; } }
  tri(a, b, c) { this._p(a); this._p(b); this._p(c); this.t++; } quad(a, b, c, d) { this.tri(a, b, c); this.tri(a, c, d); } box(cx, cy, cz, hx, hy, hz) { this._p([cx - hx, cy - hy, cz - hz]); this._p([cx + hx, cy + hy, cz + hz]); this.t += 12; }
  build(dev, o) { meshes++; tris += this.t; return { name: o && o.name, tris: this.t, mn: this.mn, mx: this.mx, dispose() {} }; } };
const ent = () => ({ add: () => ({}), destroy() {}, setActive() {}, transform: {} });
const prisms = [], engine = { device: {}, scene: { createEntity: ent, env: { sunDir: [0.3, 0.8, 0.5] } }, physics: { addPrism: (ring, y0, y1, u) => { const p = { ring, y0, y1, u }; prisms.push(p); return p; }, removePrism: p => { const i = prisms.indexOf(p); if (i >= 0) prisms.splice(i, 1); } }, camera: { entity: { transform: { position: [0, 30, 0] } } } };
['sky_data.js', 'sky_model.js', 'sky_shapes.js', 'sky_engine.js', 'sky_more.js'].forEach(f => { const t = fs.readFileSync(path.join(D, f), 'utf8'); (0, eval)(t.replace(/^  function (\w+)\(/gm, 'globalThis.$1 = function $1(').replace(/^  const SkyShapes = /m, 'globalThis.SkyShapes = ')); });
const RD = Math.PI / 180, mLat = la => 111132.92 - 559.82 * Math.cos(2 * RD * la) + 1.175 * Math.cos(4 * RD * la), mLon = la => 111412.84 * Math.cos(RD * la) - 93.5 * Math.cos(3 * RD * la);
const S = { ok: true, gen: 0, fast: false }; S.toL = (la, lo) => [(lo - S.lon0) * S.kx, -(la - S.lat0) * S.ky];
const origin = (la, lo) => { S.gen++; S.lat0 = la; S.lon0 = lo; S.ky = mLat(la); S.kx = mLon(la); prisms.length = 0; };
let fail = 0; const ok = (c, t) => { console.log((c ? 'ok   ' : 'FAIL ') + t); if (!c) fail++; };
origin(32.70, -117.17); const errs = [], X = SE.SkyKit(engine, S, { need() {}, onError: (w, e) => errs.push(w + ': ' + (e && e.stack || e)) }); ok(!X.err, 'the kit is made' + (X.err ? ': ' + X.err : ''));
const cam = engine.camera.entity.transform.position, run = (n, night) => { for (let i = 0; i < n; i++) X.update(0.016, cam, { night: night || 0, moving: true, on: true }); };
const built = () => X.sites.filter(s => s.built).map(s => s.name + ' [' + s.note + ']');
X.hold(Date.UTC(2026, 10, 19, 18, 30) / 1000);   /* 10:30 a.m. Pacific */
run(400); console.log('     built near Coronado: ' + built().join('; ')); ok(errs.length === 0 && !X.err, 'no errors' + (errs.length ? ': ' + errs.join(' | ') : '') + (X.err ? ' ' + X.err : ''));
ok(S.deckAt === X.deckAt && typeof S.deckAt === 'function', 'S.deckAt is published');

/* ---- the Navy ---- */
{ const N = X.NAVY, by = {}; N.ships.forEach(s => { by[s.cls] = (by[s.cls] || 0) + 1; }); console.log('     ships: ' + JSON.stringify(by) + ', prisms ' + prisms.length);
  ok(by.carrier === 1 && by.ddg >= 6 && by.lcs >= 4 && by.lha === 2, 'one carrier at the quay, destroyers, littoral combat ships and two assault ships at the piers');
  const C = N.classes; ok(Math.abs(C.carrier.L - 332.8) < 0.1 && Math.abs(C.carrier.B - 76.8) < 0.1 && C.ddg.L === 155.3 && C.ddg.B === 20 && C.lcs.L === 127 && C.lha.L === 257 && C.lha.B === 32, 'ship sizes: carrier 332.8 x 76.8 m (1,092 x 252 ft), destroyer 155.3 x 20 m (509.5 x 66 ft), LCS 127 x 32 m, assault ship 257 x 32 m');
  const sh = SkyShapes, m = sh.carrier(MeshBuilder), d = sh.destroyer(MeshBuilder), l = sh.lcs(MeshBuilder), a = sh.assault(MeshBuilder), ext = b => [(b.mx[0] - b.mn[0]).toFixed(1), (b.mx[2] - b.mn[2]).toFixed(1)].join(' x ');
  console.log('     meshes (beam x length): carrier ' + ext(m) + ', destroyer ' + ext(d) + ', LCS ' + ext(l) + ', assault ' + ext(a));
  ok(Math.abs(m.mx[2] - m.mn[2] - 332.8) < 0.5 && Math.abs(m.mx[0] - m.mn[0] - 76.8) < 0.5 && Math.abs(d.mx[2] - d.mn[2] - 155.3) < 0.6 && Math.abs(d.mx[0] - d.mn[0] - 20) < 0.3, 'the meshes measure what the classes say');
  /* no two ships on one another: centres of any two at least the mean of their beams apart, and those on one side of one pier a length apart */
  let clash = 0; const P = N.ships.map(s => ({ s, p: S.toL(s.lat, s.lon) })); for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) { const a2 = P[i], b2 = P[j], dd = Math.hypot(a2.p[0] - b2.p[0], a2.p[1] - b2.p[1]), same = a2.s.pier === b2.s.pier && a2.s.side === b2.s.side && a2.s.pier != null; if (same ? dd < (C[a2.s.cls].L + C[b2.s.cls].L) / 2 + 10 : dd < (C[a2.s.cls].B + C[b2.s.cls].B) / 2 + 4) clash++; } ok(clash === 0, N.ships.length + ' ships, ' + clash + ' overlapping');
  const car = N.ships[0], q = S.toL(car.lat, car.lon), y = prisms.find(p => p.u.sky === 'carrier'); ok(y && Math.abs(y.y1 - 19.5) < 0.01 && y.ring.length === 18, 'the flight deck is solid: a prism of 18 points, top at 19.5 m'); void q; }
/* ---- helicopters and vessels ---- */
{ let lo = 1e9, hi = 0, vmax = 0, n = 0, flying = 0; for (let t = X.frozen - 3600; t < X.frozen + 3600; t += 7) { const L = X.helos(t); n = Math.max(n, L.length); L.forEach(h => { lo = Math.min(lo, h.alt); hi = Math.max(hi, h.alt); vmax = Math.max(vmax, h.v); if (!h.ground) flying++; }); }
  ok(n === 3 && hi / 0.3048 <= 500.01 && vmax / 0.514444 <= 146, `Seahawks: ${n} on the circuit, between ${(lo / 0.3048).toFixed(0)} and ${(hi / 0.3048).toFixed(0)} ft (FAA remark: surface to 500), fastest ${(vmax / 0.514444).toFixed(0)} kt (type's limit 146)`);
  ok(X.helos(Date.UTC(2026, 10, 19, 11) / 1000).length === 0, 'none flying at 3 a.m.');
  const V = X.vessels(X.frozen); ok(V.length >= 5 && V.every(v => v.lat > 32.66 && v.lat < 32.73), 'vessels under way: ' + V.map(v => v.kind).join(', ')); }
/* ---- the decks ---- */
const dk = n => X.decks.find(d => d.name === n), T = X.tools;
function scan(d, lower) { const L = d.loc.L; let worst = 0, at = 0, prev = null, nul = 0, minY = 1e9, maxY = -1e9; for (let s = 0.5; s < L; s += 5) { const p = T.pointAt(d, s), y = X.deckAt(p.x, p.z, lower ? { lower: true } : null); if (y == null) { nul++; continue; } if (prev != null && Math.abs(y - prev) / 5 > worst) { worst = Math.abs(y - prev) / 5; at = s; } prev = y; minY = Math.min(minY, y); maxY = Math.max(maxY, y); } return { worst, at, nul, minY, maxY, L }; }
{ const d = dk('San Diego-Coronado Bridge'), K = d.loc.K, r = scan(d), p = T.pointAt(d, K.ch), y = X.deckAt(p.x, p.z), p2 = T.pointAt(d, 700), p3 = T.pointAt(d, 900), g = (X.deckAt(p3.x, p3.z) - X.deckAt(p2.x, p2.z)) / 200;
  console.log(`     Coronado: mapped ${r.L.toFixed(0)} m (evidence 11,179 ft = 3,407 m with approaches), channel pier at ${K.ch.toFixed(0)} m, deck ${r.minY.toFixed(1)} to ${r.maxY.toFixed(1)} m, steepest ${(r.worst * 100).toFixed(1)} % at ${r.at.toFixed(0)} m`);
  ok(y - 5.4 >= 61 && y - 5.4 < 64, `Coronado: deck ${y.toFixed(1)} m over the channel, the girder's underside ${(y - 5.4).toFixed(1)} m (evidence: 200 ft = 61 m clear)`); ok(Math.abs(g - 0.0467) < 0.002, `Coronado: climbing ${(g * 100).toFixed(2)} % from the island (evidence 4.67)`); ok(r.nul === 0 && r.worst < 0.13, 'Coronado: a deck all the way, no step in it');
  /* the curve: the line's bearing changes by about 80 degrees */ const a = T.pointAt(d, 30), b = T.pointAt(d, r.L - 400), turn = Math.abs(Math.atan2(a.tx, -a.tz) - Math.atan2(b.tx, -b.tz)) / RD; ok(turn > 70 && turn < 95, `Coronado: the mapped line turns ${turn.toFixed(0)} degrees (evidence 80)`);
  const side = T.pointAt(d, K.ch), off = X.deckAt(side.x - side.tz * 14, side.z + side.tx * 14), on = X.deckAt(side.x - side.tz * 9, side.z + side.tx * 9); ok(off === null && on != null, 'Coronado: 9 m off the centre line is on the deck, 14 m off is not'); }
origin(37.81, -122.45); cam[0] = 0; cam[2] = 0; run(400); console.log('     built near San Francisco: ' + built().join('; '));
{ const d = dk('Golden Gate Bridge'), K = d.loc.K, r = scan(d), sp = K.N - K.S, pm = T.pointAt(d, (K.S + K.N) / 2), ym = X.deckAt(pm.x, pm.z), pt = T.pointAt(d, K.S), yt = X.deckAt(pt.x, pt.z);
  ok(Math.abs(sp - 1280) < 8, `Golden Gate: towers ${sp.toFixed(0)} m apart (evidence 4,200 ft = 1,280 m)`); ok(Math.abs(yt - 75) < 0.6 && ym - 7.6 >= 67, `Golden Gate: roadway ${yt.toFixed(1)} m at the towers (evidence 746 - 500 ft = 75 m), ${ym.toFixed(1)} m at mid span, ${(ym - 7.6).toFixed(1)} m under the truss (evidence: 220 ft = 67 m clear)`);
  ok(r.nul === 0 && r.worst < 0.25, `Golden Gate: a deck over ${r.L.toFixed(0)} m (evidence 8,981 ft = 2,737 m), steepest ${(r.worst * 100).toFixed(1)} % (the flat world's ramps at the ends)`); ok(d.half * 2 === 27, 'Golden Gate: 27 m wide (evidence 90 ft)'); }
{ const d = dk('Bay Bridge, west span'), K = d.loc.K, r = scan(d), r2 = scan(d, true), pm = T.pointAt(d, (K.W2 + K.W3) / 2), u = X.deckAt(pm.x, pm.z), l = X.deckAt(pm.x, pm.z, { lower: true });
  ok(Math.abs(K.W3 - K.W2 - 704) < 6 && Math.abs(K.W6 - K.W5 - 704) < 6, `Bay Bridge west: main spans ${(K.W3 - K.W2).toFixed(0)} and ${(K.W6 - K.W5).toFixed(0)} m (evidence 2,310 ft = 704 m)`); ok(Math.abs(K.W7 - K.W1 - 3141) < 45, `Bay Bridge west: ${(K.W7 - K.W1).toFixed(0)} m between its end piers (evidence 10,304 ft = 3,141 m)`);
  ok(u - l === 7.5 && l - 1.6 >= 60, `Bay Bridge west: upper deck ${u.toFixed(1)} m, lower ${l.toFixed(1)} m at mid span (evidence: 220 ft = 67 m clear; the deck heights are assumed)`); ok(r.nul === 0 && r2.nul === 0 && r.worst < 0.12, `Bay Bridge west: a deck over ${r.L.toFixed(0)} m from the city to the island, steepest ${(r.worst * 100).toFixed(1)} % at ${r.at.toFixed(0)} m (W1 at ${K.W1.toFixed(0)})`);
  const e = dk('Bay Bridge, east span'), re = scan(e); ok(re.nul === 0 && re.worst < 0.08, `Bay Bridge east: a deck over ${re.L.toFixed(0)} m, ${re.maxY.toFixed(0)} m down to ${re.minY.toFixed(1)} m, steepest ${(re.worst * 100).toFixed(1)} %`); ok(Math.abs(e.half * 2 - 78.74) < 16, `Bay Bridge east: ${(e.half * 2).toFixed(1)} m across both decks (evidence 258.33 ft = 78.7 m)`); }
/* a move of the origin: the same place gives the same deck */
{ const d = dk('Golden Gate Bridge'), pm = T.pointAt(d, d.loc.K.S + 300), ll = [S.lat0 - pm.z / S.ky, S.lon0 + pm.x / S.kx], y0 = X.deckAt(pm.x, pm.z); origin(37.75, -122.38); cam[0] = 0; cam[2] = 0; run(3); const q = S.toL(ll[0], ll[1]), y1 = X.deckAt(q[0], q[1]); ok(Math.abs(y0 - y1) < 0.05, `after the origin moves 9 km the deck at the same place is ${y1.toFixed(2)} m (was ${y0.toFixed(2)})`); run(400); ok(X.sites.find(s => s.name === 'Golden Gate Bridge').built, 'and the bridge is built again'); }
origin(33.75, -118.27); cam[0] = 0; cam[2] = 0; run(400);
{ const d = dk('Vincent Thomas Bridge'), K = d.loc.K, r = scan(d), pm = T.pointAt(d, (K.W + K.E) / 2), y = X.deckAt(pm.x, pm.z); ok(Math.abs(K.E - K.W - 457) < 6, `Vincent Thomas: towers ${(K.E - K.W).toFixed(0)} m apart (evidence 1,500 ft = 457 m)`); ok(y - 4.6 >= 56, `Vincent Thomas: deck ${y.toFixed(1)} m, ${(y - 4.6).toFixed(1)} m under it (evidence about 185 ft = 56 m)`); ok(r.nul === 0 && r.worst < 0.09, `Vincent Thomas: a deck over ${r.L.toFixed(0)} m (evidence 6,060 ft = 1,847 m), steepest ${(r.worst * 100).toFixed(1)} % at ${r.at.toFixed(0)} m, W ${K.W.toFixed(0)} E ${K.E.toFixed(0)}`); }
/* the airport's lights, and flights drawn */
origin(33.9425, -118.408); cam[0] = 0; cam[2] = 0; run(400, 1); { const s = X.sites.find(s => /Los Angeles International/.test(s.name)); ok(s && s.built && s.lamps.length > 800, 'LAX lights at night: ' + (s && s.note)); ok(X.stats.flights > 20, X.stats.flights + ' flights drawn round Los Angeles at 10:30'); }
X.set(false); ok(X.deckAt(0, 0) === null && X.sites.every(s => !s.built), 'switched off: nothing built, no decks'); X.set(true);
console.log('     meshes built ' + meshes + ', triangles ' + tris + '; errors: ' + (errs.join(' | ') || 'none') + (X.err ? ' ' + X.err : ''));
ok(errs.length === 0 && !X.err, 'no errors at the end'); console.log(fail ? fail + ' FAILED' : 'ALL OK'); process.exit(fail ? 1 : 0);
