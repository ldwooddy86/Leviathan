/* The freeway model alone, in Node: speeds and flows by hour, merges, lane drops, real interchanges from the saved
   OpenStreetMap answers, overlaps counted, and what a step costs against the size of the fleet.
   node test_flow.js [quick] */
const L = require('./lib.js'), { SE } = L.load(), D = SE.TrafficData, quick = process.argv[2] === 'quick';
const out = [], say = s => { console.log(s); out.push(s); };
const fwy = (pts, ln, kind, extra) => Object.assign({ kind: kind || 'freeway', hw: kind === 'ramp' ? 'motorway_link' : 'motorway', pts, lanes: ln, oneway: 1, id: Math.random() }, extra || {});
const run = (F, secs, eye, probe) => { const dt = 1 / 30, t0 = process.hrtime.bigint(); let steps = 0, ov = 0, vs = 0, n = 0, stand = 0; for (let t = 0; t < secs; t += dt) { F.step(dt, eye); steps++; if (steps % 30 === 0) { ov += F.overlaps(L.overlap); for (const c of F.cars) { vs += c.v; n++; if (c.v < 0.5) stand++; } if (probe) probe(t); } }
  return { ms: Number(process.hrtime.bigint() - t0) / 1e6 / steps, v: vs / Math.max(1, n), stand: stand / Math.max(1, n), ov, cars: F.cars.length }; };
const mph = v => (v / 0.44704).toFixed(0);

say('== 1. Hour profile: what the data gives a ten-lane freeway carrying 329,000 a day (I-405 at I-10), five lanes a side, 65 mph ==');
{ const F0 = SE.Flow(); for (const m of ['la', 'sf', 'sd', null]) { const row = [3, 8, 12, 17, 21].map(h => { const d = D.freeway({ metro: m, hour: h, aadt: 329000, lanes: 5, vff: 29.06, route: 405, kOf: F0.kOf }); return h + 'h ' + mph(d.v) + ' mph, ' + d.k.toFixed(0) + '/km/lane'; }); say('  ' + (m || 'elsewhere') + ': ' + row.join(' | ')); }
  const cb = [3, 8, 17].map(h => { const d = D.freeway({ metro: 'sd', hour: h, aadt: 76000, lanes: 2.5, vff: 22.4, route: 75, kOf: F0.kOf }); return h + 'h ' + mph(d.v) + ' mph, ' + d.k.toFixed(0) + '/km/lane'; }); say('  Coronado Bridge (76,000 a day, five lanes, 50 mph): ' + cb.join(' | '));
  const nr = D.near(34.0306, -118.4343, 405); say('  nearest count to I-405 at I-10: ' + JSON.stringify(nr)); const n2 = D.near(32.6894, -117.1531, 75); say('  nearest count to the Coronado Bridge: ' + JSON.stringify(n2)); const n3 = D.near(36.5, -117.5, 0); say('  nearest count in the desert east of Lone Pine: ' + JSON.stringify(n3)); }

say('\n== 2. A straight 3 km carriageway, five lanes, Los Angeles, by hour (4 simulated minutes after 1 minute of settling) ==');
for (const h of quick ? [3, 17] : [3, 8, 12, 17, 21]) { const F = SE.Flow(); F.cap = 4000; const roads = SE.RoadPrep.prep([fwy([[0, 0], [0, 1000], [0, 2000], [0, 3000]], 5, 'freeway', { ref: 'I 405' })]); F.setRoads(roads);
  const dm = s => D.freeway({ metro: 'la', hour: h, aadt: 329000, lanes: s.n, vff: s.lim, route: 405, kOf: F.kOf }); F.setDemand(dm, [0, 1500]); F.fill(); run(F, 60, [0, 1500]);
  let pass = 0, last = new Map(), vmin = 99, vmax = 0; const r = run(F, quick ? 90 : 240, [0, 1500], () => { for (const c of F.cars) { const p = last.get(c.id); if (p != null && p < 1500 && c.s >= 1500 && c.seg.acc) pass++; last.set(c.id, c.seg.pts[0][1] + c.s); if (c.s > 800 && c.s < 2200) { vmin = Math.min(vmin, c.v); vmax = Math.max(vmax, c.v); } } });
  const d = dm(F.segs[0]); say('  ' + h + 'h: wanted ' + mph(d.v) + ' mph at ' + d.k.toFixed(0) + '/km/lane; ran ' + r.cars + ' cars at a mean ' + mph(r.v) + ' mph (slowest ' + mph(vmin) + ', fastest ' + mph(vmax) + '), standing ' + (r.stand * 100).toFixed(0) + '%, overlaps ' + r.ov + ', lane changes ' + F.events.changes + ', held ' + (F.events.held || 0) + ', step ' + r.ms.toFixed(3) + ' ms'); }

say('\n== 3. A ramp joins four lanes (1.2 km before, 1.2 km after), and a lane drop from four to three ==');
for (const [name, h] of [['03:00', 3], ['17:00', 17]]) { const F = SE.Flow(); F.cap = 3000;
  const roads = SE.RoadPrep.prep([fwy([[0, 0], [0, 600], [0, 1200]], 4), fwy([[0, 1200], [0, 1800], [0, 2400]], 4), fwy([[-160, 700], [-60, 1000], [-12, 1130], [0, 1200]], 1, 'ramp'), fwy([[0, 2400], [0, 3000]], 3), fwy([[0, 3000], [0, 3400]], 3), fwy([[0, 3000], [40, 3200], [120, 3350]], 1, 'ramp')]); F.setRoads(roads);
  F.setDemand(s => D.freeway({ metro: 'la', hour: h, aadt: 260000, lanes: s.n, vff: s.lim, route: 10, kOf: F.kOf }), [0, 1200]); F.fill();
  const r = run(F, quick ? 120 : 300, [0, 1200]); const onRamp = F.segs.filter(s => s.kind === 'ramp').map(s => s.L[0].length);
  say('  ' + name + ': ' + r.cars + ' cars, mean ' + mph(r.v) + ' mph, standing ' + (r.stand * 100).toFixed(0) + '%, overlaps ' + r.ov + ', lane changes ' + F.events.changes + ', rerouted ' + F.events.reroutes + ', squeezed over ' + F.events.forced + ', held ' + (F.events.held || 0) + ', left by the ends ' + F.events.left + ', entered ' + F.events.spawned + ', on the two ramps now ' + onRamp.join(' and ')); }

say('\n== 4. Real interchanges from the saved OpenStreetMap answers ==');
for (const [box, label, at, metro] of [['la_central', 'Los Angeles: the four-level (SR-110 / US-101) and downtown', [34.0623, -118.2484], 'la'], ['sf_northeast', 'San Francisco: I-80 and the Bay Bridge approach', [37.7858, -122.3925], 'sf'], ['coronado', 'San Diego: I-5 and the Coronado Bridge', [32.6990, -117.1440], 'sd']]) {
  const raw = L.saved(box, at), roads = SE.RoadPrep.prep(raw), fw = roads.filter(r => r.kind === 'freeway' || r.kind === 'ramp' || r.kind === 'cable');
  for (const h of quick ? [17] : [3, 17]) { const F = SE.Flow(); F.cap = 2500; F.setRoads(roads); const cache = new Map();
    F.setDemand(s => { const rt = D.routeOf(s.r.ref), k = rt + ':' + Math.round(s.pts[0][0] / 800) + ':' + Math.round(s.pts[0][1] / 800); let nr = cache.get(k); if (nr === undefined) { const la = raw.lat0 - s.pts[0][1] / 110900, lo = raw.lon0 + s.pts[0][0] / (111320 * Math.cos(raw.lat0 * Math.PI / 180)); nr = D.near(la, lo, rt); cache.set(k, nr); }
      const lanesBoth = s.kind === 'ramp' ? s.n * 4 : s.n * 2, d = D.freeway({ metro, hour: h, aadt: nr && s.kind !== 'ramp' ? nr.aadt : 0, lanes: nr && s.kind !== 'ramp' ? lanesBoth / 2 : s.n, vff: s.lim, route: rt, kOf: F.kOf }); if (s.kind === 'ramp') d.k *= 0.45; return d; }, [0, 0], 1800); F.fill();
    const r = run(F, quick ? 60 : 180, [0, 0]); const kinds = {}; F.cars.forEach(c => { kinds[c.kind] = (kinds[c.kind] || 0) + 1; }); const act = F.segs.filter(s => s.act);
    say('  ' + label + ', ' + h + 'h: ' + F.segs.length + ' pieces (' + act.length + ' carrying traffic, ' + act.reduce((a, s) => a + s.len * s.n, 0).toFixed(0) + ' lane-metres, out to ' + F.within.toFixed(0) + ' m), ' + r.cars + ' vehicles ' + JSON.stringify(kinds) + ', mean ' + mph(r.v) + ' mph, standing ' + (r.stand * 100).toFixed(0) + '%, overlaps ' + r.ov + ', lane changes ' + F.events.changes + ', rerouted ' + F.events.reroutes + ', squeezed ' + F.events.forced + ', held ' + (F.events.held || 0) + ', step ' + r.ms.toFixed(3) + ' ms'); }
  const br = roads.filter(r => r.up), mx = Math.max.apply(null, roads.map(r => Math.max.apply(null, r.dk))); say('    roads: ' + roads.length + ', freeway and ramp ways ' + fw.length + ', roads with a raised deck ' + br.length + ', highest deck ' + mx.toFixed(1) + ' m, one-way share of street length ' + (() => { let a = 0, b = 0; roads.forEach(r => { if (r.kind !== 'street' && r.kind !== 'major') return; let l = 0; for (let i = 1; i < r.pts.length; i++) l += Math.hypot(r.pts[i][0] - r.pts[i - 1][0], r.pts[i][1] - r.pts[i - 1][1]); b += l; if (r.ow) a += l; }); return (100 * a / b).toFixed(0) + '%'; })() + ', cable car track ways ' + roads.filter(r => r.kind === 'cable').length); }

say('\n== 5. Step cost against fleet size (one straight carriageway of six lanes, as long as the fleet needs, 40 cars/km/lane) ==');
for (const n of quick ? [400, 1600] : [200, 400, 800, 1600, 3200]) { const F = SE.Flow(); F.cap = n; const len = n / (6 * 40) * 1000, pts = []; for (let z = 0; z <= len; z += 500) pts.push([0, z]); pts.push([0, len + 1]); F.setRoads(SE.RoadPrep.prep([fwy(pts, 6)])); F.setDemand(() => ({ k: 40, v: 13, truck: 0.04 }), [0, len / 2]); F.fill(); const r = run(F, 30, [0, len / 2]); say('  ' + r.cars + ' cars: ' + r.ms.toFixed(3) + ' ms a step (' + (r.ms / r.cars * 1000).toFixed(2) + ' microseconds a car), overlaps ' + r.ov); }

say('\n== 6. The user\'s car as an actor: standing still in lane 2 of four at 17:00 density, then gone ==');
{ const F = SE.Flow(); F.cap = 2000; F.setRoads(SE.RoadPrep.prep([fwy([[0, 0], [0, 1500], [0, 3000]], 4)])); F.setDemand(() => ({ k: 22, v: 24, truck: 0 }), [0, 1500]); F.fill(); run(F, 30, [0, 1500]);
  const off = (2 - 1.5) * 3.66, hero = { x: -off, z: 1500, hx: 0, hz: 1, v: 0, hl: 2.4, hw: 0.95, dk: 0 }; F.actors = [hero]; let minGap = 1e9, hits = 0; const dt = 1 / 30;
  for (let t = 0; t < 60; t += dt) { F.step(dt, [0, 1500]); for (const c of F.cars) { if (L.overlap(hero.x, hero.z, 0, 1, hero.hl, hero.hw, c.x, c.z, c.hx, c.hz, c.hl, c.hw) > 0.02) hits++; if (Math.abs(c.x - hero.x) < 1 && c.z < hero.z) minGap = Math.min(minGap, hero.z - hero.hl - c.z - c.hl); } }
  const q = F.cars.filter(c => Math.abs(c.x - hero.x) < 1 && c.z < hero.z && c.z > hero.z - 60 && c.v < 1).length; say('  60 s with the car standing: frames in which a traffic car touched it ' + hits + ', closest a follower came ' + minGap.toFixed(2) + ' m, cars queued behind it ' + q + ', lane changes so far ' + F.events.changes);
  F.actors = []; const r = run(F, 40, [0, 1500]); say('  40 s after it left: mean ' + mph(r.v) + ' mph, standing ' + (r.stand * 100).toFixed(0) + '%'); }
require('fs').writeFileSync(__dirname + '/flow_results' + (quick ? '_quick' : '') + '.txt', out.join('\n') + '\n');
