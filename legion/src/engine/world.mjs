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
    this.ars = pack.ars.map(a => ({ start: a[0], rank: a[1], peakAt: a[2], stretch: a[3], lat0: a[4], lat1: a[5], dmg: a[6], deaths: a[7], hours: a[8], gustAt: a[9] }));
    this.winds = pack.winds.map(w => ({ kind: w[0], start: w[1], gust: w[2], where: w[3], fips: w[4] || [], dmg: w[5], deaths: w[6] }));
    this.weather = pack.weather;
    this.snapshotTime = Date.parse(pack.weather.fetched);
    this._rows = new Array(this.N);
    this._rings = new Array(this.N);
    this._raster = null;
    this._gazIndex = null; this._placeIndex = null; this._roadIndex = null; this._zipPointIndex = null;
  }

  // ------------------------------------------------ ZIP access

  /** Index of a ZIP code string, or -1. */
  indexOf(zip) { const i = this.zipIndex.get(String(zip)); return i === undefined ? -1 : i; }

  /** Column array by pack name (see pack.zcols). */
  col(name) { return this.z[name]; }

  get(i, name) { const c = this.z[name]; return c ? c[i] : undefined; }

  /** Every column of ZIP i as one object, with names resolved (county, region, province, zone, place). Cached. */
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

  /** Find ZIPs by ZIP code, city, place or county name (case-insensitive prefix). */
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

  /** Wildfires that touched or came near ZIP i, most destructive first: [{name, year, acres, destInZip, dmgInZip, km, pct, dest}]. */
  firesOf(i) {
    return (this.z.fires[i] || []).map(([fi, dest, dmg, km, pct]) => {
      const f = this.fires[fi];
      return f ? Object.assign({}, f, { destInZip: dest, dmgInZip: dmg, km, pct }) : null;
    }).filter(Boolean);
  }

  /** The largest atmospheric rivers whose landfall span covers ZIP i's latitude, strongest and latest first. */
  arsOf(i, limit = 6) {
    const lat = this.z.lat[i];
    return this.ars.filter(a => a.lat0 <= lat + 0.25 && a.lat1 >= lat - 0.25)
      .sort((a, b) => b.rank - a.rank || (b.start > a.start ? 1 : -1)).slice(0, limit);
  }

  /** Wind events (Santa Ana, Diablo, sundowner, winter storms) recorded in ZIP i's county, strongest first. */
  windsOf(i, limit = 6) {
    const c = this.countyOf(i); if (!c) return [];
    return this.winds.filter(w => w.fips.includes(c.fips)).sort((a, b) => (b.gust || 0) - (a.gust || 0)).slice(0, limit);
  }

  /** FEMA disaster declarations that covered ZIP i's county, latest first: [[date, kind, title, type]]. */
  femaOf(i) { const c = this.countyOf(i); return c ? c.fema : []; }

  // ------------------------------------------------ weather

  _forecastPoint(i) {
    const pts = this.weather.points, reg = this.z.region[i];
    let best = null, bd = Infinity;
    const lat = this.z.lat[i], lon = this.z.lon[i];
    for (const p of pts) {
      const d = Math.hypot(p.lat - lat, (p.lon - lon) * 0.8) + (p.reg === reg ? 0 : 0.6);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  _nearestObs(i) {
    let best = null, bd = Infinity;
    const lat = this.z.lat[i], lon = this.z.lon[i];
    for (const o of this.weather.obs) { const d = Math.hypot(o.lat - lat, (o.lon - lon) * 0.8); if (d < bd) { bd = d; best = o; } }
    return best ? Object.assign({ distKm: Math.round(bd * KM_PER_DEG) }, best) : null;
  }

  /**
   * A climate estimate for ZIP i at time t, for times no forecast covers: the ZIP's July mean high (tjul) brought
   * down through the year by an annual swing that grows with distance from the coast and with elevation (about
   * 10 F on the coast, 40 F deep inland), a daily swing that does the same, and a sky chosen deterministically per
   * ZIP and day from the season and the place (winter rain days in proportion to the ZIP's annual rain, snow
   * showers when it is cold up high, marine layer mornings at the coast from May to August, tule fog on winter
   * mornings in the Great Valley). Returns the shape of weatherAt's now, plus climate: true.
   */
  climateAt(i, t) {
    const z = this.z, P = pacific(t);
    const coast = z.coast_km[i] != null ? z.coast_km[i] : 60, elev = z.elev_m[i] || 0;
    const inland = smoothstep(0, 90, coast), high_country = elev > 1200 ? 1 : 0;
    const swingYear = 10 + 30 * inland + 6 * high_country;
    const season = (1 + Math.cos(2 * Math.PI * (P.month - 7.4) / 12)) / 2;   // 1 in late July, 0 in late January
    const high = (z.tjul[i] != null ? z.tjul[i] : 80) - swingYear * (1 - season);
    const swingDay = 12 + 18 * inland + 6 * high_country;
    const hour = P.hour + P.minute / 60;
    const diurnal = (1 + Math.cos(2 * Math.PI * (hour - 15) / 24)) / 2;       // 1 at 3 PM, 0 at 3 AM
    const tempF = Math.round(high - swingDay * (1 - diurnal));
    // sunrise and sunset, near enough: 7:20 and 16:50 at the winter solstice, 5:45 and 20:30 at the summer one
    const summer = (1 + Math.cos(2 * Math.PI * (P.month - 6.7) / 12)) / 2;
    const isDay = hour >= 7.33 - 1.58 * summer && hour < 16.83 + 3.67 * summer;
    const m = P.month, day = Math.floor((t - 8 * 3600000) / 86400000);
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
   * The weather for ZIP i at time t (epoch ms; default the snapshot time): the NWS forecast hour and period
   * of the nearest forecast point (offset by the nearest observing station's difference at the snapshot),
   * active alerts for the ZIP's forecast zone or county, the forecast office's key messages, and the SPC fire
   * weather and WPC excessive rain levels for the county. Beyond the forecast window it falls back to a
   * climate estimate from the ZIP's July mean ({stale: true}).
   */
  weatherAt(i, t = this.snapshotTime) {
    const pt = this._forecastPoint(i), obs = this._nearestObs(i), zr = this.zip(i);
    const out = { source: `NWS ${pt ? pt.office : ''} snapshot ${this.weather.fetched}`, fetched: this.weather.fetched, point: pt ? pt.city : null, office: pt ? pt.office : null, stale: false };
    const hourly = pt ? pt.hourly : [];
    let h = null, hAtSnap = null, bestDt = Infinity, snapDt = Infinity;
    for (const row of hourly) {
      const ht = Date.parse(row[0]);
      const dt = Math.abs(ht - t); if (dt < bestDt) { bestDt = dt; h = row; }
      const ds = Math.abs(ht - this.snapshotTime); if (ds < snapDt) { snapDt = ds; hAtSnap = row; }
    }
    const offset = obs && hAtSnap && obs.tempF != null ? clamp(obs.tempF - hAtSnap[1], -15, 15) * (obs.distKm < 60 ? 1 : 0.5) : 0;
    if (h && bestDt <= 90 * 60000) {
      out.now = { tempF: Math.round(h[1] + offset), rh: h[2], pop: h[3], wind: h[4], short: h[5], isDay: !!h[6], time: h[0] };
    } else {
      out.now = this.climateAt(i, t);
      out.stale = true;
    }
    out.period = null;
    out.next = [];
    if (pt && !out.stale) {
      const periods = pt.periods || [];
      const cur = periods.find(p => Date.parse(p.start) <= t && t < Date.parse(p.end));
      out.period = cur || null;
      const idx = cur ? periods.indexOf(cur) : -1;
      out.next = idx >= 0 ? periods.slice(idx + 1, idx + 4) : [];
    }
    out.obs = obs;
    const zone = zr.zone, fips = zr.countyFips ? zr.countyFips.slice(2) : null, fipsFull = zr.countyFips;
    out.alerts = this.weather.alerts.filter(a => {
      const on = a.onset ? Date.parse(a.onset) : -Infinity, end = Date.parse(a.ends || a.expires || '2999-01-01');
      const here = (a.zones || []).includes(zone) || (a.fips || []).some(f => f === fipsFull || f === '0' + fipsFull || f === fips || String(f).endsWith(fipsFull.slice(2)));
      return here && t <= end && t >= on - 36 * 3600000;
    }).map(a => ({ event: a.event, severity: a.severity, headline: a.headline, onset: a.onset, ends: a.ends, description: a.description, instruction: a.instruction }))
      .filter((a, k, all) => all.findIndex(b => b.event === a.event) === k);
    const afd = pt && this.weather.afd[pt.office];
    // the forecast office's key messages and the day-1 outlooks speak about the snapshot's own days
    const outlookDay = !out.stale && t >= this.snapshotTime - 12 * 3600000 && t <= this.snapshotTime + 30 * 3600000;
    out.keyMessages = afd && !out.stale ? afd.key : [];
    const fireDay = (this.weather.fire.days || {})['1'], eroDay = (this.weather.ero.days || {})['1'];
    const fl = outlookDay && fireDay && fireDay.levels ? fireDay.levels[fipsFull] : 0, el = outlookDay && eroDay && eroDay.levels ? eroDay.levels[fipsFull] : 0;
    out.fireWeather = { level: fl || 0, name: (this.weather.fire.names || [])[fl || 0] || 'None' };
    out.excessiveRain = { level: el || 0, name: (this.weather.ero.names || [])[el || 0] || 'None' };
    return out;
  }
}
