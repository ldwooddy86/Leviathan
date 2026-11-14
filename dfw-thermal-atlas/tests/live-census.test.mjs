import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { context, load, fakeFetch, same, plain, ROOT } from './helpers/load.mjs';

/* Answers recorded from api.census.gov on 2026-11-13: the catalogue entry of the 2024 five year file, the 404 for 2025, the
   2025 one year catalogue, four variable answers, and the two pages a data call is redirected to without a key and with a
   key the Bureau does not know (both trimmed to their title and message). */
const raw = n => readFileSync(join(ROOT, 'tests', 'fixtures', 'census', n), 'utf8'), fx = n => JSON.parse(raw(n));
const LIST24 = fx('acs5-listing-2024-2026-11-13.json'), ONE25 = fx('acs1-listing-2025-2026-11-13.json'), NOT_FOUND = raw('acs5-listing-2025-not-found-2026-11-13.html'), MISSING = raw('missing-key-page-2026-11-13.html'), INVALID = raw('invalid-key-page-2026-11-13.html');
const VAR = id => fx(`variable-${id}_001E-2024-2026-11-13.json`);
/* The 2025 five year file is not out, so its catalogue entry cannot be recorded. The recorded 2023 and 2024 entries differed
   only in the year, so the 2024 one is moved a year on. */
const LIST25 = JSON.parse(JSON.stringify(LIST24).replace(/2024/g, '2025'));
const fresh = () => load(context(), 'live/core.js', 'live/geo.js', 'live/sources/census_acs.js').TDA_LIVE;
const NOW = new Date('2026-11-13T18:43:00Z');
const API = 'https://api.census.gov/data', FILE = y => `https://www2.census.gov/programs-surveys/acs/summary_file/${y}/table-based-SF/data/5YRData/acsdt5y${y}-b25040.dat`;
const keyPage = (which, body) => ({ status: 200, url: `${API}/${which}_key.html`, body });
const pick = (o, k, d) => o && k in o ? o[k] : d;
/* what the two hosts answered on 2026-11-13, unless a test says otherwise */
const routes = o => [
  [/\/data\/2024\/acs\/acs5\.json$/, pick(o, 'list24', LIST24)], [/\/data\/2025\/acs\/acs5\.json$/, pick(o, 'list25', { status: 404, body: NOT_FOUND })],
  [/summary_file\/2024\//, pick(o, 'file24', { status: 200, body: '' })], [/summary_file\/2025\//, pick(o, 'file25', { status: 404, body: '' })],
  [/\/variables\/B\d+_001E\.json$/, pick(o, 'vars', u => VAR(/variables\/(B\d+)_001E/.exec(u)[1]))],
  [/\/acs\/acs5\?get=/, pick(o, 'data', keyPage('missing', MISSING))],
];
const runOnce = async (L, fetch, o) => { o = o || {}; const http = L.makeHttp({ fetch, gapMs: 0, backoffMs: 1 }); const data = await L.BY_ID.census_acs.run({ http, now: o.now || NOW, prev: o.prev || null, key: o.key || null, geo: L.geo, settings: {}, env: o.env || 'extension' }); return { data, http }; };
const sent = fetch => fetch.calls.map(c => c.init.method + ' ' + c.url);

test('candidates: the vintages worth asking about, from the clock', () => {
  const L = fresh(), c = d => plain(L.census.candidates(new Date(d)));
  assert.equal(L.census.COMPILED, 2024);
  same(c('2026-11-13T18:00:00Z'), [2024, 2025], 'November 2026: the 2025 file is due this winter');
  same(c('2026-08-31T23:00:00Z'), [2024], 'before September nothing newer can be in the catalogue'); same(c('2026-09-01T00:00:00Z'), [2024, 2025]);
  same(c('2027-02-10T12:00:00Z'), [2024, 2025], 'a release that slipped into the new year is still looked for'); same(c('2027-10-01T12:00:00Z'), [2024, 2025, 2026]);
  same(c('2040-01-01T00:00:00Z'), [2024, 2025, 2026, 2027], 'never more than three years ahead'); same(c('2020-01-01T00:00:00Z'), [2024], 'a clock set wrong still checks the compiled file');
  same([L.census.span(2024), L.census.span(2025)], ['2020 to 2024', '2021 to 2025']); assert.equal(L.census.fileUrl(2024), FILE(2024));
});

test('parseListing finds the five year detailed tables among the entries of a catalogue answer', () => {
  const L = fresh(), p = L.census.parseListing;
  assert.equal(LIST24.dataset.length, 6, 'detailed tables, three profile sets and two microdata samples');
  same(p(LIST24, 2024), { year: 2024, listed: true, title: 'ACS 5-Year Detailed Tables', modified: '2025-09-02' });
  same(p(LIST24, 2025), { year: 2025, listed: false }, 'the 2024 answer says nothing about 2025');
  same(p(ONE25, 2025), { year: 2025, listed: false }, 'the 2025 one year file is out (2026-10-29) and is not the five year file');
  same(p(LIST25, 2025).listed, true);
  const off = plain(LIST24); off.dataset[0].c_isAvailable = false; same(p(off, 2024).listed, false, 'an entry marked not available does not count');
  const profilesOnly = { dataset: LIST24.dataset.slice(1) }; same(p(profilesOnly, 2024), { year: 2024, listed: false });
  for (const bad of [null, {}, { dataset: null }, { dataset: [null] }]) same(p(bad, 2024), { year: 2024, listed: false });
});

test('the collector today: the compiled file is the latest, four small requests and no key anywhere', async () => {
  const L = fresh(), fetch = fakeFetch(routes()), { data, http } = await runOnce(L, fetch);
  same(sent(fetch), [`GET ${API}/2024/acs/acs5.json`, `HEAD ${FILE(2024)}`, `GET ${API}/2025/acs/acs5.json`, `HEAD ${FILE(2025)}`]); assert.equal(http.stats.n, 4);
  assert.ok(fetch.calls.every(c => c.init.credentials === 'omit' && c.init.cache === 'no-store' && c.init.headers === undefined && !/key=/.test(c.url)));
  same(data, { v: 1, checked: '2026-11-13T18:43:00.000Z', compiled: 2024, latest: 2024, newer: false, state: 'current', published: true, api: null, key: 'none', firstSeen: null,
    years: [{ year: 2024, listed: true, title: 'ACS 5-Year Detailed Tables', modified: '2025-09-02', published: true }, { year: 2025, listed: false, published: false }], tables: null, stale: [] });
  same(L.BY_ID.census_acs.digest(plain(data)), { latest: '2020 to 2024', compiled: '2020 to 2024', newer: 'no', key: null }, 'no key saved: the key row stays out of the table');
  same(L.census.status(plain(data)), { state: 'current', compiled: '2020 to 2024', latest: '2020 to 2024', firstSeen: null, text: 'The stock model uses the latest American Community Survey five year file, 2020 to 2024.' });
  assert.ok(JSON.stringify(data).length < 600, 'a tiny record: ' + JSON.stringify(data).length);
});

test('a web page asks the catalogue only: the file server sends no CORS header', async () => {
  const L = fresh(), fetch = fakeFetch(routes()), { data } = await runOnce(L, fetch, { env: 'page' });
  same(sent(fetch), [`GET ${API}/2024/acs/acs5.json`, `GET ${API}/2025/acs/acs5.json`]);
  same([data.state, data.latest, data.published, data.years.map(y => y.published)], ['current', 2024, null, [null, null]]);
});

test('a newer file is out: listed by the catalogue, posted on the file server, its four tables checked once', async () => {
  const L = fresh(), out = { list25: LIST25, file25: { status: 200, body: '' } }, fetch = fakeFetch(routes(out)), { data } = await runOnce(L, fetch, { now: new Date('2026-12-10T15:00:00Z') });
  same(sent(fetch), [`GET ${API}/2024/acs/acs5.json`, `HEAD ${FILE(2024)}`, `GET ${API}/2025/acs/acs5.json`, `HEAD ${FILE(2025)}`, ...['B25040', 'B25117', 'B25034', 'B25035'].map(t => `GET ${API}/2025/acs/acs5/variables/${t}_001E.json`)]);
  same({ latest: data.latest, newer: data.newer, state: data.state, published: data.published, firstSeen: data.firstSeen, stale: data.stale }, { latest: 2025, newer: true, state: 'newer', published: true, firstSeen: '2026-12-10T15:00:00.000Z', stale: [] });
  same(data.tables, [{ id: 'B25040', name: 'House Heating Fuel', present: true }, { id: 'B25117', name: 'Tenure by House Heating Fuel', present: true }, { id: 'B25034', name: 'Year Structure Built', present: true }, { id: 'B25035', name: 'Median Year Structure Built', present: true }]);
  same(L.BY_ID.census_acs.digest(plain(data)), { latest: '2021 to 2025', compiled: '2020 to 2024', newer: 'yes', key: null });
  same(L.census.status(plain(data)).text, 'A newer Census file is out: American Community Survey 2021 to 2025. The stock model, compiled from 2020 to 2024, can be rebuilt.');
  /* a week later: the day it was first seen is kept and the tables are not asked for again */
  const again = fakeFetch(routes(out)), second = await runOnce(L, again, { now: new Date('2026-12-17T15:00:00Z'), prev: plain(data) });
  assert.equal(again.calls.length, 4); same([second.data.firstSeen, second.data.checked, second.data.tables.length], ['2026-12-10T15:00:00.000Z', '2026-12-17T15:00:00.000Z', 4]);
  /* a table dropped from the new file is named */
  const lost = await runOnce(L, fakeFetch(routes(Object.assign({}, out, { vars: u => /B25117/.test(u) ? { status: 404, body: NOT_FOUND } : /B25035/.test(u) ? { status: 500, body: 'x' } : VAR(/variables\/(B\d+)_001E/.exec(u)[1]) }))));
  same(lost.data.tables.map(t => t.present), [true, false, true, null], 'present, gone, present, could not ask'); assert.match(L.census.status(plain(lost.data)).text, /can be rebuilt\. Missing from the new file: B25117\.$/);
});

test('listed is not the same as published: each channel is reported for what it showed', async () => {
  const L = fresh();
  /* the catalogue lists 2025 but its summary file is not on the file server */
  let r = await runOnce(L, fakeFetch(routes({ list25: LIST25 })));
  same([r.data.latest, r.data.newer, r.data.state, r.data.published, r.data.firstSeen], [2025, true, 'listed', false, '2026-11-13T18:43:00.000Z']);
  same(L.BY_ID.census_acs.digest(plain(r.data)).newer, 'listed, not confirmed'); assert.match(L.census.status(plain(r.data)).text, /^The Census API lists a newer five year file, 2021 to 2025, not yet confirmed as published\./);
  /* a web page cannot ask the file server, so a listing stays unconfirmed there */
  r = await runOnce(L, fakeFetch(routes({ list25: LIST25 })), { env: 'page' }); same([r.data.state, r.data.published], ['listed', null]);
  /* the file is posted before the catalogue lists it */
  r = await runOnce(L, fakeFetch(routes({ file25: { status: 200, body: '' } })));
  same([r.data.latest, r.data.state, r.data.published, r.data.tables, r.data.years[1].listed], [2025, 'newer', true, null, false]);
  /* the compiled year's own file is not found: the path has moved, so a 404 for 2025 says nothing */
  r = await runOnce(L, fakeFetch(routes({ list25: LIST25, file24: { status: 404, body: '' } })));
  same([r.data.state, r.data.published, r.data.years.map(y => y.published)], ['listed', null, [null, null]]);
  r = await runOnce(L, fakeFetch(routes({ file24: { status: 503, body: '' } }))); same([r.data.state, r.data.published, r.data.years.map(y => y.published)], ['current', null, [null, null]], 'a file server that is down leaves the answer open');
});

test('with a key: one data call confirms, and a key the Bureau refuses is reported, not fatal', async () => {
  const L = fresh(), DATA = `${API}/2024/acs/acs5?get=NAME,B25040_001E&for=county:113&in=state:48&key=abc123`;
  /* the real answer to a key the Bureau does not know: a redirect to the Invalid Key page */
  let fetch = fakeFetch(routes({ data: keyPage('invalid', INVALID) })), r = await runOnce(L, fetch, { key: 'abc123' });
  same(sent(fetch).slice(-1), ['GET ' + DATA]); assert.equal(fetch.calls.filter(c => /key=/.test(c.url)).length, 1, 'the key travels on the data call only');
  same([r.data.state, r.data.api, r.data.key, r.data.published], ['current', null, 'refused', true]); assert.ok(!JSON.stringify(r.data).includes('abc123'), 'the key is never stored');
  same(L.BY_ID.census_acs.digest(plain(r.data)).key, 'not accepted', 'and the Live Data table says so');
  assert.match(L.census.status(plain(r.data)).text, /2020 to 2024\. The Census API did not accept the Census API key saved in Live Data settings\.$/);
  r = await runOnce(L, fakeFetch(routes()), { key: 'abc123' }); same(r.data.key, 'refused', 'the Missing Key page counts the same');
  r = await runOnce(L, fakeFetch(routes({ data: { status: 500, body: 'x' } })), { key: 'abc123' }); same([r.data.api, r.data.key, L.BY_ID.census_acs.digest(plain(r.data)).key], [null, 'unknown', 'could not be checked']);
  r = await runOnce(L, fakeFetch(routes({ data: '<html>busy</html>' })), { key: 'abc123' }); same([r.data.api, r.data.key], [null, 'unknown']);
  /* No key was at hand to record a data answer. This one is hand made in the documented shape (a header row, then one row per
     place) with no estimate in it; the collector keeps nothing from the answer but the fact that it came. */
  const answer = [['NAME', 'B25040_001E', 'state', 'county'], ['Dallas County, Texas', null, '48', '113']];
  r = await runOnce(L, fakeFetch(routes({ data: answer })), { key: 'abc123' }); same([r.data.api, r.data.key, r.data.state, L.BY_ID.census_acs.digest(plain(r.data)).key], [true, 'ok', 'current', 'accepted']);
  r = await runOnce(L, fakeFetch(routes({ data: [['NAME']] })), { key: 'abc123' }); same([r.data.api, r.data.key], [null, 'unknown'], 'an answer without the table is no confirmation');
  /* listed but not on the file server, and the data call for 2025 answers: confirmed by the API itself */
  fetch = fakeFetch(routes({ list25: LIST25, data: answer })); r = await runOnce(L, fetch, { key: 'abc123' });
  assert.ok(sent(fetch).includes(`GET ${API}/2025/acs/acs5?get=NAME,B25040_001E&for=county:113&in=state:48&key=abc123`), 'the confirmation asks for the newest vintage');
  same([r.data.latest, r.data.state, r.data.published, r.data.api], [2025, 'newer', false, true]);
});

test('if the catalogue itself starts asking for a key: a clear message without one, the key used with one', async () => {
  const L = fresh(), wall = [[/\/acs5\.json$/, keyPage('missing', MISSING)], [/summary_file/, { status: 200, body: '' }]];
  await assert.rejects(() => runOnce(L, fakeFetch(wall)), /The Census API now asks for a key on this request\. Add a free Census API key in Live Data settings, then refresh again\./);
  const withKey = fakeFetch([[/\/2024\/acs\/acs5\.json\?key=good$/, LIST24], [/\/2025\/acs\/acs5\.json\?key=good$/, { status: 404, body: NOT_FOUND }], [/\/acs\/acs5\?get=/, [['NAME', 'B25040_001E', 'state', 'county'], ['Dallas County, Texas', null, '48', '113']]], [/summary_file\/2025/, { status: 404, body: '' }], ...wall]);
  const r = await runOnce(L, withKey, { key: 'good' }); same([r.data.state, r.data.latest, r.data.key], ['current', 2024, 'ok']);
  same(sent(withKey).filter(u => /acs5\.json/.test(u)), [`GET ${API}/2024/acs/acs5.json`, `GET ${API}/2024/acs/acs5.json?key=good`, `GET ${API}/2025/acs/acs5.json`, `GET ${API}/2025/acs/acs5.json?key=good`], 'asked without the key first, every time');
  const badKey = fakeFetch([[/\/acs5\.json\?key=/, keyPage('invalid', INVALID)], ...wall]);
  await assert.rejects(() => runOnce(L, badKey, { key: 'typo' }), /The Census API did not accept the Census API key saved in Live Data settings\./);
});

test('failures: without the compiled file as a control nothing is claimed; a later year that will not answer is kept and named', async () => {
  const L = fresh(), fails = (o, re) => assert.rejects(() => runOnce(L, fakeFetch(routes(o))), re);
  await fails({ list24: { status: 404, body: NOT_FOUND } }, /The Census API no longer lists the 2020 to 2024 five year file the atlas was compiled from: its catalogue may have moved\./);
  await fails({ list24: { dataset: LIST24.dataset.slice(1) } }, /no longer lists the 2020 to 2024 five year file/);
  await fails({ list24: { status: 503, body: 'down' } }, /HTTP 503 from api\.census\.gov/);
  await fails({ list24: NOT_FOUND }, /not JSON from api\.census\.gov/);
  /* 2025 answers 500 twice. First run ever: unknown, and said so. */
  const flaky = { list25: { status: 500, body: 'x' } }, cold = fakeFetch(routes(flaky)), a = await runOnce(L, cold);
  assert.equal(cold.calls.filter(c => /2025\/acs\/acs5\.json/.test(c.url)).length, 2, 'one retry');
  same([a.data.state, a.data.latest, a.data.years[1]], ['current', 2024, { year: 2025, listed: null, published: false }]); same(a.data.stale.map(s => s.block), ['2025']); assert.match(a.data.stale[0].why, /HTTP 500 from api\.census\.gov/);
  /* the week before it was listed and posted: a published file does not go away because the catalogue hiccups */
  const before = plain((await runOnce(L, fakeFetch(routes({ list25: LIST25, file25: { status: 200, body: '' } })), { now: new Date('2026-12-10T15:00:00Z') })).data);
  const b = await runOnce(L, fakeFetch(routes(Object.assign({ file25: { status: 200, body: '' } }, flaky))), { now: new Date('2026-12-17T15:00:00Z'), prev: before });
  same([b.data.latest, b.data.state, b.data.firstSeen, b.data.years[1].stale, b.data.stale.map(s => s.block), b.data.tables.length], [2025, 'newer', '2026-12-10T15:00:00.000Z', true, ['2025'], 4]);
});

test('every request carries its own time limit, under the 30 seconds a background worker allows', async () => {
  const L = fresh(), out = { list25: LIST25, file25: { status: 200, body: '' }, data: [['NAME', 'B25040_001E', 'state', 'county'], ['Dallas County, Texas', null, '48', '113']] };
  const real = L.makeHttp({ fetch: fakeFetch(routes(out)), gapMs: 0, backoffMs: 1 }), seen = [];
  const http = { json: (u, i) => { seen.push([u, i || {}]); return real.json(u, i); }, text: (u, i) => { seen.push([u, i || {}]); return real.text(u, i); }, stats: real.stats };
  await L.BY_ID.census_acs.run({ http, now: new Date('2026-12-10T15:00:00Z'), prev: null, key: 'abc123', geo: L.geo, settings: {}, env: 'extension' });
  assert.equal(seen.length, 9, 'the longest run: two catalogue entries, two files, the data call and four tables');
  assert.ok(seen.every(([, i]) => i.timeoutMs >= 10000 && i.timeoutMs <= 20000 && i.retries === 1 && i.gapMs >= 500), 'at most 20 s each, one retry, half a second or more between calls');
  assert.ok(seen.filter(([u]) => /api\.census\.gov/.test(u)).every(([, i]) => typeof i.expectFinalUrl === 'function' && !i.expectFinalUrl('https://api.census.gov/data/missing_key.html') && !i.expectFinalUrl('https://api.census.gov/data/invalid_key.html') && i.expectFinalUrl('https://api.census.gov/data/2024/acs/acs5.json')), 'every call to the API refuses an answer that is one of the two key pages');
  assert.ok(seen.filter(([u]) => /www2\.census\.gov/.test(u)).every(([, i]) => i.method === 'HEAD'), 'the 44 MB file is never downloaded');
});

test('status says nothing without a record', () => {
  const L = fresh(); same([L.census.status(null), L.census.status({}), L.census.status(undefined)], [null, null, null]);
});

test('registration: two hosts, weekly, an optional key, plain words, the terms notice', () => {
  const L = fresh(), s = L.BY_ID.census_acs;
  same({ hosts: s.hosts, cadence: s.cadence, cors: s.cors, grade: s.grade, key: s.key, keyLabel: s.keyLabel, keyUrl: s.keyUrl, keyRequired: s.keyRequired }, { hosts: ['api.census.gov', 'www2.census.gov'], cadence: 'weekly', cors: true, grade: 'A', key: 'census', keyLabel: 'Census API key', keyUrl: 'https://api.census.gov/data/key_signup.html', keyRequired: false });
  assert.match(s.terms, /This product uses the Census Bureau Data API but is not endorsed or certified by the Census Bureau\./);
  same(plain(L.census.TABLES).map(t => t[0]), ['B25040', 'B25117', 'B25034', 'B25035']);
  for (const t of L.census.TABLES) assert.equal(VAR(t[0]).concept, t[1], 'named as the recorded 2024 catalogue names table ' + t[0]);
  assert.ok(Object.values(s.labels).every(l => l.length === 2 && l[1] === 'text'), 'a vintage is a name, not a number to format');
  for (const t of [s.name, s.about, s.publisher, s.terms, s.keyLabel, ...Object.values(s.labels).map(l => l[0])]) assert.ok(!/[A-Za-z0-9][-‐-―][A-Za-z0-9]|\s[-‐-―]\s/.test(t), 'no hyphen or dash anywhere in the words: ' + t);
});
