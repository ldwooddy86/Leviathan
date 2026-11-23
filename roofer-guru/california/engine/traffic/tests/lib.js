/* Loads the traffic job's pure code (the count table, the hour profile, the road preparation, the freeway model) and the
   dashboard's road reader into Node, with the engine's own small helpers, so the model can be run without a browser. */
const fs = require('fs'), path = require('path');
const HERE = path.resolve(__dirname, '..'), CA = path.resolve(HERE, '..', '..');
const head = fs.readFileSync(path.join(CA, 'engine', 'la_engine.js'), 'utf8').split('\n').slice(23, 28).join('\n');
exports.load = () => {
  const src = head + '\nconst SE = {};\n' + fs.readFileSync(path.join(HERE, 'aadt_table.js'), 'utf8') + fs.readFileSync(path.join(HERE, 'traffic_core.js'), 'utf8') + '\nreturn { SE, clamp, rng, hash01 };';
  return new Function(src)();
};
exports.scout = () => new Function('rad', 'getJSON', 'EP', 'qs', 'env', 'tileOf', 'roadsFor', fs.readFileSync(path.join(HERE, 'scout_roads.js'), 'utf8') + '\nreturn { osmList, roads3d, tigerKind, osmKind };')(d => d * Math.PI / 180, null, {}, null, null, null, null);
/* a saved Overpass answer as the engine would hold it: local metres round the middle of the box (or a given point) */
exports.saved = (name, at) => { const j = JSON.parse(fs.readFileSync(path.join(CA, 'dl', 'scout', 'streets', 'overpass_' + name + '.json'), 'utf8')), list = exports.scout().osmList(j);
  let la0 = at && at[0], lo0 = at && at[1]; if (!at) { let a = 0, b = 0, n = 0; list.forEach(r => r.pts.forEach(p => { a += p[0]; b += p[1]; n++; })); la0 = a / n; lo0 = b / n; }
  const ky = 110900, kx = 111320 * Math.cos(la0 * Math.PI / 180), toL = (la, lo) => [(lo - lo0) * kx, -(la - la0) * ky];
  const out = list.map(r => Object.assign({}, r, { pts: r.pts.map(p => toL(p[0], p[1])) })); out.signals = list.signals.map(p => toL(p[0], p[1])); out.stops = list.stops.map(p => toL(p[0], p[1])); out.lat0 = la0; out.lon0 = lo0; out.toL = toL; return out; };
/* do two boxes overlap? (the engine's own test, copied from Traffic) */
exports.overlap = (ax, az, ahx, ahz, al, aw, bx, bz, bhx, bhz, bl, bw) => { const dx = bx - ax, dz = bz - az, c = Math.abs(ahx * bhx + ahz * bhz), s = Math.abs(ahx * bhz - ahz * bhx); let best = Infinity, o;
  o = al + bl * c + bw * s - Math.abs(dx * ahx + dz * ahz); if (o <= 0) return 0; best = Math.min(best, o); o = aw + bl * s + bw * c - Math.abs(-dx * ahz + dz * ahx); if (o <= 0) return 0; best = Math.min(best, o);
  o = bl + al * c + aw * s - Math.abs(dx * bhx + dz * bhz); if (o <= 0) return 0; best = Math.min(best, o); o = bw + al * s + aw * c - Math.abs(-dx * bhz + dz * bhx); if (o <= 0) return 0; return Math.min(best, o); };
