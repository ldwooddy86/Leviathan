# car job notes (engine job "car": the drivable black 2027 BMW M3, mode `m3`)

Files (all in CA/engine/car/):
- car_body.js   pure geometry (M3Body()): body skin by material group, wheels, cabin. No engine names used.
- car_engine.js the kit (SE.M3Kit): meshes, materials, entities, lamps, smoke, sound, physics wrapper.
- car_world.js  the world's side (functions put inside the world builder's closure by the port).
- port_car.py   <in.js> <out.js>: anchored replacements; concatenates ../car_physics.js + car_body.js + car_engine.js.
- tests/        preview.js (node rasteriser of the body), drive tests (playwright), shots/ pictures.

Plan / state
1. [ ] car_body.js + tests/preview.js (look at PNGs)
2. [ ] car_engine.js
3. [ ] car_world.js + port_car.py
4. [ ] testbed runs: LA, Coronado, dynamics by hand clock, wall, 251 mph, night, rain
5. [ ] report (functions touched, what the bar needs)

Decisions
- Mode name `m3`. Kit `SE.M3Kit`. Physics untouched (CA/engine/car_physics.js), autoReverse on by override.
- Model: nose at -z, right +x (engine craft convention: Q.fromEuler(pitch, -yaw, roll)).
- No shader edits: plain Materials (paint lit rough 0.16; glass model 'glass'; lamps lit + emissive).
- S.fast set by the car above 60 m/s (off below 45): near cells and building fetches stop, far ground and roads stay.
- Roads at speed: loadRoads() called with S.x/S.z moved ahead for the call (no anchor inside loadRoads).

## 11-23 resumed
- port_car.py applies cleanly to la_engine.js (all anchors once); out/engine_car.js parses; out/testbed_car.html built.
- car enters at 200 N Spring St on N Main St (state().car, S.hero, HUD all there).
- governor (251 never exceeded) checked in node: tests/governor.js -> governor_output.txt.
- traffic job's interface read from ../traffic/traffic_kit.js: S.trafficHit returns the vehicle struck ({x,z,hx,hz,hl,hw,..});
  car_world turns that into a push. Roads there carry r.ow, r.ln, r.dk (deck heights per point), kinds freeway/ramp/cable.
- tests/drive.js <page> "<address>" <tag> steps...  (shots dyn wall night rain top cams leave)
- next: look at shots, dyn + wall + top runs, Coronado, report.

## 11-23/24 progress
- Machine is shared and loaded (frames 2-12 s): runs take 10-25 min. NEVER `pkill chrom` (kills other jobs' browsers); kill only `tests/drive.js`.
- Found: at 200 N Spring St the TIGER centreline of N Main St passes under the City Hall bridge, which the footprints give as a
  building, so the car is stopped by it 4 m on (real artefact, not a bug). carLane now moves the car off a wall in its lane;
  the dynamics test puts the car on a clear stretch first.
- Lamp posts / trunks standing on a carriageway are not solid (carNear `clear`).
- Camera: chase/orbit come in front of a building between them and the car.
- HUD: one row + keys + a short what-it-is line; long note as the row's title (tooltip).
- Results so far (run_la_2.log): slide with TC off (yaw rate 99 deg/s, smoke), recover, reverse 49 mph, building stops it
  (0 points inside). Pending: launch/brake numbers on a clear stretch, shots, cams, night, rain, top speed (Central Valley), Coronado.

## What the bar (CA/scout/scout.js) needs  -> goes in the report
- button data-h="m3" (label "BMW M3", in the vehicles group); tooltip text = en.car.note; keys help = en.car.keys.
- status sentence for mode m3 from en.state().car: mph, gear (-1 = R), rpm, tc ('on'|'working'|'off'), onRoad, grip, driving.
- pad: fwd = throttle, back = brake (held at rest: reverse), left/right = steer, down = handbrake (show the "down" button
  for m3 as "Handbrake"; hide "up"). Pad buttons must be held (as for alta/saucer/tictac: add 'm3' to that list).
- car buttons (like data-al): Camera -> en.car.camera() (cycles chase, bonnet, cockpit, orbit; returns name),
  Traction control -> en.car.tc() (toggles; returns on), Reverse -> en.car.reverse(), Back onto the road -> en.car.reset().
- graphics().carCam for the camera's name; setGraphics({carCam}).
- "what is generated" paragraph: the car is a likeness built from BMW's published dimensions; 251 mph is the dashboard's figure.

## 11-24 results (all logs in out/, pictures in shots/)
- Container restarted once; downtown LA crashes the test browser on any engine (lead knows): tests moved to Coronado + Fresno County.
- run_la_3.log (LA, clear stretch on Ducommun St): 0-60 mph 2.3 s, 116 mph after 5.3 s, stop in 116 m; slide TC off 112 deg/s; reverse; wall.
- run_la_2.log: building stops the car (0 points inside), throttle held: slides along it.
- run_cor.log (Coronado 10th St): shots, cams, night (lamps true), marks 139 instances gl 0, leave/return (hero on, driving false).
- run_top3.log (W Shaw Ave west of Kerman, Fresno County): 250.90 mph at 70 s, 7.4 km on the road, no hits, roads reloaded
  ahead 6 times, far tiles ~115, then the road ended; 13.3 km in all, no page errors.
- governor: level 250.994 mph, never above 251 (tests/governor_output.txt).
- stack terrain -> weather -> traffic -> car -> sky applies and parses (out/stack/4.js, 5.js); NOT run as a stack by me.
- pending at time of writing: run_cor2.log (rain, origin move under a moving car, pictures of the final build).
- run_cor2.log: rain (storm step 3: grip 0.81, 0-60 3.0 s vs 2.3 dry, stop from 60 in 54 m vs 38), origin moved under the car at
  47 mph with 0.6 mm step error, no speed jump. run_keys.log: en.hold pad, real W/S keys, C/T/R, Q/E do not change mode, sound on without error.
- DONE. Report handed back 11-24. Final sources: car_body.js, car_engine.js, car_world.js, port_car.py; out/engine_car.js = la_engine + car.
