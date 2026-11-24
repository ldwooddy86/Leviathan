// Legion · crowd agents: the per-person buffers the GPU crowd draws (pure: runs in a Worker and in Node).
//
// buildAgents walks the ZIPs region by region, takes the households pop.includes(zi, h, rate) selects and
// writes one agent per member: home and destination, travel mode, commute timing and days, a highway leg for
// long drives, an errand plan, a packed id and a coarse pick index. Everything is a pure function of the world,
// the population and the crowd seed, so a Worker and the main thread build the same agents.
//
// The record is 32 bytes per agent, as a structure of arrays per chunk:
//   home    Uint16Array(2n)  x, y as fixed point over the projection extent (q / 65535 * proj.W | proj.H, about
//                            15 m), nudged so the point stays in its ZIP raster cell (world.zipAt is unchanged)
//   dest    Uint16Array(2n)  workplace or school, same encoding (= home for people without commute trips)
//   timing  Uint16Array(3n)  departMin (0xFFFF = none), commuteMin, dwellMin   (commuteTiming(member))
//   days    Uint8Array(n)    commute days, bit (1 << dow); 0 = no commute trips (wfh, retired, no destination)
//   mode    Uint8Array(n)    MODES code in bits 0-3; bit 4 (STUDENT_BIT) = the destination is a school
//   route   Uint16Array(3n)  highway leg: polyline + 1 (0 = none), entry and exit arc length as q / 65535 of the
//                            polyline's length (RoadNet.lines)
//   errand  Uint32Array(n)   start minute (bits 0-10) | dwell / 2 (11-17) | days (18-24) | drives (25) | jitter (26-31)
//   eoff    Int8Array(2n)    errand point minus home, in quarter units (±31.75 units, about ±6 km)
//   ids     Uint32Array(n)   zi << 20 | h << 4 | m, or 0x80000000 | k for overflow[3k .. 3k+2] = (zi, h, m)
//
// The position function lives here twice: agentPhase/agentPlace in JS (stats, picking, tests) and agentGLSL(net),
// its line-for-line GLSL twin compiled into the crowd's vertex shader. Change one, change the other; the e2e test
// runs the shader with transform feedback and compares it with the JS on real agents.

import { mix32, hash2, hash3 } from '../engine/rng.mjs';
import { pacific } from '../engine/clock.mjs';

// ---------------------------------------------------------------- vocabulary

/** Travel modes by code; code 0 is "no mode" (population PersonCore.mode null). */
export const MODES = Object.freeze([null, 'drive', 'carpool', 'bus', 'rail', 'ferry', 'taxi', 'motorcycle', 'bike', 'walk', 'other', 'wfh']);
const MODE_CODE = new Map(MODES.map((m, i) => [m, i]));
/** Code of 'wfh'. */
export const MODE_WFH = 11;
/** Bit of the mode byte set when the destination is a school. */
export const STUDENT_BIT = 16;
/** timing departMin value for "never departs". */
export const NO_DEPART = 0xffff;

/**
 * Code of a population mode string (null → 0, unknown strings count as 'other').
 * @param {string|null} mode
 * @returns {number}
 */
export function modeCode(mode) {
  if (mode == null) return 0;
  const c = MODE_CODE.get(mode);
  return c === undefined ? 10 : c;
}

/** Render kinds; KINDS[k] for the K_* constants. 'home' is the population layer. */
export const KINDS = Object.freeze(['walk', 'drive', 'bike', 'transit', 'errand', 'home']);
/** Render kind codes (index into KINDS). */
export const K_WALK = 0, K_DRIVE = 1, K_BIKE = 2, K_TRANSIT = 3, K_ERRAND = 4, K_HOME = 5;
/** Render kind of each mode code (-1: never travels). */
export const MODE_KIND = Object.freeze([-1, K_DRIVE, K_DRIVE, K_TRANSIT, K_TRANSIT, K_TRANSIT, K_DRIVE, K_DRIVE, K_BIKE, K_WALK, K_WALK, -1]);
/** Visibility bit of each kind name (Crowd.setVisible). */
export const KIND_BIT = Object.freeze({ walk: 1, drive: 2, bike: 4, transit: 8, errand: 16, home: 32 });

/** Agent states; STATES[s] for the S_* constants. */
export const STATES = Object.freeze(['home', 'to-work', 'at-work', 'to-home', 'to-errand', 'at-errand', 'from-errand']);
/** State codes (index into STATES): at home, commuting out, at work or school, commuting back, errand out, at the errand, errand back. */
export const S_HOME = 0, S_OUT = 1, S_WORK = 2, S_BACK = 3, S_EOUT = 4, S_EAT = 5, S_EBACK = 6;

/** Color classes of the shader palette (colorClass returns an index into this). */
export const COLOR_CLASSES = Object.freeze(['walk', 'drive-out', 'drive-home', 'bike', 'transit', 'errand', 'home']);
/** Visibility bit (KIND_BIT) of each color class. */
export const CLASS_BIT = Object.freeze([1, 2, 2, 4, 8, 16, 32]);

/** Tunables shared by the builder, the JS position function and its GLSL twin. */
export const CROWD = Object.freeze({
  streetKmh: 40,        // street legs of a drive (arterials, lights)
  highwayKmh: 100,      // freeway at free flow; rushFactor slows it
  detour: 1.3,          // street distance over straight-line distance
  rampPenaltyMin: 1.5,  // getting on and off costs time
  highwayMinKm: 8,      // shorter drives stay on streets
  rampMaxKm: 15,        // no on-ramp farther than this from home (or off-ramp from the destination)
  highwaySaving: 0.92,  // take the freeway only when it beats the streets by 8 %
  errWalkKmh: 4.8, errDriveKmh: 28, errMinTravel: 3,
  laneDrive0: 0.10, laneDrive1: 0.30,   // right-hand offset of drivers, units (20-80 m): directions separate
  laneOther0: 0.03, laneOther1: 0.09,   // walkers, cyclists, riders keep to their side too
  curve: 0.08,          // control-point offset of a curved trip, as a share of its length
  errCurve: 0.15,
  pickCell: 32,         // pick index cell, units (about 6.3 km)
});

/** Bytes per agent of the record (see the header). */
export const AGENT_BYTES = 32;
/** Largest distance (units) between an agent's drawn position and the centerline the pick index rasterizes. */
export const PICK_MARGIN = 1.0;

const MAX_COMMUTE = 360, MAX_SPAN = 1430;
const LANE_MAX = CROWD.laneDrive0 + CROWD.laneDrive1;

// ---------------------------------------------------------------- small helpers

const clampInt = (v, lo, hi) => { v = Math.round(+v || 0); return v < lo ? lo : v > hi ? hi : v; };

/** Decode a Uint16 fixed-point coordinate over an extent. */
export const dequant = (q, ext) => q / 65535 * ext;

/** Encode v over an extent as Uint16, staying inside v's raster cell so ZIP lookups do not change. */
function quant(v, ext, cell) {
  let q = Math.round(v / ext * 65535);
  if (q < 0) q = 0; else if (q > 65535) q = 65535;
  const c = Math.floor(v / cell), d = Math.floor(dequant(q, ext) / cell);
  if (d > c && q > 0) q--; else if (d < c && q < 65535) q++;
  return q;
}

/** Days of a mask kept with probability p each, one byte of the random words wa (Sun-Wed) and wb (Thu-Sat) per day. */
function dayMask(mask, p, wa, wb) {
  const lim = p * 256;
  let out = 0;
  for (let d = 0; d < 7; d++) if (((mask >> d) & 1) && (((d < 4 ? wa : wb) >>> ((d & 3) << 3)) & 255) < lim) out |= 1 << d;
  return out;
}

/** 256 unit directions (errand bearings). */
const DIR_X = new Float64Array(256), DIR_Y = new Float64Array(256);
for (let k = 0; k < 256; k++) { DIR_X[k] = Math.cos(k * Math.PI / 128); DIR_Y[k] = Math.sin(k * Math.PI / 128); }

/** One set bit of a mask chosen by u in [0, 1). */
function pickBit(mask, u) {
  let n = 0; for (let d = 0; d < 7; d++) if ((mask >> d) & 1) n++;
  if (!n) return 0;
  let k = Math.floor(u * n);
  for (let d = 0; d < 7; d++) if ((mask >> d) & 1) { if (k === 0) return 1 << d; k--; }
  return 0;
}

/**
 * Commute timing of a population member as stored: [departMin (NO_DEPART if none), commuteMin, dwellMin], clamped so a
 * commute day (out, dwell, back) never spans a full day.
 * @param {{departMin:number|null, commuteMin:number, dwellMin:number}} mem
 * @returns {number[]}
 */
export function commuteTiming(mem) {
  const out = [0, 0, 0];
  writeTiming(mem, out, 0);
  return out;
}

/** commuteTiming written straight into an array at offset o (the builder's allocation-free path). */
function writeTiming(mem, arr, o) {
  const d = mem.departMin;
  const dep = d == null || !Number.isFinite(+d) ? NO_DEPART : ((Math.round(+d) % 1440) + 1440) % 1440;
  const com = clampInt(mem.commuteMin, 0, MAX_COMMUTE);
  let dwl = clampInt(mem.dwellMin, 0, 1439);
  if (2 * com + dwl > MAX_SPAN) dwl = Math.max(0, MAX_SPAN - 2 * com);
  arr[o] = dep; arr[o + 1] = com; arr[o + 2] = dwl;
}

/**
 * Simulation clock parts for the position function: Pacific minute of the day (fractional) and day of week.
 * @param {number} t epoch ms
 * @returns {{minute:number, dow:number}}
 */
export function simTime(t) {
  const p = pacific(t);
  return { minute: p.minuteOfDay + ((((t % 60000) + 60000) % 60000) / 60000), dow: p.dow };
}

/**
 * Freeway speed factor for a trip starting at minute m of a day (1 = free flow). Weekday rush hours slow the
 * highway legs; weekends barely.
 * @param {number} m minute of the day
 * @param {number} dow 0 Sunday … 6 Saturday
 * @returns {number}
 */
export function rushFactor(m, dow) {
  if (dow >= 1 && dow <= 5) return Math.max(0.3, 1 - 0.55 * bump(m, 465, 110) - 0.6 * bump(m, 1035, 130));
  return Math.max(0.3, 1 - 0.15 * bump(m, 810, 240));
}
function bump(m, c, w) { const x = (m - c) / w, y = 1 - x * x; return y > 0 ? y * y : 0; }

/**
 * One-way errand travel time in minutes for an errand offset (units) on foot or by car.
 * @param {number} ex @param {number} ey offset in units
 * @param {number} drive 1 by car, 0 on foot
 * @param {number} unitKm world.unitKm
 * @returns {number}
 */
export function errTravel(ex, ey, drive, unitKm) {
  const km = Math.sqrt(ex * ex + ey * ey) * unitKm * CROWD.detour;
  return Math.max(CROWD.errMinTravel, km / (drive ? CROWD.errDriveKmh : CROWD.errWalkKmh) * 60);
}

/**
 * Level-of-detail value of a global agent index in [0, 1): the renderer draws an agent when this is below its
 * keep fraction (the shader computes the same integer hash).
 * @param {number} idx
 * @returns {number}
 */
export function lodValue(idx) { return (mix32((idx ^ 0x5bd1e995) >>> 0) >>> 8) / 16777216; }

// ---------------------------------------------------------------- the road network

const RV_W = 1024, RL_W = 512, VGRID = 16, MEMO_CELL = 12, MAX_NEAR_LINES = 12;

/**
 * The state highway network as polylines with cumulative arc length, laid out for a float texture, plus a vertex
 * grid for ramp search.
 * @param {import('../engine/world.mjs').World} world
 * @returns {RoadNet} {V, L, verts: Float32Array [x, y, s, aadt] × V (padded to the texture), lines: Float32Array
 *   [offset, count, length, road] × L (padded), info: [{road, line, name, kind, route, offset, count, length}],
 *   vertLine, texV: {width, height}, texL: {width, height}, W, H, unitKm}
 */
export function buildRoadNet(world) {
  const xs = [], ys = [], ss = [], aa = [], info = [];
  world.roads.forEach((rd, ri) => rd.lines.forEach((pts, li) => {
    const start = xs.length;
    let s = 0, px = NaN, py = NaN;
    for (const p of pts) {
      const x = +p[0], y = +p[1];
      if (x === px && y === py) continue;
      if (xs.length > start) s += Math.hypot(x - px, y - py);
      xs.push(x); ys.push(y); ss.push(s); aa.push(+p[2] || 0);
      px = x; py = y;
    }
    const count = xs.length - start;
    if (count < 2 || !(s > 0)) { xs.length = start; ys.length = start; ss.length = start; aa.length = start; return; }
    info.push({ road: ri, line: li, name: rd.name, kind: rd.kind, route: rd.r, offset: start, count, length: Math.fround(s) });
  }));
  const V = xs.length, L = info.length;
  const vRows = Math.max(1, Math.ceil(V / RV_W)), lRows = Math.max(1, Math.ceil(L / RL_W));
  const verts = new Float32Array(RV_W * vRows * 4), lines = new Float32Array(RL_W * lRows * 4), vertLine = new Int32Array(V);
  for (let k = 0; k < V; k++) { verts[4 * k] = xs[k]; verts[4 * k + 1] = ys[k]; verts[4 * k + 2] = ss[k]; verts[4 * k + 3] = aa[k]; }
  info.forEach((ln, l) => {
    // the stored length is the float32 arc length at the last vertex, so q / 65535 * length never passes the end
    ln.length = verts[4 * (ln.offset + ln.count - 1) + 2];
    lines[4 * l] = ln.offset; lines[4 * l + 1] = ln.count; lines[4 * l + 2] = ln.length; lines[4 * l + 3] = ln.road;
    for (let k = ln.offset; k < ln.offset + ln.count; k++) vertLine[k] = l;
  });
  const W = world.proj.W, H = world.proj.H;
  const gw = Math.ceil(W / VGRID) + 1, gh = Math.ceil(H / VGRID) + 1;
  const start = new Uint32Array(gw * gh + 1);
  const cellOf = k => clampInt(Math.floor(verts[4 * k + 1] / VGRID), 0, gh - 1) * gw + clampInt(Math.floor(verts[4 * k] / VGRID), 0, gw - 1);
  for (let k = 0; k < V; k++) start[cellOf(k) + 1]++;
  for (let c = 0; c < gw * gh; c++) start[c + 1] += start[c];
  const items = new Uint32Array(V), fill = start.slice(0, gw * gh);
  for (let k = 0; k < V; k++) items[fill[cellOf(k)]++] = k;
  return {
    V, L, verts, lines, info, vertLine,
    texV: { width: RV_W, height: vRows }, texL: { width: RL_W, height: lRows },
    W, H, unitKm: world.unitKm, rampMax: CROWD.rampMaxKm / world.unitKm,
    grid: { cell: VGRID, gw, gh, start, items },
    memo: new Map(),
    _best: new Float64Array(L).fill(Infinity), _bestK: new Int32Array(L), _touched: new Int32Array(L),
  };
}

/**
 * Point and direction on polyline `line` at arc length s (clamped). The binary search and interpolation are
 * the ones the shader runs on the road texture.
 * @param {RoadNet} net @param {number} line @param {number} s
 * @param {{x:number, y:number, dx:number, dy:number, k:number}} out k = global index of the segment's first vertex
 */
export function roadAt(net, line, s, out) {
  const Ls = net.lines, V = net.verts;
  const off = Ls[4 * line], cnt = Ls[4 * line + 1], len = Ls[4 * line + 2];
  if (s < 0) s = 0; else if (s > len) s = len;
  let lo = 0, hi = cnt - 1;
  for (let it = 0; it < 16; it++) {
    if (hi - lo <= 1) break;
    const mid = (lo + hi) >> 1;
    if (V[4 * (off + mid) + 2] <= s) lo = mid; else hi = mid;
  }
  const a = 4 * (off + lo), b = a + 4;
  const seg = V[b + 2] - V[a + 2];
  const t = seg > 1e-6 ? (s - V[a + 2]) / seg : 0;
  out.x = V[a] + (V[b] - V[a]) * t;
  out.y = V[a + 1] + (V[b + 1] - V[a + 1]) * t;
  let dx = V[b] - V[a], dy = V[b + 1] - V[a + 1];
  const dl = Math.sqrt(dx * dx + dy * dy);
  if (dl > 1e-6) { dx /= dl; dy /= dl; } else { dx = 1; dy = 0; }
  out.dx = dx; out.dy = dy; out.k = off + lo;
  return out;
}

/** Lines passing near a point (memoized per MEMO_CELL cell): Int32Array [line, nearest vertex, …] sorted by line. */
function nearLines(net, x, y) {
  const cx = Math.floor(x / MEMO_CELL), cy = Math.floor(y / MEMO_CELL), key = cy * 65536 + cx;
  const hit = net.memo.get(key);
  if (hit !== undefined) return hit;
  const g = net.grid, V = net.verts, px = (cx + 0.5) * MEMO_CELL, py = (cy + 0.5) * MEMO_CELL;
  const best = net._best, bestK = net._bestK, touched = net._touched;
  let nt = 0;
  // where freeways are dense, the ones within about 9 km are the candidates; elsewhere look out to rampMax
  for (const R of [Math.min(net.rampMax, 45) + MEMO_CELL, net.rampMax + MEMO_CELL]) {
    for (let j = 0; j < nt; j++) best[touched[j]] = Infinity;
    nt = 0;
    const R2 = R * R;
    const c0 = clampInt(Math.floor((px - R) / g.cell), 0, g.gw - 1), c1 = clampInt(Math.floor((px + R) / g.cell), 0, g.gw - 1);
    const r0 = clampInt(Math.floor((py - R) / g.cell), 0, g.gh - 1), r1 = clampInt(Math.floor((py + R) / g.cell), 0, g.gh - 1);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      const cell = r * g.gw + c;
      for (let j = g.start[cell], j1 = g.start[cell + 1]; j < j1; j++) {
        const k = g.items[j], dx = V[4 * k] - px, dy = V[4 * k + 1] - py, d2 = dx * dx + dy * dy;
        if (d2 > R2) continue;
        const l = net.vertLine[k];
        if (best[l] === Infinity) touched[nt++] = l;
        if (d2 < best[l]) { best[l] = d2; bestK[l] = k; }
      }
    }
    if (nt >= 4) break;
  }
  const ls = Array.from(touched.subarray(0, nt)).sort((a, b) => best[a] - best[b]).slice(0, MAX_NEAR_LINES).sort((a, b) => a - b);
  const out = new Int32Array(2 * ls.length);
  for (let j = 0; j < ls.length; j++) { out[2 * j] = ls[j]; out[2 * j + 1] = bestK[ls[j]]; }
  for (let j = 0; j < nt; j++) best[touched[j]] = Infinity;
  net.memo.set(key, out);
  return out;
}

/** Projections of (px, py) on the segments around vertex k of a line: up to 5 candidates into buf [s, x, y, d]. */
function projections(net, line, k, px, py, buf) {
  const Ls = net.lines, V = net.verts, off = Ls[4 * line], cnt = Ls[4 * line + 1];
  const j0 = Math.max(off, k - 2), j1 = Math.min(off + cnt - 2, k + 2);
  let n = 0;
  for (let j = j0; j <= j1; j++) {
    const a = 4 * j, ax = V[a], ay = V[a + 1], vx = V[a + 4] - ax, vy = V[a + 5] - ay, l2 = vx * vx + vy * vy;
    let t = l2 > 0 ? ((px - ax) * vx + (py - ay) * vy) / l2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const x = ax + vx * t, y = ay + vy * t, ex = px - x, ey = py - y;
    buf[4 * n] = V[a + 2] + (V[a + 6] - V[a + 2]) * t;
    buf[4 * n + 1] = x; buf[4 * n + 2] = y; buf[4 * n + 3] = Math.sqrt(ex * ex + ey * ey);
    n++;
  }
  return n;
}

const _cand = new Float64Array(4 * MAX_NEAR_LINES), _pe = new Float64Array(20), _px = new Float64Array(20);

/**
 * The freeway leg of a drive from (hx, hy) to (dx, dy): the world.roads polyline and the entry and exit points that
 * minimize the trip time (streets at streetKmh with a detour factor, the freeway at highwayKmh, a ramp penalty).
 * Candidate polylines pass within rampMaxKm of both ends (a memoized vertex grid); for the two most promising,
 * the entry and exit are the projections of the ends on the segments around their nearest vertices, the pair with
 * the least total time winning. Null when the drive is shorter than highwayMinKm or the freeway does not beat the
 * streets by highwaySaving.
 * @param {RoadNet} net
 * @param {number} hx @param {number} hy start (units) @param {number} dx @param {number} dy end (units)
 * @param {object} [out] filled and returned instead of a new object
 * @returns {{line:number, s0:number, s1:number, onX:number, onY:number, offX:number, offY:number, minutes:number, direct:number}|null}
 */
export function planHighway(net, hx, hy, dx, dy, out) {
  const uk = net.unitKm, D = Math.sqrt((dx - hx) * (dx - hx) + (dy - hy) * (dy - hy));
  if (D * uk < CROWD.highwayMinKm) return null;
  const A = nearLines(net, hx, hy);
  if (!A.length) return null;
  const B = nearLines(net, dx, dy);
  if (!B.length) return null;
  const V = net.verts, DET = CROWD.detour, VS = CROWD.streetKmh, VH = CROWD.highwayKmh;
  let nc = 0, ia = 0, ib = 0;
  while (ia < A.length && ib < B.length) {
    const la = A[ia], lb = B[ib];
    if (la < lb) ia += 2;
    else if (lb < la) ib += 2;
    else {
      const ka = A[ia + 1], kb = B[ib + 1];
      const ax = V[4 * ka] - hx, ay = V[4 * ka + 1] - hy, bx = V[4 * kb] - dx, by = V[4 * kb + 1] - dy;
      _cand[4 * nc] = la; _cand[4 * nc + 1] = ka; _cand[4 * nc + 2] = kb;
      _cand[4 * nc + 3] = DET * (Math.sqrt(ax * ax + ay * ay) + Math.sqrt(bx * bx + by * by)) / VS + Math.abs(V[4 * ka + 2] - V[4 * kb + 2]) / VH;
      nc++; ia += 2; ib += 2;
    }
  }
  if (!nc) return null;
  const toMin = uk * 60, rampMax = net.rampMax;
  let bestCost = Infinity, bl = -1, bs0 = 0, bs1 = 0, bonx = 0, bony = 0, boffx = 0, boffy = 0;
  for (let pass = 0; pass < 2 && pass < nc; pass++) {
    let jb = -1, cb = Infinity;
    for (let j = 0; j < nc; j++) if (_cand[4 * j + 3] < cb) { cb = _cand[4 * j + 3]; jb = j; }
    if (jb < 0) break;
    _cand[4 * jb + 3] = Infinity;
    const line = _cand[4 * jb];
    const ne = projections(net, line, _cand[4 * jb + 1], hx, hy, _pe), nx = projections(net, line, _cand[4 * jb + 2], dx, dy, _px);
    for (let e = 0; e < ne; e++) {
      const de = _pe[4 * e + 3];
      if (de > rampMax || DET * de / VS * toMin >= bestCost) continue;
      for (let x = 0; x < nx; x++) {
        const dX = _px[4 * x + 3];
        if (dX > rampMax) continue;
        const ds = Math.abs(_pe[4 * e] - _px[4 * x]);
        if (!(ds > 0)) continue;
        const cost = (DET * (de + dX) / VS + ds / VH) * toMin + CROWD.rampPenaltyMin;
        if (cost < bestCost) {
          bestCost = cost; bl = line; bs0 = _pe[4 * e]; bs1 = _px[4 * x];
          bonx = _pe[4 * e + 1]; bony = _pe[4 * e + 2]; boffx = _px[4 * x + 1]; boffy = _px[4 * x + 2];
        }
      }
    }
  }
  const direct = DET * D / VS * toMin;
  if (bl < 0 || bestCost >= direct * CROWD.highwaySaving) return null;
  const o = out || {};
  o.line = bl; o.s0 = bs0; o.s1 = bs1; o.onX = bonx; o.onY = bony; o.offX = boffx; o.offY = boffy; o.minutes = bestCost; o.direct = direct;
  return o;
}

// ---------------------------------------------------------------- build order

/** Population-weighted centroid of each region's ZIP town points: {key: {x, y}}. */
export function regionCentroids(world) {
  const z = world.z, acc = {};
  for (let i = 0; i < world.N; i++) {
    const k = z.region[i], w = Math.max(1, z.pop[i] || 0), a = acc[k] || (acc[k] = { x: 0, y: 0, w: 0 });
    a.x += z.tx[i] * w; a.y += z.ty[i] * w; a.w += w;
  }
  const out = {};
  for (const [k, a] of Object.entries(acc)) out[k] = { x: a.x / a.w, y: a.y / a.w };
  return out;
}

/**
 * ZIP indices in build order: region by region (opts.regions, else the pack's regions, nearest to opts.focus
 * first when given), ZIPs of a region in index order. With explicit regions only those regions are listed.
 * @param {World} world
 * @param {{regions?:string[], focus?:{x:number, y:number}}} [opts]
 * @returns {number[]}
 */
export function zipOrder(world, { regions = null, focus = null } = {}) {
  const explicit = !!(regions && regions.length);
  const keys = explicit ? regions.slice() : world.regions.map(r => r.key);
  if (focus && !explicit) {
    const cen = regionCentroids(world);
    const d = k => cen[k] ? Math.hypot(cen[k].x - focus.x, cen[k].y - focus.y) : Infinity;
    keys.sort((a, b) => d(a) - d(b));
  }
  const seen = new Uint8Array(world.N), out = [];
  for (const k of keys) for (const i of world.zipsOfRegion(k)) if (!seen[i]) { seen[i] = 1; out.push(i); }
  if (!explicit) for (let i = 0; i < world.N; i++) if (!seen[i]) out.push(i);
  return out;
}

// ---------------------------------------------------------------- the builder

/** Pick-index cells crossed by every polyline segment (k, k + 1), as CSR over the global vertex index k. */
function segmentCells(net, B) {
  const V = net.verts, start = new Uint32Array(net.V + 1), cells = [];
  for (let k = 0; k < net.V; k++) {
    start[k] = cells.length;
    if (k + 1 < net.V && net.vertLine[k + 1] === net.vertLine[k]) {
      B.cn = 0; B.serial++;
      B.segCells(V[4 * k], V[4 * k + 1], V[4 * k + 4], V[4 * k + 5]);
      for (let j = 0; j < B.cn; j++) cells.push(B.cl[j]);
    }
  }
  start[net.V] = cells.length;
  B.cn = 0;
  return { start, cells: Uint32Array.from(cells) };
}

/** Growable chunk buffers plus the per-agent work (one instance per build). */
class ChunkBuilder {
  constructor(world, net, seed, withPick) {
    this.world = world; this.net = net; this.seed = seed >>> 0; this.withPick = withPick;
    this.W = world.proj.W; this.H = world.proj.H; this.uk = world.unitKm;
    const R = world.raster();
    this.rCell = R.cell; this.rW = R.W; this.rH = R.H; this.rGrid = R.grid;
    const G = CROWD.pickCell;
    this.gw = Math.ceil(this.W / G); this.gh = Math.ceil(this.H / G);
    this.cl = new Int32Array(4096); this.cn = 0;
    this.stamp = new Int32Array(this.gw * this.gh).fill(-1); this.serial = 0;
    if (withPick) this.segCache = segmentCells(net, this);
    this.rs = 0;
    this._ra = { x: 0, y: 0, dx: 0, dy: 0, k: 0 }; this._rb = { x: 0, y: 0, dx: 0, dy: 0, k: 0 };
    this._leg = { line: 0, s0: 0, s1: 0, onX: 0, onY: 0, offX: 0, offY: 0, minutes: 0, direct: 0 };
    this.alloc(1 << 14);
    this.reset();
  }
  alloc(cap) {
    this.cap = cap;
    this.home = new Uint16Array(2 * cap); this.dest = new Uint16Array(2 * cap); this.timing = new Uint16Array(3 * cap);
    this.days = new Uint8Array(cap); this.mode = new Uint8Array(cap); this.route = new Uint16Array(3 * cap);
    this.errand = new Uint32Array(cap); this.eoff = new Int8Array(2 * cap); this.ids = new Uint32Array(cap);
  }
  grow() {
    const old = { home: this.home, dest: this.dest, timing: this.timing, days: this.days, mode: this.mode, route: this.route, errand: this.errand, eoff: this.eoff, ids: this.ids };
    this.alloc(this.cap * 2);
    for (const k of Object.keys(old)) this[k].set(old[k]);
  }
  reset() {
    this.n = 0; this.ov = []; this.zis = []; this.region = null;
    this.pairs = this.pairs || new Uint32Array(1 << 16); this.np = 0;
    this.byMode = new Uint32Array(MODES.length); this.nHighway = 0; this.nErrand = 0; this.nCommute = 0; this.households = 0;
  }
  rnd() { this.rs = (this.rs + 0x9e3779b9) | 0; return mix32(this.rs) / 4294967296; }

  /** True when (x, y) falls on a ZIP raster cell, the fast path of world.zipAt (so world.zipAt(x, y) >= 0). */
  onLand(x, y) {
    const c = Math.floor(x / this.rCell), r = Math.floor(y / this.rCell);
    return c >= 0 && r >= 0 && c < this.rW && r < this.rH && this.rGrid[r * this.rW + c] !== 0;
  }

  /** Add every member of household (zi, h). */
  household(zi, h, core) {
    const W = this.W, H = this.H, cell = this.rCell;
    const qhx = quant(core.home.x, W, cell), qhy = quant(core.home.y, H, cell);
    const hx = dequant(qhx, W), hy = dequant(qhy, H);
    const vehicles = core.vehicles | 0;
    const members = core.members;
    this.households++;
    for (let k = 0; k < members.length; k++) {
      const mem = members[k];
      const m = mem.m == null ? k : mem.m;
      if (this.n >= this.cap) this.grow();
      const i = this.n++;
      if (h < 65536 && m < 16) this.ids[i] = ((zi << 20) | (h << 4) | m) >>> 0;
      else { this.ids[i] = (0x80000000 | (this.ov.length / 3)) >>> 0; this.ov.push(zi, h, m); }
      this.home[2 * i] = qhx; this.home[2 * i + 1] = qhy;
      const code = modeCode(mem.mode);
      const T = this.timing, t3 = 3 * i;
      writeTiming(mem, T, t3);
      const dep = T[t3], com = T[t3 + 1], dwl = T[t3 + 2];
      const school = !!(mem.student && mem.work);
      this.mode[i] = code | (school ? STUDENT_BIT : 0);
      this.byMode[code]++;
      const kind = MODE_KIND[code];
      const work = mem.work;
      const commutes = kind >= 0 && dep !== NO_DEPART && com > 0 && work && Number.isFinite(work.x) && Number.isFinite(work.y) && (mem.days & 127) !== 0;
      const dmask = commutes ? mem.days & 127 : 0;
      this.days[i] = dmask;
      let dx = hx, dy = hy;
      this.route[3 * i] = 0; this.route[3 * i + 1] = 0; this.route[3 * i + 2] = 0;
      if (commutes) {
        this.nCommute++;
        const qdx = quant(work.x, W, cell), qdy = quant(work.y, H, cell);
        this.dest[2 * i] = qdx; this.dest[2 * i + 1] = qdy;
        dx = dequant(qdx, W); dy = dequant(qdy, H);
        if (kind === K_DRIVE) {
          const leg = planHighway(this.net, hx, hy, dx, dy, this._leg);
          if (leg) {
            const len = this.net.lines[4 * leg.line + 2];
            const q0 = clampInt(leg.s0 / len * 65535, 0, 65535), q1 = clampInt(leg.s1 / len * 65535, 0, 65535);
            if (q0 !== q1) {
              this.route[3 * i] = leg.line + 1; this.route[3 * i + 1] = q0; this.route[3 * i + 2] = q1;
              this.nHighway++;
            }
          }
        }
      } else { this.dest[2 * i] = qhx; this.dest[2 * i + 1] = qhy; }
      const eDays = this.errandPlan(i, zi, h, m, mem.age | 0, vehicles, hx, hy, dmask, dep, com, dwl);
      if (this.withPick) this.pickCells(i, hx, hy, dx, dy, dmask, eDays);
    }
  }

  /** Write the errand word and offset of agent i; returns the errand day mask. */
  errandPlan(i, zi, h, m, age, vehicles, hx, hy, dmask, dep, com, dwl) {
    const eh = hash3(hash2(this.seed ^ 0x45524e44, zi), h, m);
    this.rs = eh;
    const jitter = mix32((eh ^ 0x6a09e667) >>> 0) >>> 26;
    const base = (jitter << 26) >>> 0;
    this.errand[i] = base; this.eoff[2 * i] = 0; this.eoff[2 * i + 1] = 0;
    if (age < 12) return 0;
    const drive = vehicles > 0 && age >= 16 && this.rnd() < 0.88 ? 1 : 0;
    const r0 = this.rnd();
    let km = drive ? 0.8 + 3.4 * r0 * Math.sqrt(r0) : 0.25 + 0.85 * r0;
    let dir = mix32((eh ^ 0x510e527f) >>> 0) & 255, qx = 0, qy = 0, ok = false;
    for (let t = 0; t < 6 && !ok; t++) {
      // retries turn by the golden angle (98 of 256) and come closer, until the point is on land
      const u = km / this.uk * 4;
      qx = clampInt(DIR_X[dir] * u, -127, 127); qy = clampInt(DIR_Y[dir] * u, -127, 127);
      if (qx === 0 && qy === 0) qx = 1;
      ok = this.onLand(hx + qx * 0.25, hy + qy * 0.25);
      dir = (dir + 98) & 255; km *= 0.8;
    }
    if (!ok) return 0;
    const tt = errTravel(qx * 0.25, qy * 0.25, drive, this.uk);
    const dwell = 10 + 2 * Math.floor(this.rnd() * 40);
    const need = Math.ceil(2 * tt + dwell);
    let start, eDays;
    const wa = mix32((eh ^ 0x3c6ef372) >>> 0), wb = mix32((eh ^ 0xa54ff53a) >>> 0);
    if (dmask) {
      const arrival = dep + 2 * com + dwl, free = 127 & ~dmask;
      if (arrival < 1260 && this.rnd() < 0.55) {
        start = arrival + 20 + Math.floor(this.rnd() * 60);
        eDays = dayMask(dmask, 0.3, wa, wb) | dayMask(free, 0.3, wa, wb);
        if (!eDays) eDays = pickBit(dmask, this.rnd());
        if (start + need > 1439) start = 1439 - need;
        if (start < arrival + 5) eDays &= free;
      } else {
        start = 570 + Math.floor(this.rnd() * 450);
        eDays = dayMask(free, 0.55, wa, wb);
        if (!eDays && free) eDays = pickBit(free, this.rnd());
        if (start + need > 1439) start = 1439 - need;
      }
    } else {
      start = (age >= 65 ? 510 : 570) + Math.floor((this.rnd() + this.rnd()) * 0.5 * 480);
      eDays = dayMask(127, age >= 65 ? 0.55 : age < 18 ? 0.35 : 0.5, wa, wb);
      if (!eDays) eDays = 1 << Math.floor(this.rnd() * 7);
      if (start + need > 1439) start = 1439 - need;
    }
    if (!eDays || start < 0) return 0;
    this.errand[i] = (base | start | ((dwell >> 1) << 11) | (eDays << 18) | (drive << 25)) >>> 0;
    this.eoff[2 * i] = qx; this.eoff[2 * i + 1] = qy;
    this.nErrand++;
    return eDays;
  }

  // ---- pick index: every coarse cell an agent's paths cross

  addCell(cx, cy) {
    if (cx < 0) cx = 0; else if (cx >= this.gw) cx = this.gw - 1;
    if (cy < 0) cy = 0; else if (cy >= this.gh) cy = this.gh - 1;
    this.addId(cy * this.gw + cx);
  }
  addId(id) {
    if (this.stamp[id] === this.serial) return;
    this.stamp[id] = this.serial;
    if (this.cn < this.cl.length) this.cl[this.cn++] = id;
  }
  /** Cells of the whole polyline segment from vertex j to j + 1 (precomputed). */
  addSegment(j) {
    const sc = this.segCache;
    for (let q = sc.start[j], q1 = sc.start[j + 1]; q < q1; q++) this.addId(sc.cells[q]);
  }

  /** Cells crossed by a segment (Amanatides-Woo traversal). */
  segCells(x0, y0, x1, y1) {
    const G = CROWD.pickCell;
    let cx = Math.floor(x0 / G), cy = Math.floor(y0 / G);
    const ex = Math.floor(x1 / G), ey = Math.floor(y1 / G);
    this.addCell(cx, cy);
    if (cx === ex && cy === ey) return;
    const dx = x1 - x0, dy = y1 - y0, adx = Math.abs(dx), ady = Math.abs(dy);
    const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1;
    let tx = adx > 1e-12 ? (sx > 0 ? (cx + 1) * G - x0 : x0 - cx * G) / adx : Infinity;
    let ty = ady > 1e-12 ? (sy > 0 ? (cy + 1) * G - y0 : y0 - cy * G) / ady : Infinity;
    const tdx = adx > 1e-12 ? G / adx : Infinity, tdy = ady > 1e-12 ? G / ady : Infinity;
    for (let guard = 0; guard < 4096 && (cx !== ex || cy !== ey); guard++) {
      if (tx < ty) { if (tx > 1) break; cx += sx; tx += tdx; } else { if (ty > 1) break; cy += sy; ty += tdy; }
      this.addCell(cx, cy);
    }
    this.addCell(ex, ey);
  }

  /** Cells of a curved trip, as chords close enough that the drawn path stays within PICK_MARGIN. */
  bezierCells(ax, ay, bx, by, cv, k) {
    const vx = bx - ax, vy = by - ay;
    const cx = (ax + bx) * 0.5 - vy * (cv * k), cy = (ay + by) * 0.5 + vx * (cv * k);
    const G = CROWD.pickCell, ca = Math.floor(ax / G), ra = Math.floor(ay / G);
    // a Bezier curve stays in the convex hull of its control points: one cell holds all three, one cell holds the curve
    if (Math.floor(bx / G) === ca && Math.floor(cx / G) === ca && Math.floor(by / G) === ra && Math.floor(cy / G) === ra) { this.addCell(ca, ra); return; }
    const hdev = Math.abs(cv) * k * Math.sqrt(vx * vx + vy * vy);
    const n = Math.min(16, Math.max(1, Math.ceil(Math.sqrt(hdev / 0.8))));
    let px = ax, py = ay;
    for (let j = 1; j <= n; j++) {
      const g = j / n, h = 1 - g;
      const qx = ax * (h * h) + cx * (2 * g * h) + bx * (g * g), qy = ay * (h * h) + cy * (2 * g * h) + by * (g * g);
      this.segCells(px, py, qx, qy);
      px = qx; py = qy;
    }
  }

  pickCells(i, hx, hy, dx, dy, dmask, eDays) {
    this.cn = 0; this.serial++;
    const G = CROWD.pickCell;
    this.addCell(Math.floor(hx / G), Math.floor(hy / G));
    const jit = this.errand[i] >>> 26, cv = ((jit >> 3) & 7) / 7 * 2 - 1;
    if (dmask) {
      const line = this.route[3 * i];
      if (line) {
        const l = line - 1, len = this.net.lines[4 * l + 2], V = this.net.verts;
        const s0 = this.route[3 * i + 1] / 65535 * len, s1 = this.route[3 * i + 2] / 65535 * len;
        const a = roadAt(this.net, l, s0, this._ra), b = roadAt(this.net, l, s1, this._rb);
        this.segCells(hx, hy, a.x, a.y);
        if (a.k === b.k) this.segCells(a.x, a.y, b.x, b.y);
        else if (s1 >= s0) {
          this.segCells(a.x, a.y, V[4 * a.k + 4], V[4 * a.k + 5]);
          for (let j = a.k + 1; j < b.k; j++) this.addSegment(j);
          this.segCells(V[4 * b.k], V[4 * b.k + 1], b.x, b.y);
        } else {
          this.segCells(a.x, a.y, V[4 * a.k], V[4 * a.k + 1]);
          for (let j = a.k - 1; j > b.k; j--) this.addSegment(j);
          this.segCells(V[4 * b.k + 4], V[4 * b.k + 5], b.x, b.y);
        }
        this.segCells(b.x, b.y, dx, dy);
      } else this.bezierCells(hx, hy, dx, dy, cv, CROWD.curve);
    }
    if (eDays) this.bezierCells(hx, hy, hx + this.eoff[2 * i] * 0.25, hy + this.eoff[2 * i + 1] * 0.25, cv, CROWD.errCurve);
    if (this.np + this.cn > (this.pairs.length >> 1)) {
      const bigger = new Uint32Array(Math.max(this.pairs.length * 2, 2 * (this.np + this.cn) + 1024));
      bigger.set(this.pairs.subarray(0, 2 * this.np)); this.pairs = bigger;
    }
    const P = this.pairs;
    for (let j = 0; j < this.cn; j++) { P[2 * this.np] = this.cl[j]; P[2 * this.np + 1] = i; this.np++; }
  }

  /** Exact-size chunk of everything added since the last reset. */
  finish(index, start) {
    const n = this.n;
    const chunk = {
      index, start, count: n, region: this.region, zis: Uint16Array.from(this.zis),
      W: this.W, H: this.H, unitKm: this.uk,
      home: this.home.slice(0, 2 * n), dest: this.dest.slice(0, 2 * n), timing: this.timing.slice(0, 3 * n),
      days: this.days.slice(0, n), mode: this.mode.slice(0, n), route: this.route.slice(0, 3 * n),
      errand: this.errand.slice(0, n), eoff: this.eoff.slice(0, 2 * n), ids: this.ids.slice(0, n),
      overflow: Uint32Array.from(this.ov),
      pick: null,
      byMode: this.byMode, households: this.households, highway: this.nHighway, errands: this.nErrand, commuters: this.nCommute,
    };
    if (this.withPick) {
      const cells = this.gw * this.gh, cellStart = new Uint32Array(cells + 1), P = this.pairs;
      for (let j = 0; j < this.np; j++) cellStart[P[2 * j] + 1]++;
      for (let c = 0; c < cells; c++) cellStart[c + 1] += cellStart[c];
      const items = new Uint32Array(this.np), fill = cellStart.slice(0, cells);
      for (let j = 0; j < this.np; j++) items[fill[P[2 * j]]++] = P[2 * j + 1];
      chunk.pick = { cell: CROWD.pickCell, gw: this.gw, gh: this.gh, start: cellStart, items };
    }
    this.reset();
    return chunk;
  }
}

/**
 * Build agents progressively. Yields {type: 'chunk', chunk, progress} whenever a chunk is complete and
 * {type: 'tick', progress} after every ZIP (so a caller can time-slice); returns the summary.
 * @param {World} world
 * @param {Population} pop  householdCount, includes, householdCore (CONTRACTS §5)
 * @param {object} [opts]
 * @param {number} [opts.rate] share of households (pop.includes)
 * @param {number} [opts.seed] crowd seed (errand plans, lanes)
 * @param {number[]} [opts.zips] ZIP indices to build, in order (default zipOrder(world, opts))
 * @param {string[]} [opts.regions] @param {{x:number,y:number}} [opts.focus] build order (zipOrder)
 * @param {number} [opts.chunkTarget] start a new chunk past this many agents (default: one chunk)
 * @param {boolean} [opts.byRegion] start a new chunk at every region boundary
 * @param {boolean} [opts.pickIndex] build the pick index (default true)
 * @param {RoadNet} [opts.roadNet] a prebuilt buildRoadNet(world)
 */
export function* buildAgentsGen(world, pop, opts = {}) {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const rate = Math.max(0, +opts.rate || 0), seed = (opts.seed == null ? 1 : opts.seed) >>> 0;
  const net = opts.roadNet || buildRoadNet(world);
  const zipList = opts.zips ? Array.from(opts.zips, Number) : zipOrder(world, opts);
  const chunkTarget = opts.chunkTarget > 0 ? opts.chunkTarget : Infinity;
  const byRegion = !!opts.byRegion;
  const B = new ChunkBuilder(world, net, seed, opts.pickIndex !== false);
  const z = world.z;
  let totalHH = 0;
  for (const zi of zipList) totalHH += pop.householdCount(zi);
  const summary = {
    agents: 0, households: 0, zips: zipList.length, zipsWithAgents: 0, chunks: 0,
    byMode: Object.fromEntries(MODES.map(m => [m == null ? 'none' : m, 0])),
    byKind: { walk: 0, drive: 0, bike: 0, transit: 0, none: 0 },
    commuters: 0, highway: 0, errands: 0, overflow: 0, regions: {},
    rate, seed, bytesPerAgent: AGENT_BYTES, ms: 0,
  };
  const absorb = c => {
    summary.agents += c.count; summary.households += c.households; summary.chunks++;
    summary.commuters += c.commuters; summary.highway += c.highway; summary.errands += c.errands; summary.overflow += c.overflow.length / 3;
    c.byMode.forEach((v, code) => {
      summary.byMode[code ? MODES[code] : 'none'] += v;
      const k = MODE_KIND[code]; summary.byKind[k < 0 ? 'none' : KINDS[k]] += v;
    });
    if (c.region != null) summary.regions[c.region] = (summary.regions[c.region] || 0) + c.count;
  };
  let scanned = 0, index = 0, start = 0;
  for (let j = 0; j < zipList.length; j++) {
    const zi = zipList[j], H = pop.householdCount(zi);
    if (B.region == null) B.region = z.region[zi];
    const before = B.n;
    for (let h = 0; h < H; h++) if (pop.includes(zi, h, rate)) B.household(zi, h, pop.householdCore(zi, h));
    if (B.n > before) { summary.zipsWithAgents++; B.zis.push(zi); }
    scanned += H;
    const progress = totalHH ? scanned / totalHH : 1;
    const next = zipList[j + 1];
    const boundary = next === undefined || B.n >= chunkTarget || (byRegion && z.region[next] !== B.region);
    if (boundary && (B.n > 0 || (next === undefined && index === 0))) {
      // a build always yields at least one chunk (possibly empty) so callers can rely on chunk 0
      const c = B.finish(index++, start);
      start += c.count; absorb(c);
      yield { type: 'chunk', chunk: c, progress };
    } else {
      if (boundary) B.region = null;
      yield { type: 'tick', progress };
    }
  }
  if (!zipList.length) { const c = B.finish(index++, start); absorb(c); yield { type: 'chunk', chunk: c, progress: 1 }; }
  summary.ms = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0);
  return summary;
}

/**
 * Build agents synchronously. With opts.onChunk(chunk, progress) the chunks stream out and the result is
 * {summary}; without it everything lands in one chunk returned with its summary (Node tests, small regions).
 * See buildAgentsGen for the options and the chunk layout (the record in this file's header).
 * @returns {object} chunk & {summary}
 */
export function buildAgents(world, pop, opts = {}) {
  const streaming = typeof opts.onChunk === 'function';
  const gen = buildAgentsGen(world, pop, streaming ? Object.assign({ byRegion: true }, opts) : Object.assign({}, opts, { chunkTarget: 0, byRegion: false }));
  const chunks = [];
  let r;
  while (!(r = gen.next()).done) {
    const v = r.value;
    if (v.type === 'chunk') { if (streaming) opts.onChunk(v.chunk, v.progress); else chunks.push(v.chunk); }
    else if (typeof opts.onProgress === 'function') opts.onProgress(v.progress);
  }
  if (streaming) return { summary: r.value };
  return Object.assign(chunks[0], { summary: r.value });
}

// ---------------------------------------------------------------- ids

/**
 * The NPC behind agent i of a chunk: {zi, h, m, id} with id 'ZIP-h-m'.
 * @param {object} chunk @param {number} i
 * @param {{zips:string[]}} world (or anything with the ZIP code array as .zips)
 */
export function decodeId(chunk, i, world) {
  const v = chunk.ids[i];
  let zi, h, m;
  if (v & 0x80000000) { const k = 3 * (v & 0x7fffffff); zi = chunk.overflow[k]; h = chunk.overflow[k + 1]; m = chunk.overflow[k + 2]; }
  else { zi = v >>> 20; h = (v >>> 4) & 0xffff; m = v & 15; }
  return { zi, h, m, id: `${world.zips[zi]}-${h}-${m}` };
}

// ---------------------------------------------------------------- the position function (JS twin of AGENT GLSL)

/** Scratch phase record: u = minutes into the phase, len = phase length, start = trip start minute, day = trip day. */
export function newPhase() { return { u: 0, len: 1, start: 0, day: 0 }; }

function commutePhase(days, dep, com, dwl, day, m, P) {
  if (((days >> day) & 1) === 0) return S_HOME;
  let v = m - dep;
  if (v < 0) return S_HOME;
  if (v < com) { P.u = v; P.len = com; P.start = dep; P.day = day; return S_OUT; }
  v -= com;
  if (v < dwl) { P.u = v; P.len = dwl; return S_WORK; }
  v -= dwl;
  if (v < com) { P.u = v; P.len = com; P.start = dep + com + dwl; P.day = day; return S_BACK; }
  return S_HOME;
}

/**
 * State of agent i at a minute of the day and day of week (S_*), with the phase details in P. Today's commute
 * day first, then yesterday's (night shifts and late returns cross midnight), then today's errand.
 * @param {object} c chunk @param {number} i @param {number} minute 0 ≤ minute < 1440 @param {number} dow
 * @param {{u:number, len:number, start:number, day:number}} P
 * @returns {number}
 */
export function agentPhase(c, i, minute, dow, P) {
  const days = c.days[i];
  if (days !== 0) {
    const t = 3 * i, dep = c.timing[t], com = c.timing[t + 1], dwl = c.timing[t + 2];
    let s = commutePhase(days, dep, com, dwl, dow, minute, P);
    if (s === S_HOME) s = commutePhase(days, dep, com, dwl, dow === 0 ? 6 : dow - 1, minute + 1440, P);
    if (s !== S_HOME) return s;
  }
  const e = c.errand[i], ed = (e >>> 18) & 127;
  if (ed !== 0 && ((ed >> dow) & 1) !== 0) {
    let v = minute - (e & 2047);
    if (v >= 0) {
      const tt = errTravel(c.eoff[2 * i] * 0.25, c.eoff[2 * i + 1] * 0.25, (e >>> 25) & 1, c.unitKm);
      if (v < tt) { P.u = v; P.len = tt; return S_EOUT; }
      v -= tt;
      const dw = ((e >>> 11) & 127) * 2;
      if (v < dw) { P.u = v; P.len = dw; return S_EAT; }
      v -= dw;
      if (v < tt) { P.u = v; P.len = tt; return S_EBACK; }
    }
  }
  return S_HOME;
}

/**
 * Render kind of a state for agent i (K_*; -1 when hidden: at work or at the errand).
 * @returns {number}
 */
export function agentKind(c, i, s) {
  if (s === S_OUT || s === S_BACK) { const k = MODE_KIND[c.mode[i] & 15]; return k < 0 ? K_WALK : k; }
  if (s === S_EOUT || s === S_EBACK) return K_ERRAND;
  return s === S_HOME ? K_HOME : -1;
}

/** Palette class of (state, kind): 0 walk, 1 drive out, 2 drive home, 3 bike, 4 transit, 5 errand, 6 home; -1 hidden. */
export function colorClass(s, kind) {
  if (s === S_OUT || s === S_BACK) {
    if (kind === K_DRIVE) return s === S_OUT ? 1 : 2;
    return kind === K_WALK ? 0 : kind === K_BIKE ? 3 : kind === K_TRANSIT ? 4 : 0;
  }
  if (s === S_EOUT || s === S_EBACK) return 5;
  return s === S_HOME ? 6 : -1;
}

const _ra = { x: 0, y: 0, dx: 0, dy: 0, k: 0 }, _rb = { x: 0, y: 0, dx: 0, dy: 0, k: 0 }, _rc = { x: 0, y: 0, dx: 0, dy: 0, k: 0 };
const _bz = { px: 0, py: 0, tx: 0, ty: 0 };

function bezierAt(ax, ay, bx, by, cv, k, g, o) {
  const vx = bx - ax, vy = by - ay;
  const cx = (ax + bx) * 0.5 - vy * (cv * k), cy = (ay + by) * 0.5 + vx * (cv * k);
  const h = 1 - g;
  o.px = ax * (h * h) + cx * (2 * g * h) + bx * (g * g);
  o.py = ay * (h * h) + cy * (2 * g * h) + by * (g * g);
  let tx = (cx - ax) * (2 * h) + (bx - cx) * (2 * g), ty = (cy - ay) * (2 * h) + (by - cy) * (2 * g);
  const l = Math.sqrt(tx * tx + ty * ty);
  if (l > 1e-9) { tx /= l; ty /= l; } else { tx = 1; ty = 0; }
  o.tx = tx; o.ty = ty;
}

/**
 * Position of agent i in state s (from agentPhase with phase P): out = {state, kind, x, y}. Hidden states report
 * where the person is (work, the errand place, home).
 * @param {object} c chunk @param {number} i @param {number} s @param {object} P @param {RoadNet} net
 * @param {{state:number, kind:number, x:number, y:number}} out
 */
export function agentPlace(c, i, s, P, net, out) {
  const W = c.W, H = c.H;
  const hx = c.home[2 * i] / 65535 * W, hy = c.home[2 * i + 1] / 65535 * H;
  out.state = s;
  if (s === S_HOME) { out.kind = K_HOME; out.x = hx; out.y = hy; return out; }
  const dx = c.dest[2 * i] / 65535 * W, dy = c.dest[2 * i + 1] / 65535 * H;
  if (s === S_WORK) { out.kind = -1; out.x = dx; out.y = dy; return out; }
  const ex = hx + c.eoff[2 * i] * 0.25, ey = hy + c.eoff[2 * i + 1] * 0.25;
  if (s === S_EAT) { out.kind = -1; out.x = ex; out.y = ey; return out; }
  const e = c.errand[i], jit = e >>> 26;
  const lane = (jit & 7) / 7, cv = ((jit >> 3) & 7) / 7 * 2 - 1;
  const back = s === S_BACK || s === S_EBACK;
  const f = P.u / P.len;
  let px, py, tx, ty, laneOff;
  if (s === S_EOUT || s === S_EBACK) {
    out.kind = K_ERRAND;
    laneOff = ((e >>> 25) & 1) === 1 ? CROWD.laneDrive0 + CROWD.laneDrive1 * lane : CROWD.laneOther0 + CROWD.laneOther1 * lane;
    bezierAt(hx, hy, ex, ey, cv, CROWD.errCurve, back ? 1 - f : f, _bz);
    px = _bz.px; py = _bz.py; tx = _bz.tx; ty = _bz.ty;
  } else {
    let kind = MODE_KIND[c.mode[i] & 15];
    if (kind < 0) kind = K_WALK;
    out.kind = kind;
    laneOff = kind === K_DRIVE ? CROWD.laneDrive0 + CROWD.laneDrive1 * lane : CROWD.laneOther0 + CROWD.laneOther1 * lane;
    const line = c.route[3 * i];
    if (line !== 0) {
      const l = line - 1, L = net.lines[4 * l + 2];
      const s0 = c.route[3 * i + 1] / 65535 * L, s1 = c.route[3 * i + 2] / 65535 * L;
      const on = roadAt(net, l, s0, _ra), off = roadAt(net, l, s1, _rb);
      const ox = on.x - hx, oy = on.y - hy, fx = dx - off.x, fy = dy - off.y;
      const d1 = Math.sqrt(ox * ox + oy * oy), d2 = Math.abs(s1 - s0), d3 = Math.sqrt(fx * fx + fy * fy);
      const dayOff = Math.floor(P.start / 1440), sm = P.start - 1440 * dayOff, rd = (P.day + dayOff) % 7;
      const rf = rushFactor(sm, rd);
      const T1 = CROWD.detour * d1 / CROWD.streetKmh, T2 = d2 / (CROWD.highwayKmh * rf), T3 = CROWD.detour * d3 / CROWD.streetKmh;
      const T = Math.max(T1 + T2 + T3, 1e-6);
      const tau = (back ? 1 - f : f) * T;
      if (tau < T1) {
        const g = tau / Math.max(T1, 1e-9);
        px = hx + (on.x - hx) * g; py = hy + (on.y - hy) * g;
        tx = on.x - hx; ty = on.y - hy;
      } else if (tau < T1 + T2) {
        const g = (tau - T1) / Math.max(T2, 1e-9);
        const r = roadAt(net, l, s0 + (s1 - s0) * g, _rc), sg = s1 >= s0 ? 1 : -1;
        px = r.x; py = r.y; tx = r.dx * sg; ty = r.dy * sg;
      } else {
        const g = (tau - T1 - T2) / Math.max(T3, 1e-9);
        px = off.x + (dx - off.x) * g; py = off.y + (dy - off.y) * g;
        tx = dx - off.x; ty = dy - off.y;
      }
      const tl = Math.sqrt(tx * tx + ty * ty);
      if (tl > 1e-9) { tx /= tl; ty /= tl; } else { tx = 1; ty = 0; }
    } else {
      bezierAt(hx, hy, dx, dy, cv, CROWD.curve, back ? 1 - f : f, _bz);
      px = _bz.px; py = _bz.py; tx = _bz.tx; ty = _bz.ty;
    }
  }
  if (back) { tx = -tx; ty = -ty; }
  out.x = px - ty * laneOff; out.y = py + tx * laneOff;
  return out;
}

/**
 * Where agent i is at a minute of the day and day of week: {state, kind, x, y} (agentPhase + agentPlace). This is
 * the function the vertex shader computes (agentGLSL).
 * @returns {{state:number, kind:number, x:number, y:number}}
 */
export function agentPosition(c, i, minute, dow, net, out = { state: 0, kind: 0, x: 0, y: 0 }, P = newPhase()) {
  const s = agentPhase(c, i, minute, dow, P);
  return agentPlace(c, i, s, P, net, out);
}

// ---------------------------------------------------------------- stats

/** A zeroed stats object (Crowd.stats shape). */
export function emptyStats() {
  return { agents: 0, moving: { walk: 0, drive: 0, bike: 0, transit: 0, errand: 0 }, movingTotal: 0, atHome: 0, atWork: 0, atErrand: 0, toWork: 0, toHome: 0 };
}

/**
 * Accumulate agent states of chunk c, agents [i0, i1), into acc (Float64Array(10): home, walk, drive, bike, transit,
 * errand, work, at-errand, to-work, to-home). Time-sliceable.
 */
export function accumulateStates(c, i0, i1, minute, dow, acc, P = newPhase()) {
  for (let i = i0; i < i1; i++) {
    const s = agentPhase(c, i, minute, dow, P);
    if (s === S_HOME) acc[0]++;
    else if (s === S_OUT || s === S_BACK) {
      const k = MODE_KIND[c.mode[i] & 15];
      acc[1 + (k < 0 ? K_WALK : k)]++;
      acc[s === S_OUT ? 8 : 9]++;
    } else if (s === S_EOUT || s === S_EBACK) acc[5]++;
    else if (s === S_WORK) acc[6]++;
    else acc[7]++;
  }
  return acc;
}

/** Stats object from an accumulateStates accumulator. */
export function statsFrom(acc, agents) {
  const st = emptyStats();
  st.agents = agents; st.atHome = acc[0];
  st.moving.walk = acc[1]; st.moving.drive = acc[2]; st.moving.bike = acc[3]; st.moving.transit = acc[4]; st.moving.errand = acc[5];
  st.movingTotal = acc[1] + acc[2] + acc[3] + acc[4] + acc[5];
  st.atWork = acc[6]; st.atErrand = acc[7]; st.toWork = acc[8]; st.toHome = acc[9];
  return st;
}

/**
 * Counts by state for every agent of the chunks at a minute of the day and day of week, with the same function
 * the shader draws by.
 * @returns {ReturnType<typeof emptyStats>}
 */
export function countStates(chunks, minute, dow) {
  const acc = new Float64Array(10), P = newPhase();
  let n = 0;
  for (const c of chunks) { accumulateStates(c, 0, c.count, minute, dow, acc, P); n += c.count; }
  return statsFrom(acc, n);
}

// ---------------------------------------------------------------- picking

/**
 * Nearest drawn agent within r units of (x, y) at a minute and day: {chunk, i, state, kind, x, y, dist} or null.
 * Candidates come from each chunk's pick index (cells the agent's paths cross); only agents the renderer draws
 * count (visibility mask of CLASS_BIT, the level-of-detail keep fraction).
 * @param {object[]} chunks @param {RoadNet} net
 * @param {{mask?:number, keep?:number}} [opts]
 */
export function pickNearest(chunks, net, x, y, r, minute, dow, opts = {}) {
  const mask = opts.mask == null ? 63 : opts.mask, keep = opts.keep == null ? 1 : opts.keep;
  const P = newPhase(), o = { state: 0, kind: 0, x: 0, y: 0 };
  let best = null, bd2 = r * r;
  for (const c of chunks) {
    const pk = c.pick;
    if (!pk || !c.count) continue;
    const G = pk.cell, rr = r + PICK_MARGIN;
    const c0 = Math.max(0, Math.floor((x - rr) / G)), c1 = Math.min(pk.gw - 1, Math.floor((x + rr) / G));
    const r0 = Math.max(0, Math.floor((y - rr) / G)), r1 = Math.min(pk.gh - 1, Math.floor((y + rr) / G));
    for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) {
      const cell = cy * pk.gw + cx;
      for (let j = pk.start[cell], j1 = pk.start[cell + 1]; j < j1; j++) {
        const i = pk.items[j];
        if (keep < 1 && lodValue(c.start + i) >= keep) continue;
        const s = agentPhase(c, i, minute, dow, P);
        const cls = colorClass(s, agentKind(c, i, s));
        if (cls < 0 || !(mask & CLASS_BIT[cls])) continue;
        agentPlace(c, i, s, P, net, o);
        const ddx = o.x - x, ddy = o.y - y, d2 = ddx * ddx + ddy * ddy;
        if (d2 <= bd2) { bd2 = d2; best = { chunk: c, i, state: o.state, kind: o.kind, x: o.x, y: o.y, dist: Math.sqrt(d2) }; }
      }
    }
  }
  return best;
}

// ---------------------------------------------------------------- the GLSL twin

const glf = v => { const s = String(+v); return /[.eE]/.test(s) ? s : s + '.0'; };

/**
 * GLSL ES 3.00 source of the position function, the twin of agentPhase/agentPlace (same constants, same steps).
 * Declares the road samplers u_roadV and u_roadL and defines
 * `int agentEval(vec2 home, vec2 dest, uvec3 tm, uint days, uint mode, uvec3 route, uint ew, vec2 eoff, float minute, int dow, out vec2 pos, out int kind)`,
 * `int colorClass(int s, int kind)` and `uint mix32(uint x)`.
 * @param {RoadNet} net
 * @returns {string}
 */
export function agentGLSL(net) {
  const C = CROWD;
  const kindChain = MODE_KIND.map((k, code) => k >= 0 ? `  if (code == ${code}u) return ${k};` : '').filter(Boolean).join('\n');
  return `
#define S_HOME ${S_HOME}
#define S_OUT ${S_OUT}
#define S_WORK ${S_WORK}
#define S_BACK ${S_BACK}
#define S_EOUT ${S_EOUT}
#define S_EAT ${S_EAT}
#define S_EBACK ${S_EBACK}
#define K_WALK ${K_WALK}
#define K_DRIVE ${K_DRIVE}
#define K_BIKE ${K_BIKE}
#define K_TRANSIT ${K_TRANSIT}
#define K_ERRAND ${K_ERRAND}
#define K_HOME ${K_HOME}
const float UNIT_KM = ${glf(net.unitKm)};
const float VS = ${glf(C.streetKmh)};
const float VH = ${glf(C.highwayKmh)};
const float DETOUR = ${glf(C.detour)};
const float ERR_WALK = ${glf(C.errWalkKmh)};
const float ERR_DRIVE = ${glf(C.errDriveKmh)};
const float ERR_MIN_TT = ${glf(C.errMinTravel)};
const float LANE_D0 = ${glf(C.laneDrive0)};
const float LANE_D1 = ${glf(C.laneDrive1)};
const float LANE_O0 = ${glf(C.laneOther0)};
const float LANE_O1 = ${glf(C.laneOther1)};
const float CURVE = ${glf(C.curve)};
const float ERR_CURVE = ${glf(C.errCurve)};
const int RV_W = ${net.texV.width};
const int RL_W = ${net.texL.width};
uniform highp sampler2D u_roadV;
uniform highp sampler2D u_roadL;

uint mix32(uint x) {
  x ^= x >> 16u; x *= 0x7feb352du;
  x ^= x >> 15u; x *= 0x846ca68bu;
  x ^= x >> 16u;
  return x;
}
vec4 fetchV(int k) { return texelFetch(u_roadV, ivec2(k % RV_W, k / RV_W), 0); }
vec4 fetchL(int l) { return texelFetch(u_roadL, ivec2(l % RL_W, l / RL_W), 0); }
vec4 roadAt(int l, float s) {
  vec4 L = fetchL(l);
  int off = int(L.x + 0.5);
  int cnt = int(L.y + 0.5);
  s = clamp(s, 0.0, L.z);
  int lo = 0;
  int hi = cnt - 1;
  for (int it = 0; it < 16; it++) {
    if (hi - lo <= 1) break;
    int mid = (lo + hi) >> 1;
    if (fetchV(off + mid).z <= s) lo = mid; else hi = mid;
  }
  vec4 a = fetchV(off + lo);
  vec4 b = fetchV(off + lo + 1);
  float seg = b.z - a.z;
  float t = seg > 1e-6 ? (s - a.z) / seg : 0.0;
  vec2 d = b.xy - a.xy;
  float dl = length(d);
  return vec4(a.xy + (b.xy - a.xy) * t, dl > 1e-6 ? d / dl : vec2(1.0, 0.0));
}
float bump(float m, float c, float w) { float x = (m - c) / w; float y = 1.0 - x * x; return y > 0.0 ? y * y : 0.0; }
float rushFactor(float m, int dow) {
  if (dow >= 1 && dow <= 5) return max(0.3, 1.0 - 0.55 * bump(m, 465.0, 110.0) - 0.6 * bump(m, 1035.0, 130.0));
  return max(0.3, 1.0 - 0.15 * bump(m, 810.0, 240.0));
}
float errTravel(vec2 e, uint drive) {
  float km = length(e) * UNIT_KM * DETOUR;
  return max(ERR_MIN_TT, km / (drive == 1u ? ERR_DRIVE : ERR_WALK) * 60.0);
}
int modeKind(uint code) {
${kindChain}
  return -1;
}
int commutePhase(uint days, float dep, float com, float dwl, int day, float m, inout float u, inout float start) {
  if (((days >> uint(day)) & 1u) == 0u) return S_HOME;
  float v = m - dep;
  if (v < 0.0) return S_HOME;
  if (v < com) { u = v; start = dep; return S_OUT; }
  v -= com;
  if (v < dwl) { u = v; return S_WORK; }
  v -= dwl;
  if (v < com) { u = v; start = dep + com + dwl; return S_BACK; }
  return S_HOME;
}
vec2 unitOr(vec2 v) { float l = length(v); return l > 1e-9 ? v / l : vec2(1.0, 0.0); }
vec2 ctrlOf(vec2 a, vec2 b, float cv, float k) { vec2 v = b - a; return (a + b) * 0.5 + vec2(-v.y, v.x) * (cv * k); }
vec2 bez(vec2 a, vec2 c, vec2 b, float g) { float h = 1.0 - g; return a * (h * h) + c * (2.0 * g * h) + b * (g * g); }
vec2 bezTan(vec2 a, vec2 c, vec2 b, float g) { float h = 1.0 - g; return (c - a) * (2.0 * h) + (b - c) * (2.0 * g); }
int colorClass(int s, int kind) {
  if (s == S_OUT || s == S_BACK) {
    if (kind == K_DRIVE) return s == S_OUT ? 1 : 2;
    return kind == K_WALK ? 0 : kind == K_BIKE ? 3 : kind == K_TRANSIT ? 4 : 0;
  }
  if (s == S_EOUT || s == S_EBACK) return 5;
  return s == S_HOME ? 6 : -1;
}
int agentEval(vec2 home, vec2 dest, uvec3 tm, uint days, uint mode, uvec3 route, uint ew, vec2 eoff, float minute, int dow, out vec2 pos, out int kind) {
  float u = 0.0;
  float len = 1.0;
  float start = 0.0;
  int tday = dow;
  int s = S_HOME;
  if (days != 0u) {
    float dep = float(tm.x);
    float com = float(tm.y);
    float dwl = float(tm.z);
    s = commutePhase(days, dep, com, dwl, dow, minute, u, start);
    if (s == S_HOME) {
      tday = (dow + 6) % 7;
      s = commutePhase(days, dep, com, dwl, tday, minute + 1440.0, u, start);
    }
    len = com;
  }
  vec2 ep = home + eoff;
  uint drives = (ew >> 25u) & 1u;
  if (s == S_HOME) {
    uint ed = (ew >> 18u) & 127u;
    if (ed != 0u && ((ed >> uint(dow)) & 1u) != 0u) {
      float v = minute - float(ew & 2047u);
      if (v >= 0.0) {
        float tt = errTravel(eoff, drives);
        if (v < tt) { u = v; len = tt; s = S_EOUT; }
        else {
          v -= tt;
          float dw = float((ew >> 11u) & 127u) * 2.0;
          if (v < dw) { s = S_EAT; }
          else { v -= dw; if (v < tt) { u = v; len = tt; s = S_EBACK; } }
        }
      }
    }
  }
  kind = -1;
  if (s == S_HOME) { kind = K_HOME; pos = home; return s; }
  if (s == S_WORK) { pos = dest; return s; }
  if (s == S_EAT) { pos = ep; return s; }
  uint jit = ew >> 26u;
  float lane = float(jit & 7u) / 7.0;
  float cv = float((jit >> 3u) & 7u) / 7.0 * 2.0 - 1.0;
  bool back = (s == S_BACK || s == S_EBACK);
  float f = u / len;
  vec2 p;
  vec2 dir;
  float laneOff;
  if (s == S_EOUT || s == S_EBACK) {
    kind = K_ERRAND;
    laneOff = drives == 1u ? LANE_D0 + LANE_D1 * lane : LANE_O0 + LANE_O1 * lane;
    float g = back ? 1.0 - f : f;
    vec2 c = ctrlOf(home, ep, cv, ERR_CURVE);
    p = bez(home, c, ep, g);
    dir = unitOr(bezTan(home, c, ep, g));
  } else {
    kind = modeKind(mode & 15u);
    if (kind < 0) kind = K_WALK;
    laneOff = kind == K_DRIVE ? LANE_D0 + LANE_D1 * lane : LANE_O0 + LANE_O1 * lane;
    if (route.x != 0u) {
      int l = int(route.x) - 1;
      float L = fetchL(l).z;
      float s0 = float(route.y) / 65535.0 * L;
      float s1 = float(route.z) / 65535.0 * L;
      vec4 on = roadAt(l, s0);
      vec4 off = roadAt(l, s1);
      float d1 = length(on.xy - home);
      float d2 = abs(s1 - s0);
      float d3 = length(dest - off.xy);
      float dayOff = floor(start / 1440.0);
      float sm = start - 1440.0 * dayOff;
      int rd = (tday + int(dayOff)) % 7;
      float rf = rushFactor(sm, rd);
      float T1 = DETOUR * d1 / VS;
      float T2 = d2 / (VH * rf);
      float T3 = DETOUR * d3 / VS;
      float T = max(T1 + T2 + T3, 1e-6);
      float tau = (back ? 1.0 - f : f) * T;
      if (tau < T1) {
        float g = tau / max(T1, 1e-9);
        p = home + (on.xy - home) * g;
        dir = on.xy - home;
      } else if (tau < T1 + T2) {
        float g = (tau - T1) / max(T2, 1e-9);
        vec4 r = roadAt(l, s0 + (s1 - s0) * g);
        p = r.xy;
        dir = r.zw * (s1 >= s0 ? 1.0 : -1.0);
      } else {
        float g = (tau - T1 - T2) / max(T3, 1e-9);
        p = off.xy + (dest - off.xy) * g;
        dir = dest - off.xy;
      }
      dir = unitOr(dir);
    } else {
      float g = back ? 1.0 - f : f;
      vec2 c = ctrlOf(home, dest, cv, CURVE);
      p = bez(home, c, dest, g);
      dir = unitOr(bezTan(home, c, dest, g));
    }
  }
  if (back) dir = -dir;
  pos = p + vec2(-dir.y, dir.x) * laneOff;
  return s;
}
`;
}

/**
 * @typedef {ReturnType<typeof buildRoadNet>} RoadNet
 * @typedef {import('../engine/world.mjs').World} World
 * @typedef {import('../engine/population.mjs').Population} Population
 */
