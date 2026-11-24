// Legion · what the Place panel says about a place, computed from the world pack only.
//
// A "scope" is the set of ZIPs a panel summarizes: one ZIP, a city, a county or a region. Every number here is
// read or summed from the pack's columns and Census blocks; nothing is estimated or invented. Medians cannot be
// summed, so a multi-ZIP scope reports the ZIP medians weighted by households (or people) and says so.
//
// Pure functions of (world, scope): no DOM, so the build test checks them in Node.

import { Rng, Alias, hashAll } from '../engine/rng.mjs';
import {
  ACS_LANGUAGE, RACE, HISPANIC_ORIGIN, ASIAN_GROUP, ANCESTRY, ACS_COMMUTE, FIDELITY_DIMENSION, HH_TYPE, MODE, EDUCATION,
  OCCUPATION_GROUP, DWELLING, MARITAL, NATIVITY, EMPLOYMENT, SEX, SCHOOL_ENROLLMENT, label, humanize,
  vehiclesLabel, commuteTimeLabel, fmtPct,
} from './format.mjs';

const isNum = v => typeof v === 'number' && Number.isFinite(v);

/**
 * @typedef {object} Scope
 * @property {'zip'|'place'|'city'|'county'|'region'|'neighborhood'} kind  'place' is a Census place (a city or a
 *   community), 'city' a postal (USPS) city name, which often differs: mail to "Los Angeles" covers 63 ZIPs, the city of
 *   Los Angeles 100; 'neighborhood' a part of a big city by the name residents use ('the Mission')
 * @property {string} key      ZIP code, place or postal city name, county FIPS or region key (stable, used for seeds and links)
 * @property {number[]} zis    ZIP indices covered
 * @property {string} title    the place's name
 * @property {string} subtitle "94110 · San Francisco County · Bay Area"
 * @property {string} [eyebrow] the kind of place in words ('City', 'Community', 'Postal city'), when not the kind's own
 * @property {number} [zi]     the ZIP index (kind 'zip')
 * @property {number} [county] the county index (kind 'county')
 * @property {string} [region] the region key (kind 'region')
 */

/**
 * The scope of one ZIP. Its title is the ZIP's main Census place (else its postal city), or `title` when the ZIP was
 * reached by another of its names (a search for the postal city "Emeryville" lands on 94608, whose place is Oakland).
 * @param {object} world
 * @param {number} zi
 * @param {{title?: string}} [options]
 */
export function zipScope(world, zi, { title } = {}) {
  const z = world.zip(zi);
  if (!z) return null;
  const parts = [z.zip, z.countyName ? `${z.countyName} County` : null, z.regionName].filter(Boolean);
  return { kind: 'zip', key: z.zip, zi, zis: [zi], title: (typeof title === 'string' && title.trim()) || z.placeName || z.city, subtitle: parts.join(' · ') };
}

/** "Alameda County" for ZIPs in one county, "2 counties" otherwise. */
function countiesWhere(world, zis) {
  const counties = [...new Set(zis.map(i => world.z.county[i]))].map(ci => world.county(ci)).filter(Boolean);
  return counties.length === 1 ? `${counties[0].name} County` : `${counties.length} counties`;
}

/** ZIP indices whose column `col` equals `name`, ignoring case. */
function zipsNamed(world, col, name) {
  const want = String(name || '').trim().toLowerCase(), values = world.z[col], zis = [];
  if (!want || !values) return zis;
  for (let i = 0; i < world.N; i++) if (String(values[i] || '').toLowerCase() === want) zis.push(i);
  return zis;
}

const PLACE_KINDS = new WeakMap();

/**
 * What kind of Census place a name is, from the gazetteer: 'City' (incorporated), 'Community' (a Census-designated
 * place such as East Los Angeles) or 'Place' when the gazetteer does not list it.
 */
export function placeKind(world, name) {
  let kinds = PLACE_KINDS.get(world);
  if (!kinds) {
    kinds = new Map();
    for (const p of world.places || []) if (!kinds.has(p.name)) kinds.set(p.name, p.cdp ? 'Community' : 'City');
    PLACE_KINDS.set(world, kinds);
  }
  return kinds.get(name) || 'Place';
}

/**
 * The scope of every ZIP whose postal (USPS) city is `name`, ignoring case. A one-ZIP postal city is that ZIP's scope,
 * titled with the city's name.
 */
export function cityScope(world, name) {
  const zis = zipsNamed(world, 'city', name);
  if (!zis.length) return null;
  const title = world.z.city[zis[0]];
  if (zis.length === 1) return zipScope(world, zis[0], { title });
  return { kind: 'city', key: title, zis, title, eyebrow: 'Postal city', subtitle: `${countiesWhere(world, zis)} · ${zis.length} ZIPs` };
}

/**
 * The scope of every ZIP whose main Census place is `name` (a city such as Oakland, or a community such as East Los
 * Angeles), ignoring case. A one-ZIP place is that ZIP's scope.
 */
export function placeScope(world, name) {
  const zis = zipsNamed(world, 'place', name);
  if (!zis.length) return null;
  const title = world.z.place[zis[0]];
  if (zis.length === 1) return zipScope(world, zis[0], { title });
  return { kind: 'place', key: title, zis, title, eyebrow: placeKind(world, title), subtitle: `${countiesWhere(world, zis)} · ${zis.length} ZIPs` };
}

/**
 * The scope of a neighborhood of a big city by name ('the Mission', 'Boyle Heights', world.neighborhoods), ignoring
 * case and a leading "the": its ZIPs, titled with the name. A one-ZIP neighborhood is that ZIP's scope. Null when
 * the pack has no such neighborhood.
 */
export function neighborhoodScope(world, name) {
  const key = String(name || '').trim().toLowerCase().replace(/^the\s+/, '');
  if (!key || typeof world.neighborhoods !== 'function') return null;
  let hoods = [];
  try { hoods = world.neighborhoods() || []; } catch { hoods = []; }
  const e = hoods.find(n => n && String(n.key || String(n.name || '').toLowerCase().replace(/^the\s+/, '')) === key);
  if (!e || !Array.isArray(e.zis) || !e.zis.length) return null;
  const title = String(e.name).replace(/^the\b/, 'The');
  if (e.zis.length === 1) return zipScope(world, e.zis[0], { title });
  return { kind: 'neighborhood', key: e.name, zis: e.zis.slice(), title, eyebrow: 'Neighborhood', subtitle: `${e.city || world.z.city[e.zis[0]]} · ${e.zis.length} ZIPs` };
}

/** The county named `name` ('Alameda', 'Alameda County'), by its FIPS ('06001', '001'), or null. */
export function countyByKey(world, key) {
  const k = String(key || '').trim();
  if (!k) return null;
  if (world.countyByFips) {
    const byFips = world.countyByFips.get(k) || (/^\d{3}$/.test(k) ? world.countyByFips.get(`06${k}`) : null);
    if (byFips) return byFips;
  }
  const want = k.toLowerCase().replace(/\s+county$/, '').trim();
  return (world.counties || []).find(c => c.name.toLowerCase() === want) || null;
}

/** The scope of a county (by index). */
export function countyScope(world, ci) {
  const c = world.county(ci);
  if (!c) return null;
  const zis = world.zipsOfCounty(ci);
  const reg = world.regionByKey ? world.regionByKey[c.region] : null;
  return { kind: 'county', key: c.fips, county: ci, zis, title: `${c.name} County`, subtitle: [reg && reg.name, `${zis.length} ZIPs`, c.seat ? `seat: ${c.seat}` : null].filter(Boolean).join(' · ') };
}

/** The scope of a region (by key: nc fn sv si ba cc sj la oc ie sd). */
export function regionScope(world, key) {
  const reg = (world.regions || []).find(r => r.key === key);
  if (!reg) return null;
  const zis = world.zipsOfRegion(key);
  return { kind: 'region', key, region: key, zis, title: reg.name, subtitle: `${(reg.counties || []).length} counties · ${zis.length} ZIPs` };
}

/**
 * A scope for a search result: `{kind: 'zip', index}`, `{kind: 'place'|'city', key}` (a name; a 'city' item may give
 * the `index` of one of its ZIPs instead), `{kind: 'county', county}` or `{kind: 'region', region}`.
 */
export function scopeFromSearch(world, item) {
  if (!item) return null;
  if (item.kind === 'zip') return zipScope(world, item.index);
  if (item.kind === 'place') return placeScope(world, item.key);
  if (item.kind === 'city') {
    const name = typeof item.key === 'string' ? item.key : Number.isInteger(item.index) ? world.z.city[item.index] : null;
    return cityScope(world, name) || (Number.isInteger(item.index) ? zipScope(world, item.index) : null);
  }
  if (item.kind === 'county') return countyScope(world, item.county);
  if (item.kind === 'region') return regionScope(world, item.region);
  if (item.kind === 'neighborhood') return neighborhoodScope(world, item.key) || (Number.isInteger(item.index) ? zipScope(world, item.index) : null);
  return null;
}

/** Rebuild a scope from its kind and key (deep links). */
export function scopeFromKey(world, kind, key) {
  if (kind === 'zip') { const zi = world.indexOf(key); return zi >= 0 ? zipScope(world, zi) : null; }
  if (kind === 'place') return placeScope(world, key);
  if (kind === 'city') return cityScope(world, key);
  if (kind === 'county') { const c = countyByKey(world, key); return c ? countyScope(world, c.index) : null; }
  if (kind === 'region') return regionScope(world, key) || regionScope(world, ((world.regions || []).find(r => r.name.toLowerCase() === String(key).toLowerCase()) || {}).key);
  if (kind === 'neighborhood') return neighborhoodScope(world, key);
  return null;
}

/** Bounding box [x0, y0, x1, y1] (world units) of a scope's ZIPs. */
export function scopeBBox(world, scope) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const i of scope.zis) {
    const bb = world.zipBBox(i);
    if (!bb || !Number.isFinite(bb[0])) continue;
    if (bb[0] < x0) x0 = bb[0]; if (bb[1] < y0) y0 = bb[1]; if (bb[2] > x1) x1 = bb[2]; if (bb[3] > y1) y1 = bb[3];
  }
  if (!Number.isFinite(x0)) { const i = scope.zis[0]; const x = world.z.tx[i], y = world.z.ty[i]; return [x - 5, y - 5, x + 5, y + 5]; }
  return [x0, y0, x1, y1];
}

/** Outline rings (arrays of Float64Array) to draw for a scope: ZIP outlines, or county outlines for big scopes. */
export function scopeRings(world, scope) {
  if (scope.kind === 'county') return world.countyRings(scope.county);
  if (scope.kind === 'region') {
    const reg = (world.regions || []).find(r => r.key === scope.region);
    return (reg ? reg.counties : []).flatMap(fips => { const c = world.countyByFips.get(fips); return c ? world.countyRings(c.index) : []; });
  }
  return scope.zis.flatMap(i => world.zipRings(i));
}

/** Element-wise sum of an ACS block over ZIP indices. */
export function sumBlock(world, zis, block) {
  let acc = null;
  for (const i of zis) {
    const v = world.acs(i, block);
    if (!acc) acc = new Array(v.length).fill(0);
    for (let k = 0; k < v.length; k++) acc[k] += v[k] || 0;
  }
  return acc || [];
}

function weightedMean(world, zis, col, weight) {
  let s = 0, w = 0;
  for (const i of zis) { const v = world.z[col][i], wt = weight(i); if (isNum(v) && v > 0 && wt > 0) { s += v * wt; w += wt; } }
  return w > 0 ? s / w : null;
}

/**
 * Languages spoken at home (C16001, people 5 and over), most spoken first:
 * `[{key, label, count, share, lep, lepShare}]`, share in percent of people 5+, lepShare in percent of that
 * language's speakers who speak English less than very well.
 */
export function languageShares(world, zis) {
  const v = sumBlock(world, zis, 'lang'), labels = world.acsLabels('lang'), lepLabels = world.acsLabels('lang_lep');
  const total = labels.reduce((a, _, j) => a + (v[j] || 0), 0);
  if (!total) return [];
  return labels.map((key, j) => {
    const count = v[j] || 0, li = lepLabels.indexOf(key);
    const lep = li >= 0 ? v[labels.length + li] || 0 : 0;
    return { key, label: label(ACS_LANGUAGE, key), count, share: 100 * count / total, lep, lepShare: count && li >= 0 ? 100 * lep / count : null };
  }).filter(r => r.count > 0).sort((a, b) => b.count - a.count);
}

/**
 * Heritage as the Census reports it, largest first: Hispanic origins (B03001), Asian groups (B02015), Black, Native
 * American, Pacific Islander and multiracial residents (B03002) and ancestries (B04006, up to two per person, so
 * groups overlap). `[{key, label, family, count, share}]`, share in percent of residents. Catch-all "other"
 * categories are left out: they name no heritage.
 */
export function heritageShares(world, zis) {
  const race = sumBlock(world, zis, 'race'), raceL = world.acsLabels('race');
  const total = race.reduce((a, b) => a + b, 0);
  if (!total) return [];
  const rows = [];
  const add = (block, table, family, skip) => {
    const v = sumBlock(world, zis, block), labels = world.acsLabels(block);
    labels.forEach((key, j) => { if (!skip.includes(key) && v[j] > 0) rows.push({ key: `${block}:${key}`, label: label(table, key), family, count: v[j] }); });
  };
  add('hisp', HISPANIC_ORIGIN, 'Hispanic origin', ['otherhisp']);
  add('asian', ASIAN_GROUP, 'Asian group', ['otherasian']);
  for (const key of ['black', 'aian', 'nhpi', 'multi']) {
    const j = raceL.indexOf(key);
    if (j >= 0 && race[j] > 0) rows.push({ key: `race:${key}`, label: RACE[key], family: 'Race', count: race[j] });
  }
  add('anc', ANCESTRY, 'Ancestry', []);
  for (const r of rows) r.share = 100 * r.count / total;
  return rows.sort((a, b) => b.count - a.count);
}

/** The commute groups the Place panel's bar shows, in their fixed order (color follows the group, not its rank). */
export const COMMUTE_GROUPS = Object.freeze([
  { key: 'drove', label: 'Drive alone', parts: ['drove'] },
  { key: 'carpool', label: 'Carpool', parts: ['carpool'] },
  { key: 'transit', label: 'Transit', parts: ['bus', 'rail', 'ferry'] },
  { key: 'active', label: 'Walk or bike', parts: ['walk', 'bike'] },
  { key: 'wfh', label: 'Work from home', parts: ['wfh'] },
  { key: 'other', label: 'Other', parts: ['taxi', 'motorcycle', 'other'] },
]);

/**
 * How workers get to work (B08301), as the fixed COMMUTE_GROUPS: `{workers, groups: [{key, label, count, share,
 * slot, parts: [{key, label, count}]}]}`; slot 1..5 is the categorical color, 0 the neutral "other".
 */
export function commuteShares(world, zis) {
  const v = sumBlock(world, zis, 'comm'), labels = world.acsLabels('comm');
  const workers = v.reduce((a, b) => a + b, 0);
  const groups = COMMUTE_GROUPS.map((g, gi) => {
    const parts = g.parts.map(k => ({ key: k, label: label(ACS_COMMUTE, k), count: v[labels.indexOf(k)] || 0 }));
    const count = parts.reduce((a, p) => a + p.count, 0);
    return { key: g.key, label: g.label, count, share: workers ? 100 * count / workers : 0, slot: g.key === 'other' ? 0 : gi + 1, parts };
  });
  return { workers, groups };
}

/**
 * The totals and medians of a scope (cheap: a few columns summed): people, households, density, income, home value,
 * median age, owners, household size; medians weighted across ZIPs for multi-ZIP scopes (`weighted`).
 */
export function placeTotals(world, scope) {
  const z = world.z, zis = scope.zis;
  let pop = 0, hh = 0, sqmi = 0, owners = 0, persons = 0;
  for (const i of zis) {
    pop += z.pop[i] || 0; hh += z.hh[i] || 0; sqmi += z.sqmi[i] || 0;
    owners += (z.hh[i] || 0) * (z.own_sh[i] || 0) / 100;
    persons += (z.hh[i] || 0) * (z.hhsize[i] || 0);
  }
  const single = zis.length === 1, i0 = zis[0];
  return {
    weighted: !single,
    zips: zis.length,
    pop, hh,
    density: sqmi > 0 ? pop / sqmi : null,
    income: single ? z.inc[i0] : weightedMean(world, zis, 'inc', i => z.hh[i] || 0),
    value: single ? z.value[i0] : weightedMean(world, zis, 'value', i => (z.hh[i] || 0) * (z.own_sh[i] || 0)),
    ageMedian: single ? z.age_med[i0] : weightedMean(world, zis, 'age_med', i => z.pop[i] || 0),
    ownShare: hh > 0 ? 100 * owners / hh : null,
    hhSize: hh > 0 ? persons / hh : null,
  };
}

const MIXES = new WeakMap();

/**
 * The Census mixes of a scope: languages, heritage and the commute (the costly part for a big scope: every ACS row
 * of its ZIPs), kept per world and scope, so a place opened again answers at once.
 */
export function placeMixes(world, scope) {
  let cache = MIXES.get(world);
  if (!cache) MIXES.set(world, cache = new Map());
  const key = `${scope.kind}:${scope.key}:${scope.zis.length}`;
  let v = cache.get(key);
  if (!v) {
    v = { languages: languageShares(world, scope.zis), heritage: heritageShares(world, scope.zis), commute: commuteShares(world, scope.zis) };
    cache.set(key, v);
    if (cache.size > 24) cache.delete(cache.keys().next().value);
  }
  return v;
}

/**
 * Everything the Place panel shows about a scope, from the pack: totals, medians (weighted across ZIPs for
 * multi-ZIP scopes, flagged `weighted`), languages, heritage and the commute mix.
 */
export function placeStats(world, scope) {
  return { ...placeTotals(world, scope), ...placeMixes(world, scope) };
}

/**
 * n distinct residents of a scope: pop.sample for one ZIP, otherwise ZIPs drawn in proportion to population
 * (deterministic from the scope and seed).
 */
export function residentsOf(population, world, scope, n = 12, seed = 1) {
  if (scope.zis.length === 1) return population.sample(scope.zis[0], n, seed).filter(Boolean);
  const rng = new Rng(hashAll('residents', scope.kind, scope.key, seed));
  const alias = new Alias(scope.zis.map(i => world.z.pop[i] || 0));
  const out = [], seen = new Set();
  for (let t = 0; out.length < n && t < n * 8; t++) {
    const zi = scope.zis[alias.draw(rng)];
    const npc = population.sample(zi, 1, rng.next())[0];
    if (npc && !seen.has(npc.id)) { seen.add(npc.id); out.push(npc); }
  }
  return out;
}

// ------------------------------------------------------------------ Census versus generated

/** The lower bound of a bracket key: '<10k' and 'm<5' give 0, '150-200k' 150, 'f85+' 85, 'm20' 20. */
function lowerBound(key) {
  const s = String(key);
  if (/^[mf]?</i.test(s)) return 0;
  const m = /\d+/.exec(s);
  return m ? Number(m[0]) : NaN;
}

/** A banding function: the label of the last band whose lower bound is at most the key's own. */
const banded = (bands, parse = lowerBound) => key => {
  const lo = parse(key);
  if (!Number.isFinite(lo)) return null;
  let out = bands[0][1];
  for (const [from, name] of bands) if (lo >= from) out = name;
  return out;
};

const AGE_BANDS = [[0, 'Under 18'], [18, '18–24'], [25, '25–34'], [35, '35–44'], [45, '45–54'], [55, '55–64'], [65, '65–74'], [75, '75 and over']];
const INCOME_BANDS = [[0, 'Under $25k'], [25, '$25k–50k'], [50, '$50k–75k'], [75, '$75k–100k'], [100, '$100k–150k'], [150, '$150k–200k'], [200, '$200k or more']];
const lepLanguage = key => label(ACS_LANGUAGE, String(key).replace(/_lep$/, ''));
const vetBand = key => { const m = /_vet(.+)$/.exec(String(key)); return m ? `Ages ${m[1].replace(/(\d)-(?=\d)/g, '$1–').replace(/\+$/, ' and over')}` : null; };

/**
 * How each table of `pop.validate` is drawn. `rows` names the keys (a table or a function); `group` maps a raw key to
 * the row it adds to (null drops it: the shares stay those of the whole universe, so a table of veterans by age reads
 * as shares of all adults); `order` keeps an ordinal table in its own order (true: the Census order; a function: a
 * sort key), where the others sort by size; `hide` drops rows by key; `note` says what the shares are of; `featured`
 * tables show first, the rest fold away.
 */
export const FIDELITY_VIEWS = Object.freeze({
  hht: { rows: { ...HH_TYPE, male: HH_TYPE.father, female: HH_TYPE.mother }, note: 'Share of households', featured: true },
  tenure: { rows: { own: 'Owners', rent: 'Renters' }, note: 'Share of households', featured: true },
  race: { rows: RACE, note: 'Share of residents', featured: true },
  lang: { rows: ACS_LANGUAGE, note: 'Share of people 5 and over', featured: true },
  comm: { rows: { ...MODE, ...ACS_COMMUTE }, note: 'Share of workers', featured: true },
  edu: { rows: EDUCATION, order: true, note: 'Share of people 25 and over', featured: true },
  dwelling: { rows: DWELLING, note: 'Share of households' },
  veh: { rows: vehiclesLabel, order: k => (String(k).startsWith('own') ? 0 : 100) + (parseInt(String(k).replace(/\D+/g, ''), 10) || 0), note: 'Share of households' },
  hinc: { group: banded(INCOME_BANDS), order: true, note: 'Share of households' },
  sex: { rows: SEX, note: 'Share of residents' },
  age: { group: banded(AGE_BANDS, k => lowerBound(String(k).replace(/^[mf]/i, ''))), order: true, note: 'Share of residents' },
  hisp: { rows: HISPANIC_ORIGIN, note: 'Share of Hispanic residents' },
  asian: { rows: ASIAN_GROUP, note: 'Share of Asian residents' },
  nat: { rows: NATIVITY, note: 'Share of residents' },
  lep: { rows: lepLanguage, note: 'Share of people 5 and over who speak English less than very well, by language at home' },
  emp: { rows: EMPLOYMENT, note: 'Share of people 16 and over' },
  ctime: { rows: commuteTimeLabel, order: true, note: 'Share of workers who travel to work' },
  occM: { rows: OCCUPATION_GROUP, note: 'Share of employed men' },
  occF: { rows: OCCUPATION_GROUP, note: 'Share of employed women' },
  mar: { group: k => String(k).replace(/^[mf]_/i, ''), rows: MARITAL, note: 'Share of people 15 and over' },
  vet: { group: vetBand, order: true, note: 'Veterans, as a share of civilians 18 and over (the Census table leaves out active-duty service members)' },
  sch: { rows: SCHOOL_ENROLLMENT, order: true, hide: ['none'], note: 'Students, as a share of people 3 and over' },
});

/** Other names a population may give the same tables. */
const VIEW_ALIASES = Object.freeze({ type: 'hht', own: 'tenure', mode: 'comm', language: 'lang', education: 'edu', vehicles: 'veh', income: 'hinc', nativity: 'nat', school: 'sch', marital: 'mar' });
const viewKey = dim => (FIDELITY_VIEWS[dim] ? dim : VIEW_ALIASES[dim] || dim);

/** The order the fidelity panel lists tables in (unknown dimensions follow, in the order the population gave). */
const VIEW_ORDER = Object.keys(FIDELITY_VIEWS);

/** The scalar pairs of `pop.validate` (`result.scalars`): words and how to print them. */
export const FIDELITY_SCALARS = Object.freeze({
  hhsize: { label: 'Household size', format: 'number' },
  medianAge: { label: 'Median age', format: 'years' },
  under18: { label: 'Under 18', format: 'share' },
  over65: { label: '65 and over', format: 'share' },
  foreign: { label: 'Born abroad', format: 'share' },
  own: { label: 'Owners', format: 'share' },
});

const isTable = v => v && typeof v === 'object' && !Array.isArray(v) && Object.values(v).some(isNum);
const asTable = v => Array.isArray(v) ? Object.fromEntries(v.map((x, k) => [String(k), x])) : v;
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

// Shares come back as fractions, percents or raw counts depending on the dimension; bring all to percents.
function toPercents(table, keys) {
  const vals = keys.map(k => (isNum(table[k]) ? table[k] : 0));
  const sum = vals.reduce((a, b) => a + b, 0), max = Math.max(0, ...vals);
  let f = 1;
  if (max <= 1.000001) f = 100;
  else if (!(sum <= 100.5 && max <= 100)) f = sum > 0 ? 100 / sum : 0;
  return Object.fromEntries(keys.map((k, j) => [k, vals[j] * f]));
}

function rowLabel(view, key) {
  const names = view.rows;
  if (typeof names === 'function') return names(key);
  if (names && has(names, key)) return names[key];
  return view.group ? String(key) : humanize(key);
}

/** One share table: percents over the raw keys, then grouped, hidden, labeled and ordered as its view says. */
function sharesTable(dim, ta, tg, view, maxRows) {
  const keys = [...new Set([...Object.keys(ta), ...Object.keys(tg)])].filter(k => isNum(ta[k]) || isNum(tg[k]));
  if (!keys.length) return null;
  const pa = toPercents(ta, keys), pg = toPercents(tg, keys);
  const byKey = new Map();
  for (const k of keys) {
    const rowKey = view.group ? view.group(k) : k;
    if (rowKey === null || rowKey === undefined || (view.hide || []).includes(rowKey)) continue;
    const r = byKey.get(rowKey) || { key: String(rowKey), acs: 0, gen: 0 };
    r.acs += pa[k]; r.gen += pg[k];
    byKey.set(rowKey, r);
  }
  const rows = [...byKey.values()].filter(r => r.acs > 0 || r.gen > 0);
  if (!rows.length) return null;
  for (const r of rows) r.label = rowLabel(view, r.key);
  const meanGap = rows.reduce((s, r) => s + Math.abs(r.acs - r.gen), 0) / rows.length;
  if (typeof view.order === 'function') rows.sort((p, q) => view.order(p.key) - view.order(q.key));
  else if (!view.order) rows.sort((p, q) => Math.max(q.acs, q.gen) - Math.max(p.acs, p.gen));
  // ordinal tables read as a whole (a histogram cut short says nothing); the others keep their largest rows
  const shown = view.order ? rows : rows.slice(0, maxRows);
  return {
    key: dim, label: label(FIDELITY_DIMENSION, dim), kind: 'shares', rows: shown, meanGap,
    more: rows.length - shown.length, ordered: !!view.order, note: view.note || null, featured: !!view.featured,
  };
}

/** A scalar pair as a 'value' table; shares given as fractions become percents. */
function valueTable(key, acs, gen, spec) {
  const share = spec.format === 'share';
  const f = share && Math.max(Math.abs(acs), Math.abs(gen)) <= 1.000001 ? 100 : 1;
  return { key, label: spec.label || label(FIDELITY_DIMENSION, key), kind: 'value', acs: acs * f, gen: gen * f, format: spec.format || 'number', featured: true };
}

/**
 * Normalize `pop.validate(zi, households)` into what the fidelity panel draws: share tables (objects or arrays of
 * fractions, percents or counts) labeled, grouped and ordered by FIDELITY_VIEWS, and scalar pairs (from
 * `result.scalars` as `{name: {acs, generated}}`, or numbers side by side in `acs` and `generated`) as 'value'
 * tables. Featured tables come first. Returns `[]` when the result holds nothing comparable (the panel is then hidden).
 * @param {object} result
 * @param {{maxRows?: number}} [options] rows kept per table that sorts by size
 * @returns {Array<{key: string, label: string, kind: 'shares', rows: Array<{key: string, label: string, acs: number, gen: number}>,
 *   meanGap: number, more: number, ordered: boolean, note: string|null, featured: boolean}
 *   | {key: string, label: string, kind: 'value', acs: number, gen: number, format: 'number'|'years'|'share', featured: true}>}
 */
export function fidelityTables(result, { maxRows = 8 } = {}) {
  if (!result || typeof result !== 'object') return [];
  const gen = result.generated, acs = result.acs;
  if (!gen || !acs || typeof gen !== 'object' || typeof acs !== 'object') return [];
  const values = [], shares = [];
  const scalars = result.scalars && typeof result.scalars === 'object' ? result.scalars : {};
  for (const [key, pair] of Object.entries(scalars)) {
    if (pair && isNum(pair.acs) && isNum(pair.generated)) values.push(valueTable(key, pair.acs, pair.generated, FIDELITY_SCALARS[key] || {}));
  }
  for (const dim of Object.keys(acs)) {
    const a = acs[dim], g = gen[dim];
    if (a === undefined || g === undefined || a === null || g === null) continue;
    if (isNum(a) && isNum(g)) { if (!values.some(v => v.key === dim)) values.push(valueTable(dim, a, g, FIDELITY_SCALARS[dim] || {})); continue; }
    const ta = asTable(a), tg = asTable(g);
    if (!isTable(ta) || !isTable(tg)) continue;
    const t = sharesTable(dim, ta, tg, FIDELITY_VIEWS[viewKey(dim)] || {}, maxRows);
    if (t) shares.push(t);
  }
  const rank = t => { const i = VIEW_ORDER.indexOf(viewKey(t.key)); return (t.featured ? 0 : 1000) + (i >= 0 ? i : 500); };
  shares.sort((p, q) => rank(p) - rank(q));   // stable: unknown dimensions keep the population's order
  return [...values, ...shares];
}

/** A fidelity value as text: household size "2.39", median age "39.8", a share "26%". */
export function fidelityValueText(value, format) {
  if (!isNum(value)) return '—';
  if (format === 'share') return fmtPct(value);
  if (format === 'years') return value.toFixed(1);
  return Math.abs(value) >= 100 ? Math.round(value).toLocaleString('en-US') : (+value.toFixed(2)).toString();
}
