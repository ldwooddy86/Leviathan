# Integration follow-ups (lead's list)

From the Forge job
- Six register notes in 04_content.js LAWPUB trip the rule pack themselves (warranty, padj, deductible, fairplan, sfw,
  wuidetail): reword them or exempt quoted law; then drop FCOPY.LAW_SWAPPED fallbacks if no longer needed.
- `houseClean` (core) prints "C-39" as "C 39": add an exception.
- Rule GOUGE matches "fire rate" inside "fire rated": tighten the pattern (05_satchel_rules.js).
- Data: a Title 24 climate zone column `cz` per ZIP is read by the Forge (and wanted by Scout topo); `snow_psf` missing
  from the ZIP table until the hazard merge.
- Event pages untested on real data until `DATA.hz` exists.

From the desk job
- `requestHosts` in 12_accounts_core.js lists only api.weather.gov and spc.noaa.gov: add hosts module 14 calls.
- Module 15 text still says "Storm Desk": align with module 14's final name ("Weather Desk").
- Check event menu and year table against real `hz` and `pts` shapes after the hazard merge.

From the data job
- Hazard merge is interim: when CA/data/hazard/out is complete run `bash CA/data/build_all.sh 3`, add a line to SCHEMA.md.
- CBECS 5.9 million buildings figure was used from memory: verify or mark as assumption in meta.assume.
- `meta.model.MKT` media markets typed from general knowledge: show as principal city only.
- `comp` has 4 named rows, unverified on company sites.

From the law job
- LAWFAQ has no reader yet (module 03 could show it).
- Browser look at modules 03 and 10 (calculator cards).

From the topo job
- Climate zone by ZIP (CEC list) is in CA/scout/topo/dl and topo_extra_data.js: have the data build add `cz` to the ZIP table.
- port_topo.py is applied to scout.js at assembly (anchors listed in its report; Scout job told to keep them).
- Not built: wind in passes, marine layer, tule fog notes (no evidence); spine lines.

From the core job
- `fhsz_sh` is a share of the ZIP's land, not homes: module 06's label still says "Homes".
- Service line seasons are flat until `ts.rain` and `ts.month` are merged; re-run CA/work_core/test_core.js after the merge.
- `SLM.DEF` click cost, lead and close rates carried from Louisiana as grade D assumptions (no California evidence).
- Footer source list is static text; `meta.econ` not wired (CA_FACTS typed in module 04 with source printed).

From the ledger job
- 09_sl_model.js: `HZ.month` picker does not list `sa_days`, `hw`, `hsnow`, `wstorm`, and takes `ts.month.wind` (alias of
  thunderstorm wind) as its wind series: use the high wind series.
- Ledger KPI shows 31.4 AR landfalls a year from `ts.ar_wy`; research grouping gave about 23.5: settle which and label it.
- Inert stand-ins in 14_m02 (stormName, stormKind, SIDX, stormFoot, dmgShare, footStats, RTS): confirm no reader is left.
- Cesar Chavez Day in the crew calendar is from general knowledge: verify or mark.
- 11_nws_core.js last tidy checked in Node only: confirm in the browser.
