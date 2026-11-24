// Legion · search: ZIP, city, county (world.search), regions, and NPC ids, as an accessible combobox.
//
// The input is an ARIA 1.2 combobox with a listbox popup: arrows move the active option, Enter chooses it (or
// the first one), Escape closes the list and then clears the text. Choosing hands the item to `onChoose`;
// main.mjs flies the map there and opens the Place panel (or the NPC).

import { h, clear } from './dom.mjs';
import { fmtCompact } from './format.mjs';

const KIND_LABEL = { zip: 'ZIP', city: 'City', county: 'County', region: 'Region', npc: 'NPC' };

/**
 * Search results for a query: an NPC id first when the text is one ("94110-123-0"), then world.search (ZIPs,
 * cities, counties), then regions whose name starts with or contains the text.
 * @returns {Array<{kind: string, label: string, detail: string, index?: number, county?: number, region?: string, id?: string}>}
 */
export function searchItems(world, population, query, limit = 8) {
  const q = String(query || '').trim();
  if (!q) return [];
  const out = [];
  const idMatch = /^(\d{5})-(\d+)-(\d+)$/.exec(q);
  if (idMatch && world.indexOf(idMatch[1]) >= 0) {
    const npc = population ? safe(() => population.get(q)) : null;
    if (npc) out.push({ kind: 'npc', id: npc.id, label: npc.name && (npc.name.display || npc.name.full) || q, detail: `${npc.id} · ${npc.age} · ${npc.place && npc.place.city || ''}` });
  }
  for (const r of world.search(q, limit)) {
    if (r.kind === 'zip') {
      const z = world.zip(r.index);
      out.push({ kind: 'zip', index: r.index, label: z.zip, detail: `${z.placeName || z.city} · ${z.countyName} County` });
    } else if (r.kind === 'city') {
      const z = world.zip(r.index);
      let n = 0; for (let i = 0; i < world.N; i++) if (world.z.city[i] === z.city) n++;
      out.push({ kind: 'city', index: r.index, label: z.city, detail: `${z.countyName} County · ${n} ZIP${n === 1 ? '' : 's'}` });
    } else if (r.kind === 'county') {
      const c = world.county(r.county);
      out.push({ kind: 'county', county: r.county, label: r.label, detail: `${fmtCompact(c && c.pop)} people` });
    }
  }
  const lower = q.toLowerCase();
  for (const reg of world.regions || []) {
    const name = reg.name.toLowerCase();
    if (lower.length >= 2 && (name.startsWith(lower) || name.includes(' ' + lower))) {
      out.push({ kind: 'region', region: reg.key, label: reg.name, detail: `Region · ${(reg.counties || []).length} counties` });
    }
  }
  return out.slice(0, limit);
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
        h('span.opt-main', it.label), h('span.opt-detail', it.detail), h('span.opt-kind', KIND_LABEL[it.kind] || it.kind));
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
