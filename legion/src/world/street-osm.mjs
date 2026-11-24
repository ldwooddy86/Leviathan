// Legion · real streets and buildings from OpenStreetMap (opt-in).
//
// Only when the user allows network access: the street view asks the Overpass API for the highway ways and building
// footprints in the view's box (`out geom`, so each way comes with its node ids and coordinates), caches the
// answer per 0.01-degree tile in memory and, when the browser lets it, in localStorage, and builds the street
// graph from the ways. Ways connect only where they share an OSM node, so bridges and tunnels do not create
// intersections that are not there. Any failure (offline, timeout, HTTP error, unexpected data) returns null and
// the view falls back to the procedural streets. Parsing is DOM-free and tested in Node with a fixture.

import { StreetNet, finishNet } from './street-net.mjs';
import { clipToSquare, cumLengths } from './street-geo.mjs';

/** The public Overpass endpoint. */
export const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
/** Cache tile size in degrees. */
export const TILE_DEG = 0.01;
const STORE_PREFIX = 'legion.osm.v1.';
const memory = new Map();

/** The Overpass QL query for highways and buildings in a box (south, west, north, east). */
export function overpassQuery(s, w, n, e, timeout = 25) {
  const b = [s, w, n, e].map(v => v.toFixed(6)).join(',');
  return `[out:json][timeout:${timeout}];(way["highway"](${b});way["building"](${b}););out geom tags;`;
}

/** Lat/lon box of a view: {s, w, n, e}. */
export function viewBox(world, frame, R, pad = 40) {
  const a = frame.toWorld(-R - pad, -R - pad), b = frame.toWorld(R + pad, R + pad);
  const p = world.unproject(a.x, a.y), q = world.unproject(b.x, b.y);
  return { s: Math.min(p.lat, q.lat), n: Math.max(p.lat, q.lat), w: Math.min(p.lon, q.lon), e: Math.max(p.lon, q.lon) };
}

/** Cache tile keys covering a box. */
export function tilesFor(box) {
  const out = [];
  for (let i = Math.floor(box.s / TILE_DEG); i <= Math.floor(box.n / TILE_DEG); i++) for (let j = Math.floor(box.w / TILE_DEG); j <= Math.floor(box.e / TILE_DEG); j++) out.push(i + '_' + j);
  return out;
}

function tileBox(key) { const [i, j] = key.split('_').map(Number); return { s: i * TILE_DEG, w: j * TILE_DEG, n: (i + 1) * TILE_DEG, e: (j + 1) * TILE_DEG }; }

function storage() {
  try { if (typeof localStorage !== 'undefined' && localStorage) return localStorage; } catch { /* storage blocked */ }
  return null;
}

/** Compact a way for the cache: [id, kind ('h'|'b'), tags, lat/lon pairs rounded to 1e-6, node ids]. */
function pack(el) {
  const g = el.geometry || [];
  const coords = [];
  for (const p of g) coords.push(Math.round(p.lat * 1e6), Math.round(p.lon * 1e6));
  const t = {};
  for (const k of ['highway', 'building', 'name', 'ref', 'oneway', 'lanes', 'bridge', 'tunnel', 'layer', 'service', 'building:levels', 'roof:material', 'amenity', 'shop', 'junction']) if (el.tags && el.tags[k] !== undefined) t[k] = el.tags[k];
  return [el.id, el.tags && el.tags.highway ? 'h' : 'b', t, coords, el.tags && el.tags.highway ? (el.nodes || []) : []];
}
function unpack(a) {
  const geometry = [];
  for (let i = 0; i < a[3].length; i += 2) geometry.push({ lat: a[3][i] / 1e6, lon: a[3][i + 1] / 1e6 });
  return { type: 'way', id: a[0], tags: a[2], geometry, nodes: a[4] };
}

/** Read cached tiles (memory first, then localStorage). Returns the elements or null if any tile is missing. */
export function readCache(keys, store = storage()) {
  const els = new Map();
  for (const k of keys) {
    let tile = memory.get(k);
    if (!tile && store) {
      try { const raw = store.getItem(STORE_PREFIX + k); if (raw) { tile = JSON.parse(raw); memory.set(k, tile); } } catch { tile = null; }
    }
    if (!tile) return null;
    for (const a of tile.w) if (!els.has(a[0])) els.set(a[0], unpack(a));
  }
  return [...els.values()];
}

/** Split elements into tiles and cache them (memory always; localStorage guarded, evicting old tiles when full). */
export function writeCache(elements, keys, store = storage()) {
  const tiles = new Map(keys.map(k => [k, []]));
  for (const el of elements) {
    if (el.type !== 'way' || !el.geometry || !el.geometry.length) continue;
    let s = Infinity, w = Infinity, n = -Infinity, e = -Infinity;
    for (const p of el.geometry) { s = Math.min(s, p.lat); n = Math.max(n, p.lat); w = Math.min(w, p.lon); e = Math.max(e, p.lon); }
    const packed = pack(el);
    for (const k of keys) { const b = tileBox(k); if (n >= b.s && s <= b.n && e >= b.w && w <= b.e) tiles.get(k).push(packed); }
  }
  const t = Date.now();
  for (const [k, w] of tiles) {
    const tile = { t, w };
    memory.set(k, tile);
    if (!store) continue;
    const json = JSON.stringify(tile);
    for (let attempt = 0; attempt < 2; attempt++) {
      try { store.setItem(STORE_PREFIX + k, json); break; }
      catch {
        // quota: drop the oldest cached street tiles and try once more
        try {
          const own = [];
          for (let i = 0; i < store.length; i++) { const key = store.key(i); if (key && key.startsWith(STORE_PREFIX)) { let tt = 0; try { tt = JSON.parse(store.getItem(key)).t || 0; } catch { tt = 0; } own.push([tt, key]); } }
          own.sort((a, b) => a[0] - b[0]);
          for (const [, key] of own.slice(0, Math.max(1, Math.ceil(own.length / 2)))) store.removeItem(key);
        } catch { break; }
      }
    }
  }
}

/**
 * Fetch the view's highways and buildings: from the cache when every tile is there, else from Overpass (one POST
 * for the whole box) with a timeout. Resolves to {elements, cached} or null on any failure.
 * @param {{fetchImpl?: Function, timeoutMs?: number, url?: string, store?: object|null}} [opts]
 */
export async function fetchOSM(world, frame, R, { fetchImpl = (typeof fetch === 'function' ? fetch : null), timeoutMs = 12000, url = OVERPASS_URL, store = storage() } = {}) {
  const box = viewBox(world, frame, R);
  const keys = tilesFor(box);
  const cached = readCache(keys, store);
  if (cached && cached.length) return { elements: cached, cached: true };
  if (!fetchImpl) return null;
  // fetch the union of the cache tiles so every tile we store is complete
  const all = keys.map(tileBox);
  const big = { s: Math.min(...all.map(b => b.s)), w: Math.min(...all.map(b => b.w)), n: Math.max(...all.map(b => b.n)), e: Math.max(...all.map(b => b.e)) };
  const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = setTimeout(() => ctrl && ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { method: 'POST', body: 'data=' + encodeURIComponent(overpassQuery(big.s, big.w, big.n, big.e)), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: ctrl ? ctrl.signal : undefined });
    if (!res || !res.ok) return null;
    const json = await res.json();
    if (!json || !Array.isArray(json.elements)) return null;
    const ways = json.elements.filter(e => e.type === 'way' && e.geometry && e.geometry.length >= 2);
    if (!ways.length) return null;
    writeCache(ways, keys, store);
    return { elements: ways, cached: false };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------- parsing

const HW = {
  motorway: 'freeway', trunk: 'arterial', primary: 'arterial', secondary: 'arterial', tertiary: 'collector',
  motorway_link: 'ramp', trunk_link: 'ramp', primary_link: 'collector', secondary_link: 'collector', tertiary_link: 'collector',
  unclassified: 'local', residential: 'local', living_street: 'local', road: 'local', service: 'service', track: 'lane',
  pedestrian: 'path', footway: 'path', path: 'path', cycleway: 'path',
};

/** Stroke attributes of an OSM highway way (class, lanes, one-way, name) or null to skip it. */
export function wayClass(tags) {
  const hw = tags.highway;
  let cls = HW[hw];
  if (!cls) return null;
  if (cls === 'service') {
    if (tags.service === 'alley') cls = 'alley';
    else if (tags.service === 'driveway' || tags.service === 'parking_aisle' || tags.service === 'drive-through' || tags.service === 'emergency_access') return null;
  }
  const oneway = tags.oneway === 'yes' || tags.oneway === '1' || tags.oneway === 'true' || tags.oneway === '-1' || tags.junction === 'roundabout' || hw === 'motorway' || cls === 'ramp';
  const total = parseInt(tags.lanes, 10);
  let lanes = Number.isFinite(total) && total > 0 ? (oneway ? total : Math.max(1, Math.ceil(total / 2))) : cls === 'freeway' ? 3 : cls === 'arterial' ? 2 : 1;
  lanes = Math.min(lanes, 6);
  const name = tags.name || (tags.ref ? tags.ref.split(';')[0] : '');
  return { cls, lanes, oneway, reverse: tags.oneway === '-1', name, bridge: tags.bridge && tags.bridge !== 'no', tunnel: tags.tunnel && tags.tunnel !== 'no', foot: cls === 'path' ? true : undefined, bike: hw === 'cycleway' || cls !== 'path' ? undefined : false, car: cls === 'path' ? false : undefined };
}

/**
 * Turn Overpass way elements into a street graph (connected at shared nodes, clipped to the view square) and
 * building footprints in local meters.
 * @returns {{net: StreetNet|null, buildings: {ring: Float64Array, tags: object, id: number}[]}}
 */
export function parseOSM(elements, world, frame, R) {
  const toLocal = (lat, lon) => { const p = world.project(lat, lon); return frame.toLocal(p.x, p.y); };
  const ways = [], buildings = [];
  for (const el of elements) {
    if (el.type !== 'way' || !el.geometry || el.geometry.length < 2 || !el.tags) continue;
    if (el.tags.highway) {
      const a = wayClass(el.tags);
      if (!a) continue;
      let geom = el.geometry, nodes = el.nodes && el.nodes.length === geom.length ? el.nodes : geom.map((_, i) => -(el.id * 1000 + i));
      if (a.reverse) { geom = geom.slice().reverse(); nodes = nodes.slice().reverse(); }
      const pts = [];
      for (const p of geom) { const q = toLocal(p.lat, p.lon); pts.push(q.x, q.y); }
      ways.push({ id: el.id, attrs: a, pts, nodes });
    } else if (el.tags.building) {
      if (el.geometry.length < 4) continue;
      const ring = [];
      for (const p of el.geometry) { const q = toLocal(p.lat, p.lon); ring.push(q.x, q.y); }
      if (ring.length >= 4 && ring[0] === ring[ring.length - 2] && ring[1] === ring[ring.length - 1]) ring.length -= 2;
      buildings.push({ id: el.id, ring: Float64Array.from(ring), tags: el.tags });
    }
  }
  return { net: ways.length ? netFromWays(ways, R) : null, buildings };
}

/** Graph from ways: graph nodes where ways share OSM nodes or end; edges between them; clipped to the square. */
function netFromWays(ways, R) {
  const uses = new Map();
  for (const w of ways) w.nodes.forEach((n, i) => uses.set(n, (uses.get(n) || 0) + (i === 0 || i === w.nodes.length - 1 ? 2 : 1)));
  const net = new StreetNet(R);
  net.source = 'osm';
  const nodeIds = new Map();
  const nodeAt = (osmId, x, y) => { let id = nodeIds.get(osmId); if (id === undefined) { id = net.addNode(x, y); net.nodes[id].osm = osmId; nodeIds.set(osmId, id); } return id; };
  const pieces = [];
  for (const w of ways) {
    // split at shared nodes
    let start = 0;
    for (let i = 1; i < w.nodes.length; i++) {
      if (i === w.nodes.length - 1 || (uses.get(w.nodes[i]) || 0) >= 2) {
        pieces.push({ w, i0: start, i1: i });
        start = i;
      }
    }
  }
  let cutSeq = 0;
  for (const pc of pieces) {
    const pts = w2pts(pc.w.pts, pc.i0, pc.i1);
    const n = pts.length / 2;
    if (pts.every(v => Math.abs(v) <= R)) {
      const a = nodeAt(pc.w.nodes[pc.i0], pts[0], pts[1]), b = nodeAt(pc.w.nodes[pc.i1], pts[2 * n - 2], pts[2 * n - 1]);
      if (a !== b && cumLen(pts) > 0.5) addOsmEdge(net, a, b, pts, pc.w);
      continue;
    }
    // crosses the view's edge: keep the inside parts, cut ends become their own nodes (exits)
    for (const part of clipToSquare(Float64Array.from(pts), R)) {
      const m = part.pts.length / 2;
      const sx = part.pts[0], sy = part.pts[1], ex = part.pts[2 * m - 2], ey = part.pts[2 * m - 1];
      const a = part.startCut ? nodeAt('cut' + (cutSeq++), sx, sy) : nodeAt(pc.w.nodes[pc.i0], sx, sy);
      const b = part.endCut ? nodeAt('cut' + (cutSeq++), ex, ey) : nodeAt(pc.w.nodes[pc.i1], ex, ey);
      if (a !== b && cumLen(part.pts) > 0.5) addOsmEdge(net, a, b, part.pts, pc.w);
    }
  }
  return finishNet(net, { minStub: 4 });
}

function addOsmEdge(net, a, b, pts, w) {
  const e = net.addEdge(a, b, pts, Object.assign({ cls: w.attrs.cls }, w.attrs, { sidewalk: w.attrs.cls === 'local' || w.attrs.cls === 'collector' || w.attrs.cls === 'arterial' ? undefined : 0, kind: null }));
  e.osmId = w.id;
  return e;
}

function w2pts(pts, i0, i1) { return pts.slice(2 * i0, 2 * i1 + 2); }
function cumLen(pts) { const c = cumLengths(pts); return c[c.length - 1]; }

/** Clear the in-memory cache (tests). */
export function clearMemoryCache() { memory.clear(); }
