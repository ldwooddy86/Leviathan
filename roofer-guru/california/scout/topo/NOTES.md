# topo job notes (resume here)
Folder CA/scout/topo. CORE IS DONE AND TESTED (2026-11-23). Refinements go in topo_extra.js (+ topo_extra_data.js) through
the EXTRA hooks of topo_block.js (window.__SCOUT_TOPO_EXTRA__: init, read, lines, csvCols, csvRow, csvNote, profile).

Deliverables:
- port_topo.py <scout.js in> <out> [<css in> <out>] : 5 anchors in scout.js (opening <script id="scout-js">,
  `LF.control.scale(`, `function detail() {`, `$('#scCsv', root).onclick = () => exportCSV();`, `toCSV(header, rows, `)
  and `</style>` in the stylesheet. Applies cleanly to the current CA/scout/scout.js (parse checked) and to tools/scout.orig.js.
- topo_block.js (core), topo-style.css, topo_grid.js (458 KB, build_grid.py), topo_prov.js (10 KB, build_prov.py),
  topo_gaz.js (114 KB, gaz_wanted.py -> gaz_lookup.py -> sample_3dep.py -> build_gaz.py).
- test/make_page.py (port + test-bed page), test/t1_core.js, test/t2_card.js; shots/.
Sources in dl/: gnis (USGS GNIS CA), prov/cgs_geomorphic.geojson (CGS GeoGems layer 2), prov/cgs_note36.pdf,
cec/zip.xlsx (CEC climate zones by ZIP), ne/coast.geojson, hill/ (CORS tests of hillshade services).
Test results: heights match research table (Whitney z14 4412.0 vs 4411.8; Badwater -77.8; Tahoe 1897.6; Twin Peaks 261.8;
Ferry Bldg 2.3; Coronado 7 m). No page errors; dead tile service falls back to the grid quietly.
Note: current CA/scout/scout.js throws "SMAT is not defined" on its own (mid-rewrite), so browser tests use the test bed.

REFINEMENTS DONE (2026-11-23): build_extra.py -> topo_extra_data.js (CEC climate zone by ZIP, ASCE 7-22 snow grid);
topo_extra.js (snow, climate zone, salt air on card + CSV; profile tool; Topography panel with province notes);
test/t3_extra.js. All three tests pass with no page errors. Report handed back.
Not done: wind in named passes, marine layer, tule fog (no evidence); heights for tier 3 names; spine lines for ranges.
