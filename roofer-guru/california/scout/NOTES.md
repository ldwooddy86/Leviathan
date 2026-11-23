# Scout (module 18) for California: working notes

Owner of CA/scout/. Resume here after a restart.
Edits to scout.js are made by one-off python scripts in tools/ (anchored replacements, new text in blocks/);
after each: `python3 -I tools/check.py` (strips the script tags, node --check).

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
saturated (load 24) and Chromium dies after about 30 s in the engine even with the Louisiana test bed
(tests/dbg_engine.js shows it): retry tests/engine_ca.js when it is quiet.
Still to do: CA/engine/views/port_views_ca.py (patterns 15 to 19, en.lensPatterns), scout3d.js / trace.js words and
keys (up. -> cg.), tests/lens_unit_ca.js, more addresses (Coronado, Mammoth, Sacramento, Riverside), final word search.
