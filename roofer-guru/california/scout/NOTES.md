# Scout (module 18) for California: working notes

Owner of CA/scout/. Resume here after a restart.
Edits to scout.js were made by one-off python scripts (anchored replacements over block files), now kept in CA/scout_work (history/, blocks/): scout.js itself is the source;
after each: `python3 -I tools/check.py`; the pass scripts p01 to p12 and the snapshots are in CA/scout_work/history (strips the script tags, node --check).

Plan / state (tick when done):
- [ ] A place: bounds, state test, geocoder, messages, city list, storage keys cg., names, CSV names
- [ ] B buildings/parcels/permits for California counties
- [ ] C roof model (coverings, lives, clock)
- [ ] D outlook (weather history)  -- needs hazard columns; accessor map HCOL in one place
- [ ] E lenses (Weather, Fire, Solar) + CA/engine/views/port_views_ca.py
- [ ] F engine bar
- [ ] G method/caveats/sources
- [ ] H tests in tests/, final word search

## State 2026-11-23 (resumed)
Applied to scout.js (each a tools/pNN script over blocks/): p01 top (names, keys cg., EP, PARCEL, state box),
p02 model (clock, roofOf, hazard columns adapter HCOL/wxCol, read(), store/ingest, parcels, CAL FIRE cells and DINS,
permits LA/SF/Sacramento/San Jose), p03 outlook (causes wind/rain/fire/hail/wear), p04 heat (70 stations), p05 lenses.
Next: p06 the module mount (texts, map bounds, find form, loadTile, card, outlook card, weather facts), p07 engine bar,
p08 CSV + method/caveats/sources, scout3d/trace/css words, CA/engine/views/port_views_ca.py, tests, word search.
Hazard column names are guesses from the hazard job's work scripts (HCOL in scout.js): confirm against HAZARD_SCHEMA.md.

## State 2026-11-23, later
scout.js parses and runs on California's data (build_ca.py with the LA engine): p06 mount, p06b columns (hazard job's
final names), p07 engine bar, p08 CSV + method/caveats/sources, p09/p10 fixes. tests/smoke_ca.js passes (no page
errors) at Hollywood (LA parcels + LADBS permits), San Francisco (roll + DBI permits), Altadena (DINS, perimeters),
Paradise (Very High zone, DINS). The engine itself cannot be kept alive in the browser right now: the machine is
saturated (load 24) and Chromium dies after about 30 s in the engine even with the engine jobs' own test bed page
(tests/dbg_engine.js shows it): retry tests/engine_ca.js when it is quiet.
Still to do: CA/engine/views/port_views_ca.py (patterns 15 to 19, en.lensPatterns), scout3d.js / trace.js words and
keys (up. -> cg.), tests/lens_unit_ca.js, more addresses (Coronado, Mammoth, Sacramento, Riverside), final word search.

## State 2026-11-23, evening
Done since: p11 (scout3d.js, trace.js: keys cg., words, pitch, GEOID18 grid from NGS via tools/geoid_ca.py), p12 (bar on
the engine jobs' interfaces: BAR_NEEDS.md), CA/engine/views/port_views_ca.py (applies on la_engine.js, on the weather
engine and on the terrain+traffic+weather+car chain), word search of CA/scout: zero but `G0.parish` (the data's key)
and "Delta" (the Sacramento Delta).
Tests in tests/: smoke_ca.js (8 addresses, no page errors), lens_unit_ca.js PASS, permit_unit_ca.js PASS,
engine_ca.js (needs a quiet machine: software GL), dbg.js / dbg_engine.js helpers.
Builds: build/out/scout_test.html, scout_unit.html (LA engine), scout_wx.html (weather engine + views port).
Left: engine_ca.js on the LA engine and on scout_wx.html; a look at a picture of the bar; report.

## State 2026-11-23, night (hand-back state)
scout.js / scout3d.js / trace.js / scout-style.css are final sources (parse; run on CA/data/out/ca_atlas_data.json).
Also done: p13 (freeway / ramp / cable kinds in words and in the 3D view; traffic and sky captions), the fire pace cap,
ZIP fire rebuilds cut off for buildings CAL FIRE inspected, dates YYYYMMDD read, permitCover "remove X, install Y".
Other jobs' ports checked against this scout.js: engine/traffic/port_traffic_scout.py and scout/topo/port_topo.py both
apply (outputs in CA/scout_work/tmp). Do not write the literal name of the terrain block's global in scout.js: its port
refuses a file that contains it.
Tests: tests/*.js with outputs tests/*.out. Engine runs: engine_ca.out (LA engine), engine_ca_wx.out (weather engine
with the views port): all eight views read 43 roofs, no page errors.
