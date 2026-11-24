// Legion · lexicon · LANGUAGES: the multilingual phrase banks, expanded and validated.
//
// The content files keep entries compact; here each becomes a frozen {text, roman?, gloss, sex?, to?,
// region?, register?, note?} object, and the whole bank is checked as it loads (every entry has text and a
// gloss, every non-Latin entry a romanization written in Latin letters, every text in its own script), so a
// malformed phrase fails at import, not in a conversation.

import { hash2, hashStr, u01 } from '../rng.mjs';
import { SOURCES_A } from './languages-a.mjs';
import { SOURCES_B } from './languages-b.mjs';
import { SOURCES_C } from './languages-c.mjs';

/** Intents with phrase lists under LANGUAGES[lang].phrases (god_willing only where culturally natural). */
export const PHRASE_INTENTS = Object.freeze(['weather_hot', 'weather_cold', 'weather_rain', 'tired', 'busy', 'welcome', 'good_luck', 'take_care', 'see_you', 'no_problem', 'its_expensive', 'traffic_bad', 'god_willing', 'congratulations']);
/** The core family relations; some languages add more (older_brother, older_sister, godparent, …). */
export const FAMILY_RELATIONS = Object.freeze(['grandmother', 'grandfather', 'mother', 'father', 'aunt', 'uncle', 'son', 'daughter', 'friend']);
/** Interjection kinds. */
export const INTERJECTION_KINDS = Object.freeze(['surprise', 'frustration', 'delight']);
/** The list fields every language has. */
export const LANGUAGE_LIST_FIELDS = Object.freeze(['greetings', 'howAreYou', 'thanks', 'farewells', 'yes', 'no', 'affection', 'polite', 'food']);

const OPT_KEYS = new Set(['sex', 'to', 'region', 'register', 'note']);
const REGISTERS = new Set(['formal', 'casual', 'respect']);

// Unicode script of each language's native text, for the load-time check.
const SCRIPT_RE = {
  Latn: /\p{Script=Latin}/u, Hang: /\p{Script=Hangul}/u, Hant: /\p{Script=Han}/u, Hans: /\p{Script=Han}/u,
  Jpan: /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u, Armn: /\p{Script=Armenian}/u,
  Arab: /\p{Script=Arabic}/u, Cyrl: /\p{Script=Cyrillic}/u, Guru: /\p{Script=Gurmukhi}/u,
  Deva: /\p{Script=Devanagari}/u, Khmr: /\p{Script=Khmer}/u, Laoo: /\p{Script=Lao}/u, Thai: /\p{Script=Thai}/u,
  Ethi: /\p{Script=Ethiopic}/u,
};
// A romanization may contain Latin letters, combining marks, modifier letters (ʻ ʿ ʾ), digits (Jyutping tones)
// and punctuation, and nothing from another script.
const ROMAN_RE = /^[\p{Script=Latin}\p{M}\p{Lm}\p{N}\p{P}\p{Zs}ʻʿʾ]+$/u;

function expandEntry(lang, script, raw, where) {
  if (!Array.isArray(raw)) throw new Error(`lexicon: ${lang} ${where}: entry is not an array`);
  const latin = script === 'Latn';
  const [text, a, b, c] = raw;
  const roman = latin ? undefined : a;
  const gloss = latin ? a : b;
  const opts = latin ? b : c;
  if (raw.length > (latin ? 3 : 4)) throw new Error(`lexicon: ${lang} ${where}: too many fields in ${JSON.stringify(raw)}`);
  if (typeof text !== 'string' || !text.trim()) throw new Error(`lexicon: ${lang} ${where}: empty text`);
  if (typeof gloss !== 'string' || !gloss.trim()) throw new Error(`lexicon: ${lang} ${where}: "${text}" has no gloss`);
  if (!SCRIPT_RE[script].test(text)) throw new Error(`lexicon: ${lang} ${where}: "${text}" is not in script ${script}`);
  const e = { text, gloss };
  if (!latin) {
    if (typeof roman !== 'string' || !roman.trim() || !ROMAN_RE.test(roman)) throw new Error(`lexicon: ${lang} ${where}: "${text}" has a bad romanization ${JSON.stringify(roman)}`);
    e.roman = roman;
  }
  if (opts !== undefined) {
    if (!opts || typeof opts !== 'object' || Array.isArray(opts)) throw new Error(`lexicon: ${lang} ${where}: "${text}" options must be an object`);
    for (const k of Object.keys(opts)) if (!OPT_KEYS.has(k)) throw new Error(`lexicon: ${lang} ${where}: unknown option ${k}`);
    if (opts.sex !== undefined && opts.sex !== 'F' && opts.sex !== 'M') throw new Error(`lexicon: ${lang} ${where}: bad sex`);
    if (opts.to !== undefined && opts.to !== 'F' && opts.to !== 'M') throw new Error(`lexicon: ${lang} ${where}: bad to`);
    if (opts.register !== undefined && !REGISTERS.has(opts.register)) throw new Error(`lexicon: ${lang} ${where}: bad register`);
    if (opts.region !== undefined) {
      if (!Array.isArray(opts.region) || !opts.region.length) throw new Error(`lexicon: ${lang} ${where}: region must be a non-empty array`);
      e.region = Object.freeze(opts.region.slice());
    }
    for (const k of ['sex', 'to', 'register', 'note']) if (opts[k] !== undefined) e[k] = opts[k];
  }
  return Object.freeze(e);
}

function expandList(lang, script, list, where) {
  if (!Array.isArray(list)) throw new Error(`lexicon: ${lang}: ${where} must be an array`);
  return Object.freeze(list.map((raw, i) => expandEntry(lang, script, raw, `${where}[${i}]`)));
}

function buildLanguage(key, src) {
  const script = src.script;
  if (!SCRIPT_RE[script]) throw new Error(`lexicon: ${key}: unknown script ${script}`);
  const out = { key, name: src.name, native: src.native, script, notes: src.notes || '' };
  if (src.romanization) out.romanization = src.romanization;
  out.varieties = Object.freeze({ ...(src.varieties || {}) });
  out.defaultVariety = src.defaultVariety || null;
  for (const f of LANGUAGE_LIST_FIELDS) out[f] = expandList(key, script, src[f] || [], f);
  const inter = src.interjections || {};
  out.interjections = Object.freeze(Object.fromEntries(INTERJECTION_KINDS.map(k => [k, expandList(key, script, inter[k] || [], `interjections.${k}`)])));
  const fam = {};
  for (const [rel, list] of Object.entries(src.family || {})) fam[rel] = expandList(key, script, list, `family.${rel}`);
  out.family = Object.freeze(fam);
  const ph = {};
  for (const [intent, list] of Object.entries(src.phrases || {})) {
    if (!PHRASE_INTENTS.includes(intent)) throw new Error(`lexicon: ${key}: unknown phrase intent ${intent}`);
    ph[intent] = expandList(key, script, list, `phrases.${intent}`);
  }
  out.phrases = Object.freeze(ph);
  // Every region tag must be a declared variety.
  const vars = new Set(Object.keys(out.varieties));
  const all = [...LANGUAGE_LIST_FIELDS.flatMap(f => out[f]), ...Object.values(out.interjections).flat(), ...Object.values(fam).flat(), ...Object.values(ph).flat()];
  for (const e of all) for (const r of e.region || []) if (!vars.has(r)) throw new Error(`lexicon: ${key}: "${e.text}" uses undeclared variety ${r}`);
  if (out.defaultVariety && !vars.has(out.defaultVariety)) throw new Error(`lexicon: ${key}: bad default variety`);
  return Object.freeze(out);
}

/**
 * Phrase banks by language key. Each: { key, name, native, script (ISO 15924), romanization?, notes,
 * varieties, defaultVariety, greetings, howAreYou, thanks, farewells, yes, no, interjections: {surprise,
 * frustration, delight}, family: {grandmother, grandfather, mother, father, aunt, uncle, son, daughter,
 * friend, …}, affection, polite, food, phrases: {weather_hot, …, congratulations} }, every entry a frozen
 * { text, roman (non-Latin scripts), gloss, sex?, to?, region?, register?, note? }.
 * @type {Readonly<Record<string, object>>}
 */
export const LANGUAGES = Object.freeze(Object.fromEntries(
  Object.entries({ ...SOURCES_A, ...SOURCES_B, ...SOURCES_C }).map(([k, src]) => [k, buildLanguage(k, src)]),
));

/** Every language key. */
export const LANGUAGE_KEYS = Object.freeze(Object.keys(LANGUAGES));

/**
 * Other names a caller may use for a language (population home-language keys, heritage words, ISO codes).
 * A string maps to one language; an array of [key, weight] is ambiguous and is resolved per speaker.
 * @type {Readonly<Record<string, string|Array<[string, number]>>>}
 */
export const LANGUAGE_ALIASES = Object.freeze({
  chinese: Object.freeze([['mandarin', 0.55], ['cantonese', 0.45]]),
  es: 'spanish', tl: 'tagalog', fil: 'tagalog', filipino: 'tagalog', vi: 'vietnamese', ko: 'korean',
  yue: 'cantonese', zh: 'mandarin', cmn: 'mandarin', taiwanese: 'mandarin', ja: 'japanese', hy: 'armenian',
  fa: 'farsi', persian: 'farsi', iranian: 'farsi', prs: 'dari', afghan: 'dari', ps: 'pashto', ar: 'arabic',
  aii: 'assyrian', syriac: 'assyrian', aramaic: 'assyrian', chaldean: 'assyrian', am: 'amharic', ethiopian: 'amharic',
  ru: 'russian', uk: 'ukrainian', pa: 'punjabi', hi: 'hindi', ur: 'urdu', pakistani: 'urdu', hmn: 'hmong',
  km: 'khmer', cambodian: 'khmer', lo: 'lao', laotian: 'lao', th: 'thai', pt: 'portuguese', brazilian: 'portuguese',
  sm: 'samoan', to: 'tongan',
});

/**
 * Resolve a language name, alias or code to a LANGUAGES key. Ambiguous aliases ("chinese") resolve the same
 * way every time for the same seed, so one speaker keeps one language.
 * @param {string} lang
 * @param {number} [seed] the speaker's seed (npc.seed) for ambiguous aliases
 * @returns {string|null}
 */
export function resolveLanguage(lang, seed = 0) {
  if (!lang) return null;
  const k = String(lang).trim().toLowerCase();
  if (LANGUAGES[k]) return k;
  const a = LANGUAGE_ALIASES[k];
  if (!a) return null;
  if (typeof a === 'string') return a;
  const total = a.reduce((s, [, w]) => s + w, 0);
  let u = u01(hash2(seed >>> 0, hashStr(k))) * total;
  for (const [key, w] of a) { if (u < w) return key; u -= w; }
  return a[a.length - 1][0];
}

const VARIETY_BY_HERITAGE = {
  spanish: { mexican: 'mx', salvadoran: 'sv', guatemalan: 'gt', honduran: 'hn', nicaraguan: 'ni' },
  portuguese: { portuguese: 'pt', brazilian: 'br', southamerican: 'br' },
};

/**
 * The regional variety a speaker of this heritage uses for a language (Salvadoran Spanish, Brazilian
 * Portuguese), or null when the heritage says nothing about it.
 * @param {string} lang a LANGUAGES key or alias
 * @param {string} heritage a population heritage key
 * @returns {string|null}
 */
export function varietyFor(lang, heritage) {
  const k = resolveLanguage(lang);
  const t = k && VARIETY_BY_HERITAGE[k];
  return (t && t[heritage]) || null;
}
