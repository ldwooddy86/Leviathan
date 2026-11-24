// Legion · the GPU crowd: every sampled Californian as a point whose position the vertex shader computes from the
// simulation clock, drawn as a MapView layer.
//
// API
//   const crowd = new Crowd(mapView, { world, population, rate = 0.025, seed = 1, pack, worker = true, maxAgents = 5e6 });
//   const summary = await crowd.build({ rate, onProgress(fraction, agentsSoFar), focus: {x, y} | false });
//   crowd.setTime(t)                  t = epoch ms of simulation time (Pacific clock); moves everyone, darkens the map at night
//   crowd.setVisible(kinds)           kinds: array of 'walk' 'drive' 'bike' 'transit' 'errand' 'home' (home = the
//                                     population layer: people at home as faint dots), or {kind: bool}
//   crowd.pick(x, y, radiusUnits)     -> {id, mode, state, x, y, …} | null: the nearest drawn agent (the CPU twin of
//                                     the shader decides where everyone is). mode = how they move right now (their
//                                     commute mode, or 'walk' | 'drive' on an errand; the commute mode when still),
//                                     state = one of STATES ('home' 'to-work' 'at-work' 'to-home' 'to-errand'
//                                     'at-errand' 'from-errand'); also travel (null when still), commuteMode, school
//                                     (the destination is a school), kind (render kind), zip, zi, h, m, dist, index
//   crowd.stats()                     -> {agents, moving: {walk, drive, bike, transit, errand}, movingTotal, atHome,
//                                     atWork, atErrand, toWork, toHome, t}: counts by state, refreshed a few times a
//                                     second (in the Worker when there is one)
//   crowd.destroy()
// Extras
//   prewarmCrowd({pack, popSeed, workers}) start the build Workers (and their pack decoding) before the page has a
//                                     map; the first Crowd adopts them. defaultWorkerCount() is the pool size used.
//   crowd.positionOf(id)              -> {x, y, state, kind} of an NPC id 'ZIP-h-m' now (null when not in the crowd)
//   crowd.setQuality({keep, auto})    share of agents drawn (keep, 0..1) and whether it adapts to the frame rate
//   crowd.gpuEval(chunk, minute, dow, first, count) -> Float32Array [x, y, state, kind] × count, read back from the
//                                     vertex shader with transform feedback (tests compare it with the JS twin)
//   crowd.chunks, crowd.count, crowd.summary, crowd.building, crowd.mode ('worker' | 'main' | 'cache'), crowd.cacheWrite
//                                     (a promise of true once a finished build is kept for the next visit)
//
// Worker hand-off. The single-file build exposes the bundled crowd-worker.mjs (an IIFE) as the string
// window.__LEGION_WORKER_SRC__; the crowd starts it from a Blob URL. Unbundled (dev pages over http) it starts
// crowd-worker.mjs as a module worker. Without Workers it builds on the main thread in time slices. Each Worker gets
// the pack (the `pack` option: gzip bytes, base64 string or object; else window.__LEGION_PACK__; else world.pack)
// and builds its own World and Population with the population's seed. Chunks draw as they arrive; meanwhile a few
// agents of the first chunk are checked against the main thread's population, one per idle callback (a cold check
// fits that ZIP's models, milliseconds each, so it never runs inside a message handler). build() resolves once the
// check passes; a mismatch rebuilds on the main thread. The crowd also warms world.raster() in idle time when it is
// created, so the check's first sample does not pay for it while chunks stream in.
//
// A pool of Workers. A cold build is dominated by fitting each ZIP's population models (about 2 ms a ZIP, 3.5 s
// statewide on one core), so the build is split over `workers` Workers (default defaultWorkerCount(): one per spare
// core, at most four): the ZIPs in build order (the region under the camera first) are dealt to them in turn, so
// every Worker starts on the region in view and it fills in several times faster. Who the agents are does not depend
// on the split (each is a pure function of its ZIP, household and member). prewarmCrowd() starts the pool and its
// pack decoding at boot, while the page is still unpacking its own copy.
//
// Memory: the agent record is AGENT_BYTES (32) per agent on the main thread and on the GPU, plus the pick index
// (summary.pickBytesPerAgent, about 3.5 statewide); summary.mainBytesPerAgent is the sum. A Worker build also keeps
// a 14-byte copy of the state arrays per agent in the Worker for stats (summary.workerBytesPerAgent).
//
// The agent cache. Agents are a pure function of the pack, the code, the rate and the seeds, so a finished build is
// kept in IndexedDB (the `cache` option: a key naming the build of the page, such as Legion.html's build id; none
// in development, where the code changes under it). The next visit at the same density loads it in a few hundred
// milliseconds instead of fitting every ZIP's models again; the same spot check runs against the page's
// population, and a mismatch drops the cache and builds. One build is kept (the newest), up to CACHE_MAX_AGENTS.
// The Workers take copies of the state arrays for stats, as after their own build.

import {
  buildRoadNet, buildAgentsGen, agentGLSL, agentPosition, agentPhase, agentKind, colorClass, pickNearest, decodeId, lodValue,
  accumulateStates, statsFrom, emptyStats, simTime, modeCode, commuteTiming, newPhase, zipOrder,
  MODES, KINDS, STATES, KIND_BIT, CLASS_BIT, STUDENT_BIT, S_OUT, S_BACK, S_EOUT, S_EBACK, AGENT_BYTES,
} from './crowd-build.mjs';
import { createProgram, parseColor } from './map.mjs';

/** Crowd colors per palette class (COLOR_CLASSES order) for the two themes; CSS --crowd-* properties override. */
export const CROWD_COLORS = Object.freeze({
  dark: { walk: '#ffb547', 'drive-out': '#f2f5ff', 'drive-home': '#ff3b30', bike: '#46e07c', transit: '#3d9bff', errand: '#b27dff', home: '#9fb2cc' },
  light: { walk: '#d27a1f', 'drive-out': '#1d2433', 'drive-home': '#d62f2f', bike: '#1e9a52', transit: '#1f6fd1', errand: '#7c4dff', home: '#4f5f74' },
});
const CLASS_NAMES = ['walk', 'drive-out', 'drive-home', 'bike', 'transit', 'errand', 'home'];

const FS = `#version 300 es
precision mediump float;
in vec4 v_color;
uniform float u_glow;
uniform float u_soft;
out vec4 o;
void main() {
  float a = v_color.a;
  if (u_soft > 0.5) {
    vec2 d = gl_PointCoord * 2.0 - 1.0;
    float r2 = dot(d, d);
    if (r2 > 1.0) discard;
    a *= 1.0 - smoothstep(0.35, 1.0, r2);
  }
  o = vec4(v_color.rgb * a, a * (1.0 - u_glow));
}`;

function vertexShader(net, tf) {
  return `#version 300 es
${tf ? '#define TF 1' : ''}
precision highp float;
precision highp int;
layout(location = 0) in vec2 a_home;
layout(location = 1) in vec2 a_dest;
layout(location = 2) in uvec3 a_tm;
layout(location = 3) in uint a_days;
layout(location = 4) in uint a_mode;
layout(location = 5) in uvec3 a_route;
layout(location = 6) in uint a_ew;
layout(location = 7) in vec2 a_eoff;
uniform vec4 u_view;
uniform vec2 u_ext;
uniform float u_minute;
uniform int u_dow;
uniform float u_size;
uniform float u_keep;
uniform uint u_base;
uniform int u_mask;
uniform vec4 u_color[7];
uniform float u_homeAlpha;
out vec4 v_color;
#ifdef TF
out vec4 v_tf;
#endif
${agentGLSL(net)}
void main() {
  v_color = vec4(0.0);
#ifndef TF
  uint idx = u_base + uint(gl_VertexID);
  if (float(mix32(idx ^ 0x5bd1e995u) >> 8u) / 16777216.0 >= u_keep) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; return;
  }
#endif
  vec2 pos;
  int kind;
  int s = agentEval(a_home * u_ext, a_dest * u_ext, a_tm, a_days, a_mode, a_route, a_ew, a_eoff * 0.25, u_minute, u_dow, pos, kind);
#ifdef TF
  v_tf = vec4(pos, float(s), float(kind));
  gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
  gl_PointSize = 1.0;
#else
  int cls = colorClass(s, kind);
  int bit = cls == 0 ? 1 : cls <= 2 ? 2 : cls == 3 ? 4 : cls == 4 ? 8 : cls == 5 ? 16 : 32;
  if (cls < 0 || (u_mask & bit) == 0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; return; }
  gl_Position = vec4((pos - u_view.xy) * u_view.zw, 0.0, 1.0);
  bool atHome = cls == 6;
  gl_PointSize = u_size * (atHome ? 0.8 : 1.0);
  vec4 c = u_color[cls];
  v_color = vec4(c.rgb, c.a * (atHome ? u_homeAlpha : 1.0));
#endif
}`;
}

/**
 * How dark it is at t (epoch ms) in central California: 0 in daylight, 1 once the sun is 9° below the horizon,
 * from the sun's elevation (low-precision solar ephemeris, good to a fraction of a degree).
 * @param {number} t
 * @param {number} [lat] @param {number} [lon] degrees
 * @returns {number}
 */
export function nightFactor(t, lat = 37.2, lon = -119.5) {
  const d = t / 86400000 - 10957.5, rad = Math.PI / 180;
  const g = (357.529 + 0.98560028 * d) * rad;
  const q = 280.459 + 0.98564736 * d;
  const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * rad;
  const e = (23.439 - 0.00000036 * d) * rad;
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const gmst = (((18.697374558 + 24.06570982441908 * d) % 24) + 24) % 24;
  const ha = (gmst * 15 + lon) * rad - ra;
  const alt = Math.asin(Math.sin(lat * rad) * Math.sin(dec) + Math.cos(lat * rad) * Math.cos(dec) * Math.cos(ha)) / rad;
  const k = Math.min(1, Math.max(0, (3 - alt) / 12));
  return k * k * (3 - 2 * k);
}

/** Resolve on the next macrotask (MessageChannel when available: setTimeout clamps nested waits to 4 ms). */
function nextTask() {
  if (typeof MessageChannel === 'function') return new Promise(r => { const ch = new MessageChannel(); ch.port1.onmessage = () => { ch.port1.close(); r(); }; ch.port2.postMessage(0); });
  return new Promise(r => setTimeout(r, 0));
}

/** Two stats objects (emptyStats shape) added together. */
function addStats(a, b) {
  const out = Object.assign(emptyStats(), a);
  out.moving = Object.assign({}, a.moving);
  for (const k of ['agents', 'movingTotal', 'atHome', 'atWork', 'atErrand', 'toWork', 'toHome']) out[k] = (a[k] || 0) + (b[k] || 0);
  for (const k of Object.keys(b.moving || {})) out.moving[k] = (out.moving[k] || 0) + (b.moving[k] || 0);
  return out;
}

/** Run fn when the main thread is idle (within 250 ms at the latest). */
function idle(fn) {
  if (typeof requestIdleCallback === 'function') requestIdleCallback(() => fn(), { timeout: 250 });
  else setTimeout(fn, 16);
}

/** Agents of a Worker build checked against the main thread's population (one per idle callback). */
const VERIFY_SAMPLES = 6;

/**
 * Workers for a build: one per core the page can spare (the main thread keeps one), at most four, and at most two
 * on a device that reports little memory (each Worker holds its own decoded pack, about 15 MB, and its ZIPs' models).
 * @returns {number}
 */
export function defaultWorkerCount() {
  const nav = typeof navigator !== 'undefined' ? navigator : {};
  const cores = Number(nav.hardwareConcurrency) || 2;
  let n = Math.max(1, Math.min(4, cores - 1));
  if (Number(nav.deviceMemory) > 0 && Number(nav.deviceMemory) < 4) n = Math.min(n, 2);
  return n;
}

/** Start one build Worker (from the inline bundle in the single file, else the module file); null when impossible. */
function spawnWorker(url) {
  try {
    if (url) return new Worker(url, { name: 'legion-crowd' });
    return new Worker(new URL('./crowd-worker.mjs', import.meta.url), { type: 'module', name: 'legion-crowd' });
  } catch { return null; }
}

/** A Blob URL of the inline worker source, or null (unbundled pages start the module file). */
function workerURL() {
  const src = typeof window !== 'undefined' ? window.__LEGION_WORKER_SRC__ : undefined;
  if (typeof src !== 'string' || !src.length) return null;
  try { return URL.createObjectURL(new Blob([src], { type: 'text/javascript' })); } catch { return null; }
}

// Workers started by prewarmCrowd, waiting for the first Crowd to adopt them.
let PREWARMED = null;

/**
 * Start the crowd's build Workers now and have them decode the pack and build their World and Population, so the
 * first build starts at once (the page calls this at boot, before it unpacks its own copy of the pack). The first
 * Crowd adopts them; calling it again, or with no Worker support, does nothing.
 * @param {{pack?: Uint8Array|ArrayBuffer|string|object, popSeed?: number|null, workers?: number}} [opts]
 *   pack: as the Crowd's `pack` option (default window.__LEGION_PACK__); popSeed: the population's seed
 * @returns {number} the Workers started
 */
export function prewarmCrowd({ pack = null, popSeed = null, workers = defaultWorkerCount() } = {}) {
  if (PREWARMED || typeof Worker === 'undefined') return 0;
  const p = pack != null ? pack : (typeof window !== 'undefined' && typeof window.__LEGION_PACK__ === 'string' ? window.__LEGION_PACK__ : null);
  if (p == null) return 0;
  const url = workerURL();
  const list = [];
  for (let k = 0; k < Math.max(1, workers | 0); k++) {
    const w = spawnWorker(url);
    if (!w) break;
    // each Worker gets its own copy: bytes are copied, a string or an object is cloned by postMessage
    const copy = p instanceof ArrayBuffer ? p.slice(0) : ArrayBuffer.isView(p) ? new Uint8Array(p.buffer.slice(p.byteOffset, p.byteOffset + p.byteLength)) : p;
    try { w.postMessage({ type: 'prepare', pack: copy, popSeed: popSeed == null ? null : popSeed >>> 0 }); } catch { w.terminate(); break; }
    list.push(w);
  }
  if (!list.length) { if (url) URL.revokeObjectURL(url); return 0; }
  PREWARMED = { workers: list, url, popSeed: popSeed == null ? null : popSeed >>> 0, packKind: pack != null ? 'option' : 'window', at: typeof performance !== 'undefined' ? performance.now() : 0 };
  return list.length;
}

/** Sum the build summaries of a pool's Workers (each built a share of the ZIPs) into one. */
export function mergeSummaries(parts) {
  const list = parts.filter(Boolean);
  if (!list.length) return null;
  if (list.length === 1) return list[0];
  const out = { ...list[0], byMode: { ...list[0].byMode }, byKind: { ...list[0].byKind }, regions: { ...list[0].regions } };
  for (const p of list.slice(1)) {
    for (const k of ['agents', 'households', 'zips', 'zipsWithAgents', 'chunks', 'commuters', 'highway', 'errands', 'overflow', 'pickBytes']) out[k] = (out[k] || 0) + (p[k] || 0);
    for (const [k, v] of Object.entries(p.byMode || {})) out.byMode[k] = (out.byMode[k] || 0) + v;
    for (const [k, v] of Object.entries(p.byKind || {})) out.byKind[k] = (out.byKind[k] || 0) + v;
    for (const [k, v] of Object.entries(p.regions || {})) out.regions[k] = (out.regions[k] || 0) + v;
    out.ms = Math.max(out.ms || 0, p.ms || 0);
  }
  out.pickBytesPerAgent = out.agents ? +(out.pickBytes / out.agents).toFixed(3) : 0;
  return out;
}
/** Bytes per agent of the Worker's copy of the state arrays (days, timing, errand, eoff, mode) for stats. */
const WORKER_STATS_BYTES = 14;

// ---------------------------------------------------------------- the agent cache (IndexedDB)

const CACHE_DB = 'legion-crowd';
/** Bump when the stored chunk layout changes. */
const CACHE_FORMAT = 1;
/** Builds larger than this are not kept (about 140 MB). */
export const CACHE_MAX_AGENTS = 4e6;

/** Open the cache database, or null when this page has no IndexedDB (or it is blocked: private windows, file policies). */
function openCacheDB() {
  return new Promise(resolve => {
    let req;
    try { if (typeof indexedDB === 'undefined') { resolve(null); return; } req = indexedDB.open(CACHE_DB, CACHE_FORMAT); } catch { resolve(null); return; }
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of ['builds', 'chunks']) if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
}

/** Run one request in a transaction of `db`; resolves with its result, or null on any failure. */
function idbRequest(db, stores, mode, make) {
  return new Promise(resolve => {
    try {
      const tx = db.transaction(stores, mode);
      const req = make(tx);
      let out = null;
      if (req) req.onsuccess = () => { out = req.result; };
      tx.oncomplete = () => resolve(out === undefined ? null : out);
      tx.onerror = tx.onabort = () => resolve(null);
    } catch { resolve(null); }
  });
}

/** The data of a chunk as stored: everything but the GPU objects and its place in this page's crowd. */
function storedChunk(c) {
  const { gpu: _gpu, start: _start, ...data } = c;
  return data;
}

/**
 * Read a kept build: {manifest, chunks} or null (none under this key, or anything failed). The manifest is read
 * first and alone, so a miss costs one small request before a build starts.
 * @param {string} key
 */
export async function readCachedCrowd(key) {
  const db = await openCacheDB();
  if (!db) return null;
  try {
    const manifest = await idbRequest(db, ['builds'], 'readonly', tx => tx.objectStore('builds').get(key));
    if (!manifest || manifest.format !== CACHE_FORMAT || !(manifest.chunks > 0)) return null;
    const chunks = [];
    const ok = await new Promise(resolve => {
      try {
        const tx = db.transaction(['chunks'], 'readonly'), store = tx.objectStore('chunks');
        for (let i = 0; i < manifest.chunks; i++) { const r = store.get(`${key}#${i}`); r.onsuccess = () => { chunks[i] = r.result; }; }
        tx.oncomplete = () => resolve(true);
        tx.onerror = tx.onabort = () => resolve(false);
      } catch { resolve(false); }
    });
    if (!ok || chunks.length !== manifest.chunks || chunks.some(c => !c || !(c.count >= 0) || !c.home)) return null;
    return { manifest, chunks };
  } finally { db.close(); }
}

/**
 * Keep a finished build under `key`, replacing any other (one build is kept). Chunks are written one per idle
 * moment, the manifest last, so a visit that reads while this writes finds nothing rather than half a crowd.
 * @param {string} key
 * @param {object[]} chunks the crowd's chunks
 * @param {object} summary the build summary
 * @returns {Promise<boolean>} true when kept
 */
export async function writeCachedCrowd(key, chunks, summary) {
  const agents = chunks.reduce((a, c) => a + (c.count || 0), 0);
  if (!agents || agents > CACHE_MAX_AGENTS) return false;
  const db = await openCacheDB();
  if (!db) return false;
  try {
    // one build is kept: drop everything first, the chunks of an earlier write a closed page left unfinished included
    await idbRequest(db, ['builds', 'chunks'], 'readwrite', tx => { tx.objectStore('builds').clear(); tx.objectStore('chunks').clear(); return null; });
    for (let i = 0; i < chunks.length; i++) {
      await new Promise(r => idle(r));
      const done = await new Promise(resolve => {
        try {
          const tx = db.transaction(['chunks'], 'readwrite');
          tx.objectStore('chunks').put(storedChunk(chunks[i]), `${key}#${i}`);
          tx.oncomplete = () => resolve(true);
          tx.onerror = tx.onabort = () => resolve(false);
        } catch { resolve(false); }
      });
      if (!done) return false;
    }
    const { cancelled: _c, ...kept } = summary || {};
    const manifest = { key, format: CACHE_FORMAT, chunks: chunks.length, agents, savedAt: Date.now(), summary: kept };
    return !!(await new Promise(resolve => {
      try {
        const tx = db.transaction(['builds'], 'readwrite');
        tx.objectStore('builds').put(manifest, key);
        tx.oncomplete = () => resolve(true);
        tx.onerror = tx.onabort = () => resolve(false);
      } catch { resolve(false); }
    }));
  } finally { db.close(); }
}

/** Forget every kept build (Settings, tests). */
export async function clearCachedCrowds() {
  const db = await openCacheDB();
  if (!db) return false;
  try { return (await idbRequest(db, ['builds', 'chunks'], 'readwrite', tx => { tx.objectStore('builds').clear(); tx.objectStore('chunks').clear(); return null; })) !== false; } finally { db.close(); }
}

/** The GPU crowd layer of a MapView: builds agents (in a Worker when it can), draws them, counts and picks them. */
export class Crowd {
  /**
   * @param {import('./map.mjs').MapView} mapView
   * @param {object} opts
   * @param {import('../engine/world.mjs').World} opts.world
   * @param {object} opts.population Population (CONTRACTS §5)
   * @param {number} [opts.rate] share of households drawn (pop.includes)
   * @param {number} [opts.seed] crowd seed (errands, lanes)
   * @param {Uint8Array|ArrayBuffer|string|object} [opts.pack] the world pack for the Worker
   * @param {boolean} [opts.worker] build in Workers when possible (default true)
   * @param {number} [opts.workers] how many Workers share a build (default defaultWorkerCount())
   * @param {number} [opts.maxAgents] cap on agents (the rate is lowered to fit)
   * @param {string|null} [opts.cache] a key naming this build of the code and the pack (Legion.html's build id): finished
   *   builds are kept in IndexedDB under it and the next visit loads them; null (the default) keeps nothing
   */
  constructor(mapView, { world, population, rate = 0.025, seed = 1, pack = null, worker = true, workers = null, maxAgents = 5e6, cache = null } = {}) {
    if (!mapView || !world || !population) throw new Error('Crowd needs a map, a world and a population');
    this.map = mapView;
    this.world = world;
    this.population = population;
    this.rate = rate;
    this.seed = seed >>> 0;
    this.packSource = pack;
    this.useWorker = worker !== false;
    this.poolSize = Math.max(1, Math.min(8, Number.isInteger(workers) && workers > 0 ? workers : defaultWorkerCount()));
    this.maxAgents = maxAgents;
    this.cacheKey = typeof cache === 'string' && cache ? cache : null;
    this._adopted = false;
    this.net = buildRoadNet(world);
    this.chunks = [];
    this.count = 0;
    this.summary = null;
    this.building = false;
    this.mode = null;
    this.mask = KIND_BIT.walk | KIND_BIT.drive | KIND_BIT.bike | KIND_BIT.transit | KIND_BIT.errand;
    this.keep = 1;
    this.autoQuality = true;
    this._stats = Object.assign(emptyStats(), { t: null });
    this._statsSeq = 0; this._statsInFlight = false; this._statsAt = 0; this._statsTimer = 0; this._mainStats = null;
    this._buildId = 0; this._job = null;
    this._workers = []; this._workerUrl = null; this._statsWait = null;
    this._gl = null; this._frameT = 0; this._slow = 0; this._fast = 0;
    this._destroyed = false;
    this._readColors();
    // a theme sets both the colors and how dark the night shade gets
    this._offTheme = mapView.on('theme', () => { this._readColors(); this._applyShade(); this.map.requestRender(); });
    this.setTime(world.snapshotTime || Date.now());
    mapView.addLayer(this);
    // householdCore (the Worker check, a main-thread build) needs the ZIP raster: build it now, in idle time, if the
    // page has not, rather than in the middle of a build
    idle(() => { if (!this._destroyed) this.world.raster(); });
  }

  // ------------------------------------------------ time, visibility, quality

  /** Set the simulation time (epoch ms): positions, night shading, stats. */
  setTime(t) {
    this.t = +t;
    const st = simTime(this.t);
    this.minute = st.minute; this.dow = st.dow;
    this.night = nightFactor(this.t);
    this._applyShade();
    this.map.requestRender();
    this._requestStats();
  }

  /** Night shade of the base map for the current time and theme (lighter in the light theme). */
  _applyShade() { this.map.setShade(this.night * (this.map.dark === false ? 0.16 : 0.3)); }

  /** Which kinds are drawn (and pickable): array of KINDS names or {kind: bool}. 'home' is the population layer. */
  setVisible(kinds) {
    let mask = 0;
    if (Array.isArray(kinds)) for (const k of kinds) mask |= KIND_BIT[k] || 0;
    else if (kinds && typeof kinds === 'object') for (const [k, on] of Object.entries(kinds)) if (on) mask |= KIND_BIT[k] || 0;
    this.mask = mask;
    this.map.requestRender();
  }

  /** Visible kinds as an array of names. */
  visibleKinds() { return KINDS.filter(k => this.mask & KIND_BIT[k]); }

  /** Draw a share of the agents (keep, 0..1) and/or adapt it to the frame rate (auto). */
  setQuality({ keep, auto } = {}) {
    if (keep != null) this.keep = Math.max(0.01, Math.min(1, +keep));
    if (auto != null) this.autoQuality = !!auto;
    this.map.requestRender();
  }

  _readColors() {
    const theme = this.map.theme === 'light' ? 'light' : 'dark', base = CROWD_COLORS[theme];
    const st = typeof getComputedStyle === 'function' ? getComputedStyle(this.map.container) : null;
    this._colors = new Float32Array(28);
    CLASS_NAMES.forEach((name, i) => {
      const c = (st && parseColor(st.getPropertyValue('--crowd-' + name))) || parseColor(base[name]);
      this._colors.set([c[0], c[1], c[2], name === 'home' ? 1 : 0.9], 4 * i);
    });
  }

  // ------------------------------------------------ building

  /**
   * Build the crowd (replacing any previous one). Chunks stream in region by region and draw as they arrive.
   * @param {{rate?:number, onProgress?:(fraction:number, agents:number)=>void, focus?:{x:number,y:number}|false}} [opts]
   * @returns {Promise<object>} the build summary (agents, byMode, byKind, highway, errands, ms, mode …), or
   *   {cancelled: true} when another build replaced this one
   */
  async build({ rate = this.rate, onProgress = null, focus } = {}) {
    if (this._destroyed) throw new Error('crowd destroyed');
    const id = ++this._buildId;
    if (this._job) { this._job.cancelled = true; this._job.resolve({ cancelled: true, agents: this.count }); }
    this._clear();
    this._adopted = false;
    const est = rate * this.world.totalPop;
    const capped = est > this.maxAgents;
    this.rate = capped ? this.maxAgents / this.world.totalPop : rate;
    const f = focus === false ? null : focus || { x: this.map.camera.x, y: this.map.camera.y };
    const t0 = performance.now();
    this.building = true;
    let summary;
    try {
      // a build this page's code and pack made before, at this density: loaded, checked, done
      const kept = this.cacheKey ? await this._fromCache(id, onProgress) : null;
      if (id !== this._buildId) return { cancelled: true, agents: this.count };
      if (kept) { summary = kept; this.mode = 'cache'; }
      else if (this.useWorker && this._ensureWorkers()) {
        try { summary = await this._buildInWorkers(id, onProgress, f); this.mode = 'worker'; }
        catch (e) {
          if (id !== this._buildId) return { cancelled: true, agents: this.count };
          console.warn('Legion crowd: the worker build failed, building on the main thread instead.', e && e.message || e);
          this._killWorkers(); this._clear();
          summary = await this._buildOnMain(id, onProgress, f); this.mode = 'main';
        }
      } else { summary = await this._buildOnMain(id, onProgress, f); this.mode = 'main'; }
    } finally { if (id === this._buildId) { this.building = false; this._job = null; } }
    if (!summary || summary.cancelled) return summary || { cancelled: true, agents: this.count };
    const pickPer = summary.agents ? (summary.pickBytes || 0) / summary.agents : 0;
    summary = Object.assign({}, summary, {
      mode: this.mode, pack: this.mode === 'worker' ? this.packKind : null, totalMs: Math.round(performance.now() - t0), rateCapped: capped, rate: this.rate,
      bytesPerAgent: AGENT_BYTES, pickBytesPerAgent: +pickPer.toFixed(3), mainBytesPerAgent: +(AGENT_BYTES + pickPer).toFixed(3),
      workerBytesPerAgent: this.mode === 'worker' || this._adopted ? WORKER_STATS_BYTES : 0, workers: this.mode === 'worker' ? this._workers.length : 0,
      cached: this.mode === 'cache',
    });
    this.summary = summary;
    this._requestStats(true);
    this.map.requestRender();
    // keep a fresh build for the next visit, a chunk per idle moment once the page has settled (cacheWrite resolves
    // true once it is kept)
    if (this.cacheKey && this.mode !== 'cache') {
      const key = this._cacheKeyFor(), chunks = this.chunks.slice(), kept = summary;
      this.cacheWrite = new Promise(r => setTimeout(r, 400)).then(() => (!this._destroyed && id === this._buildId ? writeCachedCrowd(key, chunks, kept) : false)).catch(() => false);
    } else this.cacheWrite = Promise.resolve(this.mode === 'cache');
    return summary;
  }

  /** The cache key of the current build: the page's build key, the rate, the crowd's and the population's seeds. */
  _cacheKeyFor() { return `${this.cacheKey}|${this.rate}|${this.seed}|${this._popSeed()}`; }

  /**
   * Load a kept build (readCachedCrowd) into the crowd, then check a few agents against the page's population as
   * after a Worker build; a mismatch (or any failure) clears the crowd and the cache and returns null, and the
   * build runs as usual. The Workers, when there are any, take copies of the state arrays for stats.
   */
  async _fromCache(id, onProgress) {
    const t0 = performance.now();
    let kept = null;
    try { kept = await readCachedCrowd(this._cacheKeyFor()); } catch { kept = null; }
    if (!kept || id !== this._buildId) return null;
    for (const c of kept.chunks) this._addChunk(c);
    if (onProgress) onProgress(0.98, this.count);
    const ok = await this._verifyChunks(kept.chunks, id);
    if (id !== this._buildId) return null;
    if (!ok) { this._clear(); clearCachedCrowds().catch(() => false); return null; }
    this._adoptStats(kept.chunks);
    return Object.assign({}, kept.manifest.summary, { ms: Math.round(performance.now() - t0), verified: VERIFY_SAMPLES, savedAt: kept.manifest.savedAt });
  }

  /**
   * Check VERIFY_SAMPLES agents of the first chunk with agents against the page's population, one per task (a few
   * milliseconds each, the first fitting its ZIP's models): not in idle time, which slow frames can hold back for
   * seconds while the kept crowd is already on the map.
   */
  _verifyChunks(chunks, id) {
    const c = chunks.find(x => x && x.count);
    if (!c) return Promise.resolve(true);
    const n = c.count, step = Math.max(1, Math.floor(n / VERIFY_SAMPLES)), samples = [];
    for (let i = 0; i < n && samples.length < VERIFY_SAMPLES; i += step) samples.push(i);
    return new Promise(resolve => {
      const next = k => {
        if (id !== this._buildId || this._destroyed) { resolve(false); return; }
        if (k >= samples.length) { resolve(true); return; }
        const i = samples[k];
        let ok = false;
        try {
          const { zi, h, m } = decodeId(c, i, this.world);
          const core = this.population.householdCore(zi, h);
          const mem = core && core.members && core.members.find((x, j) => (x.m == null ? j : x.m) === m);
          if (mem && modeCode(mem.mode) === (c.mode[i] & 15)) {
            const tm = commuteTiming(mem);
            ok = tm[0] === c.timing[3 * i] && tm[1] === c.timing[3 * i + 1] && tm[2] === c.timing[3 * i + 2];
          }
        } catch { ok = false; }
        if (!ok) { resolve(false); return; }
        nextTask().then(() => next(k + 1));
      };
      nextTask().then(() => next(0));
    });
  }

  /** Give the Workers (when the page has them) copies of the state arrays, chunk by chunk in turn, for stats. */
  _adoptStats(chunks) {
    this._adopted = false;
    if (!this.useWorker || !this._ensureWorkers()) return;
    const K = this._workers.length, shares = this._workers.map(() => []);
    chunks.forEach((c, k) => shares[k % K].push({ count: c.count, unitKm: c.unitKm, days: c.days.slice(), timing: c.timing.slice(), errand: c.errand.slice(), eoff: c.eoff.slice(), mode: c.mode.slice() }));
    try {
      this._workers.forEach((slot, k) => slot.w.postMessage({ type: 'adopt', chunks: shares[k] }, shares[k].flatMap(c => [c.days.buffer, c.timing.buffer, c.errand.buffer, c.eoff.buffer, c.mode.buffer])));
      this._adopted = true;
    } catch { this._adopted = false; }
  }

  /** The build Workers (adopting prewarmed ones first), or null when this page cannot run Workers. */
  _ensureWorkers() {
    if (this._workers.length) return this._workers;
    if (typeof Worker === 'undefined') return null;
    const seed = this._popSeed();
    if (PREWARMED && PREWARMED.popSeed === seed) {
      const pre = PREWARMED;
      PREWARMED = null;
      this._workerUrl = pre.url; this.packKind = pre.packKind;
      for (const w of pre.workers) this._adopt(w, true);
    } else if (PREWARMED) {
      // started for another population: of no use here
      for (const w of PREWARMED.workers) w.terminate();
      if (PREWARMED.url) URL.revokeObjectURL(PREWARMED.url);
      PREWARMED = null;
    }
    if (!this._workers.length) {
      this._workerUrl = workerURL();
      for (let k = 0; k < this.poolSize; k++) { const w = spawnWorker(this._workerUrl); if (!w) break; this._adopt(w, false); }
      if (!this._workers.length) { if (this._workerUrl) URL.revokeObjectURL(this._workerUrl); this._workerUrl = null; return null; }
    }
    return this._workers;
  }

  /** Take a Worker into the pool: its messages, its errors, whether it has the pack already. */
  _adopt(w, hasPack) {
    const k = this._workers.length;
    const slot = { w, k, hasPack, answered: false };
    w.onmessage = e => this._onWorkerMessage(e.data, slot);
    w.onerror = e => {
      if (e && e.preventDefault) e.preventDefault();
      const job = this._job;
      this._killWorkers();
      if (job && !job.cancelled) job.reject(new Error((e && e.message) || 'crowd worker failed to load'));
    };
    w.onmessageerror = () => { const job = this._job; if (job) job.reject(new Error('crowd worker message could not be read')); };
    this._workers.push(slot);
  }

  _killWorkers() {
    for (const s of this._workers) { s.w.onmessage = null; s.w.onerror = null; s.w.terminate(); }
    if (this._workerUrl) URL.revokeObjectURL(this._workerUrl);
    this._workers = []; this._workerUrl = null; this._statsInFlight = false; this._statsWait = null;
  }

  _packForWorker() {
    const p = this.packSource;
    if (p != null) {
      this.packKind = 'option';
      if (p instanceof ArrayBuffer) return p.slice(0);
      if (ArrayBuffer.isView(p)) return new Uint8Array(p.buffer.slice(p.byteOffset, p.byteOffset + p.byteLength));
      return p;
    }
    if (typeof window !== 'undefined' && typeof window.__LEGION_PACK__ === 'string') { this.packKind = 'window'; return window.__LEGION_PACK__; }
    this.packKind = 'world';
    return this.world.pack;
  }

  _popSeed() {
    const p = this.population;
    const s = p.seed != null ? p.seed : p.options && p.options.seed != null ? p.options.seed : null;
    return s == null ? null : s >>> 0;
  }

  /**
   * Build in the pool: the ZIPs in build order (the region in view first) dealt to the Workers in turn, so each
   * starts on the same region; chunks draw as they arrive from any of them; the build resolves when every Worker is
   * done and the spot check passed.
   */
  _buildInWorkers(id, onProgress, focus) {
    const slots = this._workers, K = slots.length;
    const order = zipOrder(this.world, { focus });
    const shares = slots.map(() => []);
    order.forEach((zi, j) => shares[j % K].push(zi));
    const weights = shares.map(list => list.reduce((a, zi) => a + this.population.householdCount(zi), 0));
    const total = weights.reduce((a, b) => a + b, 0) || 1;
    return new Promise((resolve, reject) => {
      const job = this._job = { id, resolve, reject, onProgress, cancelled: false, verify: null, summary: null, parts: slots.map(() => ({ progress: 0, summary: null })), weights, total, started: false };
      job.progress = () => job.parts.reduce((a, p, k) => a + p.progress * job.weights[k], 0) / job.total;
      for (let k = 0; k < K; k++) {
        const slot = slots[k];
        // a small first chunk from each Worker puts people on the map within moments; then 128K-agent chunks
        const msg = { type: 'build', id, rate: this.rate, seed: this.seed, popSeed: this._popSeed(), focus, zips: shares[k], chunkTarget: 131072, firstChunkTarget: 16384, pack: null };
        if (!slot.hasPack) { msg.pack = this._packForWorker(); slot.hasPack = true; }
        try { slot.w.postMessage(msg); } catch (e) { slot.hasPack = false; reject(e); return; }
      }
      job.timer = setTimeout(() => { if (this._job === job && !job.started) reject(new Error('crowd worker did not start')); }, 20000);
    }).finally(() => { if (this._job && this._job.id === id) clearTimeout(this._job.timer); });
  }

  _onWorkerMessage(m, slot) {
    if (!m || typeof m !== 'object') return;
    if (m.type === 'stats') { this._onStats(m, slot); return; }
    if (!slot.answered) {
      slot.answered = true;
      // every Worker has fetched the script once each has answered: the Blob URL can go
      if (this._workerUrl && this._workers.every(s => s.answered)) { URL.revokeObjectURL(this._workerUrl); this._workerUrl = null; }
    }
    if (m.type === 'prepared') return;
    const job = this._job;
    if (!job || m.id !== job.id || job.cancelled) return;
    job.started = true;
    const part = job.parts && job.parts[slot.k];
    switch (m.type) {
      case 'chunk': {
        const c = m.chunk;
        this._addChunk(c);
        if (!job.verify && c.count) this._queueVerify(job, c);
        if (part) part.progress = m.progress;
        if (job.onProgress) job.onProgress(job.progress ? job.progress() : m.progress, this.count);
        break;
      }
      case 'progress':
        if (part) part.progress = m.progress;
        if (job.onProgress) job.onProgress(job.progress ? job.progress() : m.progress, this.count);
        break;
      case 'loaded': job.loadMs = Math.max(job.loadMs || 0, m.ms); break;
      case 'done': {
        if (part) { part.summary = m.summary; part.progress = 1; }
        if (job.parts.some(p => !p.summary)) break;
        const v = job.verify;
        job.summary = Object.assign(mergeSummaries(job.parts.map(p => p.summary)), { workerLoadMs: job.loadMs });
        // an empty crowd has nothing to check; otherwise the last sample to check out resolves the build
        if (!v || v.done) this._resolveVerified(job);
        break;
      }
      case 'error': slot.hasPack = false; job.reject(new Error(m.message)); break;
      default: break;
    }
  }

  /**
   * The Worker built its own population: queue a spot check, against the main thread's, of agents spread over the
   * first chunk with agents. The check runs one agent per idle callback (_verifyStep), never in a message handler.
   */
  _queueVerify(job, c) {
    const n = c.count, step = Math.max(1, Math.floor(n / VERIFY_SAMPLES)), samples = [];
    for (let i = 0; i < n && samples.length < VERIFY_SAMPLES; i += step) {
      const { zi, h, m } = decodeId(c, i, this.world);
      samples.push({ zi, h, m, mode: c.mode[i] & 15, timing: [c.timing[3 * i], c.timing[3 * i + 1], c.timing[3 * i + 2]] });
    }
    job.verify = { samples, next: 0, done: false, maxMs: 0 };
    idle(() => this._verifyStep(job));
  }

  /** Check one queued agent; reject the job on a mismatch, resolve it after the last one if 'done' came first. */
  _verifyStep(job) {
    if (job.cancelled || this._job !== job || this._destroyed) return;
    const t0 = performance.now(), v = job.verify, s = v.samples[v.next++];
    let ok = false;
    try {
      const core = this.population.householdCore(s.zi, s.h);
      const mem = core && core.members && core.members.find((x, k) => (x.m == null ? k : x.m) === s.m);
      if (mem && modeCode(mem.mode) === s.mode) {
        const tm = commuteTiming(mem);
        ok = tm[0] === s.timing[0] && tm[1] === s.timing[1] && tm[2] === s.timing[2];
      }
    } catch { ok = false; }
    v.maxMs = Math.max(v.maxMs, performance.now() - t0);
    if (!ok) { job.reject(new Error(`worker population differs from the main thread population (${this.world.zips[s.zi]}-${s.h}-${s.m})`)); return; }
    if (v.next < v.samples.length) { idle(() => this._verifyStep(job)); return; }
    v.done = true;
    if (job.summary) this._resolveVerified(job);
  }

  /** Resolve a Worker job whose 'done' arrived and whose check passed, noting the check in the summary. */
  _resolveVerified(job) {
    const v = job.verify;
    job.resolve(Object.assign(job.summary, { verified: v ? v.samples.length : 0, verifyMaxMs: v ? Math.round(v.maxMs * 10) / 10 : 0 }));
  }

  async _buildOnMain(id, onProgress, focus) {
    const gen = buildAgentsGen(this.world, this.population, { rate: this.rate, seed: this.seed, focus, chunkTarget: 131072, firstChunkTarget: 16384, byRegion: true, roadNet: this.net });
    const job = this._job = { id, cancelled: false, resolve: () => {}, reject: () => {}, onProgress };
    let r, sliceStart = performance.now();
    while (!(r = gen.next()).done) {
      if (job.cancelled || id !== this._buildId || this._destroyed) return { cancelled: true, agents: this.count };
      const v = r.value;
      if (v.type === 'chunk') { this._addChunk(v.chunk); if (onProgress) onProgress(v.progress, this.count); }
      if (performance.now() - sliceStart > 8) {
        if (onProgress && v.type !== 'chunk') onProgress(v.progress, this.count);
        await nextTask();
        sliceStart = performance.now();
      }
    }
    return r.value;
  }

  _addChunk(c) {
    c.start = this.count;
    this.chunks.push(c);
    this.count += c.count;
    if (this._gl) this._upload(this._gl, c);
    this._requestStats(true);
    this.map.requestRender();
  }

  _clear() {
    const gl = this._gl;
    for (const c of this.chunks) if (c.gpu && gl) { gl.deleteVertexArray(c.gpu.vao); for (const b of c.gpu.bufs) gl.deleteBuffer(b); }
    this.chunks = []; this.count = 0; this.summary = null;
    this._stats = Object.assign(emptyStats(), { t: this.t });
    this.map.requestRender();
  }

  // ------------------------------------------------ stats

  /** Latest counts by state (see the header); recomputed a few times a second as time moves. */
  stats() { return this._stats; }

  /** One Worker's counts: summed with the others' answers to the same request, then published. */
  _onStats(m, slot) {
    const wait = this._statsWait;
    if (!wait || m.seq !== wait.seq) { if (!wait) this._statsInFlight = false; return; }
    wait.acc = wait.acc ? addStats(wait.acc, m.stats) : m.stats;
    if (--wait.left > 0) return;
    this._statsInFlight = false; this._statsWait = null;
    if (wait.seq === this._statsSeq) this._stats = Object.assign(wait.acc, { t: m.t });
    if (this._statsDirty) this._requestStats();
  }

  _requestStats(force = false) {
    this._statsDirty = true;
    if (!this.count) { this._stats = Object.assign(emptyStats(), { t: this.t }); return; }
    if (this._statsTimer) return;
    const wait = force ? 0 : Math.max(0, 220 - (performance.now() - this._statsAt));
    this._statsTimer = setTimeout(() => { this._statsTimer = 0; this._runStats(); }, wait);
  }

  _runStats() {
    if (this._destroyed || !this._statsDirty) return;
    // the Workers hold copies of the state arrays once their build is done (or once they adopted a kept build's);
    // during and without it, the main thread counts
    if (this._workers.length && (this.mode === 'worker' || (this.mode === 'cache' && this._adopted)) && !this.building) {
      if (this._statsInFlight) return;
      this._statsDirty = false; this._statsInFlight = true; this._statsAt = performance.now();
      const seq = ++this._statsSeq;
      this._statsWait = { seq, left: this._workers.length, acc: null, t: this.t };
      for (const s of this._workers) s.w.postMessage({ type: 'stats', seq, minute: this.minute, dow: this.dow, t: this.t });
      return;
    }
    this._statsDirty = false; this._statsAt = performance.now();
    this._countOnMain();
  }

  async _countOnMain() {
    const token = this._mainStats = {};
    const minute = this.minute, dow = this.dow, t = this.t, chunks = this.chunks.slice();
    const acc = new Float64Array(10), P = newPhase();
    let n = 0, sliceStart = performance.now();
    for (const c of chunks) {
      for (let i = 0; i < c.count; i += 32768) {
        accumulateStates(c, i, Math.min(c.count, i + 32768), minute, dow, acc, P);
        if (performance.now() - sliceStart > 3) { await nextTask(); if (this._mainStats !== token) return; sliceStart = performance.now(); }
      }
      n += c.count;
    }
    if (this._mainStats === token) this._stats = Object.assign(statsFrom(acc, n), { t });
    if (this._statsDirty) this._requestStats();
  }

  // ------------------------------------------------ picking and lookup

  /**
   * The nearest drawn agent within radiusUnits of (x, y) now, or null.
   * @returns {{id:string, zip:string, zi:number, h:number, m:number, mode:string|null, travel:string|null, state:string, kind:string, x:number, y:number, dist:number}|null}
   */
  pick(x, y, radiusUnits) {
    if (!this.count) return null;
    const hit = pickNearest(this.chunks, this.net, x, y, radiusUnits, this.minute, this.dow, { mask: this.mask, keep: this.keep });
    return hit ? this._describe(hit.chunk, hit.i, hit) : null;
  }

  _describe(c, i, p) {
    const d = decodeId(c, i, this.world), code = c.mode[i] & 15;
    const travel = p.state === S_OUT || p.state === S_BACK ? MODES[code] : p.state === S_EOUT || p.state === S_EBACK ? (((c.errand[i] >>> 25) & 1) ? 'drive' : 'walk') : null;
    return {
      id: d.id, zip: this.world.zips[d.zi], zi: d.zi, h: d.h, m: d.m,
      mode: travel || MODES[code], travel, commuteMode: MODES[code], state: STATES[p.state], school: (c.mode[i] & STUDENT_BIT) !== 0,
      kind: p.kind >= 0 ? KINDS[p.kind] : null, x: p.x, y: p.y, dist: p.dist == null ? 0 : p.dist, index: c.start + i,
    };
  }

  /** {chunk, i} of an NPC (by ZIP index, household, member), or null when it is not in the crowd. */
  findAgent(zi, h, m) {
    const packed = h < 65536 && m < 16 ? ((zi << 20) | (h << 4) | m) >>> 0 : null;
    for (const c of this.chunks) {
      if (!c.count || !c.zis.includes(zi)) continue;
      if (c.overflow.length) {
        // a household of more than 16 people mixes overflow tags into the ids: look up directly
        for (let k = 0; k < c.overflow.length; k += 3) {
          if (c.overflow[k] !== zi || c.overflow[k + 1] !== h || c.overflow[k + 2] !== m) continue;
          const tag = (0x80000000 | (k / 3)) >>> 0;
          for (let i = 0; i < c.count; i++) if (c.ids[i] === tag) return { chunk: c, i };
        }
        if (packed != null) for (let i = 0; i < c.count; i++) if (c.ids[i] === packed) return { chunk: c, i };
        continue;
      }
      if (packed == null) continue;
      // otherwise ids ascend within a chunk (ZIPs in index order, then households, then members)
      let lo = 0, hi = c.count - 1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1, v = c.ids[mid];
        if (v === packed) return { chunk: c, i: mid };
        if (v < packed) lo = mid + 1; else hi = mid - 1;
      }
    }
    return null;
  }

  /** Where NPC id ('ZIP-h-m') is now: {x, y, state, kind, travel} (null when not in the crowd). */
  positionOf(id) {
    const mt = /^(\d{5})-(\d+)-(\d+)$/.exec(String(id || '').trim());
    if (!mt) return null;
    const zi = this.world.indexOf(mt[1]);
    if (zi < 0) return null;
    const a = this.findAgent(zi, +mt[2], +mt[3]);
    if (!a) return null;
    const p = agentPosition(a.chunk, a.i, this.minute, this.dow, this.net);
    return this._describe(a.chunk, a.i, p);
  }

  // ------------------------------------------------ rendering

  _initGL(gl) {
    this._gl = gl;
    this._prog = createProgram(gl, vertexShader(this.net, false), FS);
    const tex = (data, w, h) => {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, data);
      gl.bindTexture(gl.TEXTURE_2D, null);
      return t;
    };
    this._texV = tex(this.net.verts, this.net.texV.width, this.net.texV.height);
    this._texL = tex(this.net.lines, this.net.texL.width, this.net.texL.height);
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || '');
    this.renderer = renderer;
    this.software = /swiftshader|llvmpipe|software|basic render/i.test(renderer);
    for (const c of this.chunks) c.gpu = null;
  }

  _upload(gl, c) {
    const vao = gl.createVertexArray(), bufs = [];
    gl.bindVertexArray(vao);
    const attr = (loc, data, size, type, integer, normalized = false) => {
      const b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(loc);
      if (integer) gl.vertexAttribIPointer(loc, size, type, 0, 0); else gl.vertexAttribPointer(loc, size, type, normalized, 0, 0);
      bufs.push(b);
    };
    attr(0, c.home, 2, gl.UNSIGNED_SHORT, false, true);
    attr(1, c.dest, 2, gl.UNSIGNED_SHORT, false, true);
    attr(2, c.timing, 3, gl.UNSIGNED_SHORT, true);
    attr(3, c.days, 1, gl.UNSIGNED_BYTE, true);
    attr(4, c.mode, 1, gl.UNSIGNED_BYTE, true);
    attr(5, c.route, 3, gl.UNSIGNED_SHORT, true);
    attr(6, c.errand, 1, gl.UNSIGNED_INT, true);
    attr(7, c.eoff, 2, gl.BYTE, false, false);
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    c.gpu = { vao, bufs };
  }

  _bindCommon(gl, P) {
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this._texV);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this._texL);
    gl.uniform1i(P.u.u_roadV, 0); gl.uniform1i(P.u.u_roadL, 1);
    gl.uniform2f(P.u.u_ext, this.world.proj.W, this.world.proj.H);
    gl.uniform1f(P.u.u_minute, this.minute);
    gl.uniform1i(P.u.u_dow, this.dow);
  }

  /** MapView layer hook. */
  draw(frame) {
    if (!this.count) return;
    if (!frame.gl) { this._draw2D(frame); return; }
    const gl = frame.gl;
    if (this._gl !== gl) this._initGL(gl);
    if (this.autoQuality) this._adapt(frame.time);
    const P = this._prog;
    gl.useProgram(P.program);
    this._bindCommon(gl, P);
    gl.uniform4fv(P.u.u_view, frame.view);
    const sizeCss = Math.min(7, Math.max(1.25, 1.25 + 0.95 * Math.log2(1 + frame.zoom * 3)));
    const size = sizeCss * frame.dpr;
    gl.uniform1f(P.u.u_size, size);
    gl.uniform1f(P.u.u_keep, this.keep);
    gl.uniform1i(P.u.u_mask, this.mask);
    gl.uniform4fv(P.u.u_color, this._colors);
    gl.uniform1f(P.u.u_homeAlpha, 0.26 + 0.12 * this.night);
    const glow = this.night * (frame.dark === false ? 0.45 : 0.9);
    gl.uniform1f(P.u.u_glow, glow);
    gl.uniform1f(P.u.u_soft, size >= 3 ? 1 : 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    for (const c of this.chunks) {
      if (!c.count) continue;
      if (!c.gpu) this._upload(gl, c);
      gl.bindVertexArray(c.gpu.vao);
      gl.uniform1ui(P.u.u_base, c.start);
      // software WebGL runs the vertex shader on the CPU for every vertex drawn: draw only the agents the level of
      // detail keeps (lodValue, the hash the shader tests), as indices, rather than all of them with most skipped
      const kept = this.software && this.keep < 0.999 ? this._keptIndex(gl, c) : null;
      if (kept) { if (kept.n) gl.drawElements(gl.POINTS, kept.n, gl.UNSIGNED_INT, 0); }
      else gl.drawArrays(gl.POINTS, 0, c.count);
    }
    gl.bindVertexArray(null);
  }

  /**
   * The indices of a chunk's agents the current keep fraction draws, in an element buffer of the chunk's vertex
   * array (bound by the caller), made again when keep changes: {n}. Null when it cannot be made.
   */
  _keptIndex(gl, c) {
    const g = c.gpu;
    if (g.keptFor === this.keep && g.kept) return g.kept;
    try {
      const idx = new Uint32Array(c.count);
      let n = 0;
      for (let i = 0; i < c.count; i++) if (lodValue(c.start + i) < this.keep) idx[n++] = i;
      if (!g.kbuf) { g.kbuf = gl.createBuffer(); g.bufs.push(g.kbuf); }
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, g.kbuf);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx.subarray(0, Math.max(1, n)), gl.DYNAMIC_DRAW);
      g.kept = { n };
      g.keptFor = this.keep;
      return g.kept;
    } catch { return null; }
  }

  /** Lower the drawn share when frames run long while the clock is animating; raise it back when there is headroom. */
  _adapt(now) {
    const dt = now - this._frameT;
    this._frameT = now;
    // a software rasterizer draws at most a budget; beyond that, frames that keep coming slowly (an animation, a
    // drag) lower the share and frames with headroom raise it again
    if (this.software && this.count) this.keep = Math.min(this.keep, Math.max(0.05, 300000 / this.count));
    if (!(dt > 0) || dt > 400) { this._slow = 0; this._fast = 0; return; }
    if (dt > 26) { this._slow++; this._fast = 0; } else if (dt < 17.5) { this._fast++; this._slow = 0; } else { this._slow = 0; this._fast = 0; }
    if (this._slow > 40) { this.keep = Math.max(0.05, this.keep * 0.8); this._slow = 0; }
    if (this._fast > 150 && this.keep < 1) { this.keep = Math.min(1, this.keep * 1.15); this._fast = 0; }
  }

  /** Canvas 2D fallback (no WebGL2): a sample of the moving agents, positioned by the JS twin. */
  _draw2D(frame) {
    const g = frame.ctx;
    if (!g) return;
    const budget = 40000, stride = Math.max(1, Math.ceil(this.count / budget)), o = { state: 0, kind: 0, x: 0, y: 0 }, P = newPhase();
    const c0 = frame.camera, k = c0.zoom * frame.dpr, ox = frame.width / 2 - c0.x * k, oy = frame.height / 2 - c0.y * k;
    const size = Math.max(1, Math.round(1.5 * frame.dpr));
    const css = i => `rgb(${Math.round(this._colors[4 * i] * 255)},${Math.round(this._colors[4 * i + 1] * 255)},${Math.round(this._colors[4 * i + 2] * 255)})`;
    const fills = CLASS_NAMES.map((_, i) => css(i));
    g.save();
    g.globalCompositeOperation = this.night > 0.5 && frame.dark !== false ? 'lighter' : 'source-over';
    for (const c of this.chunks) for (let i = 0; i < c.count; i += stride) {
      const s = agentPhase(c, i, this.minute, this.dow, P), cls = colorClass(s, agentKind(c, i, s));
      if (cls < 0 || !(this.mask & CLASS_BIT[cls])) continue;
      agentPosition(c, i, this.minute, this.dow, this.net, o, P);
      const px = o.x * k + ox, py = o.y * k + oy;
      if (px < 0 || py < 0 || px > frame.width || py > frame.height) continue;
      g.globalAlpha = cls === 6 ? 0.3 : 0.9;
      g.fillStyle = fills[cls];
      g.fillRect(px - size / 2, py - size / 2, size, size);
    }
    g.restore();
  }

  /** MapView hook after a WebGL context loss: GPU resources are rebuilt on the next draw. */
  contextRestored() { this._gl = null; for (const c of this.chunks) c.gpu = null; this.map.requestRender(); }

  /**
   * Run the vertex shader on agents [first, first + count) of chunk `chunkIndex` with transform feedback and read back
   * [x, y, state, kind] per agent: the GPU's answer, to compare with agentPosition (the JS twin).
   * @returns {Float32Array}
   */
  gpuEval(chunkIndex, minute = this.minute, dow = this.dow, first = 0, count) {
    const gl = this.map.getGL(), c = this.chunks[chunkIndex];
    if (!gl || !c) return null;
    if (this._gl !== gl) this._initGL(gl);
    if (!c.gpu) this._upload(gl, c);
    count = Math.min(c.count - first, count == null ? c.count - first : count);
    if (!(count > 0)) return new Float32Array(0);
    if (!this._tfProg) this._tfProg = createProgram(gl, vertexShader(this.net, true), FS, { varyings: ['v_tf'] });
    const P = this._tfProg;
    gl.useProgram(P.program);
    this._bindCommon(gl, P);
    gl.uniform1f(P.u.u_minute, minute);
    gl.uniform1i(P.u.u_dow, dow);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, buf);
    gl.bufferData(gl.TRANSFORM_FEEDBACK_BUFFER, count * 16, gl.STREAM_READ);
    gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, null);
    const tf = gl.createTransformFeedback();
    gl.bindVertexArray(c.gpu.vao);
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, tf);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, buf);
    gl.enable(gl.RASTERIZER_DISCARD);
    gl.beginTransformFeedback(gl.POINTS);
    gl.drawArrays(gl.POINTS, first, count);
    gl.endTransformFeedback();
    gl.disable(gl.RASTERIZER_DISCARD);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
    gl.bindVertexArray(null);
    const out = new Float32Array(count * 4);
    gl.bindBuffer(gl.COPY_READ_BUFFER, buf);
    gl.getBufferSubData(gl.COPY_READ_BUFFER, 0, out);
    gl.bindBuffer(gl.COPY_READ_BUFFER, null);
    gl.deleteBuffer(buf);
    gl.deleteTransformFeedback(tf);
    return out;
  }

  /** Remove the layer, stop the worker, free GPU memory. */
  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    this._buildId++;
    if (this._job) { this._job.cancelled = true; this._job.resolve({ cancelled: true, agents: this.count }); }
    if (this._statsTimer) clearTimeout(this._statsTimer);
    this._mainStats = null;
    this._killWorkers();
    const gl = this._gl;
    if (gl && !gl.isContextLost()) {
      this._clear();
      if (this._prog) gl.deleteProgram(this._prog.program);
      if (this._tfProg) gl.deleteProgram(this._tfProg.program);
      gl.deleteTexture(this._texV); gl.deleteTexture(this._texL);
    }
    this.chunks = []; this.count = 0;
    if (this._offTheme) this._offTheme();
    this.map.removeLayer(this);
    this.map.setShade(0);
  }
}
