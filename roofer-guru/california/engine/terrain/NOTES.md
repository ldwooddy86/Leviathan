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
