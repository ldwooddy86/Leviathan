// Legion · settings: the model (validated, persisted, announced on the bus) and the Settings dialog.
//
// Everything is remembered in localStorage except the Claude API key, which lives in memory for the session
// unless the user ticks "remember on this device". Every network feature is off until the user allows it.
// Changes are emitted as settings:change with the key redacted; code that needs the key asks settings.get().

import { storageGet, storageSet, storageRemove } from './store.mjs';
import { h, icon, clear, toast } from './dom.mjs';
import { fmtCompact, fmtInt, fmtPct } from './format.mjs';
import { EVENTS } from './bus.mjs';
import { fmtTime } from '../engine/clock.mjs';

/** Crowd densities offered (shares of households sampled). */
export const DENSITIES = Object.freeze([0.005, 0.01, 0.025, 0.05, 0.1]);

/** Theme choices. */
export const THEMES = Object.freeze(['dark', 'light', 'system']);

/** Where settings live in localStorage (the head script of index.html reads `theme` from it before paint). */
export const SETTINGS_KEY = 'legion.settings.v1';
/** Where the API key lives when the user asks to remember it. */
export const API_KEY_KEY = 'legion.claude.apiKey';

/** Defaults: dark, 2.5 % crowd (about a million agents), Opus at low effort, no network. */
export const DEFAULT_SETTINGS = Object.freeze({
  density: 0.025,
  theme: 'dark',
  claude: Object.freeze({ model: 'claude-opus-5-5', effort: 'low', remember: false }),
  network: Object.freeze({ claude: false, nws: false, osm: false }),
});

const MODEL_IDS = ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-fable-5-2'];
const EFFORTS = ['low', 'medium', 'high'];

/**
 * A complete, valid settings object from anything (stored JSON from another version, a patch): unknown or
 * invalid values fall back to the defaults.
 * @param {object} raw
 * @param {{models?: string[], efforts?: string[]}} [allowed]
 */
export function normalizeSettings(raw, { models = MODEL_IDS, efforts = EFFORTS } = {}) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const c = r.claude && typeof r.claude === 'object' ? r.claude : {};
  const n = r.network && typeof r.network === 'object' ? r.network : {};
  const density = DENSITIES.includes(r.density) ? r.density : DEFAULT_SETTINGS.density;
  return {
    density,
    theme: THEMES.includes(r.theme) ? r.theme : DEFAULT_SETTINGS.theme,
    claude: {
      model: models.includes(c.model) ? c.model : DEFAULT_SETTINGS.claude.model,
      effort: efforts.includes(c.effort) ? c.effort : DEFAULT_SETTINGS.claude.effort,
      remember: c.remember === true,
    },
    network: { claude: n.claude === true, nws: n.nws === true, osm: n.osm === true },
  };
}

function diffKeys(a, b, prefix = '') {
  const out = [];
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const va = a[k], vb = b[k];
    if (va && vb && typeof va === 'object' && typeof vb === 'object') out.push(...diffKeys(va, vb, `${prefix}${k}.`));
    else if (va !== vb) out.push(prefix + k);
  }
  return out;
}

/** The settings model. */
export class Settings {
  /**
   * @param {{bus?: {emit: Function}, models?: string[], efforts?: string[]}} [options]
   */
  constructor({ bus = null, models = MODEL_IDS, efforts = EFFORTS } = {}) {
    this.bus = bus;
    this.allowed = { models, efforts };
    this.values = normalizeSettings(storageGet(SETTINGS_KEY, null), this.allowed);
    const saved = this.values.claude.remember ? storageGet(API_KEY_KEY, '') : '';
    this.apiKey = typeof saved === 'string' ? saved : '';
    this.proxyURL = '';
  }

  /** The full settings, including the in-memory API key and any detected proxy (for services.voice). */
  get() {
    const v = structuredClone(this.values);
    v.claude.apiKey = this.apiKey;
    v.claude.proxyURL = this.proxyURL;
    return v;
  }

  /** Settings safe to share (bus, JSON export): no key, just whether one is set. */
  public() {
    const v = structuredClone(this.values);
    v.claude.hasKey = !!this.apiKey;
    v.claude.proxy = !!this.proxyURL;
    return v;
  }

  /** Merge a patch ({density}, {claude: {model}}, ...), validate, persist and emit; returns the changed keys. */
  set(patch) {
    const before = this.values;
    const merged = {
      ...before, ...patch,
      claude: { ...before.claude, ...(patch && patch.claude) },
      network: { ...before.network, ...(patch && patch.network) },
    };
    this.values = normalizeSettings(merged, this.allowed);
    if (!this.values.claude.remember) storageRemove(API_KEY_KEY);
    else if (this.apiKey) storageSet(API_KEY_KEY, this.apiKey);
    const changed = diffKeys(before, this.values);
    if (changed.length) this._persistAndEmit(changed);
    return changed;
  }

  /** Set the API key (kept in memory; stored only while "remember on this device" is on). */
  setApiKey(key) {
    const next = String(key || '').trim();
    if (next === this.apiKey) return [];
    this.apiKey = next;
    if (this.values.claude.remember && next) storageSet(API_KEY_KEY, next); else storageRemove(API_KEY_KEY);
    this._persistAndEmit(['claude.apiKey']);
    return ['claude.apiKey'];
  }

  /** A local Claude proxy (the Legion server) was found; Claude can be used without a key in the page. */
  setProxyURL(url) {
    const next = String(url || '');
    if (next === this.proxyURL) return;
    this.proxyURL = next;
    this._emit(['claude.proxyURL']);
  }

  /** Back to the defaults (and forget a stored key). */
  reset() {
    const before = this.values;
    this.values = normalizeSettings({}, this.allowed);
    this.apiKey = '';
    storageRemove(API_KEY_KEY);
    this._persistAndEmit(diffKeys(before, this.values).concat('claude.apiKey'));
  }

  /** 'dark' or 'light' as shown now (resolving 'system' through the OS preference). */
  resolvedTheme() {
    if (this.values.theme !== 'system') return this.values.theme;
    try { return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; } catch { return 'dark'; }
  }

  _persistAndEmit(changed) {
    storageSet(SETTINGS_KEY, this.values);
    this._emit(changed);
  }

  _emit(changed) {
    if (this.bus) this.bus.emit(EVENTS.SETTINGS_CHANGE, { settings: this.public(), changed });
  }
}

/** Put the theme on <html>: data-theme for an explicit choice, none for 'system' (the media query decides). */
export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') root.setAttribute('data-theme', theme);
  else root.removeAttribute('data-theme');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', getComputedStyle(root).getPropertyValue('--panel').trim() || '#18191c');
}

// ------------------------------------------------------------------ the dialog

let uid = 0;
const nextId = p => `${p}-${++uid}`;

function segmented(name, options, value, onChange, ariaLabel) {
  const group = h('div.segmented', { role: 'radiogroup', 'aria-label': ariaLabel });
  for (const o of options) {
    const id = nextId(name);
    const input = h('input', { type: 'radio', name, id, value: o.value, checked: o.value === value, on: { change: () => onChange(o.value) } });
    group.append(input, h('label', { for: id }, o.label));
  }
  return group;
}

function toggle(label, description, checked, onChange) {
  const id = nextId('toggle');
  return h('div.toggle-row',
    h('input.switch', { type: 'checkbox', role: 'switch', id, checked, on: { change: e => onChange(e.target.checked) } }),
    h('label', { for: id }, h('span.toggle-label', label), h('span.toggle-desc', description)));
}

/**
 * Build the Settings dialog in `dialog` (a <dialog>) and return its controller. The body is built when the dialog
 * opens; later changes update only the lines that depend on them, so focus stays where the user left it.
 * @param {HTMLDialogElement} dialog
 * @param {{settings: Settings, services: object, world: object, getBuild?: () => ({agents?: number, ms?: number, rate?: number} | null),
 *   onClearMinds?: () => void, buildId?: string}} deps
 * @returns {{open: () => void, close: () => void, refresh: () => void, isOpen: () => boolean}}
 */
export function mountSettingsDialog(dialog, deps) {
  const { settings, services, world } = deps;
  const body = h('div.dialog-body');
  const titleId = nextId('settings-title');
  dialog.setAttribute('aria-labelledby', titleId);
  clear(dialog).append(
    h('div.dialog-card',
      h('header.dialog-head',
        h('h2', { id: titleId }, 'Settings'),
        h('button.icon-btn', { type: 'button', 'aria-label': 'Close settings', on: { click: () => dialog.close() } }, icon('close'))),
      body));

  // a click on the backdrop (the dialog element itself, outside the card) closes it
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });

  const claudeLine = h('p.set-help', { 'aria-live': 'polite' });
  const builtLine = h('span');

  function claudeText() {
    const s = settings.get();
    if (!services.available('llm')) return 'The Claude bridge arrives with the next build; your choices here are kept for it.';
    if (!s.network.claude) return 'Claude is off until you allow the Claude API under Network.';
    if (s.claude.proxyURL) return 'Using the Legion server’s Claude proxy: the key stays on the server.';
    return s.claude.apiKey ? 'Ready. Conversations go straight from this browser to api.anthropic.com.' : 'Add an API key to talk with Claude.';
  }

  function builtText() {
    const s = settings.get();
    const build = deps.getBuild ? deps.getBuild() : null;
    if (build && build.building) return `Building ${fmtPct((build.rate ?? s.density) * 100)}…`;
    if (build && build.agents >= 0) return `Built: ${fmtInt(build.agents)} agents at ${fmtPct((build.rate ?? s.density) * 100)}${build.ms ? ` in ${(build.ms / 1000).toFixed(1)} s` : ''}.`;
    return 'The crowd builds when the map opens.';
  }

  function update() { claudeLine.textContent = claudeText(); builtLine.textContent = builtText(); }

  function section(title, ...content) { return h('section.set-section', h('h3', title), ...content); }

  function render() {
    const s = settings.get();

    const densityGroup = h('div.density', { role: 'radiogroup', 'aria-label': 'Crowd density' });
    for (const rate of DENSITIES) {
      const id = nextId('density');
      const input = h('input', { type: 'radio', name: 'density', id, value: String(rate), checked: rate === s.density, on: { change: () => { settings.set({ density: rate }); update(); } } });
      densityGroup.append(input, h('label', { for: id }, h('span.d-rate', fmtPct(rate * 100)), h('span.d-count', `≈ ${fmtCompact(world.totalPop * rate)} agents`)));
    }

    const keyId = nextId('apikey');
    const keyInput = h('input.text-input', { type: 'password', id: keyId, autocomplete: 'off', spellcheck: 'false', placeholder: 'sk-ant-…', value: s.claude.apiKey, 'aria-describedby': keyId + '-help' });
    keyInput.addEventListener('change', () => { settings.setApiKey(keyInput.value); update(); });
    const reveal = h('button.btn.ghost.small', { type: 'button', 'aria-pressed': 'false', 'aria-controls': keyId }, 'Show');
    reveal.addEventListener('click', () => {
      const show = keyInput.type === 'password';
      keyInput.type = show ? 'text' : 'password';
      reveal.setAttribute('aria-pressed', String(show));
      reveal.textContent = show ? 'Hide' : 'Show';
    });
    const rememberId = nextId('remember');
    const modelId = nextId('model');
    const models = services.models();
    const modelNote = h('p.set-note', { 'aria-live': 'polite' });
    const describe = id => {
      const m = models.find(x => x.id === id);
      modelNote.textContent = m ? [m.description, m.price ? `$${m.price.input} input / $${m.price.output} output per million tokens.` : null].filter(Boolean).join(' ') : '';
      modelNote.hidden = !modelNote.textContent;
    };
    const modelSelect = h('select.select', { id: modelId, on: { change: e => { settings.set({ claude: { model: e.target.value } }); describe(e.target.value); } } },
      models.map(m => h('option', { value: m.id, selected: m.id === s.claude.model }, m.note ? `${m.label} · ${m.note}` : m.label)));
    describe(s.claude.model);
    const pingOut = h('p.set-note', { role: 'status' });
    const pingBtn = services.available('llm') ? h('button.btn.small', { type: 'button', title: 'Check the key and the model without spending tokens' }, 'Check') : null;
    if (pingBtn) pingBtn.addEventListener('click', async () => {
      if (keyInput.value !== settings.get().claude.apiKey) settings.setApiKey(keyInput.value);
      pingBtn.disabled = true; pingOut.textContent = 'Checking…';
      const r = await services.pingVoice(settings.get());
      pingBtn.disabled = false;
      pingOut.textContent = r.ok ? `It works: ${r.value.label || r.value.model}${Number.isFinite(r.value.latencyMs) ? `, ${r.value.latencyMs} ms` : ''}.` : r.message;
    });

    clear(body).append(
      section('Crowd density',
        h('p.set-help', 'The share of California’s households the map simulates. Every agent is a real NPC you can open; 2.5% is about a million people.'),
        densityGroup,
        h('p.set-note', { 'aria-live': 'polite' }, builtLine, ' Five and ten percent want a desktop GPU.')),
      section('Appearance',
        h('div.field', h('span.field-label', 'Theme'),
          segmented('theme', [{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }, { value: 'system', label: 'System' }], s.theme, v => settings.set({ theme: v }), 'Theme'))),
      section('Claude',
        claudeLine,
        h('div.field',
          h('label.field-label', { for: keyId }, 'API key'),
          h('div.key-row', keyInput, reveal, pingBtn),
          h('p.set-note', { id: keyId + '-help' }, 'Kept in memory for this session. Nothing is sent anywhere unless the Claude API is allowed below.'),
          pingOut),
        h('div.check-row',
          h('input', { type: 'checkbox', id: rememberId, checked: s.claude.remember, on: { change: e => { if (e.target.checked && keyInput.value) settings.setApiKey(keyInput.value); settings.set({ claude: { remember: e.target.checked } }); update(); } } }),
          h('label', { for: rememberId }, 'Remember the key on this device')),
        h('div.field-grid',
          h('div.field', h('label.field-label', { for: modelId }, 'Model'), modelSelect),
          h('div.field', h('span.field-label', 'Effort'),
            segmented('effort', services.efforts().map(e => ({ value: e, label: e[0].toUpperCase() + e.slice(1) })), s.claude.effort, v => settings.set({ claude: { effort: v } }), 'Effort'))),
        modelNote),
      section('Network',
        h('p.set-help', 'Legion runs offline from the data in this file. Each of these reaches out only when you allow it.'),
        toggle('Claude API', 'Sends the conversation and the NPC’s persona to api.anthropic.com.', s.network.claude, v => { settings.set({ network: { claude: v } }); update(); }),
        toggle('Live NWS weather', 'Refreshes forecasts and alerts from api.weather.gov. Off: the NWS snapshot in the pack.', s.network.nws, v => settings.set({ network: { nws: v } })),
        toggle('OpenStreetMap streets', 'Loads real streets for the street view from the Overpass API. Off: streets drawn from the ZIP’s data.', s.network.osm, v => settings.set({ network: { osm: v } }))),
      section('Engine',
        h('ul.module-list', services.status().map(m => h('li', { class: m.available ? 'is-ready' : 'is-pending' },
          h('span.module-dot', { 'aria-hidden': 'true' }),
          h('span.module-name', m.title),
          h('span.module-state', m.available ? 'Ready' : 'Next build'),
          h('span.module-desc', m.provides))))),
      section('Data',
        h('p.set-help', `${fmtInt(world.totalPop)} Californians in ${fmtInt(world.totalHH)} households across ${fmtInt(world.N)} ZIPs: Census ACS 2020–2024 tables by ZIP, the California atlas’s housing, climate and wildfire columns, the Caltrans 2024 traffic census, the USGS gazetteer and the NWS snapshot of ${Number.isFinite(world.snapshotTime) ? `${fmtTime(world.snapshotTime)} PT` : 'the pack'}.`),
        deps.buildId ? h('p.set-note.mono', `Build ${deps.buildId}`) : null,
        h('div.btn-row',
          h('button.btn', { type: 'button', on: { click: () => { if (deps.onClearMinds) deps.onClearMinds(); toast('NPC memories cleared'); } } }, 'Clear NPC memories'),
          h('button.btn.reset-settings', { type: 'button', on: { click: () => { settings.reset(); render(); toast('Settings reset'); const b = body.querySelector('.reset-settings'); if (b) b.focus(); } } }, 'Reset settings'))),
    );
    update();
  }

  return {
    open() {
      render();
      if (!dialog.open) dialog.showModal();
      const first = body.querySelector('input:checked') || body.querySelector('input, select, button');
      if (first) first.focus();
    },
    close() { if (dialog.open) dialog.close(); },
    refresh() { if (dialog.open) update(); },
    isOpen() { return dialog.open; },
  };
}
