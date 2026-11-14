/* The browser app's background worker against the calendar and against a bad morning: app/background.js run in a vm with
   a fake chrome object and a clock that can be set (tests/helpers/fakechrome.mjs). These are the cases that decide whether
   "refreshes every week, the forecast every morning" stays true with nobody watching: a refresh pressed in the afternoon,
   a laptop that fires its missed alarms the moment it wakes (before its network is back), a worker killed in mid run. */
process.env.TZ = 'America/Chicago';
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWorld } from './helpers/fakechrome.mjs';

const at = (y, mo, d, h, mi) => new Date(y, mo - 1, d, h || 0, mi || 0, 0);
const local = d => d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : null;
const DAILY = ['nws_cold', 'acis_season', 'cpc_outlook', 'nbm_extended', 'ercot_grid'];
/* a world where every source answered at `when` (state and records as a clean full refresh leaves them) */
async function fresh(when) { const w = makeWorld({ now: when }); w.boot(); w.chrome.runtime.onInstalled.fire({ reason: 'update' }); await w.settle(); return w; }

test('the stand in world is the real worker: 12 sources, 5 of them on the morning pulse', () => {
  const w = makeWorld({ now: at(2026, 11, 13, 19) }); w.boot();
  assert.equal(w.L.SOURCES.length, 12);
  assert.deepEqual([...w.L.SOURCES].filter(s => s.cadence === 'daily').map(s => s.id).sort(), DAILY.slice().sort());
  w.kill();
});

test('schedule: the next slots are right across both daylight saving changes of 2027, a month end and a year end', () => {
  const w = makeWorld({ now: at(2026, 11, 13, 19) }); w.boot(); const L = w.L;
  assert.equal(local(L.nextDaily(at(2027, 3, 13, 12), 5)), '2027-03-14 05:00');                       // the night the clocks go forward
  assert.equal((+L.nextDaily(at(2027, 3, 13, 12), 5) - +at(2027, 3, 13, 12)) / 36e5, 16, 'one hour less of night');
  assert.equal(local(L.nextDaily(at(2027, 11, 6, 12), 5)), '2027-11-07 05:00');                       // the night they go back
  assert.equal((+L.nextDaily(at(2027, 11, 6, 12), 5) - +at(2027, 11, 6, 12)) / 36e5, 18, 'one hour more of night');
  assert.equal(local(L.nextWeekly(at(2027, 3, 12, 9), 1, 6)), '2027-03-15 06:00');
  assert.equal(local(L.nextWeekly(at(2027, 11, 5, 9), 1, 6)), '2027-11-08 06:00');
  assert.ok(+L.nextDaily(at(2027, 3, 13, 23), 2) > +at(2027, 3, 13, 23), 'an hour that does not exist that night still gives a time ahead');
  assert.ok(+L.nextDaily(at(2027, 11, 7, 1, 30), 1) > +at(2027, 11, 7, 1, 30), 'an hour that comes twice is not run twice');
  assert.equal(local(L.nextDaily(at(2026, 11, 30, 23), 5)), '2026-12-01 05:00');
  assert.equal(local(L.nextDaily(at(2026, 12, 31, 23, 30), 5)), '2027-01-01 05:00');
  assert.equal(local(L.nextWeekly(at(2026, 12, 28, 6), 1, 6)), '2027-01-04 06:00', 'exactly on the slot means the next one');
  assert.equal(local(L.nextWeekly(at(2026, 12, 28, 5, 59), 1, 6)), '2026-12-28 06:00');
  for (let dow = 0; dow < 7; dow++) for (const hour of [0, 6, 23]) { const n = L.nextWeekly(at(2027, 2, 26, 12), dow, hour); assert.equal(n.getDay(), dow); assert.equal(n.getHours(), hour); assert.ok(+n > +at(2027, 2, 26, 12) && +n - +at(2027, 2, 26, 12) <= 7 * 864e5 + 36e5); }
  w.kill();
});

test('due: the hour of the pulse is what counts, not twenty hours since the last refresh', () => {
  const w = makeWorld({ now: at(2026, 11, 17, 5) }); w.boot(); const L = w.L, S = { daily: true, dailyHour: 5 };
  const st = (weekly, daily) => ({ lastWeekly: weekly.toISOString(), lastDaily: (daily || weekly).toISOString() });
  assert.equal(L.due(st(at(2026, 11, 16, 6), at(2026, 11, 17, 15)), S, at(2026, 11, 18, 5)), 'daily', 'refreshed at 3 pm: the next 5 am pulse still runs');
  assert.equal(L.due(st(at(2026, 11, 16, 6), at(2026, 11, 17, 15)), S, at(2026, 11, 18, 4, 59)), null, 'and not before its hour');
  assert.equal(L.due(st(at(2026, 11, 16, 6), at(2026, 11, 18, 5)), S, at(2026, 11, 18, 5, 1)), null, 'a pulse that just ran is not run again');
  assert.equal(L.due(st(at(2026, 11, 16, 6), at(2026, 11, 18, 5)), S, at(2026, 11, 18, 23)), null, 'nor later the same day');
  assert.equal(L.due(st(at(2026, 11, 16, 12)), S, at(2026, 11, 17, 7, 30)), 'daily', 'first opened at noon: the next morning is due');
  assert.equal(L.due(st(at(2026, 11, 16, 6), at(2026, 11, 17, 15)), { daily: false, dailyHour: 5 }, at(2026, 11, 18, 5)), null, 'the pulse switched off stays off');
  assert.equal(L.due(st(at(2026, 11, 9, 6), at(2026, 11, 15, 5)), S, at(2026, 11, 16, 6)), 'weekly', 'seven days on, the full refresh comes first');
  assert.equal(L.due({}, S, at(2026, 11, 16, 6)), 'weekly', 'nothing ever ran: everything is due');
  assert.equal(L.due(st(at(2026, 11, 16, 6), at(2026, 11, 17, 3)), { daily: true }, at(2026, 11, 17, 22)), null, 'with no hour set the old twenty hour rule holds');
  assert.equal(L.due(st(at(2026, 11, 16, 6), at(2026, 11, 17, 3)), { daily: true }, at(2026, 11, 17, 23)), 'daily');
  w.kill();
});

test('install opens the Heat Desk once and starts the first refresh; an update opens nothing', async () => {
  const w = makeWorld({ now: at(2026, 11, 13, 19) }); w.boot();
  w.chrome.runtime.onInstalled.fire({ reason: 'install' }); await w.settle();
  assert.deepEqual(w.created.map(u => u.replace(/^.*\//, '')), ['atlas.html#heat']);
  assert.deepEqual(w.runs(), ['weekly:12']);
  assert.equal(local(w.alarmAt('tda-weekly')), '2026-11-16 06:00'); assert.equal(local(w.alarmAt('tda-daily')), '2026-11-14 05:00');
  assert.equal(w.alarmAt('tda-retry'), null, 'a clean run leaves no retry armed');
  w.boot(); w.chrome.runtime.onInstalled.fire({ reason: 'update', previousVersion: '5.0.0' }); await w.settle();
  assert.equal(w.created.length, 1, 'no second tab'); assert.deepEqual(w.runs(), ['weekly:12'], 'nothing is due minutes after a full refresh');
  w.kill();
});

test('a normal week: the pulse runs every morning from the first one, the full refresh on Monday, and both alarms are always armed', async () => {
  const w = makeWorld({ now: at(2026, 11, 13, 19) }); w.boot();
  w.chrome.runtime.onInstalled.fire({ reason: 'install' }); await w.settle();
  const seen = [];
  for (const [d, h] of [[14, 5], [15, 5], [16, 5], [16, 6], [17, 5]]) {
    w.at(at(2026, 11, d, h)); w.boot(); const fired = await w.fireDue();
    seen.push(`${d} ${h}h ${fired.join('+')} -> ${w.runs()[0]}`);
    assert.ok(w.alarmAt('tda-weekly') && +w.alarmAt('tda-weekly') > w.clock.now, 'weekly alarm ahead'); assert.ok(w.alarmAt('tda-daily') && +w.alarmAt('tda-daily') > w.clock.now, 'daily alarm ahead');
    assert.equal(w.alarmAt('tda-retry'), null);
  }
  assert.deepEqual(seen, ['14 5h tda-daily -> daily:5', '15 5h tda-daily -> daily:5', '16 5h tda-daily -> daily:5', '16 6h tda-weekly -> weekly:12', '17 5h tda-daily -> daily:5']);
  assert.equal(local(w.alarmAt('tda-weekly')), '2026-11-23 06:00');
  w.kill();
});

test('a refresh pressed in the afternoon does not cost the next morning its pulse', async () => {
  const w = await fresh(at(2026, 11, 17, 5));
  w.at(at(2026, 11, 17, 15)); w.boot(); const r = await w.send({ type: 'tda.live.refresh', scope: 'weekly' }); await w.settle();
  assert.equal(r.ok, true);
  w.at(at(2026, 11, 18, 5)); w.boot(); assert.deepEqual(await w.fireDue(), ['tda-daily']);
  assert.equal(w.runs()[0], 'daily:5', 'Wednesday 5 am ran');
  assert.equal(local(new Date(w.state().lastDaily)), '2026-11-18 05:00');
  w.kill();
});

test('a laptop opened at noon on Monday runs the full refresh then, and the pulse the next morning at wake', async () => {
  const w = await fresh(at(2026, 11, 15, 5));
  w.at(at(2026, 11, 16, 12)); w.boot(); assert.deepEqual((await w.fireDue()).sort(), ['tda-daily', 'tda-weekly']);
  assert.equal(w.runs()[0], 'weekly:12'); assert.equal(w.runs().length, 2, 'the two alarms that fired together made one run');
  w.at(at(2026, 11, 17, 7, 30)); w.boot(); assert.deepEqual(await w.fireDue(), ['tda-daily']);
  assert.equal(w.runs()[0], 'daily:5', 'Tuesday 7:30, nineteen and a half hours later, is a new morning');
  assert.equal(local(w.alarmAt('tda-daily')), '2026-11-18 05:00'); assert.equal(local(w.alarmAt('tda-weekly')), '2026-11-23 06:00');
  w.kill();
});

test('offline at wake: everything fails, the retry alarm stays armed, and the retry brings the data in', async () => {
  const w = await fresh(at(2026, 11, 9, 6));
  let offline = true; w.runSource = async id => { if (offline) throw new TypeError('Failed to fetch'); return { stub: id }; };
  w.at(at(2026, 11, 16, 8)); w.boot(); await w.fireDue();
  assert.equal(w.runs()[0].split(' ')[0], 'weekly:0'); assert.equal(w.failed().length, 12);
  assert.equal(local(new Date(w.state().lastWeekly)), '2026-11-09 06:00', 'a run that fetched nothing does not count as the weekly refresh');
  assert.equal(local(w.alarmAt('tda-retry')), '2026-11-16 08:08', 'the retry is still armed');
  assert.ok(w.alarmAt('tda-weekly') && w.alarmAt('tda-daily'), 'and so is the schedule');
  offline = false;
  w.at(at(2026, 11, 16, 8, 8)); w.boot(); assert.deepEqual(await w.fireDue(), ['tda-retry']);
  assert.equal(w.runs()[0], 'weekly:12'); assert.deepEqual(w.failed(), []);
  assert.equal(local(new Date(w.state().lastWeekly)), '2026-11-16 08:08');
  assert.equal(w.alarmAt('tda-retry'), null, 'a clean run clears it'); assert.equal(w.mem['tda.live.retry'].n, 0, 'and resets the count');
  w.kill();
});

test('sources that failed are asked again alone, twice at most, and the next scheduled run starts the count again', async () => {
  const w = await fresh(at(2026, 11, 9, 6));
  const down = new Set(['nws_cold', 'cpsc_recalls']); const asked = [];
  w.runSource = async id => { asked.push(id); if (down.has(id)) throw new TypeError('Failed to fetch'); return { stub: id }; };
  w.at(at(2026, 11, 16, 6)); w.boot(); await w.fireDue();
  assert.equal(w.runs()[0], 'weekly:10 failed nws_cold+cpsc_recalls');
  assert.equal(local(new Date(w.state().lastWeekly)), '2026-11-16 06:00', 'ten of twelve came in: the weekly refresh counts');
  assert.equal(local(w.alarmAt('tda-retry')), '2026-11-16 06:08');
  asked.length = 0;
  w.at(at(2026, 11, 16, 6, 8)); w.boot(); await w.fireDue();
  assert.deepEqual(asked.sort(), ['cpsc_recalls', 'nws_cold'], 'the first retry asks only the two that failed');
  assert.equal(w.mem['tda.live.retry'].n, 1); assert.ok(w.alarmAt('tda-retry'), 'still failing: one more try is armed');
  down.delete('nws_cold'); asked.length = 0;
  w.at(at(2026, 11, 16, 6, 16)); w.boot(); await w.fireDue();
  assert.deepEqual(asked.sort(), ['cpsc_recalls', 'nws_cold']); assert.deepEqual(w.failed(), ['cpsc_recalls'], 'the forecast is back the same morning');
  asked.length = 0;
  w.at(at(2026, 11, 16, 6, 24)); w.boot(); await w.fireDue();
  assert.deepEqual(asked, [], 'after two tries the source is left alone'); assert.equal(w.alarmAt('tda-retry'), null);
  /* the next morning's pulse is a new scheduled run: the count starts again; the weather sources are asked, and the weekly
     source that failed on Monday is asked once more with them, without a retry of its own */
  w.at(at(2026, 11, 17, 5)); w.boot(); await w.fireDue();
  assert.deepEqual(asked.slice().sort(), DAILY.concat('cpsc_recalls').sort()); assert.equal(asked.filter(x => x === 'cpsc_recalls').length, 1);
  assert.deepEqual(w.runs().slice(0, 2), ['cpsc_recalls:0 failed cpsc_recalls', 'daily:5']); assert.equal(w.mem['tda.live.retry'].n, 0);
  assert.deepEqual(w.failed(), ['cpsc_recalls'], 'the weekly source that is down says so until it answers');
  assert.equal(w.alarmAt('tda-retry'), null, 'the one extra try each morning arms no retry');
  /* the service is back on Wednesday: the morning pulse brings the weekly source in, five days before the next full refresh */
  down.delete('cpsc_recalls'); asked.length = 0;
  w.at(at(2026, 11, 18, 5)); w.boot(); await w.fireDue();
  assert.deepEqual(w.failed(), []); assert.deepEqual(w.runs().slice(0, 2), ['cpsc_recalls:1', 'daily:5']);
  asked.length = 0; w.at(at(2026, 11, 19, 5)); w.boot(); await w.fireDue();
  assert.deepEqual(asked.slice().sort(), DAILY.slice().sort(), 'with nothing failed, only the weather sources are asked');
  /* a source switched off in the settings is never asked again, by the retry or by the morning pulse */
  down.add('cpsc_recalls'); down.add('nws_cold');
  w.at(at(2026, 11, 23, 6)); w.boot(); await w.fireDue();
  assert.deepEqual(w.failed(), ['cpsc_recalls', 'nws_cold']);
  w.mem['tda.live.settings'] = Object.assign({}, w.mem['tda.live.settings'], { disabled: { cpsc_recalls: true } });
  w.at(at(2026, 11, 23, 6, 8)); w.boot(); asked.length = 0; await w.fireDue();
  assert.deepEqual(asked, ['nws_cold']);
  down.delete('nws_cold'); w.at(at(2026, 11, 24, 5)); w.boot(); asked.length = 0; await w.fireDue();
  assert.deepEqual(asked.slice().sort(), DAILY.slice().sort());
  w.kill();
});

test('a run that died holding the lock: the restart is locked out, the retry alarm survives it and finishes the job', async () => {
  const w = await fresh(at(2026, 11, 9, 6));
  let hang = true; w.runSource = id => (hang ? new Promise(() => { }) : Promise.resolve({ stub: id }));
  w.at(at(2026, 11, 16, 6)); w.boot(); const fired = (async () => w.fireDue())(); await w.settle(40); void fired;
  assert.ok(w.state().running, 'the run holds the lock'); assert.equal(local(w.alarmAt('tda-retry')), '2026-11-16 06:08');
  /* the browser is closed in mid run and started again two minutes later: the lock is still young */
  hang = false; w.at(at(2026, 11, 16, 6, 2)); w.boot(); w.chrome.runtime.onStartup.fire(); await w.settle();
  assert.equal(local(new Date(w.state().lastWeekly)), '2026-11-09 06:00', 'locked out: nothing ran yet');
  assert.ok(w.alarmAt('tda-retry'), 'the retry alarm is still armed after the locked out try');
  w.at(new Date(+w.alarmAt('tda-retry'))); w.boot(); assert.deepEqual(await w.fireDue(), ['tda-retry']);
  assert.equal(w.runs()[0], 'weekly:12'); assert.equal(local(new Date(w.state().lastWeekly)).slice(0, 10), '2026-11-16');
  assert.equal(w.alarmAt('tda-retry'), null); assert.ok(!w.state().running);
  w.kill();
});

test('the pulse switched off: no daily alarm and no daily run, the weekly refresh still comes', async () => {
  const w = await fresh(at(2026, 11, 9, 6));
  w.mem['tda.live.settings'] = { daily: false }; w.boot(); await w.send({ type: 'tda.live.schedule' }); await w.settle();
  assert.equal(w.alarmAt('tda-daily'), null); assert.equal(local(w.alarmAt('tda-weekly')), '2026-11-16 06:00');
  w.at(at(2026, 11, 12, 9)); w.boot(); w.chrome.runtime.onStartup.fire(); await w.settle();
  assert.deepEqual(w.runs(), ['weekly:12'], 'three days on, nothing is due');
  w.at(at(2026, 11, 16, 6)); w.boot(); await w.fireDue();
  assert.equal(w.runs()[0], 'weekly:12'); assert.equal(w.runs().length, 2);
  w.kill();
});

test('a new weekday and hour in the settings move the alarm, and a browser start puts back alarms that were lost', async () => {
  const w = await fresh(at(2026, 11, 9, 6));
  w.mem['tda.live.settings'] = { weeklyDow: 3, weeklyHour: 9, dailyHour: 7 }; w.boot(); await w.send({ type: 'tda.live.schedule' }); await w.settle();
  assert.equal(local(w.alarmAt('tda-weekly')), '2026-11-11 09:00'); assert.equal(local(w.alarmAt('tda-daily')), '2026-11-09 07:00');
  w.alarms.clear(); w.at(at(2026, 11, 10, 8)); w.boot(); w.chrome.runtime.onStartup.fire(); await w.settle();
  assert.equal(local(w.alarmAt('tda-weekly')), '2026-11-11 09:00'); assert.equal(local(w.alarmAt('tda-daily')), '2026-11-11 07:00');
  assert.equal(w.runs()[0], 'daily:5', 'and the missed morning is caught up');
  w.kill();
});
