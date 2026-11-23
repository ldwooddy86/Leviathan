# sky job notes (resume here)

Files:
- build_data.py  -> sky_data.js (airports, hourly flights, bridges, navy; from CA/dl and sky/dl OSM pulls)
- sky_engine.js  -> the kit SE.SkyKit (model + drawing)
- port_sky.py <in.js> <out.js>
- dl/ : OSM pulls (gg.json, bay.json, vt.json, ggroads.json, vtroads.json?, corroads.json?), imagery checks (carrier18.png)
- tests/ : node model checks and playwright shots

Facts fixed so far:
- Carrier in the Esri photograph: centre 32.713154, -117.189488, heading 119.1 true (bow SE), 333 m long, starboard to the quay.
- Golden Gate towers (OSM): S 37.81400,-122.47790  N 37.82550,-122.47925.
- Bay Bridge towers W2,W3,W5,W6, anchorage W4, piers W1,W7; east tower 37.81527,-122.35837.
- Vincent Thomas towers 33.74898,-118.26904 and 33.74972,-118.27386.
- Hooks planned (port): kit text before the "rooftop scout on the engine" banner; creation before engine.on('update'; update call
  after "placeCamera(); pump();"; state() air; graphics() air; setGraphics air; world API sky. Recentre is found by the kit itself (S.gen / S.lat0).

Status: see bottom (update as you go).
- [ ] build_data.py
- [ ] kit model (schedule, paths)  - [ ] meshes  - [ ] bridges  - [ ] navy  - [ ] port  - [ ] tests

## 23 Nov (resumed)
- DONE: build_data.py -> sky_data.js; sky_model.js (node-tested: info at LAX works); sky_shapes.js (sizes checked in node);
  sky_engine.js (kit: flights, helos, navy site, Coronado + Golden Gate, S.deckAt); port_sky.py (7 anchors) applies to la_engine.js -> out/engine_sky.js, parses; out/testbed.html built.
- NEXT: tests/model_check.js (glide path, spacing, rates); browser run (tests/run.js) at LAX, Coronado, Golden Gate; then sky_more.js (Bay Bridge, Vincent Thomas, boats, airport lights).
- 23 Nov later: tests/model_check.js ALL OK (66 checks; output in tests/model_check_output.txt). tests/run.js + plan_core.json running on out/testbed.html (core engine);
  LAX shots done: 50 flights drawn, nearest 24R arrival on path (y 120.7 m at 1.07 NM, want 120.7).
- sky_more.js written (Bay Bridge, Vincent Thomas, vessels, lights at night, airport lights); kit has X.hold(t) to stop its clock. out/engine_sky.js = all five files; out/testbed2.html.
- NEXT: run tests/plan_two.json on out/testbed2.html; look at shots; fix; report. Bar needs: a switch for setGraphics({air}), en.sky.info() read-out.
- 23 Nov 23:10: model_check ALL OK (66), kit_check (Node stand-in for the engine) ALL OK (35): outputs in tests/*_output.txt.
  port applies and parses on la_engine.js and on terrain/out, weather/out, traffic/out, car/out engines and weather/out/_ttwc.js (the four stacked).
  Browser: LAX shots good (shots/lax_final_close.png). A 9-shot run crashed the browser on the jump to San Pedro (machine load ~16); now running per region:
  plan_sd.json (run_sd.log), then plan_sf.json, plan_la2.json. OPEN QUESTION: runway/bridge lamps at night not seen in lax_runway_night_drone.png: check lax_lamps_close.
- 23 Nov 23:20: SD run done (shots/coronado_*.png): carrier at the quay, bridge on its piers with lamps at night, 3 helos, 6 vessels; deck 66.5 m at the channel in the browser too.
  Lamps now sized by the view's pixel (X.lampK). Wakes alpha 0.3. Running plan_sf.json then plan_la2.json on out/testbed4.html (logs tests/run_sf.log, run_la2.log).
- Port anchor for the update call is now "placeCamera(); pump();\n" (the car job puts carIdle(dt) in front of it).
- 23 Nov 23:30: LA2 run done: shots/lax_touchdown_bird.png (787 in the flare on 24R's centre line of the photograph), lax_lamps_close.png (approach and edge lights, aircraft lamps),
  vincent_thomas.png (green suspension bridge; jump LAX -> San Pedro recentred fine). Earlier browser crashes were the machine (load 25+), not the kit: tests/kit_places.js builds every site at 19 origins in Node.
  Fixed: site lamps piling up on rebuild (drop clears s.lamps); far static lamps dimmed with distance.
- RUNNING: plan_sf.json on out/testbed5.html (Golden Gate from Crissy Field, Bay Bridge from the Embarcadero) -> tests/run_sf.log.
- Final files: sky_data.js (from build_data.py), sky_model.js, sky_shapes.js, sky_engine.js, sky_more.js, port_sky.py; out/engine_sky.js = port over la_engine.js.
- Not done: CMV-22B, parked airliners at gates, runway surfaces (photograph shows them), Richmond-San Rafael Bridge, LPD/LSD classes, the YBI tunnel, flights at PSP and FAT (no schedule rows).
- 23 Nov 23:45: SF run done: shots/golden_gate_crissy.png, bay_bridge_embarcadero.png; browser checks: GG towers 1,281 m, mid deck 79 m; Bay west spans 705 m, decks 72.5 / 65 m. No page errors in any run.
- JOB COMPLETE as far as it goes; report handed back. To rebuild: python3 -I build_data.py ; python3 -I port_sky.py <in.js> <out.js> ; node tests/model_check.js ; node tests/kit_check.js ; node tests/kit_places.js ;
  python3 -I ../../build/testbed.py out/engine_sky.js out/testbed5.html ; node tests/run.js out/testbed5.html tests/plan_sd.json shots
