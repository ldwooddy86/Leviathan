  /* ==== sky job: the shapes. Airliners, a Seahawk, a Super Hornet, warships: each built once from a few dimensions ==== */
  /* Every mesh has its nose or bow at +z, its left (port) at +x, up +y, and stands on y = 0 (the ground, or the water).
     A vertex's alpha says how much of the instance's colour it takes (the engine's rule for instanced meshes): an
     airliner's fin, winglets and engines take the livery colour, the rest does not.
     Lengths, spans, beams and heights are the evidence file's (FAA database for aircraft; the pages quoted in section E
     for ships). What the sources do not give is assumed and listed in SkyShapes.ASSUMED. */
  const SkyShapes = (() => {
    const X = {}, RD = Math.PI / 180;
    X.ASSUMED = { airliners: 'fuselage width, wing plan, engine size and place, gear', carrier: 'flight deck 19.5 m above the water, island 21 m above the deck, mast 38 m; the outline of the deck is drawn by eye to the published 332.8 by 76.8 m with the landing area 9 degrees to port', ships: 'deck and mast heights, the shape of the upper works, haze grey paint (the sources opened give lengths and beams only)', seahawk: 'the body under the published length, height and rotor' };
    const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    /* a flat face of 3 or 4 points, turned to face away from the point `inside` */
    function face(B, P, col, inside) {
      const n = cross(sub(P[1], P[0]), sub(P[2], P[0])), l = Math.hypot(n[0], n[1], n[2]); if (l < 1e-9) { if (P.length === 4) face(B, [P[0], P[2], P[3]], col, inside); return; } n[0] /= l; n[1] /= l; n[2] /= l;
      const c = [0, 0, 0]; P.forEach(p => { c[0] += p[0] / P.length; c[1] += p[1] / P.length; c[2] += p[2] / P.length; }); if (inside && n[0] * (c[0] - inside[0]) + n[1] * (c[1] - inside[1]) + n[2] * (c[2] - inside[2]) < 0) { n[0] = -n[0]; n[1] = -n[1]; n[2] = -n[2]; }
      if (P.length === 4) B.quad(P[0], P[1], P[2], P[3], n, null, col); else B.tri(P[0], P[1], P[2], n, null, null, null, col);
    }
    /* a skin over elliptical sections [{ z, y, rx, ry, col }], each facet lit by its own outward direction; the ends are closed */
    function loft(B, S, seg, col) {
      const pt = (s, k) => { const a = k / seg * 2 * Math.PI; return [(s.x || 0) + Math.sin(a) * s.rx, s.y + Math.cos(a) * s.ry, s.z]; };
      for (let i = 0; i < S.length - 1; i++) { const a = S[i], b = S[i + 1], c = b.col || a.col || col; for (let k = 0; k < seg; k++) face(B, [pt(a, k), pt(a, k + 1), pt(b, k + 1), pt(b, k)], c, [((a.x || 0) + (b.x || 0)) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2]); }
      [[S[0], S[1]], [S[S.length - 1], S[S.length - 2]]].forEach(([e, n]) => { for (let k = 1; k < seg - 1; k++) face(B, [pt(e, 0), pt(e, k), pt(e, k + 1)], e.col || col, [n.x || 0, n.y, n.z]); });
    }
    /* a straight beam from a to b, w wide and h high */
    function beam(B, a, b, w, h, col) {
      const d = sub(b, a), l = Math.hypot(d[0], d[1], d[2]) || 1, f = [d[0] / l, d[1] / l, d[2] / l]; let r = cross(Math.abs(f[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0], f); const rl = Math.hypot(r[0], r[1], r[2]); r = [r[0] / rl, r[1] / rl, r[2] / rl]; const u = cross(f, r);
      const P = (p, i, j) => [p[0] + r[0] * i * w / 2 + u[0] * j * h / 2, p[1] + r[1] * i * w / 2 + u[1] * j * h / 2, p[2] + r[2] * i * w / 2 + u[2] * j * h / 2], m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
      [[1, 1, 1, -1], [-1, -1, -1, 1], [1, 1, -1, 1], [1, -1, -1, -1]].forEach(([i0, j0, i1, j1]) => face(B, [P(a, i0, j0), P(a, i1, j1), P(b, i1, j1), P(b, i0, j0)], col, m));
      face(B, [P(a, 1, 1), P(a, 1, -1), P(a, -1, -1), P(a, -1, 1)], col, m); face(B, [P(b, 1, 1), P(b, 1, -1), P(b, -1, -1), P(b, -1, 1)], col, m);
    }
    /* a thin swept surface (a wing, a tailplane, a fin): root and tip leading edge points, chords along -z, thickness; both faces and the edges */
    function slab(B, r, t, cr, ct, th, col, up) {
      const n = up || [0, 1, 0], o = (p, k, dz) => [p[0] + n[0] * k, p[1] + n[1] * k, p[2] - dz], a = th / 2, b = th * 0.3;
      const T = [o(r, a, 0), o(t, b, 0), o(t, b, ct), o(r, a, cr)], U = [o(r, -a, 0), o(t, -b, 0), o(t, -b, ct), o(r, -a, cr)], mid = [(r[0] + t[0]) / 2, (r[1] + t[1]) / 2, (r[2] + t[2]) / 2 - (cr + ct) / 4];
      face(B, T, col, mid); face(B, U, col, mid); for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; face(B, [T[i], T[j], U[j], U[i]], col, mid); }
    }
    X.face = face; X.loft = loft; X.beam = beam; X.slab = slab;
    const WHITE = [0.93, 0.94, 0.95, 0], WING = [0.74, 0.76, 0.79, 0], DARK = [0.07, 0.09, 0.12, 0], TYRE = [0.06, 0.06, 0.07, 0], TINT = [1, 1, 1, 1], TINT2 = [1, 1, 1, 0.85];

    /* an airliner from its length, span, tail height and fuselage width. Returns { body, gear, plan (the flat outline its shadow is drawn with), lamps } as mesh builders and points */
    X.airliner = (MeshBuilder, T) => {
      const B = new MeshBuilder(), G = new MeshBuilder(), P = new MeshBuilder(), L = T.L, d = T.d, r = d / 2, ry = T.key === 'A388' ? r * 1.18 : r, belly = 0.32 * d + 0.45, cy = belly + ry, hb = T.span / 2 * 0.978, wide = T.wake !== 'L', nose = L / 2, tail = -L / 2;
      loft(B, [{ z: nose, y: cy - 0.2 * ry, rx: 0.06 * r, ry: 0.06 * ry }, { z: nose - 0.3 * d, y: cy - 0.14 * ry, rx: 0.46 * r, ry: 0.44 * ry }, { z: nose - 0.8 * d, y: cy - 0.05 * ry, rx: 0.8 * r, ry: 0.8 * ry }, { z: nose - 1.6 * d, y: cy, rx: r, ry },
        { z: tail + 0.3 * L, y: cy, rx: r, ry }, { z: tail + 0.14 * L, y: cy + 0.22 * ry, rx: 0.66 * r, ry: 0.7 * ry, col: [0.93, 0.94, 0.95, 0.35] }, { z: tail, y: cy + 0.6 * ry, rx: 0.12 * r, ry: 0.16 * ry, col: [0.93, 0.94, 0.95, 0.6] }], 12, WHITE);
      /* the windows: a dark line down each side, two on the A380; the flight deck's glass */
      const wy = [cy + 0.2 * ry].concat(T.key === 'A388' ? [cy + 0.62 * ry] : []); wy.forEach(y => [-1, 1].forEach(s => { const k = Math.sqrt(Math.max(0.05, 1 - Math.pow((y - cy) / ry, 2))), x = s * (r * k + 0.03); face(B, [[x, y - 0.17, nose - 1.9 * d], [x, y + 0.17, nose - 1.9 * d], [x, y + 0.17, tail + 0.27 * L], [x, y - 0.17, tail + 0.27 * L]], DARK, [0, y, 0]); }));
      B.box(0, cy + 0.36 * ry, nose - 0.86 * d, 0.6 * r, 0.11 * r, 0.16 * d, 0, DARK);
      /* wings */
      const cr = 0.125 * L + 0.07 * T.span, ct = 0.26 * cr, sw = (wide ? 32 : 26) * RD, wyy = cy - 0.55 * ry, zr = 0.03 * L + 0.42 * cr, zt = zr - Math.tan(sw) * (hb - r * 0.8), yt = wyy + (hb - r) * Math.tan(5.5 * RD), lamps = { tipL: [hb, yt, zt - ct * 0.6], tipR: [-hb, yt, zt - ct * 0.6], tail: [0, cy + 0.6 * ry, tail - 0.2], top: [0, cy + ry + 0.15, 0.1 * L], bot: [0, belly - 0.15, 0], land: [[r * 1.3, wyy, zr - 0.5], [-r * 1.3, wyy, zr - 0.5], [0, belly - 0.2, nose - 0.14 * L]], fin: [0, T.tail, tail + 0.04 * L] };
      [-1, 1].forEach(s => { slab(B, [s * r * 0.8, wyy, zr], [s * hb, yt, zt], cr, ct, 0.11 * cr, WING);
        const wl = 0.045 * T.span; slab(B, [s * hb, yt, zt], [s * (hb + 0.25 * wl), yt + wl, zt - 0.5 * ct], ct, 0.5 * ct, 0.2, TINT, [s, 0, 0]);
        /* engines under the wing */
        const de = (wide ? 0.58 : 0.54) * d * (T.eng === 4 ? 0.72 : 1), le = 1.75 * de; (T.eng === 4 ? [0.3, 0.6] : [0.31]).forEach(fr => { const x = s * (r + fr * (hb - r)), u = (Math.abs(x) - r * 0.8) / (hb - r * 0.8), zl = zr + (zt - zr) * u, y = wyy + (Math.abs(x) - r) * Math.tan(5.5 * RD) - 0.56 * de, z0 = zl + 0.45 * le;
          loft(B, [{ x, z: z0, y, rx: 0.44 * de, ry: 0.44 * de }, { x, z: z0 - 0.12 * le, y, rx: 0.5 * de, ry: 0.5 * de }, { x, z: z0 - 0.6 * le, y, rx: 0.48 * de, ry: 0.48 * de }, { x, z: z0 - le, y, rx: 0.26 * de, ry: 0.26 * de, col: WING }], 8, TINT2);
          face(B, [[x - 0.36 * de, y - 0.36 * de, z0 + 0.03], [x + 0.36 * de, y - 0.36 * de, z0 + 0.03], [x + 0.36 * de, y + 0.36 * de, z0 + 0.03], [x - 0.36 * de, y + 0.36 * de, z0 + 0.03]], DARK, [x, y, z0 - 1]);
          beam(B, [x, y + 0.4 * de, z0 - 0.5 * le], [x, y + 0.62 * de, z0 - 0.75 * le], 0.3, 0.5, WING); });
        /* the tailplane */
        const hs = 0.19 * T.span, hc = 0.6 * cr; slab(B, [s * 0.4 * r, cy + 0.32 * ry, tail + 0.15 * L], [s * hs, cy + 0.32 * ry + hs * 0.1, tail + 0.15 * L - Math.tan(32 * RD) * hs], hc, 0.35 * hc, 0.09 * hc, WING); });
      /* the fin */
      const fb = cy + 0.7 * ry, fh = T.tail - fb, fc = 0.17 * L * (wide ? 0.82 : 1); slab(B, [0, fb, tail + 0.26 * L], [0, T.tail, tail + 0.26 * L - Math.tan(40 * RD) * fh], fc, 0.36 * fc, 0.45, TINT, [1, 0, 0]);
      /* the gear: a nose leg and two (or four) main legs */
      const leg = (x, z, n, tr) => { beam(G, [x, belly + 0.3, z], [x, 0.5 * tr, z], 0.28, 0.28, WING); for (let i = 0; i < n; i++) { const zz = z + (i - (n - 1) / 2) * tr * 1.25; [-1, 1].forEach(s => G.box(x + s * 0.42 * tr, 0.5 * tr, zz, 0.16 * tr, 0.5 * tr, 0.5 * tr, 0, TYRE)); } };
      leg(0, nose - 0.13 * L, 1, 0.8); const mt = wide ? 0.085 * T.span : 0.08 * T.span; leg(mt, -0.02 * L, wide ? 2 : 1, wide ? 1.3 : 1.15); leg(-mt, -0.02 * L, wide ? 2 : 1, wide ? 1.3 : 1.15); if (T.key === 'A388') { leg(0.45 * mt, -0.07 * L, 3, 1.3); leg(-0.45 * mt, -0.07 * L, 3, 1.3); }
      /* the outline that makes the shadow: flat, no part over another */
      const K = [0, 0, 0, 1], pl = (pts) => { for (let i = 1; i < pts.length - 1; i++) P.tri(pts[0], pts[i], pts[i + 1], [0, 1, 0], null, null, null, K); }, f3 = (x, z) => [x, 0, z];
      pl([f3(0, nose), f3(r * 0.8, nose - 0.9 * d), f3(r, nose - 1.6 * d), f3(r, tail + 0.3 * L), f3(0.4 * r, tail + 0.05 * L), f3(0, tail), f3(-0.4 * r, tail + 0.05 * L), f3(-r, tail + 0.3 * L), f3(-r, nose - 1.6 * d), f3(-r * 0.8, nose - 0.9 * d)]);
      [-1, 1].forEach(s => { pl([f3(s * r, zr), f3(s * hb, zt), f3(s * hb, zt - ct), f3(s * r, zr - cr)]); const hs = 0.19 * T.span, hc = 0.6 * cr, z0 = tail + 0.15 * L; pl([f3(s * 0.45 * r, z0), f3(s * hs, z0 - Math.tan(32 * RD) * hs), f3(s * hs, z0 - Math.tan(32 * RD) * hs - 0.35 * hc), f3(s * 0.45 * r, z0 - hc)]); });
      return { body: B, gear: G, plan: P, lamps, cy, belly, r };
    };

    /* MH-60 Seahawk: 64 ft 8 in (19.71 m) over the turning rotors, 17 ft 2 in high, main rotor 53 ft 8 in (16.36 m) */
    X.seahawk = (MeshBuilder) => {
      const B = new MeshBuilder(), R = new MeshBuilder(), C = [0.46, 0.49, 0.53, 0], D2 = [0.3, 0.32, 0.35, 0];
      loft(B, [{ z: 5.2, y: 1.5, rx: 0.25, ry: 0.3 }, { z: 4.3, y: 1.7, rx: 0.9, ry: 0.85 }, { z: 2.8, y: 1.95, rx: 1.15, ry: 1.2 }, { z: -2.2, y: 1.95, rx: 1.15, ry: 1.2 }, { z: -4, y: 2.3, rx: 0.6, ry: 0.75 }, { z: -9.6, y: 2.75, rx: 0.22, ry: 0.3 }], 8, C);
      B.box(0, 3.3, 0.2, 0.75, 0.42, 2.3, 0, C); beam(B, [0, 3.6, 0], [0, 4.25, 0], 0.4, 0.4, D2);                                        /* the engines' fairing and the rotor mast */
      slab(B, [0, 2.9, -9.2], [0.35, 5.15, -10.6], 1.3, 0.8, 0.22, C, [1, 0, 0]); slab(B, [-1.9, 2.95, -9.4], [1.9, 2.95, -9.4], 0.9, 0.9, 0.1, C);   /* the canted fin and the tailplane */
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.4; beam(B, [0.42, 4.2, -10.2], [0.42, 4.2 + Math.cos(a) * 1.65, -10.2 + Math.sin(a) * 1.65], 0.05, 0.22, D2); }  /* the tail rotor, still */
      B.box(0, 2.3, 4.0, 0.95, 0.3, 0.5, 0, DARK); [-1, 1].forEach(s => { beam(B, [s * 1.2, 1.2, 1.6], [s * 1.35, 0.35, 1.6], 0.14, 0.14, D2); B.box(s * 1.4, 0.33, 1.6, 0.12, 0.33, 0.33, 0, TYRE); }); B.box(0, 0.22, -7.6, 0.1, 0.22, 0.22, 0, TYRE); beam(B, [0, 2.3, -7.6], [0, 0.3, -7.6], 0.12, 0.12, D2);
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; beam(R, [Math.sin(a) * 0.3, 0, Math.cos(a) * 0.3], [Math.sin(a) * 8.18, 0.1, Math.cos(a) * 8.18], 0.53, 0.06, [0.16, 0.17, 0.18, 0]); } R.box(0, 0, 0, 0.35, 0.14, 0.35, 0, D2);
      return { body: B, rotor: R, hub: 4.3 };
    };
    /* F/A-18E: 60.1 ft long, 44.7 ft span, 16 ft high (FAA database), parked */
    X.hornet = (MeshBuilder) => {
      const B = new MeshBuilder(), C = [0.6, 0.63, 0.66, 0];
      loft(B, [{ z: 9.15, y: 1.9, rx: 0.08, ry: 0.08 }, { z: 6.2, y: 2.0, rx: 0.55, ry: 0.6 }, { z: 3.5, y: 2.1, rx: 0.85, ry: 0.8 }, { z: -2, y: 2.0, rx: 1.5, ry: 0.75 }, { z: -8.4, y: 2.0, rx: 1.35, ry: 0.6 }, { z: -9.15, y: 2.0, rx: 1.0, ry: 0.45 }], 8, C);
      B.box(0, 2.75, 4.6, 0.42, 0.3, 1.5, 0, DARK);
      [-1, 1].forEach(s => { slab(B, [s * 1.3, 2.1, 1.0], [s * 6.8, 2.1, -1.6], 5.2, 1.7, 0.22, C); slab(B, [s * 1.2, 2.0, -5.8], [s * 3.6, 1.9, -7.4], 2.8, 1.1, 0.14, C); slab(B, [s * 1.0, 2.6, -3.8], [s * 2.0, 4.88, -5.6], 3.0, 1.1, 0.14, C, [1, 0, -0]); beam(B, [s * 1.6, 1.6, -1.2], [s * 1.6, 0.4, -1.2], 0.16, 0.16, C); B.box(s * 1.6, 0.38, -1.2, 0.14, 0.38, 0.38, 0, TYRE); });
      beam(B, [0, 1.5, 5.6], [0, 0.3, 5.6], 0.14, 0.14, C); B.box(0, 0.28, 5.6, 0.2, 0.28, 0.28, 0, TYRE);
      return B;
    };

    /* a hull: stations from the stern forward [{ z, b (half beam at the deck), w (half beam at the water), h (deck height) }], sides, deck and transom */
    function hull(B, S, side, deck) {
      for (let i = 0; i < S.length - 1; i++) { const a = S[i], b = S[i + 1], m = [0, 1, (a.z + b.z) / 2]; [-1, 1].forEach(s => { face(B, [[s * a.b, a.h, a.z], [s * b.b, b.h, b.z], [s * b.w, -0.6, b.z], [s * a.w, -0.6, a.z]], side, m); }); face(B, [[-a.b, a.h, a.z], [a.b, a.h, a.z], [b.b, b.h, b.z], [-b.b, b.h, b.z]], deck, [0, -9, m[2]]); }
      const a = S[0]; face(B, [[-a.b, a.h, a.z], [a.b, a.h, a.z], [a.w, -0.6, a.z], [-a.w, -0.6, a.z]], side, [0, 1, a.z + 5]);
    }
    const GREY = [0.55, 0.58, 0.61, 0], GREY2 = [0.5, 0.53, 0.56, 0], DECK = [0.3, 0.32, 0.34, 0], FDECK = [0.2, 0.21, 0.22, 0], LINE = [0.88, 0.88, 0.84, 0], YEL = [0.85, 0.72, 0.15, 0];
    const stripe = (B, a, b, w, y, col) => { const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, nx = -dz / l * w / 2, nz = dx / l * w / 2; B.quad([a[0] + nx, y, a[1] + nz], [b[0] + nx, y, b[1] + nz], [b[0] - nx, y, b[1] - nz], [a[0] - nx, y, a[1] - nz], [0, 1, 0], null, col); };
    X.stripe = stripe;
    /* Nimitz class: 1,092 ft (332.8 m) overall, 1,040 ft (317 m) at the water; 252 ft (76.8 m) across the flight deck, 134 ft (40.8 m) at the water; landing area 9 degrees to port */
    X.CARRIER = { L: 332.8, B: 76.8, Lwl: 317, Bwl: 40.8, deck: 19.5, angle: 9,
      outline: [[-14, 166.4], [-17, 150], [-17, 110], [-30, 88], [-38, 60], [-38, -95], [-30, -118], [-24, -150], [-22, -166.4], [18, -166.4], [24, -158], [38.8, -120], [38.8, -20], [36, 5], [22, 62], [17, 110], [17, 150], [14, 166.4]] };
    X.carrier = (MeshBuilder) => {
      const B = new MeshBuilder(), K = X.CARRIER, y1 = K.deck, y0 = y1 - 3.2, O = K.outline, hw = K.Bwl / 2;
      hull(B, [{ z: -158.5, b: hw, w: hw - 2, h: y0 }, { z: -120, b: hw + 1, w: hw, h: y0 }, { z: 95, b: hw + 1, w: hw, h: y0 }, { z: 125, b: hw - 2, w: hw - 6, h: y0 }, { z: 146, b: hw - 8, w: hw - 14, h: y0 }, { z: 158.5, b: 5, w: 0.6, h: y0 }], GREY, GREY2);
      for (let i = 0; i < O.length; i++) { const a = O[i], b = O[(i + 1) % O.length]; B.tri([0, y1, 0], [a[0], y1, a[1]], [b[0], y1, b[1]], [0, 1, 0], null, null, null, FDECK); B.tri([0, y0, 0], [a[0], y0, a[1]], [b[0], y0, b[1]], [0, -1, 0], null, null, null, GREY2); face(B, [[a[0], y1, a[1]], [b[0], y1, b[1]], [b[0], y0, b[1]], [a[0], y0, a[1]]], GREY, [0, y0, 0]); }
      /* the landing area: its centre line and edges, 9 degrees to port of the keel; the bow catapult tracks; the four lifts */
      const s9 = Math.sin(K.angle * RD), c9 = Math.cos(K.angle * RD), ax = (d, o) => [-8 + s9 * d + c9 * o, -166 + c9 * d - s9 * o], yy = y1 + 0.06;
      for (let d = 2; d < 206; d += 12) stripe(B, ax(d, 0), ax(d + 6, 0), 0.9, yy, d % 24 < 12 ? YEL : LINE); stripe(B, ax(2, -13), ax(206, -13), 0.5, yy, LINE); stripe(B, ax(2, 13), ax(200, 13), 0.5, yy, LINE);
      stripe(B, [-8, 66], [-6, 160], 0.7, yy, [0.12, 0.12, 0.13, 0]); stripe(B, [8, 66], [6, 160], 0.7, yy, [0.12, 0.12, 0.13, 0]); stripe(B, [0, 60], [0, 165], 0.4, yy, LINE);
      [[-38, -22, 68, 84], [-38, -22, 28, 44], [-38, -22, -88, -72], [22.5, 38.6, -112, -96]].forEach(e => B.quad([e[0], yy - 0.02, e[2]], [e[1], yy - 0.02, e[2]], [e[1], yy - 0.02, e[3]], [e[0], yy - 0.02, e[3]], [0, 1, 0], null, [0.27, 0.28, 0.29, 0]));
      /* the island on the starboard side, aft of amidships, and its masts */
      const ix = -31.5, iz = -40; B.box(ix, y1 + 4, iz, 5, 4, 17, 0, GREY); B.box(ix, y1 + 12.5, iz + 2, 5.6, 4.5, 12, 0, GREY); B.box(ix, y1 + 12.2, iz + 2, 5.7, 0.9, 12.1, 0, DARK); B.box(ix, y1 + 19, iz + 3, 3.6, 2, 6.5, 0, GREY);
      beam(B, [ix, y1 + 21, iz + 2], [ix, y1 + 38, iz], 1.1, 1.1, GREY2); beam(B, [ix - 5, y1 + 31, iz + 0.5], [ix + 5, y1 + 31, iz + 0.5], 0.5, 0.5, GREY2); B.box(ix, y1 + 23.5, iz + 6, 3.2, 1.6, 0.5, 0, GREY2);
      beam(B, [ix + 0.5, y1, iz - 24], [ix + 0.5, y1 + 30, iz - 24], 1.4, 1.4, GREY2); B.box(ix + 0.5, y1 + 31.5, iz - 24, 3.5, 1.5, 0.5, 0, GREY2);
      return B;
    };
    /* Arleigh Burke class destroyer: 509.5 ft (155.3 m) by 66 ft (20 m) */
    X.destroyer = (MeshBuilder) => {
      const B = new MeshBuilder();
      hull(B, [{ z: -77.6, b: 7.2, w: 6.6, h: 5.5 }, { z: -58, b: 9.6, w: 9, h: 5.5 }, { z: -15, b: 10, w: 9.8, h: 6 }, { z: 20, b: 9.8, w: 9, h: 7.2 }, { z: 48, b: 7.6, w: 5.6, h: 8.2 }, { z: 66, b: 4.2, w: 2.2, h: 9 }, { z: 77.6, b: 0.4, w: 0.1, h: 9.8 }], GREY, DECK);
      B.box(0, 10, 22, 9, 3.6, 17, 0, GREY); B.box(0, 15.6, 24, 7.6, 2.4, 11, 0, GREY); B.box(0, 16.3, 31, 7.7, 0.7, 4.2, 0, DARK);                 /* the forward deckhouse and the bridge windows */
      beam(B, [0, 18, 20], [0, 39, 15], 1.3, 1.3, GREY2); beam(B, [-6, 31, 16.6], [6, 31, 16.6], 0.4, 0.4, GREY2); beam(B, [0, 18, 26], [0, 30, 17.5], 0.6, 0.6, GREY2);   /* the raked mast and its yard */
      B.box(0, 12.5, -2, 4.6, 6.5, 5.5, 0, GREY); B.box(0, 19.6, -2, 3.2, 0.8, 4, 0, DARK); B.box(0, 11.5, -26, 4.8, 5.6, 5.5, 0, GREY); B.box(0, 17.6, -26, 3.2, 0.7, 4, 0, DARK);   /* two funnels */
      B.box(0, 9, -43, 9, 3.2, 9, 0, GREY); stripe(B, [0, -76], [0, -53], 0.4, 5.56, LINE); stripe(B, [-6, -54], [6, -54], 0.4, 5.56, LINE);                 /* the hangars and the flight deck's lines */
      B.box(0, 9.6, 54, 1.6, 1.3, 2.2, 0, GREY2); beam(B, [0, 10.2, 55.5], [0, 11.6, 61.5], 0.3, 0.3, GREY2); B.quad([-4, 8.05, 40], [4, 8.05, 40], [4, 8.05, 47], [-4, 8.05, 47], [0, 1, 0], null, FDECK);
      return B;
    };
    /* Independence class littoral combat ship: 418 ft (127 m) by 104 ft (32 m), three hulls */
    X.lcs = (MeshBuilder) => {
      const B = new MeshBuilder();
      hull(B, [{ z: -63.5, b: 5.5, w: 5, h: 5 }, { z: 10, b: 6, w: 5.5, h: 5.5 }, { z: 40, b: 3.6, w: 2.6, h: 7 }, { z: 63.5, b: 0.3, w: 0.1, h: 8 }], GREY, DECK);
      [-1, 1].forEach(s => B.box(s * 14.4, 2, -34, 1.3, 2.6, 27, 0, GREY));                                                                  /* the side hulls */
      const y0 = 4.2, y1 = 9.5, W = 15.9; [[-63.5, 6, W, W]].forEach(() => { B.box(0, (y0 + y1) / 2, -29, W, (y1 - y0) / 2, 34.5, 0, GREY); });
      face(B, [[-W, y1, 5.5], [W, y1, 5.5], [3.6, 7.2, 42], [-3.6, 7.2, 42]], GREY, [0, 0, 20]); [-1, 1].forEach(s => face(B, [[s * W, y1, 5.5], [s * W, y0, 5.5], [s * 3.6, 6.5, 42], [s * 3.6, 7.2, 42]], GREY, [0, 6, 20])); face(B, [[-W, y0, 5.5], [W, y0, 5.5], [3.6, 6.5, 42], [-3.6, 6.5, 42]], GREY2, [0, 20, 20]);
      B.box(0, y1 + 2.4, -4, 11, 2.4, 15, 0, GREY); B.box(0, y1 + 6.2, 4, 8, 1.5, 5.5, 0, GREY); B.box(0, y1 + 6.4, 9, 8.1, 0.6, 0.6, 0, DARK); beam(B, [0, y1 + 7.6, 2], [0, y1 + 19, 0], 0.9, 0.9, GREY2);
      B.quad([-W + 1, y1 + 0.05, -62.5], [W - 1, y1 + 0.05, -62.5], [W - 1, y1 + 0.05, -20], [-W + 1, y1 + 0.05, -20], [0, 1, 0], null, FDECK); stripe(B, [0, -61], [0, -22], 0.4, y1 + 0.1, LINE); B.box(0, 8.4, 30, 1.2, 1, 1.6, 0, GREY2);
      return B;
    };
    /* America and Wasp class amphibious assault ships: 844 ft (257 m) by 106 ft (32 m), a flat deck from end to end, island to starboard */
    X.assault = (MeshBuilder) => {
      const B = new MeshBuilder(), h = 19.8;
      hull(B, [{ z: -128.5, b: 16, w: 14.5, h }, { z: 80, b: 16, w: 15, h }, { z: 108, b: 14, w: 9, h }, { z: 122, b: 10.5, w: 3.5, h }, { z: 128.5, b: 7, w: 0.4, h }], GREY, FDECK);
      stripe(B, [2, -124], [2, 122], 0.6, h + 0.06, LINE); stripe(B, [-7, -124], [-7, 122], 0.35, h + 0.06, YEL); for (let z = -110; z <= 100; z += 30) stripe(B, [-3, z], [7, z], 0.4, h + 0.06, LINE);
      const ix = -11.6; B.box(ix, h + 5, 6, 4, 5, 30, 0, GREY); B.box(ix, h + 12, 12, 4.2, 2.2, 14, 0, GREY); B.box(ix, h + 12.4, 12, 4.3, 0.6, 14.1, 0, DARK); B.box(ix, h + 13, -12, 2.6, 3.6, 3.4, 0, GREY); B.box(ix, h + 13, 28, 2.6, 3.6, 3.4, 0, GREY);
      beam(B, [ix, h + 14, 14], [ix, h + 34, 13], 1, 1, GREY2); beam(B, [ix, h + 10, -22], [ix, h + 30, -22], 0.9, 0.9, GREY2); beam(B, [ix - 4, h + 27, 13.4], [ix + 4, h + 27, 13.4], 0.4, 0.4, GREY2);
      return B;
    };
    /* small craft: a grey patrol boat of 26 m, a white harbour ferry of 30 m, a sailing yacht of 12 m (all generated) */
    X.boat = (MeshBuilder, kind) => {
      const B = new MeshBuilder();
      if (kind === 'patrol') { hull(B, [{ z: -13, b: 3, w: 2.8, h: 2 }, { z: 4, b: 3.2, w: 2.8, h: 2.3 }, { z: 13, b: 0.2, w: 0.1, h: 3 }], GREY, DECK); B.box(0, 3.4, -1, 2.3, 1.2, 4, 0, GREY); B.box(0, 3.9, 1.5, 2.35, 0.35, 1.6, 0, DARK); beam(B, [0, 4.6, -2], [0, 8, -2.6], 0.2, 0.2, GREY2); }
      else if (kind === 'ferry') { const W = [0.92, 0.93, 0.94, 0]; hull(B, [{ z: -15, b: 4.4, w: 4, h: 1.8 }, { z: 8, b: 4.5, w: 4, h: 1.8 }, { z: 15, b: 0.6, w: 0.2, h: 2.2 }], W, [0.5, 0.52, 0.55, 0]); B.box(0, 3.1, -1.5, 3.9, 1.3, 10, 0, W); B.box(0, 3.2, -1.5, 3.95, 0.45, 9.5, 0, DARK); B.box(0, 5.5, 2, 3, 1.1, 4, 0, W); B.box(0, 5.7, 4, 3.05, 0.4, 2, 0, DARK); B.box(0, 4.7, -6, 3.6, 0.1, 5, 0, [0.15, 0.3, 0.6, 0]); }
      else { const W = [0.94, 0.94, 0.92, 0]; hull(B, [{ z: -6, b: 1.5, w: 1.2, h: 1 }, { z: 0, b: 1.9, w: 1.5, h: 1.1 }, { z: 6, b: 0.1, w: 0.05, h: 1.3 }], W, [0.75, 0.7, 0.6, 0]); beam(B, [0, 1, 0.8], [0, 16, 0.8], 0.14, 0.14, [0.7, 0.7, 0.7, 0]); face(B, [[0.02, 2.2, 0.6], [0.02, 15.5, 0.6], [0.02, 2.2, -5.2]], W, [-5, 5, 0]); face(B, [[-0.02, 2.2, 0.6], [-0.02, 15.5, 0.6], [-0.02, 2.2, -5.2]], W, [5, 5, 0]); face(B, [[0.02, 1.8, 1], [0.02, 13, 1], [0.02, 1.6, 5.6]], W, [-5, 5, 0]); face(B, [[-0.02, 1.8, 1], [-0.02, 13, 1], [-0.02, 1.6, 5.6]], W, [5, 5, 0]); }
      return B;
    };
    X.GREY = GREY;
    return X;
  })();
  SE.SkyShapes = SkyShapes;
