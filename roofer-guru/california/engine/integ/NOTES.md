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
