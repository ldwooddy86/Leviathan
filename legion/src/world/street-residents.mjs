// Legion · who lives in the street view, who comes to work in it, and who drives through it.
//
// Every household whose layer-0 home lies inside the view is snapped to a house or apartment on the nearest
// street: the nearest building of its own dwelling type that still has room (apartment buildings get units in
// proportion to their floor area so supply meets the households' demand), falling back to any home with room and
// finally to an extra unit (an in-law apartment) in the nearest home. Household vehicles get parking spots:
// their driveway, then the nearest free curb or lot spaces. The rest of the street's people are real NPCs too:
// workers from nearby ZIPs whose layer-0 workplace is in the view, and drivers chosen from nearby households for
// through traffic. DOM-free.

import { hash2, hash3, u01, Alias } from '../engine/rng.mjs';

const RES_KINDS = ['house', 'small-apartment', 'apartment', 'mobile-home'];
/** Commute modes that put a person behind the wheel. */
const CAR_MODES = new Set(['drive', 'carpool', 'motorcycle', 'taxi']);

/** Uniform grid over items with x, y for nearest-with-predicate queries. */
class Grid {
  constructor(items, cell = 60) {
    this.cell = cell; this.map = new Map(); this.count = 0;
    for (const it of items) { const k = this.key(it.x, it.y); let b = this.map.get(k); if (!b) this.map.set(k, b = []); b.push(it); this.count++; }
  }
  key(x, y) { return Math.floor(x / this.cell) * 65536 + Math.floor(y / this.cell); }
  /** Drop an item (when a building is full or a spot taken) so later searches skip it. */
  remove(it) {
    const b = this.map.get(this.key(it.x, it.y)); if (!b) return;
    const i = b.indexOf(it); if (i < 0) return;
    b[i] = b[b.length - 1]; b.pop(); this.count--;
  }
  /** Nearest item accepted by ok(item) within maxD. */
  nearest(x, y, ok, maxD = 1500) {
    if (!this.count) return null;
    const c = this.cell, cx = Math.floor(x / c), cy = Math.floor(y / c);
    let best = null, bd = maxD;
    for (let r = 0; r * c <= maxD + c; r++) {
      for (let i = cx - r; i <= cx + r; i++) for (let j = cy - r; j <= cy + r; j++) {
        if (r > 0 && i > cx - r && i < cx + r && j > cy - r && j < cy + r) continue;
        const b = this.map.get(i * 65536 + j); if (!b) continue;
        for (const it of b) { const d = Math.hypot(it.x - x, it.y - y); if (d < bd && ok(it)) { bd = d; best = it; } }
      }
      if (best && bd <= r * c) break;
    }
    return best;
  }
}

/**
 * Assign every household in view to a building, every person to their household's building, and household
 * vehicles to parking spots.
 * @param {object} ctx scene context (households.residents from collectHouseholds)
 * @param {{buildings: object[], spots: object[], loose: {key:string, b:number}[]}} lots
 * @returns {{households: object[], residents: object[], byBuilding: Map<number, number[]>}}
 */
export function assignHouseholds(ctx, lots) {
  const buildings = lots.buildings, spots = lots.spots;
  const list = ctx.households.residents;
  const looseMap = new Map((lots.loose || []).map(l => [l.key, l.b]));
  // demand by dwelling type among households not already on their own site
  const demand = { house: 0, 'small-apartment': 0, apartment: 0, 'mobile-home': 0 };
  for (const r of list) if (!looseMap.has(r.zi + ':' + r.h)) demand[r.core.dwelling] = (demand[r.core.dwelling] || 0) + 1;
  // capacities: houses and mobile homes one unit, duplexes their preset units, apartments by floor area
  const res = buildings.filter(b => RES_KINDS.includes(b.kind) && !b.loose);
  const aptB = res.filter(b => b.kind === 'apartment');
  const aptArea = aptB.reduce((a, b) => a + (b.floorArea || b.hw * b.hd * 4 * (b.stories || 2)), 0);
  const aptUnits = Math.ceil(demand.apartment * 1.06) + 2;
  for (const b of res) {
    if (b.kind === 'apartment') b.units = Math.max(2, Math.round(aptUnits * (b.floorArea || b.hw * b.hd * 4 * (b.stories || 2)) / Math.max(1, aptArea)));
    else if (b.kind === 'small-apartment') b.units = b.unitsDemand || b.units || 2;
    else b.units = 1;
    b.free = b.units;
  }
  const grids = {}, anyItems = new Map(), kindItems = new Map();
  for (const k of RES_KINDS) {
    const items = res.filter(b => b.kind === k).map(b => ({ x: b.cx, y: b.cy, b }));
    for (const it of items) kindItems.set(it.b.id, it);
    grids[k] = new Grid(items, 60);
  }
  const anyList = res.map(b => ({ x: b.cx, y: b.cy, b }));
  for (const it of anyList) anyItems.set(it.b.id, it);
  const anyGrid = new Grid(anyList, 60);
  const allGrid = new Grid(buildings.filter(b => RES_KINDS.includes(b.kind)).map(b => ({ x: b.cx, y: b.cy, b })), 60);
  // a full building leaves both search grids
  const take = (b) => {
    b.free--;
    if (b.free <= 0) { const k = kindItems.get(b.id); if (k) grids[b.kind].remove(k); const a = anyItems.get(b.id); if (a) anyGrid.remove(a); }
  };
  // deterministic order: by a hash of the household, so no ZIP or corner of the view gets first pick
  const order = list.map((r, i) => [u01(hash3(ctx.zseed, r.zi, r.h)), i]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
  const households = new Array(list.length);
  const byBuilding = new Map();
  let adu = 0;
  for (const i of order) {
    const r = list[i];
    const key = r.zi + ':' + r.h;
    let bId = looseMap.get(key);
    if (bId === undefined) {
      const want = r.core.dwelling in grids ? r.core.dwelling : 'house';
      // a home of its kind with room nearby, else any home with room nearby; the street they live on matters
      // more than the exact building type, so no one is sent across the view to find one
      let hit = grids[want].nearest(r.x, r.y, it => it.b.free > 0, 250) || anyGrid.nearest(r.x, r.y, it => it.b.free > 0, 250);
      if (hit) take(hit.b);
      else {
        // everything nearby is taken: one more unit in a building of its kind close by (apartments grow a unit,
        // houses an in-law apartment), else in the nearest home of any kind
        hit = allGrid.nearest(r.x, r.y, it => it.b.kind === want, 300) || allGrid.nearest(r.x, r.y, () => true, 5000);
        if (hit) { hit.b.units++; adu++; }
      }
      if (!hit) { households[i] = null; continue; }
      bId = hit.b.id;
    }
    const b = buildings[bId];
    b.residents += r.core.size;
    let arr = byBuilding.get(bId); if (!arr) byBuilding.set(bId, arr = []); arr.push(i);
    households[i] = { index: i, key, id: r.core.id, zi: r.zi, h: r.h, core: r.core, b: bId, home: { x: r.x, y: r.y }, vehicles: r.core.vehicles || 0, spots: [] };
  }
  // parking: driveway pads of the building, then the nearest free curb space or stall
  const free = spots.filter(s => s.kind !== 'driveway');
  const spotItems = free.map(s => ({ x: s.x, y: s.y, s }));
  const spotGrid = new Grid(spotItems, 40);
  const byB = new Map();
  for (const s of spots) if (s.kind === 'driveway' && s.b >= 0) { let a = byB.get(s.b); if (!a) byB.set(s.b, a = []); a.push(s); }
  for (const i of order) {
    const hh = households[i]; if (!hh) continue;
    const b = buildings[hh.b];
    let need = Math.min(hh.vehicles, 4);
    for (const s of byB.get(b.id) || []) { if (need <= 0) break; if (s.owner < 0) { s.owner = i; hh.spots.push(s.id); need--; } }
    const ax = b.access ? b.access.curbX : b.cx, ay = b.access ? b.access.curbY : b.cy;
    while (need > 0) {
      const hit = spotGrid.nearest(ax, ay, it => it.s.owner < 0 && (it.s.kind === 'curb' || it.s.b === b.id || (b.area !== undefined && it.s.area === b.area)), 160);
      if (!hit) break;
      hit.s.owner = i; hh.spots.push(hit.s.id); need--;
      spotGrid.remove(hit);
    }
    hh.garaged = Math.min(hh.vehicles, 4) - hh.spots.length;   // the rest are in garages and carports, unseen
  }
  // persons
  const residents = [];
  for (let i = 0; i < households.length; i++) {
    const hh = households[i]; if (!hh) continue;
    const zip = ctx.world.zips[hh.zi];
    hh.members = [];
    for (const m of hh.core.members) {
      const id = `${zip}-${hh.h}-${m.m}`;
      hh.members.push(residents.length);
      residents.push({ id, zi: hh.zi, h: hh.h, m: m.m, hh: i, b: hh.b, member: m });
    }
  }
  return { households, residents, byBuilding, adu };
}

// ---------------------------------------------------------------- nearby people

/**
 * Nearby ZIPs with households, weighted by size and distance (for in-commuters, through traffic, visitors).
 * @returns {{zips: number[], dist: number[], alias: Alias}}
 */
export function nearbyZips(world, wx, wy, km = 25) {
  const near = world.zipsNear(wx, wy, km).filter(([i]) => (world.z.hh[i] || 0) > 0);
  if (!near.length) { const i = world.zipAt(wx, wy); return { zips: i >= 0 ? [i] : [], dist: [0], alias: new Alias([1]) }; }
  return { zips: near.map(n => n[0]), dist: near.map(n => n[1]), alias: new Alias(near.map(([i, d]) => (world.z.hh[i] || 0) * Math.exp(-d / 7))) };
}

/**
 * Incremental scan for in-commuters: workers in nearby ZIPs' households whose layer-0 workplace ZIP is one of
 * the view's ZIPs and whose workplace point falls inside the view. Households are sampled at a fixed stride
 * (deterministic by hash), so the scan can run a few milliseconds per frame.
 */
export class CommuterScan {
  /**
   * @param {object} world
   * @param {object} population
   * @param {object} scene a built scene (frame, R, zi, households)
   * @param {{stride?: number, maxHouseholds?: number, km?: number}} [opts]
   */
  constructor(world, population, scene, { stride = 0, maxHouseholds = 60000, km = 22 } = {}) {
    this.world = world; this.pop = population; this.scene = scene;
    const f = scene.frame;
    const near = world.zipsNear(f.cx, f.cy, km).filter(([i]) => (world.z.hh[i] || 0) > 0);
    const total = near.reduce((a, [i]) => a + world.z.hh[i], 0);
    this.stride = stride || Math.max(1, Math.ceil(total / maxHouseholds));
    this.zips = near.map(n => n[0]);
    this.targets = new Set([...scene.ctx.perZip.keys(), scene.zi].filter(z => z >= 0));
    this.zk = 0; this.h = 0; this.found = []; this.done = !this.zips.length; this.scanned = 0;
    this.salt = hash2(scene.ctx.zseed, 0xc0c0);
  }
  /** Scan for up to `ms` milliseconds (or `count` households); returns true when finished. */
  step(ms = 4, count = Infinity) {
    const t0 = now();
    const { world, pop } = this, R = this.scene.R, f = this.scene.frame;
    let n = 0;
    while (!this.done && n < count) {
      const zi = this.zips[this.zk];
      const H = world.z.hh[zi] || 0;
      if (this.h >= H) { this.zk++; this.h = 0; if (this.zk >= this.zips.length) this.done = true; continue; }
      const h = this.h;
      this.h += 1;
      if ((hash3(this.salt, zi, h) % this.stride) !== 0) continue;
      n++; this.scanned++;
      const core = pop.householdCore(zi, h);
      // the view's own residents are already on its streets
      const hx = (core.home.x - f.cx) * f.fx, hy = (core.home.y - f.cy) * f.fy;
      if (Math.abs(hx) <= R && Math.abs(hy) <= R) continue;
      for (const m of core.members) {
        if (m.workZi < 0 || !m.work || !this.targets.has(m.workZi)) continue;
        const lx = (m.work.x - f.cx) * f.fx, ly = (m.work.y - f.cy) * f.fy;
        if (Math.abs(lx) > R * 0.97 || Math.abs(ly) > R * 0.97) continue;
        this.found.push({ id: `${world.zips[zi]}-${h}-${m.m}`, zi, h, m: m.m, member: m, home: core.home, workX: lx, workY: ly });
      }
      if ((n & 63) === 0 && now() - t0 > ms) break;
    }
    return this.done;
  }
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/**
 * A real NPC to drive a vehicle through the view at minute-of-day `minute`: drawn from nearby households by
 * hash, preferring an adult who drives to work and is on the road at that hour; falling back to any driving
 * adult, then any adult. With `job` ('transport') a bus driver is preferred; with `walk` someone on foot.
 * `exclude(id)` turns people away (already on the street, or living in the view).
 * @param {{job?: string|null, walk?: boolean, tries?: number, exclude?: ((id: string) => boolean)|null}} [opts]
 * @returns {{id:string, zi:number, h:number, m:number, member:object}|null}
 */
export function pickDriver(world, population, near, h, minute, { job = null, walk = false, tries = 7, exclude = null } = {}) {
  let fallback = null, anyAdult = null;
  for (let k = 0; k < tries; k++) {
    const hk = hash2(h, k + 1);
    const zi = near.zips[near.alias.draw(u01(hk), u01(hash2(hk, 9)))];
    if (zi === undefined) continue;
    const H = world.z.hh[zi] || 0; if (!H) continue;
    const hh = hash2(hk, 3) % H;
    const core = population.householdCore(zi, hh);
    for (const m of core.members) {
      if (m.age < (walk ? 12 : 16)) continue;
      const id = `${world.zips[zi]}-${hh}-${m.m}`;
      if (exclude && exclude(id)) continue;
      const cand = { id, zi, h: hh, m: m.m, member: m, home: core.home };
      if (!anyAdult) anyAdult = cand;
      if (job && m.occ === job) return cand;
      const fits = walk ? (m.mode === 'walk' || m.mode === 'bus' || m.mode === 'rail' || !m.worker) : CAR_MODES.has(m.mode);
      if (!fits) continue;
      if (!fallback) fallback = cand;
      if (m.departMin != null) {
        const d0 = m.departMin, d1 = d0 + Math.max(10, m.commuteMin), r0 = (d0 + m.commuteMin + m.dwellMin) % 1440, r1 = r0 + Math.max(10, m.commuteMin);
        const inWin = (t, a, b) => (t >= a && t <= b) || (t + 1440 >= a && t + 1440 <= b);
        if (inWin(minute, d0 - 5, d1 + 5) || inWin(minute, r0 - 5, r1 + 5)) return cand;
      }
    }
  }
  return fallback || anyAdult;
}

export { CAR_MODES };
