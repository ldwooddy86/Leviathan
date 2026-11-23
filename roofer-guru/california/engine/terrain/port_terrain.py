"""California engine job "terrain": puts the Scout Engine's world on real ground.

Reads an engine file (CA/engine/la_engine.js, or the same with nothing else applied yet) and writes it with
  - the terrain kit (terrain_engine.js) and the carried relief grid (terrain_grid.js) set in before the world builder;
  - the world's wiring: the ground as height fields at every level, buildings lifted to their own floors, streets cut to
    the ground's triangles, trees, lamps, signs and cars on the ground, the physics ground, the camera, the drone and the
    craft, picking, labels, roof views, a datum that moves with the origin.
Every anchor must occur exactly the stated number of times (once unless said).

  python3 -I port_terrain.py <in.js> <out.js>
"""
import sys, os
HERE = os.path.dirname(os.path.abspath(__file__))
src, dst = sys.argv[1], sys.argv[2]
s = open(src, encoding='utf-8').read()
kit = open(os.path.join(HERE, 'terrain_engine.js'), encoding='utf-8').read()
grid = open(os.path.join(HERE, 'terrain_grid.js'), encoding='utf-8').read()
N = [0]
def rep(a, b, n=1):
    global s
    assert s.count(a) == n, ('anchor count', s.count(a), 'wanted', n, a[:120])
    s = s.replace(a, b); N[0] += 1
def cut(a, z, b):
    """replace from the start of anchor a up to (not including) anchor z"""
    global s
    assert s.count(a) == 1 and s.count(z) == 1, ('cut anchors', s.count(a), s.count(z), a[:80], z[:80])
    i, j = s.index(a), s.index(z); assert i < j
    s = s[:i] + b + s[j:]; N[0] += 1

# ---------------------------------------------------------------- the kit and the grid
HEAD = "  /* ==== rooftop scout on the engine: the neighborhood, streamed around the camera ==== */\n"
rep(HEAD, grid + "\n" + kit + HEAD)

# ---------------------------------------------------------------- physics: the ground is a height function (World.terrain), the plane stays the fallback
rep("""        if (this.ground && b.min[1] < this.groundY) {
          if (k === 'box') { for (const c of b.corners()) if (c[1] < this.groundY) out.push({ a: null, b, n: [0, 1, 0], p: [c[0], this.groundY, c[2]], depth: this.groundY - c[1], mu: this.groundFriction }); }
          else for (const c of (k === 'sphere' ? [b.pos] : segEnds(b))) { const d = this.groundY - (c[1] - b.shape.r); if (d > 0) out.push({ a: null, b, n: [0, 1, 0], p: [c[0], this.groundY, c[2]], depth: d, mu: this.groundFriction }); }
        }""",
"""        const TG = this.terrain || null;     /* the ground under each corner (terrain), or the one plane */
        if (this.ground && b.min[1] < (TG ? TG(b.pos[0], b.pos[2]) + 1 + (b.max[0] - b.min[0]) + (b.max[2] - b.min[2]) : this.groundY)) {
          if (k === 'box') { for (const c of b.corners()) { const gh = TG ? TG(c[0], c[2]) : this.groundY; if (c[1] < gh) out.push({ a: null, b, n: [0, 1, 0], p: [c[0], gh, c[2]], depth: gh - c[1], mu: this.groundFriction }); } }
          else for (const c of (k === 'sphere' ? [b.pos] : segEnds(b))) { const gh = TG ? TG(c[0], c[2]) : this.groundY, d = gh - (c[1] - b.shape.r); if (d > 0) out.push({ a: null, b, n: [0, 1, 0], p: [c[0], gh, c[2]], depth: d, mu: this.groundFriction }); }
        }""")
rep("if (b.pos[1] < this.groundY - 60) { b.pos[1] = this.groundY + 30; V3.set(b.vel, 0, 0, 0); }",
    "{ const gf = this.terrain ? this.terrain(b.pos[0], b.pos[2]) : this.groundY; if (b.pos[1] < gf - 60) { b.pos[1] = gf + 30; V3.set(b.vel, 0, 0, 0); } }")
rep("        if (this.ground && d[1] < -1e-6) hit((this.groundY - o[1]) / d[1], [0, 1, 0], { ground: true });\n",
"""        if (this.ground && !this.terrain) { if (d[1] < -1e-6) hit((this.groundY - o[1]) / d[1], [0, 1, 0], { ground: true }); }
        else if (this.ground) {   /* terrain: the first place the ray goes under the ground, found by steps that lengthen with distance, then halved in */
          const TG = this.terrain, lim = Math.min(max || 1e9, 12000), f = t => o[1] + d[1] * t - TG(o[0] + d[0] * t, o[2] + d[2] * t); let t0 = 0, f0 = f(0);
          while (f0 > 0 && t0 < lim) { const t1 = Math.min(lim, t0 + Math.max(1.5, t0 * 0.03, f0 * 0.3)), f1 = f(t1); if (f1 <= 0) { let a = t0, b = t1; for (let i = 0; i < 12; i++) { const m = (a + b) / 2; if (f(m) > 0) a = m; else b = m; } hit(b, [0, 1, 0], { ground: true }); break; } t0 = t1; f0 = f1; } }
""")
rep("floorAt(x, z, y, step) { let h = this.ground ? this.groundY : -Infinity;",
    "floorAt(x, z, y, step) { let h = this.ground ? (this.terrain ? this.terrain(x, z) : this.groundY) : -Infinity;")
# the walking character: stays on the ground going down a slope, and does not climb a face steeper than about 56 degrees
rep("const W = this.world, p = this.pos, r = this.radius, n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / (r * 0.6)));",
    "const W = this.world, p = this.pos, r = this.radius, n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / (r * 0.6))), TG = W.terrain || null, wasG = !this.fly && this.grounded && !jump;")
rep("          p[0] += dx / n; p[2] += dz / n; const near = W.prismsIn(p[0] - r, p[2] - r, p[0] + r, p[2] + r, this._near);",
    "          if (TG && wasG) { const rise = TG(p[0] + dx / n, p[2] + dz / n) - TG(p[0], p[2]); if (rise > 0.02 && rise > Math.hypot(dx, dz) / n * 1.5) continue; }\n"
    "          p[0] += dx / n; p[2] += dz / n; const near = W.prismsIn(p[0] - r, p[2] - r, p[0] + r, p[2] + r, this._near);")
rep("else if (!this.fly) this.grounded = p[1] - fl < 0.02;",
    "else if (!this.fly) { if (TG && wasG && this.vy <= 0 && p[1] - fl < 0.6) { p[1] = fl; this.vy = 0; this.grounded = true; } else this.grounded = p[1] - fl < 0.02; }")

# ---------------------------------------------------------------- the wall shader: height above the building's own floor, from the wall's uv
rep("seed = mod(code, 32.0), y = v_wpos.y, sA = v_aux.x,",
    "seed = mod(code, 32.0), wlay = floor(v_aux.w + 0.25), y = (wlay > 0.5 && wlay < 1.5 ? v_uv.x : v_uv.y) * (wlay < 0.5 ? 1.6 : wlay < 1.5 ? 2.4 : wlay < 2.5 ? 2.5 : 3.0) /* the height above the building's own floor: the wall's uv is that height over its texture's tile (brick 1.6, siding 2.4 and turned, stucco 2.5, the rest 3) */, sA = v_aux.x,")

# ---------------------------------------------------------------- WorldKit: a building's walls go down to the lowest ground under it
rep("    K.addBuilding = (B, b, o) => {\n      const rings = K.ringsOf(b); if (!rings.length) return null;",
    "    K.addBuilding = (B, b, o) => {\n      const rings = o.rings || K.ringsOf(b); if (!rings.length) return null; const y0f = o.foot || 0;     /* y0f: how far below the floor the walls go on (0 or less) */")
rep("wallQuad(a, c, 0, eave, eave);", "wallQuad(a, c, y0f, eave, eave);")
rep("wallQuad(a, c, 0, hRaw, hRaw);", "wallQuad(a, c, y0f, hRaw, hRaw);")
rep("ring(Wf, Wf, 0, 0.34, B.trim, TRIM.found, false);", "ring(Wf, Wf, y0f, 0.34, B.trim, TRIM.found, false);")
rep("B.glow.quad([a[0], 0, a[1]], [c[0], 0, c[1]], [c[0], sTop, c[1]], [a[0], sTop, a[1]],", "B.glow.quad([a[0], y0f, a[1]], [c[0], y0f, c[1]], [c[0], sTop, c[1]], [a[0], sTop, a[1]],")
rep("Bw.quad([a[0], 0, a[1]], [c[0], 0, c[1]], [c[0], h, c[1]], [a[0], h, a[1]], [dz / len, 0, -dx / len], [u(0, 0), u(len, 0), u(len, h), u(0, h)], tint, [A0, A1, A1, A0]);",
    "const ft = o.foot || 0; Bw.quad([a[0], ft, a[1]], [c[0], ft, c[1]], [c[0], h, c[1]], [a[0], h, a[1]], [dz / len, 0, -dx / len], [u(0, ft), u(len, ft), u(len, h), u(0, h)], tint, [A0, A1, A1, A0]);")
# streets: cut to the triangles of the ground (S.terr.drape), the line stepped every 12 m, the round joints at the line's own points only
rep("    K.ribbon = (Bd, pts, w, y, kind, offs, col) => {\n      const n = pts.length,",
    "    K.ribbon = (Bd, pts, w, y, kind, offs, col) => {\n      const TR0 = S.terr || null; if (TR0) pts = TR0.dense(pts, 12); const own = pts.own || null, n = pts.length,")
rep("Bd.quad(a, b, c, d, up, [uv(a), uv(b), uv(c), uv(d)], col || WHITE, AX); }",
    "if (TR0) TR0.drapeQuad(Bd, a, b, c, d, y, uv, col || WHITE, ax); else Bd.quad(a, b, c, d, up, [uv(a), uv(b), uv(c), uv(d)], col || WHITE, AX); }")
rep("if (!offs && kind) for (let i = 0; i < n; i++) { const p = pts[i]; for (let s = 0; s < 10; s++) {",
    "if (!offs && kind) for (let i = 0; i < n; i++) { if (own && !own[i]) continue; const p = pts[i]; for (let s = 0; s < 10; s++) {")
rep("Bd.tri(a, b, c, up, uv(a), uv(b), uv(c), WHITE, ax, ax, ax); } }",
    "if (TR0) TR0.drapeTri(Bd, a, b, c, y, uv, WHITE, ax); else Bd.tri(a, b, c, up, uv(a), uv(b), uv(c), WHITE, ax, ax, ax); } }")

# ---------------------------------------------------------------- StreetKit: what is built once per street map lies on the ground; cars' instances stand on it
rep("r.castShadow = sh > 0; r.shadowDistance = sh || 1; sets[k] = ib; });",
    "r.castShadow = sh > 0; r.shadowDistance = sh || 1; sets[k] = S.terr ? S.terr.onGround(ib, { len: t.L, wid: t.W }) : ib; });")
rep("spans.forEach(([d0, d1]) => { const line = piece(w, d0, d1);",
    "spans.forEach(([d0, d1]) => { const line = S.terr ? S.terr.dense(piece(w, d0, d1), 12) : piece(w, d0, d1);")
rep("Sd.quad(a, b, c, e, [0, 1, 0], [uv(a), uv(b), uv(c), uv(e)], K.WHITE, AX); const nx =",
    "if (S.terr) S.terr.drapeQuad(Sd, a, b, c, e, y1, uv, K.WHITE, CX); else Sd.quad(a, b, c, e, [0, 1, 0], [uv(a), uv(b), uv(c), uv(e)], K.WHITE, AX); const nx =")
rep("Sd.quad([a[0], y0, a[2]], [b[0], y0, b[2]], b, a, [nx / nl, 0, nz / nl], [[0, 0], [1, 0], [1, 0.05], [0, 0.05]], [0.86, 0.86, 0.86, 1], AX); } });",
    "if (S.terr) { const cu = S.terr.cuts(a[0], a[2], b[0], b[2]); for (let q = 0; q + 1 < cu.length; q++) { const p0 = cu[q], p1 = cu[q + 1]; Sd.quad([p0[0], p0[1] + y0 - 0.06, p0[2]], [p1[0], p1[1] + y0 - 0.06, p1[2]], [p1[0], p1[1] + y1, p1[2]], [p0[0], p0[1] + y1, p0[2]], [nx / nl, 0, nz / nl], [[0, 0], [1, 0], [1, 0.05], [0, 0.05]], [0.86, 0.86, 0.86, 1], AX); } }\n"
    "              else Sd.quad([a[0], y0, a[2]], [b[0], y0, b[2]], b, a, [nx / nl, 0, nz / nl], [[0, 0], [1, 0], [1, 0.05], [0, 0.05]], [0.86, 0.86, 0.86, 1], AX); } });")
rep("const bar = (d0, d1, a, b, col) => Pt.quad([n.x + dx * d0 + rt[0] * a, 0.117, n.z + dz * d0 + rt[1] * a], [n.x + dx * d1 + rt[0] * a, 0.117, n.z + dz * d1 + rt[1] * a], [n.x + dx * d1 + rt[0] * b, 0.117, n.z + dz * d1 + rt[1] * b], [n.x + dx * d0 + rt[0] * b, 0.117, n.z + dz * d0 + rt[1] * b], [0, 1, 0], null, col);",
    "const bar = (d0, d1, a, b, col) => { const q = (d, sd2) => [n.x + dx * d + rt[0] * sd2, 0.117, n.z + dz * d + rt[1] * sd2]; if (S.terr) S.terr.drapeQuad(Pt, q(d0, a), q(d1, a), q(d1, b), q(d0, b), 0.117, null, col, null); else Pt.quad(q(d0, a), q(d1, a), q(d1, b), q(d0, b), [0, 1, 0], null, col); };")
rep("if (n.signal) sig[TR.phase(n, dx, dz)].add(px, 0, pz, yaw, 1, 1, 1); else stops.add(px, 0, pz, yaw, 1, 1, 1);",
    "const py = S.gy ? S.gy(px, pz) : 0; if (n.signal) sig[TR.phase(n, dx, dz)].add(px, py, pz, yaw, 1, 1, 1); else stops.add(px, py, pz, yaw, 1, 1, 1);")

# ---------------------------------------------------------------- WideKit: the squares' ground from the terrain kit, their blocks and trees lifted
rep("    const DATA = new Map(), VER = new Map();",
    "    /* a block's floor (the highest ground under its corners) and how far down its walls go; and the lift of what a block wrote into a builder */\n"
    "    const baseOf = P => { let lo = Infinity, hi = -Infinity; for (const p of P) { const y = S.gy(p[0], p[1]); if (y < lo) lo = y; if (y > hi) hi = y; } return { lo, y: hi }; }, liftB = (Bd, from, dy) => { if (!dy) return; const a = Bd.p.a; for (let i = from + 1; i < Bd.p.n; i += 3) a[i] += dy; };\n"
    "    const DATA = new Map(), VER = new Map();")
cut("    function ground(t) { const r = t.rect, y0 = -1.1,", "    function dispose(t) {",
    "    function ground(t) { t.img = mosaic(t); t.mat = roofMat(t.img.tex); t.g = S.terr.ground(TZ, t.X, t.Y, { parent: group, mat: t.mat }); }\n")
rep("if (t.g) { t.g.e.destroy(); t.g.mesh.dispose(); t.g = null; }", "if (t.g) { S.terr.drop(t.g); t.g = null; }")
rep("      dispose(t); const feats = DATA.get(t.key) || [], r = t.rect,", "      if (t.g) S.terr.ensure(t.g); dispose(t); const feats = DATA.get(t.key) || [], r = t.rect,")
rep("by.forEach((list, key) => { const r0 = Br.tris, w0 = Bw.tris, bb = [1e9, 0, 1e9, -1e9, 0, -1e9];", "by.forEach((list, key) => { const r0 = Br.tris, w0 = Bw.tris, bb = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9];")
rep("const g = { P, h: f.h, cls: f.cls, id: f.id }; try { K.addContext(Bw, Br, g, uv, { noWalls: far && f.h < 7.5 }); } catch (e) { return; } n++;",
    "const g = { P, h: f.h, cls: f.cls, id: f.id }, gb = baseOf(P), pw = Bw.p.n, pr = Br.p.n; try { K.addContext(Bw, Br, g, uv, { noWalls: far && f.h < 7.5, foot: gb.lo - gb.y - 2 }); } catch (e) { return; } liftB(Bw, pw, gb.y); liftB(Br, pr, gb.y); n++;")
rep("bb[4] = Math.max(bb[4], f.h); });", "bb[1] = Math.min(bb[1], gb.lo - 2); bb[4] = Math.max(bb[4], gb.y + f.h); });")
rep("t.state = 'built'; t.builtFar = far;", "t.state = 'built'; t.builtFar = far; t.gv = t.g ? t.g.v : 0;")
rep("skyMask(); if (!t.treeList) findTrees(t); H.need(2);", "skyMask(); if (!t.treeList) findTrees(t); else t.treeDirty = true; H.need(2);")
rep("if (t.state === 'built' && far !== t.builtFar) { t.far = far;", "if (t.state === 'built' && (far !== t.builtFar || (t.g && t.gv !== t.g.v))) { t.far = far;")
rep("ib.add(q[0], 0, q[1], q[2] * TAU, rr * 2, hh, rr * 2,", "ib.add(q[0], S.gy(q[0], q[1]) - 0.3, q[1], q[2] * TAU, rr * 2, hh, rr * 2,")
rep("const r0 = Br.tris, w0 = Bw.tris, bb = [1e9, 0, 1e9, -1e9, f.h, -1e9]; K.addContext(Bw, Br, { P, h: f.h, cls: f.cls, id: f.id }, null, {});",
    "const gb = baseOf(P), pw = Bw.p.n, pr = Br.p.n, r0 = Br.tris, w0 = Bw.tris, bb = [1e9, gb.lo - 10, 1e9, -1e9, gb.y + f.h, -1e9]; K.addContext(Bw, Br, { P, h: f.h, cls: f.cls, id: f.id }, null, { foot: gb.lo - gb.y - 10 }); liftB(Bw, pw, gb.y); liftB(Br, pr, gb.y);")
rep("    W.debug = () => ({ on: W.on,", "    /* the ground far off has firmed up: the skyline is stood on it again */\n    W.grounded = () => { W.skySig = null; };\n    W.debug = () => ({ on: W.on,")

# ---------------------------------------------------------------- the Alta X: where the ground rises ahead of it, it climbs to stay 3 m over it (env.ground: the bare ground, without roofs)
rep("        st.yaw = (st.yaw + I.yaw * AS.yawRate * dt + 360) % 360;\n        /* lean to get the speed asked for",
    "        st.yaw = (st.yaw + I.yaw * AS.yawRate * dt + 360) % 360;\n"
    "        if (env.ground && st.mode !== 'Landing' && st.mode !== 'Taking off' && Math.hypot(st.vx, st.vz) > 0.5) { const ga = Math.max(env.ground(st.x + st.vx * 0.9, st.z + st.vz * 0.9), env.ground(st.x, st.z)); if (st.y < ga + 3) wantY = Math.max(wantY, Math.min(AS.climb, (ga + 3 - st.y) * 2.5)); }   /* rising ground ahead */\n"
    "        /* lean to get the speed asked for")
# ---------------------------------------------------------------- the craft: held between the ground and its ceiling above the ground
rep("ny = clamp(st.y + st.vy * dt, 0, AS.ceilingM);", "ny = clamp(st.y + st.vy * dt, floor, floor + AS.ceilingM);")
rep("if (ny < 90 && env.block(nx, nz, ny - 1)) {", "if (ny - floor < 90 && env.block(nx, nz, ny - 1)) {")

# ================================================================ the view
VIEW = r"""
    /* ---------- the real ground (SE.TerrainKit): elevation, the ground's meshes, S.gy ---------- */
    const TERR = SE.TerrainKit(engine, S, { env, rectOf, toLL, need, onData: () => terrData(), onGround: g => terrGround(g) }); phys.terrain = S.gy;
    /* A building's floor is level, just over the highest ground under its outline (asked every 4 m along it), so no wall, door or window is in the earth; its walls and its solid go down to the lowest (lo), as a house on a hill stands on its downhill foundation. */
    const BASE = new Map();
    const baseOf = rings => { let lo = Infinity, hi = -Infinity; const gy = S.gy; for (const P of rings) for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 4)); for (let q = 0; q < n; q++) { const y = gy(a[0] + (b[0] - a[0]) * q / n, a[1] + (b[1] - a[1]) * q / n); if (y < lo) lo = y; if (y > hi) hi = y; } } return { lo, hi, y: hi + 0.04 }; };
    const baseY = id => { if (id == null) return 0; if (BASE.has(id)) return BASE.get(id); const b = env.byId(id); if (!b) return 0; const rings = K.ringsOf(b); if (rings.length) return baseOf(rings).y; const q = toL(b.lat, b.lon); return S.gy(q[0], q[1]); };
    /* the flood's surface as a world height (the storm kit keeps a depth): the ground where the surge was asked for plus the depth; far under everything when there is no flood */
    const surgeY = () => (SK.now && SK.now.surge > 0 ? (S.surgeAt ? S.gy(S.surgeAt[0], S.surgeAt[1]) : 0) + SK.now.surge : -1e9);
    /* the ground the eye's height is measured from: in the street, the ground itself; from the air, eased toward it (quicker up than down), so the view does not heave over every rise */
    let gEye = 0, gEyeT = 0;
    const eyeGround = m => { const g = S.gy(S.x, S.z); if (m === 'street') { gEye = g; return g; } const now = performance.now(), dt = Math.min(0.25, (now - gEyeT) / 1000); gEyeT = now;
      if (Math.abs(g - gEye) > 500) gEye = g; else gEye += (g - gEye) * (1 - Math.exp(-dt * (g > gEye ? 7 : 2.5))); const least = g - HEIGHT[m].eye * 0.6; if (gEye < least) gEye = least; if (Math.abs(g - gEye) > 0.05) need(); else gEye = g; return gEye; };
    /* better elevation has arrived: what was stood on the old ground is stood again (cells and squares by their ground's version, the streets after a moment, the skyline last) */
    let terrRoadT = 0, terrSkyT = 0, terrWaitT = 0;
    const terrRoadVer = () => TERR.verOf({ x0: S.x - 600, x1: S.x + 600, zN: S.z - 600, zS: S.z + 600 }, 0);
    function terrData() { if (!S.ok) return; need(2); planSoon(); if (S.roads.length) { clearTimeout(terrRoadT); terrRoadT = setTimeout(() => { if (S.ok && S.roads.length && terrRoadVer() !== S.roadTV) buildRoads(); }, 500); } clearTimeout(terrSkyT); terrSkyT = setTimeout(() => { if (S.ok) { WIDE.grounded(); planSoon(); } }, 2500); }
    function terrGround(g) { need(2); if (g.z === 18 || g.z === 15) planSoon(); }
"""
rep("    const cellOf = (x, z, zz) => { const ll = toLL(x, z); return [Math.floor(lon2t(ll[1], zz || CZ)), Math.floor(lat2t(ll[0], zz || CZ))]; };\n",
    "    const cellOf = (x, z, zz) => { const ll = toLL(x, z); return [Math.floor(lon2t(ll[1], zz || CZ)), Math.floor(lat2t(ll[0], zz || CZ))]; };\n" + VIEW.lstrip('\n'))

# ---- the far ground: tiles of the terrain kit at zoom 17, 13, 10 and 7 (no sinking: a tile's runs are not drawn under finer ground)
rep("FARZ = [{ z: 17, reach: 760, y: -0.35, inner: 0 }, { z: 13, reach: 16000, y: -9, inner: 1 }, { z: 10, reach: 90000, y: -48, inner: 16000 }];",
    "FARZ = [{ z: 17, reach: 760 }, { z: 13, reach: 16000 }, { z: 10, reach: 90000 }, { z: 7, reach: 128000 }];")
cut("    function farTiles() {\n", "    { const e = scene.createEntity('Horizon',",
"""    function farTiles() {
      const want = new Set();
      FARZ.forEach(L => { if (S.fast && L.z === 17) return; const [cX, cY] = cellOf(S.x, S.z, L.z), r0 = rectOf(cX, cY, L.z), size = Math.abs(r0.x1 - r0.x0), n = Math.ceil(L.reach / size), lim = 1 << L.z;
        for (let dy = -n; dy <= n; dy++) for (let dx = -n; dx <= n; dx++) { const X = cX + dx, Y = cY + dy; if (X < 0 || Y < 0 || X >= lim || Y >= lim) continue; const r = rectOf(X, Y, L.z), dr = Math.hypot(Math.max(r.x0 - S.x, 0, S.x - r.x1), Math.max(r.zN - S.z, 0, S.z - r.zS)), key = L.z + '/' + X + '/' + Y;
          if (dr > L.reach * 1.1 + 60 || (dr > L.reach && !FAR.has(key))) continue; want.add(key); if (FAR.has(key)) continue;   /* a tile is made within reach and kept a little beyond it */
          const tex = dev.lazyTexture(env.tileURL(L.z, X, Y), { srgb: true, wrap: 'clamp', fill: [111, 119, 100, 255], onLoad: () => need() }), mat = new Material({ name: 'Far ground', albedoMap: tex, roughness: 0.95, castShadow: false, wet: 0 });
          FAR.set(key, { tex, g: TERR.ground(L.z, X, Y, { parent: gFar, mat }) }); } });
      FAR.forEach((f, key) => { if (!want.has(key)) { TERR.drop(f.g); f.tex.dispose(); FAR.delete(key); } });
    }
""")

# ---- cells
rep("+ S.roadsVer + 'w' + WIDE.dataVer(c.key); };", "+ S.roadsVer + 'w' + WIDE.dataVer(c.key) + 't' + (c.gnd ? c.gnd.v : 0); };")
rep(".join('|') + '#' + S.roadsVer;", ".join('|') + '#' + S.roadsVer + '#' + (c.gnd ? c.gnd.v : 0);")
rep("function dropCell(c) { disposeTrees(c); c.group.destroy();", "function dropCell(c) { disposeTrees(c); TERR.drop(c.gnd); c.gnd = null; c.group.destroy();")
rep("      own.b.quad([rect.x0, 0, rect.zN], [rect.x1, 0, rect.zN], [rect.x1, 0, rect.zS], [rect.x0, 0, rect.zS], [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]]);\n",
    "      /* the cell's ground: a tile of the terrain kit, with the cell's photograph; it stays while the cell's buildings are rebuilt */\n"
    "      if (!c.gnd || c.gnd.dead) c.gnd = TERR.ground(CZ, c.X, c.Y, { parent: c.group, mat: c.img.mat, shadow: true }); TERR.ensure(c.gnd);\n")
rep("      B.roofTri = (a, b, d, n) => {\n        if (inR(a)",
    "      B.roofTri = (a, b, d, n) => { const dy = B.dy || 0; if (dy) { a = [a[0], a[1] + dy, a[2]]; b = [b[0], b[1] + dy, b[2]]; d = [d[0], d[1] + dy, d[2]]; }   /* the roof of the building being written, lifted to its floor (copies: one point serves two triangles) */\n        if (inR(a)")
cut("      for (const b of all) { let g = null; try { g = K.addBuilding(B, b,", "      c.extra = nx;\n",
"""      /* Each building is written with heights from its own floor (the wall shader, the equipment and the roof views count on that), and what it wrote is then lifted to where its floor is: gb.y. The glow's pool lies on the ground under each of its corners. */
      const LIFT = [B.wall, B.trim, B.fine, B.glass, B.glow, B.equip];
      for (const b of all) { const rings = K.ringsOf(b); if (!rings.length) continue; const gb = baseOf(rings), at = LIFT.map(Bd => Bd.p.n); B.dy = gb.y; let g = null;
        try { g = K.addBuilding(B, b, { detail: c.detailWant, nearRoad: S.roads.length ? nearRoad : null, rings, foot: gb.lo - gb.y - 0.4 }); } catch (e) { g = null; }
        if (g && gfx.roofKit !== false) { try { HV.exterior(b, B.equip); } catch (e) { /* this one goes without */ } }
        LIFT.forEach((Bd, k) => { const P = Bd.p.a, X = Bd === B.glow ? Bd.x.a : null; for (let i = at[k]; i < Bd.p.n; i += 3) { if (X) { const ay = X[i / 3 * 4 + 1]; if (ay > 0.5 && ay < 1.5) { P[i + 1] = S.gy(P[i], P[i + 2]) + 0.17; continue; } } P[i + 1] += gb.y; } });
        B.dy = 0; if (!g) continue; n++; BASE.set(b.id, gb.y);
        g.rings.forEach(r => c.prisms.push(phys.addPrism(r.P, gb.lo - 1, gb.y + r.h, { id: b.id }))); if (b.extra) nx++; else c.labels.push({ id: b.id, x: g.cx, y: gb.y + g.top + 1.4, z: g.cz }); }
""")
rep("S.planCell = cX + '/' + cY; queue.length = 0;", "S.planCell = cX + '/' + cY; queue.length = 0; let terrW = false; clearTimeout(terrWaitT);")
rep("if (!c.built || c.sig !== sigOf(c)) queue.push(c); }", "if (!c.built && TERR.waiting(rect)) terrW = true;   /* a cell is first built when its elevation has come (or has not come in six seconds) */\n        else if (!c.built || c.sig !== sigOf(c)) queue.push(c); }")
rep("      WIDE.update(); farTiles(); need();\n    }", "      WIDE.update(); farTiles(); TERR.resort(); need(); if (terrW) terrWaitT = setTimeout(plan, 500);\n    }")
rep("    function pump() {\n      const t0 = performance.now(); let did = false;", "    function pump() {\n      let did = TERR.pump(queue.length ? 2.5 : 5, S.x, S.z); const t0 = performance.now();")
rep("ib.add(t.x, 0, t.z, j * TAU, t.r * 2, t.h, t.r * 2,", "t.y = S.gy(t.x, t.z); ib.add(t.x, t.y - 0.15, t.z, j * TAU, t.r * 2, t.h, t.r * 2,")

# ---- roof views
rep("RP.planes.forEach(pl => pl.tris.forEach(t => sub(t[0], t[1], t[2], pl.n, 0)));",
    "const by = baseY(b.id), up3 = p => [p[0], p[1] + by, p[2]]; RP.planes.forEach(pl => pl.tris.forEach(t => sub(up3(t[0]), up3(t[1]), up3(t[2]), pl.n, 0)));   /* the roof's planes come as heights from the floor: lifted here, so the shading and the mesh are in world heights */")
rep("if (tr.h > p[1] + 0.5 && Math.hypot(p[0] - tr.x, p[2] - tr.z) < tr.r * 0.95)", "if ((tr.y || 0) + tr.h > p[1] + 0.5 && Math.hypot(p[0] - tr.x, p[2] - tr.z) < tr.r * 0.95)")
rep("canopy: vn ? un / vn : 0, sig: String(Math.round(env.height(b) * 4)) };", "canopy: vn ? un / vn : 0, sig: String(Math.round(env.height(b) * 4)) + ':' + Math.round(by * 4) };")
rep("if (G && (G.sig !== String(Math.round(env.height(b) * 4)) || !treesSame(G)))", "if (G && (G.sig !== String(Math.round(env.height(b) * 4)) + ':' + Math.round(baseY(id) * 4) || !treesSame(G)))")
rep("z = oz + sd[2] * q; if (y > 70) break;", "z = oz + sd[2] * q; if (y > p[1] + 70) break;")
rep("cy = (0.66 * t.h - oy) * ky,", "cy = ((t.y || 0) + 0.66 * t.h - oy) * ky,")

# ---- the drone's and the craft's world starts from the ground
rep("const floorTop = (x, z) => { let top = 0;", "const floorTop = (x, z) => { let top = S.gy(x, z);")
rep("<span>AT <b>${ll[0].toFixed(4)}, ${ll[1].toFixed(4)}</b></span>", "<span>AT <b>${ll[0].toFixed(4)}, ${ll[1].toFixed(4)}</b></span><span>ELEV <b>${Math.round((a.y + S.y0) * 3.281).toLocaleString('en-US')} ft</b></span>")

# ---- streets: remember which elevation they were laid on; lamps on the ground
rep("S.graph = S.roads.filter(r => WALK.has(r.kind)); S.on = null; S.roadsVer++;", "S.graph = S.roads.filter(r => WALK.has(r.kind)); S.on = null; S.roadsVer++; S.roadTV = terrRoadVer();")
rep("LAMP.spots.push([x, z, Math.atan2(-dz * side, dx * side)]);", "LAMP.spots.push([x, z, Math.atan2(-dz * side, dx * side), S.gy(x, z)]);")
rep("LAMP.ib.add(s[0], 0, s[1], -s[2] + Math.PI / 2, 1, 1, 1)", "LAMP.ib.add(s[0], s[3], s[1], -s[2] + Math.PI / 2, 1, 1, 1)")
rep("e.transform.setPosition(s[0][0] + c * 1.35, 7.1, s[0][1] + sn * 1.35);", "e.transform.setPosition(s[0][0] + c * 1.35, s[0][3] + 7.1, s[0][1] + sn * 1.35);")

# ---- the camera
rep("cy = Math.max(0.6, (SK.now ? SK.now.surge : -9) + 0.8, Pn[1] + 2.5 - fy * d); cz = Pn[2] - fz * d; }",
    "cy = Pn[1] + 2.5 - fy * d; cz = Pn[2] - fz * d; cy = Math.max(S.gy(cx, cz) + 0.6, surgeY() + 0.8, cy); }   /* kept over the ground under the camera itself */")
rep("cam.near = S.uapCam === 'belly' && !W ? clamp(Pn[1] * 0.03, 0.4, 5) : 0.5;", "const aglU = Pn[1] - S.gy(Pn[0], Pn[2]); cam.near = S.uapCam === 'belly' && !W ? clamp(aglU * 0.03, 0.4, 5) : 0.5;")
rep("(Pn[1] > 600 ? 9 : Pn[1] > 90 ? 2.4 : 1.5)", "(aglU > 600 ? 9 : aglU > 90 ? 2.4 : 1.5)")
rep("cy = Math.max(0.35, a.y + 0.5 - fy * d); cz = a.z - fz * d; }", "cy = a.y + 0.5 - fy * d; cz = a.z - fz * d; cy = Math.max(S.gy(cx, cz) + 0.35, cy); }")
rep("cam.near = S.altaCam === 'payload' ? clamp(a.y * 0.03, 0.32, 3) : 0.3;", "const aglA = a.y - S.gy(a.x, a.z); cam.near = S.altaCam === 'payload' ? clamp(aglA * 0.03, 0.32, 3) : 0.3;")
rep("(a.y > 60 ? 2.2 : 1.5)", "(aglA > 60 ? 2.2 : 1.5)")
rep("eye = Math.max(0.6, o.at[1] - fy * o.dist);", "eye = Math.max(S.gy(S.x, S.z) + 0.6, o.at[1] - fy * o.dist);")
rep("else if (m === 'walk') eye = S.y + HEIGHT.walk.eye; else eye = HEIGHT[m].eye;", "else if (m === 'walk') eye = S.y + HEIGHT.walk.eye; else eye = eyeGround(m) + HEIGHT[m].eye;")
rep("{ const fl = SK.now ? SK.now.surge : -9; if (fl > 0 && eye < fl +", "{ const fl = surgeY(); if (fl > -1e8 && eye < fl +")
rep("cam.fov = S.fov; cam.near = clamp(eye * 0.03, 0.3, 5);", "cam.fov = S.fov; cam.near = clamp((eye - S.gy(S.x, S.z)) * 0.03, 0.3, 5);")
rep("fl = SK.now ? SK.now.surge : -9; UAP.update(", "fl = surgeY(); UAP.update(")
rep("ALTA.update(dt, { floor: (x, z) => Math.max(floorTop(x, z), SK.now ? SK.now.surge : -9),", "ALTA.update(dt, { ground: S.gy, floor: (x, z) => Math.max(floorTop(x, z), surgeY()),")
rep("e.transform.setPosition(c.x + hx * 2.4, 0.75, c.z + hz * 2.4);", "e.transform.setPosition(c.x + hx * 2.4, S.gy(c.x, c.z) + 0.75, c.z + hz * 2.4);")

# ---- outlines, labels, pointing
rep("R.setOutline('select', c ? [{ mesh: c }] : null); R.setOutline('hover', h ? [{ mesh: h }] : null);",
    "R.setOutline('select', c ? [{ mesh: c, world: M4.translation(M4.create(), 0, baseY(S.cur), 0) }] : null); R.setOutline('hover', h ? [{ mesh: h, world: M4.translation(M4.create(), 0, baseY(S.hov), 0) }] : null);")
rep("seen = !h || !h.prism || h.prism.userData.id === l.id;", "seen = !h || (h.prism ? h.prism.userData.id === l.id : !h.ground);   /* a hill in the way hides a label as a building does */")
rep("cam.project([o.x, 0.4, o.z])", "cam.project([o.x, S.gy(o.x, o.z) + 0.4, o.z])")
rep("UAP.goTo(q[0], q[1], Math.max(2.4, env.height(h.b)) + 30);", "UAP.goTo(q[0], q[1], baseY(h.b.id) + Math.max(2.4, env.height(h.b)) + 30);")

# ---- moves
rep("if (!b) return; const [x, z] = toL(b.lat, b.lon), h = Math.max(2.4, env.height(b));", "if (!b) return; const [x, z] = toL(b.lat, b.lon), h = Math.max(2.4, env.height(b)), by = baseY(b.id);")
rep("DEG * Math.atan2(h * 0.5 - a.y,", "DEG * Math.atan2(by + h * 0.5 - a.y,", 2)
rep("S.orbit.at = [x, h * 0.5, z]; S.orbit.dist = clamp(Math.max(h * 2.2, 34), 20, 400);", "S.orbit.at = [x, baseY(b.id) + h * 0.5, z]; S.orbit.dist = clamp(Math.max(h * 2.2, 34), 20, 400);", 2)
rep("pitch = clamp(DEG * Math.atan2(h * 0.55 - eye, d), -80, 45);", "pitch = clamp(DEG * Math.atan2(by + h * 0.55 - (S.gy(S.x, S.z) + eye), d), -80, 45);")
rep("UAP.place(S.x, S.z, S.yaw, Math.max(floorTop(S.x, S.z) + 34, was === 'metro' ? 900 : was === 'bird' ? 120 : 48));", "UAP.place(S.x, S.z, S.yaw, Math.max(floorTop(S.x, S.z) + 34, S.gy(S.x, S.z) + (was === 'metro' ? 900 : was === 'bird' ? 120 : 48)));")
rep("const y = Rd(S.yaw); S.orbit.at = [S.x + Math.sin(y) * 30, 3, S.z - Math.cos(y) * 30];", "const y = Rd(S.yaw), ox = S.x + Math.sin(y) * 30, oz = S.z - Math.cos(y) * 30; S.orbit.at = [ox, S.gy(ox, oz) + 3, oz];")
rep("S.y = phys.floorAt(S.x, S.z, 0, 0.5);", "S.y = phys.floorAt(S.x, S.z, S.gy(S.x, S.z), 0.5);")
rep("if (o) { S.x = o.x; S.z = o.z; } S.y = 0; } } }", "if (o) { S.x = o.x; S.z = o.z; } S.y = S.gy(S.x, S.z); } } }")

# ---- what the module is told
rep("function state() { const [la, lo] = toLL(S.x, S.z), r = roadAt(); return { lat: la, lon: lo,",
    "function state() { const [la, lo] = toLL(S.x, S.z), r = roadAt(), cp = cam.position, gh = S.gy(cp[0], cp[2]); return { elev: cp[1] + S.y0, agl: cp[1] - gh, ground: gh + S.y0, terrain: TERR.info(), lat: la, lon: lo,")
rep("mode: UAP.state.mode, alt: UAP.state.y,", "mode: UAP.state.mode, alt: UAP.state.y - S.gy(UAP.state.x, UAP.state.z), asl: UAP.state.y + S.y0,")
rep("mode: ALTA.state.mode, alt: ALTA.state.y,", "mode: ALTA.state.mode, alt: ALTA.state.y - S.gy(ALTA.state.x, ALTA.state.z), asl: ALTA.state.y + S.y0,")

# ---- a new origin: the datum moves with it, and every height that is kept moves by the difference
rep("FAR.forEach(f => { f.e.destroy(); f.mesh.dispose(); f.tex.dispose(); }); FAR.clear();", "FAR.forEach(f => { TERR.drop(f.g); f.tex.dispose(); }); FAR.clear();")
rep("solids.clear(); rectCache.clear();", "solids.clear(); rectCache.clear(); TERR.reset(); BASE.clear();")
rep("      S.lat0 = la; S.lon0 = lo; S.ky = mLat(la); S.kx = mLon(la); [S.x, S.z] = toL(keepLL[0], keepLL[1]);",
    "      { const y1 = TERR.datum(la, lo), dy = S.y0 - y1; S.y0 = y1; S.y += dy; gEye += dy; S.orbit.at[1] += dy; if (UAP) UAP.state.y += dy; if (ALTA) ALTA.state.y += dy; S.horizon.transform.setPosition(0, -y1 - 150, 0); }   /* local y = 0 is the new origin's height above the sea */\n"
    "      S.lat0 = la; S.lon0 = lo; S.ky = mLat(la); S.kx = mLon(la); [S.x, S.z] = toL(keepLL[0], keepLL[1]);")

# ---- the warp and the open: the elevation at the place is asked for at once; the craft is put down over the ground there
rep("      UAP.warp({ yaw, km,", "      TERR.prime(lat, lon);\n      UAP.warp({ yaw, km,")
rep("UAP.arriveAt(q[0], Math.max(floorTop(q[0], q[1]) + 34, 60), q[1]);", "UAP.arriveAt(q[0], Math.max(floorTop(q[0], q[1]) + 34, S.gy(q[0], q[1]) + 60), q[1]);")
rep("const far = !S.ok || Math.hypot(...toL(lat, lon)) > 9000; S.ok = true; if (far) recenter(lat, lon, [lat, lon]);", "TERR.prime(lat, lon); const far = !S.ok || Math.hypot(...toL(lat, lon)) > 9000; S.ok = true; if (far) recenter(lat, lon, [lat, lon]);")
rep("UAP.goTo(q2[0], q2[1], tb ? Math.max(2.4, env.height(tb)) + 34 : null);", "UAP.goTo(q2[0], q2[1], tb ? baseY(tb.id) + Math.max(2.4, env.height(tb)) + 34 : null);")
rep("UAP.place(S.x, S.z, yaw != null ? yaw : S.yaw, 60);", "UAP.place(S.x, S.z, yaw != null ? yaw : S.yaw, Math.max(floorTop(S.x, S.z) + 34, S.gy(S.x, S.z) + 60));")
rep("ALTA.place(S.x, S.z, yaw != null ? yaw : S.yaw, 0);", "ALTA.place(S.x, S.z, yaw != null ? yaw : S.yaw, floorTop(S.x, S.z));")
rep("const [x, z] = toL(lat, lon), s = cam.project([x, up, z]);", "const [x, z] = toL(lat, lon), s = cam.project([x, S.gy(x, z) + (up || 0), z]);")
rep("debug() { return { wide: WIDE.debug(),", "debug() { return { terrain: TERR.info(), wide: WIDE.debug(),")

open(dst, 'w', encoding='utf-8').write(s)
print('port_terrain: %d patches applied, %d -> %d bytes, written to %s' % (N[0], os.path.getsize(src), len(s.encode('utf-8')), dst))
