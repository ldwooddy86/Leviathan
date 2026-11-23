const fs = require('fs'), path = require('path');
process.argv[3] = 'quick'; const src = fs.readFileSync(process.argv[2], 'utf8');
const between = (a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i); return src.slice(i, j); };
const head = fs.readFileSync(path.resolve(__dirname, '..', '..', 'la_engine.js'), 'utf8').split('\n').slice(23, 28).join('\n');
const core = fs.readFileSync(path.resolve(__dirname, '..', 'aadt_table.js'), 'utf8') + fs.readFileSync(path.resolve(__dirname, '..', 'traffic_core.js'), 'utf8');
const { SE, Traffic, network } = new Function(head + '\nconst SE = {}; const K = { ROADW: { major: [12], street: [8.2] } }, DRIVE = new Set(["street", "major"]);\n' + core + '\n' + between('  function Traffic(types) {', '  SE.Traffic = Traffic;') + '\n' + between('    function network(roads) {', '    const TT = TYPES.slice();') + '\nreturn { SE, Traffic, network };')();
const T = [{ L: 4.8, W: 1.8 }]; T.pickType = () => 0; T.pickPaint = () => [1, 1, 1];
const raw = []; for (let i = 0; i <= 10; i++) { const p = [], q = []; for (let j = 0; j <= 10; j++) { p.push([i * 100 - 500, j * 100 - 500]); q.push([j * 100 - 500, i * 100 - 500]); } raw.push({ kind: 'street', pts: p, oneway: i % 2 ? 1 : -1, lanes: 2, hw: 'residential' }); raw.push({ kind: 'street', pts: q, oneway: i % 2 ? -1 : 1, lanes: 2, hw: 'residential' }); }
const roads = SE.RoadPrep.prep(raw), TR = Traffic(T); TR.setNetwork(network(roads)); TR.setParked([]); TR.dens = 12; TR.populate(120, 77, [0, 0, 0, 600]);
console.log('ways', TR.ways.length, 'drive', TR.driveWays.length, 'portals', TR.portals.length, 'lanes sample', JSON.stringify(TR.ways[0].lanes), 'dead', JSON.stringify(TR.ways.slice(0, 4).map(w => w.dead)));
let bad = TR.cars.filter(c => !c.out && c.legs[c.li].dir < 0); console.log('wrong at start', bad.length, 'out', TR.cars.filter(c => c.out).length);
const why = {}; for (let t = 0; t < 60; t += 1 / 30) { TR.step(1 / 30, [0, 0, 700]); }
bad = TR.cars.filter(c => !c.out && !c.legs[c.li].k && c.legs[c.li].dir < 0); console.log('wrong after 60 s', bad.length, bad.slice(0, 2).map(c => ({ x: c.x | 0, z: c.z | 0, off: c.legs[c.li].off, lanes: JSON.stringify(c.legs[c.li].w.lanes) })), JSON.stringify(TR.events));
