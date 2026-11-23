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
