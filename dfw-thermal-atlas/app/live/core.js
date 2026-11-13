/* ==== live/core.js ==== */
/* The live data layer: a registry of public data collectors and the runner that refreshes them on a schedule.
   One file, three hosts: the atlas page (browser app page or the single file), the browser app's background service
   worker (importScripts) and Node (tools/refresh.mjs and the tests). Nothing in here touches the DOM, and nothing is
   sent anywhere except the GET requests each collector documents. */
(function (root) {
  'use strict';
  const V = 1;
  const MIN = 6e4, HOUR = 36e5, DAY = 864e5, WEEK = 7 * DAY;
  const K = { state: 'tda.live.state', settings: 'tda.live.settings', src: id => 'tda.live.src.' + id };
  const DEFAULT_SETTINGS = { weeklyDow: 1, weeklyHour: 6, daily: true, dailyHour: 5, notify: true, auto: true, keys: {}, disabled: {} };
  const SOURCES = []; const BY_ID = {};
  const iso = d => new Date(d).toISOString();
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  /* ---------- registry ---------- */
  /* def: { id, name, publisher, about, page (a human readable source URL), hosts: [hostnames it calls], cadence: 'weekly' | 'daily',
            cors: false when a plain web page cannot call it (only the browser app or Node can), key: name of an optional or
            required key in settings.keys, keyRequired, grade: 'A'..'D', run: async ctx => data, digest: data => small object of
            headline numbers kept for the week over week comparison } */
  function register(def) {
    ['id', 'name', 'publisher', 'run'].forEach(k => { if (!def[k]) throw new Error('live source needs "' + k + '"'); });
    if (!/^[a-z][a-z0-9_]*$/.test(def.id)) throw new Error('live source id must be snake_case: ' + def.id);
    if (BY_ID[def.id]) throw new Error('duplicate live source ' + def.id);
    if (def.cadence !== 'daily') def.cadence = 'weekly';
    def.hosts = def.hosts || [];
    def.cors = def.cors !== false;
    SOURCES.push(def); BY_ID[def.id] = def;
    return def;
  }

  /* ---------- http: polite by construction ---------- */
  /* One request at a time per host with a short gap, a hard timeout, and retries only for 429, 5xx and network errors. */
  function HttpError(status, url, body) { const e = new Error('HTTP ' + status + ' from ' + hostOf(url)); e.name = 'HttpError'; e.status = status; e.url = url; e.body = body; return e; }
  function hostOf(url) { try { return new URL(url).host; } catch (e) { return String(url).slice(0, 40); } }
  function makeHttp(o) {
    o = o || {};
    const f = o.fetch || (root.fetch ? root.fetch.bind(root) : null);
    if (!f) throw new Error('no fetch available');
    const chains = o.chains || {};
    const stats = { n: 0, bytes: 0 };
    async function once(url, init, timeoutMs) {
      const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const t = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : null;
      try {
        const r = await f(url, Object.assign({ method: 'GET', cache: 'no-store', credentials: 'omit', redirect: 'follow' }, init, ctl ? { signal: ctl.signal } : {}));
        const body = await r.text();
        return { status: r.status, ok: r.ok, body, url: r.url || url };
      } finally { if (t) clearTimeout(t); }
    }
    function text(url, init) {
      init = init || {};
      const host = hostOf(url);
      const tries = 1 + (init.retries != null ? init.retries : (o.retries != null ? o.retries : 2));
      const timeoutMs = init.timeoutMs || o.timeoutMs || 25000;
      const req = {}; ['method', 'headers', 'body', 'redirect'].forEach(k => { if (init[k] != null) req[k] = init[k]; });
      const run = async () => {
        let last;
        for (let i = 0; i < tries; i++) {
          if (i) await sleep((o.backoffMs != null ? o.backoffMs : 900) * Math.pow(2.5, i - 1));
          try {
            const r = await once(url, req, timeoutMs);
            stats.n++; stats.bytes += r.body.length;
            if (init.expectFinalUrl && !init.expectFinalUrl(r.url)) { last = HttpError(r.status, url, 'redirected to ' + r.url); break; }
            if (r.ok) return r.body;
            last = HttpError(r.status, url, r.body.slice(0, 240));
            if (!(r.status === 429 || r.status >= 500)) break;
          } catch (e) { stats.n++; last = e && e.name === 'AbortError' ? new Error('timed out after ' + Math.round(timeoutMs / 1000) + ' s: ' + host) : (e instanceof Error ? e : new Error(String(e))); }
        }
        throw last;
      };
      const first = !chains[host];
      const p = (chains[host] || Promise.resolve()).catch(() => { }).then(() => first ? null : sleep(o.gapMs != null ? o.gapMs : 300)).then(run);
      chains[host] = p;
      return p;
    }
    async function json(url, init) {
      const t = await text(url, init);
      try { return JSON.parse(t); } catch (e) { throw new Error('not JSON from ' + hostOf(url) + ': ' + t.slice(0, 80).replace(/\s+/g, ' ')); }
    }
    return { text, json, stats };
  }

  /* ---------- stores ---------- */
  /* A store is { get(key) -> Promise<value|undefined>, set(key, value) -> Promise }. */
  function memoryStore(seed) { const m = Object.assign({}, seed || {}); return { get: async k => m[k], set: async (k, v) => { m[k] = JSON.parse(JSON.stringify(v)); }, dump: () => m }; }
  function chromeStore(area) { return { get: k => new Promise(res => area.get(k, r => res(r ? r[k] : undefined))), set: (k, v) => new Promise((res, rej) => area.set({ [k]: v }, () => { const e = root.chrome && root.chrome.runtime && root.chrome.runtime.lastError; e ? rej(new Error(e.message)) : res(); })) }; }
  function webStore(ls) { return { get: async k => { try { const v = ls.getItem(k); return v == null ? undefined : JSON.parse(v); } catch (e) { return undefined; } }, set: async (k, v) => { ls.setItem(k, JSON.stringify(v)); } }; }
  function extensionRuntime() { const c = root.chrome; return c && c.runtime && c.runtime.id && c.storage && c.storage.local ? c : null; }
  function defaultStore() { const c = extensionRuntime(); if (c) return chromeStore(c.storage.local); if (root.localStorage) return webStore(root.localStorage); return memoryStore(); }

  async function getSettings(store) { const s = (await store.get(K.settings)) || {}; return Object.assign({}, DEFAULT_SETTINGS, s, { keys: Object.assign({}, s.keys || {}), disabled: Object.assign({}, s.disabled || {}) }); }
  async function setSettings(store, patch) { const s = await getSettings(store); Object.assign(s, patch || {}); await store.set(K.settings, s); return s; }
  async function getState(store) { return (await store.get(K.state)) || { runs: [] }; }

  /* ---------- schedule (pure) ---------- */
  /* Next local time on day of week `dow` (0 Sunday .. 6 Saturday) at `hour`, strictly after `from`. */
  function nextWeekly(from, dow, hour) { const d = new Date(from); d.setHours(hour, 0, 0, 0); let add = (dow - d.getDay() + 7) % 7; if (add === 0 && d <= from) add = 7; d.setDate(d.getDate() + add); return d; }
  function nextDaily(from, hour) { const d = new Date(from); d.setHours(hour, 0, 0, 0); if (d <= from) d.setDate(d.getDate() + 1); return d; }
  /* What is due right now: 'weekly' when no full refresh ran in the last seven days, else 'daily' when the daily pulse is on and none ran in 20 hours. */
  function due(state, settings, now) {
    const t = +new Date(now), lw = state && state.lastWeekly ? +new Date(state.lastWeekly) : 0, ld = state && state.lastDaily ? +new Date(state.lastDaily) : 0;
    if (t - lw >= WEEK - HOUR) return 'weekly';
    if (settings && settings.daily !== false && t - Math.max(lw, ld) >= 20 * HOUR) return 'daily';
    return null;
  }

  /* ---------- runner ---------- */
  function withTimeout(p, ms, what) { let t; return Promise.race([p, new Promise((_, rej) => { t = setTimeout(() => rej(new Error(what + ' took longer than ' + Math.round(ms / 1000) + ' s')), ms); })]).finally(() => clearTimeout(t)); }
  /* opt: { scope: 'weekly' | 'daily' | [ids], store, fetch, env: 'extension' | 'page' | 'node', onProgress, now: () => Date, force, concurrency, http: {…} }
     Returns { ok, ran: [ids], failed: [{id, msg}], skipped: [{id, why}], ms } or { locked: true } when another run holds the lock. */
  async function refresh(opt) {
    opt = opt || {};
    const store = opt.store || defaultStore(); const now = opt.now || (() => new Date()); const env = opt.env || (extensionRuntime() ? 'extension' : (root.document ? 'page' : 'node'));
    const scope = opt.scope || 'weekly'; const t0 = +now();
    const settings = await getSettings(store);
    let state = await getState(store);
    if (!opt.force && state.running && t0 - +new Date(state.running.since) < 6 * MIN) return { locked: true, by: state.running.by, since: state.running.since };
    state.running = { since: iso(t0), by: env, scope: Array.isArray(scope) ? 'some' : scope }; await store.set(K.state, state);
    const pick = Array.isArray(scope) ? scope.map(id => BY_ID[id]).filter(Boolean) : SOURCES.filter(s => scope === 'weekly' || s.cadence === 'daily');
    const ran = [], failed = [], skipped = []; const chains = {};
    let next = 0, done = 0;
    const progress = (s, status) => { done++; if (opt.onProgress) { try { opt.onProgress({ done, total: pick.length, id: s.id, name: s.name, status }); } catch (e) { } } };
    async function one(s) {
      const prev = await store.get(K.src(s.id));
      const key = s.key ? (settings.keys || {})[s.key] : null;
      const skip = settings.disabled[s.id] ? 'turned off in settings' : (!s.cors && env === 'page') ? 'needs the browser app (this source does not allow calls from a web page)' : (s.keyRequired && !key) ? 'needs a free API key (add it in Live Data settings)' : null;
      if (skip) { skipped.push({ id: s.id, why: skip }); await store.set(K.src(s.id), Object.assign({ v: V, id: s.id, data: null }, prev || {}, { skipped: { at: iso(now()), why: skip } })); return progress(s, 'skipped'); }
      const http = makeHttp(Object.assign({ fetch: opt.fetch, chains }, opt.http || {})); const started = +now();
      try {
        const data = await withTimeout(Promise.resolve().then(() => s.run({ http, now: new Date(started), prev: prev && prev.data != null ? prev.data : null, key, settings, env, geo: root.TDA_LIVE.geo || {} })), s.timeoutMs || 120000, s.name);
        if (data == null) throw new Error('returned nothing');
        const digest = s.digest ? s.digest(data) : null;
        /* keep the comparison point at least most of a cadence old, so a second refresh the same day does not erase "since last week" */
        const gap = s.cadence === 'daily' ? 20 * HOUR : 6 * DAY;
        const prevPoint = prev && prev.ok && prev.at && started - +new Date(prev.at) >= gap ? { at: prev.at, digest: prev.digest || null } : (prev && prev.prev) || null;
        await store.set(K.src(s.id), { v: V, id: s.id, ok: true, at: iso(started), ms: +now() - started, n: http.stats.n, bytes: http.stats.bytes, data, digest, prev: prevPoint });
        ran.push(s.id); progress(s, 'ok');
      } catch (e) {
        const msg = String((e && e.message) || e).slice(0, 300);
        failed.push({ id: s.id, msg });
        /* a failed run keeps the last good data and says so */
        await store.set(K.src(s.id), Object.assign({ v: V, id: s.id, data: null }, prev || {}, { ok: false, err: { at: iso(started), msg }, skipped: undefined }));
        progress(s, 'failed');
      }
    }
    async function worker() { while (next < pick.length) { const s = pick[next++]; await one(s); } }
    try { await Promise.all(Array.from({ length: Math.max(1, Math.min(opt.concurrency || 4, pick.length)) }, worker)); }
    finally {
      state = await getState(store);
      const end = +now(); delete state.running;
      const anyRan = ran.length > 0;
      if (anyRan && scope === 'weekly') { state.lastWeekly = iso(end); state.lastDaily = iso(end); }
      else if (anyRan && scope === 'daily') state.lastDaily = iso(end);
      state.runs = [{ at: iso(t0), scope: Array.isArray(scope) ? scope.join(',') : scope, by: env, ms: end - t0, ok: ran.length, failed: failed.map(f => f.id), skipped: skipped.map(f => f.id) }].concat(state.runs || []).slice(0, 16);
      await store.set(K.state, state);
    }
    return { ok: failed.length === 0, ran, failed, skipped, ms: +now() - t0 };
  }

  /* All records as { id: record }, the stored copy overlaid on the baseline baked into the build (whichever is newer). */
  async function snapshot(store, baseline) {
    store = store || defaultStore(); const out = {};
    for (const s of SOURCES) {
      const st = await store.get(K.src(s.id)); const base = baseline && baseline.records ? baseline.records[s.id] : null;
      const newer = st && st.data != null && (!base || !base.at || !st.at || +new Date(st.at) >= +new Date(base.at)) ? st : (base ? Object.assign({ baseline: true }, base, st ? { err: st.err, skipped: st.skipped, ok: st.ok === false ? false : base.ok } : {}) : st);
      if (newer) out[s.id] = newer;
    }
    return out;
  }

  root.TDA_LIVE = { V, K, MIN, HOUR, DAY, WEEK, DEFAULT_SETTINGS, SOURCES, BY_ID, register, makeHttp, HttpError, memoryStore, chromeStore, webStore, defaultStore, extensionRuntime, getSettings, setSettings, getState, nextWeekly, nextDaily, due, refresh, snapshot, geo: {} };
})(typeof globalThis !== 'undefined' ? globalThis : self);
