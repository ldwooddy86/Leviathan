# Integration pass on the Scout Engine: handover (24 Nov, stopped early on the user's word)

Full working log, in order, with every finding: LOG.md (this folder). Edits were made by the scripts in edits/ (e1..e5: ALREADY
APPLIED to the sources, do not rerun) and by hand after; originals of every source as I found it are edits/*.orig.*.

## State now
- Every port applies in the stack and alone on la_engine.js; `bash CA/build/assemble_ca.sh CA/engine/integ/out/ca_final.html`
  builds and parses (60 scripts, 0 syntax errors). CA/build/ca_smoke.js on it at Coronado: all pass, no page errors
  (out/final_smoke.log, shots/final_smoke_coronado.png). No half-applied edit anywhere.
- My build script: integ/assemble.sh (the lead's, with W and D in integ/). Tests: integ/tests/ (lib.js, pilot.js = in-page driver).

## Fixed (and how it was checked)
1. BRIDGES (item 1): done for Coronado and the Golden Gate, with OpenStreetMap streets.
   - RoadPrep.prep(list, {sky}) takes S.deckAt heights as given points (r.sky, r.sk); roads leading on come away at a grade
     (cap pass); P.level keeps a bridge straight between abutments over falling ground; pieces carry sk.
   - kit: no slab, parapet or pier on a sky piece, vehicles placed by S.deckAt (yOn), TF.regrade() at the head of buildRoads,
     watchGround() regrades when the ground under its roads changes (deck heights were 34 m stale at the Golden Gate).
   - car: sees the kit's freeways (S.traffic.roads), rides S.deckAt when at deck height, rails are walls, set down clear of traffic.
   - sky: deckAt {info} gives tx, tz, lat, L; Coronado structure stops 317 m short where its carriageways part (cutBT); deck ends
     are not bent down to low ground when the traffic kit carries the approach; its own lane lines are left out when S.traffic exists.
   - terrain port: a footprint that stands through a deck (the Golden Gate tower was a 227 m building across the road) is left out.
   - S.trafficHit works out the car's level (it struck a car parked under the bridge).
   Proof: out/t_bridge_cor4.log (M3 Coronado to I-5, 0.02 to 0.04 m over the deck, 68.2 m asl, 178 vehicles on the deck),
   out/t_bridge_gg6.log (0.01 to 0.06 m, 79 m asl, 268 vehicles); pictures shots/cor_chase.png, cor_side_car.png,
   cor_from_air.png, gg_chase.png, gg_side_car.png, gg_from_air.png (looked at: one structure, traffic on it, read right).
2. M3 WITH THE REST (item 2), part done.
   - San Francisco, Filbert St: passes (out/t_drive_sf.log: nose down 18.4 degrees, wheels 0.03 to 0.16 m over ground, no jump).
   - I-5 San Diego at 5 pm on the Census map: passes (out/t_drive_sd6.log: 48 s with the traffic, standing in a lane untouched,
     collision ends and loses speed). Fixes on the way: traffic was put down on top of the car (F.fill, sources: nearActor);
     a struck car was held for ever while touched; the car is a ghost in every overlapping piece (F.locateAll).
   - Census (TIGER) fallback was badly broken and is what a user gets when OpenStreetMap does not answer: each freeway came
     whole (116 km) and several times over (60,000 pieces, 4 s builds, 11 s updates). Now: clipTo() to the box asked,
     noDoubles(), route numbers preferred, pairDirs votes at five places, crossLift takes streets over freeways (no bridges in
     that map), failed freeway answers are asked again, parked cars and footprints kept out of at-grade freeway lanes.
   - Street build spread over frames (build/finish_engine.py: buildRoads, roadSteps, roadPump; StreetKit X.pump): longest single
     stop 87 to 178 ms in San Francisco against 489 mean / 758 worst for the whole build; en.world.roadCost has the figures.
   - RoadPrep.grade: freeways on the ground get their own profile (the car pitched 35 degrees on I-5's line over the Kettleman
     Hills and could not pass 68 mph); kit draws banks, keeps drawn heights (s.Y), vehicles and car ride that line.
   - Grip from the weather kit (K.grip, K.snowAt; the car's own formula gave 0.48 in any rain here).
3. WEATHER ON TERRAIN (item 3): CODE IN, NOT YET LOOKED AT IN A BROWSER beyond the smoke test (edits/e4_weather.py):
   fog base uniform u_fogB and fogPath (bounded below the base), cloud base u_cl.w, both from the ground under the camera;
   marine layer a slab to 450 m asl and tule fog a slab to lowest ground within 12 km + 110 m, grey light only under them;
   far ground and wider-city ground wet: -1 (take snow, not wetness); snow line with coarse noise far off.

## Found and NOT fixed
- Buildings and parked cars built BEFORE the freeways arrive stay in a freeway's lane until their cell is rebuilt.
- Tunnels: the car drives over the hill, the traffic goes under (hidden pieces); nothing draws a tunnel mouth on terrain.
- Bay Bridge lower deck: eastbound traffic takes it by heading (hx > 0.15); never run. Vincent Thomas never run.
- The at-once part of a street build (network, parked cars, signals, lamps) is still 20 to 180 ms; a first build at a new
  place is done whole (260 to 730 ms measured).
- Surface streets far from the build centre are laid on the ground as it was then; only the kit's roads are watched.
- With the landmark bridges switched off the Coronado crossing is the kit's flat 6.5 m viaduct (its ways are not named "bridge").
- The photograph on the sea shows each bridge's own image under it (reads as a pale line on the water).

## Where I stopped, and what to do next (in this order)
1. `node tests/t_drive.js out/ca_final.html speed` was running when stopped (out/t_drive_speed3.log: first 60 s on I-5 at
   60 mph behind traffic, road 3.8 km ahead, pitch 1.5 degrees): 100 / 150 / 251 mph and the change of origin are UNPROVEN on
   the graded freeway. The earlier runs (speed.log, speed2.log) are from before grade, crossLift and noDoubles.
2. Never run: `t_drive.js sf cal` (California St), `mtn` (SR-18), `wx` (stops in rain and on snow); tests/t_wx.js (snow line
   at Lone Pine, Mammoth, Truckee, Big Bear; ponding; marine layer from under and over; tule fog; fog base): LOOK AT ITS
   PICTURES, the weather shader edits have not been seen; tests/t_air.js (runways, aircraft, ships, bridge ends: item 4);
   tests/t_cross.js (warp chain, switches, night, idle, long flight: item 5); tests/t_cost.js (item 6: nothing measured yet
   but tests/t_roadcost.js, out/t_roadcost_sf.log).
3. Rerun `tests/t_bridge.js <page> cor` and `gg` on the final build (last run before the deck-end, grade and Census changes;
   two things to confirm: no step in height at the Coronado cut end (was 1.39 m, fixed in P.level) and at the Golden Gate's north
   end (was 1.07 m, fixed by not bending the deck)), then `cor tiger`.
4. Then the unfixed list above.
Tests take 3 to 15 minutes each on this machine; one browser at a time; step the clock by hand (lib.js T.step, pilot.js).
