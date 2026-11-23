# CA/data build notes (resume file)

Scripts run in order by build_all.sh with `python3 -I`. Intermediate files in CA/data/work/ (JSON).

- [x] SCHEMA.md first issue (2026-11-19); needs the second issue (true to out/ca_atlas_data.json)
- [x] 01_people.py   -> work/base.json (1,763 ZIP rows, 58 counties)
- [x] 01b_solar.py   -> work/solar.json (needs dl/solar/nem_apps.zip, 168 MB, and sunroof_zip.csv)
- [x] 02_geo.py      -> work/geo.json (1.15 MB; pictures work/map_*.png)
- [x] 03_hazard_in.py -> work/haz.json (own DINS count + hazard job tables: final out/zcta_hazard.json if present, else its work tables)
- [x] 04_roofmodel.py -> work/roof.json
- [x] 05_lines.py    -> work/lines.json
- [x] 06_assemble.py -> out/ca_atlas_data.json, out/ca_zip_index.json (merges hazard/out/hazard_ts.json, hazard_pts.json, hazard_events.json when present)
- [x] 07_checks.py   -> out/build_report.md, out/checks.json (128 checks pass, 2026-11-23)
- [x] build_all.sh (bash build_all.sh [first step])
- [x] SCHEMA.md second issue (2026-11-23)
- [ ] refinements: relief layer; Sacramento permits; final hazard merge (rerun `bash build_all.sh 3`, then add a change-list line to SCHEMA.md)
- hazard job (2026-11-23): running again; out/ has only the snapshot + fire_rings.json; its work tables are used as interim (names from its schema).
  When out/zcta_hazard.json etc. appear: rerun 03, 04, 05, 06, 07 (bash build_all.sh from step 3) and update SCHEMA.md group E.
