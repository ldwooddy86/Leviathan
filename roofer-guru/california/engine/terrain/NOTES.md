# terrain job notes (resume here)

Files: make_grid.py -> terrain_grid.js (embedded statewide relief, z6 pixels) ; terrain_engine.js (SE.TerrainKit) ;
port_terrain.py <in.js> <out.js> ; tests in tests/ ; shots in shots/.

Design (decided):
- Datum S.y0 = metres above sea level of local y = 0, set in recenter from best known height. S.gy(x,z) local y.
- Raster ladder: terrarium z14, 12, 10, 8, then embedded grid (z6 px, ~2 km). Sea clamped to 0 except inland boxes.
- The kit owns every ground mesh: T.ground(z, X, Y, {parent, mat}) for levels 18 (cell), 17, 15 (wide), 13, 10, 7.
  Each tile = C x C kids (child tiles), each kid an m x m grid; 2 runs per kid (surface, skirt). A kid's run is hidden
  while the finer tile over it is built. Levels 18 and 17 share one 8 m lattice (T.block), so no seam near the camera.
- S.gy = the drawn surface (finest built tile, triangle interpolation), raw raster where no tile.
- Streets: clipped to lattice triangles (T.drape). Buildings: floor at highest ground under footprint, walls to lowest.
- Wall shader: height above own floor from the wall uv.

Status: see bottom.

## Status log
- [ ] make_grid.py
- [ ] terrain_engine.js
- [ ] port_terrain.py
- [ ] tests
- [x] make_grid.py -> terrain_grid.js (399 KB base64, 4 m steps, run-length)
- [x] terrain_engine.js (kit) written, parses
- [x] port_terrain.py: 105 patches, all anchors matched on la_engine.js; out/engine_terrain.js parses; build/out/testbed_terrain.html built
- [ ] tests/lib.js, tests/t_core.js written; NOT YET RUN. Next: run at SF Filbert/Hyde (37.8002,-122.4186 ~ 80 m), LA, Lone Pine.
  build: python3 -I engine/terrain/port_terrain.py engine/la_engine.js engine/terrain/out/engine_terrain.js && python3 -I build/testbed.py engine/terrain/out/engine_terrain.js build/out/testbed_terrain.html
- [x] t_core at SF Filbert/Hyde PASSES (ground 86.6 vs 86.5 known; eye 1.7 agl; prisms below ground; no errors; shots/sf_filbert_street.png). Next: LA bird north, Lone Pine.
- [x] t_core PASSES at Los Angeles City Hall (93.0 vs 90.2) and Lone Pine (1136.0 vs 1136); Sierra on the skyline in shots/lonepine_whitney.png.

## REPORT SO FAR (if I am cut off, this is the hand-back)
Built: terrain_engine.js (SE.TerrainKit), terrain_grid.js (399 KB, from make_grid.py), port_terrain.py (105 anchored
patches, each asserted; applies cleanly to CA/engine/la_engine.js; output parses). Apply:
  python3 -I CA/engine/terrain/port_terrain.py CA/engine/la_engine.js <out.js>
Interface (on shared state S): S.gy(x,z) local y of drawn ground (0-safe); S.y0 datum (m above sea of y=0);
S.elevAt(lat,lon) m above sea; S.slopeAt(x,z) -> [dy/dx, dy/dz]; S.terr (kit: ground/drop/ensure/pump/drape/drapeTri/
drapeQuad/cuts/dense/onGround/gyL/block/prime/datum/elev/info/reset). en.state(): elev, agl, ground, terrain;
uap.alt and alta.alt are now above ground, with asl added. en.debug().terrain.
Functions touched by the port: Physics.World (_statics, step "fell out", raycast, floorAt), Physics.Character.move,
CHUNKS.facade (one declaration), WorldKit (K.addBuilding head + 4 literals, K.addContext wall quad, K.ribbon),
StreetKit (fleetInit sets[k]; X.build: line, sidewalk quad, curb quad, bar, signal/stop add), WideKit (ground, drop,
build, W.update one condition, fillTrees add, skyBuild, + W.grounded), UapKit U.update (2 lines), and in
createEngineView: new block after cellOf; FARZ + farTiles (replaced whole); sigOf, idsOf, dropCell, buildCell (ground
line, B.roofTri head, the building loop replaced), plan (3 spots), pump head, growTrees add, lensGeom/lensBuild/shadeAt,
floorTop, drawHud (ELEV after AT, craft only), buildRoads (S.roadTV), lamps/lampsLit, placeCamera (all modes; the four
uses of SK.now.surge as a height now go through surgeY()), update (2 surge spots, headlights), highlight, drawLabels
(2), dblclick, faceAt, setHeight, state, recenter, warpTo, open, project, debug.
NOT touched (left to their jobs): StormKit, Traffic, X.update (cars' physics boxes still at y = H/2; cars' instances
are lifted and tilted by wrapping their instance buffers in fleetInit), haze/cloud shaders.
- [x] tests/t_move.js (stepped by hand): walk down/up Filbert 20.4 m with feet on ground; Alta X rides up the street keeping 3 m (added env.ground terrain following in A.update); warp SF->Mammoth lands 60 m over ground, datum 22->2401; recentre at 12 km keeps asl and ground. All pass (run 2). Badwater t_core passes (-77.7 vs -81.9, tile limit).
- Tests must run ONE AT A TIME (two browsers at once -> tile fetch failures, page starvation). Continuous play starves page.evaluate under swiftshader: step with engine.emit('update', dt) after engine.stop().
- Kit change after that run: failed tiles retried by request() back-off + 4 s heartbeat (not timers). NEXT: rebuild, run t_blocked.js, t_core at Twin Peaks/Tahoe/Coronado/Mammoth/Truckee, t_perf.js on both pages (base: build/out/testbed_base.html).
- [x] t_blocked.js PASSES: tiles refused -> grid ground at LA (105 m), all cells built, eye 1.7; Baton Rouge flat at 0 datum 0; tiles let through -> 93.0 m by itself.
- [x] Chain check: terrain -> weather -> traffic -> car -> sky ports all apply cleanly and the result parses (engine/terrain/out/chain/s4.js). Weather port already adapts to surgeY().
- Port now 108 patches (added: cars' physics boxes lifted, 2 + 1 anchors in X.update; Alta terrain following).
- running: tests/run_places.sh > out/places.log (Twin Peaks passes 261.9 vs 262.1). Then: fetch timeout 25 -> 60 s, diag of failed tiles (S.terr.tiles() shows why), t_perf.js on both pages.
- FOUND: coarse terrarium tiles (z10, z8) have false spikes at coasts (3096 m in San Diego Bay). Fixed in kit: despike() at decode, tests/despike_check.js. NEXT: rerun dbg_place at Coronado to confirm, then t_perf both pages, grid check for the same artifact.
- [x] run_places.sh: all 7 places pass ground checks (Twin Peaks 261.9/262.1, S Lake Tahoe 1901.3/1901.6, Coronado 5.3/6.0, Mammoth 2401.4/2399.2, Truckee 1773.3/1773.1, LA 93.0/90.2, Lone Pine 1136.0/1136). One FAIL found and fixed: cells kept beyond reach kept old prisms after their ground was rebuilt (plan() now requeues by c.gv).
- [x] despike extended inland (overAny 700 m z8 / 350 m z10); scan_spikes.py: 25 near-sea + 4 inland bad pixels in z8 statewide; grid source (z6) clean.
- running: t_perf.js terrain then base -> out/perf_terrain.log, out/perf_base.log. Then: smoke of chain s4.js (all five ports) in the test bed; final report.
- perf (high, SF, software GL; tris summed over all passes): base street 2.51M / drone 2.08M / bird 2.93M / metro 0.85M; terrain v1 2.82M / 2.45M / 3.00M / 1.42M. update median 1.2 ms both; p95 7.7 -> 9.7 ms; S.gy 123 ns near, 323 ns far.
  PROBLEM found: buildRoads 83 ms -> 2738 ms (with life 416 -> 4247 ms): joints draped as 10 wedges each. FIXED in code (drapePoly, joints only at ends and turns, quads as one shape); re-measuring -> out/perf_terrain2.log
- street build now: near (T.fineR 360 m of build centre) cut to triangles, far laid whole. dbg_roads: life off 281 ms/62k tris at fineR 420 (base 83 ms), life on 1141 ms/197k tris (base 416). Now fineR 360; rerunning dbg_roads, then t_misc, t_move, t_blocked, t_core SF as final regression.
- [x] t_misc PASSES (23 rays on drawn ground, 22549 street vertices exact, 45 roof views on lifted roofs). Container restarted; rerunning t_move, t_blocked, t_core SF -> out/final.log; then chain smoke (bash CA/build/assemble_ca.sh).
- [x] bash build/assemble_ca.sh engine/terrain/out/ca_stack.html: all six ports apply after terrain, engine parses, page assembles (scripts 60, syntax errors 0).
- [x] final t_move PASSES (all 19 checks) on the final build.
- [x] final t_blocked PASSES (catch-up in 80 s).
- BUG found by final t_core (prism 61 m under ground): kidAt fast path remembered a COARSE kid (hit by far street vertices), then answered near points from it. Fixed: only finest-lattice kids are remembered. Rebuilding; rerun t_core SF + t_misc; then ca_smoke on the stack.
- [x] After the cache fix: t_core SF passes (prisms [-10.0, -1]); full stack reassembled (bash build/assemble_ca.sh engine/terrain/out/ca_stack.html) and build/ca_smoke.js on it: engine opens on terrain (elev 38.4, agl 1.7), every engine check ok, no page errors (its one FAIL is the atlas weather module's live NWS text saying "storm surge", not the engine). shots/stack_smoke_sf.png.
- t_move, t_blocked, t_misc last ran on the build just before the one-line cache fix (all passed).
- DONE. Handed back.
