import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { context, load, fakeFetch, same, ROOT } from './helpers/load.mjs';

const fx = n => JSON.parse(readFileSync(join(ROOT, 'tests', 'fixtures', 'nws', n), 'utf8'));
const GRID = fx('gridpoint-FWD-94-105-2026-11-13.json'), POINT = fx('points-denton.json'), ALERTS_TX = fx('alerts-active-tx-2026-11-13.json');
const fresh = () => load(context(), 'live/core.js', 'live/geo.js', 'live/sources/nws_cold.js', 'live/derive.js').TDA_LIVE;
const T0 = new Date('2026-11-13T18:00:00Z');                       // Friday midday in Dallas, 49 minutes after the grid was published
/* a Freeze Warning in the shape the Weather Service sends (fields as on the live objects recorded 2026-11-13), for the zones of Denton and Collin */
const alert = (event, ugc, over) => ({ id: 'urn:oid:synthetic.' + event, properties: Object.assign({ id: 'urn:oid:synthetic.' + event, event, messageType: 'Alert', severity: 'Severe', urgency: 'Expected', sent: '2026-11-16T13:57:00-06:00', onset: '2026-11-17T00:00:00-06:00', ends: '2026-11-17T09:00:00-06:00', expires: '2026-11-16T22:00:00-06:00', headline: event + ' issued November 16 at 1:57PM CST until November 17 at 9:00AM CST by NWS Fort Worth TX', description: '* WHAT...Sub-freezing temperatures as low as 29 expected.\n\n* WHERE...Portions of north central Texas.\n\n* WHEN...From midnight tonight to 9 AM CST Tuesday.', parameters: { VTEC: ['/O.NEW.KFWD.FZ.W.0003.261117T0600Z-261117T1500Z/'] }, geocode: { UGC: ugc } }, over || {}) });
const freezeWarning = over => ({ features: [alert('Freeze Warning', ['TXZ103', 'TXZ104'], over)] });
const routes = o => [[/\/points\//, POINT], [/\/gridpoints\/FWD\/\d+,\d+$/, o && o.grid ? o.grid : GRID], [/alerts\/active/, o && o.alerts ? o.alerts : { features: [] }]];
const runOnce = async (L, fetch, prev, now) => { const http = L.makeHttp({ fetch, gapMs: 0, backoffMs: 1, retries: 0 }); const data = await L.BY_ID.nws_cold.run({ http, now: now || T0, prev: prev || null, geo: L.geo, settings: {} }); return { data, http }; };

test('geo: twelve counties, twenty forecast points with baked cells, every county has a point', () => {
  const L = fresh();
  assert.equal(L.geo.counties.length, 12); assert.equal(L.geo.points.length, 20);
  assert.equal(new Set(L.geo.points.map(p => p.id)).size, 20); assert.equal(new Set(L.geo.points.map(p => p.gx + ',' + p.gy)).size, 20, 'no two points share a grid cell');
  for (const c of L.geo.counties) assert.ok(L.geo.points.some(p => p.county === c.name), 'a point in ' + c.name);
  for (const p of L.geo.points) { assert.ok(p.lat > 32 && p.lat < 33.7 && p.lon < -95.8 && p.lon > -98.3, p.id + ' inside the metro box'); assert.ok(Number.isInteger(p.gx) && Number.isInteger(p.gy), p.id + ' has a cell'); assert.ok(String(p.lat).replace(/^-?\d+\.?/, '').length <= 4 && String(p.lon).replace(/^-?\d+\.?/, '').length <= 4, p.id + ' at most four decimals'); }
  const n = L.geo.nearest(32.8063, -96.6609, L.geo.points, 3);
  assert.equal(n.length, 1); assert.equal(n[0].p.id, 'MESQ', 'the office sits on the Mesquite point');
  const m = L.geo.nearest(32.95, -96.75, L.geo.points, 3); assert.equal(m.length, 3); assert.ok(Math.abs(m.reduce((s, x) => s + x.w, 0) - 1) < 1e-9); assert.ok(m[0].km <= m[1].km && m[1].km <= m[2].km);
});

test('parseInterval reads the grid\'s start and duration', () => {
  const L = fresh(), p = L.nws.parseInterval;
  same(p('2026-11-14T01:00:00+00:00/PT14H'), { t0: Date.parse('2026-11-14T01:00:00Z'), t1: Date.parse('2026-11-14T15:00:00Z'), h: 14 });
  assert.equal(p('2026-11-13T11:00:00+00:00/P7DT14H').h, 182); assert.equal(p('2026-11-13T11:00:00+00:00/P1DT6H').h, 30); assert.equal(p('2026-11-13T11:00:00+00:00/PT30M').h, 0.5);
  assert.equal(p('nonsense'), null); assert.equal(p('2026-11-13T11:00:00+00:00/3 hours'), null); assert.equal(p(null), null);
  assert.equal(L.nws.c2f(6.666666666666667), 44); assert.equal(L.nws.c2f(-5), 23); assert.equal(L.nws.c2f(null), null);
});

test('gridNights: the official lows, the lowest apparent temperature and wind chill, the highs and the heating degree days', () => {
  const L = fresh(), r = L.nws.gridNights(GRID.properties, +T0);
  assert.equal(r.upd, '2026-11-13T17:11:27+00:00');
  same(r.nights.map(n => n.d), ['2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19'], 'keyed by the evening the night begins');
  same(r.nights.map(n => n.m), ['2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20'], 'and the morning the low happens');
  same(r.nights.map(n => n.lowF), [44, 46, 44, 46, 49, 56, 58]);
  same(r.nights.map(n => n.appF), [39, 40, 41, 46, 51, 58, 59]);
  same(r.nights.map(n => n.wcF), [39, 40, 41, 46, null, null, null]);
  assert.ok(r.nights.every(n => n.snowIn === 0 && n.iceIn === 0 && n.wx.length === 0 && !n.part));
  same(r.days.map(x => x.d), ['2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20']);
  same(r.days.map(x => x.hiF), [68, 65, 48, 53, 62, 66, 70, 73]);
  same(r.days.map(x => x.hdd), [null, 10, 18, 16, 11, 7, 2, 0], 'today has no morning low left, so no degree days');
});

test('gridNights at the 5 am pulse: the night in progress is yesterday\'s and is marked partial', () => {
  const L = fresh(), r = L.nws.gridNights(GRID.properties, Date.parse('2026-11-14T11:00:00Z'));          // 5 am Saturday in Dallas
  assert.equal(r.nights[0].d, '2026-11-13'); assert.equal(r.nights[0].m, '2026-11-14'); assert.equal(r.nights[0].lowF, 44);
  assert.equal(r.nights[1].d, '2026-11-14'); assert.equal(new Set(r.nights.map(n => n.d)).size, r.nights.length, 'no two nights share a key');
  assert.equal(r.days[0].d, '2026-11-14'); assert.equal(r.days[0].hdd, 10, 'this morning\'s low still counts toward today');
  const short = JSON.parse(JSON.stringify(GRID.properties)); short.minTemperature.values = [{ validTime: '2026-11-14T10:00:00+00:00/PT5H', value: 5 }].concat(short.minTemperature.values.slice(2));
  const s = L.nws.gridNights(short, Date.parse('2026-11-14T11:00:00Z')); assert.equal(s.nights[0].part, true, 'a remainder of under ten hours'); assert.equal(s.days[0].hdd, null, 'a partial night does not set a day\'s degree days');
});

test('gridNights reads snow, ice and wintry weather; a layer that stops early gives null, not zero', () => {
  const L = fresh(), P = JSON.parse(JSON.stringify(GRID.properties));
  P.minTemperature.values[1].value = -6.111111111111111;                                                        // 21°F on the night of the 13th
  P.snowfallAmount = { uom: 'wmoUnit:mm', values: [{ validTime: '2026-11-14T00:00:00+00:00/PT6H', value: 25.4 }, { validTime: '2026-11-14T06:00:00+00:00/PT6H', value: 12.7 }] };
  P.iceAccumulation = { uom: 'wmoUnit:mm', values: [{ validTime: '2026-11-14T06:00:00+00:00/PT6H', value: 6.35 }] };
  P.weather.values.push({ validTime: '2026-11-14T03:00:00+00:00/PT6H', value: [{ coverage: 'likely', weather: 'freezing_rain', intensity: 'light' }, { coverage: 'chance', weather: 'rain', intensity: 'light' }] });
  const r = L.nws.gridNights(P, +T0), n = r.nights[0];
  assert.equal(n.lowF, 21); assert.equal(n.snowIn, 1.3, 'five sixths of the first six hours and all of the second: 21.2 + 12.7 mm'); assert.equal(n.iceIn, 0.25); same(n.wx, ['freezing_rain']);
  assert.equal(r.nights[1].snowIn, null); assert.equal(r.nights[1].iceIn, null);
  same(L.nws.gridNights({}, +T0), { upd: null, nights: [], days: [] }); same(L.nws.gridNights(null, +T0).nights, []);
});

test('the collector reads every point from its baked grid cell: twenty one requests, no cookies', async () => {
  const L = fresh(); const fetch = fakeFetch(routes());
  const { data, http } = await runOnce(L, fetch);
  assert.equal(data.points.length, 20); assert.equal(data.failed, 0); assert.equal(http.stats.n, 21, 'one alerts request and twenty grids, no lookups');
  assert.ok(data.points.every(p => p.nights.length === 7 && p.days.length === 8 && p.upd === '2026-11-13T17:11:27+00:00' && !p.stale));
  assert.equal(data.points.find(p => p.id === 'KDTO').grid, 'FWD/75,123'); assert.equal(data.points.find(p => p.id === 'MESQ').county, 'Dallas');
  assert.ok(fetch.calls.some(c => c.url === 'https://api.weather.gov/gridpoints/FWD/94,105'));
  assert.ok(fetch.calls.every(c => c.init.credentials === 'omit' && c.init.cache === 'no-store' && c.init.headers.Accept === 'application/geo+json' && !('User-Agent' in c.init.headers)));
  const al = fetch.calls.find(c => /alerts\/active\?zone=/.test(c.url)).url; assert.ok(al.includes('TXZ119') && al.includes('TXC113') && al.split(',').length === 24);
  same(data.grids, {}); assert.equal(data.updated, '2026-11-13T17:11:27+00:00'); assert.equal(data.v, 2);
  same(L.BY_ID.nws_cold.digest(JSON.parse(JSON.stringify(data))), { minLow: 44, hdd7: 64, freezePoints: 0, coldAlerts: 0, alerts: 0 });
  assert.ok(JSON.stringify(data).length < 60000, 'the stored record stays small: ' + JSON.stringify(data).length);
});

test('a cell that went away is looked up once and remembered; a failed point keeps its last nights; total failure throws', async () => {
  const L = fresh();
  const moved = fakeFetch([[/\/points\//, POINT], [/gridpoints\/FWD\/75,123$/, { status: 404, body: '{"title":"Not Found"}' }], [/\/gridpoints\//, GRID], [/alerts/, { features: [] }]]);
  const first = await runOnce(L, moved);
  assert.equal(first.data.failed, 0); assert.equal(first.http.stats.n, 23, 'one 404, one lookup, one retry on the new cell');
  same(first.data.grids, { KDTO: { wfo: 'FWD', x: 77, y: 123, czone: 'TXC121' } }); assert.equal(first.data.points.find(p => p.id === 'KDTO').grid, 'FWD/77,123');
  const again = fakeFetch(routes()); const second = await runOnce(L, again, JSON.parse(JSON.stringify(first.data)));
  assert.equal(second.http.stats.n, 21); assert.ok(again.calls.some(c => /FWD\/77,123$/.test(c.url)), 'the remembered cell is used');
  /* Love Field's cell answers 500 every time: the collector retries it twice, then moves on */
  const flaky = () => fakeFetch([[/gridpoints\/FWD\/87,107$/, { status: 500, body: '{"title":"Unexpected Problem"}' }], [/\/gridpoints\//, GRID], [/alerts/, { features: [] }]]);
  const cold = await runOnce(L, flaky());
  assert.equal(cold.data.failed, 1); assert.equal(cold.http.stats.n, 23, 'three tries on the failing cell'); const bad = cold.data.points.find(p => p.err); assert.equal(bad.id, 'KDAL'); assert.match(bad.err, /500/); assert.equal(bad.nights.length, 0, 'nothing to fall back on in a first run');
  const warm = await runOnce(L, flaky(), JSON.parse(JSON.stringify(second.data)));
  const kept = warm.data.points.find(p => p.err); assert.equal(kept.stale, true); assert.equal(kept.nights.length, 7, 'the last good nights are kept and marked'); assert.equal(warm.data.points.filter(p => !p.err).length, 19);
  same(L.BY_ID.nws_cold.digest(JSON.parse(JSON.stringify(warm.data))).minLow, 44, 'a stale point still counts toward the digest');
  await assert.rejects(() => runOnce(L, fakeFetch([[/./, { status: 503, body: 'down' }]])), /503/);
  await assert.rejects(() => runOnce(L, fakeFetch([[/alerts/, { features: [] }], [/./, { properties: {} }]])), /minimum temperature/);
  const noAlerts = await runOnce(L, fakeFetch([[/\/gridpoints\//, GRID], [/alerts/, { status: 500, body: 'x' }]]), { alerts: [{ event: 'Freeze Warning', cold: true, counties: ['Dallas'] }], alertsAt: '2026-11-13T16:00:00Z', points: [] });
  assert.equal(noAlerts.data.points.length, 20); assert.match(noAlerts.data.alertsErr, /500/); assert.equal(noAlerts.data.alerts.length, 1, 'alerts from two hours ago are kept when the alerts call fails'); assert.equal(noAlerts.data.alertsAt, '2026-11-13T16:00:00Z');
  const oldAlerts = await runOnce(L, fakeFetch([[/\/gridpoints\//, GRID], [/alerts/, { status: 500, body: 'x' }]]), { alerts: [{ event: 'Freeze Warning', cold: true, counties: ['Dallas'] }], alertsAt: '2026-11-12T16:00:00Z', points: [] });
  same(oldAlerts.data.alerts, [], 'but not alerts from yesterday');
});

test('alerts keep only the 12 counties, read the hazard window, the code and the WHAT line, and rank the cold ones', () => {
  const L = fresh();
  same(L.nws.parseAlerts(ALERTS_TX, L.geo.byZone), [], 'a flood warning in McMullen County is not ours');
  const a = L.nws.parseAlerts(freezeWarning(), L.geo.byZone);
  assert.equal(a.length, 1); same(a[0].counties, ['Denton', 'Collin']);
  same({ event: a[0].event, cold: a[0].cold, tier: a[0].tier, emergency: a[0].emergency, code: a[0].code, action: a[0].action, onset: a[0].onset, ends: a[0].ends, what: a[0].what }, { event: 'Freeze Warning', cold: true, tier: 3, emergency: false, code: 'FZ.W', action: 'NEW', onset: '2026-11-17T00:00:00-06:00', ends: '2026-11-17T09:00:00-06:00', what: 'Sub-freezing temperatures as low as 29 expected.' });
  same(L.nws.parseAlerts(freezeWarning({ ends: null }), L.geo.byZone)[0].ends, '2026-11-16T22:00:00-06:00', 'expires only when the hazard end is missing');
  same(L.nws.parseAlerts(freezeWarning({ messageType: 'Cancel' }), L.geo.byZone), [], 'a cancellation is not an alert');
  const tiers = { 'Frost Advisory': 2, 'Freeze Watch': 3, 'Freeze Warning': 3, 'Freezing Fog Advisory': 3, 'Winter Weather Advisory': 3, 'Cold Weather Advisory': 4, 'Extreme Cold Watch': 4, 'Extreme Cold Warning': 4, 'Winter Storm Watch': 4, 'Winter Storm Warning': 4, 'Ice Storm Warning': 4, 'Blizzard Warning': 4, 'Wind Chill Advisory': 4, 'Hard Freeze Warning': 4, 'Snow Squall Warning': 3 };
  for (const [ev, t] of Object.entries(tiers)) { assert.ok(L.COLD_EVENT.test(ev), ev); assert.equal(L.nws.alertTier(ev), t, ev); }
  for (const ev of ['Extreme Cold Warning', 'Winter Storm Watch', 'Ice Storm Warning', 'Blizzard Warning']) assert.equal(L.nws.parseAlerts({ features: [alert(ev, ['TXZ119'])] }, L.geo.byZone)[0].emergency, true, ev);
  for (const ev of ['Flood Warning', 'Heat Advisory', 'Extreme Heat Warning', 'Severe Thunderstorm Warning', 'Air Quality Alert', 'Red Flag Warning', 'Tornado Watch']) { assert.ok(!L.COLD_EVENT.test(ev), ev); assert.equal(L.nws.alertTier(ev), 0); }
});

/* ---------- the cold picture ---------- */
const NOW = new Date('2026-11-13T18:00:00Z');
const DATES = ['2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19'];
const nextDay = d => new Date(Date.parse(d + 'T12:00:00Z') + 864e5).toISOString().slice(0, 10);
/* a record where every point has the same lows and highs, except overrides by point id; highs default to 20 above the low */
function record(L, lows, over, extra, highs) {
  const points = L.geo.points.map(p => { const lo = (over && over[p.id]) || lows; return { id: p.id, name: p.name, county: p.county, lat: p.lat, lon: p.lon, nights: lo.map((f, i) => ({ d: DATES[i], m: nextDay(DATES[i]), lowF: f, appF: f - 4, wcF: null, snowIn: 0, iceIn: 0, wx: [] })), days: lo.map((f, i) => { const hi = highs ? highs[i] : f + 20; return { d: nextDay(DATES[i]), hiF: hi, hdd: Math.max(0, 65 - Math.floor((hi + f) / 2 + 0.5)) }; }) }; });
  return { nws_cold: { id: 'nws_cold', ok: true, at: '2026-11-13T17:30:00Z', data: Object.assign({ v: 2, updated: '2026-11-13T17:11:27+00:00', points, alerts: [] }, extra || {}) } };
}

test('normal heating degree days by calendar day follow the DFW monthly normals', () => {
  const L = fresh(), n = L.derive.normHdd, week = d0 => { let s = 0, d = d0; for (let i = 0; i < 7; i++) { s += n(d); d = nextDay(d); } return s; };
  assert.ok(Math.abs(week('2026-11-06') - 54) <= 3, 'the Weather Service printed 54 for November 6 to 12; got ' + week('2026-11-06').toFixed(1));
  assert.ok(n('2026-01-15') > 18 && n('2026-01-15') < 19.5); assert.ok(n('2026-07-15') < 0.01); assert.ok(n('2026-12-31') > n('2026-12-01')); assert.ok(n('2026-03-31') < n('2026-03-01'));
  let year = 0, d = '2026-01-01'; for (let i = 0; i < 365; i++) { year += n(d); d = nextDay(d); } assert.ok(Math.abs(year - 2220) < 40, 'a year adds up to the annual normal: ' + year.toFixed(0));
});

test('cold picture: a mild week', () => {
  const L = fresh(); const c = L.derive.cold(record(L, [58, 60, 57, 55, 56, 59, 61]), NOW);
  assert.equal(c.ok, true); assert.equal(c.tier, 0); assert.equal(c.active, false); assert.equal(c.nights.length, 7); assert.equal(c.days.length, 7); assert.equal(Object.keys(c.byCounty).length, 12);
  assert.match(c.headline, /mild week: no night below 55°F/); assert.equal(c.notice, null); assert.equal(c.heatOn, false); assert.equal(c.emergency, false);
  same(L.derive.badge(c).text, ''); assert.equal(c.season, null, 'no climate record, no season');
});

test('cold picture: cool, cold, freeze on the edges, metro freeze, hard freeze', () => {
  const L = fresh();
  let c = L.derive.cold(record(L, [52, 48, 47, 51, 55, 56, 58]), NOW);
  assert.equal(c.tier, 1); assert.equal(c.active, false); assert.match(c.headline, /Cool nights, no cold trigger: lows bottom out at 47°F Sunday night/); assert.equal(L.derive.badge(c).text, '');
  c = L.derive.cold(record(L, [50, 47, 44, 46, 49, 56, 58], { KDTO: [44, 46, 38, 46, 49, 56, 58] }), NOW);
  assert.equal(c.tier, 2); assert.equal(c.active, true); assert.match(c.headline, /Cold nights ahead: 38°F Sunday night at Denton; 44°F in Dallas County/);
  same([c.byCounty.Denton.n40, c.byCounty.Denton.edge40, c.byCounty.Denton.typF, c.byCounty.Denton.minF, c.byCounty.Dallas.n40], [0, 1, 41, 38, 0], 'Denton has two points: most of the county 41, the edge 38');
  assert.match(c.sub, /^1 of 12 counties reach 40°F or lower \(Sunday night\); no freeze in the forecast\./);
  assert.equal(c.notice, null, 'a cold night alone does not notify'); same(L.derive.badge(c), { text: '38°', color: '#3e7fcf', title: L.derive.badge(c).title });
  c = L.derive.cold(record(L, [50, 47, 36, 46, 49, 56, 58], { KDTO: [44, 46, 31, 46, 49, 56, 58], KLUD: [44, 46, 30, 46, 49, 56, 58] }), NOW);
  assert.equal(c.tier, 3); assert.equal(c.medTier, 2); assert.match(c.headline, /Freeze on the edges Sunday night: 30°F at Decatur; 36°F in Dallas County/); assert.match(c.sub, /2 of 12 counties/);
  same([c.byCounty.Wise.tier, c.byCounty.Wise.n32, c.byCounty.Denton.tier, c.byCounty.Denton.n32, c.byCounty.Denton.edge32, c.byCounty.Dallas.tier], [3, 1, 2, 0, 1, 2]);
  assert.equal(c.notice.key, 'tier3:2026-11-15'); assert.equal(L.derive.badge(c).color, '#1c5cab'); assert.ok(c.actions.some(a => /Denton|Wise/.test(a)));
  c = L.derive.cold(record(L, [50, 47, 29, 31, 49, 56, 58]), NOW);
  assert.equal(c.tier, 3); assert.equal(c.medTier, 3); assert.match(c.headline, /Freeze across the metro Sunday night: lows 29°F/); assert.match(c.sub, /12 of 12 counties.*Sunday night and Monday night/);
  c = L.derive.cold(record(L, [50, 47, 29, 22, 19, 30, 40], { KDAL: [50, 47, 31, 26, 24, 33, 42], MESQ: [50, 47, 31, 26, 24, 33, 42], KRBD: [50, 47, 31, 26, 24, 33, 42], KADS: [50, 47, 31, 26, 24, 33, 42] }), NOW);
  assert.equal(c.tier, 4); assert.match(c.headline, /Hard freeze Tuesday night: 19°F at /); assert.equal(c.byCounty.Dallas.n25, 1); assert.equal(c.byCounty.Dallas.tier, 4); assert.equal(c.notice.key, 'tier4:2026-11-15'); assert.equal(L.derive.badge(c).text, '19°'); assert.equal(L.derive.badge(c).color, '#6d28d9');
  assert.equal(c.emergency, false); c = L.derive.cold(record(L, [50, 47, 29, 12, 9, 30, 40]), NOW); assert.equal(c.emergency, true, '15°F or lower is an emergency'); assert.match(c.actions[0], /uncapped/);
});

test('cold picture: the heating load, the first heating week and the first freeze of the season', () => {
  const L = fresh(); const rec = record(L, [44, 46, 44, 46, 49, 56, 58], null, null, [65, 48, 53, 62, 66, 70, 73]);     // this week as the Mesquite grid had it
  let c = L.derive.cold(rec, NOW);
  same(c.days.map(x => x.hdd), [10, 18, 16, 11, 7, 2, 0]); assert.equal(c.hdd7, 64); assert.ok(c.hddNorm7 >= 60 && c.hddNorm7 <= 72, 'normal for November 14 to 20: ' + c.hddNorm7); assert.ok(c.loadPct >= 88 && c.loadPct <= 108);
  same({ d: c.hddPeak.d, hdd: c.hddPeak.hdd }, { d: '2026-11-15', hdd: 18 }); assert.equal(c.heatOn, true); assert.equal(c.firstHeatingWeek, false, 'unknown without the season');
  assert.match(c.headline, /^Heat on all day Sunday: highs near 48°F, lows to 44°F$/); assert.match(c.sub, /^64 heating degree days in the next seven days, about the normal \d+ for these dates\. No night reaches 40°F\.$/); assert.equal(c.active, true);
  c = L.derive.cold(rec, NOW, { season: { hdd: 29, norm: 157, firstFreeze: null, through: '2026-11-12' } });
  assert.equal(c.firstHeatingWeek, true); assert.match(c.headline, /^The first heating week of the season: 64 heating degree days ahead, against 29 since July$/);
  assert.match(c.sub, /^Sunday is the heaviest day \(highs near 48°F\); lows bottom out at 44°F tonight\. No freeze in the forecast\./); assert.match(c.actions[0], /^Open the heating repair campaigns now and lift bids from Sunday morning/);
  same(c.notice.key, 'firstheat:2026'); assert.match(c.notice.message, /^64 heating degree days in the next seven days against 29 since July\. Sunday is the heaviest day/);
  same(L.derive.notices(rec, NOW, { season: { hdd: 29, norm: 157, firstFreeze: null, through: '2026-11-12' } }).map(n => [n.key, n.route]), [['firstheat:2026', 'heat']]);
  assert.equal(L.derive.cold(rec, NOW, { season: { hdd: 400, norm: 380, firstFreeze: '2026-11-02' } }).firstHeatingWeek, false, 'not in a season already under way');
  c = L.derive.cold(record(L, [50, 47, 36, 31, 49, 56, 58]), NOW, { season: { hdd: 29, norm: 157, firstFreeze: null } });
  same(c.firstFreezeAhead, { d: '2026-11-16', name: 'Monday night', at: 'Mesquite', f: 31 }); assert.match(c.sub, /It would be the first freeze of the season\.$/);
  assert.equal(L.derive.cold(record(L, [50, 47, 36, 31, 49, 56, 58]), NOW, { season: { hdd: 300, norm: 157, firstFreeze: '2026-11-05' } }).firstFreezeAhead, null);
});

test('cold picture: an alert leads, the worst alert first, expired alerts and past nights drop out, a stale forecast says so', () => {
  const L = fresh();
  const al = L.nws.parseAlerts(freezeWarning(), L.geo.byZone);
  let c = L.derive.cold(record(L, [50, 47, 36, 34, 49, 56, 58], { KDTO: [44, 46, 33, 31, 49, 56, 58] }, { alerts: JSON.parse(JSON.stringify(al)) }), NOW);
  assert.match(c.headline, /^Freeze Warning for Denton and Collin counties$/); assert.equal(c.active, true); assert.match(c.notice.key, /^alert:Freeze Warning:2026-11-17:Denton,Collin$/);
  same([c.byCounty.Denton.alertTier, c.byCounty.Denton.tier, c.byCounty.Collin.tier, c.byCounty.Dallas.alertTier, c.byCounty.Collin.alerts], [3, 3, 3, 0, ['Freeze Warning']], 'the warning lifts its counties to the freeze tier');
  const two = L.nws.parseAlerts({ features: [alert('Frost Advisory', ['TXZ119']), alert('Winter Storm Warning', L.geo.counties.map(x => x.zone))] }, L.geo.byZone);
  c = L.derive.cold(record(L, [50, 47, 36, 34, 49, 56, 58], null, { alerts: JSON.parse(JSON.stringify(two)) }), NOW);
  assert.match(c.headline, /^Winter Storm Warning for all 12 counties$/); assert.equal(c.emergency, true); assert.equal(c.byCounty.Hood.tier, 4);
  const six = L.nws.parseAlerts({ features: [alert('Cold Weather Advisory', ['TXZ102', 'TXZ103', 'TXZ104', 'TXZ105', 'TXZ117', 'TXZ118'])] }, L.geo.byZone);
  assert.match(L.derive.cold(record(L, [50, 47, 36, 34, 49, 56, 58], null, { alerts: JSON.parse(JSON.stringify(six)) }), NOW).headline, /^Cold Weather Advisory for Wise, Denton, Collin, Hunt and 2 more counties$/);
  assert.match(L.derive.cold(record(L, [50, 47, 36, 34, 49, 56, 58], null, { alerts: JSON.parse(JSON.stringify(L.nws.parseAlerts({ features: [alert('Frost Advisory', ['TXZ119'])] }, L.geo.byZone))) }), NOW).headline, /^Frost Advisory for Dallas County$/);
  c = L.derive.cold(record(L, [50, 47, 44, 46, 49, 56, 58], null, { alerts: JSON.parse(JSON.stringify(al)) }), new Date('2026-11-18T18:00:00Z'));
  assert.equal(c.coldAlerts.length, 0, 'the warning ended'); same(c.nights.map(n => n.d), ['2026-11-18', '2026-11-19'], 'only the nights still ahead');
  assert.equal(c.stale, true); assert.match(c.eyebrow, /Forecast from Friday Nov 13/); same(L.derive.badge(c).text, '', 'no badge from a stale forecast'); assert.equal(c.hdd7, null, 'too few days left for a week of load');
  const gone = L.derive.cold(record(L, [50, 47, 44, 46, 49, 56, 58]), new Date('2026-12-01T18:00:00Z'));
  assert.equal(gone.ok, false); assert.match(gone.headline, /run out/);
  assert.equal(L.derive.cold({}, NOW).ok, false); assert.equal(L.derive.cold(null, NOW).headline, '');
});

test('thresholds can be moved', () => {
  const L = fresh(); const c = L.derive.cold(record(L, [50, 47, 44, 46, 49, 56, 58]), NOW, { th: { cold: 45 } });
  assert.equal(c.tier, 2); assert.equal(L.derive.tierOf(32), 3); assert.equal(L.derive.tierOf(33), 2); assert.equal(L.derive.tierOf(25), 4); assert.equal(L.derive.tierOf(51), 0); assert.equal(L.derive.tierOf(null), 0);
  assert.equal(L.derive.localDay(new Date('2026-11-14T03:30:00Z')), '2026-11-13', 'evening in Dallas is still the 13th');
});

test('notices: one per new alert product the shop acts on, plus the freeze without an alert', () => {
  const L = fresh();
  const mk = (event, ugc, onset) => alert(event, ugc, { id: event + onset, onset, ends: '2026-11-20T09:00:00-06:00' });
  const al = L.nws.parseAlerts({ features: [mk('Freeze Warning', ['TXZ103'], '2026-11-17T00:00:00-06:00'), mk('Freeze Warning', ['TXZ104'], '2026-11-17T01:00:00-06:00'), mk('Air Quality Alert', ['TXC113', 'TXC439'], '2026-11-14T10:00:00-06:00'), mk('Flood Watch', ['TXC113'], '2026-11-14T10:00:00-06:00'), mk('Severe Thunderstorm Watch', L.geo.counties.map(c => c.czone), '2026-11-14T15:00:00-06:00')] }, L.geo.byZone);
  const n = L.derive.notices(record(L, [50, 47, 36, 31, 49, 56, 58], null, { alerts: JSON.parse(JSON.stringify(al)) }), NOW);
  same(n.map(x => x.key), ['alert:Freeze Warning:2026-11-17', 'alert:Air Quality Alert:2026-11-14', 'alert:Severe Thunderstorm Watch:2026-11-14']);
  assert.match(n[0].message, /^Denton and Collin\. Coldest forecast low 31°F Monday night/); assert.equal(n[0].route, 'heat'); assert.equal(n[1].route, 'weather'); assert.match(n[2].message, /^All 12 counties/);
  const quietFreeze = L.derive.notices(record(L, [50, 47, 36, 31, 49, 56, 58]), NOW);
  same(quietFreeze.map(x => [x.key, x.route]), [['tier3:2026-11-16', 'heat']]);
  same(L.derive.notices(record(L, [50, 47, 44, 46, 49, 56, 58]), NOW), []);
  same(L.derive.notices(record(L, [50, 47, 30, 46, 49, 56, 58]), new Date('2026-11-15T23:00:00Z'), {}).length, 0, 'a forecast more than a day and a half old stays quiet');
});

test('place: the forecast at a ZIP centroid is the inverse distance mean of the three nearest points', () => {
  const L = fresh();
  const c = L.derive.cold(record(L, [50, 47, 44, 46, 49, 56, 58], { KDTO: [44, 46, 30, 46, 49, 56, 58], LEWV: [48, 47, 38, 46, 49, 56, 58] }), NOW);
  const office = L.derive.place(c, 32.8063, -96.6609);
  assert.equal(office.from.length, 1); assert.equal(office.from[0].id, 'MESQ'); assert.equal(office.minF, 44); assert.equal(office.tier, 1); assert.equal(office.nights.length, 7);
  const denton = L.derive.place(c, 33.2051, -97.2006); assert.equal(denton.minF, 30); assert.equal(denton.tier, 3); assert.equal(denton.n32, 1); assert.equal(denton.minName, 'Sunday night');
  const between = L.derive.place(c, 33.12, -97.10);                                              // between Denton and Lewisville
  assert.equal(between.from.length, 3); assert.ok(between.minF > 30 && between.minF < 44, 'a blend: ' + between.minF); assert.ok(Math.abs(between.from.reduce((s, x) => s + x.w, 0) - 1) < 0.02);
  assert.ok(between.hdd7 > 0 && between.hddPeak.d === '2026-11-16');
  assert.equal(L.derive.place(null, 32.8, -96.6), null); assert.equal(L.derive.place(c, null, null), null); assert.equal(L.derive.place(L.derive.cold({}, NOW), 32.8, -96.6), null);
});
