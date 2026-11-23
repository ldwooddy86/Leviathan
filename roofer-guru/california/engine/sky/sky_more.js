  /* ==== sky job, second part: the Bay Bridge, the Vincent Thomas Bridge, vessels under way in San Diego Bay, lights at night ==== */
  /* Called by SkyKit when it is made. Uses the kit's own tools (X.tools). What is real and what is generated is said at each. */
  function SkyKitMore(X, engine, S, DATA, MAT) {
    const T = X.tools, SH = X.shapes, MD = X.model, BR = DATA.bridges || {}, RDG = Math.PI / 180, hsh = MD.hash, { deck, site, samples, roadway, susp, pier, solid, pointAt, deckY, yOf, gy, toL, tbl, CONC } = T;
    const LIT = [];   /* lamps that stand still: [x, y, z, colour, strength, by day too]; drawn each frame near the camera, sized by distance */
    const lit = (s, x, y, z, col, I, day) => { (s.lamps = s.lamps || []).push([x, y, z, col, I, day ? 1 : 0]); };
    const RED = [1, 0.06, 0.04], GRN = [0.08, 1, 0.3], WHT = [1, 0.95, 0.85], BLU = [0.12, 0.35, 1], AMB = [1, 0.6, 0.15];

    /* ---- Vincent Thomas Bridge: suspension, main span 1,500 ft (457 m), towers 365 ft (111 m), about 185 ft (56 m) clear, 52 ft (16 m) wide, 160 blue lamps on its cables.
            Assumed: side spans of 154 m, the deck heights at its ends, the green paint (not stated in the text opened). ---- */
    if (BR.vt) { const v = BR.vt, GREEN = [0.25, 0.47, 0.38, 0], D1 = deck({ name: 'Vincent Thomas Bridge', pts: v.line, half: 8.4, marks: { W: v.towers[0], E: v.towers[1] }, rampA: 90, rampB: 90,
      prof: (s, L, K) => { if (K.t === undefined) K.t = tbl([[0, 9], [Math.max(60, K.W - 154), 50], [K.W, 57.5], [(K.W + K.E) / 2, 61.5], [K.E, 57.5], [Math.min(L - 60, K.E + 154), 50], [L, 7]]); return K.t(s); } });
      site('Vincent Thomas Bridge', 33.7495, -118.2715, 30000, s => { const sm = samples(D1, 12.2), B = new MeshBuilder(), K = D1.loc.K, L = D1.loc.L; roadway(B, sm, D1.half, { hb: 8.4, t: 4.6, slab: 0.9, box: GREEN, rail: GREEN, under: GREEN });
        susp(B, D1, sm, { towers: ['W', 'E'], top: 111, side: [154, 154], cable: 8.6, col: GREEN, every: 12.2, thick: 0.7, rope: 0.2, clear: 2.5, sideSag: 3, legs: [[null, 57, 3.6, 4.8], [57, 111, 3.1, 4.2]], struts: [[50, 3.2, 3.2], [108.5, 4.5, 3.4]], cross: [[8, 46, 1.5], [63, 84, 1.3], [85, 105, 1.3]], base: [30, 12, 6] });
        for (let st = 40; st < L - 30; st += 46) { if (st > K.W - 160 && st < K.E + 160) continue; const p = pointAt(D1, st); p.nx = -p.tz; p.nz = p.tx; pier(B, p, deckY(D1, st, p.x, p.z) - 4.6, { gap: 5, w: 1.8, l: 2.2 }); }
        solid(s, B, 'Vincent Thomas Bridge'); const top = yOf(111, 0), n = 40;
        [-1, 1].forEach(sd => { for (let i = 0; i <= n; i++) { [[K.W - 154, K.W, 0], [K.W, K.E, 1], [K.E, K.E + 154, 2]].forEach(sp => { if (sp[2] !== 1 && i % 2) return; const u = i / n, st = sp[0] + (sp[1] - sp[0]) * u, p = pointAt(D1, st), yd = deckY(D1, st, p.x, p.z), y = sp[2] === 1 ? top - 4 * (top - (deckY(D1, (K.W + K.E) / 2, p.x, p.z) + 2.5)) * u * (1 - u) : sp[2] === 0 ? yd + 1.5 + (top - yd - 1.5) * u : yd + 1.5 + (top - yd - 1.5) * (1 - u); lit(s, p.x - p.tz * sd * 8.6, y + 0.8, p.z + p.tx * sd * 8.6, BLU, 16); }); } });
        ['W', 'E'].forEach(k => { const p = pointAt(D1, K[k]); [-1, 1].forEach(sd => lit(s, p.x - p.tz * sd * 8.6, top + 2, p.z + p.tx * sd * 8.6, RED, 30)); }); s.note = 'towers ' + Math.round(K.E - K.W) + ' m apart, ' + (s.lamps.length - 4) + ' blue lamps'; }); }

    /* ---- San Francisco-Oakland Bay Bridge.
            West span: two suspension bridges end to end on a centre anchorage, four towers 526 ft (160 m), main spans 2,310 ft (704 m), double deck (westbound above), 220 ft (67 m) clear.
            East span: one 525 ft (160 m) tower near the west end of a 2,047 ft (624 m) self-anchored span, then the skyway down to Oakland; two decks side by side; white.
            The towers, the anchorage and the lines are OpenStreetMap's. Assumed: every deck height (the sources give clearances only), 7.5 m between the two decks,
            the grey of the west span, where the east span's cable meets the deck. The tunnel through Yerba Buena Island is not modelled: the deck runs across the island in the open. ---- */
    if (BR.bay) { const b = BR.bay, W = b.wt, GREYB = [0.6, 0.62, 0.64, 0], WHITEB = [0.93, 0.93, 0.91, 0];
      const pts = b.sf.slice().reverse().concat([W.W1, W.W7, b.ybi[1]]);
      const D1 = deck({ name: 'Bay Bridge, west span', pts, half: 10, lower: 7.5, marks: W, rampA: 160,
        prof: (s, L, K) => { if (K.t === undefined) K.t = tbl([[0, 13], [K.W1, 58], [K.W2, 66], [(K.W2 + K.W3) / 2, 72.5], [K.W3, 70], [K.W4, 70], [K.W5, 70], [(K.W5 + K.W6) / 2, 72.5], [K.W6, 66], [K.W7, 60], [L, 57]]); return K.t(s); } });
      const D2 = deck({ name: 'Bay Bridge, east span', pts: b.east, half: b.eastSep / 2 + 13, marks: { T: b.et }, rampB: 240, sep: b.eastSep,
        prof: (s, L, K) => { if (K.t === undefined) K.t = tbl([[0, 57], [K.T, 54], [K.T + 430, 51], [L - 500, 11], [L, 4]]); return K.t(s); } });
      site('Bay Bridge', 37.805, -122.362, 45000, s => {
        const sm = samples(D1, 15), B = new MeshBuilder(), K = D1.loc.K, L = D1.loc.L; roadway(B, sm, D1.half, { hb: 10, t: 1.6, slab: 1, box: GREYB, rail: GREYB, under: GREYB });
        const low = sm.map(p => Object.assign({}, p, { y: p.y - 7.5 })); roadway(B, low, D1.half, { hb: 10, t: 1.6, slab: 1, box: GREYB, rail: GREYB, under: GREYB });
        for (let i = 0; i < sm.length; i++) { const p = sm[i]; if (p.s < K.W1 - 400 || i % 2) continue; [-1, 1].forEach(sd => SH.beam(B, [p.x + p.nx * sd * 9.8, p.y - 7.5, p.z + p.nz * sd * 9.8], [p.x + p.nx * sd * 9.8, p.y - 1, p.z + p.nz * sd * 9.8], 0.5, 0.5, GREYB)); }
        const tw = { top: 160, cable: 10.3, col: GREYB, every: 15, thick: 0.8, rope: 0.22, clear: 3, sideSag: 5, legs: [[null, 66, 5.5, 7], [66, 160, 4.6, 6]], struts: [[56, 4, 4], [157, 5, 4]], cross: [[10, 52, 1.8], [76, 102, 1.5], [103, 129, 1.5], [130, 154, 1.5]], base: [38, 20, 8] };
        susp(B, D1, sm, Object.assign({}, tw, { towers: ['W2', 'W3'], side: [K.W2 - K.W1, K.W4 - K.W3 - 12] })); susp(B, D1, sm, Object.assign({}, tw, { towers: ['W5', 'W6'], side: [K.W5 - K.W4 - 12, K.W7 - K.W6] }));
        { const p = pointAt(D1, K.W4), y = deckY(D1, K.W4, p.x, p.z); B.box(p.x, (y + 12 + yOf(0, 0)) / 2, p.z, 13, (y + 12 - yOf(0, 0)) / 2 + 1, 30, Math.atan2(p.tx, p.tz), CONC); }                         /* the centre anchorage */
        for (let st = 60; st < L - 20; st += 55) { if (st > K.W1 - 20 && st < K.W7 + 20) continue; const p = pointAt(D1, st); p.nx = -p.tz; p.nz = p.tx; pier(B, p, deckY(D1, st, p.x, p.z) - 9.1, { gap: 6, w: 2.2, l: 2.6 }); }
        solid(s, B, 'Bay Bridge, west span'); [K.W2, K.W3, K.W5, K.W6].forEach(st => { const p = pointAt(D1, st); [-1, 1].forEach(sd => lit(s, p.x - p.tz * sd * 10.3, yOf(162, 0), p.z + p.tx * sd * 10.3, RED, 30)); });
        /* east span */
        const sm2 = samples(D2, 20), B2 = new MeshBuilder(), K2 = D2.loc.K, L2 = D2.loc.L, h = b.eastSep / 2, shift = o => sm2.map(p => Object.assign({}, p, { x: p.x + p.nx * o, z: p.z + p.nz * o }));
        [-1, 1].forEach(sd => roadway(B2, shift(sd * h), 12.6, { hb: 9, t: 5, slab: 1, box: WHITEB, rail: WHITEB, under: WHITEB }));
        const tp = pointAt(D2, K2.T), top = yOf(160, 0), wy = yOf(0, 0); [-1, 1].forEach(sd => [-1, 1].forEach(al => SH.beam(B2, [tp.x - tp.tz * sd * 2.2 + tp.tx * al * 2.2, wy - 2, tp.z + tp.tx * sd * 2.2 + tp.tz * al * 2.2], [tp.x - tp.tz * sd * 1.6 + tp.tx * al * 1.6, top, tp.z + tp.tx * sd * 1.6 + tp.tz * al * 1.6], 3.4, 3.4, WHITEB)));
        for (let y = 30; y < 150; y += 24) B2.box(tp.x, yOf(y, 0), tp.z, 3.2, 1.2, 3.2, Math.atan2(tp.tx, tp.tz), WHITEB);
        const outer = h + 12.6, ends = [K2.T - 195, K2.T + 429]; [-1, 1].forEach(sd => ends.forEach((se, ei) => { const n = ei ? 21 : 10; let prev = null; for (let i = 0; i <= n; i++) { const u = i / n, st = K2.T + (se - K2.T) * u, p = pointAt(D2, st), yd = deckY(D2, st, p.x, p.z), off = sd * outer * Math.pow(u, 0.8), y = top + (yd + 2 - top) * u - 4 * 9 * u * (1 - u), c = [p.x - p.tz * off, y, p.z + p.tx * off]; if (prev) SH.beam(B2, prev, c, 0.9, 0.9, WHITEB); prev = c;
          if (i > 0 && i < n) { const e = [p.x - p.tz * sd * outer, yd + 0.5, p.z + p.tx * sd * outer]; SH.beam(B2, c, e, 0.22, 0.22, WHITEB); } } }));
        for (let st = 80; st < L2 - 40; st += 160) { if (Math.abs(st - K2.T) < 60) continue; const p = pointAt(D2, st); [-1, 1].forEach(sd => { const q = { x: p.x - p.tz * sd * h, z: p.z + p.tx * sd * h, tx: p.tx, tz: p.tz, nx: -p.tz, nz: p.tx }; pier(B2, q, deckY(D2, st, p.x, p.z) - 5, { gap: 5, w: 3, l: 4 }); }); }
        solid(s, B2, 'Bay Bridge, east span'); lit(s, tp.x, top + 3, tp.z, RED, 30); s.note = 'west towers ' + Math.round(K.W3 - K.W2) + ' and ' + Math.round(K.W6 - K.W5) + ' m apart'; }); }

    /* ---- red lamps on the Golden Gate's tower tops, and its sodium lamps along the deck (generated) ---- */
    { const gg = X.sites.find(s => s.name === 'Golden Gate Bridge'), D1 = X.decks.find(d => d.name === 'Golden Gate Bridge'); if (gg && D1) { const make = gg.make; gg.make = s => { make(s); const K = D1.loc.K; [K.S, K.N].forEach(st => { const p = pointAt(D1, st); [-1, 1].forEach(sd => lit(s, p.x - p.tz * sd * 13.7, yOf(229, 0), p.z + p.tx * sd * 13.7, RED, 30)); }); for (let st = 30; st < D1.loc.L; st += 46) { const p = pointAt(D1, st); [-1, 1].forEach(sd => lit(s, p.x - p.tz * sd * 12.6, deckY(D1, st, p.x, p.z) + 9, p.z + p.tx * sd * 12.6, AMB, 14)); } }; }
      const co = X.sites.find(s => s.name === 'San Diego-Coronado Bridge'), D2 = X.decks.find(d => d.name === 'San Diego-Coronado Bridge'); if (co && D2) { const make = co.make; co.make = s => { make(s); for (let st = 30; st < D2.loc.L; st += 55) { const p = pointAt(D2, st); lit(s, p.x, deckY(D2, st, p.x, p.z) + 1.4, p.z, AMB, 10); } const p = pointAt(D2, D2.loc.K.ch); [-1, 1].forEach(sd => lit(s, p.x + p.tx * sd * 40, deckY(D2, D2.loc.K.ch, p.x, p.z) - 6.5, p.z + p.tz * sd * 40, sd < 0 ? RED : GRN, 20)); }; } }

    /* ---- airports at night: edge lights, threshold and end bars, approach lights, the glide path lamps (real runways; the lamps are placed by rule, not surveyed) ---- */
    (DATA.airports || []).forEach(a => site('Lights of ' + a.name, a.lat, a.lon, 26000, s => { const ap = MD.airports[a.id], F = MD.FLOW[a.id] || {}, done = {}; s.lamps = [];
      a.rw.forEach(r => { const e = MD.runway(a.id, r[0]), e2 = MD.runway(a.id, r[1]); if (!e || !e2) return; const key = r[0] + r[1]; if (done[key]) return; done[key] = 1; const hw = e.wid / 2 + 3, P = (d, sd) => { const q = MD.along(ap, e, d, sd), l = toL(q[0], q[1]); return [l[0], gy(l[0], l[1]) + 0.5, l[1]]; }, put = (d, sd, col, I) => { const p = P(d, sd); lit(s, p[0], p[1], p[2], col, I); };
        for (let d = 0; d <= e.len; d += 61) { const last = d > e.len - 610 || d < 610; put(d, hw, last ? AMB : WHT, 9); put(d, -hw, last ? AMB : WHT, 9); }
        [[e, 1], [e2, -1]].forEach(([en, dir]) => { const base = dir > 0 ? en.displ : e.len - en.displ, P2 = (dd, sd) => { const q = MD.along(ap, e, base + dir * dd, sd * dir), l = toL(q[0], q[1]); return [l[0], gy(l[0], l[1]) + 0.5, l[1]]; }, put2 = (dd, sd, col, I) => { const p = P2(dd, sd); lit(s, p[0], p[1], p[2], col, I); };
          for (let w = -hw + 3; w <= hw - 3; w += 6) put2(-1, w, GRN, 16); for (let w = -hw + 3; w <= hw - 3; w += 6) { const p = P2(-en.displ - 3, w); lit(s, p[0], p[1], p[2], RED, 14); }
          const lands = (F.arr || []).concat(F.night ? F.night.arr : []).some(x => x.replace(/^0/, '') === en.id.replace(/^0/, '')), far = lands ? 720 : 300; for (let dd = 30; dd <= far; dd += 30) for (let w = -6; w <= 6; w += 3) { if (dd < en.displ - 5 && Math.abs(w) < 5) continue; put2(-dd, w, WHT, lands ? 22 : 12); } if (lands) for (let w = -15; w <= 15; w += 3) put2(-300, w, WHT, 22);
          const c = MD.config(a.id, en.id), aim = c.tch * MD.FT / Math.tan(c.gs * RDG); [0, 1, 2, 3].forEach(i => put2(aim, -(hw + 15 + i * 9), i < 2 ? RED : WHT, 40)); }); });
      s.note = s.lamps.length + ' lamps'; }));

    /* ---- vessels under way in San Diego Bay (all generated): the ferry between the city and Coronado, yachts, and now and then a destroyer in the channel, which passes under the
            Coronado Bridge between the piers either side of the channel pier. The channel line is drawn by hand down the middle of the water on the photograph. ---- */
    const CH = [[32.68, -117.229], [32.702, -117.229], [32.712, -117.2245], [32.72, -117.212], [32.7222, -117.195], [32.7172, -117.186], [32.7083, -117.1764], [32.703, -117.168], [32.6975, -117.159], [32.6899, -117.1533], [32.682, -117.142], [32.67, -117.132]], FERRY = [[32.7135, -117.179], [32.7003, -117.1693]];
    const kx = MD.mLon(32.7), ky = MD.mLat(32.7), cum = [0]; CH.forEach((p, i) => { if (i) cum.push(cum[i - 1] + Math.hypot((p[0] - CH[i - 1][0]) * ky, (p[1] - CH[i - 1][1]) * kx)); }); const CL = cum[cum.length - 1];
    const chAt = (s, off) => { s = clamp(s, 0, CL); let i = 0; while (i < CH.length - 2 && cum[i + 1] < s) i++; const u = (s - cum[i]) / (cum[i + 1] - cum[i]), e = (CH[i + 1][1] - CH[i][1]) * kx, n = (CH[i + 1][0] - CH[i][0]) * ky, l = Math.hypot(e, n) || 1; return { lat: lerp(CH[i][0], CH[i + 1][0], u) - (e / l) * (off || 0) / ky, lon: lerp(CH[i][1], CH[i + 1][1], u) + (n / l) * (off || 0) / kx, hdg: (Math.atan2(e, n) / RDG + 360) % 360 }; };
    X.vessels = t => { const out = [];
      { const P = 1800, u = ((t % P) + P) % P, leg = 660, hold = 240, fl = (FERRY[1][1] - FERRY[0][1]) * kx, fn = (FERRY[1][0] - FERRY[0][0]) * ky, hd = (Math.atan2(fl, fn) / RDG + 360) % 360; let f, back = false, v = Math.hypot(fl, fn) / leg; if (u < leg) f = u / leg; else if (u < leg + hold) { f = 1; v = 0; } else if (u < 2 * leg + hold) { f = 1 - (u - leg - hold) / leg; back = true; } else { f = 0; v = 0; back = true; } const e = smoothstep(0, 1, f); out.push({ kind: 'ferry', lat: lerp(FERRY[0][0], FERRY[1][0], e), lon: lerp(FERRY[0][1], FERRY[1][1], e), hdg: back ? (hd + 180) % 360 : hd, v, L: 30 }); }
      for (let i = 0; i < 4; i++) { const v = 2.2 + 0.5 * hsh(i, 1, 2, 3), s0 = cum[3] + 400, span = CL - s0 - 800, P = 2 * span / v, u = (((t + i * 977) % P) + P) % P, fwd = u < P / 2, s = s0 + (fwd ? u * v : span - (u - P / 2) * v), q = chAt(s, (fwd ? 1 : -1) * (120 + 90 * hsh(i, 5, 6, 7))); out.push({ kind: 'sail', lat: q.lat, lon: q.lon, hdg: fwd ? q.hdg : (q.hdg + 180) % 360, v, L: 12 }); }
      { const v = 4.1, P = 10800, u = ((t % P) + P) % P, dur = CL / v, n = Math.floor(t / P); if (u < dur) { const outb = n % 2 === 0, s = outb ? CL - u * v : u * v, q = chAt(s, outb ? -45 : 45); out.push({ kind: 'ddg', lat: q.lat, lon: q.lon, hdg: outb ? (q.hdg + 180) % 360 : q.hdg, v, L: 155 }); } }
      return out; };
    let VS = null; const wakeMesh = (() => { const B = new MeshBuilder(); B.tri([0, 0, 0], [-0.5, 0, -1], [0.5, 0, -1], [0, 1, 0], null, null, null, [1, 1, 1, 0]); return T.build(B, 'wake'); })();
    const BAY = [32.70, -117.17];
    X.extra = (t, cam, night) => {
      /* the lamps that stand still */
      const LS = X.lampSet || (X.lampSet = T.set('Lamps of runways, bridges and ships', X.lampMesh || (X.lampMesh = (() => { const B = new MeshBuilder(), P = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]], c = [1, 1, 1, 1]; [[0, 2, 4], [2, 1, 4], [1, 3, 4], [3, 0, 4], [2, 0, 5], [1, 2, 5], [3, 1, 5], [0, 3, 5]].forEach(k => SH.face(B, [P[k[0]], P[k[1]], P[k[2]]], c, [0, 0, 0])); return T.build(B, 'still lamp'); })()), MAT.lamp, { cap: 256 })); LS.ib.clear();
      if (night > 0.1) for (const s of X.sites) { if (!s.built || !s.lamps) continue; for (const l of s.lamps) { if (!l[4]) continue; const d = Math.hypot(l[0] - cam[0], l[1] - cam[1], l[2] - cam[2]); if (d > 32000) continue; T.lamp(LS.ib, l, Math.max(0.3, d * 0.001), l[3], l[4] * night); } }
      /* the vessels */
      const c = toL(BAY[0], BAY[1]); if (Math.hypot(c[0] - cam[0], c[1] - cam[2]) > 30000) { if (VS) Object.keys(VS).forEach(k => VS[k].ib.clear()); X.stats.boats = 0; return; }
      if (!VS) VS = { ferry: T.set('Ferry (generated)', T.build(SH.boat(MeshBuilder, 'ferry'), 'ferry'), MAT.paint, { shadow: 300, far: 15000 }), sail: T.set('Yachts (generated)', T.build(SH.boat(MeshBuilder, 'sail'), 'yacht'), MAT.paint, { far: 9000 }), ddg: T.set('Destroyer under way (generated)', T.build(SH.destroyer(MeshBuilder), 'destroyer under way'), MAT.paint, { shadow: 700, far: 30000 }), wake: T.set('Wakes', wakeMesh, MAT.wake, { far: 12000 }) };
      Object.keys(VS).forEach(k => VS[k].ib.clear()); const list = X.vessels(t), wy = yOf(0, 0); X.vesselList = list; MAT.wake.emissiveIntensity = 0.03 + 0.55 * (1 - night);
      for (const v of list) { const q = toL(v.lat, v.lon), h = v.hdg * RDG, hx = Math.sin(h), hz = -Math.cos(h), yaw = Math.atan2(hx, hz); v.x = q[0]; v.z = q[1]; VS[v.kind].ib.add(q[0], wy, q[1], yaw, 1, 1, 1, 1, 1, 1, 1); if (v.v > 0.5) VS.wake.ib.add(q[0] - hx * v.L * 0.4, wy + 0.25, q[1] - hz * v.L * 0.4, yaw, v.L * 0.5 + v.v * 3, 1, v.L * (1.5 + v.v * 0.6), 1, 1, 1, 1);
        if (night > 0.12) { const d = Math.hypot(q[0] - cam[0], cam[1], q[1] - cam[2]), s0 = Math.max(0.25, d * 0.001), hgt = v.kind === 'ddg' ? 30 : v.kind === 'ferry' ? 7 : 15; T.lamp(LS.ib, [q[0], wy + hgt, q[1]], s0, WHT, 14 * night); T.lamp(LS.ib, [q[0] + hx * v.L * 0.3 - hz * 2, wy + 3, q[1] + hz * v.L * 0.3 + hx * 2], s0, GRN, 10 * night); T.lamp(LS.ib, [q[0] + hx * v.L * 0.3 + hz * 2, wy + 3, q[1] + hz * v.L * 0.3 - hx * 2], s0, RED, 10 * night); } }
      X.stats.boats = list.length;
    };
    X.channel = { line: CH, ferry: FERRY, at: chAt, length: CL };
  }
