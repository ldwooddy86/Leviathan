// Load the app's classic scripts into a fresh vm context, the way a browser (or the service worker) would: one shared global.
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const APP = join(ROOT, 'app');
export function context(globals) {
  const ctx = vm.createContext(Object.assign({ console, setTimeout, clearTimeout, URL, URLSearchParams, AbortController, TextEncoder, TextDecoder, Promise, JSON, Math, Date, Intl }, globals || {}));
  ctx.globalThis = ctx; ctx.self = ctx;
  return ctx;
}
export function load(ctx, ...files) { for (const f of files) vm.runInContext(readFileSync(join(APP, f), 'utf8'), ctx, { filename: f }); return ctx; }
/* The live layer files in template order (what the page loads and what background.js must importScripts). */
export function liveFiles() {
  return readFileSync(join(ROOT, 'atlas.template.html'), 'utf8').split('\n').map(l => /^<!--@js (live\/[^ ]+)-->$/.exec(l)).filter(Boolean).map(m => m[1]);
}
/* A fetch double: routes is [[RegExp | string, handler(url, init) -> {status, body} | string | object]]. Records every call. */
export function fakeFetch(routes) {
  const calls = [];
  const f = async (url, init) => {
    calls.push({ url: String(url), init, t: Date.now() });
    for (const [m, h] of routes) {
      if (typeof m === 'string' ? String(url).includes(m) : m.test(String(url))) {
        let r = typeof h === 'function' ? await h(String(url), init, calls) : h;
        if (r instanceof Error) throw r;
        if (typeof r === 'string') r = { status: 200, body: r }; else if (!r || r.status == null) r = { status: 200, body: JSON.stringify(r) };
        const body = typeof r.body === 'string' ? r.body : JSON.stringify(r.body);
        return { status: r.status, ok: r.status >= 200 && r.status < 300, url: r.url || String(url), text: async () => body, headers: { get: () => null } };
      }
    }
    return { status: 404, ok: false, url: String(url), text: async () => 'no route', headers: { get: () => null } };
  };
  f.calls = calls;
  return f;
}
/* Values built inside the vm context carry that realm's prototypes, so compare them by value. */
import assert from 'node:assert/strict';
export const plain = x => x === undefined ? undefined : JSON.parse(JSON.stringify(x));
export const same = (actual, expected, msg) => assert.deepEqual(plain(actual), expected, msg);
