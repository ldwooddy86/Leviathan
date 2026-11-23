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
