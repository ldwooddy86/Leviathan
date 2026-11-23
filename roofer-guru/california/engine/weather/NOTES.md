# weather job notes (resume here)

Files: weather_engine.js (kit: SE.STORM, SE.WIND, SE.SKY, SE.StormKit), port_weather.py (anchored port over la_engine.js),
evidence_lookup.py (prints the anchors quoted in the notes: CW3E ranks of named storms, Storm Events narratives).
Build: python3 -I port_weather.py ../la_engine.js out/engine_weather.js ; node --check ; python3 -I ../../build/testbed.py out/engine_weather.js out/testbed.html
Tests: shots.js (screens of every step), checks.js (Alta rule, drying, no errors).

Decisions
- No flood plane at all (the surge plane and the WATER material are removed). Street flooding = ponding in the surface shader on flat faces.
- Snow: needs the elevation of world y=0 (S.elevAt / S.gy+S.y0 / env.elevation / en.elevation(m)); unknown = no snow.
- Alta X wind limit: 15 m/s gust (a choice; Freefly publishes none).

Status: see bottom of file.

## Status (resumed 23 Nov)
- DONE: kit + port written; port applies cleanly to la_engine.js (out/engine_weather.js parses, testbed builds).
- DONE: shots SF dry..ar5 (shots/sf_*.png), no page errors.
- NEXT: run checks.js (out/log_checks.txt); plan_south.json shots (Pasadena wind/smoke, Santa Monica marine, Fresno tule, Big Bear snow); look at shots; report.
- terrain job: ../terrain has terrain_engine.js but no port yet (23 Nov); my port's flood-plane anchors (4 lines in placeCamera/frame) may collide with theirs.
- fixed: grade let go exactly; wind short names. Rebuilt. checks rerun pending.
- port now applies on la_engine.js AND on terrain's output (regex for the 4 flood-plane places, surgeY removed); chain terrain>weather>traffic>car tried.

## World API (en = MODI.rooftops.api.en()), as built
- en.storm(n|id) ids dry,light,rain,tstorm,ar1..ar5 (0..8); en.wind(n|id) calm,breeze,sa1..sa4 (0..5); en.sky(n|id) none,marine,tule,smoke (0..3)
- en.snowLevel(m|null) overrides the step's snow level (m above sea level); en.elevation(m|null) ground height by hand when no terrain
- all five return en.stormKit.info(); en.weather() = info()
- en.setGraphics({ storm, wind, skyState, snowLevel, elevation }); en.graphics() -> storm, wind, skyState, snowLevel, elevation, stormInfo
- en.state() adds stormKey, wind, windKey, windName, sky, skyOn, weather(text), sustainedMph, gustMph, rainMmH, precip, snowLevelM, elevationM, visKm, altaCanFly
- lens ctx: stormStep, wind, windStep, sky, wx (= info())
- tables: SE.STORM, SE.WIND, SE.SKY, SE.windName(lat, lon), SE.stormStep/windStep/skyStep(v)
- env hooks read: env.elevation(lat, lon) (optional). env.surge is no longer called.
- visibility pass: more dust/leaves/ash/embers, stronger smoke, stars hidden under smoke. Rebuilt 22:40. Running checks then plan_b.json (trimmed shots).
- seaLevel prefers terrain datum S.y0 (port edited after the 22:40 build; out/engine_weather.js not yet rebuilt with it)
- snow pass: snow on tree crowns, bigger brighter flakes, brighter snow scene. Rebuilt 22:5x (incl. seaLevel S.y0). plan_b run in progress used the older build for bear/fresno.
- running run_b.sh (plan_b per place + checks), logs out/log_b*.txt, out/log_checks.txt
- snow pass 2: tree crowns take snow by the face as seen (crown normals are not usable), near flake layer. Rebuilt.
- shots done on new build: fresno tule, santa monica marine, pasadena sa4/smoke/night, sf tstorm. Lost to a closed browser: sf ar5 street/drone, checks. NEXT: checks.js, then plan_c.json (bear snow re-shoot + sf ar5).
- checks.js ALL PASS on the current build (out/log_checks.txt), no page errors. Running plan_c.json.
- snow re-shot OK (bear_snow_street/bird read as snow). Waiting on sf ar5 (log_c1). Then report.
- rain streak opacity up a little (0.46/0.78); rebuilt; re-shooting sf ar5 (log_c1)
