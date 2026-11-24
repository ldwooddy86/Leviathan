# Build agents (lead's note, for resuming after a restart: send a message to the id)

| Job | Id | Owns |
|---|---|---|
| Engine terrain | a9511fd0e400fbeee | CA/engine/terrain |
| Engine weather | adfc68b739ae91c89 | CA/engine/weather |
| Engine car (M3) | af6a6af1e0e3dda2e | CA/engine/car |
| Engine traffic | acd8846bf61862cbd | CA/engine/traffic (+ port_traffic_scout.py) |
| Engine sky, Navy, bridges | ab15aab0dfe9d09cb | CA/engine/sky |
| Data: ZIP table, geometry, model | aea20725cb346103c | CA/data (SCHEMA.md, out/ca_atlas_data.json) |
| Data: hazards, ledger, NWS snapshot | a0d9e000d2cd7bc79 | CA/data/hazard |
| Atlas law and compliance | a41a47ceae14fbcd4 | 04_content, 15_m03_law, 05_satchel_rules, 22_m10_satchel |
| Atlas Forge and copy | ad96c2c0ae0bb9bd1 | 08_forge_copy, 06_forge_compile, 21_m09_forge, cms_* |
| Scout module | a658204eacec5696a | CA/scout (+ CA/engine/views) |
| Scout topography | aec46a5102a5aaaa5 | CA/scout/topo |
| Atlas modules 06, 07, 08, 15, 16 | a36f5b6676bef40c8 | 18_m06, 19_m07, 20_m08, 12_accounts_core, 27_m15, 30_m16 |
| Atlas core, 01, 04, 05, 12, 17 | ac785ae1587137492 | html_00, 00_core, 01_brand, 02_map, 03_charts, 09_sl_model, 13_m01, 16_m04, 17_m05, 24_m12, 31_m17, 99_shell |
| Atlas 02, 11, 13, 14, watch, nws | acb80088ee73e655f | 14_m02, 26_m14, 11_nws_core, 23_m11, 10_watch_core, 25_m13 |

Integration order for the engine: terrain, weather, traffic, car, sky, views (CA/engine/views/port_views_ca.py).
Scout: port_traffic_scout.py and topo/port_topo.py are applied to CA/scout/scout.js at assembly.
| Atlas integration pass | ad3fdf96bd31b52b8 | all of CA/atlas/src, small data fixes |
| Engine dense downtowns (LA crash) | ac82217a66f3a502b | CA/engine/dense |
