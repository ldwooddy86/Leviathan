  /* ==== California traffic in the world: freeways drawn and driven, the hour, the counts, the user's car ==== */
  /* One kit beside StreetKit. It keeps the street map in tiles so that moving on does not throw the world away, hands the
     surface streets to the world as before (with lanes, one-way, limits and levels on them), and itself builds and runs
     what the old engine had no notion of: freeway carriageways and ramps with their paint, bridge decks and piers, the
     freeway traffic (SE.Flow), trucks, buses and cable cars, and the far cars as points of light after dark.
     The interface with the user's car: the car sets S.hero = { x, z, yaw, speed, len, wid, on } every frame (yaw in
     degrees clockwise from north, as the camera and the aircraft use; or hx, hz as a unit heading); the traffic follows it
     and brakes for it; S.trafficHit(x, z, yaw) returns the nearest traffic vehicle whose box meets a box of the car's size
     there, or null. */
  SE.TrafficKit = function (engine, K, S, ST, env, gfx, H) {
    const dev = engine.device, scene = engine.scene, D = SE.TrafficData, RP = SE.RoadPrep, LW = RP.LW, TF = {}, F = SE.Flow(), TR = ST.traffic, TYPES = ST.TYPES, CK = ST.CK, R = rng(90210);
    const GY = (x, z) => (S.gy ? S.gy(x, z) : 0), RAD = Math.PI / 180;
    TF.flow = F; S.traffic = TF;
    /* the mix of cars on California's roads is not Louisiana's: fewer full-size pickups, more sedans and electric cars (a choice, not a count) */
    [0.28, 0.3, 0.12, 0.14, 0.16].forEach((v, i) => { if (TYPES[i]) TYPES[i].share = v; });
    const pickPaint = r => { let a = 0; for (const [v, w] of ST.PAINT) { a += w; if (r <= a) return v; } return ST.PAINT[0][0]; };
    F.carLen = (c, Rn) => { c.ty = CK.pick(Rn()); const t = TYPES[c.ty]; c.wid = t.W; c.col = pickPaint(Rn()); return t.L; };
    const CAP = () => ({ ultra: [1500, 280], high: [950, 190], medium: [520, 110], low: [240, 50] }[engine.quality] || [520, 110]);

    /* ---------- the street map, kept in tiles ---------- */
    const QLA = 0.0045, QF = 5, tiles = new Map(), ftiles = new Map(); let cur = null, fcur = null, fwyRaw = [], strRaw = [], gen = -1, fwyKey = '', fwyAsk = 0;
    const qlo = la => QLA / Math.cos(la * RAD) * 0.998, snap = (la, lo, m) => { const a = QLA * m, b = qlo(Math.round(la / a) * a) * m, cla = Math.round(la / a) * a; return [cla, Math.round(lo / b) * b, a, b]; };
    const here = () => [S.lat0 - S.z / S.ky, S.lon0 + S.x / S.kx];
    /* the streets round a point: the tile it is in, with 320 m to spare all round; asked once, then kept */
    TF.ask = async (la, lo) => { const t = snap(la, lo, 1), k = t[0].toFixed(5) + ',' + t[1].toFixed(5); cur = t; askFwy(la, lo); let p = tiles.get(k); if (!p) { p = env.roads(t[0], t[1], 820); tiles.set(k, p); p.catch(() => tiles.delete(k)); if (tiles.size > 30) tiles.delete(tiles.keys().next().value); } const list = await p; if (list && list.tiger && !list.length) tiles.delete(k); return list; };
    TF.stale = () => { if (!cur) return !!S.roadsAt && Math.hypot(S.x - S.roadsAt[0], S.z - S.roadsAt[1]) > 230; const [la, lo] = here(); if (fcur && (Math.abs(la - fcur[0]) > fcur[2] * 0.62 || Math.abs(lo - fcur[1]) > fcur[3] * 0.62)) askFwy(la, lo); return Math.abs(la - cur[0]) > cur[2] * 0.62 || Math.abs(lo - cur[1]) > cur[3] * 0.62; };
    /* the freeways for several kilometres round, on their own: a small answer, and the far traffic has a road to run on */
    function askFwy(la, lo) { const t = snap(la, lo, QF), k = t[0].toFixed(4) + ',' + t[1].toFixed(4); if (fcur && fcur.k === k) return; t.k = k; fcur = t; const my = ++fwyAsk, g = S.gen; let p = ftiles.get(k); if (!p) { try { p = Promise.resolve(env.roads(t[0], t[1], 3600, { only: 'freeway' })); } catch (e) { p = Promise.resolve([]); } ftiles.set(k, p); p.catch(() => ftiles.delete(k)); }
      p.then(list => { if (my !== fwyAsk || g !== S.gen || !list) return; fwyRaw = list.filter(r => r.kind === 'freeway' || r.kind === 'ramp'); fwyRaw.tiger = !!list.tiger; rebuild(); H.need(); }).catch(() => {}); }
    /* what the world's street builder gets: the surface streets, in local metres, with what the traffic needs on them */
    TF.take = list => { if (gen !== S.gen) { gen = S.gen; F.clear(); fwyKey = ''; } strRaw = list || [];
      const loc = strRaw.filter(r => r.kind !== 'freeway' && r.kind !== 'ramp' && r.kind !== 'cable').map(r => Object.assign({}, r, { name: r.name || '', pts: r.pts.map(p => S.toL(p[0], p[1])) })).filter(r => r.pts.length >= 2), roads = RP.prep(loc);
      /* signals stand where the map says they do, when the map came with its signals */
      if (strRaw.osm && strRaw.signals) { const G = new Set(); strRaw.signals.forEach(p => { const q = S.toL(p[0], p[1]); for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) G.add((Math.round(q[0] / 14) + i) + ':' + (Math.round(q[1] / 14) + j)); }); roads.sig = (x, z) => G.has(Math.round(x / 14) + ':' + Math.round(z / 14)); }
      TF.streets = roads; rebuild(); return roads; };

    /* ---------- materials and meshes ---------- */
    const M = K.mat, WHITE = K.WHITE || [1, 1, 1, 1];
    const mStruct = new Material({ name: 'Bridges and viaducts', vertexColors: true, roughness: 0.92, metallic: 0 }), mBig = new Material({ name: 'Trucks, buses and cable cars', vertexColors: true, roughness: 0.55, metallic: 0.15 });
    const mHead = new Material({ name: 'Far headlights', model: 'unlit', albedo: '#000000', emissive: [1, 0.95, 0.82], emissiveIntensity: 0, castShadow: false, wet: 0 }), mTail = new Material({ name: 'Far tail lights', model: 'unlit', albedo: '#000000', emissive: [1, 0.07, 0.04], emissiveIntensity: 0, castShadow: false, wet: 0 });
    let group = null, parts = [], fleet = null, big = null, dots = null;
    const bigMesh = kind => { const B = new MeshBuilder(), dk = [0.06, 0.06, 0.07, 1], gl = [0.1, 0.12, 0.15, 1], wh = (z, x, r) => { B.box(x, r, z, 0.16, r, r, 0, dk); B.box(-x, r, z, 0.16, r, r, 0, dk); };
      if (kind === 'truck') { /* a tractor and a 53 ft trailer, 20.4 m in all */ B.box(0, 2.65, -2.0, 1.3, 1.42, 8.1, 0, [0.93, 0.93, 0.91, 1]); B.box(0, 1.05, -2.0, 1.1, 0.12, 8.0, 0, dk); B.box(0, 2.05, 7.75, 1.22, 1.25, 1.15, 0, WHITE); B.box(0, 1.5, 9.5, 1.1, 0.62, 0.7, 0, WHITE); B.box(0, 2.5, 8.92, 1.1, 0.42, 0.03, 0, gl); B.box(0, 0.75, 7.6, 1.0, 0.3, 2.4, 0, dk); [9.2, 5.4, 4.1, -7.6, -8.9].forEach(z => wh(z, 1.08, 0.52)); }
      else if (kind === 'box') { B.box(0, 2.25, -0.9, 1.25, 1.3, 3.1, 0, [0.95, 0.95, 0.93, 1]); B.box(0, 1.6, 3.2, 1.1, 0.85, 0.9, 0, WHITE); B.box(0, 2.0, 4.08, 1.0, 0.36, 0.03, 0, gl); B.box(0, 0.7, 0, 0.95, 0.22, 4.0, 0, dk); [3.0, -2.6].forEach(z => wh(z, 1.02, 0.45)); }
      else if (kind === 'bus') { /* a 40 ft transit bus: a band of glass, a stripe below it */ B.box(0, 1.85, 0, 1.3, 1.3, 6.1, 0, WHITE); B.box(0, 2.25, 0, 1.31, 0.42, 5.6, 0, gl); B.box(0, 1.45, 0, 1.315, 0.12, 6.05, 0, [0.85, 0.1, 0.08, 1]); B.box(0, 2.35, 6.08, 1.15, 0.5, 0.03, 0, gl); B.box(0, 3.22, -1, 0.9, 0.1, 3.2, 0, [0.8, 0.8, 0.8, 1]); [4.1, -3.4].forEach(z => wh(z, 1.1, 0.5)); }
      else { /* a cable car, 27 ft 6 in by 8 ft by 10 ft 4 in (Cable Car Museum): maroon below, cream above, a clerestory roof, open at the front */ const ma = [0.42, 0.07, 0.09, 1], cr = [0.9, 0.86, 0.7, 1], bl = [0.55, 0.72, 0.82, 1];
        B.box(0, 0.75, 0, 1.22, 0.32, 4.2, 0, ma); B.box(0, 1.6, -1.9, 1.2, 0.55, 2.2, 0, ma); B.box(0, 2.35, -1.9, 1.2, 0.22, 2.2, 0, bl); B.box(0, 2.72, 0, 1.24, 0.1, 4.2, 0, cr); B.box(0, 2.95, 0, 0.8, 0.14, 3.8, 0, cr); [[1.1, 2.3], [-1.1, 2.3], [1.1, 4.1], [-1.1, 4.1], [1.1, 0.4], [-1.1, 0.4]].forEach(p => B.box(p[0], 1.9, p[1], 0.05, 0.85, 0.05, 0, cr)); B.box(0, 1.35, 2.3, 0.55, 0.3, 1.7, 0, [0.5, 0.33, 0.18, 1]); B.box(0, 0.32, 0, 0.9, 0.2, 3.4, 0, dk); }
      return B.build(dev, { name: kind }); };
    function fleetInit() { if (fleet) return; fleet = TYPES.map((t, i) => { const c = CK.get(i), e = scene.createEntity(t.name + 's on the freeway', { parent: group, transient: true }), sets = {};
        [['near', c.mid, c.rolling, 90], ['far', c.far, c.rolling, 0]].forEach(([k, mesh, mat, sh]) => { const ib = new InstanceBuffer(dev, 64), r = e.add('InstancedRenderer'); r.instances = ib; r.mesh = mesh; r.material = mat; r.castShadow = sh > 0; r.shadowDistance = sh || 1; sets[k] = ib; }); return sets; });
      big = {}; ['truck', 'box', 'bus', 'cable'].forEach(k => { const e = scene.createEntity('Traffic: ' + k, { parent: group, transient: true }), ib = new InstanceBuffer(dev, 16), r = e.add('InstancedRenderer'); r.instances = ib; r.mesh = bigMesh(k); r.material = mBig; r.shadowDistance = 120; big[k] = ib; });
      const lamp = w => { const B = new MeshBuilder(); B.box(0.62, 0, 0, 0.2, 0.11, 0.07, 0); B.box(-0.62, 0, 0, 0.2, 0.11, 0.07, 0); return B.build(dev, { name: 'lamps' }); }; dots = {};
      [['head', mHead], ['tail', mTail]].forEach(([k, mat]) => { const e = scene.createEntity('Traffic lights far off: ' + k, { parent: group, transient: true }), ib = new InstanceBuffer(dev, 256), r = e.add('InstancedRenderer'); r.instances = ib; r.mesh = lamp(); r.material = mat; r.castShadow = false; dots[k] = ib; }); }
    /* an instance with a heading and a pitch, so a car sits on a slope */
    const put = (ib, x, y, z, hx, hz, sp, col, a, sc) => { ib._grow(ib.count + 1); const d = ib.data, o = ib.count * 16, cp = Math.sqrt(1 - sp * sp), k = sc || 1; d[o] = hz * k; d[o + 1] = -hx * sp * k; d[o + 2] = hx * cp * k; d[o + 3] = x; d[o + 4] = 0; d[o + 5] = cp * k; d[o + 6] = sp * k; d[o + 7] = y; d[o + 8] = -hx * k; d[o + 9] = -hz * sp * k; d[o + 10] = hz * cp * k; d[o + 11] = z; d[o + 12] = col[0]; d[o + 13] = col[1]; d[o + 14] = col[2]; d[o + 15] = a == null ? 1 : a; ib.dirty = true; ib.count++; };
    /* how much a vehicle's nose is up, from the ground under its two ends and the deck it is on */
    const pitchOf = (c, hl) => { if (!S.gy) return 0; const a = GY(c.x + c.hx * hl, c.z + c.hz * hl), b = GY(c.x - c.hx * hl, c.z - c.hz * hl); return clamp((a - b) / (2 * hl), -0.4, 0.4); };
    /* the street traffic's cars are placed through here too (the port routes StreetKit's own line to it) */
    SE.carPut = (ib, Sx, c, alpha) => { const hl = c.hl || 2.4; put(ib, c.x, GY(c.x, c.z) + (c.dk || 0), c.z, c.hx, c.hz, c.dk > 0.3 ? 0 : pitchOf(c, hl), c.col, alpha); };

    /* ---------- building: the decks, the paint, the piers ---------- */
    const yel = K.hexRGB('#d9a92e'), wht = K.hexRGB('#e6e4dc'), conc = [0.62, 0.61, 0.58, 1], concD = [0.5, 0.49, 0.47, 1];
    function clear() { parts.forEach(p => { p.e.destroy(); p.mesh.dispose(); }); parts = []; }
    /* a strip along a line at sideways offsets a..b (right of the heading is positive), lifted by `lift` over the deck */
    const strip = (B, P, N, Y, a, b, lift, col, aux, d0, d1, acc) => { for (let i = 0; i + 1 < P.length; i++) { if (acc && (acc[i + 1] < d0 || acc[i] > d1)) continue; const A = [P[i][0] + N[i][0] * b(i), Y[i] + lift, P[i][1] + N[i][1] * b(i)], Bq = [P[i][0] + N[i][0] * a(i), Y[i] + lift, P[i][1] + N[i][1] * a(i)], C = [P[i + 1][0] + N[i + 1][0] * a(i + 1), Y[i + 1] + lift, P[i + 1][1] + N[i + 1][1] * a(i + 1)], E = [P[i + 1][0] + N[i + 1][0] * b(i + 1), Y[i + 1] + lift, P[i + 1][1] + N[i + 1][1] * b(i + 1)]; B.quad(A, Bq, C, E, [0, 1, 0], aux ? [[A[0] / 4, A[2] / 4], [Bq[0] / 4, Bq[2] / 4], [C[0] / 4, C[2] / 4], [E[0] / 4, E[2] / 4]] : null, col || WHITE, aux); } };
    const wall = (B, P, N, Y, off, y0, y1, col) => { for (let i = 0; i + 1 < P.length; i++) { const o0 = off(i), o1 = off(i + 1), ax = P[i][0] + N[i][0] * o0, az = P[i][1] + N[i][1] * o0, bx = P[i + 1][0] + N[i + 1][0] * o1, bz = P[i + 1][1] + N[i + 1][1] * o1, nx = N[i][0], nz = N[i][1]; B.quad([ax, Y[i] + y0, az], [bx, Y[i + 1] + y0, bz], [bx, Y[i + 1] + y1, bz], [ax, Y[i] + y1, az], [nx, 0, nz], null, col); B.quad([bx, Y[i + 1] + y0, bz], [ax, Y[i] + y0, az], [ax, Y[i] + y1, az], [bx, Y[i + 1] + y1, bz], [-nx, 0, -nz], null, col); } };
    function deck(Bd, Bs, Pt, P, N, DK, hw, shift, o) { const Y = P.map((p, i) => GY(p[0], p[1]) + DK[i]), AXL = [0, 0, 0, K.LAYER[o.surf || 'asphalt']], AX = [AXL, AXL, AXL, AXL], L = i => shift(i) - hw, Rr = i => shift(i) + hw;
      if (!o.hide) strip(Bd, P, N, Y, L, Rr, 0.11, null, AX);
      /* where the road stands clear of the ground: a slab, a parapet each side, and piers under it */
      let acc = 0, next = 14; for (let i = 0; i + 1 < P.length; i++) { const up = DK[i] > 1.2 || DK[i + 1] > 1.2, sl = [P[i], P[i + 1]], sn = [N[i], N[i + 1]], sy = [Y[i], Y[i + 1]], l = Math.hypot(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]);
        if (up && !o.hide) { const a = j => (j ? shift(i + 1) : shift(i)) - hw, b = j => (j ? shift(i + 1) : shift(i)) + hw; wall(Bs, sl, sn, sy, a, -1.2, 0.95, conc); wall(Bs, sl, sn, sy, b, -1.2, 0.95, conc); strip(Bs, sl, sn, sy.map(v => v - 1.2), b, a, 0, concD);
          while (next < acc + l) { const t = (next - acc) / l, dk = DK[i] + (DK[i + 1] - DK[i]) * t; if (dk > 2.6) { const cx = P[i][0] + (P[i + 1][0] - P[i][0]) * t, cz = P[i][1] + (P[i + 1][1] - P[i][1]) * t, nx = N[i][0], nz = N[i][1], sh = shift(i), yaw = Math.atan2(nx, nz), cols = hw > 8 ? [-hw * 0.5, hw * 0.5] : [0]; cols.forEach(q => { const px = cx + nx * (sh + q), pz = cz + nz * (sh + q), g = GY(px, pz), top = sy[0] + (sy[1] - sy[0]) * t - 1.2; if (top - g > 1) Bs.box(px, (top + g) / 2, pz, Math.min(1.6, 0.7 + dk * 0.03), (top - g) / 2, 0.8, yaw, concD); }); if (hw > 5) Bs.box(cx + nx * sh, sy[0] + (sy[1] - sy[0]) * t - 1.75, cz + nz * sh, hw * 0.92, 0.55, 0.9, yaw, concD); } next += dk > 30 ? 60 : 32; } }
        else if (!up) next = Math.max(next, acc + l + 14); acc += l; }
      return Y; }
    function rebuild() {
      if (!H.root()) return; if (!group) group = scene.createEntity('Freeways and their traffic (generated)', { parent: H.root(), transient: true });
      /* the freeway set: what the wide answer gave, and whatever the street answer holds besides */
      const seen = new Set(), raw = []; fwyRaw.concat(strRaw.filter(r => r.kind === 'freeway' || r.kind === 'ramp' || r.kind === 'cable')).forEach(r => { const k = r.id != null ? r.id : r.pts[0].join() + r.pts.length; if (seen.has(k)) return; seen.add(k); raw.push(r); });
      const key = S.gen + ':' + raw.length + ':' + raw.reduce((a, r) => (a + (typeof r.id === 'number' ? r.id : r.pts.length * 7919)) % 1e9, 0) + ':' + (TF.streets ? TF.streets.filter(r => r.up).length : 0); if (key === fwyKey) return; fwyKey = key;
      const loc = raw.map(r => Object.assign({}, r, { pts: r.pts.map(p => S.toL(p[0], p[1])) })); if (fwyRaw.tiger || strRaw.tiger) RP.pairDirs(loc);
      const roads = RP.prep(loc); RP.high(roads); RP.ground(roads); F.setRoads(roads); TF.roads = roads; clear(); demandAt = null;
      const Bd = new MeshBuilder({ aux: true }), Bs = new MeshBuilder(), Pt = new MeshBuilder();
      F.segs.forEach(s => { if (s.kind === 'cable') return; const P = s.pts, N = P.map((p, i) => [s.nx[i], s.nz[i]]), sh = i => F.shiftAt(s, s.acc[i]), hw = s.n * LW / 2, sho = s.kind === 'ramp' ? 1.8 : 2.4;
        const Y = deck(Bd, Bs, Pt, P, N, s.dk, hw + sho, sh, { hide: s.hide, surf: s.r.span ? 'concrete' : 'asphalt' }); if (s.hide) return;
        /* freeway paint: a yellow line on the left edge, a white one on the right, and between the lanes four raised dots and a gap (Botts' dots), 48 ft from one group to the next */
        strip(Pt, P, N, Y, i => sh(i) - hw - 0.08, i => sh(i) - hw + 0.08, 0.135, yel); strip(Pt, P, N, Y, i => sh(i) + hw - 0.08, i => sh(i) + hw + 0.08, 0.135, wht);
        for (let ln = 1; ln < s.n; ln++) { const off = (ln - s.n / 2) * LW; if (s.hov && ln === 1) { strip(Pt, P, N, Y, i => sh(i) + off - 0.2, i => sh(i) + off - 0.08, 0.135, wht); strip(Pt, P, N, Y, i => sh(i) + off + 0.08, i => sh(i) + off + 0.2, 0.135, wht); continue; }
          let i = 0; for (let d = 3; d + 3.7 < s.len; d += 14.63) { while (i < s.acc.length - 2 && s.acc[i + 1] < d) i++; const t = (d - s.acc[i]) / (s.acc[i + 1] - s.acc[i] || 1), o2 = sh(i) + off, hx = (P[i + 1][0] - P[i][0]), hz = (P[i + 1][1] - P[i][1]), hl = Math.hypot(hx, hz) || 1, x = P[i][0] + hx * t + N[i][0] * o2, z = P[i][1] + hz * t + N[i][1] * o2, y = Y[i] + (Y[i + 1] - Y[i]) * t + 0.135, ux = hx / hl, uz = hz / hl, sl = (Y[i + 1] - Y[i]) / hl;
            for (let q = 0; q < 4; q++) { const a = q * 1.22, b = a + 0.32, w = 0.075; Pt.quad([x + ux * a - uz * w, y + sl * a, z + uz * a + ux * w], [x + ux * a + uz * w, y + sl * a, z + uz * a - ux * w], [x + ux * b + uz * w, y + sl * b, z + uz * b - ux * w], [x + ux * b - uz * w, y + sl * b, z + uz * b + ux * w], [0, 1, 0], null, wht); } } } });
      /* surface streets that cross on a bridge: their own deck, a centre line, and the rise to it */
      (TF.streets || []).forEach(r => { if (!r.up) return; const P = r.pts, N = P.map((p, i) => { const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [-(b[1] - a[1]) / l, (b[0] - a[0]) / l]; }), hw = (r.w || (K.ROADW[r.kind] || K.ROADW.street)[0]) / 2;
        const Y = deck(Bd, Bs, Pt, P, N, r.dk, hw, () => 0, { surf: r.span ? 'concrete' : 'asphalt' }); if (r.kind === 'major' && !r.ow) { strip(Pt, P, N, Y, () => -0.2, () => -0.08, 0.135, yel); strip(Pt, P, N, Y, () => 0.08, () => 0.2, 0.135, yel); } });
      [['Freeway and bridge decks', Bd, M.road], ['Bridge structure', Bs, mStruct], ['Freeway paint', Pt, M.paint]].forEach(([name, b, mat]) => { if (b.empty) return; const mesh = b.build(dev, { name, clusters: 320 }), e = scene.createEntity(name, { parent: group, transient: true }), mr = e.add('MeshRenderer'); mr.mesh = mesh; mr.material = mat; mr.castShadow = mat === mStruct; mr.pickable = false; parts.push({ e, mesh }); });
      fleetInit(); TF.stats = { pieces: F.segs.length, laneKm: +F.laneKm.toFixed(1), raised: roads.filter(r => r.up).length };
    }

    /* ---------- the hour and the counts: how full each road should be ---------- */
    let demandAt = null, lastHour = -99; const nearCache = new Map();
    TF.hour = () => (S.sunTime ? D.hourOf(S.sunTime, S.lon0) : 12);
    function demand(eye) { const hour = TF.hour(), metro = D.metroOf(S.lat0, S.lon0), M0 = D.METRO[metro], jump = Math.abs(hour - lastHour) > 0.75 && Math.abs(hour - lastHour) < 23.25; lastHour = hour; demandAt = [eye[0], eye[1], hour]; F.cap = CAP()[0];
      if (jump) F.clear();
      const cong = M0 ? D.street(metro, hour).cong : 0;
      F.setDemand(s => { const rt = D.routeOf(s.r.ref), k = S.gen + ':' + rt + ':' + Math.round(s.pts[0][0] / 700) + ':' + Math.round(s.pts[0][1] / 700); let nr = nearCache.get(k); if (nr === undefined) { nr = D.near(S.lat0 - s.pts[0][1] / S.ky, S.lon0 + s.pts[0][0] / S.kx, rt); if (nearCache.size > 4000) nearCache.clear(); nearCache.set(k, nr); }
        const main = s.kind !== 'ramp', d = D.freeway({ metro, hour, aadt: nr && main ? nr.aadt : 0, lanes: s.n, vff: s.lim, route: rt, kOf: F.kOf }); if (!main) { d.k *= 0.45; d.meter = cong > 0.4 ? 5 + 6 * R() : 0; } s.count = nr; return d; }, eye, S.mode === 'metro' ? 3600 : 2200);
      F.fill();
      /* the surface streets: cars per kilometre of lane by the hour, and the signals' cycle */
      const st = D.street(metro, hour, false); TR.dens = st.k; TR.cycle = st.cycle; if (ST.TT) ST.TT.bus = st.bus; TF.now = { hour: +hour.toFixed(2), metro: metro || 'none', street: st, within: Math.round(F.within || 0) };
      if (jump && TR.driveWays && TR.driveWays.length && gfx.life) TR.populate(CAP()[1], 77 + Math.round(hour * 10), [S.x, S.z, 0, 420]); }
    TF.streetCars = () => CAP()[1];

    /* ---------- the user's car, and anything else that drives ---------- */
    const heroBox = () => { const h = S.hero; if (!h || !h.on) return null; let hx = h.hx, hz = h.hz; if (hx == null) { const y = (h.yaw || 0) * RAD; hx = Math.sin(y); hz = -Math.cos(y); } return { x: h.x, z: h.z, hx, hz, v: Math.abs(h.speed || 0) * (h.speed < 0 ? -1 : 1), hl: (h.len || 4.8) / 2, hw: (h.wid || 1.9) / 2, static: false, hero: true, dk: h.dk != null ? h.dk : (h.y != null ? h.y - GY(h.x, h.z) : null) }; };
    const acts = []; TF.actors = () => acts;
    /* the nearest traffic vehicle whose box meets a box of the user's car's size at (x, z, yaw): { x, z, yaw (radians, 0 = south), hx, hz, v, hl, hw, kind, car } or null. stop: true also brings the vehicle to a halt with its hazard lamps on. */
    S.trafficHit = TF.hit = (x, z, yaw, o) => { const h = S.hero || {}, y = (yaw || 0) * RAD, hx = Math.sin(y), hz = -Math.cos(y), hl = (h.len || 4.8) / 2, hw = (h.wid || 1.9) / 2; let best = null, bd = 1e9;
      const test = (c, kind) => { if (c.out || Math.abs(c.x - x) > 16 || Math.abs(c.z - z) > 16) return; if (TR.overlap(x, z, hx, hz, hl, hw, c.x, c.z, c.hx, c.hz, c.hl, c.hw) <= 0) return; const d = Math.hypot(c.x - x, c.z - z); if (d < bd) { bd = d; best = { x: c.x, z: c.z, yaw: c.yaw, hx: c.hx, hz: c.hz, v: c.v, hl: c.hl, hw: c.hw, kind, car: c }; } };
      for (const c of F.cars) test(c, c.kind); for (const c of TR.cars) test(c, 'car'); for (const c of TR.parked) test(c, 'parked');
      if (best && o && o.stop && best.kind !== 'parked') { const c = best.car; c.v = 0; if (c.legs) c.crash = 3; else { c.a = 0; c.halt = 3; } } return best; };

    /* ---------- every frame ---------- */
    TF.update = (dt, cam, o) => {
      if (!group || !fleet) return false; const eye = [cam[0], cam[2]], night = o.night || 0;
      acts.length = 0; const hb = heroBox(); if (hb) acts.push(hb); F.actors = acts; TR.actors = acts;
      if (!demandAt || Math.hypot(eye[0] - demandAt[0], eye[1] - demandAt[1]) > 240 || Math.abs(TF.hour() - demandAt[2]) > 0.06) demand(eye);
      if (o.moving) { const n = Math.max(1, Math.min(3, Math.ceil(dt / 0.034))); for (let i = 0; i < n; i++) F.step(dt / n, eye); }
      fleet.forEach(f => { f.near.clear(); f.far.clear(); }); for (const k in big) big[k].clear(); dots.head.clear(); dots.tail.clear();
      const lit = night > 0.12; mHead.emissiveIntensity = 60 * night; mTail.emissiveIntensity = 26 * night; const ey = cam[1], white = WHITE;
      for (const c of F.cars) { if (c.seg.hide) continue; const dx = c.x - eye[0], dz = c.z - eye[1], y = GY(c.x, c.z) + c.dk, d = Math.sqrt(dx * dx + dz * dz + (ey - y) * (ey - y)); if (c.halt > 0) { c.halt -= dt; c.v = 0; }
        const sp = d < 400 ? (S.gy && c.dk < 0.3 ? pitchOf(c, c.hl) : c.dkS || 0) : 0;
        if (c.kind === 'car') { if (d < 1500 || !lit) put(fleet[c.ty][d < 150 ? 'near' : 'far'], c.x, y, c.z, c.hx, c.hz, sp, c.col, c.halt > 0 ? 0.5 : c.brake ? 0.75 : 1); }
        else { if (!c.col) c.col = c.kind === 'bus' ? TF.busCol() : c.kind === 'cable' ? white : [[0.95, 0.95, 0.93], [0.8, 0.82, 0.85], [0.75, 0.2, 0.15], [0.2, 0.35, 0.6], [0.93, 0.8, 0.25]][Math.floor(c.tint * 5)]; put(big[c.kind], c.x, y, c.z, c.hx, c.hz, sp, c.col, 1); }
        if (lit && d > 110) { const k = clamp(d / 240, 1, 7); put(dots.head, c.x + c.hx * (c.hl + 0.1), y + 0.7, c.z + c.hz * (c.hl + 0.1), c.hx, c.hz, 0, white, 1, k); put(dots.tail, c.x - c.hx * (c.hl + 0.1), y + 0.85, c.z - c.hz * (c.hl + 0.1), c.hx, c.hz, 0, white, 1, k * (c.brake ? 1.35 : 0.9)); } }
      /* the street traffic's buses (StreetKit hands over what its own five bodies cannot draw) */
      if (ST.bigCars) { for (const c of ST.bigCars) put(big.bus, c.x, GY(c.x, c.z) + (c.dk || 0), c.z, c.hx, c.hz, pitchOf(c, c.hl), c.bcol || (c.bcol = TF.busCol()), 1); ST.bigCars.length = 0; }
      return !!o.moving && F.cars.length > 0;
    };
    /* bus colours by city: Muni silver (with the red stripe the mesh carries), Los Angeles Metro orange, San Diego white and red; elsewhere white */
    TF.busCol = () => ({ sf: [0.74, 0.75, 0.77], la: [0.93, 0.47, 0.1], sd: [0.95, 0.95, 0.95] }[D.metroOf(S.lat0, S.lon0)] || [0.92, 0.92, 0.9]);
    TF.debug = () => ({ now: TF.now, stats: TF.stats, cars: F.cars.length, kinds: F.cars.reduce((a, c) => { a[c.kind] = (a[c.kind] || 0) + 1; return a; }, {}), events: F.events, street: { cars: TR.cars.length, out: TR.cars.filter(c => c.out).length, events: TR.events, dens: TR.dens, cycle: TR.cycle }, mean: F.cars.length ? F.cars.reduce((a, c) => a + c.v, 0) / F.cars.length : 0 });
    return TF;
  };
  /* lane lines on a surface street that has its lanes from the map: white dashes between lanes going the same way, a double yellow between the two directions */
  SE.streetPaint = (K, Pt, w, line, d0, d1, piece, shift, white, yel) => { const L = w.lanes; if (!L || !w.r || (!w.r.ow && w.r.kind !== 'major' && !(w.r.ln > 2))) return false; const f = L[1] || [], b = L[-1] || [], all = f.concat(b).sort((p, q) => p - q); if (all.length < 2 && !b.length) return true;
    if (f.length && b.length) { K.ribbon(Pt, line, 0.11, 0.115, null, 0.12, yel); K.ribbon(Pt, line, 0.11, 0.115, null, -0.12, yel); }
    for (let i = 1; i < all.length; i++) { const o2 = (all[i] + all[i - 1]) / 2; if (f.length && b.length && Math.abs(o2) < 0.2) continue; for (let s = d0 + 2; s + 3 < d1; s += 9) K.ribbon(Pt, shift(piece(w, s, s + 3), o2), 0.11, 0.115, null, 0, white); } return true; };
