import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { context, load, fakeFetch, same, plain, ROOT, APP } from './helpers/load.mjs';

/* Every fixture is the city's own answer, recorded 2026-11-13 by running the collector against the live service and keeping
   only the rows (tests/fixtures/README.md). Three recordings:
     fortworth-*        the Fort Worth collector on the day, clock 2026-11-13
     fortworth-2012-*   the same collector with the clock set to 2013-01-05, when the city still wrote down the work
     irving-*           the shared collector on the City of Irving file with the clock set to 2025-03-05, a week after that
                        file stopped: the one local feed that says what was installed, so it exercises the heating counts */
const fx = n => JSON.parse(readFileSync(join(ROOT, 'tests', 'fixtures', 'permits', n), 'utf8'));
const set = p => ({ months: fx(p + '-months-2026-11-13.json'), multi: p === 'irving' ? null : fx(p + '-multi-2026-11-13.json'), zips: fx(p + '-zips-2026-11-13.json') });
const FW = set('fortworth'), FW12 = set('fortworth-2012'), IR = set('irving'), IR_ROWS = fx('irving-rows-2026-11-13.json');
const REFUSED = fx('arcgis-error-statistics-2026-11-13.json'), NO_SUCH = fx('arcgis-error-invalid-url-2026-11-13.json');
const T0 = new Date('2026-11-13T18:40:00Z'), T2012 = new Date('2013-01-05T18:00:00Z'), T_IRVING = new Date('2025-03-05T18:00:00Z');
const FW_LAYER = 'https://services5.arcgis.com/3ddLCBXe1bRt7mzj/arcgis/rest/services/CFW_Open_Data_Development_Permits_View/FeatureServer/0';
const IRVING = { city: 'Irving', layer: 'https://services3.arcgis.com/OfsJXUlu8pSkbl7B/arcgis/rest/services/Residential_Permits_Issued_Feb_15_2022_Present/FeatureServer/0', date: 'Issued_Date', zip: 'SUBSTRING(Address, CHAR_LENGTH(Address) - 4, 5)', id: null, desc: 'Project_Description', blank: [], base: "Permit_Type = 'Mechanical Standalone'", residentialOnly: true, what: 'Residential mechanical permits pulled outside a building permit.' };

const fresh = () => load(context(), 'live/core.js', 'live/geo.js', 'live/permits.js', 'live/sources/permits_fortworth.js').TDA_LIVE;
const params = c => Object.fromEntries(new URLSearchParams(c.init.body));
/* which of the three queries a request is: by month, the permits on several rows (the only one with a having clause), by ZIP code */
const kind = init => { const p = new URLSearchParams(init.body); return p.get('having') ? 'multi' : /^EXTRACT/.test(p.get('groupByFieldsForStatistics') || '') ? 'months' : 'zips'; };
const serve = (answers, over) => fakeFetch([[/\/FeatureServer\/0\/query$/, (url, init, calls) => { const k = kind(init), a = over && k in over ? over[k] : answers[k]; return typeof a === 'function' ? a(init, calls) : a; }]]);
const runWith = async (L, run, fetch, now, prev) => { const http = L.makeHttp({ fetch, gapMs: 0, backoffMs: 1, retries: 0 }); return { data: await run({ http, now, prev: prev || null, geo: L.geo, settings: {}, env: 'node' }), http }; };
const fortWorth = (L, fetch, now, prev) => runWith(L, L.BY_ID.permits_fortworth.run, fetch, now || T0, prev);
const irving = (L, fetch, now, prev) => runWith(L, c => L.permits.arcgis.run(IRVING, c), fetch, now || T_IRVING, prev);
const sha = s => createHash('sha256').update(s).digest('hex').slice(0, 16);
const byMonthOfYear = (months, k) => Array.from({ length: 12 }, (_, i) => months.filter(m => +m.m.slice(5) === i + 1).reduce((s, m) => s + m[k], 0));

test('dates: the day in Dallas Fort Worth, a permit\'s day as the cities store it, and windows anchored on the latest permit', () => {
  const P = fresh().permits;
  assert.equal(P.today(new Date('2026-12-01T03:00:00Z')), '2026-11-30', 'nine in the evening on the 30th in Dallas');
  assert.equal(P.today(new Date('2026-07-01T04:59:00Z')), '2026-06-30'); assert.equal(P.today(new Date('2026-07-01T05:00:00Z')), '2026-07-01', 'daylight time');
  assert.equal(P.day(1794528000760), '2026-11-13', 'Fort Worth: midnight UTC of the permit day, plus a few milliseconds');
  assert.equal(P.day(1740636000000), '2025-02-27', 'Irving: local midnight, written as 06:00 UTC'); assert.equal(P.day(1719810000000), '2024-07-01', 'and 05:00 UTC in summer');
  assert.equal(P.day('2026-01-01'), '2026-01-01', 'a date only field'); assert.equal(P.day(null), null); assert.equal(P.day('soon'), null); assert.equal(P.day(NaN), null);
  assert.equal(P.addMonths('2026-01', -1), '2025-12'); assert.equal(P.addMonths('2025-12', 1), '2026-01'); assert.equal(P.addMonths('2026-11', -40), '2023-07'); assert.equal(P.addMonths('2026-11', 0), '2026-11');
  assert.equal(P.addDays('2026-03-01', -1), '2026-02-28'); assert.equal(P.addDays('2024-03-01', -1), '2024-02-29'); assert.equal(P.addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(P.monthKey(2026, 3), '2026-03'); assert.equal(P.monthKey(2026, 13), null); assert.equal(P.monthKey(null, 3), null); assert.equal(P.monthKey(2026, undefined), null);
  const W = P.windows('2026-11-13');
  same(W, { cur: '2026-11', last: '2026-10', z0: '2025-11-01', z1: '2026-11-01', r0: '2026-09-19', r1: '2026-11-13', y0: '2025-09-20', y1: '2025-11-14' });
  const days = (a, b) => (Date.parse(b) - Date.parse(a)) / 864e5, dow = d => new Date(d + 'T12:00:00Z').getUTCDay();
  assert.equal(days(W.r0, W.r1) + 1, 56, 'eight weeks, both ends counted'); assert.equal(days(W.y0, W.y1) + 1, 56);
  assert.equal(dow(W.r0), dow(W.y0), 'the same weeks a year earlier start on the same weekday, so both hold the same working days'); assert.equal(days(W.y1, W.r1), 364);
  same(P.windows('2026-01-02'), { cur: '2026-01', last: '2025-12', z0: '2025-01-01', z1: '2026-01-01', r0: '2025-11-08', r1: '2026-01-02', y0: '2024-11-09', y1: '2025-01-03' }, 'across a year end');
  assert.equal(P.zipOf(76179), '76179'); assert.equal(P.zipOf('75063-1234'), '75063'); assert.equal(P.zipOf(' 75063 '), '75063'); assert.equal(P.zipOf(null), null); assert.equal(P.zipOf('TX 75'), null); assert.equal(P.zipOf(0), null); assert.equal(P.zipOf('00000'), null); assert.equal(P.zipOf(760011), null);
});

test('the heating rule reads the cities\' own wording', () => {
  const P = fresh().permits;
  /* descriptions as written on Irving permits 2022 to 2025, Fort Worth permits 2008 to 2012 and 2026 permits of Plano, Carrollton and Denton */
  const heat = ['REPLACE 5 TON FURN ONLY', 'Replace gas furnace', 'REPLACE 3 TON HP/AH', '3 TON HP', 'AIR HANDLER W/HEAT KIT', 'CHANGE OUT HEATING AND AIR \r\n\r\nCONDITIONING EQUIPMENT', '35K BTU WALL FURNACE', 'INSTALL 2 UNIT HEATERS', 'BOILER CHANGE OUT', 'REPLACE A/C HEAT IN RESIDENTIAL\r\n\r\n4.0 TON GAS\r\n\r\nJA', 'Replace complete 3.5 ton heat pump system', 'Install (1) Lennox Elite EL17XC1(3-ton) 17 Series single speed airconditioning with single speed gasfurnace', 'Replace 3 ton heat pump-no ductwork', '4001 prestonwood dr, replace furnace only', 'INSTALLED 4 TON AIR HANDLER WITH 15KW HEATER STRIPS.'];
  const notHeat = ['REPLACE WATER HEATER IN ATTIC', 'REPLACED 50 GAL ELECTRIC WATER HEATER IN LAUNDRY ROOM', 'Hvac Swap Out', 'REPLACE 5 TON CONDENSER ONLY', 'PREFAB METAL FIREPLACES', 'REPLACE 3 TON GAS AC', 'replacing a 4 ton gas complete system', 'REPLACE 4 TON AIR HANDLER ONLY', 'REPLACING 12 DUCT RUNS', '', null, undefined];
  for (const t of heat) assert.equal(P.isHeat(t), true, t); for (const t of notHeat) assert.equal(P.isHeat(t), false, String(t));
  /* words that hold HEAT without being heat (not seen in these files yet; a street and a business are the likely places) */
  for (const t of ['RTU REPLACEMENT AT MOVIE THEATER', '4521 WHEATLAND RD CONDENSER', 'HEATHERSTONE DR COIL', 'POOL HEATER', 'HEAT PUMP WATER HEATER', '5 HP EXHAUST FAN MOTOR']) assert.equal(P.isHeat(t), false, t);
  assert.equal(P.isHeat('TANKLESS WATER HEATER AND FURNACE'), true, 'a furnace named beside a water heater still counts');
  const only = ['REPLACE FURNACE', 'Replacing furnace only', 'REPLACE 5 TON FURN ONLY', '35K BTU WALL FURNACE', 'INSTALL 2 UNIT HEATERS', 'CHANGE OUT GAS FURNACE', 'BOILER CHANGE OUT', 'REPLACING 4 TON FURNACE ONLY', 'INSTALL 3 TON 60K HORIZ GAS FURNACE'];
  const notOnly = ['REPLACE FURNACE AND COIL ONLY', 'Condenser, Furnace and Evaporator.', 'REPLACE 3 TON HP/AH', 'Replace complete 3.5 ton heat pump system', 'AIR HANDLER W/HEAT KIT', 'CHANGE OUT HEATING AND AIR \r\n\r\nCONDITIONING EQUIPMENT', 'FURNACE AND OUTDOOR UNIT CHANGEOUT', 'CHANGE OUT 12.5 TON AC/HEAT', 'HEAT AND AIR', 'HVAC REPLACEMENT - 4 TON 14 SEER GAS FURNACE HORIZONTAL COMPLETE SYSTEM', 'REPLACE WATER HEATER IN ATTIC', 'Hvac Swap Out', null];
  for (const t of only) assert.equal(P.isHeatOnly(t), true, t); for (const t of notOnly) assert.equal(P.isHeatOnly(t), false, String(t));
  assert.equal(P.isDescribed('Replace furnace', ['B1_WORK_DESC']), true); for (const t of [null, '', '   ', 'B1_WORK_DESC']) assert.equal(P.isDescribed(t, ['B1_WORK_DESC']), false, String(t));
  for (const p of [].concat(P.RULE.heat, [P.RULE.word], P.RULE.not, P.RULE.cool, P.RULE.whole)) { assert.ok(!/[%_\['"\\]/.test(p), 'no SQL wildcard or quote in "' + p + '"'); assert.equal(p, p.toUpperCase()); }
});

test('the rule gives the same counts in the page as it did as SQL on the city\'s server', () => {
  const P = fresh().permits, mine = {};
  for (const r of IR_ROWS) { const m = P.day(r.Issued_Date).slice(0, 7), b = mine[m] || (mine[m] = { n: 0, ds: 0, ht: 0, ho: 0 }); b.n++; b.ds += +P.isDescribed(r.Project_Description, []); b.ht += +P.isHeat(r.Project_Description); b.ho += +P.isHeatOnly(r.Project_Description); }
  const theirs = {}; for (const a of P.arcgis.rows(IR.months)) theirs[P.monthKey(a.EXPR_1, a.EXPR_2)] = { n: a.n, ds: a.ds, ht: a.ht, ho: a.ho };
  same(Object.keys(mine).sort(), ['2024-07', '2025-01'], 'every Irving mechanical permit of a summer month and a winter month');
  same(mine['2024-07'], { n: 72, ds: 72, ht: 10, ho: 0 }); same(mine['2025-01'], { n: 28, ds: 28, ht: 11, ho: 9 });
  same(mine['2024-07'], theirs['2024-07'], 'July 2024: the server counted the same'); same(mine['2025-01'], theirs['2025-01'], 'January 2025: the server counted the same');
  /* the SQL is the rule and nothing else: one LIKE per pattern on the padded, upper cased text */
  const x = "CONCAT(CONCAT(' ', UPPER(d)), ' ')", h = P.heatSql('d'), o = P.heatOnlySql('d');
  assert.equal(h.split(' LIKE ').length - 1, P.RULE.heat.length + 1 + P.RULE.not.length); assert.equal(o.split(' LIKE ').length - 1, P.RULE.heat.length + 1 + P.RULE.not.length + P.RULE.cool.length + P.RULE.whole.length);
  assert.ok(h.startsWith(`((${x} LIKE '%FURNACE%' OR ${x} LIKE '% FURN %' OR `)); assert.ok(h.endsWith(`OR ((${x} LIKE '%HEAT%') AND NOT (${x} LIKE '%WATER HEAT%' OR ${x} LIKE '%POOL HEAT%' OR ${x} LIKE '%THEAT%' OR ${x} LIKE '%WHEAT%' OR ${x} LIKE '%HEATH%')))`));
  assert.ok(o.startsWith('(' + h + ' AND NOT (')); for (const p of P.RULE.cool.concat(P.RULE.whole)) assert.ok(o.includes(`${x} LIKE '%${p}%'`), p);
  assert.equal(P.describedSql('B1_WORK_DESC', ['B1_WORK_DESC']), "(B1_WORK_DESC IS NOT NULL AND B1_WORK_DESC <> '' AND B1_WORK_DESC NOT IN ('B1_WORK_DESC'))");
  assert.equal(P.describedSql('d'), "(d IS NOT NULL AND d <> '')"); assert.equal(P.describedSql('d', ["it's"]), "(d IS NOT NULL AND d <> '' AND d NOT IN ('it''s'))");
});

test('rows: a statistics answer, and the refusals ArcGIS sends with HTTP 200', () => {
  const A = fresh().permits.arcgis;
  assert.equal(A.rows(FW.months).length, 41); same(A.rows(FW.months)[0], { n: 599, mx: 1690761600000, ds: 10, ht: 2, ho: 0, EXPR_1: 2023, EXPR_2: 7 });
  same(A.rows({ features: [] }), []); same(A.rows({ features: [{}, null] }), [{}, {}]);
  assert.throws(() => A.rows(REFUSED), /refused the query: 400 'outStatistics' parameter is invalid/); assert.throws(() => A.rows(NO_SUCH), /refused the query: 400 Invalid URL/);
  for (const bad of [null, undefined, 'x', {}, { features: 'x' }]) assert.throws(() => A.rows(bad), /sent no (answer|rows)/);
  assert.equal(A.form({ where: "a = 'b' AND c >= 1", outStatistics: [A.stat('count', 'd', 'n')], skip: null, empty: '', resultOffset: 200, f: 'json' }), "where=a%20%3D%20'b'%20AND%20c%20%3E%3D%201&outStatistics=%5B%7B%22statisticType%22%3A%22count%22%2C%22onStatisticField%22%3A%22d%22%2C%22outStatisticFieldName%22%3A%22n%22%7D%5D&resultOffset=200&f=json");
  same(A.sumIf('x > 1', 'k'), { statisticType: 'sum', onStatisticField: 'CASE WHEN x > 1 THEN 1 ELSE 0 END', outStatisticFieldName: 'k' }); assert.equal(A.maxIf('x > 1', 'k').statisticType, 'max');
});

test('the record builder any source can use: complete months, gaps, a partial first month, permits on several rows, the half described rule', () => {
  const P = fresh().permits;
  /* hand made counts: five months of a small city whose latest permit is dated May 14 */
  const months = { '2026-01': { n: 10, ds: 10, ht: 4, ho: 2 }, '2026-02': { n: 8, ds: 2, ht: 1, ho: 1 }, '2026-04': { n: 6, ds: 6, ht: 0, ho: 0 }, '2026-05': { n: 3, ds: 3, ht: 1, ho: 1 } };
  const extra = [{ x: 2, d: '2026-01-20', zip: '75001', ds: 1, ht: 1, ho: 0 }, { x: 1, d: '2026-05-02', zip: '75002', ds: 1, ht: 0, ho: 0 }];
  const r = P.record({ city: 'Sampleton', asked: '2026-01', through: '2026-05-14', months, extra, told: true, what: 'w', residentialOnly: true });
  same(r.months, [{ m: '2026-01', mech: 8, heat: 2, heatOnly: 2 }, { m: '2026-02', mech: 8, heat: null, heatOnly: null }, { m: '2026-03', mech: 0, heat: 0, heatOnly: 0 }, { m: '2026-04', mech: 6, heat: 0, heatOnly: 0 }],
    'January loses the two rows too many and their heating flag; February has a description on 2 permits in 8, so its heating is unknown; March had no permit and the city does describe its work, so zero; May is still filling');
  same({ v: r.v, city: r.city, through: r.through, described: r.described, multi: r.multi, residentialOnly: r.residentialOnly, what: r.what, stale: r.stale, byZip12: r.byZip12, zipMonths: r.zipMonths, recent: r.recent, rule: r.rule }, { v: 1, city: 'Sampleton', through: '2026-05-14', described: { n: 16, of: 22 }, multi: { permits: 2, rows: 3 }, residentialOnly: true, what: 'w', stale: [], byZip12: null, zipMonths: null, recent: null, rule: P.RULE_TEXT });
  same(months['2026-01'], { n: 10, ds: 10, ht: 4, ho: 2 }, 'the caller\'s counts are not changed');
  assert.equal(P.record({ city: 'S', asked: '2025-12', through: '2026-05-14', months, extra, told: true }).months[0].m, '2026-02', 'asked from December and answered from January: the file begins inside the window, so its first month may be partial and is left out');
  const silent = P.record({ city: 'S', asked: '2026-01', through: '2026-05-14', months, extra: null, told: false });
  assert.ok(silent.months.every(x => x.heat === null && x.heatOnly === null)); assert.equal(silent.described, null); assert.equal(silent.multi, null); assert.equal(silent.months[0].mech, 10);
  same(P.record({ city: 'S', asked: '2026-01', through: '2026-05-14', months: { '2026-05': { n: 3 } }, told: true }).months, [], 'only the month in progress: nothing complete yet');
  const long = {}; for (let i = 0; i < 50; i++) long[P.addMonths('2022-06', i)] = { n: i + 1, ds: i + 1, ht: 1, ho: 0 };
  const kept = P.record({ city: 'S', asked: '2022-06', through: '2026-08-03', months: long, told: true }).months; assert.equal(kept.length, P.KEEP); assert.equal(kept[35].m, '2026-07'); assert.equal(kept[0].m, '2023-08');
  /* the ZIP table and the two windows: May 14 back eight weeks is March 20; the 12 complete months are May 2025 to April 2026 */
  const z = P.addZips(r, [{ zip: '75001', n12: 14, d12: 13, h12: 5, nr: 4, dr: 4, hr: 1, ny: 5, dy: 5, hy: 2 }, { zip: 75002, n12: 6, d12: 6, h12: 1, nr: 5, dr: 5, hr: 1, ny: 0, dy: 0, hy: 0 }, { zip: '75001-2233', n12: 2, d12: 2, h12: 0, nr: 0, dr: 0, hr: 0, ny: 0, dy: 0, hy: 0 }, { zip: null, n12: 1, d12: 0, h12: 0, nr: 1, dr: 0, hr: 0, ny: 0, dy: 0, hy: 0 }, { zip: '75009', n12: 0, d12: 0, h12: 0, nr: 0, dr: 0, hr: 0, ny: 2, dy: 2, hy: 1 }], extra);
  assert.equal(z, r, 'the record itself is filled in'); same(r.byZip12, { '75001': [14, 3], '75002': [6, 1] }, 'ZIP plus four folds into the ZIP code (14 + 2 rows, 5 heating), the two January rows too many leave 75001 with their heating flag, and a ZIP code with no permit in the 12 months is not listed'); same(r.zipMonths, ['2025-05', '2026-04']);
  same(r.recent, { weeks: 8, from: '2026-03-20', to: '2026-05-14', mech: 9, heat: 2, sameWeeksLastYear: { from: '2025-03-21', to: '2025-05-15', mech: 7, heat: 3 } }, 'the May row too many leaves the recent weeks; the permit with no ZIP code still counts in them');
  const none = P.addZips(P.record({ city: 'S', asked: '2026-01', through: '2026-05-14', months, told: false }), [{ zip: '75001', n12: 14, h12: 5, nr: 4, hr: 1, ny: 5, hy: 2 }], null); same(none.byZip12, { '75001': [14, null] }); assert.equal(none.recent.heat, null); assert.equal(none.recent.sameWeeksLastYear.heat, null);
  same(P.addZips(P.record({ city: 'S', asked: '2026-01', through: '2026-05-14', months, told: true }), [], null).recent.mech, 0);
  /* the ZIP query failed */
  const k = P.keepZips(P.record({ city: 'S', asked: '2026-01', through: '2026-05-14', months, told: true }), { byZip12: { '75001': [9, 1] }, zipMonths: ['2025-04', '2026-03'], recent: { weeks: 8, mech: 3 } }, new Error('HTTP 500 from example'));
  same({ byZip12: k.byZip12, zipMonths: k.zipMonths, recent: k.recent, stale: k.stale, err: k.err }, { byZip12: { '75001': [9, 1] }, zipMonths: ['2025-04', '2026-03'], recent: { weeks: 8, mech: 3 }, stale: ['byZip12', 'recent'], err: 'HTTP 500 from example' });
  const k0 = P.keepZips(P.record({ city: 'S', asked: '2026-01', through: '2026-05-14', months, told: true }), null, 'x'); same({ byZip12: k0.byZip12, recent: k0.recent, stale: k0.stale, err: k0.err }, { byZip12: null, recent: null, stale: ['byZip12', 'recent'], err: 'x' });
  assert.equal(P.month(new Date('2026-12-01T03:00:00Z')), '2026-11'); assert.equal(P.LOOKBACK, 40); assert.equal(P.WEEKS, 8); assert.equal(P.MIN_DESC, 0.5);
});

test('Fort Worth: three form posts, the exact queries, and the record', async () => {
  const L = fresh(), P = L.permits, fetch = serve(FW);
  const { data, http } = await fortWorth(L, fetch);
  assert.equal(http.stats.n, 3); assert.ok(fetch.calls.every(c => c.url === FW_LAYER + '/query' && c.init.method === 'POST' && c.init.headers['Content-Type'] === 'application/x-www-form-urlencoded' && c.init.credentials === 'omit' && c.init.cache === 'no-store' && !('User-Agent' in c.init.headers)));
  same(fetch.calls.map(c => kind(c.init)), ['months', 'multi', 'zips']);
  /* the fixtures are the answers to exactly these requests */
  same(fetch.calls.map(c => sha(c.init.body)), ['1c2e912b6238aea3', 'bf1a6f3867036a15', '35585fc02f6e56be'], 'a request changed: record the Fort Worth fixtures again');
  const [m, d, z] = fetch.calls.map(params), base = "Permit_Type = 'Mechanical' AND Permit_SubType = 'Standalone' AND Current_Status NOT IN ('Void', 'Withdrawn')";
  assert.equal(m.where, base + " AND File_Date >= DATE '2023-07-01' AND File_Date < DATE '2026-11-15'", '40 months back from the month in Dallas, up to tomorrow');
  assert.equal(m.groupByFieldsForStatistics, 'EXTRACT(YEAR FROM File_Date),EXTRACT(MONTH FROM File_Date)'); assert.equal(m.orderByFields, m.groupByFieldsForStatistics); assert.equal(m.f, 'json'); assert.equal(m.having, undefined);
  same(JSON.parse(m.outStatistics).map(s => s.statisticType + ':' + s.outStatisticFieldName), ['count:n', 'max:mx', 'sum:ds', 'sum:ht', 'sum:ho']);
  assert.equal(JSON.parse(m.outStatistics)[3].onStatisticField, `CASE WHEN ${P.heatSql('B1_WORK_DESC')} THEN 1 ELSE 0 END`); assert.equal(JSON.parse(m.outStatistics)[0].onStatisticField, 'File_Date');
  assert.equal(d.where, m.where); assert.equal(d.groupByFieldsForStatistics, 'Permit_No,Zip_Code'); assert.equal(d.having, 'COUNT(File_Date) > 1'); assert.equal(d.orderByFields, 'Permit_No'); assert.equal(d.resultOffset, undefined);
  same(JSON.parse(d.outStatistics).map(s => s.statisticType + ':' + s.outStatisticFieldName), ['count:n', 'min:d', 'max:ds', 'max:ht', 'max:ho']);
  assert.equal(z.where, base + " AND File_Date >= DATE '2025-09-20' AND File_Date < DATE '2026-11-14'", 'from the start of the same weeks last year through the latest permit'); assert.equal(z.groupByFieldsForStatistics, 'Zip_Code'); assert.equal(z.orderByFields, 'Zip_Code');
  const zs = JSON.parse(z.outStatistics); same(zs.map(s => s.outStatisticFieldName), ['n12', 'nr', 'ny', 'd12', 'h12', 'dr', 'hr', 'dy', 'hy']);
  assert.equal(zs[0].onStatisticField, "CASE WHEN File_Date >= DATE '2025-11-01' AND File_Date < DATE '2026-11-01' THEN 1 ELSE 0 END"); assert.equal(zs[1].onStatisticField, "CASE WHEN File_Date >= DATE '2026-09-19' AND File_Date < DATE '2026-11-14' THEN 1 ELSE 0 END"); assert.equal(zs[2].onStatisticField, "CASE WHEN File_Date >= DATE '2025-09-20' AND File_Date < DATE '2025-11-15' THEN 1 ELSE 0 END");
  /* the record */
  assert.equal(data.v, 1); assert.equal(data.city, 'Fort Worth'); assert.equal(data.through, '2026-11-13'); assert.equal(data.residentialOnly, false); same(data.stale, []); assert.equal(data.err, undefined); assert.equal(data.rule, P.RULE_TEXT); assert.match(data.what, /outside a building permit/);
  assert.equal(data.months.length, 36); same(data.months.map(x => x.m), Array.from({ length: 36 }, (_, i) => P.addMonths('2023-11', i)), 'the 36 complete months, oldest first: November 2026 is still filling');
  same(data.months.slice(-3), [{ m: '2026-08', mech: 513, heat: null, heatOnly: null }, { m: '2026-09', mech: 445, heat: null, heatOnly: null }, { m: '2026-10', mech: 371, heat: null, heatOnly: null }]); same(data.months[0], { m: '2023-11', mech: 310, heat: null, heatOnly: null });
  same(data.described, { n: 69, of: 4610 }, 'the city wrote the work on 69 of 4,610 permits, so heating stays unknown, never zero'); assert.ok(data.months.every(x => x.heat === null && x.heatOnly === null));
  /* a permit on several parcels fills several rows: each counts once */
  same(data.multi, { permits: 430, rows: 623 });
  const raw = P.arcgis.rows(FW.months).find(a => a.EXPR_1 === 2026 && a.EXPR_2 === 8).n, extra = P.arcgis.rows(FW.multi).filter(a => P.day(a.d).slice(0, 7) === '2026-08').reduce((s, a) => s + a.n - 1, 0);
  assert.equal(raw, 576); assert.equal(extra, 63); assert.equal(data.months.find(x => x.m === '2026-08').mech, raw - extra, 'August 2026: 576 rows, 513 permits (one permit alone fills 36 rows)');
  assert.equal(Object.keys(data.byZip12).length, 43); assert.ok(Object.keys(data.byZip12).every(k => /^\d{5}$/.test(k)), 'the rows with no ZIP code are in the totals and not in the table'); same(data.zipMonths, ['2025-11', '2026-10']);
  same(data.byZip12['76244'], [449, null]); same(data.byZip12['76107'], [278, null]); same(data.byZip12['76164'], [48, null], '83 rows in ZIP code 76164, 48 permits');
  const zipSum = Object.values(data.byZip12).reduce((s, v) => s + v[0], 0), last12 = data.months.slice(-12).reduce((s, x) => s + x.mech, 0); assert.equal(last12, 4610); assert.equal(zipSum, 4563, 'the ZIP table is the same 12 months less the 47 permits with no ZIP code');
  same(data.recent, { weeks: 8, from: '2026-09-19', to: '2026-11-13', mech: 673, heat: null, sameWeeksLastYear: { from: '2025-09-20', to: '2025-11-14', mech: 499, heat: null } });
  const g = L.BY_ID.permits_fortworth.digest(plain(data));
  same(g, { mech12: 4610, heat12: null, yoyPct: 13.6, through: '2026-11-13', zips: 43 }); same(Object.keys(g), Object.keys(L.BY_ID.permits_fortworth.labels));
  const size = JSON.stringify(data).length; assert.ok(size < 6000, 'the stored record stays small: ' + size); assert.ok(!/<\/script/i.test(JSON.stringify(data)));
});

test('the clock sets what is asked for; the latest permit sets which months are complete', async () => {
  const L = fresh(), P = L.permits;
  /* 9 pm on November 30 in Dallas is already December 1 in UTC: the month asked for is the Dallas one */
  const late = serve(FW); await fortWorth(L, late, new Date('2026-12-01T03:00:00Z'));
  assert.match(params(late.calls[0]).where, /File_Date >= DATE '2023-07-01' AND File_Date < DATE '2026-12-02'$/);
  const dec = serve(FW); await fortWorth(L, dec, new Date('2026-12-01T07:00:00Z')); assert.match(params(dec.calls[0]).where, /File_Date >= DATE '2023-08-01' AND File_Date < DATE '2026-12-03'$/);
  /* a feed that runs late: the same answer without its November rows, so the latest permit is October 30 */
  const rows = P.arcgis.rows(FW.months).filter(a => !(a.EXPR_1 === 2026 && a.EXPR_2 === 11)), lagging = serve({ months: { features: rows.map(a => ({ attributes: a })) }, multi: FW.multi, zips: FW.zips });
  const { data } = await fortWorth(L, lagging);
  assert.equal(data.through, '2026-10-30'); assert.equal(data.months[data.months.length - 1].m, '2026-09', 'October is not complete until the feed holds a November permit'); assert.equal(data.months.length, 36); assert.equal(data.months[0].m, '2023-10');
  same(data.zipMonths, ['2025-10', '2026-09']); assert.equal(data.recent.to, '2026-10-30'); assert.equal(data.recent.from, '2026-09-05');
  const z = params(lagging.calls[2]); assert.match(z.where, /File_Date >= DATE '2025-09-06' AND File_Date < DATE '2026-10-31'$/); assert.ok(JSON.parse(z.outStatistics)[0].onStatisticField.includes("File_Date >= DATE '2025-10-01' AND File_Date < DATE '2026-10-01'"));
  /* a month with no permit at all is a zero, not a gap */
  const holed = serve({ months: { features: P.arcgis.rows(FW.months).filter(a => !(a.EXPR_1 === 2025 && a.EXPR_2 === 2)).map(a => ({ attributes: a })) }, multi: { features: [] }, zips: FW.zips });
  const h = (await fortWorth(L, holed)).data; assert.equal(h.months.length, 36); same(h.months.find(x => x.m === '2025-02'), { m: '2025-02', mech: 0, heat: null, heatOnly: null }); same(h.multi, { permits: 0, rows: 0 });
});

test('a city that says what was installed: heating and heating only by month, ZIP code and week (Irving, as of March 2025)', async () => {
  const L = fresh(), fetch = serve(IR);
  const { data, http } = await irving(L, fetch);
  assert.equal(http.stats.n, 2, 'one row is one permit in this file, so there is no several rows query'); same(fetch.calls.map(c => kind(c.init)), ['months', 'zips']);
  same(fetch.calls.map(c => sha(c.init.body)), ['a4ab6bf2bdef7069', '41a3d6126b077db3'], 'a request changed: record the Irving fixtures again');
  const [m, z] = fetch.calls.map(params);
  assert.equal(m.where, "Permit_Type = 'Mechanical Standalone' AND Issued_Date >= DATE '2021-11-01' AND Issued_Date < DATE '2025-03-07'");
  assert.equal(z.groupByFieldsForStatistics, 'SUBSTRING(Address, CHAR_LENGTH(Address) - 4, 5)', 'no ZIP field: the last five characters of the address'); assert.equal(z.where, "Permit_Type = 'Mechanical Standalone' AND Issued_Date >= DATE '2024-01-05' AND Issued_Date < DATE '2025-02-28'");
  assert.equal(data.through, '2025-02-27'); assert.equal(data.residentialOnly, true); assert.equal(data.multi, null); same(data.stale, []);
  assert.equal(data.months.length, 35); assert.equal(data.months[0].m, '2022-03', 'the file begins on February 15, 2022: its first month is partial and left out'); assert.equal(data.months[34].m, '2025-01', 'February 2025 holds the last permit, so it is not complete');
  same(data.months[34], { m: '2025-01', mech: 28, heat: 11, heatOnly: 9 }); same(data.months.find(x => x.m === '2024-07'), { m: '2024-07', mech: 72, heat: 10, heatOnly: 0 }, 'July: no furnace replaced by itself');
  same(data.described, { n: 511, of: 511 });
  same(data.byZip12, { '75038': [69, 10], '75039': [68, 9], '75060': [73, 9], '75061': [58, 14], '75062': [93, 17], '75063': [150, 31] }); same(data.zipMonths, ['2024-02', '2025-01']);
  same(data.recent, { weeks: 8, from: '2025-01-03', to: '2025-02-27', mech: 46, heat: 13, sameWeeksLastYear: { from: '2024-01-05', to: '2024-02-29', mech: 65, heat: 19 } });
  same(L.permits.digest(plain(data)), { mech12: 511, heat12: 90, yoyPct: -15.7, through: '2025-02-27', zips: 6 });
  /* a file with no ZIP code at all still gives the months and the weeks */
  const noZip = serve({ months: IR.months, zips: { features: [{ attributes: { n12: 511, nr: 46, ny: 65, d12: 511, h12: 90, dr: 46, hr: 13, dy: 65, hy: 19 } }] } });
  const n = await runWith(L, c => L.permits.arcgis.run(Object.assign({}, IRVING, { zip: null }), c), noZip, T_IRVING);
  assert.equal(params(noZip.calls[1]).groupByFieldsForStatistics, undefined); same(n.data.byZip12, {}); assert.equal(n.data.recent.mech, 46); assert.equal(n.data.recent.heat, 13);
});

test('heating is counted only where the city says what was done: under half described is unknown', async () => {
  const L = fresh(), P = L.permits;
  /* the Irving answers with the description emptied on two permits in three */
  const thin = serve({ months: { features: P.arcgis.rows(IR.months).map(a => ({ attributes: Object.assign({}, a, { ds: Math.floor(a.n / 3) }) })) }, zips: { features: P.arcgis.rows(IR.zips).map(a => ({ attributes: Object.assign({}, a, { d12: Math.floor(a.n12 / 3), dr: Math.floor(a.nr / 3), dy: Math.floor(a.ny / 3) }) })) } });
  const { data } = await irving(L, thin);
  assert.ok(data.months.every(x => x.heat === null && x.heatOnly === null)); assert.ok(Object.values(data.byZip12).every(v => v[0] > 0 && v[1] === null)); assert.equal(data.recent.heat, null); assert.equal(data.recent.sameWeeksLastYear.heat, null); assert.equal(data.recent.mech, 46);
  same(P.digest(plain(data)), { mech12: 511, heat12: null, yoyPct: -15.7, through: '2025-02-27', zips: 6 });
  /* when Fort Worth still wrote the work down, the same collector counted heating there */
  const old = await fortWorth(L, serve(FW12), T2012);
  assert.equal(old.data.through, '2013-01-04'); same(old.data.months[0], { m: '2010-01', mech: 254, heat: 51, heatOnly: 28 }); same(old.data.described, { n: 3495, of: 4099 }); same(old.data.multi, { permits: 15, rows: 15 });
  same(P.digest(plain(old.data)), { mech12: 4099, heat12: 575, yoyPct: -2.7, through: '2013-01-04', zips: 33 });
});

test('the measured heating split is the recorded answer, not a remembered number', async () => {
  const L = fresh(), P = L.permits, [ir, fw] = P.REF;
  /* Irving, March 2022 to February 2025: the 36 full months of the city's answer */
  const rows = P.arcgis.rows(IR.months).map(a => ({ m: P.monthKey(a.EXPR_1, a.EXPR_2), mech: a.n, heat: a.ht, heatOnly: a.ho, ds: a.ds })).filter(x => x.m >= ir.from && x.m <= ir.to);
  assert.equal(rows.length, 36); same(ir.mech, byMonthOfYear(rows, 'mech')); same(ir.heat, byMonthOfYear(rows, 'heat')); same(ir.heatOnly, byMonthOfYear(rows, 'heatOnly'));
  same(ir.described, [rows.reduce((s, x) => s + x.ds, 0), rows.reduce((s, x) => s + x.mech, 0)]); assert.equal(ir.city, 'Irving'); assert.equal(ir.residentialOnly, true);
  /* Fort Worth, 2010 to 2012: the collector itself, clock set to January 2013, each permit counted once */
  const { data } = await fortWorth(L, serve(FW12), T2012);
  assert.equal(data.months.length, 36); assert.equal(data.months[0].m, fw.from); assert.equal(data.months[35].m, fw.to);
  same(fw.mech, byMonthOfYear(data.months, 'mech')); same(fw.heat, byMonthOfYear(data.months, 'heat')); same(fw.heatOnly, byMonthOfYear(data.months, 'heatOnly'));
  const inRange = d => d.slice(0, 7) >= fw.from && d.slice(0, 7) <= fw.to, told = P.arcgis.rows(FW12.months).filter(a => inRange(P.monthKey(a.EXPR_1, a.EXPR_2))).reduce((s, a) => s + a.ds, 0) - P.arcgis.rows(FW12.multi).filter(a => inRange(P.day(a.d))).reduce((s, a) => s + (a.n - 1) * a.ds, 0);
  same(fw.described, [told, data.months.reduce((s, x) => s + x.mech, 0)]);
  /* what the two say: about one mechanical permit in seven names heating, one in 25 to 33 is heating alone, and those cluster in the cold months */
  same(P.ref().map(r => [r.city, r.mechTotal, r.heatTotal, r.heatOnlyTotal, r.heatPct, r.heatOnlyPct, r.heatOnlyNovToFebPct]), [['Irving', 1700, 238, 68, 14, 4, 76.5], ['Fort Worth', 12612, 1765, 382, 14, 3, 45.3]]);
  /* fixed references, labeled with their dates wherever they show: neither is a reading of this year */
  same(P.ref().map(r => r.label), ['Irving, March 2022 to February 2025', 'Fort Worth, January 2010 to December 2012']); same(P.summary({}).heatRef.map(r => r.label), plain(P.ref().map(r => r.label)));
  assert.equal(ir.note, 'A fixed reference, not a live reading: the City of Irving stopped publishing this file on 2025-02-28.'); assert.match(fw.note, /^A fixed reference, not a live reading: Fort Worth stopped writing the work on its permits in 2014\.$/);
  for (const r of P.ref()) { assert.equal(r.measured, '2026-11-13'); assert.equal(r.grade, 'B'); assert.equal(r.heatGrade, 'C'); assert.ok(r.label.includes(P.monthName(r.from)) && r.label.includes(P.monthName(r.to))); }
  assert.equal(P.monthName('2025-02'), 'February 2025'); assert.equal(P.monthName('2010-12'), 'December 2010');
  assert.equal(ir.heatOnly.indexOf(Math.max(...ir.heatOnly)), 0, 'January is the month of the furnace in Irving'); assert.equal(fw.heatOnly.indexOf(Math.max(...fw.heatOnly)), 0, 'and in Fort Worth'); assert.equal(ir.mech.indexOf(Math.max(...ir.mech)), 6, 'while all mechanical permits peak in July');
});

test('failures: the months or the several rows query fail the run; the ZIP query alone leaves the months fresh and says what is stale', async () => {
  const L = fresh();
  const refused = serve(FW, { months: REFUSED }); await assert.rejects(() => fortWorth(L, refused), /refused the query: 400 'outStatistics' parameter is invalid/); assert.equal(refused.calls.length, 1, 'nothing more is asked after the first query fails');
  await assert.rejects(() => fortWorth(L, serve(FW, { months: { status: 503, body: 'Service Unavailable' } })), /HTTP 503 from services5\.arcgis\.com/);
  await assert.rejects(() => fortWorth(L, serve(FW, { months: { status: 200, body: '<html><body>Scheduled maintenance</body></html>' } })), /not JSON from services5\.arcgis\.com/);
  await assert.rejects(() => fortWorth(L, serve(FW, { months: { features: [] } })), /the Fort Worth permit file holds no mechanical permit since 2023-07/);
  await assert.rejects(() => fortWorth(L, serve(FW, { months: new Error('socket hang up') })), /socket hang up/);
  const gone = serve(FW, { multi: NO_SUCH }); await assert.rejects(() => fortWorth(L, gone), /refused the query: 400 Invalid URL/); assert.equal(gone.calls.length, 2, 'without the several rows answer the counts would be rows, not permits: no record is better than a wrong one');
  /* the ZIP query fails: with a previous record its ZIP table and recent weeks are kept and marked */
  const good = (await fortWorth(L, serve(FW))).data, prev = plain(good); prev.byZip12 = { '76244': [400, null] }; prev.zipMonths = ['2025-10', '2026-09']; prev.recent = Object.assign({}, prev.recent, { to: '2026-11-06', mech: 600 });
  const part = (await fortWorth(L, serve(FW, { zips: { status: 500, body: '{"error":"x"}' } }), T0, prev)).data;
  same(part.stale, ['byZip12', 'recent']); assert.match(part.err, /HTTP 500/); same(part.byZip12, prev.byZip12); same(part.zipMonths, prev.zipMonths); same(part.recent, prev.recent); same(part.months, plain(good.months), 'the months are this run\'s'); assert.equal(part.through, '2026-11-13');
  same(L.permits.digest(plain(part)), { mech12: 4610, heat12: null, yoyPct: 13.6, through: '2026-11-13', zips: 1 });
  /* and on a first run there is nothing to keep: the blocks are empty, never invented */
  const first = (await fortWorth(L, serve(FW, { zips: REFUSED }))).data;
  same(first.stale, ['byZip12', 'recent']); assert.equal(first.byZip12, null); assert.equal(first.recent, null); assert.equal(first.zipMonths, null); assert.equal(first.months.length, 36); assert.equal(L.permits.digest(plain(first)).zips, null);
});

test('through the runner: a failed week keeps the last good record and says so', async () => {
  const L = fresh(), store = L.memoryStore(); let down = false;
  const fetch = fakeFetch([[/\/query$/, (url, init) => down ? { status: 503, body: 'down' } : FW[kind(init)]]]);
  const opt = { scope: ['permits_fortworth'], store, fetch, env: 'node', force: true, http: { gapMs: 0, backoffMs: 1, retries: 0 } };
  const a = await L.refresh(Object.assign({ now: () => T0 }, opt)); same(a.ran, ['permits_fortworth']); same(a.failed, []);
  const rec = await store.get(L.K.src('permits_fortworth')); assert.equal(rec.ok, true); assert.equal(rec.n, 3); assert.equal(rec.digest.mech12, 4610); assert.ok(rec.bytes > 40000 && rec.bytes < 200000, 'about 56 KB read in a week: ' + rec.bytes);
  down = true; const b = await L.refresh(Object.assign({ now: () => new Date(+T0 + 7 * 864e5) }, opt)); same(b.ran, []); assert.equal(b.failed[0].id, 'permits_fortworth'); assert.match(b.failed[0].msg, /503/);
  const kept = await store.get(L.K.src('permits_fortworth')); assert.equal(kept.ok, false); assert.equal(kept.data.through, '2026-11-13'); assert.equal(kept.data.months.length, 36); assert.match(kept.err.msg, /503/);
});

test('paging: the permits on several rows arrive 1,000 groups at a time', async () => {
  const L = fresh(), all = FW.multi.features, offsets = [];
  const paged = serve(FW, { multi: init => { const off = +(new URLSearchParams(init.body).get('resultOffset') || 0); offsets.push(off); const page = all.slice(off, off + 200); return { features: page, exceededTransferLimit: off + 200 < all.length }; } });
  const { data, http } = await fortWorth(L, paged), whole = (await fortWorth(L, serve(FW))).data;
  same(offsets, [0, 200, 400]); assert.equal(http.stats.n, 5); same(data, plain(whole), 'three pages add up to the single answer');
  assert.equal(params(paged.calls[2]).orderByFields, 'Permit_No', 'pages are cut in permit number order');
  const endless = serve(FW, { multi: () => ({ features: all.slice(0, 50), exceededTransferLimit: true }) });
  await assert.rejects(() => fortWorth(L, endless), /runs past 250 rows/); assert.equal(endless.calls.length, 6, 'five pages, then stop');
});

test('summary: every city merged, a shared ZIP code summed, unknown heating never turned into a number', async () => {
  const L = fresh(), P = L.permits;
  const fw = plain((await fortWorth(L, serve(FW))).data), ir = plain((await irving(L, serve(IR))).data);
  const s = P.summary({ permits_irving: { id: 'permits_irving', ok: true, at: '2025-03-05T18:00:00Z', data: ir }, permits_fortworth: { id: 'permits_fortworth', ok: true, data: fw }, nws_cold: { data: { points: [], months: [] } }, permits_dallas: { data: null }, permits_other: { skipped: { why: 'x' } } });
  same(s.cities.map(c => c.id), ['permits_fortworth', 'permits_irving']); assert.equal(s.through, '2026-11-13', 'the latest permit any city holds; each city carries its own');
  const [a, b] = s.cities;
  same({ city: a.city, through: a.through, last12: a.last12, prior12: a.prior12, yoyPct: a.yoyPct, zips: a.zips, residentialOnly: a.residentialOnly, stale: a.stale, described: a.described }, { city: 'Fort Worth', through: '2026-11-13', last12: { mech: 4610, heat: null, heatOnly: null }, prior12: { mech: 4057, heat: null, heatOnly: null }, yoyPct: 13.6, zips: 43, residentialOnly: false, stale: [], described: { n: 69, of: 4610 } });
  same(a.months, fw.months); same(a.recent, fw.recent); same(a.zipMonths, ['2025-11', '2026-10']);
  same({ city: b.city, last12: b.last12, prior12: b.prior12, yoyPct: b.yoyPct, recent: b.recent.mech + '/' + b.recent.heat }, { city: 'Irving', last12: { mech: 511, heat: 90, heatOnly: 23 }, prior12: { mech: 606, heat: 70, heatOnly: 24 }, yoyPct: -15.7, recent: '46/13' });
  assert.equal(Object.keys(s.byZip).length, 49); assert.equal(s.zips, 49); same(s.byZip['76244'], { city: 'Fort Worth', mech12: 449, heat12: null }); same(s.byZip['75063'], { city: 'Irving', mech12: 150, heat12: 31 });
  assert.equal(s.heatRef.length, 2); assert.equal(s.heatRef[0].heatOnlyNovToFebPct, 76.5);
  same(s.grades, { mech: 'B', heat: 'C' }, 'permit counts are the city\'s own with a known gap; the heating split is a keyword reading of free text'); same(P.GRADES, { mech: 'B', heat: 'C' });
  /* why Fort Worth has no heating count, ready to print wherever the gap shows; Irving, which wrote the work down, needs no note */
  assert.equal(a.heatNote, 'Fort Worth wrote down the work on 69 of 4,610 permits in the last 12 months, too few to tell heating from cooling: the heating count is unknown, not zero.'); assert.equal(b.heatNote, null); assert.equal(a.heatSince, null);
  assert.equal(P.cityView('permits_q', { city: 'Q', months: fw.months, described: null }).heatNote, 'Q does not publish what each permit was for: the heating count is unknown, not zero.'); assert.equal(P.cityView('permits_q', { city: 'Q', months: [] }).heatNote, null);
  /* two cities reach into one ZIP code: it appears once, the counts add (a permit sits in one city's file only), the city with more permits names it, each city's part stays beside the sum, and a known count plus an unknown one is unknown */
  const edge = Object.assign({}, ir, { city: 'Edgecliff', byZip12: { '76134': [100, 12], '75063': [5, 2], '76244': [3, 1] } });
  const t = P.summary({ permits_irving: ir, permits_edge: edge, permits_fortworth: fw });
  same(t.byZip['76134'], { city: 'Edgecliff', mech12: 185, heat12: null, shared: true, parts: [{ city: 'Edgecliff', mech12: 100, heat12: 12 }, { city: 'Fort Worth', mech12: 85, heat12: null }] });
  same(t.byZip['76244'], { city: 'Fort Worth', mech12: 452, heat12: null, shared: true, parts: [{ city: 'Edgecliff', mech12: 3, heat12: 1 }, { city: 'Fort Worth', mech12: 449, heat12: null }] });
  same(t.byZip['75063'], { city: 'Irving', mech12: 155, heat12: 33, shared: true, parts: [{ city: 'Edgecliff', mech12: 5, heat12: 2 }, { city: 'Irving', mech12: 150, heat12: 31 }] });
  same(t.cities.map(c => c.city), ['Edgecliff', 'Fort Worth', 'Irving'], 'data objects are read as well as stored records');
  /* nothing is counted twice: the ZIP count and the permit total of three cities are those of the parts, each ZIP code once */
  assert.equal(t.zips, 49, 'Edgecliff adds no ZIP code of its own: all three of its ZIP codes are shared'); assert.equal(Object.values(t.byZip).filter(z => z.shared).length, 3);
  const total = o => Object.values(o).reduce((x, v) => x + v[0], 0); assert.equal(Object.values(t.byZip).reduce((x, z) => x + z.mech12, 0), total(fw.byZip12) + total(ir.byZip12) + total(edge.byZip12));
  for (const z of Object.values(t.byZip)) if (z.shared) assert.equal(z.parts.reduce((x, q) => x + q.mech12, 0), z.mech12);
  /* the same city under two source ids (an old record beside a new one): only the one with the later permit is read */
  const twice = P.summary({ permits_irving: ir, permits_irving_old: Object.assign({}, ir, { through: '2024-12-31', byZip12: { '75063': [999, 9], '75999': [7, 0] } }) });
  same(twice.cities.map(c => c.id), ['permits_irving']); same(twice.byZip['75063'], { city: 'Irving', mech12: 150, heat12: 31 }); assert.equal(twice.byZip['75999'], undefined); assert.equal(twice.zips, 6);
  same(P.summary({ permits_a: Object.assign({}, ir, { city: ' irving ' }), permits_b: ir }).cities.map(c => c.id), ['permits_a'], 'same city, same latest permit: the first id is kept, and still only one');
  /* a city whose descriptions changed in kind names the month from which its heating counts compare (heatSince) */
  const cut = Object.assign({}, ir, { heatSince: '2024-02' }), c1 = P.cityView('permits_c', cut);
  same({ last12: c1.last12, prior12: c1.prior12, yoyPct: c1.yoyPct, heatSince: c1.heatSince }, { last12: { mech: 511, heat: 90, heatOnly: 23 }, prior12: { mech: 606, heat: null, heatOnly: null }, yoyPct: -15.7, heatSince: '2024-02' }, 'the 12 months since February 2024 keep their heating count; the 12 before it lose theirs, never the permit count');
  assert.equal(c1.heatNote, 'Heating permits in Irving are comparable from February 2024 on, when the city changed how the work is written down: there is no reading against the year before until both years sit after it.');
  const c2 = P.cityView('permits_c', Object.assign({}, ir, { heatSince: '2024-06' })); same(c2.last12, { mech: 511, heat: null, heatOnly: null }); assert.equal(P.digest(Object.assign({}, ir, { heatSince: '2024-06' })).heat12, null);
  assert.equal(c2.heatNote, 'Heating permits in Irving are comparable from June 2024 on, when the city changed how the work is written down: a 12 month count needs 12 complete months since then.');
  same(P.cityView('permits_c', Object.assign({}, ir, { heatSince: '2022-03' })).prior12, { mech: 606, heat: 70, heatOnly: 24 }, 'once both years sit after the month, both are read');
  const holed = P.cityView('permits_h', Object.assign({}, ir, { months: ir.months.map((x, i) => i === 30 ? Object.assign({}, x, { heat: null, heatOnly: null }) : x) })); assert.equal(holed.last12.heat, null); assert.match(holed.heatNote, /^Some of the last 12 months in Irving carry too few descriptions/);
  /* short and empty */
  same(P.summary(null), { cities: [], byZip: {}, zips: 0, through: null, grades: { mech: 'B', heat: 'C' }, heatRef: plain(P.ref()) }); same(P.summary({ permits_x: { data: { city: 'X' } } }).cities, []);
  const young = P.cityView('permits_y', { city: 'Y', through: '2026-05-10', months: fw.months.slice(-14), byZip12: null });
  same({ last12: young.last12.mech, prior12: young.prior12, yoyPct: young.yoyPct, zips: young.zips, recent: young.recent }, { last12: 4610, prior12: null, yoyPct: null, zips: null, recent: null });
  const newer = P.cityView('permits_z', { city: 'Z', months: fw.months.slice(-5) }); assert.equal(newer.last12, null); same(P.digest({ city: 'Z', months: fw.months.slice(-5) }), { mech12: null, heat12: null, yoyPct: null, through: null, zips: null });
});

test('registration: what the Live Data module lists, time limits, and no dash in anything a person reads', async () => {
  const L = fresh(), P = L.permits, s = L.BY_ID.permits_fortworth;
  same({ id: s.id, cadence: s.cadence, cors: s.cors, grade: s.grade, hosts: s.hosts }, { id: 'permits_fortworth', cadence: 'weekly', cors: true, grade: 'B', hosts: ['services5.arcgis.com'] }); assert.equal(s.key, undefined, 'no API key');
  assert.equal(new URL(s.config.layer).host, s.hosts[0]); assert.equal(s.page, 'https://www.arcgis.com/home/item.html?id=d2740f4d746b4bfaa03e25de0376238b'); assert.match(s.terms, /Creative Commons Attribution 4\.0/);
  same(Object.keys(s.labels), ['mech12', 'heat12', 'yoyPct', 'through', 'zips']); same(Object.values(s.labels).map(l => l[1]), ['int', 'int', 'pct', 'text', 'int']);
  same(Object.values(s.labels).map(l => l[0]), ['Mechanical permits, last 12 full months', 'Permits that name heating, last 12 full months', 'Change against the prior 12 months', 'Latest permit date', 'ZIP codes with permits']);
  const view = P.cityView('permits_fortworth', { city: 'Fort Worth', months: [{ m: '2026-10', mech: 3, heat: null, heatOnly: null }], described: { n: 1, of: 3 } });
  const read = [s.name, s.publisher, s.about, s.terms, s.config.what, P.RULE_TEXT, view.heatNote, P.heatNote({ city: 'X', heatSince: '2025-06' }, [{ m: '2025-01', heat: 1 }], { heat: null }, null)].concat(Object.values(s.labels).map(l => l[0]), P.ref().map(r => r.what), P.ref().map(r => r.note), P.ref().map(r => r.label));
  for (const t of read) { assert.ok(t && t.length > 3); assert.ok(!/[\u2010-\u2015\u2212]|[A-Za-z]-[A-Za-z]| - /.test(t), 'a hyphen or dash in: ' + t); }
  assert.ok(s.about.split('. ').length <= 2, 'one or two sentences'); assert.match(s.about, /the city does not record whether a job was heating or cooling\.$/, 'why the heating count of this source is empty, said where the source is listed');
  const manifest = JSON.parse(readFileSync(join(APP, 'manifest.json'), 'utf8')); assert.ok(manifest.host_permissions.includes('https://services5.arcgis.com/*'));
  /* every request gives up inside 30 seconds, is tried at most twice and waits a second for the one before */
  const seen = [], stub = { json: async (url, init) => { seen.push(init); return FW[kind(init)]; } };
  await s.run({ http: stub, now: T0, prev: null, geo: L.geo, settings: {}, env: 'node' });
  assert.equal(seen.length, 3); for (const i of seen) { assert.ok(i.timeoutMs > 0 && i.timeoutMs < 30000, 'time limit ' + i.timeoutMs); assert.ok(i.retries <= 1); assert.ok(i.gapMs >= 1000); }
  assert.ok(s.timeoutMs >= 3 * ((seen[0].retries + 1) * seen[0].timeoutMs + 1000) && s.timeoutMs <= 240000, 'the source limit covers three requests at their slowest: ' + s.timeoutMs);
  /* Irving is not a weekly source: the city last touched its file on 2025-03-12 (newest permit 2025-02-28). Its slot stays the empty
     placeholder it was, registers nothing, and the three Irving years live on as the fixed reference above, labeled with their dates. */
  const slot = join(APP, 'live', 'sources', 'permits_irving.js');
  if (existsSync(slot)) {
    assert.equal(readFileSync(slot, 'utf8'), '/* ==== live/sources/permits_irving.js ==== */\n/* Irving residential mechanical permits: placeholder until the collector lands. */\n');
    const both = load(context(), 'live/core.js', 'live/geo.js', 'live/permits.js', 'live/sources/permits_fortworth.js', 'live/sources/permits_irving.js').TDA_LIVE; same(both.SOURCES.map(x => x.id), ['permits_fortworth']);
  }
  assert.equal(L.BY_ID.permits_irving, undefined); assert.equal(P.ref()[0].city, 'Irving'); assert.equal(P.ref()[0].to, '2025-02');
});
