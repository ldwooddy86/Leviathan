/* The harness the unit tests share: the Dr. HVAC scripts are classic browser scripts (top level const, one shared scope),
   so they are run in a vm context with the handful of globals they read. Nothing here touches the dashboard itself; the
   toolkits take what they need from it as arguments or through globals the test supplies.
     const ctx = makeContext({ fetch, globals });   load(ctx, ['dr/00_dr_core.js', ...]);   ctx.DRHVAC...
   loadSdk(ctx) adds the vendored SDK bundle (AnthropicSDK). sse(events) turns a list of stream events into a Response. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const SRC = path.join(ROOT, 'src');

export function memoryStorage() { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: k => { m.delete(k); }, clear: () => m.clear(), get length() { return m.size; }, _m: m }; }

export function makeContext(o = {}) {
  const sandbox = {
    console, setTimeout, clearTimeout, setInterval, clearInterval, queueMicrotask,
    URL, URLSearchParams, TextEncoder, TextDecoder, AbortController, AbortSignal, Headers, Request, Response, ReadableStream, Blob, FormData,
    atob, btoa, structuredClone, performance, crypto: globalThis.crypto,
    fetch: o.fetch || (async url => { throw new Error('no fetch mock for ' + url); }),
    localStorage: o.localStorage === null ? undefined : (o.localStorage || memoryStorage()),
    navigator: { userAgent: 'node-test' },
  };
  Object.assign(sandbox, o.globals || {});
  const ctx = vm.createContext(sandbox);
  ctx.globalThis = ctx;
  return ctx;
}

export function load(ctx, files) {
  for (const f of files) { const p = path.isAbsolute(f) ? f : path.join(SRC, f); vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: p }); }
  return ctx;
}
export const loadSdk = ctx => load(ctx, [path.join(ROOT, 'vendor', 'anthropic-sdk.min.js')]);
/* read a top level const of the loaded scripts (they do not all hang off globalThis) */
export const peek = (ctx, expr) => vm.runInContext(expr, ctx);

/* ---- assertions, in the style of chrome-app/tests ---- */
export function suite() {
  let fails = 0;
  const ok = (c, label, extra) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${label}${extra !== undefined ? '  (' + String(extra).slice(0, 300) + ')' : ''}`); if (!c) fails++; return !!c; };
  const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), label, JSON.stringify(a) === JSON.stringify(b) ? undefined : `got ${JSON.stringify(a)} want ${JSON.stringify(b)}`);
  const throwsAsync = async (fn, re) => { try { await fn(); return false; } catch (e) { return re ? re.test(String(e && e.message)) : true; } };
  const done = () => { if (fails) { console.log(`\n${fails} failed`); process.exit(1); } };
  return { ok, eq, throwsAsync, done, get fails() { return fails; } };
}

/* ---- a mock HTTP layer: routes are [matcher, handler]; matcher is a string (prefix), RegExp or function(url, init) ---- */
export function mockFetch(routes, log) {
  return async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    if (log) log.push({ url, method: (init.method || 'GET').toUpperCase(), headers: init.headers || {}, body: init.body });
    for (const [m, h] of routes) {
      const hit = typeof m === 'string' ? url.startsWith(m) : m instanceof RegExp ? m.test(url) : m(url, init);
      if (!hit) continue;
      const r = await h(url, init);
      if (r instanceof Response) return r;
      const { status = 200, headers = {}, body = '', json } = r || {};
      return new Response(json !== undefined ? JSON.stringify(json) : body, { status, headers: Object.assign(json !== undefined ? { 'content-type': 'application/json' } : {}, headers) });
    }
    throw new TypeError('fetch failed: no route for ' + url);
  };
}

/* ---- Anthropic streaming: a Response whose body is the server sent events of one message ---- */
export function sse(events, status = 200) {
  const enc = new TextEncoder();
  const body = new ReadableStream({ start(c) { for (const e of events) c.enqueue(enc.encode(`event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`)); c.close(); } });
  return new Response(body, { status, headers: { 'content-type': 'text/event-stream', 'request-id': 'req_test' } });
}
/* the events of one assistant message from a list of content blocks:
   {type:'text', text}, {type:'thinking', thinking}, {type:'tool_use', id, name, input} (input streamed as JSON fragments) */
export function messageEvents(blocks, o = {}) {
  const ev = [{ type: 'message_start', message: { id: o.id || 'msg_' + Math.random().toString(36).slice(2, 10), type: 'message', role: 'assistant', model: o.model || 'claude-opus-5-5', content: [], stop_reason: null, stop_sequence: null, usage: Object.assign({ input_tokens: 100, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }, o.usageStart || {}) } }];
  blocks.forEach((b, i) => {
    if (b.type === 'text') { ev.push({ type: 'content_block_start', index: i, content_block: { type: 'text', text: '' } }); const parts = b.text.match(/[\s\S]{1,24}/g) || ['']; parts.forEach(p => ev.push({ type: 'content_block_delta', index: i, delta: { type: 'text_delta', text: p } })); }
    else if (b.type === 'thinking') { ev.push({ type: 'content_block_start', index: i, content_block: { type: 'thinking', thinking: '', signature: '' } }); if (b.thinking) ev.push({ type: 'content_block_delta', index: i, delta: { type: 'thinking_delta', thinking: b.thinking } }); ev.push({ type: 'content_block_delta', index: i, delta: { type: 'signature_delta', signature: b.signature || 'sig_' + i } }); }
    else if (b.type === 'tool_use') { ev.push({ type: 'content_block_start', index: i, content_block: { type: 'tool_use', id: b.id, name: b.name, input: {} } }); const raw = b.rawJson != null ? b.rawJson : JSON.stringify(b.input || {}); (raw.match(/[\s\S]{1,40}/g) || ['']).forEach(p => ev.push({ type: 'content_block_delta', index: i, delta: { type: 'input_json_delta', partial_json: p } })); }
    else ev.push({ type: 'content_block_start', index: i, content_block: b });
    ev.push({ type: 'content_block_stop', index: i });
  });
  const stop = o.stop_reason || (blocks.some(b => b.type === 'tool_use') ? 'tool_use' : 'end_turn');
  ev.push({ type: 'message_delta', delta: Object.assign({ stop_reason: stop, stop_sequence: null }, o.stop_details ? { stop_details: o.stop_details } : {}), usage: Object.assign({ output_tokens: 50 }, o.usageEnd || {}) });
  ev.push({ type: 'message_stop' });
  return ev;
}
