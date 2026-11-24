// Legion · the street graph: build, control, route.
//
// Streets arrive as polylines ("strokes") from the procedural generator or from OpenStreetMap. This file turns
// them into a graph: clipped to the view square, joined where they cross or where one ends on another, split
// into edges between intersections, cleaned of slivers and stray pieces, and given intersection control
// (signals on arterials, stop signs elsewhere). Routing is A* for one trip and reverse Dijkstra trees for the
// view's exits, used by everybody leaving toward somewhere outside. DOM-free; the tests run it in Node.

import { cumLengths, pointAt, clipToSquare, segIntersect, pointSegDist, hf } from './street-geo.mjs';
import { hash2, hash3 } from '../engine/rng.mjs';

/**
 * Road classes. rank orders importance; laneW and widths in meters; speed in m/s (posted limits: 25 mph
 * locals, 30 collectors, 35 arterials, 45-55 rural roads and highways, 65 freeways).
 */
export const ROAD = Object.freeze({
  freeway: { rank: 8, laneW: 3.7, speed: 29.1, sidewalk: 0, car: true, foot: false, bike: false, parking: false, shoulder: 3 },
  ramp: { rank: 6, laneW: 3.7, speed: 17.9, sidewalk: 0, car: true, foot: false, bike: false, parking: false, shoulder: 1.5 },
  highway: { rank: 7, laneW: 3.6, speed: 22.4, sidewalk: 0, car: true, foot: true, bike: true, parking: false, shoulder: 2 },
  arterial: { rank: 6, laneW: 3.4, speed: 15.6, sidewalk: 3.0, car: true, foot: true, bike: true, parking: true, shoulder: 0 },
  collector: { rank: 5, laneW: 3.5, speed: 13.4, sidewalk: 2.4, car: true, foot: true, bike: true, parking: true, shoulder: 0 },
  rural: { rank: 5, laneW: 3.3, speed: 20.1, sidewalk: 0, car: true, foot: true, bike: true, parking: false, shoulder: 1 },
  local: { rank: 4, laneW: 3.3, speed: 11.2, sidewalk: 1.8, car: true, foot: true, bike: true, parking: true, shoulder: 0 },
  service: { rank: 2, laneW: 3.0, speed: 4.5, sidewalk: 0, car: true, foot: true, bike: true, parking: false, shoulder: 0 },
  lane: { rank: 2, laneW: 3.1, speed: 8.9, sidewalk: 0, car: true, foot: true, bike: true, parking: false, shoulder: 0.5 },
  alley: { rank: 1, laneW: 4.4, speed: 4.5, sidewalk: 0, car: true, foot: true, bike: true, parking: false, shoulder: 0 },
  driveway: { rank: 0, laneW: 3.0, speed: 3.0, sidewalk: 0, car: true, foot: true, bike: true, parking: false, shoulder: 0 },
  path: { rank: 0, laneW: 2.4, speed: 0, sidewalk: 0, car: false, foot: true, bike: true, parking: false, shoulder: 0 },
});

const SINGLE_LANE = new Set(['alley', 'driveway', 'service', 'lane', 'path']);

/**
 * Fill an edge's width and lane fields from its class and stroke attributes.
 * Two-way single-lane classes (alleys, driveways) carry both directions in one shared lane.
 */
function dressEdge(e, s) {
  const C = ROAD[e.cls] || ROAD.local;
  e.rank = C.rank;
  e.laneW = s.laneW || C.laneW;
  e.speed = s.speed || C.speed;
  e.car = s.car !== undefined ? s.car : C.car;
  e.foot = s.foot !== undefined ? s.foot : C.foot;
  e.bike = s.bike !== undefined ? s.bike : C.bike;
  e.oneway = !!s.oneway;
  e.shared = SINGLE_LANE.has(e.cls);
  const lanes = Math.max(1, s.lanes || (e.cls === 'freeway' ? 4 : e.cls === 'arterial' ? 2 : 1));
  e.lanes = lanes;
  e.lanesF = lanes;
  e.lanesB = e.oneway ? 0 : (s.lanesB !== undefined ? s.lanesB : lanes);
  e.median = s.median || 0;
  e.park = s.park !== undefined ? !!s.park : C.parking;
  e.side = s.sidewalk !== undefined ? s.sidewalk : s.side !== undefined ? s.side : C.sidewalk;
  e.parkway = s.parkway || 0;
  e.shoulder = s.shoulder !== undefined ? s.shoulder : C.shoulder;
  const travel = e.shared ? e.laneW : (e.lanesF + e.lanesB) * e.laneW;
  e.curb = travel / 2 + e.median / 2 + (e.park ? 2.4 : 0) + e.shoulder;   // centerline to curb
  e.half = e.curb + (e.side > 0 ? e.parkway + e.side : 0);                // centerline to the back of the sidewalk
  e.freeway = e.cls === 'freeway';
  e.name = s.name || '';
  e.kind = s.kind || null;           // free-form tag (e.g. 'culdesac', 'loop', 'bulb', 'shore')
  e.bridge = !!s.bridge;
  e.tunnel = !!s.tunnel;
  return e;
}

/**
 * Lateral offset (meters, to the right of travel) of lane `lane` for travel in direction dir (+1 a→b, -1 b→a).
 * Two-way shared lanes ride the centerline offset slightly right so opposing cars pass.
 */
export function laneOffset(e, dir, lane) {
  if (e.shared) return e.cls === 'path' ? 0.6 : 0.9;
  const n = dir > 0 ? e.lanesF : e.lanesB;
  if (e.oneway) return -(n * e.laneW) / 2 + (Math.min(lane, n - 1) + 0.5) * e.laneW;
  return e.median / 2 + (Math.min(lane, Math.max(0, n - 1)) + 0.5) * e.laneW;
}

/** Lanes available for travel in direction dir. */
export const lanesIn = (e, dir) => (dir > 0 ? e.lanesF : e.lanesB);

/** Offset to the center of the sidewalk on one side (side +1 right of a→b, -1 left). */
export function sidewalkOffset(e) { return e.side > 0 ? e.curb + e.parkway + e.side / 2 : e.curb + 1.0; }

/** Offset of the curb-side bike position (right of travel). */
export function bikeOffset(e) { return e.shared ? 0.9 : Math.max(e.laneW * 0.5, e.curb - (e.park ? 2.4 : 0) - 0.8); }

/** Offset of the parking lane center (right of a→b for side +1). */
export function parkingOffset(e) { return e.curb - e.shoulder - 1.2; }

// ---------------------------------------------------------------- the graph

/**
 * The street graph of one view. Nodes: {id, x, y, adj:[{e, end}], exit, side, ctrl, signal}.
 * Edges: {id, a, b, pts, cum, len, cls, name, lanes…, ctrl:[atA, atB], grp:[atA, atB]}.
 */
export class StreetNet {
  constructor(R) {
    /** half size of the view square (meters) */
    this.R = R;
    this.nodes = [];
    this.edges = [];
    this.source = 'procedural';
  }
  /** Add a node and return its id. */
  addNode(x, y) { const id = this.nodes.length; this.nodes.push({ id, x, y, adj: [], exit: false, side: null, ctrl: 'none', signal: null }); return id; }
  /** Add an edge from a polyline whose ends are nodes a and b; returns the edge. */
  addEdge(a, b, pts, attrs) {
    const e = dressEdge({ id: this.edges.length, a, b, cls: attrs.cls || 'local' }, attrs);
    e.pts = pts instanceof Float64Array ? pts : Float64Array.from(pts);
    e.cum = cumLengths(e.pts);
    e.len = e.cum[e.cum.length - 1];
    e.ctrl = ['free', 'free'];
    e.grp = [0, 0];
    this.edges.push(e);
    this.nodes[a].adj.push({ e: e.id, end: 0 });
    this.nodes[b].adj.push({ e: e.id, end: 1 });
    return e;
  }
  /** The node at the other end of edge e from node n. */
  other(e, n) { const E = this.edges[e]; return E.a === n ? E.b : E.a; }
  /** Point and tangent along edge e at arc length s (s measured from node a). */
  pointAt(e, s, out) { const E = this.edges[e]; return pointAt(E.pts, E.cum, s, out); }
  /** Degree of node n. */
  degree(n) { return this.nodes[n].adj.length; }
  /** Unit direction leaving node n along edge e (from the first few meters of the edge). */
  headingFrom(n, e) {
    const E = this.edges[e], p = {};
    const d = Math.min(12, E.len * 0.5);
    if (E.a === n) { pointAt(E.pts, E.cum, d, p); const q = this.nodes[n]; return norm(p.x - q.x, p.y - q.y); }
    pointAt(E.pts, E.cum, E.len - d, p); const q = this.nodes[n]; return norm(p.x - q.x, p.y - q.y);
  }
  /** Total length of the edges, km. */
  lengthKm() { let L = 0; for (const e of this.edges) L += e.len; return L / 1000; }
  /** Nodes flagged as exits (where streets leave the view). */
  exits() { return this.nodes.filter(n => n.exit); }
  /** Build the segment grid used for nearest-street queries (call after the graph is final). */
  index(cell = 40) {
    this._cell = cell;
    this._grid = new Map();
    for (const e of this.edges) {
      for (let k = 0; k + 3 < e.pts.length; k += 2) {
        const x0 = Math.min(e.pts[k], e.pts[k + 2]), x1 = Math.max(e.pts[k], e.pts[k + 2]);
        const y0 = Math.min(e.pts[k + 1], e.pts[k + 3]), y1 = Math.max(e.pts[k + 1], e.pts[k + 3]);
        for (let cx = Math.floor(x0 / cell); cx <= Math.floor(x1 / cell); cx++) for (let cy = Math.floor(y0 / cell); cy <= Math.floor(y1 / cell); cy++) {
          const key = cx * 65536 + cy;
          let b = this._grid.get(key); if (!b) this._grid.set(key, b = []);
          b.push(e.id * 4096 + (k >> 1));
        }
      }
    }
    return this;
  }
  /**
   * Nearest point on the network to (x, y) among edges accepted by `filter(edge)`, searching out to maxD
   * meters: {e, s, d, x, y} or null.
   */
  nearest(x, y, filter = null, maxD = 400) {
    if (!this._grid) this.index();
    const cell = this._cell;
    let best = null, bd = maxD;
    for (let r = 0; r * cell <= maxD + cell; r++) {
      const cx0 = Math.floor(x / cell) - r, cx1 = Math.floor(x / cell) + r, cy0 = Math.floor(y / cell) - r, cy1 = Math.floor(y / cell) + r;
      for (let cx = cx0; cx <= cx1; cx++) for (let cy = cy0; cy <= cy1; cy++) {
        if (r > 0 && cx > cx0 && cx < cx1 && cy > cy0 && cy < cy1) continue;
        const b = this._grid.get(cx * 65536 + cy); if (!b) continue;
        for (const code of b) {
          const ei = Math.floor(code / 4096), k = code % 4096, E = this.edges[ei];
          if (filter && !filter(E)) continue;
          const q = pointSegDist(x, y, E.pts[2 * k], E.pts[2 * k + 1], E.pts[2 * k + 2], E.pts[2 * k + 3]);
          if (q.d < bd) { bd = q.d; best = { e: ei, s: E.cum[k] + q.t * (E.cum[k + 1] - E.cum[k]), d: q.d, x: q.x, y: q.y }; }
        }
      }
      if (best && best.d < (r) * cell) break;
    }
    return best;
  }
}

const norm = (x, y) => { const L = Math.hypot(x, y) || 1; return [x / L, y / L]; };

// ---------------------------------------------------------------- building a graph from strokes

/**
 * Build a StreetNet from strokes ({pts, cls, name, lanes, oneway, nocross, ...}) in local meters.
 * Strokes are clipped to the view square; non-freeway strokes are joined where they cross and where an end lies
 * within `snap` meters of another stroke; edges are split at those joints; slivers and stray pieces are pruned
 * so the surface network is one connected component (freeways, which never meet surface streets except by
 * ramps, may stay separate).
 * @param {object[]} strokes
 * @param {number} R half size of the view square
 * @param {{snap?: number, minStub?: number, keepComponents?: boolean}} [opts]
 * @returns {StreetNet}
 */
export function buildNet(strokes, R, { snap = 6, minStub = 9, keepComponents = false } = {}) {
  const pieces = [];
  for (const s of strokes) {
    if (!s.pts || s.pts.length < 4) continue;
    for (const c of clipToSquare(s.pts, R)) pieces.push({ s, pts: c.pts, cuts: [], startCut: c.startCut, endCut: c.endCut });
  }
  const cell = 40;
  const grid = new Map();
  const put = (pi, k) => {
    const p = pieces[pi].pts;
    const x0 = Math.min(p[2 * k], p[2 * k + 2]), x1 = Math.max(p[2 * k], p[2 * k + 2]), y0 = Math.min(p[2 * k + 1], p[2 * k + 3]), y1 = Math.max(p[2 * k + 1], p[2 * k + 3]);
    for (let cx = Math.floor(x0 / cell); cx <= Math.floor(x1 / cell); cx++) for (let cy = Math.floor(y0 / cell); cy <= Math.floor(y1 / cell); cy++) {
      const key = cx * 65536 + cy; let b = grid.get(key); if (!b) grid.set(key, b = []); b.push(pi, k);
    }
  };
  pieces.forEach((p, pi) => { for (let k = 0; k + 3 < p.pts.length; k += 2) put(pi, k >> 1); });
  const crosses = (a, b) => !(a.s.nocross || b.s.nocross);

  // node pool with merging of near-coincident points
  const net = new StreetNet(R);
  const ncell = 3, npool = new Map();
  const nodeAt = (x, y, tol = 1.2) => {
    const cx = Math.floor(x / ncell), cy = Math.floor(y / ncell);
    let best = -1, bd = tol;
    for (let i = cx - 1; i <= cx + 1; i++) for (let j = cy - 1; j <= cy + 1; j++) {
      const b = npool.get(i * 65536 + j); if (!b) continue;
      for (const id of b) { const n = net.nodes[id]; const d = Math.hypot(n.x - x, n.y - y); if (d < bd) { bd = d; best = id; } }
    }
    if (best >= 0) return best;
    const id = net.addNode(x, y);
    const key = cx * 65536 + cy; let b = npool.get(key); if (!b) npool.set(key, b = []); b.push(id);
    return id;
  };

  // snap free ends onto nearby strokes (T-junctions)
  for (let pi = 0; pi < pieces.length; pi++) {
    const P = pieces[pi];
    if (P.s.nocross) continue;
    for (const end of [0, 1]) {
      if (end === 0 ? P.startCut : P.endCut) continue;
      const n = P.pts.length / 2, vi = end === 0 ? 0 : n - 1;
      const x = P.pts[2 * vi], y = P.pts[2 * vi + 1];
      let best = null, bd = snap;
      const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
      for (let i = cx - 1; i <= cx + 1; i++) for (let j = cy - 1; j <= cy + 1; j++) {
        const b = grid.get(i * 65536 + j); if (!b) continue;
        for (let q = 0; q < b.length; q += 2) {
          const qi = b[q], k = b[q + 1];
          if (qi === pi || !crosses(P, pieces[qi])) continue;
          const Q = pieces[qi].pts;
          const r = pointSegDist(x, y, Q[2 * k], Q[2 * k + 1], Q[2 * k + 2], Q[2 * k + 3]);
          if (r.d < bd) { bd = r.d; best = { qi, k, t: r.t, x: r.x, y: r.y }; }
        }
      }
      if (best) {
        P.pts[2 * vi] = best.x; P.pts[2 * vi + 1] = best.y;
        const id = nodeAt(best.x, best.y);
        pieces[best.qi].cuts.push({ k: best.k, t: best.t, id });
        P.cuts.push({ k: end === 0 ? 0 : n - 2, t: end === 0 ? 0 : 1, id });
      }
    }
  }

  // proper crossings
  const seen = new Set();
  for (const b of grid.values()) {
    for (let i = 0; i < b.length; i += 2) for (let j = i + 2; j < b.length; j += 2) {
      const pa = b[i], ka = b[i + 1], pb = b[j], kb = b[j + 1];
      if (pa === pb) continue;
      const A = pieces[pa], B = pieces[pb];
      if (!crosses(A, B)) continue;
      const key = pa < pb ? `${pa}:${ka}:${pb}:${kb}` : `${pb}:${kb}:${pa}:${ka}`;
      if (seen.has(key)) continue; seen.add(key);
      const P = A.pts, Q = B.pts;
      const r = segIntersect(P[2 * ka], P[2 * ka + 1], P[2 * ka + 2], P[2 * ka + 3], Q[2 * kb], Q[2 * kb + 1], Q[2 * kb + 2], Q[2 * kb + 3]);
      if (!r) continue;
      const id = nodeAt(r.x, r.y);
      A.cuts.push({ k: ka, t: r.t, id }); B.cuts.push({ k: kb, t: r.u, id });
    }
  }

  // split every piece at its cuts
  const raw = [];
  for (const P of pieces) {
    const n = P.pts.length / 2;
    const startId = P.cuts.find(c => c.k === 0 && c.t === 0)?.id ?? nodeAt(P.pts[0], P.pts[1]);
    const endId = P.cuts.find(c => c.k === n - 2 && c.t === 1)?.id ?? nodeAt(P.pts[2 * n - 2], P.pts[2 * n - 1]);
    if (P.startCut) net.nodes[startId].exit = true;
    if (P.endCut) net.nodes[endId].exit = true;
    const cuts = P.cuts.slice().sort((a, b) => (a.k + a.t) - (b.k + b.t));
    let curId = startId, cur = [P.pts[0], P.pts[1]];
    let ci = 0;
    for (let k = 0; k < n - 1; k++) {
      while (ci < cuts.length && cuts[ci].k === k) {
        const c = cuts[ci++];
        if (c.id === curId) continue;
        const nd = net.nodes[c.id];
        cur.push(nd.x, nd.y);
        raw.push({ a: curId, b: c.id, pts: cur, s: P.s });
        curId = c.id; cur = [nd.x, nd.y];
      }
      cur.push(P.pts[2 * k + 2], P.pts[2 * k + 3]);
    }
    const en = net.nodes[endId];
    cur[cur.length - 2] = en.x; cur[cur.length - 1] = en.y;
    if (endId !== curId || cur.length > 4) raw.push({ a: curId, b: endId, pts: cur, s: P.s });
  }
  // dedupe and add
  const pairs = new Set();
  for (const r of raw) {
    const pts = dedupePts(r.pts);
    if (pts.length < 4) continue;
    let len = 0; for (let i = 2; i < pts.length; i += 2) len += Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]);
    if (len < 0.5) continue;
    if (r.a === r.b) {
      // a closed loop: split it in the middle so every edge joins two distinct nodes
      if (len < 15) continue;
      const half = splitAtMiddle(pts);
      const mid = net.addNode(half.x, half.y);
      net.addEdge(r.a, mid, half.first, Object.assign({}, r.s));
      net.addEdge(mid, r.b, half.second, Object.assign({}, r.s));
      continue;
    }
    const key = (r.a < r.b ? r.a + ':' + r.b : r.b + ':' + r.a) + ':' + Math.round(len);
    if (pairs.has(key)) continue;
    pairs.add(key);
    net.addEdge(r.a, r.b, pts, Object.assign({}, r.s));
  }
  return finishNet(net, { minStub, keepComponents });
}

function dedupePts(p) {
  const out = [p[0], p[1]];
  for (let i = 2; i < p.length; i += 2) {
    const x = p[i], y = p[i + 1];
    if (Math.hypot(x - out[out.length - 2], y - out[out.length - 1]) > 0.05) out.push(x, y);
    else if (i === p.length - 2) { out[out.length - 2] = x; out[out.length - 1] = y; }
  }
  return out;
}

function splitAtMiddle(pts) {
  const cum = cumLengths(pts), L = cum[cum.length - 1], p = pointAt(pts, cum, L / 2, {});
  const first = [], second = [p.x, p.y];
  for (let i = 0; i <= p.k; i++) first.push(pts[2 * i], pts[2 * i + 1]);
  first.push(p.x, p.y);
  for (let i = p.k + 1; i < cum.length; i++) second.push(pts[2 * i], pts[2 * i + 1]);
  return { x: p.x, y: p.y, first, second };
}

/**
 * Clean a raw graph and rebuild it compactly: drop short dead-end stubs (artifacts of joining), keep the
 * largest connected component (plus freeway components that cross the view), flag exits on the boundary and
 * assign intersection control. Used by both the procedural and the OpenStreetMap builders.
 */
export function finishNet(net, { minStub = 9, keepComponents = false, minEdge = 9 } = {}) {
  net = contractShort(net, minEdge);
  const alive = new Uint8Array(net.edges.length).fill(1);
  const deg = new Int32Array(net.nodes.length);
  for (const e of net.edges) { deg[e.a]++; deg[e.b]++; }
  // prune stubs repeatedly
  for (let pass = 0; pass < 4; pass++) {
    let changed = false;
    for (const e of net.edges) {
      if (!alive[e.id]) continue;
      const da = deg[e.a], db = deg[e.b];
      const deadA = da === 1 && !net.nodes[e.a].exit, deadB = db === 1 && !net.nodes[e.b].exit;
      if ((deadA || deadB) && e.len < minStub && e.kind !== 'culdesac' && e.cls !== 'driveway') {
        alive[e.id] = 0; deg[e.a]--; deg[e.b]--; changed = true;
      }
    }
    if (!changed) break;
  }
  // components over live edges
  const parent = new Int32Array(net.nodes.length).map((_, i) => i);
  const find = i => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  for (const e of net.edges) if (alive[e.id]) { const ra = find(e.a), rb = find(e.b); if (ra !== rb) parent[ra] = rb; }
  const compLen = new Map(), compFree = new Map(), compSurface = new Map();
  for (const e of net.edges) if (alive[e.id]) {
    const r = find(e.a);
    compLen.set(r, (compLen.get(r) || 0) + e.len);
    if (e.freeway || e.cls === 'ramp') compFree.set(r, true); else compSurface.set(r, (compSurface.get(r) || 0) + e.len);
  }
  let main = -1, bl = -1;
  for (const [r, L] of compSurface) if (L > bl) { bl = L; main = r; }
  if (main < 0) for (const [r, L] of compLen) if (L > bl) { bl = L; main = r; }
  const keep = r => r === main || keepComponents || (compFree.get(r) && !compSurface.get(r));
  // rebuild compactly
  const out = new StreetNet(net.R);
  out.source = net.source;
  const map = new Int32Array(net.nodes.length).fill(-1);
  const nodeFor = i => {
    if (map[i] < 0) { const n = net.nodes[i]; map[i] = out.addNode(n.x, n.y); out.nodes[map[i]].exit = n.exit; if (n.osm) out.nodes[map[i]].osm = n.osm; }
    return map[i];
  };
  for (const e of net.edges) {
    if (!alive[e.id] || !keep(find(e.a))) continue;
    const ne = out.addEdge(nodeFor(e.a), nodeFor(e.b), e.pts, e);
    if (e.osmId) ne.osmId = e.osmId;
  }
  markExits(out);
  assignControl(out);
  out.index();
  return out;
}

/**
 * Merge intersections joined by very short edges (a diagonal crossing a grid next to another crossing leaves
 * slivers a few meters long that no car fits on) into one node at their centroid; the edges that met them are
 * re-anchored there. Exits and dead ends are left alone.
 */
function contractShort(net, minEdge) {
  const N = net.nodes.length;
  const parent = new Int32Array(N).map((_, i) => i);
  const find = i => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  let merged = 0;
  for (const e of net.edges) {
    if (e.len >= minEdge || e.freeway) continue;
    const A = net.nodes[e.a], B = net.nodes[e.b];
    if (A.exit || B.exit || A.adj.length < 2 || B.adj.length < 2) continue;
    const ra = find(e.a), rb = find(e.b);
    if (ra !== rb) { parent[ra] = rb; merged++; }
  }
  if (!merged) return net;
  const sx = new Float64Array(N), sy = new Float64Array(N), cnt = new Int32Array(N);
  for (let i = 0; i < N; i++) { const r = find(i); sx[r] += net.nodes[i].x; sy[r] += net.nodes[i].y; cnt[r]++; }
  const out = new StreetNet(net.R);
  out.source = net.source;
  const map = new Int32Array(N).fill(-1);
  const nodeFor = i => {
    const r = find(i);
    if (map[r] < 0) { map[r] = out.addNode(sx[r] / cnt[r], sy[r] / cnt[r]); out.nodes[map[r]].exit = net.nodes[r].exit; if (net.nodes[r].osm) out.nodes[map[r]].osm = net.nodes[r].osm; }
    return map[r];
  };
  for (const e of net.edges) {
    const a = nodeFor(e.a), b = nodeFor(e.b);
    if (a === b) continue;
    const pts = Float64Array.from(e.pts);
    const A = out.nodes[a], B = out.nodes[b], n = pts.length / 2;
    pts[0] = A.x; pts[1] = A.y; pts[2 * n - 2] = B.x; pts[2 * n - 1] = B.y;
    const ne = out.addEdge(a, b, pts, e);
    if (e.osmId) ne.osmId = e.osmId;
  }
  return out;
}

/** Exits: nodes of degree 1 on the view boundary; side 'N' | 'S' | 'E' | 'W'. */
export function markExits(net) {
  const R = net.R, tol = 0.75;
  for (const n of net.nodes) {
    const onEdge = Math.abs(Math.abs(n.x) - R) < tol || Math.abs(Math.abs(n.y) - R) < tol;
    n.exit = onEdge && n.adj.length === 1;
    if (n.exit) {
      const ax = Math.abs(n.x), ay = Math.abs(n.y);
      n.side = ax >= ay ? (n.x > 0 ? 'E' : 'W') : (n.y > 0 ? 'S' : 'N');
    } else n.side = null;
  }
}

/**
 * Intersection control from the classes meeting at each node: signals where two arterial-class roads cross
 * (or by chance where a collector crosses one), two-way stops where a minor road meets a major one, all-way
 * stops among equals in grids, free flow at bends and dead ends. Signal approaches are split into two phase
 * groups by heading.
 */
export function assignControl(net, { seed = 7, allWayShare = 0.65 } = {}) {
  for (const n of net.nodes) {
    n.ctrl = 'none'; n.signal = null;
    if (n.exit || n.adj.length < 3) continue;
    const inc = n.adj.map(a => ({ a, E: net.edges[a.e] })).filter(x => !x.E.freeway);
    if (inc.length < 3) continue;
    const ranks = inc.map(x => x.E.rank).sort((p, q) => q - p);
    const top = ranks[0], second = ranks[1];
    if (top <= 2) continue;                      // alleys, driveways and lanes meeting each other
    const h = hash3(seed, Math.round(n.x * 2), Math.round(n.y * 2));
    // the through road: the highest ranked approach and the one most nearly opposite it
    const heads = inc.map(x => ({ x, h: net.headingFrom(n.id, x.E.id) })).sort((p, q) => q.x.E.rank - p.x.E.rank);
    const lead = heads[0];
    let partner = null, bestDot = 0.5;
    for (const o of heads.slice(1)) {
      const dot = -(o.h[0] * lead.h[0] + o.h[1] * lead.h[1]);
      if (o.x.E.rank >= lead.x.E.rank - 1 && dot > bestDot) { bestDot = dot; partner = o; }
    }
    const through = new Set([lead, partner].filter(Boolean));
    const crossRanks = heads.filter(o => !through.has(o)).map(o => o.x.E.rank);
    const crossTop = crossRanks.length ? Math.max(...crossRanks) : 0;
    const rural = inc.some(x => x.E.cls === 'rural' || x.E.cls === 'lane');
    let kind;
    if (crossTop >= 6 && top >= 6 && !rural) kind = 'signal';                       // two arterial-class roads cross
    else if (top >= 6 && crossTop === 5 && !rural && hf(h, 1) < 0.55) kind = 'signal'; // arterial and collector
    else if (top === 5 && crossTop === 5 && !rural && inc.length >= 4 && hf(h, 2) < 0.3) kind = 'signal';
    else if (top > crossTop || inc.length === 3) kind = 'twoway';                     // minor road stops for the through road
    else kind = hf(h, 3) < allWayShare ? 'allway' : 'twoway';                          // equals: four-way stop or two-way
    n.ctrl = kind === 'signal' ? 'signal' : kind === 'allway' ? 'stop' : 'twoway';
    for (const o of heads) {
      const atEnd = o.x.a.end;                   // 0 when the node is the edge's a end, 1 when its b end
      const aligned = through.has(o) || Math.abs(o.h[0] * lead.h[0] + o.h[1] * lead.h[1]) > 0.8;
      o.x.E.grp[atEnd] = aligned ? 0 : 1;
      o.x.E.ctrl[atEnd] = kind === 'signal' ? 'signal' : kind === 'allway' ? 'stop' : (through.has(o) ? 'free' : 'stop');
    }
    if (kind === 'signal') {
      const big = top >= 6 && crossTop >= 6;
      const cycle = big ? 80 + Math.floor(hf(h, 4) * 30) : 60 + Math.floor(hf(h, 5) * 20);
      n.signal = { cycle, offset: Math.floor(hf(h, 6) * cycle), split: big ? 0.52 : 0.6, yellow: 3.6, allRed: 1.4 };
    }
  }
}

/**
 * Signal aspect for an approach group at time t (epoch ms): 'green' | 'yellow' | 'red'.
 * Group 0 (the through road) gets the first share of the cycle.
 */
export function signalState(sig, grp, t) {
  const c = sig.cycle, u = (((t / 1000 + sig.offset) % c) + c) % c;
  const g0 = c * sig.split - sig.yellow - sig.allRed;
  const startB = c * sig.split;
  const g1 = c - startB - sig.yellow - sig.allRed;
  if (grp === 0) { if (u < g0) return 'green'; if (u < g0 + sig.yellow) return 'yellow'; return 'red'; }
  const v = u - startB;
  if (v >= 0 && v < g1) return 'green';
  if (v >= g1 && v < g1 + sig.yellow) return 'yellow';
  return 'red';
}

// ---------------------------------------------------------------- routing

/** Travel modes: which edges and directions they use and how fast. */
export const MODES = Object.freeze({
  car: { ok: e => e.car, dirOk: (e, dir) => (dir > 0 ? e.lanesF : e.lanesB) > 0 || e.shared, speed: e => e.speed, vmax: 31 },
  bike: { ok: e => e.bike && !e.freeway, dirOk: (e, dir) => e.cls === 'path' || (dir > 0 ? e.lanesF : e.lanesB) > 0 || e.shared, speed: e => Math.min(5.5, e.speed || 5.5), vmax: 5.5 },
  foot: { ok: e => e.foot, dirOk: () => true, speed: () => 1.4, vmax: 1.4 },
});

/** Seconds to traverse `len` meters of edge e in mode m, with a small penalty on minor streets for cars. */
function costOf(m, e, len) {
  if (m === MODES.car) return len / e.speed * (e.cls === 'alley' || e.cls === 'service' || e.cls === 'driveway' ? 2.5 : e.cls === 'local' ? 1.08 : 1);
  return len / m.speed(e);
}

/** Penalty (seconds) for arriving at a node through a controlled approach. */
function nodePenalty(m, E, end) {
  if (m !== MODES.car) return 0;
  const c = E.ctrl[end];
  return c === 'signal' ? 12 : c === 'stop' ? 5 : 0;
}

class Heap {
  constructor() { this.k = []; this.v = []; }
  get size() { return this.k.length; }
  push(key, val) {
    const k = this.k, v = this.v; let i = k.length; k.push(key); v.push(val);
    while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= key) break; k[i] = k[p]; v[i] = v[p]; i = p; }
    k[i] = key; v[i] = val;
  }
  pop() {
    const k = this.k, v = this.v, top = v[0], last = k.length - 1;
    const lk = k[last], lv = v[last]; k.pop(); v.pop();
    if (last > 0) {
      let i = 0;
      for (;;) {
        let c = 2 * i + 1; if (c >= last) break;
        if (c + 1 < last && k[c + 1] < k[c]) c++;
        if (k[c] >= lk) break;
        k[i] = k[c]; v[i] = v[c]; i = c;
      }
      k[i] = lk; v[i] = lv;
    }
    return top;
  }
  peekKey() { return this.k[0]; }
}

/**
 * A place on the network: {e, s} (edge and arc length from its node a) or {node}.
 * @typedef {{e:number, s:number}|{node:number}} Access
 */

/**
 * Routing over a StreetNet: shortest paths (A*) between two places and cached reverse trees to exit nodes.
 * A path is {steps:[{e, dir, from, to}], cost, length}: each step runs along edge e in direction dir from arc
 * length `from` to `to` (decreasing when dir is -1).
 */
export class Router {
  constructor(net) {
    this.net = net;
    this.trees = new Map();
  }

  _starts(m, from) {
    const net = this.net, out = [];
    if (from.node !== undefined) { out.push({ node: from.node, g: 0, step: null }); return out; }
    const E = net.edges[from.e];
    if (!m.ok(E)) return out;
    if (m.dirOk(E, -1)) out.push({ node: E.a, g: costOf(m, E, from.s), step: { e: E.id, dir: -1, from: from.s, to: 0 } });
    if (m.dirOk(E, 1)) out.push({ node: E.b, g: costOf(m, E, E.len - from.s), step: { e: E.id, dir: 1, from: from.s, to: E.len } });
    return out;
  }

  /**
   * Shortest path between two places for a mode ('car' | 'bike' | 'foot'), or null when unreachable.
   * @param {string} mode
   * @param {Access} from
   * @param {Access} to
   */
  path(mode, from, to) {
    const m = MODES[mode] || MODES.car, net = this.net, N = net.nodes.length;
    // same edge, reachable directly
    if (from.e !== undefined && to.e !== undefined && from.e === to.e) {
      const E = net.edges[from.e], dir = to.s >= from.s ? 1 : -1;
      if (m.ok(E) && m.dirOk(E, dir)) return { steps: [{ e: E.id, dir, from: from.s, to: to.s }], cost: costOf(m, E, Math.abs(to.s - from.s)), length: Math.abs(to.s - from.s) };
    }
    const goals = [];
    if (to.node !== undefined) goals.push({ node: to.node, g: 0, step: null });
    else {
      const E = net.edges[to.e];
      if (m.ok(E)) {
        if (m.dirOk(E, 1)) goals.push({ node: E.a, g: costOf(m, E, to.s), step: { e: E.id, dir: 1, from: 0, to: to.s } });
        if (m.dirOk(E, -1)) goals.push({ node: E.b, g: costOf(m, E, E.len - to.s), step: { e: E.id, dir: -1, from: E.len, to: to.s } });
      }
    }
    if (!goals.length) return null;
    const goalMap = new Map(); for (const g of goals) { const o = goalMap.get(g.node); if (!o || g.g < o.g) goalMap.set(g.node, g); }
    let tx = 0, ty = 0;
    for (const g of goals) { tx += net.nodes[g.node].x; ty += net.nodes[g.node].y; }
    tx /= goals.length; ty /= goals.length;
    const slack = to.node !== undefined ? 0 : Math.max(...goals.map(g => Math.hypot(net.nodes[g.node].x - tx, net.nodes[g.node].y - ty)));
    const hfun = n => Math.max(0, Math.hypot(net.nodes[n].x - tx, net.nodes[n].y - ty) - slack) / m.vmax;
    const g = new Float64Array(N).fill(Infinity), prevE = new Int32Array(N).fill(-1), prevN = new Int32Array(N).fill(-1);
    const startStep = new Array(N).fill(null);
    const heap = new Heap();
    for (const s of this._starts(m, from)) if (s.g < g[s.node]) { g[s.node] = s.g; startStep[s.node] = s.step; heap.push(s.g + hfun(s.node), s.node); }
    let best = Infinity, bestGoal = null;
    const closed = new Uint8Array(N);
    while (heap.size) {
      if (heap.peekKey() >= best) break;
      const n = heap.pop();
      if (closed[n]) continue;
      closed[n] = 1;
      const gl = goalMap.get(n);
      if (gl && g[n] + gl.g < best) { best = g[n] + gl.g; bestGoal = gl; }
      for (const a of net.nodes[n].adj) {
        const E = net.edges[a.e];
        if (!m.ok(E)) continue;
        const dir = a.end === 0 ? 1 : -1;
        if (!m.dirOk(E, dir)) continue;
        const o = dir > 0 ? E.b : E.a;
        const nd = g[n] + costOf(m, E, E.len) + nodePenalty(m, E, dir > 0 ? 1 : 0);
        if (nd < g[o]) { g[o] = nd; prevE[o] = E.id; prevN[o] = n; heap.push(nd + hfun(o), o); }
      }
    }
    if (!bestGoal) return null;
    const steps = [];
    if (bestGoal.step) steps.push(bestGoal.step);
    let n = bestGoal.node;
    while (prevE[n] >= 0) {
      const E = net.edges[prevE[n]], p = prevN[n];
      const dir = E.a === p && E.b === n ? 1 : (E.b === p && E.a === n ? -1 : (E.a === p ? 1 : -1));
      steps.push({ e: E.id, dir, from: dir > 0 ? 0 : E.len, to: dir > 0 ? E.len : 0 });
      n = p;
    }
    if (startStep[n]) steps.push(startStep[n]);
    steps.reverse();
    return finishPath(steps, best);
  }

  /**
   * Reverse shortest-path tree to a node: for every node its cost to reach the target and the edge to take.
   * Cached per (mode, target).
   * @returns {{dist: Float64Array, next: Int32Array, dir: Int8Array}}
   */
  tree(mode, target) {
    const key = mode + ':' + target;
    let t = this.trees.get(key);
    if (t) return t;
    const m = MODES[mode] || MODES.car, net = this.net, N = net.nodes.length;
    const dist = new Float64Array(N).fill(Infinity), next = new Int32Array(N).fill(-1), dir = new Int8Array(N);
    dist[target] = 0;
    const heap = new Heap(); heap.push(0, target);
    const closed = new Uint8Array(N);
    while (heap.size) {
      const n = heap.pop();
      if (closed[n]) continue;
      closed[n] = 1;
      for (const a of net.nodes[n].adj) {
        const E = net.edges[a.e];
        if (!m.ok(E)) continue;
        // we arrive at n along E, so travel runs from the other end toward n
        const d = a.end === 1 ? 1 : -1;
        if (!m.dirOk(E, d)) continue;
        const o = d > 0 ? E.a : E.b;
        const nd = dist[n] + costOf(m, E, E.len) + nodePenalty(m, E, d > 0 ? 1 : 0);
        if (nd < dist[o]) { dist[o] = nd; next[o] = E.id; dir[o] = d; heap.push(nd, o); }
      }
    }
    t = { dist, next, dir };
    this.trees.set(key, t);
    if (this.trees.size > 320) this.trees.delete(this.trees.keys().next().value);
    return t;
  }

  /** Cost from a place to a node through the node's tree (Infinity when unreachable). */
  costTo(mode, from, target) {
    const m = MODES[mode] || MODES.car, t = this.tree(mode, target);
    let best = Infinity;
    for (const s of this._starts(m, from)) best = Math.min(best, s.g + t.dist[s.node]);
    return best;
  }

  /** The path from a place to a node read off the node's tree (or null). */
  pathTo(mode, from, target) {
    const m = MODES[mode] || MODES.car, net = this.net, t = this.tree(mode, target);
    let best = null, bc = Infinity;
    for (const s of this._starts(m, from)) { const c = s.g + t.dist[s.node]; if (c < bc) { bc = c; best = s; } }
    if (!best || !Number.isFinite(bc)) return null;
    const steps = best.step ? [best.step] : [];
    let n = best.node, guard = 0;
    while (n !== target && guard++ < N_GUARD) {
      const e = t.next[n]; if (e < 0) return null;
      const E = net.edges[e], d = t.dir[n];
      steps.push({ e, dir: d, from: d > 0 ? 0 : E.len, to: d > 0 ? E.len : 0 });
      n = d > 0 ? E.b : E.a;
    }
    return finishPath(steps, bc);
  }

  /** The path from a node to a place, read off a forward search (A*), for arrivals from an exit. */
  pathFrom(mode, node, to) { return this.path(mode, { node }, to); }
}

const N_GUARD = 1e6;

function finishPath(steps, cost) {
  let length = 0;
  const clean = [];
  for (const s of steps) { const L = Math.abs(s.to - s.from); if (L < 1e-6 && clean.length) continue; length += L; clean.push(s); }
  return { steps: clean, cost, length };
}

/** Plain Dijkstra distances (for tests and diagnostics): cost from `src` node to every node. */
export function dijkstra(net, mode, src) {
  const m = MODES[mode] || MODES.car, N = net.nodes.length;
  const dist = new Float64Array(N).fill(Infinity); dist[src] = 0;
  const heap = new Heap(); heap.push(0, src);
  const closed = new Uint8Array(N);
  while (heap.size) {
    const n = heap.pop(); if (closed[n]) continue; closed[n] = 1;
    for (const a of net.nodes[n].adj) {
      const E = net.edges[a.e]; if (!m.ok(E)) continue;
      const dir = a.end === 0 ? 1 : -1; if (!m.dirOk(E, dir)) continue;
      const o = dir > 0 ? E.b : E.a, nd = dist[n] + costOf(m, E, E.len) + nodePenalty(m, E, dir > 0 ? 1 : 0);
      if (nd < dist[o]) { dist[o] = nd; heap.push(nd, o); }
    }
  }
  return dist;
}

/** Cost of a path's steps recomputed from scratch (tests check it against the router's answer). */
export function pathCost(net, mode, path) {
  const m = MODES[mode] || MODES.car;
  let c = 0;
  path.steps.forEach((s, i) => {
    const E = net.edges[s.e];
    c += costOf(m, E, Math.abs(s.to - s.from));
    const arrivesAtNode = (s.dir > 0 && Math.abs(s.to - E.len) < 1e-9) || (s.dir < 0 && Math.abs(s.to) < 1e-9);
    if (i < path.steps.length - 1 && arrivesAtNode) c += nodePenalty(m, E, s.dir > 0 ? 1 : 0);
  });
  return c;
}

/** Check that consecutive steps of a path share their joining node. */
export function pathIsContiguous(net, path) {
  for (let i = 1; i < path.steps.length; i++) {
    const p = path.steps[i - 1], q = path.steps[i];
    const P = net.edges[p.e], Q = net.edges[q.e];
    const endNode = p.dir > 0 ? P.b : P.a, startNode = q.dir > 0 ? Q.a : Q.b;
    if (endNode !== startNode) return false;
  }
  return true;
}

/** Connected components over edges accepted by filter: {count, sizes, largestShare}. */
export function components(net, filter = () => true) {
  const parent = new Int32Array(net.nodes.length).map((_, i) => i);
  const find = i => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const used = new Set();
  for (const e of net.edges) if (filter(e)) { used.add(e.a); used.add(e.b); const ra = find(e.a), rb = find(e.b); if (ra !== rb) parent[ra] = rb; }
  const sizes = new Map();
  for (const n of used) { const r = find(n); sizes.set(r, (sizes.get(r) || 0) + 1); }
  const arr = [...sizes.values()].sort((a, b) => b - a);
  return { count: arr.length, sizes: arr, largestShare: arr.length ? arr[0] / used.size : 1 };
}

/**
 * Shape statistics of a network, used by the tests to tell styles apart and by the UI's stats line.
 * @param {StreetNet} net
 * @param {number} [landKm2] land area of the view (defaults to the square)
 */
export function netMetrics(net, landKm2) {
  const area = landKm2 || (2 * net.R / 1000) ** 2;
  let inter = 0, four = 0, dead = 0, total = 0, alley = 0, curvy = 0, curvyLen = 0, cul = 0;
  const byClass = {};
  for (const e of net.edges) {
    total += e.len;
    byClass[e.cls] = (byClass[e.cls] || 0) + e.len;
    if (e.cls === 'alley') alley += e.len;
    if (e.cls !== 'driveway' && e.cls !== 'path' && e.len > 25) {
      const n = e.pts.length / 2;
      const chord = Math.hypot(e.pts[2 * n - 2] - e.pts[0], e.pts[2 * n - 1] - e.pts[1]);
      curvy += (e.len / Math.max(1, chord) - 1) * e.len; curvyLen += e.len;
    }
  }
  for (const n of net.nodes) {
    const streetDeg = n.adj.filter(a => { const c = net.edges[a.e].cls; return c !== 'driveway' && c !== 'path' && c !== 'alley'; }).length;
    if (streetDeg >= 3) inter++;
    if (streetDeg >= 4) four++;
    if (streetDeg === 1 && !n.exit) { dead++; if (n.adj.some(a => net.edges[a.e].kind === 'culdesac')) cul++; }
  }
  const streets = total - (byClass.driveway || 0) - (byClass.path || 0);
  return {
    nodes: net.nodes.length, edges: net.edges.length, km: total / 1000, streetKm: streets / 1000,
    intersections: inter, intersectionsPerKm2: inter / area, fourWayShare: inter ? four / inter : 0,
    deadEnds: dead, culdesacs: cul, deadEndsPerKm2: dead / area, alleyShare: total ? alley / total : 0,
    sinuosity: curvyLen ? curvy / curvyLen : 0, streetKmPerKm2: streets / 1000 / area,
    byClassKm: Object.fromEntries(Object.entries(byClass).map(([k, v]) => [k, +(v / 1000).toFixed(3)])),
    exits: net.nodes.filter(n => n.exit).length, signals: net.nodes.filter(n => n.ctrl === 'signal').length,
    stops: net.nodes.filter(n => n.ctrl === 'stop' || n.ctrl === 'twoway').length,
  };
}

/** A stable fingerprint of a network's geometry (for determinism tests). */
export function netFingerprint(net) {
  let h = 0x2545f491;
  for (const n of net.nodes) h = hash3(h, Math.round(n.x * 10), Math.round(n.y * 10));
  for (const e of net.edges) { h = hash3(h, e.a, e.b); h = hash2(h, Math.round(e.len * 10)); }
  return h >>> 0;
}
