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
