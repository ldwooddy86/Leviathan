# integration pass notes (resume here)

Build: bash CA/engine/integ/assemble.sh CA/engine/integ/out/<name>.html   (own W = integ/out, D = integ/scout)
Tests: CA/engine/integ/tests/ (one browser at a time), pictures in CA/engine/integ/shots/.

## Plan (order of the brief)
1. bridges  2. M3 with everything  3. weather on terrain  4. aircraft/ships/bridges heights  5. cross-checks  6. cost

## Log
- 24 Nov 02:00 set up integ/, built out/ca0.html from the untouched stack (builds in 4 s).
- Item 1 design: S.deckAt(x,z,{info}) gains tx,tz,lat. RoadPrep.prep(list,{sky}) takes sky deck heights as fixed
  points (dk = deck - ground), r.sky flags; kit draws no structure on sky pieces and places cars by S.deckAt;
  car rides S.deckAt when at deck height, deck edges are walls; car also sees the kit's freeways (S.traffic.roads).
- 02:25 Item 1 code in (edit scripts integ/edits/e1_core.py, e2_kit.py, e3_car.py: already applied to the sources, do not rerun;
  originals of every source in integ/edits/*.orig.*). Changed: traffic_core.js (P.prep(list,{sky}), P.decks fixed points + grade
  cap, P.level, pieces carry sk), traffic_kit.js (skyY, yOn, PREP, TF.regrade, no structure on sky pieces, deckPitch, carPut),
  port_traffic.py (buildRoads head calls tf().regrade()), car_world.js (freeways from S.traffic.roads, own decks by drawn line,
  carDeck, bridge rails as walls), sky_engine.js (deckAt info tx,tz,lat,L; deckAt.live), port_sky.py (air toggle rebuilds roads).
  finish_engine.py: S.roadCost timers in buildRoads.
- First Coronado run (out/t_bridge_cor.log): decks adopted (4 roads, 358 points, error 0, top 68.1 m asl); shots/cor_from_air.png
  shows one structure. The test pilot rear-ended traffic and stuck (pilot now keeps a gap). Rerun: out/t_bridge_cor2.log.
- 02:25 Item 3 code in (integ/edits/e4_weather.py applied): fog base uniform u_fogB + fogPath (bounded below the base), cloud base
  u_cl.w, marine layer = slab to 450 m asl, tule = slab to lowest ground within 12 km + 110 m, grey light only under the layer,
  far ground wet: -1 (snow, no wetness), snow line coarse noise far off. NOT yet looked at in a browser.
- Tests: integ/tests/lib.js (start, step, settle, shot), pilot.js (in-page driver PILOT.run), t_bridge.js cor|gg.
- 03:00 Coronado drive (out/t_bridge_cor4.log on out/ca4.html): the M3 crossed from Coronado to I-5 on the deck (car 0.02 to 0.04 m
  over S.deckAt all the way, top 68.2 m asl), 178 traffic vehicles on the deck at its height, pictures shots/cor_chase.png,
  cor_side_car.png, cor_from_air.png read right. Found and fixed on the way:
  * S.trafficHit struck a car PARKED UNDER the bridge (hero's level was not worked out from h.y): kit now uses h.y - ground.
  * the structure ran on 317 m past where the carriageways part for the I-5 ramps (cars through the rail): sky deck has cutBT: 317
    on terrain (deck.loc.end); the kit's viaduct carries on from the deck's own height (P.level takes a sky road's free runs only).
  * sky kit's own centre and edge lines doubled the kit's lane paint: left out when S.traffic exists.
  * car: rail is no wall where a non-deck road leaves through it; car is set down clear of traffic (carLane backs up 7 m at a time).
  * weather kit publishes K.grip(y), K.snowAt(y); car uses SK.grip (was: wet 0.48 in any rain because now.rain is mm/h here).
  Left from that run: a 1.39 m step at the sky deck's cut end (fixed in P.level, ca5, to be confirmed), 2 hit-steps on the ramp
  (test pilot did not see a car round the bend: pilot now looks along the bending line).
- Running: t_bridge.js gg on out/ca5.html -> out/t_bridge_gg5.log. Then: t_drive.js sf|mtn|sd|wx|speed, t_roadcost.js, t_air.js.
- Written, not yet run: tests/t_drive.js, t_roadcost.js, t_air.js.
- 03:20 lead: dense port (frame pacing) is now last in the stack; integ/assemble.sh copied again from build/assemble_ca.sh (W, D changed); out/ca7.html = full stack with dense. Use ca7+ for tests.
- 03:45 Golden Gate drive passes on the deck (out/t_bridge_gg6.log: car 0.01-0.06 m over the deck, 79 m asl, 268 vehicles on the deck;
  shots/gg_chase.png, gg_side_car.png, gg_from_air.png read right). Found and fixed there:
  * deck heights were 34 m stale (ground under the strait firmed up after the roads were graded, 1.5 km from the camera): the kit now
    watches the ground under its roads (watchGround, probes) and regrades; the drawn deck on a sky piece uses S.deckAt directly.
  * the south tower's FOOTPRINT was built as a 227 m building across the deck: terrain port leaves out footprints that stand through a deck.
  * the deck ends were bent 10 m down to the terrain in 40 m: with the traffic kit present the end keeps its height and the kit's approach
    comes away at a road's grade (sky deckY `bend`).
  * F.locateAll: the user's car is a ghost in every overlapping piece (ramp merges).
- Street build spread over frames (integ/edits/e5_spread.py -> build/finish_engine.py; StreetKit X.pump, world roadPump/roadSteps):
  SF drive: whole build 489 ms mean / 758 worst, longest single stop now 87-178 ms (the at-once part: network, parked, signals).
- Drive tests: sf Filbert passes (pitch -18.4 deg, wheels 0.03-0.16 m over ground, 86.8 -> 20.8 m asl, no jump). California St: test bug, rerun
  with `node t_drive.js <page> sf cal`. sd (I-5, Census map): traffic was put down ON the car by F.fill and the lane sources, and a struck car
  was re-held for ever while touched: both fixed (nearActor; halt only once). Rerun: out/t_drive_sd2.log (ca11).
- OPEN: a first build at a new place took 4.1 s on the Census map in San Diego (out/t_drive_sd.log): find which part (roadCost.worstAt).
- 04:05 San Diego I-5 on the Census map (what a user gets when OpenStreetMap does not answer; out/t_drive_sd*.log). Found and fixed in the traffic kit:
  * the Census map gives each freeway WHOLE (I-5 as one 116 km line, again under each alias name): the kit built and ran 100 km of
    freeway, and doubled lines were cut at every point (60,000 pieces; 4 s builds, 11 s updates, cars inside cars). Now clipTo() cuts roads
    to the box asked for and keeps one of each line; route numbers are preferred to names; streets are cut to their tile too.
  * RoadPrep.pairDirs judged a carriageway's direction from its middle point alone (one of I-5's two stayed two-way): five places vote.
  * RoadPrep.crossLift: on the Census map (no bridges) a surface street that crosses a freeway line is taken one level over it.
  After: 48 s on I-5 at 64 mph with the traffic, on the road all the way, no stop over 280 ms. (My test braked with the brake held, which
  backs the car up: the 'standing' and 'collision' parts are to be rerun: t_drive.js sd on ca14+.)
- 04:45 Speed runs on I-5 south of Kettleman City (Census map), out/t_drive_speed*.log. Found and fixed:
  * street crossing I-5 on the level (25th Ave): crossLift now finds crossings at the Census lines' shared points; verified (dbg_fwy.js).
  * the same carriageway under another name form with other points ("I 5" beside "I- 5"): noDoubles() drops what runs along a kept line.
  * the freeway's surface followed every bump of the ground under its centre line (pitch to 35 degrees, 68 mph at best): RoadPrep.grade
    gives freeways on the ground their own profile (over the ground at middle and edges, 5 per cent at most, smoothed); the kit draws a bank
    where it stands over the ground, keeps each piece's drawn heights (s.Y) and stands its vehicles on that line; the car rides the line.
  * a freeway answer that failed was taken as "no freeways here" for good: now asked again after 4 s (scout_roads.js marks list.failed).
  Running: t_drive.js speed on out/ca18.html -> out/t_drive_speed3.log.
- Tests still to run: t_drive.js sf cal | mtn | wx ; t_wx.js ; t_air.js ; t_cross.js ; t_cost.js ; t_bridge.js cor and gg once more on the
  final build; t_bridge.js cor tiger.
