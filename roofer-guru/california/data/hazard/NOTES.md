# Hazard build: working notes (resume here after a restart)

Folder: CA/data/hazard. Outputs: out/. Intermediate tables: work/. Schema: HAZARD_SCHEMA.md (second issue written
2026-11-23: names are FIXED there; scripts must conform to it). Requests from module writers: CA/atlas/NEEDS_FROM_DATA.md.
The data job reads out/zcta_hazard.json through CA/data/03_hazard_in.py (cols/rows, column `zip`).

Steps (x = output on disk and looked at):
- [x] 10_nws_snapshot.py  -> out/ca_nws_snapshot.json (2026-11-19; add windDirection on next fetch)
- [x] 01_zcta_base.py     -> work/zcta_base.json, coast_albers.wkb
- [x] 02_stations.py      -> work/zcta_station.json
- [x] 03_ar.py            -> work/zcta_ar.json, work/ar_events.json
- [x] 04_fire.py          -> work/zcta_fire.json, work/fires.json, out/fire_rings.json (log: work/04_fire.log)
- [x] 05_wind_events.py   -> work/zcta_wind.json, work/wind_events.json
- [x] 06_snow_hail.py     -> work/zcta_snow_hail.json
- [x] 07_assemble.py      -> out/zcta_hazard.json, hazard_events.json, hazard_ts.json, hazard_pts.json
- [ ] 08_roof_model.py    -> out/roof_hazard_model.json, .md
- [ ] 09_checks.py        -> out/checks.json, out/CHECKS.md, and section 9 of HAZARD_SCHEMA.md
- [ ] build_hazard.sh
