// Legion · the street view's fallback day planner.
//
// When the schedule module is not wired in (planFor absent), the street view still needs to know who is out and
// where they are going. This planner reads only layer 0 of the population: the commute fields every PersonCore
// carries (departMin, commuteMin, dwellMin, days, mode, work point), and adds a few deterministic errands, walks
// and evenings out by hash of the person and the day. It answers with the contract's activity shape, so the
// simulation treats it exactly like schedule.activityAt:
//   {kind, place:{x, y, kind, label}, start, end, mode, progress, origin, position?, purpose}
// Travel legs have kind 'commute' (with `purpose` saying what for) and a `position` interpolated between origin
// and place; stays have the place's kind. Times are epoch ms; places are world units. Deterministic and DOM-free.

import { hash2, hash3, u01, clamp } from '../engine/rng.mjs';
import { pacific, dayStart } from '../engine/clock.mjs';

const MIN = 60000;
const CAR = new Set(['drive', 'carpool', 'motorcycle', 'taxi']);

/**
 * True when an activity is a trip (the person is on the move). The schedule module flags trips with `traveling`
 * (activityAt) or `travel` (dayPlan items) and gives every item a position, so the flags decide; activities
 * without flags count as trips when their kind is 'commute'.
 */
export function isTravel(act) {
  if (!act) return false;
  if (typeof act.traveling === 'boolean') return act.traveling;
  if (typeof act.travel === 'boolean') return act.travel;
  return act.kind === 'commute' || act.kind === 'travel';
}

/** Where a trip started: `origin` (the fallback planner) or `from` (the schedule module). */
export function originOf(act) { return (act && (act.origin || act.from)) || null; }

/** Normalize an activity's start and end to epoch ms (schedules may use minutes of the day). */
export function normalizeActivity(act, t) {
  if (!act) return null;
  const out = Object.assign({}, act);
  const d0 = dayStart(t);
  for (const k of ['start', 'end']) {
    const v = out[k];
    if (typeof v === 'number' && v < 1e11) out[k] = d0 + v * MIN;       // minutes of the day
    else if (typeof v === 'string') out[k] = Date.parse(v);
  }
  if (!(out.end > out.start)) out.end = (out.start || t) + 30 * MIN;
  if (typeof out.progress !== 'number') out.progress = clamp((t - out.start) / (out.end - out.start), 0, 1);
  return out;
}

/**
 * A planner over layer 0: (npcId, t) → activity. Households are cached (layer 0 is cheap, but a street view asks
 * about the same few thousand people over and over).
 * @param {object} world
 * @param {object} population
 * @param {{seed?: number, cache?: number}} [opts]
 * @returns {((id: string, t: number) => object|null) & {dayPlan: (id: string, t: number) => object[]}}
 */
export function createFallbackPlanner(world, population, { seed = 0x57ee7, cache = 30000 } = {}) {
  const lru = new Map();
  const core = (zi, h) => {
    const key = zi * 1048576 + h;
    let c = lru.get(key);
    if (c) return c;
    c = population.householdCore(zi, h);
    if (lru.size >= cache) lru.delete(lru.keys().next().value);
    lru.set(key, c);
    return c;
  };
  const parse = id => {
    const m = /^(\d{5})-(\d+)-(\d+)$/.exec(String(id));
    if (!m) return null;
    const zi = world.indexOf(m[1]);
    return zi < 0 ? null : { zi, h: +m[2], m: +m[3] };
  };

  /** The items of the Pacific day holding t for one person (start/end epoch ms). */
  function dayItems(zi, h, mi, t) {
    const hh = core(zi, h), p = hh.members[mi];
    if (!p) return [];
    const d0 = dayStart(t), pc = pacific(t), dayNo = Math.floor((d0 + 8 * 3600000) / 86400000);
    const ps = hash3(seed, zi, h * 16 + mi);
    const home = { x: hh.home.x, y: hh.home.y, kind: 'home', label: 'home' };
    const items = [];
    const at = m => d0 + m * MIN;
    const push = (s, e, kind, place, mode, extra) => { if (e > s) items.push(Object.assign({ start: at(s), end: at(e), kind, place, mode: mode || null }, extra || {})); };
    let cursor = 0;
    // yesterday's night shift may still be running: its items keep their real times (before today's midnight)
    const prevDay = prevShift(p, pc.dow, ps, dayNo);
    if (prevDay) {
      const work = workPlace(p, hh);
      if (prevDay.leave > 1440) push(prevDay.arr - 1440, prevDay.leave - 1440, workKind(p), work, null);
      push(prevDay.leave - 1440, prevDay.back - 1440, 'commute', home, p.mode, { origin: work, purpose: 'home' });
      cursor = prevDay.back - 1440;
    }
    const commuteDay = p.departMin != null && p.mode && p.mode !== 'wfh' && p.work && (p.days & (1 << pc.dow));
    if (commuteDay) {
      const j = Math.round((u01(hash2(ps, dayNo)) - 0.5) * 16);
      const dep = clamp(p.departMin + j, cursor, 1439);
      const cm = Math.max(4, p.commuteMin || 15);
      const arr = dep + cm, leave = arr + Math.max(30, p.dwellMin || 480);
      const jr = Math.round((u01(hash2(ps, dayNo + 7)) - 0.3) * 20);
      const back = leave + cm + Math.max(0, jr);
      const work = workPlace(p, hh);
      // a shift that runs past midnight keeps its full length; tomorrow's plan picks it up as yesterday's
      push(dep, arr, 'commute', work, p.mode, { origin: home, purpose: workKind(p) });
      push(arr, leave, workKind(p), work, null);
      push(leave, back, 'commute', home, p.mode, { origin: work, purpose: 'home' });
      cursor = back;
      // an errand on the way home, some days
      if (back < 1260 && p.age >= 18 && u01(hash2(ps, dayNo * 3 + 1)) < 0.22) cursor = errand(items, push, at, p, hh, home, ps, dayNo, back + 20 + Math.floor(u01(hash2(ps, dayNo + 11)) * 60), 'errand');
    } else if (p.age >= 16) {
      // a day off or a day at home: errands, a walk, maybe an evening out
      const wk = pc.dow === 0 || pc.dow === 6;
      const pErr = p.age >= 70 ? 0.42 : wk ? 0.62 : 0.5;
      if (u01(hash2(ps, dayNo * 5 + 2)) < pErr) {
        const s = (wk ? 600 : 570) + Math.floor(u01(hash2(ps, dayNo * 5 + 3)) * (wk ? 420 : 450));
        cursor = Math.max(cursor, errand(items, push, at, p, hh, home, ps, dayNo, Math.max(cursor, s), 'errand', cursor));
      }
    }
    // a walk (dogs, exercise) for some adults, morning or evening
    if (p.age >= 20 && p.age <= 85 && u01(hash2(ps, dayNo * 13 + 5)) < 0.2) {
      const morning = u01(hash2(ps, dayNo * 13 + 6)) < 0.45;
      const s = morning ? 390 + Math.floor(u01(hash2(ps, dayNo * 13 + 7)) * 120) : 1050 + Math.floor(u01(hash2(ps, dayNo * 13 + 7)) * 150);
      const len = 20 + Math.floor(u01(hash2(ps, dayNo * 13 + 8)) * 25);
      if (fits(items, at(s), at(s + len))) push(s, s + len, 'exercise', home, 'walk', { loop: true, travel: true, origin: home, purpose: 'walk', dog: u01(hash2(ps, 99)) < 0.35 });
    }
    // an evening out for some adults on weekends and some weeknights
    if (p.age >= 18 && u01(hash2(ps, dayNo * 17 + 9)) < ((pc.dow === 5 || pc.dow === 6) ? 0.22 : 0.08)) {
      const s = 1080 + Math.floor(u01(hash2(ps, dayNo * 17 + 10)) * 120);
      errand(items, push, at, p, hh, home, ps, dayNo + 5000, s, 'leisure');
    }
    // fill the gaps with home (sleep at night)
    items.sort((a, b) => a.start - b.start);
    const out = [];
    let c = d0;
    for (const it of items) {
      if (it.start > c) splitHome(out, c, it.start, d0, home);
      if (it.end > c) { out.push(it); c = it.end; }
    }
    if (c < d0 + 1440 * MIN) splitHome(out, c, d0 + 1440 * MIN, d0, home);
    return out;
  }

  /** Errand: go somewhere near home, stay, come back. Returns the minute of day after returning. */
  function errand(items, push, at, p, hh, home, ps, dayNo, s, kind, notBefore = 0) {
    const r = hash2(ps, dayNo * 31 + (kind === 'leisure' ? 77 : 5));
    const dens = world.z.density[hh.zi] || 1000;
    const dKm = clamp((dens > 12000 ? 0.35 : dens > 4000 ? 0.6 : 1.4) * Math.exp((u01(r) - 0.3) * 1.6) * (kind === 'leisure' ? 2.2 : 1), 0.15, 12);
    const ang = u01(hash2(r, 1)) * Math.PI * 2;
    const ku = world.kmUnit;
    const dest = { x: hh.home.x + Math.cos(ang) * dKm * ku, y: hh.home.y + Math.sin(ang) * dKm * ku, kind: kind === 'leisure' ? 'leisure' : 'shop', label: kind === 'leisure' ? 'an evening out' : 'errands' };
    const mode = dKm < 0.9 && (dens > 7000 || hh.vehicles === 0) ? 'walk' : hh.vehicles > 0 ? (CAR.has(p.mode) ? p.mode : 'drive') : dKm < 3 ? 'walk' : 'bus';
    const speed = mode === 'walk' ? 4.8 : mode === 'bus' ? 14 : 28;            // km/h door to door
    const tt = Math.max(4, Math.round(dKm / speed * 60 + (mode === 'walk' ? 0 : 3)));
    const stay = kind === 'leisure' ? 60 + Math.floor(u01(hash2(r, 2)) * 90) : 20 + Math.floor(u01(hash2(r, 3)) * 55);
    s = Math.max(s, notBefore);
    const e1 = s + tt, e2 = e1 + stay, e3 = e2 + tt;
    if (e3 >= 1440 || !fits(items, at(s), at(e3))) return s;
    push(s, e1, 'commute', dest, mode, { origin: home, purpose: kind });
    push(e1, e2, kind === 'leisure' ? 'leisure' : 'errand', dest, null);
    push(e2, e3, 'commute', home, mode, { origin: dest, purpose: 'home' });
    return e3;
  }

  function planner(id, t) {
    const q = parse(id);
    if (!q) return null;
    const items = dayItems(q.zi, q.h, q.m, t);
    const it = items.find(x => x.start <= t && t < x.end) || items[items.length - 1];
    if (!it) return null;
    const out = Object.assign({}, it, { place: Object.assign({}, it.place) });
    out.progress = clamp((t - it.start) / Math.max(1, it.end - it.start), 0, 1);
    out.traveling = it.kind === 'commute' || it.travel === true;
    out.travel = out.traveling;
    if (out.traveling && it.origin && !it.loop) {
      const f = out.progress;
      out.position = { x: it.origin.x + (it.place.x - it.origin.x) * f, y: it.origin.y + (it.place.y - it.origin.y) * f };
    } else out.position = { x: it.place.x, y: it.place.y };
    return out;
  }
  planner.dayPlan = (id, t) => { const q = parse(id); return q ? dayItems(q.zi, q.h, q.m, t) : []; };
  planner.core = core;
  return planner;
}

/** True when [s, e) overlaps none of the day's items. */
function fits(items, s, e) {
  return !items.some(it => it.start < e && s < it.end);
}

function splitHome(out, s, e, d0, home) {
  const night = d0 + 360 * MIN, late = d0 + 1380 * MIN;
  const cut = [s];
  if (s < night && e > night) cut.push(night);
  if (s < late && e > late) cut.push(late);
  cut.push(e);
  for (let i = 0; i + 1 < cut.length; i++) {
    const a = cut[i], b = cut[i + 1];
    const mid = (a + b) / 2;
    const kind = mid < night || mid >= late ? 'sleep' : 'home';
    out.push({ start: a, end: b, kind, place: home, mode: null });
  }
}

function workKind(p) { return p.student && p.student !== 'college' && p.student !== 'grad' ? 'school' : p.student ? 'school' : 'work'; }
function workPlace(p, hh) {
  const w = p.work || hh.home;
  return { x: w.x, y: w.y, kind: workKind(p) === 'school' ? 'school' : 'work', label: workKind(p) === 'school' ? 'school' : 'work' };
}

/** Yesterday's shift that runs past midnight: {leave, back} in minutes from yesterday's midnight, or null. */
function prevShift(p, dow, ps, dayNo) {
  if (p.departMin == null || !p.mode || p.mode === 'wfh' || !p.work) return null;
  const y = (dow + 6) % 7;
  if (!(p.days & (1 << y))) return null;
  const j = Math.round((u01(hash2(ps, dayNo - 1)) - 0.5) * 16);
  const dep = clamp(p.departMin + j, 0, 1439);
  const cm = Math.max(4, p.commuteMin || 15);
  const leave = dep + cm + Math.max(30, p.dwellMin || 480);
  const jr = Math.round((u01(hash2(ps, dayNo - 1 + 7)) - 0.3) * 20);
  const back = leave + cm + Math.max(0, jr);
  return back > 1440 ? { arr: dep + cm, leave, back } : null;
}

export { CAR };
