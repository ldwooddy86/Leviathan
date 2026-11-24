// Legion · the street view: zoom into any neighborhood in California and watch its residents go about their day.
//
//   const view = new StreetView(container, { world, population, getTime, planFor, bark, persona, allowNetwork, theme });
//   await view.open(x, y, { radiusM: 600 });          // world units; a square about 1.2 km across
//   view.on('select', ({ id }) => …);                // id of the NPC clicked (null when cleared)
//   view.on('hover', ({ id }) => …);
//   view.setTheme('light'); view.follow(true); view.close(); view.destroy();
//
// The scene (street-scene.mjs) is built from the data of the place: procedural streets shaped by its era,
// density, terrain and water, or OpenStreetMap ways when allowNetwork is on (street-osm.mjs, with a procedural
// fallback); the households whose homes are in view, snapped to houses and apartments; parks, schools, shops.
// The simulation (street-sim.mjs) moves the residents by their plans (planFor, the schedule module's activity, or
// a fallback over layer 0), adds in-commuters, through traffic, buses and shoppers who are all real NPCs, and
// steps in fixed increments; the renderer (street-render.mjs) draws it with the light of the hour and the
// weather of the NWS snapshot.
//
// Theme: dark or light base palettes; these CSS custom properties on the container (or its ancestors) override
// colors: --street-bg, --street-land, --street-road, --street-water, --street-accent, --street-text,
// --street-bubble-bg, --street-bubble-fg, --street-tip-bg, --street-tip-fg (falling back to --bg, --fg, --accent).

import { pacific, fmtTime } from '../engine/clock.mjs';
import { clamp } from '../engine/rng.mjs';
import { buildScene, DEFAULT_RADIUS } from './street-scene.mjs';
import { StreetSim, DT } from './street-sim.mjs';
import { StreetRenderer } from './street-render.mjs';
import { makePalette } from './street-draw.mjs';
import { Frame, lightAt, weatherEffects } from './street-geo.mjs';
import { fetchOSM } from './street-osm.mjs';
import { createFallbackPlanner, isTravel } from './street-plan.mjs';

const MAX_ZOOM = 14;          // CSS pixels per meter at the closest
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/**
 * The street view component.
 */
export class StreetView {
  /**
   * @param {HTMLElement} container an element to fill (or a canvas to draw into)
   * @param {object} opts
   * @param {object} opts.world the World
   * @param {object} opts.population the Population
   * @param {() => number} [opts.getTime] simulation time (epoch ms), read every frame
   * @param {(id: string, t: number) => object} [opts.planFor] the schedule activity of an NPC at t
   * @param {(idA: string, idB: string, context: object) => (string|{text:string, gloss?:string}|Promise)} [opts.bark] a short line for a bubble
   * @param {(id: string) => object} [opts.persona] persona of an NPC (traits shape who starts a conversation)
   * @param {boolean} [opts.allowNetwork] fetch real streets from OpenStreetMap (Overpass)
   * @param {'dark'|'light'|object} [opts.theme]
   * @param {number} [opts.trafficScale] multiplier on through traffic and foot traffic (1 = data-calibrated)
   * @param {object} [opts.schedule] the schedule module (activityAt) — used for the plan when planFor is absent
   * @param {object} [opts.dialogue] the dialogue module (bark) — used for bubbles when bark is absent
   * @param {(id: string|null) => void} [opts.onSelect] called with the selected NPC id (also the 'select' event)
   * @param {(id: string|null) => void} [opts.onHover] called with the hovered NPC id (also the 'hover' event)
   */
  constructor(container, { world, population, getTime = null, planFor = null, bark = null, persona = null, allowNetwork = false, theme = 'dark', trafficScale = 1, schedule = null, dialogue = null, onSelect = null, onHover = null } = {}) {
    if (!world || !population) throw new Error('StreetView needs a world and a population');
    this.world = world; this.population = population;
    this.getTime = typeof getTime === 'function' ? getTime : null;
    this.onSelect = typeof onSelect === 'function' ? onSelect : null;
    this.onHover = typeof onHover === 'function' ? onHover : null;
    // persona: (id) → persona, or the persona module's persona(world, npc, {population}); cached either way
    this._personas = new Map();
    this.persona = typeof persona === 'function' ? (persona.length >= 2 ? (id => this._cachedPersona(id, () => persona(world, population.get(id), { population }))) : (id => this._cachedPersona(id, () => persona(id)))) : null;
    // the plan: planFor(id, t), or the schedule module's activityAt(npc, persona, t) when both modules are given
    this.planFor = typeof planFor === 'function' ? planFor
      : schedule && typeof schedule.activityAt === 'function' && this.persona ? ((id, t) => schedule.activityAt(population.get(id), this.persona(id), t)) : null;
    // barks: bark(idA, idB, context), or the dialogue module's bark(world, persona, context)
    this.bark = typeof bark === 'function' ? bark
      : dialogue && typeof dialogue.bark === 'function' && this.persona ? ((a, b, ctx) => dialogue.bark(world, this.persona(a), Object.assign({ other: this.persona(b), otherId: b }, ctx))) : null;
    this.allowNetwork = !!allowNetwork;
    this.trafficScale = trafficScale;
    this._t = Date.now();
    this._handlers = new Map();
    this._names = new Map();
    this.selectedId = null; this.selectedUid = -1; this.hoverUid = -1; this.hoverId = null;
    this.following = false;
    this.scene = null; this.sim = null;
    this.cam = { x: 0, y: 0, z: 1, tx: 0, ty: 0, tz: 1 };
    this._buildDom(container);
    this.renderer = new StreetRenderer(this.canvas);
    this.themeName = typeof theme === 'object' && theme ? (theme.mode || 'dark') : theme === 'light' ? 'light' : 'dark';
    this.themeOverrides = typeof theme === 'object' && theme ? theme : {};
    this._readTheme();
    this._bindInput();
    this._stepMs = 0.5;
    this._fps = 60; this._lastFrame = 0; this._statsAt = 0; this._chatAt = 0;
    this._raf = 0;
  }

  _cachedPersona(id, make) {
    let p = this._personas.get(id);
    if (p !== undefined) return p;
    try { p = make(); } catch { p = null; }
    if (this._personas.size > 4000) this._personas.delete(this._personas.keys().next().value);
    this._personas.set(id, p);
    return p;
  }

  // ------------------------------------------------ events

  /** Listen to 'select' {id}, 'hover' {id}, 'open' {summary}, 'close', 'stats' {…}, 'follow' {on, id}, 'error' {message}. Returns an unsubscribe function. */
  on(event, fn) {
    let set = this._handlers.get(event); if (!set) this._handlers.set(event, set = new Set());
    set.add(fn);
    return () => set.delete(fn);
  }

  /** Remove a listener. */
  off(event, fn) { const set = this._handlers.get(event); if (set) set.delete(fn); }

  _emit(event, payload) {
    const set = this._handlers.get(event); if (!set) return;
    for (const fn of [...set]) { try { fn(payload); } catch (e) { if (typeof console !== 'undefined') console.error('[street] listener failed', e); } }
  }

  // ------------------------------------------------ DOM

  _buildDom(container) {
    if (container && container.tagName === 'CANVAS') {
      // a canvas from the app: overlays go next to it once it is in the page (see _attachOverlays), keys go to it
      this.canvas = container;
      this.root = container;
      this.ownsRoot = false;
      if (!(container.tabIndex >= 0)) container.tabIndex = 0;
      container.style.outline = 'none';
      container.style.touchAction = 'none';
    } else {
      const root = document.createElement('div');
      root.className = 'legion-street';
      root.tabIndex = 0;
      root.style.cssText = 'position:relative;width:100%;height:100%;overflow:hidden;outline:none;user-select:none;-webkit-user-select:none';
      const cv = document.createElement('canvas');
      cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;cursor:grab';
      root.appendChild(cv);
      container.appendChild(root);
      this.root = root; this.canvas = cv; this.ownsRoot = true;
    }
    const tip = document.createElement('div');
    tip.className = 'legion-street-tip';
    tip.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;display:none;padding:5px 9px;border-radius:8px;font:12px/1.35 system-ui,-apple-system,Segoe UI,sans-serif;white-space:nowrap;box-shadow:0 2px 10px rgba(0,0,0,.25);z-index:3;'
      + 'background:var(--street-tip-bg,var(--panel,rgba(22,24,28,.92)));color:var(--street-tip-fg,var(--fg,#f2f0ea))';
    const status = document.createElement('div');
    status.className = 'legion-street-status';
    status.style.cssText = 'position:absolute;left:50%;top:14px;transform:translateX(-50%);pointer-events:none;display:none;padding:6px 12px;border-radius:999px;font:12px system-ui,sans-serif;z-index:3;'
      + 'background:var(--street-tip-bg,var(--panel,rgba(22,24,28,.88)));color:var(--street-tip-fg,var(--fg,#f2f0ea))';
    this.tip = tip; this.statusEl = status;
    this._attachOverlays();
    this._ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => this._resize()) : null;
    if (this._ro) this._ro.observe(this.canvas);
    this._resize();
  }

  /** Put the tooltip and status next to the canvas (on our own root, or the app's canvas's parent once it has one). */
  _attachOverlays() {
    const host = this.ownsRoot ? this.root : this.canvas.parentElement;
    if (!host || (this.tip.parentElement === host && this.statusEl.parentElement === host)) return;
    if (!this.ownsRoot && typeof getComputedStyle === 'function' && getComputedStyle(host).position === 'static') host.style.position = 'relative';
    host.appendChild(this.tip); host.appendChild(this.statusEl);
  }

  _resize() {
    const dpr = Math.min(3, (typeof devicePixelRatio === 'number' ? devicePixelRatio : 1) || 1);
    const w = Math.max(1, this.canvas.clientWidth || 800), h = Math.max(1, this.canvas.clientHeight || 600);
    const W = Math.round(w * dpr), H = Math.round(h * dpr);
    const changed = this.canvas.width !== W || this.canvas.height !== H || this.dpr !== dpr;
    if (changed) { this.canvas.width = W; this.canvas.height = H; }
    this.dpr = dpr; this.cssW = w; this.cssH = h;
    // a new size can put the camera outside the view; otherwise leave it to glide
    if (changed && this.scene) this._clampCam(false);
  }

  _status(text) {
    if (!this.statusEl) return;
    this._attachOverlays();
    this.statusEl.textContent = text || '';
    this.statusEl.style.display = text ? 'block' : 'none';
  }

  // ------------------------------------------------ theme

  _cssVar(name) {
    try { return getComputedStyle(this.canvas).getPropertyValue(name).trim(); } catch { return ''; }
  }

  _readTheme() {
    const o = this.themeOverrides || {};
    const pick = (...names) => { for (const n of names) { const v = this._cssVar(n); if (v) return v; } return ''; };
    this.theme = {
      mode: this.themeName,
      bg: o.bg || pick('--street-bg', '--bg'),
      accent: o.accent || pick('--street-accent', '--accent'),
      text: o.text || pick('--street-text', '--fg'),
      bubbleBg: o.bubbleBg || pick('--street-bubble-bg'),
      bubbleFg: o.bubbleFg || pick('--street-bubble-fg'),
      colors: {
        open: o.land || pick('--street-land'),
        asphalt: o.road || pick('--street-road'), asphaltLocal: o.road || pick('--street-road'), asphaltArt: o.road || pick('--street-road'),
        ocean: o.water || pick('--street-water'), bay: o.water || pick('--street-water'),
        ui: o.accent || pick('--street-accent', '--accent'),
      },
    };
  }

  _palette() {
    if (!this.scene) return null;
    const month = pacific(this._time()).month;
    this._paletteMonth = month;
    const P = makePalette(this.themeName, this.scene.ctx, month, this.theme.colors);
    this.renderer.bubbleBg = this.theme.bubbleBg || null;
    this.renderer.bubbleFg = this.theme.bubbleFg || null;
    return P;
  }

  /** Switch theme: 'dark', 'light', or {mode, bg, accent, land, road, water, …}. Colors also follow --street-* CSS properties. */
  setTheme(theme) {
    this.themeName = typeof theme === 'object' && theme ? (theme.mode || this.themeName) : theme === 'light' ? 'light' : 'dark';
    this.themeOverrides = typeof theme === 'object' && theme ? theme : {};
    this._readTheme();
    if (this.scene) this.renderer.setPalette(this._palette());
  }

  // ------------------------------------------------ time

  _time() { return this.getTime ? this.getTime() : this._t; }

  /** Set the simulation time (epoch ms). With getTime, getTime still drives later frames. */
  setTime(t) { this._t = t; if (this.sim && !this.getTime) this._advance(t); }

  // ------------------------------------------------ open / close

  /**
   * Open the street view at a world point (units). Resolves with a summary once the scene is built and the
   * people are on the street: {x, y, radiusM, zip, city, style, source ('procedural' | 'osm'), osm (null when
   * real streets were not asked for, else 'loaded' | 'cached' | 'unavailable' | 'unusable'), buildMs, households,
   * residents, buildings, streets, streetKm}; null when a later open() replaced this one or the scene failed.
   * @param {number} x
   * @param {number} y
   * @param {{radiusM?: number}} [opts]
   * @returns {Promise<object|null>}
   */
  async open(x, y, { radiusM = DEFAULT_RADIUS } = {}) {
    this.close();
    const token = this._openToken = {};
    this._status('Building the neighborhood…');
    await nextFrame();
    if (token !== this._openToken) return null;
    let osmElements = null, osm = null;
    if (this.allowNetwork) {
      this._status('Loading streets from OpenStreetMap…');
      let r = null;
      try { r = await fetchOSM(this.world, new Frame(this.world, x, y), radiusM); } catch { r = null; }
      osmElements = r ? r.elements : null;
      osm = r ? (r.cached ? 'cached' : 'loaded') : 'unavailable';
      if (token !== this._openToken) return null;
      this._status('Building the neighborhood…');
      await nextFrame();
    }
    let scene;
    try {
      scene = buildScene(this.world, this.population, x, y, { radiusM, osmElements });
    } catch (err) {
      this._status('');
      this._emit('error', { message: String(err && err.message || err) });
      if (typeof console !== 'undefined') console.error('[street] could not build the scene', err);
      return null;
    }
    if (token !== this._openToken) return null;
    this.scene = scene;
    const fallback = createFallbackPlanner(this.world, this.population);
    const planner = this.planFor ? (id, t) => { try { return this.planFor(id, t) || fallback(id, t); } catch { return fallback(id, t); } } : null;
    this.sim = new StreetSim(scene, { world: this.world, population: this.population, planner, trafficScale: this.trafficScale });
    this.renderer.setScene(scene, this._palette());
    const t = this._time();
    this.sim.reset(t);
    this._simT = t;
    // the camera starts on the view about 1.2 km across (its longer side), centered
    const fit = clamp(Math.max(this.cssW, this.cssH) / (2 * scene.R + 20), this._fitZoom(), MAX_ZOOM);
    this.cam = { x: 0, y: 0, z: fit, tx: 0, ty: 0, tz: fit };
    this._latLon = this.world.unproject(x, y);
    this._wxAt = -Infinity;
    this._status('');
    this._start();
    // real streets were asked for: say so when the view had to fall back to generated ones
    if (osm && scene.source !== 'osm') osm = osm === 'unavailable' ? 'unavailable' : 'unusable';
    if (osm === 'unavailable') this._flash('OpenStreetMap could not be reached; showing generated streets', 5000);
    else if (osm === 'unusable') this._flash('OpenStreetMap has too few streets here; showing generated streets', 5000);
    const z = scene.zi >= 0 ? this.world.zip(scene.zi) : null;
    const summary = {
      x, y, radiusM, zip: z ? z.zip : null, city: z ? z.city : null, style: scene.style, source: scene.source, osm, buildMs: Math.round(scene.buildMs),
      households: scene.households.filter(Boolean).length, residents: scene.residents.length, buildings: scene.buildings.length, streets: scene.net.edges.length,
      streetKm: +scene.metrics.streetKm.toFixed(2),
    };
    this.summary = summary;
    this._emit('open', summary);
    return summary;
  }

  /** Show a short notice over the view for `ms` milliseconds. */
  _flash(text, ms = 4000) {
    this._status(text);
    if (this._flashTimer) clearTimeout(this._flashTimer);
    const token = this._openToken;
    this._flashTimer = setTimeout(() => { this._flashTimer = 0; if (token === this._openToken && this.statusEl && this.statusEl.textContent === text) this._status(''); }, ms);
  }

  /** Stop and clear the view (the canvas stays for the next open). */
  close() {
    this._openToken = null;
    if (this._raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this._raf);
    this._raf = 0;
    const was = !!this.scene;
    this.scene = null; this.sim = null;
    this.selectedId = null; this.selectedUid = -1; this.hoverUid = -1; this.hoverId = null; this.following = false;
    if (this.tip) this.tip.style.display = 'none';
    this._status('');
    if (this.canvas) { const g = this.canvas.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, this.canvas.width, this.canvas.height); }
    if (was) this._emit('close', {});
  }

  /** Remove the view and its listeners for good. */
  destroy() {
    this.close();
    if (this._flashTimer) { clearTimeout(this._flashTimer); this._flashTimer = 0; }
    this._unbind && this._unbind();
    if (this._ro) this._ro.disconnect();
    if (this.tip) this.tip.remove();
    if (this.statusEl) this.statusEl.remove();
    if (this.ownsRoot && this.root) this.root.remove();
    this._personas.clear(); this._names.clear();
    this._handlers.clear();
    this.renderer = null;
  }

  // ------------------------------------------------ the loop

  _start() {
    if (typeof requestAnimationFrame !== 'function') return;
    // the next frame is always requested, whatever this one ran into: a failure is reported, never a frozen view
    const loop = (ts) => {
      if (!this.scene) return;
      try { this._frame(ts); } catch (err) { this._frameError(err); }
      if (this.scene) this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  }

  /** Report a failed frame (at most once every five seconds) and keep the clock moving. */
  _frameError(err) {
    const t = now();
    this._lastFrame = t;
    if (this.sim) {
      // whatever stopped the frame: agents whose state no longer reads leave the street, and the simulation is
      // not left behind the clock
      try { this.sim.repair(err); const target = this._time(); if (Math.abs(target - this.sim.t) > 1000) this.sim.reset(target); } catch { /* reported below */ }
    }
    if (this._errAt && t - this._errAt < 5000) return;
    this._errAt = t;
    const message = String(err && err.message || err);
    if (typeof console !== 'undefined') console.error('[street] frame failed', err);
    this._emit('error', { message });
  }

  /** Advance the simulation to t within this frame's budget (jumping when the clock runs faster than it). */
  _advance(t) {
    const sim = this.sim;
    if (!sim) return;
    const maxSteps = clamp(Math.floor(6 / Math.max(0.05, this._stepMs)), 2, 24);
    const t0 = now();
    const r = sim.advance(t, { maxSteps });
    if (r.steps > 0) this._stepMs = this._stepMs * 0.8 + ((now() - t0) / r.steps) * 0.2;
    // background work while there is frame time left: routing trees and the in-commuter scan
    const left = 6 - (now() - t0);
    if (left > 1) sim.warm(Math.min(left, 3));
  }

  _frame(ts) {
    const nowMs = now();
    this._frameWork(nowMs);
    this._workMs = (this._workMs || 0) * 0.9 + (now() - nowMs) * 0.1;
  }

  /** One frame's work: advance the simulation, chatter, follow, draw. */
  _frameWork(nowMs) {
    const dtReal = this._lastFrame ? nowMs - this._lastFrame : 16;
    this._lastFrame = nowMs;
    this._fps = this._fps * 0.92 + (1000 / Math.max(1, dtReal)) * 0.08;
    const t = this._time();
    // how fast simulated time runs against real time (smoothed), for the renderer's choice of detail
    if (this._lastT !== undefined && dtReal > 0) this._clockRate = (this._clockRate || 1) * 0.9 + Math.min(1e4, Math.abs(t - this._lastT) / dtReal) * 0.1;
    this._lastT = t;
    const simAt = now();
    this._advance(t);
    const simMs = now() - simAt;
    const sim = this.sim;
    if (!sim) return;
    // season and weather
    if (pacific(t).month !== this._paletteMonth) this.renderer.setPalette(this._palette());
    if (Math.abs(t - this._wxAt) > 20 * 60000) { this._wxAt = t; this._fx = weatherEffects(this.world.weatherAt(this.scene.zi >= 0 ? this.scene.zi : 0, t)); this._wx = this.world.weatherAt(this.scene.zi >= 0 ? this.scene.zi : 0, t); }
    const light = lightAt(t, this._latLon.lat, this._latLon.lon);
    // chatter between residents passing each other
    if (this.bark && nowMs - this._chatAt > 250) {
      this._chatAt = nowMs;
      sim.chatter(nowMs, (a, b, ctx) => this.bark(a, b, ctx), { contextFor: (a, b) => this._chatContext(a, b, t), accept: (a) => this._wantsToTalk(a) });
    }
    // follow the selected person
    if (this.selectedId) {
      let a = this.selectedUid >= 0 ? sim.byUid.get(this.selectedUid) : null;
      if (!a) { a = sim.agentOf(this.selectedId); this.selectedUid = a ? a.uid : -1; }
      if (a && this.following) { sim.pose(a); this.cam.tx = a.x; this.cam.ty = a.y; }
    }
    // smooth camera
    const k = 1 - Math.exp(-dtReal / 90);
    const c = this.cam;
    c.x += (c.tx - c.x) * k; c.y += (c.ty - c.y) * k; c.z *= Math.exp((Math.log(c.tz) - Math.log(c.z)) * k);
    this._resize();
    if (!this.tip.parentElement) this._attachOverlays();
    const cam = { x: c.x, y: c.y, z: c.z, dpr: this.dpr, W: this.canvas.width, H: this.canvas.height };
    // an out-of-date tile (the sun moved) is redrawn only in a frame the simulation left room in
    this.renderer.frame(cam, sim, { t, light, fx: this._fx, nowMs, selected: this.selectedUid, hover: this.hoverUid, labels: true, theme: this.theme, staleTiles: simMs > 8 ? 0 : 1, clockRate: this._clockRate || 1 });
    this._lastCam = cam;
    this._light = light;
    if (this.hoverUid >= 0) this._placeTip();
    if (nowMs - this._statsAt > 1000) { this._statsAt = nowMs; this._emit('stats', this.stats()); }
  }

  _chatContext(a, b, t) {
    const wx = this._wx || {};
    const P = pacific(t);
    return {
      time: fmtTime(t), dayPart: P.hour < 12 ? 'morning' : P.hour < 17 ? 'afternoon' : P.hour < 21 ? 'evening' : 'night',
      weather: wx.now ? { short: wx.now.short, tempF: wx.now.tempF } : null, alerts: (wx.alerts || []).map(x => x.event),
      activityA: describe(a), activityB: describe(b), placeLabel: this.summary ? `${this.summary.city} ${this.summary.zip}` : '',
    };
  }

  /** Extraverts start conversations more readily (when personas are available). */
  _wantsToTalk(a) {
    if (!this.persona) return true;
    try { const p = this.persona(a.id); const E = p && p.big5 ? p.big5.E : 0.5; return (a.uid * 2654435761 % 1000) / 1000 < 0.35 + 0.6 * E; } catch { return true; }
  }

  // ------------------------------------------------ camera and input

  _fitZoom() {
    const R = this.scene ? this.scene.R : DEFAULT_RADIUS;
    return Math.min(this.cssW, this.cssH) / (2 * R + 30);
  }

  _clampCam(immediate) {
    const c = this.cam, R = this.scene ? this.scene.R : DEFAULT_RADIUS;
    const minZ = this._fitZoom() * 0.92;
    c.tz = clamp(c.tz, minZ, MAX_ZOOM);
    const hw = this.cssW / 2 / c.tz, hh = this.cssH / 2 / c.tz;
    const mx = Math.max(0, R + 20 - hw), my = Math.max(0, R + 20 - hh);
    c.tx = clamp(c.tx, -mx, mx); c.ty = clamp(c.ty, -my, my);
    if (immediate) { c.x = c.tx; c.y = c.ty; c.z = c.tz; }
  }

  /** CSS pixel position (relative to the canvas) → local meters. */
  screenToLocal(px, py) {
    const c = this.cam;
    return { x: c.x + (px - this.cssW / 2) / c.z, y: c.y + (py - this.cssH / 2) / c.z };
  }

  /** Local meters → CSS pixel position on the canvas. */
  localToScreen(x, y) {
    const c = this.cam;
    return { px: (x - c.x) * c.z + this.cssW / 2, py: (y - c.y) * c.z + this.cssH / 2 };
  }

  /** Zoom by a factor around a CSS pixel point (default the center). */
  zoomBy(f, px = this.cssW / 2, py = this.cssH / 2) {
    const c = this.cam;
    const before = this.screenToLocal(px, py);
    c.tz = clamp(c.tz * f, this._fitZoom() * 0.92, MAX_ZOOM);
    // keep the point under the cursor fixed
    c.tx = before.x - (px - this.cssW / 2) / c.tz; c.ty = before.y - (py - this.cssH / 2) / c.tz;
    if (this.following && f !== 1) { /* zoom keeps following */ }
    this._clampCam(false);
  }

  /** Pan by CSS pixels. */
  panBy(dx, dy) {
    const c = this.cam;
    c.tx -= dx / c.tz; c.ty -= dy / c.tz;
    if (this.following) this.follow(false);
    this._clampCam(false);
  }

  /** The agent under a CSS pixel point (within a few pixels), or null. */
  agentAt(px, py, radiusPx = 10) {
    if (!this.sim) return null;
    const p = this.screenToLocal(px, py);
    return this.sim.pick(p.x, p.y, radiusPx / this.cam.z);
  }

  /** Select an NPC by id (or null to clear); emits 'select'. */
  select(id) {
    this.selectedId = id || null;
    const a = id && this.sim ? this.sim.agentOf(id) : null;
    this.selectedUid = a ? a.uid : -1;
    if (!id) this.follow(false);
    this._emit('select', { id: this.selectedId });
    if (this.onSelect) { try { this.onSelect(this.selectedId); } catch (e) { if (typeof console !== 'undefined') console.error('[street] onSelect failed', e); } }
  }

  /** Select whoever is at a CSS pixel point (as a click does); returns the id or null. */
  selectAt(px, py) {
    const a = this.agentAt(px, py);
    this.select(a ? a.id : null);
    return a ? a.id : null;
  }

  /** Follow the selected person with the camera (on = true) or stop. */
  follow(on = true) {
    const was = this.following;
    this.following = !!on && !!this.selectedId;
    if (this.following && this.cam.tz < 3) this.cam.tz = 4;
    if (was !== this.following) this._emit('follow', { on: this.following, id: this.selectedId });
  }

  _bindInput() {
    const cv = this.canvas, root = this.root;
    const pointers = new Map();
    let drag = null, pinch = null, moved = 0;
    const pos = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const down = e => {
      try { cv.setPointerCapture(e.pointerId); } catch { /* synthetic or already released pointers cannot be captured */ }
      pointers.set(e.pointerId, pos(e));
      if (pointers.size === 1) { drag = pos(e); moved = 0; cv.style.cursor = 'grabbing'; }
      else if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 }; drag = null; }
      if (root.focus) root.focus({ preventScroll: true });
    };
    const move = e => {
      const p = pos(e);
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, p);
      if (pinch && pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
        if (pinch.d > 0) this.zoomBy(d / pinch.d, cx, cy);
        this.panBy(cx - pinch.cx, cy - pinch.cy);
        pinch = { d, cx, cy };
        return;
      }
      if (drag) {
        const dx = p.x - drag.x, dy = p.y - drag.y;
        moved += Math.abs(dx) + Math.abs(dy);
        if (moved > 3) this.panBy(dx, dy);
        drag = p;
        return;
      }
      this._hover(p.x, p.y);
    };
    const up = e => {
      const p = pos(e);
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (drag && moved <= 4 && e.type === 'pointerup') this.selectAt(p.x, p.y);
      if (pointers.size === 0) { drag = null; cv.style.cursor = this.hoverUid >= 0 ? 'pointer' : 'grab'; }
    };
    const leave = () => { if (this.hoverUid >= 0) { this.hoverUid = -1; this.hoverId = null; this._emit('hover', { id: null }); } this.tip.style.display = 'none'; };
    const wheel = e => {
      e.preventDefault();
      const p = pos(e);
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      this.zoomBy(Math.exp(-dy * 0.0018), p.x, p.y);
    };
    const dbl = e => {
      const p = pos(e);
      const a = this.agentAt(p.x, p.y);
      if (a) { this.select(a.id); this.follow(true); } else this.zoomBy(2, p.x, p.y);
    };
    const key = e => {
      const step = 80;
      if (e.key === 'ArrowLeft') this.panBy(step, 0); else if (e.key === 'ArrowRight') this.panBy(-step, 0);
      else if (e.key === 'ArrowUp') this.panBy(0, step); else if (e.key === 'ArrowDown') this.panBy(0, -step);
      else if (e.key === '+' || e.key === '=') this.zoomBy(1.4); else if (e.key === '-' || e.key === '_') this.zoomBy(1 / 1.4);
      else if (e.key === 'f' || e.key === 'F') this.follow(!this.following);
      // Escape clears a selection; with nothing selected it is left to the page (the app goes back to the map)
      else if (e.key === 'Escape' && this.selectedId) this.select(null);
      else return;
      e.preventDefault();
    };
    cv.addEventListener('pointerdown', down);
    cv.addEventListener('pointermove', move);
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('pointerleave', leave);
    cv.addEventListener('wheel', wheel, { passive: false });
    cv.addEventListener('dblclick', dbl);
    root.addEventListener('keydown', key);
    this._unbind = () => {
      cv.removeEventListener('pointerdown', down); cv.removeEventListener('pointermove', move); cv.removeEventListener('pointerup', up);
      cv.removeEventListener('pointercancel', up); cv.removeEventListener('pointerleave', leave); cv.removeEventListener('wheel', wheel); cv.removeEventListener('dblclick', dbl);
      root.removeEventListener('keydown', key);
    };
  }

  _hover(px, py) {
    if (!this.sim) return;
    const a = this.agentAt(px, py, 9);
    const uid = a ? a.uid : -1;
    this._tipAt = { px, py };
    if (uid !== this.hoverUid) {
      this.hoverUid = uid; this.hoverId = a ? a.id : null;
      this.canvas.style.cursor = a ? 'pointer' : 'grab';
      this._emit('hover', { id: this.hoverId });
      if (this.onHover) { try { this.onHover(this.hoverId); } catch { /* the app's handler */ } }
      if (a) this.tip.innerHTML = this._tipHtml(a); else this.tip.style.display = 'none';
    }
    if (a) this._placeTip();
  }

  _placeTip() {
    const a = this.sim && this.sim.byUid.get(this.hoverUid);
    if (!a) { this.tip.style.display = 'none'; return; }
    const p = this.localToScreen(a.x, a.y);
    this.tip.style.display = 'block';
    const w = this.tip.offsetWidth || 120;
    const x = clamp(p.px + 14, 4, this.cssW - w - 4), y = clamp(p.py - 34, 4, this.cssH - 40);
    this.tip.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }

  _name(id) {
    let n = this._names.get(id);
    if (n !== undefined) return n;
    try { const npc = this.population.get(id); n = npc && npc.name ? npc.name.display || npc.name.full || id : id; } catch { n = id; }
    if (this._names.size > 5000) this._names.clear();
    this._names.set(id, n);
    return n;
  }

  _tipHtml(a) {
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    return `<b>${esc(this._name(a.id))}</b><span style="opacity:.75"> · ${esc(a.age)} · ${esc(describe(a))}</span>`;
  }

  // ------------------------------------------------ queries (app and tests)

  /** Counts for the UI: agents on screen and moving, by kind, plus residents, buildings, fps. */
  stats() {
    const s = this.sim ? this.sim.stats() : { agents: 0, moving: 0 };
    let onScreen = 0;
    if (this.sim && this._lastCam) { const v = this.renderer._viewRect(this._lastCam); for (const a of this.sim.agents) if (a.x >= v[0] && a.x <= v[2] && a.y >= v[1] && a.y <= v[3]) onScreen++; }
    return Object.assign({}, s, { onScreen, fps: Math.round(this._fps), frameMs: +(this._workMs || 0).toFixed(2), zoom: +this.cam.z.toFixed(2), source: this.scene ? this.scene.source : null, style: this.scene ? this.scene.style : null, time: this.sim ? this.sim.t : null });
  }

  /** Agents visible on the canvas with their CSS pixel positions: [{id, uid, kind, role, px, py}]. */
  agentsOnScreen() {
    if (!this.sim) return [];
    const out = [];
    for (const a of this.sim.agents) {
      this.sim.pose(a);
      const p = this.localToScreen(a.x, a.y);
      if (p.px >= 0 && p.py >= 0 && p.px <= this.cssW && p.py <= this.cssH) out.push({ id: a.id, uid: a.uid, kind: a.kind, role: a.role, moving: a.v > 0.2, px: p.px, py: p.py });
    }
    return out;
  }

  /** Mean brightness of the last frame (0..255). */
  brightness() { return this.renderer ? this.renderer.brightness() : 0; }

  /** Light and weather in effect: {night, elevation, golden, fx}. */
  conditions() { return { light: this._light || null, fx: this._fx || null, weather: this._wx ? this._wx.now : null }; }
}

/** A few words on what an agent is doing ("walking to work", "driving through"). */
export function describe(a) {
  if (!a) return '';
  if (a.role === 'through') return 'driving through';
  if (a.role === 'bus') return 'driving the bus';
  if (a.role === 'visitor') return a.kind === 'walk' ? (a.trip && a.trip.toB ? 'out shopping' : 'out walking') : (a.trip && a.trip.toB ? 'going shopping' : 'heading out');
  if (a.phase === 'wait') return 'waiting for the bus';
  if (a.phase === 'wander') return 'at the park';
  const verb = a.kind === 'car' ? (a.body === 'motorcycle' ? 'riding' : 'driving') : a.kind === 'bike' ? 'biking' : 'walking';
  const tr = a.trip || {};
  const purpose = tr.purpose || (a.act && a.act.kind) || '';
  if (tr.loop) return a.dog ? 'walking the dog' : 'out for a walk';
  if (purpose === 'home') return `${verb} home`;
  if (purpose === 'work') return `${verb} to work`;
  if (purpose === 'school') return a.age < 18 ? `${verb} to school` : `${verb} to class`;
  if (purpose === 'errand' || purpose === 'shop') return `${verb} to run errands`;
  if (purpose === 'leisure') return `${verb} out for the evening`;
  if (a.act && isTravel(a.act) && a.act.place && a.act.place.label) return `${verb} to ${a.act.place.label}`;
  return verb;
}

function nextFrame() { return new Promise(r => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(() => r()) : setTimeout(r, 0))); }

export { DT };
