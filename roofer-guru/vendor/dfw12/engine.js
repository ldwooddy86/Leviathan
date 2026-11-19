<script id="scout-engine">
/* ==== rooftop scout: Scout Engine ==== */
/* A real-time 3D engine written for this page, straight onto WebGL2, with no library under it. It is built the way the
   large engines are (Unreal Engine 5, Unity), scaled to what a browser tab carries:
     - an entity and component scene with a transform hierarchy, scripts with a life cycle, and JSON save and load;
     - a deferred, physically based renderer: G-buffer, cascaded sun shadows, a physical sky that lights the scene,
       clustered point and spot lights, screen-space global illumination with ambient occlusion, screen-space
       reflections, temporal anti-aliasing with upscaling, bloom, eye adaptation, filmic tone mapping and grading;
     - geometry that scales: instancing, automatic levels of detail, cluster culling against the view and the depth
       of the last frame;
     - rigid body physics (boxes, spheres, capsules, extruded footprints), a character that walks and collides, rays;
     - particles, a timeline for camera moves, glTF import and export, positional audio;
     - an editor laid over the view: outliner, details, world settings, transform gizmos, buffer views, a profiler.
   The engine is window.__SCOUT_ENGINE__ (SE below); the neighborhood it draws for Rooftop Scout is built by
   window.__SCOUT_E3D__(host, env) at the end of this script. Nothing here reaches the network: the world asks the
   module for its buildings, streets and imagery, as the three.js view does. */
(function () {
  'use strict';
  const SE = { version: '1.0.0', name: 'Scout Engine' };

  /* ---------- small tools ---------- */
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v), lerp = (a, b, t) => a + (b - a) * t, saturate = v => clamp(v, 0, 1);
  const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const RAD = Math.PI / 180, DEG = 180 / Math.PI, TAU = Math.PI * 2;
  const hash01 = s => { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 100003) / 100003; };
  const rng = seed => { let a = (seed >>> 0) || 1; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const halton = (i, b) => { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; };
  const srgbToLin = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)), linToSrgb = c => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
  /* a colour as linear RGB: '#rrggbb', '#rgb', [r, g, b] (already linear) or a number 0xrrggbb */
  function color(v, out) {
    out = out || [0, 0, 0];
    if (Array.isArray(v) || ArrayBuffer.isView(v)) { out[0] = v[0]; out[1] = v[1]; out[2] = v[2]; return out; }
    let n = 0;
    if (typeof v === 'number') n = v;
    else { let s = String(v || '#000').trim().replace('#', ''); if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2]; n = parseInt(s.slice(0, 6), 16) || 0; }
    out[0] = srgbToLin(((n >> 16) & 255) / 255); out[1] = srgbToLin(((n >> 8) & 255) / 255); out[2] = srgbToLin((n & 255) / 255); return out;
  }
  const toHex = c => '#' + [0, 1, 2].map(i => Math.round(clamp(linToSrgb(c[i]), 0, 1) * 255).toString(16).padStart(2, '0')).join('');
  let uidN = 1; const uid = () => uidN++;

  class Emitter {
    constructor() { this._ev = new Map(); }
    on(n, f) { let l = this._ev.get(n); if (!l) this._ev.set(n, l = []); l.push(f); return () => this.off(n, f); }
    off(n, f) { const l = this._ev.get(n); if (l) { const i = l.indexOf(f); if (i >= 0) l.splice(i, 1); } }
    emit(n, a, b, c) { const l = this._ev.get(n); if (l) for (const f of l.slice()) { try { f(a, b, c); } catch (e) { console.error('[Scout Engine] ' + n + ' handler', e); } } }
  }

  /* ---------- vectors: plain arrays or Float32Arrays, every function writes into its first argument ---------- */
  const V3 = {
    create: (x, y, z) => new Float32Array([x || 0, y || 0, z || 0]),
    set: (o, x, y, z) => { o[0] = x; o[1] = y; o[2] = z; return o; },
    copy: (o, a) => { o[0] = a[0]; o[1] = a[1]; o[2] = a[2]; return o; },
    add: (o, a, b) => { o[0] = a[0] + b[0]; o[1] = a[1] + b[1]; o[2] = a[2] + b[2]; return o; },
    sub: (o, a, b) => { o[0] = a[0] - b[0]; o[1] = a[1] - b[1]; o[2] = a[2] - b[2]; return o; },
    scale: (o, a, s) => { o[0] = a[0] * s; o[1] = a[1] * s; o[2] = a[2] * s; return o; },
    addScaled: (o, a, b, s) => { o[0] = a[0] + b[0] * s; o[1] = a[1] + b[1] * s; o[2] = a[2] + b[2] * s; return o; },
    mul: (o, a, b) => { o[0] = a[0] * b[0]; o[1] = a[1] * b[1]; o[2] = a[2] * b[2]; return o; },
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    cross: (o, a, b) => { const x = a[1] * b[2] - a[2] * b[1], y = a[2] * b[0] - a[0] * b[2], z = a[0] * b[1] - a[1] * b[0]; o[0] = x; o[1] = y; o[2] = z; return o; },
    len: a => Math.hypot(a[0], a[1], a[2]), len2: a => a[0] * a[0] + a[1] * a[1] + a[2] * a[2],
    dist: (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]),
    normalize: (o, a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; o[0] = a[0] / l; o[1] = a[1] / l; o[2] = a[2] / l; return o; },
    lerp: (o, a, b, t) => { o[0] = a[0] + (b[0] - a[0]) * t; o[1] = a[1] + (b[1] - a[1]) * t; o[2] = a[2] + (b[2] - a[2]) * t; return o; },
    /* a point through a 4x4 (with the perspective divide) and a direction through its upper 3x3 */
    transform: (o, a, m) => { const x = a[0], y = a[1], z = a[2], w = m[3] * x + m[7] * y + m[11] * z + m[15] || 1; o[0] = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w; o[1] = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w; o[2] = (m[2] * x + m[6] * y + m[10] * z + m[14]) / w; return o; },
    transformDir: (o, a, m) => { const x = a[0], y = a[1], z = a[2]; o[0] = m[0] * x + m[4] * y + m[8] * z; o[1] = m[1] * x + m[5] * y + m[9] * z; o[2] = m[2] * x + m[6] * y + m[10] * z; return o; },
  };

  /* ---------- quaternions [x, y, z, w] ---------- */
  const Q = {
    create: () => new Float32Array([0, 0, 0, 1]),
    identity: o => { o[0] = 0; o[1] = 0; o[2] = 0; o[3] = 1; return o; },
    copy: (o, a) => { o[0] = a[0]; o[1] = a[1]; o[2] = a[2]; o[3] = a[3]; return o; },
    fromAxisAngle: (o, ax, ang) => { const s = Math.sin(ang / 2); o[0] = ax[0] * s; o[1] = ax[1] * s; o[2] = ax[2] * s; o[3] = Math.cos(ang / 2); return o; },
    /* yaw about +Y, then pitch about +X, then roll about +Z, in radians */
    fromEuler: (o, pitch, yaw, roll) => { const cx = Math.cos(pitch / 2), sx = Math.sin(pitch / 2), cy = Math.cos(yaw / 2), sy = Math.sin(yaw / 2), cz = Math.cos((roll || 0) / 2), sz = Math.sin((roll || 0) / 2);
      o[0] = sx * cy * cz + cx * sy * sz; o[1] = cx * sy * cz - sx * cy * sz; o[2] = cx * cy * sz - sx * sy * cz; o[3] = cx * cy * cz + sx * sy * sz; return o; },
    toEuler: (o, q) => { const x = q[0], y = q[1], z = q[2], w = q[3], m11 = 1 - 2 * (y * y + z * z), m12 = 2 * (x * y - z * w), m13 = 2 * (x * z + y * w), m22 = 1 - 2 * (x * x + z * z), m23 = 2 * (y * z - x * w), m32 = 2 * (y * z + x * w), m33 = 1 - 2 * (x * x + y * y);
      o[0] = Math.asin(clamp(-m23, -1, 1)); if (Math.abs(m23) < 0.9999999) { o[1] = Math.atan2(m13, m33); o[2] = Math.atan2(2 * (x * y + z * w), m22); } else { o[1] = Math.atan2(-2 * (x * z - y * w), m11); o[2] = 0; } void m12; void m32; return o; },
    mul: (o, a, b) => { const ax = a[0], ay = a[1], az = a[2], aw = a[3], bx = b[0], by = b[1], bz = b[2], bw = b[3]; o[0] = aw * bx + ax * bw + ay * bz - az * by; o[1] = aw * by - ax * bz + ay * bw + az * bx; o[2] = aw * bz + ax * by - ay * bx + az * bw; o[3] = aw * bw - ax * bx - ay * by - az * bz; return o; },
    conj: (o, a) => { o[0] = -a[0]; o[1] = -a[1]; o[2] = -a[2]; o[3] = a[3]; return o; },
    normalize: (o, a) => { const l = Math.hypot(a[0], a[1], a[2], a[3]) || 1; o[0] = a[0] / l; o[1] = a[1] / l; o[2] = a[2] / l; o[3] = a[3] / l; return o; },
    rotate: (o, q, v) => { const x = v[0], y = v[1], z = v[2], qx = q[0], qy = q[1], qz = q[2], qw = q[3], ix = qw * x + qy * z - qz * y, iy = qw * y + qz * x - qx * z, iz = qw * z + qx * y - qy * x, iw = -qx * x - qy * y - qz * z;
      o[0] = ix * qw + iw * -qx + iy * -qz - iz * -qy; o[1] = iy * qw + iw * -qy + iz * -qx - ix * -qz; o[2] = iz * qw + iw * -qz + ix * -qy - iy * -qx; return o; },
    slerp: (o, a, b, t) => { let bx = b[0], by = b[1], bz = b[2], bw = b[3], c = a[0] * bx + a[1] * by + a[2] * bz + a[3] * bw; if (c < 0) { c = -c; bx = -bx; by = -by; bz = -bz; bw = -bw; }
      let s0, s1; if (1 - c > 1e-6) { const om = Math.acos(c), sn = Math.sin(om); s0 = Math.sin((1 - t) * om) / sn; s1 = Math.sin(t * om) / sn; } else { s0 = 1 - t; s1 = t; }
      o[0] = s0 * a[0] + s1 * bx; o[1] = s0 * a[1] + s1 * by; o[2] = s0 * a[2] + s1 * bz; o[3] = s0 * a[3] + s1 * bw; return o; },
    /* the rotation whose -Z looks along dir (up near +Y) */
    lookRotation: (o, dir, up) => { const m = M4.create(); M4.lookAt(m, [0, 0, 0], dir, up || [0, 1, 0]); M4.invert(m, m); return Q.fromMat4(o, m); },
    fromMat4: (o, m) => { const m00 = m[0], m11 = m[5], m22 = m[10], tr = m00 + m11 + m22; let s;
      if (tr > 0) { s = Math.sqrt(tr + 1) * 2; o[3] = s / 4; o[0] = (m[6] - m[9]) / s; o[1] = (m[8] - m[2]) / s; o[2] = (m[1] - m[4]) / s; }
      else if (m00 > m11 && m00 > m22) { s = Math.sqrt(1 + m00 - m11 - m22) * 2; o[3] = (m[6] - m[9]) / s; o[0] = s / 4; o[1] = (m[1] + m[4]) / s; o[2] = (m[8] + m[2]) / s; }
      else if (m11 > m22) { s = Math.sqrt(1 + m11 - m00 - m22) * 2; o[3] = (m[8] - m[2]) / s; o[0] = (m[1] + m[4]) / s; o[1] = s / 4; o[2] = (m[6] + m[9]) / s; }
      else { s = Math.sqrt(1 + m22 - m00 - m11) * 2; o[3] = (m[1] - m[4]) / s; o[0] = (m[8] + m[2]) / s; o[1] = (m[6] + m[9]) / s; o[2] = s / 4; }
      return Q.normalize(o, o); },
  };

  /* ---------- 4x4 matrices, column major as WebGL takes them ---------- */
  const M4 = {
    create: () => { const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; },
    identity: o => { o.fill(0); o[0] = o[5] = o[10] = o[15] = 1; return o; },
    copy: (o, a) => { o.set(a); return o; },
    mul: (o, a, b) => {
      const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3], a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7], a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11], a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
      for (let i = 0; i < 4; i++) { const b0 = b[i * 4], b1 = b[i * 4 + 1], b2 = b[i * 4 + 2], b3 = b[i * 4 + 3];
        o[i * 4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30; o[i * 4 + 1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31; o[i * 4 + 2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32; o[i * 4 + 3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33; }
      return o;
    },
    invert: (o, a) => {
      const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3], a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7], a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11], a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
      const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12, b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
      let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06; if (!det) return M4.identity(o); det = 1 / det;
      o[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det; o[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det; o[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det; o[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
      o[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det; o[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det; o[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det; o[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
      o[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det; o[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det; o[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det; o[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
      o[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det; o[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det; o[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det; o[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
      return o;
    },
    perspective: (o, fovy, aspect, near, far) => { const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far); o.fill(0); o[0] = f / aspect; o[5] = f; o[10] = (far + near) * nf; o[11] = -1; o[14] = 2 * far * near * nf; return o; },
    ortho: (o, l, r, b, t, n, f) => { const lr = 1 / (l - r), bt = 1 / (b - t), nf = 1 / (n - f); o.fill(0); o[0] = -2 * lr; o[5] = -2 * bt; o[10] = 2 * nf; o[12] = (l + r) * lr; o[13] = (t + b) * bt; o[14] = (f + n) * nf; o[15] = 1; return o; },
    /* the view matrix of an eye at eye looking along dir */
    lookAt: (o, eye, dir, up) => {
      let zx = -dir[0], zy = -dir[1], zz = -dir[2], l = Math.hypot(zx, zy, zz) || 1; zx /= l; zy /= l; zz /= l;
      let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx; l = Math.hypot(xx, xy, xz);
      if (l < 1e-6) { xx = 1; xy = 0; xz = 0; l = 1; } xx /= l; xy /= l; xz /= l;
      const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
      o[0] = xx; o[1] = yx; o[2] = zx; o[3] = 0; o[4] = xy; o[5] = yy; o[6] = zy; o[7] = 0; o[8] = xz; o[9] = yz; o[10] = zz; o[11] = 0;
      o[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]); o[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]); o[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]); o[15] = 1; return o;
    },
    compose: (o, p, q, s) => { const x = q[0], y = q[1], z = q[2], w = q[3], x2 = x + x, y2 = y + y, z2 = z + z, xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2, wx = w * x2, wy = w * y2, wz = w * z2, sx = s[0], sy = s[1], sz = s[2];
      o[0] = (1 - (yy + zz)) * sx; o[1] = (xy + wz) * sx; o[2] = (xz - wy) * sx; o[3] = 0; o[4] = (xy - wz) * sy; o[5] = (1 - (xx + zz)) * sy; o[6] = (yz + wx) * sy; o[7] = 0;
      o[8] = (xz + wy) * sz; o[9] = (yz - wx) * sz; o[10] = (1 - (xx + yy)) * sz; o[11] = 0; o[12] = p[0]; o[13] = p[1]; o[14] = p[2]; o[15] = 1; return o; },
    decompose: (m, p, q, s) => { p[0] = m[12]; p[1] = m[13]; p[2] = m[14]; const sx = Math.hypot(m[0], m[1], m[2]) || 1, sy = Math.hypot(m[4], m[5], m[6]) || 1, sz = Math.hypot(m[8], m[9], m[10]) || 1; s[0] = sx; s[1] = sy; s[2] = sz;
      const r = M4._t; r.set(m); r[0] /= sx; r[1] /= sx; r[2] /= sx; r[4] /= sy; r[5] /= sy; r[6] /= sy; r[8] /= sz; r[9] /= sz; r[10] /= sz; Q.fromMat4(q, r); },
    translation: (o, x, y, z) => { M4.identity(o); o[12] = x; o[13] = y; o[14] = z; return o; },
    maxScale: m => Math.max(Math.hypot(m[0], m[1], m[2]), Math.hypot(m[4], m[5], m[6]), Math.hypot(m[8], m[9], m[10])),
    _t: new Float32Array(16),
  };

  /* ---------- the view frustum: six planes from a view-projection matrix, tested against spheres and boxes ---------- */
  class Frustum {
    constructor() { this.p = new Float32Array(24); }
    set(m) {
      const p = this.p, row = (i, a, b, c, d) => { const l = Math.hypot(a, b, c) || 1; p[i * 4] = a / l; p[i * 4 + 1] = b / l; p[i * 4 + 2] = c / l; p[i * 4 + 3] = d / l; };
      row(0, m[3] + m[0], m[7] + m[4], m[11] + m[8], m[15] + m[12]); row(1, m[3] - m[0], m[7] - m[4], m[11] - m[8], m[15] - m[12]);
      row(2, m[3] + m[1], m[7] + m[5], m[11] + m[9], m[15] + m[13]); row(3, m[3] - m[1], m[7] - m[5], m[11] - m[9], m[15] - m[13]);
      row(4, m[3] + m[2], m[7] + m[6], m[11] + m[10], m[15] + m[14]); row(5, m[3] - m[2], m[7] - m[6], m[11] - m[10], m[15] - m[14]); return this;
    }
    sphere(x, y, z, r) { const p = this.p; for (let i = 0; i < 24; i += 4) if (p[i] * x + p[i + 1] * y + p[i + 2] * z + p[i + 3] < -r) return false; return true; }
    box(mn, mx) { const p = this.p; for (let i = 0; i < 24; i += 4) { const a = p[i], b = p[i + 1], c = p[i + 2]; if (a * (a > 0 ? mx[0] : mn[0]) + b * (b > 0 ? mx[1] : mn[1]) + c * (c > 0 ? mx[2] : mn[2]) + p[i + 3] < 0) return false; } return true; }
  }

  /* ---------- polygons on the ground plane: [x, z] rings ---------- */
  const Poly = {
    area(P) { let s = 0; for (let i = 0, j = P.length - 1; i < P.length; j = i++) s += P[j][0] * P[i][1] - P[i][0] * P[j][1]; return s / 2; },
    contains(P, x, z) { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j]; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; },
    centroid(P) { let x = 0, z = 0; for (const p of P) { x += p[0]; z += p[1]; } return [x / P.length, z / P.length]; },
    bounds(P) { let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity; for (const p of P) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < z0) z0 = p[1]; if (p[1] > z1) z1 = p[1]; } return [x0, z0, x1, z1]; },
    /* ear clipping of a simple ring: returns index triples into P, wound the way P is */
    triangulate(P) {
      const n = P.length, out = []; if (n < 3) return out;
      const idx = []; const ccw = Poly.area(P) > 0; for (let i = 0; i < n; i++) idx.push(ccw ? i : n - 1 - i);
      const cr = (a, b, c) => (P[b][0] - P[a][0]) * (P[c][1] - P[a][1]) - (P[b][1] - P[a][1]) * (P[c][0] - P[a][0]);
      const inside = (a, b, c, p) => { const d1 = cr(a, b, p), d2 = cr(b, c, p), d3 = cr(c, a, p); return d1 >= 0 && d2 >= 0 && d3 >= 0; };
      let guard = 0;
      while (idx.length > 3 && guard++ < 20000) {
        let cut = false;
        for (let i = 0; i < idx.length; i++) {
          const a = idx[(i + idx.length - 1) % idx.length], b = idx[i], c = idx[(i + 1) % idx.length];
          if (cr(a, b, c) <= 1e-12) continue;
          let ok = true; for (let k = 0; k < idx.length; k++) { const p = idx[k]; if (p === a || p === b || p === c) continue; if (inside(a, b, c, p)) { ok = false; break; } }
          if (!ok) continue; out.push(ccw ? [a, b, c] : [c, b, a]); idx.splice(i, 1); cut = true; break;
        }
        if (!cut) { /* a degenerate ring: drop the flattest corner and carry on */ let bi = 0, bv = Infinity; for (let i = 0; i < idx.length; i++) { const v = Math.abs(cr(idx[(i + idx.length - 1) % idx.length], idx[i], idx[(i + 1) % idx.length])); if (v < bv) { bv = v; bi = i; } } idx.splice(bi, 1); }
      }
      if (idx.length === 3) out.push(ccw ? [idx[0], idx[1], idx[2]] : [idx[2], idx[1], idx[0]]);
      return out;
    },
    /* a ring moved inward (d > 0) or outward by d, mitred at the corners; the ring is counter clockwise for area > 0 */
    offset(P, d) {
      const n = P.length, out = [], sgn = Poly.area(P) > 0 ? 1 : -1;
      for (let i = 0; i < n; i++) {
        const p0 = P[(i - 1 + n) % n], p1 = P[i], p2 = P[(i + 1) % n]; let ax = p1[0] - p0[0], az = p1[1] - p0[1], la = Math.hypot(ax, az) || 1, bx = p2[0] - p1[0], bz = p2[1] - p1[1], lb = Math.hypot(bx, bz) || 1; ax /= la; az /= la; bx /= lb; bz /= lb;
        const n1x = -az * sgn, n1z = ax * sgn, n2x = -bz * sgn, n2z = bx * sgn; let mx = n1x + n2x, mz = n1z + n2z; const ml = Math.hypot(mx, mz); if (ml < 1e-6) { mx = n1x; mz = n1z; } else { mx /= ml; mz /= ml; }
        const k = d / Math.max(0.35, mx * n1x + mz * n1z); out.push([p1[0] + mx * k, p1[1] + mz * k]);
      }
      return out;
    },
    /* a convex polygon cut by the half plane a*x + b*z <= c */
    clip(P, a, b, c) {
      const out = []; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length], dp = a * p[0] + b * p[1] - c, dq = a * q[0] + b * q[1] - c;
        if (dp <= 0) out.push(p); if ((dp < 0 && dq > 0) || (dp > 0 && dq < 0)) { const t = dp / (dp - dq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); } }
      return out;
    },
  };

  Object.assign(SE, { clamp, lerp, saturate, smoothstep, RAD, DEG, TAU, hash01, rng, halton, srgbToLin, linToSrgb, color, toHex, uid, Emitter, V3, Q, M4, Frustum, Poly });

  /* ==== the device: WebGL2 wrapped once (textures, targets, programs with includes and variants, cached state) ==== */
  const FORMATS = {
    rgba8: ['RGBA8', 'RGBA', 'UNSIGNED_BYTE'], srgb8a8: ['SRGB8_ALPHA8', 'RGBA', 'UNSIGNED_BYTE'], rgb10a2: ['RGB10_A2', 'RGBA', 'UNSIGNED_INT_2_10_10_10_REV'],
    r8: ['R8', 'RED', 'UNSIGNED_BYTE'], rg8: ['RG8', 'RG', 'UNSIGNED_BYTE'],
    rgba16f: ['RGBA16F', 'RGBA', 'HALF_FLOAT'], rg16f: ['RG16F', 'RG', 'HALF_FLOAT'], r16f: ['R16F', 'RED', 'HALF_FLOAT'],
    rgba32f: ['RGBA32F', 'RGBA', 'FLOAT'], r32f: ['R32F', 'RED', 'FLOAT'], rg32f: ['RG32F', 'RG', 'FLOAT'],
    depth24: ['DEPTH_COMPONENT24', 'DEPTH_COMPONENT', 'UNSIGNED_INT'], depth32f: ['DEPTH_COMPONENT32F', 'DEPTH_COMPONENT', 'FLOAT'],
  };
  const CHUNKS = {};   /* GLSL shared between shaders: #include <name> */
  SE.chunks = CHUNKS;

  class Texture {
    constructor(dev, o) {
      const gl = dev.gl; this.dev = dev; this.id = uid(); this.cube = !!o.cube; this.layers = o.layers || 0; this.target = this.cube ? gl.TEXTURE_CUBE_MAP : this.layers ? gl.TEXTURE_2D_ARRAY : gl.TEXTURE_2D;
      this.w = o.w || 1; this.h = o.h || this.w; this.format = o.format || 'rgba8'; this.mips = !!o.mips; this.levels = o.levels || (this.mips ? Math.floor(Math.log2(Math.max(this.w, this.h))) + 1 : 1);
      this.tex = gl.createTexture(); this.name = o.name || '';
      const F = FORMATS[this.format]; this._F = F; gl.bindTexture(this.target, this.tex);
      if (this.layers) gl.texStorage3D(this.target, this.levels, gl[F[0]], this.w, this.h, this.layers); else if (o.storage !== false) gl.texStorage2D(this.target, this.levels, gl[F[0]], this.w, this.h);
      this.setSampler(o);
      if (o.data) this.upload(o.data);
      dev.stats.textures++;
    }
    setSampler(o) {
      const gl = this.dev.gl, t = this.target; gl.bindTexture(t, this.tex);
      const depth = this.format.startsWith('depth'), lin = o.filter ? o.filter === 'linear' : !depth, wrap = o.wrap === 'repeat' ? gl.REPEAT : o.wrap === 'mirror' ? gl.MIRRORED_REPEAT : gl.CLAMP_TO_EDGE;
      gl.texParameteri(t, gl.TEXTURE_MAG_FILTER, lin ? gl.LINEAR : gl.NEAREST);
      gl.texParameteri(t, gl.TEXTURE_MIN_FILTER, this.levels > 1 ? (lin ? gl.LINEAR_MIPMAP_LINEAR : gl.NEAREST_MIPMAP_NEAREST) : (lin ? gl.LINEAR : gl.NEAREST));
      const wr = v => (v === 'repeat' ? gl.REPEAT : v === 'mirror' ? gl.MIRRORED_REPEAT : v === 'clamp' ? gl.CLAMP_TO_EDGE : wrap);
      gl.texParameteri(t, gl.TEXTURE_WRAP_S, wr(o.wrapS)); gl.texParameteri(t, gl.TEXTURE_WRAP_T, wr(o.wrapT));
      if (o.compare) { gl.texParameteri(t, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE); gl.texParameteri(t, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL); }
      if (o.aniso && this.dev.caps.aniso) gl.texParameterf(t, this.dev.caps.anisoExt.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(o.aniso, this.dev.caps.maxAniso));
    }
    /* typed array data for level 0 (a face index for cubes) */
    upload(data, face, level) { const gl = this.dev.gl, F = this._F; gl.bindTexture(this.target, this.tex); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      const lv = level || 0, w = Math.max(1, this.w >> lv), h = Math.max(1, this.h >> lv);
      gl.texSubImage2D(this.cube ? gl.TEXTURE_CUBE_MAP_POSITIVE_X + (face || 0) : gl.TEXTURE_2D, lv, 0, 0, w, h, gl[F[1]], gl[F[2]], data); return this; }
    /* an image, canvas, bitmap or video into level 0 (sizes must match the storage) */
    image(src, flipY) { const gl = this.dev.gl, F = this._F; gl.bindTexture(this.target, this.tex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flipY ? 1 : 0); gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl[F[1]], gl[F[2]], src); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0); if (this.levels > 1) gl.generateMipmap(gl.TEXTURE_2D); return this; }
    /* an image or canvas into one layer of an array texture (drawn to the layer's size first if it differs) */
    imageLayer(src, layer) { const gl = this.dev.gl, F = this._F; let s = src; const sw = src.naturalWidth || src.width, sh = src.naturalHeight || src.height; if (sw !== this.w || sh !== this.h) { s = document.createElement('canvas'); s.width = this.w; s.height = this.h; s.getContext('2d').drawImage(src, 0, 0, this.w, this.h); }
      gl.bindTexture(this.target, this.tex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0); gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE); gl.texSubImage3D(this.target, 0, 0, 0, layer, this.w, this.h, 1, gl[F[1]], gl[F[2]], s); return this; }
    genMips() { const gl = this.dev.gl; gl.bindTexture(this.target, this.tex); gl.generateMipmap(this.target); return this; }
    dispose() { if (this.tex) { this.dev.gl.deleteTexture(this.tex); this.tex = null; this.dev.stats.textures--; } }
  }

  class Target {
    /* colour attachments (textures, or {tex, level, face}) and an optional depth texture */
    constructor(dev, o) {
      const gl = dev.gl; this.dev = dev; this.fb = gl.createFramebuffer(); this.color = []; this.depth = null; this.w = 1; this.h = 1; this.name = o.name || '';
      this.attach(o.color || [], o.depth || null);
    }
    attach(color, depth) {
      const gl = this.dev.gl; gl.bindFramebuffer(gl.FRAMEBUFFER, this.fb); this.dev._fb = this.fb; const bufs = [];
      color.forEach((c, i) => { const t = c instanceof Texture ? c : c.tex, lv = c instanceof Texture ? 0 : c.level || 0; gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, t.cube ? gl.TEXTURE_CUBE_MAP_POSITIVE_X + (c.face || 0) : gl.TEXTURE_2D, t.tex, lv); bufs.push(gl.COLOR_ATTACHMENT0 + i); if (!i) { this.w = Math.max(1, t.w >> lv); this.h = Math.max(1, t.h >> lv); } });
      for (let i = color.length; i < this.color.length; i++) gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, null, 0);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depth ? depth.tex : null, 0);
      if (depth && !color.length) { this.w = depth.w; this.h = depth.h; }
      if (bufs.length) gl.drawBuffers(bufs); else { gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE); }
      this.color = color.map(c => (c instanceof Texture ? c : c.tex)); this.depth = depth; return this;
    }
    ok() { const gl = this.dev.gl; gl.bindFramebuffer(gl.FRAMEBUFFER, this.fb); this.dev._fb = this.fb; return gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE; }
    dispose() { if (this.fb) { this.dev.gl.deleteFramebuffer(this.fb); this.fb = null; } }
  }

  class Program {
    constructor(dev, name, vs, fs, defines) {
      if (dev.refuse && dev.refuse(name, defines)) throw new Error(`shader "${name}" refused (test)`);
      const gl = dev.gl; this.dev = dev; this.name = name; this.id = uid(); this.frame = -1;
      const head = '#version 300 es\nprecision highp float;\nprecision highp int;\nprecision highp sampler2D;\nprecision highp sampler2DShadow;\nprecision highp samplerCube;\nprecision highp usampler2D;\nprecision highp sampler2DArray;\n' + Object.entries(defines || {}).filter(([, v]) => v !== false && v != null).map(([k, v]) => `#define ${k} ${v === true ? 1 : v}\n`).join('');
      const inc = (src, depth) => src.replace(/^[ \t]*#include <([\w.]+)>/gm, (m, n) => { if (CHUNKS[n] == null) throw new Error('shader chunk missing: ' + n); return depth > 8 ? '' : inc(CHUNKS[n], (depth || 0) + 1); });
      const mk = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, head + inc(src, 0)); gl.compileShader(s); return s; };
      const v = mk(gl.VERTEX_SHADER, vs), f = mk(gl.FRAGMENT_SHADER, fs), p = gl.createProgram();
      gl.attachShader(p, v); gl.attachShader(p, f); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
        const log = [gl.getShaderInfoLog(v), gl.getShaderInfoLog(f), gl.getProgramInfoLog(p)].filter(Boolean).join('\n');
        const bad = /ERROR: \d+:(\d+)/.exec(log), src = (head + inc(gl.getShaderInfoLog(v) ? vs : fs, 0)).split('\n'), ln = bad ? +bad[1] : 0;
        gl.deleteShader(v); gl.deleteShader(f); gl.deleteProgram(p);
        throw new Error(`shader "${name}" did not build: ${log}${ln ? '\n> ' + src.slice(Math.max(0, ln - 3), ln + 1).join('\n> ') : ''}`);
      }
      gl.deleteShader(v); gl.deleteShader(f); this.p = p; this.u = {}; let unit = 0;
      const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i), nm = a.name.replace(/\[0\]$/, ''), loc = gl.getUniformLocation(p, a.name), u = { loc, type: a.type, size: a.size, unit: -1 };
        if (a.type === gl.SAMPLER_2D || a.type === gl.SAMPLER_CUBE || a.type === gl.SAMPLER_2D_SHADOW || a.type === gl.UNSIGNED_INT_SAMPLER_2D || a.type === gl.SAMPLER_2D_ARRAY || a.type === gl.INT_SAMPLER_2D) { u.unit = unit++; u.cube = a.type === gl.SAMPLER_CUBE; u.arr = a.type === gl.SAMPLER_2D_ARRAY; }
        this.u[nm] = u; }
      /* a page is promised 16 texture units for a fragment shader, and Direct3D 11 and Metal give exactly 16. A program that
         wants more would link on some machines and not on others, so it is refused on all of them. */
      this.samplers = unit; if (unit > Program.MAX_UNITS) { const names = Object.keys(this.u).filter(k => this.u[k].unit >= 0).join(', '); gl.deleteProgram(p); throw new Error(`shader "${name}" samples ${unit} textures; only ${Program.MAX_UNITS} are promised (${names})`); }
      gl.useProgram(p); for (const k in this.u) if (this.u[k].unit >= 0) gl.uniform1i(this.u[k].loc, this.u[k].unit); dev._prog = p;
    }
    use() { const d = this.dev; if (d._prog !== this.p) { d.gl.useProgram(this.p); d._prog = this.p; } return this; }
    has(n) { return !!this.u[n]; }
    /* one uniform by name: numbers, arrays (vec2..4, mat3, mat4, and arrays of them, flattened) or a Texture */
    set(n, v) {
      const u = this.u[n]; if (!u || v == null) return this; const gl = this.dev.gl, T = u.type;
      if (u.unit >= 0) { const tex = v.tex !== undefined ? v : null; gl.activeTexture(gl.TEXTURE0 + u.unit); gl.bindTexture(u.cube ? gl.TEXTURE_CUBE_MAP : u.arr ? gl.TEXTURE_2D_ARRAY : gl.TEXTURE_2D, tex ? tex.tex : null); return this; }
      switch (T) {
        case gl.FLOAT: if (typeof v === 'number') gl.uniform1f(u.loc, v); else gl.uniform1fv(u.loc, v); break;
        case gl.FLOAT_VEC2: gl.uniform2fv(u.loc, v); break; case gl.FLOAT_VEC3: gl.uniform3fv(u.loc, v); break; case gl.FLOAT_VEC4: gl.uniform4fv(u.loc, v); break;
        case gl.FLOAT_MAT4: gl.uniformMatrix4fv(u.loc, false, v); break; case gl.FLOAT_MAT3: gl.uniformMatrix3fv(u.loc, false, v); break;
        case gl.INT: case gl.BOOL: if (typeof v === 'number' || typeof v === 'boolean') gl.uniform1i(u.loc, +v); else gl.uniform1iv(u.loc, v); break;
        case gl.INT_VEC2: gl.uniform2iv(u.loc, v); break; case gl.INT_VEC3: gl.uniform3iv(u.loc, v); break; case gl.INT_VEC4: gl.uniform4iv(u.loc, v); break;
        case gl.UNSIGNED_INT: gl.uniform1ui(u.loc, v); break;
        default: break;
      }
      return this;
    }
    sets(o) { for (const k in o) this.set(k, o[k]); return this; }
  }

  Program.MAX_UNITS = 16;
  class Device {
    constructor(canvas, o) {
      o = o || {}; this.canvas = canvas; this.stats = { textures: 0, programs: 0, buffers: 0, lost: 0 };
      const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: !!o.preserve, powerPreference: 'high-performance', desynchronized: false });
      if (!gl) throw new Error('WebGL2 is not available');
      this.gl = gl; const ext = n => gl.getExtension(n), dbg = ext('WEBGL_debug_renderer_info');
      const gpu = String(dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
      const an = ext('EXT_texture_filter_anisotropic');
      this.caps = { colorFloat: !!ext('EXT_color_buffer_float'), floatLinear: !!ext('OES_texture_float_linear'), aniso: !!an, anisoExt: an, maxAniso: an ? gl.getParameter(an.MAX_TEXTURE_MAX_ANISOTROPY_EXT) : 1,
        multiDraw: ext('WEBGL_multi_draw'), timer: ext('EXT_disjoint_timer_query_webgl2'), maxTex: gl.getParameter(gl.MAX_TEXTURE_SIZE), maxDraw: gl.getParameter(gl.MAX_DRAW_BUFFERS), gpu,
        software: /swiftshader|llvmpipe|softpipe|software|basic render/i.test(gpu) };
      if (!this.caps.colorFloat) throw new Error('this graphics card cannot draw to floating point textures (EXT_color_buffer_float)');
      this.programs = new Map(); this._prog = null; this._fb = null; this._vao = null; this.S = {}; this.frame = 0;
      this.emptyVAO = gl.createVertexArray(); this.timers = new Map(); this._tq = null; this.passMs = {}; this.lost = false;
      canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); this.lost = true; this.stats.lost++; if (o.onLost) o.onLost(); });
      canvas.addEventListener('webglcontextrestored', () => { this.lost = false; if (o.onRestored) o.onRestored(); });
      this.reset();
    }
    reset() { const gl = this.gl; this.S = { depthTest: null, depthWrite: null, depthFunc: null, cull: null, blend: null, po: null, mask: null }; this._prog = null; this._fb = null; this._vao = null; gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1); gl.disable(gl.DITHER); }
    texture(o) { return new Texture(this, o); }
    target(o) { return new Target(this, o); }
    /* a texture from an image or canvas, with mips, in sRGB or linear */
    imageTexture(src, o) { o = o || {}; const w = src.naturalWidth || src.videoWidth || src.width, h = src.naturalHeight || src.videoHeight || src.height;
      const t = new Texture(this, { w, h, format: o.srgb ? 'srgb8a8' : 'rgba8', mips: o.mips !== false, wrap: o.wrap || 'repeat', aniso: o.aniso == null ? 8 : o.aniso, filter: 'linear', name: o.name }); t.image(src, o.flipY); return t; }
    /* a texture that is one flat colour until its image arrives */
    lazyTexture(url, o) { o = o || {}; const ph = this.solid(o.fill || [128, 128, 128, 255], o.srgb), holder = { tex: ph.tex, w: 1, h: 1, cube: false, ready: false, id: uid(), _own: null };
      const im = new Image(); im.decoding = 'async'; if (o.cors !== false && !/^data:/.test(url)) im.crossOrigin = 'anonymous';
      im.onload = () => { if (this.lost) return; try { const t = this.imageTexture(im, o); holder.tex = t.tex; holder.w = t.w; holder.h = t.h; holder._own = t; holder.ready = true; if (o.onLoad) o.onLoad(holder, im); } catch (e) { if (o.onError) o.onError(e); } };
      im.onerror = () => { if (o.onError) o.onError(new Error('image did not load')); }; im.src = url;
      holder.dispose = () => { if (holder._own) holder._own.dispose(); holder.tex = null; }; return holder; }
    solid(rgba, srgb) { const k = rgba.join(',') + (srgb ? 's' : ''); this._solid = this._solid || new Map(); let t = this._solid.get(k); if (!t) { t = new Texture(this, { w: 1, h: 1, format: srgb ? 'srgb8a8' : 'rgba8', filter: 'nearest', data: new Uint8Array(rgba) }); this._solid.set(k, t); } return t; }
    program(name, vs, fs, defines) {
      const key = name + '|' + Object.entries(defines || {}).filter(([, v]) => v !== false && v != null).map(([k, v]) => k + '=' + v).sort().join(',');
      let p = this.programs.get(key); if (p) return p;
      /* a program this driver refused is not tried again every frame: the same refusal is given back at once */
      const bad = (this.refusedPrograms || (this.refusedPrograms = new Map())).get(key); if (bad) throw bad;
      try { p = new Program(this, name, vs, fs, defines); } catch (e) { this.refusedPrograms.set(key, e); console.error('[Scout Engine] ' + (e && e.message || e)); throw e; }
      this.programs.set(key, p); this.stats.programs++; return p;
    }
    bind(target, vp) {
      const gl = this.gl, fb = target ? target.fb : null; if (this._fb !== fb) { gl.bindFramebuffer(gl.FRAMEBUFFER, fb); this._fb = fb; }
      if (vp) gl.viewport(vp[0], vp[1], vp[2], vp[3]); else if (target) gl.viewport(0, 0, target.w, target.h); else gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    }
    /* render state, set only when it changes */
    state(o) {
      const gl = this.gl, S = this.S;
      const dt = o.depthTest !== false, dw = o.depthWrite !== false && dt, df = o.depthFunc || 'lequal', cull = o.cull === undefined ? 'back' : o.cull, blend = o.blend || 'none', po = o.polygonOffset || null, mask = o.colorMask === false ? 0 : 1;
      if (S.depthTest !== dt) { dt ? gl.enable(gl.DEPTH_TEST) : gl.disable(gl.DEPTH_TEST); S.depthTest = dt; }
      if (S.depthWrite !== dw) { gl.depthMask(dw); S.depthWrite = dw; }
      if (S.depthFunc !== df) { gl.depthFunc(df === 'less' ? gl.LESS : df === 'equal' ? gl.EQUAL : df === 'always' ? gl.ALWAYS : df === 'greater' ? gl.GREATER : gl.LEQUAL); S.depthFunc = df; }
      if (S.cull !== cull) { if (cull === 'none' || !cull) gl.disable(gl.CULL_FACE); else { gl.enable(gl.CULL_FACE); gl.cullFace(cull === 'front' ? gl.FRONT : gl.BACK); } S.cull = cull; }
      if (S.blend !== blend) {
        if (blend === 'none') gl.disable(gl.BLEND); else { gl.enable(gl.BLEND); gl.blendEquation(gl.FUNC_ADD);
          if (blend === 'add') gl.blendFunc(gl.ONE, gl.ONE); else if (blend === 'alpha') gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA); else if (blend === 'premul') gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); else if (blend === 'alphaT') gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE_MINUS_SRC_ALPHA); else if (blend === 'addT') gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ZERO, gl.ONE_MINUS_SRC_ALPHA);   /* the two that leave a mark in the picture's alpha where they drew: how much of what was there still shows. The temporal filter reads it */ else if (blend === 'mul') gl.blendFunc(gl.DST_COLOR, gl.ZERO); }
        S.blend = blend; }
      const pk = po ? po[0] + ',' + po[1] : ''; if (S.po !== pk) { if (po) { gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(po[0], po[1]); } else gl.disable(gl.POLYGON_OFFSET_FILL); S.po = pk; }
      if (S.mask !== mask) { gl.colorMask(!!mask, !!mask, !!mask, !!mask); S.mask = mask; }
    }
    clear(color, depth) { const gl = this.gl; let bits = 0; if (color) { gl.colorMask(true, true, true, true); this.S.mask = 1; gl.clearColor(color[0], color[1], color[2], color[3] == null ? 1 : color[3]); bits |= gl.COLOR_BUFFER_BIT; } if (depth != null) { gl.depthMask(true); this.S.depthWrite = true; gl.clearDepth(depth); bits |= gl.DEPTH_BUFFER_BIT; } if (bits) gl.clear(bits); }
    vao(v) { if (this._vao !== v) { this.gl.bindVertexArray(v); this._vao = v; } }
    /* one triangle over the whole target; the vertex shader makes it from gl_VertexID */
    fullscreen(prog) { prog.use(); this.vao(this.emptyVAO); this.gl.drawArrays(this.gl.TRIANGLES, 0, 3); }
    /* GPU time per pass where the browser gives timer queries (results arrive a few frames late) */
    passBegin(name) {
      this._pn = name; this._pt = performance.now(); const T = this.caps.timer; if (!T || !this.profileGPU) return; const gl = this.gl; let t = this.timers.get(name); if (!t) this.timers.set(name, t = { q: [], ms: 0 });
      for (let i = 0; i < t.q.length; i++) { const q = t.q[i]; if (gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) { if (!gl.getParameter(T.GPU_DISJOINT_EXT)) t.ms = t.ms * 0.8 + gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6 * 0.2; gl.deleteQuery(q); t.q.splice(i--, 1); } }
      if (t.q.length < 4) { const q = gl.createQuery(); gl.beginQuery(T.TIME_ELAPSED_EXT, q); t.q.push(q); this._tq = q; }
    }
    passEnd() { const ms = performance.now() - this._pt; this.passMs[this._pn] = (this.passMs[this._pn] || 0) * 0.8 + ms * 0.2; if (this._tq) { this.gl.endQuery(this.caps.timer.TIME_ELAPSED_EXT); this._tq = null; } }
    gpuMs() { const o = {}; this.timers.forEach((t, k) => { o[k] = t.ms; }); return o; }
    dispose() { const gl = this.gl; this.programs.forEach(p => gl.deleteProgram(p.p)); this.programs.clear(); const x = gl.getExtension('WEBGL_lose_context'); if (x) x.loseContext(); }
  }

  /* the vertex shader of every full-screen pass, and what the passes share */
  CHUNKS.fullscreen_vs = `out vec2 v_uv;
void main() { vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); v_uv = p; gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;
  CHUNKS.common = `#define PI 3.14159265359
float saturate(float x) { return clamp(x, 0.0, 1.0); }
vec3 saturate(vec3 x) { return clamp(x, 0.0, 1.0); }
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
/* unit vectors in two numbers (octahedral) */
vec2 octEncode(vec3 n) { n /= (abs(n.x) + abs(n.y) + abs(n.z)); vec2 e = n.z >= 0.0 ? n.xy : (1.0 - abs(n.yx)) * vec2(n.x >= 0.0 ? 1.0 : -1.0, n.y >= 0.0 ? 1.0 : -1.0); return e * 0.5 + 0.5; }
vec3 octDecode(vec2 f) { f = f * 2.0 - 1.0; vec3 n = vec3(f.x, f.y, 1.0 - abs(f.x) - abs(f.y)); float t = max(-n.z, 0.0); n.x += n.x >= 0.0 ? -t : t; n.y += n.y >= 0.0 ? -t : t; return normalize(n); }
/* noise that changes every frame and averages out under the temporal filter (Jimenez) */
float ign(vec2 p, float frame) { p += 5.588238 * mod(frame, 64.0); return fract(52.9829189 * fract(0.06711056 * p.x + 0.00583715 * p.y)); }
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash12(i), hash12(i + vec2(1, 0)), f.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + vec2(17.1, 9.2); a *= 0.5; } return s; }`;

  Object.assign(SE, { Device, Texture, Target, Program, FORMATS });

  /* ==== geometry: meshes, the builder that batches triangles, primitives, instances, levels of detail, clusters ==== */
  /* vertex layout shared by every shader: 0 position, 1 normal, 2 uv, 3 colour (8 bit), 4 aux (four floats, free for the
     material: a second uv, a wind weight, a glow height); an instanced draw adds 5..7 (the rows of a 3x4 matrix) and 8 (a colour) */
  const ATTR = { position: 0, normal: 1, uv: 2, color: 3, aux: 4, i0: 5, i1: 6, i2: 7, icolor: 8 };

  class Grow {   /* a typed array that grows */
    constructor(Type, n) { this.T = Type; this.a = new Type(n || 1024); this.n = 0; }
    need(k) { if (this.n + k > this.a.length) { const b = new this.T(Math.max(this.a.length * 2, this.n + k)); b.set(this.a.subarray(0, this.n)); this.a = b; } }
    done() { return this.a.subarray(0, this.n); }
  }

  class Mesh {
    /* d: { positions, normals, uvs, colors (Uint8 rgba), aux (Float32 x4), indices, keep } */
    constructor(dev, d) {
      const gl = dev.gl; this.dev = dev; this.id = uid(); this.name = d.name || 'mesh'; this.vcount = d.positions.length / 3; this.indexed = !!d.indices;
      this.count = this.indexed ? d.indices.length : this.vcount; this.tris = this.count / 3; this.buffers = []; this.vaos = new Map(); this.clusters = d.clusters || null; this.lods = null;
      this.vao = gl.createVertexArray(); dev.vao(this.vao);
      const buf = (data, loc, size, type, norm) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, d.dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW); this.buffers.push({ b, loc, size, type, norm: !!norm }); dev.stats.buffers++; return b; };
      this.pbuf = buf(d.positions, ATTR.position, 3, gl.FLOAT);
      if (d.normals) buf(d.normals, ATTR.normal, 3, gl.FLOAT);
      if (d.uvs) buf(d.uvs, ATTR.uv, 2, gl.FLOAT);
      if (d.colors) buf(d.colors, ATTR.color, 4, gl.UNSIGNED_BYTE, true);
      if (d.aux) buf(d.aux, ATTR.aux, 4, gl.FLOAT);
      this.has = { normal: !!d.normals, uv: !!d.uvs, color: !!d.colors, aux: !!d.aux };
      this._attrs(); this.ibuf = null;
      if (this.indexed) { this.ibuf = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibuf); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, d.indices, gl.STATIC_DRAW); this.itype = d.indices instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT; this.isize = d.indices instanceof Uint32Array ? 4 : 2; dev.stats.buffers++; }
      dev.vao(null);
      this.bounds = d.bounds || Mesh.boundsOf(d.positions);
      this.cpu = d.keep ? { positions: d.positions, normals: d.normals || null, uvs: d.uvs || null, colors: d.colors || null, indices: d.indices || null } : null;
    }
    _attrs() { const gl = this.dev.gl; for (const a of this.buffers) { gl.bindBuffer(gl.ARRAY_BUFFER, a.b); gl.enableVertexAttribArray(a.loc); gl.vertexAttribPointer(a.loc, a.size, a.type, a.norm, 0, 0); } if (!this.has.color) gl.vertexAttrib4f(ATTR.color, 1, 1, 1, 1); if (!this.has.aux) gl.vertexAttrib4f(ATTR.aux, 0, 0, 0, 0); if (!this.has.uv) gl.vertexAttrib4f(ATTR.uv, 0, 0, 0, 0); if (!this.has.normal) gl.vertexAttrib4f(ATTR.normal, 0, 1, 0, 0); }
    static boundsOf(p) { let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity; for (let i = 0; i < p.length; i += 3) { const x = p[i], y = p[i + 1], z = p[i + 2]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z; }
      if (!p.length) x0 = y0 = z0 = x1 = y1 = z1 = 0; const c = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2]; let r = 0; for (let i = 0; i < p.length; i += 3) { const d = Math.hypot(p[i] - c[0], p[i + 1] - c[1], p[i + 2] - c[2]); if (d > r) r = d; } return { min: [x0, y0, z0], max: [x1, y1, z1], center: c, radius: r }; }
    update(positions) { const gl = this.dev.gl; gl.bindBuffer(gl.ARRAY_BUFFER, this.pbuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, positions); }
    /* the vertex array that draws this mesh once per instance of ib */
    vaoFor(ib) {
      let v = this.vaos.get(ib.id); if (v) return v; const gl = this.dev.gl; v = gl.createVertexArray(); this.dev.vao(v); this._attrs(); if (this.ibuf) gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibuf);
      gl.bindBuffer(gl.ARRAY_BUFFER, ib.buf); for (let i = 0; i < 4; i++) { const loc = ATTR.i0 + i; gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, 64, i * 16); gl.vertexAttribDivisor(loc, 1); }
      this.dev.vao(null); this.vaos.set(ib.id, v); ib.users.add(this); return v;
    }
    draw(start, count) { const gl = this.dev.gl; this.dev.vao(this.vao); if (this.indexed) gl.drawElements(gl.TRIANGLES, count == null ? this.count : count, this.itype, (start || 0) * this.isize); else gl.drawArrays(gl.TRIANGLES, start || 0, count == null ? this.count : count); }
    drawInstanced(ib, n) { const gl = this.dev.gl; this.dev.vao(this.vaoFor(ib)); if (this.indexed) gl.drawElementsInstanced(gl.TRIANGLES, this.count, this.itype, 0, n); else gl.drawArraysInstanced(gl.TRIANGLES, 0, this.count, n); }
    /* many ranges in one call where the browser has WEBGL_multi_draw */
    drawRanges(starts, counts, n) {
      const gl = this.dev.gl, md = this.dev.caps.multiDraw; this.dev.vao(this.vao);
      if (md) { if (this.indexed) md.multiDrawElementsWEBGL(gl.TRIANGLES, counts, 0, this.itype, starts, 0, n); else md.multiDrawArraysWEBGL(gl.TRIANGLES, starts, 0, counts, 0, n); }
      else for (let i = 0; i < n; i++) { if (this.indexed) gl.drawElements(gl.TRIANGLES, counts[i], this.itype, starts[i]); else gl.drawArrays(gl.TRIANGLES, starts[i], counts[i]); }
    }
    /* the nearest hit of a ray in the mesh's own space, or null (needs keep: true) */
    raycast(o, d, maxT) {
      const c = this.cpu; if (!c) return null; const P = c.positions, I = c.indices, n = I ? I.length : P.length / 3; let best = maxT == null ? Infinity : maxT, hit = -1;
      for (let i = 0; i < n; i += 3) { const a = (I ? I[i] : i) * 3, b = (I ? I[i + 1] : i + 1) * 3, e = (I ? I[i + 2] : i + 2) * 3;
        const e1x = P[b] - P[a], e1y = P[b + 1] - P[a + 1], e1z = P[b + 2] - P[a + 2], e2x = P[e] - P[a], e2y = P[e + 1] - P[a + 1], e2z = P[e + 2] - P[a + 2];
        const px = d[1] * e2z - d[2] * e2y, py = d[2] * e2x - d[0] * e2z, pz = d[0] * e2y - d[1] * e2x, det = e1x * px + e1y * py + e1z * pz; if (Math.abs(det) < 1e-12) continue;
        const inv = 1 / det, tx = o[0] - P[a], ty = o[1] - P[a + 1], tz = o[2] - P[a + 2], u = (tx * px + ty * py + tz * pz) * inv; if (u < 0 || u > 1) continue;
        const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x, v = (d[0] * qx + d[1] * qy + d[2] * qz) * inv; if (v < 0 || u + v > 1) continue;
        const t = (e2x * qx + e2y * qy + e2z * qz) * inv; if (t > 1e-5 && t < best) { best = t; hit = i / 3; } }
      return hit < 0 ? null : { t: best, tri: hit };
    }
    dispose() { const gl = this.dev.gl; if (!this.vao) return; this.buffers.forEach(a => { gl.deleteBuffer(a.b); this.dev.stats.buffers--; }); if (this.ibuf) { gl.deleteBuffer(this.ibuf); this.dev.stats.buffers--; } gl.deleteVertexArray(this.vao); this.vaos.forEach(v => gl.deleteVertexArray(v)); this.vaos.clear(); this.vao = null; if (this.lods) this.lods.forEach(l => l.mesh !== this && l.mesh.dispose()); }
  }

  /* per-instance data on the card: a 3x4 matrix and a colour for each instance (16 floats) */
  class InstanceBuffer {
    constructor(dev, capacity) { this.dev = dev; this.id = uid(); this.cap = capacity || 64; this.data = new Float32Array(this.cap * 16); this.count = 0; this.buf = dev.gl.createBuffer(); this.users = new Set(); this.dirty = true; this.bounds = { center: [0, 0, 0], radius: 0, min: [0, 0, 0], max: [0, 0, 0] }; dev.stats.buffers++; }
    _grow(n) { if (n <= this.cap) return; this.cap = Math.max(n, this.cap * 2); const d = new Float32Array(this.cap * 16); d.set(this.data); this.data = d; this._realloc = true; }
    /* position, a turn about +Y, a scale on each axis, and a colour */
    add(x, y, z, yaw, sx, sy, sz, r, g, b, a) {
      this._grow(this.count + 1); const d = this.data, o = this.count * 16, c = Math.cos(yaw || 0), s = Math.sin(yaw || 0); sy = sy == null ? sx : sy; sz = sz == null ? sx : sz;
      d[o] = c * sx; d[o + 1] = 0; d[o + 2] = s * sz; d[o + 3] = x; d[o + 4] = 0; d[o + 5] = sy; d[o + 6] = 0; d[o + 7] = y; d[o + 8] = -s * sx; d[o + 9] = 0; d[o + 10] = c * sz; d[o + 11] = z;
      d[o + 12] = r == null ? 1 : r; d[o + 13] = g == null ? 1 : g; d[o + 14] = b == null ? 1 : b; d[o + 15] = a == null ? 1 : a; this.dirty = true; return this.count++;
    }
    addMatrix(m, col) { this._grow(this.count + 1); const d = this.data, o = this.count * 16; d[o] = m[0]; d[o + 1] = m[4]; d[o + 2] = m[8]; d[o + 3] = m[12]; d[o + 4] = m[1]; d[o + 5] = m[5]; d[o + 6] = m[9]; d[o + 7] = m[13]; d[o + 8] = m[2]; d[o + 9] = m[6]; d[o + 10] = m[10]; d[o + 11] = m[14];
      d[o + 12] = col ? col[0] : 1; d[o + 13] = col ? col[1] : 1; d[o + 14] = col ? col[2] : 1; d[o + 15] = col && col[3] != null ? col[3] : 1; this.dirty = true; return this.count++; }
    clear() { this.count = 0; this.dirty = true; }
    /* send to the card, and measure the instances' extent (meshRadius: the mesh's own radius, scaled per instance) */
    upload(meshRadius) {
      if (!this.dirty) return; this.dirty = false; const gl = this.dev.gl, d = this.data; gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
      if (this._realloc || !this._sized) { gl.bufferData(gl.ARRAY_BUFFER, d, gl.DYNAMIC_DRAW); this._realloc = false; this._sized = true; } else gl.bufferSubData(gl.ARRAY_BUFFER, 0, d.subarray(0, this.count * 16));
      let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity; const mr = meshRadius || 1;
      for (let i = 0; i < this.count; i++) { const o = i * 16, x = d[o + 3], y = d[o + 7], z = d[o + 11], s = Math.max(Math.hypot(d[o], d[o + 4], d[o + 8]), Math.hypot(d[o + 1], d[o + 5], d[o + 9]), Math.hypot(d[o + 2], d[o + 6], d[o + 10])) * mr;
        if (x - s < x0) x0 = x - s; if (x + s > x1) x1 = x + s; if (y - s < y0) y0 = y - s; if (y + s > y1) y1 = y + s; if (z - s < z0) z0 = z - s; if (z + s > z1) z1 = z + s; }
      if (!this.count) x0 = y0 = z0 = x1 = y1 = z1 = 0; const B = this.bounds; B.min = [x0, y0, z0]; B.max = [x1, y1, z1]; B.center = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2]; B.radius = Math.hypot(x1 - x0, y1 - y0, z1 - z0) / 2;
    }
    dispose() { if (this.buf) { this.dev.gl.deleteBuffer(this.buf); this.buf = null; this.dev.stats.buffers--; this.users.forEach(m => { const v = m.vaos.get(this.id); if (v) { this.dev.gl.deleteVertexArray(v); m.vaos.delete(this.id); } }); } }
  }

  /* triangles gathered one at a time into one mesh: flat shaded, each vertex with a uv, a colour and four free floats */
  class MeshBuilder {
    constructor(o) { o = o || {}; this.p = new Grow(Float32Array, 3072); this.n = new Grow(Float32Array, 3072); this.u = new Grow(Float32Array, 2048); this.c = new Grow(Uint8Array, 4096); this.x = o.aux ? new Grow(Float32Array, 4096) : null; this.tris = 0; this.owner = o.owners ? [] : null; }
    get empty() { return !this.tris; }
    /* a, b, c: [x, y, z]; nrm decides the winding; ua..uc: [u, v]; col: [r, g, b, a] in 0..1 (sRGB bytes on the card); xa..xc: aux */
    tri(a, b, c, nrm, ua, ub, uc, col, xa, xb, xc, own) {
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2], cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
      if (cx * cx + cy * cy + cz * cz < 1e-12) return;
      if (nrm && cx * nrm[0] + cy * nrm[1] + cz * nrm[2] < 0) { let t = b; b = c; c = t; t = ub; ub = uc; uc = t; t = xb; xb = xc; xc = t; }
      let nx, ny, nz; if (nrm) { nx = nrm[0]; ny = nrm[1]; nz = nrm[2]; } else { const l = Math.hypot(cx, cy, cz); nx = cx / l; ny = cy / l; nz = cz / l; }
      const P = this.p, N = this.n, U = this.u, C = this.c; P.need(9); N.need(9); U.need(6); C.need(12);
      let i = P.n; const pa = P.a, na = N.a; pa[i] = a[0]; pa[i + 1] = a[1]; pa[i + 2] = a[2]; pa[i + 3] = b[0]; pa[i + 4] = b[1]; pa[i + 5] = b[2]; pa[i + 6] = c[0]; pa[i + 7] = c[1]; pa[i + 8] = c[2]; P.n += 9;
      for (let k = 0; k < 9; k += 3) { na[i + k] = nx; na[i + k + 1] = ny; na[i + k + 2] = nz; } N.n += 9;
      i = U.n; const uu = U.a; if (ua) { uu[i] = ua[0]; uu[i + 1] = ua[1]; uu[i + 2] = ub[0]; uu[i + 3] = ub[1]; uu[i + 4] = uc[0]; uu[i + 5] = uc[1]; } else uu.fill(0, i, i + 6); U.n += 6;
      i = C.n; const ca = C.a, r = col ? col[0] * 255 : 255, g = col ? col[1] * 255 : 255, bl = col ? col[2] * 255 : 255, al = col && col[3] != null ? col[3] * 255 : 255;
      for (let k = 0; k < 12; k += 4) { ca[i + k] = r; ca[i + k + 1] = g; ca[i + k + 2] = bl; ca[i + k + 3] = al; } C.n += 12;
      if (this.x) { const X = this.x; X.need(12); i = X.n; const xx = X.a; if (xa) { xx.set(xa, i); xx.set(xb, i + 4); xx.set(xc, i + 8); } else xx.fill(0, i, i + 12); X.n += 12; }
      if (this.owner) this.owner.push(own || 0); this.tris++;
    }
    quad(a, b, c, d, nrm, uv, col, aux, own) { this.tri(a, b, c, nrm, uv && uv[0], uv && uv[1], uv && uv[2], col, aux && aux[0], aux && aux[1], aux && aux[2], own); this.tri(a, c, d, nrm, uv && uv[0], uv && uv[2], uv && uv[3], col, aux && aux[0], aux && aux[2], aux && aux[3], own); }
    /* an axis aligned or rotated box: centre, half sizes, a turn about +Y */
    box(cx, cy, cz, hx, hy, hz, yaw, col, uvScale) {
      const c = Math.cos(yaw || 0), s = Math.sin(yaw || 0), P = (x, y, z) => [cx + x * c + z * s, cy + y, cz - x * s + z * c], N = (x, y, z) => [x * c + z * s, y, -x * s + z * c], k = uvScale || 1;
      const f = (a, b, d, e, n, w, h) => this.quad(a, b, d, e, n, [[0, 0], [w * k, 0], [w * k, h * k], [0, h * k]], col);
      f(P(-hx, -hy, hz), P(hx, -hy, hz), P(hx, hy, hz), P(-hx, hy, hz), N(0, 0, 1), 2 * hx, 2 * hy); f(P(hx, -hy, -hz), P(-hx, -hy, -hz), P(-hx, hy, -hz), P(hx, hy, -hz), N(0, 0, -1), 2 * hx, 2 * hy);
      f(P(hx, -hy, hz), P(hx, -hy, -hz), P(hx, hy, -hz), P(hx, hy, hz), N(1, 0, 0), 2 * hz, 2 * hy); f(P(-hx, -hy, -hz), P(-hx, -hy, hz), P(-hx, hy, hz), P(-hx, hy, -hz), N(-1, 0, 0), 2 * hz, 2 * hy);
      f(P(-hx, hy, hz), P(hx, hy, hz), P(hx, hy, -hz), P(-hx, hy, -hz), [0, 1, 0], 2 * hx, 2 * hz); f(P(-hx, -hy, -hz), P(hx, -hy, -hz), P(hx, -hy, hz), P(-hx, -hy, hz), [0, -1, 0], 2 * hx, 2 * hz);
    }
    data(o) { o = o || {}; const d = { positions: this.p.done().slice(), normals: this.n.done().slice(), uvs: this.u.done().slice(), colors: this.c.done().slice(), aux: this.x ? this.x.done().slice() : null, name: o.name, keep: o.keep }; return d; }
    build(dev, o) { if (!this.tris) return null; o = o || {}; const d = this.data(o); let m; if (o.clusters) { const cl = clusterize(d, o.clusters === true ? 384 : o.clusters); m = new Mesh(dev, d); m.clusters = cl; } else m = new Mesh(dev, d); if (this.owner) m.owner = this.owner; return m; }
  }

  /* ---------- clusters: a mesh cut into runs of nearby triangles, each with a bounding sphere and a cone of normals, so
     the renderer can skip the runs that are off screen or face away (the first rung of what Nanite does) ---------- */
  function clusterize(d, maxTris) {
    const P = d.positions, I = d.indices || null, nt = (I ? I.length : P.length / 3) / 3; if (nt < maxTris * 2) return null;
    const B = Mesh.boundsOf(P), ext = Math.max(B.max[0] - B.min[0], B.max[1] - B.min[1], B.max[2] - B.min[2]) || 1, keys = new Float64Array(nt), order = new Uint32Array(nt);
    const part = v => { v = (v | (v << 16)) & 0x030000FF; v = (v | (v << 8)) & 0x0300F00F; v = (v | (v << 4)) & 0x030C30C3; v = (v | (v << 2)) & 0x09249249; return v; };
    const vi = (t, k) => (I ? I[t * 3 + k] : t * 3 + k) * 3;
    for (let t = 0; t < nt; t++) { const a = vi(t, 0), b = vi(t, 1), c = vi(t, 2), x = ((P[a] + P[b] + P[c]) / 3 - B.min[0]) / ext * 1023, y = ((P[a + 1] + P[b + 1] + P[c + 1]) / 3 - B.min[1]) / ext * 1023, z = ((P[a + 2] + P[b + 2] + P[c + 2]) / 3 - B.min[2]) / ext * 1023; keys[t] = part(x | 0) + part(y | 0) * 2 + part(z | 0) * 4; order[t] = t; }
    order.sort((a, b) => keys[a] - keys[b]);
    /* reorder: indices for an indexed mesh, whole vertices otherwise */
    if (I) { const J = new I.constructor(I.length); for (let t = 0; t < nt; t++) { const s = order[t] * 3; J[t * 3] = I[s]; J[t * 3 + 1] = I[s + 1]; J[t * 3 + 2] = I[s + 2]; } d.indices = J; }
    else { const re = (A, size) => { if (!A) return A; const O = new A.constructor(A.length), w = size * 3; for (let t = 0; t < nt; t++) O.set(A.subarray(order[t] * w, order[t] * w + w), t * w); return O; }; d.positions = re(P, 3); d.normals = re(d.normals, 3); d.uvs = re(d.uvs, 2); d.colors = re(d.colors, 4); d.aux = re(d.aux, 4); }
    const P2 = d.positions, I2 = d.indices || null, N2 = d.normals, v2 = (t, k) => (I2 ? I2[t * 3 + k] : t * 3 + k) * 3, out = [], unit = I2 ? (I2 instanceof Uint32Array ? 4 : 2) : 1;
    for (let t0 = 0; t0 < nt; t0 += maxTris) {
      const t1 = Math.min(nt, t0 + maxTris); let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity, ax = 0, ay = 0, az = 0;
      for (let t = t0; t < t1; t++) for (let k = 0; k < 3; k++) { const v = v2(t, k), x = P2[v], y = P2[v + 1], z = P2[v + 2]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z; if (N2) { ax += N2[v]; ay += N2[v + 1]; az += N2[v + 2]; } }
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, cz = (z0 + z1) / 2, r = Math.hypot(x1 - x0, y1 - y0, z1 - z0) / 2; let cone = -1; const al = Math.hypot(ax, ay, az);
      if (N2 && al > 1e-6) { ax /= al; ay /= al; az /= al; cone = 1; for (let t = t0; t < t1; t++) { const v = v2(t, 0), dd = N2[v] * ax + N2[v + 1] * ay + N2[v + 2] * az; if (dd < cone) cone = dd; } }
      out.push({ start: I2 ? t0 * 3 * unit : t0 * 3, count: (t1 - t0) * 3, c: [cx, cy, cz], r, axis: [ax, ay, az], cone });
    }
    return out;
  }

  /* ---------- levels of detail by vertex clustering: vertices snapped to a grid, merged, the collapsed triangles dropped ---------- */
  function simplify(d, cell) {
    const P = d.positions, I = d.indices, n = P.length / 3, map = new Map(), remap = new Uint32Array(n), acc = []; let m = 0;
    const B = Mesh.boundsOf(P);
    for (let i = 0; i < n; i++) { const kx = Math.floor((P[i * 3] - B.min[0]) / cell), ky = Math.floor((P[i * 3 + 1] - B.min[1]) / cell), kz = Math.floor((P[i * 3 + 2] - B.min[2]) / cell), key = kx + ky * 4096 + kz * 16777216; let j = map.get(key);
      if (j === undefined) { j = m++; map.set(key, j); acc.push([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]); } remap[i] = j; const a = acc[j]; a[0] += P[i * 3]; a[1] += P[i * 3 + 1]; a[2] += P[i * 3 + 2]; a[3]++;
      if (d.normals) { a[4] += d.normals[i * 3]; a[5] += d.normals[i * 3 + 1]; a[6] += d.normals[i * 3 + 2]; } if (d.uvs) { a[7] += d.uvs[i * 2]; a[8] += d.uvs[i * 2 + 1]; } if (d.colors) { a[9] += d.colors[i * 4]; a[10] += d.colors[i * 4 + 1]; a[11] += d.colors[i * 4 + 2]; a[12] += d.colors[i * 4 + 3]; } }
    const pos = new Float32Array(m * 3), nor = d.normals ? new Float32Array(m * 3) : null, uv = d.uvs ? new Float32Array(m * 2) : null, col = d.colors ? new Uint8Array(m * 4) : null;
    acc.forEach((a, j) => { const k = 1 / a[3]; pos[j * 3] = a[0] * k; pos[j * 3 + 1] = a[1] * k; pos[j * 3 + 2] = a[2] * k; if (nor) { const l = Math.hypot(a[4], a[5], a[6]) || 1; nor[j * 3] = a[4] / l; nor[j * 3 + 1] = a[5] / l; nor[j * 3 + 2] = a[6] / l; } if (uv) { uv[j * 2] = a[7] * k; uv[j * 2 + 1] = a[8] * k; } if (col) { col[j * 4] = a[9] * k; col[j * 4 + 1] = a[10] * k; col[j * 4 + 2] = a[11] * k; col[j * 4 + 3] = a[12] * k; } });
    const idx = [], nt = (I ? I.length : n) / 3; for (let t = 0; t < nt; t++) { const a = remap[I ? I[t * 3] : t * 3], b = remap[I ? I[t * 3 + 1] : t * 3 + 1], c = remap[I ? I[t * 3 + 2] : t * 3 + 2]; if (a !== b && b !== c && a !== c) idx.push(a, b, c); }
    return { positions: pos, normals: nor, uvs: uv, colors: col, indices: m > 65535 ? new Uint32Array(idx) : new Uint16Array(idx), name: (d.name || 'mesh') + '~' };
  }
  /* a chain of ever coarser meshes: [{ mesh, size }] where size is the share of the screen's height below which the next one draws */
  function buildLODs(dev, d, o) {
    o = o || {}; const base = new Mesh(dev, d), B = base.bounds, ext = B.radius * 2, out = [{ mesh: base, size: 0 }]; let prev = base.tris;
    (o.steps || [48, 20, 9]).forEach((res, i) => { const s = simplify(d, ext / res), t = s.indices.length / 3; if (t < 4 || t > prev * 0.75) return; prev = t; out[out.length - 1].size = (o.sizes || [0.35, 0.14, 0.05])[i]; out.push({ mesh: new Mesh(dev, s), size: 0 }); });
    base.lods = out; return base;
  }

  /* ---------- primitives (indexed, smooth where round) ---------- */
  const Prim = {
    box(w, h, d) { const B = new MeshBuilder(); B.box(0, 0, 0, (w || 1) / 2, (h || 1) / 2, (d || 1) / 2, 0, null, 1); return B.data({ name: 'box', keep: true }); },
    plane(w, d, seg) { seg = seg || 1; const P = [], N = [], U = [], I = []; for (let j = 0; j <= seg; j++) for (let i = 0; i <= seg; i++) { P.push((i / seg - 0.5) * w, 0, (j / seg - 0.5) * d); N.push(0, 1, 0); U.push(i / seg, j / seg); }
      for (let j = 0; j < seg; j++) for (let i = 0; i < seg; i++) { const a = j * (seg + 1) + i, b = a + 1, c = a + seg + 1, e = c + 1; I.push(a, c, b, b, c, e); } return Prim._d('plane', P, N, U, I); },
    sphere(r, seg) { r = r || 0.5; seg = seg || 24; const rings = Math.max(6, seg >> 1), P = [], N = [], U = [], I = [];
      for (let j = 0; j <= rings; j++) { const v = j / rings, ph = v * Math.PI; for (let i = 0; i <= seg; i++) { const u = i / seg, th = u * TAU, x = Math.sin(ph) * Math.cos(th), y = Math.cos(ph), z = Math.sin(ph) * Math.sin(th); P.push(x * r, y * r, z * r); N.push(x, y, z); U.push(u, v); } }
      for (let j = 0; j < rings; j++) for (let i = 0; i < seg; i++) { const a = j * (seg + 1) + i, b = a + seg + 1; I.push(a, a + 1, b, a + 1, b + 1, b); } return Prim._d('sphere', P, N, U, I); },
    /* a cylinder or cone along +Y from -h/2 to h/2: bottom and top radius */
    cylinder(rb, rt, h, seg, caps) { rb = rb == null ? 0.5 : rb; rt = rt == null ? rb : rt; h = h || 1; seg = seg || 20; const P = [], N = [], U = [], I = [], sl = (rb - rt) / h;
      for (let j = 0; j <= 1; j++) for (let i = 0; i <= seg; i++) { const th = i / seg * TAU, c = Math.cos(th), s = Math.sin(th), r = j ? rt : rb, l = Math.hypot(1, sl); P.push(c * r, (j - 0.5) * h, s * r); N.push(c / l, sl / l, s / l); U.push(i / seg * Math.max(1, Math.round(rb * 4)), j * h); }
      for (let i = 0; i < seg; i++) { const a = i, b = i + seg + 1; I.push(a, b, a + 1, a + 1, b, b + 1); }
      if (caps !== false) [[rb, -0.5, -1], [rt, 0.5, 1]].forEach(([r, y, ny]) => { if (r <= 0) return; const c0 = P.length / 3; P.push(0, y * h, 0); N.push(0, ny, 0); U.push(0.5, 0.5); for (let i = 0; i <= seg; i++) { const th = i / seg * TAU; P.push(Math.cos(th) * r, y * h, Math.sin(th) * r); N.push(0, ny, 0); U.push(Math.cos(th) * 0.5 + 0.5, Math.sin(th) * 0.5 + 0.5); } for (let i = 0; i < seg; i++) { if (ny > 0) I.push(c0, c0 + i + 2, c0 + i + 1); else I.push(c0, c0 + i + 1, c0 + i + 2); } });
      return Prim._d('cylinder', P, N, U, I); },
    capsule(r, h, seg) { r = r || 0.3; h = h || 1.8; seg = seg || 16; const half = Math.max(0, h / 2 - r), rings = 6, P = [], N = [], U = [], I = [], rows = [];
      for (let j = 0; j <= rings; j++) rows.push([j / rings * Math.PI / 2, half]); for (let j = 0; j <= rings; j++) rows.push([Math.PI / 2 + j / rings * Math.PI / 2, -half]);
      rows.forEach(([ph, off], j) => { for (let i = 0; i <= seg; i++) { const th = i / seg * TAU, x = Math.sin(ph) * Math.cos(th), y = Math.cos(ph), z = Math.sin(ph) * Math.sin(th); P.push(x * r, y * r + off, z * r); N.push(x, y, z); U.push(i / seg, j / (rows.length - 1)); } });
      for (let j = 0; j < rows.length - 1; j++) for (let i = 0; i < seg; i++) { const a = j * (seg + 1) + i, b = a + seg + 1; I.push(a, a + 1, b, a + 1, b + 1, b); } return Prim._d('capsule', P, N, U, I); },
    /* a lumpy ball: an icosphere pushed in and out by noise (tree crowns, rocks) */
    blob(r, detail, lump, seed) { const t = (1 + Math.sqrt(5)) / 2; let V = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(v => V3.normalize([0, 0, 0], v));
      let F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
      for (let k = 0; k < (detail == null ? 2 : detail); k++) { const mid = new Map(), F2 = [], m = (a, b) => { const key = a < b ? a + '_' + b : b + '_' + a; let i = mid.get(key); if (i == null) { i = V.length; V.push(V3.normalize([0, 0, 0], [V[a][0] + V[b][0], V[a][1] + V[b][1], V[a][2] + V[b][2]])); mid.set(key, i); } return i; };
        F.forEach(([a, b, c]) => { const ab = m(a, b), bc = m(b, c), ca = m(c, a); F2.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]); }); F = F2; }
      const R = rng(seed || 7), ph = [R() * 9, R() * 9, R() * 9], lp = lump == null ? 0.22 : lump, P = [], N = [], U = [], I = [];
      V.forEach(v => { const k = 1 + lp * (Math.sin(v[0] * 3.1 + ph[0]) * Math.sin(v[1] * 2.7 + ph[1]) + 0.6 * Math.sin(v[2] * 4.3 + ph[2]) * Math.sin(v[0] * 5.1 + ph[1])) * 0.6; P.push(v[0] * r * k, v[1] * r * k, v[2] * r * k); N.push(v[0], v[1], v[2]); U.push(Math.atan2(v[2], v[0]) / TAU + 0.5, Math.acos(clamp(v[1], -1, 1)) / Math.PI); });
      F.forEach(f => I.push(f[0], f[2], f[1])); const d = Prim._d('blob', P, N, U, I); Prim.smooth(d); return d; },
    _d(name, P, N, U, I) { return { name, positions: new Float32Array(P), normals: new Float32Array(N), uvs: new Float32Array(U), indices: P.length / 3 > 65535 ? new Uint32Array(I) : new Uint16Array(I), keep: true }; },
    /* normals recomputed from the faces, averaged at shared vertices */
    smooth(d) { const P = d.positions, I = d.indices, N = new Float32Array(P.length); for (let i = 0; i < I.length; i += 3) { const a = I[i] * 3, b = I[i + 1] * 3, c = I[i + 2] * 3, ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2], nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; for (const k of [a, b, c]) { N[k] += nx; N[k + 1] += ny; N[k + 2] += nz; } }
      for (let i = 0; i < N.length; i += 3) { const l = Math.hypot(N[i], N[i + 1], N[i + 2]) || 1; N[i] /= l; N[i + 1] /= l; N[i + 2] /= l; } d.normals = N; return d; },
    /* move, turn and scale mesh data in place (the normals follow the turn) */
    transform(d, m) { const P = d.positions, N = d.normals, v = [0, 0, 0]; for (let i = 0; i < P.length; i += 3) { V3.transform(v, [P[i], P[i + 1], P[i + 2]], m); P[i] = v[0]; P[i + 1] = v[1]; P[i + 2] = v[2]; if (N) { V3.transformDir(v, [N[i], N[i + 1], N[i + 2]], m); V3.normalize(v, v); N[i] = v[0]; N[i + 1] = v[1]; N[i + 2] = v[2]; } } return d; },
    /* several mesh datas into one (indices rebased; colours and aux filled where a part has none) */
    merge(list, name) { let nv = 0, ni = 0; list.forEach(d => { nv += d.positions.length / 3; ni += d.indices ? d.indices.length : d.positions.length / 3; });
      const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), U = new Float32Array(nv * 2), C = new Uint8Array(nv * 4).fill(255), X = list.some(d => d.aux) ? new Float32Array(nv * 4) : null, I = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni); let vo = 0, io = 0;
      list.forEach(d => { const n = d.positions.length / 3; P.set(d.positions, vo * 3); if (d.normals) N.set(d.normals, vo * 3); if (d.uvs) U.set(d.uvs, vo * 2); if (d.colors) C.set(d.colors, vo * 4); if (X && d.aux) X.set(d.aux, vo * 4);
        if (d.indices) for (let i = 0; i < d.indices.length; i++) I[io++] = d.indices[i] + vo; else for (let i = 0; i < n; i++) I[io++] = vo + i; vo += n; });
      return { name: name || 'merged', positions: P, normals: N, uvs: U, colors: C, aux: X, indices: I, keep: true }; },
    /* one colour (0..1, sRGB) on every vertex; alpha too */
    paint(d, col) { const n = d.positions.length / 3, C = new Uint8Array(n * 4); for (let i = 0; i < n; i++) { C[i * 4] = col[0] * 255; C[i * 4 + 1] = col[1] * 255; C[i * 4 + 2] = col[2] * 255; C[i * 4 + 3] = (col[3] == null ? 1 : col[3]) * 255; } d.colors = C; return d; },
  };

  Object.assign(SE, { ATTR, Mesh, MeshBuilder, InstanceBuffer, Prim, Geo: { clusterize, simplify, buildLODs } });

  /* ==== the scene: entities in a hierarchy, each with a transform and components; scripts with a life cycle ==== */
  class Transform {
    constructor(entity) { this.entity = entity; this.position = V3.create(); this.rotation = Q.create(); this.scale = V3.create(1, 1, 1); this._local = M4.create(); this._world = M4.create(); this._dirty = true; this.version = 1; }
    dirty() { if (this._dirty) return; this._dirty = true; const ch = this.entity.children; for (let i = 0; i < ch.length; i++) ch[i].transform.dirty(); if (this.entity.scene) this.entity.scene.touched = true; }
    setPosition(x, y, z) { if (typeof x !== 'number') { z = x[2]; y = x[1]; x = x[0]; } const p = this.position; if (p[0] !== x || p[1] !== y || p[2] !== z) { p[0] = x; p[1] = y; p[2] = z; this.dirty(); } return this; }
    setRotation(q) { Q.copy(this.rotation, q); this.dirty(); return this; }
    /* degrees: pitch about X, yaw about Y, roll about Z */
    setEuler(pitch, yaw, roll) { Q.fromEuler(this.rotation, pitch * RAD, yaw * RAD, (roll || 0) * RAD); this.dirty(); return this; }
    getEuler() { const e = Q.toEuler([0, 0, 0], this.rotation); return [e[0] * DEG, e[1] * DEG, e[2] * DEG]; }
    setScale(x, y, z) { if (typeof x !== 'number') { z = x[2]; y = x[1]; x = x[0]; } else if (y == null) { y = x; z = x; } V3.set(this.scale, x, y, z); this.dirty(); return this; }
    translate(x, y, z) { return this.setPosition(this.position[0] + x, this.position[1] + y, this.position[2] + z); }
    rotateY(rad) { const q = Q.fromAxisAngle([0, 0, 0, 1], [0, 1, 0], rad); Q.mul(this.rotation, q, this.rotation); this.dirty(); return this; }
    lookAt(target, up) { const p = this.worldPosition([0, 0, 0]); Q.lookRotation(this.rotation, [target[0] - p[0], target[1] - p[1], target[2] - p[2]], up); this.dirty(); return this; }
    get world() { if (this._dirty) { M4.compose(this._local, this.position, this.rotation, this.scale); const p = this.entity.parent; if (p) M4.mul(this._world, p.transform.world, this._local); else this._world.set(this._local); this._dirty = false; this.version++; } return this._world; }
    worldPosition(o) { const m = this.world; o[0] = m[12]; o[1] = m[13]; o[2] = m[14]; return o; }
    forward(o) { const m = this.world; return V3.normalize(o, [-m[8], -m[9], -m[10]]); }
    /* place by a world matrix (under a parent, the local matrix is solved for) */
    setWorld(m) { const p = this.entity.parent; let l = m; if (p) { l = M4.create(); M4.invert(l, p.transform.world); M4.mul(l, l, m); } M4.decompose(l, this.position, this.rotation, this.scale); this.dirty(); return this; }
  }

  class Component {
    constructor(entity) { this.entity = entity; this.enabled = true; this._started = false; }
    get transform() { return this.entity.transform; }
    get scene() { return this.entity.scene; }
    get engine() { return this.entity.scene.engine; }
    get active() { return this.enabled && this.entity.activeInHierarchy; }
    /* override what is needed: onAwake (added), onStart (before the first update), onUpdate(dt), onFixedUpdate(dt), onLateUpdate(dt), onDestroy */
    toJSON() { const P = this.constructor.props || {}, o = {}; for (const k in P) { const v = this[k]; if (P[k].save === false || v === undefined) continue; o[k] = ArrayBuffer.isView(v) ? Array.from(v) : v; } return o; }
  }
  const COMPONENTS = {};
  /* a component type: its class, and (in static props) the fields the editor shows and the scene file keeps */
  function registerComponent(name, cls) { cls.typeName = name; COMPONENTS[name] = cls; return cls; }

  class Entity {
    constructor(scene, name) { this.scene = scene; this.id = uid(); this.name = name || 'Entity'; this.parent = null; this.children = []; this.active = true; this.transform = new Transform(this); this.components = []; this.tags = new Set(); this.transient = false; this.userData = {}; this.destroyed = false; }
    get activeInHierarchy() { let e = this; while (e) { if (!e.active) return false; e = e.parent; } return true; }
    add(type, props) {
      const cls = typeof type === 'string' ? COMPONENTS[type] : type; if (!cls) throw new Error('no component type ' + type);
      const c = new cls(this); if (props) Object.assign(c, props); this.components.push(c); this.scene._register(c); if (c.onAwake) c.onAwake(); this.scene.touched = true; return c;
    }
    get(type) { const cls = typeof type === 'string' ? COMPONENTS[type] : type; for (const c of this.components) if (c instanceof cls) return c; return null; }
    remove(c) { const i = this.components.indexOf(c); if (i < 0) return; this.components.splice(i, 1); this.scene._unregister(c); if (c.onDestroy) c.onDestroy(); this.scene.touched = true; }
    setParent(p, keepWorld) { if (p === this.parent) return this; const w = keepWorld ? M4.copy(M4.create(), this.transform.world) : null;
      const list = this.parent ? this.parent.children : this.scene.roots, i = list.indexOf(this); if (i >= 0) list.splice(i, 1);
      this.parent = p || null; (p ? p.children : this.scene.roots).push(this); this.transform._dirty = false; this.transform.dirty(); if (w) this.transform.setWorld(w); this.scene.emit('hierarchy'); return this; }
    setActive(on) { this.active = !!on; this.scene.touched = true; return this; }
    destroy() { if (this.destroyed) return; this.destroyed = true; this.children.slice().forEach(c => c.destroy()); this.components.slice().forEach(c => this.remove(c));
      const list = this.parent ? this.parent.children : this.scene.roots, i = list.indexOf(this); if (i >= 0) list.splice(i, 1); this.scene.entities.delete(this.id); this.scene.emit('hierarchy'); this.scene.touched = true; }
    traverse(fn) { fn(this); for (const c of this.children) c.traverse(fn); }
  }

  class Scene extends Emitter {
    constructor(engine) {
      super(); this.engine = engine; this.entities = new Map(); this.roots = []; this.renderables = new Set(); this.lights = new Set(); this.particles = new Set(); this.touched = true;
      this._upd = new Set(); this._fix = new Set(); this._late = new Set(); this._start = [];
      /* the world's light and air: where the sun stands, the sky, the haze, the weather (the editor's World Settings) */
      this.env = { sunDir: V3.normalize([0, 0, 0], [0.4, 0.75, 0.5]), sunColor: [1, 1, 1], sunIntensity: 1, turbidity: 2.2, groundAlbedo: [0.22, 0.2, 0.17], skyIntensity: 1, fogDensity: 0.00035, fogHeight: 90, fogSun: 1, clouds: 0.3, cloudSpeed: 1, wetness: 0, wind: 0.35, stars: 1, night: 0, version: 1 };
    }
    createEntity(name, o) { o = o || {}; const e = new Entity(this, name); this.entities.set(e.id, e); if (o.parent) { e.parent = o.parent; o.parent.children.push(e); } else this.roots.push(e);
      if (o.position) e.transform.setPosition(o.position); if (o.euler) e.transform.setEuler(o.euler[0], o.euler[1], o.euler[2]); if (o.rotation) e.transform.setRotation(o.rotation); if (o.scale != null) e.transform.setScale(o.scale); if (o.transient) e.transient = true; if (o.tags) o.tags.forEach(t => e.tags.add(t));
      this.emit('hierarchy'); this.touched = true; return e; }
    _register(c) { if (c.isRenderable) this.renderables.add(c); if (c.isLight) this.lights.add(c); if (c.isParticles) this.particles.add(c); if (c.onUpdate) this._upd.add(c); if (c.onFixedUpdate) this._fix.add(c); if (c.onLateUpdate) this._late.add(c); if (c.onStart) this._start.push(c); }
    _unregister(c) { this.renderables.delete(c); this.lights.delete(c); this.particles.delete(c); this._upd.delete(c); this._fix.delete(c); this._late.delete(c); }
    find(name) { for (const e of this.entities.values()) if (e.name === name) return e; return null; }
    withTag(tag) { const out = []; for (const e of this.entities.values()) if (e.tags.has(tag)) out.push(e); return out; }
    traverse(fn) { this.roots.forEach(r => r.traverse(fn)); }
    update(dt) { if (this._start.length) { const s = this._start; this._start = []; s.forEach(c => { if (!c.entity.destroyed) { c._started = true; c.onStart(); } }); } for (const c of this._upd) if (c.active) c.onUpdate(dt); }
    fixedUpdate(dt) { for (const c of this._fix) if (c.active) c.onFixedUpdate(dt); }
    lateUpdate(dt) { for (const c of this._late) if (c.active) c.onLateUpdate(dt); }
    envChanged() { this.env.version++; this.touched = true; }
    clear(all) { [...this.entities.values()].forEach(e => { if (!e.parent && (all || !e.transient)) e.destroy(); }); }
    /* the scene as data: what a person built (transient entities, streamed in by the world, are left out) */
    toJSON() {
      const ent = e => ({ name: e.name, active: e.active, tags: [...e.tags], position: Array.from(e.transform.position), rotation: Array.from(e.transform.rotation), scale: Array.from(e.transform.scale),
        components: e.components.filter(c => c.constructor.typeName && c.constructor.save !== false).map(c => Object.assign({ type: c.constructor.typeName, enabled: c.enabled }, c.toJSON())), children: e.children.filter(c => !c.transient).map(ent) });
      const env = Object.assign({}, this.env); delete env.version; return { engine: SE.name, version: SE.version, env, entities: this.roots.filter(e => !e.transient).map(ent) };
    }
    load(json, o) {
      o = o || {}; if (!o.keep) this.clear(false); if (json.env && !o.keepEnv) { Object.assign(this.env, json.env); this.envChanged(); }
      const mk = (d, parent) => { const e = this.createEntity(d.name, { parent, position: d.position, rotation: d.rotation, scale: d.scale }); e.active = d.active !== false; (d.tags || []).forEach(t => e.tags.add(t));
        (d.components || []).forEach(cd => { if (!COMPONENTS[cd.type]) return; const props = Object.assign({}, cd); delete props.type; try { const c = e.add(cd.type, props); if (c.onLoad) c.onLoad(props); } catch (err) { console.warn('[Scout Engine] component not restored: ' + cd.type, err); } });
        (d.children || []).forEach(c => mk(c, e)); return e; };
      return (json.entities || []).map(d => mk(d, null));
    }
  }

  /* ---------- camera ---------- */
  class Camera extends Component {
    constructor(e) { super(e); this.fov = 60; this.near = 0.25; this.far = 6000; this.aspect = 1; this.view = M4.create(); this.proj = M4.create(); this.viewProj = M4.create(); this.invViewProj = M4.create(); this.invView = M4.create(); this.position = V3.create(); this.frustum = new Frustum(); }
    /* matrices for this frame; jitter (in clip units) shifts the picture a fraction of a pixel for the temporal filter */
    update(aspect, jx, jy) {
      this.aspect = aspect; M4.copy(this.invView, this.transform.world); M4.invert(this.view, this.invView); M4.perspective(this.proj, this.fov * RAD, aspect, this.near, this.far);
      if (jx || jy) { this.proj[8] -= jx; this.proj[9] -= jy; }   /* an offset of (jx, jy) in clip space after the divide */
      M4.mul(this.viewProj, this.proj, this.view); M4.invert(this.invViewProj, this.viewProj); this.transform.worldPosition(this.position); this.frustum.set(this.viewProj); return this;
    }
    /* a ray through a point of the view: x and y in 0..1 from the top left */
    ray(x, y) { const n = V3.transform([0, 0, 0], [x * 2 - 1, 1 - y * 2, -1], this.invViewProj), f = V3.transform([0, 0, 0], [x * 2 - 1, 1 - y * 2, 1], this.invViewProj); return { origin: n, dir: V3.normalize([0, 0, 0], V3.sub([0, 0, 0], f, n)) }; }
    /* a world point on the view: [x, y] in 0..1 from the top left and the depth, or null behind the eye */
    project(p) { const m = this.viewProj, w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15]; if (w <= 1e-4) return null; return [(m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12]) / w * 0.5 + 0.5, 0.5 - (m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13]) / w * 0.5, w]; }
  }
  Camera.props = { fov: { type: 'float', min: 10, max: 120, step: 1 }, near: { type: 'float', min: 0.05, max: 10, step: 0.05 }, far: { type: 'float', min: 100, max: 20000, step: 100 } };
  registerComponent('Camera', Camera);

  /* ---------- lights: point and spot (the sun belongs to the scene's environment) ---------- */
  class Light extends Component {
    constructor(e) { super(e); this.isLight = true; this.type = 'point'; this.color = [1, 0.9, 0.75]; this.intensity = 40; this.range = 18; this.angle = 50; this.blend = 0.3; }
  }
  Light.props = { type: { type: 'enum', options: ['point', 'spot'] }, color: { type: 'color' }, intensity: { type: 'float', min: 0, max: 2000, step: 1 }, range: { type: 'float', min: 0.5, max: 200, step: 0.5 }, angle: { type: 'float', min: 5, max: 170, step: 1 }, blend: { type: 'float', min: 0, max: 1, step: 0.01 } };
  registerComponent('Light', Light);

  /* ---------- what draws: one mesh, or one mesh many times ---------- */
  class MeshRenderer extends Component {
    constructor(e) { super(e); this.isRenderable = true; this.mesh = null; this.material = null; this.castShadow = true; this.visible = true; this.pickable = true; this.maxDistance = 0; this.shape = null; this.prevWorld = M4.create(); this._pv = 0; this._bv = -1; this._bs = [0, 0, 0, 0]; }
    /* the mesh's bounding sphere in the world */
    sphere() { const t = this.transform, w = t.world; if (this._bv !== t.version || this._bm !== this.mesh) { const b = this.mesh.bounds, c = V3.transform([0, 0, 0], b.center, w); this._bs[0] = c[0]; this._bs[1] = c[1]; this._bs[2] = c[2]; this._bs[3] = b.radius * M4.maxScale(w); this._bv = t.version; this._bm = this.mesh; } return this._bs; }
    onLoad(p) { if (p.shape) this.setShape(p.shape); if (p.materialDef) this.material = new SE.Material(p.materialDef); }
    /* a primitive by description: { kind: 'box' | 'sphere' | 'cylinder' | 'cone' | 'capsule' | 'plane' | 'blob', args: [...] } */
    setShape(s) { this.shape = s; this.mesh = this.engine.assets.primitive(s.kind, s.args); return this; }
    toJSON() { return { shape: this.shape, castShadow: this.castShadow, visible: this.visible, materialDef: this.material && this.material.toJSON ? this.material.toJSON() : null }; }
  }
  MeshRenderer.props = { castShadow: { type: 'bool' }, visible: { type: 'bool' }, maxDistance: { type: 'float', min: 0, max: 5000, step: 10 } };
  registerComponent('MeshRenderer', MeshRenderer);

  class InstancedRenderer extends Component {
    /* lods: [{ mesh, distance, material }] nearest first; one instance buffer serves them all (the group is culled and its level chosen as a whole) */
    constructor(e) { super(e); this.isRenderable = true; this.isInstanced = true; this.mesh = null; this.lods = null; this.material = null; this.instances = null; this.castShadow = true; this.visible = true; this.maxDistance = 0; this.shadowDistance = 0; }
    sphere() { const b = this.instances.bounds; return [b.center[0], b.center[1], b.center[2], b.radius]; }
    /* the level for a distance: { mesh, material } (a level may bring its own material: leaf cards near, a plain crown far) */
    lodAt(dist) { if (!this.lods) return this; for (const l of this.lods) if (dist < l.distance) return l; return this.lods[this.lods.length - 1]; }
  }
  InstancedRenderer.save = false; InstancedRenderer.props = { castShadow: { type: 'bool' }, visible: { type: 'bool' } };
  registerComponent('InstancedRenderer', InstancedRenderer);

  /* ---------- a few ready scripts (the pattern for any other: extend Component, register it, add it to an entity) ---------- */
  class Rotator extends Component { constructor(e) { super(e); this.speed = [0, 45, 0]; } onUpdate(dt) { const s = this.speed, q = Q.fromEuler([0, 0, 0, 1], s[0] * RAD * dt, s[1] * RAD * dt, s[2] * RAD * dt); Q.mul(this.transform.rotation, this.transform.rotation, q); Q.normalize(this.transform.rotation, this.transform.rotation); this.transform.dirty(); } }
  Rotator.props = { speed: { type: 'vec3', step: 1 } }; registerComponent('Rotator', Rotator);
  class Bobber extends Component { constructor(e) { super(e); this.height = 0.5; this.period = 2; this._t = 0; this._y = null; } onStart() { this._y = this.transform.position[1]; } onUpdate(dt) { this._t += dt; const p = this.transform.position; this.transform.setPosition(p[0], this._y + Math.sin(this._t / this.period * TAU) * this.height, p[2]); } }
  Bobber.props = { height: { type: 'float', min: 0, max: 20, step: 0.05 }, period: { type: 'float', min: 0.1, max: 30, step: 0.1 } }; registerComponent('Bobber', Bobber);
  class Orbiter extends Component { constructor(e) { super(e); this.center = [0, 0, 0]; this.radius = 5; this.speed = 30; this.angle = 0; } onUpdate(dt) { this.angle += this.speed * dt; const a = this.angle * RAD; this.transform.setPosition(this.center[0] + Math.sin(a) * this.radius, this.center[1], this.center[2] + Math.cos(a) * this.radius); } }
  Orbiter.props = { center: { type: 'vec3', step: 0.1 }, radius: { type: 'float', min: 0, max: 500, step: 0.1 }, speed: { type: 'float', min: -720, max: 720, step: 1 } }; registerComponent('Orbiter', Orbiter);
  class Lifetime extends Component { constructor(e) { super(e); this.seconds = 5; } onUpdate(dt) { this.seconds -= dt; if (this.seconds <= 0) this.entity.destroy(); } }
  Lifetime.props = { seconds: { type: 'float', min: 0, max: 600, step: 0.1 } }; registerComponent('Lifetime', Lifetime);

  Object.assign(SE, { Transform, Component, Entity, Scene, Camera, Light, MeshRenderer, InstancedRenderer, components: COMPONENTS, registerComponent });

  /* ==== materials: physically based surfaces, and the shaders that write them to the G-buffer, the shadow maps and the
     transparent pass ==== */
  class Material {
    constructor(o) {
      o = o || {}; this.id = uid(); this.name = o.name || 'Material';
      this.albedo = color(o.albedo == null ? '#ffffff' : o.albedo); this.alpha = o.alpha == null ? 1 : o.alpha;
      this.albedoMap = o.albedoMap || null; this.normalMap = o.normalMap || null; this.normalScale = o.normalScale == null ? 1 : o.normalScale; this.roughnessMap = o.roughnessMap || null; this.emissiveMap = o.emissiveMap || null;
      this.roughness = o.roughness == null ? 0.8 : o.roughness; this.metallic = o.metallic || 0;
      this.emissive = color(o.emissive == null ? '#000000' : o.emissive); this.emissiveIntensity = o.emissiveIntensity == null ? 1 : o.emissiveIntensity;
      this.uv = o.uv ? Float32Array.from(o.uv) : new Float32Array([1, 1, 0, 0]);          /* scale x, y and offset x, y */
      this.vertexColors = !!o.vertexColors; this.alphaTest = o.alphaTest || 0; this.twoSided = !!o.twoSided;
      this.model = o.model || 'lit';                    /* 'lit', 'unlit' (emissive only), 'foliage' (light passes through) or 'glass' (reflects by its colour, no diffuse) */
      this.facade = !!o.facade; this.car = !!o.car;                         /* walls drawn by the facade shader: windows with depth and rooms behind them (see the facade chunk) */
      this.blend = o.blend || 'opaque';                 /* 'opaque' goes to the G-buffer; 'alpha' and 'add' are drawn after the lighting */
      this.depthWrite = o.depthWrite; this.polygonOffset = o.polygonOffset || null; this.castShadow = o.castShadow !== false;
      this.wind = o.wind || 0; this.wet = o.wet == null ? 1 : o.wet; this.detail = !!o.detail; this.nightGlow = o.nightGlow || 0; this.worldUV = o.worldUV || 0;
      this.layered = o.layered || null;                 /* { albedo, normal, rough }: array textures; each vertex names its layer in aux.w and its metalness in aux.z */
      this.shader = o.shader || null; this.params = o.params || null;   /* a named forward shader of its own and its uniforms */
      this.order = o.order || 0; this.version = 1;
    }
    get transparent() { return this.blend !== 'opaque'; }
    /* which shader variant this material needs */
    defines(inst) { return { INSTANCED: inst || false, ALBEDO_MAP: !!this.albedoMap, NORMAL_MAP: !!this.normalMap, ROUGH_MAP: !!this.roughnessMap, EMISSIVE_MAP: !!this.emissiveMap, VERTEX_COLOR: this.vertexColors, ALPHA_TEST: this.alphaTest > 0, TWO_SIDED: this.twoSided, WIND: this.wind > 0, DETAIL: this.detail, NIGHT_GLOW: this.nightGlow > 0, WORLD_UV: this.worldUV > 0, LAYERED: !!this.layered, FACADE: this.facade, GROUND_PBR: !!this.groundPBR, CAR: !!this.car }; }
    key(inst) { return (inst ? 1 : 0) | (this.albedoMap ? 2 : 0) | (this.normalMap ? 4 : 0) | (this.roughnessMap ? 8 : 0) | (this.emissiveMap ? 16 : 0) | (this.vertexColors ? 32 : 0) | (this.alphaTest > 0 ? 64 : 0) | (this.twoSided ? 128 : 0) | (this.wind > 0 ? 256 : 0) | (this.detail ? 512 : 0) | (this.nightGlow > 0 ? 1024 : 0) | (this.worldUV > 0 ? 2048 : 0) | (this.layered ? 4096 : 0) | (this.facade ? 8192 : 0) | (this.groundPBR ? 16384 : 0) | (this.car ? 32768 : 0); }
    apply(p) {
      p.set('u_albedo', this.albedo); p.set('u_alpha', this.alpha); p.set('u_roughness', this.roughness); p.set('u_metallic', this.metallic); p.set('u_normalScale', this.normalScale); p.set('u_alphaTest', this.alphaTest);
      p.set('u_emissive', [this.emissive[0] * this.emissiveIntensity, this.emissive[1] * this.emissiveIntensity, this.emissive[2] * this.emissiveIntensity]);
      p.set('u_uvST', this.uv); p.set('u_shadeModel', this.model === 'unlit' ? 0 : this.model === 'foliage' ? 2 : this.model === 'glass' ? 3 : 1); p.set('u_windAmp', this.wind); p.set('u_wetMask', this.wet); p.set('u_nightGlow', this.nightGlow); p.set('u_worldUV', this.worldUV);
      if (this.albedoMap) p.set('u_albedoMap', this.albedoMap); if (this.normalMap) p.set('u_normalMap', this.normalMap); if (this.roughnessMap) p.set('u_roughMap', this.roughnessMap); if (this.emissiveMap) p.set('u_emissiveMap', this.emissiveMap);
      const LA = this.layered || this.groundPBR; if (LA) { p.set('u_albedoArr', LA.albedo); p.set('u_normalArr', LA.normal); p.set('u_roughArr', LA.rough); }
      if (this.params) p.sets(this.params);
    }
    clone(o) { const m = new Material(); Object.assign(m, this, { id: uid(), albedo: this.albedo.slice(), emissive: this.emissive.slice(), uv: this.uv.slice() }); if (o) Object.assign(m, o); return m; }
    toJSON() { return { name: this.name, albedo: this.albedo.slice(), alpha: this.alpha, roughness: this.roughness, metallic: this.metallic, emissive: this.emissive.slice(), emissiveIntensity: this.emissiveIntensity, model: this.model, blend: this.blend, twoSided: this.twoSided, textures: this.textureSet || null, uv: Array.from(this.uv) }; }
  }
  Material.props = { albedo: { type: 'color' }, roughness: { type: 'float', min: 0.02, max: 1, step: 0.01 }, metallic: { type: 'float', min: 0, max: 1, step: 0.01 }, emissive: { type: 'color' }, emissiveIntensity: { type: 'float', min: 0, max: 100, step: 0.1 }, alpha: { type: 'float', min: 0, max: 1, step: 0.01 }, model: { type: 'enum', options: ['lit', 'unlit', 'foliage', 'glass'] }, blend: { type: 'enum', options: ['opaque', 'alpha', 'add'] }, twoSided: { type: 'bool' } };

  /* ---------- the vertex shader of every surface ---------- */
  CHUNKS.facade = ''; CHUNKS.groundpbr = ''; CHUNKS.carpaint = '';   /* filled in by whoever builds a city (the world kit) */
  CHUNKS.wind = `vec3 windSway(vec3 origin, vec3 wp, float weight, float t, vec3 wind) {
  float ph = dot(origin.xz, vec2(0.113, 0.071));
  float gust = sin(t * 0.9 + ph) * 0.6 + sin(t * 2.3 + ph * 2.7) * 0.25;
  float flutter = sin(t * 5.3 + wp.x * 1.7 + wp.y * 2.1 + wp.z * 1.3) * 0.12;
  return vec3(wind.x, 0.0, wind.y) * ((gust + 0.35) * weight * wind.z) + vec3(flutter, flutter * 0.4, -flutter) * weight * wind.z * 0.35;
}`;
  const SURFACE_VS = `
layout(location=0) in vec3 a_position; layout(location=1) in vec3 a_normal; layout(location=2) in vec2 a_uv; layout(location=3) in vec4 a_color; layout(location=4) in vec4 a_aux;
#ifdef INSTANCED
layout(location=5) in vec4 i_m0; layout(location=6) in vec4 i_m1; layout(location=7) in vec4 i_m2; layout(location=8) in vec4 i_color;
#endif
uniform mat4 u_model, u_prevModel, u_viewProj, u_viewProjNJ, u_prevViewProjNJ;
uniform vec4 u_uvST; uniform vec3 u_wind; uniform float u_time, u_prevTime, u_windAmp, u_worldUV;
out vec3 v_wpos; out vec3 v_normal; out vec2 v_uv; out vec4 v_color; out vec4 v_aux; out vec4 v_cur; out vec4 v_prev;
#include <wind>
void main() {
#ifdef INSTANCED
  mat4 inst = mat4(vec4(i_m0.x, i_m1.x, i_m2.x, 0.0), vec4(i_m0.y, i_m1.y, i_m2.y, 0.0), vec4(i_m0.z, i_m1.z, i_m2.z, 0.0), vec4(i_m0.w, i_m1.w, i_m2.w, 1.0));
  mat4 M = u_model * inst, PM = u_prevModel * inst; v_color = vec4(a_color.rgb * mix(vec3(1.0), i_color.rgb, a_color.a), a_color.a * i_color.a);   /* a vertex's alpha says how much of the instance's colour it takes (paint all of it, glass and tyres none) */
#else
  mat4 M = u_model, PM = u_prevModel; v_color = a_color;
#endif
  vec4 wp = M * vec4(a_position, 1.0), pwp = PM * vec4(a_position, 1.0);
#ifdef WIND
  float wgt = a_aux.x * u_windAmp; wp.xyz += windSway(M[3].xyz, wp.xyz, wgt, u_time, u_wind); pwp.xyz += windSway(PM[3].xyz, pwp.xyz, wgt, u_prevTime, u_wind);
#endif
  mat3 m3 = mat3(M); v_normal = normalize(m3 * (a_normal / vec3(dot(m3[0], m3[0]), dot(m3[1], m3[1]), dot(m3[2], m3[2]))));
  v_wpos = wp.xyz; v_aux = a_aux;
#ifdef WORLD_UV
  v_uv = wp.xz / u_worldUV;
#else
  v_uv = a_uv * u_uvST.xy + u_uvST.zw;
#endif
  v_cur = u_viewProjNJ * wp; v_prev = u_prevViewProjNJ * pwp;
  gl_Position = u_viewProj * wp;
}`;

  /* what a surface is at a pixel: read from the material's maps and factors (shared by the G-buffer and the forward pass) */
  CHUNKS.surface = `
#define SURFACE_DECL 1
in vec3 v_wpos; in vec3 v_normal; in vec2 v_uv; in vec4 v_color; in vec4 v_aux; in vec4 v_cur; in vec4 v_prev;
uniform vec3 u_albedo, u_emissive, u_camPos; uniform float u_alpha, u_roughness, u_metallic, u_normalScale, u_alphaTest, u_wetness, u_wetMask, u_night, u_nightGlow, u_shadeModel, u_time, u_lodBias;
uniform sampler2D u_albedoMap, u_normalMap, u_roughMap, u_emissiveMap;
#if defined(LAYERED) || defined(GROUND_PBR)
uniform sampler2DArray u_albedoArr, u_normalArr, u_roughArr;
#endif
struct Surface { vec3 albedo; float alpha; vec3 N; float roughness; float metallic; vec3 emissive; float ao; float model; };
vec3 perturbNormal(vec3 N, vec3 p, vec2 uv, vec3 tn) {
  vec3 dp1 = dFdx(p), dp2 = dFdy(p); vec2 d1 = dFdx(uv), d2 = dFdy(uv);
  vec3 dp2p = cross(dp2, N), dp1p = cross(N, dp1), T = dp2p * d1.x + dp1p * d2.x, B = dp2p * d1.y + dp1p * d2.y;
  float inv = inversesqrt(max(max(dot(T, T), dot(B, B)), 1e-20));
  return normalize(T * (tn.x * inv) + B * (tn.y * inv) + N * tn.z);
}
#ifdef FACADE
#include <facade>
#endif
#ifdef CAR
#include <carpaint>
#endif
#ifdef GROUND_PBR
#include <groundpbr>
#endif
Surface readSurface() {
  Surface s; vec4 base = vec4(u_albedo, u_alpha); s.model = u_shadeModel;
#ifdef ALBEDO_MAP
#ifdef ALPHA_TEST
  base *= texture(u_albedoMap, v_uv);
#else
  base *= texture(u_albedoMap, v_uv, u_lodBias);
#endif
#endif
#ifdef LAYERED
  vec3 luv = vec3(v_uv, floor(v_aux.w + 0.25)); base.rgb *= texture(u_albedoArr, luv, u_lodBias).rgb;
#endif
#ifdef VERTEX_COLOR
  base.rgb *= pow(v_color.rgb, vec3(2.2));
#endif
#ifdef ALPHA_TEST
  float aw = max(fwidth(base.a), 1e-4); base.a = clamp((base.a - u_alphaTest) / aw + 0.5, 0.0, 1.0); if (base.a < 0.5) discard;
#endif
  vec3 N = normalize(v_normal);
#ifdef TWO_SIDED
  if (!gl_FrontFacing) N = -N;
#endif
  s.roughness = u_roughness; s.metallic = u_metallic; s.ao = 1.0;
#ifdef ROUGH_MAP
  s.roughness *= texture(u_roughMap, v_uv).g;
#endif
#ifdef LAYERED
  s.roughness *= texture(u_roughArr, luv).g;
  /* The layer's number carries a half when the layer is metal. It reaches the pixel interpolated, and a whole number
     interpolated comes out a hair under itself as often as over: 4.9999995 has a fraction of all but one. Read without
     a margin, patches of road and wall turned half metal (darker, glossier) and back as each frame's samples shifted. */
  s.metallic = fract(v_aux.w + 0.25) > 0.5 ? 0.45 : 0.0;
  { vec3 tn = texture(u_normalArr, luv).xyz * 2.0 - 1.0; tn.xy *= u_normalScale; N = perturbNormal(N, v_wpos, v_uv, tn); }
#endif
#ifdef NORMAL_MAP
  vec3 tn = texture(u_normalMap, v_uv).xyz * 2.0 - 1.0; tn.xy *= u_normalScale; N = perturbNormal(N, v_wpos, v_uv, tn);
#endif
  s.emissive = u_emissive;
#ifdef FACADE
  facade(s, base, N, normalize(v_normal));
#endif
#ifdef CAR
  carPaint(s, base, N);
#endif
#ifdef GROUND_PBR
  groundPBR(s, base, N);
#endif
#ifdef EMISSIVE_MAP
  s.emissive *= texture(u_emissiveMap, v_uv).rgb;
#endif
#ifdef NIGHT_GLOW
  /* lit windows after dark: the vertex colour's alpha says which panes are on */
  s.emissive += vec3(1.0, 0.78, 0.45) * (u_nightGlow * u_night * step(0.5, v_color.a));
#endif
#ifdef DETAIL
  /* close to a photograph of the ground, fine grain it does not hold: two octaves of noise, fading out with distance */
  { float dd = distance(v_wpos, u_camPos), k = 1.0 - smoothstep(12.0, 90.0, dd);
    /* each octave is let go where a pixel covers more ground than one of its grains: past that it is noise the pixel grid cannot hold, and it sparkles */
    float fw = max(length(dFdx(v_wpos.xz)), length(dFdy(v_wpos.xz))), k1 = k * (1.0 - smoothstep(0.35, 0.9, fw * 9.0)), k2 = k * (1.0 - smoothstep(0.35, 0.9, fw * 31.0));
    float n = (vnoise(v_wpos.xz * 9.0) - 0.5) * 0.6 * k1 + (vnoise(v_wpos.xz * 31.0) - 0.5) * 0.4 * k2; base.rgb *= 1.0 + n * 0.34; s.roughness = clamp(s.roughness + n * 0.25, 0.05, 1.0); }
#endif
  /* rain: surfaces that face the sky darken and turn glossy, and water stands in the low places */
  { float up = smoothstep(0.35, 0.9, N.y) * u_wetness * u_wetMask;
    if (up > 0.001) { float pud = up * smoothstep(0.52, 0.68, fbm(v_wpos.xz * 0.19)); base.rgb *= mix(1.0, 0.58, up); s.roughness = mix(mix(s.roughness, 0.16, up * 0.85), 0.035, pud); N = normalize(mix(N, vec3(0.0, 1.0, 0.0), pud * 0.9)); } }
  s.albedo = base.rgb; s.alpha = base.a; s.N = N; s.roughness = clamp(s.roughness, 0.03, 1.0);
  return s;
}`;

  const GBUFFER_FS = `
#include <common>
#include <surface>
layout(location=0) out vec4 o_albedo; layout(location=1) out vec4 o_normal; layout(location=2) out vec4 o_emissive; layout(location=3) out vec4 o_velocity;
void main() {
  Surface s = readSurface();
  o_albedo = vec4(s.albedo, s.metallic);
  /* specular anti-aliasing: where the surface turns faster than the pixel grid can show (a car's shoulder far off, a
     pipe), a sharp highlight would flicker from frame to frame; its roughness is widened by how far the normal turns
     across the pixel (Kaplanyan and Tokuyoshi's filter, on the geometry's own normal) */
  /* the same for the normal the surface is shaded with, which a normal map bends from pixel to pixel: a rough road's grains glinted one frame and not the next */
  vec3 gN = normalize(v_normal), dNx = dFdx(gN), dNy = dFdy(gN), dSx = dFdx(s.N), dSy = dFdy(s.N); float kern = min(0.5 * max(dot(dNx, dNx) + dot(dNy, dNy), dot(dSx, dSx) + dot(dSy, dSy)), 0.18), al = s.roughness * s.roughness;
  o_normal = vec4(octEncode(s.N), sqrt(sqrt(clamp(al * al + kern, 0.0, 1.0))), s.model / 3.0);
  o_emissive = vec4(s.model < 0.5 ? s.albedo + s.emissive : s.emissive, s.ao);
  o_velocity = vec4((v_cur.xy / v_cur.w - v_prev.xy / v_prev.w) * 0.5, 0.0, 1.0);
}`;

  /* depth only, from the sun: positions (with wind) and, for cut-out materials, the texture's alpha */
  const SHADOW_VS = `
layout(location=0) in vec3 a_position; layout(location=2) in vec2 a_uv; layout(location=4) in vec4 a_aux;
#ifdef INSTANCED
layout(location=5) in vec4 i_m0; layout(location=6) in vec4 i_m1; layout(location=7) in vec4 i_m2;
#endif
uniform mat4 u_model, u_viewProj; uniform vec4 u_uvST; uniform vec3 u_wind; uniform float u_time, u_windAmp;
out vec2 v_uv;
#include <wind>
void main() {
#ifdef INSTANCED
  mat4 M = u_model * mat4(vec4(i_m0.x, i_m1.x, i_m2.x, 0.0), vec4(i_m0.y, i_m1.y, i_m2.y, 0.0), vec4(i_m0.z, i_m1.z, i_m2.z, 0.0), vec4(i_m0.w, i_m1.w, i_m2.w, 1.0));
#else
  mat4 M = u_model;
#endif
  vec4 wp = M * vec4(a_position, 1.0);
#ifdef WIND
  wp.xyz += windSway(M[3].xyz, wp.xyz, a_aux.x * u_windAmp, u_time, u_wind);
#endif
  v_uv = a_uv * u_uvST.xy + u_uvST.zw; gl_Position = u_viewProj * wp;
}`;
  const SHADOW_FS = `
in vec2 v_uv; uniform sampler2D u_albedoMap; uniform float u_alphaTest, u_alpha;
void main() {
#ifdef ALPHA_TEST
  if (texture(u_albedoMap, v_uv).a * u_alpha < u_alphaTest) discard;
#endif
}`;

  /* the transparent pass: the same surface, lit in one go (sun with shadows, sky light, haze) and blended over the picture */
  const FORWARD_FS = `
#include <common>
#include <surface>
#include <lighting>
out vec4 o_color;
void main() {
  Surface s = readSurface();
  vec3 V = normalize(u_camPos - v_wpos); float viewZ = (u_view * vec4(v_wpos, 1.0)).z * -1.0;
  vec3 c = shadeSurface(s.albedo, s.N, V, s.roughness, s.metallic, 1.0, v_wpos, viewZ, gl_FragCoord.xy, s.model, vec3(0.0), vec4(0.0)) + s.emissive;
  c = applyFog(c, v_wpos);
  o_color = vec4(c, s.alpha);
}`;

  /* forward shaders with a look of their own, by name: SE.shaders.forward.glow = { fs } (the vertex shader is the surface's) */
  SE.shaders = { surfaceVS: SURFACE_VS, gbufferFS: GBUFFER_FS, shadowVS: SHADOW_VS, shadowFS: SHADOW_FS, forward: { pbr: { fs: FORWARD_FS } } };
  SE.Material = Material;

  /* ==== the sky: a physical atmosphere that colours the sun, the sky and the haze, and lights the scene ==== */
  /* Rayleigh and Mie scattering with ozone, integrated along each view ray (single scattering plus an isotropic term for
     the light that scatters more than once), the way Unreal's Sky Atmosphere does it, at a browser's budget: the sky is
     integrated into a small panorama (the sky-view table) whenever the sun moves, and everything else reads the table.
     From it come a cube map filtered by roughness for reflections, and nine spherical harmonics for the sky's diffuse
     light. The same integral runs here in JavaScript for the sun's colour through the air and for the harmonics. */
  const ATM = { RE: 6360e3, RA: 6460e3, BR: [5.802e-6, 13.558e-6, 33.1e-6], HR: 8000, HM: 1200, BO: [0.650e-6, 1.881e-6, 0.085e-6], MIE: 3.996e-6, G: 0.8, SUN_E: 20, ALT: 150, MS: 0.32 };
  CHUNKS.atmosphere = `
const float ATM_RE = 6360.0e3, ATM_RA = 6460.0e3, ATM_HR = 8000.0, ATM_HM = 1200.0;
const vec3 ATM_BR = vec3(5.802e-6, 13.558e-6, 33.1e-6), ATM_BO = vec3(0.650e-6, 1.881e-6, 0.085e-6);
uniform float u_mie;
vec2 atmSphere(vec3 o, vec3 d, float r) { float b = dot(o, d), c = dot(o, o) - r * r, h = b * b - c; if (h < 0.0) return vec2(-1.0); h = sqrt(h); return vec2(-b - h, -b + h); }
vec3 atmDensity(float h) { h = max(h, 0.0); return vec3(exp(-h / ATM_HR), exp(-h / ATM_HM), max(0.0, 1.0 - abs(h - 25000.0) / 15000.0)); }
vec3 atmExt(vec3 od) { return ATM_BR * od.x + vec3(u_mie * 1.11) * od.y + ATM_BO * od.z; }
vec3 atmOptical(vec3 o, vec3 d, float len) { const int N = 6; float ds = len / float(N); vec3 od = vec3(0.0); for (int i = 0; i < N; i++) { vec3 p = o + d * ((float(i) + 0.5) * ds); od += atmDensity(length(p) - ATM_RE) * ds; } return od; }
/* radiance from direction dir for a sun of unit irradiance at sun */
vec3 atmosphere(vec3 dir, vec3 sun) {
  vec3 o = vec3(0.0, ATM_RE + ${ATM.ALT.toFixed(1)}, 0.0); vec2 ta = atmSphere(o, dir, ATM_RA), tg = atmSphere(o, dir, ATM_RE);
  float tmax = ta.y; if (tg.x > 0.0) tmax = tg.x;
  const int N = 22; vec3 od = vec3(0.0), sumR = vec3(0.0), sumM = vec3(0.0); float tp = 0.0;
  float mu = dot(dir, sun), pR = 3.0 / (16.0 * PI) * (1.0 + mu * mu), g = ${ATM.G.toFixed(2)}, pM = 3.0 / (8.0 * PI) * ((1.0 - g * g) * (1.0 + mu * mu)) / ((2.0 + g * g) * pow(1.0 + g * g - 2.0 * g * mu, 1.5));
  for (int i = 0; i < N; i++) {
    float f = (float(i) + 1.0) / float(N), t = tmax * f * f, ds = t - tp, tm = (t + tp) * 0.5; tp = t;
    vec3 p = o + dir * tm, dn = atmDensity(length(p) - ATM_RE); od += dn * ds;
    vec2 gl = atmSphere(p, sun, ATM_RE); if (gl.x > 0.0) continue;                 /* the planet shades this stretch of air */
    vec3 odl = atmOptical(p, sun, atmSphere(p, sun, ATM_RA).y), T = exp(-atmExt(od + odl));
    sumR += T * dn.x * ds; sumM += T * dn.y * ds;
  }
  return sumR * ATM_BR * (pR + ${ATM.MS.toFixed(2)} / (4.0 * PI)) + sumM * u_mie * (pM + ${ATM.MS.toFixed(2)} / (4.0 * PI));
}`;
  CHUNKS.sky = `
uniform sampler2D u_skyLUT;
vec2 skyUV(vec3 d) { float az = atan(d.z, d.x), el = asin(clamp(d.y, -1.0, 1.0)); return vec2(az / (2.0 * PI) + 0.5, 0.5 + 0.5 * sign(el) * sqrt(abs(el) / (PI * 0.5))); }
vec3 skyDir(vec2 uv) { float az = (uv.x - 0.5) * 2.0 * PI, s = uv.y * 2.0 - 1.0, el = sign(s) * s * s * PI * 0.5; return vec3(cos(el) * cos(az), sin(el), cos(el) * sin(az)); }
vec3 skyRadiance(vec3 d) { return textureLod(u_skyLUT, skyUV(d), 0.0).rgb; }   /* an explicit level: the table has one, and the angle its coordinate comes from jumps where east meets west */`;

  const SKY_LUT_FS = `
#include <common>
#include <atmosphere>
#include <sky>
in vec2 v_uv; out vec4 o_color;
uniform vec3 u_sunDir, u_moonDir; uniform float u_sunE, u_moonE; uniform vec3 u_airglow;
void main() {
  vec3 d = skyDir(v_uv), c = vec3(0.0);
  if (u_sunE > 0.0) c += atmosphere(d, u_sunDir) * u_sunE;
  if (u_moonE > 0.0) c += atmosphere(d, u_moonDir) * u_moonE;
  o_color = vec4(c + u_airglow, 1.0);
}`;
  /* one face of the cube the scene reflects: the sky above, the lit ground below */
  const SKY_CUBE_FS = `
#include <common>
#include <sky>
in vec2 v_uv; out vec4 o_color; uniform int u_face; uniform vec3 u_ground;
vec3 faceDir(int f, vec2 uv) { float u = uv.x * 2.0 - 1.0, v = uv.y * 2.0 - 1.0; return normalize(f == 0 ? vec3(1.0, -v, -u) : f == 1 ? vec3(-1.0, -v, u) : f == 2 ? vec3(u, 1.0, v) : f == 3 ? vec3(u, -1.0, -v) : f == 4 ? vec3(u, -v, 1.0) : vec3(-u, -v, -1.0)); }
void main() { vec3 d = faceDir(u_face, v_uv); vec3 sky = skyRadiance(vec3(d.x, max(d.y, 0.0), d.z)); o_color = vec4(mix(u_ground, sky, smoothstep(-0.06, 0.02, d.y)), 1.0); }`;
  /* the cube filtered for one roughness (GGX importance sampling against the mip chain) */
  const SKY_PREFILTER_FS = `
#include <common>
in vec2 v_uv; out vec4 o_color; uniform int u_face; uniform float u_rough, u_res; uniform samplerCube u_src;
vec3 faceDir(int f, vec2 uv) { float u = uv.x * 2.0 - 1.0, v = uv.y * 2.0 - 1.0; return normalize(f == 0 ? vec3(1.0, -v, -u) : f == 1 ? vec3(-1.0, -v, u) : f == 2 ? vec3(u, 1.0, v) : f == 3 ? vec3(u, -1.0, -v) : f == 4 ? vec3(u, -v, 1.0) : vec3(-u, -v, -1.0)); }
float rvdc(uint b) { b = (b << 16u) | (b >> 16u); b = ((b & 0x55555555u) << 1u) | ((b & 0xAAAAAAAAu) >> 1u); b = ((b & 0x33333333u) << 2u) | ((b & 0xCCCCCCCCu) >> 2u); b = ((b & 0x0F0F0F0Fu) << 4u) | ((b & 0xF0F0F0F0u) >> 4u); b = ((b & 0x00FF00FFu) << 8u) | ((b & 0xFF00FF00u) >> 8u); return float(b) * 2.3283064365386963e-10; }
void main() {
  vec3 N = faceDir(u_face, v_uv), up = abs(N.y) < 0.999 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0), T = normalize(cross(up, N)), B = cross(N, T);
  float a = u_rough * u_rough; vec3 sum = vec3(0.0); float w = 0.0; const uint S = 40u;
  for (uint i = 0u; i < S; i++) {
    vec2 xi = vec2(float(i) / float(S), rvdc(i)); float ph = 2.0 * PI * xi.x, ct = sqrt((1.0 - xi.y) / (1.0 + (a * a - 1.0) * xi.y)), st = sqrt(1.0 - ct * ct);
    vec3 H = normalize(T * (st * cos(ph)) + B * (st * sin(ph)) + N * ct), L = normalize(2.0 * dot(N, H) * H - N); float nl = dot(N, L); if (nl <= 0.0) continue;
    float nh = max(dot(N, H), 0.0), d = (nh * a * a - nh) * nh + 1.0, D = a * a / (PI * d * d), pdf = D * 0.25 + 1e-4, mip = 0.5 * log2(6.0 * u_res * u_res / (float(S) * pdf * 4.0 * PI)) + 1.0;
    sum += textureLod(u_src, L, max(mip, 0.0)).rgb * nl; w += nl;
  }
  o_color = vec4(sum / max(w, 1e-4), 1.0);
}`;

  /* the atmosphere again, in JavaScript: the sun's colour at the ground, and the sky's radiance for the harmonics */
  const AtmJS = {
    sphere(o, d, r) { const b = o[0] * d[0] + o[1] * d[1] + o[2] * d[2], c = o[0] * o[0] + o[1] * o[1] + o[2] * o[2] - r * r, h = b * b - c; if (h < 0) return [-1, -1]; const s = Math.sqrt(h); return [-b - s, -b + s]; },
    dens(h) { h = Math.max(h, 0); return [Math.exp(-h / ATM.HR), Math.exp(-h / ATM.HM), Math.max(0, 1 - Math.abs(h - 25000) / 15000)]; },
    optical(o, d, len, n) { const ds = len / n, od = [0, 0, 0]; for (let i = 0; i < n; i++) { const t = (i + 0.5) * ds, dn = AtmJS.dens(Math.hypot(o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t) - ATM.RE); od[0] += dn[0] * ds; od[1] += dn[1] * ds; od[2] += dn[2] * ds; } return od; },
    trans(od, mie) { return [0, 1, 2].map(k => Math.exp(-(ATM.BR[k] * od[0] + mie * 1.11 * od[1] + ATM.BO[k] * od[2]))); },
    /* how much of the sun's light reaches the ground from direction sun */
    sunTransmittance(sun, mie) { const o = [0, ATM.RE + ATM.ALT, 0]; if (AtmJS.sphere(o, sun, ATM.RE)[0] > 0) return [0, 0, 0]; return AtmJS.trans(AtmJS.optical(o, sun, AtmJS.sphere(o, sun, ATM.RA)[1], 24), mie); },
    radiance(dir, sun, mie) {
      const o = [0, ATM.RE + ATM.ALT, 0], ta = AtmJS.sphere(o, dir, ATM.RA), tg = AtmJS.sphere(o, dir, ATM.RE); let tmax = ta[1]; if (tg[0] > 0) tmax = tg[0];
      const N = 14, od = [0, 0, 0], sR = [0, 0, 0], sM = [0, 0, 0]; let tp = 0; const mu = dir[0] * sun[0] + dir[1] * sun[1] + dir[2] * sun[2], g = ATM.G;
      const pR = 3 / (16 * Math.PI) * (1 + mu * mu) + ATM.MS / (4 * Math.PI), pM = 3 / (8 * Math.PI) * ((1 - g * g) * (1 + mu * mu)) / ((2 + g * g) * Math.pow(1 + g * g - 2 * g * mu, 1.5)) + ATM.MS / (4 * Math.PI);
      for (let i = 0; i < N; i++) { const f = (i + 1) / N, t = tmax * f * f, ds = t - tp, tm = (t + tp) / 2; tp = t; const p = [o[0] + dir[0] * tm, o[1] + dir[1] * tm, o[2] + dir[2] * tm], dn = AtmJS.dens(Math.hypot(p[0], p[1], p[2]) - ATM.RE);
        od[0] += dn[0] * ds; od[1] += dn[1] * ds; od[2] += dn[2] * ds; if (AtmJS.sphere(p, sun, ATM.RE)[0] > 0) continue;
        const ol = AtmJS.optical(p, sun, AtmJS.sphere(p, sun, ATM.RA)[1], 4), T = AtmJS.trans([od[0] + ol[0], od[1] + ol[1], od[2] + ol[2]], mie);
        for (let k = 0; k < 3; k++) { sR[k] += T[k] * dn[0] * ds; sM[k] += T[k] * dn[1] * ds; } }
      return [0, 1, 2].map(k => sR[k] * ATM.BR[k] * pR + sM[k] * mie * pM);
    },
  };

  /* where the sun stands: altitude and azimuth in degrees (from north, clockwise) for a time and a place (NOAA's low precision formulas) */
  function solarPosition(date, lat, lon) {
    const d = date.getTime() / 86400000 - 10957.5, g = RAD * (357.529 + 0.98560028 * d), q = 280.459 + 0.98564736 * d;
    const L = RAD * (q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)), e = RAD * (23.439 - 0.00000036 * d);
    const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)), dec = Math.asin(Math.sin(e) * Math.sin(L));
    const gmst = ((18.697374558 + 24.06570982441908 * d) % 24 + 24) % 24, H = RAD * (gmst * 15 + lon) - ra, phi = RAD * lat;
    const alt = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
    const az = Math.atan2(-Math.sin(H), Math.tan(dec) * Math.cos(phi) - Math.sin(phi) * Math.cos(H));
    return { alt: alt * DEG, az: (az * DEG + 360) % 360 };
  }
  /* a direction in the engine's axes (+X east, +Y up, +Z south) from an altitude and an azimuth in degrees */
  const sunVector = (alt, az) => { const ca = Math.cos(alt * RAD); return [Math.sin(az * RAD) * ca, Math.sin(alt * RAD), -Math.cos(az * RAD) * ca]; };

  class Sky {
    constructor(dev) {
      this.dev = dev; this.version = -1; this.size = 64; this.levels = 6;
      this.lut = dev.texture({ w: 256, h: 128, format: 'rgba16f', wrapS: 'repeat', wrapT: 'clamp', name: 'sky-view' }); this.lutT = dev.target({ color: [this.lut] });
      this.raw = dev.texture({ cube: true, w: this.size, h: this.size, format: 'rgba16f', mips: true, name: 'sky-cube' });
      this.env = dev.texture({ cube: true, w: this.size, h: this.size, format: 'rgba16f', levels: this.levels, mips: true, name: 'sky-reflection' });
      this.fb = dev.target({ color: [] });
      this.sh = new Float32Array(27); this.lightDir = V3.create(0.4, 0.75, 0.5); this.lightColor = [1, 1, 1]; this.sunVisible = 1; this.night = 0; this.elevation = 45; this.ambient = [0.3, 0.3, 0.3];
      const fib = []; const N = 192; for (let i = 0; i < N; i++) { const y = 1 - 2 * (i + 0.5) / N, r = Math.sqrt(1 - y * y), a = i * 2.399963229728653; fib.push([Math.cos(a) * r, y, Math.sin(a) * r]); } this._dirs = fib;
    }
    /* recompute when the environment changed: returns true if it did */
    update(env) {
      if (env.version === this.version) return false; this.version = env.version; const dev = this.dev, gl = dev.gl;
      const sun = V3.normalize([0, 0, 0], env.sunDir), el = Math.asin(clamp(sun[1], -1, 1)) * DEG, mie = ATM.MIE * env.turbidity; this.elevation = el; this.mie = mie;
      const night = smoothstep(2, -6, el), moonK = smoothstep(-3, -9, el), moon = V3.normalize([0, 0, 0], [-sun[0], 0.62, -sun[2]]);
      const sunE = ATM.SUN_E * env.sunIntensity, moonE = ATM.SUN_E * 0.011 * moonK;
      env.night = night; this.night = night;
      if (el > -3) { const d = V3.normalize([0, 0, 0], [sun[0], Math.max(sun[1], 0.03), sun[2]]), T = AtmJS.sunTransmittance(d, mie), k = sunE * smoothstep(-1.2, 0.8, el); V3.copy(this.lightDir, d); this.lightColor = [T[0] * k, T[1] * k, T[2] * k]; this.sunVisible = smoothstep(-1.2, 0.3, el); }
      else { const T = AtmJS.sunTransmittance(moon, mie); V3.copy(this.lightDir, moon); this.lightColor = [T[0] * moonE * 0.8, T[1] * moonE * 0.95, T[2] * moonE * 1.25]; this.sunVisible = 0; }
      this.sunDir = sun; this.moonDir = moon; this.moonK = moonK;
      const airglow = [0.004 * night, 0.006 * night, 0.011 * night];
      /* the sky-view table */
      dev.bind(this.lutT); dev.state({ depthTest: false, cull: 'none' });
      const pl = dev.program('skylut', CHUNKS.fullscreen_vs, SKY_LUT_FS); pl.use().sets({ u_sunDir: sun, u_moonDir: moon, u_sunE: el > -19 ? sunE : 0, u_moonE: moonE, u_mie: mie, u_airglow: airglow }); dev.fullscreen(pl);
      /* the ground the sky sees: lit by the sun and by the sky above it */
      const up = AtmJS.radiance([0, 1, 0], sun, mie).map(v => v * sunE * 2.2 * (el > -19 ? 1 : 0) + 0.002 * night), nl = Math.max(0, this.lightDir[1]);
      const ground = [0, 1, 2].map(k => env.groundAlbedo[k] * (this.lightColor[k] * nl / Math.PI + up[k]) * env.skyIntensity);
      /* the cube and its filtered levels */
      const pc = dev.program('skycube', CHUNKS.fullscreen_vs, SKY_CUBE_FS); pc.use().sets({ u_skyLUT: this.lut, u_ground: ground });
      for (let f = 0; f < 6; f++) { this.fb.attach([{ tex: this.raw, face: f, level: 0 }], null); dev.bind(this.fb, [0, 0, this.size, this.size]); pc.set('u_face', f); dev.fullscreen(pc); }
      this.raw.genMips();
      const pp = dev.program('skyprefilter', CHUNKS.fullscreen_vs, SKY_PREFILTER_FS); pp.use().sets({ u_src: this.raw, u_res: this.size });
      for (let l = 0; l < this.levels; l++) { const s = this.size >> l; pp.set('u_rough', Math.max(0.02, l / (this.levels - 1))); for (let f = 0; f < 6; f++) { this.fb.attach([{ tex: this.env, face: f, level: l }], null); dev.bind(this.fb, [0, 0, s, s]); pp.set('u_face', f); dev.fullscreen(pp); } }
      void gl;
      /* nine harmonics of the sky and ground, already folded with the cosine lobe and divided by pi */
      const L = new Float64Array(27), dirs = this._dirs, w = 4 * Math.PI / dirs.length;
      for (const d of dirs) {
        let c; if (d[1] >= 0) { c = el > -19 ? AtmJS.radiance(d, sun, mie).map(v => v * sunE) : [0, 0, 0]; if (moonE > 0) { const m = AtmJS.radiance(d, moon, mie); c = c.map((v, k) => v + m[k] * moonE); } c = c.map((v, k) => (v + airglow[k]) * env.skyIntensity); } else c = ground;
        const x = d[0], y = d[1], z = d[2], Y = [0.282095, 0.488603 * y, 0.488603 * z, 0.488603 * x, 1.092548 * x * y, 1.092548 * y * z, 0.315392 * (3 * z * z - 1), 1.092548 * x * z, 0.546274 * (x * x - y * y)];
        for (let i = 0; i < 9; i++) for (let k = 0; k < 3; k++) L[i * 3 + k] += c[k] * Y[i] * w;
      }
      const K = [0.282095, 0.488603 * 2 / 3, 0.488603 * 2 / 3, 0.488603 * 2 / 3, 1.092548 / 4, 1.092548 / 4, 0.315392 / 4, 1.092548 / 4, 0.546274 / 4];
      for (let i = 0; i < 9; i++) for (let k = 0; k < 3; k++) this.sh[i * 3 + k] = L[i * 3 + k] * K[i];
      this.ambient = [this.sh[0], this.sh[1], this.sh[2]]; this.skyIntensity = env.skyIntensity;
      return true;
    }
    dispose() { [this.lut, this.raw, this.env].forEach(t => t.dispose()); this.lutT.dispose(); this.fb.dispose(); }
  }
  Object.assign(SE, { Sky, solarPosition, sunVector, Atmosphere: AtmJS, ATM });

  /* ==== the lighting shaders: what the deferred pass and the transparent pass share, and the screen-space passes ==== */
  const CL = { X: 16, Y: 9, Z: 12, GW: 64, IW: 256, IH: 128, MAX: 256, PER: 24, NEAR: 0.5, FAR: 400 };   /* the grid the local lights are sorted into */
  CHUNKS.depthtools = `
uniform vec4 u_projInfo; uniform vec2 u_nearFar;
float linZ(float d) { float z = d * 2.0 - 1.0; return 2.0 * u_nearFar.x * u_nearFar.y / (u_nearFar.y + u_nearFar.x - z * (u_nearFar.y - u_nearFar.x)); }
vec3 vpos(vec2 uv, float lz) { return vec3((uv * 2.0 - 1.0 + u_projInfo.zw) * u_projInfo.xy * lz, -lz); }
/* the depth buffer read at a whole texel, and that texel's centre (a half-size pass sits on the seams between texels) */
uniform sampler2D u_depth; uniform vec2 u_fullRes;
float depthAt(inout vec2 uv) { ivec2 q = clamp(ivec2(uv * u_fullRes), ivec2(0), ivec2(u_fullRes) - 1); uv = (vec2(q) + 0.5) / u_fullRes; return texelFetch(u_depth, q, 0).r; }`;

  CHUNKS.lighting = `
#ifndef PI
#define PI 3.14159265359
#endif
uniform mat4 u_view; uniform vec3 u_sunDir, u_sunColor; uniform vec3 u_sh[9]; uniform samplerCube u_envMap; uniform float u_envLevels;
uniform sampler2DShadow u_shadowMap; uniform mat4 u_shadowMat[4]; uniform vec4 u_splits, u_cascadeTexel, u_shadowParams;
uniform sampler2D u_lightData, u_clusterGrid, u_clusterIdx; uniform vec4 u_clusterParams; uniform vec2 u_invRes;
uniform vec4 u_fog; uniform float u_frame;
#ifndef SURFACE_DECL
uniform vec3 u_camPos;
#endif
#include <sky>
float D_GGX(float NoH, float a) { float a2 = a * a, d = (NoH * a2 - NoH) * NoH + 1.0; return a2 / (PI * d * d + 1e-7); }
float V_Smith(float NoV, float NoL, float a) { return 0.5 / max(mix(2.0 * NoL * NoV, NoL + NoV, a), 1e-4); }
vec3 F_Schlick(vec3 f0, float VoH) { float f = pow(1.0 - VoH, 5.0); return f + f0 * (1.0 - f); }
/* the specular lobe of the sky's reflection, without a lookup table (Karis) */
vec3 envBRDF(vec3 f0, float rough, float NoV) { const vec4 c0 = vec4(-1.0, -0.0275, -0.572, 0.022), c1 = vec4(1.0, 0.0425, 1.04, -0.04); vec4 r = rough * c0 + c1; float a004 = min(r.x * r.x, exp2(-9.28 * NoV)) * r.x + r.y; vec2 AB = vec2(-1.04, 1.04) * a004 + r.zw; return f0 * AB.x + AB.y; }
vec3 shIrradiance(vec3 n) { return max(vec3(0.0), u_sh[0] + u_sh[1] * n.y + u_sh[2] * n.z + u_sh[3] * n.x + u_sh[4] * (n.x * n.y) + u_sh[5] * (n.y * n.z) + u_sh[6] * (3.0 * n.z * n.z - 1.0) + u_sh[7] * (n.x * n.z) + u_sh[8] * (n.x * n.x - n.y * n.y)); }
/* occlusion that lets coloured surfaces bounce some light back (Jimenez) */
vec3 multiBounce(float ao, vec3 albedo) { vec3 a = 2.0404 * albedo - 0.3324, b = -4.7951 * albedo + 0.6417, c = 2.7552 * albedo + 0.6903; return max(vec3(ao), ((ao * a + b) * ao + c) * ao); }
float lnoise(vec2 p, float frame) { p += 5.588238 * mod(frame, 64.0); return fract(52.9829189 * fract(0.06711056 * p.x + 0.00583715 * p.y)); }

/* the sun's shadow: four cascades in one atlas, each sampled on a disc turned by noise the temporal filter averages */
float g_contact = 1.0;   /* the sun's light kept back by something too small or too near for the shadow maps (set by the lighting pass) */
float g_cloud = 1.0;     /* and by the clouds overhead */
float shadowTaps(int c, vec3 wpos, vec3 N, float nl, float ang) {
  mat4 M = u_shadowMat[c]; float texel = u_cascadeTexel[c]; vec4 sc = M * vec4(wpos + N * (texel * (1.2 + 2.2 * (1.0 - nl))), 1.0);
  vec2 base = vec2(float(c & 1), float(c >> 1)) * 0.5; float m = u_shadowParams.x * 1.5, rad = clamp(u_shadowParams.y / texel, 1.0, 5.0) * u_shadowParams.x, s = 0.0;
  if (sc.x < base.x || sc.y < base.y || sc.x > base.x + 0.5 || sc.y > base.y + 0.5) return 1.0;   /* outside what this cascade drew */
  /* The surface's own slope in the shadow map: how its depth changes from one tap of the disc to the next. Each tap is
     compared at the depth the surface has there. Compared at the centre's depth instead, the taps on the side of the
     disc that lies nearer the sun found the surface itself in their way, and every lit surface that did not face the
     sun squarely carried a faint, shifting grain of its own shadow. */
  vec3 ru = vec3(M[0][0], M[1][0], M[2][0]), rv = vec3(M[0][1], M[1][1], M[2][1]), rz = vec3(M[0][2], M[1][2], M[2][2]);
  float D = dot(N, cross(ru, rv)), gmax = 5.0 * length(rz) / max(length(ru), 1e-9); vec2 g = abs(D) > 1e-12 ? clamp(vec2(dot(rz, cross(rv, N)), dot(rz, cross(N, ru))) / D, vec2(-gmax), vec2(gmax)) : vec2(0.0);
  /* an explicit level: the atlas has one, and a lookup that asks for the screen's gradients may not sit inside a branch on every driver */
  for (int i = 0; i < 8; i++) { float r = sqrt((float(i) + 0.5) / 8.0), th = float(i) * 2.39996323 + ang; vec2 o = vec2(cos(th), sin(th)) * (r * rad); s += textureLod(u_shadowMap, vec3(clamp(sc.xy + o, base + m, base + 0.5 - m), sc.z + dot(g, o) - 0.00004), 0.0); }
  return s * 0.125;
}
float sunShadow(vec3 wpos, vec3 N, float viewZ, vec2 frag) {
  if (u_shadowParams.z < 0.5 || viewZ >= u_splits.w) return 1.0;
  float ang = lnoise(frag, u_frame) * 6.2831853, nl = clamp(dot(N, u_sunDir), 0.0, 1.0);
  int c = viewZ < u_splits.x ? 0 : viewZ < u_splits.y ? 1 : viewZ < u_splits.z ? 2 : 3;
  float far = c == 0 ? u_splits.x : c == 1 ? u_splits.y : c == 2 ? u_splits.z : u_splits.w, s = shadowTaps(c, wpos, N, nl, ang);
  /* the last eighth of a cascade is blended into the next one: where they met, one was picked by a throw of noise each
     frame, and the two do not agree on how sharp a shadow is, so the seam shimmered */
  float t = smoothstep(far * 0.875, far, viewZ); if (c < 3 && t > 0.0) s = mix(s, shadowTaps(c + 1, wpos, N, nl, ang), t);
  return mix(s, 1.0, smoothstep(u_splits.w * 0.88, u_splits.w, viewZ));
}

/* point and spot lights, found through the cluster the pixel falls in */
vec3 localLights(vec3 diff, vec3 f0, vec3 N, vec3 V, float a, float NoV, vec3 wpos, float viewZ, vec2 frag) {
  if (u_clusterParams.z < 0.5) return vec3(0.0);
  ivec2 tile = ivec2(clamp(frag * u_invRes, 0.0, 0.9999) * vec2(${CL.X}.0, ${CL.Y}.0));
  int slice = clamp(int(log(max(viewZ, u_clusterParams.x) / u_clusterParams.x) * u_clusterParams.y), 0, ${CL.Z - 1});
  int ci = tile.x + tile.y * ${CL.X} + slice * ${CL.X * CL.Y};
  vec2 oc = texelFetch(u_clusterGrid, ivec2(ci % ${CL.GW}, ci / ${CL.GW}), 0).rg; int off = int(oc.x + 0.5), cnt = int(oc.y + 0.5); vec3 sum = vec3(0.0);
  for (int i = 0; i < ${CL.PER}; i++) {
    if (i >= cnt) break; int k = off + i, li = int(texelFetch(u_clusterIdx, ivec2(k % ${CL.IW}, k / ${CL.IW}), 0).r + 0.5);
    vec4 pr = texelFetch(u_lightData, ivec2(0, li), 0), cc = texelFetch(u_lightData, ivec2(1, li), 0), dd = texelFetch(u_lightData, ivec2(2, li), 0);
    vec3 Lv = pr.xyz - wpos; float d2 = dot(Lv, Lv), d = sqrt(d2); if (d >= pr.w) continue; vec3 L = Lv / max(d, 1e-4);
    float win = clamp(1.0 - pow(d / pr.w, 4.0), 0.0, 1.0), att = win * win / (d2 + 1.0);
    if (cc.w > 0.5) att *= smoothstep(dd.w, mix(dd.w, 1.0, cc.w - 1.0), dot(-L, dd.xyz));
    float NoL = clamp(dot(N, L), 0.0, 1.0); if (NoL * att <= 0.0) continue;
    vec3 H = normalize(V + L); float NoH = clamp(dot(N, H), 0.0, 1.0), VoH = clamp(dot(V, H), 0.0, 1.0);
    sum += (diff / PI + F_Schlick(f0, VoH) * (D_GGX(NoH, a) * V_Smith(NoV, NoL, a))) * cc.rgb * (att * NoL);
  }
  return sum;
}

/* a surface under the sun, the local lights, the sky and the light bounced from nearby surfaces */
vec3 shadeSurface(vec3 albedo, vec3 N, vec3 V, float rough, float metal, float ao, vec3 wpos, float viewZ, vec2 frag, float model, vec3 bounce, vec4 ssr) {
  float a = max(rough * rough, 0.0025), NoV = max(dot(N, V), 1e-3); vec3 f0 = mix(vec3(0.04), albedo, metal), diff = albedo * (1.0 - metal);
  if (model > 2.5) { f0 = albedo; diff = vec3(0.0); }                 /* glass: its colour is how much it mirrors; what is behind it comes as emission */
  vec3 L = u_sunDir; float NoL = dot(N, L), wrap = model > 1.5 ? 0.4 : 0.0, nlw = clamp((NoL + wrap) / (1.0 + wrap), 0.0, 1.0); vec3 direct = vec3(0.0);
  if (nlw > 0.0 || model > 1.5) {
    float sh = sunShadow(wpos, N, viewZ, frag) * g_contact * g_cloud, nl = clamp(NoL, 0.0, 1.0); vec3 H = normalize(V + L); float NoH = clamp(dot(N, H), 0.0, 1.0), VoH = clamp(dot(V, H), 0.0, 1.0);
    direct = (diff / PI * nlw + F_Schlick(f0, VoH) * (D_GGX(NoH, a) * V_Smith(NoV, nl, a)) * nl) * u_sunColor * sh;
    if (model > 1.5) direct += diff * u_sunColor * (sh * 0.5 / PI * clamp(-NoL + 0.25, 0.0, 1.0));     /* light through the leaf */
  }
  direct += localLights(diff, f0, N, V, a, NoV, wpos, viewZ, frag);
  vec3 R = reflect(-V, N), env = textureLod(u_envMap, R, rough * (u_envLevels - 1.0)).rgb;
  float so = clamp(pow(NoV + ao, exp2(-16.0 * rough - 1.0)) - 1.0 + ao, 0.0, 1.0);
  vec3 spec = mix(env * so, ssr.rgb, ssr.a) * envBRDF(f0, rough, NoV);
  return direct + diff * (shIrradiance(N) * multiBounce(ao, diff) + bounce) + spec;
}

/* haze: thicker near the ground, the colour of the horizon in that direction, glowing toward the sun */
vec3 applyFog(vec3 c, vec3 wpos) {
  if (u_fog.w < 0.5) return c;
  vec3 d = wpos - u_camPos; float dist = length(d); vec3 dir = d / max(dist, 1e-4);
  float dy = d.y * u_fog.y, f = abs(dy) > 1e-3 ? (1.0 - exp(-dy)) / dy : 1.0, od = u_fog.x * exp(-max(u_camPos.y, 0.0) * u_fog.y) * dist * f;
  vec3 hz = skyRadiance(normalize(vec3(dir.x, max(dir.y, 0.0) * 0.4 + 0.03, dir.z)));
  vec3 fc = hz + u_sunColor * (u_fog.z * 0.03 * pow(clamp(dot(dir, u_sunDir), 0.0, 1.0), 8.0));
  return mix(c, fc, 1.0 - exp(-od));
}`;

  /* the deferred lighting pass: every pixel of the G-buffer lit once; the sky where nothing was drawn */
  const LIGHTING_FS = `
#include <common>
#include <lighting>
in vec2 v_uv; layout(location=0) out vec4 o_color;
#ifdef DEBUG_VIEW
layout(location=1) out vec4 o_debug;
#endif
uniform sampler2D u_gAlbedo, u_gNormal, u_gEmissive, u_depth, u_indirect, u_ssr;
uniform mat4 u_invViewProj; uniform vec2 u_nearFar, u_halfRes; uniform vec4 u_gi; uniform vec4 u_skyParams; uniform vec3 u_trueSun, u_moonDir; uniform vec4 u_sunDisc; uniform float u_time; uniform int u_viewMode;
float linZ(float d) { float z = d * 2.0 - 1.0; return 2.0 * u_nearFar.x * u_nearFar.y / (u_nearFar.y + u_nearFar.x - z * (u_nearFar.y - u_nearFar.x)); }
/* the sky as seen: the table, the sun's disc, the moon, stars after dark, and a layer of drifting cloud */
vec3 skyColor(vec3 d) {
  vec3 c = skyRadiance(d); float night = u_skyParams.w;
  float mu = dot(d, u_trueSun), disc = smoothstep(0.99996, 0.999985, mu);
  c += u_sunDisc.rgb * (disc * u_sunDisc.a) * smoothstep(-0.01, 0.02, d.y);
  if (night > 0.01) {
    vec3 sp = d * 210.0, g = floor(sp), f = fract(sp) - 0.5; vec2 h = hash22(g.xy + g.z * 37.7);
    float st = step(0.985, h.x) * smoothstep(0.32, 0.0, length(f)) * (0.35 + 0.65 * h.y) * smoothstep(0.0, 0.2, d.y); c += vec3(0.9, 0.95, 1.0) * (st * night * u_skyParams.z * 0.6);
    float mm = dot(d, u_moonDir); c += vec3(0.85, 0.9, 1.0) * (smoothstep(0.99985, 0.99993, mm) * 0.9 * night);
  }
#ifndef VOL_CLOUDS
  if (u_skyParams.x > 0.001 && d.y > 0.0) {
    vec2 q = d.xz / (d.y + 0.08) * 0.9 + vec2(u_time * 0.004 * u_skyParams.y, u_time * 0.0017 * u_skyParams.y);
    float n = fbm(q) * 0.65 + fbm(q * 2.7 + 11.0) * 0.35, cov = u_skyParams.x, dn = smoothstep(1.0 - cov * 0.95, 1.0 - cov * 0.95 + 0.28, n + cov * 0.35) * smoothstep(0.0, 0.14, d.y);
    vec3 lit = (u_sunColor * (0.11 + 0.1 * pow(max(mu, 0.0), 6.0)) + u_sh[0] * 2.2) * mix(1.0, 0.55, smoothstep(0.3, 0.95, n) * cov);
    c = mix(c, lit, dn * 0.92);
  }
#endif
  return c;
}
/* the view depth a half-size pass saw at one of its pixels: read from the depth buffer at the texel that pass read, so
   the lighting pass needs no depth picture of its own for each half-size effect it lays in (it has 16 texture units, no more) */
float tapZ(ivec2 q, vec2 hres) { vec2 fres = 1.0 / u_invRes; ivec2 fq = clamp(ivec2((vec2(q) + 0.5) / hres * fres), ivec2(0), ivec2(fres) - 1); return min(linZ(texelFetch(u_depth, fq, 0).r), 60000.0); }
vec3 finite(vec3 c) { return any(isnan(c)) || any(isinf(c)) ? vec3(0.0) : c; }
#ifdef VOL_CLOUDS
#include <cloudshadow>
uniform sampler2D u_clouds;
#endif
#ifdef VOL_FOG
/* the haze walked through by the fog pass for the first stretch of each ray, and the analytic haze for the rest */
uniform sampler2D u_volFog; uniform vec4 u_volP;   /* reach, the fog picture's width and height */
vec3 applyFogVol(vec3 c, vec3 wpos, float viewZ) {
  if (u_fog.w < 0.5) return c; vec3 d = wpos - u_camPos; float dist = length(d); vec3 dir = d / max(dist, 1e-4);
  float dy = d.y * u_fog.y, f = abs(dy) > 1e-3 ? (1.0 - exp(-dy)) / dy : 1.0, od = u_fog.x * exp(-max(u_camPos.y, 0.0) * u_fog.y) * dist * f, Tt = exp(-od);
  vec3 hz = skyRadiance(normalize(vec3(dir.x, max(dir.y, 0.0) * 0.4 + 0.03, dir.z))), fc = hz + u_sunColor * (u_fog.z * 0.03 * pow(clamp(dot(dir, u_sunDir), 0.0, 1.0), 8.0));
  vec2 hp = v_uv * u_volP.yz - 0.5; ivec2 b = ivec2(floor(hp + 0.5)), mx = ivec2(u_volP.yz) - 1; vec2 fr = hp - vec2(b); vec4 acc = vec4(0.0); float ws = 0.0, md = min(dist, u_volP.x), zr = dist / max(viewZ, 1e-3);
  for (int i = 0; i < 9; i++) { ivec2 o = ivec2(i % 3 - 1, i / 3 - 1), q = clamp(b + o, ivec2(0), mx); vec2 dd = vec2(o) - fr; float zq = tapZ(q, u_volP.yz), z = zq > 59000.0 ? u_volP.x : min(zq * zr, u_volP.x), w = exp(-dot(dd, dd) * 0.9) + 0.01; w *= 1.0 / (1e-3 + abs(z - md) / max(md, 1.0) * 16.0); acc += texelFetch(u_volFog, q, 0) * w; ws += w; }
  vec4 vf = acc / max(ws, 1e-5); if (any(isnan(vf)) || any(isinf(vf))) return applyFog(c, wpos); float Tfar = clamp(Tt / max(vf.a, 1e-4), 0.0, 1.0);
  return c * Tt + vf.rgb + vf.a * fc * (1.0 - Tfar);
}
#endif
#ifdef CONTACT_SHADOWS
/* contact shadows: a short walk from the surface toward the sun through the depth picture. It finds what the cascades are
   too coarse for: the dark line where a wall meets the ground, the shade under a car, a condenser's on its pad. */
uniform mat4 u_viewProjJ;
float contactShadow(vec3 wpos, vec3 N, float viewZ) {
  if (viewZ > 170.0 || dot(N, u_sunDir) <= 0.02) return 1.0;
  float len = clamp(0.1 + viewZ * 0.011, 0.14, 1.7), j = ign(gl_FragCoord.xy, u_frame); vec3 p0 = wpos + N * (0.012 + viewZ * 0.0016);
  for (int i = 0; i < 8; i++) {
    vec3 p = p0 + u_sunDir * (len * (float(i) + j) / 8.0); vec4 c = u_viewProjJ * vec4(p, 1.0); if (c.w <= 0.05) break;
    vec2 uv = c.xy / c.w * 0.5 + 0.5; if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) break;
    float d = c.w - linZ(textureLod(u_depth, uv, 0.0).r);
    if (d > 0.014 + viewZ * 0.0013 && d < 0.22 + viewZ * 0.012) return mix(0.22, 1.0, smoothstep(70.0, 170.0, viewZ));
  }
  return 1.0;
}
#endif
void main() {
  ivec2 px = ivec2(gl_FragCoord.xy); float depth = texelFetch(u_depth, px, 0).r;
  vec4 wp = u_invViewProj * vec4(v_uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0); vec3 wpos = wp.xyz / wp.w, Vd = normalize(wpos - u_camPos);
  if (depth >= 1.0) { vec3 sc = min(skyColor(Vd), vec3(400.0));
#ifdef VOL_CLOUDS
    { vec4 cl = textureLod(u_clouds, v_uv, 0.0); if (!(any(isnan(cl)) || any(isinf(cl)))) sc = sc * cl.a + cl.rgb; }
#endif
#ifdef VOL_FOG
    if (u_fog.w > 0.5) { vec4 vf = textureLod(u_volFog, v_uv, 0.0); if (!(any(isnan(vf)) || any(isinf(vf)))) sc = sc * vf.a + vf.rgb; }
#endif
    o_color = vec4(finite(sc), 1.0);
#ifdef DEBUG_VIEW
    o_debug = vec4(0.0, 0.0, 0.0, 1.0);
#endif
    return; }
  vec4 g0 = texelFetch(u_gAlbedo, px, 0), g1 = texelFetch(u_gNormal, px, 0), g2 = texelFetch(u_gEmissive, px, 0);
  vec3 N = octDecode(g1.xy); float rough = g1.z, model = floor(g1.a * 3.0 + 0.5), viewZ = linZ(depth);
  /* the half-size indirect buffer, joined to this pixel by depth */
  vec4 ind = vec4(0.0, 0.0, 0.0, 1.0);
  if (u_gi.x > 0.5) { vec2 hp = v_uv * u_halfRes - 0.5; ivec2 b = ivec2(floor(hp)), mx = ivec2(u_halfRes) - 1; vec2 f = fract(hp); vec4 acc = vec4(0.0); float wsum = 0.0;
    for (int i = 0; i < 4; i++) { ivec2 q = clamp(b + ivec2(i & 1, i >> 1), ivec2(0), mx); float z = tapZ(q, u_halfRes), w = ((i & 1) == 1 ? f.x : 1.0 - f.x) * ((i >> 1) == 1 ? f.y : 1.0 - f.y) + 0.02; w *= 1.0 / (1e-3 + abs(z - viewZ) / viewZ * 24.0); acc += texelFetch(u_indirect, q, 0) * w; wsum += w; }
    ind = acc / max(wsum, 1e-5); }
  float ao = mix(1.0, pow(clamp(ind.a, 0.0, 1.0), u_gi.z), u_gi.y) * g2.a; vec3 bounce = ind.rgb * u_gi.w;
  vec4 ssr = textureLod(u_ssr, v_uv, 0.0);
#ifdef CONTACT_SHADOWS
  if (model > 0.5) g_contact = contactShadow(wpos, N, viewZ);
#endif
#ifdef VOL_CLOUDS
  g_cloud = cloudShadow(wpos, u_sunDir);
#endif
  vec3 c = model < 0.5 ? g2.rgb : shadeSurface(g0.rgb, N, -Vd, rough, g0.a, ao, wpos, viewZ, gl_FragCoord.xy, model, bounce, ssr) + g2.rgb;
#ifdef VOL_FOG
  c = applyFogVol(c, wpos, viewZ);
#else
  c = applyFog(c, wpos);
#endif
  c = finite(c); o_color = vec4(c, 1.0);
#ifdef DEBUG_VIEW
  {
    int m = u_viewMode;
    if (m == 1) c = g0.rgb; else if (m == 2) c = N * 0.5 + 0.5; else if (m == 3) c = vec3(rough); else if (m == 4) c = vec3(g0.a); else if (m == 5) c = vec3(ao);
    else if (m == 6) c = bounce * 2.0 + shIrradiance(N) * ao * 0.5; else if (m == 7) c = mix(vec3(0.03), ssr.rgb / (1.0 + ssr.rgb), ssr.a); else if (m == 8) c = vec3(fract(viewZ * 0.1), 1.0 - exp(-viewZ * 0.01), 1.0 - exp(-viewZ * 0.001));
    else if (m == 9) { int cs = viewZ < u_splits.x ? 0 : viewZ < u_splits.y ? 1 : viewZ < u_splits.z ? 2 : 3; vec3 tint = cs == 0 ? vec3(1.0, 0.35, 0.3) : cs == 1 ? vec3(0.35, 1.0, 0.4) : cs == 2 ? vec3(0.35, 0.5, 1.0) : vec3(1.0, 0.9, 0.3); c = (viewZ < u_splits.w ? tint : vec3(0.5)) * (0.25 + 0.75 * sunShadow(wpos, N, viewZ, gl_FragCoord.xy)) * (0.4 + 0.6 * luma(g0.rgb)); }
    else if (m == 10) c = shadeSurface(vec3(0.5), N, -Vd, 1.0, 0.0, ao, wpos, viewZ, gl_FragCoord.xy, 1.0, bounce, vec4(0.0));
    else if (m == 11) { ivec2 tile = ivec2(clamp(v_uv, 0.0, 0.9999) * vec2(${CL.X}.0, ${CL.Y}.0)); int slice = clamp(int(log(max(viewZ, u_clusterParams.x) / u_clusterParams.x) * u_clusterParams.y), 0, ${CL.Z - 1}); int ci = tile.x + tile.y * ${CL.X} + slice * ${CL.X * CL.Y}; float n = texelFetch(u_clusterGrid, ivec2(ci % ${CL.GW}, ci / ${CL.GW}), 0).g / 8.0; c = mix(vec3(0.02, 0.05, 0.3), vec3(1.0, 0.25, 0.05), clamp(n, 0.0, 1.0)) * (0.35 + 0.65 * luma(g0.rgb)) + vec3(0.0, clamp(n, 0.0, 1.0) * (1.0 - n), 0.0); }
    else if (m == 12) c = g2.rgb;
    o_debug = vec4(c, 1.0);
  }
#endif
}`;

  /* ambient occlusion and one bounce of light in one sweep (horizon based, after GTAO and HBIL): for a few directions
     across the screen, march outward, raise the horizon, and credit each newly covered slice of sky to the surface found
     there, at the colour it had last frame */
  const INDIRECT_FS = `
#include <common>
#include <depthtools>
in vec2 v_uv; layout(location=0) out vec4 o_ind; layout(location=1) out vec4 o_z;
uniform sampler2D u_gNormal, u_prev, u_velocity; uniform mat4 u_view; uniform vec2 u_res; uniform float u_frame; uniform vec4 u_params;
float arcInt(float h, float n) { return 0.25 * (-cos(2.0 * h - n) + cos(n) + 2.0 * h * sin(n)); }
void main() {
  vec2 uv0 = v_uv; float d = depthAt(uv0); if (d >= 1.0) { o_ind = vec4(0.0, 0.0, 0.0, 1.0); o_z = vec4(min(u_nearFar.y, 60000.0)); return; }   /* the depth kept here is a half float: past 65,504 it would be infinite, and the filters that compare depths would make nothing of it */
  float lz = linZ(d); vec3 P = vpos(uv0, lz), V = normalize(-P), N = normalize(mat3(u_view) * octDecode(texelFetch(u_gNormal, ivec2(uv0 * u_fullRes), 0).xy)); o_z = vec4(min(lz, 60000.0));
  float n1 = ign(gl_FragCoord.xy, u_frame), n2 = ign(gl_FragCoord.yx + vec2(47.0, 17.0), u_frame + 13.0);
  float rpx = min(u_params.y * u_params.z / lz, u_res.y * 0.4); if (rpx < 2.0) { o_ind = vec4(0.0, 0.0, 0.0, 1.0); return; }
  vec2 vel = texelFetch(u_velocity, ivec2(uv0 * u_fullRes), 0).xy; if (vel.x < -5.0) vel = vec2(0.0);
  float vis = 0.0; vec3 gi = vec3(0.0);
  for (int s = 0; s < SLICES; s++) {
    float phi = (float(s) + n1) / float(SLICES) * PI; vec2 dir = vec2(cos(phi), sin(phi));
    vec3 dv = vec3(dir, 0.0), ortho = dv - dot(dv, V) * V, axis = normalize(cross(dv, V)), pn = N - axis * dot(N, axis); float pl = length(pn); if (pl < 1e-4) continue;
    float n = sign(dot(ortho, pn)) * acos(clamp(dot(pn, V) / pl, 0.0, 1.0));
    for (int side = 0; side < 2; side++) {
      float sg = side == 0 ? 1.0 : -1.0, hLim = n + sg * PI * 0.5, hAO = -1.0, hPrev = hLim, iaPrev = arcInt(hLim, n);
      for (int j = 0; j < STEPS; j++) {
        float t = (float(j) + n2) / float(STEPS); vec2 suv = uv0 + dir * (sg * max(rpx * t * t, float(j) + 1.0)) / u_res; if (suv.x < 0.0 || suv.y < 0.0 || suv.x > 1.0 || suv.y > 1.0) break;
        float sz = linZ(depthAt(suv)); if (sz > u_nearFar.y * 0.98) continue;
        vec3 D = vpos(suv, sz) - P; float dist = length(D), c = dot(D, V) / max(dist, 1e-4);
        hAO = max(hAO, mix(c, -1.0, smoothstep(0.55, 1.45, dist / u_params.x)));
#ifdef GI
        float ang = sg * acos(clamp(c, -1.0, 1.0));
        if (sg * ang < sg * hPrev) { float ia = arcInt(ang, n); vec3 Ls = min(textureLod(u_prev, suv - vel, 0.0).rgb, vec3(24.0)); gi += Ls * (max(iaPrev - ia, 0.0) * pl * (1.0 - smoothstep(0.6, 1.0, dist / u_params.y))); iaPrev = ia; hPrev = ang; }
#endif
      }
      float h = sg * acos(clamp(hAO, -1.0, 1.0)); h = sg > 0.0 ? min(h, hLim) : max(h, hLim); vis += pl * arcInt(h, n);
    }
  }
  o_ind = vec4(gi / float(SLICES), clamp(vis / float(SLICES), 0.0, 1.0));
}`;
  /* the indirect buffer steadied over time: last frame's result, moved to where each surface was, unless the depth says it is another surface */
  const INDIRECT_TEMPORAL_FS = `
in vec2 v_uv; out vec4 o_color; uniform sampler2D u_cur, u_curZ, u_hist, u_histZ, u_velocity; uniform float u_blend;
void main() {
  vec4 cur = texture(u_cur, v_uv); float z = texture(u_curZ, v_uv).r; vec2 vel = textureLod(u_velocity, v_uv, 0.0).xy;
  if (vel.x < -5.0 || u_blend <= 0.0) { o_color = cur; return; }
  vec2 puv = v_uv - vel; if (puv.x < 0.0 || puv.y < 0.0 || puv.x > 1.0 || puv.y > 1.0) { o_color = cur; return; }
  float hz = textureLod(u_histZ, puv, 0.0).r, w = abs(hz - z) / z < 0.1 ? u_blend : 0.0;
  o_color = mix(cur, textureLod(u_hist, puv, 0.0), w);
}`;
  const INDIRECT_BLUR_FS = `
in vec2 v_uv; out vec4 o_color; uniform sampler2D u_src, u_srcZ; uniform vec2 u_res;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy), mx = ivec2(u_res) - 1; float z = texelFetch(u_srcZ, p, 0).r, ws = 0.0; vec4 acc = vec4(0.0);
  for (int y = -2; y <= 2; y++) for (int x = -2; x <= 2; x++) { ivec2 q = clamp(p + ivec2(x, y), ivec2(0), mx); float zq = texelFetch(u_srcZ, q, 0).r, w = exp(-float(x * x + y * y) * 0.22) / (1e-3 + abs(zq - z) / z * 40.0 + 0.02); acc += texelFetch(u_src, q, 0) * w; ws += w; }
  o_color = acc / ws;
}`;

  /* reflections traced through the depth buffer: glass, wet pavement and metal mirror what is on screen; the rest falls back on the sky's cube */
  const SSR_FS = `
#include <common>
#include <depthtools>
in vec2 v_uv; out vec4 o_color;
uniform sampler2D u_gNormal, u_prev, u_velocity; uniform mat4 u_view, u_proj; uniform float u_frame; uniform vec3 u_params;
vec2 project(vec3 p) { vec4 c = u_proj * vec4(p, 1.0); return c.xy / c.w * 0.5 + 0.5; }
void main() {
  vec2 uv0 = v_uv; float d = depthAt(uv0); vec4 g1 = texelFetch(u_gNormal, ivec2(uv0 * u_fullRes), 0); o_color = vec4(0.0);
  if (d >= 1.0 || g1.z > 0.5 || g1.a < 0.17) return;   /* sky, rough surfaces and unlit ones mirror nothing */
  float lz = linZ(d); vec3 P = vpos(uv0, lz), Vv = normalize(P), N = normalize(mat3(u_view) * octDecode(g1.xy)), R = reflect(Vv, N);
  float toward = 1.0 - smoothstep(-0.05, 0.4, R.z); if (toward <= 0.0) return;
  float step0 = lz * 0.018 + 0.04, t = step0 * (0.4 + ign(gl_FragCoord.xy, u_frame)), tPrev = 0.0, st = step0; bool hit = false; vec2 huv = vec2(0.0);
  for (int i = 0; i < SSR_STEPS; i++) {
    vec3 p = P + R * t; if (-p.z < u_nearFar.x || t > u_params.x) break; vec2 uv = project(p); if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) break;
    float sz = linZ(depthAt(uv)), df = -p.z - sz;
    if (df > 0.0 && df < max(u_params.y, st * 1.6)) { hit = true; break; }
    tPrev = t; st *= 1.2; t += st;
  }
  if (!hit) return;
  float lo = tPrev, hi = t; for (int i = 0; i < 5; i++) { float mid = (lo + hi) * 0.5; vec3 p = P + R * mid; vec2 q = project(p); float sz = linZ(depthAt(q)); if (-p.z - sz > 0.0) hi = mid; else lo = mid; }
  huv = project(P + R * hi); vec2 vel = textureLod(u_velocity, huv, 0.0).xy; if (vel.x < -5.0) vel = vec2(0.0);
  vec2 e = smoothstep(vec2(0.0), vec2(0.07), huv) * (1.0 - smoothstep(vec2(0.93), vec2(1.0), huv));
  float conf = e.x * e.y * toward * (1.0 - smoothstep(0.28, 0.5, g1.z)) * (1.0 - smoothstep(u_params.x * 0.7, u_params.x, hi));
  o_color = vec4(min(textureLod(u_prev, huv - vel, 0.0).rgb, vec3(32.0)), conf);
}`;

  /* temporal anti-aliasing: each frame is drawn a fraction of a pixel off, and the frames are averaged along each surface's
     motion; history that no longer matches its neighbourhood is pulled back to it. Drawing fewer pixels than the screen has
     and letting this pass fill them in is the engine's upscaler.
     Each pixel keeps count (in the history's alpha) of the frames gathered into it. A pixel that is still weighs every
     frame it has gathered equally, up to a limit, so its edges and fine texture settle to a steady average instead of
     taking a tenth of each new frame for ever, which showed as a ripple along every edge of a view at rest. The count
     falls back when the surface moves, when the history has to be pulled far to fit its neighbourhood, or when the
     neighbourhood's own mean has left it (the light changed), so what changes is still followed at once. */
  const TAA_FS = `
#include <common>
in vec2 v_uv; out vec4 o_color;
uniform sampler2D u_cur, u_hist, u_velocity, u_depth; uniform vec2 u_curRes, u_outRes, u_jitterUV; uniform mat4 u_reproj; uniform vec4 u_taa, u_taa2;   /* on, frames a still pixel keeps, frames a moving one keeps, how much of a pixel at rest is kept when this frame's neighbours disagree with it */
const float NORM = 64.0;
vec3 tm(vec3 c) { return c / (1.0 + luma(c)); } vec3 itm(vec3 c) { return c / max(1.0 - luma(c), 1e-4); }
/* one texel of this frame's picture, tone-mapped (its alpha kept: what was drawn over the lit picture marks it there) */
vec4 rdT(ivec2 p) { vec4 c = texelFetch(u_cur, clamp(p, ivec2(0), ivec2(u_curRes) - 1), 0); if (any(isnan(c)) || any(isinf(c))) return vec4(0.0, 0.0, 0.0, 1.0); return vec4(tm(clamp(c.rgb, vec3(0.0), vec3(60000.0))), c.a); }
/* last frame's picture read with a sharper filter than bilinear (Catmull-Rom, in five taps), so what is carried along a
   moving surface is not softened a little more with every frame */
vec3 histSharp(vec2 uv) {
  vec2 p = uv * u_outRes, c = floor(p - 0.5) + 0.5, f = p - c, w0 = f * (-0.5 + f * (1.0 - 0.5 * f)), w1 = 1.0 + f * f * (-2.5 + 1.5 * f), w2 = f * (0.5 + f * (2.0 - 1.5 * f)), w3 = f * f * (-0.5 + 0.5 * f), w12 = w1 + w2;
  vec2 t0 = (c - 1.0) / u_outRes, t3 = (c + 2.0) / u_outRes, t12 = (c + w2 / w12) / u_outRes;
  vec4 r = vec4(textureLod(u_hist, vec2(t12.x, t0.y), 0.0).rgb, 1.0) * (w12.x * w0.y) + vec4(textureLod(u_hist, vec2(t0.x, t12.y), 0.0).rgb, 1.0) * (w0.x * w12.y) + vec4(textureLod(u_hist, t12, 0.0).rgb, 1.0) * (w12.x * w12.y)
    + vec4(textureLod(u_hist, vec2(t3.x, t12.y), 0.0).rgb, 1.0) * (w3.x * w12.y) + vec4(textureLod(u_hist, vec2(t12.x, t3.y), 0.0).rgb, 1.0) * (w12.x * w3.y);
  return max(r.rgb / max(r.a, 1e-4), vec3(0.0));
}
vec2 nb(int i) { return vec2(float(i < 3 ? i - 1 : i == 3 ? -1 : i == 4 ? 1 : i - 6), float(i < 3 ? -1 : i < 5 ? 0 : 1)); }   /* the eight neighbours, in rows */
void main() {
  vec2 uvj = v_uv + u_jitterUV, tx = 1.0 / u_curRes;
  /* This frame's picture at the pixel and at its eight neighbours. The frame was drawn nudged a fraction of a pixel (and
     smaller than the screen when the load is heavy), so each of the nine falls between four of its texels and is mixed
     from them. They are mixed after tone mapping, not before. Mixed before, a frame whose samples fall between texels
     comes out a little brighter over grainy ground than one whose samples fall on them (the bright texel of a pair
     outweighs the dark one until the tone curve has flattened it): a small difference between one frame and the
     next that is no change in the scene, and one more thing for the change detector below to mistake for one.
     All nine sit the same way between texels, so sixteen texels serve them all. */
  vec2 sp = uvj * u_curRes - 0.5, fb = floor(sp), ff = sp - fb; ivec2 ib = ivec2(fb); vec4 T[16];
  for (int j = 0; j < 4; j++) for (int i = 0; i < 4; i++) T[j * 4 + i] = rdT(ib + ivec2(i - 1, j - 1));
  vec3 cur = vec3(0.0), m1 = vec3(0.0), m2 = vec3(0.0), mn = vec3(2.0), mx = vec3(-1.0); float cl[9], curA = 1.0;
  for (int k = 0; k < 9; k++) { vec2 o = k == 8 ? vec2(0.0) : nb(k); int q = (int(o.y) + 1) * 4 + int(o.x) + 1;
    vec4 c = mix(mix(T[q], T[q + 1], ff.x), mix(T[q + 4], T[q + 5], ff.x), ff.y); m1 += c.rgb; m2 += c.rgb * c.rgb; mn = min(mn, c.rgb); mx = max(mx, c.rgb); cl[k] = luma(c.rgb); if (k == 8) { cur = c.rgb; curA = c.a; } }
  vec3 mean = m1 / 9.0, sd = sqrt(max(m2 / 9.0 - mean * mean, vec3(0.0)));
  /* the motion of the nearest surface around the pixel, so edges move with what is in front */
  float best = 2.0; vec2 bo = vec2(0.0); for (int i = 0; i < 5; i++) { vec2 o = i == 0 ? vec2(0.0) : i == 1 ? vec2(-1.0, -1.0) : i == 2 ? vec2(1.0, -1.0) : i == 3 ? vec2(-1.0, 1.0) : vec2(1.0); float dz = textureLod(u_depth, uvj + o * tx, 0.0).r; if (dz < best) { best = dz; bo = o; } }
  vec2 vel = textureLod(u_velocity, uvj + bo * tx, 0.0).xy, puv;
  if (vel.x < -5.0) { vec4 pc = u_reproj * vec4(v_uv * 2.0 - 1.0, 1.0, 1.0); puv = pc.xy / pc.w * 0.5 + 0.5; } else puv = v_uv - vel;
  float on = u_taa.x; if (puv.x < 0.0 || puv.y < 0.0 || puv.x > 1.0 || puv.y > 1.0) on = 0.0;
  vec4 h4 = textureLod(u_hist, puv, 0.0); if (any(isnan(h4)) || any(isinf(h4))) { h4 = vec4(0.0); on = 0.0; }
  if (on < 0.5) { o_color = vec4(max(itm(cur), vec3(0.0)), 1.0 / NORM); return; }
  /* how far this surface moved since last frame, in pixels of the screen: none at all means the history is read at a texel's centre, exactly */
  float mpx = length((v_uv - puv) * u_outRes), still = 1.0 - smoothstep(0.02, 0.2, mpx);
  vec3 hraw; if (mpx < 0.01) hraw = max(h4.rgb, vec3(0.0)); else hraw = histSharp(puv); vec3 hist = tm(hraw);
  /* the box the neighbourhood allows: its mean and spread (wider at rest), never past its extremes */
  float gam = mix(1.25, 1.75, still); vec3 lo = max(mean - sd * gam, mn), hi = min(mean + sd * gam, mx), hc = clamp(hist, lo, hi);
  /* The count kept in the history's alpha is how long this pixel has been at rest. One at rest for a while is trusted:
     its history is brought to the box a small part of the way each frame and not all at once. A window bar or a wire
     thinner than a pixel is missed by some frames' samples; pulled all the way on those frames it blinked, and that
     was the flicker of every window frame down a street, and of the grain of a road underfoot.
     What tells a real change (a shadow arriving, a lamp coming on) from a missed thin line or a shifted grain is the
     neighbourhood: a real change moves the pixel and all eight of its neighbours the same way, in this frame against
     the history, and by more than their own unevenness; a missed line moves three of them, and grain moves them every
     which way. Then the pull is whole again and the gathering starts over. A pixel that moved lately, or that something
     moving has just uncovered, has a low count and gets the whole pull, so nothing trails behind a car. */
  float r0 = clamp(h4.a, 0.0, 1.0) * NORM, trust = still * smoothstep(u_taa.z + 1.0, u_taa.z + 10.0, r0), chg = 0.0;
  if (trust > 0.0) { float sg = 0.0, sm = 0.0;
    for (int i = 0; i < 9; i++) { vec3 hq = i == 8 ? hist : tm(max(textureLod(u_hist, puv + nb(i) * tx, 0.0).rgb, vec3(0.0))); float d = cl[i] - luma(hq); sg += sign(d) * step(0.002, abs(d)); sm += d; }
    /* the floor is set above the faint, broad shimmer the half-size passes (haze, occlusion, clouds) leave in any one frame: that is noise to be averaged away, not a change to follow */
    float tol = luma(sd) * 0.5 + u_taa2.x; chg = step(8.5, abs(sg)) * smoothstep(tol, tol * 2.0, abs(sm) / 9.0); }
  hist = mix(hc, hist, u_taa.w * trust * (1.0 - chg));
  float lim = mix(u_taa.z, u_taa.y, still); lim = mix(lim, 2.0, 0.6 * smoothstep(0.002, 0.03, length(vel) * step(-5.0, vel.x)));
  float n = min(r0, lim); n = mix(n, min(n, u_taa.z), chg);
  /* what was drawn over the lit picture without a motion of its own (rain, smoke, sparks) left a mark in its alpha: there the new frame counts for more */
  n = mix(n, min(n, 1.5), clamp(1.0 - curA, 0.0, 1.0));
  o_color = vec4(max(itm(mix(hist, cur, 1.0 / (n + 1.0))), vec3(0.0)), min((n + 1.0) / NORM, 1.0));
}`;

  Object.assign(SE.shaders, { CL, lightingFS: LIGHTING_FS, indirectFS: INDIRECT_FS, indirectTemporalFS: INDIRECT_TEMPORAL_FS, indirectBlurFS: INDIRECT_BLUR_FS, ssrFS: SSR_FS, taaFS: TAA_FS });

  /* ==== the renderer: one frame from the scene to the screen ==== */
  /* shadow cascades -> G-buffer -> occlusion and bounced light -> reflections -> lighting and sky -> transparent surfaces
     and particles -> temporal anti-aliasing (and upscaling) -> bloom, exposure, tone mapping, grading -> outlines and lines */
  const VIEW_MODES = ['lit', 'albedo', 'normals', 'roughness', 'metallic', 'ao', 'gi', 'reflections', 'depth', 'cascades', 'lighting', 'lights', 'emissive'];
  const MASK_FS = 'out vec4 o_color; in vec2 v_uv; uniform vec4 u_maskColor; void main() { o_color = u_maskColor; }';
  const COPY_FS = 'out vec4 o_color; in vec2 v_uv; uniform sampler2D u_src; void main() { o_color = texture(u_src, v_uv); }';
  const IDENT = M4.create();

  class Renderer {
    constructor(engine) {
      const dev = this.dev = engine.device; this.engine = engine; this.sky = new Sky(dev); this.settings = Object.assign({}, Renderer.defaults);
      this.w = 0; this.h = 0; this.W = 0; this.H = 0; this.frame = 0; this.T = null; this.reset = true; this._progs = new Map(); this._stamp = 0; this._bad = new Set();
      this.cascades = [0, 1, 2, 3].map(i => ({ i, vp: M4.create(), mat: M4.create(), texel: 1, radius: 1, frustum: new Frustum(), list: [], valid: false }));
      this.shadowMats = new Float32Array(64); this.splits = new Float32Array(4); this.cascadeTexel = new Float32Array(4); this.atlas = null; this.atlasT = null; this.atlasSize = 0;
      this.opaque = []; this.transparent = []; this.pool = []; this.poolN = 0; this.seen = [];
      this.prevVP = M4.create(); this.vpNJ = M4.create(); this.projNJ = M4.create(); this.reproj = M4.create(); this.prevTime = 0; this._lightView = M4.create(); this._tmp = M4.create();
      this.refused = new Set(); this.refusedWhy = {};
      this.stats = { draws: 0, tris: 0, instances: 0, visible: 0, culled: 0, clusters: 0, clustersCulled: 0, lights: 0, shadowDraws: 0, occluded: 0 };
      this.outlines = new Map(); this._starts = new Int32Array(4096); this._counts = new Int32Array(4096);
      const S = SE.shaders.CL; this.lightData = new Float32Array(S.MAX * 16); this.gridData = new Float32Array(S.GW * Math.ceil(S.X * S.Y * S.Z / S.GW) * 2); this.idxData = new Float32Array(S.IW * S.IH);
      this.lightTex = dev.texture({ w: 4, h: S.MAX, format: 'rgba32f', filter: 'nearest' }); this.gridTex = dev.texture({ w: S.GW, h: Math.ceil(S.X * S.Y * S.Z / S.GW), format: 'rg32f', filter: 'nearest' }); this.idxTex = dev.texture({ w: S.IW, h: S.IH, format: 'r32f', filter: 'nearest' });
      this._cl = Array.from({ length: S.X * S.Y * S.Z }, () => []); this.lightCount = 0;
      this.post = new SE.Post(this); this.lines = new SE.DebugLines(dev); this.hzb = SE.Occlusion ? new SE.Occlusion(this) : null;
    }
    /* css size and device pixel ratio -> the output size and the (possibly smaller) size the scene is drawn at */
    resize(cssW, cssH, dpr) {
      const s = this.settings, pr = Math.min(dpr || 1, s.maxPixelRatio), W = Math.max(8, Math.round(cssW * pr)), H = Math.max(8, Math.round(cssH * pr)), sc = clamp(s.renderScale * (this.drs || 1), 0.4, 1), full = sc >= 0.999, w = full ? W : Math.max(8, Math.round(W * sc / 8) * 8), h = full ? H : Math.max(8, Math.round(H * sc / 8) * 8);   /* at full scale the scene is drawn at the screen's own size, pixel for pixel: rounded to eights it was a few pixels off for most window sizes, and resampling it softened the whole picture */
      if (W === this.W && H === this.H && w === this.w && h === this.h && this.T) return false;
      /* when only the inner resolution moves (dynamic resolution), the finished pictures at the screen's size are kept, so the temporal filter does not start again */
      const keep = W === this.W && H === this.H && !!this.T;
      this.W = W; this.H = H; this.w = w; this.h = h; const c = this.dev.canvas; if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
      this._alloc(keep); if (keep) this.resetInd = !this.carried; else this.reset = true; return true;
    }
    _alloc(keep) {
      const dev = this.dev, w = this.w, h = this.h, W = this.W, H = this.H, hw = Math.ceil(w / 2), hh = Math.ceil(h / 2), T = this.T || {}, KEEP = keep ? ['hist', 'histT', 'mask', 'maskT'] : [];
      /* the occlusion and bounced light gathered over the last frames live at the drawing size: when only that changes they are carried over (resampled), not thrown away */
      const CARRY = keep && T.indHist && T.indZ ? { indHist: T.indHist, indZ: T.indZ } : null;
      Object.keys(T).forEach(k => { if (KEEP.includes(k) || (CARRY && CARRY[k])) return; const x = T[k]; if (Array.isArray(x)) x.forEach(y => y.dispose && y.dispose()); else if (x && x.dispose) x.dispose(); });
      const tx = (ww, hgt, format, o) => dev.texture(Object.assign({ w: ww, h: hgt, format }, o || {}));
      const N = {}; N.albedo = tx(w, h, 'srgb8a8', { filter: 'nearest' }); N.normal = tx(w, h, 'rgb10a2', { filter: 'nearest' }); N.emissive = tx(w, h, 'rgba16f', { filter: 'nearest' }); N.velocity = tx(w, h, 'rg16f', { filter: 'nearest' }); N.depth = tx(w, h, 'depth24', { filter: 'nearest' });
      N.gbuffer = dev.target({ color: [N.albedo, N.normal, N.emissive, N.velocity], depth: N.depth });
      N.hdr = tx(w, h, 'rgba16f'); N.hdrT = dev.target({ color: [N.hdr], depth: N.depth }); N.hdrFlatT = dev.target({ color: [N.hdr] }); N.debug = tx(w, h, 'rgba16f'); N.debugT = dev.target({ color: [N.hdr, N.debug] });   /* with the depth for surfaces that test against it; without, for passes that read it */
      N.indRaw = tx(hw, hh, 'rgba16f', { filter: 'nearest' }); N.indZ = [tx(hw, hh, 'r16f', { filter: 'nearest' }), tx(hw, hh, 'r16f', { filter: 'nearest' })];
      N.indRawT = [dev.target({ color: [N.indRaw, N.indZ[0]] }), dev.target({ color: [N.indRaw, N.indZ[1]] })];
      N.indHist = [tx(hw, hh, 'rgba16f'), tx(hw, hh, 'rgba16f')]; N.indHistT = N.indHist.map(t => dev.target({ color: [t] }));
      N.indBlur = tx(hw, hh, 'rgba16f', { filter: 'nearest' }); N.indBlurT = dev.target({ color: [N.indBlur] });
      N.ssr = tx(hw, hh, 'rgba16f'); N.ssrT = dev.target({ color: [N.ssr] });
      if (keep) KEEP.forEach(k => { N[k] = T[k]; }); else { N.hist = [tx(W, H, 'rgba16f'), tx(W, H, 'rgba16f')]; N.histT = N.hist.map(t => dev.target({ color: [t] }));
        N.mask = tx(Math.ceil(W / 2), Math.ceil(H / 2), 'rg8'); N.maskT = dev.target({ color: [N.mask] }); }
      this.carried = false;
      if (CARRY) { try { const pc = dev.program('copy', CHUNKS.fullscreen_vs, COPY_FS); dev.state({ depthTest: false, cull: 'none' }); pc.use();
          [0, 1].forEach(i => { dev.bind(N.indHistT[i]); pc.set('u_src', CARRY.indHist[i]); dev.fullscreen(pc); const tz = dev.target({ color: [N.indZ[i]] }); dev.bind(tz); pc.set('u_src', CARRY.indZ[i]); dev.fullscreen(pc); tz.dispose(); }); this.carried = true; }
        catch (e) { this.carried = false; }
        CARRY.indHist.forEach(t => t.dispose()); CARRY.indZ.forEach(t => t.dispose()); }
      this.T = N; this.hw = hw; this.hh = hh; if (!keep) { this.cur = 0; this.post.resize(W, H); }
    }
    _atlas() {
      const s = this.settings, size = clamp(s.shadowSize, 256, this.dev.caps.maxTex / 2) | 0; if (this.atlas && this.atlasSize === size) return;
      if (this.atlas) { this.atlas.dispose(); this.atlasT.dispose(); }
      this.atlasSize = size; this.atlas = this.dev.texture({ w: size * 2, h: size * 2, format: 'depth24', compare: true, filter: 'linear' }); this.atlasT = this.dev.target({ color: [], depth: this.atlas }); this.cascades.forEach(c => { c.valid = false; });
    }
    _prog(pass, mat, inst) {
      const key = pass + ':' + (mat.shader || '') + ':' + mat.key(inst); let p = this._progs.get(key); if (p !== undefined) return p;
      const dev = this.dev, d = mat.defines(inst), SH = SE.shaders;
      try {
        if (pass === 'gbuffer') p = dev.program('gbuffer', SH.surfaceVS, SH.gbufferFS, d);
        else if (pass === 'shadow') p = dev.program('shadow', SH.shadowVS, SH.shadowFS, { INSTANCED: d.INSTANCED, ALPHA_TEST: d.ALPHA_TEST, WIND: d.WIND });
        else if (pass === 'mask') p = dev.program('mask', SH.shadowVS, MASK_FS, { INSTANCED: d.INSTANCED, WIND: d.WIND });
        else { const f = SH.forward[mat.shader || 'pbr'] || SH.forward.pbr; p = dev.program('forward-' + (mat.shader || 'pbr'), f.vs || SH.surfaceVS, f.fs, d); }
      } catch (e) { console.error('[Scout Engine] ' + e.message); p = null; }
      this._progs.set(key, p); return p;
    }
    _item() { let it = this.pool[this.poolN]; if (!it) this.pool[this.poolN] = it = { r: null, mesh: null, mat: null, world: null, prev: null, inst: null, dist: 0 }; this.poolN++; return it; }

    /* ---------- the sun's shadow cascades: each a square of the ground around the view, snapped to its own texels so it does not shimmer ---------- */
    _cascades(cam) {
      const s = this.settings, L = this.sky.lightDir, n = 4, near = cam.near, far = Math.min(s.shadowDistance, cam.far), size = this.atlasSize, lv = this._lightView;
      M4.lookAt(lv, [0, 0, 0], [-L[0], -L[1], -L[2]], Math.abs(L[1]) > 0.98 ? [0, 0, -1] : [0, 1, 0]);
      const th = Math.tan(cam.fov * RAD / 2), tw = th * cam.aspect, iv = cam.invView, pt = [0, 0, 0], c = [0, 0, 0], lc = [0, 0, 0]; let d0 = near;
      for (let i = 0; i < n; i++) {
        const f = (i + 1) / n, d1 = lerp(near + (far - near) * f, near * Math.pow(far / near, f), s.shadowLambda), C = this.cascades[i]; this.splits[i] = d1;
        /* the sphere round this slice of the view: centred on the axis, wide enough for the far corners */
        const k = 1 + tw * tw + th * th, zc = Math.min((d0 + d1) / 2 * k, d1), rad = Math.ceil(Math.hypot(d1 - zc, d1 * Math.sqrt(tw * tw + th * th)) * 8) / 8;
        if (this._upd[i]) {
          V3.transform(c, [0, 0, -zc], iv); V3.transform(lc, c, lv); const texel = 2 * rad / size; lc[0] = Math.floor(lc[0] / texel) * texel; lc[1] = Math.floor(lc[1] / texel) * texel;
          const o = this._tmp; M4.ortho(o, lc[0] - rad, lc[0] + rad, lc[1] - rad, lc[1] + rad, -lc[2] - rad - s.shadowCasterReach, -lc[2] + rad); M4.mul(C.vp, o, lv); C.frustum.set(C.vp); C.texel = texel; C.radius = rad; C.valid = true;
          const b = M4.identity(C.mat); b[0] = 0.25; b[5] = 0.25; b[10] = 0.5; b[12] = 0.25 + (i & 1) * 0.5; b[13] = 0.25 + (i >> 1) * 0.5; b[14] = 0.5; M4.mul(C.mat, b, C.vp);
        }
        this.shadowMats.set(C.mat, i * 16); this.cascadeTexel[i] = C.texel; d0 = d1; void pt;
      }
    }

    /* ---------- what is in view (and in each cascade), at which level of detail ---------- */
    _collect(scene, cam) {
      const s = this.settings, fr = cam.frustum, cp = cam.position, st = this.stats, tanH = Math.tan(cam.fov * RAD / 2), shadows = s.shadows && this.sky.lightColor[0] + this.sky.lightColor[1] + this.sky.lightColor[2] > 1e-4;
      this.opaque.length = 0; this.transparent.length = 0; this.poolN = 0; this.seen.length = 0; this.cascades.forEach(c => { if (this._upd[c.i]) c.list.length = 0; });
      const occ = s.occlusionCull && this.hzb && this.hzb.ready ? this.hzb : null; this.anyWind = false;
      for (const r of scene.renderables) {
        if (!r.enabled || !r.visible) continue; let mat = r.material; if (!(r.mesh || r.lods) || (!mat && !r.lods)) continue; const e = r.entity; if (!e.activeInHierarchy) continue;
        if (r.isInstanced) { const ib = r.instances; if (!ib || !ib.count) continue; if (ib.dirty) ib.upload((r.mesh || r.lods[0].mesh).bounds.radius); }
        const sp = r.sphere(), dist = Math.hypot(sp[0] - cp[0], sp[1] - cp[1], sp[2] - cp[2]), near = Math.max(0, dist - sp[3]);
        if (r.maxDistance && near > r.maxDistance) { st.culled++; continue; }
        let mesh = r.mesh;
        if (r.isInstanced) { const L = r.lodAt(near / s.lodBias); mesh = L.mesh; mat = L.material || mat; if (!mesh || !mat) continue; }
        else if (mesh.lods) { const size = sp[3] / (Math.max(dist, 1e-3) * tanH) * s.lodBias, L = mesh.lods; let k = 0; while (k < L.length - 1 && size < L[k].size) k++; mesh = L[k].mesh; }
        const world = e.transform.world; if (r._seen !== this.frame - 1 && r.prevWorld) r.prevWorld.set(world); r._seen = this.frame; this.seen.push(r);
        let it = null; const mk = () => { if (!it) { it = this._item(); it.r = r; it.mesh = mesh; it.mat = mat; it.world = world; it.prev = r.prevWorld || world; it.inst = r.isInstanced ? r.instances : null; it.dist = dist; } return it; };
        if (fr.sphere(sp[0], sp[1], sp[2], sp[3])) {
          if (occ && near > 6 && !mat.transparent && occ.hidden(sp)) st.occluded++;
          else { (mat.transparent ? this.transparent : this.opaque).push(mk()); st.visible++; if (mat.wind > 0) this.anyWind = true; }
        } else st.culled++;
        if (shadows && r.castShadow && mat.castShadow && !mat.transparent && near < (r.shadowDistance || s.shadowDistance)) for (let i = 0; i < 4; i++) { const C = this.cascades[i]; if (this._upd[i] && C.frustum.sphere(sp[0], sp[1], sp[2], sp[3])) C.list.push(mk()); }
      }
      this.opaque.sort((a, b) => a.mat.order - b.mat.order || a.mat.id - b.mat.id || a.dist - b.dist); this.transparent.sort((a, b) => a.mat.order - b.mat.order || b.dist - a.dist);
    }

    /* ---------- one list of items through one kind of program ---------- */
    _draw(list, pass, frame, frustum, cam) {
      const dev = this.dev, st = this.stats, s = this.settings; let lastP = null, lastM = null; const stamp = ++this._stamp, shadow = pass === 'shadow' || pass === 'mask';
      for (let i = 0; i < list.length; i++) {
        const it = list[i], mat = it.mat, p = this._prog(pass, mat, !!it.inst); if (!p) continue;
        if (p !== lastP) { p.use(); lastP = p; lastM = null; if (p.stamp !== stamp) { p.stamp = stamp; frame(p); } }
        if (mat !== lastM) { lastM = mat; mat.apply(p);
          if (shadow) dev.state({ cull: 'none', polygonOffset: pass === 'shadow' ? [2, 4] : null, colorMask: pass === 'mask', depthTest: pass === 'shadow', blend: pass === 'mask' ? 'add' : 'none' });
          else if (pass === 'gbuffer') dev.state({ cull: mat.twoSided ? 'none' : 'back', polygonOffset: mat.polygonOffset });
          else dev.state({ cull: mat.twoSided ? 'none' : 'back', polygonOffset: mat.polygonOffset, blend: mat.blend === 'add' ? 'add' : 'alpha', depthWrite: !!mat.depthWrite }); }
        p.set('u_model', it.world); p.set('u_prevModel', it.prev);
        const mesh = it.mesh;
        if (it.inst) { mesh.drawInstanced(it.inst, it.inst.count); st.instances += it.inst.count; st.tris += mesh.tris * it.inst.count; }
        else if (mesh.clusters && (s.clusterCull || mesh.maskable) && frustum) {
          const C = mesh.clusters, w = it.world, ident = w === IDENT || (w[0] === 1 && w[5] === 1 && w[10] === 1 && w[12] === 0 && w[13] === 0 && w[14] === 0 && w[1] === 0 && w[4] === 0), sc = ident ? 1 : M4.maxScale(w), unit = mesh.indexed ? mesh.isize : 1, cone = !shadow && !mat.twoSided && cam && ident; let n = 0, tris = 0;
          if (this._starts.length < C.length) { this._starts = new Int32Array(C.length * 2); this._counts = new Int32Array(C.length * 2); } const S0 = this._starts, N0 = this._counts, cp = cam ? cam.position : null;
          /* a mesh of fine members (window bars) is drawn cluster by cluster only as far as its members are still about a pixel wide */
          const fineFar = mesh.fineSize && cp ? mesh.fineSize * this.h / (2 * Math.tan(cam.fov * RAD / 2)) / s.fineMinPx : 0;
          for (let k = 0; k < C.length; k++) { const c = C[k]; if (c.hidden) continue; let x = c.c[0], y = c.c[1], z = c.c[2]; if (!ident) { const tx = w[0] * x + w[4] * y + w[8] * z + w[12], ty = w[1] * x + w[5] * y + w[9] * z + w[13]; z = w[2] * x + w[6] * y + w[10] * z + w[14]; x = tx; y = ty; }
            let vis = frustum.sphere(x, y, z, c.r * sc); if (vis && fineFar && Math.hypot(x - cp[0], y - cp[1], z - cp[2]) - c.r * sc > fineFar) vis = false;
            if (vis && cone && c.cone > 0.2) { const dx = x - cp[0], dy = y - cp[1], dz = z - cp[2], dl = Math.hypot(dx, dy, dz); if (dx * c.axis[0] + dy * c.axis[1] + dz * c.axis[2] >= Math.sqrt(1 - c.cone * c.cone) * dl + c.r) vis = false; }
            if (!vis) { st.clustersCulled++; continue; } st.clusters++;
            if (n && S0[n - 1] + N0[n - 1] * unit === c.start) N0[n - 1] += c.count; else { S0[n] = c.start; N0[n] = c.count; n++; } tris += c.count / 3; }
          if (n) { mesh.drawRanges(S0, N0, n); st.tris += tris; }
        } else { mesh.draw(); st.tris += mesh.tris; }
        st.draws++; if (pass === 'shadow') st.shadowDraws++;
      }
    }

    /* ---------- local lights sorted into the view's clusters ---------- */
    _lights(scene, cam) {
      const S = SE.shaders.CL, D = this.lightData, cl = this._cl, V = cam.view, P = cam.proj, list = []; const p = [0, 0, 0];
      for (const l of scene.lights) { if (!l.active || l.intensity <= 0) continue; l.transform.worldPosition(p); const d = V3.dist(p, cam.position); if (d - l.range > S.FAR || !cam.frustum.sphere(p[0], p[1], p[2], l.range)) continue; list.push({ l, d, x: p[0], y: p[1], z: p[2] }); }
      list.sort((a, b) => a.d - b.d); if (list.length > S.MAX) list.length = S.MAX; this.lightCount = list.length; this.stats.lights = list.length;
      for (let i = 0; i < cl.length; i++) cl[i].length = 0; if (!list.length) return;
      const lz = S.Z / Math.log(S.FAR / S.NEAR), fwd = [0, 0, 0];
      list.forEach((o, i) => {
        const l = o.l, b = i * 16, spot = l.type === 'spot'; D[b] = o.x; D[b + 1] = o.y; D[b + 2] = o.z; D[b + 3] = l.range; D[b + 4] = l.color[0] * l.intensity; D[b + 5] = l.color[1] * l.intensity; D[b + 6] = l.color[2] * l.intensity; D[b + 7] = spot ? 1 + clamp(l.blend, 0.01, 1) : 0;
        if (spot) { l.transform.forward(fwd); D[b + 8] = fwd[0]; D[b + 9] = fwd[1]; D[b + 10] = fwd[2]; D[b + 11] = Math.cos(l.angle * RAD / 2); } else { D[b + 8] = 0; D[b + 9] = -1; D[b + 10] = 0; D[b + 11] = -1; }
        const vx = V[0] * o.x + V[4] * o.y + V[8] * o.z + V[12], vy = V[1] * o.x + V[5] * o.y + V[9] * o.z + V[13], vz = -(V[2] * o.x + V[6] * o.y + V[10] * o.z + V[14]), r = l.range;
        const z0 = Math.max(S.NEAR, vz - r), z1 = vz + r; if (z1 < S.NEAR) return;
        const s0 = clamp(Math.floor(Math.log(z0 / S.NEAR) * lz), 0, S.Z - 1), s1 = clamp(Math.floor(Math.log(Math.max(z1, S.NEAR) / S.NEAR) * lz), 0, S.Z - 1);
        let x0 = 0, x1 = S.X - 1, y0 = 0, y1 = S.Y - 1;
        if (vz - r > 0.3) { const zn = vz - r, cx = vx / vz * P[0], cy = vy / vz * P[5], rx = r * P[0] / zn, ry = r * P[5] / zn; x0 = clamp(Math.floor((cx - rx + 1) / 2 * S.X), 0, S.X - 1); x1 = clamp(Math.floor((cx + rx + 1) / 2 * S.X), 0, S.X - 1); y0 = clamp(Math.floor((cy - ry + 1) / 2 * S.Y), 0, S.Y - 1); y1 = clamp(Math.floor((cy + ry + 1) / 2 * S.Y), 0, S.Y - 1); }
        for (let z = s0; z <= s1; z++) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const c = cl[x + y * S.X + z * S.X * S.Y]; if (c.length < S.PER) c.push(i); }
      });
      const G = this.gridData, I = this.idxData; let off = 0; for (let i = 0; i < cl.length; i++) { const c = cl[i], n = Math.min(c.length, I.length - off); G[i * 2] = off; G[i * 2 + 1] = n; for (let k = 0; k < n; k++) I[off + k] = c[k]; off += n; }
      this.lightTex.upload(D); this.gridTex.upload(G); this.idxTex.upload(I);
    }
    _lightUniforms(p, cam) {
      const sky = this.sky, s = this.settings, env = this.env, S = SE.shaders.CL;
      p.sets({ u_view: cam.view, u_sunDir: sky.lightDir, u_sunColor: sky.lightColor, u_sh: sky.sh, u_envMap: sky.env, u_envLevels: sky.levels, u_skyLUT: sky.lut, u_shadowMap: this.atlas, u_shadowMat: this.shadowMats, u_splits: this.splits, u_cascadeTexel: this.cascadeTexel,
        u_shadowParams: [0.5 / this.atlasSize, s.shadowSoftness, s.shadows && this.shadowOn ? 1 : 0, 0], u_lightData: this.lightTex, u_clusterGrid: this.gridTex, u_clusterIdx: this.idxTex, u_clusterParams: [S.NEAR, S.Z / Math.log(S.FAR / S.NEAR), this.lightCount, 0], u_invRes: [1 / this.w, 1 / this.h],
        u_fog: [env.fogDensity, 1 / Math.max(env.fogHeight, 1), env.fogSun, s.fog ? 1 : 0], u_frame: this.noiseFrame, u_camPos: cam.position });
    }

    /* ---------- the frame ---------- */
    /* Compile, before they are first drawn, the programs a set of materials will need: each as drawn alone and instanced,
       into the G-buffer, the shadow maps and (if it blends) the forward pass. A few milliseconds' worth per frame, so the
       hitches a new program costs fall while the world is still loading and not when a new kind of thing first comes
       into view. It is what a browser offers in place of a pipeline-state cache: there is no cache on disk to fill. */
    /* an effect this machine's driver would not build: off from now on, whatever the settings say, and reported once */
    refuse(what, e) { if (this.refused.has(what)) return; this.refused.add(what); const msg = String((e && e.message) || e).split('\n')[0].slice(0, 220); this.refusedWhy[what] = msg; console.warn('[Scout Engine] switched off ' + what + ': ' + msg); this.engine.emit('degraded', what, msg); }
    /* everything optional off: what the engine falls back to when a frame cannot be drawn */
    safe() { Object.assign(this.settings, { contactShadows: false, volumetricFog: false, volumetricClouds: false, shafts: false, dof: false, motionBlur: 0, ssr: false, gi: false }); this.reset = true; this.post.first = true; }
    warm(materials) { const q = this._warmQ || (this._warmQ = []); (materials || []).forEach(m => { if (!m || !m.key) return; [false, true].forEach(inst => { if (m.blend && m.blend !== 'opaque') q.push(['forward', m, inst]); else { q.push(['gbuffer', m, inst]); if (m.castShadow !== false) q.push(['shadow', m, inst]); } }); }); this.warmed = this.warmed || 0; this.engine.requestRender(4); return q.length; }
    render(scene, cam, time, dt) {
      const dev = this.dev, gl = dev.gl, s = this.settings, T = this.T, st = this.stats, env = scene.env; if (!T || dev.lost) return;
      if (this._warmQ && this._warmQ.length) { const t0 = performance.now(); while (this._warmQ.length && performance.now() - t0 < 7) { const w = this._warmQ.shift(); try { this._prog(w[0], w[1], w[2]); this.warmed++; } catch (e) { /* it will be reported when it is first drawn */ } } if (this._warmQ.length) this.engine.requestRender(); }
      Object.keys(st).forEach(k => { st[k] = 0; }); this.env = env; const w = this.w, h = this.h, W = this.W, H = this.H;
      dev.passBegin('sky'); const skyChanged = this.sky.update(env); dev.passEnd(); this._atlas(); if (skyChanged) this.post.snap = 10;
      this.noiseFrame = s.taa ? this.frame % 64 : 0;
      /* the camera, nudged a fraction of a pixel when the temporal filter is on */
      const up = W / w, jn = up > 1.05 ? 16 : 8, ji = this.frame % jn + 1, jx = s.taa ? (halton(ji, 2) - 0.5) * 2 / w : 0, jy = s.taa ? (halton(ji, 3) - 0.5) * 2 / h : 0;
      /* the picture's shape is the screen's, not the drawing size's: that is rounded to eights and moves with the dynamic resolution, and a view shaped by it stretched a little and shifted when it changed */
      cam.update(W / H, 0, 0); M4.copy(this.vpNJ, cam.viewProj); M4.copy(this.projNJ, cam.proj);
      const camKey = cam.transform.version + ':' + cam.fov, moved = camKey !== this._camKey; this._camKey = camKey; this.camMoved = moved;
      if (this.reset || !this.prevValid) M4.copy(this.prevVP, this.vpNJ);
      M4.invert(this._tmp, this.vpNJ); M4.mul(this.reproj, this.prevVP, this._tmp);
      cam.update(W / H, jx, jy);
      /* which cascades are redrawn this frame: the near two always, the far two in turn, all of them when the light moved */
      const lightKey = this.sky.version + ':' + this.atlasSize + ':' + s.shadowDistance, all = lightKey !== this._lightKey || this.reset || !this.cascades[3].valid; this._lightKey = lightKey;
      /* the far two take turns only while nothing but the wind moves: a camera that turns needs them where it now looks, or the
         edge of the view samples a map drawn for where it looked a few frames ago */
      const dyn = moved || scene.touched || this.anyWind || all; this._upd = [dyn, dyn, all || moved || (dyn && this.frame % 2 === 0), all || (moved && this.frame % 2 === 0) || (dyn && this.frame % 4 === 1)];
      this._cam = cam; this._cascades(cam); this._collect(scene, cam);
      this.shadowOn = s.shadows && this.sky.lightColor[0] + this.sky.lightColor[1] + this.sky.lightColor[2] > 1e-4;

      /* shadows */
      dev.passBegin('shadows');
      if (this.shadowOn) { const sz = this.atlasSize; dev.bind(this.atlasT, [0, 0, sz * 2, sz * 2]); gl.enable(gl.SCISSOR_TEST);
        for (const C of this.cascades) { if (!this._upd[C.i]) continue; const x = (C.i & 1) * sz, y = (C.i >> 1) * sz; gl.viewport(x, y, sz, sz); gl.scissor(x, y, sz, sz); dev.clear(null, 1);
          this._draw(C.list, 'shadow', p => p.sets({ u_viewProj: C.vp, u_time: time, u_wind: [env.windDir ? env.windDir[0] : 0.8, env.windDir ? env.windDir[1] : 0.6, env.wind] }), C.frustum, null); }
        gl.disable(gl.SCISSOR_TEST); }
      dev.passEnd();

      /* G-buffer */
      dev.passBegin('gbuffer'); dev.bind(T.gbuffer); dev.state({}); dev.clear(null, 1); gl.colorMask(true, true, true, true); dev.S.mask = 1;
      gl.clearBufferfv(gl.COLOR, 0, [0, 0, 0, 0]); gl.clearBufferfv(gl.COLOR, 1, [0.5, 0.5, 1, 0]); gl.clearBufferfv(gl.COLOR, 2, [0, 0, 0, 1]); gl.clearBufferfv(gl.COLOR, 3, [-10, -10, 0, 0]);
      const wind = [env.windDir ? env.windDir[0] : 0.8, env.windDir ? env.windDir[1] : 0.6, env.wind];
      const surf = p => p.sets({ u_viewProj: cam.viewProj, u_viewProjNJ: this.vpNJ, u_prevViewProjNJ: this.prevVP, u_camPos: cam.position, u_time: time, u_prevTime: this.reset ? time : this.prevTime, u_wind: wind, u_wetness: env.wetness, u_night: env.night, u_lodBias: s.taa ? Math.max(-1.2, Math.log2(w / W) + s.textureBias) : 0, u_pxm: cam.proj[5] * h * 0.5, u_adapt: this.post.adapt[this.post.ai ^ 1], u_expo: [s.exposureMin, s.exposureMax, s.exposureKey * Math.pow(2, s.exposure), s.autoExposure ? 1 : 0] });
      this._draw(this.opaque, 'gbuffer', surf, cam.frustum, cam); dev.passEnd();

      const P = cam.proj, projInfo = [1 / P[0], 1 / P[5], P[8], P[9]], nearFar = [cam.near, cam.far], prevColor = T.hist[this.cur ^ 1], hw = this.hw, hh = this.hh, zi = this.frame & 1;
      dev.state({ depthTest: false, cull: 'none' });
      /* occlusion and bounced light */
      dev.passBegin('indirect'); const giOn = s.ao || s.gi;
      if (giOn) {
        dev.bind(T.indRawT[zi]); const pi = dev.program('indirect', CHUNKS.fullscreen_vs, SE.shaders.indirectFS, { GI: s.gi && !this.reset, SLICES: s.giSlices, STEPS: s.giSteps });
        pi.use().sets({ u_depth: T.depth, u_fullRes: [w, h], u_gNormal: T.normal, u_prev: prevColor, u_velocity: T.velocity, u_view: cam.view, u_projInfo: projInfo, u_nearFar: nearFar, u_res: [hw, hh], u_frame: this.noiseFrame, u_params: [s.aoRadius, s.gi ? s.giRadius : s.aoRadius * 1.5, P[5] * hh * 0.5, 0] }); dev.fullscreen(pi);
        dev.bind(T.indHistT[this.cur]); const pt = dev.program('indirect-temporal', CHUNKS.fullscreen_vs, SE.shaders.indirectTemporalFS);
        pt.use().sets({ u_cur: T.indRaw, u_curZ: T.indZ[zi], u_hist: T.indHist[this.cur ^ 1], u_histZ: T.indZ[zi ^ 1], u_velocity: T.velocity, u_blend: this.reset || this.resetInd || !s.taa ? 0 : (moved ? 0.9 : 0.94) }); dev.fullscreen(pt);
        dev.bind(T.indBlurT); const pb = dev.program('indirect-blur', CHUNKS.fullscreen_vs, SE.shaders.indirectBlurFS); pb.use().sets({ u_src: T.indHist[this.cur], u_srcZ: T.indZ[zi], u_res: [hw, hh] }); dev.fullscreen(pb);
      }
      dev.passEnd();
      /* reflections */
      dev.passBegin('reflections'); dev.bind(T.ssrT);
      if (s.ssr && !this.reset) { const pr = dev.program('ssr', CHUNKS.fullscreen_vs, SE.shaders.ssrFS, { SSR_STEPS: s.ssrSteps }); pr.use().sets({ u_depth: T.depth, u_fullRes: [w, h], u_gNormal: T.normal, u_prev: prevColor, u_velocity: T.velocity, u_view: cam.view, u_proj: cam.proj, u_projInfo: projInfo, u_nearFar: nearFar, u_frame: this.noiseFrame, u_params: [s.ssrDistance, 0.5, 0] }); dev.fullscreen(pr); }
      else dev.clear([0, 0, 0, 0]);
      dev.passEnd();

      /* lighting and sky */
      const dbg = s.viewMode !== 'lit';   /* a buffer view is written beside the lit picture, so the passes that read last frame's picture still see it lit */
      this._lights(scene, cam);
      /* the air: fog walked through with the shadows in it, and the clouds, each at half size, for the lighting pass to lay in */
      const vol = this.vol || (this.vol = new Volumetrics(this)), no = this.refused; let cloudsOn = !!s.volumetricClouds && env.clouds > 0.01 && !no.has('volumetricClouds'), fogOn = !!s.volumetricFog && !!s.fog && env.fogDensity > 0 && !dbg && !no.has('volumetricFog'), contactOn = !!s.contactShadows && this.shadowOn && !no.has('contactShadows'), cloudTex = null;
      /* each of these is something a driver may refuse (a shader it will not build): then it is switched off, said so once, and the frame goes on without it */
      if (cloudsOn) { try { cloudTex = vol.renderClouds(cam, s, env, time); } catch (e) { cloudsOn = false; this.refuse('volumetricClouds', e); } }
      if (fogOn) { try { vol.renderFog(cam, T, s, env, time, cloudsOn); } catch (e) { fogOn = false; this.refuse('volumetricFog', e); } }
      dev.passBegin('lighting'); dev.bind(dbg ? T.debugT : T.hdrFlatT); dev.state({ depthTest: false, cull: 'none' });
      let pl; try { pl = dev.program('lighting', CHUNKS.fullscreen_vs, SE.shaders.lightingFS, { DEBUG_VIEW: dbg, CONTACT_SHADOWS: contactOn, VOL_FOG: fogOn, VOL_CLOUDS: cloudsOn }); }
      catch (e) { /* the lighting pass with its extras was refused: the plain one, which every machine that ran the engine before has built */
        if (fogOn) this.refuse('volumetricFog', e); if (cloudsOn) this.refuse('volumetricClouds', e); if (contactOn) this.refuse('contactShadows', e); if (!fogOn && !cloudsOn && !contactOn) throw e; fogOn = cloudsOn = contactOn = false; pl = dev.program('lighting', CHUNKS.fullscreen_vs, SE.shaders.lightingFS, { DEBUG_VIEW: dbg }); }
      const sky = this.sky; pl.use(); this._lightUniforms(pl, cam); pl.set('u_viewProjJ', cam.viewProj);
      if (fogOn) pl.sets({ u_volFog: vol.fog, u_volP: [s.volFogDistance, this.hw, this.hh, 0] }); if (cloudsOn) pl.sets({ u_clouds: cloudTex, u_weather: vol.weather, u_cloudP: vol.params(env, time) });
      pl.sets({ u_gAlbedo: T.albedo, u_gNormal: T.normal, u_gEmissive: T.emissive, u_depth: T.depth, u_indirect: T.indBlur, u_ssr: T.ssr, u_invViewProj: cam.invViewProj, u_nearFar: nearFar, u_halfRes: [hw, hh],
        u_gi: [giOn ? 1 : 0, s.ao ? s.aoIntensity : 0, s.aoPower, s.gi ? s.giIntensity : 0], u_skyParams: [env.clouds, env.cloudSpeed, env.stars, sky.night], u_trueSun: sky.sunDir, u_moonDir: sky.moonDir, u_sunDisc: [sky.lightColor[0], sky.lightColor[1], sky.lightColor[2], sky.sunVisible * 55], u_time: time, u_viewMode: Math.max(0, VIEW_MODES.indexOf(s.viewMode)) });
      dev.fullscreen(pl); dev.passEnd();

      /* transparent surfaces and particles, over the lit picture, tested against its depth */
      dev.passBegin('transparent');
      {
        if (this.transparent.length) { dev.bind(T.hdrT); this._draw(this.transparent, 'forward', p => { surf(p); this._lightUniforms(p, cam); }, cam.frustum, cam); }
        /* particles fade against the scene's depth themselves (soft where they meet a surface), so they draw without a depth buffer */
        dev.bind(T.hdrFlatT); for (const ps of scene.particles) if (ps.active) ps.render(this, cam, time);
        this.engine.emit('renderTransparent', this, cam);
      }
      dev.passEnd();

      /* temporal anti-aliasing into the history, at the screen's size */
      dev.passBegin('taa'); dev.state({ depthTest: false, cull: 'none' }); dev.bind(T.histT[this.cur]);
      const pa = dev.program('taa', CHUNKS.fullscreen_vs, SE.shaders.taaFS); pa.use().sets({ u_cur: T.hdr, u_hist: T.hist[this.cur ^ 1], u_velocity: T.velocity, u_depth: T.depth, u_curRes: [w, h], u_outRes: [W, H], u_jitterUV: [jx * 0.5, jy * 0.5], u_reproj: this.reproj, u_taa: [!s.taa || this.reset ? 0 : 1, s.taaStill, up > 1.05 ? s.taaMoving * 1.6 : s.taaMoving, up > 1.05 ? s.taaKeepUp : s.taaKeep], u_taa2: [s.taaTol, 0, 0, 0] }); dev.fullscreen(pa);
      dev.passEnd();

      /* outlines' mask, then everything that happens to the finished picture */
      this._mask(cam, time, wind);
      if (this.hzb && s.occlusionCull) this.hzb.capture(T.depth, this.vpNJ, cam);
      this.post.run(T.hist[this.cur], T, time, dt, dbg ? T.debug : null);
      dev.passBegin('overlay'); this.lines.flush(dev, this.vpNJ, [W, H], T.depth); this.engine.emit('renderOverlay', this, cam); dev.passEnd();

      for (const r of this.seen) if (r.prevWorld) r.prevWorld.set(r.entity.transform.world);
      M4.copy(this.prevVP, this.vpNJ); this.prevValid = true; this.prevTime = time; this.cur ^= 1; this.frame++; this.reset = false; this.resetInd = false; scene.touched = false; dev.frame++;
      void skyChanged; void IDENT;
    }

    /* the selected (and hovered) things drawn flat into a mask the last pass turns into outlines */
    _mask(cam, time, wind) {
      const dev = this.dev, T = this.T; this.maskOn = false; if (!this.outlines.size) return;
      dev.bind(T.maskT); dev.clear([0, 0, 0, 0]); let any = false;
      this.outlines.forEach(o => { if (!o.items.length) return; const list = o.items.map(it => ({ mesh: it.mesh, mat: it.material || Renderer.flat, world: it.world || IDENT, prev: IDENT, inst: it.instances || null }));
        this._draw(list, 'mask', p => p.sets({ u_viewProj: this.vpNJ, u_time: time, u_wind: wind, u_maskColor: o.channel ? [0, 1, 0, 0] : [1, 0, 0, 0] }), null, null); any = true; });
      this.maskOn = any;
    }
    /* outline a set of meshes: key names the set ('select' draws the strong outline, anything else the light one); items are [{ mesh, world }] or renderers */
    setOutline(key, items) { if (!items || !items.length) this.outlines.delete(key); else this.outlines.set(key, { channel: key === 'select' ? 0 : 1, items: items.map(i => (i.entity ? { mesh: i.mesh, world: i.entity.transform.world, instances: i.instances } : i)) }); this.engine.requestRender(); }
    get viewModes() { return VIEW_MODES; }
    dispose() { const T = this.T || {}; Object.values(T).forEach(x => { if (Array.isArray(x)) x.forEach(y => y.dispose && y.dispose()); else if (x && x.dispose) x.dispose(); }); this.sky.dispose(); if (this.atlas) { this.atlas.dispose(); this.atlasT.dispose(); } }
  }
  Renderer.defaults = {
    renderScale: 1, maxPixelRatio: 1.5, lodBias: 1, clusterCull: true, occlusionCull: false,
    shadows: true, shadowSize: 1536, shadowDistance: 280, shadowLambda: 0.78, shadowSoftness: 0.09, shadowCasterReach: 420,
    ao: true, aoRadius: 2.4, aoIntensity: 1, aoPower: 1.35, gi: true, giRadius: 9, giIntensity: 1, giSlices: 2, giSteps: 6,
    ssr: true, ssrSteps: 26, ssrDistance: 90, taa: true, taaStill: 48, taaMoving: 9, taaKeep: 0.85, taaKeepUp: 0.85, taaTol: 0.02, textureBias: -0.25, fineMinPx: 0.75, fog: true,
    volumetricFog: true, volFogDistance: 420, volFogSteps: 16, volFogLights: 1, volumetricClouds: true, cloudSteps: 28,
    contactShadows: true, dynamicRes: true, renderScaleMin: 0.55, motionBlur: 0, dof: false, dofFocus: 0, dofAperture: 1.4, dofMax: 14,
    shafts: true, shaftIntensity: 0.22, shaftClamp: 60, bloom: true, bloomIntensity: 0.045, autoExposure: true, exposure: 0, exposureKey: 0.135, exposureMin: 0.014, exposureMax: 12, adaptSpeed: 1.6, adaptFloor: 0.5,
    tonemap: 'aces', contrast: 1.04, saturation: 1.05, temperature: 0, vignette: 0.22, grain: 0.004, chromatic: 0, sharpen: 0.3, viewMode: 'lit',   /* grain: just enough to keep a smooth sky from banding; more than that reads as the picture crawling */
    outlineColor: [1, 1, 1], outlineWidth: 2,
  };
  Renderer.flat = new Material({ name: 'flat' });
  SE.Renderer = Renderer;

  /* ==== x-ray: a layer of its own, seen through the walls ==== */
  /* What is inside a building (its ducts, its air handlers, the pipes up its core) is drawn into a picture of its own with
     its own depth, so its parts hide one another properly, and then laid over the lit scene: at full strength where
     nothing stands in front of it, and still plainly, with the wall dimmed to a ghost, where a wall or a roof does. It
     goes in before the temporal filter, so its edges are as smooth as the scene's. Colours are marks, not lamps: they keep
     their brightness on screen at noon and at night. */
  const XRAY_VS = `
layout(location=0) in vec3 a_position; layout(location=1) in vec3 a_normal; layout(location=3) in vec4 a_color;
uniform mat4 u_viewProj, u_world; uniform vec3 u_camPos; out vec3 v_n; out vec3 v_w; out vec4 v_c;
void main() { vec4 w = u_world * vec4(a_position, 1.0); v_n = mat3(u_world) * a_normal;
  /* far off, a duct a hand wide would be thinner than a pixel: parts swell a little with distance so the system still reads */
  w.xyz += normalize(v_n) * min(0.0013 * distance(u_camPos, w.xyz), 0.6); v_w = w.xyz; v_c = a_color; gl_Position = u_viewProj * w; }`;
  const XRAY_FS = `
in vec3 v_n; in vec3 v_w; in vec4 v_c; uniform vec3 u_camPos, u_sun; uniform float u_time; out vec4 o_color;
void main() {
  vec3 N = normalize(v_n), V = normalize(u_camPos - v_w), base = pow(v_c.rgb, vec3(2.2));
  float key = max(dot(N, normalize(u_sun + vec3(0.0, 0.6, 0.0))), 0.0), head = max(dot(N, V), 0.0), rim = pow(1.0 - head, 3.0);
  /* alpha under one marks what moves air or water: a slow band runs along it, the way the flow goes */
  float flow = v_c.a < 0.99 ? 0.5 + 0.5 * sin(dot(v_w, vec3(1.7, 2.3, 1.9)) - u_time * 3.2) : 0.0;
  vec3 col = base * (0.34 + 0.4 * key + 0.34 * head) + base * rim * 0.55 + vec3(rim * 0.12) + base * flow * 0.22;
  o_color = vec4(col, 1.0);
}`;
  const XRAY_COMP_FS = `
in vec2 v_uv; uniform sampler2D u_x, u_xz, u_depth, u_adapt; uniform vec4 u_expo; uniform vec2 u_res, u_nearFar; uniform float u_strength, u_dim; out vec4 o_color;
float lin(float d) { float z = d * 2.0 - 1.0; return 2.0 * u_nearFar.x * u_nearFar.y / (u_nearFar.y + u_nearFar.x - z * (u_nearFar.y - u_nearFar.x)); }
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy); vec4 x = texelFetch(u_x, p, 0); float xz = texelFetch(u_xz, p, 0).r;
  /* a thin dark line round every part, from its neighbours in the layer, so shapes read against each other */
  float a = x.a, edge = 0.0; for (int i = 0; i < 4; i++) { ivec2 o = ivec2(i == 0 ? 1 : i == 1 ? -1 : 0, i == 2 ? 1 : i == 3 ? -1 : 0); float nz = texelFetch(u_xz, p + o, 0).r; edge = max(edge, abs(lin(nz) - lin(xz)) / max(lin(xz), 0.5)); }
  if (a < 0.5) { /* beside a part: a soft halo so the layer sits on the picture */ float h = 0.0; for (int i = 0; i < 4; i++) { ivec2 o = ivec2(i == 0 ? 2 : i == 1 ? -2 : 0, i == 2 ? 2 : i == 3 ? -2 : 0); h = max(h, texelFetch(u_x, p + o, 0).a); } /* everything else goes dim and a little cold, the way a film does round what it shows */ float adapted0 = clamp(textureLod(u_adapt, vec2(0.5), 0.0).r, u_expo.x, u_expo.y), ex0 = u_expo.w > 0.5 ? u_expo.z / adapted0 : u_expo.z / 0.135; o_color = vec4(vec3(0.012, 0.02, 0.034) / max(ex0, 1e-4) * step(h, 0.5), max(u_dim, 0.5 * step(0.5, h)) * u_strength); return; }
  float sz = texelFetch(u_depth, p, 0).r, behind = step(lin(sz) + 0.06 + 0.004 * lin(sz), lin(xz));
  float adapted = clamp(textureLod(u_adapt, vec2(0.5), 0.0).r, u_expo.x, u_expo.y), ex = u_expo.w > 0.5 ? u_expo.z / adapted : u_expo.z / 0.135;
  vec3 col = x.rgb * mix(1.0, 0.45, smoothstep(0.02, 0.12, edge)) * (0.8 / max(ex, 1e-4));
  o_color = vec4(col * mix(1.0, 0.88, behind), mix(1.0, 0.93, behind) * u_strength);
}`;
  class XRay {
    constructor(engine) {
      this.engine = engine; this.dev = engine.device; this.items = new Set(); this.on = false; this.strength = 1; this.dim = 0.42; this.w = 0; this.h = 0; this.drawn = 0;
      engine.on('renderTransparent', (R, cam) => this.render(R, cam));
    }
    /* add a mesh (its vertex colours are its code); returns the item to remove later */
    add(mesh, world) { const it = { mesh, world: world || M4.create(), hidden: false }; this.items.add(it); this.engine.requestRender(); return it; }
    remove(it) { this.items.delete(it); this.engine.requestRender(); }
    render(R, cam) {
      this.drawn = 0; if (!this.on || !this.items.size || R.settings.viewMode !== 'lit' || R.refused.has('x-ray')) return; const dev = this.dev, T = R.T, w = R.w, h = R.h; let p, pc;
      try { p = dev.program('xray-mesh', XRAY_VS, XRAY_FS); pc = dev.program('xray-comp', CHUNKS.fullscreen_vs, XRAY_COMP_FS); } catch (e) { R.refuse('x-ray', e); return; }
      if (!this.T || this.w !== w || this.h !== h) { if (this.T) { this.T.dispose(); this.color.dispose(); this.depth.dispose(); } this.w = w; this.h = h; this.color = dev.texture({ w, h, format: 'rgba8', filter: 'nearest' }); this.depth = dev.texture({ w, h, format: 'depth24', filter: 'nearest' }); this.T = dev.target({ color: [this.color], depth: this.depth }); }
      dev.bind(this.T); dev.state({ cull: 'none' }); dev.clear([0, 0, 0, 0], 1);
      p.use().sets({ u_viewProj: cam.viewProj, u_camPos: cam.position, u_sun: R.sky.lightDir || [0.3, 0.8, 0.4], u_time: this.engine.time.now || 0 });
      for (const it of this.items) { if (it.hidden || !it.mesh) continue; const B = it.mesh.bounds, wm = it.world; if (B && !cam.frustum.sphere(wm[0] * B.center[0] + wm[4] * B.center[1] + wm[8] * B.center[2] + wm[12], wm[1] * B.center[0] + wm[5] * B.center[1] + wm[9] * B.center[2] + wm[13], wm[2] * B.center[0] + wm[6] * B.center[1] + wm[10] * B.center[2] + wm[14], B.radius * M4.maxScale(wm))) continue; p.sets({ u_world: wm }); it.mesh.draw(); this.drawn++; }
      if (this.drawn) { dev.bind(T.hdrFlatT); dev.state({ depthTest: false, cull: 'none', blend: 'alpha' }); const s = R.settings;
        pc.use().sets({ u_x: this.color, u_xz: this.depth, u_depth: T.depth, u_adapt: R.post.adapt[R.post.ai ^ 1], u_expo: [s.exposureMin, s.exposureMax, s.exposureKey * Math.pow(2, s.exposure), s.autoExposure ? 1 : 0], u_res: [w, h], u_nearFar: [cam.near, cam.far], u_strength: this.strength, u_dim: this.dim }); dev.fullscreen(pc); }
      dev.state({ depthTest: false, cull: 'none' });
    }
  }
  SE.XRay = XRay;

  /* ==== the air: fog the light can be seen in, and clouds with depth ==== */
  /* Two pictures at half the size of the frame, made before the lighting pass and laid in by it.
     Fog: every pixel's ray is walked from the eye to the surface it ends on (or a set distance), with more steps near the
     eye. At each step the air scatters some light toward the eye: the sun's if the step is not in a shadow (the shadow
     cascades are asked, and the clouds' shadow), the sky's regardless, and the light of any lamp whose cluster the step
     falls in. So shadows stand in the haze as shafts, and a street lamp has a glow round it in fog. Past the walked
     distance the old analytic haze takes over, with the same density, so the two join without a seam.
     Clouds: a shell of air 1.5 to 3.3 km up, its density from a tiling 3D noise (a Perlin-Worley shape, worn away at
     the edges by finer Worley) under a weather map that says where clouds stand, all made once on the GPU. Each ray is
     walked through the shell; at each dense step a short second walk toward the sun says how much light gets there.
     The result is blended with last frame's (reprojected by the camera's turn), so a few steps look like many. The same
     weather map throws the clouds' shadows on the city. Nothing here is a froxel grid or a compute shader: WebGL2 has
     neither a 3D render target worth using nor compute, so both are done as full-screen passes. */
  const VOL_NOISE_GEN_FS = `
in vec2 v_uv; out vec4 o_color; uniform float u_mode;
vec3 h33(vec3 p) { p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
float worley(vec3 p, float fr) { p *= fr; vec3 i = floor(p), f = fract(p); float d = 1.0;
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++) { vec3 g = vec3(float(x), float(y), float(z)), r = g + h33(mod(i + g, fr)) - f; d = min(d, dot(r, r)); }
  return 1.0 - clamp(sqrt(d), 0.0, 1.0); }
float vn(vec3 p, float fr) { p *= fr; vec3 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  float a = h33(mod(i, fr)).x, b = h33(mod(i + vec3(1.0, 0.0, 0.0), fr)).x, c = h33(mod(i + vec3(0.0, 1.0, 0.0), fr)).x, d = h33(mod(i + vec3(1.0, 1.0, 0.0), fr)).x;
  float e = h33(mod(i + vec3(0.0, 0.0, 1.0), fr)).x, g = h33(mod(i + vec3(1.0, 0.0, 1.0), fr)).x, h = h33(mod(i + vec3(0.0, 1.0, 1.0), fr)).x, k = h33(mod(i + vec3(1.0, 1.0, 1.0), fr)).x;
  return mix(mix(mix(a, b, u.x), mix(c, d, u.x), u.y), mix(mix(e, g, u.x), mix(h, k, u.x), u.y), u.z); }
void main() {
  if (u_mode > 0.5) {   /* the weather map: where clouds stand (r), how tall they grow (g) */
    vec3 p = vec3(v_uv, 0.37); float n = vn(p, 4.0) * 0.5 + vn(p, 8.0) * 0.27 + vn(p, 16.0) * 0.15 + vn(p, 32.0) * 0.08, w = worley(p, 6.0) * 0.7 + worley(p, 12.0) * 0.3;
    o_color = vec4(clamp(n * 0.62 + w * 0.5, 0.0, 1.0), vn(vec3(v_uv, 0.81), 5.0), 0.0, 1.0); return; }
  vec2 a = gl_FragCoord.xy - 0.5, tile = floor(a / 66.0), t = a - tile * 66.0 - 1.0; float z = tile.x + tile.y * 8.0; vec3 p = vec3(fract((t + 0.5) / 64.0), (z + 0.5) / 64.0);
  float w1 = worley(p, 4.0), w2 = worley(p, 8.0), w3 = worley(p, 16.0), wf = w1 * 0.625 + w2 * 0.25 + w3 * 0.125, pn = (vn(p, 4.0) * 0.5 + vn(p, 8.0) * 0.25 + vn(p, 16.0) * 0.125 + vn(p, 32.0) * 0.0625) / 0.9375;
  float base = clamp((pn - (wf - 1.0)) / (2.0 - wf), 0.0, 1.0), det = worley(p, 12.0) * 0.625 + worley(p, 24.0) * 0.25 + worley(p, 32.0) * 0.125;
  o_color = vec4(base, det, w1, 1.0);
}`;
  /* what the cloud and fog passes and the lighting pass share: the weather over a point, and the clouds' shadow on it */
  CHUNKS.cloudshadow = `
uniform sampler2D u_weather; uniform vec4 u_cloudP;   /* cover, drift x, drift z, time */
float cloudCover(vec2 xz) { float w = textureLod(u_weather, (xz + u_cloudP.yz) / 40000.0, 0.0).r, cov = u_cloudP.x, thr = mix(0.78, 0.05, pow(cov, 0.8)); return clamp((w - thr) / 0.3, 0.0, 1.0); }
float cloudShadow(vec3 wpos, vec3 L) { if (L.y < 0.04 || u_cloudP.x < 0.01) return 1.0; vec3 p = wpos + L * ((2200.0 - wpos.y) / L.y); return 1.0 - 0.72 * smoothstep(0.45, 0.95, cloudCover(p.xz)); }`;
  const VOL_FOG_FS = `
#include <common>
#include <lighting>
#ifdef VOL_CLOUDS
#include <cloudshadow>
#endif
in vec2 v_uv; out vec4 o_color;
uniform sampler2D u_depth; uniform mat4 u_invViewProj; uniform vec2 u_nearFar, u_fullRes; uniform vec4 u_vol;   /* reach, steps, lamps' strength, how far forward the air throws light */
float linZ(float d) { float z = d * 2.0 - 1.0; return 2.0 * u_nearFar.x * u_nearFar.y / (u_nearFar.y + u_nearFar.x - z * (u_nearFar.y - u_nearFar.x)); }
float shadow1(vec3 wpos, float viewZ) {
  if (u_shadowParams.z < 0.5 || viewZ >= u_splits.w) return 1.0; int c = viewZ < u_splits.x ? 0 : viewZ < u_splits.y ? 1 : viewZ < u_splits.z ? 2 : 3;
  vec4 sc = u_shadowMat[c] * vec4(wpos, 1.0); vec2 base = vec2(float(c & 1), float(c >> 1)) * 0.5; float m = u_shadowParams.x * 1.5;
  return textureLod(u_shadowMap, vec3(clamp(sc.xy, base + m, base + 0.5 - m), sc.z - 0.0002), 0.0); }   /* an explicit level: this is called from a loop that may stop early */
vec3 lamps(vec3 wpos, float viewZ, vec2 frag) {
  if (u_clusterParams.z < 0.5) return vec3(0.0);
  ivec2 tile = ivec2(clamp(frag * u_invRes, 0.0, 0.9999) * vec2(${CL.X}.0, ${CL.Y}.0));
  int slice = clamp(int(log(max(viewZ, u_clusterParams.x) / u_clusterParams.x) * u_clusterParams.y), 0, ${CL.Z - 1});
  int ci = tile.x + tile.y * ${CL.X} + slice * ${CL.X * CL.Y};
  vec2 oc = texelFetch(u_clusterGrid, ivec2(ci % ${CL.GW}, ci / ${CL.GW}), 0).rg; int off = int(oc.x + 0.5), cnt = int(oc.y + 0.5); vec3 sum = vec3(0.0);
  for (int i = 0; i < ${CL.PER}; i++) {
    if (i >= cnt) break; int k = off + i, li = int(texelFetch(u_clusterIdx, ivec2(k % ${CL.IW}, k / ${CL.IW}), 0).r + 0.5);
    vec4 pr = texelFetch(u_lightData, ivec2(0, li), 0), cc = texelFetch(u_lightData, ivec2(1, li), 0), dd = texelFetch(u_lightData, ivec2(2, li), 0);
    vec3 Lv = pr.xyz - wpos; float d2 = dot(Lv, Lv), d = sqrt(d2); if (d >= pr.w) continue;
    float win = clamp(1.0 - pow(d / pr.w, 4.0), 0.0, 1.0), att = win * win / (d2 + 1.0); if (cc.w > 0.5) att *= smoothstep(dd.w, mix(dd.w, 1.0, cc.w - 1.0), dot(-Lv / max(d, 1e-4), dd.xyz));
    sum += cc.rgb * att; }
  return sum; }
void main() {
  float depth = textureLod(u_depth, v_uv, 0.0).r; vec4 wp = u_invViewProj * vec4(v_uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0); vec3 ray = wp.xyz / wp.w - u_camPos; float dist = length(ray); vec3 dir = ray / max(dist, 1e-4);
  float zPer = depth >= 1.0 ? dot(dir, -vec3(u_view[0][2], u_view[1][2], u_view[2][2])) : linZ(depth) / max(dist, 1e-4), tMax = depth >= 1.0 ? u_vol.x : min(dist, u_vol.x);
  int N = int(u_vol.y); float j = ign(gl_FragCoord.xy, u_frame), mu = dot(dir, u_sunDir), g = u_vol.w, phase = (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * mu, 1.5);
  vec3 hz = skyRadiance(normalize(vec3(dir.x, max(dir.y, 0.0) * 0.4 + 0.03, dir.z))), glow = u_sunColor * (u_fog.z * 0.03 * pow(clamp(mu, 0.0, 1.0), 8.0));
  float ks = 0.58 * smoothstep(-0.02, 0.14, u_sunDir.y) * clamp(phase * 0.6 + 0.55, 0.6, 1.5); ks = min(ks, 0.85);
  vec3 L = vec3(0.0); float T = 1.0, tPrev = 0.0;
  for (int i = 0; i < 32; i++) { if (i >= N) break;
    float f = (float(i) + j) / float(N), t = tMax * f * f, dt = t - tPrev; tPrev = t; vec3 p = u_camPos + dir * t;
    float dens = u_fog.x * exp(-max(p.y, 0.0) * u_fog.y), Tr = exp(-dens * dt), vz = t * zPer, sh = shadow1(p, vz);
#ifdef VOL_CLOUDS
    sh *= cloudShadow(p, u_sunDir);
#endif
    vec3 J = hz * (1.0 - ks) + (hz * ks + glow) * sh;
    if (u_vol.z > 0.0) J += lamps(p, vz, v_uv * u_fullRes) * (u_vol.z * 0.0796);
    L += T * J * (1.0 - Tr); T *= Tr; }
  if (any(isnan(L)) || any(isinf(L)) || !(T >= 0.0)) { L = vec3(0.0); T = 1.0; }
  o_color = vec4(L, T);
}`;
  const VOL_CLOUD_FS = `
#include <common>
#include <cloudshadow>
in vec2 v_uv; out vec4 o_color;
uniform sampler2D u_noise, u_hist; uniform mat4 u_invViewProj, u_reproj; uniform vec3 u_camPos, u_sunDir, u_sunColor, u_ambTop, u_ambBot; uniform vec4 u_cl;   /* steps, frame, blend with last frame, 0 */
const float RE = 6360000.0, C0 = 1500.0, C1 = 3300.0;
vec2 noise3(vec3 p) { p = fract(p); float z = p.z * 64.0 - 0.5, z0 = floor(z), fz = z - z0, za = mod(z0 + 64.0, 64.0), zb = mod(z0 + 65.0, 64.0); vec2 uv = p.xy * 64.0 + 1.0;
  return mix(textureLod(u_noise, (vec2(mod(za, 8.0), floor(za / 8.0)) * 66.0 + uv) / 528.0, 0.0).rg, textureLod(u_noise, (vec2(mod(zb, 8.0), floor(zb / 8.0)) * 66.0 + uv) / 528.0, 0.0).rg, fz); }
float density(vec3 p, bool fine, out float h) {
  h = (length(p + vec3(0.0, RE, 0.0)) - RE - C0) / (C1 - C0); if (h <= 0.0 || h >= 1.0) return 0.0;
  float lc = cloudCover(p.xz); if (lc <= 0.0) return 0.0; float tall = textureLod(u_weather, (p.xz + u_cloudP.yz) / 40000.0, 0.0).g;
  float prof = smoothstep(0.0, 0.1, h) * smoothstep(mix(0.5, 1.0, lc * (0.55 + 0.45 * tall)), mix(0.18, 0.5, lc), h);
  vec3 q = (p + vec3(u_cloudP.y, 0.0, u_cloudP.z)) / 5600.0; float shape = noise3(q).r, d = clamp((shape * prof - (1.0 - lc)) / max(lc, 0.02), 0.0, 1.0) * lc;
  if (fine && d > 0.0) { float det = noise3(q * 5.3 + vec3(u_cloudP.w * 0.004, 0.0, 0.0)).g; d = clamp((d - (1.0 - det) * 0.3 * (1.0 - 0.35 * h)) * 1.28, 0.0, 1.0); }
  return d; }
float hg(float mu, float g) { return (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * mu, 1.5); }
void main() {
  vec4 wp = u_invViewProj * vec4(v_uv * 2.0 - 1.0, 1.0, 1.0); vec3 dir = normalize(wp.xyz / wp.w - u_camPos); vec4 outc = vec4(0.0, 0.0, 0.0, 1.0);
  if (dir.y > 0.006 && u_cloudP.x > 0.01) {
    float ry = RE + max(u_camPos.y, 0.0), b = ry * dir.y, c0 = ry * ry - (RE + C0) * (RE + C0), c1 = ry * ry - (RE + C1) * (RE + C1), t0 = -b + sqrt(max(b * b - c0, 0.0)), t1 = min(-b + sqrt(max(b * b - c1, 0.0)), 70000.0);
    if (t1 > t0) { int N = int(u_cl.x); float st = (t1 - t0) / float(N), j = ign(gl_FragCoord.xy, u_cl.y), mu = dot(dir, u_sunDir), ph = min(mix(hg(mu, 0.76), hg(mu, -0.2), 0.45) * 0.26, 2.2), T = 1.0, h; vec3 L = vec3(0.0); const float SIG = 0.011;
      for (int i = 0; i < 48; i++) { if (i >= N || T < 0.02) break; vec3 p = u_camPos + dir * (t0 + st * (float(i) + j)); float d = density(p, true, h); if (d <= 0.001) continue;
        /* a short walk toward the sun: how much of its light reaches this point through the cloud above */
        float od = 0.0, hh, ls = 70.0; vec3 lp = p; for (int k = 0; k < 5; k++) { lp += u_sunDir * ls; od += density(lp, false, hh) * ls; ls *= 1.75; }
        od *= SIG; float sunT = max(exp(-od), 0.62 * exp(-0.2 * od)), powder = 1.0 - exp(-od * 2.0 - d * 3.0);
        vec3 J = u_sunColor * (sunT * ph * mix(1.0, 0.45 + 0.9 * powder, 0.5)) + mix(u_ambBot, u_ambTop, clamp(h * 1.15, 0.0, 1.0)) * (0.55 + 0.45 * sunT);
        float Tr = exp(-d * SIG * st); L += T * J * (1.0 - Tr); T *= Tr; }
      /* far clouds sink into the air between: they fade toward the sky behind them */
      float fade = exp(-(t0 * t0) / (38000.0 * 38000.0)); outc = vec4(L * fade, mix(1.0, T, fade)); } }
  vec4 pc = u_reproj * vec4(v_uv * 2.0 - 1.0, 1.0, 1.0); vec2 puv = pc.xy / pc.w * 0.5 + 0.5; float w = pc.w > 0.0 && puv.x > 0.0 && puv.y > 0.0 && puv.x < 1.0 && puv.y < 1.0 ? u_cl.z : 0.0;
  if (any(isnan(outc)) || any(isinf(outc))) outc = vec4(0.0, 0.0, 0.0, 1.0);
  vec4 hist = textureLod(u_hist, puv, 0.0); if (any(isnan(hist)) || any(isinf(hist))) w = 0.0;
  o_color = w > 0.0 ? mix(outc, hist, w) : outc;
}`;
  class Volumetrics {
    constructor(renderer) { this.r = renderer; this.dev = renderer.dev; this.w = 0; this.h = 0; this.ci = 0; this.fresh = true; this.noise = null; this.weather = null; }
    /* the noise the clouds are cut from, and the weather map: made once, on the GPU */
    _gen() {
      const dev = this.dev, p = dev.program('vol-noise-gen', CHUNKS.fullscreen_vs, VOL_NOISE_GEN_FS);
      this.noise = dev.texture({ w: 528, h: 528, format: 'rgba8', filter: 'linear', wrap: 'clamp', name: 'cloud noise (64 cubed, as 8 by 8 slices)' }); const tn = dev.target({ color: [this.noise] }); dev.bind(tn); dev.state({ depthTest: false, cull: 'none' }); p.use().set('u_mode', 0); dev.fullscreen(p); tn.dispose();
      this.weather = dev.texture({ w: 256, h: 256, format: 'rgba8', filter: 'linear', wrap: 'repeat', name: 'weather map' }); const tw = dev.target({ color: [this.weather] }); dev.bind(tw); p.set('u_mode', 1); dev.fullscreen(p); tw.dispose();
    }
    _size(w, h) {
      if (this.w === w && this.h === h && this.fog) return; const dev = this.dev, old = this.cloud && !this.fresh ? this.cloud : null, oldT = this.cloudT; if (old) { this.cloud = null; this.cloudT = null; } this.dispose(true); this.w = w; this.h = h;
      this.fog = dev.texture({ w, h, format: 'rgba16f', wrap: 'clamp' }); this.fogT = dev.target({ color: [this.fog] });
      this.cloud = [0, 1].map(() => dev.texture({ w, h, format: 'rgba16f', wrap: 'clamp' })); this.cloudT = this.cloud.map(t => dev.target({ color: [t] })); this.fresh = true;
      /* a new size (the dynamic resolution moved): the clouds gathered so far are carried into it, so the sky does not start again from one noisy frame */
      if (old) { try { const pc = dev.program('copy', CHUNKS.fullscreen_vs, 'out vec4 o_color; in vec2 v_uv; uniform sampler2D u_src; void main() { o_color = texture(u_src, v_uv); }'); dev.state({ depthTest: false, cull: 'none' }); pc.use(); [0, 1].forEach(i => { dev.bind(this.cloudT[i]); pc.set('u_src', old[i]); dev.fullscreen(pc); }); this.fresh = false; } catch (e) { this.fresh = true; } old.forEach(t => t.dispose()); oldT.forEach(t => t.dispose()); }
    }
    dispose(keepNoise) { ['fog', 'fogT'].forEach(k => { if (this[k]) { this[k].dispose(); this[k] = null; } }); if (this.cloud) { this.cloud.forEach(t => t.dispose()); this.cloudT.forEach(t => t.dispose()); this.cloud = null; } if (!keepNoise && this.noise) { this.noise.dispose(); this.weather.dispose(); this.noise = null; } }
    /* cover and drift of the clouds this frame, for every shader that asks */
    params(env, time) { const sp = (env.cloudSpeed == null ? 1 : env.cloudSpeed) * 14, wd = env.windDir || [0.8, 0.6]; return [env.clouds, wd[0] * sp * time, wd[1] * sp * time, time]; }
    renderFog(cam, T, s, env, time, clouds) {
      const dev = this.dev, r = this.r, p = dev.program('vol-fog', CHUNKS.fullscreen_vs, VOL_FOG_FS, { VOL_CLOUDS: clouds }); this._size(r.hw, r.hh); if (!this.noise) this._gen();
      dev.passBegin('fog'); dev.bind(this.fogT); dev.state({ depthTest: false, cull: 'none' }); p.use(); r._lightUniforms(p, cam);
      p.sets({ u_depth: T.depth, u_invViewProj: cam.invViewProj, u_nearFar: [cam.near, cam.far], u_fullRes: [r.w, r.h], u_vol: [s.volFogDistance, Math.min(32, s.volFogSteps), s.volFogLights, 0.55], u_weather: this.weather, u_cloudP: this.params(env, time) });
      dev.fullscreen(p); dev.passEnd();
    }
    renderClouds(cam, s, env, time) {
      const dev = this.dev, r = this.r, sky = r.sky, p = dev.program('vol-clouds', CHUNKS.fullscreen_vs, VOL_CLOUD_FS); this._size(r.hw, r.hh); if (!this.noise) this._gen(); this.ci ^= 1;
      const night = sky.night || 0, a0 = [sky.sh[0], sky.sh[1], sky.sh[2]], glowUp = [0.05 * night, 0.032 * night, 0.016 * night];
      dev.passBegin('clouds'); dev.bind(this.cloudT[this.ci]); dev.state({ depthTest: false, cull: 'none' });
      p.use().sets({ u_noise: this.noise, u_weather: this.weather, u_hist: this.cloud[this.ci ^ 1], u_invViewProj: cam.invViewProj, u_reproj: r.reproj, u_camPos: cam.position, u_sunDir: sky.lightDir, u_sunColor: sky.lightColor,
        u_ambTop: a0.map(v => v * 2.5), u_ambBot: a0.map((v, i) => v * 1.25 + glowUp[i]), u_cloudP: this.params(env, time), u_cl: [Math.min(48, s.cloudSteps), r.noiseFrame, this.fresh || r.reset ? 0 : (r.camMoved ? 0.88 : 0.94), 0] });   /* at rest the clouds gather for longer: they drift slowly, and fewer steps then look like more */
      dev.fullscreen(p); dev.passEnd(); this.fresh = false; return this.cloud[this.ci];
    }
  }
  SE.Volumetrics = Volumetrics;

  /* ==== after the picture is lit: bloom, eye adaptation, tone mapping and grading; lines and outlines; occlusion ==== */
  const BLOOM_DOWN_FS = `
#include <common>
in vec2 v_uv; out vec4 o_color; uniform sampler2D u_src; uniform vec2 u_texel; uniform float u_first;
vec3 S(vec2 o) { vec3 c = texture(u_src, v_uv + o * u_texel).rgb; return any(isnan(c)) || any(isinf(c)) ? vec3(0.0) : min(c, vec3(120.0)); }
float kw(vec3 c) { return 1.0 / (1.0 + luma(c)); }
void main() {
  vec3 a = S(vec2(-2, 2)), b = S(vec2(0, 2)), c = S(vec2(2, 2)), d = S(vec2(-2, 0)), e = S(vec2(0, 0)), f = S(vec2(2, 0)), g = S(vec2(-2, -2)), h = S(vec2(0, -2)), i = S(vec2(2, -2)), j = S(vec2(-1, 1)), k = S(vec2(1, 1)), l = S(vec2(-1, -1)), m = S(vec2(1, -1));
  vec3 r;
  if (u_first > 0.5) { vec3 g0 = (a + b + d + e) * 0.25, g1 = (b + c + e + f) * 0.25, g2 = (d + e + g + h) * 0.25, g3 = (e + f + h + i) * 0.25, g4 = (j + k + l + m) * 0.25; float w0 = kw(g0), w1 = kw(g1), w2 = kw(g2), w3 = kw(g3), w4 = kw(g4); r = (g0 * w0 + g1 * w1 + g2 * w2 + g3 * w3) * 0.125 + g4 * w4 * 0.5; r /= (w0 + w1 + w2 + w3) * 0.125 + w4 * 0.5; }
  else r = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  o_color = vec4(max(r, vec3(0.0)), 1.0);
}`;
  const BLOOM_UP_FS = `
in vec2 v_uv; out vec4 o_color; uniform sampler2D u_src; uniform vec2 u_texel;
void main() { vec2 t = u_texel; vec3 r = texture(u_src, v_uv).rgb * 4.0;
  r += (texture(u_src, v_uv + vec2(t.x, 0.0)).rgb + texture(u_src, v_uv - vec2(t.x, 0.0)).rgb + texture(u_src, v_uv + vec2(0.0, t.y)).rgb + texture(u_src, v_uv - vec2(0.0, t.y)).rgb) * 2.0;
  r += texture(u_src, v_uv + t).rgb + texture(u_src, v_uv - t).rgb + texture(u_src, v_uv + vec2(t.x, -t.y)).rgb + texture(u_src, v_uv + vec2(-t.x, t.y)).rgb;
  o_color = vec4(r / 16.0, 1.0); }`;
  /* how bright the picture is: the root of its luminance (between the plain mean, which the sky rules, and the log mean, which
     the shadows rule), weighted toward the middle and the ground, averaged by the mip chain */
  const LUM_FS = `
#include <common>
in vec2 v_uv; out vec4 o_color; uniform sampler2D u_src;
void main() { float l = sqrt(min(luma(texture(u_src, v_uv).rgb), 64.0)), w = (1.0 - 0.55 * smoothstep(0.5, 1.0, v_uv.y)) * (1.0 - 0.5 * smoothstep(0.25, 0.72, length(v_uv - 0.5))); o_color = vec4(l * w, w, 0.0, 1.0); }`;
  const ADAPT_FS = `
in vec2 v_uv; out vec4 o_color; uniform sampler2D u_lum, u_prev; uniform float u_k, u_top, u_floor; uniform vec2 u_range;
/* The eye's setting is eased in stops, as an eye's is, so going dark takes no longer than going bright; within the range the
   picture can use, so no time is spent crossing values that show no change; and never slower than a set pace, so the last
   of it ends. (Eased as plain brightness, a switch from day to night was still drifting five seconds on: the whole
   picture kept changing with nothing in it moving.) */
void main() { vec2 a = textureLod(u_lum, vec2(0.5), u_top).rg; float cur = a.r / max(a.g, 1e-4); cur *= cur; if (!(cur >= 0.0) || isinf(cur)) cur = 0.135; float prev = textureLod(u_prev, vec2(0.5), 0.0).r; if (!(prev >= 0.0) || isinf(prev)) prev = cur;
  cur = clamp(cur, u_range.x, u_range.y); prev = clamp(prev, u_range.x, u_range.y);
  /* the set pace applies to a real difference only: within a few hundredths of a stop the easing alone answers, so the small
     wavering of the measured brightness (rain crossing the view, traffic) is smoothed away and not followed frame by frame */
  float lp = log2(prev), d = log2(cur) - lp, st = sign(d) * min(abs(d), abs(d) * u_k + u_floor * smoothstep(0.01, 0.04, abs(d)));
  o_color = vec4(u_k >= 1.0 ? cur : exp2(lp + st), 0.0, 0.0, 1.0); }`;
  const FINAL_FS = `
#include <common>
in vec2 v_uv; out vec4 o_color;
uniform sampler2D u_color, u_bloom, u_adapt, u_mask, u_shafts; uniform vec2 u_res; uniform vec4 u_post, u_grade, u_fx, u_outline, u_exp; uniform int u_tonemap; uniform float u_maskOn, u_shaftOn;
vec3 fitRRT(vec3 v) { vec3 a = v * (v + 0.0245786) - 0.000090537, b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
vec3 aces(vec3 c) { const mat3 mi = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777), mo = mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602); return clamp(mo * fitRRT(mi * (c * 1.6)), 0.0, 1.0); }
vec3 agxCurve(vec3 x) { vec3 x2 = x * x, x4 = x2 * x2; return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232; }
vec3 agx(vec3 c) {
  const mat3 to2020 = mat3(0.6274, 0.0691, 0.0164, 0.3293, 0.9195, 0.0880, 0.0433, 0.0113, 0.8956), from2020 = mat3(1.6605, -0.1246, -0.0182, -0.5876, 1.1329, -0.1006, -0.0728, -0.0083, 1.1187);
  const mat3 inset = mat3(0.856627153315983, 0.137318972929847, 0.11189821299995, 0.0951212405381588, 0.761241990602591, 0.0767994186031903, 0.0482516061458583, 0.101439036467562, 0.811302368396859);
  const mat3 outset = mat3(1.1271005818144368, -0.1413297634984383, -0.14132976349843826, -0.11060664309660323, 1.157823702216272, -0.11060664309660294, -0.016493938717834573, -0.016493938717834257, 1.2519364065950405);
  c = inset * (to2020 * c); c = clamp((log2(max(c, 1e-10)) + 12.47393) / 16.5, 0.0, 1.0); c = agxCurve(c); c = pow(max(outset * c, 0.0), vec3(2.2)); return clamp(from2020 * c, 0.0, 1.0);
}
vec3 neutral(vec3 c) { float x = min(c.r, min(c.g, c.b)), off = x < 0.08 ? x - 6.25 * x * x : 0.04; c -= off; float peak = max(c.r, max(c.g, c.b)); if (peak < 0.76) return c; float d = 0.24, np = 1.0 - d * d / (peak + d - 0.76); c *= np / peak; float g = 1.0 - 1.0 / (0.15 * (peak - np) + 1.0); return mix(c, vec3(np), g); }
vec3 toSRGB(vec3 c) { return mix(c * 12.92, 1.055 * pow(max(c, 0.0), vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
void main() {
  vec2 px = 1.0 / u_res; vec3 c = texture(u_color, v_uv).rgb;
  if (u_fx.y > 0.0) { vec2 dir = (v_uv - 0.5) * u_fx.y * 0.012; c.r = texture(u_color, v_uv + dir).r; c.b = texture(u_color, v_uv - dir).b; }
  if (u_post.w > 0.0) { vec3 n = (texture(u_color, v_uv + vec2(px.x, 0.0)).rgb + texture(u_color, v_uv - vec2(px.x, 0.0)).rgb + texture(u_color, v_uv + vec2(0.0, px.y)).rgb + texture(u_color, v_uv - vec2(0.0, px.y)).rgb) * 0.25; float l = luma(c), ln = luma(n); c = max(c * (1.0 + clamp((l - ln) / max(l, 1e-3), -0.35, 0.35) * u_post.w), 0.0); }
  if (u_fx.w < 0.5) {
    c = mix(c, texture(u_bloom, v_uv).rgb, u_post.x); if (u_shaftOn > 0.0) c += texture(u_shafts, v_uv).rgb * u_shaftOn;
    float adapted = clamp(texture(u_adapt, vec2(0.5)).r, u_exp.x, u_exp.y), ex = (u_post.z > 0.5 ? u_exp.z / adapted : 1.0) * u_post.y;
    c *= ex; c *= vec3(1.0 + u_grade.z * 0.12, 1.0, 1.0 - u_grade.z * 0.12);
    c = u_tonemap == 0 ? aces(c) : u_tonemap == 1 ? agx(c) : u_tonemap == 2 ? neutral(c) : c / (1.0 + c);
    c = mix(vec3(luma(c)), c, u_grade.y); c = clamp(mix(vec3(0.18), c, u_grade.x), 0.0, 1.0);
    c *= 1.0 - u_grade.w * smoothstep(0.35, 1.05, length((v_uv - 0.5) * vec2(1.25, 1.4)));
  }
  c = toSRGB(clamp(c, 0.0, 1.0));
  if (u_maskOn > 0.5) {
    vec2 m0 = texture(u_mask, v_uv).rg, mx = vec2(0.0); float wdt = u_outline.w;
    for (int i = 0; i < 8; i++) { float a = float(i) * 0.7853982; mx = max(mx, texture(u_mask, v_uv + vec2(cos(a), sin(a)) * px * wdt).rg); mx = max(mx, texture(u_mask, v_uv + vec2(cos(a + 0.39), sin(a + 0.39)) * px * wdt * 0.5).rg * vec2(1.0, 0.0)); }
    float sel = clamp(mx.r - m0.r, 0.0, 1.0), hov = clamp(mx.g - m0.g, 0.0, 1.0) * (1.0 - sel);
    c = mix(c, u_outline.rgb, sel * 0.95); c = mix(c, vec3(1.0), hov * 0.6); c += u_outline.rgb * m0.r * 0.05;
  }
  c += (hash12(gl_FragCoord.xy + fract(u_fx.z) * 251.0) - 0.5) * (u_fx.x + 1.0 / 255.0);
  o_color = vec4(c, 1.0);
}`;


  /* shafts of light: the bright sky smeared away from the sun across whatever stands in front of it. The sky's own
     brightness is the light (so the gaps between clouds throw shafts and the clouds do not), walls and roofs are the dark. */
  const SHAFT_FS = `
#include <common>
in vec2 v_uv; out vec4 o_color; uniform sampler2D u_color, u_depth; uniform vec4 u_sun; uniform float u_aspect;
void main() {
  vec2 d = u_sun.xy - v_uv; float len = length(d * vec2(u_aspect, 1.0)); const int N = 36;
  vec2 st = d / float(N) * min(1.0, 0.75 / max(len, 1e-3)); vec2 uv = v_uv + st * ign(gl_FragCoord.xy, 0.0); vec3 acc = vec3(0.0); float w = 1.0, ws = 0.0;
  for (int i = 0; i < N; i++) { vec2 q = clamp(uv, vec2(0.001), vec2(0.999)); float sky = step(1.0, textureLod(u_depth, q, 0.0).r); vec3 c = min(textureLod(u_color, q, 0.0).rgb, vec3(u_sun.w)); acc += c * sky * w; ws += w; w *= 0.955; uv += st; }
  float near = smoothstep(1.35, 0.15, len);
  o_color = vec4(acc / ws * u_sun.z * near, 1.0);
}`;

  /* depth of field: each pixel gathers from a spiral as wide as the largest blur allowed; a neighbour counts only if its
     own blur reaches this far, and what is behind is not allowed to smear over what is sharp in front of it */
  const DOF_FS = `
#include <common>
in vec2 v_uv; out vec4 o_color; uniform sampler2D u_color, u_depth; uniform vec4 u_dof; uniform vec2 u_res, u_nearFar;
float linZ(float d) { float z = d * 2.0 - 1.0; return 2.0 * u_nearFar.x * u_nearFar.y / (u_nearFar.y + u_nearFar.x - z * (u_nearFar.y - u_nearFar.x)); }
float coc(float z, float zf) { return clamp(abs(z - zf) / max(z, 0.1) * u_dof.y, 0.0, 1.0) * u_dof.z; }
void main() {
  float zf = u_dof.x > 0.0 ? u_dof.x : linZ(textureLod(u_depth, vec2(0.5), 0.0).r), zc = linZ(textureLod(u_depth, v_uv, 0.0).r), cs = coc(zc, zf);
  vec3 color = texture(u_color, v_uv).rgb; float tot = 1.0, radius = 0.8; vec2 px = 1.0 / u_res;
  float ang = ign(gl_FragCoord.xy, 0.0) * 6.2832;
  for (int i = 0; i < 96; i++) { if (radius >= u_dof.z) break; ang += 2.39996323;
    vec2 tc = v_uv + vec2(cos(ang), sin(ang)) * px * radius; float zs = linZ(textureLod(u_depth, tc, 0.0).r), ss = coc(zs, zf); if (zs > zc) ss = clamp(ss, 0.0, cs * 2.0);
    color += mix(color / tot, textureLod(u_color, tc, 0.0).rgb, smoothstep(radius - 0.5, radius + 0.5, ss)); tot += 1.0; radius += 1.5 / radius; }
  o_color = vec4(color / tot, 1.0);
}`;
  /* motion blur: the picture smeared along each pixel's own motion (the camera's, and a moving car's) for the part of the frame the shutter is open */
  const MBLUR_FS = `
#include <common>
in vec2 v_uv; out vec4 o_color; uniform sampler2D u_color, u_velocity; uniform mat4 u_reproj; uniform vec4 u_mb; uniform vec2 u_res;
void main() {
  vec2 vel = textureLod(u_velocity, v_uv, 0.0).xy; if (vel.x < -5.0) { vec4 pc = u_reproj * vec4(v_uv * 2.0 - 1.0, 1.0, 1.0); vel = v_uv - (pc.xy / pc.w * 0.5 + 0.5); }
  vel *= u_mb.x; float lenPx = length(vel * u_res); if (lenPx < 0.7) { o_color = textureLod(u_color, v_uv, 0.0); return; } vel *= min(1.0, u_mb.y / lenPx);
  vec3 acc = vec3(0.0); float j = ign(gl_FragCoord.xy, u_mb.z) - 0.5; for (int i = 0; i < 9; i++) acc += textureLod(u_color, v_uv + vel * ((float(i) + j) / 8.0 - 0.5), 0.0).rgb;
  o_color = vec4(acc / 9.0, 1.0);
}`;
  class Post {
    constructor(renderer) {
      this.r = renderer; const dev = this.dev = renderer.dev; this.mips = []; this.first = true; this.snap = 0; this.ai = 0; this.shaft = null; this.shaftOn = 0;
      this.lum = dev.texture({ w: 64, h: 64, format: 'rg16f', mips: true }); this.lumT = dev.target({ color: [this.lum] });
      this.adapt = [0, 1].map(() => dev.texture({ w: 1, h: 1, format: 'r16f', filter: 'nearest' })); this.adaptT = this.adapt.map(t => dev.target({ color: [t] }));
    }
    resize(W, H) {
      this.mips.forEach(m => { m.tex.dispose(); m.t.dispose(); }); this.mips = []; let w = W, h = H;
      for (let i = 0; i < 6; i++) { w = Math.max(1, w >> 1); h = Math.max(1, h >> 1); if (Math.min(w, h) < 6 && i > 1) break; const tex = this.dev.texture({ w, h, format: 'rgba16f' }); this.mips.push({ tex, t: this.dev.target({ color: [tex] }), w, h }); }
      if (this.shaft) { this.shaft.dispose(); this.shaftT.dispose(); } this.shaft = this.dev.texture({ w: Math.max(2, W >> 2), h: Math.max(2, H >> 2), format: 'rgba16f' }); this.shaftT = this.dev.target({ color: [this.shaft] });
      if (this.fx) { this.fx.forEach(t => t.dispose()); this.fxT.forEach(t => t.dispose()); this.fx = null; }
      this.first = true;
    }
    /* color: the finished HDR picture; debug: a buffer view to show in its place (the lighting-only view is still exposed and tone mapped) */
    run(color, T, time, dt, debug) {
      const dev = this.dev, r = this.r, s = r.settings, lit = !debug || s.viewMode === 'lighting', M = this.mips, gl = dev.gl; dev.state({ depthTest: false, cull: 'none' });
      /* the lens: depth of field, then motion blur, each into a picture of its own (the temporal filter's history is left alone) */
      const no = r.refused;
      if (lit && !debug && ((s.dof && !no.has('dof')) || (s.motionBlur > 0 && !no.has('motionBlur'))) && r._cam) { try {
        if (!this.fx) { this.fx = [0, 1].map(() => dev.texture({ w: r.W, h: r.H, format: 'rgba16f' })); this.fxT = this.fx.map(t => dev.target({ color: [t] })); }
        dev.passBegin('lens');
        if (s.dof && !no.has('dof')) { const p = dev.program('dof', CHUNKS.fullscreen_vs, DOF_FS); dev.bind(this.fxT[0]); p.use().sets({ u_color: color, u_depth: T.depth, u_dof: [s.dofFocus, s.dofAperture, Math.max(2, s.dofMax * r.H / 1080), 0], u_res: [r.W, r.H], u_nearFar: [r._cam.near, r._cam.far] }); dev.fullscreen(p); color = this.fx[0]; }
        if (s.motionBlur > 0 && !no.has('motionBlur')) { const p = dev.program('motion-blur', CHUNKS.fullscreen_vs, MBLUR_FS); dev.bind(this.fxT[1]); p.use().sets({ u_color: color, u_velocity: T.velocity, u_reproj: r.reproj, u_mb: [s.motionBlur, 30 * r.H / 1080, r.frame % 64, 0], u_res: [r.W, r.H] }); dev.fullscreen(p); color = this.fx[1]; }
        dev.passEnd(); } catch (e) { dev.passEnd(); r.refuse(s.dof && !no.has('dof') && !dev.programs.has('dof|') ? 'dof' : 'motionBlur', e); color = arguments[0]; } }
      dev.passBegin('bloom');
      if (lit && (s.bloom || s.autoExposure)) {
        const pd = dev.program('bloom-down', CHUNKS.fullscreen_vs, BLOOM_DOWN_FS); pd.use(); let src = color;
        for (let i = 0; i < M.length; i++) { dev.bind(M[i].t); pd.sets({ u_src: src, u_texel: [1 / src.w, 1 / src.h], u_first: i ? 0 : 1 }); dev.fullscreen(pd); src = M[i].tex; if (!s.bloom && i >= 2) break; }
        /* exposure: measured from the picture at an eighth of its size, eased toward over time */
        if (s.autoExposure) {
          dev.bind(this.lumT); const pm = dev.program('lum', CHUNKS.fullscreen_vs, LUM_FS); pm.use().set('u_src', M[Math.min(2, M.length - 1)].tex); dev.fullscreen(pm); this.lum.genMips();
          dev.bind(this.adaptT[this.ai]); const pa = dev.program('adapt', CHUNKS.fullscreen_vs, ADAPT_FS); /* after a cut (the first frame, a new size, a change of hour or weather) the setting follows the picture outright for a few frames while the lighting's own histories fill; from then on it eases */
          const cut = this.first || r.reset || this.snap > 0, adt = Math.min(dt, 0.25); if (this.snap > 0) this.snap--;
          pa.use().sets({ u_lum: this.lum, u_prev: this.adapt[this.ai ^ 1], u_top: 6, u_k: cut ? 1 : 1 - Math.exp(-adt * s.adaptSpeed), u_floor: adt * s.adaptFloor, u_range: [s.exposureMin, s.exposureMax] }); dev.fullscreen(pa); this.ai ^= 1; this.first = false;
        }
        if (s.bloom) { const pu = dev.program('bloom-up', CHUNKS.fullscreen_vs, BLOOM_UP_FS); pu.use(); dev.state({ depthTest: false, cull: 'none', blend: 'add' });
          for (let i = M.length - 2; i >= 0; i--) { dev.bind(M[i].t); pu.sets({ u_src: M[i + 1].tex, u_texel: [1 / M[i + 1].w, 1 / M[i + 1].h] }); dev.fullscreen(pu); }
          dev.state({ depthTest: false, cull: 'none' }); }
      }
      dev.passEnd();
      /* sun shafts: only when the sun is up and somewhere ahead */
      this.shaftOn = 0;
      if (lit && !debug && s.shafts && !no.has('shafts') && r.sky.sunVisible > 0.05 && r.sky.night < 0.5) { const cam = r._cam, sd = r.sky.sunDir || r.sky.lightDir;
        if (cam && sd) { const cp = cam.position, v = r.vpNJ, X = cp[0] + sd[0] * 1e4, Y = cp[1] + sd[1] * 1e4, Z = cp[2] + sd[2] * 1e4, cw = v[3] * X + v[7] * Y + v[11] * Z + v[15];
          if (cw > 1) { const sx = (v[0] * X + v[4] * Y + v[8] * Z + v[12]) / cw * 0.5 + 0.5, sy = (v[1] * X + v[5] * Y + v[9] * Z + v[13]) / cw * 0.5 + 0.5, off = Math.max(Math.abs(sx - 0.5), Math.abs(sy - 0.5)), k = smoothstep(1.5, 0.6, off) * r.sky.sunVisible * (1 - r.sky.night);
            if (k > 0.01) { let ps = null; try { ps = dev.program('shafts', CHUNKS.fullscreen_vs, SHAFT_FS); } catch (e) { r.refuse('shafts', e); } if (ps) { dev.passBegin('shafts'); dev.bind(this.shaftT); ps.use().sets({ u_color: color, u_depth: T.depth, u_sun: [sx, sy, k, s.shaftClamp || 60], u_aspect: r.W / r.H }); dev.fullscreen(ps); dev.passEnd(); this.shaftOn = s.shaftIntensity; } } } } }
      dev.passBegin('output'); dev.bind(null);
      const pf = dev.program('final', CHUNKS.fullscreen_vs, FINAL_FS); pf.use().sets({ u_color: debug || color, u_bloom: M[0].tex, u_adapt: this.adapt[this.ai ^ 1], u_mask: T.mask, u_res: [r.W, r.H],
        u_post: [lit && !debug && s.bloom ? s.bloomIntensity : 0, Math.pow(2, s.exposure), s.autoExposure ? 1 : 0, s.taa && !debug ? s.sharpen * (1 + 1.3 * clamp(1 - r.w / r.W, 0, 0.5)) : 0], u_grade: [s.contrast, s.saturation, s.temperature, s.vignette], u_fx: [s.grain, s.chromatic, time, lit ? 0 : 1],
        u_outline: [s.outlineColor[0], s.outlineColor[1], s.outlineColor[2], s.outlineWidth * (r.W / Math.max(1, r.dev.canvas.clientWidth || r.W))], u_exp: [s.exposureMin, s.exposureMax, s.exposureKey, 0], u_tonemap: ['aces', 'agx', 'neutral', 'reinhard'].indexOf(s.tonemap), u_maskOn: r.maskOn ? 1 : 0, u_shafts: this.shaft, u_shaftOn: this.shaftOn });
      dev.fullscreen(pf); dev.passEnd(); void gl;
    }
  }

  /* ---------- lines with a width, for gizmos, bounds and anything a script wants to show; dimmed where the scene hides them ---------- */
  const LINE_VS = `
layout(location=0) in vec3 a_p0; layout(location=1) in vec3 a_p1; layout(location=2) in vec3 a_ctl; layout(location=3) in vec4 a_col;
uniform mat4 u_vp; uniform vec2 u_res; out vec4 v_col;
void main() {
  vec4 c0 = u_vp * vec4(a_p0, 1.0), c1 = u_vp * vec4(a_p1, 1.0); const float e = 0.02; v_col = a_col;
  if (c0.w < e && c1.w < e) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  if (c0.w < e) c0 = mix(c0, c1, (e - c0.w) / (c1.w - c0.w)); else if (c1.w < e) c1 = mix(c1, c0, (e - c1.w) / (c0.w - c1.w));
  vec2 d = c1.xy / c1.w * u_res - c0.xy / c0.w * u_res; float l = length(d); d = l > 1e-5 ? d / l : vec2(1.0, 0.0);
  vec4 c = a_ctl.x < 0.5 ? c0 : c1; gl_Position = vec4(c.xy + vec2(-d.y, d.x) * (a_ctl.y * a_ctl.z) / u_res * c.w, c.z, c.w);
}`;
  const LINE_FS = `
in vec4 v_col; out vec4 o_color; uniform sampler2D u_depth; uniform vec2 u_res;
void main() { float a = min(v_col.a, 1.0); if (v_col.a <= 1.5) { float sd = texture(u_depth, gl_FragCoord.xy / u_res).r; if (gl_FragCoord.z > sd + 0.00002) a *= 0.18; } o_color = vec4(v_col.rgb, a); }`;
  class DebugLines {
    constructor(dev) { this.dev = dev; this.cap = 2048; this.data = new Float32Array(this.cap * 6 * 13); this.n = 0; const gl = dev.gl; this.vao = gl.createVertexArray(); this.buf = gl.createBuffer(); this._size = 0; }
    /* a line from a to b; colour [r, g, b, a] in display values (alpha above 1.5 keeps it drawn over everything); width in pixels */
    line(a, b, col, width) {
      if (this.n >= this.cap) { this.cap *= 2; const d = new Float32Array(this.cap * 78); d.set(this.data); this.data = d; }
      const D = this.data, w = width || 1.5, al = col[3] == null ? 1 : col[3]; let o = this.n * 78;
      for (let k = 0; k < 6; k++) { const t = k === 0 || k === 2 || k === 3 ? 0 : 1, sd = k === 0 || k === 1 || k === 4 ? -1 : 1;   /* (0,-) (1,-) (0,+) | (0,+) (1,-) (1,+) */
        D[o++] = a[0]; D[o++] = a[1]; D[o++] = a[2]; D[o++] = b[0]; D[o++] = b[1]; D[o++] = b[2]; D[o++] = t; D[o++] = sd; D[o++] = w; D[o++] = col[0]; D[o++] = col[1]; D[o++] = col[2]; D[o++] = al; }
      this.n++;
    }
    box(mn, mx, col, w) { const c = (i) => [i & 1 ? mx[0] : mn[0], i & 2 ? mx[1] : mn[1], i & 4 ? mx[2] : mn[2]]; [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]].forEach(([a, b]) => this.line(c(a), c(b), col, w)); }
    /* a box by its world matrix and half sizes */
    obb(m, h, col, w) { const c = i => V3.transform([0, 0, 0], [i & 1 ? h[0] : -h[0], i & 2 ? h[1] : -h[1], i & 4 ? h[2] : -h[2]], m); [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]].forEach(([a, b]) => this.line(c(a), c(b), col, w)); }
    circle(c, n, r, col, w, seg) { const N = V3.normalize([0, 0, 0], n), u = V3.normalize([0, 0, 0], V3.cross([0, 0, 0], Math.abs(N[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], N)), v = V3.cross([0, 0, 0], N, u); seg = seg || 40; let p = null;
      for (let i = 0; i <= seg; i++) { const a = i / seg * TAU, q = [c[0] + (u[0] * Math.cos(a) + v[0] * Math.sin(a)) * r, c[1] + (u[1] * Math.cos(a) + v[1] * Math.sin(a)) * r, c[2] + (u[2] * Math.cos(a) + v[2] * Math.sin(a)) * r]; if (p) this.line(p, q, col, w); p = q; } }
    sphere(c, r, col, w) { this.circle(c, [1, 0, 0], r, col, w); this.circle(c, [0, 1, 0], r, col, w); this.circle(c, [0, 0, 1], r, col, w); }
    flush(dev, vp, res, depth) {
      if (!this.n) return; const gl = dev.gl, p = dev.program('lines', LINE_VS, LINE_FS); dev.bind(null); dev.state({ depthTest: false, cull: 'none', blend: 'alpha' }); dev.vao(this.vao); gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
      const bytes = this.n * 78 * 4; if (this._size < bytes) { gl.bufferData(gl.ARRAY_BUFFER, this.data, gl.DYNAMIC_DRAW); this._size = this.data.byteLength; [[0, 3, 0], [1, 3, 12], [2, 3, 24], [3, 4, 36]].forEach(([l, sz, off]) => { gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, sz, gl.FLOAT, false, 52, off); }); }
      else gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data.subarray(0, this.n * 78));
      p.use().sets({ u_vp: vp, u_res: res, u_depth: depth }); gl.drawArrays(gl.TRIANGLES, 0, this.n * 6); this.n = 0; dev.state({ depthTest: false, cull: 'none' });
    }
  }

  /* ---------- occlusion culling against the last frame's depth: the depth buffer reduced to a small table of the farthest
     depth in each block, read back without stalling; a bounding sphere wholly behind its blocks is skipped (the idea of
     Unreal's hierarchical Z occlusion, one frame late) ---------- */
  const HZB_FS = `
in vec2 v_uv; out vec4 o_color; uniform sampler2D u_src; uniform vec2 u_srcRes, u_dstRes; uniform int u_n;
void main() { vec2 lo = floor(gl_FragCoord.xy) / u_dstRes * u_srcRes, hi = (floor(gl_FragCoord.xy) + 1.0) / u_dstRes * u_srcRes; float m = 0.0;
  for (int y = 0; y < u_n; y++) for (int x = 0; x < u_n; x++) { vec2 p = mix(lo, hi, (vec2(float(x), float(y)) + 0.5) / float(u_n)); m = max(m, texelFetch(u_src, clamp(ivec2(p), ivec2(0), ivec2(u_srcRes) - 1), 0).r); }
  o_color = vec4(m, 0.0, 0.0, 1.0); }`;
  class Occlusion {
    constructor(renderer) {
      const dev = this.dev = renderer.dev, gl = dev.gl; this.W = 64; this.H = 36; this.ready = false; this.vp = M4.create(); this._vpPending = M4.create(); this.data = new Float32Array(this.W * this.H * 4); this.depth = new Float32Array(this.W * this.H);
      this.a = dev.texture({ w: 256, h: 144, format: 'r32f', filter: 'nearest' }); this.aT = dev.target({ color: [this.a] }); this.b = dev.texture({ w: this.W, h: this.H, format: 'r32f', filter: 'nearest' }); this.bT = dev.target({ color: [this.b] });
      this.pbo = gl.createBuffer(); gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this.pbo); gl.bufferData(gl.PIXEL_PACK_BUFFER, this.data.byteLength, gl.STREAM_READ); gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null); this.sync = null; this.near = 0.25;
    }
    capture(depth, vp, cam) {
      const dev = this.dev, gl = dev.gl;
      if (this.sync) { const st = gl.clientWaitSync(this.sync, 0, 0); if (st === gl.TIMEOUT_EXPIRED) return; gl.deleteSync(this.sync); this.sync = null;
        if (st !== gl.WAIT_FAILED) { gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this.pbo); gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, this.data); gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null); const D = this.depth, S = this.data; for (let i = 0; i < D.length; i++) D[i] = S[i * 4]; M4.copy(this.vp, this._vpPending); this.ready = true; } }
      const p = dev.program('hzb', CHUNKS.fullscreen_vs, HZB_FS); dev.state({ depthTest: false, cull: 'none' });
      dev.bind(this.aT); p.use().sets({ u_src: depth, u_srcRes: [depth.w, depth.h], u_dstRes: [256, 144], u_n: Math.min(8, Math.max(2, Math.ceil(Math.max(depth.w / 256, depth.h / 144)))) }); dev.fullscreen(p);
      dev.bind(this.bT); p.sets({ u_src: this.a, u_srcRes: [256, 144], u_dstRes: [this.W, this.H], u_n: 4 }); dev.fullscreen(p);
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this.pbo); gl.readPixels(0, 0, this.W, this.H, gl.RGBA, gl.FLOAT, 0); gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
      this.sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0); gl.flush(); M4.copy(this._vpPending, vp); this.near = cam.near; this.p10 = cam.proj[10]; this.p14 = cam.proj[14];
    }
    /* is this sphere [x, y, z, r] wholly behind what the last depth buffer held? */
    hidden(sp) {
      const m = this.vp, r = sp[3] * 1.2 + 0.5, x = sp[0], y = sp[1], z = sp[2], w = m[3] * x + m[7] * y + m[11] * z + m[15]; if (w - r <= this.near * 2) return false;
      const cx = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w, cy = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w, rx = r * Math.hypot(m[0], m[4], m[8]) / (w - r), ry = r * Math.hypot(m[1], m[5], m[9]) / (w - r);
      const x0 = Math.floor((cx - rx + 1) / 2 * this.W), x1 = Math.floor((cx + rx + 1) / 2 * this.W), y0 = Math.floor((cy - ry + 1) / 2 * this.H), y1 = Math.floor((cy + ry + 1) / 2 * this.H);
      if (x0 < 0 || y0 < 0 || x1 >= this.W || y1 >= this.H || (x1 - x0 + 1) * (y1 - y0 + 1) > 96) return false;
      /* the nearest depth the sphere can have: its centre brought toward the eye by its radius (depth from distance, for this projection) */
      const nd = 0.5 * (-this.p10 + this.p14 / (w - r)) + 0.5; let far = 0; const D = this.depth;
      for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) { const d = D[j * this.W + i]; if (d > far) far = d; }
      return nd > far + 1e-6;
    }
  }
  Object.assign(SE, { Post, DebugLines, Occlusion });

  /* ==== the engine: the device, a scene, the renderer, input, the loop ==== */
  class Assets {
    constructor(engine) { this.engine = engine; this.prims = new Map(); this.textures = new Map(); this.materials = new Map(); }
    /* a shared primitive mesh: 'box', 'sphere', 'cylinder', 'cone', 'capsule', 'plane', 'blob' */
    primitive(kind, args) {
      const a = args || [], key = kind + ':' + a.join(','); let m = this.prims.get(key); if (m) return m; const P = SE.Prim; let d;
      if (kind === 'box') d = P.box(a[0] || 1, a[1] || 1, a[2] || 1); else if (kind === 'sphere') d = P.sphere(a[0] || 0.5, a[1] || 32); else if (kind === 'cylinder') d = P.cylinder(a[0] == null ? 0.5 : a[0], a[1] == null ? (a[0] == null ? 0.5 : a[0]) : a[1], a[2] || 1, a[3] || 24);
      else if (kind === 'cone') d = P.cylinder(a[0] == null ? 0.5 : a[0], 0, a[1] || 1, a[2] || 24); else if (kind === 'capsule') d = P.capsule(a[0] || 0.3, a[1] || 1.8, a[2] || 16); else if (kind === 'plane') d = P.plane(a[0] || 10, a[1] || 10, a[2] || 1); else if (kind === 'blob') d = P.blob(a[0] || 1, a[1] == null ? 2 : a[1], a[2], a[3]); else throw new Error('no primitive ' + kind);
      d.keep = true; m = kind === 'sphere' || kind === 'blob' ? SE.Geo.buildLODs(this.engine.device, d) : new SE.Mesh(this.engine.device, d); m.shape = { kind, args: a.slice() }; this.prims.set(key, m); return m;
    }
    texture(name, tex) { if (tex !== undefined) this.textures.set(name, tex); return this.textures.get(name) || null; }
    material(name, mat) { if (mat !== undefined) this.materials.set(name, mat); return this.materials.get(name) || null; }
  }

  /* keys, pointer, wheel and game pad, gathered once a frame */
  class Input extends Emitter {
    constructor(engine, el) {
      super(); this.engine = engine; this.el = el; this.keys = new Set(); this.pointer = { x: 0, y: 0, dx: 0, dy: 0, down: false, button: 0, moved: false, over: false }; this.wheel = 0; this.touches = new Map(); this._off = [];
      const on = (t, n, f, o) => { t.addEventListener(n, f, o); this._off.push(() => t.removeEventListener(n, f, o)); }, wake = () => engine.wake();
      const pos = e => { const r = el.getBoundingClientRect(); return [(e.clientX - r.left) / Math.max(1, r.width), (e.clientY - r.top) / Math.max(1, r.height)]; };
      on(el, 'pointerdown', e => { const [x, y] = pos(e), p = this.pointer; p.x = x; p.y = y; p.down = true; p.button = e.button; p.moved = false; p.sx = e.clientX; p.sy = e.clientY; try { el.setPointerCapture(e.pointerId); } catch (x2) { /* fine */ } try { el.focus({ preventScroll: true }); } catch (x3) { /* fine */ } wake(); this.emit('down', p, e); });
      on(el, 'pointermove', e => { const [x, y] = pos(e), p = this.pointer; p.dx += e.movementX || 0; p.dy += e.movementY || 0; p.x = x; p.y = y; p.over = true; if (p.down && Math.abs(e.clientX - p.sx) + Math.abs(e.clientY - p.sy) > 4) p.moved = true; if (p.down) wake(); this.emit('move', p, e); });
      on(el, 'pointerup', e => { const p = this.pointer, was = p.down; p.down = false; wake(); if (was) { this.emit('up', p, e); if (!p.moved) this.emit('click', p, e); } });
      on(el, 'pointercancel', () => { this.pointer.down = false; });
      on(el, 'pointerleave', e => { this.pointer.over = false; this.emit('leave', this.pointer, e); });
      on(el, 'dblclick', e => { const [x, y] = pos(e); this.pointer.x = x; this.pointer.y = y; this.emit('dblclick', this.pointer, e); });
      on(el, 'wheel', e => { e.preventDefault(); this.wheel += e.deltaY; wake(); this.emit('wheel', e.deltaY, e); }, { passive: false });
      on(el, 'keydown', e => { if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return; if (!this.keys.has(e.code)) { this.keys.add(e.code); this.emit('key', e.code, e); } if (/^(Arrow|Space|Key[WASDQE]|Page)/.test(e.code)) e.preventDefault(); wake(); });
      on(el, 'keyup', e => { this.keys.delete(e.code); wake(); });
      on(el, 'blur', () => { this.keys.clear(); this.pointer.down = false; });
      on(el, 'contextmenu', e => e.preventDefault());
    }
    key(code) { return this.keys.has(code); }
    /* -1, 0 or 1 from a pair of keys (or two pairs) */
    axis(neg, pos, neg2, pos2) { return (this.keys.has(pos) || (pos2 && this.keys.has(pos2)) ? 1 : 0) - (this.keys.has(neg) || (neg2 && this.keys.has(neg2)) ? 1 : 0); }
    /* the first game pad's sticks and buttons, with a dead zone */
    pad() { const g = navigator.getGamepads ? [...navigator.getGamepads()].find(Boolean) : null; if (!g) return null; const dz = v => (Math.abs(v) < 0.14 ? 0 : v); return { lx: dz(g.axes[0] || 0), ly: dz(g.axes[1] || 0), rx: dz(g.axes[2] || 0), ry: dz(g.axes[3] || 0), buttons: g.buttons.map(b => b.pressed) }; }
    get active() { if (this.keys.size || this.pointer.down) return true; const g = this.pad(); return !!(g && (g.lx || g.ly || g.rx || g.ry)); }
    endFrame() { this.pointer.dx = 0; this.pointer.dy = 0; this.wheel = 0; }
    dispose() { this._off.forEach(f => f()); this._off = []; }
  }

  const QUALITY = {
    ultra: { label: 'Ultra', maxPixelRatio: 2, renderScale: 1, shadows: true, shadowSize: 2048, shadowDistance: 340, ao: true, gi: true, giSlices: 3, giSteps: 8, ssr: true, ssrSteps: 36, bloom: true, shafts: true, contactShadows: true, volumetricFog: true, volFogSteps: 24, volumetricClouds: true, cloudSteps: 40, occlusionCull: false },
    high: { label: 'High', maxPixelRatio: 1.5, renderScale: 1, shadows: true, shadowSize: 1536, shadowDistance: 280, ao: true, gi: true, giSlices: 2, giSteps: 6, ssr: true, ssrSteps: 26, bloom: true, shafts: true, contactShadows: true, volumetricFog: true, volFogSteps: 16, volumetricClouds: true, cloudSteps: 28, occlusionCull: false },
    medium: { label: 'Medium', maxPixelRatio: 1.25, renderScale: 0.8, shadows: true, shadowSize: 1024, shadowDistance: 220, ao: true, gi: false, giSlices: 2, giSteps: 4, ssr: false, ssrSteps: 20, bloom: true, shafts: true, contactShadows: true, volumetricFog: true, volFogSteps: 12, volumetricClouds: true, cloudSteps: 20, occlusionCull: false },
    low: { label: 'Low', maxPixelRatio: 1, renderScale: 0.67, shadows: true, shadowSize: 512, shadowDistance: 140, ao: false, gi: false, giSlices: 1, giSteps: 4, ssr: false, ssrSteps: 16, bloom: true, shafts: false, contactShadows: false, volumetricFog: false, volFogSteps: 8, volumetricClouds: false, cloudSteps: 16, occlusionCull: false },
  };

  class Engine extends Emitter {
    /* canvas: where to draw. o.quality: 'auto' | 'ultra' | 'high' | 'medium' | 'low' */
    constructor(canvas, o) {
      super(); o = o || {}; this.canvas = canvas; this.device = new Device(canvas, { preserve: o.preserve, onLost: () => this.emit('lost'), onRestored: () => { this.emit('restored'); } });
      this.assets = new Assets(this); this.scene = new Scene(this); this.renderer = new Renderer(this); this.input = new Input(this, canvas);
      this.physics = SE.Physics ? new SE.Physics.World(this) : null; this.audio = SE.Audio ? new SE.Audio(this) : null; this.timelines = new Set();
      this.time = { now: 0, dt: 0, frame: 0, scale: 1, fixed: 1 / 60, acc: 0, fps: 0, ms: 0 }; this.playing = true; this.live = true; this.idleSleep = 25; this.settleFrames = 56; this.running = false;   /* frames drawn after the last change: long enough for the temporal filter to gather a still view in full */ this._raf = 0; this._last = 0; this._settle = 0; this._wakeAt = 0; this._req = 2;
      const ce = this.scene.createEntity('Main Camera', { transient: true }); this.camera = ce.add('Camera'); ce.transform.setPosition(0, 2, 8);
      this.quality = 'high'; this.autoQuality = false; this._ft = []; this.setQuality(o.quality || 'auto');
      this._frame = this._frame.bind(this);
      if (window.ResizeObserver) { this._ro = new ResizeObserver(() => this.requestRender()); this._ro.observe(canvas); }
      if (window.IntersectionObserver) { this._io = new IntersectionObserver(es => { this.onScreen = es[es.length - 1].isIntersecting; if (this.onScreen) this.requestRender(); }); this._io.observe(canvas); } this.onScreen = true;
    }
    /* a quality level, or 'auto': by the kind of graphics card, stepping down if frames run long */
    setQuality(q) {
      const dev = this.device; this.autoQuality = q === 'auto';
      if (q === 'auto') q = dev.caps.software ? 'low' : (navigator.maxTouchPoints || 0) > 1 && Math.min(screen.width, screen.height) < 820 ? 'medium' : 'high';
      if (!QUALITY[q]) q = 'high'; this.quality = q; this.broken = null; if (this._watchS && this._watchS.stage < 2) { this._watchS.left = 12; this._watchS.black = 0; } const p = Object.assign({}, QUALITY[q]); delete p.label; Object.assign(this.renderer.settings, p); this._ft.length = 0; this.renderer.reset = true; this.requestRender(); this.emit('quality', q); return q;
    }
    start() { if (this.running) return; this.running = true; this._last = 0; this.wake(); }
    stop() { this.running = false; if (this._raf) { cancelAnimationFrame(this._raf); this._raf = 0; } }
    /* something changed: draw at least n more frames (the temporal filter needs a few to settle) */
    requestRender(n) { this._req = Math.max(this._req, n || 1); if (this.running && !this._raf) this._raf = requestAnimationFrame(this._frame); }
    /* has a person done something lately? (the world keeps moving for a while after, then rests) */
    get awake() { return performance.now() - this._wakeAt < this.idleSleep * 1000; }
    /* a person did something: draw, and keep the world moving for a while */
    wake() { this._wakeAt = performance.now(); this.requestRender(); }
    resize() { const c = this.canvas, w = c.clientWidth, h = c.clientHeight; if (w < 2 || h < 2) return false; return this.renderer.resize(w, h, window.devicePixelRatio || 1); }
    _frame(now) {
      this._raf = 0; if (!this.running) return; const T = this.time, t = now / 1000; let dt = this._last ? Math.min(0.1, Math.max(0.0001, t - this._last)) : 1 / 60; this._last = t;
      if (this.device.lost || !this.canvas.clientWidth) { this._last = 0; return; }
      const t0 = performance.now(), resized = this.resize(); this.emit('input', dt);
      const awake = now - this._wakeAt < this.idleSleep * 1000, sim = this.playing ? dt * T.scale : 0; let busy = false;
      if (sim > 0) {
        if (this.physics) { T.acc = Math.min(T.acc + sim, T.fixed * 5); while (T.acc >= T.fixed) { this.scene.fixedUpdate(T.fixed); this.physics.step(T.fixed); T.acc -= T.fixed; } if (this.physics.awake > 0) busy = true; }
        this.scene.update(sim); for (const tl of this.timelines) { tl.update(sim); busy = true; }
        for (const ps of this.scene.particles) if (ps.active && ps.update(sim)) busy = true;
      }
      this.emit('update', dt); this.scene.lateUpdate(dt);
      const camKey = this.camera.transform.world.join(','), camMoved = camKey !== this._camKey; this._camKey = camKey;
      const live = this.live && this.playing && awake && this.onScreen;
      if (resized || this.scene.touched || camMoved || busy || live || this._req > 0 || this.input.active) this._settle = this.settleFrames;
      if (this._req > 0) this._req--;
      if (this._settle > 0) {
        if (live || busy) T.now += sim; T.dt = dt;
        /* a frame the driver will not draw: first everything optional is switched off, then the quality goes to Low, and if
           it still cannot be drawn the engine says so and stops asking, instead of leaving a black view with no word */
        if (!this.broken) { try { this.renderer.render(this.scene, this.camera, T.now, dt); this._bad = 0; this._watch(); }
          catch (e) { this._bad = (this._bad || 0) + 1; const msg = String((e && e.message) || e).split('\n')[0].slice(0, 240); console.error('[Scout Engine] frame not drawn (' + this._bad + '): ' + ((e && e.stack) || e));
            if (this._bad === 1) { this.renderer.safe(); this.emit('degraded', 'A frame could not be drawn, so the optional effects are switched off.', msg); this.requestRender(6); }
            else if (this._bad === 2) { this.setQuality('low'); this.autoQuality = false; this.renderer.safe(); this.emit('degraded', 'Frames still could not be drawn, so the quality is set to Low.', msg); this.requestRender(6); }
            else { this.broken = msg; this.emit('fatal', msg); } } }
        this._settle--; T.frame++;
        const ms = performance.now() - t0; T.ms = T.ms * 0.9 + ms * 0.1; T.fps = T.fps * 0.9 + (1 / dt) * 0.1; this.emit('frame', dt);
        if (this.autoQuality && (live || busy || camMoved)) { this._drs(dt); this._tune(dt); }
      }
      this.input.endFrame();
      if (this._settle > 0 || this._req > 0) { if (!this._raf) this._raf = requestAnimationFrame(this._frame); } else if (!this._raf) { this._last = 0; this.emit('idle'); }
    }
    /* on Auto: frames that run long for a while step the quality down once, and say so */
    /* dynamic resolution: when frames run long the picture is drawn with fewer pixels and filled back in by the temporal
       filter; when there is room it goes back up. Going up is tried carefully: a try that drops the frame rate is undone
       and the next one waits longer. Only in Auto, so a quality someone chose is left as they chose it. */
    _drs(dt) {
      const R = this.renderer, s = R.settings, D = this._drsS || (this._drsS = { ema: 0, n: 0, wait: 6, hold: 0, tried: 0 }); if (!s.dynamicRes) { if (R.drs && R.drs !== 1) { R.drs = 1; this.resize(); } return; }
      D.ema = D.ema ? D.ema * 0.9 + dt * 0.1 : dt; D.hold -= dt; if (++D.n < 20) return; D.n = 0; const cur = R.drs || 1, lo = Math.min(1, (s.renderScaleMin || 0.55) / Math.max(s.renderScale, 0.01));
      if (D.ema > 0.0235 && cur > lo) { if (D.tried > 0 && this.time.now - D.tried < 2.5) D.wait = Math.min(180, D.wait * 2); R.drs = Math.max(lo, cur - 0.09); D.hold = D.wait; D.tried = 0; this.resize(); this.emit('resolution', R.drs * s.renderScale); }
      else if (D.ema < 0.0185 && cur < 1 && D.hold <= 0) { R.drs = Math.min(1, cur + 0.06); D.tried = this.time.now; D.hold = 1.5; this.resize(); this.emit('resolution', R.drs * s.renderScale); }
    }
    /* For the first few seconds (and again after the quality changes) the engine reads nine points of its own finished
       picture every 24th frame. A picture that is exactly black at all nine, twice running, by day, is a picture the
       driver did not draw even though nothing threw: the optional effects are switched off, then the quality goes to
       Low, then it is said plainly. This is the net under what cannot be tested here: only a software renderer could
       be, and it is more forgiving than a graphics card's driver. */
    _watch() {
      const W = this._watchS || (this._watchS = { n: 0, black: 0, left: 12, stage: 0 }); if (W.left <= 0 || (++W.n % 24) || this.renderer.sky.night > 0.5 || this.renderer.settings.viewMode !== 'lit') return; W.left--;
      const dev = this.device, gl = dev.gl, w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, px = new Uint8Array(4); let lit = false; dev.bind(null);
      for (let i = 0; i < 9 && !lit; i++) { gl.readPixels(Math.floor(w * (0.1 + 0.4 * (i % 3))), Math.floor(h * (0.1 + 0.4 * Math.floor(i / 3))), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); if (px[0] + px[1] + px[2] > 0) lit = true; }
      if (lit) { W.black = 0; return; } if (++W.black < 2) { this.requestRender(30); return; } W.black = 0; W.stage++; W.left = 12;
      if (W.stage === 1) { this.renderer.safe(); this.emit('degraded', 'The picture came out black, so the optional effects are switched off.', 'the driver reported no error'); }
      else if (W.stage === 2) { this.setQuality('low'); this.autoQuality = false; this.renderer.safe(); this._watchS = W; W.left = 12; this.emit('degraded', 'The picture is still black, so the quality is set to Low.', 'the driver reported no error'); }
      else { W.left = 0; this.emit('fatal', 'the picture is black and the driver reports no error.'); }
      this.requestRender(60);
    }
    _tune(dt) { const f = this._ft; f.push(dt); if (f.length < 45) return; const avg = f.reduce((a, b) => a + b, 0) / f.length; f.length = 0; const order = ['ultra', 'high', 'medium', 'low'], i = order.indexOf(this.quality);
      if (avg > 0.045 && i < order.length - 1) { this.setQuality(order[i + 1]); this.autoQuality = true; this.emit('qualityLowered', this.quality); } }
    /* one fixed step while paused */
    step() { const T = this.time; if (this.physics) { this.scene.fixedUpdate(T.fixed); this.physics.step(T.fixed); } this.scene.update(T.fixed); for (const ps of this.scene.particles) if (ps.active) ps.update(T.fixed); T.now += T.fixed; this.requestRender(); }
    /* what is under a point of the view (x, y in 0..1 from the top left): the nearest of the physics world's shapes and the pickable meshes */
    pick(x, y, o) {
      o = o || {}; const ray = this.camera.ray(x, y); let best = null;
      if (this.physics && o.physics !== false) { const h = this.physics.raycast(ray.origin, ray.dir, o.maxDistance || 5000); if (h) best = { t: h.t, point: h.point, normal: h.normal, body: h.body, shape: h.shape, entity: h.body && h.body.entity ? h.body.entity : null }; }
      if (o.meshes !== false) { const inv = M4.create(), lo = [0, 0, 0], ld = [0, 0, 0];
        for (const r of this.scene.renderables) { if (r.isInstanced || !r.pickable || !r.visible || !r.mesh || !r.mesh.cpu || !r.entity.activeInHierarchy || (o.filter && !o.filter(r.entity))) continue;
          const s = r.sphere(), ox = s[0] - ray.origin[0], oy = s[1] - ray.origin[1], oz = s[2] - ray.origin[2], tc = ox * ray.dir[0] + oy * ray.dir[1] + oz * ray.dir[2], d2 = ox * ox + oy * oy + oz * oz - tc * tc; if (d2 > s[3] * s[3] || (tc < -s[3])) continue;
          M4.invert(inv, r.entity.transform.world); V3.transform(lo, ray.origin, inv); V3.transformDir(ld, ray.dir, inv); const sc = V3.len(ld); V3.scale(ld, ld, 1 / sc);
          const h = r.mesh.raycast(lo, ld, best ? best.t * sc : undefined); if (h) { const t = h.t / sc; if (!best || t < best.t) best = { t, point: V3.addScaled([0, 0, 0], ray.origin, ray.dir, t), entity: r.entity, renderer: r }; } } }
      if (best) best.ray = ray; return best;
    }
    dispose() { this.stop(); this.input.dispose(); if (this._ro) this._ro.disconnect(); if (this._io) this._io.disconnect(); if (this.audio) this.audio.dispose(); this.scene.clear(true); this.renderer.dispose(); this.device.dispose(); }
  }
  Object.assign(SE, { Engine, Assets, Input, QUALITY });

  /* ==== physics: rigid bodies, a character that walks and collides, rays ==== */
  /* Dynamic boxes, spheres and capsules; a ground plane, static boxes and extruded footprints (a building is its outline
     raised from y0 to y1: walls that push sideways, a roof that carries). Contacts are found each step (separating axes
     and clipped faces for box against box), then solved together by sequential impulses with friction and bounce; bodies
     that come to rest fall asleep. Scaled to hundreds of bodies, not tens of thousands. */
  const Physics = (() => {
    const tmp = [0, 0, 0], t2 = [0, 0, 0], t3 = [0, 0, 0];
    class Body {
      constructor(o) {
        this.id = uid(); this.type = o.type || 'dynamic'; this.shape = o.shape || { kind: 'box', h: [0.5, 0.5, 0.5] }; this.pos = V3.create(); if (o.position) V3.copy(this.pos, o.position); this.rot = Q.create(); if (o.rotation) Q.copy(this.rot, o.rotation);
        this.vel = V3.create(); this.ang = V3.create(); this.restitution = o.restitution == null ? 0.15 : o.restitution; this.friction = o.friction == null ? 0.6 : o.friction; this.linDamp = 0.02; this.angDamp = 0.06;
        this.ax = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]; this.min = [0, 0, 0]; this.max = [0, 0, 0]; this.asleep = false; this.still = 0; this.entity = o.entity || null; this.userData = o.userData || null; this.gravity = o.gravity == null ? 1 : o.gravity;
        this.setMass(this.type === 'dynamic' ? (o.mass == null ? this.volume() * (o.density || 400) : o.mass) : 0); this.refresh();
      }
      volume() { const s = this.shape; return s.kind === 'sphere' ? 4 / 3 * Math.PI * s.r * s.r * s.r : s.kind === 'capsule' ? Math.PI * s.r * s.r * (2 * s.hh + 4 / 3 * s.r) : 8 * s.h[0] * s.h[1] * s.h[2]; }
      setMass(m) { this.mass = m; this.invMass = m > 0 ? 1 / m : 0; const s = this.shape; let ix, iy, iz;
        if (s.kind === 'sphere') ix = iy = iz = 0.4 * m * s.r * s.r; else if (s.kind === 'capsule') { const H = 2 * s.hh + 2 * s.r; ix = iz = m * (3 * s.r * s.r + H * H) / 12; iy = 0.5 * m * s.r * s.r; } else { const h = s.h; ix = m / 3 * (h[1] * h[1] + h[2] * h[2]); iy = m / 3 * (h[0] * h[0] + h[2] * h[2]); iz = m / 3 * (h[0] * h[0] + h[1] * h[1]); }
        this.invI = m > 0 ? [1 / ix, 1 / iy, 1 / iz] : [0, 0, 0]; }
      /* axes and bounds from the pose */
      refresh() {
        const q = this.rot, a = this.ax; Q.rotate(a[0], q, [1, 0, 0]); Q.rotate(a[1], q, [0, 1, 0]); Q.rotate(a[2], q, [0, 0, 1]); const s = this.shape, p = this.pos; let ex, ey, ez;
        if (s.kind === 'sphere') ex = ey = ez = s.r; else if (s.kind === 'capsule') { ex = Math.abs(a[1][0]) * s.hh + s.r; ey = Math.abs(a[1][1]) * s.hh + s.r; ez = Math.abs(a[1][2]) * s.hh + s.r; }
        else { const h = s.h; ex = Math.abs(a[0][0]) * h[0] + Math.abs(a[1][0]) * h[1] + Math.abs(a[2][0]) * h[2]; ey = Math.abs(a[0][1]) * h[0] + Math.abs(a[1][1]) * h[1] + Math.abs(a[2][1]) * h[2]; ez = Math.abs(a[0][2]) * h[0] + Math.abs(a[1][2]) * h[1] + Math.abs(a[2][2]) * h[2]; }
        this.min[0] = p[0] - ex; this.min[1] = p[1] - ey; this.min[2] = p[2] - ez; this.max[0] = p[0] + ex; this.max[1] = p[1] + ey; this.max[2] = p[2] + ez;
      }
      /* the inverse inertia, in the world, applied to v */
      invInertia(o, v) { const a = this.ax, I = this.invI, x = (a[0][0] * v[0] + a[0][1] * v[1] + a[0][2] * v[2]) * I[0], y = (a[1][0] * v[0] + a[1][1] * v[1] + a[1][2] * v[2]) * I[1], z = (a[2][0] * v[0] + a[2][1] * v[1] + a[2][2] * v[2]) * I[2];
        o[0] = a[0][0] * x + a[1][0] * y + a[2][0] * z; o[1] = a[0][1] * x + a[1][1] * y + a[2][1] * z; o[2] = a[0][2] * x + a[1][2] * y + a[2][2] * z; return o; }
      wake() { this.asleep = false; this.still = 0; }
      /* a push at a world point (or at the centre) */
      impulse(j, at) { if (!this.invMass) return; this.wake(); V3.addScaled(this.vel, this.vel, j, this.invMass); if (at) { V3.sub(tmp, at, this.pos); V3.cross(tmp, tmp, j); this.invInertia(tmp, tmp); V3.add(this.ang, this.ang, tmp); } }
      corners() { const h = this.shape.h, a = this.ax, p = this.pos, out = []; for (let i = 0; i < 8; i++) { const sx = i & 1 ? h[0] : -h[0], sy = i & 2 ? h[1] : -h[1], sz = i & 4 ? h[2] : -h[2]; out.push([p[0] + a[0][0] * sx + a[1][0] * sy + a[2][0] * sz, p[1] + a[0][1] * sx + a[1][1] * sy + a[2][1] * sz, p[2] + a[0][2] * sx + a[1][2] * sy + a[2][2] * sz]); } return out; }
      /* the points a round shape is tested at: a sphere's centre, a capsule's two ends and its middle */
      centers() { const s = this.shape, p = this.pos; if (s.kind === 'sphere') return [p]; const a = this.ax[1], h = s.hh; return [[p[0] + a[0] * h, p[1] + a[1] * h, p[2] + a[2] * h], [p[0] - a[0] * h, p[1] - a[1] * h, p[2] - a[2] * h], p]; }
    }

    /* ---------- finding contacts: each is { a, b, n (from a to b), p, depth } ---------- */
    const closestOnSeg = (o, a, b, p) => { const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], l2 = dx * dx + dy * dy + dz * dz, t = l2 ? clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy + (p[2] - a[2]) * dz) / l2, 0, 1) : 0; o[0] = a[0] + dx * t; o[1] = a[1] + dy * t; o[2] = a[2] + dz * t; return o; };
    const segEnds = b => { const a = b.ax[1], h = b.shape.hh, p = b.pos; return [[p[0] + a[0] * h, p[1] + a[1] * h, p[2] + a[2] * h], [p[0] - a[0] * h, p[1] - a[1] * h, p[2] - a[2] * h]]; };
    function sphereSphere(A, ca, ra, B, cb, rb, out) { const dx = cb[0] - ca[0], dy = cb[1] - ca[1], dz = cb[2] - ca[2], d = Math.hypot(dx, dy, dz), r = ra + rb; if (d >= r) return; const n = d > 1e-6 ? [dx / d, dy / d, dz / d] : [0, 1, 0]; out.push({ a: A, b: B, n, p: [ca[0] + n[0] * (ra - (r - d) / 2), ca[1] + n[1] * (ra - (r - d) / 2), ca[2] + n[2] * (ra - (r - d) / 2)], depth: r - d }); }
    /* a sphere (centre c, radius r, of body S) against the box of body Bx; the normal runs from first to second as given by flip */
    function sphereBox(S, c, r, Bx, out, flip) {
      const a = Bx.ax, h = Bx.shape.h, d = [c[0] - Bx.pos[0], c[1] - Bx.pos[1], c[2] - Bx.pos[2]], l = [V3.dot(d, a[0]), V3.dot(d, a[1]), V3.dot(d, a[2])], q = [clamp(l[0], -h[0], h[0]), clamp(l[1], -h[1], h[1]), clamp(l[2], -h[2], h[2])];
      let nx, ny, nz, depth; const inside = q[0] === l[0] && q[1] === l[1] && q[2] === l[2];
      if (inside) { let k = 0, best = Infinity; for (let i = 0; i < 3; i++) { const e = h[i] - Math.abs(l[i]); if (e < best) { best = e; k = i; } } const sg = l[k] < 0 ? -1 : 1; nx = a[k][0] * sg; ny = a[k][1] * sg; nz = a[k][2] * sg; depth = best + r; q[k] = sg * h[k]; }
      else { const wx = (l[0] - q[0]), wy = (l[1] - q[1]), wz = (l[2] - q[2]), dist = Math.hypot(wx, wy, wz); if (dist >= r) return; const gx = a[0][0] * wx + a[1][0] * wy + a[2][0] * wz, gy = a[0][1] * wx + a[1][1] * wy + a[2][1] * wz, gz = a[0][2] * wx + a[1][2] * wy + a[2][2] * wz; nx = gx / dist; ny = gy / dist; nz = gz / dist; depth = r - dist; }
      const p = [Bx.pos[0] + a[0][0] * q[0] + a[1][0] * q[1] + a[2][0] * q[2], Bx.pos[1] + a[0][1] * q[0] + a[1][1] * q[1] + a[2][1] * q[2], Bx.pos[2] + a[0][2] * q[0] + a[1][2] * q[1] + a[2][2] * q[2]];
      /* (nx, ny, nz) points from the box to the sphere */
      if (flip) out.push({ a: Bx, b: S, n: [nx, ny, nz], p, depth }); else out.push({ a: S, b: Bx, n: [-nx, -ny, -nz], p, depth });
    }
    function boxBox(A, B, out) {
      const a = A.ax, b = B.ax, ha = A.shape.h, hb = B.shape.h, t = [B.pos[0] - A.pos[0], B.pos[1] - A.pos[1], B.pos[2] - A.pos[2]], C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], AC = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { C[i][j] = V3.dot(a[i], b[j]); AC[i][j] = Math.abs(C[i][j]) + 1e-6; }
      const ta = [V3.dot(t, a[0]), V3.dot(t, a[1]), V3.dot(t, a[2])]; let best = -Infinity, kind = 0, bi = 0, bj = 0, bsign = 1;
      for (let i = 0; i < 3; i++) { const s = Math.abs(ta[i]) - (ha[i] + hb[0] * AC[i][0] + hb[1] * AC[i][1] + hb[2] * AC[i][2]); if (s > 0) return; if (s > best) { best = s; kind = 0; bi = i; bsign = ta[i] < 0 ? -1 : 1; } }
      for (let j = 0; j < 3; j++) { const tb = ta[0] * C[0][j] + ta[1] * C[1][j] + ta[2] * C[2][j], s = Math.abs(tb) - (hb[j] + ha[0] * AC[0][j] + ha[1] * AC[1][j] + ha[2] * AC[2][j]); if (s > 0) return; if (s > best + 0.002) { best = s; kind = 1; bj = j; bsign = tb < 0 ? -1 : 1; } }
      let en = null;
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { const i1 = (i + 1) % 3, i2 = (i + 2) % 3, j1 = (j + 1) % 3, j2 = (j + 2) % 3, len = Math.sqrt(Math.max(0, 1 - C[i][j] * C[i][j])); if (len < 1e-3) continue;
        const d = ta[i2] * C[i1][j] - ta[i1] * C[i2][j], s = (Math.abs(d) - (ha[i1] * AC[i2][j] + ha[i2] * AC[i1][j] + hb[j1] * AC[i][j2] + hb[j2] * AC[i][j1])) / len; if (s > 0) return;
        if (s > best + 0.01) { best = s; kind = 2; bi = i; bj = j; const n = V3.cross([0, 0, 0], a[i], b[j]); V3.scale(n, n, 1 / len); if (V3.dot(n, t) < 0) V3.scale(n, n, -1); en = n; } }
      if (kind === 2) {   /* edge against edge: one point, midway between the nearest points of the two edges */
        const n = en, pa = A.pos.slice(), pb = B.pos.slice(); for (let k = 0; k < 3; k++) { if (k !== bi) V3.addScaled(pa, pa, a[k], (V3.dot(n, a[k]) > 0 ? 1 : -1) * ha[k]); if (k !== bj) V3.addScaled(pb, pb, b[k], (V3.dot(n, b[k]) > 0 ? -1 : 1) * hb[k]); }
        const u = a[bi], v = b[bj], w = [pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2]], uv = V3.dot(u, v), uw = V3.dot(u, w), vw = V3.dot(v, w), den = 1 - uv * uv; const sA = den > 1e-6 ? clamp((uv * vw - uw) / den, -ha[bi], ha[bi]) : 0, sB = den > 1e-6 ? clamp((vw - uv * uw) / den, -hb[bj], hb[bj]) : 0;
        out.push({ a: A, b: B, n, p: [(pa[0] + u[0] * sA + pb[0] + v[0] * sB) / 2, (pa[1] + u[1] * sA + pb[1] + v[1] * sB) / 2, (pa[2] + u[2] * sA + pb[2] + v[2] * sB) / 2], depth: -best }); return;
      }
      /* face against face: the other box's most opposed face, clipped to the sides of the reference face */
      const R = kind === 0 ? A : B, I = kind === 0 ? B : A, ra = R.ax, ia = I.ax, rh = R.shape.h, ih = I.shape.h, ri = kind === 0 ? bi : bj, sgn = kind === 0 ? bsign : -bsign;
      const n = [ra[ri][0] * sgn, ra[ri][1] * sgn, ra[ri][2] * sgn];      /* out of the reference box, toward the other */
      let ii = 0, mn = Infinity, isg = 1; for (let k = 0; k < 3; k++) { const d = V3.dot(n, ia[k]); if (d < mn) { mn = d; ii = k; isg = 1; } if (-d < mn) { mn = -d; ii = k; isg = -1; } }
      const i1 = (ii + 1) % 3, i2 = (ii + 2) % 3, fc = [I.pos[0] + ia[ii][0] * ih[ii] * isg, I.pos[1] + ia[ii][1] * ih[ii] * isg, I.pos[2] + ia[ii][2] * ih[ii] * isg];
      let poly = [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([s1, s2]) => [fc[0] + ia[i1][0] * ih[i1] * s1 + ia[i2][0] * ih[i2] * s2, fc[1] + ia[i1][1] * ih[i1] * s1 + ia[i2][1] * ih[i2] * s2, fc[2] + ia[i1][2] * ih[i1] * s1 + ia[i2][2] * ih[i2] * s2]);
      const r1 = (ri + 1) % 3, r2 = (ri + 2) % 3;
      for (const [ax, hh] of [[ra[r1], rh[r1]], [ra[r2], rh[r2]]]) for (const sg of [1, -1]) {   /* keep the part with sg * dot(p - Rpos, ax) <= hh */
        const outp = []; for (let k = 0; k < poly.length; k++) { const p = poly[k], q = poly[(k + 1) % poly.length], dp = sg * ((p[0] - R.pos[0]) * ax[0] + (p[1] - R.pos[1]) * ax[1] + (p[2] - R.pos[2]) * ax[2]) - hh, dq = sg * ((q[0] - R.pos[0]) * ax[0] + (q[1] - R.pos[1]) * ax[1] + (q[2] - R.pos[2]) * ax[2]) - hh;
          if (dp <= 0) outp.push(p); if ((dp < 0 && dq > 0) || (dp > 0 && dq < 0)) { const f = dp / (dp - dq); outp.push([p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f, p[2] + (q[2] - p[2]) * f]); } }
        poly = outp; if (!poly.length) return; }
      const cn = kind === 0 ? n : [-n[0], -n[1], -n[2]]; let got = [];
      for (const p of poly) { const d = rh[ri] - ((p[0] - R.pos[0]) * n[0] + (p[1] - R.pos[1]) * n[1] + (p[2] - R.pos[2]) * n[2]); if (d >= 0) got.push({ a: A, b: B, n: cn, p: [p[0] + n[0] * d * 0.5, p[1] + n[1] * d * 0.5, p[2] + n[2] * d * 0.5], depth: d }); }
      if (got.length > 4) { got.sort((x, y) => y.depth - x.depth); got.length = 4; } for (const g of got) out.push(g);
    }
    function pair(A, B, out) {
      const ka = A.shape.kind, kb = B.shape.kind;
      if (ka === 'box' && kb === 'box') return boxBox(A, B, out);
      if (ka === 'box') { for (const c of (kb === 'sphere' ? [B.pos] : capPts(B, A.pos))) sphereBox(B, c, B.shape.r, A, out, true); return; }
      if (kb === 'box') { for (const c of (ka === 'sphere' ? [A.pos] : capPts(A, B.pos))) sphereBox(A, c, A.shape.r, B, out, false); return; }
      if (ka === 'sphere' && kb === 'sphere') return sphereSphere(A, A.pos, A.shape.r, B, B.pos, B.shape.r, out);
      if (ka === 'sphere') { const e = segEnds(B); return sphereSphere(A, A.pos, A.shape.r, B, closestOnSeg([0, 0, 0], e[0], e[1], A.pos), B.shape.r, out); }
      if (kb === 'sphere') { const e = segEnds(A); return sphereSphere(A, closestOnSeg([0, 0, 0], e[0], e[1], B.pos), A.shape.r, B, B.pos, B.shape.r, out); }
      const ea = segEnds(A), eb = segEnds(B), pa = closestOnSeg([0, 0, 0], ea[0], ea[1], B.pos), pb = closestOnSeg([0, 0, 0], eb[0], eb[1], pa); closestOnSeg(pa, ea[0], ea[1], pb); sphereSphere(A, pa, A.shape.r, B, pb, B.shape.r, out);
    }
    /* a capsule against a box: its ends and the point of its axis nearest the box */
    const capPts = (cap, toward) => { const e = segEnds(cap); return [e[0], e[1], closestOnSeg([0, 0, 0], e[0], e[1], toward)]; };

    class World {
      constructor(engine) { this.engine = engine; this.gravity = [0, -9.81, 0]; this.bodies = []; this.statics = []; this.prisms = []; this.grid = new Map(); this.cell = 24; this.groundY = 0; this.ground = true; this.iterations = 8; this.awake = 0; this.contacts = []; this.characters = []; this.groundFriction = 0.7; }
      add(o) { const b = o instanceof Body ? o : new Body(o); (b.type === 'dynamic' ? this.bodies : this.statics).push(b); return b; }
      remove(b) { for (const l of [this.bodies, this.statics]) { const i = l.indexOf(b); if (i >= 0) l.splice(i, 1); } }
      /* a footprint raised into a solid: ring is [[x, z], ...]; y0 and y1 its foot and top */
      addPrism(ring, y0, y1, userData) { const bb = Poly.bounds(ring), p = { id: uid(), ring, y0, y1, bb, ccw: Poly.area(ring) > 0, userData: userData || null, cells: [] }; this.prisms.push(p);
        for (let x = Math.floor(bb[0] / this.cell); x <= Math.floor(bb[2] / this.cell); x++) for (let z = Math.floor(bb[1] / this.cell); z <= Math.floor(bb[3] / this.cell); z++) { const k = x + ':' + z; let c = this.grid.get(k); if (!c) this.grid.set(k, c = []); c.push(p); p.cells.push(k); } return p; }
      removePrism(p) { const i = this.prisms.indexOf(p); if (i >= 0) this.prisms.splice(i, 1); p.cells.forEach(k => { const c = this.grid.get(k); if (c) { const j = c.indexOf(p); if (j >= 0) c.splice(j, 1); if (!c.length) this.grid.delete(k); } }); }
      clearPrisms() { this.prisms.length = 0; this.grid.clear(); }
      prismsIn(x0, z0, x1, z1, out) { out.length = 0; const seen = this._seen || (this._seen = new Set()); seen.clear(); for (let x = Math.floor(x0 / this.cell); x <= Math.floor(x1 / this.cell); x++) for (let z = Math.floor(z0 / this.cell); z <= Math.floor(z1 / this.cell); z++) { const c = this.grid.get(x + ':' + z); if (c) for (const p of c) if (!seen.has(p.id) && p.bb[0] <= x1 && p.bb[2] >= x0 && p.bb[1] <= z1 && p.bb[3] >= z0) { seen.add(p.id); out.push(p); } } return out; }
      /* the nearest point of a footprint's outline to (x, z), and whether (x, z) is inside it */
      _edge(pr, x, z, o) { const R = pr.ring; let bd = Infinity, bx = 0, bz = 0;
        for (let i = 0, j = R.length - 1; i < R.length; j = i++) { const a = R[j], b = R[i], dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz, t = l2 ? clamp(((x - a[0]) * dx + (z - a[1]) * dz) / l2, 0, 1) : 0, px = a[0] + dx * t, pz = a[1] + dz * t, d = Math.hypot(x - px, z - pz); if (d < bd) { bd = d; bx = px; bz = pz; } }
        o.d = bd; o.x = bx; o.z = bz; o.inside = Poly.contains(R, x, z); return o; }
      /* a ball of radius r at (x, y, z) against a prism: null, or how to get out ({ n, depth }): up through the roof when that is nearest, else sideways through the nearest wall */
      _prismPoint(pr, x, y, z, r) {
        if (y - r >= pr.y1 || y + r <= pr.y0) return null; const e = this._edge(pr, x, z, this._e || (this._e = {})), bd = e.d, bx = e.x, bz = e.z;
        if (e.inside) { const upD = pr.y1 - (y - r); if (upD <= bd + r || y >= pr.y1 - 0.05) return { n: [0, 1, 0], depth: upD }; const l = bd || 1; return { n: [(bx - x) / l, 0, (bz - z) / l], depth: bd + r }; }
        if (bd >= r) return null; if (y >= pr.y1) { const dy = y - pr.y1, d = Math.hypot(bd, dy); if (d >= r) return null; return { n: [(x - bx) / (d || 1), dy / (d || 1), (z - bz) / (d || 1)], depth: r - d }; }
        return { n: [(x - bx) / (bd || 1), 0, (z - bz) / (bd || 1)], depth: r - bd };
      }
      /* a circle of radius r at (x, z) against a prism's walls only: null, or [nx, nz, depth] */
      _prismSide(pr, x, z, r) { const e = this._edge(pr, x, z, this._e || (this._e = {})); if (e.inside) { const l = e.d || 1; return [(e.x - x) / l, (e.z - z) / l, e.d + r]; } if (e.d >= r) return null; const l = e.d || 1; return [(x - e.x) / l, (z - e.z) / l, r - e.d]; }
      _statics(b, out) {
        const k = b.shape.kind;
        if (this.ground && b.min[1] < this.groundY) {
          if (k === 'box') { for (const c of b.corners()) if (c[1] < this.groundY) out.push({ a: null, b, n: [0, 1, 0], p: [c[0], this.groundY, c[2]], depth: this.groundY - c[1], mu: this.groundFriction }); }
          else for (const c of (k === 'sphere' ? [b.pos] : segEnds(b))) { const d = this.groundY - (c[1] - b.shape.r); if (d > 0) out.push({ a: null, b, n: [0, 1, 0], p: [c[0], this.groundY, c[2]], depth: d, mu: this.groundFriction }); }
        }
        const near = this.prismsIn(b.min[0], b.min[2], b.max[0], b.max[2], this._near || (this._near = []));
        for (const pr of near) { if (b.min[1] >= pr.y1 || b.max[1] <= pr.y0) continue;
          if (k === 'box') { for (const c of b.corners()) { const h = this._prismPoint(pr, c[0], c[1], c[2], 0); if (h) out.push({ a: null, b, n: h.n, p: c, depth: h.depth, mu: 0.6 }); } }
          else for (const c of b.centers()) { const h = this._prismPoint(pr, c[0], c[1], c[2], b.shape.r); if (h) out.push({ a: null, b, n: h.n, p: [c[0] - h.n[0] * b.shape.r, c[1] - h.n[1] * b.shape.r, c[2] - h.n[2] * b.shape.r], depth: h.depth, mu: 0.6 }); } }
        for (const st of this.statics) { if (st.min[0] > b.max[0] || st.max[0] < b.min[0] || st.min[1] > b.max[1] || st.max[1] < b.min[1] || st.min[2] > b.max[2] || st.max[2] < b.min[2]) continue; pair(st, b, out); }
      }
      step(dt) {
        const B = this.bodies, g = this.gravity, C = this.contacts; C.length = 0; let awake = 0;
        for (const b of B) { if (b.asleep) continue; b.refresh(); V3.addScaled(b.vel, b.vel, g, dt * b.gravity); }
        for (const s of this.statics) if (s.type === 'kinematic') s.refresh();
        for (let i = 0; i < B.length; i++) { const a = B[i]; if (!a.asleep) this._statics(a, C);
          for (let j = i + 1; j < B.length; j++) { const b = B[j]; if (a.asleep && b.asleep) continue; if (a.min[0] > b.max[0] || a.max[0] < b.min[0] || a.min[1] > b.max[1] || a.max[1] < b.min[1] || a.min[2] > b.max[2] || a.max[2] < b.min[2]) continue; const n0 = C.length; pair(a, b, C); if (C.length > n0) { if (a.asleep && V3.len2(b.vel) > 0.05) a.wake(); if (b.asleep && V3.len2(a.vel) > 0.05) b.wake(); } } }
        /* prepare */
        const beta = 0.2 / dt, slop = 0.01;
        for (const c of C) { const a = c.a, b = c.b, n = c.n; c.ra = a ? V3.sub([0, 0, 0], c.p, a.pos) : null; c.rb = V3.sub([0, 0, 0], c.p, b.pos); c.jn = 0; c.jt1 = 0; c.jt2 = 0;
          c.t1 = V3.normalize([0, 0, 0], Math.abs(n[1]) < 0.9 ? V3.cross([0, 0, 0], n, [0, 1, 0]) : V3.cross([0, 0, 0], n, [1, 0, 0])); c.t2 = V3.cross([0, 0, 0], n, c.t1);
          const km = d => { let k = (a ? a.invMass : 0) + b.invMass; if (a && a.invMass) { V3.cross(tmp, c.ra, d); a.invInertia(t2, tmp); V3.cross(t3, t2, c.ra); k += V3.dot(t3, d); } V3.cross(tmp, c.rb, d); b.invInertia(t2, tmp); V3.cross(t3, t2, c.rb); k += V3.dot(t3, d); return k > 0 ? 1 / k : 0; };
          c.kn = km(n); c.k1 = km(c.t1); c.k2 = km(c.t2); const vn = this._vrel(c, n); c.bias = -beta * Math.max(0, c.depth - slop) + (vn < -1 ? Math.min(a ? a.restitution : 0.3, b.restitution) * vn : 0); c.f = c.mu != null ? Math.sqrt(c.mu * b.friction) : Math.sqrt((a ? a.friction : 0.6) * b.friction); }
        for (let it = 0; it < this.iterations; it++) for (const c of C) {
          let l = -(this._vrel(c, c.n) + c.bias) * c.kn; const old = c.jn; c.jn = Math.max(0, old + l); l = c.jn - old; this._apply(c, c.n, l);
          const mx = c.f * c.jn; let l1 = -this._vrel(c, c.t1) * c.k1; const o1 = c.jt1; c.jt1 = clamp(o1 + l1, -mx, mx); this._apply(c, c.t1, c.jt1 - o1);
          let l2 = -this._vrel(c, c.t2) * c.k2; const o2 = c.jt2; c.jt2 = clamp(o2 + l2, -mx, mx); this._apply(c, c.t2, c.jt2 - o2); }
        const dq = [0, 0, 0, 0];
        for (const b of B) { if (b.asleep) continue; awake++;
          V3.scale(b.vel, b.vel, Math.max(0, 1 - b.linDamp * dt)); V3.scale(b.ang, b.ang, Math.max(0, 1 - b.angDamp * dt)); V3.addScaled(b.pos, b.pos, b.vel, dt);
          const w = b.ang, q = b.rot; dq[0] = w[0] * dt * 0.5; dq[1] = w[1] * dt * 0.5; dq[2] = w[2] * dt * 0.5; dq[3] = 0; Q.mul(dq, dq, q); q[0] += dq[0]; q[1] += dq[1]; q[2] += dq[2]; q[3] += dq[3]; Q.normalize(q, q);
          if (V3.len2(b.vel) + V3.len2(b.ang) * 0.3 < 0.012) { b.still += dt; if (b.still > 0.7) { b.asleep = true; V3.set(b.vel, 0, 0, 0); V3.set(b.ang, 0, 0, 0); } } else b.still = 0;
          if (b.pos[1] < this.groundY - 60) { b.pos[1] = this.groundY + 30; V3.set(b.vel, 0, 0, 0); }     /* fell out of the world */
          if (b.entity && !b.entity.destroyed) { const t = b.entity.transform; V3.copy(t.position, b.pos); Q.copy(t.rotation, b.rot); t.dirty(); } }
        for (const ch of this.characters) ch.push(dt);
        this.awake = awake;
      }
      _vrel(c, d) { const a = c.a, b = c.b; V3.cross(tmp, b.ang, c.rb); let v = (b.vel[0] + tmp[0]) * d[0] + (b.vel[1] + tmp[1]) * d[1] + (b.vel[2] + tmp[2]) * d[2]; if (a) { /* a body with no mass still has the speed it is driven at: a car carries what it hits */ V3.cross(tmp, a.ang, c.ra); v -= (a.vel[0] + tmp[0]) * d[0] + (a.vel[1] + tmp[1]) * d[1] + (a.vel[2] + tmp[2]) * d[2]; } return v; }
      _apply(c, d, l) { if (!l) return; const a = c.a, b = c.b; V3.addScaled(b.vel, b.vel, d, l * b.invMass); V3.cross(tmp, c.rb, d); b.invInertia(t2, tmp); V3.addScaled(b.ang, b.ang, t2, l); if (a && a.invMass) { V3.addScaled(a.vel, a.vel, d, -l * a.invMass); V3.cross(tmp, c.ra, d); a.invInertia(t2, tmp); V3.addScaled(a.ang, a.ang, t2, -l); } }

      /* the first thing a ray meets: { t, point, normal, body | prism } */
      raycast(o, d, max) {
        let best = null; const hit = (t, n, x) => { if (t > 1e-4 && t < (best ? best.t : (max || 1e9))) best = Object.assign({ t, normal: n }, x); };
        if (this.ground && d[1] < -1e-6) hit((this.groundY - o[1]) / d[1], [0, 1, 0], { ground: true });
        for (const pr of this.prisms) { const bb = pr.bb; let t0 = 0, t1 = best ? best.t : (max || 1e9), ok = true;
          for (const [k, lo, hi] of [[0, bb[0], bb[2]], [1, pr.y0, pr.y1], [2, bb[1], bb[3]]]) { if (Math.abs(d[k]) < 1e-9) { if (o[k] < lo || o[k] > hi) { ok = false; break; } } else { let a = (lo - o[k]) / d[k], b = (hi - o[k]) / d[k]; if (a > b) { const s = a; a = b; b = s; } if (a > t0) t0 = a; if (b < t1) t1 = b; if (t0 > t1) { ok = false; break; } } }
          if (!ok) continue; const R = pr.ring;
          if (d[1] < -1e-6 && o[1] > pr.y1) { const t = (pr.y1 - o[1]) / d[1]; if (Poly.contains(R, o[0] + d[0] * t, o[2] + d[2] * t)) hit(t, [0, 1, 0], { prism: pr }); }
          for (let i = 0, j = R.length - 1; i < R.length; j = i++) { const a = R[j], b = R[i], ex = b[0] - a[0], ez = b[1] - a[1], den = d[0] * ez - d[2] * ex; if (Math.abs(den) < 1e-9) continue; const t = ((a[0] - o[0]) * ez - (a[1] - o[2]) * ex) / den, u = ((a[0] - o[0]) * d[2] - (a[1] - o[2]) * d[0]) / den; if (u < 0 || u > 1 || t <= 0) continue; const y = o[1] + d[1] * t; if (y < pr.y0 || y > pr.y1) continue; const l = Math.hypot(ex, ez) || 1; let nx = ez / l, nz = -ex / l; if (nx * d[0] + nz * d[2] > 0) { nx = -nx; nz = -nz; } hit(t, [nx, 0, nz], { prism: pr }); } }
        const lo = [0, 0, 0], ld = [0, 0, 0];
        for (const b of this.bodies.concat(this.statics)) { const s = b.shape;
          if (s.kind === 'sphere') { const ox = o[0] - b.pos[0], oy = o[1] - b.pos[1], oz = o[2] - b.pos[2], bq = ox * d[0] + oy * d[1] + oz * d[2], c = ox * ox + oy * oy + oz * oz - s.r * s.r, h = bq * bq - c; if (h < 0) continue; const t = -bq - Math.sqrt(h); if (t > 0) hit(t, V3.normalize([0, 0, 0], [ox + d[0] * t, oy + d[1] * t, oz + d[2] * t]), { body: b }); continue; }
          const h = s.kind === 'box' ? s.h : [s.r, s.hh + s.r, s.r], a = b.ax, rel = [o[0] - b.pos[0], o[1] - b.pos[1], o[2] - b.pos[2]]; for (let k = 0; k < 3; k++) { lo[k] = V3.dot(rel, a[k]); ld[k] = V3.dot(d, a[k]); }
          let t0 = 0, t1 = 1e9, ax = 0, sgn = 1, ok = true; for (let k = 0; k < 3; k++) { if (Math.abs(ld[k]) < 1e-9) { if (Math.abs(lo[k]) > h[k]) { ok = false; break; } continue; } let x0 = (-h[k] - lo[k]) / ld[k], x1 = (h[k] - lo[k]) / ld[k], sg = -1; if (x0 > x1) { const s2 = x0; x0 = x1; x1 = s2; sg = 1; } if (x0 > t0) { t0 = x0; ax = k; sgn = sg; } if (x1 < t1) t1 = x1; if (t0 > t1) { ok = false; break; } }
          if (ok && t0 > 0) hit(t0, [a[ax][0] * sgn, a[ax][1] * sgn, a[ax][2] * sgn], { body: b }); }
        if (best) best.point = [o[0] + d[0] * best.t, o[1] + d[1] * best.t, o[2] + d[2] * best.t]; return best;
      }
      /* the height of the ground or roof under a point, for something whose feet are at y (it can step up by step) */
      floorAt(x, z, y, step) { let h = this.ground ? this.groundY : -Infinity; const near = this.prismsIn(x, z, x, z, this._near2 || (this._near2 = [])); for (const pr of near) if (pr.y1 <= y + step && pr.y1 > h && Poly.contains(pr.ring, x, z)) h = pr.y1; return h; }
      /* wire frames of everything, for the editor's physics view */
      debugDraw(L, around, radius) {
        const col = b => (b.type !== 'dynamic' ? [0.4, 0.75, 1, 1] : b.asleep ? [0.5, 0.5, 0.55, 1] : [0.35, 1, 0.45, 1]);
        for (const b of this.bodies.concat(this.statics)) { const s = b.shape; if (s.kind === 'sphere') L.sphere(b.pos, s.r, col(b), 1.2); else { const m = M4.compose(M4.create(), b.pos, b.rot, [1, 1, 1]); L.obb(m, s.kind === 'box' ? s.h : [s.r, s.hh + s.r, s.r], col(b), 1.2); } }
        for (const pr of this.prisms) { if (around && (pr.bb[2] < around[0] - radius || pr.bb[0] > around[0] + radius || pr.bb[3] < around[2] - radius || pr.bb[1] > around[2] + radius)) continue; const R = pr.ring; for (let i = 0, j = R.length - 1; i < R.length; j = i++) { L.line([R[j][0], pr.y1, R[j][1]], [R[i][0], pr.y1, R[i][1]], [1, 0.8, 0.2, 1], 1.2); L.line([R[i][0], pr.y0, R[i][1]], [R[i][0], pr.y1, R[i][1]], [1, 0.8, 0.2, 0.6], 1); } }
        for (const c of this.contacts) L.line(c.p, [c.p[0] + c.n[0] * 0.3, c.p[1] + c.n[1] * 0.3, c.p[2] + c.n[2] * 0.3], [1, 0.2, 0.2, 2], 2);
      }
    }

    /* ---------- a character: a capsule moved by intent, stopped by walls, carried by ground and roofs ---------- */
    class Character {
      constructor(world, o) { o = o || {}; this.world = world; this.radius = o.radius || 0.35; this.height = o.height || 1.75; this.step = o.step == null ? 0.45 : o.step; this.pos = V3.create(); this.vy = 0; this.grounded = false; this.fly = false; world.characters.push(this); this._near = []; }
      /* move by (dx, dz) this frame; jump starts a jump when standing; in fly mode dy moves freely */
      move(dx, dz, dt, jump, dy) {
        const W = this.world, p = this.pos, r = this.radius, n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / (r * 0.6)));
        if (this.fly) { p[1] += dy || 0; this.vy = 0; } else { if (jump && this.grounded) { this.vy = 4.6; this.grounded = false; } this.vy += W.gravity[1] * dt; p[1] += this.vy * dt; }
        for (let s = 0; s < n; s++) {
          p[0] += dx / n; p[2] += dz / n; const near = W.prismsIn(p[0] - r, p[2] - r, p[0] + r, p[2] + r, this._near);
          for (let it = 0; it < 3; it++) { let moved = false; for (const pr of near) { if (p[1] + this.step >= pr.y1 || p[1] + this.height <= pr.y0) continue; const h = W._prismSide(pr, p[0], p[2], r); if (h) { p[0] += h[0] * h[2]; p[2] += h[1] * h[2]; moved = true; } } if (!moved) break; }
        }
        for (const st of W.statics) { if (st.shape.kind !== 'box' || st.min[0] > p[0] + r || st.max[0] < p[0] - r || st.min[2] > p[2] + r || st.max[2] < p[2] - r || st.min[1] > p[1] + this.height || st.max[1] < p[1] + 0.2) continue;
          const ax = st.ax, dx = p[0] - st.pos[0], dz = p[2] - st.pos[2], lx = dx * ax[0][0] + dz * ax[0][2], lz = dx * ax[2][0] + dz * ax[2][2], hx = st.shape.h[0] + r, hz = st.shape.h[2] + r; if (Math.abs(lx) >= hx || Math.abs(lz) >= hz) continue;
          const ox = hx - Math.abs(lx), oz = hz - Math.abs(lz); if (ox < oz) { const sg = lx < 0 ? -1 : 1; p[0] += ax[0][0] * sg * ox; p[2] += ax[0][2] * sg * ox; } else { const sg = lz < 0 ? -1 : 1; p[0] += ax[2][0] * sg * oz; p[2] += ax[2][2] * sg * oz; } }
        const fl = W.floorAt(p[0], p[2], p[1], this.step); if (p[1] <= fl) { p[1] = fl; this.vy = 0; this.grounded = true; } else if (!this.fly) this.grounded = p[1] - fl < 0.02;
        return p;
      }
      /* shove the loose bodies the character walks into */
      push() { const p = this.pos, c = [p[0], p[1] + this.height / 2, p[2]], r = this.radius + 0.1; for (const b of this.world.bodies) { if (b.min[0] > c[0] + r || b.max[0] < c[0] - r || b.min[2] > c[2] + r || b.max[2] < c[2] - r || b.min[1] > p[1] + this.height || b.max[1] < p[1]) continue; const dx = b.pos[0] - c[0], dz = b.pos[2] - c[2], l = Math.hypot(dx, dz) || 1; b.impulse([dx / l * b.mass * 0.6, 0, dz / l * b.mass * 0.6]); } }
      dispose() { const i = this.world.characters.indexOf(this); if (i >= 0) this.world.characters.splice(i, 1); }
    }
    return { Body, World, Character };
  })();

  /* a rigid body on an entity: the shape comes from the entity's primitive mesh unless given */
  class RigidBody extends Component {
    constructor(e) { super(e); this.mass = 0; this.kind = 'auto'; this.kinematic = false; this.restitution = 0.2; this.friction = 0.6; this.body = null; }
    onStart() {
      const W = this.engine.physics; if (!W) return; const t = this.transform, w = t.world, p = [0, 0, 0], q = [0, 0, 0, 1], s = [1, 1, 1]; M4.decompose(w, p, q, s);
      const mr = this.entity.get('MeshRenderer'), sh = mr && mr.shape ? mr.shape : { kind: 'box', args: [1, 1, 1] }, a = sh.args || [], kind = this.kind === 'auto' ? (sh.kind === 'sphere' || sh.kind === 'blob' ? 'sphere' : sh.kind === 'capsule' ? 'capsule' : 'box') : this.kind; let shape;
      if (kind === 'sphere') shape = { kind, r: (a[0] || 0.5) * Math.max(s[0], s[1], s[2]) }; else if (kind === 'capsule') { const r = (a[0] || 0.3) * Math.max(s[0], s[2]); shape = { kind, r, hh: Math.max(0.01, (a[1] || 1.8) * s[1] / 2 - r) }; }
      else { const b = mr && mr.mesh ? mr.mesh.bounds : { min: [-0.5, -0.5, -0.5], max: [0.5, 0.5, 0.5] }; shape = { kind: 'box', h: [Math.max(0.02, (b.max[0] - b.min[0]) / 2 * s[0]), Math.max(0.02, (b.max[1] - b.min[1]) / 2 * s[1]), Math.max(0.02, (b.max[2] - b.min[2]) / 2 * s[2])] }; }
      this.body = W.add({ type: this.kinematic ? 'kinematic' : 'dynamic', shape, position: p, rotation: q, mass: this.mass > 0 ? this.mass : undefined, restitution: this.restitution, friction: this.friction, entity: this.kinematic ? null : this.entity });
    }
    /* moved by hand (a gizmo, a script): the body follows and wakes */
    onFixedUpdate() { const b = this.body; if (!b) return; const t = this.transform, p = t.position, q = t.rotation;
      if (this.kinematic || Math.abs(p[0] - b.pos[0]) + Math.abs(p[1] - b.pos[1]) + Math.abs(p[2] - b.pos[2]) > 1e-5 || Math.abs(q[0] - b.rot[0]) + Math.abs(q[1] - b.rot[1]) + Math.abs(q[2] - b.rot[2]) + Math.abs(q[3] - b.rot[3]) > 1e-5) { V3.copy(b.pos, p); Q.copy(b.rot, q); b.wake(); b.refresh(); if (!this.kinematic) { V3.set(b.vel, 0, 0, 0); V3.set(b.ang, 0, 0, 0); } } }
    impulse(j, at) { if (this.body) this.body.impulse(j, at); }
    onDestroy() { if (this.body && this.engine.physics) this.engine.physics.remove(this.body); this.body = null; }
  }
  RigidBody.props = { mass: { type: 'float', min: 0, max: 100000, step: 1 }, kind: { type: 'enum', options: ['auto', 'box', 'sphere', 'capsule'] }, kinematic: { type: 'bool' }, restitution: { type: 'float', min: 0, max: 1, step: 0.01 }, friction: { type: 'float', min: 0, max: 2, step: 0.01 } };
  registerComponent('RigidBody', RigidBody);
  Object.assign(SE, { Physics, RigidBody });

  /* ==== particles: emitters simulated on the processor, drawn as soft, camera-facing sprites in one instanced call ==== */
  const PART_VS = `
layout(location=0) in vec2 a_corner; layout(location=1) in vec4 i_posSize; layout(location=2) in vec4 i_color; layout(location=3) in vec4 i_velSeed;
uniform mat4 u_viewProj, u_view; uniform float u_stretch;
out vec2 v_uv; out vec4 v_color; out float v_viewZ; out float v_seed;
void main() {
  vec3 right = vec3(u_view[0][0], u_view[1][0], u_view[2][0]), up = vec3(u_view[0][1], u_view[1][1], u_view[2][1]), fwd = vec3(u_view[0][2], u_view[1][2], u_view[2][2]);
  vec3 p = i_posSize.xyz; float s = i_posSize.w; vec2 c = a_corner;
  if (u_stretch > 0.0) { vec3 v = i_velSeed.xyz; float sp = length(v); vec3 ax = sp > 1e-4 ? v / sp : up; vec3 side = normalize(cross(ax, fwd) + vec3(1e-5)); p += side * (c.x * s) + ax * (c.y * (s + sp * u_stretch)); }
  else { float a = i_velSeed.w * 6.2831853, cs = cos(a), sn = sin(a); vec2 r = vec2(c.x * cs - c.y * sn, c.x * sn + c.y * cs); p += (right * r.x + up * r.y) * s; }
  vec4 vp = u_view * vec4(p, 1.0); v_viewZ = -vp.z; v_uv = a_corner; v_color = i_color; v_seed = i_velSeed.w; gl_Position = u_viewProj * vec4(p, 1.0);
}`;
  const PART_FS = `
#include <common>
in vec2 v_uv; in vec4 v_color; in float v_viewZ; in float v_seed; out vec4 o_color;
uniform sampler2D u_depth; uniform vec2 u_res, u_nearFar; uniform vec4 u_look; uniform vec3 u_light; uniform float u_time;
float linZ(float d) { float z = d * 2.0 - 1.0; return 2.0 * u_nearFar.x * u_nearFar.y / (u_nearFar.y + u_nearFar.x - z * (u_nearFar.y - u_nearFar.x)); }
void main() {
  float r = length(v_uv); if (r > 1.0) discard;
  float a = u_look.z > 0.5 ? smoothstep(1.0, 0.75, abs(v_uv.x)) * smoothstep(1.0, 0.2, abs(v_uv.y)) : pow(1.0 - r, u_look.y);
  if (u_look.x > 0.5) a *= 0.55 + 0.75 * fbm(v_uv * 1.7 + v_seed * 37.0 + u_time * 0.05);      /* a wisp, not a disc */
  float sz = linZ(texture(u_depth, gl_FragCoord.xy / u_res).r), fade = clamp((sz - v_viewZ) / max(u_look.w, 1e-3), 0.0, 1.0); if (fade <= 0.0) discard;
  a *= v_color.a * fade * clamp((v_viewZ - u_nearFar.x) * 1.5, 0.0, 1.0);
  o_color = vec4(v_color.rgb * u_light, a);
}`;
  const PRESETS = {
    smoke: { rate: 14, life: [3.5, 6], speed: [0.6, 1.4], spread: 16, gravity: -0.5, drag: 0.4, size: [0.5, 3.2], colorA: [0.42, 0.42, 0.42, 0.42], colorB: [0.55, 0.55, 0.56, 0], blend: 'alpha', lit: 1, wispy: true, radius: 0.3, turbulence: 0.5, soft: 0.6 },
    steam: { rate: 20, life: [1.6, 3], speed: [0.9, 1.8], spread: 12, gravity: -0.9, drag: 0.8, size: [0.25, 1.6], colorA: [0.95, 0.96, 0.98, 0.3], colorB: [1, 1, 1, 0], blend: 'alpha', lit: 1, wispy: true, radius: 0.15, turbulence: 0.6, soft: 0.4 },
    fire: { rate: 46, life: [0.5, 1.1], speed: [1.2, 2.6], spread: 14, gravity: -2.2, drag: 0.6, size: [0.55, 0.12], colorA: [9, 3.2, 0.5, 0.9], colorB: [3, 0.3, 0.02, 0], blend: 'add', lit: 0, wispy: true, radius: 0.25, turbulence: 1.2, soft: 0.3 },
    sparks: { rate: 30, life: [0.6, 1.4], speed: [4, 9], spread: 55, gravity: 9.8, drag: 0.2, size: [0.035, 0.02], colorA: [16, 8, 2, 1], colorB: [6, 1, 0.1, 0], blend: 'add', lit: 0, stretch: 0.05, radius: 0.05, soft: 0.1 },
    dust: { rate: 10, life: [3, 6], speed: [0.2, 0.6], spread: 80, gravity: 0.05, drag: 0.5, size: [0.4, 1.8], colorA: [0.62, 0.55, 0.45, 0.2], colorB: [0.62, 0.55, 0.45, 0], blend: 'alpha', lit: 1, wispy: true, radius: 1.5, turbulence: 0.4, soft: 0.8 },
    fountain: { rate: 120, life: [1.2, 2], speed: [6, 8], spread: 12, gravity: 9.8, drag: 0.05, size: [0.06, 0.1], colorA: [0.75, 0.88, 1, 0.55], colorB: [0.85, 0.93, 1, 0], blend: 'alpha', lit: 1, radius: 0.08, soft: 0.2 },
    rain: { rate: 2600, max: 5200, life: [0.9, 1.3], speed: [17, 21], spread: 3, direction: [0.12, -1, 0.05], gravity: 0, drag: 0, size: [0.012, 0.012], colorA: [0.7, 0.78, 0.9, 0.34], colorB: [0.7, 0.78, 0.9, 0.34], blend: 'alpha', lit: 1, stretch: 0.034, shape: 'box', extent: [26, 1, 26], soft: 0.3 },
    snow: { rate: 700, max: 5000, life: [5, 7], speed: [1.2, 2], spread: 20, direction: [0.2, -1, 0.1], gravity: 0, drag: 0, size: [0.03, 0.03], colorA: [1, 1, 1, 0.8], colorB: [1, 1, 1, 0.8], blend: 'alpha', lit: 1, shape: 'box', extent: [24, 1, 24], turbulence: 0.6, soft: 0.2 },
    embers: { rate: 18, life: [2, 4.5], speed: [0.5, 1.6], spread: 40, gravity: -0.8, drag: 0.3, size: [0.03, 0.01], colorA: [12, 4, 0.6, 1], colorB: [4, 0.6, 0.05, 0], blend: 'add', lit: 0, radius: 0.5, turbulence: 1.4, soft: 0.2 },
  };
  class ParticleSystem extends Component {
    constructor(e) {
      super(e); this.isParticles = true; this.preset = 'smoke'; this.max = 600; this.emitting = true; this.duration = 0; this.direction = [0, 1, 0]; this.shape = 'sphere'; this.extent = [1, 1, 1]; this.stretch = 0; this.wispy = false; this.turbulence = 0; this.soft = 0.5; this.lit = 1;
      Object.assign(this, JSON.parse(JSON.stringify(PRESETS.smoke))); this.n = 0; this._acc = 0; this._t = 0; this._rng = rng(this.entity.id * 7919); this._init = false;
    }
    onLoad(p) { if (p.preset && !p.rate) this.setPreset(p.preset); }
    setPreset(name) { const p = PRESETS[name]; if (!p) return this; this.preset = name; Object.assign(this, { direction: [0, 1, 0], shape: 'sphere', extent: [1, 1, 1], stretch: 0, wispy: false, turbulence: 0, max: 600 }, JSON.parse(JSON.stringify(p))); this._init = false; this.n = 0; return this; }
    _alloc() { const dev = this.engine.device, gl = dev.gl, N = this.max; this.P = new Float32Array(N * 8); this.I = new Float32Array(N * 12);   /* state: pos 3, vel 3, age, life; instance: pos+size, colour, vel+seed */
      if (!this.vao) { this.vao = gl.createVertexArray(); this.quad = gl.createBuffer(); this.ibuf = gl.createBuffer(); }
      dev.vao(this.vao); gl.bindBuffer(gl.ARRAY_BUFFER, this.quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.ibuf); gl.bufferData(gl.ARRAY_BUFFER, this.I.byteLength, gl.DYNAMIC_DRAW); for (let i = 0; i < 3; i++) { gl.enableVertexAttribArray(1 + i); gl.vertexAttribPointer(1 + i, 4, gl.FLOAT, false, 48, i * 16); gl.vertexAttribDivisor(1 + i, 1); }
      dev.vao(null); this.S = new Float32Array(N); this.n = 0; this._init = true; }
    /* advance the simulation; true while anything is alive or still to come */
    update(dt) {
      if (!this._init) this._alloc(); const P = this.P, S = this.S, R = this._rng, N = this.max, w = this.transform.world, g = this.gravity, dr = Math.max(0, 1 - this.drag * dt), tb = this.turbulence; this._t += dt;
      let n = this.n; for (let i = 0; i < n; i++) { const o = i * 8; P[o + 6] += dt; if (P[o + 6] >= P[o + 7]) { n--; if (i !== n) { P.copyWithin(o, n * 8, n * 8 + 8); S[i] = S[n]; } i--; continue; }
        P[o + 4] -= g * dt; if (tb) { const ph = S[i] * 40 + this._t * 1.3; P[o + 3] += Math.sin(ph + P[o + 1]) * tb * dt; P[o + 5] += Math.cos(ph * 1.3 + P[o + 1] * 0.7) * tb * dt; }
        P[o + 3] *= dr; P[o + 4] *= dr; P[o + 5] *= dr; P[o] += P[o + 3] * dt; P[o + 1] += P[o + 4] * dt; P[o + 2] += P[o + 5] * dt; }
      const on = this.emitting && (!this.duration || this._t < this.duration);
      if (on) { this._acc += this.rate * dt; const d = V3.normalize([0, 0, 0], V3.transformDir([0, 0, 0], this.direction, w)), u = V3.normalize([0, 0, 0], V3.cross([0, 0, 0], Math.abs(d[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0], d)), v = V3.cross([0, 0, 0], d, u), sp = this.spread * RAD;
        while (this._acc >= 1 && n < N) { this._acc -= 1; const o = n * 8; let ox, oy, oz;
          if (this.shape === 'box') { ox = (R() * 2 - 1) * this.extent[0]; oy = (R() * 2 - 1) * this.extent[1]; oz = (R() * 2 - 1) * this.extent[2]; } else { const a = R() * TAU, z = R() * 2 - 1, r = Math.sqrt(1 - z * z) * (this.radius || 0) * Math.cbrt(R()); ox = Math.cos(a) * r; oy = z * (this.radius || 0) * 0.5; oz = Math.sin(a) * r; }
          P[o] = w[12] + ox; P[o + 1] = w[13] + oy; P[o + 2] = w[14] + oz; const th = Math.acos(1 - R() * (1 - Math.cos(sp))), ph = R() * TAU, st = Math.sin(th), ct = Math.cos(th), s = lerp(this.speed[0], this.speed[1], R());
          P[o + 3] = (d[0] * ct + (u[0] * Math.cos(ph) + v[0] * Math.sin(ph)) * st) * s; P[o + 4] = (d[1] * ct + (u[1] * Math.cos(ph) + v[1] * Math.sin(ph)) * st) * s; P[o + 5] = (d[2] * ct + (u[2] * Math.cos(ph) + v[2] * Math.sin(ph)) * st) * s;
          P[o + 6] = 0; P[o + 7] = lerp(this.life[0], this.life[1], R()); S[n] = R(); n++; }
        if (this._acc > N) this._acc = 0; }
      this.n = n; return n > 0 || on;
    }
    render(renderer, cam, time) {
      const n = this.n; if (!n || !this._init) return; const dev = renderer.dev, gl = dev.gl, P = this.P, I = this.I, S = this.S, a = this.colorA, b = this.colorB, s0 = this.size[0], s1 = this.size[1], sky = renderer.sky;
      for (let i = 0; i < n; i++) { const o = i * 8, k = i * 12, t = P[o + 6] / P[o + 7], fin = Math.min(1, t * 8); I[k] = P[o]; I[k + 1] = P[o + 1]; I[k + 2] = P[o + 2]; I[k + 3] = s0 + (s1 - s0) * t; I[k + 4] = a[0] + (b[0] - a[0]) * t; I[k + 5] = a[1] + (b[1] - a[1]) * t; I[k + 6] = a[2] + (b[2] - a[2]) * t; I[k + 7] = (a[3] + (b[3] - a[3]) * t) * fin; I[k + 8] = P[o + 3]; I[k + 9] = P[o + 4]; I[k + 10] = P[o + 5]; I[k + 11] = S[i]; }
      gl.bindBuffer(gl.ARRAY_BUFFER, this.ibuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, I.subarray(0, n * 12));
      const p = dev.program('particles', PART_VS, PART_FS), L = this.lit, lc = sky.lightColor, am = sky.ambient;
      dev.state({ depthTest: false, cull: 'none', blend: this.blend === 'add' ? 'addT' : 'alphaT' });   /* particles have no motion vectors: the mark they leave in the alpha tells the temporal filter to follow them */
      p.use().sets({ u_viewProj: cam.viewProj, u_view: cam.view, u_depth: renderer.T.depth, u_res: [renderer.w, renderer.h], u_nearFar: [cam.near, cam.far], u_stretch: this.stretch || 0, u_time: time,
        u_look: [this.wispy ? 1 : 0, this.wispy ? 0.6 : 1.4, this.stretch ? 1 : 0, this.soft], u_light: L ? [lerp(1, lc[0] * 0.22 + am[0] * 1.6, L), lerp(1, lc[1] * 0.22 + am[1] * 1.6, L), lerp(1, lc[2] * 0.22 + am[2] * 1.6, L)] : [1, 1, 1] });
      dev.vao(this.vao); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n); renderer.stats.draws++; renderer.stats.instances += n; renderer.stats.tris += n * 2;
    }
    onDestroy() { if (this.vao) { const gl = this.engine.device.gl; gl.deleteVertexArray(this.vao); gl.deleteBuffer(this.quad); gl.deleteBuffer(this.ibuf); this.vao = null; } }
    toJSON() { return { preset: this.preset, rate: this.rate, max: this.max, emitting: this.emitting, life: this.life, speed: this.speed, spread: this.spread, gravity: this.gravity, drag: this.drag, size: this.size, colorA: this.colorA, colorB: this.colorB, blend: this.blend, lit: this.lit, wispy: this.wispy, radius: this.radius, turbulence: this.turbulence, soft: this.soft, direction: this.direction, shape: this.shape, extent: this.extent, stretch: this.stretch }; }
  }
  ParticleSystem.props = { preset: { type: 'enum', options: Object.keys(PRESETS), set: (c, v) => c.setPreset(v) }, emitting: { type: 'bool' }, rate: { type: 'float', min: 0, max: 5000, step: 1 }, spread: { type: 'float', min: 0, max: 180, step: 1 }, gravity: { type: 'float', min: -20, max: 20, step: 0.1 }, drag: { type: 'float', min: 0, max: 5, step: 0.05 }, turbulence: { type: 'float', min: 0, max: 5, step: 0.05 }, colorA: { type: 'color4' }, colorB: { type: 'color4' } };
  registerComponent('ParticleSystem', ParticleSystem);
  SE.ParticleSystem = ParticleSystem; SE.particlePresets = PRESETS;

  /* ==== timelines: values moved through keys over time (camera moves, tours, anything a script animates) ==== */
  const EASE = { linear: t => t, in: t => t * t, out: t => 1 - (1 - t) * (1 - t), inOut: t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2), smooth: t => t * t * (3 - 2 * t) };
  class Timeline {
    /* tracks: [{ keys: [{ t, v, ease }], apply(value), quat }]: v is a number or an array; quat tracks turn the short way round */
    constructor(engine, o) { o = o || {}; this.engine = engine; this.tracks = o.tracks || []; this.duration = o.duration || this.tracks.reduce((m, tr) => Math.max(m, tr.keys[tr.keys.length - 1].t), 0); this.loop = !!o.loop; this.time = 0; this.speed = 1; this.playing = false; this.onDone = o.onDone || null; this.onUpdate = o.onUpdate || null; }
    play() { this.playing = true; this.engine.timelines.add(this); this.engine.requestRender(); return this; }
    stop() { this.playing = false; this.engine.timelines.delete(this); return this; }
    seek(t) { this.time = t; this.apply(); return this; }
    sample(tr, t) { const K = tr.keys; if (t <= K[0].t) return K[0].v; const last = K[K.length - 1]; if (t >= last.t) return last.v; let i = 1; while (K[i].t < t) i++; const a = K[i - 1], b = K[i], u = (EASE[b.ease || 'inOut'] || EASE.inOut)((t - a.t) / Math.max(1e-6, b.t - a.t));
      if (typeof a.v === 'number') return a.v + (b.v - a.v) * u; if (tr.quat) return Q.slerp([0, 0, 0, 1], a.v, b.v, u); return a.v.map((x, k) => x + (b.v[k] - x) * u); }
    apply() { for (const tr of this.tracks) tr.apply(this.sample(tr, this.time)); if (this.onUpdate) this.onUpdate(this.time); }
    update(dt) { if (!this.playing) return; this.time += dt * this.speed; if (this.time >= this.duration) { if (this.loop) this.time %= this.duration; else { this.time = this.duration; this.apply(); this.stop(); if (this.onDone) this.onDone(); return; } } this.apply(); }
  }
  /* one value from a to b over seconds */
  const tween = (engine, from, to, seconds, apply, ease, onDone) => new Timeline(engine, { tracks: [{ keys: [{ t: 0, v: from }, { t: seconds, v: to, ease: ease || 'inOut' }], apply }], onDone }).play();
  /* keyed motion of an entity, as glTF animations and scripts use it */
  class Animator extends Component {
    constructor(e) { super(e); this.clips = []; this.clip = 0; this.speed = 1; this.loop = true; this.time = 0; this.playing = true; }
    onUpdate(dt) { const c = this.clips[this.clip]; if (!c || !this.playing) return; this.time += dt * this.speed; if (this.time > c.duration) this.time = this.loop ? this.time % Math.max(c.duration, 1e-6) : c.duration;
      for (const ch of c.channels) { const T = ch.times, n = T.length, t = this.time; let i = 0; while (i < n - 1 && T[i + 1] < t) i++; const j = Math.min(n - 1, i + 1), u = j === i || ch.step ? 0 : clamp((t - T[i]) / Math.max(1e-6, T[j] - T[i]), 0, 1), s = ch.size, V = ch.values, tr = ch.target.transform;
        if (ch.path === 'rotation') { Q.slerp(tr.rotation, V.subarray(i * 4, i * 4 + 4), V.subarray(j * 4, j * 4 + 4), u); Q.normalize(tr.rotation, tr.rotation); } else { const o = ch.path === 'translation' ? tr.position : tr.scale; for (let k = 0; k < s; k++) o[k] = V[i * s + k] + (V[j * s + k] - V[i * s + k]) * u; } tr.dirty(); } }
  }
  Animator.save = false; Animator.props = { clip: { type: 'int', min: 0, max: 64, step: 1 }, speed: { type: 'float', min: -4, max: 4, step: 0.05 }, loop: { type: 'bool' }, playing: { type: 'bool' } };
  registerComponent('Animator', Animator);
  Object.assign(SE, { Timeline, tween, EASE, Animator });

  /* ==== glTF 2.0: models in (meshes, materials with their textures, the node tree, keyed animation) and scenes out ==== */
  /* Reads .glb and .gltf whose buffers and images are embedded. Not read: skins, morph targets, cameras, lights, sparse
     accessors and compressed geometry (Draco, meshopt); a file that needs those says so. */
  const GLTF = {
    async load(engine, src, o) {
      o = o || {}; let buf = src; if (typeof src === 'string') buf = await (await fetch(src)).arrayBuffer(); else if (src && src.arrayBuffer && !(src instanceof ArrayBuffer)) buf = await src.arrayBuffer();
      const dv = new DataView(buf); let json, bin = null;
      if (dv.getUint32(0, true) === 0x46546C67) { let off = 12; while (off < dv.byteLength) { const len = dv.getUint32(off, true), type = dv.getUint32(off + 4, true); if (type === 0x4E4F534A) json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, off + 8, len))); else if (type === 0x004E4942) bin = new Uint8Array(buf, off + 8, len); off += 8 + len; } }
      else json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf)));
      if (!json || !json.asset) throw new Error('this is not a glTF file');
      const need = json.extensionsRequired || []; if (need.some(x => /draco|meshopt/i.test(x))) throw new Error('this model is compressed (' + need.join(', ') + '), which the engine does not read: export it without compression');
      const dataURI = u => { const m = /^data:[^;,]*(;base64)?,(.*)$/.exec(u); if (!m) throw new Error('the model points at a separate file (' + String(u).slice(0, 60) + '): use a .glb with everything inside'); if (!m[1]) return new TextEncoder().encode(decodeURIComponent(m[2])); const s = atob(m[2]), a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; };
      const buffers = (json.buffers || []).map((b, i) => (b.uri ? dataURI(b.uri) : (i === 0 && bin ? bin : new Uint8Array(b.byteLength))));
      const view = i => { const v = json.bufferViews[i], b = buffers[v.buffer]; return { data: b, off: b.byteOffset + (v.byteOffset || 0), len: v.byteLength, stride: v.byteStride || 0 }; };
      const NC = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }, CT = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
      const accessor = i => { const a = json.accessors[i], T = CT[a.componentType], n = NC[a.type], out = new T(a.count * n); if (a.bufferView == null) return { a: out, n, norm: !!a.normalized, T }; const v = view(a.bufferView), bs = T.BYTES_PER_ELEMENT, stride = v.stride || bs * n, base = v.off + (a.byteOffset || 0), d = new DataView(v.data.buffer);
        const rd = T === Float32Array ? (o2 => d.getFloat32(o2, true)) : T === Uint32Array ? (o2 => d.getUint32(o2, true)) : T === Uint16Array ? (o2 => d.getUint16(o2, true)) : T === Int16Array ? (o2 => d.getInt16(o2, true)) : T === Uint8Array ? (o2 => d.getUint8(o2)) : (o2 => d.getInt8(o2));
        for (let k = 0; k < a.count; k++) for (let c = 0; c < n; c++) out[k * n + c] = rd(base + k * stride + c * bs); return { a: out, n, norm: !!a.normalized, T }; };
      const dev = engine.device, texCache = new Map();
      const texture = (ti, srgb, onReady) => { if (ti == null) return; const key = ti + (srgb ? 's' : 'l'); if (texCache.has(key)) { texCache.get(key).then(onReady); return; } const t = json.textures[ti], im = json.images[t.source], smp = t.sampler != null ? json.samplers[t.sampler] : {};
        const blob = im.uri ? new Blob([dataURI(im.uri)], { type: im.mimeType || 'image/png' }) : (() => { const v = view(im.bufferView); return new Blob([new Uint8Array(v.data.buffer, v.off, v.len)], { type: im.mimeType || 'image/png' }); })();
        const p = createImageBitmap(blob, { colorSpaceConversion: 'none' }).then(bm => dev.imageTexture(bm, { srgb, wrap: smp.wrapS === 33071 ? 'clamp' : 'repeat' })); texCache.set(key, p); p.then(onReady).catch(e => console.warn('[Scout Engine] a texture of the model did not load', e)); };
      const mats = (json.materials || []).map(m => { const p = m.pbrMetallicRoughness || {}, bc = p.baseColorFactor || [1, 1, 1, 1], es = m.extensions && m.extensions.KHR_materials_emissive_strength;
        const mat = new Material({ name: m.name || 'material', albedo: [bc[0], bc[1], bc[2]], alpha: bc[3], roughness: p.roughnessFactor == null ? 1 : p.roughnessFactor, metallic: p.metallicFactor == null ? 1 : p.metallicFactor, emissive: m.emissiveFactor || [0, 0, 0], emissiveIntensity: es ? es.emissiveStrength : 1, twoSided: !!m.doubleSided, alphaTest: m.alphaMode === 'MASK' ? (m.alphaCutoff == null ? 0.5 : m.alphaCutoff) : 0, blend: m.alphaMode === 'BLEND' ? 'alpha' : 'opaque', vertexColors: false });
        const done = () => { mat.version++; engine.requestRender(); };
        if (p.baseColorTexture) texture(p.baseColorTexture.index, true, t => { mat.albedoMap = t; done(); }); if (p.metallicRoughnessTexture) texture(p.metallicRoughnessTexture.index, false, t => { mat.roughnessMap = t; done(); });
        if (m.normalTexture) { mat.normalScale = m.normalTexture.scale == null ? 1 : m.normalTexture.scale; texture(m.normalTexture.index, false, t => { mat.normalMap = t; done(); }); } if (m.emissiveTexture) texture(m.emissiveTexture.index, true, t => { mat.emissiveMap = t; done(); });
        return mat; });
      const fallback = new Material({ name: 'default', albedo: [0.8, 0.8, 0.8], roughness: 0.7 });
      const meshes = (json.meshes || []).map(m => m.primitives.filter(p => p.mode == null || p.mode === 4).map(p => { const A = p.attributes, pos = accessor(A.POSITION).a, d = { name: m.name || 'mesh', positions: pos instanceof Float32Array ? pos : Float32Array.from(pos), keep: true };
        if (p.indices != null) { const ix = accessor(p.indices).a; d.indices = ix instanceof Uint8Array ? Uint16Array.from(ix) : ix; } else { const n = pos.length / 3; d.indices = n > 65535 ? Uint32Array.from({ length: n }, (_, i) => i) : Uint16Array.from({ length: n }, (_, i) => i); }
        if (A.NORMAL != null) d.normals = Float32Array.from(accessor(A.NORMAL).a); else SE.Prim.smooth(d);
        if (A.TEXCOORD_0 != null) { const u = accessor(A.TEXCOORD_0), k = u.norm ? 1 / (u.T === Uint8Array ? 255 : 65535) : 1; d.uvs = Float32Array.from(u.a, v => v * k); }
        let vc = false; if (A.COLOR_0 != null) { const c = accessor(A.COLOR_0), n = pos.length / 3, C = new Uint8Array(n * 4), k = c.T === Float32Array ? 255 : c.T === Uint16Array ? 255 / 65535 : 1; for (let i = 0; i < n; i++) { for (let j = 0; j < 3; j++) C[i * 4 + j] = Math.round(255 * linToSrgb(clamp(c.a[i * c.n + j] * k / 255, 0, 1))); C[i * 4 + 3] = c.n === 4 ? c.a[i * 4 + 3] * k : 255; } d.colors = C; vc = true; }
        let mat = p.material != null ? mats[p.material] : fallback; if (vc && !mat.vertexColors) { mat = mat.clone({ vertexColors: true }); }
        return { mesh: d.positions.length / 3 > 3000 ? SE.Geo.buildLODs(dev, d) : new Mesh(dev, d), mat }; }));
      const sc = engine.scene, root = sc.createEntity(o.name || (json.scenes && json.scenes[json.scene || 0] && json.scenes[json.scene || 0].name) || 'Model', { parent: o.parent || null }), ents = [];
      const mk = (ni, parent) => { const n = json.nodes[ni], e = sc.createEntity(n.name || 'node ' + ni, { parent }); ents[ni] = e;
        if (n.matrix) e.transform.setWorld(M4.mul(M4.create(), parent.transform.world, Float32Array.from(n.matrix))); else { if (n.translation) e.transform.setPosition(n.translation); if (n.rotation) e.transform.setRotation(n.rotation); if (n.scale) e.transform.setScale(n.scale); }
        if (n.mesh != null) { const P = meshes[n.mesh]; P.forEach((pr, k) => { const t = P.length === 1 ? e : sc.createEntity((n.name || 'mesh') + ' ' + k, { parent: e }), r = t.add('MeshRenderer'); r.mesh = pr.mesh; r.material = pr.mat; }); }
        (n.children || []).forEach(c => mk(c, e)); };
      const scene = json.scenes ? json.scenes[json.scene || 0] : { nodes: (json.nodes || []).map((_, i) => i) }; (scene.nodes || []).forEach(n => mk(n, root));
      if (json.animations && json.animations.length) { const an = root.add('Animator'); an.clips = json.animations.map(a => { let dur = 0; const channels = a.channels.filter(c => ents[c.target.node] && /^(translation|rotation|scale)$/.test(c.target.path)).map(c => { const s = a.samplers[c.sampler], times = accessor(s.input).a, vals = accessor(s.output), V = Float32Array.from(vals.a); dur = Math.max(dur, times[times.length - 1] || 0); return { target: ents[c.target.node], path: c.target.path, times, values: V, size: vals.n, step: s.interpolation === 'STEP' }; }); return { name: a.name || 'clip', duration: dur, channels }; }); }
      /* stand it on the ground at a useful size if asked: o.fit = the height in metres to scale it to */
      if (o.fit) { let mn = Infinity, mx = -Infinity; root.traverse(e => { const r = e.get('MeshRenderer'); if (r && r.mesh) { const s = r.sphere(); mn = Math.min(mn, s[1] - s[3]); mx = Math.max(mx, s[1] + s[3]); } }); if (mx > mn) root.transform.setScale(o.fit / (mx - mn)); }
      engine.requestRender(); return root;
    },
    /* entities (default: everything a person built) as a .glb Blob: meshes with their normals, uvs and colours, materials as factors */
    export(engine, entities) {
      const list = entities || engine.scene.roots.filter(e => !e.transient), json = { asset: { version: '2.0', generator: SE.name + ' ' + SE.version }, scene: 0, scenes: [{ nodes: [] }], nodes: [], meshes: [], materials: [], accessors: [], bufferViews: [], buffers: [{ byteLength: 0 }] }, chunks = []; let size = 0;
      const push = (arr, target) => { const pad = (4 - size % 4) % 4; if (pad) { chunks.push(new Uint8Array(pad)); size += pad; } const u8 = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength); json.bufferViews.push({ buffer: 0, byteOffset: size, byteLength: u8.byteLength, target }); chunks.push(u8); size += u8.byteLength; return json.bufferViews.length - 1; };
      const acc = (arr, type, ct, target, extra) => { json.accessors.push(Object.assign({ bufferView: push(arr, target), componentType: ct, count: arr.length / { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[type], type }, extra || {})); return json.accessors.length - 1; };
      const mm = new Map(), mats = new Map();
      const matOf = m => { if (!m) return undefined; if (mats.has(m.id)) return mats.get(m.id); const d = { name: m.name, pbrMetallicRoughness: { baseColorFactor: [m.albedo[0], m.albedo[1], m.albedo[2], m.alpha], metallicFactor: m.metallic, roughnessFactor: m.roughness }, doubleSided: !!m.twoSided };
        const e = m.emissive, ei = m.emissiveIntensity, em = Math.max(e[0], e[1], e[2]) * ei; if (em > 0) { const k = Math.max(1, em); d.emissiveFactor = [e[0] * ei / k, e[1] * ei / k, e[2] * ei / k]; if (k > 1) { d.extensions = { KHR_materials_emissive_strength: { emissiveStrength: k } }; json.extensionsUsed = ['KHR_materials_emissive_strength']; } }
        if (m.blend !== 'opaque') d.alphaMode = 'BLEND'; else if (m.alphaTest > 0) { d.alphaMode = 'MASK'; d.alphaCutoff = m.alphaTest; } json.materials.push(d); mats.set(m.id, json.materials.length - 1); return json.materials.length - 1; };
      const meshOf = (mesh, mat) => { const c = mesh.cpu; if (!c) return undefined; const key = mesh.id + ':' + (mat ? mat.id : 0); if (mm.has(key)) return mm.get(key); const b = mesh.bounds, at = { POSITION: acc(c.positions, 'VEC3', 5126, 34962, { min: b.min, max: b.max }) };
        if (c.normals) at.NORMAL = acc(c.normals, 'VEC3', 5126, 34962); if (c.uvs) at.TEXCOORD_0 = acc(c.uvs, 'VEC2', 5126, 34962); if (c.colors && mat && mat.vertexColors) at.COLOR_0 = acc(c.colors, 'VEC4', 5121, 34962, { normalized: true });
        const prim = { attributes: at, mode: 4, material: matOf(mat) }; if (c.indices) prim.indices = acc(c.indices, 'SCALAR', c.indices instanceof Uint32Array ? 5125 : 5123, 34963); json.meshes.push({ name: mesh.name, primitives: [prim] }); mm.set(key, json.meshes.length - 1); return json.meshes.length - 1; };
      const node = e => { const t = e.transform, n = { name: e.name, translation: Array.from(t.position), rotation: Array.from(t.rotation), scale: Array.from(t.scale) }, r = e.get('MeshRenderer'); if (r && r.mesh) { const mi = meshOf(r.mesh.lods ? r.mesh.lods[0].mesh : r.mesh, r.material); if (mi !== undefined) n.mesh = mi; }
        const i = json.nodes.length; json.nodes.push(n); const kids = e.children.filter(c => !c.transient).map(node); if (kids.length) n.children = kids; return i; };
      list.forEach(e => json.scenes[0].nodes.push(node(e)));
      if (!json.meshes.length) throw new Error('nothing here has geometry the engine kept a copy of');
      if (!json.materials.length) delete json.materials; json.buffers[0].byteLength = size + (4 - size % 4) % 4;
      const js = new TextEncoder().encode(JSON.stringify(json)), jp = (4 - js.length % 4) % 4, bp = (4 - size % 4) % 4, total = 12 + 8 + js.length + jp + 8 + size + bp, out = new Uint8Array(total), dv = new DataView(out.buffer);
      dv.setUint32(0, 0x46546C67, true); dv.setUint32(4, 2, true); dv.setUint32(8, total, true); dv.setUint32(12, js.length + jp, true); dv.setUint32(16, 0x4E4F534A, true); out.set(js, 20); out.fill(0x20, 20 + js.length, 20 + js.length + jp);
      let o = 20 + js.length + jp; dv.setUint32(o, size + bp, true); dv.setUint32(o + 4, 0x004E4942, true); o += 8; for (const c of chunks) { out.set(c, o); o += c.length; }
      return new Blob([out], { type: 'model/gltf-binary' });
    },
  };
  SE.GLTF = GLTF;

  /* ==== sound: sources placed in the world, heard from the camera (Web Audio; silent until a person turns it on) ==== */
  class Audio {
    constructor(engine) { this.engine = engine; this.ctx = null; this.master = null; this.volume = 0.6; this.sources = new Set(); engine.on('frame', () => this._listen()); }
    get on() { return !!this.ctx && this.ctx.state === 'running'; }
    /* must be called from a click or a key press: browsers start sound only then */
    enable() { if (!this.ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false; this.ctx = new AC(); this.master = this.ctx.createGain(); this.master.gain.value = this.volume; this.master.connect(this.ctx.destination); } if (this.ctx.state !== 'running') this.ctx.resume(); this.sources.forEach(s => s._start()); return true; }
    disable() { if (this.ctx) this.ctx.suspend(); }
    setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = v; }
    _noise() { if (this._nb) return this._nb; const c = this.ctx, b = c.createBuffer(1, c.sampleRate * 3, c.sampleRate), d = b.getChannelData(0); let last = 0; for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.04 * w) / 1.04; d[i] = last * 3.2 + w * 0.02; } return (this._nb = b); }
    _listen() { if (!this.on) return; const cam = this.engine.camera, L = this.ctx.listener, p = cam.position, m = cam.invView, t = this.ctx.currentTime;
      if (L.positionX) { L.positionX.setTargetAtTime(p[0], t, 0.05); L.positionY.setTargetAtTime(p[1], t, 0.05); L.positionZ.setTargetAtTime(p[2], t, 0.05); L.forwardX.setTargetAtTime(-m[8], t, 0.05); L.forwardY.setTargetAtTime(-m[9], t, 0.05); L.forwardZ.setTargetAtTime(-m[10], t, 0.05); L.upX.setTargetAtTime(m[4], t, 0.05); L.upY.setTargetAtTime(m[5], t, 0.05); L.upZ.setTargetAtTime(m[6], t, 0.05); }
      else if (L.setPosition) { L.setPosition(p[0], p[1], p[2]); L.setOrientation(-m[8], -m[9], -m[10], m[4], m[5], m[6]); }
      this.sources.forEach(s => s._place()); }
    dispose() { if (this.ctx) { try { this.ctx.close(); } catch (e) { /* closed already */ } this.ctx = null; } }
  }
  /* a sound on an entity: 'wind' and 'rain' (shaped noise), 'hum' (a machine's drone); positional unless ambient */
  class AudioSource extends Component {
    constructor(e) { super(e); this.kind = 'hum'; this.volume = 0.5; this.ambient = false; this.range = 30; this.pitch = 1; this._nodes = null; }
    onStart() { const A = this.engine.audio; if (!A) return; A.sources.add(this); if (A.on) this._start(); }
    _start() { const A = this.engine.audio; if (this._nodes || !A || !A.ctx) return; const c = A.ctx, g = c.createGain(); g.gain.value = this.volume; let out = g; const nodes = [g];
      if (!this.ambient) { const pn = c.createPanner(); pn.panningModel = 'HRTF'; pn.distanceModel = 'inverse'; pn.refDistance = 3; pn.maxDistance = this.range * 4; pn.rolloffFactor = 1.4; g.connect(pn); out = pn; this._pan = pn; nodes.push(pn); } out.connect(A.master);
      if (this.kind === 'hum') { [58, 116, 174, 233].forEach((f, i) => { const o = c.createOscillator(), og = c.createGain(); o.type = i ? 'sine' : 'triangle'; o.frequency.value = f * this.pitch; og.gain.value = [0.5, 0.28, 0.12, 0.05][i]; o.connect(og); og.connect(g); o.start(); nodes.push(o, og); }); const n = c.createBufferSource(), f = c.createBiquadFilter(), ng = c.createGain(); n.buffer = A._noise(); n.loop = true; f.type = 'bandpass'; f.frequency.value = 420; f.Q.value = 0.6; ng.gain.value = 0.35; n.connect(f); f.connect(ng); ng.connect(g); n.start(); nodes.push(n, f, ng); }
      else { const n = c.createBufferSource(), f = c.createBiquadFilter(); n.buffer = A._noise(); n.loop = true; f.type = this.kind === 'rain' ? 'highpass' : 'lowpass'; f.frequency.value = this.kind === 'rain' ? 1800 : 380; f.Q.value = 0.4; n.connect(f); f.connect(g); n.start(); nodes.push(n, f); if (this.kind === 'wind') { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 0.13; lg.gain.value = 180; l.connect(lg); lg.connect(f.frequency); l.start(); nodes.push(l, lg); } }
      this._nodes = nodes; this._g = g; this._place(); }
    _place() { if (this._g) this._g.gain.value = this.active ? this.volume : 0; if (!this._pan) return; const m = this.transform.world, t = this.engine.audio.ctx.currentTime, p = this._pan; if (p.positionX) { p.positionX.setTargetAtTime(m[12], t, 0.05); p.positionY.setTargetAtTime(m[13], t, 0.05); p.positionZ.setTargetAtTime(m[14], t, 0.05); } else p.setPosition(m[12], m[13], m[14]); }
    onDestroy() { const A = this.engine.audio; if (A) A.sources.delete(this); if (this._nodes) { this._nodes.forEach(n => { try { if (n.stop) n.stop(); n.disconnect(); } catch (e) { /* stopped already */ } }); this._nodes = null; this._g = null; this._pan = null; } }
  }
  AudioSource.props = { kind: { type: 'enum', options: ['hum', 'wind', 'rain'] }, volume: { type: 'float', min: 0, max: 2, step: 0.01 }, ambient: { type: 'bool' }, range: { type: 'float', min: 1, max: 500, step: 1 }, pitch: { type: 'float', min: 0.25, max: 4, step: 0.01 } };
  registerComponent('AudioSource', AudioSource);
  Object.assign(SE, { Audio, AudioSource });

  /* ==== the editor: an outliner, a details panel, world settings, transform gizmos, buffer views and a profiler, laid over the view ==== */
  /* What Unreal's and Unity's editors do, at the size of a card: pick a thing, move, turn and scale it with handles, change
     any field of its components and its material, add primitives, lights, particles and physics props, play, pause and
     step the simulation, look at any buffer of the renderer, read where the frame's time goes, save the scene to a file,
     bring a glTF model in or send the scene out as one. */
  Renderer.schema = {
    Quality: { renderScale: { type: 'float', min: 0.4, max: 1, step: 0.01, label: 'Render scale' }, taa: { type: 'bool', label: 'Temporal anti-aliasing' }, sharpen: { type: 'float', min: 0, max: 1, step: 0.01 }, lodBias: { type: 'float', min: 0.25, max: 4, step: 0.05, label: 'Detail distance' }, clusterCull: { type: 'bool', label: 'Cluster culling' }, occlusionCull: { type: 'bool', label: 'Occlusion culling' } },
    Shadows: { shadows: { type: 'bool' }, shadowDistance: { type: 'float', min: 40, max: 1500, step: 10, label: 'Distance' }, shadowSoftness: { type: 'float', min: 0, max: 0.6, step: 0.005, label: 'Softness' }, shadowSize: { type: 'enum', options: [512, 1024, 1536, 2048, 4096], label: 'Map size' } },
    'Indirect light': { ao: { type: 'bool', label: 'Ambient occlusion' }, aoIntensity: { type: 'float', min: 0, max: 1, step: 0.01, label: 'Occlusion' }, aoRadius: { type: 'float', min: 0.3, max: 8, step: 0.1, label: 'Occlusion reach' }, gi: { type: 'bool', label: 'Bounced light' }, giIntensity: { type: 'float', min: 0, max: 4, step: 0.05, label: 'Bounce' }, giRadius: { type: 'float', min: 2, max: 30, step: 0.5, label: 'Bounce reach' }, ssr: { type: 'bool', label: 'Reflections' }, ssrDistance: { type: 'float', min: 10, max: 300, step: 5, label: 'Reflection reach' } },
    Picture: { autoExposure: { type: 'bool', label: 'Eye adaptation' }, exposure: { type: 'float', min: -4, max: 4, step: 0.05, label: 'Exposure (EV)' }, tonemap: { type: 'enum', options: ['aces', 'agx', 'neutral', 'reinhard'], label: 'Tone curve' }, bloom: { type: 'bool' }, bloomIntensity: { type: 'float', min: 0, max: 0.3, step: 0.005, label: 'Bloom' }, contrast: { type: 'float', min: 0.6, max: 1.6, step: 0.01 }, saturation: { type: 'float', min: 0, max: 2, step: 0.01 }, temperature: { type: 'float', min: -1, max: 1, step: 0.01 }, vignette: { type: 'float', min: 0, max: 1, step: 0.01 }, grain: { type: 'float', min: 0, max: 0.15, step: 0.005 }, chromatic: { type: 'float', min: 0, max: 3, step: 0.05, label: 'Lens fringe' }, fog: { type: 'bool', label: 'Haze' } },
    'Air and clouds': { volumetricFog: { type: 'bool', label: 'Fog with shafts and lamp glow' }, volFogDistance: { type: 'float', min: 60, max: 1500, step: 10, label: 'Fog walked (m)' }, volFogSteps: { type: 'float', min: 4, max: 32, step: 1, label: 'Fog steps' }, volFogLights: { type: 'float', min: 0, max: 6, step: 0.1, label: 'Lamp glow in fog' }, volumetricClouds: { type: 'bool', label: 'Clouds with depth' }, cloudSteps: { type: 'float', min: 8, max: 48, step: 1, label: 'Cloud steps' } },
    'Lens and light shafts': { contactShadows: { type: 'bool', label: 'Contact shadows' }, shafts: { type: 'bool', label: 'Sun shafts' }, shaftIntensity: { type: 'float', min: 0, max: 1, step: 0.01, label: 'Shaft strength' }, motionBlur: { type: 'float', min: 0, max: 1.5, step: 0.05, label: 'Motion blur' }, dof: { type: 'bool', label: 'Depth of field' }, dofFocus: { type: 'float', min: 0, max: 400, step: 0.5, label: 'Focus (m, 0 = centre)' }, dofAperture: { type: 'float', min: 0.2, max: 6, step: 0.1, label: 'Aperture' }, dofMax: { type: 'float', min: 2, max: 30, step: 1, label: 'Largest blur (px)' }, dynamicRes: { type: 'bool', label: 'Dynamic resolution (Auto)' } },
  };
  const ENV_SCHEMA = { fogDensity: { type: 'float', min: 0, max: 0.02, step: 0.0001, label: 'Haze' }, fogHeight: { type: 'float', min: 5, max: 600, step: 5, label: 'Haze height' }, turbidity: { type: 'float', min: 1, max: 12, step: 0.1, label: 'Air (turbidity)' }, clouds: { type: 'float', min: 0, max: 1, step: 0.01 }, cloudSpeed: { type: 'float', min: 0, max: 20, step: 0.1, label: 'Cloud drift' }, wind: { type: 'float', min: 0, max: 2, step: 0.01 }, wetness: { type: 'float', min: 0, max: 1, step: 0.01 }, sunIntensity: { type: 'float', min: 0, max: 3, step: 0.01, label: 'Sun' }, skyIntensity: { type: 'float', min: 0, max: 4, step: 0.01, label: 'Sky' }, stars: { type: 'float', min: 0, max: 4, step: 0.05 } };
  const ADD = [['Empty', null], ['Box', { shape: 'box', args: [1, 1, 1] }], ['Sphere', { shape: 'sphere', args: [0.5, 32] }], ['Cylinder', { shape: 'cylinder', args: [0.5, 0.5, 1, 24] }], ['Cone', { shape: 'cone', args: [0.5, 1, 24] }], ['Capsule', { shape: 'capsule', args: [0.3, 1.8, 16] }], ['Plane', { shape: 'plane', args: [10, 10, 1] }],
    ['Mirror ball', { shape: 'sphere', args: [0.75, 48], mat: { albedo: '#f2f2f2', metallic: 1, roughness: 0.04 } }], ['Glowing panel', { shape: 'box', args: [2, 1, 0.08], mat: { albedo: '#000000', emissive: '#4cc3ff', emissiveIntensity: 14 } }],
    ['Physics crate', { shape: 'box', args: [0.8, 0.8, 0.8], body: true, mat: { albedo: '#b08a55', roughness: 0.75 }, up: 3 }], ['Physics ball', { shape: 'sphere', args: [0.45, 24], body: true, mat: { albedo: '#d94a3a', roughness: 0.35 }, up: 3 }],
    ['Point light', { light: 'point' }], ['Spot light', { light: 'spot' }], ['Fire', { fx: 'fire' }], ['Smoke', { fx: 'smoke' }], ['Steam', { fx: 'steam' }], ['Sparks', { fx: 'sparks' }], ['Fountain', { fx: 'fountain' }], ['Hum (sound)', { sound: 'hum' }]];

  class Editor {
    constructor(engine, host, o) {
      o = o || {}; this.engine = engine; this.host = host; this.sel = null; this.tool = 'move'; this.open = false; this.showStats = true; this.showPhysics = false; this.drag = null; this.filter = ''; this.onClose = o.onClose || null; this.onLog = o.onLog || null; this._off = []; this._ft = [];
      const el = this.el = document.createElement('div'); el.className = 'se-ed'; el.hidden = true; host.appendChild(el);
      el.innerHTML = `<div class="se-bar" role="toolbar" aria-label="Editor">
          <button type="button" data-a="play" title="Play or pause the simulation: physics, particles, scripts, wind"></button><button type="button" data-a="step" title="Advance one step while paused">Step</button><span class="se-sep"></span>
          <span class="se-seg" role="group" aria-label="Tool">${[['select', 'Select', '1'], ['move', 'Move', '2'], ['rotate', 'Rotate', '3'], ['scale', 'Scale', '4']].map(([k, l, key]) => `<button type="button" data-tool="${k}" title="${l} (${key})">${l}</button>`).join('')}</span><span class="se-sep"></span>
          <label class="se-in">Add <select data-a="add"><option value="">…</option>${ADD.map(([n], i) => `<option value="${i}">${n}</option>`).join('')}</select></label>
          <label class="se-in">View <select data-a="view">${engine.renderer.viewModes.map(v => `<option value="${v}">${{ lit: 'Lit', albedo: 'Base colour', normals: 'Normals', roughness: 'Roughness', metallic: 'Metalness', ao: 'Ambient occlusion', gi: 'Indirect light', reflections: 'Reflections', depth: 'Depth', cascades: 'Shadow cascades', lighting: 'Lighting only', lights: 'Light clusters', emissive: 'Emissive' }[v] || v}</option>`).join('')}</select></label><span class="se-sep"></span>
          <button type="button" data-a="stats" title="Frame time, draw calls, triangles, where the time goes">Stats</button><button type="button" data-a="phys" title="Draw the physics shapes">Shapes</button><span class="se-sep"></span>
          <button type="button" data-a="save" title="Save what you built as a scene file (.json)">Save</button><button type="button" data-a="load" title="Load a scene file">Load</button><button type="button" data-a="import" title="Bring in a glTF model (.glb)">Import</button><button type="button" data-a="export" title="Send what you built out as a glTF model (.glb)">Export</button>
          <input type="file" data-f="load" accept=".json,application/json" hidden><input type="file" data-f="import" accept=".glb,.gltf,model/gltf-binary" hidden>
        </div>
        <div class="se-panel se-left"><div class="se-h">Outliner</div><input type="search" class="se-filter" placeholder="Filter" aria-label="Filter the outliner"><div class="se-tree" role="tree"></div></div>
        <div class="se-panel se-right"><div class="se-h"><span class="se-rt">World settings</span><span class="se-acts"></span></div><div class="se-body"></div></div>
        <div class="se-stats" hidden><canvas width="180" height="40"></canvas><div class="se-st"></div></div>
        <form class="se-console" autocomplete="off"><input type="text" spellcheck="false" placeholder="Script: engine, scene, selected, SE are in scope (try  selected.transform.translate(0, 2, 0) )" aria-label="Run a line of script"><output></output></form>`;
      const q = s => el.querySelector(s); this.$tree = q('.se-tree'); this.$body = q('.se-body'); this.$rt = q('.se-rt'); this.$acts = q('.se-acts'); this.$stats = q('.se-stats'); this.$st = q('.se-st'); this.$graph = q('.se-stats canvas'); this.$play = q('[data-a="play"]'); this.$view = q('[data-a="view"]');
      el.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.tool) { this.setTool(b.dataset.tool); return; } const a = b.dataset.a;
        if (a === 'play') { engine.playing = !engine.playing; engine.wake(); this._bar(); } else if (a === 'step') { engine.playing = false; engine.step(); this._bar(); } else if (a === 'stats') { this.showStats = !this.showStats; this._bar(); } else if (a === 'phys') { this.showPhysics = !this.showPhysics; this._bar(); engine.requestRender(); }
        else if (a === 'save') this.save(); else if (a === 'load') q('[data-f="load"]').click(); else if (a === 'import') q('[data-f="import"]').click(); else if (a === 'export') this.exportGLB(); });
      q('[data-a="add"]').addEventListener('change', e => { const i = e.target.value; e.target.value = ''; if (i !== '') this.add(ADD[+i]); });
      this.$view.addEventListener('change', e => { engine.renderer.settings.viewMode = e.target.value; engine.requestRender(3); });
      q('[data-f="load"]').addEventListener('change', async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; try { const made = engine.scene.load(JSON.parse(await f.text()), { keep: true, keepEnv: true }); this.select(made[0] || null); this.log('Loaded ' + made.length + ' object' + (made.length === 1 ? '' : 's') + ' from ' + f.name); } catch (err) { this.log('That scene did not load: ' + (err && err.message || err)); } this.tree(); });
      q('[data-f="import"]').addEventListener('change', async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; try { const p = this._spot(0), r = await GLTF.load(engine, f, { name: f.name.replace(/\.[^.]+$/, '') }); r.transform.setPosition(p[0], p[1], p[2]); this.tree(); this.select(r); this.log('Imported ' + f.name); } catch (err) { this.log('That model did not import: ' + (err && err.message || err)); } });
      q('.se-filter').addEventListener('input', e => { this.filter = e.target.value.trim().toLowerCase(); this.tree(); });
      this.$tree.addEventListener('click', e => { const tw = e.target.closest('[data-tw]'); if (tw) { const en = engine.scene.entities.get(+tw.dataset.tw); if (en) { en._open = !en._open; this.tree(); } return; } const r = e.target.closest('[data-id]'); if (r) this.select(engine.scene.entities.get(+r.dataset.id) || null); });
      this.$tree.addEventListener('dblclick', e => { const r = e.target.closest('[data-id]'); if (r) this.focus(); });
      q('.se-console').addEventListener('submit', e => { e.preventDefault(); const inp = e.target.querySelector('input'), out = e.target.querySelector('output'), src = inp.value.trim(); if (!src) return;
        try { const fn = new Function('engine', 'scene', 'selected', 'SE', 'return (' + src + ')'); let v = fn(engine, engine.scene, this.sel, SE); out.textContent = v === undefined ? 'done' : typeof v === 'object' ? (v && v.constructor ? v.constructor.name : 'object') + ' ' + (() => { try { return JSON.stringify(v, (k, x) => (ArrayBuffer.isView(x) ? Array.from(x).map(n => +n.toFixed(3)) : k && x && typeof x === 'object' && !Array.isArray(x) ? undefined : x)).slice(0, 160); } catch (e2) { return ''; } })() : String(v).slice(0, 200); inp.select(); engine.requestRender(3); this.details(); this.tree(); }
        catch (err) { out.textContent = String(err && err.message || err).slice(0, 200); } });
      el.addEventListener('keydown', e => e.stopPropagation()); el.addEventListener('wheel', e => e.stopPropagation(), { passive: true });
      const on = (em, n, f) => this._off.push(em.on(n, f)), I = engine.input;
      on(engine.scene, 'hierarchy', () => { if (this.open) this.treeSoon(); });
      on(engine, 'update', () => { if (this.open) this._gizmo(); });
      on(engine, 'frame', dt => { if (this.open) this._stats(dt); });
      on(I, 'down', (p, e) => { if (!this.open) return; I.captured = false; if (e.button !== 0) return; const h = this._handle(p); if (h) { I.captured = true; this._begin(h, p); return; } if (this.tool !== 'select' && !e.shiftKey) { const pk = this._pick(p); if (pk) I.captured = true; } });
      on(I, 'move', p => { if (this.open && this.drag) { this._dragTo(p); engine.requestRender(); } });
      on(I, 'up', () => { if (this.drag) { this.drag = null; this.details(); } });
      on(I, 'click', (p, e) => { if (!this.open || e.button !== 0) return; const pk = this._pick(p); if (pk) { this.select(pk); I.captured = true; setTimeout(() => { I.captured = false; }, 0); } else if (this.sel && !this.sel.transient && this.tool === 'select') this.select(null); });
      on(I, 'key', (code, e) => { if (!this.open) return; const t = { Digit1: 'select', Digit2: 'move', Digit3: 'rotate', Digit4: 'scale' }[code]; if (t) this.setTool(t); else if ((code === 'Delete' || code === 'Backspace') && this.sel && !this.sel.transient) this.remove(); else if (code === 'KeyF' && this.sel) this.focus(); else if (code === 'KeyD' && (e.ctrlKey || e.metaKey) && this.sel) { e.preventDefault(); this.duplicate(); } });
    }
    log(t) { if (this.onLog) this.onLog(t); const o = this.el.querySelector('.se-console output'); if (o) o.textContent = t; }
    setOpen(on) { this.open = !!on; this.el.hidden = !this.open; this.engine.device.profileGPU = this.open && this.showStats; if (this.open) { this.tree(); this.details(); this._bar(); } else { this.engine.input.captured = false; this.engine.renderer.setOutline('select', null); this.drag = null; } this.engine.requestRender(3); }
    setTool(t) { this.tool = t; this._bar(); this.engine.requestRender(); }
    _bar() { const e = this.engine; this.$play.textContent = e.playing ? 'Pause' : 'Play'; this.$play.setAttribute('aria-pressed', String(e.playing)); this.el.querySelectorAll('[data-tool]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tool === this.tool)));
      this.el.querySelector('[data-a="stats"]').setAttribute('aria-pressed', String(this.showStats)); this.el.querySelector('[data-a="phys"]').setAttribute('aria-pressed', String(this.showPhysics)); this.$stats.hidden = !this.showStats; this.$view.value = e.renderer.settings.viewMode; e.device.profileGPU = this.open && this.showStats; }
    /* where a new thing goes: on what the middle of the view looks at, up by its own lift */
    _spot(up) { const e = this.engine, r = e.camera.ray(0.5, 0.56), h = e.physics ? e.physics.raycast(r.origin, r.dir, 60) : null, d = h ? Math.min(h.t, 14) : 8; return [r.origin[0] + r.dir[0] * d, Math.max(h && h.t < 14 ? h.point[1] : 0, r.origin[1] + r.dir[1] * d) + (up || 0), r.origin[2] + r.dir[2] * d]; }
    add([name, d]) {
      const sc = this.engine.scene; d = d || {}; const args = d.args || [], lift = d.shape === 'plane' ? 0.02 : d.shape === 'sphere' ? args[0] : d.shape === 'capsule' ? args[1] / 2 : d.shape === 'cone' ? args[1] / 2 : d.shape === 'cylinder' ? args[2] / 2 : d.shape ? args[1] / 2 : d.light ? 3 : d.fx ? 0.2 : 1;
      const e = sc.createEntity(name, { position: this._spot(lift + (d.up || 0)) });
      if (d.shape) { const r = e.add('MeshRenderer'); r.setShape({ kind: d.shape, args }); r.material = new Material(Object.assign({ name: name + ' material', albedo: '#c9ccd1', roughness: 0.6 }, d.mat || {})); }
      if (d.body) { e.add('RigidBody'); this.engine.playing = true; }
      if (d.light) { e.add('Light', { type: d.light, intensity: d.light === 'spot' ? 260 : 90, range: 22 }); if (d.light === 'spot') e.transform.setEuler(-90, 0, 0); }
      if (d.fx) e.add('ParticleSystem').setPreset(d.fx);
      if (d.sound) { e.add('AudioSource', { kind: d.sound }); if (this.engine.audio) this.engine.audio.enable(); }
      this.tree(); this.select(e); this._bar(); this.engine.wake(); return e;
    }
    remove() { const e = this.sel; if (!e || e.transient) return; this.select(null); e.destroy(); this.tree(); }
    duplicate() { const e = this.sel; if (!e || e.transient) return; const sc = this.engine.scene, json = { entities: [sc.toJSON.call({ roots: [e], env: sc.env }).entities[0]] }; const made = sc.load(json, { keep: true, keepEnv: true }); if (made[0]) { made[0].name = e.name + ' copy'; made[0].transform.translate(1, 0, 1); if (e.parent) made[0].setParent(e.parent); this.tree(); this.select(made[0]); } }
    focus() { const e = this.sel; if (!e) return; const p = e.transform.worldPosition([0, 0, 0]); this.engine.emit('focus', p, e); }
    select(e) {
      this.sel = e && !e.destroyed ? e : null; const rs = []; if (this.sel) this.sel.traverse(x => { for (const c of x.components) if (c.isRenderable && c.mesh && !c.isInstanced) rs.push(c); });
      this.engine.renderer.setOutline('select', rs.length && rs.length < 60 ? rs : null); if (this.sel) { let p = this.sel.parent; while (p) { p._open = true; p = p.parent; } } this.tree(); this.details(); this.engine.requestRender(2);
    }
    treeSoon() { clearTimeout(this._tt); this._tt = setTimeout(() => this.tree(), 120); }
    tree() {
      if (!this.open) return; const f = this.filter, rows = [], esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
      const icon = e => (e.get('Camera') ? '◉' : e.get('Light') ? '✦' : e.get('ParticleSystem') ? '⁂' : e.get('RigidBody') ? '◆' : e.components.some(c => c.isRenderable) ? '▣' : '▸');
      const walk = (e, depth) => { const kids = e.children, match = !f || e.name.toLowerCase().includes(f); if (match || f) { if (match) rows.push(`<div class="se-row${e === this.sel ? ' sel' : ''}${e.transient ? ' tr' : ''}${e.activeInHierarchy ? '' : ' off'}" role="treeitem" data-id="${e.id}" style="padding-left:${6 + depth * 12}px">${kids.length ? `<span class="se-tw" data-tw="${e.id}">${e._open || f ? '▾' : '▸'}</span>` : '<span class="se-tw"></span>'}<span class="se-ic">${icon(e)}</span>${esc(e.name)}${kids.length && !e._open ? ` <i>${kids.length}</i>` : ''}</div>`); }
        if ((e._open || f) && rows.length < 400) kids.forEach(k => walk(k, depth + 1)); };
      const roots = this.engine.scene.roots; roots.filter(e => !e.transient).forEach(e => walk(e, 0)); roots.filter(e => e.transient).forEach(e => walk(e, 0));
      this.$tree.innerHTML = rows.join('') || '<div class="se-empty">Nothing matches.</div>';
    }
    /* one field of obj, by its description: returns the row's HTML and remembers how to write it back */
    _field(obj, key, d, onChange) {
      const id = 'f' + (this._fid++), v = obj[key], lab = d.label || key.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()), set = val => { if (d.set) d.set(obj, val); else if (ArrayBuffer.isView(obj[key]) && Array.isArray(val)) obj[key].set(val); else obj[key] = val; if (onChange) onChange(key, val); this.engine.requestRender(3); };
      this._fields.set(id, { d, set, obj, key }); const num = (x, i) => `<input type="number" data-f="${id}"${i != null ? ` data-i="${i}"` : ''} value="${+(+x).toFixed(4)}" step="${d.step || 0.1}"${d.min != null ? ` min="${d.min}"` : ''}${d.max != null ? ` max="${d.max}"` : ''}>`;
      let c; if (d.type === 'bool') c = `<input type="checkbox" data-f="${id}"${v ? ' checked' : ''}>`;
      else if (d.type === 'enum') c = `<select data-f="${id}">${d.options.map(o => `<option${String(o) === String(v) ? ' selected' : ''}>${o}</option>`).join('')}</select>`;
      else if (d.type === 'vec3') c = `<span class="se-v3">${[0, 1, 2].map(i => num(v[i], i)).join('')}</span>`;
      else if (d.type === 'color' || d.type === 'color4') c = `<input type="color" data-f="${id}" value="${toHex(v)}">${d.type === 'color4' ? num(v[3], 3) : ''}`;
      else if (d.type === 'string') c = `<input type="text" data-f="${id}" value="${String(v == null ? '' : v).replace(/"/g, '&quot;')}">`;
      else c = (d.min != null && d.max != null ? `<input type="range" data-f="${id}" data-r="1" min="${d.min}" max="${d.max}" step="${d.step || 0.01}" value="${v}">` : '') + num(v);
      return `<label class="se-f"><span>${lab}</span>${c}</label>`;
    }
    _wire(root) {
      root.querySelectorAll('[data-f]').forEach(inp => { const F = this._fields.get(inp.dataset.f); if (!F) return; const d = F.d;
        inp.addEventListener(inp.type === 'checkbox' || inp.tagName === 'SELECT' ? 'change' : 'input', () => {
          if (d.type === 'bool') F.set(inp.checked); else if (d.type === 'enum') F.set(typeof d.options[0] === 'number' ? +inp.value : inp.value); else if (d.type === 'string') F.set(inp.value);
          else if (d.type === 'vec3') { const cur = Array.from(F.obj[F.key]); cur[+inp.dataset.i] = +inp.value || 0; F.set(cur); }
          else if (d.type === 'color' || d.type === 'color4') { const cur = Array.from(F.obj[F.key]); if (inp.type === 'color') { const c = color(inp.value); cur[0] = c[0]; cur[1] = c[1]; cur[2] = c[2]; if (Math.max(F.obj[F.key][0], F.obj[F.key][1], F.obj[F.key][2]) > 1.001) { const k = Math.max(F.obj[F.key][0], F.obj[F.key][1], F.obj[F.key][2]); cur[0] *= k; cur[1] *= k; cur[2] *= k; } } else cur[3] = +inp.value; F.set(cur); }
          else { let x = +inp.value; if (!isFinite(x)) return; if (d.type === 'int') x = Math.round(x); F.set(x); const sib = inp.parentNode.querySelectorAll(`[data-f="${inp.dataset.f}"]`); sib.forEach(s => { if (s !== inp) s.value = x; }); } }); });
    }
    details() {
      if (!this.open || this.drag) return; const e = this.sel, eng = this.engine, R = eng.renderer; this._fields = new Map(); this._fid = 0; let h = '';
      if (!e) {
        this.$rt.textContent = 'World settings'; this.$acts.innerHTML = '';
        h += `<details open><summary>Engine</summary><label class="se-f"><span>Quality</span><select data-q="1">${['auto', 'ultra', 'high', 'medium', 'low'].map(q => `<option value="${q}"${(eng.autoQuality ? 'auto' : eng.quality) === q ? ' selected' : ''}>${q === 'auto' ? 'Auto (' + QUALITY[eng.quality].label + ')' : QUALITY[q].label}</option>`).join('')}</select></label>
          <p class="se-note">${SE.name} ${SE.version} on WebGL2 · ${String(eng.device.caps.gpu).replace(/ANGLE \(|\)$/g, '').slice(0, 70)}</p></details>`;
        h += '<details open><summary>Sky, air and weather</summary>' + Object.keys(ENV_SCHEMA).map(k => this._field(eng.scene.env, k, ENV_SCHEMA[k], () => eng.scene.envChanged())).join('') + '</details>';
        Object.keys(Renderer.schema).forEach((g, i) => { h += `<details${i < 1 ? ' open' : ''}><summary>${g}</summary>` + Object.keys(Renderer.schema[g]).map(k => this._field(R.settings, k, Renderer.schema[g][k], key => { if (key === 'renderScale') eng.resize(); R.reset = key === 'renderScale' || key === 'taa'; })).join('') + '</details>'; });
        this.$body.innerHTML = h; this._wire(this.$body); const qs = this.$body.querySelector('[data-q]'); if (qs) qs.addEventListener('change', () => { eng.setQuality(qs.value); eng.emit('editorQuality', qs.value); this.details(); }); return;
      }
      const T = e.transform, tr = { position: T.position, rotation: T.getEuler(), scale: T.scale };
      this.$rt.textContent = e.transient ? 'Part of the neighborhood' : 'Details';
      this.$acts.innerHTML = e.transient ? '' : '<button type="button" data-x="dup" title="Duplicate (Ctrl D)">Copy</button><button type="button" data-x="del" title="Delete">Delete</button>';
      h += `<div class="se-ent">${this._field(e, 'name', { type: 'string', label: 'Name' }, () => this.treeSoon())}${this._field(e, 'active', { type: 'bool', label: 'Active' }, () => { eng.scene.touched = true; this.treeSoon(); })}</div>`;
      h += '<details open><summary>Transform</summary>' + this._field(tr, 'position', { type: 'vec3', step: 0.1, label: 'Position', set: (o2, v) => T.setPosition(v) }) + this._field(tr, 'rotation', { type: 'vec3', step: 1, label: 'Rotation', set: (o2, v) => { tr.rotation = v; T.setEuler(v[0], v[1], v[2]); } }) + this._field(tr, 'scale', { type: 'vec3', step: 0.05, label: 'Scale', set: (o2, v) => T.setScale(v) }) + '</details>';
      e.components.forEach((c, ci) => { const P = c.constructor.props || {}, name = c.constructor.typeName || 'Component';
        h += `<details open><summary>${name}${e.transient ? '' : `<button type="button" class="se-x" data-rm="${ci}" title="Remove this component">×</button>`}</summary>${this._field(c, 'enabled', { type: 'bool', label: 'Enabled' }, () => { eng.scene.touched = true; })}` + Object.keys(P).map(k => this._field(c, k, P[k])).join('');
        if (c.isRenderable && c.mesh) h += `<p class="se-note">${c.mesh.name}: ${Math.round(c.mesh.tris).toLocaleString()} triangles${c.mesh.lods ? ', ' + c.mesh.lods.length + ' levels of detail' : ''}${c.mesh.clusters ? ', ' + c.mesh.clusters.length + ' clusters' : ''}${c.instances ? ', ' + c.instances.count + ' instances' : ''}</p>`;
        if (c.body) h += `<p class="se-note">${c.body.shape.kind}, ${c.body.mass.toFixed(1)} kg, ${c.body.asleep ? 'asleep' : 'awake'}</p>`;
        h += '</details>';
        if (c.isRenderable && c.material) h += `<details${e.transient ? '' : ' open'}><summary>Material: ${c.material.name}</summary>` + Object.keys(Material.props).map(k => this._field(c.material, k, Material.props[k], () => { c.material.version++; })).join('') + '</details>'; });
      if (!e.transient) h += `<label class="se-f"><span>Add component</span><select data-addc="1"><option value="">…</option>${['Light', 'RigidBody', 'ParticleSystem', 'Rotator', 'Bobber', 'Orbiter', 'Lifetime', 'AudioSource'].map(n => `<option>${n}</option>`).join('')}</select></label>`;
      this.$body.innerHTML = h; this._wire(this.$body);
      this.$body.querySelectorAll('[data-rm]').forEach(b => b.addEventListener('click', ev => { ev.preventDefault(); const c = e.components[+b.dataset.rm]; if (c) e.remove(c); this.details(); this.tree(); }));
      const ac = this.$body.querySelector('[data-addc]'); if (ac) ac.addEventListener('change', () => { if (ac.value) { try { e.add(ac.value); if (ac.value === 'RigidBody') eng.playing = true; } catch (err) { this.log(String(err.message || err)); } this.details(); this.tree(); this._bar(); } });
      this.$acts.querySelectorAll('[data-x]').forEach(b => { b.onclick = () => (b.dataset.x === 'del' ? this.remove() : this.duplicate()); });
    }
    /* ---------- picking and the handles ---------- */
    _pick(p) { const h = this.engine.pick(p.x, p.y, { physics: false, filter: e => { let x = e; while (x) { if (x.transient) return false; x = x.parent; } return true; } }); if (!h) return null; let e = h.entity; while (e.parent && !e.parent.transient && e.parent.parent === null && e.parent.components.length === 0 && false) e = e.parent; return e; }
    _size(p) { const c = this.engine.camera; return Math.max(0.05, V3.dist(p, c.position) * Math.tan(c.fov * RAD / 2) * 0.22); }
    _handle(p) {
      const e = this.sel; if (!e || this.tool === 'select') return null; const cam = this.engine.camera, c = e.transform.worldPosition([0, 0, 0]), L = this._size(c), W = this.engine.canvas.clientWidth, H = this.engine.canvas.clientHeight, mx = p.x * W, my = p.y * H; let best = null;
      if (this.tool === 'rotate') { const ray = cam.ray(p.x, p.y); for (let k = 0; k < 3; k++) { const n = [k === 0 ? 1 : 0, k === 1 ? 1 : 0, k === 2 ? 1 : 0], den = V3.dot(ray.dir, n); if (Math.abs(den) < 1e-4) continue; const t = V3.dot(V3.sub([0, 0, 0], c, ray.origin), n) / den; if (t <= 0) continue; const q = V3.addScaled([0, 0, 0], ray.origin, ray.dir, t), err = Math.abs(V3.dist(q, c) - L) / L; if (err < 0.14 && (!best || err < best.err)) best = { axis: k, err, at: q }; } return best; }
      for (let k = 0; k < 3; k++) { const a = cam.project(c), tip = [c[0] + (k === 0 ? L : 0), c[1] + (k === 1 ? L : 0), c[2] + (k === 2 ? L : 0)], b = cam.project(tip); if (!a || !b) continue; const ax = a[0] * W, ay = a[1] * H, bx = b[0] * W, by = b[1] * H, dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1, t = clamp(((mx - ax) * dx + (my - ay) * dy) / l2, 0, 1), d = Math.hypot(mx - ax - dx * t, my - ay - dy * t); if (d < 11 && t > 0.12 && (!best || d < best.d)) best = { axis: k, d }; }
      if (!best && this.tool === 'scale') { const a = cam.project(c); if (a && Math.hypot(mx - a[0] * W, my - a[1] * H) < 12) best = { axis: 3, d: 0 }; }
      return best;
    }
    /* the pointer's place along an axis through c: the point of the axis nearest the pointer's ray */
    _along(p, c, n) { const r = this.engine.camera.ray(p.x, p.y), w = V3.sub([0, 0, 0], c, r.origin), b = V3.dot(n, r.dir), d = V3.dot(n, w), e2 = V3.dot(r.dir, w), den = 1 - b * b; return den < 1e-5 ? 0 : (b * e2 - d) / den; }
    _begin(h, p) { const e = this.sel, T = e.transform, c = T.worldPosition([0, 0, 0]), n = [h.axis === 0 ? 1 : 0, h.axis === 1 ? 1 : 0, h.axis === 2 ? 1 : 0]; this.drag = { h, c, n, pos: Array.from(T.position), rot: Array.from(T.rotation), scl: Array.from(T.scale), t0: h.axis < 3 ? this._along(p, c, n) : 0, L: this._size(c), y0: p.y, at: h.at || null }; }
    _dragTo(p) {
      const D = this.drag, e = this.sel; if (!D || !e) return; const T = e.transform, snap = this.engine.input.key('ControlLeft') || this.engine.input.key('ControlRight'), k = D.h.axis;
      if (this.tool === 'move') { let d = this._along(p, D.c, D.n) - D.t0; if (snap) d = Math.round(d * 2) / 2; const loc = e.parent ? V3.transformDir([0, 0, 0], D.n, M4.invert(M4.create(), e.parent.transform.world)) : D.n; T.setPosition(D.pos[0] + loc[0] * d, D.pos[1] + loc[1] * d, D.pos[2] + loc[2] * d); }
      else if (this.tool === 'scale') { if (k === 3) { const f = Math.max(0.02, 1 + (D.y0 - p.y) * 3); T.setScale(D.scl[0] * f, D.scl[1] * f, D.scl[2] * f); } else { let f = Math.max(0.02, 1 + (this._along(p, D.c, D.n) - D.t0) / D.L); if (snap) f = Math.round(f * 4) / 4 || 0.25; const s = D.scl.slice(); s[k] *= f; T.setScale(s); } }
      else { const ray = this.engine.camera.ray(p.x, p.y), den = V3.dot(ray.dir, D.n); if (Math.abs(den) < 1e-4) return; const t = V3.dot(V3.sub([0, 0, 0], D.c, ray.origin), D.n) / den, q = V3.addScaled([0, 0, 0], ray.origin, ray.dir, t), a = V3.sub([0, 0, 0], D.at, D.c), b = V3.sub([0, 0, 0], q, D.c); let ang = Math.atan2(V3.dot(V3.cross([0, 0, 0], a, b), D.n), V3.dot(a, b)); if (snap) ang = Math.round(ang / (Math.PI / 12)) * (Math.PI / 12);
        const dq = Q.fromAxisAngle([0, 0, 0, 1], D.n, ang); T.setRotation(Q.normalize([0, 0, 0, 1], Q.mul([0, 0, 0, 1], dq, D.rot))); }
    }
    _gizmo() {
      const eng = this.engine, L = eng.renderer.lines, e = this.sel;
      if (this.showPhysics && eng.physics) eng.physics.debugDraw(L, eng.camera.position, 90);
      for (const l of eng.scene.lights) { if (!l.entity.activeInHierarchy || l.entity.transient) continue; const p = l.transform.worldPosition([0, 0, 0]), col = [l.color[0], l.color[1], l.color[2], 2]; L.sphere(p, 0.18, col, 1.5); if (l.entity === e) { L.sphere(p, l.range, [1, 0.9, 0.4, 0.35], 1); if (l.type === 'spot') { const f = l.transform.forward([0, 0, 0]); L.line(p, V3.addScaled([0, 0, 0], p, f, Math.min(l.range, 6)), col, 1.5); } } }
      if (!e || e.destroyed) return; if (this.tool === 'select') return; const c = e.transform.worldPosition([0, 0, 0]), s = this._size(c), cols = [[1, 0.25, 0.25, 2], [0.35, 0.95, 0.35, 2], [0.3, 0.55, 1, 2]], hot = this.drag ? this.drag.h.axis : -1;
      for (let k = 0; k < 3; k++) { const n = [k === 0 ? 1 : 0, k === 1 ? 1 : 0, k === 2 ? 1 : 0], col = hot === k ? [1, 0.9, 0.2, 2] : cols[k], w = hot === k ? 4 : 2.6, tip = V3.addScaled([0, 0, 0], c, n, s);
        if (this.tool === 'rotate') { L.circle(c, n, s, col, w, 48); continue; } L.line(c, tip, col, w);
        const u = [k === 1 ? 1 : 0, k === 1 ? 0 : 1, 0], v = V3.cross([0, 0, 0], n, u), b = V3.addScaled([0, 0, 0], c, n, s * 0.82), q = s * 0.07;
        if (this.tool === 'move') [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([a2, b2]) => L.line(tip, [b[0] + (u[0] * a2 + v[0] * b2) * q, b[1] + (u[1] * a2 + v[1] * b2) * q, b[2] + (u[2] * a2 + v[2] * b2) * q], col, w));
        else [[1, 1, -1, 1], [-1, 1, -1, -1], [-1, -1, 1, -1], [1, -1, 1, 1]].forEach(([a2, b2, c2, d2]) => L.line([tip[0] + (u[0] * a2 + v[0] * b2) * q, tip[1] + (u[1] * a2 + v[1] * b2) * q, tip[2] + (u[2] * a2 + v[2] * b2) * q], [tip[0] + (u[0] * c2 + v[0] * d2) * q, tip[1] + (u[1] * c2 + v[1] * d2) * q, tip[2] + (u[2] * c2 + v[2] * d2) * q], col, w)); }
      eng.requestRender();
    }
    _stats(dt) {
      if (!this.showStats) return; const ft = this._ft; ft.push(dt * 1000); if (ft.length > 90) ft.shift(); const now = performance.now(); if (now - (this._st || 0) < 250) return; this._st = now;
      const eng = this.engine, R = eng.renderer, s = R.stats, d = eng.device, g = this.$graph.getContext('2d'), W = 180, H = 40; g.clearRect(0, 0, W, H); g.fillStyle = 'rgba(127,127,127,.18)'; g.fillRect(0, H - 16.7 / 50 * H, W, 1); g.fillRect(0, H - 33.3 / 50 * H, W, 1);
      ft.forEach((m, i) => { const h = Math.min(H, m / 50 * H); g.fillStyle = m > 34 ? '#f04438' : m > 18 ? '#ff9f1a' : '#1fbf4c'; g.fillRect(i * 2, H - h, 2, h); });
      const avg = ft.reduce((a, b) => a + b, 0) / ft.length, gpu = d.gpuMs(), tm = Object.keys(gpu).length ? gpu : d.passMs, rows = Object.entries(tm).filter(([, v]) => v > 0.02).sort((a, b) => b[1] - a[1]).slice(0, 7), N = n => Math.round(n).toLocaleString();
      this.$st.innerHTML = `<b>${(1000 / avg).toFixed(0)} frames a second</b> · ${avg.toFixed(1)} ms · ${R.w}×${R.h}${R.W !== R.w ? ' → ' + R.W + '×' + R.H : ''} · ${QUALITY[eng.quality].label}<br>${N(s.draws)} draws · ${N(s.tris)} triangles · ${N(s.instances)} instances<br>${N(s.visible)} drawn, ${N(s.culled)} out of view, ${N(s.occluded)} hidden · clusters ${N(s.clusters)} of ${N(s.clusters + s.clustersCulled)}<br>${N(s.lights)} lights · ${eng.physics ? eng.physics.bodies.length + ' bodies (' + eng.physics.awake + ' awake) · ' : ''}${d.stats.textures} textures · ${d.stats.programs} shaders<br><span class="se-pass">${rows.map(([k2, v]) => `${k2} ${v.toFixed(2)}`).join(' · ')} ms${Object.keys(gpu).length ? ' on the card' : ''}</span>`;
    }
    save() { const blob = new Blob([JSON.stringify(this.engine.scene.toJSON(), null, 1)], { type: 'application/json' }); this._download(blob, 'scout-engine-scene.json'); }
    exportGLB() { try { this._download(GLTF.export(this.engine), 'scout-engine-scene.glb'); } catch (e) { this.log(String(e.message || e)); } }
    _download(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
    dispose() { this._off.forEach(f => f()); this.el.remove(); }
  }
  SE.Editor = Editor;

  /* ==== rooftop scout on the engine: what the neighborhood is made of ==== */
  /* The geometry and materials of the engine's view of Rooftop Scout: buildings raised from their footprints (houses with
     hipped roofs over eaves, the rest flat behind parapets), their windows, the glow each one carries, streets and alleys,
     and trees where the photograph shows canopy. The same public data as the three.js view, read through the same env. */
  SE.shaders.forward.glow = { vs: `
layout(location=0) in vec3 a_position; layout(location=1) in vec3 a_normal; layout(location=2) in vec2 a_uv; layout(location=3) in vec4 a_color; layout(location=4) in vec4 a_aux;
uniform mat4 u_model, u_viewProj, u_viewProjNJ, u_prevViewProjNJ; uniform float u_pxm;
out vec3 v_wpos; out vec3 v_normal; out vec2 v_uv; out vec4 v_color; out vec4 v_aux; out vec4 v_cur; out vec4 v_prev;
void main() {
  vec4 wp = u_model * vec4(a_position, 1.0); float keep = 1.0;
  /* A line along a roof's edge is a ribbon 18 cm wide. From far off that is a fraction of a pixel, and a line thinner than
     a pixel is hit by some frames' samples and missed by others: it sparkles. So the ribbon is never drawn narrower than
     a pixel and a half, and where it has been widened it is dimmed by as much: the same light, spread over whole pixels. */
  if (a_aux.y > 1.5 && u_pxm > 0.0) {
    vec3 across = mat3(u_model) * (a_aux.x > 0.5 ? vec3(0.0, 1.0, 0.0) : vec3(a_aux.z, 0.0, a_aux.w));
    float half0 = 0.09, half1 = clamp(0.75 * (u_viewProj * wp).w / u_pxm, half0, 6.0);
    wp.xyz += across * (a_uv.y * (half1 - half0)); keep = half0 / half1;
  }
  v_wpos = wp.xyz; v_normal = normalize(mat3(u_model) * a_normal); v_uv = a_uv; v_color = a_color; v_aux = vec4(a_aux.xy, keep, 0.0);
  v_cur = u_viewProjNJ * wp; v_prev = u_prevViewProjNJ * wp;
  gl_Position = u_viewProj * wp;
}`, fs: `
#include <common>
in vec3 v_wpos; in vec3 v_normal; in vec2 v_uv; in vec4 v_color; in vec4 v_aux; in vec4 v_cur; in vec4 v_prev;
uniform vec3 u_camPos; uniform sampler2D u_adapt; uniform vec4 u_expo, u_glow; out vec4 o_color;
void main() {
  vec3 col = pow(v_color.rgb, vec3(2.2)), V = normalize(u_camPos - v_wpos); float d = distance(u_camPos, v_wpos), a;
  if (v_aux.y < 0.5) { float f = 1.0 - abs(dot(normalize(v_normal), V)); a = u_glow.x * mix(1.0, 0.3, v_aux.x) + u_glow.y * pow(f, 2.4) * mix(1.0, 0.5, v_aux.x) * (1.0 - 0.6 * abs(V.y)); }
  else if (v_aux.y < 1.5) a = v_color.a * 0.55;
  else a = 2.4 * smoothstep(0.0, 0.25, 1.0 - abs(v_uv.y)) * v_aux.z;
  a *= 1.0 - smoothstep(u_glow.z * 0.55, u_glow.z, d);
  /* the glow keeps its brightness on screen whatever the exposure: it is a mark on the picture, not a lamp in the scene */
  float adapted = clamp(texture(u_adapt, vec2(0.5)).r, u_expo.x, u_expo.y), ex = u_expo.w > 0.5 ? u_expo.z / adapted : u_expo.z / 0.135;
  o_color = vec4(col * (a * u_glow.w / max(ex, 1e-4)), 1.0);
}` };


  /* ---------- the city's shaders: walls whose windows the shader draws, and ground that keeps its detail up close ---------- */
  /* A wall says how it is glazed: its colour's alpha holds a style and a seed, aux holds the place along the wall, the wall's
     length and the building's height. The shader fits a grid of bays and floors to each wall, sets the glass back in its
     opening (the reveal moves with the eye), and behind each pane finds a room: where the view ray meets the back wall, the
     floor, the ceiling or a side of a box, lit or dark by its own number, with blinds drawn in some. Styles: 1 a masonry
     grid, 2 a curtain wall, 3 a shop front, 4 apartments. */
  CHUNKS.facade = `
void facade(inout Surface s, inout vec4 base, inout vec3 N, vec3 Ng) {
  float fpx = max(fwidth(v_aux.x), fwidth(v_wpos.y));   /* metres of wall to a pixel: asked before anything returns early, where every pixel of a 2 by 2 block still runs (inside a branch only some of them take, a gradient is undefined and differs from one driver to the next) */
  float code = floor(v_color.a * 255.0 + 0.5), style = floor(code / 32.0), seed = mod(code, 32.0), y = v_wpos.y, sA = v_aux.x, L = v_aux.y, H = v_aux.z;
  float grime = fbm(vec2(sA * 0.55 + seed, y * 0.11)); base.rgb *= mix(1.0, 0.72, smoothstep(0.45, 0.85, grime) * 0.5) * mix(0.84, 1.0, smoothstep(0.0, 1.3, y));
  if (style < 0.5 || abs(Ng.y) > 0.3 || L < 1.4) return;
  bool grid = style < 1.5, curtain = style > 1.5 && style < 2.5, shop = style > 2.5 && style < 3.5, apt = style > 3.5;
  float mw, fh, g0, jamb, sill, head, recess, coated;
  if (grid) { mw = 2.9 + seed * 0.028; fh = 3.7; g0 = 4.6; jamb = 0.5; sill = 0.95; head = 2.75; recess = 0.22; coated = 0.3; }
  else if (curtain) { mw = 1.5; fh = 3.9; g0 = 5.0; jamb = 0.035; sill = 0.9; head = 3.86; recess = 0.05; coated = 1.0; }
  else if (shop) { mw = 4.6; fh = 1000.0; g0 = 4.4; jamb = 0.22; sill = 0.45; head = 3.0; recess = 0.16; coated = 0.12; }
  else { mw = 3.3; fh = 3.05; g0 = 3.05; jamb = 0.95; sill = 0.9; head = 2.3; recess = 0.16; coated = 0.12; }
  float top = 0.7, rest = H - g0 - top, fl = floor(rest / fh + 0.5);
  if (shop || rest < 2.4 || fl < 1.0) { fl = 0.0; g0 = max(H - top, 2.6); } else fh = rest / fl;
  float fi, yb, fhc;
  if (y < g0) { fi = -1.0; yb = y; fhc = g0; } else if (y < g0 + fl * fh) { fi = floor((y - g0) / fh); yb = y - g0 - fi * fh; fhc = fh; }
  else { base.rgb *= 0.95 + 0.1 * step(H - 0.16, y); return; }                                   /* the parapet */
  float x0 = jamb, y0 = sill, y1 = min(head, fhc - 0.25);
  if (fi < 0.0 && (grid || curtain)) { y0 = 0.5; y1 = fhc - 0.95; x0 = min(jamb, 0.3); }
  if (fi < 0.0 && shop) y1 = min(3.0, fhc - 0.45);
  float n = max(1.0, floor(L / mw + 0.5)); mw = L / n; float ci = floor(sA / mw), xb = sA - ci * mw, x1 = mw - x0;
  if (mw < x0 * 2.0 + 0.5 || y1 - y0 < 0.5) return;
  vec3 T = normalize(vec3(-Ng.z, 0.0, Ng.x)), frameCol = apt ? (seed > 15.0 ? vec3(0.72) : vec3(0.05)) : seed > 20.0 ? vec3(0.03) : vec3(0.06, 0.05, 0.045);
  vec2 rid = vec2(ci, fi) + vec2(seed * 3.7, floor(dot(Ng.xz, vec2(7.0, 13.0)) * 2.0 + 0.5) + seed); float h1 = hash12(rid), h2 = hash12(rid + 19.7), h3 = hash12(rid + 41.3);
  vec3 tint = mix(vec3(0.05, 0.055, 0.06), seed > 22.0 ? vec3(0.25, 0.21, 0.15) : seed > 10.0 ? vec3(0.15, 0.21, 0.26) : vec3(0.13, 0.19, 0.2), coated);
  /* far off, a bay is narrower than a couple of pixels and its panes would only flicker: the wall is shaded as what its
     glass and its masonry come to together (a curtain wall as one sheet of glass, the rest as a darker, smoother wall) */
  if (fpx > mw * 0.4) {
    float area = clamp((x1 - x0) / mw, 0.0, 1.0) * clamp((y1 - y0) / fhc, 0.0, 1.0), share = apt ? 0.42 : shop ? 0.72 : 0.34, cool = apt || shop ? 0.3 : 1.0;
    /* By night the wall glows by the windows that are lit: the very windows that show up close, each spread over its
       neighbours so that it is a soft dot of light and not a point that blinks, running together into the building's
       average glow only where a pixel holds several of them. (All of a tower lit to one even colour is a paper lantern.) */
    vec3 glowC = vec3(0.0);
    if (u_night > 0.0) {
      vec2 cp = vec2(sA / mw, fi + yb / fhc) - 0.5, c0 = floor(cp), cf = cp - c0; float tw = clamp(fpx / mw * 1.5, 0.3, 1.0); cf = smoothstep(0.5 - 0.5 * tw, 0.5 + 0.5 * tw, cf);
      for (int k = 0; k < 4; k++) {
        vec2 o = vec2(float(k & 1), float(k >> 1)), r2 = clamp(c0 + o, vec2(0.0, -1.0), vec2(n - 1.0, fl - 1.0)) + (rid - vec2(ci, fi)); float a1 = hash12(r2), a2 = hash12(r2 + 19.7);
        glowC += (o.x > 0.5 ? cf.x : 1.0 - cf.x) * (o.y > 0.5 ? cf.y : 1.0 - cf.y) * step(a1, share) * mix(vec3(1.0, 0.72, 0.42), vec3(0.85, 0.92, 1.0), step(0.6, a2) * cool); }
      glowC = mix(glowC, share * mix(vec3(1.0, 0.72, 0.42), vec3(0.85, 0.92, 1.0), 0.4 * cool), smoothstep(1.2, 3.0, fpx / min(mw, fhc))) * (u_night * 0.7 * area);
    }
    if (curtain) { base.rgb = tint * 0.82; s.model = 3.0; s.roughness = 0.1; s.metallic = 0.0; N = Ng; s.emissive += glowC; return; }
    base.rgb = mix(base.rgb, tint * 1.5 + 0.015, area * 0.85); s.roughness = mix(s.roughness, 0.22, area * 0.7); s.emissive += glowC; return;
  }
  /* A member a couple of pixels wide or more is drawn as itself, hard-edged. Thinner than that, some frames' samples
     hit it and others miss it: every window bar down a street blinked, and crawled when the view moved. So past that
     distance each pixel is shaded by the share of it the member covers: a soft line that thins away with distance. */
  bool fine = fpx > 0.028; float cvc = 0.0;
  if (curtain) cvc = max(clamp((0.045 - min(xb, mw - xb)) / fpx + 0.5, 0.0, 1.0), max(clamp((0.03 - abs(yb - y0)) / fpx + 0.5, 0.0, 1.0), clamp((0.03 - abs(yb - y1)) / fpx + 0.5, 0.0, 1.0)));
  if (!(xb > x0 && xb < x1 && yb > y0 && yb < y1)) {
    if (curtain) {                                                                  /* between the vision panes: mullions, and glass panels over the floor edges */
      if (fine) { base.rgb = tint * 0.75 * (1.0 - 0.78 * cvc); s.model = 3.0; s.roughness = mix(0.11, 0.35, cvc); s.metallic = 0.0; N = Ng; }   /* far off: one sheet of glass with the grid as soft lines */
      else if (xb < x0 + 0.01 || xb > x1 - 0.01 || abs(yb - y0) < 0.03 || abs(yb - y1) < 0.03) { base.rgb = vec3(0.07, 0.075, 0.08); s.roughness = 0.35; s.metallic = 0.7; N = Ng; }
      else { base.rgb = tint * 0.75; s.model = 3.0; s.roughness = 0.11; s.metallic = 0.0; N = normalize(Ng + T * ((h1 - 0.5) * 0.01)); }
      return; }
    if (grid || apt) {
      float ledge = step(0.0, fi) * smoothstep(0.17, 0.13, yb); base.rgb = mix(base.rgb, base.rgb * 1.1 + 0.015, ledge); if (ledge > 0.5) N = normalize(N + vec3(0.0, 0.6 * smoothstep(0.17, 0.0, yb), 0.0));
      float sc = clamp((0.05 - abs(yb - (y0 - 0.05))) / fpx + 0.5, 0.0, 1.0) * clamp((min(xb - (x0 - 0.08), x1 + 0.08 - xb)) / fpx + 0.5, 0.0, 1.0);
      if (sc > 0.0) { base.rgb = mix(base.rgb, vec3(0.6, 0.58, 0.54), sc); if (sc > 0.5 && !fine) N = normalize(Ng + vec3(0.0, 0.5, 0.0)); }
      else if (xb > x0 && xb < x1 && yb < y0 - 0.1) base.rgb *= 1.0 - 0.2 * smoothstep(0.35, 0.75, vnoise(vec2(sA * 7.0, y * 0.9))) * smoothstep(y0 - 1.7, y0 - 0.1, yb);
    }
    if (shop && yb > y1 + 0.28 && yb < min(y1 + 1.05, fhc - 0.12) && xb > 0.35 && xb < mw - 0.35 && hash12(vec2(ci, seed)) < 0.8) {      /* a sign band over the shop front */
      float hs = hash12(vec2(ci * 3.1, seed * 1.7)); vec3 sc = hs < 0.2 ? vec3(0.75, 0.08, 0.06) : hs < 0.4 ? vec3(0.05, 0.2, 0.5) : hs < 0.6 ? vec3(0.85, 0.8, 0.7) : hs < 0.8 ? vec3(0.06, 0.3, 0.16) : vec3(0.8, 0.5, 0.06);
      base.rgb = sc; s.roughness = 0.45; s.metallic = 0.0; N = Ng; s.emissive += sc * (2.6 * u_night); }
    return;
  }
  vec3 V = normalize(u_camPos - v_wpos), vt = vec3(dot(V, T), V.y, max(dot(V, Ng), 0.06)); vec2 p1 = vec2(xb, yb) - vt.xy / vt.z * recess;
  if (p1.x < x0 || p1.x > x1 || p1.y < y0 || p1.y > y1) {                                        /* the reveal: a side of the opening */
    vec3 rn = p1.x < x0 ? T : p1.x > x1 ? -T : p1.y < y0 ? vec3(0.0, 1.0, 0.0) : vec3(0.0, -1.0, 0.0);
    base.rgb = curtain ? vec3(0.07, 0.075, 0.08) : base.rgb * 0.9; N = normalize(mix(rn, Ng, 0.3)); s.roughness = max(s.roughness, 0.5); return; }
  float ed = min(min(p1.x - x0, x1 - p1.x), min(p1.y - y0, y1 - p1.y)), mid = 1.0;
  if (shop || fi < 0.0) mid = abs(fract((p1.x - x0) / 1.45 + 0.5) - 0.5) * 1.45; else if (!curtain) mid = min(abs(p1.x - (x0 + x1) * 0.5), apt ? 1.0 : abs(p1.y - (y0 + (y1 - y0) * 0.62)));
  float cov = max(curtain ? cvc : clamp((0.055 - ed) / fpx + 0.5, 0.0, 1.0), clamp((0.024 - mid) / fpx + 0.5, 0.0, 1.0));
  if (!fine && ((!curtain && ed < 0.055) || mid < 0.024)) { base.rgb = frameCol; s.roughness = 0.4; s.metallic = 0.5; N = Ng; return; }
  /* the room behind the pane */
  float D = 3.5 + 3.5 * h3, tz = D / vt.z; vec3 ro = vec3(p1.x, p1.y, 0.0), rd = -vt;
  float tx = rd.x > 1e-4 ? (mw - ro.x) / rd.x : rd.x < -1e-4 ? -ro.x / rd.x : 1e4, ty = rd.y > 1e-4 ? (fhc - ro.y) / rd.y : rd.y < -1e-4 ? -ro.y / rd.y : 1e4, t = min(tz, min(tx, ty));
  vec3 hp = ro + rd * t, ic;
  if (t == tz) { ic = mix(vec3(0.62, 0.58, 0.52), vec3(0.42, 0.47, 0.52), h2); vec2 q = vec2(hp.x / mw, hp.y / fhc); if (q.y < 0.7 && abs(q.x - (0.25 + 0.5 * h1)) < 0.11) ic *= 0.45; if (q.y > 0.45 && q.y < 0.72 && abs(q.x - (0.75 - 0.5 * h1)) < 0.1) ic = mix(ic, vec3(0.5, 0.3, 0.2) + 0.3 * vec3(h1, h2, h3), 0.8); }
  else if (t == ty) ic = rd.y > 0.0 ? vec3(0.8, 0.8, 0.78) + step(0.78, fract(hp.x * 0.83)) * step(0.5, fract(-hp.z * 0.6)) * 2.2 : mix(vec3(0.2, 0.16, 0.13), vec3(0.3, 0.3, 0.32), h3);
  else ic = vec3(0.56, 0.54, 0.5) * (0.8 + 0.4 * h1);
  ic *= mix(1.0, 0.35, clamp(-hp.z / 7.0, 0.0, 1.0));
  float on = step(h1, apt ? 0.42 : shop ? 0.72 : 0.34), day = 1.0 - u_night; vec3 warm = mix(vec3(1.0, 0.72, 0.42), vec3(0.85, 0.92, 1.0), step(0.6, h2) * (apt || shop ? 0.3 : 1.0));
  vec3 inside = ic * (0.3 * day + (apt ? 0.0 : 0.2 * on * day)) + ic * warm * (on * u_night * 3.2);
  float bl = !shop && fi >= 0.0 && h3 < 0.4 ? 0.25 + 0.7 * h2 : 0.0;
  if ((y1 - p1.y) / (y1 - y0) < bl) { /* a blind: its slats fade to their average where a pixel holds more than one */
    base.rgb = vec3(0.7, 0.68, 0.63) * (0.86 + 0.14 * mix(step(0.5, fract(p1.y * 22.0)), 0.5, smoothstep(0.012, 0.03, fpx))); if (fine) base.rgb = mix(base.rgb, frameCol, cov); s.roughness = 0.8; s.metallic = 0.0; N = Ng; s.emissive += base.rgb * warm * (on * u_night * 0.8); return; }
  if (fine && cov > 0.02) {
    if (curtain) { base.rgb = tint * (1.0 - 0.78 * cov); s.model = 3.0; s.roughness = mix(0.045, 0.35, cov); s.metallic = 0.0; s.emissive += inside * (1.0 - tint * 1.5) * (1.0 - cov); N = Ng; return; }
    base.rgb = mix(vec3(0.045), frameCol, cov); s.roughness = mix(0.14, 0.4, cov); s.metallic = 0.5 * cov; N = Ng; s.emissive += inside * (1.0 - cov) * 0.85; return; }
  base.rgb = tint; s.model = 3.0; s.roughness = 0.045; s.metallic = 0.0; s.emissive += inside * (1.0 - tint * 1.5);
  N = normalize(Ng + T * ((h1 - 0.5) * 0.012) + vec3(0.0, (h2 - 0.5) * 0.012, 0.0));              /* no two panes sit quite alike */
}`;
  CHUNKS.groundpbr = `
/* up close a photograph of the ground runs out of detail: where it shows lawn, scanned grass takes over its texture (keeping
   the photograph's own colour); elsewhere it takes the grain of pavement */
void groundPBR(inout Surface s, inout vec4 base, inout vec3 N) {
  /* The texture's level of detail is chosen from the ground's own gradients, taken here: before the early returns (a
     gradient asked for after one is undefined in the pixels that left), and not from the lookup's coordinates, which
     jump where lawn meets pavement (there the automatic choice fell to the coarsest level in a 2 by 2 block: a dotted edge). */
  vec2 gdx = dFdx(v_wpos.xz) * exp2(u_lodBias), gdy = dFdy(v_wpos.xz) * exp2(u_lodBias);
  if (v_wpos.y > 0.6 || N.y < 0.7) return; float dd = distance(v_wpos, u_camPos), k = 1.0 - smoothstep(16.0, 90.0, dd); if (k <= 0.0) return;
  float mx = max(base.r, max(base.g, base.b)), mn = min(base.r, min(base.g, base.b)), sat = (mx - mn) / max(mx, 1e-3);
  float green = smoothstep(0.0, 0.025, base.g - max(base.r, base.b) * 0.97) * smoothstep(0.06, 0.2, sat), lay = green > 0.5 ? 6.0 : 4.0, w = (green > 0.5 ? green : (1.0 - green) * 0.55) * k;
  float gs = 1.0 / (green > 0.5 ? 2.1 : 3.0); vec3 uvw = vec3(v_wpos.xz * gs, lay), g = textureGrad(u_albedoArr, uvw, gdx * gs, gdy * gs).rgb, avg = textureLod(u_albedoArr, uvw, 8.0).rgb, gn = textureGrad(u_normalArr, uvw, gdx * gs, gdy * gs).xyz * 2.0 - 1.0;
  base.rgb *= mix(vec3(1.0), clamp(g / max(avg, vec3(0.01)), 0.3, 2.4), w * 0.9); s.roughness = mix(s.roughness, textureGrad(u_roughArr, uvw, gdx * gs, gdy * gs).g, w * 0.8);
  N = normalize(vec3(N.x + gn.x * w * 0.9, N.y, N.z + gn.y * w * 0.9));
}`;

  function WorldKit(engine, env, S) {
    const dev = engine.device, TEXD = window.__SCOUT_TEX__ || {}, K = {};
    const hexRGB = h => { const c = SE.color(h); return [SE.linToSrgb(c[0]), SE.linToSrgb(c[1]), SE.linToSrgb(c[2]), 1]; };   /* colours for vertices are stored as displayed */
    const cvs = (w, h, fill) => { const c = document.createElement('canvas'); c.width = w; c.height = h || w; if (fill) { const g = c.getContext('2d'); g.fillStyle = fill; g.fillRect(0, 0, w, c.height); } return c; };

    /* ---------- photo-scanned materials (CC0, carried in the page as window.__SCOUT_TEX__), stacked in three array textures ---------- */
    const LAYERS = ['brick', 'siding', 'stucco', 'metal', 'concrete', 'asphalt', 'grass'], LAYER = {}; LAYERS.forEach((k, i) => { LAYER[k] = i; });
    const FLAT = { brick: ['#9a5b47', 230], siding: ['#e6e3dc', 180], stucco: ['#d9d0c0', 240], metal: ['#b9bec2', 115], concrete: ['#b5b0a6', 215], asphalt: ['#48494b', 230], grass: ['#5c7a3a', 235] };
    const TILE = { brick: 1.6, siding: 2.4, stucco: 2.5, metal: 3.0, concrete: 3.0, asphalt: 4.0 }, METAL = { metal: 0.45 };
    const arr = (fmt) => dev.texture({ w: 512, h: 512, layers: LAYERS.length, format: fmt, mips: true, wrap: 'repeat', aniso: 16 });
    K.albedoArr = arr('srgb8a8'); K.normalArr = arr('rgba8'); K.roughArr = arr('rgba8'); let mipT = 0;
    const mipsSoon = () => { clearTimeout(mipT); mipT = setTimeout(() => { if (dev.lost) return; K.albedoArr.genMips(); K.normalArr.genMips(); K.roughArr.genMips(); engine.requestRender(); }, 120); };
    LAYERS.forEach((k, i) => {
      K.albedoArr.imageLayer(cvs(4, 4, FLAT[k][0]), i); K.normalArr.imageLayer(cvs(4, 4, '#8080ff'), i); K.roughArr.imageLayer(cvs(4, 4, `rgb(${FLAT[k][1]},${FLAT[k][1]},${FLAT[k][1]})`), i);
      [['_diff', K.albedoArr], ['_nor', K.normalArr], ['_rough', K.roughArr]].forEach(([sfx, T]) => { const u = TEXD[k + sfx]; if (!u) return; const im = new Image(); im.onload = () => { if (dev.lost) return; T.imageLayer(im, i); mipsSoon(); }; im.src = u; });
    });
    mipsSoon();
    const hasPhoto = k => !!TEXD[k + '_diff'], layered = { albedo: K.albedoArr, normal: K.normalArr, rough: K.roughArr };
    const lazy = (key, srgb, o) => (TEXD[key] ? dev.lazyTexture(TEXD[key], Object.assign({ srgb, cors: false, onLoad: () => engine.requestRender() }, o || {})) : null);

    /* ---------- materials ---------- */
    const M = K.mat = {};
    M.wall = new SE.Material({ name: 'Walls', layered, vertexColors: true, roughness: 1, facade: true });
    K.layered = layered;
    M.road = new SE.Material({ name: 'Streets', layered, roughness: 1, polygonOffset: [-1, -4], castShadow: false, worldUV: 0 });
    M.paint = new SE.Material({ name: 'Road paint', vertexColors: true, roughness: 0.6, polygonOffset: [-2, -8], castShadow: false });
    M.trim = new SE.Material({ name: 'Trim', vertexColors: true, roughness: 0.72 });
    M.glass = new SE.Material({ name: 'Glass', vertexColors: true, roughness: 0.06, metallic: 0.2, nightGlow: 7, wet: 0 });
    M.glow = new SE.Material({ name: 'Glow', blend: 'add', shader: 'glow', twoSided: true, castShadow: false, wet: 0, params: { u_glow: [0, 0, 620, 1] } });
    /* how the readings show on the buildings: 'glow' (a shell of the colour round each), 'outline' (the roof's edges and a pool on the ground) or 'off' */
    K.setGlow = mode => { M.glow.params.u_glow = mode === 'glow' ? [0.1, 1.5, 620, 1] : mode === 'off' ? [0, 0, 620, 0] : [0, 0, 620, 1]; };
    M.pick = new SE.Material({ name: 'Outline' });
    const leafTex = lazy('leaves_card', true, { wrap: 'clamp', fill: [60, 90, 40, 255] });
    M.leaf = new SE.Material({ name: 'Leaves', albedoMap: leafTex, alphaTest: leafTex ? 0.5 : 0, twoSided: true, model: 'foliage', wind: 1, vertexColors: true, roughness: 0.9, wet: 0 });
    M.crown = new SE.Material({ name: 'Crowns', albedo: [0.12, 0.2, 0.05], model: 'foliage', wind: 1, vertexColors: true, roughness: 0.95, wet: 0 });
    M.trunk = new SE.Material({ name: 'Bark', albedoMap: lazy('bark_diff', true), normalMap: lazy('bark_nor', false), roughnessMap: lazy('bark_rough', false), albedo: hasPhoto('bark') ? '#ffffff' : '#5a4c40', roughness: 1, uv: [2, 3, 0, 0] });
    M.pole = new SE.Material({ name: 'Lamp posts', albedo: '#3c4044', roughness: 0.5, metallic: 0.6 });
    M.lamp = new SE.Material({ name: 'Lamps', albedo: '#20201c', emissive: [1, 0.78, 0.5], emissiveIntensity: 0, roughness: 0.4, castShadow: false });
    M.crate = new SE.Material({ name: 'Crate', albedo: '#b08a55', roughness: 0.75 });

    /* ---------- polygon tools on footprints ([x, z] rings) ---------- */
    const area = SE.Poly.area, centroid = SE.Poly.centroid;
    /* a building's rings in local metres: open, turning the positive way, with jogs under 30 cm and near-straight corners dropped */
    K.ringsOf = b => {
      const out = [];
      (b.rings || []).forEach(r => {
        let P = r.map(([la, lo]) => S.toL(la, lo)); if (P.length > 1) { const a = P[0], z = P[P.length - 1]; if (Math.abs(a[0] - z[0]) < 1e-6 && Math.abs(a[1] - z[1]) < 1e-6) P = P.slice(0, -1); }
        if (P.length < 3) return; const s = area(P); if (Math.abs(s) < 1) return; if (s < 0) P.reverse();
        for (let pass = 0; pass < 3 && P.length > 3; pass++) {
          const Qn = []; for (let i = 0; i < P.length; i++) { const p0 = Qn.length ? Qn[Qn.length - 1] : P[P.length - 1], p1 = P[i], p2 = P[(i + 1) % P.length], ax = p1[0] - p0[0], az = p1[1] - p0[1], bx = p2[0] - p1[0], bz = p2[1] - p1[1], la = Math.hypot(ax, az), lb = Math.hypot(bx, bz);
            if (la < 0.3 || (la > 0 && lb > 0 && Math.abs(ax * bz - az * bx) / (la * lb) < 0.12 && ax * bx + az * bz > 0)) continue; Qn.push(p1); }
          if (Qn.length < 3 || Math.abs(area(Qn)) < Math.abs(area(P)) * 0.8) break; P = Qn;
        }
        out.push(P);
      });
      return out;
    };
    const validOffset = (P, Qr) => { for (let i = 0, n = P.length; i < n; i++) { const j = (i + 1) % n; if ((P[j][0] - P[i][0]) * (Qr[j][0] - Qr[i][0]) + (P[j][1] - P[i][1]) * (Qr[j][1] - Qr[i][1]) <= 0) return false; } return area(Qr) > 0.15; };
    const raySeg = (ox, oz, dx, dz, p, q) => { const ex = q[0] - p[0], ez = q[1] - p[1], den = dx * ez - dz * ex; if (Math.abs(den) < 1e-9) return -1; const t = ((p[0] - ox) * ez - (p[1] - oz) * ex) / den, u = ((p[0] - ox) * dz - (p[1] - oz) * dx) / den; return u >= 0 && u <= 1 ? t : -1; };
    const minWidth = P => { let best = Infinity; const n = P.length;
      for (let i = 0; i < n; i++) { const a = P[i], c = P[(i + 1) % n], dx = c[0] - a[0], dz = c[1] - a[1], len = Math.hypot(dx, dz); if (len < 0.8) continue; const mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2, ix = -dz / len, iz = dx / len; let w = Infinity;
        for (let j = 0; j < n; j++) { if (j === i) continue; const t = raySeg(mx, mz, ix, iz, P[j], P[(j + 1) % n]); if (t > 0.05 && t < w) w = t; } if (w < best) best = w; }
      return isFinite(best) ? best : Math.sqrt(Math.abs(area(P))); };
    const off = (P, d) => SE.Poly.offset(P, d);     /* d > 0 moves the ring inward */

    /* ---------- what a building is made of ---------- */
    const C = h => hexRGB(h), TRIM = { white: C('#ece9e2'), found: C('#99958c'), cap: C('#bcb8b0'), para: C('#a9a59d') }, WHITE = [1, 1, 1, 1];
    const TINTS = { brick: hasPhoto('brick') ? ['#ffffff', '#f1e3d8', '#e3cdbf', '#d6b9a8', '#fff4ea', '#cdb1a0'] : ['#ffffff', '#f0d6c6', '#e2c2b2'], siding: ['#f4f2ec', '#c3c8c6', '#dccfb5', '#adbccb', '#bcc6ab', '#e8dcae', '#9fa6ab'], stucco: ['#ffffff', '#efe2cc', '#d9d4ca', '#e9d6bf'], metal: ['#ffffff', '#c9d3db', '#e2dccd'], concrete: ['#ffffff', '#e9e4da'] };
    const GLASS = ['#25313a', '#2c3a44', '#3a4650', '#4a4f52', '#33393d'].map(C), FRAME = { white: C('#f2f0ea'), bronze: C('#4a4440'), black: C('#26282a') }, SHUT = ['#27342d', '#1f2326', '#3b2f2a', '#2a3442'].map(C), DOORS = ['#7c2a26', '#1f3550', '#2b2b2b', '#7a5a3a', '#f1efe9', '#3d5243'].map(C);
    /* which wall a kind of building gets, and how it is glazed: 'home' windows one by one, 'band' ribbons of glass per floor, 'store' a shop front, 'none' */
    K.facadeOf = (b, h) => {
      const c = b.cls || 'unk', r = hash01(b.id + 'f'), F = (wall, glaze) => ({ wall, glaze, style: { grid: 1, curtain: 2, store: 3, apt: 4 }[glaze] || 0 });
      if (c === 'sf' || c === 'garage' || c === 'shed') return F(r < 0.55 ? 'brick' : 'siding', c === 'sf' ? 'home' : 'none');
      if (c === 'mh') return F('siding', 'home');
      if (['mf', 'hotel', 'dorm', 'care'].includes(c)) return F(r < 0.6 ? 'brick' : 'stucco', h > 7.6 ? 'apt' : 'home');
      if (['whse', 'ind', 'indh', 'indf', 'ag', 'util', 'avn', 'parking'].includes(c)) return F(c === 'parking' ? 'concrete' : 'metal', 'none');
      if (h > 22) return r < 0.62 ? F('metal', 'curtain') : F('concrete', 'grid');
      if (h > 11) return r < 0.4 ? F('metal', 'curtain') : F(r < 0.75 ? 'concrete' : 'brick', 'grid');
      if (['retail', 'svc', 'ent', 'bank', 'vet', 'theater'].includes(c)) return F(r < 0.6 ? 'stucco' : 'brick', h > 7.6 ? 'grid' : 'store');
      return F(r < 0.5 ? 'stucco' : 'brick', h > 6.2 ? 'grid' : 'store');
    };
    const statusCol = b => { const c = hexRGB(env.color(b)); return c; };

    /* one building into the cell's builders. B: { wall, trim, glass, glow, roof(x, z) -> { b, uv } }; detail: windows with frames and sills or glass alone */
    K.addBuilding = (B, b, o) => {
      const rings = K.ringsOf(b); if (!rings.length) return null;
      const id = b.id, cls = b.cls || 'unk', hRaw = Math.max(2.4, env.height(b)), flat = env.flat(b), fac = K.facadeOf(b, hRaw), kind = fac.wall, layer = LAYER[kind], tile = TILE[kind], met = METAL[kind] || 0, scol = statusCol(b);
      const tint = C(TINTS[kind][Math.floor(hash01(id + 't') * TINTS[kind].length) % TINTS[kind].length]).slice(), lw = layer + (met ? 0.5 : 0), rw = hash01(id + 'w');
      tint[3] = (fac.style * 32 + Math.floor(hash01(id + 's') * 32)) / 255;       /* the facade shader's style and seed ride in the colour's alpha */
      const out = { id, rings: [], h: hRaw, flat, cx: 0, cz: 0, top: hRaw };
      const wallQuad = (a, c, y0, y1a, y1c) => { const dx = c[0] - a[0], dz = c[1] - a[1], len = Math.hypot(dx, dz); if (len < 0.05) return; const nrm = [dz / len, 0, -dx / len], s0 = 0, s1 = len;
        const uv = (s, y) => (kind === 'siding' ? [y / tile, s / tile] : [s / tile, y / tile]);
        const A0 = [s0, len, hRaw, lw], A1 = [s1, len, hRaw, lw]; B.wall.quad([a[0], y0, a[1]], [c[0], y0, c[1]], [c[0], y1c, c[1]], [a[0], y1a, a[1]], nrm, [uv(s0, y0), uv(s1, y0), uv(s1, y1c), uv(s0, y1a)], tint, [A0, A1, A1, A0]); };
      /* geometry on a wall from a to c: s along it, y up, o out from it */
      const onWall = (a, c) => { const dx = c[0] - a[0], dz = c[1] - a[1], len = Math.hypot(dx, dz) || 1, tx = dx / len, tz = dz / len, nx = tz, nz = -tx;
        const W3 = (s, y, d) => [a[0] + tx * s + nx * d, y, a[1] + tz * s + nz * d], outN = [nx, 0, nz];
        const face = (Bd, s0, s1, y0, y1, d, col) => Bd.quad(W3(s0, y0, d), W3(s1, y0, d), W3(s1, y1, d), W3(s0, y1, d), outN, null, col);
        const box = (Bd, s0, s1, y0, y1, d, col, sides) => { face(Bd, s0, s1, y0, y1, d, col);
          if (sides.includes('t')) Bd.quad(W3(s0, y1, 0), W3(s1, y1, 0), W3(s1, y1, d), W3(s0, y1, d), [0, 1, 0], null, col);
          if (sides.includes('b')) Bd.quad(W3(s0, y0, d), W3(s1, y0, d), W3(s1, y0, 0), W3(s0, y0, 0), [0, -1, 0], null, col);
          if (sides.includes('l')) Bd.quad(W3(s0, y0, 0), W3(s0, y0, d), W3(s0, y1, d), W3(s0, y1, 0), [-tx, 0, -tz], null, col);
          if (sides.includes('r')) Bd.quad(W3(s1, y0, d), W3(s1, y0, 0), W3(s1, y1, 0), W3(s1, y1, d), [tx, 0, tz], null, col); };
        return { len, face, box, W3 }; };
      const lit = (k, share) => (hash01(id + ':' + k) < share ? 1 : 0);
      const glazing = (a, c, top, door) => {
        const w = onWall(a, c), len = w.len; if (fac.glaze !== 'home' || len < 1.7 || top < 2.3) return;      /* the other kinds are glazed by the facade shader */
        const apt = kind === 'stucco' || rw > 0.92, ww = apt ? 1.2 : 0.95 + rw * 0.55, wh = apt ? 1.45 : 1.3 + rw * 0.25, fh = apt ? 3.1 : 2.9, sp = apt ? 3.0 : 3.1 + rw * 0.6;
        const floors = Math.max(1, Math.floor((top - 0.4) / fh)), count = Math.max(len >= 2.4 ? 1 : 0, Math.floor((len - 1.3) / sp)), fcol = kind === 'stucco' ? FRAME.bronze : rw < 0.12 ? FRAME.black : FRAME.white, shutters = kind === 'siding' && rw < 0.55, scl = SHUT[Math.floor(rw * 97) % SHUT.length];
        for (let k = 0; k < count; k++) { const s = len / 2 + (k - (count - 1) / 2) * sp; if (s - ww / 2 < 0.45 || s + ww / 2 > len - 0.45) continue;
          for (let f = 0; f < floors; f++) { const y0 = f * fh + 0.92, y1 = y0 + wh; if (y1 > top - 0.3) continue; if (door && f === 0 && Math.abs(s - door.s) < door.w / 2 + ww / 2 + 0.35) continue;
            const ft = 0.07, fo = 0.06, g = GLASS[Math.floor(hash01(id + ':' + k + ':' + f + a[0].toFixed(0)) * GLASS.length) % GLASS.length];
            w.face(B.glass, s - ww / 2 + ft, s + ww / 2 - ft, y0 + ft, y1 - ft, 0.015, [g[0], g[1], g[2], lit(k + ':' + f + ':' + a[0].toFixed(0), 0.38)]);
            if (!o.detail) continue;
            /* the frame and the glazing bars are a hand wide: they go in a mesh of their own, drawn only as far as they are still about a pixel wide (past that they are a flicker, not a frame) */
            const BF = B.fine || B.trim;
            w.box(BF, s - ww / 2, s - ww / 2 + ft, y0, y1, fo, fcol, 'r'); w.box(BF, s + ww / 2 - ft, s + ww / 2, y0, y1, fo, fcol, 'l'); w.box(BF, s - ww / 2 + ft, s + ww / 2 - ft, y1 - ft, y1, fo, fcol, 'b'); w.box(BF, s - ww / 2 + ft, s + ww / 2 - ft, y0, y0 + ft, fo, fcol, 't');
            w.box(B.trim, s - ww / 2 - 0.06, s + ww / 2 + 0.06, y0 - 0.07, y0, 0.11, TRIM.cap, 't');
            if (!apt) { w.face(BF, s - 0.018, s + 0.018, y0 + ft, y1 - ft, 0.035, fcol); w.face(BF, s - ww / 2 + ft, s + ww / 2 - ft, (y0 + y1) / 2 - 0.018, (y0 + y1) / 2 + 0.018, 0.036, fcol); }
            if (shutters) { w.face(B.trim, s - ww / 2 - 0.46, s - ww / 2 - 0.04, y0, y1, 0.03, scl); w.face(B.trim, s + ww / 2 + 0.04, s + ww / 2 + 0.46, y0, y1, 0.03, scl); } } }
      };
      /* a door on the wall that faces the nearest street (a front door), or the alley or drive (a garage door) */
      const doorSpot = W => { const garage = cls === 'garage', home = cls === 'sf' || cls === 'mh'; if ((!garage && !home) || !o.nearRoad) return null; const [cx, cz] = centroid(W), road = o.nearRoad(cx, cz, garage); if (!road) return null; let best = null;
        for (let i = 0; i < W.length; i++) { const a = W[i], c = W[(i + 1) % W.length], dx = c[0] - a[0], dz = c[1] - a[1], len = Math.hypot(dx, dz); if (len < (garage ? 2.9 : 2.0)) continue; const nx = dz / len, nz = -dx / len, mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2, vx = road.x - mx, vz = road.z - mz, vl = Math.hypot(vx, vz) || 1, f = (nx * vx + nz * vz) / vl;
          if (f > 0.35 && (!best || f * Math.min(len, 9) > best.sc)) best = { sc: f * Math.min(len, 9), i, len }; }
        if (!best) return null; best.garage = garage; best.w = garage ? (best.len >= 6 ? 4.9 : Math.min(2.5, best.len - 0.4)) : 0.98; best.s = garage ? best.len / 2 : clamp(best.len * 0.3, 0.7, best.len - 0.7); return best; };
      const doorOn = (W, d) => { if (!d) return; const a = W[d.i], c = W[(d.i + 1) % W.length], w = onWall(a, c), col = d.garage ? TRIM.white : DOORS[Math.floor(hash01(id + 'd') * DOORS.length) % DOORS.length], hh = d.garage ? 2.15 : 2.05;
        w.box(B.trim, d.s - d.w / 2, d.s + d.w / 2, 0.02, hh, 0.045, col, 'tlr'); if (o.detail) { w.box(B.trim, d.s - d.w / 2 - 0.09, d.s - d.w / 2, 0, hh + 0.09, 0.07, TRIM.white, 'lr'); w.box(B.trim, d.s + d.w / 2, d.s + d.w / 2 + 0.09, 0, hh + 0.09, 0.07, TRIM.white, 'lr'); w.box(B.trim, d.s - d.w / 2 - 0.09, d.s + d.w / 2 + 0.09, hh, hh + 0.09, 0.07, TRIM.white, 'tb');
          if (d.garage) for (let r = 1; r < 4; r++) w.face(B.fine || B.trim, d.s - d.w / 2, d.s + d.w / 2, hh * r / 4 - 0.012, hh * r / 4 + 0.012, 0.05, TRIM.cap); } };
      const ring = (A2, B2, ya, yb, Bd, col, inward) => { for (let i = 0; i < A2.length; i++) { const j = (i + 1) % A2.length, a = A2[i], c = A2[j], dx = c[0] - a[0], dz = c[1] - a[1], len = Math.hypot(dx, dz) || 1, sg = inward ? -1 : 1; Bd.quad([a[0], ya, a[1]], [c[0], ya, c[1]], [B2[j][0], yb, B2[j][1]], [B2[i][0], yb, B2[i][1]], [sg * dz / len, 0, sg * -dx / len], null, col); } };
      const flatRing = (A2, B2, y, Bd, col, ny) => { for (let i = 0; i < A2.length; i++) { const j = (i + 1) % A2.length; Bd.quad([A2[i][0], y, A2[i][1]], [A2[j][0], y, A2[j][1]], [B2[j][0], y, B2[j][1]], [B2[i][0], y, B2[i][1]], [0, ny, 0], null, col); } };
      const cap = (Qr, y, roof, col) => { SE.Poly.triangulate(Qr).forEach(t => { const a = [Qr[t[0]][0], y, Qr[t[0]][1]], c = [Qr[t[1]][0], y, Qr[t[1]][1]], d = [Qr[t[2]][0], y, Qr[t[2]][1]]; if (roof) B.roofTri(a, c, d, [0, 1, 0]); else B.trim.tri(a, c, d, [0, 1, 0], null, null, null, col); }); };
      let sx = 0, sz = 0, sn = 0;
      rings.forEach((P, ri) => {
        const ar = Math.abs(area(P)), rec = { P, eave: hRaw, h: hRaw }; P.forEach(p => { sx += p[0]; sz += p[1]; sn++; });
        if (!flat) {
          /* a hipped roof: the footprint is the eave line, offset inward to the ridge; the walls stand 42 cm in, under the eaves */
          let d = Math.min(9, 0.46 * minWidth(P)), Qr = d > 0.25 ? off(P, d) : null, tries = 0; while (Qr && !validOffset(P, Qr) && tries++ < 4) { d *= 0.7; Qr = off(P, d); }
          let rise; if (Qr && validOffset(P, Qr)) rise = d * 0.42; else { const [mx, mz] = centroid(P); Qr = P.map(p => [mx + (p[0] - mx) * 0.35, mz + (p[1] - mz) * 0.35]); rise = clamp(0.2 * Math.sqrt(ar), 0.8, 3); }
          let eave = hRaw - rise; if (eave < 2.5) { eave = Math.max(2.2, Math.min(2.5, hRaw - 0.6)); rise = Math.max(0.4, hRaw - eave); }
          const top = eave + rise, Wo = off(P, 0.42), W = validOffset(P, Wo) && area(Wo) > 0.55 * ar ? Wo : P, door = ri === 0 ? doorSpot(W) : null;
          for (let i = 0; i < W.length; i++) { const a = W[i], c = W[(i + 1) % W.length]; wallQuad(a, c, 0, eave, eave); glazing(a, c, eave, door && door.i === i ? door : null); } doorOn(W, door);
          if (W !== P) flatRing(P, W, eave, B.trim, TRIM.white, -1);
          for (let i = 0; i < P.length; i++) { const j = (i + 1) % P.length, a = P[i], c = P[j], dx = c[0] - a[0], dz = c[1] - a[1], len = Math.hypot(dx, dz) || 1; B.trim.quad([a[0], eave - 0.22, a[1]], [c[0], eave - 0.22, c[1]], [c[0], eave + 0.03, c[1]], [a[0], eave + 0.03, a[1]], [dz / len, 0, -dx / len], null, TRIM.white); }
          const Wf = off(W, -0.03); ring(Wf, Wf, 0, 0.34, B.trim, TRIM.found, false);
          for (let i = 0; i < P.length; i++) { const j = (i + 1) % P.length, a = [P[i][0], eave, P[i][1]], c = [P[j][0], eave, P[j][1]], dq = [Qr[j][0], top, Qr[j][1]], e = [Qr[i][0], top, Qr[i][1]];
            const ux = c[0] - a[0], uz = c[2] - a[2], v1 = [e[0] - a[0], e[1] - a[1], e[2] - a[2]], v2 = [dq[0] - a[0], dq[1] - a[1], dq[2] - a[2]], v = Math.hypot(v1[0], v1[1], v1[2]) > Math.hypot(v2[0], v2[1], v2[2]) ? v1 : v2;
            let nr = [-uz * v[1], uz * v[0] - ux * v[2], ux * v[1]]; const nl = Math.hypot(nr[0], nr[1], nr[2]) || 1; nr = nr.map(x => x / nl); if (nr[1] < 0) nr = nr.map(x => -x);
            B.roofTri(a, c, dq, nr); B.roofTri(a, dq, e, nr); }
          if (Math.abs(area(Qr)) > 0.05) cap(Qr, top, true);
          Object.assign(rec, { Q: Qr, eave, h: top }); out.top = Math.max(out.top, top);
        } else {
          /* a flat roof behind a parapet */
          const para = ar > 120 && hRaw > 4.2, deck = para ? hRaw - 0.9 : hRaw, Pi = para ? off(P, 0.3) : null, inner = Pi && validOffset(P, Pi) ? Pi : null;
          for (let i = 0; i < P.length; i++) { const a = P[i], c = P[(i + 1) % P.length]; wallQuad(a, c, 0, hRaw, hRaw); glazing(a, c, hRaw, null); }
          if (inner) { ring(inner, inner, deck, hRaw, B.trim, TRIM.para, true); flatRing(P, inner, hRaw, B.trim, TRIM.cap, 1); cap(inner, deck, true); } else cap(P, hRaw, true);
          Object.assign(rec, { Q: inner || P });
        }
        out.rings.push(rec);
        /* the glow: a shell 55 cm out and up past the eaves, a pool of the colour on the ground, bright lines along the roof's edges */
        const Sg = off(P, -0.55), sTop = flat ? rec.h + 0.6 : rec.eave + 0.55, a0 = [0, 0, 0, 0], a1 = [1, 0, 0, 0];
        for (let i = 0; i < Sg.length; i++) { const j = (i + 1) % Sg.length, a = Sg[i], c = Sg[j], dx = c[0] - a[0], dz = c[1] - a[1], len = Math.hypot(dx, dz) || 1; B.glow.quad([a[0], 0, a[1]], [c[0], 0, c[1]], [c[0], sTop, c[1]], [a[0], sTop, a[1]], [dz / len, 0, -dx / len], null, scol, [a0, a0, a1, a1]); }
        const H1 = off(P, -0.3), H2 = off(P, -2.8), hi = [scol[0], scol[1], scol[2], 0.5], lo = [scol[0], scol[1], scol[2], 0], hx = [0, 1, 0, 0];
        for (let i = 0; i < H1.length; i++) { const j = (i + 1) % H1.length, pa = [H1[i][0], 0.17, H1[i][1]], pb = [H1[j][0], 0.17, H1[j][1]], pc = [H2[j][0], 0.17, H2[j][1]], pd = [H2[i][0], 0.17, H2[i][1]]; B.glow.tri(pa, pb, pc, [0, 1, 0], null, null, null, hi, hx, hx, hx); B.glow.tri(pa, pc, pd, [0, 1, 0], null, null, null, hi, hx, hx, hx); void lo; }
        /* each edge is two ribbons crossed, one lying flat and one standing; each vertex carries which way is across its ribbon, so the shader can widen a ribbon that has grown thinner than a pixel */
        const exV = [1, 2, 0, 0], EXV = [exV, exV, exV, exV], edge = (p, q) => { const dx = q[0] - p[0], dy = q[1] - p[1], dz = q[2] - p[2], l = Math.hypot(dx, dy, dz); if (l < 0.2) return; const hx2 = dz / (Math.hypot(dx, dz) || 1) * 0.09, hz2 = -dx / (Math.hypot(dx, dz) || 1) * 0.09, uvq = [[0, -1], [1, -1], [1, 1], [0, 1]], exH = [0, 2, hx2 / 0.09, hz2 / 0.09], EXH = [exH, exH, exH, exH];
          B.glow.quad([p[0] - hx2, p[1], p[2] - hz2], [q[0] - hx2, q[1], q[2] - hz2], [q[0] + hx2, q[1], q[2] + hz2], [p[0] + hx2, p[1], p[2] + hz2], [0, 1, 0], uvq, scol, EXH); B.glow.quad([p[0], p[1] - 0.09, p[2]], [q[0], q[1] - 0.09, q[2]], [q[0], q[1] + 0.09, q[2]], [p[0], p[1] + 0.09, p[2]], [hx2 / 0.09, 0, hz2 / 0.09], uvq, scol, EXV); };
        for (let i = 0; i < P.length; i++) { const j = (i + 1) % P.length; edge([P[i][0], rec.eave + 0.06, P[i][1]], [P[j][0], rec.eave + 0.06, P[j][1]]); if (!flat && rec.Q) { edge([P[i][0], rec.eave + 0.06, P[i][1]], [rec.Q[i][0], rec.h + 0.06, rec.Q[i][1]]); edge([rec.Q[i][0], rec.h + 0.06, rec.Q[i][1]], [rec.Q[j][0], rec.h + 0.06, rec.Q[j][1]]); } }
      });
      out.cx = sx / sn; out.cz = sz / sn; return out;
    };
    /* a building alone, as one plain solid: for the outline of the one picked or pointed at */
    /* a building of the wider city: its walls, with the same generated windows, and a flat lid that wears the photograph
       (or a plain colour where there is no photograph to wear) */
    K.addContext = (Bw, Br, f, uv, o) => {
      const P = f.P, h = f.h, n = P.length; o = o || {};
      if (Bw && !o.noWalls) { const fac = K.facadeOf(f, h), kind = fac.wall, layer = LAYER[kind], tile = TILE[kind], lw = layer + (METAL[kind] ? 0.5 : 0);
        const tint = C(TINTS[kind][Math.floor(hash01(f.id + 't') * TINTS[kind].length) % TINTS[kind].length]).slice(); tint[3] = (fac.style * 32 + Math.floor(hash01(f.id + 's') * 32)) / 255;
        const u = (s2, y) => (kind === 'siding' ? [y / tile, s2 / tile] : [s2 / tile, y / tile]);
        for (let i = 0; i < n; i++) { const a = P[i], c = P[(i + 1) % n], dx = c[0] - a[0], dz = c[1] - a[1], len = Math.hypot(dx, dz); if (len < 0.3) continue; const A0 = [0, len, h, lw], A1 = [len, len, h, lw];
          Bw.quad([a[0], 0, a[1]], [c[0], 0, c[1]], [c[0], h, c[1]], [a[0], h, a[1]], [dz / len, 0, -dx / len], [u(0, 0), u(len, 0), u(len, h), u(0, h)], tint, [A0, A1, A1, A0]); } }
      if (Br) SE.Poly.triangulate(P).forEach(t => { const a = P[t[0]], c = P[t[1]], d = P[t[2]]; if (uv) Br.tri([a[0], h, a[1]], [c[0], h, c[1]], [d[0], h, d[1]], [0, 1, 0], uv(a), uv(c), uv(d)); else Br.tri([a[0], h, a[1]], [c[0], h, c[1]], [d[0], h, d[1]], [0, 1, 0], null, null, null, o.roofCol || [0.42, 0.42, 0.41, 1]); });
    };
    K.solidOf = b => { const rings = K.ringsOf(b); if (!rings.length) return null; const h = Math.max(2.4, env.height(b)) + 0.25, Bd = new SE.MeshBuilder();
      rings.forEach(P0 => { const P = off(P0, -0.2); for (let i = 0; i < P.length; i++) { const a = P[i], c = P[(i + 1) % P.length], dx = c[0] - a[0], dz = c[1] - a[1], l = Math.hypot(dx, dz) || 1; Bd.quad([a[0], 0, a[1]], [c[0], 0, c[1]], [c[0], h, c[1]], [a[0], h, a[1]], [dz / l, 0, -dx / l]); } SE.Poly.triangulate(P).forEach(t => Bd.tri([P[t[0]][0], h, P[t[0]][1]], [P[t[1]][0], h, P[t[1]][1]], [P[t[2]][0], h, P[t[2]][1]], [0, 1, 0])); });
      return Bd.build(dev, { name: 'outline' }); };

    /* ---------- streets and alleys: ribbons of asphalt and concrete ---------- */
    K.ROADW = { major: [12, 0.1, 'asphalt'], street: [8.2, 0.09, 'asphalt'], service: [5.2, 0.085, 'asphalt'], alley: [4.2, 0.08, 'concrete'], drive: [3, 0.075, 'concrete'], path: [1.6, 0.07, 'concrete'] };
    K.ribbon = (Bd, pts, w, y, kind, offs, col) => {
      const n = pts.length, hw = w / 2, L = [], R = [], o = offs || 0, tile = TILE[kind] || 4, ax = kind ? [0, 0, 0, LAYER[kind]] : null, AX = ax ? [ax, ax, ax, ax] : null;
      for (let i = 0; i < n; i++) { const p = pts[i], a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)]; let t1x = 0, t1z = 0, t2x = 0, t2z = 0;
        if (i > 0) { const dx = p[0] - a[0], dz = p[1] - a[1], l = Math.hypot(dx, dz) || 1; t1x = dx / l; t1z = dz / l; } if (i < n - 1) { const dx = b[0] - p[0], dz = b[1] - p[1], l = Math.hypot(dx, dz) || 1; t2x = dx / l; t2z = dz / l; }
        if (i === 0) { t1x = t2x; t1z = t2z; } if (i === n - 1) { t2x = t1x; t2z = t1z; }
        let tx = t1x + t2x, tz = t1z + t2z; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl; const nx = -tz, nz = tx, k = 1 / Math.max(0.4, nx * -t1z + nz * t1x);
        L.push([p[0] + nx * (o + hw) * k, p[1] + nz * (o + hw) * k]); R.push([p[0] + nx * (o - hw) * k, p[1] + nz * (o - hw) * k]); }
      const up = [0, 1, 0], uv = p => [p[0] / tile, p[2] / tile];
      for (let i = 0; i + 1 < n; i++) { const a = [L[i][0], y, L[i][1]], b = [R[i][0], y, R[i][1]], c = [R[i + 1][0], y, R[i + 1][1]], d = [L[i + 1][0], y, L[i + 1][1]]; Bd.quad(a, b, c, d, up, [uv(a), uv(b), uv(c), uv(d)], col || WHITE, AX); }
      if (!offs && kind) for (let i = 0; i < n; i++) { const p = pts[i]; for (let s = 0; s < 10; s++) { const a0 = s / 10 * TAU, a1 = (s + 1) / 10 * TAU, a = [p[0], y, p[1]], b = [p[0] + Math.cos(a0) * hw, y, p[1] + Math.sin(a0) * hw], c = [p[0] + Math.cos(a1) * hw, y, p[1] + Math.sin(a1) * hw]; Bd.tri(a, b, c, up, uv(a), uv(b), uv(c), WHITE, ax, ax, ax); } }
    };

    /* ---------- trees: a trunk, and a crown of leaf cards near and a plain crown far; where they stand comes from the photograph ---------- */
    (() => {
      const R = SE.rng(4242), cards = new SE.MeshBuilder({ aux: true }), cy = 0.66;
      for (let i = 0; i < 64; i++) { const u = R() * 2 - 1, th = R() * TAU, s = Math.sqrt(1 - u * u), dir = [s * Math.cos(th), u, s * Math.sin(th)], rr = 0.5 * (0.5 + 0.5 * Math.cbrt(R())), c = [dir[0] * rr, cy + dir[1] * rr * 0.68, dir[2] * rr], sz = 0.15 + R() * 0.07;
        const tl = [R() - 0.5, R() - 0.5, R() - 0.5], n = SE.V3.normalize([0, 0, 0], [dir[0] + tl[0] * 0.9, dir[1] + tl[1] * 0.9 + 0.25, dir[2] + tl[2] * 0.9]), ux = SE.V3.normalize([0, 0, 0], SE.V3.cross([0, 0, 0], Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], n)), vx = SE.V3.cross([0, 0, 0], n, ux);
        const P = (a, b) => [c[0] + ux[0] * a * sz + vx[0] * b * sz, c[1] + ux[1] * a * sz + vx[1] * b * sz, c[2] + ux[2] * a * sz + vx[2] * b * sz], shade = 0.5 + 0.5 * clamp(rr / 0.5 * 0.7 + (dir[1] + 1) * 0.25, 0, 1), col = [shade, shade, shade, 1], wg = [0.12 + 0.55 * Math.max(0, c[1] - 0.3), 0, 0, 0];
        cards.tri(P(-1, -1), P(1, -1), P(1, 1), null, [0, 1], [1, 1], [1, 0], col, wg, wg, wg); cards.tri(P(-1, -1), P(1, 1), P(-1, 1), null, [0, 1], [1, 0], [0, 0], col, wg, wg, wg); }
      const cd = cards.data({ name: 'crown-cards' }); for (let i = 0; i < cd.positions.length; i += 3) { const x = cd.positions[i], y = cd.positions[i + 1] - cy, z = cd.positions[i + 2], l = Math.hypot(x, y, z) || 1; cd.normals[i] = x / l * 0.8; cd.normals[i + 1] = y / l * 0.8 + 0.2; cd.normals[i + 2] = z / l * 0.8; }
      K.crownNear = new SE.Mesh(dev, cd);
      const blob = (detail, seed) => { const d = SE.Prim.blob(0.5, detail, 0.3, seed), n = d.positions.length / 3, col = new Uint8Array(n * 4), ax = new Float32Array(n * 4); for (let i = 0; i < n; i++) { d.positions[i * 3 + 1] = d.positions[i * 3 + 1] * 0.68 + cy; const y = d.positions[i * 3 + 1], sh = 150 + 105 * clamp((y - 0.32) / 0.6, 0, 1); col[i * 4] = col[i * 4 + 1] = col[i * 4 + 2] = sh; col[i * 4 + 3] = 255; ax[i * 4] = 0.12 + 0.55 * Math.max(0, y - 0.3); } d.colors = col; d.aux = ax; d.keep = false; return new SE.Mesh(dev, d); };
      K.crownMid = blob(2, 11); K.crownFar = blob(1, 12);
      const tr = SE.Prim.cylinder(0.034, 0.018, 0.56, 7, false); for (let i = 1; i < tr.positions.length; i += 3) tr.positions[i] += 0.28; tr.keep = false; K.trunk = new SE.Mesh(dev, tr);
    })();
    /* where the photograph of a cell shows canopy: 1 m cells that are textured and dark, and green or brown, with the footprints and
       streets masked out and specks removed; a distance transform finds the crowns' centres and radii. rect: the cell in local metres;
       mask(g, toPx): draws what is not a tree into a canvas. Returns [{ x, z, r, h, col }] */
    K.detectTrees = (canvas, rect, mask) => {
      const N = canvas.width, CP = 4, Mn = Math.floor(N / CP); let data; try { data = canvas.getContext('2d').getImageData(0, 0, N, N).data; } catch (e) { return []; }
      const mx = (rect.x1 - rect.x0) / Mn, mz = (rect.zS - rect.zN) / Mn, can = new Uint8Array(Mn * Mn), cr = new Float32Array(Mn * Mn), cg = new Float32Array(Mn * Mn), cb = new Float32Array(Mn * Mn);
      for (let cy2 = 0; cy2 < Mn; cy2++) for (let cx = 0; cx < Mn; cx++) { let sr = 0, sg = 0, sb = 0, sy = 0, syy = 0;
        for (let y = 0; y < CP; y++) { let i = ((cy2 * CP + y) * N + cx * CP) * 4; for (let x = 0; x < CP; x++, i += 4) { const r = data[i], g = data[i + 1], b = data[i + 2], Y = 0.299 * r + 0.587 * g + 0.114 * b; sr += r; sg += g; sb += b; sy += Y; syy += Y * Y; } }
        const k = cy2 * Mn + cx, q = CP * CP, r = sr / q, g = sg / q, b = sb / q, Y = sy / q, sd = Math.sqrt(Math.max(0, syy / q - Y * Y)), exg = 2 * g - r - b; cr[k] = r; cg[k] = g; cb[k] = b;
        can[k] = ((exg > 8 && Y < 150 && sd > 7) || (exg > 0 && Y < 100 && sd > 9) || (r >= b - 4 && Y < 118 && sd > 15 && exg > -14)) && b < g + 22 ? 1 : 0; }
      const mc = cvs(Mn, Mn), mg = mc.getContext('2d'); mg.fillStyle = '#000'; mg.strokeStyle = '#000'; mg.lineCap = 'round'; mg.lineJoin = 'round'; mask(mg, (x, z) => [(x - rect.x0) / mx, (z - rect.zN) / mz], 1 / mx);
      const md = mg.getImageData(0, 0, Mn, Mn).data; for (let k = 0; k < Mn * Mn; k++) if (md[k * 4 + 3] > 40) can[k] = 0;
      const morph = (src, grow) => { const o2 = new Uint8Array(Mn * Mn); for (let y = 1; y < Mn - 1; y++) for (let x = 1; x < Mn - 1; x++) { let s = 0; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) s += src[(y + j) * Mn + x + i]; o2[y * Mn + x] = grow ? (s > 0 ? 1 : 0) : (s === 9 ? 1 : 0); } return o2; };
      let m = morph(morph(can, false), true); m = morph(morph(m, true), false); for (let k = 0; k < Mn * Mn; k++) if (md[k * 4 + 3] > 40) m[k] = 0;
      const D = new Float32Array(Mn * Mn); for (let k = 0; k < Mn * Mn; k++) D[k] = m[k] ? 1e6 : 0;
      for (let y = 1; y < Mn; y++) for (let x = 1; x < Mn - 1; x++) { const k = y * Mn + x; if (!D[k]) continue; D[k] = Math.min(D[k], D[k - 1] + 1, D[k - Mn] + 1, D[k - Mn - 1] + 1.414, D[k - Mn + 1] + 1.414); }
      for (let y = Mn - 2; y >= 0; y--) for (let x = Mn - 2; x >= 1; x--) { const k = y * Mn + x; if (!D[k]) continue; D[k] = Math.min(D[k], D[k + 1] + 1, D[k + Mn] + 1, D[k + Mn + 1] + 1.414, D[k + Mn - 1] + 1.414); }
      const cand = []; for (let y = 2; y < Mn - 2; y++) for (let x = 2; x < Mn - 2; x++) { const k = y * Mn + x, d = D[k]; if (d < 1.8 || d > 1e5) continue; let top = true; for (let j = -2; j <= 2 && top; j++) for (let i = -2; i <= 2; i++) { const v = D[k + j * Mn + i]; if (v > d || (v === d && (j * Mn + i) > 0)) { top = false; break; } } if (top) cand.push({ x, y, d }); }
      cand.sort((a, b) => b.d - a.d); const out = [];
      cand.forEach(c => { const r = Math.min(6.5, c.d * mx + 0.6); for (const o2 of out) if (Math.hypot(o2.cx - c.x, o2.cy - c.y) * mx < 0.72 * (o2.r + r)) return;
        let rr = 0, gg = 0, bb = 0, nn = 0; const rc = Math.max(1, Math.round(c.d * 0.6)); for (let j = -rc; j <= rc; j++) for (let i = -rc; i <= rc; i++) { const k = (c.y + j) * Mn + c.x + i; if (k >= 0 && k < Mn * Mn && m[k]) { rr += cr[k]; gg += cg[k]; bb += cb[k]; nn++; } }
        const x = rect.x0 + (c.x + 0.5) * mx, z = rect.zN + (c.y + 0.5) * mz; out.push({ cx: c.x, cy: c.y, r, x, z, h: clamp(4.5 + r * (1.15 + hash01(x.toFixed(1) + z.toFixed(1)) * 0.6), 6, 22), col: nn ? [rr / nn, gg / nn, bb / nn] : [70, 85, 55] }); });
      return out;
    };
    Object.assign(K, { LAYER, TILE, hexRGB, cvs, WHITE });
    return K;
  }
  SE.WorldKit = WorldKit;

  /* ==== rooftop scout on the engine: the street's furniture and its traffic ==== */
  /* Generated from the street map, the way a city sample is dressed by procedure rather than by hand: sidewalks and curbs
     beside every street, crosswalks and stop bars where streets meet, signals where a main road is crossed and stop signs
     elsewhere, cars parked at the curb and cars driving (keeping right, keeping their distance, stopping for red lights
     and stop signs). None of it is observed: where the streets run is real, what stands and moves on them is invented,
     and the view says so. */
  function StreetKit(engine, K, S) {
    const dev = engine.device, scene = engine.scene, M = K.mat, X = {}; let group = null, parts = [];
    const right = (vx, vz) => [-vz, vx];                       /* the right-hand side of a heading, with +x east and +z south */
    const DRIVE = new Set(['street', 'major']);
    /* ---------- materials ---------- */
    M.side = new Material({ name: 'Sidewalks', layered: K.layered, roughness: 1, castShadow: false });
    M.sign = new Material({ name: 'Signs and signals', vertexColors: true, roughness: 0.5, metallic: 0.1, wet: 0 });
    const SIG = {}; ['ns', 'ew'].forEach(ax => ['r', 'y', 'g'].forEach(c => { SIG[ax + c] = new Material({ name: 'Signal ' + ax + ' ' + c, model: 'unlit', albedo: '#000000', emissive: c === 'r' ? [1, 0.06, 0.04] : c === 'y' ? [1, 0.62, 0.05] : [0.1, 1, 0.35], emissiveIntensity: 0, castShadow: false, wet: 0 }); }));

    /* ---------- cars: the kinds in 94a, each drawn at three finenesses by how far it is ---------- */
    const CK = CarKit(engine, K), TYPES = CK.types, typeOf = r => CK.pick(r);
    const PAINT = [['#f4f4f2', 0.25], ['#0a0a0b', 0.19], ['#9a9ea3', 0.16], ['#4c4f54', 0.14], ['#7e1512', 0.08], ['#1a3767', 0.08], ['#213a2c', 0.02], ['#b3a184', 0.04], ['#c65a1b', 0.02], ['#4f2424', 0.02]].map(([h, w]) => [K.hexRGB(h), w]);
    const pick = (list, r) => { let a = 0; for (const [v, w] of list) { a += w; if (r <= a) return v; } return list[list.length - 1][0]; };
    let fleet = null;
    function fleetInit() { if (fleet) return fleet; fleet = TYPES.map((t, i) => { const c = CK.get(i), e = scene.createEntity(t.name + 's', { parent: group, transient: true }), sets = {};
        [['near', c.fine, c.still, 130], ['mid', c.mid, c.still, 90], ['far', c.far, c.still, 0], ['mnear', c.fine, c.rolling, 130], ['mfar', c.mid, c.rolling, 90]].forEach(([k, mesh, mat, sh]) => { const ib = new InstanceBuffer(dev, 64), r = e.add('InstancedRenderer'); r.instances = ib; r.mesh = mesh; r.material = mat; r.castShadow = sh > 0; r.shadowDistance = sh || 1; sets[k] = ib; });
        return { t, e, sets }; }); return fleet; }

    /* ---------- the street map as a network: where ways meet, and each way measured along its length ---------- */
    function network(roads) {
      const nodes = new Map(), key = p => Math.round(p[0] * 2) + ':' + Math.round(p[1] * 2), ways = [];
      roads.forEach((r, ri) => { if (r.kind === 'path' || r.kind === 'drive') return; const acc = [0]; for (let i = 1; i < r.pts.length; i++) acc.push(acc[i - 1] + Math.hypot(r.pts[i][0] - r.pts[i - 1][0], r.pts[i][1] - r.pts[i - 1][1]));
        const w = { ri, r, acc, len: acc[acc.length - 1], hw: (K.ROADW[r.kind] || K.ROADW.street)[0] / 2, drive: DRIVE.has(r.kind), nodes: [] }; ways[ri] = w;
        r.pts.forEach((p, pi) => { const k = key(p); let n = nodes.get(k); if (!n) nodes.set(k, n = { x: p[0], z: p[1], legs: [], deg: 0, hw: 0, major: false, id: nodes.size }); const mid = pi > 0 && pi < r.pts.length - 1; n.legs.push({ w, pi }); if (w.drive || r.kind === 'service') { n.deg += mid ? 2 : 1; n.hw = Math.max(n.hw, w.hw); if (r.kind === 'major') n.major = true; } else n.alley = true; }); });
      const q = [0, 0, 0, 0];
      nodes.forEach(n => { n.cross = n.deg >= 3 && n.legs.some(l => l.w.drive); n.signal = n.cross && n.major; n.r = n.hw + 1.2;
        /* each direction a roadway leaves the crossing in is an arm; an arm is clear of its neighbours where their edges part,
           which is farther out the more slanted the meeting. Stop bars, crosswalks, kerbs and the cars' stop lines all use it. */
        const arms = []; n.legs.forEach(l => { const w = l.w, P = w.r.pts; l.rm = l.rp = n.r; if (!w.drive) return;
          [[1, 'rp'], [-1, 'rm']].forEach(([sd, key]) => { const k = l.pi + sd; if (k < 0 || k >= P.length) return; at(w, w.acc[l.pi] + sd * Math.min(9, w.len), q); let ux = q[0] - n.x, uz = q[1] - n.z; const ul = Math.hypot(ux, uz); if (ul < 0.5) return; arms.push({ l, key, ux: ux / ul, uz: uz / ul, hw: w.hw }); }); });
        arms.forEach(a => { let r = n.r; arms.forEach(b => { if (b === a) return; const c = a.ux * b.ux + a.uz * b.uz; if (c > 0.985 || c < -0.94) return; r = Math.max(r, Math.min(26, (b.hw + a.hw * c) / Math.sqrt(1 - c * c) + 1.2)); }); a.l[a.key] = r; });
        n.arms = arms.length;
        if (n.cross) n.legs.forEach(l => { if (l.w.drive) l.w.nodes.push({ n, d: l.w.acc[l.pi], l }); }); });
      ways.forEach(w => { if (w) w.nodes.sort((a, b) => a.d - b.d); });
      return { nodes: [...nodes.values()], ways };
    }
    const at = (w, d, out) => { const A = w.acc, P = w.r.pts; d = clamp(d, 0, w.len); let i = 1; while (i < A.length - 1 && A[i] < d) i++; const a = P[i - 1], b = P[i], l = A[i] - A[i - 1] || 1, t = (d - A[i - 1]) / l; out[0] = a[0] + (b[0] - a[0]) * t; out[1] = a[1] + (b[1] - a[1]) * t; out[2] = (b[0] - a[0]) / l; out[3] = (b[1] - a[1]) / l; return out; };
    /* the stretch of a way from d0 to d1 as its own line */
    const piece = (w, d0, d1) => { const out = [], p = [0, 0, 0, 0]; at(w, d0, p); out.push([p[0], p[1]]); for (let i = 1; i < w.acc.length - 1; i++) if (w.acc[i] > d0 + 0.3 && w.acc[i] < d1 - 0.3) out.push(w.r.pts[i]); at(w, d1, p); out.push([p[0], p[1]]); return out; };
    /* a line moved sideways by o (to the right of its heading for o > 0) */
    const shift = (pts, o) => pts.map((p, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1; return [p[0] - dz / l * o, p[1] + dx / l * o]; });

    const TT = TYPES.slice(); TT.pickType = typeOf; TT.pickPaint = r => pick(PAINT, r);
    const TR = Traffic(TT), phys = engine.physics; X.traffic = TR;
    let NET = { nodes: [], ways: [] }, parked = [], lastBucket = null, carBodies = [], parkBodies = [];
    function clear() { parts.forEach(p => { p.e.destroy(); if (p.mesh) p.mesh.dispose(); if (p.ib) p.ib.dispose(); }); parts = []; parked = []; TR.cars.length = 0; if (fleet) fleet.forEach(f => Object.values(f.sets).forEach(ib => ib.clear())); lastBucket = null;
      carBodies.concat(parkBodies).forEach(b => phys.remove(b)); carBodies = []; parkBodies = []; }
    /* ---------- everything that is built once per street map ---------- */
    X.build = (roads, parent, o) => {
      if (!group) group = scene.createEntity('Street life (generated)', { parent, transient: true }); clear(); NET = network(roads); TR.setNetwork(NET); if (!o.life) { group.setActive(false); return; } group.setActive(true);
      const Sd = new MeshBuilder({ aux: true }), Pt = new MeshBuilder(), CX = [0, 0, 0, K.LAYER.concrete], AX = [CX, CX, CX, CX], white = K.hexRGB('#e6e4dc'), yel = K.hexRGB('#d9a92e'), p = [0, 0, 0, 0], R = SE.rng(9173);
      const inRange = (x, z, r) => Math.hypot(x - o.center[0], z - o.center[1]) < (r || 360), blocked = o.blocked || (() => false);
      const park = (x, z, yaw, ty) => { if (parked.length >= 1100) return; parked.push({ x, z, yaw, ty: ty == null ? typeOf(R()) : ty, col: pick(PAINT, R()) }); };
      NET.ways.forEach(w => { if (!w || !w.drive) return;
        /* the stretches between crossings */
        const cuts = w.nodes.map(c => [c.d - c.l.rm - 3.2, c.d + c.l.rp + 3.2]); let d = 0; const spans = []; cuts.forEach(([a, b]) => { if (a - d > 3) spans.push([d, a]); d = Math.max(d, b); }); if (w.len - d > 3) spans.push([d, w.len]);
        spans.forEach(([d0, d1]) => { const line = piece(w, d0, d1);
          [1, -1].forEach(sd => { const inner = shift(line, sd * (w.hw + 0.12)), outer = shift(line, sd * (w.hw + 2.0)), y0 = 0.085, y1 = 0.2;
            for (let i = 0; i + 1 < line.length; i++) { const a = [inner[i][0], y1, inner[i][1]], b = [inner[i + 1][0], y1, inner[i + 1][1]], c = [outer[i + 1][0], y1, outer[i + 1][1]], e = [outer[i][0], y1, outer[i][1]], uv = q => [q[0] / 3, q[2] / 3];
              Sd.quad(a, b, c, e, [0, 1, 0], [uv(a), uv(b), uv(c), uv(e)], K.WHITE, AX); const nx = (inner[i][0] - outer[i][0]), nz = (inner[i][1] - outer[i][1]), nl = Math.hypot(nx, nz) || 1;
              Sd.quad([a[0], y0, a[2]], [b[0], y0, b[2]], b, a, [nx / nl, 0, nz / nl], [[0, 0], [1, 0], [1, 0.05], [0, 0.05]], [0.86, 0.86, 0.86, 1], AX); } });
          if (w.r.kind === 'major') { K.ribbon(Pt, line, 0.11, 0.115, null, 0.12, yel); K.ribbon(Pt, line, 0.11, 0.115, null, -0.12, yel); for (let s = d0 + 2; s + 3 < d1; s += 9) { [3.05, -3.05].forEach(o2 => K.ribbon(Pt, shift(piece(w, s, s + 3), o2), 0.11, 0.115, null, 0, white)); } }
          /* cars at the curb: on one side of a residential street (the lanes are laid out to leave them room), in runs with gaps */
          if (w.r.kind === 'street' && d1 - d0 > 14) { const sd = w.ps || 1; let s = d0 + 5 + R() * 8; while (s < d1 - 6) { at(w, s, p); if (R() < 0.42 && inRange(p[0], p[1])) { const rt = right(p[2], p[3]), ty = typeOf(R()); park(p[0] + rt[0] * sd * (w.hw - 1.1), p[1] + rt[1] * sd * (w.hw - 1.1), Math.atan2(p[2] * sd, p[3] * sd) + (R() - 0.5) * 0.04, ty); s += TYPES[ty].L + 0.9 + R() * 1.6; } else s += 6 + R() * 16; } }
        }); });
      /* car parks and driveways: along a parking aisle, rows of stalls nose in on both sides; on a driveway, a car or two */
      roads.forEach(r => { if (r.kind !== 'drive' || r.pts.length < 2) return; let len = 0; for (let i = 1; i < r.pts.length; i++) len += Math.hypot(r.pts[i][0] - r.pts[i - 1][0], r.pts[i][1] - r.pts[i - 1][1]);
        const nearDrive = (x, z) => NET.ways.some(w => w && w.drive && w.r.pts.some((q, i) => { if (!i) return false; const a = w.r.pts[i - 1], dx = q[0] - a[0], dz = q[1] - a[1], l2 = dx * dx + dz * dz || 1, t = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / l2, 0, 1); return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t) < w.hw + 2.6; }));
        let acc = 0; for (let i = 1; i < r.pts.length; i++) { const a = r.pts[i - 1], b = r.pts[i], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz); if (l < 1) continue; const hx = dx / l, hz = dz / l, rt = right(hx, hz);
          if (len < 26) { if (i === 1 && R() < 0.55 && l > 7 && inRange(a[0], a[1], 300)) { const t = 0.55 + R() * 0.2, x = a[0] + dx * t, z = a[1] + dz * t; if (!blocked(x, z) && !nearDrive(x, z)) park(x, z, Math.atan2(hx, hz) + (R() < 0.5 ? Math.PI : 0)); } }
          else for (let s = 3 + ((acc % 2.75) ? 0 : 0); s < l - 3; s += 2.75) [1, -1].forEach(sd => { if (R() > 0.58) return; const x = a[0] + hx * s + rt[0] * sd * 5.7, z = a[1] + hz * s + rt[1] * sd * 5.7; if (!inRange(x, z) || blocked(x, z) || blocked(x + rt[0] * sd * 2, z + rt[1] * sd * 2) || nearDrive(x, z)) return; park(x, z, Math.atan2(rt[0] * sd, rt[1] * sd) + (R() < 0.25 ? Math.PI : 0)); });
          acc += l; } });
      /* crossings: a crosswalk and a stop bar on each driveable approach, signals where a main road is crossed, stop signs elsewhere */
      const sig = { ns: new InstanceBuffer(dev, 16), ew: new InstanceBuffer(dev, 16) }, stops = new InstanceBuffer(dev, 32);
      NET.nodes.forEach(n => { if (!n.cross) return; n.legs.forEach(l => { const w = l.w; if (!w.drive) return; const P = w.r.pts;
        [[l.pi + 1, 1], [l.pi - 1, -1]].forEach(([k, sd]) => { if (k < 0 || k >= P.length || (sd > 0 ? l.shortP : l.shortM)) return; at(w, w.acc[l.pi] + sd * Math.min(9, w.len), p); let dx = p[0] - n.x, dz = p[1] - n.z; const dl = Math.hypot(dx, dz); if (dl < 2) return; dx /= dl; dz /= dl; const rt = right(dx, dz), r0 = (sd > 0 ? l.rp : l.rm) + 0.4, hw = w.hw;
          const bar = (d0, d1, a, b, col) => Pt.quad([n.x + dx * d0 + rt[0] * a, 0.117, n.z + dz * d0 + rt[1] * a], [n.x + dx * d1 + rt[0] * a, 0.117, n.z + dz * d1 + rt[1] * a], [n.x + dx * d1 + rt[0] * b, 0.117, n.z + dz * d1 + rt[1] * b], [n.x + dx * d0 + rt[0] * b, 0.117, n.z + dz * d0 + rt[1] * b], [0, 1, 0], null, col);
          if (n.signal) for (let a = -hw + 0.35; a < hw - 0.5; a += 1.15) bar(r0, r0 + 2.6, a, a + 0.55, white); else { bar(r0, r0 + 0.16, -hw + 0.2, hw - 0.2, white); bar(r0 + 2.3, r0 + 2.46, -hw + 0.2, hw - 0.2, white); }
          bar(r0 + 3.3, r0 + 3.7, -hw + 0.2, -0.1, white);                           /* the stop bar, on the side the traffic comes in on */
          const px = n.x + dx * (r0 + 3.9) - rt[0] * (hw + 0.75), pz = n.z + dz * (r0 + 3.9) - rt[1] * (hw + 0.75), yaw = Math.atan2(dx, dz);
          if (!inRange(px, pz, 700)) return; if (n.signal) sig[TR.phase(n, dx, dz)].add(px, 0, pz, yaw, 1, 1, 1); else stops.add(px, 0, pz, yaw, 1, 1, 1); }); }); });
      const add = (name, mesh, mat, extra) => { const e = scene.createEntity(name, { parent: group, transient: true }), mr = e.add('MeshRenderer'); mr.mesh = mesh; mr.material = mat; mr.pickable = false; mr.castShadow = false; parts.push(Object.assign({ e, mesh }, extra || {})); return mr; };
      if (!Sd.empty) add('Sidewalks and curbs', Sd.build(dev, { name: 'sidewalks', clusters: 320 }), M.side); if (!Pt.empty) add('Crosswalks and lane lines', Pt.build(dev, { name: 'markings', clusters: 320 }), M.paint);
      /* signal and stop sign meshes: built facing +z (toward the traffic they speak to), the mast reaching over the lane */
      if (!X.sigMesh) { const grey = [0.2, 0.21, 0.22, 1], Bd = new MeshBuilder(); const pole = Prim.cylinder(0.11, 0.08, 6.2, 8); for (let i = 1; i < pole.positions.length; i += 3) pole.positions[i] += 3.1; Prim.paint(pole, grey);
        Bd.box(-1.9, 6.0, 0, 2.0, 0.06, 0.06, 0, grey); Bd.box(-3.3, 5.45, 0, 0.19, 0.56, 0.16, 0, [0.07, 0.07, 0.07, 1]); Bd.box(-1.4, 5.45, 0, 0.19, 0.56, 0.16, 0, [0.07, 0.07, 0.07, 1]); X.sigMesh = new Mesh(dev, Prim.merge([pole, Bd.data()], 'signal'));
        const lampM = dy => { const b = new MeshBuilder(); [-3.3, -1.4].forEach(x => b.quad([x - 0.11, 5.45 + dy - 0.11, 0.165], [x + 0.11, 5.45 + dy - 0.11, 0.165], [x + 0.11, 5.45 + dy + 0.11, 0.165], [x - 0.11, 5.45 + dy + 0.11, 0.165], [0, 0, 1])); return b.build(dev, { name: 'signal lamp' }); }; X.lampMesh = { r: lampM(0.36), y: lampM(0), g: lampM(-0.36) };
        const sp = Prim.cylinder(0.035, 0.035, 2.3, 6); for (let i = 1; i < sp.positions.length; i += 3) sp.positions[i] += 1.15; Prim.paint(sp, [0.45, 0.46, 0.47, 1]); const oct = Prim.cylinder(0.38, 0.38, 0.03, 8); Prim.transform(oct, M4.compose(M4.create(), [0, 2.35, 0.03], Q.fromAxisAngle([0, 0, 0, 1], [1, 0, 0], Math.PI / 2), [1, 1, 1])); Prim.paint(oct, [0.72, 0.06, 0.05, 1]); X.stopMesh = new Mesh(dev, Prim.merge([sp, oct], 'stop sign')); }
      const inst = (name, ib, mesh, mat, far) => { if (!ib.count) { ib.dispose(); return; } const e = scene.createEntity(name, { parent: group, transient: true }), r = e.add('InstancedRenderer'); r.instances = ib; r.mesh = mesh; r.material = mat; r.maxDistance = far || 500; r.shadowDistance = 70; parts.push({ e, ib }); return e; };
      ['ns', 'ew'].forEach(ax => { const e = inst('Signals ' + ax, sig[ax], X.sigMesh, M.sign, 600); if (e) ['r', 'y', 'g'].forEach(c => { const r = e.add('InstancedRenderer'); r.instances = sig[ax]; r.mesh = X.lampMesh[c]; r.material = SIG[ax + c]; r.castShadow = false; r.maxDistance = 700; }); });
      inst('Stop signs', stops, X.stopMesh, M.sign, 320);
      /* the traffic: the parked cars are its fixed obstacles; the moving ones are put down on free stretches of lane */
      fleetInit(); parked = TR.setParked(parked); TR.populate(o.cars || 60, 77, [o.center[0], o.center[1], 0, 420]);
      X.stats = { parked: parked.length, cars: TR.cars.length, crossings: NET.nodes.filter(n => n.cross).length, signals: sig.ns.count + sig.ew.count, stops: stops.count };
    };

    /* ---------- every frame: signals change, the traffic takes a step, and the cars are sorted into near and far ---------- */
    const qy = [0, 0, 0, 1], UP = [0, 1, 0];
    /* o: { night, moving, viewer: [x, z] or null (a person standing in the street), reach } */
    X.update = (dt, cam, o) => {
      if (!fleet || !group || !group.active) return false; const night = o.night || 0, reach = o.reach || 330;
      const lum = 14 + 30 * night; ['r', 'y', 'g'].forEach(c => { SIG['ns' + c].emissiveIntensity = TR.ns === c ? lum : 0.05; SIG['ew' + c].emissiveIntensity = TR.ew === c ? lum : 0.05; });
      /* parked cars: near ones whole, far ones coarse; sorted again when the camera has moved a way. The nearest are solid to the physics. */
      if (!lastBucket || Math.hypot(cam[0] - lastBucket[0], cam[2] - lastBucket[1]) > 24 || lastBucket[2] !== reach) { lastBucket = [cam[0], cam[2], reach]; fleet.forEach(f => { f.sets.near.clear(); f.sets.mid.clear(); f.sets.far.clear(); });
        let nNear = 0, nb = 0; for (const c of parked) c.d = Math.hypot(c.x - cam[0], c.z - cam[2]); parked.sort((a, b) => a.d - b.d);
        for (const c of parked) { if (c.d > reach) break; fleet[c.ty].sets[c.d < 42 && nNear++ < 14 ? 'near' : c.d < 150 ? 'mid' : 'far'].add(c.x, 0, c.z, c.yaw, 1, 1, 1, c.col[0], c.col[1], c.col[2], 1);
          if (c.d < 70 && nb < 60) { let b = parkBodies[nb]; const t = TYPES[c.ty]; if (!b) { b = phys.add({ type: 'static', shape: { kind: 'box', h: [1, 0.75, 2.4] } }); parkBodies.push(b); } b.shape.h[0] = t.W / 2; b.shape.h[1] = t.H / 2; b.shape.h[2] = t.L / 2; V3.set(b.pos, c.x, t.H / 2, c.z); Q.fromAxisAngle(b.rot, UP, c.yaw); b.refresh(); nb++; } }
        while (parkBodies.length > nb) phys.remove(parkBodies.pop()); }
      const cars = TR.cars; if (!cars.length) return false; fleet.forEach(f => { f.sets.mnear.clear(); f.sets.mfar.clear(); });
      if (o.moving) {
        TR.viewer = o.viewer || null; TR.bodies.length = 0;
        for (const b of phys.bodies) { if (b.pos[1] - (b.max[1] - b.min[1]) / 2 > 1.6) continue; const r = Math.max(b.max[0] - b.min[0], b.max[2] - b.min[2]) / 2; if (r > 0.12) TR.bodies.push({ x: b.pos[0], z: b.pos[2], hx: 0, hz: 1, hl: r, hw: r, v: 0, static: true }); }
        const n = Math.max(1, Math.min(4, Math.ceil(dt / 0.034))); for (let i = 0; i < n; i++) TR.step(dt / n, [cam[0], cam[2], Math.max(420, reach + 120)]);
      }
      /* each moving car is a box in the physics world too, carrying its speed: what is thrown at it bounces, what it meets is pushed */
      while (carBodies.length < cars.length) carBodies.push(phys.add({ type: 'kinematic', shape: { kind: 'box', h: [1, 0.75, 2.4] } })); while (carBodies.length > cars.length) phys.remove(carBodies.pop());
      for (let i = 0; i < cars.length; i++) { const c = cars[i], t = TYPES[c.ty], b = carBodies[i]; if (c.out) { V3.set(b.pos, 1e6, -50, 1e6); V3.set(b.vel, 0, 0, 0); continue; } b.shape.h[0] = t.W / 2; b.shape.h[1] = t.H / 2; b.shape.h[2] = t.L / 2; V3.set(b.pos, c.x, t.H / 2, c.z); Q.fromAxisAngle(qy, UP, c.yaw); Q.copy(b.rot, qy); V3.set(b.vel, c.hx * c.v, 0, c.hz * c.v);
        const dc = Math.hypot(c.x - cam[0], c.z - cam[2]); fleet[c.ty].sets[dc < 55 ? 'mnear' : 'mfar'].add(c.x, 0, c.z, c.yaw, 1, 1, 1, c.col[0], c.col[1], c.col[2], c.brake === 2 ? 0.5 : c.brake ? 0.75 : 1); }
      return !!o.moving;
    };
    /* the nearest moving cars, for headlights that light the road */
    X.nearCars = (cam, n) => TR.cars.filter(c => !c.out).map(c => [c, Math.hypot(c.x - cam[0], c.z - cam[2])]).filter(a => a[1] < 160).sort((a, b) => a[1] - b[1]).slice(0, n).map(a => a[0]);
    X.setActive = on => { if (group) group.setActive(on); };
    X.network = network;
    return X;
  }
  SE.StreetKit = StreetKit;

  /* ==== rooftop scout on the engine: cars ==== */
  /* Five bodies cut to the measurements of the kinds of vehicle that fill Dallas Fort Worth's streets: the full-size crew cab
     pickup, the full-size SUV (the class built at Arlington), the midsize sedan, the compact crossover and the electric
     crossover. No make's badge or grille is copied: each is its class's length, width, height, wheelbase, overhangs,
     beltline and glass, lofted as one smooth skin (a few thousand triangles up close), and everything fine is drawn by the
     shader on that skin, crisp at any distance: the glass and its pillars, wheel arches, door cuts and handles, the grille,
     head and tail lamps (lit after dark), bumpers, plates, and alloy wheels in rubber tyres. */
  CHUNKS.carpaint = `
uniform vec4 u_carA, u_carB, u_carC, u_carD, u_carE;
float cline(float v, float at, float w) { return 1.0 - smoothstep(w, w + fwidth(v) * 1.5, abs(v - at)); }
void carPaint(inout Surface s, inout vec4 base, inout vec3 N) {
  float zone = floor(v_aux.w + 0.5), L2 = u_carA.x * 0.5, W2 = u_carA.y * 0.5, gc = u_carA.z, rw = u_carA.w, style = u_carD.x, H = u_carE.x, hn = u_carE.z, hd = u_carE.w;
  bool truck = style > 2.5 && style < 3.5, suv = style > 1.5 && style < 2.5, cuv = style > 0.5 && style < 1.5, ev = style > 3.5, tall = truck || suv;
  vec3 p = v_aux.xyz, paint = base.rgb, glassC = vec3(0.028, 0.033, 0.038), plastic = vec3(0.022), chrome = vec3(0.62, 0.63, 0.64), lampOn = vec3(1.0, 0.95, 0.84), red = vec3(0.42, 0.012, 0.01);
  s.roughness = 0.2; s.metallic = 0.3; s.model = 1.0;
  /* the instance's alpha carries what the car is doing: 1 rolling, 0.75 braking, 0.5 stopped after a knock (hazard lamps) */
  float braking = step(v_color.a, 0.9), hazard = step(v_color.a, 0.6) * step(0.5, fract(u_time * 1.4));
  if (zone > 4.5) { base.rgb = vec3(0.01); s.roughness = 0.95; s.metallic = 0.0; return; }                                   /* the underside */
  if (zone > 3.5) return;                                                                                                   /* mirrors: paint */
  if (zone > 2.5) {                                                                                                         /* a wheel */
    float r = length(v_uv), th = atan(v_uv.y, v_uv.x) + u_time * u_carD.w, n = tall ? 6.0 : 5.0; s.metallic = 0.0;
    if (r > 0.735) { base.rgb = vec3(0.016); s.roughness = 0.88; if (r > 0.97) base.rgb *= 0.8 + 0.4 * step(0.5, fract(th * 28.0 / 6.2831853)); return; }
    float k = abs(fract(th * n / 6.2831853) - 0.5) * 6.2831853 / n * max(r, 0.12), spoke = step(k, mix(0.085, 0.16, r / 0.7));
    if (r > 0.69 || r < 0.16 || spoke > 0.5) { base.rgb = tall ? vec3(0.34, 0.35, 0.36) : vec3(0.6, 0.61, 0.62); s.metallic = 1.0; s.roughness = 0.3; if (r < 0.07) base.rgb = vec3(0.05); }
    else { base.rgb = vec3(0.03, 0.03, 0.032) + 0.1 * step(r, 0.52) * step(0.2, r); s.roughness = 0.5; }
    return; }
  if (zone > 0.5) {                                                                                                         /* the two faces: nose (1) and tail (2) */
    float x = abs(v_uv.x), y = v_uv.y;
    if (zone < 1.5) {
      float y1 = hn - 0.035, y0 = tall ? hn - 0.33 : hn - 0.17; bool lamp = y > y0 && y < y1 && x > W2 * (tall ? 0.6 : 0.5) && x < W2 - 0.07;
      bool grille = ev ? false : tall ? (y > gc + 0.44 && y < hn - 0.06 && x < W2 * 0.57) : (y > hn - 0.2 && y < hn - 0.05 && x < W2 * 0.47);
      bool intake = y > gc + 0.1 && y < gc + (tall ? 0.3 : 0.33) && x < W2 * (ev ? 0.55 : 0.72), plate = abs(y - (gc + (tall ? 0.36 : 0.42))) < 0.075 && x < 0.155;
      if (lamp) { base.rgb = vec3(0.7); s.metallic = 0.95; s.roughness = 0.14; s.emissive += lampOn * (0.25 + 26.0 * u_night) * (0.55 + 0.45 * step(0.5, fract(x * 9.0))) + vec3(1.0, 0.45, 0.02) * (9.0 * hazard * step(W2 - 0.3, x)); if (y < y0 + 0.028) s.emissive += lampOn * 2.5; return; }
      if (plate && !lamp) { base.rgb = vec3(0.78, 0.79, 0.8) * (0.75 + 0.25 * step(0.45, vnoise(vec2(v_uv.x * 60.0, y * 26.0)))); s.metallic = 0.0; s.roughness = 0.4; return; }
      if (grille) { float bx = tall ? min(min(y - (gc + 0.44), hn - 0.06 - y), W2 * 0.57 - x) : 1.0; if (bx < 0.03) { base.rgb = chrome; s.metallic = 1.0; s.roughness = 0.16; return; }
        float slat = tall ? step(0.72, fract(y * 9.0)) + step(0.9, fract(v_uv.x * 14.0)) * 0.6 : step(0.62, fract(y * 30.0)); base.rgb = mix(vec3(0.012), tall ? vec3(0.09) : vec3(0.05), min(slat, 1.0)); s.metallic = 0.3; s.roughness = 0.42; if (tall && abs(y - (gc + 0.44 + hn - 0.06) * 0.5) < 0.035) { base.rgb = chrome; s.metallic = 1.0; s.roughness = 0.16; } return; }
      if (intake) { base.rgb = vec3(0.012); s.metallic = 0.0; s.roughness = 0.7; return; }
      if (truck && y > gc + 0.2 && y < gc + 0.44) { base.rgb = chrome; s.metallic = 1.0; s.roughness = 0.17; return; }
      if ((cuv || suv) && y < gc + 0.3) { base.rgb = plastic; s.metallic = 0.0; s.roughness = 0.62; }
      return; }
    bool upright = tall || cuv; float ty1 = upright ? u_carC.z + 0.1 : hd - 0.035, ty0 = upright ? u_carC.z - 0.36 : hd - 0.17;
    bool lampR = upright ? (x > W2 - 0.2 && x < W2 - 0.045 && y > ty0 && y < ty1) : (y > ty0 && y < ty1 && x > W2 * (ev ? 0.3 : 0.42) && x < W2 - 0.05);
    if (lampR) { base.rgb = red; s.metallic = 0.0; s.roughness = 0.2; s.emissive += vec3(1.0, 0.04, 0.02) * (0.22 + 6.5 * u_night + 5.0 * braking) * (0.6 + 0.4 * step(0.4, fract(y * 22.0))) + vec3(1.0, 0.45, 0.02) * (9.0 * hazard); return; }
    if ((suv || cuv) && y > u_carC.z + 0.09 && y < H - 0.2 && x < W2 - 0.3) { base.rgb = glassC; s.model = 3.0; s.roughness = 0.05; s.metallic = 0.0; return; }
    if (abs(y - (upright ? gc + 0.62 : hd - 0.33)) < 0.075 && x < 0.155) { base.rgb = vec3(0.78, 0.79, 0.8) * (0.75 + 0.25 * step(0.45, vnoise(vec2(v_uv.x * 60.0, y * 26.0)))); s.metallic = 0.0; s.roughness = 0.4; return; }
    if (truck) { if (y > gc + 0.16 && y < gc + 0.4) { base.rgb = chrome; s.metallic = 1.0; s.roughness = 0.17; return; } if (abs(y - (hd - 0.1)) < 0.03 && x < 0.13) { base.rgb = plastic; s.metallic = 0.0; s.roughness = 0.5; return; } base.rgb *= 1.0 - 0.55 * cline(x, W2 - 0.16, 0.004); return; }
    if (y < gc + 0.32 && (suv || cuv)) { base.rgb = plastic; s.metallic = 0.0; s.roughness = 0.62; }
    return; }
  /* the skin: along it z (metres from the middle), round it a (0 on the centre line of the roof, 0.6 at the shoulder, 1 at the sill) */
  float z = v_uv.x, a = abs(v_uv.y), zc0 = u_carB.x, zc1 = u_carB.y, zc2 = u_carB.z, zc3 = u_carB.w, zaF = u_carC.x, zaR = u_carC.y, zB = u_carD.y, zC = u_carD.z;
  float dF = length(vec2(z - zaF, p.y - rw)), dR = length(vec2(z - zaR, p.y - rw)), dw = min(dF, dR);
  if (a > 0.6 && dw < rw + 0.075) { base.rgb = vec3(0.008); s.roughness = 0.95; s.metallic = 0.0; return; }                  /* wheel wells */
  if ((tall || cuv) && a > 0.6 && (dw < rw + 0.125 || a > 0.945)) { base.rgb = plastic; s.roughness = 0.62; s.metallic = 0.0; return; }   /* cladding round the arches and along the sills */
  float gt = clamp((a - 0.455) / 0.137, 0.0, 1.0), zf = mix(zc2 - 0.05, zc3 - 0.11, gt), zr = mix(zc1 + 0.05, zc0 + 0.11, gt);
  bool side = a > 0.462 && a < 0.586 && z > zr && z < zf, pillar = abs(z - zB) < 0.05 || (zC > -50.0 && abs(z - zC) < 0.06);
  bool wind = a < 0.345 && z > zc2 + 0.05 && z < zc3 - 0.07, back = !truck && a < 0.345 && z > zc0 + 0.07 && z < zc1 - 0.05, cabBack = truck && a < 0.33 && z > zc0 - 0.02 && z < zc1 && p.y > u_carC.w + 0.12;
  bool roofGlass = ev && a < 0.29 && z > zc1 - 0.02 && z < zc2 + 0.02;
  if ((side && !pillar) || wind || back || cabBack || roofGlass) { base.rgb = glassC; s.model = 3.0; s.roughness = 0.045; s.metallic = 0.0; s.emissive += vec3(0.012, 0.012, 0.011) * (1.0 - u_night); return; }
  if (side && pillar) { base.rgb = vec3(0.014); s.roughness = 0.3; s.metallic = 0.0; return; }                               /* blacked-out pillars between the panes */
  if (a > 0.45 && a < 0.6 && z > zr - 0.03 && z < zf + 0.03 && !(a > 0.462 && a < 0.586)) { base.rgb = tall ? chrome * 0.25 : vec3(0.02); s.roughness = 0.3; s.metallic = tall ? 1.0 : 0.0; return; }   /* the frame round the side glass */
  if (truck && a < 0.345 && z < zc0 - 0.1 && z > -L2 + 0.1) { base.rgb = vec3(0.012); s.roughness = 0.85; s.metallic = 0.0; return; }   /* the bed, under its cover */
  /* lamps that wrap round the corners */
  if (z > L2 - (tall ? 0.34 : 0.22) && abs(p.x) > W2 * (tall ? 0.6 : 0.5) && a > 0.5 && p.y > (tall ? hn - 0.33 : hn - 0.17) && p.y < hn - 0.035) { base.rgb = vec3(0.7); s.metallic = 0.95; s.roughness = 0.14; s.emissive += lampOn * (0.25 + 22.0 * u_night); return; }
  { bool upright = tall || cuv; float ty1 = upright ? u_carC.z + 0.1 : hd - 0.035, ty0 = upright ? u_carC.z - 0.36 : hd - 0.17; if (z < -L2 + (upright ? 0.2 : 0.3) && abs(p.x) > W2 * (upright ? 0.78 : ev ? 0.3 : 0.42) && a > 0.5 && p.y > ty0 && p.y < ty1) { base.rgb = red; s.metallic = 0.0; s.roughness = 0.2; s.emissive += vec3(1.0, 0.04, 0.02) * (0.22 + 6.5 * u_night + 5.0 * braking) + vec3(1.0, 0.45, 0.02) * (9.0 * hazard); return; } }
  /* cuts between the panels, and the handles */
  float zD1 = zaF - rw - 0.2, zD3 = max(zaR + (truck ? rw + 0.16 : 0.2), zc0 + 0.18), cut = 0.0;
  if (a > 0.6 && a < 0.945) { cut = max(cline(z, zD1, 0.004), max(cline(z, zB, 0.004), cline(z, zD3, 0.004))); if (truck) cut = max(cut, cline(z, zc0 - 0.06, 0.005)); }
  if (a < 0.6) cut = max(cut, cline(z, zc3 + 0.015, 0.005) * step(a, 0.5));
  cut = max(cut, cline(a, 0.5, 0.0035) * step(zc3, z) * step(z, L2 - 0.2));
  base.rgb = mix(paint, vec3(0.01), cut * 0.85);
  if (a > 0.622 && a < 0.648 && ((z > zB + 0.07 && z < zB + 0.25) || (z > zD3 + 0.07 && z < zD3 + 0.25))) { base.rgb = tall ? chrome : paint * 0.55; s.metallic = tall ? 1.0 : 0.5; s.roughness = 0.2; }
  N = normalize(N + vec3(0.0, 0.16 * cline(a, 0.67, 0.012), 0.0));                                                             /* a crease along the flank catches the light */
}`;

  function CarKit(engine, K) {
    const dev = engine.device, C = {};
    /* cab: where the glass starts and ends along the car (rear glass foot, rear of roof, front of roof, windscreen foot), metres from the middle */
    C.types = [
      { name: 'Midsize sedan', style: 0, L: 4.88, W: 1.84, H: 1.445, wb: 2.825, fo: 0.97, gc: 0.15, rw: 0.335, tw: 0.225, hbF: 0.93, hbR: 0.99, hc: 0.985, hn: 0.74, hd: 1.045, cab: [-1.78, -0.92, 0.2, 1.0], zB: -0.02, zC: -99, tumble: 0.2, crown: 0.045, pf: 0.05, pr: 0.04, rf: 0.5, rr: 0.42, share: 0.24 , soft: 0.11},
      { name: 'Compact crossover', style: 1, L: 4.6, W: 1.855, H: 1.69, wb: 2.69, fo: 0.92, gc: 0.2, rw: 0.36, tw: 0.235, hbF: 1.05, hbR: 1.13, hc: 1.12, hn: 0.93, hd: 1.2, cab: [-2.22, -1.82, 0.2, 0.95], zB: -0.05, zC: -1.02, tumble: 0.17, crown: 0.03, pf: 0.04, pr: 0.03, rf: 0.42, rr: 0.3, share: 0.24 , soft: 0.09},
      { name: 'Full-size SUV', style: 2, L: 5.35, W: 2.06, H: 1.93, wb: 3.07, fo: 0.98, gc: 0.2, rw: 0.4, tw: 0.275, hbF: 1.27, hbR: 1.33, hc: 1.31, hn: 1.2, hd: 1.4, cab: [-2.6, -2.3, 0.55, 1.17], zB: 0.0, zC: -1.08, tumble: 0.14, crown: 0.025, pf: 0.025, pr: 0.02, rf: 0.3, rr: 0.22, share: 0.14 , soft: 0.06},
      { name: 'Full-size pickup', style: 3, L: 5.89, W: 2.03, H: 1.96, wb: 3.69, fo: 0.96, gc: 0.24, rw: 0.42, tw: 0.285, hbF: 1.3, hbR: 1.36, hc: 1.33, hn: 1.24, hd: 1.4, cab: [-0.82, -0.72, 0.76, 1.42], zB: 0.1, zC: -99, tumble: 0.14, crown: 0.025, pf: 0.02, pr: 0.01, rf: 0.26, rr: 0.14, share: 0.28 , soft: 0.05},
      { name: 'Electric crossover', style: 4, L: 4.75, W: 1.92, H: 1.624, wb: 2.89, fo: 0.88, gc: 0.167, rw: 0.355, tw: 0.245, hbF: 1.0, hbR: 1.12, hc: 1.05, hn: 0.77, hd: 1.22, cab: [-2.18, -1.05, 0.15, 1.02], zB: -0.05, zC: -99, tumble: 0.2, crown: 0.05, pf: 0.05, pr: 0.04, rf: 0.55, rr: 0.42, share: 0.1 , soft: 0.13},
    ];
    /* one body at one fineness: q = { dz, dzw (near the wheels), nL, nG, nR, seg, out (wheels set out past the skin, for coarse levels that carve no arches) } */
    function build(t, q) {
      const L2 = t.L / 2, W2 = t.W / 2, [zc0, zc1, zc2, zc3] = t.cab, zaF = L2 - t.fo, zaR = zaF - t.wb, deck = t.hd, sm = smoothstep;
      const topRaw = z => { let y; if (z <= zc0) y = deck - 0.05 * sm(-L2 + 0.5, -L2, z); else if (z < zc1) y = deck + (t.H - deck) * sm(zc0, zc1, z); else if (z <= zc2) y = t.H + t.crown * 0.6 * Math.sin((z - zc1) / (zc2 - zc1) * Math.PI) - t.crown * 0.6; else if (z < zc3) y = t.H + (t.hc - t.H) * (0.25 * sm(zc2, zc3, z) + 0.75 * (z - zc2) / (zc3 - zc2)); else y = t.hc + (t.hn - t.hc) * Math.pow((z - zc3) / (L2 - zc3), 1.5); return y; };
      /* the roof line eased through its corners (a windscreen runs into a roof on a radius, not at a point), then rolled off at the nose and tail */
      const sd = t.soft, top = z => { const zz = clamp(z, -L2, L2); return (topRaw(zz - 2 * sd) + 2 * topRaw(zz - sd) + 3 * topRaw(zz) + 2 * topRaw(zz + sd) + topRaw(zz + 2 * sd)) / 9 - 0.09 * Math.pow(clamp((Math.abs(z) - (L2 - 0.2)) / 0.2, 0, 1), 2); };
      const belt = z => Math.min(lerp(t.hbR, t.hbF, (z + L2) / t.L), top(z) - 0.035);
      /* seen from above: sides that draw in a little toward the ends, and corners on a true radius */
      const plan = z => { const rc = z > 0 ? t.rf : t.rr, d = Math.abs(z) - (L2 - rc), taper = (z > 0 ? t.pf : t.pr) * Math.pow(clamp((Math.abs(z) - L2 * 0.45) / (L2 * 0.55), 0, 1), 2); return 1 - taper - (d > 0 ? (rc - Math.sqrt(Math.max(0, rc * rc - d * d))) / W2 : 0); };
      const Zs = []; for (let z = -L2; z < L2 - 1e-6; z += q.dz) Zs.push(z); [zc0, zc1, zc2, zc3, zc0 - 0.04, zc3 + 0.04].forEach(z => Zs.push(z)); [[L2, t.rf, 1], [-L2, t.rr, -1]].forEach(([e, rc, sg]) => { const n = q.dzw ? 9 : 4; for (let k = 0; k <= n; k++) Zs.push(e - sg * rc * (1 - Math.cos(k / n * Math.PI / 2))); });
      if (q.dzw) [zaF, zaR].forEach(za => { for (let z = za - t.rw - 0.16; z <= za + t.rw + 0.16; z += q.dzw) Zs.push(z); });
      Zs.sort((a, b) => a - b); const Z = []; Zs.forEach(z => { z = clamp(z, -L2, L2); if (!Z.length || z - Z[Z.length - 1] > 0.014) Z.push(z); });
      /* half a section, from the sill (s = 1) up and over to the centre line (s = 0): [x, y, s] */
      const section = z => { const hw = W2 * plan(z), yt = top(z), yb = belt(z), cab = sm(0.1, 0.32, yt - yb), ins = t.tumble * cab, e = clamp((Math.abs(z) - (L2 - 0.5)) / 0.5, 0, 1), gc = t.gc + 0.13 * e * e, o = [[hw - 0.08, gc, 1], [hw - 0.022, gc + 0.065, 0.965]];
        for (let k = 1; k <= q.nL; k++) { const f = k / q.nL; o.push([hw - 0.034 + 0.034 * Math.pow(Math.sin(Math.PI * Math.min(1, f * 0.93 + 0.07)), 0.7), lerp(gc + 0.065, yb, f), lerp(0.965, 0.6, f)]); }
        const x1 = hw - 0.03 - ins, y1 = Math.max(yb + 0.012, yt - 0.085 * cab - 0.012); for (let k = 1; k <= q.nG; k++) { const f = k / q.nG; o.push([lerp(hw - 0.03, x1, f) + 0.012 * Math.sin(Math.PI * f) * cab, lerp(yb + 0.012, y1, f), lerp(0.6, 0.455, f)]); }
        o.push([x1 - 0.035, Math.max(y1, yt - 0.04 * cab - 0.006), 0.42]); const x2 = x1 - 0.11; o.push([x2, yt - 0.008, 0.38]);
        for (let k = 1; k <= q.nR; k++) { const f = k / q.nR, x = x2 * (1 - f); o.push([x, yt + t.crown * (1 - (x / x2) * (x / x2)) - 0.008 * (1 - f), 0.38 * (1 - f)]); }
        return o; };
      const half = Z.map(section), m = half[0].length, NR = Z.length, P = [], Nn = [], U = [], A = [], I = [], V = [0, 0, 0];
      const pos = (i, j) => { const h = half[clamp(i, 0, NR - 1)][clamp(j, 0, m - 1)]; return [h[0], h[1], Z[clamp(i, 0, NR - 1)]]; };
      const ring = 2 * m - 1, vi = (i, k) => i * ring + k;   /* k: 0 the left sill ... m - 1 the centre ... 2m - 2 the right sill */
      for (let i = 0; i < NR; i++) for (let k = 0; k < ring; k++) { const j = k < m ? k : 2 * m - 2 - k, sg = k < m ? -1 : 1, h = half[i][j], a = pos(i - 1, j), b = pos(i + 1, j), c = pos(i, j - 1), d = pos(i, j + 1);
          const n = V3.cross(V, [b[0] - a[0], b[1] - a[1], b[2] - a[2]], [d[0] - c[0], d[1] - c[1], d[2] - c[2]]); let l = Math.hypot(n[0], n[1], n[2]) || 1, nx = n[0] / l, ny = n[1] / l, nz = n[2] / l; if (nx * h[0] + ny * (h[1] - 0.7) < 0) { nx = -nx; ny = -ny; nz = -nz; } if (j === m - 1) nx = 0;
          let x = h[0]; const y = h[1], z = Z[i];
          if (q.dzw && h[2] >= 0.6) for (const za of [zaF, zaR]) if (Math.hypot(z - za, y - t.rw) < t.rw + 0.04) x = Math.min(x, W2 - t.tw - 0.1);   /* the arch, cut in for the wheel */
          P.push(sg * x, y, z); Nn.push(sg * nx, ny, nz); U.push(z, sg * h[2]); A.push(sg * h[0], y, z, 0); }
      for (let i = 0; i + 1 < NR; i++) for (let k = 0; k + 1 < ring; k++) I.push(vi(i, k), vi(i + 1, k), vi(i + 1, k + 1), vi(i, k), vi(i + 1, k + 1), vi(i, k + 1));
      /* the two faces, flat fans over the end rings: the shader draws the grille, lamps, bumper and plate on them */
      [[NR - 1, 1, 1], [0, 2, -1]].forEach(([i, zone, nz]) => { const z = Z[i], c0 = P.length / 3, yc = (half[i][0][1] + half[i][m - 1][1]) / 2; P.push(0, yc, z); Nn.push(0, 0, nz); U.push(0, yc); A.push(0, yc, z, zone);
        for (let k = 0; k < ring; k++) { const j = k < m ? k : 2 * m - 2 - k, sg = k < m ? -1 : 1, h = half[i][j]; P.push(sg * h[0], h[1], z); Nn.push(0, 0, nz); U.push(sg * h[0], h[1]); A.push(sg * h[0], h[1], z, zone); }
        for (let k = 0; k + 1 < ring; k++) I.push(c0, c0 + 1 + k, c0 + 2 + k); I.push(c0, c0 + ring, c0 + 1); });
      const quad = (a, b, c, d, n, zone) => { const c0 = P.length / 3; [a, b, c, d].forEach(p => { P.push(p[0], p[1], p[2]); Nn.push(n[0], n[1], n[2]); U.push(0, 0); A.push(p[0], p[1], p[2], zone); }); I.push(c0, c0 + 1, c0 + 2, c0, c0 + 2, c0 + 3); };
      quad([-W2 + 0.1, t.gc + 0.03, -L2 + 0.2], [W2 - 0.1, t.gc + 0.03, -L2 + 0.2], [W2 - 0.1, t.gc + 0.03, L2 - 0.2], [-W2 + 0.1, t.gc + 0.03, L2 - 0.2], [0, -1, 0], 5);
      /* door mirrors */
      [-1, 1].forEach(sg => { const mx = sg * (W2 * plan(zc3 - 0.3) + 0.075), my = belt(zc3 - 0.3) + 0.075, mz = zc3 - 0.33, hx = 0.085, hy = 0.06, hz = 0.05, cnr = (a, b, c) => [mx + a * hx, my + b * hy, mz + c * hz];
        quad(cnr(-1, -1, 1), cnr(1, -1, 1), cnr(1, 1, 1), cnr(-1, 1, 1), [0, 0, 1], 4); quad(cnr(-1, -1, -1), cnr(1, -1, -1), cnr(1, 1, -1), cnr(-1, 1, -1), [0, 0, -1], 5); quad(cnr(-1, 1, -1), cnr(1, 1, -1), cnr(1, 1, 1), cnr(-1, 1, 1), [0, 1, 0], 4); quad(cnr(-1, -1, -1), cnr(1, -1, -1), cnr(1, -1, 1), cnr(-1, -1, 1), [0, -1, 0], 4); quad(cnr(sg, -1, -1), cnr(sg, 1, -1), cnr(sg, 1, 1), cnr(sg, -1, 1), [sg, 0, 0], 4); });
      /* wheels: a tyre and the face of a rim, turned about the axle; the shader draws the spokes */
      const prof = [[0, -0.03], [0.5, -0.04], [0.7, -0.012], [0.74, 0], [0.9, 0.004], [1, -0.035], [1, -t.tw]];
      [[1, zaF], [-1, zaF], [1, zaR], [-1, zaR]].forEach(([sg, za]) => { const cx = W2 - 0.012 + (q.out || 0), c0 = P.length / 3, seg = q.seg;
        for (let s2 = 0; s2 <= seg; s2++) { const th = s2 / seg * TAU, cs = Math.cos(th), sn = Math.sin(th); prof.forEach(([r, xo], pi) => { const face = pi < 5, rr = r * t.rw; P.push(sg * (cx + xo), t.rw + cs * rr, za + sn * rr); if (face) Nn.push(sg * (pi === 4 ? 0.8 : 1), cs * (pi === 4 ? 0.6 : 0), sn * (pi === 4 ? 0.6 : 0)); else Nn.push(pi === 5 ? sg * 0.5 : 0, cs, sn); U.push(cs * r * (pi > 4 ? 1.02 : 1), sn * r * (pi > 4 ? 1.02 : 1)); A.push(sg * (cx + xo), t.rw + cs * rr, za + sn * rr, 3); }); }
        const np = prof.length; for (let s2 = 0; s2 < seg; s2++) for (let pi = 0; pi + 1 < np; pi++) { const a = c0 + s2 * np + pi, b = a + np; I.push(a, b, b + 1, a, b + 1, a + 1); } });
      /* every triangle wound to face the way its normals point */
      for (let k = 0; k < I.length; k += 3) { const a = I[k] * 3, b = I[k + 1] * 3, c = I[k + 2] * 3, ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
        if ((uy * vz - uz * vy) * (Nn[a] + Nn[b] + Nn[c]) + (uz * vx - ux * vz) * (Nn[a + 1] + Nn[b + 1] + Nn[c + 1]) + (ux * vy - uy * vx) * (Nn[a + 2] + Nn[b + 2] + Nn[c + 2]) < 0) { const x = I[k + 1]; I[k + 1] = I[k + 2]; I[k + 2] = x; } }
      const nv = P.length / 3, col = new Uint8Array(nv * 4).fill(255);
      return new Mesh(dev, { name: t.name, positions: new Float32Array(P), normals: new Float32Array(Nn), uvs: new Float32Array(U), colors: col, aux: new Float32Array(A), indices: nv > 65535 ? new Uint32Array(I) : new Uint16Array(I) });
    }
    const made = new Map();
    /* a kind's meshes (fine, middling, coarse) and its two materials (standing, and rolling with its wheels turning) */
    C.get = i => { let v = made.get(i); if (v) return v; const t = C.types[i], L2 = t.L / 2, zaF = L2 - t.fo;
      const params = spin => ({ u_carA: [t.L, t.W, t.gc, t.rw], u_carB: t.cab, u_carC: [zaF, zaF - t.wb, t.hbR, t.hd], u_carD: [t.style, t.zB, t.zC, spin], u_carE: [t.H, t.hc, t.hn, t.hd] });
      const mat = spin => { const m = new Material({ name: t.name + (spin ? ' (moving)' : ''), vertexColors: true, roughness: 0.23, metallic: 0.5, wet: 0, params: params(spin) }); m.car = true; return m; };
      v = { t, fine: build(t, { dz: 0.14, dzw: 0.06, nL: 9, nG: 3, nR: 4, seg: 20 }), mid: build(t, { dz: 0.3, dzw: 0, nL: 4, nG: 2, nR: 2, seg: 12, out: 0.03 }), far: build(t, { dz: 0.8, dzw: 0, nL: 2, nG: 1, nR: 1, seg: 6, out: 0.03 }), still: mat(0), rolling: mat(7) }; made.set(i, v); return v; };
    C.pick = r => { let a = 0; for (let i = 0; i < C.types.length; i++) { a += C.types[i].share; if (r <= a) return i; } return 0; };
    return C;
  }
  SE.CarKit = CarKit;

  /* ==== rooftop scout on the engine: traffic that obeys physics and the rules of the road ==== */
  /* Every car is a rigid box with a length, a width, a mass and a speed. It follows a route made of lane stretches and
     curves through crossings; its speed comes from a car-following law (the Intelligent Driver Model: accelerate toward the
     speed the road allows, brake by the gap and the closing speed to whatever is ahead); what is ahead is found by sweeping
     the car's own box along its route against every other box near it: moving cars, parked cars, the person standing in
     the street, a crate thrown into the road. Crossings are entered one movement at a time unless two movements cannot
     touch: signals give the turn where a main road is crossed, first come first served at stop signs, and nobody enters
     a crossing they cannot leave. If two boxes ever do overlap (something was dropped on a car, a car was pushed), they
     are separated along the axis of least overlap, both stop, and their hazard lamps flash before they go on.
     No two cars' boxes overlap: test/traffic.js runs ten simulated minutes and counts. */
  function Traffic(types) {
    const T = { cars: [], parked: [], nodes: [], ways: [], time: 0, sigT: 0, ns: 'g', ew: 'r', events: { contacts: 0, tows: 0, maxPen: 0 }, viewer: null, bodies: [] };
    const right = (hx, hz) => [-hz, hx], LANE_W = 3.05, CELL = 16, SHORT = 11, hash = (x, z) => (Math.floor(x / CELL) * 73856093) ^ (Math.floor(z / CELL) * 19349663);
    const P4 = [0, 0, 0, 0], Q4 = [0, 0, 0, 0];
    /* a point of a way at arc length d: [x, z, tangent x, tangent z] */
    const at = (w, d, out) => { const A = w.acc, P = w.r.pts; d = clamp(d, 0, w.len); let i = w._i || 1; if (i >= A.length || A[i - 1] > d) i = 1; while (i < A.length - 1 && A[i] < d) i++; w._i = i; const a = P[i - 1], b = P[i], l = A[i] - A[i - 1] || 1, t = (d - A[i - 1]) / l; out[0] = a[0] + (b[0] - a[0]) * t; out[1] = a[1] + (b[1] - a[1]) * t; out[2] = (b[0] - a[0]) / l; out[3] = (b[1] - a[1]) / l; return out; };

    /* ---------- the network: lanes on each way, and what every crossing needs to know ---------- */
    T.setNetwork = (net) => {
      T.nodes = net.nodes; T.ways = net.ways.filter(Boolean);
      T.ways.forEach(w => { if (!w.drive) return; const major = w.r.kind === 'major';
        w.ps = major ? 0 : (hash01('p' + w.ri + ':' + Math.round(w.len)) < 0.5 ? 1 : -1);          /* which side of a street the cars park on */
        w.lanes = major ? { 1: [LANE_W / 2, LANE_W * 1.5], '-1': [-LANE_W / 2, -LANE_W * 1.5] } : w.ps > 0 ? { 1: [w.hw - 2.4 - 1.45], '-1': [w.hw - 2.4 - 4.35] } : { 1: [-(w.hw - 2.4) + 4.35], '-1': [-(w.hw - 2.4) + 1.45] };   /* a street: kerb, 2.4 m of parked cars, two 2.9 m lanes */
        w.limit = major ? 13.4 : 8.9; w.stops = []; });
      T.zones = []; T.nodes.forEach(n => { n.zone = { occ: [], queue: [] }; n.drive = n.legs.filter(l => l.w.drive); n.r = Math.max(n.r || 0, n.hw + 1.2);
        /* a way plans at its two ends and wherever another way meets it; its own bends it simply follows */
        const shared = new Set(n.drive.map(l => l.w)).size > 1 || n.drive.length > 1;
        n.drive.forEach(l => { const end = l.pi === 0 || l.pi === l.w.r.pts.length - 1; if ((shared || end) && !l.w.stops.some(s => s.n === n)) l.w.stops.push({ n, d: l.w.acc[l.pi], l, sbm: (l.rm || n.r) + 2.5, sbp: (l.rp || n.r) + 2.5 }); }); });
      T.ways.forEach(w => { if (w.drive) w.stops.sort((a, b) => a.d - b.d); });
      /* two crossings closer than their own sizes share the ground between them: each is cut back to the middle, and
         crossings with no room for a car to wait between them are taken as one (a car asks for its whole way through) */
      const root = n => { while (n.zp) n = n.zp; return n; };
      T.ways.forEach(w => { if (!w.drive) return; for (let i = 1; i < w.stops.length; i++) { const a = w.stops[i - 1], c = w.stops[i], gap = c.d - a.d, need = a.sbp + c.sbm;
          if (need > gap - 0.4) { const f = Math.max(0, gap - 0.4) / need; a.sbp *= f; c.sbm *= f; a.l.rp = Math.max(0.3, a.sbp - 2.5); c.l.rm = Math.max(0.3, c.sbm - 2.5); }
          if (gap - a.sbp - c.sbm < SHORT) { a.l.shortP = c.l.shortM = true; const ra = root(a.n), rc = root(c.n); if (ra !== rc) rc.zp = ra; } } });
      T.nodes.forEach(n => { const r = root(n); if (r !== n) n.zone = r.zone; }); T.nodes.forEach(n => { delete n.zp; if (!T.zones.includes(n.zone)) T.zones.push(n.zone); });
      /* where a street runs off the edge of the map that was loaded, traffic leaves and enters; a street that just stops inside it is a dead end */
      { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; T.ways.forEach(w => { if (w.drive) w.r.pts.forEach(q => { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); z0 = Math.min(z0, q[1]); z1 = Math.max(z1, q[1]); }); });
        const m = Math.max(45, Math.min(x1 - x0, z1 - z0) * 0.09); T.portals = [];
        T.nodes.forEach(n => { n.portal = false; if (n.drive.length !== 1) return; const l = n.drive[0], end = l.pi === 0 || l.pi === l.w.r.pts.length - 1; if (!end || l.w.len < 40) return; if (n.x < x0 + m || n.x > x1 - m || n.z < z0 + m || n.z > z1 - m) { n.portal = true; T.portals.push({ n, w: l.w, dir: l.pi === 0 ? 1 : -1 }); } }); }
      /* a direction of a way is a dead end if everything beyond its far node is: cars do not wander into a cul-de-sac */
      T.ways.forEach(w => { if (w.drive) w.dead = { 1: false, '-1': false }; });
      const outs = (w, dir) => { const S = w.stops, s = dir > 0 ? S[S.length - 1] : S[0]; if (!s) return []; if (s.n.portal) return null; const o = []; for (const l of s.n.drive) { const last = l.w.r.pts.length - 1; for (const d2 of [1, -1]) { if ((d2 > 0 && l.pi >= last) || (d2 < 0 && l.pi <= 0)) continue; if (l.w === w && d2 === -dir) continue; o.push([l.w, d2]); } } return o; };
      for (let pass = 0, ch = true; ch && pass < 40; pass++) { ch = false; T.ways.forEach(w => { if (!w.drive) return; for (const dir of [1, -1]) { if (w.dead[dir]) continue; const o = outs(w, dir); if (o && o.every(x => x[0].dead[x[1]])) { w.dead[dir] = true; ch = true; } } }); }
      T.driveWays = T.ways.filter(w => w.drive && w.len > 24 && w.stops.length >= 2 && !(w.dead[1] && w.dead[-1]));
      if (!T.driveWays.length) T.driveWays = T.ways.filter(w => w.drive && w.len > 24 && w.stops.length >= 2);
      T.total = T.driveWays.reduce((a, w) => a + w.len, 0);
      T.cars.length = 0; T.pHash = null;
    };
    T.phase = (n, hx, hz) => { if (!n.ax) { let best = null; (n.drive || n.legs.filter(l => l.w.drive)).forEach(l => { if (!best || l.w.hw > best.w.hw) best = l; }); if (best) { at(best.w, best.w.acc[best.pi] + (best.pi > 0 ? -1 : 1) * Math.min(6, best.w.len), P4); const dx = P4[0] - n.x, dz = P4[1] - n.z, dl = Math.hypot(dx, dz) || 1; n.ax = [dx / dl, dz / dl]; } else n.ax = [0, 1]; } return Math.abs(hx * n.ax[0] + hz * n.ax[1]) > 0.7071 ? 'ns' : 'ew'; };
    /* a lane's own line: the way's line moved sideways with mitred corners, so a car does not jump at a bend */
    function laneLine(w, off) { let M = w._ll; if (!M) M = w._ll = new Map(); let L = M.get(off); if (L) return L; const P = w.r.pts, n = P.length; L = [];
      for (let i = 0; i < n; i++) { const a = P[Math.max(0, i - 1)], b = P[i], c2 = P[Math.min(n - 1, i + 1)]; let ax = b[0] - a[0], az = b[1] - a[1], bx = c2[0] - b[0], bz = c2[1] - b[1]; const al = Math.hypot(ax, az), bl = Math.hypot(bx, bz); if (al < 1e-6) { ax = bx; az = bz; } else { ax /= al; az /= al; } if (bl < 1e-6) { bx = ax; bz = az; } else { bx /= bl; bz /= bl; } if (al < 1e-6) { const l2 = Math.hypot(ax, az) || 1; ax /= l2; az /= l2; }
        let mx = -(az + bz), mz = ax + bx; const ml = Math.hypot(mx, mz) || 1; mx /= ml; mz /= ml; const cosH = Math.max(0.55, mx * -az + mz * ax); L.push([b[0] + mx * off / cosH, b[1] + mz * off / cosH]); }
      M.set(off, L); return L; }
    T.setParked = list => {
      const stopsN = T.nodes.filter(n => n.drive && n.drive.length && (n.cross || n.drive.length > 1 || n.drive.some(l => l.pi === 0 || l.pi === l.w.r.pts.length - 1)));
      const ways = T.ways.filter(w => w.drive); ways.forEach(w => { if (w.bb) return; let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; w.r.pts.forEach(q => { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); z0 = Math.min(z0, q[1]); z1 = Math.max(z1, q[1]); }); w.bb = [x0, z0, x1, z1]; });
      list = list.filter(p => { const t = types[p.ty], hl = t.L / 2, hw = t.W / 2, hx = Math.sin(p.yaw), hz = Math.cos(p.yaw);
        for (const n of stopsN) if (Math.hypot(p.x - n.x, p.z - n.z) < n.r + 3 + hl) return false;
        for (const w of ways) { const m = w.hw + 4; if (p.x < w.bb[0] - m || p.x > w.bb[2] + m || p.z < w.bb[1] - m || p.z > w.bb[3] + m) continue;
          const P = w.r.pts; let bd = 1e9, bD = 0; for (let i = 1; i < P.length; i++) { const a = P[i - 1], dx = P[i][0] - a[0], dz = P[i][1] - a[1], l2 = dx * dx + dz * dz || 1, u = clamp(((p.x - a[0]) * dx + (p.z - a[1]) * dz) / l2, 0, 1), d = Math.hypot(p.x - a[0] - dx * u, p.z - a[1] - dz * u); if (d < bd) { bd = d; bD = w.acc[i - 1] + u * Math.sqrt(l2); } }
          if (bd > w.hw + 3.5) continue;
          for (const dir of [1, -1]) for (const off of w.lanes[dir]) for (let d = bD - 9; d <= bD + 9; d += 0.5) { if (d < 0 || d > w.len) continue; lanePointW(w, off, dir, d, P4); if (overlap(P4[0], P4[1], P4[2], P4[3], 3.15, 1.42, p.x, p.z, hx, hz, hl, hw)) return false; } }
        return true; });
      T.parked = list; const H = new Map(); list.forEach(p => { const t = types[p.ty]; p.hl = t.L / 2; p.hw = t.W / 2; p.hx = Math.sin(p.yaw); p.hz = Math.cos(p.yaw); p.v = 0; p.static = true; p.parkedCar = true; const k = hash(p.x, p.z); let c = H.get(k); if (!c) H.set(k, c = []); c.push(p); }); T.pHash = H; return list; };

    /* ---------- routes: lane stretches joined by curves through the crossings ---------- */
const lanePointW = (w, off, dir, d, out) => { const A = w.acc, L = laneLine(w, off); d = clamp(d, 0, w.len); let i = w._i || 1; if (i >= A.length || A[i - 1] > d) i = 1; while (i < A.length - 1 && A[i] < d) i++; w._i = i; const a = L[i - 1], b = L[i], l = A[i] - A[i - 1] || 1, t = (d - A[i - 1]) / l, dx = b[0] - a[0], dz = b[1] - a[1], dl = Math.hypot(dx, dz) || 1; out[0] = a[0] + dx * t; out[1] = a[1] + dz * t; let tx = dx / dl, tz = dz / dl;
      const BL = 3, d0 = d - A[i - 1], d1 = A[i] - d; if (d0 < BL && i > 1) { const q = L[i - 2], qx = a[0] - q[0], qz = a[1] - q[1], ql = Math.hypot(qx, qz) || 1, k = 0.5 * (1 - d0 / BL); tx += (qx / ql - tx) * k; tz += (qz / ql - tz) * k; } else if (d1 < BL && i < L.length - 1) { const q = L[i + 1], qx = q[0] - b[0], qz = q[1] - b[1], ql = Math.hypot(qx, qz) || 1, k = 0.5 * (1 - d1 / BL); tx += (qx / ql - tx) * k; tz += (qz / ql - tz) * k; }
      const tl = Math.hypot(tx, tz) || 1; out[2] = tx / tl * dir; out[3] = tz / tl * dir; return out; };
    const lanePoint = (leg, s, out) => lanePointW(leg.w, leg.off, leg.dir, leg.d0 + leg.dir * s, out);
    const arcPoint = (leg, s, out) => { const A = leg.acc, P = leg.pts; s = clamp(s, 0, leg.len); let i = 1; while (i < A.length - 1 && A[i] < s) i++; const a = P[i - 1], b = P[i], l = A[i] - A[i - 1] || 1, t = (s - A[i - 1]) / l; out[0] = a[0] + (b[0] - a[0]) * t; out[1] = a[1] + (b[1] - a[1]) * t; out[2] = (b[0] - a[0]) / l; out[3] = (b[1] - a[1]) / l; return out; };
    const legPoint = (leg, s, out) => (leg.k ? arcPoint(leg, s, out) : lanePoint(leg, s, out));
    /* the point of a car's route a distance ahead of where it is */
    function ahead(c, dist, out) { let li = c.li, s = c.s + dist; while (li < c.legs.length - 1 && s > c.legs[li].len) { s -= c.legs[li].len; li++; } const leg = c.legs[li]; legPoint(leg, Math.min(s, leg.len), out); out[4] = li; return out; }
    function bezier(p0, h0, p3, h3, k, n) { const p1 = [p0[0] + h0[0] * k, p0[1] + h0[1] * k], p2 = [p3[0] - h3[0] * k, p3[1] - h3[1] * k], pts = [], acc = [0]; for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t, a = u * u * u, b = 3 * u * u * t, c2 = 3 * u * t * t, d = t * t * t; pts.push([a * p0[0] + b * p1[0] + c2 * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c2 * p2[1] + d * p3[1]]); if (i) acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); } return { pts, acc, len: acc[n] }; }
    /* the stretch of lane from just past one node to just before the next one along way w in direction dir */
    function laneLeg(w, dir, off, from) {
      const S = w.stops; let next = null; if (dir > 0) { for (const s of S) if (s.d > from + 0.5) { next = s; break; } } else for (let i = S.length - 1; i >= 0; i--) if (S[i].d < from - 0.5) { next = S[i]; break; }
      const end = next ? next.d - dir * (dir > 0 ? next.sbm : next.sbp) : (dir > 0 ? w.len : 0), d1 = dir > 0 ? Math.max(from + 0.2, end) : Math.min(from - 0.2, end);
      return { k: 0, w, dir, off, d0: from, d1, len: Math.abs(d1 - from), next, limit: w.limit };
    }
    /* at the end of lane leg L: choose the way out of the node ahead, and add the curve through it and the lane after */
    function extendOnce(c) {
      const L = c.legs[c.legs.length - 1], n = L.next ? L.next.n : null; if (!n) { /* nothing ahead (a broken map): turn round */ c.legs.push(laneLeg(L.w, -L.dir, L.w.lanes[-L.dir][0], L.d1)); return null; }
      lanePoint(L, L.len, P4); const p0 = [P4[0], P4[1]], h0 = [P4[2], P4[3]], opts = [];
      for (const l of n.drive) { const last = l.w.r.pts.length - 1; for (const d2 of [1, -1]) { if ((d2 > 0 && l.pi >= last) || (d2 < 0 && l.pi <= 0)) continue; if (l.w === L.w && d2 === -L.dir) continue;
          at(l.w, l.w.acc[l.pi] + d2 * Math.min(6, l.w.len * 0.5), Q4); const hx = Q4[2] * d2, hz = Q4[3] * d2, cr = h0[0] * hz - h0[1] * hx, dt = h0[0] * hx + h0[1] * hz, ang = Math.atan2(cr, dt);   /* > 0 turns right */
          if (Math.abs(ang) > 2.7) continue; opts.push({ w: l.w, dir: d2, pi: l.pi, ang, wt: Math.abs(ang) < 0.6 ? 6 : ang > 0 ? 2.2 : 1.8 }); } }
      /* turn right from the kerb lane and left from the middle one; and not into a street that goes nowhere */
      if (L.w.lanes[L.dir].length > 1) { const keep = opts.filter(o => (c.lane === 1 ? o.ang > -0.6 : o.ang < 0.6)); if (keep.length) { opts.length = 0; keep.forEach(o => opts.push(o)); } }
      { const keep = opts.filter(o => Math.abs(o.ang) < 2.0); if (keep.length && keep.length < opts.length) { opts.length = 0; keep.forEach(o => opts.push(o)); } }
      { const keep = opts.filter(o => !o.w.dead[o.dir]); if (keep.length && keep.length < opts.length) { opts.length = 0; keep.forEach(o => opts.push(o)); } }
      let pick = null; if (opts.length) { let tot = 0; opts.forEach(o => { tot += o.wt; }); let r = c.rnd() * tot; for (const o of opts) { r -= o.wt; if (r <= 0) { pick = o; break; } } pick = pick || opts[0]; }
      if (!pick && n.portal) { L.exit = true; return null; }   /* off the edge of the map */
      if (!pick) {   /* a dead end: turn about in a loop and go back the way it came */
        const w = L.w, off2 = w.lanes[-L.dir][0]; lanePointW(w, off2, -L.dir, L.d1, Q4); const p3 = [Q4[0], Q4[1]], bz = bezier(p0, h0, p3, [-h0[0], -h0[1]], 7.5, 14);
        const ua = mkArc(bz, { n, vmax: 2.6, inW: w, inDir: L.dir, inOff: L.off, uturn: true }); c.legs.push(ua); c.legs.push(laneLeg(w, -L.dir, off2, L.d1)); return ua; }
      const w2 = pick.w, lanes = w2.lanes[pick.dir], li = lanes.length > 1 ? (pick.ang > 0.6 ? 1 : pick.ang < -0.6 ? 0 : Math.min(lanes.length - 1, c.lane || 0)) : 0, off2 = lanes[li], st2 = w2.stops.find(x => x.n === n), from = w2.acc[pick.pi] + pick.dir * (st2 ? (pick.dir > 0 ? st2.sbp : st2.sbm) : n.r + 2.5);
      const next = laneLeg(w2, pick.dir, off2, clamp(from, 0, w2.len)); lanePoint(next, 0, Q4); const p3 = [Q4[0], Q4[1]], h3 = [Q4[2], Q4[3]], gap = Math.hypot(p3[0] - p0[0], p3[1] - p0[1]);
      const bz = bezier(p0, h0, p3, h3, clamp(gap * 0.42, 1, 14), 12), turn = Math.abs(pick.ang), R = turn > 0.15 ? bz.len / turn : 1e3;
      const arc = mkArc(bz, { n, vmax: clamp(Math.sqrt(2.4 * R), 2.8, 14), inW: L.w, inDir: L.dir, inOff: L.off, axis: T.phase(n, h0[0], h0[1]), ang: pick.ang }); c.legs.push(arc); c.lane = li; c.legs.push(next); return arc;
    }
    /* a movement is what a car asks a crossing for: one curve, or the curves through a knot of close crossings with the
       scraps of lane between them. It is held from the first stop line to the end of the last curve. */
    function extend(c) {
      if (c.legs[c.legs.length - 1].exit) return; const first = extendOnce(c); if (!first) return; const arcs = [first], links = [];
      while (arcs.length < 12 && !arcs[arcs.length - 1].uturn) { const lane = c.legs[c.legs.length - 1]; if (lane.k || lane.len >= SHORT || !lane.next) break; const a = extendOnce(c); if (!a) break; links.push(lane); arcs.push(a); }
      const last = arcs[arcs.length - 1];
      if (arcs.length === 1) { first.mv = first; first.first = first; first.last = first; first.zone = first.n.zone; return; }
      const mv = { k: 2, pts: [], tan: [], n: first.n, zone: first.n.zone, inW: first.inW, inDir: first.inDir, inOff: first.inOff, axis: first.axis, ang: first.ang, first, last };
      arcs.forEach((a, i) => { a.mv = mv; a.first = first; a.last = last; a.zone = mv.zone; for (let j = 0; j < a.pts.length; j++) { mv.pts.push(a.pts[j]); mv.tan.push(a.tan[j]); }
        const ln = links[i]; if (ln) for (let q = 1.5; q < ln.len; q += 2) { lanePoint(ln, q, P4); mv.pts.push([P4[0], P4[1]]); mv.tan.push([P4[2], P4[3]]); } });
    }
    function mkArc(bz, o) { const P = bz.pts, tan = []; for (let i = 0; i < P.length; i++) { const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; tan.push([(b[0] - a[0]) / l, (b[1] - a[1]) / l]); } return Object.assign({ k: 1, pts: P, tan, acc: bz.acc, len: bz.len }, o); }
    function plan(c) { let far = -c.s; for (let i = c.li; i < c.legs.length; i++) far += c.legs[i].len; let guard = 0; while ((far < 90 || c.legs.length - c.li < 3) && guard++ < 6 && !c.legs[c.legs.length - 1].exit) { const n0 = c.legs.length; extend(c); for (let i = n0; i < c.legs.length; i++) far += c.legs[i].len; }
      if (c.li > 6) { c.legs.splice(0, c.li - 2); c.li = 2; } }

    /* ---------- boxes ---------- */
    /* do two boxes overlap? (centre, heading, half length, half width each); returns 0, or the depth of the least overlap with its axis in OUT */
    const OUT = [0, 0];
    function overlap(ax, az, ahx, ahz, al, aw, bx, bz, bhx, bhz, bl, bw) {
      const dx = bx - ax, dz = bz - az, c = Math.abs(ahx * bhx + ahz * bhz), s = Math.abs(ahx * bhz - ahz * bhx); let best = Infinity, nx = 0, nz = 0, o;
      o = al + bl * c + bw * s - Math.abs(dx * ahx + dz * ahz); if (o <= 0) return 0; if (o < best) { best = o; const sg = dx * ahx + dz * ahz < 0 ? -1 : 1; nx = ahx * sg; nz = ahz * sg; }
      o = aw + bl * s + bw * c - Math.abs(-dx * ahz + dz * ahx); if (o <= 0) return 0; if (o < best) { best = o; const sg = -dx * ahz + dz * ahx < 0 ? -1 : 1; nx = -ahz * sg; nz = ahx * sg; }
      o = bl + al * c + aw * s - Math.abs(dx * bhx + dz * bhz); if (o <= 0) return 0; if (o < best) { best = o; const sg = dx * bhx + dz * bhz < 0 ? -1 : 1; nx = bhx * sg; nz = bhz * sg; }
      o = bw + al * s + aw * c - Math.abs(-dx * bhz + dz * bhx); if (o <= 0) return 0; if (o < best) { best = o; const sg = -dx * bhz + dz * bhx < 0 ? -1 : 1; nx = -bhz * sg; nz = bhx * sg; }
      OUT[0] = nx; OUT[1] = nz; return best;   /* the axis points from a to b */
    }
    T.overlap = overlap;
    /* do two curves through a crossing sweep the same ground? (a car's box, with a margin, carried along each) */
    const sameLane = (a, b) => a.inW === b.inW && a.inDir === b.inDir && a.inOff === b.inOff;
    function conflict(a, b) {
      if (a === b || sameLane(a, b)) return false;   /* one behind the other: the follower watches the leader */
      let k = a._cf; if (!k) k = a._cf = new Map(); let v = k.get(b); if (v !== undefined) return v; v = false;
      const HL = 3.0, HW = 1.25;
      for (let i = 0; i < a.pts.length && !v; i++) for (let j = 0; j < b.pts.length; j++) { const dx = a.pts[i][0] - b.pts[j][0], dz = a.pts[i][1] - b.pts[j][1]; if (dx * dx + dz * dz > 72) continue;
        if (overlap(a.pts[i][0], a.pts[i][1], a.tan[i][0], a.tan[i][1], HL, HW, b.pts[j][0], b.pts[j][1], b.tan[j][0], b.tan[j][1], HL, HW)) { v = true; break; } }
      k.set(b, v); return v;
    }

    /* ---------- cars ---------- */
    function place(c, w, dir, d) { const lanes = w.lanes[dir]; c.lane = Math.floor(c.rnd() * lanes.length); c.legs = [laneLeg(w, dir, lanes[c.lane], d)]; c.li = 0; c.s = 0; c.e = 0; c.ed = 0; c.v = 0; c.grant = null; c.inNode = null; c.stopped = 0; c.arrive = 1e18; c.noRoom = false; c.nudge = 0; c.nudgeTo = 0; c.block = 0; c.stuck = 0; c.crash = 0; c.snap = true; c.pend = null; c.arc = null; c.why = 0; c.blk = null; pose(c); }
    function pose(c) { const leg = c.legs[c.li]; legPoint(leg, c.s, P4); const rt = right(P4[2], P4[3]), e = c.e + c.nudge; c.x = P4[0] + rt[0] * e; c.z = P4[1] + rt[1] * e; const sk = clamp(c.ed / Math.max(c.v, 2.5), -0.5, 0.5); let hx = P4[2] + rt[0] * sk, hz = P4[3] + rt[1] * sk;
      /* the box turns into a bend over a car's length, not in an instant */
      if (!c.snap) { const k = Math.min(1, 0.06 + c.v * (T.dt || 0.033) * 0.55); hx = c.hx + (hx - c.hx) * k; hz = c.hz + (hz - c.hz) * k; } c.snap = false;
      const hl = Math.hypot(hx, hz) || 1; c.hx = hx / hl; c.hz = hz / hl; c.yaw = Math.atan2(c.hx, c.hz); }
    const freeAt = (x, z, hx, hz, hl, hw, self) => { for (const o of T.cars) if (o !== self && Math.abs(o.x - x) < 9 && Math.abs(o.z - z) < 9 && overlap(x, z, hx, hz, hl + 1.5, hw + 0.4, o.x, o.z, o.hx, o.hz, o.hl, o.hw)) return false; if (T.pHash) for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const cell = T.pHash.get(hash(x + i * CELL, z + j * CELL)); if (cell) for (const o of cell) if (overlap(x, z, hx, hz, hl + 0.3, hw + 0.2, o.x, o.z, o.hx, o.hz, o.hl, o.hw)) return false; } return true; };
    /* is there a car standing (not just passing) where this box would be? */
    const roomAt = (x, z, hx, hz, hl, hw, self) => { for (const o of T.cars) if (o !== self && (o.v < 2.5 || o.crash > 0) && Math.abs(o.x - x) < 9 && Math.abs(o.z - z) < 9 && overlap(x, z, hx, hz, hl + 1.5, hw + 0.2, o.x, o.z, o.hx, o.hz, o.hl, o.hw)) { self.roomBlk = o; return false; } self.roomBlk = null; return true; };
    /* put a car down on a free stretch of lane; near: [x, z, min, max] keeps it in a ring round a point */
    function spawn(c, near) {
      for (let tries = 0; tries < 30; tries++) { let r = c.rnd() * T.total, w = T.driveWays[0]; for (const x of T.driveWays) { if (r < x.len) { w = x; break; } r -= x.len; }
        let dir = c.rnd() < 0.5 ? 1 : -1; if (w.dead[dir] && !w.dead[-dir]) dir = -dir; const d = 8 + c.rnd() * Math.max(1, w.len - 16); at(w, d, P4); if (near) { const dd = Math.hypot(P4[0] - near[0], P4[1] - near[1]); if (dd < near[2] || dd > near[3]) continue; }
        if (w.stops.some(s => Math.abs(s.d - d) < Math.max(s.sbm, s.sbp) + 7)) continue; place(c, w, dir, d); if (freeAt(c.x, c.z, c.hx, c.hz, c.hl, c.hw, c)) { c.v = w.limit * 0.6; c.out = false; return true; } }
      c.out = true; c.x = 1e7; c.z = 1e7; c.v = 0; return false;   /* nowhere free just now: it waits off the map and tries again */
    }
    function enter(c, cam) { const P = T.portals; if (!P || !P.length) return false;
      for (let tries = 0; tries < 8; tries++) { const q = P[Math.floor(c.rnd() * P.length)]; if (q.w.dead[q.dir] || q.n === c.leftAt) continue; if (cam && Math.hypot(q.n.x - cam[0], q.n.z - cam[1]) < 150) continue;
        place(c, q.w, q.dir, q.dir > 0 ? 5 : q.w.len - 5); if (freeAt(c.x, c.z, c.hx, c.hz, c.hl + 4, c.hw, c)) { c.v = q.w.limit * 0.8; c.out = false; c.leftAt = null; return true; } }
      c.out = true; c.x = 1e7; c.z = 1e7; c.v = 0; return false; }
    T.populate = (n, seed, near) => { const R = rng(seed || 77); T.cars.length = 0; (T.zones || []).forEach(z => { z.occ = []; z.queue = []; }); if (!T.driveWays || !T.driveWays.length) return; n = Math.min(n, Math.floor(T.total / 30));
      for (let i = 0; i < n; i++) { const ty = types.pickType(R()), t = types[ty], c = { id: i + 1, ty, col: types.pickPaint(R()), hl: t.L / 2, hw: t.W / 2, top: 0.86 + R() * 0.28, rnd: rng(1000 + i * 7919), legs: [], x: 0, z: 0, hx: 0, hz: 1, yaw: 0, v: 0, a: 0, brake: 0 }; if (spawn(c, near)) T.cars.push(c); } };

    /* ---------- one step of the simulation ---------- */
    const SAMP = new Float32Array(64 * 4);
    T.step = (dt, cam) => {
      T.time += dt; T.dt = dt; T.sigT = (T.sigT + dt) % 30; const ph = T.sigT; T.ns = ph < 12 ? 'g' : ph < 14 ? 'y' : 'r'; T.ew = ph < 15 ? 'r' : ph < 27 ? 'g' : ph < 29 ? 'y' : 'r';
      const cars = T.cars, extra = []; if (T.viewer) extra.push({ x: T.viewer[0], z: T.viewer[1], hx: 0, hz: 1, hl: 0.55, hw: 0.55, v: 0, static: true, viewer: true }); for (const b of T.bodies) extra.push(b);
      for (const c of cars) {
        if (c.out) continue;
        if (c.crash > 0) { c.crash -= dt; c.v = 0; c.a = 0; c.brake = 2; c.stuck += dt; continue; }
        plan(c); const leg = c.legs[c.li], nextLeg = c.legs[c.li + 1], appr = !leg.k && nextLeg && nextLeg.k && nextLeg.n ? nextLeg : null;
        /* --- the speed the road allows, easing down for a curve ahead --- */
        let v0 = (leg.k ? leg.vmax : leg.limit) * c.top; if (appr) { const dA = leg.len - c.s, va = nextLeg.vmax; v0 = Math.min(v0, Math.sqrt(va * va + 2 * 1.6 * Math.max(0, dA - 2))); }
        let gap = 1e9, dv = 0, why = 0, blocker = null;
        /* --- whatever box its own box would meet along the route --- */
        const reach = Math.min(70, 10 + c.v * c.v / 4.4 + c.v * 1.6), step = 1.5, ns = Math.min(63, Math.ceil(reach / step)); let ne = 0;
        const clean = Math.abs(c.nudge) < 0.05 && Math.abs(c.e) < 0.15, obs = [];
        for (const o of cars) { if (o === c) continue; const dx = o.x - c.x, dz = o.z - c.z; if (dx * dx + dz * dz >= (reach + 8) * (reach + 8)) continue;
          /* a car on a curve through the same crossing that cannot touch this one's curve is no obstacle */
          if (clean && o.grant && c.grant && o.grant.zone === c.grant.zone && Math.abs(o.nudge) < 0.05 && Math.abs(o.e) < 0.15 && !sameLane(c.grant, o.grant) && !conflict(c.grant, o.grant)) continue; obs.push(o); }
        if (!c.near || Math.hypot(c.x - c.nearAt[0], c.z - c.nearAt[1]) > 14) { c.near = []; c.nearAt = [c.x, c.z]; if (T.pHash) for (let i = -5; i <= 5; i++) for (let j = -5; j <= 5; j++) { const cell = T.pHash.get(hash(c.x + i * CELL, c.z + j * CELL)); if (cell) for (const o of cell) c.near.push(o); } }
        for (const o of c.near) { const dx = o.x - c.x, dz = o.z - c.z; if (dx * dx + dz * dz < (reach + 6) * (reach + 6)) obs.push(o); }
        for (const o of extra) { const dx = o.x - c.x, dz = o.z - c.z; if (dx * dx + dz * dz < (reach + 6) * (reach + 6)) obs.push(o); }
        /* sweep the box along the route (shifted sideways by off) and return how far it gets: [distance, what stops it] */
        const al = c.hl + 0.1, aw = c.hw + 0.28, r2 = (c.hl + 3.4);
        const sweep = (off, fixed) => { let g = 1e9, hit = null;
          for (let k = 0; k <= ns; k++) { ahead(c, k * step, P4); const rt = right(P4[2], P4[3]), e = fixed ? off : c.e * Math.max(0, 1 - k * step / 12) + off; SAMP[k * 4] = P4[0] + rt[0] * e; SAMP[k * 4 + 1] = P4[1] + rt[1] * e; SAMP[k * 4 + 2] = P4[2]; SAMP[k * 4 + 3] = P4[3]; ne = k; }
          for (const o of obs) { const lim = r2 + o.hl; for (let k = 1; k <= ne; k++) { const sx = SAMP[k * 4], sz = SAMP[k * 4 + 1], dx = o.x - sx, dz = o.z - sz; if (dx * dx + dz * dz > lim * lim) continue;
              const p1 = overlap(sx, sz, SAMP[k * 4 + 2], SAMP[k * 4 + 3], al, aw, o.x, o.z, o.hx, o.hz, o.hl, o.hw); if (!p1) continue;
              /* already brushing it, and going on does not press any deeper (side by side, or pulling away): not in the way */
              if (k <= 2 && !fixed) { const p0 = overlap(c.x, c.z, c.hx, c.hz, al, aw, o.x, o.z, o.hx, o.hz, o.hl, o.hw); if (p0 > 0 && p1 <= p0 + 0.01) break; }
              /* between the last clear sample and this one, find where they first touch */
              let lo = (k - 1) * step, hi = k * step; for (let it = 0; it < 4; it++) { const mid = (lo + hi) / 2, f = mid / step - (k - 1), mx = SAMP[(k - 1) * 4] + (sx - SAMP[(k - 1) * 4]) * f, mz = SAMP[(k - 1) * 4 + 1] + (sz - SAMP[(k - 1) * 4 + 1]) * f; if (overlap(mx, mz, SAMP[k * 4 + 2], SAMP[k * 4 + 3], al, aw, o.x, o.z, o.hx, o.hz, o.hl, o.hw)) hi = mid; else lo = mid; }
              if (lo < g) { g = lo; hit = o; } break; } }
          return [g, hit]; };
        if (obs.length) { const r = sweep(c.nudge, false); if (r[1]) { const o = r[1]; gap = r[0]; dv = c.v - (o.static ? 0 : Math.max(0, o.v * (o.hx * c.hx + o.hz * c.hz))); why = 2; blocker = o; } }
        /* --- a stop line it may not pass yet --- */
        if (appr && (appr === appr.mv.first || c.grant !== appr.mv)) {
          const mv = appr.mv, n = appr.n, zone = mv.zone, dStop = leg.len - (1.7 + c.hl) - c.s; let go = false;
          if (c.pend !== mv) { c.pend = mv; c.stopped = 0; c.arrive = 1e18; c.noRoom = false; }
          if (dStop < 20 + c.v * 3) {
            /* first in its lane, or behind a car that is going through */
            const lead = blocker && gap < dStop - 0.5 ? blocker : null, first = !lead || (!lead.static && lead.grant && lead.grant.zone === zone && lead.v > 0.5);
            let clear = first && zone.occ.every(o => o === c || !conflict(mv, o.grant));
            if (n.cross && !appr.uturn) {
              if (c.grant !== mv && !zone.queue.includes(c)) zone.queue.push(c);
              if (n.signal) { const lamp = appr.axis === 'ns' ? T.ns : T.ew; go = clear && (lamp === 'g' || (lamp === 'y' && dStop < c.v * c.v / 7)); }
              else { if (dStop < 2.4 && c.v < 0.3) { if (!c.stopped) c.arrive = T.time; c.stopped += dt; }
                if (clear) for (const q of zone.queue) if (q !== c && q.pend && q.stopped > 0 && !q.noRoom && q.arrive < c.arrive && conflict(mv, q.pend)) { clear = false; break; }
                go = clear && c.stopped > 0.7; }
            } else go = clear;
            /* never into a crossing it cannot leave */
            if (go) { const after = c.legs[c.legs.indexOf(mv.last, c.li) + 1]; if (after && !after.k) { lanePoint(after, Math.min(after.len, c.hl + 2), P4); c.noRoom = !roomAt(P4[0], P4[1], P4[2], P4[3], c.hl, c.hw, c); go = !c.noRoom; } }
          }
          if (T.log) c.dbg = { go, dStop: +dStop.toFixed(1), axis: appr.axis, lamp: n.signal ? (appr.axis === 'ns' ? T.ns : T.ew) : n.cross ? 'stop' : 'join', noRoom: c.noRoom, st: +c.stopped.toFixed(1), occ: zone.occ.map(o => o.id + ':' + (o === c ? 'self' : conflict(mv, o.grant) ? 'X' : 'ok') + ' k' + o.legs[o.li].k + ' v' + o.v.toFixed(1) + ' why' + o.why + ' st' + o.stuck.toFixed(0) + ' blk' + (o.blk ? (o.blk.id || 'static') : '-')), q: zone.queue.map(q => q.id + (q.stopped > 0 ? '@' + q.arrive.toFixed(0) : '') + (q !== c && q.pend && conflict(mv, q.pend) ? 'X' : '')), lead: blocker ? (blocker.id || 'static') + '@' + gap.toFixed(1) : null, t: +T.time.toFixed(1), ang: +(appr.ang || 0).toFixed(2), arcs: mv.k === 2 ? 'chain' : 1 };
          /* the turn is held for a car from the moment it is given; it is given back if things change while the car can still stop */
          const committed = dStop < c.v * c.v / 7 || dStop < -0.2;
          if (go && c.grant !== mv) { c.grant = c.arc = mv; zone.occ.push(c); c.inNode = n; const qi = zone.queue.indexOf(c); if (qi >= 0) zone.queue.splice(qi, 1); }
          else if (!go && c.grant === mv && !committed) { const i = zone.occ.indexOf(c); if (i >= 0) zone.occ.splice(i, 1); c.grant = c.arc = null; c.inNode = null; }
          if (c.grant !== mv && Math.max(0, dStop) < gap) { gap = Math.max(0, dStop); dv = c.v; why = 1; blocker = null; }
        }
        /* --- the Intelligent Driver Model --- */
        const aMax = 2.1, bC = 2.8, s0 = why === 1 ? 0.4 : 1.7, Th = why === 1 ? 0.1 : 1.15; let a = aMax * (1 - Math.pow(c.v / Math.max(v0, 0.5), 4));
        if (gap < 1e8) { const ss = s0 + Math.max(0, c.v * Th + c.v * dv / (2 * Math.sqrt(aMax * bC))); a -= aMax * (ss / Math.max(gap, 0.05)) * (ss / Math.max(gap, 0.05)); }
        a = clamp(a, -9, aMax); if (gap < 0.25 && a > 0) a = 0; c.a = a; c.v = Math.max(0, c.v + a * dt); if (gap < 0.12) c.v = 0; c.brake = a < -0.6 || (c.v < 0.2 && why) ? 1 : 0;
        /* --- stopped by something dropped or standing in the road (not a queue, not a parked car): edge round it if the way is clear --- */
        if (c.v < 0.15 && why === 2 && blocker && blocker.static && !blocker.parkedCar) c.block += dt; else if (c.v > 1.5 || why !== 2) c.block = 0;
        if (c.block > 1.6 && !leg.k && Math.abs(c.nudge) < 0.05 && !(appr && leg.len - c.s < 22)) { for (const tr of [-1.4, 1.4, -2.3]) { const r = sweep(tr, true); if (r[0] > 26) { c.nudgeTo = tr; c.nudgeS = 0; c.block = 0; break; } } }
        if (c.nudgeTo) { c.nudge += clamp(c.nudgeTo - c.nudge, -0.9 * dt, 0.9 * dt); c.nudgeS += c.v * dt; if (c.nudgeS > 26) c.nudgeTo = 0; } else if (c.nudge) { const d = clamp(-c.nudge, -0.7 * dt, 0.7 * dt); c.nudge = Math.abs(c.nudge) < Math.abs(d) + 1e-3 ? 0 : c.nudge + d; }
        c.stuck = c.v < 0.1 ? c.stuck + dt : 0; c.why = why; c.blk = blocker; c.gapDbg = gap;
        /* --- move along the route; a shove sideways stays until the car rolls, and it steers back over a few lengths --- */
        c.s += c.v * dt; { const e0 = c.e; c.e -= c.e * Math.min(1, c.v * dt / 5); c.ed = (c.e - e0) / dt; }
        while (c.s >= c.legs[c.li].len && c.li < c.legs.length - 1) { const done = c.legs[c.li]; c.s -= done.len; c.li++; if (done.k && done.mv && done === done.mv.last) { const i = done.zone.occ.indexOf(c); if (i >= 0) done.zone.occ.splice(i, 1); c.inNode = null; c.grant = null; c.arc = null; c.pend = null; } }
        pose(c);
      }
      /* ---------- contact: boxes that overlap are parted, stopped, and counted ---------- */
      for (let i = 0; i < cars.length; i++) { const a = cars[i]; if (a.out) continue;
        const hit = (o, movable) => { const pen = overlap(a.x, a.z, a.hx, a.hz, a.hl, a.hw, o.x, o.z, o.hx, o.hz, o.hl, o.hw); if (pen <= 0.02) return; T.events.contacts++; if (pen > T.events.maxPen) T.events.maxPen = pen;
          if (T.log && T.log.length < 8) T.log.push({ t: +T.time.toFixed(1), pen: +pen.toFixed(2), a: [a.id, a.legs[a.li].k, +a.v.toFixed(1), a.inNode ? a.inNode.id : -1, a.why, +a.e.toFixed(2), +a.nudge.toFixed(2)], o: movable ? [o.id, o.legs[o.li].k, +o.v.toFixed(1), o.inNode ? o.inNode.id : -1, o.why, +o.e.toFixed(2), +o.nudge.toFixed(2)] : (o.viewer ? 'viewer' : 'parked') });
          const nx = OUT[0], nz = OUT[1], share = movable ? 0.5 : 1, m = pen + 0.06, push = (c, sx, sz) => { const leg = c.legs[c.li]; legPoint(leg, c.s, P4); const rt = right(P4[2], P4[3]), lon = sx * P4[2] + sz * P4[3], lat = sx * rt[0] + sz * rt[1]; c.s = Math.max(0, c.s + lon); c.e += lat; c.ed = 0; c.v = 0; c.crash = 2.5 + c.rnd(); c.snap = true; const hx = c.hx, hz = c.hz; pose(c); c.hx = hx; c.hz = hz; c.yaw = Math.atan2(hx, hz); };
          push(a, -nx * m * share, -nz * m * share); if (movable) push(o, nx * m * share, nz * m * share); };
        for (let j = i + 1; j < cars.length; j++) { const o = cars[j]; if (!o.out && Math.abs(o.x - a.x) < 8 && Math.abs(o.z - a.z) < 8) hit(o, true); }
        for (const o of (a.near || [])) if (Math.abs(o.x - a.x) < 8 && Math.abs(o.z - a.z) < 8) hit(o, false);
      }
      /* ---------- out of range, or hopelessly stuck: back in on a free stretch of lane away from the eye ---------- */
      if (cam) for (const c of cars) { const lg = c.out ? null : c.legs[c.li]; if (lg && lg.exit && c.s >= lg.len - 1.5) { c.leftAt = lg.next ? lg.next.n : null; T.zones.forEach(n => { let i = n.occ.indexOf(c); if (i >= 0) n.occ.splice(i, 1); i = n.queue.indexOf(c); if (i >= 0) n.queue.splice(i, 1); }); if (!enter(c, cam)) spawn(c, [cam[0], cam[1], Math.min(170, (cam[2] || 520) * 0.4), (cam[2] || 520) * 0.85]); c.near = null; continue; }
        const far = c.out ? (T.time * 2 | 0) !== ((T.time - dt) * 2 | 0) : Math.hypot(c.x - cam[0], c.z - cam[1]) > (cam[2] || 520), jam = !c.out && c.stuck > (c.why === 1 && c.pend && c.pend.n && c.pend.n.signal ? 150 : 45);
        if (far || jam) { if (jam) { T.events.tows++; if (T.log && c.blk && c.blk.parkedCar) { ahead(c, c.gapDbg || 0, P4); (T.towLog = T.towLog || []).push({ id: c.id, x: +c.x.toFixed(1), z: +c.z.toFixed(1), s: +c.s.toFixed(1), len: +c.legs[c.li].len.toFixed(1), gap: +(c.gapDbg || 0).toFixed(2), hitLegK: c.legs[P4[4]].k, hitLegIdx: P4[4] - c.li, px: +c.blk.x.toFixed(1), pz: +c.blk.z.toFixed(1), e: +c.e.toFixed(2), nudge: +c.nudge.toFixed(2), wkind: c.legs[c.li].w ? c.legs[c.li].w.r.kind : '', nextUturn: !!(c.legs[c.li + 1] && c.legs[c.li + 1].uturn), lat: (() => { const dx = c.blk.x - c.x, dz = c.blk.z - c.z; return [+(dx * c.hx + dz * c.hz).toFixed(2), +(-dx * c.hz + dz * c.hx).toFixed(2)]; })() }); } const k = c.why + ':' + (c.legs[c.li].k ? 'arc' : 'lane') + ':' + (c.pend && c.pend.n ? (c.pend.n.signal ? 'signal' : c.pend.n.cross ? 'stop' : 'join') + (c.pend.k === 2 ? '+' : '') : '-') + ':' + (c.blk ? (c.blk.viewer ? 'viewer' : c.blk.static ? 'parked' : c.blk.crash > 0 ? 'crashed' : 'car') : '-'); T.events.why = T.events.why || {}; T.events.why[k] = (T.events.why[k] || 0) + 1; } T.zones.forEach(n => { let i = n.occ.indexOf(c); if (i >= 0) n.occ.splice(i, 1); i = n.queue.indexOf(c); if (i >= 0) n.queue.splice(i, 1); }); if (!(c.rnd() < 0.6 && enter(c, cam))) spawn(c, [cam[0], cam[1], Math.min(170, (cam[2] || 520) * 0.4), (cam[2] || 520) * 0.85]); c.near = null; } }
      T.zones.forEach(z => { if (z.queue.length) z.queue = z.queue.filter(c => !c.out && c.pend && c.pend.zone === z && !c.grant); });
    };
    return T;
  }
  SE.Traffic = Traffic;

  /* ==== rooftop scout on the engine: the wider city ==== */
  /* Around the cells that are built in detail, the city goes on: every footprint in the FEMA file out to a few kilometres
     as a plain extruded block with the same generated windows on its walls and the satellite photograph on its lid, and
     beyond that the tall buildings alone, out to the horizon, so a skyline stands where one stands. The blocks come a
     map tile at a time (zoom 15, about a kilometre), nearest first, a few requests at once; each tile is two meshes
     (lids and ground, walls), cut into the detailed cells' squares so that a square can be switched off the moment the
     detailed cell over it has its buildings. Nothing here is solid or pickable: it is the backdrop, and it says so. */
  function WideKit(engine, K, S, env, H) {
    const dev = engine.device, scene = engine.scene, M = K.mat, TZ = 15, CZ = H.CZ || 18, SUB = 1 << (CZ - TZ);
    const W = { tiles: new Map(), on: !!env.context, reach: 2600, stats: { tiles: 0, buildings: 0, tris: 0, pending: 0, failed: 0, skyline: 0, fema: 0, osm: 0, replaced: 0, osmFailed: 0, trees: 0 }, sky: null, skyAt: null };
    const group = scene.createEntity('Wider city (context, generated blocks)', { parent: H.parent, transient: true });
    const DATA = new Map(), VER = new Map();      /* tile key -> features in latitude and longitude, kept across a recentre; and how many times each has arrived */
    let active = 0; const buildQ = [];
    const roofMat = tex => new Material({ name: 'Wider city: ground and lids', albedoMap: tex, roughness: 0.94, castShadow: false, wet: 0 });
    const skyRoof = new Material({ name: 'Skyline lids', albedo: '#8d8f90', roughness: 0.9, castShadow: false });
    const ringOf = f => { let P = f.ring.map(q => S.toL(q[0], q[1])); if (P.length > 1) { const a = P[0], z = P[P.length - 1]; if (Math.abs(a[0] - z[0]) < 1e-6 && Math.abs(a[1] - z[1]) < 1e-6) P = P.slice(0, -1); }
      if (P.length < 3) return null; const ar = Poly.area(P); if (Math.abs(ar) < 4) return null; if (ar < 0) P.reverse();
      /* corners that barely turn, and jogs under a metre, are dropped: this is seen from far off */
      for (let pass = 0; pass < 2 && P.length > 4; pass++) { const Q2 = []; for (let i = 0; i < P.length; i++) { const p0 = Q2.length ? Q2[Q2.length - 1] : P[P.length - 1], p1 = P[i], p2 = P[(i + 1) % P.length], ax = p1[0] - p0[0], az = p1[1] - p0[1], bx = p2[0] - p1[0], bz = p2[1] - p1[1], la = Math.hypot(ax, az), lb = Math.hypot(bx, bz); if (la < 1 || (la > 0 && lb > 0 && Math.abs(ax * bz - az * bx) / (la * lb) < 0.16 && ax * bx + az * bz > 0)) continue; Q2.push(p1); } if (Q2.length < 3 || Math.abs(Poly.area(Q2)) < Math.abs(ar) * 0.8) break; P = Q2; }
      return P; };
    const mosaic = t => { const c = K.cvs(512, 512, '#6f7764'), g = c.getContext('2d'), tex = dev.texture({ w: 512, h: 512, format: 'srgb8a8', mips: true, wrap: 'clamp', aniso: 16, name: 'wide ' + t.key }); tex.image(c); const im = { c, g, tex, dead: false, n: 0 };
      for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) { const img = new Image(); img.crossOrigin = 'anonymous'; img.decoding = 'async'; img.onload = () => { if (im.dead) return; g.drawImage(img, i * 256, j * 256, 256, 256); im.n++; clearTimeout(im.tm); im.tm = setTimeout(() => { if (!im.dead && !dev.lost) { tex.image(c); H.need(); if (im.n >= 4 && t.state === 'built' && !t.treeList) { findTrees(t); H.need(); } } }, 160); }; img.src = env.tileURL(TZ + 1, t.X * 2 + i, t.Y * 2 + j); }
      return im; };
    function ground(t) { const r = t.rect, y0 = -1.1, Bd = new MeshBuilder(); Bd.quad([r.x0, y0, r.zN], [r.x1, y0, r.zN], [r.x1, y0, r.zS], [r.x0, y0, r.zS], [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]]); t.img = mosaic(t); t.mat = roofMat(t.img.tex);
      const e = scene.createEntity('Wide ground ' + t.key, { parent: group, transient: true }), mr = e.add('MeshRenderer'); mr.mesh = Bd.build(dev, { name: 'wide ground ' + t.key }); mr.material = t.mat; mr.castShadow = false; mr.pickable = false; t.g = { e, mesh: mr.mesh }; }
    function dispose(t) { if (t.e) { t.e.destroy(); t.e = null; } (t.meshes || []).forEach(m => m && m.dispose()); t.meshes = []; t.cells = new Map(); if (t.n) { W.stats.buildings -= t.n; W.stats.tris -= t.tris; t.n = 0; t.tris = 0; } }
    function drop(t) { dispose(t); if (t.tr) { t.tr.e.destroy(); t.tr.ib.dispose(); W.stats.trees -= t.tr.n; t.tr = null; } if (t.g) { t.g.e.destroy(); t.g.mesh.dispose(); t.g = null; } if (t.img) { t.img.dead = true; t.img.tex.dispose(); t.img = null; } W.tiles.delete(t.key); }
    const clusterOf = (a, b, bb, key) => ({ start: a * 3, count: (b - a) * 3, c: [(bb[0] + bb[3]) / 2, (bb[1] + bb[4]) / 2, (bb[2] + bb[5]) / 2], r: Math.hypot(bb[3] - bb[0], bb[4] - bb[1], bb[5] - bb[2]) / 2 + 0.5, axis: [0, 1, 0], cone: 0, hidden: false, key });
    function build(t) {
      dispose(t); const feats = DATA.get(t.key) || [], r = t.rect, far = t.far, MB = MeshBuilder, Br = new MB(), Bw = new MB({ aux: true }), uv = p => [(p[0] - r.x0) / (r.x1 - r.x0), (p[1] - r.zN) / (r.zS - r.zN)];
      const clR = [], clW = [], by = new Map(); let n = 0;
      feats.forEach(f => { const k = Math.floor(H.lon2t(f.lo, CZ)) + '/' + Math.floor(H.lat2t(f.la, CZ)); let l = by.get(k); if (!l) by.set(k, l = []); l.push(f); });
      by.forEach((list, key) => { const r0 = Br.tris, w0 = Bw.tris, bb = [1e9, 0, 1e9, -1e9, 0, -1e9];
        list.forEach(f => { const P = ringOf(f); if (!P) return; const g = { P, h: f.h, cls: f.cls, id: f.id }; try { K.addContext(Bw, Br, g, uv, { noWalls: far && f.h < 7.5 }); } catch (e) { return; } n++; P.forEach(q => { bb[0] = Math.min(bb[0], q[0]); bb[2] = Math.min(bb[2], q[1]); bb[3] = Math.max(bb[3], q[0]); bb[5] = Math.max(bb[5], q[1]); }); bb[4] = Math.max(bb[4], f.h); });
        const hide = H.covered(key), cs = []; if (Br.tris > r0) { const c = clusterOf(r0, Br.tris, bb, key); c.hidden = hide; clR.push(c); cs.push(c); } if (Bw.tris > w0) { const c = clusterOf(w0, Bw.tris, bb, key); c.hidden = hide; clW.push(c); cs.push(c); } if (cs.length) t.cells.set(key, cs); });
      const e = scene.createEntity('Wide ' + t.key, { parent: group, transient: true }); t.e = e; t.meshes = []; t.tris = Br.tris + Bw.tris; t.n = n;
      const add = (Bd, mat, cl, name) => { if (Bd.empty) return; const mesh = Bd.build(dev, { name: name + ' ' + t.key }); mesh.clusters = cl; mesh.maskable = true; const mr = e.add('MeshRenderer'); mr.mesh = mesh; mr.material = mat; mr.castShadow = false; mr.pickable = false; t.meshes.push(mesh); };
      add(Br, t.mat, clR, 'Lids and ground'); add(Bw, M.wall, clW, 'Walls'); t.state = 'built'; t.builtFar = far; W.stats.buildings += n; W.stats.tris += t.tris; skyMask(); if (!t.treeList) findTrees(t); H.need(2);
    }
    function fetchTile(t) {
      if (DATA.has(t.key)) { t.state = 'data'; if (!buildQ.includes(t)) buildQ.push(t); return; }
      t.state = 'fetching'; active++; const gen = S.gen, z = TZ, box = { w: H.t2lon(t.X, z), e: H.t2lon(t.X + 1, z), n: H.t2lat(t.Y, z), s: H.t2lat(t.Y + 1, z) };
      Promise.resolve().then(() => env.context(box)).then(list => { active--; const inBox = (la, lo) => lo >= box.w && lo < box.e && la <= box.n && la > box.s, feats = (list || []).filter(f => f && f.ring && f.ring.length >= 3 && inBox(f.la, f.lo));   /* a building belongs to the square its centre is in */
        feats.dropped = ((list && list.dropped) || []).filter(q => inBox(q[0], q[1])); feats.stats = (list && list.stats) || null; DATA.set(t.key, feats); VER.set(t.key, (VER.get(t.key) || 0) + 1);
        { let o = 0; feats.forEach(f => { if (f.src === 'osm') o++; }); W.stats.osm += o; W.stats.fema += feats.length - o; W.stats.replaced += feats.dropped.length; if (feats.stats && feats.stats.osmFailed) W.stats.osmFailed++; } if (H.onData) H.onData(t.key); if (DATA.size > 160) { const k = DATA.keys().next().value; if (!W.tiles.has(k)) DATA.delete(k); }
        if (W.tiles.get(t.key) === t && gen === S.gen) { t.state = 'data'; buildQ.push(t); H.need(); } next(); })
        .catch(() => { active--; t.state = 'failed'; t.failAt = performance.now(); W.stats.failed++; next(); });
    }
    function next() { if (!W.on) return; const wait = [...W.tiles.values()].filter(t => t.state === 'new' || (t.state === 'failed' && performance.now() - t.failAt > 20000)).sort((a, b) => a.d - b.d); W.stats.pending = wait.length + active; while (active < 3 && wait.length) fetchTile(wait.shift()); }
    /* which tiles should exist round the camera */
    W.update = () => {
      if (!S.ok) return; const [cX, cY] = H.cellOf(S.x, S.z, TZ), r0 = H.rectOf(cX, cY, TZ), size = Math.abs(r0.x1 - r0.x0), n = Math.ceil(W.reach / size) + 1;
      for (let dy = -n; dy <= n; dy++) for (let dx = -n; dx <= n; dx++) { const X = cX + dx, Y = cY + dy, rect = H.rectOf(X, Y, TZ), mx = (rect.x0 + rect.x1) / 2, mz = (rect.zN + rect.zS) / 2, d = Math.max(0, Math.hypot(mx - S.x, mz - S.z) - size * 0.5); if (d > W.reach) continue;
        const key = X + '/' + Y; let t = W.tiles.get(key); if (!t) { t = { key, X, Y, rect, state: W.on ? 'new' : 'off', cells: new Map(), meshes: [], n: 0, tris: 0, far: d > 1500 }; W.tiles.set(key, t); ground(t); } else if (W.on && t.state === 'off') t.state = 'new'; t.d = d;
        const far = t.builtFar ? d > 1250 : d > 1500; if (t.state === 'built' && far !== t.builtFar) { t.far = far; if (!buildQ.includes(t)) buildQ.push(t); } else if (t.state !== 'built') t.far = far; }
      W.tiles.forEach(t => { const d = Math.hypot((t.rect.x0 + t.rect.x1) / 2 - S.x, (t.rect.zN + t.rect.zS) / 2 - S.z) - size * 0.5; if (d > W.reach + size * 1.2) drop(t); });
      W.stats.tiles = W.tiles.size; if (W.on) { next(); skyline(); }
    };
    W.pump = () => { if (!buildQ.length) { for (const t of W.tiles.values()) if (t.treeDirty) { fillTrees(t); return true; } return false; } buildQ.sort((a, b) => a.d - b.d); const t = buildQ.shift(); if (W.tiles.get(t.key) === t && DATA.has(t.key)) build(t); if (buildQ.length) H.need(); return true; };
    /* a detailed cell now has (or no longer has) its own buildings: the blocks under it go (or come back) */
    W.cover = (key, on) => { const p = key.split('/'), t = W.tiles.get(Math.floor(+p[0] / SUB) + '/' + Math.floor(+p[1] / SUB)); if (!t) return; const cs = t.cells.get(key); if (cs) cs.forEach(c => { c.hidden = !!on; }); };
    /* ---------- trees of the wider city ---------- */
    /* The square's photograph (2 m to the pixel) is read once: a pixel is canopy if it is dark, green or brown-green,
       and not flat like a lawn. A tree is stood on a jittered 8 m grid wherever the photograph says canopy and no
       building's footprint is under it, up to a number the quality sets. They are twelve-triangle crowns, tinted by the
       photograph, with no trunk and no sway: this is the backdrop. A square's trees are left out where a detailed cell
       has grown its own. */
    let crownMesh = null, crownMat = null;
    const crown = () => { if (crownMesh) return crownMesh; const Bd = new MeshBuilder(), n = 6, ring = [], top = [0, 1, 0], bot = [0, 0.2, 0];
      for (let i = 0; i < n; i++) { const a = i / n * TAU; ring.push([Math.cos(a) * 0.5, 0.55, Math.sin(a) * 0.5]); }
      const nr = q => { const l = Math.hypot(q[0], q[1] - 0.55, q[2]) || 1; return [q[0] / l, (q[1] - 0.55) / l + 0.25, q[2] / l]; }, c0 = [0.62, 0.62, 0.62, 1], c1 = [1, 1, 1, 1], c2 = [0.42, 0.42, 0.42, 1];
      for (let i = 0; i < n; i++) { const a = ring[i], b = ring[(i + 1) % n], m = [(a[0] + b[0]) / 2, 0.55, (a[2] + b[2]) / 2]; Bd.tri(a, top, b, nr([m[0], 0.8, m[2]]), null, null, null, c1); Bd.tri(b, bot, a, nr([m[0], 0.35, m[2]]), null, null, null, c2); }
      void c0; crownMesh = Bd.build(dev, { name: 'far tree crown' }); crownMat = new Material({ name: 'Wider city: trees', albedo: [0.12, 0.2, 0.05], model: 'foliage', vertexColors: true, roughness: 0.95, wet: 0, castShadow: false, twoSided: true }); return crownMesh; };
    function findTrees(t) {
      const cap = H.treeCap ? H.treeCap() : 0; t.treeCap = cap; t.treeList = null; if (!cap || !t.img || t.img.n < 4) return;
      let data; try { data = t.img.g.getImageData(0, 0, 512, 512).data; } catch (e) { return; }
      const r = t.rect, N = 512, mxp = (r.x1 - r.x0) / N, mzp = (r.zS - r.zN) / N, mc = K.cvs(N, N), mg = mc.getContext('2d'); mg.clearRect(0, 0, N, N); mg.fillStyle = '#000'; mg.strokeStyle = '#000'; mg.lineWidth = 2.5;
      (DATA.get(t.key) || []).forEach(f => { const P = ringOf(f); if (!P) return; mg.beginPath(); P.forEach((q, i) => { const X = (q[0] - r.x0) / mxp, Y = (q[1] - r.zN) / mzp; if (i) mg.lineTo(X, Y); else mg.moveTo(X, Y); }); mg.closePath(); mg.fill(); mg.stroke(); });
      const md = mg.getImageData(0, 0, N, N).data, lum = i => 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const canopy = (x, y) => { const i = (y * N + x) * 4, R = data[i], G = data[i + 1], B2 = data[i + 2], Y = lum(i), exg = 2 * G - R - B2; if (Y < 20 || Y > 150 || B2 > G + 22) return false;
        let s1 = 0, s2 = 0; for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) { const v = lum(((y + j) * N + x + k) * 4); s1 += v; s2 += v * v; } const sd = Math.sqrt(Math.max(0, s2 / 9 - (s1 / 9) * (s1 / 9)));
        return (exg > 10 && Y < 105 && sd > 4.5) || (exg > 2 && Y < 80 && sd > 6) || (R >= B2 - 4 && Y < 95 && sd > 11 && exg > -12); };
      const all = []; for (let gy = 3; gy < N - 3; gy += 4) for (let gx = 3; gx < N - 3; gx += 4) { const h1 = hash01(t.key + ':' + gx + ':' + gy), h2 = hash01(gx + ':' + gy + ':' + t.key), x = Math.min(N - 3, Math.max(2, Math.round(gx + (h1 - 0.5) * 3))), y = Math.min(N - 3, Math.max(2, Math.round(gy + (h2 - 0.5) * 3)));
          if (md[(y * N + x) * 4 + 3] > 30 || !canopy(x, y) || !(canopy(Math.min(N - 3, x + 2), y) || canopy(x, Math.min(N - 3, y + 2)))) continue; const i = (y * N + x) * 4; all.push([r.x0 + (x + 0.5) * mxp, r.zN + (y + 0.5) * mzp, h1, h2, data[i], data[i + 1], data[i + 2]]); }
      const keep = all.length > cap ? cap / all.length : 1, groups = new Map(); let n = 0;
      all.forEach(q => { if (keep < 1 && hash01(q[0].toFixed(1) + q[1].toFixed(1)) > keep) return; const ll = H.toLL(q[0], q[1]), k = Math.floor(H.lon2t(ll[1], CZ)) + '/' + Math.floor(H.lat2t(ll[0], CZ)); let l = groups.get(k); if (!l) groups.set(k, l = []); l.push(q); n++; });
      t.treeList = groups; t.treeN = n; t.treeDirty = true;
    }
    function fillTrees(t) {
      t.treeDirty = false; if (t.tr) { t.tr.e.destroy(); t.tr.ib.dispose(); W.stats.trees -= t.tr.n; t.tr = null; } if (!t.treeList || !t.treeN || !(H.treeCap && H.treeCap())) return;
      const ib = new InstanceBuffer(dev, t.treeN); let n = 0; const LEAF = [0.314, 0.407, 0.18];
      t.treeList.forEach((l, key) => { if (H.treeCovered && H.treeCovered(key)) return; l.forEach(q => { const rr = 3.2 + q[2] * 3.4, hh = 7 + q[3] * 8 + q[2] * 3, k = [0, 1, 2].map(i => clamp(lerp(1, (q[4 + i] / 255) / LEAF[i], 0.5), 0.7, 1.6)); ib.add(q[0], 0, q[1], q[2] * TAU, rr * 2, hh, rr * 2, k[0] * (0.9 + q[3] * 0.2), k[1], k[2] * (0.9 + (1 - q[3]) * 0.2), 1); n++; }); });
      if (!n) { ib.dispose(); return; } const e = scene.createEntity('Wide trees ' + t.key, { parent: group, transient: true }), ir = e.add('InstancedRenderer'); ir.instances = ib; ir.mesh = crown(); ir.material = crownMat; ir.castShadow = false; ir.pickable = false; ir.maxDistance = W.reach + 1400; t.tr = { e, ib, n }; W.stats.trees += n; H.need(2);
    }
    /* a detailed cell grew (or lost) its own trees: the square's are counted again */
    W.treesDirty = key => { const t = W.tiles.get(tileOfCell(key)); if (t && t.treeList) t.treeDirty = true; };
    W.treesAll = () => { W.tiles.forEach(t => { if (t.state === 'built') { if ((t.treeCap || 0) !== (H.treeCap ? H.treeCap() : 0)) findTrees(t); t.treeDirty = true; } }); };
    /* for a detailed cell: the buildings both records hold for its square, and the FEMA footprints the newer record says are gone */
    const tileOfCell = key => { const p = key.split('/'); return Math.floor(+p[0] / SUB) + '/' + Math.floor(+p[1] / SUB); };
    W.dataVer = key => VER.get(tileOfCell(key)) || 0;
    W.cellData = key => { const tk = tileOfCell(key), feats = DATA.get(tk); if (!feats) return null; let idx = feats.byCell; if (!idx) { idx = feats.byCell = new Map(); feats.forEach(f => { const k = Math.floor(H.lon2t(f.lo, CZ)) + '/' + Math.floor(H.lat2t(f.la, CZ)); let l = idx.get(k); if (!l) idx.set(k, l = []); l.push(f); }); feats.goneBy = new Map(); feats.dropped.forEach(q => { const k = Math.floor(H.lon2t(q[1], CZ)) + '/' + Math.floor(H.lat2t(q[0], CZ)); let l = feats.goneBy.get(k); if (!l) feats.goneBy.set(k, l = []); l.push(q); }); }
      return { feats: idx.get(key) || [], gone: feats.goneBy.get(key) || [] }; };
    W.ringOf = ringOf;
    W.reset = () => { [...W.tiles.values()].forEach(drop); buildQ.length = 0; if (W.sky) { W.sky.e.destroy(); W.sky.meshes.forEach(m => m.dispose()); W.sky = null; } W.skySig = null; };
    W.set = (on, reach) => { if (reach) W.reach = reach; on = !!on && !!env.context; if (on !== W.on) { W.on = on; if (!on) { W.tiles.forEach(t => { dispose(t); t.state = 'off'; if (t.tr) { t.tr.e.destroy(); t.tr.ib.dispose(); W.stats.trees -= t.tr.n; t.tr = null; } t.treeList = null; }); buildQ.length = 0; if (W.sky) { W.sky.e.destroy(); W.sky.meshes.forEach(m => m.dispose()); W.sky = null; } W.skySig = null; } } W.update(); };
    /* the skyline: every building over thirty metres for some thirty kilometres round. The map is cut into fixed squares
       (0.2 by 0.24 degrees); the nine round the camera are asked for, nearest first, two at a time, and kept, so a flight
       across the metro asks for each square once. The mesh is rebuilt as each arrives. */
    const SKY = new Map(), SLA = 0.2, SLO = 0.24; let skyActive = 0;
    function skyBuild() {
      if (W.sky) { W.sky.e.destroy(); W.sky.meshes.forEach(m => m.dispose()); W.sky = null; } W.stats.skyline = 0; if (!W.on) return;
      const ll = H.toLL(S.x, S.z), ci = Math.floor(ll[0] / SLA), cj = Math.floor(ll[1] / SLO), Br = new MeshBuilder(), Bw = new MeshBuilder({ aux: true }), clR = [], clW = [], items = [], seen = new Set();
      for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) { const e = SKY.get((ci + di) + ':' + (cj + dj)); if (!e || !e.feats) continue;
        e.feats.forEach(f => { if (!f || !f.ring || f.h < 20 || seen.has(f.id)) return; seen.add(f.id); const P = ringOf(f); if (!P) return; const r0 = Br.tris, w0 = Bw.tris, bb = [1e9, 0, 1e9, -1e9, f.h, -1e9]; K.addContext(Bw, Br, { P, h: f.h, cls: f.cls, id: f.id }, null, {}); P.forEach(q => { bb[0] = Math.min(bb[0], q[0]); bb[2] = Math.min(bb[2], q[1]); bb[3] = Math.max(bb[3], q[0]); bb[5] = Math.max(bb[5], q[1]); });
          const tk = Math.floor(H.lon2t(f.lo, TZ)) + '/' + Math.floor(H.lat2t(f.la, TZ)), a = clusterOf(r0, Br.tris, bb, tk), b = clusterOf(w0, Bw.tris, bb, tk); clR.push(a); clW.push(b); items.push(a, b); }); }
      if (!items.length) return; const e = scene.createEntity('Skyline (buildings over 30 m, to the horizon)', { parent: group, transient: true }), meshes = [];
      [[Br, skyRoof, clR], [Bw, M.wall, clW]].forEach(([Bd, mat, cl]) => { if (Bd.empty) return; const mesh = Bd.build(dev, { name: 'skyline' }); mesh.clusters = cl; mesh.maskable = true; const mr = e.add('MeshRenderer'); mr.mesh = mesh; mr.material = mat; mr.castShadow = false; mr.pickable = false; meshes.push(mesh); });
      W.sky = { e, meshes, items }; W.stats.skyline = clR.length; skyMask(); H.need(2);
    }
    function skyline() {
      if (!env.context) return; const ll = H.toLL(S.x, S.z), ci = Math.floor(ll[0] / SLA), cj = Math.floor(ll[1] / SLO), want = [];
      for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) { const k = (ci + di) + ':' + (cj + dj); let e = SKY.get(k); if (!e) { e = { k, i: ci + di, j: cj + dj, state: 'new', feats: null, at: 0 }; SKY.set(k, e); } if (e.state === 'new' || (e.state === 'failed' && performance.now() - e.at > 30000)) want.push(e); }
      want.sort((a, b) => Math.hypot((a.i + 0.5) * SLA - ll[0], (a.j + 0.5) * SLO - ll[1]) - Math.hypot((b.i + 0.5) * SLA - ll[0], (b.j + 0.5) * SLO - ll[1]));
      while (skyActive < 2 && want.length) { const e = want.shift(); e.state = 'fetching'; skyActive++;
        Promise.resolve().then(() => env.context({ s: e.i * SLA, n: (e.i + 1) * SLA, w: e.j * SLO, e: (e.j + 1) * SLO }, { minH: 30 })).then(list => { skyActive--; e.state = 'done'; e.feats = list || []; skyBuild(); skyline(); }).catch(() => { skyActive--; e.state = 'failed'; e.at = performance.now(); }); }
      const sig = ci + ':' + cj + ':' + S.gen; if (sig !== W.skySig) { W.skySig = sig; skyBuild(); }
    }
    /* a tall building is drawn by its tile once the tile is built, and by the skyline until then */
    function skyMask() { if (!W.sky) return; W.sky.items.forEach(c => { const t = W.tiles.get(c.key); c.hidden = !!(t && t.state === 'built'); }); }
    W.debug = () => ({ on: W.on, reach: W.reach, tiles: [...W.tiles.values()].map(t => t.key + ':' + t.state + ':' + t.n + (t.far ? 'f' : '')), stats: Object.assign({}, W.stats), data: DATA.size, queue: buildQ.length, active });
    return W;
  }
  SE.WideKit = WideKit;

  /* ==== rooftop scout on the engine: the heating and cooling a building most likely has, as a model ==== */
  /* Nobody has been inside these buildings. What the atlas has is the kind of building, its footprint, its height and
     floor area, and from those the system such a building most often carries in Dallas–Fort Worth (the same reading the
     card gives in words: a split system with the furnace in the attic, packaged units on the roof, a central plant with
     chillers and a tower, a through-the-wall unit per hotel room). This file turns that reading into shapes: the outdoor
     units where they would stand, the indoor units where they are usually put, trunks and branches to registers laid
     out over the floor plan, pipes up the core. It is a likely arrangement, laid out by rule from the footprint, and it
     is labelled as that wherever it is shown. Sizes are the trade's usual ones for the tonnage the reading implies. */
  function HvacKit(engine, K, S, env) {
    const dev = engine.device, H = {}, hex = K.hexRGB, flow = c => [c[0], c[1], c[2], 0.9];
    const C = { supply: flow(hex('#39a9ff')), ret: flow(hex('#ffb24a')), refr: flow(hex('#ff62d0')), chw: flow(hex('#4d79ff')), cw: flow(hex('#2ccf8f')), hw: flow(hex('#ff5548')), gas: flow(hex('#ffe14d')), exh: flow(hex('#c7a2ff')),
      unit: hex('#f2f4f5'), out: hex('#c3d0c6'), reg: hex('#9ad8ff'), grille: hex('#ffd08a'), dark: hex('#5b6266'), heat: hex('#ff8a7a') };
    H.legend = [['#39a9ff', 'Supply air (ducts, registers)'], ['#ffb24a', 'Return air'], ['#ff62d0', 'Refrigerant lines'], ['#4d79ff', 'Chilled water'], ['#2ccf8f', 'Condenser water (to the tower)'], ['#ff5548', 'Heating: boilers, hot water, unit heaters'], ['#ffe14d', 'Gas'], ['#c7a2ff', 'Exhaust and flues'], ['#f2f4f5', 'Equipment: air handlers, furnaces, chillers, rooftop units']];
    /* the reading, or a plain one where the card's is not there (the tests' made-up buildings) */
    H.sysOf = b => { if (b.sys && b.sys.life) return b.sys; const c = b.cls || 'unk', h = env.height(b), fl = Math.max(1, Math.round((h - 1) / 3.6)), sq = b.sqft || 0;
      if (c === 'sf' || c === 'mh') return { life: 'res', units: sq > 3300 ? 2 : 1, short: 'Gas furnace with central AC', gas: 0.6 };
      if (c === 'mf') return fl >= 5 ? { life: 'plant', units: 2, short: 'Central plant' } : { life: 'res', units: Math.max(2, Math.round(sq * fl / 1000)), short: 'A split system per unit' };
      if (c === 'hotel') return { life: 'ptac', units: 40, short: 'PTAC in each room' }; if (['garage', 'shed'].includes(c)) return { life: 'none', units: 0, short: 'None expected' }; if (c === 'parking') return { life: 'none', units: 0, short: 'Ventilation only' };
      if (['whse', 'ind', 'indh', 'indf', 'avn'].includes(c)) return { life: 'rtu', units: Math.max(1, Math.round(sq * 0.12 / 350 / 8.5)), short: 'Unit heaters, rooftop units over the office' };
      return fl >= 5 ? { life: 'plant', units: 2, short: 'Central plant: chillers, boilers, air handlers' } : { life: 'rtu', units: Math.max(1, Math.round(sq * fl / 375 / 10)), short: 'Packaged rooftop units' }; };
    /* the statistics and the inference built on them (95c); without them the plain rule above still gives a system */
    const INF = SE.HvacInfer(env.hvacStats || (typeof window !== 'undefined' && window.__HVAC_STATS__) || null); if (INF.ok && env.hvacTractFields) INF.setTractFields(env.hvacTractFields); H.infer = INF;
    const WHS = ['whse', 'ind', 'indh', 'indf', 'avn', 'util', 'ag'];
    const oldCode = b => { const sy = H.sysOf(b), c = b.cls || 'unk'; if (sy.life === 'res') { if (c === 'mf') return 'units:elec'; const hp = sy.mix ? /Heat pump/.test(sy.mix[0][0]) : false, gas = sy.mix ? /Gas/.test(sy.mix[0][0]) : (sy.gas || 0) > 0.5; return hp ? 'split:hp' : gas ? 'split:gas' : 'split:elec'; }
      if (sy.life === 'ptac') return 'ptac:elec'; if (sy.life === 'plant') return 'plant:water'; if (sy.life === 'rtu') return WHS.includes(c) ? 'whse:part' : 'rooftop:gas'; return c === 'parking' ? 'vent' : 'none'; };
    /* one building's reading: the inference with the evidence the page holds for it now, kept until that evidence changes */
    const reads = new Map(), chosen = new Map();
    H.read = b => { let ev = null; try { ev = env.hvacEvidence ? env.hvacEvidence(b) : null; } catch (e) { ev = null; } const ver = (ev && ev.ver) || 0, r0 = reads.get(b.id); if (r0 && r0.ver === ver) return r0;
      let inf = null; if (INF.ok) { try { inf = INF.infer({ cls: b.cls, sqft: b.sqft, h: env.height(b), yb: b.yb, ybSrc: b.ybSrc }, ev || {}); } catch (e) { inf = null; } }
      const r = { ver, inf, top: inf ? inf.top.k : oldCode(b) }; reads.set(b.id, r); if (reads.size > 6000) reads.delete(reads.keys().next().value); return r; };
    /* the system drawn: the most likely one, unless the reader asked to see an alternative */
    H.code = b => chosen.get(b.id) || H.read(b).top; H.pick = (id, code) => { if (code) chosen.set(id, code); else chosen.delete(id); }; H.picked = id => chosen.get(id) || null;
    /* a footprint's own axes: along its longest wall and across it */
    function frameOf(P) { let best = 0, ux = 1, uz = 0; for (let i = 0; i < P.length; i++) { const a = P[i], c = P[(i + 1) % P.length], dx = c[0] - a[0], dz = c[1] - a[1], l = Math.hypot(dx, dz); if (l > best) { best = l; ux = dx / l; uz = dz / l; } }
      const vx = -uz, vz = ux; let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9; P.forEach(q => { const a = q[0] * ux + q[1] * uz, b = q[0] * vx + q[1] * vz; a0 = Math.min(a0, a); a1 = Math.max(a1, a); b0 = Math.min(b0, b); b1 = Math.max(b1, b); });
      const ca = (a0 + a1) / 2, cb = (b0 + b1) / 2, F = { ux, uz, vx, vz, lu: (a1 - a0) / 2, lv: (b1 - b0) / 2, yaw: Math.atan2(ux, uz) };
      F.pt = (a, b) => [ux * (ca + a) + vx * (cb + b), uz * (ca + a) + vz * (cb + b)]; F.inside = (a, b, m) => { const q = F.pt(a, b); if (!Poly.contains(P, q[0], q[1])) return false; if (!m) return true; return [[m, 0], [-m, 0], [0, m], [0, -m]].every(o => { const r = F.pt(a + o[0], b + o[1]); return Poly.contains(P, r[0], r[1]); }); };
      /* a grid of points over the plan, kept where they fall inside it */
      F.grid = (du, dv, m, y) => { const out = [], nu = Math.max(1, Math.round(2 * F.lu / du)), nv = Math.max(1, Math.round(2 * F.lv / dv)); for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) { const a = -F.lu + (i + 0.5) * 2 * F.lu / nu, b = -F.lv + (j + 0.5) * 2 * F.lv / nv; if (F.inside(a, b, m)) out.push([a, b]); } return out; };
      return F; }
    /* ---------- the layout: boxes and runs in the building's own frame, some of them out of doors ---------- */
    const layouts = new Map();
    H.layout = (b, code) => {
      code = code || H.code(b); const rd0 = H.read(b), f0 = rd0 && rd0.inf ? rd0.inf.facts : null, key = b.id + '|' + code + (f0 ? '|' + f0.floors + ':' + (f0.units || 0) + ':' + Math.round((f0.living || 0) / 250) : ''); let L = layouts.get(key); if (L) return L; const rings = K.ringsOf(b); L = { boxes: [], runs: [], ext: [], kind: 'none', text: '', n: 0, code }; layouts.set(key, L); if (layouts.size > 700) layouts.delete(layouts.keys().next().value);
      if (!rings.length) return L; let P = rings[0]; rings.forEach(r => { if (Math.abs(Poly.area(r)) > Math.abs(Poly.area(P))) P = r; });
      const F = frameOf(P), sys = H.sysOf(b), h = Math.max(2.4, env.height(b)), flat = env.flat ? env.flat(b) : true, c = b.cls || 'unk', rnd = k => hash01(b.id + k), yawU = F.yaw;
      const fam = INF.family(code), vr = code.split(':')[1] || '', rd = H.read(b), facts = rd && rd.inf ? rd.inf.facts : null, areaM = Math.abs(Poly.area(P));
      const box = (a, bb, y, hx, hy, hz, col, o) => { const q = F.pt(a, bb), it = [q[0], y, q[1], hx, hy, hz, yawU + ((o && o.turn) || 0), col]; L.boxes.push(it); if (o && o.ext) L.ext.push(it); return it; };
      const pt = (a, bb, y) => { const q = F.pt(a, bb); return [q[0], y, q[1]]; }, run = (p, q, w, hg, col) => L.runs.push([p, q, w, hg, col]);
      /* a run that goes along the long axis first, then across, then up or down: the way ducts and pipes are hung */
      const route = (a0, b0, y0, a1, b1, y1, w, hg, col) => { if (Math.abs(y1 - y0) > 0.05 && Math.abs(a1 - a0) + Math.abs(b1 - b0) < 0.05) { run(pt(a0, b0, y0), pt(a1, b1, y1), w, hg, col); return; } if (Math.abs(a1 - a0) > 0.05) run(pt(a0, b0, y0), pt(a1, b0, y0), w, hg, col); if (Math.abs(b1 - b0) > 0.05) run(pt(a1, b0, y0), pt(a1, b1, y0), w, hg, col); if (Math.abs(y1 - y0) > 0.05) run(pt(a1, b1, y0), pt(a1, b1, y1), w, hg, col); };
      /* one floor's air: a trunk along the plan from the unit, branches to registers in the ceiling, one return grille near the unit */
      const floorAir = (ua, ub, yT, yC, spacing, o) => { o = o || {}; const regs = F.grid(spacing, spacing, 0.5).slice(0, o.cap || 40); if (!regs.length) return 0; let a0 = ua, a1 = ua; regs.forEach(r => { a0 = Math.min(a0, r[0]); a1 = Math.max(a1, r[0]); });
        const tw = o.tw || 0.42, th = o.th || 0.3; if (a1 - a0 > 0.2) run(pt(a0, ub, yT), pt(a1, ub, yT), tw, th, C.supply);
        regs.forEach(r => { run(pt(r[0], ub, yT), pt(r[0], r[1], yT), o.bw || 0.2, o.bw || 0.2, C.supply); run(pt(r[0], r[1], yT), pt(r[0], r[1], yC), 0.16, 0.16, C.supply); box(r[0], r[1], yC, 0.17, 0.025, 0.1, C.reg); });
        if (!o.noReturn) { const ra = ua + (ua < 0 ? 1 : -1) * 1.3, rb = ub + 0.9 * (ub > 0 ? -1 : 1); if (F.inside(ra, rb)) { box(ra, rb, yC, 0.3, 0.03, 0.22, C.grille); route(ra, rb, yC + 0.05, ua, ub, yT, 0.4, 0.3, C.ret); } }
        return regs.length; };
      /* a place just outside a long wall, for what stands on the ground */
      const outside = (a, side, off) => { for (let d = F.lv + off; d < F.lv + off + 3; d += 0.5) { if (!F.inside(a, side * d) && !F.inside(a, side * (d - 0.45))) return side * d; } return side * (F.lv + off); };
      const side = rnd('side') < 0.5 ? 1 : -1, floorsRes = h > 7 && !flat ? 2 : 1, eave = flat ? h : Math.max(2.4, h - clamp(F.lv * 0.45, 0.8, 2.4));
      if (fam === 'split') {
        /* a house: condenser on a pad beside it, furnace and coil (or an air handler) lying in the attic, ducts over the ceiling */
        L.kind = 'split'; const liv = facts && facts.living ? facts.living : areaM * 10.76 * 0.82 * (h > 7.2 ? 2 : 1), n = clamp(sys.life === 'res' && sys.units ? sys.units : liv > 5800 ? 3 : liv > 3300 ? 2 : 1, 1, 3), gas = vr === 'gas', hp = vr === 'hp', roomH = vr === 'room';
        for (let i = 0; i < n; i++) { const ca = clamp(-F.lu * 0.5 + i * 1.25, -F.lu + 0.6, F.lu - 0.6), cb = outside(ca, side, 0.75), ua = clamp(-F.lu * 0.12 + i * 2.2, -F.lu + 1.2, F.lu - 1.2), yA = eave + 0.36;
          box(ca, cb, 0.05, 0.5, 0.05, 0.5, C.dark, { ext: 1 }); box(ca, cb, 0.55, 0.4, 0.45, 0.4, C.out, { ext: 1, tag: 'cond' }); box(ca, cb, 1.02, 0.3, 0.02, 0.3, C.dark, { ext: 1 });
          box(ua, 0, yA, 0.3, 0.28, 0.8, C.unit, { turn: Math.PI / 2 }); if (!roomH) box(ua + 0.62, 0, yA, 0.3, 0.3, 0.26, gas ? C.heat : C.unit, { turn: Math.PI / 2 }); if (hp) box(ca, cb, 1.12, 0.12, 0.08, 0.12, C.refr, { ext: 1 });
          /* refrigerant lines: out of the condenser, up the wall, across the attic to the coil */
          route(ca, cb - side * 0.4, 0.5, ca, side * (F.lv - 0.1), 0.5, 0.05, 0.05, C.refr); run(pt(ca, side * (F.lv - 0.1), 0.5), pt(ca, side * (F.lv - 0.1), yA), 0.05, 0.05, C.refr); route(ca, side * (F.lv - 0.1), yA, ua, 0, yA, 0.05, 0.05, C.refr);
          if (gas) { run(pt(ua + 0.62, 0, yA + 0.3), pt(ua + 0.62, 0, h + 0.55), 0.13, 0.13, C.exh); L.ext.push([F.pt(ua + 0.62, 0)[0], h + 0.45, F.pt(ua + 0.62, 0)[1], 0.09, 0.2, 0.09, yawU, C.dark]);
            const ga = clamp(ca + 1.1, -F.lu + 0.4, F.lu - 0.4), gb = side * (F.lv + 0.18); box(ga, gb, 0.55, 0.16, 0.22, 0.1, C.gas, { ext: 1 }); run(pt(ga, gb, 0.7), pt(ga, side * (F.lv - 0.1), yA - 0.12), 0.035, 0.035, C.gas); route(ga, side * (F.lv - 0.1), yA - 0.12, ua + 0.62, 0, yA - 0.12, 0.035, 0.035, C.gas); }
          /* upstairs from the attic; a second system, or a house on two floors, feeds the ground floor from between the floors */
          const lower = floorsRes > 1 && (n > 1 ? i === 1 : true), upper = !(floorsRes > 1 && n > 1 && i === 1);
          if (upper) L.n += floorAir(ua, (i - (n - 1) / 2) * 0.9, yA, eave - 0.03, 3.4, { cap: 14 });
          if (lower) { const yF = eave - 2.95; run(pt(ua, 0.5, yA), pt(ua, 0.5, yF + 0.3), 0.3, 0.3, C.supply); L.n += floorAir(ua, 0.5, yF + 0.3, yF, 3.6, { cap: 12 }); } }
        if (roomH) { [-0.5, 0.45].forEach(t => { const ha = F.lu * t, hb = -side * (F.lv - 0.4); if (F.inside(ha, hb)) box(ha, hb, 0.38, 0.14, 0.32, 0.3, C.heat); }); const ga = clamp(-F.lu * 0.6, -F.lu + 0.4, F.lu - 0.4); box(ga, -side * (F.lv + 0.18), 0.55, 0.1, 0.22, 0.16, C.gas, { ext: 1 }); run(pt(-F.lu * 0.6, -side * (F.lv - 0.4), 0.1), pt(F.lu * 0.5, -side * (F.lv - 0.4), 0.1), 0.035, 0.035, C.gas); }
        L.text = (hp ? 'Heat pump outside, air handler in the attic' : gas ? 'AC condenser outside, gas furnace and coil in the attic, flue through the roof' : roomH ? 'AC condenser outside and a cooling coil in the attic; gas room heaters, no furnace' : 'AC condenser outside, electric air handler with strip heat in the attic') + (n > 1 ? ' (' + n + ' systems)' : '') + '; ducts over the ceiling to ' + L.n + ' registers';
      } else if (fam === 'window') {
        /* no central system: a unit in a window of each main room, a heater against the wall, no ducts at all */
        L.kind = 'window'; const st = h > 7.2 && !flat ? 2 : 1, cool = code !== 'nocool:room', furn = vr === 'furn', gasH = vr === 'gas' || code === 'nocool:room', n = clamp(Math.round(areaM * st / 30), 2, c === 'sf' || c === 'mh' ? 6 : 16), per = Math.ceil(n / 2); let nh = 0;
        for (let i = 0; i < n; i++) { const sd = i % 2 ? 1 : -1, a = -F.lu + (Math.floor(i / 2) + 0.5) * 2 * F.lu / per, y = (st > 1 && i % 4 >= 2 ? 3.0 : 0) + 1.35; if (!F.inside(a, sd * (F.lv - 0.5))) continue;
          if (cool) { box(a, sd * (F.lv + 0.14), y, 0.3, 0.2, 0.3, C.unit, { ext: 1 }); box(a, sd * (F.lv - 0.36), y + 0.02, 0.12, 0.16, 0.26, C.reg); L.n++; }
          if (!furn && y < 2) { const ha = a + 0.95; if (F.inside(ha, sd * (F.lv - 0.5))) { box(ha, sd * (F.lv - 0.36), 0.38, 0.13, 0.32, 0.3, C.heat); nh++; } } }
        if (gasH || furn) { const ga = clamp(-F.lu * 0.6, -F.lu + 0.4, F.lu - 0.4), gb = side * (F.lv + 0.18); box(ga, gb, 0.55, 0.1, 0.22, 0.16, C.gas, { ext: 1 });
          if (furn) { box(0, 0, 0.22, 0.32, 0.3, 0.46, C.heat); box(0, 0, 0.55, 0.3, 0.02, 0.42, C.grille); run(pt(0.6, 0, 0.3), pt(0.6, 0, h + 0.5), 0.13, 0.13, C.exh); L.ext.push([F.pt(0.6, 0)[0], h + 0.42, F.pt(0.6, 0)[1], 0.09, 0.2, 0.09, yawU, C.dark]); route(ga, side * (F.lv - 0.3), 0.1, 0, 0, 0.1, 0.035, 0.035, C.gas); }
          else { [1, -1].forEach(sd => run(pt(-F.lu + 0.5, sd * (F.lv - 0.36), 0.1), pt(F.lu - 0.5, sd * (F.lv - 0.36), 0.1), 0.035, 0.035, C.gas)); run(pt(ga, -(F.lv - 0.36), 0.1), pt(ga, F.lv - 0.36, 0.1), 0.035, 0.035, C.gas); } }
        L.text = (cool ? L.n + ' window or wall units, one to a room' : 'No air conditioning') + (furn ? '; a gas floor or wall furnace in the middle of the house, flue through the roof' : gasH ? '; ' + nh + ' gas room heaters on a line under the floor' : '; ' + nh + ' electric room heaters') + '. No ducts';
      } else if (fam === 'minisplit') {
        /* ductless: a head high on the wall of each main room, a small condenser outside, a line set between them */
        L.kind = 'minisplit'; const st = h > 7.2 && !flat ? 2 : 1, n = clamp(Math.round(areaM * st / 42), 1, c === 'sf' || c === 'mh' || c === 'garage' ? 5 : 12), per = Math.ceil(n / 2);
        for (let i = 0; i < n; i++) { const sd = i % 2 ? 1 : -1, a = -F.lu + (Math.floor(i / 2) + 0.5) * 2 * F.lu / per, y0 = st > 1 && i % 4 >= 2 ? 3.0 : 0; if (!F.inside(a, sd * (F.lv - 0.5))) continue; const cb = outside(a, sd, 0.5);
          box(a, sd * (F.lv - 0.2), y0 + 2.15, 0.11, 0.14, 0.42, C.unit); box(a, sd * (F.lv - 0.36), y0 + 1.98, 0.05, 0.02, 0.36, C.reg);
          if (i % 2 === 0 || n <= 2 || true) { box(a, cb, 0.42, 0.15, 0.28, 0.4, C.out, { ext: 1 }); box(a, cb, 0.08, 0.2, 0.05, 0.45, C.dark, { ext: 1 }); }
          run(pt(a, sd * (F.lv - 0.1), y0 + 2.15), pt(a, sd * (F.lv - 0.1), 0.45), 0.05, 0.05, C.refr); run(pt(a, sd * (F.lv - 0.1), 0.45), pt(a, cb, 0.45), 0.05, 0.05, C.refr); L.n++; }
        L.text = L.n + ' ductless mini-split head' + (L.n === 1 ? '' : 's') + ' on the walls, each with a small heat pump outside. No ducts';
      } else if (fam === 'units') {
        /* apartments: an air handler in each unit's closet, its condenser on the roof (or on the ground beside a small building) */
        L.kind = 'units'; const fl = clamp(Math.round((h - 1.2) / 3.2), 1, 12), fh = h / fl, perFloor = clamp(Math.round(2 * F.lu / 8), 1, 14), onRoof = flat && fl >= 2; let drawn = 0;
        for (let f = 0; f < fl; f++) for (let k = 0; k < perFloor; k++) for (const sd of [1, -1]) { if (drawn >= 84) break; const a = -F.lu + (k + 0.5) * 2 * F.lu / perFloor, bb = sd * Math.min(F.lv * 0.3, 1.6); if (!F.inside(a, bb, 0.4) || F.lv < 3.2) { if (sd < 0 || F.lv >= 3.2) continue; }
            const yC = (f + 1) * fh - 0.35, bU = F.lv < 3.2 ? 0 : bb; box(a, bU, yC - 0.3, 0.28, 0.42, 0.28, C.unit); run(pt(a, bU, yC), pt(a, sd * F.lv * 0.78, yC), 0.3, 0.22, C.supply); [0.45, 0.78].forEach(t => box(a, sd * F.lv * t, yC - 0.14, 0.15, 0.025, 0.1, C.reg)); box(a + 0.6, bU, yC - 0.14, 0.24, 0.03, 0.18, C.grille); drawn++; L.n++;
            if (onRoof) { const ra = a + (f - (fl - 1) / 2) * 0.95, rb = sd * 0.75; if (F.inside(ra, rb, 0.5)) { box(ra, rb, h + 0.45, 0.36, 0.4, 0.36, C.out, { ext: 1 }); box(ra, rb, h + 0.87, 0.26, 0.02, 0.26, C.dark, { ext: 1 }); run(pt(a, bU, yC), pt(a, bU, h + 0.1), 0.045, 0.045, C.refr); route(a, bU, h + 0.1, ra, rb, h + 0.1, 0.045, 0.045, C.refr); } }
            else { const ca = a + (f - (fl - 1) / 2) * 0.95, cb = outside(ca, sd, 0.7); box(ca, cb, 0.5, 0.36, 0.42, 0.36, C.out, { ext: 1 }); box(ca, cb, 0.94, 0.26, 0.02, 0.26, C.dark, { ext: 1 }); run(pt(a, bU, yC), pt(a, sd * (F.lv - 0.1), yC), 0.045, 0.045, C.refr); run(pt(a, sd * (F.lv - 0.1), yC), pt(ca, sd * (F.lv - 0.1), 0.5), 0.045, 0.045, C.refr); } }
        const nU = facts && facts.units ? facts.units : sys.units; L.text = 'A split ' + (vr === 'hp' ? 'heat pump' : 'system') + ' for each apartment: ' + (vr === 'gas' ? 'gas furnace and coil' : vr === 'hp' ? 'air handler' : 'air handler with electric strip heat') + ' in a closet, ' + (vr === 'hp' ? 'heat pump ' : 'condenser ') + (onRoof ? 'on the roof' : 'beside the building') + (nU ? ' (about ' + nU + ' apartments)' : '');
      } else if (fam === 'ptac') {
        /* a hotel: a unit through the wall under each room's window; the corridors get outside air from a unit on the roof */
        L.kind = 'ptac'; const fl = clamp(Math.round((h - 1.2) / 3.1), 1, 40), fh = h / fl, rooms = Math.max(2, Math.round(2 * F.lu / 3.9)); let drawn = 0;
        for (let f = 0; f < fl; f++) for (let k = 0; k < rooms; k++) for (const sd of [1, -1]) { if (drawn >= 520) break; const a = -F.lu + (k + 0.5) * 2 * F.lu / rooms; if (!F.inside(a, sd * (F.lv - 0.6))) continue; box(a, sd * (F.lv - 0.02), f * fh + 0.42, 0.53, 0.21, 0.24, C.unit, { ext: 1 }); box(a, sd * (F.lv - 0.3), f * fh + 0.66, 0.5, 0.02, 0.1, C.reg); drawn++; }
        if (F.inside(0, 0, 1)) { box(0, 0, h + 0.75, 1.5, 0.6, 0.95, C.unit, { ext: 1 }); box(0, 0, h + 0.1, 1.3, 0.1, 0.8, C.dark, { ext: 1 }); run(pt(0.5, 0, h + 0.2), pt(0.5, 0, fh - 0.4), 0.5, 0.5, C.supply); run(pt(-0.5, 0, h + 0.4), pt(-0.5, 0, fh - 0.4), 0.4, 0.4, C.exh); box(-F.lu * 0.5, 0, h + 0.4, 0.4, 0.3, 0.4, C.exh, { ext: 1 });
          for (let f = 0; f < fl; f++) { const y = (f + 1) * fh - 0.4; run(pt(-F.lu * 0.86, 0, y), pt(F.lu * 0.86, 0, y), 0.4, 0.25, C.supply); } }
        if (vr === 'boiler' && F.inside(1.6, 0, 0.8)) { box(1.6, 0, 1.0, 0.5, 0.9, 0.5, C.heat); run(pt(1.6, 0, 1.9), pt(1.6, 0, h + 1.0), 0.22, 0.22, C.exh); for (let f = 0; f < fl; f++) [1, -1].forEach(sd => run(pt(-F.lu * 0.9, sd * (F.lv - 0.3), f * fh + 0.2), pt(F.lu * 0.9, sd * (F.lv - 0.3), f * fh + 0.2), 0.06, 0.06, C.hw)); run(pt(1.6, 0, 0.2), pt(1.6, 0, (fl - 1) * fh + 0.2), 0.1, 0.1, C.hw); run(pt(1.6, -(F.lv - 0.3), 0.2), pt(1.6, F.lv - 0.3, 0.2), 0.08, 0.08, C.hw); }
        L.n = drawn; L.text = 'A through-the-wall ' + (vr === 'hp' ? 'heat pump (PTHP)' : 'unit (PTAC)') + ' in each room, about ' + drawn + ' drawn' + (vr === 'boiler' ? ', heated by hot water from a boiler' : vr === 'hp' ? '' : ', electric heat') + '; a rooftop unit feeds the corridors';
      } else if (fam === 'warehouse') {
        /* a warehouse: gas unit heaters and big fans over the floor, exhaust fans on the roof, a rooftop unit over the office at one end */
        L.kind = 'warehouse'; const yH = Math.max(3, h - 1.4), nH = clamp(Math.round(2 * F.lu / 18), 1, 14);
        for (let k = 0; k < nH; k++) for (const sd of [1, -1]) { const a = -F.lu + (k + 0.5) * 2 * F.lu / nH, bb = sd * (F.lv - 1.1); if (!F.inside(a, bb, 0.4)) continue; box(a, bb, yH, 0.38, 0.32, 0.42, C.heat); run(pt(a, bb, yH + 0.3), pt(a, bb, h + 0.5), 0.1, 0.1, C.exh); L.n++; }
        [1, -1].forEach(sd => run(pt(-F.lu + 1, sd * (F.lv - 0.6), yH + 0.2), pt(F.lu - 1, sd * (F.lv - 0.6), yH + 0.2), 0.05, 0.05, C.gas));
        const nF = clamp(Math.round(2 * F.lu / 26), 1, 8); for (let k = 0; k < nF; k++) { const a = -F.lu + (k + 0.5) * 2 * F.lu / nF; if (!F.inside(a, 0, 2)) continue; box(a, 0, h - 1.0, 3.2, 0.03, 0.22, C.unit); box(a, 0, h - 1.0, 0.22, 0.03, 3.2, C.unit); box(a, 0, h - 0.6, 0.2, 0.4, 0.2, C.dark); if (F.inside(a + 6, 0, 1)) { box(a + 6, 0, h + 0.35, 0.5, 0.3, 0.5, C.exh, { ext: 1 }); } }
        const nR = vr === 'heat' ? 0 : clamp(sys.life === 'rtu' && sys.units ? sys.units : Math.round(areaM * 10.76 * 0.12 / 350 / 8.5), 1, 4); for (let i = 0; i < nR; i++) { const a = -F.lu + 3 + i * 4.2, bb = side * Math.max(0, F.lv - 3.5); if (!F.inside(a, bb, 1.2)) continue; box(a, bb, h + 0.12, 1.0, 0.12, 0.66, C.dark, { ext: 1 }); box(a, bb, h + 0.8, 1.15, 0.56, 0.75, C.unit, { ext: 1, tag: 'rtu' }); run(pt(a - 0.4, bb, h + 0.2), pt(a - 0.4, bb, 3.1), 0.45, 0.45, C.supply); run(pt(a + 0.4, bb, h + 0.2), pt(a + 0.4, bb, 3.3), 0.4, 0.35, C.ret); run(pt(a - 0.4, bb, 3.1), pt(a - 0.4, bb - side * 3, 3.1), 0.4, 0.25, C.supply); box(a - 0.4, bb - side * 3, 2.8, 0.2, 0.03, 0.2, C.reg); }
        L.text = 'Gas unit heaters and big fans over the floor (' + L.n + ' heaters drawn), exhaust fans on the roof' + (nR ? ', ' + (nR === 1 ? 'a rooftop unit' : nR + ' rooftop units') + ' over the office' : '; no cooling');
      } else if (fam === 'rooftop' || fam === 'csplit') {
        /* shops and low offices: packaged units on the roof, each dropping a supply trunk into the ceiling under it */
        L.kind = fam; const spl = fam === 'csplit', fl = clamp(facts && facts.floors ? facts.floors : Math.round((h - 0.8) / 3.9), 1, 4), fh = h / fl, n = clamp(sys.life === 'rtu' && sys.units ? sys.units : Math.round(areaM * 10.76 * fl / 375 / (spl ? 5 : 8.5)), 1, 24), tons = Math.max(2, areaM * 10.76 * fl / 375 / n), big = tons > 12 ? 2 : tons > 6 ? 1 : 0, sz = [[1.05, 0.5, 0.68], [1.45, 0.62, 0.9], [2.1, 0.8, 1.1]][big];
        const nu = Math.max(1, Math.round(Math.sqrt(n * F.lu / Math.max(F.lv, 1)))), nv = Math.max(1, Math.ceil(n / nu)); let placed = 0; const spots = [];
        for (let i = 0; i < nu && placed < n; i++) for (let j = 0; j < nv && placed < n; j++) { const a = -F.lu + (i + 0.5) * 2 * F.lu / nu, bb = -F.lv + (j + 0.5) * 2 * F.lv / nv; if (!F.inside(a, bb, sz[0] + 0.6)) continue; spots.push([a, bb]); placed++; }
        if (!spots.length && F.inside(0, 0)) spots.push([0, 0]);
        spots.forEach(([a, bb], i) => { if (spl) { box(a, bb, h + 0.08, 0.5, 0.06, 0.5, C.dark, { ext: 1 }); box(a, bb, h + 0.55, 0.4, 0.42, 0.4, C.out, { ext: 1 }); box(a, bb, h + 0.99, 0.3, 0.02, 0.3, C.dark, { ext: 1 }); box(a - 0.3, bb, fl * fh - 0.42, 0.34, 0.3, 0.7, vr === 'gas' ? C.heat : C.unit); run(pt(a, bb, h + 0.3), pt(a, bb, fl * fh - 0.3), 0.05, 0.05, C.refr); if (vr === 'gas') run(pt(a - 0.3, bb + 0.5, fl * fh - 0.2), pt(a - 0.3, bb + 0.5, h + 0.6), 0.12, 0.12, C.exh); }
          else { box(a, bb, h + 0.12, sz[0] - 0.12, 0.12, sz[2] - 0.1, C.dark, { ext: 1 }); box(a, bb, h + 0.24 + sz[1], sz[0], sz[1], sz[2], C.unit, { ext: 1, tag: 'rtu' }); box(a + sz[0] * 0.45, bb, h + 0.25 + 2 * sz[1], sz[0] * 0.4, 0.03, sz[2] * 0.7, C.dark, { ext: 1 }); box(a - sz[0] - 0.22, bb, h + 0.2 + sz[1] * 0.9, 0.22, sz[1] * 0.55, sz[2] * 0.8, C.out, { ext: 1 }); }
          for (let f = fl - 1; f >= 0; f--) { const yT = (f + 1) * fh - 0.55, yC = (f + 1) * fh - 0.95, zu = F.lu / nu * 0.8, zv = F.lv / nv * 0.72;
            if (f === fl - 1) { run(pt(a - 0.3, bb, h + 0.24), pt(a - 0.3, bb, yT), 0.5, 0.45, C.supply); run(pt(a + 0.45, bb, h + 0.24), pt(a + 0.45, bb, yC + 0.1), 0.45, 0.4, C.ret); box(a + 0.45, bb, yC, 0.32, 0.03, 0.32, C.grille); } else if (i % 2 === 0) run(pt(a - 0.3, bb, (f + 2) * fh - 0.55), pt(a - 0.3, bb, yT), 0.4, 0.35, C.supply); else continue;
            run(pt(a - zu, bb, yT), pt(a + zu, bb, yT), 0.5, 0.32, C.supply); [-0.6, 0.6].forEach(ta => { const da = a + zu * ta; run(pt(da, bb - zv, yT), pt(da, bb + zv, yT), 0.28, 0.22, C.supply); [-1, 1].forEach(tb => { const db = bb + zv * tb; if (F.inside(da, db)) { box(da, db, yC, 0.3, 0.03, 0.3, C.reg); L.n++; } }); }); } });
        if (spots.length && vr === 'gas') { const s0 = spots[0], gb = side * (F.lv + 0.2); box(s0[0], gb, 0.6, 0.2, 0.28, 0.12, C.gas, { ext: 1 }); run(pt(s0[0], side * (F.lv - 0.05), 0.6), pt(s0[0], side * (F.lv - 0.05), h + 0.1), 0.05, 0.05, C.gas); let pa = s0[0], pb = side * (F.lv - 0.05); spots.forEach(sp => { route(pa, pb, h + 0.1, sp[0], sp[1] + sz[2], h + 0.1, 0.05, 0.05, C.gas); pa = sp[0]; pb = sp[1] + sz[2]; }); }
        L.text = spl ? spots.length + ' split system' + (spots.length === 1 ? '' : 's') + ' (about ' + Math.round(tons) + ' tons each): condenser' + (spots.length === 1 ? '' : 's') + ' on the roof, ' + (vr === 'gas' ? 'gas furnaces' : vr === 'hp' ? 'heat pump air handlers' : 'electric air handlers') + ' above the ceiling, ducts to ' + L.n + ' diffusers' : spots.length + ' packaged rooftop ' + (vr === 'hp' ? 'heat pump' : 'unit') + (spots.length === 1 ? '' : 's') + ' (about ' + Math.round(tons) + ' tons each), ' + (vr === 'gas' ? 'gas heat' : vr === 'hp' ? 'heating by reversing the cycle' : 'electric heat') + ', ducts in the ceiling to ' + L.n + ' diffusers';
      } else if (fam === 'pvav') {
        /* mid-size offices and schools: a few large units on the roof, a duct riser, a main duct round each floor, a VAV box for every zone */
        L.kind = 'pvav'; const fl = clamp(facts && facts.floors ? facts.floors : Math.round((h - 1) / 4), 1, 40), fh = h / fl, tons = areaM * 10.76 * fl / 350, nU = clamp(Math.round(tons / 60), 1, 4), W = F.lu * 0.84;
        const us = []; for (let i = 0; i < nU; i++) { const a = -F.lu + (i + 0.5) * 2 * F.lu / nU; let ok = F.inside(a, 0, 1.6) ? [a, 0] : null; if (!ok) { const g = F.grid(6, 6, 1.6); if (g.length) ok = g[Math.min(g.length - 1, i)]; } if (ok) us.push(ok); }
        us.forEach(([a, bb]) => { box(a, bb, h + 0.14, 1.2, 0.14, 2.5, C.dark, { ext: 1 }); box(a, bb, h + 1.2, 1.25, 0.95, 2.6, C.unit, { ext: 1, tag: 'rtu' }); box(a, bb - 0.0, h + 2.2, 0.9, 0.04, 1.1, C.dark, { ext: 1 }); box(a + 3.0, bb, h + 0.95, 1.1, 0.7, 0.35, C.out, { ext: 1 });
          run(pt(a - 0.7, bb, h + 0.3), pt(a - 0.7, bb, fh - 0.6), 0.9, 0.7, C.supply); run(pt(a + 0.9, bb, h + 0.3), pt(a + 0.9, bb, fh - 0.9), 0.8, 0.6, C.ret);
          if (vr === 'gas') run(pt(a + 1.4, bb + 1.0, h + 0.5), pt(a + 1.4, bb + 1.0, h + 2.6), 0.16, 0.16, C.exh); });
        if (us.length) { const u0 = us[0];
          for (let f = 0; f < fl; f++) { const yT = (f + 1) * fh - 0.55, yC = (f + 1) * fh - 0.95, light = fl > 8 && f % (fl > 20 ? 3 : 2) !== 0; run(pt(-W, u0[1], yT), pt(W, u0[1], yT), 0.9, 0.42, C.supply); box(u0[0] + 0.9, u0[1], yC, 0.4, 0.03, 0.4, C.grille);
            if (vr === 'boiler') run(pt(-W, u0[1] + 0.7, yT + 0.1), pt(W, u0[1] + 0.7, yT + 0.1), 0.07, 0.07, C.hw); if (light) continue;
            const nB = clamp(Math.round(2 * W / 8.5), 1, 14); for (let k = 0; k < nB; k++) { const a = -W + (k + 0.5) * 2 * W / nB; for (const sd of [1, -1]) { const bb = u0[1] + sd * Math.max(2, (F.lv - 1.6) * 0.62); if (!F.inside(a, bb, 0.5)) continue;
                run(pt(a, u0[1], yT), pt(a, bb, yT), 0.32, 0.24, C.supply); box(a, u0[1] + sd * 1.5, yT, 0.36, 0.2, 0.3, vr === 'boiler' ? C.heat : C.unit); box(a, bb, yC, 0.3, 0.03, 0.3, C.reg); const b2 = u0[1] + sd * Math.max(1, (F.lv - 1.6) * 0.3); if (F.inside(a, b2)) box(a, b2, yC, 0.3, 0.03, 0.3, C.reg); L.n++; } } }
          if (vr === 'boiler') { const ba = u0[0] + 2.2, bb = u0[1] + 0.7; if (F.inside(ba, bb, 0.6)) { box(ba, bb, 1.0, 0.55, 0.95, 0.55, C.heat); run(pt(ba, bb, 1.9), pt(ba, bb, h + 1.3), 0.22, 0.22, C.exh); run(pt(ba - 0.6, bb, 0.6), pt(ba - 0.6, bb, fl * fh - 0.45), 0.1, 0.1, C.hw); } }
          if (vr === 'gas') { const gb = side * (F.lv + 0.2); box(u0[0], gb, 0.6, 0.12, 0.28, 0.2, C.gas, { ext: 1 }); run(pt(u0[0], side * (F.lv - 0.05), 0.6), pt(u0[0], side * (F.lv - 0.05), h + 0.12), 0.05, 0.05, C.gas); let pa = u0[0], pb = side * (F.lv - 0.05); us.forEach(u => { route(pa, pb, h + 0.12, u[0] + 1.2, u[1] + 1.3, h + 0.12, 0.05, 0.05, C.gas); pa = u[0] + 1.2; pb = u[1] + 1.3; }); } }
        L.text = us.length + ' large packaged rooftop unit' + (us.length === 1 ? '' : 's') + ' (about ' + Math.round(tons / Math.max(1, us.length)) + ' tons each) feeding ' + L.n + ' VAV boxes on ' + fl + (fl === 1 ? ' floor' : ' floors') + '; ' + (vr === 'boiler' ? 'hot water reheat from a boiler' : vr === 'gas' ? 'gas heat at the units, electric reheat at the boxes' : 'electric reheat at the boxes');
      } else if (fam === 'wshp' || fam === 'vrf') {
        /* a unit for every zone, tied together by one loop: water to a tower and a boiler (or the ground), or refrigerant to outdoor units on the roof */
        L.kind = fam; const wl = fam === 'wshp', ground = vr === 'ground', fl = clamp(facts && facts.floors ? facts.floors : Math.round((h - 1.5) / 3.6), 1, 60), fh = h / fl, core = F.inside(0, 0, 2) ? [0, 0] : (F.grid(6, 6, 2)[0] || [0, 0]), ca = core[0], cb = core[1], W = F.lu * 0.86, tons = areaM * 10.76 * fl / 400, col = wl ? C.cw : C.refr;
        if (wl) { [-0.2, 0.2].forEach(da => run(pt(ca + da, cb + 1.0, ground ? -1.5 : 0.6), pt(ca + da, cb + 1.0, ground ? fl * fh - 0.5 : h + 0.9), 0.22, 0.22, C.cw));
          if (ground) { box(ca, cb + 1.0, 0.5, 0.5, 0.45, 0.9, C.dark); for (let i = -2; i <= 2; i++) { const ga = ca + i * 3.2, gb = outside(ga, side, 2.5); run(pt(ga, gb, 0.2), pt(ga, gb, -9), 0.09, 0.09, C.cw); run(pt(ga, gb, 0.2), pt(ca, cb + 1.0, 0.2), 0.07, 0.07, C.cw); } }
          else { if (F.inside(ca, cb + 1.0, 1.8)) { box(ca, cb + 1.0, h + 2.2, 1.8, 2.0, 1.8, C.out, { ext: 1, tag: 'tower' }); box(ca, cb + 1.0, h + 4.45, 1.25, 0.25, 1.25, C.dark, { ext: 1 }); box(ca, cb + 1.0, h + 0.12, 1.9, 0.12, 1.9, C.dark, { ext: 1 }); } const ba = ca + 3.6; if (F.inside(ba, cb + 1.0, 0.8)) { box(ba, cb + 1.0, h + 1.0, 0.6, 0.9, 0.6, C.heat, { ext: 1 }); run(pt(ba, cb + 1.0, h + 1.9), pt(ba, cb + 1.0, h + 3.0), 0.2, 0.2, C.exh); run(pt(ca + 0.2, cb + 1.0, h + 0.5), pt(ba, cb + 1.0, h + 0.5), 0.2, 0.2, C.hw); } [-1, 0, 1].forEach(i => box(ca + i * 1.2, cb - 0.4, h + 0.45, 0.3, 0.3, 0.45, C.dark, { ext: 1 })); } }
        else { const nO = clamp(Math.round(tons / 22), 1, 8); for (let i = 0; i < nO; i++) { const a = ca - (nO - 1) * 0.75 + i * 1.5; if (!F.inside(a, cb + 1.6, 0.7)) continue; box(a, cb + 1.6, h + 0.1, 0.45, 0.08, 0.65, C.dark, { ext: 1 }); box(a, cb + 1.6, h + 1.02, 0.4, 0.85, 0.6, C.out, { ext: 1 }); box(a, cb + 1.6, h + 1.9, 0.3, 0.03, 0.45, C.dark, { ext: 1 }); } run(pt(ca, cb + 1.0, h + 0.4), pt(ca, cb + 1.0, fh - 0.5), 0.14, 0.14, C.refr); run(pt(ca, cb + 1.0, h + 0.4), pt(ca, cb + 1.6, h + 0.4), 0.14, 0.14, C.refr); }
        /* outside air: one unit on the roof, a riser, a small duct along each floor */
        if (F.inside(ca - 3.2, cb - 0.8, 1.2)) { box(ca - 3.2, cb - 0.8, h + 0.75, 0.8, 0.6, 1.4, C.unit, { ext: 1 }); box(ca - 3.2, cb - 0.8, h + 0.1, 0.7, 0.1, 1.2, C.dark, { ext: 1 }); run(pt(ca - 3.2, cb - 0.8, h + 0.2), pt(ca - 3.2, cb - 0.8, fh - 0.5), 0.5, 0.5, C.supply); }
        let drawn = 0; for (let f = 0; f < fl; f++) { const yT = (f + 1) * fh - 0.5, yC = (f + 1) * fh - 0.92, light = fl > 24 && f % 2 === 1; run(pt(-W, cb + 1.0, yT), pt(W, cb + 1.0, yT), wl ? 0.16 : 0.09, wl ? 0.16 : 0.09, col); run(pt(-W, cb - 0.8, yT + 0.1), pt(W, cb - 0.8, yT + 0.1), 0.35, 0.22, C.supply); if (light || drawn > 620) continue;
          const nB = clamp(Math.round(2 * W / 7.5), 1, 14); for (let k = 0; k < nB; k++) { const a = -W + (k + 0.5) * 2 * W / nB; for (const sd of [1, -1]) { const bb = cb + sd * Math.max(2.2, (F.lv - 1.4) * 0.6); if (!F.inside(a, bb, 0.5)) continue; run(pt(a, cb + 1.0, yT), pt(a, bb, yT), wl ? 0.07 : 0.05, wl ? 0.07 : 0.05, col);
                if (wl) { box(a, bb, yT, 0.3, 0.22, 0.48, C.unit); run(pt(a, bb, yT), pt(a + 1.6, bb, yT), 0.3, 0.22, C.supply); box(a + 1.6, bb, yC, 0.3, 0.03, 0.3, C.reg); } else { box(a, bb, yC + 0.1, 0.42, 0.11, 0.42, C.unit); box(a, bb, yC - 0.03, 0.3, 0.02, 0.3, C.reg); } drawn++; } } }
        L.n = drawn; L.text = wl ? 'About ' + drawn + ' water-source heat pumps drawn, one to a zone on ' + fl + (fl === 1 ? ' floor' : ' floors') + ', on a shared water loop ' + (ground ? 'to bore holes in the ground' : 'to a cooling tower and a boiler on the roof') + '; outside air from a unit on the roof' : 'VRF: outdoor units on the roof, refrigerant piping down the core to about ' + drawn + ' ceiling cassettes on ' + fl + (fl === 1 ? ' floor' : ' floors') + '; outside air from a unit on the roof';
      } else if (fam === 'plant' || fam === 'fancoil') {
        /* a tall or a large building: chillers and boilers, a cooling tower on the roof, pipes up the core, an air handler and its ducts (or a fan coil in every room) on every floor */
        L.kind = fam; const air = vr === 'air', dist = vr === 'district', fc = fam === 'fancoil', fl = clamp(facts && facts.floors > 1 ? facts.floors : Math.round((h - 1.5) / 3.9), fc ? 1 : 2, 70), fh = h / fl, nCh = clamp(sys.life === 'plant' && sys.units ? sys.units - 1 : Math.round(areaM * 10.76 * fl / 180000) + 1, 1, 3), core = F.inside(0, 0, 2) ? [0, 0] : (F.grid(6, 6, 2)[0] || [0, 0]), ca = core[0], cb = core[1];
        if (dist) { [[C.chw, -0.9], [C.hw, 0.95]].forEach(([col, da]) => { box(ca + da, cb + 3.0, 0.9, 0.5, 0.7, 0.9, C.unit); const ob = side * (F.lv + 2.5); run(pt(ca + da, cb + 3.0, 0.4), pt(ca + da, ob, 0.4), 0.3, 0.3, col); run(pt(ca + da, ob, 0.4), pt(ca + da, ob, -1.2), 0.3, 0.3, col); }); }
        else if (air) { for (let i = 0; i < nCh; i++) { const a = ca - (nCh - 1) * 1.6 + i * 3.2, bb = cb + 3.6; if (!F.inside(a, bb, 1.6)) continue; box(a, bb, h + 0.14, 1.15, 0.14, 2.7, C.dark, { ext: 1 }); box(a, bb, h + 1.35, 1.1, 1.05, 2.6, C.out, { ext: 1, tag: 'chiller' }); [-1.6, 0, 1.6].forEach(dz => box(a, bb, h + 2.43, 0.8, 0.03, 0.6, C.dark, { ext: 1, turn: 0 })); run(pt(ca - 0.9, cb + 1.2, h + 0.6), pt(a, bb, h + 0.6), 0.3, 0.3, C.chw); } }
        else { for (let i = 0; i < nCh; i++) { const a = ca - 4 + i * 3.2; box(a, cb + 3.4, 1.0, 0.8, 0.8, 2.1, C.unit); run(pt(a - 0.5, cb + 1.4, 1.1), pt(a - 0.5, cb + 5.4, 1.1), 0.75, 0.75, C.chw); run(pt(a + 0.5, cb + 1.4, 1.1), pt(a + 0.5, cb + 5.4, 1.1), 0.75, 0.75, C.cw); } }
        if (!dist) [0, 1].forEach(i => { box(ca + 3.2 + i * 1.7, cb + 3.2, 1.05, 0.65, 1.05, 0.9, C.heat); run(pt(ca + 3.2 + i * 1.7, cb + 3.2, 2.1), pt(ca + 3.2 + i * 1.7, cb + 3.2, h + 1.2), 0.25, 0.25, C.exh); });
        [-1, 0, 1].forEach(i => box(ca + i * 1.5, cb + 0.6, 0.45, 0.35, 0.35, 0.5, C.dark));
        /* risers: chilled water, condenser water, hot water, each a pair */
        [[C.chw, -0.9, 0.16], [C.chw, -0.55, 0.16], [C.cw, 0.0, 0.2], [C.cw, 0.4, 0.2], [C.hw, 0.95, 0.11], [C.hw, 1.22, 0.11]].forEach(([col, da, r]) => { if (col === C.cw && (air || dist)) return; run(pt(ca + da, cb + 1.2, 0.9), pt(ca + da, cb + 1.2, col === C.cw ? h + 0.9 : (air && col === C.chw ? h + 0.6 : h - fh * 0.4)), r * 2, r * 2, col); });
        const nT = air || dist ? 0 : nCh; for (let i = 0; i < nT; i++) { const a = ca - (nT - 1) * 2.1 + i * 4.2, bb = cb + 1.2; if (!F.inside(a, bb, 1.8)) continue; box(a, bb, h + 2.2, 1.8, 2.0, 1.8, C.out, { ext: 1, tag: 'tower' }); box(a, bb, h + 4.45, 1.25, 0.25, 1.25, C.dark, { ext: 1 }); box(a, bb, h + 0.12, 1.9, 0.12, 1.9, C.dark, { ext: 1 }); run(pt(ca + 0.2, cb + 1.2, h + 0.9), pt(a, bb, h + 0.9), 0.4, 0.4, C.cw); }
        if (fc) { /* a fan coil at the outside wall of every room, chilled and hot water along both walls, outside air from the roof */
          if (F.inside(ca - 3.2, cb - 0.8, 1.2)) { box(ca - 3.2, cb - 0.8, h + 0.75, 0.8, 0.6, 1.4, C.unit, { ext: 1 }); run(pt(ca - 3.2, cb - 0.8, h + 0.2), pt(ca - 3.2, cb - 0.8, fh - 0.5), 0.5, 0.5, C.supply); }
          let drawn = 0; for (let f = 0; f < fl; f++) { const y0 = f * fh, yT = y0 + fh - 0.5, light = fl > 24 && f % 2 === 1; run(pt(-F.lu * 0.86, cb - 0.8, yT), pt(F.lu * 0.86, cb - 0.8, yT), 0.35, 0.22, C.supply); [1, -1].forEach(sd => { run(pt(-F.lu * 0.9, sd * (F.lv - 0.5), yT), pt(F.lu * 0.9, sd * (F.lv - 0.5), yT), 0.09, 0.09, C.chw); run(pt(-F.lu * 0.9, sd * (F.lv - 0.75), yT), pt(F.lu * 0.9, sd * (F.lv - 0.75), yT), 0.06, 0.06, C.hw); });
            run(pt(ca - 0.9, cb + 1.2, yT), pt(ca - 0.9, F.lv - 0.5, yT), 0.09, 0.09, C.chw); run(pt(ca - 0.9, cb + 1.2, yT), pt(ca - 0.9, -(F.lv - 0.5), yT), 0.09, 0.09, C.chw); if (light || drawn > 640) continue;
            const nR = clamp(Math.round(2 * F.lu / 4.2), 1, 30); for (let k = 0; k < nR; k++) for (const sd of [1, -1]) { const a = -F.lu + (k + 0.5) * 2 * F.lu / nR, bb = sd * (F.lv - 0.6); if (!F.inside(a, sd * (F.lv - 0.9))) continue; box(a, bb, y0 + fh - 0.72, 0.26, 0.14, 0.5, C.unit); box(a, sd * (F.lv - 1.3), y0 + fh - 0.92, 0.1, 0.02, 0.4, C.reg); drawn++; } }
          L.n = drawn; L.text = 'About ' + drawn + ' fan coils drawn, one at the outside wall of each room on ' + fl + (fl === 1 ? ' floor' : ' floors') + ', fed with chilled and hot water from ' + (air ? 'an air-cooled chiller on the roof' : 'chillers and a cooling tower') + ' and boilers; outside air from a unit on the roof'; }
        else { for (let f = 0; f < fl; f++) { const y0 = f * fh, yT = y0 + fh - 0.5, yC = y0 + fh - 0.9, light = fl > 30 && f % 2 === 1; box(ca - 2.6, cb - 0.6, y0 + 1.1, 1.3, 0.95, 0.9, C.unit); run(pt(ca - 0.9, cb + 1.2, y0 + 1.2), pt(ca - 1.4, cb - 0.2, y0 + 1.2), 0.14, 0.14, C.chw);
            run(pt(ca - 2.6, cb - 0.6, y0 + 2.0), pt(ca - 2.6, cb - 0.6, yT), 0.8, 0.6, C.supply); run(pt(-F.lu * 0.84, cb - 0.6, yT), pt(F.lu * 0.84, cb - 0.6, yT), 0.85, 0.42, C.supply); box(ca - 4.2, cb - 0.6, yC, 0.45, 0.03, 0.35, C.grille); run(pt(ca - 4.2, cb - 0.6, yC), pt(ca - 3.6, cb - 0.6, y0 + 1.4), 0.5, 0.4, C.ret);
            if (light) continue; const nB = clamp(Math.round(2 * F.lu * 0.84 / 8.5), 1, 12); for (let k = 0; k < nB; k++) { const a = -F.lu * 0.84 + (k + 0.5) * 2 * F.lu * 0.84 / nB; for (const sd of [1, -1]) { const bb = cb - 0.6 + sd * Math.max(2, (F.lv - 1.6) * 0.62); if (!F.inside(a, bb, 0.5)) continue; run(pt(a, cb - 0.6, yT), pt(a, bb, yT), 0.32, 0.24, C.supply); box(a, cb - 0.6 + sd * 1.4, yT, 0.3, 0.2, 0.36, C.unit); box(a, bb, yC, 0.3, 0.03, 0.3, C.reg); const b2 = cb - 0.6 + sd * Math.max(1, (F.lv - 1.6) * 0.3); if (F.inside(a, b2)) box(a, b2, yC, 0.3, 0.03, 0.3, C.reg); L.n++; } } }
          L.text = (dist ? 'Chilled water and heat piped in from a district plant through heat exchangers at the bottom' : air ? nCh + ' air-cooled chiller' + (nCh > 1 ? 's' : '') + ' on the roof, boilers at the bottom' : 'Central plant: ' + nCh + ' chiller' + (nCh > 1 ? 's' : '') + ' and boilers at the bottom, cooling tower on the roof') + ', pipes up the core, an air handler with VAV boxes on each of ' + fl + ' floors'; }
      } else {
        L.kind = 'none'; if (c === 'parking' || code === 'vent') { [1, -1].forEach(sd => [-0.5, 0.5].forEach(t => { if (F.inside(F.lu * t, sd * (F.lv - 1.2))) box(F.lu * t, sd * (F.lv - 1.2), Math.max(2.4, h - 0.8), 0.5, 0.4, 0.5, C.exh); })); L.text = 'Ventilation only: exhaust fans, no comfort cooling expected'; } else L.text = 'No heating or cooling expected here';
      }
      return L;
    };
    /* ---------- the layout as a mesh for the x-ray layer ---------- */
    H.model = b => { const L = H.layout(b); if (!L.boxes.length && !L.runs.length) return null; const Bd = new MeshBuilder();
      L.boxes.forEach(q => Bd.box(q[0], q[1], q[2], q[3], q[4], q[5], q[6], q[7]));
      L.runs.forEach(([p, q, w, hg, col]) => { const dx = q[0] - p[0], dy = q[1] - p[1], dz = q[2] - p[2], hl = Math.hypot(dx, dz); if (Math.abs(dy) > hl) Bd.box((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2, w / 2, Math.abs(dy) / 2 + 0.01, hg / 2, 0, col); else if (hl > 0.02) Bd.box((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2, w / 2, hg / 2, hl / 2 + Math.min(w, hg) * 0.5, Math.atan2(dx, dz), col); });
      return Bd.empty ? null : Bd.build(dev, { name: 'hvac ' + b.id }); };
    /* what stands out of doors (on the roof, on a pad): drawn in the ordinary scene as plain equipment */
    H.exterior = (b, Bd) => { const L = H.layout(b); L.ext.forEach(q => { const d = q[7] === C.dark; Bd.box(q[0], q[1], q[2], q[3], q[4], q[5], q[6], d ? [0.2, 0.21, 0.22, 1] : q[7] === C.gas ? [0.62, 0.56, 0.2, 1] : q[7] === C.exh ? [0.52, 0.53, 0.55, 1] : [0.7, 0.72, 0.72, 1]); }); return L.ext.length; };
    H.clear = () => { layouts.clear(); reads.clear(); chosen.clear(); };
    return H;
  }
  SE.HvacKit = HvacKit;

  /* ==== rooftop scout on the engine: a Freefly Alta X Gen2 to fly ==== */
  /* The aircraft is built to the figures Freefly publishes for it: four motors on four arms, 840 mm (33 inch) folding
     propellers, 1,570 mm across the motors unfolded and 2,273 mm with the propellers turning, 694 mm from the ground to the
     top of the propeller mounts on the standard legs, 450 mm under the chassis, two 12S 16 Ah batteries, a dovetail under
     the chassis for the payload, an FPV camera in the nose, two GPS antennas, skid landing gear. 11.2 kg empty, 34.9 kg
     at most; 40 minutes in the air with nothing under it and 17 with the full 15.1 kg. What the sheet does not give is
     assumed and marked so in SPEC.assumed: the payload carried here, the top speed and climb, the lamp colours, and the
     exact shape of every part (this is a likeness made from the dimensions, not Freefly's drawing).
     It flies the way the real one does in Position mode: the sticks ask for a speed over the ground and a rate of climb,
     the aircraft leans to get them and holds still when they are let go. */
  function AltaKit(engine, K) {
    const dev = engine.device, scene = engine.scene, A = {}, G = 9.81;
    A.SPEC = { name: 'Freefly Alta X Gen2', motors: 4, propM: 0.84, acrossMotorsM: 1.57, acrossPropsM: 2.273, heightM: 0.694, clearanceM: 0.45, emptyKg: 11.2, maxKg: 34.9, payloadMaxKg: 15.1, batteries: 'two 12S 16 Ah (44.4 V)', minutesEmpty: 40.03, minutesFull: 17, tempC: [-20, 50], ingress: 'IP43', autopilot: 'Freefly Skynode (PX4)', gps: 'dual u-blox F9P',
      assumed: { payloadKg: 3.2, payload: 'a stabilised camera head on the dovetail', maxSpeed: 20, climb: 6, descend: 4, yawRate: 95, maxTiltDeg: 28, lamps: 'white forward, red aft' } };
    const SP = A.SPEC, AS = SP.assumed, RM = (SP.acrossPropsM - SP.propM) / 2, hoverMin = lerp(SP.minutesEmpty, SP.minutesFull, AS.payloadKg / SP.payloadMaxKg);
    A.hoverMinutes = hoverMin;
    /* ---------- the airframe ---------- */
    const carbon = [0.085, 0.088, 0.092, 1], dark = [0.14, 0.145, 0.15, 1], metal = [0.55, 0.56, 0.58, 1], batt = [0.11, 0.115, 0.12, 1], accent = [0.82, 0.33, 0.1, 1], lens = [0.03, 0.035, 0.05, 1];
    function tube(Bd, a, b, r, col, seg) { seg = seg || 8; let dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2]; const L = Math.hypot(dx, dy, dz) || 1; dx /= L; dy /= L; dz /= L; const hx = Math.abs(dy) < 0.9 ? 0 : 1, hy = Math.abs(dy) < 0.9 ? 1 : 0;
      let e1 = [hy * dz - 0 * dy, 0 * dx - hx * dz, hx * dy - hy * dx]; const l1 = Math.hypot(e1[0], e1[1], e1[2]) || 1; e1 = [e1[0] / l1, e1[1] / l1, e1[2] / l1]; const e2 = [dy * e1[2] - dz * e1[1], dz * e1[0] - dx * e1[2], dx * e1[1] - dy * e1[0]];
      const n = t => [e1[0] * Math.cos(t) + e2[0] * Math.sin(t), e1[1] * Math.cos(t) + e2[1] * Math.sin(t), e1[2] * Math.cos(t) + e2[2] * Math.sin(t)], at = (p, m) => [p[0] + m[0] * r, p[1] + m[1] * r, p[2] + m[2] * r];
      for (let i = 0; i < seg; i++) { const n0 = n(i / seg * TAU), n1 = n((i + 1) / seg * TAU), nm = n((i + 0.5) / seg * TAU); Bd.quad(at(a, n0), at(a, n1), at(b, n1), at(b, n0), nm, null, col); }
      for (let i = 1; i + 1 < seg; i++) { Bd.tri(at(b, n(0)), at(b, n(i / seg * TAU)), at(b, n((i + 1) / seg * TAU)), [dx, dy, dz], null, null, null, col); Bd.tri(at(a, n(0)), at(a, n((i + 1) / seg * TAU)), at(a, n(i / seg * TAU)), [-dx, -dy, -dz], null, null, null, col); } }
    const body = new MeshBuilder(), yArm = 0.585, yTop = SP.heightM, yUnder = SP.clearanceM, ARMS = [45, 135, 225, 315].map(d => d * RAD);
    tube(body, [0, yUnder, 0], [0, yUnder + 0.15, 0], 0.25, carbon, 10);                             /* the chassis: a flat drum */
    tube(body, [0, yUnder + 0.15, 0], [0, yUnder + 0.165, 0], 0.2, dark, 10);
    [-1, 1].forEach(s => body.box(s * 0.085, yUnder + 0.23, -0.02, 0.075, 0.065, 0.17, 0, batt));       /* two batteries on top */
    [-1, 1].forEach(s => body.box(s * 0.085, yUnder + 0.3, -0.02, 0.05, 0.006, 0.12, 0, accent));
    body.box(0, yUnder + 0.075, 0.262, 0.035, 0.03, 0.02, 0, dark); body.box(0, yUnder + 0.075, 0.285, 0.014, 0.014, 0.008, 0, lens);   /* the FPV camera in the nose */
    [-1, 1].forEach(s => { tube(body, [s * 0.13, yUnder + 0.165, -0.16], [s * 0.13, yUnder + 0.36, -0.16], 0.008, dark, 6); tube(body, [s * 0.13, yUnder + 0.36, -0.16], [s * 0.13, yUnder + 0.385, -0.16], 0.045, [0.9, 0.9, 0.9, 1], 10); });   /* two GPS antennas on masts */
    ARMS.forEach(a => { const sx = Math.sin(a), sz = Math.cos(a), tip = [sx * RM, yArm, sz * RM]; tube(body, [sx * 0.23, yArm - 0.03, sz * 0.23], tip, 0.024, carbon, 8); tube(body, [tip[0], yArm - 0.045, tip[2]], [tip[0], yTop - 0.012, tip[2]], 0.058, metal, 12); tube(body, [tip[0], yTop - 0.012, tip[2]], [tip[0], yTop, tip[2]], 0.03, dark, 8); });
    /* skid landing gear: two skids, each on two legs from under the chassis */
    [-1, 1].forEach(s => { const sx = s * 0.36; tube(body, [sx, 0.016, -0.33], [sx, 0.016, 0.33], 0.016, dark, 6); [-1, 1].forEach(f => tube(body, [s * 0.17, yUnder + 0.02, f * 0.12], [sx, 0.03, f * 0.2], 0.014, carbon, 6)); });
    body.box(0, yUnder - 0.012, 0, 0.07, 0.012, 0.11, 0, metal);                                      /* the dovetail */
    A.bodyMesh = body.build(dev, { name: 'Alta X airframe' });
    const gim = new MeshBuilder(); tube(gim, [0, 0, 0], [0, -0.07, 0], 0.022, dark, 8); gim.box(0, -0.085, 0, 0.11, 0.012, 0.02, 0, dark); [-1, 1].forEach(s => gim.box(s * 0.105, -0.15, 0, 0.01, 0.075, 0.02, 0, dark)); A.yokeMesh = gim.build(dev, { name: 'Alta X payload yoke' });
    const camB = new MeshBuilder(); camB.box(0, 0, 0, 0.085, 0.06, 0.1, 0, [0.16, 0.165, 0.17, 1]); tube(camB, [0, 0, 0.1], [0, 0, 0.19], 0.045, dark, 12); tube(camB, [0, 0, 0.19], [0, 0, 0.195], 0.036, lens, 12); A.camMesh = camB.build(dev, { name: 'Alta X payload camera' });
    const prop = new MeshBuilder(); tube(prop, [0, 0, 0], [0, 0.022, 0], 0.04, dark, 10); [-1, 1].forEach(s => { prop.box(s * 0.125, 0.014, 0, 0.095, 0.004, 0.036, s * 0.05, carbon); prop.box(s * 0.31, 0.014, 0, 0.11, 0.0035, 0.027, s * 0.03, carbon); }); A.propMesh = prop.build(dev, { name: 'Alta X propeller (33 inch, folding)' });
    A.discMesh = new Mesh(dev, Prim.cylinder(SP.propM / 2, SP.propM / 2, 0.003, 28));
    const led = c => { const b = new MeshBuilder(); b.box(0, 0, 0, 0.02, 0.008, 0.02, 0, c); return b.build(dev, { name: 'Alta X lamp' }); };
    const M = { body: new Material({ name: 'Alta X: carbon and metal', vertexColors: true, roughness: 0.42, metallic: 0.25 }), disc: new Material({ name: 'Alta X: propeller blur', albedo: '#101214', alpha: 0.17, blend: 'alpha', twoSided: true, castShadow: false, roughness: 0.6, depthWrite: false }),
      white: new Material({ name: 'Alta X: forward lamps (assumed)', albedo: '#000000', emissive: '#ffffff', emissiveIntensity: 30, model: 'unlit', castShadow: false }), red: new Material({ name: 'Alta X: aft lamps (assumed)', albedo: '#000000', emissive: '#ff2a18', emissiveIntensity: 30, model: 'unlit', castShadow: false }) };
    A.materials = M;
    /* ---------- the aircraft in the scene ---------- */
    const root = scene.createEntity('Freefly Alta X Gen2', { transient: true }), part = (name, mesh, mat, parent) => { const e = scene.createEntity(name, { parent: parent || root, transient: true }), mr = e.add('MeshRenderer'); mr.mesh = mesh; mr.material = mat; mr.pickable = false; return e; };
    part('Airframe', A.bodyMesh, M.body); const yoke = part('Payload yoke', A.yokeMesh, M.body); yoke.transform.setPosition(0, yUnder - 0.024, 0); const camE = part('Payload camera (assumed)', A.camMesh, M.body, yoke); camE.transform.setPosition(0, -0.15, 0);
    const props = ARMS.map((a, i) => { const e = part('Propeller ' + (i + 1), A.propMesh, M.body); e.transform.setPosition(Math.sin(a) * RM, yTop, Math.cos(a) * RM); const d = part('Propeller blur ' + (i + 1), A.discMesh, M.disc); d.transform.setPosition(Math.sin(a) * RM, yTop + 0.016, Math.cos(a) * RM); d.get('MeshRenderer').castShadow = false; return { e, d, dir: i % 2 ? 1 : -1, ang: i * 0.7 }; });
    ARMS.forEach((a, i) => { const e = part('Lamp ' + (i + 1), led([1, 1, 1, 1]), Math.cos(a) > 0 ? M.white : M.red); e.transform.setPosition(Math.sin(a) * RM, yArm - 0.06, Math.cos(a) * RM); e.get('MeshRenderer').castShadow = false; });
    root.setActive(false); A.root = root;
    /* ---------- flight ---------- */
    const st = A.state = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, roll: 0, spin: 0, battery: 1, mode: 'Landed', home: [0, 0], target: null, air: 0, odo: 0, gimbal: -18, pan: 0, warn: '', swaps: 0 };
    A.input = { fwd: 0, right: 0, up: 0, yaw: 0 };
    A.place = (x, z, yaw, floorY) => { st.x = x; st.z = z; st.y = floorY || 0; st.vx = st.vy = st.vz = 0; st.yaw = yaw || 0; st.home = [x, z]; st.mode = 'Landed'; st.spin = 0; st.target = null; pose(); };
    A.show = on => root.setActive(!!on);
    A.takeoff = h => { if (st.mode === 'Landed') { st.mode = 'Taking off'; st.climbTo = st.y + (h || 30); } };
    A.land = () => { if (st.mode !== 'Landed') { st.mode = 'Landing'; st.target = null; } };
    A.rtl = () => { if (st.mode !== 'Landed') { st.mode = 'Return'; st.target = [st.home[0], st.home[1]]; } };
    A.goTo = (x, z, yaw) => { st.target = [x, z]; st.targetYaw = yaw; if (st.mode === 'Landed') A.takeoff(30); else if (st.mode !== 'Taking off') st.mode = 'Go to'; };
    A.minutesLeft = () => st.battery * hoverMin / Math.max(0.6, st.draw || 1);
    function pose() { root.transform.setPosition(st.x, st.y, st.z); Q.fromEuler(root.transform.rotation, st.pitch * RAD, -st.yaw * RAD, st.roll * RAD); root.transform.dirty(); yoke.transform.setEuler(0, -st.pan, 0); camE.transform.setEuler(-st.gimbal - st.pitch, 0, 0); }
    /* env: { floor(x, z) -> the top of whatever is under that point, block(x, z, y) -> is there a wall there at that height, wind: [x, z] } */
    A.update = (dt, env) => {
      dt = Math.min(dt, 0.05); const I = A.input, yr = st.yaw * RAD, fx = Math.sin(yr), fz = -Math.cos(yr), rx = Math.cos(yr), rz = Math.sin(yr), floor = env.floor(st.x, st.z); let wantX = 0, wantZ = 0, wantY = 0, sticks = Math.abs(I.fwd) + Math.abs(I.right) + Math.abs(I.up) > 0.02;
      if (st.mode === 'Landed') { st.y = floor; st.vx = st.vy = st.vz = 0; st.spin = Math.max(0, st.spin - dt * 0.8); if (I.up > 0.3) A.takeoff(0.01); if (st.battery < 0.999 && st.spin === 0 && Math.hypot(st.x - st.home[0], st.z - st.home[1]) < 6) { st.battery = 1; st.swaps++; st.warn = 'Fresh batteries in.'; } }
      else {
        st.spin = Math.min(1, st.spin + dt * 1.6); st.air += dt;
        if (sticks && (st.mode === 'Go to' || st.mode === 'Return' || st.mode === 'Landing') && st.battery > 0.06) { st.mode = 'Position hold'; st.target = null; }
        if (st.mode === 'Taking off') { wantY = st.spin < 0.95 ? 0 : AS.climb * 0.7; if (st.y >= st.climbTo - 0.3 || (sticks && st.y > floor + 1.5)) st.mode = st.target ? 'Go to' : 'Position hold'; }
        else if (st.mode === 'Position hold') { wantX = (fx * I.fwd + rx * I.right) * AS.maxSpeed; wantZ = (fz * I.fwd + rz * I.right) * AS.maxSpeed; wantY = I.up > 0 ? I.up * AS.climb : I.up * AS.descend; }
        else if (st.mode === 'Go to' || st.mode === 'Return') { const t = st.target || st.home, dx = t[0] - st.x, dz = t[1] - st.z, d = Math.hypot(dx, dz), sp = Math.min(st.mode === 'Return' ? 14 : 12, Math.sqrt(2 * 2.2 * Math.max(0, d - 0.3)));
          if (st.mode === 'Return' && st.y < floor + 28 && d > 12) wantY = AS.climb * 0.6; if (d > 0.5) { wantX = dx / d * sp; wantZ = dz / d * sp; if (st.targetYaw == null && d > 6) { const ty = DEG * Math.atan2(dx, -dz), dy = ((ty - st.yaw + 540) % 360) - 180; st.yaw = (st.yaw + clamp(dy, -AS.yawRate * dt, AS.yawRate * dt) + 360) % 360; } }
          else if (st.mode === 'Return') st.mode = 'Landing'; else { st.mode = 'Position hold'; st.target = null; }
          if (st.targetYaw != null) { const dy = ((st.targetYaw - st.yaw + 540) % 360) - 180; st.yaw = (st.yaw + clamp(dy, -AS.yawRate * dt, AS.yawRate * dt) + 360) % 360; } }
        else if (st.mode === 'Landing') { wantY = -Math.min(AS.descend, Math.max(0.6, (st.y - floor) * 0.8)); }
        st.yaw = (st.yaw + I.yaw * AS.yawRate * dt + 360) % 360;
        /* lean to get the speed asked for: the acceleration is what the tilt allows */
        const aMax = G * Math.tan(AS.maxTiltDeg * RAD), wind = env.wind || [0, 0]; let ax = (wantX - st.vx) / 0.55, az = (wantZ - st.vz) / 0.55; const al = Math.hypot(ax, az); if (al > aMax) { ax *= aMax / al; az *= aMax / al; }
        st.vx += ax * dt + wind[0] * 0.02 * dt; st.vz += az * dt + wind[1] * 0.02 * dt; st.vy += clamp((wantY - st.vy) / 0.4, -6, 6) * dt;
        let nx = st.x + st.vx * dt, nz = st.z + st.vz * dt, ny = st.y + st.vy * dt;
        if (env.block(nx, nz, ny)) { if (!env.block(nx, st.z, ny)) { nz = st.z; st.vz = 0; } else if (!env.block(st.x, nz, ny)) { nx = st.x; st.vx = 0; } else { nx = st.x; nz = st.z; st.vx = st.vz = 0; } if (st.mode === 'Go to') { st.mode = 'Position hold'; st.target = null; st.warn = 'A building is in the way: stopped short of it.'; } else if (st.mode === 'Return') wantY = AS.climb; }
        const f2 = env.floor(nx, nz); if (ny <= f2) { ny = f2; if (st.vy < 0) { if (st.mode === 'Landing' || (I.up < -0.3 && Math.hypot(st.vx, st.vz) < 1.5)) { st.mode = 'Landed'; st.vx = st.vz = 0; } st.vy = 0; } }
        st.odo += Math.hypot(nx - st.x, nz - st.z); st.x = nx; st.z = nz; st.y = ny;
        /* how it leans: into its acceleration and against the air it pushes through */
        const sp = Math.hypot(st.vx, st.vz), af = ax * fx + az * fz + (st.vx * fx + st.vz * fz) * sp * 0.012, ar = ax * rx + az * rz + (st.vx * rx + st.vz * rz) * sp * 0.012, k = Math.min(1, dt * 7);
        st.pitch += (clamp(-DEG * Math.atan2(af, G), -AS.maxTiltDeg, AS.maxTiltDeg) - st.pitch) * k; st.roll += (clamp(-DEG * Math.atan2(ar, G), -AS.maxTiltDeg, AS.maxTiltDeg) - st.roll) * k;
        /* the batteries: hovering takes them down in the published time for this payload; speed and climbing take more */
        st.draw = 1 + 0.35 * (sp / AS.maxSpeed) * (sp / AS.maxSpeed) + 0.5 * Math.max(0, st.vy) / AS.climb; st.battery = Math.max(0, st.battery - dt / (hoverMin * 60) * st.draw);
        if (st.battery < 0.15 && st.mode !== 'Return' && st.mode !== 'Landing' && !st.lowSaid) { st.lowSaid = true; st.warn = 'Batteries at 15 percent: returning to where it took off.'; A.rtl(); } if (st.battery > 0.5) st.lowSaid = false; if (st.battery <= 0.02 && st.mode !== 'Landing') { st.mode = 'Landing'; st.warn = 'Batteries empty: landing here.'; }
      }
      if (st.mode === 'Landed') { st.pitch *= 0.8; st.roll *= 0.8; }
      props.forEach(p => { p.ang += p.dir * st.spin * 41 * dt; Q.fromEuler(p.e.transform.rotation, 0, p.ang, 0); p.e.transform.dirty(); const on = st.spin > 0.35; if (p.d.active !== on) p.d.setActive(on); });
      pose(); return st.mode !== 'Landed' || st.spin > 0;
    };
    A.dispose = () => { root.destroy(); };
    return A;
  }
  SE.AltaKit = AltaKit;

  /* ==== rooftop scout on the engine: which heating and cooling system a building most likely has, and how sure ==== */
  /* Nobody has been inside these buildings, so the system is inferred. This file does the inferring in the open:
       1. a starting estimate from statistics for buildings of this kind, size, height and age (which survey or stock
          model each number comes from is kept with it, with its sample size);
       2. moved by what is known about the place: the heating fuel households in the census tract report, and for
          houses the rate at which the county roll records room units in that ZIP;
       3. then by what is on record for this building itself: the appraisal district's own note of its heating and
          air conditioning (Dallas County), and the words in mechanical permits at its address.
     The result is a list of systems with a probability each, the evidence that moved it, and a plain statement of
     what kind of evidence that was. A probability from statistics alone says what such buildings usually have; only
     an appraisal record or a permit says anything about this one. The multipliers applied for records and permit
     words are judgement, stated in the evidence lines as such. */
  function HvacInfer(ST) {
    const I = { ok: !!(ST && ST.house && ST.res && ST.com && ST.cbecs), stats: ST };
    /* code: [layout family, short name, what it is] */
    const SYS = I.systems = {
      'split:gas': ['split', 'Gas furnace with central AC', 'Split system: AC condenser outside, gas furnace and cooling coil inside, ducts to every room'],
      'split:hp': ['split', 'Heat pump, ducted', 'Split heat pump: heat pump outside, air handler inside, ducts to every room'],
      'split:elec': ['split', 'Electric furnace with central AC', 'Split system: AC condenser outside, electric air handler with strip heat inside, ducts to every room'],
      'split:room': ['split', 'Central AC, room gas heaters', 'Central AC through ducts; heat from gas room heaters or a wall furnace, no central furnace'],
      'window:gas': ['window', 'Window units, gas room heaters', 'No central system: window or wall air conditioners; gas space heaters, a floor furnace or a wall furnace for heat'],
      'window:furn': ['window', 'Window units, gas furnace', 'Window or wall air conditioners for cooling; a central gas furnace (often a floor or gravity furnace) for heat'],
      'window:elec': ['window', 'Window units, electric heaters', 'No central system: window or wall air conditioners; electric room heaters'],
      'nocool:room': ['window', 'No air conditioning, room heaters', 'No air conditioning on record; gas or electric room heaters'],
      'minisplit': ['minisplit', 'Ductless mini-splits', 'Ductless mini-split heat pumps: wall-mounted heads inside, small condensers outside, no ducts'],
      'units:elec': ['units', 'Split system per apartment, electric heat', 'A split system for each apartment: air handler with electric strip heat in a closet, its condenser on the roof or the ground'],
      'units:hp': ['units', 'Heat pump per apartment', 'A split heat pump for each apartment: air handler in a closet, heat pump on the roof or the ground'],
      'units:gas': ['units', 'Split system per apartment, gas furnace', 'A split system for each apartment: gas furnace and coil in a closet, condenser on the roof or the ground'],
      'ptac:elec': ['ptac', 'PTAC in each room, electric heat', 'Packaged terminal air conditioners through the wall of each room, electric heat'],
      'ptac:hp': ['ptac', 'PTHP in each room', 'Packaged terminal heat pumps through the wall of each room'],
      'ptac:boiler': ['ptac', 'PTAC in each room, hot water or gas heat', 'Packaged terminal air conditioners through the wall of each room, heated by hot water from a boiler or by gas'],
      'rooftop:gas': ['rooftop', 'Packaged rooftop units, gas heat', 'Packaged rooftop units, each cooling one zone, with gas heat'],
      'rooftop:elec': ['rooftop', 'Packaged rooftop units, electric heat', 'Packaged rooftop units, each cooling one zone, with electric resistance heat'],
      'rooftop:hp': ['rooftop', 'Packaged rooftop heat pumps', 'Packaged rooftop heat pumps, each serving one zone'],
      'csplit:gas': ['csplit', 'Split systems, gas furnaces', 'Residential-style split systems: condensers on the roof or the ground, gas furnaces and coils above the ceiling'],
      'csplit:elec': ['csplit', 'Split systems, electric heat', 'Residential-style split systems: condensers on the roof or the ground, electric air handlers above the ceiling'],
      'csplit:hp': ['csplit', 'Split heat pumps', 'Residential-style split heat pumps: outdoor units on the roof or the ground, air handlers above the ceiling'],
      'pvav:elec': ['pvav', 'Packaged VAV, electric reheat', 'Large packaged rooftop units feeding variable-air-volume boxes, electric reheat at the boxes'],
      'pvav:gas': ['pvav', 'Packaged VAV, gas heat', 'Large packaged rooftop units with gas heat feeding variable-air-volume boxes, electric reheat at the boxes'],
      'pvav:boiler': ['pvav', 'Packaged VAV, hot water reheat', 'Large packaged rooftop units feeding variable-air-volume boxes, hot water reheat from a boiler'],
      'plant:water': ['plant', 'Central plant, water-cooled chillers', 'Central plant: water-cooled chillers and a cooling tower, boilers, air handlers with VAV boxes on each floor'],
      'plant:air': ['plant', 'Central plant, air-cooled chillers', 'Central plant: air-cooled chillers on the roof or the ground, boilers, air handlers with VAV boxes'],
      'plant:district': ['plant', 'District chilled water', 'Chilled water and heat piped in from a district or campus plant; air handlers with VAV boxes inside'],
      'fancoil:water': ['fancoil', 'Fan coils on chillers and boilers', 'A fan coil in each room or zone, fed by chillers, a cooling tower and boilers; outside air from a dedicated unit'],
      'fancoil:air': ['fancoil', 'Fan coils on an air-cooled chiller', 'A fan coil in each room or zone, fed by an air-cooled chiller and a boiler; outside air from a dedicated unit'],
      'wshp': ['wshp', 'Water-source heat pump loop', 'A small water-source heat pump for each zone on a shared water loop, with a cooling tower and a boiler'],
      'wshp:ground': ['wshp', 'Ground-source heat pumps', 'Water-source heat pumps for each zone on a loop to a ground heat exchanger'],
      'vrf': ['vrf', 'VRF (variable refrigerant flow)', 'Variable refrigerant flow: outdoor units on the roof, ceiling cassettes inside on refrigerant piping, outside air from a dedicated unit'],
      'whse:part': ['warehouse', 'Unit heaters; cooling for the office only', 'Gas unit heaters and fans over the floor; a rooftop or split unit cooling the office only'],
      'whse:heat': ['warehouse', 'Unit heaters only, no cooling', 'Gas unit heaters over the floor and exhaust fans; no comfort cooling'],
      'vent': ['none', 'Ventilation only', 'Ventilation only: exhaust fans, no comfort cooling expected'],
      'none': ['none', 'No heating or cooling', 'No heating or cooling expected']
    };
    I.family = k => (SYS[k] || SYS.none)[0]; I.short = k => (SYS[k] || [0, k])[1]; I.long = k => (SYS[k] || [0, 0, k])[2];
    I.famName = { split: 'Ducted split system', window: 'Room units, no ducts', minisplit: 'Ductless mini-splits', units: 'Split system per apartment', ptac: 'Through-the-wall units', rooftop: 'Packaged rooftop units', csplit: 'Split systems', pvav: 'Packaged VAV', plant: 'Central plant', fancoil: 'Fan coils on a plant', wshp: 'Water-source heat pumps', vrf: 'VRF', warehouse: 'Unit heaters', none: 'None' };
    if (!I.ok) { I.infer = () => null; return I; }
    const GAS = new Set(['split:gas', 'split:room', 'window:gas', 'window:furn', 'units:gas', 'rooftop:gas', 'csplit:gas', 'pvav:gas', 'pvav:boiler', 'ptac:boiler']), ELEC = new Set(['split:hp', 'split:elec', 'window:elec', 'units:elec', 'units:hp', 'rooftop:elec', 'rooftop:hp', 'csplit:elec', 'csplit:hp', 'pvav:elec', 'ptac:elec', 'ptac:hp', 'minisplit']);
    const HP = new Set(['split:hp', 'units:hp', 'rooftop:hp', 'csplit:hp', 'ptac:hp', 'minisplit', 'wshp', 'wshp:ground', 'vrf']);
    const DUCTED = new Set(['split', 'units', 'rooftop', 'csplit', 'pvav', 'plant', 'fancoil', 'wshp', 'vrf']);
    const lg = p => Math.log(p / (1 - p)), ex = x => 1 / (1 + Math.exp(-x)), cp = p => Math.max(0.005, Math.min(0.995, p)), isN = v => typeof v === 'number' && isFinite(v);
    const bin = (edges, v) => { let i = 0; while (i < edges.length && v >= edges[i]) i++; return i; };
    const norm = d => { let s = 0; for (const k in d) s += d[k]; const o = {}; if (!(s > 0)) return o; for (const k in d) if (d[k] > 0) o[k] = d[k] / s; return o; };
    const add = (d, k, v) => { if (v > 0) d[k] = (d[k] || 0) + v; }, mixInto = (out, d, w) => { for (const k in d) add(out, k, d[k] * w); return out; };
    const pct = p => (p >= 0.995 ? '99%+' : p < 0.005 ? 'under 1%' : Math.round(p * 100) + '%'), N = v => Math.round(v).toLocaleString('en-US');
    /* a table cell with few samples leans on its parent: (count + K x parent share) / (n + K) */
    const lean = (p, n, parent, K) => { const o = {}; new Set([...Object.keys(p || {}), ...Object.keys(parent || {})]).forEach(k => { o[k] = (((p && p[k]) || 0) * n + K * ((parent && parent[k]) || 0)) / (n + K); }); return o; };
    const counts = c => { let n = 0; for (const k in c) n += c[k]; const p = {}; for (const k in c) p[k] = c[k] / (n || 1); return { p, n }; };
    /* move a distribution so that its gas-heated share (of gas plus electric) is t */
    const refuel = (d, t) => { let g = 0, e = 0; for (const k in d) { if (GAS.has(k)) g += d[k]; else if (ELEC.has(k)) e += d[k]; } if (!(g > 0) || !(e > 0)) return d; const o = {}; for (const k in d) o[k] = GAS.has(k) ? d[k] * t * (g + e) / g : ELEC.has(k) ? d[k] * (1 - t) * (g + e) / e : d[k]; return o; };
    const gasOf = d => { let g = 0, e = 0; for (const k in d) { if (GAS.has(k)) g += d[k]; else if (ELEC.has(k)) e += d[k]; } return g + e > 0 ? g / (g + e) : null; };

    /* ---------- the tract: heating fuel and vintage mix ---------- */
    const REG = { all: 0.363, own: 0.499, rent: 0.159 };     /* gas share of gas plus electric households, 12 counties, ACS 2020-2024 */
    const TF = {}; ((ST.acsFields) || []).forEach((f, i) => { TF[f] = i; });
    I.setTractFields = f => { f.forEach((n, i) => { TF[n] = i; }); };
    const tv = (t, f) => (t && TF[f] != null ? +t[TF[f]] || 0 : 0);
    function gasLocal(kind, ev) {
      const z = ev.z, zipAll = z && isN(z.gas_sh) && isN(z.elec_sh) && z.gas_sh + z.elec_sh > 0 ? z.gas_sh / (z.gas_sh + z.elec_sh) : null;
      /* a ZIP's all-household share, restated for owners or renters by the region's odds ratio */
      const toKind = g => (kind === 'all' ? g : ex(lg(cp(g)) + lg(REG[kind]) - lg(REG.all)));
      const prior = zipAll != null ? toKind(zipAll) : REG[kind], t = ev.tract;
      if (t) { const a = tv(t, kind === 'own' ? 'own_gas' : kind === 'rent' ? 'rent_gas' : 'gas'), b = tv(t, kind === 'own' ? 'own_elec' : kind === 'rent' ? 'rent_elec' : 'elec'), n = a + b;
        if (n >= 25) return { g: (a + 60 * prior) / (n + 60), raw: a / n, n, src: 'tract', kind }; }
      if (zipAll != null) return { g: prior, raw: zipAll, n: 0, src: 'zip', kind };
      return { g: REG[kind], raw: REG[kind], n: 0, src: 'region', kind };
    }
    const RV = ST.res.vint_edges;                             /* 1950, 1960, 1980, 2000, 2010 */
    function tractVint(ev) { const t = ev.tract; if (!t || !(tv(t, 'hu') > 0)) return null; const w = [tv(t, 'y1939') + tv(t, 'y1940'), tv(t, 'y1950'), tv(t, 'y1960') + tv(t, 'y1970'), tv(t, 'y1980') + tv(t, 'y1990'), tv(t, 'y2000'), tv(t, 'y2010') + tv(t, 'y2020')], s = w.reduce((a, b) => a + b, 0); return s > 0 ? w.map(v => v / s) : null; }
    /* ResStock: gas share of central systems, and the heat pump share of the electric ones, by housing group and vintage */
    const RSG = {};
    [['sfd', ['sfd', 'sfa']], ['mf', ['mf2', 'mfl', 'mfm', 'mfh']], ['mh', ['mh']]].forEach(([g, bts]) => {
      const tot = { gas: 0, hp: 0, el: 0 }, by = [0, 1, 2, 3, 4, 5].map(() => ({ gas: 0, hp: 0, el: 0 }));
      bts.forEach(bt => { const T = ST.res.types[bt]; if (!T) return; Object.keys(T.v).forEach(v => { const c = T.v[v], n = c.n, p = c.p; const a = n * ((p['split:gas'] || 0) + (p['split:boiler'] || 0)), h = n * (p['split:hp'] || 0), e = n * (p['split:elec'] || 0); by[+v].gas += a; by[+v].hp += h; by[+v].el += e; tot.gas += a; tot.hp += h; tot.el += e; }); });
      const gAll = tot.gas / ((tot.gas + tot.hp + tot.el) || 1), hAll = tot.hp / ((tot.hp + tot.el) || 1);
      RSG[g] = { gAll, hAll, g: by.map(c => (c.gas + 60 * gAll) / (c.gas + c.hp + c.el + 60)), h: by.map(c => (c.hp + 120 * hAll) / (c.hp + c.el + 120)), n: Math.round(tot.gas + tot.hp + tot.el) };
    });
    /* the tract's share is for all its homes; an older home in it is likelier on gas than a newer one. The shift is the
       ResStock difference between this vintage and the tract's own mix of vintages */
    function vintShift(g, y, ev) { const T = RSG[g], d = i => lg(cp(T.g[i])) - lg(cp(T.gAll)), vi = bin(RV, y), mix = tractVint(ev); let mean = 0; if (mix) for (let i = 0; i < 6; i++) mean += mix[i] * d(i); return d(vi) - mean; }

    /* ---------- homes ---------- */
    function houseCats(y, living, ev) {
      const HV = ST.house, v = bin(HV.vint_edges, y), s = bin(HV.size_edges, living); let p1 = HV.p_not_central[v][s];
      const z = ev.z, R = HV.reg; let pred = R.b[0], how = 'average';
      if (z && z.inc > 0 && z.value > 0) { pred = R.b[0] + R.b[1] * Math.log(z.inc / R.med.inc) + R.b[2] * Math.log(z.value / R.med.value); how = 'income'; }
      const zl = ev.zip && HV.zip_lm[ev.zip]; let lm = pred; if (zl) { const w = zl[1] / (zl[1] + 150); lm = zl[0] * w + pred * (1 - w); how = 'zip'; }
      const o = p1 / Math.max(1e-9, 1 - p1) * Math.exp(lm); p1 = o / (1 + o); const sp = HV.split[v][s];
      return { central: 1 - p1, rr: p1 * sp[0], rc: p1 * sp[1], cr: p1 * sp[2], nc: p1 * sp[3], how, n: HV.n_cell[v][s], zipN: zl ? zl[1] : 0 };
    }
    function housePrior(y, living, ev, grp) {
      const c = houseCats(y, living, ev), G = gasLocal('own', ev), sh = vintShift('sfd', y, ev), t = ex(lg(cp(G.g)) + sh), h = RSG.sfd.h[bin(RV, y)], ms = 0.012, d = {};
      add(d, 'split:gas', c.central * (1 - ms) * t); add(d, 'split:hp', c.central * (1 - ms) * (1 - t) * h); add(d, 'split:elec', c.central * (1 - ms) * (1 - t) * (1 - h)); add(d, 'minisplit', c.central * ms);
      add(d, 'window:gas', c.rr * 0.92); add(d, 'window:elec', c.rr * 0.08); add(d, 'window:furn', c.rc); add(d, 'split:room', c.cr); add(d, 'nocool:room', c.nc);
      return { d, cats: c, gas: G, t, h };
    }
    const RES_MAP = { 'split:gas': 'units:gas', 'split:hp': 'units:hp', 'split:elec': 'units:elec', 'split:boiler': 'units:gas', 'window:gas': 'window:gas', 'window:elec': 'window:elec', 'window:boiler': 'window:gas', 'minisplit': 'minisplit', 'nocool:elec': 'nocool:room', 'nocool:gas': 'nocool:room' };
    function resTable(bt, y) { const T = ST.res.types[bt], c = T.v[bin(RV, y)]; return c ? { p: lean(c.p, c.n, T.all, 40), n: c.n, N: T.n } : { p: T.all, n: 0, N: T.n }; }
    function mfPrior(y, fl, units, ev) {
      const bt = units <= 4 ? 'mf2' : fl <= 3 ? 'mfl' : fl <= 7 ? 'mfm' : 'mfh', T = resTable(bt, y), d = {}; let shared = 0;
      for (const k in T.p) { if (k === 'shared') shared += T.p[k]; else add(d, RES_MAP[k] || k, T.p[k]); }
      /* a shared system: which kind is not in the tables, so it is split by rule (towers on a water loop or fan coils, low buildings on a small chiller) */
      const sh = fl >= 8 ? (y >= 2010 ? { 'wshp': 0.4, 'fancoil:water': 0.3, 'vrf': 0.3 } : { 'wshp': 0.5, 'fancoil:water': 0.42, 'vrf': 0.08 }) : (y >= 2010 ? { 'vrf': 0.4, 'wshp': 0.3, 'fancoil:air': 0.3 } : { 'fancoil:air': 0.55, 'wshp': 0.35, 'plant:air': 0.1 });
      mixInto(d, sh, shared);
      const G = gasLocal('rent', ev), t = ex(lg(cp(G.g)) + vintShift('mf', y, ev)); let o = refuel(norm(d), t);
      /* height: one condenser per apartment stops being practical in a tower (refrigerant line length), a rule and not a statistic */
      const tilt = fl >= 13 ? 60 : fl >= 8 ? 12 : fl >= 5 ? 2.5 : 1; if (tilt > 1) { const q = {}; for (const k in o) q[k] = o[k] * (['wshp', 'fancoil', 'vrf', 'plant'].includes(I.family(k)) ? tilt : 1); o = norm(q); }
      return { d: o, bt, n: T.n, N: T.N, gas: G, t, tilt, shared };
    }
    function mhPrior(y, ev) { const T = resTable('mh', y), d = {}; for (const k in T.p) { const m = k === 'shared' ? null : k === 'split:boiler' ? 'split:gas' : k.startsWith('window:') ? (k === 'window:elec' ? 'window:elec' : 'window:gas') : k.startsWith('nocool') ? 'nocool:room' : k; if (m) add(d, m, T.p[k]); }
      const G = gasLocal('all', ev); return { d: refuel(norm(d), ex(lg(cp(G.g)) + lg(cp(RSG.mh.gAll)) - lg(REG.all))), n: T.n, N: T.N, gas: G }; }

    /* ---------- other buildings ---------- */
    const CS = ST.com, SE_ = CS.size_edges, CV = CS.vint_edges;
    /* statistics class: [ComStock types with weights (by gross sq ft), CBECS activity, group in the central-plant model] */
    function comClass(k, gross) {
      const off = gross < 25000 ? 'SmallOffice' : gross < 100000 ? 'MediumOffice' : 'LargeOffice', hot = gross < 35000 ? 'SmallHotel' : 'LargeHotel';
      const M = { office: [[[off, 1]], 'Office', 'office'], med: [[['Outpatient', 1]], 'Outpatient health care', 'health'], hosp: [[['Hospital', 1]], 'Inpatient health care', 'inpatient'], care: [null, 'Nursing', 'health'],
        hotel: [[[hot, 1]], 'Lodging', 'lodging'], dorm: [null, 'Lodging', 'lodging'], retail: [[['RetailStandalone', 0.55], ['RetailStripmall', 0.45]], 'Retail other than mall', null], strip: [[['RetailStripmall', 1]], 'Strip shopping center', null], store: [[['RetailStandalone', 1]], 'Retail other than mall', null], mall: [null, 'Enclosed mall', null],
        grocery: [[['Grocery', 1]], 'Food sales', null], cstore: [[['QuickServiceRestaurant', 0.5], ['RetailStandalone', 0.5]], 'Food sales', null], qsr: [[['QuickServiceRestaurant', 1]], 'Food service', null], fsr: [[['FullServiceRestaurant', 1]], 'Food service', null], ent: [[['FullServiceRestaurant', 0.5], ['QuickServiceRestaurant', 0.5]], 'Public assembly', 'assembly'],
        school: [[['PrimarySchool', 0.6], ['SecondarySchool', 0.4]], 'Education', 'edu'], college: [[['SecondarySchool', 1]], 'Education', 'edu'], church: [null, 'Religious worship', null], assembly: [null, 'Public assembly', 'assembly'], safety: [null, 'Public order and safety', null], svc: [null, 'Service', null],
        whse: [[['Warehouse', 1]], 'Nonrefrigerated warehouse', null], other: [[['SmallOffice', 0.4], ['RetailStandalone', 0.3], ['Warehouse', 0.3]], null, null] };
      return M[k] || M.other;
    }
    const CLS = { office: 'office', bank: 'office', gov: 'office', med: 'med', vet: 'med', hosp: 'hosp', care: 'care', hotel: 'hotel', dorm: 'dorm', retail: 'retail', svc: 'svc', ent: 'ent', theater: 'assembly', school: 'school', edu: 'school', college: 'college', church: 'church', community: 'assembly', arena: 'assembly', conv: 'assembly', fire: 'safety', mil: 'safety', unk: 'other' };
    const COM_MAP = (k, lodging) => (k.startsWith('split:') ? 'csplit:' + k.slice(6) : k.startsWith('ptac:') && !lodging ? (k === 'ptac:boiler' ? 'csplit:gas' : k === 'ptac:hp' ? 'csplit:hp' : 'csplit:elec') : k.startsWith('room:') ? (lodging ? (k === 'room:gas' ? 'ptac:boiler' : 'ptac:elec') : (k === 'room:gas' ? 'window:gas' : 'window:elec')) : k.startsWith('heatonly') ? 'whse:heat' : k === 'evap' || k === 'other' ? null : k);
    function comStock(type, gross, y, lodging) { const T = CS.types[type]; if (!T) return null; const s = bin(SE_, gross), v = bin(CV, y), all = counts(T.all), cs = T.s[s] ? counts(T.s[s]) : null, cv = T.sv[s + ',' + v] ? counts(T.sv[s + ',' + v]) : null;
      let p = all.p, n = 0; if (cs) { p = lean(cs.p, cs.n, all.p, 25); n = cs.n; } if (cv) { p = lean(cv.p, cv.n, p, 25); n = cv.n; } const d = {}; for (const k in p) { const m = COM_MAP(k, lodging); if (m) add(d, m, p[k]); } return { d: norm(d), n, N: T.n }; }
    function cbecs(pba, gross, lodging) { const T = ST.cbecs.pba[pba]; if (!T) return null; const g = gross <= 10000 ? 0 : gross <= 50000 ? 1 : gross <= 200000 ? 2 : 3, c = T.g[g]; const p = c ? lean(c.p, c.n, T.all, 20) : T.all, d = {}; for (const k in p) { const m = COM_MAP(k, lodging); if (m) add(d, m, p[k]); } return { d: norm(d), n: c ? c.n : 0, N: T.n }; }
    const PLANTISH = k => { const f = I.family(k); return f === 'plant' || f === 'fancoil'; };
    function plantP(gross, fl, grp) { const P = ST.cbecs.plant, b = P.b; let x = b[0] + b[1] * Math.log(Math.max(1000, Math.min(2e6, gross)) / 50000) + b[2] * Math.log(Math.max(1, Math.min(30, fl))); const i = grp ? P.terms.indexOf(grp) : -1; if (i >= 0) x += b[i]; return ex(x); }
    function comPrior(k, gross, fl, y, ev) {
      const [types, pba, grp] = comClass(k, gross), lodging = k === 'hotel' || k === 'dorm'; let d = {}, nC = 0, NC = 0, wC = 0; const used = [];
      if (types) types.forEach(([t, w]) => { const c = comStock(t, gross, y, lodging); if (c) { mixInto(d, c.d, w); nC += c.n * w; NC += c.N * w; wC += w; } });
      const cb = pba ? cbecs(pba, gross, lodging) : null;
      if (wC > 0 && cb) { const a = norm(d), o = {}; mixInto(o, a, 0.65); mixInto(o, cb.d, 0.35); d = o; used.push('comstock', 'cbecs'); } else if (wC > 0) { d = norm(d); used.push('comstock'); } else if (cb) { d = cb.d; used.push('cbecs'); } else { d = { 'rooftop:elec': 0.45, 'rooftop:gas': 0.35, 'csplit:gas': 0.1, 'csplit:elec': 0.1 }; }
      /* chillers or district cooling: the share by size, floors and activity from CBECS replaces the table's own */
      const pp = plantP(gross, fl, grp); let a = 0, b = 0; for (const c in d) { if (PLANTISH(c)) a += d[c]; else b += d[c]; }
      const o = {}; if (a > 0.002) { for (const c in d) o[c] = PLANTISH(c) ? d[c] * pp / a : d[c] * (1 - pp) / (b || 1); } else { for (const c in d) o[c] = d[c] * (1 - pp); const dflt = lodging ? { 'fancoil:water': 0.7, 'fancoil:air': 0.3 } : gross < 100000 ? { 'plant:air': 0.6, 'plant:water': 0.35, 'plant:district': 0.05 } : { 'plant:water': 0.62, 'plant:air': 0.3, 'plant:district': 0.08 }; mixInto(o, dflt, pp); }
      /* the neighbourhood's gas: a mild lean, since it is households' fuel and not this building's */
      const G = gasLocal('all', ev), tilt = Math.sqrt((G.g / (1 - G.g)) / (REG.all / (1 - REG.all))), g0 = gasOf(o); let out = norm(o); if (g0 != null && g0 > 0.01 && g0 < 0.99) out = refuel(out, ex(lg(g0) + Math.log(tilt)));
      return { d: norm(out), used, nC: Math.round(nC), NC: Math.round(NC), cb, pba, types, plant: pp, gas: G, g0, lodging };
    }
    function whsePrior(c, gross, y, ev) {
      const g = gross <= 10000 ? 0 : gross <= 50000 ? 1 : gross <= 200000 ? 2 : 3, W = ST.cbecs.whse[g] || ST.cbecs.whse[1]; let none = W.none, part = W.part, full = W.full;
      if (c === 'indf') { full *= 2.2; none *= 0.4; } else if (c === 'indh') { full *= 0.6; } const s = none + part + full; none /= s; part /= s; full /= s;
      const heatOnly = Math.max(0.2 * none, Math.min(none, W.heated - (1 - W.none) * 0.9)), cs = comStock('Warehouse', gross, y, false), d = {}; add(d, 'whse:part', part); add(d, 'whse:heat', heatOnly); add(d, 'none', none - heatOnly); if (cs) mixInto(d, cs.d, full); else add(d, 'rooftop:gas', full);
      return { d: norm(d), n: W.n, cs, none, part, full };
    }

    function svcPrior(gross, y, ev) { const W = ST.cbecs.svc, cb = cbecs('Service', gross, false), d = {}, cool = {}; for (const k in cb.d) if (k !== 'none' && k !== 'whse:heat') cool[k] = cb.d[k];
      add(d, 'whse:part', W.part); add(d, 'whse:heat', W.none * 0.6); add(d, 'none', W.none * 0.4); mixInto(d, norm(cool), W.full); return { d: norm(d), n: W.n, none: W.none, part: W.part, full: W.full }; }

    /* ---------- what the appraisal district recorded (Dallas County) ---------- */
    const HEATN = ['', 'central', 'central (part of the building)', 'gas space heaters', 'floor furnace', 'wall furnace', 'central gravity furnace', 'radiant', 'radiators', 'none', 'unit or space heaters'], ACN = ['', 'central', 'central (part of the building)', 'window units', 'wall units', 'none', 'forced air, no refrigeration', 'chilled water'];
    I.cadText = c => { const a = []; if (c.h) a.push('heating: ' + HEATN[c.h]); if (c.ac) a.push('air conditioning: ' + ACN[c.ac]); return a.join('; '); };
    /* Dallas CAD commercial class -> statistics class */
    const CADC = [[/OFFICE BUILDING|BANK|SALES OFFICE|GOVERNMENTAL|TECHNICAL BUILDING/, 'office'], [/MEDICAL OFFICE|URGENT CARE|SURGICAL|VETERINARY/, 'med'], [/^HOSPITAL/, 'hosp'], [/NURSING|ASSISTED LIVING|RETIREMENT|SENIOR CITIZEN/, 'care'], [/APARTMENT|LOFT BUILDING/, 'mf'], [/DORMITORY/, 'dorm'], [/HOTEL|MOTEL/, 'hotel'],
      [/RETAIL STRIP|SHOPPING CENTER/, 'strip'], [/SHOPPING MALL|DEPARTMENT STORE/, 'mall'], [/SUPERMARKET/, 'grocery'], [/CONVENIENCE STORE|MINI-MART/, 'cstore'], [/FAST FOOD|DINING PLAY/, 'qsr'], [/RESTAURANT|COCKTAIL|BANQUET/, 'fsr'], [/FREE STANDING RETAIL|DISCOUNT STORE|AUTOMOTIVE DISPLAY|BARBER|LAUNDR|FUNERAL/, 'store'],
      [/WAREHOUSE|OFFICE\/SHOWROOM|TRUCK TERMINAL|LUMBER STORAGE|COLD STORAGE/, 'whse'], [/INDUSTRIAL|FOOD PROCESSING/, 'ind'], [/AUTOMOTIVE SERVICE|MINI LUBES|SERVICE STATION|CAR WASH/, 'svc'], [/CHURCH/, 'church'], [/SCHOOL|DAY NURSERY/, 'school'], [/RECREATION|HEALTH SPA|COUNTRY CLUB|FRATERNAL|AUDITORIUM|THEATER|BOWLING/, 'assembly'],
      [/PARKING GARAGE/, 'parking'], [/UTILITY BUILDING|BARN|GREENHOUSE|HANGAR|RESIDENTIAL GARAGE/, 'shed'], [/DATA CENTER/, 'data'], [/CONVERTED RESIDENCE/, 'house']];
    I.cadClass = name => { if (!name) return null; for (const [re, k] of CADC) if (re.test(name)) return k; return 'other'; };
    /* A home's record names its category outright: the county rates the estimate starts from are counts of these same
       records, so the record is not weighed against them, it replaces them. What is left over (eps) is an allowance for
       a remodel the roll has not caught up with: a judgement, not a statistic. Within the category the estimate keeps
       its own split (gas, heat pump or electric), which the roll does not record. */
    function cadHome(d, cad) {
      const h = cad.h, a = cad.ac, cenH = h === 1 || h === 2 || h === 6, roomH = [3, 4, 5, 7, 8, 10].includes(h), cenA = a === 1 || a === 2, roomA = a === 3 || a === 4, noA = a === 5 || a === 6, fam = k => I.family(k); let want, dflt, eps, fixed = false;
      if (cenA && (cenH || !h)) { want = k => fam(k) !== 'window' && fam(k) !== 'none' && k !== 'split:room'; dflt = { 'split:gas': 0.5, 'split:elec': 0.27, 'split:hp': 0.23 }; eps = 0.02; }
      else if (roomA && roomH) { want = k => k === 'window:gas' || k === 'window:elec'; dflt = h === 3 || h === 4 ? { 'window:gas': 0.96, 'window:elec': 0.04 } : { 'window:gas': 0.6, 'window:elec': 0.4 }; eps = 0.08; fixed = true; }
      else if (roomA && cenH) { want = k => k === 'window:furn'; dflt = { 'window:furn': 1 }; eps = 0.08; fixed = true; }
      else if (roomA) { want = k => fam(k) === 'window' && k !== 'nocool:room'; dflt = { 'window:gas': 0.6, 'window:elec': 0.3, 'window:furn': 0.1 }; eps = 0.08; }
      else if (cenA && roomH) { want = k => k === 'split:room'; dflt = { 'split:room': 1 }; eps = 0.1; fixed = true; }
      else if (noA) { want = k => k === 'nocool:room' || k === 'none'; dflt = h === 9 ? { none: 0.7, 'nocool:room': 0.3 } : { 'nocool:room': 0.9, none: 0.1 }; eps = 0.1; fixed = true; }
      else return null;
      const inC = {}, out = {}; for (const k in d) { if (want(k)) inC[k] = d[k]; else out[k] = d[k]; }
      let a1 = norm(inC); if (fixed || !Object.keys(a1).length) a1 = dflt; const rest = norm(out), o = {}; if (!Object.keys(rest).length) eps = 0; mixInto(o, a1, 1 - eps); mixInto(o, rest, eps); return { d: norm(o), eps };
    }
    /* other buildings: the estimate comes from surveys of other buildings, so the record is weighed against it */
    function cadLik(cad) {
      const h = cad.h, a = cad.ac, roomA = a === 3 || a === 4, noA = a === 5 || a === 6, L = {};
      const each = fn => { for (const k in SYS) { const m = fn(k, I.family(k)); if (m != null) L[k] = m; } };
      {
        if (a === 7) each((k, f) => (f === 'plant' || f === 'fancoil' ? 30 : 1));
        else if (a === 1) each((k, f) => (f === 'none' || k === 'whse:heat' ? 0.05 : f === 'window' ? 0.1 : k === 'whse:part' ? 0.7 : 1));
        else if (a === 2) each((k, f) => (k === 'whse:part' ? 6 : f === 'none' || k === 'whse:heat' ? 0.15 : f === 'window' ? 0.3 : 0.5));
        else if (roomA) each((k, f) => (f === 'window' || f === 'ptac' ? 12 : f === 'minisplit' ? 2 : 0.12));
        else if (noA) each((k, f) => (f === 'none' || k === 'whse:heat' ? (a === 5 ? 15 : 6) : k === 'whse:part' ? (a === 5 ? 0.3 : 1) : (a === 5 ? 0.05 : 0.2)));
        else return null;
        const mul = (k, m) => { L[k] = (L[k] == null ? 1 : L[k]) * m; };
        if (h === 10 || h === 3) ['whse:part', 'whse:heat', 'window:gas'].forEach(k => mul(k, 3));
        if (h && h !== 9) { mul('none', 0.15); mul('vent', 0.15); } else if (h === 9) { mul('whse:heat', 0.2); mul('none', 2); }
      }
      return L;
    }

    /* ---------- the words in mechanical permits at the address ---------- */
    const WORDS = [
      ['heat pump', /heat\s*-?pump|\bh\/p\b|\bhp\s+(system|unit|condens)/i, k => (HP.has(k) ? 6 : GAS.has(k) ? 0.5 : 0.8)],
      ['gas furnace', /gas\s+(furnace|heat|pack|fired|unit)|furnace[^.;]{0,24}gas|\bgas\/elec|\bg\/e\b|\b80\s*%|\b9[0-9]\s*%\s*(afue|furn)/i, k => (GAS.has(k) && k !== 'window:gas' ? 5 : HP.has(k) ? 0.35 : ELEC.has(k) ? 0.5 : 1)],
      ['furnace', /furnace/i, k => (GAS.has(k) ? 2.2 : HP.has(k) ? 0.6 : 1)],
      ['air handler or electric heat', /air\s*handler|\ba\/h\b|\bahu\b|electric\s+(heat|furnace|strip)|heat\s*strip|strip\s*heat|all\s+electric/i, k => (k === 'split:elec' || k === 'units:elec' || k === 'csplit:elec' || k === 'rooftop:elec' ? 2.6 : HP.has(k) ? 2 : GAS.has(k) ? 0.5 : 1)],
      ['mini-split', /mini[\s-]*split|ductless/i, k => (k === 'minisplit' ? 9 : k === 'vrf' ? 2 : 0.8)],
      ['VRF', /\bvrf\b|\bvrv\b|variable\s+refrigerant/i, k => (k === 'vrf' ? 40 : 0.5)],
      ['chiller or cooling tower', /chiller|cooling\s*tower|chilled\s*water/i, (k, f) => (f === 'plant' || f === 'fancoil' ? 25 : k === 'wshp' ? 8 : 0.3)],
      ['boiler', /boiler/i, (k, f) => (f === 'plant' || f === 'fancoil' || k === 'pvav:boiler' || k === 'ptac:boiler' || k === 'wshp' ? 6 : 0.7)],
      ['rooftop or packaged unit', /\brtu'?s?\b|roof\s*-?top|package[d]?\s+(unit|a\/?c|system|hvac)|\bpkg\b|roof\s*curb/i, (k, f) => (f === 'rooftop' || f === 'pvav' ? 8 : k === 'whse:part' ? 3 : f === 'split' || f === 'csplit' || f === 'units' ? 0.5 : f === 'window' || f === 'none' ? 0.1 : 0.7)],
      ['PTAC', /\bptac'?s?\b|\bpthp\b|thr(u|ough)[\s-]*(the[\s-]*)?wall/i, (k, f) => (f === 'ptac' ? 30 : 0.5)],
      ['water-source heat pump', /water\s*-?source|\bwshp\b/i, (k, f) => (f === 'wshp' ? 40 : 0.5)],
      ['VAV', /\bvav\b|variable\s+air/i, (k, f) => (f === 'pvav' || f === 'plant' ? 8 : 0.6)],
      ['window unit', /window\s+(unit|a\/?c)/i, (k, f) => (f === 'window' ? 8 : 0.6)],
      ['unit heater', /unit\s+heater|infra-?red|radiant\s+(tube|heat)/i, (k, f) => (f === 'warehouse' ? 6 : 0.8)],
      ['installed equipment (a change-out or installation)', /change\s*-?out|replac|install|hvac|a\/c|air\s*cond|mechanical/i, (k, f) => (f === 'window' || f === 'none' ? 0.5 : 1)],
      ['central equipment (condenser, coil, tonnage or ductwork)', /condens(er|ing)|evap(orator)?\.?\s*coil|\bcoil\b|split\s+system|\d\s*-?\s*ton\b|\btons?\b|\bseer\b|duct/i, (k, f) => (DUCTED.has(f) ? 1 : f === 'window' || f === 'none' ? 0.01 : k === 'whse:heat' ? 0.1 : 1)]
    ];
    function permitLik(permits) {
      const L = {}, hits = []; if (!permits || !permits.length) return { L: null, hits };
      const seen = new Set(); permits.forEach(p => { if (p.newc) return; const t = String(p.desc || '') + ' ' + String(p.type || ''); WORDS.forEach(([name, re, fn]) => { if (seen.has(name) || !re.test(t)) return; seen.add(name); hits.push({ word: name, year: p.d ? String(p.d).slice(0, 4) : '', src: p.src || '' }); for (const k in SYS) { const m = fn(k, I.family(k)); if (m != null && m !== 1) L[k] = (L[k] == null ? 1 : L[k]) * m; } }); });
      /* "gas furnace" already says furnace: do not count the plain word twice */
      if (seen.has('gas furnace') && seen.has('furnace')) { for (const k in SYS) { const m = WORDS[2][2](k, I.family(k)); if (m !== 1 && L[k] != null) L[k] /= m; } hits.splice(hits.findIndex(x => x.word === 'furnace'), 1); }
      return { L: hits.length ? L : null, hits };
    }
    const apply = (d, L) => { if (!L) return d; const o = {}; for (const k in d) o[k] = d[k] * (L[k] == null ? 1 : L[k]); const n = norm(o); return Object.keys(n).length ? n : d; };

    /* ---------- one building ---------- */
    /* b: { cls, sqft (footprint), h (metres), yb, zip }; ev: { z (the ZIP's record), zip, tract (ACS row), tractId, cad (appraisal record), permits, vint ([[year, weight]] when the year is not known) } */
    I.infer = (b, ev) => {
      ev = ev || {}; const c0 = b.cls || 'unk', acc = c0 === 'garage' || c0 === 'shed', E = [], facts = {}, WH = ['whse', 'ind', 'indh', 'indf', 'avn'];
      /* an outbuilding shares its parcel with the house the record describes: the record is not about it */
      const cad = !acc && ev.cad && (ev.cad.h || ev.cad.ac || ev.cad.yb || ev.cad.cls || ev.cad.res) ? ev.cad : null, h = Math.max(2.4, +b.h || 3), foot = Math.max(60, +b.sqft || 0), sharedParcel = !!(cad && cad.m > 1);
      /* class: the appraisal roll knows what a parcel is used as; FEMA's class is modelled */
      let c = c0, stat = CLS[c0] || null, clsFrom = 'fema';
      if (cad && cad.res) { const k = cad.kind; stat = null;
        if (k === 4) { if (c0 !== 'mh') { c = 'mh'; clsFrom = 'cad'; } } else if (k === 2) { if (c0 !== 'mf' && c0 !== 'sf') { c = 'mf'; clsFrom = 'cad'; } } else if (cad.units >= 2 && !sharedParcel) { if (c0 !== 'mf') { c = 'mf'; clsFrom = 'cad'; } } else if (c0 !== 'sf') { c = 'sf'; clsFrom = 'cad'; } }
      else if (cad && cad.cls) { const k = I.cadClass(cad.cls);
        if (k === 'mf') { if (c0 !== 'mf') { c = 'mf'; clsFrom = 'cad'; } stat = null; } else if (k === 'house') { if (c0 !== 'sf') { c = 'sf'; clsFrom = 'cad'; } stat = null; }
        else if (k === 'whse' || k === 'ind') { if (!WH.includes(c0)) { c = k; clsFrom = 'cad'; } stat = null; } else if (k === 'parking') { if (c0 === 'unk') { c = 'parking'; clsFrom = 'cad'; } } else if (k === 'shed') { if (c0 === 'unk' || c0 === 'ag' || c0 === 'util') { c = 'shed'; clsFrom = 'cad'; } }
        else if (k === 'data') { c = 'data'; stat = null; clsFrom = 'cad'; }
        else if (k && k !== 'other') { if (stat !== k) clsFrom = 'cad'; stat = k; c = k === 'hotel' ? 'hotel' : (['sf', 'mh', 'mf', 'parking', 'ag', 'util', 'hotel'].concat(WH).includes(c0) ? 'unk' : c0); } }
      /* year built: the roll's for this parcel, else the atlas's, else a spread */
      let yb = null, ybFrom = ''; if (cad && cad.yb > 1800 && !(sharedParcel && cad.res)) { yb = cad.yb; ybFrom = 'cad'; } else if (b.yb > 1800) { yb = b.yb; ybFrom = b.ybSrc || 'atlas'; }
      let vint = yb ? [[yb, 1]] : (ev.vint && ev.vint.length ? ev.vint : null);
      if (!vint) { const m = tractVint(ev); vint = m ? [[1938, m[0]], [1955, m[1]], [1970, m[2]], [1990, m[3]], [2005, m[4]], [2016, m[5]]].filter(x => x[1] > 0) : [[1955, 0.12], [1972, 0.25], [1990, 0.3], [2005, 0.2], [2016, 0.13]]; ybFrom = m ? 'tract mix' : 'regional mix'; } else if (!yb) ybFrom = 'ZIP mix';
      const vs = vint.reduce((a, x) => a + x[1], 0) || 1, yMid = vint.reduce((a, x) => a + x[0] * x[1], 0) / vs;
      const overV = fn => { const out = {}; let last = null, lw = -1; vint.forEach(([y, w]) => { const r = fn(y); mixInto(out, r.d, w / vs); if (w > lw) { lw = w; last = r; } }); return { d: norm(out), last }; };
      /* size and floors */
      const stH = h < 7.2 ? 1 : h < 10.8 ? 2 : 3, resSt = cad && cad.res && cad.st ? cad.st / 2 : stH, living = cad && cad.res && cad.sf > 200 && !sharedParcel ? cad.sf : foot * 0.82 * stH;
      const flM = Math.max(1, Math.min(60, Math.round((h - 1.5) / 3.3))), hall = ['retail', 'svc', 'ent', 'church', 'community', 'arena', 'conv', 'fire', 'theater'].concat(WH).includes(c) || ['strip', 'store', 'grocery', 'cstore', 'qsr', 'fsr', 'svc', 'church', 'assembly', 'safety', 'mall'].includes(stat), flH = hall && h < 12.5 ? 1 : Math.max(1, Math.min(80, Math.round((h - 1) / 4))), flC = cad && !cad.res && cad.st >= 2 && cad.m <= 1 ? (cad.st >= 62 ? Math.max(31, flH) : Math.round(cad.st / 2)) : flH;
      const gross = cad && !cad.res && cad.sf > 300 && cad.m <= 1 ? cad.sf : foot * (c === 'mf' ? flM : flC), unitsM = cad && cad.units > 1 ? Math.max(2, Math.round(cad.units / Math.max(1, cad.m))) : Math.max(2, Math.round(foot * flM * 0.85 / 900));
      Object.assign(facts, { cls: c, clsFrom, stat, yb, ybFrom, yMid: Math.round(yMid), living: Math.round(living), gross: Math.round(gross), floors: c === 'mf' ? flM : c === 'sf' || c === 'mh' ? resSt : flC, units: c === 'mf' ? unitsM : null, cadClass: cad && cad.cls ? cad.cls : null });
      let d = null, basis = 'statistics';
      const fuelLine = G => { if (!G) return; if (G.src === 'tract') E.push({ k: 'acs', t: 'Census tract ' + (ev.tractId ? String(ev.tractId).slice(5) : '') + ': ' + pct(G.raw) + ' of ' + (G.kind === 'own' ? 'owner ' : G.kind === 'rent' ? 'renter ' : '') + 'households that heat with gas or electricity use gas (' + N(G.n) + ' households in the survey estimate; region ' + pct(REG[G.kind]) + ')', w: 'place' }); else if (G.src === 'zip') E.push({ k: 'acs', t: 'ZIP ' + (ev.zip || '') + ': ' + pct(G.raw) + ' of households heating with gas or electricity use gas (tract not looked up)', w: 'place' }); };
      if (c === 'sf') {
        const r = overV(y => housePrior(y, living, ev)), L = r.last; d = r.d;
        E.push({ k: 'dcad', t: 'Dallas County homes of this age and size (' + N(L.cats.n) + ' on the appraisal roll): ' + pct(1 - ST.house.p_not_central[bin(ST.house.vint_edges, yMid)][bin(ST.house.size_edges, living)]) + ' have central heating and cooling' + (L.cats.how === 'zip' ? '; adjusted to the rate recorded in ZIP ' + ev.zip + ' (' + N(L.cats.zipN) + ' homes)' : L.cats.how === 'income' ? '; adjusted for this ZIP\'s income and home value, since its own county publishes no such record' : ''), w: 'statistic' });
        E.push({ k: 'resstock', t: 'Which central system: heat pumps are ' + pct(L.h) + ' of electric central systems in homes of this age (ResStock, DFW counties, ' + N(RSG.sfd.n) + ' modelled homes)', w: 'statistic' }); fuelLine(L.gas);
      } else if (c === 'mh') { const r = overV(y => mhPrior(y, ev)); d = r.d; E.push({ k: 'resstock', t: 'Manufactured homes in the DFW counties (ResStock, ' + N(r.last.N) + ' modelled homes): the mix of central and window units for this age', w: 'statistic' }); fuelLine(r.last.gas); }
      else if (c === 'mf') { const r = overV(y => mfPrior(y, flM, unitsM, ev)), L = r.last; d = r.d;
        E.push({ k: 'resstock', t: 'Apartment buildings like this (' + ({ mf2: 'two to four units', mfl: 'five or more units, up to three floors', mfm: 'four to seven floors', mfh: 'eight floors or more' }[L.bt]) + ') in the DFW counties: ResStock, ' + N(L.N) + ' modelled apartments' + (L.n ? ', ' + N(L.n) + ' of this age' : ''), w: 'statistic' }); fuelLine(L.gas);
        if (L.tilt > 1) E.push({ k: 'rule', t: flM + ' floors: a condenser for every apartment stops being practical as buildings get taller (refrigerant line length), so shared systems are weighted up. This is a rule of thumb, not a statistic', w: 'rule' }); }
      else if (c === 'parking') { d = { vent: 0.94, 'rooftop:elec': 0.03, 'csplit:elec': 0.03 }; E.push({ k: 'rule', t: 'A parking structure: ventilation only, by rule. No survey covers them', w: 'rule' }); }
      else if (c === 'data') { d = { 'plant:water': 0.5, 'plant:air': 0.3, 'rooftop:elec': 0.2 }; E.push({ k: 'rule', t: 'A data centre on the appraisal roll: chilled water or packaged cooling for the machines, by rule. No survey covers them', w: 'rule' }); }
      else if (c === 'shed') { d = { none: 0.95, 'window:elec': 0.03, minisplit: 0.02 }; E.push({ k: 'rule', t: 'A shed or outbuilding: none expected, by rule', w: 'rule' }); }
      else if (c === 'garage') { d = { none: 0.88, minisplit: 0.08, 'window:elec': 0.04 }; E.push({ k: 'rule', t: 'A detached garage or back building: usually none; a mini-split or a window unit if it is lived or worked in. By rule', w: 'rule' }); }
      else if (c === 'ag') { d = { none: 0.8, 'window:elec': 0.1, 'whse:heat': 0.06, 'csplit:elec': 0.04 }; E.push({ k: 'rule', t: 'A farm building: usually unconditioned, by rule', w: 'rule' }); }
      else if (c === 'util') { d = { 'rooftop:elec': 0.55, 'csplit:elec': 0.25, 'window:elec': 0.1, none: 0.1 }; E.push({ k: 'rule', t: 'An equipment shelter: wall-mounted or small packaged units, by rule', w: 'rule' }); }
      else if (['whse', 'ind', 'indh', 'indf', 'avn'].includes(c) && !stat) { const r = overV(y => whsePrior(c, gross, y, ev)), L = r.last; d = r.d;
        E.push({ k: 'cbecs', t: 'Warehouses of this size in the South (CBECS 2018, ' + L.n + ' surveyed): ' + pct(L.none) + ' have no cooling at all, ' + pct(L.part) + ' cool part of the floor (the office), ' + pct(L.full) + ' cool most of it' + (c !== 'whse' ? '. Manufacturing is not in that survey; warehouses stand in for it' : ''), w: 'statistic' }); }
      else if (stat === 'svc') { const r = overV(y => svcPrior(gross, y, ev)), L = r.last; d = r.d;
        E.push({ k: 'cbecs', t: 'Service buildings (repair shops and the like) in the South (CBECS 2018, ' + L.n + ' surveyed): ' + pct(L.none) + ' have no cooling, ' + pct(L.part) + ' cool part of the floor, ' + pct(L.full) + ' cool most of it', w: 'statistic' }); }
      else { const k = stat || 'other', r = overV(y => comPrior(k, gross, flC, y, ev)), L = r.last; d = r.d;
        const bits = []; if (L.used.includes('comstock')) bits.push('ComStock building models for the West South Central states (' + L.types.map(t => t[0].replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()).join(' and ') + ': ' + N(L.NC) + ' models' + (L.nC ? ', ' + N(L.nC) + ' of this size and age' : '') + ')'); if (L.used.includes('cbecs')) bits.push('CBECS 2018, South (' + L.pba.toLowerCase() + ': ' + L.cb.N + ' surveyed buildings' + (L.cb.n ? ', ' + L.cb.n + ' of this size' : '') + ')');
        E.push({ k: L.used[0] || 'rule', t: bits.length ? 'Buildings of this use, size and age: ' + bits.join('; ') : 'No survey covers this kind of building; packaged and split systems assumed by rule', w: bits.length ? 'statistic' : 'rule' });
        E.push({ k: 'cbecs', t: 'Chillers or district cooling: ' + pct(L.plant) + ' of surveyed buildings with about ' + N(Math.round(gross / 1000) * 1000) + ' sq ft on ' + flC + (flC === 1 ? ' floor' : ' floors') + ' (CBECS 2018, South: a fit to ' + N(ST.cbecs.plant.n) + ' cooled buildings)', w: 'statistic' });
        if (L.g0 != null && Math.abs(L.gas.g - REG.all) > 0.1) fuelLine(L.gas); }
      const prior = Object.assign({}, d);
      /* this building's own record */
      let cadUsed = false, cadEps = 0;
      if (cad && (cad.h || cad.ac)) { const resid = c === 'sf' || c === 'mh' || !!cad.res, R = resid ? cadHome(d, cad) : null, L = resid ? null : cadLik(cad); if (R || L) { d = R ? R.d : apply(d, L); cadUsed = true; basis = 'record'; if (R && R.eps) cadEps = R.eps;
        E.unshift({ k: 'dcad', t: 'Dallas CAD 2026 roll, this parcel' + (cad.cls ? ' (' + String(cad.cls).toLowerCase() + ')' : '') + ': ' + I.cadText(cad) + (sharedParcel ? '. The parcel holds ' + cad.m + ' buildings; the record is for the largest' : '') + (cadEps ? '. Rolls can lag a remodel, so ' + pct(cadEps) + ' is left for a system changed since (an allowance, not a statistic)' : ''), w: 'record' }); } }
      else if (cad && cad.cls) E.unshift({ k: 'dcad', t: 'Dallas CAD 2026 roll, this parcel: ' + String(cad.cls).toLowerCase() + '; no heating or air conditioning type recorded', w: 'record' });
      if (clsFrom === 'cad') E.push({ k: 'dcad', t: 'Kind of building taken from the appraisal roll (' + (cad.cls ? String(cad.cls).toLowerCase() : cad.kind === 4 ? 'mobile home' : 'a home') + ') rather than FEMA\'s modelled class', w: 'record' });
      const P = permitLik(ev.permits); if (P.L) { d = apply(d, P.L); if (basis !== 'record') basis = 'permit'; E.unshift({ k: 'permits', t: 'Mechanical permit' + (P.hits.length > 1 ? 's' : '') + ' at this address mention' + (P.hits.length > 1 ? '' : 's') + ': ' + P.hits.map(x => x.word + (x.year ? ' (' + x.year + ')' : '')).join(', '), w: 'record' }); }
      else if (ev.permits && ev.permits.filter(p => !p.newc).length) E.push({ k: 'permits', t: ev.permits.filter(p => !p.newc).length + ' mechanical permit' + (ev.permits.filter(p => !p.newc).length === 1 ? '' : 's') + ' on file, none naming the type of equipment', w: 'record' });
      d = norm(d); const list = Object.keys(d).map(k => ({ k, p: d[k], fam: I.family(k), name: I.short(k) })).sort((a, b2) => b2.p - a.p);
      if (!list.length) return null; const fam = {}; list.forEach(x => { fam[x.fam] = (fam[x.fam] || 0) + x.p; }); const top = list[0], famTop = Object.keys(fam).sort((a, b2) => fam[b2] - fam[a])[0];
      const strong = cadUsed || !!P.L, grade = p => (p >= 0.8 ? (strong ? 'high' : 'medium') : p >= 0.55 ? (strong ? 'medium' : 'low') : 'low'), conf = grade(fam[famTop]), confType = grade(top.p);
      const confWhy = basis === 'record' ? (P.L ? 'An appraisal record and permit wording for this building' : 'The appraisal district\'s record for this parcel') : basis === 'permit' ? 'Permit wording for this address, on top of statistics' : 'Statistics only: what buildings like this usually have. Nothing on record for this one';
      return { list, top, fam, famTop, famP: fam[famTop], conf, confType, confWhy, basis, evidence: E, facts, prior, permitHits: P.hits };
    };
    I.gasLocal = gasLocal; I.houseCats = houseCats; I.plantP = plantP;
    return I;
  }
  SE.HvacInfer = HvacInfer;

  /* ==== rooftop scout on the engine: the neighborhood, streamed around the camera ==== */
  /* window.__SCOUT_E3D__(host, env) builds the view in host and returns its controls: the same calls the three.js view
     answers (open, face, walk, turn, setHeight, state, setCurrent, refresh, hold, start, stop, project, graphics,
     setGraphics), so the module drives either, plus the engine's own (time of day, weather, the editor, physics props).
     The world is cut into cells the size of a zoom 18 map tile (about 128 m). A cell holds its ground and roofs (one
     canvas of imagery), its walls, trim, glass, glow and trees, and its collision shapes; cells are built a few per
     frame around the camera and dropped behind it, so a walk never stops to rebuild. Farther out the ground is coarser
     imagery, to the horizon. */
  window.__SCOUT_E3D__ = function createEngineView(host, env) {
    if (!host || !env) return null;
    const cv = document.createElement('canvas'); cv.className = 'sc-3dc se-canvas'; cv.tabIndex = 0;
    cv.setAttribute('aria-label', 'The neighborhood in the Scout Engine. Drag to look around, W and S or the arrow keys to move, A and D to turn, Q and E to rise and come down, click a building to read it.');
    host.insertBefore(cv, host.firstChild);
    const GFX_KEY = 'tda.scout.engine.v1', GFX0 = { q: 'auto', sun: 'afternoon', weather: 'clear', trees: true, live: true, lamps: true, glow: 'outline', life: true, wide: true, xray: false, roofKit: true };
    const gfx = (() => { try { return Object.assign({}, GFX0, JSON.parse(localStorage.getItem(GFX_KEY) || '{}')); } catch (e) { return Object.assign({}, GFX0); } })();
    const saveGfx = () => { try { localStorage.setItem(GFX_KEY, JSON.stringify(gfx)); } catch (e) { /* this browser keeps no settings */ } };
    let engine; try { engine = new Engine(cv, { quality: gfx.q, preserve: !!env.preserve }); } catch (e) { cv.remove(); if (env.onNote) env.onNote('The Scout Engine cannot start here: ' + (e && e.message || e)); return null; }
    const dev = engine.device, scene = engine.scene, R = engine.renderer, phys = engine.physics, cam = engine.camera; cam.far = 120000; engine.live = gfx.live !== false;
    const labelsEl = document.createElement('div'); labelsEl.className = 'se-labels'; labelsEl.setAttribute('aria-hidden', 'true'); host.appendChild(labelsEl);
    const hudEl = document.createElement('div'); hudEl.className = 'se-hud'; hudEl.hidden = true; hudEl.setAttribute('role', 'status'); host.appendChild(hudEl);
    const legEl = document.createElement('div'); legEl.className = 'se-legend'; legEl.hidden = true; host.appendChild(legEl);
    const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

    /* ---------- state and the ground's arithmetic ---------- */
    const S = { ok: false, gen: 0, lat0: 0, lon0: 0, kx: 1, ky: 1, x: 0, z: 0, y: 0, yaw: 0, pitch: 0, fov: 65, mode: 'street', roads: [], graph: [], on: null, cur: null, hov: null, keys: {}, tween: null, note: '', roadNote: '', sunAlt: 45, sunNote: '', sunTime: null, built: 0, treeN: 0, orbit: { yaw: 30, pitch: -28, dist: 60, at: [0, 4, 0] }, roadsAt: null, roadsVer: 0, planAt: null, planCell: '' };
    const HEIGHT = { street: { eye: 1.7, pitch: 2 }, walk: { eye: 1.7, pitch: 0 }, drone: { eye: 38, pitch: -32 }, bird: { eye: 120, pitch: -58 }, orbit: { eye: 0, pitch: -28 }, alta: { eye: 30, pitch: -14 }, metro: { eye: 1400, pitch: -36 } };
    const Rd = d => d * RAD, mLat = la => 111132.92 - 559.82 * Math.cos(2 * Rd(la)) + 1.175 * Math.cos(4 * Rd(la)), mLon = la => 111412.84 * Math.cos(Rd(la)) - 93.5 * Math.cos(3 * Rd(la));
    S.toL = (la, lo) => [(lo - S.lon0) * S.kx, -(la - S.lat0) * S.ky];      /* [x east, z south] in metres; north is -z */
    const toL = S.toL, toLL = (x, z) => [S.lat0 - z / S.ky, S.lon0 + x / S.kx];
    const lon2t = (lo, z) => (lo + 180) / 360 * Math.pow(2, z), lat2t = (la, z) => { const r = Rd(la); return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * Math.pow(2, z); };
    const t2lon = (x, z) => x / Math.pow(2, z) * 360 - 180, t2lat = (y, z) => DEG * Math.atan(Math.sinh(Math.PI * (1 - 2 * y / Math.pow(2, z))));
    const need = n => engine.requestRender(n);
    const note = t => { S.roadNote = t || ''; S.note = S.roadNote; if (env.onNote) env.onNote(S.note); };
    const K = WorldKit(engine, env, S), M = K.mat, CZ = 18, ST = StreetKit(engine, K, S); K.setGlow(gfx.glow);
    const root = scene.createEntity('Neighborhood', { transient: true }), gCells = scene.createEntity('Cells', { parent: root, transient: true }), gFar = scene.createEntity('Far ground', { parent: root, transient: true }), gRoads = scene.createEntity('Streets', { parent: root, transient: true }), gFx = scene.createEntity('Lights and weather', { parent: root, transient: true });
    const HV = HvacKit(engine, K, S, env), XR = new SE.XRay(engine), XM = new Map(); let ALTA = null; S.chase = { yaw: 0, pitch: -16, dist: 7.5 }; S.altaCam = 'chase';
    M.equip = new Material({ name: 'Rooftop and yard equipment (modelled, not observed)', vertexColors: true, roughness: 0.56, metallic: 0.3 });
    setTimeout(() => { try { R.warm(Object.keys(M).map(k => M[k]).filter(m => m && m.key)); } catch (e) { /* warming is a courtesy */ } }, 0);
    const rectCache = new Map();
    const rectOf = (X, Y, z) => { const k = (z || CZ) + '/' + X + '/' + Y; let r = rectCache.get(k); if (!r) { const zz = z || CZ, a = toL(t2lat(Y, zz), t2lon(X, zz)), b = toL(t2lat(Y + 1, zz), t2lon(X + 1, zz)); r = { x0: a[0], x1: b[0], zN: a[1], zS: b[1] }; rectCache.set(k, r); } return r; };
    const cellOf = (x, z, zz) => { const ll = toLL(x, z); return [Math.floor(lon2t(ll[1], zz || CZ)), Math.floor(lat2t(ll[0], zz || CZ))]; };
    const wideReach = () => ({ ultra: 4200, high: 3200, medium: 2200, low: 1300 }[engine.quality] || 2600) * (S.mode === 'metro' ? 1.7 : 1);
    const WIDE = WideKit(engine, K, S, env, { CZ, parent: root, rectOf, cellOf, lon2t, lat2t, t2lon, t2lat, toLL, need, covered: key => { const c = CELLS.get(key); return !!(c && c.built && (c.ctx || c.count > 0)); }, onData: () => planSoon(), treeCap: () => (gfx.trees ? (S.treeCap != null ? S.treeCap : ({ ultra: 3200, high: 2200, medium: 1300, low: 0 }[engine.quality] || 0)) : 0), treeCovered: key => { const c = CELLS.get(key); return !!(c && c.trees); } }); WIDE.on = gfx.wide !== false && !!env.context; WIDE.reach = wideReach();

    /* ---------- imagery: one canvas per cell, its four tiles drawn in as they arrive ---------- */
    const IMG = new Map(); let dirtyT = 0;
    const dirtySoon = () => { if (dirtyT) return; dirtyT = setTimeout(() => { dirtyT = 0; if (dev.lost) return; IMG.forEach(im => { if (im.dirty) { im.dirty = false; im.tex.image(im.c); } }); need(); }, 220); };
    function imagery(X, Y) {
      const key = X + '/' + Y; let im = IMG.get(key); if (im) return im;
      const c = K.cvs(512, 512, '#6f7764'), g = c.getContext('2d'), tex = dev.texture({ w: 512, h: 512, format: 'srgb8a8', mips: true, wrap: 'clamp', aniso: 16, name: 'imagery ' + key }); tex.image(c);
      im = { key, X, Y, c, g, tex, mat: new Material({ name: 'Ground and roofs ' + key, albedoMap: tex, roughness: 0.93, groundPBR: K.layered }), done: 0, ok: 0, dirty: false, dead: false, cbs: [], users: new Set() }; IMG.set(key, im);
      for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) { const img = new Image(); img.crossOrigin = 'anonymous'; img.decoding = 'async';
        const fin = () => { im.done++; if (im.done === 4) { im.cbs.forEach(f => f()); im.cbs.length = 0; } };
        img.onload = () => { if (im.dead) return; g.drawImage(img, i * 256, j * 256, 256, 256); im.ok++; im.dirty = true; dirtySoon(); fin(); }; img.onerror = () => { if (!im.dead) fin(); };
        img.src = env.tileURL(19, X * 2 + i, Y * 2 + j); }
      return im;
    }
    const dropImagery = im => { im.dead = true; im.tex.dispose(); IMG.delete(im.key); };
    /* a cell's picture is kept while any cell still draws with it (a roof that reaches over the line uses its neighbour's) */
    const release = (im, key) => { im.users.delete(key); if (!im.users.size && !CELLS.has(im.key) && !im.dead) dropImagery(im); };

    /* ---------- the ground far off: coarser tiles under the cells, out to where the haze takes over ---------- */
    const FAR = new Map(), FARZ = [{ z: 17, reach: 760, y: -0.35, inner: 0 }, { z: 13, reach: 16000, y: -9, inner: 1 }, { z: 10, reach: 90000, y: -48, inner: 16000 }];
    function farTiles() {
      const want = new Set();
      FARZ.forEach(L => { const size = Math.abs(rectOf(...cellOf(S.x, S.z, L.z), L.z).x1 - rectOf(...cellOf(S.x, S.z, L.z), L.z).x0), n = Math.ceil(L.reach / size), [cX, cY] = cellOf(S.x, S.z, L.z);
        const inner = L.inner === 1 ? WIDE.reach : L.inner;
        for (let dy = -n; dy <= n; dy++) for (let dx = -n; dx <= n; dx++) { const X = cX + dx, Y = cY + dy, r = rectOf(X, Y, L.z), mx = (r.x0 + r.x1) / 2, mz = (r.zN + r.zS) / 2, dc = Math.hypot(mx - S.x, mz - S.z); if (dc > L.reach + size * 0.71 || dc + size * 0.71 < inner - 80) continue; const key = L.z + '/' + X + '/' + Y; want.add(key); if (FAR.has(key)) continue;
          const Bd = new MeshBuilder(); Bd.quad([r.x0, L.y, r.zN], [r.x1, L.y, r.zN], [r.x1, L.y, r.zS], [r.x0, L.y, r.zS], [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]]);
          const tex = dev.lazyTexture(env.tileURL(L.z, X, Y), { srgb: true, wrap: 'clamp', fill: [111, 119, 100, 255], onLoad: () => need() }), mat = new Material({ name: 'Far ground', albedoMap: tex, roughness: 0.95, castShadow: false, wet: 0 });
          const e = scene.createEntity('Tile ' + key, { parent: gFar, transient: true }), mr = e.add('MeshRenderer'); mr.mesh = Bd.build(dev); mr.material = mat; mr.castShadow = false; mr.pickable = false; FAR.set(key, { e, tex, mesh: mr.mesh }); } });
      FAR.forEach((f, key) => { if (!want.has(key)) { f.e.destroy(); f.mesh.dispose(); f.tex.dispose(); FAR.delete(key); } });
    }
    { const e = scene.createEntity('Horizon', { parent: gFar, transient: true }), mr = e.add('MeshRenderer'); mr.setShape({ kind: 'plane', args: [600000, 600000, 1] }); mr.material = new Material({ name: 'Horizon', albedo: '#5d6652', roughness: 1, castShadow: false, wet: 0 }); mr.castShadow = false; mr.pickable = false; e.transform.setPosition(0, -90, 0); S.horizon = e; }

    /* ---------- cells ---------- */
    const CELLS = new Map(), IDX = new Map(), queue = [], treeQ = [];
    const cellSize = () => { const r = rectOf(...cellOf(0, 0)); return Math.abs(r.x1 - r.x0); };
    const reach = () => ({ ultra: 400, high: 330, medium: 265, low: 200 }[engine.quality] || 300) * (S.mode === 'bird' ? 1.25 : S.mode === 'alta' ? 1.12 : S.mode === 'metro' ? 0.6 : 1);
    function index() { IDX.clear(); for (const b of env.buildings()) { if (b.lat == null) continue; const k = Math.floor(lon2t(b.lon, CZ)) + '/' + Math.floor(lat2t(b.lat, CZ)); let l = IDX.get(k); if (!l) IDX.set(k, l = []); l.push(b); } }
    const sigOf = c => { const l = IDX.get(c.key) || []; let s = ''; for (const b of l) { s += b.id + (b.status || '') + Math.round(env.height(b) * 4); if (gfx.roofKit !== false) { try { s += HV.code(b); } catch (e) { /* no reading */ } } s += '|'; } return s + (c.detailWant ? 'D' : 'd') + (gfx.roofKit !== false ? 'K' : 'k') + S.roadsVer + 'w' + WIDE.dataVer(c.key); };
    const idsOf = c => (IDX.get(c.key) || []).map(b => b.id).join('|') + '#' + S.roadsVer;
    const clip3 = (P, r) => { const cut = (poly, k, lim, sg) => { const o = []; for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length], dp = sg * (p[k] - lim), dq = sg * (q[k] - lim); if (dp <= 0) o.push(p); if ((dp < 0 && dq > 0) || (dp > 0 && dq < 0)) { const t = dp / (dp - dq); o.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t]); } } return o; };
      let o = cut(P, 0, r.x0, -1); if (o.length) o = cut(o, 0, r.x1, 1); if (o.length) o = cut(o, 2, r.zN, -1); if (o.length) o = cut(o, 2, r.zS, 1); return o; };
    function disposeParts(c) { c.parts.forEach(p => { p.e.destroy(); p.mesh.dispose(); }); c.parts.length = 0; c.uses.forEach(im => release(im, c.key)); c.uses.length = 0; c.prisms.forEach(p => phys.removePrism(p)); c.prisms.length = 0; c.labels.length = 0; }
    function disposeTrees(c) { if (c.trees) { c.trees.e.destroy(); c.trees.ib.dispose(); S.treeN -= c.trees.n; c.trees = null; WIDE.treesDirty(c.key); } }
    function dropCell(c) { disposeTrees(c); c.group.destroy(); CELLS.delete(c.key); WIDE.cover(c.key, false); disposeParts(c); if (c.img && !c.img.dead && !c.img.users.size) dropImagery(c.img); }
    function buildCell(c) {
      disposeParts(c); const list = IDX.get(c.key) || [], rect = c.rect, MB = MeshBuilder;
      const B = { wall: new MB({ aux: true }), trim: new MB(), fine: new MB(), glass: new MB(), glow: new MB({ aux: true }), equip: new MB() }, roofs = new Map();
      const roofB = (X, Y) => { const k = X + '/' + Y; let r = roofs.get(k); if (!r) { const im = X === c.X && Y === c.Y ? c.img : imagery(X, Y), rc = rectOf(X, Y); r = { b: new MB(), im, rc, uv: p => [(p[0] - rc.x0) / (rc.x1 - rc.x0), (p[2] - rc.zN) / (rc.zS - rc.zN)] }; roofs.set(k, r); im.users.add(c.key); c.uses.push(im); } return r; };
      const own = roofB(c.X, c.Y), inR = p => p[0] >= rect.x0 && p[0] <= rect.x1 && p[2] >= rect.zN && p[2] <= rect.zS;
      own.b.quad([rect.x0, 0, rect.zN], [rect.x1, 0, rect.zN], [rect.x1, 0, rect.zS], [rect.x0, 0, rect.zS], [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]]);
      B.roofTri = (a, b, d, n) => {
        if (inR(a) && inR(b) && inR(d)) { own.b.tri(a, b, d, n, own.uv(a), own.uv(b), own.uv(d)); return; }
        const ca = cellOf(a[0], a[2]), cb = cellOf(b[0], b[2]), cd = cellOf(d[0], d[2]), X0 = Math.min(ca[0], cb[0], cd[0]), X1 = Math.max(ca[0], cb[0], cd[0]), Y0 = Math.min(ca[1], cb[1], cd[1]), Y1 = Math.max(ca[1], cb[1], cd[1]);
        for (let Y = Y0; Y <= Y1; Y++) for (let X = X0; X <= X1; X++) { const r = roofB(X, Y), P = clip3([a, b, d], r.rc); for (let i = 1; i + 1 < P.length; i++) r.b.tri(P[0], P[i], P[i + 1], n, r.uv(P[0]), r.uv(P[i]), r.uv(P[i + 1])); }
      };
      const nearRoad = (x, z, garage) => nearestRoad(x, z, garage ? null : ['street', 'major', 'service'], garage ? 30 : 60); let n = 0, nx = 0;
      /* every building both records hold for this square: the dashboard's own (FEMA's, with their readings), less the ones the
         newer record says were cleared, plus the ones the dashboard does not hold (not loaded yet, or built since FEMA's
         picture and known from OpenStreetMap). The extra ones are drawn like the rest and are solid; they have no reading. */
      const ctx = WIDE.on ? WIDE.cellData(c.key) : null, all = []; c.ctx = !!ctx;
      if (ctx) { const have = list.map(b => toL(b.lat, b.lon)), gone = ctx.gone.map(q => toL(q[0], q[1]));
        for (const b of list) { if (gone.length && b.id !== S.cur) { const q = toL(b.lat, b.lon); if (gone.some(g2 => Math.abs(g2[0] - q[0]) < 3 && Math.abs(g2[1] - q[1]) < 3)) continue; } all.push(b); }
        for (const f of ctx.feats) { const q = toL(f.la, f.lo); if (f.src !== 'osm' && have.some(h2 => Math.abs(h2[0] - q[0]) < 2.5 && Math.abs(h2[1] - q[1]) < 2.5)) continue; all.push(f.pb || (f.pb = { id: f.id, cls: f.cls, rings: [f.ring], lat: f.la, lon: f.lo, h: f.h, sqft: (f.m2 || 0) * 10.764, extra: true, src: f.src || 'fema' })); } }
      else for (const b of list) all.push(b);
      for (const b of all) { let g = null; try { g = K.addBuilding(B, b, { detail: c.detailWant, nearRoad: S.roads.length ? nearRoad : null }); } catch (e) { g = null; } if (!g) continue; n++; if (gfx.roofKit !== false) { try { HV.exterior(b, B.equip); } catch (e) { /* this one goes without */ } }
        g.rings.forEach(r => c.prisms.push(phys.addPrism(r.P, 0, r.h, { id: b.id }))); if (b.extra) nx++; else c.labels.push({ id: b.id, x: g.cx, y: g.top + 1.4, z: g.cz }); }
      c.extra = nx;
      const part = (name, Bd, mat, o) => { if (Bd.empty) return; const mesh = Bd.build(dev, { name: name + ' ' + c.key, clusters: o && o.cluster ? o.cluster : Bd.tris > 900 ? 320 : false }), e = scene.createEntity(name, { parent: c.group, transient: true }), mr = e.add('MeshRenderer'); mr.mesh = mesh; mr.material = mat; mr.pickable = false; if (o && o.noShadow) mr.castShadow = false; if (o && o.far) mr.maxDistance = o.far; if (o && o.fineSize) mesh.fineSize = o.fineSize; c.parts.push({ e, mesh }); };
      roofs.forEach((r, k) => part(k === c.key ? 'Ground and roofs' : 'Roofs over ' + k, r.b, r.im.mat));
      part('Walls', B.wall, M.wall); part('Trim', B.trim, M.trim, { far: 420 }); part('Window frames and bars', B.fine, M.trim, { far: 260, noShadow: true, cluster: 96, fineSize: 0.05 }); part('Glass', B.glass, M.glass, { noShadow: true }); part('Glow', B.glow, M.glow, { noShadow: true }); part('Rooftop and yard equipment (modelled)', B.equip, M.equip, { far: 520 });
      c.count = n; c.built = true; c.detail = c.detailWant; c.sig = sigOf(c); WIDE.cover(c.key, n > 0); S.built = 0; CELLS.forEach(x => { S.built += x.count || 0; });
      const ids = idsOf(c); if (c.treeSig !== ids) { c.treeSig = ids; c.treeWait = performance.now(); if (!treeQ.includes(c)) treeQ.push(c); }
    }
    /* which cells should exist now, which need (re)building, which can go */
    function plan() {
      if (!S.ok) return; const size = cellSize(), Rm = reach(), n = Math.ceil(Rm / size) + 1, [cX, cY] = cellOf(S.x, S.z); S.planAt = [S.x, S.z]; S.planCell = cX + '/' + cY; queue.length = 0;
      for (let dy = -n; dy <= n; dy++) for (let dx = -n; dx <= n; dx++) { const X = cX + dx, Y = cY + dy, rect = rectOf(X, Y), mx = (rect.x0 + rect.x1) / 2, mz = (rect.zN + rect.zS) / 2, d = Math.hypot(mx - S.x, mz - S.z); if (d > Rm + size * 0.5) continue;
        const key = X + '/' + Y; let c = CELLS.get(key); if (!c) { c = { key, X, Y, rect, cx: mx, cz: mz, img: imagery(X, Y), group: scene.createEntity('Cell ' + key, { parent: gCells, transient: true }), parts: [], prisms: [], labels: [], uses: [], sig: null, built: false, detail: false, detailWant: false, trees: null, treeSig: null, count: 0 }; CELLS.set(key, c); }
        c.d = d; c.detailWant = c.detail ? d < 215 : d < 170; if (!c.built || c.sig !== sigOf(c)) queue.push(c); }
      queue.sort((a, b) => a.d - b.d);
      CELLS.forEach(c => { if (Math.hypot(c.cx - S.x, c.cz - S.z) > Rm + size * 1.6) dropCell(c); });
      WIDE.update(); farTiles(); need();
    }
    const planSoon = (() => { let t = 0; return () => { clearTimeout(t); t = setTimeout(plan, 60); }; })();
    function pump() {
      const t0 = performance.now(); let did = false;
      while (queue.length && performance.now() - t0 < 7) { const c = queue.shift(); if (CELLS.has(c.key)) { buildCell(c); did = true; } }
      if (!queue.length && treeQ.length && performance.now() - t0 < 5) { const c = treeQ[0]; if (!CELLS.has(c.key) || !gfx.trees) treeQ.shift(); else if (c.img.done >= 4 || performance.now() - c.treeWait > 7000) { treeQ.shift(); growTrees(c); did = true; } else { treeQ.push(treeQ.shift()); if (treeQ.length) need(); } }
      if (!queue.length && performance.now() - t0 < 6 && WIDE.pump()) did = true;
      xraySync(); if (did || queue.length) need();
      if (S.planAt && (Math.hypot(S.x - S.planAt[0], S.z - S.planAt[1]) > 28)) { const [cX, cY] = cellOf(S.x, S.z); if (cX + '/' + cY !== S.planCell || Math.hypot(S.x - S.planAt[0], S.z - S.planAt[1]) > 60) plan(); }
    }

    /* ---------- trees: where each cell's photograph shows canopy ---------- */
    const LEAF = [0.314, 0.407, 0.18];      /* the leaf card's mean colour as displayed */
    function growTrees(c) {
      disposeTrees(c); if (!gfx.trees || !c.img.ok) return; const r = c.rect, pad = 6;
      const list = K.detectTrees(c.img.c, r, (g, px, scale) => {
        const near = phys.prismsIn(r.x0 - pad, r.zN - pad, r.x1 + pad, r.zS + pad, []); near.forEach(p => { g.beginPath(); p.ring.forEach((q, i) => { const [X, Y] = px(q[0], q[1]); if (i) g.lineTo(X, Y); else g.moveTo(X, Y); }); g.closePath(); g.fill(); });
        S.roads.forEach(rd => { const w = (K.ROADW[rd.kind] || K.ROADW.street)[0]; g.lineWidth = w * scale + 1; g.beginPath(); rd.pts.forEach((q, i) => { const [X, Y] = px(q[0], q[1]); if (i) g.lineTo(X, Y); else g.moveTo(X, Y); }); g.stroke(); }); });
      const cap = { ultra: 260, high: 200, medium: 130, low: 70 }[engine.quality] || 160; if (list.length > cap) { list.sort((a, b) => b.r - a.r); list.length = cap; } if (!list.length) return;
      const ib = new InstanceBuffer(dev, list.length);
      list.forEach(t => { const k = [0, 1, 2].map(i => clamp(lerp(1, (t.col[i] / 255) / LEAF[i], 0.5), 0.7, 1.6)), j = hash01(t.x.toFixed(1) + ':' + t.z.toFixed(1)); ib.add(t.x, 0, t.z, j * TAU, t.r * 2, t.h, t.r * 2, k[0] * (0.9 + j * 0.2), k[1], k[2] * (0.9 + (1 - j) * 0.2), 1); });
      const e = scene.createEntity('Trees', { parent: c.group, transient: true }), cr = e.add('InstancedRenderer'), tk = e.add('InstancedRenderer'), near = engine.quality === 'low' ? 0 : engine.quality === 'medium' ? 70 : 115;
      cr.instances = ib; cr.lods = [{ mesh: K.crownNear, distance: M.leaf.albedoMap ? near : 0, material: M.leaf }, { mesh: K.crownMid, distance: 240, material: M.crown }, { mesh: K.crownFar, distance: 1e9, material: M.crown }].filter(l => l.distance > 0); cr.shadowDistance = 260;
      tk.instances = ib; tk.mesh = K.trunk; tk.material = M.trunk; tk.maxDistance = 190; tk.shadowDistance = 90;
      c.trees = { e, ib, n: list.length }; S.treeN += list.length; WIDE.treesDirty(c.key); need();
    }

    /* ---------- x-ray: the likely heating and cooling of the buildings round the camera, seen through their walls ---------- */
    const xrCap = () => ({ ultra: 110, high: 80, medium: 48, low: 26 }[engine.quality] || 48); let xrT = 0;
    function xrayClear() { XM.forEach(m => { if (m.item) XR.remove(m.item); if (m.mesh) m.mesh.dispose(); }); XM.clear(); }
    function xraySync(force) {
      XR.on = !!gfx.xray; if (!gfx.xray) { if (XM.size) xrayClear(); return; } const now = performance.now(); if (!force && now - xrT < 250) return; xrT = now;
      const fx = S.mode === 'orbit' ? S.orbit.at[0] : S.x, fz = S.mode === 'orbit' ? S.orbit.at[2] : S.z, R0 = S.mode === 'bird' ? 300 : 210, list = [];
      CELLS.forEach(c => { if (!c.built || Math.hypot(c.cx - fx, c.cz - fz) > R0 + 100) return; for (const l of c.labels) { const d = Math.hypot(l.x - fx, l.z - fz); if (d < R0 || l.id === S.cur) list.push([l.id, l.id === S.cur ? -1 : d]); } });
      list.sort((a, b) => a[1] - b[1]); const keep = new Set(list.slice(0, xrCap()).map(a => a[0])), t0 = performance.now(); let made = 0;
      for (const id of keep) { const b = env.byId(id); if (!b) continue; let code = ''; try { code = HV.code(b); } catch (e) { code = ''; } const m0 = XM.get(id); if (m0 && m0.code === code) continue; if (made >= 5 || performance.now() - t0 > 9) { need(); break; }
        if (m0) { if (m0.item) XR.remove(m0.item); if (m0.mesh) m0.mesh.dispose(); } let mesh = null; try { mesh = HV.model(b); } catch (e) { mesh = null; } XM.set(id, mesh ? { mesh, item: XR.add(mesh), code } : { mesh: null, item: null, code }); made++; }
      XM.forEach((m, id) => { if (!keep.has(id)) { if (m.item) XR.remove(m.item); if (m.mesh) m.mesh.dispose(); XM.delete(id); } }); if (made) need(2);
    }
    let legT = 0;
    const pc = p => (p >= 0.995 ? '99%+' : p < 0.005 ? '<1%' : Math.round(p * 100) + '%'), WTAG = { record: 'on record', statistic: 'statistic', place: 'the area', rule: 'rule of thumb' }, CONF = { high: 'high confidence', medium: 'medium confidence', low: 'low confidence' };
    function readHTML(b) {
      let rd = null, L = null; try { rd = HV.read(b); L = HV.layout(b); } catch (e) { rd = null; } const f = env.facts ? env.facts(b) : null, inf = rd && rd.inf, cur = L ? L.code : '', I = HV.infer;
      let h = `<b>${esc(f && f.address ? f.address : 'The building picked')}</b>`;
      if (!inf) return h + (L ? esc(L.text) : '') + (b.sys && b.sys.size ? '<br>' + esc(b.sys.size) : '');
      h += `<span class="se-leg-top"><span>${esc(I.famName[inf.famTop] || inf.famTop)}</span><i class="se-conf ${inf.conf}">${pc(inf.famP)} · ${CONF[inf.conf]}</i></span><span class="se-leg-why">${esc(inf.confWhy)}</span><span class="se-alts">`;
      const rows = inf.list.filter((x, i) => i < 3 || (x.p >= 0.03 && i < 6)); if (cur && !rows.some(x => x.k === cur)) { const x = inf.list.find(y => y.k === cur); rows.push(x || { k: cur, p: 0, name: I.short(cur) }); }
      rows.forEach(x => { h += `<button type="button" data-k="${esc(x.k)}"${x.k === cur ? ' class="on" aria-pressed="true"' : ''} title="${esc(I.long(x.k))}"><span class="nm">${esc(x.name)}</span><span class="bar"><i style="width:${Math.max(2, Math.round(x.p * 100))}%"></i></span><span class="pc">${pc(x.p)}</span></button>`; });
      h += '</span>' + (cur !== inf.top.k ? `<span class="se-leg-alt">Showing an alternative, not the most likely system. <button type="button" data-k="">Back to the most likely</button></span>` : '<span class="se-leg-hint">Click a row to draw that system instead.</span>');
      if (L) h += `<span class="se-leg-drawn"><u>Drawn</u> ${esc(L.text)}. The kind of equipment follows the reading above; where each piece sits is a generated layout.</span>`;
      const F = inf.facts, bits = []; if (F.yb) bits.push('built ' + F.yb + (F.ybFrom === 'cad' ? ' (appraisal roll)' : F.ybFrom === 'parcel' ? ' (appraisal roll)' : F.ybFrom === 'permit' ? ' (permit)' : '')); else bits.push('year built not on file, about ' + F.yMid + ' assumed from the ' + (F.ybFrom || 'area'));
      if (F.cls === 'sf' || F.cls === 'mh') bits.push('about ' + Math.round(F.living / 50) * 50 + ' sq ft lived in'); else if (F.gross) bits.push('about ' + (Math.round(F.gross / 100) * 100).toLocaleString('en-US') + ' sq ft on ' + F.floors + (F.floors === 1 ? ' floor' : ' floors') + (F.units ? ', about ' + F.units + ' apartments' : ''));
      h += `<span class="se-leg-facts">${esc(bits.join('; '))}</span><details class="se-ev"${legEl._evOpen ? ' open' : ''}><summary>Evidence (${inf.evidence.length})</summary>` + inf.evidence.map(e => `<span class="se-ev-row ${esc(e.w)}"><i>${esc(WTAG[e.w] || e.w)}</i>${esc(e.t)}</span>`).join('') + '</details>';
      return h;
    }
    function drawLegend(force) {
      if (legEl.hidden !== !gfx.xray) legEl.hidden = !gfx.xray; if (!gfx.xray) return; const now = performance.now(); if (!force && now - legT < 300) return; legT = now; const b = S.cur != null ? env.byId(S.cur) : null;
      let h = '<b>X-ray: the heating and cooling each building most likely has</b><span class="se-leg-note">Worked out from public records and statistics. Nobody has been inside: the percentages say how likely each system is, and the evidence says why.</span><span class="se-leg-grid">' + HV.legend.map(([c, t]) => `<span class="se-leg-row"><i style="background:${c}"></i>${esc(t)}</span>`).join('') + '</span>';
      h += '<span class="se-leg-cur">' + (b ? readHTML(b) : 'Click a building to read its system.') + '</span>';
      if (legEl._h !== h) { const d = legEl.querySelector('details.se-ev'); if (d) legEl._evOpen = d.open; const sc = legEl.scrollTop; legEl.innerHTML = h.replace('<details class="se-ev">', legEl._evOpen ? '<details class="se-ev" open>' : '<details class="se-ev">'); legEl._h = h; legEl.scrollTop = sc; }
    }
    /* the legend is the one part of the overlay that is used with the mouse: a click on a row draws that system for the building picked */
    ['pointerdown', 'mousedown', 'wheel', 'touchstart', 'dblclick', 'contextmenu'].forEach(t => legEl.addEventListener(t, e => e.stopPropagation(), { passive: true }));
    legEl.addEventListener('toggle', e => { if (e.target && e.target.classList && e.target.classList.contains('se-ev')) legEl._evOpen = e.target.open; }, true);
    legEl.addEventListener('click', e => { const t = e.target.closest ? e.target.closest('button[data-k]') : null; if (!t || S.cur == null) return; e.stopPropagation(); const b = env.byId(S.cur); if (!b) return; const k = t.getAttribute('data-k'); let top = ''; try { top = HV.read(b).top; } catch (er) { top = ''; }
      HV.pick(b.id, k && k !== top ? k : null); xraySync(true); plan(); drawLegend(true); need(3); });
    /* what is under a point (a roof, or the ground), and whether a wall stands there at a height: the drone's world */
    const NEARP = [];
    const floorTop = (x, z) => { let top = 0; for (const p of phys.prismsIn(x - 0.5, z - 0.5, x + 0.5, z + 0.5, NEARP)) if (p.y1 > top && Poly.contains(p.ring, x, z)) top = p.y1; return top; };
    const blockAt = (x, z, y) => { const r = 1.25; for (const p of phys.prismsIn(x - r, z - r, x + r, z + r, NEARP)) { if (y > p.y1 + 0.05) continue; if (Poly.contains(p.ring, x, z) || Poly.contains(p.ring, x + r, z) || Poly.contains(p.ring, x - r, z) || Poly.contains(p.ring, x, z + r) || Poly.contains(p.ring, x, z - r)) return true; } return false; };
    let hudT = 0, warnT = 0, warnTxt = '';
    function drawHud() {
      const on = S.mode === 'alta' && !!ALTA; if (hudEl.hidden !== !on) hudEl.hidden = !on; if (!on) return; const now = performance.now(); if (now - hudT < 160) return; hudT = now;
      const a = ALTA.state, sp = Math.hypot(a.vx, a.vz), agl = Math.max(0, a.y - floorTop(a.x, a.z)), home = Math.hypot(a.x - a.home[0], a.z - a.home[1]), min = ALTA.minutesLeft(), bat = Math.round(a.battery * 100);
      if (a.warn && a.warn !== warnTxt) { warnTxt = a.warn; warnT = now; if (env.onNote) env.onNote(a.warn); } const warn = warnTxt && now - warnT < 7000 ? `<span class="se-hud-warn">${esc(warnTxt)}</span>` : '';
      const h = `<span class="se-hud-row"><b>Freefly Alta X Gen2</b><i>${esc(a.mode)}</i><span>ALT <b>${agl.toFixed(0)} m</b> ${Math.round(agl * 3.281)} ft above what is under it</span><span>SPD <b>${sp.toFixed(1)} m/s</b> ${Math.round(sp * 2.237)} mph</span><span>HDG <b>${String(Math.round(a.yaw) % 360).padStart(3, '0')}°</b></span><span class="${bat < 20 ? 'low' : ''}">BAT <b>${bat}%</b> about ${Math.max(0, Math.round(min))} min</span><span>HOME <b>${home < 1000 ? Math.round(home) + ' m' : (home / 1000).toFixed(1) + ' km'}</b></span><span>CAM <b>${S.altaCam === 'payload' ? 'payload ' + Math.round(a.gimbal) + '°' : 'chase'}</b></span><span>X-RAY <b>${gfx.xray ? 'on' : 'off'}</b></span></span>` +
        `<span class="se-hud-keys">W S A D fly · ← → turn · ↑ ↓ or R F climb and descend · C camera · X x-ray · H return home · L land or take off · click the ground to send it there</span>${warn}`;
      if (hudEl._h !== h) { hudEl.innerHTML = h; hudEl._h = h; }
    }

    /* ---------- streets and alleys ---------- */
    const WALK = new Set(['street', 'major', 'alley', 'service']); let roadParts = [];
    function setRoads(list) { S.roads = list.map(r => ({ name: r.name || '', kind: r.kind, pts: r.pts.map(([la, lo]) => toL(la, lo)) })).filter(r => r.pts.length >= 2); buildRoads(); }
    function buildRoads() {
      roadParts.forEach(p => { p.e.destroy(); p.mesh.dispose(); }); roadParts = [];
      const Bd = new MeshBuilder({ aux: true }), Pt = new MeshBuilder(), yel = K.hexRGB('#e0b13c'), wht = K.hexRGB('#e9e7e0');
      S.roads.forEach(r => { const spec = K.ROADW[r.kind] || K.ROADW.street; K.ribbon(Bd, r.pts, spec[0], spec[1], spec[2]); if (r.kind === 'major' && !gfx.life) { K.ribbon(Pt, r.pts, 0.11, 0.115, null, 0.12, yel); K.ribbon(Pt, r.pts, 0.11, 0.115, null, -0.12, yel); K.ribbon(Pt, r.pts, 0.12, 0.115, null, 5.4, wht); K.ribbon(Pt, r.pts, 0.12, 0.115, null, -5.4, wht); } });
      [['Asphalt and concrete', Bd, M.road], ['Paint', Pt, M.paint]].forEach(([name, b, mat]) => { if (b.empty) return; const mesh = b.build(dev, { name, clusters: 320 }), e = scene.createEntity(name, { parent: gRoads, transient: true }), mr = e.add('MeshRenderer'); mr.mesh = mesh; mr.material = mat; mr.castShadow = false; mr.pickable = false; roadParts.push({ e, mesh }); });
      /* what stands and moves on the streets: sidewalks, crossings, signals, parked cars, traffic (generated, not observed) */
      ST.build(S.roads, root, { life: gfx.life, center: [S.x, S.z], blocked: (x, z) => phys.prismsIn(x, z, x, z, []).some(p => Poly.contains(p.ring, x, z)), cars: { ultra: 110, high: 80, medium: 45, low: 22 }[engine.quality] || 60 });
      S.graph = S.roads.filter(r => WALK.has(r.kind)); S.on = null; S.roadsVer++; lamps(); planSoon(); need();
    }
    async function loadRoads() {
      const gen = S.gen, [la, lo] = toLL(S.x, S.z); S.roadsAt = [S.x, S.z]; if (!S.roads.length) note('Loading the streets and alleys…');
      try { const list = await env.roads(la, lo, 560); if (gen !== S.gen) return; setRoads(list); note(list.source || ''); if (S.mode === 'street' && !S.tween) { const o = nearestOnRoads(S.x, S.z, 45); if (o) { S.on = o; S.x = o.x; S.z = o.z; } } after(true); }
      catch (e) { if (gen === S.gen) note('The streets did not load: ' + (e && e.message || e) + '. The view still moves freely.'); }
    }
    function nearestOnRoads(x, z, maxD, graph) {
      let best = null; (graph || S.graph).forEach((r, ri) => { for (let i = 0; i + 1 < r.pts.length; i++) { const a = r.pts[i], b = r.pts[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz; let t = L2 ? ((x - a[0]) * dx + (z - a[1]) * dz) / L2 : 0; t = clamp(t, 0, 1); const px = a[0] + t * dx, pz = a[1] + t * dz, d = Math.hypot(px - x, pz - z); if (!best || d < best.d) best = { ri, si: i, t, x: px, z: pz, d }; } });
      return best && best.d <= (maxD || 1e9) ? best : null;
    }
    const nearestRoad = (x, z, kinds, maxD) => nearestOnRoads(x, z, maxD, kinds ? S.roads.filter(r => kinds.includes(r.kind)) : S.roads);
    const roadAt = () => { const o = S.on || nearestOnRoads(S.x, S.z, 25); return o ? S.graph[o.ri] : null; };
    /* walking: along the street the camera stands on, in the direction nearest where it looks; at a street's end, onto the
       connecting street that best keeps that direction (a turn at a corner is made by looking down the new street) */
    function walk(dist) {
      const free = () => { S.x += Math.sin(Rd(S.yaw)) * dist; S.z -= Math.cos(Rd(S.yaw)) * dist; after(); };
      if (S.mode !== 'street' || !S.graph.length) return free(); let o = S.on || nearestOnRoads(S.x, S.z, 40); if (!o) return free();
      const sgn = dist >= 0 ? 1 : -1; let rem = Math.abs(dist), guard = 0; const hx = Math.sin(Rd(S.yaw)) * sgn, hz = -Math.cos(Rd(S.yaw)) * sgn;
      { const r0 = S.graph[o.ri], a0 = r0.pts[o.si], b0 = r0.pts[o.si + 1], l0 = Math.hypot(b0[0] - a0[0], b0[1] - a0[1]) || 1, cur = Math.abs(((b0[0] - a0[0]) * hx + (b0[1] - a0[1]) * hz) / l0);
        if (cur < 0.8) { let best = null; S.graph.forEach((r, ri) => { if (ri === o.ri) return; for (let i = 0; i + 1 < r.pts.length; i++) { const a = r.pts[i], b = r.pts[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz; if (!L2) continue; const t = clamp(((S.x - a[0]) * dx + (S.z - a[1]) * dz) / L2, 0, 1), px = a[0] + t * dx, pz = a[1] + t * dz, d = Math.hypot(px - S.x, pz - S.z); if (d > 6) continue; const al = Math.abs((dx * hx + dz * hz) / Math.sqrt(L2)); if (al > cur + 0.25 && al > 0.7 && (!best || al - d * 0.02 > best.s)) best = { s: al - d * 0.02, ri, si: i, t }; } });
          if (best) o = { ri: best.ri, si: best.si, t: best.t }; } }
      let dir = 0;
      while (rem > 1e-6 && guard++ < 200) {
        const r = S.graph[o.ri], a = r.pts[o.si], b = r.pts[o.si + 1], dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz) || 1e-6; if (!dir) dir = (dx * hx + dz * hz) >= 0 ? 1 : -1;
        const room = dir > 0 ? (1 - o.t) * len : o.t * len; if (rem <= room) { o.t += dir * rem / len; rem = 0; break; } rem -= room; o.t = dir > 0 ? 1 : 0;
        if (dir > 0 && o.si + 1 < r.pts.length - 1) { o.si++; o.t = 0; continue; } if (dir < 0 && o.si > 0) { o.si--; o.t = 1; continue; }
        const end = dir > 0 ? b : a, tx = dir > 0 ? dx / len : -dx / len, tz = dir > 0 ? dz / len : -dz / len; let next = null;
        S.graph.forEach((q, qi) => { if (qi === o.ri) return; q.pts.forEach((p, pi) => { if (Math.hypot(p[0] - end[0], p[1] - end[1]) > 4) return;
          [[pi, 1], [pi, -1]].forEach(([k, dd]) => { const k2 = k + dd; if (k2 < 0 || k2 >= q.pts.length) return; const ex = q.pts[k2][0] - p[0], ez = q.pts[k2][1] - p[1], el = Math.hypot(ex, ez) || 1, al = (ex * tx + ez * tz) / el * 0.5 + (ex * hx + ez * hz) / el * 0.5; if (al > 0.25 && (!next || al > next.al)) next = { al, ri: qi, si: dd > 0 ? k : k2, t: dd > 0 ? 0 : 1, d: dd }; }); }); });
        if (!next) break; o = { ri: next.ri, si: next.si, t: next.t }; dir = next.d;
      }
      const r = S.graph[o.ri], a = r.pts[o.si], b = r.pts[o.si + 1]; S.x = a[0] + (b[0] - a[0]) * o.t; S.z = a[1] + (b[1] - a[1]) * o.t; S.on = o;
      if (sgn > 0 && dir) { const ty = DEG * Math.atan2((b[0] - a[0]) * dir, -(b[1] - a[1]) * dir); const dy = ((ty - S.yaw + 540) % 360) - 180; if (Math.abs(dy) < 70) S.yaw = (S.yaw + dy * 0.35 + 360) % 360; }
      after();
    }
    function after(quiet) { need(); if (!quiet && env.onMove) env.onMove(state()); if (S.roadsAt && Math.hypot(S.x - S.roadsAt[0], S.z - S.roadsAt[1]) > 230) loadRoads(); if (Math.hypot(S.x, S.z) > 12000) { const [la, lo] = toLL(S.x, S.z); recenter(la, lo); } }

    /* ---------- the sun, the weather, the lamps ---------- */
    const SUN_AT = { morning: 0.2, midday: 0.5, afternoon: 0.72, evening: 0.93 };
    function sunTime(preset, lat, lon) {
      const now = new Date(); if (preset === 'now') return now; const offH = lon / 15, sol = new Date(now.getTime() + offH * 3600e3), day0 = Date.UTC(sol.getUTCFullYear(), sol.getUTCMonth(), sol.getUTCDate()) - offH * 3600e3;
      if (typeof preset === 'number') return new Date(day0 + preset * 3600e3); if (preset === 'night') return new Date(day0 + 23 * 3600e3);
      let rise = null, set = null; for (let m = 0; m <= 1440; m += 5) { if (solarPosition(new Date(day0 + m * 60e3), lat, lon).alt > -0.8) { if (rise == null) rise = m; set = m; } }
      return rise == null ? now : new Date(day0 + (rise + (set - rise) * (SUN_AT[preset] || 0.72)) * 60e3);
    }
    const WEATHER = { clear: { clouds: 0.25, fogDensity: 0.00035, wetness: 0, turbidity: 2.2, sunIntensity: 1, skyIntensity: 1, rain: false }, cloudy: { clouds: 0.62, fogDensity: 0.0005, wetness: 0, turbidity: 3, sunIntensity: 0.7, skyIntensity: 1.05, rain: false },
      overcast: { clouds: 1, fogDensity: 0.0009, wetness: 0, turbidity: 5, sunIntensity: 0.16, skyIntensity: 1.5, rain: false }, rain: { clouds: 1, fogDensity: 0.0016, wetness: 1, turbidity: 6, sunIntensity: 0.1, skyIntensity: 1.35, rain: true }, haze: { clouds: 0.15, fogDensity: 0.0045, wetness: 0, turbidity: 8, sunIntensity: 0.75, skyIntensity: 1.1, rain: false } };
    let rainE = null;
    function setSun() {
      const la = S.lat0 || 32.8, lo = S.lon0 || -96.8, t = sunTime(gfx.sun, la, lo), p = solarPosition(t, la, lo), w = WEATHER[gfx.weather] || WEATHER.clear; S.sunAlt = p.alt; S.sunTime = t;
      S.sunNote = p.alt < -1 ? 'The sun is down in Dallas at that hour: the scene is lit by the moon, the lamps and the windows.' : '';
      V3.copy(scene.env.sunDir, sunVector(p.alt, p.az)); Object.assign(scene.env, { clouds: w.clouds, fogDensity: w.fogDensity, wetness: w.wetness, turbidity: w.turbidity, sunIntensity: w.sunIntensity, skyIntensity: w.skyIntensity }); scene.envChanged();
      if (w.rain && !rainE) { rainE = scene.createEntity('Rain', { parent: gFx, transient: true }); rainE.add('ParticleSystem').setPreset('rain'); } else if (!w.rain && rainE) { rainE.destroy(); rainE = null; }
      lampsLit(); need(2);
    }
    /* lamp posts along the streets; after dark the nearest ones are real lights */
    const LAMP = { ib: null, e: null, spots: [], pool: [], at: null };
    function lamps() {
      if (LAMP.e) { LAMP.e.destroy(); LAMP.ib.dispose(); LAMP.e = null; } LAMP.spots = []; if (!gfx.lamps) { lampsLit(); return; }
      S.roads.forEach((r, ri) => { if (r.kind !== 'street' && r.kind !== 'major') return; const w = (K.ROADW[r.kind] || K.ROADW.street)[0] / 2 + 1.1; let acc = 20 + (ri * 13) % 23, side = ri % 2 ? 1 : -1;
        for (let i = 0; i + 1 < r.pts.length; i++) { const a = r.pts[i], b = r.pts[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz); if (len < 0.5) continue; while (acc < len) { const t = acc / len, x = a[0] + dx * t - dz / len * w * side, z = a[1] + dz * t + dx / len * w * side; if (LAMP.spots.length < 900) LAMP.spots.push([x, z, Math.atan2(-dz * side, dx * side)]); acc += 46; side = -side; } acc -= len; } });
      if (!LAMP.spots.length) { lampsLit(); return; }
      if (!K.lampMesh) { const pole = Prim.cylinder(0.075, 0.05, 7.4, 8); for (let i = 1; i < pole.positions.length; i += 3) pole.positions[i] += 3.7; const arm = Prim.box(1.5, 0.08, 0.08); Prim.transform(arm, M4.translation(M4.create(), 0.7, 7.35, 0)); K.lampMesh = new Mesh(dev, Prim.merge([pole, arm], 'lamp post')); const head = Prim.box(0.55, 0.1, 0.26); Prim.transform(head, M4.translation(M4.create(), 1.35, 7.27, 0)); K.lampHead = new Mesh(dev, head); }
      LAMP.ib = new InstanceBuffer(dev, LAMP.spots.length); LAMP.spots.forEach(s => LAMP.ib.add(s[0], 0, s[1], -s[2] + Math.PI / 2, 1, 1, 1)); LAMP.e = scene.createEntity('Lamp posts', { parent: gFx, transient: true });
      const a = LAMP.e.add('InstancedRenderer'); a.instances = LAMP.ib; a.mesh = K.lampMesh; a.material = M.pole; a.maxDistance = 420; a.shadowDistance = 80; const b = LAMP.e.add('InstancedRenderer'); b.instances = LAMP.ib; b.mesh = K.lampHead; b.material = M.lamp; b.maxDistance = 700; b.castShadow = false; LAMP.at = null; lampsLit();
    }
    function lampsLit() {
      const night = smoothstep(2, -6, S.sunAlt), on = night > 0.25 && gfx.lamps && LAMP.spots.length > 0, n = on ? ({ ultra: 48, high: 36, medium: 20, low: 10 }[engine.quality] || 24) : 0; M.lamp.emissiveIntensity = on ? 60 * night : 0;
      while (LAMP.pool.length < n) { const e = scene.createEntity('Street light', { parent: gFx, transient: true }); e.add('Light', { type: 'spot', color: [1, 0.74, 0.44], intensity: 0, range: 26, angle: 150, blend: 0.6 }); e.transform.setEuler(-90, 0, 0); LAMP.pool.push(e); }
      LAMP.pool.forEach((e, i) => e.setActive(i < n)); if (!n) return; LAMP.at = [S.x, S.z];
      const near = LAMP.spots.map(s => [s, Math.hypot(s[0] - S.x, s[1] - S.z)]).sort((a, b) => a[1] - b[1]).slice(0, n);
      LAMP.pool.forEach((e, i) => { const s = near[i]; if (!s || i >= n) { e.setActive(false); return; } const c = Math.cos(s[0][2]), sn = Math.sin(s[0][2]); e.transform.setPosition(s[0][0] + c * 1.35, 7.1, s[0][1] + sn * 1.35); e.get('Light').intensity = 190 * night; });
    }

    /* ---------- the camera ---------- */
    const character = new Physics.Character(phys, {}), HEAD = [];
    function placeCamera() {
      const t = cam.entity.transform, m = S.mode; let eye;
      if (m === 'alta' && ALTA) { const a = ALTA.state; S.x = a.x; S.z = a.z; let cx, cy, cz;
        if (S.altaCam === 'payload') { S.yaw = (a.yaw + a.pan + 360) % 360; S.pitch = a.gimbal; cx = a.x; cy = a.y + 0.28; cz = a.z; }
        else { const yw = a.yaw + S.chase.yaw, y = Rd(yw), pp = Rd(S.chase.pitch), fx = Math.sin(y) * Math.cos(pp), fy = Math.sin(pp), fz = -Math.cos(y) * Math.cos(pp), d = S.chase.dist; S.yaw = (yw + 3600) % 360; S.pitch = S.chase.pitch; cx = a.x - fx * d; cy = Math.max(0.35, a.y + 0.5 - fy * d); cz = a.z - fz * d; }
        t.setPosition(cx, cy, cz); Q.fromEuler(t.rotation, Rd(S.pitch), -Rd(S.yaw), 0); t.dirty(); cam.fov = S.fov; cam.near = S.altaCam === 'payload' ? clamp(a.y * 0.03, 0.32, 3) : 0.3;
        const sd2 = (QUALITY[engine.quality] || QUALITY.high).shadowDistance * (a.y > 60 ? 2.2 : 1.5); if (R.settings.shadowDistance !== sd2) R.settings.shadowDistance = sd2; return; }
      if (m === 'orbit') { const o = S.orbit, y = Rd(o.yaw), p = Rd(o.pitch), fx = Math.sin(y) * Math.cos(p), fy = Math.sin(p), fz = -Math.cos(y) * Math.cos(p); S.x = o.at[0] - fx * o.dist; S.z = o.at[2] - fz * o.dist; eye = Math.max(0.6, o.at[1] - fy * o.dist); S.yaw = o.yaw; S.pitch = o.pitch; }
      else if (m === 'walk') eye = S.y + HEIGHT.walk.eye; else eye = HEIGHT[m].eye;
      t.setPosition(S.x, eye, S.z); Q.fromEuler(t.rotation, Rd(S.pitch), -Rd(S.yaw), 0); t.dirty(); cam.fov = S.fov; cam.near = clamp(eye * 0.03, 0.3, 5);
      const sd = (QUALITY[engine.quality] || QUALITY.high).shadowDistance * (m === 'metro' ? 9 : m === 'bird' ? 2.4 : m === 'drone' || m === 'orbit' ? 1.5 : 1); if (R.settings.shadowDistance !== sd) R.settings.shadowDistance = sd;
    }
    const speedOf = () => (S.mode === 'street' ? 7 : S.mode === 'walk' ? (engine.input.key('ShiftLeft') ? 9 : 4.5) : S.mode === 'drone' ? 18 : S.mode === 'metro' ? 320 : 45);
    engine.on('update', dt => {
      if (!S.ok) return; const k = S.keys, I = engine.input, pad = I.pad(); let fwd = (k.fwd ? 1 : 0) - (k.back ? 1 : 0), turn = (k.right ? 1 : 0) - (k.left ? 1 : 0), strafe = 0;
      if (document.activeElement === cv) { fwd += I.axis('KeyS', 'KeyW', 'ArrowDown', 'ArrowUp'); if (S.mode === 'walk') { strafe += I.axis('KeyA', 'KeyD'); turn += I.axis('ArrowLeft', 'ArrowRight'); } else turn += I.axis('KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight'); }
      if (pad && S.mode !== 'alta') { fwd -= pad.ly; strafe += pad.lx; turn += pad.rx; if (pad.ry) { S.pitch = clamp(S.pitch - pad.ry * 60 * dt, -85, 80); need(); } }
      fwd = clamp(fwd, -1, 1); turn = clamp(turn, -1, 1); const sp = speedOf();
      if (S.mode === 'alta' && ALTA) { const A = ALTA.input, foc = document.activeElement === cv;
        A.fwd = (k.fwd ? 1 : 0) - (k.back ? 1 : 0) + (foc ? I.axis('KeyS', 'KeyW') : 0); A.right = foc ? I.axis('KeyA', 'KeyD') : 0; A.yaw = (k.right ? 1 : 0) - (k.left ? 1 : 0) + (foc ? I.axis('ArrowLeft', 'ArrowRight') + I.axis('KeyQ', 'KeyE') : 0); A.up = (k.up ? 1 : 0) - (k.down ? 1 : 0) + (foc ? I.axis('ArrowDown', 'ArrowUp') + I.axis('KeyF', 'KeyR') : 0);
        if (pad) { A.fwd -= pad.ly; A.right += pad.lx; A.yaw += pad.rx; A.up -= pad.ry; } A.fwd = clamp(A.fwd, -1, 1); A.right = clamp(A.right, -1, 1); A.yaw = clamp(A.yaw, -1, 1); A.up = clamp(A.up, -1, 1);
        const px = ALTA.state.x, pz = ALTA.state.z; if (engine.playing && ALTA.update(dt, { floor: floorTop, block: blockAt, wind: [(scene.env.windDir ? scene.env.windDir[0] : 0.8) * scene.env.wind, (scene.env.windDir ? scene.env.windDir[1] : 0.6) * scene.env.wind] })) { S.x = ALTA.state.x; S.z = ALTA.state.z; after(Math.hypot(S.x - px, S.z - pz) < 0.02); need(); } }
      else if (S.mode === 'orbit') { if (turn) { S.orbit.yaw = (S.orbit.yaw + turn * 50 * dt + 360) % 360; need(); } if (fwd) { S.orbit.dist = clamp(S.orbit.dist * (1 - fwd * 0.9 * dt), 6, 900); need(); } if (S.orbitSpin) { S.orbit.yaw = (S.orbit.yaw + 9 * dt) % 360; need(); } }
      else if (S.mode === 'walk') { const y = Rd(S.yaw), dx = (Math.sin(y) * fwd + Math.cos(y) * strafe) * sp * dt, dz = (-Math.cos(y) * fwd + Math.sin(y) * strafe) * sp * dt; V3.set(character.pos, S.x, S.y, S.z); const was = S.y; character.move(dx, dz, dt, I.key('Space'));
        if (dx || dz || Math.abs(character.pos[1] - was) > 1e-4 || !character.grounded) { S.x = character.pos[0]; S.y = character.pos[1]; S.z = character.pos[2]; after(!(dx || dz)); } if (turn) { S.yaw = (S.yaw + turn * 75 * dt + 360) % 360; after(); } }
      else { if (fwd) walk(fwd * sp * dt); if (turn) { S.yaw = (S.yaw + turn * 75 * dt + 360) % 360; after(); } }
      if (S.tween) { const w = S.tween, u = Math.min(1, (performance.now() - w.t0) / w.ms), e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
        S.x = w.x0 + (w.x1 - w.x0) * e; S.z = w.z0 + (w.z1 - w.z0) * e; if (w.yaw1 != null) { const dy = ((w.yaw1 - w.yaw0 + 540) % 360) - 180; S.yaw = (w.yaw0 + dy * e + 360) % 360; } if (w.p1 != null) S.pitch = w.p0 + (w.p1 - w.p0) * e; need(); if (u >= 1) { S.tween = null; after(); } }
      placeCamera(); pump();
      if (rainE) rainE.transform.setPosition(S.x + Math.sin(Rd(S.yaw)) * 9, cam.entity.transform.position[1] + 13, S.z - Math.cos(Rd(S.yaw)) * 9);
      if (LAMP.at && Math.hypot(S.x - LAMP.at[0], S.z - LAMP.at[1]) > 18) lampsLit();
      /* the street's life: signals, traffic, and at night the headlights of the cars nearest the camera */
      if (gfx.life) { const night = smoothstep(2, -6, S.sunAlt), moving = engine.playing && engine.awake && engine.live, onFoot = S.mode === 'street' || S.mode === 'walk'; if (ST.update(dt, cam.entity.transform.position, { night, moving, viewer: onFoot ? [S.x, S.z] : null, reach: S.mode === 'metro' ? 900 : S.mode === 'bird' || S.mode === 'drone' || S.mode === 'alta' ? 600 : 330 })) need();
        const n = night > 0.3 ? ({ ultra: 8, high: 6, medium: 3, low: 0 }[engine.quality] || 0) : 0; while (HEAD.length < n) { const e = scene.createEntity('Headlights', { parent: gFx, transient: true }); e.add('Light', { type: 'spot', color: [1, 0.95, 0.85], intensity: 0, range: 34, angle: 70, blend: 0.5 }); HEAD.push(e); }
        const near = n ? ST.nearCars(cam.entity.transform.position, n) : []; HEAD.forEach((e, i) => { const c = near[i]; if (!c) { if (e.active) e.setActive(false); return; } if (!e.active) e.setActive(true); const hx = Math.sin(c.yaw), hz = Math.cos(c.yaw); e.transform.setPosition(c.x + hx * 2.4, 0.75, c.z + hz * 2.4); Q.fromEuler(e.transform.rotation, Rd(-9), Math.atan2(-hx, -hz), 0); e.transform.dirty(); e.get('Light').intensity = 260 * night; }); }
    });
    engine.on('frame', () => { drawLabels(); drawHud(); drawLegend(); });
    /* what this machine's graphics driver would not do: said in the view, and kept for the status line */
    const NICE = { volumetricFog: 'the fog with shafts', volumetricClouds: 'the clouds with depth', contactShadows: 'contact shadows', shafts: 'sun shafts', dof: 'depth of field', motionBlur: 'motion blur', 'x-ray': 'the x-ray layer' };
    engine.on('degraded', (what, msg) => { note(NICE[what] ? `This graphics driver refused ${NICE[what]}; it is switched off and the view goes on. (${msg})` : `${what} (${msg})`); if (env.onGraphics) env.onGraphics(graphics()); need(4); });
    engine.on('fatal', msg => { note(`The Scout Engine cannot draw with this graphics driver: ${msg} The classic 3D view and the map still work.`); });
    /* the editor asks to look at something: circle it */
    engine.on('focus', p => { if (S.mode !== 'orbit') setHeight('orbit'); S.orbit.at = [p[0], p[1], p[2]]; S.orbit.dist = 14; S.orbitSpin = false; need(); });
    engine.on('quality', () => { WIDE.reach = wideReach(); WIDE.treesAll(); if (S.ok) planSoon(); });
    engine.on('qualityLowered', q => { note(`Graphics lowered to ${QUALITY[q].label} to keep the view smooth; the Graphics menu above changes it.`); plan(); if (env.onGraphics) env.onGraphics(graphics()); });

    /* ---------- pointing, picking, the outlines of the one picked and the one pointed at ---------- */
    const solids = new Map();
    const solid = id => { let m = solids.get(id); if (m === undefined) { const b = env.byId(id); m = b ? K.solidOf(b) : null; solids.set(id, m); if (solids.size > 40) { const k = solids.keys().next().value; if (k !== S.cur && k !== S.hov) { const old = solids.get(k); if (old) old.dispose(); solids.delete(k); } } } return m; };
    function highlight() { const c = S.cur != null ? solid(S.cur) : null, h = S.hov != null && S.hov !== S.cur ? solid(S.hov) : null; R.setOutline('select', c ? [{ mesh: c }] : null); R.setOutline('hover', h ? [{ mesh: h }] : null); need(); }
    const pickAt = p => { const ray = cam.ray(p.x, p.y), h = phys.raycast(ray.origin, ray.dir, 4000); if (!h) return null; if (h.prism) { const b = env.byId(h.prism.userData.id); if (b) return { b, point: h.point }; } if (h.ground) return { ground: h.point }; return { other: h }; };
    let drag = null, hovT = 0; const I = engine.input;
    const lookNow = () => (S.mode === 'orbit' ? [S.orbit.yaw, S.orbit.pitch] : S.mode === 'alta' && ALTA ? (S.altaCam === 'payload' ? [ALTA.state.pan, ALTA.state.gimbal] : [S.chase.yaw, S.chase.pitch]) : [S.yaw, S.pitch]);
    I.on('down', (p, e) => { if (I.captured) return; const l = lookNow(); drag = { sx: e.clientX, sy: e.clientY, yaw: l[0], pitch: l[1] }; S.orbitSpin = false; });
    I.on('move', (p, e) => {
      if (I.captured) return;
      if (p.down && drag) { if (!p.moved) return; const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy, f = S.fov / 65 * 0.22; S.tween = null;
        if (S.mode === 'alta' && ALTA) { if (S.altaCam === 'payload') { ALTA.state.pan = clamp(drag.yaw - dx * f, -175, 175); ALTA.state.gimbal = clamp(drag.pitch + dy * f, -90, 25); } else { S.chase.yaw = drag.yaw - dx * 0.3; S.chase.pitch = clamp(drag.pitch + dy * 0.25, -86, 20); } }
        else if (S.mode === 'orbit') { S.orbit.yaw = (drag.yaw - dx * 0.3 + 3600) % 360; S.orbit.pitch = clamp(drag.pitch + dy * 0.25, -88, 12); } else { S.yaw = (drag.yaw - dx * f + 3600) % 360; S.pitch = clamp(drag.pitch + dy * f, -85, 80); }
        need(); if (env.onMove) env.onMove(state()); if (env.onHover) env.onHover(null, e); return; }
      const now = performance.now(); if (now - hovT < 60) return; hovT = now; const h = pickAt(p), b = h && h.b, id = b ? b.id : null; if (id !== S.hov) { S.hov = id; highlight(); } cv.style.cursor = b ? 'pointer' : h && h.ground ? 'crosshair' : 'grab'; if (env.onHover) env.onHover(b || null, e);
    });
    I.on('up', () => { drag = null; });
    I.on('click', (p, e) => { if (I.captured || e.button !== 0) return; const h = pickAt(p); if (!h) return; if (h.b) { S.cur = h.b.id; highlight(); if (env.onPick) env.onPick(h.b); return; } if (h.ground && S.mode === 'alta' && ALTA) { ALTA.goTo(h.ground[0], h.ground[2]); engine.playing = true; need(); } else if (h.ground && S.mode !== 'orbit') goTo(h.ground[0], h.ground[2]); });
    I.on('dblclick', p => { if (I.captured) return; const h = pickAt(p); if (h && h.b && S.mode === 'alta' && ALTA) { standOff(h.b); return; } if (h && h.b && env.onFront) env.onFront(h.b); });
    /* send the drone to hover off a building's face, looking at it */
    function standOff(b) { const [x, z] = toL(b.lat, b.lon), a = ALTA.state, dx = a.x - x, dz = a.z - z, d = Math.hypot(dx, dz) || 1, r = Math.max(26, Math.sqrt(b.sqft ? b.sqft / 10.76 : 200) * 0.5 + 20); ALTA.goTo(x + dx / d * r, z + dz / d * r, (DEG * Math.atan2(-dx, dz) + 360) % 360); engine.playing = true; need(); }
    I.on('leave', () => { if (S.hov != null) { S.hov = null; highlight(); } if (env.onHover) env.onHover(null); });
    I.on('wheel', dy => { if (I.captured) return; if (S.mode === 'orbit') S.orbit.dist = clamp(S.orbit.dist * (1 + dy * 0.0011), 6, 900); else if (S.mode === 'alta' && S.altaCam !== 'payload') S.chase.dist = clamp(S.chase.dist * (1 + dy * 0.0011), 2.6, 80); else S.fov = clamp(S.fov * (1 + dy * 0.0011), 22, 95); need(); });
    I.on('key', code => { if (code === 'KeyX') { setXray(!gfx.xray); return; } if (S.mode === 'alta' && ALTA) { if (code === 'KeyC') { S.altaCam = S.altaCam === 'payload' ? 'chase' : 'payload'; need(); } else if (code === 'KeyH') ALTA.rtl(); else if (code === 'KeyL') { if (ALTA.state.mode === 'Landed') ALTA.takeoff(28); else ALTA.land(); } engine.playing = true; need(); if (env.onGraphics) env.onGraphics(graphics()); return; }
      if (code === 'KeyQ' || code === 'PageUp') setHeight(S.mode === 'street' || S.mode === 'walk' ? 'drone' : S.mode === 'drone' ? 'bird' : 'metro'); else if (code === 'KeyE' || code === 'PageDown') setHeight(S.mode === 'metro' ? 'bird' : S.mode === 'bird' ? 'drone' : 'street'); });

    /* ---------- labels: the reading over each building near the camera, and the street names; plain elements laid over the view ---------- */
    const LBL = { pool: [], n: 0, vis: new Map(), tick: 0 };
    function drawLabels() {
      const cp = cam.position, list = [], W = cv.clientWidth, H = cv.clientHeight; LBL.tick++;
      CELLS.forEach(c => { if (Math.hypot(c.cx - cp[0], c.cz - cp[2]) > 330) return; for (const l of c.labels) { const d = Math.hypot(l.x - cp[0], l.y - cp[1], l.z - cp[2]); if (d < 170 || l.id === S.cur) list.push([l, d]); } });
      list.sort((a, b) => (a[0].id === S.cur ? -1 : b[0].id === S.cur ? 1 : a[1] - b[1])); if (list.length > 26) list.length = 26; let n = 0;
      const put = (x, y, text, cls, style) => { let el = LBL.pool[n]; if (!el) { el = document.createElement('div'); labelsEl.appendChild(el); LBL.pool.push(el); } if (el._t !== text) { el.textContent = text; el._t = text; } if (el._c !== cls) { el.className = cls; el._c = cls; } el.style.cssText = `transform:translate(-50%,-100%) translate(${x.toFixed(1)}px,${y.toFixed(1)}px);${style || ''}`; n++; };
      for (const [l, d] of list) { const s = cam.project([l.x, l.y, l.z]); if (!s || s[0] < -0.05 || s[0] > 1.05 || s[1] < 0 || s[1] > 1.05) continue; const b = env.byId(l.id); if (!b) continue; const cur = l.id === S.cur;
        let v = LBL.vis.get(l.id); if (!v || LBL.tick - v.t > 6) { let seen = true; if (!cur) { const dx = l.x - cp[0], dy = l.y - 1.2 - cp[1], dz = l.z - cp[2], dl = Math.hypot(dx, dy, dz) || 1, h = phys.raycast(cp, [dx / dl, dy / dl, dz / dl], dl - 0.6); seen = !h || !h.prism || h.prism.userData.id === l.id; } v = { t: LBL.tick + (l.id % 5), seen }; LBL.vis.set(l.id, v); }
        if (!v.seen) continue; put(s[0] * W, s[1] * H, env.label ? env.label(b) : '', 'se-lbl ' + (b.status || 'o') + (cur ? ' cur' : ''), `opacity:${cur ? 1 : clamp(1.25 - d / 150, 0.35, 1).toFixed(2)};font-size:${cur ? 12.5 : clamp(13 - d / 28, 9.5, 12).toFixed(1)}px`); }
      if (S.mode !== 'bird') { const seenN = new Set(); let k = 0; for (const r of S.graph) { if (!r.name || seenN.has(r.name) || k >= 5) continue; const o = nearestOnRoads(cp[0], cp[2], 110, [r]); if (!o || o.d < 6) continue; const s = cam.project([o.x, 0.4, o.z]); if (!s || s[0] < 0.03 || s[0] > 0.97 || s[1] < 0.05 || s[1] > 0.97) continue; seenN.add(r.name); k++; put(s[0] * W, s[1] * H, r.name, 'se-lbl road', ''); } }
      for (let i = n; i < LBL.n; i++) LBL.pool[i].style.cssText = 'display:none'; LBL.n = n; if (LBL.vis.size > 600) LBL.vis.clear();
    }

    /* ---------- moves ---------- */
    function goTo(x, z, yaw, pitch) { let tx = x, tz = z, o = null; if (S.mode === 'street') { o = nearestOnRoads(x, z, 45); if (o) { tx = o.x; tz = o.z; } }
      S.tween = { t0: performance.now(), ms: clamp(Math.hypot(tx - S.x, tz - S.z) * 18, 250, 1400), x0: S.x, z0: S.z, x1: tx, z1: tz, yaw0: S.yaw, yaw1: yaw != null ? yaw : null, p0: S.pitch, p1: pitch != null ? pitch : null }; S.on = o; need(); }
    function faceAt(b, smooth) {
      if (!b) return; const [x, z] = toL(b.lat, b.lon), h = Math.max(2.4, env.height(b));
      if (S.mode === 'alta' && ALTA) { const a = ALTA.state; a.yaw = (DEG * Math.atan2(x - a.x, -(z - a.z)) + 360) % 360; a.pan = 0; if (S.altaCam === 'payload') a.gimbal = clamp(DEG * Math.atan2(h * 0.5 - a.y, Math.max(1, Math.hypot(x - a.x, z - a.z))), -90, 25); else S.chase.yaw = 0; need(); if (env.onMove) env.onMove(state()); return; }
      if (S.mode === 'orbit') { S.orbit.at = [x, h * 0.5, z]; S.orbit.dist = clamp(Math.max(h * 2.2, 34), 20, 400); need(); if (env.onMove) env.onMove(state()); return; }
      const d = Math.max(1, Math.hypot(x - S.x, z - S.z)), yaw = (DEG * Math.atan2(x - S.x, -(z - S.z)) + 360) % 360, eye = HEIGHT[S.mode].eye, pitch = clamp(DEG * Math.atan2(h * 0.55 - eye, d), -80, 45);
      if (smooth) S.tween = { t0: performance.now(), ms: 500, x0: S.x, z0: S.z, x1: S.x, z1: S.z, yaw0: S.yaw, yaw1: yaw, p0: S.pitch, p1: pitch }; else { S.yaw = yaw; S.pitch = pitch; } need(); if (env.onMove) env.onMove(state());
    }
    function setHeight(m) {
      if (!HEIGHT[m] || m === S.mode) return; const was = S.mode; S.mode = m; S.tween = null;
      if (was === 'alta' && ALTA) ALTA.show(false);
      if (m === 'metro' || was === 'metro') { WIDE.reach = wideReach(); }
      if (m === 'alta') { if (!ALTA) ALTA = AltaKit(engine, K); ALTA.place(S.x, S.z, S.yaw, floorTop(S.x, S.z)); ALTA.show(true); ALTA.takeoff(28); engine.playing = true; S.fov = 65; }
      if (m === 'orbit') { const b = S.cur != null ? env.byId(S.cur) : null; if (b) { const [x, z] = toL(b.lat, b.lon), h = Math.max(2.4, env.height(b)); S.orbit.at = [x, h * 0.5, z]; S.orbit.dist = clamp(Math.max(h * 2.2, 34), 20, 400); } else { const y = Rd(S.yaw); S.orbit.at = [S.x + Math.sin(y) * 30, 3, S.z - Math.cos(y) * 30]; S.orbit.dist = 55; } S.orbit.yaw = S.yaw; S.orbit.pitch = -26; S.orbitSpin = true; }
      else { if (was === 'orbit') S.fov = 65; S.pitch = HEIGHT[m].pitch; if (m === 'street') { const o = nearestOnRoads(S.x, S.z, 60); if (o) { S.on = o; S.x = o.x; S.z = o.z; } } else S.on = null; if (m === 'walk') { S.y = phys.floorAt(S.x, S.z, 0, 0.5); character.vy = 0; const pr = phys.prismsIn(S.x, S.z, S.x, S.z, []).find(p => Poly.contains(p.ring, S.x, S.z)); if (pr) { const o = nearestOnRoads(S.x, S.z, 80); if (o) { S.x = o.x; S.z = o.z; } S.y = 0; } } }
      plan(); need(); if (env.onMove) env.onMove(state());
    }
    function setXray(on) { gfx.xray = !!on; saveGfx(); xraySync(true); drawLegend(); need(3); if (env.onGraphics) env.onGraphics(graphics()); }
    function state() { const [la, lo] = toLL(S.x, S.z), r = roadAt(); return { lat: la, lon: lo, yaw: S.yaw, pitch: S.pitch, mode: S.mode, alta: S.mode === 'alta' && ALTA ? { mode: ALTA.state.mode, alt: ALTA.state.y, speed: Math.hypot(ALTA.state.vx, ALTA.state.vz), battery: ALTA.state.battery, cam: S.altaCam } : null, road: r ? r.name : '', roadKind: r ? r.kind : '', built: S.built, roads: S.roads.length, trees: S.treeN, note: S.note, cells: CELLS.size, queued: queue.length }; }
    function graphics() { const st = R.stats, T = engine.time; return { q: gfx.q, tier: engine.quality, label: QUALITY[engine.quality].label, auto: engine.quality, sun: gfx.sun, weather: gfx.weather, trees: gfx.trees, lamps: gfx.lamps, glow: gfx.glow, life: gfx.life, wide: gfx.wide !== false, wideCan: !!env.context, refused: [...R.refused].map(k => NICE[k] || k), refusedWhy: R.refusedWhy, broken: engine.broken || null, xray: !!gfx.xray, xrayN: XM.size, roofKit: gfx.roofKit !== false, altaCam: S.altaCam, wideN: WIDE.stats.buildings, wideTrees: WIDE.stats.trees, wideOsm: WIDE.stats.osm, wideReplaced: WIDE.stats.replaced, wideOsmFailed: WIDE.stats.osmFailed, widePending: WIDE.stats.pending, skyline: WIDE.stats.skyline, live: engine.live, gpu: dev.caps.gpu, sunAlt: Math.round(S.sunAlt), sunTime: S.sunTime, sunNote: S.sunNote, night: +R.sky.night.toFixed(2), fps: Math.round(T.fps), ms: +T.ms.toFixed(1), draws: st.draws, tris: st.tris, lights: st.lights, view: R.settings.viewMode, playing: engine.playing }; }

    /* ---------- building the world around a point ---------- */
    function recenter(la, lo, keep) {
      const keepLL = keep || toLL(S.x, S.z), homeLL = ALTA ? toLL(ALTA.state.home[0], ALTA.state.home[1]) : null, tgtLL = ALTA && ALTA.state.target ? toLL(ALTA.state.target[0], ALTA.state.target[1]) : null; S.gen++; xrayClear(); HV.clear(); [...CELLS.values()].forEach(dropCell); IMG.forEach(dropImagery); FAR.forEach(f => { f.e.destroy(); f.mesh.dispose(); f.tex.dispose(); }); FAR.clear(); WIDE.reset(); phys.clearPrisms(); solids.forEach(m => m && m.dispose()); solids.clear(); rectCache.clear(); queue.length = 0; treeQ.length = 0; LBL.vis.clear();
      S.lat0 = la; S.lon0 = lo; S.ky = mLat(la); S.kx = mLon(la); [S.x, S.z] = toL(keepLL[0], keepLL[1]); if (ALTA) { ALTA.state.x = S.x; ALTA.state.z = S.z; ALTA.state.home = toL(homeLL[0], homeLL[1]); if (tgtLL) ALTA.state.target = toL(tgtLL[0], tgtLL[1]); } S.on = null; S.roadsAt = null; S.roads = []; S.graph = []; setRoads([]); S.treeN = 0;
      setSun(); if (env.ensure) env.ensure(la, lo, reach() + 80); index(); plan(); loadRoads(); R.reset = true; highlight();
    }
    let ensureAt = null; const ensureSoon = () => { if (!env.ensure || !S.ok) return; if (ensureAt && Math.hypot(S.x - ensureAt[0], S.z - ensureAt[1]) < 90) return; ensureAt = [S.x, S.z]; const [la, lo] = toLL(S.x, S.z); env.ensure(la, lo, reach() + 80); };
    engine.on('idle', ensureSoon); setInterval(() => { if (engine.running) ensureSoon(); }, 1500);

    /* ---------- props for the physics: crates dropped from the camera ---------- */
    function dropCrate(kind) { const y = Rd(S.yaw), p = Rd(S.pitch), f = [Math.sin(y) * Math.cos(p), Math.sin(p), -Math.cos(y) * Math.cos(p)], cp = cam.position, sz = kind === 'ball' ? 0.45 : 0.5 + Math.random() * 0.4;
      const e = scene.createEntity(kind === 'ball' ? 'Ball' : 'Crate', { position: [cp[0] + f[0] * 2.2, cp[1] + f[1] * 2.2, cp[2] + f[2] * 2.2] }), mr = e.add('MeshRenderer'); mr.setShape(kind === 'ball' ? { kind: 'sphere', args: [sz, 24] } : { kind: 'box', args: [sz, sz, sz] }); mr.material = kind === 'ball' ? new Material({ name: 'Ball', albedo: '#d9d9d9', metallic: 1, roughness: 0.2 }) : M.crate;
      const rb = e.add('RigidBody'); engine.playing = true; setTimeout(() => { if (rb.body) rb.body.impulse([f[0] * rb.body.mass * 9, f[1] * rb.body.mass * 9 + rb.body.mass * 2, f[2] * rb.body.mass * 9]); }, 30); need(30); return e; }

    engine.start();
    return {
      async open(lat, lon, yaw, o) {
        o = o || {}; engine.start(); engine.resize(); if (o.mode && HEIGHT[o.mode]) S.mode = o.mode;
        const far = !S.ok || Math.hypot(...toL(lat, lon)) > 9000; S.ok = true; if (far) recenter(lat, lon, [lat, lon]);
        { const p1 = toL(lat, lon); if (S.mode === 'alta' && ALTA && !far) { const d = Math.hypot(p1[0] - ALTA.state.x, p1[1] - ALTA.state.z); if (d < 1500 && d > 3) { ALTA.goTo(p1[0], p1[1]); engine.playing = true; if (o.cur !== undefined) S.cur = o.cur; index(); plan(); highlight(); need(3); if (env.onMove) env.onMove(state()); return; } } }
        [S.x, S.z] = toL(lat, lon); S.on = null; S.tween = null; if (S.mode === 'alta' && ALTA) { ALTA.place(S.x, S.z, yaw != null ? yaw : S.yaw, 0); ALTA.takeoff(28); } if (S.mode === 'street') { const r = nearestOnRoads(S.x, S.z, 45); if (r) { S.on = r; S.x = r.x; S.z = r.z; } }
        S.yaw = yaw != null ? yaw : S.yaw; S.pitch = o.pitch != null ? o.pitch : HEIGHT[S.mode].pitch; if (o.cur !== undefined) S.cur = o.cur; if (o.face) faceAt(o.face, false);
        index(); plan(); highlight(); R.reset = true; need(3); ensureAt = null; ensureSoon(); if (env.onMove) env.onMove(state());
      },
      face: b => faceAt(b, true), walk: m => walk(m), turn: d => { S.yaw = (S.yaw + d + 360) % 360; need(); if (env.onMove) env.onMove(state()); }, setHeight, state,
      setCurrent(id) { S.cur = id; highlight(); if (S.mode === 'orbit' && id != null) { const b = env.byId(id); if (b) faceAt(b, true); } },
      refresh() { if (S.ok) { index(); planSoon(); } }, labels() { need(); },
      hold(k, on) { S.keys[k] = !!on; if (on) engine.wake(); need(); },
      start() { engine.start(); engine.resize(); need(3); }, stop() { engine.stop(); S.keys = {}; },
      project(lat, lon, up) { const [x, z] = toL(lat, lon), s = cam.project([x, up, z]); return s ? [s[0] * cv.clientWidth, s[1] * cv.clientHeight] : null; },
      graphics,
      setGraphics(o) {
        o = o || {}; if (o.q && o.q !== gfx.q && (o.q === 'auto' || QUALITY[o.q])) { gfx.q = o.q; engine.setQuality(o.q); placeCamera(); plan(); }
        if (o.sun != null && o.sun !== gfx.sun) { gfx.sun = o.sun; setSun(); } if (o.weather && WEATHER[o.weather] && o.weather !== gfx.weather) { gfx.weather = o.weather; setSun(); }
        if (o.trees != null && !!o.trees !== gfx.trees) { gfx.trees = !!o.trees; CELLS.forEach(c => { if (gfx.trees) { c.treeWait = performance.now(); if (!treeQ.includes(c)) treeQ.push(c); } else disposeTrees(c); }); WIDE.treesAll(); }
        if (o.lamps != null && !!o.lamps !== gfx.lamps) { gfx.lamps = !!o.lamps; lamps(); } if (o.life != null && !!o.life !== gfx.life) { gfx.life = !!o.life; buildRoads(); HEAD.forEach(e => e.setActive(false)); } if (o.glow && o.glow !== gfx.glow) { gfx.glow = o.glow; K.setGlow(gfx.glow); } if (o.live != null) { gfx.live = engine.live = !!o.live; } if (o.xray != null && !!o.xray !== !!gfx.xray) setXray(o.xray); if (o.roofKit != null && !!o.roofKit !== (gfx.roofKit !== false)) { gfx.roofKit = !!o.roofKit; planSoon(); } if (o.altaCam && (o.altaCam === 'chase' || o.altaCam === 'payload')) S.altaCam = o.altaCam; if (o.treeCap != null) { S.treeCap = +o.treeCap; WIDE.treesAll(); } if (o.wide != null && !!o.wide !== gfx.wide) { gfx.wide = !!o.wide; WIDE.set(gfx.wide, wideReach()); farTiles(); }
        if (o.view && R.viewModes.includes(o.view)) R.settings.viewMode = o.view; if (o.playing != null) engine.playing = !!o.playing;
        saveGfx(); need(3); return graphics();
      },
      dropCrate, engine, canvas: cv, kit: K, street: ST, world: S, hvac: HV, hvacRead: id => { const b = env.byId(id); if (!b) return null; try { const r = HV.read(b); return r.inf ? { top: r.inf.top, list: r.inf.list, fam: r.inf.famTop, famName: HV.infer.famName[r.inf.famTop], famP: r.inf.famP, conf: r.inf.conf, confWhy: r.inf.confWhy, basis: r.inf.basis, evidence: r.inf.evidence, facts: r.inf.facts, drawn: HV.code(b) } : null; } catch (e) { return null; } }, hvacRefresh: () => { xraySync(true); plan(); drawLegend(true); need(2); }, xray: on => setXray(on), xrayLayer: XR, wideKit: WIDE,
      /* the Alta X: its state, and the things its controller's buttons do */
      alta: { get craft() { return ALTA; }, spec: () => (ALTA ? ALTA.SPEC : null), takeoff() { if (ALTA) { ALTA.takeoff(28); engine.playing = true; need(); } }, land() { if (ALTA) { ALTA.land(); need(); } }, home() { if (ALTA) { ALTA.rtl(); need(); } }, camera(c) { S.altaCam = c || (S.altaCam === 'payload' ? 'chase' : 'payload'); need(); return S.altaCam; } },
      /* the editor laid over the view (made the first time it is asked for) */
      editor(on) { if (!this._ed) { if (!on) return null; this._ed = new SE.Editor(engine, host, { onLog: t => note(t) }); } this._ed.setOpen(on); labelsEl.style.display = on ? 'none' : ''; return this._ed; },
      get editing() { return !!(this._ed && this._ed.open); },
      sound(on) { if (!engine.audio) return false; if (on) { if (!this._wind) { const e = scene.createEntity('Wind', { transient: true }); e.add('AudioSource', { kind: 'wind', volume: 0.25, ambient: true }); this._wind = e; } return engine.audio.enable(); } engine.audio.disable(); return false; },
      /* for tests: what the world holds */
      debug() { return { wide: WIDE.debug(), street: ST.stats || null, cells: [...CELLS.values()].map(c => ({ key: c.key, built: c.built, n: c.count, extra: c.extra || 0, ctx: !!c.ctx, parts: c.parts.length, trees: c.trees ? c.trees.n : 0, img: c.img.ok })), far: FAR.size, queue: queue.length, treeQ: treeQ.length, prisms: phys.prisms.length, lamps: LAMP.spots.length, labels: LBL.n, stats: Object.assign({}, R.stats), programs: dev.stats.programs, textures: dev.stats.textures, buffers: dev.stats.buffers, quality: engine.quality, err: dev.gl.getError() }; },
    };
  };

  window.__SCOUT_ENGINE__ = SE;
})();
</script>
