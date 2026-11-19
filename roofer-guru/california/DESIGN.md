# California Roofer Guru: shared brief for everyone building it

SP = /tmp/claude-0/-home-user-Leviathan/3de4e742-518d-5f10-b5db-2b34e6723642/scratchpad
CA = SP/ca

## What the user asked for (verbatim)

"I want you to take the lessons from this creation [Louisiana Roofer Guru], and apply it to the entire state of
California. Be just as detailed as you are with Louisiana, for the entirety of the dashboard. Be even more detailed for
California, but leave all of the hurricane stuff out. Keep the rain and weather stuff, and apply the weather systems of
California historically to the data collected within the Scout tab. Make the Scout Tab capture mountain ranges, deserts,
the full California topography. Keep the UAP vehicles and the drone vehicles. Add a 2027 BMW M3, black, as a vehicle,
with a top speed of 251 mph and realistic handling. Realistic Los Angeles traffic and planes in the sky. Realistic San
Francisco traffic. Realistic San Diego and Naval Base at Coronado."

The product: one self-contained HTML file, `california-roofer-guru.html`: the seventeen atlas modules plus module 18
(the Scout tab: map, roof model, Street View, 3D view, Scout Engine), all for California roofing and only California
roofing. The Louisiana page (/home/user/Leviathan/louisiana-roofer-guru.html) is the model for depth and manner.

## Fixed decisions

- Name: **California Roofer Guru** for the whole dashboard (page title, header, every place the atlas names itself).
  Module 18's tab is **Rooftop Scout**. Nothing may say Louisiana, parish, Gulf, hurricane season, LSLBC and so on.
  No hurricanes anywhere: no tracks, categories, surge, tropical outlooks.
- Compiled date: November 19, 2026. Time zone America/Los_Angeles ("Pacific").
- Storage keys: prefix `cg.` wherever Louisiana used `up.` or `cf.` (California must not share saved state with the
  Louisiana page). No fallbacks to old keys. Campaign token prefix `CA_`. ZIP pattern `9[0-6]\d{3}`.
  State in schema and addresses: `CA`, "County" (never "Parish").
- Geography: every populated California ZCTA (about 1,768), 58 counties, eleven regions:
  North Coast (Del Norte, Humboldt, Mendocino, Lake); Far North (Siskiyou, Modoc, Shasta, Lassen, Tehama, Trinity,
  Plumas); Sacramento Valley (Butte, Glenn, Colusa, Sutter, Yuba, Yolo, Sacramento, Placer, El Dorado); Sierra (Sierra,
  Nevada, Amador, Calaveras, Tuolumne, Mariposa, Alpine, Mono, Inyo); Bay Area (Alameda, Contra Costa, Marin, Napa,
  San Francisco, San Mateo, Santa Clara, Solano, Sonoma); Central Coast (Santa Cruz, San Benito, Monterey, San Luis
  Obispo, Santa Barbara); San Joaquin Valley (San Joaquin, Stanislaus, Merced, Madera, Fresno, Kings, Tulare, Kern);
  Los Angeles and Ventura; Orange County; Inland Empire (Riverside, San Bernardino); San Diego and Imperial.
  Region keys: nc, fn, sv, si, ba, cc, sj, la, oc, ie, sd.
- Service lines: thirteen, in this order and with these keys:
  `replace` (re-roof), `repair` (leaks and repairs), `storm` (wind and rain damage: atmospheric rivers, Santa Ana and
  Diablo wind), `fire` (wildfire damage and rebuild roofing), `harden` (fire hardened roof: Class A assembly, ember
  resistant vents, in Fire Hazard Severity Zones; insurance driven), `tile` (tile lift and relay: new underlayment
  under existing tile), `solar` (detach and reset of rooftop solar for a re-roof, and solar ready re-roofs),
  `metal`, `mh` (manufactured homes), `mf` (multifamily), `comm` (commercial, incl. Title 24 cool roofs), `coat`
  (coatings), `newc` (new construction). `hail` and `fortified` do not exist. Anything typed for eleven lines
  (LINE_KEYS, RES_LINES, COM_LINES, the correlation matrix, weights, palettes, copy tables) is rebuilt for thirteen.
- Hazards that replace the hurricane model: atmospheric rivers (CW3E scale AR1 to AR5), winter storm wind and rain,
  Santa Ana, Diablo and sundowner wind, wildfire (CAL FIRE perimeters, damage inspections, Fire Hazard Severity Zones),
  heat, mountain snow load, hail (rare), coastal salt air and marine layer, earthquakes only where a source is cited.
- Engine vehicles: on foot, Alta X drone, flying saucer, Tic Tac (all kept as in Louisiana), plus a black 2027 BMW M3
  the user drives: top speed exactly 251 mph (the user's figure), realistic handling (SP/ca/engine/car_physics.js).
  The Alta X still stays down past light rain, with the warning exactly:
  `Don't waste a $40,000 drone, stupid. Use the UAPs.`
- Engine weather: `SE.STORM` steps `dry, light, rain, tstorm, ar1, ar2, ar3, ar4, ar5`; a second scale `SE.WIND` for
  dry offshore wind `calm, breeze, sa1, sa2, sa3, sa4` (Santa Ana / Diablo, advisory to extreme); snow instead of rain
  above the step's snow level on real terrain; sky states for marine layer, tule fog and wildfire smoke. No surge.

## Evidence and contracts (read what you need; do not re-research what is there)

- CA/contract_core.md, CA/contract_m01_08.md, CA/contract_m09_17.md: what every part of the Louisiana atlas reads,
  shows and assumes, line by line, with what California needs. CA/la_atlas_data.json, la_zcols.txt, la_meta.json,
  la_nws_snapshot.json: Louisiana's data, the shape to match or knowingly change.
- SP/research/ca/sources_people_business.md (+ CA/dl/people): ACS, geometry, crosswalks, business counts, FEMA,
  insurance (FAIR Plan, non-renewals), CSLB licences, AHS, permits.
- SP/research/ca/sources_weather_hazard.md (+ CA/dl/hazard): Storm Events, storm reports, gusts, rain, normals,
  atmospheric rivers, Santa Ana index, CAL FIRE DINS, perimeters and FHSZ, snow, heat, NWS offices and zones.
- SP/research/ca/sources_scout_live.md (+ CA/dl/scout): live services a browser can call (buildings, parcels by county,
  permits, elevation tiles, imagery, streets, airports, traffic counts, naval bases).
- SP/research/ca/roofing_law_evidence.md (+ CA/dl/law): California roofing law, codes, insurance rules, materials,
  fire and weather performance, market.
- SP/research/ca/engine_evidence.md (+ CA/dl/engine): the M3, airliners and airports, LA / SF / San Diego traffic,
  Navy at Coronado and San Diego, bridges.
- CA/engine_terrain_survey.md, CA/engine_traffic_survey.md: surveys of the engine for terrain, traffic, cars, aircraft.
- Louisiana's sources of record: SP/tests/r11 (how module 18 and the engine were built), SP/research/r11_evidence.md.

## Where things live, and who may edit what

- CA/atlas/src/: the atlas cut into parts (manifest.json gives page order). These are California's sources: edit the
  part files you own directly. They started as Louisiana's text with the fixes Louisiana's build applied.
- CA/data/: the data build (Python). Output CA/data/out/ca_atlas_data.json (window.__ATLAS_DATA__) and
  ca_nws_snapshot.json, and CA/data/SCHEMA.md (every key and ZIP column: name, meaning, unit, source, formula).
- CA/scout/: module 18's dashboard script and parts (scout.js, scout-style.css, scout3d.js, trace.js), edited directly.
- CA/engine/: `la_engine.js`, `la_engine-style.css` are the Louisiana engine, never edited. Each engine job has its own
  folder CA/engine/<job>/ with its new code as separate source files and one `port_<job>.py <in.js> <out.js>` that
  applies it by anchored replacements (each anchor asserted to occur exactly once; see SP/tests/r11/port_storm.py and
  port_uap.py for the manner). The final engine is the ports applied in this order: terrain, weather, traffic, car, sky.
  Keep anchors short and away from other jobs' areas; say in your report which functions you touched.
- Test page for engine work: `python3 -I CA/build/testbed.py <engine.js> <out.html>` makes the Louisiana page with your
  engine and its place checks opened to California; CA/build/testbed_open.js shows how to open it at an address and
  reach the engine (`MODI.rooftops.api.en()`). Headless Chromium here renders in software and is slow: use small
  viewports, `q: 'low'`, `wide: false` unless you are testing the far view, `page.screenshot` with a clip and a long
  timeout, and step clocks by hand for timing checks (SP/tests/r11/review_fix_check2.js shows how).
- Nobody commits to git or edits /home/user/Leviathan; the lead does that.

## Manner

- Every figure shown to a reader comes from the evidence files (name the source the way Louisiana's text does), or is
  said plainly to be an assumption or a choice. Grades A to D for sources as Louisiana uses them. Do not invent
  statutes, programs, companies, prices or counts. Where evidence is missing, say what is not known.
- Plain words, short sentences, no marketing tone, no em dashes in new text; match the Louisiana page's voice.
- JavaScript in the page's own style (plain scripts, no modules, no build step, no external libraries beyond what the
  page carries). After any edit, the file must still parse (`node --check` for .js parts).
- The container restarts without warning, often. Save work to disk early and often; write long files in pieces; keep a
  short NOTES.md in your folder saying what is done and what is next, so you can resume.
- A safety check refuses shell heredocs that hold JavaScript it cannot parse: write scripts with the Write tool and
  run them plainly. Run Python with `-I`.
- Never send the user's details to any outside service. Do not ask the lead questions unless blocked: decide, note the
  decision in your report, and go on.
- Hand back a short report: what you built, where, how it was tested (with results), what is not done or not right.
