/* DFW Thermal Debt Atlas · background service worker.
   Keeps the live data fresh without the page being open: a full refresh of every public source once a week (Monday 6 am by
   default), a light weather pulse once a day, and a catch up at browser start when a run was missed. After each run it sets
   the toolbar badge to the coldest forecast low of the week when a cold trigger is active and, if notifications are on,
   sends one notification per new trigger (a freeze in the forecast, or a new cold, heat, air quality or severe storm alert). Also opens the atlas on install, on the keyboard command and from the address bar keyword "tda". */
"use strict";
importScripts('live/core.js', 'live/geo.js', 'live/sources/nws_cold.js', 'live/sources/cpsc_recalls.js', 'live/derive.js'); /* live layer: kept in step with the template by build.mjs */
importScripts('registry.js', 'open.js');
const C = globalThis.chrome, L = globalThis.TDA_LIVE, O = globalThis.TDA_OPEN;
const store = L.chromeStore(C.storage.local);
const ALARM_WEEKLY = 'tda-weekly', ALARM_DAILY = 'tda-daily', NOTE_KEY = 'tda.live.notified', NOTE_ID = 'tda-cold';
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- schedule: one shot alarms, re armed after every run and at every start (so daylight saving never drifts them) ---------- */
async function schedule() {
  const s = await L.getSettings(store), now = new Date();
  await C.alarms.create(ALARM_WEEKLY, { when: +L.nextWeekly(now, s.weeklyDow, s.weeklyHour) });
  if (s.daily !== false) await C.alarms.create(ALARM_DAILY, { when: +L.nextDaily(now, s.dailyHour) }); else await C.alarms.clear(ALARM_DAILY);
}
async function ensureSchedule() { const [w, d] = await Promise.all([C.alarms.get(ALARM_WEEKLY), C.alarms.get(ALARM_DAILY)]); const s = await L.getSettings(store); if (!w || (s.daily !== false && !d)) await schedule(); }

/* ---------- runs ---------- */
let running = null;
function run(scope) {
  if (running) return running;
  running = L.refresh({ scope, store, env: 'extension' }).then(async r => { if (!r.locked) await announce(); return r; }).catch(e => { console.error('refresh', e); return { ok: false }; }).finally(() => { running = null; });
  return running;
}
/* run whatever is due: the weekly refresh when seven days have passed, else the daily pulse */
async function catchUp() { const d = L.due(await L.getState(store), await L.getSettings(store), new Date()); if (d) await run(d); else await announce(true); return d; }

/* ---------- badge and notifications ---------- */
/* One notification per new trigger: a freeze in the forecast, or a new cold, heat, air quality or severe storm alert for the
   12 counties. Keys already sent are remembered, so a daily pulse never repeats itself. */
const routes = {};
async function announce(quiet) {
  if (!L.derive || !L.derive.cold) return;
  let cold, notes; try { const recs = await L.snapshot(store, null), now = new Date(); cold = L.derive.cold(recs, now); notes = L.derive.notices(recs, now); } catch (e) { console.error('derive', e); return; }
  const b = L.derive.badge(cold);
  try { await C.action.setBadgeText({ text: b.text || '' }); if (b.text) { await C.action.setBadgeBackgroundColor({ color: b.color }); if (C.action.setBadgeTextColor) await C.action.setBadgeTextColor({ color: '#ffffff' }); } await C.action.setTitle({ title: b.title || 'DFW Thermal Debt Atlas' }); } catch (e) { }
  if (quiet || !notes.length) return;
  const s = await L.getSettings(store); if (s.notify === false) return;
  const sent = ((await store.get(NOTE_KEY)) || {}).keys || [];
  const fresh = notes.filter(n => !sent.includes(n.key)).slice(0, 3); if (!fresh.length) return;
  await store.set(NOTE_KEY, { keys: fresh.map(n => n.key).concat(sent).slice(0, 60), at: new Date().toISOString() });
  fresh.forEach((n, i) => { const id = NOTE_ID + '-' + Date.now() + '-' + i; routes[id] = n.route; try { C.notifications.create(id, { type: 'basic', iconUrl: C.runtime.getURL('icons/icon128.png'), title: n.title, message: n.message, priority: 1 }); } catch (e) { } });
}

/* ---------- events ---------- */
C.runtime.onInstalled.addListener(d => { (async () => { await schedule(); if (d && d.reason === 'install') await O.openRoute('heat', { newTab: true }); await catchUp(); })(); });
C.runtime.onStartup.addListener(() => { (async () => { await ensureSchedule(); await catchUp(); })(); });
C.alarms.onAlarm.addListener(a => { (async () => { if (a.name === ALARM_WEEKLY) await run('weekly'); else if (a.name === ALARM_DAILY) await catchUp(); await schedule(); })(); });
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
if (C.notifications && C.notifications.onClicked) C.notifications.onClicked.addListener(id => { if (id.indexOf(NOTE_ID) === 0) { O.openRoute(routes[id] || 'heat'); C.notifications.clear(id); } });
if (C.commands && C.commands.onCommand) C.commands.onCommand.addListener(cmd => { if (cmd === 'open-atlas') O.openRoute(''); });
if (C.omnibox) {
  try { C.omnibox.setDefaultSuggestion({ description: 'DFW Thermal Debt Atlas: open <match>%s</match> (a module, a city or a ZIP code)' }); } catch (e) { }
  C.omnibox.onInputChanged.addListener((text, suggest) => { try { suggest(O.search(text).slice(0, 6).map(r => ({ content: r.route, description: esc(r.title) + ' <dim>' + esc(r.sub) + '</dim>' }))); } catch (e) { suggest([]); } });
  C.omnibox.onInputEntered.addListener((text, disposition) => { const route = O.resolve(text); if (disposition === 'currentTab') O.openRoute(route, { currentTab: true }); else O.openRoute(route, { newTab: true }); });
}
