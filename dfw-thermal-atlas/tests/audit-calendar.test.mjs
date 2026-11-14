// Audit, part A: the calendar. Every collector runs at clocks chosen for their edges (the year end, the leap day, daylight
// saving, the turn of the heating season on July 1, a Monday 06:00 in each quarter) against the recorded answers, shaped to
// the date asked for (tests/audit-kit.mjs). Checked: every date a request carries is a real one and its ranges run forward,
// the season and year labels are the right ones, the digest keeps its shape across the boundary, and the request count and
// the simulated run time stay inside what each source is given.
import test from 'node:test';
import assert from 'node:assert/strict';
import { world, service, runOnce, dallas, localDay, addDays, dayDiff, bodyOf, formOf, ALL, raw, fetcher, gridFor } from './audit-kit.mjs';

const CLOCKS = ['2026-12-31 23:30', '2027-01-01 00:30', '2027-01-02 05:00', '2027-02-28 05:00', '2027-03-01 05:00', '2027-03-14 05:00', '2027-06-30 05:00', '2027-07-01 05:00', '2027-07-02 05:00', '2027-10-01 05:00', '2027-11-07 05:00', '2028-02-29 05:00', '2028-03-01 05:00',
  '2027-01-04 06:00', '2027-04-05 06:00', '2027-07-05 06:00', '2027-10-04 06:00'];
const REF = '2026-11-13 12:40';
const real = d => /^\d{4}-\d\d-\d\d$/.test(d) && !Number.isNaN(Date.parse(d + 'T12:00:00Z')) && new Date(Date.parse(d + 'T12:00:00Z')).toISOString().slice(0, 10) === d;
const seasonOf = d => +d.slice(0, 4) - (d.slice(5, 7) < '07' ? 1 : 0);
const MAX_REQ = { nws_cold: 21, cpsc_recalls: 5, acis_season: 6, iem_cold: 11, cpc_outlook: 40, nbm_extended: 1, ercot_grid: 4, permits_dallas: 3, permits_fortworth: 3, tdlr_licenses: 5, census_acs: 13, fedreg_rules: 5 };
const shape = x => (x === null ? 'null' : Array.isArray(x) ? 'array' : typeof x);
const junk = x => { let bad = null; (function walk(v, path) { if (bad) return; if (typeof v === 'number' && !Number.isFinite(v)) bad = path + ' = ' + v; else if (typeof v === 'string' && /undefined|NaN|\[object Object\]|Invalid Date/.test(v)) bad = path + ' = ' + v.slice(0, 60); else if (Array.isArray(v)) v.forEach((y, i) => walk(y, path + '[' + i + ']')); else if (v && typeof v === 'object') for (const k of Object.keys(v)) walk(v[k], path + '.' + k); })(x, ''); return bad; };
/* everything a request says, readable: the URL decoded, and its body */
const said = c => decodeURIComponent(c.url.replace(/\+/g, ' ')) + ' ' + decodeURIComponent(String((c.init && c.init.body) || '').replace(/\+/g, ' '));

/* the dates of the requests of one run, checked source by source; returns nothing, throws on the first bad one */
function checkRequests(id, calls, today, what) {
  const yest = addDays(today, -1);
  for (const c of calls) {
    const s = said(c);
    for (const d of s.match(/(?<!\d)(?:19|20)\d\d-\d\d-\d\d(?!\d)/g) || []) assert.ok(real(d), `${what}: ${d} is not a calendar day in ${s.slice(0, 160)}`);
    assert.ok(!/undefined|NaN|Invalid Date|\[object/.test(s), `${what}: a request carries junk: ${s.slice(0, 200)}`);
    assert.ok(!(c.init && c.init.headers && Object.keys(c.init.headers).some(h => /cookie|authorization|user-agent|referer|x-/i.test(h))), what + ': a request carries an identifying header');
    assert.equal((c.init || {}).credentials, 'omit', what + ': requests are sent without cookies');
  }
  if (id === 'acis_season') for (const c of calls) {
    const q = bodyOf(c.init);
    if (q.sdate) { assert.ok(q.sdate <= q.edate, `${what}: ${c.kind} asks ${q.sdate} to ${q.edate}`); }
    if (c.kind === 'acis.W1') { assert.equal(q.sdate, seasonOf(q.edate) + '-07-01', what + ': the daily block starts on July 1 of its own season'); assert.ok(q.edate === yest || q.edate === addDays(yest, -1), what + ': W1 ends yesterday, got ' + q.edate); }
    if (c.kind === 'acis.W2') assert.ok(q.date <= yest && q.date >= addDays(yest, -1), what + ': W2 is for ' + q.date);
    if (c.kind === 'acis.W3' || c.kind === 'acis.G2') { assert.equal(+q.edate.slice(0, 4) - +q.sdate.slice(0, 4), 29, what + ': 30 falls'); assert.equal(q.sdate.slice(5), q.edate.slice(5)); assert.ok(['1991', '1992'].includes(q.sdate.slice(0, 4))); assert.equal(q.sdate.slice(0, 4), q.sdate.slice(5, 7) < '07' ? '1992' : '1991', what + ': the first fall is 1991 to 1992'); }
    if (c.kind === 'acis.G1') { assert.ok(dayDiff(q.edate, q.sdate) <= 2); assert.ok(q.sdate >= seasonOf(q.edate) + '-07-01', what + ': the grid days stay inside the season'); }
  }
  if (id === 'iem_cold') {
    const S = seasonOf(today), ss = calls.map(c => { const m = /sts=(\d{4})-07-01T00:00Z&ets=(\d{4})-07-01T00:00Z/.exec(said(c)); assert.ok(m, what + ': season bounds in ' + c.url.slice(0, 120)); assert.equal(+m[2], +m[1] + 1); return +m[1]; });
    assert.equal(ss[0], S, what + ': the running season is asked first'); assert.ok(ss.every(s => s <= S && s >= S - 10), what + ': seasons asked ' + ss);
    assert.equal(new Set(ss).size, ss.length, what + ': no season asked twice');
  }
  if (id === 'fedreg_rules') for (const c of calls.filter(c => c.kind !== 'fedreg.standing')) {
    const m = /\[publication_date\]\[gte\]=(\d{4}-\d\d-\d\d)/.exec(said(c)); assert.ok(m, what + ': a window start'); const back = dayDiff(today, m[1]);
    assert.ok(back >= 727 && back <= 733, `${what}: the 24 months start ${m[1]}, ${back} days back`);
  }
  if (id === 'ercot_grid') { const ds = calls.filter(c => c.kind === 'ercot.zone').map(c => /(\d{4})(\d\d)(\d\d)_actual/.exec(c.url).slice(1).join('-')); ds.forEach(d => { assert.ok(real(d), what + ': zone day ' + d); assert.ok(d < today && d >= addDays(today, -5), what + ': zone day ' + d); }); }
  if (id === 'permits_dallas') for (const c of calls) {
    const s = said(c), keys = (s.match(/'(\d{6})'/g) || []).map(k => k.slice(1, 7)), days = keys.map(k => '20' + k.slice(0, 2) + '-' + k.slice(2, 4) + '-' + k.slice(4));
    days.forEach(d => assert.ok(real(d), `${what}: ${d} in a Dallas query`));
    for (const m of s.match(/>='(\d{4})'/g) || []) assert.ok(+m.slice(5, 7) >= 1 && +m.slice(5, 7) <= 12, what + ': month key ' + m);
    if (c.kind === 'pd.zips') { const cuts = (s.match(/\)>='(\d{6})','\d'/g) || []).map(x => x.slice(4, 10)).sort(), lo = /\)>='(\d{6})' AND/.exec(s), hi = /<='(\d{6})'/.exec(s); assert.ok(lo && hi && lo[1] <= hi[1], what + ': the ZIP window runs forward'); assert.ok(cuts.every(k => k > lo[1] && k <= hi[1]), what + ': every cut inside the window ' + cuts + ' in ' + lo[1] + '..' + hi[1]); assert.equal(new Set(cuts).size, cuts.length); }
  }
  if (id === 'permits_fortworth') for (const c of calls) {
    const w = formOf(c.init).where || '', lows = [...w.matchAll(/>= DATE '(\d{4}-\d\d-\d\d)'/g)].map(m => m[1]), highs = [...w.matchAll(/< DATE '(\d{4}-\d\d-\d\d)'/g)].map(m => m[1]);
    assert.ok(lows.length && highs.length, what + ': a dated window in ' + w.slice(0, 120)); assert.ok(lows.every(a => highs.every(b => a < b)), `${what}: ${lows} before ${highs}`); assert.ok(highs.every(b => b <= addDays(today, 2)));
    for (const st of JSON.parse(formOf(c.init).outStatistics || '[]')) for (const m of String(st.onStatisticField).matchAll(/>= DATE '(\d{4}-\d\d-\d\d)' AND \w+ < DATE '(\d{4}-\d\d-\d\d)'/g)) assert.ok(real(m[1]) && real(m[2]) && m[1] < m[2], `${what}: window ${m[1]} to ${m[2]}`);
  }
  if (id === 'census_acs') for (const c of calls) { const y = /\/(20\d\d)\//.exec(c.url); assert.ok(y && +y[1] >= 2024 && +y[1] < +today.slice(0, 4), what + ': asks about the file of ' + (y && y[1])); }
  if (id === 'tdlr_licenses') for (const c of calls) for (const k of said(c).match(/'(20\d{6})'/g) || []) { const d = `${k.slice(1, 5)}-${k.slice(5, 7)}-${k.slice(7, 9)}`; assert.ok(real(d), what + ': ' + d); }
}
/* what the record says about its own dates */
function checkRecord(id, d, today, what) {
  const yest = addDays(today, -1), S = seasonOf(today);
  assert.equal(junk(d), null, what + ': junk in the record');
  if (id === 'acis_season') { assert.ok(d.through === yest || d.through === addDays(yest, -1), what + ': observed through ' + d.through); assert.equal(d.season, seasonOf(d.through), what + ': the season carries the year its July 1 falls in'); if (d.daily) { assert.equal(d.daily.start, d.season + '-07-01'); assert.equal(d.daily.n, dayDiff(d.through, d.daily.start) + 1); for (const u in d.daily.tn) assert.equal(d.daily.tn[u].length, d.daily.n, what + ': one low a day'); } }
  if (id === 'iem_cold') { assert.equal(d.season, S, what); assert.equal(d.archiveThrough, today); assert.deepEqual(d.seasons, Array.from({ length: 11 }, (_, i) => S - 10 + i), what + ': ten winters and the running one'); assert.equal(d.archiveFrom, (S - 10) + '-07-01'); }
  if (id === 'nws_cold') { const ds = d.points[0].nights.map(n => n.d); assert.ok(ds[0] === today || ds[0] === yest, what + ': first night ' + ds[0]); ds.forEach((x, i) => { assert.ok(real(x)); if (i) assert.equal(x, addDays(ds[i - 1], 1), what + ': nights follow one another'); }); d.points[0].nights.forEach(n => assert.equal(n.m, addDays(n.d, 1))); }
  if (id === 'nbm_extended') for (const s of d.stations) for (const n of s.nights) { assert.ok(real(n.m) && n.lead >= 6 && n.lead <= 12, what + ': lead ' + n.lead); assert.equal(n.d, addDays(n.m, -1)); }
  if (id === 'ercot_grid') { assert.equal(d.day, today); d.days.forEach(x => assert.ok(real(x.d) && x.d >= today)); d.zone.forEach(z => assert.ok(real(z.d) && z.d < today)); }
  if (id === 'cpc_outlook') assert.equal(d.day, today);
  if (id === 'permits_dallas' || id === 'permits_fortworth') {
    const ms = d.months.map(x => x.m); assert.ok(ms.length >= 12 && ms.length <= 36, what + ': months kept ' + ms.length);
    ms.forEach((m, i) => { assert.match(m, /^20\d\d-(0[1-9]|1[0-2])$/); if (i) { const p = ms[i - 1], next = p.slice(5) === '12' ? (+p.slice(0, 4) + 1) + '-01' : p.slice(0, 5) + String(+p.slice(5) + 101).slice(1); assert.equal(m, next, `${what}: no month skipped or doubled (${p} then ${m})`); } });
    assert.ok(ms[ms.length - 1] < d.through.slice(0, 7), what + ': only complete months');
    assert.ok(dayDiff(d.through.slice(0, 7) + '-01', ms[ms.length - 1] + '-01') <= 31, what + ': the newest complete month is the one before the latest permit');
    if (d.zipMonths) { assert.ok(d.zipMonths[0] <= d.zipMonths[1]); assert.equal(d.zipMonths[1], ms[ms.length - 1]); }
    if (d.recent) { assert.equal(dayDiff(d.recent.to, d.recent.from), 55); assert.equal(dayDiff(d.recent.from, d.recent.sameWeeksLastYear.from), 364); assert.equal(dayDiff(d.recent.to, d.recent.sameWeeksLastYear.to), 364); assert.equal(d.recent.to, d.through); }
  }
  if (id === 'fedreg_rules') { assert.ok(real(d.through) && real(d.since) && d.since < d.through); assert.ok(d.docs.every(x => x.pin || x.d >= d.since), what + ': nothing older than the window but the standing rules'); assert.ok(d.docs.some(x => x.pin), what + ': the standing rules stay'); }
  if (id === 'tdlr_licenses') { assert.ok(real(d.asOfDay)); assert.ok(real(d.entrants.from) && dayDiff(d.asOfDay, d.entrants.from) >= 365 && dayDiff(d.asOfDay, d.entrants.from) <= 366, what + ': a year of entrants from ' + d.entrants.from); assert.deepEqual(d.stale, []); d.entrants.newest.forEach(x => assert.ok(x.issued == null || (real(x.issued) && x.issued <= d.asOfDay), what + ': issued ' + x.issued)); }
  if (id === 'census_acs') { assert.equal(d.latest, 2024); assert.equal(d.state, 'current'); assert.ok(d.years.every(y => y.year >= 2024 && y.year < +today.slice(0, 4))); }
}

const ref = {};
test('the reference day: every collector reads the recorded answers', async () => {
  for (const id of ALL) { const W = world(dallas(REF)), r = await runOnce(W, id, service(W)); assert.ok(!r.error, id + ': ' + (r.error && r.error.message)); assert.deepEqual(r.calls.filter(c => c.kind === 'unknown').map(c => c.url), [], id + ': a request the stand in does not know'); ref[id] = W.L.BY_ID[id].digest(r.data); checkRequests(id, r.calls, localDay(W.start), id); checkRecord(id, r.data, localDay(W.start), id); }
});
for (const when of CLOCKS) {
  test('the calendar: every collector at ' + when + ' Dallas time', async () => {
    for (const id of ALL) {
      const W = world(dallas(when)), today = localDay(W.start), what = id + ' at ' + when, r = await runOnce(W, id, service(W)), s = W.L.BY_ID[id];
      assert.ok(!r.error, what + ': ' + (r.error && r.error.stack));
      assert.ok(r.calls.length <= MAX_REQ[id], `${what}: ${r.calls.length} requests`); assert.ok(r.ms < (s.timeoutMs || 120000), `${what}: ${r.ms} ms on the simulated clock`);
      checkRequests(id, r.calls, today, what); checkRecord(id, r.data, today, what);
      const dg = JSON.parse(JSON.stringify(s.digest(r.data))); assert.equal(junk(dg), null, what + ': junk in the digest');
      assert.deepEqual(Object.keys(dg).sort(), Object.keys(ref[id]).sort(), what + ': the digest keeps its fields');
      for (const k of Object.keys(dg)) if (dg[k] !== null && ref[id][k] !== null) assert.equal(shape(dg[k]), shape(ref[id][k]), `${what}: digest.${k} changed kind`);
      for (const k of Object.keys(s.labels || {})) assert.ok(k in dg, what + ': a labeled number is missing from the digest: ' + k);
    }
  });
}

/* ---------- the same store week after week across a boundary ---------- */
async function sequence(id, clocks, opt) {
  const out = []; let prev = null;
  for (const when of clocks) { const W = world(dallas(when)), r = await runOnce(W, id, service(W, opt && opt(when)), prev); out.push({ when, r, W, digest: r.error ? null : JSON.parse(JSON.stringify(W.L.BY_ID[id].digest(r.data))) }); if (!r.error) prev = r.data; }
  return out;
}
test('the heating season turns on July 1: the season to date starts over, the archive pulls the season that ended once more', async () => {
  const days = ['2027-06-29 05:00', '2027-06-30 05:00', '2027-07-01 05:00', '2027-07-02 05:00', '2027-07-03 05:00', '2027-07-04 05:00'];
  const acis = await sequence('acis_season', days);
  assert.deepEqual(acis.map(x => (x.r.error ? 'failed' : x.r.data.season + ' ' + x.r.data.through + ' ' + x.r.data.daily.n)), ['2026 2027-06-28 363', '2026 2027-06-29 364', '2026 2027-06-30 365', '2027 2027-07-01 1', '2027 2027-07-02 2', '2027 2027-07-03 3']);
  for (const x of acis.slice(3)) { assert.deepEqual(Object.keys(x.r.data.stale).filter(k => x.r.data.stale[k]), [], x.when + ': nothing of the season that ended is carried into the new one'); assert.ok(JSON.stringify(x.r.data).length < 60000, 'the daily block starts over: ' + JSON.stringify(x.r.data).length); }
  const weeks = ['2027-06-21 06:00', '2027-06-28 06:00', '2027-07-05 06:00', '2027-07-12 06:00'];
  const iem = await sequence('iem_cold', weeks);
  assert.deepEqual(iem.map(x => x.r.data.season), [2026, 2026, 2027, 2027]);
  assert.deepEqual(iem.map(x => x.r.calls.map(c => +/sts=(\d{4})/.exec(c.url)[1])), [[2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016], [2026], [2027, 2026], [2027]], 'the first read pulls ten winters, a week later one request, the first run of July the new season and the one that just ended');
  assert.deepEqual(iem.map(x => x.digest.seasons), [10, 10, 11, 11]); assert.deepEqual(iem.map(x => x.digest.firstFreezeWarning), ['none in the fall', 'none in the fall', 'none yet', 'none yet']);
  assert.ok(JSON.stringify(iem[3].r.data).length <= JSON.stringify(iem[2].r.data).length + 50 && JSON.stringify(iem[1].r.data).length <= JSON.stringify(iem[0].r.data).length + 50, 'a week adds nothing to the archive');
});
test('the year turns: permits keep 36 consecutive complete months, no month lost at the turn', async () => {
  for (const id of ['permits_dallas', 'permits_fortworth']) {
    const seq = await sequence(id, ['2026-12-28 06:00', '2027-01-04 06:00', '2027-01-11 06:00', '2027-02-01 06:00', '2027-02-08 06:00']);
    assert.deepEqual(seq.map(x => (x.r.error ? x.r.error.message : x.r.data.months[x.r.data.months.length - 1].m)), ['2026-11', '2026-12', '2026-12', '2026-12', '2027-01'], id + ': the newest complete month');
    for (const x of seq) { assert.deepEqual(Object.keys(x.digest).sort(), Object.keys(ref[id]).sort()); assert.equal(typeof x.digest.mech12, 'number'); }
  }
});
test('the grid history holds 45 days however long it runs, the outlook trail 30 issues, the notice text no stale season', async () => {
  let prev = null, size = 0;
  for (let day = '2027-01-01', i = 0; i < 70; i++, day = addDays(day, 1)) { const W = world(dallas(day + ' 05:00')), r = await runOnce(W, 'ercot_grid', service(W), prev); assert.ok(!r.error, day); prev = r.data; size = JSON.stringify(prev).length; assert.ok(prev.zone.length <= 45 && r.calls.length <= 4); }
  assert.equal(prev.zone.length, 45); assert.ok(size < 9000, 'the stored grid record stays under 9 KB: ' + size);
});

test('the season sentence through the year: last season on July 1, a summer of zeros without a rank, the first freeze of November read in January', async () => {
  const w2 = edit => ({ over: { 'acis.W2': ok => { const j = JSON.parse(ok()); j.data.forEach(r => edit(r.data, r.meta.uid === 29755)); return j; } } });
  const at = async (when, opt) => { const W = world(dallas(when)), r = await runOnce(W, 'acis_season', service(W, opt)); assert.ok(!r.error, when + ': ' + (r.error && r.error.message)); const s = W.L.climate.status(r.data, null, new W.ctx.Date(W.start)); return { s, text: W.L.climate.headline(s), data: r.data, W }; };
  /* July 1: the record still ends June 30 and is last season's; July 2: the new season */
  const jul1 = await at('2027-07-01 05:00'); assert.equal(jul1.s.season, 2026); assert.equal(jul1.s.current, false); assert.match(jul1.text, /^Last heating season: /); assert.match(jul1.text, /among 31 seasons/);
  const jul2 = await at('2027-07-02 05:00'); assert.equal(jul2.s.season, 2027); assert.equal(jul2.s.current, true); assert.match(jul2.text, /^Heating season to date: /);
  /* a summer: nothing has been needed yet, in this year or in any of the 30 on record */
  const zeros = { over: Object.assign(w2(d => { for (const k of [0, 2, 3, 5, 7]) d[k] = ['0', 0]; d[1] = d[4] = d[6] = d[8] = '0'; d[9] = 'M'; d[11] = ['71', '2027-07-04']; d[12] = '74'; }).over, { 'acis.W3': ok => { const j = JSON.parse(ok()); j.data.forEach(r => { r.data = r.data.map(() => [['0', 0], ['0', 0]]); }); return j; } }) };
  const aug = await at('2027-08-16 06:00', zeros);
  assert.equal(aug.s.metro.rank, null, 'a tie of every fall at zero is no rank'); assert.equal(aug.text, 'Heating season to date: 0 heating degree days at DFW Airport against a normal of 0; no freeze yet, the median first freeze is November 24.');
  assert.deepEqual(JSON.parse(JSON.stringify(aug.W.L.BY_ID.acis_season.digest(aug.data))), { hdd: 0, norm: 0, pct: null, fr32: 0, stations: 64, freezeCounties: 0, through: '2027-08-15' });
  /* January: the first freeze fell on November 28, in the calendar year before */
  const jan = await at('2027-01-15 05:00', w2((d, dfw) => { if (dfw) { d[9] = '2026-11-28'; d[7] = ['14', 0]; d[0] = ['1100', 0]; d[1] = '1050'; d[2] = ['1090', 0]; } }));
  assert.deepEqual([jan.s.season, jan.s.metro.firstFreeze.state, jan.s.metro.firstFreeze.date, jan.s.metro.firstFreeze.median, jan.s.metro.firstFreeze.daysVsMedian], [2026, 'occurred', '2026-11-28', '2026-11-24', 4]);
  assert.match(jan.text, /first freeze November 28, 4 days after the median date, 14 freeze nights so far\.$/); assert.match(jan.text, /among 31 seasons/);
  /* January after a fall without a freeze at the airport: pending, and past the median */
  const warm = await at('2027-01-15 05:00'); assert.equal(warm.s.metro.firstFreeze.state, 'pending'); assert.equal(warm.s.metro.firstFreeze.climText, 'over 90'); assert.match(warm.text, /no freeze yet, 52 days past the median first freeze of November 24/);
});

/* ---------- the pure date helpers on their edges ---------- */
test('date helpers: season spans, month arithmetic, windows and the year a named date belongs to', async () => {
  const W = world(dallas(REF)), L = W.L, A = L.acis, P = L.permits;
  const sp = (d, o) => { const s = A.span(d); for (const k in o) assert.equal(s[k], o[k], `span(${d}).${k}`); };
  sp('2027-06-30', { season: 2026, start: '2026-07-01', n: 365, y0: 1992, y1: 2021, md: '06-30', gateOct: true }); sp('2027-07-01', { season: 2027, start: '2027-07-01', n: 1, y0: 1991, y1: 2020, gateOct: false });
  sp('2028-02-29', { season: 2027, n: 244, md: '02-28', y0: 1992 }); sp('2028-06-30', { season: 2027, n: 366 }); sp('2026-12-31', { season: 2026, n: 184, y0: 1991 }); sp('2027-01-01', { season: 2026, n: 185, y0: 1992, y1: 2021, gateOct: true }); sp('2027-09-30', { gateOct: false }); sp('2027-10-01', { gateOct: true });
  assert.equal(A.dates(dallas('2027-01-01 00:30')).through, '2026-12-31'); assert.equal(A.dates(dallas('2026-12-31 23:30')).through, '2026-12-30'); assert.equal(A.dates(dallas('2027-07-01 00:10')).through, '2027-06-30'); assert.equal(A.dates(dallas('2028-03-01 05:00')).through, '2028-02-29');
  assert.equal(P.addMonths('2027-01', -1), '2026-12'); assert.equal(P.addMonths('2026-12', 1), '2027-01'); assert.equal(P.addMonths('2027-03', -40), '2023-11'); assert.equal(P.addMonths('2027-01', -12), '2026-01'); assert.equal(P.addMonths('2026-11', 14), '2028-01');
  const w = JSON.parse(JSON.stringify(P.windows('2027-01-04'))); assert.deepEqual(w, { cur: '2027-01', last: '2026-12', z0: '2026-01-01', z1: '2027-01-01', r0: '2026-11-10', r1: '2027-01-04', y0: '2025-11-11', y1: '2026-01-05' });
  const leapW = P.windows('2028-02-29'); assert.equal(leapW.y1, '2027-03-02', '52 weeks back, the same weekday'); assert.equal(leapW.r0, '2028-01-05'); assert.equal(leapW.z0, '2027-02-01');
  assert.equal(P.today(dallas('2026-12-31 23:30')), '2026-12-31'); assert.equal(P.today(dallas('2027-01-01 00:30')), '2027-01-01'); assert.equal(P.month(dallas('2027-03-14 03:30')), '2027-03');
  for (const through of ['2026-12-31', '2027-01-04', '2027-03-01', '2027-07-01', '2028-02-29', '2028-03-01']) { const pl = L.permitsDallas.plan(through), cuts = Array.from(pl.cuts); assert.deepEqual(cuts, cuts.slice().sort()); assert.ok(cuts.every(real) && cuts[0] <= through, through); for (const k of ['z', 'r', 'y']) assert.ok(pl.seg[k].length >= 1 || k === 'z', through + ': window ' + k + ' holds a segment'); }
  /* a date named in a discussion belongs to the year after the issue when the issue is in December and the date in January */
  const N = L.cpc.dateNear; assert.equal(N('Jan', 3, '2026-12-28T20:00:00+00:00'), '2027-01-03'); assert.equal(N('Dec', 30, '2026-12-22T20:00:00+00:00'), '2026-12-30'); assert.equal(N('Jan', 9, '2027-01-01T20:00:00+00:00'), '2027-01-09'); assert.equal(N('Mar', 1, '2028-02-22T20:00:00+00:00'), '2028-03-01'); assert.equal(N('Feb', 29, '2028-02-20T20:00:00+00:00'), '2028-02-29'); assert.equal(N('Jul', 4, '2027-06-25T20:00:00+00:00'), '2027-07-04');
  const thr = L.cpc.parseThr('SYNOPSIS: Cold. HAZARDS Slight risk of much below normal temperatures for the Southern Plains, Wed-Sun, Dec 30-Jan 3. DETAILED SUMMARY', '2026-12-22T20:00:00+00:00');
  assert.deepEqual([thr.items[0].start, thr.items[0].end], ['2026-12-30', '2027-01-03']);
  /* the class table row of a window: the last week of the year and the leap day */
  if (L.cpcClass) { for (const d of ['2026-12-28', '2027-01-01', '2028-02-29', '2028-03-01', '2028-12-31', '2027-07-01']) { const r = L.cpc.classRow(L.cpcClass, d, 7); assert.ok(r && r.length >= 7 && r.every(Number.isFinite), 'a class row for ' + d); } assert.deepEqual(Array.from(L.cpc.classRow(L.cpcClass, '2028-03-01', 7)), Array.from(L.cpc.classRow(L.cpcClass, '2027-03-01', 7)), 'March 1 reads the same row in a leap year'); }
  /* the months of a rules window: 24 months back from a day another month does not have */
  for (const [now, since] of [['2028-02-29 05:00', '2026-03-01'], ['2027-08-31 05:00', '2025-08-31'], ['2027-03-31 05:00', '2025-03-31'], ['2026-12-31 23:30', '2025-01-01']]) { const u = decodeURIComponent(Array.from(L.fedreg.urls(dallas(now)))[0]); assert.ok(u.includes('[gte]=' + since), now + ': ' + /\[gte\]=[\d-]+/.exec(u)); }
  /* the vintages worth asking about */
  assert.deepEqual(Array.from(L.census.candidates(dallas('2026-12-31 23:30'))), [2024, 2025]); assert.deepEqual(Array.from(L.census.candidates(dallas('2027-01-01 00:30'))), [2024, 2025]); assert.deepEqual(Array.from(L.census.candidates(dallas('2027-09-01 05:00'))), [2024, 2025, 2026]); assert.deepEqual(Array.from(L.census.candidates(dallas('2031-01-01 05:00'))), [2024, 2025, 2026, 2027]);
  assert.equal(L.iem.seasonAt(dallas('2027-06-30 23:59')), 2026); assert.equal(L.iem.seasonAt(dallas('2027-07-01 00:01')), 2027);
});
