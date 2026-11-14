import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { context, load, fakeFetch, same, plain, liveFiles, ROOT } from './helpers/load.mjs';

/* The outlook family: cpc_outlook, nbm_extended and ercot_grid, the class table and the two week cold outlook built on them.
   Recorded answers of 2026-11-13 under tests/fixtures/outlook/ (see the README there); files named synthetic- are hand made. */
const DIR = join(ROOT, 'tests', 'fixtures', 'outlook'), D = '2026-11-13';
const raw = n => readFileSync(join(DIR, n), 'utf8'), fx = n => JSON.parse(raw(n));
const F = {
  multi610: raw(`cpc-610-temp-multipoint-${D}.json`), multi814: raw(`cpc-814-temp-multipoint-${D}.json`), point610: raw(`cpc-610-temp-point-${D}.json`), point814: raw(`cpc-814-temp-point-${D}.json`),
  pcp610: raw(`cpc-610-precip-point-${D}.json`), pcp814: raw(`cpc-814-precip-point-${D}.json`), two610: raw(`cpc-610-temp-envelope-two-bands-${D}.json`),
  haz: { 1: raw(`hazards-L1-national-${D}.json`), 3: raw(`hazards-L3-national-${D}.json`), 4: raw(`hazards-L4-national-${D}.json`), 6: raw(`hazards-L6-national-${D}.json`) },
  drought: raw(`hazards-L7-multipoint-12-counties-${D}.json`), snowAreas: raw(`hazards-L4-multipoint-mountain-points-${D}.json`), muchBelow: raw('synthetic-hazards-L3-much-below-normal.json'),
  wssiNone: raw(`wssi-p-L1-point-dfw-${D}.json`), wssi1: raw(`wssi-p-L1-multipoint-mountain-points-${D}.json`), wssi2: raw(`wssi-p-L2-multipoint-mountain-points-${D}.json`),
  month: raw(`cpc-month-temp-point-${D}.json`), season: raw(`cpc-season-temp-identify-${D}.json`), mrd: raw(`pmd-mrd-${D}.json`), thr: raw(`pmd-thr-${D}.json`), ens: raw(`pmd-ens-${D}.json`),
  nbm: raw(`iem-mos-nbe-six-airports-${D}.json`), prc: raw(`ercot-daily-prc-${D}.json`), sd: raw(`ercot-supply-demand-${D}.json`), zone12: raw(`ercot-zones-20261112-${D}.html`), zoneToday: raw(`ercot-zones-today-partial-${D}.html`), wall: raw(`ercot-firewall-403-${D}.html`),
};
/* the next issue, recorded at 00:08 UTC on 2026-11-14 (6 pm on the 13th in Dallas) by the collector's own confirming run */
const F2 = { multi610: raw('cpc-610-temp-multipoint-2026-11-14.json'), pcp610: raw('cpc-610-precip-point-2026-11-14.json'), multi814: raw('cpc-814-temp-multipoint-2026-11-14.json'), pcp814: raw('cpc-814-precip-point-2026-11-14.json'),
  haz4: raw('hazards-L4-national-2026-11-14.json'), metro4: raw('hazards-L4-multipoint-12-counties-2026-11-14.json'), mrd: raw('pmd-mrd-2026-11-14.json'), thr: raw('pmd-thr-2026-11-14.json') };
const CASES = fx('synthetic-outlook-cases.json'), SUMMER = fx('synthetic-outlook-summer.json');
const NONE = '{"features":[]}', REFUSED = { status: 403, body: F.wall }, DOWN = { status: 503, body: 'Service Unavailable' };
const T0 = new Date('2026-11-13T18:40:00Z');                        // Friday 12:40 pm in Dallas, the hour the answers were recorded
const days = n => new Date(+T0 + n * 864e5);
const FILES = ['live/core.js', 'live/geo.js', 'live/sources/cpc_outlook.js', 'live/sources/nbm_extended.js', 'live/sources/ercot_grid.js', 'live/derive.js', 'live/cpc_class.js', 'live/outlook.js'];
/* A setTimeout that records every delay asked for and does not make the tests wait: the polite pauses (gaps between calls, the
   waits after a refusal, backoff) fire at once; the guards of 20 seconds and more (a request's own limit, the run's limit) keep
   their length and are cleared when the work is done. */
function timers() { const asked = []; const f = (fn, ms, ...a) => { asked.push(ms); return setTimeout(fn, ms >= 20000 ? ms : 0, ...a); }; f.asked = asked; return f; }
const fresh = (files, globals) => { const st = timers(), L = load(context(Object.assign({ setTimeout: st }, globals || {})), ...(files || FILES)).TDA_LIVE; L.asked = st.asked; return L; };
/* every endpoint the three collectors call, answering as on the day of recording; o replaces single answers */
function routes(o) {
  o = o || {}; const pick = (k, d) => (k in o ? o[k] : d);
  return [
    [/cpc_6_10_day_outlk\/MapServer\/0\/query.*esriGeometryMultipoint/, pick('multi610', F.multi610)], [/cpc_6_10_day_outlk\/MapServer\/0\/query.*esriGeometryPoint/, pick('point610', F.point610)], [/cpc_6_10_day_outlk\/MapServer\/1\/query/, pick('pcp610', F.pcp610)],
    [/cpc_8_14_day_outlk\/MapServer\/0\/query.*esriGeometryMultipoint/, pick('multi814', F.multi814)], [/cpc_8_14_day_outlk\/MapServer\/0\/query.*esriGeometryPoint/, pick('point814', F.point814)], [/cpc_8_14_day_outlk\/MapServer\/1\/query/, pick('pcp814', F.pcp814)],
    [/cpc_weather_hazards\/MapServer\/\d\/query\?where/, pick('hazAll', u => F.haz[/MapServer\/(\d)\//.exec(u)[1]])], [/cpc_weather_hazards\/MapServer\/\d\/query\?geometry/, pick('hazMetro', NONE)],
    [/wpc_wssi_p\/MapServer\/1\/query/, pick('wssi1', F.wssiNone)], [/wpc_wssi_p\/MapServer\/2\/query/, pick('wssi2', F.wssiNone)],
    [/cpc_mthly_temp_outlk\/MapServer\/0\/query/, pick('month', F.month)], [/cpc_sea_temp_outlk\/MapServer\/identify/, pick('season', F.season)],
    ['/products/types/PMD/locations/MRD/latest', pick('mrd', F.mrd)], ['/products/types/PMD/locations/THR/latest', pick('thr', F.thr)], ['/products/types/PMD/locations/ENS/latest', pick('ens', F.ens)],
    ['mesonet.agron.iastate.edu/api/1/mos.json', pick('nbm', F.nbm)],
    [/www\.ercot\.com\/api\/1\/services\/read\/dashboards\/daily-prc\.json$/, pick('prc', F.prc)], [/www\.ercot\.com\/api\/1\/services\/read\/dashboards\/supply-demand\.json$/, pick('sd', F.sd)],
    [/www\.ercot\.com\/content\/cdr\/html\/\d{8}_actual_loads_of_weather_zones\.html$/, pick('zone', u => (u.includes('/20261112_') ? F.zone12 : { status: 404, body: 'Not Found' }))],
  ];
}
/* one collector run the way the runner calls it, with every request and its options recorded; no gap is forced, so the pauses a collector asks for show up in L.asked */
async function run(L, id, fetch, prev, now) {
  const seen = [], real = L.makeHttp({ fetch, backoffMs: 1 }), spy = k => (u, i) => { seen.push({ url: u, init: i || {} }); return real[k](u, i); };
  const data = await L.BY_ID[id].run({ http: { json: spy('json'), text: spy('text'), stats: real.stats }, now: now || T0, prev: prev || null, geo: L.geo, settings: {}, env: 'node' });
  return { data: plain(data), seen, n: real.stats.n };
}
const urls = fetch => fetch.calls.map(c => c.url), on = (fetch, host) => fetch.calls.filter(c => c.url.includes(host));
const MS = 'https://mapservices.weather.noaa.gov/vector/rest/services', NWS = 'https://api.weather.gov', ERCOT = 'https://www.ercot.com';
/* the 12 county points in the order of live/geo.js: Collin, Dallas, Denton, Ellis, Hood, Hunt, Johnson, Kaufman, Parker, Rockwall, Tarrant, Wise */
const POINTS = [[-96.5903, 33.1778], [-96.6609, 32.8063], [-97.2006, 33.2051], [-96.9122, 32.4558], [-97.8167, 32.4442], [-96.0667, 33.0667], [-97.4336, 32.3536], [-96.2683, 32.7136], [-97.7972, 32.7593], [-96.4348, 32.9322], [-97.022, 32.8974], [-97.5806, 33.2544]];
const GEOM = encodeURIComponent(JSON.stringify({ points: POINTS, spatialReference: { wkid: 4326 } })), TAIL = '&inSR=4326&spatialRel=esriSpatialRelIntersects&returnGeometry=false&f=json';
const EXT_F = 'fcst_date,start_date,end_date,cat,prob,idp_filedate', HAZ_F = 'label,start_date,end_date,idp_filedate', WIN_F = 'prob,impact,validstartdatetime,validenddatetime,idp_filedate';
const multi = (path, f) => `${MS}/${path}/query?geometry=${GEOM}&geometryType=esriGeometryMultipoint${TAIL}&outFields=${f}`;
const point = (path, f, lon, lat) => `${MS}/${path}/query?geometry=${lon},${lat}&geometryType=esriGeometryPoint${TAIL}&outFields=${f}`;
const all = (path, f) => `${MS}/${path}/query?where=1%3D1&returnGeometry=false&f=json&outFields=${f}`;
/* a recorded answer with its band changed (the only way to see a split metro on a day the outlook was uniform) */
/* the blend bulletin as it would read n days later: the same numbers, every time moved on */
const nbmOn = n => { const mv = s => new Date(Date.parse(s + 'Z') + n * 864e5).toISOString().slice(0, 23); return JSON.stringify({ data: JSON.parse(F.nbm).data.map(r => Object.assign({}, r, { runtime: null, ftime: null, runtime_utc: mv(r.runtime_utc), ftime_utc: mv(r.ftime_utc) })) }); };
/* the grid condition as it would read n days later, in another state when one is named */
const prcOn = (n, state, title) => { const j = JSON.parse(F.prc); j.current_condition.datetime += n * 86400; j.lastUpdated = new Date(Date.parse('2026-11-13T18:16:05Z') + n * 864e5).toISOString().slice(0, 19).replace('T', ' ') + '+0000'; if (state) { j.current_condition.state = state; j.current_condition.title = title || state; } return JSON.stringify(j); };
const banded = (body, cat, prob) => { const j = JSON.parse(body); j.features.forEach(f => { f.attributes.cat = cat; f.attributes.prob = prob; }); return JSON.stringify(j); };
const HYPHEN = /[A-Za-z][-‐-―−][A-Za-z]/, DASH = /[‐-―−]/;       // a hyphen or dash between letters; a typographic dash or minus sign anywhere
const prose = s => assert.ok(typeof s === 'string' && s.length > 0 && !HYPHEN.test(s) && !DASH.test(s), 'plain words, no hyphen or dash: ' + s);

/* ---------------------------------------------------------------- registration and loading ---------------------------------------------------------------- */

test('registration: three daily sources, exact hosts, the grid source for the browser app only, plain words throughout', () => {
  const L = fresh(), c = L.BY_ID.cpc_outlook, n = L.BY_ID.nbm_extended, e = L.BY_ID.ercot_grid;
  same(L.SOURCES.map(s => s.id), ['cpc_outlook', 'nbm_extended', 'ercot_grid']);
  same(c.hosts, ['mapservices.weather.noaa.gov', 'api.weather.gov']); same(n.hosts, ['mesonet.agron.iastate.edu']); same(e.hosts, ['www.ercot.com']);
  for (const s of [c, n, e]) {
    assert.equal(s.cadence, 'daily'); assert.match(s.grade, /^[A-D]$/); assert.match(s.page, /^https:\/\//); assert.ok(!s.key, 'no key');
    for (const t of [s.name, s.publisher, s.about, s.terms]) prose(t);
    for (const k of Object.keys(s.labels)) { prose(s.labels[k][0]); assert.match(s.labels[k][1], /^(int|f1|pct|degF|usd|text|idx)$/); }
    assert.ok(s.timeoutMs >= 60000 && s.timeoutMs <= 180000);
  }
  assert.equal(c.cors, true); assert.equal(n.cors, true); assert.equal(e.cors, false, 'the grid operator answers only its own pages across origins');
  assert.equal(c.grade, 'B'); assert.equal(n.grade, 'B'); assert.equal(e.grade, 'B');
  /* what the grid source can and cannot tell a heating advertiser, said in about; the publisher named in words */
  assert.match(e.about, /It can tell a heating advertiser/); assert.match(e.about, /It cannot tell which county or ZIP is cold/); assert.match(e.about, /Weather Watch/); assert.match(e.about, /morning/);
  assert.equal(e.publisher, 'Electric Reliability Council of Texas (ERCOT)'); assert.match(e.terms, /credited in words only/);
  assert.match(n.about, /six airports/); assert.match(n.terms, /not the official forecast/); assert.match(c.about, /8 to 14 days/);
  same(plain(L.cpc.GRADE), { outlook: 'B', hazards: 'B', text: 'B', load: 'C' }); same(plain(L.nbm.GRADE), { guidance: 'B', chance: 'C' }); same(plain(L.ercot.GRADE), { condition: 'A', forecast: 'B', zone: 'B' });
});

test('the five files load where there is no window and no document, declare nothing outside their wrappers, and sit in the template in the right order', () => {
  const ctx = context(), before = new Set(Object.keys(ctx));
  load(ctx, ...FILES);
  same(Object.keys(ctx).filter(k => !before.has(k)), ['TDA_LIVE'], 'one global: the live layer');
  assert.equal(typeof ctx.window, 'undefined'); assert.equal(typeof ctx.document, 'undefined');
  const L = ctx.TDA_LIVE; assert.equal(typeof L.derive.outlook, 'function'); assert.ok(Array.isArray(L.cpcClass.w7)); assert.equal(typeof L.cpc.loadOf, 'function'); assert.equal(typeof L.nbm.parse, 'function'); assert.equal(typeof L.ercot.parseZones, 'function');
  const order = liveFiles(), at = f => order.indexOf(f);
  for (const f of ['live/sources/cpc_outlook.js', 'live/sources/nbm_extended.js', 'live/sources/ercot_grid.js', 'live/cpc_class.js', 'live/outlook.js']) assert.ok(at(f) > 0, f + ' is in the template');
  assert.ok(at('live/geo.js') < at('live/sources/cpc_outlook.js') && at('live/sources/ercot_grid.js') < at('live/derive.js') && at('live/derive.js') < at('live/climate.js') && at('live/climate.js') < at('live/cpc_class.js') && at('live/cpc_class.js') < at('live/outlook.js') && at('live/outlook.js') < at('live/page.js'), 'sources, derive, climate, class table, outlook, page');
  /* the worker loads the same list through importScripts and the popup through script tags */
  const bg = readFileSync(join(ROOT, 'app', 'background.js'), 'utf8'), pop = readFileSync(join(ROOT, 'app', 'popup.html'), 'utf8');
  for (const f of ['live/sources/cpc_outlook.js', 'live/sources/nbm_extended.js', 'live/sources/ercot_grid.js', 'live/cpc_class.js', 'live/outlook.js']) { assert.ok(bg.includes(`'${f}'`), 'background.js imports ' + f); assert.ok(pop.includes(`src="${f}"`), 'popup.html loads ' + f); }
});

test('the manifest grants the two new hosts', () => {
  const hosts = JSON.parse(readFileSync(join(ROOT, 'app', 'manifest.json'), 'utf8')).host_permissions;
  for (const h of ['https://mapservices.weather.noaa.gov/*', 'https://www.ercot.com/*', 'https://api.weather.gov/*', 'https://mesonet.agron.iastate.edu/*']) assert.ok(hosts.includes(h), h);
});

/* ---------------------------------------------------------------- the class table and the bands ---------------------------------------------------------------- */

test('class table: 53 windows of five and of seven days, limits in order, the cold third always the heaviest', () => {
  const L = fresh(), T = L.cpcClass;
  assert.equal(T.grade, 'C'); assert.match(T.station, /DFW Airport/); prose(T.base); same(plain(T.cols), ['doy', 'tLo', 'tHi', 'hdd', 'hddB', 'hddN', 'hddA']);
  for (const rows of [T.w5, T.w7]) {
    assert.equal(rows.length, 53); same(rows.map(r => r[0]), Array.from({ length: 53 }, (_, i) => 1 + 7 * i));
    for (const r of rows) { assert.equal(r.length, 7); assert.ok(r.every(v => typeof v === 'number' && Number.isFinite(v))); assert.ok(r[1] < r[2], 'below limit under above limit'); assert.ok(r[4] >= r[5] && r[5] >= r[6] && r[6] >= 0, 'cold class carries the most heating load'); assert.ok(r[3] <= r[4] && r[3] >= r[6]); }
  }
  same(plain(L.cpc.classRow(T, '2026-11-20', 7)), [323, 53.5, 57.8, 10.44, 16.27, 9.74, 5.31], 'the seven day window that starts Nov 19');
  assert.equal(L.cpc.classRow(T, '2026-11-18', 5)[0], 323); assert.equal(L.cpc.classRow(T, '2026-01-01', 7)[0], 1); assert.equal(L.cpc.classRow(T, '2026-12-30', 7)[0], 365, 'the year wraps'); assert.equal(L.cpc.classRow(T, '2028-03-01', 7)[0], L.cpc.classRow(T, '2027-03-01', 7)[0], 'a leap year reads the same calendar');
  assert.equal(L.cpc.classRow(null, '2026-11-20', 7), null); assert.equal(L.cpc.classRow(T, 'soon', 7), null); assert.equal(L.cpc.classRow({ w5: [], w7: [] }, '2026-11-20', 7), null);
});

test('classProbs: the three class probabilities behind a mapped band, by band middle and by band floor', () => {
  const L = fresh(), cp = (c, p, m) => { const x = L.cpc.classProbs(c, p, m); assert.ok(Math.abs(x.b + x.n + x.a - 100) < 1e-9, 'sums to 100'); return [x.b, x.n, x.a].map(v => Math.round(v * 10) / 10); };
  const table = { 'Below,70': [75, 21.7, 3.3], 'Below,60': [65, 31.7, 3.3], 'Below,50': [55, 33.3, 11.7], 'Below,40': [45, 33.3, 21.7], 'Below,33': [36.5, 33.3, 30.2], 'Normal,36': [32, 36, 32], 'Above,33': [30.2, 33.3, 36.5], 'Above,40': [21.7, 33.3, 45], 'Above,50': [11.7, 33.3, 55], 'Above,60': [3.3, 31.7, 65], 'Above,70': [3.3, 21.7, 75] };
  for (const k of Object.keys(table)) { const [c, p] = k.split(','); same(cp(c, +p, true), table[k], k); }
  same(plain(L.cpc.classProbs('Below', 40, false)), { b: 40, n: 100 - 40 - (200 / 3 - 40), a: 200 / 3 - 40 }, 'by the floor of the band');
  same(cp('Above', 33, false), [33.3, 33.3, 33.3]); same(cp('EC', 33), [33.3, 33.3, 33.3]); same(cp('Normal', 36), [32, 36, 32]); same(cp('Below', 90, true), [95, 1.7, 3.3]); same(cp(null, null), [33.3, 33.3, 33.3]);
  same(['Above,50', 'Below,40', 'Normal,36', 'EC,33'].map(k => L.cpc.code({ cat: k.split(',')[0], prob: +k.split(',')[1] })), ['A50', 'B40', 'N36', 'EC']); assert.equal(L.cpc.code(null), '');
});

test('loadOf: what a band means in heating load at DFW Airport, window by window', () => {
  const L = fresh(), T = L.cpcClass, o = (start, end, cat, prob) => L.cpc.loadOf(T, { start, end, cat, prob });
  same(plain(o('2026-11-18', '2026-11-22', 'Above', 50)), { days: 5, normHdd: 10.18, expHdd: 7.5, idx: 74, coldBelowF: 53.7, coldHdd: 16.77, nearHdd: 9.45, warmAboveF: 58.4, warmHdd: 4.33 }, 'the 6 to 10 day outlook of the day');
  same(plain(o('2026-11-20', '2026-11-26', 'Above', 33)), { days: 7, normHdd: 10.44, expHdd: 10.1, idx: 97, coldBelowF: 53.5, coldHdd: 16.27, nearHdd: 9.74, warmAboveF: 57.8, warmHdd: 5.31 }, 'the 8 to 14 day outlook of the day');
  /* below normal at 40 to 50 percent through the heating season: the staging signal is worth 8 to 23 percent of load */
  const starts = ['2026-10-22', '2026-11-05', '2026-11-19', '2026-12-03', '2026-12-17', '2027-01-08', '2027-01-29', '2027-02-19', '2027-03-12'], end = s => new Date(Date.parse(s) + 6 * 864e5).toISOString().slice(0, 10);
  same(starts.map(s => o(s, end(s), 'Below', 40).idx), [123, 119, 112, 110, 108, 109, 109, 112, 115]);
  same(starts.map(s => o(s, end(s), 'Below', 40).coldBelowF), [62, 57.2, 53.5, 47.4, 45.5, 43.9, 45.9, 50.2, 56.2], 'what "below normal" means in degrees');
  assert.equal(o('2026-12-17', '2026-12-23', 'Above', 60).idx, 80); assert.equal(o('2026-12-17', '2026-12-23', 'Normal', 36).idx, 100); assert.equal(o('2026-07-10', '2026-07-16', 'Below', 50).idx, null, 'no index where there is no heating load');
  assert.equal(L.cpc.loadOf(null, { start: '2026-11-20', end: '2026-11-26', cat: 'Above', prob: 33 }), null, 'no table, no load'); assert.equal(o('2026-11-20', '2026-11-26', null, null), null); assert.equal(L.cpc.loadOf(T, null), null);
});

test('bandsOf: distinct bands of the newest issue, dates read in UTC', () => {
  const L = fresh(), b = L.cpc.bandsOf;
  same(plain(b(JSON.parse(F.multi610))), { issued: '2026-11-12', start: '2026-11-18', end: '2026-11-22', valid: null, file: '2026-11-12T20:15:14.000Z', bands: [{ cat: 'Above', prob: 50 }] });
  same(plain(b(JSON.parse(F.two610)).bands), [{ cat: 'Above', prob: 50 }, { cat: 'Above', prob: 60 }]);
  same(plain(b(JSON.parse(F.month))), { issued: '2026-10-31', start: null, end: null, valid: 'Nov 2026', file: '2026-10-31T19:15:15.000Z', bands: [{ cat: 'EC', prob: 33 }] });
  /* the daily swap: yesterday's area and today's in one answer, and the same band twice */
  const j = JSON.parse(F.multi610), old = JSON.parse(JSON.stringify(j.features[0])); old.attributes.fcst_date -= 864e5; old.attributes.cat = 'Below'; old.attributes.prob = 40;
  const mixed = b({ features: [old, j.features[0], j.features[0]] }); assert.equal(mixed.issued, '2026-11-12'); same(plain(mixed.bands), [{ cat: 'Above', prob: 50 }]);
  assert.equal(b({ features: [] }), null); assert.equal(b(null), null); assert.equal(b({ features: [{ attributes: { prob: 50 } }, {}] }), null, 'no category, no band');
  same(plain(b({ features: [{ attributes: { cat: 'Above', prob: 'x', fcst_date: 'y', start_date: 1e99 } }] })), { issued: null, start: null, end: null, valid: null, file: null, bands: [{ cat: 'Above', prob: null }] }, 'unreadable numbers become null, never a throw');
});

/* ---------------------------------------------------------------- the discussions ---------------------------------------------------------------- */

test('parseMrd: forecaster confidence, the North Texas rows and the next long lead release', () => {
  const L = fresh(), m = L.cpc.parseMrd(JSON.parse(F.mrd).productText);
  same(plain(m), { conf610: { word: 'Above Normal', n: 4 }, conf814: { word: 'Above Normal', n: 4 }, nTexas610: { temp: 'A', pcpn: 'A' }, nTexas814: { temp: 'A', pcpn: 'A' }, nextLongLead: 'November 19' });
  /* the usual wording carries "of", a line break can fall anywhere, and the two tables can differ */
  const t = 'FORECAST CONFIDENCE FOR THE 6-10 DAY PERIOD: Below\nAverage, 2 out of 5, due to\nmodel spread.\n\nFORECAST CONFIDENCE FOR THE 8-14 DAY PERIOD: About average, 3 out of\n5\n\n6-10 DAY OUTLOOK TABLE\nOKLAHOMA    B    N     N TEXAS     B    A     S TEXAS     N    A\n\n8-14 DAY OUTLOOK TABLE\nOKLAHOMA    N    N     N TEXAS     N    B     S TEXAS     A    B\n';
  same(plain(L.cpc.parseMrd(t)), { conf610: { word: 'Below Average', n: 2 }, conf814: { word: 'About average', n: 3 }, nTexas610: { temp: 'B', pcpn: 'A' }, nTexas814: { temp: 'N', pcpn: 'B' }, nextLongLead: null });
  same(plain(L.cpc.parseMrd('')), { conf610: null, conf814: null, nTexas610: null, nTexas814: null, nextLongLead: null }); same(plain(L.cpc.parseMrd(null)).conf610, null);
});

test('parseThr: every hazard sentence of the day, with the blank line inside one of them and the "from" in another', () => {
  const L = fresh(), j = JSON.parse(F.thr), t = L.cpc.parseThr(j.productText, j.issuanceTime);
  assert.match(t.synopsis, /^Mid-level low pressure is forecast/); assert.match(t.synopsis, /may receive their first freeze this season\.$/, 'the forecaster\'s own words, whole');
  assert.equal(t.items.length, 8);
  same(t.items.map(x => [x.risk, x.hazard, x.start, x.end, x.kind, x.near]), [
    ['Moderate', 'heavy precipitation', '2026-11-21', '2026-11-22', null, true], ['Slight', 'heavy precipitation', '2026-11-20', '2026-11-22', null, false], ['Slight', 'heavy precipitation', '2026-11-22', '2026-11-26', null, false],
    ['Slight', 'heavy snow', '2026-11-20', '2026-11-22', 'snow', false], ['Slight', 'heavy snow', '2026-11-22', '2026-11-26', 'snow', false], ['Slight', 'much below normal temperatures (and possible first freeze)', '2026-11-23', '2026-11-24', 'temps', true],
    ['Slight', 'high winds', '2026-11-20', '2026-11-23', null, false], ['Slight', 'high winds', '2026-11-23', '2026-11-26', null, false]]);
  same(plain(t.items.find(x => x.freeze)), { risk: 'Slight', hazard: 'much below normal temperatures (and possible first freeze)', area: 'much of the Southern Plains and parts of adjacent states', days: 'Mon-Tue', start: '2026-11-23', end: '2026-11-24', kind: 'temps', cold: true, freeze: true, near: true,
    text: 'Slight risk of much below normal temperatures (and possible first freeze) for much of the Southern Plains and parts of adjacent states, Mon-Tue, Nov 23-24' });
  assert.equal(t.items[4].area, 'higher elevations of the Klamath and Sierra Nevada Mountains', 'the sentence broken by a blank line'); assert.equal(t.items[4].days, 'Sun-Thu');
  assert.match(t.items[6].area, /^the Four Corners region eastward across/, 'the sentence that says "from"'); assert.equal(t.items[3].near, false, 'the southern Rockies and the central High Plains are not the Southern Plains');
  assert.ok(t.items.every(x => x.cold === !!x.kind && j.productText.replace(/\s+/g, ' ').includes(x.text)), 'text is the sentence as written');
});

test('parseThr: other wordings, dates across a month and a year, and products it cannot read', () => {
  const L = fresh(), p = (body, issued) => L.cpc.parseThr('SYNOPSIS: Arctic air spills south.\n\nHAZARDS\n\n' + body + '\n\nDETAILED SUMMARY\n\nA slight risk of heavy snow is posted. Slight risk of nothing here, Mon-Tue, Jan 1-2.\n', issued || '2026-12-28T20:00:00+00:00');
  const t = p('High risk of much below-normal temperatures for the Central and Southern Plains, and the Lower\nMississippi Valley, Wed-Sat, Dec 30-Jan 2.\n\nModerate risk of freezing rain across portions of north Texas, Thu, Dec 31.\n\nSlight risk for heavy snow over the Southern Great Plains, Thu-Fri, Dec 31 - Jan 1.\nFlooding possible for portions of the Lower Mississippi Valley.\n\nSlight risk of hazardous cold for the Northern Plains, Tue-Wed, Jan 5-6.');
  assert.equal(t.synopsis, 'Arctic air spills south.');
  same(t.items.map(x => [x.risk, x.kind, x.start, x.end, x.near, x.freeze]), [['High', 'temps', '2026-12-30', '2027-01-02', true, false], ['Moderate', 'ice', '2026-12-31', '2026-12-31', true, false], ['Slight', 'snow', '2026-12-31', '2027-01-01', true, false], ['Slight', 'cold', '2027-01-05', '2027-01-06', false, false]], 'a sentence without a risk level after an item does not swallow it; the summary below is not read');
  assert.equal(t.items[1].area, 'portions of north Texas'); assert.equal(t.items[2].text, 'Slight risk for heavy snow over the Southern Great Plains, Thu-Fri, Dec 31 - Jan 1');
  same(plain(p('No hazards posted.').items), []);
  assert.equal(L.cpc.parseThr('a page that is not the product', '2026-11-12T19:57:00+00:00'), null, 'no hazards section: the collector keeps the last good one'); assert.equal(L.cpc.parseThr(null), null);
  /* what counts as naming Texas or the Southern Plains */
  const near = L.cpc.nearTexas;
  for (const a of ['much of the Southern Plains and parts of adjacent states', 'the Central and Southern Plains', 'the Southern and Central Plains', 'the Southern Great Plains', 'portions of the southern High Plains', 'Central/Southern Plains', 'eastern portions of the Southern Plains and the Lower Mississippi Valley', 'north Texas', 'the south-central CONUS', 'the South Central U.S.']) assert.equal(near(a), true, a);
  for (const a of ['the Northern Plains', 'the central High Plains (including the Front Range area)', 'portions of the central and southern Rockies and adjacent parts of the central High Plains', 'the Northern and Central Plains', 'much of the eastern Plains and Mississippi Valley', 'south-central Alaska', 'the Lower Mississippi Valley', 'the Southeast', '', null]) assert.equal(near(a), false, String(a));
  same(['much below normal temperatures', 'much below-normal temperatures', 'freezing rain', 'heavy ice', 'heavy snow', 'dangerous wind chills', 'frost and freeze', 'frost', 'hazardous cold', 'heavy precipitation', 'high winds', 'much above normal temperatures', 'excessive heat'].map(L.cpc.kindOf), ['temps', 'temps', 'ice', 'ice', 'snow', 'chill', 'freeze', 'frost', 'cold', null, null, null, null]);
  assert.equal(L.cpc.dateNear('Jan', 2, '2026-12-28T20:00:00Z'), '2027-01-02'); assert.equal(L.cpc.dateNear('Nov', '23', '2026-11-12T19:57:00+00:00'), '2026-11-23'); assert.equal(L.cpc.dateNear('Foo', 2, '2026-11-12'), null); assert.equal(L.cpc.dateNear('Nov', 40, '2026-11-12'), null); assert.equal(L.cpc.dateNear('Nov', 2, 'never'), null);
});

test('parseEnso: the alert status, the synopsis and the next issue date', () => {
  const L = fresh(), e = L.cpc.parseEnso(JSON.parse(F.ens).productText);
  assert.equal(e.status, 'El Nino Advisory'); assert.equal(e.next, '10 December 2026');
  assert.equal(e.synopsis, 'El Nino continues to strengthen, with a strong-to-very strong El Nino likely through January-March 2027 (remaining greater than a 79percent chance).', 'as written, on one line');
  same(plain(L.cpc.parseEnso('')), { status: null, synopsis: '', next: null }); same(plain(L.cpc.parseEnso(null)), { status: null, synopsis: '', next: null });
});

/* ---------------------------------------------------------------- cpc_outlook: the collector ---------------------------------------------------------------- */

test('cpc_outlook asks exactly these 16 requests on a first run (13 daily, 3 weekly), each with a time limit under 30 seconds', async () => {
  const L = fresh(), fetch = fakeFetch(routes()), { seen, n } = await run(L, 'cpc_outlook', fetch);
  const HP = 'hazards/cpc_weather_hazards/MapServer';
  same(urls(fetch), [
    multi('outlooks/cpc_6_10_day_outlk/MapServer/0', EXT_F), point('outlooks/cpc_6_10_day_outlk/MapServer/1', EXT_F, '-96.6609', '32.8063'),
    multi('outlooks/cpc_8_14_day_outlk/MapServer/0', EXT_F), point('outlooks/cpc_8_14_day_outlk/MapServer/1', EXT_F, '-96.6609', '32.8063'),
    all(`${HP}/1`, HAZ_F), all(`${HP}/3`, HAZ_F), all(`${HP}/4`, HAZ_F), multi(`${HP}/4`, HAZ_F), all(`${HP}/6`, HAZ_F),
    multi('outlooks/wpc_wssi_p/MapServer/1', WIN_F), multi('outlooks/wpc_wssi_p/MapServer/2', WIN_F),
    `${NWS}/products/types/PMD/locations/MRD/latest`, `${NWS}/products/types/PMD/locations/THR/latest`,
    point('outlooks/cpc_mthly_temp_outlk/MapServer/0', 'fcst_date,valid_seas,cat,prob,idp_filedate', '-96.6609', '32.8063'),
    `${MS}/outlooks/cpc_sea_temp_outlk/MapServer/identify?geometry=-96.6609,32.8063&geometryType=esriGeometryPoint&sr=4326&layers=all&tolerance=1&mapExtent=-97.66,31.81,-95.66,33.81&imageDisplay=400,400,96&returnGeometry=false&f=json`,
    `${NWS}/products/types/PMD/locations/ENS/latest`]);
  assert.equal(n, 16); assert.equal(on(fetch, 'mapservices.weather.noaa.gov').length, 13); assert.equal(on(fetch, 'api.weather.gov').length, 3);
  assert.ok(decodeURIComponent(urls(fetch)[0]).includes('{"points":[[-96.5903,33.1778],[-96.6609,32.8063],[-97.2006,33.2051],[-96.9122,32.4558],[-97.8167,32.4442],[-96.0667,33.0667],[-97.4336,32.3536],[-96.2683,32.7136],[-97.7972,32.7593],[-96.4348,32.9322],[-97.022,32.8974],[-97.5806,33.2544]],"spatialReference":{"wkid":4326}}'), 'one point a county, longitude first');
  assert.ok(seen.every(s => s.init.timeoutMs > 0 && s.init.timeoutMs < 30000 && s.init.retries <= 1), 'the worker is stopped when one fetch runs past 30 seconds');
  assert.ok(seen.filter(s => s.url.includes('api.weather.gov')).every(s => s.init.headers.Accept === 'application/ld+json'));
  assert.ok(fetch.calls.every(c => c.init.method === 'GET' && c.init.credentials === 'omit' && !('User-Agent' in (c.init.headers || {}))), 'plain GET requests, no cookies, no client string of its own');
  assert.ok(L.asked.filter(ms => ms < 20000).every(ms => ms === 1100 || ms === 700) && L.asked.filter(ms => ms === 1100).length === 12 && L.asked.filter(ms => ms === 700).length === 2, 'a second between calls to the map service, 0.7 s on api.weather.gov');
  assert.equal(L.cpc.countyPoints(L.geo).length, 12); same(L.cpc.countyPoints(L.geo).map(p => [p.lon, p.lat]), POINTS);
});

test('cpc_outlook: the record of the day, part by part', async () => {
  const L = fresh(), { data: d } = await run(L, 'cpc_outlook', fakeFetch(routes()));
  assert.equal(d.v, 1); assert.equal(d.day, '2026-11-13'); same(d.errs, {});
  same(d.ext.d610, { issued: '2026-11-12', start: '2026-11-18', end: '2026-11-22', file: '2026-11-12T20:15:14.000Z', cat: 'Above', prob: 50, uniform: true, bands: [{ cat: 'Above', prob: 50 }], counties: null, pB: 11.7, pN: 33.3, pA: 55,
    load: { days: 5, normHdd: 10.18, expHdd: 7.5, idx: 74, coldBelowF: 53.7, coldHdd: 16.77, nearHdd: 9.45, warmAboveF: 58.4, warmHdd: 4.33 }, pcp: { cat: 'Above', prob: 50 } });
  same(d.ext.d814, { issued: '2026-11-12', start: '2026-11-20', end: '2026-11-26', file: '2026-11-12T20:15:13.000Z', cat: 'Above', prob: 33, uniform: true, bands: [{ cat: 'Above', prob: 33 }], counties: null, pB: 30.2, pN: 33.3, pA: 36.5,
    load: { days: 7, normHdd: 10.44, expHdd: 10.1, idx: 97, coldBelowF: 53.5, coldHdd: 16.27, nearHdd: 9.74, warmAboveF: 57.8, warmHdd: 5.31 }, pcp: { cat: 'Above', prob: 50 } });
  /* hazards: six areas in the country, one of them cold (Heavy Snow, far from Texas), none over the counties */
  same(d.haz.file, { d3_7: '2026-11-13T17:45:22.000Z', d8_14: '2026-11-11T19:15:14.000Z' }); same(d.haz.metro, []);
  same(d.haz.national.map(h => [h.win, h.kind, h.label, h.start, h.end, h.cold]), [['d3_7', 'temp', 'High Winds', '2026-11-16', '2026-11-18', false], ['d3_7', 'precip', 'Flooding Possible', '2026-11-16', '2026-11-18', false], ['d3_7', 'precip', 'Flooding Likely', '2026-11-16', '2026-11-18', false],
    ['d3_7', 'precip', 'Flooding Occurring or Imminent', '2026-11-16', '2026-11-18', false], ['d3_7', 'precip', 'Heavy Snow', '2026-11-18', '2026-11-19', true], ['d8_14', 'precip', 'Heavy Precipitation', '2026-11-20', '2026-11-21', false]]);
  same(d.winter, { file: null, minor: [], moderate: [] });
  /* discussions */
  same(d.text.mrd, { issued: '2026-11-12T20:02:00+00:00', conf610: { word: 'Above Normal', n: 4 }, conf814: { word: 'Above Normal', n: 4 }, nTexas610: { temp: 'A', pcpn: 'A' }, nTexas814: { temp: 'A', pcpn: 'A' }, nextLongLead: 'November 19' });
  assert.equal(d.text.thr.issued, '2026-11-12T19:57:00+00:00'); assert.equal(d.text.thr.items.length, 8); assert.equal(d.text.thr.items.filter(x => x.cold && x.near).length, 1);
  assert.equal(d.text.enso.status, 'El Nino Advisory'); assert.equal(d.text.enso.next, '10 December 2026'); assert.equal(d.text.enso.issued, '2026-11-12T14:00:00+00:00'); assert.equal(d.text.enso.at, T0.toISOString());
  /* the long leads */
  assert.equal(d.long.at, T0.toISOString()); same(d.long.month, { valid: 'Nov 2026', issued: '2026-10-31', cat: 'EC', prob: 33 });
  assert.equal(d.long.seasons.length, 13); same(d.long.seasons[0], { lead: 1, valid: 'NDJ 2026-2027', issued: '2026-10-15', cat: 'EC', prob: 33 }); same(d.long.seasons[1], { lead: 2, valid: 'DJF 2026-2027', issued: '2026-10-15', cat: 'EC', prob: 33 });
  same(d.long.seasons.map(s => L.cpc.code(s)), ['EC', 'EC', 'EC', 'EC', 'EC', 'A33', 'A40', 'A40', 'A40', 'A50', 'A50', 'A50', 'A50']); assert.equal(d.long.seasons[12].valid, 'NDJ 2027-2028');
  same(d.hist, [{ issued: '2026-11-12', d610: 'A50', d814: 'A33' }]);
  same(plain(L.BY_ID.cpc_outlook.digest(d)), { below814: 30, below610: 12, idx814: 97, idx610: 74, coldHazards: 1, winterProb: 0, issued: '2026-11-12' });
  assert.ok(JSON.stringify(d).length < 10000, 'a quiet day stores under 10 KB: ' + JSON.stringify(d).length); assert.ok(!/<\/script/i.test(JSON.stringify(d)));
});

test('cpc_outlook: the weekly parts are asked again only after six days; the trail of issues grows one line an issue', async () => {
  const L = fresh(), first = (await run(L, 'cpc_outlook', fakeFetch(routes()))).data;
  const f2 = fakeFetch(routes()), second = (await run(L, 'cpc_outlook', f2, first, days(2))).data;
  assert.equal(f2.calls.length, 13, 'a quiet day: 4 outlook, 5 hazards, 2 winter, 2 discussions'); assert.ok(!urls(f2).some(u => /cpc_mthly|cpc_sea|\/ENS\//.test(u)));
  same(second.long, first.long); same(second.text.enso, first.text.enso); same(second.hist, first.hist, 'the same issue is one line'); assert.equal(second.day, '2026-11-15');
  /* a new issue the next afternoon: below normal moves in */
  const next = body => { const j = JSON.parse(body); j.features.forEach(f => { f.attributes.fcst_date += 864e5; f.attributes.start_date += 864e5; f.attributes.end_date += 864e5; f.attributes.cat = 'Below'; f.attributes.prob = 40; }); return JSON.stringify(j); };
  const third = (await run(L, 'cpc_outlook', fakeFetch(routes({ multi814: next(F.multi814), pcp814: next(F.pcp814) })), second, days(1))).data;
  same(third.hist, [{ issued: '2026-11-13', d814: 'B40' }, { issued: '2026-11-12', d610: 'A50', d814: 'A33' }], 'newest first; each outlook writes its own issue line');
  same([third.ext.d814.issued, third.ext.d814.start, third.ext.d814.end, third.ext.d814.cat, third.ext.d814.prob, third.ext.d814.pB, third.ext.d814.load.idx], ['2026-11-13', '2026-11-21', '2026-11-27', 'Below', 40, 45, 112]);
  same([plain(L.BY_ID.cpc_outlook.digest(third)).below814, plain(L.BY_ID.cpc_outlook.digest(third)).issued], [45, '2026-11-13'], 'the digest names the newest issue');
  const f7 = fakeFetch(routes()); await run(L, 'cpc_outlook', f7, first, days(7)); assert.equal(f7.calls.length, 16, 'a week on, the monthly, seasonal and ENSO parts are due again');
  /* 30 lines at most */
  const long = Object.assign({}, first, { hist: Array.from({ length: 40 }, (_, i) => ({ issued: new Date(Date.parse('2026-11-11') - i * 864e5).toISOString().slice(0, 10), d610: 'N36', d814: 'B40' })) });
  const kept = (await run(L, 'cpc_outlook', fakeFetch(routes()), long)).data.hist; assert.equal(kept.length, 30); assert.equal(kept[0].issued, '2026-11-12'); assert.equal(kept[1].issued, '2026-11-11');
});

test('cpc_outlook: a metro split between two bands is resolved county by county', async () => {
  const L = fresh(), east = /geometry=-96\.0667,|geometry=-96\.2683,/;                       // Hunt and Kaufman, the eastern edge
  const fetch = fakeFetch(routes({ multi610: F.two610, point610: u => (east.test(u) ? banded(F.point610, 'Above', 60) : F.point610) })), { data: d } = await run(L, 'cpc_outlook', fetch);
  assert.equal(fetch.calls.length, 28, '12 point requests on top of the 16');
  same(urls(fetch).slice(1, 13), POINTS.map(p => point('outlooks/cpc_6_10_day_outlk/MapServer/0', EXT_F, p[0].toFixed(4), p[1].toFixed(4))), 'each county asked on its own, in order');
  const o = d.ext.d610; assert.equal(o.uniform, false); same(o.bands.map(L.cpc.code), ['A50', 'A60']); assert.equal(Object.keys(o.counties).length, 12);
  same(Object.keys(o.counties).filter(c => o.counties[c].prob === 60), ['Hunt', 'Kaufman']); same([o.cat, o.prob, o.pA, o.load.idx], ['Above', 50, 55, 74], 'the headline is the band most counties share');
  assert.equal(d.ext.d814.uniform, true); assert.equal(d.ext.d814.counties, null); same(d.hist, [{ issued: '2026-11-12', d610: 'A50', d814: 'A33' }]); same(d.errs, {});
  /* the larger group wins even when it is the second band of the answer; a tie goes to the county of the office (Dallas) */
  const most = (await run(L, 'cpc_outlook', fakeFetch(routes({ multi610: F.two610, point610: u => (east.test(u) ? F.point610 : banded(F.point610, 'Above', 60)) })))).data.ext.d610; same([most.cat, most.prob, most.pA], ['Above', 60, 65]);
  const west = /geometry=-97\./, tie = (await run(L, 'cpc_outlook', fakeFetch(routes({ multi610: F.two610, point610: u => (west.test(u) ? banded(F.point610, 'Above', 60) : F.point610) })))).data.ext.d610;
  assert.equal(Object.keys(tie.counties).filter(c => tie.counties[c].prob === 60).length, 6); same([tie.cat, tie.prob], ['Above', 50], 'six against six: Dallas County sits in the 50 band');
  /* one county that cannot be read loses the outlook for this run: the last good one stays, the error is named */
  const prev = (await run(L, 'cpc_outlook', fakeFetch(routes()))).data, bad = (await run(L, 'cpc_outlook', fakeFetch(routes({ multi610: F.two610, point610: u => (east.test(u) ? DOWN : F.point610) })), prev, days(1))).data;
  same(bad.ext.d610, prev.ext.d610); assert.match(bad.errs.d610, /HTTP 503 from mapservices\.weather\.noaa\.gov/); assert.equal(bad.ext.d814.issued, '2026-11-12');
});

test('cpc_outlook: cold areas drawn over the counties are kept, other areas are not; winter storm odds keep the highest band of each window', async () => {
  const L = fresh();
  /* layer 3 holds a Much Below Normal Temperatures area (hand made) that reaches the counties; layer 4 holds Heavy Snow somewhere (recorded) and the counties sit in two snow areas (recorded at mountain points) */
  const f = fakeFetch(routes({ hazAll: u => (/MapServer\/3\//.test(u) ? F.muchBelow : F.haz[/MapServer\/(\d)\//.exec(u)[1]]), hazMetro: u => (/MapServer\/3\//.test(u) ? F.muchBelow : F.snowAreas), wssi1: F.wssi1, wssi2: F.wssi2 })), { data: d } = await run(L, 'cpc_outlook', f);
  assert.equal(on(f, 'cpc_weather_hazards').length, 6, 'four national reads and a spatial read for each of the two layers that hold a cold area');
  same(d.haz.metro, [{ win: 'd8_14', kind: 'temp', label: 'Much Below Normal Temperatures', start: '2026-11-23', end: '2026-11-25', cold: true }, { win: 'd3_7', kind: 'precip', label: 'Heavy Snow', start: '2026-11-18', end: '2026-11-19', cold: true }, { win: 'd3_7', kind: 'precip', label: 'Heavy Snow', start: '2026-11-20', end: '2026-11-20', cold: true }]);
  assert.equal(d.haz.national.length, 7); assert.equal(d.haz.file.d8_14, '2026-11-13T19:15:14.000Z', 'the newest file of each window');
  /* a spatial answer that holds no cold label (the drought area the counties did sit in that day) leaves metro empty */
  same((await run(L, 'cpc_outlook', fakeFetch(routes({ hazMetro: F.drought })))).data.haz.metro, []);
  /* winter storm impacts: 25 windows a day apart by six hours, the highest probability of each */
  assert.equal(d.winter.file, '2026-11-13T18:18:12.000Z'); assert.equal(d.winter.minor.length, 25); assert.equal(d.winter.moderate.length, 17);
  same(d.winter.minor.slice(0, 3), [{ start: '2026-11-13T12:00:00.000Z', end: '2026-11-14T12:00:00.000Z', prob: 95 }, { start: '2026-11-13T18:00:00.000Z', end: '2026-11-14T18:00:00.000Z', prob: 95 }, { start: '2026-11-14T00:00:00.000Z', end: '2026-11-15T00:00:00.000Z', prob: 95 }]);
  same(d.winter.moderate.map(x => x.prob), [80, 80, 80, 70, 10, 5, 5, 5, 5, 10, 20, 30, 40, 40, 40, 40, 20]);
  assert.ok(d.winter.minor.every((x, i, a) => !i || a[i - 1].start < x.start) && d.winter.minor.every(x => Date.parse(x.end) - Date.parse(x.start) === 864e5), 'in order, 24 hours each');
  same(plain(L.BY_ID.cpc_outlook.digest(d)), { below814: 30, below610: 12, idx814: 97, idx610: 74, coldHazards: 4, winterProb: 95, issued: '2026-11-12' }, 'three areas drawn and one risk named');
  assert.ok(JSON.stringify(d).length < 16000, 'a busy day stores under 16 KB: ' + JSON.stringify(d).length);
});

test('cpc_outlook failure rules: a part that fails keeps its last good value and names the error', async () => {
  const L = fresh(), prev = (await run(L, 'cpc_outlook', fakeFetch(routes()))).data, later = days(1);
  const REJECT = '{"error":{"code":400,"message":"Invalid or missing input parameters.","details":[]}}';
  const go = async (o, p, now) => (await run(L, 'cpc_outlook', fakeFetch(routes(o)), p === undefined ? prev : p, now || later)).data;
  /* one outlook: the other still lands, and the trail takes no line from the stale one */
  let d = await go({ multi610: DOWN }); same(d.ext.d610, prev.ext.d610); assert.match(d.errs.d610, /HTTP 503/); assert.equal(d.ext.d814.cat, 'Above'); same(Object.keys(d.errs), ['d610']); same(d.hist, prev.hist);
  d = await go({ multi814: REJECT }); same(d.ext.d814, prev.ext.d814); assert.equal(d.errs.d814, 'the map service refused the query: Invalid or missing input parameters.', 'an error inside an HTTP 200 answer');
  d = await go({ multi814: NONE }); same(d.ext.d814, prev.ext.d814); assert.equal(d.errs.d814, 'no outlook area covers the 12 counties', 'an empty answer is not an outlook');
  d = await go({ multi610: DOWN }, null); assert.equal(d.ext.d610, null, 'nothing to keep on a first run: null, not a guess'); assert.equal(d.ext.d814.prob, 33); same(d.hist, [{ issued: '2026-11-12', d814: 'A33' }]);
  assert.equal(plain(L.BY_ID.cpc_outlook.digest(d)).below610, null); assert.equal(plain(L.BY_ID.cpc_outlook.digest(d)).issued, '2026-11-12');
  /* precipitation: kept for the same issue, dropped for another */
  d = await go({ pcp610: DOWN }); same(d.ext.d610.pcp, { cat: 'Above', prob: 50 }); assert.match(d.errs.d610p, /HTTP 503/); assert.equal(d.ext.d610.cat, 'Above');
  d = await go({ pcp610: DOWN }, null); assert.equal(d.ext.d610.pcp, null); d = await go({ pcp814: NONE }); assert.equal(d.ext.d814.pcp, null, 'no area at the office: unknown');
  /* hazards, winter odds */
  d = await go({ hazAll: u => (/MapServer\/4\//.test(u) ? REJECT : F.haz[/MapServer\/(\d)\//.exec(u)[1]]) }); same(d.haz, prev.haz); assert.match(d.errs.haz, /refused the query/);
  d = await go({ hazMetro: DOWN }); same(d.haz, prev.haz); assert.match(d.errs.haz, /HTTP 503/); d = await go({ hazMetro: DOWN }, null); assert.equal(d.haz, null); assert.equal(plain(L.BY_ID.cpc_outlook.digest(d)).coldHazards, 1, 'the named risk still counts');
  d = await go({ wssi2: DOWN }); same(d.winter, prev.winter); assert.match(d.errs.winter, /HTTP 503/); d = await go({ wssi1: DOWN }, null); assert.equal(d.winter, null); assert.equal(plain(L.BY_ID.cpc_outlook.digest(d)).winterProb, null, 'unknown, not zero');
  /* discussions: not found, not the product, a product without its section */
  d = await go({ mrd: { status: 404, body: '{"title":"Not Found"}' }, thr: '{"id":"x","productText":"SYNOPSIS: nothing else"}' }); same(d.text.mrd, prev.text.mrd); same(d.text.thr, prev.text.thr); assert.match(d.errs.mrd, /HTTP 404 from api\.weather\.gov/); assert.equal(d.errs.thr, 'the hazards discussion has no hazards section');
  d = await go({ mrd: '{"id":"x","productText":"An unrelated product."}', thr: '{"id":"x"}' }); same(d.text.mrd, prev.text.mrd); assert.equal(d.errs.mrd, 'the outlook discussion did not read as expected'); assert.equal(d.errs.thr, 'no THR discussion in the answer');
  d = await go({ mrd: DOWN, thr: DOWN }, null); assert.equal(d.text.mrd, null); assert.equal(d.text.thr, null); assert.equal(plain(L.BY_ID.cpc_outlook.digest(d)).coldHazards, 0);
  /* weekly parts: kept and asked for again at the next run, because their date did not move */
  d = await go({ month: DOWN, ens: DOWN }, prev, days(7)); same(d.long, prev.long); same(d.text.enso, prev.text.enso); assert.match(d.errs.long, /HTTP 503/); assert.match(d.errs.enso, /HTTP 503/);
  const again = fakeFetch(routes()); await run(L, 'cpc_outlook', again, d, days(8)); assert.equal(again.calls.length, 16, 'still due');
  d = await go({ season: REJECT }, null); assert.equal(d.long, null); assert.match(d.errs.long, /refused the query/); d = await go({ month: NONE }, null); assert.equal(d.long.month, null); assert.equal(d.long.seasons.length, 13, 'the seasons stand without the month');
  /* everything else failing does not fail the run while one outlook can be read */
  d = await go({ multi610: DOWN, hazAll: DOWN, wssi1: DOWN, mrd: DOWN, thr: DOWN, month: DOWN, ens: DOWN }, prev, days(7)); same(Object.keys(d.errs).sort(), ['d610', 'enso', 'haz', 'long', 'mrd', 'thr', 'winter']); assert.equal(d.ext.d814.issued, '2026-11-12'); same(d.haz, prev.haz);
  for (const k of Object.keys(d.errs)) assert.ok(d.errs[k].length <= 140 && !/[<>]/.test(d.errs[k]));
});

test('cpc_outlook fails as a whole only when neither outlook can be read; the runner then keeps the last good record', async () => {
  const L = fresh(), store = L.memoryStore(), opt = (fetch, now) => ({ scope: ['cpc_outlook'], store, fetch, env: 'node', now: () => now, http: { backoffMs: 1 } });
  const f0 = fakeFetch(routes({ multi610: DOWN, multi814: DOWN }));
  await assert.rejects(run(L, 'cpc_outlook', f0), /neither outlook could be read: HTTP 503 from mapservices\.weather\.noaa\.gov/);
  assert.equal(f0.calls.length, 4, 'two tries each and nothing else: no hazards, no discussions against a server that is down');
  assert.equal((await L.refresh(opt(fakeFetch(routes()), T0))).ok, true);
  const good = plain(await store.get(L.K.src('cpc_outlook')));
  const r = await L.refresh(opt(fakeFetch(routes({ multi610: DOWN, multi814: NONE })), days(1))); assert.equal(r.ok, false); assert.match(r.failed[0].msg, /neither outlook could be read: no outlook area covers the 12 counties/);
  const kept = plain(await store.get(L.K.src('cpc_outlook'))); same(kept.data, good.data); assert.equal(kept.ok, false); assert.equal(kept.at, good.at); assert.equal(kept.err.at, days(1).toISOString());
  /* the reading built on the kept record still stands the next day (the outlooks are a day older, not stale) */
  const o = L.derive.outlook({ cpc_outlook: kept }, days(1)); assert.equal(o.ok, true); assert.equal(o.tier, 1); assert.equal(o.inputs.cpc_outlook.state, 'ok');
});

test('cpc_outlook: the next issue the same evening, on top of the record of the day', async () => {
  const L = fresh(), first = (await run(L, 'cpc_outlook', fakeFetch(routes()))).data, T1 = new Date('2026-11-14T00:08:49Z');
  const fetch = fakeFetch(routes({ multi610: F2.multi610, pcp610: F2.pcp610, multi814: F2.multi814, pcp814: F2.pcp814, hazAll: u => (/MapServer\/4\//.test(u) ? F2.haz4 : /MapServer\/1\//.test(u) ? F.haz[1] : NONE), hazMetro: F2.metro4, mrd: F2.mrd, thr: F2.thr })), { data: d } = await run(L, 'cpc_outlook', fetch, first, T1);
  assert.equal(fetch.calls.length, 13, 'the weekly parts are five hours old'); same(d.errs, {}); assert.equal(d.day, '2026-11-13', 'still the 13th in Dallas');
  same([d.ext.d610.issued, d.ext.d610.start, d.ext.d610.end, d.ext.d610.cat, d.ext.d610.prob, d.ext.d610.file, d.ext.d610.load.idx], ['2026-11-13', '2026-11-19', '2026-11-23', 'Above', 50, '2026-11-13T20:15:15.000Z', 74]);
  same(d.ext.d814, { issued: '2026-11-13', start: '2026-11-21', end: '2026-11-27', file: '2026-11-13T20:15:13.000Z', cat: 'Normal', prob: 36, uniform: true, bands: [{ cat: 'Normal', prob: 36 }], counties: null, pB: 32, pN: 36, pA: 32,
    load: { days: 7, normHdd: 10.44, expHdd: 10.4, idx: 100, coldBelowF: 53.5, coldHdd: 16.27, nearHdd: 9.74, warmAboveF: 57.8, warmHdd: 5.31 }, pcp: { cat: 'Above', prob: 40 } }, 'a near normal band, as served');
  /* two of the three Heavy Snow areas share label and dates: one line; no day 8 to 14 area is drawn, so that window has no file date */
  same(d.haz.national.map(h => [h.label, h.start, h.end]), [['High Winds', '2026-11-16', '2026-11-18'], ['Flooding Possible', '2026-11-16', '2026-11-18'], ['Flooding Likely', '2026-11-16', '2026-11-18'], ['Flooding Occurring or Imminent', '2026-11-16', '2026-11-18'], ['Heavy Snow', '2026-11-18', '2026-11-19'], ['Heavy Snow', '2026-11-20', '2026-11-20']]);
  same(d.haz.file, { d3_7: '2026-11-13T19:45:21.000Z' }); same(d.haz.metro, []);
  same(d.text.mrd, { issued: '2026-11-13T20:02:00+00:00', conf610: { word: 'Above Normal', n: 4 }, conf814: { word: 'Above Normal', n: 4 }, nTexas610: { temp: 'A', pcpn: 'A' }, nTexas814: { temp: 'N', pcpn: 'A' }, nextLongLead: 'November 19' }, 'the table row agrees with the map: near normal');
  assert.equal(d.text.thr.issued, '2026-11-13T19:59:00+00:00'); assert.equal(d.text.thr.items.length, 7);
  same(d.text.thr.items.map(x => [x.risk, x.kind, x.days, x.start, x.end, x.near]), [['Slight', null, 'Sat-Sun', '2026-11-21', '2026-11-22', false], ['Slight', null, 'Wed-Fri', '2026-11-25', '2026-11-27', false], ['Slight', 'snow', 'Sat-Sun', '2026-11-21', '2026-11-22', false], ['Slight', 'snow', 'Wed-Fri', '2026-11-25', '2026-11-27', false],
    ['Slight', 'temps', 'Tue-Wed', '2026-11-24', '2026-11-25', true], ['Slight', null, 'Sat-Tue', '2026-11-21', '2026-11-24', false], ['Slight', null, 'Wed-Fri', '2026-11-25', '2026-11-27', false]], 'the freeze risk moved a day; a date broken across two lines still reads');
  assert.match(d.text.thr.synopsis, /^Mid-level low pressure/); assert.match(d.text.thr.synopsis, /expected to see their first freeze of the season\. Warmer than normal temperatures continue to be favored for Alaska, with near to above normal precipitation for the state\.$/, 'the whole paragraph, ending on a full sentence'); assert.ok(d.text.thr.synopsis.length > 600 && d.text.thr.synopsis.length <= 900);
  same(d.hist, [{ issued: '2026-11-13', d610: 'A50', d814: 'N36' }, { issued: '2026-11-12', d610: 'A50', d814: 'A33' }]); same(d.long, first.long); same(d.text.enso, first.text.enso);
  same(plain(L.BY_ID.cpc_outlook.digest(d)), { below814: 32, below610: 12, idx814: 100, idx610: 74, coldHazards: 1, winterProb: 0, issued: '2026-11-13' });
  const o = plain(L.derive.outlook({ cpc_outlook: { ok: true, at: T1.toISOString(), data: d } }, T1)); same([o.tier, o.window, o.evidence[0].quote], [1, { start: '2026-11-24', end: '2026-11-25' }, 'Slight risk of much below normal temperatures (and possible first freeze) for much of the Southern Plains and parts of adjacent states, Tue-Wed, Nov 24-25']);
  assert.equal(o.sub, 'Days 6 to 10 (Nov 19 to 23): above normal at 50 to 60 percent, about 74 percent of the normal heating load. Days 8 to 14 (Nov 21 to 27): near normal at 36 to 40 percent, about 100 percent of the normal heating load.');
  /* a paragraph that runs long is cut at a sentence, never in the middle of one */
  const long = L.cpc.parseThr('SYNOPSIS: ' + 'A cold front crosses the Plains early in the period. '.repeat(30) + '\n\nHAZARDS\n\nNo hazards posted.\n\nDETAILED SUMMARY\n', T1); assert.ok(long.synopsis.length <= 900 && long.synopsis.length > 800 && long.synopsis.endsWith('early in the period.'));
});

/* ---------------------------------------------------------------- nbm_extended ---------------------------------------------------------------- */

test('nbm: the bulletin rows become nights and days, a low at 12Z and a high at 00Z, with the chance of a freeze', () => {
  const L = fresh(), st = L.nbm.parse(JSON.parse(F.nbm));
  same(st.map(s => s.id), ['KDAL', 'KDFW', 'KDTO', 'KFTW', 'KHQZ', 'KTKI']); assert.ok(st.every(s => s.run === '2026-11-13T12:00:00.000Z' && s.nights.length === 11 && s.days.length === 10));
  const dfw = st.find(s => s.id === 'KDFW'), dto = st.find(s => s.id === 'KDTO'), hqz = st.find(s => s.id === 'KHQZ');
  same(plain(dfw.nights[0]), { m: '2026-11-14', d: '2026-11-13', lead: 1, lowF: 48, sd: 3, p32: 0, p40: 1, p25: 0, ext: false });
  same(plain(dfw.nights[10]), { m: '2026-11-24', d: '2026-11-23', lead: 11, lowF: 47, sd: 8, p32: 3, p40: 21, p25: 0, ext: true });
  same(dfw.nights.map(n => n.lowF), [48, 46, 44, 46, 48, 55, 57, 58, 54, 49, 47]); same(dfw.nights.map(n => n.sd), [3, 4, 3, 3, 3, 4, 4, 6, 8, 9, 8]); same(dfw.nights.map(n => n.lead), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  same(dto.nights.map(n => n.lowF), [42, 42, 40, 42, 45, 52, 54, 55, 50, 43, 41]); assert.equal(dto.nights[10].p32, 14, 'Denton, the morning of Nov 24: 41 with a spread of 8'); assert.equal(dto.nights[9].p32, 12);
  same(hqz.nights.map(n => n.lowF), [45, 43, 42, 43, 46, 53, 55, 56, 52, 46, 44]);
  same(plain(dfw.days[0]), { d: '2026-11-14', lead: 1, hiF: 65, hiSd: 3, lowF: 48, hdd: 8 }); same(dfw.days.map(x => x.hiF), [65, 54, 57, 63, 66, 70, 73, 73, 68, 66]); same(dfw.days.map(x => x.hdd), [8, 15, 14, 10, 8, 2, 0, 0, 4, 7]);
  assert.ok(st.every(s => s.nights.every(n => n.ext === (n.lead >= 8) && n.d < n.m)));
  /* the chance of a low at or under a threshold: a normal curve through the blend's mean and spread, whole degrees */
  const c = L.nbm.chance; same([c(41, 8, 32), c(32, 5, 32), c(25, 3, 32), c(50, 3, 32), c(33, 0, 32), c(32, 0.2, 32)], [14, 54, 99, 0, 31, 69], 'a spread under one degree is read as one');
  assert.equal(c(null, 3, 32), null); assert.equal(c(40, null, 32), null, 'no spread, no chance: null, not a guess'); assert.ok(Math.abs(L.nbm.phi(0) - 0.5) < 1e-9 && Math.abs(L.nbm.phi(1.96) - 0.975) < 1e-4 && Math.abs(L.nbm.phi(-1.0625) - 0.144) < 1e-3);
  assert.equal(L.nbm.utc('2026-11-13T12:00:00.000'), Date.parse('2026-11-13T12:00:00Z')); assert.equal(L.nbm.utc('2026-11-13 12:00'), Date.parse('2026-11-13T12:00:00Z')); assert.equal(L.nbm.utc('2026-11-13T12:00:00Z'), Date.parse('2026-11-13T12:00:00Z')); assert.equal(L.nbm.utc('soon'), null); assert.equal(L.nbm.utc(null), null);
});

test('nbm: leads count from the local date of the run; rows without a value, of an older run or of a bad time are left out', () => {
  const L = fresh(), rows = JSON.parse(F.nbm).data.filter(r => r.station === 'KDTO');
  /* the same bulletin stamped as an evening run (00Z is 6 pm the day before in Dallas): the morning of the 14th is still one night away */
  const evening = L.nbm.stationOf('KDTO', rows.map(r => Object.assign({}, r, { runtime_utc: '2026-11-14T00:00:00.000' })));
  assert.equal(evening.run, '2026-11-14T00:00:00.000Z'); same(evening.nights.slice(0, 2).map(n => [n.m, n.lead]), [['2026-11-14', 1], ['2026-11-15', 2]]);
  /* rows of the run before are ignored once a newer run is present */
  const older = rows.map(r => Object.assign({}, r, { runtime_utc: '2026-11-13T00:00:00.000', txn: 10 })), mix = L.nbm.stationOf('KDTO', older.concat(rows));
  assert.equal(mix.run, '2026-11-13T12:00:00.000Z'); assert.equal(mix.nights.length, 11); assert.ok(mix.nights.every(n => n.lowF >= 40));
  const holes = L.nbm.stationOf('KDTO', rows.map((r, i) => (i === 0 ? Object.assign({}, r, { txn: null }) : i === 2 ? Object.assign({}, r, { ftime_utc: 'soon', ftime: null }) : i === 4 ? Object.assign({}, r, { xnd: null }) : r)));
  same(holes.nights.slice(0, 2).map(n => [n.m, n.lowF, n.sd, n.p32]), [['2026-11-16', 40, null, null], ['2026-11-17', 42, 3, 0]], 'no low, no night; no spread, no chance');
  assert.equal(L.nbm.stationOf('KDTO', []), null); assert.equal(L.nbm.stationOf('KDTO', [{ station: 'KDTO', runtime_utc: 'x', ftime_utc: 'y', txn: 40 }]), null);
  same(plain(L.nbm.parse(null)), []); same(plain(L.nbm.parse({ data: [null, {}, { station: '' }] })), []);
  /* thresholds come from the cold picture when it is loaded, and are 32, 40 and 25 without it */
  same(plain(L.nbm.thresholds()), { freeze: 32, cold: 40, hard: 25 }); same(plain(fresh(['live/core.js', 'live/geo.js', 'live/sources/nbm_extended.js']).nbm.thresholds()), { freeze: 32, cold: 40, hard: 25 });
});

test('nbm_extended asks one request and stores only mornings 6 to 11 days out', async () => {
  const L = fresh(), fetch = fakeFetch(routes()), { data: d, seen } = await run(L, 'nbm_extended', fetch);
  same(urls(fetch), ['https://mesonet.agron.iastate.edu/api/1/mos.json?station=KDFW&station=KDAL&station=KFTW&station=KTKI&station=KDTO&station=KHQZ&model=NBE']);
  assert.ok(seen[0].init.timeoutMs < 30000 && seen[0].init.retries === 1); assert.equal(fetch.calls[0].init.credentials, 'omit');
  same([d.v, d.model, d.run, d.from], [1, 'NBE', '2026-11-13T12:00:00.000Z', 6]); same(d.th, { freeze: 32, cold: 40, hard: 25 });
  same(d.stations.map(s => [s.id, s.name, s.county]), [['KDAL', 'Dallas Love Field', 'Dallas'], ['KDFW', 'DFW Airport', 'Tarrant'], ['KDTO', 'Denton', 'Denton'], ['KFTW', 'Fort Worth', 'Tarrant'], ['KHQZ', 'Mesquite', 'Dallas'], ['KTKI', 'McKinney', 'Collin']]);
  assert.ok(d.stations.every(s => s.nights.length === 6 && s.days.length === 5 && s.nights[0].lead === 6 && s.nights[5].lead === 11 && s.days[4].lead === 10), 'six mornings and five days each');
  const dto = d.stations.find(s => s.id === 'KDTO'); same(dto.nights[5], { m: '2026-11-24', d: '2026-11-23', lead: 11, lowF: 41, sd: 8, p32: 14, p40: 48, p25: 3, ext: true }); same(dto.days[0], { d: '2026-11-19', lead: 6, hiF: 70, hiSd: 4, lowF: 52, hdd: 4 });
  same(plain(L.BY_ID.nbm_extended.digest(d)), { minLow: 41, pFreeze: 14, minLowExt: 41, pFreezeExt: 14, hddExt: 11, run: '2026-11-13 12Z' });
  const size = JSON.stringify(d).length; assert.ok(size < 8000, 'about 6 KB of a 118 KB answer: ' + size);
});

test('nbm_extended failure rules: no rows, a missing page, or a run older than two days fail the run; the runner keeps the last good record', async () => {
  const L = fresh();
  await assert.rejects(run(L, 'nbm_extended', fakeFetch(routes({ nbm: '{"data":[]}' }))), /no blend rows came back for the six airports/);
  await assert.rejects(run(L, 'nbm_extended', fakeFetch(routes({ nbm: { status: 404, body: '{"detail":"No data found"}' } }))), /HTTP 404 from mesonet\.agron\.iastate\.edu/);
  await assert.rejects(run(L, 'nbm_extended', fakeFetch(routes({ nbm: '<html>maintenance</html>' }))), /not JSON from mesonet\.agron\.iastate\.edu/);
  await assert.rejects(run(L, 'nbm_extended', fakeFetch(routes()), null, new Date('2026-11-15T12:00:01Z')), /the newest blend run is more than two days old \(2026-11-13 12Z\)/);
  assert.equal((await run(L, 'nbm_extended', fakeFetch(routes()), null, new Date('2026-11-15T12:00:00Z'))).data.stations.length, 6, 'two days to the second is still good');
  /* one airport stuck on a run two days older than the others is left out; an answer that stops before day 6 is no use */
  const j = JSON.parse(F.nbm), stuck = { data: j.data.map(r => (r.station === 'KTKI' ? Object.assign({}, r, { runtime_utc: '2026-11-11T12:00:00.000' }) : r)) };
  same((await run(L, 'nbm_extended', fakeFetch(routes({ nbm: JSON.stringify(stuck) })))).data.stations.map(s => s.id), ['KDAL', 'KDFW', 'KDTO', 'KFTW', 'KHQZ']);
  await assert.rejects(run(L, 'nbm_extended', fakeFetch(routes({ nbm: JSON.stringify({ data: j.data.filter(r => r.ftime_utc < '2026-11-18') }) }))), /the blend guidance does not reach day 6/);
  /* through the runner: the last good record stays, marked failed */
  const store = L.memoryStore(), opt = (o, now) => ({ scope: ['nbm_extended'], store, fetch: fakeFetch(routes(o)), env: 'node', now: () => now, http: { backoffMs: 1 } });
  assert.equal((await L.refresh(opt({}, T0))).ok, true); const r = await L.refresh(opt({ nbm: DOWN }, days(1))); assert.equal(r.ok, false); assert.match(r.failed[0].msg, /HTTP 503/);
  const rec = plain(await store.get(L.K.src('nbm_extended'))); assert.equal(rec.ok, false); assert.equal(rec.data.run, '2026-11-13T12:00:00.000Z'); assert.equal(rec.digest.pFreeze, 14);
});

/* ---------------------------------------------------------------- ercot_grid ---------------------------------------------------------------- */

test('ercot: the condition, the forecast days and the weather zone page are read from the recorded answers', () => {
  const L = fresh(), E = L.ercot;
  same(plain(E.parseCondition(JSON.parse(F.prc))), { state: 'normal', level: 1, name: 'Normal conditions', title: 'Normal Conditions', note: 'There is enough power for current demand.', eea: 0, prcMw: 19558, at: '2026-11-13T18:15:53.000Z', updated: '2026-11-13T18:16:05.000Z' });
  const st = s => E.parseCondition({ lastUpdated: '2027-01-15 05:00:10-0600', current_condition: { state: s, title: 'x', prc_value: '2,104', eea_level: s === 'eea2' ? 2 : 0, datetime: 1800000000 } });
  same(['normal', 'weather', 'vcn', 'conservation', 'eea1', 'eea2', 'eea3'].map(s => [st(s).level, st(s).name]), [[1, 'Normal conditions'], [2, 'Weather Watch'], [3, 'Voluntary Conservation Notice'], [4, 'Conservation Appeal'], [5, 'Energy Emergency Alert 1'], [6, 'Energy Emergency Alert 2'], [7, 'Energy Emergency Alert 3']]);
  same([st('eeatest').level, st('eeatest').name, st('eea2').eea, st('eea2').prcMw, st('eea2').updated], [0, 'x', 2, 2104, '2027-01-15T11:00:10.000Z'], 'a state the gauge does not rank stays unranked');
  assert.equal(E.parseCondition({}), null); assert.equal(E.parseCondition(null), null); assert.equal(E.parseCondition({ current_condition: { title: 'no state' } }), null); assert.equal(E.parseCondition({ current_condition: { state: 'normal' } }).prcMw, null);
  const days = E.parseForecast(JSON.parse(F.sd));
  same(plain(days[0]), { d: '2026-11-14', peakMw: 51154, peakHe: 19, amMw: 48411, pmMw: 51154, morning: false, marginMw: 34536, marginHe: 18 });
  same(days.map(x => [x.d, x.peakMw, x.peakHe]), [['2026-11-14', 51154, 19], ['2026-11-15', 54304, 19], ['2026-11-16', 54336, 19], ['2026-11-17', 52912, 19], ['2026-11-18', 53732, 19], ['2026-11-19', 54480, 19]]);
  assert.equal(Math.min(...days.map(x => x.marginMw)), 19946, 'the thinnest margin of the six days, Nov 16');
  /* a cold morning: the same day with the hours before sunrise lifted above the evening */
  const cold = JSON.parse(F.sd); cold.forecast.forEach(r => { if (r.deliveryDate === '2026-11-17' && r.hourEnding >= 6 && r.hourEnding <= 9) r.forecastedDemand += 9000; });
  const c17 = E.parseForecast(cold).find(x => x.d === '2026-11-17'); assert.equal(c17.morning, true); assert.ok(c17.peakHe >= 6 && c17.peakHe <= 9 && c17.amMw === c17.peakMw && c17.amMw > c17.pmMw);
  const short = JSON.parse(F.sd); short.forecast = short.forecast.filter(r => !(r.deliveryDate === '2026-11-19' && r.hourEnding > 12)); assert.equal(E.parseForecast(short).length, 5, 'a day cut short is left out');
  same(plain(E.parseForecast({})), []); same(plain(E.parseForecast({ forecast: [null, { deliveryDate: 'x' }, { deliveryDate: '2026-11-14', hourEnding: 1 }] })), []);
  same(plain(E.parseZones(F.zone12)), { d: '2026-11-12', ncPeak: 15461, ncHe: 17, ncAm: 12624, ncPm: 15461, morning: false, ncMean: 12608, sysPeak: 56235 });
  assert.equal(E.parseZones(F.zoneToday), null, 'a day still in progress');
  const hours = n => { const rows = F.zone12.split(/(?=<tr>\s*<td class="labelClassCenter">)/); return rows.slice(0, n + 1).join('') + '</tbody></table>'; };
  same([E.parseZones(hours(24)).ncPeak, E.parseZones(hours(23)).d, E.parseZones(hours(22)), E.parseZones(hours(18))], [15461, '2026-11-12', null, null], 'a day needs 23 hours (the short day in March) or more'); assert.equal(E.parseZones(F.wall), null, 'the firewall page is not the table'); assert.equal(E.parseZones(''), null); assert.equal(E.parseZones(null), null);
  assert.equal(E.zoneUrl('2026-11-12'), 'https://www.ercot.com/content/cdr/html/20261112_actual_loads_of_weather_zones.html'); same(plain(E.waits), [6000, 15000]); assert.equal(E.MAX_REQUESTS, 4);
});

test('ercot_grid on a quiet day: three requests three seconds apart, no cookies, nothing under the paths robots.txt disallows', async () => {
  const L = fresh(), back = n => new Date(Date.parse('2026-11-13') - n * 864e5).toISOString().slice(0, 10);
  const prev = { v: 1, zone: [2, 3, 4, 5].map(n => ({ d: back(n), ncPeak: 15000 + n, ncHe: 17, ncAm: 12000, ncPm: 15000 + n, morning: false, ncMean: 12500, sysPeak: 55000 })) };
  const fetch = fakeFetch(routes()), { data: d, seen } = await run(L, 'ercot_grid', fetch, prev);
  same(urls(fetch), [`${ERCOT}/api/1/services/read/dashboards/daily-prc.json`, `${ERCOT}/api/1/services/read/dashboards/supply-demand.json`, `${ERCOT}/content/cdr/html/20261112_actual_loads_of_weather_zones.html`], 'the condition, the forecast, then yesterday in Dallas');
  assert.ok(seen.every(s => s.init.gapMs === 3000 && s.init.retries === 0 && s.init.timeoutMs === 25000), 'three seconds apart, no automatic retry, 25 seconds at most');
  same(L.asked.filter(ms => ms < 20000), [3000, 3000], 'a pause of three seconds before the second and the third call');
  assert.ok(fetch.calls.every(c => c.init.method === 'GET' && c.init.credentials === 'omit' && !c.init.headers), 'no cookies, no headers of its own');
  assert.ok(!urls(fetch).some(u => /\/misapp|\/misdownload|\/static-assets\/js|\/content\/contours/.test(u)));
  same([d.v, d.day, d.condStale, d.daysStale], [1, '2026-11-13', false, false]); same(d.errs, {});
  same(d.cond, { state: 'normal', level: 1, name: 'Normal conditions', title: 'Normal Conditions', note: 'There is enough power for current demand.', eea: 0, prcMw: 19558, at: '2026-11-13T18:15:53.000Z', updated: '2026-11-13T18:16:05.000Z', since: '2026-11-13T18:15:53.000Z' });
  assert.equal(d.days.length, 6); same(d.zone.map(z => z.d), ['2026-11-12', '2026-11-11', '2026-11-10', '2026-11-09', '2026-11-08'], 'newest first');
  same(plain(L.BY_ID.ercot_grid.digest(d)), { level: 1, prcMw: 19558, peakMw: 54480, morningDays: 0, ncPeak: 15461 });
  assert.ok(JSON.stringify(d).length < 2500, 'about 2 KB: ' + JSON.stringify(d).length);
  /* 4:30 am the next morning is still the 13th in UTC terms but the 14th has not begun in Dallas either way: yesterday is asked by the local date */
  const late = fakeFetch(routes()); await run(L, 'ercot_grid', late, { zone: [] }, new Date('2026-11-14T04:30:00Z')); assert.match(urls(late)[2], /\/20261112_actual/, '10:30 pm on the 13th in Dallas');
});

test('ercot_grid: the zone history fills in two days a run, rolls at 45 days and never stores a day in progress', async () => {
  const L = fresh();
  /* a first run: yesterday answers, the day before is not there (404): four requests, the miss is named and harmless */
  const f1 = fakeFetch(routes()), a = (await run(L, 'ercot_grid', f1)).data;
  assert.equal(f1.calls.length, 4); assert.match(urls(f1)[3], /\/20261111_actual/); same(a.zone.map(z => z.d), ['2026-11-12']); assert.match(a.errs.zone, /HTTP 404 from www\.ercot\.com/); assert.equal(a.condStale, false);
  /* the next day: only the days still missing are asked, newest first, and a page that holds half a day is not kept */
  const f2 = fakeFetch(routes({ zone: u => (u.includes('/20261113_') ? F.zoneToday : { status: 404, body: 'Not Found' }) })), b = (await run(L, 'ercot_grid', f2, a, days(1))).data;
  same(urls(f2).slice(2), [`${ERCOT}/content/cdr/html/20261113_actual_loads_of_weather_zones.html`, `${ERCOT}/content/cdr/html/20261111_actual_loads_of_weather_zones.html`]); same(b.zone.map(z => z.d), ['2026-11-12']);
  /* a page that answers for another day than the one asked is not filed under the wrong date */
  const f3 = fakeFetch(routes({ zone: F.zone12 })), c = (await run(L, 'ercot_grid', f3, { zone: [] }, days(3))).data; same(c.zone.map(z => z.d), [], 'asked for the 15th and the 14th, got the 12th twice');
  /* 45 days at most */
  const many = Array.from({ length: 60 }, (_, i) => ({ d: new Date(Date.parse('2026-11-11') - i * 864e5).toISOString().slice(0, 10), ncPeak: 14000, ncHe: 18, ncAm: 12000, ncPm: 14000, morning: false, ncMean: 12000, sysPeak: 50000 }));
  const full = (await run(L, 'ercot_grid', fakeFetch(routes()), { zone: many })).data; assert.equal(full.zone.length, 45); assert.equal(full.zone[0].d, '2026-11-12'); assert.equal(full.zone[44].d, '2026-09-29');
  assert.ok(JSON.stringify(full).length < 8000, '45 zone days and six forecast days under 8 KB: ' + JSON.stringify(full).length);
});

test('ercot_grid refused once, then answering: one wait of six seconds, four requests in all', async () => {
  const L = fresh(); let n = 0;
  const fetch = fakeFetch(routes({ prc: () => (n++ ? F.prc : REFUSED) })), { data: d } = await run(L, 'ercot_grid', fetch);
  same(urls(fetch).map(u => u.split('/').pop()), ['daily-prc.json', 'daily-prc.json', 'supply-demand.json', '20261112_actual_loads_of_weather_zones.html'], 'the refused call is asked once more; the fourth request is yesterday\'s zone page and there is no fifth');
  same(L.asked.filter(ms => ms < 20000), [6000, 3000, 3000, 3000], 'six seconds after the refusal, three seconds between calls');
  same(d.errs, {}); same([d.cond.prcMw, d.condStale, d.days.length, d.daysStale, d.zone.length], [19558, false, 6, false, 1]);
  /* refused twice, then answering: the second wait is 15 seconds, and the zone page gives way to the cap of four */
  const L2 = fresh(); let m = 0; const f2 = fakeFetch(routes({ prc: () => (m++ >= 2 ? F.prc : REFUSED) })), d2 = (await run(L2, 'ercot_grid', f2)).data;
  same(urls(f2).map(u => u.split('/').pop()), ['daily-prc.json', 'daily-prc.json', 'daily-prc.json', 'supply-demand.json']); same(L2.asked.filter(ms => ms < 20000), [6000, 3000, 15000, 3000, 3000]);
  same([d2.cond.level, d2.condStale, d2.days.length, d2.zone.length], [1, false, 6, 0]); same(d2.errs, {});
  /* the two waits belong to the run, not to each file: refused on the first file and again on the second */
  const L3 = fresh(); let p = 0, q = 0; const f3 = fakeFetch(routes({ prc: () => (p++ ? F.prc : REFUSED), sd: () => (q++ ? F.sd : REFUSED) })), d3 = (await run(L3, 'ercot_grid', f3)).data;
  same(urls(f3).map(u => u.split('/').pop()), ['daily-prc.json', 'daily-prc.json', 'supply-demand.json', 'supply-demand.json']); same(L3.asked.filter(ms => ms === 6000 || ms === 15000), [6000, 15000]); same([d3.condStale, d3.daysStale], [false, false]);
});

test('ercot_grid refused three times: four requests, then it stops; with nothing stored the run fails, and no reader is hurt', async () => {
  const L = fresh(), fetch = fakeFetch(routes({ prc: REFUSED, sd: REFUSED, zone: REFUSED }));
  await assert.rejects(run(L, 'ercot_grid', fetch), e => { assert.equal(e.message, 'the grid operator\'s site could not be read: refused by the site firewall (HTTP 403)'); prose(e.message); return true; });
  same(urls(fetch).map(u => u.split('/').pop()), ['daily-prc.json', 'daily-prc.json', 'daily-prc.json', 'supply-demand.json'], 'three tries at the condition, one at the forecast, never a fifth request');
  same(L.asked.filter(ms => ms < 20000), [6000, 3000, 15000, 3000, 3000], 'six seconds, then fifteen, on top of the three second gaps');
  /* the firewall lets the forecast through on the fourth request: the condition keeps its last good value, marked stale */
  const L2 = fresh(), prev = (await run(L2, 'ercot_grid', fakeFetch(routes()))).data, f2 = fakeFetch(routes({ prc: REFUSED })), d = (await run(L2, 'ercot_grid', f2, prev, days(1))).data;
  assert.equal(f2.calls.length, 4); same(d.cond, prev.cond); assert.equal(d.condStale, true); assert.equal(d.daysStale, false); assert.equal(d.errs.cond, 'refused by the site firewall (HTTP 403)'); same(d.zone, prev.zone, 'no request left for the zone page');
  assert.equal(d.day, '2026-11-14'); same(plain(L2.BY_ID.ercot_grid.digest(d)).level, 1);
});

test('ercot_grid can fail every day and leave nothing worse than a stale mark', async () => {
  const L = fresh(), store = L.memoryStore(), opt = (o, now) => ({ scope: ['cpc_outlook', 'nbm_extended', 'ercot_grid'], store, fetch: fakeFetch(routes(o)), env: 'node', now: () => now, http: { backoffMs: 1 } });
  L.ercot.waits = [0, 0];
  assert.equal((await L.refresh(opt({}, T0))).ok, true);
  const good = plain(await store.get(L.K.src('ercot_grid'))); assert.equal(good.ok, true); assert.equal(good.n, 4);
  let recs = await L.snapshot(store, null), o = L.derive.outlook(recs, T0); same([o.ok, o.tier, o.grid.level, o.grid.stale, o.inputs.ercot_grid.state], [true, 1, 1, false, 'ok']);
  /* seven mornings in a row the firewall refuses everything */
  for (let day = 1; day <= 7; day++) {
    const fetch = fakeFetch(routes({ prc: REFUSED, sd: REFUSED, zone: REFUSED, nbm: nbmOn(day) })), r = await L.refresh(Object.assign(opt({}, days(day)), { fetch }));
    same(r.failed.map(f => f.id), ['ercot_grid'], 'the other sources refresh as ever'); same(r.ran.slice().sort(), ['cpc_outlook', 'nbm_extended']); assert.equal(on(fetch, 'www.ercot.com').length, 4, 'four requests a day, no more');
    const rec = plain(await store.get(L.K.src('ercot_grid'))); same(rec.data, good.data, 'the last good reading stays'); assert.equal(rec.at, good.at); assert.equal(rec.ok, false); assert.equal(rec.err.msg, 'the grid operator\'s site could not be read: refused by the site firewall (HTTP 403)');
    recs = await L.snapshot(store, null); o = L.derive.outlook(recs, days(day));
    assert.equal(o.grid.stale, true); assert.equal(o.inputs.ercot_grid.state, 'stale'); assert.ok(o.notes.some(t => /^The grid reading is stale/.test(t))); assert.ok(!o.evidence.some(e => e.kind === 'grid'));
    assert.equal(typeof o.headline, 'string'); assert.doesNotThrow(() => L.derive.notices(recs, days(day)));
  }
  /* the day it answers again the mark is gone */
  assert.equal((await L.refresh(opt({ nbm: nbmOn(8), prc: prcOn(8) }, days(8)))).ok, true); o = L.derive.outlook(await L.snapshot(store, null), days(8)); assert.equal(o.grid.stale, false);
  /* and with a Weather Watch on record when the refusals start, the watch stops counting at once instead of lingering */
  const s2 = L.memoryStore(), watch = JSON.parse(F.prc); watch.current_condition.state = 'weather'; watch.current_condition.title = 'Weather Watch';
  await L.refresh({ scope: ['ercot_grid'], store: s2, fetch: fakeFetch(routes({ prc: JSON.stringify(watch) })), env: 'node', now: () => T0, http: { backoffMs: 1 } });
  o = L.derive.outlook(await L.snapshot(s2, null), T0); same([o.tier, o.evidence[0].kind, o.grid.name, o.grid.stale], [2, 'grid', 'Weather Watch', false]);
  await L.refresh({ scope: ['ercot_grid'], store: s2, fetch: fakeFetch(routes({ prc: REFUSED, sd: REFUSED })), env: 'node', now: () => new Date(+T0 + 6 * 36e5), http: { backoffMs: 1 } });
  o = L.derive.outlook(await L.snapshot(s2, null), new Date(+T0 + 6 * 36e5)); same([o.tier, o.grid.stale, o.grid.why], [0, true, 'the last refresh of the grid source failed']);
});

test('ercot_grid failure rules: either part alone keeps the run alive; kept values are marked stale and past forecast days are dropped', async () => {
  const L = fresh(); L.ercot.waits = [0, 0];
  const prev = (await run(L, 'ercot_grid', fakeFetch(routes()))).data, go = async (o, p, now) => (await run(L, 'ercot_grid', fakeFetch(routes(o)), p === undefined ? prev : p, now || days(1))).data;
  let d = await go({ sd: DOWN }); same([d.condStale, d.daysStale], [false, true]); assert.match(d.errs.days, /HTTP 503 from www\.ercot\.com/); same(d.days, prev.days, 'tomorrow and later are still ahead');
  d = await go({ sd: DOWN }, prev, days(3)); same(d.days.map(x => x.d), ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19'], 'days already past are not carried as a forecast'); assert.equal(plain(L.BY_ID.ercot_grid.digest(d)).peakMw, 54480);
  d = await go({ sd: '{"lastUpdated":"x","forecast":[]}' }); assert.equal(d.errs.days, 'no forecast days in the answer'); assert.equal(d.daysStale, true);
  d = await go({ prc: '{"lastUpdated":"x"}' }); assert.equal(d.errs.cond, 'no current condition in the answer'); same([d.condStale, d.daysStale], [true, false]); same(d.cond, prev.cond);
  d = await go({ prc: F.wall }); assert.match(d.errs.cond, /not JSON from www\.ercot\.com/, 'a challenge page sent with HTTP 200'); assert.equal(d.condStale, true);
  d = await go({ prc: DOWN }, null); assert.equal(d.cond, null); assert.equal(d.condStale, true); assert.equal(d.days.length, 6); same(plain(L.BY_ID.ercot_grid.digest(d)), { level: null, prcMw: null, peakMw: 54480, morningDays: 0, ncPeak: 15461 });
  d = await go({ sd: DOWN }, null); same(d.days, []); assert.equal(plain(L.BY_ID.ercot_grid.digest(d)).morningDays, null, 'unknown, not zero');
  await assert.rejects(run(L, 'ercot_grid', fakeFetch(routes({ prc: DOWN, sd: DOWN })), prev), /the grid operator's site could not be read: HTTP 503 from www\.ercot\.com/);
  const f = fakeFetch(routes({ prc: DOWN, sd: DOWN })); await assert.rejects(run(L, 'ercot_grid', f)); assert.equal(f.calls.length, 2, 'a server error is not asked twice, and the zone page is not tried when the run has failed');
  /* a refusal on the optional zone page is not argued with */
  const fz = fakeFetch(routes({ zone: REFUSED })); d = (await run(L, 'ercot_grid', fz, { zone: [] })).data; assert.equal(fz.calls.length, 3, 'no retry and no second day'); assert.equal(d.errs.zone, 'refused by the site firewall (HTTP 403)'); same([d.condStale, d.daysStale, d.zone.length], [false, false, 0]);
  /* since: when this collector first saw the condition it holds now */
  const watch = s => { const j = JSON.parse(F.prc); j.current_condition.state = s; j.current_condition.datetime += 86400; j.lastUpdated = '2026-11-14 12:16:05-0600'; return JSON.stringify(j); };
  d = await go({ prc: prcOn(1) }); same([d.cond.at, d.cond.since], ['2026-11-14T18:15:53.000Z', '2026-11-13T18:15:53.000Z'], 'the same state a day later: since stays'); d = await go({ prc: watch('weather') }); same([d.cond.level, d.cond.since], [2, '2026-11-14T18:15:53.000Z'], 'a new state starts its own count');
  d = await go({ prc: prcOn(3) }, prev, new Date('2026-11-16T18:16:05Z')); assert.equal(d.cond.since, '2026-11-13T18:15:53.000Z', 'three days between readings still joins up'); d = await go({ prc: prcOn(5) }, prev, days(5)); assert.equal(d.cond.since, '2026-11-18T18:15:53.000Z', 'after a gap of five days the count starts again from this reading');
});

/* ---------------------------------------------------------------- the two week cold outlook ---------------------------------------------------------------- */

const TIERS = ['no cold signal', 'lean cold', 'cold favored', 'cold hazard'];
const KEYS = ['anchor', 'blend', 'd610', 'd814', 'evidence', 'grades', 'grid', 'headline', 'inputs', 'lean', 'notes', 'ok', 'persist', 'reason', 'rules', 'season', 'seasonNow', 'stale', 'sub', 'tier', 'tierName', 'today', 'window'];
const clone = x => JSON.parse(JSON.stringify(x));
const put = (o, path, v) => { const ks = path.split('.'); let x = o; for (const k of ks.slice(0, -1)) x = x[k]; x[ks[ks.length - 1]] = v; return o; };
/* the hand made base records with a few fields changed */
const made = set => { const r = clone(CASES.base); for (const k of Object.keys(set || {})) put(r, k, set[k]); return r; };
const NOW = new Date(CASES.now), B = 'cpc_outlook.data.ext.', below = (p6, p8) => Object.assign({}, p6 ? { [B + 'd610.cat']: 'Below', [B + 'd610.prob']: p6 } : {}, p8 ? { [B + 'd814.cat']: 'Below', [B + 'd814.prob']: p8 } : {});
/* every string a reader sees, in plain words */
const plainWords = o => { prose(o.headline); if (o.sub) prose(o.sub); if (o.reason) prose(o.reason); o.notes.forEach(prose); o.evidence.forEach(e => prose(e.text)); };

test('all three through the runner with the first grid call refused: nothing fails, and the reading of the day is tier 1 on the named freeze risk', async () => {
  const L = fresh(); let n = 0; const fetch = fakeFetch(routes({ prc: () => (n++ ? F.prc : REFUSED) })), store = L.memoryStore();
  const r = await L.refresh({ scope: ['cpc_outlook', 'nbm_extended', 'ercot_grid'], store, fetch, env: 'node', now: () => T0, http: { backoffMs: 1 } });
  same(r.failed, []); same(r.skipped, []); same(r.ran.slice().sort(), ['cpc_outlook', 'ercot_grid', 'nbm_extended']);
  same(['mapservices.weather.noaa.gov', 'api.weather.gov', 'mesonet.agron.iastate.edu', 'www.ercot.com'].map(h => on(fetch, h).length), [13, 3, 1, 4], '21 requests on the weekly day');
  assert.equal(urls(fetch).filter(u => u.endsWith('/daily-prc.json')).length, 2, 'the refused call was asked once more');
  const recs = plain(await L.snapshot(store, null)), before = JSON.stringify(recs), o = plain(L.derive.outlook(recs, T0));
  assert.equal(JSON.stringify(recs), before, 'the reading changes nothing it is given'); same(Object.keys(o).sort(), KEYS);
  same([o.ok, o.reason, o.stale, o.tier, o.tierName, o.lean, o.persist, o.season, o.seasonNow, o.today, o.anchor], [true, '', false, 1, 'lean cold', 'cold', 0, true, true, '2026-11-13', '2026-11-23']); same(o.window, { start: '2026-11-23', end: '2026-11-24' });
  same(o.evidence, [{ tier: 1, kind: 'named', text: 'Slight risk of much below normal temperatures (a freeze is mentioned), named in the hazards discussion for the Southern Plains or Texas', start: '2026-11-23', end: '2026-11-24', issued: '2026-11-12T19:57:00+00:00', g: 'B',
    quote: 'Slight risk of much below normal temperatures (and possible first freeze) for much of the Southern Plains and parts of adjacent states, Mon-Tue, Nov 23-24' }], 'the forecaster\'s own sentence rides along as a quote');
  assert.equal(o.headline, 'Lean cold, Nov 23 to 24: slight risk of much below normal temperatures (a freeze is mentioned), named in the hazards discussion for the Southern Plains or Texas');
  assert.equal(o.sub, 'Days 6 to 10 (Nov 18 to 22): above normal at 50 to 60 percent, about 74 percent of the normal heating load. Days 8 to 14 (Nov 20 to 26): above normal at 33 to 40 percent, about 97 percent of the normal heating load.');
  same([o.d610.cat, o.d610.prob, o.d610.load.idx, o.d814.cat, o.d814.prob, o.d814.load.idx], ['Above', 50, 74, 'Above', 33, 97]);
  /* the blend's best freeze chance is 14 percent, under the line of 20, so the tier rests on the named risk alone */
  same(o.blend, { run: '2026-11-13T12:00:00.000Z', freeze: { stn: 'KDTO', name: 'Denton', m: '2026-11-24', d: '2026-11-23', lead: 11, lowF: 41, sd: 8, p32: 14, p40: 48, p25: 3, ext: true }, coldest: { stn: 'KDTO', name: 'Denton', m: '2026-11-24', d: '2026-11-23', lead: 11, lowF: 41, sd: 8, p32: 14, p40: 48, p25: 3, ext: true } });
  same(o.grid, { level: 1, name: 'Normal conditions', state: 'normal', prcMw: 19558, at: '2026-11-13T18:16:05.000Z', since: '2026-11-13T18:15:53.000Z', stale: false, why: '' });
  same(o.inputs, { cpc_outlook: { state: 'ok', at: T0.toISOString(), issued: '2026-11-12' }, nbm_extended: { state: 'ok', at: T0.toISOString(), run: '2026-11-13T12:00:00.000Z' }, ercot_grid: { state: 'ok', at: T0.toISOString() } });
  same(o.notes, []); same(o.grades, { tier: 'C', load: 'C', outlook: 'B', hazard: 'B', named: 'B', winter: 'B', blend: 'B', chance: 'C', grid: 'A' }); same(o.rules, plain(L.derive.OUTLOOK_RULES)); plainWords(o);
  same(plain(L.derive.outlookNotice(recs, T0)), [], 'tier 1 is for staging, not for a notification');
  /* in a plain web page the grid source is skipped (it answers only its own pages), and the reading goes on without it */
  const s2 = L.memoryStore(), f2 = fakeFetch(routes()), r2 = await L.refresh({ scope: ['cpc_outlook', 'nbm_extended', 'ercot_grid'], store: s2, fetch: f2, env: 'page', now: () => T0, http: { backoffMs: 1 } });
  same(r2.skipped.map(x => x.id), ['ercot_grid']); assert.equal(on(f2, 'www.ercot.com').length, 0); const o2 = L.derive.outlook(await L.snapshot(s2, null), T0);
  same([o2.ok, o2.tier, o2.grid, o2.inputs.ercot_grid.state], [true, 1, null, 'missing']); same(plain(o2.notes), ['No grid reading is stored (the grid source runs in the browser app only).']);
});

test('two week cold outlook: every rule of every tier, each from a hand made record', () => {
  const L = fresh(); same(plain(L.derive.OUTLOOK_TIER), TIERS);
  for (const c of CASES.cases) {
    const recs = made(c.set), o = plain(L.derive.outlook(recs, NOW));
    assert.equal(o.ok, true, c.name); same([o.tier, o.tierName, o.lean, o.evidence.map(e => e.kind), o.window], [c.tier, TIERS[c.tier], c.lean, c.kinds, c.window], c.name);
    same(Object.keys(o).sort(), KEYS, c.name); same([o.stale, o.season, o.seasonNow, o.today, o.notes, o.reason], [false, true, true, '2026-12-01', [], ''], c.name); plainWords(o);
    /* every piece of evidence: its tier, the dates it speaks of, when the publisher issued it, its grade */
    for (const e of o.evidence) { assert.ok(e.tier >= 1 && e.tier <= 3 && e.tier <= o.tier, c.name); assert.ok(/^\d{4}-\d\d-\d\d$/.test(e.start) && /^\d{4}-\d\d-\d\d$/.test(e.end) && e.start <= e.end, c.name); assert.ok(e.issued && !Number.isNaN(Date.parse(e.issued)), c.name); assert.match(e.g, /^[ABC]$/, c.name); }
    assert.equal(o.evidence.length ? o.evidence[0].tier : 0, o.tier, 'the highest tier leads'); assert.equal(o.anchor, o.window ? o.evidence.filter(e => e.tier === o.tier).map(e => e.first || e.start).sort()[0] : null, c.name);
    assert.ok(o.tier ? o.headline.startsWith(TIERS[o.tier].charAt(0).toUpperCase() + TIERS[o.tier].slice(1) + ', ') : /^(No cold signal past the seven day forecast|Mild through week two: no cold signal past the seven day forecast)$/.test(o.headline), c.name + ': ' + o.headline);
    assert.equal(o.sub.startsWith('Days 6 to 10 (Dec 6 to 10): '), true, c.name); same(plain(L.derive.outlookNotice(recs, NOW)).length, o.tier >= 2 ? 1 : 0, c.name);
  }
  same([0, 1, 2, 3].map(t => CASES.cases.filter(c => c.tier === t).length), [8, 5, 9, 11], 'every tier is reached, and missed, more than once');
  same([...new Set(CASES.cases.flatMap(c => c.kinds))].sort(), ['blend', 'grid', 'hazard', 'named', 'outlook', 'winter']);
});

test('two week cold outlook: the words of each kind of evidence', () => {
  const L = fresh(), by = name => CASES.cases.find(c => c.name === name), read = name => plain(L.derive.outlook(made(by(name).set), NOW)), head = name => read(name).headline;
  assert.equal(head('quiet: near normal on both maps, a mild blend, a normal grid'), 'No cold signal past the seven day forecast'); assert.equal(head('warm: both maps above normal at 50 or more'), 'Mild through week two: no cold signal past the seven day forecast');
  assert.equal(read('quiet: near normal on both maps, a mild blend, a normal grid').sub, 'Days 6 to 10 (Dec 6 to 10): near normal at 36 to 40 percent, about 100 percent of the normal heating load. Days 8 to 14 (Dec 8 to 14): near normal at 36 to 40 percent, about 100 percent of the normal heating load.');
  assert.equal(head('days 8 to 14 below normal at 40'), 'Lean cold, Dec 8 to 14: days 8 to 14 lean colder than normal (40 to 50 percent)'); assert.equal(head('days 6 to 10 below normal at 40, days 8 to 14 near normal'), 'Lean cold, Dec 6 to 10: days 6 to 10 lean colder than normal (40 to 50 percent)');
  assert.equal(head('days 8 to 14 below normal at 50'), 'Cold favored, Dec 8 to 14: days 8 to 14 favor a colder than normal stretch (50 to 60 percent)');
  assert.equal(head('days 6 to 10 below normal at 50 with days 8 to 14 at 40'), 'Cold favored, Dec 6 to 14: days 6 to 10 (50 to 60 percent) and days 8 to 14 (40 to 50 percent) favor a colder than normal stretch');
  assert.equal(head('days 8 to 14 below normal at 70'), 'Cold hazard, Dec 8 to 14: days 8 to 14 colder than normal at 70 to 80 percent');
  assert.equal(head('a Much Below Normal Temperatures area drawn over a county'), 'Cold favored, Dec 9 to 12: a Much Below Normal Temperatures area is drawn over at least one of the 12 counties'); assert.equal(head('a Frost/Freeze area drawn over a county'), 'Cold favored, Dec 4 to 5: a Frost/Freeze area is drawn over at least one of the 12 counties');
  assert.equal(head('a Freezing Rain area drawn over a county'), 'Cold hazard, Dec 5 to 6: a Freezing Rain area is drawn over at least one of the 12 counties');
  const named = read('a moderate risk named for Texas'); assert.equal(named.headline, 'Cold favored, Dec 9 to 11: moderate risk of much below normal temperatures, named in the hazards discussion for the Southern Plains or Texas'); assert.equal(named.evidence[0].quote, 'Moderate risk of much below normal temperatures for much of Texas and Oklahoma, Wed-Fri, Dec 9-11'); assert.ok(!('quote' in read('days 8 to 14 below normal at 50').evidence[0]), 'only the forecaster\'s words are a quote');
  assert.equal(head('moderate winter storm impacts at 30 percent'), 'Cold hazard, Dec 3 to 4: 30 percent chance of moderate winter storm impacts in at least one of the 12 counties'); assert.equal(head('minor winter storm impacts at 60 percent'), 'Cold hazard, Dec 3 to 4: 60 percent chance of minor winter storm impacts in at least one of the 12 counties');
  assert.equal(head('a 20 percent chance of a freeze at one airport'), 'Lean cold, Dec 12: 20 percent chance of a freeze at Denton on the morning of Dec 12 (blend low 37°F)'); assert.equal(read('a 20 percent chance of a freeze at one airport').evidence[0].g, 'C', 'the chance is the atlas\'s reading of the blend');
  const hard = read('a blend low of 25 at one airport'); assert.equal(hard.headline, 'Cold hazard, Dec 10: blend low of 25°F at Denton on the morning of Dec 10'); assert.equal(hard.evidence[0].g, 'B'); same([hard.blend.coldest.name, hard.blend.coldest.lowF, hard.blend.freeze.p32], ['Denton', 25, 86]);
  assert.equal(plain(L.derive.outlook(made({ 'nbm_extended.data.stations.1.nights.3.lowF': -2, 'nbm_extended.data.stations.1.nights.3.p32': 100 }), NOW)).headline, 'Cold hazard, Dec 10: blend low of minus 2°F at Denton on the morning of Dec 10', 'no minus sign');
  const watch = read('the grid at Weather Watch in the heating season'); assert.equal(watch.headline, 'Cold favored, Dec 1: the Texas grid operator has declared a Weather Watch'); same([watch.evidence[0].g, watch.evidence[0].first, watch.anchor, watch.grid.since], ['A', '2026-11-30', '2026-11-30', '2026-11-30T15:00:00.000Z']);
  assert.equal(head('the grid at Energy Emergency Alert 2 in the heating season'), 'Cold hazard, Dec 1: the Texas grid operator has declared an Energy Emergency Alert 2');
  /* a metro split between bands says so; a window that crosses a month names both */
  const split = plain(L.derive.outlook(made(Object.assign(below(0, 40), { [B + 'd814.uniform']: false, [B + 'd814.end']: '2026-12-14', [B + 'd610.start']: '2026-11-30', [B + 'd610.issued']: '2026-11-29', [B + 'd610.end']: '2026-12-04' })), NOW));
  assert.equal(split.sub, 'Days 6 to 10 (Nov 30 to Dec 4): near normal at 36 to 40 percent, about 100 percent of the normal heating load. Days 8 to 14 (Dec 8 to 14): below normal at 40 to 50 percent in most counties, about 100 percent of the normal heating load.');
});

test('two week cold outlook: stale guards, leg by leg', () => {
  const L = fresh(), read = (set, now) => plain(L.derive.outlook(made(set), now || NOW)), hot = below(60, 70);
  /* the outlook maps: three days and no more, and never past their own window */
  let o = read(Object.assign({}, hot, { [B + 'd610.issued']: '2026-11-28', [B + 'd814.issued']: '2026-11-28' })); same([o.tier, o.stale, o.inputs.cpc_outlook.state], [3, false, 'ok'], 'issued three days ago still counts');
  o = read(Object.assign({}, hot, { [B + 'd610.issued']: '2026-11-27', [B + 'd814.issued']: '2026-11-27' })); same([o.ok, o.tier, o.stale, o.d610, o.d814, o.inputs.cpc_outlook.state, o.lean], [true, 0, true, null, null, 'stale', 'neutral'], 'issued four days ago raises nothing');
  same(o.notes, ['The stored outlook maps were issued more than 3 days ago or their windows have passed.']); assert.equal(o.headline, 'No freeze signal in the blend guidance out to day 11'); assert.equal(o.sub, 'Days 6 to 10 (no data): not available. Days 8 to 14 (no data): not available.');
  o = read(Object.assign({}, hot, { [B + 'd814.issued']: '2026-11-27' })); same([o.tier, o.d814, o.d610.prob, o.evidence[0].text], [1, null, 60, 'Days 6 to 10 lean colder than normal (60 to 70 percent)'], 'one map stale: the other speaks alone');
  o = read(Object.assign({}, hot, { [B + 'd610.end']: '2026-11-30', [B + 'd814.end']: '2026-11-30' })); same([o.tier, o.stale], [0, true], 'a window that has passed');
  /* named risks: four days from the discussion, and only until their end date */
  const risk = { risk: 'High', hazard: 'heavy snow', area: 'north Texas', days: 'Wed-Fri', start: '2026-12-02', end: '2026-12-04', kind: 'snow', cold: true, freeze: false, near: true, text: 'High risk of heavy snow for north Texas, Wed-Fri, Dec 2-4' }, T = 'cpc_outlook.data.text.thr.';
  o = read({ [T + 'items']: [risk], [T + 'issued']: '2026-11-27T19:57:00+00:00' }); assert.equal(o.tier, 3, 'issued four days ago to the hour still counts'); o = read({ [T + 'items']: [risk], [T + 'issued']: '2026-11-27T17:00:00+00:00' }); assert.equal(o.tier, 0, 'older than four days');
  o = read({ [T + 'items']: [risk] }, new Date('2026-12-04T18:00:00Z')); assert.equal(o.tier, 3, 'on its last day'); o = read({ [T + 'items']: [Object.assign({}, risk, { end: '2026-12-03' })] }, new Date('2026-12-04T18:00:00Z')); assert.equal(o.tier, 0, 'the day after it ends');
  /* hazard areas: until their end date, from a file no older than four days */
  const area = [{ win: 'd3_7', kind: 'temp', label: 'Hazardous Cold', start: '2026-11-30', end: '2026-12-02', cold: true }], H = 'cpc_outlook.data.haz.';
  o = read({ [H + 'metro']: area }); same([o.tier, o.window], [3, { start: '2026-11-30', end: '2026-12-02' }], 'an area already under way'); o = read({ [H + 'metro']: area, [H + 'file']: { d3_7: '2026-11-27T17:45:00.000Z' } }); assert.equal(o.tier, 0, 'drawn more than four days ago');
  o = read({ [H + 'metro']: area, [H + 'file']: {} }); assert.equal(o.tier, 3, 'no file date: the age of the record stands in'); o = read({ [H + 'metro']: area, [H + 'file']: {}, 'cpc_outlook.at': '2026-11-26T11:00:00.000Z' }); assert.equal(o.tier, 0);
  o = read({ [H + 'metro']: [Object.assign({}, area[0], { cold: false, label: 'High Winds' })] }); assert.equal(o.tier, 0, 'not a cold area');
  /* winter storm odds: windows still open, from a file no older than three days */
  const W = 'cpc_outlook.data.winter.', odds = [{ start: '2026-12-01T00:00:00.000Z', end: '2026-12-02T00:00:00.000Z', prob: 50 }];
  o = read({ [W + 'moderate']: odds }); same([o.tier, o.window], [3, { start: '2026-11-30', end: '2026-12-01' }], 'a window that began last evening and is still open');
  o = read({ [W + 'moderate']: odds }, new Date('2026-12-02T00:00:00Z')); assert.equal(o.evidence.filter(e => e.kind === 'winter').length, 0, 'a window that has closed'); o = read({ [W + 'moderate']: odds, [W + 'file']: '2026-11-28T12:00:00.000Z' }); assert.equal(o.tier, 0, 'a file more than three days old');
  /* blend guidance: a run two days old at most, and only mornings six days out or later */
  const N = 'nbm_extended.data.', cold = { [N + 'stations.1.nights.3.lowF']: 20, [N + 'stations.1.nights.3.p32']: 96 };
  o = read(cold, new Date('2026-12-03T12:00:00Z')); same([o.tier, o.inputs.nbm_extended.state], [3, 'ok'], 'a run two days old to the hour'); o = read(cold, new Date('2026-12-03T12:00:01Z')); same([o.tier, o.inputs.nbm_extended.state, o.blend], [0, 'stale', { run: null, freeze: null, coldest: null }]);
  assert.ok(o.notes.includes('The stored blend guidance is more than 2 days old or stops short of day 6.'));
  o = read(cold, new Date('2026-12-05T02:00:00Z')); assert.equal(o.evidence.filter(e => e.kind === 'blend').length, 0, 'four days later the cold morning is five days out and belongs to the seven day cold watch (and the run is stale besides)');
  o = read({ [N + 'stations.1.nights.0.lowF']: 20, [N + 'stations.1.nights.0.p32']: 96, [N + 'stations.1.nights.0.m']: '2026-12-06' }); same([o.tier, o.blend.coldest.lowF], [0, 41], 'a morning five days out is not read here');
  /* the grid: stale at once when its last read failed, and after 36 hours whatever happened */
  const G = 'ercot_grid.data.', watch = { [G + 'cond.state']: 'conservation', [G + 'cond.level']: 4, [G + 'cond.name']: 'Conservation Appeal' };
  o = read(watch); same([o.tier, o.grid.stale, o.inputs.ercot_grid.state], [3, false, 'ok']);
  o = read(Object.assign({ [G + 'condStale']: true }, watch)); same([o.tier, o.grid.level, o.grid.stale, o.grid.why, o.inputs.ercot_grid.state], [0, 4, true, 'the last read of the grid condition failed', 'stale']); same(o.notes, ['The grid reading is stale: the last read of the grid condition failed.']);
  o = read(Object.assign({ 'ercot_grid.ok': false }, watch)); same([o.tier, o.grid.stale, o.grid.why], [0, true, 'the last refresh of the grid source failed']);
  o = read(watch, new Date('2026-12-02T23:00:05Z')); same([o.tier, o.grid.stale], [3, false], '36 hours to the second'); o = read(watch, new Date('2026-12-02T23:00:06Z')); same([o.grid.stale, o.grid.why, o.evidence.filter(e => e.kind === 'grid').length], [true, 'the grid condition was read more than 36 hours ago', 0]);
  o = read(Object.assign({}, watch, { [G + 'cond.updated']: null, [G + 'cond.at']: null })); same([o.tier, o.grid.stale], [0, true], 'a condition with no time on it is not trusted');
});

test('two week cold outlook: the season gate keeps July out, whatever the maps and the grid say', () => {
  const L = fresh(), now = new Date(SUMMER.now), o = plain(L.derive.outlook(SUMMER.recs, now));
  same([o.ok, o.tier, o.lean, o.season, o.seasonNow, o.evidence, o.window, o.persist], [true, 0, 'neutral', false, false, [], null, 2]); same([o.d814.cat, o.d814.prob, o.grid.level, o.grid.name, o.grid.stale], ['Below', 70, 2, 'Weather Watch', false], 'the inputs are all there, they only raise nothing');
  assert.equal(o.headline, 'No cold signal past the seven day forecast'); assert.equal(o.sub, 'Days 6 to 10 (Jul 15 to 19): below normal at 50 to 60 percent. Days 8 to 14 (Jul 17 to 23): below normal at 70 to 80 percent.', 'no heating load to speak of, so none is quoted'); plainWords(o);
  const eea = clone(SUMMER.recs); Object.assign(eea.ercot_grid.data.cond, { state: 'eea2', level: 6, name: 'Energy Emergency Alert 2' }); same([L.derive.outlook(eea, now).tier, plain(L.derive.outlookNotice(eea, now))], [0, []], 'a summer grid emergency is not a cold hazard');
  /* a record made without the class table carries no load: the gate then reads the table by the date of the window */
  const bare = clone(SUMMER.recs); bare.cpc_outlook.data.ext.d610.load = null; bare.cpc_outlook.data.ext.d814.load = null; same([L.derive.outlook(bare, now).tier, L.derive.outlook(bare, now).season], [0, false]);
  /* and with no table loaded at all it falls back on the calendar: November through March */
  const L2 = fresh(['live/core.js', 'live/geo.js', 'live/derive.js', 'live/outlook.js']); same([L2.derive.outlook(bare, now).tier, L2.derive.outlook(bare, now).season], [0, false]);
  const winter = made(below(0, 50)); winter.cpc_outlook.data.ext.d814.load = null; winter.cpc_outlook.data.ext.d610.load = null; same([L2.derive.outlook(winter, NOW).tier, L2.derive.outlook(winter, NOW).season, L.derive.outlook(winter, NOW).tier], [2, true, 2]);
  same(['2026-10-01', '2026-10-25', '2026-10-26', '2026-11-13', '2027-01-15', '2027-03-29', '2027-03-30', '2027-04-20', '2026-07-04'].map(d => L.derive.inHeatingSeason(d)), [false, false, true, true, true, true, false, false, false], 'by the class table: October 26 to March 29');
  same(['2026-10-27', '2026-11-01', '2027-03-31', '2027-04-01', '2026-07-04'].map(d => L2.derive.inHeatingSeason(d)), [false, true, true, false, false], 'by the calendar');
  /* the shoulder of the season: the same call counts once the cold third of the window averages 8 heating degree days a day */
  const at = hdd => { const r = made(below(0, 50)); r.cpc_outlook.data.ext.d814.load.coldHdd = hdd; return L.derive.outlook(r, NOW); }; same([at(7.65).tier, at(7.65).season, at(8).tier, at(11.13).tier], [0, false, 2, 2]);
});

test('two week cold outlook: missing, stale or broken records give a calm, complete object and never a throw', () => {
  const L = fresh(), shape = o => { same(Object.keys(plain(o)).sort(), KEYS); assert.equal(typeof o.ok, 'boolean'); assert.ok(o.tier >= 0 && o.tier <= 3); assert.equal(o.tierName, TIERS[o.tier]); assert.ok(Array.isArray(o.evidence) && Array.isArray(o.notes)); plainWords(plain(o)); return plain(o); };
  const NOTHING = 'No outlook, blend guidance or grid reading is stored yet. Refresh the live data.', OLD = 'Nothing stored is fresh enough to judge the two weeks ahead. Refresh the live data.';
  for (const recs of [null, undefined, {}, { cpc_outlook: null }, { cpc_outlook: { id: 'cpc_outlook', data: null, skipped: { why: 'turned off in settings' } }, nbm_extended: { ok: false, err: { msg: 'x' }, data: null }, ercot_grid: {} }, 'x', 7]) {
    const o = shape(L.derive.outlook(recs, NOW)); same([o.ok, o.reason, o.stale, o.tier, o.lean, o.window, o.anchor, o.evidence, o.d610, o.d814, o.grid, o.headline, o.sub], [false, NOTHING, true, 0, 'neutral', null, null, [], null, null, null, 'No two week outlook on hand', NOTHING]);
    same(o.inputs, { cpc_outlook: { state: 'missing', at: null, issued: null }, nbm_extended: { state: 'missing', at: null, run: null }, ercot_grid: { state: 'missing', at: null } }); same(o.blend, { run: null, freeze: null, coldest: null }); assert.equal(o.notes.length, 3); same(plain(L.derive.outlookNotice(recs, NOW)), []);
  }
  /* any one record alone */
  const base = CASES.base; let o = shape(L.derive.outlook({ cpc_outlook: base.cpc_outlook }, NOW)); same([o.ok, o.stale, o.tier, o.grid, o.blend.coldest, o.inputs.nbm_extended.state, o.inputs.ercot_grid.state], [true, false, 0, null, null, 'missing', 'missing']); same(o.notes, ['No blend guidance is stored yet.', 'No grid reading is stored (the grid source runs in the browser app only).']);
  o = shape(L.derive.outlook({ nbm_extended: base.nbm_extended }, NOW)); same([o.ok, o.stale, o.tier, o.headline, o.blend.coldest.lowF], [true, true, 0, 'No freeze signal in the blend guidance out to day 11', 41]); assert.equal(o.notes[0], 'No outlook record is stored yet.');
  o = shape(L.derive.outlook({ ercot_grid: base.ercot_grid }, NOW)); same([o.ok, o.reason, o.grid.level, o.grid.stale, o.headline], [false, OLD, 1, false, 'No two week outlook on hand'], 'a normal grid alone says nothing about the two weeks ahead');
  const eea = clone(base.ercot_grid); Object.assign(eea.data.cond, { state: 'eea1', level: 5, name: 'Energy Emergency Alert 1' }); o = shape(L.derive.outlook({ ercot_grid: eea }, NOW)); same([o.ok, o.tier, o.evidence[0].kind], [true, 3, 'grid'], 'a grid emergency in the heating season speaks for itself');
  /* everything a month old */
  o = shape(L.derive.outlook(base, new Date('2027-01-01T18:00:00Z'))); same([o.ok, o.reason, o.tier, o.stale], [false, OLD, 0, true]); same([o.inputs.cpc_outlook.state, o.inputs.nbm_extended.state, o.inputs.ercot_grid.state], ['stale', 'stale', 'stale']); assert.equal(o.notes.length, 3);
  /* shapes nobody should store: the reading stays whole */
  const odd = [{ cpc_outlook: { data: 'text' } }, { cpc_outlook: { data: { ext: 'no' } } }, { cpc_outlook: { data: { ext: { d610: 5, d814: [] }, haz: { metro: [null, 5, {}, { cold: true }] }, winter: { minor: 'x', moderate: [null, {}] }, text: { thr: { issued: 'never', items: [null] } }, hist: [null, 3, {}] } } },
    { cpc_outlook: { data: { ext: { d814: { issued: '2026-11-30', start: 'soon', end: '2026-12-14', cat: 'Below', prob: 70 } }, text: { thr: { issued: '2026-11-30T19:57:00+00:00', items: 'x' } } } } },
    { nbm_extended: { data: { run: '2026-12-01T12:00:00.000Z', stations: [null, {}, { nights: [null, { m: 'x', lowF: 10 }, { m: '2026-12-09' }] }] } } }, { nbm_extended: { data: { run: 'x', stations: 'y' } } }, { ercot_grid: { data: { cond: 'normal' } } }, { ercot_grid: { data: { cond: { level: 'high', updated: 'x' } } } }];
  for (const recs of odd) { const r = shape(L.derive.outlook(recs, NOW)); assert.equal(r.tier, 0, JSON.stringify(recs)); assert.doesNotThrow(() => L.derive.outlookNotice(recs, NOW)); }
  for (const now of ['never', null, undefined, NaN, {}]) shape(L.derive.outlook(base, now));
  assert.equal(shape(L.derive.outlook(base, +NOW)).today, '2026-12-01', 'milliseconds are a time too'); assert.equal(shape(L.derive.outlook(base, '2026-12-02T03:00:00Z')).today, '2026-12-01', 'the date is the one in Dallas');
});

test('two week cold outlook: the rules object holds every threshold and a caller can move them', () => {
  const L = fresh(), R = L.derive.OUTLOOK_RULES;
  same(plain(R), { leanBelow: 40, favoredBelow: 50, hazardBelow: 70, leanFreeze: 20, favoredFreeze: 50, hardLowF: 25, winterMinor: 60, winterModerate: 30, warmAbove: 50, seasonHdd: 8, staleDays: 3, blendDays: 2, gridHours: 36, fromDay: 6 });
  assert.equal(R.hardLowF, L.derive.TH.hard, 'the hard freeze line of the cold picture'); same(plain(L.derive.OUTLOOK_GRADES).tier, 'C');
  const at = (set, rules) => plain(L.derive.outlook(made(set), NOW, rules ? { rules } : undefined));
  same([at(below(0, 33)).tier, at(below(0, 33), { leanBelow: 33 }).tier, at(below(0, 50), { favoredBelow: 60 }).tier, at(below(0, 60), { hazardBelow: 60 }).tier], [0, 1, 1, 3]);
  same([at({}, { leanFreeze: 14 }).tier, at({}, { leanFreeze: 14 }).evidence[0].text, at({}, { hardLowF: 41 }).tier], [1, '14 percent chance of a freeze at Denton on the morning of Dec 12 (blend low 41°F)', 3]);
  same([at({ [B + 'd610.cat']: 'Above', [B + 'd610.prob']: 40, [B + 'd814.cat']: 'Above', [B + 'd814.prob']: 40 }, { warmAbove: 40 }).lean, at(below(0, 50), { seasonHdd: 30 }).tier, at(below(0, 70), { staleDays: 0 }).tier], ['warm', 0, 0]);
  const early = { 'nbm_extended.data.stations.0.nights.1.lowF': 12, 'nbm_extended.data.stations.0.nights.1.p32': 100 };                         // a hard freeze seven days out
  same([at(early).tier, at(early).blend.coldest.m, at(early, { fromDay: 9 }).tier, at(early, { fromDay: 9 }).blend.coldest.m, at(early, { fromDay: 12 }).blend.coldest, at(early, { fromDay: 12 }).inputs.nbm_extended.state], [3, '2026-12-08', 0, '2026-12-12', null, 'stale'], 'only mornings that many days out and later');
  assert.equal(at({}, { leanBelow: 33 }).rules.leanBelow, 33); assert.equal(R.leanBelow, 40, 'the house rules are not touched');
});

test('two week cold outlook: how long a call has held, and a notice that is sent once for one cold spell', () => {
  const L = fresh(), hist = codes => codes.map((c, i) => ({ issued: new Date(Date.parse('2026-11-30') - i * 864e5).toISOString().slice(0, 10), d610: c[0], d814: c[1] }));
  const read = (set, now) => plain(L.derive.outlook(made(set), now || NOW)), note = (set, now) => plain(L.derive.outlookNotice(made(set), now || NOW));
  /* persist: issues in a row with days 8 to 14 below normal, newest first */
  same([read({ 'cpc_outlook.data.hist': hist([['N36', 'B40'], ['A33', 'B33'], ['N36', 'B50'], ['N36', 'N36'], ['N36', 'B60']]) }).persist, read({}).persist, read({ 'cpc_outlook.data.hist': hist([['B40', undefined], ['N36', 'B40'], ['N36', 'A33']]) }).persist], [3, 0, 1], 'an issue seen for one map only is passed over');
  /* a first day at tier 2: the key is the tier and the first day of the window */
  const day1 = Object.assign(below(0, 50), { 'cpc_outlook.data.hist': hist([['N36', 'B50'], ['N36', 'B40'], ['N36', 'N36']]) }), o1 = read(day1);
  same([o1.tier, o1.window.start, o1.anchor, o1.evidence[0].since, o1.evidence[0].issues, o1.evidence[0].first], [2, '2026-12-08', '2026-12-08', '2026-11-30', 1, '2026-12-08']);
  same(note(day1), [{ key: 'outlook:2:2026-12-08', title: 'Cold favored in the two week outlook', message: 'Cold favored, Dec 8 to 14: days 8 to 14 favor a colder than normal stretch (50 to 60 percent).', route: 'heat' }]); assert.equal(note(day1)[0].key, 'outlook:' + o1.tier + ':' + o1.window.start);
  /* the next two afternoons the same call is issued again: the window moves a day each time, the key does not */
  const later = n => { const d = k => new Date(Date.parse(k) + n * 864e5).toISOString().slice(0, 10), set = Object.assign({}, day1, { [B + 'd814.issued']: d('2026-11-30'), [B + 'd814.start']: d('2026-12-08'), [B + 'd814.end']: d('2026-12-14'), [B + 'd610.issued']: d('2026-11-30'), [B + 'd610.start']: d('2026-12-06'), [B + 'd610.end']: d('2026-12-10') });
    set['cpc_outlook.data.hist'] = Array.from({ length: n }, (_, i) => ({ issued: d('2026-11-30').slice(0, 8) + String(+d('2026-11-30').slice(8) - i).padStart(2, '0'), d610: 'N36', d814: 'B50' })).concat(day1['cpc_outlook.data.hist']); return set; };
  const o3 = read(later(2), new Date('2026-12-03T18:00:00Z')); same([o3.tier, o3.window.start, o3.anchor, o3.evidence[0].since, o3.evidence[0].issues, o3.persist], [2, '2026-12-10', '2026-12-08', '2026-11-30', 3, 4]);
  assert.equal(note(later(2), new Date('2026-12-03T18:00:00Z'))[0].key, 'outlook:2:2026-12-08', 'one cold spell, one key'); assert.equal(note(later(1), new Date('2026-12-02T18:00:00Z'))[0].key, 'outlook:2:2026-12-08');
  /* a break of an issue starts a new spell, and so does a step up a tier */
  const broken = later(2); broken['cpc_outlook.data.hist'][1].d814 = 'N36'; assert.equal(note(broken, new Date('2026-12-03T18:00:00Z'))[0].key, 'outlook:2:2026-12-10');
  const up = Object.assign({}, later(1), below(0, 70)); up['cpc_outlook.data.hist'][0].d814 = 'B70'; same(note(up, new Date('2026-12-02T18:00:00Z')).map(x => [x.key, x.title]), [['outlook:3:2026-12-09', 'Cold hazard in the two week outlook']]);
  /* a dated event keeps its own date; a grid watch keeps the day it was first seen */
  const area = { 'cpc_outlook.data.haz.metro': [{ win: 'd3_7', kind: 'precip', label: 'Freezing Rain', start: '2026-12-05', end: '2026-12-06', cold: true }] };
  same(note(area), [{ key: 'outlook:3:2026-12-05', title: 'Cold hazard in the two week outlook', message: 'Cold hazard, Dec 5 to 6: a Freezing Rain area is drawn over at least one of the 12 counties.', route: 'heat' }]);
  const G = 'ercot_grid.data.cond.', watch = n => ({ [G + 'state']: 'weather', [G + 'level']: 2, [G + 'name']: 'Weather Watch', [G + 'since']: '2026-11-30T15:00:00.000Z', [G + 'updated']: new Date(Date.parse('2026-12-01T11:00:05Z') + n * 864e5).toISOString() });
  same([note(watch(0))[0].key, note(watch(1), new Date('2026-12-02T18:00:00Z'))[0].key, note(watch(2), new Date('2026-12-03T18:00:00Z'))[0].key], ['outlook:2:2026-11-30', 'outlook:2:2026-11-30', 'outlook:2:2026-11-30']);
  /* tiers 0 and 1 send nothing; every notice is one sentence in plain words for the Heat Desk */
  same([note({}), note(below(0, 40)), note(below(50, 33))], [[], [], []]);
  for (const c of CASES.cases.filter(x => x.tier >= 2)) { const [n] = note(c.set); assert.match(n.key, /^outlook:[23]:\d{4}-\d\d-\d\d$/, c.name); assert.equal(n.key.split(':')[1], String(c.tier)); assert.equal(n.route, 'heat'); prose(n.title); prose(n.message); assert.ok(n.message.endsWith('.') && !/[.!?]\s/.test(n.message), 'one sentence: ' + n.message); }
});

test('the notice joins the ones the worker sends, and an older derive.js without the hook only loses the notice', () => {
  const L = fresh(), recs = made(below(0, 50));
  assert.equal(L.derive.more.length, 1); assert.equal(L.derive.more[0], L.derive.outlookNotice);
  same(plain(L.derive.notices(recs, NOW)).map(n => n.key), ['outlook:2:2026-12-08'], 'with no forecast record the cold notices are empty and this one still goes out'); same(plain(L.derive.notices(made({}), NOW)), []);
  /* after the cold watch's own notices, never instead of them */
  const nws = { v: 1, id: 'nws_cold', ok: true, at: NOW.toISOString(), data: { v: 2, points: [{ id: 'MESQ', name: 'Mesquite', lat: 32.8063, lon: -96.6609, county: 'Dallas', nights: [{ d: '2026-12-01', m: '2026-12-02', lowF: 28, appF: 22, wcF: 22, snowIn: 0, iceIn: 0, wx: [] }], days: [] }], alerts: [], failed: 0 } };
  const both = plain(L.derive.notices(Object.assign({ nws_cold: nws }, recs), NOW)); same(both.map(n => n.key), ['tier3:2026-12-01', 'outlook:2:2026-12-08']); assert.ok(both.every(n => n.route === 'heat' && n.title && n.message));
  /* an older live/derive.js: no L.derive.more */
  const ctx = context(); load(ctx, 'live/core.js', 'live/geo.js', 'live/derive.js'); delete ctx.TDA_LIVE.derive.more; assert.doesNotThrow(() => load(ctx, 'live/cpc_class.js', 'live/outlook.js'));
  assert.equal(ctx.TDA_LIVE.derive.outlook(recs, NOW).tier, 2); assert.equal(ctx.TDA_LIVE.derive.more, undefined); same(plain(ctx.TDA_LIVE.derive.outlookNotice(recs, NOW)).length, 1);
  /* and no derive.js at all (the file alone on the live layer): the reading still answers */
  const alone = load(context(), 'live/core.js', 'live/outlook.js').TDA_LIVE; same([alone.derive.outlook(recs, NOW).tier, alone.derive.outlook(null, NOW).ok, alone.derive.OUTLOOK_RULES.hardLowF], [2, false, 25]);
});
