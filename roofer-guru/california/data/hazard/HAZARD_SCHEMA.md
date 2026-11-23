# HAZARD_SCHEMA.md: California weather and fire data (replaces Louisiana's hurricane model)

STATUS: FIRST DRAFT written while the build runs. The file names and top level keys below are fixed; column lists are
final only where a section says "BUILT". This file is rewritten at the end of the build from the real outputs.

Folder: `CA/data/hazard/`. Build: `bash build_hazard.sh` (Python 3 with `-I`). Outputs in `CA/data/hazard/out/`:

| file | replaces in Louisiana | status |
|---|---|---|
| `ca_nws_snapshot.json` | `window.__NWS_SNAPSHOT__` | BUILT (live fetch 2026-11-19) |
| `zcta_hazard.json` | hurricane and hail ZIP columns (`hur64`, `hd1`, `wd50`, `last64` ...) | planned: `{cols: [...], rows: [[...]], notes}` keyed by ZCTA, 1,808 rows |
| `hazard_events.json` | `routes`, `rlist`, `seg`, `sids`, `zstorm` | planned: `{fires, ar, wind, zfire, zv, encode}` |
| `hazard_ts.json` | `ts.month`, `ts.hour`, `ts.year`, `ts.trop_month`, `ts.fema_year` | planned |
| `hazard_pts.json` | `pts`, `ptflags` | planned |
| `roof_hazard_model.json`, `roof_hazard_model.md` | (new, for Rooftop Scout) | planned |
| `CHECKS.md`, `checks.json` | | planned |

Map paths: fire outlines are stored as simplified lon/lat rings (`ring` fields, 4 decimals) and `hazlib.encode_path(rings,
geo)` re-encodes them to the atlas path format (`M x y` then `l dx dy`, integers, `z`) once `geo = {minx, maxy, kx, sx}` is
fixed by the data job. The same function is given in JavaScript in the final version of this file.

Point used for every per ZCTA station lookup: the "town point" = the GeoNames postal point of the ZIP when it lies in or
within 2 km of the ZCTA (1,760 of 1,808), else the Census internal point.
