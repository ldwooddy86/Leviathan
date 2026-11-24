// Legion · the map stage: the statewide MapView and the GPU crowd (both from services), plus the page's own
// layer on top: the selected place's outline, the selected NPC's home and workplace, the hover tooltip, the
// legend, the zoom controls and the crowd's build progress.
//
// The stage only uses the MapView and Crowd APIs of the contract (camera, flyTo, fitState, screenToWorld,
// worldToScreen, on, resize, setTheme; build, setTime, setVisible, pick, stats). Its overlay is a separate 2D
// canvas with pointer-events off, drawn through the map's own worldToScreen, so it follows any camera.

import { EVENTS } from './bus.mjs';
import { h, icon, clear, prefersReducedMotion } from './dom.mjs';
import { fmtInt, fmtPct, displayName } from './format.mjs';
import { scopeRings } from './census.mjs';
import { npcIdFrom } from './services.mjs';

/**
 * The crowd's kinds (CONTRACTS section 8; crowd.setVisible takes these names) and how the legend draws them. The
 * colors are the --crowd-* tokens the crowd itself reads, so the legend and the dots always agree; drivers are
 * two colors (heading out, heading home).
 */
export const DEFAULT_KINDS = Object.freeze([
  { key: 'walk', label: 'Walking', color: 'var(--crowd-walk)' },
  { key: 'drive', label: 'Driving', color: 'linear-gradient(90deg, var(--crowd-drive-out) 50%, var(--crowd-drive-home) 50%)', title: 'Driving: heading out (light) and heading home (red)' },
  { key: 'bike', label: 'Cycling', color: 'var(--crowd-bike)' },
  { key: 'transit', label: 'Transit', color: 'var(--crowd-transit)' },
  { key: 'errand', label: 'Errands', color: 'var(--crowd-errand)' },
  { key: 'home', label: 'At home', color: 'var(--crowd-home)', title: 'Everyone at home, as faint dots' },
]);

const MODE_WORD = { walk: 'walking', drive: 'driving', carpool: 'in a carpool', bus: 'on the bus', rail: 'on the train', ferry: 'on the ferry', taxi: 'in a taxi', motorcycle: 'on a motorcycle', bike: 'cycling', transit: 'on transit', errand: 'out on an errand', other: 'on the move', wfh: 'working from home', home: 'at home', work: 'at work' };
const STATE_PLACE = { 'to-work': 'to {dest}', 'to-home': 'home', 'to-errand': 'to an errand', 'from-errand': 'back from an errand' };
const STATE_STILL = { home: 'at home', 'at-work': 'at {dest}', 'at-errand': 'out on an errand' };

/** What a picked agent is doing, in words: "driving to work", "walking home", "at school". */
export function motionText(mode, state, dest = 'work') {
  if (state && STATE_STILL[state]) return STATE_STILL[state].replace('{dest}', dest);
  const how = MODE_WORD[mode] || (mode ? String(mode) : 'on the move');
  return state && STATE_PLACE[state] ? `${how} ${STATE_PLACE[state].replace('{dest}', dest)}` : how;
}

function readTokens() {
  const cs = getComputedStyle(document.documentElement);
  const v = name => cs.getPropertyValue(name).trim();
  return { accent: v('--accent') || '#f0904a', ink: v('--ink') || '#eee', ink3: v('--ink-3') || '#999', panel: v('--panel') || '#18191c', accentSoft: v('--accent-soft') || 'rgba(240,144,74,.15)' };
}

/** Normalize a crowd kind entry (a string or {key, label, color}), filling in the legend's defaults. */
function kindOf(k) {
  const key = typeof k === 'string' ? k : (k.key || k.id || k.name);
  const known = DEFAULT_KINDS.find(d => d.key === key) || {};
  if (typeof k === 'string') return { ...known, key, label: known.label || key[0].toUpperCase() + key.slice(1) };
  return { ...known, key, label: k.label || known.label || key, color: k.color || known.color || null };
}

/** A count small enough for a legend chip: 950, 1.1K, 12K, 1.2M. */
export function shortCount(n) {
  if (!Number.isFinite(n)) return '';
  if (n < 1000) return String(Math.round(n));
  if (n < 1e6) return `${(n / 1000).toFixed(n < 1e4 ? 1 : 0).replace(/\.0$/, '')}K`;
  return `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
}

/** The moving count from stats(): movingTotal, a number, or an object of counts by kind. */
export function movingTotal(stats) {
  if (!stats) return 0;
  if (typeof stats.movingTotal === 'number') return stats.movingTotal;
  const m = stats.moving;
  if (typeof m === 'number') return m;
  if (m && typeof m === 'object') return Object.values(m).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0);
  return 0;
}

/** The map stage. */
export class Stage {
  /**
   * @param {{root: HTMLElement, mapEl: HTMLElement, services: object, bus: object, theme: string,
   *   getTime: () => number}} deps
   */
  constructor({ root, mapEl, services, bus, theme, getTime }) {
    this.root = root; this.mapEl = mapEl; this.services = services; this.bus = bus; this.getTime = getTime;
    this.world = services.world;
    this.theme = theme;
    this.map = null; this.crowd = null;
    this.mapError = null; this.crowdError = null;
    this.scope = null; this.npc = null; this.npcNow = null; this.hoverZi = -1;
    this.insets = { left: 0, right: 0, top: 0, bottom: 0 };
    this.build = { building: false, agents: null, rate: null, ms: null, progress: 0 };
    this._buildToken = 0;
    this._lastT = null;
    this._xf = null; this._dirty = true;
    this._hoverQueued = false; this._lastPointer = null;
    this._tokens = readTokens();
    this._ringCache = new Map();

    this.overlay = h('canvas.overlay', { 'aria-hidden': 'true' });
    this.ui = h('div.map-ui');
    this.tooltip = h('div.map-tip', { role: 'tooltip', hidden: true });
    this.progress = h('div.build-card', { role: 'status', hidden: true });
    this.legend = h('div.legend', { role: 'group', 'aria-label': 'Who is moving' });
    this.banner = h('div.map-banner', { role: 'alert', hidden: true });
    this.controls = h('div.map-controls', { role: 'group', 'aria-label': 'Map controls' },
      h('button.icon-btn', { type: 'button', 'aria-label': 'Zoom in', title: 'Zoom in', on: { click: () => this.zoomBy(1.8) } }, icon('plus')),
      h('button.icon-btn', { type: 'button', 'aria-label': 'Zoom out', title: 'Zoom out', on: { click: () => this.zoomBy(1 / 1.8) } }, icon('minus')),
      h('button.icon-btn', { type: 'button', 'aria-label': 'Show all of California', title: 'Show all of California', on: { click: () => this.fitState() } }, icon('fit')));
    this.ui.append(this.banner, this.controls, h('div.map-bottom', this.progress, this.legend), this.tooltip);
    root.append(this.overlay, this.ui);
  }

  /** Create the map (a failure leaves the page usable: search and the panels still work). */
  start() {
    try {
      this.map = this.services.createMap(this.mapEl, { theme: this.theme });
    } catch (e) {
      this.mapError = e;
      this.showBanner(`The map could not start (${e && e.message ? e.message : e}). Search and the panels still work.`);
      this.mapEl.append(h('div.map-fallback', h('p', 'This browser could not draw the map.'), h('p.muted', 'Search for a ZIP, city or county above to explore its people.')));
      return false;
    }
    const map = this.map;
    if (typeof map.on === 'function') {
      map.on('move', () => { this._dirty = true; const c = map.camera || {}; this.bus.emit(EVENTS.VIEW_CHANGE, { mode: 'map', x: c.x, y: c.y, zoom: c.zoom }); });
      map.on('click', p => this._onClick(p));
    }
    this.mapEl.addEventListener('pointermove', e => this._onPointer(e));
    this.mapEl.addEventListener('pointerleave', () => this._clearHover());
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => this.resize()) : null;
    if (ro) ro.observe(this.root); else window.addEventListener('resize', () => this.resize());
    this.resize();
    return true;
  }

  // ------------------------------------------------ crowd

  /**
   * Build (or rebuild) the crowd at `rate`. The newest request wins: the crowd replaces a build in progress, and
   * an older build that finishes (or reports itself cancelled) no longer touches the page.
   * @returns {Promise<object|null>} the build summary, or null when a newer build took over
   */
  async buildCrowd(rate) {
    if (!this.map) return null;
    const token = ++this._buildToken;
    this.build = { building: true, agents: null, rate, ms: null, progress: 0 };
    this._showProgress(0, rate);
    const t0 = performance.now();
    let summary = null;
    try {
      if (!this.crowd) {
        this.crowd = this.services.createCrowd(this.map, { rate });
        this._renderLegend();
      }
      summary = await this.crowd.build({ rate, onProgress: (p, agents) => { if (token === this._buildToken) this._showProgress(p, rate, agents); } });
      if (token !== this._buildToken) return null;   // a newer build owns the page now
      if (summary && summary.cancelled) {
        // replaced by a build this page did not start: report what is there and stop showing progress
        this.build = { building: false, agents: Number.isFinite(summary.agents) ? summary.agents : 0, rate, ms: null, progress: 1, summary };
        this.progress.hidden = true;
        return null;
      }
      if (typeof this.crowd.setTime === 'function') { this._lastT = this.getTime(); this.crowd.setTime(this._lastT); }
      const stats = this._stats();
      const agents = (summary && Number.isFinite(summary.agents)) ? summary.agents : (stats && Number.isFinite(stats.agents) ? stats.agents : 0);
      this.build = { building: false, agents, rate, ms: performance.now() - t0, progress: 1, summary };
      this.crowdError = null;
      this._finishProgress();
    } catch (e) {
      if (token !== this._buildToken) return null;
      this.crowdError = e;
      this.build = { building: false, agents: 0, rate, ms: null, progress: 0, error: e };
      this.progress.hidden = true;
      this.showBanner(`The crowd could not be built (${e && e.message ? e.message : e}). The map, search and panels still work.`);
    }
    this._dirty = true;
    return summary;
  }

  _showProgress(p, rate, agents) {
    let frac = 0;
    if (typeof p === 'number') frac = p;
    else if (p && typeof p === 'object') frac = p.progress ?? p.fraction ?? (p.total ? (p.done || 0) / p.total : 0);
    frac = Math.max(0, Math.min(1, frac || 0));
    this.build.progress = frac;
    const pct = Math.round(frac * 100);
    this.progress.hidden = false;
    this.progress.classList.remove('is-done');
    clear(this.progress).append(
      h('div.build-line', h('span.build-title', `Building the crowd · ${fmtPct(rate * 100)}`), h('span.build-pct', `${pct}%`)),
      h('div.bar', { role: 'progressbar', 'aria-label': 'Crowd build progress', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(pct) }, h('span', { style: { width: `${pct}%` } })),
      Number.isFinite(agents) && agents > 0 ? h('div.build-sub', `${fmtInt(agents)} agents so far`) : p && typeof p === 'object' && p.label ? h('div.build-sub', String(p.label)) : null);
  }

  _finishProgress() {
    const b = this.build;
    clear(this.progress).append(
      h('div.build-line', h('span.build-title', `${fmtInt(b.agents)} NPCs simulated`), h('span.build-pct', b.ms ? `${(b.ms / 1000).toFixed(1)} s` : '')),
      h('div.bar', { role: 'progressbar', 'aria-label': 'Crowd build progress', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '100' }, h('span', { style: { width: '100%' } })));
    this.progress.classList.add('is-done');
    clearTimeout(this._progressTimer);
    this._progressTimer = setTimeout(() => { if (!this.build.building) this.progress.hidden = true; }, 2600);
  }

  _stats() {
    if (!this.crowd || typeof this.crowd.stats !== 'function') return null;
    try { return this.crowd.stats(); } catch { return null; }
  }

  /** `{agents, moving, byKind}` for the top bar and the legend. */
  counts() {
    const s = this._stats();
    // the build summary is authoritative once a build is done (a worker's stats can lag a moment behind it)
    const built = !this.build.building && Number.isFinite(this.build.agents) ? this.build.agents : null;
    const agents = built !== null && built > 0 ? built : (s && Number.isFinite(s.agents) ? s.agents : (built ?? 0));
    const byKind = s && s.moving && typeof s.moving === 'object' ? s.moving : null;
    return { agents, moving: movingTotal(s), byKind };
  }

  _kinds() {
    const c = this.crowd;
    const list = (c && Array.isArray(c.kinds) && c.kinds) || (c && c.constructor && Array.isArray(c.constructor.KINDS) && c.constructor.KINDS) || null;
    // a crowd that reports what it draws (visibleKinds) can be toggled from the legend; a stub cannot
    const interactive = !!(c && typeof c.setVisible === 'function' && (list || typeof c.visibleKinds === 'function'));
    const kinds = (list || DEFAULT_KINDS).map(kindOf);
    let shown = kinds.map(k => k.key);
    if (interactive && typeof c.visibleKinds === 'function') { try { shown = c.visibleKinds(); } catch { /* keep all */ } }
    return { kinds: interactive ? kinds : kinds.filter(k => k.key !== 'home'), interactive, shown: new Set(shown) };
  }

  _renderLegend() {
    const { kinds, interactive, shown } = this._kinds();
    this.visible = new Set(kinds.filter(k => shown.has(k.key)).map(k => k.key));
    clear(this.legend);
    for (const k of kinds) {
      const dot = h('span.legend-dot', { style: { background: k.color || `var(--crowd-${k.key}, var(--ink-3))` } });
      const count = h('span.legend-count');
      const on = this.visible.has(k.key);
      const chip = interactive
        ? h('button.legend-chip', { type: 'button', 'aria-pressed': String(on), title: k.title || `Show or hide ${k.label.toLowerCase()}`, dataset: { kind: k.key } }, dot, h('span', k.label), count)
        : h('span.legend-chip', { title: k.title || null, dataset: { kind: k.key } }, dot, h('span', k.label), count);
      if (interactive) chip.addEventListener('click', () => {
        if (this.visible.has(k.key)) this.visible.delete(k.key); else this.visible.add(k.key);
        chip.setAttribute('aria-pressed', String(this.visible.has(k.key)));
        try { this.crowd.setVisible([...this.visible]); } catch (e) { console.error('[legion] setVisible failed', e); }
      });
      this.legend.append(chip);
    }
  }

  /** Refresh the legend's per-kind counts (cheap; called a few times a second). */
  updateLegend(byKind) {
    for (const chip of this.legend.children) {
      const key = chip.dataset.kind, el = chip.querySelector('.legend-count');
      if (el) el.textContent = byKind && typeof byKind[key] === 'number' ? shortCount(byKind[key]) : '';
    }
  }

  // ------------------------------------------------ camera

  /** CSS pixels per world unit right now (measured through worldToScreen, so it holds for any zoom convention). */
  scale() {
    const m = this.map; if (!m) return 1;
    const c = m.camera || { x: 0, y: 0 };
    const a = m.worldToScreen(c.x, c.y), b = m.worldToScreen(c.x + 100, c.y);
    const s = (b.px - a.px) / 100;
    return Number.isFinite(s) && s > 0 ? s : 1;
  }

  _zoomFor(scale) {
    const z = this.map.camera && this.map.camera.zoom;
    const now = this.scale();
    return Number.isFinite(z) && z > 0 ? z * scale / now : scale;
  }

  _fly(x, y, scale, ms) {
    if (!this.map) return;
    const dur = prefersReducedMotion() ? 0 : ms;
    try { this.map.flyTo(x, y, this._zoomFor(scale), dur); } catch (e) { console.error('[legion] flyTo failed', e); }
    this._dirty = true;
  }

  /**
   * Fly so the box [x0, y0, x1, y1] fills the part of the map the panels leave visible.
   * @param {number[]} bb world units
   * @param {{ms?: number, maxScale?: number, pad?: number}} [options]
   */
  flyToBBox(bb, { ms = 900, maxScale = 48, pad = 28 } = {}) {
    if (!this.map) return;
    const rect = this.mapEl.getBoundingClientRect();
    const ins = this.insets;
    const vw = Math.max(80, rect.width - ins.left - ins.right - 2 * pad), vh = Math.max(80, rect.height - ins.top - ins.bottom - 2 * pad);
    const bw = Math.max(2, bb[2] - bb[0]), bhh = Math.max(2, bb[3] - bb[1]);
    const scale = Math.min(maxScale, vw / bw, vh / bhh);
    // the visible area's center, relative to the map's center, in pixels
    const dx = ins.left + pad + vw / 2 - rect.width / 2, dy = ins.top + pad + vh / 2 - rect.height / 2;
    this._fly((bb[0] + bb[2]) / 2 - dx / scale, (bb[1] + bb[3]) / 2 - dy / scale, scale, ms);
  }

  /** Fly to a point at a scale (pixels per unit), centered in the visible area. */
  flyToPoint(x, y, scale = 24, ms = 800) {
    if (!this.map) return;
    const ins = this.insets;
    const dx = (ins.left - ins.right) / 2, dy = (ins.top - ins.bottom) / 2;
    this._fly(x - dx / scale, y - dy / scale, scale, ms);
  }

  /** Zoom around the center by a factor. */
  zoomBy(f) {
    if (!this.map) return;
    const c = this.map.camera;
    this._fly(c.x, c.y, this.scale() * f, 250);
  }

  /** The whole state. */
  fitState() { if (this.map) { this.map.fitState(); this._dirty = true; } }

  /** Theme change: the map re-reads its colors, the overlay its tokens. */
  setTheme(theme) {
    this.theme = theme;
    this._tokens = readTokens();
    if (this.map && typeof this.map.setTheme === 'function') { try { this.map.setTheme(theme); } catch (e) { console.error('[legion] setTheme failed', e); } }
    this._dirty = true;
  }

  /** Space the panels take over the map (pixels), for centering and fitting. */
  setInsets(insets) { this.insets = { ...this.insets, ...insets }; }

  resize() {
    if (this.map) { try { this.map.resize(); } catch (e) { console.error('[legion] resize failed', e); } }
    const r = this.root.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    this.overlay.width = Math.max(1, Math.round(r.width * dpr));
    this.overlay.height = Math.max(1, Math.round(r.height * dpr));
    this._dpr = dpr;
    this._dirty = true;
  }

  // ------------------------------------------------ selection

  /** Outline a place scope (or nothing). */
  setScope(scope) { this.scope = scope; this._dirty = true; }

  /** Mark an NPC's home and workplace (or nothing). */
  setNpc(npc) { this.npc = npc; if (!npc) this.npcNow = null; this._dirty = true; }

  /** Mark where the selected NPC is right now ({x, y} in world units, from the schedule), or nothing. */
  setNpcNow(pos) {
    const next = pos && Number.isFinite(pos.x) && Number.isFinite(pos.y) ? { x: pos.x, y: pos.y } : null;
    const prev = this.npcNow;
    if (!next && !prev) return;
    if (next && prev && Math.abs(next.x - prev.x) < 1e-3 && Math.abs(next.y - prev.y) < 1e-3) return;
    this.npcNow = next; this._dirty = true;
  }

  _rings(scope) {
    const key = `${scope.kind}:${scope.key}`;
    if (!this._ringCache.has(key)) {
      this._ringCache.set(key, scopeRings(this.world, scope));
      if (this._ringCache.size > 24) this._ringCache.delete(this._ringCache.keys().next().value);
    }
    return this._ringCache.get(key);
  }

  // ------------------------------------------------ pointer

  _toWorld(p) {
    if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) return { x: p.x, y: p.y };
    if (p && Number.isFinite(p.px) && Number.isFinite(p.py)) return this.map.screenToWorld(p.px, p.py);
    return null;
  }

  _pick(x, y, radiusPx = 9) {
    if (!this.crowd || typeof this.crowd.pick !== 'function') return null;
    try {
      const hit = this.crowd.pick(x, y, radiusPx / this.scale());
      if (!hit) return null;
      const id = npcIdFrom(this.world, hit.id !== undefined ? hit.id : hit);
      return id ? { id, mode: hit.mode || null, state: hit.state || null } : null;
    } catch (e) { console.error('[legion] pick failed', e); return null; }
  }

  _onClick(p) {
    const w = this._toWorld(p);
    if (!w) return;
    // the map asks its layers (the crowd among them) on every click; use that answer when it names an NPC
    const layerHit = p && p.hit ? npcIdFrom(this.world, p.hit.id !== undefined ? p.hit.id : p.hit) : null;
    const hit = layerHit ? { id: layerHit } : this._pick(w.x, w.y, 10);
    if (hit) { this.bus.emit(EVENTS.NPC_SELECT, { id: hit.id, source: 'map' }); return; }
    const zi = this.world.zipAt(w.x, w.y);
    this.bus.emit(EVENTS.PLACE_SELECT, zi >= 0 ? { zi, kind: 'zip', key: this.world.zips[zi], source: 'map' } : { zi: -1, kind: null, source: 'map' });
  }

  _onPointer(e) {
    if (e.pointerType === 'touch') return;
    const r = this.mapEl.getBoundingClientRect();
    this._lastPointer = { px: e.clientX - r.left, py: e.clientY - r.top, buttons: e.buttons };
    if (this._hoverQueued) return;
    this._hoverQueued = true;
    requestAnimationFrame(() => { this._hoverQueued = false; this._hover(); });
  }

  _hover() {
    const p = this._lastPointer;
    if (!p || !this.map) return;
    if (p.buttons) { this._clearHover(); return; }   // dragging the map: no tooltip
    const w = this.map.screenToWorld(p.px, p.py);
    const zi = this.world.zipAt(w.x, w.y);
    const hit = this._pick(w.x, w.y, 8);
    if (zi !== this.hoverZi) { this.hoverZi = zi; this._dirty = true; }
    const hitId = hit ? hit.id : null;
    if (hitId !== this._hoverId) { this._hoverId = hitId; this.bus.emit(EVENTS.NPC_HOVER, { id: hitId, mode: hit ? hit.mode : null }); }
    this.mapEl.style.cursor = hit ? 'pointer' : '';
    if (zi < 0 && !hit) { this.tooltip.hidden = true; return; }
    const lines = [];
    if (hit) {
      const npc = this.services.npc(hit.id);
      lines.push(h('strong', npc ? `${displayName(npc.name)}, ${npc.age}` : hit.id));
      if (hit.mode || hit.state) lines.push(h('span', motionText(hit.mode, hit.state, npc && npc.school && !npc.occupation ? 'school' : 'work')));
    }
    if (zi >= 0) { const z = this.world.zip(zi); lines.push(h(hit ? 'span.muted' : 'strong', `${z.zip} · ${z.placeName || z.city}`)); }
    clear(this.tooltip).append(...lines);
    this.tooltip.hidden = false;
    const tw = this.tooltip.offsetWidth, th = this.tooltip.offsetHeight, rw = this.mapEl.clientWidth;
    const x = p.px + 14 + tw > rw ? p.px - tw - 12 : p.px + 14, y = Math.max(4, p.py - th - 10);
    this.tooltip.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }

  _clearHover() {
    this.tooltip.hidden = true;
    if (this.hoverZi !== -1) { this.hoverZi = -1; this._dirty = true; }
    if (this._hoverId) { this._hoverId = null; this.bus.emit(EVENTS.NPC_HOVER, { id: null, mode: null }); }
  }

  /** Show a message across the top of the map (empty hides it). */
  showBanner(text) {
    this.banner.hidden = !text;
    clear(this.banner);
    if (text) this.banner.append(icon('alert', { size: 16 }), h('span', text), h('button.icon-btn.small', { type: 'button', 'aria-label': 'Dismiss', on: { click: () => { this.banner.hidden = true; } } }, icon('close', { size: 14 })));
  }

  // ------------------------------------------------ per frame

  /** Advance the crowd to simulated time t and redraw the overlay when the camera or selection changed. */
  frame(t) {
    // only a changed time: setTime makes the crowd redraw, and a paused clock should leave the GPU idle. Also
    // while building: the crowd draws chunks as they arrive, and they should move with the clock.
    if (this.crowd && typeof this.crowd.setTime === 'function' && t !== this._lastT) {
      this._lastT = t;
      try { this.crowd.setTime(t); } catch (e) { if (!this._timeErr) { this._timeErr = true; console.error('[legion] crowd.setTime failed', e); } }
    }
    if (!this.map) return;
    const xf = this._transform();
    if (!xf) return;
    const prev = this._xf;
    if (this._dirty || !prev || xf.some((v, k) => Math.abs(v - prev[k]) > 1e-6)) { this._xf = xf; this._dirty = false; this._draw(xf); }
  }

  // world -> screen as an affine map [a, b, c, d, e, f]: px = a x + c y + e, py = b x + d y + f
  _transform() {
    const m = this.map;
    try {
      const o = m.worldToScreen(0, 0), ux = m.worldToScreen(1000, 0), uy = m.worldToScreen(0, 1000);
      const xf = [(ux.px - o.px) / 1000, (ux.py - o.py) / 1000, (uy.px - o.px) / 1000, (uy.py - o.py) / 1000, o.px, o.py];
      return xf.every(Number.isFinite) ? xf : null;
    } catch { return null; }
  }

  _draw(xf) {
    const g = this.overlay.getContext('2d');
    if (!g) return;
    const dpr = this._dpr || 1, T = this._tokens;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.overlay.width, this.overlay.height);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const [a, b, c, d, e, f] = xf;
    const path = rings => {
      g.beginPath();
      for (const r of rings) {
        for (let i = 0; i < r.length; i += 2) {
          const x = a * r[i] + c * r[i + 1] + e, y = b * r[i] + d * r[i + 1] + f;
          if (i) g.lineTo(x, y); else g.moveTo(x, y);
        }
        g.closePath();
      }
    };
    if (this.hoverZi >= 0 && !(this.scope && this.scope.kind === 'zip' && this.scope.zi === this.hoverZi)) {
      path(this.world.zipRings(this.hoverZi));
      g.lineWidth = 1; g.strokeStyle = T.ink3; g.globalAlpha = 0.9; g.stroke(); g.globalAlpha = 1;
    }
    if (this.scope) {
      path(this._rings(this.scope));
      g.globalAlpha = 0.1; g.fillStyle = T.accent; g.fill('evenodd');
      g.globalAlpha = 1; g.lineWidth = 2; g.lineJoin = 'round'; g.strokeStyle = T.accent; g.stroke();
    }
    const npc = this.npc;
    if (npc) {
      const home = npc.household && npc.household.home, work = npc.commute && npc.commute.work;
      const P = q => ({ x: a * q.x + c * q.y + e, y: b * q.x + d * q.y + f });
      const hp = home && Number.isFinite(home.x) ? P(home) : null, wp = work && Number.isFinite(work.x) ? P(work) : null;
      if (hp && wp) {
        g.beginPath(); g.moveTo(hp.x, hp.y); g.lineTo(wp.x, wp.y);
        g.lineWidth = 2; g.strokeStyle = T.accent; g.globalAlpha = 0.55; g.stroke(); g.globalAlpha = 1;
      }
      const marker = (pt, filled, text) => {
        g.beginPath(); g.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
        g.lineWidth = 2; g.strokeStyle = T.panel; g.fillStyle = filled ? T.accent : T.panel; g.fill(); g.stroke();
        g.beginPath(); g.arc(pt.x, pt.y, 6, 0, Math.PI * 2); g.lineWidth = 2; g.strokeStyle = T.accent; if (!filled) g.stroke();
        g.font = '600 11px system-ui, sans-serif';
        const w = g.measureText(text).width + 10;
        g.fillStyle = T.panel; g.globalAlpha = 0.92;
        roundRect(g, pt.x + 10, pt.y - 9, w, 18, 5); g.fill(); g.globalAlpha = 1;
        g.fillStyle = T.ink; g.textBaseline = 'middle'; g.fillText(text, pt.x + 15, pt.y);
      };
      if (wp) marker(wp, false, npc.student || npc.school ? 'school' : 'work');
      if (hp) marker(hp, true, 'home');
      const now = this.npcNow;
      if (now) {
        const np = P(now);
        g.beginPath(); g.arc(np.x, np.y, 9, 0, Math.PI * 2);
        g.lineWidth = 2; g.strokeStyle = T.accent; g.globalAlpha = 0.45; g.stroke(); g.globalAlpha = 1;
        g.beginPath(); g.arc(np.x, np.y, 4, 0, Math.PI * 2);
        g.fillStyle = T.ink; g.fill(); g.lineWidth = 2; g.strokeStyle = T.panel; g.stroke();
      }
    }
  }
}

function roundRect(g, x, y, w, hgt, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + hgt - r); g.quadraticCurveTo(x + w, y + hgt, x + w - r, y + hgt);
  g.lineTo(x + r, y + hgt); g.quadraticCurveTo(x, y + hgt, x, y + hgt - r);
  g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
}
