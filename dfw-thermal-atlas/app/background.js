/* DFW Thermal Debt Atlas · background service worker.
   Keeps the live data fresh without the page being open: a full refresh of every public source once a week (Monday 6 am by
   default), a light weather pulse once a day, and a catch up at browser start when a run was missed. After each run it sets
   the toolbar badge to the coldest forecast low of the week when a cold trigger is active and, if notifications are on,
   sends one notification per new trigger (a freeze in the forecast, or a new cold, heat, air quality or severe storm alert). Also opens the atlas on install, on the keyboard command and from the address bar keyword "tda". */
"use strict";
importScripts('live/core.js', 'live/geo.js', 'live/climate_base.js', 'live/sources/nws_cold.js', 'live/sources/cpsc_recalls.js', 'live/sources/acis_season.js', 'live/sources/iem_cold.js', 'live/sources/cpc_outlook.js', 'live/sources/nbm_extended.js', 'live/sources/ercot_grid.js', 'live/permits.js', 'live/sources/permits_dallas.js', 'live/sources/permits_fortworth.js', 'live/sources/tdlr_licenses.js', 'live/sources/census_acs.js', 'live/sources/fedreg_rules.js', 'live/derive.js', 'live/climate.js', 'live/cpc_class.js', 'live/outlook.js'); /* live layer: kept in step with the template by build.mjs */
importScripts('registry.js', 'open.js');
const C = globalThis.chrome, L = globalThis.TDA_LIVE, O = globalThis.TDA_OPEN;
const store = L.chromeStore(C.storage.local);
const ALARM_WEEKLY = 'tda-weekly', ALARM_DAILY = 'tda-daily', ALARM_RETRY = 'tda-retry', NOTE_KEY = 'tda.live.notified', NOTE_ID = 'tda-cold', RETRY_KEY = 'tda.live.retry';
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- schedule: one shot alarms, re armed after every run and at every start (so daylight saving never drifts them) ---------- */
async function schedule() {
  const s = await L.getSettings(store), now = new Date();
  await C.alarms.create(ALARM_WEEKLY, { when: +L.nextWeekly(now, s.weeklyDow, s.weeklyHour) });
  if (s.daily !== false) await C.alarms.create(ALARM_DAILY, { when: +L.nextDaily(now, s.dailyHour) }); else await C.alarms.clear(ALARM_DAILY);
}
async function ensureSchedule() { const [w, d] = await Promise.all([C.alarms.get(ALARM_WEEKLY), C.alarms.get(ALARM_DAILY)]); const s = await L.getSettings(store); if (!w || (s.daily !== false && !d)) await schedule(); }

/* ---------- runs ---------- */
/* Chrome stops a worker that has been idle for 30 seconds, and only events and extension calls count as activity, so a run
   that is busy fetching pings a cheap call every 20 seconds to stay up. If the worker is stopped anyway, the retry alarm
   set at the start of the run wakes it again; the retry keeps what the interrupted run already fetched. The same alarm is
   left armed when a run ends with sources that failed (a laptop fires its missed alarms the moment it wakes, before its
   network is back) or finds the lock of a run that died: the retry then asks again for what is due, or else only for the
   sources that failed. It gives up after two tries per scheduled run, so a source that keeps failing is never hammered.
   One case goes on: when the two tries are spent and the scheduled run itself is still due (not one source answered, as on
   a machine whose network is down), the worker looks again once an hour until that run is in. The extra morning try for a
   weekly source (mend) leaves the retry alarm alone: the alarm belongs to the run before it. */
let running = null, runningScope = null;
function run(scope, opt) {
  /* one run at a time. A full refresh asked for while a smaller run is in flight (the weekly alarm firing during a retry of two
     sources) is not dropped: it follows that run, keeping what was fetched in the last ten minutes */
  if (running) return scope === 'weekly' && runningScope !== 'weekly' ? running.then(() => run(scope, Object.assign({ keepFresh: 10 * L.MIN }, opt || {}))) : running;
  runningScope = scope;
  const mending = !!(opt && opt.mend);
  const beat = setInterval(() => { try { C.runtime.getPlatformInfo(() => void C.runtime.lastError); } catch (e) { } }, 20000);
  let again = false;
  if (!mending) { try { C.alarms.create(ALARM_RETRY, { delayInMinutes: opt && opt.slow ? 60 : 8 }); } catch (e) { } }
  running = L.refresh(Object.assign({ scope, store, env: 'extension' }, opt || {}))
    .then(async r => { again = !!(r.locked || (r.failed && r.failed.length && !mending)); if (!r.locked) { if (!again && !mending) await store.set(RETRY_KEY, { n: 0 }); await announce(); } return r; })
    .catch(e => { console.error('refresh', e); again = true; return { ok: false }; })
    .finally(() => { clearInterval(beat); running = null; if (!again && !mending) { try { C.alarms.clear(ALARM_RETRY); } catch (e) { } } });
  return running;
}
/* run whatever is due: the weekly refresh when seven days have passed, else the daily pulse */
async function catchUp(opt) { const d = L.due(await L.getState(store), await L.getSettings(store), new Date()); if (d) { if (!opt) await store.set(RETRY_KEY, { n: 0 }); await run(d, opt); } else await announce(true); return d; }   /* a catch up at browser start or page open is a run of its own: it gets its two quick retries */
/* the sources whose last try failed and that are not switched off */
async function failedNow() { const s = await L.getSettings(store), out = []; for (const src of L.SOURCES) { if (s.disabled && s.disabled[src.id]) continue; const r = await store.get(L.K.src(src.id)); if (r && r.ok === false) out.push(src.id); } return out; }
/* the retry alarm fired: the run it was guarding never finished, was locked out, or left sources that failed */
async function retry() {
  const n = ((await store.get(RETRY_KEY)) || {}).n || 0; if (n >= 2) { await catchUp({ keepFresh: 6 * L.HOUR, slow: true }); return; }
  await store.set(RETRY_KEY, { n: n + 1, at: new Date().toISOString() });
  if (await catchUp({ keepFresh: 6 * L.HOUR })) return;
  const bad = await failedNow(); if (bad.length) await run(bad);
}
/* the morning pulse also asks once more for a weekly source whose last try failed (a service that was down on Monday), so
   it comes back the next morning and not the next week; this one try arms no retry of its own */
async function mend(ran) { if (ran === 'weekly') return; const bad = (await failedNow()).filter(id => L.BY_ID[id] && L.BY_ID[id].cadence !== 'daily'); if (bad.length) await run(bad, { mend: true }); }

/* ---------- badge and notifications ---------- */
/* One notification per new trigger: a freeze in the forecast, or a new cold, heat, air quality or severe storm alert for the
   12 counties. Keys already sent are remembered, so a daily pulse never repeats itself. */
async function announce(quiet) {
  if (!L.derive || !L.derive.cold) return;
  let cold, notes; try { const recs = await L.snapshot(store, null), now = new Date(); cold = L.derive.cold(recs, now); notes = L.derive.notices(recs, now); } catch (e) { console.error('derive', e); return; }
  const b = L.derive.badge(cold);
  try { await C.action.setBadgeText({ text: b.text || '' }); if (b.text) { await C.action.setBadgeBackgroundColor({ color: b.color }); if (C.action.setBadgeTextColor) await C.action.setBadgeTextColor({ color: '#ffffff' }); } await C.action.setTitle({ title: b.title || 'DFW Thermal Debt Atlas' }); } catch (e) { }
  if (quiet || !notes.length) return;
  const s = await L.getSettings(store); if (s.notify === false) return;
  const sent = ((await store.get(NOTE_KEY)) || {}).keys || [];
  /* a freeze that lasts several nights is one trigger. Its key carries the first freezing night still ahead, which moves on a
     day each morning: a key whose night follows one already announced, at the same depth or deeper, is remembered and not sent.
     The two week outlook is the same: the date of one cold shot a week or two out shifts by a day or two between runs, so an
     outlook key within three days of one already announced at the same tier or higher is that shot again, not a new one */
  const KEYED = /^(tier|outlook:)(\d):(\d{4}-\d\d-\d\d)$/, noon = d => +new Date(d + 'T12:00:00Z');
  const goesOn = n => { const k = KEYED.exec(n.key); if (!k) return false; return sent.some(s => { const p = KEYED.exec(s); if (!p || p[1] !== k[1] || +p[2] < +k[2]) return false; const gap = Math.round((noon(k[3]) - noon(p[3])) / L.DAY); return k[1] === 'tier' ? gap === 1 : gap !== 0 && Math.abs(gap) <= 3; }); };
  const news = notes.filter(n => !sent.includes(n.key)), carried = news.filter(goesOn).map(n => n.key), fresh = news.filter(n => !goesOn(n)).slice(0, 3);
  if (!fresh.length && !carried.length) return;
  await store.set(NOTE_KEY, { keys: fresh.map(n => n.key).concat(carried, sent).slice(0, 60), at: new Date().toISOString() });
  /* the route rides in the notification id, so a click still lands on the right page after the worker has slept */
  fresh.forEach((n, i) => { const id = NOTE_ID + '|' + (n.route || 'heat') + '|' + Date.now() + '-' + i; try { C.notifications.create(id, { type: 'basic', iconUrl: C.runtime.getURL('icons/icon128.png'), title: n.title, message: n.message, priority: 1 }); } catch (e) { } });
}

/* ---------- events ---------- */
C.runtime.onInstalled.addListener(d => { (async () => { await schedule(); if (d && d.reason === 'install') await O.openRoute('heat', { newTab: true }); await catchUp(); })(); });
C.runtime.onStartup.addListener(() => { (async () => { await ensureSchedule(); await catchUp(); })(); });
/* the next alarms are set before the run starts: a run that is cut short must not take the schedule down with it */
C.alarms.onAlarm.addListener(a => { (async () => { if (a.name === ALARM_RETRY) return retry(); if (a.name !== ALARM_WEEKLY && a.name !== ALARM_DAILY) return; await schedule(); await store.set(RETRY_KEY, { n: 0 }); if (a.name === ALARM_WEEKLY) { const lw = (await L.getState(store)).lastWeekly; if (!(lw && Date.now() - +new Date(lw) < 2 * L.HOUR)) await run('weekly'); } else await mend(await catchUp()); })(); });   /* a pulse that fired a little late on Monday has already made the full refresh: the weekly alarm an hour later does not make it again */
C.runtime.onMessage.addListener((m, sender, respond) => {
  if (!m || typeof m.type !== 'string' || m.type.indexOf('tda.live.') !== 0) return false;
  (async () => {
    if (m.type === 'tda.live.check') { await ensureSchedule(); respond({ ran: await catchUp() }); }
    else if (m.type === 'tda.live.schedule') { await schedule(); respond({ ok: true }); }
    else if (m.type === 'tda.live.refresh') { const r = await run(m.scope || 'weekly'); respond(r); }
    else if (m.type === 'tda.live.announce') { await announce(!m.notify); respond({ ok: true }); }
    else respond(null);
  })().catch(e => { try { respond({ error: String(e && e.message || e) }); } catch (_) { } });
  return true;
});
if (C.notifications && C.notifications.onClicked) C.notifications.onClicked.addListener(id => { if (id.indexOf(NOTE_ID) === 0) { O.openRoute(id.split('|')[1] || 'heat'); C.notifications.clear(id); } });
if (C.commands && C.commands.onCommand) C.commands.onCommand.addListener(cmd => { if (cmd === 'open-atlas') O.openRoute(''); });
if (C.omnibox) {
  try { C.omnibox.setDefaultSuggestion({ description: 'DFW Thermal Debt Atlas: open <match>%s</match> (a module, a city or a ZIP code)' }); } catch (e) { }
  C.omnibox.onInputChanged.addListener((text, suggest) => { try { suggest(O.search(text).slice(0, 6).map(r => ({ content: r.route, description: esc(r.title) + ' <dim>' + esc(r.sub) + '</dim>' }))); } catch (e) { suggest([]); } });
  C.omnibox.onInputEntered.addListener((text, disposition) => { const route = O.resolve(text); if (disposition === 'currentTab') O.openRoute(route, { currentTab: true }); else O.openRoute(route, { newTab: true }); });
}
