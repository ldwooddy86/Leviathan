// Legion · the procedural street network.
//
// When OpenStreetMap is off (the default) the street view draws a plausible neighborhood from the ZIP's data:
//   * era (yb_med): pre-1945 cores get tight grids with alleys and the odd diagonal avenue; 1945-1979 tracts get
//     long blocks on a half-mile arterial grid, gentle curves and the first cul-de-sacs; post-1980 subdivisions get
//     curvy parkways around superblocks, a collector loop or spine, cul-de-sacs and pods for parks, schools,
//     apartment complexes and shopping centers;
//   * density (from the households whose homes are actually in view): block sizes adapt, and land without
//     homes keeps only its through roads;
//   * terrain (elev_max_m - elev_m, scaled to the view): roads wind in the hills; rural roads follow valleys;
//   * flat valley farmland gets section-line county roads; a rural view's town gets a small grid core;
//   * the state highways of the pack (Caltrans count lines) run through as freeways or highways;
//   * water (bays, lakes, the ocean) cuts streets, with bridges only for major roads over narrow water.
// Every lattice is anchored to the ZIP's town point and every choice is a hash of the ZIP and lattice indices,
// so the same place always gets the same streets and names, whichever point of it the view is opened on.

import { hash2, hash3, clamp, lerp, smoothstep } from '../engine/rng.mjs';
import { resample, chaikin, simplify, cumLengths, pointAt, hf, fbm, pointSegDist, clipToSquare } from './street-geo.mjs';
import { createNamer } from './street-names.mjs';

// ---------------------------------------------------------------- setup

/**
 * Era style from the median year built: 'grid' (before 1945), 'tract' (1945-1979) or 'curvi' (1980 on).
 * @param {number} yb median year built
 */
export function eraStyle(yb) {
  if (!(yb > 0)) return 'tract';
  return yb < 1945 ? 'grid' : yb < 1980 ? 'tract' : 'curvi';
}

/** Lattice transforms for a rotation theta in the ZIP-anchored frame. */
function lattice(ctx, theta) {
  const c = Math.cos(theta), s = Math.sin(theta), ox = ctx.frame.ox, oy = ctx.frame.oy;
  const toL = (x, y) => { const qx = x + ox, qy = y + oy; return [qx * c + qy * s, -qx * s + qy * c]; };
  const toP = (u, v) => [u * c - v * s - ox, u * s + v * c - oy];
  const G = ctx.G;
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (const [x, y] of [[-G, -G], [G, -G], [G, G], [-G, G]]) { const [u, v] = toL(x, y); u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
  return { toL, toP, u0, u1, v0, v1, theta };
}

/** Indices k with phase + k*step inside [lo, hi]. */
function steps(lo, hi, phase, step) {
  const out = [];
  for (let k = Math.ceil((lo - phase) / step); phase + k * step <= hi; k++) out.push(k);
  return out;
}

const mod = (a, n) => ((a % n) + n) % n;

/** Polyline from lattice points through `toP`, densified. */
function latLine(L, pts, spacing = 20) {
  const flat = [];
  for (const [u, v] of pts) { const [x, y] = L.toP(u, v); flat.push(x, y); }
  return spacing ? resample(Float64Array.from(flat), spacing) : Float64Array.from(flat);
}

/** Displace a polyline by the view's terrain warp (anchored so overlapping views agree). */
function warped(ctx, pts, scale = 1) {
  const amp = ctx.warpAmp * scale;
  if (!(amp > 0.5)) return pts;
  const p = resample(pts, 14);
  const out = new Float64Array(p.length);
  for (let i = 0; i < p.length; i += 2) {
    const [dx, dy] = ctx.warpVec(p[i], p[i + 1]);
    out[i] = p[i] + dx * amp; out[i + 1] = p[i + 1] + dy * amp;
  }
  return out;
}

/** Tracks accepted streets so new ones keep their distance (cul-de-sacs, curvy locals). */
class StreetSpace {
  constructor(cell = 20) { this.cell = cell; this.map = new Map(); this.areas = []; }
  key(x, y) { return Math.floor(x / this.cell) * 65536 + Math.floor(y / this.cell); }
  add(pts, id) {
    const p = resample(pts, 8);
    for (let i = 0; i < p.length; i += 2) { const k = this.key(p[i], p[i + 1]); let b = this.map.get(k); if (!b) this.map.set(k, b = []); b.push(p[i], p[i + 1], id); }
  }
  /** Reserve a polygon area (flat ring) that streets must stay out of. */
  reserve(ring, pad = 0) { this.areas.push({ ring, pad, bb: bbox(ring, pad) }); }
  /** True when an accepted street (other than ids `ignore` and `ignore2`) passes within r of (x, y). */
  near(x, y, r, ignore = -1, ignore2 = -1) {
    const c = this.cell, n = Math.ceil(r / c);
    const cx = Math.floor(x / c), cy = Math.floor(y / c);
    for (let i = cx - n; i <= cx + n; i++) for (let j = cy - n; j <= cy + n; j++) {
      const b = this.map.get(i * 65536 + j); if (!b) continue;
      for (let q = 0; q < b.length; q += 3) { const id = b[q + 2]; if (id !== ignore && id !== ignore2 && Math.hypot(b[q] - x, b[q + 1] - y) < r) return true; }
    }
    return false;
  }
  /** Nearest stored street point within r: {x, y, id, d} or null. */
  nearest(x, y, r) {
    const c = this.cell, n = Math.ceil(r / c);
    const cx = Math.floor(x / c), cy = Math.floor(y / c);
    let best = null, bd = r;
    for (let i = cx - n; i <= cx + n; i++) for (let j = cy - n; j <= cy + n; j++) {
      const b = this.map.get(i * 65536 + j); if (!b) continue;
      for (let q = 0; q < b.length; q += 3) { const d = Math.hypot(b[q] - x, b[q + 1] - y); if (d < bd) { bd = d; best = { x: b[q], y: b[q + 1], id: b[q + 2], d }; } }
    }
    return best;
  }
  inReserved(x, y) {
    for (const a of this.areas) {
      if (x < a.bb[0] || x > a.bb[2] || y < a.bb[1] || y > a.bb[3]) continue;
      if (pointInFlat(x, y, a.ring) || (a.pad > 0 && distToRing(x, y, a.ring) < a.pad)) return true;
    }
    return false;
  }
  /**
   * The longest prefix of a candidate street (from its attachment point) that keeps `gap` meters from other
   * streets (ignoring the one it attaches to near its start) and stays out of reserved areas.
   */
  clearPrefix(pts, gap, attachId, startFree = 30, siblingId = -1) {
    const p = resample(pts, 6), cum = cumLengths(p);
    const free = Math.max(startFree, gap * 1.25);
    let last = 0;
    for (let i = 0; i < p.length; i += 2) {
      const s = cum[i / 2];
      const x = p[i], y = p[i + 1];
      if (this.inReserved(x, y)) break;
      // near its start a stub is necessarily close to the street it hangs from (and to a sibling stub leaving
      // the same point on the other side); every other street still counts
      if (s > 8 && (s <= free ? this.near(x, y, gap, attachId, siblingId) : this.near(x, y, gap))) break;
      last = s;
    }
    return last;
  }
}

function bbox(r, pad = 0) { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (let i = 0; i < r.length; i += 2) { x0 = Math.min(x0, r[i]); x1 = Math.max(x1, r[i]); y0 = Math.min(y0, r[i + 1]); y1 = Math.max(y1, r[i + 1]); } return [x0 - pad, y0 - pad, x1 + pad, y1 + pad]; }
function pointInFlat(x, y, r) { let ins = false; const n = r.length / 2; for (let i = 0, j = n - 1; i < n; j = i++) { const xi = r[2 * i], yi = r[2 * i + 1], xj = r[2 * j], yj = r[2 * j + 1]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-12) + xi) ins = !ins; } return ins; }
function distToRing(x, y, r) { let d = Infinity; const n = r.length / 2; for (let i = 0, j = n - 1; i < n; j = i++) d = Math.min(d, pointSegDist(x, y, r[2 * j], r[2 * j + 1], r[2 * i], r[2 * i + 1]).d); return d; }

/** Truncate a polyline to its first `len` meters. */
function prefix(pts, len) {
  const cum = cumLengths(pts), out = [pts[0], pts[1]];
  for (let i = 1; i < cum.length; i++) {
    if (cum[i] <= len) out.push(pts[2 * i], pts[2 * i + 1]);
    else { const p = pointAt(pts, cum, len, {}); out.push(p.x, p.y); break; }
  }
  return Float64Array.from(out);
}

/** A curved stub from (x,y) heading (dx,dy), bending by `bend` radians over `len` meters. */
function stub(x, y, dx, dy, len, bend, step = 8) {
  const out = [x, y];
  const n = Math.max(2, Math.ceil(len / step));
  let ang = Math.atan2(dy, dx), px = x, py = y;
  const dAng = bend / n;
  for (let i = 0; i < n; i++) { ang += dAng; px += Math.cos(ang) * len / n; py += Math.sin(ang) * len / n; out.push(px, py); }
  return Float64Array.from(out);
}

/** A rectangle ring from lattice corners. */
function latRect(L, u0, v0, u1, v1) {
  const pts = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
  const out = [];
  for (const [u, v] of pts) { const [x, y] = L.toP(u, v); out.push(x, y); }
  return Float64Array.from(out);
}

// ---------------------------------------------------------------- the generator

/**
 * Generate the street strokes of a view.
 * @param {object} ctx scene context: world, zi (style ZIP), z (its row), frame, R, G (generation half size),
 *   style ('grid'|'tract'|'curvi'), mode ('urban'|'rural'), ground, devAt(x,y) households per hectare,
 *   devThreshold, devPeak {x,y,value}, warpAmp, warpVec(x,y), terrain, scale, needs {school, park, ...}
 * @returns {{strokes: object[], areas: object[], namer: object}}
 */
export function generateStrokes(ctx) {
  const namer = createNamer(ctx.world, ctx.zi, ctx.mode === 'rural' ? 'rural' : ctx.style);
  ctx.namer = namer;
  ctx.areas = [];
  let strokes;
  if (ctx.mode === 'urban') strokes = ctx.style === 'grid' ? gridStrokes(ctx) : ctx.style === 'tract' ? tractStrokes(ctx) : curviStrokes(ctx);
  else strokes = ruralStrokes(ctx);
  const hw = highwayStrokes(ctx);
  strokes = dropNearHighways(strokes, hw);
  strokes = pruneUndeveloped(ctx, strokes);
  strokes.push(...hw);
  strokes = splitByLand(ctx, strokes);
  return { strokes, areas: ctx.areas, namer };
}

// ---------------------------------------------------------------- pre-war grid

function gridStrokes(ctx) {
  const zs = ctx.zseed, namer = ctx.namer, out = [];
  const L = lattice(ctx, ctx.theta);
  const short = lerp(82, 104, hf(zs, 11)) * ctx.scale, long = lerp(165, 228, hf(zs, 12)) * ctx.scale;
  const longAlongV = hf(zs, 13) < 0.5;
  const su = longAlongV ? short : long, sv = longAlongV ? long : short;
  const pu = hf(zs, 14) * su, pv = hf(zs, 15) * sv;
  const nu = Math.max(2, Math.round(lerp(300, 460, hf(zs, 16)) / su)), nv = Math.max(2, Math.round(lerp(420, 700, hf(zs, 17)) / sv));
  const au = Math.floor(hf(zs, 18) * nu), av = Math.floor(hf(zs, 19) * nv);
  const ks = steps(L.u0 - su, L.u1 + su, pu, su), ms = steps(L.v0 - sv, L.v1 + sv, pv, sv);
  const oneWayShare = ctx.density > 20000 ? 0.3 : ctx.density > 9000 ? 0.12 : 0;
  // special blocks: parks and school campuses, placed by hash at the data's rate per km2
  const blockKm2 = su * sv / 1e6;
  const pPark = clamp(ctx.parkDensity * blockKm2, 0, 0.2), pSchool = clamp(ctx.schoolDensity * blockKm2, 0, 0.25);
  const special = new Map();
  for (const k of ks) for (const m of ms) {
    const h = hash3(zs, k * 7 + 1, m * 13 + 2);
    if (hf(h, 1) < pSchool) special.set(k + ':' + m, 'school');
    else if (hf(h, 2) < pPark) special.set(k + ':' + m, 'park');
  }
  for (const [key, kind] of special) {
    const [k, m] = key.split(':').map(Number);
    const ring = latRect(L, pu + k * su, pv + m * sv, pu + (k + 1) * su, pv + (m + 1) * sv);
    ctx.areas.push({ kind, ring, block: true, name: kind === 'park' ? parkName(ctx, hash3(zs, k, m)) : schoolName(ctx, hash3(zs, k, m)) });
  }
  for (const k of ks) {
    const art = mod(k - au, nu) === 0;
    const cls = art ? 'arterial' : 'local';
    const oneway = !art && hf(hash2(zs, k * 3 + 1), 5) < oneWayShare;
    const pts = latLine(L, [[pu + k * su, L.v0 - 20], [pu + k * su, L.v1 + 20]], ctx.warpAmp > 0.5 ? 20 : 0);
    const flip = oneway && (k & 1);
    out.push({ pts: warped(ctx, flip ? reverse(pts) : pts, 0.35), cls, name: namer.line('u', k, cls), lanes: art ? 2 : oneway ? 2 : 1, oneway, park: true, axis: 'u', index: k });
  }
  for (const m of ms) {
    const art = mod(m - av, nv) === 0;
    const cls = art ? 'arterial' : 'local';
    const oneway = !art && hf(hash2(zs, m * 3 + 2), 6) < oneWayShare;
    const pts = latLine(L, [[L.u0 - 20, pv + m * sv], [L.u1 + 20, pv + m * sv]], ctx.warpAmp > 0.5 ? 20 : 0);
    const flip = oneway && (m & 1);
    out.push({ pts: warped(ctx, flip ? reverse(pts) : pts, 0.35), cls, name: namer.line('v', m, cls), lanes: art ? 2 : oneway ? 2 : 1, oneway, park: true, axis: 'v', index: m });
  }
  // alleys run mid-block along the blocks' long axis
  if (ctx.alleyShare > 0) {
    for (const k of ks) for (const m of ms) {
      if (special.has(k + ':' + m)) continue;
      const h = hash3(zs, k * 31 + 5, m * 17 + 3);
      if (hf(h, 3) >= ctx.alleyShare) continue;
      const a = longAlongV
        ? [[pu + (k + 0.5) * su, pv + m * sv], [pu + (k + 0.5) * su, pv + (m + 1) * sv]]
        : [[pu + k * su, pv + (m + 0.5) * sv], [pu + (k + 1) * su, pv + (m + 0.5) * sv]];
      out.push({ pts: warped(ctx, latLine(L, a, 12), 0.35), cls: 'alley', name: namer.alley(h), lanes: 1, kind: 'alley' });
    }
  }
  // the odd diagonal avenue that predates the grid (a mission road, a rail right-of-way turned boulevard)
  if (hf(zs, 21) < 0.3) {
    const ang = (hf(zs, 22) < 0.5 ? 1 : -1) * lerp(28, 52, hf(zs, 23)) * Math.PI / 180;
    const cu = pu + Math.round(hf(zs, 24) * 6 - 3) * su, cv = pv + Math.round(hf(zs, 25) * 6 - 3) * sv;
    const far = 6000, du = Math.cos(ang), dv = Math.sin(ang);
    const pts = latLine(L, [[cu - du * far, cv - dv * far], [cu + du * far, cv + dv * far]], 0);
    const clipped = clipLineToBox(pts, ctx.G + 40);
    if (clipped) out.push({ pts: warped(ctx, resample(clipped, 20), 0.35), cls: 'arterial', name: namer.street(hash2(zs, 77), 'arterial'), lanes: 2, park: true });
  }
  return out;
}

const reverse = p => { const n = p.length / 2, o = new Float64Array(p.length); for (let i = 0; i < n; i++) { o[2 * i] = p[2 * (n - 1 - i)]; o[2 * i + 1] = p[2 * (n - 1 - i) + 1]; } return o; };

function clipLineToBox(pts, G) {
  // keep the part of a 2-point line inside |x|,|y| <= G
  const [x0, y0, x1, y1] = pts;
  let t0 = 0, t1 = 1; const dx = x1 - x0, dy = y1 - y0;
  for (const [p, q] of [[-dx, x0 + G], [dx, G - x0], [-dy, y0 + G], [dy, G - y0]]) {
    if (p === 0) { if (q < 0) return null; continue; }
    const r = q / p; if (p < 0) t0 = Math.max(t0, r); else t1 = Math.min(t1, r);
  }
  if (t1 <= t0) return null;
  return Float64Array.from([x0 + t0 * dx, y0 + t0 * dy, x0 + t1 * dx, y0 + t1 * dy]);
}

// ---------------------------------------------------------------- postwar tract

function tractStrokes(ctx) {
  const zs = ctx.zseed, namer = ctx.namer, out = [];
  const L = lattice(ctx, ctx.theta);
  const S = lerp(760, 880, hf(zs, 31));
  const pu = hf(zs, 32) * S, pv = hf(zs, 33) * S;
  const is = steps(L.u0 - S, L.u1 + S, pu, S), js = steps(L.v0 - S, L.v1 + S, pv, S);
  for (const i of is) out.push({ pts: warped(ctx, latLine(L, [[pu + i * S, L.v0 - 30], [pu + i * S, L.v1 + 30]])), cls: 'arterial', name: namer.line('u', i, 'arterial'), lanes: 2, park: true, axis: 'u', index: i });
  for (const j of js) out.push({ pts: warped(ctx, latLine(L, [[L.u0 - 30, pv + j * S], [L.u1 + 30, pv + j * S]])), cls: 'arterial', name: namer.line('v', j, 'arterial'), lanes: 2, park: true, axis: 'v', index: j });
  const era = ctx.yb;
  const pCurved = clamp((era - 1952) / 22, 0, 0.75), pDeep = clamp((era - 1958) / 20, 0, 0.55);
  for (const i of is) for (const j of js) {
    const ua = pu + i * S, ub = ua + S, va = pv + j * S, vb = va + S;
    if (ub < L.u0 || ua > L.u1 || vb < L.v0 || va > L.v1) continue;
    const h = hash3(zs, i * 101 + 7, j * 59 + 3);
    superblockTract(ctx, L, out, { ua, ub, va, vb, h, i, j, pCurved, pDeep });
  }
  return out;
}

function superblockTract(ctx, L, out, sb) {
  const { ua, ub, va, vb, h } = sb;
  const namer = ctx.namer;
  const orientU = hf(h, 1) < 0.5;                     // locals run along u
  const ds = lerp(80, 96, hf(h, 2)) * Math.min(ctx.scale, 1.2), cs = lerp(210, 300, hf(h, 3)) * Math.min(ctx.scale, 1.12);
  const curved = hf(h, 4) < sb.pCurved, deep = hf(h, 5) < sb.pDeep;
  const [a0, a1] = orientU ? [ua, ub] : [va, vb];      // along
  const [c0, c1] = orientU ? [va, vb] : [ua, ub];      // across
  const A = curved ? lerp(14, 36, hf(h, 6)) * (hf(h, 7) < 0.5 ? 1 : -1) : 0;
  const bend = (a, c) => A * Math.sin(Math.PI * (a - a0) / (a1 - a0)) * smoothstep(c0, c0 + ds * 0.9, c) * smoothstep(c1, c1 - ds * 0.9, c);
  const toUV = (a, c) => orientU ? [a, c + bend(a, c)] : [c + bend(a, c), a];
  const line = (pts) => warped(ctx, latLine(L, pts.map(([a, c]) => toUV(a, c)), 0));
  const seg = (aFrom, aTo, c, n = 24) => { const p = []; for (let k = 0; k <= n; k++) { const a = aFrom + (aTo - aFrom) * k / n; p.push([a, c]); } return p; };
  const segC = (a, cFrom, cTo, n = 16) => { const p = []; for (let k = 0; k <= n; k++) { const c = cFrom + (cTo - cFrom) * k / n; p.push([a, c]); } return p; };
  // parks and schools: a whole block's worth at one end of the superblock, at the data's rate per km2
  const sbKm2 = (a1 - a0) * (c1 - c0) / 1e6;
  const hasSchool = hf(h, 20) < clamp(ctx.schoolDensity * sbKm2, 0, 0.9);
  const hasPark = hf(h, 21) < clamp(ctx.parkDensity * sbKm2, 0, 0.9);
  // parallel locals
  const width = c1 - c0;
  const n = Math.max(1, Math.floor((width - 1.1 * ds) / ds));
  const start = c0 + (width - (n - 1) * ds) / 2;
  const offs = [];
  for (let q = 0; q < n; q++) offs.push(start + q * ds);
  const skipped = new Set();
  if (deep) for (let q = 1; q < n - 1; q += 3) skipped.add(q);
  let id = 0;
  const pre = [];
  offs.forEach((c, q) => {
    if (skipped.has(q)) return;
    const nm = namer.street(hash3(h, 1, q), 'local');
    pre.push({ q, c, stroke: { pts: line(seg(a0 - 2, a1 + 2, c)), cls: 'local', name: nm, lanes: 1, park: true, id: id++ } });
  });
  for (const p of pre) out.push(p.stroke);
  // cross streets every cs along, spanning arterial to arterial or just between some locals
  const nx = Math.max(1, Math.floor((a1 - a0) / cs));
  const step = (a1 - a0) / (nx + 1);
  for (let r = 1; r <= nx; r++) {
    const a = a0 + r * step + (hf(h, 30 + r) - 0.5) * step * 0.25;
    const full = r === Math.ceil(nx / 2) || hf(h, 40 + r) < 0.55;
    const cFrom = full ? c0 - 2 : (pre[0] ? pre[0].c : c0), cTo = full ? c1 + 2 : (pre[pre.length - 1] ? pre[pre.length - 1].c : c1);
    if (cTo - cFrom < 30) continue;
    out.push({ pts: line(segC(a, cFrom, cTo)), cls: 'local', name: ctx.namer.street(hash3(h, 2, r), 'local'), lanes: 1, park: true });
  }
  // deep blocks: cul-de-sacs from the neighboring locals into the double-depth block
  if (deep) for (const q of skipped) {
    const cMid = offs[q];
    const sideUp = pre.find(p => p.q === q - 1), sideDn = pre.find(p => p.q === q + 1);
    const span = (a1 - a0), k = Math.floor(span / 68);
    for (let r = 1; r < k; r++) {
      const a = a0 + r * span / k;
      const fromUp = (r % 2) === 0;
      const src = fromUp ? sideUp : sideDn;
      if (!src) continue;
      const cEnd = cMid + (fromUp ? 1 : -1) * ds * 0.45;
      const pts = line(segC(a, src.c, cEnd, 6));
      out.push({ pts, cls: 'local', name: ctx.namer.street(hash3(h, 3, r * 7 + q), 'local', 'culdesac'), lanes: 1, park: false, kind: 'culdesac' });
    }
  }
  if (hasSchool || hasPark) {
    // the block between the arterial and the first local at one end, a few hundred meters long
    const len = Math.min(a1 - a0 - 40, hasSchool ? 260 : 200);
    const atStart = hf(h, 22) < 0.5;
    const aS = atStart ? a0 + 12 : a1 - 12 - len, aE = aS + len;
    const cA = c0 + 14, cB = offs[0] !== undefined ? offs[0] - 14 : c0 + ds - 14;
    if (cB - cA > 40) {
      const ring = [];
      for (const [a, c] of [[aS, cA], [aE, cA], [aE, cB], [aS, cB]]) { const [u, v] = toUV(a, c); const [x, y] = L.toP(u, v); ring.push(x, y); }
      const kind = hasSchool ? 'school' : 'park';
      ctx.areas.push({ kind, ring: Float64Array.from(ring), name: kind === 'park' ? parkName(ctx, h) : schoolName(ctx, h) });
    }
  }
}

// ---------------------------------------------------------------- post-1980 subdivision

function curviStrokes(ctx) {
  const zs = ctx.zseed, namer = ctx.namer, out = [];
  const L = lattice(ctx, ctx.theta);
  const S = lerp(1050, 1380, hf(zs, 41));
  const pu = hf(zs, 42) * S, pv = hf(zs, 43) * S;
  const is = steps(L.u0 - S, L.u1 + S, pu, S), js = steps(L.v0 - S, L.v1 + S, pv, S);
  const curveAmp = lerp(25, 60, hf(zs, 44));
  const artNoise = fbm(hash2(zs, 45), 2, 0.5);
  // the parkways bend gently along their length; the bend is a function of the lattice coordinate so it is stable
  const artLine = (axis, val, idx) => {
    const pts = [];
    const lo = axis === 'u' ? L.v0 - 60 : L.u0 - 60, hi = axis === 'u' ? L.v1 + 60 : L.u1 + 60;
    for (let t = lo; t <= hi + 1e-9; t += 20) {
      const off = artNoise(t / 900, idx * 3.7 + (axis === 'u' ? 0 : 50)) * curveAmp;
      pts.push(axis === 'u' ? [val + off, t] : [t, val + off]);
    }
    return pts;
  };
  const artOff = (axis, idx, t) => artNoise(t / 900, idx * 3.7 + (axis === 'u' ? 0 : 50)) * curveAmp;
  for (const i of is) out.push({ pts: warped(ctx, latLine(L, artLine('u', pu + i * S, i), 0)), cls: 'arterial', name: namer.line('u', i, 'arterial'), lanes: 3, median: 6, park: false, parkway: 2.5, sidewalk: 2, axis: 'u', index: i });
  for (const j of js) out.push({ pts: warped(ctx, latLine(L, artLine('v', pv + j * S, j), 0)), cls: 'arterial', name: namer.line('v', j, 'arterial'), lanes: 3, median: 6, park: false, parkway: 2.5, sidewalk: 2, axis: 'v', index: j });
  const space = new StreetSpace(20);
  out.forEach((s, k) => space.add(s.pts, 1000 + k));
  for (const i of is) for (const j of js) {
    const ua = pu + i * S, ub = ua + S, va = pv + j * S, vb = va + S;
    if (ub < L.u0 - 100 || ua > L.u1 + 100 || vb < L.v0 - 100 || va > L.v1 + 100) continue;
    const h = hash3(zs, i * 103 + 11, j * 61 + 5);
    superblockCurvi(ctx, L, out, space, { ua, ub, va, vb, h, i, j, artOff, S });
  }
  return out;
}

function superblockCurvi(ctx, L, out, space, sb) {
  const { ua, ub, va, vb, h, S } = sb;
  const namer = ctx.namer;
  // the superblock's inner edge follows the bent parkways
  const b = 48;
  const uL = v => ua + sb.artOff('u', sb.i, v) + b, uR = v => ub + sb.artOff('u', sb.i + 1, v) - b;
  const vT = u => va + sb.artOff('v', sb.j, u) + b, vB = u => vb + sb.artOff('v', sb.j + 1, u) - b;
  const cu = (ua + ub) / 2, cv = (va + vb) / 2;
  const P = (u, v) => { const [x, y] = L.toP(u, v); return [x, y]; };
  const flat = arr => { const o = []; for (const [u, v] of arr) { const [x, y] = P(u, v); o.push(x, y); } return Float64Array.from(o); };
  const W = ctx.warpAmp > 0.5 ? (p => warped(ctx, p)) : (p => p);
  // pods in the corners: a shopping center and an apartment complex where the data asks for them
  const sbKm2 = S * S / 1e6;
  const pods = [];
  const corners = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const order = corners.slice().sort((p, q) => hf(h, 60 + p[0] * 2 + p[1]) - hf(h, 60 + q[0] * 2 + q[1]));
  const podSize = lerp(170, 240, hf(h, 64));
  const wantShop = hf(h, 65) < clamp(ctx.shopPodDensity * sbKm2, 0, 0.95);
  const wantApt = hf(h, 66) < clamp(ctx.aptPodDensity * sbKm2, 0, 0.95);
  const wantMh = hf(h, 67) < clamp(ctx.mhPodDensity * sbKm2, 0, 0.9);
  const kinds = [];
  if (wantShop) kinds.push('commercial');
  if (wantApt) kinds.push('apartments');
  if (wantMh) kinds.push('mhpark');
  kinds.forEach((kind, k) => {
    const [cx, cy] = order[k];
    const u0 = cx ? ub - b - podSize : ua + b, v0 = cy ? vb - b - podSize : va + b;
    const ring = flat([[u0, v0], [u0 + podSize, v0], [u0 + podSize, v0 + podSize], [u0, v0 + podSize]]);
    pods.push({ kind, ring });
    ctx.areas.push({ kind, ring, pod: true, name: kind === 'commercial' ? centerName(ctx, h) : kind === 'mhpark' ? mhName(ctx, h) : aptName(ctx, h) });
    space.reserve(ring, 18);
  });
  // a park and a school in the core, at the data's rates
  const hasSchool = hf(h, 70) < clamp(ctx.schoolDensity * sbKm2, 0, 0.95);
  const hasPark = hf(h, 71) < clamp(ctx.parkDensity * sbKm2 * 1.2, 0, 0.95);
  const loop = hf(h, 72) < 0.62;
  const coreR = S * lerp(0.13, 0.17, hf(h, 73));
  const coreAreas = [];
  if (hasPark || hasSchool) {
    const kinds2 = []; if (hasSchool) kinds2.push('school'); if (hasPark) kinds2.push('park');
    kinds2.forEach((kind, k) => {
      const off = kinds2.length === 2 ? (k === 0 ? -1 : 1) * coreR * 0.55 : 0;
      const hu = coreR * (kinds2.length === 2 ? 0.48 : 0.75), hv = coreR * 0.7;
      const u0 = cu + off - hu, u1 = cu + off + hu, v0 = cv - hv, v1 = cv + hv;
      const ring = flat([[u0, v0], [u1, v0], [u1, v1], [u0, v1]]);
      coreAreas.push(ring);
      ctx.areas.push({ kind, ring, name: kind === 'park' ? parkName(ctx, h) : schoolName(ctx, h) });
    });
  }
  let collector = null;
  const colName = namer.street(hash2(h, 9), 'collector');
  if (loop) {
    // a rounded-rectangle loop inside the superblock, joined to each parkway by an entry street
    const du = (ub - ua) / 2 - b - lerp(150, 210, hf(h, 74)), dv = (vb - va) / 2 - b - lerp(150, 210, hf(h, 75));
    const pw = 3.2, pts = [];
    const wob = fbm(hash2(h, 76), 2, 0.5);
    for (let k = 0; k <= 96; k++) {
      const t = k / 96 * Math.PI * 2;
      const c = Math.cos(t), s = Math.sin(t);
      const ex = Math.sign(c) * Math.pow(Math.abs(c), 2 / pw), ey = Math.sign(s) * Math.pow(Math.abs(s), 2 / pw);
      const r = 1 + wob(Math.cos(t) * 1.3, Math.sin(t) * 1.3) * 0.08;
      pts.push([cu + ex * du * r, cv + ey * dv * r]);
    }
    pts[pts.length - 1] = pts[0];
    collector = { pts: W(flat(pts)), cls: 'collector', name: colName, lanes: 1, park: false, sidewalk: 1.8, parkway: 1.5, kind: 'loop' };
    out.push(collector);
    space.add(collector.pts, 1);
    // entries from the loop to the parkways (two to four, at mid-sides)
    const sides = [['u0', [cu - du, cv], [uL(cv) - b + 4, cv]], ['u1', [cu + du, cv], [uR(cv) + b - 4, cv]], ['v0', [cu, cv - dv], [cu, vT(cu) - b + 4]], ['v1', [cu, cv + dv], [cu, vB(cu) + b - 4]]];
    const nEnt = 2 + Math.floor(hf(h, 77) * 3);
    const chosen = sides.slice().sort((p, q) => hf(h, 80 + p[0].charCodeAt(1)) - hf(h, 80 + q[0].charCodeAt(1))).slice(0, nEnt);
    for (const [, from, to] of chosen) {
      const e = { pts: W(flat([from, [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2], to])), cls: 'collector', name: colName, lanes: 1, park: false, sidewalk: 1.8, parkway: 1.5 };
      out.push(e); space.add(e.pts, 2);
    }
  } else {
    // a spine collector winding from one parkway to the opposite one
    const alongU = hf(h, 78) < 0.5;
    const pts = [];
    const lat = lerp(-0.18, 0.18, hf(h, 79)) * S, lat2 = lerp(-0.18, 0.18, hf(h, 81)) * S;
    for (let k = 0; k <= 40; k++) {
      const t = k / 40;
      const off = (1 - t) * (1 - t) * 0 + 2 * t * (1 - t) * lat * 1.2 + t * t * 0 + Math.sin(t * Math.PI * 2) * lat2 * 0.35;
      if (alongU) pts.push([ua + 4 + (ub - ua - 8) * t, cv + off]);
      else pts.push([cu + off, va + 4 + (vb - va - 8) * t]);
    }
    collector = { pts: W(flat(pts)), cls: 'collector', name: colName, lanes: 1, park: false, sidewalk: 1.8, parkway: 1.5, kind: 'spine' };
    out.push(collector); space.add(collector.pts, 1);
  }
  for (const ring of coreAreas) space.reserve(ring, 16);
  // cul-de-sacs and loop streets off the collector, both sides, every ~90 m
  const cp = resample(collector.pts, 4), cum = cumLengths(cp), Ltot = cum[cum.length - 1];
  const spacing = lerp(74, 88, hf(h, 82)) * clamp(ctx.scale, 0.9, 1.3);
  let k = 0;
  const p = {};
  for (let s = spacing * 0.7; s < Ltot - spacing * 0.4; s += spacing, k++) {
    pointAt(cp, cum, s, p);
    const nx = -p.ty, ny = p.tx;
    const sib = 100000 + k;                       // both stubs leaving this point share an id
    for (const side of [1, -1]) {
      const hh = hash3(h, k, side + 5);
      if (hf(hh, 1) < 0.1) continue;
      const bendAng = (hf(hh, 2) - 0.5) * 0.9;
      const maxLen = lerp(110, 190, hf(hh, 3));
      const cand = stub(p.x, p.y, nx * side, ny * side, maxLen, bendAng);
      let len = space.clearPrefix(cand, 52, 1, 26, sib);
      if (len < 50) continue;
      // keep the end off the parkway strip: we stop short of the superblock edge by a lot depth
      len = Math.min(len, maxLen) - 6;
      const pts = prefix(cand, len);
      const isLoop = hf(hh, 4) < 0.18 && len > 90;
      if (isLoop) {
        // a U-shaped loop street returning to the collector a little further along
        const back = [];
        const ex = pts[pts.length - 2], ey = pts[pts.length - 1];
        const ang = Math.atan2(ny * side, nx * side);
        const ux = Math.cos(ang), uy = Math.sin(ang);
        const ahead = Math.min(spacing * 0.8, 70);
        back.push(ex, ey, ex + p.tx * ahead * 0.5 + ux * 10, ey + p.ty * ahead * 0.5 + uy * 10, ex + p.tx * ahead, ey + p.ty * ahead);
        const ret = stub(ex + p.tx * ahead, ey + p.ty * ahead, -ux, -uy, len, -bendAng * 0.6);
        const full = Float64Array.from([...pts, ...back.slice(2), ...ret.slice(2)]);
        const total = chaikin(full, 2);
        const ok = space.clearPrefix(total, 40, 1, 26, sib) > polyLengthOf(total) - 30;
        if (ok) { const e = { pts: total, cls: 'local', name: namer.street(hash2(hh, 5), 'local', 'loop'), lanes: 1, park: false, kind: 'loop' }; out.push(e); space.add(total, sib); continue; }
      }
      const e = { pts, cls: 'local', name: namer.street(hash2(hh, 6), 'local', 'culdesac'), lanes: 1, park: false, kind: 'culdesac' };
      out.push(e); space.add(pts, sib);
      // a second tier: short courts branching off long cul-de-sacs
      if (len > 140 && hf(hh, 7) < 0.45) {
        const q = pointAt(pts, cumLengths(pts), len * 0.55, {});
        const sgn = hf(hh, 8) < 0.5 ? 1 : -1;
        const c2 = stub(q.x, q.y, -q.ty * sgn, q.tx * sgn, 90, (hf(hh, 9) - 0.5) * 0.6);
        const l2 = space.clearPrefix(c2, 48, sib, 20);
        if (l2 > 45) { const pts2 = prefix(c2, l2 - 4); out.push({ pts: pts2, cls: 'local', name: namer.street(hash2(hh, 10), 'local', 'culdesac'), lanes: 1, park: false, kind: 'culdesac' }); space.add(pts2, 200000 + k * 2 + (side > 0 ? 1 : 0)); }
      }
    }
  }
  // whatever the loop and its cul-de-sacs left empty gets courts from the nearest street
  const cand = [];
  const G = ctx.G;
  for (let u = ua + b + 20; u < ub - b - 20; u += 34) for (let v = va + b + 20; v < vb - b - 20; v += 34) {
    const [x, y] = P(u, v);
    if (Math.abs(x) < G && Math.abs(y) < G) cand.push([x, y]);
  }
  fillGaps(ctx, out, space, cand, hash2(h, 0x6a9));
}

function polyLengthOf(p) { const c = cumLengths(p); return c[c.length - 1]; }

/**
 * Fill streetless gaps: for candidate points farther than `gap` from every street (and outside reserved pods
 * and parks), run a cul-de-sac from the nearest street toward them. Candidates come in a seeded shuffle so the
 * result is deterministic without favoring one direction.
 */
function fillGaps(ctx, out, space, points, seed, { gap = 72, reach = 260 } = {}) {
  const order = points.map((p, i) => [hf(seed, i * 7 + 1), p]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
  let n = 0;
  for (const [x, y] of order) {
    if (space.inReserved(x, y) || space.near(x, y, gap)) continue;
    if (ctx.devAt && ctx.devAt(x, y) < ctx.devThreshold * 0.8) continue;
    const q = space.nearest(x, y, reach);
    if (!q || q.d < 20) continue;
    const dx = (x - q.x) / q.d, dy = (y - q.y) / q.d;
    const hh = hash3(seed, Math.round(x), Math.round(y));
    const c = stub(q.x, q.y, dx, dy, Math.min(230, q.d + 30), (hf(hh, 1) - 0.5) * 0.7);
    const len = space.clearPrefix(c, 46, q.id, 22, -1);
    if (len < 48) continue;
    const pts = prefix(c, len - 4);
    out.push({ pts, cls: 'local', name: ctx.namer.street(hash2(hh, 2), 'local', 'culdesac'), lanes: 1, park: false, kind: 'culdesac' });
    space.add(pts, 300000 + n++);
  }
}

// ---------------------------------------------------------------- rural roads and the town core

function ruralStrokes(ctx) {
  const zs = ctx.zseed, out = [], G = ctx.G;
  const flat = ctx.reliefPerKm < 30;
  const valleyFarm = flat && (ctx.z.regionKey === 'sv' || ctx.z.regionKey === 'sj' || ctx.z.regionKey === 'ie' || ctx.z.cz >= 11 && ctx.z.cz <= 15);
  const peak = ctx.devPeak && ctx.devPeak.value >= ctx.devThreshold ? ctx.devPeak : null;
  if (valleyFarm) {
    // section-line county roads (the public land survey's mile grid), sometimes with half-mile roads
    const L = lattice(ctx, (hf(zs, 91) - 0.5) * 0.06);
    const sp = hf(zs, 92) < 0.35 ? 805 : 1609;
    const pu = hf(zs, 93) * sp, pv = hf(zs, 94) * sp;
    for (const k of steps(L.u0 - 10, L.u1 + 10, pu, sp)) out.push({ pts: latLine(L, [[pu + k * sp, L.v0 - 20], [pu + k * sp, L.v1 + 20]]), cls: 'rural', name: ctx.namer.rural(hash2(zs, k), 'u', k), lanes: 1 });
    for (const m of steps(L.v0 - 10, L.v1 + 10, pv, sp)) out.push({ pts: latLine(L, [[L.u0 - 20, pv + m * sp], [L.u1 + 20, pv + m * sp]]), cls: 'rural', name: ctx.namer.rural(hash2(zs, m + 999), 'v', m), lanes: 1 });
    if (peak || out.length === 0) {
      // the road into town (or the one road across an empty square mile)
      const c = peak || { x: 0, y: 0 };
      const ang = ctx.theta;
      const pts = Float64Array.from([c.x - Math.cos(ang) * G * 2, c.y - Math.sin(ang) * G * 2, c.x + Math.cos(ang) * G * 2, c.y + Math.sin(ang) * G * 2]);
      const cl = clipLineToBox(pts, G + 30);
      if (cl) out.push({ pts: resample(cl, 20), cls: 'rural', name: ctx.namer.rural(hash2(zs, 555)), lanes: 1 });
    }
  } else {
    // valley roads: least-cost paths over the terrain between points on the view's edge, through town
    const net = valleyRoads(ctx, peak);
    out.push(...net);
  }
  if (peak) out.push(...townCore(ctx, peak, out));
  return out;
}

/** Points on the generation square's boundary from a side index and a fraction. */
function edgePoint(G, side, f) {
  const t = -G + 2 * G * f;
  return side === 0 ? [-G, t] : side === 1 ? [G, t] : side === 2 ? [t, -G] : [t, G];
}

function valleyRoads(ctx, peak) {
  const zs = ctx.zseed, G = ctx.G + 40;
  const cell = 25, n = Math.ceil(2 * G / cell) + 1;
  const T = ctx.terrain;
  const rough = fbm(hash2(zs, 0x77), 2, 0.5);
  const cost = new Float64Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = -G + i * cell, y = -G + j * cell;
    const [gx, gy] = T.grad(x, y);
    const slope = Math.hypot(gx, gy);
    const water = ctx.ground.isLand(x, y) ? 0 : 40;
    cost[j * n + i] = 1 + 140 * slope * slope + 3 * slope + water + 0.25 * (rough(x / 300, y / 300) + 1) + T.h(x, y) / Math.max(30, T.relief) * 0.6;
  }
  const toCell = (x, y) => [clamp(Math.round((x + G) / cell), 0, n - 1), clamp(Math.round((y + G) / cell), 0, n - 1)];
  const cellKey = (x, y) => { const [i, j] = toCell(x, y); return j * n + i; };
  const lcp = (from, targets) => {
    const dist = new Float64Array(n * n).fill(Infinity), prev = new Int32Array(n * n).fill(-1);
    const heap = [];
    const push = (d, k) => { heap.push([d, k]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= d) break; [heap[i], heap[p]] = [heap[p], heap[i]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { let c = 2 * i + 1; if (c >= heap.length) break; if (c + 1 < heap.length && heap[c + 1][0] < heap[c][0]) c++; if (heap[c][0] >= heap[i][0]) break; [heap[i], heap[c]] = [heap[c], heap[i]]; i = c; } } return top; };
    const [fi, fj] = toCell(from[0], from[1]);
    dist[fj * n + fi] = 0; push(0, fj * n + fi);
    let hit = -1;
    while (heap.length) {
      const [d, k] = pop();
      if (d > dist[k]) continue;
      if (targets.has(k)) { hit = k; break; }
      const i = k % n, j = (k - i) / n;
      for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
        if (!di && !dj) continue;
        const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= n || jj >= n) continue;
        const kk = jj * n + ii, step = (di && dj ? 1.4142 : 1) * cell;
        const nd = d + step * (cost[k] + cost[kk]) / 2;
        if (nd < dist[kk]) { dist[kk] = nd; prev[kk] = k; push(nd, kk); }
      }
    }
    if (hit < 0) return null;
    const path = [];
    for (let k = hit; k >= 0; k = prev[k]) path.push(-G + (k % n) * cell, -G + Math.floor(k / n) * cell);
    const flatPath = [];
    for (let i = path.length - 2; i >= 0; i -= 2) flatPath.push(path[i], path[i + 1]);
    return Float64Array.from(flatPath);
  };
  const cellsOf = (pts) => { const s = new Set(); const p = resample(pts, cell / 2); for (let i = 0; i < p.length; i += 2) { const [ci, cj] = toCell(p[i], p[i + 1]); s.add(cj * n + ci); } return s; };
  const out = [];
  const sideA = Math.floor(hf(zs, 101) * 4), sideB = sideA ^ 1;
  const a = edgePoint(G, sideA, lerp(0.2, 0.8, hf(zs, 102))), bpt = edgePoint(G, sideB, lerp(0.2, 0.8, hf(zs, 103)));
  const smooth = p => chaikin(simplify(p, 6), 3);
  let main;
  if (peak) {
    // through town: edge to the town center, then the town center to the far edge
    const p1 = lcp(a, new Set([cellKey(peak.x, peak.y)]));
    const [pi, pj] = toCell(peak.x, peak.y);
    const p2 = lcp([-G + pi * cell, -G + pj * cell], new Set([cellKey(bpt[0], bpt[1])]));
    if (p1 && p2) main = Float64Array.from([...p1, ...p2.slice(2)]);
  }
  if (!main) main = lcp(a, new Set([cellKey(bpt[0], bpt[1])]));
  if (main) out.push({ pts: smooth(main), cls: 'rural', name: ctx.namer.rural(hash2(zs, 201)), lanes: 1 });
  // one or two branch roads from other sides, joining the main road
  const branches = 1 + (hf(zs, 104) < 0.55 ? 1 : 0);
  let targets = main ? cellsOf(main) : new Set();
  for (let r = 0; r < branches && targets.size; r++) {
    const side = r === 0 ? (sideA < 2 ? 2 + Math.floor(hf(zs, 105) * 2) : Math.floor(hf(zs, 105) * 2)) : (sideA < 2 ? 5 - (2 + Math.floor(hf(zs, 105) * 2)) : 1 - Math.floor(hf(zs, 105) * 2));
    const from = edgePoint(G, side, lerp(0.25, 0.75, hf(zs, 106 + r)));
    const br = lcp(from, targets);
    if (br && br.length >= 6) {
      const s = snapEndTo(smooth(br), out);
      out.push({ pts: s, cls: 'rural', name: ctx.namer.rural(hash2(zs, 210 + r)), lanes: 1 });
      targets = new Set([...targets, ...cellsOf(s)]);
    }
  }
  return out;
}

/** Move a polyline's last point onto the nearest point of other strokes (within 80 m) so the two join. */
function snapEndTo(pts, strokes) {
  const n = pts.length / 2, x = pts[2 * n - 2], y = pts[2 * n - 1];
  let best = null, bd = 80;
  for (const st of strokes) {
    const p = st.pts;
    for (let i = 0; i + 3 < p.length; i += 2) { const q = pointSegDist(x, y, p[i], p[i + 1], p[i + 2], p[i + 3]); if (q.d < bd) { bd = q.d; best = q; } }
  }
  if (!best) return pts;
  const out = Float64Array.from(pts);
  out[2 * n - 2] = best.x; out[2 * n - 1] = best.y;
  return out;
}

/** A small-town core: a short grid around the density peak, aligned with the road through town. */
function townCore(ctx, peak, roads) {
  const zs = ctx.zseed;
  // align with the nearest road
  let best = null, bd = Infinity;
  for (const r of roads) {
    const p = r.pts;
    for (let i = 0; i + 3 < p.length; i += 2) { const q = pointSegDist(peak.x, peak.y, p[i], p[i + 1], p[i + 2], p[i + 3]); if (q.d < bd) { bd = q.d; best = { x: q.x, y: q.y, ang: Math.atan2(p[i + 3] - p[i + 1], p[i + 2] - p[i]) }; } }
  }
  const ang = best ? best.ang : ctx.theta;
  const cx = best && bd < 250 ? best.x : peak.x, cy = best && bd < 250 ? best.y : peak.y;
  const c = Math.cos(ang), s = Math.sin(ang);
  const su = lerp(95, 125, hf(zs, 121)), sv = lerp(85, 110, hf(zs, 122));
  const ext = 900;
  const out = [];
  const old = ctx.yb < 1960;
  for (let k = -9; k <= 9; k++) {
    // streets parallel to the main road, offset u across it (the main road itself is k = 0)
    const u = k * su;
    if (k === 0 && best && bd < 250) continue;
    const xa = cx - s * u + c * -ext, ya = cy + c * u + s * -ext, xb = cx - s * u + c * ext, yb = cy + c * u + s * ext;
    out.push({ pts: warped(ctx, resample(Float64Array.from([xa, ya, xb, yb]), 20), 0.5), cls: 'local', name: ctx.namer.line('v', k, 'local'), lanes: 1, park: true, town: true });
  }
  for (let m = -9; m <= 9; m++) {
    const v = m * sv;
    const xa = cx + c * v - s * -ext, ya = cy + s * v + c * -ext, xb = cx + c * v - s * ext, yb = cy + s * v + c * ext;
    out.push({ pts: warped(ctx, resample(Float64Array.from([xa, ya, xb, yb]), 20), 0.5), cls: 'local', name: ctx.namer.line('u', m, 'local'), lanes: 1, park: true, town: true });
  }
  if (old && ctx.alleyShare > 0) {
    for (let k = -8; k <= 8; k++) for (let m = -8; m <= 8; m++) {
      if (hf(hash3(zs, k, m), 7) > ctx.alleyShare * 0.7) continue;
      const u = (k + 0.5) * su, v0 = m * sv, v1 = (m + 1) * sv;
      const xa = cx + c * v0 - s * u, ya = cy + s * v0 + c * u, xb = cx + c * v1 - s * u, yb = cy + s * v1 + c * u;
      out.push({ pts: resample(Float64Array.from([xa, ya, xb, yb]), 12), cls: 'alley', name: 'Alley', lanes: 1, town: true });
    }
  }
  ctx.town = { x: cx, y: cy, ang };
  return out;
}

// ---------------------------------------------------------------- state highways

function highwayStrokes(ctx) {
  const world = ctx.world, frame = ctx.frame, G = ctx.G + 200;
  const w0 = frame.toWorld(-G, -G), w1 = frame.toWorld(G, G);
  const bx0 = Math.min(w0.x, w1.x), bx1 = Math.max(w0.x, w1.x), by0 = Math.min(w0.y, w1.y), by1 = Math.max(w0.y, w1.y);
  const out = [];
  for (const rd of world.roads) {
    for (const line of rd.lines) {
      if (line.length < 2) continue;
      let touches = false;
      for (let k = 0; k + 1 < line.length && !touches; k++) {
        const [xa, ya] = line[k], [xb, yb] = line[k + 1];
        if (Math.max(xa, xb) >= bx0 && Math.min(xa, xb) <= bx1 && Math.max(ya, yb) >= by0 && Math.min(ya, yb) <= by1) touches = true;
      }
      if (!touches) continue;
      const pts = [];
      let aadt = 0, bd = Infinity;
      for (const p of line) {
        const q = frame.toLocal(p[0], p[1]); pts.push(q.x, q.y);
        // AADT of the count point nearest the view
        const d = Math.hypot(q.x, q.y); if (d < bd) { bd = d; aadt = (p[2] || 0) * 1000; }
      }
      const freeway = rd.kind === 'I' || (rd.kind === 'US' && aadt >= 45000) || (rd.kind === 'SR' && aadt >= 85000);
      const lanes = freeway ? clamp(Math.round(aadt / 45000) + 2, 2, 5) : aadt >= 18000 ? 2 : 1;
      // only the stretch near the view matters; smooth the count-point polyline into a road line
      for (const piece of clipToSquare(Float64Array.from(pts), G + 600)) {
        const smooth = piece.pts.length >= 6 ? chaikin(piece.pts, 3) : piece.pts;
        for (const near of clipToSquare(resample(smooth, 25), G)) {
          out.push({
            pts: near.pts, cls: freeway ? 'freeway' : 'highway', name: ctx.namer.highway(rd), route: rd.name, lanes,
            median: freeway ? 10 : 0, nocross: freeway, aadt, highway: rd.name, park: false,
          });
        }
      }
    }
  }
  return out;
}

/** Drop generated arterial and rural strokes that would duplicate a highway running alongside them. */
function dropNearHighways(strokes, hw) {
  if (!hw.length) return strokes;
  const near = (x, y, r) => hw.some(h => { const p = h.pts; for (let i = 0; i + 3 < p.length; i += 2) if (pointSegDist(x, y, p[i], p[i + 1], p[i + 2], p[i + 3]).d < r) return true; return false; });
  const out = [];
  for (const s of strokes) {
    if (s.cls !== 'arterial' && s.cls !== 'rural') { out.push(s); continue; }
    const p = resample(s.pts, 30);
    let close = 0, n = 0;
    for (let i = 0; i < p.length; i += 2) { n++; if (near(p[i], p[i + 1], 60)) close++; }
    if (n && close / n > 0.45) continue;
    out.push(s);
  }
  return out;
}

// ---------------------------------------------------------------- development and water

/**
 * Keep minor streets only where people live: a stroke is cut where the household density of the view falls
 * below the development threshold (with some slack), leaving the through roads to cross open land.
 */
function pruneUndeveloped(ctx, strokes) {
  if (!ctx.devAt) return strokes;
  const thr = ctx.devThreshold * 0.7, out = [];
  for (const s of strokes) {
    if (s.cls === 'arterial' || s.cls === 'rural' || s.cls === 'highway' || s.cls === 'freeway') { out.push(s); continue; }
    const p = resample(s.pts, 10);
    let run = [];
    const flush = () => { if (run.length >= 10 && polyLengthOf(Float64Array.from(run)) >= 45) out.push(Object.assign({}, s, { pts: Float64Array.from(run) })); run = []; };
    for (let i = 0; i < p.length; i += 2) {
      if (ctx.devAt(p[i], p[i + 1]) >= thr) run.push(p[i], p[i + 1]);
      else flush();
    }
    flush();
  }
  return out;
}

/**
 * Cut strokes where they would run into water. Major roads may bridge narrow water (under 90 m) between two
 * land runs; everything else stops at the shore.
 */
function splitByLand(ctx, strokes) {
  const g = ctx.ground;
  if (!g || g.landShare > 0.999) return strokes;
  const out = [];
  for (const s of strokes) {
    const p = resample(s.pts, 5);
    const n = p.length / 2;
    const land = new Uint8Array(n);
    for (let i = 0; i < n; i++) land[i] = g.isLand(p[2 * i], p[2 * i + 1]) ? 1 : 0;
    const major = s.cls === 'freeway' || s.cls === 'highway' || s.cls === 'arterial';
    if (major) {
      // fill short water gaps flanked by land
      let i = 0;
      while (i < n) {
        if (land[i]) { i++; continue; }
        let j = i; while (j < n && !land[j]) j++;
        const gap = (j - i) * 5;
        if (i > 0 && j < n && (gap <= 90 || s.cls === 'freeway')) for (let k = i; k < j; k++) land[k] = 2;
        i = j;
      }
    }
    let run = [], bridge = false;
    const flush = () => { if (run.length >= 6 && polyLengthOf(Float64Array.from(run)) >= 20) out.push(Object.assign({}, s, { pts: Float64Array.from(run), bridge: bridge || s.bridge })); run = []; bridge = false; };
    for (let i = 0; i < n; i++) {
      if (land[i]) { run.push(p[2 * i], p[2 * i + 1]); if (land[i] === 2) bridge = true; }
      else flush();
    }
    flush();
  }
  return out;
}

// ---------------------------------------------------------------- names of places

const PARK_WORDS = ['Park', 'Park', 'Playground', 'Commons', 'Green', 'Community Park', 'Recreation Center'];
const SCHOOL_WORDS = ['Elementary School', 'Elementary School', 'Middle School', 'Elementary School', 'High School', 'K-8 School'];

/** A park's name from the namer's pools ("Sycamore Park", "Las Flores Playground"). */
function parkName(ctx, h) { return `${placeStem(ctx, hash2(h, 0x9a), 'Neighborhood')} ${PARK_WORDS[h % PARK_WORDS.length]}`; }
/** A school's name from the namer's pools ("Laurel Elementary School"). */
function schoolName(ctx, h) { return `${placeStem(ctx, hash2(h, 0x5c), 'Valley')} ${SCHOOL_WORDS[h % SCHOOL_WORDS.length]}`; }
/** A shopping center's name ("Valencia Plaza"). */
function centerName(ctx, h) { return `${placeStem(ctx, hash2(h, 0xce), 'Village')} ${['Plaza', 'Village Center', 'Marketplace', 'Shopping Center', 'Square'][h % 5]}`; }
/** An apartment complex's name ("Silverbrook Apartments"). */
function aptName(ctx, h) { return `${placeStem(ctx, hash2(h, 0xa7), 'Park')} ${['Apartments', 'Apartment Homes', 'Villas', 'Court', 'Commons'][h % 5]}`; }
/** A mobile-home park's name ("Oak Knoll Mobile Estates"). */
function mhName(ctx, h) { return `${placeStem(ctx, hash2(h, 0x3f), 'Valley')} ${['Mobile Estates', 'Mobile Home Park', 'Village', 'Manufactured Home Community'][h % 4]}`; }
/** The stem of a place's name from the namer (no street suffix to strip), or a plain word without one. */
function placeStem(ctx, h, fallback) { return (ctx.namer && ctx.namer.place(h)) || fallback; }

export { parkName, schoolName };
