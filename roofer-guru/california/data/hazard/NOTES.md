# Hazard build: working notes (resume here after a restart)

Folder: CA/data/hazard. Run everything with `bash build_hazard.sh` (each step: `python3 -I NN_name.py`).
Outputs: out/. Intermediate tables: work/. Schema: HAZARD_SCHEMA.md (keep true).

Steps (tick when the output file exists and was checked):
- [ ] 10_nws_snapshot.py  -> out/ca_nws_snapshot.json (live fetch)
- [ ] 01_zcta_base.py     -> work/zcta_base.json (centroid, area, county, region, coast km, elevation)
- [ ] 02_stations.py      -> work/zcta_station.json (rain, heat, gust days from stations)
- [ ] 03_ar.py            -> work/zcta_ar.json, work/ar_events.json
- [ ] 04_fire.py          -> work/zcta_fire.json, work/fires.json
- [ ] 05_wind_events.py   -> work/zcta_wind.json, work/wind_events.json
- [ ] 06_snow_hail.py     -> work/zcta_snow_hail.json
- [ ] 07_assemble.py      -> out/zcta_hazard.json, out/hazard_events.json, out/hazard_ts.json, out/hazard_pts.json
- [ ] 08_roof_model.py    -> out/roof_hazard_model.json, out/roof_hazard_model.md
- [ ] 09_checks.py        -> out/checks.json, out/CHECKS.md

Decisions are logged at the bottom of HAZARD_SCHEMA.md.
