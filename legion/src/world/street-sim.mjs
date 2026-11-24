// Legion · the street simulation: the people of one view going about their day.
//
// Who is out comes from a planner: the schedule module's activity (planFor) when the app wires it in, else the
// fallback planner over layer 0 (street-plan.mjs). A min-heap holds, for every resident and in-commuter, the next
// time their plan might put them on the street; at that time their trip is routed on the view's graph (to a
// building in view, or to the exit facing a destination outside) and they appear: walking out the door to the
// sidewalk, or backing the household car out of its driveway or curb space. Cars keep lanes and follow the car
// ahead (intelligent driver model), stop for red lights and at stop signs (first come, first served, with the
// box kept clear), and park at the other end; pedestrians walk the sidewalks and cross at corners; cyclists
// ride the curb edge; bus riders wait at stops for real buses. Through traffic, buses and shoppers are real NPCs
// from nearby households. The simulation advances in fixed 0.2 s steps; when the clock runs faster than the
// step budget allows, everyone jumps to where the schedule puts them. Deterministic, DOM-free.

import { hash2, hash3, u01, clamp } from '../engine/rng.mjs';
import { pacific } from '../engine/clock.mjs';
import { pointAt } from './street-geo.mjs';
import { laneOffset, lanesIn, sidewalkOffset, bikeOffset, signalState } from './street-net.mjs';
import { isTravel, originOf, normalizeActivity, createFallbackPlanner } from './street-plan.mjs';
import { nearbyZips, pickDriver, CommuterScan, CAR_MODES } from './street-residents.mjs';

/** Simulation step, seconds. */
export const DT = 0.2;
const MIN = 60000;
const IDM = { car: { a: 1.6, b: 2.4, s0: 2.2, T: 1.25 }, bus: { a: 1.0, b: 1.9, s0: 3.0, T: 1.6 }, bike: { a: 1.0, b: 2.0, s0: 1.4, T: 1.0 } };
const MIN_GAP = 1.0;
const WALK_SPEED = 1.35;
/** Shortest exercise loop worth walking (meters, out and back). */
const MIN_LOOP = 30;
/** Below this speed (m/s) a vehicle is standing, not approaching. */
const STANDING = 0.5;
/** A bus's average speed along its route, stops included (m/s): its timetable through the view. */
const BUS_V = 7;
/** The longest anyone waits at a bus stop before giving up on it (seconds). */
const MAX_WAIT = 25 * 60;
/** Fastest walker (m/s): anyone who arrived longer ago than their route takes at this speed is through. */
const WALK_MAX = 1.6;
/** Arrivals per minute at one entry, at most (a guard; the busiest freeway sees about a hundred). */
const MAX_PER_MINUTE = 600;
/** After a jump, at most this many vehicles per entry and walkers in all are back-filled (newest first). */
const JUMP_SPAWNS = 60, JUMP_WALKERS = 160;
/** A vehicle that cannot enter the view for this long (ms) takes another way. */
const MAX_HOLD = 20000;
/** Routes kept from the view's entries (to exits and to stores). */
const ROUTE_CACHE = 12000;
/** People per ten simulated minutes who drive or walk the vehicles a fast clock back-fills (see _driverFor). */
const POOL = 384, POOL_BUCKET = 10 * MIN;

/**
 * A deterministic arrival process: for every epoch minute, arrival times drawn as exponential gaps at that
 * minute's rate, each gap from a hash of (salt, minute, index). Stepping walks a cursor through the lists and a
 * jump back-fills from the same lists, so the same vehicle arrives whichever way the clock got there, and every
 * arrival has a key of its own for who and what it is.
 */
class Arrivals {
  /**
   * @param {number} salt
   * @param {(t: number) => number} rate arrivals per second at epoch ms t
   */
  constructor(salt, rate) { this.salt = salt >>> 0; this.rate = rate; this.lists = new Map(); this.cm = null; this.ci = 0; this.hold = -Infinity; }
  /** Arrivals during epoch minute m, in seconds into the minute, ascending (the last few minutes are kept). */
  minute(m) {
    let list = this.lists.get(m);
    if (list) return list;
    const r = this.rate(m * MIN + MIN / 2);
    list = [];
    if (r > 0) {
      const h = hash2(this.salt, m);
      let s = 0;
      for (let i = 0; i < MAX_PER_MINUTE; i++) { s += -Math.log(1 - u01(hash2(h, i)) * 0.999) / r; if (s >= 60) break; list.push(s); }
    }
    if (this.lists.size >= 8) this.lists.delete(this.lists.keys().next().value);
    this.lists.set(m, list);
    return list;
  }
  /** The key of arrival i of minute m. */
  key(m, i) { return hash3(hash2(this.salt, m), i, 0x5eed); }
  /** Put the cursor on the first arrival after t. */
  seek(t) {
    this.cm = Math.floor(t / MIN);
    const list = this.minute(this.cm);
    let i = 0;
    while (i < list.length && this.cm * MIN + list[i] * 1000 <= t) i++;
    this.ci = i; this.hold = -Infinity;
  }
  /** Time of the arrival under the cursor (moving on to later minutes when this one has no more). */
  peek() {
    for (let g = 0; g < 240; g++) {
      const list = this.minute(this.cm);
      if (this.ci < list.length) return this.cm * MIN + list[this.ci] * 1000;
      this.cm++; this.ci = 0;
    }
    return Infinity;
  }
  /** Key of the arrival under the cursor. */
  cursorKey() { return this.key(this.cm, this.ci); }
  /** Every arrival in (from, to], newest first: fn(tArr, key) returns false to stop. */
  backfill(from, to, fn) {
    for (let m = Math.floor(to / MIN); m >= Math.floor(from / MIN); m--) {
      const list = this.minute(m);
      for (let i = list.length - 1; i >= 0; i--) {
        const tArr = m * MIN + list[i] * 1000;
        if (tArr > to || tArr <= from) continue;
        if (fn(tArr, this.key(m, i)) === false) return;
      }
    }
  }
}

const VEHICLES = [
  { body: 'sedan', len: 4.7, wid: 1.85, w: 34 }, { body: 'suv', len: 4.9, wid: 1.95, w: 26 }, { body: 'compact', len: 4.2, wid: 1.78, w: 16 },
  { body: 'pickup', len: 5.6, wid: 2.0, w: 14 }, { body: 'van', len: 5.2, wid: 2.0, w: 6 }, { body: 'motorcycle', len: 2.2, wid: 0.8, w: 0 },
];
const CAR_COLORS = ['#f2f2f0', '#f2f2f0', '#1d1f22', '#1d1f22', '#8e9399', '#8e9399', '#c4c8cc', '#c4c8cc', '#2f4d7c', '#9b2a2a', '#5a2e2e', '#3c5f43', '#7a6a55', '#b8a77c', '#2a6f86', '#d9822b'];
const SHIRTS = ['#3f6db3', '#c94f4f', '#e2b13c', '#4f9a6b', '#7d5ba6', '#e07a3a', '#2f3b4c', '#f0efe9', '#9a9a9a', '#1d8a99', '#b3446c', '#6b8e23', '#d8c3a5', '#30475e'];
const HAIR = ['#1b1612', '#2e2219', '#4a3424', '#6b4a2e', '#8c6239', '#b58a52', '#d6b37a', '#3a3a3a'];

/** Relative traffic by hour (weekday / weekend), peak 1: the familiar double hump of California arterials. */
const WEEKDAY = [0.10, 0.06, 0.05, 0.05, 0.09, 0.23, 0.58, 0.9, 0.95, 0.75, 0.66, 0.69, 0.72, 0.72, 0.77, 0.87, 0.97, 1.0, 0.8, 0.59, 0.46, 0.38, 0.3, 0.2];
const WEEKEND = [0.18, 0.12, 0.09, 0.06, 0.06, 0.1, 0.18, 0.3, 0.45, 0.6, 0.72, 0.8, 0.84, 0.84, 0.82, 0.8, 0.78, 0.74, 0.66, 0.56, 0.46, 0.4, 0.33, 0.24];
const SHOPPING = [0.02, 0.01, 0.01, 0.01, 0.02, 0.05, 0.12, 0.25, 0.45, 0.65, 0.8, 0.95, 1.0, 0.95, 0.88, 0.85, 0.85, 0.9, 0.88, 0.72, 0.5, 0.32, 0.16, 0.06];

/** Relative traffic at a minute of day. */
export function trafficProfile(minuteOfDay, weekend, table = null) {
  const T = table || (weekend ? WEEKEND : WEEKDAY);
  const h = minuteOfDay / 60, i = Math.floor(h) % 24, f = h - Math.floor(h);
  return T[i] * (1 - f) + T[(i + 1) % 24] * f;
}

class MinHeap {
  constructor() { this.k = []; this.v = []; }
  get size() { return this.k.length; }
  push(key, val) { const k = this.k, v = this.v; let i = k.length; k.push(key); v.push(val); while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= key) break; k[i] = k[p]; v[i] = v[p]; i = p; } k[i] = key; v[i] = val; }
  peek() { return this.k[0]; }
  pop() {
    const k = this.k, v = this.v, top = v[0], last = k.length - 1, lk = k[last], lv = v[last]; k.pop(); v.pop();
    if (last > 0) { let i = 0; for (;;) { let c = 2 * i + 1; if (c >= last) break; if (c + 1 < last && k[c + 1] < k[c]) c++; if (k[c] >= lk) break; k[i] = k[c]; v[i] = v[c]; i = c; } k[i] = lk; v[i] = lv; }
    return top;
  }
  clear() { this.k.length = 0; this.v.length = 0; }
}

/** Visual look of a person from their id: shirt, hair (grey with age), size. Purely cosmetic. */
function personLook(id, age) {
  const h = hash2(0x7e0c, idHash(id));
  const grey = age >= 60 ? clamp((age - 55) / 30, 0, 1) : 0;
  return { shirt: SHIRTS[h % SHIRTS.length], hair: grey > 0.5 ? (age > 75 ? '#e6e3dc' : '#a9a6a0') : HAIR[(h >>> 5) % HAIR.length], scale: age < 13 ? 0.72 : age < 17 ? 0.88 : 1, pants: ['#2b3442', '#3b3b3b', '#5a5248', '#1f2a44', '#6d6a63'][(h >>> 9) % 5] };
}
/** FNV-1a hash of an NPC id string (for cosmetic choices that must stay the same for a person). */
function idHash(id) { let h = 0x811c9dc5; for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; }
/** A vehicle's body and color from a hash: the California mix of sedans, SUVs, compacts and (more in the country) pickups. */
function vehicleLook(h, rural) {
  const w = VEHICLES.map(v => v.w * (v.body === 'pickup' && rural ? 2.5 : 1));
  let tot = w.reduce((a, b) => a + b, 0), x = u01(h) * tot, i = 0;
  for (; i < w.length - 1; i++) { x -= w[i]; if (x <= 0) break; }
  const v = VEHICLES[i];
  return { body: v.body, len: v.len, wid: v.wid, color: CAR_COLORS[(h >>> 7) % CAR_COLORS.length] };
}

/**
 * The simulation of one street scene.
 */
export class StreetSim {
  /**
   * @param {object} scene a built scene (street-scene.mjs)
   * @param {{world: object, population: object, planner?: Function|null, seed?: number, trafficScale?: number,
   *   commuterBudget?: number}} opts planner: (id, t) → activity; defaults to the fallback planner over layer 0
   */
  constructor(scene, { world, population, planner = null, seed = 1, trafficScale = 1, commuterBudget = 60000 } = {}) {
    this.scene = scene; this.net = scene.net; this.router = scene.router;
    this.world = world; this.pop = population;
    this.fallback = createFallbackPlanner(world, population);
    this.external = typeof planner === 'function';
    this.planner = this.external ? planner : this.fallback;
    /**
     * With an external planner (the schedule module) everyone is first placed by the fast layer-0 planner and then
     * moved over to the external plan in the background (upgrade()), people on the street first. `hybrid: false`
     * uses the external planner from the start (fine for fast planners).
     */
    this.hybrid = this.external;
    this.seed = hash2(seed, scene.ctx.zseed);
    this.trafficScale = trafficScale;
    this.R = scene.R;
    this.frame = scene.frame;
    this.rural = scene.mode === 'rural';
    this.t = 0;
    this.agents = [];
    this.byUid = new Map();
    this.uid = 1;
    this.queues = new Map();
    this.heap = new MinHeap();
    const nN = this.net.nodes.length;
    this.inside = new Int16Array(nN);
    this.waiting = Array.from({ length: nN }, () => []);
    this.spotCar = new Int32Array(scene.spots.length).fill(-1);    // parked car look id (hash) or -1
    this.spotLook = new Map();
    this.bubbles = [];
    this.barkLog = new Map();
    this.lastBarkMs = -Infinity;
    this.stats0 = { spawned: 0, finished: 0, jumps: 0, steps: 0 };
    /** NPC ids on the street now (with how many agents: never more than one), and shoppers inside a store. */
    this.activeIds = new Map();
    this.shoppers = new Set();
    this._pendingReturns = []; this._nextReturn = Infinity;
    /** Someone who cannot be picked to drive or walk through: on the street already, shopping here, or one of the view's own people. */
    this._busyId = id => this.activeIds.has(id) || this.shoppers.has(id) || this.personIds.has(id);
    this.near = nearbyZips(world, this.frame.cx, this.frame.cy, 25);
    /** Milliseconds of planner calls allowed per step (Infinity for the fast fallback planner). */
    this.evalBudgetMs = Infinity;
    this.commuterScan = new CommuterScan(world, population, scene, { maxHouseholds: commuterBudget });
    this._initPersons();
    this._initStreams();
    this._initBuses();
  }

  // ------------------------------------------------ setup

  _initPersons() {
    const sc = this.scene;
    this.persons = [];
    for (let ri = 0; ri < sc.residents.length; ri++) {
      const r = sc.residents[ri];
      const hh = sc.households[r.hh];
      this.persons.push({ pid: this.persons.length, id: r.id, role: 'resident', member: r.member, hh: r.hh, b: r.b, agent: null, next: 0, look: null, veh: -1, spot: -1, awaySpot: -1, awayB: -1, ext: false });
    }
    this.personIds = new Set(this.persons.map(p => p.id));
    // household drivers: car commuters first, then other adults; vehicle k belongs to driver k
    for (const hh of sc.households) {
      if (!hh) continue;
      const ms = hh.members.map(i => this.persons[i]).filter(p => p.member.age >= 16);
      ms.sort((a, b) => (CAR_MODES.has(b.member.mode) ? 1 : 0) - (CAR_MODES.has(a.member.mode) ? 1 : 0) || a.member.m - b.member.m);
      ms.forEach((p, k) => { if (k < Math.min(4, hh.vehicles)) { p.veh = k; p.spot = k < hh.spots.length ? hh.spots[k] : -1; } });
    }
    this.residentCount = this.persons.length;
  }

  /** Add in-commuters found so far by the incremental scan (called as the scan progresses). */
  _absorbCommuters() {
    const scan = this.commuterScan;
    const nb = this._workBuildings || (this._workBuildings = this.scene.buildings.filter(b => b.kind === 'commercial' || b.kind === 'industrial' || b.kind === 'school' || b.kind === 'church' || b.kind === 'apartment'));
    while (this._absorbed < scan.found.length) {
      const c = scan.found[this._absorbed++];
      let best = null, bd = Infinity;
      for (const b of nb) { const d = Math.hypot(b.cx - c.workX, b.cy - c.workY); if (d < bd) { bd = d; best = b; } }
      if (!best || bd > 260 || !best.access) continue;
      const p = { pid: this.persons.length, id: c.id, role: 'commuter', member: c.member, hh: -1, b: best.id, workB: best.id, agent: null, next: 0, look: null, veh: CAR_MODES.has(c.member.mode) ? 0 : -1, spot: -1, awaySpot: -1, awayB: -1, homeW: c.home, ext: false };
      this.persons.push(p);
      this.personIds.add(p.id);
      this._schedule(p, this.t);
    }
  }

  _initStreams() {
    const net = this.net;
    this.entries = [];
    const dens = this.scene.ctx.density || 1000;
    const urban = clamp(Math.log10(Math.max(100, dens)) / 4.2, 0.25, 1);
    for (const n of net.nodes) {
      if (!n.exit) continue;
      const E = net.edges[n.adj[0].e];
      if (!E.car) continue;
      let perHour = 0;
      if (E.freeway) perHour = (E.aadt || 60000) * 0.5 * 0.085;
      else if (E.cls === 'highway') perHour = (E.aadt || 12000) * 0.5 * 0.09;
      else if (E.cls === 'arterial') perHour = 420 * urban * (E.lanesF >= 3 ? 1.5 : 1);
      else if (E.cls === 'collector') perHour = 140 * urban;
      else if (E.cls === 'rural') perHour = 55;
      else if (E.cls === 'local') perHour = 6 * urban;
      if (perHour <= 0) continue;
      const dir = n.adj[0].end === 0 ? 1 : -1;     // travel into the view leaves the exit node
      if (lanesIn(E, dir) <= 0 && !E.shared) continue;
      const en = { node: n.id, e: E.id, dir, cls: E.cls, perHour, name: E.name, freeway: E.freeway };
      en.arr = new Arrivals(hash2(this.seed, n.id * 7919 + 13), t => this._rate(en, t));
      this.entries.push(en);
    }
    this.carExits = net.nodes.filter(n => n.exit && net.edges[n.adj[0].e].car).map(n => n.id);
    this.walkExits = net.nodes.filter(n => n.exit && net.edges[n.adj[0].e].foot).map(n => n.id);
    this.shops = this.scene.buildings.filter(b => b.kind === 'commercial' && b.access && net.edges[b.access.e] && net.edges[b.access.e].car);
    this.parks = this.scene.areas.filter(a => a.kind === 'park' && a.access);
    // pedestrians passing through and shopping: dense places only
    const walkShare = this._walkShare();
    this.footRate = dens > 6000 ? clamp(dens / 25000, 0.25, 1.6) * (0.6 + walkShare * 6) * 40 : dens > 2500 ? 8 : 0;   // per hour per exit at peak
    this.foot = new Arrivals(hash2(this.seed, 0xf00d), t => this._footRate(t));
    this.routeCache = new Map();
  }

  _walkShare() {
    const c = this.world.acsNamed(this.scene.zi >= 0 ? this.scene.zi : 0, 'comm');
    const tot = Object.values(c).reduce((a, b) => a + b, 0) || 1;
    return ((c.walk || 0) + (c.bus || 0) + (c.rail || 0) * 0.5) / tot;
  }

  _initBuses() {
    this.busRoutes = [];
    this.stops = [];
    const c = this.world.acsNamed(this.scene.zi >= 0 ? this.scene.zi : 0, 'comm');
    const tot = Object.values(c).reduce((a, b) => a + b, 0) || 1;
    const busShare = (c.bus || 0) / tot;
    if (busShare < 0.008) return;
    const net = this.net;
    const art = this.carExits.filter(id => { const E = net.edges[net.nodes[id].adj[0].e]; return E.cls === 'arterial' || E.cls === 'highway'; });
    const used = new Set();
    const pairs = [];
    for (const a of art) for (const b of art) {
      if (a >= b) continue;
      const na = net.nodes[a], nb = net.nodes[b];
      const opp = (na.side === 'N' && nb.side === 'S') || (na.side === 'S' && nb.side === 'N') || (na.side === 'E' && nb.side === 'W') || (na.side === 'W' && nb.side === 'E');
      if (!opp) continue;
      if (net.edges[na.adj[0].e].name !== net.edges[nb.adj[0].e].name) continue;
      pairs.push([a, b, Math.hypot(na.x - nb.x, na.y - nb.y)]);
    }
    pairs.sort((p, q) => q[2] - p[2]);
    for (const [a, b] of pairs) {
      if (this.busRoutes.length >= 4 || used.has(a) || used.has(b)) continue;
      for (const [from, to] of [[a, b], [b, a]]) {
        const path = this.router.path('car', { node: from }, { node: to });
        if (!path || path.length < 400) continue;
        const stops = this._placeStops(path);
        const headway = (busShare > 0.08 ? 8 : busShare > 0.03 ? 14 : 28) * 60;
        for (const sid of stops) this.stops[sid].route = this.busRoutes.length;
        this.busRoutes.push({ path, from, to, stops, headway, phase: u01(hash3(this.seed, from, to)) * headway, k: null, name: net.edges[net.nodes[from].adj[0].e].name });
      }
      used.add(a); used.add(b);
    }
  }

  /** Bus stops every ~320 m along a route, a little past intersections, on the right side. */
  _placeStops(path) {
    const out = [];
    let acc = 0, nextAt = 160;
    path.steps.forEach((st, k) => {
      const L = Math.abs(st.to - st.from);
      while (nextAt < acc + L - 25) {
        const d = Math.max(20, nextAt - acc);
        if (d > L - 20) break;
        const p = this._stepPoint(st, d, {});
        const E = this.net.edges[st.e];
        const off = sidewalkOffset(E) - 0.6;
        const stop = { id: this.stops.length, k, d, at: acc + d, route: -1, x: p.x - p.ty * off, y: p.y + p.tx * off, ang: Math.atan2(p.ty, p.tx), e: st.e, waiting: new Set(), served: 0 };
        this.stops.push(stop);
        out.push(stop.id);
        nextAt += 320;
      }
      acc += L;
    });
    return out;
  }

  // ------------------------------------------------ geometry helpers

  /** Point and travel tangent at distance d along a path step. */
  _stepPoint(st, d, out) {
    const E = this.net.edges[st.e];
    const s = clamp(st.from + st.dir * d, 0, E.len);
    pointAt(E.pts, E.cum, s, out);
    if (st.dir < 0) { out.tx = -out.tx; out.ty = -out.ty; }
    return out;
  }

  // ------------------------------------------------ time and reset

  /**
   * Rebuild the state at time t (epoch ms): everybody where their plan puts them, parked cars at home for the
   * people at home, through traffic already on the road. Used at open and whenever time jumps.
   */
  reset(t) {
    this.t = t;
    this.agents.length = 0;
    this.byUid.clear();
    this.activeIds.clear();
    this.shoppers.clear();
    this._pendingReturns = []; this._nextReturn = Infinity;
    this.queues.clear();
    this.inside.fill(0);
    for (const w of this.waiting) w.length = 0;
    for (const s of this.stops) s.waiting.clear();
    this.heap.clear();
    this.bubbles.length = 0;
    // every household car starts parked; departures below clear their spots
    this.spotCar.fill(-1);
    for (const hh of this.scene.households) {
      if (!hh) continue;
      hh.spots.forEach((sid, k) => { this.spotCar[sid] = hash3(this.seed, hh.zi, hh.h * 8 + k); });
    }
    this._absorbed = 0;
    for (const p of this.persons) { p.agent = null; p.away = false; p.awaySpot = -1; p.awayB = -1; }
    this.persons.length = this.residentCount;
    this._absorbCommuters();
    this._bulk = true;
    if (this.external && !this.hybrid && this.evalBudgetMs < Infinity) {
      // a slow external planner without the layer-0 head start: everyone goes on the heap and is placed over frames
      for (const p of this.persons) this._schedule(p, t);
      this._processEvents(t, true);
    } else for (const p of this.persons) this._evaluateSafe(p, t, true);
    this._upOrder = null; this._upK = 0;
    // the buses on their routes and the traffic already on the road
    for (const r of this.busRoutes) r.k = null;
    this._streamsJump(t, 900);
    this._buses(t);
    this._bulk = false;
    this._rebuildQueues();
    this._settleQueues();
  }

  /**
   * Advance the simulation to time target (epoch ms) in fixed steps; beyond `maxSteps` it jumps instead.
   * @returns {{steps:number, jumped:boolean}}
   */
  advance(target, { maxSteps = 14, maxCatchupMs = 20 * MIN } = {}) {
    const dtMs = DT * 1000;
    const gap = target - this.t;
    if (gap < -1 || gap > maxCatchupMs) { this.reset(target); this.stats0.jumps++; return { steps: 0, jumped: true }; }
    const need = Math.floor(gap / dtMs);
    if (need > maxSteps) { this.jumpTo(target); return { steps: 0, jumped: true }; }
    for (let i = 0; i < need; i++) this.step();
    return { steps: need, jumped: false };
  }

  /**
   * Move to time t without stepping: agents slide to their schedule positions, events fire, streams fill. Cars
   * are placed first and the queues ordered once at the end (a fast clock jumps every frame).
   */
  jumpTo(t) {
    const t0 = this.t;
    this.t = t;
    this.stats0.jumps++;
    this._bulk = true; this._fast = true;
    this.queues.clear();
    for (const a of this.agents) a.q = null;
    for (let i = this.agents.length - 1; i >= 0; i--) {
      const a = this.agents[i];
      if (!this._placeOnSchedule(a, t)) this._finish(a, i);
    }
    this._processEvents(t, true);
    this._returns(t, true);
    this._streamsJump(t, Math.min(900, (t - t0) / 1000));
    this._buses(t);
    this._bulk = false; this._fast = false;
    this._rebuildQueues();
    this._settleQueues();
  }

  /** One fixed step of DT seconds. */
  step() {
    this.t += DT * 1000;
    this.stats0.steps++;
    try {
      this._processEvents(this.t, false);
      this._streams(this.t);
      this._buses(this.t);
      this._returns(this.t, false);
      this._sortQueues();
    } catch (err) { this.repair(err); }
    const agents = this.agents;
    for (let i = agents.length - 1; i >= 0; i--) {
      const a = agents[i];
      let done;
      try { done = this._move(a, DT); } catch (err) { this._fault(a, err); i = Math.min(i, agents.length); continue; }
      if (done) this._finish(a, i);
    }
  }

  /**
   * Recover from a failure outside one agent's own update (a frame that could not be drawn, a queue that could not
   * be sorted): every agent whose state no longer reads is taken off the street and the failure is counted.
   * @param {unknown} err
   */
  repair(err) { this._fault(null, err); }

  /**
   * Contain a failure in one agent's update: take it (and any other agent whose route state no longer reads)
   * off the street, count it, and keep the simulation running. The person is planned again as usual.
   */
  _fault(a, err) {
    this.stats0.faults = (this.stats0.faults || 0) + 1;
    this.lastFault = { id: a ? a.id : null, kind: a ? a.kind : null, phase: a ? a.phase : null, message: String(err && err.message || err), t: this.t };
    const bad = new Set(a ? [a] : []);
    for (const b of this.agents) if (!agentReadable(b)) bad.add(b);
    for (const b of bad) {
      const i = this.agents.indexOf(b);
      if (i < 0) continue;
      try { this._finish(b, i); } catch { this.agents.splice(i, 1); this.byUid.delete(b.uid); this._untrack(b); if (b.q !== null && b.q !== undefined) { const q = this.queues.get(b.q); if (q) { const k = q.indexOf(b); if (k >= 0) q.splice(k, 1); } } }
    }
  }

  /**
   * Background work for spare frame time: scan nearby households for in-commuters, then precompute the routing
   * trees to every exit so trips leaving the view route instantly.
   * @param {number} budgetMs
   */
  warm(budgetMs = 3) {
    const t0 = now();
    if (this.external && this.hybrid && !this.upgrade(budgetMs * 0.5)) return;
    if (!this.commuterScan.done) { this.scanCommuters(budgetMs * 0.6); }
    if (!this._warmList) this._warmList = this.carExits.map(id => ['car', id]).concat(this.walkExits.map(id => ['foot', id]));
    while (this._warmList.length && now() - t0 < budgetMs) { const [m, id] = this._warmList.pop(); this.router.tree(m, id); }
  }

  /** Run the in-commuter scan for up to ms milliseconds (Infinity to finish) and put the commuters found on the plan. */
  scanCommuters(ms = 4) {
    if (this.commuterScan.done) return true;
    this.commuterScan.step(ms);
    this._absorbCommuters();
    return this.commuterScan.done;
  }

  // ------------------------------------------------ persons and their trips

  _schedule(p, at) { p.next = at; this.heap.push(at, p.pid); }

  _processEvents(t, jumping) {
    const heap = this.heap;
    let guard = 0;
    const t0 = this.evalBudgetMs < Infinity ? now() : 0;
    while (heap.size && heap.peek() <= t && guard++ < 40000) {
      if (t0 && (guard & 15) === 0 && now() - t0 > this.evalBudgetMs) break;     // an expensive planner: continue next step
      const key = heap.peek();
      const pid = heap.pop();
      const p = this.persons[pid];
      if (!p || p.agent || p.next !== key) continue;      // stale entry: the person was rescheduled since
      this._evaluateSafe(p, t, jumping);
    }
  }

  /** _evaluate, with a plan that cannot be followed (malformed activity, a route that does not read) looked at again in an hour. */
  _evaluateSafe(p, t, jumping) {
    try { this._evaluate(p, t, jumping); }
    catch (err) {
      this.stats0.faults = (this.stats0.faults || 0) + 1;
      this.lastFault = { id: p.id, kind: 'plan', phase: null, message: String(err && err.message || err), t };
      if (p.agent) { const i = this.agents.indexOf(p.agent); if (i >= 0) this._finish(p.agent, i); p.agent = null; }
      this._schedule(p, t + 60 * MIN);
    }
  }

  /** The plan of a person at t: the external planner once they have been moved over to it, else layer 0. */
  _plan(p, t) {
    if (!this.external || (this.hybrid && !p.ext)) return this.fallback(p.id, t);
    return this.planner(p.id, t);
  }

  /**
   * Move people from the fast layer-0 plan to the external planner, for up to budgetMs: people on the street
   * first, then everyone else. A trip the external plan does not have ends (the person slips out of view) and the
   * person is placed where the external plan puts them.
   * @returns {boolean} true when everyone has been moved over
   */
  upgrade(budgetMs = 2) {
    if (!this.external || !this.hybrid) return true;
    const t0 = now();
    if (!this._upOrder || this._upOrder.length !== this.persons.length) {
      const onStreet = new Set(this.agents.filter(a => a.person >= 0).map(a => a.person));
      this._upOrder = this.persons.map(p => p.pid).sort((a, b) => (onStreet.has(b) ? 1 : 0) - (onStreet.has(a) ? 1 : 0) || a - b);
      this._upK = this._upK || 0;
    }
    while (this._upK < this._upOrder.length) {
      if (now() - t0 > budgetMs) return false;
      const p = this.persons[this._upOrder[this._upK++]];
      if (!p || p.ext) continue;
      p.ext = true;
      let act;
      try { act = normalizeActivity(this.planner(p.id, this.t), this.t); } catch { act = null; }
      const a = p.agent;
      if (a) {
        const same = act && isTravel(act) && a.act && Math.abs((a.act.start || 0) - act.start) < 6 * MIN;
        if (same) { a.act = act; continue; }
        const i = this.agents.indexOf(a);
        if (i >= 0) { this._finish(a, i); p.agent = null; }
      }
      this._evaluate(p, this.t, true);
    }
    return true;
  }

  /** Ask the plan about a person at t: spawn them if a visible leg is under way, else schedule the next look. */
  _evaluate(p, t, jumping) {
    let act = this._plan(p, t);
    if (!act) { this._schedule(p, t + 60 * MIN); return; }
    act = normalizeActivity(act, t);
    if (!isTravel(act)) {
      // a stay: outdoors in a park in view means visible; otherwise inside somewhere
      this._setAway(p, act);
      const parkStay = (act.place && (act.place.kind === 'park' || act.place.kind === 'outdoors')) && this._inView(act.place);
      if (parkStay) this._spawnStay(p, act, t);
      this._schedule(p, Math.max(t + 1000, act.end));
      return;
    }
    const trip = this._planTrip(p, act, t);
    if (!trip) { this._setAway(p, act); this._schedule(p, Math.max(t + 1000, act.end)); return; }
    // on the road somewhere else before the visible leg: the car is with them
    if (t < trip.t0 - 500) { if (!trip.oIn) this._setAway(p, act); this._schedule(p, trip.t0); return; }
    const a = this._spawnTrip(p, act, trip, t, jumping);
    if (!a) this._schedule(p, Math.max(t + 1000, act.end));
  }

  /**
   * Keep the household car's parking spot in step with the plan: the car is home while its driver is home, or
   * out on foot, bike or transit, or at a place they did not drive to; it is gone while they drive or stay
   * somewhere they drove to.
   */
  _setAway(p, act) {
    if (p.role !== 'resident' || p.spot < 0) return;
    const travel = isTravel(act);
    const carTrip = travel && act.mode && CAR_MODES.has(act.mode);
    const stayHome = !travel && act.place && act.place.kind === 'home';
    const drove = !travel && !stayHome && CAR_MODES.has(p.member.mode);
    const away = carTrip || drove;
    if (away) this.spotCar[p.spot] = -1;
    else {
      // home by the plan: a car still drawn in a stall elsewhere in view (a trip back the plan did not drive) is home too
      if (p.awaySpot >= 0) { if (this.spotCar[p.awaySpot] === p.awayLook) this.spotCar[p.awaySpot] = -1; p.awaySpot = -1; p.awayB = -1; }
      if (this.spotCar[p.spot] === -1) this.spotCar[p.spot] = this._carLookId(p);
    }
  }

  _carLookId(p) { const hh = this.scene.households[p.hh]; return hh ? hash3(this.seed, hh.zi, hh.h * 8 + Math.max(0, p.veh)) : hash2(this.seed, idHash(p.id)); }

  _inView(pl) {
    if (!pl || !Number.isFinite(pl.x)) return false;
    const q = this.frame.toLocal(pl.x, pl.y);
    return Math.abs(q.x) < this.R * 0.98 && Math.abs(q.y) < this.R * 0.98;
  }

  /** Previous place of a person (origin of a trip) when the activity does not carry one. */
  _origin(p, act) {
    const o = originOf(act);
    if (o) return o;
    if (this.external && (p.ext || !this.hybrid)) {
      const prev = normalizeActivity(this.planner(p.id, act.start - 60000), act.start - 60000);
      if (prev && prev.place) return prev.place;
    }
    return null;
  }

  /** The building a place in view refers to, for a person: home, workplace, or the nearest fitting building. */
  _buildingFor(p, place, purpose) {
    const sc = this.scene;
    if (!place) return null;
    if (place.kind === 'home' && p.role === 'resident') return sc.buildings[p.b];
    if (p.role === 'commuter' && (place.kind === 'work' || place.kind === 'school' || purpose === 'work')) return sc.buildings[p.workB];
    const q = this.frame.toLocal(place.x, place.y);
    let pool;
    if (place.kind === 'school' || purpose === 'school') pool = sc.buildings.filter(b => b.kind === 'school');
    else if (place.kind === 'home') pool = sc.buildings.filter(b => b.kind === 'house' || b.kind === 'apartment' || b.kind === 'small-apartment' || b.kind === 'mobile-home');
    else pool = this.shops.length ? this.shops : sc.buildings.filter(b => b.kind !== 'house');
    if (!pool.length) pool = sc.buildings;
    let best = null, bd = Infinity;
    for (const b of pool) { if (!b.access) continue; const d = Math.hypot(b.cx - q.x, b.cy - q.y); if (d < bd) { bd = d; best = b; } }
    return best;
  }

  /** Agent kind for a travel mode. */
  _kindFor(mode, p) {
    if (CAR_MODES.has(mode)) return 'car';
    if (mode === 'bike') return 'bike';
    if (mode === 'bus') return 'walk';
    return 'walk';
  }

  /**
   * Route one trip on the view's graph and time its visible leg.
   * @returns {object|null} {kind, path, t0, dur, from: building|null, to: building|null, exit, entry, ...}
   */
  _planTrip(p, act, t) {
    const sc = this.scene, router = this.router;
    const purpose = act.purpose || act.place.kind;
    const mode = act.mode || p.member.mode || 'walk';
    let kind = this._kindFor(mode, p);
    const origin = this._origin(p, act);
    const dest = act.place;
    const oIn = origin ? this._inView(origin) : false, dIn = this._inView(dest);
    if (act.loop) return this._loopTrip(p, act, t);
    if (!oIn && !dIn) return null;
    const fromB = oIn ? this._buildingFor(p, origin, purpose === 'home' ? 'work' : 'home') : null;
    const toB = dIn ? this._buildingFor(p, dest, purpose) : null;
    if ((oIn && !fromB) || (dIn && !toB)) return null;
    if (fromB && toB && fromB.id === toB.id) return null;
    const rmode = kind === 'car' ? 'car' : kind === 'bike' ? 'bike' : 'foot';
    const accessOf = b => b.access && this.net.edges[b.access.e] && ((rmode === 'car' && this.net.edges[b.access.e].car) || rmode !== 'car') ? { e: b.access.e, s: b.access.s } : null;
    let path = null, exit = -1, entry = -1, busStop = -1;
    const vNom = kind === 'car' ? 9 : kind === 'bike' ? 4.5 : WALK_SPEED;
    if (mode === 'bus' && kind === 'walk' && this.stops.length && oIn && !dIn) {
      // walk to the nearest stop and wait for the bus
      const acc = accessOf(fromB); if (!acc) return null;
      let best = null, bc = Infinity;
      for (const s of this.stops) { const d = Math.hypot(s.x - fromB.cx, s.y - fromB.cy); if (d < bc) { bc = d; best = s; } }
      if (best && bc < 900) {
        path = router.path('foot', acc, { e: best.e, s: this._stopS(best) });
        busStop = best.id;
      }
    }
    if (!path) {
      if (oIn && dIn) {
        const a = accessOf(fromB), b = accessOf(toB);
        if (!a || !b) return null;
        path = router.path(rmode, a, b);
      } else if (oIn) {
        const a = accessOf(fromB); if (!a) return null;
        exit = this._bestExit(rmode, a, this.frame.toLocal(dest.x, dest.y), vNom);
        if (exit < 0) return null;
        path = router.pathTo(rmode, a, exit);
      } else {
        const b = accessOf(toB); if (!b) return null;
        if (mode === 'bus' && kind === 'walk' && this.stops.length) {
          // off the bus at the stop nearest home
          let best = null, bc = Infinity;
          for (const st of this.stops) { const d = Math.hypot(st.x - toB.cx, st.y - toB.cy); if (d < bc) { bc = d; best = st; } }
          if (best && bc < 900) path = router.path('foot', { e: best.e, s: this._stopS(best) }, b);
        }
        if (!path) {
          entry = this._bestEntry(rmode, b, this.frame.toLocal(origin ? origin.x : dest.x, origin ? origin.y : dest.y), vNom);
          if (entry < 0) return null;
          path = router.path(rmode, { node: entry }, b);
        }
      }
    }
    if (!path || !path.steps.length) return null;
    const exitDur = kind === 'car' ? 7 : 4, enterDur = kind === 'car' ? 7 : 4;
    const dur = (oIn ? exitDur : 0) + path.length / vNom + (dIn ? enterDur : 0);
    // plans are kept to the minute; people leaving one building in the same minute go out a few seconds apart
    const sec = u01(hash2(this.seed ^ 0x5ec, idHash(p.id))) * 50000;
    let t0;
    if (oIn) t0 = act.start + sec;
    else t0 = Math.max(act.start, act.end - dur * 1000 - sec);
    return { kind, mode, path, t0, dur, vNom, fromB, toB, exit, entry, busStop, purpose, oIn, dIn, exitDur, enterDur };
  }

  _stopS(stop) {
    const E = this.net.edges[stop.e];
    let best = 0, bd = Infinity;
    for (let s = 0; s <= E.len; s += 2) { const q = pointAt(E.pts, E.cum, s, {}); const d = Math.hypot(q.x - stop.x, q.y - stop.y); if (d < bd) { bd = d; best = s; } }
    return best;
  }

  /**
   * An exercise loop from home: out along a meandering route and back by the shortest way. Null (the person
   * stays in) when the street gives no walk worth the name, e.g. a home at the end of a private lane whose only
   * way out is the lane itself.
   */
  _loopTrip(p, act, t) {
    const b = this.scene.buildings[p.b];
    if (!b || !b.access) return null;
    const net = this.net;
    const E0 = net.edges[b.access.e];
    if (!E0 || !E0.foot) return null;
    const durS = (act.end - act.start) / 1000;
    const half = clamp(durS * WALK_SPEED * 0.45, 150, 1400);
    // set off toward an end of the home's street that leads somewhere (not a dead end, not out of the view)
    const goes = n => net.nodes[n].adj.length > 1 && !net.nodes[n].exit;
    const ends = [E0.a, E0.b].filter(goes);
    if (!ends.length) return null;
    let node = ends.length === 1 ? ends[0] : hf2(this.seed, idHash(p.id), act.start) < 0.5 ? ends[0] : ends[1];
    let acc = 0, prevE = E0.id, guard = 0;
    const h0 = hash3(this.seed, idHash(p.id), Math.floor(act.start / MIN));
    while (acc < half && guard++ < 40) {
      const opts = net.nodes[node].adj.filter(a => a.e !== prevE && net.edges[a.e].foot && !net.nodes[net.other(a.e, node)].exit);
      if (!opts.length) break;
      const a = opts[hash2(h0, guard) % opts.length];
      acc += net.edges[a.e].len; prevE = a.e; node = net.other(a.e, node);
    }
    const out = this.router.path('foot', { e: b.access.e, s: b.access.s }, { node });
    const back = this.router.path('foot', { node }, { e: b.access.e, s: b.access.s });
    if (!out || !back || !out.steps.length || !back.steps.length) return null;
    const path = { steps: out.steps.concat(back.steps), length: out.length + back.length, cost: out.cost + back.cost };
    if (path.length < MIN_LOOP) return null;
    const vNom = clamp(path.length / Math.max(60, durS - 10), 0.7, 1.7);
    return { kind: 'walk', mode: 'walk', path, t0: act.start, dur: path.length / vNom + 8, vNom, fromB: b, toB: b, exit: -1, entry: -1, busStop: -1, purpose: 'walk', oIn: true, dIn: true, exitDur: 4, enterDur: 4, loop: true, dog: !!act.dog };
  }

  /** The exit that best leads toward an outside point: network cost to it plus the straight run beyond. */
  _bestExit(rmode, access, target, vNom) {
    const exits = rmode === 'car' ? this.carExits : this.walkExits;
    if (!exits.length) return -1;
    const net = this.net, ang = Math.atan2(target.y, target.x);
    const cand = exits.map(id => { const n = net.nodes[id]; let dA = Math.abs(Math.atan2(n.y, n.x) - ang); if (dA > Math.PI) dA = 2 * Math.PI - dA; return [dA, id]; }).sort((a, b) => a[0] - b[0]).slice(0, 6);
    let best = -1, bc = Infinity;
    for (const [, id] of cand) {
      const n = net.nodes[id];
      const c = this.router.costTo(rmode, access, id) + Math.hypot(target.x - n.x, target.y - n.y) / (vNom * 1.4);
      if (c < bc) { bc = c; best = id; }
    }
    return best;
  }

  _bestEntry(rmode, access, origin, vNom) {
    const exits = rmode === 'car' ? this.carExits.filter(id => { const n = this.net.nodes[id]; const E = this.net.edges[n.adj[0].e]; return lanesIn(E, n.adj[0].end === 0 ? 1 : -1) > 0 || E.shared; }) : this.walkExits;
    if (!exits.length) return -1;
    const net = this.net, ang = Math.atan2(origin.y, origin.x);
    const cand = exits.map(id => { const n = net.nodes[id]; let dA = Math.abs(Math.atan2(n.y, n.x) - ang); if (dA > Math.PI) dA = 2 * Math.PI - dA; return [dA, id]; }).sort((a, b) => a[0] - b[0]).slice(0, 6);
    let best = -1, bc = Infinity;
    for (const [, id] of cand) {
      const n = net.nodes[id];
      // for walkers the graph is symmetric; for cars the reverse tree cost is a close guide to pick the entry
      const c = this.router.costTo(rmode === 'car' ? 'car' : rmode, access, id) + Math.hypot(origin.x - n.x, origin.y - n.y) / (vNom * 1.4);
      if (c < bc) { bc = c; best = id; }
    }
    return best;
  }

  // ------------------------------------------------ agents

  _newAgent(props) {
    const a = Object.assign({
      uid: this.uid++, kind: 'walk', role: 'resident', id: '', person: -1, act: null, trip: null, path: null, k: 0, d: 0, v: 0, vmax: 1.4, lane: 0,
      phase: 'route', pu: 0, pdur: 1, from: null, to: null, len: 0.5, wid: 0.5, look: null, brake: false, blink: 0, stopT: -1, inBox: -1,
      age: 30, x: 0, y: 0, hx: 1, hy: 0, walked: 0, bubble: null, wait: 0, t0: this.t, toSpot: -1, arrived: false,
    }, props);
    this.agents.push(a);
    this.byUid.set(a.uid, a);
    this.activeIds.set(a.id, (this.activeIds.get(a.id) || 0) + 1);
    this.stats0.spawned++;
    return a;
  }

  /** Put a person's trip on the street. */
  _spawnTrip(p, act, trip, t, jumping) {
    const age = p.member.age;
    const kind = trip.kind;
    const a = this._newAgent({ kind, role: p.role, id: p.id, person: p.pid, act, trip, path: trip.path, age, vmax: kind === 'walk' ? walkSpeed(age, p.id) : kind === 'bike' ? 4.6 + u01(idHash(p.id)) * 1.2 : 13, look: personLook(p.id, age), dog: trip.dog });
    p.agent = a;
    if (kind === 'car') {
      const lookH = p.role === 'resident' && p.veh >= 0 ? this._carLookId(p) : hash2(this.seed, idHash(p.id));
      const v = trip.mode === 'motorcycle' ? { len: 2.2, wid: 0.8, body: 'motorcycle', color: CAR_COLORS[lookH % CAR_COLORS.length] } : vehicleLook(lookH, this.rural);
      Object.assign(a, { len: v.len, wid: v.wid, body: v.body, color: v.color, lookH });
      a.lane = 0;
      if (trip.dIn && !trip.oIn && p.role === 'resident' && p.spot >= 0 && trip.toB && trip.toB.id === p.b) this.spotCar[p.spot] = -1;
    } else if (kind === 'bike') { a.len = 1.8; a.wid = 0.6; }
    // the exit phase: from the door or the parking spot out to the street
    a.sides = new Int8Array(trip.path.steps.length);
    this._beginExit(a, p, trip);
    a.busStop = trip.busStop;
    const elapsed = (t - trip.t0) / 1000;
    if (elapsed > 0.5) {
      if (!this._placeOnSchedule(a, t)) { this._finish(a, this.agents.length - 1); return null; }
    }
    return a;
  }

  _beginExit(a, p, trip) {
    a.k = 0; a.d = 0;
    if (!trip.oIn) { a.phase = 'route'; return; }
    const b = trip.fromB;
    const entryPose = this._routePose(a, 0, 0);
    if (a.kind === 'car') {
      let sx = b.access.curbX, sy = b.access.curbY, ang = Math.atan2(entryPose.y - sy, entryPose.x - sx);
      // the car leaves from where it stands: its space at home, or the stall it was parked in on arriving here
      const spotId = p.role === 'resident' && p.spot >= 0 && b.id === p.b ? p.spot : p.awaySpot >= 0 && p.awayB === b.id ? p.awaySpot : -1;
      const sp = spotId >= 0 ? this.scene.spots[spotId] : null;
      if (sp) {
        sx = sp.x; sy = sp.y; ang = sp.ang; this.spotCar[sp.id] = -1; a.fromSpot = sp.id;
        if (sp.id === p.awaySpot) { p.awaySpot = -1; p.awayB = -1; }
      } else if (b.access.driveX !== undefined) { sx = b.access.driveX; sy = b.access.driveY; ang = b.access.driveAng; }
      a.from = { x: sx, y: sy, hx: Math.cos(ang), hy: Math.sin(ang) };
      a.phase = 'exit'; a.pu = 0; a.pdur = trip.exitDur; a.reverse = sp ? sp.kind === 'driveway' : b.access.driveX !== undefined;
    } else {
      a.from = { x: b.access.doorX, y: b.access.doorY, hx: 0, hy: 0 };
      a.phase = 'exit'; a.pu = 0; a.pdur = trip.exitDur;
    }
  }

  /** Initial or jumped placement: put an agent where its schedule says it is at time t. Returns false when done. */
  _placeOnSchedule(a, t) {
    const tr = a.trip; if (!tr) return true;
    let el = (t - tr.t0) / 1000;
    this._leaveQueue(a);
    this._releaseBox(a);
    a.stopT = -1; a.passed = false;
    if (a.busStop >= 0 && !tr.dIn) {
      // a bus rider: still walking to the stop, waiting there, or gone on the first bus that came after they got there
      const now = t / 1000, atStop = tr.t0 / 1000 + (tr.oIn ? tr.exitDur : 0) + tr.path.length / tr.vNom;
      if (now >= atStop) {
        if (now - atStop > MAX_WAIT || this._nextBusAt(a.busStop, atStop) <= now) return false;
        this._toEnd(a);
        if (!a.busWait && !this._arriveAtStop(a)) return false;
        a.wait = now - atStop;
        return true;
      }
    }
    if (tr.oIn) {
      if (el < tr.exitDur) { a.phase = 'exit'; a.pu = clamp(el / tr.exitDur, 0, 1); return true; }
      el -= tr.exitDur;
    }
    const dist = el * tr.vNom;
    if (dist >= tr.path.length) {
      if (tr.dIn) {
        const rest = el - tr.path.length / tr.vNom;
        if (rest < tr.enterDur && !tr.loop) { this._toEnd(a); a.phase = 'enter'; this._beginEnter(a); a.pu = clamp(rest / tr.enterDur, 0, 1); return true; }
        a.arrived = true;
      }
      return false;
    }
    // walk the steps to the distance
    let rem = dist, k = 0;
    while (k < tr.path.steps.length - 1 && rem > stepLen(tr.path.steps[k])) { rem -= stepLen(tr.path.steps[k]); k++; }
    a.k = k; a.d = Math.min(rem, stepLen(tr.path.steps[k]));
    a.phase = 'route';
    a.v = a.kind === 'car' ? Math.min(a.vmax, this.net.edges[tr.path.steps[k].e].speed * 0.8) : a.vmax;
    if (a.kind === 'car' || a.kind === 'bus') this._joinQueue(a);
    return true;
  }

  _toEnd(a) { const steps = a.path.steps; a.k = steps.length - 1; a.d = stepLen(steps[a.k]); }

  /** A person staying in a park in view: wandering its paths until the stay ends. */
  _spawnStay(p, act, t) {
    const q = this.frame.toLocal(act.place.x, act.place.y);
    let park = null, bd = Infinity;
    for (const ar of this.parks) { const c = ar.frame.c; const d = Math.hypot(c.x - q.x, c.y - q.y); if (d < bd) { bd = d; park = ar; } }
    if (!park || bd > 300) return null;
    const a = this._newAgent({ kind: 'walk', role: p.role, id: p.id, person: p.pid, act, phase: 'wander', park: park.id, vmax: walkSpeed(p.member.age, p.id) * 0.7, look: personLook(p.id, p.member.age), age: p.member.age, until: act.end });
    const F = park.frame;
    a.x = F.c.x; a.y = F.c.y; a.tx = a.x; a.ty = a.y;
    p.agent = a;
    return a;
  }

  _beginEnter(a) {
    const tr = a.trip, b = tr.toB;
    if (!b) return;
    if (a.kind === 'car') {
      let sx = b.access.curbX, sy = b.access.curbY, ang = 0;
      const p = this.persons[a.person];
      let sp = null;
      if (a.toSpot >= 0 && this.spotCar[a.toSpot] === -2) sp = this.scene.spots[a.toSpot];       // reserved already (placed again after a jump)
      else if (p && p.role === 'resident' && p.spot >= 0 && b.id === p.b) sp = this.scene.spots[p.spot];
      if (!sp) sp = this._freeSpotNear(b);
      if (sp) { sx = sp.x; sy = sp.y; ang = sp.ang; a.toSpot = sp.id; this.spotCar[sp.id] = -2; }
      else if (b.access.driveX !== undefined) { sx = b.access.driveX; sy = b.access.driveY; ang = b.access.driveAng + Math.PI; }
      a.to = { x: sx, y: sy, hx: Math.cos(ang), hy: Math.sin(ang) };
    } else a.to = { x: b.access.doorX, y: b.access.doorY, hx: 0, hy: 0 };
  }

  _freeSpotNear(b) {
    let best = null, bd = 90;
    const sp = this.scene.spots;
    if (!this._spotGrid) this._spotGrid = buildSpotGrid(sp);
    const near = this._spotGrid.near(b.cx, b.cy, 90);
    for (const s of near) {
      if (this.spotCar[s.id] !== -1 || (s.owner >= 0 && s.kind !== 'lot')) continue;
      if (s.b >= 0 && s.b !== b.id && s.kind !== 'curb') continue;
      const d = Math.hypot(s.x - b.cx, s.y - b.cy);
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }

  // ------------------------------------------------ queues (car following)

  _qkey(a) { const st = a.path.steps[a.k]; return st.e * 32 + (st.dir > 0 ? 0 : 16) + Math.min(a.lane, 7); }
  _along(a) { const st = a.path.steps[a.k]; const E = this.net.edges[st.e]; const s = st.from + st.dir * a.d; return st.dir > 0 ? s : E.len - s; }

  _joinQueue(a) {
    const key = this._qkey(a);
    let q = this.queues.get(key); if (!q) this.queues.set(key, q = []);
    a.q = key;
    if (this._bulk) { q.push(a); return; }            // ordered once, by _rebuildQueues
    const al = this._along(a);
    let i = q.length;
    while (i > 0 && this._along(q[i - 1]) < al) i--;
    q.splice(i, 0, a);
  }

  _leaveQueue(a) {
    if (a.q === undefined || a.q === null) return;
    const q = this.queues.get(a.q);
    if (q) { const i = q.indexOf(a); if (i >= 0) q.splice(i, 1); }
    a.q = null;
  }

  /** Order every queue front to back in one sort each (after a reset or a jump placed cars unordered). */
  _rebuildQueues() {
    for (const q of this.queues.values()) {
      if (q.length < 2) continue;
      for (const a of q) a.al = this._along(a);
      q.sort((x, y) => y.al - x.al);
    }
  }

  _sortQueues() {
    for (const q of this.queues.values()) {
      for (let i = 1; i < q.length; i++) {
        const x = q[i], ax = this._along(x);
        let j = i - 1;
        while (j >= 0 && this._along(q[j]) < ax) { q[j + 1] = q[j]; j--; }
        q[j + 1] = x;
      }
    }
  }

  /**
   * Enforce minimum gaps after a jump (cars slid to schedule positions may overlap): followers move back behind
   * their leader; one that cannot fit on its step is taken off the road (it reached its trip end in the jump).
   */
  _settleQueues() {
    this._sortQueues();
    const drop = [];
    for (const q of this.queues.values()) {
      let lead = q[0];
      for (let i = 1; i < q.length; i++) {
        const f = q[i];
        const room = this._along(lead) - lead.len - MIN_GAP - this._along(f);
        if (room < 0) {
          if (f.d + room >= 0) { f.d += room; f.v = Math.min(f.v, lead.v); }
          else { drop.push(f); continue; }          // dropped cars are no one's leader
        }
        lead = f;
      }
    }
    for (const a of drop) { const i = this.agents.indexOf(a); if (i >= 0) this._finish(a, i); }
  }

  /** Gap and speed of whatever is ahead of a car: its queue leader or the last car on its next step. */
  _leader(a) {
    const q = this.queues.get(a.q);
    const st = a.path.steps[a.k];
    const L = stepLen(st);
    if (q) {
      const i = q.indexOf(a);
      if (i > 0) { const l = q[i - 1]; return { gap: this._along(l) - l.len - this._along(a), v: l.v }; }
    }
    // look into the next step
    const nx = a.path.steps[a.k + 1];
    if (nx) {
      const E = this.net.edges[nx.e];
      const lane = Math.min(a.lane, Math.max(0, lanesIn(E, nx.dir) - 1));
      const q2 = this.queues.get(nx.e * 32 + (nx.dir > 0 ? 0 : 16) + lane);
      if (q2 && q2.length) {
        const l = q2[q2.length - 1];
        const alongL = this._along(l);
        const startAlong = nx.dir > 0 ? nx.from : E.len - nx.from;
        return { gap: (L - a.d) + (alongL - startAlong) - l.len, v: l.v };
      }
    }
    return { gap: 1e9, v: 0 };
  }

  // ------------------------------------------------ intersections

  /** Clearance from a node to where an approach stops (the crosswalk line). */
  _clear(node, eId) {
    const n = this.net.nodes[node];
    let w = 0;
    for (const ad of n.adj) if (ad.e !== eId) w = Math.max(w, this.net.edges[ad.e].half);
    return clamp(w + 0.8, 2, 16);
  }

  /** May an agent at the end of step k proceed into the next one now? Sets stop bookkeeping. */
  _mayProceed(a, st, distToLine) {
    const E = this.net.edges[st.e];
    const end = st.dir > 0 ? 1 : 0;
    const node = st.dir > 0 ? E.b : E.a;
    const ctrl = E.ctrl[end];
    const n = this.net.nodes[node];
    if (ctrl === 'signal' && n.signal) {
      const s = signalState(n.signal, E.grp[end], this.t);
      if (s === 'green') return true;
      if (s === 'yellow') return a.v * a.v / (2 * 3.0) > distToLine - 0.5;
      return false;
    }
    if (ctrl === 'stop') {
      if (a.kind === 'walk') return true;
      if (a.stopT < 0) {
        if (a.v < 0.35 && distToLine < 3) { a.stopT = this.t; this.waiting[node].push(a.uid); }
        return false;
      }
      if (this.t - a.stopT < (a.kind === 'bike' ? 400 : 900)) return false;
      if (a.passed) return true;
      if (this.inside[node] > 0) return false;
      // first come, first served among those who can go: an earlier arrival whose way ahead is blocked lets the
      // next one take its turn (otherwise one car waiting for room on a full street would hold the corner)
      const w = this.waiting[node];
      for (let i = 0; i < w.length;) {
        const uid = w[i];
        if (uid === a.uid) break;
        if (!this._waitingAt(uid, node)) { w.splice(i, 1); continue; }     // stale: no longer at this line
        if (this._wouldGo(this.byUid.get(uid))) return false;
        i++;
      }
      if (n.ctrl === 'twoway' && !this._majorClear(node, a)) return false;
      return true;
    }
    return true;
  }

  /** Whether a vehicle waiting at a stop line could pull out if it had the turn (its next street has room). */
  _wouldGo(o) {
    if (!o || o.kind === 'bike') return true;
    const nx = o.path.steps[o.k + 1];
    return !nx || this._entryOpen(o, nx);
  }

  /** True while agent uid is stopped at the line of node `node`. */
  _waitingAt(uid, node) {
    const x = this.byUid.get(uid);
    if (!x || x.stopT < 0 || x.phase !== 'route' || !x.path) return false;
    const st = x.path.steps[x.k], E = this.net.edges[st.e];
    return (st.dir > 0 ? E.b : E.a) === node;
  }

  /**
   * At a two-way stop: no car coming through on a free approach within 4.5 s of the node. A car standing at
   * the corner (queued behind traffic, or waiting for room to turn into the side street) is not coming through;
   * counting it would let a turn that waits on the side street and the side street that waits on the turn hold
   * each other forever.
   */
  _majorClear(node, a = null) {
    const n = this.net.nodes[node];
    // a right turn merges with the traffic headed into the same lanes; a left turn or a crossing meets all of it
    const nx = a && a.path ? a.path.steps[a.k + 1] : null;
    const rightTurn = !!nx && a.turnK === a.k && a.turnS === 1;
    for (const ad of n.adj) {
      const E = this.net.edges[ad.e];
      const end = ad.end;
      if (E.ctrl[end] !== 'free') continue;
      const dir = end === 1 ? 1 : -1;     // arriving at node along E
      for (let lane = 0; lane < 4; lane++) {
        const q = this.queues.get(E.id * 32 + (dir > 0 ? 0 : 16) + lane);
        if (!q || !q.length) continue;
        for (const f of q) {
          if (f.v < STANDING) break;                                  // the lane is held up at the corner
          const fs = f.path.steps;
          if (f.k >= fs.length - 1) continue;                         // parking on this block, short of the corner
          if (rightTurn) { const fn = fs[f.k + 1]; if (fn.e !== nx.e || fn.dir !== nx.dir) continue; }
          const dist = E.len - this._along(f);
          if (dist / Math.max(f.v, 2) < 4.5) return false;
          break;
        }
      }
    }
    return true;
  }

  // ------------------------------------------------ moving

  /** Advance one agent by dt; returns true when it is done (arrived inside, left the view, boarded). */
  _move(a, dt) {
    if (a.phase === 'wander') return this._wander(a, dt);
    if (a.phase === 'wait') return this._waitAtStop(a, dt);
    if (a.phase === 'exit') {
      if (a.kind === 'car' && a.pu >= 0.9) {
        // merge only into a gap
        if (!this._gapToMerge(a)) { a.v = 0; return false; }
      }
      a.pu += dt / a.pdur;
      if (a.pu >= 1) {
        a.phase = 'route'; a.pu = 0;
        a.v = a.kind === 'walk' ? a.vmax : 1.5;
        if (a.kind === 'car' || a.kind === 'bus') this._joinQueue(a);
      }
      return false;
    }
    if (a.phase === 'enter') {
      a.pu += dt / a.pdur;
      if (a.pu >= 1) { a.arrived = true; return true; }
      return false;
    }
    if (a.kind === 'walk') return this._moveWalker(a, dt);
    return this._moveVehicle(a, dt);
  }

  _gapToMerge(a) {
    const st = a.path.steps[0];
    const E = this.net.edges[st.e];
    const q = this.queues.get(st.e * 32 + (st.dir > 0 ? 0 : 16) + Math.min(a.lane, 7));
    if (!q) return true;
    const al = st.dir > 0 ? st.from : E.len - st.from;
    for (const o of q) { const d = this._along(o) - al; if (d > -14 && d < 9) return false; }
    return true;
  }

  _moveVehicle(a, dt) {
    const steps = a.path.steps;
    let st = steps[a.k];
    let L = stepLen(st);
    const E = this.net.edges[st.e];
    const P = a.kind === 'bus' ? IDM.bus : a.kind === 'bike' ? IDM.bike : IDM.car;
    let v0 = Math.min(a.vmax, E.speed * (a.kind === 'bike' ? 0.4 : 1) + (a.kind === 'car' ? (hf01(a.uid) - 0.5) * 2 : 0));
    const last = a.k === steps.length - 1;
    const distEnd = L - a.d;
    // slow for the turn ahead and for the end of the trip
    if (!last && a.turnK !== a.k) { a.turnK = a.k; a.turnV = this._turnSpeed(st, steps[a.k + 1]); a.turnS = this._turnSide(st, steps[a.k + 1]); }
    if (!last) {
      const turn = a.turnV;
      if (distEnd < 24) v0 = Math.min(v0, turn + (distEnd / 24) * Math.max(0, v0 - turn));
    } else if (a.trip && a.trip.dIn) v0 = Math.min(v0, 2.5 + distEnd * 0.25);
    let gap = 1e9, vl = 0;
    if (a.kind !== 'bike') { const l = this._leader(a); gap = l.gap; vl = l.v; }
    // pass a stopped or crawling leader (a bus at its stop, a car waiting to turn) in another lane
    if (a.kind === 'car' && lanesIn(E, st.dir) > 1 && gap < 14 && vl < 1.2 && a.v < 4) {
      a.blocked = (a.blocked || 0) + dt;
      if (a.blocked > 1.6 && this._changeLane(a, st, E)) { a.blocked = 0; const l = this._leader(a); gap = l.gap; vl = l.v; }
    } else a.blocked = 0;
    if (a.laneShift) { a.laneShift *= Math.exp(-dt / 0.7); if (Math.abs(a.laneShift) < 0.05) a.laneShift = 0; }
    // the stop line
    let mustStop = false, lineD = Infinity;
    if (!last) {
      const node = st.dir > 0 ? E.b : E.a;
      const clr = Math.min(this._clear(node, st.e), L - 0.5);
      lineD = L - clr - a.d;
      if (lineD > -0.5 && lineD < 70) {
        if (!this._mayProceed(a, st, lineD)) mustStop = true;
        else if (a.kind !== 'bike' && !this._entryOpen(a, steps[a.k + 1])) mustStop = true;
      }
    }
    // a bus stopping at its stop
    if (a.kind === 'bus' && a.nextStop !== undefined && a.nextStop !== null && (a.nextStopK < a.k || (a.nextStopK === a.k && a.stopD < a.d - 1))) this._nextBusStop(a);
    if (a.kind === 'bus' && a.nextStop !== undefined && a.nextStop !== null) {
      const sd = a.stopD - a.d;
      if (a.nextStopK === a.k && sd > -1 && sd < 60) {
        if (sd < 1.5 && a.v < 0.6) {
          // at the stop: open the doors (riders board on the first moment), wait out the dwell, then pull away
          if (!a.dwell) this._busAtStop(a);
          a.dwell = (a.dwell || 0) + dt;
          if (a.dwell < a.dwellNeed) { a.v = 0; a.brake = true; return false; }
          a.dwell = 0; this._nextBusStop(a);
        } else if (sd > 0) { gap = Math.min(gap, sd + P.s0); vl = 0; }        // brake to stand right at the stop
      }
    }
    if (mustStop && lineD > -0.5) { gap = Math.min(gap, Math.max(0.01, lineD + P.s0 - 0.3)); vl = 0; }
    // intelligent driver model
    const v = a.v;
    const sStar = P.s0 + Math.max(0, v * P.T + v * (v - vl) / (2 * Math.sqrt(P.a * P.b)));
    let acc = P.a * (1 - Math.pow(v / Math.max(0.1, v0), 4) - (gap < 1e8 ? (sStar / Math.max(0.1, gap)) ** 2 : 0));
    acc = Math.max(acc, -9);
    let nv = Math.max(0, v + acc * dt);
    let move = (v + nv) / 2 * dt;
    // hard constraint: never close the gap below the minimum
    if (gap < 1e8) {
      const room = gap - (mustStop && gap === Math.max(0.01, lineD + P.s0 - 0.3) ? P.s0 - 0.3 : MIN_GAP);
      if (move > room) { move = Math.max(0, room); nv = Math.min(nv, move / dt); }
    }
    a.brake = acc < -0.6 || (nv < 0.2 && mustStop);
    a.v = nv;
    a.d += move;
    a.blink = !last && distEnd < 40 ? a.turnS : 0;
    // the box: cars entering from a stop sign hold it until they are through (one at a time at all-way stops)
    if (!last && lineD < 0 && a.inBox < 0 && a.stopT >= 0) {
      const node = st.dir > 0 ? E.b : E.a;
      if (E.ctrl[st.dir > 0 ? 1 : 0] === 'stop') { a.inBox = node; this.inside[node]++; }
      const w = this.waiting[node]; const wi = w.indexOf(a.uid); if (wi >= 0) w.splice(wi, 1);
      a.passed = true;
    }
    // step transitions
    while (a.d >= L) {
      if (last) {
        if (a.trip && a.trip.dIn && !a.trip.loop) { this._leaveQueue(a); a.d = L; a.phase = 'enter'; a.pu = 0; a.pdur = a.trip.enterDur; this._beginEnter(a); this._releaseBox(a); return false; }
        this._releaseBox(a);
        return true;      // left the view
      }
      if (a.kind !== 'bike' && !this._entryOpen(a, steps[a.k + 1])) { a.d = L - 0.01; a.v = 0; break; }
      a.d -= L;
      this._leaveQueue(a);
      a.k++;
      st = steps[a.k]; L = stepLen(st);
      const E2 = this.net.edges[st.e];
      a.lane = a.kind === 'bus' ? Math.max(0, lanesIn(E2, st.dir) - 1) : Math.min(a.lane, Math.max(0, lanesIn(E2, st.dir) - 1));
      a.stopT = -1; a.passed = false;
      if (a.kind !== 'bike') this._joinQueue(a);
      return false;
    }
    // a vehicle that has not moved for minutes gives up (turns into an alley, a garage, a gas station)
    if (a.v < 0.05) { a.stillFor = (a.stillFor || 0) + dt; if (a.stillFor > 240 && a.kind !== 'bus') { this.stats0.gaveUp = (this.stats0.gaveUp || 0) + 1; return true; } } else a.stillFor = 0;
    if (a.inBox >= 0 && a.d > 6 && !this._boxStep(a)) this._releaseBox(a);
    return false;
  }

  _boxStep(a) { const st = a.path.steps[a.k]; const E = this.net.edges[st.e]; const node = st.dir > 0 ? E.b : E.a; return node === a.inBox && a.d > stepLen(st) - this._clear(node, st.e); }
  _releaseBox(a) { if (a.inBox >= 0) { this.inside[a.inBox] = Math.max(0, this.inside[a.inBox] - 1); a.inBox = -1; } }

  /** Move to an adjacent lane when the gaps there allow it; the drawn offset glides over (laneShift). */
  _changeLane(a, st, E) {
    const n = lanesIn(E, st.dir), al = this._along(a);
    for (const nl of [a.lane + 1, a.lane - 1]) {
      if (nl < 0 || nl >= n) continue;
      const q = this.queues.get(st.e * 32 + (st.dir > 0 ? 0 : 16) + Math.min(nl, 7));
      let ok = true;
      if (q) for (const o of q) {
        const d = this._along(o) - al;
        if ((d >= 0 && d - o.len < 12) || (d < 0 && -d - a.len < 7)) { ok = false; break; }
      }
      if (!ok) continue;
      const before = laneOffset(E, st.dir, a.lane);
      this._leaveQueue(a);
      a.lane = nl;
      this._joinQueue(a);
      a.laneShift = (a.laneShift || 0) + before - laneOffset(E, st.dir, nl);
      return true;
    }
    return false;
  }

  /** Room to enter the next step (the last car there must be clear of the entry). */
  _entryOpen(a, nx) {
    const E = this.net.edges[nx.e];
    const lane = Math.min(a.lane, Math.max(0, lanesIn(E, nx.dir) - 1));
    const q = this.queues.get(nx.e * 32 + (nx.dir > 0 ? 0 : 16) + lane);
    if (!q || !q.length) return true;
    const l = q[q.length - 1];
    const startAlong = nx.dir > 0 ? nx.from : E.len - nx.from;
    return this._along(l) - l.len - startAlong > a.len + MIN_GAP + 1;
  }

  _turnSpeed(st, nx) {
    const p = this._stepPoint(st, stepLen(st) - 0.01, {}), q = this._stepPoint(nx, 0.01, {});
    const c = p.tx * q.tx + p.ty * q.ty;
    return 3.5 + 9 * ((1 + c) / 2) ** 2;
  }

  _turnSide(st, nx) {
    const p = this._stepPoint(st, stepLen(st) - 0.01, {}), q = this._stepPoint(nx, 0.01, {});
    const cr = p.tx * q.ty - p.ty * q.tx;
    return Math.abs(cr) < 0.35 ? 0 : cr > 0 ? 1 : -1;
  }

  _moveWalker(a, dt) {
    const steps = a.path.steps;
    let st = steps[a.k], L = stepLen(st);
    let v = a.vmax;
    // wait at red lights on corners
    if (a.k < steps.length - 1) {
      const E = this.net.edges[st.e];
      const node = st.dir > 0 ? E.b : E.a;
      const clr = Math.min(this._clear(node, st.e), L);
      const lineD = L - clr - a.d;
      if (lineD > 0 && lineD < 1.2 && E.ctrl[st.dir > 0 ? 1 : 0] === 'signal' && !this._mayProceed(a, st, lineD)) v = 0;
    }
    a.v = v;
    a.d += v * dt;
    a.walked += v * dt;
    // one tick can cover several steps (corners a few centimeters apart, zero-length steps at a dead end), so
    // whether this is the last step is asked again after every transition
    while (a.d >= L) {
      if (a.k >= steps.length - 1) {
        a.d = L;
        if (a.busStop >= 0 && !a.trip.dIn) return this._arriveAtStop(a) ? false : true;
        if (a.trip && a.trip.dIn) { a.phase = 'enter'; a.pu = 0; a.pdur = a.trip.enterDur; this._beginEnter(a); return false; }
        return true;
      }
      a.d -= L;
      a.k++;
      st = steps[a.k]; L = stepLen(st);
    }
    return false;
  }

  /**
   * A walker's sidewalk on step k, as an edge side (+1 right of a→b, -1 left): on the first step the side of
   * the building they came out of, then whichever side is nearer where they stand, so they cross a street only
   * when the route needs it. Kept per agent because route steps are shared between agents.
   */
  _sideOf(a, k) {
    if (!a.sides) a.sides = new Int8Array(a.path.steps.length);
    if (a.sides[k]) return a.sides[k];
    const st = a.path.steps[k];
    let side;
    if (k === 0) side = a.trip && a.trip.fromB && a.trip.fromB.access && a.trip.fromB.access.e === st.e ? a.trip.fromB.access.side : (hf01(a.uid) < 0.5 ? 1 : -1);
    else {
      const prev = a.path.steps[k - 1];
      const here = this._routePoseRaw(a, k - 1, stepLen(prev));
      const E = this.net.edges[st.e], p = this._stepPoint(st, 0, {});
      const off = sidewalkOffset(E);
      // (p.tx, p.ty) is the travel direction; the edge's right side is to the right of travel when dir is +1
      const rx = p.x - p.ty * st.dir * off, ry = p.y + p.tx * st.dir * off, lx = p.x + p.ty * st.dir * off, ly = p.y - p.tx * st.dir * off;
      side = Math.hypot(rx - here.x, ry - here.y) <= Math.hypot(lx - here.x, ly - here.y) ? 1 : -1;
    }
    a.sides[k] = side;
    return side;
  }



  _arriveAtStop(a) {
    const s = this.stops[a.busStop];
    if (!s) return false;
    a.phase = 'wait'; a.busWait = true; a.wait = 0; a.v = 0;
    s.waiting.add(a.uid);
    return true;
  }

  _waitAtStop(a, dt) {
    a.wait += dt;
    const s = this.stops[a.busStop];
    if (a.boarded) { if (s) s.waiting.delete(a.uid); return true; }
    if (a.wait > MAX_WAIT) { if (s) s.waiting.delete(a.uid); return true; }
    return false;
  }

  _wander(a, dt) {
    if (this.t >= a.until) return true;
    const park = this.scene.areas[a.park];
    const F = park.frame;
    const d = Math.hypot(a.tx - a.x, a.ty - a.y);
    if (d < 0.5) {
      const h = hash3(this.seed, a.uid, Math.floor(this.t / 20000));
      const u = F.u0 + 6 + u01(h) * (F.u1 - F.u0 - 12), v = F.v0 + 6 + u01(hash2(h, 1)) * (F.v1 - F.v0 - 12);
      a.tx = F.c.x + F.ux * u + F.vx * v; a.ty = F.c.y + F.uy * u + F.vy * v;
      a.v = 0;
      return false;
    }
    const sp = a.vmax;
    a.v = sp;
    const m = Math.min(d, sp * dt);
    a.hx = (a.tx - a.x) / d; a.hy = (a.ty - a.y) / d;
    a.x += a.hx * m; a.y += a.hy * m;
    a.walked += m;
    return false;
  }

  _finish(a, i) {
    this._leaveQueue(a);
    this._releaseBox(a);
    if (a.kind === 'car' && a.arrived) this._parkArrived(a);
    else if (a.toSpot >= 0 && this.spotCar[a.toSpot] === -2) this.spotCar[a.toSpot] = -1;      // a reserved stall it never reached
    if (a.busStop >= 0) { const s = this.stops[a.busStop]; if (s) s.waiting.delete(a.uid); }
    const last = this.agents.length - 1;
    if (i !== last) this.agents[i] = this.agents[last];
    this.agents.pop();
    this.byUid.delete(a.uid);
    this._untrack(a);
    this.stats0.finished++;
    if (a.person >= 0) {
      const p = this.persons[a.person];
      if (p && p.agent === a) {
        p.agent = null;
        const end = a.act && a.act.end ? a.act.end : this.t;
        this._schedule(p, Math.max(this.t + 1000, end));
      }
    }
    if (a.visitorDwell && a.arrived) this._visitorReturn(a);
  }

  /** An agent's id leaves the street. */
  _untrack(a) { const n = this.activeIds.get(a.id); if (n > 1) this.activeIds.set(a.id, n - 1); else this.activeIds.delete(a.id); }

  /**
   * A car that reached a building in view is parked where it is drawn from then on: the stall it pulled into,
   * else (it arrived while the clock jumped) the household's own space at home or a free stall near the
   * building. A stall away from home is remembered, so the next trip from there starts from it.
   */
  _parkArrived(a) {
    const p = a.person >= 0 ? this.persons[a.person] : null;
    const b = a.trip && a.trip.toB;
    const home = !!p && p.role === 'resident' && p.spot >= 0 && !!b && b.id === p.b;
    let spot = a.toSpot >= 0 ? a.toSpot : home ? p.spot : -1;
    if (spot < 0 && b) { const s = this._freeSpotNear(b); if (s) spot = s.id; }
    if (spot < 0) return;
    const atHome = home && spot === p.spot;
    this.spotCar[spot] = atHome ? this._carLookId(p) : a.lookH !== undefined ? a.lookH : hash2(this.seed, a.uid);
    a.toSpot = spot;
    if (p) { p.awaySpot = atHome ? -1 : spot; p.awayB = atHome || !b ? -1 : b.id; p.awayLook = this.spotCar[spot]; }
  }

  // ------------------------------------------------ through traffic, visitors, buses

  /** Vehicles per second entering at an entry at time t (the hour's profile and the view's traffic scale). */
  _rate(en, t) {
    const pc = pacific(t);
    const wk = pc.dow === 0 || pc.dow === 6;
    return en.perHour * trafficProfile(pc.minuteOfDay, wk) * this.trafficScale / 3600;
  }

  /** Stepping: vehicles whose arrival has come enter at the view's edge, into a gap only. */
  _streams(t) {
    for (const en of this.entries) {
      const A = en.arr;
      if (A.cm === null) A.seek(t);
      for (let guard = 0; guard < 8 && A.hold <= t; guard++) {
        const tArr = A.peek();
        if (tArr > t) break;
        // a vehicle kept out by a full lane at the edge for long has gone another way
        if (t - tArr <= MAX_HOLD && this._spawnThrough(en, tArr, t, false, A.cursorKey()) === 'blocked') { A.hold = t + 1500; break; }
        A.ci++;
      }
    }
    this._footStreams(t);
  }

  /**
   * After a reset or a jump: the through traffic that would be on the road at t is put on it, from the arrivals
   * of the last `span` seconds (newest first, at most JUMP_SPAWNS per entry). Arrivals that have driven through by
   * now are passed over before anyone is looked up to drive them.
   */
  _streamsJump(t, span) {
    for (const en of this.entries) {
      let n = 0;
      en.arr.backfill(t - Math.min(span, en.freeway ? 120 : 260) * 1000, t, (tArr, key) => {
        if (this._spawnThrough(en, tArr, t, true, key) === 'spawned') n++;
        return n < JUMP_SPAWNS;
      });
      en.arr.seek(t);
    }
    this._footJump(t, Math.min(span, 600));
  }

  /**
   * One vehicle arriving at an entry at tArr, its driver, vehicle and route drawn from the arrival's key. While
   * stepping it enters at the view's edge, into a gap only ('blocked' otherwise); after a jump (`placed`) it is
   * put where it would be by now, or passed over ('skip') when it is through already. A shopper already in the
   * store has their car in a stall and comes back out later.
   * @returns {'spawned'|'blocked'|'skip'}
   */
  _spawnThrough(en, tArr, now, placed, key) {
    const net = this.net;
    const h = key;
    const minute = pacific(tArr).minuteOfDay;
    // a shopper headed for a store in view, or traffic passing through toward another exit
    let path = null, toB = null;
    if (!en.freeway && this.shops.length && u01(hash2(h, 1)) < 0.12 * trafficProfile(minute, false, SHOPPING)) {
      toB = this.shops[hash2(h, 2) % this.shops.length];
      path = this._route('car', en.node, toB);
      if (!path) toB = null;
    }
    if (!path) {
      const exit = this._throughExit(en, h);
      if (exit < 0) return 'skip';
      path = this._route('car', en.node, exit);
    }
    if (!path) return 'skip';
    const vNom = en.freeway ? 25 : 10, enterDur = 7;
    const el = placed ? Math.max(0, (now - tArr) / 1000) : 0;
    const through = path.length / vNom + (toB ? enterDur : 0);
    if (placed && el >= through) {
      if (toB) this._shopperInside(h, toB, tArr + through * 1000, minute, now);
      return 'skip';
    }
    const vlook = vehicleLook(hash2(h, 5), this.rural);
    const lane0 = Math.floor(u01(hash2(h, 7)) * Math.max(1, lanesIn(net.edges[en.e], en.dir)));
    if (!placed && !this._bulk) {
      const st = path.steps[0];
      const q = this.queues.get(st.e * 32 + (st.dir > 0 ? 0 : 16) + Math.min(lane0, 7));
      if (q && q.length) { const lastCar = q[q.length - 1]; if (this._along(lastCar) - lastCar.len < vlook.len + 4) return 'blocked'; }
    }
    const drv = this._driverFor(h, tArr, minute, false);
    if (!drv) return 'skip';
    const a = this._newAgent({ kind: 'car', role: toB ? 'visitor' : 'through', id: drv.id, person: -1, path, trip: { path, t0: placed ? tArr : now, vNom, oIn: false, dIn: !!toB, toB, exitDur: 0, enterDur, dur: through }, age: drv.member.age, vmax: (en.freeway ? 31 : 15) + (u01(hash2(h, 6)) - 0.5) * 3, len: vlook.len, wid: vlook.wid, body: vlook.body, color: vlook.color, lookH: hash2(h, 5), lane: lane0, look: personLook(drv.id, drv.member.age) });
    if (toB) { a.visitorDwell = (15 + u01(hash2(h, 8)) * 45) * 60000; a.visitB = toB.id; }
    a.k = 0; a.d = 0; a.phase = 'route'; a.v = Math.min(a.vmax, net.edges[en.e].speed);
    if (placed && el > 0.5) { if (!this._placeOnSchedule(a, now)) { this._finish(a, this.agents.length - 1); return 'skip'; } }
    else this._joinQueue(a);
    return 'spawned';
  }

  /**
   * Who drives (or walks) an arrival with key h at tArr: a nearby NPC by pickDriver, never someone already on the
   * street, shopping here, or living in the view. While a fast clock jumps, hundreds of vehicles are back-filled
   * every frame, too many to look each one up: they are drawn from a pool of POOL people per ten simulated
   * minutes instead, filled lazily by the same rules and handed out by the arrival's key.
   */
  _driverFor(h, tArr, minute, walk) {
    if (this._fast) {
      const bucket = Math.floor(tArr / POOL_BUCKET);
      let P = walk ? this._walkPool : this._drivePool;
      if (!P || P.bucket !== bucket) { P = { bucket, list: new Array(POOL) }; if (walk) this._walkPool = P; else this._drivePool = P; }
      for (let probe = 0; probe < 6; probe++) {
        const j = (h + probe * 7919) % POOL;
        let d = P.list[j];
        if (d === undefined) d = P.list[j] = pickDriver(this.world, this.pop, this.near, hash3(this.seed ^ (walk ? 0x3a1c : 0xd71e), bucket, j), minute, { walk }) || null;
        if (d && !this._busyId(d.id)) return d;
      }
    }
    return pickDriver(this.world, this.pop, this.near, h, minute, { walk, tries: this._bulk ? 3 : 7, exclude: this._busyId });
  }

  /** A shopper who parked during the span a jump skipped: the car in a stall near the store, the person inside until done. */
  _shopperInside(h, b, tIn, minute, now) {
    const tBack = tIn + (15 + u01(hash2(h, 8)) * 45) * 60000;
    if (tBack <= now) return;
    const drv = this._driverFor(h, tIn, minute, false);
    if (!drv) return;
    const vlook = vehicleLook(hash2(h, 5), this.rural), lookH = hash2(h, 5);
    const stall = this._freeSpotNear(b);
    if (stall) this.spotCar[stall.id] = lookH;
    this._addReturn({ t: tBack, b, prev: { id: drv.id, uid: h, age: drv.member.age, vmax: 15 + (u01(hash2(h, 6)) - 0.5) * 3, len: vlook.len, wid: vlook.wid, body: vlook.body, color: vlook.color, lookH, look: personLook(drv.id, drv.member.age), toSpot: stall ? stall.id : -1 } });
  }

  /** A shopper who parked goes into the store; they come back out after shopping and drive off toward an exit. */
  _visitorReturn(a) {
    const b = this.scene.buildings[a.visitB];
    if (!b || !b.access) return;
    // in the store since the car was parked: now while stepping, at its scheduled arrival when the clock jumped
    const tIn = this._bulk && a.trip ? Math.min(this.t, a.trip.t0 + a.trip.dur * 1000) : this.t;
    this._addReturn({ t: tIn + a.visitorDwell, b, prev: { id: a.id, uid: a.uid, age: a.age, vmax: a.vmax, len: a.len, wid: a.wid, body: a.body, color: a.color, lookH: a.lookH, look: a.look, toSpot: a.toSpot } });
  }

  _addReturn(x) {
    this._pendingReturns.push(x);
    this.shoppers.add(x.prev.id);
    if (x.t < this._nextReturn) this._nextReturn = x.t;
  }

  /**
   * Shoppers whose time in the store is up come out to their cars. After a jump, one who came out more than a
   * minute before has driven off already: the stall is simply empty now.
   */
  _returns(t, jumping) {
    if (!this._pendingReturns.length || this._nextReturn > t) return;
    const due = [], keep = [];
    let next = Infinity;
    for (const x of this._pendingReturns) { if (x.t <= t) due.push(x); else { keep.push(x); if (x.t < next) next = x.t; } }
    this._pendingReturns = keep; this._nextReturn = next;
    for (const x of due) {
      this.shoppers.delete(x.prev.id);
      if (jumping && t - x.t > 60000) {
        if (x.prev.toSpot >= 0 && this.spotCar[x.prev.toSpot] === x.prev.lookH) this.spotCar[x.prev.toSpot] = -1;
        continue;
      }
      this._spawnVisitorBack(x.prev, x.b, Math.min(x.t, t), t);
    }
  }

  /** The exit a vehicle entering at `en` leaves by: the same road most often, else another of its rank (weights kept per entry). */
  _throughExit(en, h) {
    if (!en.exits) {
      const net = this.net, freeway = net.edges[en.e].freeway;
      en.exits = this.carExits.filter(id => id !== en.node);
      en.exitW = en.exits.map(id => {
        const E = net.edges[net.nodes[id].adj[0].e];
        const same = E.name && E.name === en.name ? 6 : 1;
        const rank = E.freeway === freeway ? (E.rank >= 6 ? 3 : E.rank >= 5 ? 1.5 : 0.25) : 0;
        return same * rank;
      });
      en.exitTot = en.exitW.reduce((x, y) => x + y, 0);
    }
    const cands = en.exits, w = en.exitW;
    if (!cands.length || !(en.exitTot > 0)) return -1;
    let x = u01(hash2(h, 3)) * en.exitTot;
    for (let i = 0; i < cands.length; i++) { x -= w[i]; if (x <= 0) return cands[i]; }
    return cands[cands.length - 1];
  }

  /** A route from a node to an exit node or a building, cached (the oldest routes give way when the cache is full). */
  _route(mode, fromNode, to) {
    const key = (mode === 'car' ? 0 : mode === 'bike' ? 1 : 2) + 3 * (fromNode + 100003 * (typeof to === 'number' ? to * 2 : to.id * 2 + 1));
    const hit = this.routeCache.get(key);
    if (hit !== undefined) return hit;
    let p = null;
    if (typeof to === 'number') p = this.router.path(mode, { node: fromNode }, { node: to });
    else if (to.access) p = this.router.path(mode, { node: fromNode }, { e: to.access.e, s: to.access.s });
    if (this.routeCache.size >= ROUTE_CACHE) { let k = 0; for (const old of this.routeCache.keys()) { this.routeCache.delete(old); if (++k >= ROUTE_CACHE / 8) break; } }
    this.routeCache.set(key, p);
    return p;
  }

  /** People on foot per second entering the view at t (dense places only; shopping hours). */
  _footRate(t) {
    if (!this.footRate || !this.walkExits.length) return 0;
    return this.footRate * trafficProfile(pacific(t).minuteOfDay, false, SHOPPING) * this.trafficScale / 3600 * Math.min(12, this.walkExits.length) / 12;
  }

  /** People on foot passing through or going to the shops (dense places). */
  _footStreams(t) {
    if (!this.footRate || !this.walkExits.length) return;
    const A = this.foot;
    if (A.cm === null) A.seek(t);
    for (let guard = 0; guard < 6; guard++) {
      const tArr = A.peek();
      if (tArr > t) break;
      this._spawnWalker(tArr, t, A.cursorKey(), false);
      A.ci++;
    }
  }

  _footJump(t, span) {
    if (!this.footRate || !this.walkExits.length) return;
    let n = 0;
    this.foot.backfill(t - span * 1000, t, (tArr, key) => { if (this._spawnWalker(tArr, t, key, true)) n++; return n < JUMP_WALKERS; });
    this.foot.seek(t);
  }

  /** A person on foot entering at an edge at tArr (placed by schedule after a jump); true when they are on the street. */
  _spawnWalker(tArr, now, key, placed) {
    const h = key;
    const ex = this.walkExits;
    const from = ex[h % ex.length];
    let toB = null, path = null;
    if (this.shops.length && u01(hash2(h, 1)) < 0.55) { toB = this.shops[hash2(h, 2) % this.shops.length]; path = this._route('foot', from, toB); if (!path) toB = null; }
    if (!path) { const to = ex[hash2(h, 3) % ex.length]; if (to === from) return false; path = this._route('foot', from, to); }
    if (!path) return false;
    const el = placed ? (now - tArr) / 1000 : 0;
    if (el * WALK_MAX >= path.length + (toB ? 4 * WALK_MAX : 0)) return false;          // through already, whoever it was
    const drv = this._driverFor(h, tArr, pacific(tArr).minuteOfDay, true);
    if (!drv) return false;
    const vmax = walkSpeed(drv.member.age, drv.id);
    const a = this._newAgent({ kind: 'walk', role: 'visitor', id: drv.id, person: -1, path, trip: { path, t0: placed ? tArr : now, vNom: vmax, oIn: false, dIn: !!toB, toB, exitDur: 0, enterDur: 4, dur: path.length / vmax + 4 }, age: drv.member.age, vmax, look: personLook(drv.id, drv.member.age) });
    a.k = 0; a.d = 0; a.phase = 'route';
    a.sides = new Int8Array(path.steps.length);
    if (el > 0.5 && !this._placeOnSchedule(a, now)) { this._finish(a, this.agents.length - 1); return false; }
    return true;
  }

  /** Whether buses run at epoch ms t (no owl service in a street view: none from 1:00 to 5:00). */
  _busesRun(t) { const hr = pacific(t).hour; return hr < 1 || hr >= 5; }

  /**
   * Departures from each route's first stop up to t: one per headway, from the phase of the route. After a reset
   * or a jump the departures still on the route are put where their timetable has them; older ones are skipped.
   */
  _buses(t) {
    const tt = t / 1000;
    for (const r of this.busRoutes) {
      const due = Math.floor((tt - r.phase) / r.headway);
      const first = Math.floor((tt - r.path.length / BUS_V - r.phase) / r.headway);
      if (r.k === null || r.k < first) r.k = first;
      while (r.k < due) {
        const dep = (r.phase + (r.k + 1) * r.headway) * 1000;
        // a bus that finds its first block backed up to the edge pulls in when there is room (or gives the run up)
        if (this._busesRun(dep) && this._spawnBus(r, dep, t) === 'blocked' && t - dep < 3 * MAX_HOLD) break;
        r.k++;
      }
    }
  }

  /**
   * When the first bus after tSec (epoch seconds) reaches stop `sid` by its timetable (departure plus the run to
   * the stop at BUS_V), in epoch seconds; Infinity when no bus serves the stop.
   */
  _nextBusAt(sid, tSec) {
    const s = this.stops[sid];
    const r = s ? this.busRoutes[s.route] : null;
    if (!r) return Infinity;
    const run = s.at / BUS_V;
    let k = Math.ceil((tSec - run - r.phase) / r.headway);
    for (let g = 0; g < 64; g++, k++) {
      const dep = r.phase + k * r.headway;
      if (this._busesRun(dep * 1000)) return dep + run;
    }
    return Infinity;
  }

  /**
   * A bus leaving the route's first stop at tArr. After a reset or a jump it is put where its timetable has it;
   * while stepping it pulls in at the start of the route when the lane has room ('blocked' otherwise).
   * @returns {'spawned'|'blocked'|'skip'}
   */
  _spawnBus(r, tArr, now) {
    const st0 = r.path.steps[0], E0 = this.net.edges[st0.e];
    const lane = Math.max(0, lanesIn(E0, st0.dir) - 1), len = 12.2;
    const placed = this._bulk;
    if (!placed) {
      const q = this.queues.get(st0.e * 32 + (st0.dir > 0 ? 0 : 16) + Math.min(lane, 7));
      if (q && q.length) { const l = q[q.length - 1]; if (this._along(l) - l.len - (st0.dir > 0 ? st0.from : E0.len - st0.from) < len + MIN_GAP + 1) return 'blocked'; }
    }
    const h = hash3(this.seed, r.from * 31 + r.to, Math.floor(tArr / 1000));
    const drv = pickDriver(this.world, this.pop, this.near, h, pacific(tArr).minuteOfDay, { job: 'transport', exclude: this._busyId });
    if (!drv) return 'skip';
    const a = this._newAgent({ kind: 'bus', role: 'bus', id: drv.id, person: -1, path: r.path, trip: { path: r.path, t0: placed ? tArr : now, vNom: BUS_V, oIn: false, dIn: false, exitDur: 0, enterDur: 0, dur: r.path.length / BUS_V }, age: drv.member.age, vmax: 13, len, wid: 2.6, color: '#d9b310', route: r, look: personLook(drv.id, drv.member.age), lane });
    a.k = 0; a.d = 0; a.phase = 'route'; a.v = placed ? 8 : 6;
    this._nextBusStop(a, true);
    if (placed && (now - tArr) / 1000 > 0.5) { if (!this._placeOnSchedule(a, now)) { this._finish(a, this.agents.length - 1); return 'skip'; } this._nextBusStop(a, true); }
    else this._joinQueue(a);
    return 'spawned';
  }

  _nextBusStop(a, fromStart = false) {
    const r = a.route;
    const idx = fromStart ? 0 : (a.stopIdx || 0) + 1;
    let i = idx;
    while (i < r.stops.length) { const s = this.stops[r.stops[i]]; if (s.k > a.k || (s.k === a.k && s.d > a.d + 2)) break; i++; }
    a.stopIdx = i;
    if (i >= r.stops.length) { a.nextStop = null; return; }
    const s = this.stops[r.stops[i]];
    a.nextStop = s.id; a.nextStopK = s.k; a.stopD = s.d; a.dwellNeed = 10 + Math.min(20, s.waiting.size * 1.5);
  }

  _busAtStop(a) {
    const s = this.stops[a.nextStop];
    if (!s || !s.waiting.size) return;
    for (const uid of s.waiting) { const w = this.byUid.get(uid); if (w) w.boarded = true; }
    s.served++;
  }

  /** A shopper back at their car at tOut drives off toward an exit (placed by schedule when that was before now). */
  _spawnVisitorBack(prev, b, tOut, now) {
    const sp = prev.toSpot >= 0 ? this.scene.spots[prev.toSpot] : null;
    if (sp && this.spotCar[sp.id] === prev.lookH) this.spotCar[sp.id] = -1;
    if (this.activeIds.has(prev.id)) return;
    const exit = this._throughExitFromB(b, prev.uid);
    if (exit < 0) return;
    const path = this.router.pathTo('car', { e: b.access.e, s: b.access.s }, exit);
    if (!path) return;
    const a = this._newAgent({ kind: 'car', role: 'visitor', id: prev.id, person: -1, path, trip: { path, t0: tOut, vNom: 10, oIn: true, dIn: false, fromB: b, exitDur: 7, enterDur: 0, dur: path.length / 10 + 7 }, age: prev.age, vmax: prev.vmax, len: prev.len, wid: prev.wid, body: prev.body, color: prev.color, lookH: prev.lookH, look: prev.look });
    a.k = 0; a.d = 0;
    if (sp) { a.from = { x: sp.x, y: sp.y, hx: Math.cos(sp.ang), hy: Math.sin(sp.ang) }; a.reverse = false; }
    else a.from = { x: b.access.curbX, y: b.access.curbY, hx: 1, hy: 0 };
    a.phase = 'exit'; a.pu = 0; a.pdur = 7;
    if ((now - tOut) / 1000 > 0.5 && !this._placeOnSchedule(a, now)) this._finish(a, this.agents.length - 1);
  }

  _throughExitFromB(b, h) {
    const ex = this.carExits;
    if (!ex.length) return -1;
    return ex[hash2(this.seed, h) % ex.length];
  }

  // ------------------------------------------------ poses (for rendering and picking)

  /** Raw position on step k at distance d with the agent's lateral offset (no corner smoothing). */
  _routePoseRaw(a, k, d) {
    const st = a.path.steps[k];
    const p = this._stepPoint(st, d, {});
    const E = this.net.edges[st.e];
    let off;
    if (a.kind === 'walk') off = this._sideOf(a, k) * st.dir * sidewalkOffset(E) + (hf01(a.uid) - 0.5) * 0.7;
    else if (a.kind === 'bike') off = bikeOffset(E);
    else off = laneOffset(E, st.dir, Math.min(a.lane, Math.max(0, lanesIn(E, st.dir) - 1))) + (k === a.k ? a.laneShift || 0 : 0);
    return { x: p.x - p.ty * off, y: p.y + p.tx * off, hx: p.tx, hy: p.ty };
  }

  /** Smoothed position on the route: quadratic blends through corners. */
  _routePose(a, k, d) {
    const steps = a.path.steps, st = steps[k], L = stepLen(st);
    const r = a.kind === 'walk' ? 2.5 : 7;
    if (d > L - r && k + 1 < steps.length) {
      const L2 = stepLen(steps[k + 1]);
      const rr = Math.min(r, L * 0.5, L2 * 0.5);
      if (d > L - rr) return this._blend(a, k, L - rr, k + 1, rr, (d - (L - rr)) / (2 * rr));
    }
    if (d < r && k > 0) {
      const Lp = stepLen(steps[k - 1]);
      const rr = Math.min(r, L * 0.5, Lp * 0.5);
      if (d < rr) return this._blend(a, k - 1, Lp - rr, k, rr, 0.5 + d / (2 * rr));
    }
    return this._routePoseRaw(a, k, d);
  }

  _blend(a, k1, d1, k2, d2, u) {
    const steps = a.path.steps;
    const p0 = this._routePoseRaw(a, k1, d1), p2 = this._routePoseRaw(a, k2, d2);
    const e1 = this._routePoseRaw(a, k1, stepLen(steps[k1])), e2 = this._routePoseRaw(a, k2, 0);
    const cx = (e1.x + e2.x) / 2, cy = (e1.y + e2.y) / 2;
    const w = 1 - u;
    const x = w * w * p0.x + 2 * w * u * cx + u * u * p2.x, y = w * w * p0.y + 2 * w * u * cy + u * u * p2.y;
    let hx = 2 * w * (cx - p0.x) + 2 * u * (p2.x - cx), hy = 2 * w * (cy - p0.y) + 2 * u * (p2.y - cy);
    const n = Math.hypot(hx, hy) || 1;
    return { x, y, hx: hx / n, hy: hy / n };
  }

  /**
   * Pose of an agent now: {x, y, hx, hy} in local meters. Also stored on the agent (a.x, a.y, a.hx, a.hy).
   */
  pose(a) {
    if (a.phase === 'wander') return a;
    let p;
    if (a.phase === 'wait') {
      const s = this.stops[a.busStop];
      const j = (hf01(a.uid) - 0.5) * 4;
      p = s ? { x: s.x + Math.cos(s.ang) * j, y: s.y + Math.sin(s.ang) * j, hx: -Math.sin(s.ang), hy: Math.cos(s.ang) } : { x: a.x, y: a.y, hx: a.hx, hy: a.hy };
    } else if (a.phase === 'exit' && a.from) {
      const end = this._routePose(a, 0, 0);
      p = this._maneuver(a.from, end, a.pu, a.kind === 'car' && a.reverse);
    } else if (a.phase === 'enter' && a.to) {
      const st = a.path.steps[a.path.steps.length - 1];
      const start = this._routePose(a, a.path.steps.length - 1, stepLen(st));
      p = this._maneuver(start, a.to, a.pu, false);
    } else p = this._routePose(a, a.k, a.d);
    a.x = p.x; a.y = p.y; a.hx = p.hx; a.hy = p.hy;
    return a;
  }

  /**
   * A short move between two poses: pulling into or out of a curb space or a lot (one forward curve), backing out
   * of a driveway (reverse into the lane, then forward), or walking between a door and the sidewalk.
   */
  _maneuver(A, B, u, reverse) {
    u = clamp(u, 0, 1);
    const L = Math.hypot(B.x - A.x, B.y - A.y) || 1;
    const ah = A.hx || A.hy ? A : { hx: (B.x - A.x) / L, hy: (B.y - A.y) / L };
    const bh = B.hx || B.hy ? B : { hx: (B.x - A.x) / L, hy: (B.y - A.y) / L };
    if (reverse) {
      // back out (rear first) to a point in the lane short of B, ending aligned with the lane, then drive on
      const Mx = B.x - bh.hx * 6, My = B.y - bh.hy * 6;
      if (u < 0.72) {
        const s = smooth(u / 0.72), Lm = Math.hypot(Mx - A.x, My - A.y);
        return cubic(A.x, A.y, A.x - ah.hx * Lm * 0.5, A.y - ah.hy * Lm * 0.5, Mx + bh.hx * Lm * 0.45, My + bh.hy * Lm * 0.45, Mx, My, s, true);
      }
      const s = smooth((u - 0.72) / 0.28);
      return { x: Mx + (B.x - Mx) * s, y: My + (B.y - My) * s, hx: bh.hx, hy: bh.hy };
    }
    const s = smooth(u);
    return cubic(A.x, A.y, A.x + ah.hx * L * 0.45, A.y + ah.hy * L * 0.45, B.x - bh.hx * L * 0.45, B.y - bh.hy * L * 0.45, B.x, B.y, s, false);
  }

  // ------------------------------------------------ queries

  /** The agent nearest a local point within r meters (poses must be current). */
  pick(x, y, r = 6) {
    let best = null, bd = r;
    for (const a of this.agents) {
      const p = this.pose(a);
      const rr = a.kind === 'walk' ? 0 : a.len * 0.4;
      const d = Math.max(0, Math.hypot(p.x - x, p.y - y) - rr);
      if (d < bd) { bd = d; best = a; }
    }
    return best;
  }

  /** The agent of an NPC id, if it is on the street. */
  agentOf(id) { return this.agents.find(a => a.id === id) || null; }

  /** Counts for the UI: agents by kind, moving, residents out, through traffic. */
  stats() {
    const out = { agents: this.agents.length, moving: 0, walk: 0, car: 0, bike: 0, bus: 0, waiting: 0, residentsOut: 0, through: 0, visitors: 0, commuters: this.persons.length - this.residentCount, residents: this.residentCount, parked: 0 };
    for (const a of this.agents) {
      out[a.kind]++;
      if (a.v > 0.2 || a.phase === 'exit' || a.phase === 'enter') out.moving++;
      if (a.phase === 'wait') out.waiting++;
      if (a.role === 'resident') out.residentsOut++;
      else if (a.role === 'through') out.through++;
      else if (a.role === 'visitor') out.visitors++;
    }
    for (let i = 0; i < this.spotCar.length; i++) if (this.spotCar[i] >= 0) out.parked++;
    return Object.assign(out, this.stats0);
  }

  // ------------------------------------------------ chatter

  /**
   * Two residents passing within `r` meters may exchange a line: bark(idA, idB, context) is asked (rate-limited
   * in real time) and its answer shown as a bubble above A for a few seconds, then B's reply.
   * @param {number} nowMs real time (ms) for bubble lifetimes and rate limiting
   * @param {Function|null} bark (idA, idB, context) → string | {text, gloss} | Promise of either
   * @param {{r?: number, minGapMs?: number, maxBubbles?: number, contextFor?: Function}} [opts]
   */
  chatter(nowMs, bark, { r = 2.4, minGapMs = 1800, maxBubbles = 5, contextFor = null, accept = null } = {}) {
    this._nowMs = nowMs;
    this.bubbles = this.bubbles.filter(b => b.until > nowMs && this.byUid.get(b.agent.uid) === b.agent);
    if (!bark || nowMs - this.lastBarkMs < minGapMs || this.bubbles.length >= maxBubbles) return null;
    const walkers = this.agents.filter(a => a.kind === 'walk' && a.role === 'resident' && (a.phase === 'route' || a.phase === 'wait' || a.phase === 'wander'));
    if (walkers.length < 2) return null;
    const cell = 4, grid = new Map();
    for (const a of walkers) { this.pose(a); const k = Math.floor(a.x / cell) * 65536 + Math.floor(a.y / cell); let b = grid.get(k); if (!b) grid.set(k, b = []); b.push(a); }
    for (const a of walkers) {
      if (a.bubble && a.bubble.until > nowMs) continue;
      if (accept && !accept(a)) continue;
      const cx = Math.floor(a.x / cell), cy = Math.floor(a.y / cell);
      for (let i = cx - 1; i <= cx + 1; i++) for (let j = cy - 1; j <= cy + 1; j++) {
        const b = grid.get(i * 65536 + j); if (!b) continue;
        for (const o of b) {
          if (o === a || o.uid < a.uid) continue;
          if (Math.hypot(o.x - a.x, o.y - a.y) > r) continue;
          const key = a.id < o.id ? a.id + '|' + o.id : o.id + '|' + a.id;
          if ((this.barkLog.get(key) || -Infinity) > this.t - 20 * MIN) continue;
          this.barkLog.set(key, this.t);
          if (this.barkLog.size > 5000) this.barkLog.clear();
          this.lastBarkMs = nowMs;
          const ctx = Object.assign({ t: this.t, kind: 'passing', where: this._streetName(a), zip: this.world.zips[this.scene.zi] }, contextFor ? contextFor(a, o) : {});
          this._ask(bark, a, o, ctx, nowMs, false);
          return { a: a.id, b: o.id };
        }
      }
    }
    return null;
  }

  _streetName(a) { if (!a.path || !a.path.steps[a.k]) return ''; return this.net.edges[a.path.steps[a.k].e].name || ''; }

  _ask(bark, a, o, ctx, nowMs, reply) {
    let res;
    try { res = bark(a.id, o.id, ctx); } catch { return; }
    const show = (val) => {
      if (!val) return;
      const text = typeof val === 'string' ? val : val.text;
      if (!text) return;
      const gloss = typeof val === 'object' ? val.gloss || null : null;
      const until = Math.max(nowMs, this._nowMs || nowMs) + 3200 + Math.min(2500, text.length * 30);
      a.bubble = { text, gloss, until };
      this.bubbles.push({ agent: a, until });
      if (!reply) {
        // the other one answers a moment later
        const later = () => this._ask(bark, o, a, Object.assign({}, ctx, { replyTo: text }), nowMs + 1400, true);
        if (typeof setTimeout === 'function') setTimeout(later, 1400); else later();
      }
    };
    if (res && typeof res.then === 'function') res.then(show, () => {}); else show(res);
  }
}

// ---------------------------------------------------------------- helpers

/** Length of a path step. */
export function stepLen(st) { return Math.abs(st.to - st.from); }

/** True when an agent's route state can be read (its step exists and its position is a number). */
function agentReadable(a) {
  if (!a) return false;
  if (a.phase === 'wander' || a.phase === 'wait') return Number.isFinite(a.x) && Number.isFinite(a.y);
  return !!(a.path && a.path.steps && a.path.steps[a.k] && Number.isFinite(a.d));
}
const smooth = u => u * u * (3 - 2 * u);
/** Point and heading on a cubic Bezier; `rear` flips the heading (the vehicle moves backward). */
function cubic(x0, y0, x1, y1, x2, y2, x3, y3, s, rear) {
  const w = 1 - s;
  const x = w * w * w * x0 + 3 * w * w * s * x1 + 3 * w * s * s * x2 + s * s * s * x3;
  const y = w * w * w * y0 + 3 * w * w * s * y1 + 3 * w * s * s * y2 + s * s * s * y3;
  let hx = 3 * w * w * (x1 - x0) + 6 * w * s * (x2 - x1) + 3 * s * s * (x3 - x2);
  let hy = 3 * w * w * (y1 - y0) + 6 * w * s * (y2 - y1) + 3 * s * s * (y3 - y2);
  const n = Math.hypot(hx, hy) || 1;
  hx /= n; hy /= n;
  return rear ? { x, y, hx: -hx, hy: -hy } : { x, y, hx, hy };
}
function hf01(uid) { return u01(hash2(0x51ed, uid)); }
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
function hf2(seed, a, b) { return u01(hash3(seed, a, Math.floor(b / 1000))); }
function walkSpeed(age, id) {
  const base = age < 10 ? 1.15 : age < 65 ? 1.38 : age < 80 ? 1.15 : 0.95;
  return base * (0.88 + u01(idHash(id)) * 0.24);
}

function buildSpotGrid(spots) {
  const cell = 40, map = new Map();
  for (const s of spots) { const k = Math.floor(s.x / cell) * 65536 + Math.floor(s.y / cell); let b = map.get(k); if (!b) map.set(k, b = []); b.push(s); }
  return {
    near(x, y, r) {
      const out = [], n = Math.ceil(r / cell), cx = Math.floor(x / cell), cy = Math.floor(y / cell);
      for (let i = cx - n; i <= cx + n; i++) for (let j = cy - n; j <= cy + n; j++) { const b = map.get(i * 65536 + j); if (b) for (const s of b) out.push(s); }
      return out;
    },
  };
}

export { personLook, vehicleLook, idHash };
