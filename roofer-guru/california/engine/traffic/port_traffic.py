"""Traffic job: California traffic in the Scout Engine. Reads an engine file and writes it back with
  (1) the new code (aadt_table.js + traffic_core.js + traffic_kit.js, packed as traffic_engine.js) set in before StreetKit,
  (2) the surface-street traffic (Traffic) taught lanes and one-way from the map, limits by road, levels (a bridge and the
      street under it no longer block each other), a spatial grid (a step costs the same per car at any fleet size), the
      user's car and other actors as moving obstacles, signal cycles by city and hour, and density by the hour,
  (3) StreetKit and the world wired to the new kit (SE.TrafficKit): tiled, cached street loading; freeways and ramps built
      and run by the kit; per-road widths; signals where the map has them.
Every anchor must occur exactly once. Anchors are kept short and away from the terrain job's lines where that is possible;
the three that sit on lines the terrain job may also touch are marked SHARED below and matched loosely.

  python3 -I port_traffic.py <in.js> <out.js>"""
import os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
s = open(sys.argv[1], encoding='utf-8').read()
kit = ''.join(open(os.path.join(HERE, f), encoding='utf-8').read() for f in ('aadt_table.js', 'traffic_core.js', 'traffic_kit.js'))
open(os.path.join(HERE, 'traffic_engine.js'), 'w', encoding='utf-8').write(kit)
def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (s.count(a), a[:110])
    s = s.replace(a, b)
def cut(a, b, new):
    global s
    assert s.count(a) == 1 and s.count(b) == 1, (s.count(a), s.count(b), a[:60], b[:60])
    i, j = s.index(a), s.index(b); assert i < j
    s = s[:i] + new + s[j:]
def rex(pat, new, why):
    global s
    n = len(re.findall(pat, s))
    assert n == 1, (why, n)
    s = re.sub(pat, new, s)

# ---- (1) the new code ----
MARK = "  /* ==== rooftop scout on the engine: the street's furniture and its traffic ==== */\n"
rep(MARK, kit + MARK)

# ---- (2) Traffic: the surface streets ----
# helpers: a grid of the cars, the deck under a car, lane-kilometres near a point  [Traffic, top]
rep("    const right = (hx, hz) => [-hz, hx], LANE_W = 3.05, CELL = 16, SHORT = 11,",
    """    /* California: the cars are kept in a grid of 32 m squares, so each looks only at those near it; nearList's answer is one shared list, read before it is asked again */
    const GC = 32, gk = (i, j) => (i * 73856093) ^ (j * 19349663), NL = [];
    function grid(cars) { const G = new Map(); for (const c of cars) { if (c.out) continue; const k = gk(Math.floor(c.x / GC), Math.floor(c.z / GC)); let a = G.get(k); if (!a) G.set(k, a = []); a.push(c); } return G; }
    function nearList(x, z, r) { if (!T.G) return T.cars; NL.length = 0; const i0 = Math.floor((x - r) / GC), i1 = Math.floor((x + r) / GC), j0 = Math.floor((z - r) / GC), j1 = Math.floor((z + r) / GC); for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const a = T.G.get(gk(i, j)); if (a) for (const o of a) NL.push(o); } return NL; }
    /* how high the road stands over the ground at a distance along a way (a bridge, or the rise to one) */
    const dkAt = (w, d) => { const Hh = w.r.dk; if (!Hh || !w.r.own) return 0; const A = w.acc; let i = 1; while (i < A.length - 1 && A[i] < d) i++; const t = clamp((d - A[i - 1]) / (A[i] - A[i - 1] || 1), 0, 1); return Hh[i - 1] + (Hh[i] - Hh[i - 1]) * t; };
    function laneKm(near) { let m = 0; for (const w of T.driveWays) { const P = w.r.pts, nl = w.lanes[1].length + w.lanes[-1].length; for (let i = 1; i < P.length; i++) { if (near && Math.hypot((P[i][0] + P[i - 1][0]) / 2 - near[0], (P[i][1] + P[i - 1][1]) / 2 - near[1]) > near[3]) continue; m += (w.acc[i] - w.acc[i - 1]) * nl; } } return m / 1000; }
    const right = (hx, hz) => [-hz, hx], LANE_W = 3.05, CELL = 16, SHORT = 11,""")
# lanes, direction, limit and level from the road itself  [Traffic.setNetwork]
cut("      T.ways.forEach(w => { if (!w.drive) return; const major = w.r.kind === 'major';\n", "      T.zones = []; T.nodes.forEach(n => { n.zone = { occ: [], queue: [] };",
    """      T.ways.forEach(w => { if (!w.drive) return; const r = w.r, major = r.kind === 'major', ow = !!r.ow, nL = r.ln || (major ? 4 : 2);
        w.ps = major || ow || nL > 2 ? 0 : (hash01('p' + w.ri + ':' + Math.round(w.len)) < 0.5 ? 1 : -1);          /* which side of a street the cars park on */
        /* lanes from the map: all one way on a one-way street; else split between the two directions. Lane 0 is by the centre line (or the left kerb of a one-way street), the last is by the right kerb */
        if (major || ow || nL > 2) { const f = ow ? nL : Math.max(1, Math.ceil(nL / 2)), b = ow ? 0 : Math.max(1, nL - f), lw = Math.min(3.3, (w.hw * 2 - 0.8) / (f + b)), F1 = [], B1 = [];
          if (ow) for (let i = 0; i < f; i++) F1.push((i - (f - 1) / 2) * lw); else { for (let i = 0; i < f; i++) F1.push(lw * (i + 0.5)); for (let i = 0; i < b; i++) B1.push(-lw * (i + 0.5)); } w.lanes = { 1: F1, '-1': B1 }; }
        else w.lanes = w.ps > 0 ? { 1: [w.hw - 2.4 - 1.45], '-1': [w.hw - 2.4 - 4.35] } : { 1: [-(w.hw - 2.4) + 4.35], '-1': [-(w.hw - 2.4) + 1.45] };   /* a street: kerb, 2.4 m of parked cars, two 2.9 m lanes */
        w.limit = r.sp || (major ? 13.4 : 8.9); w.lv = r.lv || 0; w.stops = []; });
""")
rep("T.ways.forEach(w => { if (w.drive) w.dead = { 1: false, '-1': false }; });", "T.ways.forEach(w => { if (w.drive) w.dead = { 1: !w.lanes[1].length, '-1': !w.lanes[-1].length }; });   /* the wrong way down a one-way street is no way at all */")
# routes: never against a one-way street; turn lanes by position  [Traffic.extendOnce]
rep("if (!n) { /* nothing ahead (a broken map): turn round */", "if (!n) { if (!L.w.lanes[-L.dir].length) { L.exit = true; return null; } /* nothing ahead (a broken map): turn round */")
rep("if (l.w === L.w && d2 === -L.dir) continue;", "if (l.w === L.w && d2 === -L.dir) continue; if (!l.w.lanes[d2].length) continue;")
rep("const keep = opts.filter(o => (c.lane === 1 ? o.ang > -0.6 : o.ang < 0.6));", "const nl = L.w.lanes[L.dir].length, keep = opts.filter(o => (c.lane >= nl - 1 ? o.ang > -0.6 : c.lane === 0 ? o.ang < 0.6 : Math.abs(o.ang) < 0.6));")
rep("if (!pick && n.portal) { L.exit = true; return null; }", "if (!pick && (n.portal || !L.w.lanes[-L.dir].length)) { L.exit = true; return null; }")
rep("(pick.ang > 0.6 ? 1 : pick.ang < -0.6 ? 0 :", "(pick.ang > 0.6 ? lanes.length - 1 : pick.ang < -0.6 ? 0 :")
rep("vmax: clamp(Math.sqrt(2.4 * R), 2.8, 14), inW: L.w", "vmax: clamp(Math.sqrt(2.4 * R), 2.8, turn > 0.15 ? 14 : 24), inW: L.w")
rep("if (w.dead[dir] && !w.dead[-dir]) dir = -dir;", "if (w.dead[dir] && !w.dead[-dir]) dir = -dir; if (!w.lanes[dir].length) dir = -dir;")
rep("if (q.w.dead[q.dir] || q.n === c.leftAt) continue;", "if (q.w.dead[q.dir] || !q.w.lanes[q.dir].length || q.n === c.leftAt) continue;")
rep("c.stuck > (c.why === 1 && c.pend && c.pend.n && c.pend.n.signal ? 150 : 45)", "c.stuck > (T.cycle || 90) + (c.why === 1 && c.pend && c.pend.n && c.pend.n.signal ? 90 : 30)")   # a queue at a long red is not a breakdown
# cars: a height each (the deck under them); the grid in place of every scan of the whole fleet  [Traffic.place, freeAt, roomAt, populate, step]
rep("c.why = 0; c.blk = null; pose(c); }", "c.why = 0; c.blk = null; c.lv = w.lv || 0; c.dk = dkAt(w, d); pose(c); }")
rep("for (const o of T.cars) if (o !== self && Math.abs(o.x - x) < 9 && Math.abs(o.z - z) < 9 && overlap(x, z, hx, hz, hl + 1.5, hw + 0.4,", "for (const o of nearList(x, z, 16)) if (o !== self && Math.abs(o.dk - self.dk) < 3 && Math.abs(o.x - x) < 9 && Math.abs(o.z - z) < 9 && overlap(x, z, hx, hz, hl + 1.5, hw + 0.4,")
rep("for (const o of T.cars) if (o !== self && (o.v < 2.5 || o.crash > 0) &&", "for (const o of nearList(x, z, 16)) if (o !== self && Math.abs(o.dk - self.dk) < 3 && (o.v < 2.5 || o.crash > 0) &&")
rep("n = Math.min(n, Math.floor(T.total / 30));", "n = Math.min(n, Math.max(3, Math.round((T.dens || 10) * laneKm(near))));   /* cars per kilometre of lane, by the hour (SE.TrafficData.street) */")
rep("T.sigT = (T.sigT + dt) % 30; const ph = T.sigT; T.ns = ph < 12 ? 'g' : ph < 14 ? 'y' : 'r'; T.ew = ph < 15 ? 'r' : ph < 27 ? 'g' : ph < 29 ? 'y' : 'r';",
    "const CY = T.cycle || 90, gr = CY / 2 - 4; T.sigT = (T.sigT + dt) % CY; const ph = T.sigT; T.ns = ph < gr ? 'g' : ph < gr + 3 ? 'y' : 'r'; T.ew = ph < gr + 4 ? 'r' : ph < 2 * gr + 4 ? 'g' : ph < 2 * gr + 7 ? 'y' : 'r';   /* one synchronised cycle (90 to 120 s in Los Angeles: LADOT), a green, three seconds of yellow and a second of all red for each axis */")
rep("for (const b of T.bodies) extra.push(b);", "for (const b of T.bodies) extra.push(b); for (const b of (T.actors || [])) extra.push(b); T.G = grid(cars);")
rep("for (const o of cars) { if (o === c) continue; const dx = o.x - c.x, dz = o.z - c.z; if (dx * dx + dz * dz >= (reach + 8) * (reach + 8)) continue;",
    "for (const o of nearList(c.x, c.z, reach + 9)) { if (o === c || Math.abs(o.dk - c.dk) > 3) continue;   /* a road over or under this one is not in the way */ const dx = o.x - c.x, dz = o.z - c.z; if (dx * dx + dz * dz >= (reach + 8) * (reach + 8)) continue;")
rep("for (const o of c.near) { const dx = o.x - c.x, dz = o.z - c.z;", "if (c.dk < 2 && c.dk > -2) for (const o of c.near) { const dx = o.x - c.x, dz = o.z - c.z;")
rep("c.stuck = c.v < 0.1 ? c.stuck + dt : 0; c.why = why;", "if (!leg.k) { c.lv = leg.w.lv || 0; c.dk = dkAt(leg.w, leg.d0 + leg.dir * c.s); } c.stuck = c.v < 0.1 ? c.stuck + dt : 0; c.why = why;")
rep("for (let j = i + 1; j < cars.length; j++) { const o = cars[j]; if (!o.out && Math.abs(o.x - a.x) < 8 && Math.abs(o.z - a.z) < 8) hit(o, true); }",
    "for (const o of nearList(a.x, a.z, 14)) if (o.id > a.id && !o.out && Math.abs(o.dk - a.dk) < 3 && Math.abs(o.x - a.x) < 8 && Math.abs(o.z - a.z) < 8) hit(o, true);")
rep("for (const o of (a.near || [])) if (Math.abs(o.x - a.x) < 8", "if (a.dk < 2 && a.dk > -2) for (const o of (a.near || [])) if (Math.abs(o.x - a.x) < 8")
rep("      if (cam) for (const c of cars) { const lg = c.out ? null : c.legs[c.li];", "      T.G = null;   /* cars put down from here on look at the whole fleet, each other included */\n      if (cam) for (const c of cars) { const lg = c.out ? null : c.legs[c.li];")

# ---- (3) StreetKit ----
rep("hw: (K.ROADW[r.kind] || K.ROADW.street)[0] / 2, drive: DRIVE.has(r.kind)", "hw: (r.w || (K.ROADW[r.kind] || K.ROADW.street)[0]) / 2, drive: DRIVE.has(r.kind)")   # [network]
rep("n.signal = n.cross && n.major; n.r = n.hw + 1.2;", "n.signal = n.cross && (roads.sig ? roads.sig(n.x, n.z) : n.major); n.r = n.hw + 1.2;")   # [network] signals where the map has them
rep("const TT = TYPES.slice(); TT.pickType = typeOf; TT.pickPaint = r => pick(PAINT, r);",
    "const TT = TYPES.slice(); TT.push({ name: 'Transit bus', L: 12.2, W: 2.6, H: 3.1 }); TT.bus = 0; TT.pickType = r => (r < TT.bus ? TYPES.length : typeOf((r - TT.bus) / (1 - TT.bus))); TT.pickPaint = r => pick(PAINT, r);   /* a sixth kind, a 40 ft bus, drawn by SE.TrafficKit; TT.bus is its share of the street traffic */")
rep("const TR = Traffic(TT), phys = engine.physics; X.traffic = TR;", "const TR = Traffic(TT), phys = engine.physics; X.traffic = TR; X.CK = CK; X.TYPES = TYPES; X.PAINT = PAINT; X.TT = TT;")
rep("      NET.ways.forEach(w => { if (!w || !w.drive) return;\n        /* the stretches between crossings */", "      NET.ways.forEach(w => { if (!w || !w.drive || w.r.up) return;   /* a street on a bridge is built by SE.TrafficKit */\n        /* the stretches between crossings */")   # [X.build]
rep("if (w.r.kind === 'major') { K.ribbon(Pt, line, 0.11, 0.115, null, 0.12, yel);", "if (SE.streetPaint && SE.streetPaint(K, Pt, w, line, d0, d1, piece, shift, white, yel)) { /* lane lines by the map's lanes */ } else if (w.r.kind === 'major') { K.ribbon(Pt, line, 0.11, 0.115, null, 0.12, yel);")   # [X.build] SHARED with terrain if it re-heights paint
rep("const c = cars[i], t = TYPES[c.ty], b = carBodies[i];", "const c = cars[i], t = TT[c.ty], b = carBodies[i];")   # [X.update]
# [X.update] SHARED: where a moving car is placed. Whatever height expression stands there is replaced by SE.carPut, which
# puts the car on S.gy plus its deck and pitches it to the slope; a bus goes to the kit.
rex(r"fleet\[c\.ty\]\.sets\[dc < 55 \? 'mnear' : 'mfar'\]\.add\(c\.x, [^;]*?, c\.z, c\.yaw, 1, 1, 1, c\.col\[0\], c\.col\[1\], c\.col\[2\], c\.brake === 2 \? 0\.5 : c\.brake \? 0\.75 : 1\);",
    "if (c.ty >= TYPES.length) (X.bigCars || (X.bigCars = [])).push(c); else SE.carPut(fleet[c.ty].sets[dc < 55 ? 'mnear' : 'mfar'], S, c, c.brake === 2 ? 0.5 : c.brake ? 0.75 : 1);", 'moving car placement')

# ---- (3) the world ----
rep("const WALK = new Set(['street', 'major', 'alley', 'service']); let roadParts = [];",
    "const WALK = new Set(['street', 'major', 'alley', 'service']); let roadParts = [];\n    /* California traffic (SE.TrafficKit): made the first time the streets are set */\n    let TF = null; const tf = () => TF || (TF = SE.TrafficKit(engine, K, S, ST, env, gfx, { need: () => need(), note: m => note(m), root: () => root, replan: () => { S.roadsVer++; planSoon(); need(); }, retake: list => setRoads(list) }));")
rep("function setRoads(list) { S.roads = list.map(r => ({ name: r.name || '', kind: r.kind, pts: r.pts.map(([la, lo]) => toL(la, lo)) })).filter(r => r.pts.length >= 2); buildRoads(); }",
    "function setRoads(list) { S.roads = tf().take(list); buildRoads(); }   /* the surface streets, with lanes, direction, limit, level and width on each; freeways, ramps and cable car tracks stay with the kit */")
rep("function buildRoads() {\n", "function buildRoads() {\n      tf().regrade();   /* the decks' heights over the ground as it now is (the traffic kit) */\n")   # [buildRoads]
rep("S.roads.forEach(r => { const spec = K.ROADW[r.kind] || K.ROADW.street;", "S.roads.forEach(r => { if (r.up) return; const spec = K.ROADW[r.kind] || K.ROADW.street;")   # [buildRoads] a street on a bridge is the kit's
rex(r"K\.ribbon\(Bd, r\.pts, spec\[0\], ", "K.ribbon(Bd, r.pts, r.w || spec[0], ", 'road width per road')   # [buildRoads] SHARED
rep("cars: { ultra: 110, high: 80, medium: 45, low: 22 }[engine.quality] || 60 });", "cars: tf().streetCars() });")
rep("const list = await env.roads(la, lo, 560);", "const list = await tf().ask(la, lo);")   # [loadRoads]
rep("if (!S.fast && S.roadsAt && Math.hypot(S.x - S.roadsAt[0], S.z - S.roadsAt[1]) > 230) loadRoads();", "if ((!S.fast || (S.hero && S.hero.on)) && S.roadsAt && tf().stale()) loadRoads();")   # [after]
rep("moving = engine.playing && engine.awake && engine.live, onFoot", "moving = (S.hero && S.hero.on && engine.wake(), engine.playing && engine.awake && engine.live), onFoot")   # [update] the traffic stays awake while the car is driven
rep("if (ST.update(dt, cam.entity.transform.position, { night, moving,", "if (tf().update(dt, cam.entity.transform.position, { night, moving })) need(); if (ST.update(dt, cam.entity.transform.position, { night, moving,")
rep("S.roads.forEach((r, ri) => { if (r.kind !== 'street' && r.kind !== 'major') return; const w = (K.ROADW[r.kind] || K.ROADW.street)[0] / 2 + 1.1;", "S.roads.forEach((r, ri) => { if ((r.kind !== 'street' && r.kind !== 'major') || r.up) return; const w = (r.w || (K.ROADW[r.kind] || K.ROADW.street)[0]) / 2 + 1.1;")   # [lamps]

rep("S.roads.forEach(rd => { const w = (K.ROADW[rd.kind] || K.ROADW.street)[0]; g.lineWidth", "S.roads.concat((S.traffic && S.traffic.roads) || []).forEach(rd => { const w = rd.w || (K.ROADW[rd.kind] || K.ROADW.street)[0]; g.lineWidth")   # [the trees' mask] no trees on a freeway

open(sys.argv[2], 'w', encoding='utf-8').write(s)
print('wrote', sys.argv[2], len(s))
