// Legion · dialogue · core: the template machinery and the small text helpers every other dialogue file uses.
//
// Lines are authored as blocks of text, one template per line, with optional leading tags that say who can say
// the line and when (the same idea as the lexicon's tags, with the dialogue's own vocabulary: register, age, mood,
// personality, life facts, the relationship with the player, the hour and the weather). Slots are {name} and are
// filled from a plain object; {name?} may be empty. A slot value can be a string or number, or a {t, g} pair: the
// text as said and its English gloss, which is how a word in another language ("mi abuela") rides inside an
// English line and still gets a meaning shown under it.
//
// Nothing here knows about the world or a persona: the voice (voice.mjs) supplies the facts the tags test.

import { SPEAKER_NEEDS } from '../lexicon/tags.mjs';

// ------------------------------------------------------------------ small helpers

export const isNum = v => typeof v === 'number' && Number.isFinite(v);
export const num = (v, d = 0) => (isNum(v) ? v : d);
export const str = v => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** Upper-case the first letter (after any opening Spanish punctuation or quote). */
export function capFirst(s) {
  if (!s) return s;
  return String(s).replace(/^([¿¡"'(]*)(\p{Ll})/u, (m, pre, ch) => pre + ch.toUpperCase());
}

/** Lower-case the first letter of a phrase that will continue a sentence ("The weather service says ..."). */
export function lowerFirst(s) {
  if (!s) return s;
  return /^\p{Lu}\p{Ll}/u.test(s) && !/^(I|I'm|I've|I'd|I'll)\b/.test(s) ? s[0].toLowerCase() + s.slice(1) : s;
}

/** "a" or "an" for a phrase. */
export function article(phrase) {
  const p = String(phrase || '').trim().toLowerCase();
  if (/^(uni|use|usu|uti|one|eu|ur[aeiou]|u\.)/.test(p)) return 'a';
  if (/^(hour|honest|heir|honor|fbi|mri|rn\b|lvn\b|emt\b|lvn|x-ray)/.test(p)) return 'an';
  return /^[aeiou]/.test(p) ? 'an' : 'a';
}

/** "a nurse", "an engineer". */
export const withArticle = phrase => `${article(phrase)} ${phrase}`;

/** "x", "x and y", "x, y and z". */
export function listJoin(items, and = 'and') {
  const a = items.filter(Boolean);
  if (a.length <= 1) return a[0] || '';
  if (a.length === 2) return `${a[0]} ${and} ${a[1]}`;
  return `${a.slice(0, -1).join(', ')} ${and} ${a[a.length - 1]}`;
}

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
/** "three" for small counts, digits beyond twelve. */
export const numWord = n => (Number.isInteger(n) && n >= 0 && n < NUMBER_WORDS.length ? NUMBER_WORDS[n] : String(n));

/** "1,203". */
export function fmtInt(n) {
  const s = String(Math.round(Math.abs(n)));
  return (n < 0 ? '-' : '') + s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * A count said the way people say it: "about 90,000", "more than 1,200", "almost 300,000", exact below 100.
 * Two significant figures; the qualifier tells which way it was rounded.
 */
export function approx(n) {
  if (!isNum(n)) return null;
  const a = Math.abs(n);
  if (a < 100) return fmtInt(n);
  const mag = 10 ** (Math.floor(Math.log10(a)) - 1);
  const r = Math.round(a / mag) * mag;
  if (r === a) return fmtInt(n);
  const off = (r - a) / a;
  if (off > 0 && off <= 0.04) return `almost ${fmtInt(r)}`;
  if (off < 0 && -off <= 0.06) return `more than ${fmtInt(r)}`;
  return `about ${fmtInt(r)}`;
}

/** Money as said: "$8,200", "$1.45 million", "over $2 million" (the ACS cap). */
export function money(n) {
  if (!isNum(n) || n <= 0) return null;
  if (n >= 2000001) return 'over two million dollars';
  if (n >= 1000000) {
    const m = Math.round(n / 50000) * 50000 / 1e6;
    return `${String(m.toFixed(2)).replace(/0$/, '').replace(/\.0$/, '')} million dollars`;
  }
  if (n >= 10000) return `$${fmtInt(Math.round(n / 1000) * 1000)}`;
  return `$${fmtInt(Math.round(n / 100) * 100)}`;
}

/** Kilometers as a neighbor says miles: "a few blocks", "about a mile", "about 15 miles". */
export function miles(km) {
  if (!isNum(km)) return null;
  const mi = km * 0.621371;
  if (mi < 0.3) return 'a few blocks';
  if (mi < 0.8) return 'less than a mile';
  if (mi < 1.5) return 'about a mile';
  if (mi < 10) return `about ${Math.round(mi)} miles`;
  if (mi < 60) return `about ${Math.round(mi / 5) * 5} miles`;
  return `about ${Math.round(mi / 10) * 10} miles`;
}

const COMPASS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
/** Compass word for a step in world units (x grows east, y grows south). */
export function compass(dx, dy) {
  if (!isNum(dx) || !isNum(dy) || (dx === 0 && dy === 0)) return null;
  const ang = Math.atan2(dx, -dy); // 0 = north, clockwise
  const k = ((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8;
  return COMPASS[k];
}

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** 'YYYYMMDD' / 'YYYY-MM-DD' / 'YYYY' → {y, m, d} (m and d may be null), or null. */
export function parseDate(s) {
  if (s === null || s === undefined) return null;
  const t = String(s);
  let m = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(t);
  if (m) return { y: +m[1], m: +m[2], d: +m[3] };
  m = /^(\d{4})$/.exec(t);
  return m ? { y: +m[1], m: null, d: null } : null;
}

/** "November 8, 2018". */
export const fullDate = dt => (dt && dt.m ? `${MONTHS[dt.m - 1]} ${dt.d}, ${dt.y}` : dt ? String(dt.y) : null);
/** "November 2018". */
export const monthYear = dt => (dt && dt.m ? `${MONTHS[dt.m - 1]} ${dt.y}` : dt ? String(dt.y) : null);
/** "late November 2018", "early March 2023", "mid-January 2023". */
export function partOfMonth(dt) {
  if (!dt || !dt.m) return dt ? String(dt.y) : null;
  const part = dt.d <= 10 ? 'early' : dt.d <= 20 ? 'mid-' : 'late';
  return `${part === 'mid-' ? 'mid-' : part + ' '}${MONTHS[dt.m - 1]} ${dt.y}`;
}
/** "noviembre de 2018". */
export const mesAno = dt => (dt && dt.m ? `${MESES[dt.m - 1]} de ${dt.y}` : dt ? String(dt.y) : null);

/**
 * An NWS gloss cleaned for a line: notes in parentheses and alternatives after a slash dropped ("Wow! / Darn!
 * (mild)" → "Wow!"), so the gloss reads as plain English.
 */
export function cleanGloss(g) {
  let s = String(g || '').replace(/\s*\([^)]*\)/g, '').trim();
  if (s.includes(' / ')) s = s.split(' / ')[0].trim();
  return s;
}

/** Collapse spaces, tidy punctuation spacing, capitalize sentence starts. */
export function tidy(s) {
  // a space after a comma only before a letter, so "1,203" and "10:00" keep their shape
  let out = String(s || '').replace(/\s+/g, ' ').replace(/\s+([,.!?;:])/g, '$1').replace(/([,;:])(?=\p{L})/gu, '$1 ')
    .replace(/,\s*([.!?])/g, '$1').replace(/(^|[^.])\.\.(?!\.)/g, '$1.').replace(/([!?])\.(?!\.)/g, '$1').trim();
  out = out.replace(/(^|[.!?]\s+)([¿¡"(]*)(\p{Ll})/gu, (m, pre, open, ch) => pre + open + ch.toUpperCase());
  return out;
}

/** Make sure a sentence ends with terminal punctuation. */
export function terminate(s) {
  const t = String(s || '').trim();
  if (!t) return t;
  return /[.!?…)"]$/.test(t) ? t : `${t}.`;
}

/** Words of a text, lower case, for matching. */
export function wordsOf(s) {
  return String(s || '').toLowerCase().replace(/[’‘`]/g, "'").match(/[\p{L}\p{N}][\p{L}\p{N}'-]*/gu) || [];
}

// ------------------------------------------------------------------ tags

/**
 * The dialogue tag vocabulary. Each tag is a test over a voice (voice.mjs): {reg, age, mood, big5, humor, direct,
 * speaker, flags, relq, tempF, alerts, hour, weekend, lang}. A tag may be negated with "!" ("@!kids").
 * @type {Readonly<Record<string, (v: object) => boolean>>}
 */
export const TAG_TESTS = Object.freeze({
  // register
  casual: v => v.reg === 'casual', neutral: v => v.reg === 'neutral', formal: v => v.reg === 'formal',
  plain: v => v.reg !== 'casual', loose: v => v.reg !== 'formal',
  // age and life stage
  kid: v => v.age >= 5 && v.age < 13, teen: v => v.age >= 13 && v.age < 18, minor: v => v.age < 18, adult: v => v.age >= 18,
  young: v => v.age >= 18 && v.age < 35, midlife: v => v.age >= 35 && v.age < 65, senior: v => v.age >= 65, older: v => v.age >= 50,
  grown: v => v.age >= 25, under30: v => v.age < 30,
  // mood, this turn
  up: v => v.mood.valence >= 0.15, down: v => v.mood.valence <= -0.12, tired: v => v.mood.tired, tense: v => v.mood.tense,
  // personality and manner
  funny: v => v.humor >= 0.45, earnest: v => v.humor < 0.35, blunt: v => v.direct >= 0.6, gentle: v => v.direct < 0.45,
  outgoing: v => v.big5.E >= 0.55, shy: v => v.big5.E < 0.42, warm: v => v.big5.A >= 0.55, prickly: v => v.big5.A < 0.42,
  worrier: v => v.big5.N >= 0.58, steady: v => v.big5.N < 0.42, curious: v => v.big5.O >= 0.58, settled: v => v.big5.O < 0.42,
  dry: v => v.humorStyle === 'dry' || v.humorStyle === 'wry', playful: v => v.humorStyle === 'playful', sarcastic: v => v.humorStyle === 'sarcastic',
  // what the line presupposes about the speaker (the lexicon's meanings)
  drives: v => SPEAKER_NEEDS.drives.test(v.speaker), works: v => SPEAKER_NEEDS.works.test(v.speaker),
  owns: v => SPEAKER_NEEDS.owns.test(v.speaker), rents: v => SPEAKER_NEEDS.rents.test(v.speaker),
  parent: v => SPEAKER_NEEDS.parent.test(v.speaker), native: v => SPEAKER_NEEDS.native.test(v.speaker),
  rooted: v => SPEAKER_NEEDS.rooted.test(v.speaker),
  // life facts from the record
  house: v => !!v.flags.house, apartment: v => !!v.flags.apartment, mobile: v => !!v.flags.mobile,
  newcomer: v => !!v.flags.newcomer, longtime: v => !!v.flags.longtime, retired: v => !!v.flags.retired, student: v => !!v.flags.student,
  wfh: v => !!v.flags.wfh, outdoor: v => !!v.flags.outdoor, kids: v => !!v.flags.kids, littlekids: v => !!v.flags.littleKids,
  teens: v => !!v.flags.teens, grandkids: v => !!v.flags.grandkids, partner: v => !!v.flags.partner, alone: v => !!v.flags.alone,
  immigrant: v => !!v.flags.immigrant, transit: v => !!v.flags.transit, nights: v => !!v.flags.nights, early: v => !!v.flags.early,
  commuter: v => !!v.flags.commuter, coast: v => !!v.flags.coast, inland: v => !v.flags.coast, rural: v => !!v.flags.rural,
  urban: v => !!v.flags.urban, suburban: v => !!v.flags.suburban, churchgoer: v => !!v.flags.churchgoer, fan: v => !!v.flags.fan,
  firezone: v => !!v.flags.fireZone, hotplace: v => !!v.flags.hotPlace, snowplace: v => !!v.flags.snowPlace, desert: v => !!v.flags.desert,
  withparents: v => !!v.flags.withParents, widowed: v => !!v.flags.widowed, male: v => v.sex === 'M', female: v => v.sex === 'F',
  // the relationship with the player
  stranger: v => !v.relq.known, known: v => !!v.relq.known, friendly: v => v.relq.affinity >= 0.15, guarded: v => !!v.relq.guarded,
  named: v => !!v.relq.name,
  // the moment
  hot: v => isNum(v.tempF) && v.tempF >= 90, cold: v => isNum(v.tempF) && v.tempF <= 48, mild: v => isNum(v.tempF) && v.tempF > 55 && v.tempF < 85,
  alert: v => v.alerts.length > 0, night: v => v.hour >= 21 || v.hour < 5, morning: v => v.hour >= 5 && v.hour < 12,
  afternoon: v => v.hour >= 12 && v.hour < 17, evening: v => v.hour >= 17 && v.hour < 21, daytime: v => v.hour >= 7 && v.hour < 19,
  weekend: v => !!v.weekend, weekday: v => !v.weekend,
  // Spanish address forms
  usted: v => !!(v.lang && v.lang.usted), tu: v => !(v.lang && v.lang.usted),
});

const TAG_RE = /^@(!?)([a-z0-9]+)$/;

/**
 * Parse a template line: leading tags, then the text (for a bilingual line, "Spanish || English").
 * Throws on an unknown tag, so a typo fails at import.
 * @param {string} raw
 * @param {boolean} bilingual
 * @returns {{text: string, gloss: string|null, tags: Array<[boolean, string]>}}
 */
export function parseLine(raw, bilingual = false) {
  let rest = String(raw).trim();
  const tags = [];
  let m;
  while ((m = /^(@\S+)\s+/.exec(rest))) {
    const t = TAG_RE.exec(m[1]);
    if (!t || !TAG_TESTS[t[2]]) throw new Error(`dialogue: unknown tag ${m[1]} in "${raw}"`);
    tags.push([t[1] === '!', t[2]]);
    rest = rest.slice(m[0].length);
  }
  if (!rest || rest.startsWith('@')) throw new Error(`dialogue: a tagged line has no text: "${raw}"`);
  if (!bilingual) return { text: rest, gloss: null, tags };
  const parts = rest.split(' || ');
  if (parts.length !== 2 || !parts[0].trim() || !parts[1].trim()) throw new Error(`dialogue: a bilingual line needs "text || gloss": "${raw}"`);
  return { text: parts[0].trim(), gloss: parts[1].trim(), tags };
}

/**
 * Compile an authored bank: {key: block} → {key: [{text, gloss, tags, key}]} (frozen).
 * @param {Record<string, string>} src
 * @param {{bilingual?: boolean, name?: string}} [opts]
 * @returns {Readonly<Record<string, ReadonlyArray<{text: string, gloss: string|null, tags: Array<[boolean, string]>, key: string, bank: string}>>>}
 */
export function compileBank(src, opts = {}) {
  const out = {};
  for (const [key, block] of Object.entries(src)) {
    const list = [];
    for (const raw of String(block).split('\n')) {
      const s = raw.trim();
      if (!s || s.startsWith('//')) continue;
      const line = parseLine(s, !!opts.bilingual);
      list.push(Object.freeze({ ...line, tags: Object.freeze(line.tags), key, bank: opts.name || 'en' }));
    }
    out[key] = Object.freeze(list);
  }
  return Object.freeze(out);
}

/** True when every tag of a compiled line holds for the voice. */
export function tagsHold(line, v) {
  for (const [neg, tag] of line.tags) if (TAG_TESTS[tag](v) === neg) return false;
  return true;
}

// ------------------------------------------------------------------ filling

const SLOT_RE = /\{([A-Za-z][A-Za-z0-9]*)(\?)?\}/g;

/** The slot names a template uses. */
export function slotNames(template) {
  return [...String(template).matchAll(SLOT_RE)].map(m => m[1]);
}

function slotParts(v) {
  if (v === undefined || v === null) return null;
  if (typeof v === 'object') {
    const t = v.t === undefined || v.t === null ? null : String(v.t);
    const g = v.g === undefined || v.g === null ? t : String(v.g);
    return t === null ? null : { t, g, foreign: true };
  }
  if (typeof v === 'number' && !Number.isFinite(v)) return null;
  const s = String(v);
  return { t: s, g: s, foreign: false };
}

/** A slot's value; "fooCap" falls back to "foo" with its first letter capitalized. */
function slotValue(slots, name) {
  if (!slots) return undefined;
  const v = slots[name];
  if (v !== undefined || !name.endsWith('Cap')) return v;
  const base = slots[name.slice(0, -3)];
  if (base === undefined || base === null) return base;
  if (typeof base === 'object') return { t: capFirst(String(base.t)), g: capFirst(String(base.g === undefined ? base.t : base.g)) };
  return capFirst(String(base));
}

/**
 * Fill a template. Returns {text, gloss, foreign} or null when a required slot is missing or empty, a value is not
 * a finite number, or a brace survives. gloss is the line with every {t, g} slot value replaced by its English;
 * foreign is true when such a value was used. A slot named "xCap" not given takes "x" capitalized.
 * @param {string} template
 * @param {Record<string, string|number|{t: string, g: string}|null|undefined>} slots
 * @returns {{text: string, gloss: string, foreign: boolean}|null}
 */
export function fillLine(template, slots = {}) {
  let ok = true, foreign = false;
  const pieces = { t: '', g: '' };
  let last = 0;
  const src = String(template);
  for (const m of src.matchAll(SLOT_RE)) {
    const lit = src.slice(last, m.index);
    pieces.t += lit; pieces.g += lit;
    last = m.index + m[0].length;
    const p = slotParts(slotValue(slots, m[1]));
    if (!p) { if (m[2]) continue; ok = false; break; }
    if (!m[2] && !p.t.trim()) { ok = false; break; }
    pieces.t += p.t; pieces.g += p.g;
    if (p.foreign) foreign = true;
  }
  if (!ok) return null;
  const tail = src.slice(last);
  pieces.t += tail; pieces.g += tail;
  if (/[{}]/.test(pieces.t) || /[{}]/.test(pieces.g)) return null;
  return { text: tidy(pieces.t), gloss: tidy(pieces.g), foreign };
}

// ------------------------------------------------------------------ guards

const BAD_TOKEN = /\b(undefined|null|NaN|Infinity)\b|\[object Object\]/;

/** True when a finished line carries no machine leftovers. */
export function cleanText(s) {
  return typeof s === 'string' && !!s.trim() && !BAD_TOKEN.test(s) && !/[{}]/.test(s);
}

// What a line presupposes when it speaks in the first person, for lines that carry no tags (most of the lexicon's
// regional lines are written for anyone, and a few assume a car, a lease or a yard). Each test receives the voice.
const LIFE_CHECKS = [
  [/\b(my|our) (landlord|lease)\b|\bI rent\b|\bmy rent\b|\bour rent\b/i, v => v.speaker.tenure === 'rent' || (v.speaker.tenure === undefined && v.age >= 18 && !v.flags.ownerHousehold)],
  [/\b(my|our) (mortgage|property tax(es)?|homeowner'?s( insurance)?)\b|\bwe (bought|own) (the|our|this) (house|place|home)\b|\bI (bought|own) (the|my|this) (house|place|home)\b/i, v => v.speaker.tenure === 'own'],
  [/\b(my|our) (roof|gutters|yard|backyard|front yard|lawn|garden|fence|driveway|garage|porch|patio)\b/i, v => !!(v.flags.house || v.flags.mobile)],
  [/\b(my|our) (studio|apartment|building|unit)\b/i, v => !!v.flags.apartment],
  [/\b(my|our) (kids?|son|daughter|children|baby|boy|girl|teenagers?)\b/i, v => !!v.flags.kids],
  [/\b(my|our) (grandkids?|grandchildren|grandson|granddaughter|grandbaby)\b/i, v => !!v.flags.grandkids],
  [/\bmy (wife|husband|spouse|partner)\b/i, v => !!v.flags.partner],
  [/\bmy (boss|shift|coworkers?|paycheck|manager)\b|\b(at|before|after|from|to|on the way to) work\b|\bmy office\b/i, v => v.speaker.works === true || (v.speaker.works === undefined && v.age >= 18)],
  [/\bmy commute\b|\bon my way (in|to work)\b/i, v => !!v.flags.commuter],
  [/\b(my|our) (car|truck|steering wheel|windshield|tires?)\b|\bI (drove|drive)\b|\bI'?m driving\b|\bwhen I drive\b/i, v => SPEAKER_NEEDS.drives.test(v.speaker)],
  [/\b(born and raised|grew up (here|in this|right here))\b/i, v => v.speaker.nativeHere !== false],
  [/\bmy (teacher|class|homework|classes|professor)\b/i, v => !!v.flags.student || v.age < 19],
  [/\b(I|we) surf\b|\bsurfing before work\b|\bcatch any waves\b|\bpaddle(d)? out\b|\bmy board\b/i, v => !!v.flags.surfs],
  [/\bchurch\b.*\b(I|we)\b|\b(I|we) (go to|went to) church\b|\bat church\b/i, v => !!v.flags.churchgoer],
];

// Lines that treat the listener as an old acquaintance; fine for neighbors, not for a stranger.
const FAMILIAR = /\b(long time|haven't seen you|in forever|look who it is|good to see you( again)?|you still (living|around)|you made it|how'?s the family|how'?s work been|how'?ve you been|you'?re back|been a while|in a while|how'?s everybody|well, hey, stranger|hey, stranger|your side of (town|the bay)|on your side)\b/i;

/**
 * True when a line fits the speaker's life and the relationship: no first-person claim the record contradicts,
 * and no "long time no see" to a stranger. Applies to any finished line, tagged or not.
 * @param {string} text
 * @param {object} v a voice
 * @param {{familiar?: boolean}} [opts] familiar: the listener is someone the speaker knows (barks between neighbors)
 */
export function fitsLife(text, v, opts = {}) {
  const s = String(text || '');
  for (const [re, ok] of LIFE_CHECKS) if (re.test(s) && !ok(v)) return false;
  if (FAMILIAR.test(s) && !(opts.familiar || (v.relq && v.relq.known))) return false;
  return true;
}

// ------------------------------------------------------------------ lint

// Spellings that put an accent on the page ("ze", "dat", "goin'") and pidgin forms; the representation rules forbid
// them in every voice.
const ACCENT_PATTERNS = [
  /(?<![\w'’])(ze|zis|zat|zey|zem|vat|vy|ve|dat|dis|dem|dey|dere|dose|wit|ah'm|ahm|velly|herro|prease|solly|meester)(?![\w'’])/i,
  /(?<![\w'’])fo'(?=\s|$)/i,
  /\b\w+in'(?=\W|$)/i,
  /\b(me no|no have|me want|you buy|is very good, yes|very nice, yes|me like)\b/i,
  /\b(y'all|ain't nothin'|gonna|wanna|gotta|kinda|sorta)\b/i,
];
// Foreign words used as color in an English line are mock language, not code-switching: code-switching goes
// through the lexicon, for speakers who speak the language.
const MOCK_WORDS = /\b(amigo|amiga|señor|senor|señorita|senorita|gracias|hola|adios|adiós|muchacho|chica|vato|ese|mamacita|papi|hombre|el cheapo|no problemo|arigato|konnichiwa|sayonara|ni hao|aloha)\b/i;

/**
 * Problems in an English template: accent spelling, mock foreign words, brand names (via the lexicon's
 * findBrands), unbalanced braces, doubled spaces. Returns a list of problem strings (empty when clean).
 * @param {string} text
 * @param {(s: string) => string[]} findBrands
 * @param {{english?: boolean}} [opts]
 * @returns {string[]}
 */
export function lintText(text, findBrands, opts = {}) {
  const out = [];
  const s = String(text);
  if (opts.english !== false) {
    for (const re of ACCENT_PATTERNS) { const m = re.exec(s); if (m) out.push(`accent or pidgin spelling "${m[0]}"`); }
    const mock = MOCK_WORDS.exec(s);
    if (mock) out.push(`mock foreign word "${mock[0]}"`);
  }
  for (const b of findBrands(s)) out.push(`brand name "${b}"`);
  const opens = (s.match(/\{/g) || []).length, closes = (s.match(/\}/g) || []).length;
  if (opens !== closes) out.push('unbalanced braces');
  if (/ {2,}/.test(s)) out.push('double space');
  return out;
}
