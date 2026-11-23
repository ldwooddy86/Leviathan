  /* ==== sky job: the kit. Airliners on the real approaches, the Navy in San Diego Bay, the landmark bridges ==== */
  /* SE.SkyKit(engine, S, { need }) draws what SE.SkyModel works out and what SE.SkyShapes builds:
       - every airliner within 150 km of the camera, on its glide path or climbing out, with gear, lamps and a shadow;
         the high traffic and its contrails;
       - at North Island the carrier where the photograph shows one lying at the quay, Seahawks on the pads and three
         flying a circuit over the bay below 500 ft; at Naval Base San Diego ships at the numbered piers; patrol boats at
         the Amphibious Base; a ferry, yachts and a destroyer under way in the channel;
       - the San Diego-Coronado Bridge, the Golden Gate Bridge, the Bay Bridge and the Vincent Thomas Bridge, each on
         its mapped line and towers, with a deck other kits can ride: S.deckAt(x, z) gives the deck's height in local y
         where a bridge deck is at (x, z), or null.
     Everything is placed by latitude and longitude through S.toL each time the world's origin moves (the kit watches
     S.gen and S.lat0 itself: recenter needs no call), is built only when the camera is near it, and is drawn in local
     y = height above sea level - S.y0 where the terrain kit has set S.y0 and S.gy, else on the flat world (an airport's
     field at y = 0, the sea at y = 0).
     REAL: runway ends, approach paths, rates by hour, sizes and speeds (see SE.SkyModel); the carrier's berth (measured
     on the Esri photograph); pier lines, bridge lines and tower positions (OpenStreetMap); ship and bridge dimensions
     (evidence file E and F). GENERATED: every flight; which ships lie at which pier and how many; the aircraft on the
     carrier's deck; the helicopters' circuit; the boats; pier positions under the Coronado Bridge between the channel
     pier and the ends; colours where no source gave one (haze grey, Coronado blue, Vincent Thomas green). */
  function SkyKit(engine, S, H) {
    H = H || {}; const dev = engine.device, scene = engine.scene, phys = engine.physics, DATA = SE.SKY_DATA || {}, MD = SkyModel(DATA), SH = SkyShapes, X = { model: MD, shapes: SH, on: true, lampK: 0.0011, stats: { flights: 0, sites: 0, helos: 0, boats: 0 } };
    const FT = MD.FT, NM = MD.NM, RDG = Math.PI / 180, need = H.need || (() => {}), hsh = MD.hash;
    const root = scene.createEntity('Sky and harbour', { transient: true });
    const MAT = { paint: new Material({ name: 'Sky kit: aircraft, ships and bridges', vertexColors: true, roughness: 0.55, metallic: 0.08 }),
      lamp: new Material({ name: 'Sky kit: lamps', vertexColors: true, albedo: '#ffffff', model: 'unlit', castShadow: false, wet: 0 }),
      shade: new Material({ name: 'Sky kit: aircraft shadows', albedo: '#000000', roughness: 1, blend: 'alpha', alpha: 0.45, castShadow: false, twoSided: true, polygonOffset: [-2, -8], wet: 0 }),
      trail: [0.62, 0.42, 0.26, 0.13].map((a, i) => new Material({ name: 'Sky kit: contrail ' + i, albedo: '#000000', emissive: '#ffffff', emissiveIntensity: 1, model: 'unlit', blend: 'alpha', alpha: a, castShadow: false, twoSided: true, wet: 0 })),
      wake: new Material({ name: 'Sky kit: wakes', albedo: '#000000', emissive: '#dfeaf0', emissiveIntensity: 0.5, model: 'unlit', blend: 'alpha', alpha: 0.3, castShadow: false, twoSided: true, polygonOffset: [-2, -8], wet: 0 }) };
    X.materials = MAT;
    const gy = (x, z) => (S.gy ? S.gy(x, z) : 0), terr = () => typeof S.y0 === 'number' && !!S.gy, yOf = (alt, base) => (terr() ? alt - S.y0 : alt - (base || 0));
    const toL = (la, lo) => S.toL(la, lo), camLL = c => [S.lat0 - c[2] / S.ky, S.lon0 + c[0] / S.kx];
    const set = (name, mesh, mat, o) => { o = o || {}; const e = scene.createEntity(name, { parent: o.parent || root, transient: true }), r = e.add('InstancedRenderer'), ib = new InstanceBuffer(dev, o.cap || 8); r.instances = ib; r.mesh = mesh; r.material = mat; r.castShadow = !!o.shadow; if (o.shadow) r.shadowDistance = o.shadow; r.maxDistance = o.far || 0; return { e, r, ib, mesh }; };
    const build = (B, name) => B.build(dev, { name });
    /* a pose: heading clockwise from north, pitch nose up, bank right wing down (degrees); the mesh's +x is its left, +z its nose */
    const m16 = new Float32Array(16), ms16 = new Float32Array(16), BL = [0, 0, 0], BU = [0, 0, 0], BF = [0, 0, 0];
    function pose(out, x, y, z, hdg, pitch, bank, s) {
      const h = hdg * RDG, p = (pitch || 0) * RDG, b = (bank || 0) * RDG, sh = Math.sin(h), ch = Math.cos(h), cp = Math.cos(p), sp = Math.sin(p), cb = Math.cos(b), sb = Math.sin(b); s = s || 1;
      const fx = sh * cp, fy = sp, fz = -ch * cp, lx = -ch, lz = -sh, ux = fy * lz, uy = fz * lx - fx * lz, uz = -fy * lx;
      BF[0] = fx; BF[1] = fy; BF[2] = fz; BL[0] = lx * cb + ux * sb; BL[1] = uy * sb; BL[2] = lz * cb + uz * sb; BU[0] = ux * cb - lx * sb; BU[1] = uy * cb; BU[2] = uz * cb - lz * sb;
      out[0] = BL[0] * s; out[1] = BL[1] * s; out[2] = BL[2] * s; out[3] = 0; out[4] = BU[0] * s; out[5] = BU[1] * s; out[6] = BU[2] * s; out[7] = 0; out[8] = BF[0] * s; out[9] = BF[1] * s; out[10] = BF[2] * s; out[11] = 0; out[12] = x; out[13] = y; out[14] = z; out[15] = 1; return out;
    }
    const at = (x, y, z, p) => [x + BL[0] * p[0] + BU[0] * p[1] + BF[0] * p[2], y + BL[1] * p[0] + BU[1] * p[1] + BF[1] * p[2], z + BL[2] * p[0] + BU[2] * p[1] + BF[2] * p[2]];

    /* ---------- lamps: one small solid, coloured and sized per instance; brighter than white reads as light ---------- */
    const lampMesh = (() => { const B = new MeshBuilder(), P = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]], c = [1, 1, 1, 1]; [[0, 2, 4], [2, 1, 4], [1, 3, 4], [3, 0, 4], [2, 0, 5], [1, 2, 5], [3, 1, 5], [0, 3, 5]].forEach(t => SH.face(B, [P[t[0]], P[t[1]], P[t[2]]], c, [0, 0, 0])); return build(B, 'lamp'); })();
    const LAMPS = set('Aircraft lamps', lampMesh, MAT.lamp, { cap: 64 }), g22 = v => Math.pow(Math.max(0, v), 1 / 2.2);
    const lamp = (ib, p, size, col, I) => ib.add(p[0], p[1], p[2], 0, size, size, size, g22(col[0] * I), g22(col[1] * I), g22(col[2] * I), 1);
    const RED = [1, 0.06, 0.04], GRN = [0.08, 1, 0.3], WHT = [1, 0.97, 0.9], BLU = [0.15, 0.4, 1];

    /* ---------- the airliners ---------- */
    const FLEET = {};
    function fleet(T) { let F = FLEET[T.key]; if (F) return F; const a = SH.airliner(MeshBuilder, T); F = FLEET[T.key] = { a, body: set('Airliners ' + T.key, build(a.body, 'airliner ' + T.key), MAT.paint, { shadow: 600 }), gear: set('Gear ' + T.key, build(a.gear, 'gear ' + T.key), MAT.paint, {}), plan: set('Shadows ' + T.key, build(a.plan, 'shadow ' + T.key), MAT.shade, {}) }; return F; }
    const trailMesh = (() => { const B = new MeshBuilder(); B.quad([-0.5, 0, -1], [0.5, 0, -1], [0.5, 0, 0], [-0.5, 0, 0], [0, 1, 0], null, [1, 1, 1, 0]); return build(B, 'contrail'); })(), TRAILS = MAT.trail.map((m, i) => set('Contrails ' + i, trailMesh, m, { cap: 16 }));
    let clockOff = 0, sunSeen = null;
    /* the kit's clock, seconds since 1970: the wall clock moved to the scene's hour. X.hold(t) stops it at t (for tests and pictures); X.hold(null) lets it run */
    X.hold = t => { X.frozen = t == null ? null : +t; need(3); return X.frozen; };
    X.now = () => { if (X.frozen != null) return X.frozen; const st = S.sunTime && S.sunTime.getTime ? S.sunTime.getTime() : null; if (st !== sunSeen) { sunSeen = st; clockOff = st != null ? (st - Date.now()) / 1000 : 0; if (Math.abs(clockOff) < 90) clockOff = 0; } return Date.now() / 1000 + clockOff + (X.skew || 0); };
    X.flights = [];
    function drawFlights(t, cam, night) {
      for (const k in FLEET) { FLEET[k].body.ib.clear(); FLEET[k].gear.ib.clear(); FLEET[k].plan.ib.clear(); } LAMPS.ib.clear(); TRAILS.forEach(s => s.ib.clear());
      const ll = camLL(cam), list = MD.flightsAt(t, ll[0], ll[1], 150000), sun = scene.env.sunDir, day = 1 - night, shOn = sun[1] > 0.12 && night < 0.5, sx = shOn ? sun[0] / sun[1] : 0, sz = shOn ? sun[2] / sun[1] : 0; X.flights = list;
      MAT.trail.forEach(m => { m.emissiveIntensity = 0.04 + 1.5 * day; });
      for (const p of list) {
        const q = toL(p.lat, p.lon), x = q[0], z = q[1], g = p.ground || p.alt - p.base < 400 ? gy(x, z) : 0, y = p.ground ? g : Math.max(yOf(p.alt, p.base), p.kind === 'crz' ? -1e9 : g + 0.2), F = fleet(p.f.type), col = MD.LIVERY[p.f.liv] || MD.LIVERY[0];
        p.x = x; p.y = y; p.z = z; pose(m16, x, y, z, p.hdg, p.pitch, p.bank, 1); F.body.ib.addMatrix(m16, col); if (p.gear) F.gear.ib.addMatrix(m16, col);
        const agl = y - g, d = Math.hypot(x - cam[0], y - cam[1], z - cam[2]), s0 = Math.max(0.35, d * X.lampK), L = F.a.lamps, sd = p.f.sd || 0;
        if (shOn && agl < 400 && p.kind !== 'crz') { const c = at(x, y, z, [0, F.a.cy, 0]), hh = c[1] - g, gx = c[0] - sx * hh, gz = c[2] - sz * hh, g2 = S.gy ? gy(gx, gz) : g; for (let i = 0; i < 3; i++) { const o = i * 4; ms16[o] = m16[o] - sx * m16[o + 1]; ms16[o + 1] = 0; ms16[o + 2] = m16[o + 2] - sz * m16[o + 1]; ms16[o + 3] = 0; } ms16[12] = gx; ms16[13] = g2 + 0.16; ms16[14] = gz; ms16[15] = 1; F.plan.ib.addMatrix(ms16, col); }
        if (d < 60000) {
          if (night > 0.12) { lamp(LAMPS.ib, at(x, y, z, L.tipL), s0, RED, 14 * night); lamp(LAMPS.ib, at(x, y, z, L.tipR), s0, GRN, 14 * night); lamp(LAMPS.ib, at(x, y, z, L.tail), s0, WHT, 10 * night); }
          const ph = (t + sd * 7) % 1.25, I = 20 + 90 * night; if (ph < 0.07 || (ph > 0.2 && ph < 0.27)) { lamp(LAMPS.ib, at(x, y, z, L.tipL), s0 * 1.3, WHT, I); lamp(LAMPS.ib, at(x, y, z, L.tipR), s0 * 1.3, WHT, I); lamp(LAMPS.ib, at(x, y, z, L.tail), s0 * 1.2, WHT, I); }
          if ((t + sd * 5) % 1.1 < 0.13) { lamp(LAMPS.ib, at(x, y, z, L.top), s0 * 1.2, RED, 12 + 50 * night); lamp(LAMPS.ib, at(x, y, z, L.bot), s0 * 1.2, RED, 12 + 50 * night); }
          if (p.ll) { const w = Math.pow(Math.max(0, (BF[0] * (cam[0] - x) + BF[1] * (cam[1] - y) + BF[2] * (cam[2] - z)) / (d || 1)), 3); L.land.forEach(lp => lamp(LAMPS.ib, at(x, y, z, lp), s0 * (0.9 + 1.6 * w), WHT, (8 + 60 * w) * (0.35 + night * 3))); }
        }
        if (p.trail && day > 0.04) { const n = 4, yaw = Math.atan2(BF[0], BF[2]), back = p.f.type.span, seg = p.trail / n; for (let i = 0; i < n; i++) { const d0 = back + seg * i, w = 26 + (p.trail > 15000 ? 90 : 30) * i; TRAILS[i].ib.add(x - BF[0] * d0, y - 1, z - BF[2] * d0, yaw, w, 1, seg, 1, 1, 1, 1); } }
      }
      X.stats.flights = list.length;
    }

    /* ---------- the Seahawks' circuit over the bay (generated; the FAA remark for the field gives surface to 500 ft) ---------- */
    /* [lat, lon, ft above the water, seconds held there] */
    const HELO = { loop: [[32.70225, -117.21195, 0, 25], [32.7025, -117.2125, 60, 0], [32.7128, -117.2185, 300, 0], [32.7198, -117.203, 500, 0], [32.7172, -117.186, 500, 0], [32.7065, -117.1745, 400, 0], [32.701, -117.164, 200, 0], [32.7018, -117.1665, 60, 45], [32.7095, -117.1765, 350, 0], [32.7188, -117.199, 500, 0], [32.7112, -117.2168, 300, 0], [32.7028, -117.2128, 80, 0]], n: 3, kt: 90, hours: [7, 22] };
    (() => { const L = HELO.loop, n = L.length, ky = MD.mLat(32.7), kx = MD.mLon(32.7); let T = 0; HELO.legs = L.map((a, i) => { const b = L[(i + 1) % n], d = Math.hypot((b[0] - a[0]) * ky, (b[1] - a[1]) * kx), slow = a[2] < 100 || b[2] < 100, v = (slow ? 0.45 : 1) * HELO.kt * MD.KT, leg = { a, b, d, t0: T, hold: a[3], dur: d / v, hdg: (Math.atan2((b[1] - a[1]) * kx, (b[0] - a[0]) * ky) / RDG + 360) % 360, slow }; T += leg.hold + leg.dur; return leg; }); HELO.period = T; })();
    X.helos = t => { const h = MD.hourOf(t), out = []; if (h < HELO.hours[0] || h >= HELO.hours[1]) return out;
      for (let i = 0; i < HELO.n; i++) { const u = (((t + i * HELO.period / HELO.n) % HELO.period) + HELO.period) % HELO.period; let leg = HELO.legs[HELO.legs.length - 1]; for (const l of HELO.legs) if (u >= l.t0 && u < l.t0 + l.hold + l.dur) { leg = l; break; }
        const w = u - leg.t0, prev = HELO.legs[(HELO.legs.indexOf(leg) + HELO.legs.length - 1) % HELO.legs.length], dh = ((leg.hdg - prev.hdg + 540) % 360) - 180;
        if (w < leg.hold) { out.push({ lat: leg.a[0], lon: leg.a[1], alt: leg.a[2] * FT, hdg: (prev.hdg + dh * smoothstep(0, Math.max(1, leg.hold), w) + 360) % 360, pitch: 0, bank: 0, v: 0, hover: true, ground: leg.a[2] === 0 }); continue; }
        const f = (w - leg.hold) / leg.dur, e = leg.slow ? f * f * (3 - 2 * f) : f; out.push({ lat: lerp(leg.a[0], leg.b[0], e), lon: lerp(leg.a[1], leg.b[1], e), alt: lerp(leg.a[2], leg.b[2], e) * FT, hdg: (leg.hold ? leg.hdg : (prev.hdg + dh * smoothstep(0, 0.12, f) + 360) % 360), pitch: leg.slow ? -2 : -5, bank: leg.hold ? 0 : clamp(dh * (1 - smoothstep(0, 0.12, f)) * 0.5, -22, 22), v: leg.d / leg.dur, hover: false, ground: false }); }
      return out; };
    let HEL = null; const helSets = () => { if (!HEL) { const h = SH.seahawk(MeshBuilder); HEL = { hub: h.hub, body: set('Seahawks', build(h.body, 'seahawk'), MAT.paint, { shadow: 400 }), rotor: set('Seahawk rotors', build(h.rotor, 'rotor'), MAT.paint, { shadow: 400 }), still: set('Seahawks parked', build(SH.seahawk(MeshBuilder).body, 'seahawk parked'), MAT.paint, { shadow: 300, far: 9000 }), stillR: set('Seahawk rotors parked', build(SH.seahawk(MeshBuilder).rotor, 'rotor parked'), MAT.paint, { far: 6000 }) }; } return HEL; };
    const BAY = [32.70, -117.17];
    function drawHelos(t, cam, night) {
      const c = toL(BAY[0], BAY[1]); if (Math.hypot(c[0] - cam[0], c[1] - cam[2]) > 30000) { if (HEL) { HEL.body.ib.clear(); HEL.rotor.ib.clear(); } X.stats.helos = 0; return 0; }
      const Hs = helSets(), list = X.helos(t); Hs.body.ib.clear(); Hs.rotor.ib.clear(); X.heloList = list;
      for (const p of list) { const q = toL(p.lat, p.lon), y = yOf(p.alt, 0) + (p.ground ? gy(q[0], q[1]) : 0); p.x = q[0]; p.y = y; p.z = q[1]; pose(m16, q[0], y, q[1], p.hdg, p.pitch, p.bank, 1); Hs.body.ib.addMatrix(m16, null); const hub = at(q[0], y, q[1], [0, Hs.hub, 0]); pose(m16, hub[0], hub[1], hub[2], (p.hdg + t * 540) % 360, p.pitch, p.bank, 1); Hs.rotor.ib.addMatrix(m16, null);
        const d = Math.hypot(q[0] - cam[0], y - cam[1], q[1] - cam[2]), s0 = Math.max(0.2, d * X.lampK); pose(m16, q[0], y, q[1], p.hdg, p.pitch, p.bank, 1); if (night > 0.12) { lamp(LAMPS.ib, at(q[0], y, q[1], [1.3, 1.9, 1]), s0, RED, 12 * night); lamp(LAMPS.ib, at(q[0], y, q[1], [-1.3, 1.9, 1]), s0, GRN, 12 * night); } if ((t + p.lat * 9000) % 1 < 0.14) lamp(LAMPS.ib, at(q[0], y, q[1], [0, 0.4, -2]), s0 * 1.2, RED, 10 + 45 * night); }
      X.stats.helos = list.length; return list.length;
    }

    /* ---------- bridge decks: a line, a width, a height along it; S.deckAt reads them ---------- */
    const BR = DATA.bridges || {}, DECKS = [];
    const tbl = T => s => { if (s <= T[0][0]) return T[0][1]; for (let i = 0; i < T.length - 1; i++) if (s <= T[i + 1][0]) { const u = (s - T[i][0]) / (T[i + 1][0] - T[i][0]); return lerp(T[i][1], T[i + 1][1], u); } return T[T.length - 1][1]; };
    /* o: { name, pts [[lat, lon]], half, prof(s, L, K) -> metres above sea level, rampA, rampB (metres over which the end meets the ground), flatOnly (an approach drawn only on the flat world), lower } */
    function deck(o) { o.loc = null; DECKS.push(o); return o; }
    function locate(d) { const P = d.pts.map(p => toL(p[0], p[1])), cum = [0]; let x0 = 1e18, z0 = 1e18, x1 = -1e18, z1 = -1e18; P.forEach((p, i) => { if (i) cum.push(cum[i - 1] + Math.hypot(p[0] - P[i - 1][0], p[1] - P[i - 1][1])); x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); }); const m = d.half + 3; d.loc = { P, cum, L: cum[cum.length - 1], bb: [x0 - m, z0 - m, x1 + m, z1 + m], K: {} }; if (d.marks) for (const k in d.marks) d.loc.K[k] = nearestOn(d, toL(d.marks[k][0], d.marks[k][1]))[0]; return d.loc; }
    function nearestOn(d, p) { const { P, cum } = d.loc; let bs = 0, bd = 1e18, side = 0; for (let i = 0; i < P.length - 1; i++) { const ax = P[i][0], az = P[i][1], dx = P[i + 1][0] - ax, dz = P[i + 1][1] - az, l2 = dx * dx + dz * dz || 1e-9, u = clamp(((p[0] - ax) * dx + (p[1] - az) * dz) / l2, 0, 1), qx = ax + dx * u, qz = az + dz * u, dd = Math.hypot(p[0] - qx, p[1] - qz); if (dd < bd) { bd = dd; bs = cum[i] + Math.sqrt(l2) * u; side = dx * (p[1] - az) - dz * (p[0] - ax); } } return [bs, bd, side]; }
    function pointAt(d, s) { const { P, cum, L } = d.loc; s = clamp(s, 0, L); let i = 0; while (i < P.length - 2 && cum[i + 1] < s) i++; const l = cum[i + 1] - cum[i] || 1, u = (s - cum[i]) / l, tx = (P[i + 1][0] - P[i][0]) / l, tz = (P[i + 1][1] - P[i][1]) / l; return { x: P[i][0] + (P[i + 1][0] - P[i][0]) * u, z: P[i][1] + (P[i + 1][1] - P[i][1]) * u, tx, tz, s }; }
    /* the deck's height in local y, s metres along it. Within rampA of its start (rampB of its end) the deck is moved to meet the ground at that end, the move fading out along the ramp:
       on the terrain the difference is small; on the flat world it is the whole height of the abutment */
    function deckY(d, s, x, z) { const lc = d.loc, L = lc.L; let y = yOf(d.prof(s, L, lc.K), 0); const rA = terr() && d.rampAT != null ? d.rampAT : d.rampA, rB = terr() && d.rampBT != null ? d.rampBT : d.rampB;
      if (rA && s < rA) { const e = lc.P[0]; y += (gy(e[0], e[1]) + 0.12 - yOf(d.prof(0, L, lc.K), 0)) * (1 - smoothstep(0, rA, s)); } else if (rB && s > L - rB) { const e = lc.P[lc.P.length - 1]; y += (gy(e[0], e[1]) + 0.12 - yOf(d.prof(L, L, lc.K), 0)) * (1 - smoothstep(0, rB, L - s)); } return y; }
    let geoKey = '';
    const geoNow = () => S.gen + '/' + S.lat0 + '/' + S.lon0 + '/' + (terr() ? S.y0 : 'flat');
    function relocate() { DECKS.forEach(d => { d.loc = null; }); }
    /* the deck under or over a point: its height in local y, or null. o.lower: the lower of two decks where there are two; o.info: return { y, name, half, s } */
    X.deckAt = (x, z, o) => { if (!X.on || !S.kx) return null; for (const d of DECKS) { if (d.flatOnly && terr()) continue; const lc = d.loc || locate(d), b = lc.bb; if (x < b[0] || x > b[2] || z < b[1] || z > b[3]) continue; const n = nearestOn(d, [x, z]); if (n[1] > d.half + 0.75) continue; if ((n[0] <= 0.01 || n[0] >= lc.L - 0.01) && n[1] > 2) { const e = pointAt(d, n[0]); if (Math.abs((x - e.x) * e.tx + (z - e.z) * e.tz) > 1) continue; }
        const y = deckY(d, n[0], x, z) - (o && o.lower && d.lower ? d.lower : 0); return o && o.info ? { y, name: d.name, half: d.half, s: n[0], lower: d.lower || 0 } : y; } return null; };
    S.deckAt = X.deckAt;
    /* samples along a deck every `step` metres (and at its corners), each with its side direction */
    function samples(d, step, s0, s1) { const lc = d.loc || locate(d); s0 = s0 == null ? 0 : s0; s1 = s1 == null ? lc.L : s1; const cut = [s0, s1]; lc.cum.forEach(c => { if (c > s0 && c < s1) cut.push(c); }); for (let s = s0 + step; s < s1; s += step) cut.push(s); cut.sort((a, b) => a - b); const out = []; let last = -1;
      cut.forEach(s => { if (s - last < 0.5) return; last = s; const p = pointAt(d, s); p.y = deckY(d, s, p.x, p.z); out.push(p); });
      out.forEach((p, i) => { const a = out[Math.max(0, i - 1)], b = out[Math.min(out.length - 1, i + 1)], l = Math.hypot(b.x - a.x, b.z - a.z) || 1; p.nx = -(b.z - a.z) / l; p.nz = (b.x - a.x) / l; }); return out; }
    const ROAD = [0.17, 0.17, 0.18, 0], CONC = [0.7, 0.69, 0.66, 0], LINEW = [0.86, 0.86, 0.82, 0];
    /* a strip between two offsets from the line, at a height below the deck; `flip` turns its face down */
    const strip = (B, sm, o0, o1, dy, col, flip) => { for (let i = 0; i < sm.length - 1; i++) { const a = sm[i], b = sm[i + 1]; B.quad([a.x + a.nx * o0, a.y + dy, a.z + a.nz * o0], [b.x + b.nx * o0, b.y + dy, b.z + b.nz * o0], [b.x + b.nx * o1, b.y + dy, b.z + b.nz * o1], [a.x + a.nx * o1, a.y + dy, a.z + a.nz * o1], [0, flip ? -1 : 1, 0], null, col); } };
    /* a wall along the line at an offset, from dy0 to dy1 below or above the deck, facing the side `out` (+1 or -1) */
    const wall = (B, sm, off, dy0, dy1, col, out) => { for (let i = 0; i < sm.length - 1; i++) { const a = sm[i], b = sm[i + 1]; B.quad([a.x + a.nx * off, a.y + dy0, a.z + a.nz * off], [b.x + b.nx * off, b.y + dy0, b.z + b.nz * off], [b.x + b.nx * off, b.y + dy1, b.z + b.nz * off], [a.x + a.nx * off, a.y + dy1, a.z + a.nz * off], [a.nx * out, 0, a.nz * out], null, col); } };
    /* a roadway: surface, edge lines, kerb rails, and a box under it (half width hb, depth t) */
    function roadway(B, sm, half, o) { o = o || {}; strip(B, sm, -half, half, 0, ROAD); strip(B, sm, -0.15, 0.15, 0.04, o.mid || [0.8, 0.66, 0.12, 0]); [-1, 1].forEach(s => { strip(B, sm, s * (half - 1.1) - 0.1, s * (half - 1.1) + 0.1, 0.04, LINEW); wall(B, sm, s * half, -(o.slab || 1), 1.0, o.rail || CONC, s); wall(B, sm, s * (half - 0.3), 0, 1.0, o.rail || CONC, -s); strip(B, sm, s * (half - 0.3), s * half, 1.0, o.rail || CONC); });
      const hb = o.hb == null ? half : o.hb, t = o.t || 2, sl = o.slab || 1; if (hb < half) { strip(B, sm, -half, -hb, -sl, o.under || CONC, true); strip(B, sm, hb, half, -sl, o.under || CONC, true); } [-1, 1].forEach(s => wall(B, sm, s * hb, -t, -sl, o.box || CONC, s)); strip(B, sm, -hb, hb, -t, o.box || CONC, true); }
    /* a pier under a sample: two columns and a cap, from the ground (or the water) up to the underside */
    function pier(B, p, top, o) { o = o || {}; const g = Math.min(gy(p.x, p.z), top - 1) - 1.5, gap = o.gap || 4.2, w = o.w || 2.4, l = o.l || 3.2, col = o.col || CONC, P = (off, y, al) => [p.x + p.nx * off + p.tx * (al || 0), y, p.z + p.nz * off + p.tz * (al || 0)]; if (top - g < 3) return;
      [-1, 1].forEach(s => { SH.beam(B, P(s * gap, g), P(s * gap, top - 2.2), 1, 1, col); const k = [P(s * gap - w / 2, 0, -l / 2), P(s * gap + w / 2, 0, -l / 2), P(s * gap + w / 2, 0, l / 2), P(s * gap - w / 2, 0, l / 2)], mid = P(s * gap, (g + top) / 2); for (let i = 0; i < 4; i++) { const a = k[i], b = k[(i + 1) % 4]; SH.face(B, [[a[0], g, a[2]], [b[0], g, b[2]], [b[0], top - 2.2, b[2]], [a[0], top - 2.2, a[2]]], col, mid); } });
      SH.beam(B, P(-gap - w / 2, top - 1.1), P(gap + w / 2, top - 1.1), l, 2.2, col); if (o.arch && top - g > 14) [-1, 1].forEach(s => SH.beam(B, P(s * (gap - w / 2), top - 2.2 - Math.min(9, (top - g) * 0.3)), P(s * 0.6, top - 2.4), l * 0.8, 1.3, col)); }

    /* ---------- sites: things that stand still, built when the camera is near and thrown away when it is far or the origin moves ---------- */
    const SITES = [];
    function site(name, lat, lon, reach, make) { const s = { name, lat, lon, reach, make, built: false, ents: [], meshes: [], sets: [], prisms: [], note: '' }; SITES.push(s); return s; }
    function drop(s) { if (s.onDrop) s.onDrop(); s.ents.forEach(e => e.destroy()); s.meshes.forEach(m => m.dispose()); s.sets.forEach(k => { k.e.destroy(); k.ib.dispose(); if (k.own) k.mesh.dispose(); }); s.prisms.forEach(p => phys.removePrism(p)); s.ents = []; s.meshes = []; s.sets = []; s.prisms = []; s.lamps = null; s.built = false; }
    const solid = (s, B, name, mat) => { if (B.empty) return null; const mesh = build(B, name), e = scene.createEntity(name, { parent: root, transient: true }), mr = e.add('MeshRenderer'); mr.mesh = mesh; mr.material = mat || MAT.paint; mr.pickable = false; s.ents.push(e); s.meshes.push(mesh); return e; };
    const sset = (s, name, B, mat, o) => { const k = set(name, build(B, name), mat || MAT.paint, o); k.own = true; s.sets.push(k); return k; };
    /* where a point of a ship (x to port, z forward) is in the world, for a ship at (px, pz) heading hdg */
    const shipAt = (px, pz, hdg) => { const h = hdg * RDG, hx = Math.sin(h), hz = -Math.cos(h), yaw = Math.atan2(hx, hz), c = Math.cos(yaw), sn = Math.sin(yaw); return { yaw, hdg, px, pz, pt: (x, z) => [px + c * x + sn * z, pz - sn * x + c * z] }; };
    const prism = (s, ring, y0, y1, what) => { try { s.prisms.push(phys.addPrism(ring, y0, y1, { id: null, sky: what })); } catch (e) { /* the view is no worse for a ship that is not solid */ } };

    /* ---- the Navy in San Diego Bay ---- */
    const NV = DATA.navy || {};
    X.NAVY = { carrier: NV.carrier || null, classes: { carrier: { name: 'Nimitz class aircraft carrier', L: SH.CARRIER.L, B: SH.CARRIER.B }, ddg: { name: 'Arleigh Burke class destroyer', L: 155.3, B: 20, deck: 5.5 }, lcs: { name: 'Independence class littoral combat ship', L: 127, B: 32, deck: 9.5 }, lha: { name: 'America / Wasp class amphibious assault ship', L: 257, B: 32, deck: 19.8 } }, pierHalf: 9, ships: [] };
    if (NV.carrier) site('Naval Base Coronado and Naval Base San Diego', 32.695, -117.16, 32000, s => {
      const C = NV.carrier, cp = toL(C.lat, C.lon), cs = shipAt(cp[0], cp[1], C.hdg), wy = yOf(0, 0), K = SH.CARRIER; X.NAVY.ships = [];
      const car = sset(s, 'Aircraft carrier at the North Island quay', SH.carrier(MeshBuilder), MAT.paint, { shadow: 1500, far: 40000 }); car.ib.add(cp[0], wy, cp[1], cs.yaw, 1, 1, 1, 1, 1, 1, 1); prism(s, K.outline.map(p => cs.pt(p[0], p[1])), wy - 1, wy + K.deck, 'carrier'); prism(s, [[-36.5, -57], [-26.5, -57], [-26.5, -23], [-36.5, -23]].map(p => cs.pt(p[0], p[1])), wy, wy + K.deck + 21, 'island');
      X.NAVY.ships.push({ cls: 'carrier', lat: C.lat, lon: C.lon, hdg: C.hdg, at: 'North Island quay' });
      /* a few aircraft on the deck (generated: in her home port a carrier's air wing is ashore, so the deck is nearly empty) */
      const hor = sset(s, 'Aircraft on the flight deck', SH.hornet(MeshBuilder), MAT.paint, { shadow: 500, far: 12000 }), H2 = helSets(); H2.still.ib.clear(); H2.stillR.ib.clear(); s.onDrop = () => { H2.still.ib.clear(); H2.stillR.ib.clear(); };
      [[-30, 8, 55], [-30, -6, 55], [-29, -64, 120], [-29, -78, 120], [12, 128, 200], [-11, 140, 160]].forEach(a => { const q = cs.pt(a[0], a[1]); hor.ib.add(q[0], wy + K.deck, q[1], Math.atan2(Math.sin((C.hdg + a[2]) * RDG), -Math.cos((C.hdg + a[2]) * RDG)), 1, 1, 1, 1, 1, 1, 1); });
      const park = (x, z, y, hdg) => { const yw = Math.atan2(Math.sin(hdg * RDG), -Math.cos(hdg * RDG)); H2.still.ib.add(x, y, z, yw, 1, 1, 1, 1, 1, 1, 1); H2.stillR.ib.add(x, y + H2.hub, z, yw + 0.5, 1, 1, 1, 1, 1, 1, 1); };
      [[26, -60, 20], [27, -84, 20]].forEach(a => { const q = cs.pt(a[0], a[1]); park(q[0], q[1], wy + K.deck, C.hdg + a[2]); });
      (NV.helipads || []).forEach((h, i) => { if (i % 2 === 0 && i > 1) { const q = toL(h[0], h[1]); park(q[0], q[1], gy(q[0], q[1]), 20 + i * 37); } });
      /* ships at the numbered piers of Naval Base San Diego: destroyers and littoral combat ships, two assault ships (generated: which, where, how many) */
      const B1 = { ddg: sset(s, 'Destroyers at the 32nd Street piers', SH.destroyer(MeshBuilder), MAT.paint, { shadow: 700, far: 30000, cap: 16 }), lcs: sset(s, 'Littoral combat ships at the piers', SH.lcs(MeshBuilder), MAT.paint, { shadow: 700, far: 30000, cap: 16 }), lha: sset(s, 'Amphibious assault ships at the piers', SH.assault(MeshBuilder), MAT.paint, { shadow: 1200, far: 30000, cap: 4 }) }, CL = X.NAVY.classes;
      (NV.piers || []).forEach(pr => { const n = pr[0], a = toL(pr[1], pr[2]), c = toL(pr[3], pr[4]), len = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1, ux = (c[0] - a[0]) / len, uz = (c[1] - a[1]) / len, hdgOut = (Math.atan2(ux, -uz) / RDG + 360) % 360;
        [-1, 1].forEach(sd => { let cur = len - 12, slot = 0; while (cur > 60 && slot < 4) { const u = hsh(n, sd + 2, slot, 7), big = slot === 0 && ((n === 13 && sd === 1) || (n === 12 && sd === -1)), cls = big ? 'lha' : hsh(n, sd + 2, slot, 9) < 0.58 ? 'ddg' : 'lcs', K2 = CL[cls]; if (cur - K2.L < 20) break;
          if (big || u < 0.66) { const mid = cur - K2.L / 2, off = sd * (X.NAVY.pierHalf + K2.B / 2 + 2), px = a[0] + ux * mid - uz * off, pz = a[1] + uz * mid + ux * off, hdg = hsh(n, sd + 2, slot, 11) < 0.5 ? hdgOut : (hdgOut + 180) % 360, sp = shipAt(px, pz, hdg); B1[cls].ib.add(px, wy, pz, sp.yaw, 1, 1, 1, 1, 1, 1, 1);
            prism(s, [[-K2.B / 2, -K2.L / 2], [K2.B / 2, -K2.L / 2], [K2.B / 2, K2.L * 0.36], [0, K2.L / 2], [-K2.B / 2, K2.L * 0.36]].map(p => sp.pt(p[0], p[1])), wy - 1, wy + K2.deck, cls); X.NAVY.ships.push({ cls, pier: n, side: sd, lat: S.lat0 - pz / S.ky, lon: S.lon0 + px / S.kx, hdg }); }
          cur -= K2.L + 22; slot++; } }); });
      /* patrol boats at the Amphibious Base's piers on the Silver Strand (generated) */
      const pb = sset(s, 'Boats at the Naval Amphibious Base', SH.boat(MeshBuilder, 'patrol'), MAT.paint, { shadow: 300, far: 9000, cap: 24 });
      (NV.nab || []).forEach((pr, i) => { const a = toL(pr[0], pr[1]), c = toL(pr[2], pr[3]), len = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1, ux = (c[0] - a[0]) / len, uz = (c[1] - a[1]) / len; for (let k = 0; k < 3; k++) { if (hsh(i, k, 3, 5) < 0.3) continue; const sd = k % 2 ? 1 : -1, m = len * (0.25 + 0.25 * k), off = sd * 10.5; pb.ib.add(a[0] + ux * m - uz * off, wy, a[1] + uz * m + ux * off, Math.atan2(ux, uz) + (hsh(i, k, 4, 5) < 0.5 ? 0 : Math.PI), 1, 1, 1, 1, 1, 1, 1); } });
      s.note = X.NAVY.ships.length + ' ships';
    });

    /* ---- bridges ---- */
    const susp = (B, d, sm, c) => {   /* towers, main cables and suspenders of a suspension bridge over the deck d; c: see the calls below */
      const lc = d.loc, sT = c.towers.map(k => lc.K[k]), top = yOf(c.top, 0), wy = yOf(0, 0), off = c.cable, col = c.col, ends = [sT[0] - c.side[0], sT[sT.length - 1] + c.side[1]], yAt = s => { const p = pointAt(d, s); return deckY(d, s, p.x, p.z); };
      const cab = s => { if (s <= sT[0]) { const u = (s - ends[0]) / (sT[0] - ends[0]); return lerp(yAt(ends[0]) + 1.5, top, u) - 4 * (c.sideSag || 5) * u * (1 - u); } if (s >= sT[sT.length - 1]) { const u = (ends[1] - s) / (ends[1] - sT[sT.length - 1]); return lerp(yAt(ends[1]) + 1.5, top, u) - 4 * (c.sideSag || 5) * u * (1 - u); } for (let i = 0; i < sT.length - 1; i++) if (s <= sT[i + 1]) { const u = (s - sT[i]) / (sT[i + 1] - sT[i]), low = yAt((sT[i] + sT[i + 1]) / 2) + (c.clear || 3); return top - 4 * (top - low) * u * (1 - u); } return top; };
      const cs = sm.filter(p => p.s >= ends[0] - 0.01 && p.s <= ends[1] + 0.01); [-1, 1].forEach(sd => { for (let i = 0; i < cs.length - 1; i++) { const a = cs[i], b = cs[i + 1]; SH.beam(B, [a.x + a.nx * sd * off, cab(a.s), a.z + a.nz * sd * off], [b.x + b.nx * sd * off, cab(b.s), b.z + b.nz * sd * off], c.thick || 1, c.thick || 1, col); }
        for (let s = ends[0] + c.every; s < ends[1]; s += c.every) { if (sT.some(t => Math.abs(s - t) < c.every * 0.6)) continue; const p = pointAt(d, s), nx = -p.tz, nz = p.tx, y0 = deckY(d, s, p.x, p.z), y1 = cab(s); if (y1 - y0 < 2) continue; const x = p.x + nx * sd * off, z = p.z + nz * sd * off, w = c.rope || 0.28; B.quad([x - p.tx * w, y0, z - p.tz * w], [x + p.tx * w, y0, z + p.tz * w], [x + p.tx * w, y1, z + p.tz * w], [x - p.tx * w, y1, z - p.tz * w], [nx * sd, 0, nz * sd], null, col); B.quad([x - p.tx * w, y0, z - p.tz * w], [x + p.tx * w, y0, z + p.tz * w], [x + p.tx * w, y1, z + p.tz * w], [x - p.tx * w, y1, z - p.tz * w], [-nx * sd, 0, -nz * sd], null, col); } });
      sT.forEach(st => { const p = pointAt(d, st), nx = -p.tz, nz = p.tx, yd = deckY(d, st, p.x, p.z), P = (o2, y, al) => [p.x + nx * o2 + p.tx * (al || 0), y, p.z + nz * o2 + p.tz * (al || 0)];
        c.legs.forEach(L => { const y0 = L[0] == null ? wy - 2 : yOf(L[0], 0), y1 = yOf(L[1], 0); [-1, 1].forEach(sd => { const k = [P(sd * off - L[2] / 2, 0, -L[3] / 2), P(sd * off + L[2] / 2, 0, -L[3] / 2), P(sd * off + L[2] / 2, 0, L[3] / 2), P(sd * off - L[2] / 2, 0, L[3] / 2)], mid = P(sd * off, (y0 + y1) / 2); for (let i = 0; i < 4; i++) { const a = k[i], b = k[(i + 1) % 4]; SH.face(B, [[a[0], y0, a[2]], [b[0], y0, b[2]], [b[0], y1, b[2]], [a[0], y1, a[2]]], col, mid); } SH.face(B, [[k[0][0], y1, k[0][2]], [k[1][0], y1, k[1][2]], [k[2][0], y1, k[2][2]], [k[3][0], y1, k[3][2]]], col, mid); }); });
        (c.struts || []).forEach(k => SH.beam(B, P(-off, yOf(k[0], 0)), P(off, yOf(k[0], 0)), k[2] || 5, k[1], col)); (c.cross || []).forEach(k => { SH.beam(B, P(-off, yOf(k[0], 0)), P(off, yOf(k[1], 0)), k[2] || 2, k[2] || 2, col); SH.beam(B, P(off, yOf(k[0], 0)), P(-off, yOf(k[1], 0)), k[2] || 2, k[2] || 2, col); });
        if (c.base) B.box(p.x, wy + c.base[2] / 2 - 1, p.z, c.base[0] / 2, c.base[2] / 2 + 1, c.base[1] / 2, Math.atan2(nx, nz), CONC); void yd; });
    };
    /* San Diego-Coronado Bridge: 200 ft (61 m) clear over the channel, 4.67 per cent up from Coronado, the 80 degree curve (its mapped line), blue girders on tall concrete piers */
    if (BR.cor) { const c = BR.cor, D1 = deck({ name: 'San Diego-Coronado Bridge', pts: c.line, half: 10.2, marks: { ch: c.channel }, rampA: 260, rampB: 400, rampAT: 60, rampBT: 120, crest: 69, low: [6, 12],
      prof: (s, L, K) => { const k = 2.5, mn = (a, b) => -k * Math.log(Math.exp(-a / k) + Math.exp(-b / k)), top = 69.5, up = 6 + 0.0467 * s, dn = 12 + (top - 12) * (L - s) / Math.max(1, L - (K.ch + 150)); return mn(mn(up, top), dn); } });
      site('San Diego-Coronado Bridge', 32.692, -117.153, 30000, s => { const sm = samples(D1, 14), B = new MeshBuilder(), BLUE = [0.16, 0.37, 0.62, 0], K = D1.loc.K, L = D1.loc.L; roadway(B, sm, D1.half, { hb: 4.6, t: 5.4, slab: 1.1, box: BLUE, under: BLUE, rail: CONC });
        const gap = 98, k0 = Math.ceil((40 - K.ch) / gap); for (let s2 = K.ch + k0 * gap; s2 < L - 30; s2 += gap) { const p = pointAt(D1, s2); p.nx = -p.tz; p.nz = p.tx; pier(B, p, deckY(D1, s2, p.x, p.z) - 5.4, { gap: 4.2, w: 2.6, l: 3.4, arch: true }); }
        solid(s, B, 'San Diego-Coronado Bridge'); s.note = 'crest ' + D1.crest + ' m, ' + Math.round(L) + ' m of mapped bridge'; }); }
    /* Golden Gate Bridge: towers 746 ft (227 m) above the water, 4,200 ft (1,280 m) between them, side spans 1,125 ft (343 m), 90 ft (27 m) wide, roadway about 246 ft up at the towers, International Orange */
    if (BR.gg) { const g = BR.gg, ORANGE = [0.94, 0.29, 0.02, 0], D1 = deck({ name: 'Golden Gate Bridge', pts: g.line, half: 13.5, marks: { S: g.towers[0], N: g.towers[1] }, rampAT: 40, rampBT: 40, prof: (s, L, K) => { if (K.t === undefined) K.t = tbl([[0, 67], [K.S, 75], [K.S + 320, 77.7], [(K.S + K.N) / 2 - 150, 78.8], [(K.S + K.N) / 2, 79], [(K.S + K.N) / 2 + 150, 78.8], [K.N - 320, 77.7], [K.N, 75], [L, 73]]); return K.t(s); } });
      const A1 = deck({ name: 'Golden Gate Bridge, south approach', pts: g.south.slice().reverse(), half: 14, flatOnly: true, rampA: 860, prof: () => 67 }), A2 = deck({ name: 'Golden Gate Bridge, north approach', pts: g.north, half: 14, flatOnly: true, rampB: 860, prof: () => 73 });
      site('Golden Gate Bridge', 37.8199, -122.4786, 45000, s => { const sm = samples(D1, 15.24), B = new MeshBuilder(); roadway(B, sm, D1.half, { hb: 13.5, t: 7.6, slab: 1, box: ORANGE, rail: ORANGE, under: ORANGE });
        susp(B, D1, sm, { towers: ['S', 'N'], top: 227, side: [343, 343], cable: 13.7, col: ORANGE, every: 15.24, thick: 1.1, rope: 0.3, clear: 3, sideSag: 6, legs: [[null, 75, 10, 16.5], [75, 122, 9.4, 14.5], [122, 162, 8.4, 12.5], [162, 195, 7.4, 10.8], [195, 227, 6.4, 9.2]], struts: [[66, 7, 6], [122, 8, 6], [162, 7, 5.5], [195, 6.5, 5], [223, 7, 5]], cross: [[12, 60, 2.6]], base: [50, 30, 10] });
        solid(s, B, 'Golden Gate Bridge'); if (!terr()) { const B2 = new MeshBuilder(); [A1, A2].forEach(a => roadway(B2, samples(a, 20), a.half, { hb: 9, t: 3, box: CONC })); solid(s, B2, 'Golden Gate Bridge approaches (flat world only)'); } s.note = 'towers ' + Math.round(D1.loc.K.N - D1.loc.K.S) + ' m apart'; }); }
    X.decks = DECKS; X.sites = SITES; X.tools = { flat: () => !terr(), deck, site, samples, roadway, susp, pier, strip, wall, solid, sset, pointAt, deckY, locate, yOf, gy, toL, shipAt, prism, set, build, lamp, pose, at, tbl, ROAD, CONC };

    /* ---------- every frame ---------- */
    let tick = 0, lastT = 0;
    /* cam: the camera's position; o: { night 0..1, moving, on } . Returns true when something of it moved (the world then asks for another frame). */
    X.update = (dt, cam, o) => {
      o = o || {}; if (o.on != null && o.on !== X.on) X.set(o.on); if (!X.on || !S.ok) return false;
      const key = geoNow(); if (key !== geoKey) { geoKey = key; relocate(); SITES.forEach(s => { if (s.built) drop(s); }); tick = 0; lastT = 0; }
      if (tick++ % 20 === 0 || X.dirty) { X.dirty = false; let made = false; for (const s of SITES) { const q = toL(s.lat, s.lon), d = Math.hypot(q[0] - cam[0], q[1] - cam[2]); if (s.built && d > s.reach * 1.25) drop(s); else if (!s.built && d < s.reach && !made && !S.fast) { try { s.make(s); s.built = true; } catch (e) { s.built = true; s.note = 'not built: ' + (e && e.message || e); if (H.onError) H.onError(s.name, e); } made = true; need(2); } } X.stats.sites = SITES.filter(s => s.built).length; if (made) X.dirty = true; }
      const t = X.now(); if (!o.moving && lastT) return false; lastT = t; const night = o.night || 0;
      { const cv = engine.canvas || (dev.gl && dev.gl.canvas), hpx = (cv && (cv.clientHeight || cv.height)) || 800; X.lampK = clamp(2.6 * Math.tan((engine.camera.fov || 65) * RDG / 2) / hpx, 0.0008, 0.006); }   /* a lamp is never drawn smaller than about a pixel and a third across, however far it is */
      try { drawFlights(t, cam, night); const nh = drawHelos(t, cam, night); if (X.extra) X.extra(t, cam, night); return X.stats.flights + nh + X.stats.boats > 0; } catch (e) { if (!X.err) { X.err = String(e && e.stack || e); if (H.onError) H.onError('flights', e); } return false; }
    };
    X.set = on => { X.on = !!on; root.setActive(X.on); if (!X.on) { SITES.forEach(s => { if (s.built) drop(s); }); for (const k in FLEET) { FLEET[k].body.ib.clear(); FLEET[k].gear.ib.clear(); FLEET[k].plan.ib.clear(); } LAMPS.ib.clear(); X.stats.flights = 0; } else { X.dirty = true; lastT = 0; } need(3); return X.on; };
    /* the nearest airport, the runways in use, what is in the air; and what of the harbour and the bridges is built */
    X.info = () => { const cam = engine.camera.entity.transform.position, ll = S.kx ? camLL(cam) : [0, 0], i = MD.info(X.now(), ll[0], ll[1]) || {}; i.on = X.on; i.drawn = X.stats.flights; i.helicopters = X.stats.helos; i.boats = X.stats.boats; i.built = SITES.filter(s => s.built).map(s => s.name + (s.note ? ' (' + s.note + ')' : '')); i.bridges = DECKS.filter(d => !d.flatOnly).map(d => d.name); i.clock = new Date(X.now() * 1000).toISOString(); i.error = X.err || null;
      i.what = { real: 'runway ends, approach paths and glide angles, flights an hour by hour of the day, aircraft sizes and approach speeds, the carrier berth, pier and bridge lines, tower positions, ship and bridge dimensions', generated: 'every individual flight and its colours, which ships lie at which pier, aircraft on the carrier deck, the helicopter circuit, boats, the high traffic and its contrails' }; return i; };
    X.state = () => ({ on: X.on, flights: X.stats.flights, helicopters: X.stats.helos, boats: X.stats.boats, sites: X.stats.sites });
    if (typeof SkyKitMore === 'function') { try { SkyKitMore(X, engine, S, DATA, MAT); } catch (e) { X.err = 'second part: ' + (e && e.stack || e); } }
    return X;
  }
  SE.SkyKit = SkyKit;
