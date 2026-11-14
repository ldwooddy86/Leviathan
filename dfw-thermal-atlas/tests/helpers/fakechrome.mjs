/* A fake chrome object and a clock that can be set, enough to run app/background.js in a vm context the way Chrome runs
   it: the top level of the worker runs again on every wake, alarms are one shot and fire when the clock has passed them,
   storage survives a restart and timers do not. Used by tests/ext-worker.test.mjs.
     const w = makeWorld({ now: new Date(2026, 10, 16, 6, 0, 0) }); w.boot();
     w.chrome.runtime.onInstalled.fire({ reason: 'install' }); await w.settle();
     w.at(new Date(2026, 10, 17, 5, 0, 0)); w.boot(); await w.fireDue();
   Every collector's run() is replaced by a stand in: w.runSource = async id => data (throw to fail, never settle to hang). */
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { APP } from '../../build.mjs';

export function makeWorld(opt) {
  opt = opt || {};
  const clock = { now: +new Date(opt.now || '2026-11-16T12:00:00Z') };
  class FakeDate extends Date { constructor(...a) { if (a.length) super(...a); else super(clock.now); } static now() { return clock.now; } }
  const ev = () => { const ls = []; return { addListener: f => ls.push(f), ls, fire: (...a) => ls.map(f => f(...a)) }; };
  const mem = Object.assign({}, opt.storage || {});
  const alarms = new Map(), notes = new Map(), log = [], tabs = [], created = [];
  const badge = { text: '', color: null, title: '' };
  const chrome = {
    runtime: {
      id: 'x'.repeat(32), lastError: undefined, getURL: p => 'chrome-extension://x/' + p,
      getPlatformInfo: cb => { log.push('beat'); if (cb) cb({ os: 'linux' }); },
      onInstalled: ev(), onStartup: ev(), onMessage: ev(),
      getContexts: async () => tabs.filter(t => t.atlas).map(t => ({ documentUrl: t.url, tabId: t.id, windowId: t.windowId })),
    },
    storage: { local: {
      get: (k, cb) => { const out = {}; if (k == null) Object.assign(out, JSON.parse(JSON.stringify(mem))); else if (mem[k] !== undefined) out[k] = JSON.parse(JSON.stringify(mem[k])); setImmediate(() => cb(out)); },
      set: (o, cb) => { for (const k of Object.keys(o)) mem[k] = JSON.parse(JSON.stringify(o[k])); setImmediate(() => cb && cb()); },
      remove: (k, cb) => { delete mem[k]; setImmediate(() => cb && cb()); },
    } },
    alarms: {
      create: async (name, info) => { const when = info.when != null ? info.when : clock.now + info.delayInMinutes * 6e4; if (!Number.isFinite(when)) throw new TypeError('Invalid alarm time'); alarms.set(name, { name, scheduledTime: when }); log.push(`alarm ${name}`); },
      get: async name => alarms.get(name), getAll: async () => [...alarms.values()],
      clear: async name => { const had = alarms.delete(name); if (had) log.push(`clear ${name}`); return had; },
      onAlarm: ev(),
    },
    action: { setBadgeText: async o => { badge.text = o.text; }, setBadgeBackgroundColor: async o => { badge.color = o.color; }, setBadgeTextColor: async () => { }, setTitle: async o => { badge.title = o.title; } },
    notifications: { create: (id, o, cb) => { notes.set(id, o); log.push('notify ' + o.title); if (cb) cb(id); }, clear: id => notes.delete(id), onClicked: ev(), getAll: cb => cb(Object.fromEntries(notes)) },
    commands: { onCommand: ev() },
    omnibox: { setDefaultSuggestion: () => { }, onInputChanged: ev(), onInputEntered: ev() },
    tabs: {
      create: async o => { const t = { id: tabs.length + 1, windowId: 1, url: o.url, atlas: /atlas\.html/.test(o.url) }; tabs.push(t); created.push(o.url); return t; },
      update: async () => ({}), query: async () => tabs.slice(), get: async id => tabs.find(t => t.id === id),
    },
    windows: { update: async () => { }, create: async o => { created.push('window:' + o.url); } },
  };
  const world = { clock, chrome, mem, alarms, log, notes, badge, tabs, created, timers: new Set() };
  /* stop the worker as Chrome does: every timer of this incarnation dies with it; storage and alarms stay */
  world.kill = () => { for (const [kind, h] of world.timers) (kind === 'i' ? clearInterval : clearTimeout)(h); world.timers.clear(); };
  /* (re)start the worker: a fresh global, the top level of background.js runs again, as on every wake */
  world.boot = () => {
    world.kill();
    const T = world.timers;
    const st = (f, ms, ...a) => { const e = ['t', setTimeout(() => { T.delete(e); f(...a); }, ms)]; T.add(e); return e; };
    const si = (f, ms, ...a) => { const e = ['i', setInterval(f, ms, ...a)]; T.add(e); return e; };
    const ct = e => { if (e && T.delete(e)) (e[0] === 'i' ? clearInterval : clearTimeout)(e[1]); };
    const ctx = vm.createContext({ console: opt.console || { log() { }, error() { }, warn() { } }, setTimeout: st, clearTimeout: ct, setInterval: si, clearInterval: ct, URL, URLSearchParams, AbortController, TextEncoder, TextDecoder, Intl, Date: FakeDate, chrome, fetch: async () => { throw new TypeError('Failed to fetch'); }, navigator: { onLine: true } });
    ctx.globalThis = ctx; ctx.self = ctx;
    ctx.importScripts = (...files) => { for (const f of files) vm.runInContext(readFileSync(join(APP, f), 'utf8'), ctx, { filename: f }); };
    for (const k of ['onInstalled', 'onStartup', 'onMessage']) chrome.runtime[k].ls.length = 0;
    for (const e of [chrome.alarms.onAlarm, chrome.notifications.onClicked, chrome.commands.onCommand, chrome.omnibox.onInputChanged, chrome.omnibox.onInputEntered]) e.ls.length = 0;
    vm.runInContext(readFileSync(join(APP, 'background.js'), 'utf8'), ctx, { filename: 'background.js' });
    world.ctx = ctx; world.L = ctx.TDA_LIVE;
    for (const s of world.L.SOURCES) { const id = s.id; s.run = async c => (world.runSource ? world.runSource(id, c) : { stub: id }); s.digest = () => ({ n: 1 }); s.timeoutMs = 5000; }
    return ctx;
  };
  /* fire the alarms the clock has passed, oldest first, as Chrome does at wake (a one shot alarm is gone once it fires) */
  world.fireDue = async () => { const due = [...alarms.values()].filter(a => a.scheduledTime <= clock.now).sort((a, b) => a.scheduledTime - b.scheduledTime); for (const a of due) { alarms.delete(a.name); chrome.alarms.onAlarm.fire(a); } await world.settle(); return due.map(a => a.name); };
  world.settle = async n => { for (let i = 0; i < (n || 80); i++) await new Promise(r => setImmediate(r)); };
  world.send = msg => new Promise(res => { let done = false; const r = chrome.runtime.onMessage.fire(msg, {}, v => { if (!done) { done = true; res(v); } }); if (!r.some(x => x === true)) res(undefined); });
  world.at = when => { clock.now = +new Date(when); };
  world.state = () => mem['tda.live.state'] || {};
  world.runs = () => (world.state().runs || []).map(r => r.scope + ':' + r.ok + (r.failed && r.failed.length ? ' failed ' + r.failed.join('+') : ''));
  world.alarmAt = name => { const a = alarms.get(name); return a ? new Date(a.scheduledTime) : null; };
  world.failed = () => Object.keys(mem).filter(k => k.startsWith('tda.live.src.') && mem[k] && mem[k].ok === false).map(k => k.slice(13)).sort();
  return world;
}
