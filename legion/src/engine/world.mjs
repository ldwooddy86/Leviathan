// Legion · the world: the compiled pack (legion/data/world.json.gz) behind one object.
//
// Everything here is read-only and deterministic. Modules ask the world for a ZIP's columns, its Census
// tables, its outline, where a point falls, what the weather is, which highways, peaks and fires are near.
//
// Coordinates. The pack keeps the atlas's own projection, an equirectangular grid scaled by the cosine of
// 37.24 degrees: x = (lon - minx) * kx * sx, y = (maxy - lat) * sx, in "units" of 1/sx degree of latitude
// (about 0.1975 km). Every x, y in Legion is in these units; world.unitKm converts.

import { Rng, hash2, hash3, u01, clamp, smoothstep } from './rng.mjs';
import { pacific } from './clock.mjs';

const KM_PER_DEG = 111.32;

// Weather. The snapshot has eleven NWS forecast points for the whole state. A ZIP uses its point's forecast as its
// own within HERE_KM and HERE_DZ of it; up to BORROW_KM away, within the ZIP's own forecast office (the offices
// split along the Sierra crest), it borrows it, carried to the ZIP's height at LAPSE_F_PER_M (about 3.5 F per
// 1,000 ft); beyond that the ZIP has no forecast and reads its climate estimate. The observing station nearest the
// ZIP (within OBS_KM) anchors the temperature to what was measured at the snapshot, an offset that fades with time
// from it (OBS_FADE_MS).
const LAPSE_F_PER_M = 3.5 / 304.8;
const HERE_KM = 15, HERE_DZ = 150, BORROW_KM = 80, OBS_KM = 40, OBS_FADE_MS = 3 * 3600000, WINDOW_SLACK_MS = 90 * 60000;
// a wind event of a kind that follows terrain (sundowner, mono, other) reaches a ZIP in the zones it was reported in,
// or within this distance of its strongest gust when it names no zone
const WIND_NEAR_KM = 30;

/** Kilometers between two lat/lon points (equirectangular; fine at these distances). */
function kmBetween(lat0, lon0, lat1, lon1) {
  const dx = (lon1 - lon0) * Math.cos((lat0 + lat1) / 2 * Math.PI / 180), dy = lat1 - lat0;
  return Math.sqrt(dx * dx + dy * dy) * KM_PER_DEG;
}

/**
 * How much a wildfire matters to a ZIP: the buildings it destroyed or damaged there, then its size as seen from
 * the ZIP (falling off past a km away), the share of the ZIP it burned and how recent it was. firesOf ranks by it;
 * tools/build_pack.py keeps each ZIP's most salient fires by the same formula.
 */
export function fireSalience(f) {
  const km = f.km || 0, near = km <= 1 ? 1 : Math.exp(-(km - 1) / 12);
  const recent = clamp(((f.year || 1995) - 1995) / 30, 0, 1);
  return 2 * Math.log10(1 + (f.destInZip || 0) + 0.25 * (f.dmgInZip || 0)) + Math.log10(1 + (f.acres || 0)) * near
    + 0.03 * Math.min(f.pct || 0, 60) + 0.25 * recent;
}

/** "the Mission" → "mission": a name as search compares it. */
const searchKey = s => String(s || '').toLowerCase().replace(/^the\s+/, '').trim();

// ---------------------------------------------------------------- loading

/** Gunzip bytes in the browser (DecompressionStream) or in Node (zlib). */
export async function gunzip(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (typeof DecompressionStream === 'function' && typeof Response === 'function') {
    const stream = new Blob([u8]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  const zlib = await import('node:zlib');
  return new Uint8Array(zlib.gunzipSync(u8));
}

/** Decode base64 to bytes in either environment. */
export function fromBase64(b64) {
  if (typeof atob === 'function') {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

/**
 * Load the pack from: a parsed object, a JSON string, gzip or JSON bytes, a base64 string of gzip
 * ("H4sI..."), or a URL / file path (Node) to world.json.gz.
 */
export async function loadPack(src) {
  if (src && typeof src === 'object' && !(src instanceof Uint8Array) && !(src instanceof ArrayBuffer)) return src;
  let bytes = null;
  if (typeof src === 'string') {
    if (src.startsWith('{')) return JSON.parse(src);
    if (src.startsWith('H4sI')) bytes = fromBase64(src);
    else if (/^https?:|^\.|^\/|^[A-Za-z]:\\/.test(src) || src.endsWith('.gz') || src.endsWith('.json')) {
      if (typeof process !== 'undefined' && process.versions && process.versions.node && !/^https?:/.test(src)) {
        const fs = await import('node:fs');
        bytes = new Uint8Array(fs.readFileSync(src));
      } else {
        bytes = new Uint8Array(await (await fetch(src)).arrayBuffer());
      }
    } else bytes = fromBase64(src);
  } else bytes = src instanceof Uint8Array ? src : new Uint8Array(src);
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) bytes = await gunzip(bytes);
  return JSON.parse(new TextDecoder().decode(bytes));
}

/** Node convenience: the pack at legion/data/world.json.gz. */
export async function loadDefaultWorld() {
  const url = new URL('../../data/world.json.gz', import.meta.url);
  const { fileURLToPath } = await import('node:url');
  return createWorld(await loadPack(fileURLToPath(url)));
}

export function createWorld(pack) { return new World(pack); }

// ---------------------------------------------------------------- small geometry helpers

/** Decode the atlas's path strings ("M x y l dx dy ... z M ...") into rings of absolute coordinates. */
export function decodePath(d) {
  const rings = [];
  if (!d) return rings;
  let ring = null, x = 0, y = 0;
  const re = /([MlLz])\s*(-?\d+(?:\.\d+)?)?\s*(-?\d+(?:\.\d+)?)?/g;
  let m;
  while ((m = re.exec(d))) {
    const c = m[1];
    if (c === 'M') { if (ring && ring.length >= 6) rings.push(ring); x = +m[2]; y = +m[3]; ring = [x, y]; }
    else if (c === 'l') { x += +m[2]; y += +m[3]; ring.push(x, y); }
    else if (c === 'L') { x = +m[2]; y = +m[3]; ring.push(x, y); }
    else if (c === 'z') { if (ring && ring.length >= 6) rings.push(ring); ring = null; }
  }
  if (ring && ring.length >= 6) rings.push(ring);
  return rings.map(r => Float64Array.from(r));
}

/** Even-odd point in polygon over all rings. */
export function pointInRings(x, y, rings) {
  let inside = false;
  for (const r of rings) {
    const n = r.length / 2;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = r[2 * i], yi = r[2 * i + 1], xj = r[2 * j], yj = r[2 * j + 1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-12) + xi) inside = !inside;
    }
  }
  return inside;
}

function ringsBBox(rings) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const r of rings) for (let i = 0; i < r.length; i += 2) {
    if (r[i] < x0) x0 = r[i]; if (r[i] > x1) x1 = r[i];
    if (r[i + 1] < y0) y0 = r[i + 1]; if (r[i + 1] > y1) y1 = r[i + 1];
  }
  return [x0, y0, x1, y1];
}

/** Uniform grid over points for radius queries. */
class PointIndex {
  constructor(items, cell = 50) {
    this.cell = cell;
    this.map = new Map();
    for (const it of items) {
      const k = this.key(Math.floor(it.x / cell), Math.floor(it.y / cell));
      let b = this.map.get(k); if (!b) this.map.set(k, b = []); b.push(it);
    }
  }
  key(cx, cy) { return cx * 100003 + cy; }
  near(x, y, r) {
    const c = this.cell, out = [];
    const cx0 = Math.floor((x - r) / c), cx1 = Math.floor((x + r) / c), cy0 = Math.floor((y - r) / c), cy1 = Math.floor((y + r) / c);
    const r2 = r * r;
    for (let cx = cx0; cx <= cx1; cx++) for (let cy = cy0; cy <= cy1; cy++) {
      const b = this.map.get(this.key(cx, cy)); if (!b) continue;
      for (const it of b) { const dx = it.x - x, dy = it.y - y, d2 = dx * dx + dy * dy; if (d2 <= r2) out.push([it, Math.sqrt(d2)]); }
    }
    out.sort((a, b) => a[1] - b[1]);
    return out;
  }
}


// ---------------------------------------------------------------- the world

export class World {
  constructor(pack) {
    if (!pack || !pack.z || !pack.acs) throw new Error('not a Legion world pack');
    this.pack = pack;
    this.version = pack.v;
    const z = pack.z;
    this.z = z;
    this.N = z.zip.length;
    this.zips = z.zip;
    this.zipIndex = new Map(z.zip.map((v, i) => [v, i]));
    this.proj = pack.proj;
    this.unitKm = KM_PER_DEG / pack.proj.sx;
    this.kmUnit = 1 / this.unitKm;
    this.counties = pack.counties.map((c, i) => Object.assign({ index: i }, c));
    this.countyByFips = new Map(this.counties.map(c => [c.fips, c]));
    this.regions = pack.regions;
    this.regionByKey = Object.fromEntries(pack.regions.map(r => [r.key, r]));
    this.acsLayout = pack.acs.layout;
    this.acsRows = pack.acs.rows;
    this.acsLabelSets = pack.acs.labels;
    this.provinces = pack.provinces;
    this.zones = pack.zones;
    this.state = pack.state;
    this.totalPop = z.pop.reduce((a, b) => a + (b || 0), 0);
    this.totalHH = z.hh.reduce((a, b) => a + (b || 0), 0);
    this.places = pack.places.map(p => ({ name: p[0], lat: p[1], lon: p[2], pop: p[3] || 0, cdp: !!p[4], seat: !!p[5], county: p[6], x: p[7], y: p[8] }));
    this.gazKinds = pack.gazKinds;
    this.gaz = pack.gaz.map(g => ({ name: g[0], kind: pack.gazKinds[g[1]], rank: g[2], lat: g[3], lon: g[4], elev: g[5], x: g[6], y: g[7] }));
    this.roads = pack.roads;
    this.fires = pack.fires.map(f => ({ name: f[0], year: f[1], acres: f[2], dest: f[3], dmg: f[4], lat: f[5], lon: f[6], cause: f[7], start: f[8] }));
    this.ars = pack.ars.map(a => ({ start: a[0], rank: a[1], peakAt: a[2], stretch: a[3], lat0: a[4], lat1: a[5], dmg: a[6], deaths: a[7], hours: a[8], gustAt: a[9], pr: a[10] || null }));
    this.arPts = (pack.arPts || []).map(p => ({ name: p[0], lat: p[1], lon: p[2], max: p[3], maxDate: p[4] }));
    this.winds = pack.winds.map(w => ({ kind: w[0], start: w[1], gust: w[2], where: w[3], fips: w[4] || [], dmg: w[5], deaths: w[6], lat: w[7] != null ? w[7] : null, lon: w[8] != null ? w[8] : null, zips: w[9] || [] }));
    this.weather = pack.weather;
    this.offices = pack.weather.offices || {};
    this.snapshotTime = Date.parse(pack.weather.fetched);
    this._rows = new Array(this.N);
    this._rings = new Array(this.N);
    this._raster = null;
    this._gazIndex = null; this._placeIndex = null; this._roadIndex = null; this._zipPointIndex = null;
    this._picks = new Array(this.N); this._hoods = null; this._window = null;
  }

  // ------------------------------------------------ ZIP access

  /** Index of a ZIP code string, or -1. */
  indexOf(zip) { const i = this.zipIndex.get(String(zip)); return i === undefined ? -1 : i; }

  /** Column array by pack name (see pack.zcols). */
  col(name) { return this.z[name]; }

  get(i, name) { const c = this.z[name]; return c ? c[i] : undefined; }

  /**
   * Every column of ZIP i as one object, with names resolved (county, region, province, zone, place). Cached.
   * Besides the columns: neighborhood (inside the eight biggest cities, the name residents use for the part of the
   * city the ZIP covers, 'the Mission', 'Boyle Heights'; else null: name where someone lives with
   * `z.neighborhood || z.placeName || z.city`), neighborhoods (that name and the others in use there, for search),
   * ybBefore1940 (true when yb_med is the Census top code: half the homes were built in 1939 or earlier, so say
   * "before 1940", never a year or "the thirties"), wfo and officeName (the NWS forecast office).
   */
  zip(i) {
    if (typeof i === 'string') i = this.indexOf(i);
    if (i < 0 || i >= this.N) return null;
    let r = this._rows[i];
    if (r) return r;
    r = { index: i };
    for (const k of this.pack.zcols) r[k] = this.z[k][i];
    const c = this.counties[r.county];
    r.countyName = c ? c.name : null;
    r.countyFips = c ? c.fips : null;
    r.regionKey = r.region;
    const reg = this.regionByKey[r.region];
    r.regionName = reg ? reg.name : null;
    r.regionThe = reg ? reg.the : null;
    r.provinceName = this.provinces[r.province] || null;
    r.zoneTitle = r.zoneName >= 0 && this.zones[r.zoneName] ? this.zones[r.zoneName][1] : null;
    r.placeName = r.place || r.city;
    r.neighborhoods = Array.isArray(r.nbhd) ? r.nbhd.slice() : [];
    r.neighborhood = r.neighborhoods[0] || null;
    // the ACS codes "built 1939 or earlier" as its lowest year; the atlas stores it as 1938
    r.ybBefore1940 = r.yb_med != null && r.yb_med <= 1939;
    r.wfo = r.wfo || null;
    r.officeName = r.wfo ? this.offices[r.wfo] || r.wfo : null;
    r.label = `${r.city} ${r.zip}`;
    this._rows[i] = r;
    return r;
  }

  /** Census block for ZIP i as an array of integer counts (see world.acsLabels(block)). */
  acs(i, block) {
    const L = this.acsLayout[block];
    if (!L) throw new Error('unknown ACS block ' + block);
    const row = this.acsRows[i];
    return row.slice(L[0], L[0] + L[1]);
  }

  acsLabels(block) { return this.acsLabelSets[block]; }

  /** Census block as {label: count}. */
  acsNamed(i, block) {
    const v = this.acs(i, block), lab = this.acsLabels(block), out = {};
    if (block === 'lang') { lab.forEach((k, j) => { out[k] = v[j]; }); this.acsLabels('lang_lep').forEach((k, j) => { out[k + '_lep'] = v[lab.length + j]; }); return out; }
    if (block === 'age') { lab.forEach((k, j) => { out['m' + k] = v[j]; out['f' + k] = v[lab.length + j]; }); return out; }
    if (block === 'occ') { lab.forEach((k, j) => { out['m_' + k] = v[j]; out['f_' + k] = v[lab.length + j]; }); return out; }
    if (block === 'mar') { lab.forEach((k, j) => { out['m_' + k] = v[j]; out['f_' + k] = v[lab.length + j]; }); return out; }
    if (block === 'veh') { lab.forEach((k, j) => { out['own' + k] = v[j]; out['rent' + k] = v[lab.length + j]; }); return out; }
    if (block === 'vet') { lab.forEach((k, j) => { out['m_vet' + k] = v[j]; out['m_non' + k] = v[5 + j]; out['f_vet' + k] = v[10 + j]; out['f_non' + k] = v[15 + j]; }); return out; }
    lab.forEach((k, j) => { out[k] = v[j]; });
    return out;
  }

  county(ci) { return this.counties[ci] || null; }
  countyOf(i) { return this.counties[this.z.county[i]] || null; }
  regionOf(i) { return this.regionByKey[this.z.region[i]] || null; }

  /** ZIP indices of a county (by index or FIPS) or region (by key). */
  zipsOfCounty(c) {
    const ci = typeof c === 'string' ? (this.countyByFips.get(c) || {}).index : c;
    const out = []; for (let i = 0; i < this.N; i++) if (this.z.county[i] === ci) out.push(i); return out;
  }
  zipsOfRegion(key) { const out = []; for (let i = 0; i < this.N; i++) if (this.z.region[i] === key) out.push(i); return out; }

  /**
   * The neighborhoods of the big cities (see zip): [{name, key, city, zis, zi, primary}], one entry per name and
   * city (Chinatown in San Francisco and in Los Angeles are two), its ZIPs in ZIP order; zi is the ZIP that stands
   * for it (the most populous of those whose first name it is, else of all of them); key is the name as search
   * compares it (lower case, no leading "the"); primary is true when the name is the first name of at least one of
   * its ZIPs. Built once.
   */
  neighborhoods() {
    if (this._hoods) return this._hoods;
    const byKey = new Map(), col = this.z.nbhd || [], pop = i => this.z.pop[i] || 0;
    for (let i = 0; i < this.N; i++) {
      const names = col[i];
      if (!Array.isArray(names)) continue;
      names.forEach((name, k) => {
        const key = searchKey(name), city = this.z.city[i], id = `${key}|${city}`;
        let e = byKey.get(id);
        if (!e) byKey.set(id, e = { name, key, city, zis: [], zi: i, primary: false });
        e.zis.push(i);
        if (k === 0) {
          if (!e.primary || pop(i) > pop(e.zi)) { e.zi = i; e.name = name; }
          e.primary = true;
        } else if (!e.primary && pop(i) > pop(e.zi)) e.zi = i;
      });
    }
    return (this._hoods = [...byKey.values()]);
  }

  /** Find ZIPs by ZIP code, city, place, neighborhood or county name (case-insensitive prefix; "the" optional). */
  search(q, limit = 12) {
    q = String(q || '').trim().toLowerCase();
    if (!q) return [];
    const out = [];
    if (/^\d{3,5}$/.test(q)) { for (let i = 0; i < this.N && out.length < limit; i++) if (this.zips[i].startsWith(q)) out.push({ kind: 'zip', index: i, label: `${this.zips[i]} · ${this.z.city[i]}` }); return out; }
    const seen = new Set();
    for (let i = 0; i < this.N && out.length < limit; i++) {
      const city = (this.z.city[i] || '').toLowerCase(), place = (this.z.place[i] || '').toLowerCase();
      if ((city.startsWith(q) || place.startsWith(q)) && !seen.has(city + '|' + place)) { seen.add(city + '|' + place); out.push({ kind: 'city', index: i, label: `${this.z.city[i]} · ${this.zips[i]}` }); }
    }
    const hq = searchKey(q);
    if (hq.length >= 2) {
      const pop = h => this.z.pop[h.zi] || 0;
      const hits = this.neighborhoods().filter(h => h.key.startsWith(hq))
        .sort((a, b) => (b.key === hq) - (a.key === hq) || b.primary - a.primary || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0) || pop(b) - pop(a));
      for (const h of hits) if (out.length < limit) out.push({ kind: 'neighborhood', index: h.zi, zis: h.zis.slice(), name: h.name, label: `${h.name.replace(/^the /, 'The ')} · ${h.city} ${this.zips[h.zi]}` });
    }
    for (const c of this.counties) if (c.name.toLowerCase().startsWith(q) && out.length < limit) out.push({ kind: 'county', county: c.index, label: `${c.name} County` });
    return out;
  }

  // ------------------------------------------------ projection

  project(lat, lon) { const p = this.proj; return { x: (lon - p.minx) * p.kx * p.sx, y: (p.maxy - lat) * p.sx }; }
  unproject(x, y) { const p = this.proj; return { lat: p.maxy - y / p.sx, lon: p.minx + x / (p.kx * p.sx) }; }
  /** Distance in km between two points in units (equirectangular, good to a fraction of a percent here). */
  distKm(x0, y0, x1, y1) {
    const ly = (y0 + y1) / 2, lat = this.proj.maxy - ly / this.proj.sx;
    const fx = Math.cos(lat * Math.PI / 180) / this.proj.kx;
    const dx = (x1 - x0) * fx, dy = y1 - y0;
    return Math.sqrt(dx * dx + dy * dy) * this.unitKm;
  }

  // ------------------------------------------------ shapes

  /** Rings of ZIP i in units (array of Float64Array [x0,y0,x1,y1,...]). Cached. */
  zipRings(i) {
    let r = this._rings[i];
    if (!r) { r = decodePath(this.pack.shapes.zip[i]); this._rings[i] = r; r.bbox = ringsBBox(r); }
    return r;
  }
  zipBBox(i) { return this.zipRings(i).bbox; }
  countyRings(ci) { return decodePath(this.pack.shapes.county[ci]); }
  outlineRings() { return decodePath(this.pack.shapes.outline); }
  waterRings() { return this.pack.shapes.water.map(decodePath); }
  neighborRings() { return Object.fromEntries(Object.entries(this.pack.shapes.neighbors).map(([k, v]) => [k, decodePath(v)])); }

  /**
   * The ZIP raster: every cell (cell x cell units, default 2 = about 395 m) holds 1 + the index of the ZIP
   * whose outline covers its center, or 0. Built once, on first use, by scanline fill (even-odd per ZIP).
   */
  raster(cell = 2) {
    if (this._raster && this._raster.cell === cell) return this._raster;
    const W = Math.ceil(this.proj.W / cell) + 1, H = Math.ceil(this.proj.H / cell) + 1;
    const grid = new Uint16Array(W * H);
    const xs = [];
    for (let i = 0; i < this.N; i++) {
      const rings = this.zipRings(i), bb = rings.bbox;
      if (!rings.length) continue;
      const r0 = Math.max(0, Math.floor(bb[1] / cell)), r1 = Math.min(H - 1, Math.ceil(bb[3] / cell));
      for (let row = r0; row <= r1; row++) {
        const yc = (row + 0.5) * cell;
        xs.length = 0;
        for (const r of rings) {
          const n = r.length / 2;
          for (let a = 0, b = n - 1; a < n; b = a++) {
            const ya = r[2 * a + 1], yb = r[2 * b + 1];
            if ((ya > yc) !== (yb > yc)) { const xa = r[2 * a], xb = r[2 * b]; xs.push(xa + (yc - ya) * (xb - xa) / (yb - ya)); }
          }
        }
        if (xs.length < 2) continue;
        xs.sort((p, q) => p - q);
        for (let k = 0; k + 1 < xs.length; k += 2) {
          const c0 = Math.max(0, Math.ceil(xs[k] / cell - 0.5)), c1 = Math.min(W - 1, Math.floor(xs[k + 1] / cell - 0.5));
          for (let c = c0; c <= c1; c++) grid[row * W + c] = i + 1;
        }
      }
    }
    // cell lists per ZIP
    const counts = new Uint32Array(this.N + 1);
    for (let k = 0; k < grid.length; k++) if (grid[k]) counts[grid[k] - 1]++;
    const offsets = new Uint32Array(this.N + 1);
    for (let i = 0; i < this.N; i++) offsets[i + 1] = offsets[i] + counts[i];
    const cells = new Uint32Array(offsets[this.N]);
    const fill = offsets.slice(0, this.N);
    for (let k = 0; k < grid.length; k++) { const g = grid[k]; if (g) cells[fill[g - 1]++] = k; }
    // ZIPs too small to own a raster cell (a handful of tiny ZCTAs such as Verdugo City 91046) are tested by
    // their outlines before the raster, so a point inside one never reports the neighbour that owns the cell
    const tiny = [];
    for (let i = 0; i < this.N; i++) if (counts[i] === 0 && this.zipRings(i).length) tiny.push(i);
    this._raster = { cell, W, H, grid, offsets, cells, tiny };
    return this._raster;
  }

  /** Index of the ZIP at a point (units), or -1. */
  zipAt(x, y) {
    const R = this.raster();
    const c = Math.floor(x / R.cell), r = Math.floor(y / R.cell);
    if (c < 0 || r < 0 || c >= R.W || r >= R.H) return -1;
    for (const i of R.tiny) {
      const bb = this.zipBBox(i);
      if (x >= bb[0] && x <= bb[2] && y >= bb[1] && y <= bb[3] && pointInRings(x, y, this.zipRings(i))) return i;
    }
    const g = R.grid[r * R.W + c];
    if (g) return g - 1;
    // a ZIP too small for its own cell: check the outlines of the ZIPs whose box holds the point
    for (let i = 0; i < this.N; i++) {
      const bb = this.zipBBox(i);
      if (x >= bb[0] && x <= bb[2] && y >= bb[1] && y <= bb[3] && pointInRings(x, y, this.zipRings(i))) return i;
    }
    return -1;
  }

  /** Raster cells of ZIP i (Uint32Array of grid indices). */
  zipCells(i) { const R = this.raster(); return R.cells.subarray(R.offsets[i], R.offsets[i + 1]); }

  /** Places (Census places) inside ZIP i, biggest first. */
  placesIn(i) {
    if (!this._placesByZip) {
      this._placesByZip = Array.from({ length: this.N }, () => []);
      for (const p of this.places) { const zi = this.zipAt(p.x, p.y); if (zi >= 0) this._placesByZip[zi].push(p); }
      for (const a of this._placesByZip) a.sort((p, q) => q.pop - p.pop);
    }
    return this._placesByZip[i];
  }

  /**
   * A home location in ZIP i, drawn with rng: uniform over the ZIP's land in towns and suburbs; in rural
   * ZIPs mostly clustered around the town point and the Census places inside the ZIP. Returns {x, y}.
   */
  sampleHome(i, rng) {
    const R = this.raster(), cells = this.zipCells(i), z = this.z;
    const rural = (z.density[i] || 0) < 500 && (z.sqmi[i] || 0) > 12;
    if (rural && rng.float() < 0.72) {
      const places = this.placesIn(i);
      let cx = z.tx[i], cy = z.ty[i], spread = clamp(Math.sqrt(z.pop[i] || 1) / 30, 2.5, 22);
      if (places.length && rng.float() < 0.8) {
        const p = rng.weightedItem(places, q => Math.max(50, q.pop));
        cx = p.x; cy = p.y; spread = clamp(Math.sqrt(p.pop || 1) / 28, 2, 20);
      }
      for (let t = 0; t < 8; t++) {
        const x = cx + rng.gauss() * spread, y = cy + rng.gauss() * spread;
        if (this.zipAt(x, y) === i) return { x, y };
      }
    }
    if (cells.length) {
      for (let t = 0; t < 4; t++) {
        const k = cells[rng.int(cells.length)];
        const x = ((k % R.W) + rng.float()) * R.cell, y = (Math.floor(k / R.W) + rng.float()) * R.cell;
        if (t === 3 || pointInRings(x, y, this.zipRings(i))) return { x, y };
      }
    }
    const bb = this.zipBBox(i);
    for (let t = 0; t < 40; t++) {
      const x = bb[0] + rng.float() * (bb[2] - bb[0]), y = bb[1] + rng.float() * (bb[3] - bb[1]);
      if (pointInRings(x, y, this.zipRings(i))) return { x, y };
    }
    return { x: z.tx[i], y: z.ty[i] };
  }

  /** A deterministic home location for (ZIP, key): the same key always gives the same point. */
  homeFor(i, key) { return this.sampleHome(i, new Rng(hash2(0x484f4d45 ^ i, key))); }

  // ------------------------------------------------ nearby things

  _gazIdx() { return this._gazIndex || (this._gazIndex = new PointIndex(this.gaz, 60)); }
  _placeIdx() { return this._placeIndex || (this._placeIndex = new PointIndex(this.places, 60)); }
  _roadIdx() {
    if (this._roadIndex) return this._roadIndex;
    const pts = [];
    this.roads.forEach((rd, ri) => rd.lines.forEach((line, li) => line.forEach((p, pi) => pts.push({ x: p[0], y: p[1], aadt: p[2], road: ri, line: li, at: pi }))));
    return (this._roadIndex = new PointIndex(pts, 40));
  }

  /** Named landforms and waters near a point: [{name, kind, rank, distKm, elev, lat, lon}], nearest (rank-weighted) first. */
  landmarksNear(x, y, radiusKm = 40, kinds = null) {
    const r = radiusKm * this.kmUnit;
    const hits = this._gazIdx().near(x, y, r).filter(([g]) => !kinds || kinds.includes(g.kind));
    return hits.map(([g, d]) => ({ name: g.name, kind: g.kind, rank: g.rank, elev: g.elev, lat: g.lat, lon: g.lon, distKm: +(d * this.unitKm).toFixed(1) }))
      .sort((a, b) => a.distKm * (1 + a.rank) - b.distKm * (1 + b.rank));
  }

  /** Census places near a point, nearest first. */
  placesNear(x, y, radiusKm = 25) {
    return this._placeIdx().near(x, y, radiusKm * this.kmUnit).map(([p, d]) => Object.assign({ distKm: +(d * this.unitKm).toFixed(1) }, p));
  }

  /** State highways near a point (Caltrans 2024 count points): [{name, route, kind, distKm, aadt}], one per route, nearest first. */
  roadsNear(x, y, radiusKm = 15) {
    const best = new Map();
    for (const [p, d] of this._roadIdx().near(x, y, radiusKm * this.kmUnit)) {
      const rd = this.roads[p.road];
      if (!best.has(rd.r)) best.set(rd.r, { name: rd.name, route: rd.r, kind: rd.kind, distKm: +(d * this.unitKm).toFixed(1), aadt: p.aadt * 1000 });
    }
    return [...best.values()];
  }

  /** ZIPs whose town point lies within radiusKm of a point: [[index, distKm]], nearest first. */
  zipsNear(x, y, radiusKm = 20) {
    if (!this._zipPointIndex) this._zipPointIndex = new PointIndex(this.z.tx.map((tx, i) => ({ x: tx, y: this.z.ty[i], i })), 40);
    return this._zipPointIndex.near(x, y, radiusKm * this.kmUnit).map(([p, d]) => [p.i, d * this.unitKm]);
  }

  // ------------------------------------------------ history

  /**
   * Wildfires that touched or came near ZIP i, most salient first (fireSalience: buildings destroyed or damaged in
   * the ZIP, then the fire's size as seen from the ZIP, the share of the ZIP burned, recency; a 7-acre fire that
   * burned one building no longer outranks a 396,825-acre complex that burned across the ZIP):
   * [{name, year, acres, dest, destInZip, dmgInZip, km, pct, salience, ...}].
   */
  firesOf(i) {
    return (this.z.fires[i] || []).map(([fi, dest, dmg, km, pct], k) => {
      const f = this.fires[fi];
      if (!f) return null;
      const r = Object.assign({}, f, { destInZip: dest, dmgInZip: dmg, km, pct });
      r.salience = +fireSalience(r).toFixed(3);
      r._k = k;
      return r;
    }).filter(Boolean).sort((a, b) => b.salience - a.salience || a._k - b._k).map(r => { delete r._k; return r; });
  }

  /**
   * The largest atmospheric rivers that reached ZIP i's stretch of coast, strongest there first: [{start, rank,
   * peakAt, stretch, rankHere, coast, hours, dmg, deaths, ...}]. rank is the landfall peak, reached at peakAt (the
   * January 2017 river peaked as a 5 at Point Reyes); rankHere is the rank it had at the ZIP's own coastal point,
   * coast (the point the ZIP's ar_max is read at: a 3 on Santa Monica Bay), never above the ZIP's ar_max. Name a
   * river by its landfall ("the atmospheric river that came ashore at Point Reyes") and call it "a category N
   * here" only for N <= ar_max.
   */
  arsOf(i, limit = 6) {
    const lat = this.z.lat[i], k = this.z.ar_pt ? this.z.ar_pt[i] : null, max = this.z.ar_max ? this.z.ar_max[i] : null;
    const pt = k != null ? this.arPts[k] || null : null;
    const out = [];
    for (const a of this.ars) {
      const local = k != null && typeof a.pr === 'string' && a.pr.length > k ? +a.pr[k] : null;
      if (local != null ? !(local > 0) : !(a.lat0 <= lat + 0.25 && a.lat1 >= lat - 0.25)) continue;
      const rankHere = local != null ? local : Math.min(a.rank, max != null ? max : a.rank);
      out.push(Object.assign({}, a, { rankHere, coast: pt ? pt.name : null }));
    }
    return out.sort((a, b) => b.rankHere - a.rankHere || b.rank - a.rank || (b.start > a.start ? 1 : b.start < a.start ? -1 : 0)).slice(0, limit);
  }

  /**
   * Wind events recorded in ZIP i's county that reached the ZIP, strongest first: [{kind, start, gust, where, lat,
   * lon, fips, dmg, deaths}]. Santa Ana events only where the ZIP's own record has Santa Ana episodes (off_kind 'sa'
   * or sa_ep > 0), Diablo events where it has Diablo episodes (off_kind 'di' or di_ep > 0), sundowners on the Santa
   * Barbara south coast (off_kind 'su'), mono and other winds in the NWS zones they were reported in (or within
   * WIND_NEAR_KM of the strongest gust), winter storms county-wide: say where the gust was measured (`where`).
   */
  windsOf(i, limit = 6) {
    const c = this.countyOf(i); if (!c) return [];
    const z = this.z, off = (z.off_kind && z.off_kind[i]) || '';
    const santaAna = off === 'sa' || (z.sa_ep && z.sa_ep[i]) > 0, diablo = off === 'di' || (z.di_ep && z.di_ep[i]) > 0;
    const reaches = w => {
      switch (w.kind) {
        case 'santa_ana': return santaAna;
        case 'diablo': return diablo;
        case 'sundowner': return off === 'su';
        case 'winter': return true;
        default:
          if (w.zips && w.zips.length) return (w._zipSet || (w._zipSet = new Set(w.zips))).has(i);
          return w.lat != null && w.lon != null && kmBetween(z.tlat[i] || z.lat[i], z.tlon[i] || z.lon[i], w.lat, w.lon) <= WIND_NEAR_KM;
      }
    };
    return this.winds.filter(w => w.fips.includes(c.fips) && reaches(w)).sort((a, b) => (b.gust || 0) - (a.gust || 0)).slice(0, limit);
  }

  /**
   * FEMA disaster declarations that designated ZIP i's county, latest first: [[date, kind, title, type]]. The pack
   * lists a county under a declaration only when it is among the declaration's designated-county count with the
   * most Individuals and Households registrations, with at least 25 (tools/build_pack.py).
   */
  femaOf(i) { const c = this.countyOf(i); return c ? c.fema : []; }

  // ------------------------------------------------ weather

  /** The elevation (m) where ZIP i's people live: at the ZIP's point, else its mean. */
  elevOf(i) {
    const pt = this.z.elev_pt_m ? this.z.elev_pt_m[i] : null;
    return pt != null ? pt : (this.z.elev_m[i] || 0);
  }

  /** The ZIP's town point as lat/lon (where distances to forecast points and stations are measured from). */
  _townLatLon(i) {
    const z = this.z;
    return [z.tlat[i] != null ? z.tlat[i] : z.lat[i], z.tlon[i] != null ? z.tlon[i] : z.lon[i]];
  }

  /**
   * The forecast point ZIP i reads, or null: the nearest of the snapshot's points within BORROW_KM in the ZIP's own
   * forecast office. {pt, kind: 'forecast' (within HERE_KM and HERE_DZ: the point's forecast is the ZIP's) |
   * 'borrowed', distKm, dz (ZIP minus point, m), elevAdjF (added to borrowed temperatures)}. Cached.
   */
  _forecastPick(i) {
    if (this._picks[i] !== undefined) return this._picks[i];
    const [lat, lon] = this._townLatLon(i), wfo = this.z.wfo ? this.z.wfo[i] : null;
    let best = null, bd = Infinity;
    for (const p of this.weather.points) {
      if (wfo && p.office !== wfo) continue;
      const d = kmBetween(lat, lon, p.lat, p.lon);
      if (d < bd) { bd = d; best = p; }
    }
    let pick = null;
    if (best && bd <= BORROW_KM) {
      const dz = best.elev != null ? this.elevOf(i) - best.elev : 0;
      const kind = bd <= HERE_KM && Math.abs(dz) <= HERE_DZ ? 'forecast' : 'borrowed';
      pick = { pt: best, kind, distKm: +bd.toFixed(1), dz, elevAdjF: kind === 'borrowed' ? +(-LAPSE_F_PER_M * dz).toFixed(1) : 0 };
    }
    return (this._picks[i] = pick);
  }

  /** The forecast point ZIP i reads (see _forecastPick), or null when it has none. */
  _forecastPoint(i) { const k = this._forecastPick(i); return k ? k.pt : null; }

  /** The observing station nearest ZIP i, with distKm; withTemp: the nearest one that reported a temperature. */
  _nearestObs(i, withTemp = false) {
    let best = null, bd = Infinity;
    const [lat, lon] = this._townLatLon(i);
    for (const o of this.weather.obs) {
      if (o.lat == null || (withTemp && o.tempF == null)) continue;
      const d = kmBetween(lat, lon, o.lat, o.lon);
      if (d < bd) { bd = d; best = o; }
    }
    return best ? Object.assign({ distKm: Math.round(bd) }, best) : null;
  }

  /** The forecast hourly rows' span (epoch ms), widened by the slack weatherAt allows. */
  _forecastWindow() {
    if (this._window) return this._window;
    let t0 = Infinity, t1 = -Infinity;
    for (const p of this.weather.points) for (const row of p.hourly || []) { const t = Date.parse(row[0]); if (t < t0) t0 = t; if (t > t1) t1 = t; }
    return (this._window = { t0: t0 - WINDOW_SLACK_MS, t1: t1 + WINDOW_SLACK_MS });
  }

  /** The hourly row of point p nearest time t: [row, |dt| ms]. */
  _hourAt(p, t) {
    let h = null, bestDt = Infinity;
    for (const row of p.hourly || []) { const dt = Math.abs(Date.parse(row[0]) - t); if (dt < bestDt) { bestDt = dt; h = row; } }
    return [h, bestDt];
  }

  /**
   * What the station nearest ZIP i measured at the snapshot, compared with the temperature ZIP i is given for that
   * hour (base(t) at the snapshot, carried from the ZIP's height to the station's): the offset weatherAt adds,
   * faded with time. 0 without a station within OBS_KM; at most 15 F either way.
   */
  _obsOffset(i, baseAtSnap) {
    const o = this._nearestObs(i, true);
    if (!o || o.distKm > OBS_KM || !Number.isFinite(baseAtSnap)) return 0;
    const dz = o.elev != null ? o.elev - this.elevOf(i) : 0;
    return clamp(o.tempF - (baseAtSnap - LAPSE_F_PER_M * dz), -15, 15);
  }

  /**
   * A period of a borrowed forecast with its temperatures carried by adjF: tempF, and the temperatures in the text
   * (the NWS phrases "high near", "low around", "falling to around", "wind chill values as low as"...; never a wind
   * speed, a rain or snow amount or a snow level).
   */
  static _carryPeriod(p, adjF) {
    const a = Math.round(adjF || 0);
    if (!p || !a) return p;
    const fix = s => String(s).replace(/\b(high near|high around|low around|low near|falling to around|rising to around|temperature around|as low as|as high as)(\s+)(-?\d+)(?!\d|\.\d)(?!\s*(?:mph|kt\b|knots|percent|%|inch|feet|ft\b|mile))/gi,
      (m, w, sp, n) => `${w}${sp}${+n + a}`);
    return Object.assign({}, p, { tempF: p.tempF != null ? p.tempF + a : p.tempF, detail: p.detail ? fix(p.detail) : p.detail, adjF: a });
  }

  /**
   * January's mean daily high (F) at ZIP i, which the atlas does not carry: 67 F on the south coast, 1.6 F less per
   * degree of latitude north of 33.5 and 9 F less per km of height (at the ZIP's point), 5 F less on the floor of
   * the Great Valley (winter fog and inversions) and 2 F more in the Colorado Desert; never within 2 F of the July
   * high. Fitted to the 1991-2020 NOAA normals of 29 places from Eureka to El Centro and Mammoth Lakes (within
   * about 2 F on average).
   */
  janHigh(i) {
    const z = this.z, prov = this.provinces[z.province[i]];
    const lat = z.tlat[i] != null ? z.tlat[i] : z.lat[i], jul = z.tjul[i] != null ? z.tjul[i] : 80;
    const jan = 67 - 1.6 * (lat - 33.5) - 9 * this.elevOf(i) / 1000 - (prov === 'Great Valley' ? 5 : 0) + (prov === 'Colorado Desert' ? 2 : 0);
    return Math.min(jan, jul - 2);
  }

  /**
   * A climate estimate for ZIP i at time t, for times no forecast covers: the day's high runs between the ZIP's
   * January high (janHigh) and its July mean high (tjul) on a yearly curve that peaks in mid-July inland and later
   * on the coast (where September is as warm as July and the fall stays mild), less a daily swing that grows with
   * distance from the coast and with elevation; and a sky chosen deterministically per ZIP and day from the season
   * and the place (winter rain days in proportion to the ZIP's annual rain, snow showers when it is cold up high,
   * marine layer mornings at the coast from May to August, tule fog on winter mornings in the Great Valley).
   * Returns the shape of weatherAt's now, plus climate: true.
   */
  climateAt(i, t) {
    const z = this.z, P = pacific(t);
    const coast = z.coast_km[i] != null ? z.coast_km[i] : 60, elev = z.elev_m[i] || 0;
    const inland = smoothstep(0, 90, coast), high_country = elev > 1200 ? 1 : 0;
    const jul = z.tjul[i] != null ? z.tjul[i] : 80, jan = this.janHigh(i);
    // the year's curve, 0 in mid-January and 1 in mid-July: a cosine peaking mid-July inland; on the coast mostly
    // that one with some of one peaking in early August
    const wave = (m, peak) => (1 + Math.cos(2 * Math.PI * (m - peak) / 12)) / 2;
    const curve = m => (1 - inland) * (0.7 * wave(m, 7) + 0.3 * wave(m, 8)) + inland * wave(m, 7);
    const mf = P.month + (P.day - 15) / 30.5, c1 = curve(1), c7 = curve(7);
    const high = jan + (jul - jan) * (curve(mf) - c1) / (c7 - c1);
    const swingDay = 12 + 18 * inland + 6 * high_country;
    const hour = P.hour + P.minute / 60;
    const diurnal = (1 + Math.cos(2 * Math.PI * (hour - 15) / 24)) / 2;       // 1 at 3 PM, 0 at 3 AM
    const tempF = Math.round(high - swingDay * (1 - diurnal));
    // sunrise and sunset, near enough: 7:20 and 16:50 at the winter solstice, 5:45 and 20:30 at the summer one
    const summer = (1 + Math.cos(2 * Math.PI * (P.month - 6.7) / 12)) / 2;
    const isDay = hour >= 7.33 - 1.58 * summer && hour < 16.83 + 3.67 * summer;
    // the day's draw is keyed by the Pacific calendar date, so the sky changes at local midnight in daylight time too
    const m = P.month, day = Math.floor(Date.UTC(P.year, P.month - 1, P.day) / 86400000);
    const u = u01(hash3(0x534b59, i, day));
    const wetness = [1, 1, 0.85, 0.45, 0.12, 0.03, 0.01, 0.01, 0.05, 0.25, 0.6, 0.95][m - 1];
    const rainDay = u < clamp((z.rain_in[i] || 10) / 120, 0.02, 0.4) * wetness;
    let short;
    if (rainDay) short = elev > 1400 && high < 46 ? 'Snow Showers' : 'Rain Showers';
    else if (coast < 12 && m >= 5 && m <= 8 && hour < 11) short = 'Patchy Fog';
    else if (this.provinces[z.province[i]] === 'Great Valley' && (m === 12 || m === 1) && hour < 11 && u < 0.55) short = 'Fog';
    else short = isDay ? (u < 0.75 ? 'Sunny' : 'Partly Sunny') : (u < 0.75 ? 'Clear' : 'Partly Cloudy');
    return { tempF, rh: null, pop: rainDay ? 70 : 5, wind: null, short, isDay, time: new Date(t).toISOString(), climate: true };
  }

  /**
   * weatherAt's now for a time no forecast covers: the climate estimate, shifted toward what the station nearest
   * the ZIP measured at the snapshot (carried to the ZIP's height) by an offset that fades with time from the
   * snapshot (fade = exp(-|t - snapshot| / OBS_FADE_MS)); within two hours of the snapshot the station's sky too.
   */
  _climateNow(i, t, fade) {
    const c = this.climateAt(i, t);
    if (!(fade > 0.001)) return c;
    const o = this._nearestObs(i, true);
    if (!o || o.distKm > OBS_KM) return c;
    const offset = this._obsOffset(i, this.climateAt(i, this.snapshotTime).tempF);
    c.tempF = Math.round(c.tempF + offset * fade);
    if (Math.abs(t - this.snapshotTime) <= 2 * 3600000 && o.text) c.short = o.text;
    c.anchored = o.id;
    return c;
  }

  /**
   * The weather for ZIP i at time t (epoch ms; default the snapshot time). Fields: now {tempF, rh, pop, wind, short,
   * isDay, time}, period and next (the forecast periods), obs (the nearest station), alerts (the ZIP's zone or
   * county), keyMessages (the forecast office's), fireWeather and excessiveRain (the SPC and WPC day-1 levels for the
   * county), point and office, stale, approx and basis.
   *
   * basis says where `now` comes from: {kind, point, office, officeName, distKm, elevAdjF}.
   * - 'forecast': the NWS forecast of a point within HERE_KM and HERE_DZ (m) of the ZIP: the ZIP's own forecast.
   * - 'borrowed': the forecast of a point up to BORROW_KM away in the ZIP's own forecast office (never across the
   *   Sierra crest, which the offices split along), carried to the ZIP's height (elevAdjF, about -3.5 F per 1,000 ft,
   *   applied to now, the periods' temperatures and the temperatures in their text). It is that city's forecast,
   *   not the ZIP's: say so ("the forecast for Fresno"), never "here".
   * - 'climate': no forecast for the ZIP at t (no point in reach, or t outside the forecast window): now is the
   *   climate estimate (climateAt); period and next are empty; stale is true.
   * approx is true unless the kind is 'forecast': hedge the numbers ("probably around 45").
   *
   * Near the snapshot every kind is anchored to the nearest station's measurement (within OBS_KM), an offset that
   * fades with time from the snapshot (OBS_FADE_MS), so a cold afternoon reading at the snapshot does not cool the
   * next day; within two hours of the snapshot a climate estimate takes the station's sky.
   */
  weatherAt(i, t = this.snapshotTime) {
    const zr = this.zip(i), pick = this._forecastPick(i), obs = this._nearestObs(i), snap = this.snapshotTime;
    const wfo = zr.wfo || (pick ? pick.pt.office : null), fade = Math.exp(-Math.abs(t - snap) / OBS_FADE_MS);
    const win = this._forecastWindow(), inWindow = t >= win.t0 && t <= win.t1;
    const [h, bestDt] = pick ? this._hourAt(pick.pt, t) : [null, Infinity];
    const out = { source: '', fetched: this.weather.fetched, point: null, office: wfo, stale: false, approx: true, basis: null, now: null, period: null, next: [] };
    if (pick && h && bestDt <= WINDOW_SLACK_MS) {
      const p = pick.pt, adj = pick.elevAdjF, [hs] = this._hourAt(p, snap);
      const offset = fade > 0.001 && hs ? this._obsOffset(i, hs[1] + adj) * fade : 0;
      out.now = { tempF: Math.round(h[1] + adj + offset), rh: h[2], pop: h[3], wind: h[4], short: h[5], isDay: !!h[6], time: h[0] };
      out.point = p.city;
      out.office = p.office;
      out.approx = pick.kind !== 'forecast';
      out.basis = { kind: pick.kind, point: p.city, office: p.office, officeName: this.offices[p.office] || p.office, distKm: pick.distKm, elevAdjF: adj };
      out.source = pick.kind === 'forecast' ? `NWS ${p.office} forecast for ${p.city}, snapshot ${this.weather.fetched}`
        : `NWS ${p.office} forecast for ${p.city} (${Math.round(pick.distKm)} km away), carried ${adj >= 0 ? '+' : ''}${adj} F for height; snapshot ${this.weather.fetched}`;
      const periods = p.periods || [];
      const cur = periods.find(q => Date.parse(q.start) <= t && t < Date.parse(q.end));
      const idx = cur ? periods.indexOf(cur) : -1;
      out.period = cur ? World._carryPeriod(cur, adj) : null;
      out.next = idx >= 0 ? periods.slice(idx + 1, idx + 4).map(q => World._carryPeriod(q, adj)) : [];
    } else {
      out.now = this._climateNow(i, t, fade);
      out.stale = true;
      out.basis = { kind: 'climate', point: null, office: wfo, officeName: wfo ? this.offices[wfo] || wfo : null, distKm: null, elevAdjF: 0 };
      out.source = inWindow ? `climate estimate for ${zr.zip}: no NWS forecast point within ${BORROW_KM} km in its forecast office`
        : `climate estimate for ${zr.zip}: past the NWS forecast of ${this.weather.fetched}`;
    }
    out.obs = obs;
    const zone = zr.zone, fipsFull = zr.countyFips || '', fips = fipsFull ? fipsFull.slice(2) : null;
    out.alerts = this.weather.alerts.filter(a => {
      const on = a.onset ? Date.parse(a.onset) : -Infinity, end = Date.parse(a.ends || a.expires || '2999-01-01');
      const here = (a.zones || []).includes(zone) || (!!fipsFull && (a.fips || []).some(f => f === fipsFull || f === '0' + fipsFull || f === fips || String(f).endsWith(fipsFull.slice(2))));
      return here && t <= end && t >= on - 36 * 3600000;
    }).map(a => ({ event: a.event, severity: a.severity, headline: a.headline, onset: a.onset, ends: a.ends, description: a.description, instruction: a.instruction }))
      .filter((a, k, all) => all.findIndex(b => b.event === a.event) === k);
    // the key messages of the ZIP's own forecast office (the office of the point it reads; Reno's for Mammoth Lakes,
    // never Hanford's) and the day-1 outlooks speak about the snapshot's own days, whatever the basis
    const afd = out.office ? this.weather.afd[out.office] : null;
    const outlookDay = inWindow && t >= snap - 12 * 3600000 && t <= snap + 30 * 3600000;
    out.keyMessages = afd && inWindow ? afd.key : [];
    const fireDay = (this.weather.fire.days || {})['1'], eroDay = (this.weather.ero.days || {})['1'];
    const fl = outlookDay && fireDay && fireDay.levels ? fireDay.levels[fipsFull] : 0, el = outlookDay && eroDay && eroDay.levels ? eroDay.levels[fipsFull] : 0;
    out.fireWeather = { level: fl || 0, name: (this.weather.fire.names || [])[fl || 0] || 'None' };
    out.excessiveRain = { level: el || 0, name: (this.weather.ero.names || [])[el || 0] || 'None' };
    return out;
  }
}
