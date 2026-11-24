// Legion · the statewide map: WebGL2 base layers, a 2D label overlay, the camera and its input.
//
// API
//   const map = new MapView(container, { world, theme: 'dark' | 'light', maxDpr = 2, labels = true });
//   map.camera                      {x, y, zoom}: the world point (units) at the container's center and the zoom in
//                                   CSS pixels per world unit (about 0.15 shows the whole state on a laptop screen)
//   map.setTheme('dark' | 'light')  sets data-theme on the container and re-reads its CSS custom properties
//   await map.flyTo(x, y, zoom, ms) smooth zoom-and-pan (van Wijk & Nuij); ms optional (by distance)
//   map.fitState(ms = 0)            frame the whole state
//   map.screenToWorld(px, py)       -> {x, y}; px, py in CSS pixels from the container's top-left
//   map.worldToScreen(x, y)         -> {px, py}
//   map.on(event, fn) -> off()      'move' {x, y, zoom} · 'click' {x, y, px, py, hit} · 'hover' {x, y, px, py} (the
//                                   pointer moved over the map, once per frame at most) · 'leave' {px, py} (it left
//                                   the map: hide hover UI) · 'theme' {theme, palette} · 'resize' {width, height, dpr}
//   map.addLayer(layer)             layer.draw(frame) runs after the base layers, in order; optional layer.pick(x, y,
//                                   radiusUnits) is asked (topmost first) on clicks and its answer is the click's `hit`;
//                                   optional layer.contextRestored(gl) after a WebGL context loss
//   map.removeLayer(layer), map.resize(), map.destroy()
// Extras
//   map.getGL()                     the WebGL2 context (null in the Canvas 2D fallback)
//   map.requestRender()             draw on the next animation frame (coalesced); map.render() draws now
//   map.idleGapMs                   0, or (software WebGL) the least time the main thread is left free between two
//                                   frames nothing but the layers asked for: the crowd sets it while it builds
//   map.viewBounds()                {x0, y0, x1, y1} of the visible world
//   map.setShade(alpha)             night darkening drawn over the base map, under the layers (0..1)
//   map.setCamera(x, y, zoom)       jump; map.zoomBy(factor, px, py, ms) zoom about a screen point
//   map.palette                     the theme's colors as {name: [r, g, b]} (0..1); map.cssColor(name, fallback)
//   map.pickAt(px, py, radiusPx)    the first layer pick at a screen point
//
// Frame passed to layers: {map, gl, ctx (2D context in the fallback, else null), width, height (device px), cssWidth,
// cssHeight, dpr, camera, zoom, view (Float32Array [cx, cy, sx, sy]: clip = (p - c) * s), bounds, theme, palette, time}.
//
// Theme: CSS custom properties on the container (or inherited): --map-ocean --map-land --map-neighbor --map-water
// --map-coast --map-county --map-zip --map-border --map-road --map-road-us --map-interstate --map-label --map-halo
// --map-shade, and when those are absent, colors derived from --bg, --ink and --accent; else built-in defaults.

import { pointInRings } from '../engine/world.mjs';

const PAL = { OCEAN: 0, LAND: 1, NEIGHBOR: 2, WATER: 3, COAST: 4, COUNTY: 5, ZIP: 6, BORDER: 7, ROAD: 8, ROAD_US: 9, ROAD_I: 10, LABEL: 11, HALO: 12, ACCENT: 13, SHADE: 14 };
const PAL_NAMES = ['ocean', 'land', 'neighbor', 'water', 'coast', 'county', 'zip', 'border', 'road', 'road-us', 'interstate', 'label', 'halo', 'accent', 'shade'];

/** Base colors of the two built-in themes (everything else derives from these unless the CSS says otherwise). */
export const THEME_BASE = Object.freeze({
  dark: { bg: '#0b0f14', ink: '#e6e2dc', accent: '#ff9a4d', sea: '#1d4f7a' },
  light: { bg: '#f5f2ed', ink: '#22272e', accent: '#d9661e', sea: '#5d8fb8' },
});

const MIN_HAIR = 1;

// ---------------------------------------------------------------- color utilities

let _colorCtx = null;

/** [r, g, b, a] (0..1) of a '#rgb', '#rgba', '#rrggbb' or '#rrggbbaa' string, or null. */
function parseHex(v) {
  const hex = /^#([0-9a-f]{3,8})$/i.exec(v);
  if (!hex) return null;
  let h = hex[1];
  if (h.length === 3 || h.length === 4) h = h.split('').map(c => c + c).join('');
  if (h.length !== 6 && h.length !== 8) return null;
  const n = parseInt(h.slice(0, 6), 16), a = h.length === 8 ? parseInt(h.slice(6), 16) / 255 : 1;
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255, a];
}

/**
 * Parse any CSS color to [r, g, b, a] in 0..1 (straight, not premultiplied, alpha), or null when the browser does
 * not understand it. Hex is parsed here; anything else (rgba(), hsl(), named colors, color-mix() …) goes through a 2D
 * canvas: its fillStyle serializes sRGB colors as '#rrggbb' or 'rgba(r, g, b, a)', read exactly; other color spaces
 * are drawn to one pixel and read back (getImageData returns un-premultiplied values).
 */
export function parseColor(value) {
  if (value == null) return null;
  const v = String(value).trim();
  if (!v) return null;
  const hex = parseHex(v);
  if (hex) return hex;
  if (typeof document === 'undefined' && typeof OffscreenCanvas === 'undefined') return null;
  if (!_colorCtx) {
    const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(1, 1) : document.createElement('canvas');
    c.width = 1; c.height = 1;
    _colorCtx = c.getContext('2d', { willReadFrequently: true });
  }
  const g = _colorCtx;
  // an invalid value leaves fillStyle alone: set it after two different colors and see whether it stuck
  g.fillStyle = '#000000'; g.fillStyle = v;
  const s = g.fillStyle;
  g.fillStyle = '#ffffff'; g.fillStyle = v;
  if (g.fillStyle !== s) return null;
  if (typeof s === 'string') {
    const h = parseHex(s);
    if (h) return h;
    const m = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(s);
    if (m) return [+m[1] / 255, +m[2] / 255, +m[3] / 255, m[4] == null ? 1 : +m[4]];
  }
  g.clearRect(0, 0, 1, 1);
  g.fillRect(0, 0, 1, 1);
  const d = g.getImageData(0, 0, 1, 1).data;
  return [d[0] / 255, d[1] / 255, d[2] / 255, d[3] / 255];
}

const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const css = c => `rgb(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)})`;
const luminance = c => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

// ---------------------------------------------------------------- triangulation

/**
 * Ear-clipping triangulation of one simple ring of either orientation. Degenerate vertices (repeats, spikes) are
 * dropped; if a self-touching ring leaves no valid ear, the most convex vertex is clipped so the result always
 * covers the ring.
 * @param {ArrayLike<number>} ring flat [x0, y0, x1, y1, …], closing vertex optional
 * @returns {Uint32Array} indices into the ring's vertices, three per triangle
 */
export function triangulate(ring) {
  let n = ring.length >> 1;
  if (n > 3 && ring[0] === ring[2 * n - 2] && ring[1] === ring[2 * n - 1]) n--;
  if (n < 3) return new Uint32Array(0);
  let area = 0;
  for (let i = 0, j = n - 1; i < n; j = i++) area += ring[2 * j] * ring[2 * i + 1] - ring[2 * i] * ring[2 * j + 1];
  const sgn = area >= 0 ? 1 : -1;
  const prev = new Int32Array(n), next = new Int32Array(n), reflex = new Uint8Array(n);
  for (let i = 0; i < n; i++) { prev[i] = i === 0 ? n - 1 : i - 1; next[i] = i === n - 1 ? 0 : i + 1; }
  const X = i => ring[2 * i], Y = i => ring[2 * i + 1];
  const cross = (a, b, c) => ((X(b) - X(a)) * (Y(c) - Y(b)) - (Y(b) - Y(a)) * (X(c) - X(b))) * sgn;
  const eps = Math.abs(area) * 1e-12;
  for (let i = 0; i < n; i++) reflex[i] = cross(prev[i], i, next[i]) <= eps ? 1 : 0;
  const inside = (p, a, b, c) => {
    const px = X(p), py = Y(p);
    const d1 = ((X(b) - X(a)) * (py - Y(a)) - (Y(b) - Y(a)) * (px - X(a))) * sgn;
    const d2 = ((X(c) - X(b)) * (py - Y(b)) - (Y(c) - Y(b)) * (px - X(b))) * sgn;
    const d3 = ((X(a) - X(c)) * (py - Y(c)) - (Y(a) - Y(c)) * (px - X(c))) * sgn;
    // on an edge counts: a reflex vertex touching the candidate ear would leave a needle behind
    return d1 >= 0 && d2 >= 0 && d3 >= 0;
  };
  const isEar = b => {
    const a = prev[b], c = next[b];
    if (cross(a, b, c) <= eps) return false;
    const x0 = Math.min(X(a), X(b), X(c)), x1 = Math.max(X(a), X(b), X(c)), y0 = Math.min(Y(a), Y(b), Y(c)), y1 = Math.max(Y(a), Y(b), Y(c));
    for (let p = next[c]; p !== a; p = next[p]) {
      if (!reflex[p]) continue;
      const px = X(p), py = Y(p);
      if (px < x0 || px > x1 || py < y0 || py > y1) continue;
      if ((px === X(a) && py === Y(a)) || (px === X(b) && py === Y(b)) || (px === X(c) && py === Y(c))) continue;
      if (inside(p, a, b, c)) return false;
    }
    return true;
  };
  const out = [];
  let remaining = n, ear = 0, stall = 0;
  const unlink = b => {
    const a = prev[b], c = next[b];
    next[a] = c; prev[c] = a; remaining--;
    reflex[a] = cross(prev[a], a, c) <= eps ? 1 : 0;
    reflex[c] = cross(a, c, next[c]) <= eps ? 1 : 0;
    return c;
  };
  while (remaining > 3) {
    if (isEar(ear)) { out.push(prev[ear], ear, next[ear]); ear = unlink(ear); stall = 0; continue; }
    ear = next[ear];
    if (++stall < remaining) continue;
    // no ear in a full pass: drop a degenerate vertex if there is one, else clip the most convex vertex
    let v = ear, best = -1, bestCross = -Infinity, dropped = false;
    for (let k = 0; k < remaining; k++, v = next[v]) {
      const cr = cross(prev[v], v, next[v]);
      if (Math.abs(cr) <= eps) { ear = unlink(v); dropped = true; break; }
      if (cr > bestCross) { bestCross = cr; best = v; }
    }
    if (!dropped) { out.push(prev[best], best, next[best]); ear = unlink(best); }
    stall = 0;
  }
  if (remaining === 3 && Math.abs(cross(prev[ear], ear, next[ear])) > eps) out.push(prev[ear], ear, next[ear]);
  return Uint32Array.from(out);
}

/**
 * Drop repeated vertices and zero-area turns (collinear points and the tips of back-and-forth spikes, common in
 * traced outlines), one at a time so each test sees the current neighbors.
 * @param {ArrayLike<number>} ring flat [x0, y0, …]
 * @returns {Float64Array}
 */
export function cleanRing(ring) {
  let n = ring.length >> 1;
  if (n > 1 && ring[0] === ring[2 * n - 2] && ring[1] === ring[2 * n - 1]) n--;
  if (n < 3) return new Float64Array(0);
  const prev = new Int32Array(n), next = new Int32Array(n), alive = new Uint8Array(n).fill(1);
  for (let i = 0; i < n; i++) { prev[i] = i === 0 ? n - 1 : i - 1; next[i] = i === n - 1 ? 0 : i + 1; }
  const stack = [];
  for (let i = n - 1; i >= 0; i--) stack.push(i);
  let count = n;
  while (stack.length && count > 2) {
    const i = stack.pop();
    if (!alive[i]) continue;
    const a = prev[i], c = next[i];
    const ax = ring[2 * a], ay = ring[2 * a + 1], x = ring[2 * i], y = ring[2 * i + 1], cx = ring[2 * c], cy = ring[2 * c + 1];
    if ((x === ax && y === ay) || (x - ax) * (cy - y) - (y - ay) * (cx - x) === 0) {
      alive[i] = 0; next[a] = c; prev[c] = a; count--;
      stack.push(a, c);
    }
  }
  if (count < 3) return new Float64Array(0);
  let s = 0;
  while (!alive[s]) s++;
  const out = new Float64Array(2 * count);
  for (let k = 0, i = s; k < count; k++, i = next[i]) { out[2 * k] = ring[2 * i]; out[2 * k + 1] = ring[2 * i + 1]; }
  return out;
}

const ringArea = r => { let a = 0; const n = r.length >> 1; for (let i = 0, j = n - 1; i < n; j = i++) a += r[2 * j] * r[2 * i + 1] - r[2 * i] * r[2 * j + 1]; return a / 2; };

/**
 * Fill geometry of rings: ear-clipped triangles for every ring whose triangulation verifies (triangle areas sum to
 * the ring's area), and for the others (self-intersecting or pinched outlines) triangle fans plus a covering quad,
 * drawn with the stencil even-odd technique. Returns {tris, fans, cover} as flat Float32Array coordinates.
 * @param {ArrayLike<number>[]} rings
 */
export function buildFill(rings) {
  const tris = [], fans = [];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const raw of rings) {
    const r = cleanRing(raw);
    if (r.length < 6) continue;
    const idx = triangulate(r), a = Math.abs(ringArea(r));
    let t = 0;
    for (let k = 0; k < idx.length; k += 3) {
      const i = idx[k], j = idx[k + 1], l = idx[k + 2];
      t += Math.abs((r[2 * j] - r[2 * i]) * (r[2 * l + 1] - r[2 * i + 1]) - (r[2 * j + 1] - r[2 * i + 1]) * (r[2 * l] - r[2 * i])) / 2;
    }
    if (a > 0 && Math.abs(t - a) <= a * 1e-4) {
      for (let k = 0; k < idx.length; k++) tris.push(r[2 * idx[k]], r[2 * idx[k] + 1]);
      continue;
    }
    const n = r.length >> 1;
    for (let i = 1; i + 1 < n; i++) fans.push(r[0], r[1], r[2 * i], r[2 * i + 1], r[2 * i + 2], r[2 * i + 3]);
    for (let i = 0; i < n; i++) { x0 = Math.min(x0, r[2 * i]); x1 = Math.max(x1, r[2 * i]); y0 = Math.min(y0, r[2 * i + 1]); y1 = Math.max(y1, r[2 * i + 1]); }
  }
  const cover = fans.length ? [x0, y0, x1, y0, x1, y1, x0, y0, x1, y1, x0, y1] : [];
  return { tris: Float32Array.from(tris), fans: Float32Array.from(fans), cover: Float32Array.from(cover) };
}

/** Line-instance records [x0, y0, x1, y1, widthPx, color] for every edge of the rings. */
function ringSegments(rings, width, color, out = []) {
  for (const r of rings) {
    const n = r.length >> 1;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      if (r[2 * i] === r[2 * j] && r[2 * i + 1] === r[2 * j + 1]) continue;
      out.push(r[2 * i], r[2 * i + 1], r[2 * j], r[2 * j + 1], width, color);
    }
  }
  return out;
}

// ---------------------------------------------------------------- shaders

const FILL_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec2 a_pos;
uniform vec4 u_view;
void main() { gl_Position = vec4((a_pos - u_view.xy) * u_view.zw, 0.0, 1.0); }`;

const COLOR_FS = `#version 300 es
precision mediump float;
uniform vec4 u_color;
out vec4 o;
void main() { o = u_color; }`;

const LINE_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec4 a_seg;
layout(location = 1) in vec2 a_wc;
uniform vec4 u_view;
uniform vec2 u_half;
uniform float u_scale;
uniform float u_alpha;
uniform vec4 u_palette[16];
out vec4 v_color;
const vec2 CORNER[6] = vec2[6](vec2(0.0, -1.0), vec2(0.0, 1.0), vec2(1.0, -1.0), vec2(1.0, -1.0), vec2(0.0, 1.0), vec2(1.0, 1.0));
void main() {
  vec2 k = CORNER[gl_VertexID];
  vec2 p0 = (a_seg.xy - u_view.xy) * u_view.zw * u_half;
  vec2 p1 = (a_seg.zw - u_view.xy) * u_view.zw * u_half;
  vec2 d = p1 - p0;
  float L = length(d);
  vec2 t = L > 1e-4 ? d / L : vec2(1.0, 0.0);
  vec2 n = vec2(-t.y, t.x);
  float w = a_wc.x * u_scale;
  float a = u_alpha;
  if (w < ${MIN_HAIR}.0) { a *= max(w, 0.0); w = ${MIN_HAIR}.0; }
  float hw = 0.5 * w;
  vec2 p = mix(p0, p1, k.x) + n * (k.y * hw) + t * ((k.x * 2.0 - 1.0) * hw);
  gl_Position = vec4(p / u_half, 0.0, 1.0);
  vec4 c = u_palette[int(a_wc.y + 0.5)];
  v_color = vec4(c.rgb * a, a);
}`;

const LINE_FS = `#version 300 es
precision mediump float;
in vec4 v_color;
out vec4 o;
void main() { o = v_color; }`;

const SHADE_VS = `#version 300 es
void main() { gl_Position = vec4(gl_VertexID == 1 ? 3.0 : -1.0, gl_VertexID == 2 ? 3.0 : -1.0, 0.0, 1.0); }`;

// the cached base map, copied to the canvas with one full-screen triangle
const COPY_VS = `#version 300 es
out vec2 v_uv;
void main() {
  vec2 p = vec2(gl_VertexID == 1 ? 3.0 : -1.0, gl_VertexID == 2 ? 3.0 : -1.0);
  v_uv = p * 0.5 + 0.5;
  gl_Position = vec4(p, 0.0, 1.0);
}`;
const COPY_FS = `#version 300 es
precision mediump float;
uniform sampler2D u_tex;
in vec2 v_uv;
out vec4 o;
void main() { o = texture(u_tex, v_uv); }`;

/** True for a WebGL context drawn by the CPU (SwiftShader, llvmpipe, Microsoft's Basic Render Driver). */
export function softwareGL(gl) {
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return /swiftshader|llvmpipe|software|basic render/i.test(String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || ''));
  } catch { return false; }
}

/** Compile and link a program; throws with the info log on failure. */
export function createProgram(gl, vsSrc, fsSrc, opts = {}) {
  const sh = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS) && !gl.isContextLost()) {
      const log = gl.getShaderInfoLog(s);
      gl.deleteShader(s);
      throw new Error(`shader compile failed: ${log}\n${src.split('\n').map((l, i) => `${i + 1}: ${l}`).join('\n')}`);
    }
    return s;
  };
  const p = gl.createProgram(), vs = sh(gl.VERTEX_SHADER, vsSrc), fs = sh(gl.FRAGMENT_SHADER, fsSrc);
  gl.attachShader(p, vs); gl.attachShader(p, fs);
  if (opts.varyings) gl.transformFeedbackVaryings(p, opts.varyings, gl.INTERLEAVED_ATTRIBS);
  gl.linkProgram(p);
  gl.deleteShader(vs); gl.deleteShader(fs);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS) && !gl.isContextLost()) throw new Error('program link failed: ' + gl.getProgramInfoLog(p));
  const uniforms = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS) || 0;
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i);
    const name = info.name.replace(/\[0\]$/, '');
    uniforms[name] = gl.getUniformLocation(p, info.name);
  }
  return { program: p, u: uniforms };
}

// ---------------------------------------------------------------- the map

const ZIP_TILE = 320;

/** The statewide map: WebGL2 base layers (Canvas 2D without WebGL2), labels, camera, input and layers. */
export class MapView {
  /**
   * @param {HTMLElement} container element the map fills (positioned; given a tabindex for the keyboard)
   * @param {{world: import('../engine/world.mjs').World, theme?: 'dark'|'light', maxDpr?: number, labels?: boolean}} opts
   */
  constructor(container, { world, theme = 'dark', maxDpr = 2, labels = true } = {}) {
    if (!world) throw new Error('MapView needs a world');
    this.world = world;
    this.container = container;
    this.theme = theme === 'light' ? 'light' : 'dark';
    this.maxDpr = maxDpr;
    this.showLabels = labels;
    this.layers = [];
    this.handlers = {};
    this.camera = { x: world.proj.W / 2, y: world.proj.H / 2, zoom: 0.15 };
    this.shade = 0;
    this.cssW = 1; this.cssH = 1; this.dpr = 1; this.W = 1; this.H = 1;
    this._raf = 0; this._anim = null; this._lastMove = null; this._labelsDirty = true; this._destroyed = false;
    this.idleGapMs = 0; this._gapTimer = 0; this._renderMs = 0; this._renderEnd = 0;
    this._pointers = new Map(); this._drag = null; this._hoverPending = null; this._velocity = [];

    const cs = getComputedStyle(container);
    if (cs.position === 'static') container.style.position = 'relative';
    container.style.overflow = 'hidden';
    container.style.touchAction = 'none';
    container.style.userSelect = 'none';
    if (!container.hasAttribute('tabindex')) container.tabIndex = 0;
    container.dataset.theme = this.theme;

    this.canvas = document.createElement('canvas');
    this.labelCanvas = document.createElement('canvas');
    for (const c of [this.canvas, this.labelCanvas]) {
      c.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;display:block';
      container.appendChild(c);
    }
    this.canvas.setAttribute('aria-label', 'Map of California');
    this.canvas.setAttribute('role', 'img');
    this.lctx = this.labelCanvas.getContext('2d');

    this.gl = this.canvas.getContext('webgl2', { antialias: true, alpha: false, depth: false, stencil: true, premultipliedAlpha: true, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
    this.ctx2d = this.gl ? null : this.canvas.getContext('2d');
    this._bbox = this._stateBBox();
    this._readTheme();
    if (this.gl) this._initGL(); else this._init2D();

    this._onLost = e => { e.preventDefault(); this._lost = true; if (this._raf) cancelAnimationFrame(this._raf); this._raf = 0; };
    this._onRestored = () => { this._lost = false; this._initGL(); for (const l of this.layers) if (l.contextRestored) l.contextRestored(this.gl); this.requestRender(); };
    this.canvas.addEventListener('webglcontextlost', this._onLost);
    this.canvas.addEventListener('webglcontextrestored', this._onRestored);
    this._bindInput();
    this._ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => this.resize()) : null;
    if (this._ro) this._ro.observe(container); else { this._onWinResize = () => this.resize(); window.addEventListener('resize', this._onWinResize); }
    this._watchDpr();
    this.resize();
    this.fitState(0);
    if (this.gl) this._scheduleZipBuild();
  }

  // ------------------------------------------------ events

  /** Subscribe to 'move' | 'click' | 'hover' | 'leave' | 'theme' | 'resize' (payloads in the header); returns an unsubscribe function. */
  on(event, fn) { (this.handlers[event] = this.handlers[event] || []).push(fn); return () => this.off(event, fn); }
  /** Unsubscribe. */
  off(event, fn) { const a = this.handlers[event]; if (a) { const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); } }
  /** Emit an event to subscribers (errors in one handler do not stop the others). */
  emit(event, data) { for (const fn of (this.handlers[event] || []).slice()) { try { fn(data); } catch (e) { console.error(e); } } }

  // ------------------------------------------------ camera

  /** Screen point (CSS px from the container's top-left) to world units. */
  screenToWorld(px, py) { const c = this.camera; return { x: c.x + (px - this.cssW / 2) / c.zoom, y: c.y + (py - this.cssH / 2) / c.zoom }; }
  /** World units to a screen point (CSS px). */
  worldToScreen(x, y) { const c = this.camera; return { px: (x - c.x) * c.zoom + this.cssW / 2, py: (y - c.y) * c.zoom + this.cssH / 2 }; }
  /** Visible world rectangle. */
  viewBounds() { const a = this.screenToWorld(0, 0), b = this.screenToWorld(this.cssW, this.cssH); return { x0: a.x, y0: a.y, x1: b.x, y1: b.y }; }
  /** Zoom that frames the whole state. */
  fitZoom() { const b = this._bbox, pad = 0.94; return Math.min(this.cssW / (b[2] - b[0]), this.cssH / (b[3] - b[1])) * pad; }
  /** Smallest zoom allowed (half the state-fitting zoom). */
  get minZoom() { return this.fitZoom() * 0.5; }
  /** Largest zoom allowed (CSS px per unit; about half a meter per pixel). */
  get maxZoom() { return 400; }

  _clampCamera(c) {
    const b = this._bbox, mx = (b[2] - b[0]) * 0.15, my = (b[3] - b[1]) * 0.15;
    c.zoom = Math.min(this.maxZoom, Math.max(this.minZoom, c.zoom));
    c.x = Math.min(b[2] + mx, Math.max(b[0] - mx, c.x));
    c.y = Math.min(b[3] + my, Math.max(b[1] - my, c.y));
    return c;
  }

  /** Jump the camera (stops any animation). */
  setCamera(x, y, zoom = this.camera.zoom) {
    this._stopAnim();
    this.camera = this._clampCamera({ x, y, zoom });
    this._cameraChanged();
  }

  /** Frame the whole state (animated when ms > 0). */
  fitState(ms = 0) {
    this._fitted = true;
    const b = this._bbox, x = (b[0] + b[2]) / 2, y = (b[1] + b[3]) / 2, z = this.fitZoom();
    if (ms > 0) return this.flyTo(x, y, z, ms);
    this.setCamera(x, y, z);
    return Promise.resolve();
  }

  /** Zoom by a factor about a screen point (default the center); animated over ms (default 0 = immediate). */
  zoomBy(factor, px = this.cssW / 2, py = this.cssH / 2, ms = 0) {
    const c = this.camera, w = this.screenToWorld(px, py);
    const z = Math.min(this.maxZoom, Math.max(this.minZoom, c.zoom * factor));
    const x = w.x - (px - this.cssW / 2) / z, y = w.y - (py - this.cssH / 2) / z;
    if (ms > 0) return this._tween({ x, y, zoom: z }, ms, { px, py, wx: w.x, wy: w.y });
    this.setCamera(x, y, z);
    return Promise.resolve();
  }

  /**
   * Smooth zoom-and-pan to (x, y) at zoom: the optimal path of van Wijk & Nuij (2003), zooming out to travel far.
   * @returns {Promise<void>} settles when the flight ends or is interrupted
   */
  flyTo(x, y, zoom = this.camera.zoom, ms) {
    this._stopAnim();
    const target = this._clampCamera({ x, y, zoom });
    const c0 = { ...this.camera }, size = Math.max(this.cssW, this.cssH);
    const w0 = size / c0.zoom, w1 = size / target.zoom, dx = target.x - c0.x, dy = target.y - c0.y, u1 = Math.hypot(dx, dy);
    const rho = 1.42, r2 = rho * rho;
    let S, at;
    if (u1 < 1e-6 * w0) {
      const k = Math.log(w1 / w0);
      S = Math.abs(k) / rho;
      at = s => ({ u: 0, w: w0 * Math.exp(Math.sign(k) * rho * s) });
    } else {
      const b0 = (w1 * w1 - w0 * w0 + r2 * r2 * u1 * u1) / (2 * w0 * r2 * u1);
      const b1 = (w1 * w1 - w0 * w0 - r2 * r2 * u1 * u1) / (2 * w1 * r2 * u1);
      const rA = Math.log(Math.sqrt(b0 * b0 + 1) - b0), rB = Math.log(Math.sqrt(b1 * b1 + 1) - b1);
      S = (rB - rA) / rho;
      at = s => ({ u: w0 / r2 * (Math.cosh(rA) * Math.tanh(rho * s + rA) - Math.sinh(rA)), w: w0 * Math.cosh(rA) / Math.cosh(rho * s + rA) });
    }
    if (!Number.isFinite(S) || S < 1e-9) { this.setCamera(target.x, target.y, target.zoom); return Promise.resolve(); }
    const dur = ms == null ? Math.min(2600, Math.max(350, S * 520)) : Math.max(0, ms);
    if (dur === 0) { this.setCamera(target.x, target.y, target.zoom); return Promise.resolve(); }
    return new Promise(resolve => {
      const t0 = performance.now();
      this._anim = {
        resolve,
        step: now => {
          const k = Math.min(1, (now - t0) / dur), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
          const p = at(e * S), f = u1 > 0 ? p.u / u1 : 0;
          this.camera = this._clampCamera({ x: c0.x + dx * f, y: c0.y + dy * f, zoom: size / p.w });
          if (k >= 1) this.camera = target;
          this._cameraChanged(false);
          return k < 1;
        },
      };
      this.requestRender();
    });
  }

  /**
   * Ease the camera to target over ms. With an anchor {px, py, wx, wy} the world point (wx, wy) stays under the
   * screen point (px, py) the whole way (zooming about the cursor); without one the center glides (panning).
   */
  _tween(target, ms, anchor = null) {
    this._stopAnim();
    const c0 = { ...this.camera }, t1 = this._clampCamera({ ...target });
    return new Promise(resolve => {
      const t0 = performance.now(), lz0 = Math.log(c0.zoom), lz1 = Math.log(t1.zoom);
      this._anim = {
        resolve,
        step: now => {
          const k = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - k, 3);
          const z = Math.exp(lz0 + (lz1 - lz0) * e);
          this.camera = this._clampCamera(anchor
            ? { x: anchor.wx - (anchor.px - this.cssW / 2) / z, y: anchor.wy - (anchor.py - this.cssH / 2) / z, zoom: z }
            : { x: c0.x + (t1.x - c0.x) * e, y: c0.y + (t1.y - c0.y) * e, zoom: z });
          if (k >= 1) this.camera = t1;
          this._cameraChanged(false);
          return k < 1;
        },
      };
      this.requestRender();
    });
  }

  _stopAnim() { const a = this._anim; this._anim = null; if (a && a.resolve) a.resolve(); }

  _cameraChanged(stop = true) {
    if (stop && this._anim && !this._anim.internal) this._stopAnim();
    this._labelsDirty = true;
    this.requestRender();
  }

  // ------------------------------------------------ theme

  /** Switch theme: sets data-theme on the container, re-reads its CSS custom properties, re-renders. */
  setTheme(theme) {
    this.theme = theme === 'light' ? 'light' : 'dark';
    this.container.dataset.theme = this.theme;
    this._readTheme();
    this._labelsDirty = true;
    this.requestRender();
    this.emit('theme', { theme: this.theme, palette: this.palette });
  }

  /** A CSS custom property of the container as [r, g, b] (0..1), or the fallback (a CSS color string or array). */
  cssColor(name, fallback) {
    const v = getComputedStyle(this.container).getPropertyValue(name);
    const c = parseColor(v);
    if (c) return c.slice(0, 3);
    if (Array.isArray(fallback)) return fallback.slice(0, 3);
    const f = parseColor(fallback);
    return f ? f.slice(0, 3) : [1, 0, 1];
  }

  _readTheme() {
    const base = THEME_BASE[this.theme];
    const st = getComputedStyle(this.container);
    const get = n => parseColor(st.getPropertyValue(n));
    const bg = (get('--bg') || parseColor(base.bg)).slice(0, 3), ink = (get('--ink') || parseColor(base.ink)).slice(0, 3);
    const accent = (get('--accent') || parseColor(base.accent)).slice(0, 3), sea = parseColor(base.sea).slice(0, 3);
    const dark = luminance(bg) < 0.45;
    const ocean = mixc(bg, sea, dark ? 0.16 : 0.22);
    const land = mixc(bg, ink, dark ? 0.075 : 0.015);
    const derived = {
      ocean, land,
      neighbor: mixc(ocean, land, 0.45),
      water: mixc(ocean, land, 0.12),
      coast: mixc(land, ink, dark ? 0.26 : 0.3),
      county: mixc(land, ink, dark ? 0.16 : 0.17),
      zip: mixc(land, ink, dark ? 0.1 : 0.1),
      border: mixc(mixc(ocean, land, 0.45), ink, 0.16),
      road: mixc(land, ink, dark ? 0.2 : 0.24),
      'road-us': mixc(land, ink, dark ? 0.3 : 0.34),
      interstate: mixc(land, accent, dark ? 0.62 : 0.7),
      label: mixc(ink, bg, 0.06),
      halo: mixc(land, bg, 0.3),
      accent,
      shade: dark ? [0.0, 0.01, 0.04] : [0.03, 0.06, 0.14],
    };
    const pal = {};
    for (const name of PAL_NAMES) pal[name] = (get('--map-' + name) || derived[name]).slice(0, 3);
    this.palette = pal;
    this.dark = dark;
    this._palArr = new Float32Array(64);
    PAL_NAMES.forEach((name, i) => { const c = pal[name]; this._palArr[4 * i] = c[0]; this._palArr[4 * i + 1] = c[1]; this._palArr[4 * i + 2] = c[2]; this._palArr[4 * i + 3] = 1; });
  }

  // ------------------------------------------------ layers

  /** Add a layer: {draw(frame), pick?(x, y, radiusUnits), contextRestored?(gl)}. Drawn after the base map, in order. */
  addLayer(layer) { if (!this.layers.includes(layer)) this.layers.push(layer); this.requestRender(); return layer; }
  /** Remove a layer. */
  removeLayer(layer) { const i = this.layers.indexOf(layer); if (i >= 0) this.layers.splice(i, 1); this.requestRender(); }
  /** The WebGL2 context (null in the Canvas 2D fallback). */
  getGL() { return this.gl; }
  /** Night darkening over the base map, under the layers (0 = none). */
  setShade(alpha) { const a = Math.max(0, Math.min(0.85, +alpha || 0)); if (Math.abs(a - this.shade) > 1e-4) { this.shade = a; this.requestRender(); } }

  /** The first layer hit at a screen point, topmost layer first. */
  pickAt(px, py, radiusPx = 6) {
    const w = this.screenToWorld(px, py), r = radiusPx / this.camera.zoom;
    for (let i = this.layers.length - 1; i >= 0; i--) {
      const l = this.layers[i];
      if (typeof l.pick !== 'function') continue;
      const hit = l.pick(w.x, w.y, r);
      if (hit) return hit;
    }
    return null;
  }

  // ------------------------------------------------ size

  /** Match the canvases to the container size and devicePixelRatio. */
  resize() {
    if (this._destroyed) return;
    const r = this.container.getBoundingClientRect();
    const cw = Math.max(1, Math.round(r.width)), ch = Math.max(1, Math.round(r.height));
    const dpr = Math.max(1, Math.min(this.maxDpr, (typeof devicePixelRatio === 'number' && devicePixelRatio) || 1));
    const changed = cw !== this.cssW || ch !== this.cssH || dpr !== this.dpr;
    // a map created in a hidden container framed the state for a 1-pixel view: frame it again at its first real size
    const hidden = cw <= 2 || ch <= 2, firstLayout = !hidden && !this._sized;
    if (!hidden) this._sized = true;
    const keep = { ...this.camera };
    this.cssW = cw; this.cssH = ch; this.dpr = dpr;
    this.W = Math.max(1, Math.round(cw * dpr)); this.H = Math.max(1, Math.round(ch * dpr));
    for (const c of [this.canvas, this.labelCanvas]) if (c.width !== this.W || c.height !== this.H) { c.width = this.W; c.height = this.H; }
    if (firstLayout && this._fitted) { const b = this._bbox; this.camera = this._clampCamera({ x: (b[0] + b[2]) / 2, y: (b[1] + b[3]) / 2, zoom: this.fitZoom() }); }
    else this.camera = this._clampCamera(keep);
    this._labelsDirty = true;
    if (changed) this.emit('resize', { width: cw, height: ch, dpr });
    this.render();
  }

  _watchDpr() {
    if (typeof matchMedia !== 'function') return;
    const watch = () => {
      if (this._destroyed) return;
      const mq = matchMedia(`(resolution: ${devicePixelRatio || 1}dppx)`);
      const fn = () => { this.resize(); watch(); };
      mq.addEventListener ? mq.addEventListener('change', fn, { once: true }) : mq.addListener(fn);
      this._dprMq = { mq, fn };
    };
    watch();
  }

  // ------------------------------------------------ rendering

  /** Draw on the next animation frame (coalesced). */
  requestRender() {
    if (this._raf || this._destroyed || this._lost) return;
    const wait = this._renderWait();
    if (wait > 0) {
      if (!this._gapTimer) this._gapTimer = setTimeout(() => { this._gapTimer = 0; this.requestRender(); }, wait);
      return;
    }
    this._raf = requestAnimationFrame(t => { this._raf = 0; this._frame(t); });
  }

  /**
   * How long a frame waits so the main thread stays free between frames: on software WebGL a frame can take a second
   * of the main thread, and a crowd streaming in asks for one with every chunk, which left key presses waiting
   * seconds. Only frames the layers ask for wait (idleGapMs, or as long as the last frame took when that is longer);
   * a camera move, an animation or a theme change draws on the next animation frame as always.
   */
  _renderWait() {
    if (!(this.idleGapMs > 0) || !this.software || this._anim || this._labelsDirty || !this._renderEnd) return 0;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    return Math.ceil(this._renderEnd + Math.max(this.idleGapMs, Math.min(2000, this._renderMs)) - now);
  }

  _frame(now) {
    if (this._anim) {
      const a = this._anim, more = a.step(now);
      if (!more && this._anim === a) { this._anim = null; a.resolve && a.resolve(); }
      else if (more) this.requestRender();
    }
    this.render();
    const c = this.camera, last = this._lastMove;
    if (!last || last.x !== c.x || last.y !== c.y || last.zoom !== c.zoom) { this._lastMove = { ...c }; this.emit('move', { x: c.x, y: c.y, zoom: c.zoom }); }
  }

  _queueHover(p) {
    this._hoverPending = p;
    if (this._hoverRaf || this._destroyed) return;
    this._hoverRaf = requestAnimationFrame(() => {
      this._hoverRaf = 0;
      const h = this._hoverPending;
      this._hoverPending = null;
      if (!h) return;
      const w = this.screenToWorld(h.px, h.py);
      this.emit('hover', { x: w.x, y: w.y, px: h.px, py: h.py });
    });
  }

  _frameInfo() {
    const c = this.camera;
    const view = new Float32Array([c.x, c.y, 2 * c.zoom / this.cssW, -2 * c.zoom / this.cssH]);
    return {
      map: this, gl: this.gl, ctx: this.ctx2d, width: this.W, height: this.H, cssWidth: this.cssW, cssHeight: this.cssH, dpr: this.dpr,
      camera: { ...c }, zoom: c.zoom, view, bounds: this.viewBounds(), theme: this.theme, palette: this.palette, dark: this.dark,
      time: typeof performance !== 'undefined' ? performance.now() : Date.now(),
    };
  }

  /** Draw everything now (base map, shade, layers, labels when the view changed). */
  render() {
    if (this._destroyed || this._lost) return;
    const frame = this._frameInfo();
    if (this.gl) this._drawGL(frame); else this._draw2D(frame);
    for (const l of this.layers) {
      try { l.draw(frame); } catch (e) { console.error('map layer draw failed', e); }
    }
    if (this._labelsDirty) { this._labelsDirty = false; this._drawLabels(); }
    const end = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this._renderMs = end - frame.time; this._renderEnd = end;
  }

  // ------------------------------------------------ WebGL base map

  _initGL() {
    const gl = this.gl, w = this.world;
    // On software WebGL the base map (fills and several hundred thousand line segments) costs most of a second a
    // frame, so it is drawn once per view into a texture and copied (_drawGL); a GPU draws it every frame.
    this.software = softwareGL(gl);
    this._base = null;
    this._copyP = this.software ? createProgram(gl, COPY_VS, COPY_FS) : null;
    this._fill = createProgram(gl, FILL_VS, COLOR_FS);
    this._line = createProgram(gl, LINE_VS, LINE_FS);
    this._shadeP = createProgram(gl, SHADE_VS, COLOR_FS);
    this._emptyVao = gl.createVertexArray();
    // fills: neighbors, state, water in one buffer
    const nb = [];
    for (const rings of Object.values(w.neighborRings())) for (const r of rings) nb.push(r);
    const outline = w.outlineRings(), water = w.waterRings().flat();
    // one buffer: per layer the verified triangles, the stencil fans of the rings that failed, their cover quad
    const parts = [], ranges = {};
    let o = 0;
    for (const [name, rings] of [['neighbor', nb], ['land', outline], ['water', water]]) {
      const f = this._fillGeom && this._fillGeom[name] ? this._fillGeom[name] : buildFill(rings);
      (this._fillGeom || (this._fillGeom = {}))[name] = f;
      ranges[name] = {};
      for (const k of ['tris', 'fans', 'cover']) { ranges[name][k] = [o / 2, f[k].length / 2]; parts.push(f[k]); o += f[k].length; }
    }
    const all = new Float32Array(o);
    o = 0;
    for (const p of parts) { all.set(p, o); o += p.length; }
    this._fills = { vao: gl.createVertexArray(), buf: gl.createBuffer(), ranges };
    gl.bindVertexArray(this._fills.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this._fills.buf);
    gl.bufferData(gl.ARRAY_BUFFER, all, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    gl.bindVertexArray(null);
    // lines
    const border = ringSegments(nb, 1, PAL.BORDER);
    const counties = [];
    for (let ci = 0; ci < w.counties.length; ci++) ringSegments(w.countyRings(ci), 0.9, PAL.COUNTY, counties);
    const coast = ringSegments(outline, 1.15, PAL.COAST);
    ringSegments(water, 0.8, PAL.COAST, coast);
    this._borderL = this._lineLayer(border);
    this._countyL = this._lineLayer(counties);
    this._coastL = this._lineLayer(coast);
    this._roadL = this._lineLayer(this._roadSegments());
    if (this._zipSegs) this._zipL = this._lineLayer(this._zipSegs.data, this._zipSegs.tiles);
  }

  _roadSegments() {
    // sorted so interstates draw over US routes over state routes
    const order = { SR: 0, US: 1, I: 2 }, rows = [];
    for (const rd of this.world.roads) {
      const color = rd.kind === 'I' ? PAL.ROAD_I : rd.kind === 'US' ? PAL.ROAD_US : PAL.ROAD;
      for (const line of rd.lines) for (let i = 1; i < line.length; i++) {
        const a = line[i - 1], b = line[i];
        if (a[0] === b[0] && a[1] === b[1]) continue;
        const aadt = ((+a[2] || 0) + (+b[2] || 0)) / 2;
        rows.push([order[rd.kind] ?? 0, a[0], a[1], b[0], b[1], 0.45 + 1.7 * Math.sqrt(Math.min(400, aadt) / 300) + (rd.kind === 'I' ? 0.3 : 0), color]);
      }
    }
    rows.sort((p, q) => p[0] - q[0]);
    const out = [];
    for (const r of rows) out.push(r[1], r[2], r[3], r[4], r[5], r[6]);
    return out;
  }

  _lineLayer(data, tiles = null) {
    const gl = this.gl, arr = data instanceof Float32Array ? data : Float32Array.from(data);
    const L = { vao: gl.createVertexArray(), buf: gl.createBuffer(), count: arr.length / 6, tiles };
    gl.bindVertexArray(L.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, L.buf);
    gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 24, 0);
    gl.vertexAttribDivisor(0, 1);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 24, 16);
    gl.vertexAttribDivisor(1, 1);
    gl.bindVertexArray(null);
    return L;
  }

  _drawLines(L, frame, scale, alpha) {
    if (!L || !L.count || alpha <= 0.003) return;
    const gl = this.gl, P = this._line;
    gl.uniform1f(P.u.u_scale, scale * frame.dpr);
    gl.uniform1f(P.u.u_alpha, alpha);
    gl.bindVertexArray(L.vao);
    if (!L.tiles) { gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, L.count); return; }
    // tiled layers (ZIP outlines): only the tiles in view, by moving the instance attribute pointers
    const b = frame.bounds;
    gl.bindBuffer(gl.ARRAY_BUFFER, L.buf);
    for (const t of L.tiles) {
      if (t.x1 < b.x0 || t.x0 > b.x1 || t.y1 < b.y0 || t.y0 > b.y1 || !t.count) continue;
      gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 24, t.start * 24);
      gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 24, t.start * 24 + 16);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, t.count);
    }
    gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 24, 0);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 24, 16);
  }

  /**
   * The offscreen target the base map is kept in on software WebGL: a texture the size of the canvas with a stencil
   * buffer (the even-odd fills use it), made again when the canvas changes size. Null when it cannot be made (the
   * map then draws straight to the canvas, as on a GPU).
   */
  _baseTarget() {
    const gl = this.gl, b = this._base;
    if (b && b.w === this.W && b.h === this.H) return b;
    if (b) { gl.deleteFramebuffer(b.fbo); gl.deleteTexture(b.tex); gl.deleteRenderbuffer(b.stencil); }
    this._base = null;
    try {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, this.W, this.H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindTexture(gl.TEXTURE_2D, null);
      const stencil = gl.createRenderbuffer();
      gl.bindRenderbuffer(gl.RENDERBUFFER, stencil);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH24_STENCIL8, this.W, this.H);
      gl.bindRenderbuffer(gl.RENDERBUFFER, null);
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, stencil);
      const complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      if (!complete) { gl.deleteFramebuffer(fbo); gl.deleteTexture(tex); gl.deleteRenderbuffer(stencil); this._copyP = null; return null; }
      this._base = { fbo, tex, stencil, w: this.W, h: this.H, key: null };
      return this._base;
    } catch { this._copyP = null; return null; }
  }

  /** What the base map depends on: the view, the canvas, the palette and whether the ZIP outlines are in. */
  _baseKey(frame) {
    const c = frame.camera;
    return `${this.W}x${this.H}|${c.x}|${c.y}|${c.zoom}|${this.theme}|${this._palArr.join(',')}|${this._zipL ? 1 : 0}`;
  }

  _drawGL(frame) {
    const gl = this.gl;
    // software WebGL: the base map from its cache (drawn again only when the view changed), then the shade
    const target = this.software && this._copyP ? this._baseTarget() : null;
    if (target) {
      const key = this._baseKey(frame);
      if (target.key !== key) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
        this._drawBase(frame);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        target.key = key;
      }
      gl.viewport(0, 0, this.W, this.H);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);
      gl.disable(gl.STENCIL_TEST);
      const P = this._copyP;
      gl.useProgram(P.program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, target.tex);
      gl.uniform1i(P.u.u_tex, 0);
      gl.bindVertexArray(this._emptyVao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindVertexArray(null);
      gl.bindTexture(gl.TEXTURE_2D, null);
    } else this._drawBase(frame);
    this._drawShade();
  }

  /** The base map (fills and lines) into the bound framebuffer. */
  _drawBase(frame) {
    const gl = this.gl, pal = this._palArr, z = frame.zoom;
    gl.viewport(0, 0, this.W, this.H);
    gl.clearColor(pal[0], pal[1], pal[2], 1);
    gl.clearStencil(0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    // fills
    const F = this._fill;
    gl.useProgram(F.program);
    gl.uniform4fv(F.u.u_view, frame.view);
    gl.bindVertexArray(this._fills.vao);
    for (const [name, idx] of [['neighbor', PAL.NEIGHBOR], ['land', PAL.LAND], ['water', PAL.WATER]]) {
      const r = this._fills.ranges[name];
      gl.uniform4f(F.u.u_color, pal[4 * idx], pal[4 * idx + 1], pal[4 * idx + 2], 1);
      if (r.tris[1]) gl.drawArrays(gl.TRIANGLES, r.tris[0], r.tris[1]);
      if (!r.fans[1]) continue;
      // even-odd fill of the rings ear clipping could not verify: parity in the stencil, then color where odd
      gl.enable(gl.STENCIL_TEST);
      gl.colorMask(false, false, false, false);
      gl.stencilFunc(gl.ALWAYS, 0, 0xff);
      gl.stencilOp(gl.KEEP, gl.KEEP, gl.INVERT);
      gl.drawArrays(gl.TRIANGLES, r.fans[0], r.fans[1]);
      gl.colorMask(true, true, true, true);
      gl.stencilFunc(gl.NOTEQUAL, 0, 0xff);
      gl.stencilOp(gl.ZERO, gl.ZERO, gl.ZERO);
      gl.drawArrays(gl.TRIANGLES, r.cover[0], r.cover[1]);
      gl.disable(gl.STENCIL_TEST);
    }
    // lines
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    const Lp = this._line;
    gl.useProgram(Lp.program);
    gl.uniform4fv(Lp.u.u_view, frame.view);
    gl.uniform2f(Lp.u.u_half, this.W / 2, this.H / 2);
    gl.uniform4fv(Lp.u.u_palette, pal);
    const lz = Math.log2(Math.max(1e-6, z / this.fitZoom()));
    const zipAlpha = Math.max(0, Math.min(1, (z - 0.55) / 1.1));
    if (zipAlpha > 0 && this._zipL) this._drawLines(this._zipL, frame, Math.min(1, 0.6 + 0.1 * lz), zipAlpha * 0.9);
    this._drawLines(this._borderL, frame, 1, 0.9);
    this._drawLines(this._countyL, frame, Math.min(1.5, 0.75 + 0.12 * Math.max(0, lz)), Math.min(1, 0.65 + 0.12 * Math.max(0, lz)));
    this._drawLines(this._coastL, frame, Math.min(1.6, 0.95 + 0.1 * Math.max(0, lz)), 1);
    this._drawLines(this._roadL, frame, Math.min(3.2, Math.max(0.55, 0.62 + 0.3 * lz)), 1);
    gl.bindVertexArray(null);
  }

  /** The night shade over the base map (it changes with the clock, so it is never part of the cached base). */
  _drawShade() {
    if (!(this.shade > 0)) return;
    const gl = this.gl, S = this._shadeP, c = this.palette.shade, a = this.shade;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(S.program);
    gl.uniform4f(S.u.u_color, c[0] * a, c[1] * a, c[2] * a, a);
    gl.bindVertexArray(this._emptyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }

  // ------------------------------------------------ ZIP outlines (built in idle time, drawn when zoomed in)

  _scheduleZipBuild() {
    const w = this.world, N = w.N, segs = [];
    let i = 0;
    const idle = typeof requestIdleCallback === 'function' ? fn => requestIdleCallback(fn, { timeout: 1500 }) : fn => setTimeout(() => fn({ timeRemaining: () => 8 }), 30);
    const step = deadline => {
      if (this._destroyed) return;
      const t0 = performance.now();
      while (i < N && (deadline.timeRemaining() > 2 || performance.now() - t0 < 4)) {
        ringSegments(w.zipRings(i), 0.8, PAL.ZIP, segs);
        i++;
        if (performance.now() - t0 > 12) break;
      }
      if (i < N) { idle(step); return; }
      this._zipSegs = tileSegments(segs);
      if (this.gl && !this._lost) this._zipL = this._lineLayer(this._zipSegs.data, this._zipSegs.tiles);
      this.requestRender();
    };
    idle(step);
  }

  // ------------------------------------------------ Canvas 2D fallback

  _init2D() {
    const w = this.world, path = rings => { const p = new Path2D(); for (const r of rings) { for (let i = 0; i < r.length; i += 2) i ? p.lineTo(r[i], r[i + 1]) : p.moveTo(r[i], r[i + 1]); p.closePath(); } return p; };
    const nb = [];
    for (const rings of Object.values(w.neighborRings())) nb.push(...rings);
    const counties = new Path2D();
    for (let ci = 0; ci < w.counties.length; ci++) counties.addPath(path(w.countyRings(ci)));
    const roads = { SR: new Path2D(), US: new Path2D(), I: new Path2D() };
    for (const rd of w.roads) for (const line of rd.lines) line.forEach((p, i) => i ? roads[rd.kind in roads ? rd.kind : 'SR'].lineTo(p[0], p[1]) : roads[rd.kind in roads ? rd.kind : 'SR'].moveTo(p[0], p[1]));
    this._paths = { neighbor: path(nb), land: path(w.outlineRings()), water: path(w.waterRings().flat()), counties, roads };
  }

  _draw2D(frame) {
    const g = this.ctx2d, P = this._paths, pal = this.palette, c = this.camera, k = c.zoom * this.dpr;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = css(pal.ocean); g.fillRect(0, 0, this.W, this.H);
    g.setTransform(k, 0, 0, k, (this.cssW / 2 - c.x * c.zoom) * this.dpr, (this.cssH / 2 - c.y * c.zoom) * this.dpr);
    g.fillStyle = css(pal.neighbor); g.fill(P.neighbor, 'evenodd');
    g.fillStyle = css(pal.land); g.fill(P.land, 'evenodd');
    g.fillStyle = css(pal.water); g.fill(P.water, 'evenodd');
    const lw = px => px * this.dpr / k;
    g.lineJoin = 'round';
    g.strokeStyle = css(pal.county); g.lineWidth = lw(0.9); g.stroke(P.counties);
    g.strokeStyle = css(pal.coast); g.lineWidth = lw(1.1); g.stroke(P.land);
    g.strokeStyle = css(pal.road); g.lineWidth = lw(1); g.stroke(P.roads.SR);
    g.strokeStyle = css(pal['road-us']); g.lineWidth = lw(1.3); g.stroke(P.roads.US);
    g.strokeStyle = css(pal.interstate); g.lineWidth = lw(1.8); g.stroke(P.roads.I);
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (this.shade > 0) { const s = pal.shade; g.fillStyle = `rgba(${Math.round(s[0] * 255)},${Math.round(s[1] * 255)},${Math.round(s[2] * 255)},${this.shade})`; g.fillRect(0, 0, this.W, this.H); }
  }

  // ------------------------------------------------ labels

  _drawLabels() {
    const g = this.lctx, dpr = this.dpr;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.W, this.H);
    if (!this.showLabels) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const z = this.camera.zoom, fz = this.fitZoom();
    const minPop = 260000 * Math.pow(fz / z, 2.1);
    const places = this._placeList();
    const placed = [], cell = 64, grid = new Map();
    const hits = (x0, y0, x1, y1) => {
      for (let cx = Math.floor(x0 / cell); cx <= Math.floor(x1 / cell); cx++) for (let cy = Math.floor(y0 / cell); cy <= Math.floor(y1 / cell); cy++) {
        const b = grid.get(cx * 4096 + cy);
        if (b) for (const r of b) if (r[0] < x1 && r[2] > x0 && r[1] < y1 && r[3] > y0) return true;
      }
      return false;
    };
    const add = r => {
      for (let cx = Math.floor(r[0] / cell); cx <= Math.floor(r[2] / cell); cx++) for (let cy = Math.floor(r[1] / cell); cy <= Math.floor(r[3] / cell); cy++) {
        const k = cx * 4096 + cy; let b = grid.get(k); if (!b) grid.set(k, b = []); b.push(r);
      }
      placed.push(r);
    };
    const ink = css(this.palette.label), halo = css(this.palette.halo);
    const maxLabels = Math.round(this.cssW * this.cssH / 6500);
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    let n = 0;
    for (const p of places) {
      if (n >= maxLabels) break;
      if (p.pop < minPop && !(p.seat && p.pop > minPop * 0.35)) continue;
      const s = this.worldToScreen(p.x, p.y);
      if (s.px < -40 || s.py < -20 || s.px > this.cssW + 40 || s.py > this.cssH + 20) continue;
      const big = p.pop >= 1e6, mid = p.pop >= 3e5, small = p.pop < 8e4;
      const size = big ? 15 : mid ? 13.5 : small ? 11.5 : 12.5, weight = big || mid ? 600 : small ? 400 : 500;
      g.font = `${weight} ${size}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
      const tw = g.measureText(p.name).width;
      const pad = 3, dot = 2.6;
      // right of the dot, else left, else above
      const cands = [[s.px + dot + 4, s.py, 'left'], [s.px - dot - 4 - tw, s.py, 'left'], [s.px - tw / 2, s.py - size, 'left']];
      let ok = null;
      for (const [x, y] of cands) {
        const r = [x - pad, y - size / 2 - pad, x + tw + pad, y + size / 2 + pad];
        if (r[0] < 2 || r[2] > this.cssW - 2 || r[1] < 2 || r[3] > this.cssH - 2) continue;
        if (!hits(r[0], r[1], r[2], r[3]) && !hits(s.px - dot - 2, s.py - dot - 2, s.px + dot + 2, s.py + dot + 2)) { ok = [x, y, r]; break; }
      }
      if (!ok) continue;
      add(ok[2]); add([s.px - dot - 1, s.py - dot - 1, s.px + dot + 1, s.py + dot + 1]);
      g.fillStyle = ink; g.strokeStyle = halo;
      g.beginPath(); g.arc(s.px, s.py, big ? 3.2 : dot, 0, Math.PI * 2);
      g.lineWidth = 2; g.stroke(); g.fill();
      g.lineWidth = 3.2; g.strokeText(p.name, ok[0], ok[1]);
      g.fillText(p.name, ok[0], ok[1]);
      n++;
    }
    this.labelCount = n;
  }

  /**
   * Places by population with label points on land: a Census internal point offshore (a city whose limits take in
   * open water or islands) moves to the population-weighted center of the ZIPs named after it.
   */
  _placeList() {
    if (this._places) return this._places;
    const w = this.world, z = w.z, outline = w.outlineRings(), byName = new Map();
    for (let i = 0; i < w.N; i++) {
      for (const nm of new Set([z.place[i], z.city[i]])) {
        if (!nm) continue;
        const k = String(nm).toLowerCase(), a = byName.get(k) || [0, 0, 0], wt = Math.max(1, z.pop[i] || 0);
        a[0] += z.tx[i] * wt; a[1] += z.ty[i] * wt; a[2] += wt;
        byName.set(k, a);
      }
    }
    this._places = w.places.map(p => {
      let x = p.x, y = p.y;
      if (!pointInRings(x, y, outline)) { const a = byName.get(String(p.name).toLowerCase()); if (a) { x = a[0] / a[2]; y = a[1] / a[2]; } }
      return { name: p.name, pop: p.pop, seat: p.seat, x, y };
    }).sort((a, b) => b.pop - a.pop);
    return this._places;
  }

  // ------------------------------------------------ input

  _bindInput() {
    const el = this.container, local = e => { const r = el.getBoundingClientRect(); return { px: e.clientX - r.left, py: e.clientY - r.top }; };
    const L = this._listeners = [];
    const on = (type, fn, opts) => { el.addEventListener(type, fn, opts); L.push([type, fn, opts]); };
    on('pointerdown', e => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      el.setPointerCapture && el.setPointerCapture(e.pointerId);
      const p = local(e);
      this._pointers.set(e.pointerId, p);
      this._stopAnim();
      if (this._pointers.size === 1) { this._drag = { start: p, last: p, moved: 0, t: performance.now() }; this._velocity = [{ ...p, t: performance.now() }]; }
      else { this._drag = null; this._pinch = this._pinchState(); }
    });
    on('pointermove', e => {
      const p = local(e);
      if (!this._pointers.has(e.pointerId)) { this._queueHover(p); return; }
      this._pointers.set(e.pointerId, p);
      if (this._pointers.size >= 2 && this._pinch) {
        const s = this._pinchState(), z0 = this.camera.zoom;
        const f = s.dist / Math.max(1, this._pinch.dist);
        const w = this.screenToWorld(this._pinch.mx, this._pinch.my);
        const z = Math.min(this.maxZoom, Math.max(this.minZoom, z0 * f));
        this.camera = this._clampCamera({ x: w.x - (s.mx - this.cssW / 2) / z, y: w.y - (s.my - this.cssH / 2) / z, zoom: z });
        this._pinch = s;
        this._cameraChanged();
        return;
      }
      const d = this._drag;
      if (!d) return;
      const dx = p.px - d.last.px, dy = p.py - d.last.py;
      d.moved += Math.abs(dx) + Math.abs(dy);
      d.last = p;
      const c = this.camera;
      this.camera = this._clampCamera({ x: c.x - dx / c.zoom, y: c.y - dy / c.zoom, zoom: c.zoom });
      const now = performance.now();
      this._velocity.push({ ...p, t: now });
      while (this._velocity.length > 2 && now - this._velocity[0].t > 90) this._velocity.shift();
      this._cameraChanged();
    });
    const up = e => {
      if (!this._pointers.has(e.pointerId)) return;
      this._pointers.delete(e.pointerId);
      if (this._pointers.size === 1) { const [p] = this._pointers.values(); this._drag = { start: p, last: p, moved: 99, t: performance.now() }; this._pinch = null; return; }
      if (this._pointers.size > 1) { this._pinch = this._pinchState(); return; }
      const d = this._drag;
      this._drag = null; this._pinch = null;
      if (!d) return;
      const p = local(e);
      if (d.moved < 6 && e.type === 'pointerup' && performance.now() - d.t < 700) {
        const w = this.screenToWorld(p.px, p.py);
        this.emit('click', { x: w.x, y: w.y, px: p.px, py: p.py, hit: this.pickAt(p.px, p.py) });
        return;
      }
      this._inertia();
    };
    on('pointerup', up);
    on('pointercancel', up);
    on('pointerleave', e => {
      if (!this._pointers.size) this._hoverPending = null;
      // 'hover' always carries a point; leaving the map is its own event
      if (e.pointerType !== 'touch') { const p = local(e); this.emit('leave', { px: p.px, py: p.py }); }
    });
    on('wheel', e => {
      e.preventDefault();
      this._stopAnim();
      const p = local(e);
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
      const k = e.ctrlKey ? 0.01 : 0.0019;
      this.zoomBy(Math.exp(-e.deltaY * unit * k), p.px, p.py);
    }, { passive: false });
    on('dblclick', e => { e.preventDefault(); const p = local(e); this.zoomBy(e.shiftKey ? 0.5 : 2, p.px, p.py, 260); });
    on('keydown', e => {
      if (e.target !== el || e.metaKey || e.ctrlKey || e.altKey) return;
      const step = 110;
      const pan = (dx, dy) => { const c = this.camera; return this._tween({ x: c.x + dx / c.zoom, y: c.y + dy / c.zoom, zoom: c.zoom }, 180); };
      let handled = true;
      switch (e.key) {
        case '+': case '=': this.zoomBy(1.6, this.cssW / 2, this.cssH / 2, 220); break;
        case '-': case '_': this.zoomBy(1 / 1.6, this.cssW / 2, this.cssH / 2, 220); break;
        case 'ArrowLeft': pan(-step, 0); break;
        case 'ArrowRight': pan(step, 0); break;
        case 'ArrowUp': pan(0, -step); break;
        case 'ArrowDown': pan(0, step); break;
        case '0': case 'Home': this.fitState(450); break;
        default: handled = false;
      }
      if (handled) e.preventDefault();
    });
  }

  _pinchState() {
    const ps = [...this._pointers.values()];
    const a = ps[0], b = ps[1] || ps[0];
    return { dist: Math.hypot(a.px - b.px, a.py - b.py), mx: (a.px + b.px) / 2, my: (a.py + b.py) / 2 };
  }

  _inertia() {
    const v = this._velocity;
    if (v.length < 2) return;
    const a = v[0], b = v[v.length - 1], dt = b.t - a.t;
    if (dt <= 0 || performance.now() - b.t > 60) return;
    let vx = (b.px - a.px) / dt, vy = (b.py - a.py) / dt;
    if (Math.hypot(vx, vy) < 0.25) return;
    let last = performance.now();
    this._anim = {
      internal: true,
      step: now => {
        const d = Math.min(64, now - last); last = now;
        const c = this.camera;
        this.camera = this._clampCamera({ x: c.x - vx * d / c.zoom, y: c.y - vy * d / c.zoom, zoom: c.zoom });
        const decay = Math.exp(-d / 260);
        vx *= decay; vy *= decay;
        this._labelsDirty = true;
        return Math.hypot(vx, vy) > 0.02;
      },
    };
    this.requestRender();
  }

  // ------------------------------------------------ misc

  _stateBBox() {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const r of this.world.outlineRings()) for (let i = 0; i < r.length; i += 2) {
      if (r[i] < x0) x0 = r[i]; if (r[i] > x1) x1 = r[i];
      if (r[i + 1] < y0) y0 = r[i + 1]; if (r[i + 1] > y1) y1 = r[i + 1];
    }
    return Number.isFinite(x0) ? [x0, y0, x1, y1] : [0, 0, this.world.proj.W, this.world.proj.H];
  }

  /** Remove the canvases and listeners and free GPU resources. */
  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    if (this._raf) cancelAnimationFrame(this._raf);
    if (this._hoverRaf) cancelAnimationFrame(this._hoverRaf);
    if (this._gapTimer) { clearTimeout(this._gapTimer); this._gapTimer = 0; }
    this._stopAnim();
    if (this._ro) this._ro.disconnect();
    if (this._onWinResize) window.removeEventListener('resize', this._onWinResize);
    if (this._dprMq) { const { mq, fn } = this._dprMq; mq.removeEventListener ? mq.removeEventListener('change', fn) : mq.removeListener(fn); }
    for (const [type, fn, opts] of this._listeners || []) this.container.removeEventListener(type, fn, opts);
    this.canvas.removeEventListener('webglcontextlost', this._onLost);
    this.canvas.removeEventListener('webglcontextrestored', this._onRestored);
    this.layers.length = 0;
    this.handlers = {};
    if (this.gl) { const ext = this.gl.getExtension('WEBGL_lose_context'); if (ext) ext.loseContext(); }
    this.canvas.remove(); this.labelCanvas.remove();
  }
}

/** Group line-instance records into square tiles so a zoomed-in view draws only nearby ZIP outlines. */
function tileSegments(segs) {
  const n = segs.length / 6, buckets = new Map();
  for (let k = 0; k < n; k++) {
    const mx = (segs[6 * k] + segs[6 * k + 2]) / 2, my = (segs[6 * k + 1] + segs[6 * k + 3]) / 2;
    const key = Math.floor(mx / ZIP_TILE) * 4096 + Math.floor(my / ZIP_TILE);
    let b = buckets.get(key); if (!b) buckets.set(key, b = []); b.push(k);
  }
  const data = new Float32Array(segs.length), tiles = [];
  let o = 0;
  for (const ks of buckets.values()) {
    const t = { start: o, count: ks.length, x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    for (const k of ks) {
      for (let j = 0; j < 6; j++) data[6 * o + j] = segs[6 * k + j];
      t.x0 = Math.min(t.x0, segs[6 * k], segs[6 * k + 2]); t.x1 = Math.max(t.x1, segs[6 * k], segs[6 * k + 2]);
      t.y0 = Math.min(t.y0, segs[6 * k + 1], segs[6 * k + 3]); t.y1 = Math.max(t.y1, segs[6 * k + 1], segs[6 * k + 3]);
      o++;
    }
    tiles.push(t);
  }
  return { data, tiles };
}
