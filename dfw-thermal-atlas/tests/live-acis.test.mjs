import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { context, load, fakeFetch, same, plain, ROOT, APP } from './helpers/load.mjs';

/* Answers recorded from data.rcc-acis.org on 2026-11-13 by running the collector itself (through date 2026-11-12); see each file's _note. */
const fx = n => JSON.parse(readFileSync(join(ROOT, 'tests', 'fixtures', 'acis', n), 'utf8'));
const W1 = fx('w1-airports-daily-2026-11-13.json'), W2 = fx('w2-station-reductions-2026-11-13.json'), W3 = fx('w3-same-span-1991-2020-2026-11-13.json'), G1 = fx('g1-prism-season-to-date-2026-11-13.json'), G2 = fx('g2-prism-30-fall-mean-2026-11-13.json');
/* the baseline as the app ships it */
const BASE_FILE = readFileSync(join(APP, 'data', 'climate-base.js'), 'utf8'), BASE = JSON.parse(BASE_FILE.slice(BASE_FILE.indexOf('{'), BASE_FILE.lastIndexOf('}') + 1));
const ATLAS_FILE = readFileSync(join(APP, 'data', 'atlas-data.js'), 'utf8'), ATLAS = JSON.parse(ATLAS_FILE.slice(ATLAS_FILE.indexOf('{'), ATLAS_FILE.lastIndexOf('}') + 1));
const fresh = () => load(context(), 'live/core.js', 'live/geo.js', 'live/sources/acis_season.js', 'live/derive.js', 'live/climate.js').TDA_LIVE;
const NOW = new Date('2026-11-13T18:30:00Z');                      // Friday midday in Dallas: yesterday is November 12
const copy = x => JSON.parse(JSON.stringify(x));
/* which of the five requests a call is, from its body */
const kind = init => { const b = JSON.parse(init.body); return b.sids ? 'W1' : b.grid ? (b.elems.some(e => e.smry) ? 'G2' : 'G1') : b.date ? 'W2' : 'W3'; };
const routes = over => [[/^https:\/\/data\.rcc-acis\.org\/(MultiStnData|GridData)$/, (url, init) => { const k = kind(init), r = over && k in over ? over[k] : { W1, W2, W3, G1, G2 }[k]; return typeof r === 'function' ? r(JSON.parse(init.body)) : r; }]];
const sent = (fetch, k) => fetch.calls.filter(c => kind(c.init) === k).map(c => JSON.parse(c.init.body));
const runOnce = async (L, fetch, prev, now) => { const http = L.makeHttp({ fetch, gapMs: 0, backoffMs: 1 }); const data = await L.BY_ID.acis_season.run({ http, now: now || NOW, prev: prev || null, geo: L.geo, settings: {}, env: 'node' }); return { data: copy(data), http }; };
const row = (d, u) => Object.fromEntries(d.std.cols.map((c, i) => [c, d.std[u][i]]));
/* the three ways ACIS reported an error on 2026-11-13, bodies verbatim */
const ERR_400 = { status: 400, body: "bad args: ('elem_2', 'elem_3')\n" }, ERR_200 = { status: 200, body: '{"error":"elem_2: firstlast"}' }, ERR_EMPTY = { status: 200, body: '' };
/* the request bodies the spec verified against the live service, verbatim */
const SPEC_W2 = JSON.parse('{"bbox":"-98.3,32.0,-95.8,33.6","date":"2026-11-12","meta":"name,sids,ll,elev,county,uid","elems":[{"name":"hdd","interval":"dly","duration":"std","season_start":"07-01","reduce":{"reduce":"sum","add":"mcnt"}},{"name":"hdd","interval":"dly","duration":"std","season_start":"07-01","reduce":"sum","normal":"1"},{"name":"hdd","interval":"dly","duration":"std","season_start":"10-01","reduce":{"reduce":"sum","add":"mcnt"}},{"name":"hdd","interval":"dly","duration":7,"reduce":{"reduce":"sum","add":"mcnt"}},{"name":"hdd","interval":"dly","duration":7,"reduce":"sum","normal":"1"},{"name":"hdd","interval":"dly","duration":30,"reduce":{"reduce":"sum","add":"mcnt"}},{"name":"hdd","interval":"dly","duration":30,"reduce":"sum","normal":"1"},{"name":"mint","interval":"dly","duration":"std","season_start":"07-01","reduce":{"reduce":"cnt_le_32","add":"mcnt"}},{"name":"mint","interval":"dly","duration":"std","season_start":"07-01","reduce":"cnt_le_25"},{"name":"mint","interval":"dly","duration":"std","season_start":"07-01","reduce":"first_le_32"},{"name":"mint","interval":"dly","duration":365,"reduce":"last_le_32"},{"name":"mint","interval":"dly","duration":"std","season_start":"07-01","reduce":{"reduce":"min","add":"date"}},{"name":"mint","interval":"dly","duration":7,"reduce":"min"}]}');
const SPEC_W3 = JSON.parse('{"bbox":"-98.3,32.0,-95.8,33.6","sdate":"1991-11-12","edate":"2020-11-12","meta":"name,sids,ll,county,uid","elems":[{"name":"hdd","interval":[1,0,0],"duration":"std","season_start":"07-01","reduce":{"reduce":"sum","add":"mcnt"}},{"name":"mint","interval":[1,0,0],"duration":"std","season_start":"07-01","reduce":{"reduce":"cnt_le_32","add":"mcnt"}},{"name":"mint","interval":[1,0,0],"duration":"std","season_start":"07-01","reduce":"cnt_le_25"},{"name":"mint","interval":[1,0,0],"duration":"std","season_start":"07-01","reduce":"min"}]}');
const SPEC_G1 = JSON.parse('{"bbox":"-98.3,32.0,-95.8,33.6","grid":"21","sdate":"2026-11-10","edate":"2026-11-12","elems":[{"name":"hdd","interval":"dly","duration":"std","season_start":"07-01","reduce":"sum"},{"name":"mint","interval":"dly","duration":"std","season_start":"07-01","reduce":"cnt_le_32"},{"name":"mint","interval":"dly","duration":"std","season_start":"07-01","reduce":"min"},{"name":"hdd","interval":"dly","duration":"std","season_start":"07-01","reduce":"sum","area_reduce":"county_mean"},{"name":"mint","interval":"dly","duration":"std","season_start":"07-01","reduce":"cnt_le_32","area_reduce":"county_mean"},{"name":"mint","interval":"dly","duration":"std","season_start":"07-01","reduce":"min","area_reduce":"county_min"},{"name":"hdd","interval":"dly","duration":7,"reduce":"sum","area_reduce":"county_mean"}]}');
const SPEC_G2 = JSON.parse('{"bbox":"-98.3,32.0,-95.8,33.6","grid":"21","sdate":"1991-11-11","edate":"2020-11-11","elems":[{"name":"hdd","interval":[1,0,0],"duration":"std","season_start":"07-01","reduce":"sum","smry":"mean","smry_only":1},{"name":"hdd","interval":[1,0,0],"duration":"std","season_start":"07-01","reduce":"sum","area_reduce":"county_mean","smry":"mean","smry_only":1},{"name":"mint","interval":[1,0,0],"duration":"std","season_start":"07-01","reduce":"cnt_le_32","area_reduce":"county_mean","smry":"mean","smry_only":1}]}');

/* ---------- the collector ---------- */
test('registered as a weekly source any page can call, with plain words', () => {
  const L = fresh(), s = L.BY_ID.acis_season;
  assert.equal(s.cadence, 'weekly'); assert.equal(s.cors, true); same(s.hosts, ['data.rcc-acis.org']); assert.match(s.grade, /^[A-D](\/[A-D])?$/); assert.match(s.page, /^https:\/\//);
  for (const t of [s.name, s.about, s.publisher, s.terms, ...Object.values(s.labels).map(l => l[0])]) assert.ok(!/[A-Za-z][-–—][A-Za-z]|\s[-–—]\s/.test(t), 'no hyphen or dash between words: ' + t);
  for (const [k, l] of Object.entries(s.labels)) assert.ok(['int', 'f1', 'pct', 'degF', 'usd', 'text', 'idx'].includes(l[1]), k);
});

test('dates: the through date is yesterday in Dallas; the season runs July 1 to June 30', () => {
  const L = fresh(), A = L.acis;
  same(A.dates(NOW), { through: '2026-11-12', season: 2026, start: '2026-07-01', n: 135, md: '11-12', y0: 1991, y1: 2020, gateOct: true });
  assert.equal(A.dates(new Date('2026-11-14T03:30:00Z')).through, '2026-11-12', 'Friday evening in Dallas is still the 13th');
  assert.equal(A.dates(new Date('2026-11-14T07:00:00Z')).through, '2026-11-13', 'after midnight in Dallas');
  same(A.span('2027-03-15'), { through: '2027-03-15', season: 2026, start: '2026-07-01', n: 258, md: '03-15', y0: 1992, y1: 2021, gateOct: true }, 'from January on the 30 climatology years are 1992 to 2021');
  const last = A.span('2027-06-30'), first = A.span('2027-07-01');
  assert.equal(last.season, 2026); assert.equal(last.n, 365); assert.equal(first.season, 2027); assert.equal(first.n, 1); assert.equal(first.start, '2027-07-01'); assert.equal(first.y0, 1991);
  assert.equal(A.span('2028-02-29').md, '02-28', 'the leap day is asked as February 28'); assert.equal(A.span('2028-02-29').n, 244);
  assert.equal(A.span('2026-09-30').gateOct, false); assert.equal(A.span('2026-10-01').gateOct, true);
  assert.equal(A.addDays('2026-11-01', -1), '2026-10-31'); assert.equal(A.dayDiff('2026-11-12', '2026-02-23'), 262);
});

test('numbers arrive as strings: "M" is unknown, add ons are arrays', () => {
  const L = fresh(), A = L.acis;
  assert.equal(A.num('29'), 29); assert.equal(A.num('-2'), -2); assert.equal(A.num('0'), 0); assert.equal(A.num(7), 7); assert.equal(A.num('58.5'), 58.5);
  for (const v of ['M', 'T', '', ' ', 'S', '12A', null, undefined, NaN, {}, []]) assert.equal(A.num(v), null, JSON.stringify(v) + ' is not a number');
  same(A.pair(['29', 0]), ['29', 0]); same(A.pair('157'), ['157', null]); same(A.pair(['47', '2026-10-17']), ['47', '2026-10-17']);
  assert.equal(A.day('2026-02-23'), '2026-02-23'); assert.equal(A.day('M'), null); assert.equal(A.day(null), null);
  const dfw = W2.data.find(r => r.meta.uid === 29755).meta;
  assert.equal(A.sidOf(dfw, 6), 'USW00003927'); assert.equal(A.sidOf(dfw, 5), 'KDFW'); assert.equal(A.sidOf(dfw, 3), 'DFW', 'type 3, not the type 32 entry'); assert.equal(A.sidOf({}, 6), null);
  assert.equal(A.sidOf(W2.data.find(r => r.meta.uid === 23930).meta, 6), 'USC00410058', 'Addison: the GHCN id is the type 6 entry, not the type 32 one');
  same(A.stationOf(dfw), { name: 'DAL-FTW WSCMO AP', label: 'DFW Airport', ghcn: 'USW00003927', icao: 'KDFW', lat: 32.89744, lon: -97.02196, elev: 544, fips: '48439' });
  assert.equal(A.nice('MCKINNEY MUNICIPAL AP'), 'McKinney Municipal Airport'); assert.equal(A.nice('STEPHENVILLE 9NNE'), 'Stephenville 9 NNE'); assert.equal(A.nice('FT WORTH MEACHAM FLD, TX US'), 'Fort Worth Meacham Field'); assert.equal(A.nice('DALLAS FAA AP', 'USW00013960'), 'Dallas Love Field');
});

test('W2: a station row becomes numbers in a fixed order, the gate is applied once, silent stations are left out', () => {
  const L = fresh(), A = L.acis, r = A.parseW2(W2, A.span('2026-11-12'));
  assert.equal(W2.data.length, 64); assert.equal(Object.keys(r.rows).length, 43, '21 closed stations that only have normals are dropped');
  same(A.COLS, ['hdd', 'hddNorm', 'hddOct', 'missOct', 'hdd7', 'miss7', 'hdd7Norm', 'hdd30', 'miss30', 'hdd30Norm', 'fr32', 'fr25', 'firstFreeze', 'lastFreeze', 'minT', 'minDate', 'min7', 'missJul', 'ok']);
  same(r.rows[29755], [29, 157, 29, 0, 10, 0, 54, 29, 0, 143, 0, 0, null, '2026-02-23', 47, '2026-10-17', 50, 0, 1], 'DFW Airport as the spec recorded it');
  same(r.rows[32303].slice(0, 2), [53, null], 'Cleburne Airport has no official normal: "M" is null');
  same([r.rows[32311][3], r.rows[32311][17], r.rows[32311][18]], [0, 49, 1], 'Mesquite Metro lost 49 days in summer and none since October 1: it counts');
  same([r.rows[23812][0], r.rows[23812][2], r.rows[23812][3], r.rows[23812][18]], [0, null, 43, 0], 'Ferris reads 0 heating degree days with every day since October 1 missing: the gate drops it');
  same([r.rows[23929][3], r.rows[23929][18]], [12, 0], 'Richardson: 12 days missing'); same([r.rows[23960][3], r.rows[23960][18]], [3, 1], 'Greenville: 3 days missing is the limit');
  assert.equal(Object.values(r.rows).filter(x => x[18]).length, 32); assert.equal(r.rows[23844], undefined, 'Benbrook Dam closed');
  /* before October the gate reads the count since July 1 */
  const sep = A.parseW2(W2, A.span('2026-09-20')); assert.equal(sep.rows[32311][18], 0, '49 missing since July 1'); assert.equal(sep.rows[23929][18], 0); assert.equal(sep.rows[23812][18], 0); assert.equal(sep.rows[29755][18], 1);
  same(plain(A.parseW2(null, A.span('2026-11-12'))), { stations: {}, rows: {} }); same(plain(A.parseW2({ data: [null, 'x', {}, { meta: { uid: 1 }, data: ['x'] }] }, A.span('2026-11-12'))), { stations: {}, rows: {} }, 'rows that are not station rows are skipped');
});

test('W1 and W3: daily pairs by position, 30 falls with the unusable ones null', () => {
  const L = fresh(), A = L.acis, d = A.parseDaily(W1, 135);
  same(Object.keys(d.tn).sort(), ['100', '23886', '23960', '29755', '32311', '99']);
  assert.equal(d.tn[29755].length, 135); same(d.tn[29755].slice(-3), [59, 56, 51]); same(d.tx[29755].slice(-3), [78, 80, 79]); same([d.tn[29755][0], d.tx[29755][0]], [79, 96], 'July 1: the first pair');
  assert.equal(d.tn[32311].filter(v => v == null).length, 49, 'Mesquite Metro: the summer outage is null, not zero'); assert.equal(A.parseDaily(W1, 140).tn[29755].slice(-5).every(v => v == null), true, 'days the answer does not hold are unknown');
  const w = A.parseW3(W3), keep = A.parseW3(W3, { 29755: 1 });
  same(w.hdd[29755], [347, 119, 291, 140, 193, 167, 228, 169, 77, 217, 104, 207, 103, 78, 76, 153, 54, 59, 132, 85, 137, 129, 125, 128, 38, 13, 109, 223, 289, 174]);
  assert.equal(w.fr32[29755].filter(v => v > 0).length, 8, 'a freeze by November 12 in 8 of 30 falls'); assert.equal(w.minT[29755][0], 25); assert.equal(w.fr25[29755][0], 2);
  assert.equal(w.hdd[23693].filter(v => v != null).length, 18, 'Hillsboro: 18 usable falls'); assert.equal(w.fr32[23693].filter(v => v != null).length, 18, 'one mask for all four lists');
  assert.equal(w.hdd[32311], undefined, 'Mesquite Metro has no fall before 2022'); same(Object.keys(keep.hdd), ['29755']);
  same(plain(A.parseW3({ data: [{ meta: { uid: 5 }, data: [[['1', 0], ['0', 0], '0', '40']] }] })), { hdd: {}, fr32: {}, fr25: {}, minT: {} }, 'a row that is not 30 falls cannot be dated');
  same(plain(A.parseW3({ data: [null, { meta: { uid: 5 }, data: Array(30).fill(null) }] })), { hdd: {}, fr32: {}, fr25: {}, minT: {} }); same(plain(A.parseDaily({ data: [null, { meta: { uid: 5 }, data: [['M', 'M']] }] }, 1)), { stations: {}, tn: {}, tx: {} }, 'a station with no reading at all is left out');
});

test('G1 and G2: the newest finished PRISM day, flat grids from the south, county means', () => {
  const L = fresh(), A = L.acis, g = A.parseG1(G1), n = A.parseG2(G2);
  assert.equal(g.date, '2026-11-11', 'November 12 is all -999 and November 10 is older');
  assert.equal(g.hdd.length, 2480); assert.equal(g.fr32.length, 2480); assert.equal(g.minT.length, 2480); assert.equal(n.hddNorm.length, 2480);
  same(g.hdd.slice(0, 4), G1.data[1][1][0].slice(0, 4), 'the first values are the southern row, from the west'); assert.equal(g.hdd[62], G1.data[1][1][1][0], 'the second row starts at index 62'); assert.equal(g.hdd[2479], G1.data[1][1][39][61]);
  assert.ok(g.hdd.every(v => Number.isInteger(v)) && g.fr32.every(v => v === 0));
  same(g.county['48113'], { hdd: 35.76, hdd7: 12.6, fr32: 0, minT: 44.9 }); same(g.county['48497'], { hdd: 69.83, hdd7: 28.6, fr32: 0, minT: 40.1 }); assert.equal(Object.keys(g.county).length, 13, 'the 12 counties and Somervell');
  same(n.county['48113'], { hddNorm: 154.28, fr32Norm: 0.54 }); same(n.county['48231'], { hddNorm: 187.72, fr32Norm: 0.84 });
  /* a missing cell is unknown, a day PRISM has not made is skipped, a grid of another shape is refused */
  same(A.flat(Array.from({ length: 40 }, (_, j) => Array.from({ length: 62 }, (_, i) => (j === 1 && i === 2 ? -999 : 5)))).filter(v => v == null).length, 1);
  assert.throws(() => A.flat([[1, 2], [3, 4]]), /not 40 by 62/);
  assert.equal(A.parseG1({ data: [G1.data[2]] }), null); assert.equal(A.parseG1({}), null); assert.equal(A.parseG1(null), null);
  assert.throws(() => A.parseG1({ data: [G1.data[0]] }), /not 40 by 62/, 'the trimmed day cannot be mistaken for a whole one');
  assert.throws(() => A.parseG2({ smry: [] }), /incomplete/); assert.throws(() => A.parseG2({ smry: [G2.smry[0]] }), /incomplete/);
});

test('one call, three ways to fail', async () => {
  const L = fresh(), A = L.acis, http = r => L.makeHttp({ fetch: fakeFetch([[/./, r]]), gapMs: 0, backoffMs: 1 });
  same(await A.call(http({ data: [] }), 'W2', 'MultiStnData', { a: 1 }), { data: [] });
  await assert.rejects(() => A.call(http(ERR_400), 'W2', 'MultiStnData', {}), /^Error: W2: ACIS answered HTTP 400 \(bad args: \('elem_2', 'elem_3'\)\)$/);
  await assert.rejects(() => A.call(http(ERR_200), 'G1', 'GridData', {}), /^Error: G1: ACIS reported an error \(elem_2: firstlast\)$/);
  await assert.rejects(() => A.call(http(ERR_EMPTY), 'G2', 'GridData', {}), /^Error: G2: ACIS answered with an empty body$/);
  await assert.rejects(() => A.call(http({ status: 200, body: '<html>busy</html>' }), 'W3', 'MultiStnData', {}), /W3: ACIS did not answer in JSON/);
  await assert.rejects(() => A.call(http({ status: 503, body: 'down' }), 'W1', 'MultiStnData', {}), /W1: ACIS answered HTTP 503/);
  const f = fakeFetch([[/./, { data: [] }]]); await A.call(L.makeHttp({ fetch: f, gapMs: 0 }), 'W2', 'MultiStnData', { bbox: 'x' });
  assert.equal(f.calls[0].url, 'https://data.rcc-acis.org/MultiStnData'); assert.equal(f.calls[0].init.method, 'POST'); same(f.calls[0].init.headers, { 'Content-Type': 'application/json' }); assert.equal(f.calls[0].init.body, '{"bbox":"x"}'); assert.equal(f.calls[0].init.credentials, 'omit');
});

test('a run: five requests, the bodies the spec verified, the stored shape', async () => {
  const L = fresh(), fetch = fakeFetch(routes()), { data, http } = await runOnce(L, fetch);
  assert.equal(http.stats.n, 5); same(fetch.calls.map(c => kind(c.init)), ['W1', 'W2', 'W3', 'G1', 'G2']);
  same(sent(fetch, 'W2')[0], SPEC_W2); same(sent(fetch, 'W3')[0], SPEC_W3); same(sent(fetch, 'G1')[0], SPEC_G1); same(sent(fetch, 'G2')[0], SPEC_G2, 'the 30 fall mean is asked for the PRISM day, November 11');
  const w1 = sent(fetch, 'W1')[0], sids = w1.sids.split(',');
  same({ sdate: w1.sdate, edate: w1.edate, meta: w1.meta, elems: w1.elems }, { sdate: '2026-07-01', edate: '2026-11-12', meta: 'name,sids,ll,elev,county,uid', elems: [{ name: 'mint' }, { name: 'maxt' }] });
  assert.equal(sids[0], 'KDFW'); assert.equal(new Set(sids).size, sids.length); assert.ok(sids.includes('KGPM'), 'Grand Prairie is read besides the paired stations');
  for (const p of L.geo.points) if (p.stn) assert.ok(sids.includes(p.stn), 'the station paired with ' + p.name);
  same(Object.keys(data), ['v', 'fetched', 'season', 'through', 'asked', 'stations', 'std', 'daily', 'todate', 'grid', 'county', 'blocks', 'stale', 'errs']);
  same([data.v, data.fetched, data.season, data.through, data.asked], [1, '2026-11-13T18:30:00.000Z', 2026, '2026-11-12', '2026-11-12']);
  same(data.blocks, { W1: '2026-11-12', W2: '2026-11-12', W3: '2026-11-12', G1: '2026-11-11', G2: '2026-11-11' }); same(data.stale, {}); same(data.errs, {});
  assert.equal(Object.keys(data.stations).length, 43); same(data.stations['29755'], { name: 'DAL-FTW WSCMO AP', label: 'DFW Airport', ghcn: 'USW00003927', icao: 'KDFW', lat: 32.89744, lon: -97.02196, elev: 544, fips: '48439' });
  same(row(data, '29755'), { hdd: 29, hddNorm: 157, hddOct: 29, missOct: 0, hdd7: 10, miss7: 0, hdd7Norm: 54, hdd30: 29, miss30: 0, hdd30Norm: 143, fr32: 0, fr25: 0, firstFreeze: null, lastFreeze: '2026-02-23', minT: 47, minDate: '2026-10-17', min7: 50, missJul: 0, ok: 1 });
  same([data.daily.start, data.daily.n, Object.keys(data.daily.tn).length, data.daily.tn['29755'].length], ['2026-07-01', 135, 6, 135]);
  same([data.todate.md, data.todate.years[0], data.todate.years[29], data.todate.years.length], ['11-12', 1991, 2020, 30]); assert.ok(Object.keys(data.todate.hdd).every(u => data.std[u]), 'only stations in this week\'s table');
  same([data.grid.date, data.grid.ny, data.grid.nx, data.grid.lat0, data.grid.lon0, data.grid.step], ['2026-11-11', 40, 62, 32, -98.333333, 0.0416666667]);
  for (const k of ['hdd', 'fr32', 'minT', 'hddNorm']) assert.equal(data.grid[k].length, 2480, k);
  same(data.county['48113'], { hdd: 35.76, hdd7: 12.6, fr32: 0, minT: 44.9, hddNorm: 154.28, fr32Norm: 0.54 });
  assert.ok(!/<\/script/i.test(JSON.stringify(data)));
});

test('the digest for the week over week table', async () => {
  const L = fresh(), { data } = await runOnce(L, fakeFetch(routes())), s = L.BY_ID.acis_season;
  same(s.digest(data), { hdd: 29, norm: 157, pct: 18, fr32: 0, stations: 32, freezeCounties: 0, through: '2026-11-12' });
  same(Object.keys(s.digest(data)).sort(), Object.keys(s.labels).sort(), 'every digest number has a label');
  const cold = copy(data), I = k => cold.std.cols.indexOf(k);
  cold.std['100'][I('firstFreeze')] = '2026-11-10'; cold.std['100'][I('fr32')] = 2; cold.county['48497'].fr32 = 0.4; cold.county['48425'].fr32 = 1; cold.std['29755'][I('fr32')] = 1;
  same([s.digest(cold).freezeCounties, s.digest(cold).fr32], [3, 1], 'Denton and Tarrant by a station, Wise by the grid; Somervell is not one of the 12');
  const gaps = copy(data); gaps.std['29755'][I('ok')] = 0; same([s.digest(gaps).hdd, s.digest(gaps).pct, s.digest(gaps).norm, s.digest(gaps).stations], [null, null, 157, 31], 'a gated reading is not shown');
  same(s.digest({ through: null }), { hdd: null, norm: null, pct: null, fr32: null, stations: 0, freezeCounties: 0, through: null });
});

test('when yesterday has not arrived at DFW Airport the whole run ends a day earlier', async () => {
  const L = fresh(), late = copy(W1); late.data.find(r => r.meta.uid === 29755).data[134] = ['M', 'M'];
  const fetch = fakeFetch(routes({ W1: late })), { data } = await runOnce(L, fetch);
  same([data.through, data.asked, data.daily.n, data.daily.tn['29755'].length, data.daily.tn['99'].length], ['2026-11-11', '2026-11-12', 134, 134, 134]);
  assert.equal(sent(fetch, 'W2')[0].date, '2026-11-11'); same([sent(fetch, 'W3')[0].sdate, sent(fetch, 'W3')[0].edate], ['1991-11-11', '2020-11-11']); same([sent(fetch, 'G1')[0].sdate, sent(fetch, 'G1')[0].edate], ['2026-11-09', '2026-11-11']);
  /* the spec's own rule, when the daily call is not there to tell: DFW Airport "M" in the table means one day back, once */
  const noDfw = copy(W2); noDfw.data.find(r => r.meta.uid === 29755).data = [['M', 135], '157', ['M', 43], ['M', 7], '54', ['M', 30], '143', ['M', 135], 'M', 'M', 'M', ['M', 'M'], 'M'];
  let n = 0; const f2 = fakeFetch(routes({ W1: ERR_EMPTY, W2: () => (++n === 1 ? noDfw : W2) })), r2 = await runOnce(L, f2);
  same(sent(f2, 'W2').map(b => b.date), ['2026-11-12', '2026-11-11']); assert.equal(r2.data.through, '2026-11-11'); assert.equal(r2.data.blocks.W1, null); assert.match(r2.data.errs.W1, /empty body/);
  /* most airports late while DFW Airport is in: still a day back */
  const most = copy(W1); most.data.filter(r => r.meta.uid !== 29755).slice(0, 4).forEach(r => { r.data[134] = ['M', 'M']; });
  assert.equal((await runOnce(L, fakeFetch(routes({ W1: most })))).data.through, '2026-11-11'); most.data[3].data[134] = ['42', '78']; most.data[4].data[134] = ['42', '77'];
  const few = await runOnce(L, fakeFetch(routes({ W1: most }))); same([few.data.through, few.data.daily.n], ['2026-11-12', 135], 'two late airports of six do not hold the run back');
  /* without the daily call, a day missing in DFW Airport's last seven is read the same way; with it, an older gap is not */
  const gap = copy(W2); gap.data.find(r => r.meta.uid === 29755).data[3] = ['10', 1];
  const f3 = fakeFetch(routes({ W1: ERR_EMPTY, W2: gap })); assert.equal((await runOnce(L, f3)).data.through, '2026-11-11'); same(sent(f3, 'W2').map(b => b.date), ['2026-11-12', '2026-11-11'], 'asked once more, not a third time');
  const f4 = fakeFetch(routes({ W2: gap })), r4 = await runOnce(L, f4); same([r4.data.through, sent(f4, 'W2').length], ['2026-11-12', 1]);
});

test('a block that fails keeps last week\'s copy with its own through date; nothing usable throws', async () => {
  const L = fresh(), first = (await runOnce(L, fakeFetch(routes()))).data;
  /* last week's record: the same answers, dated a week earlier */
  const prev = copy(first); prev.through = '2026-11-05'; prev.blocks = { W1: '2026-11-05', W2: '2026-11-05', W3: '2026-11-05', G1: '2026-11-04', G2: '2026-11-04' }; prev.todate.md = '11-05'; prev.grid.date = '2026-11-04'; prev.daily.n = 128; prev.grid.hdd[0] = 11; prev.county['48113'].hdd = 20; prev.county['48113'].hddNorm = 100;
  /* W3 refused, PRISM without a finished day */
  const f = fakeFetch(routes({ W3: ERR_400, G1: { data: [G1.data[2]] } })), { data, http } = await runOnce(L, f, prev);
  assert.equal(http.stats.n, 4, 'the 30 fall mean is not asked for a grid that did not arrive');
  same(data.blocks, { W1: '2026-11-12', W2: '2026-11-12', W3: '2026-11-05', G1: '2026-11-04', G2: '2026-11-04' }); same(data.stale, { W3: '2026-11-05', G1: '2026-11-04' });
  assert.match(data.errs.W3, /^W3: ACIS answered HTTP 400 \(bad args/); assert.match(data.errs.G1, /^G1: PRISM has not finished/); assert.equal(data.errs.G2, undefined, 'the kept grid still has its own 30 fall mean');
  same([data.through, data.todate.md, data.grid.date, data.grid.hdd[0], data.county['48113'].hdd, data.county['48113'].hddNorm], ['2026-11-12', '11-05', '2026-11-04', 11, 20, 100]);
  const st = L.climate.status(data, BASE, NOW);
  same(st.stale.map(x => [x.id, x.through]), [['W3', '2026-11-05'], ['G1', '2026-11-04']]); assert.match(st.stale[0].why, /HTTP 400/); assert.equal(st.metro.hdd, 29); assert.equal(st.metro.rank, null, 'no rank against falls cut on another day');
  assert.equal(st.gridThrough, '2026-11-04'); assert.equal(st.counties.find(c => c.name === 'Dallas').pct, 20, 'the kept grid and its own normal still belong together');
  /* the grid arrives but its 30 fall mean does not: last week's mean stays stored, and is not divided into this week's total */
  const g = await runOnce(L, fakeFetch(routes({ G2: ERR_200 })), prev);
  same([g.data.blocks.G1, g.data.blocks.G2, g.data.stale.G2, g.data.county['48113'].hdd, g.data.county['48113'].hddNorm], ['2026-11-11', '2026-11-04', '2026-11-04', 35.76, 100]); assert.match(g.data.errs.G2, /elem_2: firstlast/);
  const gs = L.climate.status(g.data, BASE, NOW).counties.find(c => c.name === 'Dallas'); same([gs.hdd, gs.hddNorm, gs.pct], [35.8, null, null]);
  assert.equal(L.climate.zip(32.7734, -96.6188, g.data, BASE, '75149').hddNormToDate, null); assert.equal(L.climate.zip(32.7734, -96.6188, g.data, BASE, '75149').hddToDate, 33);
  /* the station table fails: last week's table and its date stay, the airports and grids are new */
  const w = await runOnce(L, fakeFetch(routes({ W2: ERR_EMPTY })), prev);
  same([w.data.through, w.data.blocks.W2, w.data.stale.W2, w.data.blocks.W1, Object.keys(w.data.stations).length], ['2026-11-05', '2026-11-05', '2026-11-05', '2026-11-12', 43]); assert.match(w.data.errs.W2, /empty body/);
  /* nothing to keep on a first run, and nothing kept from another season */
  const none = await runOnce(L, fakeFetch(routes({ W3: ERR_400 })));
  same([none.data.todate, none.data.blocks.W3, none.data.stale.W3], [null, null, null]); assert.equal(L.climate.status(none.data, BASE, NOW).metro.hdd, 29);
  const old = copy(prev); old.blocks = { W1: '2026-06-20', W2: '2026-06-20', W3: '2026-06-20', G1: '2026-06-18', G2: '2026-06-18' };
  const o = await runOnce(L, fakeFetch(routes({ W3: ERR_400, G1: ERR_EMPTY })), old); same([o.data.todate, o.data.grid, o.data.county, o.data.stale], [null, null, null, { W3: null, G1: null, G2: null }]);
  /* every request down: the run fails and the core keeps the last good record */
  await assert.rejects(() => runOnce(L, fakeFetch([[/./, { status: 503, body: 'down' }]]), prev), /W2: ACIS answered HTTP 503/);
  await assert.rejects(() => runOnce(L, fakeFetch(routes({ W1: ERR_EMPTY, W2: ERR_400, W3: ERR_400, G1: ERR_200 }))), /W2: ACIS answered HTTP 400/);
  /* history alone is not news: with the table, the airports and the grid all down, the 30 falls arriving does not make a run */
  await assert.rejects(() => runOnce(L, fakeFetch(routes({ W1: ERR_EMPTY, W2: ERR_EMPTY, G1: ERR_200 })), prev), /W2: ACIS answered with an empty body/);
});

test('history is not asked for twice: a second run the same day makes three requests', async () => {
  const L = fresh(), first = (await runOnce(L, fakeFetch(routes()))).data, f = fakeFetch(routes()), { data, http } = await runOnce(L, f, first, new Date('2026-11-13T22:00:00Z'));
  assert.equal(http.stats.n, 3); same(f.calls.map(c => kind(c.init)), ['W1', 'W2', 'G1']); same(data.stale, {}); same(data.blocks, first.blocks); same(data.todate, first.todate); same(data.grid.hddNorm, first.grid.hddNorm); same(data.county, first.county);
  /* a record that holds the falls and the grid mean of earlier days asks again */
  const older = copy(first); older.blocks.W3 = '2026-11-11'; older.blocks.G2 = '2026-11-10'; const next = fakeFetch(routes()), again = await runOnce(L, next, older);
  assert.equal(again.http.stats.n, 5); same(again.data.blocks, first.blocks); same(again.data.stale, {});
});

test('through the runner: a record with its digest, and the size it stays under', async () => {
  const L = fresh(), store = L.memoryStore(), fetch = fakeFetch(routes());
  const r = await L.refresh({ scope: ['acis_season'], store, fetch, env: 'node', now: () => NOW, http: { gapMs: 0, backoffMs: 1 } });
  same(r.ran, ['acis_season']); const rec = await store.get(L.K.src('acis_season'));
  assert.equal(rec.ok, true); assert.equal(rec.n, 5); same(rec.digest, { hdd: 29, norm: 157, pct: 18, fr32: 0, stations: 32, freezeCounties: 0, through: '2026-11-12' });
  /* the end of a season, with every airport: 366 days of two and three digit readings, four digit grid totals */
  const big = copy(rec.data), uids = Array.from({ length: 19 }, (_, i) => String(90000 + i));
  big.daily = { start: '2027-07-01', n: 366, tn: Object.fromEntries(uids.map(u => [u, Array(366).fill(-10)])), tx: Object.fromEntries(uids.map(u => [u, Array(366).fill(101)])) };
  for (const k of ['hdd', 'hddNorm']) big.grid[k] = Array(2480).fill(2955); big.grid.fr32 = Array(2480).fill(66); big.grid.minT = Array(2480).fill(-10);
  const all = Object.keys(big.std).filter(u => u !== 'cols'); for (const k of ['hdd', 'fr32', 'fr25', 'minT']) big.todate[k] = Object.fromEntries(all.map(u => [u, Array(30).fill(k === 'hdd' ? 2955 : k === 'minT' ? -10 : 66)]));
  const size = JSON.stringify(big).length, today = JSON.stringify(rec.data).length;
  assert.ok(size < 150 * 1024, `the largest record of a season is ${Math.round(size / 1024)} KB`); assert.ok(today < 80 * 1024, `this week's record from the trimmed fixtures is ${Math.round(today / 1024)} KB`);
});

/* ---------- the pure reads ---------- */
test('sample: between the four cell centres around a place; null outside the box or beside a missing cell', () => {
  const L = fresh(), C = L.climate, g = Array.from({ length: 2480 }, (_, k) => 100 * Math.floor(k / 62) + (k % 62));      // value = 100 × row + column
  const lat = j => 32.0 + j / 24, lon = i => -98.333333 + i / 24, near = (a, b) => Math.abs(a - b) < 1e-6;
  assert.ok(near(C.sample(g, lat(0), lon(0)), 0)); assert.ok(near(C.sample(g, lat(3), lon(5)), 305)); assert.ok(near(C.sample(g, lat(39), lon(61)), 3961), 'the last cell centre');
  assert.ok(near(C.sample(g, lat(3.5), lon(5.25)), 355.25), 'half a row north, a quarter of a column east'); assert.ok(near(C.sample(g, lat(-0.4), lon(5)), 5), 'inside the outer half cell the edge value holds');
  assert.equal(C.sample(g, lat(-0.6), lon(5)), null); assert.equal(C.sample(g, lat(39.6), lon(5)), null); assert.equal(C.sample(g, lat(3), lon(-0.6)), null); assert.equal(C.sample(g, lat(3), lon(61.6)), null);
  assert.equal(C.sample(g, 29.76, -95.37), null, 'Houston is not on the grid');
  const hole = g.slice(); hole[3 * 62 + 6] = null; assert.equal(C.sample(hole, lat(3.5), lon(5.5)), null); assert.ok(near(C.sample(hole, lat(3.5), lon(3.5)), 353.5)); hole[0] = -999; assert.equal(C.sample(hole, lat(0.2), lon(0.2)), null);
  for (const bad of [null, undefined, [], [1, 2, 3], 'x']) assert.equal(C.sample(bad, 32.8, -96.8), null); assert.equal(C.sample(g, null, -96.8), null); assert.equal(C.sample(g, 32.8, NaN), null);
  assert.equal(C.cell(g, lat(3.4), lon(5.6)), 306, 'cell: the one cell the place falls in'); assert.equal(C.cell(g, 29.76, -95.37), null); assert.equal(C.cell(hole, lat(0), lon(0)), null);
  assert.ok(near(C.sample([1, 2, 3, 4], 10.5, 20.5, { ny: 2, nx: 2, lat0: 10, lon0: 20, step: 1 }), 2.5), 'a block can bring its own geometry');
  /* on the real grids: the cells the spec read by point query on 2026-11-13 */
  assert.equal(C.cell(BASE.prism.hdd, 32.77, -96.60), 2431); assert.equal(C.cell(BASE.prism.hdd, 33.21, -97.13), 2594); assert.equal(C.cell(BASE.prism.hdd, 32.76, -97.80), 2796);
  const week = L.acis.parseG1(G1); assert.equal(C.cell(week.hdd, 32.77, -96.60), 34); assert.equal(C.cell(week.hdd, 33.21, -97.13), 55); assert.equal(C.cell(week.hdd, 32.76, -97.80), 62);
  assert.ok(Math.abs(C.sample(BASE.prism.hdd, 32.89744, -97.02196) - 2291.4) < 0.05, 'the grid at DFW Airport, as the spec has it');
});

test('status reproduces what the spec observed through 2026-11-12', async () => {
  const L = fresh(), { data } = await runOnce(L, fakeFetch(routes())), s = L.climate.status(data, BASE, NOW), m = s.metro;
  same([s.ok, s.through, s.season, s.today, s.ageDays, s.overdue, s.gridThrough, s.gridNormal, s.stale], [true, '2026-11-12', 2026, '2026-11-13', 1, false, '2026-11-11', true, []]);
  same([m.station, m.hdd, m.norm, m.pct, m.dep], ['DFW Airport', 29, 157, 18, -128]);
  same(m.rank, { n: 2, of: 31, text: 'second lowest', mean: 145.5, low: 13, lowYear: 2016, high: 347, highYear: 1991 });
  same([m.hdd7, m.hdd7Norm, m.pct7, m.hdd30, m.hdd30Norm, m.pct30], [10, 54, 19, 29, 143, 20]);
  same([m.fr32, m.fr25, m.fr32Norm, m.fr32NormFrom, m.freezeBy, m.minT, m.minDate, m.min7, m.lastFreeze, m.daysSinceFreeze], [0, 0, 0.67, 'station', { n: 8, of: 30 }, 47, '2026-10-17', 50, '2026-02-23', 262]);
  same(m.firstFreeze, { state: 'pending', date: null, daysVsMedian: null, climChance: 25, climText: '25', daysToMedian: 11, median: '2026-11-24', p10: '2026-11-06', p90: '2026-12-12', src: 'NCEI', from: null, seasons: 30 });
  same([m.normHdd, m.normFr32, m.vsDfw, m.record, m.county, m.icao], [2220.2, 29.2, { ratio: 1, freeze: 1, src: 'NCEI' }, 30, 'Tarrant', 'KDFW']);
  /* counties, coldest first, with the share of the 30 fall mean */
  same(s.counties.map(c => c.name), ['Wise', 'Parker', 'Hunt', 'Hood', 'Denton', 'Collin', 'Johnson', 'Tarrant', 'Ellis', 'Rockwall', 'Kaufman', 'Dallas']);
  same(s.counties.map(c => [c.hdd, c.hddNorm, c.pct]), [[69.8, 216.1, 32], [61.8, 202.7, 30], [61, 187.7, 33], [59.3, 183.6, 32], [54.5, 187.6, 29], [51.6, 185.5, 28], [49.9, 167.3, 30], [46, 159.7, 29], [43.1, 160.5, 27], [42.3, 172.9, 24], [41.3, 166.6, 25], [35.8, 154.3, 23]]);
  same(s.counties.map(c => [c.normHdd, c.normFr32]), [[2743, 52], [2622, 51.5], [2584, 41.5], [2478, 47.7], [2585, 41.7], [2572, 39.2], [2377, 36.7], [2348, 33], [2334, 33.3], [2458, 35.6], [2414, 35.8], [2308, 28.8]]);
  same(s.counties.map(c => c.exposureHomes), [1.137, 1.131, 1.085, 1.027, 1.039, 1.063, 0.994, 0.98, 0.988, 1.033, 1.013, 0.962], 'the housing weighted ratios of spec section 3.5');
  const dal = s.counties.find(c => c.name === 'Dallas'); same([dal.fips, dal.fr32, dal.fr32Norm, dal.minT, dal.hdd7, dal.dep, dal.exposure, dal.normFr25], ['48113', 0, 0.54, 44.9, 12.6, -118.5, 0.969, 7.2]);
  assert.ok(s.counties.every(c => c.firstFreeze && c.firstFreeze.state === 'pending' && c.firstFreeze.station), 'no county has had a freeze, and each names its station');
  const ff = n => { const f = s.counties.find(c => c.name === n).firstFreeze; return [f.station, f.median, f.climChance, f.daysToMedian, f.src, f.nearby]; };
  same(ff('Tarrant'), ['Fort Worth Alliance Airport', '2026-11-17', 42, 4, 'NCEI', false], 'of six complete stations with official dates, the one that normally freezes first'); same(ff('Dallas'), ['Dallas Executive Airport', '2026-11-25', 22, 12, 'NCEI', false]); same(ff('Denton'), ['Denton Municipal Airport', '2026-11-07', 66, -6, 'NCEI', false]);
  same(ff('Collin'), ['McKinney Municipal Airport', '2026-11-11', 54, -2, 'NCEI', false]); same(ff('Kaufman'), ['Terrell Municipal Airport', '2026-11-18', 38, 5, 'NCEI', false]);
  same(ff('Parker'), ['Mineral Wells Airport', '2026-11-10', 60, -3, 'NCEI', true], 'Weatherford has gaps: the nearest complete station speaks for Parker County, and says so');
  same(ff('Hood'), ['Granbury Municipal Airport', '2026-11-13', 58, 0, 'ACIS', false], 'no official normals: the airport\'s own 12 seasons'); same(ff('Wise'), ['Bridgeport Municipal Airport', '2026-11-02', 70, -11, 'ACIS', false], 'Bridgeport before Decatur: the earlier of two ten season records');
  same(s.counties.map(c => [c.firstFreeze.stationsOk, c.firstFreeze.stationsWithFreeze]), [[2, 0], [0, 0], [1, 0], [1, 0], [1, 0], [1, 0], [1, 0], [8, 0], [1, 0], [1, 0], [1, 0], [4, 0]]);
  const rock = s.counties.find(c => c.name === 'Rockwall').firstFreeze; same([rock.station, rock.src, rock.from, rock.median], ['Rockwall Municipal Airport', 'NCEI nearby', 'Lavon Dam', '2026-11-19'], 'nine seasons are too few: the nearest official dates, named');
  /* stations */
  assert.equal(s.stations.length, 43); assert.equal(s.stations.filter(x => x.ok).length, 32); assert.equal(s.stations.filter(x => x.metro).length, 31); assert.ok(s.stations.slice(0, 31).every(x => x.metro), 'the 12 counties first');
  const by = u => s.stations.find(x => x.uid === String(u));
  same(Object.keys(by(99)).slice(0, 12), ['uid', 'name', 'acisName', 'icao', 'ghcn', 'county', 'metro', 'fips', 'lat', 'lon', 'elev', 'ok']);
  same([by(99).name, by(99).county, by(99).hdd, by(99).hddNorm, by(99).pct, by(99).rank.n, by(99).rank.of, by(99).rank.low, by(99).rank.lowYear, by(99).daysSinceFreeze], ['Dallas Love Field', 'Dallas', 23, 130, 18, 2, 31, 9, 2016, 284]);
  same([by(24001).county, by(24001).metro, by(24001).hdd, by(24001).rank.n, by(24001).rank.of, by(24001).rank.text, by(24001).rank.lowYear], ['Jack', false, 85, 1, 19, 'lowest', 1999], 'Jacksboro: its lowest total to this date');
  same([by(29493).rank.n, by(29493).rank.of, by(29493).rank.text], [3, 21, 'third lowest']); same([by(29489).fr32Norm, by(29489).freezeBy], [0.41, { n: 6, of: 22 }], 'Terrell, as the spec counted it');
  same([by(23929).ok, by(23929).miss, by(23929).hdd, by(23929).hddNorm, by(23929).pct, by(23929).fr32, by(23929).firstFreeze, by(23929).minT, by(23929).lastFreeze], [false, 12, null, 168, null, null, null, 47, '2026-02-01'], 'Richardson has gaps: no total, no "no freeze yet"');
  same([by(23812).ok, by(23812).hdd, by(23812).dep], [false, null, null], 'Ferris is not "0 heating degree days, 167 below normal"');
  same([by(32311).name, by(32311).ok, by(32311).hdd, by(32311).hddNorm, by(32311).pct, by(32311).rank, by(32311).fr32Norm, by(32311).fr32NormFrom, by(32311).vsDfw, by(32311).record], ['Mesquite Metro Airport', true, 27, null, null, null, 0.54, 'county', { ratio: 1.072, freeze: 1.27, src: 'PRISM' }, null]);
  same([by(100).vsDfw, by(100).firstFreeze.climChance, by(23883).vsDfw, by(101).vsDfw.ratio, by(32320).vsDfw], [{ ratio: 1.188, freeze: 1.77, src: 'NCEI' }, 66, { ratio: 1.188, freeze: 2.08, src: 'NCEI' }, 0.896, { ratio: 1.2, freeze: 1.92, src: 'PRISM' }]);
  /* first freeze chances by tomorrow, read between the official decile dates (spec section 8) */
  same([by(23850), by(101), by(23898), by(23879), by(24396), by(29493)].map(x => [x.firstFreeze.climChance, x.firstFreeze.daysToMedian]), [[22, 12], [21, 14], [33, 6], [30, 7], [42, 4], [32, 8]]);
  same(s.grades, { metro: 'A', stations: 'A', series: 'A', rank: 'B', firstFreeze: 'B', counties: 'C', zip: 'C' });
  assert.equal(L.climate.headline(s), 'Heating season to date: 29 heating degree days at DFW Airport against a normal of 157 (18%), second lowest to this date among 31 falls; no freeze yet, the median first freeze is November 24.');
});

test('the accumulation curve and the last nights', async () => {
  const L = fresh(), { data } = await runOnce(L, fakeFetch(routes())), s = L.climate.status(data, BASE, NOW).series;
  same([s.station, s.uid, s.start, s.through, s.days.length, s.total, s.normTotal, s.missing], ['DFW Airport', '29755', '2026-07-01', '2026-11-12', 135, 29, 157.2, 0], 'the days add up to the publisher\'s own 29 against 157');
  same(s.days[134], { d: '2026-11-12', tn: 51, tx: 79, hdd: 0, cum: 29, normCum: 157.2 }); same(s.days[0].d, '2026-07-01'); assert.equal(s.days[0].hdd, 0); assert.equal(s.days[0].normCum, 0);
  const cold = s.days.filter(x => x.hdd > 0); assert.equal(cold.reduce((t, x) => t + x.hdd, 0), 29); assert.equal(cold[0].d >= '2026-10-01', true);
  assert.equal(L.climate.hddOf(47, 70), 6, '58.5 rounds to 59 before the subtraction'); assert.equal(L.climate.hddOf(51, 79), 0); assert.equal(L.climate.hddOf(null, 70), null); assert.equal(L.climate.hddOf(20, 31), 39);
  const mesq = L.climate.series(data, BASE, 32311); same([mesq.station, mesq.missing, mesq.normTotal, mesq.days[134].normCum], ['Mesquite Metro Airport', 49, null, null], 'daily normals exist for DFW Airport only');
  assert.equal(mesq.days.find(x => x.d === '2026-08-15').hdd, null); assert.equal(L.climate.series(data, BASE, 999), null); assert.equal(L.climate.series(null, BASE), null);
  const n = L.climate.nights(data, 14), dfw = n.find(x => x.uid === '29755');
  assert.equal(n.length, 6); same([dfw.name, dfw.icao, dfw.county, dfw.nights.length, dfw.nights[0].d, dfw.nights[13]], ['DFW Airport', 'KDFW', 'Tarrant', 14, '2026-10-30', { d: '2026-11-12', tn: 51, tx: 79 }]);
  same([n.find(x => x.uid === '23886').county, L.climate.nights(data).length, L.climate.nights(data, 3)[0].nights.length], ['Palo Pinto', 6, 3]); same(L.climate.nights(null, 14), []); same(L.climate.nights({}, 14), []);
});

test('zip: the baked exposure, the season to date from the grids, the stations when there is no grid', async () => {
  const L = fresh(), { data } = await runOnce(L, fakeFetch(routes())), Z = (zip, d, b) => { const r = ATLAS.zrows.find(x => x[0] === zip); return L.climate.zip(r[ATLAS.zcols.indexOf('lat')], r[ATLAS.zcols.indexOf('lon')], d, b === undefined ? BASE : b, zip); };
  const mesq = Z('75149', data);
  same(mesq, { exposure: 1.002, freezeExposure: 0.97, normHdd: 2386, normFr32: 31.7, hddToDate: 33, hddNormToDate: 164, pct: 20, fr32ToDate: 0, seasonMin: 47, through: '2026-11-11', from: 'grid', firstFreezeNearby: null, lastFreeze: '2026-03-17',
    near: [{ name: 'Mesquite Metro Airport', uid: '32311', km: 8.8 }, { name: 'Dallas Love Field', uid: '99', km: 21.5 }, { name: 'Rockwall Municipal Airport', uid: '79765', km: 24.5 }], grade: 'C' });
  same([Z('75150', data).exposure, Z('75181', data).exposure, Z('75247', data).exposure, Z('76487', data).exposure], [0.989, 1.028, 0.887, 1.207], 'Mesquite, and the warmest and coldest ZIP of the metro');
  const den = Z('76201', data); same([den.exposure > 1.05, den.normHdd > 2500, den.hddToDate > mesq.hddToDate, den.pct, den.near[0].name], [true, true, true, 29, 'Denton Municipal Airport'], 'Denton is colder than Mesquite, in the normals and this fall');
  /* without the ZIP code the same place is sampled: the same exposure to three decimals */
  const r = ATLAS.zrows.find(x => x[0] === '75149'), pt = L.climate.zip(r[ATLAS.zcols.indexOf('lat')], r[ATLAS.zcols.indexOf('lon')], data, BASE); same([pt.exposure, pt.normHdd, pt.normFr32], [1.002, 2386, 31.7]);
  same([L.climate.zip(33.21, -97.13, data, BASE).hddToDate, L.climate.zip(32.76, -97.80, data, BASE).hddToDate], [55, 62], 'Denton and Weatherford, as the spec read them');
  /* no weekly record: the static side still answers; no baseline: the weekly side still answers; neither: nulls */
  same(Z('75149', null), { exposure: 1.002, freezeExposure: 0.97, normHdd: 2386, normFr32: 31.7, hddToDate: null, hddNormToDate: null, pct: null, fr32ToDate: null, seasonMin: null, through: null, from: null, firstFreezeNearby: null, lastFreeze: null, near: [], grade: 'C' });
  same([Z('75149', data, null).exposure, Z('75149', data, null).normHdd, Z('75149', data, null).hddToDate, Z('75149', data, null).pct], [null, null, 33, 20]);
  const nothing = L.climate.zip(null, null, null, null); same([nothing.exposure, nothing.hddToDate, nothing.near, nothing.from], [null, null, [], null]); assert.equal(L.climate.zip(29.76, -95.37, data, BASE).exposure, null, 'outside the box');
  /* the grid block missing: the three nearest complete stations, and a share of normal only from stations that have a normal */
  const bare = copy(data); bare.grid = null; bare.county = null; bare.blocks.G1 = bare.blocks.G2 = null;
  same((({ hddToDate, hddNormToDate, pct, fr32ToDate, seasonMin, through, from }) => ({ hddToDate, hddNormToDate, pct, fr32ToDate, seasonMin, through, from }))(Z('75149', bare)), { hddToDate: 28, hddNormToDate: 140, pct: 21, fr32ToDate: 0, seasonMin: 45, through: '2026-11-12', from: 'stations' });
  /* a freeze at one of the three nearest stations shows up */
  const frz = copy(data); frz.std['79765'][frz.std.cols.indexOf('firstFreeze')] = '2026-11-09'; assert.equal(Z('75149', frz).firstFreezeNearby, '2026-11-09');
});

test('first freeze: read between the official dates, counted in a station\'s own seasons, bounded at the ends', () => {
  const L = fresh(), C = L.climate, dfw = { ghcn: 'USW00003927', lat: 32.89744, lon: -97.02196 }, c = C.climOf(BASE, dfw, '29755', 2026);
  same([c.src, c.median, c.p10, c.p90, c.dec.length], ['NCEI', '2026-11-24', '2026-11-06', '2026-12-12', 9]);
  same([C.chanceBy(c, '2026-11-13'), C.chanceBy(c, '2026-11-06'), C.chanceBy(c, '2026-12-12'), C.chanceBy(c, '2026-11-24')], [{ v: 25, text: '25' }, { v: 10, text: '10' }, { v: 90, text: '90' }, { v: 50, text: '50' }]);
  same([C.chanceBy(c, '2026-11-05'), C.chanceBy(c, '2026-12-13'), C.chanceBy(null, '2026-11-13'), C.chanceBy(c, null)], [{ v: null, text: 'under 10' }, { v: null, text: 'over 90' }, { v: null, text: null }, { v: null, text: null }]);
  /* the station's own 30 seasons when it has no official dates: DFW Airport's ACIS record gives November 25, as the spec found */
  const own = C.climOf(BASE, { lat: 32.89744, lon: -97.02196 }, '29755', 2026); same([own.src, own.n, own.median, own.p10, own.p90], ['ACIS', 30, '2026-11-25', '2026-11-05', '2026-12-08']);
  assert.equal(C.chanceBy(own, '2026-11-13').v, 33, '10 of 30 seasons had frozen by November 13'); assert.equal(C.chanceBy(own, '2026-10-29').v, 0); assert.equal(C.chanceBy(own, '2026-12-21').v, 100);
  same([C.climOf(BASE, {}, '32303', 2026).median, C.climOf(BASE, {}, '32303', 2026).n, C.climOf(BASE, {}, '32320', 2026).median, C.climOf(BASE, {}, '32305', 2026).median], ['2026-11-12', 12, '2026-11-02', '2026-11-24'], 'Cleburne, Bridgeport and Decatur airports, as the spec has them');
  const near = C.climOf(BASE, { lat: 32.93059, lon: -96.43548 }, '79765', 2026); same([near.src, near.from, near.km, near.median], ['NCEI nearby', 'Lavon Dam', 13, '2026-11-19']);
  assert.equal(C.climOf(BASE, { lat: 29.76, lon: -95.37 }, '1', 2026), null); assert.equal(C.climOf(null, dfw, '29755', 2026), null); assert.equal(C.climOf(BASE, dfw, '29755', null), null);
  same([C.inSeason('11/24', 2026), C.inSeason('03/08', 2026), C.inSeason('02/29', 2026), C.inSeason('02/29', 2027), C.inSeason('07/01', 2026), C.pretty('2026-11-24'), C.pretty('2027-03-08'), C.pretty(null)], ['2026-11-24', '2027-03-08', '2027-02-28', '2028-02-29', '2026-07-01', 'November 24', 'March 8', '']);
});

test('once it has frozen, and when the numbers are too small for a percentage', async () => {
  const L = fresh(), { data } = await runOnce(L, fakeFetch(routes())), I = k => data.std.cols.indexOf(k);
  const frz = copy(data); Object.assign(frz, { through: '2026-12-04' }); frz.blocks = { W1: '2026-12-04', W2: '2026-12-04', W3: '2026-12-04', G1: '2026-12-03', G2: '2026-12-03' };
  frz.std['29755'][I('firstFreeze')] = '2026-11-20'; frz.std['29755'][I('fr32')] = 3; frz.std['29755'][I('hdd')] = 420; frz.std['29755'][I('hddNorm')] = 398; frz.std['100'][I('firstFreeze')] = '2026-11-08'; frz.std['100'][I('fr32')] = 7;
  const s = L.climate.status(frz, BASE, new Date('2026-12-05T18:00:00Z')), f = s.metro.firstFreeze;
  same([f.state, f.date, f.daysVsMedian, f.median, f.climChance, f.daysToMedian], ['occurred', '2026-11-20', -4, '2026-11-24', null, null]); same([s.metro.pct, s.metro.dep, s.metro.rank.text, s.metro.rank.n], [106, 22, 'highest', 31]);
  const den = s.counties.find(c => c.name === 'Denton').firstFreeze; same([den.state, den.date, den.station, den.stationsWithFreeze, den.daysVsMedian], ['occurred', '2026-11-08', 'Denton Municipal Airport', 1, 1]);
  assert.equal(L.climate.headline(s), 'Heating season to date: 420 heating degree days at DFW Airport against a normal of 398 (106%), highest to this date among 31 falls; first freeze November 20, 4 days ahead of the median date, 3 freeze nights so far.');
  /* a freeze recorded by a station with gaps is still a freeze */
  const gap = copy(frz); gap.std['29755'][I('ok')] = 0; const g = L.climate.status(gap, BASE, new Date('2026-12-05T18:00:00Z')); same([g.metro.hdd, g.metro.fr32, g.metro.firstFreeze.state, g.metro.firstFreeze.date], [null, null, 'occurred', '2026-11-20']);
  assert.equal(L.climate.headline(g), 'Heating season to date: no complete reading at DFW Airport this week; first freeze November 20, 4 days ahead of the median date.');
  /* early in the season the normal is tiny: the departure stands alone */
  const sep = copy(data); Object.assign(sep, { through: '2026-09-28' }); sep.blocks = { W1: '2026-09-28', W2: '2026-09-28', W3: '2026-09-28', G1: '2026-09-27', G2: '2026-09-27' }; sep.std['29755'][I('hdd')] = 0; sep.std['29755'][I('hddNorm')] = 3; sep.county['48113'].hdd = 0; sep.county['48113'].hddNorm = 4.2;
  const e = L.climate.status(sep, BASE, new Date('2026-09-29T18:00:00Z')); same([e.metro.pct, e.metro.dep, e.counties.find(c => c.name === 'Dallas').pct, e.metro.firstFreeze.climText, e.metro.firstFreeze.climChance, e.metro.firstFreeze.daysToMedian], [null, -3, null, 'under 10', null, 56]);
  assert.match(L.climate.headline(e), /^Heating season to date: 0 heating degree days at DFW Airport against a normal of 3, .* among 31 falls; no freeze yet, the median first freeze is November 24\.$/);
  /* past the median date with no freeze */
  const late = copy(data); Object.assign(late, { through: '2026-12-01' }); late.blocks.W2 = late.blocks.W1 = late.blocks.W3 = '2026-12-01';
  const l = L.climate.status(late, BASE, new Date('2026-12-02T18:00:00Z')); same([l.metro.firstFreeze.daysToMedian, l.metro.firstFreeze.climChance], [-8, 70]); assert.match(L.climate.headline(l), /no freeze yet, 8 days past the median first freeze of November 24\.$/);
  /* a record nobody refreshed for two weeks says so */
  const stale = L.climate.status(data, BASE, new Date('2026-11-27T18:00:00Z')); same([stale.ageDays, stale.overdue], [15, true]); assert.match(L.climate.headline(stale), / Observed through November 12; a refresh is due\.$/);
  /* a record of the season that ended, read in the first days of the next one */
  const done = copy(data); Object.assign(done, { through: '2027-06-28' }); done.blocks.W1 = done.blocks.W2 = done.blocks.W3 = '2027-06-28'; done.std['29755'][I('hdd')] = 1700; done.std['29755'][I('hddNorm')] = 2220;
  const was = L.climate.status(done, BASE, new Date('2027-07-03T18:00:00Z')); same([was.current, was.season, was.metro.pct, L.climate.status(done, BASE, new Date('2027-06-29T18:00:00Z')).current, L.climate.status(done, BASE, null).current], [false, 2026, 77, true, true]); assert.match(L.climate.headline(was), /^Last heating season: 1700 heating degree days at DFW Airport against a normal of 2220 \(77%\)/);
  /* from January the comparison is among seasons, not falls */
  const jan = copy(data); Object.assign(jan, { through: '2027-01-20' }); jan.blocks.W1 = jan.blocks.W2 = jan.blocks.W3 = '2027-01-20'; assert.match(L.climate.headline(L.climate.status(jan, BASE, new Date('2027-01-21T18:00:00Z'))), /among 31 seasons/);
});

test('safe on nothing: no record, no baseline, a record from another version', async () => {
  const L = fresh(), C = L.climate, { data } = await runOnce(L, fakeFetch(routes()));
  for (const d of [null, undefined, {}, { v: 2, blocks: {} }, { v: 1 }, 'x', 0]) {
    const s = C.status(d, null, null); same([s.ok, s.through, s.season, s.stale, s.stations, s.series, s.metro.hdd, s.metro.norm, s.metro.firstFreeze, s.metro.station, s.counties.length], [false, null, null, [], [], null, null, null, null, 'DFW Airport', 12]);
    assert.equal(C.headline(s), ''); assert.ok(s.counties.every(c => c.hdd === null && c.normHdd === null && c.firstFreeze === null));
  }
  assert.equal(C.headline(null), ''); assert.equal(C.headline({}), ''); assert.equal(C.headline({ ok: true }), '');
  /* the baseline alone: the static side of every county, coldest normal first */
  const b = C.status(null, BASE, NOW); same([b.ok, b.today, b.counties[0].name, b.counties[0].normHdd, b.counties[0].exposure, b.counties[11].name, b.counties[11].hdd], [false, '2026-11-13', 'Wise', 2743, 1.152, 'Dallas', null]);
  /* the weekly record alone (the background worker has no baseline): the numbers of the week, no climatology */
  const w = C.status(data, null, NOW); same([w.ok, w.metro.hdd, w.metro.norm, w.metro.pct, w.metro.rank.n, w.metro.firstFreeze.state, w.metro.firstFreeze.median, w.metro.vsDfw, w.counties[0].name, w.counties[0].normHdd, w.series.total, w.series.normTotal], [true, 29, 157, 18, 2, 'pending', null, null, 'Wise', null, 29, null]);
  assert.equal(C.headline(w), 'Heating season to date: 29 heating degree days at DFW Airport against a normal of 157 (18%), second lowest to this date among 31 falls; no freeze yet.');
  /* the cold picture reads the season through this file */
  const cold = L.derive.cold({ acis_season: { data } }, NOW); assert.equal(cold.ok, false, 'no forecast, no cold picture, no throw');
  /* in the page the baseline is a global: it is found without being passed */
  const ctx = context(); ctx.window = ctx; load(ctx, 'data/climate-base.js', 'live/core.js', 'live/geo.js', 'live/sources/acis_season.js', 'live/climate.js');
  assert.equal(ctx.__CLIMATE_BASE__.v, 1); assert.equal(ctx.TDA_LIVE.climate.status(data, undefined, NOW).metro.firstFreeze.median, '2026-11-24'); assert.equal(ctx.TDA_LIVE.climate.zip(32.7734, -96.6188, null, undefined, '75149').exposure, 1.002);
});

test('a record broken anywhere never makes a read throw', async () => {
  const L = fresh(), C = L.climate, good = (await runOnce(L, fakeFetch(routes()))).data;
  let seed = 20261113; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff, pick = a => a[Math.floor(rnd() * a.length)];
  const junk = () => pick([null, undefined, {}, [], 'x', '', 0, -999, NaN, 'M', [null], true, '2026-13-45', '2026-02-30', 1e99, '29', ['M', 'M'], [1, 2, 3], { cols: [] }, { lat: 'x', lon: null }, -1, '11/24', [[]], Infinity]);
  const breakIt = (o, depth) => { if (!o || typeof o !== 'object') return; const keys = Object.keys(o); if (!keys.length) return; const k = pick(keys); if (depth <= 0 || rnd() < 0.35 || !o[k] || typeof o[k] !== 'object') { if (rnd() < 0.2) delete o[k]; else o[k] = junk(); } else breakIt(o[k], depth - 1); };
  for (let i = 0; i < 500; i++) {
    const d = copy(good), b = rnd() < 0.5 ? copy(BASE) : rnd() < 0.5 ? null : BASE, hits = 1 + Math.floor(rnd() * 6);
    for (let k = 0; k < hits; k++) breakIt(rnd() < 0.65 || !b || b === BASE ? d : b, 1 + Math.floor(rnd() * 5));
    assert.doesNotThrow(() => { const s = C.status(d, b, pick([NOW, null, 'x', 0, undefined])); assert.equal(typeof C.headline(s), 'string'); assert.equal(typeof s.ok, 'boolean'); assert.equal(s.counties.length, 12); JSON.stringify(s); }, 'status, round ' + i);
    assert.doesNotThrow(() => JSON.stringify(C.zip(pick([32.77, null, 'a', 99]), pick([-96.6, undefined, {}]), d, b, pick(['75149', null, 5, {}]))), 'zip, round ' + i);
    assert.doesNotThrow(() => { JSON.stringify(C.series(d, b, pick([undefined, '29755', 99, {}]))); JSON.stringify(C.nights(d, pick([14, 0, -3, 'x', null]))); L.derive.cold({ acis_season: { data: d } }, NOW); }, 'series, nights and the cold picture, round ' + i);
  }
});

/* ---------- the baseline the app ships ---------- */
test('the baseline file: one line of JSON under 250 KB, whole', () => {
  const lines = BASE_FILE.split('\n');
  assert.equal(lines[0], '/* ==== climate-base.js ==== */'); assert.match(lines[2], /^window\.__CLIMATE_BASE__ = \{.*\};$/); assert.equal(lines.length, 4); assert.equal(lines[3], '');
  assert.ok(BASE_FILE.length < 250 * 1024, `${Math.round(BASE_FILE.length / 1024)} KB`); assert.ok(BASE_FILE.length > 80 * 1024, 'not the placeholder'); assert.ok(!/<\/script/i.test(BASE_FILE));
  same(Object.keys(BASE), ['v', 'built', 'normalsPeriod', 'lastSeason', 'credit', 'metro', 'ncei', 'dailyNormHdd', 'dailyNormTmin', 'stations', 'freeze', 'last10', 'prism', 'prismCounty', 'homes', 'zip']);
  assert.equal(BASE.v, 1); assert.match(BASE.built, /^\d{4}-\d\d-\d\d$/); assert.equal(BASE.normalsPeriod, '1991 to 2020');
  /* official normals */
  const dfw = BASE.ncei.USW00003927; assert.equal(Object.keys(BASE.ncei).length, 45);
  same(dfw, { name: 'DALLAS FT WORTH AP, TX US', label: 'DFW Airport', lat: 32.8978, lon: -97.0189, fips: '48439', hdd: 2220.2, hddSON: 357.9, hddDJF: 1523.8, hddMAM: 338.5, d32: 29.2, d20: 2.5, first32: ['11/06', '11/11', '11/15', '11/19', '11/24', '11/28', '12/02', '12/05', '12/12'], first28p50: '12/07', last32p50: '03/08', last32p10: '03/26', p20: 67.1, p16: 30.3,
    mHdd: [582, 413.4, 246.2, 82.4, 9.9, 0.1, 0, 0, 3.4, 69.2, 285.2, 528.3], mD32: [10.6, 6.2, 1.9, 0, 0, 0, 0, 0, 0, 0.1, 2.3, 8.1], mP32: [99.7, 94.1, 68.7, 4.3, 0, 0, 0, 0, 0, 2.6, 64, 99.7] });
  same([BASE.ncei.USW00013960.hdd, BASE.ncei.USC00419532.hdd, BASE.ncei.USC00410206.hdd, BASE.ncei.USC00410206.d32, BASE.ncei.USW00003991.first32[4]], [1991.6, 2636.6, 2861.5, 72.5, '11/07'], 'Love Field, Weatherford, Alvord, Denton');
  for (const [id, n] of Object.entries(BASE.ncei)) { assert.ok(n.hdd > 1900 && n.hdd < 3000 && n.first32.length === 9 && n.first32.every(x => /^\d\d\/\d\d$/.test(x)) && n.mHdd.length === 12 && n.mHdd.every(v => v != null) && n.lat > 32 && n.lon < -95.8, id); assert.ok(Math.abs(n.mHdd.reduce((a, b) => a + b, 0) - n.hdd) < 1, id + ': the months add up to the year'); assert.ok(!/-/.test(n.label), n.label); }
  /* daily normals: 366 days from January 1; July 1 to November 12 is the 157 the Weather Service prints */
  same([BASE.dailyNormHdd.station, BASE.dailyNormHdd.byDay.length, BASE.dailyNormTmin.byDay.length, BASE.dailyNormHdd.byDay[0], BASE.dailyNormTmin.byDay[0]], ['USW00003927', 366, 366, 19.3, 36]);
  assert.equal(Math.round(BASE.dailyNormHdd.byDay.slice(182, 317).reduce((a, b) => a + b, 0) * 10) / 10, 157.2);
  /* 30 seasons of freeze statistics and the last ten seasons */
  const fz = BASE.freeze['29755']; assert.equal(Object.keys(BASE.freeze).length, 44); for (const k of ['fr32', 'fr25', 'first', 'last', 'minT', 'miss']) assert.equal(fz[k].length, 30, k);
  same([fz.first[0], fz.first[2], fz.first[7], fz.last[5], Math.min(...fz.minT), Math.round(fz.fr32.reduce((a, b) => a + b, 0) / 3) / 10, Math.min(...fz.fr32), Math.max(...fz.fr32)], ['1991-11-02', '1993-10-30', '1998-12-21', '1997-04-13', -2, 29.2, 11, 55], 'DFW Airport, as spec section 2.6 has it');
  for (const [u, f] of Object.entries(BASE.freeze)) { assert.ok(f.fr32.filter(v => v != null).length >= 10 && BASE.stations[u] && BASE.stations[u].label, u); assert.ok(f.miss.every((m, k) => (m != null && m <= 10) || f.fr32[k] === null), u + ': a season with more than 10 missing days is null'); }
  same(BASE.last10.seasons, [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]); assert.equal(BASE.lastSeason, 2025);
  same(BASE.last10['29755'], { hdd: [1305, 1931, 2396, 2098, 2239, 1789, 1839, 1803, 1790, 1439], fr32: [11, 25, 28, 21, 24, 37, 21, 15, 30, 19], fr25: [7, 10, 5, 3, 10, 13, 6, 7, 14, 8], first: ['2016-12-08', '2017-12-07', '2018-11-10', '2019-10-31', '2020-11-30', '2021-12-12', '2022-11-20', '2023-11-27', '2024-12-06', '2025-12-02'], last: ['2017-01-08', '2018-02-12', '2019-03-06', '2020-02-27', '2021-02-20', '2022-03-12', '2023-03-19', '2024-02-18', '2025-02-22', '2026-02-23'], minT: [14, 13, 21, 22, -2, 19, 11, 11, 12, 13] });
  /* the normals grid and the counties */
  same([BASE.prism.ny, BASE.prism.nx, BASE.prism.lat0, BASE.prism.lon0, BASE.prism.step, BASE.prism.hdd.length, BASE.prism.fr32.length, BASE.prism.fr25.length], [40, 62, 32, -98.333333, 0.0416666667, 2480, 2480, 2480]);
  same([Math.min(...BASE.prism.hdd), Math.max(...BASE.prism.hdd), Math.min(...BASE.prism.fr32), Math.max(...BASE.prism.fr32), Math.min(...BASE.prism.fr25), Math.max(...BASE.prism.fr25)], [2103, 2955, 21, 66, 5, 26]);
  same(BASE.prismCounty['48113'], { hdd: 2308, fr32: 28.8, fr25: 7.2 }); same(BASE.prismCounty['48497'], { hdd: 2742.6, fr32: 52, fr25: 17.3 }); assert.equal(Object.keys(BASE.prismCounty).length, 13);
});

test('the baseline\'s ZIP block is the grid at each centroid over the housing weighted metro mean', () => {
  const L = fresh(), col = k => ATLAS.zcols.indexOf(k), zi = col('zip'), la = col('lat'), lo = col('lon'), hu = col('hu');
  assert.equal(Object.keys(BASE.zip).length, 277); same(BASE.zip['75149'], { hdd: 2386, fr32: 31.7, ratio: 1.002 }); same(BASE.metro, { hdd: 2380.8, fr32: 32.8, hu: 3128147, zips: 277 });
  let w = 0, sh = 0, sf = 0; const rows = ATLAS.zrows.map(r => ({ zip: r[zi], hu: r[hu] || 0, h: L.climate.sample(BASE.prism.hdd, r[la], r[lo], BASE.prism), f: L.climate.sample(BASE.prism.fr32, r[la], r[lo], BASE.prism) }));
  for (const z of rows) { assert.ok(z.h != null && z.f != null, z.zip + ' is on the grid'); w += z.hu; sh += z.hu * z.h; sf += z.hu * z.f; }
  assert.equal(Math.round(sh / w * 10) / 10, 2380.8); assert.equal(Math.round(sf / w * 10) / 10, 32.8); assert.equal(w, BASE.metro.hu);
  for (const z of rows) same(BASE.zip[z.zip], { hdd: Math.round(z.h), fr32: Math.round(z.f * 10) / 10, ratio: Math.round(z.h / (sh / w) * 1000) / 1000 }, z.zip);
  const ratios = Object.values(BASE.zip).map(z => z.ratio); same([Math.min(...ratios), Math.max(...ratios)], [0.887, 1.207]);
  assert.ok(Math.abs(rows.reduce((s, z) => s + z.hu * BASE.zip[z.zip].ratio, 0) / w - 1) < 0.0005, 'the housing weighted mean exposure is 1');
  same(L.geo.counties.map(c => [c.name, BASE.homes[c.fips].ratio]), [['Collin', 1.063], ['Dallas', 0.962], ['Denton', 1.039], ['Ellis', 0.988], ['Hood', 1.027], ['Hunt', 1.085], ['Johnson', 0.994], ['Kaufman', 1.013], ['Parker', 1.131], ['Rockwall', 1.033], ['Tarrant', 0.98], ['Wise', 1.137]]);
  assert.equal(L.geo.counties.reduce((s, c) => s + BASE.homes[c.fips].hu, 0), BASE.metro.hu); assert.equal(L.geo.counties.reduce((s, c) => s + BASE.homes[c.fips].zips, 0), 277);
});
