# Scout Engine survey: what is there for freeway traffic, a drivable car and aircraft

Subject: `SP/build/engine.js` (5,463 lines, cited as `E:line`) and the dashboard side in `SP/build/scout.js`
(2,671 lines, cited as `S:line`). SP = `/tmp/claude-0/-home-user-Leviathan/3de4e742-518d-5f10-b5db-2b34e6723642/scratchpad`.

How to read the quotes: a line that starts `E:3884  ` or `S:2148  ` inside a code block is copied from that line of the
file; ` […] ` marks text left out inside the line. Every such line was checked by script against the file (section 9).

What this rests on
- Read in full: StreetKit (E:3585-3717), CarKit and its shader (E:3719-3860), Traffic (E:3862-4117), Physics
  (E:2534-2761), the engine loop and input (E:2382-2532), AltaKit (E:4452-4551), UapKit (E:4780-4899), the world
  builder (E:4901-5459), the scene and instancing classes (E:404-753), `roads3d` and the engine bar in scout.js
  (S:700-730, S:2145-2170, S:2274-2472). Skimmed: WideKit (E:4119-4251), the renderer's collect loop (E:1661-1682).
- Run here (Node 22, nothing written to disk): `Traffic` and `StreetKit.network` cut out of engine.js by line range and
  stepped on synthetic road sets (results in 3.9 and 3.10); `CarKit.build` run headless to count triangles (4.3).
- Asked live: Census TIGERweb answered (1.4). The three Overpass servers the code uses, and a fourth, did not answer
  from this container (a connection reset, a 504 and two time-outs), so what is said about OpenStreetMap's freeway
  tags is the tagging convention, not a sample taken here.
- Not run: the engine in a browser. Costs given are the simulation step in Node, not drawing.

---

## 0. Frames, units and the order of a frame (needed by every patch)

**The local frame.** Metres, x east, z south, y up, origin at `S.lat0, S.lon0`.

```
E:4932  S.toL = (la, lo) => [(lo - S.lon0) * S.kx, -(la - S.lat0) * S.ky];      /* [x east, z south] in metres; north is -z */
E:4933  const toL = S.toL, toLL = (x, z) => [S.lat0 - z / S.ky, S.lon0 + x / S.kx];
```

**The world is flat.** The physics ground is the plane y = 0 (`this.groundY = 0; this.ground = true;` E:2628), each
cell's ground is one quad at y = 0 (E:4999), roads are ribbons at y = 0.07 to 0.1 (E:3530). There is no terrain height
anywhere: San Francisco's hills, freeway grades, bridges and tunnels have no representation. Buildings are prisms from
y = 0.

**The origin moves.** More than 12 km from the origin the world is rebuilt round a new one; every local coordinate
held by a kit changes and `S.gen` goes up:

```
E:5207  function after(quiet) { need(); if (!quiet && env.onMove) env.onMove(state()); if (!S.fast && S.roadsAt && Math.hypot(S.x - S.roadsAt[0], S.z - S.roadsAt[1]) > 230) loadRoads(); if (Math.hypot(S.x, S.z) > (S.fast ? 90000 : 12000)) { const [la, lo] = toLL(S.x, S.z); recenter(la, lo); } }
```

`recenter` (E:5389-5393) re-projects the UAP and the Alta X by hand (their x, z, home and target); a car kit, freeway
traffic, airliners and naval-base props all need the same treatment there (6.3, item 15).

**Two heading conventions.**
- The camera and the two aircraft kits: `yaw` in degrees, clockwise from north; forward is `(sin yaw, -cos yaw)`:
  `fx = Math.sin(yr), fz = -Math.cos(yr), rx = Math.cos(yr), rz = Math.sin(yr)` (E:4517).
- Traffic cars and `InstanceBuffer.add`: a unit heading `(hx, hz)` and `yaw = Math.atan2(hx, hz)` in radians, zero
  pointing +z (south) (E:4009); `right = (hx, hz) => [-hz, hx]` (E:3874).
- Conversion: `carYaw = Math.PI - camYawDeg * RAD`; heading `(hx, hz) = (sin camYaw, -cos camYaw)`.
- A car mesh has its nose at +z and (worked out from the instance matrix at E:471-474) its own left at +x.

**One frame** (`Engine._frame`, E:2459-2489), in order:
1. `emit('input')`; if `engine.playing`: physics in fixed steps of 1/60 s, at most five a frame
   (`T.acc = Math.min(T.acc + sim, T.fixed * 5)`, E:2465), then `scene.update`.
2. `emit('update', dt)` with the real frame time (clamped to 0.1 s): the world builder's handler (E:5279-5308) reads
   the keys, runs the UAP or the Alta X or the walk, places the camera, builds cells (`pump`), runs the storm, then the
   traffic (`ST.update`) and the headlights. The kits clamp their own step: `dt = Math.min(dt, 0.05)` (E:4517, E:4868).
3. Render if anything changed; `emit('frame')` draws labels, the HUD and the legend (E:5309).

**The engine goes to sleep, and the traffic with it.** `engine.awake` is true for 25 s after the last pointer or key
event (`idleSleep = 25`, E:2437; `wake()` E:2457). Traffic moves only while awake:

```
E:5305  if (gfx.life) { const night = smoothstep(2, -6, S.sunAlt), moving = engine.playing && engine.awake && engine.live, onFoot = S.mode === 'street' || S.mode === 'walk'; if (ST.update(dt, cam.entity.transform.position, { night, moving, viewer: onFoot ? [S.x, S.z] : null, reach: S.mode === 'metro' ? 900 : S.mode === 'bird' || S.mode === 'drone' || S.mode === 'alta' ? 600 : 330 })) need();
```

A held key repeats `keydown`, which calls `wake()` (E:2409); a game pad sends no events, and a car coasting with no key
down sends none either. The storm solves this for itself by calling `engine.wake()` every frame it is on (E:5301). A
car mode must do the same while the car moves, or the traffic freezes (and shader time stops: `if (live || busy)
T.now += sim`, E:2475) 25 s after the last key press.

---

## 1. The street data path, end to end

### 1.1 The engine asks

```
E:5173  async function loadRoads() {
E:5174  const gen = S.gen, ask = S.roadsAsk = (S.roadsAsk || 0) + 1, [la, lo] = toLL(S.x, S.z); S.roadsAt = [S.x, S.z]; if (!S.roads.length) note('Loading the streets and alleys…');
E:5175  try { const list = await env.roads(la, lo, 560); if (gen !== S.gen || ask !== S.roadsAsk) return; setRoads(list); note(list.source || ''); if (S.mode === 'street' && !S.tween) { const o = nearestOnRoads(S.x, S.z, 45); if (o) { S.on = o; S.x = o.x; S.z = o.z; } } after(true); }
```

- One call, `env.roads(lat, lon, 560)`: everything within a square of half-side 560 m round the camera.
- Called from `recenter` (E:5392), from `after()` whenever the camera is more than 230 m from where the streets were
  last asked for (E:5207, quoted above), and when a UAP slows down from `S.fast` (E:5288).
- Each answer **replaces** the whole street set. Nothing is merged, tiled or kept: `setRoads` → `buildRoads` →
  `ST.build`, which clears and rebuilds the sidewalks, markings, signals, parked cars, the traffic network **and every
  moving car** (3.3). It also bumps `S.roadsVer`, which is part of every cell's signature (`sigOf`, E:4987) and of
  every cell's tree signature (`idsOf`, E:4988), so **every loaded cell's buildings and trees are rebuilt** too.
  At walking speed this happens every few minutes. At 30 m/s it happens every 8 s, with a fresh Overpass request each
  time (Overpass answers are not cached anywhere; only the TIGER fallback is cached, per tile, S:710).

### 1.2 What `env.roads` returns, and what the engine keeps

The contract is an array of `{ name, kind, pts }` with `pts` as `[lat, lon]` pairs, plus a string property `source`
on the array (a note for the status line; empty when OpenStreetMap answered). The engine keeps exactly three fields:

```
E:5163  function setRoads(list) { S.roads = list.map(r => ({ name: r.name || '', kind: r.kind, pts: r.pts.map(([la, lo]) => toL(la, lo)) })).filter(r => r.pts.length >= 2); buildRoads(); }
```

Anything else the dashboard might add to a road (lanes, oneway, maxspeed, layer, bridge, ref) is dropped on this line:
it is the first line to change. `S.roads[i]` is then `{ name, kind, pts: [[x, z], …] }` in local metres.
`S.graph` is the subset a person can walk along (`WALK = new Set(['street', 'major', 'alley', 'service'])`, E:5162).

The same `env.roads` feeds the classic three.js view (`scout3d.js` line 949), which copies the same three fields
(line 749) and falls back to the street width for a kind it does not know (`ROADW[r.kind] || ROADW.street`, line 750).
So new fields are harmless there, and a new kind draws there as an 8.2 m street with no paint.

### 1.3 The dashboard answers from OpenStreetMap (`roads3d`, S:2150-2170)

Servers, tried in order, 12 s each, the first that answers with at least one street wins:

```
S:2147  const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
S:2155  const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 12000);
S:2161  answered = true; break;   /* a server that answers with no streets is believed: the area goes to no other server */
```

The box and the query (every way with any `highway` tag, with all its tags and its geometry):

```
S:2151  const dLa = r / 110900, dLo = r / (111320 * Math.cos(rad(la))), bb = [la - dLa, lo - dLo, la + dLa, lo + dLo].map(v => v.toFixed(6)).join(',');
S:2152  const q = `[out:json][timeout:25];way["highway"](${bb});out tags geom;`;
S:2157  const res = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: ctl.signal, credentials: 'omit' });
```

Ways come back whole, not cut at the box: a way that crosses the box arrives with all its points, so what is loaded
reaches past 560 m along long ways. What is made of each way: a name (the `name` tag, else the `ref` tag), a kind, and
the points. Nothing else:

```
S:2159  const list = (j.elements || []).filter(e => e.type === 'way' && e.geometry && e.geometry.length > 1).map(e => ({ name: (e.tags && (e.tags.name || e.tags.ref)) || '', kind: osmKind(e.tags || {}), pts: e.geometry.map(g => [g.lat, g.lon]) })).filter(x => x.kind);
```

How the kind is assigned (the only two tags read are `highway` and `service`):

```
S:2148  const osmKind = t => { const h = t.highway || '', s = t.service || ''; if (/^(motorway|trunk|primary|secondary)(_link)?$/.test(h)) return 'major'; if (/^(tertiary|tertiary_link|residential|unclassified|living_street|road)$/.test(h)) return 'street'; if (h === 'service') return s === 'alley' ? 'alley' : /^(driveway|parking_aisle|drive-through|emergency_access)$/.test(s) ? 'drive' : 'service'; if (/^(footway|path|pedestrian|cycleway|steps|track|bridleway)$/.test(h)) return 'path'; return null; };
```

| `highway` value | kind | driven by traffic |
|---|---|---|
| motorway, motorway_link, trunk, trunk_link, primary, primary_link, secondary, secondary_link | `major` | yes |
| tertiary, tertiary_link, residential, unclassified, living_street, road | `street` | yes |
| service with `service=alley` | `alley` | no |
| service with `service=driveway`, `parking_aisle`, `drive-through`, `emergency_access` | `drive` | no (parked cars only) |
| service, any other or no `service` value | `service` | no |
| footway, path, pedestrian, cycleway, steps, track, bridleway | `path` | no |
| anything else (construction, proposed, busway, bus_guideway, raceway, corridor, platform, rest_area, services, elevator …) | dropped (`null`) | |

Tags that arrive in the answer and are **not read**: `lanes`, `lanes:forward`, `lanes:backward`, `oneway`,
`maxspeed`, `bridge`, `tunnel`, `layer`, `junction`, `turn:lanes`, `hov`, `hov:lanes`, `destination`, `surface`,
`width`, `access`. Because the query already says `out tags geom`, all of them are in `e.tags` today: reading them
needs no change to the query. What the query does **not** return:
- nodes. `way["highway"]` asks for ways only, so `highway=traffic_signals`, `highway=stop` and
  `highway=motorway_junction` (exit numbers) nodes never arrive; where signals stand is guessed (2.4).
- way ids are in `e.id` but are not kept; node ids of a way's points are not printed at `tags` verbosity (the code
  reads only `e.type`, `e.geometry`, `e.tags`). Junctions are therefore found by coordinates (2.4). Confirm against a
  live answer; Overpass was unreachable here.

OpenStreetMap conventions that matter (not sampled here): a freeway is two separate one-way ways, one per
carriageway, `highway=motorway`, one-way implied even without the tag; `lanes` on such a way is the lane count of that
carriageway alone; on a two-way road `lanes` is the total of both directions, split by `lanes:forward` and
`lanes:backward` where tagged. Ramps are `highway=motorway_link`, normally tagged `oneway=yes` and `lanes=1` or `2`.
`maxspeed` in the United States is a string such as `65 mph`. Elevated parts carry `bridge=yes` (or `viaduct`) and
`layer=1…`; a way is cut wherever any tag changes, so a freeway arrives as many short ways laid end to end.

### 1.4 The fallback: the Census TIGER file

Used when no Overpass server gives streets. The zoom-16 tiles (`TILE_Z = 16`, S:51) under nine points (the centre, and
the edges and corners of the box) are asked for, each cached on its tile, de-duplicated by geometry, and mapped by
MTFCC class code:

```
S:712  t.roadsP = Promise.all([8, 6].map(L => getJSON(EP.roads + L + '/query?' + qs({ geometry: env(box), geometryType: 'esriGeometryEnvelope', inSR: 4326, spatialRel: 'esriSpatialRelIntersects', outFields: 'NAME,MTFCC', returnGeometry: 'true', outSR: 4326, geometryPrecision: 6, f: 'json' }), { timeout: 25000 }).catch(() => ({ features: [], failed: true }))))
S:2149  const tigerKind = m => /^S1(100|200|630)$/.test(m) ? 'major' : m === 'S1730' ? 'alley' : m === 'S1780' ? 'drive' : /^S1(640|740)$/.test(m) ? 'service' : /^S1(710|720|820|830)$/.test(m) ? 'path' : 'street';
S:2166  const list = all.filter(r => { const k = r.line.map(p => p.join()).join(';'); if (seen.has(k)) return false; seen.add(k); return true; }).map(r => ({ name: r.name, kind: tigerKind(r.m || ''), pts: r.line }));
```

`EP.roads` is `https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Transportation/MapServer/` (S:59). Only
layers **8 and 6** are asked. Asked live on 2026-11-19, the service lists its layers as: 0 to 2 Primary Roads (2 is the
one that answers at street scale), 3 to 6 Secondary Roads, 7 and 8 Local Roads, 9 Railroads. A query of a box round
the Harbor/Hollywood freeway interchange in Los Angeles (34.056 to 34.068 N, 118.256 to 118.240 W) gave:

| layer | what came back |
|---|---|
| 8 (Local Roads) | 97 lines `S1400` (local streets) and **51 lines `S1630` (ramps), all with no name** |
| 6 (Secondary Roads) | nothing |
| 2 (Primary Roads), **not asked by the code** | 10 lines `S1100`: Hollywood Fwy, Pasadena Fwy, Harbor Frwy & Transit Way, State Rte 110, US Hwy 101 |

So on the fallback **the freeways themselves are missing** (their class, `S1100`, lives in layer 2, which the code
never asks), while their ramps arrive, nameless, as `major` roads that lead to nothing. TIGER has no lane counts, no
one-way flag and no speed limit; layer 8 does carry a route type field `RTTYP` that is not requested.

### 1.5 What a freeway and its ramps become today

With OpenStreetMap answering, in the engine as it stands:

| Real thing | What is drawn and simulated |
|---|---|
| One freeway carriageway (one-way, 4 to 6 lanes, 65 mph) | One `major` road: a 12 m ribbon of asphalt on the ground (2.1), a double yellow line down its middle and dashed white lines 3.05 m either side (2.5), a kerb and a 1.9 m sidewalk along both edges, lamp posts every 46 m, and **two lanes of traffic in each direction on the one carriageway** at 13.4 m/s (30 mph) (3.1). Measured: on two parallel carriageways the cars split about evenly between the two directions of each (3.9). |
| The opposite carriageway | The same again, 15 to 40 m away: four directions of traffic where there are two. |
| A ramp (`motorway_link`) | Also `major`: 12 m wide, two lanes each way, 30 mph. |
| Where a ramp leaves or joins | A node of degree 3 touching a `major` way, so a **signalised crossing**: a traffic signal, zebra crosswalks, stop bars, and a 30 s red/green cycle that stops the mainline (2.4, 3.5; measured in 3.10). |
| Where the freeway passes over a street | Both ribbons lie on the ground and cross. No junction is made (they share no point), so no signal; but the cars are boxes on one plane and brake for each other with no rule about who goes (3.10, measured: a fifth of the cars standing, cars towed). |
| Freeway name | `tags.name`, else `tags.ref` (S:2159): `Hollywood Freeway`, or `US 101` where unnamed. |
| Beyond 560 m of the last load point | No road surface and no traffic: only the satellite photograph on the ground. |

On the TIGER fallback: no mainline at all, ramps as above.

### 1.6 Where the changes for real freeways go

1. S:2148 and S:2159: return more per road. Suggested: two new kinds, `freeway` (motorway) and `ramp`
   (motorway_link), leaving `major` for the rest; plus `lanes`, `oneway` (0, 1, -1), `maxspeed` (m/s), `layer`,
   `bridge`, `tunnel`, `ref`, `id`.
2. E:5163: carry those fields into `S.roads`.
3. Every place that branches on a kind (each is quoted in the section named):
   E:3530 widths (2.1) · E:3594 `DRIVE` (2.4) · E:3612-3614 the network (2.4) · E:3652, 3654, 3657 markings and parking
   (2.5) · E:3882-3885 lanes and limits (3.1) · E:5005 doors face `['street', 'major', 'service']` · E:5162 `WALK` ·
   E:5167 bare-street paint · E:5243 lamps · S:2205 and S:2355 the words for a kind · `scout3d.js` lines 504, 644, 726,
   732, 750, 752 (falls back to a street for an unknown kind).
4. The fallback: add layer 2 at S:712 and ask for `RTTYP`; lanes then have to be assumed by class.
5. Loading: a freeway needs more than a 560 m box replaced every 230 m. A second, motorway-only request over
   several kilometres, cached by tile and merged, with the local streets left as they are, would stop the 8-second
   rebuild at speed (1.1) and give the far traffic a road to run on.

---

## 2. Road surfaces and street furniture

### 2.1 Widths, heights and materials per kind

```
E:3530  K.ROADW = { major: [12, 0.1, 'asphalt'], street: [8.2, 0.09, 'asphalt'], service: [5.2, 0.085, 'asphalt'], alley: [4.2, 0.08, 'concrete'], drive: [3, 0.075, 'concrete'], path: [1.6, 0.07, 'concrete'] };
```

| kind | width m | y m | surface layer |
|---|---|---|---|
| major | 12 | 0.100 | asphalt |
| street | 8.2 | 0.090 | asphalt |
| service | 5.2 | 0.085 | asphalt |
| alley | 4.2 | 0.080 | concrete |
| drive | 3 | 0.075 | concrete |
| path | 1.6 | 0.070 | concrete |

The width is per **kind**, not per road: there is no per-road width or lane count anywhere. An unknown kind gets the
street's (`K.ROADW[r.kind] || K.ROADW.street`, E:5167, E:3613).

### 2.2 The pavement: `K.ribbon` (E:3531-3541)

`K.ribbon(Bd, pts, w, y, kind, offs, col)` adds a flat strip of width `w` at height `y` along a line to a
`MeshBuilder`: mitred at each bend (the mitre is capped: `k = 1 / Math.max(0.4, …)`, E:3536), one quad per segment
(E:3539), and, for a surface (a `kind` given and no offset), a ten-triangle disc at every point to fill the joints and
round the ends (E:3540). `offs` moves the strip sideways, positive to the right of the line's direction (`nx = -tz,
nz = tx`, E:3536; so far it is only used symmetrically). `kind` picks the photo layer
(`LAYER[kind]`, written to `aux.w`) and its texture scale (`TILE`, E:3319: asphalt 4 m, concrete 3 m); with no `kind`
the strip is paint in the vertex colour `col`.

The height `y` is one number for the whole strip. A ribbon cannot climb.

Materials (E:3335-3336): the surface is `M.road`, the layered photo material with `polygonOffset: [-1, -4]`; paint is
`M.paint`, vertex-coloured, `polygonOffset: [-2, -8]`. Neither casts a shadow. Roads have no collision shape: the
physics sees only the ground plane.

### 2.3 `buildRoads` (E:5164-5172)

```
E:5167  S.roads.forEach(r => { const spec = K.ROADW[r.kind] || K.ROADW.street; K.ribbon(Bd, r.pts, spec[0], spec[1], spec[2]); if (r.kind === 'major' && !gfx.life) { K.ribbon(Pt, r.pts, 0.11, 0.115, null, 0.12, yel); K.ribbon(Pt, r.pts, 0.11, 0.115, null, -0.12, yel); K.ribbon(Pt, r.pts, 0.12, 0.115, null, 5.4, wht); K.ribbon(Pt, r.pts, 0.12, 0.115, null, -5.4, wht); } });
E:5170  ST.build(S.roads, root, { life: gfx.life, center: [S.x, S.z], blocked: (x, z) => phys.prismsIn(x, z, x, z, []).some(p => Poly.contains(p.ring, x, z)), cars: { ultra: 110, high: 80, medium: 45, low: 22 }[engine.quality] || 60 });
E:5171  S.graph = S.roads.filter(r => WALK.has(r.kind)); S.on = null; S.roadsVer++; lamps(); planSoon(); need();
```

- All road surfaces of the load go into **one mesh** ("Asphalt and concrete"), all paint into another, each cut into
  clusters of 320 triangles for culling (E:5168).
- With the street life off (`gfx.life` false) a `major` gets a double yellow centre line and white edge lines at
  ±5.4 m, continuous through crossings. With it on, StreetKit paints instead (2.5).
- Then StreetKit is rebuilt, the lamps are rebuilt, and every cell is queued for rebuilding (1.1).

### 2.4 Finding the intersections: `StreetKit.network` (E:3610-3626)

```
E:3611  const nodes = new Map(), key = p => Math.round(p[0] * 2) + ':' + Math.round(p[1] * 2), ways = [];
E:3612  roads.forEach((r, ri) => { if (r.kind === 'path' || r.kind === 'drive') return; const acc = [0]; for (let i = 1; i < r.pts.length; i++) acc.push(acc[i - 1] + Math.hypot(r.pts[i][0] - r.pts[i - 1][0], r.pts[i][1] - r.pts[i - 1][1]));
E:3613  const w = { ri, r, acc, len: acc[acc.length - 1], hw: (K.ROADW[r.kind] || K.ROADW.street)[0] / 2, drive: DRIVE.has(r.kind), nodes: [] }; ways[ri] = w;
E:3614  r.pts.forEach((p, pi) => { const k = key(p); let n = nodes.get(k); if (!n) nodes.set(k, n = { x: p[0], z: p[1], legs: [], deg: 0, hw: 0, major: false, id: nodes.size }); const mid = pi > 0 && pi < r.pts.length - 1; n.legs.push({ w, pi }); if (w.drive || r.kind === 'service') { n.deg += mid ? 2 : 1; n.hw = Math.max(n.hw, w.hw); if (r.kind === 'major') n.major = true; } else n.alley = true; }); });
E:3616  nodes.forEach(n => { n.cross = n.deg >= 3 && n.legs.some(l => l.w.drive); n.signal = n.cross && n.major; n.r = n.hw + 1.2;
```

- A **way** is a whole road as loaded (not cut at crossings): `{ ri, r, acc (length along it at each point), len, hw
  (half width), drive, nodes }`. `drive` is true for `street` and `major` only (`DRIVE`, E:3594). Paths and
  driveways are not in the network at all.
- A **node** is every point of every way, merged where two points fall in the same half-metre square (E:3611). Two
  ways meet only if they have a point in common; lines that merely cross in plan do not meet (so a bridge makes no
  junction, correctly, but see 3.10).
- `deg` counts arms: 2 for a point in the middle of a way, 1 for an end, counting `street`, `major` and `service` ways.
- **A crossing** is a node with `deg >= 3` and at least one driveable way. **A signal** stands at every crossing that
  touches a `major` way; every other crossing gets stop signs. There is no notion of a merge, a yield or a through
  road with priority. A ramp joining a freeway is degree 3 with a `major` leg: a signal.
- `n.r = n.hw + 1.2` is the crossing's radius; E:3619-3621 push each arm's stop line out to where it is clear of the
  neighbouring arms' edges (up to 26 m for a slanted meeting), stored on the leg as `l.rp` and `l.rm`.

### 2.5 What `StreetKit.build` lays down (E:3639-3685)

Everything below is built once per street load, within a radius of the centre given (`inRange`, 360 m by default,
E:3642), into one sidewalk mesh, one paint mesh and three instance buffers.

**Sidewalks and kerbs.** Along both edges of every driveable way, on the stretches between crossings (a stretch stops
3.2 m outside each crossing's clear radius, about where its crosswalk ends, E:3646): the walk from `hw + 0.12` to `hw + 2.0` m from the centre line at
y = 0.2, with a kerb face down to y = 0.085 (E:3648-3651). Material `M.side`, concrete layer (E:3596). No
collision shape: a kerb cannot be hit.

**Lane lines.** Only on `major`:

```
E:3652  if (w.r.kind === 'major') { K.ribbon(Pt, line, 0.11, 0.115, null, 0.12, yel); K.ribbon(Pt, line, 0.11, 0.115, null, -0.12, yel); for (let s = d0 + 2; s + 3 < d1; s += 9) { [3.05, -3.05].forEach(o2 => K.ribbon(Pt, shift(piece(w, s, s + 3), o2), 0.11, 0.115, null, 0, white)); } }
```

A double yellow centre line and one dashed white line each side (3 m dashes every 9 m at ±3.05 m). A `street` has no
paint. There are no edge lines, no lane arrows, no gore or chevron marking.

**Parked cars.** On one side of each `street` (E:3654) and in rows along long `drive` ways, one or two on short ones
(E:3657-3662); at most 1,100 (E:3643). None on `major`.

**Crossings** (E:3664-3671), on each driveable arm of each crossing:
- at a signal, a zebra: bars 0.55 m wide every 1.15 m, 2.6 m long; elsewhere two thin lines 2.3 m apart (E:3668);
- a stop bar across the incoming half only, 0.7 m behind the crosswalk (E:3669);
- a signal mast or a stop sign just behind the stop bar, on the incoming traffic's right, within 700 m of the
  centre (E:3670-3671).

**Signals and stop signs** are instanced meshes (E:3675-3681): a 6.2 m pole with a mast arm and two heads; the three
lamps of each head are three more instanced renderers on the same buffer, each with its own unlit material whose
brightness is set every frame from the traffic's clock (E:3692). Signals are in two groups, `ns` and `ew`, by the
direction of the arm relative to the crossing's widest road (`TR.phase`, E:3911). All signals in the world share one
30-second clock (3.5). Drawn to 600 to 700 m; stop signs to 320 m.

### 2.6 Lamp posts (E:5241-5256)

Along every `street` and `major`, alternating sides every 46 m, 1.1 m outside the edge of the pavement, at most 900
(E:5243-5244); instanced, drawn to 420 m (heads to 700 m). After dark (`night > 0.25`) the nearest 48, 36, 20 or 10 of
them (by quality) are real spot lights (E:5251-5255).

### 2.7 What is missing for a freeway surface

- A width from the lane count (lanes × 3.66 m, the 12 ft lane, plus shoulders) instead of the kind's 12 m.
- One-way marking: white dashed lane lines between all lanes, a yellow left edge line and a white right edge line,
  no centre line; today's `major` paint is a two-way arterial's.
- No sidewalks, kerbs, parked cars, lamp spacing or crosswalks on `freeway` and `ramp`.
- A median barrier, shoulders, guard rails, overhead sign gantries, exit signs: none exist.
- Height: `K.ribbon` takes one `y`. An elevated deck needs a `y` per point (from `layer` and `bridge`), a deck
  thickness, piers, and a matching change in the traffic (3.10) and in the car's ground (5.5).
- Gore areas: where a ramp splits off, two 12 m ribbons simply overlap.

---

## 3. The traffic model (`Traffic`, E:3872-4117, driven by `StreetKit`, E:3633-3712)

One simulator, `TR = Traffic(TT)` (E:3634), made once with the list of car types (it needs their lengths and widths).
`TR.setNetwork(NET)` is called on every street load (E:3640) and empties the fleet.

### 3.1 The graph: ways, lanes, stops, zones, portals

```
E:3873  const T = { cars: [], parked: [], nodes: [], ways: [], time: 0, sigT: 0, ns: 'g', ew: 'r', events: { contacts: 0, tows: 0, maxPen: 0 }, viewer: null, bodies: [] };
E:3874  const right = (hx, hz) => [-hz, hx], LANE_W = 3.05, CELL = 16, SHORT = 11, hash = (x, z) => (Math.floor(x / CELL) * 73856093) ^ (Math.floor(z / CELL) * 19349663);
```

**Lanes and speed limits, per kind** (the whole of it):

```
E:3882  T.ways.forEach(w => { if (!w.drive) return; const major = w.r.kind === 'major';
E:3883  w.ps = major ? 0 : (hash01('p' + w.ri + ':' + Math.round(w.len)) < 0.5 ? 1 : -1);          /* which side of a street the cars park on */
E:3884  w.lanes = major ? { 1: [LANE_W / 2, LANE_W * 1.5], '-1': [-LANE_W / 2, -LANE_W * 1.5] } : w.ps > 0 ? { 1: [w.hw - 2.4 - 1.45], '-1': [w.hw - 2.4 - 4.35] } : { 1: [-(w.hw - 2.4) + 4.35], '-1': [-(w.hw - 2.4) + 1.45] };   /* a street: kerb, 2.4 m of parked cars, two 2.9 m lanes */
E:3885  w.limit = major ? 13.4 : 8.9; w.stops = []; });
```

- A **lane** is a signed sideways offset in metres from the way's own line, positive to the right of the direction
  the way's points run in. `w.lanes[1]` are the lanes going with the point order, `w.lanes[-1]` those going against
  it. **Every driveable way carries both directions**; nothing knows a way is one-way.
- `major`: two lanes each way, at ±1.525 and ±4.575 m. Index 0 is the lane by the centre line, index 1 the kerb lane.
- `street`: one lane each way, set to one side to leave 2.4 m for the parked cars.
- **Speeds**: `w.limit` is 13.4 m/s (30 mph) on `major` and 8.9 m/s (20 mph) on `street`. Each car multiplies it by
  its own `top`, 0.86 to 1.14 (E:4025). No other speed exists.
- `laneLine(w, off)` (E:3913-3916) is the way's line moved sideways with mitred corners, cached per offset;
  `lanePointW(w, off, dir, d, out)` (E:3930-3932) gives the point and heading at distance `d` along the way (measured
  on the centre line), the heading eased over 3 m each side of a bend.

**Stops: where a car plans.**

```
E:3888  const shared = new Set(n.drive.map(l => l.w)).size > 1 || n.drive.length > 1;
E:3889  n.drive.forEach(l => { const end = l.pi === 0 || l.pi === l.w.r.pts.length - 1; if ((shared || end) && !l.w.stops.some(s => s.n === n)) l.w.stops.push({ n, d: l.w.acc[l.pi], l, sbm: (l.rm || n.r) + 2.5, sbp: (l.rp || n.r) + 2.5 }); }); });
```

A way has a stop at each end and wherever another driveable way shares a point with it. `sbm` and `sbp` are how far
before and after the node the lane ends: the node's clear radius plus 2.5 m (9.7 m on a `major`). So two ways that
merely join end to end, as OpenStreetMap cuts a freeway at every change of tag, are still a node: the lane stops, a
curve carries the car across about 19 m, and the next lane begins.

**Zones.** Each node has `n.zone = { occ: [], queue: [] }` (E:3886): the cars holding a movement through it and the
cars waiting. Crossings with less than `SHORT` = 11 m of waiting room between them are merged into one zone
(E:3894-3897).

**Portals and dead ends.**

```
E:3900  const m = Math.max(45, Math.min(x1 - x0, z1 - z0) * 0.09); T.portals = [];
E:3901  T.nodes.forEach(n => { n.portal = false; if (n.drive.length !== 1) return; const l = n.drive[0], end = l.pi === 0 || l.pi === l.w.r.pts.length - 1; if (!end || l.w.len < 40) return; if (n.x < x0 + m || n.x > x1 - m || n.z < z0 + m || n.z > z1 - m) { n.portal = true; T.portals.push({ n, w: l.w, dir: l.pi === 0 ? 1 : -1 }); } }); }
E:3906  T.driveWays = T.ways.filter(w => w.drive && w.len > 24 && w.stops.length >= 2 && !(w.dead[1] && w.dead[-1]));
E:3908  T.total = T.driveWays.reduce((a, w) => a + w.len, 0);
```

A portal is the free end of a way over 40 m long that lies near the edge of the bounding box of everything loaded
(within 45 m or 9% of the box): traffic leaves and enters there. A free end inside the map is a dead end; a direction
of a way that leads only to dead ends is marked `w.dead[dir]` (E:3903-3905) and avoided.

### 3.2 Routes: legs, curves, turning, lane use

A car holds `c.legs`, the index `c.li` of the leg it is on and the distance `c.s` along it. `plan(c)` (E:3978) keeps
90 m or three legs ahead.

| leg | made at | fields |
|---|---|---|
| lane leg | `laneLeg`, E:3943 | `{ k: 0, w, dir, off, d0, d1, len, next, limit }`: along way `w` in direction `dir` at offset `off`, from `d0` to just short of the next stop |
| curve | `mkArc`, E:3977 | `{ k: 1, pts, tan, acc, len, n, vmax, inW, inDir, inOff, axis, ang, uturn }`: a cubic Bezier in 12 pieces from the end of one lane to the start of the next |
| movement | `extend`, E:3968-3976 | one curve, or `{ k: 2, … }`: the curves through a knot of close crossings with the scraps of lane between; this is what a car asks a zone for |

**Turning** is a weighted random choice at every node (`extendOnce`, E:3946-3965):

```
E:3951  if (Math.abs(ang) > 2.7) continue; opts.push({ w: l.w, dir: d2, pi: l.pi, ang, wt: Math.abs(ang) < 0.6 ? 6 : ang > 0 ? 2.2 : 1.8 }); } }
E:3953  if (L.w.lanes[L.dir].length > 1) { const keep = opts.filter(o => (c.lane === 1 ? o.ang > -0.6 : o.ang < 0.6)); if (keep.length) { opts.length = 0; keep.forEach(o => opts.push(o)); } }
E:3961  const w2 = pick.w, lanes = w2.lanes[pick.dir], li = lanes.length > 1 ? (pick.ang > 0.6 ? 1 : pick.ang < -0.6 ? 0 : Math.min(lanes.length - 1, c.lane || 0)) : 0, off2 = lanes[li], st2 = w2.stops.find(x => x.n === n), from = w2.acc[pick.pi] + pick.dir * (st2 ? (pick.dir > 0 ? st2.sbp : st2.sbm) : n.r + 2.5);
E:3963  const bz = bezier(p0, h0, p3, h3, clamp(gap * 0.42, 1, 14), 12), turn = Math.abs(pick.ang), R = turn > 0.15 ? bz.len / turn : 1e3;
E:3964  const arc = mkArc(bz, { n, vmax: clamp(Math.sqrt(2.4 * R), 2.8, 14), inW: L.w, inDir: L.dir, inOff: L.off, axis: T.phase(n, h0[0], h0[1]), ang: pick.ang }); c.legs.push(arc); c.lane = li; c.legs.push(next); return arc;
```

- Weights: straight on (within 0.6 rad) 6, a right turn 2.2, a left turn 1.8. Turning back (over 2.7 rad) is never
  chosen; turns over 2.0 rad and dead ends are dropped when anything else is offered (E:3954-3955). There are no
  destinations and no routes: a car wanders.
- The choice is among **every direction of every driveable way at the node** except the one it came along, so
  nothing stops a car entering a carriageway or a ramp against its flow.
- **Lane use.** The lane is drawn at random when a car is put down (`c.lane = Math.floor(c.rnd() * lanes.length)`,
  E:4005). It changes only inside a crossing: a right turn lands in the kerb lane, a left turn in the inner lane,
  straight on keeps its index. From the kerb lane a car may go straight or right, from the inner lane straight or left
  (E:3953). **There is no lane change along a road.**
- **Curve speed**: `vmax = clamp(sqrt(2.4 · R), 2.8, 14)` with R the curve's length over its angle (1,000 m when it
  hardly turns): 2.4 m/s² sideways, and **a ceiling of 14 m/s on every curve, the straight ones across way joins
  included**. Harmless at 13.4 m/s; at freeway speed it would brake every car at every cut in the way.
- A dead end is left by a U-turn loop at 2.6 m/s (E:3958-3960); a portal ends the route (`L.exit = true`, E:3957).

### 3.3 How cars are put down and taken away

**How many.**

```
E:3683  fleetInit(); parked = TR.setParked(parked); TR.populate(o.cars || 60, 77, [o.center[0], o.center[1], 0, 420]);
E:4024  T.populate = (n, seed, near) => { const R = rng(seed || 77); T.cars.length = 0; (T.zones || []).forEach(z => { z.occ = []; z.queue = []; }); if (!T.driveWays || !T.driveWays.length) return; n = Math.min(n, Math.floor(T.total / 30));
E:4025  for (let i = 0; i < n; i++) { const ty = types.pickType(R()), t = types[ty], c = { id: i + 1, ty, col: types.pickPaint(R()), hl: t.L / 2, hw: t.W / 2, top: 0.86 + R() * 0.28, rnd: rng(1000 + i * 7919), legs: [], x: 0, z: 0, hx: 0, hz: 1, yaw: 0, v: 0, a: 0, brake: 0 }; if (spawn(c, near)) T.cars.push(c); } };
```

- 110, 80, 45 or 22 moving cars by quality (Ultra, High, Medium, Low; E:5170), and never more than **one car per
  30 m of driveable way**, counted along the centre line whatever the number of lanes. Put down within 420 m of the
  centre of the load.
- The fleet is fixed after `populate`: the same car objects are recycled; `T.cars` never grows.
- Parked cars: up to 1,100 (E:3643), filtered by `setParked` (E:3917-3927) so that none stands in a lane or near a
  crossing, and kept in a spatial hash (`T.pHash`, cells of 16 m) as fixed obstacles.

**Where.**

```
E:4015  for (let tries = 0; tries < 30; tries++) { let r = c.rnd() * T.total, w = T.driveWays[0]; for (const x of T.driveWays) { if (r < x.len) { w = x; break; } r -= x.len; }
E:4016  let dir = c.rnd() < 0.5 ? 1 : -1; if (w.dead[dir] && !w.dead[-dir]) dir = -dir; const d = 8 + c.rnd() * Math.max(1, w.len - 16); at(w, d, P4); if (near) { const dd = Math.hypot(P4[0] - near[0], P4[1] - near[1]); if (dd < near[2] || dd > near[3]) continue; }
E:4017  if (w.stops.some(s => Math.abs(s.d - d) < Math.max(s.sbm, s.sbp) + 7)) continue; place(c, w, dir, d); if (freeAt(c.x, c.z, c.hx, c.hz, c.hl, c.hw, c)) { c.v = w.limit * 0.6; c.out = false; return true; } }
E:4018  c.out = true; c.x = 1e7; c.z = 1e7; c.v = 0; return false;   /* nowhere free just now: it waits off the map and tries again */
```

Uniformly by length over the driveable ways, a random direction, a random lane, clear of stops and of other boxes,
moving at 60% of the limit. Thirty tries, then the car waits `out` (not drawn) and tries again twice a second.

**Taken away and brought back**, at the end of every step (E:4110-4112):
- a car at the end of an `exit` leg comes back in at another portal at least 150 m from the camera, at 80% of the
  limit (`enter`, E:4020-4023), or failing that is put down as above;
- a car farther from the camera than the radius given to `step` is recycled: six times in ten at a portal, otherwise
  on a free stretch in the ring between `min(170, 0.4 R)` and `0.85 R` from the camera, which can be in plain view;
- a car that has stood still for 45 s (150 s at a red signal) is "towed" the same way and counted in
  `T.events.tows`.

The radius:

```
E:3703  const n = Math.max(1, Math.min(4, Math.ceil(dt / 0.034))); for (let i = 0; i < n; i++) TR.step(dt / n, [cam[0], cam[2], Math.max(420, reach + 120)]);
```

With the `reach` the world passes (E:5305, quoted in section 0) that is 450 m at street level, 720 m from the drone,
bird and Alta X heights and 1,020 m from metro height. The streets themselves reach only 560 m from the last load
point, so that is the true limit.

### 3.4 The car-following law and its constants

Per car, per step (`T.step`, E:4029-4114):

1. **The speed the road allows**, easing down for a curve ahead at 1.6 m/s²:

```
E:4037  let v0 = (leg.k ? leg.vmax : leg.limit) * c.top; if (appr) { const dA = leg.len - c.s, va = nextLeg.vmax; v0 = Math.min(v0, Math.sqrt(va * va + 2 * 1.6 * Math.max(0, dA - 2))); }
```

2. **The gap**: the car's own box is carried along its route in 1.5 m steps and tested against every box near it;
   the first touch, refined by four bisections, is the gap, and the thing touched is the leader (E:4050-4059).

```
E:4040  const reach = Math.min(70, 10 + c.v * c.v / 4.4 + c.v * 1.6), step = 1.5, ns = Math.min(63, Math.ceil(reach / step)); let ne = 0;
E:4042  for (const o of cars) { if (o === c) continue; const dx = o.x - c.x, dz = o.z - c.z; if (dx * dx + dz * dz >= (reach + 8) * (reach + 8)) continue;
E:4049  const al = c.hl + 0.1, aw = c.hw + 0.28, r2 = (c.hl + 3.4);
E:4060  if (obs.length) { const r = sweep(c.nudge, false); if (r[1]) { const o = r[1]; gap = r[0]; dv = c.v - (o.static ? 0 : Math.max(0, o.v * (o.hx * c.hx + o.hz * c.hz))); why = 2; blocker = o; } }
```

   The obstacles are every other car within `reach + 8` m (a scan of the whole fleet, E:4042), the parked cars from the
   hash (E:4045-4046), and the extras: the person on foot and the loose physics bodies (E:4047). The leader is found by
   geometry, not by lane: whatever box the swept box meets, on any way, at any height.

3. **The Intelligent Driver Model**:

```
E:4087  const aMax = 2.1, bC = 2.8, s0 = why === 1 ? 0.4 : 1.7, Th = why === 1 ? 0.1 : 1.15; let a = aMax * (1 - Math.pow(c.v / Math.max(v0, 0.5), 4));
E:4088  if (gap < 1e8) { const ss = s0 + Math.max(0, c.v * Th + c.v * dv / (2 * Math.sqrt(aMax * bC))); a -= aMax * (ss / Math.max(gap, 0.05)) * (ss / Math.max(gap, 0.05)); }
E:4089  a = clamp(a, -9, aMax); if (gap < 0.25 && a > 0) a = 0; c.a = a; c.v = Math.max(0, c.v + a * dt); if (gap < 0.12) c.v = 0; c.brake = a < -0.6 || (c.v < 0.2 && why) ? 1 : 0;
```

| constant | value | meaning |
|---|---|---|
| `aMax` | 2.1 m/s² | most it accelerates |
| `bC` | 2.8 m/s² | comfortable braking |
| exponent | 4 | how sharply acceleration falls off near the desired speed |
| `s0` | 1.7 m behind a box, 0.4 m at a stop line | gap kept at a standstill |
| `Th` | 1.15 s behind a box, 0.1 s at a stop line | time headway |
| hard limits | braking no harder than 9 m/s²; no acceleration under 0.25 m of gap; speed zero under 0.12 m | |
| look-ahead | `min(70, 10 + v²/4.4 + 1.6 v)` m, in 1.5 m samples, at most 63 (`SAMP`, E:4028, holds 64) | 70 m is reached at about 13 m/s |
| swept box | the car's half length + 0.1 m, half width + 0.28 m | |
| `c.top` | 0.86 to 1.14 | each car's own factor on the limit |

   `why` records what set the gap: 0 nothing, 1 a stop line, 2 a box. `c.brake` (0, 1, or 2 after a knock) drives the
   brake lamps.

4. **Round something standing in the road** (not a queue, not a parked car): after 1.6 s it tries offsets of -1.4,
   +1.4 and -2.3 m and takes the first with 26 m clear, then eases back (E:4091-4093). This `nudge` is the only
   sideways movement a car makes on a stretch of road.

5. **Move**: `c.s += c.v * dt`, on to the next leg when this one is done, releasing the zone at the end of a movement
   (E:4096-4097); `pose(c)` (E:4006-4009) writes `c.x, c.z, c.hx, c.hz, c.yaw`, turning the box into a bend over about
   a car's length.

### 3.5 Signals, stop signs and plain joins

One clock for the whole world, 30 s:

```
E:4030  T.time += dt; T.dt = dt; T.sigT = (T.sigT + dt) % 30; const ph = T.sigT; T.ns = ph < 12 ? 'g' : ph < 14 ? 'y' : 'r'; T.ew = ph < 15 ? 'r' : ph < 27 ? 'g' : ph < 29 ? 'y' : 'r';
```

Each axis has 12 s of green and 2 s of yellow, with a second of all red between. `T.phase(n, hx, hz)` (E:3911) says
which axis an approach belongs to: within 45° of the line of the node's widest way is `ns`, the rest `ew`. Every
signal in the world changes at the same instant; there are no offsets, no turn phases, no sensors.

At the stop line of a movement it has not been given (E:4062-4085):

```
E:4063  const mv = appr.mv, n = appr.n, zone = mv.zone, dStop = leg.len - (1.7 + c.hl) - c.s; let go = false;
E:4068  let clear = first && zone.occ.every(o => o === c || !conflict(mv, o.grant));
E:4071  if (n.signal) { const lamp = appr.axis === 'ns' ? T.ns : T.ew; go = clear && (lamp === 'g' || (lamp === 'y' && dStop < c.v * c.v / 7)); }
E:4072  else { if (dStop < 2.4 && c.v < 0.3) { if (!c.stopped) c.arrive = T.time; c.stopped += dt; }
E:4074  go = clear && c.stopped > 0.7; }
E:4075  } else go = clear;
E:4077  if (go) { const after = c.legs[c.legs.indexOf(mv.last, c.li) + 1]; if (after && !after.k) { lanePoint(after, Math.min(after.len, c.hl + 2), P4); c.noRoom = !roomAt(P4[0], P4[1], P4[2], P4[3], c.hl, c.hw, c); go = !c.noRoom; } }
E:4084  if (c.grant !== mv && Math.max(0, dStop) < gap) { gap = Math.max(0, dStop); dv = c.v; why = 1; blocker = null; }
```

- `clear`: it is first in its lane and no car holding the zone has a movement that conflicts with its own.
  `conflict(a, b)` (E:3995-4002) carries a 6.0 by 2.5 m box along both curves and asks whether they ever overlap;
  the answer is cached per pair of curves.
- **Signal**: go on green, or on yellow if it can no longer stop. Left turns have no phase of their own: they go when
  the zone is clear of conflicting movements.
- **Stop sign** (a crossing with no `major` way): stop for 0.7 s, then first come first served among the movements
  that conflict (E:4072-4074).
- **A plain join** (a node that is not a crossing: two ways end to end, a way's own end): no stop, but the zone must
  still be clear.
- **Never into a crossing it cannot leave**: the lane beyond must have room for the car (E:4077).
- Until it is given the movement, the stop line is its leader with zero speed (E:4084). A movement given is held
  until the end of its last curve (E:4082, E:4097) and given back only while the car can still stop (E:4081-4083).

### 3.6 "No two cars may occupy the same ground" in code

The sentence on the dashboard (S:2400) stands for four things:

1. **Before**: the swept-box gap of 3.4 and the model's hard limits (no acceleration under 0.25 m, speed zero under
   0.12 m).
2. **At crossings**: one movement at a time unless two cannot touch (`conflict`), and the room check beyond.
3. **When putting a car down**: `freeAt` (E:4010) refuses a place whose box, grown by 1.5 m in length and 0.4 m in
   width, touches any car, or any parked car.
4. **After**: every step, each pair of cars within 8 m is tested for overlap; an overlap of more than 2 cm is
   counted, the two boxes are pushed apart along the axis of least overlap, both stop and stand with hazard lamps for
   2.5 to 3.5 s:

```
E:4102  const hit = (o, movable) => { const pen = overlap(a.x, a.z, a.hx, a.hz, a.hl, a.hw, o.x, o.z, o.hx, o.hz, o.hl, o.hw); if (pen <= 0.02) return; T.events.contacts++; if (pen > T.events.maxPen) T.events.maxPen = pen;
E:4106  for (let j = i + 1; j < cars.length; j++) { const o = cars[j]; if (!o.out && Math.abs(o.x - a.x) < 8 && Math.abs(o.z - a.z) < 8) hit(o, true); }
E:4107  for (const o of (a.near || [])) if (Math.abs(o.x - a.x) < 8 && Math.abs(o.z - a.z) < 8) hit(o, false);
```

`overlap(ax, az, ahx, ahz, al, aw, bx, bz, bhx, bhz, bl, bw)` (E:3984-3991) is a separating-axis test of two
rectangles given as centre, unit heading, half length, half width; it returns 0 or the least penetration and leaves
that axis (pointing from a to b) in `OUT`. It is public as `T.overlap` (E:3992). The push (`push`, inside `hit`,
E:4104) moves a car along its route (`c.s`) and sideways (`c.e`, which it then steers out of over a few lengths),
zeroes its speed and sets `c.crash`. `push` is not public.

The counters `T.events = { contacts, tows, maxPen }` say how well it held: in every run made here (3.9, 3.10)
`contacts` stayed 0.

**Things that are not traffic cars.** They enter as boxes too, but only as obstacles to brake for:

```
E:3701  TR.viewer = o.viewer || null; TR.bodies.length = 0;
E:3702  for (const b of phys.bodies) { if (b.pos[1] - (b.max[1] - b.min[1]) / 2 > 1.6) continue; const r = Math.max(b.max[0] - b.min[0], b.max[2] - b.min[2]) / 2; if (r > 0.12) TR.bodies.push({ x: b.pos[0], z: b.pos[2], hx: 0, hz: 1, hl: r, hw: r, v: 0, static: true }); }
E:4031  const cars = T.cars, extra = []; if (T.viewer) extra.push({ x: T.viewer[0], z: T.viewer[1], hx: 0, hz: 1, hl: 0.55, hw: 0.55, v: 0, static: true, viewer: true }); for (const b of T.bodies) extra.push(b);
```

- The person on foot is a 1.1 m square, standing still. Loose physics bodies (crates) lower than 1.6 m are squares,
  standing still, whatever their real speed. `TR.bodies` is rebuilt from `phys.bodies` every frame, so nothing can be
  left in it.
- An extra is never part of the contact pass (E:4101-4108 looks only at `cars` and at parked cars), so the traffic
  never registers being hit by one.

**What this means for the user's car.** The shape of an obstacle is `{ x, z, hx, hz, hl, hw, v, static }`. Passed
with `static: false`, its true heading and its true speed, the cars behind follow it properly (E:4060 takes the
leader's speed along the follower's heading) and cars at a crossing wait behind it. Two things have to be added:
a way in (an `o.actors` list on `X.update`, appended to `extra` after E:3702: if the car were instead a dynamic
physics body, E:3702 would make it a motionless square and the traffic behind would brake as for a wall), and the
contact itself: the car kit tests its own box against `TR.cars` and `TR.parked` with `TR.overlap` and applies the
knock on both sides (to its own motion, and to the traffic car through an exported `push`).

**The traffic in the physics world** (E:3697, E:3706-3707): each moving car is also a kinematic box body carrying its
velocity, so a thrown crate bounces off it and is carried by it; the 60 nearest parked cars within 70 m of the camera
are static boxes. Kinematic and static bodies live in `phys.statics`, which the walking character collides with
(5.3).

### 3.7 Headlights after dark

Two separate things, both driven by `night = smoothstep(2, -6, S.sunAlt)` (0 with the sun 2° up, 1 with it 6° down):

- **Drawn lamps, on every car.** The car shader lights the lamp areas by the renderer's `u_night` (`u_night:
  env.night`, E:1784): head lamps `lampOn * (0.25 + 26.0 * u_night)` (E:3751), tail lamps `(0.22 + 6.5 * u_night +
  5.0 * braking)` (E:3761). Braking and hazard come from the instance's alpha (4.4). These light nothing; with bloom
  they glow.
- **Real lights, on a few.** Eight, six, three or no spot lights by quality, moved each frame to the nearest moving
  cars within 160 m of the camera, when `night > 0.3`:

```
E:3712  X.nearCars = (cam, n) => TR.cars.filter(c => !c.out).map(c => [c, Math.hypot(c.x - cam[0], c.z - cam[2])]).filter(a => a[1] < 160).sort((a, b) => a[1] - b[1]).slice(0, n).map(a => a[0]);
E:5306  const n = night > 0.3 ? ({ ultra: 8, high: 6, medium: 3, low: 0 }[engine.quality] || 0) : 0; while (HEAD.length < n) { const e = scene.createEntity('Headlights', { parent: gFx, transient: true }); e.add('Light', { type: 'spot', color: [1, 0.95, 0.85], intensity: 0, range: 34, angle: 70, blend: 0.5 }); HEAD.push(e); }
E:5307  const near = n ? ST.nearCars(cam.entity.transform.position, n) : []; HEAD.forEach((e, i) => { const c = near[i]; if (!c) { if (e.active) e.setActive(false); return; } if (!e.active) e.setActive(true); const hx = Math.sin(c.yaw), hz = Math.cos(c.yaw); e.transform.setPosition(c.x + hx * 2.4, 0.75, c.z + hz * 2.4); Q.fromEuler(e.transform.rotation, Rd(-9), Math.atan2(-hx, -hz), 0); e.transform.dirty(); e.get('Light').intensity = 260 * night; }); }
```

  One spot per car, 2.4 m ahead of its centre, 0.75 m up, pitched 9° down, 34 m range, 70° cone. Parked cars have
  none. The user's car is not in `TR.cars`, so it needs its own pair of lights.

### 3.8 `ST.update(dt, camPos, o)`

```
E:3689  /* o: { night, moving, viewer: [x, z] or null (a person standing in the street), reach } */
E:3690  X.update = (dt, cam, o) => {
E:3691  if (!fleet || !group || !group.active) return false; const night = o.night || 0, reach = o.reach || 330;
E:3709  return !!o.moving;
```

| argument | what it is |
|---|---|
| `dt` | the frame time in seconds |
| `cam` | the camera's world position `[x, y, z]` (the camera entity's, E:5305; in a chase view this is behind the craft, not `S.x, S.z`) |
| `o.night` | 0 to 1; sets the brightness of the signal lamps (`14 + 30 * night`, E:3692) |
| `o.moving` | step the traffic this frame or leave it standing |
| `o.viewer` | `[x, z]` of a person on foot, or null |
| `o.reach` | how far parked cars are drawn; the traffic's recycle radius is `max(420, reach + 120)` |

Returns `false` if there is no fleet or the street life is off or there are no cars; otherwise `o.moving`, and the
world then asks for another frame (`need()`).

In order it: sets the signal lamps (E:3692); re-sorts the parked cars into three levels of detail and renews their
static bodies when the camera has moved 24 m (E:3694-3698); if `o.moving`, sets the viewer, rebuilds `TR.bodies` and
steps the traffic in one to four sub-steps of at most 34 ms (E:3700-3704); then, every frame, gives every car its
kinematic body and refills the two instance buffers of moving cars for each of the five types (E:3706-3708).

Also on the kit: `X.traffic` (the simulator), `X.nearCars(cam, n)`, `X.stats` (`{ parked, cars, crossings, signals,
stops }`, E:3684), `X.setActive(on)`, `X.network`, `X.build`. The world's public object carries it as `street`
(E:5449), so `view.street.traffic.cars` is reachable from outside.

### 3.9 Cost per frame

Measured in Node 22 in this container: `Traffic` and `StreetKit.network` cut from engine.js, `T.step(1/60)` alone
(no drawing, no physics bodies), averaged over 600 to 3,600 steps. "Cap lifted" means `T.total` was scaled up for the
call to `populate` so that more cars than one per 30 m were put down.

| network | cars | ms per step | mean speed m/s | standing still |
|---|---|---|---|---|
| a 1 km grid: 20 streets and 2 `major`, 100 m blocks | 22 | 0.15 | 6.0 | 7% |
| | 45 | 0.19 | 5.9 | 9% |
| | 80 | 0.37 | 5.8 | 10% |
| | 110 | 0.58 | 5.8 | 11% |
| | 300 (cap lifted) | 3.1 | 3.9 | 19% |
| | 600 (cap lifted) | 9.0 | 4.0 | 18% |
| two parallel `major` ways of 1.2 km, 30 m apart (a freeway as loaded today) | 80 | 1.3 | 12.6 | 0% |
| | 400 (cap lifted) | 11.6 | 7.0 | 0% |

- The step grows with the square of the fleet: every car scans every car for obstacles (E:4042), then sweeps up to
  47 samples against each one kept (E:4051-4058), and the contact pass is every pair (E:4106). On a freeway
  everybody is inside everybody's reach, which is why 80 cars on two carriageways cost three and a half times 80 cars
  on a grid.
- 400 cars on one freeway took 11.6 ms a step here: most of a 16.7 ms frame, before anything is drawn.
- Besides the step, each frame allocates: `TR.bodies` objects (E:3702), the `extra` and `obs` arrays per car
  (E:4031, E:4041), a closure per car (`sweep`), and at night `nearCars` maps and sorts the whole fleet (E:3712).
- Each traffic car is also a body in `phys.statics`; every ray cast (the pointer's pick every 60 ms, the label
  visibility test) and every awake dynamic body tests all of them one by one (5.2).
- Drawing (not measured): a moving car within 55 m is 6,800 to 8,000 triangles, beyond it about 2,000 (4.3); there is
  no coarser level for a moving car, and the far set casts shadows (4.4).

### 3.10 What stops it carrying a six-lane-each-way freeway with ramps and stop-and-go waves

Checked by running today's code on small synthetic networks (60 simulated seconds and 40 cars for cases 1 to 3, 120
seconds and 80 cars for cases 4 and 5; in each case as many cars as the cap of one per 30 m allows or fewer):

| case | mean speed m/s | standing | crossings made | tows |
|---|---|---|---|---|
| 1. one `major` way, 1.2 km, in one piece | 12.5 | 0% | none | 0 |
| 2. the same cut into four ways end to end | 12.3 | 0% | none | 0 |
| 3. the same with a ramp (`major`) joining at one of its points | 9.8 | 15% | one, degree 3, **signal** | 0 |
| 4. two `major` ways that cross in plan with no point in common (a bridge) | 9.4 | 20% | none | 5 |
| 5. the same two sharing a point (an ordinary signalised crossing) | 9.4 | 18% | one, degree 4, signal | 6 |

Case 4 behaves like case 5 with nobody directing: the cars on the bridge and the cars under it brake for each other.

The list, in the order a patch meets them:

1. **Data**: no lane count, direction, speed limit or level reaches the engine (1.2, 1.3); on the fallback there is
   no freeway at all (1.4).
2. **Lanes are per kind**: two each way on `major`, at fixed offsets (E:3884). Six lanes one way cannot be said.
3. **No one-way**: both directions on every way (E:3884), and turns into any direction of any way (E:3949-3951).
4. **Speed**: two limits, 13.4 and 8.9 m/s (E:3885); curves, including straight joins, capped at 14 m/s (E:3964).
5. **Look-ahead**: 70 m and 63 samples (E:4040, E:4028). At 30 m/s that is 2.3 s; a comfortable stop from 30 m/s at
   `bC` takes 160 m. Cars would arrive at a standing queue in emergency braking (the model allows 9 m/s²).
6. **Ramps are crossings**: any node of degree 3 or more is a crossing, and with a `major` leg a signal (E:3616).
   There is no merge with gap acceptance, no diverge, no acceleration lane, no yield.
7. **No lane changes** (3.2): no overtaking, no moving over for a merge, no weaving, no keeping right, no exit lane.
   Without them a six-lane road is six independent queues.
8. **One plane**: the obstacle test is geometric and has no height (E:4042-4060); roads over and under each other
   block each other (case 4). The ribbons are flat too (2.2).
9. **Waves**: the law can make them; today's speed, today's `aMax` and the density cap do not let it. The update of
   E:4087-4089 was run on its own on a closed single lane of 2 km (cars 4.9 m long, each with its own factor of 0.86
   to 1.14 on the desired speed as in the engine, started evenly spaced, one car braked to a stop for 6 s; the
   slowest and the fastest car's speed, m/s, between minute 10 and minute 15):

   | desired speed | `aMax` | 20 cars/km | 30 | 45 | 60 | 80 |
   |---|---|---|---|---|---|---|
   | 13.4 m/s (today) | 2.1 (today) | 11.5 to 11.8 | 11.4 to 11.6 | 9.9 to 10.7 | 7.0 to 8.8 | 3.9 to 6.1 |
   | 29 m/s (65 mph) | 2.1 | 23.8 to 24.1 | 19.7 to 20.4 | 7.3 to 16.1 | 5.1 to 12.7 | 3.9 to 7.1 |
   | 29 m/s | 1.0 | 23.9 to 24.0 | 0.4 to 23.9 | 0 to 22.8 | 0 to 22.1 | 0 to 15.9 |
   | 29 m/s | 0.7 | 23.8 to 24.1 | 0 to 25.7 | 0 to 25.8 | 0 to 25.1 | 0 to 18.1 |

   At today's limit a disturbance dies down to a ripple. At 65 mph with today's `aMax` the lane settles into
   slow-and-go. With `aMax` at 1.0 m/s² it is full stop-and-go from 30 cars per kilometre of lane. So waves need the
   freeway's speed, an `aMax` near 1, and 30 or more cars per kilometre per lane: over five times what the cap allows
   (item 10). A merge or a lane drop then decides where they start.
10. **Density**: at most one car per 30 m of way, all lanes together, and at most 110 cars (E:4024, E:5170). Six
    lanes at 30 m of way per car is 5.6 cars per kilometre per lane. A freeway lane at capacity holds 25 to 30, a
    standing jam over 100.
11. **Nothing depends on the hour**: no demand, no clock in the traffic. The hour is available in the world as
    `S.sunTime` (a `Date`, E:5230) and the preset `gfx.sun` (a name, or a number of hours from the dashboard's hour
    slider, S:2463); `sunTime` (E:5213-5218) works in local solar time (`offH = lon / 15`), which in Los Angeles,
    San Diego and San Francisco is within 12 minutes of Pacific Standard Time (an hour off it in summer).
12. **Cost**: quadratic in cars (3.9). A lane-ordered model (each car looks only at the car ahead in its lane and
    the neighbours in the next) is linear and is what a freeway needs; the swept box can stay for the streets.
13. **Reach and rebuilding**: streets for 560 m only, the whole network and fleet thrown away and rebuilt every
    230 m of travel (1.1). A freeway needs kilometres of road held steady, and cars that survive a reload.
14. **Vehicles**: five passenger types (4.1). No heavy trucks, buses or motorcycles; the box test and the type
    table would take them, the body builder (one lofted skin with one cab, 4.2) would not.
15. **Recycling in view**: cars are put down in a ring that starts 170 m from the camera (3.3); on a straight
    freeway that is in plain sight. Entry should be at the far ends of what is loaded.
16. **Drawing**: no coarse level for moving cars, no culling inside a set of instances, shadows from the far set
    (4.4).

---

## 4. The car bodies (`CarKit`, E:3793-3860; the shader chunk `carpaint`, E:3726-3791)

### 4.1 The five kinds and their parameters

`C.types` (E:3796-3802) holds five records, "cut to the measurements of the kinds of vehicle that fill Louisiana's
streets" (E:3720). One of them:

```
E:3797  { name: 'Midsize sedan', style: 0, L: 4.88, W: 1.84, H: 1.445, wb: 2.825, fo: 0.97, gc: 0.15, rw: 0.335, tw: 0.225, hbF: 0.93, hbR: 0.99, hc: 0.985, hn: 0.74, hd: 1.045, cab: [-1.78, -0.92, 0.2, 1.0], zB: -0.02, zC: -99, tumble: 0.2, crown: 0.045, pf: 0.05, pr: 0.04, rf: 0.5, rr: 0.42, share: 0.24 , soft: 0.11},
```

| kind | `style` | L | W | H | wheelbase | share of the fleet |
|---|---|---|---|---|---|---|
| Midsize sedan | 0 | 4.88 | 1.84 | 1.445 | 2.825 | 0.24 |
| Compact crossover | 1 | 4.60 | 1.855 | 1.69 | 2.69 | 0.24 |
| Full-size SUV | 2 | 5.35 | 2.06 | 1.93 | 3.07 | 0.14 |
| Full-size pickup | 3 | 5.89 | 2.03 | 1.96 | 3.69 | 0.28 |
| Electric crossover | 4 | 4.75 | 1.92 | 1.624 | 2.89 | 0.10 |

What each field does (read from `build`, E:3804-3850; all in metres, z along the car from the middle, nose at +z):

| field | meaning |
|---|---|
| `style` | the body style the shader branches on (E:3731): 0 sedan, 1 crossover, 2 SUV, 3 pickup, 4 electric |
| `L`, `W`, `H` | overall length, body width without mirrors, height |
| `wb`, `fo` | wheelbase and front overhang: the front axle is at `L/2 - fo`, the rear at that less `wb` (E:3805) |
| `gc` | ground clearance: the height of the sill (E:3816) |
| `rw`, `tw` | wheel radius to the tread, and tyre width (E:3841-3843) |
| `hbF`, `hbR` | height of the beltline (the foot of the side glass) at the nose and at the tail (E:3809) |
| `hc`, `hn`, `hd` | height of the top line at the windscreen's foot, at the nose, and of the rear deck (E:3806) |
| `cab` | where the glass starts and ends: rear glass foot, rear of roof, front of roof, windscreen foot (E:3795) |
| `zB`, `zC` | where the pillars between the side panes stand; -99 for none (shader, E:3773) |
| `tumble`, `crown` | how far the glass leans in toward the roof; how much the roof is crowned (E:3816, E:3820) |
| `pf`, `pr`, `rf`, `rr` | seen from above: how much the sides draw in toward nose and tail, and the corner radii (E:3811) |
| `soft` | the distance over which the roof line is eased through its corners (E:3808) |
| `share` | the kind's share of traffic and parked cars (`C.pick`, E:3857); the five sum to 1 |

California's mix is not Louisiana's (fewer full-size pickups, more electric cars and sedans): `share` is the knob.

### 4.2 How a mesh is made (`build(t, q)`)

- **One skin, lofted.** Cross-sections every `q.dz` along the car, closer (`q.dzw`) round the wheels where the arches
  are cut in (E:3812-3814, E:3828). Half a section runs from the sill up the flank (`q.nL` rows), up the glass
  (`q.nG`), and over the roof (`q.nR`) to the centre line (E:3816-3821); it is mirrored into a ring. The top line is
  pieced from the `cab` points and smoothed (E:3806-3808).
- **Two flat faces** close the nose and the tail (E:3832-3834), a quad closes the underside (E:3836), two small boxes
  are the door mirrors (E:3838-3839).
- **Four wheels in the same mesh**: a tyre and a rim face turned about the axle in `q.seg` steps, at the two axles
  and the half width (E:3840-3844).
- Every vertex carries: position, normal, a `uv` and four floats `aux = (x, y, z, zone)` in the car's own frame
  (E:3829). `zone` says which part it is: 0 skin, 1 nose face, 2 tail face, 3 wheel, 4 mirror, 5 underside. On the
  skin `uv = (z, ±a)` with `a` running round the body: 0 on the roof's centre line, 0.6 at the shoulder, 1 at the sill
  (E:3767). The vertex colour is white (E:3848).
- **Everything fine is drawn by the fragment shader** (`carPaint`, E:3729-3791) from those coordinates and five
  uniform vectors: the glass and the blacked-out pillars, the wheel wells, cladding, door cuts and handles, the grille,
  head and tail lamps, plates, bumpers, the spokes of the wheels. No texture is used.

The three levels of detail are three calls with a coarser `q`:

```
E:3856  v = { t, fine: build(t, { dz: 0.14, dzw: 0.06, nL: 9, nG: 3, nR: 4, seg: 20 }), mid: build(t, { dz: 0.3, dzw: 0, nL: 4, nG: 2, nR: 2, seg: 12, out: 0.03 }), far: build(t, { dz: 0.8, dzw: 0, nL: 2, nG: 1, nR: 1, seg: 6, out: 0.03 }), still: mat(0), rolling: mat(7) }; made.set(i, v); return v; };
```

### 4.3 Triangle counts

`build` run headless here (a stub in place of `Mesh`), wheels included:

| kind | fine | mid | far |
|---|---|---|---|
| Midsize sedan | 6,760 | 2,008 | 928 |
| Compact crossover | 6,988 | 1,832 | 872 |
| Full-size SUV | 7,368 | 2,008 | 900 |
| Full-size pickup | 7,976 | 2,096 | 928 |
| Electric crossover | 7,064 | 1,920 | 900 |

The sedan's fine mesh spans x ±1.08 m (the mirrors stand 0.16 m proud of `W/2`), y 0 to 1.49, z -2.44 to 2.43.

### 4.4 Materials, colours, instancing, level of detail

**Two materials per kind**, standing and rolling:

```
E:3854  const params = spin => ({ u_carA: [t.L, t.W, t.gc, t.rw], u_carB: t.cab, u_carC: [zaF, zaF - t.wb, t.hbR, t.hd], u_carD: [t.style, t.zB, t.zC, spin], u_carE: [t.H, t.hc, t.hn, t.hd] });
E:3855  const mat = spin => { const m = new Material({ name: t.name + (spin ? ' (moving)' : ''), vertexColors: true, roughness: 0.23, metallic: 0.5, wet: 0, params: params(spin) }); m.car = true; return m; };
```

`m.car = true` selects the `CAR` variant of the surface shader (E:776, E:850, E:910). A rolling wheel does not turn:
the shader turns the spoke pattern at a fixed 7 rad/s (`th = atan(v_uv.y, v_uv.x) + u_time * u_carD.w`, E:3739),
whatever the car's speed.

**Colour** is the instance's: the vertex shader multiplies the white vertex colour by the instance colour (E:811).
Ten paints with weights:

```
E:3602  const PAINT = [['#f4f4f2', 0.25], ['#0a0a0b', 0.19], ['#9a9ea3', 0.16], ['#4c4f54', 0.14], ['#7e1512', 0.08], ['#1a3767', 0.08], ['#213a2c', 0.02], ['#b3a184', 0.04], ['#c65a1b', 0.02], ['#4f2424', 0.02]].map(([h, w]) => [K.hexRGB(h), w]);
```

**What the car is doing** rides in the instance's alpha: 1 rolling, 0.75 braking, 0.5 standing after a knock.

```
E:3735  float braking = step(v_color.a, 0.9), hazard = step(v_color.a, 0.6) * step(0.5, fract(u_time * 1.4));
```

**Instancing.** One entity per kind with five instanced renderers, each with its own buffer:

```
E:3605  function fleetInit() { if (fleet) return fleet; fleet = TYPES.map((t, i) => { const c = CK.get(i), e = scene.createEntity(t.name + 's', { parent: group, transient: true }), sets = {};
E:3606  [['near', c.fine, c.still, 130], ['mid', c.mid, c.still, 90], ['far', c.far, c.still, 0], ['mnear', c.fine, c.rolling, 130], ['mfar', c.mid, c.rolling, 90]].forEach(([k, mesh, mat, sh]) => { const ib = new InstanceBuffer(dev, 64), r = e.add('InstancedRenderer'); r.instances = ib; r.mesh = mesh; r.material = mat; r.castShadow = sh > 0; r.shadowDistance = sh || 1; sets[k] = ib; });
```

**The level of detail is chosen on the processor, car by car, by which buffer it is put in:**

```
E:3696  for (const c of parked) { if (c.d > reach) break; fleet[c.ty].sets[c.d < 42 && nNear++ < 14 ? 'near' : c.d < 150 ? 'mid' : 'far'].add(c.x, 0, c.z, c.yaw, 1, 1, 1, c.col[0], c.col[1], c.col[2], 1);
E:3708  const dc = Math.hypot(c.x - cam[0], c.z - cam[2]); fleet[c.ty].sets[dc < 55 ? 'mnear' : 'mfar'].add(c.x, 0, c.z, c.yaw, 1, 1, 1, c.col[0], c.col[1], c.col[2], c.brake === 2 ? 0.5 : c.brake ? 0.75 : 1); }
```

- Parked: the 14 nearest within 42 m fine, to 150 m middling, beyond that coarse; re-sorted when the camera has moved
  24 m. Moving: within 55 m fine, **everything else middling**; refilled every frame. The coarse mesh is never used
  for a moving car.
- `InstanceBuffer.add(x, y, z, yaw, sx, sy, sz, r, g, b, a)` (E:471) places an instance by a position and a turn
  about the vertical only: a traffic car cannot pitch or roll. `addMatrix(m, col)` (E:476) takes a whole matrix.
  Buffers grow by themselves (E:469).
- The renderer culls, picks the level of an `lods` list, and decides on shadows **per set**, from one sphere round all
  the set's instances (E:1667-1679). No car is culled alone, and a set whose sphere reaches the camera is "near" for
  the shadow test, so the far moving set casts shadows in all four cascades it touches.
- Instances have no motion vectors: the vertex shader uses the same instance matrix for this frame and the last
  (`mat4 M = u_model * inst, PM = u_prevModel * inst`, E:811), so the temporal filter takes a moving car for a still
  one.

For hundreds of freeway cars this wants: the coarse mesh for moving cars past about 150 m (it exists, 900 triangles),
no shadows from far sets, and sets split along the road so that what is behind the camera is culled.

### 4.5 What a detailed hero car can reuse, and what it cannot

BMW's own sheet is already in the scratchpad (`SP/research/ca/engine_txt/bmw_g80_specs_032021.pdf.txt`, lines 16-20
and 70): length, width, height 4794 / 1903 / 1433 mm, wheelbase 2857, track 1617 / 1605, ground clearance 120, front
tyres 275/40 ZR18.

Reuse as it is:
- `build(t, q)` with a sixth record: `L, W, H, wb, gc, tw` straight from the sheet, `rw` from the tyre size (0.339 m
  for 275/40 R18). The other fifteen fields (`fo`, the belt, cowl, nose and deck heights, `cab`, the pillars, the plan
  radii) are shape and have to be set against a side view and marked as assumed, the way `AltaKit` marks
  `SPEC.assumed` (E:4465).
- A finer `q` for the hero: the builder is parametric. Measured on the sedan record: `{ dz: 0.07, dzw: 0.03, nL: 14,
  nG: 5, nR: 6, seg: 32 }` gives 14,888 triangles, `{ dz: 0.05, dzw: 0.025, nL: 18, nG: 6, nR: 8, seg: 40 }` 22,384
  (against 6,760 for the fleet's fine level).
- `carPaint` for the glass, pillars, door cuts, lamps, plates and wheel faces, on the sedan path (`style` 0).
- The entity pattern of `AltaKit` (a root and child `MeshRenderer`s, 6.1), which gives true motion vectors
  (`prevWorld`, E:1673).

Has to change:
1. **Wheels.** They are baked into the body mesh at fixed places (E:3842-3844) and their turning is a shader trick at
   a fixed rate. A driven car needs four wheel entities of their own (steer on the front pair, spin at v / r,
   suspension travel). So: an option in `q` to leave the wheels out of the body, and the wheel profile lifted out into
   a mesh of its own; the shader's wheel branch (`zone` 3, E:3738-3744) paints it unchanged with `u_carD.w = 0`.
2. **Building by record.** `C.get(i)` builds by index into `C.types` (E:3853), and `fleetInit` makes five instance
   sets for every type (E:3605). A hero record appended to `C.types` with `share: 0` is never picked for traffic but
   still gets five empty sets; a `C.make(t, q)` that takes a record directly is cleaner.
3. **Brake and hazard lamps.** They come from `v_color.a` (E:3735). In a plain `MeshRenderer` that is the vertex's
   alpha (`v_color = a_color`, E:813), always 1: the lamps would never light. Add a uniform to the chunk (it declares
   `uniform vec4 u_carA, u_carB, u_carC, u_carD, u_carE;` at E:3727), say `u_carF = [brake, indicator, reverse, 0]`,
   set through the material's `params`, and take the larger of it and the alpha test.
4. **Paint.** With no instance colour the paint is the material's `albedo` times the white vertex colour.
5. **The face of the car.** The sedan's grille is one thin slot (E:3749) and the generic fleet copies no make's
   grille on purpose (E:3722). Twin tall openings, four tail pipes, flared arches and a dark roof need a new `style`
   value and branches for it in `carPaint`.
6. **No interior.** Glass is drawn opaque and dark (`glassC`, E:3732). A view from the driver's seat has nothing to
   show; a bonnet or bumper camera does not need one.
7. **Left and right.** In the car's frame +x is its left (section 0); the shader mirrors everything about x
   (`abs(v_uv.x)`, `abs(p.x)`), so a left-hand-drive detail or a single indicator needs the sign of `p.x`.

---

## 5. Physics (`Physics`, E:2534-2741; `RigidBody`, E:2744-2760)

### 5.1 The solver

```
E:2628  constructor(engine) { this.engine = engine; this.gravity = [0, -9.81, 0]; this.bodies = []; this.statics = []; this.prisms = []; this.grid = new Map(); this.cell = 24; this.groundY = 0; this.ground = true; this.iterations = 8; this.awake = 0; this.contacts = []; this.characters = []; this.groundFriction = 0.7; }
```

- **Shapes**: a box (`{ kind: 'box', h: [hx, hy, hz] }`), a sphere (`r`), a capsule (`r`, `hh`). Nothing else: no
  compound shapes, no meshes, no joints, no springs, no motors. The only constraint is contact.
- **Bodies** (E:2541-2568): `type` is `dynamic`, `static` or `kinematic`; the last two live in `world.statics`
  (E:2629). Defaults: restitution 0.15, friction 0.6, linear damping 0.02, angular 0.06, mass from the volume at
  400 kg/m³ unless given (E:2544-2546); a box's inertia is the solid box's (E:2550). `impulse(j, at)` pushes at a
  world point (E:2564). There is no force accumulator.
- **A step** (E:2662-2687): gravity; contacts found afresh (each dynamic body against the ground plane, the prisms
  near it, every static body in turn, and every other dynamic body, E:2652-2667); then 8 passes of sequential
  impulses with friction in two directions and bounce above 1 m/s of closing speed (E:2669-2677); positions corrected
  through a bias of 0.2 / dt with 1 cm of slop; damping; a body still for 0.7 s sleeps (E:2682).
- **Friction** of a contact is `sqrt(mu * body.friction)`: `mu` is 0.7 on the ground, 0.6 on a building (E:2654,
  E:2658, E:2673). **Restitution** is the lesser of the two bodies', 0.3 standing in for the ground and buildings
  (E:2673).
- **A kinematic body pushes**: the relative velocity of a contact includes the driven body's own velocity ("a car
  carries what it hits", E:2688). That is how traffic cars throw crates.
- **Time**: fixed steps of 1/60 s, up to five a frame (E:2465). No continuous collision test: a body that moves
  further than its own size in a step can pass through something thin.
- The header says what it is sized for: "Scaled to hundreds of bodies, not tens of thousands" (E:2538). Pairs of
  dynamic bodies are tested all against all; statics are scanned in a line.

### 5.2 Buildings are prisms; the ground is a plane

```
E:2632  addPrism(ring, y0, y1, userData) { const bb = Poly.bounds(ring), p = { id: uid(), ring, y0, y1, bb, ccw: Poly.area(ring) > 0, userData: userData || null, cells: [] }; this.prisms.push(p);
E:5015  g.rings.forEach(r => c.prisms.push(phys.addPrism(r.P, 0, r.h, { id: b.id }))); if (b.extra) nx++; else c.labels.push({ id: b.id, x: g.cx, y: g.top + 1.4, z: g.cz }); }
```

- A building is one prism per part of its footprint, from the ground to that part's height, tagged with the
  building's id. Prisms come and go with the detailed cells: within 200 to 400 m of the camera by quality (`reach`,
  E:4985), removed with the cell (E:4991), all cleared on a recentre (E:5390). **The wider city's blocks and the
  skyline have none** ("Nothing here is solid or pickable", E:4125): past the detailed cells a car would drive
  through buildings, and at 30 m/s the detailed cells are 7 to 13 seconds ahead.
- Prisms sit in a grid of 24 m squares; `prismsIn(x0, z0, x1, z1, out)` returns those whose boxes touch a rectangle
  (E:2636).
- **A box touches a prism only at its eight corners** (E:2658): each corner is tested as a point (`_prismPoint`,
  E:2642-2647), pushed out sideways through the nearest wall, or up through the roof when that is nearer. The corner
  of a building entering the flank of a box between the box's corners is not seen at all.
- Solid things that are **not** in the physics: road surfaces, kerbs and sidewalks, trees, lamp posts, signal masts,
  stop signs, rooftop equipment. Only buildings, the ground, parked cars (the 60 nearest) and moving cars are.

**Rays, and the three helpers the craft use:**

```
E:2692  raycast(o, d, max) {
E:5144  const floorTop = (x, z) => { let top = 0; for (const p of phys.prismsIn(x - 0.5, z - 0.5, x + 0.5, z + 0.5, NEARP)) if (p.y1 > top && Poly.contains(p.ring, x, z)) top = p.y1; return top; };
E:5145  const blockAt = (x, z, y) => { const r = 1.25; for (const p of phys.prismsIn(x - r, z - r, x + r, z + r, NEARP)) { if (y > p.y1 + 0.05) continue; if (Poly.contains(p.ring, x, z) || Poly.contains(p.ring, x + r, z) || Poly.contains(p.ring, x - r, z) || Poly.contains(p.ring, x, z + r) || Poly.contains(p.ring, x, z - r)) return true; } return false; };
```

- `raycast(origin, dir, max)` returns the first hit as `{ t, point, normal }` plus one of `ground: true`, `prism`,
  `body`. It tests the ground plane, **every prism in the world** (a box test first; the grid is not used, E:2695),
  and every body (spheres exactly, boxes and capsules as oriented boxes, E:2701-2705).
- `phys.floorAt(x, z, y, step)` (E:2709): the highest roof under a point that feet at height `y` could step onto.
- `floorTop(x, z)`: the top of the tallest prism whose footprint holds the point, else 0. It is the drone's ground: a
  roof is somewhere to land. For a car it is the wrong question.
- `blockAt(x, z, y)`: yes or no, whether the point or any of four points 1.25 m from it is inside a prism at least
  `y` tall. No normal and no depth: the Alta X answers a yes by dropping one axis of its motion (E:4534). That is not
  a collision a car can use.
- What gives a normal and a depth in plan: `phys._edge(pr, x, z, o)` (E:2638-2640: nearest point of a footprint's
  outline, and whether the point is inside) and `phys._prismSide(pr, x, z, r)` (E:2649: `[nx, nz, depth]` for a
  circle against the walls).

### 5.3 The character (E:2720-2739)

A circle 0.35 m in radius and 1.75 m tall, moved by intent, not by forces. Each frame it is moved in pieces no longer
than 0.6 of its radius (E:2724), pushed out of building walls with `_prismSide` (E:2727-2728), pushed out of every
static or kinematic box, which is parked and moving cars (E:2730-2732), stood on `floorAt` with a step of 0.45 m
(E:2733); it jumps at 4.6 m/s and shoves loose bodies (E:2737). It has no mass and no momentum. The world keeps one
for walking (E:5259, E:5294).

### 5.4 Could a raycast-wheel vehicle be built on this solver?

| a raycast vehicle needs | here |
|---|---|
| a chassis as a rigid body with mass and inertia | yes: a dynamic box |
| a ray down from each wheel to find the ground | `raycast` exists, but the only thing under a wheel is the plane y = 0: roads and kerbs have no shape and the world is flat. The ray returns a constant. |
| spring, damper and tyre forces at four points | only `impulse(j, at)`; workable from a component's `onFixedUpdate`, which runs before each physics step (E:2465) |
| a small step for the tyres | fixed at 1/60 s for the whole world; one body cannot be sub-stepped |
| the solver to stay out of the way | it would not: the box's own ground contacts (friction 0.7) act the moment the body touches down; every body is damped (0.02 and 0.06 per second, per-body fields, E:2544); a still body sleeps |
| walls that stop a car | corners only (5.2), no continuous test, 0.15 bounce: at speed a car would clip corners or be thrown out through a roof |

**Verdict: keep the car separate**, the way `AltaKit` and `UapKit` are (their own state, their own integration,
called from the world's update handler), and use the physics world only for what it has:

1. **Own model, own step.** A rigid body in plan (x, z, yaw and their rates) with the sprung mass's heave, pitch and
   roll on four suspension corners, stepped inside the kit's `update(dt, env)` at a fixed small step (`dt` arrives up
   to 0.1 s, E:2460). Ground height is 0 everywhere today.
2. **Buildings.** `phys.prismsIn` over the car's bounding box, then the car's oriented rectangle against each ring's
   edges (its own separating-axis test, or its corners and edge midpoints through `phys._edge`) for a normal and a
   depth, then an impulse on the planar body with its yaw. All prisms start at y = 0 today, so none is above the car.
3. **Traffic and parked cars.** Rectangles against rectangles with `TR.overlap` (3.6).
4. **So the rest of the world sees the car.** One kinematic box in `phys` with its velocity, as each traffic car has
   (E:3706-3707): crates bounce off, the walking character is pushed out, rays hit it. And one entry in the traffic's
   obstacle list with its true speed (3.6).
5. **Things with no shape** (poles, trees, kerbs) stay invisible to the car unless they are given positions: lamp
   posts are in `LAMP.spots` (E:5244), signals and stop signs are instance buffers local to `ST.build`, trees are in
   each cell's `c.trees.list` (E:5057).
6. **Grip and water.** `scene.env.wetness` (0 dry to 1, set from the weather and the storm scale, E:5219-5220,
   E:5232-5233) and the flood depth `SK.now.surge` are there to scale tyre grip and to stop the car.
7. **If roads are given heights** (2.7), the car's ground must come from the road model through `env.floor`, not
   from `phys`.

---

## 6. How the Alta X and the two craft are wired in, as the pattern for a car

### 6.1 A kit

`AltaKit(engine, K)` (E:4462-4550) and `UapKit(engine)` (E:4803-4898) have the same shape:

| part | Alta X | what it is |
|---|---|---|
| `SPEC` | E:4464-4465 | the published figures, and under `assumed` everything that is not published |
| meshes | E:4469-4491 | built from the dimensions with `MeshBuilder` (`box`, and a local `tube`), one mesh per moving part |
| materials | E:4492-4493 | a vertex-coloured body material, an alpha material for the propeller blur, unlit emissive lamps |
| entities | E:4496-4500 | a root and child entities, each with a `MeshRenderer`, `pickable = false`; hidden until asked for |
| `state` | E:4502 | position, velocity, yaw, pitch, roll, mode, and what the HUD shows |
| `input` | E:4503 | `{ fwd, right, up, yaw }`, each -1 to 1, written by the world every frame |
| commands | E:4504-4513 | `place(x, z, yaw, floorY)`, `show(on)`, `takeoff`, `land`, `rtl`, `goTo(x, z, yaw)` |
| `update(dt, env)` | E:4516-4547 | one step; `env` is `{ floor(x, z), block(x, z, y), wind: [x, z] }`; returns true while it needs frames |
| `pose()` | E:4514 | writes the root's transform from the state |
| `dispose()` | E:4548 | |
| registration | E:4551 | `SE.AltaKit = AltaKit` |

`UapKit` adds `use(kind)` for its two bodies, `warp`, and `anchor()` (where the camera hangs while the craft jumps).
The kit knows nothing of the world: it gets the ground and the walls through `env`, and the world reads its `state`.

### 6.2 The world's side, piece by piece

**The mode table and the craft's handles.**

```
E:4930  const HEIGHT = { street: { eye: 1.7, pitch: 2 }, walk: { eye: 1.7, pitch: 0 }, drone: { eye: 38, pitch: -32 }, bird: { eye: 120, pitch: -58 }, orbit: { eye: 0, pitch: -28 }, alta: { eye: 30, pitch: -14 }, metro: { eye: 1400, pitch: -36 }, saucer: { eye: 60, pitch: -12 }, tictac: { eye: 60, pitch: -12 } };
E:4940  let ALTA = null; S.chase = { yaw: 0, pitch: -16, dist: 7.5 }; S.altaCam = 'chase';
E:4942  let UAP = null; const isUap = m => m === 'saucer' || m === 'tictac'; S.uchase = { yaw: 0, pitch: -12, dist: 28 }; S.uapCam = 'chase'; S.fast = false;
```

A mode is a key of `HEIGHT`; `S.mode` holds the current one. The kits are made the first time they are asked for.

**`setHeight(m)`** (E:5371-5382) changes mode: refuses an unknown name, hides the craft being left, makes, places
and shows the one being entered, starts the simulation.

```
E:5372  if (!HEIGHT[m] || m === S.mode) return; if (m === 'alta' && !SE.STORM[S.storm].fly) { alarm(NOFLY); return false; }
E:5374  if (was === 'alta' && ALTA) ALTA.show(false);
E:5378  if (m === 'alta') { if (!ALTA) ALTA = AltaKit(engine, K); ALTA.ground(''); ALTA.place(S.x, S.z, S.yaw, floorTop(S.x, S.z)); ALTA.show(true); ALTA.takeoff(28); engine.playing = true; S.fov = 65; }
```

**`placeCamera()`** (E:5260-5277) has one branch per craft, which takes `S.x, S.z` from the craft, sets the camera
(a chase view on a boom, or the craft's own camera), the near plane and the shadow distance, and returns:

```
E:5267  if (m === 'alta' && ALTA) { const a = ALTA.state; S.x = a.x; S.z = a.z; let cx, cy, cz;
E:5269  else { const yw = a.yaw + S.chase.yaw, y = Rd(yw), pp = Rd(S.chase.pitch), fx = Math.sin(y) * Math.cos(pp), fy = Math.sin(pp), fz = -Math.cos(y) * Math.cos(pp), d = S.chase.dist; S.yaw = (yw + 3600) % 360; S.pitch = S.chase.pitch; cx = a.x - fx * d; cy = Math.max(0.35, a.y + 0.5 - fy * d); cz = a.z - fz * d; }
E:5270  t.setPosition(cx, cy, cz); Q.fromEuler(t.rotation, Rd(S.pitch), -Rd(S.yaw), 0); t.dirty(); cam.fov = S.fov; cam.near = S.altaCam === 'payload' ? clamp(a.y * 0.03, 0.32, 3) : 0.3;
```

The chase camera is rigid: it sits `dist` behind the craft's yaw plus the angle the person has dragged. Nothing
keeps it out of buildings.

**The input code** is in the update handler (E:5279-5308). Keys count only while the canvas has the focus; the
on-screen pad's buttons arrive through `S.keys`; a game pad's sticks are added:

```
E:5289  else if (S.mode === 'alta' && ALTA) { const A = ALTA.input, foc = document.activeElement === cv;
E:5290  A.fwd = (k.fwd ? 1 : 0) - (k.back ? 1 : 0) + (foc ? I.axis('KeyS', 'KeyW') : 0); A.right = foc ? I.axis('KeyA', 'KeyD') : 0; A.yaw = (k.right ? 1 : 0) - (k.left ? 1 : 0) + (foc ? I.axis('ArrowLeft', 'ArrowRight') + I.axis('KeyQ', 'KeyE') : 0); A.up = (k.up ? 1 : 0) - (k.down ? 1 : 0) + (foc ? I.axis('ArrowDown', 'ArrowUp') + I.axis('KeyF', 'KeyR') : 0);
E:5291  if (pad) { A.fwd -= pad.ly; A.right += pad.lx; A.yaw += pad.rx; A.up -= pad.ry; } A.fwd = clamp(A.fwd, -1, 1); A.right = clamp(A.right, -1, 1); A.yaw = clamp(A.yaw, -1, 1); A.up = clamp(A.up, -1, 1);
E:5292  const px = ALTA.state.x, pz = ALTA.state.z; if (engine.playing && ALTA.update(dt, { floor: (x, z) => Math.max(floorTop(x, z), SK.now ? SK.now.surge : -9), block: blockAt, wind: [(scene.env.windDir ? scene.env.windDir[0] : 0.8) * scene.env.wind, (scene.env.windDir ? scene.env.windDir[1] : 0.6) * scene.env.wind] })) { S.x = ALTA.state.x; S.z = ALTA.state.z; after(Math.hypot(S.x - px, S.z - pz) < 0.02); need(); } }
```

After the step the world copies the craft's place into `S.x, S.z` and calls `after()`, which is what loads streets,
builds cells and recentres as the craft travels. Keys are digital (`I.axis` is -1, 0 or 1): a car needs its own
smoothing of steering and throttle. The pad gives sticks only:

```
E:2418  pad() { const g = navigator.getGamepads ? [...navigator.getGamepads()].find(Boolean) : null; if (!g) return null; const dz = v => (Math.abs(v) < 0.14 ? 0 : v); return { lx: dz(g.axes[0] || 0), ly: dz(g.axes[1] || 0), rx: dz(g.axes[2] || 0), ry: dz(g.axes[3] || 0), buttons: g.buttons.map(b => b.pressed) }; }
```

`buttons` are true or false: the triggers' travel (`b.value`), the natural throttle and brake, is not passed on.

**One-press keys** come through the input's `key` event (E:5343-5344). The craft branches end with `return`; what
follows them is the height ladder:

```
E:5344  if (code === 'KeyQ' || code === 'PageUp') setHeight(S.mode === 'street' || S.mode === 'walk' ? 'drone' : S.mode === 'drone' ? 'bird' : 'metro'); else if (code === 'KeyE' || code === 'PageDown') setHeight(S.mode === 'metro' ? 'bird' : S.mode === 'bird' ? 'drone' : 'street'); });
```

A car branch must return before this line, or Q and E throw the driver up to drone height. `X` (the roof views) and
the brackets are taken before any craft branch (E:5343). The browser's own action is stopped only for these keys:

```
E:2409  on(el, 'keydown', e => { if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return; if (!this.keys.has(e.code)) { this.keys.add(e.code); this.emit('key', e.code, e); } if (/^(Arrow|Space|Key[WASDQE]|Page)/.test(e.code)) e.preventDefault(); wake(); });
```

**The HUD** is one element, `hudEl` (class `se-hud`, E:4920), filled by `drawHud()` (E:5147-5159) on every `frame`
event but at most every 160 ms. The UAP branch comes first and returns; then:

```
E:5153  const on = S.mode === 'alta' && !!ALTA; if (hudEl.hidden !== !on) hudEl.hidden = !on; if (!on) return; const now = performance.now(); if (now - hudT < 160) return; hudT = now;
```

A car's branch must come before this line, which hides the HUD in every mode but the Alta's. Six updates a second is
too slow for a rev counter: the car's branch needs its own, shorter interval. The classes are in `engine-style.css`
(`.se-hud`, `.se-hud-row`, `.se-hud-keys`, `.se-hud-warn`; the key line is hidden on narrow screens).

**Click to go** (E:5337): a click on a building selects it in every mode; a click on the ground sends the craft
there, or, with no craft, glides the camera there:

```
E:5337  I.on('click', (p, e) => { if (I.captured || e.button !== 0) return; const h = pickAt(p); if (!h) return; if (h.b) { S.cur = h.b.id; highlight(); if (env.onPick) env.onPick(h.b); return; } if (h.ground && isUap(S.mode) && UAP) { UAP.goTo(h.ground[0], h.ground[2]); engine.playing = true; need(); } else if (h.ground && S.mode === 'alta' && ALTA) { ALTA.goTo(h.ground[0], h.ground[2]); engine.playing = true; need(); } else if (h.ground && S.mode !== 'orbit') goTo(h.ground[0], h.ground[2]); });
```

In a car mode the last branch would start a glide of `S.x, S.z` that fights the car: the car needs its own branch
(nothing, or "put the car on the nearest road there").

**The public object** (E:5420-5458) carries a sub-object per craft and the pad's hook:

```
E:5451  alta: { get craft() { return ALTA; }, spec: () => (ALTA ? ALTA.SPEC : null), takeoff() { if (ALTA) { ALTA.takeoff(28); engine.playing = true; need(); } }, land() { if (ALTA) { ALTA.land(); need(); } }, home() { if (ALTA) { ALTA.rtl(); need(); } }, camera(c) { S.altaCam = c || (S.altaCam === 'payload' ? 'chase' : 'payload'); need(); return S.altaCam; } },
E:5434  hold(k, on) { S.keys[k] = !!on; if (on) engine.wake(); need(); },
```

The whole of it: `open, face, walk, turn, setHeight, state, setCurrent, refresh, labels, hold, start, stop, project,
graphics, setGraphics, storm, stormKit, warn, NOFLY, uap, dropCrate, engine, canvas, kit, street, world, hvac, lens,
year, lensRefresh, lensLayer, lensOf, lensMap, wideKit, alta, editor, editing, sound, debug`.

**When the origin moves**, the craft are carried over by hand:

```
E:5391  S.lat0 = la; S.lon0 = lo; S.ky = mLat(la); S.kx = mLon(la); [S.x, S.z] = toL(keepLL[0], keepLL[1]); if (UAP && isUap(S.mode) && !UAP.state.warp) { UAP.state.x = S.x; UAP.state.z = S.z; UAP.state.target = null; } if (ALTA) { ALTA.state.x = S.x; ALTA.state.z = S.z; ALTA.state.home = toL(homeLL[0], homeLL[1]); if (tgtLL) ALTA.state.target = toL(tgtLL[0], tgtLL[1]); } S.on = null; S.roadsAt = null; S.roads = []; S.graph = []; setRoads([]); S.treeN = 0;
```

### 6.3 Every place a new mode name has to be added

`engine.js`:

| # | line | what is there | for a `car` mode |
|---|---|---|---|
| 1 | E:4912 | the canvas's spoken label, which lists the keys | words |
| 2 | E:4930 | `HEIGHT` | **required**: an entry (its `eye` and `pitch` are read by `open`, E:5428, and `faceAt`, E:5368) |
| 3 | E:4940, E:4942 | the craft's handle, its chase camera and camera choice | `let CAR = null`, a chase state, `S.carCam` |
| 4 | E:4948, E:4985 | `wideReach()` and `reach()`: how far the wider city and the detailed cells are built, per mode | a factor; at speed the cells ahead matter more than those behind |
| 5 | E:5147-5159 | `drawHud` | a branch before E:5153 |
| 6 | E:5237, E:5372 | weather that grounds the Alta X | only if the car is to refuse deep water |
| 7 | E:5260-5277 | `placeCamera` | a branch that returns |
| 8 | E:5278 | `speedOf` (the free camera's speeds) | nothing |
| 9 | E:5282 | the pad moves the free camera unless a craft is out | add the mode to the test |
| 10 | E:5284-5296 | the update branches: UAP, Alta, orbit, walk, and a last `else` that walks the camera along the street | a branch before `orbit`; without one the last `else` runs |
| 11 | E:5305 | `onFoot`, the traffic's `reach` per mode, the call to `ST.update` | hand the car to the traffic here; call `engine.wake()` while it moves (section 0) |
| 12 | E:5325, E:5329-5332 | `lookNow` and the drag: which angles a drag turns | the chase camera's |
| 13 | E:5337 | click on the ground | a branch (6.2) |
| 14 | E:5338 | double click on a building | a branch, or it calls `env.onFront` |
| 15 | E:5342 | the wheel: chase distance, or field of view | chase distance |
| 16 | E:5343-5344 | one-press keys | a branch that returns before the height ladder |
| 17 | E:5363-5370 | `faceAt`: turn to a building | a branch, or the camera angles are set under the car |
| 18 | E:5371-5382 | `setHeight` | leave: hide; enter: make, place on the nearest road, show, `engine.playing = true` |
| 19 | E:5385 | `state()`: the `uap:` and `alta:` objects the dashboard prints | a `car:` object (speed, gear, revs, road) |
| 20 | E:5386 | `graphics()`: `altaCam`, `uapCam` | `carCam` |
| 21 | E:5389-5393 | `recenter` | carry the car's position and anything else held in local metres |
| 22 | E:5421-5430 | `open`: accepts `o.mode`; sends a craft that is out to a near target, else places it | the same for the car |
| 23 | E:5442 | `setGraphics`: `o.altaCam` | `o.carCam` |
| 24 | E:5448, E:5451 | the public `uap` and `alta` objects | a `car` object |
| 25 | E:2409 | keys whose browser action is stopped | add any others the car uses that scroll or type |
| 26 | E:2418 | `pad()` | pass `b.value` for the triggers |

`scout.js` (the dashboard):

| # | line | what is there |
|---|---|---|
| 27 | S:2356 | the sentence for each mode in the status line; an unknown mode reads "Circling" |
| 28 | S:2357 | the line of keys for each mode |
| 29 | S:2360 | the pad's climb and descend buttons (`.sc-enalt`) shown only for `alta`, `saucer`, `tictac` |
| 30 | S:2411 | `isU` and the other per-mode flags of the bar |
| 31 | S:2424 | the Move buttons: `street`, `walk`, `drone`, `bird`, `metro`, `orbit`, each `[key, label, tip]` |
| 32 | S:2425 | the Aircraft buttons: `alta`, `saucer`, `tictac`; a `data-h="car"` button goes in one of the two |
| 33 | S:2426-2427 | the buttons that belong to one craft (`data-al`, `data-ua`), and S:2456, S:2458 their handlers |
| 34 | S:2454 | every `[data-h]` button calls `en.setHeight` (no change needed) |
| 35 | S:2470 | a pad button pressed from the keyboard: held 600 ms for `['alta', 'saucer', 'tictac']`, else a step of the walk |
| 36 | S:1440 | the pad's markup: `data-k` is `fwd`, `back`, `left`, `right`, `up`, `down` |
| 37 | S:2284, S:2400 | the two paragraphs that say what in the view is generated and what the craft are |
| 38 | S:2205, S:2355 | the words for a road kind in the status line |
| 39 | S:2367-2379 | the warp's list of cities and its "Louisiana only" test |

---

## 7. Aircraft, ships and moving props

### 7.1 What is already there

Nothing models an airliner, a helicopter, a ship, a boat or a train, parked or moving. What moves today:

| thing | how |
|---|---|
| traffic cars | instanced, refilled every frame (4.4) |
| the Alta X, the flying saucer, the Tic Tac | entity trees with their own flight models (6.1); one of each, flown by the person |
| crates and balls | rigid bodies (`dropCrate`, E:5398-5400) |
| rain, spray, debris, lightning | the storm kit's own draws (E:4557-4779) |
| trees | sway in the vertex shader |
| flood water | one plane with the `water` material, raised by the storm scale (E:4675) |
| ready-made scripts | `Rotator`, `Bobber`, `Orbiter`, `Lifetime` components (E:743-750); `Timeline` and `Animator` for keyed motion (E:2846, E:2860) |
| glTF | `GLTF.load` reads models with embedded buffers and their keyed animation (E:2870-2878); the page ships none |

There is no water surface other than the flood: a bay or a harbour is the satellite photograph on the flat ground.
There are no runways, aprons or piers as objects: they too are only in the photograph, and in the FEMA footprints
where there are buildings.

### 7.2 The cheapest way to put moving objects far from the camera

Do what the traffic does: **one `InstanceBuffer` and one `InstancedRenderer` per kind of aircraft, emptied and
refilled each frame.**

```
E:471  add(x, y, z, yaw, sx, sy, sz, r, g, b, a) {
E:476  addMatrix(m, col) { this._grow(this.count + 1); const d = this.data, o = this.count * 16; d[o] = m[0]; d[o + 1] = m[4]; d[o + 2] = m[8]; d[o + 3] = m[12]; d[o + 4] = m[1]; d[o + 5] = m[5]; d[o + 6] = m[9]; d[o + 7] = m[13]; d[o + 8] = m[2]; d[o + 9] = m[6]; d[o + 10] = m[10]; d[o + 11] = m[14];
E:1669  if (r.maxDistance && near > r.maxDistance) { st.culled++; continue; }
E:1280  float dy = d.y * u_fog.y, f = abs(dy) > 1e-3 ? (1.0 - exp(-dy)) / dy : 1.0, od = u_fog.x * exp(-max(u_camPos.y, 0.0) * u_fog.y) * dist * f;
```

- **Pose.** `add` gives a heading only. An aircraft that banks and pitches needs `addMatrix(m, col)` with a
  column-major 4 by 4 matrix (`M4.compose(out, position, quaternion, scale)` makes one, as at E:3678).
- **Distance.** The camera's far plane is 120 km (`cam.far = 120000`, E:4918). `maxDistance` of 0, the default, means
  never culled by distance (E:1669). Set `castShadow = false`: shadows reach a few hundred metres.
- **Haze.** Fog thins with height (`u_fog` is `[density, 1 / fogHeight, …]`, E:1737; 0.00035 and 90 m by default).
  Worked from the formula above for a camera on the ground: an aircraft 900 m up and 8 km away keeps about 76% of
  its contrast on a clear day; one 300 m up and 5 km away about 61%. On the `haze` weather (density 0.0045, E:5220)
  the first keeps 3%: it is not seen.
- **Size on screen.** A 38 m airliner 8 km away is about a quarter of a degree, three or four pixels at a 65° field
  of view on a 900-pixel-high view; at 3 km about ten. The mesh can be a few hundred triangles; past a few
  kilometres only its lights are seen.
- **Lights.** Unlit emissive materials, as the Alta's lamps are (`model: 'unlit'`, `emissiveIntensity: 30`, E:4493),
  bloom at night at no cost. A flashing beacon is a second small instanced mesh whose material's
  `emissiveIntensity` is switched, as the signals' lamps are (E:3692). Real `Light` components are for the ground
  near the camera, not for the sky.
- **Levels.** `r.lods = [{ mesh, distance, material }]` picks a mesh for the whole set by the set's nearest point
  (E:733, E:1671); or sort instances into a near and a far buffer on the processor, as the cars are.
- **Culling.** One sphere round the whole set (4.4): a set that spans the sky is always drawn. For a dozen aircraft
  that is nothing.
- **Motion vectors.** None for instances (4.4). A far aircraft moves a fraction of a pixel a frame: no visible smear.
- **Where they are.** Keep each aircraft as latitude, longitude, height and heading on its path, and turn that into
  local metres every frame with `S.toL` (E:4932): then the moving origin (section 0) needs no handling. A 3° approach
  is 52 m of height per kilometre from the threshold.
- **The clock.** `engine.time.now` stands still while the view rests (E:2475). Drive the schedule from the wall
  clock so an aircraft is where it should be when the view wakes. To animate, something must ask for frames every
  frame (`need()`), which keeps the engine drawing; gate it as the traffic is gated
  (`engine.playing && engine.awake && engine.live`, E:5305) so the view can still come to rest.
- **The hook.** Next to the traffic in the update handler (E:5305-5307).
- **Sound.** `AudioSource` has three kinds, `hum`, `wind` and `rain`, placed in the world (E:2957-2970); a jet would
  be a fourth.

Cost: one draw call per kind and level, a few thousand triangles in all, sixteen floats per aircraft uploaded per
frame.

### 7.3 Things that stand still: ships and aircraft at a naval base

- **Meshes.** `MeshBuilder` (`tri`, `quad`, `box`, E:492-521) and `Prim` (`box`, `sphere`, `cylinder`, `capsule`,
  `plane`, `merge`, `transform`, `paint`, E:566-605) are public on `SE`. Two useful builders are private to their
  kits and would have to be lifted out: the lathe in `UapKit` (`lathe`, E:4809-4815: a profile turned about an axis,
  with creases) and the tube in `AltaKit` (`tube`, E:4470-4474). A hull or a fuselage is a lofted skin like
  `CarKit.build`'s.
- **Drawing.** One of a kind: an entity with `MeshRenderer`s. Rows of the same (aircraft on an apron, ships of one
  class): an `InstancedRenderer` whose buffer is filled once.
- **Placing.** By latitude and longitude through `S.toL`; the result is only good until the origin moves, so props
  are placed again when `S.gen` changes (WideKit does this: `W.reset()`, E:4222, called from `recenter`).
- **Solid.** `phys.addPrism(ring, y0, y1, userData)` makes a hull or a hangar solid to bodies, the character, rays,
  and the drone's `floorTop` and `blockAt` (so an Alta X can land on a flight deck). **Give it a `userData` object**:
  the pointer's pick reads `h.prism.userData.id` with no test for null, and so does the label test:

```
E:5323  const pickAt = p => { const ray = cam.ray(p.x, p.y), h = phys.raycast(ray.origin, ray.dir, 4000); if (!h) return null; if (h.prism) { const b = env.byId(h.prism.userData.id); if (b) return { b, point: h.point }; } if (h.ground) return { ground: h.point }; return { other: h }; };
```

  `addPrism` stores `userData || null` (E:2632), so a prism added without one throws on the first pointer move over
  it. `{ id: null }` is enough: `env.byId` finds nothing and the hit is passed on as `other`. `recenter` clears every
  prism (`phys.clearPrisms()`, E:5390): props must add theirs again.
- **Water.** A ship's waterline is y = 0 on the photograph. The photograph already shows whatever was at the pier
  the day it was taken; a ship drawn on top of a photographed ship will show both.
- **The data.** Which hulls, which aircraft and where is the dashboard's to supply, as it supplies buildings
  (`env.context(box)`, asked a tile at a time by WideKit, E:4161): the engine itself asks the network for nothing
  ("Nothing here reaches the network", E:15).

---

## 8. The constraints, in one place

Data
1. Only `name`, `kind`, `pts` reach the engine (E:5163). Lanes, one-way, speed, level and bridge are in Overpass's
   answer and thrown away at S:2159.
2. On the TIGER fallback the freeways are absent (layer 2 is never asked, S:712) and ramps arrive nameless as `major`.
3. Streets are loaded for 560 m and replaced whole every 230 m of travel, which rebuilds the traffic, the street
   furniture and every cell (E:5207, E:5171, E:4987). Overpass answers are not cached.

Surface
4. Width and paint are per kind, not per road (E:3530, E:3652). A ribbon has one height (E:3531). The world is flat.

Traffic
5. Two lanes each way on every `major`, both directions on every way, 30 and 20 mph, 14 m/s on any curve (E:3884,
   E:3885, E:3964).
6. A ramp joining a freeway becomes a signalised crossing (E:3616). No merging, no lane changes.
7. Obstacles are found on one plane: an overpass and the road under it block each other (3.10, case 4).
8. At most one car per 30 m of way and 110 in all (E:4024, E:5170); the step is quadratic in cars: 400 cars on one
   freeway cost 11.6 ms a step in Node here.
9. The traffic stops 25 s after the last key or pointer event unless something calls `engine.wake()` (E:5305).
10. Other actors enter only as motionless squares (E:3702): the user's car needs a way in with its speed, and its
    own contact test (`TR.overlap`).

Car
11. Wheels are part of the body mesh and turn only in the shader (E:3842, E:3739); brake lamps read the instance's
    alpha (E:3735), which a `MeshRenderer` does not have.
12. The solver has boxes, spheres, capsules and contact, a fixed 1/60 s step, corners-only contact with buildings and
    no joints (5.1, 5.2). The car is better as a kit with its own model.
13. Buildings are solid only in the detailed cells, 200 to 400 m round the camera (E:4985); kerbs, poles and trees
    are not solid at all.
14. A mode has 26 places in engine.js and 13 in scout.js (6.3). The three that fail silently if missed: `HEIGHT`
    (the mode is refused), the HUD line E:5153 (the HUD is hidden), the key ladder E:5344 (Q and E change mode).
15. The origin moves every 12 km (E:5207): everything held in local metres must be carried in `recenter`.

Sky and harbour
16. Nothing exists; instancing with `addMatrix` is enough for airliners (7.2). Instances have no motion vectors and
    are culled as a set.
17. A prism without `userData` breaks the pointer's pick (E:5323). Prisms are cleared on every recentre.

---

## 9. How the quotes were checked

A script read this file and, for every line inside a code block, took the file letter and line number at its start,
split the rest at each ` […] `, and required every piece to occur, in order, in that line of `SP/build/engine.js` or
`SP/build/scout.js`. A quote may begin or end in mid-line. The count and the result are in the final report. Line
numbers given in prose (for example "E:3646") were read off the same listing but are not machine-checked.

