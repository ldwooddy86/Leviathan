// Legion · schedule: an NPC's day, minute by minute.
//
// dayPlan(npc, persona, t) lays out the Pacific calendar day holding t as a list of items that tile it exactly,
// midnight to midnight, with no gaps and no overlaps: sleep, time at home, the commute and the shift or the
// school day, errands, leisure, exercise, church and visits. The commute is layer 0's (departMin, commuteMin,
// dwellMin and the day mask from pop.householdCore, which persona.routine carries), so the crowd, the street view
// and this plan always agree on where a person is. A shift that runs past midnight spills into the next day's
// plan; one that runs into the next day's departure (24-hour shifts on back-to-back days) keeps them at work
// while today's layer 0 timing still holds.
//
// The household moves together. persona.routine.household (the same in every member's persona) says which
// adult takes which young child to school on which days (driving, walking or biking alongside, or walking them
// to the school bus stop); those legs go into the adult's plan before anything else, and a work-from-home day is
// carved around them. familyOutings(household, t) draws the day's outings the household makes together, Sunday
// church for its churchgoers and a trip with the young children (the park, the store, the beach, relatives),
// with one grown-up whose own day leaves them free; every member who goes holds the same outing at the same time.
// Children under ten never go out on their own: only to school (escorted when young) and with the household.
//
// Sleep follows a chronotype from age and personality and bends around the day's first obligation; errands go to
// nearby ZIPs with stores and restaurants; leisure comes from the persona's interests; weekends differ from
// weekdays.
//
// activityAt(npc, persona, t) is the item at t plus its progress and, while traveling, the position on the
// straight segment between the two places (the street view routes its own paths).
//
// Pure and deterministic: the randomness of a day comes from the NPC's seed (the household's outings from the
// household's key) and the calendar date.

import { Rng, hashAll, clamp, lerp } from './rng.mjs';
import { pacific, atPacific } from './clock.mjs';

/** The kinds a plan item can have. */
export const PLAN_KINDS = ['sleep', 'home', 'commute', 'work', 'school', 'errand', 'leisure', 'exercise', 'worship', 'visit'];

/** Minutes after a shift that ran past midnight (the trip home, then a day's sleep) before a person is out again. */
export const NIGHT_REST = 555;

/** Children younger than this go out only to school and with the household. */
export const ALONE_AGE = 10;

const isNum = v => typeof v === 'number' && Number.isFinite(v);
const num = (v, d = 0) => (isNum(v) ? v : d);
const MIN_DAY = 1440;
const DEFAULT_UNIT_KM = 0.1975;
const bit = dow => 1 << dow;
const overlapsAny = (list, s, e) => list.some(b => s < (b.e ?? b[1]) && e > (b.s ?? b[0]));

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

/** The day after `day` (its start is `day`'s end). */
const nextDayOf = day => dayInfo(day.end + 3600000);

// ---------------------------------------------------------------- layer 0's busy times

/**
 * Layer 0's busy intervals for a person on a day of the week, in that day's minutes ([start, end] pairs; an end
 * past midnight is kept as it is): the commute and the shift (a student's school day), and the tail of
 * yesterday's shift if it ran past midnight, followed by the sleep after it (NIGHT_REST). persona.mjs assigns the
 * school runs with this and familyOutings picks its grown-up with it, so neither ever collides with a shift.
 * @param {{departMin:number|null, commuteMin:number, dwellMin:number, days:number, mode:string|null}} x a PersonCore or a routine
 * @param {number} dow 0 Sunday .. 6 Saturday
 * @returns {number[][]}
 */
export function busyIntervals(x, dow) {
  const out = [];
  if (!x || !isNum(x.departMin) || !x.mode || x.mode === 'wfh') return out;
  const c = Math.max(0, Math.round(num(x.commuteMin))), dw = Math.max(0, Math.round(num(x.dwellMin)));
  if (!(c > 0 || dw > 0)) return out;
  const dep = Math.round(x.departMin), span = dep + 2 * c + dw;
  if (num(x.days) & bit(dow)) out.push([dep, span]);
  if ((num(x.days) & bit((dow + 6) % 7)) && span > MIN_DAY) out.push([0, span - MIN_DAY + NIGHT_REST]);
  return out;
}

// ---------------------------------------------------------------- routine and rhythm

/**
 * The routine schedule.mjs works from: persona.routine (layer 0 commute fields, school runs, the household and
 * places, built by persona.mjs), or, for a persona without one, the NPC's own commute record with a minimal set
 * of places and no household.
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
    days: num(cm.days), workZi: num(cm.workZi, -1), work, source: 'npc', m: Number.isInteger(npc && npc.m) ? npc.m : 0, home, student: null,
    worker: !!(npc && npc.occupation), shift: 'day', vehicles: num(hh.vehicles, 1), age: num(npc && npc.age, 35), density: 2000, unitKm: DEFAULT_UNIT_KM,
    schoolRuns: [], ride: null, household: null, places: { errands: [], park: { kind: 'park', label: 'the park', x: home.x + 3, y: home.y + 3 } },
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

/** The spot on a bus-riding child's way to school `stopMin` minutes from home: where they are walked to. */
function stopPoint(home, school, stopMin, commuteMin) {
  const f = clamp(stopMin / Math.max(1, commuteMin), 0, 1);
  return { kind: 'bus-stop', x: lerp(home.x, school.x, f), y: lerp(home.y, school.y, f), label: 'the school bus stop' };
}

/** "Ana's school", "Ana and Leo's school", "the kids' school". */
function schoolLabel(run) {
  const names = (run.childNames || []).filter(Boolean);
  if (names.length && names.length === (run.children || []).length) return `${names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`}'s school`;
  return (run.children || []).length > 1 ? "the kids' school" : 'the school';
}

/**
 * The blocks of one school run on a day the adult takes it (persona.routine.schoolRuns item): out with the
 * children and back alone for a drop-off, out alone and back with them for a pickup (waiting at the school while
 * siblings finish), or a short walk along the child's own way to the bus stop and back. Each leg moves exactly
 * as the child's own layer 0 leg does while they are together, so their positions agree.
 */
function runBlocks(run, home) {
  const school = { kind: 'school', x: run.school.x, y: run.school.y, label: schoolLabel(run) };
  const c = Math.max(1, Math.round(num(run.commuteMin))), k = run.stopMin ? Math.max(1, Math.round(run.stopMin)) : null;
  const mode = run.mode === 'drive' ? 'drive' : run.mode === 'bike' ? 'bike' : 'walk';
  const escort = (run.children || []).slice();
  const leg = (s, e, from, place, label, travel = true) => ({ s, e, kind: 'errand', travel, from: travel ? from : null, place, mode: travel ? mode : null, label, escort, run: run.kind });
  if (run.kind === 'drop-off') {
    const dep = Math.round(run.departMin);
    if (k) { const stop = stopPoint(home, run.school, k, c); return [leg(dep, dep + k, home, stop, 'walking to the school bus stop'), leg(dep + k, dep + 2 * k, stop, home, 'home from the bus stop')]; }
    return [leg(dep, dep + c, home, school, 'school drop-off'), leg(dep + c, dep + 2 * c, school, home, 'home from the school drop-off')];
  }
  const arrive = Math.round(run.arriveMin), leave = Math.round(run.leaveMin);
  if (k) {
    const stop = stopPoint(home, run.school, k, c), meet = leave + c - k;
    return [leg(meet - k, meet, home, stop, 'meeting the school bus'), leg(meet, meet + k, stop, home, 'home from the bus stop')];
  }
  const out = [leg(arrive - c, arrive, home, school, 'school pickup')];
  if (leave > arrive) out.push(leg(arrive, leave, null, school, 'waiting at school pickup', false));
  out.push(leg(leave, leave + c, school, home, 'home from the school pickup'));
  return out;
}

/** Bedtime on the night that starts at the end of a day of week dow, in that day's wall minutes. */
function bedtime(rh, dow, nextFirst, lastEnd) {
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

// ---------------------------------------------------------------- the household's outings

const FAMILY_STAY = { park: [60, 100], grocery: [30, 50], beach: [150, 210], family: [150, 240], church: [75, 110] };
const FAMILY_KIND = { park: 'leisure', grocery: 'errand', beach: 'leisure', family: 'visit', church: 'worship' };
const FAMILY_CACHE = new WeakMap();
// Sunday services: the hour the service starts (wall minutes)
const SERVICES = [510, 540, 570, 600, 630, 660];

/** A household member's busy times today: layer 0's day, the school runs they take, a day of work at home. */
function memberBusy(hh, x, dow) {
  const out = [];
  if (hh.layer0) {
    out.push(...busyIntervals(x, dow));
    if (x.mode === 'wfh' && x.worker && ((num(x.days) || 62) & bit(dow))) out.push([7 * 60, 18 * 60]);
    for (const leg of hh.legs || []) for (const d of leg.drivers || []) if (d.m === x.m && (num(d.days) & bit(dow)) && Array.isArray(leg.window)) out.push(leg.window);
  } else if (dow !== 0 && dow !== 6) {
    // no layer 0 at hand: grown-ups under 65 are at work and children 5 to 17 at school on weekdays
    if (num(x.age) >= 18 && num(x.age) < 65) out.push([7 * 60, 18 * 60 + 30]);
    else if (num(x.age) >= 5 && num(x.age) < 18) out.push([7 * 60 + 30, 15 * 60 + 30]);
  }
  return out;
}

/** How the household goes somewhere together: on foot nearby in town, by car when it has one, else the bus. */
function familyTrip(hh, place) {
  const km = Math.hypot(place.x - hh.home.x, place.y - hh.home.y) * num(hh.unitKm, DEFAULT_UNIT_KM);
  const mode = km < 1 && num(hh.density) >= 4000 ? 'walk' : num(hh.vehicles) > 0 ? 'drive' : km < 2 ? 'walk' : num(hh.density) >= 2500 ? 'bus' : 'carpool';
  return { mode, travel: travelMinutes({ density: hh.density }, km, mode) };
}

/** Windows (wall minutes) for an outing with young children: daytime, around school, never over a toddler's nap. */
function youngWindows(weekend, toddler) {
  const base = weekend ? [[600, 1050]] : [[570, 720], [930, 1080]];
  if (!toddler) return base;
  const out = [];
  for (const [a, b] of base) {
    if (b <= 750 || a >= 900) out.push([a, b]);
    else { if (750 > a) out.push([a, 750]); if (b > 900) out.push([900, b]); }
  }
  return out;
}

const escortRank = x => (x.worker ? (x.mode === 'wfh' ? 1 : 2) : 0);
const ROLE_ORDER = ['householder', 'spouse', 'partner', 'parent', 'relative', 'sibling', 'child', 'grandchild'];

function computeFamilyOutings(hh, day) {
  const rng = new Rng(hashAll('family', num(hh.key) >>> 0, day.key));
  const dow = day.dow, weekend = dow === 0 || dow === 6;
  const members = hh.members.filter(x => x && Number.isInteger(x.m));
  const byM = new Map(members.map(x => [x.m, x]));
  const taken = new Map(members.map(x => [x.m, []]));
  const busyAt = (x, s, e) => overlapsAny(memberBusy(hh, x, dow), s, e) || overlapsAny(taken.get(x.m), s, e);
  const P = hh.places || {};
  const out = [];
  // Sunday church for the household's churchgoers: the young ones only with a grown-up
  const goersAll = (hh.churchgoers || []).map(m => byM.get(m)).filter(Boolean);
  if (dow === 0 && P.church && goersAll.length && rng.float() < 0.85) {
    const start = SERVICES[rng.int(SERVICES.length)], stay = FAMILY_STAY.church[0] + rng.int(FAMILY_STAY.church[1] - FAMILY_STAY.church[0] + 1);
    const { mode, travel } = familyTrip(hh, P.church);
    const s = start - travel, e = start + stay + travel;
    const free = goersAll.filter(x => !busyAt(x, s, e));
    const grown = free.filter(x => num(x.age) >= 18);
    const go = free.filter(x => num(x.age) >= ALONE_AGE || grown.length);
    if (go.length) {
      out.push({ key: 'church', kind: 'worship', place: P.church, label: 'church', start: s, travel, stay, mode, members: go.map(x => x.m), escort: grown.length ? grown[0].m : null, kids: go.filter(x => num(x.age) < ALONE_AGE).map(x => x.m) });
      for (const x of go) taken.get(x.m).push([s, e]);
    }
  }
  // an outing with the young children and one grown-up whose day leaves them free
  const young = members.filter(x => isNum(x.age) && x.age < ALONE_AGE);
  if (young.length && rng.float() < (weekend ? (dow === 6 ? 0.55 : 0.4) : 0.3)) {
    const opts = [['park', 0.45], ['grocery', 0.25], ['beach', weekend ? 0.15 : 0], ['family', weekend ? 0.15 : 0]].filter(([k, w]) => w > 0 && P[k] && isNum(P[k].x));
    const pick = rng.weightedItem(opts, o => o[1]);
    if (pick) {
      const key = pick[0], place = P[key];
      const { mode, travel } = familyTrip(hh, place);
      const [a, b] = FAMILY_STAY[key], stay = a + rng.int(b - a + 1), need = 2 * travel + stay;
      const spans = youngWindows(weekend, young.some(x => x.age < 4)).filter(([w0, w1]) => w1 - w0 >= need);
      const grownUps = members.filter(x => isNum(x.age) && x.age >= 18 && x.age < 80 && x.role !== 'roommate')
        .sort((p, q) => escortRank(p) - escortRank(q) || ROLE_ORDER.indexOf(p.role) - ROLE_ORDER.indexOf(q.role) || p.m - q.m);
      for (let attempt = 0; attempt < 4 && spans.length; attempt++) {
        const [w0, w1] = spans[rng.int(spans.length)];
        const s = w0 + 5 * Math.floor(rng.float() * ((w1 - w0 - need) / 5 + 1)), e = s + need;
        const kids = young.filter(x => !busyAt(x, s, e));
        const escort = kids.length ? grownUps.find(x => !busyAt(x, s, e)) : null;
        if (!escort) continue;
        const label = key === 'park' ? (place.label || 'the park') : key === 'grocery' ? 'the grocery store' : place.label || key;
        out.push({ key, kind: FAMILY_KIND[key], place, label, start: s, travel, stay, mode, members: [escort.m, ...kids.map(x => x.m)], escort: escort.m, kids: kids.map(x => x.m) });
        break;
      }
    }
  }
  return out;
}

/**
 * The outings a household makes together on the Pacific day holding t: Sunday church for its churchgoers (the
 * young ones only with a grown-up) and, on some days, a trip with the children under ten (the park, the grocery
 * store, the beach, relatives) with the first grown-up of the household whose layer 0 day, school runs and
 * work at home leave them free. Deterministic in the household's key and the date, so every member's plan
 * holds the same outing at the same time and place.
 * @param {Object|null} household  persona.routine.household
 * @param {number|Object} t        epoch ms (or a dayInfo)
 * @returns {{key:string, kind:string, place:Object, label:string, start:number, travel:number, stay:number, mode:string,
 *   members:number[], escort:number|null, kids:number[]}[]} start in wall minutes (leaving home)
 */
export function familyOutings(household, t) {
  if (!household || !Array.isArray(household.members) || !household.home) return [];
  const day = typeof t === 'object' && t && isNum(t.key) ? t : dayInfo(t);
  let byDay = FAMILY_CACHE.get(household);
  if (byDay && byDay.has(day.key)) return byDay.get(day.key);
  const out = computeFamilyOutings(household, day);
  if (!byDay) FAMILY_CACHE.set(household, byDay = new Map());
  if (byDay.size >= 16) byDay.delete(byDay.keys().next().value);
  byDay.set(day.key, out);
  return out;
}

/** The blocks of a household outing for member me: out together, the stay, back together. */
function outingBlocks(o, home, me, hh) {
  const kid = (o.kids || []).includes(me);
  const names = (o.kids || []).map(m => { const x = hh.members.find(y => y.m === m); return x && x.name; });
  const withKids = !kid && (o.kids || []).length && o.key !== 'church'
    ? ` with ${names.every(Boolean) ? (names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`) : o.kids.length === 1 ? 'the little one' : 'the kids'}` : '';
  const label = `${o.label}${withKids}`;
  const place = { kind: o.place.kind || o.key, x: o.place.x, y: o.place.y, label: o.label };
  const escort = o.members.slice();
  const s = o.start, a = s + o.travel, b = a + o.stay, e = b + o.travel;
  const out = [];
  if (o.travel > 0) out.push({ s, e: a, kind: o.kind, travel: true, from: home, place, mode: o.mode, label, escort, together: o.key });
  out.push({ s: a, e: b, kind: o.kind, travel: false, place, mode: null, label, escort, together: o.key });
  if (o.travel > 0) out.push({ s: b, e, kind: o.kind, travel: true, from: place, place: home, mode: o.mode, label: `home from ${label}`, escort, together: o.key });
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
 *   from:{kind:string, x:number, y:number, label:string}|null, label:string, anchor?:'layer0', leg?:'out'|'back',
 *   escort?:number[], run?:'drop-off'|'pickup', together?:string}>}
 *   items tiling [midnight, next midnight) in order; the array and its items are frozen (shared by a cache).
 *   escort lists the household members (by m) on a school run or a household outing with them; run marks a
 *   school-run leg, together a household outing.
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

const memberOf = (rt, npc) => (Number.isInteger(rt.m) ? rt.m : Number.isInteger(npc && npc.m) ? npc.m : 0);

/** The day's fixed blocks before sleep: layer 0, the school runs, the household's outings, work at home. */
function fixedBlocks(rt, npc, day, rh, rng, home, work) {
  const dow = day.dow, me = memberOf(rt, npc);
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
  // 2. the school runs this adult takes today (persona.mjs assigned them around layer 0, so they fit)
  const clash = legs => legs.some(b => overlapsAny(blocks, b.s, b.e));
  for (const run of rt.schoolRuns || []) {
    if (!(num(run.days) & bit(dow)) || !run.school) continue;
    const legs = runBlocks(run, home);
    if (!clash(legs)) blocks.push(...legs);
  }
  // 3. the household's outings today that include them
  if (rt.household) {
    for (const o of familyOutings(rt.household, day)) {
      if (!o.members.includes(me)) continue;
      const legs = outingBlocks(o, home, me, rt.household);
      if (!clash(legs)) blocks.push(...legs);
    }
  }
  // 4. a day of work at home, carved around the school runs and outings (they step out and come back)
  if (wfhDay(rt, dow)) {
    const ws = isNum(rt.departMin) ? Math.round(rt.departMin) : clamp(rh.freeWakeMin + 75 + rng.int(30), 7 * 60, 10 * 60 + 30);
    const len = num(rt.dwellMin) > 0 ? Math.round(rt.dwellMin) : 480;
    const place = { kind: 'home', x: home.x, y: home.y, label: 'working from home' };
    for (const w of windows(blocks, ws, Math.min(ws + len, MIN_DAY))) if (w.e - w.s >= 10) blocks.push({ s: w.s, e: w.e, kind: 'work', travel: false, place, mode: null, anchor: 'layer0' });
  }
  return { blocks, span, workingToday };
}

/** Minute the day's first fixed obligation starts (for wake times; before 2 PM), or null. */
function firstAnchor(rt, npc, day) {
  const dow = day.dow, me = memberOf(rt, npc);
  let a = null;
  const take = v => { if (isNum(v) && v < 14 * 60 && (a === null || v < a)) a = Math.round(v); };
  if (commuteDay(rt, dow)) take(rt.departMin);
  else if (wfhDay(rt, dow) && isNum(rt.departMin)) take(rt.departMin);
  for (const run of rt.schoolRuns || []) {
    if (!(num(run.days) & bit(dow))) continue;
    if (run.kind === 'drop-off') take(run.departMin);
    else take(run.stopMin ? run.leaveMin + run.commuteMin - 2 * run.stopMin : run.arriveMin - run.commuteMin);
  }
  if (rt.household) for (const o of familyOutings(rt.household, day)) if (o.members.includes(me)) take(o.start);
  return a;
}

function buildPlan(npc, persona, day) {
  const rt = routineOf(npc, persona);
  const rh = rhythmOf(npc, persona);
  const seed = num(npc && npc.seed, 7) >>> 0;
  const rng = new Rng(hashAll('day', seed, day.key));
  const home = homePlace(rt), work = workPlace(rt, npc, persona);
  const age = num(rt.age, num(npc && npc.age, 35));
  const dow = day.dow, weekend = dow === 0 || dow === 6;
  const { blocks, span, workingToday } = fixedBlocks(rt, npc, day, rh, rng, home, work);
  const clipped = blocks.map(b => Object.assign({}, b, { s: clamp(b.s, 0, MIN_DAY), e: clamp(b.e, 0, MIN_DAY) })).filter(b => b.e > b.s);

  // 5. sleep around the anchors
  const spillEnd = Math.max(0, ...clipped.filter(b => b.spill).map(b => b.e));
  const first = firstAnchor(rt, npc, day);
  const todayShiftEndsLate = workingToday && span > MIN_DAY;
  const todayOwn = clipped.filter(b => !b.spill);
  const lastEnd = todayOwn.length ? Math.max(...todayOwn.map(b => b.e)) : null;
  const sleeps = [];
  if (spillEnd > 0) {
    // last night's shift ran past midnight: home in the morning, sleep through the day, up before tonight's shift
    const s = spillEnd + 15;
    const tonight = workingToday ? Math.round(rt.departMin) - rh.prepMin : MIN_DAY;
    const e = Math.min(s + rh.needMin, tonight);
    if (e - s >= 120) sleeps.push({ s, e });
  } else {
    const prevLast = commuteDay(rt, day.prevDow) ? span : null;            // yesterday's shift ended before midnight
    const bedPrev = bedtime(rh, day.prevDow, first, prevLast) - MIN_DAY;   // last night's bedtime in today's minutes
    let wake = rh.freeWakeMin + (weekend ? 60 : 0);
    if (first !== null) wake = Math.min(wake, first - rh.prepMin);
    wake = Math.max(wake, Math.max(0, bedPrev) + 180);
    sleeps.push({ s: Math.max(0, bedPrev), e: wake });
  }
  if (age < 4) sleeps.push({ s: 13 * 60, e: 13 * 60 + 90 + rng.int(40), nap: true });
  if (!todayShiftEndsLate) {
    const bed = bedtime(rh, dow, firstAnchor(rt, npc, nextDayOf(day)), lastEnd !== null && lastEnd < MIN_DAY ? lastEnd : null);
    if (bed < MIN_DAY) sleeps.push({ s: bed, e: MIN_DAY });
  }
  const sleepBlocks = [];
  for (const sl of sleeps) for (const w of windows(clipped, sl.s, sl.e)) if (w.e - w.s >= 10) sleepBlocks.push({ s: w.s, e: w.e, kind: 'sleep', travel: false, place: home, mode: null });
  const fixed = clipped.concat(sleepBlocks);

  // 6. their own outings in the waking free time (none for young children: they go out with the household)
  const awake = windows(fixed, 0, MIN_DAY).filter(w => w.e - w.s >= 30);
  const outings = age < ALONE_AGE ? [] : planOutings(rt, persona, npc, day, rng, { workingToday: workingToday || wfhDay(rt, dow), weekend, age, home });
  const placed = [];
  for (const o of outings) placeOuting(placed, awake, o, rng);

  // 7. home fills the rest; tile the day
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
    if (last && !b.travel && !last.travel && last.kind === b.kind && last.place === b.place && !b.anchor && !last.anchor && !b.escort && !last.escort) last.e = b.e;
    else merged.push(b);
  }
  return Object.freeze(toItems(merged, day));
}

/** Their own outings for the day (people ten and older), most important first. */
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
  // church: with the household (familyOutings) when the routine has one; on their own otherwise
  if (!rt.household && practice && dow === (num(practice.day, 0)) && P.church && rng.float() < 0.85) mk(P.church, 'worship', 'church', 'church', 8 * 60 + 30, 12 * 60 + 45, 'church');
  const kid = age < 13, teen = age >= 13 && age < 18;
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
  // errands to nearby stores (grown-ups and teens)
  const errands = (P.errands || []).filter(e => isNum(e.x));
  const nErr = kid ? 0 : weekend ? (rng.float() < (dow === 6 ? 0.8 : 0.4) ? 1 + (rng.float() < 0.35 ? 1 : 0) : 0)
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
  const exP = (0.12 + 0.25 * Math.max(0, num(b.C, 0.5) - 0.5) * 2 + (fit ? 0.25 : 0)) * (age >= 75 ? 0.8 : 1);
  if (rng.float() < exP) {
    const gym = /the gym/.test(ints) && P.gym;
    const morning = rng.float() < 0.5;
    mk(gym ? P.gym : P.park, 'exercise', gym ? 'gym' : 'run', gym ? 'gym' : 'run', morning ? 5 * 60 + 30 : 16 * 60, morning ? 11 * 60 : 21 * 60, gym ? 'the gym' : age >= 60 ? 'a walk' : 'a run');
  }
  // older children and teens: the park or friends after school and on weekends
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
    if (b.escort) item.escort = Object.freeze(b.escort.slice());
    if (b.run) item.run = b.run;
    if (b.together) item.together = b.together;
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
