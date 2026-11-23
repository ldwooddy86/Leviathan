# Ledger, weather desk, regions, watch job: notes (resume here)

Owner of: CA/atlas/src/14_m02_storms.js, 26_m14_weather.js, 11_nws_core.js, 23_m11_regions.js, 10_watch_core.js, 25_m13_watch.js
Work folder: CA/work_ledger. Needs for the data jobs: CA/atlas/NEEDS_FROM_DATA.md (written, both data jobs told).

Facts learned (do not re-read the big files):
- Regions are numbers 1..11 (META.model.REGK gives nc..sd). Core has CO, COI, ATLAS{name,state,st,file,tz,tzName}, MO3, MOL, joinAnd, capFirst.
- Map API: fillCounty, dimCounty, selectCounty, fitCounties, onCounty, onCountyHover, countyTip (old names aliased). No perimeter layer.
- HZ global is TAKEN by 09_sl_model.js (HZ.month.{ar,wind,offshore,fire,rainev,hail,heat,snow,tstm}); my ledger global is LEDG.
- SLM.DAYPARTS[template] is one flat row of six; SLM.daypartGrid(t) gives 7 rows.
- Data does not exist yet (no ca_atlas_data.json); snapshot exists and is real. Hazard schema is a stub: I code to NEEDS shapes, tolerant.
- satchelLint(text, ctx) -> [{rule:{id,sev,name,cite,fix}, ev}] ; satCtx has fire, juris California.

Status (2026-11-23 resume)
- [x] 11_nws_core.js  (node test t_nws.js passes on the real snapshot)
- [x] 26_m14_weather.js (parses; not yet rendered in a browser)
- [x] 10_watch_core.js (patched by work_ledger/patch_watch_core.py; backup *.la.bak)
- [x] 25_m13_watch.js (patched by patch_m13.py)
- [x] 23_m11_regions.js (rewritten; tolerant column picker; markets by city)
- [ ] 14_m02_storms.js
- [ ] smoke test (work_ledger/smoke.js), word search, report
- [x] 14_m02_storms.js = cat work_ledger/m02_a.js m02_b.js m02_c.js m02_d.js (edit the parts, then cat again)
- Hazard schema second issue read (fixed names): hz.{fires,zfire,zdins,ar,ar_pts,ar_big,wind,zones,roof,fhsz,fema}; ts.month kinds hw sw hrain flood fflood debris hsnow wstorm xheat heat wfire g58 fire_* ar1..5 ar_days sa_days hail tsw torn; ZIP cols g40 g58 wd58 rain_d1 h100 fhsz_vh/high/mod ...
- Data file exists (interim hazard merge: no hz, ts.month {}, pts []). NEXT: fix nws SEASONS + m14 record to read ts.month names directly; m11 col names (g58, fhsz_high, snow_max_psf, MKT); build + browser test.
- 2026-11-23: all six files Californian, parse, word search 0. Browser test t_page.js: 0 page errors on interim data (pre merge) and on
  my own merged test file; live refresh works. Final merged data arrived: build with data/out/ca_atlas_data.json and rerun t_page.js net.
  Test: python3 -I build/build_ca.py work_ledger/out/ca_final.html --data data/out/ca_atlas_data.json --nws data/hazard/out/ca_nws_snapshot.json --engine engine/la_engine.js --engine-style engine/la_engine-style.css ; node work_ledger/t_page.js work_ledger/out/ca_final.html net
- DONE 2026-11-23: final merged data tested (work_ledger/out/t_final.log): 0 page errors, ZIP lookups right, live refresh works. Word search 0. Report handed back.
  Refinements left: see the report (fires table capped at 400 rows; 02 map default draws about 10,700 dots; 11_nws work day reason tidy made after the last browser run, node tested only).
