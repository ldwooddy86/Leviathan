import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { context, load, fakeFetch, same, plain, ROOT, APP } from './helpers/load.mjs';

/* Every fixture was recorded on 2026-11-13 from www.dallasopendata.com, dataset e7gq-4sah, inside one daily load of the file
   (Last-Modified 12:08:08 GMT), and is kept as the city sent it unless a cut is named (tests/fixtures/README.md):
     newest-, months-, zips-          the three answers of a weekly run on that day
     descriptions-                    the 400 most common descriptions of a year of residential mechanical permits with the two flags the
                                      city's server computed from the shared heating rule, cut to the top 60 and every one flagged heating
     research-p1-months-              the research's own query by month (its own keyword columns), whole
     research-p2-zip-months-          the research's own query by ZIP code and month, cut to the 12 complete months and the columns both carry
     soql-error-no-such-function-     the body of an HTTP 400 the portal sent for a function it does not have */
const DIR = join(ROOT, 'tests', 'fixtures', 'permits_dallas'), fx = n => JSON.parse(readFileSync(join(DIR, n), 'utf8'));
const A = { newest: fx('newest-2026-11-13.json'), months: fx('months-2026-11-13.json'), zips: fx('zips-2026-11-13.json') };
const DESC = fx('descriptions-2026-11-13.json'), P1 = fx('research-p1-months-2026-11-13.json'), P2 = fx('research-p2-zip-months-2026-11-13.json'), REFUSED = readFileSync(join(DIR, 'soql-error-no-such-function-2026-11-13.json'), 'utf8');
const FW = { months: 'fortworth-months-2026-11-13.json', multi: 'fortworth-multi-2026-11-13.json', zips: 'fortworth-zips-2026-11-13.json' }; for (const k in FW) FW[k] = JSON.parse(readFileSync(join(ROOT, 'tests', 'fixtures', 'permits', FW[k]), 'utf8'));
const T0 = new Date('2026-11-13T23:50:00Z');                                     /* ten to six in the evening in Dallas, on the day of the recording */
const DAYK = 'substring(issued_date,7,2)||substring(issued_date,1,2)||substring(issued_date,4,2)', BOTH = "permit_type in ('Residential Mechanical Permit','Residential Plumbing Permit')";

const fresh = (...more) => load(context(), 'live/core.js', 'live/geo.js', 'live/permits.js', 'live/sources/permits_dallas.js', ...more).TDA_LIVE;
const q = u => Object.fromEntries(new URL(u).searchParams);
/* which of the three requests a URL is: the newest date (one row), the ZIP codes, the months */
const kind = u => { const s = q(u).$select || ''; return /^max\(/.test(s) ? 'newest' : /^zip_code as z/.test(s) ? 'zips' : 'months'; };
const serve = over => fakeFetch([[/^https:\/\/www\.dallasopendata\.com\/resource\/e7gq-4sah\.json\?/, (url, init, calls) => { const k = kind(url), a = over && k in over ? over[k] : A[k]; return typeof a === 'function' ? a(url, calls) : a; }]]);
const runWith = async (L, fetch, now, prev) => { const http = L.makeHttp({ fetch, gapMs: 0, backoffMs: 1 }); return { data: await L.BY_ID.permits_dallas.run({ http, now: now || T0, prev: prev || null, geo: L.geo, settings: {}, env: 'node' }), http }; };
const dallas = async (L, over, now, prev) => (await runWith(L, serve(over), now, prev)).data;
const sha = s => createHash('sha256').update(s).digest('hex').slice(0, 16);
const rows = (list, fn) => list.map(r => fn(Object.assign({}, r)) || null).filter(Boolean);
const aliases = select => select.match(/ as (\w+)/g).map(s => s.slice(4));

test('three requests a week: the exact URLs for a given day, and they are the requests the fixtures answer', async () => {
  const L = fresh(), D = L.permitsDallas, fetch = serve();
  const { http } = await runWith(L, fetch);
  assert.equal(http.stats.n, 3); same(fetch.calls.map(c => kind(c.url)), ['newest', 'months', 'zips']);
  /* plain GET requests with no header of ours: no preflight from a page, and nothing that names the caller */
  assert.ok(fetch.calls.every(c => c.url.startsWith('https://www.dallasopendata.com/resource/e7gq-4sah.json?') && c.init.method === 'GET' && c.init.headers === undefined && c.init.body === undefined && c.init.credentials === 'omit' && c.init.cache === 'no-store'));
  same(fetch.calls.map(c => sha(c.url)), ['3c1c9fe4b51a516a', '4e132b4a378ba3c9', 'd5e0a0a01cb5b52a'], 'a request changed: record the Dallas fixtures again');
  const [n, m, z] = fetch.calls.map(c => q(c.url));
  same(n, { $select: `max(${DAYK}) as kmax,count(*) as n`, $where: `permit_type='Residential Mechanical Permit' AND (${DAYK})<='261114'` }, 'up to tomorrow in Dallas, so a mistyped future date cannot move the windows');
  same(Object.keys(m), ['$select', '$where', '$group', '$order', '$limit']);
  assert.equal(m.$where, `(substring(issued_date,7,2)||substring(issued_date,1,2))>='2405' AND ${BOTH}`, 'from May 2024, the first month in which the file holds every permit');
  assert.equal(m.$group, 'ym'); assert.equal(m.$order, 'ym'); assert.equal(m.$limit, '200'); same(aliases(m.$select), ['ym', 'm', 'md', 'mh', 'mo', 'p', 'pgt', 'pgr', 'zn', 'n']);
  const M = "permit_type='Residential Mechanical Permit'", PL = "permit_type='Residential Plumbing Permit'", U = 'upper(work_description)';
  assert.ok(m.$select.startsWith(`'20'||substring(issued_date,7,2)||'-'||substring(issued_date,1,2) as ym,sum(case(${M},1,true,0)) as m,sum(case(${M} AND work_description IS NOT NULL,1,true,0)) as md,sum(case(${M} AND ${D.soql.HEAT},1,true,0)) as mh,sum(case(${M} AND ${D.soql.HEAT} AND NOT ${D.soql.COOL},1,true,0)) as mo,sum(case(${PL},1,true,0)) as p,`));
  assert.ok(m.$select.endsWith(`sum(case(${PL} AND (${U} like '%GAS TEST%' OR ${U} like '%GAS PRESSURE TEST%' OR ${U} like '%GAS RELEASE%' OR ${U} like '%METER RELEASE%'),1,true,0)) as pgt,sum(case(${PL} AND (${U} like '%GAS LEAK%' OR ${U} like '%GAS REPAIR%' OR ${U} like '%GAS LINE REPAIR%' OR ${U} like '%GAS REPIPE%' OR ${U} like '%GAS RELAY%' OR ${U} like '%REPAIR GAS%'),1,true,0)) as pgr,count(zip_code) as zn,count(*) as n`));
  assert.equal(z.$where, `(${DAYK})>='250919' AND (${DAYK})<='261112' AND ${BOTH}`, 'from the start of the same weeks last year through the newest permit');
  assert.equal(z.$group, 'z,w'); assert.equal(z.$order, 'z,w'); assert.equal(z.$limit, '5000'); same(aliases(z.$select), ['z', 'w', 'm', 'md', 'mh', 'mf', 'mhp', 'mnc', 'p', 'pgt', 'pgr']);
  assert.ok(z.$select.startsWith(`zip_code as z,case((${DAYK})>='261101','4',(${DAYK})>='260918','3',(${DAYK})>='251114','2',(${DAYK})>='251101','1',true,'0') as w,sum(case(${M},1,true,0)) as m,`), 'five date segments: the weeks of last year before November, the rest of them, the months between, the recent weeks before November, November to date');
  /* 5,345 characters is the longest URL the portal has answered for this collector: a rule that grows it must be tried against the portal first */
  same(fetch.calls.map(c => c.url.length), [418, 5345, 4007]);
  same(fetch.calls.map(c => c.url), [D.q.newest('2026-11-14'), D.q.months('2024-05'), D.q.zips(D.plan('2026-11-12'))], 'the builders are the requests');
});

test('the clock sets what is asked for: the day in Dallas, 40 months back but never before May 2024', async () => {
  const L = fresh();
  const eve = serve(); await runWith(L, eve, new Date('2026-11-14T05:59:00Z')); assert.ok(q(eve.calls[0].url).$where.endsWith("<='261114'"), 'a minute to midnight on the 13th in Dallas');
  const next = serve(); await runWith(L, next, new Date('2026-11-14T06:00:00Z')); assert.ok(q(next.calls[0].url).$where.endsWith("<='261115'")); assert.ok(q(next.calls[1].url).$where.startsWith("(substring(issued_date,7,2)||substring(issued_date,1,2))>='2405' AND "));
  /* in January 2028 the 40 months reach back to September 2024 (the answer served here is the old one, so the run stops at the months gate) */
  const later = serve({ newest: [{ kmax: '280110', n: '25000' }] });
  await assert.rejects(() => runWith(L, later, new Date('2028-01-12T18:00:00Z')), /^Error: the Dallas permit file answered 27 of the 40 months asked for \(2026-12 is missing\)$/);
  assert.ok(q(later.calls[1].url).$where.startsWith("(substring(issued_date,7,2)||substring(issued_date,1,2))>='2409' AND ")); assert.ok(q(later.calls[0].url).$where.endsWith("<='280113'"));
});

test('parsers: the newest permit date, the months and the ZIP codes of the recorded answers', () => {
  const D = fresh().permitsDallas;
  same(D.parseNewest(A.newest), { through: '2026-11-12', rows: 18742 }, 'every value in a Socrata answer is text');
  for (const bad of [[], [{}], null, undefined, 'x', [{ kmax: '2611' }], [{ kmax: '261345' }], [{ kmax: '260230' }], [{ kmax: 'abcdef' }], [{ n: '5' }]]) assert.equal(D.parseNewest(bad).through, null, JSON.stringify(bad));
  assert.equal(D.fromKey('240229'), '2024-02-29'); assert.equal(D.fromKey('250229'), null, 'no February 29 in 2025'); assert.equal(D.fromKey(261112), '2026-11-12'); assert.equal(D.key('2026-11-12'), '261112'); assert.equal(D.fromKey(D.key('2031-01-09')), '2031-01-09');
  const M = D.parseMonths(A.months), ms = Object.keys(M.mech).sort();
  assert.equal(ms.length, 31); same([ms[0], ms[30]], ['2024-05', '2026-11']); same(Object.keys(M.gas).sort(), ms); same(Object.keys(M.fill).sort(), ms);
  same(M.mech['2026-10'], { n: 521, ds: 521, ht: 78, ho: 15 }); same(M.mech['2024-05'], { n: 587, ds: 484, ht: 39, ho: 11 }, 'May 2024: a description on 484 of 587 permits');
  same(M.mech['2026-01'], { n: 437, ds: 437, ht: 113, ho: 35 }, 'January: one permit in four names heating, 35 name nothing else');
  same(M.gas['2025-12'], { tests: 440, repairs: 72, of: 1352 }); same(M.fill['2025-04'], { zn: 59, n: 1226 }); same(M.fill['2025-05'], { zn: 1295, n: 1419 }); same(M.fill['2026-10'], { zn: 1754, n: 1755 });
  same(D.parseMonths([{ ym: '20ab-13', m: '9' }, { ym: '2026-13', m: '9' }, { m: '9' }, null, { ym: '2026-02', m: 'x', p: '7' }]), { mech: { '2026-02': { n: 0, ds: 0, ht: 0, ho: 0 } }, gas: { '2026-02': { tests: 0, repairs: 0, of: 7 } }, fill: { '2026-02': { zn: 0, n: 0 } } }, 'a month key that is no month is dropped; a count that is no number is zero');
  same(D.parseMonths(null), { mech: {}, gas: {}, fill: {} });
  /* the ZIP answer: 231 rows, 51 ZIP codes and the permits with none */
  const pl = D.plan('2026-11-12'), Z = D.parseZips(A.zips, pl);
  assert.equal(A.zips.length, 231); assert.equal(Z.zips, 51); assert.equal(Z.zrows.length, 52); assert.equal(A.zips.filter(r => !('z' in r)).length, 4, 'a row with no ZIP code has no z at all');
  same(Z.zrows.find(r => r.zip === null), { zip: null, n12: 11, d12: 10, h12: 0, nr: 2, dr: 2, hr: 0, ny: 9, dy: 8, hy: 0, f: 0, hp: 0, nb: 2, g12: 4, gr: 0, gy: 2, x12: 2, xr: 0, xy: 1, p12: 27, pr: 3, py: 13 });
  /* ZIP code 75217, by hand from its five rows: the 12 months are segments 1 to 3, the recent weeks 3 and 4, the weeks of last year 0 and 1 */
  same(A.zips.filter(r => r.z === '75217').map(r => [r.w, r.m, r.mh, r.pgt].join(' ')), ['0 18 4 31', '1 2 0 14', '2 193 56 189', '3 27 8 25', '4 3 0 5']);
  const z17 = Z.zrows.find(r => r.zip === '75217'); same([z17.n12, z17.h12, z17.nr, z17.hr, z17.ny, z17.hy, z17.g12, z17.gr, z17.gy], [222, 64, 30, 8, 20, 4, 228, 30, 45]);
  const sum = k => Z.zrows.reduce((s, r) => s + r[k], 0); same([sum('n12'), sum('d12'), sum('h12'), sum('nr'), sum('hr'), sum('ny'), sum('hy')], [6742, 6741, 1067, 964, 144, 954, 119]);
  same(Z.gas.last12, { tests: 2789, repairs: 706, of: 14355 }); same(Z.gas.recent, { tests: 417, repairs: 145, of: 2372 }); same(Z.gas.lastYear, { tests: 635, repairs: 119, of: 2426 });
  same([Z.words.furnace, Z.words.heatPump, Z.words.newBuild], [557, 336, 648]); same(Z.gas.byZip12['75217'], [228, 30, 45]); same(Z.words.byZip12['75241'], [15, 20, 120], '75241: 120 of its 291 permits say new construction');
  /* a ZIP code that is not one of Dallas Fort Worth, or no ZIP code at all, joins the permits with none; ZIP plus four folds in */
  const odd = D.parseZips([{ z: '75201-1234', w: '2', m: '2', md: '2', mh: '1', pgt: '1' }, { z: '75201', w: '3', m: '1', md: '1', mh: '0', pgt: '2' }, { z: '90210', w: '2', m: '5', md: '5', mh: '2', pgt: '3' }, { z: '7520', w: '4', m: '1', md: '1', mh: '1', pgt: '0' }, { z: '00000', w: '2', m: '1', md: '0', mh: '0', pgt: '0' }, { z: '75201', w: '9', m: '50', md: '50', mh: '50', pgt: '50' }, null], pl);
  assert.equal(odd.zips, 1); same(odd.zrows.map(r => [r.zip, r.n12, r.h12, r.nr, r.hr, r.g12, r.gr]), [[null, 6, 2, 1, 1, 3, 0], ['75201', 3, 1, 1, 0, 3, 2]], 'a segment the plan does not know is in no window');
  same(D.parseZips([], pl), { zrows: [], zips: 0, gas: { byZip12: {}, last12: { tests: 0, repairs: 0, of: 0 }, recent: { tests: 0, repairs: 0, of: 0 }, lastYear: { tests: 0, repairs: 0, of: 0 } }, words: { furnace: 0, heatPump: 0, newBuild: 0, byZip12: {} } });
});

test('the record: the shape every city shares, built by the shared helpers, with the Dallas blocks beside it', async () => {
  const L = fresh(), P = L.permits, D = L.permitsDallas, data = plain(await dallas(L));
  same(Object.keys(data), ['v', 'city', 'through', 'months', 'byZip12', 'zipMonths', 'recent', 'described', 'multi', 'rule', 'what', 'residentialOnly', 'stale', 'heatSince', 'zipPct', 'gas', 'words', 'file', 'eras', 'usable', 'coverage'], 'the 13 fields of the shared record first, then what only Dallas has');
  same({ v: data.v, city: data.city, through: data.through, residentialOnly: data.residentialOnly, multi: data.multi, stale: data.stale, rule: data.rule, described: data.described, file: data.file }, { v: 1, city: 'Dallas', through: '2026-11-12', residentialOnly: true, multi: null, stale: [], rule: P.RULE_TEXT, described: { n: 6741, of: 6742 }, file: { rows: 18742 } }); assert.equal(data.err, undefined);
  assert.match(data.what, /^Residential mechanical permits of the City of Dallas: .* new houses included \(about 1 permit in 10 says new construction\)\. One row of the file is one permit\.$/);
  /* the months: May 2024 to October 2026, oldest first; November is still filling */
  assert.equal(data.months.length, 30); same(data.months.map(x => x.m), Array.from({ length: 30 }, (_, i) => P.addMonths('2024-05', i)));
  same(data.months[0], { m: '2024-05', mech: 587, heat: 39, heatOnly: 11 }); same(data.months.slice(-3), [{ m: '2026-08', mech: 692, heat: 125, heatOnly: 7 }, { m: '2026-09', mech: 621, heat: 106, heatOnly: 11 }, { m: '2026-10', mech: 521, heat: 78, heatOnly: 15 }]);
  same(data.months.slice(-12).map(x => x.heatOnly), [22, 36, 35, 16, 11, 8, 7, 10, 6, 7, 11, 15], 'a furnace replaced by itself is winter work: November 2025 to February 2026 hold 109 of the 184');
  /* the ZIP table: the 12 complete months, every one of them inside the months that carry ZIP codes */
  same(data.zipMonths, ['2025-11', '2026-10']); assert.equal(Object.keys(data.byZip12).length, 48); assert.ok(Object.keys(data.byZip12).every(k => /^7[56]\d{3}$/.test(k)));
  same(data.byZip12['75214'], [451, 46]); same(data.byZip12['75217'], [222, 64]); same(data.byZip12['75228'], [251, 36]); same(data.byZip12['75051'], [6, 3]); assert.equal(data.byZip12['75247'], undefined, 'gas tests but no mechanical permit');
  const zipSum = i => Object.values(data.byZip12).reduce((s, v) => s + v[i], 0), last12 = data.months.slice(-12).reduce((s, x) => s + x.mech, 0);
  assert.equal(last12, 6742); assert.equal(zipSum(0), 6731, 'the ZIP table is the same 12 months less the 11 permits with no ZIP code'); assert.equal(zipSum(1), 1067, 'every permit that names heating carries a ZIP code');
  same(data.recent, { weeks: 8, from: '2026-09-18', to: '2026-11-12', mech: 964, heat: 144, sameWeeksLastYear: { from: '2025-09-19', to: '2025-11-13', mech: 954, heat: 119 } });
  /* what only Dallas has */
  assert.equal(data.heatSince, '2025-06'); same(data.zipPct, [2, 2, 2, 3, 3, 4, 3, 4, 6, 7, 7, 5, 91, 100, 100, 99, 100, 99, 99, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100], 'the share of permits with a ZIP code, month by month: the eras, measured');
  same(data.words, Object.assign({ zipMonths: ['2025-11', '2026-10'], furnace: 557, heatPump: 336, newBuild: 648 }, { byZip12: data.words.byZip12 })); assert.equal(Object.keys(data.words.byZip12).length, 48); same(data.words.byZip12['75217'], [15, 44, 36]);
  same(data.usable, { counts: '2024-05', zip: '2025-06', words: '2025-06' }); same(data.eras.map(e => [e.key, e.from, e.to]), [['A', '2018-01', '2021-01'], ['B', '2021-02', '2025-04'], ['C', '2025-05', null]]); assert.match(data.coverage, /^City of Dallas only\. A ZIP code with fewer than 25 permits/);
  /* digest, size, and nothing that could close a script tag */
  const g = L.BY_ID.permits_dallas.digest(data);
  same(g, { mech12: 6742, heat12: 1067, yoyPct: 12.4, gas8w: 417, gas8wLastYear: 635, through: '2026-11-12', zips: 48 }); same(Object.keys(g), Object.keys(L.BY_ID.permits_dallas.labels));
  same(D.digest({ city: 'Dallas', months: [] }), { mech12: null, heat12: null, yoyPct: null, gas8w: null, gas8wLastYear: null, through: null, zips: null });
  const size = JSON.stringify(data).length; assert.ok(size > 5000 && size < 12000, 'the stored record stays small: ' + size); assert.ok(!/<\/script/i.test(JSON.stringify(data)));
});

test('the answers agree with the research queries of the same day, column for column', async () => {
  const L = fresh(), D = L.permitsDallas, data = plain(await dallas(L));
  /* by month: the research counted the same mechanical permits, plumbing permits, gas tests and gas repairs */
  const M = D.parseMonths(A.months), R1 = Object.fromEntries(P1.map(r => [r.ym, r]));
  assert.equal(P1.length, 37, 'the research asked for 36 months back');
  for (const m of Object.keys(M.mech)) same([M.mech[m].n, M.gas[m].of, M.gas[m].tests, M.gas[m].repairs], [+R1[m].m, +R1[m].p, +R1[m].pgt, +R1[m].pgr], m);
  /* why the record starts in May 2024: the six months before it hold a fraction of the permits and no gas test worth the name */
  same(P1.filter(r => r.ym < '2024-05').map(r => [r.ym, +r.m, +r.pgt]), [['2023-11', 66, 0], ['2023-12', 55, 0], ['2024-01', 86, 0], ['2024-02', 107, 0], ['2024-03', 136, 0], ['2024-04', 228, 9]]); assert.equal(+R1['2024-05'].m, 587);
  /* the research measured the ZIP share over three permit types, this collector over two: both see it jump in May 2025 */
  same(['2025-04', '2025-05', '2025-06'].map(m => Math.round(+R1[m].zn / +R1[m].n * 100)), [5, 87, 97]); same(data.zipPct.slice(11, 14), [5, 91, 100]);
  /* by ZIP code: the 12 complete months of the research's ZIP by month answer add up to the ZIP table, the word counts and the gas tests */
  const by = {}; for (const r of P2) { const e = by[r.z || ''] || (by[r.z || ''] = { m: 0, mf: 0, mhp: 0, mnc: 0, pgt: 0, pgr: 0 }); for (const k in e) e[k] += +r[k]; }
  assert.ok(P2.every(r => r.ym >= '2025-11' && r.ym <= '2026-10')); assert.equal(Object.keys(by).filter(z => z).length, 49);
  for (const z of Object.keys(by).filter(z => z)) { const e = by[z]; assert.equal((data.byZip12[z] || [0])[0], e.m, z + ' permits'); same(data.words.byZip12[z] || [0, 0, 0], [e.mf, e.mhp, e.mnc], z + ' words'); assert.equal((data.gas.byZip12[z] || [0])[0], e.pgt, z + ' gas tests'); }
  for (const z of Object.keys(data.byZip12)) assert.ok(by[z], z); for (const z of Object.keys(data.gas.byZip12)) assert.ok(by[z] || data.gas.byZip12[z][0] === 0, z);
  const all = k => Object.values(by).reduce((s, e) => s + e[k], 0); same([all('m'), all('mf'), all('mhp'), all('mnc'), all('pgt'), all('pgr')], [6742, 557, 336, 648, 2789, 706]);
  same([by[''].m, by[''].pgt], [11, 4], 'the permits with no ZIP code');
});

test('the heating rule on Dallas wording: the page and the city\'s server agree on every description', () => {
  const L = fresh(), P = L.permits, D = L.permitsDallas, R = P.RULE;
  const pad = t => ' ' + String(t).toUpperCase() + ' ', coolOrWhole = t => R.cool.concat(R.whole).some(p => pad(t).includes(p));
  assert.equal(DESC.length, 108); assert.equal(DESC.reduce((s, r) => s + +r.n, 0), 1778);
  for (const r of DESC) { const n = +r.n, h = +r.h, c = +r.c; assert.ok((h === 0 || h === n) && (c === 0 || c === n), 'one description, one answer: ' + r.t); assert.equal(P.isHeat(r.t), h > 0, r.t); assert.equal(coolOrWhole(r.t), c > 0, r.t); assert.equal(P.isHeatOnly(r.t), h > 0 && c === 0, r.t); }
  const hot = DESC.filter(r => +r.h > 0), count = l => l.reduce((s, r) => s + +r.n, 0); same([hot.length, count(hot), count(hot.filter(r => +r.c === 0))], [50, 190, 41]);
  same(DESC.slice(0, 3).map(r => [r.t, +r.n, +r.h]), [['hvac replacement', 121, 0], ['New construction residential', 77, 0], ['NEW HVAC', 76, 0]], 'most permits name the whole system, so the heating count is a floor');
  for (const t of ['Replace furnace only.', 'Replace vented wall furnace.', 'REPLACE 3 TON FURN ONLY', 'Furnace replacement']) { assert.ok(DESC.some(r => r.t === t), t); assert.equal(P.isHeatOnly(t), true, t); }
  for (const t of ['Replace 3 ton complete heat pump.', 'SINGLE HEAT PUMP SYSTEM CHANGE OUT', '4-TON CONDENSER W/ 88K BTUS FURNACE CHANGEOUT']) { assert.ok(DESC.some(r => r.t === t), t); assert.equal(P.isHeat(t), true, t); assert.equal(P.isHeatOnly(t), false, t); }
  for (const t of ['Replacing 4 ton gas complete system', 'NEW A/C', 'Install HVAC']) { assert.ok(DESC.some(r => r.t === t), t); assert.equal(P.isHeat(t), false, t + ': a gas system named whole is not counted as heating'); }
  /* the fixture is the answer to this request, built from the strings the collector sends */
  const u = new URL(D.API), prm = { $select: `work_description as t,count(*) as n,sum(case(${D.soql.HEAT},1,true,0)) as h,sum(case(${D.soql.COOL},1,true,0)) as c`, $where: `permit_type='${D.MECH}' AND (${D.soql.DAYK})>='251113'`, $group: 't', $order: 'n DESC,t', $limit: '400' };
  for (const k in prm) u.searchParams.set(k, prm[k]); assert.equal(sha(u.toString()), '68626e92a90f4e63', 'the rule or its SQL changed: record the descriptions again');
  /* the SQL is the rule and nothing else: one LIKE per pattern, on the padded text where the pattern begins or ends with a space */
  assert.equal(D.soql.HEAT.split(' like ').length - 1, R.heat.length + 1 + R.not.length); assert.equal(D.soql.COOL.split(' like ').length - 1, R.cool.length + R.whole.length);
  for (const p of [].concat(R.heat, [R.word], R.not, R.cool, R.whole)) assert.ok((D.soql.HEAT + ' ' + D.soql.COOL).includes((/^ | $/.test(p) ? "(' '||upper(work_description)||' ')" : ' upper(work_description)').trimStart() + ` like '%${p}%'`), p);
  assert.ok(D.soql.HEAT.includes("(' '||upper(work_description)||' ') like '% FURN %'")); assert.ok(D.soql.HEAT.endsWith("OR (upper(work_description) like '%HEAT%' AND NOT (upper(work_description) like '%WATER HEAT%' OR upper(work_description) like '%POOL HEAT%' OR upper(work_description) like '%THEAT%' OR upper(work_description) like '%WHEAT%' OR upper(work_description) like '%HEATH%')))"));
  for (const list of Object.values(D.KW)) for (const p of list) { assert.ok(!/[%_\['"\\]/.test(p), 'no SQL wildcard or quote in "' + p + '"'); assert.equal(p, p.toUpperCase()); assert.equal(p, p.trim()); }
});

test('gas tests: the words, and the block the Heat Desk shows', async () => {
  const L = fresh(), D = L.permitsDallas, data = plain(await dallas(L));
  /* the commonest gas descriptions on residential plumbing permits, as the research listed them */
  for (const t of ['GAS TEST', 'GAS PRESSURE TEST', 'GAS TEST FOR METER RELEASE', 'Gas release', 'gas test and meter release']) assert.equal(D.isGasTest(t), true, t);
  for (const t of ['GAS LINE TO POOL HEATER', 'RELOCATE GAS METER.', 'REPLACING 50 GALLON GAS WATER HEATER', 'RUN GAS LINE TO GENERATOR', 'GAS REPAIR', 'GAS LEAK REPAIR', '', null, undefined]) assert.equal(D.isGasTest(t), false, String(t));
  for (const t of ['GAS REPAIR', 'GAS LEAK REPAIR', 'Repair gas line', 'GAS LINE REPAIR']) assert.equal(D.isGasRepair(t), true, t); for (const t of ['GAS TEST', 'RELOCATE GAS METER.', null]) assert.equal(D.isGasRepair(t), false, String(t));
  /* the block in the record */
  assert.equal(data.gas.months.length, 30); same(data.gas.months.map(x => x.m), data.months.map(x => x.m)); same(data.gas.months[0], { m: '2024-05', tests: 47, repairs: 15, of: 776 }); same(data.gas.months[29], { m: '2026-10', tests: 237, repairs: 62, of: 1234 });
  same(data.gas.months.slice(-12).map(x => x.tests), [393, 440, 283, 214, 211, 148, 141, 167, 168, 188, 199, 237], 'the season: up from September, a peak in December, a floor in May');
  same(data.gas.recent, { weeks: 8, from: '2026-09-18', to: '2026-11-12', tests: 417, repairs: 145, of: 2372, sameWeeksLastYear: { from: '2025-09-19', to: '2025-11-13', tests: 635, repairs: 119, of: 2426 } });
  same(data.gas.zipMonths, ['2025-11', '2026-10']); assert.equal(Object.keys(data.gas.byZip12).length, 46); same(data.gas.byZip12['75217'], [228, 30, 45], '12 months, the last eight weeks, the same weeks last year'); same(data.gas.byZip12['75247'], [2, 0, 1], 'a ZIP code with gas tests and no mechanical permit is in this table only');
  assert.equal(Object.values(data.gas.byZip12).reduce((s, v) => s + v[0], 0), 2785, 'the 2,789 tests of the 12 months less the 4 with no ZIP code');
  /* the read */
  const g = plain(D.gasTests(data));
  same(Object.keys(g), ['city', 'through', 'grade', 'what', 'rule', 'months', 'last12', 'prior12', 'yoyPct', 'comparableFrom', 'note', 'peak', 'recent', 'topZips', 'zips', 'zipMonths', 'stale']);
  same({ city: g.city, through: g.through, grade: g.grade, last12: g.last12, prior12: g.prior12, yoyPct: g.yoyPct, comparableFrom: g.comparableFrom, peak: g.peak, zips: g.zips, zipMonths: g.zipMonths, stale: g.stale },
    { city: 'Dallas', through: '2026-11-12', grade: 'C', last12: { tests: 2789, repairs: 706 }, prior12: null, yoyPct: null, comparableFrom: '2025-06', peak: { m: '2025-12', tests: 440 }, zips: 46, zipMonths: ['2025-11', '2026-10'], stale: [] });
  assert.equal(g.note, 'Gas tests are comparable from June 2025 on, when the city changed how the work is written down: there is no reading against the 12 months before until both years sit after it.', 'the 12 months before reach back to November 2024, into the thinner descriptions of the old feed: 2,046 tests then are not set beside 2,789 now');
  same(g.months, data.gas.months); same(g.recent, Object.assign({}, data.gas.recent, { changePct: -34.3 }), '417 against 635: both windows sit in the current system, so this one is a fair reading');
  same(g.topZips, [{ zip: '75217', tests12: 228, recent: 30, lastYear: 45 }, { zip: '75216', tests12: 200, recent: 36, lastYear: 47 }, { zip: '75228', tests12: 186, recent: 38, lastYear: 35 }, { zip: '75227', tests12: 153, recent: 19, lastYear: 28 }, { zip: '75232', tests12: 139, recent: 20, lastYear: 39 },
    { zip: '75211', tests12: 129, recent: 25, lastYear: 39 }, { zip: '75241', tests12: 112, recent: 20, lastYear: 31 }, { zip: '75224', tests12: 100, recent: 13, lastYear: 29 }, { zip: '75248', tests12: 95, recent: 11, lastYear: 15 }, { zip: '75206', tests12: 91, recent: 12, lastYear: 16 }], 'south and east Dallas first: 75217, 75228 and 75227 sit beside Mesquite');
  assert.match(g.what, /^A gas test is a residential plumbing permit for a pressure test of a home's gas line, usually after a shut off, a meter release or a repair/); assert.match(g.what, /grade C as a demand proxy\. It is not a heating job/); assert.match(g.rule, /^Gas test: .*GAS TEST, GAS PRESSURE TEST, GAS RELEASE or METER RELEASE\./);
  /* once both years sit in the current system the year over year reading opens: here the same counts relabeled to start in June 2025 */
  const months = data.gas.months.slice(-24).map((x, i) => Object.assign({}, x, { m: L.permits.addMonths('2025-06', i) })), g2 = plain(D.gasTests(Object.assign({}, data, { gas: Object.assign({}, data.gas, { months }) })));
  same({ last12: g2.last12, prior12: g2.prior12, yoyPct: g2.yoyPct, note: g2.note }, { last12: { tests: 2789, repairs: 706 }, prior12: { tests: 2046, repairs: 475 }, yoyPct: 36.3, note: null });
  /* short, empty and absent */
  const young = plain(D.gasTests(Object.assign({}, data, { gas: { months: data.gas.months.slice(-5), byZip12: null, zipMonths: null, recent: null } }))); same({ last12: young.last12, prior12: young.prior12, peak: young.peak, recent: young.recent, topZips: young.topZips, zips: young.zips, note: young.note }, { last12: null, prior12: null, peak: null, recent: null, topZips: [], zips: 0, note: null });
  for (const none of [null, undefined, {}, { gas: null }, { gas: {} }, { city: 'Fort Worth', months: [] }, { id: 'permits_dallas', data: null }]) assert.equal(D.gasTests(none), null);
  same(D.gasTests({ id: 'permits_dallas', ok: true, at: '2026-11-13T23:50:00Z', data }), g, 'the stored record is read as well as its data');
});

test('the era test for a month, and a ZIP table that never reaches back before June 2025', async () => {
  const L = fresh(), D = L.permitsDallas, data = plain(await dallas(L));
  const e = m => { const x = D.era(m); return x && [x.key, x.zip, x.full, x.words]; };
  same(e('2018-01'), ['A', true, true, false]); same(e('2019-07'), ['A', true, true, false]); same(e('2021-01'), ['A', true, true, false], 'the old system: ZIP codes and full counts, short uniform descriptions');
  same(e('2021-02'), ['B', false, false, false]); same(e('2024-04'), ['B', false, false, false], 'the interim feed while it held a fraction of the permits');
  same(e('2024-05'), ['B', false, true, false]); same(e('2025-04'), ['B', false, true, false], 'the interim feed at full count: still no ZIP code');
  same(e('2025-05'), ['C', false, true, false], 'the month of the changeover: 9 permits in 10 carry a ZIP code, under the 95 in 100 the collector asks for');
  same(e('2025-06'), ['C', true, true, true]); same(e('2026-11'), ['C', true, true, true]); same(e('2031-12'), ['C', true, true, true]);
  for (const bad of ['2017-12', '2018', '2018-13', 'soon', '', null, undefined, 201806]) assert.equal(D.era(bad), null, String(bad));
  assert.equal(D.era('2025-06').text, D.ERAS[2].text); same(data.eras, plain(D.ERAS)); same(data.usable, plain(D.USABLE));
  assert.match(D.ERAS[0].text, /^January 2018 to January 2021, the old permit system: a ZIP code on about 9 mechanical permits in 10/); assert.match(D.ERAS[1].text, /a ZIP code on fewer than 1 permit in 7, and until April 2024 only a fraction of the permits \(19 to 228 a month\) reached the file\. That is a gap in the file, not a drop in work\.$/); assert.match(D.ERAS[2].text, /Value is empty, and contractor is empty from October 2025 on\.$/);
  /* the eras as the fixtures measure them: a month has usable ZIP codes exactly where the era test says so */
  data.months.forEach((x, i) => assert.equal(data.zipPct[i] >= 95, D.era(x.m).zip, x.m + ' ' + data.zipPct[i])); assert.ok(data.months.every(x => D.era(x.m).full), 'no month of the gap is in the record');
  assert.ok(data.zipMonths[0] >= data.usable.zip && data.gas.zipMonths[0] >= data.usable.zip && data.words.zipMonths[0] >= data.usable.zip);
  /* the plan of the ZIP request on the day of the recording */
  same(plain(D.plan('2026-11-12')), { W: { cur: '2026-11', last: '2026-10', z0: '2025-11-01', z1: '2026-11-01', r0: '2026-09-18', r1: '2026-11-12', y0: '2025-09-19', y1: '2025-11-13' }, cuts: ['2025-09-19', '2025-11-01', '2025-11-14', '2026-09-18', '2026-11-01'], hi: '2026-11-12', seg: { z: [1, 2, 3], r: [3, 4], y: [0, 1] }, zipMonths: ['2025-11', '2026-10'], lastYear: true });
  /* in March 2026 the 12 complete months would reach back to March 2025: the ZIP table starts in June 2025 instead, and the weeks of last year (January to March 2025) are not set beside this year's */
  const mar = plain(D.plan('2026-03-10'));
  same({ cuts: mar.cuts, seg: mar.seg, zipMonths: mar.zipMonths, lastYear: mar.lastYear }, { cuts: ['2025-01-15', '2025-03-12', '2025-06-01', '2026-01-14', '2026-03-01'], seg: { z: [2, 3], r: [3, 4], y: [0] }, zipMonths: ['2025-06', '2026-02'], lastYear: false });
  const zq = q(D.q.zips(D.plan('2026-03-10'))); assert.equal(zq.$where, `(${DAYK})>='250115' AND (${DAYK})<='260310' AND ${BOTH}`); assert.ok(zq.$select.startsWith(`zip_code as z,case((${DAYK})>='260301','4',(${DAYK})>='260114','3',(${DAYK})>='250601','2',(${DAYK})>='250312','1',true,'0') as w,`));
  /* the whole run on that day (the recorded rows stand in for that week's: only the dates differ) */
  const then = serve({ newest: [{ kmax: '260310', n: '15000' }], months: A.months.filter(r => r.ym <= '2026-03') }), march = plain((await runWith(L, then, new Date('2026-03-11T18:00:00Z'))).data);
  assert.equal(q(then.calls[2].url).$where, zq.$where); assert.equal(march.through, '2026-03-10'); assert.equal(march.months.length, 22); assert.equal(march.months[21].m, '2026-02');
  same(march.zipMonths, ['2025-06', '2026-02'], 'nine months, and the record says which'); same(march.gas.zipMonths, ['2025-06', '2026-02']); same(march.words.zipMonths, ['2025-06', '2026-02']);
  const seg = (z, k, list) => A.zips.filter(r => r.z === z && list.includes(+r.w)).reduce((s, r) => s + +r[k], 0);
  same(march.byZip12['75217'], [seg('75217', 'm', [2, 3]), seg('75217', 'mh', [2, 3])], 'segments 2 and 3 only: nothing from before June 2025'); same(march.gas.byZip12['75217'], [seg('75217', 'pgt', [2, 3]), seg('75217', 'pgt', [3, 4]), null]);
  same(march.recent.sameWeeksLastYear, { from: '2025-01-15', to: '2025-03-11', mech: A.zips.filter(r => r.w === '0').reduce((s, r) => s + +r.m, 0), heat: null }, 'permits were counted in full last winter; heating words were not yet comparable');
  same([march.gas.recent.sameWeeksLastYear.tests, march.gas.recent.sameWeeksLastYear.repairs], [null, null]); assert.ok(Object.values(march.gas.byZip12).every(v => v[2] === null));
  const view = L.permits.cityView('permits_dallas', march); assert.equal(view.last12.mech, march.months.slice(-12).reduce((s, x) => s + x.mech, 0)); assert.equal(view.last12.heat, null, 'March 2025 to February 2026 straddles June 2025');
  assert.equal(view.heatNote, 'Heating permits in Dallas are comparable from June 2025 on, when the city changed how the work is written down: a 12 month count needs 12 complete months since then.'); assert.equal(D.digest(march).heat12, null); assert.equal(D.gasTests(march).recent.changePct, null);
  /* in June 2025 no month with ZIP codes is complete yet: no ZIP table at all, never an empty one passed off as zero */
  const jun = plain(D.plan('2025-06-20')); same({ cuts: jun.cuts, seg: jun.seg, zipMonths: jun.zipMonths, lastYear: jun.lastYear }, { cuts: ['2024-04-27', '2024-06-22', '2025-04-26'], seg: { z: [], r: [2], y: [0] }, zipMonths: null, lastYear: false });
  const j = plain((await runWith(L, serve({ newest: [{ kmax: '250620', n: '9000' }], months: rows(A.months, r => r.ym <= '2025-06' ? (r.ym === '2025-05' ? Object.assign(r, { zn: r.n }) : r) : null) }), new Date('2025-06-21T18:00:00Z'))).data);
  same({ byZip12: j.byZip12, zipMonths: j.zipMonths, words: j.words, gasZip: j.gas.byZip12, gasZipMonths: j.gas.zipMonths, months: j.months.length }, { byZip12: null, zipMonths: null, words: null, gasZip: null, gasZipMonths: null, months: 13 }); assert.ok(j.gas.recent.tests > 0, 'the citywide weeks need no ZIP code'); assert.equal(D.digest(j).zips, null); assert.equal(j.recent.sameWeeksLastYear.mech, null, 'the same weeks of 2024 began in April, inside the gap');
});

test('health gates: a snapshot that fails one is thrown away with the reason', async () => {
  const L = fresh();
  /* 1. each of the first two answers must be HTTP 200 and an array of rows */
  const down = serve({ newest: { status: 500, body: 'Internal Server Error' } }); await assert.rejects(() => runWith(L, down), /HTTP 500 from www\.dallasopendata\.com/); assert.equal(down.calls.length, 2, 'one more try, then nothing else is asked');
  const refused = serve({ newest: { status: 400, body: REFUSED } }); await assert.rejects(() => runWith(L, refused), /^Error: the Dallas permit file refused the query for the newest permit date, so its layout may have changed: Query coordinator error: query\.soql\.no-such-function; No such function 'to_floating_timestamp'; arity=1$/); assert.equal(refused.calls.length, 1, 'a refusal is not tried again');
  await assert.rejects(() => runWith(L, serve({ newest: { status: 200, body: REFUSED } })), /the Dallas permit file sent no rows for the newest permit date: Query coordinator error/);
  await assert.rejects(() => runWith(L, serve({ newest: { status: 200, body: '<html><body>Scheduled maintenance</body></html>' } })), /not JSON from www\.dallasopendata\.com/);
  await assert.rejects(() => runWith(L, serve({ newest: new Error('socket hang up') })), /socket hang up/);
  for (const none of [[], [{}], [{ n: '0' }], [{ kmax: 'soon', n: '3' }]]) await assert.rejects(() => runWith(L, serve({ newest: none })), /the Dallas permit file holds no residential mechanical permit: the city may have renamed the permit type/);
  const m400 = serve({ months: { status: 400, body: REFUSED } }); await assert.rejects(() => runWith(L, m400), /refused the query for the months, so its layout may have changed: Query coordinator error/); assert.equal(m400.calls.length, 2);
  await assert.rejects(() => runWith(L, serve({ months: { status: 503, body: 'Service Unavailable' } })), /HTTP 503 from www\.dallasopendata\.com/);
  await assert.rejects(() => runWith(L, serve({ months: { message: 'Query coordinator error', errorCode: 'x' } })), /sent no rows for the months: Query coordinator error/);
  /* 2. the newest permit is at most 7 days old */
  assert.equal((await dallas(L, null, new Date('2026-11-20T05:59:00Z'))).through, '2026-11-12', 'seven days back on the 19th in Dallas: still accepted');
  const stopped = serve(); await assert.rejects(() => runWith(L, stopped, new Date('2026-11-20T06:00:00Z')), /^Error: the newest Dallas permit is dated 2026-11-12, 8 days back \(7 at most expected\): the city's file has stopped moving$/); assert.equal(stopped.calls.length, 1);
  /* 3. every complete month asked for is there (the research's floor was 30 rows: 30 complete months on the day of the recording), and
        the newest complete month has at least 200 mechanical and 500 plumbing permits */
  await assert.rejects(() => dallas(L, { months: A.months.slice(-20) }), /^Error: the Dallas permit file answered 19 of the 30 months asked for \(2024-05 is missing\)$/);
  await assert.rejects(() => dallas(L, { months: [] }), /answered 0 of the 30 months asked for \(2024-05 is missing\)/);
  await assert.rejects(() => dallas(L, { months: A.months.filter(r => r.ym !== '2025-02') }), /answered 29 of the 30 months asked for \(2025-02 is missing\)/, 'a month with no row is a broken answer here, never passed on as a month with no permit');
  assert.equal((await dallas(L, { months: A.months.filter(r => r.ym !== '2026-11') })).months.length, 30, 'the month in progress may have no row yet: on the first of a month it never does');
  await assert.rejects(() => dallas(L, { months: rows(A.months, r => r.ym === '2026-10' ? Object.assign(r, { m: '150' }) : r) }), /^Error: the Dallas permit file holds 150 residential mechanical permits for 2026-10 \(200 or more expected\)$/);
  await assert.rejects(() => dallas(L, { months: rows(A.months, r => r.ym === '2026-10' ? Object.assign(r, { p: '400' }) : r) }), /^Error: the Dallas permit file holds 400 residential plumbing permits for 2026-10 \(500 or more expected\)$/);
  await assert.rejects(() => dallas(L, { months: rows(A.months, r => r.ym === '2026-10' ? Object.assign(r, { m: '0', md: '0', mh: '0', mo: '0' }) : r) }), /holds 0 residential mechanical permits for 2026-10/);
  /* 4. a ZIP code on at least 95 in 100 permits of that month */
  await assert.rejects(() => dallas(L, { months: rows(A.months, r => r.ym === '2026-10' ? Object.assign(r, { zn: '1579' }) : r) }), /^Error: a ZIP code is on 89 in 100 Dallas permits of 2026-10 \(95 or more expected\): the ZIP table cannot be trusted$/);
  assert.equal((await dallas(L, { months: rows(A.months, r => r.ym === '2026-10' ? Object.assign(r, { zn: '1668' }) : r) })).through, '2026-11-12', '1,668 of 1,755 is 95 in 100: accepted');
  await assert.rejects(() => dallas(L, { months: rows(A.months, r => r.ym === '2026-10' ? Object.assign(r, { zn: '0', n: '0' }) : r) }), /a ZIP code is on 0 in 100 Dallas permits of 2026-10/);
  /* 5. the ZIP answer holds 30 to 80 ZIP codes */
  const twenty = [...new Set(A.zips.filter(r => 'z' in r).map(r => r.z))].slice(0, 20); await assert.rejects(() => dallas(L, { zips: A.zips.filter(r => twenty.includes(r.z)) }), /^Error: the Dallas permit file answered 20 ZIP codes \(30 to 80 expected\)$/);
  await assert.rejects(() => dallas(L, { zips: A.zips.concat(Array.from({ length: 40 }, (_, i) => ({ z: String(76001 + i), w: '2', m: '1', md: '1', mh: '0', mf: '0', mhp: '0', mnc: '0', p: '1', pgt: '0', pgr: '0' }))) }), /answered 91 ZIP codes \(30 to 80 expected\)/);
  await assert.rejects(() => dallas(L, { zips: [] }), /answered 0 ZIP codes/);
  await assert.rejects(() => dallas(L, { zips: Array.from({ length: 5000 }, () => A.zips[0]) }), /the Dallas ZIP code answer runs past 5000 rows/);
  /* every gate named in the collector is one of the five */
  same(plain(L.permitsDallas.GATE), { days: 7, mech: 200, plumb: 500, zipShare: 0.95, zips: [30, 80] });
});

test('through the runner: a snapshot that fails a gate keeps the previous record and says why', async () => {
  const L = fresh(), store = L.memoryStore(); let over = null;
  const fetch = fakeFetch([[/e7gq-4sah\.json\?/, url => { const k = kind(url); return over && k in over ? over[k] : A[k]; }]]);
  const opt = { scope: ['permits_dallas'], store, fetch, env: 'node', force: true, http: { gapMs: 0, backoffMs: 1 } };
  const a = await L.refresh(Object.assign({ now: () => T0 }, opt)); same(a.ran, ['permits_dallas']); same(a.failed, []);
  const rec = await store.get(L.K.src('permits_dallas')); assert.equal(rec.ok, true); assert.equal(rec.n, 3); same(rec.digest, { mech12: 6742, heat12: 1067, yoyPct: 12.4, gas8w: 417, gas8wLastYear: 635, through: '2026-11-12', zips: 48 });
  assert.ok(rec.bytes > 20000 && rec.bytes < 60000, 'about 28 KB read in a week: ' + rec.bytes); assert.ok(JSON.stringify(rec).length < 14000);
  /* a week later the ZIP field has gone empty again: the gate fails, last week's record stays whole, and the reason is kept for the Live Data page */
  over = { newest: [{ kmax: '261119', n: '18900' }], months: rows(A.months, r => r.ym === '2026-10' ? Object.assign(r, { zn: '60' }) : r) };
  const b = await L.refresh(Object.assign({ now: () => new Date(+T0 + 7 * 864e5) }, opt)); same(b.ran, []); assert.equal(b.failed[0].id, 'permits_dallas'); assert.match(b.failed[0].msg, /^a ZIP code is on 3 in 100 Dallas permits of 2026-10 \(95 or more expected\)/);
  const kept = await store.get(L.K.src('permits_dallas')); assert.equal(kept.ok, false); assert.equal(kept.err.msg, b.failed[0].msg); same(kept.data, rec.data, 'nothing of the failed snapshot is stored'); same(kept.digest, rec.digest);
  /* and when the file is back, the next run replaces it */
  over = { newest: [{ kmax: '261126', n: '19050' }] };
  const c = await L.refresh(Object.assign({ now: () => new Date(+T0 + 14 * 864e5) }, opt)); same(c.failed, []); const back = await store.get(L.K.src('permits_dallas')); assert.equal(back.ok, true); assert.equal(back.err, undefined); assert.equal(back.data.through, '2026-11-26'); assert.equal(back.digest.mech12, 6742);
});

test('partial failure: the ZIP request alone fails, the months are fresh and the ZIP blocks stay as the last good run left them', async () => {
  const L = fresh(), D = L.permitsDallas, good = plain(await dallas(L));
  /* last week's record, marked so it can be told apart */
  const prev = plain(good); prev.through = '2026-11-05'; prev.byZip12 = { '75214': [440, 44] }; prev.zipMonths = ['2025-10', '2026-09']; prev.recent = Object.assign({}, prev.recent, { to: '2026-11-05', mech: 900 });
  prev.gas = Object.assign({}, prev.gas, { byZip12: { '75217': [220, 28, 44] }, recent: Object.assign({}, prev.gas.recent, { to: '2026-11-05', tests: 400 }) }); prev.words = Object.assign({}, prev.words, { furnace: 550 });
  const fetch = serve({ zips: { status: 500, body: '{"message":"x"}' } }), part = plain((await runWith(L, fetch, T0, prev)).data);
  assert.equal(fetch.calls.length, 4, 'the ZIP request is tried twice');
  same(part.stale, ['byZip12', 'recent', 'gas.byZip12', 'gas.recent', 'words']); assert.match(part.err, /HTTP 500 from www\.dallasopendata\.com/);
  same(part.months, good.months, 'the months are this run\'s'); same(part.gas.months, good.gas.months); assert.equal(part.through, '2026-11-12'); same(part.zipPct, good.zipPct); same(part.described, good.described);
  same({ byZip12: part.byZip12, zipMonths: part.zipMonths, recent: part.recent, gasZip: part.gas.byZip12, gasMonths: part.gas.zipMonths, gasRecent: part.gas.recent, words: part.words }, { byZip12: prev.byZip12, zipMonths: prev.zipMonths, recent: prev.recent, gasZip: prev.gas.byZip12, gasMonths: prev.gas.zipMonths, gasRecent: prev.gas.recent, words: prev.words });
  same(D.digest(part), { mech12: 6742, heat12: 1067, yoyPct: 12.4, gas8w: 400, gas8wLastYear: 635, through: '2026-11-12', zips: 1 }, 'the recent weeks in the digest are last week\'s, and the record says which blocks are');
  const g = plain(D.gasTests(part)); same(g.stale, ['gas.byZip12', 'gas.recent']); same(g.last12, { tests: 2789, repairs: 706 }); assert.equal(g.recent.to, '2026-11-05'); same(g.topZips, [{ zip: '75217', tests12: 220, recent: 28, lastYear: 44 }]);
  /* a refusal, a body that is not an array and a time out of the ZIP request are the same partial record */
  for (const [bad, why] of [[{ status: 400, body: REFUSED }, /refused the query for the ZIP codes, so its layout may have changed: Query coordinator error/], [{ message: 'no' }, /sent no rows for the ZIP codes/], [new Error('timed out after 28 s: www.dallasopendata.com'), /timed out after 28 s/]]) {
    const p = plain(await dallas(L, { zips: bad }, T0, prev)); same(p.stale, ['byZip12', 'recent', 'gas.byZip12', 'gas.recent', 'words']); assert.match(p.err, why); same(p.byZip12, prev.byZip12);
  }
  /* on a first run there is nothing to keep: the blocks are empty, never invented */
  const first = plain(await dallas(L, { zips: { status: 500, body: 'x' } }));
  same({ stale: first.stale, byZip12: first.byZip12, zipMonths: first.zipMonths, recent: first.recent, gas: [first.gas.byZip12, first.gas.zipMonths, first.gas.recent], words: first.words, months: first.months.length }, { stale: ['byZip12', 'recent', 'gas.byZip12', 'gas.recent', 'words'], byZip12: null, zipMonths: null, recent: null, gas: [null, null, null], words: null, months: 30 });
  same(D.digest(first), { mech12: 6742, heat12: 1067, yoyPct: 12.4, gas8w: null, gas8wLastYear: null, through: '2026-11-12', zips: null }); const g0 = plain(D.gasTests(first)); same({ recent: g0.recent, topZips: g0.topZips, zips: g0.zips, peak: g0.peak }, { recent: null, topZips: [], zips: 0, peak: { m: '2025-12', tests: 440 } });
  /* a record of an older shape as the previous one: what it lacks stays empty */
  const old = plain(await dallas(L, { zips: { status: 500, body: 'x' } }, T0, { city: 'Dallas', byZip12: { '75214': [1, 0] } })); same(old.byZip12, { '75214': [1, 0] }); assert.equal(old.gas.recent, null); assert.equal(old.words, null);
});

test('summary: Dallas beside Fort Worth, every ZIP code once', async () => {
  const L = fresh('live/sources/permits_fortworth.js'), P = L.permits;
  const kindFW = init => { const p = new URLSearchParams(init.body); return p.get('having') ? 'multi' : /^EXTRACT/.test(p.get('groupByFieldsForStatistics') || '') ? 'months' : 'zips'; };
  const http = L.makeHttp({ fetch: fakeFetch([[/FeatureServer\/0\/query$/, (url, init) => FW[kindFW(init)]]]), gapMs: 0, backoffMs: 1 });
  const fw = plain(await L.BY_ID.permits_fortworth.run({ http, now: new Date('2026-11-13T18:40:00Z'), prev: null, geo: L.geo, settings: {}, env: 'node' })), dal = plain(await dallas(L));
  const s = plain(P.summary({ permits_fortworth: { id: 'permits_fortworth', ok: true, data: fw }, permits_dallas: { id: 'permits_dallas', ok: true, data: dal }, permits_irving: { skipped: { why: 'x' } }, nws_cold: { data: { months: [] } } }));
  same(s.cities.map(c => [c.id, c.city]), [['permits_dallas', 'Dallas'], ['permits_fortworth', 'Fort Worth']]); same(s.grades, { mech: 'B', heat: 'C' }); assert.equal(s.through, '2026-11-13', 'the latest permit any city holds; each city carries its own');
  const [d, f] = s.cities;
  same({ through: d.through, last12: d.last12, prior12: d.prior12, yoyPct: d.yoyPct, zips: d.zips, zipMonths: d.zipMonths, residentialOnly: d.residentialOnly, described: d.described, heatSince: d.heatSince, stale: d.stale },
    { through: '2026-11-12', last12: { mech: 6742, heat: 1067, heatOnly: 184 }, prior12: { mech: 6000, heat: null, heatOnly: null }, yoyPct: 12.4, zips: 48, zipMonths: ['2025-11', '2026-10'], residentialOnly: true, described: { n: 6741, of: 6742 }, heatSince: '2025-06', stale: [] });
  assert.equal(d.heatNote, 'Heating permits in Dallas are comparable from June 2025 on, when the city changed how the work is written down: there is no reading against the year before until both years sit after it.');
  same(d.months, dal.months); same(d.recent, dal.recent); same(Object.keys(d), Object.keys(f), 'one shape for every city: the gas tests and the eras stay in the Dallas record');
  same({ last12: f.last12, yoyPct: f.yoyPct, zips: f.zips }, { last12: { mech: 4610, heat: null, heatOnly: null }, yoyPct: 13.6, zips: 43 }); assert.match(f.heatNote, /^Fort Worth wrote down the work on 69 of 4,610 permits/);
  /* the two cities share no ZIP code today: 48 and 43 make 91, and the permits of the table are the permits of the two */
  assert.equal(s.zips, 91); assert.equal(Object.keys(s.byZip).length, 91); assert.equal(Object.values(s.byZip).filter(z => z.shared).length, 0);
  same(s.byZip['75214'], { city: 'Dallas', mech12: 451, heat12: 46 }); same(s.byZip['75217'], { city: 'Dallas', mech12: 222, heat12: 64 }); same(s.byZip['76244'], { city: 'Fort Worth', mech12: 449, heat12: null });
  const total = o => Object.values(o).reduce((x, v) => x + v[0], 0); assert.equal(Object.values(s.byZip).reduce((x, z) => x + z.mech12, 0), total(dal.byZip12) + total(fw.byZip12)); assert.equal(total(dal.byZip12) + total(fw.byZip12), 6731 + 4563);
  /* were Fort Worth to file permits in a ZIP code Dallas reaches into, it appears once, with the sum and each city's part, and the unknown heating of one makes the sum unknown */
  const t = plain(P.summary({ permits_dallas: dal, permits_fortworth: Object.assign({}, fw, { byZip12: Object.assign({}, fw.byZip12, { '75051': [20, null], '75214': [2, null] }) }) }));
  assert.equal(t.zips, 91, '75051 and 75214 are counted once each'); same(t.byZip['75051'], { city: 'Fort Worth', mech12: 26, heat12: null, shared: true, parts: [{ city: 'Dallas', mech12: 6, heat12: 3 }, { city: 'Fort Worth', mech12: 20, heat12: null }] });
  same(t.byZip['75214'], { city: 'Dallas', mech12: 453, heat12: null, shared: true, parts: [{ city: 'Dallas', mech12: 451, heat12: 46 }, { city: 'Fort Worth', mech12: 2, heat12: null }] }); assert.equal(Object.values(t.byZip).reduce((x, z) => x + z.mech12, 0), 6731 + 4563 + 22);
  /* a Dallas record with stale ZIP blocks still merges, and says so */
  const part = plain(await dallas(L, { zips: { status: 500, body: 'x' } }, T0, dal)), u = plain(P.summary({ permits_dallas: part })); same(u.cities[0].stale, ['byZip12', 'recent', 'gas.byZip12', 'gas.recent', 'words']); assert.equal(u.zips, 48);
  assert.equal(plain(P.summary({ permits_dallas: plain(await dallas(L, { zips: { status: 500, body: 'x' } })) })).zips, 0, 'no ZIP table yet: the city is listed, its ZIP codes are not invented');
});

test('registration: what the Live Data module lists, time limits, and no dash in anything a person reads', async () => {
  const L = fresh(), P = L.permits, D = L.permitsDallas, s = L.BY_ID.permits_dallas;
  same({ id: s.id, cadence: s.cadence, cors: s.cors, grade: s.grade, hosts: s.hosts, page: s.page }, { id: 'permits_dallas', cadence: 'weekly', cors: true, grade: 'B', hosts: ['www.dallasopendata.com'], page: 'https://www.dallasopendata.com/d/e7gq-4sah' }); assert.equal(s.key, undefined, 'no API key');
  assert.equal(new URL(D.API).host, s.hosts[0]); assert.equal(s.name, 'Dallas mechanical permits and gas tests'); assert.match(s.terms, /carries no license\. Credit: City of Dallas, Dallas OpenData, Building Permits \(e7gq-4sah\)\.$/);
  same(Object.keys(s.labels), ['mech12', 'heat12', 'yoyPct', 'gas8w', 'gas8wLastYear', 'through', 'zips']); same(Object.values(s.labels).map(l => l[1]), ['int', 'int', 'pct', 'int', 'int', 'text', 'int']); same(s.labels.gas8w, ['Gas tests, last 8 weeks', 'int']); same(s.labels.gas8wLastYear, ['Gas tests, same weeks last year', 'int']); same(s.labels.mech12, plain(P.LABELS.mech12));
  /* about says what a gas test is and is not, and the caveats of the three eras */
  assert.equal(s.about.split('. ').length, 2, 'two sentences'); assert.match(s.about, /gas tests: plumbing permits for a pressure test of a home's gas line, usually after a shut off, a meter release or a repair, which mark homes putting gas heat back in service \(a lead indicator of heating demand by ZIP code, grade C, not a count of heating jobs\)\./);
  assert.match(s.about, /ZIP codes are usable from June 2025 on \(and in 2018 to 2020\), months before May 2024 are a gap in the city's file and are left out, and contractor and value are empty from October 2025 on\.$/);
  const data = plain(await dallas(L)), g = D.gasTests(data), view = P.cityView('permits_dallas', data);
  const read = [s.name, s.publisher, s.about, s.terms, D.WHAT, D.GAS_WHAT, D.GAS_RULE, D.COVERAGE, data.what, data.coverage, g.what, g.rule, g.note, view.heatNote].concat(Object.values(s.labels).map(l => l[0]), D.ERAS.map(e => e.text));
  for (const t of read) { assert.ok(t && t.length > 3); assert.ok(!/[\u2010-\u2015\u2212]|[A-Za-z]-[A-Za-z]| - /.test(t), 'a hyphen or dash in: ' + t); assert.ok(!/licence|colour|neighbour/i.test(t), 'American spelling: ' + t); }
  /* every request gives up inside 30 seconds, is tried at most twice, waits a second for the one before, and the three fit the time the runner gives the source */
  const seen = [], stub = { json: async (url, init) => { seen.push(init); return A[kind(url)]; } };
  await s.run({ http: stub, now: T0, prev: null, geo: L.geo, settings: {}, env: 'node' });
  assert.equal(seen.length, 3); for (const i of seen) { assert.ok(i.timeoutMs > 0 && i.timeoutMs < 30000, 'time limit ' + i.timeoutMs); assert.ok(i.retries <= 1); assert.ok(i.gapMs >= 1000); assert.equal(i.headers, undefined); assert.equal(i.method, undefined); assert.equal(i.body, undefined); }
  assert.ok(s.timeoutMs >= 3 * ((seen[0].retries + 1) * seen[0].timeoutMs + 1000) && s.timeoutMs <= 240000, 'the source limit covers the slowest run: ' + s.timeoutMs);
  /* the host is granted to the browser app at install, and the page loads the shared helpers before this file */
  const manifest = JSON.parse(readFileSync(join(APP, 'manifest.json'), 'utf8')); assert.ok(manifest.host_permissions.includes('https://www.dallasopendata.com/*'));
  const order = readFileSync(join(ROOT, 'atlas.template.html'), 'utf8').split('\n').filter(l => /^<!--@js live\//.test(l)); assert.ok(order.indexOf('<!--@js live/permits.js-->') >= 0 && order.indexOf('<!--@js live/permits.js-->') < order.indexOf('<!--@js live/sources/permits_dallas.js-->'));
  /* the fixtures are aggregates only: nothing in them is a row of the city's file (no address, no permit number, no contractor) */
  for (const f of ['newest-2026-11-13.json', 'months-2026-11-13.json', 'zips-2026-11-13.json', 'research-p1-months-2026-11-13.json', 'research-p2-zip-months-2026-11-13.json']) { const body = readFileSync(join(DIR, f), 'utf8'); assert.ok(body.length < 200000, f); assert.ok(!/street|address|permit_number|contractor/i.test(body), f); }
});
