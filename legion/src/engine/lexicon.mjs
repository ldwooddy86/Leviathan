// Legion · lexicon: regional dialects, road naming and multilingual phrase banks.
//
// This is the voice material the offline dialogue engine composes lines from and the Claude prompt builder
// cites. Content lives in ./lexicon/*.mjs; this module re-exports it and adds the helpers a conversation needs:
// a repeat-avoiding Picker, template filling from world-pack slots, age-graded slang, code-switching into an
// NPC's home language, and family terms.
//
// Representation rules (docs/CONTRACTS.md §3): dialect is regional, never ethnic; a language appears only when
// the caller passes it for a speaker who speaks it; no accent spelling, no broken English, no brand names;
// religious formulas only for a speaker whose own faith they belong to.
//
// Data provenance: a line is only said when it is true. Lines carry tags (lexicon/tags.mjs) for the months,
// hours, weather, alerts and places they assume and for what they presuppose about the speaker; linesFor and
// pickLine leave out any line the situation or the speaker contradicts.
//
// The usual flow for one NPC line:
//   const key = dialectFor(world, zi);                                // 'fresno'
//   const { values, context } = slotsFor(world, zi, { t, rng });      // {road: 'Highway 41', temp: 101, …}, {month, hour, condition, …}
//   const speaker = speakerFacts(npc, persona);                       // {age, drives, works, tenure, parent, nativeHere, generation}
//   const picker = new Picker(conversationSeed);                      // one per conversation, serializable
//   pickLine(key, 'traffic', rng, { ...context, speaker, slots: values, picker })
//   pickLine(key, 'weather', rng, { ...context, speaker, slots: values, picker })   // context.condition picks the bank
//   slangFor(key, age, rng)
//   codeSwitch(lang, 'tired', rng, { sex, t, variety: varietyFor(lang, heritage, { birthplace }), faith: faithFor(heritage) })
// and for a Claude system prompt, dialectSummary(key) plus DIALECTS[key].words.

import { Rng, clamp } from './rng.mjs';
import { pacific } from './clock.mjs';
import { dialectFor, explainDialect, dialectTable, DIALECT_KEYS } from './lexicon/geography.mjs';
import { roadName, roadNames, freewayName, namedStretch, stretchesNear, normalizeRoad, NAMED_STRETCHES, ROAD_USAGE, SURFACE_STREETS } from './lexicon/roads.mjs';
import { SLOTS, SLOT_NAMES, fill, templateSlots, fireLabel, teamName, BRAND_BLACKLIST, findBrands } from './lexicon/slots.mjs';
import { DIALECTS, DIALECT_FAMILIES, LINE_CATEGORIES, WORD_CATEGORIES, WEATHER_CONDITIONS, AGE_CATEGORIES, ES_CATEGORIES } from './lexicon/dialects.mjs';
import { glossOf } from './lexicon/text.mjs';
import { parseTagged, lineTags, lineFits, situationOf, taggedLines, SPEAKER_NEEDS, ALERT_KINDS, COAST_KM, INSURANCE_LEVELS } from './lexicon/tags.mjs';
import {
  LANGUAGES, LANGUAGE_KEYS, LANGUAGE_ALIASES, PHRASE_INTENTS, RELIGIOUS_INTENTS, FAMILY_RELATIONS, INTERJECTION_KINDS, LANGUAGE_LIST_FIELDS,
  FAITHS, TIMES_OF_DAY, resolveLanguage, varietyFor, faithFor,
} from './lexicon/languages.mjs';

export {
  dialectFor, explainDialect, dialectTable, DIALECT_KEYS,
  roadName, roadNames, freewayName, namedStretch, stretchesNear, normalizeRoad, NAMED_STRETCHES, ROAD_USAGE, SURFACE_STREETS,
  SLOTS, SLOT_NAMES, fill, templateSlots, fireLabel, teamName, BRAND_BLACKLIST, findBrands,
  DIALECTS, DIALECT_FAMILIES, LINE_CATEGORIES, WORD_CATEGORIES, WEATHER_CONDITIONS, AGE_CATEGORIES, ES_CATEGORIES, glossOf,
  parseTagged, lineTags, lineFits, situationOf, taggedLines, SPEAKER_NEEDS, ALERT_KINDS, COAST_KM, INSURANCE_LEVELS,
  LANGUAGES, LANGUAGE_KEYS, LANGUAGE_ALIASES, PHRASE_INTENTS, RELIGIOUS_INTENTS, FAMILY_RELATIONS, INTERJECTION_KINDS, LANGUAGE_LIST_FIELDS,
  FAITHS, TIMES_OF_DAY, resolveLanguage, varietyFor, faithFor,
};

// ------------------------------------------------------------------ Picker

const keyOf = x => (typeof x === 'string' ? x : x && typeof x.text === 'string' ? x.text : JSON.stringify(x));

/**
 * Per-conversation choice without repeats, by category. Within a category an item is not chosen again until
 * every item has been used; then the category starts over (never repeating the item chosen last). State is
 * serializable so a conversation can be saved and resumed.
 */
export class Picker {
  /**
   * @param {number|Rng} [seed] a seed or an Rng to draw with
   * @param {{used?: Record<string, string[]>, last?: Record<string, string>}} [state] from toJSON()
   */
  constructor(seed = 1, state = null) {
    this.rng = seed instanceof Rng ? seed : new Rng(seed >>> 0);
    this.used = new Map();
    this.last = new Map();
    if (state) {
      for (const [c, keys] of Object.entries(state.used || {})) this.used.set(c, new Set(keys));
      for (const [c, k] of Object.entries(state.last || {})) this.last.set(c, k);
    }
  }

  _set(category) {
    let s = this.used.get(category);
    if (!s) this.used.set(category, s = new Set());
    return s;
  }

  /** True when this item was already used in the category (since its last reset). */
  seen(category, item) { const s = this.used.get(category); return !!s && s.has(keyOf(item)); }

  /** Record an item as used. */
  mark(category, item) { const k = keyOf(item); this._set(category).add(k); this.last.set(category, k); }

  /**
   * A random item of `items` not yet used in this category, marked as used; undefined for an empty list.
   * @template T
   * @param {string} category
   * @param {T[]} items
   * @param {Rng} [rng]
   * @returns {T|undefined}
   */
  pick(category, items, rng = this.rng) {
    const hit = this.pickWhere(category, items, () => true, rng);
    return hit ? hit.item : undefined;
  }

  /**
   * Like pick, but an item counts only when accept(item) returns something other than null or undefined (a
   * template that fills, say). Returns {item, value} or null when nothing in the list is acceptable. With
   * cycle false, a list whose items are all used gives null instead of starting the category over (for trying
   * a preferred sub-list before the full one).
   * @template T, V
   * @param {string} category
   * @param {T[]} items
   * @param {(item: T) => V} accept
   * @param {Rng} [rng]
   * @param {boolean} [cycle]
   * @returns {{item: T, value: V}|null}
   */
  pickWhere(category, items, accept, rng = this.rng, cycle = true) {
    if (!items || !items.length) return null;
    const used = this._set(category);
    const tryFrom = pool => {
      const order = rng.shuffle(pool.slice());
      for (const item of order) {
        const value = accept(item);
        if (value !== null && value !== undefined) { this.mark(category, item); return { item, value }; }
      }
      return null;
    };
    const fresh = items.filter(x => !used.has(keyOf(x)));
    const hit = fresh.length ? tryFrom(fresh) : null;
    if (hit || !cycle) return hit;
    // Every acceptable item has been used: start the category over, but not with the one said last.
    const last = this.last.get(category);
    const again = items.filter(x => keyOf(x) !== last);
    used.clear();
    return tryFrom(again.length ? again : items);
  }

  /** Forget the history of one category, or of all of them. */
  reset(category) { if (category === undefined) { this.used.clear(); this.last.clear(); } else { this.used.delete(category); this.last.delete(category); } }

  /** Serializable state. @returns {{used: Record<string, string[]>, last: Record<string, string>}} */
  toJSON() {
    return { used: Object.fromEntries([...this.used].map(([c, s]) => [c, [...s]])), last: Object.fromEntries(this.last) };
  }

  /** Rebuild a Picker from toJSON() output. */
  static fromJSON(state, seed = 1) { return new Picker(seed, state); }
}

// ------------------------------------------------------------------ dialect lines

function dialectOf(d) { return typeof d === 'string' ? DIALECTS[d] || null : d || null; }

const YOUTH_AGES = [13, 29];

/**
 * The templates a speaker of this dialect can use for a category in this situation: the dialect's lines, plus
 * the youth lines for speakers 13 to 29 and the elder lines for speakers 60 and over, minus every line whose
 * tags the situation or the speaker contradicts (see lexicon/tags.mjs). Category 'weather' needs
 * opts.condition (one of WEATHER_CONDITIONS); for other categories the condition only filters lines that
 * assume a kind of weather. opts.regional limits the list to family and local lines; opts.ignoreTags returns
 * every line regardless of tags (for tools that list the content).
 *
 * The situation: t (epoch ms; gives the month and hour) or month and hour, condition, alerts (NWS event names),
 * offshore, coastKm and county (slotsFor(...).context has them all). Lines that assume a month, an hour, a
 * kind of weather, an alert, offshore winds, a coast, an inland place or a county are left out when that part
 * of the situation is not given. The speaker: age (default 40), drives, works, tenure ('own'|'rent'|null),
 * parent, nativeHere, generation, flat or as opts.speaker (speakerFacts gives them); a fact left undefined
 * counts as fitting for an adult and not for a minor.
 *
 * With opts.lang 'es' the Spanish variants of the regional lines come back instead (ES_CATEGORIES and 'weather',
 * the dialect's and its family's; none for other categories or dialects without them), filtered the same way;
 * glossOf(template) gives each one's English gloss.
 * @param {string|object} dialect a key or a DIALECTS entry
 * @param {string} category one of LINE_CATEGORIES, or 'weather'
 * @param {object} [opts] {age, condition, regional, ignoreTags, lang, t, month, hour, alerts, offshore, coastKm, county,
 *   drives, works, tenure, parent, nativeHere, generation, speaker}
 * @returns {string[]}
 */
export function linesFor(dialect, category, opts = {}) {
  const d = dialectOf(dialect);
  if (!d) return [];
  const ctx = situationOf(opts);
  const age = Number.isFinite(ctx.age) ? ctx.age : 40;
  const condition = ctx.condition || null;
  const es = ctx.lang === 'es';
  const bank = es ? d.es : opts.regional ? d.regional : d;
  if (!bank) return [];
  let base;
  if (category === 'weather') base = condition && bank.weather && bank.weather[condition] ? bank.weather[condition] : [];
  else base = (es && !ES_CATEGORIES.includes(category)) ? [] : bank[category] || [];
  const keep = opts.ignoreTags ? () => true : t => lineFits(t, ctx, true);
  const out = base.filter(keep);
  if (!es && AGE_CATEGORIES.includes(category)) {
    // The youth bank is teen and twenties talk ("Sup.", "No cap."); children get the plain lines.
    if (age >= YOUTH_AGES[0] && age <= YOUTH_AGES[1]) for (const x of d.youth[category] || []) if (!out.includes(x) && keep(x)) out.push(x);
    if (age >= 60) for (const x of d.elder[category] || []) if (!out.includes(x) && keep(x)) out.push(x);
  }
  return out;
}

/**
 * One filled line from a dialect category, or null when no template fits the situation and the speaker and
 * fills from the slots. Leans on the dialect's own (family and local) lines with probability
 * opts.regionalShare, and uses opts.picker to avoid repeating a line within a conversation. Word-level
 * categories (fillers, intensifiers) come back as they go mid-sentence, not capitalized.
 * With opts.lang 'es' the line is one of the Spanish variants (linesFor), filled from the same slots, and comes back
 * with its English gloss filled alike: {text, template, gloss, lang: 'es'}.
 * @param {string|object} dialect
 * @param {string} category one of LINE_CATEGORIES, or 'weather'
 * @param {Rng} rng
 * @param {object} [opts] linesFor's options, plus {slots?: object, picker?: Picker, regionalShare?: number, lang?: 'es'}
 * @returns {{text: string, template: string, gloss?: string, lang?: 'es'}|null}
 */
export function pickLine(dialect, category, rng, opts = {}) {
  const { slots = {}, picker = null, regionalShare = 0.6 } = opts;
  const d = dialectOf(dialect);
  if (!d) return null;
  const ctx = situationOf(opts);
  const condition = ctx.condition || null;
  const es = ctx.lang === 'es';
  const all = linesFor(d, category, ctx);
  // the Spanish lines are all the family's and the dialect's own: there is no separate regional list
  const local = es ? [] : linesFor(d, category, { ...ctx, regional: true });
  const fillOpts = { capitalize: !WORD_CATEGORIES.includes(category) };
  const pcat = `${d.key}:${es ? 'es:' : ''}${category}${category === 'weather' && condition ? ':' + condition : ''}`;
  // a Spanish line fills only with its gloss: both or neither
  const fillOne = t => {
    const text = fill(t, slots, fillOpts);
    if (!text || !es) return text ? { text } : null;
    const gloss = fill(glossOf(t), slots, fillOpts);
    return gloss ? { text, gloss } : null;
  };
  const result = (t, v) => (es ? { text: v.text, template: t, gloss: v.gloss, lang: 'es' } : { text: v.text, template: t });
  const attempt = (pool, cycle) => {
    if (!pool.length) return null;
    if (picker) {
      const hit = picker.pickWhere(pcat, pool, fillOne, rng, cycle);
      return hit ? result(hit.item, hit.value) : null;
    }
    for (const t of rng.shuffle(pool.slice())) { const v = fillOne(t); if (v) return result(t, v); }
    return null;
  };
  // The local lines are a preference: once they are used up the full list carries on, and only when that is
  // used up too does the category start over.
  if (local.length && rng.chance(clamp(regionalShare, 0, 1))) {
    const hit = attempt(local, false);
    if (hit) return hit;
  }
  return attempt(all, true);
}

function defaultSlangLevel(age) {
  if (age < 13) return 1;
  if (age < 30) return 3;
  if (age < 45) return 2;
  return 1;
}

/**
 * An age-appropriate slang term for a speaker of this dialect, or null. Teens and twenties get up to level 3,
 * thirties and early forties level 2, everyone else and children level 1 (opts.maxLevel overrides; 0 means
 * none). Regional terms are preferred over statewide ones.
 * @param {string|object} dialect a key or a DIALECTS entry
 * @param {number} age
 * @param {Rng} rng
 * @param {{maxLevel?: number}} [opts]
 * @returns {{term: string, level: number, ages: number[], gloss: string, example: string, origin: string}|null}
 */
export function slangFor(dialect, age, rng, opts = {}) {
  const d = dialectOf(dialect);
  if (!d || !Number.isFinite(age)) return null;
  const maxLevel = opts.maxLevel !== undefined ? opts.maxLevel : defaultSlangLevel(age);
  if (!(maxLevel >= 1)) return null;
  const pool = d.slang.filter(s => age >= s.ages[0] && age <= s.ages[1] && s.level <= maxLevel);
  if (!pool.length) return null;
  const s = rng.weightedItem(pool, x => (x.origin === 'common' ? 1 : 2.5));
  return { ...s, ages: [...s.ages] };
}

/**
 * A short description of a dialect for a system prompt: who talks this way, how they say highways, and the
 * local words with their meanings.
 * @param {string} key
 * @param {{maxTerms?: number}} [opts]
 * @returns {string}
 */
export function dialectSummary(key, opts = {}) {
  const d = DIALECTS[key];
  if (!d) return '';
  const maxTerms = opts.maxTerms || 10;
  const roads = d.the
    ? (d.theShare < 1 ? 'usually "the" before freeway numbers ("the 99"), sometimes not' : 'always "the" before freeway numbers ("the 405", "the 10")') + (d.pch ? '; SR 1 on the coast is "PCH"' : '')
    : 'no "the" before highway numbers ("101", "880", "Highway 1")';
  const terms = d.localTerms.slice(0, maxTerms).map(t => `${t} (${d.words[t].note})`).join('; ');
  const codes = d.areaCodes.length ? ` Area codes: ${d.areaCodes.join(', ')}.` : '';
  return `${d.name}, ${d.region}. ${d.register} Highways: ${roads}. Local words: ${terms}.${codes}`;
}

// ------------------------------------------------------------------ languages

const INTENT_FIELD = {
  greeting: 'greetings', greetings: 'greetings', hello: 'greetings', hi: 'greetings',
  how_are_you: 'howAreYou', howareyou: 'howAreYou', howAreYou: 'howAreYou',
  thanks: 'thanks', thank_you: 'thanks',
  farewell: 'farewells', farewells: 'farewells', goodbye: 'farewells', bye: 'farewells',
  yes: 'yes', no: 'no', affection: 'affection', polite: 'polite', food: 'food',
};

const RELATION_ALIASES = {
  grandma: 'grandmother', granny: 'grandmother', grandpa: 'grandfather', mom: 'mother', mum: 'mother', mama: 'mother',
  dad: 'father', papa: 'father', auntie: 'aunt', aunty: 'aunt', buddy: 'friend',
};

// Hours (local, inclusive, wrapping) when a time-of-day phrase is said: "Buenos días" in the morning only.
const TIME_HOURS = { morning: [4, 11], day: [10, 17], afternoon: [12, 18], evening: [17, 23], night: [20, 3] };

function hourIn(h, [a, b]) {
  return a <= b ? h >= a && h <= b : h >= a || h <= b;
}

function hourOf(opts) {
  if (Number.isInteger(opts.hour)) return opts.hour;
  if (Number.isFinite(opts.t)) return pacific(opts.t).hour;
  return null;
}

// opts.variety: undefined means the language's default variety (most California Spanish is Mexican); null means
// a speaker whose variety is unknown or none of the declared ones, who gets only the shared, untagged entries.
function entryOk(e, opts, lang, hour) {
  if (e.sex && e.sex !== opts.sex) return false;
  if (e.to && e.to !== opts.to) return false;
  if (e.region) {
    const v = opts.variety === undefined ? lang.defaultVariety : opts.variety;
    if (!v || !e.region.includes(v)) return false;
  }
  if (e.faith && e.faith !== opts.faith) return false;
  if (e.time && !(hour !== null && hourIn(hour, TIME_HOURS[e.time]))) return false;
  if ((opts.register === 'respect' || opts.register === 'formal') && e.register === 'casual') return false;
  return true;
}

function poolFor(lang, intent) {
  const f = INTENT_FIELD[intent];
  if (f) return lang[f];
  if (INTERJECTION_KINDS.includes(intent)) return lang.interjections[intent];
  if (PHRASE_INTENTS.includes(intent)) return lang.phrases[intent] || [];
  return null;
}

function choose(pool, rng, picker, category) {
  if (!pool.length) return null;
  if (picker) return picker.pick(category, pool, rng) || null;
  return rng.pick(pool);
}

/**
 * The entries of a language for an intent that this speaker can say now: the filtering codeSwitch applies,
 * without the random choice (for tools, tests and prompt examples). Null for an unknown language or intent.
 * @param {string} lang a LANGUAGES key or alias
 * @param {string} intent
 * @param {object} [opts] codeSwitch's options
 * @returns {object[]|null}
 */
export function phrasesFor(lang, intent, opts = {}) {
  const key = resolveLanguage(lang, opts.seed !== undefined ? opts.seed : 0);
  const L = key && LANGUAGES[key];
  if (!L) return null;
  const all = poolFor(L, intent);
  if (!all) return null;
  const hour = hourOf(opts);
  return all.filter(x => entryOk(x, opts, L, hour));
}

/**
 * A phrase in the speaker's language for an intent, for code-switching into a line:
 * {text, roman (non-Latin scripts), gloss, lang, intent}, or null when the language has nothing suitable.
 * Intents: greeting, how_are_you, thanks, farewell, yes, no, surprise, frustration, delight, affection,
 * polite, food, and every PHRASE_INTENTS entry (thank_god, god_willing and blessing only where culturally
 * natural). Entries tied to the speaker's gender (opts.sex), the listener's (opts.to), a regional variety
 * (opts.variety: a varietyFor() result; undefined means the language's default, null only the shared entries),
 * a faith (opts.faith: the speaker's own, see faithFor; faith formulas are never used without it) or a time of
 * day (opts.hour, or opts.t in epoch ms; "Buenos días" only in the morning, and never without a time) are used
 * only when they match; opts.register 'respect' or 'formal' avoids casual forms. Call this only for a speaker
 * who actually speaks the language.
 * @param {string} lang a LANGUAGES key or alias (ambiguous aliases resolve by opts.seed, else rng.seed)
 * @param {string} intent
 * @param {Rng} rng
 * @param {{sex?: 'F'|'M', to?: 'F'|'M', variety?: string|null, faith?: string|null, hour?: number, t?: number, register?: string, seed?: number, picker?: Picker}} [opts]
 * @returns {{text: string, roman?: string, gloss: string, lang: string, intent: string}|null}
 */
export function codeSwitch(lang, intent, rng, opts = {}) {
  const key = resolveLanguage(lang, opts.seed !== undefined ? opts.seed : rng && rng.seed);
  const L = key && LANGUAGES[key];
  if (!L || !rng) return null;
  const all = poolFor(L, intent);
  if (!all) return null;
  const hour = hourOf(opts);
  const e = choose(all.filter(x => entryOk(x, opts, L, hour)), rng, opts.picker, `cs:${key}:${intent}`);
  return e ? { ...e, lang: key, intent } : null;
}

/**
 * A family term in the speaker's language: {text, roman?, gloss, lang, relation}, or null. Relations:
 * FAMILY_RELATIONS plus what a language adds (older_brother, older_sister, godparent, …); common English
 * aliases (grandma, mom, dad, auntie) are accepted. Same filtering options as codeSwitch.
 * @param {string} lang
 * @param {string} relation
 * @param {Rng} rng
 * @param {{sex?: 'F'|'M', to?: 'F'|'M', variety?: string|null, faith?: string|null, register?: string, seed?: number, picker?: Picker}} [opts]
 * @returns {{text: string, roman?: string, gloss: string, lang: string, relation: string}|null}
 */
export function familyTerm(lang, relation, rng, opts = {}) {
  const key = resolveLanguage(lang, opts.seed !== undefined ? opts.seed : rng && rng.seed);
  const L = key && LANGUAGES[key];
  if (!L || !rng || !relation) return null;
  const rel = RELATION_ALIASES[relation] || relation;
  const all = L.family[rel];
  if (!all) return null;
  const hour = hourOf(opts);
  const e = choose(all.filter(x => entryOk(x, opts, L, hour)), rng, opts.picker, `fam:${key}:${rel}`);
  return e ? { ...e, lang: key, relation: rel } : null;
}

// ------------------------------------------------------------------ world-grounded slots

/**
 * The dialect weather condition for a forecast: 'fog' | 'heat' | 'rain' | 'wind' | 'cold' | 'smoke' | 'snow' |
 * 'clear', or null for plain cloudy weather. Reads world.weatherAt() output (or {short, tempF, alerts}).
 * @param {object} wx
 * @returns {string|null}
 */
export function weatherCondition(wx) {
  if (!wx) return null;
  const now = wx.now || wx;
  const s = String(now.short || '').toLowerCase();
  const alerts = (wx.alerts || []).map(a => String(a.event || '')).join(' | ').toLowerCase();
  const t = Number.isFinite(now.tempF) ? now.tempF : null;
  if (/smoke/.test(s) || /smoke|air quality/.test(alerts)) return 'smoke';
  if (/snow|blizzard|sleet|flurr/.test(s) || /blizzard|winter storm|winter weather|ice storm/.test(alerts)) return 'snow';
  // A coastal flood alert means king tides and surf, not rain.
  if (/rain|shower|drizzle|thunder|storm/.test(s) || /flood/.test(alerts.replace(/coastal flood/g, ''))) return 'rain';
  if (/heat/.test(alerts) || (t !== null && t >= 92)) return 'heat';
  if (/wind|breezy|blustery|gust/.test(s) || /wind|red flag/.test(alerts)) return 'wind';
  if (/fog|mist|haze/.test(s) || /fog/.test(alerts)) return 'fog';
  if (/frost|freeze/.test(alerts) || (t !== null && t <= 42)) return 'cold';
  if (/sunny|clear|fair/.test(s)) return 'clear';
  return null;
}

// Santa Ana, Diablo and sundowner winds blow from the north and east, down off the deserts and the mountains;
// the onshore sea breeze and the winds ahead of a winter storm come from the west and the south.
const OFFSHORE_DIR = /\b(north|north northeast|northeast|east northeast|east)\s+wind\b/i;
const OFFSHORE_KIND = { sa: 'santa_ana', di: 'diablo', su: 'sundowner' };

/**
 * The offshore wind blowing now, by the ZIP's regime, or null: 'santa_ana' | 'diablo' | 'sundowner' when the
 * ZIP has an offshore wind regime (off_kind) and the current forecast period has a north-to-east wind of at
 * least 10 mph (or gusts of 20, or a wind or red flag alert). Lines tagged @offshore need it.
 * @param {object} wx world.weatherAt() output
 * @param {{off_kind?: string}} z the ZIP (world.zip)
 * @returns {string|null}
 */
export function offshoreWind(wx, z) {
  const kind = z && OFFSHORE_KIND[z.off_kind];
  if (!kind || !wx) return null;
  const detail = String((wx.period && wx.period.detail) || '');
  if (!OFFSHORE_DIR.test(detail)) return null;
  const speeds = [...detail.matchAll(/(\d+)\s*(?:to\s*(\d+)\s*)?mph/gi)].map(m => +(m[2] || m[1]));
  const gust = /gusts? (?:as high as |up to |to )?(\d+)/i.exec(detail);
  const windy = Math.max(0, ...speeds) >= 10 || (gust && +gust[1] >= 20)
    || (wx.alerts || []).some(a => /wind|red flag/i.test(String(a && a.event)));
  return windy ? kind : null;
}

const ARTICLE_SUFFIX = /\b(Mountains|Hills|Range|Buttes|Peaks|Crags|Alps|Valley|Basin|Desert|River|Ocean|Sea|Channel|Strait|Delta|Slough|Islands|Canyon|Bluffs)$/;

// What people call a few mountains whose official names nobody uses in conversation.
const COMMON_NAMES = {
  'Mount San Antonio': 'Mount Baldy', 'Santiago Peak': 'Saddleback', 'Lassen Peak': 'Lassen',
  'San Gorgonio Mountain': 'San Gorgonio', 'San Jacinto Peak': 'Mount San Jacinto',
};

/**
 * A landmark name as it goes in a sentence: "Mount Diablo", "the San Gabriel Mountains", "the Salton Sea",
 * and the everyday name where the official one isn't used ("Mount San Antonio" is "Mount Baldy").
 * @param {{name: string, kind?: string}} lm a landmarksNear entry
 * @returns {string|null}
 */
export function landmarkLabel(lm) {
  if (!lm || !lm.name) return null;
  const n = COMMON_NAMES[String(lm.name).trim()] || String(lm.name).trim();
  if (lm.kind === 'peak' || /^the /i.test(n)) return n;
  return ARTICLE_SUFFIX.test(n) ? `the ${n}` : n;
}

// How far away a feature of each gazetteer prominence rank still counts as "in view": Mount Shasta and Mount
// Whitney from a long way off, a named hill only from close by.
const VIEW_KM = { 1: 120, 2: 50, 3: 6 };
const SNOW_PEAK_KM = { 1: 130, 2: 70, 3: 12 };
const SNOW_LINE_M = 1100;

// weight(l) > 1 favors a feature (the snow peak favors height: Mount Baldy over the Verdugos from Santa Monica).
function bestLandmark(world, z, kinds, radii, weight = () => 1) {
  let best = null, bs = Infinity;
  for (const l of world.landmarksNear(z.tx, z.ty, Math.max(...Object.values(radii)), kinds)) {
    const r = radii[l.rank] || radii[3];
    if (l.distKm > r) continue;
    const w = weight(l);
    if (!(w > 0)) continue;
    const s = l.distKm / r / w;
    if (s < bs) { bs = s; best = l; }
  }
  return best;
}

// A range's height is not in the gazetteer; the highest point of the ZIP it sits in stands in for it.
function featureElevation(world, l) {
  if (Number.isFinite(l.elev)) return l.elev;
  const p = world.project(l.lat, l.lon), zi = world.zipAt(p.x, p.y);
  return zi >= 0 ? world.z.elev_max_m[zi] : null;
}

const placePops = new WeakMap();
function placePop(world, name) {
  let m = placePops.get(world);
  if (!m) {
    m = new Map();
    for (const p of world.places) if ((m.get(p.name) || 0) < p.pop) m.set(p.name, p.pop);
    placePops.set(world, m);
  }
  return m.get(name) || 0;
}

function seasonLabel(z, month) {
  const fireProne = (z.fhsz_any || 0) >= 10;
  if (month >= 6 && month <= 9) return fireProne && month >= 7 ? 'fire season' : 'summer';
  if (month === 10 || month === 11) return fireProne ? 'fire season' : 'fall';
  if (month === 12 || month <= 2) return (z.snowfall_in || 0) >= 60 ? 'ski season' : (z.rain_in || 0) >= 15 ? 'the rainy season' : 'winter';
  return 'spring';
}

/**
 * How hard home insurance is to get in a ZIP, for @ins tags: 'high' where FAIR Plan policies (fair_sh, per 100
 * homes) reach 8 or residential non-renewals (nonren_sh, %) reach 12, 'normal' where both are known and lower, null
 * when the pack does not say.
 * @param {object} z world.zip(i)
 * @returns {'high'|'normal'|null}
 */
export function insuranceLevel(z) {
  const fair = z && Number.isFinite(z.fair_sh) ? z.fair_sh : null, non = z && Number.isFinite(z.nonren_sh) ? z.nonren_sh : null;
  if ((fair !== null && fair >= 8) || (non !== null && non >= 12)) return 'high';
  return fair !== null || non !== null ? 'normal' : null;
}

/**
 * Slot values for ZIP zi from the world pack, ready for fill(): the town, county and region, the nearest busy
 * highway as locals say it, a named stretch, a landmark, the current temperature, forecast and alert, the
 * most destructive fire on record with its year, the month, weekday and season, and a local team (with and
 * without its article). Missing data stays null, so templates that need it are skipped. `facts` names the pack
 * facts each slot came from. `context` is the situation linesFor and pickLine check line tags against: {t,
 * month, hour, condition, alerts, offshore, offshoreKind, coastKm, county}. Callers may override any slot (a
 * persona's own memory of a fire; opts.team, the team the NPC follows, as a string or a persona team object).
 * @param {import('./world.mjs').World} world
 * @param {number|string} zi ZIP index or code
 * opts.home ({x, y}, the speaker's home) puts the road slots on the roads near home rather than near the town point.
 * @param {{t?: number, rng?: Rng, dialect?: string, team?: string|{name?: string, label?: string}, home?: {x: number, y: number}}} [opts]
 * @returns {{values: Record<string, string|number|null>, facts: Record<string, string|null>, context: object}|null}
 */
export function slotsFor(world, zi, opts = {}) {
  if (typeof zi === 'string') zi = world.indexOf(zi);
  const z = world.zip(zi);
  if (!z) return null;
  const t = Number.isFinite(opts.t) ? opts.t : world.snapshotTime;
  const rng = opts.rng || null;
  const key = opts.dialect || dialectFor(world, zi);
  const d = DIALECTS[key];
  const values = {}, facts = {};

  // A big city's ZIPs are mailed by neighborhood ("Van Nuys", "San Pedro"), and that is what people call home;
  // elsewhere the Census place ("East Los Angeles", "Lennox") is the more local name.
  const local = z.place && z.city && z.place !== z.city && placePop(world, z.place) >= 300000 ? z.city : (z.place || z.city);
  values.place = local || null;
  values.city = z.city || null;
  // the neighborhood people call it: the pack's curated name inside the big cities ("the Mission"), else the local name
  values.neighborhood = (typeof z.neighborhood === 'string' && z.neighborhood.trim()) || local || null;
  values.county = z.countyName || null;
  values.region = (d && d.regionThe) || z.regionThe || null;

  const lm = bestLandmark(world, z, ['peak', 'range', 'water', 'island'], VIEW_KM);
  values.landmark = landmarkLabel(lm);
  facts.landmark = lm ? `landmark:${lm.name}` : null;
  const pk = bestLandmark(world, z, ['peak', 'range'], SNOW_PEAK_KM, l => {
    const e = featureElevation(world, l) || 0;
    return e >= SNOW_LINE_M ? 1 + (e - SNOW_LINE_M) / 2000 : 0;
  });
  values.peak = landmarkLabel(pk);
  facts.peak = pk ? `landmark:${pk.name}` : null;

  // roads near the speaker's home when the caller gives it (decision 8), else near the town point
  const at = opts.home && Number.isFinite(opts.home.x) && Number.isFinite(opts.home.y) ? opts.home : { x: z.tx, y: z.ty };
  const roads = world.roadsNear(at.x, at.y, 15).slice().sort((a, b) => (b.aadt || 0) / (1 + b.distKm / 3) - (a.aadt || 0) / (1 + a.distKm / 3));
  const road = rng && roads.length > 1 && rng.chance(0.35) ? roads[1] : roads[0] || null;
  values.road = road ? roadName(road, key, { rng }) : null;
  facts.road = road ? `road:${road.name}` : null;
  values.stretch = (road && namedStretch(road, world, zi)) || ((stretchesNear(world, zi)[0] || {}).name) || null;
  facts.stretch = values.stretch ? `stretch:${values.stretch}` : null;

  const wx = world.weatherAt(zi, t);
  // an estimate (a forecast borrowed from another place, a climate guess) is no number to state flatly: the lines
  // that say "It's {temp}" are left out then (decision 1)
  const approx = !!(wx && (wx.approx === true || wx.stale === true || (wx.basis && wx.basis.kind && wx.basis.kind !== 'forecast')));
  values.temp = wx && wx.now && Number.isFinite(wx.now.tempF) && !approx ? Math.round(wx.now.tempF) : null;
  values.weather = wx && wx.now && wx.now.short ? String(wx.now.short).toLowerCase() : null;
  values.alert = wx && wx.alerts && wx.alerts.length ? wx.alerts[0].event : null;
  facts.weather = wx && wx.now ? `weather:${z.zip}:${wx.now.time}` : null;
  facts.alert = values.alert ? `alert:${values.alert}` : null;

  const fire = world.firesOf(zi).find(f => fireLabel(f.name) && Number.isFinite(f.year)) || null;
  values.fire = fire ? fireLabel(fire.name) : null;
  values.year = fire ? String(fire.year) : null;
  facts.fire = fire ? `fire:${fire.name}:${fire.year}` : null;

  const p = pacific(t);
  values.month = p.monthName;
  values.day = p.dayName;
  values.season = seasonLabel(z, p.month);
  // Teams are listed most-followed first. A persona's team object says it as {label: 'the Dodgers', name: 'Dodgers'}.
  const team = opts.team || (d && d.teams.length ? (rng ? d.teams[rng.weighted(d.teams.map((_, k) => 1 / (k + 1)))] : d.teams[0]) : null);
  values.team = team && typeof team === 'object' ? (team.label || team.name || null) : team;
  values.teamName = teamName(team);

  const offshoreKind = offshoreWind(wx, z);
  const context = {
    t, month: p.month, hour: p.hour,
    condition: weatherCondition(wx),
    alerts: wx && wx.alerts ? wx.alerts.map(a => String(a.event || '')).filter(Boolean) : [],
    offshore: !!offshoreKind, offshoreKind,
    coastKm: Number.isFinite(z.coast_km) ? z.coast_km : null,
    county: z.countyName || null,
    // the ZIP's home-insurance market (fid-19): 'high' trouble where the FAIR Plan or non-renewals run high
    insurance: insuranceLevel(z),
  };
  return { values, facts, context };
}

const HEAD_ROLES = new Set(['householder', 'spouse', 'partner']);

/**
 * The facts about a speaker that lines presuppose (see SPEAKER_NEEDS), from a layer 1 NPC record and, when
 * given, its persona: {age, drives, works, tenure, parent, nativeHere, generation}. tenure is the speaker's own
 * housing ('own' or 'rent' for a householder or spouse, 'rent' for a roommate, null for anyone who neither owns
 * nor pays rent, such as a grown child at home); parent means raising children under 18 at home; nativeHere
 * comes from persona.residence.grewUpHere. A fact the record does not settle stays undefined.
 * @param {object} npc a layer 1 NPC (population.mjs)
 * @param {object} [persona] its persona (persona.mjs)
 * @returns {{age?: number, drives?: boolean, works?: boolean, tenure?: 'own'|'rent'|null, parent?: boolean, nativeHere?: boolean, generation?: number}}
 */
export function speakerFacts(npc, persona = null) {
  if (!npc || typeof npc !== 'object') return {};
  const out = {};
  const age = Number.isFinite(npc.age) ? npc.age : undefined;
  if (age !== undefined) out.age = age;
  const hh = npc.household && typeof npc.household === 'object' ? npc.household : {};
  const members = Array.isArray(hh.members) ? hh.members : [];
  const mode = npc.commute && npc.commute.mode;
  const vehicles = Number.isFinite(hh.vehicles) ? hh.vehicles : undefined;
  if (age !== undefined && age < 16) out.drives = false;
  else if (vehicles === 0) out.drives = false;
  else if (mode === 'drive' || mode === 'motorcycle') out.drives = true;
  else if (vehicles > 0) out.drives = age !== undefined && age >= 18;

  if (npc.status === 'employed' || npc.status === 'military' || npc.occupation) out.works = true;
  else if (typeof npc.status === 'string') out.works = false;

  const head = HEAD_ROLES.has(npc.role);
  if (hh.tenure === 'own' || hh.tenure === 'rent') {
    if (head) out.tenure = hh.tenure;
    else if (npc.role === 'roommate') out.tenure = 'rent';
    else if (typeof npc.role === 'string') out.tenure = null;
  }
  const minor = role => members.some(x => x && x.role === role && Number.isFinite(x.age) && x.age < 18 && x.m !== npc.m);
  if (head) out.parent = minor('child');
  else if (npc.role === 'child' && age >= 18) out.parent = minor('grandchild');
  else if (typeof npc.role === 'string') out.parent = false;

  const res = persona && persona.residence;
  if (res && typeof res.grewUpHere === 'boolean') out.nativeHere = res.grewUpHere;
  else if (npc.nativity === 'foreign') out.nativeHere = false;
  if (Number.isFinite(npc.generation)) out.generation = npc.generation;
  return out;
}
