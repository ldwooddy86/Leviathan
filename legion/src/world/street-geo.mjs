// Legion · street view geometry: the local metric frame, smooth noise, polyline tools, land and water, the sun.
//
// The street view works in meters. A view is a square about 1.2 km across, centered on a point in world units
// (about 197.5 m each); this file converts between the two, classifies the ground as land, bay or lake, ocean
// or out-of-state land from the pack's outlines, and computes where the sun is. Everything here is pure and
// DOM-free so the network builder and the simulation can be tested in Node.

import { hash2, hash3, mix32, clamp } from '../engine/rng.mjs';
import { pointInRings } from '../engine/world.mjs';

// ---------------------------------------------------------------- the local frame

/**
 * A metric frame centered on a world point. x grows east and y grows south, as in world units, but in meters.
 * The x scale is taken at the latitude of `anchorY` (the style ZIP's town point), so two views of the same ZIP
 * share one lattice: lattice coordinates are `local + offset`.
 */
export class Frame {
  /**
   * @param {object} world the World
   * @param {number} cx view center x (world units)
   * @param {number} cy view center y (world units)
   * @param {number} [anchorX] lattice anchor x (world units), default the center
   * @param {number} [anchorY] lattice anchor y (world units), default the center
   */
  constructor(world, cx, cy, anchorX = cx, anchorY = cy) {
    const p = world.proj;
    const lat = p.maxy - anchorY / p.sx;
    this.cx = cx; this.cy = cy;
    this.ax = anchorX; this.ay = anchorY;
    this.lat = p.maxy - cy / p.sx;
    this.lon = p.minx + cx / (p.kx * p.sx);
    /** meters per world unit along x and y */
    this.fx = world.unitKm * 1000 * Math.cos(lat * Math.PI / 180) / p.kx;
    this.fy = world.unitKm * 1000;
    /** lattice offset: lattice = local + (ox, oy) */
    this.ox = (cx - anchorX) * this.fx;
    this.oy = (cy - anchorY) * this.fy;
  }
  /** World units to local meters. */
  toLocal(wx, wy) { return { x: (wx - this.cx) * this.fx, y: (wy - this.cy) * this.fy }; }
  /** Local meters to world units. */
  toWorld(lx, ly) { return { x: this.cx + lx / this.fx, y: this.cy + ly / this.fy }; }
  /** Latitude and longitude of a local point. */
  latLon(lx, ly, world) { const w = this.toWorld(lx, ly); return world.unproject(w.x, w.y); }
}

// ---------------------------------------------------------------- noise

const fade = t => t * t * t * (t * (t * 6 - 15) + 10);

/** Smooth value noise in [-1, 1] on a unit lattice, deterministic from the seed. */
export function valueNoise(seed) {
  const s = seed >>> 0;
  const at = (ix, iy) => (hash3(s, ix, iy) / 2147483648) - 1;
  return (x, y) => {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const u = fade(fx), v = fade(fy);
    const a = at(ix, iy), b = at(ix + 1, iy), c = at(ix, iy + 1), d = at(ix + 1, iy + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

/** Fractal sum of value noise: `octaves` layers, each at twice the frequency and `gain` times the amplitude. */
export function fbm(seed, octaves = 4, gain = 0.5) {
  const layers = [];
  for (let k = 0; k < octaves; k++) layers.push(valueNoise(hash2(seed, k + 1)));
  let norm = 0; for (let k = 0, a = 1; k < octaves; k++, a *= gain) norm += a;
  return (x, y) => {
    let sum = 0, amp = 1, f = 1;
    for (let k = 0; k < octaves; k++) { sum += layers[k](x * f + k * 17.3, y * f - k * 9.1) * amp; amp *= gain; f *= 2; }
    return sum / norm;
  };
}

/** A uint32 hash of a float position quantized to `q` meters (stable ids for generated things). */
export function posHash(seed, x, y, q = 1) { return hash3(seed, Math.round(x / q), Math.round(y / q)); }

/** Float in [0, 1) from a hash and a salt. */
export const hf = (h, salt = 0) => mix32((h ^ Math.imul(salt + 1, 0x9e3779b9)) >>> 0) / 4294967296;

// ---------------------------------------------------------------- polylines

/** Total length of a flat [x0,y0,x1,y1,...] polyline. */
export function polyLength(pts) {
  let L = 0;
  for (let i = 2; i < pts.length; i += 2) L += Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]);
  return L;
}

/** Cumulative lengths at each vertex (Float64Array, first 0). */
export function cumLengths(pts) {
  const n = pts.length / 2, c = new Float64Array(n);
  for (let i = 1; i < n; i++) c[i] = c[i - 1] + Math.hypot(pts[2 * i] - pts[2 * i - 2], pts[2 * i + 1] - pts[2 * i - 1]);
  return c;
}

/** Segment index k with cum[k] <= s < cum[k+1] (binary search, clamped). */
export function segAt(cum, s) {
  let lo = 0, hi = cum.length - 2;
  if (hi < 0) return 0;
  if (s <= 0) return 0;
  if (s >= cum[hi + 1]) return hi;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (cum[mid] <= s) lo = mid; else hi = mid - 1; }
  return lo;
}

/**
 * Point and unit tangent at arc length s along a polyline (clamped to its ends). Writes into `out`
 * ({x, y, tx, ty, k}) to avoid allocation in hot loops; k is the segment index.
 */
export function pointAt(pts, cum, s, out = {}) {
  const n = cum.length;
  if (n < 2) { out.x = pts[0]; out.y = pts[1]; out.tx = 1; out.ty = 0; out.k = 0; return out; }
  const k = segAt(cum, s);
  const x0 = pts[2 * k], y0 = pts[2 * k + 1], x1 = pts[2 * k + 2], y1 = pts[2 * k + 3];
  const L = cum[k + 1] - cum[k] || 1e-9;
  const u = clamp((s - cum[k]) / L, 0, 1);
  out.x = x0 + (x1 - x0) * u; out.y = y0 + (y1 - y0) * u;
  out.tx = (x1 - x0) / L; out.ty = (y1 - y0) / L; out.k = k;
  return out;
}

/** Resample a polyline at roughly even spacing (keeps both ends). */
export function resample(pts, spacing) {
  const cum = cumLengths(pts), L = cum[cum.length - 1];
  if (!(L > 0)) return Float64Array.from(pts);
  const n = Math.max(1, Math.round(L / spacing));
  const out = new Float64Array((n + 1) * 2), p = {};
  for (let i = 0; i <= n; i++) { pointAt(pts, cum, L * i / n, p); out[2 * i] = p.x; out[2 * i + 1] = p.y; }
  return out;
}

/** Chaikin corner cutting, `iterations` times, ends kept (open polylines). */
export function chaikin(pts, iterations = 2) {
  let a = Array.from(pts);
  for (let it = 0; it < iterations; it++) {
    const n = a.length / 2;
    if (n < 3) break;
    const b = [a[0], a[1]];
    for (let i = 0; i < n - 1; i++) {
      const x0 = a[2 * i], y0 = a[2 * i + 1], x1 = a[2 * i + 2], y1 = a[2 * i + 3];
      if (i > 0) b.push(0.75 * x0 + 0.25 * x1, 0.75 * y0 + 0.25 * y1);
      if (i < n - 2) b.push(0.25 * x0 + 0.75 * x1, 0.25 * y0 + 0.75 * y1);
    }
    b.push(a[2 * n - 2], a[2 * n - 1]);
    a = b;
  }
  return Float64Array.from(a);
}

/** Chaikin smoothing of a closed ring. */
export function chaikinClosed(pts, iterations = 2) {
  let a = Array.from(pts);
  for (let it = 0; it < iterations; it++) {
    const n = a.length / 2;
    if (n < 3) break;
    const b = [];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const x0 = a[2 * i], y0 = a[2 * i + 1], x1 = a[2 * j], y1 = a[2 * j + 1];
      b.push(0.75 * x0 + 0.25 * x1, 0.75 * y0 + 0.25 * y1, 0.25 * x0 + 0.75 * x1, 0.25 * y0 + 0.75 * y1);
    }
    a = b;
  }
  return Float64Array.from(a);
}

/** Douglas-Peucker simplification of an open polyline (tolerance in meters). */
export function simplify(pts, tol) {
  const n = pts.length / 2;
  if (n <= 2) return Float64Array.from(pts);
  const keep = new Uint8Array(n); keep[0] = keep[n - 1] = 1;
  const stack = [[0, n - 1]];
  while (stack.length) {
    const [i, j] = stack.pop();
    let best = -1, bd = tol;
    for (let k = i + 1; k < j; k++) {
      const d = pointSegDist(pts[2 * k], pts[2 * k + 1], pts[2 * i], pts[2 * i + 1], pts[2 * j], pts[2 * j + 1]).d;
      if (d > bd) { bd = d; best = k; }
    }
    if (best > 0) { keep[best] = 1; stack.push([i, best], [best, j]); }
  }
  const out = [];
  for (let k = 0; k < n; k++) if (keep[k]) out.push(pts[2 * k], pts[2 * k + 1]);
  return Float64Array.from(out);
}

/** Distance from (px,py) to segment (ax,ay)-(bx,by); t is the projection parameter in [0,1]. */
export function pointSegDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
  let t = L2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / L2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const x = ax + t * dx, y = ay + t * dy;
  return { d: Math.hypot(px - x, py - y), t, x, y };
}

/** Intersection of segments p0-p1 and q0-q1 (proper or touching): {t, u, x, y} or null. */
export function segIntersect(p0x, p0y, p1x, p1y, q0x, q0y, q1x, q1y) {
  const rx = p1x - p0x, ry = p1y - p0y, sx = q1x - q0x, sy = q1y - q0y;
  const den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-12) return null;
  const qpx = q0x - p0x, qpy = q0y - p0y;
  const t = (qpx * sy - qpy * sx) / den, u = (qpx * ry - qpy * rx) / den;
  if (t < -1e-9 || t > 1 + 1e-9 || u < -1e-9 || u > 1 + 1e-9) return null;
  return { t: clamp(t, 0, 1), u: clamp(u, 0, 1), x: p0x + t * rx, y: p0y + t * ry };
}

/**
 * Clip a polyline to the square |x| <= R, |y| <= R. Returns the pieces inside (each a Float64Array) with flags
 * telling whether each end was cut at the boundary.
 */
export function clipToSquare(pts, R) {
  const pieces = [];
  let cur = null, startCut = false;
  const inside = (x, y) => x >= -R && x <= R && y >= -R && y <= R;
  const n = pts.length / 2;
  for (let i = 0; i < n - 1; i++) {
    const x0 = pts[2 * i], y0 = pts[2 * i + 1], x1 = pts[2 * i + 2], y1 = pts[2 * i + 3];
    // Liang-Barsky on this segment
    let t0 = 0, t1 = 1;
    const dx = x1 - x0, dy = y1 - y0;
    const p = [-dx, dx, -dy, dy], q = [x0 + R, R - x0, y0 + R, R - y0];
    let ok = true;
    for (let k = 0; k < 4; k++) {
      if (p[k] === 0) { if (q[k] < 0) { ok = false; break; } }
      else { const r = q[k] / p[k]; if (p[k] < 0) { if (r > t1) { ok = false; break; } if (r > t0) t0 = r; } else { if (r < t0) { ok = false; break; } if (r < t1) t1 = r; } }
    }
    if (!ok || t1 - t0 < 1e-12) { if (cur) { pieces.push({ pts: cur, startCut, endCut: true }); cur = null; } continue; }
    const ax = x0 + t0 * dx, ay = y0 + t0 * dy, bx = x0 + t1 * dx, by = y0 + t1 * dy;
    if (!cur) { cur = [ax, ay]; startCut = t0 > 0 || !inside(x0, y0); }
    cur.push(bx, by);
    if (t1 < 1) { pieces.push({ pts: cur, startCut, endCut: true }); cur = null; }
  }
  if (cur) pieces.push({ pts: cur, startCut, endCut: false });
  return pieces.filter(p => p.pts.length >= 4).map(p => ({ pts: Float64Array.from(p.pts), startCut: p.startCut, endCut: p.endCut }));
}

/** Signed area of a closed ring (positive counter-clockwise in a y-up frame; our y grows south). */
export function ringArea(pts) {
  let a = 0; const n = pts.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) a += pts[2 * j] * pts[2 * i + 1] - pts[2 * i] * pts[2 * j + 1];
  return a / 2;
}

/** Centroid of a closed ring (falls back to the vertex mean for degenerate rings). */
export function ringCentroid(pts) {
  let a = 0, cx = 0, cy = 0; const n = pts.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const f = pts[2 * j] * pts[2 * i + 1] - pts[2 * i] * pts[2 * j + 1];
    a += f; cx += (pts[2 * j] + pts[2 * i]) * f; cy += (pts[2 * j + 1] + pts[2 * i + 1]) * f;
  }
  if (Math.abs(a) < 1e-9) { let sx = 0, sy = 0; for (let i = 0; i < n; i++) { sx += pts[2 * i]; sy += pts[2 * i + 1]; } return { x: sx / n, y: sy / n }; }
  return { x: cx / (3 * a), y: cy / (3 * a) };
}

/** Even-odd point in a single flat ring. */
export function pointInRing(x, y, r) {
  let inside = false; const n = r.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = r[2 * i], yi = r[2 * i + 1], xj = r[2 * j], yj = r[2 * j + 1];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-12) + xi) inside = !inside;
  }
  return inside;
}

/** Corners [x0,y0,...,x3,y3] of a rectangle centered at (cx,cy) with half sizes (hw along (ux,uy), hd across). */
export function rectCorners(cx, cy, ux, uy, hw, hd) {
  const nx = -uy, ny = ux;
  return [cx - ux * hw - nx * hd, cy - uy * hw - ny * hd, cx + ux * hw - nx * hd, cy + uy * hw - ny * hd,
    cx + ux * hw + nx * hd, cy + uy * hw + ny * hd, cx - ux * hw + nx * hd, cy - uy * hw + ny * hd];
}

/** Bounding box [x0,y0,x1,y1] of flat points. */
export function bboxOf(pts) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < pts.length; i += 2) { if (pts[i] < x0) x0 = pts[i]; if (pts[i] > x1) x1 = pts[i]; if (pts[i + 1] < y0) y0 = pts[i + 1]; if (pts[i + 1] > y1) y1 = pts[i + 1]; }
  return [x0, y0, x1, y1];
}

// ---------------------------------------------------------------- land and water

/** Ground kinds of the land and water grid: the ocean, California land, a bay or lake, land outside California. */
export const GROUND = Object.freeze({ OCEAN: 0, LAND: 1, LAKE: 2, FOREIGN: 3 });

/**
 * Classify the ground of a view on a regular grid: land (with its ZIP), bay or lake (the pack's water
 * polygons), ocean, or land outside California. The pack's outlines are integer world units (about 200 m), so
 * the sample positions are domain-warped by smooth noise (tens of meters) to give shores a natural line without
 * moving them more than the data's own precision.
 *
 * Ground in no ZIP is not necessarily water: ZIP outlines (ZCTAs) leave out about a third of the state's land
 * (desert, forest, parks, campuses) as well as the larger rivers. Where the sea is near (seaNear) such ground is
 * the ocean, as the ZIP outlines draw the coast in more detail than anything else in the pack. Inland it is
 * land, except thin, open-ended, elongated strips that are not a highway's right of way: those are river
 * channels (the Delta's sloughs, a broad river through town) and count as inland water.
 * @param {object} world
 * @param {Frame} frame
 * @param {number} R half size of the view in meters
 * @param {{cell?: number, seed?: number, margin?: number}} [opts]
 * @returns {{cell:number, n:number, R:number, kind:Uint8Array, zip:Int16Array, at:(x:number,y:number)=>number,
 *   zipAt:(x:number,y:number)=>number, landShare:number, waterShare:number, hasOcean:boolean, hasLake:boolean, zips:Map<number,number>}}
 */
export function groundGrid(world, frame, R, { cell = 10, seed = 1, margin = 0 } = {}) {
  const half = R + margin;
  const n = Math.ceil((2 * half) / cell);
  const kind = new Uint8Array(n * n), zip = new Int16Array(n * n).fill(-1);
  // candidate shapes: ZIPs whose box overlaps the view, water bodies and neighbor states likewise
  const w0 = frame.toWorld(-half - 60, -half - 60), w1 = frame.toWorld(half + 60, half + 60);
  const bx0 = Math.min(w0.x, w1.x), bx1 = Math.max(w0.x, w1.x), by0 = Math.min(w0.y, w1.y), by1 = Math.max(w0.y, w1.y);
  const overlaps = bb => bb[0] <= bx1 && bb[2] >= bx0 && bb[1] <= by1 && bb[3] >= by0;
  const zipCands = [];
  const seen = new Set();
  const step = Math.max(0.25, (bx1 - bx0) / 12);
  for (let x = bx0; x <= bx1 + 1e-9; x += step) for (let y = by0; y <= by1 + 1e-9; y += step) { const z = world.zipAt(x, y); if (z >= 0) seen.add(z); }
  // neighbors of the seen ZIPs by box overlap (small ZIPs can hide between raster samples)
  for (let i = 0; i < world.N; i++) { const bb = world.zipBBox(i); if (bb && overlaps(bb)) seen.add(i); }
  for (const i of seen) zipCands.push({ i, bb: world.zipBBox(i), rings: world.zipRings(i) });
  const water = [];
  for (const rings of waterCache(world)) if (overlaps(rings.bbox)) water.push(rings);
  const foreign = [];
  for (const rings of neighborCache(world)) if (overlaps(rings.bbox)) foreign.push(rings);
  const warp = fbm(hash2(seed, 0x5a7e), 3, 0.5), warp2 = fbm(hash2(seed, 0x5a7f), 3, 0.5);
  const amp = 45, wl = 260;
  const counts = new Map();
  const unzoned = [];          // [cell index, warped local x, warped local y, …] of samples in no ZIP, water or state
  let land = 0, wat = 0, ocean = false, lake = false;
  for (let j = 0; j < n; j++) {
    const ly = -half + (j + 0.5) * cell;
    for (let i = 0; i < n; i++) {
      const lx = -half + (i + 0.5) * cell;
      const ax = (lx + frame.ox) / wl, ay = (ly + frame.oy) / wl;
      const qx = lx + warp(ax, ay) * amp, qy = ly + warp2(ax, ay) * amp;
      const p = frame.toWorld(qx, qy), q = frame.toWorld(lx, ly);
      const k = j * n + i;
      let kd = UNZONED, zi = -1;
      let inWater = false;
      for (const w of water) if (p.x >= w.bbox[0] && p.x <= w.bbox[2] && p.y >= w.bbox[1] && p.y <= w.bbox[3] && pointInRings(p.x, p.y, w)) { inWater = true; break; }
      if (inWater) kd = GROUND.LAKE;
      else {
        for (const z of zipCands) {
          const bb = z.bb;
          if (p.x >= bb[0] && p.x <= bb[2] && p.y >= bb[1] && p.y <= bb[3] && pointInRings(p.x, p.y, z.rings)) { kd = GROUND.LAND; break; }
        }
        if (kd !== GROUND.LAND) for (const f of foreign) if (pointInRings(p.x, p.y, f)) { kd = GROUND.FOREIGN; break; }
      }
      if (kd === GROUND.LAND) {
        // the ZIP is taken at the true position (not the warped one) so households and roofs stay in their ZIP
        zi = world.zipAt(q.x, q.y);
        if (zi < 0) zi = world.zipAt(p.x, p.y);
        if (zi >= 0) counts.set(zi, (counts.get(zi) || 0) + 1);
      } else if (kd === UNZONED) unzoned.push(k, qx, qy);
      kind[k] = kd; zip[k] = zi;
    }
  }
  // ground in no ZIP: the ocean near the coast; inland, land or a river channel (see above)
  if (unzoned.length) {
    const sea = seaNear(world, frame, half + SEA_REACH);
    const channel = sea ? null : riverChannels(world, frame, half + 1500);
    for (let u = 0; u < unzoned.length; u += 3) kind[unzoned[u]] = sea ? GROUND.OCEAN : channel(unzoned[u + 1], unzoned[u + 2]) ? GROUND.LAKE : GROUND.LAND;
  }
  for (let k = 0; k < kind.length; k++) {
    const kd = kind[k];
    if (kd === GROUND.LAND) land++;
    else if (kd === GROUND.LAKE) { wat++; lake = true; } else if (kd === GROUND.OCEAN) { wat++; ocean = true; }
  }
  const idx = (x, y) => {
    const i = Math.floor((x + half) / cell), j = Math.floor((y + half) / cell);
    if (i < 0 || j < 0 || i >= n || j >= n) return -1;
    return j * n + i;
  };
  return {
    cell, n, R: half, kind, zip, zips: counts,
    landShare: land / (n * n), waterShare: wat / (n * n), hasOcean: ocean, hasLake: lake,
    /** ground kind at a local point (OCEAN when outside the grid) */
    at(x, y) { const k = idx(x, y); return k < 0 ? GROUND.OCEAN : kind[k]; },
    /** ZIP index at a local point, -1 for water */
    zipAt(x, y) { const k = idx(x, y); return k < 0 ? -1 : zip[k]; },
    /** true when the point is land in California */
    isLand(x, y) { const k = idx(x, y); return k >= 0 && kind[k] === GROUND.LAND; },
  };
}

/** A ground sample not yet classified: in no ZIP, no water polygon and no neighboring state. */
const UNZONED = 255;
/** How far beyond a view the sea is looked for (meters). */
const SEA_REACH = 2500;
/** River channels: at most this half-width (meters), and at least this long for their width (area / (pi r^2)). */
const CHANNEL_HALF_WIDTH = 600, CHANNEL_ELONGATION = 2;

const WATER = new WeakMap(), NEIGHBORS = new WeakMap(), OUTLINE = new WeakMap(), ROADLINES = new WeakMap();
function withBBox(rings) { rings.bbox = bboxRings(rings); return rings; }
function bboxRings(rings) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const r of rings) for (let i = 0; i < r.length; i += 2) { x0 = Math.min(x0, r[i]); x1 = Math.max(x1, r[i]); y0 = Math.min(y0, r[i + 1]); y1 = Math.max(y1, r[i + 1]); }
  return [x0, y0, x1, y1];
}
function waterCache(world) { let w = WATER.get(world); if (!w) { w = world.waterRings().map(withBBox); WATER.set(world, w); } return w; }
function neighborCache(world) { let w = NEIGHBORS.get(world); if (!w) { w = Object.values(world.neighborRings()).map(withBBox); NEIGHBORS.set(world, w); } return w; }
function outlineCache(world) { let w = OUTLINE.get(world); if (!w) { w = withBBox(world.outlineRings()); OUTLINE.set(world, w); } return w; }
/** The state highways as flat polylines with boxes (world units). */
function roadLines(world) {
  let w = ROADLINES.get(world);
  if (!w) {
    w = [];
    for (const rd of world.roads || []) for (const line of rd.lines) {
      if (!line || line.length < 2) continue;
      const pts = new Float64Array(line.length * 2);
      line.forEach((p, i) => { pts[2 * i] = p[0]; pts[2 * i + 1] = p[1]; });
      w.push({ pts, bbox: bboxOf(pts) });
    }
    ROADLINES.set(world, w);
  }
  return w;
}
const inBox = (x, y, b) => x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3];

/**
 * Scanline fill: set `value` in the cells of an n x n grid (cell meters, centered on the frame, half size ext)
 * whose centers lie inside each shape of `shapes` (rings with a bbox, even-odd within a shape).
 */
function fillRows(grid, value, shapes, frame, ext, cell, n) {
  const xs = [];
  for (let j = 0; j < n; j++) {
    const wy = frame.cy + (-ext + (j + 0.5) * cell) / frame.fy;
    for (const rings of shapes) {
      const bb = rings.bbox;
      if (!bb || wy < bb[1] || wy > bb[3]) continue;
      xs.length = 0;
      for (const r of rings) {
        const m = r.length / 2;
        for (let a = 0, b = m - 1; a < m; b = a++) {
          const ya = r[2 * a + 1], yb = r[2 * b + 1];
          if ((ya > wy) !== (yb > wy)) xs.push(r[2 * a] + (wy - ya) * (r[2 * b] - r[2 * a]) / (yb - ya));
        }
      }
      if (xs.length < 2) continue;
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const l0 = (xs[k] - frame.cx) * frame.fx, l1 = (xs[k + 1] - frame.cx) * frame.fx;
        const c0 = Math.max(0, Math.ceil((l0 + ext) / cell - 0.5)), c1 = Math.min(n - 1, Math.floor((l1 + ext) / cell - 0.5));
        for (let c = c0; c <= c1; c++) grid[j * n + c] = value;
      }
    }
  }
}

/**
 * True when open sea lies within `reach` meters of the frame's center: a probe point beyond the state's outline
 * that is in no ZIP and no neighboring state. The outline is far coarser than the ZIP outlines (about a vertex
 * a kilometer), too coarse to draw a shore with, but enough to tell a coastal view from an inland one.
 * @param {object} world
 * @param {Frame} frame
 * @param {number} reach meters
 */
export function seaNear(world, frame, reach) {
  const outline = outlineCache(world), states = neighborCache(world);
  for (const r of [0, 0.5, 0.75, 1]) {
    const rays = r ? 24 : 1;
    for (let k = 0; k < rays; k++) {
      const a = k / rays * 2 * Math.PI, p = frame.toWorld(Math.cos(a) * r * reach, Math.sin(a) * r * reach);
      if (world.zipAt(p.x, p.y) >= 0) continue;
      if (inBox(p.x, p.y, outline.bbox) && pointInRings(p.x, p.y, outline)) continue;
      let state = false;
      for (const f of states) if (inBox(p.x, p.y, f.bbox) && pointInRings(p.x, p.y, f)) { state = true; break; }
      if (!state) return true;
    }
  }
  return false;
}

/**
 * Which ground in no ZIP is a river channel, for an inland view: the ground of a window `ext` meters around the
 * frame's center is sampled every `cell` meters; each connected stretch of unzoned ground is a channel when it
 * is thin (no point farther than CHANNEL_HALF_WIDTH from ZIP land), elongated, open-ended (it runs out of the
 * window or into mapped water) and not a state highway's right of way (a highway running along inside it for
 * much more than a crossing). Everything else in no ZIP is land: desert, forest, parks, campuses, rail yards.
 * @returns {(lx: number, ly: number) => boolean} true at local points (meters) on a channel
 */
export function riverChannels(world, frame, ext, cell = 25) {
  const n = Math.ceil(2 * ext / cell);
  const w0 = frame.toWorld(-ext, -ext), w1 = frame.toWorld(ext, ext);
  const box = [Math.min(w0.x, w1.x), Math.min(w0.y, w1.y), Math.max(w0.x, w1.x), Math.max(w0.y, w1.y)];
  const overlaps = bb => bb[0] <= box[2] && bb[2] >= box[0] && bb[1] <= box[3] && bb[3] >= box[1];
  const zips = [];
  for (let i = 0; i < world.N; i++) { const bb = world.zipBBox(i); if (bb && overlaps(bb)) zips.push(world.zipRings(i)); }
  const waters = waterCache(world).filter(w => overlaps(w.bbox)), states = neighborCache(world).filter(f => overlaps(f.bbox));
  // 0 ZIP land, 1 unzoned, 2 mapped water or another state; filled row by row in the order groundGrid decides
  // (a water polygon over a ZIP is water, a ZIP over a neighbor's outline is California)
  const U = new Uint8Array(n * n).fill(1);
  fillRows(U, 2, states, frame, ext, cell, n);
  fillRows(U, 0, zips, frame, ext, cell, n);
  fillRows(U, 2, waters, frame, ext, cell, n);
  // distance from every cell to the nearest ZIP land (two-pass chamfer)
  const D = new Float32Array(n * n);
  for (let k = 0; k < D.length; k++) D[k] = U[k] === 0 ? 0 : 1e9;
  const a = cell, b = cell * Math.SQRT2;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = j * n + i; let d = D[k]; if (!d) continue;
    if (i > 0) d = Math.min(d, D[k - 1] + a);
    if (j > 0) { d = Math.min(d, D[k - n] + a); if (i > 0) d = Math.min(d, D[k - n - 1] + b); if (i < n - 1) d = Math.min(d, D[k - n + 1] + b); }
    D[k] = d;
  }
  for (let j = n - 1; j >= 0; j--) for (let i = n - 1; i >= 0; i--) {
    const k = j * n + i; let d = D[k]; if (!d) continue;
    if (i < n - 1) d = Math.min(d, D[k + 1] + a);
    if (j < n - 1) { d = Math.min(d, D[k + n] + a); if (i < n - 1) d = Math.min(d, D[k + n + 1] + b); if (i > 0) d = Math.min(d, D[k + n - 1] + b); }
    D[k] = d;
  }
  // the highways' length inside each cell of unzoned ground
  const hw = new Float32Array(n * n);
  const roads = roadLines(world).filter(r => overlaps(r.bbox));
  const loc = {};
  for (const r of roads) {
    for (let s = 0; s + 3 < r.pts.length; s += 2) {
      const pa = frame.toLocal(r.pts[s], r.pts[s + 1]), pb = frame.toLocal(r.pts[s + 2], r.pts[s + 3]);
      const L = Math.hypot(pb.x - pa.x, pb.y - pa.y), steps = Math.ceil(L / (cell / 2));
      for (let q = 0; q < steps; q++) {
        const u = (q + 0.5) / steps;
        loc.x = pa.x + (pb.x - pa.x) * u; loc.y = pa.y + (pb.y - pa.y) * u;
        const i = Math.floor((loc.x + ext) / cell), j = Math.floor((loc.y + ext) / cell);
        if (i >= 0 && j >= 0 && i < n && j < n) hw[j * n + i] += L / steps;
      }
    }
  }
  // connected stretches of unzoned ground, judged whole
  const comp = new Int32Array(n * n).fill(-1), isChannel = [];
  const stack = [];
  for (let s = 0; s < U.length; s++) {
    if (U[s] !== 1 || comp[s] >= 0) continue;
    const id = isChannel.length;
    let area = 0, rmax = 0, open = false, hwLen = 0;
    comp[s] = id; stack.push(s);
    while (stack.length) {
      const k = stack.pop(), i = k % n, j = (k - i) / n;
      area++; if (D[k] > rmax) rmax = D[k]; hwLen += hw[k];
      if (i === 0 || j === 0 || i === n - 1 || j === n - 1) open = true;
      for (const q of [i > 0 ? k - 1 : -1, i < n - 1 ? k + 1 : -1, j > 0 ? k - n : -1, j < n - 1 ? k + n : -1]) {
        if (q < 0) continue;
        if (U[q] === 2) open = true;
        else if (U[q] === 1 && comp[q] < 0) { comp[q] = id; stack.push(q); }
      }
    }
    const areaM2 = area * cell * cell;
    isChannel.push(open && rmax <= CHANNEL_HALF_WIDTH && areaM2 >= CHANNEL_ELONGATION * Math.PI * rmax * rmax && hwLen < 6 * Math.max(rmax, cell));
  }
  return (lx, ly) => {
    const i = Math.floor((lx + ext) / cell), j = Math.floor((ly + ext) / cell);
    if (i < 0 || j < 0 || i >= n || j >= n) return false;
    // a fine sample just off its coarse stretch (shores do not line up cell for cell) takes the nearest one
    for (const [di, dj] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ii = i + di, jj = j + dj;
      if (ii < 0 || jj < 0 || ii >= n || jj >= n) continue;
      const c = comp[jj * n + ii];
      if (c >= 0) return isChannel[c];
    }
    return false;
  };
}

/**
 * Shore outlines of a ground grid: closed or open polylines (local meters) around every water region, traced
 * by marching squares on the cell centers and smoothed. Each comes with the kind of water it bounds.
 * @returns {{pts: Float64Array, kind: number, closed: boolean}[]}
 */
export function waterOutlines(grid) {
  const { n, cell, kind, R } = grid;
  const W = n + 2;
  // padded binary field: 1 = water of the kind we trace (we trace both water kinds together, then label)
  // the field is padded with land so every water region is enclosed by a closed outline (the part of the
  // outline running through the padding lies outside the view and is clipped away when drawn)
  const isWater = (i, j) => { if (i < 0 || j < 0 || i >= n || j >= n) return 0; const k = kind[j * n + i]; return k === GROUND.OCEAN || k === GROUND.LAKE ? 1 : 0; };
  const field = new Int8Array(W * W);
  for (let j = -1; j <= n; j++) for (let i = -1; i <= n; i++) field[(j + 1) * W + (i + 1)] = isWater(i, j);
  // marching squares segments on the dual grid; vertices at edge midpoints, keyed for chaining
  const segs = new Map();
  const key = (x2, y2) => x2 * 100003 + y2;
  const addSeg = (ax, ay, bx, by) => {
    const ka = key(ax, ay), kb = key(bx, by);
    (segs.get(ka) || segs.set(ka, []).get(ka)).push(kb);
    (segs.get(kb) || segs.set(kb, []).get(kb)).push(ka);
  };
  for (let j = 0; j < W - 1; j++) for (let i = 0; i < W - 1; i++) {
    const a = field[j * W + i], b = field[j * W + i + 1], c = field[(j + 1) * W + i + 1], d = field[(j + 1) * W + i];
    const code = a | (b << 1) | (c << 2) | (d << 3);
    if (code === 0 || code === 15) continue;
    // midpoints in doubled coordinates: top (2i+1, 2j), right (2i+2, 2j+1), bottom (2i+1, 2j+2), left (2i, 2j+1)
    const T = [2 * i + 1, 2 * j], Rr = [2 * i + 2, 2 * j + 1], B = [2 * i + 1, 2 * j + 2], L = [2 * i, 2 * j + 1];
    const s = (p, q) => addSeg(p[0], p[1], q[0], q[1]);
    switch (code) {
      case 1: case 14: s(L, T); break;
      case 2: case 13: s(T, Rr); break;
      case 3: case 12: s(L, Rr); break;
      case 4: case 11: s(Rr, B); break;
      case 6: case 9: s(T, B); break;
      case 7: case 8: s(L, B); break;
      case 5: s(L, T); s(Rr, B); break;
      case 10: s(T, Rr); s(L, B); break;
    }
  }
  const used = new Set();
  const out = [];
  const toLocal = k => { const x2 = Math.floor(k / 100003 + 1e-9), y2 = k - x2 * 100003; return [(x2 / 2 - 1 + 0.5) * cell - R, (y2 / 2 - 1 + 0.5) * cell - R]; };
  const ekey = (a, b) => a < b ? a + ':' + b : b + ':' + a;
  for (const [start, nbrs] of segs) {
    for (const first of nbrs) {
      if (used.has(ekey(start, first))) continue;
      const chain = [start];
      let prev = start, cur = first;
      used.add(ekey(prev, cur));
      while (cur !== start) {
        chain.push(cur);
        const nx = (segs.get(cur) || []).find(q => q !== prev && !used.has(ekey(cur, q)));
        if (nx === undefined) break;
        used.add(ekey(cur, nx)); prev = cur; cur = nx;
      }
      const closed = cur === start;
      if (chain.length < 3) continue;
      const flat = [];
      for (const k of chain) { const p = toLocal(k); flat.push(p[0], p[1]); }
      // label by the water cell next to the middle of the line
      const mid = Math.floor(chain.length / 2), mp = toLocal(chain[mid]);
      let wk = GROUND.OCEAN;
      for (const [dx, dy] of [[cell, 0], [-cell, 0], [0, cell], [0, -cell]]) { const g = grid.at(mp[0] + dx * 0.6, mp[1] + dy * 0.6); if (g === GROUND.LAKE || g === GROUND.OCEAN) { wk = g; break; } }
      const smooth = closed ? chaikinClosed(Float64Array.from(flat), 3) : chaikin(Float64Array.from(flat), 3);
      out.push({ pts: smooth, kind: wk, closed });
    }
  }
  return out;
}

// ---------------------------------------------------------------- terrain

/**
 * A smooth heightfield for the view (meters above the view's mean), with relief scaled from the ZIP's
 * elevation range to the size of the view, and its slope. Used for winding roads and hillshade. The field is
 * anchored at the lattice offset (ox, oy) so overlapping views of one ZIP share their hills.
 * @param {number} seed
 * @param {number} relief peak-to-trough meters across the view
 * @param {number} [ox] lattice offset x (local + ox = anchored)
 * @param {number} [oy] lattice offset y
 * @returns {{h:(x:number,y:number)=>number, grad:(x:number,y:number)=>[number,number], relief:number}}
 */
export function terrain(seed, relief, ox = 0, oy = 0) {
  const f = fbm(hash2(seed, 0x7e44), 4, 0.5);
  const wl = 700;
  const h = (x, y) => f((x + ox) / wl + 31.7, (y + oy) / wl - 12.9) * relief * 0.9;
  const grad = (x, y) => { const e = 6; return [(h(x + e, y) - h(x - e, y)) / (2 * e), (h(x, y + e) - h(x, y - e)) / (2 * e)]; };
  return { h, grad, relief };
}

// ---------------------------------------------------------------- the sun

const RAD = Math.PI / 180;

/**
 * Solar position for epoch ms t at a latitude and longitude (degrees): the NOAA low-precision algorithm, good
 * to a few hundredths of a degree. Azimuth is clockwise from north.
 * @returns {{elevation:number, azimuth:number, declination:number}} degrees
 */
export function sunPosition(t, lat, lon) {
  const jd = t / 86400000 + 2440587.5;
  const n = jd - 2451545.0;
  const L = ((280.460 + 0.9856474 * n) % 360 + 360) % 360;
  const g = (((357.528 + 0.9856003 * n) % 360 + 360) % 360) * RAD;
  const lambda = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * RAD;
  const eps = (23.439 - 0.0000004 * n) * RAD;
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda));
  const dec = Math.asin(Math.sin(eps) * Math.sin(lambda));
  const gmst = ((18.697374558 + 24.06570982441908 * n) % 24 + 24) % 24;
  const ha = ((gmst * 15 + lon) * RAD - ra);
  const phi = lat * RAD;
  const sinEl = Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(ha);
  const el = Math.asin(clamp(sinEl, -1, 1));
  const az = Math.atan2(-Math.sin(ha), Math.tan(dec) * Math.cos(phi) - Math.sin(phi) * Math.cos(ha));
  return { elevation: el / RAD, azimuth: ((az / RAD) % 360 + 360) % 360, declination: dec / RAD };
}

/**
 * Lighting from the sun's elevation: `night` 0 (day) … 1 (full night) through civil twilight, `golden` for the
 * low warm sun, and a sky tint for the overlay.
 * @returns {{night:number, golden:number, twilight:number, elevation:number, azimuth:number}}
 */
export function lightAt(t, lat, lon) {
  const s = sunPosition(t, lat, lon);
  const e = s.elevation;
  const night = clamp((4 - e) / 12, 0, 1);              // 0 above 4 degrees, 1 below -8 (nautical dusk)
  const golden = e > -2 && e < 10 ? 1 - Math.abs(e - 3) / 8 : 0;
  const twilight = e > -9 && e < 2 ? 1 - Math.abs(e + 3.5) / 5.5 : 0;
  return { night, golden: clamp(golden, 0, 1), twilight: clamp(twilight, 0, 1), elevation: e, azimuth: s.azimuth };
}

// ---------------------------------------------------------------- weather words

/**
 * Read an NWS weather object (world.weatherAt) into rendering terms: rain and snow intensity 0..1, fog 0..1,
 * cloud cover 0..1, smoke haze 0..1 (fire weather), wind strength 0..1.
 */
export function weatherEffects(wx) {
  const now = (wx && wx.now) || {};
  const s = String(now.short || '').toLowerCase();
  const pop = Number.isFinite(now.pop) ? now.pop / 100 : null;
  let rain = 0, snow = 0, fog = 0, cloud = 0, smoke = 0;
  const rainy = /rain|shower|drizzle|thunder|storm/.test(s);
  if (rainy) {
    rain = /heavy|thunder/.test(s) ? 0.95 : /drizzle|light|slight|sprinkle/.test(s) ? 0.38 : /chance/.test(s) ? 0.5 : 0.7;
    if (/likely/.test(s)) rain = Math.max(rain, 0.7);
    if (pop !== null && /chance|slight/.test(s)) rain *= clamp(pop * 1.4, 0.4, 1);
  }
  if (/snow|flurr|sleet|blizzard/.test(s)) snow = /heavy|blizzard/.test(s) ? 0.95 : /light|chance|slight|flurr/.test(s) ? 0.4 : 0.7;
  if (/fog/.test(s)) fog = /dense/.test(s) ? 0.85 : /patchy|areas/.test(s) ? 0.45 : 0.65;
  else if (/mist|haze/.test(s)) fog = 0.25;
  if (/smoke/.test(s)) smoke = 0.6;
  if (/overcast|cloudy/.test(s)) cloud = /mostly/.test(s) ? 0.65 : /partly/.test(s) ? 0.35 : 0.85;
  else if (/partly sunny|partly clear/.test(s)) cloud = 0.35;
  if (rain || snow) cloud = Math.max(cloud, 0.8);
  const level = (wx && wx.fireWeather && wx.fireWeather.level) || 0;
  if (level >= 1) smoke = Math.max(smoke, clamp(0.25 + 0.2 * level, 0, 0.85));
  const windMph = parseInt(String(now.wind || '').replace(/[^0-9 ]/g, ' ').trim().split(/\s+/).pop(), 10);
  const wind = Number.isFinite(windMph) ? clamp(windMph / 35, 0, 1) : 0.15;
  return { rain, snow, fog, cloud, smoke, wind, short: now.short || '', tempF: now.tempF, fireLevel: level };
}
