// Legion · search: ZIP codes, places, postal cities, counties, regions and NPC ids, as an accessible combobox.
//
// Names come from one index over the pack: every Census place (the city or community a ZIP mostly belongs to),
// every postal (USPS) city name, the counties and the regions. The two kinds of city name often disagree for big
// cities (mail to "Los Angeles" covers 63 ZIPs, the city of Los Angeles 100), so a name opens its Census place,
// and the postal city is offered beside it only when the query is that exact name and it covers other ZIPs.
// A name matches when it, or one of its words, starts with the query. Results rank exact names first, then
// population, with a matching county (and region) always on the list; "Alameda County" searches counties only.
//
// The input is an ARIA 1.2 combobox with a listbox popup: arrows move the active option, Enter chooses it (or
// the first one), Escape closes the list and then clears the text. Choosing hands the item to `onChoose`;
// main.mjs flies the map there and opens the Place panel (or the NPC).

import { h, clear } from './dom.mjs';
import { fmtCompact } from './format.mjs';
import { placeKind } from './census.mjs';

const KIND_LABEL = { zip: 'ZIP', place: 'City', city: 'Postal city', county: 'County', region: 'Region', npc: 'NPC' };
const INDEXES = new WeakMap();

/** "Alameda County" for ZIPs in one county, "2 counties" otherwise. */
function countiesWhere(world, zis) {
  const counties = new Set(zis.map(i => world.z.county[i]));
  if (counties.size !== 1) return `${counties.size} counties`;
  const c = world.county([...counties][0]);
  return c ? `${c.name} County` : '';
}

const zipsWord = n => `${n} ZIP${n === 1 ? '' : 's'}`;

/** The searchable names of a world, built once: Census places and postal cities with their ZIPs, counties, regions. */
function nameIndex(world) {
  let ix = INDEXES.get(world);
  if (ix) return ix;
  const z = world.z;
  const byName = col => {
    const m = new Map();
    for (let i = 0; i < world.N; i++) {
      const name = z[col] ? z[col][i] : null;
      if (!name) continue;
      let e = m.get(name);
      if (!e) m.set(name, e = { name, lower: String(name).toLowerCase(), zis: [], pop: 0 });
      e.zis.push(i); e.pop += z.pop[i] || 0;
    }
    return m;
  };
  const places = byName('place'), cities = byName('city');
  const zipPop = zis => zis.reduce((a, i) => a + (z.pop[i] || 0), 0);
  ix = {
    places, cities,
    placeByLower: new Map([...places.values()].map(e => [e.lower, e])),
    counties: (world.counties || []).map(c => { const zis = world.zipsOfCounty(c.index); return { c, zis, lower: c.name.toLowerCase(), pop: Number.isFinite(c.pop) ? c.pop : zipPop(zis) }; }),
    regions: (world.regions || []).map(r => { const zis = world.zipsOfRegion(r.key); return { r, zis, lower: r.name.toLowerCase(), pop: zipPop(zis) }; }),
  };
  INDEXES.set(world, ix);
  return ix;
}

/** How well a name matches: 0 the exact name, 1 it starts with the query, 2 one of its words does, -1 no match. */
function matchTier(lower, q) {
  if (!q) return 1;
  if (lower === q) return 0;
  if (lower.startsWith(q)) return 1;
  return lower.includes(` ${q}`) || lower.includes(`-${q}`) || lower.includes(`(${q}`) ? 2 : -1;
}

/** A query in canonical form: lower case, single spaces, no trailing ", CA". `county` when it ends in "county". */
export function normalizeQuery(query) {
  let q = String(query || '').toLowerCase().replace(/\s+/g, ' ').trim();
  q = q.replace(/,\s*(?:ca|calif\.?|california)$|\s+california$/, '').trim();
  const county = /(?:^|\s)county$/.test(q);
  if (county) q = q.replace(/\s*county$/, '').trim();
  return { q, county };
}

/**
 * Search results for a query: an NPC id ("94110-123-0"), ZIP codes by prefix, or names: Census places (cities and
 * communities), postal cities, counties and regions, each scope once, best first.
 * @param {object} world
 * @param {object} population
 * @param {string} query
 * @param {number} [limit]
 * @returns {Array<{kind: 'npc'|'zip'|'place'|'city'|'county'|'region', label: string, detail: string, tag: string,
 *   key?: string, index?: number, county?: number, region?: string, id?: string}>}
 */
export function searchItems(world, population, query, limit = 8) {
  const raw = String(query || '').trim();
  if (!raw) return [];
  const out = [];
  const idMatch = /^(\d{5})-(\d+)-(\d+)$/.exec(raw);
  if (idMatch) {
    const npc = world.indexOf(idMatch[1]) >= 0 && population ? safe(() => population.get(raw)) : null;
    if (npc) out.push({ kind: 'npc', id: npc.id, tag: KIND_LABEL.npc, label: npc.name && (npc.name.display || npc.name.full) || raw, detail: `${npc.id} · ${npc.age} · ${npc.place && npc.place.city || ''}` });
    return out;
  }
  if (/^\d{1,5}$/.test(raw)) {
    if (raw.length < 3) return out;
    for (const r of world.search(raw, limit)) {
      if (r.kind !== 'zip') continue;
      const z = world.zip(r.index);
      out.push({ kind: 'zip', index: r.index, key: z.zip, tag: KIND_LABEL.zip, label: z.zip, detail: `${z.placeName || z.city} · ${z.countyName} County` });
    }
    return out.slice(0, limit);
  }
  const { q, county: countyOnly } = normalizeQuery(raw);
  if (!q && !countyOnly) return out;
  const ix = nameIndex(world);
  const rows = [];

  if (!countyOnly) {
    // Census places first; a postal city of the same name rides along only for the exact name, when it differs
    const named = [];
    for (const e of ix.places.values()) {
      const tier = matchTier(e.lower, q);
      if (tier < 0) continue;
      const row = { kind: 'place', key: e.name, label: e.name, tag: placeKind(world, e.name), detail: `${countiesWhere(world, e.zis)} · ${zipsWord(e.zis.length)}`, zis: e.zis, tier, pop: e.pop, group: 0 };
      const twin = ix.cities.get(e.name);
      if (tier === 0 && twin && !sameZips(twin.zis, e.zis)) row.twin = cityRow(world, twin, 0);
      named.push(row);
    }
    for (const e of ix.cities.values()) {
      if (ix.placeByLower.has(e.lower)) continue;   // the place of the same name stands for it (and offers the twin)
      const tier = matchTier(e.lower, q);
      if (tier >= 0) named.push(cityRow(world, e, tier));
    }
    named.sort((a, b) => a.tier - b.tier || b.pop - a.pop);
    for (const r of named) { rows.push(r); if (r.twin) rows.push(r.twin); }
    for (const e of ix.regions) {
      const tier = matchTier(e.lower, q);
      if (tier >= 0 && q.length >= 2) rows.push({ kind: 'region', region: e.r.key, key: e.r.key, label: e.r.name, tag: KIND_LABEL.region, detail: `${(e.r.counties || []).length} counties · ${fmtCompact(e.pop)} people`, zis: e.zis, tier, pop: e.pop, group: 2 });
    }
  }
  const counties = [];
  for (const e of ix.counties) {
    const tier = matchTier(e.lower, q);
    if (tier >= 0) counties.push({ kind: 'county', county: e.c.index, key: e.c.fips, label: `${e.c.name} County`, tag: KIND_LABEL.county, detail: `${fmtCompact(e.pop)} people · ${zipsWord(e.zis.length)}`, zis: e.zis, tier, pop: e.pop, group: 1 });
  }
  counties.sort((a, b) => a.tier - b.tier || b.pop - a.pop);
  rows.push(...counties);

  // exact names first; at the same standing, places and postal cities, then counties, then regions (stable sort)
  rows.sort((a, b) => a.tier - b.tier || a.group - b.group);
  // one row per set of ZIPs: the region "Orange County" is the county, San Francisco the city and the county
  const seen = new Set(), unique = [];
  for (const r of rows) {
    const id = r.zis.join(',');
    if (!seen.has(id)) { seen.add(id); unique.push(r); }
  }
  const room = Math.max(0, limit - out.length);
  const chosen = unique.slice(0, room);
  // a matching county and region always make the list, in place of the least of the others
  for (const kind of ['county', 'region']) {
    const best = unique.find(r => r.kind === kind);
    if (!best || chosen.includes(best) || !chosen.length) continue;
    let k = chosen.length - 1;
    while (k >= 0 && (chosen[k].kind === 'county' || chosen[k].kind === 'region')) k--;
    if (k >= 0) chosen[k] = best;
  }
  chosen.sort((a, b) => unique.indexOf(a) - unique.indexOf(b));
  for (const r of chosen) {
    const { tier: _t, pop: _p, group: _g, twin: _w, zis, ...item } = r;
    if (item.kind === 'place' || item.kind === 'city') item.index = zis[0];
    out.push(item);
  }
  return out;
}

function cityRow(world, e, tier) {
  return { kind: 'city', key: e.name, label: e.name, tag: KIND_LABEL.city, detail: `${countiesWhere(world, e.zis)} · ${zipsWord(e.zis.length)}`, zis: e.zis, tier, pop: e.pop, group: 0 };
}

function sameZips(a, b) {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  return b.every(i => s.has(i));
}

function safe(fn) { try { return fn(); } catch { return null; } }

/**
 * Wire the search box.
 * @param {{input: HTMLInputElement, list: HTMLElement, world: object, population: object, onChoose: (item: object) => void}} deps
 * @returns {{focus: () => void, close: () => void, isOpen: () => boolean, set: (text: string) => void}}
 */
export function mountSearch({ input, list, world, population, onChoose }) {
  let items = [], active = -1;
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-controls', list.id);
  list.setAttribute('role', 'listbox');

  function render() {
    clear(list);
    items.forEach((it, k) => {
      const li = h('li.search-opt', { role: 'option', id: `${list.id}-opt-${k}`, 'aria-selected': String(k === active), dataset: { kind: it.kind } },
        h('span.opt-main', it.label), h('span.opt-detail', it.detail), h('span.opt-kind', it.tag || KIND_LABEL[it.kind] || it.kind));
      li.addEventListener('mousedown', e => { e.preventDefault(); choose(k); });
      li.addEventListener('mousemove', () => { if (active !== k) { active = k; mark(); } });
      list.appendChild(li);
    });
    if (!items.length && input.value.trim()) list.appendChild(h('li.search-empty', { role: 'presentation' }, 'No ZIP, city, county or NPC matches.'));
    const open = !!input.value.trim();
    list.hidden = !open;
    input.setAttribute('aria-expanded', String(open && items.length > 0));
    mark();
  }

  function mark() {
    [...list.querySelectorAll('[role=option]')].forEach((li, k) => li.setAttribute('aria-selected', String(k === active)));
    if (active >= 0) { input.setAttribute('aria-activedescendant', `${list.id}-opt-${active}`); const el = list.children[active]; if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' }); }
    else input.removeAttribute('aria-activedescendant');
  }

  function close() { list.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); active = -1; }

  function choose(k) {
    const it = items[k];
    if (!it) return;
    input.value = it.kind === 'zip' ? `${it.label} · ${it.detail.split(' · ')[0]}` : it.label;
    close();
    input.blur();
    onChoose(it);
  }

  input.addEventListener('input', () => { items = searchItems(world, population, input.value); active = items.length ? 0 : -1; render(); });
  input.addEventListener('focus', () => { if (input.value.trim()) { items = searchItems(world, population, input.value); active = items.length ? 0 : -1; render(); } });
  input.addEventListener('blur', () => setTimeout(close, 120));
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (list.hidden) render(); if (items.length) { active = (active + 1) % items.length; mark(); } }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (items.length) { active = (active - 1 + items.length) % items.length; mark(); } }
    else if (e.key === 'Enter') { e.preventDefault(); if (items.length) choose(active >= 0 ? active : 0); }
    else if (e.key === 'Escape') {
      e.preventDefault(); e.stopPropagation();
      if (!list.hidden) close(); else if (input.value) input.value = ''; else input.blur();
    }
  });

  return {
    focus() { input.focus(); input.select(); },
    close,
    isOpen: () => !list.hidden,
    set(text) { input.value = text; },
  };
}
