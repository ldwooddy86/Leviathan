# core job notes (resume here)
Files owned: html_00, 00_core, 01_brand, 02_map, 03_charts, 09_sl_model, 13_m01, 16_m04, 17_m05, 24_m12, 31_m17, 99_shell.
Patches are in work_core/p_*.py (anchored; already applied). src_orig/ = parts as first found.
DONE: html_00 (title, meta, footer, map css), 00_core, 01_brand, 02_map (rewritten), 09_sl_model (rewritten: HZ adapter, SLM, LINE_TIER.., QN), 99_shell (rewritten).
TODO: 13_m01 (LAYERS + module 01), 16_m04, 17_m05, 24_m12, 31_m17 rewrites; remove duplicate consts (QN in 13; LINE_TIER/TIER_BID/lineTargets/lineCities/LINE_FIRMS in 24; gammaFn in 31).
TODO when HAZARD_SCHEMA.md is final: HZ adapter names in 09 (ts.month kinds, rain by region), HC column names, hazard LAYERS notes.
TODO: build + headless test with CA/data/out/ca_atlas_data.json when it exists; final word search.
2026-11-23 resumed. 13_m01 WRITTEN (LAYERS catalog + module 01; QN moved to 09). HC/zcol added to 09.
NEXT: 24 (patch), 17 (patch), 16 (rewrite), 31 (rewrite/patch); then smoke build with LA stand-in data; word search.
- 24 done (patched p_m12.py, p_m12b.py)
- 17 (p_m05.py) and 16 (head kept + m04_tail.js) done. NEXT: 31_m17, then build/test.
- 31 done (p_m17.py, p_fix1.py). NEXT: smoke build with LA stand-in, then synthetic CA columns test, word search.
- data exists now (CA/data/out/ca_atlas_data.json; hazard merge interim: ts.month/hour empty, pts empty). HZ/HC in 09 set to final HAZARD_SCHEMA names (p_hz.py); hazard LAYERS rewritten (p_lay.py).
NEXT: build with CA data + headless test (work_core/test_*.js); word search; report.
- first full test on CA data passed (no page errors; 150 layers draw). p_fix2.py: wording, land fill under ZIPs.
2026-11-23 STATE: ALL OWNED FILES DONE, parse, render on CA data (test_core.js: no page errors, 150 layers, 13 lines, cg. keys).
Patches applied in order: p_html, p_core, p_brand(2), p_shell, p_hc, p_m12, p_m12b, p_m05, (16 = head + m04_tail.js), p_m17, p_fix1..6, p_hz, p_lay.
Waiting on others: hazard merge (ts.rain, ts.month, ts.hour, pts, snow_psf, ar_days, hail1_n25, stress): code reads them when present.
Test pages: work_core/out/ca_test.html (real data), ca_synth.html (made-up ts series, test only).
