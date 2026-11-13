import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { context, load, fakeFetch, same, plain, ROOT } from './helpers/load.mjs';

/* Answers recorded from data.texas.gov on 2026-11-13, when the license file was the one uploaded 2026-10-19. The newest
   list is cut to its first 12 rows; the error file is the portal's real answer to a query that names a missing column. */
const raw = n => readFileSync(join(ROOT, 'tests', 'fixtures', 'tdlr', n), 'utf8'), fx = n => JSON.parse(raw(n));
const META = fx('metadata-2026-11-13.json'), COUNTS = fx('counts-by-county-2026-11-13.json'), TEXAS = fx('texas-totals-2026-11-13.json'), ENTRANTS = fx('entrants-by-county-2026-11-13.json'), NEWEST = fx('newest-2026-11-13.json'), NO_COLUMN = raw('error-no-such-column-2026-11-13.json');
const fresh = () => load(context(), 'live/core.js', 'live/geo.js', 'live/sources/tdlr_licenses.js').TDA_LIVE;
const NOW = new Date('2026-11-13T18:40:00Z');                                                // 25 days after the state replaced the file
const pick = (o, k, d) => o && k in o ? o[k] : d;
const routes = o => [['/api/views/metadata/v1/7358-krk7', pick(o, 'meta', META)], ['$select=license_type%2Cbusiness_county', pick(o, 'counts', COUNTS)], ['$select=license_type%2Ccount', pick(o, 'texas', TEXAS)], ['$select=business_county%2Ccount', pick(o, 'entrants', ENTRANTS)], ['$select=license_number', pick(o, 'newest', NEWEST)]];
const runOnce = async (L, fetch, prev, now) => { const http = L.makeHttp({ fetch, gapMs: 0, backoffMs: 1 }); const data = await L.BY_ID.tdlr_licenses.run({ http, now: now || NOW, prev: prev || null, geo: L.geo, settings: {}, env: 'node' }); return { data, http }; };
const qs = u => new URL(u).searchParams;
const IN12 = "business_county in('COLLIN','DALLAS','DENTON','ELLIS','HOOD','HUNT','JOHNSON','KAUFMAN','PARKER','ROCKWALL','TARRANT','WISE')";
const D = 'license_expiration_date_mmddccyy', KEY = `substring(${D},7,4)||substring(${D},1,2)||substring(${D},4,2)`, OKD = `${D} like '__/__/____'`;

test('fileDate: the portal\'s date and the calendar day it was in Texas', () => {
  const L = fresh(), f = L.tdlr.fileDate;
  same(f(META), { asOf: '2026-10-19T18:51:17Z', day: '2026-10-19' });
  same(f({ rowsUpdatedAt: 1792435877 }), { asOf: '2026-10-19T18:51:17Z', day: '2026-10-19' }, 'the older views endpoint gives the same instant in seconds');
  assert.equal(f({ dataUpdatedAt: '2026-11-20T03:10:00+0000' }).day, '2026-11-19', 'an evening upload in Texas is already the next day in UTC');
  for (const bad of [null, {}, { dataUpdatedAt: 'soon' }]) assert.throws(() => f(bad), /did not say when the license file was last updated/);
});

test('subtype: class and endorsement pairs as the file writes them', () => {
  const L = fresh(), s = L.tdlr.subtype;
  same(s('BE'), { classA: false, env: true, refrig: false }); same(s('AE'), { classA: true, env: true, refrig: false });
  same(s('AC'), { classA: true, env: true, refrig: true }); same(s('BC'), { classA: false, env: true, refrig: true });
  same(s('AR'), { classA: true, env: false, refrig: true }); same(s('BR'), { classA: false, env: false, refrig: true });
  same(s('AEBR'), { classA: true, env: true, refrig: true }); same(s('ARBE'), { classA: true, env: true, refrig: true }); same(s('ARBR'), { classA: true, env: false, refrig: true });
  for (const none of [undefined, null, '', 'REG', 'CER']) same(s(none), { classA: false, env: false, refrig: false });
  const seen = [...new Set(COUNTS.filter(r => r.license_type === 'A/C Contractor').map(r => r.license_subtype))].sort();
  same(seen, ['AC', 'AE', 'AEBR', 'AR', 'ARBE', 'BC', 'BE', 'BR'], 'the contractor subtypes in the recorded file');
  for (const c of seen) assert.ok(s(c).env || s(c).refrig, c + ' carries an endorsement');
});

test('queries: counted on the server, every date taken from the file date', () => {
  const L = fresh(), names = L.geo.counties.map(c => c.name), Q = L.tdlr.queries('2026-10-19', names, 156844);
  for (const u of Object.values(Q)) assert.ok(u.startsWith('https://data.texas.gov/resource/7358-krk7.json?$select='), u.slice(0, 70));
  let p = qs(Q.counts);
  assert.equal(p.get('$select'), `license_type,business_county,license_subtype,count(*) as n,sum(case(${OKD} and ${KEY}>='20261019',1,true,0)) as act,sum(case(${OKD} and ${KEY}>='20261019' and ${KEY}<='20270117',1,true,0)) as x90,sum(case(${OKD},0,true,1)) as bad`);
  assert.equal(p.get('$where'), `license_type in('A/C Contractor','A/C Technician') and ${IN12}`);
  same([p.get('$group'), p.get('$order'), p.get('$limit')], ['license_type,business_county,license_subtype', 'license_type,business_county,license_subtype', '1000']);
  p = qs(Q.texas);
  assert.equal(p.get('$select'), `license_type,count(*) as n,sum(case(${OKD} and ${KEY}>='20261019',1,true,0)) as act,max(case(${OKD} and ${KEY}<'20261019',license_number::number)) as n0`);
  same([p.get('$where'), p.get('$group'), p.get('$limit')], ["license_type in('A/C Contractor','A/C Technician')", 'license_type', null]);
  p = qs(Q.entrants);
  same([p.get('$select'), p.get('$where'), p.get('$group')], [`business_county,count(*) as n,min(${KEY}) as lo`, `license_type='A/C Contractor' and ${IN12} and license_number::number>156844`, 'business_county']);
  p = qs(Q.newest);
  same([p.get('$select'), p.get('$where'), p.get('$order'), p.get('$limit')], [`license_number,business_name,business_county,license_subtype,${D}`, `license_type='A/C Contractor' and ${IN12} and license_number::number>156844`, 'license_number::number DESC', '25']);
  const winter = L.tdlr.queries('2026-12-18', names);
  assert.ok(qs(winter.counts).get('$select').includes(`${KEY}>='20261218' and ${KEY}<='20270318'`), '90 days on, across the new year');
  same([winter.entrants, winter.newest], [null, null], 'no number line, no entrant queries');
  assert.ok(Object.values(Q).every(u => u.length < 2000 && !/[ "<>]/.test(u)), 'short, fully encoded URLs');
});

test('parseCounts: the 108 recorded rows become twelve county rows', () => {
  const L = fresh(), r = L.tdlr.parseCounts(COUNTS, L.geo.counties);
  assert.equal(COUNTS.length, 108); assert.equal(r.badDates, 0);
  same(r.counties.map(c => c.name), L.geo.counties.map(c => c.name), 'one row per county, in the order of the geography file');
  same(r.counties.find(c => c.name === 'Dallas'), { name: 'Dallas', fips: '48113', contractors: 1639, classA: 878, comfort: 1581, techs: 3737, certified: 359, expiring90: 272, lapsed: 119, new12: null, contractorsPer10kHomes: null });
  same(r.counties.find(c => c.name === 'Hood'), { name: 'Hood', fips: '48221', contractors: 52, classA: 19, comfort: 50, techs: 104, certified: 5, expiring90: 14, lapsed: 2, new12: null, contractorsPer10kHomes: null });
  const t = k => r.counties.reduce((s, c) => s + c[k], 0), rawSum = (type, k) => COUNTS.filter(x => x.license_type === type).reduce((s, x) => s + +x[k], 0);
  same([t('contractors'), t('classA'), t('comfort'), t('techs'), t('certified'), t('expiring90'), t('lapsed')], [4855, 2529, 4712, 10974, 1083, 805, 337]);
  same([rawSum('A/C Contractor', 'act'), rawSum('A/C Technician', 'act'), rawSum('A/C Contractor', 'n') - rawSum('A/C Contractor', 'act')], [4855, 10974, 337], 'the same totals straight from the rows');
  assert.ok(r.counties.every(c => c.classA <= c.contractors && c.comfort <= c.contractors && c.certified <= c.techs && c.expiring90 <= c.contractors));
});

test('parseCounts refuses an answer it cannot trust', () => {
  const L = fresh(), G = L.geo.counties, p = rows => () => L.tdlr.parseCounts(rows, G);
  assert.throws(p({ message: 'x' }), /not a list/);
  assert.throws(p(Array.from({ length: 1000 }, () => COUNTS[0])), /cut off at 1,000 rows/);
  assert.throws(p([]), /no air conditioning contractor license came back for the 12 counties/);
  assert.throws(p(COUNTS.map(r => Object.assign({}, r, { license_type: r.license_type.replace('A/C', 'Air Conditioning') }))), /license type or county names in the file may have changed/);
  assert.throws(p(COUNTS.map(r => Object.assign({}, r, { business_county: 'HARRIS' }))), /no air conditioning contractor license came back/);
  /* the date column turns to another shape: nothing matches mm/dd/yyyy, so nothing counts as active */
  assert.throws(p(COUNTS.map(r => Object.assign({}, r, { act: '0', x90: '0', bad: r.n }))), /21,211 of 21,211 expiration dates in the license file are not mm\/dd\/yyyy any more/);
  assert.throws(p(COUNTS.map(r => Object.assign({}, r, { act: '0', x90: '0' }))), /no contractor license in the file is active on the file date/);
  const few = COUNTS.map((r, i) => i === 0 ? Object.assign({}, r, { bad: '3' }) : r);
  assert.equal(L.tdlr.parseCounts(few, G).badDates, 3, 'a handful of bad dates is reported, not fatal');
});

test('parseTexas, parseEntrants, parseNewest on the recorded answers', () => {
  const L = fresh(), G = L.geo.counties;
  same(L.tdlr.parseTexas(TEXAS), { contractors: 19123, techs: 41271, n0: 156844 });
  same(L.tdlr.parseTexas([TEXAS[0]]), { contractors: 19123, techs: null, n0: 156844 }); same(L.tdlr.parseTexas([{ license_type: 'A/C Contractor', n: '5', act: '5' }]).n0, null, 'nothing has expired: no number line');
  for (const bad of [null, [], [TEXAS[1]], [{ license_type: 'A/C Contractor', act: '0' }]]) assert.throws(() => L.tdlr.parseTexas(bad), /no Texas total for contractor licenses/);
  const e = L.tdlr.parseEntrants(ENTRANTS, G, '2026-10-19');
  same(e, { by: { Collin: 17, Dallas: 68, Denton: 22, Ellis: 11, Hood: 3, Hunt: 4, Johnson: 12, Kaufman: 9, Parker: 14, Rockwall: 12, Tarrant: 68, Wise: 7 }, total: 247, first: '2026-10-22', ok: true });
  /* had an odd early expiration set the number line two months back, the oldest license above it would expire ten months out */
  const late = L.tdlr.parseEntrants(ENTRANTS.map(r => Object.assign({}, r, { lo: '2027' + r.lo.slice(4) })), G, '2026-10-19');
  same([late.first, late.ok], ['2027-01-07', false]); same(L.tdlr.parseEntrants([], G, '2026-10-19').ok, false); same(L.tdlr.parseEntrants(null, G, '2026-10-19').total, 0);
  const n = L.tdlr.parseNewest(NEWEST, G, '2026-10-19');
  assert.equal(n.length, 12); same(n[0], { no: 169943, name: 'FATE HEATING & AIR', county: 'Rockwall', sub: 'AE', comfort: true, issued: '2026-10-16' });
  assert.ok(n.every((x, i) => i === 0 || n[i - 1].no > x.no), 'newest first'); assert.ok(n.every(x => x.issued <= '2026-10-19' && x.issued >= '2025-10-19' && x.name.length <= 60 && x.comfort === true));
  const row = (o) => Object.assign({}, NEWEST[0], o), one = o => L.tdlr.parseNewest([row(o)], G, '2026-10-19')[0];
  assert.equal(one({ license_expiration_date_mmddccyy: '11/02/2027' }).issued, '2025-11-02', 'already renewed for the year ahead: issued two years before the expiration');
  assert.equal(one({ license_expiration_date_mmddccyy: '02/29/2028' }).issued, '2026-02-28', 'two years before a leap day, in a year that has none'); assert.equal(one({ license_expiration_date_mmddccyy: 'soon' }).issued, null);
  same([one({ license_subtype: 'BR' }).comfort, one({ business_name: '  <b>A&B</b>\tAIR  ' }).name], [false, 'b A&B /b AIR']);
  same(L.tdlr.parseNewest([row({ business_county: 'HARRIS' }), row({ license_number: 'TEMP-1' })], G, '2026-10-19'), [], 'rows outside the 12 counties or without a plain number are dropped'); same(L.tdlr.parseNewest(null, G, '2026-10-19'), []);
});

test('the collector: five plain GETs when the file is new, the exact queries, a small record', async () => {
  const L = fresh(), fetch = fakeFetch(routes()), { data, http } = await runOnce(L, fetch);
  const Q = L.tdlr.queries('2026-10-19', L.geo.counties.map(c => c.name), 156844);
  same(fetch.calls.map(c => c.url), ['https://data.texas.gov/api/views/metadata/v1/7358-krk7', Q.counts, Q.texas, Q.entrants, Q.newest]); assert.equal(http.stats.n, 5);
  assert.ok(fetch.calls.every(c => c.init.method === 'GET' && c.init.credentials === 'omit' && c.init.cache === 'no-store' && c.init.headers === undefined && c.init.body === undefined), 'no cookies and no custom header, so a web page needs no preflight');
  same({ v: data.v, asOf: data.asOf, asOfDay: data.asOfDay, checked: data.checked, badDates: data.badDates, stale: data.stale }, { v: 1, asOf: '2026-10-19T18:51:17Z', asOfDay: '2026-10-19', checked: '2026-11-13T18:40:00.000Z', badDates: 0, stale: [] });
  same(data.total, { contractors: 4855, classA: 2529, comfort: 4712, techs: 10974, certified: 1083, expiring90: 805, lapsed: 337, new12: 247 });
  same(data.texas, { asOf: '2026-10-19T18:51:17Z', contractors: 19123, techs: 41271 });
  same({ asOf: data.entrants.asOf, after: data.entrants.after, from: data.entrants.from, total: data.entrants.total, newest: data.entrants.newest.length }, { asOf: '2026-10-19T18:51:17Z', after: 156844, from: '2025-10-19', total: 247, newest: 12 });
  same(data.counties.map(c => [c.name, c.fips, c.contractors, c.new12]), [['Collin', '48085', 491, 17], ['Dallas', '48113', 1639, 68], ['Denton', '48121', 409, 22], ['Ellis', '48139', 197, 11], ['Hood', '48221', 52, 3], ['Hunt', '48231', 90, 4], ['Johnson', '48251', 187, 12], ['Kaufman', '48257', 174, 9], ['Parker', '48367', 176, 14], ['Rockwall', '48397', 123, 12], ['Tarrant', '48439', 1254, 68], ['Wise', '48497', 63, 7]]);
  assert.ok(data.counties.every(c => c.contractorsPer10kHomes === null), 'the page fills contractors per home from its own housing counts');
  assert.match(data.basis, /^Counted from the TDLR All Licenses file as published on 2026-10-19\. Active: /);
  const g = L.BY_ID.tdlr_licenses.digest(plain(data));
  same({ contractors: g.contractors, techs: g.techs, top: g.top, new12: g.new12, asOf: g.asOf }, { contractors: 4855, techs: 10974, top: 'Dallas (1,639)', new12: 247, asOf: '2026-10-19' });
  same([Object.keys(g.by).length, g.by.Dallas, g.by.Wise], [12, [1639, 3737], [63, 127]]);
  assert.ok(Object.keys(L.BY_ID.tdlr_licenses.labels).every(k => g[k] != null), 'every label has a digest value');
  const size = JSON.stringify(data).length; assert.ok(size < 9000, 'the stored record stays small: ' + size); assert.ok(!/<\/script/i.test(JSON.stringify(data)));
});

test('the same file a week later costs one request; a new file is counted again with its own dates', async () => {
  const L = fresh(), first = plain((await runOnce(L, fakeFetch(routes()))).data);
  const again = fakeFetch(routes()), second = await runOnce(L, again, first, new Date('2026-11-20T12:00:00Z'));
  same(again.calls.map(c => c.url), ['https://data.texas.gov/api/views/metadata/v1/7358-krk7']); same(second.data, Object.assign({}, first, { checked: '2026-11-20T12:00:00.000Z' }));
  const old = fakeFetch(routes()); await runOnce(L, old, Object.assign({}, first, { v: 0 })); assert.equal(old.calls.length, 5, 'a record from another version of the collector is not reused');
  /* the state uploads the November file. The recorded entrant rows belong to October: their first expiration now lies before
     the file date, the self check refuses them, and the block is kept from the last run and named. */
  const f3 = fakeFetch(routes({ meta: Object.assign({}, META, { dataUpdatedAt: '2026-11-19T19:02:44+0000' }) })), third = await runOnce(L, f3, first, new Date('2026-11-20T12:00:00Z'));
  assert.equal(f3.calls.length, 4, 'file date, counts, Texas totals, entrants by county; the newest list is not asked for once the check fails');
  same([third.data.asOf, third.data.asOfDay, third.data.texas.asOf], ['2026-11-19T19:02:44Z', '2026-11-19', '2026-11-19T19:02:44Z']);
  assert.ok(qs(f3.calls[1].url).get('$select').includes(`${KEY}>='20261119' and ${KEY}<='20270217'`) && qs(f3.calls[2].url).get('$select').includes(`${KEY}<'20261119',license_number::number)) as n0`), 'active, expiring and the number line all count from the new file date');
  assert.match(third.data.basis, /published on 2026-11-19\./);
  same(third.data.stale.map(s => [s.block, s.kept]), [['entrants', '2026-10-19T18:51:17Z']]); assert.match(third.data.stale[0].why, /license numbers above 156844 do not span a year \(first expiration 2026-10-22\)/);
  same(third.data.entrants, first.entrants); assert.equal(third.data.total.new12, 247);
});

test('partial failure: the county counts stand, the block that failed is kept from the last run and named', async () => {
  const L = fresh(), first = plain((await runOnce(L, fakeFetch(routes()))).data);
  const down = () => fakeFetch(routes({ texas: { status: 500, body: 'x' } }));
  const cold = await runOnce(L, down());
  assert.equal(cold.http.stats.n, 4, 'file date, counts and two tries at the Texas totals; without the number line the entrants are not asked for');
  same([cold.data.total.contractors, cold.data.total.techs, cold.data.total.new12, cold.data.texas, cold.data.entrants], [4855, 10974, null, null, null]); assert.ok(cold.data.counties.every(c => c.new12 === null));
  same(cold.data.stale.map(s => [s.block, s.kept]), [['texas', null], ['entrants', null]]); assert.match(cold.data.stale[0].why, /HTTP 500 from data\.texas\.gov/); assert.match(cold.data.stale[1].why, /did not give the license number/);
  const g = L.BY_ID.tdlr_licenses.digest(plain(cold.data)); same([g.contractors, g.new12, g.top], [4855, null, 'Dallas (1,639)']);
  /* with a run of the September file behind it, the September blocks are kept and dated */
  const sep = '2026-09-19T20:58:00Z', older = Object.assign({}, first, { asOf: sep, asOfDay: '2026-09-19', texas: Object.assign({}, first.texas, { asOf: sep }), entrants: Object.assign({}, first.entrants, { asOf: sep }) });
  const warm = await runOnce(L, down(), older);
  same([warm.data.asOfDay, warm.data.texas, warm.data.entrants.asOf, warm.data.total.new12], ['2026-10-19', older.texas, sep, 247]); same(warm.data.stale.map(s => [s.block, s.kept]), [['texas', sep], ['entrants', sep]]);
  /* the next run heals it: a record with stale blocks is counted again even though the file date has not moved */
  const heal = fakeFetch(routes()), healed = await runOnce(L, heal, plain(warm.data)); assert.equal(heal.calls.length, 5); same(healed.data.stale, []); same(healed.data.entrants.asOf, '2026-10-19T18:51:17Z');
  const noList = await runOnce(L, fakeFetch(routes({ newest: { status: 500, body: 'x' } })));
  same([noList.data.texas.contractors, noList.data.entrants, noList.data.stale.map(s => s.block)], [19123, null, ['entrants']]);
});

test('nothing usable: the run throws and says why', async () => {
  const L = fresh(), fails = (o, re) => assert.rejects(() => runOnce(L, fakeFetch(o)), re);
  await fails([[/./, { status: 503, body: 'down' }]], /HTTP 503 from data\.texas\.gov/);
  await fails(routes({ meta: { id: '7358-krk7', name: 'TDLR - All Licenses' } }), /did not say when the license file was last updated/);
  await fails(routes({ counts: { status: 400, body: NO_COLUMN } }), /the license file no longer has the column license_kind, so licenses by county could not be counted/);
  await fails(routes({ counts: { status: 400, body: '{"message":"Invalid SoQL query"}' } }), /the Texas Open Data Portal refused the query for licenses by county/);
  await fails(routes({ counts: '<html>maintenance</html>' }), /not JSON from data\.texas\.gov/);
  await fails(routes({ counts: [] }), /no air conditioning contractor license came back for the 12 counties/);
  await fails(routes({ counts: { status: 429, body: 'slow down' } }), /HTTP 429 from data\.texas\.gov/);
});

test('reads: contractors per 10,000 homes from the page\'s own housing counts, and what moved since the last digest', async () => {
  const L = fresh(), data = plain((await runOnce(L, fakeFetch(routes()))).data);
  const by = L.tdlr.byCounty(data, { Dallas: 1000000, 48085: 400000 });
  same(Object.keys(by), L.geo.counties.map(c => c.name));
  same([by.Dallas.contractorsPer10kHomes, by.Collin.contractorsPer10kHomes, by.Tarrant.contractorsPer10kHomes], [16.4, 12.3, null], 'by county name or by FIPS code; unknown where the page gave no homes');
  same([by.Dallas.techsPerContractor, by.Dallas.contractors, by.Dallas.new12], [2.3, 1639, 68]); assert.ok(Math.abs(by.Dallas.newShare - 68 / 1639) < 1e-12);
  assert.equal(L.tdlr.byCounty(data).Dallas.contractorsPer10kHomes, null); same(L.tdlr.byCounty(null), {}); assert.equal(data.counties[1].contractorsPer10kHomes, null, 'the stored record is not touched');
  const digest = plain(L.BY_ID.tdlr_licenses.digest(data));
  same(L.tdlr.change(data, digest), { fileChanged: false, from: '2026-10-19', to: '2026-10-19', contractors: 0, techs: 0, new12: 0, counties: [] });
  const before = plain(digest); before.asOf = '2026-09-19'; before.contractors -= 12; before.techs += 30; before.new12 = null; before.by.Dallas = [1630, 3767]; before.by.Hood = [55, 104];
  same(L.tdlr.change(data, before), { fileChanged: true, from: '2026-09-19', to: '2026-10-19', contractors: 12, techs: -30, new12: null, counties: [{ name: 'Dallas', contractors: 9, techs: -30 }, { name: 'Hood', contractors: -3, techs: 0 }] });
  same([L.tdlr.change(data, null), L.tdlr.change(null, digest), L.tdlr.change(data, {})], [null, null, null]);
  same([L.tdlr.ageDays(data, NOW), L.tdlr.ageDays(data, '2026-10-19T19:00:00Z'), L.tdlr.ageDays(null, NOW)], [24, 0, null]);
});

test('registration: one host, weekly, grade A, plain words', async () => {
  const L = fresh(), s = L.BY_ID.tdlr_licenses, data = (await runOnce(L, fakeFetch(routes()))).data;
  same({ hosts: s.hosts, cadence: s.cadence, cors: s.cors, grade: s.grade }, { hosts: ['data.texas.gov'], cadence: 'weekly', cors: true, grade: 'A' }); assert.equal(s.key, undefined);
  assert.match(s.page, /^https:\/\/data\.texas\.gov\//); assert.ok(Object.values(s.labels).every(l => l.length === 2 && ['int', 'text'].includes(l[1])));
  for (const t of [s.name, s.about, s.publisher, s.terms, data.basis, ...Object.values(s.labels).map(l => l[0])]) assert.ok(!/[A-Za-z0-9][-‐-―][A-Za-z0-9]|\s[-‐-―]\s/.test(t), 'no hyphen or dash between words: ' + t);
});
