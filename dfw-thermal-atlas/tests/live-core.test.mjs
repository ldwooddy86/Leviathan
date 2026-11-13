import test from 'node:test';
import assert from 'node:assert/strict';
import { context, load, fakeFetch, same } from './helpers/load.mjs';

const fresh = () => load(context(), 'live/core.js').TDA_LIVE;
const src = (L, over) => L.register(Object.assign({ id: 'a', name: 'A', publisher: 'P', hosts: ['a.test'], run: async ctx => ({ v: (await ctx.http.json('https://a.test/x')).v }), digest: d => ({ v: d.v }) }, over));

test('register validates and keeps order', () => {
  const L = fresh();
  src(L); src(L, { id: 'b', cadence: 'daily' });
  same(L.SOURCES.map(s => s.id), ['a', 'b']);
  assert.equal(L.BY_ID.a.cadence, 'weekly'); assert.equal(L.BY_ID.b.cadence, 'daily'); assert.equal(L.BY_ID.a.cors, true);
  assert.throws(() => src(L), /duplicate/); assert.throws(() => L.register({ id: 'Bad-Id', name: 'x', publisher: 'y', run() { } }), /snake_case/);
  assert.throws(() => L.register({ id: 'c', name: 'x', publisher: 'y' }), /needs "run"/);
});

test('weekly refresh runs every source, stores records, stamps state', async () => {
  const L = fresh(); const store = L.memoryStore();
  src(L); src(L, { id: 'b', cadence: 'daily', run: async () => ({ lows: [31, 40] }), digest: d => ({ min: Math.min(...d.lows) }) });
  const fetch = fakeFetch([['a.test/x', { v: 7 }]]);
  const seen = [];
  const r = await L.refresh({ scope: 'weekly', store, fetch, env: 'node', onProgress: p => seen.push(p.id + ':' + p.status), http: { gapMs: 0, backoffMs: 1 } });
  assert.equal(r.ok, true); same(r.ran.sort(), ['a', 'b']); assert.equal(seen.length, 2);
  const a = await store.get(L.K.src('a'));
  assert.equal(a.ok, true); same(a.data, { v: 7 }); same(a.digest, { v: 7 }); assert.equal(a.n, 1); assert.ok(a.bytes > 0); assert.equal(a.prev, null);
  const st = await L.getState(store);
  assert.ok(st.lastWeekly && st.lastDaily); assert.equal(st.running, undefined); assert.equal(st.runs.length, 1); assert.equal(st.runs[0].ok, 2);
});

test('daily scope runs only daily sources and does not stamp the weekly run', async () => {
  const L = fresh(); const store = L.memoryStore();
  src(L); src(L, { id: 'b', cadence: 'daily', run: async () => ({ ok: 1 }) });
  const r = await L.refresh({ scope: 'daily', store, fetch: fakeFetch([]), env: 'node' });
  same(r.ran, ['b']);
  const st = await L.getState(store); assert.ok(st.lastDaily); assert.equal(st.lastWeekly, undefined);
});

test('a failing source keeps its last good data and does not stop the others', async () => {
  const L = fresh(); const store = L.memoryStore(); let fail = false;
  src(L, { run: async ctx => { if (fail) throw new Error('boom'); return { v: 1 }; } });
  src(L, { id: 'b', run: async () => ({ v: 2 }) });
  await L.refresh({ store, fetch: fakeFetch([]), env: 'node' });
  fail = true;
  const r = await L.refresh({ store, fetch: fakeFetch([]), env: 'node', force: true });
  assert.equal(r.ok, false); same(r.failed.map(f => f.id), ['a']); same(r.ran, ['b']);
  const a = await store.get(L.K.src('a'));
  assert.equal(a.ok, false); same(a.data, { v: 1 }); assert.match(a.err.msg, /boom/); assert.ok(a.at, 'keeps the time of the last good fetch');
});

test('retries 5xx and 429, never 4xx; counts requests', async () => {
  const L = fresh(); let n = 0;
  const http = L.makeHttp({ fetch: fakeFetch([['flaky', () => (++n < 3 ? { status: 503, body: 'busy' } : { status: 200, body: '{"ok":true}' })], ['gone', { status: 404, body: 'nope' }]]), gapMs: 0, backoffMs: 1 });
  same(await http.json('https://h.test/flaky'), { ok: true }); assert.equal(http.stats.n, 3);
  await assert.rejects(() => http.json('https://h.test/gone'), e => e.status === 404); assert.equal(http.stats.n, 4);
  await assert.rejects(() => L.makeHttp({ fetch: fakeFetch([['x', '<html>']]), gapMs: 0 }).json('https://h.test/x'), /not JSON/);
});

test('requests to one host never overlap', async () => {
  const L = fresh(); let live = 0, peak = 0;
  const fetch = fakeFetch([[/./, async () => { live++; peak = Math.max(peak, live); await new Promise(r => setTimeout(r, 15)); live--; return { v: 1 }; }]]);
  const http = L.makeHttp({ fetch, gapMs: 1 });
  await Promise.all([1, 2, 3, 4].map(i => http.json('https://one.test/' + i)).concat([http.json('https://two.test/1')]));
  assert.equal(peak, 2, 'one.test serial, two.test in parallel with it');
});

test('times out a hung request', async () => {
  const L = fresh();
  const hang = (url, init) => new Promise((_, rej) => { init.signal.addEventListener('abort', () => { const e = new Error('aborted'); e.name = 'AbortError'; rej(e); }); });
  const http = L.makeHttp({ fetch: hang, gapMs: 0, backoffMs: 1, retries: 0, timeoutMs: 30 });
  await assert.rejects(() => http.text('https://slow.test/'), /timed out/);
});

test('page cannot call a source without CORS; a required key is honoured', async () => {
  const L = fresh(); const store = L.memoryStore();
  src(L, { id: 'nocors', cors: false, run: async () => ({ v: 1 }) });
  src(L, { id: 'keyed', key: 'census', keyRequired: true, run: async ctx => ({ k: ctx.key }) });
  let r = await L.refresh({ store, fetch: fakeFetch([]), env: 'page' });
  same(r.skipped.map(s => s.id).sort(), ['keyed', 'nocors']); assert.match((await store.get(L.K.src('nocors'))).skipped.why, /browser app/);
  await L.setSettings(store, { keys: { census: 'abc' } });
  r = await L.refresh({ store, fetch: fakeFetch([]), env: 'extension', force: true });
  same(r.ran.sort(), ['keyed', 'nocors']); same((await store.get(L.K.src('keyed'))).data, { k: 'abc' });
});

test('the lock stops a second run; force overrides; a stale lock expires', async () => {
  const L = fresh(); const store = L.memoryStore(); src(L, { run: async () => ({ v: 1 }) });
  await store.set(L.K.state, { running: { since: new Date().toISOString(), by: 'extension' }, runs: [] });
  assert.equal((await L.refresh({ store, fetch: fakeFetch([]), env: 'page' })).locked, true);
  assert.equal((await L.refresh({ store, fetch: fakeFetch([]), env: 'page', force: true })).ok, true);
  await store.set(L.K.state, { running: { since: new Date(Date.now() - 7 * 6e4).toISOString(), by: 'extension' }, runs: [] });
  assert.equal((await L.refresh({ store, fetch: fakeFetch([]), env: 'page' })).ok, true);
});

test('a run that picks up after an interrupted one keeps what was already fetched', async () => {
  const L = fresh(); const store = L.memoryStore(); let calls = { a: 0, b: 0 }; let clock = +new Date('2026-11-02T12:00:00Z');
  src(L, { run: async () => ({ v: ++calls.a }) }); src(L, { id: 'b', run: async () => ({ v: ++calls.b }) });
  /* the interrupted run stored a and died before b; its lock is still in the state */
  await store.set(L.K.src('a'), { v: L.V, id: 'a', ok: true, at: new Date(clock - 10 * L.MIN).toISOString(), data: { v: 0 }, digest: { v: 0 } });
  await store.set(L.K.state, { running: { since: new Date(clock - 10 * L.MIN).toISOString(), by: 'extension' }, runs: [] });
  const r = await L.refresh({ store, fetch: fakeFetch([]), env: 'extension', keepFresh: 6 * L.HOUR, now: () => new Date(clock) });
  same(r.ran, ['b']); same(calls, { a: 0, b: 1 });
  const st = await L.getState(store); assert.ok(st.lastWeekly, 'the resumed run counts as the weekly run'); assert.equal(st.runs[0].kept, 1);
  clock += 7 * L.HOUR;
  await L.refresh({ store, fetch: fakeFetch([]), env: 'extension', keepFresh: 6 * L.HOUR, force: true, now: () => new Date(clock) });
  same(calls, { a: 1, b: 2 }, 'records older than the window are fetched again');
});

test('the week over week comparison point survives a same day refresh', async () => {
  const L = fresh(); const store = L.memoryStore(); let v = 1; let clock = +new Date('2026-11-02T12:00:00Z');
  src(L, { run: async () => ({ v: v++ }) });
  const run = () => L.refresh({ store, fetch: fakeFetch([]), env: 'node', force: true, now: () => new Date(clock) });
  await run(); clock += 7 * L.DAY; await run();
  let a = await store.get(L.K.src('a')); same(a.prev.digest, { v: 1 }); same(a.digest, { v: 2 });
  clock += 2 * L.HOUR; await run();
  a = await store.get(L.K.src('a')); same(a.digest, { v: 3 }); same(a.prev.digest, { v: 1 }, 'still compares with last week');
});

test('schedule helpers', () => {
  const L = fresh();
  const fri = new Date(2026, 10, 13, 10, 0, 0);                       // Friday 13 November 2026, local time
  const nw = L.nextWeekly(fri, 1, 6); assert.equal(nw.getDay(), 1); assert.equal(nw.getDate(), 16); assert.equal(nw.getHours(), 6);
  const sameDayLater = L.nextWeekly(new Date(2026, 10, 16, 5, 0, 0), 1, 6); assert.equal(sameDayLater.getDate(), 16);
  const sameDayPast = L.nextWeekly(new Date(2026, 10, 16, 6, 0, 0), 1, 6); assert.equal(sameDayPast.getDate(), 23);
  assert.equal(L.nextDaily(fri, 5).getDate(), 14); assert.equal(L.nextDaily(new Date(2026, 10, 13, 4, 0, 0), 5).getDate(), 13);
  const now = new Date('2026-11-13T12:00:00Z'); const ago = h => new Date(+now - h * L.HOUR).toISOString();
  assert.equal(L.due({}, L.DEFAULT_SETTINGS, now), 'weekly');
  assert.equal(L.due({ lastWeekly: ago(24 * 8) }, L.DEFAULT_SETTINGS, now), 'weekly');
  assert.equal(L.due({ lastWeekly: ago(30) }, L.DEFAULT_SETTINGS, now), 'daily');
  assert.equal(L.due({ lastWeekly: ago(30), lastDaily: ago(3) }, L.DEFAULT_SETTINGS, now), null);
  assert.equal(L.due({ lastWeekly: ago(30) }, { daily: false }, now), null);
});

test('snapshot overlays stored records on the baked baseline, newest wins, errors carried', async () => {
  const L = fresh(); const store = L.memoryStore(); src(L); src(L, { id: 'b', run: async () => ({}) }); src(L, { id: 'c', run: async () => ({}) });
  const base = { records: { a: { id: 'a', ok: true, at: '2026-11-10T00:00:00Z', data: { v: 'base' } }, b: { id: 'b', ok: true, at: '2026-11-10T00:00:00Z', data: { v: 'base' } } } };
  await store.set(L.K.src('a'), { id: 'a', ok: true, at: '2026-11-12T00:00:00Z', data: { v: 'fresh' } });
  await store.set(L.K.src('b'), { id: 'b', ok: false, data: null, err: { at: '2026-11-12T00:00:00Z', msg: 'down' } });
  const s = await L.snapshot(store, base);
  assert.equal(s.a.data.v, 'fresh'); assert.equal(s.a.baseline, undefined);
  assert.equal(s.b.data.v, 'base'); assert.equal(s.b.baseline, true); assert.equal(s.b.ok, false); assert.equal(s.b.err.msg, 'down');
  assert.equal(s.c, undefined);
});
