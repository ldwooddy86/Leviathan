/* Draws M3Body() to PNG files with a small software rasteriser, so the shape can be judged without a browser.
   node preview.js [outdir]   -> side.png front.png rear.png top.png q_front.png q_rear.png */
const path = require('path'), fs = require('fs'), zlib = require('zlib');
const { M3Body } = require(path.join(__dirname, '..', 'car_body.js'));
const OUT = process.argv[2] || path.join(__dirname, '..', 'shots');
const body = M3Body(), D = body.dims;
const COL = { paint: [0.02, 0.022, 0.028, 0.9], glass: [0.03, 0.04, 0.05, 1.0], gloss: [0.012, 0.012, 0.014, 0.8], matte: [0.03, 0.03, 0.03, 0.05], head: [0.75, 0.78, 0.8, 0.6], drl: [1, 1, 1, 0], tail: [0.5, 0.02, 0.02, 0.5], rev: [0.8, 0.8, 0.8, 0.3], chmsl: [0.7, 0.03, 0.03, 0.2], plate: [0.9, 0.9, 0.86, 0.1], pipe: [0.3, 0.3, 0.32, 0.9],
  tyre: [0.035, 0.035, 0.035, 0.05], rim: [0.07, 0.07, 0.075, 0.4], bright: [0.5, 0.51, 0.53, 0.8], brake: [0.3, 0.3, 0.3, 0.3], calliper: [0.05, 0.12, 0.6, 0.3], dark: [0.05, 0.05, 0.05, 0.1], screen: [0.2, 0.4, 0.8, 0], wheel: [0.04, 0.04, 0.04, 0.1] };
/* gather triangles: [positions (world), normal per vertex, colour] */
const tris = [];
function add(g, col, xf) { const P = g.positions, N = g.normals, I = g.indices; for (let i = 0; i < I.length; i += 3) { const t = []; for (let k = 0; k < 3; k++) { const a = I[i + k] * 3; let p = [P[a], P[a + 1], P[a + 2]], n = [N[a], N[a + 1], N[a + 2]]; if (xf) { p = xf(p, 1); n = xf(n, 0); } t.push(p, n); } t.push(col); tris.push(t); } }
Object.keys(body.parts).forEach(k => add(body.parts[k], COL[k] || [1, 0, 1, 0]));
[[1, D.wb / 2, D.trackF, body.wheelF, D.rF, D.twF], [-1, D.wb / 2, D.trackF, body.wheelF, D.rF, D.twF], [1, -D.wb / 2, D.trackR, body.wheelR, D.rR, D.twR], [-1, -D.wb / 2, D.trackR, body.wheelR, D.rR, D.twR]].forEach(([sg, s, tr, W, R]) => {
  const xf = (p, pos) => [sg * p[0] + (pos ? sg * tr / 2 : 0), p[1] + (pos ? R : 0), sg * p[2] + (pos ? -s : 0)];
  Object.keys(W).forEach(k => add(W[k], COL[k], xf)); });
if (process.argv.includes('--cabin')) Object.keys(body.cabin).forEach(k => add(body.cabin[k], COL[k], k === 'wheel' ? (p, pos) => [p[0] + (pos ? D.steeringWheel[0] : 0), p[1] + (pos ? D.steeringWheel[1] : 0), p[2] + (pos ? D.steeringWheel[2] : 0)] : null));
console.log('triangles', tris.length, 'body', body.tris, 'parts', Object.keys(body.parts).map(k => k + ':' + body.parts[k].indices.length / 3).join(' '));
let mn = [9, 9, 9], mx = [-9, -9, -9]; Object.values(body.parts).forEach(g => { for (let i = 0; i < g.positions.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], g.positions[i + k]); mx[k] = Math.max(mx[k], g.positions[i + k]); if (!isFinite(g.positions[i + k]) || !isFinite(g.normals[i + k])) throw new Error('NaN in geometry'); } });
console.log('body bounds x', mn[0].toFixed(3), mx[0].toFixed(3), 'y', mn[1].toFixed(3), mx[1].toFixed(3), 'z', mn[2].toFixed(3), mx[2].toFixed(3), ' (want x +-0.9515 + mirrors, y to 1.433, z', (-D.nose).toFixed(3), (-D.tail).toFixed(3) + ')');

function crcPng(w, h, rgb) { const raw = Buffer.alloc((w * 3 + 1) * h); for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3); }
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]), crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td) >>> 0); return Buffer.concat([len, td, crc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]); }
const norm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }, cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/* a view: the eye's direction (from the car toward the eye), the picture's width in metres */
function render(name, toEye, span, W, H, centre) {
  const f = norm(toEye), r = norm(cross([0, 1, 0], f)), u = cross(f, r), c = centre || [0, 0.62, 0.1], S = W / span, col = new Float32Array(W * H * 3), zb = new Float32Array(W * H).fill(-1e9);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const t = y / H, o = (y * W + x) * 3; col[o] = 0.55 - 0.2 * t; col[o + 1] = 0.6 - 0.2 * t; col[o + 2] = 0.68 - 0.2 * t; }
  const sun = norm([0.35, 0.8, -0.45]), V = f;
  const proj = p => { const d = [p[0] - c[0], p[1] - c[1], p[2] - c[2]]; return [W / 2 + dot(d, r) * S, H / 2 - dot(d, u) * S, dot(d, f)]; };
  /* the ground: a grey plane, drawn by hand as the horizon line for side views */
  for (const t of tris) {
    const a = proj(t[0]), b = proj(t[2]), cc = proj(t[4]), area = (b[0] - a[0]) * (cc[1] - a[1]) - (b[1] - a[1]) * (cc[0] - a[0]); if (area >= 0) continue;   // back faces
    const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0], cc[0]))), x1 = Math.min(W - 1, Math.ceil(Math.max(a[0], b[0], cc[0]))), y0 = Math.max(0, Math.floor(Math.min(a[1], b[1], cc[1]))), y1 = Math.min(H - 1, Math.ceil(Math.max(a[1], b[1], cc[1])));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5, py = y + 0.5, w0 = ((b[0] - px) * (cc[1] - py) - (b[1] - py) * (cc[0] - px)) / area, w1 = ((cc[0] - px) * (a[1] - py) - (cc[1] - py) * (a[0] - px)) / area, w2 = 1 - w0 - w1; if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      const z = a[2] * w0 + b[2] * w1 + cc[2] * w2, i = y * W + x; if (z <= zb[i]) continue; zb[i] = z;
      const n = norm([t[1][0] * w0 + t[3][0] * w1 + t[5][0] * w2, t[1][1] * w0 + t[3][1] * w1 + t[5][1] * w2, t[1][2] * w0 + t[3][2] * w1 + t[5][2] * w2]), k = t[6];
      const nl = Math.max(0, dot(n, sun)), hv = norm([sun[0] + V[0], sun[1] + V[1], sun[2] + V[2]]), sp = Math.pow(Math.max(0, dot(n, hv)), 120) * 3 * k[3];
      /* a mirror of the sky for glossy parts: bright above the horizon, dark ground below */
      const nv = dot(n, V), R = [2 * nv * n[0] - V[0], 2 * nv * n[1] - V[1], 2 * nv * n[2] - V[2]], fres = 0.04 + 0.96 * Math.pow(1 - Math.max(0, nv), 5), sky = R[1] > 0 ? 0.55 + 0.45 * R[1] : 0.12, refl = k[3] * fres * sky * 1.6 + k[3] * 0.035 * sky;
      const amb = 0.35 + 0.25 * n[1], o = i * 3; for (let q = 0; q < 3; q++) col[o + q] = k[q] * (amb + nl * 1.1) + sp + refl;
    }
  }
  const rgb = Buffer.alloc(W * H * 3); for (let i = 0; i < W * H * 3; i++) rgb[i] = Math.round(255 * Math.pow(clampv(col[i]), 1 / 2.2));
  fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, name + '.png'), crcPng(W, H, rgb));
}
function clampv(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
render('pv_side', [1, 0.02, 0], 5.4, 900, 330);
render('pv_front', [0, 0.05, -1], 2.6, 520, 380);
render('pv_rear', [0, 0.05, 1], 2.6, 520, 380);
render('pv_top', [0.001, 1, 0.02], 5.4, 900, 420);
render('pv_qfront', [0.75, 0.32, -1], 5.2, 900, 480);
render('pv_qrear', [0.8, 0.35, 1], 5.2, 900, 480);
render('pv_wheel', [1, 0.05, -0.25], 1.0, 420, 420, [0.9, 0.34, -D.wb / 2]);
console.log('wrote', OUT);
