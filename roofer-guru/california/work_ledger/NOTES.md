# Ledger, weather desk, regions, watch job: notes (resume here)

Owner of: CA/atlas/src/14_m02_storms.js, 26_m14_weather.js, 11_nws_core.js, 23_m11_regions.js, 10_watch_core.js, 25_m13_watch.js
Work folder: CA/work_ledger (tests, private build copies). Needs for the data jobs: CA/atlas/NEEDS_FROM_DATA.md

Read so far: DESIGN.md, contract chapters (m02, m11, m13, m14, core 10/11), sources_weather_hazard.md, law evidence A2 A3 A4 A13 C,
data/SCHEMA.md (regions are numbers 1..11, META.model.REGK gives the two letter key; parishes/pi keep their names; comp is tiny).
Snapshot exists: data/hazard/out/ca_nws_snapshot.json (points carry reg key, fireZone; grid has snow, humidity, sky; alerts carry zones, fips).

Decisions
- Shared helper names in 14_m02 that other files read are kept (kmLL, MONL, MON3, DOW, DOW3, listAnd, cap1, hourLab, SF, catColor,
  kindColor, stormKind, stormName, RTS, SIDX, stormFoot, dmgShare, footStats); the storm track ones are inert stand-ins.
- Fire perimeters are drawn by module 02 itself in a group added to the ZipMap viewport (02_map.js is not mine);
  perimeter paths carry data-pt = 1e6 + fire index so the map's own hover and click routing reaches onPtHover/onPt.
- Storage keys: cg.watch.v1. Campaign names CA_<TOK>_GOOGLE_<REGION>.

Status
- [ ] 11_nws_core.js
- [ ] 26_m14_weather.js
- [ ] 10_watch_core.js
- [ ] 25_m13_watch.js
- [ ] 23_m11_regions.js
- [ ] 14_m02_storms.js (waits on HAZARD_SCHEMA.md)
- [ ] node tests, build, browser tests, word search
