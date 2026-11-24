"""Integration edit 5 on CA/build/finish_engine.py: the street build is spread over frames.
   Replaces the earlier timers block. python3 -I e5_spread.py"""
import os
HERE = os.path.dirname(os.path.abspath(__file__))
p = os.path.join(HERE, '..', '..', '..', 'build', 'finish_engine.py')
s = open(p, encoding='utf-8').read()
i0 = s.index("# ---- integration: what a street build costs")
i1 = s.index("open(out, 'w', encoding='utf-8').write(s)\n")
new = r'''# ---- integration: the street build, spread over frames ----
# A street map came in as one piece of work, 0.3 to 1.1 s on real terrain (the roads cut to the ground's triangles, the
# sidewalks and curbs, the mesh builds): a stop of that length every few hundred metres of driving. Now what the rest of the
# world reads (the street network, the traffic's lanes, the parked cars, the signals, S.graph) is still set at once, and the
# drawn part (road ribbons, paint, sidewalks, curbs, crossings) is written a few milliseconds a frame into new meshes of a few
# hundred pieces each; the old meshes stand until the new ones are whole. en.world.roadCost says what it cost.
if "tf().regrade();" in s and "S.terr.drapeQuad(Sd, a, b, c, e, y1, uv, K.WHITE, CX)" in s:
    # StreetKit: the sidewalks, curbs and markings as a list of pieces to write, at once or through X.pump
    sub("    function clear() { parts.forEach(p => { p.e.destroy(); if (p.mesh) p.mesh.dispose(); if (p.ib) p.ib.dispose(); }); parts = [];",
        "    let geoOld = [], later = null; const dropParts = list => list.forEach(p => { p.e.destroy(); if (p.mesh) p.mesh.dispose(); if (p.ib) p.ib.dispose(); });\n"
        "    /* keepGeo: the sidewalks and markings now shown stay up (geoOld) until X.pump has written their successors; ones a build had not finished are dropped */\n"
        "    function clear(keepGeo) { later = null; if (keepGeo) geoOld = geoOld.concat(parts.filter(p => p.geo && !p.fresh)); else { dropParts(geoOld); geoOld = []; } dropParts(parts.filter(p => !(keepGeo && p.geo && !p.fresh))); parts = [];")
    sub("{ parent, transient: true }); clear(); NET = network(roads); TR.setNetwork(NET); if (!o.life) { group.setActive(false); return; } group.setActive(true);",
        "{ parent, transient: true }); clear(!!o.spread && !!o.life); NET = network(roads); TR.setNetwork(NET); if (!o.life) { group.setActive(false); return; } group.setActive(true); const todo = [];")
    sub("      const Sd = new MeshBuilder({ aux: true }), Pt = new MeshBuilder(), CX = [0, 0, 0, K.LAYER.concrete],", "      let Sd = new MeshBuilder({ aux: true }), Pt = new MeshBuilder(); const CX = [0, 0, 0, K.LAYER.concrete],")
    sub("        spans.forEach(([d0, d1]) => { const line = S.terr ? S.terr.dense(piece(w, d0, d1), 12) : piece(w, d0, d1);\n",
        "        spans.forEach(([d0, d1]) => { todo.push(() => { const line = S.terr ? S.terr.dense(piece(w, d0, d1), 12) : piece(w, d0, d1);\n")
    sub("\n          /* cars at the curb: on one side of a residential street", " });\n          /* cars at the curb: on one side of a residential street")
    sub("          const bar = (d0, d1, a, b, col) => { const q = (d, sd2) => [n.x + dx * d + rt[0] * sd2, 0.117, n.z + dz * d + rt[1] * sd2]; if (S.terr) S.terr.drapeQuad(Pt, q(d0, a), q(d1, a), q(d1, b), q(d0, b), 0.117, null, col, null); else Pt.quad(q(d0, a), q(d1, a), q(d1, b), q(d0, b), [0, 1, 0], null, col); };",
        "          const bx = dx, bz = dz, bar = (d0, d1, a, b, col) => todo.push(() => { const q = (d, sd2) => [n.x + bx * d + rt[0] * sd2, 0.117, n.z + bz * d + rt[1] * sd2]; if (S.terr) S.terr.drapeQuad(Pt, q(d0, a), q(d1, a), q(d1, b), q(d0, b), 0.117, null, col, null); else Pt.quad(q(d0, a), q(d1, a), q(d1, b), q(d0, b), [0, 1, 0], null, col); });")
    sub("      if (!Sd.empty) add('Sidewalks and curbs', Sd.build(dev, { name: 'sidewalks', clusters: 320 }), M.side); if (!Pt.empty) add('Crosswalks and lane lines', Pt.build(dev, { name: 'markings', clusters: 320 }), M.paint);\n",
        "      /* the sidewalks, curbs and markings: written piece by piece, at once or (o.spread) a little each frame through X.pump */\n"
        "      const flush = fresh => { [[Sd, 'Sidewalks and curbs', 'sidewalks', M.side], [Pt, 'Crosswalks and lane lines', 'markings', M.paint]].forEach(([b, name, nm, mat]) => { if (b.empty) return; add(name, b.build(dev, { name: nm, clusters: 320 }), mat, { geo: true, fresh }); if (fresh && geoOld.length) parts[parts.length - 1].e.setActive(false); }); Sd = new MeshBuilder({ aux: true }); Pt = new MeshBuilder(); };\n"
        "      if (o.spread) later = { todo, i: 0, n: 0, flush }; else { todo.forEach(f => f()); flush(false); }\n")
    sub("    /* ---------- every frame: signals change, the traffic takes a step, and the cars are sorted into near and far ---------- */\n",
        "    /* a few milliseconds of the sidewalks and markings a build left to be written; true while there is more */\n"
        "    X.pump = ms => { const L = later; if (!L) return false; const t0 = performance.now(); while (L.i < L.todo.length && performance.now() - t0 < ms) { L.todo[L.i++](); if (++L.n >= 260) { L.n = 0; L.flush(true); break; } }\n"
        "      if (L.i < L.todo.length) return true; L.flush(true); parts.forEach(q => { if (q.fresh) { q.fresh = false; q.e.setActive(true); } }); dropParts(geoOld); geoOld = []; later = null; return false; };\n"
        "    /* ---------- every frame: signals change, the traffic takes a step, and the cars are sorted into near and far ---------- */\n")
    # the world: buildRoads sets what is read at once and leaves the drawn part to roadPump
    a = "    function buildRoads() {\n"; b = "    async function loadRoads() {"
    assert s.count(a) == 1 and s.count(b) == 1
    j0, j1 = s.index(a), s.index(b); old = s[j0:j1]
    for need in ("tf().regrade();", "TERR.center(S.x, S.z);",
                 "S.roads.forEach(r => { if (r.up) return; const spec = K.ROADW[r.kind] || K.ROADW.street; K.ribbon(Bd, r.pts, r.w || spec[0], spec[1], spec[2]); if (r.kind === 'major' && !gfx.life) { K.ribbon(Pt, r.pts, 0.11, 0.115, null, 0.12, yel); K.ribbon(Pt, r.pts, 0.11, 0.115, null, -0.12, yel); K.ribbon(Pt, r.pts, 0.12, 0.115, null, 5.4, wht); K.ribbon(Pt, r.pts, 0.12, 0.115, null, -5.4, wht); } });",
                 "ST.build(S.roads, root, { life: gfx.life, center: [S.x, S.z], blocked: (x, z) => phys.prismsIn(x, z, x, z, []).some(p => Poly.contains(p.ring, x, z)), cars: tf().streetCars() });",
                 "S.graph = S.roads.filter(r => WALK.has(r.kind)); S.on = null; S.roadsVer++; S.roadTV = terrRoadVer(); lamps(); planSoon(); need();"):
        assert old.count(need) == 1, ('buildRoads is not as the integration expects', need[:70])
    s = s[:j0] + """    /* The street build. What the rest of the world reads of a new street map is set at once: the heights of the decks (the traffic kit), the
       street life's network with its traffic, parked cars and signals, the graph a walker follows, the lamp posts. The drawn part (the road
       ribbons cut to the ground, the paint, the sidewalks, curbs and crossings) is written by roadPump a few milliseconds a frame into new
       meshes, a few hundred pieces to a mesh, and the meshes that were there stand until the new ones are whole: a street map that comes in
       while driving no longer stops the picture. The first build after a move of the origin, and any build asked for with atOnce, is done whole. */
    let roadJob = null, roadGenAt = -1;
    function buildRoads(atOnce) {
      const rc0 = performance.now(); tf().regrade();   /* the decks' heights over the ground as it now is (the traffic kit) */
      TERR.center(S.x, S.z);   /* the streets near here are cut to the ground's triangles; the far ones are laid whole */
      if (roadJob) roadJob.parts.forEach(p => { p.e.destroy(); p.mesh.dispose(); });   /* a build that had not finished is dropped */
      const spread = atOnce !== true && roadParts.length > 0 && roadGenAt === S.gen, job = roadJob = { parts: [], spread, ms: 0, slices: 0, budget: 8 }; roadGenAt = S.gen; job.it = roadSteps(job, S.roads);
      /* what stands and moves on the streets: sidewalks, crossings, signals, parked cars, traffic (generated, not observed) */
      const rc1 = performance.now(); ST.build(S.roads, root, { life: gfx.life, center: [S.x, S.z], blocked: (x, z) => phys.prismsIn(x, z, x, z, []).some(p => Poly.contains(p.ring, x, z)), cars: tf().streetCars(), spread });
      S.graph = S.roads.filter(r => WALK.has(r.kind)); S.on = null; S.roadsVer++; S.roadTV = terrRoadVer(); const rc2 = performance.now(); lamps(); planSoon(); need();
      { const n = performance.now(), c = S.roadCost || (S.roadCost = { n: 0, worst: 0, sum: 0, worstSlice: 0 }); c.n++; job.ms = n - rc0; c.atOnce = job.ms; c.grade = rc1 - rc0; c.street = rc2 - rc1; c.lamps = n - rc2; c.spread = spread; if (job.ms > c.worstSlice) c.worstSlice = job.ms; }
      if (!spread) roadPump(1e9);
    }
    function* roadSteps(job, roads) {
      const yel = K.hexRGB('#e0b13c'), wht = K.hexRGB('#e9e7e0'); let Bd = new MeshBuilder({ aux: true }), Pt = new MeshBuilder(), k = 0;
      const flush = () => { [['Asphalt and concrete', Bd, M.road], ['Paint', Pt, M.paint]].forEach(([name, b, mat]) => { if (b.empty) return; const mesh = b.build(dev, { name, clusters: 320 }), e = scene.createEntity(name, { parent: gRoads, transient: true }), mr = e.add('MeshRenderer'); mr.mesh = mesh; mr.material = mat; mr.castShadow = false; mr.pickable = false; if (job.spread) e.setActive(false); job.parts.push({ e, mesh }); }); Bd = new MeshBuilder({ aux: true }); Pt = new MeshBuilder(); };
      for (const r of roads) { if (r.up) continue; const spec = K.ROADW[r.kind] || K.ROADW.street; K.ribbon(Bd, r.pts, r.w || spec[0], spec[1], spec[2]); if (r.kind === 'major' && !gfx.life) { K.ribbon(Pt, r.pts, 0.11, 0.115, null, 0.12, yel); K.ribbon(Pt, r.pts, 0.11, 0.115, null, -0.12, yel); K.ribbon(Pt, r.pts, 0.12, 0.115, null, 5.4, wht); K.ribbon(Pt, r.pts, 0.12, 0.115, null, -5.4, wht); }
        if (++k % 10 === 0) { if (k % 220 === 0) flush(); yield; } }
      flush(); yield;
      while (ST.pump && ST.pump(job.budget)) yield;
    }
    /* once a frame while a build is under way: `ms` milliseconds of it */
    function roadPump(ms) {
      const job = roadJob; if (!job) return; const t0 = performance.now(); job.budget = ms; let done = false; while (!done && performance.now() - t0 < ms) done = job.it.next().done;
      const spent = performance.now() - t0, c = S.roadCost; job.ms += spent; job.slices++; if (c && ms < 1e8 && spent > c.worstSlice) c.worstSlice = spent;
      if (done) { roadParts.forEach(p => { p.e.destroy(); p.mesh.dispose(); }); roadParts = job.parts; roadParts.forEach(p => p.e.setActive(true)); roadJob = null; if (c) { c.ms = job.ms; c.slices = job.slices; c.sum += job.ms; if (job.ms > c.worst) c.worst = job.ms; } }
      need();
    }
""" + s[j1:]
    # the frame's share: a third of the frame's time, between 6 and 60 ms
    sub("      carIdle(dt); placeCamera(); pump();", "      if (roadJob) roadPump(clamp(dt * 300, 6, 60)); carIdle(dt); placeCamera(); pump();")
'''
s = s[:i0] + new + s[i1:]
open(p, 'w', encoding='utf-8').write(s)
print('ok')
