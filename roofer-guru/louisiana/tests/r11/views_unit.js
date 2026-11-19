/* The new roof views' arithmetic, apart from the page: the laminated share by year, the share of roofs a storm replaces by
   wind, the flood's depth by distance, and the storm table's derived figures. Stubs stand in for the module's helpers with
   the constants the page computes (the damage curve's fit and the FEMA-over-curve ratios). node views_unit.js */
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'views_block.js'), 'utf8');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), isN = v => typeof v === 'number' && isFinite(v), D = (v, n) => (+v).toFixed(n || 0), THIS_YEAR = 2026, AGE_MAX = 40;
const DMG = { smax: 0.52, v50: 69.7, w: 7.26 }, dmgShare = kt => isN(kt) && kt >= 34 ? DMG.smax / (1 + Math.exp(-(kt - DMG.v50) / DMG.w)) : 0, curveK = () => [0.96, 0.99, 0.54, 0.79], BAND4 = kt => (kt >= 80 ? 3 : kt >= 64 ? 2 : kt >= 50 ? 1 : 0);
let KM = 10; const coastKm = () => KM;
const api = new Function('clamp', 'isN', 'D', 'THIS_YEAR', 'AGE_MAX', 'dmgShare', 'curveK', 'BAND4', 'coastKm', src + '\nreturn { lamAt, ageSpread, styleOf, stormShare, surgeAt, LAM, SURGE };')(clamp, isN, D, THIS_YEAR, AGE_MAX, dmgShare, curveK, BAND4, coastKm);
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('FAIL', m); } };
console.log('laminated share:', [1970, 1984, 1990, 2000, 2010, 2012, 2018, 2025, 2030].map(y => y + ' ' + (api.lamAt(y) * 100).toFixed(0) + '%').join(' | '));
for (let y = 1960; y <= 2030; y++) { const a = api.lamAt(y), b = api.lamAt(y + 1); ok(a >= 0 && a <= 1 && b >= a - 1e-9, 'laminated share not rising at ' + y); }
const older = n => clamp(1 - n / 30, 0, 1), sp = api.ageSpread({}, { older }), sum = sp.reduce((s, x) => s + x[1], 0);
ok(Math.abs(sum - 1) < 1e-9 && sp.every(x => x[1] > 0 && x[0] >= 0), 'age spread sums to ' + sum); console.log('age spread, a roof equally likely any age to 30:', sp.length, 'ages; style', JSON.stringify(api.styleOf({}, { older })));
ok(api.ageSpread({ state: { age: 12.4 } }, null).length === 1, 'no clock: one age');
const mph = [56, 85, 103, 120, 143, 165], kts = mph.map(m => m / 1.15078), sh = kts.map(api.stormShare);
console.log('share of roofs replaced by step:', mph.map((m, i) => m + ' mph ' + (sh[i] * 100).toFixed(1) + '%').join(' | '));
for (let k = 34; k < 200; k++) ok(api.stormShare(k + 1) >= api.stormShare(k) - 1e-9 && api.stormShare(k) <= 0.77 + 1e-9, 'storm share not rising or over 77% at ' + k + ' kt');
ok(api.stormShare(30) === 0, 'no share under 34 kt');
for (const lv of [7, 8, 9]) { const row = [0, 5, 20, 40, 50, 60, 70].map(km => { KM = km; const s = api.surgeAt(30, -90, lv); return km + ' km ' + (s.depth * 3.281).toFixed(1) + ' ft'; }); console.log('surge, level ' + lv + ':', row.join(' | ')); let prev = 1e9; for (let km = 0; km < 100; km++) { KM = km; const d = api.surgeAt(30, -90, lv).depth; ok(d <= prev + 1e-9 && d >= 0, 'surge not thinning inland'); prev = d; } }
ok(api.surgeAt(30, -90, 6) === null, 'no surge below Category 3');
/* the engine's storm table */
const eng = fs.readFileSync(path.join(__dirname, 'storm_engine.js'), 'utf8'), i0 = eng.indexOf('  const STORM = ['), i1 = eng.indexOf('  SE.STORM = STORM;');
const STORM = new Function(eng.slice(i0, i1) + '\nreturn STORM;')();
STORM.forEach(s => console.log(String(s.i).padStart(2), s.l.padEnd(22), 'wind', String(s.mph).padStart(3), 'mph', s.ms.toFixed(1).padStart(5), 'm/s gust', String(s.gust).padStart(3), '| rain', String(s.rain).padStart(2), 'mm/h drop', s.dropMm.toFixed(2), 'mm fall', s.fall.toFixed(1), 'm/s sees', s.visKm ? s.visKm.toFixed(2) + ' km' : '-', '| fly', !!s.fly, '| lightning every', s.bolt || '-', 's'));
ok(STORM.length === 10 && STORM.filter(s => s.fly).length === 2 && STORM[1].fly && !STORM[2].fly, 'the Alta X flies dry and in light rain only');
ok([5, 6, 7, 8, 9].every(i => STORM[i].mph >= STORM[i].range[0] && (STORM[i].range[1] == null || STORM[i].mph <= STORM[i].range[1])), 'each hurricane wind inside its category');
ok(STORM.every((s, i) => !i || s.rain > 0) && STORM.slice(1).every(s => s.fall > 3 && s.fall < 9.65 && s.dropMm > 0.8 && s.dropMm < 3), 'drops and fall speeds in range');
ok([7, 8, 9].every(i => STORM[i].surgeFt) && STORM.slice(0, 7).every(s => !s.surgeFt), 'surge from Category 3 only');
console.log(bad ? bad + ' FAILED' : 'all checks passed'); process.exit(bad ? 1 : 0);
