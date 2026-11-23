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
