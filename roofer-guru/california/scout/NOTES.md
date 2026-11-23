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
