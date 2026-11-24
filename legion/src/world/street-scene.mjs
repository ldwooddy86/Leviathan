// Legion · the street scene: everything static about a street view, built from the data for one place.
//
// buildScene() gathers, for a square about 1.2 km across: the ground (land, bay or lake, ocean), the households
// whose homes fall inside (and a ring around it for the density field), the style of the place (era, density,
// terrain, dwelling mix, businesses, schools), the street network (procedural, or OpenStreetMap ways when given),
// the lots and buildings along it, trees and parking, and the assignment of every household to a house or
// apartment on the nearest street. DOM-free: tests build scenes in Node; the browser builds them on open().

import { hash2, hashStr, clamp } from '../engine/rng.mjs';
import { Frame, groundGrid, terrain, fbm, waterOutlines } from './street-geo.mjs';
import { generateStrokes, eraStyle } from './street-gen.mjs';
import { buildNet, Router, netMetrics } from './street-net.mjs';
import { parseOSM } from './street-osm.mjs';
import { planLots, laneStrokes, vegetation } from './street-lots.mjs';
import { assignHouseholds } from './street-residents.mjs';

/** Default half size of the view (meters): the view is about 1.2 km across. */
export const DEFAULT_RADIUS = 600;

/**
 * Households per hectare above which land counts as developed (about two homes per acre): below it homes
 * stand on their own lots along lanes and roads, above it the place gets a street pattern.
 */
export const DEV_THRESHOLD = 5;

/**
 * Pick the ZIP whose character styles the view: the ZIP at the center, or the most common land ZIP in view.
 * @returns {number} ZIP index or -1 when the view holds no California land
 */
export function styleZip(world, x, y, R = DEFAULT_RADIUS) {
  const zi = world.zipAt(x, y);
  if (zi >= 0) return zi;
  const f = new Frame(world, x, y);
  const counts = new Map();
  for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++) {
    const p = f.toWorld(i * R / 4, j * R / 4);
    const z = world.zipAt(p.x, p.y);
    if (z >= 0) counts.set(z, (counts.get(z) || 0) + 1 / (1 + Math.hypot(i, j)));
  }
  let best = -1, bc = 0;
  for (const [z, c] of counts) if (c > bc) { bc = c; best = z; }
  return best;
}

/**
 * Households whose homes fall in the view (and, for the density field, in a margin around it).
 * Homes are world.homeFor points (the population's layer-0 `home`); a few are cross-checked against
 * householdCore so a population that places homes differently still works (it is then scanned in full).
 * @returns {{residents: {zi:number, h:number, core:object, x:number, y:number}[], homes: Float64Array, zips: number[], scanned: number}}
 */
export function collectHouseholds(world, population, frame, R, margin = 300) {
  const ext = R + margin;
  const w0 = frame.toWorld(-ext, -ext), w1 = frame.toWorld(ext, ext);
  const bx0 = Math.min(w0.x, w1.x), bx1 = Math.max(w0.x, w1.x), by0 = Math.min(w0.y, w1.y), by1 = Math.max(w0.y, w1.y);
  const zips = [];
  for (let i = 0; i < world.N; i++) {
    if (!(world.z.hh[i] > 0)) continue;
    const bb = world.zipBBox(i);
    if (bb && bb[0] <= bx1 && bb[2] >= bx0 && bb[1] <= by1 && bb[3] >= by0) zips.push(i);
  }
  const homes = [];
  const residents = [];
  let scanned = 0;
  for (const zi of zips) {
    const H = world.z.hh[zi] || 0;
    let checked = 0, slow = false;
    const inView = [];
    for (let h = 0; h < H; h++) {
      const p = world.homeFor(zi, h);
      scanned++;
      if (p.x < bx0 || p.x > bx1 || p.y < by0 || p.y > by1) continue;
      const lx = (p.x - frame.cx) * frame.fx, ly = (p.y - frame.cy) * frame.fy;
      if (Math.abs(lx) > ext || Math.abs(ly) > ext) continue;
      homes.push(lx, ly);
      if (Math.abs(lx) <= R && Math.abs(ly) <= R) {
        const core = population.householdCore(zi, h);
        if (checked < 3) {
          checked++;
          if (!core.home || Math.abs(core.home.x - p.x) > 1e-6 || Math.abs(core.home.y - p.y) > 1e-6) { slow = true; break; }
        }
        inView.push({ zi, h, core, x: lx, y: ly });
      }
    }
    if (slow) {
      // the population puts homes somewhere else: trust householdCore for every household of this ZIP
      inView.length = 0;
      for (let h = 0; h < H; h++) {
        const core = population.householdCore(zi, h);
        const lx = (core.home.x - frame.cx) * frame.fx, ly = (core.home.y - frame.cy) * frame.fy;
        if (Math.abs(lx) > ext || Math.abs(ly) > ext) continue;
        homes.push(lx, ly);
        if (Math.abs(lx) <= R && Math.abs(ly) <= R) inView.push({ zi, h, core, x: lx, y: ly });
      }
    }
    for (const r of inView) residents.push(r);
  }
  return { residents, homes: Float64Array.from(homes), zips, scanned };
}

/**
 * Household density (per hectare) over the view: counts on a 50 m grid, Gaussian blurred (sigma 100 m).
 * @returns {{at:(x:number,y:number)=>number, peak:{x:number,y:number,value:number}, share:(thr:number,isLand:Function)=>number, cell:number, n:number, ext:number, data:Float32Array}}
 */
export function densityField(homes, R, margin = 300, cell = 50, sigma = 100) {
  const ext = R + margin, n = Math.ceil(2 * ext / cell);
  const raw = new Float32Array(n * n);
  for (let k = 0; k < homes.length; k += 2) {
    const i = Math.floor((homes[k] + ext) / cell), j = Math.floor((homes[k + 1] + ext) / cell);
    if (i >= 0 && j >= 0 && i < n && j < n) raw[j * n + i]++;
  }
  const rad = Math.ceil(2.5 * sigma / cell), ker = [];
  let ks = 0;
  for (let d = -rad; d <= rad; d++) { const w = Math.exp(-0.5 * (d * cell / sigma) ** 2); ker.push(w); ks += w; }
  for (let d = 0; d < ker.length; d++) ker[d] /= ks;
  const tmp = new Float32Array(n * n), out = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    let s = 0; for (let d = -rad; d <= rad; d++) { const ii = clamp(i + d, 0, n - 1); s += raw[j * n + ii] * ker[d + rad]; } tmp[j * n + i] = s;
  }
  const ha = cell * cell / 10000;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    let s = 0; for (let d = -rad; d <= rad; d++) { const jj = clamp(j + d, 0, n - 1); s += tmp[jj * n + i] * ker[d + rad]; } out[j * n + i] = s / ha;
  }
  const at = (x, y) => {
    const fx = (x + ext) / cell - 0.5, fy = (y + ext) / cell - 0.5;
    const i = clamp(Math.floor(fx), 0, n - 2), j = clamp(Math.floor(fy), 0, n - 2);
    const u = clamp(fx - i, 0, 1), v = clamp(fy - j, 0, 1);
    return out[j * n + i] * (1 - u) * (1 - v) + out[j * n + i + 1] * u * (1 - v) + out[(j + 1) * n + i] * (1 - u) * v + out[(j + 1) * n + i + 1] * u * v;
  };
  let peak = { x: 0, y: 0, value: 0 };
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = -ext + (i + 0.5) * cell, y = -ext + (j + 0.5) * cell;
    if (Math.abs(x) > R * 0.85 || Math.abs(y) > R * 0.85) continue;
    if (out[j * n + i] > peak.value) peak = { x, y, value: out[j * n + i] };
  }
  const share = (thr, isLand) => {
    let dev = 0, land = 0;
    for (let y = -R + 25; y < R; y += 50) for (let x = -R + 25; x < R; x += 50) { if (isLand && !isLand(x, y)) continue; land++; if (at(x, y) >= thr) dev++; }
    return land ? dev / land : 0;
  };
  return { at, peak, share, cell, n, ext, data: out };
}

/** Sum a ZIP column over the view's households' ZIPs, weighted by each ZIP's share of its households in view. */
function viewCount(world, perZip, col) {
  let s = 0;
  for (const [zi, k] of perZip) { const hh = world.z.hh[zi] || 0; if (hh > 0) s += (world.z[col][zi] || 0) * k / hh; }
  return s;
}

/**
 * The scene context: everything the generators need to know about the place, derived from the data.
 * @param {object} world
 * @param {object} population
 * @param {number} x view center (world units)
 * @param {number} y view center (world units)
 * @param {{radiusM?: number, seed?: number}} [opts]
 */
export function sceneContext(world, population, x, y, { radiusM = DEFAULT_RADIUS } = {}) {
  const R = radiusM;
  const zi = styleZip(world, x, y, R);
  const z = zi >= 0 ? world.zip(zi) : null;
  const frame = z ? new Frame(world, x, y, z.tx, z.ty) : new Frame(world, x, y);
  const zseed = z ? hashStr(z.zip, 0x5ee7) : 1;
  const ground = groundGrid(world, frame, R, { cell: 10, seed: zseed, margin: 40 });
  const hh = collectHouseholds(world, population, frame, R, 300);
  const dens = densityField(hh.homes, R, 300);
  const isLand = (px, py) => ground.isLand(px, py);
  const devShare = dens.share(DEV_THRESHOLD, isLand);
  const yb = z ? (z.yb_med || 1975) : 1975;
  const style = eraStyle(yb);
  const mode = devShare >= 0.4 ? 'urban' : 'rural';
  // relief inside the view: the ZIP's range scaled from the ZIP's size down to the view's, halved in towns
  const zipKm = z ? Math.sqrt(Math.max(0.3, z.sqmi * 2.59)) : 2;
  const rangeM = z ? Math.max(0, (z.elev_max_m || 0) - (z.elev_m || 0)) : 0;
  const reliefView = rangeM * clamp(Math.pow((2 * R / 1000) / zipKm, 0.6), 0.05, 1) * (mode === 'urban' ? 0.6 : 1);
  const reliefPerKm = reliefView / (2 * R / 1000);
  const warpAmp = clamp((reliefPerKm - 25) * 0.9, 0, 80);
  const wn1 = fbm(hash2(zseed, 0xa1), 3, 0.5), wn2 = fbm(hash2(zseed, 0xa2), 3, 0.5);
  const warpVec = (px, py) => [wn1((px + frame.ox) / 380, (py + frame.oy) / 380), wn2((px + frame.ox) / 380, (py + frame.oy) / 380)];
  // dwelling mix and counts of the households in view
  const mix = { house: 0, 'small-apartment': 0, apartment: 0, 'mobile-home': 0 };
  const perZip = new Map();
  for (const r of hh.residents) { mix[r.core.dwelling] = (mix[r.core.dwelling] || 0) + 1; perZip.set(r.zi, (perZip.get(r.zi) || 0) + 1); }
  const nHH = hh.residents.length;
  // block scale: let the street density follow the frontage the households need
  const viewKm2 = (2 * R / 1000) ** 2 * Math.max(0.05, ground.landShare);
  const devKm2 = Math.max(0.05, viewKm2 * Math.max(devShare, 0.05));
  const hhPerKm2 = nHH / devKm2;
  const fph = (style === 'grid' ? 9.5 : 16) * (mix.house / Math.max(1, nHH)) + 4.8 * (mix['small-apartment'] / Math.max(1, nHH)) + 1.3 * (mix.apartment / Math.max(1, nHH)) + 4 * (mix['mobile-home'] / Math.max(1, nHH));
  const supply = style === 'grid' ? 22000 : style === 'tract' ? 26000 : 19000;
  const demand = Math.max(1, hhPerKm2 * fph * 1.25);
  const scale = mode === 'urban' ? clamp(Math.sqrt(supply / demand), 0.85, 1.55) : 1;
  // schools: K-12 enrollment per km2 over an average campus, plus a share of the private ones
  const sch = z ? world.acsNamed(zi, 'sch') : {};
  const k12 = (sch.kindergarten || 0) + (sch['g1-4'] || 0) + (sch['g5-8'] || 0) + (sch['g9-12'] || 0);
  const zipKm2 = z ? Math.max(0.2, z.sqmi * 2.59) : 1;
  const schoolDensity = mode === 'urban' ? clamp(k12 / zipKm2 / 650 + (z ? z.school : 0) * 0.08 / zipKm2, 0.15, 3.5) : 0;
  const parkDensity = mode === 'urban' ? (style === 'grid' ? 1.1 : style === 'tract' ? 0.9 : 1.5) : 0;
  const businesses = {};
  for (const col of ['retail', 'food', 'office', 'health', 'auto', 'lodging', 'church', 'ins_agents', 'solar_co', 'roofers', 'builders', 'mfg', 'whse', 'est']) businesses[col] = viewCount(world, perZip, col);
  const zipShops = z ? ((z.retail || 0) + (z.food || 0)) : 0;
  const ctx = {
    world, population, zi, z, frame, R, G: R + 160, zseed, ground, households: hh, density: z ? z.density : 0,
    devAt: dens.at, devThreshold: DEV_THRESHOLD, devPeak: dens.peak, devShare, densityField: dens,
    yb, style, mode, reliefView, reliefPerKm, warpAmp, warpVec, terrain: terrain(zseed, reliefView, frame.ox, frame.oy),
    theta: 0, scale, mix, nHH, perZip, schoolDensity, parkDensity, businesses,
    alleyShare: style === 'grid' ? (yb < 1940 ? 0.55 : 0.3) : (mode === 'rural' && yb < 1950 ? 0.4 : 0),
    shopPodDensity: zipShops / zipKm2 / 22, aptPodDensity: z ? z.hh * (z.mf5_sh || 0) / 100 / zipKm2 / 260 : 0,
    mhPodDensity: z ? z.hh * (z.mh_sh || 0) / 100 / zipKm2 / 140 : 0,
  };
  // lattice rotation: old grids are often turned toward a waterfront or a mission road; tracts follow section lines
  const r1 = (zseed >>> 7) / 33554432 % 1, r2 = ((zseed >>> 3) % 1000) / 1000;
  ctx.theta = style === 'grid' ? (r1 < 0.3 ? 0 : (r2 - 0.5) * 0.9) : style === 'tract' ? (r1 < 0.55 ? 0 : (r2 - 0.5) * 0.4) : (r2 - 0.5) * 0.6;
  return ctx;
}

/**
 * Build the whole static scene of a view.
 * @param {object} world
 * @param {object} population
 * @param {number} x view center (world units)
 * @param {number} y view center (world units)
 * @param {{radiusM?: number, osmElements?: object[]}} [opts] `osmElements`: Overpass way elements (street-osm.mjs
 *   fetchOSM) to build the streets and buildings from instead of the procedural network
 * @returns {object} scene: {ctx, frame, R, ground, water, net, router, lots, buildings, areas, trees, spots, households, metrics, source}
 */
export function buildScene(world, population, x, y, opts = {}) {
  const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
  const ctx = sceneContext(world, population, x, y, opts);
  let strokes = null, net = null, osmBuildings = null;
  let source = 'procedural';
  if (opts.osmElements && opts.osmElements.length) {
    // real streets and footprints; unusable data (too few streets in view) falls back to the procedural network
    const parsed = parseOSM(opts.osmElements, world, ctx.frame, ctx.R);
    if (parsed.net && parsed.net.edges.length >= 4) {
      net = parsed.net; osmBuildings = parsed.buildings; source = 'osm';
      ctx.areas = []; ctx.namer = null;
    }
  }
  if (!net) {
    const g = generateStrokes(ctx);
    strokes = g.strokes;
    net = buildNet(strokes, ctx.R, { snap: 6 });
  }
  // homes too thinly spread for a street pattern stand where their households' homes are, on lanes
  let loose = [];
  if (source === 'procedural') {
    loose = ctx.households.residents.filter(r => ctx.devAt(r.x, r.y) < ctx.devThreshold && ctx.ground.isLand(r.x, r.y))
      .map(r => ({ x: r.x, y: r.y, zi: r.zi, h: r.h, key: r.zi + ':' + r.h, dwelling: r.core.dwelling }));
    if (loose.length) {
      const lanes = laneStrokes(ctx, net, loose);
      if (lanes.length) net = buildNet(strokes.concat(lanes), ctx.R);
    }
  }
  net.source = source;
  const lots = planLots(ctx, net, { osmBuildings, loose });
  const assignment = assignHouseholds(ctx, lots);
  const router = new Router(net);
  const metrics = netMetrics(net, (2 * ctx.R / 1000) ** 2 * Math.max(0.05, ctx.ground.landShare));
  const water = ctx.ground.waterShare > 0 ? waterOutlines(ctx.ground) : [];
  const t1 = typeof performance !== 'undefined' ? performance.now() : 0;
  return {
    ctx, frame: ctx.frame, R: ctx.R, ground: ctx.ground, water, net, router, source,
    lots: lots.lots, buildings: lots.buildings, areas: lots.areas, trees: lots.trees, spots: lots.spots, pools: lots.pools,
    residents: assignment.residents, households: assignment.households, byBuilding: assignment.byBuilding,
    metrics, style: ctx.mode === 'rural' ? 'rural' : ctx.style, mode: ctx.mode, zi: ctx.zi, buildMs: t1 - t0,
    vegOpen: vegetation(ctx).open,
  };
}
