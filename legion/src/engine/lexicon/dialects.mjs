// Legion · lexicon · DIALECTS: every regional voice, assembled.
//
// A dialect is three layers: the statewide bank (dialects-common.mjs), its regional family (Bay Area, LA,
// the Central Valley, the mountains, …) and its own sub-regional lines. The merged arrays put the most local
// lines first; `regional` keeps the family-plus-local lines on their own so the dialogue engine can lean on
// them (a Fresno NPC should sound like Fresno more often than like anywhere).

import { COMMON } from './dialects-common.mjs';
import * as NORTH from './dialects-north.mjs';
import * as MID from './dialects-mid.mjs';
import * as SOUTH from './dialects-south.mjs';
import { DIALECT_KEYS } from './geography.mjs';
import { ROAD_USAGE } from './roads.mjs';

/** Line categories every dialect has (arrays of templates). */
export const LINE_CATEGORIES = Object.freeze(['greetings', 'farewells', 'fillers', 'intensifiers', 'agreement', 'surprise', 'traffic', 'prideLines', 'complaintLines', 'food']);
/** Weather conditions every dialect has lines for. */
export const WEATHER_CONDITIONS = Object.freeze(['fog', 'heat', 'rain', 'wind', 'cold', 'smoke', 'snow', 'clear']);
/** Categories with age-graded extras: `youth` (teens and twenties) and `elder` (sixty and up). */
export const AGE_CATEGORIES = Object.freeze(['greetings', 'farewells', 'agreement', 'surprise', 'intensifiers', 'fillers']);

const FAMILY_SRC = { ...NORTH.FAMILIES, ...MID.FAMILIES, ...SOUTH.FAMILIES };
const KEY_SRC = { ...NORTH.KEYS, ...MID.KEYS, ...SOUTH.KEYS };

function uniq(...arrays) {
  const seen = new Set(), out = [];
  for (const a of arrays) for (const x of a || []) if (!seen.has(x)) { seen.add(x); out.push(x); }
  return out;
}

function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
}

function mergeSlang(local, family, common) {
  const byTerm = new Map();
  for (const [origin, list] of [['common', common], ['family', family], ['local', local]]) {
    for (const s of list || []) byTerm.set(s.term, { ...s, ages: [...s.ages], origin });
  }
  return [...byTerm.values()];
}

// How people in each dialect name their own region in conversation ("out here in the IE"), which is often not
// the pack's planning region ("Los Angeles and Ventura counties", or "the Sacramento Valley" for Tahoe).
const REGION_THE = {
  sf: 'the Bay Area', eastbay: 'the East Bay', southbay: 'the South Bay', peninsula: 'the Peninsula', northbay: 'the North Bay',
  sacramento: 'Sacramento', 'valley-north': 'the North State', 'valley-south': 'the Valley', fresno: 'the Valley', kern: 'Kern County',
  'la-westside': 'the Westside', 'la-central': 'LA', 'la-eastside': 'the Eastside', sfv: 'the Valley', 'santa-clarita': 'the SCV',
  'la-south': 'South LA', 'southbay-la': 'the South Bay', longbeach: 'Long Beach', sgv: 'the SGV', ventura: 'Ventura County',
  'oc-coast': 'OC', 'oc-inland': 'OC', ie: 'the IE',
  'desert-cv': 'the Coachella Valley', 'high-desert': 'the High Desert', 'antelope-valley': 'the AV', 'low-desert': 'the desert', imperial: 'the Imperial Valley',
  'sd-coast': 'San Diego', 'sd-inland': 'San Diego',
  'central-coast': 'the Central Coast', 'santa-barbara': 'Santa Barbara', salinas: 'the Salinas Valley', 'monterey-bay': 'the Monterey Bay',
  'north-coast': 'the North Coast', 'north-inland': 'the North Coast', 'far-north': 'the North State',
  tahoe: 'Tahoe', 'gold-country': 'the foothills', 'sierra-foothills': 'the foothills', 'eastern-sierra': 'the Eastern Sierra', 'socal-mountains': 'the mountains',
};

function build(key) {
  const k = KEY_SRC[key];
  if (!k) throw new Error(`lexicon: no dialect content for "${key}"`);
  const f = FAMILY_SRC[k.family];
  if (!f) throw new Error(`lexicon: dialect "${key}" names unknown family "${k.family}"`);
  const usage = ROAD_USAGE[key];
  const d = {
    key, name: k.name, region: k.region, regionThe: REGION_THE[key] || f.name, family: k.family, familyName: f.name,
    areaCodes: [...(k.areaCodes || [])],
    the: usage.the, theShare: usage.theShare, pch: usage.pch, roadStyle: usage.style,
    register: k.register || f.register,
    words: { ...f.words, ...k.words },
  };
  for (const c of LINE_CATEGORIES) d[c] = uniq(k[c], f[c], COMMON[c]);
  d.weather = {};
  for (const w of WEATHER_CONDITIONS) d.weather[w] = uniq(k.weather && k.weather[w], f.weather && f.weather[w], COMMON.weather[w]);
  d.regional = { weather: {} };
  for (const c of LINE_CATEGORIES) d.regional[c] = uniq(k[c], f[c]);
  for (const w of WEATHER_CONDITIONS) d.regional.weather[w] = uniq(k.weather && k.weather[w], f.weather && f.weather[w]);
  for (const band of ['youth', 'elder']) {
    d[band] = {};
    for (const c of AGE_CATEGORIES) d[band][c] = uniq(k[band] && k[band][c], f[band] && f[band][c], COMMON[band] && COMMON[band][c]);
  }
  d.slang = mergeSlang(k.slang, f.slang, COMMON.slang);
  d.teams = [...(k.teams || f.teams || [])];
  d.localTerms = uniq(Object.keys(k.words || {}), Object.keys(f.words || {})).slice(0, 18);
  return deepFreeze(d);
}

/**
 * Every dialect by key (see DIALECT_KEYS): { key, name, region, regionThe, family, familyName, areaCodes, the, theShare,
 * pch, roadStyle, register, words: {term: {kind, note}}, localTerms, greetings, farewells, fillers,
 * intensifiers, agreement, surprise, weather: {fog, heat, rain, wind, cold, smoke, snow, clear}, traffic,
 * prideLines, complaintLines, food, regional: {same categories, family and local lines only}, youth: {…},
 * elder: {…}, slang: [{term, level, ages, gloss, example, origin}], teams }. Lines are {slot} templates.
 * Deeply frozen.
 * @type {Readonly<Record<string, object>>}
 */
export const DIALECTS = Object.freeze(Object.fromEntries(DIALECT_KEYS.map(k => [k, build(k)])));

/**
 * The regional families with their names, registers and member dialect keys.
 * @type {Readonly<Record<string, {name: string, register: string, keys: string[]}>>}
 */
export const DIALECT_FAMILIES = deepFreeze(Object.fromEntries(Object.entries(FAMILY_SRC).map(([fk, f]) => [fk, {
  name: f.name, register: f.register, keys: DIALECT_KEYS.filter(k => KEY_SRC[k].family === fk),
}])));
