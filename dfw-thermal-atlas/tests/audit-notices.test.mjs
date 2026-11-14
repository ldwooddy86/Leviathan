// Audit, part C: the notices. The background worker sends a notice when its key is not among the keys already sent, so a key
// that changes from one morning to the next is a notification every morning. These tests run the forecast collector morning
// after morning against a grid written for a table of lows and read the notices the way the worker does.
import test from 'node:test';
import assert from 'node:assert/strict';
import { world, fetcher, service, runOnce, dallas, localDay, addDays, gridFor } from './audit-kit.mjs';

const FILES = ['live/core.js', 'live/geo.js', 'live/sources/nws_cold.js', 'live/derive.js'];
/* every morning from `from` to `to` at `hour` Dallas time: refresh the forecast, then read the notices as the worker would.
   Returns [{ day, keys, fresh }]: fresh are the keys never seen before, the ones that become notifications. */
async function mornings(from, to, hour, lowOf, opt) {
  const out = [], sent = []; let prev = null;
  for (let day = from; day <= to; day = addDays(day, 1)) {
    const W = world(dallas(day + ' ' + hour), FILES), now = W.now();
    const f = fetcher(W, [[/alerts\/active/, { features: (opt && opt.alerts ? opt.alerts(day) : []) }], [/\/gridpoints\//, () => gridFor(now, lowOf)]]);
    const r = await runOnce(W, 'nws_cold', f, prev); assert.ok(!r.error, day + ': ' + (r.error && r.error.message));
    prev = r.data;
    const recs = { nws_cold: { id: 'nws_cold', ok: true, at: new Date(now).toISOString(), data: r.data } };
    const notes = W.L.derive.notices(recs, new W.ctx.Date(W.now()), opt && opt.derive), keys = Array.from(notes, n => n.key), fresh = keys.filter(k => !sent.includes(k));
    sent.push(...fresh); out.push({ day, keys, fresh, notes, cold: W.L.derive.cold(recs, new W.ctx.Date(W.now()), opt && opt.derive) });
  }
  return out;
}
const spell = (ranges, cold, mild) => d => (ranges.some(([a, b]) => d >= a && d <= b) ? cold : mild == null ? 45 : mild);

for (const hour of ['05:00', '09:30']) {
  test('a freeze of five nights is announced once, not again each morning as its nights pass (pulse at ' + hour + ')', async () => {
    const days = await mornings('2027-01-06', '2027-01-18', hour, spell([['2027-01-11', '2027-01-15']], 28));
    const fresh = days.flatMap(x => x.fresh.map(k => x.day + ' ' + k));
    assert.equal(fresh.length, 1, 'one notification for one spell, got: ' + fresh.join(' | '));
    assert.match(fresh[0], /^2027-01-06 tier3:2027-01-11$/, 'sent the first morning the freeze is in view, keyed by its first night');
    assert.deepEqual(days.filter(x => x.day >= '2027-01-16').flatMap(x => x.keys), [], 'and nothing once it is over');
  });
}

test('a second freeze after a mild stretch is a new trigger, and a spell that deepens to a hard freeze says so once', async () => {
  const two = await mornings('2027-01-06', '2027-01-24', '05:00', spell([['2027-01-11', '2027-01-13'], ['2027-01-19', '2027-01-20']], 30));
  assert.deepEqual(two.flatMap(x => x.fresh), ['tier3:2027-01-11', 'tier3:2027-01-19']);
  /* the third night of the spell turns out a hard freeze: forecast at 28, then 22 from the morning of January 12 on */
  const lows = now => d => (d >= '2027-01-11' && d <= '2027-01-15' ? (d === '2027-01-13' && now >= '2027-01-12' ? 22 : 28) : 45);
  const out = [], sent = []; let prev = null;
  for (let day = '2027-01-08'; day <= '2027-01-17'; day = addDays(day, 1)) {
    const W = world(dallas(day + ' 05:00'), FILES), now = W.now(), f = fetcher(W, [[/alerts\/active/, { features: [] }], [/\/gridpoints\//, () => gridFor(now, lows(day))]]);
    const r = await runOnce(W, 'nws_cold', f, prev); prev = r.data;
    const keys = Array.from(W.L.derive.notices({ nws_cold: { ok: true, at: new Date(now).toISOString(), data: r.data } }, new W.ctx.Date(now)), n => n.key);
    out.push(...keys.filter(k => !sent.includes(k)).map(k => day + ' ' + k)); sent.push(...keys);
  }
  assert.deepEqual(out, ['2027-01-08 tier3:2027-01-11', '2027-01-12 tier4:2027-01-11']);
});

test('a winter of freezing edges every night is one notice, not one a morning', async () => {
  const days = await mornings('2027-01-02', '2027-02-10', '05:00', () => 30);
  assert.equal(days.flatMap(x => x.fresh).length, 1, days.flatMap(x => x.fresh).join(' | '));
});

test('the forecast that flickers (a freeze, gone the next morning, back the morning after) does not notify twice', async () => {
  const flick = { '2027-01-07': 1, '2027-01-09': 1 };
  const out = [], sent = []; let prev = null;
  for (let day = '2027-01-06'; day <= '2027-01-13'; day = addDays(day, 1)) {
    const W = world(dallas(day + ' 05:00'), FILES), now = W.now(), lowOf = d => (d === '2027-01-11' && !flick[day] ? 31 : 40);
    const r = await runOnce(W, 'nws_cold', fetcher(W, [[/alerts\/active/, { features: [] }], [/\/gridpoints\//, () => gridFor(now, lowOf)]]), prev); prev = r.data;
    const keys = Array.from(W.L.derive.notices({ nws_cold: { ok: true, at: new Date(now).toISOString(), data: r.data } }, new W.ctx.Date(now)), n => n.key);
    out.push(...keys.filter(k => !sent.includes(k))); sent.push(...keys);
  }
  assert.deepEqual(out, ['tier3:2027-01-11']);
});

test('July: no cold notice, no badge, nothing thrown, whatever hour the pulse runs', async () => {
  for (const hour of ['00:30', '05:00', '15:00']) {
    const days = await mornings('2027-06-29', '2027-07-03', hour, () => 78);
    for (const x of days) { assert.deepEqual(x.keys, [], x.day + ' ' + hour); assert.equal(x.cold.ok, true); assert.equal(x.cold.tier, 0); assert.equal(x.cold.active, false); }
  }
});

test('a season record that stopped weeks ago does not make a January freeze "the first freeze of the season"', async () => {
  /* the climate source last answered on November 13 (29 heating degree days, no freeze yet); the forecast is this morning's */
  const W0 = world(dallas('2026-11-13 12:40')), a = await runOnce(W0, 'acis_season', service(W0)); assert.ok(!a.error, a.error && a.error.message);
  const season = { id: 'acis_season', ok: false, at: new Date(W0.start).toISOString(), data: a.data, err: { at: '2027-01-10T11:00:00Z', msg: 'W2: ACIS answered HTTP 500' } };
  const read = async (when, lowOf, acis) => { const W = world(dallas(when)), now = W.now(), r = await runOnce(W, 'nws_cold', fetcher(W, [[/alerts\/active/, { features: [] }], [/\/gridpoints\//, () => gridFor(now, lowOf)]]), null); const recs = { nws_cold: { ok: true, at: new Date(now).toISOString(), data: r.data }, acis_season: acis }; return { cold: W.L.derive.cold(recs, new W.ctx.Date(now)), notes: Array.from(W.L.derive.notices(recs, new W.ctx.Date(now))) }; };
  const jan = await read('2027-01-10 05:00', spell([['2027-01-11', '2027-01-12']], 27, 40), season);
  assert.equal(jan.cold.season, null, 'a season to date observed through November 12 is no reading of January 10');
  assert.equal(jan.cold.firstFreezeAhead, null); assert.doesNotMatch(jan.notes[0].message, /first freeze of the season/); assert.match(jan.notes[0].message, /^Freeze across the metro Monday night: lows 27°F\. 12 of 12 counties/);
  const cool = await read('2027-01-10 05:00', () => 44, season);
  assert.equal(cool.cold.firstHeatingWeek, false, 'nor is a January week "the first heating week of the season"'); assert.deepEqual(cool.notes, []);
  /* the same record read while it is current still carries the season */
  const nov = await read('2026-11-14 05:00', spell([['2026-11-16', '2026-11-16']], 30, 44), Object.assign({}, season, { ok: true, err: undefined }));
  assert.equal(nov.cold.season.hdd, 29); assert.match(nov.notes[0].message, /It would be the first freeze of the season\.$/);
  /* and a record of the season that ended on June 30 is not the season of an early October cold snap */
  const W1 = world(dallas('2027-06-30 05:00')), b = await runOnce(W1, 'acis_season', service(W1));
  const oct = await read('2027-07-03 05:00', () => 78, { id: 'acis_season', ok: true, at: new Date(W1.start).toISOString(), data: b.data });
  assert.equal(oct.cold.season, null, 'last season is not this one');
});

/* The two week outlook notice (live/outlook.js) is keyed by the date its evidence starts on. For the blend guidance that date
   is the morning with the best freeze chance among mornings 6 to 11 days out: it changes when a colder morning comes into
   view and again when that morning comes nearer than six days, so one cold shot of three mornings gives three keys. The worker
   (announce() in app/background.js) treats an outlook key within three days of one already announced, at the same tier or
   higher, as the same shot; tests/ext-worker.test.mjs holds that rule. This test holds the other half: the keys of one shot
   stay within that reach of each other, so the rule replayed over them sends one notification. */
test('the outlook keys of one cold shot stay within three days of each other, so the worker announces the shot once', async () => {
  const p32 = { '2027-01-18': 60, '2027-01-19': 70, '2027-01-20': 55 }, sent = [];
  for (let day = '2027-01-05'; day <= '2027-01-16'; day = addDays(day, 1)) {
    const W = world(dallas(day + ' 05:00')), now = W.now(), run = addDays(day, -1) + 'T19:00:00.000Z';
    const nights = [6, 7, 8, 9, 10, 11].map(lead => { const m = addDays(day, lead), p = p32[m] || 5; return { m, d: addDays(m, -1), lead, lowF: p >= 50 ? 31 : 41, sd: 4, p32: p, p40: 50, p25: 1, ext: lead >= 8 }; });
    const recs = { nbm_extended: { ok: true, at: new Date(now).toISOString(), data: { v: 1, model: 'NBE', run, from: 6, th: { freeze: 32, cold: 40, hard: 25 }, stations: [{ id: 'KDTO', name: 'Denton', county: 'Denton', run, nights, days: [] }] } } };
    for (const n of Array.from(W.L.derive.outlookNotice(recs, new W.ctx.Date(now)))) if (!sent.includes(n.key)) sent.push(n.key);
  }
  assert.ok(sent.length >= 1 && sent.every(k => /^outlook:\d:\d{4}-\d\d-\d\d$/.test(k)), 'the keys read as outlook, tier, day: ' + sent.join(' | '));
  const tier = k => +k.split(':')[1], noon = k => +new Date(k.split(':')[2] + 'T12:00:00Z'), known = [], told = [];
  for (const k of sent) { const again = known.some(p => tier(p) >= tier(k) && Math.abs(noon(k) - noon(p)) <= 3 * 864e5); known.push(k); if (!again) told.push(k); }
  assert.equal(told.length, 1, 'notifications for one cold shot: ' + told.join(' | ') + ' (keys: ' + sent.join(' | ') + ')');
});

test('a notice from a record without the spell (the baked baseline, a record stored by an earlier build) still reads', async () => {
  const W = world(dallas('2027-01-10 05:00'), FILES), now = W.now();
  const r = await runOnce(W, 'nws_cold', fetcher(W, [[/alerts\/active/, { features: [] }], [/\/gridpoints\//, () => gridFor(now, spell([['2027-01-11', '2027-01-12']], 29))]]), null);
  delete r.data.spell;
  assert.deepEqual(Array.from(W.L.derive.notices({ nws_cold: { ok: true, at: new Date(now).toISOString(), data: r.data } }, new W.ctx.Date(now)), n => n.key), ['tier3:2027-01-11']);
  assert.equal(localDay(now), '2027-01-10');
});
