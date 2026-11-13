/* ==== live/page.js ==== */
/* The atlas page's handle on the live layer: the records in memory, their ages, a refresh the page can run itself, and a
   'live' event on the bus whenever anything changes. In the browser app the background service worker keeps the schedule
   and this page simply watches the store; opened as a single file, the page runs the schedule itself when it is opened. */
"use strict";
const LIVE = (() => {
  const L = window.TDA_LIVE; const BASE = window.__LIVE_BASELINE__ || null;
  const rt = L.extensionRuntime(); const ext = !!rt; const env = ext ? 'extension' : 'page';
  const st = L.defaultStore();
  let recs = {}, state = { runs: [] }, settings = Object.assign({}, L.DEFAULT_SETTINGS), busy = null, prog = null, loaded = false;
  async function load(why) {
    try { [recs, state, settings] = [await L.snapshot(st, BASE), await L.getState(st), await L.getSettings(st)]; } catch (e) { console.error('live layer: could not read the store', e); }
    loaded = true; BUS.emit('live', { why: why || 'load' });
  }
  const ready = load('load');
  if (ext) {
    const reload = debounce(() => load('store'), 250);
    rt.storage.onChanged.addListener((changes, area) => { if (area === 'local' && Object.keys(changes).some(k => k.indexOf('tda.live.') === 0)) reload(); });
  }
  /* Run a refresh from this page. scope: 'weekly' (everything), 'daily' (the weather pulse) or a list of source ids. */
  function refresh(scope, force) {
    if (busy) return busy;
    prog = { done: 0, total: 0 }; BUS.emit('live', { why: 'start' });
    busy = L.refresh({ scope: scope || 'weekly', store: st, env, force: !!force, onProgress: p => { prog = p; BUS.emit('live:progress', p); } })
      .then(async r => { await load('refresh'); return r; })
      .catch(e => { console.error('live refresh', e); return { ok: false, ran: [], failed: [{ id: '*', msg: String(e && e.message || e) }], skipped: [] }; })
      .finally(() => { busy = null; prog = null; BUS.emit('live', { why: 'done' }); });
    return busy;
  }
  async function saveSettings(patch) { settings = await L.setSettings(st, patch); if (ext) { try { rt.runtime.sendMessage({ type: 'tda.live.schedule' }, () => void rt.runtime.lastError); } catch (e) { } } BUS.emit('live', { why: 'settings' }); return settings; }
  const rec = id => recs[id] || null;
  const data = id => (recs[id] && recs[id].data != null) ? recs[id].data : null;
  const ageMs = id => { const r = recs[id]; return r && r.at ? Date.now() - +new Date(r.at) : null; };
  /* "3 hours ago", "2 days ago", "5 weeks ago" */
  function ago(t) {
    if (!t) return 'never'; const ms = Date.now() - +new Date(t); if (!(ms >= 0)) return 'just now';
    const m = ms / 6e4; if (m < 2) return 'just now'; if (m < 90) return Math.round(m) + ' minutes ago';
    const h = m / 60; if (h < 36) return Math.round(h) + ' hours ago';
    const d = h / 24; if (d < 14) return Math.round(d) + ' days ago';
    return Math.round(d / 7) + ' weeks ago';
  }
  const stamp = t => t ? new Date(t).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'never';
  /* fresh: inside its cadence; aging: up to twice the cadence; stale: older, failed or never fetched */
  function health(id) {
    const s = L.BY_ID[id], r = recs[id]; if (!s) return 'stale'; if (!r || r.data == null || !r.at) return 'stale';
    const a = Date.now() - +new Date(r.at), c = s.cadence === 'daily' ? L.DAY : L.WEEK;
    return a <= c * 1.15 ? 'fresh' : a <= c * 2.2 ? 'aging' : 'stale';
  }
  const nextRuns = () => { const now = new Date(); return { weekly: L.nextWeekly(now, settings.weeklyDow, settings.weeklyHour), daily: settings.daily ? L.nextDaily(now, settings.dailyHour) : null }; };
  /* The single file runs its own schedule: a refresh on open when one is due. The Claude viewer blocks network calls, so it only shows the baked snapshot. */
  const canFetch = () => !(typeof inViewer === 'function' && inViewer());
  ready.then(() => {
    if (ext) { try { rt.runtime.sendMessage({ type: 'tda.live.check' }, () => void rt.runtime.lastError); } catch (e) { } return; }
    if (!canFetch() || settings.auto === false || !L.SOURCES.length) return;
    /* the snapshot baked into the build counts as the last run until this browser has made one of its own */
    const seen = Object.assign({}, state); if (!seen.lastWeekly && BASE && BASE.built) seen.lastWeekly = seen.lastDaily = BASE.built;
    const d = L.due(seen, settings, new Date()); if (d) setTimeout(() => refresh(d), 2500);
  });
  return { ready, isLoaded: () => loaded, env, ext, canFetch, sources: L.SOURCES, byId: L.BY_ID, rec, data, all: () => recs, state: () => state, settings: () => settings, saveSettings, refresh, busy: () => !!busy, progress: () => prog, ageMs, ago, stamp, health, nextRuns, baseline: BASE, reload: () => load('manual') };
})();
