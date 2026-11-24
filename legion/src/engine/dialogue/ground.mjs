// Legion · dialogue · ground: the facts an NPC can state, each with the id of the pack fact behind it.
//
// Everything a line claims about the place comes from here: the weather now and the forecast (world.weatherAt),
// the alerts and the forecast office's key messages, the fires, atmospheric rivers, windstorms and disaster
// declarations of the ZIP and county (firesOf, arsOf, windsOf, femaOf), the climate and the station records, the
// highways as locals name them (roadsNear, roadName, namedStretch) with their traffic counts, the landmarks and
// towns nearby, the routine places the persona resolved, and a few Census shares phrased the way a neighbor
// would put them. Nothing is invented: when a datum is missing the fact is absent and the template that needs it
// is skipped.
//
// Fact ids: 'weather.now', 'weather.next', 'weather.keyMessage', 'weather.fireOutlook', 'alert:<event>',
// 'fire:<name>:<year>', 'ar:<start>', 'wind:<kind>:<start>', 'fema:<date>', 'record.heat' | 'record.rain' |
// 'record.gust', 'clim.h100' | 'clim.h90' | 'clim.tjul' | 'clim.rain' | 'clim.snow' | 'clim.flood' | 'clim.ar',
// 'fhsz', 'road:<name>', 'aadt:<name>', 'stretch:<name>', 'landmark:<name>', 'place:<name>', 'acs.lang.<key>',
// 'acs.comm.<mode>', 'acs.own', 'acs.value', 'acs.yb', 'biz.food', 'ins.fair', 'ins.nonren', 'ins.prem', and
// for the speaker's own record 'npc.occupation', 'npc.commute', 'npc.household', 'npc.residence', 'npc.origin',
// 'persona.memory', 'persona.interests', 'persona.teams'.

import { roadName, roadNames, namedStretch, fireLabel, landmarkLabel } from '../lexicon.mjs';
import { pacific, fmtClock } from '../clock.mjs';
import {
  isNum, num, str, parseDate, approx, money, miles, compass, MONTHS, lowerFirst, fmtInt,
} from './core.mjs';
import { findPlaces } from './understand.mjs';

// ------------------------------------------------------------------ weather

/**
 * Sky words that can follow "it's" or "looks" ("rainy", "mostly sunny"); null for a phrase that cannot ("a chance
 * of rain"), whose sentence then names it another way.
 * @param {string|null} words skyWords() output
 * @returns {string|null}
 */
export function skyAdj(words) {
  if (!words) return null;
  const map = { stormy: 'stormy', snowing: 'snowy', 'rain likely': 'rainy', 'showers likely': 'showery', pouring: 'really wet', raining: 'rainy' };
  if (map[words]) return map[words];
  if (/^a (slight )?chance of|^a light rain$/.test(words)) return null;
  return words;
}

/**
 * A short NWS forecast as it goes after "66 degrees and": "sunny", "partly cloudy", "foggy", "a chance of showers".
 * @param {string|null} short the NWS short forecast ("Patchy Fog", "Slight Chance Rain Showers")
 * @returns {string|null}
 */
export function skyWords(short) {
  const s = String(short || '').trim();
  if (!s) return null;
  const l = s.toLowerCase();
  if (/thunder/.test(l)) return /chance|slight/.test(l) ? 'a chance of thunderstorms' : 'stormy';
  if (/snow|flurr|blizzard/.test(l)) return /chance|slight/.test(l) ? 'a chance of snow' : 'snowing';
  if (/rain|shower|drizzle/.test(l)) {
    if (/slight chance/.test(l)) return 'a slight chance of rain';
    if (/chance/.test(l)) return /shower/.test(l) ? 'a chance of showers' : 'a chance of rain';
    if (/likely/.test(l)) return /shower/.test(l) ? 'showers likely' : 'rain likely';
    if (/drizzle/.test(l)) return 'drizzly';
    if (/light/.test(l)) return 'a light rain';
    if (/heavy/.test(l)) return 'pouring';
    return /shower/.test(l) ? 'showery' : 'raining';
  }
  if (/fog/.test(l)) return /patchy|areas/.test(l) ? 'foggy in spots' : 'foggy';
  if (/smoke/.test(l)) return 'smoky';
  if (/haze/.test(l)) return 'hazy';
  if (/blustery|windy/.test(l)) return 'windy';
  if (/breezy/.test(l)) return 'breezy';
  if (/^(mostly |partly )?(sunny|clear|cloudy)$/.test(l)) return l;
  if (/^(fair|seasonable)$/.test(l)) return l === 'fair' ? 'fair' : 'about normal for this time of year';
  if (/overcast/.test(l)) return 'overcast';
  if (/frost/.test(l)) return 'frosty';
  return l.length <= 24 ? l : null;
}

/** "noon", "midnight", "6 PM", "6:30 PM". */
export function clockWords(minuteOfDay) {
  const m = ((Math.round(minuteOfDay) % 1440) + 1440) % 1440;
  if (m === 720) return 'noon';
  if (m === 0) return 'midnight';
  return fmtClock(m).replace(':00 ', ' ');
}

/** "until noon Thursday" / "until 6 PM tonight" / "until tomorrow morning": when an alert ends, from t. */
export function untilWords(ends, t) {
  const e = Date.parse(ends);
  if (!isNum(e) || !isNum(t) || e <= t) return null;
  const a = pacific(t), b = pacific(e);
  const sameDay = a.year === b.year && a.month === b.month && a.day === b.day;
  const clock = clockWords(b.minuteOfDay);
  if (sameDay) return `until ${clock}${b.hour >= 17 ? ' tonight' : ' today'}`;
  const days = Math.round((Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 86400000);
  if (days === 1) return `until ${clock} tomorrow`;
  if (days <= 6) return `until ${clock} ${b.dayName}`;
  return `until ${b.monthName} ${b.day}`;
}

const JARGON = /\b(ensemble|guidance|model|models|nbm|gfs|ecmwf|trough|ridge|500\s?mb|mb\b|upper[- ]level|low pressure system|cutoff|cut-off|percentile|probabilit|cluster|deterministic|confidence|forecast area|cwa|nws|wfo|ivt|qpf|pops?\b|hrrr|nam\b|mos\b|isobar|vort|jet stream|layer|inversion)\b/i;

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAY_MS = 86400000;

/** Midnight (Pacific) of the day holding t, as a day number (days since the epoch, Pacific calendar). */
function pacDay(t) { const p = pacific(t); return Math.round(Date.UTC(p.year, p.month - 1, p.day) / DAY_MS); }

/** The fourth Thursday of November of a year, as a Pacific day number. */
function thanksgiving(year) {
  const first = new Date(Date.UTC(year, 10, 1)).getUTCDay();
  return Math.round(Date.UTC(year, 10, 1 + ((4 - first + 7) % 7) + 21) / DAY_MS);
}

/**
 * When a forecast sentence stops being true to say, as epoch-free {day, hour}: the last day (Pacific day number)
 * and hour it speaks of. "this morning" ends at noon of the day the office wrote it, "tonight" at six the next
 * morning, "Tuesday night" the morning after that Tuesday, "Thanksgiving" at the end of that Thursday. Null when the
 * sentence names no time (it is then as good as the forecast it came with).
 */
function sentenceEnds(s, issuedT) {
  const low = s.toLowerCase();
  const issueDay = pacDay(issuedT), issueDow = pacific(issuedT).dow;
  const ends = [];
  const at = (day, hour) => ends.push(day * 24 + hour);
  if (/\bthis morning\b/.test(low)) at(issueDay, 12);
  if (/\bthis afternoon\b/.test(low)) at(issueDay, 18);
  if (/\btoday\b/.test(low)) at(issueDay, 24);
  if (/\b(tonight|overnight)\b/.test(low)) at(issueDay + 1, 6);
  if (/\btomorrow\b/.test(low)) at(issueDay + 1, /\btomorrow night\b/.test(low) ? 30 : 24);
  // a clock time "through 11AM this morning", "until 2 PM"
  const clock = /\b(?:through|until|till|by)\s+(\d{1,2})(?::(\d\d))?\s*([ap])\.?m\.?/i.exec(s);
  if (clock && /\b(this morning|this afternoon|today|tonight)\b/i.test(s)) at(issueDay, (+clock[1] % 12) + (clock[3].toLowerCase() === 'p' ? 12 : 0));
  for (const m of low.matchAll(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)s?\b(\s+(night|evening|pm))?/g)) {
    const d = DAY_NAMES.indexOf(m[1]);
    const day = issueDay + ((d - issueDow + 7) % 7);
    at(day, m[3] ? 30 : 24);
  }
  const p = pacific(issuedT);
  if (/\bthanksgiving\b/.test(low)) {
    let tg = thanksgiving(p.year);
    if (tg < issueDay - 1) tg = thanksgiving(p.year + 1);
    at(tg + (/\bthanksgiving (holiday )?weekend\b/.test(low) ? 3 : 0), 24);
  } else if (/\b(this|the|early|holiday) weekend\b/.test(low)) at(issueDay + ((7 - issueDow) % 7), 24);
  if (/\bthis week\b|\bthe rest of the week\b|\blater (in )?(the|this) week\b/.test(low)) at(issueDay + ((7 - issueDow) % 7), 24);
  return ends.length ? Math.min(...ends) : null;
}

// Proper nouns a forecast sentence can open with: they keep their capital after "the weather service says".
const COMMON_OPENER = /^(A|An|The|Light|Heavy|Dry|Mild|Cold|Cool|Warm|Hot|Strong|Gusty|Breezy|Periods?|Temperatures|Rain|Showers|Snow|Fog|Areas|Patchy|Widespread|Some|Most|Mostly|Partly|Increasing|Decreasing|Gradual|Another|Additional|Next|High|Low|Chances?|Isolated|Scattered|Wet|Windy|Sunny|Clear|Cloudy|Moderate|Weak|Minor|Major|Little|No|Cooler|Warmer|Drier|Wetter|Freezing|Frost)\b/;
// A sentence with a finite verb reads after "says"; a headline ("Dry conditions expected through Saturday") does not.
const CLAUSE = /\b(will|is|are|was|were|could|may|might|can|should|would|brings?|builds?|moves?|continues?|remains?|returns?|looks?|appears?|has|have)\b/i;
const WEATHERY = /\b(rain|showers|dry|warm|warming|cool|cooling|cold|hot|heat|wind|winds|snow|fog|storm|temperatures|frost|freeze|sunny|clouds|mild|breezy|gusty|seasonable)\b/i;
// The alerts are told on their own, with their end times: a forecast sentence about one is not repeated.
const ALERT_TALK = /\b(advisory|advisories|warning|warnings|watch|watches|statement|updated at)\b/i;

/**
 * Items of a forecast office's key-message block, then their sentences: numbered ("1. … 2. …"), dashed (" - "),
 * bulleted or one per line, with the numbering and bullets stripped.
 * @param {string} block
 * @returns {string[]}
 */
export function keySentences(block) {
  const items = String(block || '').replace(/\r/g, '')
    .split(/\n+|(?:^|\s)[-*•]\s+(?=[A-Z])|(?:^|\s)\d{1,2}[.)]\s+(?=[A-Z])/)
    .map(x => x.replace(/^\s*(?:[-*•]|\d{1,2}[.)])\s*/, '').trim()).filter(Boolean);
  return items.flatMap(it => it.split(/(?<=[.!?])\s+(?=[A-Z])/)).map(x => x.trim().replace(/\s+\d{1,2}[.)]?$/, '').trim()).filter(Boolean);
}

/**
 * One plain sentence of the forecast office's key messages that is still true to say at time t, or null: no list
 * numbering, no jargon, no advisory (the alerts cover those), nothing about a morning or a day that has passed.
 * clause tells whether it reads as a full sentence after "the weather service says"; lower is that form, or null
 * when the sentence opens with a proper noun.
 * @param {object} wx world.weatherAt output
 * @param {number} [t] epoch ms of the conversation
 * @param {number} [issuedT] epoch ms the office wrote the message (default: t)
 * @returns {{text: string, clause: boolean, lower: string|null}|null}
 */
export function keySentence(wx, t = null, issuedT = null) {
  if (!wx || wx.stale) return null;
  const msgs = (Array.isArray(wx.keyMessages) ? wx.keyMessages : []).map(String);
  const now = isNum(t) ? t : null, issued = isNum(issuedT) ? issuedT : now;
  if (isNum(now) && isNum(issued) && now < issued - 12 * 3600000) return null; // not written yet
  const nowHour = isNum(now) ? pacDay(now) * 24 + pacific(now).hour : null;
  for (const m of msgs) {
    for (const s of keySentences(m)) {
      if (s.length < 25 || s.length > 170 || JARGON.test(s) || /\d{3,}/.test(s) || /[;:()]/.test(s) || ALERT_TALK.test(s)) continue;
      if (!WEATHERY.test(s)) continue;
      if (nowHour !== null && isNum(issued)) {
        const end = sentenceEnds(s, issued);
        if (end !== null && nowHour >= end) continue;
      }
      const text = /[.!]$/.test(s) ? s : `${s}.`;
      const clause = CLAUSE.test(s);
      return { text, clause, lower: clause && COMMON_OPENER.test(text) ? lowerFirst(text) : null };
    }
  }
  return null;
}

/** Name of a forecast period as said mid-sentence: "tonight", "tomorrow", "Tuesday night", "Thanksgiving Day". */
function periodWhen(p, t) {
  const n = String(p.name || '').trim();
  if (!n) return null;
  if (/^(today|this afternoon|this morning)$/i.test(n)) return 'later today';
  if (/^(tonight|overnight)$/i.test(n)) return 'tonight';
  const start = Date.parse(p.start);
  if (isNum(start) && isNum(t)) {
    const a = pacific(t), b = pacific(start);
    const days = Math.round((Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 86400000);
    if (days === 1) return /night/i.test(n) ? 'tomorrow night' : 'tomorrow';
  }
  return n.replace(/\bNight\b/, 'night');
}

/**
 * The weather facts for the voice's ZIP and time: now, the next periods, alerts with their end, the key message
 * and the fire and rain outlooks.
 * @param {object} v a voice
 */
export function weatherFacts(v) {
  const wx = v.wx || {};
  const now = wx.now || {};
  const temp = isNum(now.tempF) ? Math.round(now.tempF) : null;
  const sky = skyWords(now.short);
  const periods = (Array.isArray(wx.next) ? wx.next : []).slice(0, 3).map(p => ({
    when: periodWhen(p, v.t), temp: isNum(p.tempF) ? Math.round(p.tempF) : null, sky: skyWords(p.short), pop: isNum(p.pop) ? p.pop : null, isDay: !!p.isDay, name: p.name,
  })).filter(p => p.when);
  const alerts = v.alerts.map(a => ({
    event: String(a.event), severity: a.severity || null, until: untilWords(a.ends, v.t), id: `alert:${a.event}`,
    fire: /red flag|fire weather/i.test(a.event), heat: /heat/i.test(a.event), flood: /flood/i.test(a.event) && !/coastal/i.test(a.event),
    coastal: /coastal|surf|rip|beach|sneaker/i.test(a.event), wind: /wind/i.test(a.event), winter: /winter|blizzard|snow|ice/i.test(a.event),
    frost: /frost|freeze/i.test(a.event),
  }));
  // past the forecast window nothing of the snapshot's forecast is current: no periods, no key message, no outlooks
  const stale = !!wx.stale;
  const afd = v.world && v.world.weather && v.world.weather.afd && wx.office ? v.world.weather.afd[wx.office] : null;
  const issued = afd && afd.issued ? Date.parse(afd.issued) : (v.world ? v.world.snapshotTime : null);
  const key = stale ? null : keySentence(wx, v.t, isNum(issued) ? issued : null);
  // the fire and rain outlooks are for the day of the snapshot
  const dayOne = !stale && v.world && isNum(v.t) && v.t >= v.world.snapshotTime - 10 * 3600000 && v.t <= v.world.snapshotTime + 14 * 3600000;
  return {
    temp, sky, short: now.short || null, isDay: now.isDay !== false, stale, rh: isNum(now.rh) ? now.rh : null,
    cond: v.sky, periods: stale ? [] : periods, alerts, key: key ? key.text : null, keyLower: key ? key.lower : null,
    fireOutlook: dayOne && wx.fireWeather && wx.fireWeather.level > 0 ? String(wx.fireWeather.name).toLowerCase() : null,
    rainOutlook: dayOne && wx.excessiveRain && wx.excessiveRain.level > 0 ? String(wx.excessiveRain.name).replace(/\s*\(.*\)$/, '').toLowerCase() : null,
    ids: { now: 'weather.now', next: 'weather.next', key: 'weather.keyMessage', fire: 'weather.fireOutlook', rain: 'weather.rainOutlook' },
  };
}

// ------------------------------------------------------------------ fires, storms, wind, quakes, records

function memoryFor(v, source) {
  const ms = Array.isArray(v.p.memories) ? v.p.memories : [];
  return ms.find(m => m && typeof m.source === 'string' && m.source.includes(source)) || null;
}

/** Fires of the ZIP (most destructive first), each with its label, the persona's memory of it and a fact id. */
export function fireFacts(v) {
  const out = [];
  for (const f of v.world.firesOf(v.zi)) {
    const label = fireLabel(f.name);
    if (!label || !isNum(f.year)) continue;
    const dt = parseDate(f.start) || { y: f.year, m: null, d: null };
    const mem = memoryFor(v, `: ${f.name} ${f.year}`);
    out.push({
      name: f.name, label, year: f.year, dt, month: dt.m ? MONTHS[dt.m - 1] : null, acres: num(f.acres, 0), dest: num(f.dest, 0),
      destInZip: num(f.destInZip, 0), km: num(f.km, 99), pct: num(f.pct, 0), id: `fire:${f.name}:${f.year}`,
      memory: mem, lived: !!mem && mem.scope === 'zip', before: isNum(v.res.zipSince) ? f.year < v.res.zipSince : false,
    });
  }
  return out;
}

/** The fire a resident would bring up first: the one they remember best, else the most destructive one here. */
export function mainFire(v, fires = fireFacts(v)) {
  const remembered = fires.filter(f => f.memory).sort((a, b) => num(b.memory.weight) - num(a.memory.weight));
  return remembered[0] || fires[0] || null;
}

/** The nearest fire on record when none burned in the ZIP (fire_near, fire_km). */
export function nearestFire(v) {
  const z = v.z;
  const label = fireLabel(z.fire_near);
  if (!label || !isNum(z.fire_near_yr)) return null;
  return { label, year: z.fire_near_yr, km: num(z.fire_km, null), id: `fire:${z.fire_near}:${z.fire_near_yr}` };
}

/** Atmospheric rivers of category 4 and 5 for the ZIP's stretch of coast, latest first. */
export function arFacts(v) {
  return v.world.arsOf(v.zi, 12).filter(a => num(a.rank) >= 4).map(a => {
    const dt = parseDate(a.start);
    return dt ? { start: a.start, dt, rank: a.rank, hours: num(a.hours, null), id: `ar:${a.start}`, memory: memoryFor(v, `arsOf(${v.z.zip}): ${a.start}`) } : null;
  }).filter(Boolean).sort((a, b) => (b.start > a.start ? 1 : -1));
}

const FEMA_STORM = new Set(['Flood', 'Severe Storm', 'Winter Storm', 'Coastal Storm', 'Mud/Landslide', 'Severe Ice Storm', 'Snowstorm', 'Tropical Storm', 'Hurricane']);

/** FEMA declarations for the county by kind: storms (floods, severe and winter storms), fires, quakes. */
export function femaFacts(v) {
  const out = { storms: [], fires: [], quakes: [] };
  for (const f of v.world.femaOf(v.zi) || []) {
    if (!Array.isArray(f)) continue;
    const dt = parseDate(f[0]);
    if (!dt) continue;
    const title = str(f[2]) ? String(f[2]).replace(/\s+/g, ' ').trim() : null;
    const item = { date: f[0], dt, kind: f[1], title, id: `fema:${f[0]}`, memory: memoryFor(v, f[0]) };
    if (f[1] === 'Earthquake') out.quakes.push(item);
    else if (f[1] === 'Fire') out.fires.push(item);
    else if (FEMA_STORM.has(f[1])) out.storms.push(item);
  }
  return out;
}

const WIND_NAMES = { santa_ana: 'the Santa Ana winds', diablo: 'the Diablo winds', sundowner: 'the sundowner winds', mono: 'the Mono winds', winter: 'the winter windstorm', other: 'the windstorm' };

const wherePlaces = new WeakMap();

/** The place an NWS event location names ("8 S Agua Dulce" is Agua Dulce), from the pack's names, or null. Cached. */
function placeOfWhere(world, where) {
  const w = str(where);
  if (!w || !world) return null;
  let m = wherePlaces.get(world);
  if (!m) wherePlaces.set(world, m = new Map());
  if (m.has(w)) return m.get(w);
  const name = w.replace(/^\d+\s+[NSEW]{1,3}\s+/i, '').replace(/^(N|S|E|W|Ne|Nw|Se|Sw)\s+/, '').replace(/\bS\.J\./g, 'San Joaquin').trim();
  let hit = null;
  try { hit = findPlaces(world, name.replace(/\b\p{Ll}/gu, c => c.toUpperCase()))[0] || null; } catch { hit = null; }
  m.set(w, hit);
  return hit;
}

/**
 * Windstorms recorded in the county, strongest first. Each gust comes with where it was measured, which can be
 * anywhere in the event's counties (where), and how far that is from the speaker's home in km (km, null when the
 * pack does not know the place).
 */
export function windFacts(v) {
  return v.world.windsOf(v.zi, 6).map(w => {
    const dt = parseDate(w.start);
    if (!dt) return null;
    const pl = placeOfWhere(v.world, w.where);
    const km = pl && isNum(pl.x) ? v.world.distKm(v.home.x, v.home.y, pl.x, pl.y) : null;
    return { kind: w.kind, name: WIND_NAMES[w.kind] || 'the windstorm', dt, gust: num(w.gust, null), where: str(w.where), km, id: `wind:${w.kind}:${w.start}`, memory: memoryFor(v, `windsOf(${v.z.zip}): ${w.kind} ${w.start}`) };
  }).filter(Boolean);
}

/** The station records of the ZIP (persona.knowledge.records, from heat_rec_f, rain_rec_in, gust_max). */
export function recordFacts(v) {
  const out = {};
  const recs = (v.p.knowledge && Array.isArray(v.p.knowledge.records)) ? v.p.knowledge.records : [];
  for (const r of recs) {
    const dt = parseDate(r.date);
    if (!dt || !isNum(r.value)) continue;
    out[r.kind] = { value: r.value, dt, station: str(r.station), id: `record.${r.kind}`, memory: memoryFor(v, `zip ${v.z.zip}: ${r.source}`) };
  }
  return out;
}

/** The ZIP's climate numbers. */
export function climateFacts(v) {
  const z = v.z;
  return {
    h100: isNum(z.h100) ? z.h100 : null, h90: isNum(z.h90) ? z.h90 : null, tjul: isNum(z.tjul) ? z.tjul : null,
    rain: isNum(z.rain_in) ? z.rain_in : null, snow: isNum(z.snowfall_in) ? z.snowfall_in : null, snowLoad: isNum(z.snow_psf) ? z.snow_psf : null,
    flood: isNum(z.flood_n10) ? z.flood_n10 : null, ar: isNum(z.ar_n) ? z.ar_n : null,
    fhszVh: num(z.fhsz_vh, 0), fhszAny: num(z.fhsz_any, 0), offKind: z.off_kind || null,
  };
}

// ------------------------------------------------------------------ roads

/** The speaker's highways in local naming: the commute road first, then the busiest near home. */
export function roadFacts(v) {
  const out = [];
  const seen = new Set();
  const add = (r, commute) => {
    if (!r || !r.name || seen.has(r.name)) return;
    const name = localRoad(v, r);
    if (!name) return;
    seen.add(r.name);
    out.push({ road: r, name, aadt: isNum(r.aadt) && r.aadt > 0 ? r.aadt : null, distKm: num(r.distKm, null), commute, id: `road:${r.name}`, stretch: namedStretch(r, v.world, v.zi) });
  };
  const given = v.commute && v.commute.road;
  if (given && ['drive', 'carpool', 'motorcycle', 'taxi', 'bus'].includes(v.commute.mode)) add(typeof given === 'string' ? { name: given } : given, true);
  const near = v.world.roadsNear(v.home.x, v.home.y, 12).slice().sort((a, b) => num(b.aadt) / (1 + num(a.distKm) / 4) - num(a.aadt) / (1 + num(b.distKm) / 4));
  for (const r of near.slice(0, 5)) add(r, false);
  if (!out.length) for (const r of v.world.roadsNear(v.z.tx, v.z.ty, 20).slice(0, 2)) add(r, false);
  return out;
}

/** How this speaker says a road: the dialect's usual form; older SoCal and Bay drivers sometimes use the old name. */
export function localRoad(v, road, rng = null) {
  const base = roadName(road, v.key);
  if (!base) return null;
  if (rng && v.age >= 60) {
    const forms = roadNames(road, v.key, { world: v.world, zi: v.zi });
    const old = forms.find(f => /Freeway|Nimitz|Bayshore|Eastshore|MacArthur/.test(f));
    if (old && rng.chance(0.35)) return old;
  }
  return base;
}

/** "almost 290,000 cars a day". */
export function aadtWords(aadt) {
  if (!isNum(aadt) || aadt <= 0) return null;
  return `${approx(aadt)} cars a day`;
}

// ------------------------------------------------------------------ census

const LANG_NAMES = { spanish: 'Spanish', chinese: 'Chinese', vietnamese: 'Vietnamese', tagalog: 'Tagalog', korean: 'Korean', arabic: 'Arabic', french: 'French', german: 'German' };

/**
 * A share (0..1) as a neighbor says it, the subject of a plural verb: "most of my neighbors", "about a third of
 * my neighbors". Null below about one in ten.
 */
export function shareWords(share, of = 'my neighbors') {
  if (!isNum(share)) return null;
  if (share >= 0.85) return `nearly all of ${of}`;
  if (share >= 0.6) return `most of ${of}`;
  if (share >= 0.42) return `about half of ${of}`;
  if (share >= 0.29) return `about a third of ${of}`;
  if (share >= 0.21) return `about one in four of ${of}`;
  if (share >= 0.15) return `about one in six of ${of}`;
  if (share >= 0.1) return `about one in ten of ${of}`;
  return null;
}

/** Census facts for small talk: home languages (the big ones, and every share in langShare), ways to work, owners and renters, home values, the age of homes. */
export function censusFacts(v) {
  const w = v.world, zi = v.zi, z = v.z;
  const out = { langs: [], langShare: {}, modes: {}, own: null, value: null, yb: null, food: null };
  try {
    const L = w.acsNamed(zi, 'lang');
    const keys = ['english', 'spanish', 'french', 'german', 'slavic', 'indoeuro', 'korean', 'chinese', 'vietnamese', 'tagalog', 'asianpi', 'arabic', 'other'];
    const total = keys.reduce((s, k) => s + num(L[k]), 0);
    if (total >= 200) {
      for (const k of keys) out.langShare[k] = num(L[k]) / total;
      for (const [k, name] of Object.entries(LANG_NAMES)) {
        const share = num(L[k]) / total;
        if (share >= 0.1) out.langs.push({ key: k, name, share, id: `acs.lang.${k}` });
      }
    }
    out.langs.sort((a, b) => b.share - a.share);
  } catch { /* a ZIP without the block */ }
  try {
    const C = w.acsNamed(zi, 'comm');
    const workers = Object.values(C).reduce((s, x) => s + num(x), 0);
    if (workers >= 200) for (const k of Object.keys(C)) out.modes[k] = { share: num(C[k]) / workers, id: `acs.comm.${k}` };
  } catch { /* a ZIP without the block */ }
  if (isNum(z.own_sh)) out.own = { share: z.own_sh / 100, id: 'acs.own' };
  if (isNum(z.value) && z.value > 0) out.value = { value: z.value, words: z.value >= 2000001 ? money(z.value) : `about ${money(z.value)}`, id: 'acs.value' };
  if (isNum(z.yb_med) && z.yb_med > 1900) out.yb = { year: z.yb_med, decade: decadeWords(z.yb_med), id: 'acs.yb' };
  if (isNum(z.food) && isNum(z.pop) && z.pop > 0) out.food = { count: z.food, per10k: z.food / z.pop * 10000, id: 'biz.food' };
  return out;
}

/** "the fifties", "the 2000s". */
export function decadeWords(year) {
  const d = Math.floor(year / 10) * 10;
  const names = { 1900: 'the 1900s', 1910: 'the teens', 1920: 'the twenties', 1930: 'the thirties', 1940: 'the forties', 1950: 'the fifties', 1960: 'the sixties', 1970: 'the seventies', 1980: 'the eighties', 1990: 'the nineties', 2000: 'the 2000s', 2010: 'the 2010s', 2020: 'the 2020s' };
  return names[d] || `the ${d}s`;
}

/** Insurance facts of the ZIP (FAIR Plan share, non-renewals, the average premium). */
export function insuranceFacts(v) {
  const z = v.z;
  return {
    fair: isNum(z.fair_sh) ? { per100: z.fair_sh, id: 'ins.fair' } : null,
    nonren: isNum(z.nonren_sh) ? { pct: z.nonren_sh, id: 'ins.nonren' } : null,
    prem: isNum(z.prem) && z.prem > 0 ? { value: z.prem, words: money(z.prem), id: 'ins.prem' } : null,
  };
}

/** "about one in nine" for a percentage. */
export function oneIn(pct) {
  if (!isNum(pct) || pct <= 0) return null;
  if (pct >= 45) return 'about half';
  if (pct >= 30) return 'about a third';
  if (pct >= 22) return 'about one in four';
  const n = Math.round(100 / pct);
  return n <= 12 ? `about one in ${['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'][n]}` : `about one in ${n}`;
}

// ------------------------------------------------------------------ places

const ERRAND_WORDS = { grocery: 'grocery store', pharmacy: 'pharmacy', laundromat: 'laundromat', hardware: 'hardware store', 'post-office': 'post office' };

/** Places the speaker knows: the routine's beach, trail, water, park, game, gym, errands, church; landmarks and towns. */
export function placeFacts(v) {
  const r = v.routine && v.routine.places ? v.routine.places : {};
  const k = v.p.knowledge || {};
  const pt = p => (p && isNum(p.x) && isNum(p.y) ? p : null);
  const out = {
    beach: pt(r.beach), trail: pt(r.trailhead), water: pt(r.water), park: pt(r.park), game: pt(r.game), gym: pt(r.gym), church: pt(r.church),
    errands: Array.isArray(r.errands) ? r.errands.filter(pt).map(e => Object.assign({ word: ERRAND_WORDS[e.kind] || e.kind }, e)) : [],
    landmarks: (Array.isArray(k.landmarks) ? k.landmarks : []).filter(l => l && l.name).map(l => ({ ...l, label: landmarkLabel(l), id: `landmark:${l.name}` })),
    towns: (Array.isArray(k.nearbyPlaces) ? k.nearbyPlaces : []).filter(p => p && p.name).map(p => ({ ...p, id: `place:${p.name}` })),
  };
  return out;
}

/**
 * How to get from home to a point: distance, compass direction and, when one runs near both ends, a highway in
 * local naming.
 * @param {object} v
 * @param {{x: number, y: number}} to
 * @returns {{km: number, miles: string, dir: string|null, road: string|null, roadId: string|null}}
 */
export function routeTo(v, to) {
  const km = v.world.distKm(v.home.x, v.home.y, to.x, to.y);
  const dir = compass(to.x - v.home.x, to.y - v.home.y);
  let road = null, roadId = null;
  if (km >= 3) {
    const a = v.world.roadsNear(v.home.x, v.home.y, 10), b = v.world.roadsNear(to.x, to.y, 12);
    const common = a.filter(x => b.some(y => y.route === x.route && y.kind === x.kind)).sort((x, y) => num(y.aadt) - num(x.aadt));
    if (common[0]) { road = localRoad(v, common[0]); roadId = `road:${common[0].name}`; }
  }
  return { km, miles: miles(km), dir, road, roadId };
}

/** The ZIP's fire hazard share as words ("most of", "about half of"), from fhsz_vh. */
export function hazardWords(share) {
  if (!isNum(share) || share < 5) return null;
  if (share >= 85) return 'nearly all of';
  if (share >= 60) return 'most of';
  if (share >= 40) return 'about half of';
  if (share >= 25) return 'a good part of';
  return 'some of';
}

/**
 * A FEMA declaration title as a name in a sentence (after "the"): "Winter storms and mudslides 2023" → "winter
 * storms and mudslides of 2023", "Los Angeles wildfires January 2025" → "Los Angeles wildfires of January 2025".
 */
export function femaTitle(title) {
  let t = String(title || '').replace(/\s+/g, ' ').trim().replace(/^the /i, '');
  t = t.replace(/\s+((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+)?(\d{4})$/, (m, mon, y) => ` of ${mon || ''}${y}`);
  return /^(Winter|Severe|Autumn|Spring|Summer|Fall|Heavy|Flooding|Storms?|Wildfires?|Fires?|Earthquake)\b/.test(t) ? t[0].toLowerCase() + t.slice(1) : t;
}

/** "1,203 homes and buildings" → the destroyed count as said. */
export function destWords(n) {
  if (!isNum(n) || n <= 0) return null;
  if (n === 1) return 'one building';
  if (n < 10) return `${['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'][n]} buildings`;
  return `${approx(n)} homes and buildings`;
}

/** "89,551 acres" said: "almost 90,000 acres". */
export function acresWords(a) {
  if (!isNum(a) || a <= 0) return null;
  return `${approx(a)} acres`;
}

export { lowerFirst, fmtInt, miles, money };
