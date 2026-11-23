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
