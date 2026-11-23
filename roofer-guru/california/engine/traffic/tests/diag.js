const L = require('./lib.js'), { SE } = L.load(), D = SE.TrafficData;
const fwy = (pts, ln, kind, extra) => Object.assign({ kind: kind || 'freeway', hw: kind === 'ramp' ? 'motorway_link' : 'motorway', pts, lanes: ln, oneway: 1, id: Math.random() }, extra || {});
const F = SE.Flow(); F.cap = 3000; let roads, eye = [0, 1200], dm;
if (process.argv[2] === 'la') { const raw = L.saved('la_central', [34.0623, -118.2484]); roads = SE.RoadPrep.prep(raw); eye = [0, 0]; dm = s => { const d = D.freeway({ metro: 'la', hour: 17, aadt: 0, lanes: s.n, vff: s.lim, route: 0, kOf: F.kOf }); if (s.kind === 'ramp') d.k *= 0.45; return d; }; }
else { roads = SE.RoadPrep.prep([fwy([[0, 0], [0, 600], [0, 1200]], 4), fwy([[0, 1200], [0, 1800], [0, 2400]], 4), fwy([[-160, 700], [-60, 1000], [-12, 1130], [0, 1200]], 1, 'ramp'), fwy([[0, 2400], [0, 3000]], 3), fwy([[0, 3000], [0, 3400]], 3), fwy([[0, 3000], [40, 3200], [120, 3350]], 1, 'ramp')]); dm = s => D.freeway({ metro: 'la', hour: 17, aadt: 260000, lanes: s.n, vff: s.lim, route: 10, kOf: F.kOf }); }
F.setRoads(roads); F.setDemand(dm, eye, 1800); F.fill();
const cls = {}; let shown = 0;
for (let t = 0, st = 0; t < 120; t += 1 / 30, st++) { F.step(1 / 30, eye); if (st % 30) continue; const cs = F.cars;
  for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) { const a = cs[i], b = cs[j]; if (Math.abs(a.x - b.x) > 12 || Math.abs(a.z - b.z) > 12 || Math.abs(a.dk - b.dk) > 3) continue; const p = L.overlap(a.x, a.z, a.hx, a.hz, a.hl, a.hw, b.x, b.z, b.hx, b.hz, b.hl, b.hw); if (p < 0.05) continue;
    const same = a.seg === b.seg, k = (same ? 'sameSeg' : a.seg.conn.some(q => q.out === b.seg) || b.seg.conn.some(q => q.out === a.seg) ? 'consecutive' : a.seg.conn.some(q => b.seg.conn.some(r => r.out === q.out)) ? 'merging' : a.seg.ins.some(q => b.seg.ins.includes(q)) ? 'diverging' : 'other') + (same && a.lane === b.lane ? ':sameLane' : '') + (a.lat || b.lat ? ':lat' : '') + (a.kind !== 'car' || b.kind !== 'car' ? ':big' : '');
    cls[k] = (cls[k] || 0) + 1; if (shown++ < 0) console.log(k, 'pen', p.toFixed(2), [a, b].map(c => ({ seg: c.seg.id, kind: c.seg.kind, n: c.seg.n, lane: c.lane, s: +c.s.toFixed(1), len: +c.seg.len.toFixed(0), lat: +c.lat.toFixed(2), v: +c.v.toFixed(1), e0: +c.seg.e0.toFixed(1), e1: +c.seg.e1.toFixed(1), k: c.kind }))); } }
console.log(cls);
