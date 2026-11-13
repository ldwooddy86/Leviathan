import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { context, load, fakeFetch, same, plain, ROOT } from './helpers/load.mjs';

const fx = n => readFileSync(join(ROOT, 'tests', 'fixtures', 'iem', n), 'utf8');
/* recorded 2026-11-13 (see tests/fixtures/iem/README.md) */
const EMPTY = fx('watchwarn-fwd-season-2026-2026-11-13.csv'), WINDOW = fx('watchwarn-fwd-window-2026-01-24-2026-11-13.csv'), S2025 = fx('watchwarn-fwd-season-2025-2026-11-13.csv'), TEN = fx('watchwarn-fwd-12-zones-2016-to-2026-2026-11-13.csv');
/* hand made, for the paths the public record did not offer */
const QUOTED = fx('synthetic-quoted-fields.csv'), FREEZE = fx('synthetic-season-2026-freeze-warning.csv'), ERROR_PAGE = fx('synthetic-error-page.html');

const fresh = () => { const L = load(context(), 'live/core.js', 'live/geo.js', 'live/sources/iem_cold.js').TDA_LIVE; L.iem.pace = 0; return L; };
const M = s => Date.parse(s.replace(' ', 'T') + ':00Z') / 6e4;                      // "2026-01-25 00:00" UTC to minutes, worked out apart from the collector
const NOW = new Date('2026-11-13T18:00:00Z');                                       // Friday midday in Dallas
const URL_2026 = 'https://mesonet.agron.iastate.edu/cgi-bin/request/gis/watchwarn.py?accept=csv&sts=2026-07-01T00:00Z&ets=2027-07-01T00:00Z&location_group=wfo&wfo=FWD&limitps=1&phenomena=FZ,FZ,HZ,HZ,FR,EC,EC,CW,WC,WC,WC,WS,WS,WW,IS,ZR,BZ,BZ,ZF,SN,IP,HS,IP,SB&significance=W,A,W,A,Y,W,A,Y,Y,W,A,W,A,Y,W,Y,W,A,Y,Y,Y,W,W,Y';
/* The service as the tests need it: one season a request, rows chosen by start time (how the real one chooses them, checked
   2026-11-13). Season 2026 is the recorded empty answer, 2025 the recorded whole office, the winters before it are cut from the
   ten winter pull. `over` replaces the answer of a season. A request in any other shape throws. */
const TEN_LINES = TEN.trim().split('\n');
const seasonOfUrl = u => { const m = /\?accept=csv&sts=(\d{4})-07-01T00:00Z&ets=(\d{4})-07-01T00:00Z&location_group=wfo&wfo=FWD&limitps=1&phenomena=/.exec(u); assert.ok(m && +m[2] === +m[1] + 1, 'one season, July 1 to July 1: ' + u); return +m[1]; };
const slice = s => [TEN_LINES[0]].concat(TEN_LINES.slice(1).filter(l => l.slice(0, 16) >= `${s}-07-01 00:00` && l.slice(0, 16) < `${s + 1}-07-01 00:00`)).join('\n') + '\n';
const service = over => fakeFetch([[/watchwarn\.py/, u => { const s = seasonOfUrl(u); return over && over[s] !== undefined ? over[s] : s === 2026 ? EMPTY : s === 2025 ? S2025 : slice(s); }]]);
const asked = fetch => fetch.calls.map(c => seasonOfUrl(c.url));
const run = async (L, fetch, prev, now) => { const http = L.makeHttp({ fetch, gapMs: 0, backoffMs: 1, retries: 0 }); const data = await L.BY_ID.iem_cold.run({ http, now: now || NOW, prev: prev == null ? null : plain(prev), geo: L.geo, settings: {} }); return { data: plain(data), http }; };
const first = async L => (await run(L, service())).data;
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
/* Season 2025 to 2026 as the spec recorded it (section 9), across the whole office area, and the same season in the 12 counties:
   one Freeze Warning, one Cold Weather Advisory and the Ice Storm Warning were for other counties of the Fort Worth office. */
const OFFICE_2025 = { 'FZ.W': 4, 'FZ.A': 1, 'FR.Y': 1, 'CW.Y': 2, 'EC.A': 1, 'EC.W': 1, 'WS.A': 1, 'WS.W': 1, 'IS.W': 1, 'ZF.Y': 1 };
const METRO_2025 = { 'FZ.W': 3, 'FZ.A': 1, 'FR.Y': 1, 'CW.Y': 1, 'EC.A': 1, 'EC.W': 1, 'WS.A': 1, 'WS.W': 1, 'ZF.Y': 1 };
/* Cold hazard days by county, the table of spec section 5.1: Collin Dallas Denton Ellis Hood Hunt Johnson Kaufman Parker Rockwall Tarrant Wise */
const DAYS = { 2016: [4, 2, 5, 2, 2, 4, 2, 2, 3, 2, 2, 6], 2017: [12, 7, 12, 5, 10, 7, 7, 3, 14, 7, 7, 13], 2018: [4, 4, 6, 3, 5, 3, 5, 4, 6, 4, 5, 6], 2019: [3, 1, 4, 1, 3, 2, 1, 1, 4, 1, 2, 4], 2020: [12, 13, 14, 13, 16, 13, 13, 13, 16, 13, 14, 16],
  2021: [9, 9, 9, 7, 9, 9, 9, 8, 9, 10, 9, 9], 2022: [10, 8, 9, 8, 8, 10, 8, 10, 8, 9, 8, 9], 2023: [4, 5, 5, 4, 5, 6, 5, 5, 4, 5, 5, 5], 2024: [13, 12, 13, 11, 12, 13, 11, 12, 12, 12, 12, 13], 2025: [11, 11, 11, 11, 11, 11, 11, 11, 12, 11, 11, 12] };
const COUNTIES = ['Collin', 'Dallas', 'Denton', 'Ellis', 'Hood', 'Hunt', 'Johnson', 'Kaufman', 'Parker', 'Rockwall', 'Tarrant', 'Wise'];

test('the collector is registered the way the contract asks', () => {
  const L = fresh(), s = L.BY_ID.iem_cold;
  assert.equal(s.cadence, 'weekly'); assert.equal(s.cors, true); same(s.hosts, ['mesonet.agron.iastate.edu']); assert.match(s.grade, /^[A-D]$/); assert.match(s.page, /^https:\/\/mesonet\.agron\.iastate\.edu\//);
  same(Object.keys(s.labels), ['products', 'days', 'firstFreezeWarning', 'active', 'seasons']);
  for (const [text, kind] of Object.values(s.labels)) { assert.ok(text.length > 8); assert.ok(['int', 'f1', 'pct', 'degF', 'usd', 'text', 'idx'].includes(kind)); }
  for (const text of [s.name, s.publisher, s.about, s.terms, ...Object.values(s.labels).map(l => l[0])]) assert.ok(!/[A-Za-z0-9][-\u2010-\u2015][A-Za-z0-9]|\s[-\u2010-\u2015]\s/.test(text), 'no hyphen or dash between words: ' + text);
  assert.ok(s.about.split(/\.\s/).length <= 2, 'about: one or two sentences');
});

test('the request: one whole season, the 24 product pairs, exactly as verified', () => {
  const L = fresh(), I = L.iem;
  assert.equal(I.url(2026), URL_2026);
  assert.equal(I.PAIRS.length, 24); assert.equal(new Set(I.PAIRS).size, 24); for (const p of I.PAIRS) assert.match(p, /^[A-Z]{2}\.[WAY]$/);
  /* names for the sixteen codes the Fort Worth office used in ten winters and for the Blizzard Warning; any other code stays a code */
  same(I.PAIRS.filter(p => I.NAMES[p]).length, 17);
  assert.equal(I.nameOf('FZ.W'), 'Freeze Warning'); assert.equal(I.nameOf('HZ.A'), 'Hard Freeze Watch'); assert.equal(I.nameOf('CW.Y'), 'Cold Weather Advisory'); assert.equal(I.nameOf('ZF.Y'), 'Freezing Fog Advisory');
  for (const p of ['ZR.Y', 'BZ.A', 'SN.Y', 'IP.Y', 'HS.W', 'IP.W', 'SB.Y', 'QQ.W']) assert.equal(I.nameOf(p), p, 'no guessed name for ' + p);
  for (const [was, now] of Object.entries(I.RENAMED)) { assert.ok(I.NAMES[was] && I.NAMES[now]); assert.equal(was.slice(3), now.slice(3), 'a warning stays a warning'); }
});

test('parse: a real answer, columns found by name, a header alone is a real answer', () => {
  const L = fresh(), I = L.iem;
  assert.equal(M('2026-01-25 00:00'), 29488320); assert.equal(M('2026-01-27 15:00'), 29492100);                  // the example of spec section 7
  const w = I.parse(WINDOW);
  assert.equal(w.length, 109); assert.equal(w.bad, 0); assert.equal(new Set(w.map(r => r.ugc)).size, 46, 'every zone of the office');
  same([...new Set(w.map(r => r.code))].sort(), ['EC.A', 'EC.W', 'WS.W']);
  same(w.find(r => r.code === 'EC.W' && r.ugc === 'TXZ119'), { y: 2026, code: 'EC.W', id: 1, ugc: 'TXZ119', b: 29488320, e: 29492100 }, 'the Extreme Cold Warning for Dallas County');
  const watch = w.find(r => r.code === 'EC.A' && r.ugc === 'TXZ119'); assert.ok(watch.e < watch.b, 'the watch was replaced by the warning before it began');
  /* the same rows come out of the seven column layout: nothing depends on where a column sits */
  const season = new Set(I.parse(S2025).map(r => JSON.stringify(r))); assert.equal(season.size, 448);
  for (const r of w) assert.ok(season.has(JSON.stringify(r)), 'in both files: ' + JSON.stringify(r));
  const none = I.parse(EMPTY); same(none, []); assert.equal(none.bad, 0);
  assert.equal(I.minutes('2026-01-25 00:00'), 29488320); for (const bad of ['', '2026-13-01 00:00', '2026-01-32 00:00', '2026-01-25 24:00', '202601250000', 'yesterday', null]) assert.equal(I.minutes(bad), null, String(bad));
});

test('parse: quoted fields, either line ending, rows that do not parse are skipped and counted', () => {
  const L = fresh(), I = L.iem;
  same(I.csv('a,"b,1","say ""hi""","x\ny"\r\n1,2,,4\n\n'), [['a', 'b,1', 'say "hi"', 'x\ny'], ['1', '2', '', '4']]);
  const want = [['TXZ119', 'FZ.W', 3], ['TXZ103', 'FZ.W', 3], ['TXZ104', 'FZ.W', 3], ['TXZ091', 'FZ.W', 3], ['TXC113', 'FZ.W', 3], ['TXZ119', 'FZ.A', 2]];
  for (const text of [QUOTED, QUOTED.replace(/\r?\n/g, '\r\n'), QUOTED.replace(/\r\n/g, '\n'), '\uFEFF' + QUOTED]) {
    const rows = I.parse(text);
    same(rows.map(r => [r.ugc, r.code, r.id]), want); assert.equal(rows.bad, 5, 'a short row, a bad start, a bad zone, no event number, a quote that never closes');
    same(rows[0], { y: 2026, code: 'FZ.W', id: 3, ugc: 'TXZ119', b: M('2026-11-17 06:00'), e: M('2026-11-17 15:00') });
  }
  /* the two zones outside the 12 drop out, and the zone that ended an hour early keeps its own interval */
  same(I.compact(I.parse(QUOTED)), [[2026, 'FZ.W', 3, M('2026-11-17 06:00'), M('2026-11-17 14:00'), 1], [2026, 'FZ.W', 3, M('2026-11-17 06:00'), M('2026-11-17 15:00'), 2 | 4], [2026, 'FZ.A', 2, M('2026-11-17 06:00'), M('2026-11-16 21:10'), 2]]);
});

test('the 12 zones and the bitmask round trip', () => {
  const L = fresh(), I = L.iem, zones = plain(L.geo.counties.map(c => c.zone));
  const rows = I.parse(TEN), events = I.compact(rows);
  assert.equal(rows.length, 902, 'rows of the 12 zones in ten winters'); assert.equal(new Set(rows.map(r => r.y + r.code + r.id)).size, 117, 'products'); assert.equal(events.length, 147);
  /* every row is a bit of exactly one entry, and every bit is a row */
  for (const r of rows) { const e = events.filter(x => x[0] === r.y && x[1] === r.code && x[2] === r.id && x[3] === r.b && x[4] === r.e); assert.equal(e.length, 1); assert.ok(I.zonesIn(e[0][5]).includes(r.ugc)); }
  assert.equal(events.reduce((n, e) => n + I.zonesIn(e[5]).length, 0), 902);
  same(I.zonesIn(4095), zones); same(I.countiesIn(4095), COUNTIES); same(I.countiesIn(2048), ['Wise']); same(I.countiesIn(309), ['Collin', 'Denton', 'Hood', 'Hunt', 'Parker']); same(I.countiesIn(0), []);
  same(events[0], [2016, 'FZ.W', 1, 24659100, 24659460, 2048], 'the first row of the spec sample: Wise County, November 2016');
  assert.ok(events.every((e, i) => i === 0 || events[i - 1][3] <= e[3]), 'oldest first');
  /* a whole office answer: 46 zones in, 12 kept */
  const jan = I.compact(I.parse(WINDOW));
  same(jan, [[2026, 'EC.W', 1, 29488320, 29492100, 4095], [2026, 'EC.A', 1, 29488320, M('2026-01-22 20:36'), 4095]], 'the Winter Storm Warning rows of that window were for zones outside the 12');
  same(I.compact(I.parse(WINDOW), ['TXZ142', 'TXZ119']).map(e => [e[1], e[5]]), [['WS.W', 1], ['EC.W', 3], ['EC.A', 3]], 'any zone list can be asked for: here a zone south of the 12 that was under that warning');
  same(I.compact([]), []); same(I.compact(null), []);
});

test('first run: the running season, then the ten winters before it, one season a request', async () => {
  const L = fresh(), I = L.iem, fetch = service();
  const { data, http } = await run(L, fetch);
  assert.equal(http.stats.n, 11); assert.equal(fetch.calls[0].url, URL_2026); same(asked(fetch), [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016]);
  assert.ok(fetch.calls.every(c => c.url === I.url(seasonOfUrl(c.url)) && c.init.method === 'GET' && c.init.credentials === 'omit' && c.init.cache === 'no-store'), 'plain reads, no cookies, no cache');
  same(Object.assign({}, data, { events: null, office: null }), { v: 1, fetched: '2026-11-13T18:00Z', season: 2026, zones: plain(L.geo.counties.map(c => c.zone)), events: null, seasons: range(2016, 2026), office: null, archiveFrom: '2016-07-01', archiveThrough: '2026-11-13', bad: {}, stale: {} });
  same(data.events, plain(I.compact(I.parse(TEN))), 'season by season gives the same list as the one pull of ten winters');
  same(data.office[2025], OFFICE_2025); same(data.office[2026], {});
  same(L.BY_ID.iem_cold.digest(data), { products: 0, days: 0, firstFreezeWarning: 'none yet', active: 0, seasons: 10 });
  /* size guard: ten winters stay small, and nothing in the record can close a script tag */
  const size = JSON.stringify(data).length; assert.ok(size < 8192, `stored ${size} bytes`); assert.ok(JSON.stringify(data.events).length < 6144); assert.ok(!/<\/script/i.test(JSON.stringify(data)));
});

test('later runs ask for the running season only and replace it', async () => {
  const L = fresh(), I = L.iem, base = await first(L), before = JSON.stringify(base);
  /* Monday evening: a Freeze Warning has been issued for the coming night */
  const f2 = service({ 2026: FREEZE }), r2 = await run(L, f2, base, new Date('2026-11-16T22:00:00Z')), d2 = r2.data;
  assert.equal(r2.http.stats.n, 1); assert.equal(f2.calls[0].url, URL_2026); assert.equal(JSON.stringify(base), before, 'the previous record is not touched');
  same(d2.events.slice(0, 147), base.events, 'the earlier seasons are carried over as they were');
  same(d2.events.slice(147), [[2026, 'FZ.W', 1, M('2026-11-17 06:00'), M('2026-11-17 15:00'), 1 | 4 | 2048], [2026, 'FZ.A', 1, M('2026-11-17 06:00'), M('2026-11-16 21:10'), 1 | 4 | 2048]]);
  same(d2.office[2026], { 'FZ.A': 1, 'FZ.W': 1 }); assert.equal(d2.archiveThrough, '2026-11-16'); assert.equal(d2.archiveFrom, '2016-07-01'); same(d2.seasons, range(2016, 2026));
  same(L.BY_ID.iem_cold.digest(d2), { products: 2, days: 0, firstFreezeWarning: 'November 17', active: 0, seasons: 10 }, 'issued, not in effect yet');
  const eve = I.thisSeason(d2, new Date('2026-11-16T22:00:00Z'));
  same(eve.events, [{ code: 'FZ.W', name: 'Freeze Warning', year: 2026, id: 1, begin: '2026-11-17T06:00Z', end: '2026-11-17T15:00Z', date: '2026-11-17', counties: ['Collin', 'Denton', 'Wise'], withdrawn: false },
    { code: 'FZ.A', name: 'Freeze Watch', year: 2026, id: 1, begin: '2026-11-17T06:00Z', end: '2026-11-16T21:10Z', date: '2026-11-17', counties: ['Collin', 'Denton', 'Wise'], withdrawn: true }]);
  same(eve.upcoming.map(e => e.code), ['FZ.W']); same(eve.active, []); assert.equal(eve.days, 0); assert.equal(eve.firstFreezeWarning, '2026-11-17'); same(eve.first, { date: '2026-11-17', code: 'FZ.W', name: 'Freeze Warning' });
  const night = I.thisSeason(d2, new Date('2026-11-17T12:00:00Z'));
  same(night.active.map(e => [e.code, e.counties]), [['FZ.W', ['Collin', 'Denton', 'Wise']]]); same(night.upcoming, []); assert.equal(night.days, 1);
  same(I.byCounty(d2, 2026).Denton, { days: 1, events: 2, byCode: { 'FZ.W': 1, 'FZ.A': 1 }, firstFreezeWarning: '2026-11-17' }); same(I.byCounty(d2, 2026).Dallas, { days: 0, events: 0, byCode: {}, firstFreezeWarning: null });
  /* a week on: the warning was cancelled early in Collin County and a second one followed for Dallas County. The season is replaced, not added to. */
  const changed = FREEZE.replace('FWD,2026-11-17 06:00,2026-11-17 15:00,2026-11-16 21:10,202611171500,FZ,C,W,1,NEW,TXZ104', 'FWD,2026-11-17 06:00,2026-11-17 13:00,2026-11-16 21:10,202611171500,FZ,C,W,1,CAN,TXZ104')
    + 'FWD,2026-11-18 06:00,2026-11-18 15:00,2026-11-17 20:30,202611181500,FZ,C,W,2,EXP,TXZ119,2302.1,2026-11-18 14:50,,,,,False,,,,,,,202611172030-KFWD-WWUS74-NPWFWD,,2026\n';
  assert.ok(changed.includes('2026-11-17 13:00'));
  const f3 = service({ 2026: changed }), r3 = await run(L, f3, d2, new Date('2026-11-23T12:00:00Z')), d3 = r3.data;
  assert.equal(r3.http.stats.n, 1); same(d3.events.slice(0, 147), base.events);
  same(d3.events.slice(147), [[2026, 'FZ.W', 1, M('2026-11-17 06:00'), M('2026-11-17 13:00'), 1], [2026, 'FZ.W', 1, M('2026-11-17 06:00'), M('2026-11-17 15:00'), 4 | 2048], [2026, 'FZ.A', 1, M('2026-11-17 06:00'), M('2026-11-16 21:10'), 1 | 4 | 2048], [2026, 'FZ.W', 2, M('2026-11-18 06:00'), M('2026-11-18 15:00'), 2]]);
  same(L.BY_ID.iem_cold.digest(d3), { products: 3, days: 2, firstFreezeWarning: 'November 17', active: 0, seasons: 10 });
  same(I.thisSeason(d3, new Date('2026-11-23T12:00:00Z')).events.map(e => [e.name, e.begin, e.end, e.counties.join(' ')]), [['Freeze Warning', '2026-11-17T06:00Z', '2026-11-17T15:00Z', 'Collin Denton Wise'], ['Freeze Watch', '2026-11-17T06:00Z', '2026-11-16T21:10Z', 'Collin Denton Wise'], ['Freeze Warning', '2026-11-18T06:00Z', '2026-11-18T15:00Z', 'Dallas']]);
  /* rows that do not parse are counted against their season, and a clean pull clears the count */
  const r4 = await run(L, service({ 2026: QUOTED }), d3, new Date('2026-11-30T12:00:00Z')); same(r4.data.bad, { 2026: 5 }); assert.equal(r4.data.events.length, 150);
  same((await run(L, service({ 2026: FREEZE }), r4.data, new Date('2026-12-07T12:00:00Z'))).data.bad, {});
  /* only the products asked for are stored, whatever else an answer might hold: a Heat Advisory is not a cold product */
  const heat = FREEZE + 'FWD,2026-08-02 18:00,2026-08-03 01:00,2026-08-01 20:10,202608030100,HT,C,Y,7,EXP,TXZ119,2302.1,2026-08-03 01:00,,,,,False,,,,,,,202608012010-KFWD-WWUS74-NPWFWD,,2026\n';
  assert.equal(I.parse(heat).length, 11); assert.equal(I.read(heat).length, 10); assert.ok(I.read(heat).every(r => I.PAIRS.includes(r.code)));
  const d5 = (await run(L, service({ 2026: heat }), base, new Date('2026-11-16T22:00:00Z'))).data; same(d5.events, d2.events); same(d5.office[2026], { 'FZ.A': 1, 'FZ.W': 1 });
});

test('reads: the seasons, against what the spec recorded on 2026-11-13', async () => {
  const L = fresh(), I = L.iem, data = await first(L);
  const ss = I.seasons(data);
  same(ss.map(s => s.season), range(2016, 2026)); same(ss.map(s => s.complete), range(2016, 2025).map(() => true).concat(false));
  /* 2025 to 2026: the office area exactly as the spec lists it, and the 12 counties */
  const s25 = ss.find(s => s.season === 2025);
  same(s25, { season: 2025, label: '2025 to 2026', complete: true, events: 11, days: 12, byCode: METRO_2025, first: { date: '2025-10-30', code: 'FR.Y', name: 'Frost Advisory' }, firstFreezeWarning: '2025-11-09', office: { events: 14, byCode: OFFICE_2025 } });
  /* nothing yet this season */
  same(ss[10], { season: 2026, label: '2026 to 2027', complete: false, events: 0, days: 0, byCode: {}, first: null, firstFreezeWarning: null, office: { events: 0, byCode: {} } });
  same(I.thisSeason(data, NOW), { season: 2026, label: '2026 to 2027', held: true, events: [], days: 0, first: null, firstFreezeWarning: null, fallOver: false, byCode: {}, active: [], upcoming: [], through: '2026-11-13', grade: 'B' });
  /* cold hazard days by county, all ten winters: the table of spec section 5.1, cell for cell */
  for (const s of range(2016, 2025)) { const c = I.byCounty(data, s); same(Object.keys(c), COUNTIES); same(COUNTIES.map(n => c[n].days), DAYS[s], 'season ' + s); }
  const c25 = I.byCounty(data, 2025);
  assert.ok(COUNTIES.every(n => c25[n].days === 11 || c25[n].days === 12), '11 or 12 cold hazard days in every county');
  same(c25.Dallas, { days: 11, events: 10, byCode: { 'FZ.W': 3, 'FZ.A': 1, 'WS.A': 1, 'WS.W': 1, 'EC.W': 1, 'EC.A': 1, 'ZF.Y': 1, 'CW.Y': 1 }, firstFreezeWarning: '2025-11-09' }); assert.equal(c25.Parker.byCode['FR.Y'], 1); assert.equal(c25.Parker.events, 11);
  same(I.byCounty(data), plain(I.byCounty(data, 2026)), 'the running season when none is named'); assert.ok(COUNTIES.every(n => I.byCounty(data)[n].days === 0));
  same(I.byCounty(data, 2031).Dallas, { days: null, events: null, byCode: {}, firstFreezeWarning: null }, 'a season that is not held is unknown, not zero');
  /* one county at a time gives the same days as the county table, and the 12 together are the union, never the sum */
  same(I.seasons(data, { county: 'Dallas' }).slice(0, 10).map(s => s.days), range(2016, 2025).map(s => DAYS[s][1])); same(ss.slice(0, 10).map(s => s.days), [6, 15, 8, 4, 19, 10, 12, 8, 14, 12]); same(ss.slice(0, 10).map(s => s.events), [6, 16, 8, 7, 20, 10, 12, 12, 15, 11]);
  /* the first Freeze Warning is the first of the fall: Dallas County had none in two falls, and a spring warning does not count */
  same(I.seasons(data, { county: 'Dallas' }).map(s => s.firstFreezeWarning), ['2016-11-20', null, '2018-11-10', '2019-10-31', '2020-11-30', '2021-11-19', '2022-11-13', '2023-10-31', null, '2025-11-09', null]);
  assert.equal(I.seasons(data, { county: 'Hood' }).find(s => s.season === 2024).firstFreezeWarning, null, 'Hood County, 2024 to 2025: only an April Freeze Warning'); assert.equal(I.seasons(data, { county: 'Hood' }).find(s => s.season === 2024).byCode['FZ.W'], 1);
  same(I.seasons(data, { county: 'Nowhere' }), []);
});

test('reads: a moment inside the season, with the big events the spec names for Dallas County', async () => {
  const L = fresh(), I = L.iem, data = await first(L);
  const at = when => I.thisSeason(data, new Date(when)), inEffect = when => at(when).active.map(e => `${e.name}${e.counties.includes('Dallas') ? '' : ' (not Dallas)'}`);
  same(inEffect('2021-02-15T12:00:00Z'), ['Winter Storm Warning', 'Wind Chill Warning', 'Hard Freeze Warning']);
  same(inEffect('2022-12-23T06:00:00Z'), ['Wind Chill Advisory', 'Hard Freeze Warning'], 'in the order they began');
  same(inEffect('2023-02-01T18:00:00Z'), ['Winter Storm Warning (not Dallas)', 'Ice Storm Warning'], 'the counties still under the first product, and those moved to the second');
  same(inEffect('2025-02-19T12:00:00Z'), ['Extreme Cold Warning']); same(inEffect('2026-11-13T18:00:00Z'), []);
  const jan = at('2026-01-26T12:00:00Z');
  assert.equal(jan.season, 2025); assert.equal(jan.days, 7, 'days so far, not the days still ahead'); assert.equal(jan.fallOver, true);
  same(jan.active, [{ code: 'EC.W', name: 'Extreme Cold Warning', year: 2026, id: 1, begin: '2026-01-25T00:00Z', end: '2026-01-27T15:00Z', date: '2026-01-24', counties: COUNTIES, withdrawn: false }]);
  assert.equal(at('2026-06-30T12:00:00Z').days, 12); assert.equal(at('2026-06-30T12:00:00Z').events.length, 11);
  /* the Central calendar, daylight time included */
  assert.equal(I.localDate(M('2026-11-01 04:59')), '2026-10-31'); assert.equal(I.localDate(M('2026-11-01 05:00')), '2026-11-01'); assert.equal(I.localDate(M('2026-01-25 05:59')), '2026-01-24'); assert.equal(I.localDate(M('2026-01-25 06:00')), '2026-01-25');
  /* a season carries the year of its July 1 */
  assert.equal(I.seasonOf(M('2026-06-30 23:59')), 2025); assert.equal(I.seasonOf(M('2026-07-01 00:00')), 2026); assert.equal(I.seasonAt(new Date('2026-07-01T04:59:00Z')), 2025, 'still June 30 in Dallas'); assert.equal(I.seasonAt(new Date('2026-07-01T05:00:00Z')), 2026);
  /* a season nobody has pulled is unknown */
  const later = at('2027-08-01T12:00:00Z'); assert.equal(later.season, 2027); assert.equal(later.held, false); assert.equal(later.days, null); same(later.events, []);
  /* and every read is safe on nothing */
  for (const nothing of [null, undefined, {}, { events: 'x' }]) { same(I.seasons(nothing), []); assert.equal(I.thisSeason(nothing, NOW).held, false); assert.equal(I.climatology(nothing).seasons, 0); same(Object.keys(I.byCounty(nothing)), COUNTIES); same(I.firstBy(nothing, '11-15'), { n: 0, of: 0 }); }
});

test('definitions: what is a cold hazard day, and which Freeze Warning is the first', () => {
  const L = fresh(), I = L.iem, zones = plain(L.geo.counties.map(c => c.zone));
  const mk = events => ({ v: 1, fetched: '2026-12-10T12:00Z', season: 2026, zones, events, seasons: [2026], office: {}, archiveFrom: '2026-07-01', archiveThrough: '2026-12-10', bad: {}, stale: {} });
  /* The public record of ten winters holds no watch that stayed in effect and no warning cancelled before it began, so these are
     hand made: a Freeze Watch in effect for a morning, a Freeze Warning cancelled the evening before, then a Freeze Warning that ran. */
  const s = I.seasons(mk([[2026, 'FZ.A', 1, M('2026-11-10 06:00'), M('2026-11-10 15:00'), 2], [2026, 'FZ.W', 1, M('2026-11-12 06:00'), M('2026-11-11 22:00'), 2], [2026, 'FZ.W', 2, M('2026-11-17 06:00'), M('2026-11-17 15:00'), 2]]))[0];
  assert.equal(s.events, 3, 'all three were issued'); same(s.byCode, { 'FZ.A': 1, 'FZ.W': 2 });
  assert.equal(s.days, 1, 'a watch is not a hazard day and a cancelled warning has none'); assert.equal(s.firstFreezeWarning, '2026-11-17', 'the cancelled warning is not the first'); same(s.first, { date: '2026-11-10', code: 'FZ.A', name: 'Freeze Watch' }, 'the first product that was in effect');
  /* dates are Central dates from the start to one minute before the end; products that overlap share their days */
  const days = events => I.seasons(mk(events))[0].days;
  assert.equal(days([[2026, 'WS.W', 1, M('2026-12-05 03:00'), M('2026-12-06 06:00'), 2]]), 2, 'Friday 9 pm to midnight Saturday night: Friday and Saturday');
  assert.equal(days([[2026, 'WS.W', 1, M('2026-12-05 03:00'), M('2026-12-06 06:01'), 2]]), 3, 'one minute into Sunday');
  assert.equal(days([[2026, 'WS.W', 1, M('2026-12-05 03:00'), M('2026-12-06 06:00'), 2], [2026, 'EC.W', 1, M('2026-12-05 12:00'), M('2026-12-07 18:00'), 2 | 4]]), 4, 'Friday to Monday, counted once');
  assert.equal(days([[2026, 'FZ.W', 1, M('2026-11-01 04:30'), M('2026-11-01 05:30'), 2]]), 2, 'half past eleven to half past midnight on the night daylight time ends');
  assert.equal(days([[2026, 'ZR.Y', 1, M('2026-12-05 12:00'), M('2026-12-05 18:00'), 2]]), 1, 'an advisory counts, named or not');
  same(I.byCounty(mk([[2026, 'WS.W', 1, M('2026-12-05 03:00'), M('2026-12-06 06:00'), 2], [2026, 'EC.W', 1, M('2026-12-05 12:00'), M('2026-12-07 18:00'), 2 | 4]]), 2026).Denton, { days: 3, events: 1, byCode: { 'EC.W': 1 }, firstFreezeWarning: null });
  /* a product without a name in the table is shown by its code */
  const t = I.thisSeason(mk([[2026, 'ZR.Y', 1, M('2026-12-05 12:00'), M('2026-12-05 18:00'), 2]]), new Date('2026-12-05T13:00:00Z'));
  same(t.active.map(e => [e.code, e.name]), [['ZR.Y', 'ZR.Y']]); assert.equal(t.firstFreezeWarning, null); assert.equal(t.fallOver, false);
  same(L.BY_ID.iem_cold.digest(mk([])), { products: 0, days: 0, firstFreezeWarning: 'none yet', active: 0, seasons: 0 });
  same(L.BY_ID.iem_cold.digest(Object.assign(mk([[2026, 'FZ.W', 1, M('2027-03-16 09:00'), M('2027-03-16 14:00'), 4095]]), { fetched: '2027-03-20T12:00Z' })), { products: 1, days: 1, firstFreezeWarning: 'none in the fall', active: 0, seasons: 0 }, 'a March warning is a late freeze, not a first one');
});

test('climatology: the complete winters, for planning sentences', async () => {
  const L = fresh(), I = L.iem, data = await first(L);
  const c = I.climatology(data);
  same({ seasons: c.seasons, from: c.from, to: c.to, meanDays: c.meanDays, meanEvents: c.meanEvents, n: c.freezeWarningSeasons, median: c.medianFirstFreezeWarning, earliest: c.earliestFirst, latest: c.latestFirst, grade: c.grade },
    { seasons: 10, from: 2016, to: 2025, meanDays: 10.8, meanEvents: 11.7, n: 10, median: '11-05', earliest: '2022-10-19', latest: '2024-11-29', grade: 'C' });
  same(c.firsts.map(f => f.date), ['2022-10-19', '2017-10-28', '2020-10-30', '2019-10-31', '2023-10-31', '2025-11-09', '2018-11-10', '2016-11-19', '2021-11-19', '2024-11-29'], 'earliest in the fall first');
  assert.equal(c.byCode['FZ.W'], 2.3); assert.equal(c.byCode['HZ.W'], 1); assert.equal(c.byCode['WW.Y'], 2.4); assert.equal(c.byCode['CW.Y'], 0.4); assert.equal(c.byCode['WC.Y'], 0.5);
  /* the retired codes counted under the products that replaced them on October 1, 2024 */
  assert.equal(c.renamed['FZ.W'], 3.3); assert.equal(c.renamed['CW.Y'], 0.9); assert.ok(!Object.keys(c.renamed).some(k => /^(HZ|WC)/.test(k)));
  /* "by November 15 in 5 of the last 10 falls" */
  const d = I.climatology(data, { county: 'Dallas' });
  same({ seasons: d.seasons, n: d.freezeWarningSeasons, median: d.medianFirstFreezeWarning, earliest: d.earliestFirst, latest: d.latestFirst, meanDays: d.meanDays }, { seasons: 10, n: 8, median: '11-12', earliest: '2019-10-31', latest: '2020-11-30', meanDays: 7.2 });
  same(I.firstBy(data, '11-15', { county: 'Dallas' }), { n: 5, of: 10 }); same(I.firstBy(data, '11-15'), { n: 7, of: 10 }); same(I.firstBy(data, '10-15'), { n: 0, of: 10 }); same(I.firstBy(data, '12-31'), { n: 10, of: 10 }); same(I.firstBy(data, '12-31', { county: 'Dallas' }), { n: 8, of: 10 });
  assert.equal(I.monthDay(c.medianFirstFreezeWarning), 'November 5'); assert.equal(I.monthDay('2026-11-17'), 'November 17'); assert.equal(I.monthDay(null), '');
  assert.equal(I.climatology(data, { county: 'Nowhere' }).seasons, 0); assert.equal(I.climatology(data, { county: 'Nowhere' }).meanDays, null);
  /* a winter still running is never averaged in */
  const d2 = (await run(L, service({ 2026: FREEZE }), data, new Date('2026-11-23T12:00:00Z'))).data; same(I.climatology(d2).seasons, 10); assert.equal(I.climatology(d2).meanEvents, 11.7);
});

test('failure modes: a failed running season fails the run and the last good record stays', async () => {
  const L = fresh(), base = await first(L);
  for (const prev of [null, base]) {
    await assert.rejects(() => run(L, service({ 2026: { status: 500, body: 'Internal Server Error' } }), prev), /HTTP 500 from mesonet\.agron\.iastate\.edu/);
    await assert.rejects(() => run(L, service({ 2026: ERROR_PAGE }), prev), /did not send the cold hazard table: got a web page instead/);
    await assert.rejects(() => run(L, service({ 2026: '' }), prev), /got an empty file instead/);
    await assert.rejects(() => run(L, service({ 2026: '\n \n' }), prev), /got an empty file instead/);
    await assert.rejects(() => run(L, service({ 2026: 'ERROR: something else\n' }), prev), /got text that starts "ERROR: something else" instead/);
    await assert.rejects(() => run(L, service({ 2026: EMPTY.replace('utc_expire', 'expires') }), prev), /no longer has the column utc_expire/);
    await assert.rejects(() => run(L, service({ 2026: new Error('fetch failed') }), prev), /fetch failed/);
    /* a table whose rows no longer parse is not read as "nothing was issued" */
    await assert.rejects(() => run(L, service({ 2026: FREEZE.replace(/(\d{4})-(\d\d)-(\d\d) (\d\d:\d\d)/g, '$2/$3/$1 $4') }), prev), /could not be read: 10 of 10 rows did not parse/);
  }
  /* empty is a real answer only with the header row */
  assert.equal((await run(L, service({ 2026: EMPTY }), base)).data.events.length, 147);
  /* nothing was asked of the archive when the running season failed on a first run */
  const f = service({ 2026: { status: 503, body: '' } }); await assert.rejects(() => run(L, f)); assert.equal(f.calls.length, 1);
  /* through the runner: the record keeps its data and says what went wrong, in words that can sit in a page */
  const store = L.memoryStore(), opt = { scope: ['iem_cold'], store, env: 'node', force: true, now: () => NOW, http: { gapMs: 0, backoffMs: 1, retries: 0 } };
  const ok = await L.refresh(Object.assign({ fetch: service() }, opt)); same(ok.ran, ['iem_cold']);
  let rec = await store.get(L.K.src('iem_cold')); assert.equal(rec.ok, true); assert.equal(rec.n, 11); assert.equal(rec.data.events.length, 147); same(rec.digest, { products: 0, days: 0, firstFreezeWarning: 'none yet', active: 0, seasons: 10 }); assert.ok(JSON.stringify(rec).length < 10240);
  const bad = await L.refresh(Object.assign({ fetch: service({ 2026: ERROR_PAGE }) }, opt)); same(bad.failed.map(x => x.id), ['iem_cold']);
  rec = await store.get(L.K.src('iem_cold')); assert.equal(rec.ok, false); assert.equal(rec.data.events.length, 147); assert.match(rec.err.msg, /got a web page instead/); assert.ok(!/[<>]/.test(rec.err.msg));
});

test('failure modes: a failed winter ends the archive pulls for this run and is asked for again next time', async () => {
  const L = fresh(), I = L.iem, full = await first(L);
  const f1 = service({ 2021: { status: 500, body: 'Internal Server Error' } }), part = (await run(L, f1)).data;
  same(asked(f1), [2026, 2025, 2024, 2023, 2022, 2021], 'no more requests after the first failure');
  same(part.seasons, range(2022, 2026)); same(part.stale, { 2016: null, 2017: null, 2018: null, 2019: null, 2020: null, 2021: null }); assert.match(part.staleWhy, /^HTTP 500 from mesonet\.agron\.iastate\.edu$/); assert.equal(part.archiveFrom, '2022-07-01');
  same(part.events, full.events.filter(e => I.seasonOf(e[3]) >= 2022)); assert.equal(I.climatology(part).seasons, 4); assert.equal(L.BY_ID.iem_cold.digest(part).seasons, 4);
  same(I.byCounty(part, 2019).Dallas.days, null, 'a winter that is missing is unknown, not zero');
  /* an answer that is not the table counts as a failure too */
  const f1b = service({ 2023: ERROR_PAGE }), partB = (await run(L, f1b)).data; same(asked(f1b), [2026, 2025, 2024, 2023]); same(partB.seasons, [2024, 2025, 2026]); assert.match(partB.staleWhy, /got a web page instead/); assert.ok(!/[<>]/.test(partB.staleWhy));
  /* the next run asks for the running season and the six that are missing, and the archive is whole */
  const f2 = service(), done = (await run(L, f2, part, new Date('2026-11-20T18:00:00Z'))).data;
  same(asked(f2), [2026, 2021, 2020, 2019, 2018, 2017, 2016]); same(done.seasons, range(2016, 2026)); same(done.stale, {}); assert.equal(done.staleWhy, undefined); same(done.events, full.events); assert.equal(done.archiveFrom, '2016-07-01');
  /* and the one after that is back to a single request */
  const f3 = service(); await run(L, f3, done, new Date('2026-11-27T18:00:00Z')); same(asked(f3), [2026]);
});

test('July: the season that just ended is pulled once more and the archive grows by a winter', async () => {
  const L = fresh(), I = L.iem, base = await first(L);
  const nov = (await run(L, service({ 2026: FREEZE }), base, new Date('2026-11-16T22:00:00Z'))).data;
  const july = new Date('2027-07-06T12:00:00Z'), f = service({ 2026: FREEZE }), d = (await run(L, f, nov, july)).data;
  same(asked(f), [2027, 2026]); assert.equal(d.season, 2027); same(d.seasons, range(2016, 2027)); same(d.stale, {}); assert.equal(d.archiveFrom, '2016-07-01'); assert.equal(d.archiveThrough, '2027-07-06');
  same(d.events, nov.events, 'the oldest winter stays although it is now the eleventh'); same(L.BY_ID.iem_cold.digest(d), { products: 0, days: 0, firstFreezeWarning: 'none yet', active: 0, seasons: 11 }); assert.equal(I.climatology(d).seasons, 11);
  const f1 = service(); await run(L, f1, d, new Date('2027-07-13T12:00:00Z')); same(asked(f1), [2027], 'closed seasons are not asked for again');
  /* the closing pull fails: the rows held are kept, marked with the date they run through, and asked for again */
  const g = service({ 2026: { status: 500, body: 'x' } }), s = (await run(L, g, nov, july)).data;
  same(asked(g), [2027, 2026]); same(s.stale, { 2026: '2026-11-16' }); same(s.seasons, range(2016, 2027)); same(s.events, nov.events); assert.match(s.staleWhy, /HTTP 500/);
  const h = service({ 2026: FREEZE }), again = (await run(L, h, s, new Date('2027-07-13T12:00:00Z'))).data; same(asked(h), [2027, 2026]); same(again.stale, {}); assert.equal(again.staleWhy, undefined);
  /* a record that was left alone for two years catches up on both winters it missed */
  const k = service(); const late = (await run(L, k, base, new Date('2028-09-01T12:00:00Z'))).data; same(asked(k), [2028, 2027, 2026]); same(late.seasons, range(2016, 2028));
});

test('a record in another shape, or for another list of zones, is pulled again from the start', async () => {
  const L = fresh(), base = await first(L);
  for (const prev of [Object.assign({}, base, { zones: base.zones.slice().reverse() }), Object.assign({}, base, { v: 0 }), { events: 'x' }, {}]) { const f = service(); const d = (await run(L, f, prev)).data; assert.equal(f.calls.length, 11); same(d.events, base.events); }
});
