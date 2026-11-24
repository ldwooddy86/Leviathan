// Legion · the street view renderer (Canvas 2D).
//
// Static things (ground, water, lots, roads, buildings, trees) are drawn once into 512-pixel tiles at the level of
// detail the zoom needs and cached; tiles are redrawn in the background when the sun has moved enough to change
// shadows and roof shading, and the old ones stay on screen until then. Night street lights, porch lights and
// lit storefronts live in their own tile layer. Every frame then draws what moves: parked and moving cars with
// their headlights and brake lights, buses, cyclists, people with a walking cycle (umbrellas in the rain, a dog on
// some walks), traffic signal heads, and over it all the light of the hour from the sun's elevation, wet streets,
// rain and snow, fog, smoke haze and drifting cloud shadows, then labels, speech bubbles and the selection.

import { hash2, u01, clamp } from '../engine/rng.mjs';
import { pointAt, hf } from './street-geo.mjs';
import { signalState } from './street-net.mjs';
import { shortName } from './street-names.mjs';
import { drawRoads, drawLots, drawAreas, drawPools, drawShadow, drawRoof, drawTrees, drawGround, makeHillshade, heightOf, tracePoly, shade, mix } from './street-draw.mjs';

const TILE = 512;
const LEVELS = [0.25, 0.5, 1, 2, 4, 8, 16];

/** An offscreen canvas (OffscreenCanvas where available, else a detached canvas element). */
function makeCanvas(w, h) {
  if (typeof OffscreenCanvas === 'function') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
}

/** Grid index of features by bounding box, for tile and view queries. */
class FeatureGrid {
  constructor(cell = 64) { this.cell = cell; this.map = new Map(); }
  add(id, x0, y0, x1, y1) {
    const c = this.cell;
    for (let i = Math.floor(x0 / c); i <= Math.floor(x1 / c); i++) for (let j = Math.floor(y0 / c); j <= Math.floor(y1 / c); j++) {
      const k = i * 65536 + j; let b = this.map.get(k); if (!b) this.map.set(k, b = []); b.push(id);
    }
  }
  query(x0, y0, x1, y1) {
    const c = this.cell, out = new Set();
    for (let i = Math.floor(x0 / c); i <= Math.floor(x1 / c); i++) for (let j = Math.floor(y0 / c); j <= Math.floor(y1 / c); j++) {
      const b = this.map.get(i * 65536 + j); if (b) for (const id of b) out.add(id);
    }
    return out;
  }
}

function bboxRing(r, pad = 0) { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (let i = 0; i < r.length; i += 2) { x0 = Math.min(x0, r[i]); x1 = Math.max(x1, r[i]); y0 = Math.min(y0, r[i + 1]); y1 = Math.max(y1, r[i + 1]); } return [x0 - pad, y0 - pad, x1 + pad, y1 + pad]; }

/**
 * The renderer of one canvas. Call setScene() for each opened place, then frame() every animation frame.
 */
export class StreetRenderer {
  /** @param {HTMLCanvasElement} canvas */
  constructor(canvas) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.tiles = new Map();
    this.lights = new Map();
    this.scene = null;
    this.P = null;
    this.sunKey = '';
    this.renderBudgetMs = 7;
    this.lastStats = { tilesDrawn: 0, tilesRendered: 0, agentsDrawn: 0 };
  }

  /** Use a scene (and its palette); rebuilds the feature index, hillshade, lamps and labels. */
  setScene(scene, P) {
    this.scene = scene;
    this.P = P;
    this.tiles.clear(); this.lights.clear();
    const R = scene.R;
    this.ext = R + 60;
    const idx = { edges: new FeatureGrid(), buildings: new FeatureGrid(), lots: new FeatureGrid(), areas: new FeatureGrid(), trees: new FeatureGrid(32), spots: new FeatureGrid(), pools: new FeatureGrid(), lamps: new FeatureGrid() };
    for (const e of scene.net.edges) { const b = bboxRing(e.pts, e.half + 4); idx.edges.add(e.id, ...b); }
    for (const b of scene.buildings) { const bb = bboxRing(b.ring, 2); idx.buildings.add(b.id, bb[0] - 30, bb[1] - 30, bb[2] + 30, bb[3] + 30); }
    for (const l of scene.lots) idx.lots.add(l.id, ...bboxRing(l.ring, 0.5));
    scene.areas.forEach((a, i) => idx.areas.add(i, ...bboxRing(a.ring, 1)));
    const T = scene.trees;
    for (let i = 0; i < T.length / 5; i++) { const x = T[5 * i], y = T[5 * i + 1], r = T[5 * i + 2] * 3; idx.trees.add(i, x - r, y - r, x + r, y + r); }
    scene.spots.forEach((s, i) => { if (s.kind === 'lot') idx.spots.add(i, s.x - 3, s.y - 3, s.x + 3, s.y + 3); });
    scene.pools.forEach((p, i) => idx.pools.add(i, ...bboxRing(p.ring, 0.5)));
    this.idx = idx;
    this.hillshade = typeof document !== 'undefined' || typeof OffscreenCanvas === 'function' ? makeHillshade(scene, makeCanvas) : null;
    scene.vegOpen = scene.vegOpen ?? (scene.ctx && scene.ctx.vegOpen) ?? -1;
    this.lamps = buildLamps(scene);
    this.lamps.forEach((l, i) => idx.lamps.add(i, l.x - l.r, l.y - l.r, l.x + l.r, l.y + l.r));
    this.labels = buildLabels(scene);
    this.cloudSeed = hash2(scene.ctx.zseed, 0xc10d);
  }

  /** Change colors (theme or season); every tile is redrawn. */
  setPalette(P) { this.P = P; this.tiles.clear(); this.lights.clear(); }

  // ------------------------------------------------ tiles

  _tileKey(level, tx, ty) { return level + ':' + tx + ':' + ty; }

  _renderTile(level, tx, ty, kind) {
    const scene = this.scene, P = this.P, m = TILE / level;
    const x0 = -this.ext + tx * m, y0 = -this.ext + ty * m, x1 = x0 + m, y1 = y0 + m;
    const cv = makeCanvas(TILE, TILE), g = cv.getContext('2d');
    g.setTransform(level, 0, 0, level, -x0 * level, -y0 * level);
    if (kind === 'light') { this._drawLightsTile(g, [x0, y0, x1, y1], level); return cv; }
    const pad = 40;
    const q = (grid) => grid.query(x0 - pad, y0 - pad, x1 + pad, y1 + pad);
    drawGround(g, scene, P, [x0, y0, x1, y1], level, this.hillshade);
    const areas = [...q(this.idx.areas)].sort((a, b) => a - b).map(i => scene.areas[i]);
    const spots = [...q(this.idx.spots)].map(i => scene.spots[i]);
    drawAreas(g, areas, spots, P, level);
    drawLots(g, [...q(this.idx.lots)].sort((a, b) => a - b).map(i => scene.lots[i]), P, level, scene.ctx.zseed);
    // driveways
    const bIds = [...q(this.idx.buildings)].sort((a, b) => a - b);
    const bs = bIds.map(i => scene.buildings[i]);
    g.strokeStyle = scene.mode === 'rural' ? P.gravel : P.concrete; g.lineCap = 'butt';
    for (const b of bs) if (b.driveway) { g.lineWidth = b.rural ? 3.2 : 3.0; g.beginPath(); g.moveTo(b.driveway[0], b.driveway[1]); g.lineTo(b.driveway[2], b.driveway[3]); g.stroke(); }
    drawRoads(g, scene.net, [...q(this.idx.edges)].sort((a, b) => a - b), P, level);
    drawPools(g, [...q(this.idx.pools)].map(i => scene.pools[i]), P);
    // shadows of buildings, then roofs, then trees above
    const sun = this.sun || { az: Math.PI, el: 45, strength: 0.6, dx: 0.3, dy: 0.5 };
    if (sun.strength > 0.03) {
      // shadows fade under clouds: their darkness follows the strength of the direct sun
      g.save(); g.globalAlpha = clamp(sun.strength, 0, 1);
      g.fillStyle = P.shadow;
      for (const b of bs) { const h = heightOf(b); const L = Math.min(h * 3.2, h / Math.tan(Math.max(6, sun.el) * Math.PI / 180)); drawShadow(g, b.ring, sun.dx * L, sun.dy * L); if (b.wing && b.wing.ring) drawShadow(g, b.wing.ring, sun.dx * L, sun.dy * L); }
      g.restore();
    }
    for (const b of bs) drawRoof(g, b, P, level, sun);
    const treeIdx = [...q(this.idx.trees)].sort((a, b) => a - b);
    drawTrees(g, scene.trees, treeIdx, P, level, sun, P.theme === 'dark');
    // bus stop shelters
    if (level >= 1 && this.stops) for (const s of this.stops) {
      if (s.x < x0 - 5 || s.x > x1 + 5 || s.y < y0 - 5 || s.y > y1 + 5) continue;
      g.save(); g.translate(s.x, s.y); g.rotate(s.ang); g.fillStyle = P.theme === 'dark' ? '#55606b' : '#8a98a6'; g.fillRect(-2, -0.7, 4, 1.4); g.fillStyle = '#2b6cb0'; g.fillRect(2.4, -0.15, 0.3, 0.3); g.restore();
    }
    return cv;
  }

  /** Night light: street lamps (pools of warm light), porch lights, lit storefronts. */
  _drawLightsTile(g, rect, level) {
    const scene = this.scene;
    const [x0, y0, x1, y1] = rect;
    g.globalCompositeOperation = 'lighter';
    for (const i of this.idx.lamps.query(x0 - 20, y0 - 20, x1 + 20, y1 + 20)) {
      const l = this.lamps[i];
      const grd = g.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
      grd.addColorStop(0, l.c0); grd.addColorStop(0.35, l.c1); grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd; g.beginPath(); g.arc(l.x, l.y, l.r, 0, Math.PI * 2); g.fill();
      if (level >= 2 && l.kind === 'street') { g.fillStyle = 'rgba(255,240,200,0.9)'; g.beginPath(); g.arc(l.x, l.y, 0.35, 0, Math.PI * 2); g.fill(); }
    }
    // windows: a warm glow on the roofs of lived-in homes (light from skylights and around the eaves)
    for (const id of this.idx.buildings.query(x0, y0, x1, y1)) {
      const b = scene.buildings[id];
      if (!(b.residents > 0) && b.kind !== 'commercial') continue;
      const h = hash2(0x11a7, b.id);
      if (hf(h, 1) > (b.kind === 'commercial' ? 0.85 : 0.55)) continue;
      g.fillStyle = b.kind === 'commercial' ? 'rgba(255,214,150,0.16)' : 'rgba(255,200,120,0.09)';
      g.beginPath(); tracePoly(g, b.ring, true); g.fill();
    }
  }

  _ensureTiles(level, tx0, tx1, ty0, ty1, kind, deadline) {
    const cache = kind === 'light' ? this.lights : this.tiles;
    const want = kind === 'light' ? 'L' : this.sunKey + '|' + (this.P && this.P.theme);
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const key = this._tileKey(level, tx, ty);
      const t = cache.get(key);
      if (t && t.want === want) continue;
      if (now() > deadline && t) continue;          // stale but drawable: refresh in a later frame
      if (now() > deadline && !t && this._haveAny(cache, level, tx, ty, want)) continue;
      const cv = this._renderTile(level, tx, ty, kind);
      cache.set(key, { cv, want, level, tx, ty, used: now() });
      this.lastStats.tilesRendered++;
      if (cache.size > 90) {
        const old = [...cache.entries()].sort((a, b) => a[1].used - b[1].used).slice(0, cache.size - 80);
        for (const [k] of old) cache.delete(k);
      }
    }
  }

  _haveAny(cache, level, tx, ty, want) {
    // a coarser tile covering this one can stand in while it renders
    for (const L of LEVELS) { if (L >= level) break; const m = TILE / L, mm = TILE / level; const ctx = Math.floor(tx * mm / m), cty = Math.floor(ty * mm / m); const t = cache.get(this._tileKey(L, ctx, cty)); if (t && t.want === want) return true; }
    return false;
  }

  _drawTiles(g, cam, level, kind) {
    const cache = kind === 'light' ? this.lights : this.tiles;
    const m = TILE / level;
    const s = cam.z * cam.dpr;
    const view = this._viewRect(cam);
    const tx0 = Math.max(0, Math.floor((view[0] + this.ext) / m)), tx1 = Math.floor((view[2] + this.ext) / m);
    const ty0 = Math.max(0, Math.floor((view[1] + this.ext) / m)), ty1 = Math.floor((view[3] + this.ext) / m);
    const maxT = Math.ceil(2 * this.ext / m) - 1;
    const deadline = now() + this.renderBudgetMs;
    this._ensureTiles(level, tx0, Math.min(tx1, maxT), ty0, Math.min(ty1, maxT), kind, deadline);
    g.imageSmoothingEnabled = true;
    for (let ty = ty0; ty <= Math.min(ty1, maxT); ty++) for (let tx = tx0; tx <= Math.min(tx1, maxT); tx++) {
      const t = cache.get(this._tileKey(level, tx, ty));
      const wx = -this.ext + tx * m, wy = -this.ext + ty * m;
      const px = (wx - cam.x) * s + cam.W / 2, py = (wy - cam.y) * s + cam.H / 2;
      if (t) { t.used = now(); g.drawImage(t.cv, Math.floor(px), Math.floor(py), Math.ceil(m * s) + 1, Math.ceil(m * s) + 1); this.lastStats.tilesDrawn++; continue; }
      // stand-in from a coarser level
      for (let li = LEVELS.indexOf(level) - 1; li >= 0; li--) {
        const L = LEVELS[li], M = TILE / L;
        const ctx = Math.floor((wx + this.ext) / M), cty = Math.floor((wy + this.ext) / M);
        const c = cache.get(this._tileKey(L, ctx, cty));
        if (!c) continue;
        const sx = ((wx + this.ext) - ctx * M) * L, sy = ((wy + this.ext) - cty * M) * L, sw = m * L;
        g.drawImage(c.cv, sx, sy, sw, sw, Math.floor(px), Math.floor(py), Math.ceil(m * s) + 1, Math.ceil(m * s) + 1);
        break;
      }
    }
  }

  _viewRect(cam) {
    const s = cam.z * cam.dpr, hw = cam.W / 2 / s, hh = cam.H / 2 / s;
    return [cam.x - hw, cam.y - hh, cam.x + hw, cam.y + hh];
  }

  // ------------------------------------------------ the frame

  /**
   * Draw one frame.
   * @param {{x:number, y:number, z:number, dpr:number, W:number, H:number}} cam center (local m), zoom (CSS px per m), device pixels
   * @param {object} sim StreetSim
   * @param {{t:number, light:object, fx:object, nowMs:number, selected?:number, hover?:number, labels?:boolean, theme:object}} env
   */
  frame(cam, sim, env) {
    const g = this.g, P = this.P, scene = this.scene;
    if (!scene || !P) return;
    this._cam = cam;
    this.lastStats = { tilesDrawn: 0, tilesRendered: 0, agentsDrawn: 0 };
    this.stops = sim ? sim.stops : null;
    // the sun for shadows and roof shading, bucketed so tiles are not redrawn every minute
    const L = env.light;
    const el = L.elevation, az = L.azimuth * Math.PI / 180;
    // direct sunlight: none under an overcast or rainy sky, partial through broken clouds
    const strength = clamp(el / 20, 0, 1) * Math.pow(1 - clamp(env.fx ? env.fx.cloud : 0, 0, 1), 1.5);
    const azB = Math.round(L.azimuth / 20) * 20 * Math.PI / 180, elB = el < 0 ? -1 : Math.round(Math.min(el, 60) / 10) * 10;
    this.sun = { az: azB, el: Math.max(5, elB), strength: elB < 0 ? 0 : Math.round(strength * 4) / 4, dx: -Math.sin(azB), dy: Math.cos(azB) };
    this.sunKey = elB < 0 ? 'night' : `${Math.round(azB * 100)}:${elB}:${this.sun.strength}`;
    const W = cam.W, H = cam.H, s = cam.z * cam.dpr;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    g.fillStyle = env.theme && env.theme.bg ? env.theme.bg : (P.theme === 'dark' ? '#15171a' : '#e9e6df');
    g.fillRect(0, 0, W, H);
    const level = LEVELS.find(l => l >= s * 0.92) || LEVELS[LEVELS.length - 1];
    // coarse overview first so there is always something under the detailed tiles
    if (level > 0.25) this._ensureTiles(0.25, 0, Math.ceil(2 * this.ext / (TILE / 0.25)) - 1, 0, Math.ceil(2 * this.ext / (TILE / 0.25)) - 1, 'base', now() + 50);
    this._drawTiles(g, cam, level, 'base');
    // world-space drawing from here
    const toScreen = (ctx) => ctx.setTransform(s, 0, 0, s, W / 2 - cam.x * s, H / 2 - cam.y * s);
    toScreen(g);
    const view = this._viewRect(cam);
    const night = L.night;
    if (sim) {
      this._drawParked(g, sim, view, s);
      this._drawAgents(g, sim, view, s, env);
    }
    // weather on the ground: wet streets darken and cool
    const fx = env.fx || {};
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (fx.rain > 0 || fx.snow > 0) { g.globalCompositeOperation = 'multiply'; g.fillStyle = fx.snow > fx.rain ? `rgba(225,230,240,${0.25 * fx.snow})` : `rgba(150,160,185,${0.35 * fx.rain})`; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over'; }
    if (fx.snow > 0.3) { g.fillStyle = `rgba(245,247,250,${0.22 * fx.snow})`; g.fillRect(0, 0, W, H); }
    // cloud shadows drifting with the wind (day)
    if (fx.cloud > 0.2 && night < 0.7) this._clouds(g, cam, fx, env.nowMs, 1 - night);
    // the hour: night blue, twilight, golden light
    if (L.golden > 0 && night < 0.9) { g.globalCompositeOperation = 'soft-light'; g.fillStyle = `rgba(255,170,90,${0.45 * L.golden})`; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over'; }
    if (night > 0) {
      g.globalCompositeOperation = 'multiply';
      const blue = mix('#ffffff', P.theme === 'dark' ? '#202a44' : '#1c2848', clamp(night * 0.92, 0, 0.92));
      g.fillStyle = blue; g.fillRect(0, 0, W, H);
      g.globalCompositeOperation = 'source-over';
      if (L.twilight > 0) { g.globalCompositeOperation = 'soft-light'; g.fillStyle = `rgba(120,90,200,${0.25 * L.twilight})`; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over'; }
      // lights add on top of the dark
      g.globalAlpha = clamp(night * 1.15, 0, 1);
      g.globalCompositeOperation = 'lighter';
      this._drawTiles(g, cam, Math.min(level, 4), 'light');
      g.globalAlpha = 1;
      toScreen(g);
      if (sim) this._drawVehicleLights(g, sim, view, s, night, fx);
      g.globalCompositeOperation = 'source-over';
    }
    toScreen(g);
    if (sim && s > 1.2) this._drawSignals(g, sim, view, s, night);
    g.setTransform(1, 0, 0, 1, 0, 0);
    // fog and smoke over everything
    if (fx.fog > 0) { g.fillStyle = night > 0.5 ? `rgba(150,160,175,${0.5 * fx.fog})` : `rgba(232,234,236,${0.55 * fx.fog})`; g.fillRect(0, 0, W, H); }
    if (fx.smoke > 0) { g.globalCompositeOperation = 'multiply'; g.fillStyle = `rgba(214,168,118,${0.45 * fx.smoke})`; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over'; g.fillStyle = `rgba(190,150,110,${0.18 * fx.smoke})`; g.fillRect(0, 0, W, H); }
    if (fx.rain > 0.05 || fx.snow > 0.05) this._precip(g, W, H, fx, env.nowMs, cam.dpr);
    // the edge of the generated world fades out
    this._vignette(g, cam);
    toScreen(g);
    if (sim) this._drawMarks(g, sim, s, env);
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (env.labels !== false) this._drawLabels(g, cam, view, s, night);
    if (sim) this._drawBubbles(g, sim, cam, s, env.nowMs);
    this._scaleBar(g, cam, night);
    if (scene.source === 'osm') { g.font = `${11 * cam.dpr}px sans-serif`; g.fillStyle = P.theme === 'dark' || night > 0.6 ? 'rgba(230,230,230,0.8)' : 'rgba(30,30,30,0.7)'; g.textAlign = 'right'; g.textBaseline = 'bottom'; g.fillText('© OpenStreetMap contributors', W - 8 * cam.dpr, H - 6 * cam.dpr); }
  }

  // ------------------------------------------------ moving things

  _drawParked(g, sim, view, s) {
    const spots = this.scene.spots, car = sim.spotCar;
    const small = s < 1.6;
    for (let i = 0; i < spots.length; i++) {
      const h = car[i];
      if (h < 0) continue;
      const sp = spots[i];
      if (sp.x < view[0] - 6 || sp.x > view[2] + 6 || sp.y < view[1] - 6 || sp.y > view[3] + 6) continue;
      const look = carLook(h, this.scene.mode === 'rural');
      const c = Math.cos(sp.ang), sn = Math.sin(sp.ang);
      g.setTransform(c * s, sn * s, -sn * s, c * s, (sp.x - this._cam.x) * s + this._cam.W / 2, (sp.y - this._cam.y) * s + this._cam.H / 2);
      drawCarShape(g, look, small, false, 0, this.sun);
    }
  }

  _drawAgents(g, sim, view, s, env) {
    const cam = this._cam;
    const small = s < 1.6;
    const people = [];
    const rain = env.fx && (env.fx.rain > 0.15);
    const t = env.nowMs || 0;
    for (const a of sim.agents) {
      const p = sim.pose(a);
      if (p.x < view[0] - 15 || p.x > view[2] + 15 || p.y < view[1] - 15 || p.y > view[3] + 15) continue;
      this.lastStats.agentsDrawn++;
      if (a.kind === 'walk') { people.push(a); continue; }
      const ang = Math.atan2(p.hy, p.hx), c = Math.cos(ang), sn = Math.sin(ang);
      g.setTransform(c * s, sn * s, -sn * s, c * s, (p.x - cam.x) * s + cam.W / 2, (p.y - cam.y) * s + cam.H / 2);
      if (a.kind === 'car') drawCarShape(g, a, small, a.brake, a.blink && (Math.floor(t / 400) % 2 === 0) ? a.blink : 0, this.sun);
      else if (a.kind === 'bus') drawBus(g, a, small, this.sun);
      else if (a.kind === 'bike') drawBike(g, a, small, a.walked || 0);
    }
    // people: dots far out, figures close in
    if (s < 2.6) {
      g.setTransform(s, 0, 0, s, cam.W / 2 - cam.x * s, cam.H / 2 - cam.y * s);
      const r = Math.max(0.55, 2.7 / s);
      const byColor = new Map();
      for (const a of people) { const k = a.look.shirt; let arr = byColor.get(k); if (!arr) byColor.set(k, arr = []); arr.push(a); }
      for (const [col, arr] of byColor) { g.fillStyle = col; g.beginPath(); for (const a of arr) { g.moveTo(a.x + r, a.y); g.arc(a.x, a.y, r, 0, Math.PI * 2); } g.fill(); }
      g.strokeStyle = 'rgba(20,20,20,0.55)'; g.lineWidth = Math.max(0.12, 0.6 / s); g.beginPath(); for (const a of people) { g.moveTo(a.x + r, a.y); g.arc(a.x, a.y, r, 0, Math.PI * 2); } g.stroke();
      return;
    }
    // figures are drawn larger than life (about nine pixels across at most zooms) so people read as people
    const boost = clamp(18 / s, 1.3, 3.5);
    for (const a of people) {
      const ang = Math.atan2(a.hy, a.hx), c = Math.cos(ang), sn = Math.sin(ang);
      const k = a.look.scale * boost;
      g.setTransform(c * s * k, sn * s * k, -sn * s * k, c * s * k, (a.x - cam.x) * s + cam.W / 2, (a.y - cam.y) * s + cam.H / 2);
      drawPerson(g, a, (a.walked || 0), rain && a.phase !== 'wait' ? 1 : rain ? 0.7 : 0, this.sun);
    }
  }

  _drawVehicleLights(g, sim, view, s, night, fx) {
    const cam = this._cam;
    for (const a of sim.agents) {
      if (a.kind !== 'car' && a.kind !== 'bus' && a.kind !== 'bike') continue;
      if (a.x < view[0] - 30 || a.x > view[2] + 30 || a.y < view[1] - 30 || a.y > view[3] + 30) continue;
      const ang = Math.atan2(a.hy, a.hx), c = Math.cos(ang), sn = Math.sin(ang);
      g.setTransform(c * s, sn * s, -sn * s, c * s, (a.x - cam.x) * s + cam.W / 2, (a.y - cam.y) * s + cam.H / 2);
      const len = a.len || 4.5, wid = a.wid || 1.8;
      // headlight beams: a soft cone ahead, longer when the street is wet (reflections)
      const reach = 16 + (fx.rain || 0) * 10;
      const grd = g.createLinearGradient(len / 2, 0, len / 2 + reach, 0);
      grd.addColorStop(0, 'rgba(255,240,200,0.55)'); grd.addColorStop(1, 'rgba(255,240,200,0)');
      g.fillStyle = grd; g.beginPath(); g.moveTo(len / 2, -wid * 0.42); g.lineTo(len / 2 + reach, -wid * 1.8); g.lineTo(len / 2 + reach, wid * 1.8); g.lineTo(len / 2, wid * 0.42); g.closePath(); g.fill();
      // tail lights
      const br = a.brake ? 0.95 : 0.55;
      g.fillStyle = `rgba(255,40,30,${br})`; g.beginPath(); g.arc(-len / 2, -wid * 0.36, a.brake ? 0.7 : 0.45, 0, Math.PI * 2); g.arc(-len / 2, wid * 0.36, a.brake ? 0.7 : 0.45, 0, Math.PI * 2); g.fill();
      if (a.kind === 'bus') { g.fillStyle = 'rgba(255,235,190,0.35)'; g.fillRect(-len / 2 + 0.6, -wid / 2 + 0.3, len - 1.2, wid - 0.6); }
    }
  }

  _drawSignals(g, sim, view, s, night) {
    const net = this.scene.net;
    for (const n of net.nodes) {
      if (n.ctrl !== 'signal' || !n.signal) continue;
      if (n.x < view[0] - 30 || n.x > view[2] + 30 || n.y < view[1] - 30 || n.y > view[3] + 30) continue;
      for (const ad of n.adj) {
        const E = net.edges[ad.e];
        const st = signalState(n.signal, E.grp[ad.end], sim.t);
        const d = Math.min(E.len * 0.5, (E.curb || 3) + 4);
        const p = pointAt(E.pts, E.cum, ad.end === 0 ? d : E.len - d, {});
        const dir = ad.end === 1 ? 1 : -1;
        const x = p.x - p.ty * dir * (E.curb + 0.8), y = p.y + p.tx * dir * (E.curb + 0.8);
        const col = st === 'green' ? '#3ddc84' : st === 'yellow' ? '#ffcc33' : '#ff4136';
        g.fillStyle = 'rgba(20,20,20,0.85)'; g.beginPath(); g.arc(x, y, 0.75, 0, Math.PI * 2); g.fill();
        g.fillStyle = col; g.beginPath(); g.arc(x, y, 0.5, 0, Math.PI * 2); g.fill();
        if (night > 0.3) { g.globalCompositeOperation = 'lighter'; const grd = g.createRadialGradient(x, y, 0, x, y, 3); grd.addColorStop(0, col); grd.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = grd; g.globalAlpha = 0.5 * night; g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
      }
    }
  }

  /** Selection and hover rings (screen-constant thickness). */
  _drawMarks(g, sim, s, env) {
    const mark = (uid, col, pulse) => {
      const a = sim.byUid.get(uid); if (!a) return;
      const r = (a.kind === 'walk' ? 1.4 : (a.len || 4) * 0.7) + (pulse ? 0.4 * Math.sin((env.nowMs || 0) / 220) : 0);
      g.strokeStyle = col; g.lineWidth = 2.2 / s; g.beginPath(); g.arc(a.x, a.y, Math.max(r, 7 / s), 0, Math.PI * 2); g.stroke();
    };
    const accent = env.theme && env.theme.accent ? env.theme.accent : this.P.ui;
    if (env.hover >= 0) mark(env.hover, 'rgba(255,255,255,0.9)', false);
    if (env.selected >= 0) { mark(env.selected, accent, true); }
  }

  // ------------------------------------------------ overlays

  _clouds(g, cam, fx, nowMs, day) {
    if (!this.cloudCanvas) {
      // a tileable texture: every blob is also drawn wrapped around the edges
      const c = makeCanvas(256, 256), cg = c.getContext('2d');
      for (let k = 0; k < 14; k++) {
        const x = u01(hash2(this.cloudSeed, k)) * 256, y = u01(hash2(this.cloudSeed, k + 50)) * 256, r = 30 + u01(hash2(this.cloudSeed, k + 90)) * 60;
        for (const ox of [-256, 0, 256]) for (const oy of [-256, 0, 256]) {
          const grd = cg.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r); grd.addColorStop(0, 'rgba(0,0,0,0.5)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
          cg.fillStyle = grd; cg.beginPath(); cg.arc(x + ox, y + oy, r, 0, Math.PI * 2); cg.fill();
        }
      }
      this.cloudCanvas = c;
    }
    const s = cam.z * cam.dpr, size = 900 * s;
    const drift = (nowMs || 0) / 1000 * (2 + 10 * (fx.wind || 0.2));
    const ox = ((-cam.x * s + drift * s) % size + size) % size - size, oy = ((-cam.y * s + drift * 0.4 * s) % size + size) % size - size;
    g.globalAlpha = 0.35 * fx.cloud * day;
    for (let x = ox; x < cam.W; x += size) for (let y = oy; y < cam.H; y += size) g.drawImage(this.cloudCanvas, x, y, size, size);
    g.globalAlpha = 1;
  }

  _precip(g, W, H, fx, nowMs, dpr) {
    const t = (nowMs || 0) / 1000;
    if (fx.rain >= fx.snow) {
      const n = Math.round(160 + 520 * fx.rain), len = 14 * dpr, wind = 0.25 + (fx.wind || 0) * 0.6;
      g.strokeStyle = 'rgba(210,220,235,0.42)'; g.lineWidth = 1 * dpr; g.beginPath();
      for (let i = 0; i < n; i++) {
        const sx = u01(hash2(91, i)) * (W + 200) - 100, speed = 900 + u01(hash2(93, i)) * 600;
        const y = ((u01(hash2(92, i)) * H + t * speed * dpr) % (H + len)) - len;
        const x = sx + y * wind;
        g.moveTo(x, y); g.lineTo(x - len * wind * 0.5, y - len);
      }
      g.stroke();
    } else {
      const n = Math.round(150 + 450 * fx.snow);
      g.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < n; i++) {
        const speed = 40 + u01(hash2(95, i)) * 50;
        const y = (u01(hash2(96, i)) * H + t * speed * dpr) % H;
        const x = (u01(hash2(97, i)) * W + Math.sin(t + i) * 12 * dpr + t * 15 * dpr) % W;
        g.beginPath(); g.arc(x, y, (1 + u01(hash2(98, i)) * 1.6) * dpr, 0, Math.PI * 2); g.fill();
      }
    }
  }

  _vignette(g, cam) {
    const s = cam.z * cam.dpr, R = this.scene.R;
    const x0 = (-R - cam.x) * s + cam.W / 2, y0 = (-R - cam.y) * s + cam.H / 2, x1 = (R - cam.x) * s + cam.W / 2, y1 = (R - cam.y) * s + cam.H / 2;
    const fade = 40 * cam.dpr;
    const bg = this.P.theme === 'dark' ? '21,23,26' : '233,230,223';
    const edge = (gx0, gy0, gx1, gy1, rx, ry, rw, rh) => { const grd = g.createLinearGradient(gx0, gy0, gx1, gy1); grd.addColorStop(0, `rgba(${bg},0)`); grd.addColorStop(1, `rgba(${bg},0.92)`); g.fillStyle = grd; g.fillRect(rx, ry, rw, rh); };
    g.fillStyle = `rgba(${bg},0.92)`;
    if (x0 > 0) g.fillRect(0, 0, x0, cam.H);
    if (x1 < cam.W) g.fillRect(x1, 0, cam.W - x1, cam.H);
    if (y0 > 0) g.fillRect(0, 0, cam.W, y0);
    if (y1 < cam.H) g.fillRect(0, y1, cam.W, cam.H - y1);
    edge(x0 + fade, 0, x0, 0, x0, y0, fade, y1 - y0);
    edge(x1 - fade, 0, x1, 0, x1 - fade, y0, fade, y1 - y0);
    edge(0, y0 + fade, 0, y0, x0, y0, x1 - x0, fade);
    edge(0, y1 - fade, 0, y1, x0, y1 - fade, x1 - x0, fade);
  }

  _drawLabels(g, cam, view, s, night) {
    const z = cam.z;
    if (z < 0.9) return;
    const dpr = cam.dpr;
    const placed = [];
    const P = this.P;
    const dark = P.theme === 'dark' || night > 0.55;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const fits = (x, y, w, h) => { for (const r of placed) if (Math.abs(r[0] - x) < (r[2] + w) / 2 && Math.abs(r[1] - y) < (r[3] + h) / 2) return false; placed.push([x, y, w, h]); return true; };
    const size = Math.round(clamp(10 + z * 0.8, 10.5, 13) * dpr);
    g.font = `600 ${size}px system-ui, -apple-system, Segoe UI, sans-serif`;
    for (const l of this.labels.streets) {
      if (l.minZ > z) continue;
      if (l.x < view[0] || l.x > view[2] || l.y < view[1] || l.y > view[3]) continue;
      const px = (l.x - cam.x) * s + cam.W / 2, py = (l.y - cam.y) * s + cam.H / 2;
      const text = l.text;
      const w = g.measureText(text).width + 8 * dpr;
      if (w > l.len * s * 0.9) continue;
      if (!fits(px, py, w, size * 1.4)) continue;
      g.save(); g.translate(px, py); g.rotate(l.ang);
      g.lineWidth = 3 * dpr; g.strokeStyle = dark ? 'rgba(15,17,20,0.85)' : 'rgba(255,255,250,0.9)'; g.strokeText(text, 0, 0);
      g.fillStyle = dark ? '#e8e6e0' : '#2a2e35'; g.fillText(text, 0, 0);
      g.restore();
    }
    if (z >= 1.4) {
      g.font = `italic 600 ${Math.round(11.5 * dpr)}px system-ui, sans-serif`;
      for (const l of this.labels.places) {
        if (l.x < view[0] || l.x > view[2] || l.y < view[1] || l.y > view[3]) continue;
        const px = (l.x - cam.x) * s + cam.W / 2, py = (l.y - cam.y) * s + cam.H / 2;
        const w = g.measureText(l.text).width + 8 * dpr;
        if (!fits(px, py, w, 16 * dpr)) continue;
        g.lineWidth = 3 * dpr; g.strokeStyle = dark ? 'rgba(15,17,20,0.85)' : 'rgba(255,255,250,0.9)'; g.strokeText(l.text, px, py);
        g.fillStyle = dark ? '#cfe6c5' : '#2f5a2a'; g.fillText(l.text, px, py);
      }
    }
    if (z >= 4.5) {
      g.font = `${Math.round(10 * dpr)}px system-ui, sans-serif`;
      for (const b of this.scene.buildings) {
        if (!b.label || b.kind === 'house' || b.kind === 'apartment' || b.kind === 'mobile-home') continue;
        if (b.cx < view[0] || b.cx > view[2] || b.cy < view[1] || b.cy > view[3]) continue;
        const px = (b.cx - cam.x) * s + cam.W / 2, py = (b.cy - cam.y) * s + cam.H / 2;
        const text = b.label.split(', ')[0];
        const w = g.measureText(text).width + 6 * dpr;
        if (!fits(px, py, w, 14 * dpr)) continue;
        g.lineWidth = 2.5 * dpr; g.strokeStyle = 'rgba(255,255,255,0.85)'; g.strokeText(text, px, py);
        g.fillStyle = '#3a2f25'; g.fillText(text, px, py);
      }
    }
  }

  _drawBubbles(g, sim, cam, s, nowMs) {
    const dpr = cam.dpr;
    const placed = [];          // bubbles already drawn this frame: later ones move up instead of covering them
    const order = sim.bubbles.slice().sort((p, q) => (p.until - q.until));
    for (const b of order) {
      const a = b.agent;
      if (!a.bubble || a.bubble.until < nowMs) continue;
      const px = (a.x - cam.x) * s + cam.W / 2, py = (a.y - cam.y) * s + cam.H / 2;
      if (px < -100 || px > cam.W + 100 || py < -60 || py > cam.H + 60) continue;
      const fade = clamp((a.bubble.until - nowMs) / 500, 0, 1);
      const fs = Math.round(12.5 * dpr), maxW = 210 * dpr;
      g.font = `${fs}px system-ui, -apple-system, Segoe UI, sans-serif`;
      const lines = wrap(g, a.bubble.text, maxW);
      let glossLines = [];
      if (a.bubble.gloss) { g.font = `italic ${Math.round(11 * dpr)}px system-ui, sans-serif`; glossLines = wrap(g, `[${a.bubble.gloss}]`, maxW); }
      g.font = `${fs}px system-ui, -apple-system, Segoe UI, sans-serif`;
      let w = 0; for (const l of lines) w = Math.max(w, g.measureText(l).width);
      g.font = `italic ${Math.round(11 * dpr)}px system-ui, sans-serif`; for (const l of glossLines) w = Math.max(w, g.measureText(l).width);
      const lh = fs * 1.25, pad = 7 * dpr;
      const bw = w + 2 * pad, bh = (lines.length + glossLines.length) * lh + 2 * pad;
      const bx = px - bw / 2;
      let by = py - bh - 14 * dpr - (a.kind === 'walk' ? 4 : 10) * Math.min(s, 6) * 0.15;
      for (let guard = 0; guard < 6; guard++) {
        const hit = placed.find(r => bx < r[0] + r[2] && bx + bw > r[0] && by < r[1] + r[3] + 4 * dpr && by + bh > r[1] - 4 * dpr);
        if (!hit) break;
        by = hit[1] - bh - 6 * dpr;
      }
      placed.push([bx, by, bw, bh]);
      g.globalAlpha = fade;
      g.fillStyle = 'rgba(0,0,0,0.18)'; roundRect(g, bx + 2 * dpr, by + 3 * dpr, bw, bh, 9 * dpr); g.fill();
      g.fillStyle = this.bubbleBg || '#fffdf8'; roundRect(g, bx, by, bw, bh, 9 * dpr); g.fill();
      g.beginPath(); g.moveTo(px - 6 * dpr, by + bh - 1); g.lineTo(px, by + bh + 9 * dpr); g.lineTo(px + 6 * dpr, by + bh - 1); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.15)'; g.lineWidth = 1 * dpr; roundRect(g, bx, by, bw, bh, 9 * dpr); g.stroke();
      g.textAlign = 'left'; g.textBaseline = 'top';
      g.fillStyle = this.bubbleFg || '#1e2329'; g.font = `${fs}px system-ui, -apple-system, Segoe UI, sans-serif`;
      lines.forEach((l, i) => g.fillText(l, bx + pad, by + pad + i * lh));
      g.fillStyle = '#5b6470'; g.font = `italic ${Math.round(11 * dpr)}px system-ui, sans-serif`;
      glossLines.forEach((l, i) => g.fillText(l, bx + pad, by + pad + (lines.length + i) * lh));
      g.globalAlpha = 1;
    }
  }

  _scaleBar(g, cam, night) {
    const dpr = cam.dpr, px = cam.z;
    const nice = [5, 10, 20, 50, 100, 200, 500];
    const m = nice.find(v => v * px >= 70) || 500;
    const w = m * px * dpr, x = 14 * dpr, y = cam.H - 18 * dpr;
    const dark = this.P.theme === 'dark' || night > 0.55;
    g.strokeStyle = dark ? 'rgba(235,235,230,0.9)' : 'rgba(30,30,30,0.85)'; g.lineWidth = 2 * dpr;
    g.beginPath(); g.moveTo(x, y - 5 * dpr); g.lineTo(x, y); g.lineTo(x + w, y); g.lineTo(x + w, y - 5 * dpr); g.stroke();
    g.fillStyle = g.strokeStyle; g.font = `${11 * dpr}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'bottom';
    g.fillText(m >= 1000 ? m / 1000 + ' km' : m + ' m', x + w / 2, y - 6 * dpr);
  }

  /** Mean brightness of the canvas (0..255), sampled on a coarse grid (tests use it to compare day and night). */
  brightness() {
    const c = this.canvas, g = this.g;
    const w = c.width, h = c.height;
    const data = g.getImageData(0, 0, w, h).data;
    let sum = 0, n = 0;
    for (let y = 0; y < h; y += 8) for (let x = 0; x < w; x += 8) { const k = 4 * (y * w + x); sum += 0.2126 * data[k] + 0.7152 * data[k + 1] + 0.0722 * data[k + 2]; n++; }
    return n ? sum / n : 0;
  }
}

// ---------------------------------------------------------------- shapes in an agent's frame (x forward, meters)

const CAR_COLORS = ['#f2f2f0', '#f2f2f0', '#1d1f22', '#1d1f22', '#8e9399', '#8e9399', '#c4c8cc', '#c4c8cc', '#2f4d7c', '#9b2a2a', '#5a2e2e', '#3c5f43', '#7a6a55', '#b8a77c', '#2a6f86', '#d9822b'];
const BODIES = [{ body: 'sedan', len: 4.7, wid: 1.85, w: 34 }, { body: 'suv', len: 4.9, wid: 1.95, w: 26 }, { body: 'compact', len: 4.2, wid: 1.78, w: 16 }, { body: 'pickup', len: 5.6, wid: 2.0, w: 14 }, { body: 'van', len: 5.2, wid: 2.0, w: 6 }];
const lookCache = new Map();

/** The look of a parked car from its hash (same as the simulation's vehicleLook). */
export function carLook(h, rural) {
  const key = h * 2 + (rural ? 1 : 0);
  let v = lookCache.get(key);
  if (v) return v;
  const w = BODIES.map(b => b.w * (b.body === 'pickup' && rural ? 2.5 : 1));
  let tot = w.reduce((a, b) => a + b, 0), x = u01(h) * tot, i = 0;
  for (; i < w.length - 1; i++) { x -= w[i]; if (x <= 0) break; }
  v = { body: BODIES[i].body, len: BODIES[i].len, wid: BODIES[i].wid, color: CAR_COLORS[(h >>> 7) % CAR_COLORS.length] };
  if (lookCache.size > 20000) lookCache.clear();
  lookCache.set(key, v);
  return v;
}

function roundRect(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r); g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
}

/** A car seen from above: body, cabin, glass, lights; brake lights brighten, a blinker flashes on its side. */
function drawCarShape(g, v, small, brake, blink, sun) {
  const L = v.len || 4.6, W = v.wid || 1.8;
  if (v.body === 'motorcycle') {
    g.fillStyle = '#222'; roundRect(g, -1.05, -0.22, 2.1, 0.44, 0.2); g.fill();
    g.fillStyle = v.color || '#933'; roundRect(g, -0.5, -0.28, 1.1, 0.56, 0.25); g.fill();
    g.fillStyle = '#1b1b1b'; g.beginPath(); g.arc(-0.05, 0, 0.24, 0, Math.PI * 2); g.fill();
    return;
  }
  if (small) { g.fillStyle = v.color; g.fillRect(-L / 2, -W / 2, L, W); return; }
  if (sun && sun.strength > 0.05) { g.fillStyle = 'rgba(25,30,40,0.25)'; roundRect(g, -L / 2 + 0.35, -W / 2 + 0.35, L, W, 0.45); g.fill(); }
  g.fillStyle = v.color; roundRect(g, -L / 2, -W / 2, L, W, 0.45); g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 0.06; g.stroke();
  const glass = '#2c3a4a';
  if (v.body === 'pickup') {
    g.fillStyle = shade(v.color, 0.8); g.fillRect(-L / 2 + 0.2, -W / 2 + 0.2, L * 0.4, W - 0.4);
    g.fillStyle = glass; g.fillRect(L * 0.02, -W / 2 + 0.22, 0.5, W - 0.44);
    g.fillStyle = shade(v.color, 1.12); g.fillRect(L * 0.02 + 0.5, -W / 2 + 0.24, 0.9, W - 0.48);
  } else {
    const cab0 = v.body === 'van' ? -L / 2 + 0.5 : -L * 0.27, cab1 = v.body === 'van' ? L * 0.3 : L * 0.2;
    g.fillStyle = glass; roundRect(g, cab0 - 0.2, -W / 2 + 0.18, cab1 - cab0 + 0.65, W - 0.36, 0.3); g.fill();
    g.fillStyle = shade(v.color, v.color === '#1d1f22' ? 1.5 : 1.06); roundRect(g, cab0 + 0.25, -W / 2 + 0.28, cab1 - cab0 - 0.35, W - 0.56, 0.25); g.fill();
  }
  // lamps: headlights pale, tail lights red (bright when braking), blinker amber
  g.fillStyle = '#f4ecd0'; g.fillRect(L / 2 - 0.16, -W / 2 + 0.16, 0.14, 0.38); g.fillRect(L / 2 - 0.16, W / 2 - 0.54, 0.14, 0.38);
  g.fillStyle = brake ? '#ff2a1f' : '#9e1b16'; g.fillRect(-L / 2 + 0.02, -W / 2 + 0.16, 0.14, 0.36); g.fillRect(-L / 2 + 0.02, W / 2 - 0.52, 0.14, 0.36);
  if (blink) { g.fillStyle = '#ffb21c'; const y = blink > 0 ? W / 2 - 0.2 : -W / 2 + 0.05; g.fillRect(L / 2 - 0.3, y, 0.28, 0.15); g.fillRect(-L / 2 + 0.02, y, 0.28, 0.15); }
}

function drawBus(g, a, small, sun) {
  const L = a.len, W = a.wid;
  if (small) { g.fillStyle = a.color; g.fillRect(-L / 2, -W / 2, L, W); return; }
  if (sun && sun.strength > 0.05) { g.fillStyle = 'rgba(25,30,40,0.25)'; g.fillRect(-L / 2 + 0.6, -W / 2 + 0.6, L, W); }
  g.fillStyle = '#f1f1ec'; roundRect(g, -L / 2, -W / 2, L, W, 0.35); g.fill();
  g.fillStyle = a.color || '#d9b310'; g.fillRect(-L / 2 + 0.2, -W / 2, L - 0.4, 0.28); g.fillRect(-L / 2 + 0.2, W / 2 - 0.28, L - 0.4, 0.28);
  g.fillStyle = '#c9cdd1'; for (let x = -L / 2 + 1.5; x < L / 2 - 2; x += 3.1) g.fillRect(x, -0.55, 1.8, 1.1);
  g.fillStyle = '#2c3a4a'; g.fillRect(L / 2 - 0.5, -W / 2 + 0.2, 0.42, W - 0.4);
  g.fillStyle = '#f4ecd0'; g.fillRect(L / 2 - 0.1, -W / 2 + 0.15, 0.1, 0.4); g.fillRect(L / 2 - 0.1, W / 2 - 0.55, 0.1, 0.4);
}

function drawBike(g, a, small, walked) {
  if (small) { g.fillStyle = a.look ? a.look.shirt : '#444'; g.fillRect(-0.9, -0.3, 1.8, 0.6); return; }
  g.strokeStyle = '#2b2b2b'; g.lineWidth = 0.07; g.beginPath(); g.moveTo(-0.85, 0); g.lineTo(0.85, 0); g.stroke();
  g.fillStyle = '#1e1e1e'; g.fillRect(-0.9, -0.04, 0.5, 0.08); g.fillRect(0.4, -0.04, 0.5, 0.08);
  const ph = Math.sin(walked * 2.2) * 0.12;
  g.fillStyle = a.look ? a.look.pants : '#333'; g.beginPath(); g.ellipse(0.05 + ph, -0.13, 0.22, 0.07, 0, 0, Math.PI * 2); g.ellipse(0.05 - ph, 0.13, 0.22, 0.07, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = a.look ? a.look.shirt : '#555'; g.beginPath(); g.ellipse(-0.05, 0, 0.2, 0.25, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#e8e8e8'; g.beginPath(); g.ellipse(0.06, 0, 0.13, 0.11, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = a.look ? a.look.shirt : '#555'; g.lineWidth = 0.08; g.beginPath(); g.moveTo(0, -0.2); g.lineTo(0.55, -0.22); g.moveTo(0, 0.2); g.lineTo(0.55, 0.22); g.stroke();
}

/** A person from above, walking: legs and arms swing with distance walked; an umbrella in the rain; a dog. */
function drawPerson(g, a, walked, umbrella, sun) {
  const look = a.look || { shirt: '#666', hair: '#333', pants: '#333' };
  const moving = a.v > 0.1;
  const ph = moving ? Math.sin(walked * 4.4) : 0;
  if (sun && sun.strength > 0.05) { g.fillStyle = 'rgba(25,30,40,0.22)'; g.beginPath(); g.ellipse(sun.dx * 0.5, sun.dy * 0.5, 0.3, 0.26, 0, 0, Math.PI * 2); g.fill(); }
  if (a.dog) {
    const dx = -0.55 + Math.sin(walked * 6) * 0.05, dy = 0.75;
    g.fillStyle = ['#5a3d24', '#c9a26b', '#1f1b18', '#e8e2d6'][(a.uid >>> 2) % 4];
    g.beginPath(); g.ellipse(dx, dy, 0.3, 0.11, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(dx + 0.32, dy, 0.09, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(40,40,40,0.6)'; g.lineWidth = 0.03; g.beginPath(); g.moveTo(0.1, 0.18); g.lineTo(dx + 0.3, dy); g.stroke();
  }
  g.fillStyle = look.pants;
  g.beginPath(); g.ellipse(ph * 0.22, -0.1, 0.15, 0.065, 0, 0, Math.PI * 2); g.ellipse(-ph * 0.22, 0.1, 0.15, 0.065, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = shade(look.shirt, 0.85);
  g.beginPath(); g.ellipse(-ph * 0.16, -0.25, 0.1, 0.06, 0, 0, Math.PI * 2); g.ellipse(ph * 0.16, 0.25, 0.1, 0.06, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = look.shirt; g.beginPath(); g.ellipse(0, 0, 0.15, 0.25, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = look.hair; g.beginPath(); g.arc(0.02, 0, 0.105, 0, Math.PI * 2); g.fill();
  if (umbrella) {
    const col = ['#b03a48', '#2b5d8a', '#2f2f2f', '#e0a526', '#3f7f5f'][(a.uid >>> 3) % 5];
    g.globalAlpha = 0.92 * umbrella;
    g.fillStyle = col; g.beginPath(); g.arc(0.05, 0, 0.55, 0, Math.PI * 2); g.fill();
    g.strokeStyle = shade(col, 0.7); g.lineWidth = 0.03; g.beginPath(); for (let k = 0; k < 8; k++) { const ang = k * Math.PI / 4; g.moveTo(0.05, 0); g.lineTo(0.05 + Math.cos(ang) * 0.55, Math.sin(ang) * 0.55); } g.stroke();
    g.globalAlpha = 1;
  }
}

function wrap(g, text, maxW) {
  const words = String(text).split(/\s+/), lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
    if (lines.length >= 4) break;
  }
  if (cur && lines.length < 5) lines.push(cur);
  return lines;
}

// ---------------------------------------------------------------- lamps and labels (per scene)

/** Street lamps every ~34 m along lit streets, porch lights on some homes, storefront and parking-lot lights. */
function buildLamps(scene) {
  const out = [], net = scene.net, p = {};
  const urban = scene.mode === 'urban';
  for (const e of net.edges) {
    if (e.cls === 'path' || e.cls === 'driveway') continue;
    const lit = e.freeway || e.cls === 'arterial' || e.cls === 'highway' || e.cls === 'collector' || (urban && (e.cls === 'local' || e.cls === 'alley'));
    if (!lit && !(e.cls === 'rural' && e.len > 0)) continue;
    const spacing = e.cls === 'rural' || e.cls === 'lane' ? 1e9 : e.cls === 'alley' ? 45 : e.freeway ? 50 : 34;
    let k = 0;
    for (let s = spacing / 2; s < e.len; s += spacing, k++) {
      pointAt(e.pts, e.cum, s, p);
      const side = k % 2 ? 1 : -1, off = e.curb + 0.4;
      const warm = scene.ctx.yb < 1975 && hf(hash2(e.id, 3), 1) < 0.5;
      out.push({ x: p.x - p.ty * side * off, y: p.y + p.tx * side * off, r: e.freeway ? 18 : e.cls === 'alley' ? 8 : 13, kind: 'street', c0: warm ? 'rgba(255,190,110,0.75)' : 'rgba(255,236,200,0.7)', c1: warm ? 'rgba(255,170,80,0.28)' : 'rgba(255,230,190,0.25)' });
    }
  }
  // rural intersections get one lamp
  for (const n of net.nodes) if (n.adj.length >= 3 && n.adj.some(a => net.edges[a.e].cls === 'rural')) out.push({ x: n.x, y: n.y, r: 14, kind: 'street', c0: 'rgba(255,200,120,0.7)', c1: 'rgba(255,190,110,0.25)' });
  for (const b of scene.buildings) {
    if (!b.access) continue;
    const h = hash2(0x9047, b.id);
    if ((b.kind === 'house' || b.kind === 'small-apartment' || b.kind === 'mobile-home') && hf(h, 1) < 0.55) {
      const x = b.access.doorX, y = b.access.doorY;
      out.push({ x, y, r: 4.5, kind: 'porch', c0: 'rgba(255,205,130,0.85)', c1: 'rgba(255,190,110,0.3)' });
    } else if (b.kind === 'commercial' || b.kind === 'school' || b.kind === 'apartment') {
      out.push({ x: b.cx, y: b.cy, r: Math.min(26, Math.max(b.hw, b.hd) * 1.4), kind: 'front', c0: 'rgba(255,225,170,0.35)', c1: 'rgba(255,215,160,0.15)' });
    }
  }
  for (const a of scene.areas) {
    if (a.kind !== 'parking' && a.kind !== 'commercial') continue;
    const c = a.frame ? a.frame.c : null;
    if (c) out.push({ x: c.x, y: c.y, r: 22, kind: 'lot', c0: 'rgba(240,240,255,0.45)', c1: 'rgba(220,225,255,0.18)' });
  }
  return out;
}

/** Street name labels (one per street per ~300 m, at the middle of long edges) and place names. */
function buildLabels(scene) {
  const net = scene.net, byName = new Map();
  for (const e of net.edges) {
    if (!e.name || e.cls === 'driveway' || e.cls === 'path' || e.len < 45) continue;
    if (e.cls === 'alley' && e.name === 'Alley') continue;
    let arr = byName.get(e.name); if (!arr) byName.set(e.name, arr = []); arr.push(e);
  }
  const streets = [];
  for (const [name, edges] of byName) {
    edges.sort((a, b) => b.len - a.len);
    const used = [];
    for (const e of edges) {
      const p = pointAt(e.pts, e.cum, e.len / 2, {});
      if (used.some(u => Math.hypot(u.x - p.x, u.y - p.y) < 280)) continue;
      let ang = Math.atan2(p.ty, p.tx);
      if (ang > Math.PI / 2) ang -= Math.PI; else if (ang < -Math.PI / 2) ang += Math.PI;
      const minZ = e.rank >= 6 ? 0.9 : e.rank >= 5 ? 1.2 : e.cls === 'alley' ? 4 : 1.6;
      const lab = { x: p.x, y: p.y, ang, text: shortName(name), len: e.len, minZ, rank: e.rank };
      streets.push(lab); used.push(lab);
    }
  }
  streets.sort((a, b) => b.rank - a.rank || b.len - a.len);
  const places = [];
  for (const a of scene.areas) if (a.name && (a.kind === 'park' || a.kind === 'school' || a.kind === 'commercial' || a.kind === 'apartments' || a.kind === 'mhpark')) {
    const c = a.frame ? a.frame.c : null; if (c) places.push({ x: c.x, y: c.y, text: a.name });
  }
  return { streets, places };
}

function now() { return typeof performance !== 'undefined' ? performance.now() : Date.now(); }

export { makeCanvas };
