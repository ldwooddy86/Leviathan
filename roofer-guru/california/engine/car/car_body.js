/* ============================================================================================
   M3Body: the shape of the car, as plain arrays. No engine names, no DOM: it runs in Node too
   (tests/preview.js draws it to a PNG so the shape can be looked at without a browser).

   The car is the US model-year 2027 BMW M3 Competition with M xDrive (the sixth generation, G80).
   Published and used here (BMW Media Information sheet 05/2021 and the US releases, see
   ../car_figures.md and SP/research/ca/engine_evidence.md section A3): length 4794 mm, width
   1903 mm, height 1433 mm, wheelbase 2857 mm, track 1617 / 1605 mm, ground clearance 122 mm,
   tyres 275/35 ZR19 front and 285/30 ZR20 rear.
   Not published, so ASSUMED here (a likeness made from the dimensions and the car's known look,
   not BMW's drawing): the front overhang (0.84 m), every height along the roof line, the belt
   line, the plan corners, the arch flare, the size and place of the two tall grille openings,
   the lamps, the four tail pipes, the mirrors, the wheel's spoke pattern and all of the cabin.

   MODEL AXES  x to the car's right, y up, z to the rear (the nose is at -z), origin on the ground
   under the middle of the wheelbase. In the text below s = -z is "metres ahead of the middle".

   Returns { dims, parts: { name: { positions, normals, indices } }, wheelF, wheelR, cabin, wheelRim }.
   ============================================================================================ */
function M3Body() {
  'use strict';
  var PI = Math.PI, TAU = PI * 2;
  function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function sm(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }

  var D = {
    L: 4.794, W: 1.903, H: 1.433, wb: 2.857, trackF: 1.617, trackR: 1.605, gc: 0.122,          // published
    fo: 0.84,                                                                                    // assumed front overhang
    rF: (19 * 25.4 / 2 + 275 * 0.35) / 1000 * 0.985, rR: (20 * 25.4 / 2 + 285 * 0.30) / 1000 * 0.985,   // rolling radii, as the physics uses
    twF: 0.275, twR: 0.285, rimF: 19 * 0.0254 / 2 + 0.012, rimR: 20 * 0.0254 / 2 + 0.012
  };
  var sN = D.wb / 2 + D.fo, sT = sN - D.L, W2 = D.W / 2, saF = D.wb / 2, saR = -D.wb / 2;
  D.nose = sN; D.tail = sT;
  var WB = 0.917;                                   // half width of the body between the arches (the arches flare to W2)
  /* where the glass starts and ends along the car: rear glass foot, rear of roof, front of roof, windscreen foot */
  var zc0 = -1.95, zc1 = -1.08, zc2 = 0.22, zc3 = 1.05, sB = -0.14;
  D.cab = [zc0, zc1, zc2, zc3];

  /* ---------- the side view: the centre line of the top, the shoulder, the underside ---------- */
  var TOP = [[sT - 0.3, 1.07], [sT, 1.075], [sT + 0.05, 1.092], [zc0, 1.098], [zc1, 1.408], [-0.38, 1.433], [zc2, 1.398], [zc3, 0.992], [1.85, 0.885], [sN, 0.80], [sN + 0.3, 0.78]];
  function topRaw(s) { for (var i = 0; i + 1 < TOP.length; i++) if (s <= TOP[i + 1][0]) { var a = TOP[i], b = TOP[i + 1]; return lerp(a[1], b[1], clamp((s - a[0]) / (b[0] - a[0]), 0, 1)); } return TOP[TOP.length - 1][1]; }
  var SD = 0.075;
  function top(s) {
    var zz = clamp(s, sT, sN), y = (topRaw(zz - 2 * SD) + 2 * topRaw(zz - SD) + 3 * topRaw(zz) + 2 * topRaw(zz + SD) + topRaw(zz + 2 * SD)) / 9;
    y -= 0.05 * Math.pow(clamp((s - (sN - 0.16)) / 0.16, 0, 1), 2);            // the bonnet's leading edge rolls over
    y -= 0.012 * Math.pow(clamp(((sT + 0.03) - s) / 0.03, 0, 1), 2);
    return y;
  }
  function crown(s) { return s > zc3 ? lerp(0.05, 0.03, sm(zc3, sN, s)) : s < zc0 ? 0.022 : 0.046; }
  function rail(s) { return top(s) - crown(s); }
  function belt(s) { return Math.min(lerp(1.025, 0.865, (s - sT) / D.L), rail(s) - 0.035); }
  function bottom(s) { return D.gc + 0.04 + 0.05 * Math.pow(clamp((s - (sN - 0.5)) / 0.5, 0, 1), 2) + 0.17 * Math.pow(clamp(((sT + 0.6) - s) / 0.6, 0, 1), 1.5); }
  /* ---------- the plan view ---------- */
  function plan(s) {
    var fwd = s > 0, rc = fwd ? 0.47 : 0.42, de = fwd ? sN - s : s - sT, half = fwd ? sN : -sT, n = fwd ? 2.8 : 2.5;
    var taper = (fwd ? 0.05 : 0.03) * Math.pow(clamp((Math.abs(s) - half * 0.45) / (half * 0.55), 0, 1), 2), w = WB - taper;
    if (de < rc) { var u = clamp((rc - de) / rc, 0, 1); w -= rc * (1 - Math.pow(Math.max(0, 1 - Math.pow(u, n)), 1 / n)); }
    return w;
  }
  function flare(s) { var a = (s - saF) / 0.43, b = (s - saR) / 0.45; return 0.035 * Math.exp(-a * a) + 0.036 * Math.exp(-b * b); }

  /* ---------- half a section at s, from the sill up and over to the centre line: [x, y, a] ----------
     a runs round the body: 1 at the sill, 0.6 at the shoulder, 0.455 at the top of the side glass, 0 on the centre line */
  var NL = 16, NG = 4, NR = 8, TUMBLE = 0.205;
  function section(s) {
    var hw = plan(s), yr = rail(s), yb = belt(s), cab = sm(0.1, 0.32, yr - yb), ins = TUMBLE * cab, gc = bottom(s), fl = flare(s), cr = crown(s), o = [], k, f;
    o.push([hw - 0.09, gc, 1]); o.push([hw - 0.02, gc + 0.06, 0.965]);
    for (k = 1; k <= NL; k++) { f = k / NL; o.push([hw - 0.034 + 0.034 * Math.pow(Math.sin(PI * Math.min(1, f * 0.93 + 0.07)), 0.7) + fl * sm(0, 0.3, f) * (1 - sm(0.7, 1, f)), lerp(gc + 0.06, yb, f), lerp(0.965, 0.6, f)]); }
    var x1 = hw - 0.03 - ins, y1 = Math.max(yb + 0.012, yr - 0.085 * cab - 0.012);
    for (k = 1; k <= NG; k++) { f = k / NG; o.push([lerp(hw - 0.03, x1, f) + 0.012 * Math.sin(PI * f) * cab, lerp(yb + 0.012, y1, f), lerp(0.6, 0.455, f)]); }
    o.push([x1 - 0.035, Math.max(y1, yr - 0.04 * cab - 0.006), 0.42]); var x2 = x1 - 0.11; o.push([x2, yr - 0.008, 0.38]);
    /* the bonnet's raised centre (the "power dome"): a plateau between two soft steps */
    var dome = 0.016 * sm(zc3 + 0.02, zc3 + 0.22, s) * (1 - sm(sN - 0.42, sN - 0.12, s));
    for (k = 1; k <= NR; k++) { f = k / NR; var x = x2 * (1 - f); o.push([x, yr + cr * (1 - (x / x2) * (x / x2)) - 0.008 * (1 - f) + dome * sm(0.47, 0.3, x), 0.38 * (1 - f)]); }
    return o;
  }
  var M = 2 + NL + NG + 2 + NR;                     // points in half a section
  var JB = 1 + NL, JG = JB + NG, JR = JG + 2;       // index of the shoulder, of the glass's top, of the roof rail's inner edge

  /* ---------- stations along the car ---------- */
  var Zs = [], i, j, k, z;
  for (z = sT; z < sN - 1e-6; z += 0.07) Zs.push(z);
  [zc0, zc1, zc2, zc3, zc0 + 0.07, zc1 - 0.05, zc1 + 0.04, zc2 - 0.04, zc2 + 0.05, zc3 - 0.06, sB - 0.05, sB + 0.05, zc3 - 0.3, zc0 + 0.42, zc0 + 0.36].forEach(function (v) { Zs.push(v); });
  [[sN, 0.47, 1], [sT, 0.42, -1]].forEach(function (e) { for (var q = 0; q <= 12; q++) Zs.push(e[0] - e[2] * e[1] * (1 - Math.cos(q / 12 * PI / 2))); });
  [[saF, D.rF], [saR, D.rR]].forEach(function (a) { for (var q = a[0] - a[1] - 0.14; q <= a[0] + a[1] + 0.14; q += 0.03) Zs.push(q); });
  Zs.sort(function (a, b) { return a - b; });
  var Z = []; Zs.forEach(function (v) { v = clamp(v, sT, sN); if (!Z.length || v - Z[Z.length - 1] > 0.0125) Z.push(v); });
  var NS = Z.length, half = Z.map(section);

  /* ---------- the skin's vertices: a ring per station, k = 0 the left sill ... M-1 the centre ... 2M-2 the right sill ---------- */
  var RING = 2 * M - 1, P = [], Nn = [], cutState = new Uint8Array(NS * RING);
  function hpos(ii, jj) { ii = clamp(ii, 0, NS - 1); jj = clamp(jj, 0, M - 1); var h = half[ii][jj]; return [h[0], h[1], Z[ii]]; }
  for (i = 0; i < NS; i++) for (k = 0; k < RING; k++) {
    j = k < M ? k : 2 * M - 2 - k; var sg = k < M ? -1 : 1, h = half[i][j], a = hpos(i - 1, j), b = hpos(i + 1, j), c = hpos(i, j - 1), d = hpos(i, j + 1);
    /* normal from the neighbours (in x, y, s), turned outward */
    var ux = b[0] - a[0], uy = b[1] - a[1], us = b[2] - a[2], vx = d[0] - c[0], vy = d[1] - c[1], vs = d[2] - c[2];
    var nx = uy * vs - us * vy, ny = us * vx - ux * vs, ns = ux * vy - uy * vx, l = Math.hypot(nx, ny, ns) || 1; nx /= l; ny /= l; ns /= l;
    if (nx * h[0] + ny * (h[1] - 0.7) < 0) { nx = -nx; ny = -ny; ns = -ns; } if (j === M - 1) nx = 0;
    var x = h[0], y = h[1], s = Z[i];
    /* the wheel arches: vertices near the arch's circle are moved onto it (a clean edge), those inside it are set back into the well */
    if (h[2] >= 0.6) for (var w = 0; w < 2; w++) { var sa = w ? saR : saF, rw = w ? D.rR : D.rF, Ra = rw + 0.05, ds = s - sa, dy = y - rw, dd = Math.hypot(ds, dy);
      if (dd < Ra - 0.026) { x = Math.min(x, W2 - (w ? D.twR : D.twF) - 0.1); cutState[i * RING + k] = 2; nx = 1; ny = 0; ns = 0; }
      else if (dd < Ra + 0.03 && y > bottom(s) + 0.02) { s = sa + ds / dd * Ra; y = rw + dy / dd * Ra; cutState[i * RING + k] = 1; } }
    P.push(sg * x, y, -s); Nn.push(sg * nx, ny, -ns);
  }
  function vi(ii, kk) { return ii * RING + kk; }

  /* ---------- parts: one mesh per material ---------- */
  var parts = {};
  function part(name) { return parts[name] || (parts[name] = { positions: [], normals: [], indices: [], map: new Map() }); }
  function skinVert(g, v) { var m = g.map.get(v); if (m === undefined) { m = g.positions.length / 3; g.map.set(v, m); g.positions.push(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]); g.normals.push(Nn[v * 3], Nn[v * 3 + 1], Nn[v * 3 + 2]); } return m; }
  function flatTri(g, a, b, c, n) {
    var ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2], cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx, l = Math.hypot(cx, cy, cz);
    if (l < 1e-10) return; if (n && cx * n[0] + cy * n[1] + cz * n[2] < 0) { var t = b; b = c; c = t; }
    if (!n) n = [cx / l, cy / l, cz / l];
    var i0 = g.positions.length / 3; g.positions.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]); g.normals.push(n[0], n[1], n[2], n[0], n[1], n[2], n[0], n[1], n[2]); g.indices.push(i0, i0 + 1, i0 + 2);
  }
  function flatQuad(g, a, b, c, d, n) { flatTri(g, a, b, c, n); flatTri(g, a, c, d, n); }
  function box(g, cx, cy, cz, hx, hy, hz) {
    var p = function (x, y, z) { return [cx + x * hx, cy + y * hy, cz + z * hz]; };
    flatQuad(g, p(-1, -1, 1), p(1, -1, 1), p(1, 1, 1), p(-1, 1, 1), [0, 0, 1]); flatQuad(g, p(-1, -1, -1), p(1, -1, -1), p(1, 1, -1), p(-1, 1, -1), [0, 0, -1]);
    flatQuad(g, p(1, -1, -1), p(1, -1, 1), p(1, 1, 1), p(1, 1, -1), [1, 0, 0]); flatQuad(g, p(-1, -1, -1), p(-1, -1, 1), p(-1, 1, 1), p(-1, 1, -1), [-1, 0, 0]);
    flatQuad(g, p(-1, 1, -1), p(1, 1, -1), p(1, 1, 1), p(-1, 1, 1), [0, 1, 0]); flatQuad(g, p(-1, -1, -1), p(1, -1, -1), p(1, -1, 1), p(-1, -1, 1), [0, -1, 0]);
  }
  /* a tube from a to b with smooth sides; caps: 0 none, 1 flat discs */
  function tube(g, a, b, r0, r1, seg, caps) {
    var dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz) || 1; dx /= L; dy /= L; dz /= L;
    var hx = Math.abs(dy) < 0.9 ? 0 : 1, hy = Math.abs(dy) < 0.9 ? 1 : 0, e1 = [hy * dz, -hx * dz, hx * dy - hy * dx], l1 = Math.hypot(e1[0], e1[1], e1[2]) || 1; e1 = [e1[0] / l1, e1[1] / l1, e1[2] / l1];
    var e2 = [dy * e1[2] - dz * e1[1], dz * e1[0] - dx * e1[2], dx * e1[1] - dy * e1[0]], i0 = g.positions.length / 3, q, t, n;
    for (q = 0; q <= seg; q++) { t = q / seg * TAU; n = [e1[0] * Math.cos(t) + e2[0] * Math.sin(t), e1[1] * Math.cos(t) + e2[1] * Math.sin(t), e1[2] * Math.cos(t) + e2[2] * Math.sin(t)];
      g.positions.push(a[0] + n[0] * r0, a[1] + n[1] * r0, a[2] + n[2] * r0, b[0] + n[0] * r1, b[1] + n[1] * r1, b[2] + n[2] * r1); g.normals.push(n[0], n[1], n[2], n[0], n[1], n[2]); }
    for (q = 0; q < seg; q++) { var o = i0 + q * 2; g.indices.push(o, o + 2, o + 1, o + 1, o + 2, o + 3); }
    /* wind the sides to face outward */
    fixWinding(g, g.indices.length - seg * 6);
    if (caps) for (q = 1; q + 1 < seg; q++) { var at = function (p, r, qq) { var tt = qq / seg * TAU; return [p[0] + (e1[0] * Math.cos(tt) + e2[0] * Math.sin(tt)) * r, p[1] + (e1[1] * Math.cos(tt) + e2[1] * Math.sin(tt)) * r, p[2] + (e1[2] * Math.cos(tt) + e2[2] * Math.sin(tt)) * r]; };
      flatTri(g, at(b, r1, 0), at(b, r1, q), at(b, r1, q + 1), [dx, dy, dz]); flatTri(g, at(a, r0, 0), at(a, r0, q + 1), at(a, r0, q), [-dx, -dy, -dz]); }
  }
  /* every triangle from index k0 on wound to face the way its normals point */
  function fixWinding(g, k0) {
    var Pp = g.positions, Np = g.normals, I = g.indices;
    for (var q = k0 || 0; q < I.length; q += 3) { var a = I[q] * 3, b = I[q + 1] * 3, c = I[q + 2] * 3, ux = Pp[b] - Pp[a], uy = Pp[b + 1] - Pp[a + 1], uz = Pp[b + 2] - Pp[a + 2], vx = Pp[c] - Pp[a], vy = Pp[c + 1] - Pp[a + 1], vz = Pp[c + 2] - Pp[a + 2];
      if ((uy * vz - uz * vy) * (Np[a] + Np[b] + Np[c]) + (uz * vx - ux * vz) * (Np[a + 1] + Np[b + 1] + Np[c + 1]) + (ux * vy - uy * vx) * (Np[a + 2] + Np[b + 2] + Np[c + 2]) < 0) { var t = I[q + 1]; I[q + 1] = I[q + 2]; I[q + 2] = t; } }
  }

  /* which material a quad of the skin is: i the station, j the row in the half section (0 sill .. M-2), by its middle */
  function groupOf(i0, j0, kk) {
    var a = vi(i0, kk), b = vi(i0 + 1, kk), c = vi(i0 + 1, kk + 1), d = vi(i0, kk + 1);
    var cs = cutState[a] + cutState[b] + cutState[c] + cutState[d], deep = (cutState[a] === 2) + (cutState[b] === 2) + (cutState[c] === 2) + (cutState[d] === 2);
    if (deep) return 'matte';                                                                   // the wheel wells
    var s = (Z[i0] + Z[i0 + 1]) / 2, h0 = half[i0][j0], h1 = half[i0][j0 + 1], y = (h0[1] + h1[1]) / 2, x = (h0[0] + h1[0]) / 2; void cs;
    if (j0 >= JR) {                                                                             // over the top, between the rails
      if (s > zc2 + 0.05 && s < zc3 - 0.06) return 'glass';                                     // windscreen
      if (s > zc0 + 0.07 && s < zc1 - 0.05) return 'glass';                                     // rear glass
      if (s > zc1 + 0.04 && s < zc2 - 0.04) return 'gloss';                                     // the carbon roof
      return 'paint'; }
    if (j0 >= JB && j0 < JG) {                                                                  // the band of the side glass
      if (s > zc0 + 0.42 && s < zc3 - 0.3) return Math.abs(s - sB) < 0.05 ? 'gloss' : 'glass';
      if (s > zc0 + 0.36 && s <= zc0 + 0.42) return 'gloss';
      return 'paint'; }
    if (j0 < JB) {
      /* head lamps: a slim band round each front corner, its upper edge the daytime running light */
      var xs = (half[i0][JB][0] + half[i0 + 1][JB][0]) / 2, row = j0 - 1;            // the row counted up from the sill: 0 .. NL-1
      if (s > sN - 0.56 && xs > 0.4 && row >= 11 && row <= 14) return row === 14 || (xs < 0.5 && row >= 12) ? 'drl' : 'head';
      /* the outer air intakes of the front bumper */
      if (s > sN - 0.36 && x > 0.36 && y > 0.2 && y < 0.45) return 'matte';
      /* tail lamps: a slim dark-red band round each rear corner; its inner end is the reversing lamp */
      if (s < sT + 0.52 && xs > 0.4 && row >= 12 && row <= 14) return (xs < 0.56 && row === 12) ? 'rev' : 'tail';
      /* the black lower rear bumper (the diffuser's surround) */
      if (s < sT + 0.34 && y < 0.5) return 'matte';
      /* the sills */
      if (j0 < 2 && s < saF - 0.45 && s > saR + 0.45) return 'gloss';
    }
    return 'paint';
  }
  for (i = 0; i + 1 < NS; i++) for (k = 0; k + 1 < RING; k++) {
    j = k < M - 1 ? k : 2 * M - 3 - k;                      // the row's lower index in the half section (mirrored on the right)
    var g = part(groupOf(i, j, k)), k0 = g.indices.length;
    var A = skinVert(g, vi(i, k)), B = skinVert(g, vi(i + 1, k)), C = skinVert(g, vi(i + 1, k + 1)), Dd = skinVert(g, vi(i, k + 1));
    g.indices.push(A, B, C, A, C, Dd); fixWinding(g, k0);
  }
  /* ---------- the nose and the tail: flat faces over the end rings ---------- */
  function endFace(i0, group, nz) {
    var g = part(group), yc = (half[i0][0][1] + half[i0][M - 1][1]) / 2, zz = -Z[i0];
    for (var kk = 0; kk + 1 < RING; kk++) { var a = vi(i0, kk), b = vi(i0, kk + 1); flatTri(g, [0, yc, zz], [P[a * 3], P[a * 3 + 1], zz], [P[b * 3], P[b * 3 + 1], zz], [0, 0, nz]); }
    var a0 = vi(i0, 0), a1 = vi(i0, RING - 1); flatTri(g, [0, yc, zz], [P[a0 * 3], P[a0 * 3 + 1], zz], [P[a1 * 3], P[a1 * 3 + 1], zz], [0, 0, nz]);
  }
  endFace(NS - 1, 'paint', -1); endFace(0, 'paint', 1);
  var zNose = -sN, zTail = -sT;

  /* ---------- the face: two tall grille openings side by side, bars across them ---------- */
  (function () {
    var poly = [[0.02, 0.325], [0.26, 0.345], [0.36, 0.6], [0.34, 0.74], [0.02, 0.757]];   // the right-hand opening, seen from the front (x, y)
    function widthAt(y) { var lo = 9, hi = -9; for (var q = 0; q < poly.length; q++) { var a = poly[q], b = poly[(q + 1) % poly.length]; if ((a[1] - y) * (b[1] - y) <= 0 && a[1] !== b[1]) { var xx = a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]); lo = Math.min(lo, xx); hi = Math.max(hi, xx); } } return [lo, hi]; }
    [-1, 1].forEach(function (sg) {
      var fill = part('matte'), rim = part('gloss'), q, zf = zNose - 0.006, zr = zNose - 0.016, c = [sg * 0.19, 0.55, zf];
      for (q = 0; q < poly.length; q++) { var a = poly[q], b = poly[(q + 1) % poly.length]; flatTri(fill, c, [sg * a[0], a[1], zf], [sg * b[0], b[1], zf], [0, 0, -1]);
        /* the opening's edge: a narrow raised frame */
        var ax = a[0] + (0.19 - a[0]) * 0.07, ay = a[1] + (0.55 - a[1]) * 0.05, bx = b[0] + (0.19 - b[0]) * 0.07, by = b[1] + (0.55 - b[1]) * 0.05;
        flatQuad(rim, [sg * a[0], a[1], zr], [sg * b[0], b[1], zr], [sg * bx, by, zr], [sg * ax, ay, zr], [0, 0, -1]);
        flatQuad(rim, [sg * a[0], a[1], zr], [sg * b[0], b[1], zr], [sg * b[0], b[1], zNose + 0.01], [sg * a[0], a[1], zNose + 0.01], [sg * (a[0] + b[0]) / 2 - sg * 0.19, (a[1] + b[1]) / 2 - 0.55, 0]); }
      for (var yy = 0.385; yy < 0.73; yy += 0.052) { var wd = widthAt(yy), x0 = wd[0] + 0.012, x1 = wd[1] - 0.012; if (x1 > x0) box(rim, sg * (x0 + x1) / 2, yy, zNose - 0.011, (x1 - x0) / 2, 0.0085, 0.004); }
    });
    /* the low centre intake under them, and the splitter */
    flatQuad(part('matte'), [-0.3, 0.2, zNose - 0.004], [0.3, 0.2, zNose - 0.004], [0.26, 0.31, zNose - 0.004], [-0.26, 0.31, zNose - 0.004], [0, 0, -1]);
    box(part('gloss'), 0, bottom(sN) + 0.004, zNose + 0.14, 0.4, 0.012, 0.18);
  })();
  /* ---------- the tail: diffuser, four pipes, the plate, the third brake lamp ---------- */
  (function () {
    var zf = zTail + 0.005;
    flatQuad(part('matte'), [-0.47, 0.292, zf], [0.47, 0.292, zf], [0.44, 0.47, zf], [-0.44, 0.47, zf], [0, 0, 1]);
    [-0.105, 0, 0.105].forEach(function (x) { box(part('gloss'), x, 0.33, zTail - 0.02, 0.006, 0.045, 0.04); });      // the diffuser's fins
    [-0.365, -0.24, 0.24, 0.365].forEach(function (x) {
      tube(part('pipe'), [x, 0.385, zTail - 0.14], [x, 0.385, zTail + 0.03], 0.05, 0.052, 16, 0);
      for (var q2 = 0; q2 < 16; q2++) { var u0 = q2 / 16 * TAU, u1 = (q2 + 1) / 16 * TAU, zl = zTail + 0.03; flatQuad(part('pipe'), [x + Math.cos(u0) * 0.052, 0.385 + Math.sin(u0) * 0.052, zl], [x + Math.cos(u1) * 0.052, 0.385 + Math.sin(u1) * 0.052, zl], [x + Math.cos(u1) * 0.043, 0.385 + Math.sin(u1) * 0.043, zl], [x + Math.cos(u0) * 0.043, 0.385 + Math.sin(u0) * 0.043, zl], [0, 0, 1]); }
      var g = part('matte'); for (var q = 1; q + 1 < 16; q++) { var t0 = q / 16 * TAU, t1 = (q + 1) / 16 * TAU; flatTri(g, [x + 0.043, 0.385, zTail + 0.012], [x + Math.cos(t0) * 0.043, 0.385 + Math.sin(t0) * 0.043, zTail + 0.012], [x + Math.cos(t1) * 0.043, 0.385 + Math.sin(t1) * 0.043, zTail + 0.012], [0, 0, 1]); } });
    flatQuad(part('plate'), [-0.155, 0.6, zf + 0.004], [0.155, 0.6, zf + 0.004], [0.155, 0.755, zf + 0.004], [-0.155, 0.755, zf + 0.004], [0, 0, 1]);
    flatQuad(part('matte'), [-0.17, 0.588, zf], [0.17, 0.588, zf], [0.17, 0.767, zf], [-0.17, 0.767, zf], [0, 0, 1]);
    /* the third brake lamp, across the head of the rear glass */
    var sC = zc1 - 0.11, yC = top(sC) + 0.004, yC2 = top(sC - 0.03) + 0.004;
    flatQuad(part('chmsl'), [-0.2, yC, -sC], [0.2, yC, -sC], [0.2, yC2, -(sC - 0.03)], [-0.2, yC2, -(sC - 0.03)], [0, 1, 0.3]);
    /* the boot lid's lip */
    box(part('gloss'), 0, top(sT + 0.035) - 0.004, zTail - 0.04, 0.5, 0.009, 0.03);
  })();
  /* ---------- the underside, the mirrors, the vents behind the front wheels ---------- */
  flatQuad(part('matte'), [-W2 + 0.12, D.gc + 0.03, zTail - 0.25], [W2 - 0.12, D.gc + 0.03, zTail - 0.25], [W2 - 0.12, D.gc + 0.03, zNose + 0.25], [-W2 + 0.12, D.gc + 0.03, zNose + 0.25], [0, -1, 0]);
  function skinX(s, y) { var o = section(s); for (var q = 0; q + 1 < o.length; q++) if (y >= o[q][1] && y <= o[q + 1][1]) return lerp(o[q][0], o[q + 1][0], (y - o[q][1]) / ((o[q + 1][1] - o[q][1]) || 1)); return o[JB][0]; }
  [-1, 1].forEach(function (sg) {
    var sM = zc3 - 0.33, mx = sg * (skinX(sM, belt(sM)) + 0.095), my = belt(sM) + 0.085, g = part('gloss');
    box(g, mx, my, -sM + 0.01, 0.085, 0.052, 0.04); box(g, mx - sg * 0.075, my - 0.045, -sM, 0.05, 0.012, 0.03);
    box(part('glass'), mx, my, -sM + 0.052, 0.07, 0.04, 0.002);
    /* the vent in the front wing */
    var v0 = saF - D.rF - 0.11, v1 = v0 - 0.2, ya = 0.6, yb2 = 0.69;
    flatQuad(part('gloss'), [sg * (skinX(v0, ya) + 0.004), ya, -v0], [sg * (skinX(v1, ya + 0.03) + 0.004), ya + 0.03, -v1], [sg * (skinX(v1, yb2) + 0.004), yb2, -v1], [sg * (skinX(v0, yb2 - 0.02) + 0.004), yb2 - 0.02, -v0], [sg, 0, 0]);
    /* the cuts round the doors: fine dark lines standing just off the skin */
    [zc3 - 0.12, sB, zc0 + 0.62].forEach(function (sd, n) { var o = section(sd), gcut = part('matte'); for (var q = 2; q < JB; q++) { var p0 = o[q], p1 = o[q + 1]; if (n === 2 && Math.hypot(sd - saR, (p0[1] + p1[1]) / 2 - D.rR) < D.rR + 0.07) continue;
      flatQuad(gcut, [sg * (p0[0] + 0.0035), p0[1], -(sd - 0.004)], [sg * (p0[0] + 0.0035), p0[1], -(sd + 0.004)], [sg * (p1[0] + 0.0035), p1[1], -(sd + 0.004)], [sg * (p1[0] + 0.0035), p1[1], -(sd - 0.004)], [sg, 0, 0]); } });
  });
  /* the cut round the bonnet (its rear edge, at the foot of the windscreen) */
  (function () { var sd = zc3 + 0.045, o = section(sd), g = part('matte'); [-1, 1].forEach(function (sg) { for (var q = JR; q + 1 < M; q++) { var p0 = o[q], p1 = o[q + 1]; flatQuad(g, [sg * p0[0], p0[1] + 0.0035, -(sd - 0.006)], [sg * p0[0], p0[1] + 0.0035, -(sd + 0.006)], [sg * p1[0], p1[1] + 0.0035, -(sd + 0.006)], [sg * p1[0], p1[1] + 0.0035, -(sd - 0.006)], [0, 1, 0]); } }); })();

  /* ---------- a wheel: axle along x, the outer face at +x, centre at the origin ---------- */
  function wheel(R, tw, rimR) {
    var tyre = { positions: [], normals: [], indices: [] }, rim = { positions: [], normals: [], indices: [] }, bright = { positions: [], normals: [], indices: [] }, SEG = 30, q, pI, h = tw / 2;
    var prof = [[rimR - 0.004, -h + 0.03, -0.3, -1], [rimR + 0.012, -h + 0.004, -0.1, -1], [R - 0.028, -h, 0.25, -1], [R - 0.006, -h + 0.022, 0.8, -0.6], [R, -h + 0.05, 1, -0.1], [R, h - 0.05, 1, 0.1], [R - 0.006, h - 0.022, 0.8, 0.6], [R - 0.028, h, 0.25, 1], [rimR + 0.012, h - 0.004, -0.1, 1], [rimR - 0.004, h - 0.03, -0.3, 1]];
    for (q = 0; q <= SEG; q++) { var th = q / SEG * TAU, cs = Math.cos(th), sn = Math.sin(th); prof.forEach(function (p) { var nl = Math.hypot(p[2], p[3]) || 1; tyre.positions.push(p[1], cs * p[0], sn * p[0]); tyre.normals.push(p[3] / nl, cs * p[2] / nl, sn * p[2] / nl); }); }
    for (q = 0; q < SEG; q++) for (pI = 0; pI + 1 < prof.length; pI++) { var a = q * prof.length + pI, b = a + prof.length; tyre.indices.push(a, b, b + 1, a, b + 1, a + 1); }
    fixWinding(tyre, 0);
    /* the rim: a barrel, a lip, a hub and ten spokes in five pairs */
    tube(rim, [-h + 0.03, 0, 0], [h - 0.03, 0, 0], rimR - 0.004, rimR - 0.004, SEG, 0);
    (function () { var I = rim.indices, N = rim.normals; for (var t = 0; t < N.length; t++) N[t] = -N[t]; for (var t2 = 0; t2 < I.length; t2 += 3) { var sw = I[t2 + 1]; I[t2 + 1] = I[t2 + 2]; I[t2 + 2] = sw; } })();   // seen from inside
    var xf = h - 0.02;
    for (q = 0; q < SEG; q++) { var t0 = q / SEG * TAU, t1 = (q + 1) / SEG * TAU, ro = rimR - 0.002, ri = rimR - 0.03;
      flatQuad(bright, [xf + 0.016, Math.cos(t0) * ro, Math.sin(t0) * ro], [xf + 0.016, Math.cos(t1) * ro, Math.sin(t1) * ro], [xf, Math.cos(t1) * ri, Math.sin(t1) * ri], [xf, Math.cos(t0) * ri, Math.sin(t0) * ri], [1, 0, 0]); }
    tube(bright, [xf - 0.05, 0, 0], [xf - 0.012, 0, 0], 0.085, 0.07, 14, 1);
    tube(rim, [xf - 0.012, 0, 0], [xf - 0.004, 0, 0], 0.036, 0.03, 10, 1);
    for (q = 0; q < 5; q++) [-1, 1].forEach(function (sd) {
      var a0 = q / 5 * TAU + sd * 0.085, a1 = q / 5 * TAU + sd * 0.2, r0 = 0.062, r1 = rimR - 0.026, wd = 0.0125, dep = 0.022;
      var p0 = [Math.cos(a0) * r0, Math.sin(a0) * r0], p1 = [Math.cos(a1) * r1, Math.sin(a1) * r1], dx = p1[0] - p0[0], dy = p1[1] - p0[1], dl = Math.hypot(dx, dy), px = -dy / dl * wd, py = dx / dl * wd, x1 = xf - 0.014, x0 = xf - 0.004;
      var c = function (p, sgn, x) { return [x, p[0] + px * sgn, p[1] + py * sgn]; };
      flatQuad(bright, c(p0, -1, x1), c(p0, 1, x1), c(p1, 1, x0), c(p1, -1, x0), [1, 0, 0]);
      flatQuad(rim, c(p0, 1, x1), c(p0, 1, x1 - dep), c(p1, 1, x0 - dep), c(p1, 1, x0), [0, px, py]);
      flatQuad(rim, c(p0, -1, x1), c(p0, -1, x1 - dep), c(p1, -1, x0 - dep), c(p1, -1, x0), [0, -px, -py]);
    });
    /* what does not turn: the disc and its calliper (the calliper sits to the rear of the axle, on the upper side) */
    var brake = { positions: [], normals: [], indices: [] }, cal = { positions: [], normals: [], indices: [] };
    tube(brake, [h - 0.115, 0, 0], [h - 0.085, 0, 0], rimR - 0.045, rimR - 0.045, 24, 1);
    for (q = -3; q <= 3; q++) { var ta = 0.55 + q * 0.11, rc2 = rimR - 0.07; box(cal, h - 0.085, Math.sin(ta) * rc2, Math.cos(ta) * rc2, 0.03, 0.036, 0.036); }
    return { tyre: tyre, rim: rim, bright: bright, brake: brake, calliper: cal };
  }

  /* ---------- the cabin, seen only from the driver's seat: dash, cowl, pillars, header, doors, wheel ---------- */
  var cabin = { dark: { positions: [], normals: [], indices: [] }, screen: { positions: [], normals: [], indices: [] }, wheel: { positions: [], normals: [], indices: [] } };
  (function () {
    var g = cabin.dark, eye = [-0.37, 1.165, 0.12];           // model x, y, z (z to the rear: the driver sits just behind the middle)
    D.eye = eye; D.bonnetCam = [0, 1.085, -(zc3 - 0.12)];
    var zd = -(zc3 - 0.38);                                    // the dash's leading edge under the glass
    box(g, 0, 0.955, zd + 0.2, 0.74, 0.035, 0.26);             // the dash top
    box(g, 0, 0.83, zd + 0.42, 0.74, 0.1, 0.05);               // its face
    box(g, eye[0], 1.01, zd + 0.3, 0.19, 0.03, 0.1);           // the binnacle's hood
    box(g, 0, 0.6, zd + 0.55, 0.13, 0.2, 0.4);                 // the tunnel
    [-1, 1].forEach(function (sg) {
      box(g, sg * 0.73, 0.96, 0.25, 0.04, 0.035, 1.05);        // door tops
      /* the screen pillars, from the cowl up to the header */
      var a = [sg * 0.72, 0.99, zd - 0.12], b = [sg * 0.6, 1.375, -(zc2 - 0.02)]; tube(g, a, b, 0.045, 0.04, 6, 0);
      box(g, sg * 0.66, 1.2, 0.33, 0.03, 0.2, 0.045);          // the centre pillars
    });
    box(g, 0, 1.385, -(zc2 - 0.1), 0.62, 0.02, 0.1);           // the header
    box(g, 0, 1.39, 0.6, 0.62, 0.012, 0.7);                    // the head lining
    box(g, 0, 1.325, -(zc2 - 0.02), 0.11, 0.035, 0.012);       // the mirror
    box(cabin.screen, eye[0] + 0.1, 1.035, zd + 0.39, 0.3, 0.05, 0.004);   // the curved display, as one lit panel
    /* the steering wheel: built round the origin, facing +z (toward the driver), to be placed and turned by the kit */
    var w = cabin.wheel, R = 0.185, q;
    for (q = 0; q < 20; q++) { var t0 = q / 20 * TAU, t1 = (q + 1) / 20 * TAU; tube(w, [Math.cos(t0) * R, Math.sin(t0) * R, 0], [Math.cos(t1) * R, Math.sin(t1) * R, 0], 0.017, 0.017, 6, 0); }
    box(w, 0, 0, -0.01, 0.06, 0.045, 0.02); box(w, -0.095, 0.005, -0.008, 0.075, 0.016, 0.01); box(w, 0.095, 0.005, -0.008, 0.075, 0.016, 0.01); box(w, 0, -0.09, -0.008, 0.016, 0.08, 0.01);
    D.steeringWheel = [eye[0], 0.985, zd + 0.5]; D.steeringRake = 20;
  })();

  function pack(g) { return { positions: new Float32Array(g.positions), normals: new Float32Array(g.normals), indices: g.positions.length / 3 > 65535 ? new Uint32Array(g.indices) : new Uint16Array(g.indices) }; }
  var out = { dims: D, parts: {}, cabin: {}, tris: 0 };
  Object.keys(parts).forEach(function (kx) { out.parts[kx] = pack(parts[kx]); out.tris += parts[kx].indices.length / 3; });
  Object.keys(cabin).forEach(function (kx) { out.cabin[kx] = pack(cabin[kx]); });
  var wf = wheel(D.rF, D.twF, D.rimF), wr = wheel(D.rR, D.twR, D.rimR); out.wheelF = {}; out.wheelR = {};
  Object.keys(wf).forEach(function (kx) { out.wheelF[kx] = pack(wf[kx]); out.wheelR[kx] = pack(wr[kx]); });
  out.skinX = skinX; out.top = top; out.belt = belt;
  return out;
}
if (typeof module !== 'undefined') module.exports = { M3Body };
