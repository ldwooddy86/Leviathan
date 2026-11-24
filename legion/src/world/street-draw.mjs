// Legion · street view painters: everything that does not move, drawn with Canvas 2D in meters.
//
// The tile cache in street-render.mjs calls these with a context already scaled to meters and translated to
// the tile, a level of detail (device pixels per meter) and the sun (for roof facets and shadows). Colors come
// from a palette built from the theme and the place's climate and season: lawns green where it rains, gold in a
// dry summer, gravel in the desert; roofs from the ZIP's roof data (terracotta tile, grey-blue metal, shingle
// greys, weathered wood shake, solar panels); roads with their sidewalks, lane lines, crosswalks and stop bars.

import { hash2, hash3, clamp } from '../engine/rng.mjs';
import { pointAt, hf } from './street-geo.mjs';

// ---------------------------------------------------------------- color helpers

/** Parse '#rgb', '#rrggbb' or 'rgb(a)' into [r, g, b]. */
export function rgb(c) {
  if (Array.isArray(c)) return c;
  c = String(c).trim();
  if (c[0] === '#') {
    if (c.length === 4) return [parseInt(c[1] + c[1], 16), parseInt(c[2] + c[2], 16), parseInt(c[3] + c[3], 16)];
    return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  }
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (m) { const p = m[1].split(',').map(Number); return [p[0], p[1], p[2]]; }
  return [128, 128, 128];
}
/** Mix two colors (t of b) and return css. */
export function mix(a, b, t) { const A = rgb(a), B = rgb(b); return css(A.map((v, i) => v + (B[i] - v) * t)); }
/** Scale a color's brightness (f > 1 lighter). */
export function shade(c, f) { const A = rgb(c); return f >= 1 ? css(A.map(v => v + (255 - v) * (f - 1))) : css(A.map(v => v * f)); }
export function css(a, alpha = 1) { const r = Math.round(clamp(a[0], 0, 255)), g = Math.round(clamp(a[1], 0, 255)), b = Math.round(clamp(a[2], 0, 255)); return alpha >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${alpha})`; }
/** Desaturate toward grey by t. */
export function desat(c, t) { const A = rgb(c), m = (A[0] + A[1] + A[2]) / 3; return css(A.map(v => v + (m - v) * t)); }

// ---------------------------------------------------------------- palette

const LIGHT = {
  land: '#c9c3a6', lawn: '#9db574', lawnDry: '#c8b77f', yard: '#a9b982', xeric: '#cbbd98', forest: '#6e8150', scrub: '#9a9a6b', field: '#b9b07a', pasture: '#9ab868', desert: '#dccaa0',
  water: '#6f9fc6', ocean: '#5f8fbb', surf: '#a9cde4', sand: '#e6d8ab', bay: '#7aa6c9',
  sidewalk: '#d9d5cd', curb: '#bdb8ae', asphalt: '#62656b', asphaltLocal: '#6d7075', asphaltArt: '#56595f', concrete: '#c9c5bb', freeway: '#8a8b88', gravel: '#b8a98a',
  laneWhite: '#f1f0ea', laneYellow: '#e8c547', crosswalk: '#f3f2ec', parkway: '#93ad6a', median: '#8fa866',
  park: '#8fb466', field2: '#7fae58', track: '#b05f45', court: '#5f8f7a', play: '#d7834b', path: '#d9cca8', parking: '#74777c',
  fence: 'rgba(90,80,60,0.35)', shadow: 'rgba(30,35,45,0.32)', pool: '#4fb3d9', poolEdge: '#d6f0f7',
  text: '#1d2229', halo: 'rgba(250,250,245,0.85)', ui: '#2b6cb0',
};
/**
 * The dark theme keeps the map's natural colors (so day still looks like day and night like night) but mutes
 * them: a little less saturated and darker, with light text and halos for the chrome.
 */
const DARK = (() => {
  const out = {};
  for (const k in LIGHT) {
    const v = LIGHT[k];
    out[k] = typeof v === 'string' && v[0] === '#' ? shadeHex(desatHex(v, 0.22), 0.78) : v;
  }
  return Object.assign(out, { fence: 'rgba(40,40,30,0.3)', shadow: 'rgba(10,14,22,0.4)', text: '#e9e7e1', halo: 'rgba(20,22,26,0.85)', ui: '#7fb3ff' });
})();
function desatHex(c, t) { const a = rgbHex(c), m = (a[0] + a[1] + a[2]) / 3; return hexOf(a.map(v => v + (m - v) * t)); }
function shadeHex(c, f) { return hexOf(rgbHex(c).map(v => v * f)); }
function rgbHex(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
function hexOf(a) { return '#' + a.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join(''); }

/**
 * Palette for a scene: the theme's base colors (and any CSS custom property overrides), tinted by the place's
 * climate and the season (Mediterranean California: green from the first rains to May, gold June to November).
 * @param {'light'|'dark'} theme
 * @param {object} ctx scene context (z, mode)
 * @param {number} month 1..12
 * @param {object} [overrides] colors by key (from --street-* custom properties)
 */
export function makePalette(theme, ctx, month, overrides = {}) {
  const P = Object.assign({}, theme === 'dark' ? DARK : LIGHT);
  const z = ctx.z || {};
  const cz = z.cz || 9, rain = z.rain_in || 15;
  const desert = cz === 14 || cz === 15;
  const fogBelt = cz <= 4 || cz === 6;
  // the dry season: late spring to the first rains; fog belts and irrigated lawns stay greener
  const dry = month >= 6 && month <= 11 ? (month === 11 ? 0.55 : 0.9) : month === 5 ? 0.4 : month === 12 ? 0.25 : 0.05;
  const wild = clamp(dry * (fogBelt ? 0.55 : 1) * (rain > 40 ? 0.5 : 1), 0, 1);
  P.open = desert ? P.desert : mix(P.lawn, P.lawnDry, wild);
  P.lawnTone = desert ? P.xeric : mix(P.lawn, P.lawnDry, wild * 0.45);
  P.forestFloor = mix(P.forest, P.lawnDry, wild * 0.3);
  P.dry = wild;
  P.desert = desert;
  P.theme = theme;
  for (const k in overrides) if (overrides[k]) P[k] = overrides[k];
  return P;
}

// ---------------------------------------------------------------- polylines

/** Trace a flat polyline as a path. */
export function tracePoly(g, pts, close = false) {
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  if (close) g.closePath();
}

/** A polyline trimmed by d0 meters at its start and d1 at its end (Float64Array) or null if too short. */
export function trimmed(pts, cum, d0, d1) {
  const L = cum[cum.length - 1];
  if (L - d0 - d1 < 1) return null;
  const out = [];
  const a = pointAt(pts, cum, d0, {});
  out.push(a.x, a.y);
  for (let i = 1; i < cum.length - 1; i++) if (cum[i] > d0 && cum[i] < L - d1) out.push(pts[2 * i], pts[2 * i + 1]);
  const b = pointAt(pts, cum, L - d1, {});
  out.push(b.x, b.y);
  return out;
}

/** Offset a polyline sideways by `off` meters (positive to the right of its direction). */
export function offsetPoly(pts, off) {
  const n = pts.length / 2, out = new Array(pts.length);
  for (let i = 0; i < n; i++) {
    const i0 = Math.max(0, i - 1), i1 = Math.min(n - 1, i + 1);
    let tx = pts[2 * i1] - pts[2 * i0], ty = pts[2 * i1 + 1] - pts[2 * i0 + 1];
    const L = Math.hypot(tx, ty) || 1; tx /= L; ty /= L;
    out[2 * i] = pts[2 * i] - ty * off; out[2 * i + 1] = pts[2 * i + 1] + tx * off;
  }
  return out;
}

// ---------------------------------------------------------------- roads

/** Clearance at a node for markings (cross streets' half widths). */
function nodeClear(net, n, eId) {
  const node = net.nodes[n];
  if (node.exit || node.adj.length < 3) return node.adj.length === 2 ? 0 : 0;
  let w = 0;
  for (const a of node.adj) if (a.e !== eId) w = Math.max(w, net.edges[a.e].half);
  return w;
}

/**
 * Draw the road network in a tile: sidewalks and parkways, asphalt, medians, cul-de-sac bulbs, freeways on top,
 * then lane lines, crosswalks and stop bars (with STOP painted at stop signs at close zoom).
 * @param {CanvasRenderingContext2D} g
 * @param {object} net
 * @param {number[]} edges edge ids in this tile
 * @param {object} P palette
 * @param {number} lod device px per meter
 */
export function drawRoads(g, net, edges, P, lod) {
  const E = edges.map(i => net.edges[i]);
  const surface = E.filter(e => !e.freeway && e.cls !== 'ramp');
  const free = E.filter(e => e.freeway || e.cls === 'ramp');
  g.lineCap = 'round'; g.lineJoin = 'round';
  // sidewalks (and road shoulders of rural roads)
  for (const e of surface) {
    if (e.cls === 'path') continue;
    if (e.side > 0) { g.strokeStyle = P.sidewalk; g.lineWidth = 2 * e.half; g.beginPath(); tracePoly(g, e.pts); g.stroke(); }
  }
  for (const e of surface) {
    if (e.parkway > 0 && e.side > 0) { g.strokeStyle = P.parkway; g.lineWidth = 2 * (e.curb + e.parkway); g.beginPath(); tracePoly(g, e.pts); g.stroke(); }
  }
  // curbs then asphalt
  for (const e of surface) {
    if (e.cls === 'path') continue;
    if (e.side > 0) { g.strokeStyle = P.curb; g.lineWidth = 2 * e.curb + 0.5; g.beginPath(); tracePoly(g, e.pts); g.stroke(); }
  }
  for (const e of surface) {
    g.strokeStyle = surfaceColor(e, P);
    g.lineWidth = e.cls === 'path' ? 2.4 : 2 * e.curb;
    g.beginPath(); tracePoly(g, e.pts); g.stroke();
  }
  // cul-de-sac bulbs
  for (const e of surface) {
    if (e.kind !== 'culdesac') continue;
    for (const n of [e.a, e.b]) {
      const node = net.nodes[n];
      if (node.adj.length !== 1 || node.exit) continue;
      g.fillStyle = P.sidewalk; g.beginPath(); g.arc(node.x, node.y, 13.5, 0, Math.PI * 2); g.fill();
      g.fillStyle = surfaceColor(e, P); g.beginPath(); g.arc(node.x, node.y, 11, 0, Math.PI * 2); g.fill();
      if (lod > 1.5) { g.fillStyle = P.parkway; g.beginPath(); g.arc(node.x, node.y, 3.2, 0, Math.PI * 2); g.fill(); }
    }
  }
  // medians
  for (const e of surface) {
    if (!(e.median > 0)) continue;
    const t = trimmed(e.pts, e.cum, nodeClear(net, e.a, e.id) + 4, nodeClear(net, e.b, e.id) + 4);
    if (!t) continue;
    g.strokeStyle = P.median; g.lineWidth = e.median; g.lineCap = 'round'; g.beginPath(); tracePoly(g, t); g.stroke();
    g.strokeStyle = P.curb; g.lineWidth = 0.3; g.beginPath(); tracePoly(g, offsetPoly(t, e.median / 2)); tracePoly(g, offsetPoly(t, -e.median / 2)); g.stroke();
  }
  if (lod >= 0.7) drawMarkings(g, net, surface, P, lod);
  // freeways ride above everything else, with their shadow
  for (const e of free) {
    g.strokeStyle = P.shadow; g.lineWidth = 2 * e.curb + 2; g.beginPath(); g.save(); g.translate(3, 4); tracePoly(g, e.pts); g.stroke(); g.restore();
  }
  for (const e of free) {
    g.strokeStyle = P.concrete; g.lineWidth = 2 * e.curb + 1.2; g.beginPath(); tracePoly(g, e.pts); g.stroke();
    g.strokeStyle = P.freeway; g.lineWidth = 2 * e.curb - 1.2; g.beginPath(); tracePoly(g, e.pts); g.stroke();
    if (e.median > 0) { g.strokeStyle = P.concrete; g.lineWidth = 0.9; g.beginPath(); tracePoly(g, e.pts); g.stroke(); }
    if (lod >= 0.7) {
      g.setLineDash([3, 9]); g.strokeStyle = P.laneWhite; g.lineWidth = 0.18;
      for (const dir of [1, -1]) for (let k = 1; k < e.lanesF; k++) { const off = dir * (e.median / 2 + k * e.laneW); g.beginPath(); tracePoly(g, offsetPoly(e.pts, off)); g.stroke(); }
      g.setLineDash([]);
    }
  }
}

function surfaceColor(e, P) {
  if (e.cls === 'alley' || e.cls === 'service') return P.concrete;
  if (e.cls === 'lane') return P.gravel;
  if (e.cls === 'path') return P.path;
  if (e.cls === 'driveway') return P.concrete;
  if (e.cls === 'arterial' || e.cls === 'highway') return P.asphaltArt;
  if (e.cls === 'local') return P.asphaltLocal;
  return P.asphalt;
}

function drawMarkings(g, net, edges, P, lod) {
  g.lineCap = 'butt';
  for (const e of edges) {
    if (e.shared || e.cls === 'path' || e.cls === 'lane') continue;
    const c0 = nodeClear(net, e.a, e.id), c1 = nodeClear(net, e.b, e.id);
    const t = trimmed(e.pts, e.cum, c0 + (c0 ? 3.5 : 0), c1 + (c1 ? 3.5 : 0));
    if (!t) continue;
    const major = e.cls === 'arterial' || e.cls === 'collector' || e.cls === 'highway' || e.cls === 'rural';
    if (!e.oneway) {
      if (major) {
        // the double yellow (outside the median when there is one)
        g.strokeStyle = P.laneYellow; g.lineWidth = 0.13;
        const m = e.median > 0 ? e.median / 2 + 0.15 : 0.12;
        g.beginPath(); tracePoly(g, offsetPoly(t, m)); tracePoly(g, offsetPoly(t, -m)); g.stroke();
      } else if (e.cls === 'local' && lod > 2.5 && e.curb > 4.5) {
        g.strokeStyle = P.laneYellow; g.lineWidth = 0.1; g.setLineDash([3, 6]); g.beginPath(); tracePoly(g, t); g.stroke(); g.setLineDash([]);
      }
    }
    // lane dividers and edge lines
    g.strokeStyle = P.laneWhite; g.lineWidth = 0.12;
    for (const dir of e.oneway ? [1] : [1, -1]) {
      const n = dir > 0 ? e.lanesF : e.lanesB;
      if (n > 1) {
        g.setLineDash([3, 9]);
        for (let k = 1; k < n; k++) {
          const off = e.oneway ? -(n * e.laneW) / 2 + k * e.laneW : e.median / 2 + k * e.laneW;
          g.beginPath(); tracePoly(g, offsetPoly(t, dir * off)); g.stroke();
        }
        g.setLineDash([]);
      }
      if (major && (e.park || e.cls === 'rural' || e.cls === 'highway')) {
        const off = (e.oneway ? (n * e.laneW) / 2 : e.median / 2 + n * e.laneW) + 0.1;
        g.beginPath(); tracePoly(g, offsetPoly(t, dir * off)); g.stroke();
      }
    }
  }
  // crosswalks and stop bars at controlled intersections
  if (lod < 1.4) return;
  for (const n of net.nodes) {
    if (n.ctrl === 'none' || n.adj.length < 3) continue;
    for (const a of n.adj) {
      const e = net.edges[a.e];
      if (!edges.includes(e) || e.shared || e.cls === 'path' || e.freeway) continue;
      const c = nodeClear(net, n.id, e.id);
      if (e.len < c + 6) continue;
      const s = a.end === 0 ? c + 1.6 : e.len - c - 1.6;
      const p = pointAt(e.pts, e.cum, s, {});
      const nx = -p.ty, ny = p.tx;
      const w = e.curb;
      // continental crosswalk: bars along the street across its width
      if (n.ctrl === 'signal' || (n.ctrl === 'stop' && e.cls !== 'local') || (n.ctrl === 'stop' && lod > 3)) {
        g.fillStyle = P.crosswalk;
        for (let o = -w + 0.6; o <= w - 0.6; o += 1.2) {
          const cx = p.x + nx * o, cy = p.y + ny * o;
          g.save(); g.translate(cx, cy); g.rotate(Math.atan2(p.ty, p.tx)); g.fillRect(-1.5, -0.3, 3, 0.6); g.restore();
        }
      }
      // stop bar across the approach lanes (right half of the arriving direction)
      const ctrl = e.ctrl[a.end];
      if (ctrl === 'stop' || ctrl === 'signal') {
        const sb = a.end === 0 ? c + 3.6 : e.len - c - 3.6;
        const q = pointAt(e.pts, e.cum, sb, {});
        const dir = a.end === 1 ? 1 : -1;
        const qx = -q.ty * dir, qy = q.tx * dir;           // right of the arriving traffic
        const from = e.oneway ? -w + 0.4 : e.median / 2 + 0.2, to = w - (e.park ? 2.4 : 0.3);
        g.strokeStyle = P.laneWhite; g.lineWidth = 0.45; g.beginPath();
        g.moveTo(q.x + qx * from, q.y + qy * from); g.lineTo(q.x + qx * to, q.y + qy * to); g.stroke();
        if (ctrl === 'stop' && lod > 4) {
          const mid = (from + to) / 2, tx = q.x + qx * mid - q.tx * dir * 3.2, ty = q.y + qy * mid - q.ty * dir * 3.2;
          g.save(); g.translate(tx, ty); g.rotate(Math.atan2(q.ty * dir, q.tx * dir) + Math.PI / 2);
          g.fillStyle = P.laneWhite; g.font = 'bold 1.6px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
          g.scale(1, 1.6); g.fillText('STOP', 0, 0); g.restore();
        }
      }
    }
  }
}

// ---------------------------------------------------------------- lots, areas, pools

/** Yards with a little variety of lawn tone, and their fences at close zoom. */
export function drawLots(g, lots, P, lod, seed) {
  for (const lot of lots) {
    const h = hash2(seed, lot.id);
    const base = lot.kind === 'commercial' || lot.kind === 'industrial' ? P.parking : lot.kind === 'motel' ? P.parking : P.lawnTone;
    g.fillStyle = lot.kind === 'house' || lot.kind === 'small-apartment' || lot.kind === 'church' ? shade(base, 0.92 + hf(h, 1) * 0.16) : base;
    g.beginPath(); tracePoly(g, lot.ring, true); g.fill();
  }
  if (lod >= 1.8) {
    g.strokeStyle = P.fence; g.lineWidth = 0.15;
    for (const lot of lots) { if (lot.kind !== 'house') continue; g.beginPath(); tracePoly(g, lot.ring, true); g.stroke(); }
  }
}

/** Parks, school grounds, parking lots, pods, mobile-home parks. */
export function drawAreas(g, areas, spots, P, lod) {
  for (const a of areas) {
    if (a.kind === 'park') {
      g.fillStyle = P.park; g.beginPath(); tracePoly(g, a.ring, true); g.fill();
      if (a.paths) { g.strokeStyle = P.path; g.lineWidth = 2.2; g.lineCap = 'round'; for (const p of a.paths) { g.beginPath(); tracePoly(g, p); g.stroke(); } }
      for (const f of a.features || []) drawFeature(g, f, P, lod);
    } else if (a.kind === 'school') {
      g.fillStyle = P.lawnTone; g.beginPath(); tracePoly(g, a.ring, true); g.fill();
      for (const f of a.features || []) drawFeature(g, f, P, lod);
    } else if (a.kind === 'parking') {
      g.fillStyle = P.parking; g.beginPath(); tracePoly(g, a.ring, true); g.fill();
    } else if (a.kind === 'commercial' || a.kind === 'apartments') {
      g.fillStyle = a.kind === 'commercial' ? P.parking : P.lawnTone; g.beginPath(); tracePoly(g, a.ring, true); g.fill();
      if (a.kind === 'apartments') { g.fillStyle = P.parking; for (const s of spots) if (s.area === a.id) { g.save(); g.translate(s.x, s.y); g.rotate(s.ang); g.fillRect(-3, -1.5, 6, 3); g.restore(); } }
    } else if (a.kind === 'mhpark') {
      g.fillStyle = P.lawnTone; g.beginPath(); tracePoly(g, a.ring, true); g.fill();
      if (a.lanes) { g.strokeStyle = P.asphaltLocal; g.lineWidth = 6; g.lineCap = 'round'; for (const l of a.lanes) { g.beginPath(); tracePoly(g, l); g.stroke(); } }
    }
  }
  // stall stripes
  if (lod >= 1.2) {
    g.strokeStyle = P.laneWhite; g.lineWidth = 0.12;
    g.beginPath();
    for (const s of spots) {
      if (s.kind !== 'lot') continue;
      const ux = Math.cos(s.ang), uy = Math.sin(s.ang), nx = -uy, ny = ux;
      for (const side of [-1.35, 1.35]) { g.moveTo(s.x + nx * side - ux * 2.6, s.y + ny * side - uy * 2.6); g.lineTo(s.x + nx * side + ux * 2.6, s.y + ny * side + uy * 2.6); }
    }
    g.stroke();
  }
}

function drawFeature(g, f, P, lod) {
  const r = f.ring;
  if (f.kind === 'field') { g.fillStyle = P.field2; g.beginPath(); tracePoly(g, r, true); g.fill(); if (lod > 1) { g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 0.2; g.beginPath(); tracePoly(g, r, true); g.stroke(); } }
  else if (f.kind === 'track') {
    const cx = (r[0] + r[4]) / 2, cy = (r[1] + r[5]) / 2, ux = r[2] - r[0], uy = r[3] - r[1], L = Math.hypot(ux, uy), vx = r[6] - r[0], vy = r[7] - r[1], W = Math.hypot(vx, vy);
    g.save(); g.translate(cx, cy); g.rotate(Math.atan2(uy, ux));
    const rr = W / 2;
    const oval = (inset) => { g.beginPath(); g.moveTo(-L / 2 + rr, -rr + inset); g.lineTo(L / 2 - rr, -rr + inset); g.arc(L / 2 - rr, 0, rr - inset, -Math.PI / 2, Math.PI / 2); g.lineTo(-L / 2 + rr, rr - inset); g.arc(-L / 2 + rr, 0, rr - inset, Math.PI / 2, Math.PI * 1.5); g.closePath(); };
    g.fillStyle = P.track; oval(0); g.fill();
    g.fillStyle = P.field2; oval(7); g.fill();
    if (lod > 1.2) { g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 0.1; for (let k = 1; k < 6; k++) { oval(k * 1.2); g.stroke(); } }
    g.restore();
  } else if (f.kind === 'court') { g.fillStyle = P.court; g.beginPath(); tracePoly(g, r, true); g.fill(); if (lod > 1.5) { g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 0.12; g.beginPath(); tracePoly(g, r, true); g.stroke(); const mx = (r[0] + r[2]) / 2, my = (r[1] + r[3]) / 2, nx2 = (r[4] + r[6]) / 2, ny2 = (r[5] + r[7]) / 2; g.beginPath(); g.moveTo(mx, my); g.lineTo(nx2, ny2); g.stroke(); } }
  else if (f.kind === 'playground') { g.fillStyle = P.play; g.beginPath(); tracePoly(g, r, true); g.fill(); }
}

/** Backyard and motel pools. */
export function drawPools(g, pools, P) {
  for (const p of pools) {
    const r = p.ring;
    g.fillStyle = P.poolEdge; g.beginPath(); tracePoly(g, r, true); g.fill();
    const cx = (r[0] + r[4]) / 2, cy = (r[1] + r[5]) / 2;
    g.fillStyle = P.pool;
    if (p.kidney) {
      const ux = r[2] - r[0], uy = r[3] - r[1], L = Math.hypot(ux, uy), vx = r[6] - r[0], vy = r[7] - r[1], W = Math.hypot(vx, vy);
      g.save(); g.translate(cx, cy); g.rotate(Math.atan2(uy, ux)); g.beginPath(); g.ellipse(-L * 0.18, 0, L * 0.3, W * 0.42, 0, 0, Math.PI * 2); g.ellipse(L * 0.2, W * 0.05, L * 0.26, W * 0.36, 0, 0, Math.PI * 2); g.fill(); g.restore();
    } else {
      g.beginPath();
      const k = 0.82;
      for (let i = 0; i < 4; i++) { const x = cx + (r[2 * i] - cx) * k, y = cy + (r[2 * i + 1] - cy) * k; i ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.closePath(); g.fill();
    }
  }
}

// ---------------------------------------------------------------- buildings

/**
 * Shadow of a footprint ring cast away from the sun: the hull of the ring and the ring moved by the shadow vector.
 */
export function drawShadow(g, ring, sx, sy) {
  const n = ring.length / 2;
  const pts = [];
  for (let i = 0; i < n; i++) pts.push([ring[2 * i], ring[2 * i + 1]], [ring[2 * i] + sx, ring[2 * i + 1] + sy]);
  const hull = convexHull(pts);
  g.beginPath(); g.moveTo(hull[0][0], hull[0][1]); for (let i = 1; i < hull.length; i++) g.lineTo(hull[i][0], hull[i][1]); g.closePath(); g.fill();
}

function convexHull(points) {
  const p = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const q of p) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
  upper.pop(); lower.pop();
  return lower.concat(upper);
}

/** Building height in meters (for shadows). */
export function heightOf(b) {
  const st = b.stories || 1;
  if (b.kind === 'industrial') return 8 + st * 2;
  if (b.kind === 'church') return 9;
  return st * 3.1 + (b.roof && b.roof.shape !== 'flat' ? 1.8 : 0.6);
}

/**
 * A roof seen from above: facets shaded by their orientation to the sun (sun azimuth in radians, screen frame),
 * material texture at close zoom (tile barrels, standing seams, shingle courses, wood shakes, gravel), solar panels
 * on the sunniest facet, parapets and rooftop units on flat roofs, awnings on storefronts, a steeple on churches.
 */
export function drawRoof(g, b, P, lod, sun) {
  const roof = b.roof || { shape: 'flat', color: '#999', mat: 'membrane' };
  let col = roof.color;
  if (P.theme === 'dark') col = shade(desat(col, 0.2), 0.8);
  if (roof.weathered) col = desat(mix(col, '#8d8a80', 0.18), 0.2);
  drawRoofRect(g, b.cx, b.cy, b.ux, b.uy, b.hw, b.hd, roof, col, P, lod, sun, b);
  if (b.wing && b.wing.ring) drawRoofRect(g, b.wing.cx, b.wing.cy, b.ux, b.uy, b.wing.hw, b.wing.hd, roof, col, P, lod, sun, null);
  if (b.poly && b.osm) {
    // OSM footprints that are not rectangles: draw the outline over the rectangle approximation
    g.strokeStyle = shade(col, 0.6); g.lineWidth = 0.25; g.beginPath(); tracePoly(g, b.poly, true); g.stroke();
  }
  if (b.awning && lod > 0.9) {
    // a striped awning along the street side
    const fx = b.cx + b.uy * b.hd, fy = b.cy - b.ux * b.hd;     // front edge (toward the street: -n)
    g.save(); g.translate(fx, fy); g.rotate(Math.atan2(b.uy, b.ux));
    g.fillStyle = b.awning; g.fillRect(-b.hw + 0.3, -1.6, 2 * b.hw - 0.6, 1.6);
    if (lod > 2.5) { g.fillStyle = 'rgba(255,255,255,0.55)'; for (let x = -b.hw + 0.3; x < b.hw - 0.6; x += 1.2) g.fillRect(x, -1.6, 0.5, 1.6); }
    g.restore();
  }
  if (b.steeple) {
    const sx = b.cx - b.ux * (b.hw - 2.5), sy = b.cy - b.uy * (b.hw - 2.5);
    g.fillStyle = shade(col, 0.85); g.beginPath(); g.save(); g.translate(sx, sy); g.rotate(Math.atan2(b.uy, b.ux) + Math.PI / 4); g.fillRect(-2, -2, 4, 4); g.restore();
    if (lod > 2) { g.strokeStyle = '#f2efe6'; g.lineWidth = 0.25; g.beginPath(); g.moveTo(sx - 0.9, sy); g.lineTo(sx + 0.9, sy); g.moveTo(sx, sy - 1.3); g.lineTo(sx, sy + 0.9); g.stroke(); }
  }
}

function drawRoofRect(g, cx, cy, ux, uy, hw, hd, roof, col, P, lod, sun, b) {
  const nx = -uy, ny = ux;
  const corner = (a, c) => [cx + ux * a * hw + nx * c * hd, cy + uy * a * hw + ny * c * hd];
  const sunx = Math.sin(sun.az), suny = -Math.cos(sun.az);      // direction toward the sun, screen frame (y south)
  const lit = (fx, fy) => 1 + 0.2 * clamp(fx * sunx + fy * suny, -1, 1) * sun.strength;
  const facet = (pts, fx, fy) => { g.fillStyle = shade(col, lit(fx, fy)); g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); g.fill(); };
  const shape = roof.shape;
  const h = b ? hash2(0xf00d, b.id) : 77;
  if (shape === 'flat' || lod < 0.5) {
    const r = [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)];
    facet(r, 0, 0);
    if (shape === 'flat' && lod >= 0.8) {
      g.strokeStyle = shade(col, 0.72); g.lineWidth = 0.35; g.beginPath(); g.moveTo(r[0][0], r[0][1]); for (let i = 1; i < 4; i++) g.lineTo(r[i][0], r[i][1]); g.closePath(); g.stroke();
      if (b && b.lightwell) { const w = [[-0.25, -0.15], [0.25, -0.15], [0.25, 0.2], [-0.25, 0.2]].map(([a, c]) => corner(a, c)); g.fillStyle = shade(col, 0.55); g.beginPath(); g.moveTo(w[0][0], w[0][1]); for (let i = 1; i < 4; i++) g.lineTo(w[i][0], w[i][1]); g.closePath(); g.fill(); }
      if (lod >= 1.5 && hw * hd > 40) {
        // rooftop units (air handlers), a hatch
        const units = (roof.units || 0) + (hw * hd > 400 ? 3 : 1);
        for (let k = 0; k < units; k++) {
          const a = (hf(h, k + 1) - 0.5) * 1.4, c = (hf(h, k + 11) - 0.5) * 1.4;
          const [px, py] = corner(a, c);
          g.fillStyle = shade(col, 0.82); g.save(); g.translate(px, py); g.rotate(Math.atan2(uy, ux)); g.fillRect(-1.1, -0.8, 2.2, 1.6);
          g.fillStyle = shade(col, 1.15); g.fillRect(-1.1, -0.8, 2.2, 0.35); g.restore();
        }
      }
      if (roof.solar && lod >= 1.2) solarArray(g, cx, cy, ux, uy, hw * 0.7, hd * 0.6, 0.85, sun);
    }
    return;
  }
  // pitched roofs: the ridge runs along the longer side
  const alongU = hw >= hd;
  const A = alongU ? hw : hd, Bh = alongU ? hd : hw;
  const ax = alongU ? ux : nx, ay = alongU ? uy : ny, bx = alongU ? nx : -ux, by = alongU ? ny : -uy;
  const P2 = (a, c) => [cx + ax * a + bx * c, cy + ay * a + by * c];
  if (shape === 'gable') {
    facet([P2(-A, 0), P2(A, 0), P2(A, Bh), P2(-A, Bh)], bx, by);
    facet([P2(-A, 0), P2(A, 0), P2(A, -Bh), P2(-A, -Bh)], -bx, -by);
  } else {
    const r = Math.min(A - 0.5, Bh);
    facet([P2(-A + r, 0), P2(A - r, 0), P2(A, Bh), P2(-A, Bh)], bx, by);
    facet([P2(-A + r, 0), P2(A - r, 0), P2(A, -Bh), P2(-A, -Bh)], -bx, -by);
    facet([P2(A - r, 0), P2(A, Bh), P2(A, -Bh)], ax, ay);
    facet([P2(-A + r, 0), P2(-A, Bh), P2(-A, -Bh)], -ax, -ay);
  }
  // texture: courses and seams by material
  if (lod >= 2.2) {
    g.save();
    g.beginPath(); const cl = [P2(-A, -Bh), P2(A, -Bh), P2(A, Bh), P2(-A, Bh)]; g.moveTo(cl[0][0], cl[0][1]); for (let i = 1; i < 4; i++) g.lineTo(cl[i][0], cl[i][1]); g.closePath(); g.clip();
    const mat = roof.mat;
    if (mat === 'tile') {
      // barrel tiles run from ridge to eave: lines across the ridge, close together
      g.strokeStyle = shade(col, 0.78); g.lineWidth = 0.09;
      g.beginPath(); for (let a = -A; a <= A; a += 0.36) { const p1 = P2(a, -Bh), p2 = P2(a, Bh); g.moveTo(p1[0], p1[1]); g.lineTo(p2[0], p2[1]); } g.stroke();
      g.strokeStyle = shade(col, 1.12); g.lineWidth = 0.05;
      g.beginPath(); for (let c = -Bh + 0.4; c < Bh; c += 0.42) { const p1 = P2(-A, c), p2 = P2(A, c); g.moveTo(p1[0], p1[1]); g.lineTo(p2[0], p2[1]); } g.stroke();
    } else if (mat === 'metal') {
      g.strokeStyle = shade(col, 1.18); g.lineWidth = 0.06;
      g.beginPath(); for (let a = -A; a <= A; a += 0.5) { const p1 = P2(a, -Bh), p2 = P2(a, Bh); g.moveTo(p1[0], p1[1]); g.lineTo(p2[0], p2[1]); } g.stroke();
    } else if (mat === 'wood') {
      g.strokeStyle = shade(col, 0.8); g.lineWidth = 0.07;
      g.beginPath(); for (let c = -Bh + 0.25; c < Bh; c += 0.3) { const p1 = P2(-A, c), p2 = P2(A, c); g.moveTo(p1[0], p1[1]); g.lineTo(p2[0], p2[1]); } g.stroke();
      g.fillStyle = shade(col, 0.7);
      for (let k = 0; k < 40; k++) { const p = P2((hf(h, k + 50) - 0.5) * 2 * A, (hf(h, k + 90) - 0.5) * 2 * Bh); g.fillRect(p[0], p[1], 0.18, 0.5); }
    } else {
      g.strokeStyle = shade(col, 0.88); g.lineWidth = 0.05;
      g.beginPath(); for (let c = -Bh + 0.2; c < Bh; c += 0.34) { const p1 = P2(-A, c), p2 = P2(A, c); g.moveTo(p1[0], p1[1]); g.lineTo(p2[0], p2[1]); } g.stroke();
    }
    if (roof.weathered) { g.fillStyle = 'rgba(80,85,60,0.25)'; for (let k = 0; k < 18; k++) { const p = P2((hf(h, k + 200) - 0.5) * 2 * A, (hf(h, k + 300) - 0.5) * 2 * Bh); g.beginPath(); g.arc(p[0], p[1], 0.2 + hf(h, k + 400) * 0.5, 0, Math.PI * 2); g.fill(); } }
    g.restore();
  }
  // ridge and hip lines
  if (lod >= 0.9) {
    g.strokeStyle = shade(col, 0.66); g.lineWidth = 0.16; g.beginPath();
    if (shape === 'gable') { const p1 = P2(-A, 0), p2 = P2(A, 0); g.moveTo(p1[0], p1[1]); g.lineTo(p2[0], p2[1]); }
    else {
      const r = Math.min(A - 0.5, Bh);
      const a1 = P2(-A + r, 0), a2 = P2(A - r, 0);
      g.moveTo(a1[0], a1[1]); g.lineTo(a2[0], a2[1]);
      for (const [p, q] of [[a2, P2(A, Bh)], [a2, P2(A, -Bh)], [a1, P2(-A, Bh)], [a1, P2(-A, -Bh)]]) { g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); }
    }
    g.stroke();
  }
  // solar panels on the facet facing the sun's southern arc
  if (roof.solar && lod >= 1 && b) {
    const south = by > 0 ? 1 : -1;          // the long facet facing more to the south (screen +y)
    const fcx = cx + bx * south * Bh * 0.5, fcy = cy + by * south * Bh * 0.5;
    solarArray(g, fcx, fcy, ax, ay, A * 0.72, Bh * 0.36, 0.9, sun);
  }
}

/** A grid of solar panels (dark blue cells with silver frames) centered on a facet. */
function solarArray(g, cx, cy, ux, uy, hw, hd, fill, sun) {
  const pw = 1.0, ph = 1.7;
  const cols = Math.max(1, Math.floor(2 * hw * fill / pw)), rows = Math.max(1, Math.floor(2 * hd * fill / ph));
  g.save(); g.translate(cx, cy); g.rotate(Math.atan2(uy, ux));
  const W = cols * pw, H = rows * ph;
  g.fillStyle = '#c9ced3'; g.fillRect(-W / 2 - 0.1, -H / 2 - 0.1, W + 0.2, H + 0.2);
  const glint = sun.strength > 0 ? 0.12 : 0;
  g.fillStyle = mix('#1c2f52', '#6d8fbf', glint);
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) g.fillRect(-W / 2 + c * pw + 0.05, -H / 2 + r * ph + 0.05, pw - 0.1, ph - 0.1);
  g.restore();
}

// ---------------------------------------------------------------- trees

/**
 * Trees from the packed array [x, y, r, species, shade]: shadows first (passed in by the caller), crowns after.
 * Species: 0 broadleaf, 1 conifer, 2 palm, 3 oak, 4 scrub, 5 orchard.
 */
export function drawTrees(g, trees, idx, P, lod, sun, dark) {
  const greens = dark ? ['#2f4a2c', '#345232', '#2a4128', '#3c5a36'] : ['#4f7a3a', '#5a8742', '#46703a', '#628f45', '#3f6533'];
  const conifer = dark ? '#243a2a' : '#2f5537', palm = dark ? '#3c5a33' : '#5d8b3e', oak = dark ? '#33462c' : '#56703a', scrub = dark ? '#3e4330' : '#7d8455', orchard = dark ? '#2f4a2c' : '#5f8a40';
  if (sun.strength > 0.05) {
    // a tree's shadow stretches away from the sun from the foot of its trunk: an ellipse along the shadow direction
    const ang = Math.atan2(sun.dy, sun.dx), stretch = 1 / Math.tan(Math.max(8, sun.el) * Math.PI / 180);
    g.fillStyle = P.shadow;
    g.beginPath();
    for (const i of idx) {
      const x = trees[5 * i], y = trees[5 * i + 1], r = trees[5 * i + 2], sp = trees[5 * i + 3];
      if (sp === 4) continue;
      const h = sp === 2 ? r * 3.2 : sp === 1 ? r * 3 : r * 1.9;               // palms and conifers are tall for their crowns
      const L = Math.min(h * stretch, h * 3);
      const cx = x + sun.dx * L * 0.55, cy = y + sun.dy * L * 0.55;
      const rx = (sp === 2 ? r * 0.55 : r * 0.9) + L * 0.32, ry = sp === 2 ? r * 0.55 : r * 0.88;
      g.moveTo(cx + Math.cos(ang) * rx, cy + Math.sin(ang) * rx);
      g.ellipse(cx, cy, rx, ry, ang, 0, Math.PI * 2);
    }
    g.fill();
  }
  for (const i of idx) {
    const x = trees[5 * i], y = trees[5 * i + 1], r = trees[5 * i + 2], sp = trees[5 * i + 3], sh = trees[5 * i + 4];
    if (sp === 2) {
      // palm: fronds radiating from the crown
      g.strokeStyle = palm; g.lineWidth = Math.max(0.25, r * 0.16); g.lineCap = 'round';
      g.beginPath();
      const n = 9;
      for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2 + sh * 3; g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6 - 0.2, x + Math.cos(a + 0.25) * r, y + Math.sin(a + 0.25) * r + 0.25); }
      g.stroke();
      g.fillStyle = shade(palm, 0.7); g.beginPath(); g.arc(x, y, r * 0.18, 0, Math.PI * 2); g.fill();
      continue;
    }
    let base = sp === 1 ? conifer : sp === 3 ? oak : sp === 4 ? scrub : sp === 5 ? orchard : greens[Math.floor(sh * greens.length) % greens.length];
    if (P.dry > 0.5 && sp === 0 && sh > 0.8 && !dark) base = mix(base, '#9a8a4a', 0.35);    // a few trees already turning
    if (lod < 1.2 || sp === 4) { g.fillStyle = base; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); continue; }
    if (sp === 1) {
      // conifer: a dark star-shaped crown
      g.fillStyle = base; g.beginPath();
      const n = 10;
      for (let k = 0; k <= 2 * n; k++) { const a = k / (2 * n) * Math.PI * 2, rr = k % 2 ? r * 0.62 : r; const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr; k ? g.lineTo(px, py) : g.moveTo(px, py); }
      g.closePath(); g.fill();
      g.fillStyle = shade(base, 1.25); g.beginPath(); g.arc(x - r * 0.18, y - r * 0.18, r * 0.28, 0, Math.PI * 2); g.fill();
      continue;
    }
    // broadleaf and oak: a lumpy crown, lit on the sun side
    const lx = -sun.dx * 0.25 * r, ly = -sun.dy * 0.25 * r;
    g.fillStyle = shade(base, 0.85); g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    g.fillStyle = base;
    g.beginPath();
    for (let k = 0; k < 5; k++) { const a = k * 1.256 + sh * 6, rr = r * 0.55; g.moveTo(x + Math.cos(a) * r * 0.42 + rr, y + Math.sin(a) * r * 0.42); g.arc(x + Math.cos(a) * r * 0.42, y + Math.sin(a) * r * 0.42, rr, 0, Math.PI * 2); }
    g.fill();
    g.fillStyle = shade(base, 1.22); g.beginPath(); g.arc(x + lx, y + ly, r * 0.4, 0, Math.PI * 2); g.fill();
  }
}

// ---------------------------------------------------------------- ground

/**
 * The ground of a tile: open land by vegetation, water and beaches, farm fields as a patchwork, a hillshade from
 * the terrain (relief), all clipped to the tile rect [x0, y0, x1, y1].
 */
export function drawGround(g, scene, P, rect, lod, hillshade) {
  const [x0, y0, x1, y1] = rect;
  g.fillStyle = P.open; g.fillRect(x0, y0, x1 - x0, y1 - y0);
  const ctx = scene.ctx;
  if (scene.vegOpen === 5 || (ctx.mode === 'rural' && scene.vegOpen === 0)) {
    // fields: a patchwork of crops aligned to the section grid
    const cell = 200, seed = ctx.zseed;
    for (let cx = Math.floor(x0 / cell); cx <= Math.floor(x1 / cell); cx++) for (let cy = Math.floor(y0 / cell); cy <= Math.floor(y1 / cell); cy++) {
      const h = hash3(seed, cx, cy);
      const tones = scene.vegOpen === 0 ? [P.pasture, mix(P.pasture, P.open, 0.4), P.open] : [P.field, mix(P.field, '#7d9a4f', 0.5), mix(P.field, '#c9a96a', 0.5), P.open];
      g.fillStyle = tones[h % tones.length]; g.fillRect(cx * cell + 3, cy * cell + 3, cell - 6, cell - 6);
      if (lod > 0.8 && scene.vegOpen === 5) { g.strokeStyle = 'rgba(70,60,30,0.12)'; g.lineWidth = 0.5; g.beginPath(); for (let k = 6; k < cell; k += 6) { if (h & 1) { g.moveTo(cx * cell + k, cy * cell + 3); g.lineTo(cx * cell + k, cy * cell + cell - 3); } else { g.moveTo(cx * cell + 3, cy * cell + k); g.lineTo(cx * cell + cell - 3, cy * cell + k); } } g.stroke(); }
    }
  }
  if (hillshade) { g.save(); g.globalAlpha = P.theme === 'dark' ? 0.25 : 0.35; g.imageSmoothingEnabled = true; g.drawImage(hillshade.canvas, hillshade.x0, hillshade.y0, hillshade.w, hillshade.h); g.restore(); }
  drawWater(g, scene, P);
}

/**
 * Water from the traced shore outlines (closed rings, filled even-odd so islands stay land): a sand beach band
 * along ocean shores first, then the water, then a lighter surf line at the shore.
 */
function drawWater(g, scene, P) {
  if (!scene.water || !scene.water.length) return;
  g.lineJoin = 'round';
  for (const w of scene.water) if (w.kind === 0) { g.strokeStyle = P.sand; g.lineWidth = 46; g.beginPath(); tracePoly(g, w.pts, true); g.stroke(); }
  for (const kind of [0, 2]) {
    const rings = scene.water.filter(w => w.kind === kind);
    if (!rings.length) continue;
    g.fillStyle = kind === 0 ? P.ocean : P.bay;
    g.beginPath(); for (const w of rings) tracePoly(g, w.pts, true); g.fill('evenodd');
  }
  for (const w of scene.water) {
    g.strokeStyle = w.kind === 0 ? P.surf : shade(P.bay, 1.15); g.lineWidth = w.kind === 0 ? 5 : 2.5;
    g.beginPath(); tracePoly(g, w.pts, true); g.stroke();
  }
}

/** Precompute a hillshade image of the view's terrain (or null when it is flat). */
export function makeHillshade(scene, makeCanvas) {
  const T = scene.ctx.terrain;
  if (!T || !(T.relief > 25)) return null;
  const R = scene.R, n = 96, cell = 2 * R / n;
  const cv = makeCanvas(n, n), g = cv.getContext('2d');
  const img = g.createImageData(n, n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = -R + (i + 0.5) * cell, y = -R + (j + 0.5) * cell;
    const [gx, gy] = T.grad(x, y);
    // light from the northwest (cartographic convention), slope exaggerated a little
    const nx = -gx * 3, ny = -gy * 3, nz = 1;
    const L = Math.hypot(nx, ny, nz);
    const lum = (nx * -0.6 + ny * -0.6 + nz * 0.55) / L;
    const v = clamp(128 + (lum - 0.55) * 360, 0, 255);
    const k = 4 * (j * n + i);
    img.data[k] = v; img.data[k + 1] = v; img.data[k + 2] = v; img.data[k + 3] = Math.abs(v - 128) * 1.6;
  }
  g.putImageData(img, 0, 0);
  return { canvas: cv, x0: -R, y0: -R, w: 2 * R, h: 2 * R };
}

