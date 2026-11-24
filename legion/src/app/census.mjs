// Legion · what the Place panel says about a place, computed from the world pack only.
//
// A "scope" is the set of ZIPs a panel summarizes: one ZIP, a city, a county or a region. Every number here is
// read or summed from the pack's columns and Census blocks; nothing is estimated or invented. Medians cannot be
// summed, so a multi-ZIP scope reports the ZIP medians weighted by households (or people) and says so.
//
// Pure functions of (world, scope): no DOM, so the build test checks them in Node.

import { Rng, Alias, hashAll } from '../engine/rng.mjs';
import {
  ACS_LANGUAGE, RACE, HISPANIC_ORIGIN, ASIAN_GROUP, ANCESTRY, ACS_COMMUTE, FIDELITY_DIMENSION, HH_TYPE, TENURE,
  MODE, EDUCATION, OCCUPATION_GROUP, DWELLING, STATUS, label, humanize,
} from './format.mjs';

const isNum = v => typeof v === 'number' && Number.isFinite(v);

/**
 * @typedef {object} Scope
 * @property {'zip'|'city'|'county'|'region'} kind
 * @property {string} key      ZIP code, city name, county FIPS or region key (stable, used for seeds and links)
 * @property {number[]} zis    ZIP indices covered
 * @property {string} title    the place's name
 * @property {string} subtitle "94110 · San Francisco County · Bay Area"
 * @property {number} [zi]     the ZIP index (kind 'zip')
 * @property {number} [county] the county index (kind 'county')
 * @property {string} [region] the region key (kind 'region')
 */

/** The scope of one ZIP. */
export function zipScope(world, zi) {
  const z = world.zip(zi);
  if (!z) return null;
  const parts = [z.zip, z.countyName ? `${z.countyName} County` : null, z.regionName].filter(Boolean);
  return { kind: 'zip', key: z.zip, zi, zis: [zi], title: z.placeName || z.city, subtitle: parts.join(' · ') };
}

/** The scope of every ZIP whose city is `name` (exact, case-insensitive). */
export function cityScope(world, name) {
  const want = String(name || '').trim().toLowerCase();
  const zis = [];
  for (let i = 0; i < world.N; i++) if (String(world.z.city[i] || '').toLowerCase() === want) zis.push(i);
  if (!zis.length) return null;
  if (zis.length === 1) return zipScope(world, zis[0]);
  const title = world.z.city[zis[0]];
  const counties = [...new Set(zis.map(i => world.z.county[i]))].map(ci => world.county(ci)).filter(Boolean);
  const where = counties.length === 1 ? `${counties[0].name} County` : `${counties.length} counties`;
  return { kind: 'city', key: title, zis, title, subtitle: `${where} · ${zis.length} ZIPs` };
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

/** A scope for a search result ({kind:'zip'|'city', index} | {kind:'county', county} | {kind:'region', region}). */
export function scopeFromSearch(world, item) {
  if (!item) return null;
  if (item.kind === 'zip') return zipScope(world, item.index);
  if (item.kind === 'city') return cityScope(world, world.z.city[item.index]) || zipScope(world, item.index);
  if (item.kind === 'county') return countyScope(world, item.county);
  if (item.kind === 'region') return regionScope(world, item.region);
  return null;
}

/** Rebuild a scope from its kind and key (deep links). */
export function scopeFromKey(world, kind, key) {
  if (kind === 'zip') { const zi = world.indexOf(key); return zi >= 0 ? zipScope(world, zi) : null; }
  if (kind === 'city') return cityScope(world, key);
  if (kind === 'county') { const c = world.countyByFips && world.countyByFips.get(key); return c ? countyScope(world, c.index) : null; }
  if (kind === 'region') return regionScope(world, key);
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
 * Everything the Place panel shows about a scope, from the pack: totals, medians (weighted across ZIPs for
 * multi-ZIP scopes, flagged `weighted`), languages, heritage and the commute mix.
 */
export function placeStats(world, scope) {
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
    languages: languageShares(world, zis),
    heritage: heritageShares(world, zis),
    commute: commuteShares(world, zis),
  };
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

const ROW_TABLES = {
  race: RACE, heritage: {}, type: { ...HH_TYPE, male: HH_TYPE.father, female: HH_TYPE.mother }, hht: { ...HH_TYPE, male: HH_TYPE.father, female: HH_TYPE.mother },
  tenure: TENURE, own: TENURE, mode: { ...MODE, ...ACS_COMMUTE }, comm: { ...MODE, ...ACS_COMMUTE }, lang: ACS_LANGUAGE,
  language: ACS_LANGUAGE, edu: EDUCATION, education: EDUCATION, occ: OCCUPATION_GROUP, occupation: OCCUPATION_GROUP,
  dwelling: DWELLING, status: STATUS,
};

const isTable = v => v && typeof v === 'object' && !Array.isArray(v) && Object.values(v).some(isNum);
const asTable = v => Array.isArray(v) ? Object.fromEntries(v.map((x, k) => [String(k), x])) : v;

// Shares come back as fractions, percents or raw counts depending on the dimension; bring all to percents.
function toPercents(table, keys) {
  const vals = keys.map(k => (isNum(table[k]) ? table[k] : 0));
  const sum = vals.reduce((a, b) => a + b, 0), max = Math.max(0, ...vals);
  let f = 1;
  if (max <= 1.000001) f = 100;
  else if (!(sum <= 100.5 && max <= 100)) f = sum > 0 ? 100 / sum : 0;
  return Object.fromEntries(keys.map((k, j) => [k, vals[j] * f]));
}

/**
 * Normalize `pop.validate(zi, households)` into the tables the fidelity panel draws. Accepts share tables as
 * objects or arrays of fractions, percents or counts, plus scalar pairs (e.g. mean household size).
 * Returns `[]` when the result holds nothing comparable (the panel is then hidden).
 * @returns {Array<{key: string, label: string, kind: 'shares', rows: Array<{key, label, acs, gen}>, meanGap: number}
 *   | {key: string, label: string, kind: 'value', acs: number, gen: number}>}
 */
export function fidelityTables(result, { maxRows = 8 } = {}) {
  if (!result || typeof result !== 'object') return [];
  const gen = result.generated, acs = result.acs;
  if (!gen || !acs || typeof gen !== 'object' || typeof acs !== 'object') return [];
  const out = [];
  for (const dim of Object.keys(acs)) {
    const a = acs[dim], g = gen[dim];
    if (a === undefined || g === undefined || a === null || g === null) continue;
    const dimLabel = label(FIDELITY_DIMENSION, dim);
    if (isNum(a) && isNum(g)) { out.push({ key: dim, label: dimLabel, kind: 'value', acs: a, gen: g }); continue; }
    const ta = asTable(a), tg = asTable(g);
    if (!isTable(ta) || !isTable(tg)) continue;
    const keys = [...new Set([...Object.keys(ta), ...Object.keys(tg)])].filter(k => isNum(ta[k]) || isNum(tg[k]));
    if (!keys.length) continue;
    const pa = toPercents(ta, keys), pg = toPercents(tg, keys);
    const names = ROW_TABLES[dim] || {};
    const rows = keys.map(k => ({ key: k, label: Object.prototype.hasOwnProperty.call(names, k) ? names[k] : humanize(k), acs: pa[k], gen: pg[k] }));
    const meanGap = rows.reduce((s, r) => s + Math.abs(r.acs - r.gen), 0) / rows.length;
    rows.sort((p, q) => Math.max(q.acs, q.gen) - Math.max(p.acs, p.gen));
    out.push({ key: dim, label: dimLabel, kind: 'shares', rows: rows.slice(0, maxRows), meanGap });
  }
  return out;
}
