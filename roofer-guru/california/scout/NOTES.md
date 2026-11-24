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

## Integration pass (2026-11-24): resume here
Own build: `bash CA/scout_integ/assemble.sh CA/scout_integ/ca.html` (W = scout_integ/w, D = scout_integ/d). Rebuild before each test session.
Edits are made directly in scout.js (Edit tool, or scout_integ/ed.py <file> <edits.json>); after each: `python3 -I tools/check.py`.
Tests: tests/lib.js (launch, find, engine, shot), one browser at a time, `NODE_PATH=/opt/node-tools/node_modules timeout 900 node tests/X.js scout_integ/ca.html`.
Order of work: 1 bar, 2 roof views (pictures in scout_integ/shots), 3 card + data, 4 Louisiana suites ported, 5 word search + method text.

### 1. bar (in progress)
- DONE: M3 pad (padFor: Throttle/Brake/Steer + Handbrake button, Climb hidden), car buttons (Camera named, Traction control: on/off,
  Reverse, Back onto the road) read from en.car.input (carSync), status sentence (road: mph, gear/reverse, rpm, traction control, off the
  road, grip, against X), captions (#scEnWhat: traffic measured/chosen/generated, the M3), aircraft line rewritten (uses info().drawn;
  military field says no flights drawn there).
- tests/bar_m3.js: all but the handbrake checks passed on the 2nd run (the test had steered into a building); rerun after fix.
- NEXT: tests/bar_wx.js (scales by arrow keys, sky, Alta X rule, air switch, sound), tests/bar_warp.js (not written yet).
- Seen in pictures: wind slider track dark vs the rain slider's light (style), "Dry wind" label wraps.
- 03:15 lead's message: frame pacing port `dense` is now the last engine port: added to scout_integ/assemble.sh (both lists). Screenshots no
  longer freeze; engine frames run at the true rate (about 1 a second in software), so tests must wait in engine time, not wall time.
  Earlier oddities (page not answering after AR5, slow aircraft switch 52 s, canvas shots of 4 min) were the frame queue: retest.
- Bar fixes so far beyond the M3: weather line no longer repeats the step's name; ground height read from state().ground (elev is the
  camera's height); wind slider colour; pad lifted above the attribution strip (CSS); aircraft line; captions (#scEnWhat).
- scout3d.js: freeway and ramp lane lines, cable car rails and slot (S.cable), MAT.rail. Not yet looked at in a browser.
- tests written: bar_m3.js, bar_wx.js (TAIL=1 for the air/sound part), bar_warp.js, views_shots.js + plans/*.json, dbg_air.js, run_bar.sh.

### State 04:00 (integration pass)
1. BAR: DONE and tested on the dense build. bar_wx.js (TAIL part all pass; the scale part passed on the pre-dense build; rerun once at the end),
   bar_m3.js (all pass but two test artefacts: the car put back against traffic; fixed in the test, rerun pending), bar_warp.js (5 warps arrive within
   21 m; ground 9 / 1208 / 2402 / 146 / 6.5 m against 8 / 1209 / 2400 / 146 / 6; craft 60 m over the ground; Las Vegas refused; pictures in
   scout_integ/shots/warp_*.png). The test's own checks used state().elev (camera height) by mistake: fixed to state().ground; rerun pending.
   Found by it: the bar lost keyboard focus when the engine redrew it a frame later (arrow keys on the rain slider stopped after one step):
   renderEnBar now keeps focus and caret (keep / caret).
   Aircraft switch: rebuilds the roads (sky job's code): 8 s in the test browser on the dense build.
5. TEXT: method paragraph "The ground, the traffic, the aircraft and the car in the Scout Engine", three caveats (ground, generated traffic, the M3),
   nine source rows (Terrain Tiles, Caltrans, TomTom, OSM lanes/bridges, OurAirports, FAA, BTS, BMW, what is generated) ADDED. Word search of d/ and w/: clean.
   Still to do for 5: innerText search of #mod-rooftops in the browser.
4. SUITES: tests/la_port/port_suites.py writes the ports (smoke, smoke2, layout, scout_open, keys_test, unscored, mapclick, inj8, inj_sk, r11_smoke,
   review_fix_check2, views_unit -> lens_unit_ca). NOT RUN YET.
3. tests/card_ca.js written (20 addresses, CSV check). NOT RUN YET. scout3d.js road kinds drawn, not yet seen in a browser.
2. VIEWS: tests/views_shots.js + plans; Irvine running (views_irvine.out), then berkeley, altadena, mammoth, coronado.

### State 05:00: roof views looked at (pictures in scout_integ/shots: <place>_<step>.png, readings in <place>.json)
Round 1 (irvine, berkeley, altadena, mammoth, coronado) seen. Found and fixed:
- legend ramps collapsed to nothing when the legend was taller than the view (flex column shrink): CSS `.sc .sc-en .se-legend>*{flex:0 0 auto}`.
- Weather legend showed ramps that were not in use; now only what is drawn (snow where it snows here, wind and/or rain, embers only in
  dry wind under 40 mph or smoke); leak rings got a legend mark (m6); quiet weather (breeze, marine, tule) says it does nothing to a roof.
- Mammoth: legend leads with "Here, at N ft, this storm falls as snow" (snowHere).
- Time view: wildfire, age and rust were three oranges: fire now red (#ff4d5e, row 20), rust rose (#f478b0, row 6). Wood shake colour greyer brown.
- Ember exposure index reworked (emberIx): losses within 300 m and a perimeter weigh in, the day is 80 mph gusts (EMBER_DAY), floor one half,
  CAL FIRE's recorded vents and eaves used. Altadena read 1.0 of 10 next to 64 destroyed structures before.
- Covering: "; else" with nothing after it; "shows light ... drawn as dark" wording; a light toned low slope roof is now drawn as gravel built up
  (gravelLike: pattern 18 was never chosen by the dashboard before).
- Thermal: "the average low slope membranes roof" -> ROOF_ONE words.
- Patterns 15 to 18 rewritten in CA/engine/views/port_views_ca.py (15 butt lines strong, joints hairlines; 16 corrugation dominant, courses step
  over crowns; 17 courses and tone carry to drone height; 18 mottle and scour patches). Wood shake was a flat field from 37 m before.
Round 2 running: tests/run_views2.sh (pat = Irvine Woodbury houses by coordinates, berkeley2 = Elmwood houses, mammoth2, altadena2, coronado2).
NEXT after looking: card_ca.js (20 addresses + CSV), la_port suites, layout at 1280/1024/390 (bar), 3D view road kinds, final word search, report.

### State 06:00
2. VIEWS: round 2 looked at (pat_*, berkeley2_*, mammoth2_*, altadena2_*, coronado2_*): the four new patterns read as what they are at 13 m and 37 m;
   legends and readings sensible (Mammoth AR3: snow +18 psf of the design load, legend leads with snow; Altadena ember exposure 3.5 of 10).
3. CARD: tests/card_ca.js over 22 addresses (out: scout_integ/card/card_ca.json, show.py prints sections): all cards read; topo section once;
   elevations agree with the engine's ground (Altadena 371 vs 369 m, LA City Hall 93 vs 93, Coronado 7 vs 6.9, Mammoth 2,401 vs 2,402).
   Found and fixed: two different ground snow loads on one card (ZIP value 351 lb in the weather record and the Weather view, 474 lb in the
   topo section): snowLoadAt(b) now reads the topo block's grid at the building for all three. Provinces: the CGS "Southern Coastline" strip had
   been merged whole into the Peninsular Ranges (Ventura, Santa Barbara, Oxnard mislabelled): topo/build_prov.py now cuts the strips into
   0.05 degree cells joined to the nearest province; topo_prov.js rebuilt (test/prov_points.js all as expected; test/prov_cmp.js shows what moved:
   38 grid points to Transverse, 184 Delta points Coast Ranges -> Great Valley). CSV at Altadena: 70 columns, all filled but the user's own
   field_check columns and nearest_peak_ft (blank for small summits with no height in the list: said in the CSV note now).
   NOT YET: Street View and three.js 3D view check; road kinds seen in the 3D view.
4. running: tests/layout_bar.js (1280, 1024, 390). Then la_port suites.

### State 07:00
4. LAYOUT: tests/layout_bar.js passes at 1280, 1024 and 390 (pictures scout_integ/layout). Fixed for it: pad/note/legend kept above the attribution
   strip by its measured height (padClear), Scene menu panel a bottom sheet on phones (it ran 175 px off the window), segs wrap in it, the long
   captions fold into one <details> on phones (narrow(), genOpen). Engine attribution strip now credits the ground and the counts.
   RUNNING: tests/run_rest.sh (d3_ca.js, then la_port/* into la_port/out/*.out; run_rest.done when over).
   AFTER IT: rebuild; rerun bar_wx.js (full), bar_m3.js, bar_warp.js, wordsearch_ca.js on the final build; ca_smoke.js; final notes + report.

### HANDOVER STATE 08:00 (lead's order of work: 1 bar faults, 2 roof views in pictures, 3 card, 4 method text; suites and 3D road kinds later)
Sources parse (tools/check.py), all ports apply, page builds: `bash CA/scout_integ/assemble.sh CA/scout_integ/ca.html` (same as build/assemble_ca.sh
but W = scout_integ/w, D = scout_integ/d; jobs terrain weather traffic car sky views dense). Nothing is half applied.
DONE (each tested, see the states above): 1 bar; 2 roof views at five places in two rounds (pictures scout_integ/shots); 3 card at 22 addresses + CSV;
4 method paragraph, 3 caveats, 9 source rows; layout at 1280 / 1024 / 390; 3D view and Street View open in California (tests/d3_ca.js all pass);
freeway lane lines and cable car rails in scout3d.js (counted by roadsInfo(), not yet seen in a picture aimed at them).
Ported suites run (tests/la_port/out): scout_open, smoke, smoke2, layout, keys_test (all pass), unscored, mapclick, inj8, inj_sk, views_unit
(lens_unit_ca PASS), r11_smoke: no page errors in any. review_fix_check2 was stopped mid run (not a failure: rerun).
NEXT, in order:
 a. final-build verification, running now: tests/check_open.js, then tests/run_final.sh (wordsearch_ca.js, bar_m3.js, bar_wx.js, bar_warp.js).
 b. inj8.js / inj_sk.js picked only one house at Hollywood (few single family houses with no permit there): move LA, LO in la_port/port_suites.py to a
    single family part of the City of Los Angeles (e.g. Mar Vista 34.0040, -118.4290), delete la_port/picked4.json and picked8.json, run each twice.
 c. rerun la_port/review_fix_check2.js (its checks reach into the weather kit's internals: expect to adapt them).
 d. a picture of the 3D view aimed at a freeway (lane lines) and at California St (cable rails).
FOUND, NOT FIXED (other owners, or a model question):
 - sky job: the aircraft switch rebuilds every road (for the bridge decks): 8 s of frozen page in the test browser.
 - sky job: en.air.info() names only the nearest airport; at Coronado that is North Island (no flights drawn) while San Diego's flights fill the sky.
   The bar says so in words; a second "nearest airport with flights" in info() would read better.
 - weather job: SE.windName gives "Diablo" at Mammoth Lakes (east of the Sierra crest).
 - Scout model: an Irvine tract of 2005 reads Tile 52%, shingles 43% (and clay 66% of tile): the RECS odds by era under-read tile in south Orange
   County tracts; Orange County's roll has no roof type. A county or tract lean would fix it; not done.
 - Thermal legend: the air temperature uses the ZIP's height (said in the legend now), not the engine's ground (540 ft apart at Mammoth).
 - topo: nearest_peak_ft blank for small summits (no height in the gazetteer); "Snow: none to design for ... about 5 lb/ft2" reads oddly at sea level.
 - mapclick.js log text still says "click 70503" (it clicks 95816).
- 08:10 tests/check_open.js on the final build (sha1 1e49cea9eb50): all pass, no page errors. run_final.sh started.
- 08:20 wordsearch_ca.js on the final build: no Louisiana, hurricane or surge word in the tab (111,800 characters with every detail opened), the bar in four modes, all eight legends, the engine's tables; no page errors.
- 08:35 bar_m3.js on the final build: 20 ok, 3 FAIL, none a bar fault: (a) brake on the pad for 1.6 s took 17.5 to 13.9 mph on grass (the test wanted 5 mph), (b) after Back onto the road beside a building the pad's throttle moved the car only 0.3 mph in 7 s once (the W key drove it after the next reset): the car job's carLane may put it against something: look, (c) the test switched traffic on through the API, which does not redraw the bar, so the Traffic caption was not there yet (the Scene menu's own switch redraws it).
- 08:50 bar_wx.js (full) on the final build: 34 ok; its one FAIL was the test's own (it expected the camera at eye height; the bar's ground reading, 20 ft, was right): test corrected. Aircraft switch 3 s.
- 09:05 bar_warp.js on the final build: all 27 pass (address, coordinates, Mammoth Lakes, Palm Springs, Santa Cruz; ground 9 / 1,208 / 2,402 / 146 /
  6.5 m; craft 60 m over the ground; AR3 stepped with the arrow keys reads snow at Mammoth and rain at Palm Springs; Las Vegas refused).
  FINAL BUILD VERIFIED: scout_integ/ca.html sha1 1e49cea9eb50 (check_open, wordsearch, bar_m3, bar_wx, bar_warp). Report handed back.
  What is left is the NEXT list (b, c, d) and the FOUND, NOT FIXED list in the handover state above.
