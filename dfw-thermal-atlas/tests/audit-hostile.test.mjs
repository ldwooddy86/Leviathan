// Audit, part B: hostile answers, with a record of the week before in the store. Every kind of request of every collector
// meets every hostile answer of tests/audit-hostile-kit.mjs (an error document under HTTP 200, a web page, a cut off body, an
// empty list, renamed fields, numbers as text, nulls, ten times the rows, 429, 503, a hang, a dead network). Whatever comes,
// a collector returns a record that is right (and says which part is not this run's) or fails with a plain sentence, inside
// the time the runner gives it. The first read of a fresh install is swept in tests/audit-hostile-first.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sweep, violations, WHEN, MARKS, VARIANTS, textOf } from './audit-hostile-kit.mjs';
import { world, service, runOnce, dallas, fetcher, gridFor, HANG, raw, addDays } from './audit-kit.mjs';

let unhandled = 0; process.on('unhandledRejection', () => { unhandled++; });

test('hostile answers, a record in the store: right or marked or a plain failure, never garbage, never past the time limit', async () => {
  const rows = await sweep(true), bad = violations(rows, true);
  assert.ok(rows.length > 900, 'the sweep ran: ' + rows.length + ' runs');
  assert.deepEqual(bad, [], bad.length + ' of ' + rows.length + ' runs:\n' + bad.join('\n'));
  assert.equal(unhandled, 0, 'no unhandled rejection');
});

test('the forecast host hangs: the collector stops asking inside its time limit and leaves no request behind', async () => {
  for (const kind of ['nws.grid', '*']) {
    const W = world(dallas(WHEN)), f = service(W, { over: { [kind]: () => HANG } }), r = await runOnce(W, 'nws_cold', f), limit = W.L.BY_ID.nws_cold.timeoutMs;
    assert.ok(r.error, 'no point answered: the run fails and the runner keeps the last record'); assert.match(r.error.message, /timed out|out of time/);
    assert.ok(r.ms < limit, `${kind}: gave up after ${Math.round(r.ms / 1000)} s, the runner allows ${limit / 1000}`);
    const n = f.calls.length; await new Promise(res => setImmediate(res)); assert.equal(f.calls.length, n, 'nothing is asked after the run has ended'); assert.equal(W.timers.length, 0, 'and nothing is left waiting');
    assert.ok(n <= 12, kind + ': ' + n + ' requests to a host that does not answer');
  }
  /* a slow host is not a dead one: answers that take 12 seconds each still make a whole record of fresh and kept points */
  const W0 = world(dallas('2027-01-10 06:00')), before = await runOnce(W0, 'nws_cold', service(W0));
  const W = world(dallas(WHEN)), f = fetcher(W, [[/alerts/, { features: [] }], [/gridpoints/, () => new Promise(res => W.ctx.setTimeout(() => res(gridFor(W.start, () => 40)), 12000))]]);
  const r = await runOnce(W, 'nws_cold', f, before.data);
  assert.ok(!r.error, r.error && r.error.message); assert.ok(r.ms < W.L.BY_ID.nws_cold.timeoutMs, 'ended after ' + r.ms + ' ms');
  const fresh = r.data.points.filter(p => !p.stale && !p.err).length, kept = r.data.points.filter(p => p.stale).length;
  assert.ok(fresh >= 8 && fresh + kept === 20 && r.data.failed === kept, `${fresh} fresh and ${kept} kept of 20`); assert.ok(MARKS.nws_cold(r.data) || kept === 0);
});

test('answers in another shape: numbers as text, a station nobody asked for, an outlook without its dates', async () => {
  /* Fort Worth, the ZIP rows with every number as text: counted as numbers, the same record */
  const text = j => JSON.stringify(JSON.parse(j), (k, v) => (typeof v === 'number' ? String(v) : v));
  const Wg = world(dallas(WHEN)), good = await runOnce(Wg, 'permits_fortworth', service(Wg)), W = world(dallas(WHEN)), r = await runOnce(W, 'permits_fortworth', service(W, { over: { 'fw.zips': ok => text(textOf(ok())) } }));
  assert.deepEqual(r.data.byZip12, good.data.byZip12); assert.deepEqual(r.data.recent, good.data.recent); assert.equal(typeof r.data.recent.mech, 'number');
  /* the blend guidance answers for a seventh station: the record holds the six it asked for */
  const more = j => { const o = JSON.parse(j); o.data = o.data.concat(o.data.filter(x => x.station === 'KDFW').map(x => Object.assign({}, x, { station: 'KXYZ' }))); return JSON.stringify(o); };
  const Wn = world(dallas(WHEN)), n = await runOnce(Wn, 'nbm_extended', service(Wn, { over: { 'nbm.mos': ok => more(textOf(ok())) } }));
  assert.deepEqual(n.data.stations.map(s => s.id).sort(), ['KDAL', 'KDFW', 'KDTO', 'KFTW', 'KHQZ', 'KTKI']);
  /* an outlook area whose dates do not read replaces nothing: last week's outlook stays and the record says why */
  const W0 = world(dallas('2027-01-10 06:00')), before = await runOnce(W0, 'cpc_outlook', service(W0));
  const Wc = world(dallas(WHEN)), c = await runOnce(Wc, 'cpc_outlook', service(Wc, { over: { 'cpc.multi814': ok => text(textOf(ok())) } }), before.data);
  assert.ok(!c.error, c.error && c.error.message); assert.match(c.data.errs.d814, /without its dates/); assert.deepEqual(c.data.ext.d814, before.data.ext.d814, 'the stored outlook is kept'); assert.ok(c.data.ext.d814.issued);
});

test('every winter of the recorded archive has cold products in the 12 counties: an empty table for a winter that has ended is never the answer', () => {
  const lines = raw('iem/watchwarn-fwd-12-zones-2016-to-2026-2026-11-13.csv').split('\n').slice(1).filter(Boolean), by = {};
  for (const l of lines) { const d = l.slice(0, 10), s = +d.slice(0, 4) - (d.slice(5, 7) < '07' ? 1 : 0); by[s] = (by[s] || 0) + 1; }
  for (let s = 2016; s <= 2025; s++) assert.ok(by[s] > 0, 'season ' + s + ': ' + (by[s] || 0) + ' rows');
});

test('a set that only grows does not shrink without a word: recalls, the cold products of the running season, the rules', async () => {
  /* recalls: one search comes back empty where last week's record holds its recalls */
  const W0 = world(dallas('2027-01-04 06:00')), before = await runOnce(W0, 'cpsc_recalls', service(W0)); assert.equal(before.data.recalls.length, 14);
  for (const v of ['emptyList', 'renamedAll']) {
    const W = world(dallas(WHEN)), r = await runOnce(W, 'cpsc_recalls', service(W, { over: { 'cpsc.furnace': ok => VARIANTS[v](textOf(ok()), 'cpsc.furnace') } }), before.data);
    assert.ok(!r.error); assert.equal(r.data.recalls.length, 14, v + ': the recalls of the search that came back empty are kept'); assert.ok(r.data.failed >= 1 && r.data.err, v + ': and the record says a search did not answer');
  }
  /* a search that has always been empty stays an answer */
  const W1 = world(dallas(WHEN)), calm = await runOnce(W1, 'cpsc_recalls', service(W1), before.data); assert.equal(calm.data.failed, 0); assert.equal(calm.data.err, undefined);
  /* the cold products of the running season: the season of January 2026 holds products; the table comes back with its header only */
  const Wa = world(dallas('2026-01-05 06:00')), a = await runOnce(Wa, 'iem_cold', service(Wa)), held = a.data.events.length; assert.ok(held > 5, 'products held: ' + held);
  const Wb = world(dallas('2026-01-12 06:00')), b = await runOnce(Wb, 'iem_cold', service(Wb, { over: { 'iem.season': ok => ok().split('\n')[0] + '\n' } }), a.data);
  assert.ok(b.error, 'the run fails and the stored season stays'); assert.match(b.error.message, /came back empty/); assert.doesNotMatch(b.error.message, /undefined|null/);
  /* early in a season an empty table is the answer */
  const Wc = world(dallas('2027-07-05 06:00')), c = await runOnce(Wc, 'iem_cold', service(Wc)); assert.ok(!c.error, c.error && c.error.message); assert.equal(c.data.events.filter(e => e[3] >= Date.UTC(2027, 6, 1) / 6e4).length, 0);
  /* a winter of the archive never comes back empty: it is asked again, not stored as a winter without a freeze */
  const Wd = world(dallas('2027-01-11 06:00')), d = await runOnce(Wd, 'iem_cold', service(Wd, { over: { 'iem.season': (ok, url) => (/sts=2025/.test(url) ? ok().split('\n')[0] + '\n' : ok()) } }));
  assert.ok(!d.error); assert.ok(!d.data.seasons.includes(2025) && d.data.staleWhy && 2025 in d.data.stale, 'the empty winter is not held: ' + JSON.stringify([d.data.seasons, d.data.stale, d.data.staleWhy]));
});
