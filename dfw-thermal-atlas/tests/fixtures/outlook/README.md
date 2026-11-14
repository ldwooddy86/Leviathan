# Outlook family fixtures

Answers of the four hosts the collectors `cpc_outlook`, `nbm_extended` and `ercot_grid` read, recorded on 2026-11-13 and trimmed
to the fields those collectors ask for. Map service answers keep `features` (or `results`) only; attribute values are untouched.

| File | What it is |
|---|---|
| `cpc-610-temp-multipoint-2026-11-13.json`, `cpc-814-temp-multipoint-2026-11-13.json` | The 6 to 10 and 8 to 14 day temperature outlooks, layer 0, asked with one multipoint holding the 12 county points: one band each (issue of Nov 12). |
| `cpc-610-temp-point-2026-11-13.json`, `cpc-814-temp-point-2026-11-13.json` | The same layers at a single point. |
| `cpc-610-precip-point-2026-11-13.json`, `cpc-814-precip-point-2026-11-13.json` | Layer 1, precipitation, at a single point. |
| `cpc-610-temp-envelope-two-bands-2026-11-13.json`, `cpc-814-temp-envelope-two-bands-2026-11-13.json` | Layer 0 of each outlook asked with the bounding box of the atlas: two bands (Above 50 and Above 60; Above 33 and Above 40). The tests serve them as the multipoint answer of a split metro, which has the same shape. |
| `hazards-L1-national-…`, `hazards-L3-national-…`, `hazards-L4-national-…`, `hazards-L6-national-…` | Every area drawn in the country on the four hazards layers read (`where=1=1`): six areas, one of them Heavy Snow. |
| `hazards-L7-multipoint-12-counties-2026-11-13.json` | The drought layer asked with the 12 county points: one area, Severe Drought. A real answer of the spatial query, with a label that is not a cold one. |
| `hazards-L4-multipoint-mountain-points-2026-11-13.json` | Layer 4 asked with ten points in the Rockies, the Sierra Nevada and the Cascades (not the 12 counties): two Heavy Snow areas. A real answer of the spatial query with a cold label. |
| `wssi-p-L1-point-dfw-2026-11-13.json` | Probabilistic Winter Storm Severity Index, layer 1, at Dallas Fort Worth: no feature. |
| `wssi-p-L1-multipoint-mountain-points-2026-11-13.json`, `wssi-p-L2-multipoint-mountain-points-2026-11-13.json` | Layers 1 (minor) and 2 (moderate) asked with four mountain points (not the 12 counties): 60 and 27 features, 25 and 17 windows, several probability bands a window. |
| `cpc-month-temp-point-2026-11-13.json`, `cpc-season-temp-identify-2026-11-13.json` | The monthly outlook at a point (`query`) and the 13 three month outlooks (`identify`, text attributes). |
| `pmd-mrd-2026-11-13.json`, `pmd-thr-2026-11-13.json`, `pmd-ens-2026-11-13.json` | `api.weather.gov/products/types/PMD/locations/{MRD,THR,ENS}/latest` as served, without the JSON-LD context: the 6 to 10 and 8 to 14 day discussion, the hazards discussion and the ENSO discussion, all issued Nov 12. |
| `iem-mos-nbe-six-airports-2026-11-13.json` | `mesonet.agron.iastate.edu/api/1/mos.json` for six airports, model NBE, the 12Z run of Nov 13: all 126 rows, eight of the 79 fields. |
| `ercot-daily-prc-2026-11-13.json` | `daily-prc.json`: the whole `current_condition` block and the last three of 4,417 ten second rows. |
| `ercot-supply-demand-2026-11-13.json` | `supply-demand.json`: two of the 289 five minute rows of the day and all 144 hourly forecast rows, five fields each. |
| `ercot-zones-20261112-2026-11-13.html` | The weather zone page of Nov 12, a full day of 24 hours: the table and the date field, without the page's scripts. |
| `ercot-zones-today-partial-2026-11-13.html` | The same page for the day in progress, 12 hours: must be read as "not a full day". |
| `ercot-firewall-403-2026-11-13.html` | The body the site's firewall sent with HTTP 403. The address of the caller, the incident number and the session tokens are replaced by placeholders. |
| `synthetic-hazards-L3-much-below-normal.json` | Hand made, in the shape of the real answers: a Much Below Normal Temperatures area for Nov 23 to 25. No such area was drawn anywhere on the day of recording. |
| `synthetic-outlook-cases.json` | Hand made records of the three collectors on a quiet first of December, and one case for each rule of the two week cold outlook. |
| `synthetic-outlook-summer.json` | Hand made records on a July afternoon, for the season gate. |

Recorded at 00:08 UTC on 2026-11-14 (6 pm on the 13th in Dallas) by one run of the collector itself, the issue of Nov 13:

| File | What it is |
|---|---|
| `cpc-610-temp-multipoint-2026-11-14.json`, `cpc-610-precip-point-2026-11-14.json` | The 6 to 10 day outlook, temperature at the 12 county points (Above, 50) and precipitation at the office. |
| `cpc-814-temp-multipoint-2026-11-14.json`, `cpc-814-precip-point-2026-11-14.json` | The 8 to 14 day outlook: a near normal band (`Normal`, 36) and precipitation Above, 40. |
| `hazards-L4-national-2026-11-14.json`, `hazards-L4-multipoint-12-counties-2026-11-14.json` | Layer 4 across the country (six areas, two of the three Heavy Snow areas with the same dates) and at the 12 county points (none). |
| `pmd-mrd-2026-11-14.json`, `pmd-thr-2026-11-14.json` | The two discussions issued Nov 13: the North Texas row turned to N for days 8 to 14, and the freeze risk moved to Tue-Wed, Nov 24-25. |
