// Legion · lots, buildings, trees and parking for the street view.
//
// From the street graph and the scene context this file lays out what stands along the streets:
//   * frontage slots on both sides of every street that takes lots, each with a depth measured into its block;
//   * a land-use plan driven by the data: storefront corridors and strip malls sized by the ZIP's retail and food
//     establishments, auto shops, motels, churches and industry by their counts, apartment buildings and duplexes
//     for the households that live in them, houses for the rest (lot widths stretch to the demand);
//   * parks, school campuses, apartment complexes, shopping centers and mobile-home parks filling their areas;
//   * homes on their own sites (with driveways) where land is too thinly settled for a street pattern;
//   * roofs from the ZIP's roof shares (tile, metal, wood shake, asphalt shingle; solar panels at solar_sh), pools
//     where Julys are hot and incomes allow, trees by climate, parking spots for the households' vehicles.
// OpenStreetMap building footprints, when given, replace the procedural buildings. DOM-free.

import { hash2, hash3, clamp, lerp } from '../engine/rng.mjs';
import { pointAt, rectCorners, hf, ringArea, ringCentroid, pointInRing, fbm, pointSegDist } from './street-geo.mjs';
import { sidewalkOffset, parkingOffset } from './street-net.mjs';

// occupancy codes
const FREE = 0, ROAD = 1, AREA = 2, WATER = 3, LOT = 4, BLDG = 5, DRIVE = 6;

/** A 2 m raster over the view recording roads, areas, water, lots and buildings, so nothing overlaps. */
class Occ {
  constructor(R, cell = 2) {
    this.R = R; this.cell = cell; this.n = Math.ceil(2 * R / cell);
    this.code = new Uint8Array(this.n * this.n);
    this.owner = new Int32Array(this.n * this.n).fill(-1);
  }
  idx(x, y) { const i = Math.floor((x + this.R) / this.cell), j = Math.floor((y + this.R) / this.cell); return i < 0 || j < 0 || i >= this.n || j >= this.n ? -1 : j * this.n + i; }
  at(x, y) { const k = this.idx(x, y); return k < 0 ? WATER : this.code[k]; }
  ownerAt(x, y) { const k = this.idx(x, y); return k < 0 ? -1 : this.owner[k]; }
  /** Visit the cells of a convex polygon (flat ring); fn(k) returning false stops. */
  eachInConvex(ring, fn) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < ring.length; i += 2) { x0 = Math.min(x0, ring[i]); x1 = Math.max(x1, ring[i]); y0 = Math.min(y0, ring[i + 1]); y1 = Math.max(y1, ring[i + 1]); }
    const c = this.cell, R = this.R, n = this.n, m = ring.length / 2;
    const i0 = Math.max(0, Math.floor((x0 + R) / c)), i1 = Math.min(n - 1, Math.floor((x1 + R) / c));
    const j0 = Math.max(0, Math.floor((y0 + R) / c)), j1 = Math.min(n - 1, Math.floor((y1 + R) / c));
    let sign = 0;
    for (let k = 0; k < m; k++) { const a = k, b = (k + 1) % m; sign += (ring[2 * b] - ring[2 * a]) * (ring[2 * b + 1] + ring[2 * a + 1]); }
    const s = sign > 0 ? -1 : 1;
    for (let j = j0; j <= j1; j++) {
      const py = -R + (j + 0.5) * c;
      for (let i = i0; i <= i1; i++) {
        const px = -R + (i + 0.5) * c;
        let inside = true;
        for (let k = 0; k < m; k++) {
          const a = k, b = (k + 1) % m;
          const cr = (ring[2 * b] - ring[2 * a]) * (py - ring[2 * a + 1]) - (ring[2 * b + 1] - ring[2 * a + 1]) * (px - ring[2 * a]);
          if (cr * s < 0) { inside = false; break; }
        }
        if (inside && fn(j * n + i) === false) return false;
      }
    }
    return true;
  }
  /** Visit the cells of any simple polygon (even-odd). */
  eachInPolygon(ring, fn) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < ring.length; i += 2) { x0 = Math.min(x0, ring[i]); x1 = Math.max(x1, ring[i]); y0 = Math.min(y0, ring[i + 1]); y1 = Math.max(y1, ring[i + 1]); }
    const c = this.cell, R = this.R, n = this.n;
    const i0 = Math.max(0, Math.floor((x0 + R) / c)), i1 = Math.min(n - 1, Math.floor((x1 + R) / c));
    const j0 = Math.max(0, Math.floor((y0 + R) / c)), j1 = Math.min(n - 1, Math.floor((y1 + R) / c));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (pointInRing(-R + (i + 0.5) * c, -R + (j + 0.5) * c, ring)) fn(j * n + i);
  }
  /** Mark a thick polyline (roads): cells within `half` of it get code (unless already set) and owner. */
  markLine(pts, half, code, owner) {
    const c = this.cell, R = this.R, n = this.n;
    for (let k = 0; k + 3 < pts.length; k += 2) {
      const ax = pts[k], ay = pts[k + 1], bx = pts[k + 2], by = pts[k + 3];
      const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - half + R) / c)), i1 = Math.min(n - 1, Math.floor((Math.max(ax, bx) + half + R) / c));
      const j0 = Math.max(0, Math.floor((Math.min(ay, by) - half + R) / c)), j1 = Math.min(n - 1, Math.floor((Math.max(ay, by) + half + R) / c));
      const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1e-9;
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const px = -R + (i + 0.5) * c, py = -R + (j + 0.5) * c;
        const t = clamp(((px - ax) * dx + (py - ay) * dy) / L2, 0, 1);
        if (Math.hypot(px - ax - t * dx, py - ay - t * dy) <= half) { const q = j * n + i; if (this.code[q] === FREE || this.code[q] === LOT) { this.code[q] = code; this.owner[q] = owner; } }
      }
    }
  }
}

// ---------------------------------------------------------------- roofs

/** Roof palettes: tile terracotta, metal grey-blue, wood shake, asphalt shingle greys and browns, flat roofs. */
export const ROOFS = Object.freeze({
  tile: ['#b4553b', '#c0653f', '#a84b33', '#c97b4c', '#b9613d', '#9e4a35'],
  metal: ['#7d8e9e', '#6e8297', '#8a99a6', '#5f7489', '#9aa8b2', '#6b7f73'],
  wood: ['#8a7357', '#7c6a53', '#94795b', '#6f604f'],
  shingle: ['#5a5c60', '#6a6b6d', '#4e5155', '#79736b', '#6d655d', '#57504a', '#7f8184', '#635e57'],
  membrane: ['#e4e5e1', '#d9dad5', '#cfd2cf', '#eceae4'],
  gravel: ['#8c8982', '#99948a', '#7e7971', '#a29d93'],
  bitumen: ['#3e4043', '#494a4c', '#545659'],
  mobile: ['#d8dbdd', '#cdd1d4', '#e3e3de', '#c9c4b8'],
});

/**
 * A pitched roof for a building in ZIP zi: material drawn at the ZIP's shares (tile_sh, metal_sh, wood_sh, the
 * rest asphalt shingle), solar panels at solar_sh, an age around the ZIP's median roof age.
 */
function pitchedRoof(world, zi, h, era) {
  const z = zi >= 0 ? world.z : null;
  const tile = z ? (z.tile_sh[zi] || 0) / 100 : 0.2, metal = z ? (z.metal_sh[zi] || 0) / 100 : 0.05, wood = z ? (z.wood_sh[zi] || 0) / 100 : 0.05;
  const u = hf(h, 1);
  const mat = u < tile ? 'tile' : u < tile + metal ? 'metal' : u < tile + metal + wood ? 'wood' : 'shingle';
  const pal = ROOFS[mat];
  const solar = hf(h, 2) < (z ? (z.solar_sh[zi] || 0) / 100 : 0.1);
  const medAge = z ? (z.roof_age[zi] || 12) : 12;
  const age = Math.round(clamp(medAge * (0.25 + hf(h, 3) * 1.6), 1, 60));
  const shapeU = hf(h, 4);
  const shape = era === 'grid' ? (shapeU < 0.7 ? 'gable' : 'hip') : era === 'curvi' ? (shapeU < 0.62 ? 'hip' : shapeU < 0.85 ? 'L' : 'gable') : (shapeU < 0.5 ? 'hip' : 'gable');
  return { mat, color: pal[Math.floor(hf(h, 5) * pal.length)], shape, solar, age, weathered: age > 20 };
}

function flatRoof(h, kind) {
  const u = hf(h, 1);
  const mat = kind === 'industrial' ? (u < 0.55 ? 'membrane' : 'gravel') : kind === 'apartment' ? (u < 0.35 ? 'gravel' : u < 0.7 ? 'membrane' : 'bitumen') : (u < 0.5 ? 'membrane' : u < 0.8 ? 'gravel' : 'bitumen');
  const pal = ROOFS[mat];
  return { mat, color: pal[Math.floor(hf(h, 2) * pal.length)], shape: 'flat', solar: hf(h, 3) < 0.06, age: Math.round(5 + hf(h, 4) * 25), weathered: hf(h, 5) < 0.3, units: Math.floor(hf(h, 6) * 4) };
}

// ---------------------------------------------------------------- businesses

const FOOD_BASE = { 'coffee shop': 5, 'pizza place': 4, 'burger joint': 3, 'sandwich shop': 3, bakery: 2, diner: 2, 'donut shop': 2, 'ice cream shop': 1, bar: 2, deli: 1, 'teriyaki place': 1, 'Thai restaurant': 2, 'sushi bar': 2, 'Italian restaurant': 1.5, 'BBQ joint': 1, 'Mediterranean grill': 1.5, 'Chinese restaurant': 1.5, 'Indian restaurant': 1, 'ramen shop': 1, 'boba tea shop': 1, 'juice bar': 1, 'taqueria': 2.5, 'brewpub': 0.8, 'poke bowl shop': 0.8, 'seafood restaurant': 0.8 };
const RETAIL = ['corner market', 'liquor store', 'hardware store', 'pharmacy', 'laundromat', 'thrift store', 'phone repair', 'bike shop', 'bookstore', 'florist', 'nail salon', 'barbershop', 'beauty salon', 'furniture store', 'grocery', 'discount store', 'shoe store', 'clothing boutique', 'pet supply store', 'auto parts store', 'paint store', 'appliance store', 'yoga studio', 'gym', 'dry cleaner', 'party supply store', 'record store', 'toy store', 'mattress store', 'cell phone store'];
const HEALTH = ['dental office', 'medical clinic', 'urgent care', 'optometrist', 'physical therapy', 'chiropractor', 'pediatric clinic', 'veterinary clinic', 'community health center'];
const OFFICE = ['real estate office', 'law office', 'accountant', 'tax preparer', 'architecture studio', 'credit union', 'bank branch', 'travel agency', 'coworking space', 'nonprofit office', 'property management office'];
const AUTO = ['auto repair', 'tire shop', 'smog check', 'body shop', 'car wash', 'gas station', 'auto detailing'];
const MFG = ['machine shop', 'garment factory', 'food processing plant', 'metal fabrication shop', 'print shop', 'cabinet shop', 'plastics plant', 'brewery', 'electronics assembly'];
const WHSE = ['warehouse', 'distribution center', 'self-storage', 'wholesale supplier'];

/** Food-place weights: a generic base plus modest additions where the ZIP's languages and ancestries suggest them. */
function foodWeights(world, zi) {
  const w = Object.assign({}, FOOD_BASE);
  if (zi < 0) return w;
  const z = world.zip(zi), sh = k => (z[k] || 0) / 100;
  const ancSh = k => (z[k] || 0) / Math.max(1, z.pop || 1);   // anc_arm and anc_iran are head counts
  w.taqueria += 6 * sh('span_sh'); w['panadería'] = 4 * sh('span_sh'); w['pupusería'] = 2 * sh('span_sh');
  w['pho place'] = 0.4 + 9 * sh('viet_sh'); w['Vietnamese sandwich shop'] = 5 * sh('viet_sh');
  w['dim sum restaurant'] = 7 * sh('chin_sh'); w['Chinese restaurant'] += 5 * sh('chin_sh'); w['boba tea shop'] += 4 * sh('asian_sh');
  w['Korean barbecue'] = 8 * sh('korean_sh'); w['Filipino bakery'] = 8 * sh('tagalog_sh');
  w['Armenian bakery'] = 6 * ancSh('anc_arm'); w['Persian restaurant'] = 6 * ancSh('anc_iran');
  return w;
}

function weightedPick(weights, u) {
  let tot = 0; for (const k in weights) tot += Math.max(0, weights[k]);
  let x = u * tot;
  for (const k in weights) { x -= Math.max(0, weights[k]); if (x <= 0) return k; }
  return Object.keys(weights)[0];
}

// ---------------------------------------------------------------- frontage

/** Which streets take lots facing them. */
function takesLots(ctx, E) {
  if (E.freeway || E.cls === 'ramp' || E.cls === 'alley' || E.cls === 'driveway' || E.cls === 'path' || E.cls === 'service' || E.cls === 'lane') return false;
  if (ctx.mode === 'urban' && ctx.style === 'curvi' && E.cls === 'arterial') return false;   // houses back onto parkways
  if (E.cls === 'rural' || E.cls === 'highway') {
    const p = pointAt(E.pts, E.cum, E.len / 2, {});
    return ctx.devAt(p.x, p.y) >= ctx.devThreshold;
  }
  return true;
}

/** Distance from a node along an edge before lots may start: the cross streets' widths plus a corner. */
function clearance(net, n, E) {
  const node = net.nodes[n];
  if (node.exit) return 0;
  if (node.adj.length === 1) return E.kind === 'culdesac' ? 12 : 2;
  let w = 0;
  for (const a of node.adj) { if (a.e === E.id) continue; w = Math.max(w, net.edges[a.e].half); }
  return w + (node.adj.length >= 3 ? 3 : 0);
}

/**
 * Plan lots and buildings for a view.
 * @param {object} ctx scene context
 * @param {object} net StreetNet
 * @param {{osmBuildings?: object[]|null, loose?: object[]}} [opts]
 * @returns {{lots: object[], buildings: object[], areas: object[], trees: Float32Array, spots: object[], pools: object[], loose: object[]}}
 */
export function planLots(ctx, net, { osmBuildings = null, loose = null } = {}) {
  const R = ctx.R, world = ctx.world;
  const occ = new Occ(R);
  // water and roads first
  const g = ctx.ground;
  for (let j = 0; j < occ.n; j++) for (let i = 0; i < occ.n; i++) {
    const x = -R + (i + 0.5) * occ.cell, y = -R + (j + 0.5) * occ.cell;
    if (!g.isLand(x, y)) occ.code[j * occ.n + i] = WATER;
  }
  for (const E of net.edges) occ.markLine(E.pts, E.half + 0.6, ROAD, E.id);
  const out = { lots: [], buildings: [], areas: [], trees: [], spots: [], pools: [], loose: [] };
  const style = ctx.mode === 'rural' ? 'town' : ctx.style;
  // areas from the generator (parks, schools, pods) and OSM; clipped to what is free land
  for (const a of (ctx.areas || [])) {
    const c = ringCentroid(a.ring);
    if (Math.abs(c.x) > R + 60 || Math.abs(c.y) > R + 60) continue;
    const area = Object.assign({ id: out.areas.length, cells: 0 }, a);
    occ.eachInPolygon(a.ring, k => { if (occ.code[k] === FREE) { occ.code[k] = AREA; occ.owner[k] = area.id; area.cells++; } });
    if (area.cells * occ.cell * occ.cell < 900) continue;
    out.areas.push(area);
  }
  const B = new Builder(ctx, net, occ, out);
  if (osmBuildings && osmBuildings.length) {
    B.osm(osmBuildings);
  } else {
    // loose homes first (they sit where their households' homes are), then the street pattern
    for (const site of (loose || [])) B.looseHome(site);
    const slots = frontageSlots(ctx, net, occ, style);
    B.plan(slots, style);
  }
  for (const area of out.areas) B.fillArea(area);
  B.trees(style);
  B.curbParking();
  out.trees = Float32Array.from(out.trees);
  return out;
}

/** Slots of nominal width along every street that takes lots, with each slot's depth into its block. */
function frontageSlots(ctx, net, occ, style) {
  const w0 = style === 'grid' ? 8.6 : style === 'tract' ? 15.5 : style === 'curvi' ? 15 : 16;
  const maxDepth = style === 'grid' ? 34 : style === 'tract' ? 38 : style === 'curvi' ? 34 : 44;
  const slots = [];
  const p = {};
  for (const E of net.edges) {
    if (!takesLots(ctx, E)) continue;
    const ca = clearance(net, E.a, E), cb = clearance(net, E.b, E);
    const usable = E.len - ca - cb;
    if (usable < 7) continue;
    const n = Math.max(1, Math.floor(usable / w0));
    const w = usable / n;
    const off = E.half + 0.4;
    for (const side of [1, -1]) {
      // a run is a stretch of consecutive usable slots; anything in the way (a driveway, a pod, water) ends it
      let run = [];
      const flush = () => { if (run.length) { slots.push(run); run = []; } };
      for (let k = 0; k < n; k++) {
        const s0 = ca + k * w, sc = s0 + w / 2;
        pointAt(E.pts, E.cum, sc, p);
        const nx = -p.ty * side, ny = p.tx * side;
        const fx = p.x + nx * off, fy = p.y + ny * off;
        // the road raster covers the corridor plus a little; test a point just past it
        if (occ.at(fx + nx * 1.8, fy + ny * 1.8) !== FREE) { flush(); continue; }
        const ray = castDepth(occ, fx, fy, nx, ny, maxDepth * 2 + 14, net);
        let depth;
        if (ray.what === 'alley' || ray.what === 'wall') depth = ray.d - 1.2;
        else if (ray.what === 'road') depth = ray.d / 2 - 0.6;
        else depth = Math.min(maxDepth, ray.d - 1);
        depth = Math.min(depth, maxDepth);
        if (depth < 9) { flush(); continue; }
        run.push({ e: E.id, side, s0, s1: s0 + w, sc, w, fx, fy, tx: p.tx * side, ty: p.ty * side, nx, ny, depth, rank: E.rank, cls: E.cls, dev: ctx.devAt(fx, fy), use: null });
      }
      flush();
    }
  }
  return slots;   // runs of contiguous slots (one edge side between interruptions)
}

/** March into the block from a lot's front: distance to the next road, area, water or the view's edge. */
function castDepth(occ, x, y, nx, ny, max, net) {
  for (let d = 2; d <= max; d += 1.5) {
    const px = x + nx * d, py = y + ny * d;
    const k = occ.idx(px, py);
    if (k < 0) return { d, what: 'wall' };
    const c = occ.code[k];
    if (c === ROAD) {
      const E = net.edges[occ.owner[k]];
      if (!E) return { d, what: 'road' };
      if (E.cls === 'alley') return { d, what: 'alley' };
      // streets that take no lots on this side (parkways, freeways) are a wall at the back of the lots
      if (E.freeway || E.cls === 'ramp' || (E.cls === 'arterial' && occ.curviArterial)) return { d, what: 'wall' };
      return { d, what: 'road' };
    }
    if (c === AREA || c === WATER) return { d, what: 'wall' };
  }
  return { d: max, what: 'open' };
}

// ---------------------------------------------------------------- the builder

class Builder {
  constructor(ctx, net, occ, out) {
    this.ctx = ctx; this.net = net; this.occ = occ; this.out = out;
    this.world = ctx.world;
    this.seed = ctx.zseed;
    occ.curviArterial = ctx.mode === 'urban' && ctx.style === 'curvi';
    this.food = foodWeights(ctx.world, ctx.zi);
    const z = ctx.z;
    // backyard pools: common where Julys are hot and incomes high
    const tjul = z ? z.tjul || 75 : 75, rich = z ? (z.hh100k_sh || 30) / 100 : 0.3;
    this.poolP = clamp((tjul - 72) / 14, 0, 1) * (0.12 + 0.45 * rich);
    // vegetation from climate
    this.veg = vegetation(ctx);
  }

  zipAt(x, y) { const z = this.ctx.ground.zipAt(x, y); return z >= 0 ? z : this.ctx.zi; }

  /** Claim the free cells of a convex lot ring for a new lot; returns the lot or null when mostly taken. */
  claimLot(ring, kind, minShare = 0.72) {
    const occ = this.occ, id = this.out.lots.length;
    let total = 0, free = 0;
    occ.eachInConvex(ring, k => { total++; if (occ.code[k] === FREE) free++; });
    if (!total || free / total < minShare) return null;
    occ.eachInConvex(ring, k => { if (occ.code[k] === FREE) { occ.code[k] = LOT; occ.owner[k] = id; } });
    const lot = { id, kind, ring: Float64Array.from(ring) };
    this.out.lots.push(lot);
    return lot;
  }

  /** True when a footprint ring lies on cells owned by the lot (or free). */
  fits(ring, lotId) {
    const occ = this.occ;
    let ok = true;
    occ.eachInConvex(ring, k => { const c = occ.code[k]; if (!(c === FREE || (c === LOT && occ.owner[k] === lotId))) { ok = false; return false; } return true; });
    return ok;
  }

  stamp(ring, id, code = BLDG) { const occ = this.occ; occ.eachInConvex(ring, k => { occ.code[k] = code; occ.owner[k] = id; }); }

  /**
   * Add a building. b: {kind, cx, cy, ux, uy, hw, hd, stories, roof, use, label, units, access, lot}.
   * Returns the building or null if it does not fit.
   */
  addBuilding(b, lotId = -1, shrink = true) {
    let ring = rectCorners(b.cx, b.cy, b.ux, b.uy, b.hw, b.hd);
    if (lotId >= 0 || shrink) {
      let tries = 0;
      while (!this.fits(ring, lotId) && tries < 3) {
        if (!shrink) return null;
        b.hw *= 0.85; b.hd *= 0.85; tries++;
        ring = rectCorners(b.cx, b.cy, b.ux, b.uy, b.hw, b.hd);
      }
      if (!this.fits(ring, lotId)) return null;
    }
    b.id = this.out.buildings.length;
    b.ring = Float64Array.from(ring);
    b.zi = b.zi ?? this.zipAt(b.cx, b.cy);
    b.lot = lotId;
    b.residents = 0;
    this.stamp(ring, b.id);
    if (b.wing) {
      const w = b.wing, wr = rectCorners(w.cx, w.cy, b.ux, b.uy, w.hw, w.hd);
      if (this.fits(wr, lotId)) { w.ring = Float64Array.from(wr); this.stamp(wr, b.id); } else b.wing = null;
    }
    this.out.buildings.push(b);
    return b;
  }

  /** Access point of a slot's lot: the curb point on its street and the door at the building front. */
  access(slot, cx, cy) {
    const E = this.net.edges[slot.e];
    const p = pointAt(E.pts, E.cum, clamp(slot.sc, 0, E.len), {});
    const side = slot.side;
    const nx = -p.ty * side, ny = p.tx * side;
    return { e: slot.e, s: clamp(slot.sc, 0, E.len), side, curbX: p.x + nx * (E.curb - 0.4), curbY: p.y + ny * (E.curb - 0.4), walkX: p.x + nx * sidewalkOffset(E), walkY: p.y + ny * sidewalkOffset(E), doorX: cx, doorY: cy };
  }

  // ------------------------------------------------ the land-use plan

  plan(runs, style) {
    const ctx = this.ctx, mix = ctx.mix, bz = ctx.businesses;
    const all = runs.flat();
    if (!all.length) return;
    // demand
    const nShop = Math.round((bz.retail || 0) + (bz.food || 0) + 0.3 * (bz.office || 0) + 0.5 * (bz.health || 0) + (bz.ins_agents || 0) + 0.5 * (bz.solar_co || 0) + 0.5 * (bz.roofers || 0));
    const nAuto = Math.round(bz.auto || 0), nMotel = Math.round(bz.lodging || 0) > 0 ? Math.max(1, Math.round((bz.lodging || 0) / 3)) : 0;
    const nChurch = Math.round((bz.church || 0) * 0.7), nInd = Math.round((bz.mfg || 0) * 0.9 + (bz.whse || 0) + (bz.builders || 0) * 0.25);
    const hasPod = k => this.out.areas.some(a => a.kind === k);
    const aptHH = hasPod('apartments') ? 0 : (mix.apartment || 0);
    const smallHH = mix['small-apartment'] || 0;
    const mhHH = hasPod('mhpark') ? 0 : (mix['mobile-home'] || 0);
    const houseHH = mix.house || 0;
    const shopOnSlots = style === 'curvi' && hasPod('commercial') ? Math.round(nShop * 0.25) : nShop;
    // 1. storefront corridors / strip malls on the biggest streets near the busiest corners
    const shopW = style === 'grid' ? 9.5 : 12;
    let shopNeed = shopOnSlots * shopW + nAuto * 22;
    const runScore = run => {
      const s = run[0];
      const nearSignal = this.nearControl(run) ? 1 : 0;
      return s.rank * 2 + nearSignal * 3 + Math.min(4, (run.reduce((a, x) => a + x.dev, 0) / run.length) / 10) + hf(hash2(this.seed, s.e * 2 + (s.side > 0 ? 1 : 0)), 1) * 2;
    };
    const commercialRuns = runs.filter(r => r.length >= 2 && (r[0].rank >= 6 || (style === 'grid' && r[0].rank >= 5) || (style === 'town' && r[0].rank >= 5)))
      .map(r => [runScore(r), r]).sort((a, b) => b[0] - a[0]).map(x => x[1]);
    for (const run of commercialRuns) {
      if (shopNeed <= 0) break;
      const take = this.orderFromSignal(run);
      let used = 0;
      const chosen = [];
      for (const s of take) { if (used >= shopNeed + 6) break; chosen.push(s); used += s.w; }
      if (used < 16) continue;
      for (const s of chosen) s.use = 'commercial';
      shopNeed -= used;
    }
    const useGrid = (list, cell = 60) => { const map = new Map(); for (const q of list) { const k = Math.floor(q.fx / cell) * 65536 + Math.floor(q.fy / cell); let b = map.get(k); if (!b) map.set(k, b = []); b.push(q); } return { cell, map }; };
    this.byUse = new Map([['commercial', useGrid(all.filter(s => s.use === 'commercial'))]]);
    // 2. industry: a cluster of runs around one seed
    if (nInd > 0) {
      const cand = runs.filter(r => !r.some(s => s.use) && r.length >= 2 && r[0].rank >= 4);
      if (cand.length) {
        const seedRun = cand[Math.floor(hf(this.seed, 71) * cand.length)];
        const sx = seedRun[0].fx, sy = seedRun[0].fy;
        let need = nInd * 45;
        cand.sort((a, b) => Math.hypot(a[0].fx - sx, a[0].fy - sy) - Math.hypot(b[0].fx - sx, b[0].fy - sy));
        for (const r of cand) { if (need <= 0) break; for (const s of r) s.use = 'industrial'; need -= r.reduce((a, s) => a + s.w, 0); }
      }
    }
    // 3. apartments on major streets and near shops, then anywhere
    const aptUnits = style === 'grid' ? 20 : style === 'tract' ? 10 : style === 'curvi' ? 16 : 8;
    let nApt = Math.ceil(aptHH / aptUnits);
    const aptW = style === 'grid' ? 24 : style === 'tract' ? 20 : 30;
    const free = all.filter(s => !s.use);
    for (const s of free) s.aptScore = s.rank * 1.5 + (this.nearUse(s, 'commercial', 120) ? 3 : 0) + hf(hash3(this.seed, s.e, Math.round(s.sc)), 2) * 3;
    const aptCands = free.slice().sort((a, b) => b.aptScore - a.aptScore);
    for (const s of aptCands) {
      if (nApt <= 0) break;
      if (s.use) continue;
      const group = this.grabNeighbors(s, runs, aptW);
      if (!group) continue;
      for (const q of group) q.use = 'apartment';
      group[0].groupLead = group;
      nApt--;
    }
    // 4. churches and motels
    let churches = nChurch;
    for (const s of free) {
      if (churches <= 0) break;
      if (s.use || s.rank < 4 || hf(hash3(this.seed, s.e, Math.round(s.sc * 3)), 4) > 0.06) continue;
      const group = this.grabNeighbors(s, runs, 30);
      if (!group) continue;
      for (const q of group) q.use = 'church';
      group[0].groupLead = group; churches--;
    }
    let motels = nMotel;
    for (const s of free) {
      if (motels <= 0) break;
      if (s.use || s.rank < 6) continue;
      const group = this.grabNeighbors(s, runs, 48);
      if (!group) continue;
      for (const q of group) q.use = 'motel';
      group[0].groupLead = group; motels--;
    }
    // 5. a mobile-home park on a deep stretch of a major street
    if (mhHH >= 12) this.mobileHomePark(runs, mhHH);
    // 6. small apartments scattered, houses on the rest (wider lots where there are more slots than houses)
    const rest = all.filter(s => !s.use);
    const smallW = style === 'grid' ? 9 : 16;
    let nSmall = Math.ceil(smallHH / 3);
    const restW = rest.reduce((a, s) => a + s.w, 0);
    const houseShare = houseHH + (mhHH < 12 ? mhHH : 0);
    const smallFrac = clamp(nSmall * smallW / Math.max(1, restW), 0, 0.9);
    for (const s of rest) {
      if (nSmall <= 0) break;
      if (hf(hash3(this.seed, s.e * 3 + (s.side > 0 ? 1 : 0), Math.round(s.sc)), 6) < smallFrac * 1.1) { s.use = 'small-apartment'; nSmall--; }
    }
    const houses = rest.filter(s => !s.use);
    const ratio = houses.length / Math.max(1, houseShare * 1.08);
    const merge = ratio > 1.6 ? Math.min(4, Math.floor(ratio)) : 1;
    // build in run order so merged lots stay contiguous
    for (const run of runs) {
      for (let k = 0; k < run.length; k++) {
        const s = run[k];
        if (s.done) continue;
        if (s.use === 'commercial') { k = this.buildCommercialRun(run, k, style) - 1; continue; }
        if (s.use === 'industrial') { k = this.buildIndustrialRun(run, k) - 1; continue; }
        if (s.groupLead) { this.buildGroup(s.groupLead, s.use, style); continue; }
        if (s.use === 'small-apartment') { this.buildLotBuilding([s], 'small-apartment', style); continue; }
        if (s.use === 'mhpark' || s.use) continue;
        // houses: merge `merge` consecutive free slots into one lot where there are more slots than houses
        const grp = [s];
        for (let j = 1; j < merge && k + j < run.length && !run[k + j].use && !run[k + j].done; j++) grp.push(run[k + j]);
        k += grp.length - 1;
        this.buildLotBuilding(grp, 'house', style);
      }
    }
  }

  nearControl(run) {
    const E = this.net.edges[run[0].e];
    return this.net.nodes[E.a].ctrl === 'signal' || this.net.nodes[E.b].ctrl === 'signal';
  }

  /** The slots of a run ordered from the end nearest a signal (shops cluster at the corner). */
  orderFromSignal(run) {
    const E = this.net.edges[run[0].e];
    const sigA = this.net.nodes[E.a].ctrl === 'signal', sigB = this.net.nodes[E.b].ctrl === 'signal';
    const fromB = sigB && !sigA ? true : sigA ? false : hf(hash2(this.seed, E.id), 9) < 0.5;
    const sorted = run.slice().sort((p, q) => p.sc - q.sc);
    return fromB ? sorted.reverse() : sorted;
  }

  /** True when a slot already given `use` lies within r meters of slot s (grid lookup). */
  nearUse(s, use, r) {
    const g = this.byUse.get(use);
    if (!g) return false;
    const c = g.cell, n = Math.ceil(r / c), cx = Math.floor(s.fx / c), cy = Math.floor(s.fy / c);
    for (let i = cx - n; i <= cx + n; i++) for (let j = cy - n; j <= cy + n; j++) {
      const b = g.map.get(i * 65536 + j); if (!b) continue;
      for (const q of b) if (Math.hypot(q.fx - s.fx, q.fy - s.fy) <= r) return true;
    }
    return false;
  }

  /** Consecutive free slots of s's run adding up to width w (or null). */
  grabNeighbors(s, runs, w) {
    const run = runs.find(r => r.includes(s));
    if (!run) return null;
    const k = run.indexOf(s);
    const group = [s];
    let tot = s.w;
    for (let j = k + 1; j < run.length && tot < w; j++) { if (run[j].use) break; group.push(run[j]); tot += run[j].w; }
    if (tot < w * 0.75) return null;
    return group;
  }

  /** Lot ring for a group of consecutive slots: front along the street, back at the slots' depth. */
  lotRing(group) {
    const a = group[0], b = group[group.length - 1];
    const E = this.net.edges[a.e];
    const p0 = pointAt(E.pts, E.cum, Math.min(a.s0, b.s0, a.s1, b.s1), {}), p1 = pointAt(E.pts, E.cum, Math.max(a.s0, b.s0, a.s1, b.s1), {});
    const off = E.half + 0.4, side = a.side;
    const n0x = -p0.ty * side, n0y = p0.tx * side, n1x = -p1.ty * side, n1y = p1.tx * side;
    const depth = Math.min(...group.map(s => s.depth));
    const f0x = p0.x + n0x * off, f0y = p0.y + n0y * off, f1x = p1.x + n1x * off, f1y = p1.y + n1y * off;
    const ring = side > 0
      ? [f0x, f0y, f1x, f1y, f1x + n1x * depth, f1y + n1y * depth, f0x + n0x * depth, f0y + n0y * depth]
      : [f1x, f1y, f0x, f0y, f0x + n0x * depth, f0y + n0y * depth, f1x + n1x * depth, f1y + n1y * depth];
    const width = group.reduce((t, s) => t + s.w, 0);
    const mid = group[Math.floor(group.length / 2)];
    const sc = (Math.min(a.s0, b.s0) + Math.max(a.s1, b.s1)) / 2;
    const pc = pointAt(E.pts, E.cum, sc, {});
    const nx = -pc.ty * side, ny = pc.tx * side;
    return { ring, width, depth, fx: pc.x + nx * off, fy: pc.y + ny * off, tx: pc.tx * side, ty: pc.ty * side, nx, ny, slot: Object.assign({}, mid, { sc }) };
  }

  /** One building on a lot made of a group of slots: a house, duplex, apartment, church or motel. */
  buildLotBuilding(group, kind, style) {
    for (const s of group) s.done = true;
    const L = this.lotRing(group);
    const lot = this.claimLot(L.ring, kind);
    if (!lot) return null;
    const h = hash3(this.seed, Math.round(L.fx * 4), Math.round(L.fy * 4));
    const ux = L.tx, uy = L.ty, nx = L.nx, ny = L.ny;
    const W = L.width, D = L.depth;
    let b;
    if (kind === 'house') {
      const row = style === 'grid' && W < 10.5;
      const front = style === 'grid' ? lerp(1.5, 4, hf(h, 1)) : style === 'tract' ? lerp(6, 8, hf(h, 1)) : style === 'curvi' ? lerp(5.5, 7, hf(h, 1)) : lerp(6, 12, hf(h, 1));
      const sideGap = row ? 0.2 : clamp(W * 0.1, 1.2, 4);
      const bw = Math.max(5.5, Math.min(W - 2 * sideGap, style === 'grid' ? 9 : lerp(12, 19, hf(h, 2))));
      const bd = clamp(Math.min(D - front - 5, style === 'grid' ? lerp(12, 20, hf(h, 3)) : lerp(10, 15, hf(h, 3))), 7, 24);
      const offAlong = row ? 0 : (hf(h, 4) - 0.5) * Math.max(0, W - bw - 2 * sideGap) * 0.8 + (W - bw > 6 ? (hf(h, 7) < 0.5 ? -1 : 1) * (W - bw) * 0.18 : 0);
      const cx = L.fx + nx * (front + bd / 2) + ux * offAlong, cy = L.fy + ny * (front + bd / 2) + uy * offAlong;
      const roof = pitchedRoof(this.world, this.zipAt(cx, cy), h, style === 'town' ? (this.ctx.yb < 1950 ? 'grid' : 'tract') : style);
      let wing = null;
      if (roof.shape === 'L' && bw > 11) {
        const ww = bw * 0.42, wd = bd * 0.55;
        const sgn = hf(h, 8) < 0.5 ? 1 : -1;
        wing = { cx: cx + ux * sgn * (bw / 2 - ww / 2) - nx * (bd / 2 + wd / 2 - 1), cy: cy + uy * sgn * (bw / 2 - ww / 2) - ny * (bd / 2 + wd / 2 - 1), hw: ww / 2, hd: wd / 2 };
      }
      b = this.addBuilding({ kind: 'house', cx, cy, ux, uy, hw: bw / 2, hd: bd / 2, stories: style === 'grid' ? (hf(h, 5) < 0.6 ? 2 : 1) : (hf(h, 5) < 0.25 ? 2 : 1), roof, units: 1, wing, access: null }, lot.id);
      if (!b) return null;
      b.access = this.access(L.slot, L.fx + nx * front, L.fy + ny * front);
      // driveway beside the house to the garage, unless lots are too narrow (old cores park on the street)
      const freeSide = (W - bw) / 2 - Math.abs(offAlong);
      if (!row && W - bw >= 4.5) {
        const sgn = offAlong >= 0 ? -1 : 1;
        const dOff = sgn * (bw / 2 + Math.max(1.6, Math.min(2.2, freeSide / 2 + 1))) + offAlong;
        const x0 = L.fx + ux * dOff, y0 = L.fy + uy * dOff;
        const len = front + Math.min(6, bd * 0.6);
        b.driveway = [x0 - nx * 1.2, y0 - ny * 1.2, x0 + nx * len, y0 + ny * len];
        this.stampDriveway(b.driveway, b.id);
        this.addSpot(x0 + nx * (front * 0.55), y0 + ny * (front * 0.55), Math.atan2(ny, nx), 'driveway', b.id, L.slot);
        if (front > 9.5) this.addSpot(x0 + nx * (front * 0.55 - 5.6), y0 + ny * (front * 0.55 - 5.6), Math.atan2(ny, nx), 'driveway', b.id, L.slot);
        b.access.driveX = x0 + nx * (front * 0.55); b.access.driveY = y0 + ny * (front * 0.55); b.access.driveAng = Math.atan2(ny, nx);
      }
      // a backyard pool where it is hot and incomes allow
      const yard = D - front - bd;
      if (yard > 9 && W - 2 > 6 && hf(h, 9) < this.poolP) {
        const pw = Math.min(W - 4, lerp(4, 7, hf(h, 10))), pd = Math.min(yard - 4, lerp(3, 4.5, hf(h, 11)));
        const pcx = cx + nx * (bd / 2 + 2 + pd / 2), pcy = cy + ny * (bd / 2 + 2 + pd / 2);
        const ring = rectCorners(pcx, pcy, ux, uy, pw / 2, pd / 2);
        if (this.fits(ring, lot.id)) { this.out.pools.push({ ring: Float64Array.from(ring), kidney: hf(h, 12) < 0.4 }); this.stamp(ring, b.id, DRIVE); }
      }
      return b;
    }
    if (kind === 'small-apartment') {
      const front = style === 'grid' ? 1 : lerp(4, 6.5, hf(h, 1));
      const bw = Math.max(7, W - (style === 'grid' ? 0.4 : 3)), bd = clamp(D - front - 4, 9, style === 'grid' ? 22 : 16);
      const cx = L.fx + nx * (front + bd / 2), cy = L.fy + ny * (front + bd / 2);
      const roof = style === 'grid' ? flatRoof(h, 'apartment') : pitchedRoof(this.world, this.zipAt(cx, cy), h, style);
      const units = bw * bd > 230 ? 4 : bw * bd > 150 ? 3 : 2;
      b = this.addBuilding({ kind: 'small-apartment', cx, cy, ux, uy, hw: bw / 2, hd: bd / 2, stories: 2 + (style === 'grid' && hf(h, 2) < 0.5 ? 1 : 0), roof, units }, lot.id);
      if (b) { b.access = this.access(L.slot, L.fx + nx * front, L.fy + ny * front); b.unitsDemand = units; }
      return b;
    }
    if (kind === 'apartment') {
      const front = style === 'grid' ? 0.6 : lerp(3, 6, hf(h, 1));
      const bw = Math.max(10, W - (style === 'grid' ? 0.4 : 4)), bd = clamp(D - front - (style === 'grid' ? 3 : 6), 12, 34);
      const cx = L.fx + nx * (front + bd / 2), cy = L.fy + ny * (front + bd / 2);
      const stories = style === 'grid' ? 3 + Math.floor(hf(h, 2) * 3) : 2 + (hf(h, 2) < 0.3 ? 1 : 0);
      b = this.addBuilding({ kind: 'apartment', cx, cy, ux, uy, hw: bw / 2, hd: bd / 2, stories, roof: flatRoof(h, 'apartment'), units: 0, floorArea: bw * bd * stories }, lot.id);
      if (b) { b.access = this.access(L.slot, L.fx + nx * front, L.fy + ny * front); b.lightwell = style === 'grid' && bw > 16 && bd > 18; }
      return b;
    }
    if (kind === 'church') {
      const bw = Math.min(W - 6, 14), bd = clamp(D - 10, 16, 30);
      const cx = L.fx + nx * (5 + bd / 2), cy = L.fy + ny * (5 + bd / 2);
      const roof = pitchedRoof(this.world, this.zipAt(cx, cy), h, 'grid'); roof.shape = 'gable'; roof.solar = false;
      b = this.addBuilding({ kind: 'church', use: 'church', label: hf(h, 3) < 0.7 ? 'church' : 'community church', cx, cy, ux: nx, uy: ny, hw: bd / 2, hd: bw / 2, stories: 1, roof, units: 0, wing: { cx: cx + nx * bd * 0.12, cy: cy + ny * bd * 0.12, hw: 3.5, hd: bw / 2 + 4 } }, lot.id);
      if (b) { b.access = this.access(L.slot, L.fx + nx * 4, L.fy + ny * 4); b.steeple = true; this.parkingLot(L, lot.id, b.id, 0.0); }
      return b;
    }
    if (kind === 'motel') {
      const bd = clamp(D - 6, 14, 36);
      const cx = L.fx + nx * (D - 6 - 5), cy = L.fy + ny * (D - 6 - 5);
      b = this.addBuilding({ kind: 'commercial', use: 'motel', label: 'motel', cx, cy, ux, uy, hw: (W - 6) / 2, hd: 5, stories: 2, roof: flatRoof(h, 'commercial'), units: 0, wing: { cx: L.fx + ux * ((W - 6) / 2 - 5) + nx * (bd / 2), cy: L.fy + uy * ((W - 6) / 2 - 5) + ny * (bd / 2), hw: 5, hd: bd / 2 - 1 } }, lot.id);
      if (b) {
        b.access = this.access(L.slot, L.fx + nx * 4, L.fy + ny * 4);
        const pr = rectCorners(L.fx + nx * 7 - ux * (W / 2 - 8), L.fy + ny * 7 - uy * (W / 2 - 8), ux, uy, 3.5, 2.2);
        if (this.fits(pr, lot.id)) { this.out.pools.push({ ring: Float64Array.from(pr), kidney: false }); this.stamp(pr, b.id, DRIVE); }
        this.parkingLot(L, lot.id, b.id, 0.0);
      }
      return b;
    }
    return null;
  }

  buildGroup(group, use, style) {
    if (use === 'apartment') return this.buildLotBuilding(group, 'apartment', style);
    if (use === 'church') return this.buildLotBuilding(group, 'church', style);
    if (use === 'motel') return this.buildLotBuilding(group, 'motel', style);
    return this.buildLotBuilding(group, use, style);
  }

  /**
   * A run of commercial slots from index k: storefront rows in old cores and towns (shops at the sidewalk), strip
   * malls with parking in front elsewhere. Returns the index after the run.
   */
  buildCommercialRun(run, k, style) {
    let j = k;
    while (j < run.length && run[j].use === 'commercial') j++;
    const group = run.slice(k, j);
    for (const s of group) s.done = true;
    if (style === 'grid' || style === 'town') {
      // storefronts: each slot (or pair) a shop at the sidewalk with an awning
      let i = 0;
      while (i < group.length) {
        const h = hash3(this.seed, group[i].e * 2 + (group[i].side > 0 ? 1 : 0), Math.round(group[i].sc * 2));
        const take = hf(h, 1) < 0.3 && i + 1 < group.length ? 2 : 1;
        const sub = group.slice(i, i + take);
        i += take;
        const L = this.lotRing(sub);
        const lot = this.claimLot(L.ring, 'commercial', 0.6);
        if (!lot) continue;
        const bd = clamp(L.depth - 2, 12, 28);
        const cx = L.fx + L.nx * (bd / 2 + 0.2), cy = L.fy + L.ny * (bd / 2 + 0.2);
        const biz = this.business(h);
        const b = this.addBuilding({ kind: 'commercial', use: biz.kind, label: biz.label, cx, cy, ux: L.tx, uy: L.ty, hw: L.width / 2 - 0.15, hd: bd / 2, stories: hf(h, 2) < 0.45 ? 2 : 1, roof: flatRoof(h, 'commercial'), units: 0, awning: AWNINGS[Math.floor(hf(h, 3) * AWNINGS.length)] }, lot.id);
        if (b) { b.access = this.access(L.slot, L.fx, L.fy); b.storefront = true; }
      }
      return j;
    }
    // strip mall: one long building set back behind a parking lot, divided into shops
    const L = this.lotRing(group);
    const lot = this.claimLot(L.ring, 'commercial', 0.6);
    if (!lot) return j;
    const h = hash3(this.seed, group[0].e * 2 + (group[0].side > 0 ? 1 : 0), Math.round(group[0].sc));
    const bd = clamp(L.depth * 0.42, 12, 22);
    const back = clamp(L.depth - 3, bd + 14, 80);
    const cx = L.fx + L.nx * (back - bd / 2), cy = L.fy + L.ny * (back - bd / 2);
    const bw = Math.max(12, L.width - 6);
    const nShops = Math.max(1, Math.round(bw / 11));
    const biz = [];
    for (let q = 0; q < nShops; q++) biz.push(this.business(hash2(h, q)));
    const b = this.addBuilding({ kind: 'commercial', use: biz[0].kind, label: biz.map(x => x.label).slice(0, 6).join(', '), shops: biz, cx, cy, ux: L.tx, uy: L.ty, hw: bw / 2, hd: bd / 2, stories: 1, roof: flatRoof(h, 'commercial'), units: 0, awning: AWNINGS[Math.floor(hf(h, 3) * AWNINGS.length)] }, lot.id);
    if (b) {
      b.access = this.access(L.slot, L.fx + L.nx * 3, L.fy + L.ny * 3);
      b.strip = true;
      this.parkingLot(L, lot.id, b.id, back - bd - 1);
    }
    return j;
  }

  buildIndustrialRun(run, k) {
    let j = k;
    while (j < run.length && run[j].use === 'industrial') j++;
    const group = run.slice(k, j);
    for (const s of group) s.done = true;
    // split long runs into buildings of 40-80 m
    let i = 0;
    while (i < group.length) {
      const h = hash3(this.seed, group[i].e * 2 + (group[i].side > 0 ? 1 : 0), Math.round(group[i].sc * 5));
      const want = lerp(40, 80, hf(h, 1));
      const sub = [];
      let w = 0;
      while (i < group.length && w < want) { sub.push(group[i]); w += group[i].w; i++; }
      const L = this.lotRing(sub);
      const lot = this.claimLot(L.ring, 'industrial', 0.6);
      if (!lot) continue;
      const bd = clamp(L.depth - 14, 14, 70), bw = Math.max(10, L.width - 6);
      const cx = L.fx + L.nx * (10 + bd / 2), cy = L.fy + L.ny * (10 + bd / 2);
      const kind = hf(h, 2) < 0.6 ? 'mfg' : 'whse';
      const label = (kind === 'mfg' ? MFG : WHSE)[Math.floor(hf(h, 3) * (kind === 'mfg' ? MFG.length : WHSE.length))];
      const b = this.addBuilding({ kind: 'industrial', use: kind, label, cx, cy, ux: L.tx, uy: L.ty, hw: bw / 2, hd: bd / 2, stories: 1, roof: flatRoof(h, 'industrial'), units: 0 }, lot.id);
      if (b) { b.access = this.access(L.slot, L.fx + L.nx * 4, L.fy + L.ny * 4); this.parkingLot(L, lot.id, b.id, 9); }
    }
    return j;
  }

  /** A generic business for a storefront, weighted by the ZIP's establishment counts. */
  business(h) {
    const bz = this.ctx.businesses;
    const w = { retail: bz.retail || 1, food: bz.food || 1, health: (bz.health || 0) * 0.5, office: (bz.office || 0) * 0.3, ins: bz.ins_agents || 0, solar: (bz.solar_co || 0) * 0.5, roofers: (bz.roofers || 0) * 0.5, auto: bz.auto || 0 };
    const kind = weightedPick(w, hf(h, 11));
    const u = hf(h, 12);
    const label = kind === 'food' ? weightedPick(this.food, u) : kind === 'retail' ? RETAIL[Math.floor(u * RETAIL.length)] : kind === 'health' ? HEALTH[Math.floor(u * HEALTH.length)]
      : kind === 'office' ? OFFICE[Math.floor(u * OFFICE.length)] : kind === 'ins' ? 'insurance agency' : kind === 'solar' ? 'solar installer' : kind === 'roofers' ? 'roofing contractor' : AUTO[Math.floor(u * AUTO.length)];
    return { kind, label };
  }

  /** Paint parking stalls on the free part of a lot between the street and `upto` meters deep. */
  parkingLot(L, lotId, bId, upto) {
    const depth = upto > 0 ? upto : L.depth * 0.35;
    if (depth < 8) return;
    const ux = L.tx, uy = L.ty, nx = L.nx, ny = L.ny;
    const rows = Math.max(1, Math.floor((depth - 2) / 11));
    const stalls = [];
    for (let r = 0; r < rows; r++) {
      const d = 2 + 2.75 + r * 11;
      for (let a = -L.width / 2 + 2; a <= L.width / 2 - 2.6; a += 2.7) {
        const x = L.fx + nx * d + ux * (a + 1.3), y = L.fy + ny * d + uy * (a + 1.3);
        if (this.occ.ownerAt(x, y) !== lotId || this.occ.at(x, y) !== LOT) continue;
        stalls.push(this.addSpot(x, y, Math.atan2(ny, nx), 'lot', bId, L.slot));
      }
    }
    const ring = [L.fx - ux * L.width / 2, L.fy - uy * L.width / 2, L.fx + ux * L.width / 2, L.fy + uy * L.width / 2,
      L.fx + ux * L.width / 2 + nx * depth, L.fy + uy * L.width / 2 + ny * depth, L.fx - ux * L.width / 2 + nx * depth, L.fy - uy * L.width / 2 + ny * depth];
    this.out.areas.push({ id: this.out.areas.length, kind: 'parking', ring: Float64Array.from(ring), cells: 0, building: bId, stalls: stalls.length });
  }

  /** A parking spot: a driveway pad, a curb space or a lot stall, tied to a building or an area (pods). */
  addSpot(x, y, ang, kind, b, slot, area = -1) {
    const id = this.out.spots.length;
    this.out.spots.push({ id, x, y, ang, kind, b, area, e: slot ? slot.e : -1, s: slot ? slot.sc : 0, side: slot ? slot.side : 1, owner: -1 });
    return id;
  }

  stampDriveway(seg, bId) {
    this.occ.markLine(seg, 1.4, DRIVE, bId);
  }

  // ------------------------------------------------ the mobile-home park

  mobileHomePark(runs, mhHH) {
    const need = mhHH * 330;   // m2 per space with lanes
    const cand = runs.filter(r => !r.some(s => s.use) && r[0].rank >= 5 && r.length >= 3).map(r => {
      const w = r.reduce((a, s) => a + s.w, 0), d = Math.min(...r.map(s => s.depth));
      return { r, w, d, area: w * Math.max(d, 0) };
    }).filter(c => c.d >= 28).sort((a, b) => b.area - a.area);
    let got = 0;
    for (const c of cand) {
      if (got >= need) break;
      const L = this.lotRing(c.r);
      // let the park reach deeper than a house lot when the block allows it
      const ray = castDepth(this.occ, L.fx, L.fy, L.nx, L.ny, 160, this.net);
      const depth = clamp(ray.d - 6, c.d, 150);
      const ring = [L.fx - L.tx * L.width / 2, L.fy - L.ty * L.width / 2, L.fx + L.tx * L.width / 2, L.fy + L.ty * L.width / 2,
        L.fx + L.tx * L.width / 2 + L.nx * depth, L.fy + L.ty * L.width / 2 + L.ny * depth, L.fx - L.tx * L.width / 2 + L.nx * depth, L.fy - L.ty * L.width / 2 + L.ny * depth];
      for (const s of c.r) { s.use = 'mhpark'; s.done = true; }
      const area = { id: this.out.areas.length, kind: 'mhpark', ring: Float64Array.from(ring), cells: 0, name: 'Mobile Home Park', slot: L.slot, front: L };
      this.occ.eachInConvex(ring, k => { if (this.occ.code[k] === FREE || this.occ.code[k] === LOT) { this.occ.code[k] = AREA; this.occ.owner[k] = area.id; area.cells++; } });
      this.out.areas.push(area);
      got += L.width * depth;
    }
  }

  // ------------------------------------------------ areas: parks, schools, pods

  /** The area's frame: its longest side as the u axis, the access point on the nearest street. */
  areaFrame(area) {
    const r = area.ring, n = r.length / 2;
    let best = 0, bi = 0;
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; const L = Math.hypot(r[2 * j] - r[2 * i], r[2 * j + 1] - r[2 * i + 1]); if (L > best) { best = L; bi = i; } }
    const j = (bi + 1) % n;
    const ux = (r[2 * j] - r[2 * bi]) / best, uy = (r[2 * j + 1] - r[2 * bi + 1]) / best;
    const c = ringCentroid(r);
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (let i = 0; i < n; i++) { const dx = r[2 * i] - c.x, dy = r[2 * i + 1] - c.y; const u = dx * ux + dy * uy, v = -dx * uy + dy * ux; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
    const near = this.net.nearest(c.x, c.y, E => E.car && !E.freeway, 600);
    let access = null;
    if (near) {
      const E = this.net.edges[near.e];
      const p = pointAt(E.pts, E.cum, near.s, {});
      const side = ((c.x - p.x) * -p.ty + (c.y - p.y) * p.tx) > 0 ? 1 : -1;
      const slot = { e: near.e, sc: near.s, side };
      access = this.access(slot, c.x, c.y);
    }
    return { c, ux, uy, vx: -uy, vy: ux, u0, u1, v0, v1, access };
  }

  /** True when the area cell under (x,y) belongs to this area. */
  inArea(area, x, y) { const k = this.occ.idx(x, y); return k >= 0 && this.occ.code[k] === AREA && this.occ.owner[k] === area.id; }

  fillArea(area) {
    if (area.kind === 'parking' || area.filled) return;
    area.filled = true;
    const F = this.areaFrame(area);
    area.frame = F;
    area.access = F.access;
    const h = hash3(this.seed, Math.round(F.c.x), Math.round(F.c.y));
    const P = (u, v) => [F.c.x + F.ux * u + F.vx * v, F.c.y + F.uy * u + F.vy * v];
    const box = (u, v, hw, hd) => { const [x, y] = P(u, v); return { cx: x, cy: y, ux: F.ux, uy: F.uy, hw, hd }; };
    const W = F.u1 - F.u0, H = F.v1 - F.v0;
    // area buildings are stamped over the area's own cells
    const place = (b) => {
      const ring = rectCorners(b.cx, b.cy, b.ux, b.uy, b.hw, b.hd);
      let ok = true;
      this.occ.eachInConvex(ring, k => { if (!(this.occ.code[k] === AREA && this.occ.owner[k] === area.id)) { ok = false; return false; } return true; });
      if (!ok) return null;
      b.id = this.out.buildings.length; b.ring = Float64Array.from(ring); b.zi = this.zipAt(b.cx, b.cy); b.lot = -1; b.area = area.id; b.residents = 0;
      b.access = F.access ? Object.assign({}, F.access, { doorX: b.cx, doorY: b.cy }) : null;
      this.occ.eachInConvex(ring, k => { this.occ.code[k] = BLDG; this.occ.owner[k] = b.id; });
      this.out.buildings.push(b);
      return b;
    };
    if (area.kind === 'park') {
      area.features = [];
      if (W > 70 && H > 50 && hf(h, 1) < 0.55) area.features.push({ kind: 'field', ring: Float64Array.from(rectCorners(...P(-W * 0.12, 0), F.ux, F.uy, Math.min(45, W * 0.3), Math.min(30, H * 0.32))) });
      area.features.push({ kind: 'playground', ring: Float64Array.from(rectCorners(...P(W * 0.28, -H * 0.18), F.ux, F.uy, 9, 7)) });
      if (hf(h, 2) < 0.6) area.features.push({ kind: 'court', ring: Float64Array.from(rectCorners(...P(W * 0.28, H * 0.22), F.ux, F.uy, 14, 7.5)) });
      area.paths = [[...P(F.u0 + 4, F.v0 + 4), ...P(0, 0), ...P(F.u1 - 4, F.v1 - 4)], [...P(F.u0 + 4, F.v1 - 4), ...P(0, 0), ...P(F.u1 - 4, F.v0 + 4)]];
      const b = place(Object.assign(box(W * 0.05, H * 0.36, 5, 3.5), { kind: 'park-building', use: 'restroom', label: 'park restrooms', stories: 1, roof: flatRoof(h, 'commercial'), units: 0 }));
      if (b) b.parkOf = area.id;
      area.outdoor = true;
      return;
    }
    if (area.kind === 'school') {
      // classroom wings near the street, a field and a track behind, blacktop courts, a parking lot
      const s1 = place(Object.assign(box(-W * 0.18, -H * 0.24, Math.min(60, W * 0.3), Math.min(12, H * 0.14)), { kind: 'school', use: 'school', label: area.name || 'school', stories: 1 + (hf(h, 1) < 0.4 ? 1 : 0), roof: flatRoof(h, 'school'), units: 0 }));
      place(Object.assign(box(-W * 0.18 + Math.min(60, W * 0.3) - 6, -H * 0.05, 6, Math.min(22, H * 0.18)), { kind: 'school', use: 'school', label: area.name || 'school', stories: 1, roof: flatRoof(hash2(h, 2), 'school'), units: 0 }));
      place(Object.assign(box(-W * 0.32, -H * 0.02, Math.min(16, W * 0.1), Math.min(10, H * 0.1)), { kind: 'school', use: 'gym', label: 'school gym', stories: 1, roof: flatRoof(hash2(h, 3), 'school'), units: 0 }));
      area.features = [
        { kind: 'track', ring: Float64Array.from(rectCorners(...P(W * 0.22, H * 0.12), F.ux, F.uy, Math.min(55, W * 0.24), Math.min(34, H * 0.3))) },
        { kind: 'court', ring: Float64Array.from(rectCorners(...P(-W * 0.2, H * 0.3), F.ux, F.uy, Math.min(26, W * 0.14), Math.min(12, H * 0.12))) },
      ];
      if (s1) s1.schoolOf = area.id;
      area.outdoor = true;
      return;
    }
    if (area.kind === 'apartments') {
      // garden apartments: rows of two- and three-story buildings around parking courts, a pool and clubhouse
      const rowsN = Math.max(1, Math.floor((H - 20) / 38));
      for (let r = 0; r < rowsN; r++) {
        const v = F.v0 + 22 + r * 38;
        for (let u = F.u0 + 30; u < F.u1 - 30; u += 56) {
          const hb = hash3(h, r, Math.round(u));
          place(Object.assign(box(u, v, 22, 7.5), { kind: 'apartment', use: 'apartments', label: area.name || 'apartments', stories: 2 + (hf(hb, 1) < 0.45 ? 1 : 0), roof: pitchedRoof(this.world, this.zipAt(...P(u, v)), hb, 'curvi'), units: 0, floorArea: 44 * 15 * 2.5, complex: area.id }));
        }
      }
      const club = place(Object.assign(box(0, F.v1 - 18, 9, 7), { kind: 'commercial', use: 'clubhouse', label: 'clubhouse', stories: 1, roof: pitchedRoof(this.world, this.ctx.zi, hash2(h, 9), 'curvi'), units: 0 }));
      const pr = rectCorners(...P(16, F.v1 - 18), F.ux, F.uy, 7, 4);
      this.out.pools.push({ ring: Float64Array.from(pr), kidney: false });
      if (club) club.complexOf = area.id;
      area.parkingCourts = true;
      this.areaStalls(area, F, h);
      return;
    }
    if (area.kind === 'commercial') {
      // a shopping center: an anchor store, an L of inline shops, pad buildings by the street, a big lot
      const anchor = place(Object.assign(box(F.u0 + W * 0.3, F.v1 - 32, Math.min(36, W * 0.22), 24), { kind: 'commercial', use: 'retail', label: hf(h, 1) < 0.5 ? 'supermarket' : 'big-box store', stories: 1, roof: flatRoof(h, 'industrial'), units: 0 }));
      const shops = [];
      for (let q = 0; q < 6; q++) shops.push(this.business(hash2(h, q + 10)));
      place(Object.assign(box(F.u0 + W * 0.72, F.v1 - 22, Math.min(40, W * 0.2), 10), { kind: 'commercial', use: shops[0].kind, label: shops.map(s => s.label).join(', '), shops, stories: 1, roof: flatRoof(hash2(h, 2), 'commercial'), units: 0, awning: AWNINGS[h % AWNINGS.length] }));
      for (let q = 0; q < 2; q++) { const biz = this.business(hash2(h, 30 + q)); place(Object.assign(box(F.u0 + W * (0.25 + 0.5 * q), F.v0 + 18, 9, 7), { kind: 'commercial', use: biz.kind, label: biz.label, stories: 1, roof: flatRoof(hash2(h, 40 + q), 'commercial'), units: 0 })); }
      if (anchor) anchor.centerOf = area.id;
      this.areaStalls(area, F, h);
      return;
    }
    if (area.kind === 'mhpark') {
      // lanes every ~42 m, homes perpendicular to them, a clubhouse by the entrance
      area.lanes = [];
      for (let v = F.v0 + 21; v < F.v1 - 12; v += 42) {
        area.lanes.push(Float64Array.from([...P(F.u0 + 4, v), ...P(F.u1 - 4, v)]));
        for (const side of [-1, 1]) {
          for (let u = F.u0 + 9; u < F.u1 - 9; u += 9.5) {
            const hb = hash3(h, Math.round(v), Math.round(u * 3 + side));
            const wide = hf(hb, 1) < 0.45;
            const bw = wide ? 8 : 4.6, bl = lerp(14, 19, hf(hb, 2));
            const [cx, cy] = P(u, v + side * (4.5 + bl / 2));
            const roof = { mat: 'mobile', color: ROOFS.mobile[Math.floor(hf(hb, 3) * ROOFS.mobile.length)], shape: wide ? 'gable' : 'flat', solar: hf(hb, 4) < 0.04, age: 10 + Math.floor(hf(hb, 5) * 25), weathered: hf(hb, 6) < 0.4 };
            const b = place({ kind: 'mobile-home', cx, cy, ux: F.vx, uy: F.vy, hw: bl / 2, hd: bw / 2, stories: 1, roof, units: 1 });
            if (b) { const [sx, sy] = P(u + 2.5 + bw / 2, v + side * 3.2); b.parkingHint = [sx, sy]; this.addSpot(sx, sy, Math.atan2(F.vy, F.vx), 'driveway', b.id, null); }
          }
        }
      }
      return;
    }
    area.outdoor = area.kind === 'park';
  }

  /** Stalls across an area's open pavement (pods): rows along the u axis wherever the cells are still the area's. */
  areaStalls(area, F, h) {
    let n = 0;
    for (let v = F.v0 + 6; v < F.v1 - 4; v += 11) {
      for (let u = F.u0 + 4; u < F.u1 - 4; u += 2.7) {
        const x = F.c.x + F.ux * u + F.vx * v, y = F.c.y + F.uy * u + F.vy * v;
        if (!this.inArea(area, x, y) || !this.inArea(area, x + F.vx * 2.6, y + F.vy * 2.6) || !this.inArea(area, x - F.vx * 2.6, y - F.vy * 2.6)) continue;
        if (hf(h, 900 + n) < 0.08) { n++; continue; }
        this.addSpot(x, y, Math.atan2(F.vy, F.vx), 'lot', -1, F.access ? { e: F.access.e, sc: F.access.s, side: F.access.side } : null, area.id);
        n++;
      }
    }
    area.stalls = n;
  }

  // ------------------------------------------------ homes on their own sites

  /** A home where its household's home point is (rural land), facing the street its driveway reaches. */
  looseHome(site) {
    const near = this.net.nearest(site.x, site.y, E => E.car && !E.freeway, 900);
    let ux = 1, uy = 0;
    if (near) { const dx = near.x - site.x, dy = near.y - site.y, d = Math.hypot(dx, dy) || 1; ux = -dy / d; uy = dx / d; }
    const h = hash3(this.seed, site.zi, site.h);
    const mobile = site.dwelling === 'mobile-home';
    const hw = mobile ? lerp(7, 9.5, hf(h, 1)) : lerp(6, 10, hf(h, 1)), hd = mobile ? (hf(h, 2) < 0.5 ? 2.3 : 4) : lerp(5, 7.5, hf(h, 2));
    let placed = null;
    // spiral out from the home point until the house fits
    for (let k = 0; k < 24 && !placed; k++) {
      const ang = k * 2.4, rad = k === 0 ? 0 : 6 + k * 3.2;
      const cx = site.x + Math.cos(ang) * rad, cy = site.y + Math.sin(ang) * rad;
      if (Math.abs(cx) > this.ctx.R - 8 || Math.abs(cy) > this.ctx.R - 8) continue;
      const ring = rectCorners(cx, cy, ux, uy, hw + 3, hd + 3);
      let ok = true;
      this.occ.eachInConvex(ring, q => { if (this.occ.code[q] !== FREE) { ok = false; return false; } return true; });
      if (!ok) continue;
      const roof = mobile ? { mat: 'mobile', color: ROOFS.mobile[Math.floor(hf(h, 3) * ROOFS.mobile.length)], shape: hf(h, 4) < 0.5 ? 'flat' : 'gable', solar: false, age: 15, weathered: hf(h, 5) < 0.5 }
        : pitchedRoof(this.world, site.zi, h, 'tract');
      placed = this.addBuilding({ kind: mobile ? 'mobile-home' : 'house', cx, cy, ux, uy, hw, hd, stories: 1, roof, units: 1, loose: true, siteOf: site.key }, -1, false);
    }
    if (!placed) return null;
    if (near) {
      const E = this.net.edges[near.e];
      const p = pointAt(E.pts, E.cum, near.s, {});
      const side = ((placed.cx - p.x) * -p.ty + (placed.cy - p.y) * p.tx) > 0 ? 1 : -1;
      placed.access = this.access({ e: near.e, sc: near.s, side }, placed.cx, placed.cy);
      // the driveway runs from the house to the road
      const ax = placed.access.curbX, ay = placed.access.curbY;
      const dx = ax - placed.cx, dy = ay - placed.cy, d = Math.hypot(dx, dy) || 1;
      const sx = placed.cx + dx / d * (hd + 2), sy = placed.cy + dy / d * (hd + 2);
      placed.driveway = [sx, sy, ax, ay];
      placed.rural = true;
      this.occ.markLine(placed.driveway, 1.6, DRIVE, placed.id);
      const spot = this.addSpot(sx + dx / d * 3, sy + dy / d * 3, Math.atan2(dy, dx), 'driveway', placed.id, { e: near.e, sc: near.s, side });
      if (d > 20) this.addSpot(sx + dx / d * 3 - dy / d * 3, sy + dy / d * 3 + dx / d * 3, Math.atan2(dy, dx), 'driveway', placed.id, { e: near.e, sc: near.s, side });
      placed.access.driveX = this.out.spots[spot].x; placed.access.driveY = this.out.spots[spot].y; placed.access.driveAng = Math.atan2(-dy, -dx);
    }
    placed.household = site.key;
    this.out.loose.push({ key: site.key, b: placed.id });
    return placed;
  }

  // ------------------------------------------------ OpenStreetMap footprints

  /** Use OSM building polygons: classify by tags and size, attach each to its nearest street. */
  osm(list) {
    for (const ob of list) {
      const ring = ob.ring;
      if (!ring || ring.length < 6) continue;
      const area = Math.abs(ringArea(ring));
      if (area < 12) continue;
      const c = ringCentroid(ring);
      if (Math.abs(c.x) > this.ctx.R || Math.abs(c.y) > this.ctx.R) continue;
      // orientation from the longest edge (for roof ridges and rectangles in the renderer)
      let best = 0, ux = 1, uy = 0;
      for (let i = 0; i < ring.length / 2; i++) { const j = (i + 1) % (ring.length / 2); const L = Math.hypot(ring[2 * j] - ring[2 * i], ring[2 * j + 1] - ring[2 * i + 1]); if (L > best) { best = L; ux = (ring[2 * j] - ring[2 * i]) / L; uy = (ring[2 * j + 1] - ring[2 * i + 1]) / L; } }
      let hw = 0, hd = 0;
      for (let i = 0; i < ring.length; i += 2) { const dx = ring[i] - c.x, dy = ring[i + 1] - c.y; hw = Math.max(hw, Math.abs(dx * ux + dy * uy)); hd = Math.max(hd, Math.abs(-dx * uy + dy * ux)); }
      const h = hash3(this.seed, Math.round(c.x * 3), Math.round(c.y * 3));
      const t = ob.tags || {};
      const kind = classifyOsm(t, area);
      const roof = kind === 'house' || kind === 'small-apartment' || kind === 'church' ? pitchedRoof(this.world, this.zipAt(c.x, c.y), h, this.ctx.style) : flatRoof(h, kind === 'industrial' ? 'industrial' : kind === 'apartment' ? 'apartment' : 'commercial');
      if (t['roof:material'] && ROOFS[t['roof:material']]) roof.mat = t['roof:material'];
      const levels = parseInt(t['building:levels'], 10);
      const biz = kind === 'commercial' ? this.business(h) : null;
      const b = { id: this.out.buildings.length, kind, use: biz ? biz.kind : kind === 'industrial' ? 'mfg' : kind, label: t.name || (biz ? biz.label : kind === 'school' ? 'school' : kind === 'church' ? 'church' : ''), cx: c.x, cy: c.y, ux, uy, hw, hd, poly: Float64Array.from(ring), ring: Float64Array.from(ring), stories: Number.isFinite(levels) ? clamp(levels, 1, 40) : (kind === 'apartment' ? 3 : 1), roof, units: kind === 'house' ? 1 : kind === 'small-apartment' ? clamp(Math.round(area / 90), 2, 4) : 0, floorArea: area * (Number.isFinite(levels) ? levels : kind === 'apartment' ? 3 : 1), zi: this.zipAt(c.x, c.y), lot: -1, residents: 0, osm: true };
      const near = this.net.nearest(c.x, c.y, E => E.car && !E.freeway, 300);
      if (near) {
        const E = this.net.edges[near.e];
        const p = pointAt(E.pts, E.cum, near.s, {});
        const side = ((c.x - p.x) * -p.ty + (c.y - p.y) * p.tx) > 0 ? 1 : -1;
        b.access = this.access({ e: near.e, sc: near.s, side }, c.x, c.y);
        if (kind === 'house') { const dx = b.access.curbX - c.x, dy = b.access.curbY - c.y, d = Math.hypot(dx, dy) || 1; const sx = c.x + dx / d * Math.min(d - 3, hd + 4), sy = c.y + dy / d * Math.min(d - 3, hd + 4); this.addSpot(sx, sy, Math.atan2(dy, dx), 'driveway', b.id, { e: near.e, sc: near.s, side }); b.access.driveX = sx; b.access.driveY = sy; b.access.driveAng = Math.atan2(-dy, -dx); }
      }
      this.occ.eachInPolygon(ring, k => { if (this.occ.code[k] === FREE) { this.occ.code[k] = BLDG; this.occ.owner[k] = b.id; } });
      this.out.buildings.push(b);
    }
  }

  // ------------------------------------------------ trees

  trees(style) {
    const out = this.out.trees, veg = this.veg, net = this.net, occ = this.occ;
    const cap = 14000;
    const add = (x, y, r, sp, shade) => { if (out.length / 5 < cap) out.push(x, y, r, sp, shade); };
    const p = {};
    // street trees in the parkway strip
    if (veg.street > 0) {
      for (const E of net.edges) {
        if (!(E.cls === 'local' || E.cls === 'collector' || E.cls === 'arterial') || E.side <= 0) continue;
        const spacing = lerp(9, 14, hf(hash2(this.seed, E.id), 1));
        const palmStreet = hf(hash2(this.seed, E.id), 2) < veg.palm;
        for (const side of [1, -1]) {
          for (let s = 10; s < E.len - 10; s += spacing) {
            const hh = hash3(this.seed, E.id * 2 + (side > 0 ? 1 : 0), Math.round(s));
            if (hf(hh, 1) > veg.street) continue;
            pointAt(E.pts, E.cum, s, p);
            const off = E.curb + (E.parkway > 0 ? E.parkway / 2 : 0.7);
            const x = p.x - p.ty * side * off, y = p.y + p.tx * side * off;
            const c = occ.at(x, y);
            if (c === DRIVE || c === BLDG || c === WATER) continue;
            const palm = palmStreet && hf(hh, 2) < 0.92;
            add(x, y, palm ? lerp(2.6, 3.4, hf(hh, 3)) : lerp(2.8, 5.2, hf(hh, 3)), palm ? 2 : veg.streetSp, hf(hh, 4));
          }
        }
      }
    }
    // yard trees behind and beside houses
    for (const b of this.out.buildings) {
      if (b.kind !== 'house' || b.lot < 0) continue;
      const hh = hash2(this.seed, b.id * 7 + 1);
      const n = Math.floor(hf(hh, 1) * (veg.yard * 3.2));
      for (let k = 0; k < n; k++) {
        // (ux, uy) runs along the street; (-uy, ux) points from the street into the lot, so v > 0 is the back yard
        const u = (hf(hh, 10 + k) - 0.5) * 2.4 * b.hw, v = b.hd + 3 + hf(hh, 20 + k) * 9;
        const x = b.cx + b.ux * u - b.uy * v, y = b.cy + b.uy * u + b.ux * v;
        if (occ.ownerAt(x, y) !== b.lot || occ.at(x, y) !== LOT) continue;
        const palm = hf(hh, 30 + k) < veg.palm * 0.6;
        add(x, y, palm ? 3 : lerp(2.5, 5.5, hf(hh, 40 + k)), palm ? 2 : veg.yardSp, hf(hh, 50 + k));
      }
    }
    // parks and school edges
    for (const a of this.out.areas) {
      if (a.kind !== 'park' && a.kind !== 'school' && a.kind !== 'apartments' && a.kind !== 'commercial') continue;
      const F = a.frame; if (!F) continue;
      const dens = a.kind === 'park' ? 0.55 : 0.12;
      for (let u = F.u0 + 5; u < F.u1 - 4; u += 11) for (let v = F.v0 + 5; v < F.v1 - 4; v += 11) {
        const hh = hash3(this.seed, Math.round(u * 10 + a.id), Math.round(v * 10));
        if (hf(hh, 1) > dens) continue;
        const x = F.c.x + F.ux * (u + (hf(hh, 2) - 0.5) * 8) + F.vx * (v + (hf(hh, 3) - 0.5) * 8), y = F.c.y + F.uy * (u + (hf(hh, 2) - 0.5) * 8) + F.vy * (v + (hf(hh, 3) - 0.5) * 8);
        if (!this.inArea(a, x, y)) continue;
        if (a.features && a.features.some(f => pointInRing(x, y, f.ring))) continue;
        const palm = hf(hh, 4) < veg.palm * 0.5;
        add(x, y, palm ? 3.2 : lerp(3.5, 7, hf(hh, 5)), palm ? 2 : veg.parkSp, hf(hh, 6));
      }
    }
    // open land: woods, orchards, chaparral or desert scrub, in clumps
    const clump = fbm(hash2(this.seed, 0xc1), 3, 0.55);
    const R = this.ctx.R;
    const step = veg.open === 5 ? 7 : 10;
    for (let y = -R + 4; y < R; y += step) for (let x = -R + 4; x < R; x += step) {
      if (out.length / 5 >= cap) break;
      if (occ.at(x, y) !== FREE) continue;
      if (this.ctx.devAt(x, y) >= this.ctx.devThreshold * 1.2) continue;
      const hh = hash3(this.seed, Math.round(x), Math.round(y));
      let pr;
      if (veg.open === 5) pr = ((Math.floor((x + R) / step) % 2) === 0 && clump(x / 400, y / 400) > -0.1) ? 0.92 : 0;   // orchard rows
      else pr = veg.openDensity * clamp(0.5 + clump(x / 260, y / 260) * 1.6, 0, 1);
      if (hf(hh, 1) > pr) continue;
      const jx = veg.open === 5 ? 0 : (hf(hh, 2) - 0.5) * step, jy = veg.open === 5 ? 0 : (hf(hh, 3) - 0.5) * step;
      add(x + jx, y + jy, veg.open === 4 ? lerp(0.8, 1.6, hf(hh, 4)) : veg.open === 5 ? 2.4 : lerp(2.6, 6.2, hf(hh, 4)), veg.open, hf(hh, 5));
    }
  }

  // ------------------------------------------------ curb parking

  curbParking() {
    const net = this.net, occ = this.occ, p = {};
    for (const E of net.edges) {
      if (!E.park || E.len < 20) continue;
      const ca = clearance(net, E.a, E) + 4, cb = clearance(net, E.b, E) + 4;
      for (const side of [1, -1]) {
        for (let s = ca + 3; s < E.len - cb - 3; s += 6.3) {
          pointAt(E.pts, E.cum, s, p);
          const off = parkingOffset(E);
          const x = p.x - p.ty * side * off, y = p.y + p.tx * side * off;
          // keep driveway aprons and hydrant gaps clear
          const kx = p.x - p.ty * side * (E.curb + 1.5), ky = p.y + p.tx * side * (E.curb + 1.5);
          if (occ.at(kx, ky) === DRIVE) continue;
          if (hf(hash3(this.seed, E.id, Math.round(s * 7 + side)), 1) < 0.07) continue;
          const ang = side > 0 ? Math.atan2(p.ty, p.tx) : Math.atan2(-p.ty, -p.tx);
          this.addSpot(x, y, ang, 'curb', -1, { e: E.id, sc: s, side });
        }
      }
    }
  }
}

const AWNINGS = ['#b23a3a', '#2f6f5e', '#2d4f86', '#c58b2b', '#6b3f7a', '#3d7a3d', '#8a3b2a', '#22313f'];

/**
 * Lanes to homes on their own sites. Homes are taken nearest-first; each joins the nearest street or lane
 * already laid, directly by driveway when that is within `direct` meters, otherwise by a new lane that ends a
 * short driveway from the house, so neighbors farther out share the lanes of those nearer in.
 * @param {object} ctx scene context (namer, zseed)
 * @param {object} net the street graph without lanes
 * @param {{x:number, y:number, key:string}[]} sites
 * @returns {object[]} lane strokes
 */
export function laneStrokes(ctx, net, sites, { direct = 70, stop = 16 } = {}) {
  const segs = [];               // lane segments: [x0, y0, x1, y1]
  const cell = 60, grid = new Map();
  const addSeg = (x0, y0, x1, y1) => {
    const id = segs.length; segs.push([x0, y0, x1, y1]);
    for (let cx = Math.floor(Math.min(x0, x1) / cell); cx <= Math.floor(Math.max(x0, x1) / cell); cx++) for (let cy = Math.floor(Math.min(y0, y1) / cell); cy <= Math.floor(Math.max(y0, y1) / cell); cy++) {
      const k = cx * 65536 + cy; let b = grid.get(k); if (!b) grid.set(k, b = []); b.push(id);
    }
  };
  const nearestLane = (x, y, maxD) => {
    let best = null, bd = maxD;
    const n = Math.ceil(maxD / cell);
    for (let i = Math.floor(x / cell) - n; i <= Math.floor(x / cell) + n; i++) for (let j = Math.floor(y / cell) - n; j <= Math.floor(y / cell) + n; j++) {
      const b = grid.get(i * 65536 + j); if (!b) continue;
      for (const id of b) { const s = segs[id]; const q = pointSegDist(x, y, s[0], s[1], s[2], s[3]); if (q.d < bd) { bd = q.d; best = q; } }
    }
    return best;
  };
  const roadFilter = E => E.car && !E.freeway && E.cls !== 'ramp';
  const order = sites.map(s => { const q = net.nearest(s.x, s.y, roadFilter, 2000); return { s, d: q ? q.d : Infinity }; }).sort((a, b) => a.d - b.d);
  const out = [];
  for (const { s } of order) {
    const road = net.nearest(s.x, s.y, roadFilter, 2000);
    const lane = nearestLane(s.x, s.y, road ? road.d : 2000);
    const best = lane && (!road || lane.d < road.d) ? lane : road;
    if (!best || best.d <= direct) continue;
    // the lane runs from the junction to a point `stop` meters short of the house, with a gentle bend
    const dx = s.x - best.x, dy = s.y - best.y, d = Math.hypot(dx, dy);
    const ex = s.x - dx / d * stop, ey = s.y - dy / d * stop;
    const h = hash3(ctx.zseed, Math.round(s.x), Math.round(s.y));
    const bend = (hf(h, 1) - 0.5) * 0.25 * d;
    const mx = (best.x + ex) / 2 - dy / d * bend, my = (best.y + ey) / 2 + dx / d * bend;
    const pts = [best.x, best.y];
    for (let k = 1; k <= 8; k++) { const t = k / 8, a = (1 - t) * (1 - t), b = 2 * t * (1 - t), c = t * t; pts.push(a * best.x + b * mx + c * ex, a * best.y + b * my + c * ey); }
    for (let k = 0; k + 3 < pts.length; k += 2) addSeg(pts[k], pts[k + 1], pts[k + 2], pts[k + 3]);
    out.push({ pts: Float64Array.from(pts), cls: 'lane', name: ctx.namer ? ctx.namer.lane(h) : 'Private Lane', lanes: 1, park: false });
  }
  return out;
}

/** Map OSM building tags and size to a Legion building kind. */
export function classifyOsm(t, area) {
  const b = (t.building || 'yes').toLowerCase();
  if (['house', 'detached', 'bungalow', 'semidetached_house', 'cabin', 'farm', 'static_caravan'].includes(b)) return b === 'static_caravan' ? 'mobile-home' : 'house';
  if (['apartments', 'residential', 'dormitory'].includes(b)) return area > 450 ? 'apartment' : area > 160 ? 'small-apartment' : 'house';
  if (['terrace', 'townhouse'].includes(b)) return 'small-apartment';
  if (['retail', 'commercial', 'supermarket', 'kiosk', 'office', 'hotel', 'restaurant'].includes(b) || t.shop || t.amenity === 'restaurant' || t.amenity === 'cafe') return 'commercial';
  if (['industrial', 'warehouse', 'manufacture', 'storage_tank'].includes(b)) return 'industrial';
  if (['school', 'university', 'college', 'kindergarten'].includes(b) || t.amenity === 'school') return 'school';
  if (['church', 'chapel', 'cathedral', 'temple', 'mosque', 'synagogue', 'religious'].includes(b) || t.amenity === 'place_of_worship') return 'church';
  if (['garage', 'garages', 'shed', 'carport', 'roof', 'hut'].includes(b)) return 'garage';
  if (area < 260) return 'house';
  if (area < 600) return 'small-apartment';
  return area > 2500 ? 'commercial' : 'apartment';
}

/**
 * Vegetation of the place from its climate and region: street-tree share, palms, and what grows on open land
 * (species codes: 0 broadleaf, 1 conifer, 2 palm, 3 oak, 4 scrub, 5 orchard).
 */
export function vegetation(ctx) {
  const z = ctx.z || {};
  const cz = z.cz || 9, rain = z.rain_in || 15, region = z.regionKey || '', elev = z.elev_m || 100;
  const desert = cz === 14 || cz === 15;
  const mountain = cz === 16 || elev > 1300;
  const south = ['la', 'oc', 'sd', 'ie'].includes(region);
  const valley = ['sv', 'sj'].includes(region);
  let open = 3, openDensity = 0.22;
  if (desert) { open = 4; openDensity = 0.18; }
  else if (mountain) { open = 1; openDensity = 0.75; }
  else if (cz === 1 || (rain > 40 && !south)) { open = 1; openDensity = 0.45; }
  else if (valley && ctx.reliefPerKm < 30) { open = 5; openDensity = 0.9; }
  else if (south && ctx.reliefPerKm > 40) { open = 4; openDensity = 0.5; }
  if (ctx.mode === 'rural' && open === 3) openDensity = 0.3;
  if (cz === 1 && ctx.reliefPerKm < 60 && !mountain) { open = 0; openDensity = 0.06; }   // north-coast pasture with a few trees
  return {
    open, openDensity,
    street: desert ? 0.35 : ctx.style === 'grid' ? 0.45 : ctx.style === 'curvi' ? 0.8 : 0.65,
    palm: desert ? 0.7 : south ? 0.3 : region === 'cc' ? 0.12 : 0.03,
    streetSp: mountain ? 1 : 0, yardSp: mountain ? 1 : (valley || south) && hf(ctx.zseed, 3) < 0.4 ? 3 : 0, parkSp: mountain ? 1 : 0,
    yard: desert ? 0.3 : mountain ? 0.6 : 1,
  };
}

export { Occ, FREE, ROAD, AREA, WATER, LOT, BLDG, DRIVE };
