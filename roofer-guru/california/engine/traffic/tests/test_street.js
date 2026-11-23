/* The surface-street traffic as the port leaves it (Traffic and StreetKit's network, cut out of the ported engine), in
   Node: a bridge over a street, one-way streets, real streets from the saved OpenStreetMap answers by hour, the user's
   car as an actor, and the cost of a step against the size of the fleet.
   node test_street.js <ported engine.js> [quick] */
const fs = require('fs'), path = require('path'), L = require('./lib.js');
const src = fs.readFileSync(process.argv[2], 'utf8'), quick = process.argv[3] === 'quick';
const between = (a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i); if (i < 0 || j < 0) throw new Error('not found: ' + a.slice(0, 40)); return src.slice(i, j); };
const head = fs.readFileSync(path.resolve(__dirname, '..', '..', 'la_engine.js'), 'utf8').split('\n').slice(23, 28).join('\n');
const core = fs.readFileSync(path.resolve(__dirname, '..', 'aadt_table.js'), 'utf8') + fs.readFileSync(path.resolve(__dirname, '..', 'traffic_core.js'), 'utf8');
const mod = new Function(head + '\nconst SE = {}; const K = { ROADW: { major: [12], street: [8.2], service: [5.2], alley: [4.2], drive: [3], path: [1.6] } }, DRIVE = new Set(["street", "major"]);\n' + core + '\n' + between('  function Traffic(types) {', '  SE.Traffic = Traffic;') + '\n' + between('    function network(roads) {', '    const TT = TYPES.slice();') + '\nreturn { SE, Traffic, network, rng };')();
const { SE, Traffic, network, rng } = mod, D = SE.TrafficData;
const TYPES = [{ L: 4.88, W: 1.84 }, { L: 4.6, W: 1.855 }, { L: 5.35, W: 2.06 }, { L: 5.89, W: 2.03 }, { L: 4.75, W: 1.92 }, { L: 12.2, W: 2.6 }];
const mkTypes = bus => { const T = TYPES.slice(); T.pickType = r => (r < bus ? 5 : Math.min(4, Math.floor((r - bus) / (1 - bus) * 5))); T.pickPaint = () => [1, 1, 1]; return T; };
const out = [], say = s => { console.log(s); out.push(s); }, mph = v => (v / 0.44704).toFixed(0);
function sim(raw, o) { const roads = SE.RoadPrep.prep(raw); if (raw.sigFn) roads.sig = raw.sigFn; const TR = Traffic(mkTypes(o.bus || 0)); TR.setNetwork(network(roads)); TR.setParked([]); TR.dens = o.dens; TR.cycle = o.cycle || 90; TR.actors = o.actors || []; TR.populate(o.cars, 77, [o.at[0], o.at[1], 0, o.r || 420]);
  const dt = 1 / 30, eye = [o.at[0], o.at[1], (o.r || 420) + 100], t0 = process.hrtime.bigint(); let steps = 0, vs = 0, n = 0, stand = 0, wrong = 0;
  for (let t = 0; t < o.secs; t += dt) { if (o.each) o.each(t, TR); TR.step(dt, eye); steps++; if (steps % 30 === 0) for (const c of TR.cars) { if (c.out) continue; vs += c.v; n++; if (c.v < 0.3) stand++; const lg = c.legs[c.li]; if (!lg.k && lg.w.r.ow && lg.dir < 0) wrong++; } }
  return { TR, roads, ms: Number(process.hrtime.bigint() - t0) / 1e6 / steps, v: vs / Math.max(1, n), stand: stand / Math.max(1, n), wrong, cars: TR.cars.length, on: TR.cars.filter(c => !c.out).length, ev: TR.events }; }
const rd = (pts, kind, x) => Object.assign({ name: '', kind, pts, hw: kind === 'major' ? 'primary' : 'residential', id: Math.random() }, x || {});
const line = r => r.cars + ' cars (' + r.on + ' on the road), mean ' + mph(r.v) + ' mph, standing ' + (r.stand * 100).toFixed(0) + '%, contacts ' + r.ev.contacts + ', tows ' + r.ev.tows + ', wrong way on a one-way street ' + r.wrong + ', step ' + r.ms.toFixed(3) + ' ms';

say('== 1. Two main roads that cross in plan with no point in common (the survey\'s case 4: 80 cars, 120 s) ==');
{ const A = [[-600, 0], [-200, 0], [200, 0], [600, 0]], B = [[0, -600], [0, -200], [0, 200], [0, 600]];
  const flat = sim([rd(A, 'major', { lanes: 4 }), rd(B, 'major', { lanes: 4 })], { cars: 80, dens: 40, secs: 120, at: [0, 0], r: 700 }); say('  both on the ground, as the old engine had it: ' + line(flat));
  const br = sim([rd(A, 'major', { lanes: 4 }), rd(B, 'major', { lanes: 4, bridge: true, layer: 1 })], { cars: 80, dens: 40, secs: 120, at: [0, 0], r: 700 }); say('  one of them a bridge (layer 1): ' + line(br) + '; highest deck ' + Math.max.apply(null, br.roads.map(r => Math.max.apply(null, r.dk))).toFixed(1) + ' m'); }

say('\n== 2. A grid of one-way streets (alternate directions, 100 m blocks, 1 km square), 120 cars, 180 s ==');
{ const raw = []; for (let i = 0; i <= 10; i++) { const p = [], q = []; for (let j = 0; j <= 10; j++) { p.push([i * 100 - 500, j * 100 - 500]); q.push([j * 100 - 500, i * 100 - 500]); } raw.push(rd(p, 'street', { oneway: i % 2 ? 1 : -1, lanes: 2 })); raw.push(rd(q, 'street', { oneway: i % 2 ? -1 : 1, lanes: 2 })); }
  const r = sim(raw, { cars: 120, dens: 12, secs: 180, at: [0, 0], r: 600 }); say('  ' + line(r)); }

say('\n== 3. Real streets from the saved OpenStreetMap answers (surface streets only; freeways are the other model\'s) ==');
for (const [box, label, at, metro] of [['la_central', 'Los Angeles, Figueroa and 7th', [34.0497, -118.2603], 'la'], ['sf_northeast', 'San Francisco, Market and Powell', [37.7847, -122.4078], 'sf'], ['coronado', 'San Diego, Barrio Logan under the Coronado Bridge', [32.6990, -117.1440], 'sd']]) {
  const raw = L.saved(box, at), near = raw.filter(r => r.kind !== 'freeway' && r.kind !== 'ramp' && r.kind !== 'cable' && r.pts.some(p => Math.hypot(p[0], p[1]) < 820));
  const G = new Set(); raw.signals.forEach(q => { for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) G.add((Math.round(q[0] / 14) + i) + ':' + (Math.round(q[1] / 14) + j)); }); near.sigFn = (x, z) => G.has(Math.round(x / 14) + ':' + Math.round(z / 14));
  for (const h of quick ? [17] : [3, 17]) { const st = D.street(metro, h), r = sim(near, { cars: 190, dens: st.k, cycle: st.cycle, secs: quick ? 90 : 240, at: [0, 0], bus: st.bus });
    const ow = (() => { let a = 0, b = 0; r.roads.forEach(q => { if (q.kind !== 'street' && q.kind !== 'major') return; let l = 0; for (let i = 1; i < q.pts.length; i++) l += Math.hypot(q.pts[i][0] - q.pts[i - 1][0], q.pts[i][1] - q.pts[i - 1][1]); b += l; if (q.ow) a += l; }); return (100 * a / b).toFixed(0); })();
    const net = network(r.roads), sig = net.nodes.filter(n => n.signal).length, cross = net.nodes.filter(n => n.cross).length;
    say('  ' + label + ', ' + h + 'h (' + st.k.toFixed(1) + ' cars per lane-km wanted, cycle ' + st.cycle + ' s): ' + line(r) + '; buses ' + r.TR.cars.filter(c => c.ty === 5).length + '; one-way share of street length ' + ow + '%; crossings ' + cross + ', with signals ' + sig); } }

say('\n== 4. The user\'s car as an actor on a four-lane street: driving at 5 m/s, then standing ==');
{ const hero = { x: -300, z: 1.6, hx: 1, hz: 0, hl: 2.4, hw: 0.95, v: 5, static: false }; let touch = 0;
  const r = sim([rd([[-600, 0], [-200, 0], [200, 0], [600, 0]], 'major', { lanes: 4 })], { cars: 40, dens: 40, secs: 120, at: [0, 0], r: 700, actors: [hero], each: (t, TR) => { if (t < 60) hero.x += 5 / 30; else hero.v = 0; for (const c of TR.cars) if (!c.out && TR.overlap(hero.x, hero.z, 1, 0, hero.hl, hero.hw, c.x, c.z, c.hx, c.hz, c.hl, c.hw) > 0.02) touch++; } });
  say('  ' + line(r) + '; steps in which a traffic car touched the user\'s car: ' + touch); }

say('\n== 5. Step cost against fleet size (a 2 km grid of two-way streets and four-lane roads, 100 m blocks) ==');
{ const raw = []; for (let i = 0; i <= 20; i++) { const p = [], q = []; for (let j = 0; j <= 20; j++) { p.push([i * 100 - 1000, j * 100 - 1000]); q.push([j * 100 - 1000, i * 100 - 1000]); } raw.push(rd(p, i % 5 ? 'street' : 'major', i % 5 ? {} : { lanes: 4 })); raw.push(rd(q, i % 5 ? 'street' : 'major', i % 5 ? {} : { lanes: 4 })); }
  for (const n of quick ? [100, 400] : [100, 200, 400, 800, 1600]) { const r = sim(raw, { cars: n, dens: 60, secs: 30, at: [0, 0], r: 1400 }); say('  ' + r.on + ' cars: ' + r.ms.toFixed(3) + ' ms a step (' + (r.ms / Math.max(1, r.on) * 1000).toFixed(1) + ' microseconds a car), contacts ' + r.ev.contacts); } }
fs.writeFileSync(__dirname + '/street_results' + (quick ? '_quick' : '') + '.txt', out.join('\n') + '\n');
