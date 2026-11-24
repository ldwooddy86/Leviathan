// Legion · schedule: an NPC's day, minute by minute.
//
// dayPlan(npc, persona, t) lays out the Pacific calendar day holding t as a list of items that tile it exactly,
// midnight to midnight, with no gaps and no overlaps: sleep, time at home, the commute and the shift or the
// school day, errands, leisure, exercise, church and visits. The commute is layer 0's (departMin, commuteMin,
// dwellMin and the day mask from pop.householdCore, which persona.routine carries), so the crowd, the street view
// and this plan always agree on where a person is. A shift that runs past midnight spills into the next day's
// plan; one that runs into the next day's departure (24-hour shifts on back-to-back days) keeps them at work
// while today's layer 0 timing still holds. Sleep follows a chronotype from age and personality and bends around
// the shift; errands go to nearby ZIPs with stores and restaurants; leisure comes from the persona's interests;
// weekends differ from weekdays; young children are driven to school by the household adult the persona assigned.
//
// activityAt(npc, persona, t) is the item at t plus its progress and, while traveling, the position on the
// straight segment between the two places (the street view routes its own paths).
//
// Pure and deterministic: the randomness of a day comes from the NPC's seed and the calendar date.

import { Rng, hashAll, clamp, lerp } from './rng.mjs';
import { pacific, atPacific } from './clock.mjs';

/** The kinds a plan item can have. */
export const PLAN_KINDS = ['sleep', 'home', 'commute', 'work', 'school', 'errand', 'leisure', 'exercise', 'worship', 'visit'];

const isNum = v => typeof v === 'number' && Number.isFinite(v);
const num = (v, d = 0) => (isNum(v) ? v : d);
const MIN_DAY = 1440;
const DEFAULT_UNIT_KM = 0.1975;

// ---------------------------------------------------------------- calendar

/** The Pacific calendar day holding t: {y, mo, d, dow, start, end (epoch ms), prevDow, nextDow, key}. */
export function dayInfo(t) {
  const p = pacific(t);
  const start = atPacific(p.year, p.month, p.day, 0, 0);
  const n = new Date(Date.UTC(p.year, p.month - 1, p.day + 1));
  const end = atPacific(n.getUTCFullYear(), n.getUTCMonth() + 1, n.getUTCDate(), 0, 0);
  return { y: p.year, mo: p.month, d: p.day, dow: p.dow, start, end, prevDow: (p.dow + 6) % 7, nextDow: (p.dow + 1) % 7, key: p.year * 10000 + p.month * 100 + p.day };
}

/** Wall-clock minute of the day → epoch ms (exact on daylight-saving days too). */
function wallToMs(day, min) {
  if (min <= 0) return day.start;
  if (min >= MIN_DAY) return day.end;
  if (day.end - day.start === 86400000) return day.start + min * 60000;
  return clamp(atPacific(day.y, day.mo, day.d, Math.floor(min / 60), min % 60), day.start, day.end);
}

const bit = dow => 1 << dow;

// ---------------------------------------------------------------- routine and rhythm

/**
 * The routine schedule.mjs works from: persona.routine (layer 0 commute fields, school runs and places, built by
 * persona.mjs), or, for a persona without one, the NPC's own commute record with a minimal set of places.
 */
export function routineOf(npc, persona) {
  const r = persona && persona.routine;
  if (r && r.home) return r;
  const hh = (npc && npc.household) || {};
  const home = hh.home && isNum(hh.home.x) ? { x: hh.home.x, y: hh.home.y } : { x: 0, y: 0 };
  const cm = (npc && npc.commute) || {};
  const work = cm.work && isNum(cm.work.x) ? { x: cm.work.x, y: cm.work.y } : null;
  return {
    mode: cm.mode ?? null, commuteMin: num(cm.minutes), departMin: isNum(cm.departMin) ? cm.departMin : null, dwellMin: num(cm.dwellMin),
    days: num(cm.days), workZi: num(cm.workZi, -1), work, source: 'npc', home, student: null, worker: !!(npc && npc.occupation),
    shift: 'day', vehicles: num(hh.vehicles, 1), age: num(npc && npc.age, 35), density: 2000, unitKm: DEFAULT_UNIT_KM,
    schoolRuns: [], ride: null, places: { errands: [], park: { kind: 'park', label: 'the park', x: home.x + 3, y: home.y + 3 } },
  };
}

/** Hours after midnight of mid-sleep on free days, by age (Roenneberg et al. 2004: latest around 20). */
const MID_SLEEP = [[0, 1.6], [3, 2.0], [10, 2.6], [15, 3.9], [20, 4.6], [25, 4.3], [30, 4.0], [40, 3.6], [50, 3.3], [60, 3.0], [70, 2.8], [85, 2.6], [120, 2.6]];
function interp(table, x) {
  for (let i = 1; i < table.length; i++) if (x <= table[i][0]) { const [x0, y0] = table[i - 1], [x1, y1] = table[i]; return lerp(y0, y1, (x - x0) / (x1 - x0)); }
  return table[table.length - 1][1];
}

/**
 * Chronotype and sleep need from age and personality (conscientious people rise earlier; openness and
 * extraversion lean late), shifted late for night and evening workers.
 * @returns {{chronotype:'lark'|'neutral'|'owl', needMin:number, freeBedMin:number, freeWakeMin:number, prepMin:number}}
 *   freeBedMin is relative to the midnight that starts the night (negative = the evening before).
 */
export function rhythmOf(npc, persona) {
  const b = (persona && persona.big5) || {};
  const C = num(b.C, 0.5), O = num(b.O, 0.5), E = num(b.E, 0.5);
  const age = clamp(num(npc && npc.age, 35), 0, 110);
  const r = new Rng(hashAll('rhythm', num(npc && npc.seed, 7) >>> 0));
  const lean = -0.6 * (C - 0.5) * 2 + 0.25 * (O - 0.5) * 2 + 0.2 * (E - 0.5) * 2 + r.normal(0, 0.35);
  const rt = routineOf(npc, persona);
  const shiftLate = rt.shift === 'night' ? 5 : rt.shift === 'evening' ? 2 : 0;
  const need = clamp((age < 3 ? 12.5 : age < 6 ? 11 : age < 13 ? 10 : age < 18 ? 9 : age < 26 ? 8 : age < 65 ? 7.5 : 7.3) + r.normal(0, 0.3), 6, 13);
  const mid = interp(MID_SLEEP, age) + lean + shiftLate;
  const kids = persona && persona.npc && persona.npc.household && Array.isArray(persona.npc.household.members)
    ? persona.npc.household.members.some(x => x && x.role === 'child' && num(x.age, 99) < 12) : false;
  return {
    chronotype: lean < -0.45 ? 'lark' : lean > 0.45 ? 'owl' : 'neutral',
    needMin: Math.round(need * 60),
    freeBedMin: Math.round((mid - need / 2) * 60),
    freeWakeMin: Math.round((mid + need / 2) * 60),
    prepMin: Math.round(25 + 30 * C + (kids && age >= 18 ? 15 : 0) + r.int(15)),
  };
}

// ---------------------------------------------------------------- places and travel

const homePlace = rt => ({ kind: 'home', x: rt.home.x, y: rt.home.y, label: 'home' });

function workPlace(rt, npc, persona) {
  const p = rt.work || rt.home;
  const student = rt.student && !rt.worker;
  if (student) {
    // K-12 by age (always right for the grade), college and grad school from the record
    const age = num(rt.age, num(npc && npc.age, 10)), sch = npc && npc.school;
    const label = sch === 'grad' || rt.student === 'grad' ? 'grad school' : age >= 18 || sch === 'college' || rt.student === 'college' ? 'college'
      : age < 5 ? 'preschool' : age < 11 ? 'elementary school' : age < 14 ? 'middle school' : 'high school';
    return { kind: 'school', x: p.x, y: p.y, label };
  }
  const city = persona && persona.knowledge && persona.knowledge.workCity;
  return { kind: 'work', x: p.x, y: p.y, label: city ? `work in ${city}` : 'work' };
}

function distKm(rt, a, b) { return Math.hypot(b.x - a.x, b.y - a.y) * num(rt.unitKm, DEFAULT_UNIT_KM); }

/** How they get to an outing: by car when they can, on foot nearby, by bus in town. */
function outingMode(rt, km) {
  const age = num(rt.age, 35), dense = num(rt.density) >= 4000;
  if (age < 16) return km < 1.5 ? 'walk' : 'carpool';
  if (num(rt.vehicles) > 0) return km < 1 && dense ? 'walk' : rt.mode === 'bike' && km < 8 ? 'bike' : 'drive';
  if (km < 2) return 'walk';
  return num(rt.density) >= 2500 ? 'bus' : 'carpool';
}

function travelMinutes(rt, km, mode) {
  const d = num(rt.density);
  const speed = { walk: 4.8, bike: 15, bus: 16, rail: 30, ferry: 25, drive: d >= 3000 ? 28 : d >= 500 ? 40 : 60, carpool: d >= 3000 ? 28 : d >= 500 ? 40 : 60 }[mode] || 30;
  const overhead = mode === 'drive' || mode === 'carpool' ? 4 : mode === 'bus' ? 8 : mode === 'rail' ? 10 : 1;
  return clamp(Math.round((km / speed) * 60 + overhead), 3, 150);
}

// ---------------------------------------------------------------- blocks

/**
 * Push the commute, the shift and the trip home of a commute day starting at departMin + offset (offset -1440
 * for yesterday's shift, whose tail may spill past midnight into today). The outbound leg starts at `start`
 * (home, or the workplace when yesterday's shift ran straight into today's).
 */
function pushShift(blocks, rt, offset, home, work, start = home) {
  const dep = Math.round(rt.departMin) + offset, c = Math.max(0, Math.round(rt.commuteMin)), dw = Math.max(0, Math.round(rt.dwellMin));
  const stayKind = work.kind === 'school' ? 'school' : 'work';
  const spill = offset < 0;
  blocks.push({ s: dep, e: dep + c, kind: 'commute', travel: true, from: start, place: work, mode: rt.mode, anchor: 'layer0', leg: 'out', spill });
  blocks.push({ s: dep + c, e: dep + c + dw, kind: stayKind, travel: false, place: work, mode: null, anchor: 'layer0', spill });
  blocks.push({ s: dep + c + dw, e: dep + 2 * c + dw, kind: 'commute', travel: true, from: work, place: home, mode: rt.mode, anchor: 'layer0', leg: 'back', spill });
}

const commutes = rt => isNum(rt.departMin) && rt.mode && rt.mode !== 'wfh' && (num(rt.commuteMin) > 0 || num(rt.dwellMin) > 0);
const commuteDay = (rt, dow) => commutes(rt) && (num(rt.days) & bit(dow)) !== 0;
const wfhDay = (rt, dow) => rt.mode === 'wfh' && rt.worker !== false && ((num(rt.days) || 62) & bit(dow)) !== 0;

/** Minute a day's first fixed obligation starts (for wake times), or null. */
function firstAnchor(rt, dow) {
  let a = null;
  if (commuteDay(rt, dow)) a = Math.round(rt.departMin);
  else if (wfhDay(rt, dow)) a = isNum(rt.departMin) ? Math.round(rt.departMin) : null;
  for (const run of rt.schoolRuns || []) if ((num(run.days) & bit(dow)) && (a === null || run.departMin < a)) a = Math.round(run.departMin);
  return a !== null && a < 14 * 60 ? a : null;
}

/** Bedtime on the night that starts at the end of a day of week dow, in that day's wall minutes. */
function bedtime(rt, rh, dow, nextFirst, lastEnd) {
  let bed = rh.freeBedMin + MIN_DAY + (dow === 5 || dow === 6 ? 50 : 0);
  if (nextFirst !== null) bed = Math.min(bed, nextFirst - rh.prepMin - rh.needMin + MIN_DAY);
  if (lastEnd !== null) bed = Math.max(bed, lastEnd + 20);
  return bed;
}

/** Free windows (complement of the blocks) in [from, to). */
function windows(blocks, from, to) {
  const out = [];
  let cur = from;
  for (const b of blocks.slice().sort((a, c) => a.s - c.s)) {
    if (b.e <= cur) continue;
    if (b.s > cur) out.push({ s: cur, e: Math.min(b.s, to) });
    cur = Math.max(cur, b.e);
    if (cur >= to) break;
  }
  if (cur < to) out.push({ s: cur, e: to });
  return out.filter(w => w.e - w.s > 0);
}

/** Fit an outing (travel there, stay, travel back) into a free window inside [earliest, latest]; true if placed. */
function placeOuting(blocks, free, o, rng) {
  const need = 2 * o.travel + o.stay;
  for (const w of free) {
    const s0 = Math.max(w.s + 5, o.earliest), s1 = Math.min(w.e - 5 - need, o.latest - need);
    if (s1 < s0) continue;
    const s = Math.round(s0 + rng.float() * (s1 - s0));
    const home = o.from;
    if (o.travel > 0) blocks.push({ s, e: s + o.travel, kind: o.kind, travel: true, from: home, place: o.place, mode: o.mode, label: o.label });
    blocks.push({ s: s + o.travel, e: s + o.travel + o.stay, kind: o.kind, travel: false, place: o.place, mode: null, label: o.label });
    if (o.travel > 0) blocks.push({ s: s + o.travel + o.stay, e: s + need, kind: o.kind, travel: true, from: o.place, place: home, mode: o.mode, label: `home from ${o.label}` });
    // split the window so later outings see the time as taken
    const idx = free.indexOf(w);
    free.splice(idx, 1, { s: w.s, e: s }, { s: s + need, e: w.e });
    return true;
  }
  return false;
}

const ERRAND_TASTE = (rt, persona, e) => {
  const npc = (persona && persona.npc) || {};
  const hh = npc.household || {};
  const owner = hh.tenure === 'own', house = (hh.dwelling || 'house') === 'house', age = num(rt.age, 35);
  return {
    grocery: 0.45, pharmacy: 0.1 + (age >= 60 ? 0.2 : 0), laundromat: !owner && !house ? 0.3 : 0.02,
    hardware: owner && house ? 0.22 : 0.03, 'post-office': 0.08,
  }[e.kind] ?? 0.05;
};

const STAY = { grocery: [25, 45], pharmacy: [10, 20], laundromat: [60, 90], hardware: [20, 40], 'post-office': [10, 20], beach: [120, 200], trailhead: [120, 240], water: [120, 220], park: [45, 90], stadium: [180, 210], gym: [60, 90], church: [75, 110], family: [120, 240], friends: [120, 210], run: [30, 55] };
const stayFor = (key, rng) => { const [a, b] = STAY[key] || [45, 90]; return Math.round(a + rng.float() * (b - a)); };

/** Interest-driven leisure destinations this persona would go to. */
function leisureOptions(rt, persona) {
  const P = rt.places || {};
  const ints = ((persona && persona.interests) || []).join(' | ').toLowerCase();
  const teams = (persona && persona.teams) || [];
  const out = [];
  if (P.beach && /beach|surf|sailing/.test(ints)) out.push({ place: P.beach, key: 'beach', w: /surf/.test(ints) ? 1.2 : 0.9 });
  if (P.trailhead && /hiking/.test(ints)) out.push({ place: P.trailhead, key: 'trailhead', w: 1.0 });
  if (P.water && /fishing/.test(ints)) out.push({ place: P.water, key: 'water', w: 0.9 });
  if (P.park) out.push({ place: P.park, key: 'park', w: /kids|grandkids|walking|soccer|little league/.test(ints) ? 0.8 : 0.35 });
  if (P.game && teams.length) out.push({ place: P.game, key: 'stadium', w: 0.12 });
  return out;
}

// ---------------------------------------------------------------- the plan

const PLAN_CACHE = new WeakMap();

/**
 * The plan of the Pacific day holding t.
 * @param {Object} npc       the layer 1 NPC (its seed drives the day's randomness)
 * @param {Object} persona   persona(world, npc, …) (big5, interests, practice, routine)
 * @param {number} t         epoch ms
 * @returns {ReadonlyArray<{start:number, end:number, startMin:number, endMin:number, kind:string,
 *   place:{kind:string, x:number, y:number, label:string}, mode:string|null, travel:boolean,
 *   from:{kind:string, x:number, y:number, label:string}|null, label:string, anchor?:'layer0'}>}
 *   items tiling [midnight, next midnight) in order; the array and its items are frozen (shared by a cache).
 */
export function dayPlan(npc, persona, t) {
  const day = dayInfo(t);
  const cacheKey = `${day.key}|${npc && npc.id}`;
  let byDay = persona && typeof persona === 'object' ? PLAN_CACHE.get(persona) : null;
  if (byDay && byDay.has(cacheKey)) return byDay.get(cacheKey);
  const plan = buildPlan(npc, persona, day);
  if (persona && typeof persona === 'object') {
    if (!byDay) PLAN_CACHE.set(persona, byDay = new Map());
    if (byDay.size >= 8) byDay.delete(byDay.keys().next().value);
    byDay.set(cacheKey, plan);
  }
  return plan;
}

function buildPlan(npc, persona, day) {
  const rt = routineOf(npc, persona);
  const rh = rhythmOf(npc, persona);
  const seed = num(npc && npc.seed, 7) >>> 0;
  const rng = new Rng(hashAll('day', seed, day.key));
  const home = homePlace(rt), work = workPlace(rt, npc, persona);
  const age = num(rt.age, num(npc && npc.age, 35));
  const dow = day.dow, weekend = dow === 0 || dow === 6;
  const blocks = [];

  // 1. the layer 0 commute: last night's shift if it spills past midnight, and today's
  const span = Math.round(num(rt.departMin)) + 2 * Math.round(num(rt.commuteMin)) + Math.round(num(rt.dwellMin));
  if (commuteDay(rt, day.prevDow) && span > MIN_DAY) pushShift(blocks, rt, -MIN_DAY, home, work);
  const workingToday = commuteDay(rt, dow);
  if (workingToday) {
    // A shift long enough to reach today's departure (24-hour shifts on back-to-back days) keeps them at work:
    // today's layer 0 timing still holds, yesterday's tail ends where today's shift begins, and the outbound
    // leg is a stationary one at the workplace instead of a trip from a home they never went back to.
    const dep = Math.round(rt.departMin);
    const runsOn = blocks.some(b => b.spill && b.e > dep);
    if (runsOn) for (const b of blocks) if (b.spill) b.e = Math.min(b.e, dep);
    pushShift(blocks, rt, 0, home, work, runsOn ? work : home);
  }
  if (wfhDay(rt, dow)) {
    const ws = isNum(rt.departMin) ? Math.round(rt.departMin) : clamp(rh.freeWakeMin + 75 + rng.int(30), 7 * 60, 10 * 60 + 30);
    const len = num(rt.dwellMin) > 0 ? Math.round(rt.dwellMin) : 480;
    blocks.push({ s: ws, e: ws + len, kind: 'work', travel: false, place: { kind: 'home', x: home.x, y: home.y, label: 'working from home' }, mode: null, anchor: 'layer0' });
  }
  // 2. school runs this adult drives (the household assigned them in persona.routine)
  for (const run of rt.schoolRuns || []) {
    if (!(num(run.days) & bit(dow)) || !run.school) continue;
    const school = { kind: 'school', x: run.school.x, y: run.school.y, label: `${run.childName ? run.childName + "'s" : 'the'} school` };
    const c = Math.max(1, Math.round(run.commuteMin)), dep = Math.round(run.departMin), end = dep + c + Math.round(run.dwellMin);
    const legs = [[dep, 'school drop-off'], ...(run.pickup ? [[end - c, 'school pickup']] : [])];
    for (const [s0, label] of legs) {
      const a = { s: s0, e: s0 + c, kind: 'errand', travel: true, from: home, place: school, mode: 'drive', label };
      const b = { s: s0 + c, e: s0 + 2 * c, kind: 'errand', travel: true, from: school, place: home, mode: 'drive', label: `home from the ${label}` };
      if (blocks.some(x => x.s < b.e && x.e > a.s)) continue;
      blocks.push(a, b);
    }
  }
  const clipped = blocks.map(b => Object.assign({}, b, { s: clamp(b.s, 0, MIN_DAY), e: clamp(b.e, 0, MIN_DAY) })).filter(b => b.e > b.s);

  // 3. sleep around the anchors
  const anchorsToday = clipped.slice().sort((a, b) => a.s - b.s);
  const spillEnd = Math.max(0, ...clipped.filter(b => b.spill).map(b => b.e));
  const first = firstAnchor(rt, dow);
  const todayShiftEndsLate = workingToday && span > MIN_DAY;
  const todayOwn = anchorsToday.filter(b => !b.spill);
  const lastEnd = todayOwn.length ? Math.max(...todayOwn.map(b => b.e)) : null;
  const sleeps = [];
  if (spillEnd > 0) {
    // last night's shift ran past midnight: home in the morning, sleep through the day, up before tonight's shift
    const s = spillEnd + 15;
    const tonight = workingToday ? Math.round(rt.departMin) - rh.prepMin : MIN_DAY;
    const e = Math.min(s + rh.needMin, tonight);
    if (e - s >= 120) sleeps.push({ s, e });
  } else {
    const prevLast = commuteDay(rt, day.prevDow) ? span : null;              // yesterday's shift ended before midnight
    const bedPrev = bedtime(rt, rh, day.prevDow, first, prevLast) - MIN_DAY; // last night's bedtime in today's minutes
    let wake = rh.freeWakeMin + (weekend ? 60 : 0);
    if (first !== null) wake = Math.min(wake, first - rh.prepMin);
    wake = Math.max(wake, Math.max(0, bedPrev) + 180);
    sleeps.push({ s: Math.max(0, bedPrev), e: wake });
  }
  if (age < 4) sleeps.push({ s: 13 * 60, e: 13 * 60 + 90 + rng.int(40), nap: true });
  if (!todayShiftEndsLate) {
    const nextFirst = firstAnchor(rt, day.nextDow);
    const bed = bedtime(rt, rh, dow, nextFirst, lastEnd !== null && lastEnd < MIN_DAY ? lastEnd : null);
    if (bed < MIN_DAY) sleeps.push({ s: bed, e: MIN_DAY });
  }
  const sleepBlocks = [];
  for (const sl of sleeps) for (const w of windows(clipped, sl.s, sl.e)) if (w.e - w.s >= 10) sleepBlocks.push({ s: w.s, e: w.e, kind: 'sleep', travel: false, place: home, mode: null });
  const fixed = clipped.concat(sleepBlocks);

  // 4. outings in the waking free time
  const awake = windows(fixed, 0, MIN_DAY).filter(w => w.e - w.s >= 30);
  const outings = planOutings(rt, persona, npc, day, rng, { workingToday: workingToday || wfhDay(rt, dow), weekend, age, home, anchors: anchorsToday });
  const placed = [];
  for (const o of outings) placeOuting(placed, awake, o, rng);

  // 5. home fills the rest; tile the day
  const all = fixed.concat(placed).sort((a, b) => a.s - b.s || a.e - b.e);
  const tiled = [];
  let cur = 0;
  for (const b of all) {
    if (b.e <= cur) continue;
    const s = Math.max(b.s, cur);
    if (s > cur) tiled.push({ s: cur, e: s, kind: 'home', travel: false, place: home, mode: null });
    tiled.push(Object.assign({}, b, { s }));
    cur = b.e;
  }
  if (cur < MIN_DAY) tiled.push({ s: cur, e: MIN_DAY, kind: 'home', travel: false, place: home, mode: null });
  const merged = [];
  for (const b of tiled) {
    const last = merged[merged.length - 1];
    if (last && !b.travel && !last.travel && last.kind === b.kind && last.place === b.place && !b.anchor && !last.anchor) last.e = b.e;
    else merged.push(b);
  }
  return Object.freeze(toItems(merged, day));
}

/** Outings for the day, most important first. */
function planOutings(rt, persona, npc, day, rng, ctx) {
  const { workingToday, weekend, age, home } = ctx;
  const P = rt.places || {};
  const out = [];
  const mk = (place, kind, key, stayKey, earliest, latest, label) => {
    if (!place || !isNum(place.x)) return;
    const km = distKm(rt, home, place);
    const mode = key === 'run' ? 'walk' : outingMode(rt, km); // a run or a walk starts at the front door
    out.push({ kind, place: { kind: place.kind || key, x: place.x, y: place.y, label: place.label || label || key }, from: home, mode, travel: travelMinutes(rt, km, mode), stay: stayFor(stayKey || key, rng), earliest, latest, label: label || place.label || key });
  };
  const dow = day.dow;
  const practice = persona && persona.practice;
  if (practice && dow === (num(practice.day, 0)) && P.church && rng.float() < 0.85) mk(P.church, 'worship', 'church', 'church', 8 * 60 + 30, 12 * 60 + 45, 'church');
  const littleKid = age < 5, kid = age < 13, teen = age >= 13 && age < 18;
  // leisure from interests
  const opts = leisureOptions(rt, persona);
  const leisureP = weekend ? (dow === 6 ? 0.55 : 0.45) : workingToday ? 0.08 : kid ? 0.35 : 0.3;
  if (opts.length && rng.float() < leisureP) {
    const pick = rng.weightedItem(opts, o => o.w);
    if (pick) {
      const game = pick.key === 'stadium';
      if (!game || weekend || rng.float() < 0.3) mk(pick.place, 'leisure', pick.key, pick.key, game ? 11 * 60 : weekend ? 8 * 60 : kid ? 15 * 60 : 9 * 60, game ? 21 * 60 + 30 : 19 * 60);
    }
  }
  // errands to nearby stores (adults; children tag along sometimes)
  const errands = (P.errands || []).filter(e => isNum(e.x));
  const nErr = littleKid ? (rng.float() < 0.25 ? 1 : 0) : kid ? 0 : weekend ? (rng.float() < (dow === 6 ? 0.8 : 0.4) ? 1 + (rng.float() < 0.35 ? 1 : 0) : 0)
    : workingToday ? (rng.float() < 0.35 ? 1 : 0) : (rng.float() < 0.75 ? 1 + (rng.float() < 0.35 ? 1 : 0) : 0);
  const taken = new Set();
  for (let k = 0; k < nErr && errands.length; k++) {
    const e = rng.weightedItem(errands.filter(x => !taken.has(x.kind)), x => ERRAND_TASTE(rt, persona, x));
    if (!e) break;
    taken.add(e.kind);
    mk(e, 'errand', e.kind, e.kind, workingToday && !weekend ? 16 * 60 + 30 : 9 * 60, 20 * 60 + 30, e.label);
  }
  // visits to family and friends
  const visitP = weekend ? (dow === 0 ? 0.35 : 0.3) : workingToday ? 0.05 : 0.12;
  if (P.visit && !kid && rng.float() < visitP) mk(P.visit, 'visit', P.visit.kind || 'family', P.visit.kind || 'family', 11 * 60, 21 * 60, P.visit.label);
  // exercise: a run or a walk near home, or the gym
  const b = (persona && persona.big5) || {};
  const ints = ((persona && persona.interests) || []).join(' | ').toLowerCase();
  const fit = /running|walking|the gym|surfing|hiking/.test(ints);
  const exP = (littleKid ? 0 : 0.12 + 0.25 * Math.max(0, num(b.C, 0.5) - 0.5) * 2 + (fit ? 0.25 : 0)) * (age >= 75 ? 0.8 : 1);
  if (rng.float() < exP) {
    const gym = /the gym/.test(ints) && P.gym;
    const morning = rng.float() < 0.5;
    mk(gym ? P.gym : P.park, 'exercise', gym ? 'gym' : 'run', gym ? 'gym' : 'run', morning ? 5 * 60 + 30 : 16 * 60, morning ? 11 * 60 : 21 * 60, gym ? 'the gym' : age >= 60 ? 'a walk' : 'a run');
  }
  // children and teens: the park or friends after school and on weekends
  if ((kid || teen) && P.park && rng.float() < (weekend ? 0.45 : 0.35)) mk(P.park, 'leisure', 'park', 'park', 14 * 60 + 30, 19 * 60, teen ? 'hanging out with friends' : P.park.label);
  return out;
}

function placeObj(p) { return p ? Object.freeze({ kind: p.kind, x: p.x, y: p.y, label: p.label }) : null; }

function toItems(blocks, day) {
  const items = [];
  let prevEnd = day.start;
  for (const b of blocks) {
    const start = prevEnd, end = Math.max(start, wallToMs(day, b.e));
    if (end <= start) continue;
    const item = {
      start, end, startMin: b.s, endMin: b.e, kind: b.kind,
      place: placeObj(b.place), mode: b.travel ? b.mode || 'walk' : null, travel: !!b.travel,
      from: b.travel ? placeObj(b.from) : null, label: b.label || (b.kind === 'sleep' ? 'sleep' : b.place ? b.place.label : b.kind),
    };
    if (b.anchor) item.anchor = b.anchor;
    if (b.leg) item.leg = b.leg;
    items.push(Object.freeze(item));
    prevEnd = end;
  }
  // a daylight-saving squeeze can drop the last item; the day must still end at the next midnight
  if (items.length && items[items.length - 1].end !== day.end) items[items.length - 1] = Object.freeze(Object.assign({}, items[items.length - 1], { end: day.end, endMin: MIN_DAY }));
  return items;
}

// ---------------------------------------------------------------- now

/**
 * What the NPC is doing at t: the plan item plus progress (0..1 through the item), whether they are traveling,
 * and their position: on the straight segment from item.from to item.place while traveling, else at the place.
 * @returns {Object} the item's fields plus {progress:number, traveling:boolean, position:{x:number, y:number}}
 */
export function activityAt(npc, persona, t) {
  const plan = dayPlan(npc, persona, t);
  let item = plan[plan.length - 1];
  for (const it of plan) if (t >= it.start && t < it.end) { item = it; break; }
  const span = item.end - item.start;
  const progress = span > 0 ? clamp((t - item.start) / span, 0, 1) : 0;
  const position = item.travel && item.from
    ? { x: lerp(item.from.x, item.place.x, progress), y: lerp(item.from.y, item.place.y, progress) }
    : { x: item.place.x, y: item.place.y };
  return Object.assign({}, item, { progress, traveling: !!item.travel, position });
}
