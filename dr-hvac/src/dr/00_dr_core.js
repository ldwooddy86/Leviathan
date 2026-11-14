/* ==== src/dr/00_dr_core.js ==== */
/* ==== dr_core ==== */
"use strict";
/* ============================ DR. HVAC: the web developer agent under module 19 ============================
   The layers in src/dr/ are the agent: this file (where it runs, what it stores, the settings, a schema check for tool
   inputs), 01 the knowledge (the system prompt), 02 the model client (the official Anthropic SDK), 03 the agent loop,
   10 to 13 the toolkits (pages and sites, Elementor, WordPress, hosting moves), 20 the tools the model calls, which is
   where the agent reads and drives the rest of the atlas. Nothing here touches the DOM at load time, so the same
   files run inside the page and inside the Node tests (tests/lib/load.mjs).

   Where it runs decides what works, as in the Publish and Accounts modules:
     browser app   host permissions, extension storage: the model, the sites and the DNS lookups all work
     file          the model works (the Anthropic API answers browser calls); a site must allow this origin (CORS)
     viewer        no outbound calls: the model is reached through the viewer's own Claude when the page was
                   published with it, and only the tools that need no network are offered
   Storage: settings in tda.drhvac.v1, transcripts and workshop pages in tda.drhvac.data.* (extension storage, else
   IndexedDB, else memory). The API key stays in this browser profile, like the CMS credentials. */
const DRHVAC = (() => {
  const G = globalThis;
  const RT = (typeof G.browser !== 'undefined' && G.browser.runtime && G.browser.runtime.id) ? G.browser : (typeof G.chrome !== 'undefined' && G.chrome.runtime && G.chrome.runtime.id) ? G.chrome : null;
  const inView = () => !!(G.claude && typeof G.claude.use === 'function');
  const ENV = RT ? ((typeof navigator !== 'undefined' && /Firefox/.test(navigator.userAgent || '')) ? 'firefox' : 'chrome') : inView() ? 'viewer' : (typeof document === 'undefined' ? 'node' : 'file');
  const ENV_NAME = { chrome: 'the Chrome browser app', firefox: 'the Firefox browser app', viewer: 'the Claude viewer', file: 'a downloaded file', node: 'the test harness' };
  const VERSION = '6.0.0';

  /* ---------- small utilities ---------- */
  const uid = p => (p || 'd') + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const nowIso = () => new Date().toISOString();
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const escHtml = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const slugify = s => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
  const withScheme = u => { u = String(u || '').trim(); return u && !/^[a-z][a-z0-9+.-]*:\/\//i.test(u) ? 'https://' + u : u; };
  const hostOf = u => { try { return new URL(withScheme(u)).hostname.toLowerCase(); } catch (e) { return ''; } };
  const originOf = u => { try { return new URL(withScheme(u)).origin; } catch (e) { return ''; } };
  const bareDomain = u => hostOf(u).replace(/^www\./, '');
  const bytesOf = s => { try { return new TextEncoder().encode(String(s)).length; } catch (e) { return String(s).length; } };
  const fmtBytes = n => n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : n >= 1024 ? Math.round(n / 1024) + ' KB' : n + ' B';
  const safeParse = (s, d) => { try { return JSON.parse(s); } catch (e) { return d; } };
  const clone = o => o == null ? o : JSON.parse(JSON.stringify(o));
  const isObj = v => v != null && typeof v === 'object' && !Array.isArray(v);
  /* a long text cut to n characters with a plain statement of what was left out, so the model never mistakes a slice for the whole */
  function clip(s, n, what) { s = String(s == null ? '' : s); if (s.length <= n) return s; return s.slice(0, n) + `\n[cut here: ${s.length - n} more characters of ${what || 'this text'} not shown. Ask for a narrower part.]`; }
  /* a tool result made safe to send back: strings clipped, objects serialized once and clipped as text when they run long */
  function fitResult(v, max) {
    max = max || 60000; if (v == null) return 'done';
    if (typeof v === 'string') return clip(v, max, 'the result');
    let s; try { s = JSON.stringify(v); } catch (e) { s = String(v); }
    return s.length <= max ? s : clip(s, max, 'the result (JSON, so the cut may fall inside a value)');
  }

  /* ---------- events ---------- */
  function emitter() { const h = {}; return { on(e, f) { (h[e] = h[e] || []).push(f); return () => { h[e] = (h[e] || []).filter(x => x !== f); }; }, emit(e, d) { (h[e] || []).slice().forEach(f => { try { f(d); } catch (err) { console.error('drhvac event ' + e, err); } }); } }; }
  const BUSX = emitter();

  /* ---------- storage ---------- */
  /* kv: small values (settings, indexes). Extension storage when present, localStorage otherwise, memory when neither answers. */
  const MEM = new Map();
  const ls = { get(k) { try { return G.localStorage ? G.localStorage.getItem(k) : null; } catch (e) { return null; } }, set(k, v) { try { if (G.localStorage) { G.localStorage.setItem(k, v); return true; } } catch (e) { } return false; }, del(k) { try { if (G.localStorage) G.localStorage.removeItem(k); } catch (e) { } } };
  const kv = {
    async get(k, d) { if (RT && RT.storage) { try { const r = await RT.storage.local.get(k); return r && r[k] !== undefined ? r[k] : d; } catch (e) { return d; } } const v = ls.get(k); if (v != null) return safeParse(v, d); return MEM.has(k) ? clone(MEM.get(k)) : d; },
    async set(k, v) { if (RT && RT.storage) { try { await RT.storage.local.set({ [k]: v }); return; } catch (e) { } } if (!ls.set(k, JSON.stringify(v))) MEM.set(k, clone(v)); },
    async del(k) { if (RT && RT.storage) { try { await RT.storage.local.remove(k); return; } catch (e) { } } ls.del(k); MEM.delete(k); },
  };
  /* big: transcripts and workshop pages, which outgrow localStorage. Extension storage (unlimitedStorage), else IndexedDB, else memory. */
  let idbP = null;
  function idb() {
    if (idbP) return idbP;
    idbP = new Promise(res => { try { if (!G.indexedDB) return res(null); const rq = G.indexedDB.open('tda-drhvac', 1); rq.onupgradeneeded = () => { rq.result.createObjectStore('kv'); }; rq.onsuccess = () => res(rq.result); rq.onerror = () => res(null); rq.onblocked = () => res(null); } catch (e) { res(null); } });
    return idbP;
  }
  const idbDo = async (mode, fn) => { const db = await idb(); if (!db) return undefined; return new Promise(res => { try { const tx = db.transaction('kv', mode); const st = tx.objectStore('kv'); const rq = fn(st); tx.oncomplete = () => res(rq ? rq.result : undefined); tx.onerror = () => res(undefined); tx.onabort = () => res(undefined); } catch (e) { res(undefined); } }); };
  const BIGP = 'tda.drhvac.data.';
  const big = {
    where: () => (RT && RT.storage) ? 'extension storage' : (G.indexedDB ? 'IndexedDB in this browser' : 'memory only (lost on reload)'),
    async get(k, d) { k = BIGP + k; if (RT && RT.storage) return kv.get(k, d); const v = await idbDo('readonly', st => st.get(k)); if (v !== undefined) return v; return MEM.has(k) ? clone(MEM.get(k)) : d; },
    async set(k, v) { k = BIGP + k; if (RT && RT.storage) return kv.set(k, v); const db = await idb(); if (db) { await idbDo('readwrite', st => st.put(v, k)); return; } MEM.set(k, clone(v)); },
    async del(k) { k = BIGP + k; if (RT && RT.storage) return kv.del(k); const db = await idb(); if (db) { await idbDo('readwrite', st => st.delete(k)); return; } MEM.delete(k); },
  };

  /* ---------- models ----------
     IDs, context and prices from Anthropic's model table (per million tokens; a cache read costs readX of the input price,
     a five minute cache write 1.25). Opus 5.5 is the default; Fable 5.2 is the most capable and costs twice as much. */
  const MODELS = [
    { id: 'claude-opus-5-5', name: 'Claude Opus 5.5', note: 'The default: long agentic builds and careful edits', inUsd: 4, outUsd: 20, readX: 0.05 },
    { id: 'claude-fable-5-2', name: 'Claude Fable 5.2', note: 'The most capable model, for the hardest builds and migrations; about twice the price', inUsd: 8, outUsd: 40, readX: 0.025 },
    { id: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5', note: 'Faster and cheaper, good for routine page edits', inUsd: 2, outUsd: 10, readX: 0.05 },
    { id: 'claude-haiku-5-5', name: 'Claude Haiku 5.5', note: 'The fastest and cheapest, for small copy changes', inUsd: 0.1, outUsd: 0.5, readX: 0.1 },
  ];
  const MODEL = id => MODELS.find(m => m.id === id) || null;
  const EFFORTS = ['low', 'medium', 'high', 'xhigh'];
  function costOf(modelId, u) {
    const m = MODEL(modelId) || MODELS[0]; u = u || {};
    const inp = (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) * 1.25 + (u.cache_read_input_tokens || 0) * m.readX;
    return (inp * m.inUsd + (u.output_tokens || 0) * m.outUsd) / 1e6;
  }

  /* ---------- settings ---------- */
  const KEY = 'tda.drhvac.v1';
  const DEFAULTS = {
    v: 1, apiKey: '', baseUrl: '', model: 'claude-opus-5-5', effort: 'high',
    webResearch: true,          /* Anthropic's web search and web fetch, run on Anthropic's side */
    autoDrafts: false,          /* run draft writes to a site without asking each time; live changes always ask */
    compat: false,              /* send no beta features (refusal fallback, thinking binding control, compaction) */
    maxSteps: 40,               /* model requests per user turn before the loop stops and reports */
    wpTarget: 'wp_elementor',   /* which Publish target card holds the WordPress credentials */
    current: '',                /* id of the open conversation */
  };
  let S = clone(DEFAULTS); let ready = false;
  const readyP = kv.get(KEY, null).then(v => { if (isObj(v)) S = Object.assign(clone(DEFAULTS), v); ready = true; BUSX.emit('settings', S); });
  const settings = () => S;
  async function saveSettings(patch) { S = Object.assign({}, S, patch || {}); if (!MODEL(S.model)) S.model = DEFAULTS.model; if (!EFFORTS.includes(S.effort)) S.effort = DEFAULTS.effort; S.maxSteps = Math.max(4, Math.min(120, +S.maxSteps || DEFAULTS.maxSteps)); await kv.set(KEY, S); BUSX.emit('settings', S); return S; }
  /* what the transport can do here: 'api' with a key outside the viewer, 'viewer' when the viewer lends its Claude, else nothing yet */
  function transport() { if (ENV === 'viewer') return 'viewer'; return S.apiKey ? 'api' : 'none'; }
  const canNetwork = () => ENV !== 'viewer';

  /* ---------- a JSON Schema check, the subset the tool schemas use ----------
     Tool inputs stream in as they are written (eager input streaming), so the API no longer validates them and a cut
     off or malformed input can parse as a smaller object. Every input is checked here before a tool runs.
     Supported: type (one or a list), properties, required, additionalProperties: false, enum, items, minItems, maxItems,
     minLength, maxLength, minimum, maximum. Returns a list of plain messages, empty when the value fits. */
  function typeOf(v) { return v === null ? 'null' : Array.isArray(v) ? 'array' : Number.isInteger(v) ? 'integer' : typeof v; }
  function validate(schema, v, path) {
    path = path || 'input'; const errs = []; if (!schema || typeof schema !== 'object') return errs;
    if (schema.type) { const want = Array.isArray(schema.type) ? schema.type : [schema.type]; const t = typeOf(v); const ok = want.some(w => w === t || (w === 'number' && t === 'integer')); if (!ok) { errs.push(`${path} should be ${want.join(' or ')}, got ${t}`); return errs; } }
    if (schema.enum && !schema.enum.some(x => x === v)) errs.push(`${path} should be one of ${schema.enum.map(x => JSON.stringify(x)).join(', ')}`);
    if (typeof v === 'string') { if (schema.minLength != null && v.length < schema.minLength) errs.push(`${path} is shorter than ${schema.minLength} characters`); if (schema.maxLength != null && v.length > schema.maxLength) errs.push(`${path} is longer than ${schema.maxLength} characters`); }
    if (typeof v === 'number') { if (schema.minimum != null && v < schema.minimum) errs.push(`${path} is below ${schema.minimum}`); if (schema.maximum != null && v > schema.maximum) errs.push(`${path} is above ${schema.maximum}`); }
    if (Array.isArray(v)) { if (schema.minItems != null && v.length < schema.minItems) errs.push(`${path} needs at least ${schema.minItems} items`); if (schema.maxItems != null && v.length > schema.maxItems) errs.push(`${path} takes at most ${schema.maxItems} items`); if (schema.items) v.forEach((x, i) => { if (errs.length < 8) errs.push(...validate(schema.items, x, `${path}[${i}]`)); }); }
    if (isObj(v)) {
      (schema.required || []).forEach(k => { if (v[k] === undefined) errs.push(`${path}.${k} is required`); });
      const props = schema.properties || {};
      for (const k of Object.keys(v)) { if (props[k]) { if (errs.length < 8) errs.push(...validate(props[k], v[k], `${path}.${k}`)); } else if (schema.additionalProperties === false) errs.push(`${path}.${k} is not a field of this tool`); }
    }
    return errs.slice(0, 8);
  }

  /* ---------- network ----------
     One way out for every toolkit: net.get(url, opts) resolves {status, ok, url, redirected, headers, text, bytes, ms, cut}
     and rejects NetError with a plain reason. It never throws on a 404 or a 500: an agent reads those as findings.
     Site access: inside the browser app a new origin needs the user's permission, and Chrome only shows that prompt from a
     click. So a tool never asks by itself: net.granted(url) says whether the origin is open, and the agent loop turns a
     closed origin into an approval card whose button calls net.request(url) (03_dr_agent.js). Opened as a file there is
     no permission API and the browser's CORS rules decide; inside the viewer nothing leaves the page. */
  class NetError extends Error { constructor(msg, o) { super(msg); this.name = 'NetError'; Object.assign(this, o || {}); } }
  const net = {
    NetError,
    /* one URL or a list: a site and its www twin are asked for together, in one browser prompt */
    patterns(urls) { return [...new Set((Array.isArray(urls) ? urls : [urls]).map(originOf).filter(Boolean))].map(o => o + '/*'); },
    async granted(url) { const p = net.patterns(url); if (!p.length) return false; if (ENV === 'viewer') return false; if (!RT || !RT.permissions) return true; try { return await RT.permissions.contains({ origins: p }); } catch (e) { return false; } },
    async request(url) { const p = net.patterns(url); if (!p.length) return false; if (!RT || !RT.permissions) return ENV !== 'viewer'; try { return !!(await RT.permissions.request({ origins: p })); } catch (e) { return false; } },
    async get(url, o) {
      o = o || {}; url = withScheme(url); if (!originOf(url)) throw new NetError('Not a URL: ' + url, { code: 'bad_url' });
      if (ENV === 'viewer') throw new NetError('The Claude viewer blocks every outbound call. Open the atlas as the browser app or a downloaded file to reach ' + hostOf(url) + '.', { code: 'viewer' });
      const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null; const t0 = Date.now();
      const timer = ctl ? setTimeout(() => ctl.abort(), o.timeout || 25000) : null;
      if (o.signal && ctl) { if (o.signal.aborted) ctl.abort(); else o.signal.addEventListener('abort', () => ctl.abort(), { once: true }); }
      let r;
      try { r = await G.fetch(url, { method: o.method || 'GET', headers: o.headers || {}, body: o.body, mode: 'cors', credentials: 'omit', redirect: o.redirect || 'follow', cache: 'no-store', signal: ctl ? ctl.signal : undefined }); }
      catch (e) {
        if (timer) clearTimeout(timer);
        const aborted = e && e.name === 'AbortError'; const stopped = aborted && o.signal && o.signal.aborted;
        throw new NetError(stopped ? 'Stopped.' : aborted ? `No answer from ${hostOf(url)} in ${Math.round((o.timeout || 25000) / 1000)} seconds.` : `Could not reach ${hostOf(url)}: ${(e && e.message) || e}.${ENV === 'file' ? ' Opened as a file, the browser blocks sites that do not allow this origin (CORS); the browser app has no such limit.' : ''}`, { code: stopped ? 'stopped' : aborted ? 'timeout' : 'network', url });
      }
      const headers = {}; try { r.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; }); } catch (e) { }
      let text = '', cut = false; const max = o.maxBytes || 1500000;
      if ((o.method || 'GET') !== 'HEAD') { try { text = await r.text(); } catch (e) { text = ''; } if (text.length > max) { text = text.slice(0, max); cut = true; } }
      if (timer) clearTimeout(timer);
      return { status: r.status, ok: r.ok, url: r.url || url, redirected: !!r.redirected, headers, text, bytes: text.length, cut, ms: Date.now() - t0 };
    },
    async json(url, o) { const r = await net.get(url, o); const j = safeParse(r.text, undefined); if (j === undefined) throw new NetError(`${hostOf(url)} answered ${r.status} but not with JSON.`, { code: 'not_json', status: r.status, url }); return Object.assign(r, { json: j }); },
  };

  return { VERSION, RT, ENV, ENV_NAME, inView, uid, nowIso, sleep, escHtml, slugify, withScheme, hostOf, originOf, bareDomain, bytesOf, fmtBytes, safeParse, clone, isObj, clip, fitResult, emitter, bus: BUSX, kv, big, net, MODELS, MODEL, EFFORTS, costOf, KEY, DEFAULTS, settings, saveSettings, ready: () => readyP, isReady: () => ready, transport, canNetwork, validate, typeOf };
})();
globalThis.DRHVAC = DRHVAC;
