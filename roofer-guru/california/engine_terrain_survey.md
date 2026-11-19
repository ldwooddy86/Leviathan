# Scout Engine: survey for putting the world on terrain

Surveyed file: `/tmp/claude-0/-home-user-Leviathan/3de4e742-518d-5f10-b5db-2b34e6723642/scratchpad/build/engine.js` (716,671 bytes, 5,463 lines). All line numbers are 1-based lines of that file as it stands now. Nothing in it was changed.

Conventions used here
- Local coordinates are metres: x east, y up, z south. `S.toL(lat, lon)` returns `[x, z]` (line 4932); the origin is `S.lat0/S.lon0`, reset by `recenter()` (5389).
- "building-local height" means a height measured from the building's own floor (today that is the same as world y, because every floor is at 0).
- `h(x, z)` is the terrain height function to be added. In the sketches it is reachable as `S.gy(x, z)` because `S` is the one object every kit already receives (`WorldKit(engine, env, S)`, `StreetKit(engine, K, S)`, `WideKit(engine, K, S, env, H)`, `HvacKit(engine, K, S, env)`, all at 4938 to 4949).
- Quoted code is copied from the file; `[...]` marks an elision made by me. Sketches of new code are labelled "sketch".

## 0. The findings that shape the patch

1. Every mesh of the world is built in absolute local coordinates with an identity transform. Cells, far tiles, streets and props are entities under `root` with no position of their own, so nothing can be lifted by moving an entity. The lift has to go into the vertices (or, for the three one-off meshes that already accept a world matrix, into that matrix: outlines at 1853, the roof-view layer at 1918, instanced props through their instance matrix at 471).
2. A building's geometry is emitted by one function, `K.addBuilding` (3429 to 3512), into six `MeshBuilder`s plus a roof callback, all with literal heights measured from 0. `MeshBuilder` stores positions as a flat `Float32Array` that grows by 9 floats per triangle, so the range a building occupies can be recorded and lifted afterwards, before `build()`. Section 3 shows this works for everything except two things: the roof triangles (they are clipped into other cells' builders at once, so the lift goes into the `B.roofTri` closure) and the wall bottoms on a slope (one optional parameter).
3. Three shaders read world y as "height above the ground":
   - the wall shader `facade` (3206): `y = v_wpos.y` decides floors, windows, the parapet and the grime at the foot. This one is live and breaks as soon as a building's floor is not at 0;
   - the ground detail shader `groundPBR` (3303): `if (v_wpos.y > 0.6 || N.y < 0.7) return;`. It is dead code in this build: `Material`'s constructor (757 to 773) never copies `o.groundPBR`, so `GROUND_PBR` (776) is never defined although `imagery()` asks for it (4957). If it is revived, its test must change;
   - the air: haze (1280, 1331, 2058), the cloud slab (2073, 2087) and the clouds' shadow (2022) measure height from y = 0.
4. The physics world has one horizontal ground plane, `this.groundY = 0` (2628), used in four places (2652 to 2654, 2683, 2694, 2709). The walking character, the pick ray, the label occlusion ray and the rigid bodies all go through those four.
5. The ground is five flat layers laid one over another and kept apart only by constant drops in y: cells at 0, zoom 17 tiles at -0.35, the wider city's zoom 15 squares at -1.1, zoom 13 at -9, zoom 10 at -48, and a 600 km plane at -90 (4969, 4142, 4980). The drops are sized to the depth buffer's resolution at each layer's range (the scene depth is 24 bit, 1607, with `cam.near` as low as 0.3). On terrain a coarse layer does not stay under a fine one by a constant: this is the one place where a new mechanism is needed (section 4.3, item A).
6. The drone and the two craft already take the ground through callbacks (`floor(x, z)`, `block(x, z, y)`: 4515, 4866), and the storm kit already has an unused `o.ground()` option (4751). The street kit, the traffic and the car shader are two-dimensional or work in model space; only where instances are placed is y written (always as the literal 0).
7. Every cell is rebuilt whenever the streets are reloaded (`S.roadsVer` is part of `sigOf`, 4987), which happens each 230 m of travel (5207). Terrain sampling therefore runs in a path that is already hot; the per-cell heights should be cached on the cell.

## 1. A map of the world builder

### 1.1 Engine parts the world builder stands on

| Lines | Name | One line |
|---|---|---|
| 409-413 | `class Grow` | A typed array that doubles when full: `a` (the array), `n` (items written), `need(k)`, `done()` |
| 415-464 | `class Mesh` | GPU buffers from `{ positions, normals, uvs, colors, aux, indices }`; `bounds` computed once from positions (431); `update(positions)` rewrites positions only (437); indexed or not |
| 467-489 | `class InstanceBuffer` | 16 floats an instance; `add(x, y, z, yaw, sx, sy, sz, r, g, b, a)` (471) turns about +Y only; `addMatrix(m, col)` (476) takes any matrix; `upload()` measures bounds including y (480-487) |
| 492-521 | `class MeshBuilder` | Triangles gathered one at a time, flat shaded, not indexed (section 3) |
| 525-544 | `clusterize(d, maxTris)` | Sorts a mesh's triangles along a Morton curve and cuts them into runs with a bounding sphere each; it reorders the vertex data |
| 566-605 | `Prim` | `plane(w, d, seg)` (568) is an indexed grid with y = 0: the pattern for a height-field mesh |
| 696-709 | `class Camera` | `ray(x, y)` (705), `project(p)` (707); `near`, `far` |
| 720-741 | `MeshRenderer`, `InstancedRenderer` | `castShadow`, `maxDistance`, `pickable`; bounding sphere from `mesh.bounds` |
| 756-790 | `class Material` | `polygonOffset` (768), `layered`, `facade`, `vertexColors`; `groundPBR` is read at 776/777/783 but never set |
| 799-828 | `SURFACE_VS` | `v_wpos`, `v_uv`, `v_color = a_color`, `v_aux = a_aux` reach every surface shader (`CHUNKS.surface`, 831-952, reads them) |
| 1277-1285, 1329-1332, 2058 | haze | Density `u_fog.x * exp(-max(y, 0) * u_fog.y)`; `u_fog` set at 1737 from `env.fogDensity`, `1 / env.fogHeight` (90 m, line 665; 420 in a storm, 4709) |
| 1643-1658 | `_cascades(cam)` | Shadow cascades fitted to slices of the view; no ground assumed; casters reach 420 m toward the sun (1864) |
| 1697-1706 | cluster draw | A mesh with `clusters` is drawn run by run; a run with `hidden` true is skipped; `mesh.maskable` forces this path |
| 1853, 1858 | outlines | `R.setOutline(key, [{ mesh, world }])`: an item's `world` matrix is used when given, the identity otherwise |
| 1911-1941 | `class XRay` | `add(mesh, world)` (1918): the roof-view layer |
| 2022 | `cloudShadow` | Clouds' shadow cast from a deck at y = 2200 |
| 2073, 2087 | clouds | Slab between `C0 = 1500.0` and `C1 = 3300.0` above y = 0 |
| 2424-2429 | `QUALITY` | `shadowDistance` 140 to 340 m by tier |
| 2627-2717 | `Physics.World` | `groundY` (2628), `addPrism(ring, y0, y1, userData)` (2632), `prismsIn` (2636), `_statics` (2650), `step` (2662), `raycast` (2692), `floorAt(x, z, y, step)` (2709) |
| 2720-2739 | `Physics.Character` | `move(dx, dz, dt, jump, dy)` (2723): gravity, walls of prisms, then `floorAt` (2733) |

### 1.2 What the neighborhood is made of: `WorldKit(engine, env, S)` (3311-3582) and its shaders

| Lines | Name | One line |
|---|---|---|
| 3164-3194 | `SE.shaders.forward.glow` | The glow's shader; reads `a_aux`, not world y |
| 3203-3294 | `CHUNKS.facade` | Walls: windows, floors, parapet, grime, all from `y = v_wpos.y` and `H = v_aux.z` (3206) |
| 3295-3309 | `CHUNKS.groundpbr` | Ground detail; `v_wpos.y > 0.6` (3303); not compiled in this build |
| 3317-3319 | `LAYERS`, `TILE` | Wall and street textures; `TILE = { brick: 1.6, siding: 2.4, stucco: 2.5, metal: 3.0, concrete: 3.0, asphalt: 4.0 }` |
| 3333-3349 | materials `M.*` | `M.wall` (facade), `M.road` (`polygonOffset: [-1, -4]`), `M.paint` (`[-2, -8]`), `M.trim`, `M.glass`, `M.glow`, `M.leaf`, `M.crown`, `M.trunk`, `M.pole`, `M.lamp` |
| 3354-3367 | `K.ringsOf(b)` | A building's footprint rings in local metres `[x, z]`, cleaned |
| 3381-3394 | `K.facadeOf(b, h)` | Which wall and glazing a building gets |
| 3400-3407 | `K.roofShape(P, hRaw, flat, cls)` | Eave, rise, ridge ring or parapet deck, as heights from the floor |
| 3411-3426 | `K.roofPlanes(b)` | The roof as planes of triangles for the roof views (heights from the floor) |
| 3429-3512 | `K.addBuilding(B, b, o)` | One building into the cell's builders: walls, windows, door, trim, roof, glow. Returns `{ id, rings: [{ P, eave, h, Q }], h, flat, cx, cz, top }` |
| 3516-3524 | `K.addContext(Bw, Br, f, uv, o)` | A plain block of the wider city: walls 0 to h, a lid at h |
| 3525-3527 | `K.solidOf(b)` | One building as a plain solid, 0 to h + 0.25, for the outline |
| 3530 | `K.ROADW` | Width, height above the ground and texture per kind of street: `major: [12, 0.1, 'asphalt'], street: [8.2, 0.09, ...], service: [5.2, 0.085, ...], alley: [4.2, 0.08, ...], drive: [3, 0.075, ...], path: [1.6, 0.07, ...]` |
| 3531-3541 | `K.ribbon(Bd, pts, w, y, kind, offs, col)` | A street as a ribbon of quads at one height y, with a ten-triangle disc at every point |
| 3544-3555 | tree meshes | `K.crownNear`, `K.crownMid`, `K.crownFar` (crown centred at 0.66 of a unit height), `K.trunk` (a unit cylinder from y = 0 to 0.56) |
| 3559-3579 | `K.detectTrees(canvas, rect, mask)` | Reads a cell's photograph for canopy; returns `[{ x, z, r, h, col }]`. Two-dimensional |

### 1.3 Streets: `StreetKit(engine, K, S)` (3591-3716), `CarKit` (3793), `Traffic` (3872)

| Lines | Name | One line |
|---|---|---|
| 3610-3626 | `network(roads)` | Nodes and ways from the street lines; two-dimensional |
| 3627-3631 | `at`, `piece`, `shift` | A point along a way, a stretch of it, a line moved sideways |
| 3639-3685 | `X.build(roads, parent, o)` | Once per street map: sidewalks and curbs (3648-3651), lane lines (3652), parked cars (3654, 3656-3662), crosswalks and stop bars (3667-3669), signals and stop signs as instances (3671), the fleet and traffic (3683) |
| 3690-3710 | `X.update(dt, cam, o)` | Each frame: parked cars sorted into near and far instances and physics boxes (3694-3698), traffic stepped (3703), moving cars as instances and kinematic boxes (3706-3708) |
| 3712 | `X.nearCars(cam, n)` | The nearest moving cars, for headlights |
| 3719-3791 | `CHUNKS.carpaint` | The car shader: works from `v_aux.xyz` (the model's own coordinates), not world y |
| 3872-4117 | `Traffic(types)` | Cars as `{ x, z, yaw, v, ... }` on lanes; no y anywhere |

### 1.4 The wider city: `WideKit(engine, K, S, env, H)` (4126-4250)

| Lines | Name | One line |
|---|---|---|
| 4139-4141 | `mosaic(t)` | A 512 px canvas of four zoom 16 tiles for a zoom 15 square |
| 4142-4143 | `ground(t)` | The square's ground: one quad at `y0 = -1.1` |
| 4146 | `clusterOf(a, b, bb, key)` | A run of triangles with a bounding box, hideable |
| 4147-4157 | `build(t)` | Every footprint in the square through `K.addContext`; grouped by detailed cell so a cell's blocks can be hidden |
| 4169-4176 | `W.update()` | Which squares exist round the camera (reach 1,300 to 4,200 m by tier, times 1.7 in metro view: 4948) |
| 4179 | `W.cover(key, on)` | Hide or show the blocks under a detailed cell |
| 4192-4212 | `findTrees`, `fillTrees` | Backdrop trees as instances at y = 0 (4210) |
| 4228-4237 | `skyBuild()` | The skyline: the tall buildings (asked for with `minH: 30`, kept from 20 m) of the nine 0.2 by 0.24 degree squares round the camera, through `K.addContext` |

### 1.5 Equipment, the drone, the weather, the craft

| Lines | Name | One line |
|---|---|---|
| 4297-4440 | `H.layout(b, code)` | Boxes and runs in building-local coordinates; `L.ext` is what stands out of doors |
| 4446 | `H.exterior(b, Bd)` | `Bd.box(q[0], q[1], q[2], ...)` for each outdoor box; `q[1]` is a building-local height |
| 4502-4504 | `A.state`, `A.place(x, z, yaw, floorY)` | The Alta X's state; `st.y = floorY \|\| 0` |
| 4516-4546 | `A.update(dt, env)` | Flies against `env.floor(x, z)` and `env.block(x, z, y)` |
| 4673-4677 | `waterOn(on)` | The flood: a 600 km plane with the water material |
| 4691-4702 | `strike(cam)` | A bolt from `[x, 1480, z]` to `[x, 0, z]` |
| 4707-4716 | `K.set(level, w0, o2)` | What a storm step asks for; `surge: [...] : -1.5`, `fogH: level ? 420 : 90` |
| 4720-4741 | `K.update(dt, cam, live)` | Slides toward the step; puts the flood plane at `now.surge` (4726) |
| 4743-4769 | `K.draw(R, cam)` | Rain round the camera; spray and debris in a band whose floor is `gy = o.ground ? o.ground() : 0` (4751) |
| 4848-4860 | `U.state`, `U.place`, `U.goTo`, `U.arriveAt`, `U.anchor` | The craft's state and moves |
| 4867-4895 | `U.update(dt, env)` | Flies against `env.floor` and `env.block`; `ny = clamp(st.y + st.vy * dt, 0, AS.ceilingM)` (4885) |

### 1.6 The neighborhood, streamed: `window.__SCOUT_E3D__ = function createEngineView(host, env)` (4909-5459)

| Lines | Name | One line |
|---|---|---|
| 4929 | `S` | State: `x, z, y, yaw, pitch, mode, roads, graph, orbit, ...` |
| 4930 | `HEIGHT` | Eye height and pitch per mode: `street 1.7, walk 1.7, drone 38, bird 120, orbit 0, alta 30, metro 1400, saucer 60, tictac 60` |
| 4931-4935 | projection | `mLat`, `mLon`, `S.toL`, `toLL`, `lon2t`, `lat2t`, `t2lon`, `t2lat` |
| 4938-4942 | kits | `K`, `ST`, the entity groups `root`, `gCells`, `gFar`, `gRoads`, `gFx`, `HV`, `XR`, `ALTA`, `UAP` |
| 4945-4947 | `rectOf(X, Y, z)`, `cellOf(x, z, zz)` | A map tile as a rectangle in local metres `{ x0, x1, zN, zS }` (cached), and the tile a point is in |
| 4948-4949 | `wideReach`, `WIDE` | The wider city and its hooks (`covered`, `onData`, `treeCap`, `treeCovered`) |
| 4952-4966 | `imagery(X, Y)`, `dropImagery`, `release` | One 512 px canvas a cell, four zoom 19 tiles drawn in as they arrive; one texture and one `Material` ("Ground and roofs") |
| 4969-4979 | `FARZ`, `farTiles()` | The far ground: one flat quad a tile at `L.y`, zoom 17, 13 and 10 |
| 4980 | Horizon | A 600 km plane at y = -90 |
| 4983-4993 | cells | `CELLS`, `IDX`, `queue`, `treeQ`, `cellSize`, `reach`, `index`, `sigOf`, `idsOf`, `clip3`, `disposeParts`, `disposeTrees`, `dropCell` |
| 4994-5022 | `buildCell(c)` | A cell's builders; the ground quad (4999); `B.roofTri` (5000-5004); each building (5014-5015); the parts (5017-5019); trees queued (5021) |
| 5024-5033 | `plan()` | Which cells should exist, which need building, which can go; then `WIDE.update(); farTiles()` |
| 5035-5042 | `pump()` | Each frame: cells for up to 7 ms, then one cell's trees, then the wider city; replans after 28 m |
| 5046-5058 | `growTrees(c)` | Trees where the cell's photograph shows canopy, as instances at y = 0 (5053) |
| 5066-5135 | roof views | `lensGeom(b)` (5075-5086), `roofLum` (5094), `shadeAt` (5104-5110), `lensBuild` (5111-5123), `lensSync` (5124-5134) |
| 5144-5145 | `floorTop(x, z)`, `blockAt(x, z, y)` | What is under a point and whether a wall stands there: the drone's and the craft's world |
| 5147-5159 | `drawHud()` | Altitude above `floorTop` |
| 5163-5172 | `setRoads(list)`, `buildRoads()` | Street lines to local metres; ribbons at `K.ROADW` heights (5167); `ST.build` (5170); `S.roadsVer++; lamps(); planSoon()` (5171) |
| 5173-5183 | `loadRoads`, `nearestOnRoads`, `nearestRoad`, `roadAt` | Two-dimensional |
| 5186-5206 | `walk(dist)` | Street mode: along the street lines; two-dimensional |
| 5207 | `after(quiet)` | Reloads streets after 230 m; recentres after 12 km (90 km when fast) |
| 5224-5238 | storm | `SK = SE.StormKit(engine, {})`, `surgeHere`, `setSun`, `grounded`, `setStorm` |
| 5240-5256 | `lamps()`, `lampsLit()` | Lamp posts as instances at y = 0 (5247); the nearest as spot lights at y = 7.1 (5255) |
| 5259 | `character` | `new Physics.Character(phys, {})` |
| 5260-5277 | `placeCamera()` | The eye for each mode (section 2.9) |
| 5279-5308 | update | Input; craft and drone updates with `floor` and `block` (5287, 5292); walk mode through the character (5294-5295); tweens; `placeCamera(); pump()`; storm; street life and headlights (5305-5307) |
| 5320-5323 | `solid`, `highlight`, `pickAt` | Outline solids; picking by `phys.raycast` |
| 5337-5338 | click, double click | Go to the ground point; hang the craft over a roof |
| 5348-5358 | `drawLabels()` | Labels projected from `[l.x, l.y, l.z]`; street names from `[o.x, 0.4, o.z]` |
| 5361-5382 | `goTo`, `faceAt`, `setHeight` | Moves, aiming and changing mode |
| 5389-5393 | `recenter(la, lo, keep)` | Drops everything and rebuilds round a new origin |
| 5407-5417 | `warpTo(lat, lon, o)` | The craft's jump |
| 5420-5458 | controls | `open` (5421-5430), `project(lat, lon, up)` (5436), `setGraphics`, `debug` |

## 2. Where y = 0, or a base at 0, is assumed: the snippets

Each block quotes the code as it stands, then says what has to change. `S.gy(x, z)` is the ground height; `baseY(id)` is the floor height chosen for a building (section 3.4); "lift" means adding that to y.

### 2.1 The ground itself (four kinds of surface and a plane)

```
4969  const FAR = new Map(), FARZ = [{ z: 17, reach: 760, y: -0.35, inner: 0 }, { z: 13, reach: 16000, y: -9, inner: 1 }, { z: 10, reach: 90000, y: -48, inner: 16000 }];
4975  const Bd = new MeshBuilder(); Bd.quad([r.x0, L.y, r.zN], [r.x1, L.y, r.zN], [r.x1, L.y, r.zS], [r.x0, L.y, r.zS], [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]]);
4977  [...] mr.mesh = Bd.build(dev); mr.material = mat; mr.castShadow = false; mr.pickable = false; FAR.set(key, { e, tex, mesh: mr.mesh }); } });
4980  { const e = scene.createEntity('Horizon', [...]); mr.setShape({ kind: 'plane', args: [600000, 600000, 1] }); [...] e.transform.setPosition(0, -90, 0); S.horizon = e; }
4999  own.b.quad([rect.x0, 0, rect.zN], [rect.x1, 0, rect.zN], [rect.x1, 0, rect.zS], [rect.x0, 0, rect.zS], [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]]);
4142  function ground(t) { const r = t.rect, y0 = -1.1, Bd = new MeshBuilder(); Bd.quad([r.x0, y0, r.zN], [r.x1, y0, r.zN], [r.x1, y0, r.zS], [r.x0, y0, r.zS], [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]]); t.img = mosaic(t); t.mat = roofMat(t.img.tex);
```

- 4999 (a cell's ground): one quad at y = 0, in the same builder as the cell's roofs (`own.b`, the "Ground and roofs" mesh drawn with the cell's photograph). Becomes a grid of posts at `S.gy`. The uv stays `[(x - x0) / (x1 - x0), (z - zN) / (zS - zN)]`: the photograph is a plan view, so draping needs no new uv. Either push the grid's triangles into `own.b` (flat shaded, 6 vertices a quad), or build an indexed mesh beside it with the same material `c.img.mat` (section 3.5).
- 4975 (a far tile): one quad at `L.y`. Becomes an indexed grid; `FAR` entries have no version, so a tile whose heights arrive later is never rebuilt: `if (FAR.has(key)) continue;` (4974) must compare a terrain version.
- 4142 (a square of the wider city): one quad at -1.1. Same change; `WideKit` needs the ground function passed in through its `H` argument (4949) or read from `S.gy`.
- 4969: the constants `y: -0.35`, `-9`, `-48` and the wider city's `-1.1` are the whole of today's level-of-detail scheme. They cannot simply be added to a height field (section 4.3 A).
- 4980 (the horizon): a plane at -90, 300 km out each way from the origin. With a datum (section 4.1) it must sit below the lowest ground in reach: California's lowest land is about 86 m below sea level, so -90 only just clears it in absolute terms, and with a datum at, say, 1,500 m the plane must go to `-90 - S.y0`.

### 2.2 A building: every place `K.addBuilding` writes a height (3429-3512)

All heights below are literals or sums of literals measured from the floor. None of the emitters takes a base.

| Line | Part | Builder | Code as it stands (shortened) | Heights |
|---|---|---|---|---|
| 3435-3437 | wall quad | `B.wall` | `B.wall.quad([a[0], y0, a[1]], [c[0], y0, c[1]], [c[0], y1c, c[1]], [a[0], y1a, a[1]], nrm, [uv(s0, y0), uv(s1, y0), uv(s1, y1c), uv(s0, y1a)], tint, [A0, A1, A1, A0])` with `A0 = [s0, len, hRaw, lw]` | `y0`, `y1a`, `y1c` from the caller; uv and aux carry the height too |
| 3483 | walls of a house | `B.wall` | `wallQuad(a, c, 0, eave, eave); glazing(a, c, eave, [...])` | 0 to eave |
| 3496 | walls under a flat roof | `B.wall` | `wallQuad(a, c, 0, hRaw, hRaw); glazing(a, c, hRaw, null)` | 0 to hRaw |
| 3454-3456 | window glass | `B.glass` | `const y0 = f * fh + 0.92, y1 = y0 + wh; [...] w.face(B.glass, [...], y0 + ft, y1 - ft, 0.015, [...])` | floor by floor from 0.92 |
| 3460-3463 | frames, bars, sills, shutters | `B.fine` or `B.trim` | `w.box(BF, s - ww / 2, s - ww / 2 + ft, y0, y1, fo, fcol, 'r')` and the like | same |
| 3471-3472 | door | `B.trim`, `B.fine` | `w.box(B.trim, d.s - d.w / 2, d.s + d.w / 2, 0.02, hh, 0.045, col, 'tlr')` | 0.02 to 2.05 (2.15 a garage) |
| 3484-3485 | soffit and fascia | `B.trim` | `flatRing(P, W, eave, B.trim, TRIM.white, -1)`; `[a[0], eave - 0.22, a[1]] [...] [c[0], eave + 0.03, c[1]]` | eave |
| 3486 | foundation | `B.trim` | `const Wf = off(W, -0.03); ring(Wf, Wf, 0, 0.34, B.trim, TRIM.found, false);` | 0 to 0.34 |
| 3487-3491 | hipped roof | `B.roofTri` | `a = [P[i][0], eave, P[i][1]], [...] dq = [Qr[j][0], top, Qr[j][1]] [...] B.roofTri(a, c, dq, nr); B.roofTri(a, dq, e, nr);` then `cap(Qr, top, true)` | eave to top |
| 3497 | parapet, coping, deck | `B.trim`, `B.roofTri` | `ring(inner, inner, deck, hRaw, B.trim, TRIM.para, true); flatRing(P, inner, hRaw, B.trim, TRIM.cap, 1); cap(inner, deck, true)` else `cap(P, hRaw, true)` | deck, hRaw |
| 3502-3503 | glow shell | `B.glow` | `B.glow.quad([a[0], 0, a[1]], [c[0], 0, c[1]], [c[0], sTop, c[1]], [a[0], sTop, a[1]], [...], scol, [a0, a0, a1, a1])` | 0 to `sTop`; aux.y = 0 |
| 3504-3505 | glow pool on the ground | `B.glow` | `pa = [H1[i][0], 0.17, H1[i][1]], pb = [...0.17...], pc = [H2[j][0], 0.17, H2[j][1]] [...] B.glow.tri(pa, pb, pc, [0, 1, 0], null, null, null, hi, hx, hx, hx)` with `hx = [0, 1, 0, 0]` | 0.17, flat, from 0.3 m to 2.8 m outside the footprint; aux.y = 1 |
| 3507-3509 | glow lines on the roof's edges | `B.glow` | `edge([P[i][0], rec.eave + 0.06, P[i][1]], [P[j][0], rec.eave + 0.06, P[j][1]])` and the hips and ridge at `rec.h + 0.06` | eave, top; aux.y = 2 |
| 3434, 3511 | what is returned | | `const out = { id, rings: [], h: hRaw, flat, cx: 0, cz: 0, top: hRaw };` each ring `{ P, eave, h, Q }` | heights from the floor |

The roof callback, the equipment, the prism and the label are in `buildCell`:

```
5000  B.roofTri = (a, b, d, n) => {
5001    if (inR(a) && inR(b) && inR(d)) { own.b.tri(a, b, d, n, own.uv(a), own.uv(b), own.uv(d)); return; }
5002    const ca = cellOf(a[0], a[2]), cb = cellOf(b[0], b[2]), cd = cellOf(d[0], d[2]), [...]
5003    for (let Y = Y0; Y <= Y1; Y++) for (let X = X0; X <= X1; X++) { const r = roofB(X, Y), P = clip3([a, b, d], r.rc); for (let i = 1; i + 1 < P.length; i++) r.b.tri(P[0], P[i], P[i + 1], n, r.uv(P[0]), r.uv(P[i]), r.uv(P[i + 1])); }
5004  };
5014  for (const b of all) { let g = null; try { g = K.addBuilding(B, b, { detail: c.detailWant, nearRoad: S.roads.length ? nearRoad : null }); } catch (e) { g = null; } if (!g) continue; n++; if (gfx.roofKit !== false) { try { HV.exterior(b, B.equip); } catch (e) { /* this one goes without */ } }
5015    g.rings.forEach(r => c.prisms.push(phys.addPrism(r.P, 0, r.h, { id: b.id }))); if (b.extra) nx++; else c.labels.push({ id: b.id, x: g.cx, y: g.top + 1.4, z: g.cz }); }
4446  H.exterior = (b, Bd) => { const L = H.layout(b); L.ext.forEach(q => { const d = q[7] === C.dark; Bd.box(q[0], q[1], q[2], q[3], q[4], q[5], q[6], [...]); }); return L.ext.length; };
```

- 5000-5004: a roof triangle is written at once into the builder of whichever photograph it lies over, clipped at the cells' edges (`clip3` cuts in x and z and interpolates y, 4989). Lift the three points on entry (copies, not in place: `K.addBuilding` passes the same array to two calls at 3490).
- 5014: record where each of `B.wall`, `B.trim`, `B.fine`, `B.glass`, `B.glow`, `B.equip` stands before the building and lift what was added after it (section 3.3). `HV.exterior` writes building-local heights into `B.equip` and is covered by the same lift; `H.layout` caches its boxes per building (`layouts`, 4296), so the base must not be put into the layout itself.
- 5015: `phys.addPrism(r.P, 0, r.h, ...)` becomes `phys.addPrism(r.P, lo - 1, base + r.h, ...)` (`lo`: the lowest ground under the ring, so nobody walks under a building's low side). The label's `y: g.top + 1.4` becomes `base + g.top + 1.4`.

### 2.3 The two shaders that read world height

```
3205  float fpx = max(fwidth(v_aux.x), fwidth(v_wpos.y));   [...]
3206  float code = floor(v_color.a * 255.0 + 0.5), style = floor(code / 32.0), seed = mod(code, 32.0), y = v_wpos.y, sA = v_aux.x, L = v_aux.y, H = v_aux.z;
3207  float grime = fbm(vec2(sA * 0.55 + seed, y * 0.11)); base.rgb *= mix(1.0, 0.72, smoothstep(0.45, 0.85, grime) * 0.5) * mix(0.84, 1.0, smoothstep(0.0, 1.3, y));
3215  float top = 0.7, rest = H - g0 - top, fl = floor(rest / fh + 0.5);
3218  if (y < g0) { fi = -1.0; yb = y; fhc = g0; } else if (y < g0 + fl * fh) { fi = floor((y - g0) / fh); yb = y - g0 - fi * fh; fhc = fh; }
3219  else { base.rgb *= 0.95 + 0.1 * step(H - 0.16, y); return; }                                   /* the parapet */
3303  if (v_wpos.y > 0.6 || N.y < 0.7) return; float dd = distance(v_wpos, u_camPos), k = 1.0 - smoothstep(16.0, 90.0, dd); if (k <= 0.0) return;
```

- 3206 (`facade`, used by `M.wall`, which draws the cells' walls at 5019 and the wider city's and the skyline's at 4156 and 4235): `y` is the world height and `H` the building's height, so the ground floor, each storey, the parapet line (`H - 0.16`) and the grime at the foot are all placed as if the floor were at 0. On a floor at 300 m every wall the shader glazes (styles 1 to 4, chosen by `K.facadeOf` at 3381: offices, shop fronts, apartment blocks, here and in the wider city and the skyline) is "parapet" from top to bottom and has no windows; houses (style 0, which leaves at 3208 because their windows are real geometry) lose only the darkening at the foot. The aux is full (`[s, len, hRaw, lw]`, 3437: place along the wall, the wall's length, the building's height, the texture layer with a half for metal), and the colour's alpha holds the style and seed (3433). The height above the floor is nevertheless already on every wall vertex, in the uv: `const uv = (s, y) => (kind === 'siding' ? [y / tile, s / tile] : [s / tile, y / tile]);` (3436, and the same at 3520 for the wider city). So the shader can recover it with no new vertex data (sketch):

```glsl
/* sketch, in place of "y = v_wpos.y" at 3206: the height above the building's own floor, from the wall's uv.
   TILE by layer (3319): brick 1.6, siding 2.4, stucco 2.5, metal 3.0, concrete 3.0; siding's uv is turned (3436) */
float lay = floor(v_aux.w + 0.25), tl = lay < 0.5 ? 1.6 : lay < 1.5 ? 2.4 : lay < 2.5 ? 2.5 : 3.0;
float y = (lay > 0.5 && lay < 1.5 ? v_uv.x : v_uv.y) * tl;
```

  This holds only while the walls' uv keeps being written from building-local heights, which is the case if the lift is applied to positions after the fact (section 3) and not threaded into `wallQuad`'s arguments. `fwidth(v_wpos.y)` at 3205 is a derivative and can stay. `M.wall` has the default `uv` scale `[1, 1, 0, 0]` (763) and no `worldUV`, so `v_uv` is the vertex uv unchanged (824).
- 3303 (`groundPBR`): meant to tell the ground (y under 0.6) from the roofs that share its material. It does not run today (finding 3 of section 0). If the option is ever switched on, or if the cell's ground becomes its own mesh, give the ground its own `Material` with the option and drop the height test; the roofs keep one without it.

### 2.4 The wider city's blocks and the skyline

```
3521  for (let i = 0; i < n; i++) { const a = P[i], c = P[(i + 1) % n], [...] const A0 = [0, len, h, lw], A1 = [len, len, h, lw];
3522    Bw.quad([a[0], 0, a[1]], [c[0], 0, c[1]], [c[0], h, c[1]], [a[0], h, a[1]], [dz / len, 0, -dx / len], [u(0, 0), u(len, 0), u(len, h), u(0, h)], tint, [A0, A1, A1, A0]); } }
3523  if (Br) SE.Poly.triangulate(P).forEach(t => { const a = P[t[0]], c = P[t[1]], d = P[t[2]]; if (uv) Br.tri([a[0], h, a[1]], [c[0], h, c[1]], [d[0], h, d[1]], [0, 1, 0], uv(a), uv(c), uv(d)); else [...] });
4146  const clusterOf = (a, b, bb, key) => ({ start: a * 3, count: (b - a) * 3, c: [(bb[0] + bb[3]) / 2, (bb[1] + bb[4]) / 2, (bb[2] + bb[5]) / 2], r: Math.hypot(bb[3] - bb[0], bb[4] - bb[1], bb[5] - bb[2]) / 2 + 0.5, axis: [0, 1, 0], cone: 0, hidden: false, key });
4151  by.forEach((list, key) => { const r0 = Br.tris, w0 = Bw.tris, bb = [1e9, 0, 1e9, -1e9, 0, -1e9];
4152    list.forEach(f => { const P = ringOf(f); if (!P) return; const g = { P, h: f.h, cls: f.cls, id: f.id }; try { K.addContext(Bw, Br, g, uv, { noWalls: far && f.h < 7.5 }); } catch (e) { return; } n++; P.forEach(q => { [...] }); bb[4] = Math.max(bb[4], f.h); });
4232  [...] const r0 = Br.tris, w0 = Bw.tris, bb = [1e9, 0, 1e9, -1e9, f.h, -1e9]; K.addContext(Bw, Br, { P, h: f.h, cls: f.cls, id: f.id }, null, {}); [...]
```

- 3522-3523: walls 0 to h and a lid at h. Lift by range in the callers (4152, 4232), exactly as for a cell's builders; and let `K.addContext` take the depth of the wall's foot (`o.foot`, at or below 0) in place of the two literal 0s and `u(0, 0), u(len, 0)`, so a block on a slope reaches the ground on its low side.
- 4151-4152, 4232: the box each run of triangles is culled by has its y fixed as 0 to the tallest block (`bb[1] = 0`, `bb[4] = f.h`). With lifted blocks it must be `min(lo)` to `max(base + h)`, or whole squares of the city are culled as the camera climbs.
- 4156, 4235: the wider city's walls are drawn with `M.wall`, so 2.3 applies to them too.

### 2.5 The outline of the one picked, the labels, the roof views

```
3525  K.solidOf = b => { [...] const h = Math.max(2.4, env.height(b)) + 0.25, Bd = new SE.MeshBuilder();
3526    rings.forEach(P0 => { const P = off(P0, -0.2); for ([...]) { [...] Bd.quad([a[0], 0, a[1]], [c[0], 0, c[1]], [c[0], h, c[1]], [a[0], h, a[1]], [dz / l, 0, -dx / l]); } SE.Poly.triangulate(P).forEach(t => Bd.tri([P[t[0]][0], h, P[t[0]][1]], [...], [0, 1, 0])); });
5322  function highlight() { const c = S.cur != null ? solid(S.cur) : null, h = [...]; R.setOutline('select', c ? [{ mesh: c }] : null); R.setOutline('hover', h ? [{ mesh: h }] : null); need(); }
5350  [...] for (const l of c.labels) { const d = Math.hypot(l.x - cp[0], l.y - cp[1], l.z - cp[2]); [...]
5354  [...] const dx = l.x - cp[0], dy = l.y - 1.2 - cp[1], dz = l.z - cp[2], [...] h = phys.raycast(cp, [dx / dl, dy / dl, dz / dl], dl - 0.6); seen = !h || !h.prism || h.prism.userData.id === l.id; [...]
3414  const lid = (Qr, y) => { [...] const a = [Qr[t[0]][0], y, Qr[t[0]][1]], [...] };
3419  [...] a3 = [P[i][0], eave, P[i][1]], c3 = [P[j][0], eave, P[j][1]], dq = [Qr[j][0], top, Qr[j][1]], e = [Qr[i][0], top, Qr[i][1]];
5079  RP.planes.forEach(pl => pl.tris.forEach(t => sub(t[0], t[1], t[2], pl.n, 0)));
5084  [...] t.under = t.p.map(p => { let u = 0; for (const tr of trees) if (tr.h > p[1] + 0.5 && Math.hypot(p[0] - tr.x, p[2] - tr.z) < tr.r * 0.95) { u = 1; break; } [...]
5085  return { tris, [...], sig: String(Math.round(env.height(b) * 4)) };
5107  for (const q of [1.5, 3, 5, 8, 12, 17, 24, 33, 45, 60]) { const x = ox + sd[0] * q, y = oy + sd[1] * q, z = oz + sd[2] * q; if (y > 70) break; for (const pr of phys.prismsIn(x, z, x, z, LNEAR)) { [...] if (y < pr.y1 && Poly.contains(pr.ring, x, z)) return 1; } }
5108  for (const t of G.trees) { const ky = t.r / Math.max(0.34 * t.h, 0.5), cx = t.x - ox, cy = (0.66 * t.h - oy) * ky, cz = t.z - oz, [...]
5112  [...] if (G && (G.sig !== String(Math.round(env.height(b) * 4)) || !treesSame(G))) { [...]
5120  Bd.tri(t.p[0], t.p[1], t.p[2], t.n, null, null, null, null, [...]); }
5122  return { G, mesh, item: mesh ? XR.add(mesh) : null, R, gen: lensGen, mix: b.mix };
```

- 3525-3526, 5322: the outline solid stands on 0. `setOutline` items take a `world` matrix (1853), so `K.solidOf` can stay as it is: `R.setOutline('select', c ? [{ mesh: c, world: M4.translation(M4.create(), 0, baseY(S.cur), 0) }] : null)`. The solids are cached by id (`solids`, 5320), which is fine because the lift is in the matrix.
- 5350-5354: label anchors are stored on the cell at 5015; lifted there. The occlusion ray (5354) meets the ground plane only as a non-prism hit, which it ignores (`!h.prism`), so a label behind a hill would still show: once `raycast` knows the terrain (2.8), treat a ground hit as hiding the label.
- 5079: `K.roofPlanes` returns heights from the floor. Lift the points as they go into `sub` (copies: two triangles of a plane share points at 3422), so that everything downstream (the shading at 5104-5110 and the mesh at 5120) is in world heights. Sketch: `const by = baseY(b.id), up = p => [p[0], p[1] + by, p[2]]; RP.planes.forEach(pl => pl.tris.forEach(t => sub(up(t[0]), up(t[1]), up(t[2]), pl.n, 0)));`
- 5084, 5108: a tree's top and crown are compared with the roof as if both stood on 0. Each tree needs its own ground: store `t.y = S.gy(t.x, t.z)` on the tree records when they are grown (5053) and use `t.y + t.h` and `t.y + 0.66 * t.h`.
- 5107: `if (y > 70) break;` stops the walk toward the sun 70 m up, measured from 0: make it `by + 70`. `y < pr.y1` is right once prisms are lifted. Ground that rises between a roof and the sun (a hillside) shades nothing in this test; that is an addition, not a fix.
- 5085, 5112: the roof's signature is its height alone; add the base (`+ ':' + Math.round(by * 4)`, in both places) so a roof is cut again when its ground changes.

### 2.6 Trees and lamps

```
3554  const tr = SE.Prim.cylinder(0.034, 0.018, 0.56, 7, false); for (let i = 1; i < tr.positions.length; i += 3) tr.positions[i] += 0.28; tr.keep = false; K.trunk = new SE.Mesh(dev, tr);
5053  list.forEach(t => { [...] ib.add(t.x, 0, t.z, j * TAU, t.r * 2, t.h, t.r * 2, k[0] * (0.9 + j * 0.2), k[1], k[2] * (0.9 + (1 - j) * 0.2), 1); });
5057  c.trees = { e, ib, n: list.length, list }; S.treeN += list.length; WIDE.treesDirty(c.key); need();
4210  [...] ib.add(q[0], 0, q[1], q[2] * TAU, rr * 2, hh, rr * 2, k[0] * (0.9 + q[3] * 0.2), k[1], k[2] * (0.9 + (1 - q[3]) * 0.2), 1); n++; }); });
5244  [...] if (LAMP.spots.length < 900) LAMP.spots.push([x, z, Math.atan2(-dz * side, dx * side)]); acc += 46; side = -side; } [...]
5246  if (!K.lampMesh) { const pole = Prim.cylinder(0.075, 0.05, 7.4, 8); for (let i = 1; i < pole.positions.length; i += 3) pole.positions[i] += 3.7; [...] }
5247  LAMP.ib = new InstanceBuffer(dev, LAMP.spots.length); LAMP.spots.forEach(s => LAMP.ib.add(s[0], 0, s[1], -s[2] + Math.PI / 2, 1, 1, 1)); [...]
5255  [...] e.transform.setPosition(s[0][0] + c * 1.35, 7.1, s[0][1] + sn * 1.35); e.get('Light').intensity = 190 * night; });
```

- 5053: the tree meshes start at their own y = 0 (3554 for the trunk), so the instance's y is the ground: `t.y = S.gy(t.x, t.z); ib.add(t.x, t.y - 0.15, t.z, ...)` (sunk a hand so the foot of the trunk is not in the air on the downhill side). The records are kept (`list`, 5057) and read by the roof views (2.5), which is why the height goes on the record.
- 5021, 4988: a cell's trees are grown again only when `idsOf(c)` changes (`ids + '#' + S.roadsVer`). Add the terrain's version there, or trees keep the heights of the first elevation that arrived.
- 4210: the backdrop trees, `ib.add(q[0], S.gy(q[0], q[1]), q[1], ...)`.
- 5244, 5247, 5255: keep the ground with each spot (`[x, z, angle, S.gy(x, z)]`), place the post at `s[3]` and the light at `s[0][3] + 7.1`. `lamps()` is called from `buildRoads()` (5171).

### 2.7 Streets, and what stands and moves on them

```
3530  K.ROADW = { major: [12, 0.1, 'asphalt'], street: [8.2, 0.09, 'asphalt'], service: [5.2, 0.085, 'asphalt'], alley: [4.2, 0.08, 'concrete'], drive: [3, 0.075, 'concrete'], path: [1.6, 0.07, 'concrete'] };
3531  K.ribbon = (Bd, pts, w, y, kind, offs, col) => {
3538    const up = [0, 1, 0], uv = p => [p[0] / tile, p[2] / tile];
3539    for (let i = 0; i + 1 < n; i++) { const a = [L[i][0], y, L[i][1]], b = [R[i][0], y, R[i][1]], c = [R[i + 1][0], y, R[i + 1][1]], d = [L[i + 1][0], y, L[i + 1][1]]; Bd.quad(a, b, c, d, up, [uv(a), uv(b), uv(c), uv(d)], col || WHITE, AX); }
3540    if (!offs && kind) for (let i = 0; i < n; i++) { const p = pts[i]; for (let s = 0; s < 10; s++) { [...] a = [p[0], y, p[1]], b = [p[0] + Math.cos(a0) * hw, y, p[1] + Math.sin(a0) * hw], c = [p[0] + Math.cos(a1) * hw, y, p[1] + Math.sin(a1) * hw]; Bd.tri(a, b, c, up, uv(a), uv(b), uv(c), WHITE, ax, ax, ax); } }
5167  S.roads.forEach(r => { const spec = K.ROADW[r.kind] || K.ROADW.street; K.ribbon(Bd, r.pts, spec[0], spec[1], spec[2]); if (r.kind === 'major' && !gfx.life) { K.ribbon(Pt, r.pts, 0.11, 0.115, null, 0.12, yel); [...] K.ribbon(Pt, r.pts, 0.12, 0.115, null, 5.4, wht); [...] } });
3648  [1, -1].forEach(sd => { const inner = shift(line, sd * (w.hw + 0.12)), outer = shift(line, sd * (w.hw + 2.0)), y0 = 0.085, y1 = 0.2;
3649    for (let i = 0; i + 1 < line.length; i++) { const a = [inner[i][0], y1, inner[i][1]], b = [inner[i + 1][0], y1, inner[i + 1][1]], c = [outer[i + 1][0], y1, outer[i + 1][1]], e = [outer[i][0], y1, outer[i][1]], uv = q => [q[0] / 3, q[2] / 3];
3651      Sd.quad([a[0], y0, a[2]], [b[0], y0, b[2]], b, a, [nx / nl, 0, nz / nl], [[0, 0], [1, 0], [1, 0.05], [0, 0.05]], [0.86, 0.86, 0.86, 1], AX); } });
3652  if (w.r.kind === 'major') { K.ribbon(Pt, line, 0.11, 0.115, null, 0.12, yel); K.ribbon(Pt, line, 0.11, 0.115, null, -0.12, yel); [...] K.ribbon(Pt, shift(piece(w, s, s + 3), o2), 0.11, 0.115, null, 0, white)); } }
3667  const bar = (d0, d1, a, b, col) => Pt.quad([n.x + dx * d0 + rt[0] * a, 0.117, n.z + dz * d0 + rt[1] * a], [n.x + dx * d1 + rt[0] * a, 0.117, [...]], [[...], 0.117, [...]], [[...], 0.117, [...]], [0, 1, 0], null, col);
3671  if (!inRange(px, pz, 700)) return; if (n.signal) sig[TR.phase(n, dx, dz)].add(px, 0, pz, yaw, 1, 1, 1); else stops.add(px, 0, pz, yaw, 1, 1, 1); }); }); });
3696  [...] fleet[c.ty].sets[c.d < 42 && nNear++ < 14 ? 'near' : c.d < 150 ? 'mid' : 'far'].add(c.x, 0, c.z, c.yaw, 1, 1, 1, c.col[0], c.col[1], c.col[2], 1);
3697  [...] V3.set(b.pos, c.x, t.H / 2, c.z); Q.fromAxisAngle(b.rot, UP, c.yaw); b.refresh(); nb++; } }
3702  for (const b of phys.bodies) { if (b.pos[1] - (b.max[1] - b.min[1]) / 2 > 1.6) continue; [...]
3707  [...] if (c.out) { V3.set(b.pos, 1e6, -50, 1e6); V3.set(b.vel, 0, 0, 0); continue; } [...] V3.set(b.pos, c.x, t.H / 2, c.z); Q.fromAxisAngle(qy, UP, c.yaw); Q.copy(b.rot, qy); V3.set(b.vel, c.hx * c.v, 0, c.hz * c.v);
3708  [...] fleet[c.ty].sets[dc < 55 ? 'mnear' : 'mfar'].add(c.x, 0, c.z, c.yaw, 1, 1, 1, c.col[0], c.col[1], c.col[2], c.brake === 2 ? 0.5 : c.brake ? 0.75 : 1); }
5307  [...] e.transform.setPosition(c.x + hx * 2.4, 0.75, c.z + hz * 2.4); Q.fromEuler(e.transform.rotation, Rd(-9), Math.atan2(-hx, -hz), 0); [...]
5356  [...] const s = cam.project([o.x, 0.4, o.z]); [...] put(s[0] * W, s[1] * H, r.name, 'se-lbl road', ''); } }
```

- 3531-3541 (`K.ribbon`): `y` is one height for the whole ribbon, written at every vertex (3539) and at every vertex of the round joints (3540). It has to become "that much above the ground at each vertex": `[L[i][0], S.gy(L[i][0], L[i][1]) + y, L[i][1]]` and so on (`S` is in `WorldKit`'s closure). Two more things are needed for that to be enough: the line must be cut into short steps first (street points can be 100 m apart; a straight quad between them goes through a rise or over a dip), and the joints' discs should be added only at the line's own points, not at the points added by cutting (ten triangles each). All eight callers (5167, 3652) keep their arguments.
- 3648-3651 (sidewalks and curbs): the walk's top at 0.2 and the curb's face from 0.085 to 0.2; each vertex takes the ground under it; `line` (3647, from `piece`) needs the same cutting into short steps.
- 3667 (crosswalks and stop bars): four corners at 0.117, each to take the ground under it. A bar is at most 2.6 m long, so a flat quad on four ground heights is close enough.
- 3671 (signals and stop signs), 3696 (parked cars), 3708 (moving cars): the literal 0 in `add(x, 0, z, ...)` becomes the ground. `InstanceBuffer.add` turns an instance about +Y only; a car on a grade needs `addMatrix` (476) with the pitch and roll of the ground, or it stands level with one end sunk (a 4.9 m car on a 10 percent grade is 25 cm out at each end).
- 3697, 3707: the cars' physics boxes sit at `t.H / 2`; add the ground. `-50` at 3707 is where a car that has left is parked, a million metres away; harmless.
- 3702: "a body whose underside is more than 1.6 m up is not in the traffic's way" is measured from 0: subtract the ground under the body.
- 5307: the headlight at 0.75 over 0: add the ground under the car.
- 5356: street names projected from 0.4 over 0: add the ground at `(o.x, o.z)`.
- The traffic itself (3872-4117), the network (3610), `nearestOnRoads` (5178) and street-mode `walk` (5186) are two-dimensional and need nothing.

### 2.8 Physics: the plane, the prisms, `floorAt`, the ray, the character

```
2628  constructor(engine) { [...] this.cell = 24; this.groundY = 0; this.ground = true; [...] this.groundFriction = 0.7; }
2632  addPrism(ring, y0, y1, userData) { const bb = Poly.bounds(ring), p = { id: uid(), ring, y0, y1, bb, ccw: Poly.area(ring) > 0, userData: userData || null, cells: [] }; [...]
2652  if (this.ground && b.min[1] < this.groundY) {
2653    if (k === 'box') { for (const c of b.corners()) if (c[1] < this.groundY) out.push({ a: null, b, n: [0, 1, 0], p: [c[0], this.groundY, c[2]], depth: this.groundY - c[1], mu: this.groundFriction }); }
2654    else for (const c of (k === 'sphere' ? [b.pos] : segEnds(b))) { const d = this.groundY - (c[1] - b.shape.r); if (d > 0) out.push({ a: null, b, n: [0, 1, 0], p: [c[0], this.groundY, c[2]], depth: d, mu: this.groundFriction }); }
2683  if (b.pos[1] < this.groundY - 60) { b.pos[1] = this.groundY + 30; V3.set(b.vel, 0, 0, 0); }     /* fell out of the world */
2694  if (this.ground && d[1] < -1e-6) hit((this.groundY - o[1]) / d[1], [0, 1, 0], { ground: true });
2709  floorAt(x, z, y, step) { let h = this.ground ? this.groundY : -Infinity; const near = this.prismsIn(x, z, x, z, [...]); for (const pr of near) if (pr.y1 <= y + step && pr.y1 > h && Poly.contains(pr.ring, x, z)) h = pr.y1; return h; }
2728  [...] for (const pr of near) { if (p[1] + this.step >= pr.y1 || p[1] + this.height <= pr.y0) continue; const h = W._prismSide(pr, p[0], p[2], r); [...]
2733  const fl = W.floorAt(p[0], p[2], p[1], this.step); if (p[1] <= fl) { p[1] = fl; this.vy = 0; this.grounded = true; } else if (!this.fly) this.grounded = p[1] - fl < 0.02;
5144  const floorTop = (x, z) => { let top = 0; for (const p of phys.prismsIn(x - 0.5, z - 0.5, x + 0.5, z + 0.5, NEARP)) if (p.y1 > top && Poly.contains(p.ring, x, z)) top = p.y1; return top; };
5145  const blockAt = (x, z, y) => { const r = 1.25; for (const p of phys.prismsIn(x - r, z - r, x + r, z + r, NEARP)) { if (y > p.y1 + 0.05) continue; if (Poly.contains(p.ring, x, z) || [...]) return true; } return false; };
5323  const pickAt = p => { const ray = cam.ray(p.x, p.y), h = phys.raycast(ray.origin, ray.dir, 4000); if (!h) return null; if (h.prism) { [...] } if (h.ground) return { ground: h.point }; return { other: h }; };
5380  [...] if (m === 'walk') { S.y = phys.floorAt(S.x, S.z, 0, 0.5); character.vy = 0; const pr = phys.prismsIn(S.x, S.z, S.x, S.z, []).find(p => Poly.contains(p.ring, S.x, S.z)); if (pr) { const o = nearestOnRoads(S.x, S.z, 80); if (o) { S.x = o.x; S.z = o.z; } S.y = 0; } } }
```

- 2628: the world has one horizontal plane. Give it a function instead, falling back on the plane so the engine's other uses keep working (sketch): `heightAt(x, z) { return this.terrain ? this.terrain(x, z) : this.groundY; }`, and the view sets `phys.terrain = S.gy` once.
- 2652-2654 (bodies on the ground): test each corner or end against `heightAt` at its own x and z; the contact point's y and the depth use that height. The first test (`b.min[1] < this.groundY`) must use the height under the body plus a margin for the slope across it. A contact normal of `[0, 1, 0]` keeps a crate from sliding down a hill; use the ground's normal if it should.
- 2683: "fell out of the world" is 60 m under the plane; a valley 60 m below the origin would throw every crate back up. Use `heightAt(b.pos[0], b.pos[2]) - 60`.
- 2694 (the ray): the plane is met by one division. A height field needs a march along the ray. This ray is the pick (5323: a click on the ground sends the camera, the drone or the craft there, 5337) and the labels' line of sight (5354). Left as it is, a click lands where the ray meets y = 0, which on raised ground is tens or hundreds of metres from where the person pointed. Sketch:

```js
/* sketch, in place of 2694: the first crossing of the ground along the ray, found by steps that lengthen with distance, then halved in */
if (this.ground) { if (!this.terrain) { if (d[1] < -1e-6) hit((this.groundY - o[1]) / d[1], [0, 1, 0], { ground: true }); }
  else { const lim = Math.min(max || 1e9, 8000), f = t => o[1] + d[1] * t - this.terrain(o[0] + d[0] * t, o[2] + d[2] * t); let t0 = 0, f0 = f(0);
    while (f0 > 0 && t0 < lim) { const t1 = Math.min(lim, t0 + Math.max(2, t0 * 0.03)), f1 = f(t1); if (f1 <= 0) { let a = t0, b = t1; for (let i = 0; i < 10; i++) { const m = (a + b) / 2; if (f(m) > 0) a = m; else b = m; } hit(b, [0, 1, 0], { ground: true }); break; } if (t1 >= lim) break; t0 = t1; f0 = f1; } } }
```

- 2709 (`floorAt`): `let h = this.ground ? this.heightAt(x, z) : -Infinity;`. With that one change the walking character follows the ground (2733 clamps its feet to `floorAt` and gravity brings it down a slope). Two small things: going downhill `this.grounded` flickers (the feet are let fall and caught each frame), so jumping is refused now and then; and nothing limits the slope a person can walk up.
- 2632, 2728 (prisms): `y0` and `y1` are absolute and every test uses them as such (`_prismPoint` 2643, the character's walls 2728, the ray 2696-2699, `floorAt`). So prisms need no change in the physics, only the right numbers when they are added (5015).
- 5144 (`floorTop`): `let top = 0` becomes `let top = S.gy(x, z)`. This single line gives the drone and the craft the terrain (they use `floorTop` through `floor`, 5287 and 5292), and the heads-up display its altitude above the ground (5149, 5154).
- 5145 (`blockAt`): right once prisms are lifted (it only compares with `p.y1`).
- 5380 (entering walk mode): the feet's height given to `floorAt` is the literal 0 and a person found inside a footprint is put on the street at `S.y = 0`. Both become the ground: `phys.floorAt(S.x, S.z, S.gy(S.x, S.z), 0.5)` and `S.y = S.gy(S.x, S.z)`.

### 2.9 The camera: `placeCamera` and each mode's eye

```
4929  const S = { ok: false, gen: 0, lat0: 0, lon0: 0, kx: 1, ky: 1, x: 0, z: 0, y: 0, yaw: 0, [...], orbit: { yaw: 30, pitch: -28, dist: 60, at: [0, 4, 0] }, [...] };
4930  const HEIGHT = { street: { eye: 1.7, pitch: 2 }, walk: { eye: 1.7, pitch: 0 }, drone: { eye: 38, pitch: -32 }, bird: { eye: 120, pitch: -58 }, orbit: { eye: 0, pitch: -28 }, alta: { eye: 30, pitch: -14 }, metro: { eye: 1400, pitch: -36 }, saucer: { eye: 60, pitch: -12 }, tictac: { eye: 60, pitch: -12 } };
5263  if (S.uapCam === 'belly' && !W) { [...] cx = Pn[0]; cy = Pn[1] - 1.4; cz = Pn[2]; }
5264  else { [...] cx = Pn[0] - fx * d; cy = Math.max(0.6, (SK.now ? SK.now.surge : -9) + 0.8, Pn[1] + 2.5 - fy * d); cz = Pn[2] - fz * d; }
5265  [...] cam.near = S.uapCam === 'belly' && !W ? clamp(Pn[1] * 0.03, 0.4, 5) : 0.5;
5266  const sd3 = (QUALITY[engine.quality] || QUALITY.high).shadowDistance * (Pn[1] > 600 ? 9 : Pn[1] > 90 ? 2.4 : 1.5); [...]
5269  else { [...] cx = a.x - fx * d; cy = Math.max(0.35, a.y + 0.5 - fy * d); cz = a.z - fz * d; }
5270  [...] cam.near = S.altaCam === 'payload' ? clamp(a.y * 0.03, 0.32, 3) : 0.3;
5271  const sd2 = [...].shadowDistance * (a.y > 60 ? 2.2 : 1.5); [...]
5272  if (m === 'orbit') { [...] S.x = o.at[0] - fx * o.dist; S.z = o.at[2] - fz * o.dist; eye = Math.max(0.6, o.at[1] - fy * o.dist); S.yaw = o.yaw; S.pitch = o.pitch; }
5273  else if (m === 'walk') eye = S.y + HEIGHT.walk.eye; else eye = HEIGHT[m].eye;
5274  { const fl = SK.now ? SK.now.surge : -9; if (fl > 0 && eye < fl + (m === 'orbit' ? 0.8 : 1.6)) eye = fl + (m === 'orbit' ? 0.8 : 1.6); }   /* flood water deeper than the eye: afloat on it */
5275  t.setPosition(S.x, eye, S.z); [...] cam.fov = S.fov; cam.near = clamp(eye * 0.03, 0.3, 5);
5367  if (S.mode === 'orbit') { S.orbit.at = [x, h * 0.5, z]; S.orbit.dist = clamp(Math.max(h * 2.2, 34), 20, 400); [...] }
5368  const d = [...], eye = HEIGHT[S.mode].eye, pitch = clamp(DEG * Math.atan2(h * 0.55 - eye, d), -80, 45);
5379  if (m === 'orbit') { [...] S.orbit.at = [x, h * 0.5, z]; [...] } else { const y = Rd(S.yaw); S.orbit.at = [S.x + Math.sin(y) * 30, 3, S.z - Math.cos(y) * 30]; S.orbit.dist = 55; } [...]
5436  project(lat, lon, up) { const [x, z] = toL(lat, lon), s = cam.project([x, up, z]); return s ? [s[0] * cv.clientWidth, s[1] * cv.clientHeight] : null; },
```

- 5273, 5275: in street, drone, bird and metro modes the eye's world height is the mode's constant. It becomes `ground + HEIGHT[m].eye`. In street mode take the ground exactly under the camera (the street's surface). In drone, bird and metro mode take a smoothed height (a value eased toward `S.gy(S.x, S.z)`, quicker upward than downward), or the view heaves over every rise as it moves; metro mode moves at 320 m/s (5278). Walk mode already works from `S.y`, which the physics sets.
- 5275 and 5265, 5270: `cam.near` is taken from the eye's (or the craft's) world height as if it were the height above the ground: `clamp(eye * 0.03, 0.3, 5)`. Use the height above the ground, or at 1,000 m of elevation a person in the street has a near plane of 5 m and sees through the wall beside them.
- 5266, 5271: the shadows' reach is chosen from the craft's world height (`Pn[1] > 600`, `a.y > 60`): also to be the height above the ground.
- 5264, 5269, 5272: the chase cameras and the orbit camera are kept above 0.6 m and 0.35 m over y = 0. They must be kept above the ground under the camera's own position, which is not the craft's (`S.gy(cx, cz) + 0.6`; note `cz` is assigned after `cy` on those lines).
- 5274 and 5264: the flood's level is compared with the eye as an absolute height (2.11).
- 5367, 5379 (the point the orbit camera circles): `h * 0.5` over 0, and `3` over 0 when no building is picked. Add the building's base, and the ground.
- 5368 (`faceAt`): the pitch to a building's upper half is worked from the mode's eye height and the building's height as if both stood on 0: `Math.atan2(baseY(b.id) + h * 0.55 - (S.gy(S.x, S.z) + eye), d)`. Likewise the drone's and the craft's camera at 5365 and 5366 (`h * 0.5 - a.y`).
- 5436 (`project`): `up` is used as a world height. If callers mean "this far above the ground there", add `S.gy(x, z)`. (The module in `scout.js` does not call it today.)
- `cam.far = 120000` (4918) stands; the far ground reaches 90 km plus a tile.

### 2.10 The drone and the craft

```
4504  A.place = (x, z, yaw, floorY) => { st.warn = ''; st.x = x; st.z = z; st.y = floorY || 0; [...] };
4518  if (st.mode === 'Landed') { st.y = floor; [...] }
4535  const f2 = env.floor(nx, nz); if (ny <= f2) { ny = f2; if (st.vy < 0) { [...] st.mode = 'Landed'; [...] } }
4871  if (W.phase === 'turn') { [...] if (st.y < floor + 45) st.y += 60 * dt; [...] }
4885  let nx = st.x + st.vx * dt, nz = st.z + st.vz * dt, ny = clamp(st.y + st.vy * dt, 0, AS.ceilingM);
4886  if (ny < 90 && env.block(nx, nz, ny - 1)) { [...] }
4887  const f2 = env.floor(nx, nz) + 1.6; if (ny < f2) { ny = f2; if (st.vy < 0) st.vy = 0; }
5287  [...] UAP.update(dt, { floor: (x, z) => Math.max(floorTop(x, z), fl), block: blockAt }); [...]
5292  [...] ALTA.update(dt, { floor: (x, z) => Math.max(floorTop(x, z), SK.now ? SK.now.surge : -9), block: blockAt, wind: [...] }) [...]
5338  [...] UAP.goTo(q[0], q[1], Math.max(2.4, env.height(h.b)) + 30); [...]
5376  if (isUap(m)) { [...] if (!isUap(was)) UAP.place(S.x, S.z, S.yaw, Math.max(floorTop(S.x, S.z) + 34, was === 'metro' ? 900 : was === 'bird' ? 120 : 48)); [...] }
5378  if (m === 'alta') { [...] ALTA.place(S.x, S.z, S.yaw, floorTop(S.x, S.z)); ALTA.show(true); ALTA.takeoff(28); [...] }
5414  UAP.arriveAt(q[0], Math.max(floorTop(q[0], q[1]) + 34, 60), q[1]); [...]
5425  [...] UAP.goTo(q2[0], q2[1], tb ? Math.max(2.4, env.height(tb)) + 34 : null); [...]
5427  [...] UAP.place(S.x, S.z, yaw != null ? yaw : S.yaw, 60); [...] if (S.mode === 'alta' && ALTA) { ALTA.place(S.x, S.z, yaw != null ? yaw : S.yaw, 0); ALTA.takeoff(28); } [...]
```

- The Alta X is clean: everything in `A.update` is relative to `env.floor` (4518, 4535, and `st.y < floor + 28` at 4525), and `takeoff` climbs by a difference (4509). Only the two callers pass a literal: 5427 (`0`, to be `floorTop(S.x, S.z)`); 5378 is already right.
- 4885: the craft is held between y = 0 and `AS.ceilingM` (1,400, line 4806). On raised ground the ceiling is below the floor; in a valley below the origin the craft cannot come down. Hold it between the floor and `floor + AS.ceilingM` (the speed already follows the height above the floor: `agl`, 4868 and 4855).
- 4886: buildings are tested only below y = 90. Make it `ny - floor < 90`, or drop the test.
- 5338, 5425: "over the roof" is the building's height plus 30 or 34 over 0: add `baseY`.
- 5376, 5414, 5427: the heights the craft is put down at mix `floorTop + 34` with absolute floors of 48, 60, 120 and 900. Make all of them heights above `floorTop`.
- 5287, 5292: the flood's level `fl` is used as an absolute floor (2.11).
- 5385 (`state()`): `alt: UAP.state.y` and `alt: ALTA.state.y` are handed to the module as altitudes. They are world heights; if the module shows them, give it the height above `floorTop`, as the heads-up display does (5149, 5154).

### 2.11 The weather: the flood plane, the bands of spray, lightning; and the air

```
5224  const SK = SE.StormKit(engine, {}); S.storm = 0; S.surge = 0; S.surgeNote = ''; S.surgeAt = null;
4665  const now = { [...], spray: 0, debris: 0, surge: -1.5 };
4710  [...] surge: (o2 && o2.surge > 0.05) ? o2.surge : -1.5 };
4726  [...] waterOn(now.surge > -1.2); if (water && water.active) { const cp = cam.position; water.transform.setPosition(Math.round(cp[0] / 50) * 50, now.surge, Math.round(cp[2] / 50) * 50); }
4751  const N = [...], hw = [...], gy = o.ground ? o.ground() : 0;
4753  if (rk > 0.4) layer(p, 1, [26, 0.42, 26], (SPRAY[tier] || 300) * 0.7 * rk, 1, 0.42, 0, gy, 0.06 * rk, 5);   /* heavy rain: spray standing just above the pavement */
4754  if (now.spray > 0.01) layer(p, 1, [72, 9, 72], [...], 1, 2.1, 0, gy, 0.02 + 0.035 * now.spray, 3);
4755  if (now.debris > 0.5) layer(p, 2, [64, 22, 64], now.debris * (DEBRIS[tier] || 0.5), 2, 0.085, 0, gy, 1, 4);
4693  const cloud = rnd() < 0.36, segs = [], top = [x + (rnd() - 0.5) * 500, 1480, z + (rnd() - 0.5) * 500];
4698  walk(top, [x, 0, z], 330, 6, 1); }
4700  const dx = top[0] - cp[0], dy = (cloud ? 1480 : 700) - cp[1], dz = top[2] - cp[2], dl = Math.hypot(dx, dy, dz) || 1;
1280  float dy = d.y * u_fog.y, f = [...], od = u_fog.x * exp(-max(u_camPos.y, 0.0) * u_fog.y) * dist * f;
1331  [the same expression in applyFogVol]
1737  u_fog: [env.fogDensity, 1 / Math.max(env.fogHeight, 1), env.fogSun, s.fog ? 1 : 0], [...]
2058  float dens = u_fog.x * exp(-max(p.y, 0.0) * u_fog.y), Tr = exp(-dens * dt), vz = t * zPer, sh = shadow1(p, vz);
2022  float cloudShadow(vec3 wpos, vec3 L) { [...] vec3 p = wpos + L * ((2200.0 - wpos.y) / L.y); [...] }
2073  const float RE = 6360000.0, C0 = 1500.0, C1 = 3300.0;
2077  h = (length(p + vec3(0.0, RE, 0.0)) - RE - C0) / (C1 - C0); if (h <= 0.0 || h >= 1.0) return 0.0;
2087  float ry = RE + max(u_camPos.y, 0.0), b = ry * dir.y, c0 = ry * ry - (RE + C0) * (RE + C0), [...]
```

- 4751, 5224: the band that spray and debris keep to has its floor at `o.ground()`, and the view makes the kit with no options. Pass the ground under the camera: `SE.StormKit(engine, { ground: () => S.gy(S.x, S.z) })`. The band is level (one uniform, `u_q.y`, 4610 and 4618), so on a slope it is right under the camera and off to the sides: 26 m and 72 m out, the ground can be several metres above or below it.
- 4726: the flood is a level plane at `now.surge`, a depth that is used as a world height. On terrain it has to be the ground where the surge was asked for plus the depth: keep `S.surgeY0 = S.gy(S.x, S.z)` in `surgeHere` (5225) and put the plane at `S.surgeY0 + now.surge`. The same sum replaces `SK.now.surge` in the four places the view reads it as a height (5264, 5274, 5287, 5292), and the "off" value -1.5 (4665, 4710) and the test `> -1.2` stay as depths. California has no hurricane surge, so `env.surge` may simply not be given (5226 then leaves the depth at 0); the plane is then never shown. It is still a level plane 600 km across: on sloping ground it floods everything downhill of the camera.
- 4693-4700 (lightning): the cloud's base at 1,480 and the foot of the bolt at 0 are world heights. Use the ground at the strike, and that plus 1,480.
- 1280, 1331, 2058 (haze): the air thins with world height from 0, with a scale of 90 m (665; 420 in a storm, 4709). At 300 m over the datum the haze is 4 percent of what it is at 0, and below 0 it stops thickening. Give the lighting pass, the fog pass and the transparent pass one more number, the height the haze is measured from (the ground under the camera, eased), set where `u_fog` is set (1737): `exp(-max(u_camPos.y - u_fogBase, 0.0) * u_fog.y)` and `max(p.y - u_fogBase, 0.0)`.
- 2022, 2073-2087 (clouds): the slab is 1,500 to 3,300 m over y = 0 and its shadow is cast from 2,200. Much of California's high ground is above 1,500 m (with a datum, wherever the ground is 1,500 m above the origin's): the camera is then inside or above the slab, and at 2087 the start of the march goes negative. Lift the slab by the same base (`C0 + u_fogBase` and so on), or hold it at a fixed height above sea level and accept that mountains stand in it.
- A storm's own numbers (wind, rain rate, fog density) do not depend on height.

### 2.12 Shadows and reflections

- The sun's cascades are fitted to slices of the view (1643-1658), not to the ground, so they follow the camera up a mountain unchanged. The shadow pass draws both faces with a slope-scaled offset (`polygonOffset: [2, 4]`, 1691), so a ground mesh that casts onto itself is covered.
- What casts: a renderer whose `castShadow` and whose material's `castShadow` are both true and which is nearer than the shadows' reach (1679). The reach is 140 to 340 m by tier (2424-2428), times 1 to 9 by mode (5266, 5271, 5276), and casters are taken from 420 m beyond that toward the sun (`shadowCasterReach`, 1864). The far ground and the wider city's ground are made not to cast (4976-4977, 4132, 4143). So: the cell's ground will shade itself and the buildings on it (the "Ground and roofs" part casts, 5017-5018), and that is all. A ridge a kilometre off never shades the valley, and at sunrise and sunset the picture will show sun where the mountain's shadow should be. That needs its own term (a horizon angle per ground post, or a low shadow map of the far tiles) and is not part of the smallest patch.
- Reflections are traced through the depth buffer (1465) and fall back on a cube of the sky whose lower half is one colour, "the lit ground below" (1071-1077, 1153-1157): a horizontal ground lit by the sun at its angle to the vertical. On a north slope the bounce is too bright; nothing breaks.
- Wetness, puddles and running water are chosen from the surface's normal and its x and z (947-952), not its height: on a slope the water runs, as written.

### 2.13 Checked and found free of the assumption

| What | Where | Why it is safe |
|---|---|---|
| Traffic | 3872-4117 | Cars are `{ x, z, yaw }` on lane lines; y is written only where instances are placed (2.7) |
| The car shader | 3726-3791 | Works from `v_aux.xyz`, the model's own coordinates |
| The glow shader | 3164-3194 | Works from `a_aux` and the view direction |
| Tree detection, `roofLum`, tree masks | 3559-3579, 5094-5102, 5048-5050 | Read the photograph in plan |
| Footprint tools (`K.ringsOf`, `Poly.*`, `off`) | 3354-3374, 156-200 | `[x, z]` rings |
| Street-mode walking, nearest street, the network | 5178-5206, 3610-3631 | Two-dimensional |
| `plan`, `pump`, `index`, `cellOf`, `rectOf`, `farTiles`' choice of tiles, `W.update` | 5024-5042, 4945-4947, 4970-4974, 4169-4175 | Distances in x and z only |
| The rain | 4606-4631 | Wraps round the camera in all three axes; only spray and debris have a floor (2.11) |
| The roof-view shader, the outline pass | 1942-1985, 1851-1857 | Take a world matrix; no height read |
| `dropCrate` | 5398-5400 | Placed from the camera |
| Rooftop equipment layouts | 4297-4440 | Building-local; lifted with the cell's builders (2.2) |

## 3. How building geometry is batched, and whether a building can be lifted after the fact

Short answer: yes. A building's vertices are contiguous in each of the cell's builders, positions are a plain growing `Float32Array`, and nothing reorders them until `build()`. Record each builder's write position before a building, add the base to y for everything written after it. Do not thread the base through the emitters: the wall shader, the wall texture's uv, the equipment layouts and the roof views all rely on heights measured from the building's own floor. Two small things are threaded instead: the roof callback (it writes into other cells' builders, clipped) and the depth of the wall's foot on a slope.

### 3.1 The `MeshBuilder` API (492-521) and how it stores positions

```
409  class Grow {   /* a typed array that grows */
410    constructor(Type, n) { this.T = Type; this.a = new Type(n || 1024); this.n = 0; }
411    need(k) { if (this.n + k > this.a.length) { const b = new this.T(Math.max(this.a.length * 2, this.n + k)); b.set(this.a.subarray(0, this.n)); this.a = b; } }
412    done() { return this.a.subarray(0, this.n); }
413  }
492  class MeshBuilder {
493    constructor(o) { o = o || {}; this.p = new Grow(Float32Array, 3072); this.n = new Grow(Float32Array, 3072); this.u = new Grow(Float32Array, 2048); this.c = new Grow(Uint8Array, 4096); this.x = o.aux ? new Grow(Float32Array, 4096) : null; this.tris = 0; this.owner = o.owners ? [] : null; }
494    get empty() { return !this.tris; }
495    /* a, b, c: [x, y, z]; nrm decides the winding; ua..uc: [u, v]; col: [r, g, b, a] in 0..1 (sRGB bytes on the card); xa..xc: aux */
496    tri(a, b, c, nrm, ua, ub, uc, col, xa, xb, xc, own) {
498      if (cx * cx + cy * cy + cz * cz < 1e-12) return;
499      if (nrm && cx * nrm[0] + cy * nrm[1] + cz * nrm[2] < 0) { let t = b; b = c; c = t; t = ub; ub = uc; uc = t; t = xb; xb = xc; xc = t; }
501      const P = this.p, N = this.n, U = this.u, C = this.c; P.need(9); N.need(9); U.need(6); C.need(12);
502      let i = P.n; const pa = P.a, na = N.a; pa[i] = a[0]; pa[i + 1] = a[1]; pa[i + 2] = a[2]; pa[i + 3] = b[0]; pa[i + 4] = b[1]; pa[i + 5] = b[2]; pa[i + 6] = c[0]; pa[i + 7] = c[1]; pa[i + 8] = c[2]; P.n += 9;
507      if (this.x) { const X = this.x; X.need(12); i = X.n; const xx = X.a; if (xa) { xx.set(xa, i); xx.set(xb, i + 4); xx.set(xc, i + 8); } else xx.fill(0, i, i + 12); X.n += 12; }
508      if (this.owner) this.owner.push(own || 0); this.tris++;
510    quad(a, b, c, d, nrm, uv, col, aux, own) { this.tri(a, b, c, nrm, [...]); this.tri(a, c, d, nrm, [...]); }
512    box(cx, cy, cz, hx, hy, hz, yaw, col, uvScale) { [...six quads...] }
519    data(o) { o = o || {}; const d = { positions: this.p.done().slice(), normals: this.n.done().slice(), uvs: this.u.done().slice(), colors: this.c.done().slice(), aux: this.x ? this.x.done().slice() : null, name: o.name, keep: o.keep }; return d; }
520    build(dev, o) { if (!this.tris) return null; o = o || {}; const d = this.data(o); let m; if (o.clusters) { const cl = clusterize(d, o.clusters === true ? 384 : o.clusters); m = new Mesh(dev, d); m.clusters = cl; } else m = new Mesh(dev, d); if (this.owner) m.owner = this.owner; return m; }
```

What matters for a lift:

- Five parallel arrays: `p` (positions, 3 floats a vertex), `n` (normals, 3), `u` (uv, 2), `c` (colour, 4 bytes), `x` (aux, 4 floats, only for a builder made with `{ aux: true }`). There is no index buffer: every triangle appends three vertices, so 9 floats to `p`, 6 to `u`, 12 bytes to `c`, 12 floats to `x`.
- Vertex number v is at `p.a[3v .. 3v + 2]`, `u.a[2v ..]`, `c.a[4v ..]`, `x.a[4v ..]`. `p.n` is the number of floats written so far; the next vertex is number `p.n / 3`.
- `p.a` is replaced by a larger array when it fills (411). Keep offsets (`p.n`), never a reference to `p.a`, across calls that add triangles.
- A triangle with no area is dropped before anything is written (498), so the five arrays never get out of step.
- Normals are flat (one for the triangle: the one given, or the face's); the winding is turned to agree with the normal given (499). A constant lift changes neither.
- `data()` copies the arrays; `build()` makes the `Mesh`, whose bounds are measured from the positions then (431). With `clusters`, `clusterize` re-sorts the triangles (530-534). So a recorded range is good until `build()` and not after: lift before building. (The wider city sets its own runs from builder order and does not call `clusterize`, 4155.)
- `own` and `{ owners: true }` give every triangle a tag kept on the mesh. Nothing in the world uses it today; it is there if a later change wants to find a building's triangles after `build()`.

### 3.2 The builders of a cell and who writes into them

```
4996  const B = { wall: new MB({ aux: true }), trim: new MB(), fine: new MB(), glass: new MB(), glow: new MB({ aux: true }), equip: new MB() }, roofs = new Map();
4997  const roofB = (X, Y) => { const k = X + '/' + Y; let r = roofs.get(k); if (!r) { const im = X === c.X && Y === c.Y ? c.img : imagery(X, Y), rc = rectOf(X, Y); r = { b: new MB(), im, rc, uv: p => [(p[0] - rc.x0) / (rc.x1 - rc.x0), (p[2] - rc.zN) / (rc.zS - rc.zN)] }; roofs.set(k, r); im.users.add(c.key); c.uses.push(im); } return r; };
4998  const own = roofB(c.X, c.Y), inR = p => p[0] >= rect.x0 && p[0] <= rect.x1 && p[2] >= rect.zN && p[2] <= rect.zS;
5017  const part = (name, Bd, mat, o) => { if (Bd.empty) return; const mesh = Bd.build(dev, { name: name + ' ' + c.key, clusters: o && o.cluster ? o.cluster : Bd.tris > 900 ? 320 : false }), e = scene.createEntity(name, { parent: c.group, transient: true }), mr = e.add('MeshRenderer'); mr.mesh = mesh; mr.material = mat; mr.pickable = false; [...] c.parts.push({ e, mesh }); };
5018  roofs.forEach((r, k) => part(k === c.key ? 'Ground and roofs' : 'Roofs over ' + k, r.b, r.im.mat));
5019  part('Walls', B.wall, M.wall); part('Trim', B.trim, M.trim, { far: 420 }); part('Window frames and bars', B.fine, M.trim, { far: 260, noShadow: true, cluster: 96, fineSize: 0.05 }); part('Glass', B.glass, M.glass, { noShadow: true }); part('Glow', B.glow, M.glow, { noShadow: true }); part('Rooftop and yard equipment (modelled)', B.equip, M.equip, { far: 520 });
```

| Builder | Mesh and material | Written by | Lift |
|---|---|---|---|
| `B.wall` (aux) | "Walls", `M.wall` (facade shader) | `wallQuad` (3437) | by range |
| `B.trim` | "Trim", `M.trim` | doors, sills, shutters, soffit, fascia, foundation, parapet, coping (3461-3497) | by range |
| `B.fine` | "Window frames and bars", `M.trim` | frames and bars (3460, 3462, 3472) | by range |
| `B.glass` | "Glass", `M.glass` | `w.face(B.glass, ...)` (3456) | by range |
| `B.glow` (aux) | "Glow", `M.glow` | shell, pool, edge lines (3503-3509) | by range; the pool's vertices (aux.y = 1) take the ground under each of them instead |
| `B.equip` | "Rooftop and yard equipment", `M.equip` | `HV.exterior(b, B.equip)` (5014, 4446) | by range (same marks: it is called right after the building) |
| `roofs.get(key).b`, one per photograph the cell's roofs reach | "Ground and roofs" / "Roofs over X/Y", the photograph's material | `B.roofTri` (5000-5004), and the ground quad (4999) | inside `B.roofTri`: the triangles of one building go to several builders, clipped |

A building's rings, heights and centre come back from `K.addBuilding` (`out`, 3434 and 3511) and are used for the prism and the label (5015).

### 3.3 The lift, as it would be written (sketch for 5000-5015)

```js
/* sketch. LIFT: the builders K.addBuilding and HV.exterior write into; B.dy: the floor of the building being written */
const LIFT = [B.wall, B.trim, B.fine, B.glass, B.glow, B.equip];
B.roofTri = (a, b, d, n) => { const y = B.dy || 0; if (y) { a = [a[0], a[1] + y, a[2]]; b = [b[0], b[1] + y, b[2]]; d = [d[0], d[1] + y, d[2]]; }   /* copies: 3490 passes one array to two calls */
  /* ... then exactly as 5001-5003 ... */ };
for (const b of all) {
  const rings = K.ringsOf(b); if (!rings.length) continue;
  const gb = baseOf(rings);                                   /* { y: the floor, lo: the lowest ground under the footprint } (3.4) */
  const at = LIFT.map(Bd => Bd.p.n); B.dy = gb.y; let g = null;
  try { g = K.addBuilding(B, b, { detail: c.detailWant, nearRoad: S.roads.length ? nearRoad : null, rings, foot: gb.lo - gb.y - 0.3 }); } catch (e) { g = null; }
  if (g && gfx.roofKit !== false) { try { HV.exterior(b, B.equip); } catch (e) { /* this one goes without */ } }
  LIFT.forEach((Bd, k) => { const P = Bd.p.a, X = Bd === B.glow ? Bd.x.a : null;       /* read p.a only now: it may have grown */
    for (let i = at[k]; i < Bd.p.n; i += 3) { const ay = X ? X[i / 3 * 4 + 1] : 0;
      if (ay > 0.5 && ay < 1.5) P[i + 1] = S.gy(P[i], P[i + 2]) + 0.17;                  /* the glow's pool lies on the ground under each of its corners */
      else P[i + 1] += gb.y; } });
  B.dy = 0; if (!g) continue; n++;
  g.rings.forEach(r => c.prisms.push(phys.addPrism(r.P, gb.lo - 1, gb.y + r.h, { id: b.id })));
  BASE.set(b.id, gb.y);                                        /* for the outline, the roof views, the cameras, the craft */
  if (b.extra) nx++; else c.labels.push({ id: b.id, x: g.cx, y: gb.y + g.top + 1.4, z: g.cz });
}
```

Inside `K.addBuilding` only this is threaded:

| Line | As it stands | Becomes |
|---|---|---|
| 3430 | `const rings = K.ringsOf(b); if (!rings.length) return null;` | `const rings = o.rings \|\| K.ringsOf(b); [...]` and `const y0 = o.foot \|\| 0;` (at or below 0: how far under the floor the walls go on) |
| 3483 | `wallQuad(a, c, 0, eave, eave);` | `wallQuad(a, c, y0, eave, eave);` |
| 3496 | `wallQuad(a, c, 0, hRaw, hRaw);` | `wallQuad(a, c, y0, hRaw, hRaw);` |
| 3486 | `ring(Wf, Wf, 0, 0.34, B.trim, TRIM.found, false);` | `ring(Wf, Wf, y0, 0.34, B.trim, TRIM.found, false);` |
| 3503 | `B.glow.quad([a[0], 0, a[1]], [c[0], 0, c[1]], [c[0], sTop, c[1]], [...]` | the two 0s become `y0` (the glow's shell reaches the ground on the low side) |

`wallQuad` writes `uv(s0, y0)` for the foot (3437), so the wall's texture and the shader's height (2.3) simply continue below the floor: a height under 0 is ground floor with no window (`yb > y0` fails at 3251) and takes the grime at the foot (3207).

Why the base itself is not threaded:

1. The wall shader and the wall's uv need heights from the floor (2.3). Lifting positions alone leaves them right.
2. `H.layout` caches a building's equipment boxes with their heights (4296-4298); they must stay building-local.
3. `K.roofShape` and `K.roofPlanes` are shared by the walls and the roof views (comment at 3396-3399: "The walls and the roof views both stand on this"); one lift each, applied by the callers, keeps them in step.
4. It is one loop against some forty literal heights in the thirteen emitters of the table in 2.2.

Caveats:

- If `K.addBuilding` throws half way (the `try` at 5014), what it had already written stays in the builders. The sketch lifts it all the same, so a half-built building at least stands on the ground.
- The lift must be done before `part()` (5017-5019), which calls `build()`.
- Roof triangles are not in `LIFT`; the cell's ground is in `own.b` with the roofs and must not be lifted.

### 3.4 A building's floor: `baseOf(rings)` and `baseY(id)`

```js
/* sketch. lo, hi: the lowest and highest ground under the corners of the footprint. The floor: half way, but never more than a metre below the highest ground */
const baseOf = rings => { let lo = Infinity, hi = -Infinity; for (const P of rings) for (const p of P) { const y = S.gy(p[0], p[1]); if (y < lo) lo = y; if (y > hi) hi = y; } return { lo, hi, y: Math.max((lo + hi) / 2, hi - 1) }; };
const BASE = new Map(), baseY = id => { if (BASE.has(id)) return BASE.get(id); const b = env.byId(id); return b ? baseOf(K.ringsOf(b)).y : 0; };
```

The rule for `y` is a judgment to be tuned by eye; the mechanism is what the patch needs: `y` for the lift, `lo` for the foot of the walls and of the prism. `BASE` is filled by `buildCell`, read by `highlight` (5322), `faceAt` (5364-5368), `setHeight` (5379), the double click (5338), `open` (5425) and `lensGeom` (5079), and cleared in `recenter` (5390, beside `solids.clear()`).

### 3.5 The ground is better not put through `MeshBuilder`

A grid of N by N quads through `MeshBuilder` is 6 N² vertices of 36 bytes with flat normals. `Mesh` takes indexed data directly (417-432), as `Prim.plane` makes it (568-569): (N + 1)² vertices of 32 bytes with a normal each. Sketch:

```js
/* sketch: a tile's ground as an indexed grid. drop: metres to lower it by (0 for a cell). The triangles are split as Prim.plane splits them (569). */
function groundData(r, N, drop, name) {
  const n1 = N + 1, P = new Float32Array(n1 * n1 * 3), Nn = new Float32Array(n1 * n1 * 3), U = new Float32Array(n1 * n1 * 2), I = new Uint16Array(N * N * 6), e = (r.x1 - r.x0) / N;
  for (let j = 0, k = 0; j <= N; j++) for (let i = 0; i <= N; i++, k++) { const x = r.x0 + (r.x1 - r.x0) * i / N, z = r.zN + (r.zS - r.zN) * j / N;
    P[k * 3] = x; P[k * 3 + 1] = TERR.h(x, z) - drop; P[k * 3 + 2] = z; U[k * 2] = i / N; U[k * 2 + 1] = j / N;
    const sx = (TERR.h(x + e, z) - TERR.h(x - e, z)) / (2 * e), sz = (TERR.h(x, z + e) - TERR.h(x, z - e)) / (2 * e), l = Math.hypot(sx, 1, sz);   /* the slope from the height function itself, so two tiles agree along their shared edge */
    Nn[k * 3] = -sx / l; Nn[k * 3 + 1] = 1 / l; Nn[k * 3 + 2] = -sz / l; }
  for (let j = 0, q = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = j * n1 + i, b = a + 1, c = a + n1, d = c + 1; I[q++] = a; I[q++] = c; I[q++] = b; I[q++] = b; I[q++] = c; I[q++] = d; }
  return { name, positions: P, normals: Nn, uvs: U, indices: I };
}
/* in buildCell, in place of 4999: */
{ const mesh = new Mesh(dev, groundData(rect, 16, 0, 'Ground ' + c.key)), e = scene.createEntity('Ground', { parent: c.group, transient: true }), mr = e.add('MeshRenderer'); mr.mesh = mesh; mr.material = c.img.mat; mr.pickable = false; c.parts.push({ e, mesh }); }
```

- Posts and slopes are taken from the terrain kit's own function (`TERR.h`, 4.1), not from `S.gy`: `S.gy` answers from built cells' posts (below), and a mesh made from it would depend on which neighbour happened to be built first.
- `c.parts` is what `disposeParts` destroys (4991), so the ground goes with the cell's other parts. The material is the photograph's (`c.img.mat`), which `own` already registers as used (4997).
- The winding is `Prim.plane`'s (569), front face up; the G-buffer pass culls back faces unless the material is two-sided (1692).
- Shared edges: `rectOf(X + 1, Y).x0` and `rectOf(X, Y).x1` are the same expression (`toL(..., t2lon(X + 1, zz))`, 4946), and the posts along an edge are computed from the same two corner values, so neighbouring cells agree to the last bit provided `TERR.h` returns the same thing for both. It does not if one was built before finer elevation arrived and the other after: the terrain's version has to be in the cell's signature (4987).
- If the walker, the cars and the buildings are to stand exactly on what is drawn, `S.gy` inside a built cell has to give the height of the drawn triangle, not of the elevation raster. With the split above, in a quad with corners `ha` (x0, zN), `hb` (x1, zN), `hc` (x0, zS), `hd` (x1, zS) and local u, v in 0..1: `u + v <= 1 ? ha + u * (hb - ha) + v * (hc - ha) : hd + (1 - u) * (hc - hd) + (1 - v) * (hb - hd)`. Keep the cell's (N + 1)² post heights on the cell (`c.hgt`) and answer `S.gy` from them: that is also the cache that makes rebuilding a cell cost nothing in elevation lookups (section 5).

### 3.6 The other batches

- The wider city (`build(t)`, 4147-4157) and the skyline (`skyBuild`, 4228-4237) write every block of a square through `K.addContext` into two builders, `Br` (lids) and `Bw` (walls). The same recipe: note `Bw.p.n` and `Br.p.n` before each `K.addContext`, lift after it, pass `foot`, and widen the culling boxes (2.4).
- Streets, sidewalks and markings are not per-object batches: each vertex takes its own ground (2.7).
- Instanced things (trees, lamps, signals, signs, cars) carry their height in the instance (2.6, 2.7).
- The outline and the roof views are single meshes that take a world matrix (1853, 1918).

## 4. The smallest set of hooks, in order of dependency; and where a smooth height function is not enough

### 4.1 Hook 0: the height function, its versions and its datum

Everything else calls this, so its shape decides the patch.

- **One synchronous function, `S.gy(x, z)`.** `buildCell`, the physics step and `placeCamera` all run inside a frame and cannot wait. `S` is the right place: it is passed to every kit (4938-4949), and `K.ribbon`, `StreetKit` and `WideKit` can read it with no change to their signatures. Declare it in the state as `gy: () => 0` (4929), so a build with no elevation (Louisiana) behaves exactly as today.
- **A terrain kit beside `WIDE`** (made at 4949, with the same tile arithmetic handed in: `rectOf, cellOf, lon2t, lat2t, t2lon, t2lat, toLL`). It needs: `h(x, z)` (the finest elevation loaded at that place, the datum's level where none is); `ready(rect)` and `want(rect)`; `ver(key)`, a number that rises when better elevation arrives for a tile; `prime(lat, lon)`, a promise for the tiles round a place; `reset()` for the caches held in local metres. Elevation rasters are keyed by map tile, not by local metres, so they outlive a recentre, as the wider city's data does (`DATA`, "kept across a recentre", 4130). A new `env` function supplies them (`env.tileURL(z, x, y)`, 4961 and 4976, is the pattern).
- **Inside a built cell, `S.gy` answers from the cell's own posts** (`c.hgt`, 3.5), so that what stands on the ground stands on the drawn triangles. Outside built cells it answers from the kit.
- **A datum, `S.y0`: world y is elevation minus the elevation of the origin**, set in `recenter` where `S.lat0`, `S.lon0`, `S.kx` and `S.ky` are set (5391). Reasons: (a) every constant that means "above the ground" (the eye heights at 4930, the haze's 90 m, the cloud slab at 1,500 m, the craft's ceiling) keeps its meaning round the origin, so the air (2.11) can be left for later without downtown Los Angeles (about 90 m up) losing two thirds of its haze; (b) vertex heights stay small; (c) with no elevation the datum is 0 and nothing moves. The cost: the origin's elevation must be known before `recenter` builds anything. `open` is already `async` (5421): `if (far) { await TERR.prime(lat, lon); recenter(lat, lon, [lat, lon]); }` at 5424, and the same before the jump of a warp (start priming at 5408, the jump is at 5413). Within one origin the camera can still climb two or three kilometres (a recentre comes only after 12 km of travel, 5207), which is why the camera and the craft take the ground under them (hooks 3 and 8) and why the air needs its base in the end (hook 10). Two details: a recentre made by travel (5207) has its elevation already, because the camera is at the new origin; and `recenter` re-expresses the x and z of the camera, the craft, the drone, its home and its target in the new frame (5391), so with a datum it must also shift every height it keeps by the old datum less the new one: `S.y`, `UAP.state.y`, `ALTA.state.y`, `S.orbit.at[1]`.
- **Versions.** Elevation arrives after the first frame. Each thing built from it must say which elevation it was built with, and be built again when that changes:

| Built thing | Its signature today | Where the terrain's version goes |
|---|---|---|
| A cell's parts (ground, buildings, prisms, labels) | `sigOf(c)` (4987), compared in `plan` (5029) | `+ 't' + TERR.ver(c.key)` |
| A cell's trees | `idsOf(c)` (4988), compared at 5021 | the same |
| A far tile | none: `if (FAR.has(key)) continue;` (4974) | keep `tv` on the entry; drop and remake when it differs |
| A square of the wider city | `t.state`, `t.builtFar` (4173) | keep `t.tv`; push to `buildQ` and remake `t.g` when it differs |
| A roof view | `G.sig` (5085, 5112) | the base, as in 2.5 |
| Streets, sidewalks, lamps, signs, parked cars | `buildRoads()` (5164) rebuilds all of them | a debounced `buildRoads()` when elevation under the streets arrives; better, hold `setRoads` (5175) until it has |
| `BASE` (3.4) | new | cleared in `recenter` (5390) and rewritten by `buildCell` |

  The cleanest order is not to build what has no elevation yet: in `plan` (5027-5029) skip a cell whose rectangle is not `ready`, ask for it, and let the kit's arrival call `planSoon()` exactly as the wider city's does (`onData: () => planSoon()`, 4949). Then cells never pop; only the far ground is seen to firm up.
- **Which elevation for which mesh.** If the elevation comes as 256 pixel map tiles on the same grid as the imagery, a mesh's posts fall on the raster's pixels when the raster's zoom is the tile's zoom less 3 (32 posts across) or less 4 (16 posts): a cell (zoom 18) and a zoom 17 tile from zoom 14, a square of the wider city (zoom 15) from zoom 12, a zoom 13 tile from zoom 10, a zoom 10 tile from zoom 7. That is four levels of raster, some 15 to 26 tiles in memory at once (section 5). To find a pixel: `toLL(x, z)` then `lon2t` and `lat2t` (4933-4934). The local frame is an equirectangular one round the origin (4932), in which a map tile is an exact rectangle (`rectOf`, 4946); only inside a zoom 10 tile does the photograph's linear stretch in z differ from true Mercator by a visible amount (about 14 m at mid tile at 34 degrees north), and sampling elevation through `toLL` keeps the heights true regardless.

### 4.2 The hooks, in order

Each line is one hook: what it is, where it goes, what it unlocks. "With" means it cannot ship without the other.

| # | Hook | Where | Unlocks |
|---|---|---|---|
| 0 | `S.gy`, the terrain kit, `S.y0`, versions | 4929, 4949, 4974, 4987, 4988, 5027-5029, 5390-5391, 5408, 5424 | everything |
| 1 | The physics ground: `phys.terrain = S.gy` in place of the plane | 2628, 2652-2654, 2683, 2694 (the march), 2709 | the walking character (2733), picking (5323), label sight lines (5354), crates |
| 2 | `floorTop` starts from the ground | 5144 (`let top = S.gy(x, z)`) | the drone and the craft (5287, 5292), the altitude readouts (5149, 5154), where they are put down (5376, 5378, 5414) |
| 3 | The camera takes the ground. With 4 | 5264-5276 (eye, near plane, shadow reach, the floors under the chase and orbit cameras), 5367-5368, 5379-5380, 5427 | every view mode |
| 4 | The ground surfaces become height fields. With 3; needs the choice in 4.3 A | 4999 (cell), 4975 and 4969 (far), 4142 (wider city), 4980 (horizon) | terrain is seen |
| 5 | Buildings stand on it | the lift in `buildCell` (5000-5015); `foot` in `K.addBuilding` (3430, 3483, 3486, 3496, 3503); the wall shader (3206); `BASE`; the outline (5322); the wider city and skyline (3522, 4151-4152, 4232) | buildings, their collision prisms, labels, outlines |
| 6 | Things that stand on the ground | trees 5053 and 4210; lamps 5244, 5247, 5255; signals and signs 3671; cars 3696-3697, 3702, 3707-3708; headlights 5307 | the street scene |
| 7 | Street surfaces follow it. Needs the choice in 4.3 B | `K.ribbon` 3531-3541; sidewalks 3648-3651; bars 3667; street names 5356 | streets |
| 8 | The craft's own limits | 4885-4887; 5338, 5425, 5427 | the saucer and the Tic Tac over raised ground |
| 9 | Roof views | 5079, 5084, 5085, 5107, 5108, 5112 | the lens layer lies on the lifted roofs |
| 10 | Weather and air | 5224 with 4751 (the band's floor); 4726 with 5225, 5264, 5274, 5287, 5292 (the flood); 4693-4700 (lightning); 1280, 1331, 1737, 2058 (haze); 2022, 2073-2087 (clouds) | storms and haze in the mountains |

Hooks 0 to 5 put the near world on the height function and make it walkable. 6 and 7 complete the street. 8 to 10 are modes and weather. Within 5, the order is: the lift and the prisms first (collision and looks agree), the wall shader in the same change (or every lifted wall draws as parapet), then the outline and the wider city.

### 4.3 Where a smooth terrain cannot work without more thought

#### A. Seams between the levels of ground (cells, zoom 17, the wider city, zoom 13, zoom 10, the horizon)

Today the levels overlap everywhere and are kept apart by constant drops (0, -0.35, -1.1, -9, -48, -90: 4969, 4142, 4980). The drops are matched to the depth buffer: with 24 bits (1607) and a near plane of 0.3 m in the street (5275), depth can tell surfaces apart by about z² / (near × 2²⁴): 0.1 m at 760 m, 3 m at 4 km, 51 m at 16 km.

On terrain two meshes of the same ground at different post spacings differ by the coarser one's interpolation error, and that is not a constant. Across a ravine or a ridge a quad of spacing D is off by up to D / 4 times the change of slope across it (a V of two 30 degree walls changes slope by 1.15): 2 m for 8 m posts, 5 m for 16 m posts, 36 m for 127 m posts. In every hollow the coarse mesh's chord lies above the fine ground, so the coarse layer comes up through the fine one. The walking eye is 1.7 m above the fine ground and ends up under the coarse one. No fixed drop cures this; a drop big enough for canyons leaves a cliff round the fine area everywhere else.

What the code already offers: tiles nest exactly (a cell `X/Y` lies in the zoom 17 tile `X >> 1, Y >> 1`, the zoom 15 square `X >> 3`, the zoom 13 tile `X >> 5`, the zoom 10 tile `X >> 8`), and a mesh can be drawn in parts with parts switched off. A mesh with `clusters` is drawn run by run, a run with `hidden` true is skipped (1697-1706), and `mesh.maskable = true` forces that path. The wider city uses exactly this to remove the blocks under a detailed cell the moment the cell has its own (`W.cover`, 4179; `clusterOf`, 4146; `H.covered`, 4153 and 4949). The same for ground:

- make each ground tile's index buffer one run per child (a zoom 10 tile: 8 by 8 runs, each a zoom 13 tile; zoom 13: 4 by 4 runs, each a square of the wider city; a square: 4 by 4 runs, each a zoom 17 tile; zoom 17: 2 by 2 runs, each a cell), with the run's box as its bounds. A run is `{ start, count, c, r, axis, cone, hidden }` (4146); for an indexed mesh `start` is a byte offset into the index buffer and `count` a number of indices (541, 1706, 449-450), and `cone: 0` switches the facing test off;
- hide a run while the finer tile over it is drawn (for a cell: `c.built`), show it again when that tile goes (`dropCell`, 4993; the loop at 4978);
- the drops then go to 0. What is left is the crack along the border between a fine tile and a coarse neighbour, where the fine edge has posts the coarse edge does not. Close it with a skirt: a strip hanging from each tile's edge, a few metres for a cell, tens of metres for a zoom 13 tile, with the edge's uv.

The alternative (make each coarse post the lowest fine height round it, and keep overlapping) is always under the fine ground but has to be recomputed as the fine area moves, and leaves a moat round it.

Also to decide here:
- The rim. The zoom 10 tiles end 90 to 113 km out and the horizon plane lies beyond at one level (4980). A range at the rim ends in a wall. Haze hides it from the street; from 1,400 m in clear air it will show. Skirts on the outermost tiles down to the plane, or a fade.
- The sea. If the elevation carries the sea floor, the sea's photograph is draped on the sea bed. Clamp to sea level at sea only: the lowest land in California is below sea level, so a plain `max(h, 0)` flattens Death Valley and the Salton basin.
- `farTiles()` makes every missing tile in one call (4972-4977). With grids instead of quads that is tens of milliseconds at `open`; give it a queue pumped like the cells (5035).

#### B. Streets crossing slopes

The street data is lines in plan with no heights (`setRoads` keeps `name`, `kind` and `pts`, 5163).

- Along the street: points can be 100 m apart. Cut every line into steps no longer than the cells' post spacing before `K.ribbon` (3533) and before the sidewalks (3647), or the ribbon cuts through rises and bridges dips.
- Across the street: a ribbon is 8 to 12 m wide (3530) and would take the ground at its two edges. Between them it is a flat strip; the ground under it is the cell's triangles, at any angle to the street. Two surfaces through the same heights at different points differ by about half-width² × curvature / 2 (some 0.2 m for a 6 m half width over ground curving with a radius of 100 m), more at a break of slope. The ribbon's lift is 7 to 10 cm (3530) and `polygonOffset: [-1, -4]` (3335) only wins a tie in depth. So on rolling ground the street sinks under the photograph in patches.
- Cures, cheapest first: (i) a larger lift (0.25 m) and a row of vertices down the middle: kerbs and markings then float a little; (ii) cut the ribbon by the ground's triangles, so that every piece lies in one of them (the cell's grid lines and diagonals are known; `clip3`, 4989, already clips a polygon against a rectangle in x and z and interpolates y), after which today's lift and offset work as they do now; (iii) grade the ground to the street instead, which needs posts much finer than a street is wide.
- A real street is level across and smoother along than a 10 m elevation model. Draped, it tilts with the hillside and ripples; cars lean and pitch with it (and need `addMatrix`, 2.7). Smoothing each way's profile cures the ripple and takes the street off the ground again: (iii).
- Bridges, overpasses and tunnels: the elevation is bare earth, so a street on a bridge is draped into the cutting or the river bed and out again. `env.roads` would have to return the bridge and tunnel tags, and a bridged stretch be carried straight between its ends.
- Order of arrival: `buildRoads()` rebuilds the whole street scene, traffic included (3639, 3683). If elevation arrives after it, it runs twice and the cars jump. Hold `setRoads` (5175) until the elevation under the streets is in.
- What needs nothing: street-mode walking and the traffic are in plan; the eye and the cars take `S.gy`, the same function the draped ribbon took, so they stay on it.

#### C. Buildings on steep lots

- One floor level a building (3.4), the wall's foot carried down to the lowest ground (3.3), the prism from below that. That is enough for houses on ordinary slopes.
- On the uphill side the ground covers the wall up to the floor's depth below it (at most 1 m by the rule in 3.4). Windows start at 0.92 m (3454) and are clear. A door (0.02 to 2.05 m, 3471) on that wall is half buried: `doorSpot` (3466-3469) picks the wall facing the nearest street and could refuse a wall whose ground is above the floor.
- Large footprints (warehouses, schools, shopping centres) have metres of relief under one floor. Real ones stand on graded pads. A pad means flattening the cell's posts inside the footprint before the ground is made, and a footprint that crosses a cell's edge must flatten the neighbour's posts too, though a building belongs to one cell only (the one its centre is in, 4986). That is state shared between cells, to be kept in the terrain kit, and it changes `S.gy` for everything else: design it before coding it.
- The glow's pool is draped corner by corner (3.3); its shell goes down with the wall's foot.
- The wider city's blocks take the same rule with `foot` (2.4); nobody stands next to them.

#### D. Physics prisms and the ground

- A prism is a footprint raised from `y0` to `y1` with a level top that carries (2644, 2709). On a slope it is right as long as `y0` is below the lowest ground and `y1` is the lifted top. No change inside the physics.
- The ground is not a prism: it is a function asked at a point. Four places ask (2.8). Nothing limits the slope a person walks up, and `grounded` flickers going down.
- Rigid bodies test their corners against the function; with an upright contact normal they do not slide on a slope.
- The drone and the craft meet rising ground only through `floor` (4535, 4887): flown level at a hillside they are lifted up its face, not stopped. `blockAt` (5145) knows prisms only. If a cliff should stop the drone, let `block` also answer true where the ground at the next position is more than a few metres above the craft.
- Cars' physics boxes stay level on a grade.

#### E. The flat imagery canvas per cell

This turns out not to be a blocker.

- A cell's photograph is one 512 pixel canvas of four zoom 19 tiles (4956-4961), a plan view. The ground's uv is the plan position (4999) and stays so on a draped mesh; so do the roofs' (`r.uv`, 4997) and the lids' (4148). The cost is resolution on slopes (a 45 degree face gets 0.7 of the texels along its fall; a cliff is a smear).
- The canvas is also read in plan by the tree detector (5048), `roofLum` (5094) and the roof views; none of that changes.
- Ground and roofs share one builder and one material. If the ground becomes its own mesh (3.5) it still uses `c.img.mat`, and the bookkeeping that keeps a photograph alive while any cell draws with it (`users`, `release`, 4966 and 4997) is by photograph, not by mesh.
- The one trap is `groundPBR`'s height test (2.3), dead today.

#### F. Late elevation

Covered in 4.1: `S.gy` is synchronous; cells wait for their elevation; far ground is rebuilt by version; the datum is primed before `recenter`. What cannot be avoided is that the far ground firms up in view after `open` and after a warp.

#### G. Other things that will be noticed

- The air (2.11): within one origin the ground can be 2 km above or below the datum. Haze and clouds need the base under the camera to look right there.
- Long shadows (2.12): mountains do not shade valleys.
- The chase and orbit cameras can be inside a hillside unless their floor is the ground under the camera itself (2.9).
- The high views (drone, bird, metro) need an eased ground height or they heave (2.9).
- The flood is a level plane (2.11).

## 5. Performance notes

### 5.1 How many pieces of ground exist at once

Sizes at Los Angeles (34 degrees north): a cell is 126.8 by 126.2 m (`rectOf`, 4946). It is 129 m at San Diego, 121 m at San Francisco and 114 m at the Oregon line. Counts below were worked from the loops as written, for a camera in the middle of a tile and at a tile's corner.

| Ground | Tile size | How many | The rule |
|---|---|---|---|
| Cells (zoom 18) | 127 m | wanted: 13, 21 to 24, 29 to 32, 45 at low, medium, high, ultra in the street; 21, 32, 45, 61 in bird view; 4 to 21 in metro view. Alive: up to 37, 45, 57, 69 (97 in bird view at ultra) | `reach()` (4985): 200, 265, 330, 400 m, times 1.25 bird, 1.12 alta, 0.6 metro. Wanted if the centre is within reach plus half a cell (5027); dropped only 1.6 cells beyond reach (5031) |
| Far, zoom 17 | 254 m | 40 to 45 | within 760 m plus 0.71 of a tile (4974); left out while the craft is fast (4972) |
| Wider city, zoom 15 | 1,014 m | 9, 21, 45, 69 by tier; 21, 57, 109, 177 in metro view | `wideReach()` (4948): 1,300 to 4,200 m, times 1.7 in metro view; dropped 1.2 squares beyond (4174). The ground quad is made for every square whether or not the wider city is switched on (4172) |
| Far, zoom 13 | 4,058 m | 64 to 69 | within 16 km; the hole in the middle (`inner`, 4973) almost never removes a tile, because a tile is left out only if all of it is inside |
| Far, zoom 10 | 32.5 km | 32 to 39 | within 90 km |
| Horizon | 600 km | 1 | 4980 |

So about 230 to 260 ground meshes in the street at the high tier (200 at low), some 370 in metro view at ultra, each of two triangles today, each with its own entity, material and texture (a 512 pixel canvas for a cell and for a square of the wider city, one 256 pixel tile for a far tile).

While the craft is fast (`S.fast`: over 170 m/s or in a warp, 5287) no cell is built, cells are dropped as they fall behind (5026), and the zoom 17 tiles are left out.

### 5.2 How often they are rebuilt

| What | When | Where |
|---|---|---|
| `plan()` | on `open`, a recentre, a change of mode or quality, 60 ms after streets or wider-city data arrive (`planSoon`), and from `pump` once the camera has moved 28 m and changed cell, or 60 m | 5024, 5034, 5041 |
| A cell, all of it (every building re-emitted, prisms re-added, parts remade) | when `sigOf(c)` changes: a building's id, status or height; its equipment; `c.detailWant`, which flips at 170 m from the camera (215 m once detailed, 5029); the roof kit; the wider city's data version; and `S.roadsVer` | 4987, 5029 |
| ... and `S.roadsVer` rises | on every `buildRoads()` (5171), which follows every streets load; streets are loaded again once the camera is 230 m from where they were last asked for (5207). So about every 230 m of travel every alive cell (up to 57 at high, 69 at ultra) is rebuilt, a few per frame within 7 ms a frame (5037) | 5171, 5207 |
| A cell's trees | when `idsOf(c)` changes (ids and `S.roadsVer`), one cell a frame after the cells are done | 4988, 5021, 5038 |
| Far tiles | never rebuilt; made when they come into reach and destroyed when they leave, all in one call from `plan()` | 4970-4978 |
| A square of the wider city | its ground once; its blocks when its data arrives and when it crosses 1,250 or 1,500 m from the camera; one square a frame | 4172-4177 |
| The streets (ribbons, sidewalks, markings, signs, parked cars, traffic), the lamps | on every streets load and when street life is switched | 5164-5171 |
| Everything | `recenter`: beyond 12 km from the origin (90 km while fast), an `open` or a warp more than 9 km away | 5207, 5390, 5413, 5424 |

The consequence for terrain: the cells' path is hot (thousands of cell rebuilds in a long walk), the far ground's is cold (each tile built once). Keep a cell's post heights on the cell (`c.hgt`, keyed by the terrain's version) so that a rebuild for the streets' sake costs no elevation lookups for the ground, and keep each building's base in `BASE`.

### 5.3 What height-field meshes cost

Indexed grids (32 bytes a vertex for position, normal and uv; 2 bytes an index), with the elevation's zoom chosen as in 4.1:

| Level | Grid | Post spacing | Vertices | Triangles | Bytes on the card | Count (high tier, street) | Triangles in all |
|---|---|---|---|---|---|---|---|
| Cell | 16 by 16 | 7.9 m | 289 | 512 | 12 KB | up to 57 | 29,000 |
| Zoom 17 | 16 by 16 | 15.9 m | 289 | 512 | 12 KB | 45 | 23,000 |
| Wider city | 32 by 32 | 31.7 m | 1,089 | 2,048 | 47 KB | 45 | 92,000 |
| Zoom 13 | 32 by 32 | 127 m | 1,089 | 2,048 | 47 KB | 69 | 141,000 |
| Zoom 10 | 32 by 32 | 1,014 m | 1,089 | 2,048 | 47 KB | 39 | 80,000 |

- About 365,000 triangles and 8 MB of buffers in all at the high tier in the street (the wider city grows to 177 squares, 362,000 triangles and 8 MB by itself, in metro view at ultra). Skirts add 4 N quads a tile, about an eighth more. The view frustum removes a half to two thirds; hiding the runs under finer tiles (4.3 A) removes little by area but all of the overdraw.
- The same grids through `MeshBuilder` would be 108 bytes a triangle (three vertices of 36 bytes): 40 MB instead of 8. Use indexed meshes for ground.
- Draw calls do not change: one a tile, as today. Drawing by runs adds a sphere test a run (1702-1705): at most 64 a zoom 10 tile, 16 a zoom 13 tile or a square, 4 a zoom 17 tile, some 5,000 to 7,000 tests a frame in the G-buffer pass; neighbouring visible runs are merged into one range (1706) and drawn with `WEBGL_multi_draw` where the browser has it (447-451).
- Shadows: far ground and the wider city's ground do not cast (4976, 4132). The cells' ground would (5017): up to 57 by 512 triangles in up to four cascades. If that shows in the frame time, mark the ground mesh `castShadow = false`; what is lost is the ground's own shadow on buildings within the 140 to 340 m the shadows reach.
- Building a grid: a post is one `S.gy` (find the raster, interpolate: 50 to 100 ns in JavaScript) and a normal (four more, unless the neighbours' heights are reused). A cell: about 0.1 ms. A 32 by 32 tile: 0.3 to 0.5 ms plus the upload. All 150 far tiles in one `farTiles()` call, as the code is shaped now (4972-4977): 50 to 80 ms in one frame at `open` and after a recentre. Queue them, nearest first, a few a frame.
- A cell's buildings: the ground under each corner of each footprint and under each corner of the glow's pool (3.3), a few thousand lookups a cell at most, a few tenths of a millisecond, against a budget of 7 ms a frame for cells (5037). With `c.hgt` (3.5) a lookup inside a cell is two array reads.
- Elevation rasters: 65,536 heights a tile, 262 KB as `Float32Array` (131 KB as `Int16Array` in decimetres). Needed at once: one to four tiles at each of four zooms (2 km tiles for the cells and zoom 17, 8 km for the wider city, 32 km for zoom 13, 260 km for zoom 10); with some kept behind the camera, about 25 tiles, 3 to 7 MB. Turning a fetched picture into heights (draw to a canvas, `getImageData`) is about a millisecond a tile on the main thread; the wait is the network.
- Each frame afterwards: the camera (one to three lookups), the character (one), the moving cars (up to 110 by tier, 5170; three each if they pitch and roll), eight headlights; the hover pick every 60 ms (5334) marches at most some 300 steps for a 4 km ray; the labels' sight lines, 26 every six frames, are under 170 m. Well under 0.1 ms a frame.

### 5.4 Things to watch

- `Mesh.update(positions)` (437) rewrites heights in place but leaves `bounds` (431) and the normals as they were. A far tile whose heights change by hundreds of metres would then be culled by its old flat bounds. Remake the mesh instead; it is cheap.
- Cutting streets into 8 m steps multiplies the ribbons' quads (streets are asked for within 560 m, 5175: some 15 km of line, 2,000 steps, a few thousand quads with the sidewalks) and must not multiply the ten-triangle discs (3540).
- The parked cars are re-sorted into instances every 24 m of camera travel (3694): up to 1,100 (3643). Keep each car's ground on its record when it is parked, not looked up at every sort.
- A roof view is cut again when its roof's base changes (2.5); 45 to 170 roofs are held at once (`lensCap`, 5069) and they are remade a few a frame (5131).
- At the craft's top speed (1,610 m/s, three times that on Shift, 4806) a zoom 13 tile passes in under three seconds. Mesh building keeps up easily; fetching elevation does not. While `S.fast`, build the far ground from the coarse rasters only.

## Appendix: every line to touch, in file order

"Hook" is the row of the table in 4.2.

| Line | What changes | Hook |
|---|---|---|
| 1280, 1331 | haze measured from a base height, not from 0 | 10 |
| 1737 | set that base beside `u_fog` | 10 |
| 2022 | the clouds' shadow deck (2,200) from the base | 10 |
| 2058 | haze in the fog pass from the base | 10 |
| 2073, 2077, 2087 | the cloud slab (1,500 to 3,300) from the base | 10 |
| 2628 | `World` takes a height function (`terrain`); the plane stays as the fallback | 1 |
| 2652-2654 | bodies meet the ground at the height under each corner | 1 |
| 2683 | "fell out of the world" measured from the ground under the body | 1 |
| 2694 | the ray marches the ground | 1 |
| 2709 | `floorAt` starts from the ground at the point | 1 |
| 3206 | `facade`: the wall's height above its own floor from the uv | 5 |
| 3303 | `groundPBR`: no height test (only if the option is revived; 757-773 never set it) | 4 |
| 3430 | `o.rings`, `o.foot` | 5 |
| 3483, 3496 | walls start at `y0` | 5 |
| 3486 | the foundation starts at `y0` | 5 |
| 3503 | the glow's shell starts at `y0` | 5 |
| 3522 | `K.addContext`: walls start at `o.foot`, uv to match | 5 |
| 3531-3541 | `K.ribbon`: each vertex on the ground plus `y`; the line cut into steps; discs at the line's own points only | 7 |
| 3643 | a parked car's record keeps its ground (and its tilt) | 6 |
| 3647-3651 | sidewalks and curbs on the ground; `line` cut into steps | 7 |
| 3667 | crosswalk and stop bars on the ground | 7 |
| 3671 | signals and stop signs at the ground | 6 |
| 3696-3697 | parked cars and their boxes at the ground | 6 |
| 3702 | a body's height above the ground, not above 0 | 6 |
| 3707-3708 | moving cars and their boxes at the ground | 6 |
| 4142 | the wider city's ground as a grid | 4 |
| 4151-4152 | lift each block; the culling box's y from the lifted blocks | 5 |
| 4173 | remake a square when the terrain's version changes | 0 |
| 4210 | backdrop trees at the ground | 6 |
| 4232 | the skyline: lift, and the box's y | 5 |
| 4693, 4698, 4700 | lightning from and to the ground at the strike | 10 |
| 4726 | the flood plane at the surge's ground plus its depth | 10 |
| 4885, 4886 | the craft held between the floor and the floor plus the ceiling; the 90 m test above the floor | 8 |
| 4929 | `S.gy`, `S.y0` | 0 |
| 4949 | make the terrain kit; hand the ground to `WideKit` | 0 |
| 4969 | the drops `y:` go when levels no longer overlap | 4 |
| 4974 | a far tile carries the terrain's version | 0 |
| 4975-4977 | a far tile as a grid, in runs, with a skirt | 4 |
| 4980 | the horizon's level | 4 |
| 4987, 4988 | the terrain's version in `sigOf` and `idsOf` | 0 |
| 4999 | the cell's ground as a grid | 4 |
| 5000-5004 | `B.roofTri` lifts its three points | 5 |
| 5014-5015 | marks, the lift, the pool's drape, prisms from `lo - 1` to `base + r.h`, the label, `BASE` | 5 |
| 5027-5029 | cells wait for their elevation | 0 |
| 5053 | trees at the ground; `t.y` kept | 6 |
| 5079 | roof planes lifted on their way into `sub` | 9 |
| 5084, 5108 | a tree's top and crown from its own ground | 9 |
| 5085, 5112 | the base in the roof's signature | 9 |
| 5107 | the 70 m limit from the roof's base | 9 |
| 5144 | `floorTop` starts from the ground | 2 |
| 5224 | `SE.StormKit(engine, { ground: ... })` | 10 |
| 5225-5227 | `surgeHere` keeps the ground the surge stands on | 10 |
| 5244, 5247, 5255 | lamp posts and their lights at the ground | 6 |
| 5264-5266 | the craft's chase camera above the ground under it; near plane and shadow reach from the height above the ground | 3 |
| 5269-5271 | the same for the drone's cameras | 3 |
| 5272 | the orbit camera above the ground under it | 3 |
| 5273, 5275 | the eye is the ground plus the mode's height; near plane from the height above the ground | 3 |
| 5274, 5287, 5292 | the flood's level as a world height | 10 |
| 5307 | headlights at the ground plus 0.75 | 6 |
| 5322 | the outline's world matrix lifts it to the building's base | 5 |
| 5338, 5425 | "over the roof" from the building's base | 8 |
| 5354 | a label behind the ground is hidden | 1 |
| 5356 | street names at the ground plus 0.4 | 7 |
| 5365-5368 | `faceAt`: pitch and gimbal from lifted heights | 3 |
| 5376, 5414, 5427 | the heights the craft and the drone are put down at, all above `floorTop` | 8 |
| 5379 | the orbit's centre at the building's base, or the ground | 3 |
| 5380 | walk mode starts on the ground | 3 |
| 5385 | `state()`: the craft's and the drone's `alt` as heights above the ground, if the module shows them | 8 |
| 5390-5391 | `recenter`: reset the terrain's local caches, clear `BASE`, set `S.y0`, shift the heights it keeps (`S.y`, the craft's, the drone's, the orbit's centre) by the change of datum | 0 |
| 5408, 5424 | prime the elevation before a warp's jump and before the first build | 0 |
| 5436 | `project`: `up` above the ground | 3 |

Not touched: `AltaKit` (4462-4549; it flies entirely on `env.floor`), `Traffic` (3872-4117), `CarKit` and the car shader, the storm's rain, `K.roofShape`, `K.roofPlanes` and `K.solidOf` (lifted by their callers), `H.layout` and `H.exterior` (lifted with the cell's builders).
