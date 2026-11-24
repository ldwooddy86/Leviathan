// Legion · lexicon · line tags: when, where and for whom a line is true.
//
// Most lines are true for anyone, any day ("Construction on {road} again."). Some are only true at a time of
// year ("June Gloom, every single day."), a time of day ("Morning!"), in some weather ("Hot enough for you?"),
// in a place ("Gray here at the coast, and I bet the sun's out inland."), or for some speakers ("My landlord
// raised the rent again." needs a renter; "Born and raised." someone who grew up here). The content files mark
// those lines with leading tags, and the dialogue engine passes the situation and the speaker, so an NPC never
// says something the world pack or its own record contradicts.
//
// Tag grammar (one or more leading tokens, then the line):
//   @m6-8          the line says it is one of these months now (1-12, inclusive; ranges wrap: @m11-2); @m8 one month
//   @h4-11         the line assumes this local hour (0-23, inclusive; ranges wrap: @h20-3)
//   @wx:fog,heat   the line assumes the current weather condition is one of these (WEATHER_CONDITIONS)
//   @alert:redflag the line says an NWS alert of this kind is in effect (ALERT_KINDS)
//   @offshore      the line says offshore winds (Santa Ana, Diablo, sundowner) are blowing
//   @coast @inland the speaker lives within COAST_KM of the ocean or the bay (the pack's coast_km), or farther
//   @county:San_Bernardino|Riverside   the speaker lives in one of these counties (underscores for spaces), for
//                  lines that claim a place a dialect only partly covers ("909 forever.")
//   @anytime       the line names a season or month but is true all year (a habit, a memory, an opinion)
//   @drives @works @owns @rents @parent @adult @native @rooted   what the line presupposes about the speaker
//
// Situational tags (months, hours, weather, alerts, offshore, coast, inland and county) need the situation:
// when the caller does not say what it is, the line is left out. Speaker tags need the speaker: when a fact is unknown,
// an adult is assumed to fit and a minor is not (see SPEAKER_NEEDS).

import { pacific } from '../clock.mjs';

/** Weather conditions every dialect has lines for (see weatherCondition in lexicon.mjs). */
export const WEATHER_CONDITIONS = Object.freeze(['fog', 'heat', 'rain', 'wind', 'cold', 'smoke', 'snow', 'clear']);

/** Distance from the ocean, in km, within which a speaker counts as living on the coast (@coast). */
export const COAST_KM = 10;

// NWS alert events by kind. Coastal and lakeshore flooding is surf and tides, not a flash flood.
const ALERT_TESTS = {
  redflag: ev => /red flag|fire weather/i.test(ev),
  flashflood: ev => /flood/i.test(ev) && !/coastal|lakeshore/i.test(ev),
  frost: ev => /frost|freeze/i.test(ev),
  heat: ev => /heat/i.test(ev),
  wind: ev => /wind|red flag/i.test(ev),
  winter: ev => /winter|blizzard|ice storm|snow/i.test(ev),
};

/** The alert kinds a line can require with @alert:<kind>. */
export const ALERT_KINDS = Object.freeze(Object.keys(ALERT_TESTS));

const ageOf = c => (Number.isFinite(c.age) ? c.age : 40);

/**
 * What each speaker tag presupposes, and how it is checked against the speaker facts the caller passes
 * ({age, drives, works, tenure, parent, nativeHere, generation}; see speakerFacts in lexicon.mjs). A fact the
 * caller leaves undefined counts as fitting for an adult and not for a minor.
 * @type {Readonly<Record<string, {means: string, test: (c: object) => boolean}>>}
 */
export const SPEAKER_NEEDS = Object.freeze({
  adult: { means: 'the speaker is 18 or older', test: c => ageOf(c) >= 18 },
  drives: { means: 'the speaker drives', test: c => (c.drives === true ? ageOf(c) >= 15 : c.drives === false ? false : ageOf(c) >= 18) },
  works: { means: 'the speaker has a job (and so a paycheck, a workplace, a commute)', test: c => (c.works === true ? ageOf(c) >= 14 : c.works === false ? false : ageOf(c) >= 18) },
  owns: { means: 'the speaker owns their home', test: c => ageOf(c) >= 18 && (c.tenure === 'own' || c.tenure === undefined) },
  rents: { means: 'the speaker pays rent', test: c => ageOf(c) >= 18 && (c.tenure === 'rent' || c.tenure === undefined) },
  parent: { means: 'the speaker is raising children', test: c => (c.parent === true ? ageOf(c) >= 16 : c.parent === false ? false : ageOf(c) >= 25) },
  native: { means: 'the speaker was born or grew up here', test: c => c.nativeHere !== false },
  rooted: { means: "the speaker grew up here and the family goes back generations", test: c => c.nativeHere !== false && !(Number.isFinite(c.generation) && c.generation < 3) },
});

const SITUATION_FLAGS = new Set(['offshore', 'coast', 'inland', 'anytime']);

function range(a, b, lo, hi, what, line) {
  const x = +a, y = b === undefined ? x : +b;
  if (!(Number.isInteger(x) && Number.isInteger(y) && x >= lo && x <= hi && y >= lo && y <= hi)) throw new Error(`lexicon: bad ${what} tag in "${line}"`);
  const out = [];
  for (let v = x; ; v = v === hi ? lo : v + 1) { out.push(v); if (v === y) break; }
  return out;
}

/**
 * Split a content line into its leading tags and its text. Throws on an unknown or malformed tag, so a typo
 * fails at import rather than silently changing who can say a line.
 * @param {string} line
 * @returns {{text: string, tags: Readonly<{months: number[]|null, hours: number[]|null, wx: string[]|null, alerts: string[]|null, counties: string[]|null, flags: string[], needs: string[]}>|null}}
 */
export function parseTagged(line) {
  let rest = String(line).trim();
  if (!rest.startsWith('@')) return { text: rest, tags: null };
  const t = { months: null, hours: null, wx: null, alerts: null, counties: null, flags: [], needs: [] };
  let m;
  while ((m = /^(@\S+)\s+/.exec(rest))) {
    const tok = m[1];
    rest = rest.slice(m[0].length);
    let r;
    if ((r = /^@m(\d{1,2})(?:-(\d{1,2}))?$/.exec(tok))) t.months = range(r[1], r[2], 1, 12, 'month', line);
    else if ((r = /^@h(\d{1,2})(?:-(\d{1,2}))?$/.exec(tok))) t.hours = range(r[1], r[2], 0, 23, 'hour', line);
    else if ((r = /^@wx:([a-z,]+)$/.exec(tok))) {
      t.wx = r[1].split(',');
      for (const w of t.wx) if (!WEATHER_CONDITIONS.includes(w)) throw new Error(`lexicon: unknown weather "${w}" in "${line}"`);
    } else if ((r = /^@alert:([a-z]+)$/.exec(tok))) {
      if (!ALERT_TESTS[r[1]]) throw new Error(`lexicon: unknown alert kind "${r[1]}" in "${line}"`);
      (t.alerts || (t.alerts = [])).push(r[1]);
    } else if ((r = /^@county:([A-Za-z_|]+)$/.exec(tok))) {
      t.counties = r[1].split('|').filter(Boolean).map(s => s.replace(/_/g, ' '));
      if (!t.counties.length) throw new Error(`lexicon: empty county tag in "${line}"`);
    } else if (SITUATION_FLAGS.has(tok.slice(1))) t.flags.push(tok.slice(1));
    else if (SPEAKER_NEEDS[tok.slice(1)]) t.needs.push(tok.slice(1));
    else throw new Error(`lexicon: unknown tag ${tok} in "${line}"`);
  }
  if (rest.startsWith('@')) throw new Error(`lexicon: a tagged line has no text: "${line}"`);
  if (t.flags.includes('coast') && t.flags.includes('inland')) throw new Error(`lexicon: a line cannot be both @coast and @inland: "${line}"`);
  for (const k of ['months', 'hours', 'wx', 'alerts', 'counties']) if (t[k]) Object.freeze(t[k]);
  Object.freeze(t.flags); Object.freeze(t.needs);
  return { text: rest, tags: Object.freeze(t) };
}

// Every authored line, by its text: its tags, or null when it has none. The same text must carry the same tags
// wherever it is written, so a line means one thing.
const REGISTRY = new Map();
const signature = tags => JSON.stringify(tags || null);

/**
 * Record a line's tags (called by text.lines() for every content line).
 * @param {string} text
 * @param {object|null} tags from parseTagged
 */
export function registerLine(text, tags) {
  if (REGISTRY.has(text)) {
    if (signature(REGISTRY.get(text)) !== signature(tags)) throw new Error(`lexicon: "${text}" is written twice with different tags`);
    return;
  }
  REGISTRY.set(text, tags || null);
}

/**
 * The tags of an authored line (a template as it appears in DIALECTS), or null for an untagged or unknown line.
 * @param {string} template
 * @returns {Readonly<{months: number[]|null, hours: number[]|null, wx: string[]|null, alerts: string[]|null, counties: string[]|null, flags: string[], needs: string[]}>|null}
 */
export function lineTags(template) {
  return REGISTRY.get(template) || null;
}

/**
 * Every authored line that carries tags, with its tags (for tests and tools).
 * @returns {Array<[string, object]>}
 */
export function taggedLines() {
  return [...REGISTRY].filter(([, tags]) => tags);
}

/**
 * The situation and speaker a line is checked against, normalized: month and hour come from opts.t (epoch ms,
 * read in Pacific time) unless given, the county from opts.slots.county unless given, and opts.speaker's
 * fields are merged in.
 * @param {object} [opts] {t, month, hour, condition, alerts, offshore, coastKm, county, slots, age, drives,
 *   works, tenure, parent, nativeHere, generation, speaker}
 * @returns {object}
 */
export function situationOf(opts = {}) {
  const c = { ...(opts.speaker || {}), ...opts };
  delete c.speaker;
  if (Number.isFinite(c.t) && (c.month === undefined || c.hour === undefined)) {
    const p = pacific(c.t);
    if (c.month === undefined) c.month = p.month;
    if (c.hour === undefined) c.hour = p.hour;
  }
  if (c.county === undefined && c.slots && typeof c.slots.county === 'string') c.county = c.slots.county;
  return c;
}

function fits(tags, c) {
  if (tags.months && !tags.months.includes(c.month)) return false;
  if (tags.hours && !tags.hours.includes(c.hour)) return false;
  if (tags.wx && !tags.wx.includes(c.condition)) return false;
  if (tags.alerts) {
    const events = Array.isArray(c.alerts) ? c.alerts.map(a => String(a && typeof a === 'object' ? a.event : a)) : [];
    if (!tags.alerts.every(k => events.some(ALERT_TESTS[k]))) return false;
  }
  if (tags.counties && !tags.counties.includes(c.county)) return false;
  for (const f of tags.flags) {
    if (f === 'offshore' && c.offshore !== true) return false;
    if (f === 'coast' && !(Number.isFinite(c.coastKm) && c.coastKm <= COAST_KM)) return false;
    if (f === 'inland' && !(Number.isFinite(c.coastKm) && c.coastKm > COAST_KM)) return false;
  }
  for (const n of tags.needs) if (!SPEAKER_NEEDS[n].test(c)) return false;
  return true;
}

/**
 * True when a line can be said in this situation by this speaker (always true for an untagged line). Pass the
 * output of situationOf(), or raw options (they are normalized when `normalized` is false).
 * @param {string} template
 * @param {object} [ctx]
 * @param {boolean} [normalized] ctx already came from situationOf
 * @returns {boolean}
 */
export function lineFits(template, ctx = {}, normalized = false) {
  const tags = REGISTRY.get(template);
  if (!tags) return true;
  return fits(tags, normalized ? ctx : situationOf(ctx));
}
