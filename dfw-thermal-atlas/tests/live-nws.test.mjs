import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { context, load, fakeFetch, same, ROOT } from './helpers/load.mjs';

const fx = n => JSON.parse(readFileSync(join(ROOT, 'tests', 'fixtures', 'nws', n), 'utf8'));
const FORECAST = fx('forecast-denton-2026-11-13.json'), POINT = fx('points-denton.json'), ALERTS_TX = fx('alerts-active-tx-2026-11-13.json');
const fresh = () => load(context(), 'live/core.js', 'live/geo.js', 'live/sources/nws_cold.js', 'live/derive.js').TDA_LIVE;
/* a Freeze Warning in the shape the Weather Service sends, for the zones of Denton and Collin */
const freezeWarning = (over) => ({ features: [{ id: 'urn:oid:synthetic.1', properties: Object.assign({ id: 'urn:oid:synthetic.1', event: 'Freeze Warning', severity: 'Moderate', urgency: 'Expected', onset: '2026-11-17T00:00:00-06:00', ends: '2026-11-17T09:00:00-06:00', headline: 'Freeze Warning issued November 16 at 1:57PM CST until November 17 at 9:00AM CST by NWS Fort Worth TX', areaDesc: 'Denton; Collin', geocode: { UGC: ['TXZ103', 'TXZ104'], SAME: ['048121', '048085'] } }, over || {}) }] });
const routes = (o) => [
  [/\/points\//, o && o.point ? o.point : POINT],
  [/\/forecast$/, o && o.forecast ? o.forecast : FORECAST],
  [/alerts\/active/, o && o.alerts ? o.alerts : { features: [] }],
];
const runOnce = async (L, fetch, prev) => { const http = L.makeHttp({ fetch, gapMs: 0, backoffMs: 1, retries: 0 }); const data = await L.BY_ID.nws_cold.run({ http, now: new Date('2026-11-13T18:00:00Z'), prev: prev || null, geo: L.geo, settings: {} }); return { data, http }; };

test('geo: twelve counties, nineteen forecast points, every county has a point', () => {
  const L = fresh();
  assert.equal(L.geo.counties.length, 12); assert.equal(L.geo.points.length, 19);
  assert.equal(new Set(L.geo.points.map(p => p.id)).size, 19);
  for (const c of L.geo.counties) assert.ok(L.geo.points.some(p => p.county === c.name), 'a point in ' + c.name);
  for (const p of L.geo.points) assert.ok(p.lat > 32 && p.lat < 33.7 && p.lon < -95.8 && p.lon > -98.3, p.id + ' inside the metro box');
  const n = L.geo.nearest(32.8063, -96.6609, L.geo.points, 3);
  assert.equal(n[0].p.id, 'KHQZ', 'Mesquite is the nearest point to the office'); assert.ok(Math.abs(n.reduce((s, x) => s + x.w, 0) - 1) < 1e-9);
  assert.equal(L.geo.nearest(32.747, -96.530, L.geo.points, 3).length, 1, 'on top of a point: that point alone');
});

test('parseForecast turns the 12 hour periods into nights and days keyed by local date', () => {
  const L = fresh(); const r = L.nws.parseForecast(FORECAST);
  assert.equal(r.nights.length, 7); assert.equal(r.days.length, 7);
  same(r.nights[0], { d: '2026-11-13', name: 'Tonight', lowF: 44, wx: 'Mostly Clear', pop: 0 });
  same(r.nights.map(n => n.lowF), [44, 46, 44, 46, 49, 56, 58]);
  same(r.days[0], { d: '2026-11-13', hiF: 66 });
  assert.equal(r.updated, '2026-11-13T17:11:27+00:00');
  same(L.nws.parseForecast({ properties: { periods: [{ isDaytime: false, startTime: '2026-01-10T18:00:00-06:00', name: 'Tonight', temperature: -5, temperatureUnit: 'C' }] } }).nights[0].lowF, 23);
});

test('the collector reads every point, resolves each grid once and keeps it', async () => {
  const L = fresh(); const fetch = fakeFetch(routes());
  const { data, http } = await runOnce(L, fetch);
  assert.equal(data.points.length, 19); assert.equal(data.failed, 0); assert.equal(http.stats.n, 39, '19 lookups, 19 forecasts, 1 alerts');
  assert.ok(data.points.every(p => p.nights.length === 7 && p.grid === 'FWD/77,123'));
  assert.equal(data.points.find(p => p.id === 'KHQZ').county, 'Denton', 'the county comes from the lookup (the fixture answers Denton for every point)');
  assert.ok(fetch.calls.every(c => c.init.credentials === 'omit' && c.init.cache === 'no-store'), 'no cookies, no cache');
  assert.ok(fetch.calls.find(c => /alerts\/active\?zone=/.test(c.url)).url.includes('TXZ119') && fetch.calls.find(c => /alerts\/active/.test(c.url)).url.includes('TXC113'));
  const fetch2 = fakeFetch(routes()); const second = await runOnce(L, fetch2, JSON.parse(JSON.stringify(data)));
  assert.equal(second.http.stats.n, 20, 'the second run skips the lookups'); assert.equal(second.data.gridsAt, data.gridsAt);
  same(L.BY_ID.nws_cold.digest(JSON.parse(JSON.stringify(data))), { minLow: 44, freezePoints: 0, coldAlerts: 0, alerts: 0 });
});

test('one bad point does not sink the run; a moved grid is looked up again; total failure throws', async () => {
  const L = fresh(); let n = 0;
  const flaky = fakeFetch([[/\/points\//, POINT], [/\/forecast$/, () => (++n === 3 ? { status: 404, body: '{"title":"Not Found"}' } : FORECAST)], [/alerts/, { features: [] }]]);
  const { data } = await runOnce(L, flaky);
  assert.equal(data.failed, 1); const bad = data.points.find(p => p.err); assert.match(bad.err, /404/); assert.equal(data.grids[bad.id], undefined, 'the stale grid is dropped');
  assert.equal(data.points.filter(p => p.nights.length === 7).length, 18);
  await assert.rejects(() => runOnce(L, fakeFetch([[/./, { status: 503, body: 'down' }]])), /503/);
  const noAlerts = await runOnce(L, fakeFetch([[/\/points\//, POINT], [/\/forecast$/, FORECAST], [/alerts/, { status: 500, body: 'x' }]]));
  assert.equal(noAlerts.data.points.length, 19); assert.match(noAlerts.data.alertsErr, /500/); same(noAlerts.data.alerts, []);
});

test('alerts keep only the 12 counties and flag the cold ones', () => {
  const L = fresh();
  same(L.nws.parseAlerts(ALERTS_TX, L.geo.byZone), [], 'a flood warning in McMullen County is not ours');
  const a = L.nws.parseAlerts(freezeWarning(), L.geo.byZone);
  assert.equal(a.length, 1); same(a[0].counties, ['Denton', 'Collin']); assert.equal(a[0].cold, true); assert.equal(a[0].event, 'Freeze Warning');
  for (const ev of ['Freeze Watch', 'Frost Advisory', 'Cold Weather Advisory', 'Extreme Cold Warning', 'Extreme Cold Watch', 'Winter Storm Warning', 'Winter Storm Watch', 'Winter Weather Advisory', 'Ice Storm Warning', 'Wind Chill Advisory', 'Blizzard Warning']) assert.ok(L.COLD_EVENT.test(ev), ev);
  for (const ev of ['Flood Warning', 'Heat Advisory', 'Severe Thunderstorm Warning', 'Air Quality Alert', 'Red Flag Warning', 'Tornado Watch']) assert.ok(!L.COLD_EVENT.test(ev), ev);
});

/* ---------- the cold picture ---------- */
const NOW = new Date('2026-11-13T18:00:00Z');                       // Friday midday in Dallas
const DATES = ['2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19'];
/* a record where every point has the same lows, except overrides by point id */
function record(L, lows, over, extra) {
  const points = L.geo.points.map(p => ({ id: p.id, name: p.name, county: p.county, lat: p.lat, lon: p.lon, nights: ((over && over[p.id]) || lows).map((f, i) => ({ d: DATES[i], name: 'x', lowF: f })), days: [] }));
  return { nws_cold: Object.assign({ id: 'nws_cold', ok: true, at: '2026-11-13T17:30:00Z', data: Object.assign({ updated: '2026-11-13T17:11:27+00:00', points, alerts: [] }, extra || {}) }) };
}

test('cold picture: a mild week', () => {
  const L = fresh(); const c = L.derive.cold(record(L, [58, 60, 57, 55, 56, 59, 61]), NOW);
  assert.equal(c.ok, true); assert.equal(c.tier, 0); assert.equal(c.active, false); assert.equal(c.nights.length, 7); assert.equal(Object.keys(c.byCounty).length, 12);
  assert.match(c.headline, /mild week: no night below 55°F/); assert.equal(c.notice, null);
  same(L.derive.badge(c).text, '');
});

test('cold picture: cool, cold, freeze on the edges, metro freeze, hard freeze', () => {
  const L = fresh();
  let c = L.derive.cold(record(L, [52, 48, 47, 51, 55, 56, 58]), NOW);
  assert.equal(c.tier, 1); assert.equal(c.active, false); assert.match(c.headline, /Cool nights, no cold trigger: lows bottom out at 47°F Sunday night/); assert.equal(L.derive.badge(c).text, '');
  c = L.derive.cold(record(L, [50, 47, 44, 46, 49, 56, 58], { KDTO: [44, 46, 38, 46, 49, 56, 58] }), NOW);
  assert.equal(c.tier, 2); assert.equal(c.active, true); assert.match(c.headline, /Cold nights ahead: 38°F Sunday night at Denton; 44°F in Dallas County/); assert.equal(c.byCounty.Denton.n40, 1); assert.equal(c.byCounty.Dallas.n40, 0);
  assert.equal(c.notice, null, 'a cold night alone does not notify'); same(L.derive.badge(c), { text: '38°', color: '#3e7fcf', title: L.derive.badge(c).title });
  c = L.derive.cold(record(L, [50, 47, 36, 46, 49, 56, 58], { KDTO: [44, 46, 31, 46, 49, 56, 58], DECA: [44, 46, 30, 46, 49, 56, 58] }), NOW);
  assert.equal(c.tier, 3); assert.equal(c.medTier, 2); assert.match(c.headline, /Freeze on the edges Sunday night: 30°F at Decatur; 36°F in Dallas County/); assert.match(c.sub, /2 of 12 counties/);
  assert.equal(c.notice.key, 'tier3:2026-11-15'); assert.equal(L.derive.badge(c).color, '#1c5cab'); assert.ok(c.actions.some(a => /Denton|Wise/.test(a)));
  c = L.derive.cold(record(L, [50, 47, 29, 31, 49, 56, 58]), NOW);
  assert.equal(c.tier, 3); assert.equal(c.medTier, 3); assert.match(c.headline, /Freeze across the metro Sunday night: lows 29°F/); assert.match(c.sub, /12 of 12 counties.*Sunday night and Monday night/);
  c = L.derive.cold(record(L, [50, 47, 29, 22, 19, 30, 40], { KDAL: [50, 47, 31, 26, 24, 33, 42] }), NOW);
  assert.equal(c.tier, 4); assert.match(c.headline, /Hard freeze Tuesday night: 19°F at /); assert.equal(c.byCounty.Dallas.n25, 2); assert.equal(c.notice.key, 'tier4:2026-11-15'); assert.equal(L.derive.badge(c).text, '19°'); assert.equal(L.derive.badge(c).color, '#6d28d9');
});

test('cold picture: an alert leads, expired alerts and past nights drop out, a stale forecast says so', () => {
  const L = fresh();
  const al = L.nws.parseAlerts(freezeWarning(), L.geo.byZone);
  let c = L.derive.cold(record(L, [50, 47, 36, 34, 49, 56, 58], { KDTO: [44, 46, 33, 31, 49, 56, 58] }, { alerts: JSON.parse(JSON.stringify(al)) }), NOW);
  assert.match(c.headline, /^Freeze Warning for Denton and Collin counties$/); assert.equal(c.active, true); assert.match(c.notice.key, /^alert:Freeze Warning:2026-11-17:Denton,Collin$/);
  c = L.derive.cold(record(L, [50, 47, 44, 46, 49, 56, 58], null, { alerts: JSON.parse(JSON.stringify(al)) }), new Date('2026-11-18T18:00:00Z'));
  assert.equal(c.coldAlerts.length, 0, 'the warning ended'); same(c.nights.map(n => n.d), ['2026-11-18', '2026-11-19'], 'only the nights still ahead');
  assert.equal(c.stale, true); assert.match(c.eyebrow, /Forecast from Friday Nov 13/); same(L.derive.badge(c).text, '', 'no badge from a stale forecast');
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
  const mk = (event, ugc, onset) => ({ id: event + onset, properties: { id: event + onset, event, onset, ends: '2026-11-20T09:00:00-06:00', headline: event, geocode: { UGC: ugc } } });
  const al = L.nws.parseAlerts({ features: [mk('Freeze Warning', ['TXZ103'], '2026-11-17T00:00:00-06:00'), mk('Freeze Warning', ['TXZ104'], '2026-11-17T01:00:00-06:00'), mk('Air Quality Alert', ['TXC113', 'TXC439'], '2026-11-14T10:00:00-06:00'), mk('Flood Watch', ['TXC113'], '2026-11-14T10:00:00-06:00'), mk('Severe Thunderstorm Watch', L.geo.counties.map(c => c.czone), '2026-11-14T15:00:00-06:00')] }, L.geo.byZone);
  const n = L.derive.notices(record(L, [50, 47, 36, 31, 49, 56, 58], null, { alerts: JSON.parse(JSON.stringify(al)) }), NOW);
  same(n.map(x => x.key), ['alert:Freeze Warning:2026-11-17', 'alert:Air Quality Alert:2026-11-14', 'alert:Severe Thunderstorm Watch:2026-11-14']);
  assert.match(n[0].message, /^Denton and Collin\. Coldest forecast low 31°F Monday night/); assert.equal(n[0].route, 'heat'); assert.equal(n[1].route, 'weather'); assert.match(n[2].message, /^All 12 counties/);
  const quietFreeze = L.derive.notices(record(L, [50, 47, 36, 31, 49, 56, 58]), NOW);
  same(quietFreeze.map(x => [x.key, x.route]), [['tier3:2026-11-16', 'heat']]);
  same(L.derive.notices(record(L, [50, 47, 44, 46, 49, 56, 58]), NOW), []);
  same(L.derive.notices(record(L, [50, 47, 30, 46, 49, 56, 58]), new Date('2026-11-15T23:00:00Z'), {}).length, 0, 'a forecast more than a day and a half old stays quiet');
});
