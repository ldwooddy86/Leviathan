# Contract: head, stylesheet and shared libraries (lines 1 to 4986) of the Uplift Louisiana Roofing Atlas

Source file: `la_atlas_source.html` (9,661 lines as measured; the brief says 9,667). All line numbers below are 1-based lines of that file.
Scope of this document: lines 1 to 4986 except the two data lines (559 `window.__ATLAS_DATA__`, 560 `window.__NWS_SNAPSHOT__`). Sections covered:

| Section | Lines | One-line role |
|---|---|---|
| Head and stylesheet | 1-558 | Title, meta description, fonts, CSS tokens, shell HTML, footer source line |
| 00_core.js | 562-764 | Data unpacking (`DATA`, `META`, `Z`, `ZR`, `PA`...), formatters, colour scales, files, UI builders, router |
| 01_brand.js | 765-860 | The company (`BRAND`) panel, logo, theming, document title |
| 02_map.js | 861-994 | Projection, `ZipMap` SVG map class, storm track legs (`SEGS`), parish tooltips |
| 03_charts.js | 995-1133 | Generic SVG charts (no data fields, no Louisiana text) |
| 04_content.js | 1134-1363 | `LAWX` (law register), `ADRULES`, `PL` (eleven service lines), `LAWLINK`, `NEG_COMMON`, `fillCopy` |
| 05_satchel_rules.js | 1364-1440 | `SAT`: the compliance rule pack (31 copy rules, 6 page rules, 10 controls) and `satchelLint` |
| 06_forge_compile.js | 1441-1720 | `FORGE_COMPILE`: blueprint to Elementor JSON, HTML, JSON-LD, preview, lint |
| 07_forge_bridge_raw.js | 1721-1726 | A WordPress plugin (PHP) held as one string; summarised only |
| 08_forge_copy.js | 1727-2116 | `FCOPY`: the copy library for generated website pages (service, city, parish, storm pages, guides, Spanish fragments) |
| 09_sl_model.js | 2117-2193 | `SLM`: marketing assumptions, unit economics, budget allocation, seasonality, `r_*`/`p_*` layer definitions |
| 10_watch_core.js | 2194-2361 | `WATCH`: competitor roster, ad ledger, library links, importers, analytics |
| 11_nws_core.js | 2362-2461 | `NWSX`: weather snapshot, live refresh, storm trigger index, work windows, alert actions |
| 12_accounts_core.js (+ 11 CMS files) | 2462-4986 | `ACCT` ad-platform connectors and actuals; `CMS` publishing layer with ten adapters; `HEADLESS_KIT` |

Conventions used below
- "ZIP column" = a name in `DATA.zcols` (165 columns, `la_zcols.txt`); after line 579 each ZIP row is an object `z` with those keys, plus the derived keys `z.fips`, `z.cty` added at line 580.
- "parish field" = a key of an element of `DATA.parishes` (64 objects).
- "LA-specific" = text or constants that must be rewritten for California.
- Quoted strings are copied from the source; `[...]` marks an elision made by me.
- Inside tables, a pipe that belongs to quoted code is written `\|` (markdown table escaping); the source has a bare `|`. Code in bullet lists and fenced blocks is verbatim.

## ZIP columns: which of my sections read each one

165 columns in `DATA.zcols` order. "Read by" lists section and source line; a blank cell means no code in lines 1 to 4986 reads the column (the modules after line 4986 do). Basis of the meaning: **C** = stated by code or text in my range; **D** = I confirmed the stated relation numerically on the Louisiana data; **M** = label or note in the modules' shared layer catalog at lines 4990 to 5044, which starts just after my range (I looked only to avoid guessing; the module contract is authoritative); **N** = inferred from the column name and example only, to be confirmed against the module contracts.

| # | Column | Example | Read by my sections (line) | Meaning | Basis |
|---|---|---|---|---|---|
| 0 | `zip` | "70001" | 00_core 580 (key of `ZI`); 02_map 930; 09_sl_model 2175; 12_accounts 2618, 2776 | ZIP Code Tabulation Area, 5-character string; also the key of `geo.zcta` | C |
| 1 | `city` | "Metairie" | 00_core 580 | place name shown for the ZIP; when empty the code substitutes the parish name | C |
| 2 | `pi` | 25 | 00_core 580 | index of the ZIP's parish in `DATA.parishes` | C |
| 3 | `reg` | 1 |  | region number, a key of `META.model.REG` (1 to 9) | N |
| 4 | `lat` | 29.9845 | 02_map 929 (`fitTo`) | centroid latitude, degrees | C |
| 5 | `lon` | -90.1695 | 02_map 929 (`fitTo`) | centroid longitude, degrees | C |
| 6 | `sqmi` | 6.5 |  | land area, square miles (`density` = `pop / sqmi`) | D |
| 7 | `wsqmi` | 0.0 |  | water area, square miles | N |
| 8 | `pop` | 38950 |  | residents; `res_ok` is 1 exactly when `pop >= 500` | D |
| 9 | `hh` | 17808 | 00_core 580 (copied to `z.occ`) | households | C |
| 10 | `inc` | 67923 |  | median household income, dollars (line 5028) | M |
| 11 | `value` | 339400 |  | median home value, dollars (line 5027) | M |
| 12 | `own_sh` | 51.4 |  | owner occupied, percent of occupied homes (line 5025) | M |
| 13 | `sfd_sh` | 52.1 |  | single-family detached share of homes, percent | N |
| 14 | `mf5_sh` | 30.6 |  | share of homes in buildings of 5 or more units, percent | N |
| 15 | `span_sh` | 11.7 |  | speak Spanish at home, percent of residents 5 and older (line 5032) | M |
| 16 | `span_lep_sh` | 4.7 |  | Spanish speakers with limited English, percent | N |
| 17 | `viet_sh` | 0.4 |  | speak Vietnamese at home, percent (line 5033) | M |
| 18 | `french_sh` | 0.7 |  | speak French or Cajun at home, percent (line 5034) | M |
| 19 | `hh100k_sh` | 33.0 |  | households earning $100,000 or more, percent (line 5029) | M |
| 20 | `s65_sh` | 18.6 |  | residents 65 and over, percent (line 5030) | M |
| 21 | `density` | 6011 |  | residents per square mile (`pop / sqmi`) | D |
| 22 | `gid` | 9025099 | 12_accounts 2618 | Google Ads geo target constant ID of the postal code (joins the Google `geographic_view` report to ZIPs) | C |
| 23 | `hu` | 19447.0 |  | housing units (= sum of the ten `yb*` columns) | D |
| 24 | `occ` | 17808.0 | 00_core 580 (overwritten by `hh`) | occupied housing units; identical to `hh` in the data and overwritten by `hh` at load | C |
| 25 | `vac_sh` | 8.4 |  | vacancy rate, percent (`100 * (1 - occ / hu)`) | D |
| 26 | `seas` | 62.0 |  | seasonal and recreational homes, labelled `(camps)` (line 5031) | M |
| 27 | `u1` | 11492.0 |  | homes in one-unit structures | N |
| 28 | `mh` | 247.0 |  | mobile homes (`mh_sh` = `100 * mh / hu`) | D |
| 29 | `mf24` | 1743.0 |  | homes in 2 to 4 unit structures | N |
| 30 | `mf5u` | 5942.0 |  | homes in structures of 5 or more units | N |
| 31 | `mh_sh` | 1.3 |  | mobile homes as a percent of housing units | D |
| 32 | `yb_med` | 1975.0 |  | median year built, ACS (line 5006) | M |
| 33 | `rooms` | 5.2 |  | median rooms per home | N |
| 34 | `mort_sh` | 59.6 |  | owners with a mortgage, percent (line 5026); the "mortgage share" of the FORTIFIED text at line 1265 | M |
| 35 | `pre80_sh` | 60.9 |  | homes built before 1980, percent (`100 * (yb70 + yb60 + yb50 + yb40 + ybold) / hu`) | D |
| 36 | `yb20` | 122.0 |  | homes built 2020 or later | N |
| 37 | `yb10` | 851.0 |  | built 2010 to 2019 | N |
| 38 | `yb00` | 2156.0 |  | built 2000 to 2009 | N |
| 39 | `yb90` | 1674.0 |  | built 1990 to 1999 | N |
| 40 | `yb80` | 2804.0 |  | built 1980 to 1989 | N |
| 41 | `yb70` | 4338.0 |  | built 1970 to 1979 | N |
| 42 | `yb60` | 3463.0 |  | built 1960 to 1969 | N |
| 43 | `yb50` | 2664.0 |  | built 1950 to 1959 | N |
| 44 | `yb40` | 1008.0 |  | built 1940 to 1949 | N |
| 45 | `ybold` | 367.0 |  | built 1939 or earlier | N |
| 46 | `roofs` | 11607 |  | one-unit roofs: detached and attached one-unit homes, one roof per home (label `One unit roofs (detached and attached homes)`, line 4998) | M |
| 47 | `ra_med` | 9 |  | median roof age in years, model (line 5004) | M |
| 48 | `ra15` | 4166 |  | roofs 15 years or older | D |
| 49 | `ra20` | 2810 |  | roofs 20 years or older | D |
| 50 | `ra15_sh` | 35.9 |  | `100 * ra15 / roofs` | D |
| 51 | `ra20_sh` | 24.2 |  | `100 * ra20 / roofs` | D |
| 52 | `wave` | 1356 |  | roofs reaching 20 years within five years (= `ra15 - ra20`) | D |
| 53 | `nxt` | 485.9 |  | age-driven replacements expected in the next twelve months, model (line 5003) | M |
| 54 | `last64` | 2021 |  | last year with sustained hurricane-force (64 kt) wind at the ZIP | N |
| 55 | `yrs64` | 5 |  | `2026 - last64` | D |
| 56 | `hd1` | 1.6 |  | days a year with hail of 1 inch or larger within 25 miles (SPC 1996 to 2025); state median 1.9 as line 1252 says | D |
| 57 | `hd175` | 0.6 |  | damaging hail days a year, 1.75 inch or larger within 25 miles (line 5010) | M |
| 58 | `hd2` | 0.1 |  | days a year with hail of 2 inches or larger within 25 miles | N |
| 59 | `hd1_10` | 1.4 |  | hail days a year over the recent decade, 2016 to 2025 (line 5011) | M |
| 60 | `wd50` | 5.133 |  | damaging wind days a year, 58 mph (50 kt) or more within 25 miles (line 5012) | M |
| 61 | `wd65` | 0.333 |  | days a year with thunderstorm wind of 65 kt or more within 25 miles | N |
| 62 | `td1` | 0.833 |  | tornado days a year, EF1 or stronger within 25 miles (line 5013) | M |
| 63 | `hur64` | 7.89 |  | chance of hurricane-force (64 kt) winds in a year, percent: share of years 1950 to 2025 with modelled sustained winds of 64 kt or more at the ZIP (line 5014) | M |
| 64 | `hur50` | 17.11 |  | chance of 50 kt winds in a year, percent (line 5015) | M |
| 65 | `ts34` | 60.53 |  | annual chance of 34 kt (tropical storm) wind, percent | N |
| 66 | `n64_00` | 4 |  | hurricane-force storms since 2000 (line 5016) | M |
| 67 | `n50_00` | 7 |  | storms since 2000 with 50 kt or more | N |
| 68 | `vmax_00` | 95.0 |  | peak modelled sustained wind since 2000, kt | N |
| 69 | `vmax_20` | 81.0 |  | peak modelled sustained wind since 2020, kt | N |
| 70 | `ev_h1` | 0 |  | hail reports of 1 inch or more located in the ZIP, 2016 to 2026 (line 5017) | M |
| 71 | `ev_h175` | 0 |  | hail 1.75 inches or larger | N |
| 72 | `ev_w58` | 3 |  | damaging wind reports located in the ZIP, 2016 to 2026 (line 5018) | M |
| 73 | `ev_w75` | 0 |  | thunderstorm wind 75 mph or more | N |
| 74 | `ev_t` | 0 |  | tornado touchdowns in the ZIP, 2016 to 2026 (line 5019) | M |
| 75 | `ev_dmg` | 1.0 |  | NOAA estimated property damage, $ thousands | N |
| 76 | `fema_k` | 4000 |  | FEMA roof and wind damage registrations, 2004 to 2026 (line 5020) | M |
| 77 | `fema_20` | 605 |  | the same since 2020 | N |
| 78 | `fema_ida` | 592 |  | FEMA verified wind loss, Hurricane Ida 2021 (line 5022) | M |
| 79 | `fema_laura` | 0 |  | FEMA verified wind loss, Hurricane Laura 2020 (line 5023) | M |
| 80 | `fema_rate` | 22.5 |  | registrations per 100 occupied homes (`100 * fema_k / occ`) | D |
| 81 | `est` | 1234 |  | business establishments (ZIP Code Business Patterns) | N |
| 82 | `retail` | 98 |  | retail establishments (line 5038) | M |
| 83 | `food` | 84 |  | food service establishments | N |
| 84 | `lodging` | 13 |  | lodging establishments | N |
| 85 | `whse` | 8 |  | warehousing establishments, ZBP 2023 (line 5036) | M |
| 86 | `mfg` | 20 |  | manufacturing establishments (line 5037) | M |
| 87 | `church` | 13 |  | religious organizations (line 5039) | M |
| 88 | `health` | 144 |  | health care establishments | N |
| 89 | `school` | 13 |  | schools | N |
| 90 | `apts` | 9 |  | apartment lessors (line 5040) | M |
| 91 | `nonres` | 7 |  | non-residential lessors | N |
| 92 | `office` | 289 |  | office-type establishments | N |
| 93 | `auto` | 9 |  | auto dealers and repair | N |
| 94 | `roofers` | 5 |  | roofing contractor establishments in the ZIP, ZBP 2023 (line 5042) | M |
| 95 | `builders` | 30 |  | builder establishments | N |
| 96 | `supply` | 0 |  | roofing supply dealers | N |
| 97 | `ins_agents` | 37 |  | insurance agencies | N |
| 98 | `adjusters` | 0 |  | claims adjusters | N |
| 99 | `cru` | 883.4 |  | commercial roofs, estimate: ZIP Code Business Patterns 2023 establishments weighted by building type, scaled to 80,000 statewide (line 5035) | M |
| 100 | `lic` | 9.4 |  | LSLBC roofing licence records in the ZIP's city, split across the city's ZIPs (line 5043) | M |
| 101 | `p_replace` | 381.84 | 09_sl_model 2172 (`zipLine`), layer 2185 | pool: expected jobs a year, Roof replacement (unit and method: `PL` line text, section 5.3.1) | C |
| 102 | `p_repair` | 350.72 | 09_sl_model 2172 (`zipLine`), layer 2185 | pool: expected jobs a year, Roof repair and leaks (unit and method: `PL` line text, section 5.3.1) | C |
| 103 | `p_storm` | 958.24 | 09_sl_model 2172 (`zipLine`), layer 2185 | pool: expected jobs a year, Storm and wind damage (unit and method: `PL` line text, section 5.3.1) | C |
| 104 | `p_hail` | 69.78 | 09_sl_model 2172 (`zipLine`), layer 2185 | pool: expected jobs a year, Hail damage (unit and method: `PL` line text, section 5.3.1) | C |
| 105 | `p_fortified` | 101.56 | 09_sl_model 2172 (`zipLine`), layer 2185 | pool: expected jobs a year, FORTIFIED roofs (unit and method: `PL` line text, section 5.3.1) | C |
| 106 | `p_metal` | 71.48 | 09_sl_model 2172 (`zipLine`), layer 2185 | pool: expected jobs a year, Metal roofing (unit and method: `PL` line text, section 5.3.1) | C |
| 107 | `p_mh` | 34.75 | 09_sl_model 2172 (`zipLine`), layer 2185 | pool: expected jobs a year, Manufactured home roofs (unit and method: `PL` line text, section 5.3.1) | C |
| 108 | `p_mf` | 34.82 | 09_sl_model 2172 (`zipLine`), layer 2185 | pool: expected jobs a year, Multifamily, condo and HOA (unit and method: `PL` line text, section 5.3.1) | C |
| 109 | `p_comm` | 86.05 | 09_sl_model 2172 (`zipLine`), layer 2185 | pool: expected jobs a year, Commercial roof replacement (unit and method: `PL` line text, section 5.3.1) | C |
| 110 | `p_coat` | 26.5 | 09_sl_model 2172 (`zipLine`), layer 2185 | pool: expected jobs a year, Restoration, coatings and maintenance (unit and method: `PL` line text, section 5.3.1) | C |
| 111 | `p_newc` | 42.83 | 09_sl_model 2172 (`zipLine`), layer 2185 | pool: expected jobs a year, New construction roofing (unit and method: `PL` line text, section 5.3.1) | C |
| 112 | `r_replace` | 97.02 | 09_sl_model 2172 (`zipLine().rate`), layer 2184 | rate: jobs per 10,000 residents a year, shrunk toward the parish rate (prior of 2,500 residents), Roof replacement | C |
| 113 | `r_repair` | 90.29 | 09_sl_model 2172 (`zipLine().rate`), layer 2184 | rate: jobs per 10,000 residents a year, shrunk toward the parish rate (prior of 2,500 residents), Roof repair and leaks | C |
| 114 | `r_storm` | 247.43 | 09_sl_model 2172 (`zipLine().rate`), layer 2184 | rate: jobs per 10,000 residents a year, shrunk toward the parish rate (prior of 2,500 residents), Storm and wind damage | C |
| 115 | `r_hail` | 17.97 | 09_sl_model 2172 (`zipLine().rate`), layer 2184 | rate: jobs per 10,000 residents a year, shrunk toward the parish rate (prior of 2,500 residents), Hail damage | C |
| 116 | `r_fortified` | 26.24 | 09_sl_model 2172 (`zipLine().rate`), layer 2184 | rate: jobs per 10,000 residents a year, shrunk toward the parish rate (prior of 2,500 residents), FORTIFIED roofs | C |
| 117 | `r_metal` | 18.51 | 09_sl_model 2172 (`zipLine().rate`), layer 2184 | rate: jobs per 10,000 residents a year, shrunk toward the parish rate (prior of 2,500 residents), Metal roofing | C |
| 118 | `r_mh` | 9.1 | 09_sl_model 2172 (`zipLine().rate`), layer 2184 | rate: jobs per 10,000 residents a year, shrunk toward the parish rate (prior of 2,500 residents), Manufactured home roofs | C |
| 119 | `r_mf` | 8.71 | 09_sl_model 2172 (`zipLine().rate`), layer 2184 | rate: jobs per 10,000 residents a year, shrunk toward the parish rate (prior of 2,500 residents), Multifamily, condo and HOA | C |
| 120 | `r_comm` | 21.98 | 09_sl_model 2172 (`zipLine().rate`), layer 2184 | rate: jobs per 10,000 residents a year, shrunk toward the parish rate (prior of 2,500 residents), Commercial roof replacement | C |
| 121 | `r_coat` | 6.76 | 09_sl_model 2172 (`zipLine().rate`), layer 2184 | rate: jobs per 10,000 residents a year, shrunk toward the parish rate (prior of 2,500 residents), Restoration, coatings and maintenance | C |
| 122 | `r_newc` | 10.96 | 09_sl_model 2172 (`zipLine().rate`), layer 2184 | rate: jobs per 10,000 residents a year, shrunk toward the parish rate (prior of 2,500 residents), New construction roofing | C |
| 123 | `z_replace` | 0.449 |  | standard score of `log(r_replace)` across residential ZIPs (mean 0, sd 1), Roof replacement | D |
| 124 | `z_repair` | 0.361 |  | standard score of `log(r_repair)` across residential ZIPs (mean 0, sd 1), Roof repair and leaks | D |
| 125 | `z_storm` | 0.98 |  | standard score of `log(r_storm)` across residential ZIPs (mean 0, sd 1), Storm and wind damage | D |
| 126 | `z_hail` | -0.555 |  | standard score of `log(r_hail)` across residential ZIPs (mean 0, sd 1), Hail damage | D |
| 127 | `z_fortified` | 0.968 |  | standard score of `log(r_fortified)` across residential ZIPs (mean 0, sd 1), FORTIFIED roofs | D |
| 128 | `z_metal` | -1.137 |  | standard score of `log(r_metal)` across residential ZIPs (mean 0, sd 1), Metal roofing | D |
| 129 | `z_mh` | -1.362 |  | standard score of `log(r_mh)` across residential ZIPs (mean 0, sd 1), Manufactured home roofs | D |
| 130 | `z_mf` | 2.139 |  | standard score of `log(r_mf)` across residential ZIPs (mean 0, sd 1), Multifamily, condo and HOA | D |
| 131 | `z_comm` | 1.522 |  | standard score of `log(r_comm)` across residential ZIPs (mean 0, sd 1), Commercial roof replacement | D |
| 132 | `z_coat` | 1.245 |  | standard score of `log(r_coat)` across residential ZIPs (mean 0, sd 1), Restoration, coatings and maintenance | D |
| 133 | `z_newc` | -0.3 |  | standard score of `log(r_newc)` across residential ZIPs (mean 0, sd 1), New construction roofing | D |
| 134 | `f_replace` | 1640599 |  | gross profit pool, dollars: `p_replace * REP * VAL * FEE`, Roof replacement | D |
| 135 | `f_repair` | 60474 |  | gross profit pool, dollars: `p_repair * REP * VAL * FEE`, Roof repair and leaks | D |
| 136 | `f_storm` | 2150285 |  | gross profit pool, dollars: `p_storm * REP * VAL * FEE`, Storm and wind damage | D |
| 137 | `f_hail` | 185954 |  | gross profit pool, dollars: `p_hail * REP * VAL * FEE`, Hail damage | D |
| 138 | `f_fortified` | 604937 |  | gross profit pool, dollars: `p_fortified * REP * VAL * FEE`, FORTIFIED roofs | D |
| 139 | `f_metal` | 539683 |  | gross profit pool, dollars: `p_metal * REP * VAL * FEE`, Metal roofing | D |
| 140 | `f_mh` | 45414 |  | gross profit pool, dollars: `p_mh * REP * VAL * FEE`, Manufactured home roofs | D |
| 141 | `f_mf` | 448109 |  | gross profit pool, dollars: `p_mf * REP * VAL * FEE`, Multifamily, condo and HOA | D |
| 142 | `f_comm` | 1327547 |  | gross profit pool, dollars: `p_comm * REP * VAL * FEE`, Commercial roof replacement | D |
| 143 | `f_coat` | 174919 |  | gross profit pool, dollars: `p_coat * REP * VAL * FEE`, Restoration, coatings and maintenance | D |
| 144 | `f_newc` | 38864 |  | gross profit pool, dollars: `p_newc * REP * VAL * FEE`, New construction roofing | D |
| 145 | `idx` | 88.6 | 00_core 581 (`ZR` filter) | demand index, 0 to 100: percentile rank among residential ZIPs of the sum of `META.model.W[K] * z_K` | D |
| 146 | `idx_eq` | 84.1 |  | the same with equal weights | D |
| 147 | `fees` | 7216785 |  | gross profit pool, dollars a year: sum of the eleven `f_K` | D |
| 148 | `cases` | 1617.87 |  | jobs open to marketing a year: sum of `p_K * REP_K` | D |
| 149 | `gi` | 3.96 |  | Getis-Ord Gi* hot spot statistic on the index (z), each ZIP with its eight nearest neighbours (line 4997) | M |
| 150 | `gicls` | "H99" |  | hot or cold spot class from `gi`: `H99` (>= 2.58), `H95` (>= 1.96), `H90` (>= 1.65), `ns`, `C90`, `C95`, `C99` | D |
| 151 | `comp_mass` | 13.34 |  | competitor presence, distance weighted: mapped roofers' offices weighted by reach (statewide 3, national 2.5, regional 1.5, local 1) and exp(-distance / 20 km), plus advertised service cities at 35 percent (line 5041) | M |
| 152 | `comp_n25` | 8 |  | competitor offices within 25 miles | N |
| 153 | `roof_mass` | 79.67 |  | distance-weighted roofer establishments | N |
| 154 | `roof_per10k` | 3.7 |  | `10,000 * (roofers + lic) / pop` | D |
| 155 | `comp_pct` | 96.6 |  | competitive pressure percentile: 60 percent mapped roofer presence, 40 percent roofing establishments and licence records within about 10 km (line 5044) | M |
| 156 | `cpc_rel` | 1.186 | 09_sl_model 2170, 2175 | relative cost per click multiplier (range 0.497 to 1.195; tracks `META.model.DMA[reg]`) | C |
| 157 | `eff` | 6084979 |  | `fees / cpc_rel` | D |
| 158 | `effb` | 94.8 |  | percentile rank of `eff` among residential ZIPs | D |
| 159 | `oppb` | 97.7 |  | percentile rank of `fees` among residential ZIPs | D |
| 160 | `quad` | 0 |  | quadrant from `oppb` and `comp_pct` at 60: `0` both high, `1` high opportunity and low competition, `2` both low, `3` low opportunity and high competition | D |
| 161 | `tier` | "A" |  | tier from `effb`: `A+` >= 95, `A` 85 to 95, `B` 65 to 85, `C` 40 to 65, `D` 15 to 40, `E` below 15 | D |
| 162 | `bid` | 20 |  | bid adjustment percent by tier: `A+` 30, `A` 20, `B` 10, `C` 0, `D` -20, `E` -50 | D |
| 163 | `res_ok` | 1 | 00_core 581 (`ZR` filter) | 1 when the ZIP is scored as residential (`pop >= 500`); 441 of 534 | C |
| 164 | `metal_sh` | 6.8 |  | metal share of roofs, percent | N |

Summary: my sections read 35 of the 165 columns: `zip, city, pi, lat, lon, hh, occ, gid, idx, cpc_rel, res_ok`, the eleven `p_*` and the eleven `r_*`. Three derived keys are added to every ZIP object at load: `z.fips` and `z.cty` (00_core line 580) and `z.sl_top` (09_sl_model line 2180). `SLM.layers()` (line 2181) also publishes layer definitions for all `r_*` and `p_*` columns.

Relations between columns that I confirmed on the Louisiana data (useful as acceptance tests for the California build):

- `f_K = p_K * META.model.REP[K] * META.model.VAL[K] * META.model.FEE`; `fees = sum f_K`; `cases = sum p_K * REP[K]`; `META.pools[K] = sum p_K`; `META.fees[K] = sum f_K`; `META.fees_tot = sum fees`.
- `z_K` = standard score of `log(r_K)` over the residential ZIPs, for all eleven lines (median absolute difference 0.000 to 0.001; `newc` differs a little because three ZIPs have a zero rate, which the build floors before the log: they carry `z_newc = -6.549`).
- `META.model.W[K] = META.fees[K] / META.fees_tot * META.model.TIER[K]` exactly, where `TIER` is a discount by evidence grade (`GRADE` B -> 1.0, C -> 0.75, D -> 0.5); the weights sum to 0.787, not 1.
- `idx` = percentile rank (0 to 100) of `sum W[K] * z_K` among residential ZIPs; `idx_eq` = the same with equal weights.
- `eff = fees / cpc_rel`; `effb` and `oppb` = percentile ranks of `eff` and `fees`; `tier` from `effb` (cuts 95, 85, 65, 40, 15); `bid` from `tier`; `quad` from `oppb` and `comp_pct` (cut 60); `gicls` from `gi` (cuts 1.645, 1.96, 2.576).
- `r_K` is close to `(p_K + 2500 * parish rate) / (pop + 2500) * 10,000` (median deviation 0.7 percent).
- `res_ok = 1` exactly when `pop >= 500`; all model columns (`idx`, `tier`, `quad`, `bid`...) are null for the other 93 ZIPs.

## Other data keys read by my sections (index)

| Key | Read in | Detail in section |
|---|---|---|
| `meta` (`META`), `meta.compiled` | 00_core 569; 10_watch 2203 | 1.3, 11.3 |
| `meta.model.REG` | 00_core 577 (`REGN`); 02_map 993; 11_nws 2453 | 1.3 |
| `meta.model.FEE`, `.REP`, `.VAL` | 09_sl_model 2146-2160 | 10.3 |
| `zcols`, `zrows` | 00_core 570, 579 | 1.3 |
| `parishes[]`: `fips`, `name` | 00_core 571-573 | 1.3 |
| `parishes[]`: `reg`, `hu`, `pop` | 02_map 993 (`parishTip`) | 3.3 |
| `cities`, `places`, `comp`, `routes`, `rlist`, `sids`, `ptflags`, `pts` | 00_core 582-591 (unpacked into globals) | 1.3 |
| `places[]`: `name, lat, lon, pop` | 02_map 872-874 | 3.3 |
| `geo` (`W, H, minx, maxy, kx, sx, outline, neighbors, parish, zcta, water, pcent`) | 02_map 867-898 | 3.3 |
| `seg[]` (10 positional fields) | 02_map 879 | 3.3 |
| `comp[]`: `name, domain, url, tier, hq, cities, offices, lines, verified, spanish, title, desc, h1, social, notes, asof` | 10_watch 2208 | 11.3 |
| `ts.fema_year` (positions 3, 5, 6) | 00_core 615 | 1.3 |
| `ts.month.{hail, wind, torn}`, `ts.trop_month` | 09_sl_model 2129-2136 | 10.3 |
| `window.__NWS_SNAPSHOT__` | 11_nws 2372 | 12.3 |
| Not read anywhere in my range | `hosp`, `agez`, `rhist`, `zstorm`, `ts.hour`, `ts.year`, `ts.dowhour`, `ts.replace_hist`, `ts.ppi`, `ts.permits`, `ts.ytd26`, `ts.ytd25`, `ts.agehist`, and every `meta` key other than `compiled` and `model.{REG, FEE, REP, VAL}` (`nzip, nres, npar, pop, hu, occ, own, rent, mh, u1, yb, yb_med, seas, mort_sh, roofs, ra15, ra20, wave, nxt, npts, nstorm, nhosp, ncomp, ncomp_ver, cbp, nes, lic, ahs, fort, pools, cases, fees, fees_tot, model.{W, corr, sens, val, valpts, GRADE, TIER, DMA, P2R, DMG, WB, ANCH}`) | read only by the modules after line 4986 |

Browser storage keys used in my range: `up.theme` (747), `up.brand.v1` (787), `up.slm.v1` (2163), `up.watch.v1` (2203), `cf.accounts.v1` (2476), `cf.cms.v1` (2893).


---

## 0. Head and stylesheet (lines 1-558)

### 0.1 What it is
Static `<head>`, one `<style>` block (lines 9-551), and the body shell (lines 553-557): a top bar, a module rail, an empty `<main id="modules">` and a footer. All visible module content is created by JavaScript. Two data scripts follow at 558-561 (line 559 `window.__ATLAS_DATA__ = {...}`, line 560 `window.__NWS_SNAPSHOT__ = {...}`).

| Line | Element | Exact content |
|---|---|---|
| 2 | `<html lang="en">` | |
| 6 | `<title>` | `Uplift Roofing Atlas` (later overwritten at line 825 by `BRANDX.apply`) |
| 7 | `<meta name="description">` | `Louisiana roofing demand intelligence for all 64 parishes: roof age by ZIP, hail, wind and hurricane exposure, FEMA damage, eleven residential and commercial service lines, heatmaps for ads and SEO, licensing and insurance law, competitors, campaigns, pages and compliance.` |
| 8 | Fonts (Google Fonts, the only external stylesheet) | `Barlow Semi Condensed` 400/500/600/700/800 (display), `IBM Plex Mono` 400/500/600 (mono), `Public Sans` 400/500/600/700 + italic 400 (body) |
| 554 | `<header class="shell-top">` | `.brandmark` (filled by `BRANDX.apply`, line 819-824) and `#shellFacts` (filled by 99_shell.js at lines 9654-9655, outside my range) |
| 555 | `<nav class="rail" id="rail" aria-label="Modules">` | tab list filled by the shell |
| 556 | `<main id="modules">` | one `<section id="mod-KEY">` per module, created by the shell |
| 557 | `<footer class="shell-foot">` | three spans, see 0.3 |

### 0.2 Stylesheet: tokens and classes later code depends on
- Theme: light by default; dark via `@media (prefers-color-scheme:dark)` guarded by `:root:not([data-theme="light"])` (line 30) and again under `:root[data-theme="dark"]` (line 45). `toggleTheme()` (line 747) sets `data-theme`.
- Colour tokens (lines 12-23, dark 32-42 and 47-57): `--bg --card --sunk --sunk-2 --line --line-strong --ink --ink-2 --ink-3 --ink-inv --navy --navy-2 --navy-ink --navy-mute --accent (#b0502a light, #e2895b dark) --accent-ink --accent-soft --lime --bench --bench-soft --judg --judg-bg --gap --gap-bg --note --note-bg --good --warning --serious --critical --water --road --county --nodata --grid --nbr --nbr-line --s1..--s8 (categorical series) --heat --cool`.
- Storm-track tokens: `--track-h:#9c2f2a` (hurricane leg), `--track-t:#d0892a` (tropical storm leg), `--track-d:#8d8578` (depression leg) at lines 23, 42, 57; used by `.mapsvg .rseg.sH/.sT/.sD` at lines 508-510.
- Fonts as tokens (lines 26-28): `--display` Barlow Semi Condensed, `--sans` Public Sans, `--mono` IBM Plex Mono.
- Grade chips `.g .g-a .g-b .g-c .g-d` (lines 164-168): the A to D evidence grade printed by `G()` (line 624).
- Tier chips `.tier .tAp .tA .tB .tC .tD .tE` (lines 222-223) and quadrant text colours `.q0 .q1 .q2 .q3` (line 224): classes for ZIP tier values `A+`,`A`,`B`,`C`,`D`,`E` and quadrant 0..3.
- Map classes (lines 229-248 and 499-523, the second block is headed `/* ---------- Louisiana map layers ---------- */` at line 499):
  - `.z` ZIP polygon, `.z.sel`, `.z.dim`; `.pf` parish fill polygon (`.sel`, `.dim`) lines 502-505; `.cty` parish border line (238); `.outl` state outline (239); `.wt` water polygons (242); `.nb` neighbouring-state polygons (501).
  - `.mapsvg{background:var(--water)}` (line 500): the SVG background is the water colour, so everything outside the state and the neighbour polygons reads as sea (the Gulf of Mexico in this edition).
  - `.rseg` track leg, with class by storm class `.sH` hurricane, `.sT` tropical storm, `.sD` depression (508-510); `.rseg.sI`, `.rseg.sUS` (507, 511) and `.rd`, `.rd.i` (240-241) are road styles left from an earlier road-based build (no code in my range emits them; the "roads" layer `gR` now carries storm tracks); `.rhit` invisible wide hit stroke (513), `.segthin`, `.segnone` (516-517); `.pt` storm report dot (519); `.pin`; `.cdot` city dot; labels `.lab`, `.lab.mj` (major city), `.lab.sm`, `.lab.ct` (parish label, mono uppercase).
- Module-specific CSS blocks are named in comments: `module 12: service lines` (369), `module 13: competitor watch` (379), `module 14: weather desk` (416), `brand shell, panel` (435), `module 15: accounts` (444), `service lines, law and calculators` (525).

### 0.3 LOUISIANA-SPECIFIC CONTENT in lines 1-558
| Line | Text |
|---|---|
| 7 | Meta description: `Louisiana roofing demand intelligence for all 64 parishes: [...] hail, wind and hurricane exposure, FEMA damage, eleven residential and commercial service lines [...] licensing and insurance law [...]` |
| 23, 42, 57 | `--track-h`, `--track-t`, `--track-d` hurricane / tropical storm / depression track colours |
| 499 | CSS comment `Louisiana map layers` |
| 502-505 | `.pf` = "parish fill" (class name only) |
| 508-510 | `.rseg.sH`, `.sT`, `.sD` hurricane track leg styles |
| 557 | Footer span 1: `Compiled October 6, 2026 from public data: U.S. Census Bureau (ACS 2020 to 2024, Business Patterns, Nonemployer Statistics, Building Permits, American Housing Survey), NOAA (Storm Events, SPC, NHC HURDAT2 and 2026 best tracks, NWS), FEMA OpenFEMA, BLS producer prices via FRED, legis.la.gov, the LSLBC and the Louisiana Department of Insurance.` |
| 557 | Footer span 2: `Model figures are estimates and carry an A to D grade.` Span 3: `Research material, not legal or insurance advice. No keyword or Ahrefs data was pulled for this build.` |
| 559 (first 200 chars only) | `window.__ATLAS_DATA__ = {"zcols":[...` |
| 560 (first 200 chars only) | `window.__NWS_SNAPSHOT__ = {"fetched":"2026-10-06T05:42:39+00:00","source":"api.weather.gov (NWS New Orleans/Baton Rouge LIX, Lake Charles LCH, Shreveport SHV, Jackson JAN offices); NHC; SPC","points":...` |

Brand names: the product is `Uplift` / `Uplift Roofing Atlas` (line 6, 821, 825) and `Uplift Louisiana Roofing Atlas` (line 820). The footer compile date `October 6, 2026` is hard-coded text at line 557 and is also `META.compiled` = `"2026-10-06"`.

### 0.4 California changes
- Line 7: rewrite the description (58 counties, no parishes; replace "hurricane exposure, FEMA damage" with the California hazard set; the number of service lines must match the new `PL`).
- Line 557: rewrite the source list (replace `NHC HURDAT2 and 2026 best tracks`, `legis.la.gov`, `the LSLBC`, `the Louisiana Department of Insurance` with the California sources actually used, e.g. CSLB, California Department of Insurance, CAL FIRE, leginfo.legislature.ca.gov) and the compile date.
- Lines 23/42/57 and 508-510: the three "track" colours and `.sH/.sT/.sD` classes exist only for tropical-cyclone legs. If the California map carries line features (for example wildfire perimeters are polygons, not legs; atmospheric-river axes or wind corridors could be legs) the class set must be redefined together with `SEGS.cls` (line 879).
- Line 499 comment and the `.pf` naming are cosmetic.
- Open question: whether the California edition keeps the name `Uplift` (the mark at line 811-814 is explained as "uplift is how a roof fails", a wind metaphor).

---

## 1. 00_core.js (lines 562-764)

### 1.1 What it is
The foundation every other section and module uses: it unpacks `window.__ATLAS_DATA__` into named globals, defines number/date formatters, the house copy cleaner, colour ramps and scales, tooltip and toast, file saving (CSV, ZIP archive builder), HTML builders (masthead, cards, KPI tiles, sortable table), the event bus, the theme toggle and the module router. It is all top-level `const`/`function` in classic scripts, so every name is a page global.

### 1.2 Globals and helpers defined (used by later sections and modules)

Data globals
| Name | Line | Meaning |
|---|---|---|
| `DATA` | 568 | `window.__ATLAS_DATA__` or, failing that, `JSON.parse(document.getElementById('atlas-data').textContent)` |
| `META` | 569 | `DATA.meta` |
| `ZC` | 570 | `DATA.zcols` (165 column names) |
| `PA`, `PAI`, `FIPS` | 571-572 | `DATA.parishes` (each given `.i` = its index), lookup by `fips`, list of FIPS codes |
| `PNAME(f)` / `CNAME` | 573-574 | parish name for a FIPS; `CNAME` is an alias, comment at 574: `/* the parish is Louisiana's county */` |
| `CO`, `COI` | 575-576 | aliases of `PA`, `PAI` (county-named aliases kept "for reused code") |
| `REGN`, `REG_KEYS` | 577-578 | `META.model.REG` (region number to name) and its numeric keys |
| `Z` | 579 | array of ZIP objects: `DATA.zrows` rows zipped with `ZC` |
| `ZI` | 580 | ZIP object by `zip`; the same loop adds `z.fips` and `z.cty` (parish FIPS and name from `PA[z.pi]`), sets `z.occ = z.hh` (the `occ` column is overwritten by `hh`), and fills an empty `z.city` with the parish name |
| `ZR` | 581 | `Z.filter(z => z.res_ok && z.idx != null)`; comment: `// residential ZIPs scored by the models (500+ residents)` |
| `CITIES`, `CITYI` | 582 | `DATA.cities`, lookup by `name` |
| `PLACES` | 583 | `DATA.places` |
| `COMP` | 584 | `DATA.comp` |
| `BENCH` | 585 | `null`; comment `/* no company is assumed; set yours in the Company panel */` |
| `RT`, `RTI` | 586 | `DATA.routes`, lookup by `r.r` (label such as `"Ida 2021"`); comment: `/* named storms 2002 to 2026 with a Louisiana wind footprint */` |
| `RLIST` | 587 | `DATA.rlist` (38 storm labels in order) |
| `SIDS` | 588 | `DATA.sids`; comment: `/* every storm in the ZIP footprints: [name, year, Louisiana category, peak Louisiana wind kt] */` |
| `PTF` | 589 | `DATA.ptflags`; comment `/* storm report flag bit order */` |
| `PTS` | 591 | `DATA.pts` rows mapped to `{lat, lon, y, m, dw, h, k, mag, b, pi, zi, dmg}`; comment at 590: `/* NOAA Storm Events reports 2016 to 2026: k = 0 hail (mag inches), 1 thunderstorm wind (mag knots), 2 tornado (mag EF) */` |
| `ptHas(p, k)` | 592 | true when report `p` has flag `k` set: bit index = `PTF.indexOf(k)` of `p.b` |
| `LINE_KEYS` | 593 | `['replace','repair','storm','hail','fortified','metal','mh','mf','comm','coat','newc']` (the eleven service lines; these keys are the suffixes of the ZIP columns `p_*`, `r_*`, `z_*`, `f_*` and of `META.pools/cases/fees/model.*`) |
| `RES_LINES` | 594 | `['replace','repair','storm','hail','fortified','metal','mh']` |
| `COM_LINES` | 595 | `['mf','comm','coat','newc']` |
| `YEARS_F` | 596 | `[2016..2026]` (the storm-report years) |
| `routeLabel(r)`, `routeShort(r)` | 597-598 | identity functions returning the label as a string (apparently kept from an earlier template in which "routes" were roads) |
| `catLab(c)` | 599 | `null or <0` -> `'below storm force'`, `0` -> `'tropical storm'`, else `'Category ' + c` |
| `ktMph(kt)` | 600 | knots to mph, `Math.round(kt * 1.15078)` |
| `FEMA_INS` | 615 | `{n, own, ins, sh, ownSh}` summed over `DATA.ts.fema_year`; see 1.3 |

Formatting and maths
| Name | Line | Meaning |
|---|---|---|
| `$(s, r)`, `$$(s, r)` | 602-603 | querySelector / querySelectorAll as array |
| `nf` | 604 | `Intl.NumberFormat('en-US')` |
| `isN(v)` | 605 | finite number test (also true for numeric strings) |
| `N(v)` | 606 | rounded integer with thousands separators, `'—'` if not a number |
| `D(v, d=1)` | 607 | fixed decimals |
| `S(v, d=1)` | 608 | signed with `+` or true minus `−` |
| `dateL(iso)`, `dateS(iso)` | 610-611 | `October 6, 2026` / `Oct 6` |
| `DS(v, d=2)` | 613 | decimal with true minus, no plus |
| `inTen(v)` | 616 | percent to words: `'about four in ten'` |
| `P(v, d=1)` | 617 | percent string |
| `M$(v)` | 618 | `$` + integer |
| `MM(v)` | 619 | compact money `$1.23B`, `$4.5M`, `$12K` |
| `K(v)` | 620 | compact count `1.23M`, `12k`, `1.2k` |
| `esc(s)` | 621 | HTML escape |
| `cssv(n)` | 622 | computed CSS custom property |
| `isDark()` | 623 | theme test |
| `G(g)` | 624 | grade chips for `'A'`, `'B/C'` etc. |
| `clamp, sum, mean, median, pctRank, pearson` | 625-630 | numeric helpers (`pctRank(arr, v)` = percent of values below `v`) |
| `slug(s)` | 631 | lower-case, hyphenated, max 70 chars |
| `el(tag, attrs, html)`, `svgEl(tag, attrs, text)` | 632-633 | DOM builders |
| `debounce(fn, ms)` | 634 | |
| `store.get(k, d)`, `store.set(k, v)` | 635 | JSON in `localStorage`, wrapped in try/catch |

House copy style
| Name | Line | Meaning |
|---|---|---|
| `DASH_RE` | 639 | regex matching any hyphen or dash |
| `houseClean(s)` | 640-649 | removes every dash from outgoing copy: em/en dash -> `, `; `1-2` -> `1 to 2`; `I-10` -> `Interstate 10`; `US-90`/`LA-1` -> `US 90`/`LA 1` (line 645, regex `\b(US\|LA)-(\d+)\b`); `word-word` -> `word word` |
| `phoneFmt(p)` | 650 | US phone as `(225) 756 3100` (no dash) |

Colour
| Name | Line | Meaning |
|---|---|---|
| `RAMPS` | 654-660 | 8-step sequential ramps `green` (actually terracotta), `teal`, `lime` (grey-green), 9-step diverging `div`; each has light `l` and dark `d`; aliases `ember = green`, `blue = teal` |
| `ramp(name)` | 661 | ramp for the current theme |
| `CAT()` | 662 | the eight categorical colours `--s1..--s8` |
| `textOn(hex)` | 663 | black or white text for a fill |
| `qScale(vals, rampName, dir)` | 665-672 | quantile scale into 8 classes; returns `{f, breaks, R, lo, hi}`; `dir -1` inverts |
| `divScale(vals, center)` | 673-678 | diverging scale around `center` |
| `catScale(keys, colors)` | 679 | categorical lookup |

Tooltip, toast, files
| Name | Line | Meaning |
|---|---|---|
| `TIP`, `showTip(html, e)`, `hideTip()`, `tipRow(l, v)` | 682-685 | the single `#tip` tooltip |
| `TOAST`, `toast(msg)` | 686-687 | status toast (2.6 s) |
| `inViewer()` | 690 | true inside the claude.ai artifact viewer (`window.claude.use`) |
| `saveFile(filename, data)` | 691-699 | saves through the viewer's `downloads` capability or a Blob link; MIME by extension |
| `csvQ(v)`, `toCSV(header, rows, note)` | 700-701 | CSV with optional `# ` comment lines on top |
| `crc32(u8)`, `zipBlob(files)` | 702-716 | store-only ZIP archive builder (`files = [{name, data}]`) |
| `copyText(text, btn)` | 717-720 | clipboard |

UI builders and router
| Name | Line | Meaning |
|---|---|---|
| `kpiHTML(items)` | 723 | items `{l, v, d, g}` |
| `mastHTML(o)` | 724-727 | masthead + sticky bar: `{eyebrow, title, dek, meta[], bar, barsub, actions[{id,label,title}]}`; always adds the `◐ Theme` button |
| `callout(kind, title, html)` | 728 | kinds `''`, `gap`, `judg`, `note`, `tight` |
| `card(title, sub, body, cls)` | 729 | |
| `srcRows(rows)` | 730 | rows `[label, source, grade, vintage, url]` |
| `judgList(items)` | 731 | definition list |
| `proseTable(rows, head)` | 732 | |
| `dataTable(host, cols, rows, opts)` | 734-742 | sortable table; `cols[{k,h,l,t,v,f,cls,raw}]`, `opts{sortKey,sortDir,limit,rowClass,id,onClick}` |
| `wireSeg(host, cb)` | 743 | segmented buttons |
| `BUS.on(e, f)`, `BUS.emit(e, d)` | 746 | event bus; events seen in my range: `'theme'`, `'brand'` |
| `toggleTheme()` | 747 | stores `'up.theme'` |
| `MODS`, `MODI`, `registerModule(m)` | 751-752 | module registry; a module is `{key, mount(sec), receive?(payload), onShow?()}` plus whatever the shell reads |
| `showModule(key, payload)`, `goModule` | 753-763 | shows `#mod-KEY`, mounts once, sets `location.hash = '#' + key`; any element with `data-go="KEY"` navigates (line 749) |

### 1.3 DATA CONTRACT (what 00_core.js reads)

Top-level keys of `window.__ATLAS_DATA__`
| Key | Line | Shape in the Louisiana file | Use |
|---|---|---|---|
| `meta` | 569 | object, 35 keys (`la_meta.json`) | `META` |
| `meta.model.REG` | 577 | `{"1":"Greater New Orleans","2":"Capital Region","3":"Bayou and River Parishes","4":"Acadiana","5":"Southwest","6":"Central","7":"Northwest","8":"Northeast","9":"Northshore and Florida Parishes"}` | `REGN`; comment: `/* region number -> name (LDH regions, which line up with the media markets) */`. Keys are converted with `Number` for `REG_KEYS`, so region ids must be numeric strings |
| `zcols` | 570 | 165 strings | column order for `zrows` |
| `zrows` | 579 | 534 arrays of 165 values | one per ZIP (ZCTA) |
| `parishes` | 571 | 64 objects; fields read here: `fips` (5-digit string, e.g. `"22001"`), `name` (without the word "Parish", e.g. `"Acadia"`) | `PA`, `PAI`, `PNAME` |
| `cities` | 582 | 265 objects keyed by unique `name` | `CITIES`, `CITYI` |
| `places` | 583 | 171 objects `{name, lat, lon, pop, cdp}` | `PLACES` (map labels) |
| `comp` | 584 | 29 competitor objects | `COMP` |
| `routes` | 586 | 38 objects; field read here: `r` (unique label `"Name YYYY"`) | `RT`, `RTI` |
| `rlist` | 587 | 38 labels | `RLIST` |
| `sids` | 588 | 119 arrays `[name, year, category, peak wind kt]` (category `-1` below storm force, `0` tropical storm, `1..5` hurricane) | `SIDS` |
| `ptflags` | 589 | `['h1','h175','h2','w58','w75','ef1','dmg','night','measured','hurr','trop']` | bit order of `pts[].b` |
| `pts` | 591 | 5,115 arrays of 12: `[lat, lon, year, month, day-of-week, hour, kind, magnitude, flag bits, parish index, ZIP index, damage]` | `PTS`. `kind` 0 hail (mag in inches), 1 thunderstorm wind (mag in knots), 2 tornado (mag = EF). `pi` indexes `DATA.parishes`, `zi` indexes `DATA.zrows` (`-1` when the report is in no ZIP; module 02 tests `p.zi >= 0` at line 5732). `dmg` = NOAA property damage estimate in thousands of dollars (not stated in my range; module 02 prints `MM(p.dmg * 1000)` at line 5431) |
| `ts.fema_year` | 615 | 18 arrays `[disaster number, label, year, registrants, flag, owners, insured]`, e.g. `["1603","Katrina",2005,171245,true,120782,86006]` | `FEMA_INS`: `n = sum a[3]`, `own = sum a[5]`, `ins = sum a[6]`, `sh = ins/n*100`, `ownSh = ins/own*100`. Comment at 614: `/* FEMA roof and wind registrants who reported homeowners insurance (OpenFEMA IHP), and a plain words share (about four in ten) */`. Element `a[4]` (boolean) is not read in my range; module 02 (line 5682) labels it `a[4] ? 'roof damage' : 'wind loss'`, i.e. which OpenFEMA damage measure the count uses (true for the disasters up to 2017, false from 2020) |

ZIP columns read in 00_core.js
| Column | Line | Use |
|---|---|---|
| `zip` | 580 | key of `ZI` |
| `pi` | 580 | index into `DATA.parishes`; gives `z.fips`, `z.cty` |
| `hh` | 580 | copied over `z.occ` (`z.occ = z.hh`) |
| `occ` | 580 | overwritten (the stored `occ` column is never visible to later code) |
| `city` | 580 | kept; if empty replaced by the parish name |
| `res_ok` | 581 | 1 = ZIP is scored as residential ("500+ residents") |
| `idx` | 581 | demand index; must be non-null for the ZIP to be in `ZR` |

Derived ZIP keys created here: `z.fips`, `z.cty` (line 580).

### 1.4 LOUISIANA-SPECIFIC CONTENT in 00_core.js
| Line | Item |
|---|---|
| 571-576 | Naming: `DATA.parishes`, `PA`, `PAI`, `PNAME`; comment 574 `the parish is Louisiana's county`; the aliases `CNAME`, `CO`, `COI` already exist for county-named code |
| 577 | Comment: `region number -> name (LDH regions, which line up with the media markets)` (LDH = Louisiana Department of Health administrative regions); the nine region names live in the data (`META.model.REG`), not in code |
| 586 | Comment: `named storms 2002 to 2026 with a Louisiana wind footprint` (`DATA.routes`) |
| 588 | Comment: `every storm in the ZIP footprints: [name, year, Louisiana category, peak Louisiana wind kt]` (`DATA.sids`) |
| 590 | Comment: `NOAA Storm Events reports 2016 to 2026: k = 0 hail (mag inches), 1 thunderstorm wind (mag knots), 2 tornado (mag EF)` |
| 593-595 | Service line keys `storm`, `hail`, `fortified` are tied to the Gulf hazard set and the Louisiana FORTIFIED grant programme |
| 596 | `YEARS_F = [2016, ..., 2026]` |
| 599 | `catLab`: `'below storm force'`, `'tropical storm'`, `'Category ' + c` (Saffir-Simpson wording) |
| 600 | `ktMph` exists because storm winds are stored in knots |
| 614-615 | `FEMA_INS` and its comment (FEMA Individuals and Households Program roof and wind registrants) |
| 645 | `houseClean`: `.replace(/\b(US\|LA)-(\d+)\b/g, '$1 $2')` (Louisiana state highway prefix `LA-`) |

### 1.5 California changes
- Keep the key names `parishes`, `pi`, `PA`, `PNAME` if you want zero code churn (a county is then "a parish" in code only), or rename throughout; the visible word "Parish" is produced elsewhere (for example line 993 `${esc(p.name)} Parish`), not here.
- `META.model.REG` must carry the California region set (numeric string keys); every `reg` value in ZIP rows and county rows must be one of those keys.
- Line 645: change `LA` to `CA` (and decide on `SR-`, `Hwy`), otherwise `CA-1` in copy becomes `CA 1` only through the generic `(\w)-(\w)` rule (it still loses the dash, so the effect is the same; the explicit rule only matters for readability of the code).
- `catLab`, `ktMph`, `RT/RTI/RLIST/SIDS`, `SEGS` and `DATA.ts.fema_year` are the tropical-cyclone data model. A California build must either supply the same structures with a different event type (for example named atmospheric-river or wind events, wildfires with FEMA declarations) or supply empty arrays and remove the readers. `FEMA_INS` divides by `n`; with an empty `fema_year` it yields `sh: null`, `ownSh: null` without error.
- `PTS` kinds 0/1/2 (hail, thunderstorm wind, tornado) and `ptflags` (`hurr`, `trop` are tropical flags) need a California definition (wind, hail, heavy rain/debris flow, wildfire?).
- `ZR` requires `res_ok` and non-null `idx`. With about 1,760 ZIPs the 500-resident rule (comment at 581) should be restated with the California count.
- Settled only by looking outside my range (lines 5431, 5682): `pts[].dmg` is in $ thousands and `ts.fema_year[i][4]` flags the FEMA measure (roof damage vs wind loss).

---

## 2. 01_brand.js (lines 765-860)

### 2.1 What it is
The "Company" record of the roofer the atlas is used for. Brand neutral by default: nothing is named until the user fills the Company panel. The record is kept in `localStorage` under `up.brand.v1` and flows into the shell header, the ad and page generators, the compliance rules and the connectors. Reads nothing from `window.__ATLAS_DATA__`.

### 2.2 Globals
| Name | Line | Meaning |
|---|---|---|
| `BRAND_DEFAULT` | 773-786 | default record, see fields below |
| `BRAND` | 787 | live record = defaults merged with `store.get('up.brand.v1')` (one level deep for `colors`, `fonts`, `reviews`, `social`, `pixels`) |
| `brandSet()` | 788 | true when `BRAND.name` is non-empty |
| `brandName()` | 789 | `BRAND.name` or `'Your company'` |
| `brandShort()` | 790 | `BRAND.short \|\| BRAND.name \|\| 'Your company'` |
| `brandOffices()` | 791 | `[BRAND.city]` plus `BRAND.offices` split on comma/semicolon, de-duplicated |
| `BRANDX.apply()` | 816-827 | injects `<style id="brand-style">`, loads custom Google fonts, fills `.brandmark`, sets `document.title`, emits `BUS 'brand'` |
| `BRANDX.save(patch)`, `BRANDX.reset()` | 828-829 | persist / restore defaults |
| `BRANDX.addr()` | 830 | `street, city, ST zip` one-line address |
| `BRANDX.panel()` | 832-856 | the Company settings dialog (`#brandPanel`) |
| `BRANDX.fallbackLogo(size)` | 812-815 | inline SVG mark |
| `BRANDX.css()` | 799-810 | CSS overrides computed from `BRAND.colors` and `BRAND.fonts` |
| `BRANDX.B` | 857 | getter for `BRAND` |

`BRAND` fields (line 773-786): `name, short, legal, tagline, phone, url, domain, email, contact, lic, licClass, juris, street, city, state, zip, lat, lon, offices, hours, founded, languages, warranty, financing, certs, fortified, colors{primary '#b0502a', secondary '#e2895b', accent '#efc6ab', dark '#1e2933'}, fonts{display 'Barlow Semi Condensed', body 'Public Sans'}, logoUrl, logoData, reviews{rating, count, asOf, source}, social{facebook, facebookPageId, instagram, youtube, linkedin, tiktok, x, maps, nextdoor}, pixels{meta: []}, serviceCities: []`.

### 2.3 DATA CONTRACT
None: no field of `__ATLAS_DATA__`, `META` or the weather snapshot is read. Browser storage key: `up.brand.v1`.

### 2.4 LOUISIANA-SPECIFIC CONTENT
| Line | Text or constant |
|---|---|
| 770-772 | Comment: `The name, LSLBC license number and classifications, qualifying party, office cities, colors and links flow into the shell, the Campaign Desk, the Site Forge, the Compliance Satchel and the connectors.` |
| 776 | `juris: 'Louisiana'` |
| 777 | `state: 'LA'`, `lat: 30.4515, lon: -91.1871` (default map point: Baton Rouge) |
| 779 | `fortified: ''` (a field for IBHS FORTIFIED status) |
| 811 | Comment on the mark: `a roof ridge lifting off its walls, wind lines underneath (uplift is how a roof fails, and how a company grows)` |
| 820 | Header subtitle when a company is set: `` `Uplift Louisiana Roofing Atlas · ${esc(BRAND.city \|\| 'Louisiana')}${BRAND.lic ? ' · LSLBC license ' + esc(BRAND.lic) : ''}` `` |
| 820 | Header subtitle when no company is set: `'Roofing demand intelligence for all 64 parishes: roof age, storms, eleven service lines, ZIP heatmaps for ads and SEO'` |
| 821 | Header name fallback `'Uplift'` |
| 825 | `document.title` = `` `${brandShort()} · Uplift Roofing Atlas` `` or `'Uplift Roofing Atlas'` |
| 837 | Panel title `Company: the roofer this atlas works for`; paragraph: `Brand neutral until you fill it in. Since August 1, 2026 anyone who advertises, solicits, quotes, bids or performs residential roofing worth $7,500 or more must hold the LSLBC Residential Roofing or Residential Construction classification (Act 757 of 2026); the Desk, the Forge and the Satchel read the license from here. Saved in this browser only.` |
| 838 | Field label `Company name (as licensed with the LSLBC)`; hint `Use the name on the license and the contracts; a trade name that differs from the licensed name confuses license lookups.` Field `Qualifying party or owner, full name`; hint `The person who answers for the license; shown on the About page and in the Satchel checks.` |
| 839 | Field `LSLBC license number`; hint `Consumers verify it on the LSLBC Contractor Search. The Satchel flags residential roofing ads that carry no license reference.` |
| 839 | Field `License classifications`; hint `For example: Residential Roofing; Residential Building; Commercial: Roofing and Sheet Metal.` |
| 839 | Field `States licensed`; hint `Louisiana plus any other state where you hold a contractor license.` |
| 843 | Field `Languages served`; hint `Spanish and Vietnamese pages and ads are built only when you serve those languages.` |
| 843 | Field `Manufacturer certifications (exact program names)`; hint `Only programs you currently hold. The Satchel blocks certification claims that are not listed here.` (generic) |
| 844 | Field `FORTIFIED status`; hint `For example: FORTIFIED Roof certified roofer (IBHS). Leave blank if not certified.` |
| 844 | Field `Financing statement (optional)`; hint `Lender name and the required disclosure if ads mention payments or rates (Regulation Z).` (federal, keep) |

### 2.5 California changes
- Line 776-777: `juris: 'California'`, `state: 'CA'`, default `lat/lon` to a California point (for example Sacramento 38.58, -121.49).
- Lines 820, 821, 825: product name and the "all 64 parishes" subtitle ("all 58 counties"); `LSLBC license` becomes `CSLB license` (California Contractors State License Board; the roofing classification is C-39).
- Line 837-839: the licensing paragraph and all LSLBC wording. California facts to substitute must be researched and cited by the content owner (CSLB licence threshold, C-39 Roofing classification, qualifying individual "RMO/RME/qualifier", the CSLB "Check a License" lookup, home improvement salesperson registration); nothing in the code computes from these strings, they are labels and hints only.
- Line 843: `Spanish and Vietnamese` reflects the Louisiana language columns `span_sh`, `viet_sh`, `french_sh`; California's language set differs (Spanish, Chinese, Vietnamese, Tagalog, Korean...). Whatever replaces `viet_sh`/`french_sh` in the ZIP table should drive this hint.
- Line 779/844: the `fortified` field only makes sense if a FORTIFIED service line survives. A California analogue would be a wildfire-hardening credential (for example a Class A / WUI Chapter 7A roof, "Safer from Wildfires"), which is a decision for the service-line redesign, not something the code can answer.
- Question: `BRAND.lat/lon` is described as "map point"; where it is drawn is outside my range.

---

## 3. 02_map.js (lines 861-994)

### 3.1 What it is
The offline SVG map. Header comment (line 866): `Louisiana map (SVG, offline): ZIPs, parishes, water, storm tracks, storm reports`. It defines the projection, the list of labelled cities, the storm track legs, the `ZipMap` class used by every module that shows a map, a legend builder and the parish tooltip.

### 3.2 Globals
| Name | Line | Meaning |
|---|---|---|
| `GEO` | 867 | `DATA.geo` |
| `proj(lon, lat)` | 868 | returns `[x, y]` in viewBox units |
| `PARISH_LABEL` | 869 | FIPS -> projected label point from `GEO.pcent` |
| `MAP_CITIES` | 870-876 | `[{name, x, y, major, tier, pop}]` chosen from `PLACES` |
| `SEGS` | 879 | storm track legs `[{i, r, d, v, cat, stc, p, t, lat, lon, pi, cls}]` from `DATA.seg` |
| `class ZipMap` | 880-989 | `new ZipMap(host, opts)` |
| `legendHTML(o)` | 990-992 | `{title, R (colour list), lo, hi, note}` -> legend HTML |
| `parishTip(f, rows)` | 993 | tooltip HTML for a parish; `rows = [[label, value]]` |

`ZipMap` options (line 882): `labels: true, parishLabels: false, roads: false, segHit: 'wide' ('thin' or 'none' add class seg+value), onSelect(zip), onHover(zip, e), aria: 'Map of Louisiana ZIP codes'`, and the optional callbacks read in `wire()` (lines 941-951): `onPinHover(id, e)`, `onParishHover(fips, e)`, `onSegHover(i, e)`, `onPtHover(i, e)`, `onPin(id)`, `onParish(fips)`, `onSeg(i)`, `onPt(i)`.

`ZipMap` methods: `unit()`, `apply()`, `zoomAt(mx, my, f)` (zoom 1 to 16), `reset()`, `fitBox(xs, ys, pad)` (zoom capped at 10), `fitTo(zips)`, `fitParishes(fipsList)`, `fitLL([[lat, lon]])`, `setMode('zip'|'parish')`, `fill(fn(zip) -> colour)`, `fillParish(fn(fips) -> colour)`, `dim(Set of zips)`, `dimParish(Set of fips)`, `select(zip)`, `selectParish(fips)`, `roads(fn(seg) -> {c, w, z, hide} | null)`, `showRoads(on)`, `selectSeg(i)`, `fitSeg(i)`, `fitRoute(label)`, `pins([{id, lat, lon, r, fill, op, shape: 'diamond'|'square'|circle, sel, title}])`, `points([{i, lat, lon, r, fill, op}])`, `setLabels(on)`, `setParishLabels(on)`.

SVG layer order, bottom to top (lines 888-889): `gN` neighbouring states, `gZ` ZIP polygons, `gPF` parish fill polygons (hidden unless parish mode), `gW` water, `gC` parish borders then the state outline, `gR` track legs plus their wide invisible hit strokes `gRH` (hidden unless `opts.roads` or `roads()`/`showRoads(true)` is called), `gT` storm report dots, `gP` pins, `gL` labels.

Label rules (lines 904-918): one label per parish at `GEO.pcent` (class `lab ct`, shown only with `parishLabels`), one per `MAP_CITIES` entry with a dot; tier 0 and 1 cities always (if `labels`), tier 2 only at zoom `k >= 2`; greedy collision hiding in screen space, priority by tier then population.

### 3.3 DATA CONTRACT

**The projection (line 868), exact:**
```js
function proj(lon, lat) { return [(lon - GEO.minx) * GEO.kx * GEO.sx, (GEO.maxy - lat) * GEO.sx]; }
```
An equirectangular (plate carree) projection with one standard parallel: `x = (lon - minx) * kx * sx`, `y = (maxy - lat) * sx`. North is up, units are SVG viewBox units.

**`DATA.geo` members (Louisiana values measured from the data):**
| Member | Value / format | Meaning |
|---|---|---|
| `W` | `2400.0` | viewBox width (line 884: `viewBox="0 0 W H"`) |
| `H` | `2182` | viewBox height |
| `minx` | `-94.1` | longitude of the left edge (x = 0) |
| `maxy` | `33.05` | latitude of the top edge (y = 0) |
| `kx` | `0.8571673007021123` | `cos(31.0 deg)` exactly: the cosine of the standard parallel (Louisiana's mid latitude) |
| `sx` | `523.3495613676255` | viewBox units per degree of latitude; equals `W / ((maxx - minx) * kx)` with `maxx = -88.75` (5.35 degrees of longitude); the bottom edge is then latitude `maxy - H/sx = 28.88` |
| `outline` | one string, 14.5 KB | state outline, many closed subpaths (islands) |
| `neighbors` | object `{Texas, Arkansas, Mississippi}` name -> path string, 4.7 KB total | neighbouring states clipped to the viewBox; only the values are drawn (line 890), the names are never shown |
| `parish` | object FIPS -> path string (64 keys, 60.6 KB) | used twice: fill polygons (`gPF`, line 894) and border lines (`gC`, line 897) |
| `zcta` | object ZIP -> path string (534 keys, 244 KB) | key set is identical to the `zip` column of `zrows`; up to 4 subpaths per ZIP |
| `water` | array of 443 path strings (184 KB) | lakes, bays, rivers drawn over the ZIP fills |
| `pcent` | object FIPS -> `[lon, lat]` | parish label point in geographic degrees (note the order: longitude first) |

**Path string format (all members, verified over every path):** only the commands `M`, `l`, `z`; integer coordinates; one absolute move then relative segments, each written as its own `l dx dy`; subpaths concatenated without separators. Example (ZIP 70113): `M1797 1626l5 -3l-4 -3l2 1l2 -1l-1 2l0 1l3 2l1 -2l-1 0l1 -1l0 1l2 -1l-1 3l-1 1l1 0l-2 3l-4 3l-1 -2l-1 0l-1 -4z`. Rough vertex counts: zcta 48.6k, water 36.4k, parish 11.9k, outline 2.8k. At this scale one unit is about 212 m north-south.

**`DATA.seg` (line 877-879), 432 rows.** Comment, exact: `/* storm track legs (HURDAT2 six hour fixes, 2002 to 2025, and NHC operational best tracks for 2026): label, path, mean sustained wind (kt), Saffir Simpson category of the leg, status code, central pressure, start time, midpoint, nearest parish */`
| Index | Name in `SEGS` | Example | Meaning |
|---|---|---|---|
| 0 | `r` | `"Rita 2005"` | storm label; equals `routes[].r` and an entry of `rlist` |
| 1 | `d` | `"M0 1335l0 -576"` | one straight leg per row: `M x y` + a single `l dx dy`, no `z`, integers, in the same projected units; not clipped (x runs from -1346 to 5024 and y from -3166 to 3847 against a 2400 x 2182 viewBox) |
| 2 | `v` | `55` | mean sustained wind of the leg, knots |
| 3 | `cat` | `1` | Saffir-Simpson category of the leg (`-1` below storm force, `0` tropical storm, `1..5`); 432 legs: 127 / 198 / 107 |
| 4 | `stc` | `"HU"` | HURDAT2 status code; values present: `TS` 179, `HU` 99, `TD` 82, `EX` 29, `LO` 20, `DB` 14, `SS` 9 |
| 5 | `p` | `949` | central pressure, mb |
| 6 | `t` | `"2005-09-24T12"` | start time of the leg (UTC hour) |
| 7, 8 | `lat`, `lon` | `31.05, -94.1` | midpoint |
| 9 | `pi` | `42` | index of the nearest parish in `DATA.parishes`, or `-1` when the leg is far from the state |
| derived | `cls` | `'H'` | `cat >= 1 ? 'H' : cat === 0 ? 'T' : 'D'` -> CSS class `rseg sH/sT/sD` |

**Other fields read**
| Field | Line | Use |
|---|---|---|
| `DATA.places[].name, lat, lon, pop` | 872-874 | city labels: kept when `pop >= 20000` or the name is in the `keep` list; `major` when `pop >= 90000`; tier 0 `>= 90000`, tier 1 `>= 30000`, tier 2 otherwise; a label is dropped when an already placed one lies within 70 (major) or 95 units in x and 30 units in y |
| ZIP columns `lat`, `lon` | 929 | `fitTo(zips)` projects ZIP centroids |
| derived `z.fips` | 930 | `fitParishes` |
| parish fields `name`, `reg`, `hu`, `pop` | 993 | `parishTip`: `${name} Parish`, `${REGN[p.reg]} · ${N(p.hu)} homes · ${N(p.pop)} residents` |
| `PNAME(f)` | 904 | parish label text |

### 3.4 LOUISIANA-SPECIFIC CONTENT
| Line | Item |
|---|---|
| 866 | Comment `Louisiana map (SVG, offline): ZIPs, parishes, water, storm tracks, storm reports` |
| 871 | `keep` list of place names always labelled (77 entries, `Natchitoches` appears twice): `New Orleans, Baton Rouge, Shreveport, Lafayette, Lake Charles, Monroe, Alexandria, Houma, Kenner, Bossier City, Metairie, Slidell, Hammond, Ruston, New Iberia, Natchitoches, Opelousas, Thibodaux, Covington, Laplace, Sulphur, Morgan City, Bogalusa, Minden, DeRidder, Leesville, Crowley, Jennings, Natchitoches, Pineville, West Monroe, Gonzales, Denham Springs, Zachary, Abbeville, Eunice, Plaquemine, Chalmette, Marrero, Mandeville, Bastrop, Tallulah, Winnfield, Many, Oakdale, Marksville, Ville Platte, Jonesboro, Homer, Farmerville, Vidalia, Jena, Columbia, Winnsboro, Rayville, Lake Providence, Franklinton, Amite City, Napoleonville, Donaldsonville, Port Allen, New Roads, Clinton, St. Francisville, Galliano, Cut Off, Raceland, Belle Chasse, Grand Isle, Cameron, Kaplan, Breaux Bridge, St. Martinville, Youngsville, Broussard, Scott, Carencro` |
| 872-874 | Population cut-offs tuned to Louisiana: label if `pop >= 20000`, major `>= 90000`, tier 1 `>= 30000` |
| 877-878 | Comment about HURDAT2 / NHC best tracks (quoted above) |
| 879 | `cls` H/T/D from the Saffir-Simpson category |
| 882 | Default aria label `'Map of Louisiana ZIP codes'` |
| 890 | Neighbour polygons (data: Texas, Arkansas, Mississippi) |
| 904, 916, 946, 957-963, 988, 993 | The word and concept "parish" in identifiers and option names: `parishLabels`, `kind: 'parish'`, `onParishHover`, `onParish`, `fillParish`, `dimParish`, `selectParish`, `setParishLabels`, `fitParishes`, `ppaths`, `gPF` |
| 993 | Tooltip text `` `${esc(p.name)} Parish` `` and `Click for the parish ledger` |

### 3.5 California changes
- Produce `geo` in exactly this format: pick the bounding box (California spans roughly longitude -124.5 to -114.1 and latitude 32.5 to 42.0), set `kx = cos(mid latitude)` (about `cos(37.25 deg) = 0.796`), choose `W`, compute `sx = W / ((maxx - minx) * kx)` and `H = round((maxy - miny) * sx)`; project every ring with `proj`, round to integers, drop zero-length segments, and write `M x y` + `l dx dy`... + `z`.
- Aspect ratio: Louisiana is 2400 x 2182 (landscape). California with the same recipe is portrait, about 2400 x 2760 (W:H about 0.87), and `.mapsvg{width:100%;height:auto}` (line 232) will make the map taller than a laptop screen at full card width. Either constrain the map card width / add a max height in CSS, or accept scrolling.
- Resolution: with `W = 2400` California gets about 291 units per degree, so one unit is about 380 m; small urban ZIPs in Los Angeles and San Francisco collapse to a few units. Raising `W` (for example 4800) fixes that, but the following constants are in viewBox units and assume `W = 2400`: label collision box 70/95/30 (line 874), `fitBox` pads 90, 140, 120, 80 (lines 925, 929, 931, 968, 969). Stroke widths and label/pin sizes are screen-constant and need no change.
- Size: 534 Louisiana ZIP paths are 244 KB; about 1,760 California ZCTAs will be roughly 0.8 to 1.5 MB at similar vertex density, and the map creates one `<path>` per ZIP per map instance (several modules create their own `ZipMap`). Simplify accordingly.
- `neighbors`: Oregon, Nevada, Arizona and Baja California (Mexico) clipped to the box; the Pacific is the SVG background.
- `water`: decide what to include (San Francisco Bay, Lake Tahoe, Salton Sea, Clear Lake, the Delta); islands (Channel Islands, Catalina) belong in `outline` and in the county/ZIP paths.
- `pcent`: 58 county label points as `[lon, lat]`; keys must equal `parishes[].fips` (`06001`...`06115`).
- Line 871 `keep` list and the population cut-offs: California has about 75 places over 100,000 people, so `pop >= 20000` would label hundreds; raise the thresholds (the collision test hides overlaps but the candidate list should still be sensible) and write a California `keep` list (county seats, desert and mountain towns that would otherwise be missed).
- `seg`/`SEGS`: only meaningful for a track-like hazard. If California has no legs, ship `seg: []` (then `spaths`/`hpaths` are empty and `roads()`, `selectSeg`, `fitRoute` do nothing); `fitSeg(i)` returns early when the leg is missing. Wildfire perimeters would need a new polygon layer (none exists).
- Text: line 882 aria label, line 993 `Parish` -> `County` and `parish ledger` -> `county ledger`.
- Looked up outside my range (pointers only): eleven modules create a `ZipMap` (`new ZipMap(` at lines 5114, 5410, 6157, 6362, 6518, 6787, 7636, 8172, 8301, 8621, 9464), so every ZIP path is instantiated up to eleven times as modules are opened; the track layer is switched on by module 02 (`roads: true` at line 5410, `.roads(` at 5476) and used at lines 5122 and 8177. What `pins` carry (competitor offices, hospitals, forecast points) is for the module contracts.

---

## 4. 03_charts.js (lines 995-1133)

### 4.1 What it is
Generic inline-SVG chart functions that read theme tokens. No field of the data and no Louisiana text is referenced; nothing here changes for California.

### 4.2 Globals
| Function | Line | Spec |
|---|---|---|
| `niceTicks(lo, hi, n)` | 1001 | 1-2-5 tick steps |
| `chartFrame(host, W, H, aria)` | 1009 | creates `<svg class="chart">` |
| `lineChart(host, spec)` | 1011-1049 | `{series:[{name,color,pts:[[x,y]],dash,area,width,dots,endLabel,fmt}], x:{min,max,ticks,fmt,label}, y:{min,max,fmt,label,zero,n}, W,H,L,R,T,B, vlines:[{x,label,dy}], hlines:[{y,label}], bands:[{x0,x1,label}], marks:[{x,y,color,label,dx,dy,anchor}], tipTitle, aria}` |
| `legendRow(items)` | 1050 | `[{name,color,sq,dash}]` |
| `barChart(host, spec)` | 1052-1076 | `{cats, series:[{name,color,values,fmt}], stacked, W,H,L,R,T,B, fmt, yLabel, yMax, rot, maxLabels, highlight(i,j), tipExtra(i), vlabel:[{i,y,t}], aria}` |
| `hbarChart(host, rows, spec)` | 1078-1088 | rows `[{l, v, color, t, tip}]`; spec `{W,rowH,L,R,max,min,aria}` |
| `scatter(host, spec)` | 1090-1111 | `{pts:[{x,y,c,r,op,lab,tip,onClick}], x:{label,fmt,min,max}, y:{...}, fit, labels, hlines, vlines, W,H,aria}`; returns `{r, b, a, n}` (Pearson r and least-squares line) |
| `coefPlot(host, rows, spec)` | 1113-1128 | rows `[{l,b,lo,hi,p,shap}]`; header default `Standardized effect (SD of outcome per SD of predictor), 95% interval`, right column `p · Shapley R²` |
| `corrMatrix(keys, labels, corr)` | 1129-1132 | HTML table; `corr[k1][k2]` (this is the shape of `META.model.corr`) |

### 4.3 Data contract, Louisiana content, California changes
None, none, none.

---

## 5. 04_content.js (lines 1134-1363)

### 5.1 What it is
The editorial core: the register of law (`LAWX`), the compliance rule summary (`ADRULES`), the eleven service lines with their model explanations, ad angles and keyword lists (`PL`), links to the statute pages (`LAWLINK`), common negative keywords (`NEG_COMMON`) and the token filler for copy (`fillCopy`). Header comment (line 1136): `content: service lines, Louisiana code, license and claims register, copy angles, keywords`.

Comment at lines 1138-1140, exact: `Copy that leaves the atlas carries no hyphen or dash and no meta notes (house style). Statements of Louisiana law below were read from the enrolled acts, resume digests and statutes on legis.la.gov, the LSLBC notices of July 13, 2026 and its licensing brochure, and federal rules on ecfr.gov, on October 6, 2026; each carries its citation. Research material, not legal or insurance advice.`

### 5.2 Globals
| Name | Line | Shape and meaning |
|---|---|---|
| `LAWX` | 1141-1189 | `{asof: '2026-10-06', items: [{id, t, cite, eff, g, lines[], url, s}], pending: [{t, s, g, src}]}`. `id` is referenced from `PL[].law`; `lines` are service-line keys; `g` is the A to D grade |
| `ADRULES` | 1191-1207 | 15 rows `[citation, short title, rule text]`; comment at 1190: `the compliance rule summary shown in module 03 (the Satchel tests them)` |
| `PL` | 1209-1350 | the eleven service lines: `{key, name, short, tok, g, seg ('res'\|'com'), unit, what, law[], angles[{id, h, d, lang?}], kw[], kwEs[], neg[]}`; line 1353 adds `.i` (index) |
| `PLI` | 1353 | `PL` by `key` |
| `LAWLINK` | 1352 | label -> URL of statute and act pages (comment 1351: `statute and act pages read for this build`) |
| `NEG_COMMON` | 1354 | negative keywords applied to every campaign |
| `lineName(k)` | 1355 | `PLI[k].name` or `k` |
| `fillCopy(s, ctx)` | 1357-1361 | replaces `{Token}` placeholders then runs `houseClean`. Tokens (line 1359): `City` = `ctx.city \|\| BRAND.city \|\| 'Louisiana'`; `Parish` = `ctx.parish \|\| ''`; `Company` and `Firm` = brand short name or name, else `'Your company'`; `Lic` = `'LSLBC license ' + BRAND.lic` or `'LSLBC license number'`; `Office` = `BRAND.city \|\| 'Louisiana'`; `Phone` = `phoneFmt(BRAND.phone)` or `''`; `Contact` = `BRAND.contact \|\| ''`. Unknown tokens are left as written |

Ad angle convention: `h` is a headline (kept to Google Ads headline length, 30 characters or fewer, by the look of the entries) and `d` a description (90 or fewer); `lang: 'es'` marks Spanish angles. This is inferred from the entries; the limits themselves are enforced elsewhere.

### 5.3 DATA CONTRACT
This section reads no field of `window.__ATLAS_DATA__` directly (it reads `BRAND`). It is, however, the place where the code states in words how the service-line columns were computed. For each line key `K` in `LINE_KEYS` the ZIP table carries `p_K` (the pool: expected jobs a year in the unit given below), `r_K`, `z_K`, `f_K`, and `META` carries `pools[K]`, `cases[K]`, `fees[K]`, `model.W[K]`, `model.REP[K]`, `model.VAL[K]`, `model.GRADE[K]`, `model.TIER[K]` (how `r_`, `z_`, `f_` derive from `p_` is stated in 09_sl_model.js and the modules, not here). The `unit` and `what` strings below are the exact explanation of `p_K`.

Note a mismatch to carry into the rebuild: `PL` gives FORTIFIED grade `C` (line 1264) while the data block `META.model.GRADE.fortified` is `D`.

#### 5.3.1 The eleven service lines (`PL`), copied exactly

| # | key | name | short | tok | grade `g` | seg | defined at line |
|---|---|---|---|---|---|---|---|
| 0 | `replace` | Roof replacement | Replace | `REPLACE` | B | res | 1210 |
| 1 | `repair` | Roof repair and leaks | Repair | `REPAIR` | B | res | 1224 |
| 2 | `storm` | Storm and wind damage | Storm | `STORM` | B | res | 1237 |
| 3 | `hail` | Hail damage | Hail | `HAIL` | C | res | 1251 |
| 4 | `fortified` | FORTIFIED roofs | FORTIFIED | `FORT` | C | res | 1264 |
| 5 | `metal` | Metal roofing | Metal | `METAL` | D | res | 1277 |
| 6 | `mh` | Manufactured home roofs | Mobile home | `MH` | C | res | 1290 |
| 7 | `mf` | Multifamily, condo and HOA | Multifamily | `MF` | C | com | 1302 |
| 8 | `comm` | Commercial roof replacement | Commercial | `COMM` | D | com | 1314 |
| 9 | `coat` | Restoration, coatings and maintenance | Coatings | `COAT` | D | com | 1327 |
| 10 | `newc` | New construction roofing | New build | `NEWC` | B | com | 1339 |

**`replace` - Roof replacement** (line 1210)

- `unit` (line 1210): "roofs on one to four unit homes reaching the end of their life in the next twelve months (age driven, not storm driven; metal and FORTIFIED counted in their own lines)"
- `what` (line 1211): "A renewal model of every one to four unit home by decade built (ACS 2020 to 2024, tables B25034 and B25127). Each roof wears out on a Weibull life with a 22 year mean and shape 3, calibrated to the 2023 American Housing Survey rate of roofing projects not paid by insurance, by year built, in the South (model 3.7 to 4.2 percent a year against 3.5 to 4.4 observed), and is reset by every storm that reached the ZIP since 1950: FEMA verified roof and wind damage where FEMA has it, the best track wind footprint elsewhere. The line is the expected age driven replacements over the next twelve months."
- `law` (line 1212): `resroof, permit, liab, cooling, regz, reviews, lutpa, fraud`
- `angles` (lines 1214-1218):
  - 1214 `local`: **New Roof in {City}** / Licensed Louisiana roofer, written itemized estimates. {Company}, {Office} office.
  - 1215 `age`: **Is Your Roof 20 Years Old?** / Most Louisiana shingle roofs wear out near 20 years. Book a roof inspection today.
  - 1216 `permit`: **Permitted and Inspected Roofs** / Every reroof in Louisiana needs a permit and inspections. We pull and pass both.
  - 1217 `license`: **Licensed Residential Roofer** / Check our LSLBC license before you sign. {Lic}. {Company}, {Office}.
  - 1218 `spanish` [es]: **Techo Nuevo en {City}** / Reemplazo de techos con licencia en Luisiana. {Company}, oficina en {Office}.
- `kw` (line 1220): roof replacement; new roof; roof replacement cost; roofing company; roofers near me; roofing contractor; shingle roof replacement; architectural shingles; reroof; roof installation; residential roofing; roof estimate; roofing companies near me; new roof cost
- `kwEs` (line 1221): reemplazo de techo; techos nuevos; compañia de techos; techeros cerca de mi
- `neg` (line 1222): roofing nails; roofing shingles for sale; shingle calculator; roof rack; car roof; shed roof; dog house; roofing license exam; roof truss; roof pitch calculator

**`repair` - Roof repair and leaks** (line 1224)

- `unit` (line 1224): "roof leak repairs a year on one to four unit homes handled by a paid roofer"
- `what` (line 1225): "The 2023 American Housing Survey rate of roof leaks in the last twelve months, by decade built and by owner and renter (South: 2.0 percent for homes built since 2020 up to 8.5 percent before 1940), times the homes in each decade of the ZIP, times 55 percent fixed by a paid roofer rather than the owner or a handyman (assumption, grade D)."
- `law` (line 1226): `permit, resroof, gouge, cooling, reviews, lutpa`
- `angles` (lines 1228-1231):
  - 1228 `leak`: **Roof Repair {City}** / Leak tracing, flashing and shingle repairs by a licensed roofer. Call {Company}.
  - 1229 `early`: **Stop a Roof Leak Early** / Small leaks rot decking and ceilings. Get it found and fixed. {Office} office.
  - 1230 `flash`: **Flashing and Chimney Leaks** / Most leaks start at flashing, vents and valleys. Photo report with every repair.
  - 1231 `spanish` [es]: **Reparación de Techos** / Arreglamos goteras y tejas dañadas. Hablamos español. Oficina en {Office}.
- `kw` (line 1233): roof repair; roof leak repair; leaking roof; emergency roof repair; roof repair near me; flashing repair; chimney leak repair; shingle repair; roof patch; roof leak; roof inspection
- `kwEs` (line 1234): reparacion de techos; goteras en el techo
- `neg` (line 1235): flex seal; roof sealant; rv roof; camper roof; car sunroof; tarp for sale; roof coating home depot

**`storm` - Storm and wind damage** (line 1237)

- `unit` (line 1237): "roofs a year needing a roofer after wind (hurricanes, tropical storms, thunderstorm wind, tornadoes), long run average, replacements and repairs"
- `what` (line 1238): "Every Atlantic storm from 1950 to 2025 rebuilt as a sustained wind footprint at each ZIP from the HURDAT2 best track wind radii (a modified Rankine profile before 2004). FEMA roof damage registrations from Katrina, Rita, Gustav, Ike and Isaac fix the damage curve: the share of roofs replaced rises on a logistic curve with a 52 percent ceiling, a 70 knot midpoint and a 7.3 knot width, at two roofs replaced per FEMA registration (grade D multiplier); Spearman 0.73 between wind and FEMA damage across 2,055 ZIP storm pairs. Repairs short of replacement and thunderstorm wind and tornado days within 25 miles (SPC 1996 to 2025) add at stated rates (grade D). Metal reroofs are carved out."
- `law` (line 1239): `claimads, claimacts, deductible, claimclock, gouge, cooling, resroof, permit, tcpa`
- `angles` (lines 1241-1245):
  - 1241 `tarp`: **Emergency Roof Tarping** / Storm tore your roof? We tarp it, photograph the damage and repair it. {Company}.
  - 1242 `inspect`: **Storm Damage Roof Inspection** / Wind lifts shingles you cannot see from the ground. Get a written photo report.
  - 1243 `local`: **Storm Repair {City}** / Licensed roofer for wind and storm repairs. Written estimates. {Office} office.
  - 1244 `estimate`: **Itemized Storm Repair Quotes** / Louisiana law requires a good faith itemized estimate. You get one before any work.
  - 1245 `spanish` [es]: **Daños de Tormenta al Techo** / Lonas de emergencia y reparación de techos. Hablamos español. Oficina en {Office}.
- `kw` (line 1247): storm damage roof repair; hurricane roof damage; wind damage roof repair; roof tarp; emergency roof tarp; roof inspection after storm; missing shingles; tree on roof; blue tarp roof; roof damage repair; storm roof repair
- `kwEs` (line 1248): daños de tormenta techo; lona para techo
- `neg` (line 1249): public adjuster; insurance agent; insurance quote; fema application; car insurance; tarp for sale; harbor freight

**`hail` - Hail damage** (line 1251)

- `unit` (line 1251): "roofs a year with hail damage needing a roofer (60 percent replacements)"
- `what` (line 1252): "SPC hail reports, 1996 to 2025: days a year with hail of 1 inch or larger within 25 miles of the ZIP (median 1.9) and days with 1.75 inch hail or larger. Each 1 inch day damages 0.22 percent of roofs and each 1.75 inch day a further 0.40 percent (assumption, grade D: the point chance a swath crosses a roof). Reports cluster where people live, so rural hail is undercounted; the recent decade (2016 to 2025) is shown beside the 30 year rate."
- `law` (line 1253): `claimads, claimacts, deductible, claimclock, cooling, resroof, permit`
- `angles` (lines 1255-1258):
  - 1255 `hail`: **Hail Damage Roof Inspection** / Hail bruises shingles and knocks off granules. A licensed roofer shows you where.
  - 1256 `local`: **Hail Hit {City}?** / Get a written roof report from a licensed local roofer. {Company}, {Office} office.
  - 1257 `size`: **Golf Ball Hail Damages Roofs** / Hail of 1.75 inches or larger damages most shingles. Book an inspection.
  - 1258 `spanish` [es]: **Daños por Granizo** / Inspección de techos después del granizo. Hablamos español. Oficina en {Office}.
- `kw` (line 1260): hail damage roof; hail damage roof repair; hail roof inspection; hail damaged shingles; roof hail damage; hail storm roof
- `kwEs` (line 1261): daños por granizo techo
- `neg` (line 1262): hail damage car; paintless dent repair; hail netting; auto hail; hail guard

**`fortified` - FORTIFIED roofs** (line 1264)

- `unit` (line 1264): "FORTIFIED Roof reroofs a year, grant funded and owner paid"
- `what` (line 1265): "Statewide anchor of 9,000 a year: 2026 funding of about $80 million for the Louisiana Fortify Homes Program and $20 million for Restore ROOF at $10,000 a grant, less administration, plus owners who pay for FORTIFIED themselves (grade C). Apportioned by owner occupied single family homes likely to be insured (mortgage share), roofs 15 years or older, coastal parishes (1.6 times) and hurricane frequency. Only FORTIFIED certified roofers can install grant roofs."
- `law` (line 1266): `fortify, resroof, code, permit, lutpa`
- `angles` (lines 1268-1271):
  - 1268 `grant`: **FORTIFIED Roof Installer** / Ask how the Louisiana Fortify Homes grant of up to $10,000 works. {Company}.
  - 1269 `std`: **FORTIFIED Standard Roofs** / Sealed roof deck, ring shank nails and tested edges, built to the IBHS standard.
  - 1270 `insure`: **Ask Your Insurer About Credits** / Many Louisiana insurers file FORTIFIED discounts. Ask yours, then call {Company}.
  - 1271 `spanish` [es]: **Techos FORTIFIED** / Pregunte por la subvención de hasta $10,000 del programa Fortify Homes.
- `kw` (line 1273): fortified roof; fortified roof cost; fortified roof contractor; louisiana fortify homes program; fortified roof grant; fortified roof louisiana; ibhs fortified roof; wind mitigation roof; fortified roofer near me
- `kwEs` (line 1274): techo fortified; subvencion techo luisiana
- `neg` (line 1275): fortified wine; fortified milk; fortified cereal; fortified foods; vitamin

**`metal` - Metal roofing** (line 1277)

- `unit` (line 1277): "metal reroofs a year on one to four unit homes, whatever the trigger (age, wind or hail)"
- `what` (line 1278): "12 percent of residential reroofs statewide (assumption, grade D), tilted toward rural ZIPs (1.6 times under 300 residents per square mile, 0.6 times over 1,500) and higher income; carved out of the replacement, storm and hail lines so nothing is counted twice. Steel mill producer prices rose 23 percent in the year to August 2026, so quotes age faster than shingle quotes."
- `law` (line 1279): `resroof, permit, code, regz, lutpa`
- `angles` (lines 1281-1284):
  - 1281 `metal`: **Metal Roofs in {City}** / Standing seam and exposed fastener metal roofs installed by a licensed roofer.
  - 1282 `built`: **A Roof Built for Louisiana** / Metal sheds wind and rain for decades. Get a written quote from {Company}.
  - 1283 `over`: **Metal Roof Over Shingles?** / We tell you in writing whether your deck and the code allow it. {Office} office.
  - 1284 `spanish` [es]: **Techos de Metal** / Instalación de techos de metal con licencia. Hablamos español. Oficina en {Office}.
- `kw` (line 1286): metal roofing; metal roof installation; standing seam metal roof; metal roof cost; metal roof contractor; metal roof over shingles; metal roofing near me; metal roof replacement
- `kwEs` (line 1287): techos de metal; techo de lamina
- `neg` (line 1288): metal roofing panels for sale; metal building kit; carport kit; scrap metal; metal roof paint; diy metal roof

**`mh` - Manufactured home roofs** (line 1290)

- `unit` (line 1290): "manufactured home roof jobs a year (roof overs, recovers, coatings and storm repairs)"
- `what` (line 1291): "Mobile homes (ACS B25024) times 2.6 percent a year professional roofing projects (2023 American Housing Survey, South: 3.58 percent a year less 27.7 percent done by the owner) plus wind damage at 1.3 times the site built rate per unit of wind. Mobile homes are not eligible for Fortify Homes grants."
- `law` (line 1292): `resroof, permit, cooling, gouge, regz, fraud`
- `angles` (lines 1294-1296):
  - 1294 `over`: **Mobile Home Roof Over** / Metal roof overs and coatings for manufactured homes. Licensed roofer in {Office}.
  - 1295 `leak`: **Mobile Home Roof Leaks** / Stop leaks at seams and vents before the ceiling fails. Call {Company}.
  - 1296 `spanish` [es]: **Techos de Casas Móviles** / Techos de metal y reparaciones para casas móviles. Hablamos español.
- `kw` (line 1298): mobile home roof; mobile home roof over; mobile home roof repair; manufactured home roof replacement; trailer roof leak; mobile home metal roof; mobile home roof coating
- `kwEs` (line 1299): techo para casa movil
- `neg` (line 1300): rv roof; camper roof; mobile home for sale; mobile home parts; mobile home lot

**`mf` - Multifamily, condo and HOA** (line 1302)

- `unit` (line 1302): "roof replacements a year on apartment, condo and association buildings of five or more units"
- `what` (line 1303): "Buildings estimated from units in structure (7, 14, 30 and 80 units a building for the ACS size classes) and renewed on a 22 year low slope life with storm resets, plus wind damage at 80 percent of the residential replacement rate. Association boards and property managers buy on bids, reserve studies and references."
- `law` (line 1304): `thresholds, permit, claimads, deductible, lien, code`
- `angles` (lines 1306-1308):
  - 1306 `hoa`: **HOA and Condo Roofing** / Phased replacements, reserve planning and storm repairs for associations.
  - 1307 `apts`: **Apartment Roof Replacement** / Low slope and shingle roofs for multifamily owners. Licensed commercial roofer.
  - 1308 `storm`: **Multifamily Storm Repairs** / Tarping, temporary repairs and full replacement across buildings. {Company}.
- `kw` (line 1310): apartment roofing; multifamily roofing contractor; hoa roof replacement; condo roof replacement; townhome roof replacement; property management roofing
- `kwEs` (line 1311): (empty)
- `neg` (line 1312): apartment for rent; condo for sale; apartments near me; hoa fees

**`comm` - Commercial roof replacement** (line 1314)

- `unit` (line 1314): "commercial roof replacements a year (low slope membranes and metal buildings), age and storm driven"
- `what` (line 1315): "80,000 commercial roofs statewide (the CBECS 2018 national building count scaled by population, grade C), apportioned by ZIP Code Business Patterns 2023 establishments weighted by building type (plants and warehouses 0.8 to 0.9 a roof each, retail 0.55, offices 0.25, churches 1.0), replaced on a 22 year cycle plus wind damage at 70 percent of the residential rate and hail at 30 percent."
- `law` (line 1316): `thresholds, permit, code, lien, claimads, deductible`
- `angles` (lines 1318-1321):
  - 1318 `tpo`: **Commercial Roof Replacement** / TPO, PVC, modified bitumen and metal roofs. Licensed commercial roofer.
  - 1319 `local`: **Commercial Roofing** / Warehouses, retail, churches and offices in {City}. Licensed commercial roofer.
  - 1320 `wind`: **Hurricane Rated Roof Systems** / Wind rated assemblies designed to the Louisiana building code. Request a bid.
  - 1321 `church`: **Church and School Roofs** / Replacement and repair planned around services and school calendars.
- `kw` (line 1323): commercial roofing; commercial roof replacement; flat roof replacement; tpo roofing; pvc roofing; modified bitumen roof; commercial roofing contractor; warehouse roof replacement; church roof replacement; metal building roof
- `kwEs` (line 1324): (empty)
- `neg` (line 1325): commercial roofing jobs; roofing salary; rubber roof kit; flat roof diy; roofing apprenticeship

**`coat` - Restoration, coatings and maintenance** (line 1327)

- `unit` (line 1327): "commercial roofs restored, coated or put on a maintenance agreement a year"
- `what` (line 1328): "Three percent of the commercial roof stock a year (assumption, grade D) on the same building estimate as the commercial line. Restoration fits roofs that are sound but aging; it competes with replacement and is often bought by facility managers on a budget cycle."
- `law` (line 1329): `thresholds, permit, lutpa, lien`
- `angles` (lines 1331-1333):
  - 1331 `coat`: **Silicone Roof Coatings** / Restore a sound commercial roof and add years before replacement.
  - 1332 `maint`: **Roof Maintenance Plans** / Twice yearly inspections and repairs keep roofs and warranties in shape.
  - 1333 `leak`: **Commercial Roof Leak Repair** / Leak tracing on flat and metal roofs with photo reports. {Company}.
- `kw` (line 1335): commercial roof coating; silicone roof coating; roof restoration; flat roof coating; commercial roof repair; roof maintenance program; commercial roof inspection
- `kwEs` (line 1336): (empty)
- `neg` (line 1337): roof coating home depot; elastomeric paint; diy roof coating; roof coating gallon

**`newc` - New construction roofing** (line 1339)

- `unit` (line 1339): "new roofs a year on newly permitted buildings (builder subcontract work)"
- `what` (line 1340): "Census Building Permits Survey, 2023 to 2025 average by parish (every residential building authorized), apportioned to ZIPs by homes built since 2020 and, at 35 percent weight, since 2010 (ACS). Builder work is won on price, schedule and relationships, so it is reached through builder associations and estimating, not search ads."
- `law` (line 1341): `thresholds, nhwa, permit, code, lien`
- `angles` (lines 1343-1344):
  - 1343 `builder`: **Roofing for Home Builders** / Production roofing crews, permits and inspections handled. {Office} office.
  - 1344 `sched`: **New Construction Roofing** / Crews scheduled to your build calendar, permits and inspections included.
- `kw` (line 1346): new construction roofing; roofing subcontractor; builder roofing contractor; roofing for builders; roof installation new home
- `kwEs` (line 1347): (empty)
- `neg` (line 1348): roofing jobs; roofing apprenticeship; roofing license; build my own house

#### 5.3.2 The law register `LAWX.items` (20 entries), copied exactly

`LAWX.asof = '2026-10-06'` (line 1142). Scope column is my reading: LA = Louisiana statute or programme (rewrite), FED = federal rule (keep, re-verify), MIX = federal plus a Louisiana element.

| Line | id | Scope | Title `t` | Citation `cite` | Effective `eff` | g | Lines it applies to |
|---|---|---|---|---|---|---|---|
| 1144 | `resroof` | LA | Residential roofing needs its own license at $7,500 | La. R.S. 37:2150.1, 37:2156.4 (Acts 2025, No. 422; Acts 2026, No. 757) | January 1, 2026; broadened August 1, 2026 | A | replace, repair, storm, hail, fortified, metal, mh |
| 1146 | `permit` | LA | Every roof and reroof needs a permit and inspections | Acts 2025, No. 239; Acts 2025, No. 422 (LSLBC violations) | Projects beginning on or after August 1, 2025 | B | replace, repair, storm, hail, fortified, metal, mh, mf, comm, coat, newc |
| 1148 | `liab` | LA | $500,000 liability coverage for residential licensees | La. R.S. 37:2156.1; LAC 46:XXIX.105 (Acts 2026, No. 757) | August 1, 2026 | A | replace, repair, storm, hail, fortified, metal, mh |
| 1150 | `thresholds` | LA | Who needs which license | La. R.S. 37:2150.1 et seq.; LSLBC licensing requirements (June 2025) | In force | A | mf, comm, coat, newc, replace |
| 1152 | `claimads` | LA | No advertising as an insurance claims specialist | La. R.S. 37:2159.1(7), (8); R.S. 22:1706(H)(11) (Acts 2025, No. 144) | August 1, 2025 | A | storm, hail, replace, fortified, mf, comm |
| 1154 | `claimacts` | LA | What a roofer may not do on an insurance claim | La. R.S. 37:2159.1 (enacted as R.S. 37:2175.3(A)(12) to (18) by Acts 2022, No. 734) | In force | A | storm, hail, replace, mf, comm |
| 1156 | `deductible` | LA | Deductibles: never paid, waived or rebated, and the notice | La. R.S. 51:451, 51:452 (Acts 2022, No. 734) | In force | A | storm, hail, replace, fortified, metal, mf, comm |
| 1158 | `claimclock` | LA | The insurer's clock after a roof claim | La. R.S. 22:1892 (Acts 2024, No. 3, SB 323); R.S. 22:1973 repealed | In force (2024 Regular Session) | A | storm, hail |
| 1160 | `fortify` | LA | Louisiana Fortify Homes Program | La. R.S. 22:1483.1 (Acts 2024, No. 533) | Permanent since June 10, 2024 | B | fortified, replace, storm |
| 1162 | `gouge` | LA | Price gouging after a declared emergency | La. R.S. 29:732 | During any declared state of emergency | B | storm, hail, repair, mh |
| 1164 | `cooling` | FED | Three days to cancel a sale made at the home | 16 CFR Part 429 (FTC Cooling Off Rule) | In force | A | replace, repair, storm, hail, metal, mh, fortified |
| 1166 | `reviews` | FED | Reviews and testimonials | 16 CFR Part 465 (eff. October 21, 2024); 16 CFR Part 255 | In force | A | replace, repair, storm, hail, fortified, metal, mh, mf, comm, coat, newc |
| 1168 | `regz` | FED | Financing ads and trigger terms | 12 CFR 1026.24 (Regulation Z) | In force | A | replace, metal, fortified, mh, repair |
| 1170 | `tcpa` | MIX | Calls and texts | 47 U.S.C. 227; 47 CFR 64.1200; La. R.S. 45:844.11 et seq. | In force | B | replace, repair, storm, hail, fortified, metal, mh, mf, comm, coat, newc |
| 1172 | `code` | LA | The state building code governs every roof | La. R.S. 40:1730.21 et seq. (Louisiana State Uniform Construction Code) | In force; confirm the edition with the LSUCC Council | B | replace, storm, hail, fortified, metal, mh, mf, comm, newc |
| 1174 | `lutpa` | LA | Unfair and deceptive advertising | La. R.S. 51:1405 (Louisiana Unfair Trade Practices Act) | In force | A | replace, repair, storm, hail, fortified, metal, mh, mf, comm, coat, newc |
| 1176 | `fraud` | LA | Home improvement and contractor fraud | La. R.S. 14:202, 14:202.1 | In force | B | replace, repair, storm, hail, mh |
| 1178 | `nhwa` | LA | New Home Warranty Act | La. R.S. 9:3141 et seq. | In force | B | newc |
| 1180 | `lien` | LA | Private Works Act liens | La. R.S. 9:4801 et seq. | In force | B | comm, mf, newc, coat |
| 1182 | `threeyr` | LA | Insurers may again nonrenew long held homeowners policies | Acts 2024, No. 9 (HB 611); La. R.S. 22:1265; LDI Regulation 131 | August 1, 2024; coverage changes from January 1, 2025 | A | replace, fortified, metal, storm, hail |

Summaries `s` and source URLs:

- `resroof` (s at line 1145; url `https://lslbc.gov/wp-content/uploads/LSLBC_Memorandum_Statutory_Changes_July_13_2026_REVISED.pdf`): "Act 422 of 2025 created the Residential Roofing classification. Since August 1, 2026 (Act 757 of 2026) a person who advertises, solicits, quotes, bids, contracts, supervises or performs roofing work worth $7,500 or more on a building used mainly as a residence with up to four units must hold the Residential Roofing or the Residential Construction classification. Advertising is itself covered, so an unlicensed roofer may not run ads for full replacements. Holders of residential construction, building construction or commercial roofing licenses were exempted from the new trade exam."
- `permit` (s at line 1147; url `https://www.adamsandreese.com/insights/louisiana-enacts-new-requirements-on-roofing-permits-and-licensing`): "Roof construction and reroofing of residential and commercial structures require a permit from the parish or municipality and the inspections the law requires. Act 422 makes it a violation to work without a required permit, to start before the permit issues, to misrepresent the value or scope of the work, or to skip inspections. Permit counts by jurisdiction now record nearly every reroof in the state, which makes local permit logs a demand signal from 2026 on."
- `liab` (s at line 1149; url `https://lslbc.gov/wp-content/uploads/LSLBC_Memorandum_Statutory_Changes_July_13_2026_REVISED.pdf`): "Residential construction licensees, their subclassifications and specialties (residential roofing included) and home improvement registrants must keep at least $500,000 in liability insurance or qualifying trust fund protection, filed by the agent, broker or insurer with the LSLBC as certificate holder, with no exclusion for licensed scopes. Workers' compensation and liability protection must stay in force while the license is active."
- `thresholds` (s at line 1151; url `https://lslbc.gov/wp-content/uploads/2025/06/Licensing-Requirements-for-Contractors-in-Louisiana.pdf`): "Commercial projects of $50,000 or more (anything but residences of up to four units) need a commercial license with the right classification, and subcontracts of that size need licensed subcontractors. Residential construction or home improvement of $50,000 or more, or any structural work, needs a residential building license. Home improvement work over $7,500 and up to $50,000 needs at least a home improvement registration, except that residential roofing of $7,500 or more now needs the roofing classification."
- `claimads` (s at line 1153; url `https://legis.la.gov/legis/ViewDocument.aspx?d=1427858`): "A person performing home improvement contracting may not advertise or solicit as an insurance claims specialist, or as providing any insurance claim or policy interpretation related service to an insured. A public adjuster may not act as the contractor or subcontractor or provide roofing or repair services on a claim the adjuster processed. Copy such as "we handle your claim", "claim specialists" or "we work with your insurance company for you" is now a licensing violation, not just a style risk."
- `claimacts` (s at line 1155; url `https://legis.la.gov/legis/ViewDocument.aspx?d=1290211`): "A contractor, or anyone it pays, may not interpret coverage or duties under the owner's property policy, may not adjust the claim, may not hand an insured a repair agreement without a good faith itemized estimate of services and materials, may not share in or pay for attorney referrals, and may not take an assignment of the insured's rights or proceeds before the work is complete and the insurer has made its first inspection (and then only for the contracted scope)."
- `deductible` (s at line 1157; url `https://legis.la.gov/legis/ViewDocument.aspx?d=1290211`): "A seller paid from a property insurance claim may not advertise, promise or agree to pay, waive, absorb or rebate the insured's deductible, or pad the price by the deductible. Any contract of $1,000 or more reasonably expected to be paid from claim proceeds must carry, in at least 12 point bold type, the statutory notice that Louisiana law requires the insured to pay the deductible."
- `claimclock` (s at line 1159; url `https://legis.la.gov/legis/ViewDocument.aspx?d=1372369`): "Except for a catastrophic loss, the insurer must start adjusting a property claim within 14 days of notice; after a catastrophe, within 30 days, which the commissioner may extend by up to 30 more days for a declared disaster. A written offer is due within 30 days of satisfactory proof of loss. An arbitrary failure carries a penalty of 50 percent of the amount due plus proven economic damages, or $1,000 if greater, with attorney fees. The separate bad faith statute, R.S. 22:1973, was repealed into this section. Explaining the timeline in general terms is consumer education; advising a specific owner on coverage is not allowed (R.S. 37:2159.1)."
- `fortify` (s at line 1161; url `https://legis.la.gov/legis/ViewDocument.aspx?d=1384506`): "Grants of up to $10,000 retrofit an owner occupied, homesteaded, insured home (wind coverage required; flood insurance where the home sits in a flood zone) to the IBHS FORTIFIED Roof standard. The grant is paid to the contractor after the roof is certified; permits, inspections and random reinspections apply. Condominiums, mobile homes and recently built homes are not eligible. In 2026 the June round offered 3,000 grants by lottery, the program gained about $80 million (a $50 million transfer of Katrina and Rita bond assessment funds approved in 2026 plus about $30 million a year in fees), and the state added $20 million of HUD money for coastal homes through Restore ROOF."
- `gouge` (s at line 1163; url `https://legis.la.gov/legis/LawSearch.aspx`): "While a state of emergency is declared, prices for goods and services in the area may not exceed those ordinarily charged before the emergency, except for documented increases in cost and business risk. Tarping, repairs and materials after a hurricane are squarely covered; price books dated before the storm are the defense."
- `cooling` (s at line 1165; url `https://www.ecfr.gov/current/title-16/chapter-I/subchapter-D/part-429`): "A sale of $25 or more made at the buyer's home carries a right to cancel within three business days, with the written notice the rule prescribes. An emergency exception exists only where the buyer starts the contact, needs the work for a genuine emergency and waives the right in a separate signed statement; storm canvassing does not fit it."
- `reviews` (s at line 1167; url `https://www.ecfr.gov/current/title-16/chapter-I/subchapter-D/part-465`): "No fake or AI written reviews, no reviews bought on the condition that they are positive, no undisclosed reviews by staff or relatives, no company controlled "independent" review sites, no suppression of negative reviews, and no fake social media indicators. Civil penalties apply per violation."
- `regz` (s at line 1169; url `https://www.ecfr.gov/current/title-12/chapter-X/part-1026/subpart-C/section-1026.24`): "A financing ad that states a payment amount, a number or period of payments, a down payment or a finance charge must also state the down payment, the terms of repayment and the annual percentage rate, using that term. "Financing available" alone triggers nothing."
- `tcpa` (s at line 1171; url `https://www.ecfr.gov/current/title-47/chapter-I/subchapter-B/part-64/subpart-L/section-64.1200`): "Autodialed or prerecorded marketing calls and texts to mobile phones need prior express written consent; marketing calls must honor the national and the Louisiana Public Service Commission Do Not Call lists. Storm lead lists bought from third parties rarely carry valid consent."
- `code` (s at line 1173; url `https://lsuccc.dps.louisiana.gov/`): "Louisiana enforces the International Residential and Building Codes as adopted with state amendments, including the roof covering wind resistance and underlayment provisions keyed to the design wind speed. FORTIFIED goes beyond code with a sealed roof deck, ring shank nails and tested edges."
- `lutpa` (s at line 1175; url `https://legis.la.gov/legis/LawSearch.aspx`): "Unfair or deceptive acts in trade are unlawful, with private actions and attorney general enforcement. "Number one roofer", "lifetime roof", "insurance approved", "hurricane proof" and invented discounts are the claims that draw complaints."
- `fraud` (s at line 1177; url `https://legis.la.gov/legis/LawSearch.aspx`): "Taking payment for home improvement work and failing to perform, and misapplying payments meant for materials and subcontractors, are crimes with restitution. After a disaster these cases rise, and so does homeowner suspicion of door knockers; licensing, permits and itemized estimates are the trust signals that answer it."
- `nhwa` (s at line 1179; url `https://lslbc.gov/wp-content/uploads/New_Home_Warranty_Act.pdf`): "Builders warrant new homes for one year against defects from noncompliance with building standards, two years for plumbing, electrical, heating and cooling, and five years for major structural defects; roof work done for a builder is measured against that warranty, so builder contracts allocate it."
- `lien` (s at line 1181; url `https://legis.la.gov/legis/LawSearch.aspx`): "Contractors, subcontractors and suppliers on private works keep lien and privilege rights only by meeting the notice and filing deadlines of the Act; commercial roofers build those dates into every job."
- `threeyr` (s at line 1182; url `https://legis.la.gov/legis/BillInfo.aspx?s=24RS&b=HB611&sbi=y`): "Act 9 of 2024 ended the rule that barred insurers from cancelling or nonrenewing homeowners policies in force more than three years. Insurers may file plans to nonrenew up to 5 percent of those policies, and from January 1, 2025 may raise deductibles or change coverage on them. Roof condition and age are common grounds for an insurer inspection, so owners of older roofs now face renewal pressure that turns into replacement demand."

#### 5.3.3 `LAWX.pending` (3 entries, lines 1185-1187)

- Line 1185, grade A: **Mandatory FORTIFIED discount bill did not pass** - "SB 222 of 2025 would have required insurers to give a 20 to 30 percent premium discount or rate reduction for FORTIFIED construction by October 1, 2026. It stalled in committee. Discounts remain whatever each insurer files; LDI publishes them under Act 533 of 2024. Copy must not promise a discount size." Source: `legis.la.gov, 2025 Regular Session, SB 222 bill history`
- Line 1186, grade A: **Ban on ads inviting roof insurance claims failed in 2024** - "HB 459 of 2024 would have barred contractor ads that encourage owners to contact a contractor or public adjuster to make a roof damage claim. It failed House final passage; Act 144 of 2025 then reached claim specialist advertising instead. Expect the narrower 2024 idea to return." Source: `legis.la.gov, 2024 Regular Session, HB 459 bill history`
- Line 1187, grade A: **Renewal notices now show last year's premium** - "Act 11 of 2025 requires homeowners renewals to show the prior premium beside the new one and rewrote the rate standards. Owners see premium jumps plainly, which sends some of them looking for FORTIFIED and roof age discounts." Source: `legis.la.gov, Act 11 of 2025 (HB 148) resume digest`

#### 5.3.4 `ADRULES` (15 rows, lines 1192-1206), copied exactly

| Line | Citation | Title | Rule text |
|---|---|---|---|
| 1192 | R.S. 37:2156.4 (Act 757 of 2026) | Licensed to advertise | Advertising, soliciting or quoting residential roofing of $7,500 or more requires the Residential Roofing or Residential Construction classification. |
| 1193 | R.S. 37:2159.1(7), (8) (Act 144 of 2025) | No claims specialist claims | No advertising or soliciting as an insurance claims specialist or as providing claim or policy interpretation services. |
| 1194 | R.S. 37:2159.1 (Act 734 of 2022) | Claims conduct | No interpreting coverage, no adjusting, a good faith itemized estimate before any repair agreement, no attorney referral fees, no assignment of benefits before the work and the insurer's first inspection. |
| 1195 | R.S. 51:451 | Deductibles | No ad, promise or agreement to pay, waive, absorb or rebate a deductible, and no price padding to cover it. |
| 1196 | R.S. 51:452 | Deductible notice | Contracts of $1,000 or more expected to be paid from insurance carry the statutory notice in 12 point bold type. |
| 1197 | Act 239 of 2025; Act 422 of 2025 | Permits | Every roof and reroof is permitted and inspected; no start before the permit; no understated value or scope. |
| 1198 | 16 CFR Part 465 | Reviews | No fake, bought, insider or suppressed reviews; no fake follower or rating indicators. |
| 1199 | 16 CFR Part 255 | Endorsements | Disclose material connections; testimonials reflect typical experience. |
| 1200 | 16 CFR Part 429 | Sales at the home | Three business day cancellation notice for sales of $25 or more made at the home. |
| 1201 | 12 CFR 1026.24 | Financing | Trigger terms require the down payment, repayment terms and the annual percentage rate. |
| 1202 | 47 U.S.C. 227; R.S. 45:844.11 | Calls and texts | Written consent for autodialed or prerecorded marketing; honor the national and Louisiana Do Not Call lists. |
| 1203 | R.S. 29:732 | Price gouging | During a declared emergency, no increases beyond documented costs. |
| 1204 | R.S. 51:1405 (LUTPA) | Truthful claims | Superlatives, lifetime and wind claims, discounts and "insurance approved" must be true and substantiated. |
| 1205 | Manufacturer program terms | Certifications and warranties | Name a certification or a manufacturer warranty only as the program allows and only while current. |
| 1206 | IBHS FORTIFIED program | FORTIFIED claims | FORTIFIED is an IBHS standard: only a FORTIFIED certified roofer advertises installing it, and only an IBHS evaluator issues a designation. |

#### 5.3.5 `LAWLINK` (line 1352), copied exactly

| Label | URL |
|---|---|
| Act 757 of 2026 | `https://lslbc.gov/wp-content/uploads/LSLBC_Memorandum_Statutory_Changes_July_13_2026_REVISED.pdf` |
| Act 144 of 2025 | `https://legis.la.gov/legis/ViewDocument.aspx?d=1427858` |
| Act 734 of 2022 | `https://legis.la.gov/legis/ViewDocument.aspx?d=1290211` |
| Act 3 of 2024 | `https://legis.la.gov/legis/ViewDocument.aspx?d=1372369` |
| Act 533 of 2024 | `https://legis.la.gov/legis/ViewDocument.aspx?d=1384506` |
| Act 11 of 2025 | `https://legis.la.gov/legis/BillInfo.aspx?s=25RS&b=HB148` |
| LSLBC requirements | `https://lslbc.gov/wp-content/uploads/2025/06/Licensing-Requirements-for-Contractors-in-Louisiana.pdf` |
| 16 CFR 465 | `https://www.ecfr.gov/current/title-16/chapter-I/subchapter-D/part-465` |
| 16 CFR 429 | `https://www.ecfr.gov/current/title-16/chapter-I/subchapter-D/part-429` |
| 12 CFR 1026.24 | `https://www.ecfr.gov/current/title-12/chapter-X/part-1026/subpart-C/section-1026.24` |
| LSLBC contractor search | `https://lslbc.gov/contractor-search/` |

#### 5.3.6 `NEG_COMMON` (line 1354), copied exactly

`jobs, job, career, salary, hiring, apprentice, apprenticeship, training, how to, diy, do it yourself, youtube, reddit, wiki, definition, meaning, license exam, osha, home depot, lowes, menards, for sale, wholesale, texas, mississippi, arkansas, alabama, florida`

The last five entries (`texas, mississippi, arkansas, alabama, florida`) are other-state negatives: searches naming a neighbouring Gulf state are excluded.

#### 5.3.7 Where the model text meets the data block (`META.model`)
The `what` strings quote numbers that also exist as data constants (values from `la_meta.json`). A California data build should regenerate both together.
| Text in `PL[].what` | Line | Data constant |
|---|---|---|
| "Weibull life with a 22 year mean and shape 3" | 1211 | `META.model.WB = {L: 22.0, k: 3.0, rho: 0.015, fit: {...}}` |
| "(model 3.7 to 4.2 percent a year against 3.5 to 4.4 observed)" by year built, South | 1211 | `META.model.WB.fit` and `META.ahs.vint` = `{"1960-1979":[3.87,4.37],"1980-1989":[3.72,3.98],"1990-1999":[4.17,3.93],"2000-2009":[3.77,3.46],"2010-2019":[1.24,1.13]}` (pairs are `[model, observed]` in percent a year: the first elements span 3.72 to 4.17 and the second 3.46 to 4.37 for homes built before 2010, matching the sentence) |
| "times 55 percent fixed by a paid roofer" | 1225 | `META.model.ANCH.leak = 0.55` |
| "logistic curve with a 52 percent ceiling, a 70 knot midpoint and a 7.3 knot width, at two roofs replaced per FEMA registration [...] Spearman 0.73 [...] across 2,055 ZIP storm pairs" | 1238 | `META.model.DMG = {smax: 0.5214, v50: 69.72, w: 7.263, n: 2055, M: 2.0, rho: 0.731}` |
| "Each 1 inch day damages 0.22 percent of roofs and each 1.75 inch day a further 0.40 percent" | 1252 | `META.model.ANCH.hail = [0.0022, 0.004]` |
| "Statewide anchor of 9,000 a year" | 1265 | `META.model.ANCH.fort = 9000`, `META.fort.anchor = 9000`, `META.pools.fortified = 9000.0` |
| "about $80 million [...] and $20 million for Restore ROOF at $10,000 a grant" | 1265 | `META.fort = {grant: 10000, round26: 3000, lfhp26: 80000000, restore26: 20000000, total26: 100000000, anchor: 9000}` |
| "12 percent of residential reroofs statewide" | 1278 | `META.model.ANCH.metal = 0.12` |
| "2.6 percent a year professional roofing projects (2023 American Housing Survey, South: 3.58 percent a year less 27.7 percent done by the owner)" | 1291 | `META.model.ANCH.mh = 0.0258834`; `META.ahs.s_mh_rate = 3.58`, `META.ahs.s_mh_diy = 27.7` |
| "80,000 commercial roofs statewide" | 1315 | `META.model.ANCH.cru = 80000` |
| "Three percent of the commercial roof stock a year" | 1328 | `META.model.ANCH.coat = 0.03`; `META.pools.coat = 2400.0` (= 0.03 x 80,000) |
| thunderstorm wind and tornado add "at stated rates (grade D)" | 1238 | probably `META.model.ANCH.wind = [0.0003, 0.0015, 0.0025]` (three rates; which event class each belongs to is not stated in my range) |
| not quoted in `PL` | - | `META.model.ANCH.M2020 = 3.6` (not explained in my range) |

### 5.4 LOUISIANA-SPECIFIC CONTENT in 04_content.js
Everything quoted in 5.3.1 to 5.3.6 is the rewrite list; this index says which parts are Louisiana or hurricane specific. (Line numbers are exact; the text is in the subsections above.)

Law register (`LAWX`)
| Lines | Item |
|---|---|
| 1136, 1138-1140 | Header comments naming Louisiana law, legis.la.gov, the LSLBC notices of July 13, 2026 |
| 1142 | `asof: '2026-10-06'` |
| 1144-1163, 1172-1182 | 16 Louisiana items: `resroof, permit, liab, thresholds, claimads, claimacts, deductible, claimclock, fortify, gouge, code, lutpa, fraud, nhwa, lien, threeyr` are wholly Louisiana statute (La. R.S. 37:2150.1, 37:2156.1, 37:2156.4, 37:2159.1, 22:1706(H)(11), 22:1892, 22:1973, 22:1483.1, 22:1265, 51:451, 51:452, 51:1405, 29:732, 40:1730.21, 14:202, 14:202.1, 9:3141, 9:4801; LAC 46:XXIX.105; Acts 2022 No. 734; Acts 2024 Nos. 3, 9, 533; Acts 2025 Nos. 144, 239, 422; Acts 2026 No. 757; LDI Regulation 131) and name the agencies LSLBC (Louisiana State Licensing Board for Contractors), LDI (Louisiana Department of Insurance), the LSUCC Council (Louisiana State Uniform Construction Code) and the Louisiana Public Service Commission |
| 1164-1169 | 3 federal items kept as is after re-verification: `cooling` (16 CFR Part 429), `reviews` (16 CFR Part 465 and Part 255), `regz` (12 CFR 1026.24) |
| 1170-1171 | `tcpa`: federal (47 U.S.C. 227; 47 CFR 64.1200) plus `La. R.S. 45:844.11 et seq.` and "the Louisiana Public Service Commission Do Not Call lists" |
| 1161 | Programme facts: Louisiana Fortify Homes Program grants "up to $10,000", "owner occupied, homesteaded, insured home", "In 2026 the June round offered 3,000 grants by lottery", "about $80 million (a $50 million transfer of Katrina and Rita bond assessment funds approved in 2026 plus about $30 million a year in fees)", "$20 million of HUD money for coastal homes through Restore ROOF" |
| 1163 | "Tarping, repairs and materials after a hurricane are squarely covered" |
| 1175 | Example claims: "Number one roofer", "lifetime roof", "insurance approved", "hurricane proof" |
| 1182 | The three-year non-renewal rule (Act 9 of 2024, HB 611) |
| 1185-1187 | Pending items: SB 222 of 2025 (FORTIFIED discount), HB 459 of 2024 (claim ads), Act 11 of 2025 (HB 148, renewal notices) |
| 1192-1197, 1202-1204 | `ADRULES` rows citing Louisiana law (R.S. 37:2156.4, 37:2159.1, 51:451, 51:452, 45:844.11, 29:732, 51:1405; Acts 239 and 422 of 2025; Act 757 of 2026; Act 144 of 2025; Act 734 of 2022) |
| 1206 | `ADRULES` FORTIFIED row (IBHS programme; national, but only relevant where the FORTIFIED line exists) |
| 1352 | `LAWLINK`: 8 Louisiana URLs (lslbc.gov x3, legis.la.gov x5) and 3 federal (ecfr.gov) |

Service lines (`PL`)
| Line | Louisiana or hurricane specific text |
|---|---|
| 1211 | `replace.what`: "in the South", "reset by every storm that reached the ZIP since 1950: FEMA verified roof and wind damage where FEMA has it, the best track wind footprint elsewhere" |
| 1214 | "Licensed Louisiana roofer, written itemized estimates." |
| 1215 | "Most Louisiana shingle roofs wear out near 20 years." |
| 1216 | "Every reroof in Louisiana needs a permit and inspections." |
| 1217 | "Check our LSLBC license before you sign. {Lic}." |
| 1218 | "Reemplazo de techos con licencia en Luisiana." |
| 1225 | `repair.what`: AHS rates for the South census region (2.0 to 8.5 percent) |
| 1237 | `storm.unit`: "(hurricanes, tropical storms, thunderstorm wind, tornadoes)" |
| 1238 | `storm.what`: the whole paragraph (Atlantic storms 1950 to 2025, HURDAT2, modified Rankine profile, FEMA registrations from Katrina, Rita, Gustav, Ike and Isaac, the damage curve, SPC 1996 to 2025) |
| 1241-1245 | Storm angles: "Emergency Roof Tarping", "Storm tore your roof?", "Louisiana law requires a good faith itemized estimate. You get one before any work." (1244), "Lonas de emergencia" (1245) |
| 1247 | Keywords `hurricane roof damage`, `blue tarp roof`, `tree on roof` |
| 1249 | Negative `fema application` |
| 1252 | `hail.what`: SPC hail climatology figures "median 1.9" days a year (a Louisiana statistic) |
| 1257 | "Golf Ball Hail Damages Roofs" (hail is rare in most of California) |
| 1264-1275 | The whole FORTIFIED line: name, unit, `what` ("Louisiana Fortify Homes Program", "Restore ROOF", "coastal parishes (1.6 times) and hurricane frequency"), angles ("Ask how the Louisiana Fortify Homes grant of up to $10,000 works.", "Many Louisiana insurers file FORTIFIED discounts.", "Pregunte por la subvención de hasta $10,000 del programa Fortify Homes."), keywords `louisiana fortify homes program`, `fortified roof louisiana`, `subvencion techo luisiana` |
| 1278 | `metal.what`: "12 percent of residential reroofs statewide", "Steel mill producer prices rose 23 percent in the year to August 2026" (a dated statistic) |
| 1282 | "A Roof Built for Louisiana" |
| 1291 | `mh.what`: AHS South rates; "Mobile homes are not eligible for Fortify Homes grants." |
| 1303 | `mf.what`: "plus wind damage at 80 percent of the residential replacement rate" |
| 1315 | `comm.what`: "80,000 commercial roofs statewide", "plus wind damage at 70 percent of the residential rate and hail at 30 percent" |
| 1320 | "Hurricane Rated Roof Systems" / "Wind rated assemblies designed to the Louisiana building code." |
| 1340 | `newc.what`: "Census Building Permits Survey, 2023 to 2025 average by parish" |
| 1354 | `NEG_COMMON` other-state negatives: `texas, mississippi, arkansas, alabama, florida` |
| 1356, 1359 | `fillCopy`: `{Parish}` token; fallbacks `'Louisiana'` (City and Office); `'LSLBC license '` and `'LSLBC license number'` |

### 5.5 California changes
1. Service lines. `LINE_KEYS` (00_core line 593), `PL`, the ZIP columns `p_/r_/z_/f_` + key, and `META.pools/cases/fees/model.{W,corr,REP,VAL,GRADE,TIER}` must all use the same key set. Keys with no California meaning as written: `storm` (tropical wind), `hail`, `fortified`. Keys that carry over: `replace, repair, metal, mh, mf, comm, coat, newc`. Candidate California lines (decisions for the rebuild, not derivable from code): wind damage (Santa Ana and Diablo events), rain and leak response (atmospheric rivers), wildfire hardening / Class A roofs in fire hazard severity zones, cool roofs (energy code), tile roofs (clay and concrete are a large California stock; the Louisiana `metal_sh` column has no tile sibling), solar-related reroofs, coastal corrosion. Any module that prints "eleven service lines" (also line 7 and line 820) must match the new count.
2. `PL[].what` and `unit` must be rewritten from the California model. The census-region statistics change from the AHS "South" tables to "West" (the AHS also publishes California metro samples). The storm reset in the roof-age model (line 1211) and the FEMA-calibrated damage curve (line 1238) have no direct California equivalent.
3. `LAWX`, `ADRULES`, `LAWLINK`: every Louisiana entry must be replaced by researched California law. The table below gives leads only (my suggestions, not read from this code and not verified here; each needs a citation check before publication).

| Louisiana `id` | California topic to research (leads, unverified) |
|---|---|
| `resroof`, `thresholds`, `liab` | CSLB licensing: C-39 Roofing classification, the minor-work exemption amount, contractor bond, workers' compensation requirement for roofing licensees, licence number in all advertising (Business and Professions Code, Contractors State License Law) |
| `permit`, `code` | California Building Standards Code (Title 24): reroof permits by city/county, Chapter 15 / R9 roofing, Chapter 7A and Class A roofing in fire hazard severity zones, Part 6 cool roof requirements |
| `claimads`, `claimacts`, `deductible` | Rules on contractors and insurance claims (public adjuster licensing under the Insurance Code; insurance fraud; any deductible waiver rule) |
| `claimclock` | California Fair Claims Settlement Practices Regulations (acknowledge, accept or deny, pay timelines) |
| `fortify` | State mitigation programmes: California Wildfire Mitigation Program home-hardening grants, the Department of Insurance "Safer from Wildfires" discount regulation, any FORTIFIED recognition |
| `gouge` | Price gouging after a declared emergency (Penal Code) |
| `cooling` | Keep 16 CFR 429; add California home solicitation and home improvement contract cancellation rights (longer periods for seniors and for disaster repairs), and down-payment limits for home improvement contracts |
| `reviews`, `regz` | Keep (federal) |
| `tcpa` | Keep federal; replace the Louisiana do-not-call citation |
| `lutpa` | Unfair Competition Law and False Advertising Law (Business and Professions Code) and the Consumers Legal Remedies Act |
| `fraud` | Contractor fraud and diversion of funds; disaster-area unlicensed contracting penalties |
| `nhwa` | Right to Repair Act (SB 800) standards and limitation periods for new homes |
| `lien` | Mechanics lien law (Civil Code), preliminary notice |
| `threeyr` | Insurer non-renewal rules: wildfire moratoriums on non-renewal, the FAIR Plan, the Sustainable Insurance Strategy |
| `pending` | Current California bills on roofing, insurance and home hardening |

4. Copy angles: remove "Louisiana", "LSLBC", "Luisiana", hurricane and tarping framings; Spanish angles stay relevant (California's Spanish-speaking share is far higher), and other languages may deserve angle sets (`lang` codes beyond `es` would need support wherever `lang === 'es'` is tested: see sections 6 to 9).
5. `NEG_COMMON` other-state negatives become California's neighbours and common confusions (for example `oregon, nevada, arizona, texas, florida`).
6. `fillCopy`: fallbacks `'California'`; `{Parish}` token becomes `{County}` (or keep the token name and feed county names); `{Lic}` becomes `'CSLB license ' + number` (California practice is to print `Lic. #1234567`).
7. Questions not settled from this section: (a) which of the two FORTIFIED grades (`C` in `PL`, `D` in `META.model.GRADE`) the modules display; (b) the mapping of `META.model.ANCH.wind`'s three rates to event classes; (c) whether `LAWX.items[].lines` is used to filter the law list per service line in module 03 (outside my range).

---

## 6. 05_satchel_rules.js (lines 1364-1439)

### 6.1 What it is
The compliance rule pack. Header comment (line 1366): `satchel_rules: the Louisiana roofing pack (shared by the Desk, the Forge, the Satchel and Competitor Watch)`. Each rule is a regular-expression (or context) test over ad copy, page copy, contracts or page HTML that returns evidence text or null. Comment at 1368-1370, exact: `Each rule: id, fam, sev (block | warn | note), name, cite, v (✔ read from the primary text this build, ◐ secondary or platform policy), scope, test(text, ctx) -> evidence or null, fix, route. Context: {lic, offices[], certs, fortified, juris, res, page, web, headline, platform, channel, contract, noHouse}. A screen is research support, not a legal opinion.`

### 6.2 Globals
| Name | Line | Meaning |
|---|---|---|
| `RX_CLAIMSVC` | 1371 | regex: claim-handling / "claims specialist" wording |
| `RX_COVER` | 1372 | regex: "insurance will pay", "free roof", "no out of pocket", "insurance approved" |
| `RX_DED` | 1373 | regex: paying, waiving or rebating a deductible; gift cards tied to claims |
| `RX_FIN` | 1374 | regex: Regulation Z trigger terms ($/month, N payments, 0% APR, $0 down) |
| `RX_CERT` | 1375 | regex: manufacturer programme names (GAF Master Elite, Owens Corning Platinum Preferred, CertainTeed SELECT ShingleMaster, Malarkey, IKO, Atlas, Carlisle, Firestone, Johns Manville, Versico, Duro Last) |
| `SAT` | 1376-1431 | `{version: '2026-10-06', vertical: 'Roofing, Louisiana', rules[31], web[6], controls[10]}` |
| `satchelLint(text, ctx)` | 1432-1436 | runs `SAT.rules`; returns `[{rule, ev}]` |
| `satCtx(extra)` | 1437 | `{lic: BRAND.lic, offices: brandOffices(), certs: BRAND.certs, fortified: BRAND.fortified, juris: BRAND.juris \|\| 'Louisiana', ...extra}` |

Scope gating in `satchelLint` (line 1434): rules of family `Google Ads` or `Meta` are skipped when `ctx.web`; scope `headline` needs `ctx.headline`; `meta` needs `ctx.platform === 'meta'`; `asset` needs `ctx.asset`; `direct` needs `ctx.channel` (the tests look for `door|canvass` and `sms|call|voice`); `contract` needs `ctx.contract`; `copy` is skipped when `ctx.noHouse`. `SAT.web` rules take `(html, ctx)` and are run by callers, not by `satchelLint`.

### 6.3 DATA CONTRACT
No field of `window.__ATLAS_DATA__`, `META` or the weather snapshot is read. Inputs are text plus the `BRAND` record (`lic`, `certs`, `fortified`, `juris`, office cities).

### 6.4 The rules, copied exactly (this whole pack is Louisiana-specific unless marked)

`SAT.rules` (lines 1379-1409). Columns: v = verification mark.

| Line | id | fam | sev | v | scope | name | cite |
|---|---|---|---|---|---|---|---|
| 1379 | `LIC1` | LSLBC | block | ✔ | asset | Residential roofing advertised with no license on file | La. R.S. 37:2156.4 (Acts 2026, No. 757): advertising residential roofing of $7,500 or more requires the Residential Roofing or Residential Construction classification |
| 1380 | `LIC2` | LSLBC | note | ◐ | asset | License number not shown | Trust signal: owners verify on the LSLBC Contractor Search |
| 1381 | `LIC3` | LSLBC | warn | ◐ |  | "Licensed and insured" with nothing on file | La. R.S. 51:1405; La. R.S. 37:2156.1 ($500,000 liability for residential licensees from Aug. 1, 2026) |
| 1382 | `LIC4` | LSLBC | block | ✔ |  | Suggests skipping the permit | Acts 2025, No. 239 (permit and inspection for every roof and reroof from Aug. 1, 2025); Acts 2025, No. 422 (violations) |
| 1383 | `INS1` | Insurance claims | block | ✔ |  | Advertises claim handling or claims specialist services | La. R.S. 37:2159.1(7), (8) (Acts 2025, No. 144); R.S. 37:2159.1 (no adjusting) |
| 1384 | `INS2` | Insurance claims | warn | ✔ |  | Insurance adjacent wording needs care | La. R.S. 37:2159.1; La. R.S. 22:1693 (unauthorized public adjusting) |
| 1385 | `INS3` | Insurance claims | block | ✔ |  | Interprets coverage or implies insurance pays | La. R.S. 37:2159.1 (no interpreting policy provisions); La. R.S. 51:451 |
| 1386 | `DED1` | Insurance claims | block | ✔ |  | Offers to pay, waive or rebate a deductible | La. R.S. 51:451 (Acts 2022, No. 734) |
| 1387 | `DED2` | Insurance claims | block | ✔ | contract | Contract lacks the statutory deductible notice | La. R.S. 51:452 |
| 1388 | `AOB1` | Insurance claims | warn | ✔ |  | Assignment of benefits or direction to pay | La. R.S. 37:2159.1 (no assignment before the work is complete and the insurer has inspected) |
| 1389 | `ATTY1` | Insurance claims | warn | ✔ |  | Attorney referral or lawsuit talk | La. R.S. 37:2159.1 (no sharing in attorney fees or accepting referral consideration) |
| 1390 | `GOUGE` | Louisiana law | warn | ◐ |  | Storm pricing language | La. R.S. 29:732 (price gouging during a declared emergency) |
| 1391 | `COOL` | FTC | warn | ✔ | direct | Door to door sale: three day cancellation notice | 16 CFR Part 429 (FTC Cooling Off Rule) |
| 1392 | `TCPA` | FTC | warn | ◐ | direct | Calls or texts need written consent | 47 U.S.C. 227; 47 CFR 64.1200; La. R.S. 45:844.11 et seq. |
| 1393 | `SUP1` | Truth in advertising | warn | ◐ |  | Superlative or comparison needs substantiation | La. R.S. 51:1405 (LUTPA); FTC Act s. 5 |
| 1394 | `LIFE1` | Truth in advertising | warn | ◐ |  | Lifetime, proof or never claims | La. R.S. 51:1405; manufacturer warranty terms |
| 1395 | `WIND1` | Truth in advertising | note | ◐ |  | Wind speed rating claim | Manufacturer specifications; ASTM D3161 and D7158 wind classes; state building code |
| 1396 | `CERT1` | Truth in advertising | block | ◐ |  | Manufacturer certification not on file | Manufacturer program terms; La. R.S. 51:1405 |
| 1397 | `FORT1` | FORTIFIED | block | ◐ |  | FORTIFIED installer claim without certification on file | IBHS FORTIFIED program terms; La. R.S. 22:1483.1 (grant roofs are certified by an evaluator) |
| 1398 | `FORT2` | FORTIFIED | warn | ✔ |  | Promises an insurance discount size | R.S. 22:1483.1 (discounts are filed by each insurer; SB 222 of 2025, which would have mandated 20 to 30 percent, did not pass) |
| 1399 | `GRANT1` | FORTIFIED | warn | ◐ |  | Grant promise or wrong amount | R.S. 22:1483.1; LDI program rules (lottery rounds, up to $10,000, eligibility) |
| 1400 | `FIN1` | Financing | block | ✔ |  | Financing trigger term without the disclosures | 12 CFR 1026.24(d) (Regulation Z) |
| 1401 | `META1` | Meta | warn | ◐ | meta | Credit offer: Financial products special ad category | Meta Advertising Standards, special ad categories (financial products and services) |
| 1402 | `FTC1` | FTC | warn | ◐ |  | Review or rating claim must match real reviews | 16 CFR Part 465 (eff. Oct. 21, 2024); 16 CFR Part 255 |
| 1403 | `FTC2` | FTC | note | ◐ |  | "Free" needs its conditions | 16 CFR Part 251 |
| 1404 | `FTC3` | FTC | block | ✔ |  | Review incentive or gating | 16 CFR 465.4, 465.7 |
| 1405 | `STORM1` | Storm response | note | ◐ |  | Out of state storm crews | La. R.S. 37:2150.1 et seq. (every contractor needs the Louisiana license for the work); La. R.S. 14:202.1 |
| 1406 | `GADS1` | Google Ads | warn | ◐ | headline | Headline over 30 characters | Google Ads responsive search ad limits |
| 1407 | `GADS2` | Google Ads | warn | ◐ |  | Editorial: shouting or gimmicky punctuation | Google Ads editorial policy |
| 1408 | `HOUSE1` | House style | block | ✔ | copy | Hyphen or dash in copy | House style: no hyphens or dashes in copy |
| 1409 | `HOUSE2` | House style | block | ✔ | copy | Meta note or placeholder left in copy | House style: no explanatory or meta notes inside a deliverable |

Tests, fixes and routes (the `test` code is verbatim):

- **`LIC1`** (line 1379)
  ```js
  test: (t, c) => { if (!c || c.res === false) return null; return c.lic ? null : 'no LSLBC license number set in the Company panel'; }
  ```
  - fix: "Hold the Residential Roofing or Residential Construction classification before advertising replacements, then enter the license number in the Company panel."
  - route: "Remediation (self); LSLBC complaint (unlicensed competitor)"
- **`LIC2`** (line 1380)
  ```js
  test: (t, c) => { if (!c || !c.lic || c.res === false) return null; return t.includes(c.lic) ? null : `license ${c.lic} not in the asset set`; }
  ```
  - fix: "Add "LSLBC license #" and the number to a description, a callout or the landing page footer."
  - route: "Remediation (self)"
- **`LIC3`** (line 1381)
  ```js
  test: (t, c) => { const m = t.match(/(licensed (and|&) insured|fully insured|licensed,? bonded|bonded (and|&) insured)/i); if (!m) return null; return c && c.lic ? null : `"${m[0]}" with no license in the Company panel`; }
  ```
  - fix: "Claim only the license and coverage you hold; the license number substantiates the claim."
  - route: "Remediation (self); intelligence (competitor)"
- **`LIC4`** (line 1382)
  ```js
  test: t => { const m = t.match(/(no permits? (needed|required)|without (a |the )?permit|skip (the )?permit|permits? (are )?not (needed|required)|we don'?t pull permits)/i); return m ? `"${m[0]}"` : null; }
  ```
  - fix: "Every roofing and reroofing job needs a permit and inspections; say "permitted and inspected"."
  - route: "Remediation (self); LSLBC complaint (competitor)"
- **`INS1`** (line 1383)
  ```js
  test: t => { const m = t.match(RX_CLAIMSVC); return m ? `"${m[0]}"` : null; }
  ```
  - fix: "Advertise the roofing work (inspection, photo report, itemized estimate, repair), never the claim. Owners deal with their insurer or a licensed public adjuster."
  - route: "Remediation (self); LSLBC or LDI complaint (competitor)"
- **`INS2`** (line 1384)
  ```js
  test: t => { const m = t.match(/(meet (with )?(your |the )?adjuster|work(s|ing)? with (all |your )?insurance|insurance (work|jobs|restoration)|storm restoration (company|specialists?)|claim(s)? (approved|denied))/i); return m ? `"${m[0]}"` : null; }
  ```
  - fix: "Describe what the roofer does on the roof and in the estimate; a roofer may show damage to an adjuster but may not adjust or negotiate."
  - route: "Remediation (self)"
- **`INS3`** (line 1385)
  ```js
  test: t => { const m = t.match(RX_COVER); return m ? `"${m[0]}"` : null; }
  ```
  - fix: "Never say what a policy covers or that insurance will pay. "Get a written report of the damage" is safe."
  - route: "Remediation (self); intelligence (competitor)"
- **`DED1`** (line 1386)
  ```js
  test: t => { const m = t.match(RX_DED); return m ? `"${m[0]}"` : null; }
  ```
  - fix: "Remove it. Louisiana bars advertising, promising or agreeing to pay, waive, absorb or rebate a deductible, and padding the price to cover it."
  - route: "Remediation (self); LDI or attorney general complaint (competitor)"
- **`DED2`** (line 1387)
  ```js
  test: t => /Louisiana law requires a person insured under a property insurance policy to pay any deductible/i.test(t) ? null : 'notice not found'
  ```
  - fix: "Contracts of $1,000 or more expected to be paid from insurance must carry the R.S. 51:452 notice in at least 12 point bold type."
  - route: "Remediation (self)"
- **`AOB1`** (line 1388)
  ```js
  test: t => { const m = t.match(/(assignment of benefits|\baob\b|assign (your |the )?(claim|benefits|proceeds)|direction to pay)/i); return m ? `"${m[0]}"` : null; }
  ```
  - fix: "Do not take or advertise an assignment before the work is complete and the insurer has made its first inspection; limit any assignment to the contracted scope."
  - route: "Remediation (self)"
- **`ATTY1`** (line 1389)
  ```js
  test: t => { const m = t.match(/(our (attorney|lawyer)s?|we'?ll refer you to (an |a )?(attorney|lawyer)|sue (your )?insur\w*|lawsuit against (your )?insur\w*|bad faith claim)/i); return m ? `"${m[0]}"` : null; }
  ```
  - fix: "Keep attorneys out of roofing ads; never accept anything of value for a referral."
  - route: "Remediation (self)"
- **`GOUGE`** (line 1390)
  ```js
  test: t => { const m = t.match(/((storm|emergency|surge|hurricane) (pricing|rates?|surcharge)|prices? (go|going|will go) up after the storm|book before prices (rise|go up))/i); return m ? `"${m[0]}"` : null; }
  ```
  - fix: "During a declared emergency price only at pre storm levels plus documented cost increases; keep dated price books."
  - route: "Remediation (self); attorney general (competitor)"
- **`COOL`** (line 1391)
  ```js
  test: (t, c) => c && /^(door|canvass)$/.test(c.channel || '') ? 'sales made at the home carry a three business day right to cancel and the prescribed notice' : null
  ```
  - fix: "Give the buyer the cancellation notice and a copy of the contract; the emergency waiver applies only when the owner starts the contact and signs a separate waiver."
  - route: "Remediation (self)"
- **`TCPA`** (line 1392)
  ```js
  test: (t, c) => c && /^(sms|call|voice)$/.test(c.channel || '') ? 'marketing calls and texts: prior express written consent for autodialed or prerecorded messages; scrub the national and Louisiana Do Not Call lists' : null
  ```
  - fix: "Capture consent on your own forms (unchecked box, clear language); do not buy storm lead lists."
  - route: "Remediation (self)"
- **`SUP1`** (line 1393)
  ```js
  test: t => { const m = t.match(/(#\s?1\b|number one|\bbest\b[^.]{0,25}(roof|roofer|roofing|contractor|company)|top rated|highest rated|largest roofing|most trusted|premier\b|leading roof\w*)/i); return m ? `"${m[0]}"` : null; }
  ```
  - fix: "Cite a verifiable, dated basis beside the claim or remove it."
  - route: "Intelligence; complaint only if materially misleading"
- **`LIFE1`** (line 1394)
  ```js
  test: t => { const m = t.match(/(lifetime (roof|warranty|guarantee)|lasts? forever|never leaks?|leak ?proof|hurricane ?proof|storm ?proof|wind ?proof|guaranteed (to|not to) (leak|fail|blow))/i); return m ? `"${m[0]}"` : null; }
  ```
  - fix: "State the warranty exactly as written (who issues it, years, what it covers, transferability)."
  - route: "Remediation (self); intelligence (competitor)"
- **`WIND1`** (line 1395)
  ```js
  test: t => { const m = t.match(/(\d{2,3})\s?mph\b[^.]{0,30}(rated|rating|warranty|winds?)|withstands? \d{2,3}\s?mph/i); return m ? `"${m[0]}"` : null; }
  ```
  - fix: "Quote the rating of the specific product and installation (nail count, starter, high wind application) that earns it."
  - route: "Remediation (self)"
- **`CERT1`** (line 1396)
  ```js
  test: (t, c) => { const m = t.match(RX_CERT); if (!m) return null; const have = String((c && c.certs) || '').toLowerCase(); return have && have.includes(m[0].toLowerCase().split(' ').slice(-1)[0]) ? null : `"${m[0]}" is not in the Company panel certifications`; }
  ```
  - fix: "Claim only certifications you currently hold, named exactly as the manufacturer allows."
  - route: "Remediation (self); manufacturer report (competitor)"
- **`FORT1`** (line 1397)
  ```js
  test: (t, c) => { const m = t.match(/(fortified (roof )?(installer|contractor|certified|roofer)|install(s|ing)? fortified|fortified roofs? (installed|built) by)/i); if (!m) return null; return c && c.fortified ? null : `"${m[0]}" with no FORTIFIED status in the Company panel`; }
  ```
  - fix: "Only a FORTIFIED certified roofer advertises installing FORTIFIED Roofs; designations come from IBHS evaluators."
  - route: "Remediation (self); IBHS report (competitor)"
- **`FORT2`** (line 1398)
  ```js
  test: t => { const m = t.match(/(\d{1,2})\s?(%|percent) (insurance |premium )?(discount|savings|off (your )?(premium|insurance))|lower (your )?(premium|insurance) by|guaranteed (insurance )?discount|save \$?\d[\d,]* on (your )?insurance/i); return m ? `"${m[0]}"` : null; }
  ```
  - fix: "Say FORTIFIED roofs can qualify for discounts that insurers file, and send owners to their insurer for the figure."
  - route: "Remediation (self)"
- **`GRANT1`** (line 1399)
  ```js
  test: t => { const m = t.match(/(we (get|secure|guarantee) (you )?(the |a )?grant|grant (approved|guaranteed)|guaranteed grant|free fortified roof|up to \$?\s?(1[1-9]|[2-9]\d),?\d{3} (grant|from the state))/i); return m ? `"${m[0]}"` : null; }
  ```
  - fix: "Grants are awarded by LDI by lottery to eligible homeowners, up to $10,000, paid to the contractor after certification."
  - route: "Remediation (self)"
- **`FIN1`** (line 1400)
  ```js
  test: t => { const m = t.match(RX_FIN); if (!m) return null; return /annual percentage rate/i.test(t) ? null : `"${m[0].trim()}" with no annual percentage rate disclosure`; }
  ```
  - fix: "Add the down payment, terms of repayment and the annual percentage rate, or say only "financing available"."
  - route: "Remediation (self)"
- **`META1`** (line 1401)
  ```js
  test: t => /(financ\w*|monthly payments?|apr|\bloan\b|credit)/i.test(t) ? 'financing language in a Meta ad' : null
  ```
  - fix: "Run financing ads under the Financial products and services category (radius at least 15 miles, no age or gender targeting) or drop the financing line."
  - route: "Ad rejection (self)"
- **`FTC1`** (line 1402)
  ```js
  test: t => { const m = t.match(/(\d(\.\d)?\s?(★|stars?)|\d[\d,]*\+?\s*(five|5)\s?star|\d[\d,]*\+?\s*reviews)/i); return m ? `"${m[0]}"` : null; }
  ```
  - fix: "Quote the live count and the source with a date; never buy, gate or write reviews."
  - route: "Intelligence; FTC if fabricated"
- **`FTC2`** (line 1403)
  ```js
  test: t => { const m = t.match(/\bfree\b[^.]{0,40}/i); return m ? `"${m[0].trim()}"` : null; }
  ```
  - fix: "State what is free and any condition beside it."
  - route: "Intelligence"
- **`FTC3`** (line 1404)
  ```js
  test: t => { const m = t.match(/((leave|post|write) (us )?a (5|five) ?star review (for|to get)|review (for|in exchange for) (a )?(discount|gift card|entry|rebate)|only (happy|satisfied) customers? (review|asked))/i); return m ? `"${m[0]}"` : null; }
  ```
  - fix: "Ask every customer for an honest review, with no condition on sentiment."
  - route: "Remediation (self)"
- **`STORM1`** (line 1405)
  ```js
  test: t => { const m = t.match(/(out of state crews?|traveling crews?|storm teams? (coming|deployed|arriving)|we are in (your|the) area after the storm)/i); return m ? `"${m[0]}"` : null; }
  ```
  - fix: "Lead with the Louisiana license, a local office and a permit on every job; owners screen door knockers hard after storms."
  - route: "Intelligence"
- **`GADS1`** (line 1406)
  ```js
  test: t => String(t).length > 30 ? `${String(t).length} characters` : null
  ```
  - fix: "Cut to 30 characters or fewer."
  - route: "Ad disapproval (self)"
- **`GADS2`** (line 1407)
  ```js
  test: t => /([A-Z]{6,}\s+[A-Z]{4,})|!!|\?\?|\$\$/.test(t.replace(/FORTIFIED|LSLBC|IBHS|HOA|TPO|PVC|EPDM|FEMA|NOAA/g, '')) ? 'all caps run or repeated punctuation' : null
  ```
  - fix: "Use sentence case and single punctuation."
  - route: "Ad disapproval (self)"
- **`HOUSE1`** (line 1408)
  ```js
  test: t => { const m = String(t).replace(/https?:\/\/\S+/g, '').match(/\S*[‐-―−-]\S*/); return m && !/^\/|@/.test(m[0]) ? `"${m[0]}"` : null; }
  ```
  - fix: "Rewrite without the hyphen or dash (write "ring shank", "well being", "24 hour"). URLs are exempt."
  - route: "Remediation (self)"
- **`HOUSE2`** (line 1409)
  ```js
  test: t => { const m = t.match(/(\[[^\]]*\]|\bTBD\b|lorem ipsum|as an ai|note to (self|editor)|placeholder|insert (here|name)|\{\w+\}|LSLBC license number|Your company|our company|Your city)/i); return m ? `"${m[0]}"` : null; }
  ```
  - fix: "Fill the Company panel (name, license, office) or remove the note."
  - route: "Remediation (self)"

`SAT.web` (lines 1412-1417): tests over page HTML `h`.

| Line | id | sev | v | name | cite |
|---|---|---|---|---|---|
| 1412 | `WEB1` | warn | ◐ | LSLBC license number not on the page | R.S. 37:2156.4 (licensed to advertise); trust signal |
| 1413 | `WEB2` | warn | ◐ | No office location on the page | Google Business Profile and LSA verification; R.S. 51:1405 |
| 1414 | `WEB3` | warn | ◐ | Pre checked consent box | TCPA (47 U.S.C. 227); 47 CFR 64.1200 |
| 1415 | `WEB4` | warn | ◐ | Self served aggregateRating in schema | Google review snippet guidelines; 16 CFR Part 465 if fabricated |
| 1416 | `WEB5` | warn | ◐ | Tracking tags without a privacy notice | FTC Act s. 5; platform terms |
| 1417 | `WEB6` | block | ✔ | Claim services or deductible offers on the page | R.S. 37:2159.1(7), (8); R.S. 51:451 |

- **`WEB1`** (line 1412)
  ```js
  test: (h, c) => { if (!c || !c.lic) return 'no license number configured to check'; return h.includes(c.lic) ? null : `license ${c.lic} not found in the page source`; }
  ```
  - fix: "Put "LSLBC license" and the number in the footer of every page."
- **`WEB2`** (line 1413)
  ```js
  test: (h, c) => { const offs = c && c.offices ? c.offices : []; if (!offs.length) return 'no office city configured to check'; return offs.some(o => h.includes(o)) ? null : 'no office city found in the page source'; }
  ```
  - fix: "Show the office address or city in the footer and on the contact page."
- **`WEB3`** (line 1414)
  ```js
  test: h => /<input[^>]*type=["']?checkbox[^>]*checked/i.test(h) ? 'checkbox rendered checked' : null
  ```
  - fix: "Leave consent unchecked and optional for calls and texts."
- **`WEB4`** (line 1415)
  ```js
  test: h => /"aggregateRating"/i.test(h) ? 'aggregateRating in JSON LD' : null
  ```
  - fix: "Remove self served ratings from RoofingContractor schema; show real reviews with a dated source."
- **`WEB5`** (line 1416)
  ```js
  test: h => /(fbevents\.js|googletagmanager|gtag\(|tiktok|clarity\.ms)/i.test(h) && !/privacy/i.test(h) ? 'pixel or tag manager present, no privacy link found' : null
  ```
  - fix: "Link a privacy notice that names the data collected and how to opt out."
- **`WEB6`** (line 1417)
  ```js
  test: h => { const t = h.replace(/<[^>]+>/g, ' '); const m = t.match(RX_CLAIMSVC) || t.match(RX_DED); return m ? `"${m[0]}"` : null; }
  ```
  - fix: "Remove claim handling and deductible language from every page, including FAQ answers."

`SAT.controls` (lines 1420-1429): `[key, statement, rule ids]`.

| Line | key | Statement | Rules |
|---|---|---|---|
| 1420 | `licensed` | The Residential Roofing or Residential Construction classification is active before any residential roofing ad runs; the license number appears on ads and pages | LIC1, LIC2, WEB1 |
| 1421 | `permits` | Every job is permitted and inspected; no copy suggests otherwise | LIC4 |
| 1422 | `claims` | No claims specialist, claim help or coverage wording anywhere: ads, pages, scripts, door hangers | INS1, INS2, INS3, WEB6 |
| 1423 | `deductible` | No deductible offers; insurance funded contracts carry the 12 point bold notice | DED1, DED2 |
| 1424 | `estimates` | A good faith itemized estimate goes out before any repair agreement; no assignment of benefits before the work and the first inspection | AOB1 |
| 1425 | `reviews` | Reviews are real, ungated and dated; ratings shown with their source | FTC1, FTC3 |
| 1426 | `financing` | Financing ads carry full Regulation Z disclosures; Meta runs them as Financial products | FIN1, META1 |
| 1427 | `certs` | Manufacturer and FORTIFIED claims match current certifications; no discount or grant promises | CERT1, FORT1, FORT2, GRANT1 |
| 1428 | `door` | Door to door sales deliver the three day notice; no calls or texts without written consent | COOL, TCPA |
| 1429 | `gouge` | Price books dated before each declared emergency | GOUGE |

The five shared regexes, verbatim:

```js
const RX_CLAIMSVC = /(insurance )?claims? (specialists?|experts?|professionals?|consultants?|advocates?|navigators?)|we (handle|manage|file|process|negotiate|fight) (your |the )?(insurance )?claims?|(help|assist)(ing)? (you )?(with|file|filing|to file) (your |an |the )?(insurance )?claims?|insurance claims? (help|assistance|services|support)|(deal|deals|dealing) with (your )?(insurance company|insurer|adjuster) for you|we (talk|speak|negotiate) (to|with) (your )?(insurance|insurer|adjuster)/i;
const RX_COVER = /(your )?(policy|insurance) (covers|will cover|should cover|pays for|will pay)|(covered|paid for) by (your )?insurance|insurance (will|should) pay|free roof|no out of pocket|zero out of pocket|\$0 out of pocket|at no cost to you|insurance approved/i;
const RX_DED = /(pay|cover|waive|absorb|eat|rebate|credit|refund|reimburse|help (you )?with|take care of)\s+(your |the )?(insurance )?deductible|deductible (paid|waived|covered|assistance|rebate|credit|help)|no deductible|\$0 deductible|we'?ll (cover|handle) the deductible|(gift card|cash back|rebate|referral bonus)[^.]{0,40}(claim|insurance|deductible)/i;
const RX_FIN = /(\$\s?\d[\d,]*(\.\d\d)?\s?(\/|a |per )\s?mo(nth)?\b|\b\d+\s+(monthly )?payments\b|\b\d+\s?months? (financing|same as cash|no interest)|no (money|\$0) down|\$0 down|\b\d{1,2}(\.\d+)?\s?% (apr|interest|financing)|\b0%\s?(apr|interest|financing))/i;
const RX_CERT = /(GAF (Master Elite|Certified|President'?s Club|Certified Plus)|Master Elite|Owens Corning (Platinum Preferred|Platinum|Preferred|Certified)|Platinum Preferred|CertainTeed (SELECT ShingleMaster|ShingleMaster|Master Craftsman)|SELECT ShingleMaster|Malarkey (Emerald Pro|Certified)|IKO (ROOFPro|Shield Pro)|Atlas (Pro Plus|Pro)|Carlisle (Authorized|Certified)|Firestone (Master|Red Shield|Licensed)|Johns Manville (Peak|Certified)|Versico (Certified|Authorized)|Duro ?Last (Elite|Certified))/i;
```

### 6.5 LOUISIANA-SPECIFIC CONTENT in 05_satchel_rules.js (index; full text in 6.4)
| Line | Item |
|---|---|
| 1366 | Comment `the Louisiana roofing pack` |
| 1377 | `version: '2026-10-06', vertical: 'Roofing, Louisiana'` |
| 1379-1382 | Family `LSLBC` (`LIC1` to `LIC4`): La. R.S. 37:2156.4 (Acts 2026, No. 757), the $7,500 threshold, "Residential Roofing or Residential Construction classification", La. R.S. 37:2156.1 ($500,000 liability from Aug. 1, 2026), Acts 2025 Nos. 239 and 422; evidence strings `no LSLBC license number set in the Company panel`; fixes `Add "LSLBC license #" [...]`; routes `LSLBC complaint (unlicensed competitor)` |
| 1383-1389 | Family `Insurance claims` (`INS1, INS2, INS3, DED1, DED2, AOB1, ATTY1`): La. R.S. 37:2159.1(7), (8) (Acts 2025, No. 144), R.S. 22:1693 (unauthorized public adjusting), R.S. 51:451, R.S. 51:452; `DED1` fix `Remove it. Louisiana bars advertising, promising or agreeing to pay, waive, absorb or rebate a deductible, and padding the price to cover it.`; routes naming `LSLBC or LDI complaint`, `LDI or attorney general complaint` |
| 1387 | `DED2` test looks for the statutory sentence `/Louisiana law requires a person insured under a property insurance policy to pay any deductible/i`; fix: `Contracts of $1,000 or more expected to be paid from insurance must carry the R.S. 51:452 notice in at least 12 point bold type.` |
| 1390 | `GOUGE`: family literally named `Louisiana law`; La. R.S. 29:732; regex alternation `(storm\|emergency\|surge\|hurricane) (pricing\|rates?\|surcharge)` |
| 1392 | `TCPA`: `La. R.S. 45:844.11 et seq.`; evidence `[...] scrub the national and Louisiana Do Not Call lists` |
| 1393, 1394, 1396 | `SUP1`, `LIFE1`, `CERT1` cite `La. R.S. 51:1405 (LUTPA)`; `LIFE1` regex includes `hurricane ?proof\|storm ?proof\|wind ?proof` |
| 1397-1399 | Family `FORTIFIED` (`FORT1, FORT2, GRANT1`): La. R.S. 22:1483.1; `SB 222 of 2025, which would have mandated 20 to 30 percent, did not pass`; `LDI program rules (lottery rounds, up to $10,000, eligibility)`; `GRANT1` regex flags `up to $11,000`-and-above grant amounts (`(1[1-9]\|[2-9]\d),?\d{3}`), which encodes the $10,000 Louisiana cap; fix `Grants are awarded by LDI by lottery to eligible homeowners, up to $10,000, paid to the contractor after certification.` |
| 1405 | `STORM1`: `La. R.S. 37:2150.1 et seq. (every contractor needs the Louisiana license for the work); La. R.S. 14:202.1`; fix `Lead with the Louisiana license, a local office and a permit on every job; owners screen door knockers hard after storms.` |
| 1407 | `GADS2` acronym whitelist stripped before the all-caps test: `FORTIFIED\|LSLBC\|IBHS\|HOA\|TPO\|PVC\|EPDM\|FEMA\|NOAA` |
| 1409 | `HOUSE2` placeholder list includes `LSLBC license number\|Your company\|our company\|Your city` (the fallbacks produced by `fillCopy`, line 1359) |
| 1412, 1413, 1417 | `WEB1` (`LSLBC license number not on the page`, `R.S. 37:2156.4`, fix `Put "LSLBC license" and the number in the footer of every page.`), `WEB2` (`R.S. 51:1405`), `WEB6` (`R.S. 37:2159.1(7), (8); R.S. 51:451`) |
| 1420, 1423, 1427 | Control statements naming the Louisiana classification, the "12 point bold notice" and FORTIFIED grants |
| 1437 | `juris: BRAND.juris \|\| 'Louisiana'` |

Not Louisiana-specific (federal or platform; keep after re-verification): `COOL` (16 CFR 429), `FIN1` (12 CFR 1026.24(d)), `META1`, `FTC1` to `FTC3` (16 CFR 465, 255, 251), `WIND1`, `GADS1`, `GADS2` (except the whitelist), `HOUSE1`, `WEB3` to `WEB5`.

### 6.6 California changes
- Replace the pack with a California pack: same object shape (`id, fam, sev, name, cite, v, scope, test, fix, route`), so `satchelLint` and all callers work unchanged. Rule ids are referenced by `SAT.controls` and may be referenced by modules (the Satchel module 10, Desk, Forge, Watch); keep ids stable or grep the modules for each id before renaming.
- Families to rename: `LSLBC` -> `CSLB`; `Louisiana law` -> `California law`; `FORTIFIED` -> whatever mitigation programme line exists.
- Rules whose legal basis must be re-researched (leads only, unverified): licence number required in advertising and unlicensed advertising (CSLB); `LIC3` "licensed, bonded and insured" claims; `LIC4` permits; all `INS*`, `DED*`, `AOB1`, `ATTY1` (the claim-handling prohibitions are from Louisiana Acts 144 of 2025 and 734 of 2022; California's rules on contractors and claims differ and must be read from the Insurance Code and the Contractors State License Law); `GOUGE` (California's emergency price cap); `TCPA` state leg; `SUP1/LIFE1/CERT1` (UCL / FAL instead of LUTPA); `FORT1/FORT2/GRANT1`; `STORM1` (disaster-area contracting).
- `DED2` tests for the literal Louisiana statutory notice; a California edition needs the corresponding mandatory contract notices for home improvement contracts (cancellation notices, the CSLB notices), each as its own literal test.
- `GADS2` whitelist: add `CSLB`, `WUI`, `FAIR`, `HVAC` and other acronyms that will appear in California copy; remove `LSLBC`.
- `HOUSE2`: change `LSLBC license number` to the new `fillCopy` fallback string, or the placeholder will ship unnoticed.
- `GOUGE` and `LIFE1` regexes: add California wording (`wildfire`, `fire ?proof`, `fire season pricing`), drop or keep `hurricane`.
- New California-only screens worth considering (not in the Louisiana pack): fire-rating claims ("Class A", "fireproof", "ember resistant"), cool-roof energy-saving claims, solar/tax-credit claims, senior-targeted sales, down-payment language.
- `satCtx`: default `juris` `'California'`.
- Question: `ctx.res`, `ctx.page` and `ctx.asset` are set by callers outside this section; `ctx.page` and `ctx.juris` are not read by any rule in this pack.

---

## 7. 06_forge_compile.js (lines 1440-1719)

### 7.1 What it is
`FORGE_COMPILE`: a self-contained page compiler. It takes a page "blueprint" (a JSON description of one web page: sections, calls to action, media slots, SEO fields) and produces (a) Elementor container JSON, (b) semantic HTML, (c) a schema.org JSON-LD graph, (d) a standalone preview document, (e) SEO fields and (f) lint warnings. It knows nothing about roofing, Louisiana or the atlas data: all content arrives in the blueprint, which 08_forge_copy.js and the Forge module build.

### 7.2 Globals
One global, `FORGE_COMPILE` (line 1444, IIFE returning at 1717): `{compile, bundle, esc, slug, tel, hexmix, PREVIEW_CSS, Forge}`. (Inside the IIFE it has its own `esc` and `slug` that differ slightly from the core ones: `slug` cuts at 60 characters, not 70.)

| Member | Line | Meaning |
|---|---|---|
| `compile(bp, media)` | 1707-1710 | returns `{template, elementor_data, page_settings, html, preview, schema, seo, lint, page, blueprint}` |
| `bundle(bp, media, r)` | 1711-1716 | payload for the WordPress bridge: `{slug, title, post_title, status: 'draft', post_type, template, elementor_data, page_settings, content_html, seo, schema, blueprint (+media_resolved), summary, featured_media, ...}` |
| `Forge` class | 1459-1700 | methods: `m(key)` media slot, widget builders (`heading, text, button, image, video, ctaButtons, iconList`), one `s_TYPE(sec)` per section type, `stickyBar()`, `elementor()`, `pageSettings()`, `templateFile()`, `html()`, `htmlCtas()`, `htmlMedia()`, `htmlForm()`, `schema()`, `seo()`, `lint()` |
| `tel(s)` | 1450 | `'tel:' + digits` |
| `hexmix(c, white)` | 1448 | tint of a hex colour |
| `PREVIEW_CSS` | 1453 | stylesheet for the standalone preview, placeholders `%p %a %t %d %font %hfont` |

Blueprint contract (as read by the class)
- `bp.page`: `slug, title, h1, meta_description, canonical, noindex, language (default 'en-US', lines 1668 and 1705), template, custom_css, post_type, summary, archetype ('service' | 'practice' | 'location' | 'article'), service{}, entity{} (the organisation node for JSON-LD), schema_extra[], dates{published, modified}, breadcrumbs[{name, url}], internal_links[{anchor, url}], author{name, credentials, bio, url, media}, cta{primary{label, url, phone, phone_label}, ...}, conversion{trust[], sticky_mobile_bar, form{provider ('html' | 'elementor_pro' | 'wpforms' | 'gravity' | 'cf7' | 'fluent' | 'shortcode'), fields[{id, label, type, required, placeholder}], consent, name, button, email_to, success, shortcode, action}}`.
- `bp.site`: `url, name, brand{primary, accent, dark, globals, name, logo_url, font_body, font_heading}`.
- `bp.media`: `{slotKey: {url, alt, kind ('image' | 'video'), source}}`; unresolved slots get an inline SVG placeholder and a warning (line 1468-1469).
- `bp.sections[]`: each has `type` and optional `id, heading, style ('light' | 'tint' | 'dark' | 'brand'), width ('boxed' | 'narrow')`. Section types (lines 1517-1599 and 1621-1643): `hero, answer, key_facts, rich_text, steps, features, media, video, gallery, testimonials, stats, faq, cta_band, form, map, table, authors, links, html`.
- JSON-LD graph (lines 1663-1683): Organization (or `page.entity`), WebPage (+`speakable` when an `answer` section exists, `reviewedBy` from `page.author`), WebSite, BreadcrumbList, FAQPage, HowTo (a `steps` section with `howto`), Service (archetypes service/practice/location with `page.service`), Article, VideoObject, plus `page.schema_extra`.
- Lint (lines 1685-1699): title over 60 chars, meta description outside 70 to 160, no `answer` section, no FAQ, not exactly one hero, H1 over 70, media without alt, no primary CTA, no internal links, and the blocking strings `[[verify`, `lorem ipsum`, `todo:`, `xxx`, `placeholder text`.

### 7.3 DATA CONTRACT
None. No atlas data, `META` or weather field is read.

### 7.4 LOUISIANA-SPECIFIC CONTENT
None. Roofing-specific (not Louisiana) defaults:
| Line | Text |
|---|---|
| 1454 | Default form fields: `Full name`, `Phone`, `Email`, `Tell us about the roof` |
| 1455 | Default consent: `By submitting, you agree that we may contact you by phone, text or email about your request. Message and data rates may apply. Consent is not a condition of purchase. Reply STOP to opt out of texts.` |
| 1660 | Default form action `/wp-json/forge/v1/lead` (the bridge plugin's endpoint) |
| 1668, 1705 | Default language `en-US` |

### 7.5 California changes
None required. Optional: California privacy law (CCPA/CPRA) may call for a privacy-notice link next to the default consent sentence at line 1455; that is a content decision.

---

## 8. 07_forge_bridge_raw.js (lines 1720-1725)

### 8.1 What it is (summary only, as instructed)
One constant, `FORGE_BRIDGE_PHP` (line 1724, a 25,204-character string): the source of a WordPress plugin offered for download so that compiled pages can be imported into a WordPress site.

Plugin header: `Plugin Name: FORGE Bridge`, `Version: 1.1.0`, `Requires at least: 6.2`, `Requires PHP: 7.4`. Description: `REST bridge for FORGE — imports compiled pages (Elementor data, HTML fallback, SEO, JSON-LD), exposes the blueprint to headless front ends, serves llms.txt, accepts leads, pings headless revalidation, lists live URLs, and opens CORS for allowed origins (browser-side deploys).`

- One class `Forge_Bridge`, REST namespace `forge/v1`, settings option `forge_bridge_settings` (`cors_origins, indexnow_key, lead_email, llms_intro, revalidate_secret, revalidate_url`).
- REST routes: `GET /status`, `POST /import`, `POST /template`, `GET|POST /settings`, `GET /media/find`, `GET /nav` (public), `POST /lead` (public), `POST /indexnow`, `GET /urls`, `GET /pages`.
- `/import` accepts the `FORGE_COMPILE.bundle` payload (`slug, title, post_title, status, post_type, parent, template, elementor_data, page_settings, content_html, excerpt, featured_media, seo, schema, blueprint, summary`) and writes post meta: `_elementor_data, _elementor_edit_mode, _elementor_page_settings, _elementor_template_type, _elementor_version, _wp_page_template, _forge_summary`, and SEO fields for Yoast (`_yoast_wpseo_title, _yoast_wpseo_metadesc, _yoast_wpseo_canonical, _yoast_wpseo_meta-robots-noindex`), Rank Math (`rank_math_title, rank_math_description, rank_math_canonical_url, rank_math_robots`) and SEOPress (`_seopress_titles_title, _seopress_titles_desc, _seopress_robots_canonical, _seopress_robots_index`).
- Also: prints JSON-LD and SEO tags in `wp_head`, serves `llms.txt`, accepts leads (`name, phone, email, consent`, honeypot field `website`) and mails them, pings IndexNow and a headless revalidation URL, handles CORS, registers a custom post type for leads.

### 8.2 Data contract, Louisiana content, California changes
No atlas data is read; a search of the string for `louisiana`, `lslbc`, `parish`, `roof`, `hurricane`, `storm` finds nothing. Nothing changes for California.

---

## 9. 08_forge_copy.js (lines 1726-2114)

### 9.1 What it is
`FCOPY`: the copy library from which the Site Forge (module 09) builds website pages: one service page and one landing-page fragment per service line, home/city/parish/storm FAQs, six "data guides", Spanish landing fragments, the lead form fields, consent and the legal footer notice. Header comment (line 1730): `Site Forge: Louisiana roofing copy library`.

Comment at lines 1731-1736, exact: `Service page copy per line (keys match PL), home, about, city, parish and storm templates, data guides and Spanish fragments. Placeholders such as {city} are filled by FORGE.varsFor(); a value without data is dropped and the page is flagged. Every string that reaches a page passes houseClean (no hyphens or dashes, no meta notes) and the Compliance Satchel. Statements of Louisiana law follow the register in 04_content.js (read October 6, 2026) and carry their citations. Never in this file: claim handling, coverage promises, deductible offers, "free" without conditions, ratings, review counts, "best", "number one", "lifetime" or "hurricane proof".`

### 9.2 Globals
One global, `FCOPY` (line 1737, returned at 2112): `{LAWPUB, STEPS, AC, HOME_FAQ, CITY_FAQ, PARISH_FAQ, STORM_FAQ, STORM_LATE_FAQ, GUIDES, ES, FIELDS, CONSENT, NOTICE, RESULTS_NOTE}`.

| Member | Lines | Shape |
|---|---|---|
| `LAWPUB` | 1739-1760 | 20 public statements of law: key -> `[short title, plain statement, citation, url]` (comment 1738) |
| `STEPS` | 1762-1793 | process steps for 6 keys (`replace, repair, storm, hail, fortified, comm`), 4 steps `{title, text}` each; other lines reuse them through `AC[k].steps` |
| `AC` | 1797-1980 | one entry per service line key (all 11 of `LINE_KEYS`). Comment 1795-1796: `service lines: slug, statewide H1 (h1n), local H1 (h1), eyebrow, answer heading (aq), lede, landing lede (lp), answer, facts (service page), lfacts (landing page), law (LAWPUB keys), what, who, steps, faq, related lines, band, dl (key rule line)` |
| `HOME_FAQ` | 1982-1988 | 6 `{q, a}` |
| `CITY_FAQ` | 1990-1995 | 5 `{q, a}` |
| `PARISH_FAQ` | 1997-2001 | 4 `{q, a}` |
| `STORM_FAQ` | 2003-2007 | 4 `{q, a}` for pages about one named storm |
| `STORM_LATE_FAQ` | 2010-2014 | 4 `{q, a}`; comment 2009: `storm pages two to six years after the storm: hidden damage and replacement, no claims talk` |
| `GUIDES` | 2017-2085 | 6 guides `{id, scope ('state'\|'city'), line, label, h1, title, meta, answer, facts[], heads[3], body[3], faq[], table?}`; comment 2016: `data guides: scope 'state' (one page), 'city' (per plan city). Tokens are filled per page; heads name the three body sections.` |
| `ES` | 2088-2107 | Spanish fragments `{breadcrumbs, trust[], form{button, consent, fields[]}, cta{label, phone_label}, aq, answer{replace, storm, repair, general}, facts{permitV, permit, permitSrc, office, lic}, features[], faq[{id, q, a}], formHead, band{heading, text}, notice}`; comment 2087: `Spanish: landing pages only, built when someone at the company speaks Spanish with customers. The license and office repeat in Spanish.` |
| `FIELDS` | 2108 | lead form fields: `name` (Full name), `phone` (Phone), `email` (Email, optional), `address` (Property address), `message` (What is going on with the roof) |
| `CONSENT` | 2109 | `I agree that {brand} may call, text or email me about this request. Message and data rates may apply. Reply STOP to opt out of texts. Consent is not a condition of any purchase.` |
| `NOTICE` | 2110 | `{brand}. Louisiana State Licensing Board for Contractors license {lic}. Office: {officeAddr}. Every roofing job is permitted and inspected as Louisiana law requires. This page is general information about roofing, not insurance or legal advice; your insurer decides coverage under your policy.` |
| `RESULTS_NOTE` | 2111 | `Customer statements are shared with permission and describe one job. Every roof is different.` |

`AC[key]` fields: `meta` (meta description), `label`, `card` (one-line card text), `slug`, `h1n` (statewide H1), `h1` (local H1 with `{city}`), `title`, `eyebrow`, `aq` (answer heading), `lede`, `lp` (landing-page lede), `answer` (the citable answer capsule), `facts[]` and `lfacts[]` (fact keys), `law[]` (`LAWPUB` keys), `what` (HTML), `who` (HTML), `steps` (a `STEPS` key), `faq[{q, a}]`, `related[]` (line keys), `band` (CTA band heading), `dl` (one "key rule" line), `es{h[], d[]}` (Spanish headlines and descriptions).

### 9.3 DATA CONTRACT
This section reads no data field itself. Its contract with the data is the set of `{token}` placeholders and fact keys that the Site Forge must be able to fill. The filler is `varsFor()` and `factItem()` in module 09 (21_m09_forge.js, about lines 7092-7170, outside my range); the sources shown below are what I saw there and belong to that module's contract.

Tokens used in this file

| Token | Uses | Lines in this file (first 12) | Filled from (module 09, outside my range) |
|---|---|---|---|
| `{city}` | 50 | 1798, 1801, 1814, 1816, 1819, 1831, 1833, 1836, 1849, 1851, 1854, 1866 ... | page city name (`DATA.cities[].name`); for a parish page `"<parish> Parish"` (line 7140) |
| `{brand}` | 17 | 1801, 1819, 1836, 1854, 1871, 1888, 1905, 1921, 1937, 1953, 1969, 1983 ... | company name from the Forge site settings / `BRAND` |
| `{officeCity}` | 23 | 1801, 1814, 1819, 1831, 1836, 1849, 1854, 1866, 1871, 1883, 1888, 1900 ... | office city from settings |
| `{s_ra20}` | 2 | 1802, 2021 | `about(META.ra20)` - statewide roofs 20 years or older (line 7101) |
| `{s_wave}` | 2 | 1802, 2021 | `about(META.wave)` - roofs reaching 20 within five years (line 7101) |
| `{s_storms}` | 1 | 1837 | `N(ST.storms)` - count of named storms 2002 to 2026 (line 7102) |
| `{s_h1}` | 2 | 1855, 2045 | `N(ST.h1)` - NOAA reports of hail 1 inch or larger, 2016 to 2026 (line 7102) |
| `{s_grant}` | 2 | 1872, 2067 | `M$(META.fort.grant \|\| 10000)` (line 7102) |
| `{s_steelMove}` | 1 | 1889 | `rose\|fell N%` from the steel PPI series `DATA.ts.ppi.steel` (line 7103) |
| `{s_ppiMonth}` | 1 | 1889 | month of the last PPI point (line 7103) |
| `{s_mh}` | 1 | 1906 | `about(META.mh)` - mobile homes statewide (line 7101) |
| `{s_permits}` | 1 | 1970 | statewide permitted housing units (`DATA.ts.permits`) (line 7103) |
| `{s_permitYear}` | 1 | 1970 | year of that permit figure (line 7103) |
| `{lineList}` | 1 | 1983 | list of the company's service lines (line 7098) |
| `{officeLine}` | 1 | 1984 | sentence `Our office is at <street>, <city>, Louisiana <zip>.` (line 7095) |
| `{areaList}` | 1 | 1984 | first six plan cities, or `Louisiana` (line 7096) |
| `{lic}` | 4 | 1985, 2090, 2106, 2110 | licence number from settings |
| `{phone}` | 2 | 1988, 2092 | `phoneFmt` of the company phone |
| `{cityServe}` | 1 | 1991 | sentence built at line 7123 (`[...] across <parish> Parish [...]`) |
| `{c_ra20_sh}` | 2 | 1992, 2078 | share of roofs 20 years or older in the city's ZIPs (line 7119) |
| `{c_wave}` | 2 | 1992, 2078 | city roofs reaching 20 within five years (line 7119) |
| `{c_ageWhy}` | 2 | 1992, 2078 | sentence from `ageWhy()` (line 7119) |
| `{c_stormSentence}` | 3 | 1993, 2078, 2081 | sentence from `stormSentence()` (line 7122) |
| `{c_hailSentence}` | 2 | 1993, 2078 | sentence from `hailSentence()` (line 7122) |
| `{nearby}` | 1 | 1995 | nearest plan cities (line 7126) |
| `{parish}` | 5 | 1998, 1999, 2000, 2001 | parish name (line 7109) |
| `{parishCities}` | 1 | 1998 | cities in the parish (line 7113) |
| `{p_ra20}` | 1 | 1999 | parish roofs 20 years or older (line 7109) |
| `{p_roofs}` | 1 | 1999 | parish one-unit roofs (line 7109) |
| `{p_ageWhy}` | 1 | 1999 | sentence (line 7109) |
| `{p_stormSentence}` | 1 | 2000 | sentence (line 7110) |
| `{st_name}` | 3 | 2004, 2011, 2012 | storm name from `DATA.routes` (line 7131) |
| `{s_hailPeak}` | 2 | 2045, 2051 | peak hail month name from `DATA.ts.month.hail` (line 7102) |
| `{s_h175}` | 1 | 2045 | `N(ST.h175)` - reports of 1.75 inch hail or larger (line 7102) |
| `{s_out}` | 1 | 2056 | `META.lic.out / META.lic.n` as a percent: share of roofing licence records based out of state (line 7104) |
| `{c_roofs}` | 1 | 2080 | one-unit roofs in the city's ZIPs (line 7119) |
| `{c_femaSentence}` | 1 | 2081 | sentence from `femaSentence()` (line 7122) |
| `{officeAddr}` | 2 | 2106, 2110 | `<street>, <city>, Louisiana <zip>` (line 7093) |

Fact keys named in `facts` / `lfacts` (each must exist in module 09's `factItem` table, lines 7155 onward, where each fact is `[value, label, source, grade]`):

| Fact key | Lines where requested |
|---|---|
| `s_ra20` | 1803, 1821, 2022 |
| `s_wave` | 1803, 1873, 2022 |
| `life_fact` | 1803, 1821, 1923, 2022 |
| `permit_fact` | 1803, 1821, 1873, 1890, 1907, 1923, 1939, 1955, 1971, 2057, 2068 |
| `c_ra20` | 1803, 1821, 2079 |
| `lic7500` | 1803, 1821, 1873, 1890, 1907, 1971, 2057, 2068 |
| `s_storms` | 1838, 2034, 2068 |
| `s_fema` | 1838, 2034 |
| `clock_fact` | 1838, 1856, 2034, 2046 |
| `ded_fact` | 1838, 1856, 2034 |
| `c_last` | 1838 |
| `s_h1` | 1856, 2046 |
| `s_h175` | 1856, 2046 |
| `c_h1` | 1856, 2079 |
| `grant_fact` | 1873, 2068 |
| `liab_fact` | 1873, 1923, 2057 |
| `life_metal` | 1890 |
| `s_steel_fact` | 1890 |
| `s_mh` | 1907 |
| `mh_cost` | 1907 |
| `gouge_fact` | 1907 |
| `comm_fact` | 1923, 1939, 1955 |
| `life_comm` | 1939 |
| `lien_fact` | 1939 |
| `life_coat` | 1955 |
| `s_permits_fact` | 1971 |
| `nhwa_fact` | 1971 |
| `s_nxt` | 2022 |
| `hail_season` | 2046 |
| `s_out` | 2057 |
| `c_roofs` | 2079 |
| `c_fema` | 2079 |

Reading the prefixes: `s_` statewide figure, `c_` city figure (the city's ZIP codes), `p_` parish figure, `st_` named-storm figure; `*_fact` are fixed legal or industry facts (`permit_fact`, `lic7500`, `liab_fact`, `comm_fact`, `clock_fact`, `ded_fact`, `gouge_fact`, `grant_fact`, `nhwa_fact`, `lien_fact`, `life_fact`, `life_metal`, `life_comm`, `life_coat`, `mh_cost`, `hail_season`).

### 9.4 `LAWPUB` (lines 1740-1759), copied exactly

| Line | key | Short title | Citation | URL |
|---|---|---|---|---|
| 1740 | `resroof` | Licensed to sell residential roofing | La. R.S. 37:2156.4 (Acts 2026, No. 757) | `https://lslbc.gov/wp-content/uploads/LSLBC_Memorandum_Statutory_Changes_July_13_2026_REVISED.pdf` |
| 1741 | `permit` | Permits and inspections | Acts 2025, No. 239; Acts 2025, No. 422 | `https://lslbc.gov/wp-content/uploads/LSLBC_Memorandum_Statutory_Changes_July_13_2026_REVISED.pdf` |
| 1742 | `liab` | Liability coverage | La. R.S. 37:2156.1 | `https://lslbc.gov/wp-content/uploads/LSLBC_Memorandum_Statutory_Changes_July_13_2026_REVISED.pdf` |
| 1743 | `thresholds` | Which license a job needs | La. R.S. 37:2150.1 and following | `https://lslbc.gov/wp-content/uploads/2025/06/Licensing-Requirements-for-Contractors-in-Louisiana.pdf` |
| 1744 | `deductible` | The deductible is the owner's to pay | La. R.S. 51:451, 51:452 | `https://legis.la.gov/legis/ViewDocument.aspx?d=1290211` |
| 1745 | `claims` | Roofers do not handle claims | La. R.S. 37:2159.1; La. R.S. 22:1706(H)(11) | `https://legis.la.gov/legis/ViewDocument.aspx?d=1427858` |
| 1746 | `estimate` | An itemized estimate first | La. R.S. 37:2159.1 | `https://legis.la.gov/legis/ViewDocument.aspx?d=1290211` |
| 1747 | `aob` | Assignments of benefits | La. R.S. 37:2159.1 | `https://legis.la.gov/legis/ViewDocument.aspx?d=1290211` |
| 1748 | `clock` | The insurer's clock | La. R.S. 22:1892 | `https://legis.la.gov/legis/ViewDocument.aspx?d=1372369` |
| 1749 | `cooling` | Three days to cancel | 16 CFR Part 429 | `https://www.ecfr.gov/current/title-16/chapter-I/subchapter-D/part-429` |
| 1750 | `gouge` | Prices after a disaster | La. R.S. 29:732 | `https://legis.la.gov/legis/LawSearch.aspx` |
| 1751 | `fortify` | FORTIFIED grants | La. R.S. 22:1483.1 | `https://legis.la.gov/legis/ViewDocument.aspx?d=1384506` |
| 1752 | `threeyr` | Renewals of older policies | Acts 2024, No. 9 | `https://legis.la.gov/legis/BillInfo.aspx?s=24RS&b=HB611&sbi=y` |
| 1753 | `code` | The building code | La. R.S. 40:1730.21 and following | `https://lsuccc.dps.louisiana.gov/` |
| 1754 | `recover` | Recover or tear off | International Residential Code R908.3.1.1 | (empty) |
| 1755 | `reviews` | Honest reviews | 16 CFR Part 465 | `https://www.ecfr.gov/current/title-16/chapter-I/subchapter-D/part-465` |
| 1756 | `regz` | Financing terms | 12 CFR 1026.24 | `https://www.ecfr.gov/current/title-12/chapter-X/part-1026/subpart-C/section-1026.24` |
| 1757 | `fraud` | Home improvement fraud | La. R.S. 14:202, 14:202.1 | `https://legis.la.gov/legis/LawSearch.aspx` |
| 1758 | `lien` | Liens on private works | La. R.S. 9:4801 and following | `https://legis.la.gov/legis/LawSearch.aspx` |
| 1759 | `nhwa` | The new home warranty | La. R.S. 9:3141 and following | `https://lslbc.gov/wp-content/uploads/New_Home_Warranty_Act.pdf` |

Plain statements:

- `resroof` (line 1740): "Since August 1, 2026, anyone who advertises, bids, contracts for or performs roofing work of $7,500 or more on a home of up to four units must hold the Residential Roofing or Residential Construction license from the Louisiana State Licensing Board for Contractors."
- `permit` (line 1741): "Every roof and reroof on a home or a commercial building needs a permit from the parish or city and the inspections it requires, for projects beginning on or after August 1, 2025. Starting before the permit issues or skipping inspections is a licensing violation."
- `liab` (line 1742): "Residential contractors licensed by the board must keep at least $500,000 in liability coverage on file with it, with workers compensation kept in force while the license is active."
- `thresholds` (line 1743): "Commercial work of $50,000 or more needs a commercial license with the right classification. Residential work of $50,000 or more, or any structural work, needs a residential building license; home improvement work over $7,500 needs at least a registration, and residential roofing of $7,500 or more needs the roofing license."
- `deductible` (line 1744): "A contractor paid from a property insurance claim may not advertise, promise or agree to pay any part of the owner's deductible, to waive or rebate it, or to raise the price to make up for it. A contract of $1,000 or more expected to be paid from insurance must carry the statutory deductible notice in bold type."
- `claims` (line 1745): "A contractor may not interpret the terms of a policy, adjust or negotiate a claim, or advertise as a specialist in insurance claims or in reading policies, and a public adjuster may not do the roofing on a claim the adjuster handles."
- `estimate` (line 1746): "Before any repair agreement on an insurance funded job, the contractor must give the owner a good faith itemized estimate of the services and materials."
- `aob` (line 1747): "A contractor may not take an assignment of the owner's insurance benefits before the work is complete and the insurer has made its first inspection, and then only for the contracted work."
- `clock` (line 1748): "After notice of a property claim, an insurer must begin adjusting within 14 days, or within 30 days after a catastrophic loss, and must make a written offer within 30 days of satisfactory proof of loss."
- `cooling` (line 1749): "A sale of $25 or more made at the buyer's home can be cancelled within three business days, and the seller must hand over the cancellation notice the federal rule prescribes."
- `gouge` (line 1750): "While a state of emergency is declared, prices for goods and services in the area may not rise above what was charged before the emergency, except for documented increases in cost."
- `fortify` (line 1751): "The Louisiana Fortify Homes Program pays grants of up to $10,000 toward a roof built to the IBHS FORTIFIED Roof standard on eligible homes: owner occupied with a homestead exemption, insured with wind coverage, and with flood insurance where the home is in a flood zone. Rounds are drawn by lottery, and the grant is paid to the contractor after the roof is certified."
- `threeyr` (line 1752): "Since August 1, 2024, insurers may file plans to nonrenew some homeowners policies that have been in force more than three years, and since January 1, 2025 they may change deductibles and coverage on them."
- `code` (line 1753): "Louisiana enforces the International Residential and Building Codes as adopted with state amendments, including the roof covering, underlayment and wind provisions that depend on the design wind speed where the building stands."
- `recover` (line 1754): "Under the residential code, a new roof covering may not go over a roof that already has two layers, that is water soaked or deteriorated, or that is slate, clay or cement tile."
- `reviews` (line 1755): "Federal rules bar fake reviews, reviews bought on the condition that they are positive, undisclosed reviews by staff or family and the suppression of negative reviews."
- `regz` (line 1756): "An ad that states a monthly payment, a number of payments, a down payment or a finance charge must also state the down payment, the repayment terms and the annual percentage rate."
- `fraud` (line 1757): "Taking payment for home improvement work and failing to perform it, or misapplying money meant for materials and subcontractors, are crimes in Louisiana."
- `lien` (line 1758): "Contractors, subcontractors and suppliers on private works keep their lien rights only by meeting the notice and filing deadlines of the Private Works Act."
- `nhwa` (line 1759): "Builders warrant new homes for one year against defects from noncompliance with building standards, two years for plumbing, electrical, heating and cooling, and five years for major structural defects."

`LAWPUB` keys differ from `LAWX` ids in 04_content.js: `claims` (LAWX `claimads` + `claimacts`), `estimate`, `aob` (parts of `claimacts`), `clock` (`claimclock`), `recover` (IRC R908.3.1.1, not in LAWX); `LAWX.tcpa` and `LAWX.lutpa` have no public statement.

### 9.5 `AC` short fields, copied exactly

| Line | key | slug | label | h1n | h1 | title | eyebrow |
|---|---|---|---|---|---|---|---|
| 1798 | `replace` | `roof-replacement` | Roof replacement | Roof Replacement in Louisiana | Roof Replacement in {city} | Roof Replacement in Louisiana | Roof replacement |
| 1816 | `repair` | `roof-repair` | Roof repair and leaks | Roof Repair and Leak Repair in Louisiana | Roof Repair in {city} | Roof Repair and Leaks in Louisiana | Roof repair and leaks |
| 1833 | `storm` | `storm-damage-roof-repair` | Storm and wind damage | Storm Damage Roof Repair in Louisiana | Storm Damage Roof Repair in {city} | Storm Damage Roof Repair in Louisiana | Storm and wind damage |
| 1851 | `hail` | `hail-damage-roof-repair` | Hail damage | Hail Damage Roof Repair in Louisiana | Hail Damage Roof Repair in {city} | Hail Damage Roof Repair in Louisiana | Hail damage |
| 1868 | `fortified` | `fortified-roof` | FORTIFIED roofs | FORTIFIED Roofs in Louisiana | FORTIFIED Roof in {city} | FORTIFIED Roofs and Louisiana Grants | FORTIFIED roofs |
| 1885 | `metal` | `metal-roofing` | Metal roofing | Metal Roofing in Louisiana | Metal Roofing in {city} | Metal Roofing in Louisiana | Metal roofing |
| 1902 | `mh` | `mobile-home-roofing` | Manufactured home roofs | Mobile Home Roofing in Louisiana | Mobile Home Roofing in {city} | Mobile Home Roofing in Louisiana | Manufactured home roofs |
| 1918 | `mf` | `multifamily-roofing` | Multifamily, condo and HOA | Multifamily and HOA Roofing in Louisiana | Multifamily Roofing in {city} | Apartment, Condo and HOA Roofing | Multifamily, condo and HOA |
| 1934 | `comm` | `commercial-roofing` | Commercial roof replacement | Commercial Roofing in Louisiana | Commercial Roofing in {city} | Commercial Roof Replacement in Louisiana | Commercial roofing |
| 1950 | `coat` | `roof-coatings` | Restoration, coatings and maintenance | Roof Coatings and Restoration in Louisiana | Roof Coatings in {city} | Roof Coatings and Restoration in Louisiana | Restoration and maintenance |
| 1966 | `newc` | `new-construction-roofing` | New construction roofing | New Construction Roofing in Louisiana | New Construction Roofing in {city} | New Construction Roofing in Louisiana | New construction |

| key | `meta` (same line as above) | `card` |
|---|---|---|
| `replace` | When a Louisiana roof needs replacing, what a replacement includes, the permit and license rules and how to compare written estimates. | Full roof replacement for homes, with an itemized estimate, a permit and the inspections. |
| `repair` | Roof leaks in Louisiana: how leaks are found and fixed, what a repair should cost you in time and paperwork, and when a repair is no longer enough. | Leaks, flashing, vent boots, missing shingles and storm patches, found at the source. |
| `storm` | Storm and wind damage to Louisiana roofs: what to do first, tarping, inspections and photo reports, permits, and the rules on claims and deductibles. | Emergency tarping, storm inspections with photo reports, and repairs or replacement after wind damage. |
| `hail` | Hail damage to Louisiana roofs: what size hail damages shingles, how to check from the ground, inspections, and the rules on claims and deductibles. | Hail inspections with photo reports, repairs and replacement, with impact rated shingles where hail is common. |
| `fortified` | FORTIFIED roofs in Louisiana: what the IBHS standard adds over a code roof, the Fortify Homes grant of up to $10,000, eligibility and the process. | Roofs built and documented to the IBHS FORTIFIED Roof standard, including Fortify Homes grant work. |
| `metal` | Metal roofing in Louisiana: standing seam and exposed fastener panels, how long they last, coastal coatings, wind ratings and what drives the price. | Standing seam and exposed fastener metal roofs for homes, camps and outbuildings. |
| `mh` | Mobile and manufactured home roofs in Louisiana: leak repair, roof over systems, metal and membrane options, and what to expect for the price. | Leak repair and roof over systems for mobile and manufactured homes. |
| `mf` | Roofing for Louisiana apartment, condo and HOA buildings: surveys, phasing, reserve planning, tenant notices and low slope and steep slope systems. | Roof surveys, replacement and phased work for apartments, condominiums and HOAs. |
| `comm` | Commercial roof replacement in Louisiana: TPO, PVC, modified bitumen, built up and metal systems, surveys, licensing, permits and warranties. | Low slope and metal roof replacement for commercial, industrial and institutional buildings. |
| `coat` | Commercial roof coatings, restoration and maintenance in Louisiana: when a coating works, silicone and acrylic systems, warranties and maintenance plans. | Silicone and acrylic restoration, metal roof coatings and maintenance programs. |
| `newc` | New construction roofing in Louisiana: roofing for builders and owners, scheduling with framing, the building code, inspections and the new home warranty. | Roofing for builders and owners building new homes and buildings. |

| key | aq (line) | facts | lfacts | law | steps | related | band | dl (key rule line) |
|---|---|---|---|---|---|---|---|---|
| `replace` | When does a Louisiana roof need replacing? (1799) | s_ra20, s_wave, life_fact, permit_fact | c_ra20, permit_fact, lic7500 | resroof, permit, liab, recover, cooling, regz | replace | repair, metal, fortified | Get an itemized roof replacement estimate | Every reroof needs a permit and inspections, and residential roofing of $7,500 or more needs the LSLBC license. |
| `repair` | How are roof leaks found and fixed? (1817) | s_ra20, life_fact, permit_fact, lic7500 | c_ra20, permit_fact, lic7500 | permit, resroof, cooling | repair | replace, storm, hail | Get a roof leak found and fixed | Residential roofing of $7,500 or more needs the LSLBC license. |
| `storm` | What should you do after a storm damages your roof? (1834) | s_storms, s_fema, clock_fact, ded_fact | c_last, clock_fact, ded_fact | claims, deductible, estimate, aob, clock, gouge, cooling, permit | storm | repair, hail, fortified | Get your storm damage inspected | Roofers may not interpret policies, handle claims or take on any part of a deductible under Louisiana law. |
| `hail` | Did the hail damage your roof? (1852) | s_h1, s_h175, clock_fact, ded_fact | c_h1, clock_fact, ded_fact | claims, deductible, estimate, clock, cooling, permit | hail | storm, replace, repair | Get your roof checked for hail damage | Golf ball hail damages most asphalt shingles; your insurer decides coverage. |
| `fortified` | What is a FORTIFIED roof? (1869) | grant_fact, s_wave, liab_fact, permit_fact | grant_fact, permit_fact, lic7500 | fortify, permit, resroof, code | fortified | replace, storm, metal | Ask about a FORTIFIED roof | Grants of up to $10,000 are drawn by lottery; discounts vary by insurer. |
| `metal` | Is a metal roof right for a Louisiana home? (1886) | life_metal, s_steel_fact, permit_fact, lic7500 | life_metal, permit_fact, lic7500 | resroof, permit, regz, cooling | replace | replace, mh, fortified | Get a metal roofing estimate | Residential roofing of $7,500 or more needs the LSLBC license. |
| `mh` | What are the options for a leaking mobile home roof? (1903) | s_mh, mh_cost, permit_fact, gouge_fact | s_mh, permit_fact, lic7500 | permit, cooling, gouge, regz | repair | repair, metal, storm | Get your mobile home roof fixed | Prices after a declared emergency may rise only by documented costs. |
| `mf` | How do apartment and HOA roof projects work? (1919) | permit_fact, comm_fact, liab_fact, life_fact | permit_fact, comm_fact | thresholds, permit, lien, code | comm | comm, coat, storm | Plan your multifamily roof project | Commercial roofing of $50,000 or more needs a commercial license with the roofing classification. |
| `comm` | When does a commercial roof need replacing? (1935) | comm_fact, permit_fact, life_comm, lien_fact | comm_fact, permit_fact | thresholds, permit, lien, code, gouge | comm | coat, mf, storm | Schedule a commercial roof survey | Commercial roofing of $50,000 or more needs a commercial license with the roofing classification. |
| `coat` | When does a roof coating make sense? (1951) | life_coat, permit_fact, comm_fact | life_coat, permit_fact | thresholds, permit, lien | comm | comm, mf, metal | Find out if your roof can be restored | Coatings work only over a dry, sound substrate. |
| `newc` | How does roofing fit a new construction schedule? (1967) | s_permits_fact, permit_fact, nhwa_fact, lic7500 | permit_fact, nhwa_fact | code, permit, nhwa, lien, thresholds | replace | replace, metal, fortified | Talk with us about your build | Roofing follows the building code and the builder's New Home Warranty obligations. |

Where the long fields sit (line numbers): 

| key | lede | lp | answer | what | who | faq starts | band/dl | es |
|---|---|---|---|---|---|---|---|---|
| `replace` | 1800 | 1801 | 1802 | 1804 | 1805 | 1807 | 1813 | 1814 |
| `repair` | 1818 | 1819 | 1820 | 1822 | 1823 | 1825 | 1830 | 1831 |
| `storm` | 1835 | 1836 | 1837 | 1839 | 1840 | 1842 | 1848 | 1849 |
| `hail` | 1853 | 1854 | 1855 | 1857 | 1858 | 1860 | 1865 | 1866 |
| `fortified` | 1870 | 1871 | 1872 | 1874 | 1875 | 1877 | 1882 | 1883 |
| `metal` | 1887 | 1888 | 1889 | 1891 | 1892 | 1894 | 1899 | 1900 |
| `mh` | 1904 | 1905 | 1906 | 1908 | 1909 | 1911 | 1915 | 1916 |
| `mf` | 1920 | 1921 | 1922 | 1924 | 1925 | 1927 | 1931 | 1932 |
| `comm` | 1936 | 1937 | 1938 | 1940 | 1941 | 1943 | 1947 | 1948 |
| `coat` | 1952 | 1953 | 1954 | 1956 | 1957 | 1959 | 1963 | 1964 |
| `newc` | 1968 | 1969 | 1970 | 1972 | 1973 | 1975 | 1978 | 1979 |

The `answer` capsules, copied exactly (they carry the data tokens and most of the Louisiana statements):

- `replace` (line 1802): "An asphalt shingle roof in Louisiana usually lasts about twenty years, less where hurricanes and hail have worked on it and more on a well vented, well installed roof. About {s_ra20} Louisiana roofs are already 20 years or older, and another {s_wave} reach that age within five years. Curling or missing shingles, bare spots where the granules have worn off, daylight in the attic and repeated leaks are the signs it is time. Since August 1, 2025 every reroof needs a permit and inspections."
- `repair` (line 1820): "Most leaks come from the details rather than the shingles: flashing at walls and chimneys, rubber boots around vent pipes, valleys, and nails that have backed out. Water runs along the deck before it drips, so a roofer traces it from the attic and the roof rather than patching above the stain. A roof with repeated leaks in different places, widespread granule loss or soft decking is usually near the end of its life; at that point a repair buys time, not years."
- `storm` (line 1837): "Stay off the roof, photograph the damage from the ground and inside, and keep water out with a tarp. A licensed roofer then inspects every slope and gives you a written photo report and an itemized estimate. Your insurer decides coverage under your policy. Louisiana law bars roofers from interpreting policies, adjusting claims or offering to pay any part of a deductible, and an insurer must begin adjusting within 14 days of notice, or 30 days after a catastrophe. From 2002 to 2026, {s_storms} named storms brought tropical storm force winds to Louisiana."
- `hail` (line 1855): "Hail of about one inch begins to bruise asphalt shingles and knock granules loose, and hail of 1.75 inches, golf ball size, damages most shingles outright. The damage is easy to miss from the ground: dented gutters, vents and air conditioner fins are the first clues. NOAA logged {s_h1} reports of hail one inch or larger in Louisiana from 2016 to 2026, most of them in spring. A roofer's inspection documents bruised and cracked shingles slope by slope; your insurer decides coverage under your policy."
- `fortified` (line 1872): "FORTIFIED Roof is a standard from the Insurance Institute for Business and Home Safety that goes beyond the building code: a sealed roof deck so water stays out if shingles blow off, the deck renailed with ring shank nails, stronger edges, and a covering rated and installed for high wind, each stage documented by an evaluator. The Louisiana Fortify Homes Program pays grants of up to {s_grant} toward a FORTIFIED roof on eligible owner occupied, homesteaded and insured homes, drawn by lottery when a round opens. Insurers file their own FORTIFIED discounts, which vary by company."
- `metal` (line 1889): "Metal roofs commonly last forty years or more, twice the life of most shingles, and light colored panels reflect much of the summer sun. Standing seam panels hide their fasteners and resist wind and leaks best; exposed fastener panels cost less but need their screws and washers checked as they age. Near the coast, aluminum or coated steel rated for salt exposure holds up longer. Steel prices move more than shingle prices: producer prices for steel mill products {s_steelMove} in the year to {s_ppiMonth}."
- `mh` (line 1906): "Louisiana has about {s_mh} mobile and manufactured homes, many with low slope metal or membrane roofs that leak at seams, vents and fasteners. A leak repair seals the source; a roof over system adds a new metal or membrane roof above the old one, often with insulation, and is a common answer to a roof that leaks in many places. Owners in the South do more than a quarter of mobile home roof work themselves, and the typical professional job runs about half the cost of a site built reroof."
- `mf` (line 1922): "Apartment, condominium and HOA roofs combine steep slope shingles, low slope membranes and long runs of flashing over many units. A roof survey sets the remaining life of each roof so boards and owners can plan reserves, and phased replacement keeps work moving building by building with residents in place. Buildings of five or more units are commercial work under Louisiana licensing: jobs of $50,000 or more need a commercial license with the roofing classification."
- `comm` (line 1938): "Most commercial buildings in Louisiana carry low slope membranes, TPO, PVC, modified bitumen or built up roofing, or metal panels. Membranes commonly last fifteen to thirty years depending on the system, the thickness and the drainage; ponding water, rooftop traffic and storm damage end many early. A survey with moisture readings shows whether the roof can be repaired, restored with a coating or must be replaced. Commercial work of $50,000 or more needs a commercial license with the roofing classification, and every reroof needs a permit."
- `coat` (line 1954): "A restoration coating, usually silicone or acrylic, seals a weathered membrane or metal roof and reflects heat, and coating warranties commonly run ten to twenty years depending on the thickness applied. It only works over a dry, sound substrate: wet insulation or failed seams have to be fixed or replaced first, which is why moisture testing comes before any coating proposal. A maintenance plan with inspections each spring and after storms catches the small failures that end roofs early."
- `newc` (line 1970): "On a new build, the roof comes right after framing and sheathing and dries in the building for every trade that follows. The work follows the building code's roof covering, underlayment and wind provisions for the site, passes the required inspections, and is measured against the builder's New Home Warranty obligations: one year for defects from noncompliance with building standards and longer for major structural defects. {s_permits} new housing units were permitted in Louisiana in {s_permitYear}."

The `lede` and `lp` strings, copied exactly:

- `replace` lede (line 1800): "Most shingle roofs in Louisiana wear out around twenty years, sooner after hard storms and long summers. Here is what a replacement includes and how to compare estimates."
  - lp (line 1801): "Replacing a roof in {city}? {brand} gives you an itemized written estimate and pulls the permit for every job. Office in {officeCity}."
- `repair` lede (line 1818): "A leak rarely starts where the stain appears. Here is how roofers trace it, what a good repair includes, and when the roof is telling you it needs more than a patch."
  - lp (line 1819): "Roof leak in {city}? {brand} finds the source, stops the water and gives you a written estimate. Office in {officeCity}."
- `storm` lede (line 1835): "After a hurricane or a hard thunderstorm, the first hours protect the house and the next weeks decide the repair. Here is what to do, what a roofer does, and the Louisiana rules that protect you."
  - lp (line 1836): "Storm damage to your roof in {city}? {brand} tarps, inspects and writes a photo report and an itemized estimate. Office in {officeCity}."
- `hail` lede (line 1853): "Hail one inch across starts to bruise asphalt shingles, and golf ball hail damages most of them. Here is how to check, what an inspection finds and what happens next."
  - lp (line 1854): "Hail in {city}? {brand} inspects your roof and gives you a written photo report and an itemized estimate. Office in {officeCity}."
- `fortified` lede (line 1870): "A FORTIFIED roof is built to a tested standard that keeps the roof deck on and the water out in high winds, and Louisiana pays grants toward it. Here is what changes and how the program works."
  - lp (line 1871): "Thinking about a FORTIFIED roof in {city}? {brand} explains the standard and the Louisiana Fortify Homes Program. Office in {officeCity}."
- `metal` lede (line 1887): "Metal roofs last decades, shed heat and rain well and stand up to wind when they are fastened right. Here is how the two main systems differ and what drives the price."
  - lp (line 1888): "Metal roof in {city}? {brand} prices standing seam and exposed fastener systems with an itemized estimate. Office in {officeCity}."
- `mh` lede (line 1904): "Mobile home roofs fail at seams, vents and fasteners, and a roof over system can add years. Here are the options and what each one costs you in time and money."
  - lp (line 1905): "Mobile home roof leaking in {city}? {brand} repairs leaks and installs roof over systems. Office in {officeCity}."
- `mf` lede (line 1920): "A multifamily roof is a capital project with residents underneath it. Here is how surveys, budgets, phasing and notices fit together."
  - lp (line 1921): "Roofing for an apartment or HOA in {city}? {brand} surveys, budgets and phases the work. Office in {officeCity}."
- `comm` lede (line 1936): "A commercial roof fails at its seams, its drains and its edges long before the field wears out. Here is how to read the signs and plan a replacement."
  - lp (line 1937): "Commercial roof in {city}? {brand} surveys the roof and prices repair, restoration and replacement. Office in {officeCity}."
- `coat` lede (line 1952): "A coating can add years to a sound commercial roof for less than a tear off, but only over a dry, sound substrate. Here is how to tell."
  - lp (line 1953): "Roof coating or maintenance in {city}? {brand} tests the roof and prices restoration against replacement. Office in {officeCity}."
- `newc` lede (line 1968): "The roof dries in the building. Here is how roofing fits the build schedule, the code and the builder's warranty."
  - lp (line 1969): "Building in {city}? {brand} roofs new homes and buildings on the builder's schedule. Office in {officeCity}."

### 9.6 `GUIDES` (lines 2018-2084)

| Line | id | scope | line | label | h1 | title | facts | heads | table |
|---|---|---|---|---|---|---|---|---|---|
| 2018 | `age` | state | replace | How long a roof lasts in Louisiana | How Long Does a Roof Last in Louisiana? | How Long Does a Roof Last in Louisiana? | s_ra20, s_wave, life_fact, s_nxt | How long roofs last here, Why roofs come due in waves, Signs it is time |  |
| 2030 | `storm` | state | storm | After storm damage to your roof | What to Do After Storm Damage to Your Roof in Louisiana | After Storm Damage to Your Roof in Louisiana | s_storms, s_fema, clock_fact, ded_fact | The first hours, Your insurer and your roofer, Contracts, prices and storm chasers |  |
| 2042 | `hail` | state | hail | Hail damage and your roof | Hail Damage and Your Roof in Louisiana | Hail Damage and Your Roof in Louisiana | s_h1, s_h175, hail_season, clock_fact | When and where hail falls, What hail does to shingles, After a hail storm |  |
| 2053 | `license` | state | null | How to check a roofer's license | How to Check a Roofer's License in Louisiana | How to Check a Roofer's License in Louisiana | lic7500, liab_fact, s_out, permit_fact | Which license a job needs, How to check, Why it matters after storms |  |
| 2064 | `fortified` | state | fortified | FORTIFIED roofs and Louisiana grants | FORTIFIED Roofs and Louisiana Grants | FORTIFIED Roofs and Louisiana Grants | grant_fact, permit_fact, lic7500, s_storms | What FORTIFIED adds, The Louisiana grant, Insurance and the decision |  |
| 2075 | `cityroofs` | city | replace | Roofs and storms in each city | Roofs and Storms in {city} | Roofs and Storms in {city}, Louisiana | c_roofs, c_ra20, c_h1, c_fema | The roofs in {city}, Storms that reached {city}, What it means for owners | citystorms |

Guide `meta` and `answer` strings, copied exactly:

- line 2020 meta: "How long shingle, metal and other roofs last in Louisiana, why storms make roofs come due in waves, and the signs it is time to replace."
- line 2021 answer: "An asphalt shingle roof in Louisiana usually lasts about twenty years, metal forty or more, and tile and slate much longer. By our estimate from Census, American Housing Survey and storm records, about {s_ra20} Louisiana roofs are 20 years or older today and {s_wave} more reach 20 within five years. Hurricanes replaced so many roofs in 2005, 2008, 2020 and 2021 that roofs in many parishes now come due in waves."
- line 2032 meta: "What to do in the first hours and weeks after a hurricane or storm damages a Louisiana roof, and the rules on claims, deductibles, contracts and prices."
- line 2033 answer: "Stay off the roof, photograph the damage, keep water out with a tarp, report the damage to your insurer and keep the claim number. A licensed roofer inspects and documents the damage and writes an itemized estimate; your insurer decides coverage. Louisiana law bars roofers from interpreting policies, adjusting claims, taking over your insurance benefits before the work is done and the insurer has inspected, or paying any part of your deductible, and an insurer must begin adjusting within 14 days of notice, or 30 days after a catastrophe."
- line 2044 meta: "What size hail damages a roof, when hail season peaks in Louisiana, how to check for damage and what happens next."
- line 2045 answer: "Hail of about one inch begins to bruise asphalt shingles and golf ball hail of 1.75 inches damages most of them. Louisiana's hail peaks in {s_hailPeak}, and NOAA logged {s_h1} reports of hail one inch or larger in the state from 2016 to 2026, {s_h175} of them golf ball size or larger. Check gutters, vents and outdoor equipment for dents, then have the roof inspected slope by slope."
- line 2055 meta: "Which Louisiana license a roofer needs, how to check it on the LSLBC website, the insurance rule and why it matters after storms."
- line 2056 answer: "Since August 1, 2026, anyone who advertises, bids or performs residential roofing of $7,500 or more in Louisiana must hold the Residential Roofing or Residential Construction license from the Louisiana State Licensing Board for Contractors, and residential licensees must carry at least $500,000 in liability coverage. Search the company or the license number on the board's website before you sign. About {s_out} of roofing license records belong to companies based out of state."
- line 2066 meta: "What a FORTIFIED roof is, how the Louisiana Fortify Homes Program grant of up to $10,000 works, who qualifies and how insurance discounts work."
- line 2067 answer: "A FORTIFIED roof is built to the Insurance Institute for Business and Home Safety standard: a sealed roof deck, a renailed deck, stronger edges and a high wind rated covering, documented by an evaluator. The Louisiana Fortify Homes Program pays grants of up to {s_grant} toward one on eligible owner occupied, homesteaded and insured homes, drawn by lottery. Insurers file their own FORTIFIED discounts."
- line 2077 meta: "How old the roofs in {city} are, the storms and hail that hit its ZIP codes, and what that means for owners."
- line 2078 answer: "By our estimate from Census and storm records, about {c_ra20_sh} of the one unit roofs in the {city} ZIP codes are 20 years or older and {c_wave} more reach 20 within five years. {c_ageWhy} {c_stormSentence} {c_hailSentence}"

### 9.7 `STEPS`, `what`, `who`, FAQs, guide bodies and Spanish fragments: index of state-specific sentences

Everything in this file was drafted for Louisiana and must be re-read; the two lists below pick out, by line, the sentences that state Louisiana law, licensing, permits, programmes, places or dollar thresholds (list A) and those that carry the Gulf hazard framing: hurricanes, hail, tarping, claims and deductibles, storm chasers, heat and humidity (list B). Lines already quoted in full above (`LAWPUB`, the `AC` first lines, `aq`, `lede`, `lp`, `answer`, `band`, `dl`, guide `h1`/`meta`/`answer`, `NOTICE`, `CONSENT`) are not repeated. Sentences are clipped at 230 characters; the same sentence on several lines is listed once with all its lines.

**List A: law, licence, permit, programme, place (134 sentences)**

- 1765: You get a written estimate that lists the materials, tear off, decking repair, ventilation and the permit, so every price can be compared.
- 1766: We pull the permit from the parish or city and schedule the work and the material delivery around the weather.
- 1767: Tear off, deck repair, underlayment and the new roof, then the inspections the permit requires and a final walk through with photos.
- 1777: When you decide, we pull the permit, repair or replace the roof and pass the inspections.
- 1782: We pull the permit and do the work, with impact rated shingles as an option where hail is common.
- 1784: FORTIFIED grants go to owner occupied, homesteaded homes with wind coverage, and flood insurance where the home is in a flood zone.
- 1785: Owners apply through the Louisiana Fortify Homes Program when a round opens; grants are drawn by lottery.
- 1786: A FORTIFIED trained roofer installs the roof while a certified evaluator documents each stage with photos.
- 1787: IBHS issues the FORTIFIED designation, the grant is paid to the contractor, and you send the certificate to your insurer.
- 1791: Schedule and permit
- 1791: We permit the work and schedule it around your operations, tenants and the weather.
- 1805: Confirm the contractor's license on the LSLBC contractor search and ask for the certificate of liability insurance.
- 1805: If the sale is made at your home, you have three business days to cancel.
- 1805: Ask who pulls the permit; the answer should be the contractor.
- 1808: How long does a roof last in Louisiana?
- 1809, 2013: Does a roof replacement need a permit in Louisiana?
- 1809, 2013: Since August 1, 2025 every roof and reroof needs a permit from the parish or city and the inspections it requires, and the contractor should pull it before work starts.
- 1811, 2014: How do I check a roofer's license?
- 1811, 2014: Search the company or the license number on the Louisiana State Licensing Board for Contractors website.
- 1811: Residential roofing of $7,500 or more requires the Residential Roofing or Residential Construction license.
- 1812: A sale of $25 or more made at your home can be cancelled within three business days under the federal Cooling Off Rule, and the seller must give you the cancellation form.
- 1814: Reemplazo de techos en {city}'], d: ['Reemplazo de techos con presupuesto detallado por escrito y permiso para cada trabajo.
- 1814: Le damos un presupuesto detallado y sacamos el permiso.
- 1823: Larger repair jobs need a permit, and residential roofing of $7,500 or more needs the LSLBC license.
- 1828: Does a roof repair need a permit?
- 1828: Every roof and reroof project needs a permit under the 2025 law, and parishes and cities set how small repairs are handled.
- 1828: A licensed roofer will know the local rule and pull the permit when one is required.
- 1839: repair or replacement under a permit, with the inspections the law requires.
- 1840: Be careful with door knockers: ask for the license number and check it with the LSLBC, get a local address, and do not sign anything that assigns your insurance benefits or promises to cover part of your deductible, which Louisian [...]
- 1840: A contract signed at your home can be cancelled within three business days.
- 1844: Your insurer decides that under your policy, and Louisiana law bars roofers from interpreting coverage or adjusting claims.
- 1845: Louisiana law bars a contractor paid from an insurance claim from paying, waiving or rebating your deductible or raising the price to cover it, and contracts of $1,000 or more paid from insurance must say so in bold type.
- 1846, 2005: An insurer must begin adjusting a property claim within 14 days of notice, or within 30 days after a catastrophic loss, and make a written offer within 30 days of satisfactory proof of loss.
- 1847: Ask for the license number and check it on the LSLBC website, ask for a local address and references, and be wary of anyone who offers to handle your claim or to cover part of your deductible.
- 1864: Louisiana law bars roofers from interpreting policies, adjusting claims or advertising as specialists in insurance claims.
- 1874: What FORTIFIED adds over a code roof:
- 1875: Check the program's eligibility rules before a round opens: an owner occupied home with a homestead exemption, wind coverage in force, and flood insurance if the home sits in a flood zone; condominiums, mobile homes and recently b [...]
- 1875: Ask your insurance agent what discount your insurer files for a FORTIFIED roof before you decide.
- 1878: How much is the Louisiana FORTIFIED grant?
- 1878: The Louisiana Fortify Homes Program pays up to $10,000 toward a FORTIFIED roof, paid to the contractor after the roof is certified.
- 1879: Who qualifies for a Fortify Homes grant?
- 1879: Owner occupied homes with a homestead exemption and wind coverage, plus flood insurance where the home is in a flood zone.
- 1880: Will a FORTIFIED roof lower my insurance?
- 1880: Insurers file their own discounts for FORTIFIED roofs, and they vary by company and policy.
- 1881: What makes a FORTIFIED roof different from a new roof?
- 1883: es: { h: ['Techos FORTIFIED en {city
- 1883: Techo FORTIFIED en Luisiana'], d: ['Le explicamos el estándar FORTIFIED y el programa de subsidios de Luisiana.
- 1883: Subsidios de hasta 10,000 dólares por sorteo para casas elegibles.
- 1900: Techos de metal en Luisiana'], d: ['Techos de metal con presupuesto detallado y permiso para cada trabajo.
- 1914: Are mobile homes eligible for FORTIFIED grants?
- 1914, 2073: The Louisiana Fortify Homes Program does not include mobile homes.
- 1925: Confirm the contractor's commercial license and classification, insurance certificates naming the owner, and how lien waivers will be handled.
- 1928: What license does a contractor need for an apartment roof?
- 1928: Buildings of five or more units are commercial work in Louisiana; jobs of $50,000 or more need a commercial license with the roofing classification, and subcontracts of that size need licensed subcontractors.
- 1941: Compare proposals on the same system, thickness, insulation and warranty, and confirm the contractor's commercial license, insurance and lien waiver process.
- 1946: What license does a commercial roofer need?
- 1946: Commercial roofing of $50,000 or more needs a commercial license with the roofing classification from the Louisiana State Licensing Board for Contractors.
- 1972: FORTIFIED construction, impact rated shingles and metal.
- 1973: Bring the roofer in when the plans are set so materials, wind requirements and any FORTIFIED steps are priced from the start.
- 1976: Can a new home be built to the FORTIFIED standard?
- 1976: FORTIFIED construction is easiest to add during the build.
- 1977: Louisiana's New Home Warranty Act makes the builder warrant the home for one year against defects from noncompliance with building standards, with longer periods for some systems and major structural defects.
- 1985: Are you licensed in Louisiana?
- 1985: brand} holds Louisiana State Licensing Board for Contractors license {lic}.
- 1986: Do you pull permits?
- 1986: Every roof and reroof in Louisiana needs a permit and inspections, and we pull the permit before work starts.
- 1987: Your insurer decides coverage; Louisiana law bars roofers from interpreting policies, adjusting claims or paying deductibles.
- 1994, 2084: Do I need a permit to replace my roof in {city}?
- 1994: Every roof and reroof in Louisiana needs a permit and inspections, and the roofer should pull it from the parish or city before work starts.
- 1998: Which communities in {parish} Parish do you serve?
- 1998: Homes and businesses across the parish, including {parishCities}.
- 1999: How many roofs in {parish} Parish are getting old?
- 1999: About {p_ra20} one unit roofs in {parish} Parish are 20 years or older by our estimate, out of about {p_roofs}.
- 2000: How often do storms damage roofs in {parish} Parish?
- 2001: Who issues roofing permits in {parish} Parish?
- 2001: The parish or the city, depending on where the building stands.
- 2006: Louisiana law bars contractors from interpreting policies, adjusting claims or advertising as specialists in insurance claims, and from paying, waiving or rebating any part of a deductible.
- 2007: Check the license number on the LSLBC website, ask for a local address and references, never sign over your insurance benefits before the work is done, and remember you have three business days to cancel a sale made at your home.' [...]
- 2014: Residential roofing of $7,500 or more requires the Residential Roofing or Residential Construction license.' }];
- 2023: Owners in the region report replacing about four percent of roofs a year on homes built from the 1960s through the 2000s, and about one percent on homes built since 2010.
- 2024: Katrina and Rita in 2005 and Gustav and Ike in 2008 reset roofs across south Louisiana; those roofs are reaching twenty years now.
- 2024: Laura, Delta and Zeta in 2020 and Ida in 2021 did it again, so many parishes have a young roof stock today and a wave of replacements due in the late 2030s.
- 2025: Every reroof now needs a permit and inspections.
- 2027: How long do architectural shingles last in Louisiana?
- 2029: Roof age and condition are common grounds for an insurance inspection, and since 2024 insurers may again nonrenew some long held policies.
- 2036: After notice, an insurer must begin adjusting within 14 days, or within 30 days after a catastrophic loss, and make a written offer within 30 days of satisfactory proof of loss.
- 2036: A roofer can inspect, document the damage and write an itemized estimate, which Louisiana law requires before any repair agreement on an insurance funded job, and can show the adjuster the damage at your request; a roofer may not  [...]
- 2037: The deductible is yours to pay: a contractor may not offer to pay, waive or rebate it, and contracts of $1,000 or more paid from insurance must say so in bold type.
- 2037: A sale made at your home can be cancelled within three business days.
- 2037: Check every roofer's license on the LSLBC website before you sign.
- 2039: Louisiana law bars a contractor from taking an assignment of your insurance benefits before the work is complete and the insurer has made its first inspection.
- 2040: That offer is unlawful in Louisiana.
- 2041: Only a contractor licensed in Louisiana may sell or do residential roofing of $7,500 or more here.
- 2041: Check the license on the LSLBC website.
- 2047: Hail in Louisiana comes mostly with spring storms, and it is more common in the northern parishes than on the coast.
- 2051: When is hail season in Louisiana?
- 2058: Residential roofing of $7,500 or more on a home of up to four units needs the Residential Roofing or Residential Construction license.
- 2058: Commercial work of $50,000 or more needs a commercial license with the roofing classification.
- 2058: Every roof and reroof also needs a permit from the parish or city.
- 2059: Use the contractor search on the Louisiana State Licensing Board for Contractors website, search by company name or license number, and confirm the classification and status.
- 2060: Some are licensed and reputable; some are not.
- 2060: A license number, a local address, permits pulled in your parish and an itemized written estimate are the signs of a contractor who will be here to stand behind the work.
- 2062: Does a small roof repair need a licensed roofer?
- 2062: The state roofing license applies to residential roofing of $7,500 or more.
- 2062: Smaller jobs still need a permit where the parish or city requires one and any local occupational license.
- 2063: What if a roofer is not licensed?
- 2063: Report unlicensed contracting to the LSLBC.
- 2063: Paying an unlicensed contractor leaves you with little recourse if the work fails.
- 2069: FORTIFIED seals the deck, renails it with ring shank nails at close spacing, strengthens the edges where uplift starts and uses a covering rated and installed for high wind, with a certified evaluator photographing each stage.
- 2070: The Louisiana Fortify Homes Program pays up to $10,000 toward a FORTIFIED roof, paid to the contractor after certification.
- 2070: Homes must be owner occupied with a homestead exemption and carry wind coverage, plus flood insurance in a flood zone; condominiums, mobile homes and recently built homes are not eligible.
- 2071: Insurers file their own discounts for FORTIFIED roofs, and they vary by company.
- 2074: Each insurer files its own FORTIFIED discount.
- 2082: Every reroof needs a permit, and residential roofing of $7,500 or more needs the LSLBC license.
- 2084: Every roof and reroof in Louisiana needs a permit and inspections.
- 2087: The license and office repeat in Spanish.
- 2090: trust: ['Licencia LSLBC {lic
- 2095: Inspeccionamos el techo, le damos un presupuesto detallado por escrito con materiales, retiro del techo viejo, reparación de la base, ventilación y permiso, y sacamos el permiso antes de empezar.
- 2095: Todo trabajo de techo en Luisiana necesita permiso e inspecciones.
- 2096: Su aseguradora decide la cobertura; la ley de Luisiana prohíbe a los techadores interpretar pólizas, manejar reclamos o pagar el deducible.
- 2098: Sacamos el permiso para cada trabajo.
- 2099: facts: { permitV
- 2099: Permiso', permit
- 2099: para cada techo y cada reemplazo de techo en Luisiana, con las inspecciones que exige la ley', permitSrc
- 2099: Ley 239 de 2025', office
- 2099: licencia de la Junta de Licencias de Contratistas de Luisiana (LSLBC)
- 2100: Sacamos el permiso y pasamos las inspecciones.
- 2101: ¿Cómo verifico la licencia de un techador?
- 2101: Busque la compañía o el número de licencia en el sitio web de la Junta de Licencias de Contratistas de Luisiana (LSLBC).
- 2101: Los trabajos de techo residencial de 7,500 dólares o más requieren licencia.
- 2102: La ley de Luisiana prohíbe que un contratista pague, perdone o reembolse el deducible del seguro.
- 2103: Una venta de 25 dólares o más hecha en su casa se puede cancelar dentro de tres días hábiles.
- 2106: Licencia de la Junta de Licencias de Contratistas de Luisiana {lic}.
- 2106: Cada trabajo de techo lleva permiso e inspecciones según la ley de Luisiana.

**List B: hazard and claims framing (85 sentences)**

- 1769: If water is coming in, we tarp or patch the area first to protect the decking, the ceiling and what is inside.
- 1775: Tarp what needs it
- 1775: We tarp exposed areas to keep water out until the roof can be repaired, at prices set before the storm.
- 1776: Your insurer decides coverage; if you ask, we can show your adjuster the damage on the roof.
- 1779: Dents in gutters, downspouts, vents and air conditioner fins are the first signs that hail was large enough to matter.
- 1804: architectural shingles rated for high wind, or metal, installed to the manufacturer's high wind specification.
- 1808: An asphalt shingle roof usually lasts about twenty years here, less after repeated storms and more with good ventilation.
- 1822: lifted, creased or missing shingles after high wind.
- 1839: What a storm response should include:
- 1839: Emergency tarping:
- 1839: covering exposed decking to stop further water damage, priced as before the storm.
- 1839: A roofer may show the damage to your adjuster at your request, but may not interpret your policy, negotiate your claim or take an assignment of your benefits before the w [...]
- 1840, 2036: Report the damage to your insurer and keep the claim number.
- 1840: During a declared emergency, prices may rise only by documented cost increases.
- 1843: Should I tarp my roof myself?
- 1843: A roofer can tarp it properly and photograph the damage at the same visit.
- 1845: Can a roofer pay my deductible?
- 1847: How do I spot a storm chaser?
- 1849: es: { h: ['Daños por tormenta en {city
- 1849: Reparación de techos después de una tormenta'], d: ['Ponemos lona, inspeccionamos y le damos un reporte con fotos y un presupuesto detallado.
- 1857: What hail does to a roof:
- 1857: dents in vents, flashing and gutters that show the size of the hail.
- 1857: Impact rated shingles (UL 2218 Class 4) resist hail better and are worth pricing where hail returns most springs.
- 1858: Photograph the hail itself if it is safe, then dents in gutters, downspouts, vents and outdoor equipment.
- 1858: Book an inspection before the next rain, report damage to your insurer and keep the claim number.
- 1858: Do not sign anything that assigns your benefits or promises to cover part of your deductible.
- 1861: What size hail damages a roof?
- 1861: Hail of about one inch starts to bruise asphalt shingles, and golf ball size hail, about 1.75 inches, damages most of them.
- 1862: Can hail damage hide?
- 1863: Where hail returns most springs, Class 4 impact rated shingles resist damage better, and some insurers file discounts for them.
- 1864: Can a roofer handle my hail claim?
- 1866: es: { h: ['Daños por granizo en {city
- 1866: Inspección de granizo en {city}'], d: ['Inspeccionamos su techo y le damos un reporte con fotos y un presupuesto detallado.
- 1866: El daño por granizo no siempre se ve desde el suelo.
- 1874: the seams taped or the deck covered with a fully adhered underlayment, so wind driven rain stays out if the covering is lost.
- 1874: shingles or metal rated for high wind and installed to the manufacturer's high wind specification.
- 1881: A sealed roof deck, a renailed deck with ring shank nails, stronger edges, a high wind rated covering and third party documentation of every stage.
- 1891: panels joined by raised seams with concealed clips, the best choice for wind and leak resistance.
- 1891: screwed through the face, lower in cost, common on camps, barns and mobile homes.
- 1891: painted finishes and coastal grade metals for salt air.
- 1892: Compare estimates on the same panel gauge, profile, finish and fastening, and ask how the edges and ridge are attached for wind.
- 1895: Commonly forty years or more, depending on the metal, the finish, the installation and the exposure to salt air.
- 1909: Prices after a declared emergency may rise only by documented costs.
- 1913: A sound metal roof can be cleaned, sealed and coated to stop minor leaks and reflect heat.
- 1930: Many associations survey every few years and after major storms, so reserve studies reflect each roof's real condition.
- 1940: single ply membranes with heat welded seams, often white to reflect heat.
- 1956: inspections each spring and after storms, drain cleaning and small repairs.
- 1962: Inspections each spring and after storms, clearing drains and gutters, and repairing seams and flashing before they leak.
- 1972: dry in timed to framing and sheathing.
- 1972: underlayment, flashing and fastening for the site's design wind speed.
- 1987: Can you help with my insurance claim?
- 1987: We inspect the roof, document the damage with photos and write an itemized estimate, and at your request we can show your adjuster the damage on the roof.
- 1992: About {c_ra20_sh} of the one unit roofs in the {city} ZIP codes are 20 years or older by our estimate from Census and storm records, and {c_wave} more reach 20 within fiv [...]
- 1993: How often do storms hit {city}?
- 1993: c_stormSentence} {c_hailSentence
- 2000: p_stormSentence
- 2004: What should I do first after {st_name} damaged my roof?
- 2004: Stay off the roof, photograph the damage from the ground and inside, keep water out with a tarp, report the damage to your insurer and keep the claim number.
- 2006: Can a roofer handle my claim or pay my deductible?
- 2007: How do I avoid storm chasers?
- 2009: /* storm pages two to six years after the storm: hidden damage and replacement, no claims talk */
- 2011: Can wind damage from {st_name} still be on my roof?
- 2011: Wind can lift and crease shingles and break their seal without tearing them off, and that damage often shows up later as leaks or as shingles lost in the next storm.
- 2012: Should I repair or replace a roof that went through {st_name}?
- 2023: Heat, humidity and wind are hard on roofs.
- 2024: A big hurricane replaces tens of thousands of roofs in a few months, and those roofs then age together.
- 2025: A roof near twenty years old that has been through a hurricane or hail is worth an inspection before the next season.
- 2027: Often twenty to thirty years, depending on ventilation, installation and the storms the roof sees.
- 2035: Photograph the roof from the ground, the attic and any water inside, and keep receipts for tarps and emergency repairs.
- 2035: A tarp over exposed decking prevents most of the interior damage that follows a storm.
- 2037: While a state of emergency is declared, prices may rise only by documented cost increases.
- 2040: What if a roofer offers to cover my deductible?
- 2047: Reports also follow people: a hail swath over farmland may produce few reports even when it damaged roofs.
- 2048: Hail bruises shingles by cracking the mat under the granules, knocks granules loose and, when large enough, cracks or punctures shingles outright.
- 2048: Impact rated shingles, UL 2218 Class 4, resist hail better.
- 2049: Report damage to your insurer and keep the claim number.
- 2051: Spring, peaking in {s_hailPeak}, though hail can fall in any month with strong thunderstorms.
- 2052: Should I file a claim for hail damage?
- 2060: After hurricanes, crews from other states arrive quickly.
- 2069: Most hurricane damage inside a house comes from water through the roof deck after the covering blows off.
- 2080: Their ages follow the year each home was built and the storms that replaced roofs in waves.
- 2081: c_stormSentence} {c_femaSentence
- 2082: Roofs that came through a hurricane or hail and are near twenty years old are worth an inspection before the next season.
- 2096: Tome fotos del daño desde el suelo y por dentro, y proteja la casa con una lona.
- 2102: ¿Pueden pagar mi deducible?

### 9.8 LOUISIANA-SPECIFIC CONTENT in 08_forge_copy.js: term index by line
(Complements 9.4 to 9.7. Every line listed contains the term.)

| Item | Lines |
|---|---|
| The word `Louisiana` (83 lines) | 1740, 1743, 1751, 1753, 1757, 1785, 1798, 1799, 1800, 1802, 1808, 1809, 1811, 1816, 1833, 1835, 1837, 1840, 1844, 1845, 1848, 1851, 1855, 1864, 1868, 1870, 1871, 1872, 1878, 1885, 1886, 1902, 1906, 1914, 1918, 1922, 1928, 1934, 1938, 1946, 1950, 1966, 1970, 1977, 1985, 1986, 1987, 1994, 2006, 2013, 2014, 2018, 2019, 2020, 2021, 2024, 2027, 2031, 2032, 2033, 2036, 2039, 2040, 2041, 2043, 2044, 2045, 2047, 2051, 2054, 2055, 2056, 2059, 2064, 2065, 2066, 2067, 2068, 2070, 2073, 2076, 2084, 2110 |
| Spanish `Luisiana` | 1883, 1900, 2095, 2096, 2099, 2101, 2102, 2106 |
| Agency `Louisiana State Licensing Board for Contractors` | 1740, 1811, 1946, 1985, 2014, 2056, 2059, 2110 |
| Agency acronym `LSLBC` | 1740, 1741, 1742, 1805, 1813, 1823, 1830, 1840, 1847, 1899, 2007, 2037, 2041, 2055, 2063, 2082, 2090 (`Licencia LSLBC {lic}`), 2099 (`licencia de la Junta de Licencias de Contratistas de Luisiana (LSLBC)`), 2101 |
| Programme `Louisiana Fortify Homes Program` / `Fortify Homes` | 1751, 1785, 1868, 1871, 1872, 1878, 1879, 1914, 2066, 2067, 2070, 2073 |
| `FORTIFIED` (IBHS standard) | 1751, 1784, 1786, 1787, 1868-1872, 1874, 1875, 1878, 1880-1883, 1914, 1972, 1973, 1976, 2064-2071, 2074 |
| Grant facts: `up to $10,000` / `{s_grant}`, lottery, homestead exemption, wind coverage, flood insurance | $10,000: 1751, 1868, 1872, 1878, 1882, 1883, 2066, 2067, 2070; lottery/sorteo: 1751, 1785, 1872, 1875, 1878, 1882, 1883, 2067, 2070; homestead: 1751, 1784, 1872, 1875, 1879, 2067, 2070; flood: 1751, 1784, 1875, 1879, 2070 |
| Licence threshold `$7,500` (residential roofing) | 1740, 1743, 1811, 1813, 1823, 1830, 1899, 2014, 2041, 2056, 2058, 2062, 2082, 2101 (`7,500 dólares`) |
| Commercial threshold `$50,000` | 1743, 1922, 1928, 1931, 1938, 1946, 1947, 2058 |
| Liability `$500,000` | 1742, 2056 |
| Deductible notice `$1,000` | 1744, 1845, 2037 |
| Effective dates | `August 1, 2026`: 1740, 2056; `August 1, 2025`: 1741, 1802, 1809, 2013; `August 1, 2024` and `January 1, 2025`: 1752 |
| Insurer clock `14 days` / `30 days` (La. R.S. 22:1892) | 1748, 1837, 1846, 2005, 2033, 2036 |
| `parish` / `Parish` (permit issuer "the parish or city", `{parish} Parish`, "northern parishes", "many parishes") | 1741, 1766, 1809, 1828, 1994, 1998, 1999, 2000, 2001, 2013, 2021, 2024, 2047, 2058, 2060, 2062 |
| `hurricane` | 1802, 1835, 2021, 2024, 2025, 2032, 2060, 2069, 2082 |
| Storm names (one line): `Katrina and Rita in 2005 and Gustav and Ike in 2008 reset roofs across south Louisiana [...] Laura, Delta and Zeta in 2020 and Ida in 2021 did it again [...] a wave of replacements due in the late 2030s` | 2024 (and 2021: `Hurricanes replaced so many roofs in 2005, 2008, 2020 and 2021 that roofs in many parishes now come due in waves.`) |
| Named-storm page templates (`{st_name}`) | 2004, 2011, 2012 |
| Hail content (a whole service page, steps, guide) | 1778, 1779, 1782, 1851-1866, 2042-2052, plus mentions at 1802, 1830, 1848, 2025, 2077, 2082 |
| Tarping | 1769, 1775, 1833, 1836, 1837, 1839, 1843, 1849, 2004, 2033, 2035, 2096 |
| Claims and deductible wording (built on La. R.S. 37:2159.1 and 51:451) | claims: 1744, 1745, 1748, 1833, 1837-1840, 1844-1848, 1851, 1856, 1858, 1864, 1987, 2004-2006, 2009, 2032, 2033, 2036, 2049, 2052, 2096; deductible: 1744, 1752, 1833, 1837, 1838, 1840, 1845, 1847, 1848, 1851, 1856, 1858, 1987, 2006, 2032, 2033, 2037, 2040, 2096, 2102 |
| Regional phrases | `Owners in the South do more than a quarter of mobile home roof work themselves` (1906); `Owners in the region report replacing about four percent of roofs a year [...]` (2023); `south Louisiana` (2024); `more common in the northern parishes than on the coast` (2047); `camps` (1885, 1891: "homes, camps and outbuildings", "camps, barns and mobile homes"); coast and salt air (1885, 1889, 1891, 1895) |
| Climate sentence | `Heat, humidity and wind are hard on roofs.` (2023); `sooner after hard storms and long summers` (1800) |
| Statute pages | legis.la.gov: 1744-1748, 1750-1752, 1757, 1758; lslbc.gov: 1740-1743, 1759; `https://lsuccc.dps.louisiana.gov/`: 1753; ecfr.gov (federal, keep): 1749, 1755, 1756 |
| `New Home Warranty` (La. R.S. 9:3141) | 1759, 1970, 1977, 1978 |
| State of emergency pricing (La. R.S. 29:732) | 1750, 1840, 1909, 1915, 2037 |
| Storm chasers / door knockers / out-of-state crews | 1840, 1847, 2007, 2034, 2041, 2056, 2060 |
| Spanish legal source label `Ley 239 de 2025` | 2099 |
| Sources named in copy | NOAA (1855, 2045); `National Association of Home Builders` (2023); `Census, American Housing Survey and storm records` (2021); UL 2218 Class 4 (1857, 2048) |
| Guide ids and table key tied to the hazard set | `storm` (2030), `hail` (2042), `fortified` (2064), `cityroofs` with `table: 'citystorms'` (2075-2079) |

### 9.9 California changes
- This is the largest rewrite in my range: about 76 KB of customer-facing copy. The object shapes should be kept exactly (module 09 indexes `FCOPY.AC[key]` for every key in `LINE_KEYS`, `FCOPY.STEPS[AC[key].steps]`, `FCOPY.LAWPUB[k]` for every `k` in `AC[key].law`, and the FAQ arrays and `GUIDES` by `id`).
- Keys: `AC` must have one entry per California service line; `STEPS` keys referenced by `AC[].steps` must exist; `related` must name existing line keys; `law` must name existing `LAWPUB` keys.
- Tokens: keep the token names or change them together with module 09's `varsFor()`. Tokens that presuppose the Louisiana data model: `{s_storms}`, `{st_name}`, `{c_stormSentence}`, `{c_femaSentence}`, `{p_stormSentence}` (named tropical storms and FEMA registrations), `{s_h1}`, `{s_h175}`, `{s_hailPeak}`, `{c_hailSentence}` (hail reports), `{s_grant}` (`META.fort.grant`), `{s_out}` (`META.lic.out / META.lic.n`: needs a CSLB C-39 roster count with an out-of-state split), `{parish}`, `{parishCities}`, `{p_*}` (rename to county or keep as internal names). Tokens that carry over unchanged: `{city}, {brand}, {officeCity}, {officeAddr}, {officeLine}, {lic}, {phone}, {lineList}, {areaList}, {nearby}, {cityServe}, {s_ra20}, {s_wave}, {s_mh}, {s_permits}, {s_permitYear}, {s_steelMove}, {s_ppiMonth}, {c_roofs}, {c_ra20_sh}, {c_wave}, {c_ageWhy}`.
- Fact keys: `permit_fact, lic7500, liab_fact, comm_fact, clock_fact, ded_fact, gouge_fact, grant_fact, nhwa_fact, lien_fact` are Louisiana legal facts defined in module 09 (lines 7162-7168 and after); the names `lic7500` and `comm_fact` literally encode Louisiana thresholds ($7,500, $50,000).
- Page types: `PARISH_FAQ` becomes a county FAQ (`{parish} Parish` -> `{county} County`; the answer "The parish or the city, depending on where the building stands" becomes the county or city building department). `STORM_FAQ` and `STORM_LATE_FAQ` exist for per-storm pages built from `DATA.routes`; a California edition needs an event type to hang them on (named wildfires, a named atmospheric river sequence, a wind event) or the page type should be dropped in module 09.
- Guides: `age` (rewrite: roofs do not "come due in waves" after hurricanes in California; tile, heat and UV, fire rebuild cohorts are the California story), `storm` (rain/wind/wildfire aftermath), `hail` (drop or replace, for example with a wildfire-hardening or cool-roof guide), `license` (CSLB), `fortified` (replace with the mitigation programme chosen), `cityroofs` (keep, with a California table in place of `citystorms`).
- Spanish block `ES`: all `Luisiana` and `LSLBC` strings (lines 2090, 2095, 2096, 2099, 2101, 2102, 2106) and `permitSrc: 'Ley 239 de 2025'`.
- `NOTICE` (line 2110) and `ES.notice` (2106): licence board name and "as Louisiana law requires".
- Copy bans in the header comment (lines 1735-1736) come from Louisiana claim law; the California edition should restate its own "never in this file" list.
- Questions: (a) which `LAWPUB` entries are printed on which page type is decided in module 09; (b) `ES.answer` has only `replace, storm, repair, general`: other lines fall back to `general` presumably (module 09); (c) `GUIDES[].table: 'citystorms'` is rendered by module 09.

---

## 10. 09_sl_model.js (lines 2116-2191)

### 10.1 What it is
`SLM`, the service-line model. Header comment (line 2118): `service line model (keeps the SLM interface the connectors expect)`. It holds the editable marketing assumptions (cost per click, conversion and close rates, job value, gross-profit share), turns the ZIP pool columns `p_*` into jobs, revenue and gross profit, allocates a budget across ZIPs, supplies month-by-month seasonality and hour-of-day bid shapes per line, and defines the map layers for the `r_*` and `p_*` columns. It also writes one derived key on every ZIP object (`z.sl_top`).

### 10.2 Globals
One global, `SLM` (line 2120, returned at 2189): `{A, DEF, LINES, LI, MONTHS, BLOCKS, DAYPARTS, SEA, SEA_G, set, reset, blended, zipLine, zipAll, allocate, unitEcon, seasonFor, lineName, layers}`.

| Member | Line | Meaning |
|---|---|---|
| `MONTHS` | 2121 | `['Jan', ..., 'Dec']` |
| `BLOCKS` | 2122 | six hour blocks: `'12a to 6a', '6a to 9a', '9a to 12p', '12p to 5p', '5p to 9p', '9p to 12a'` |
| `DAYPARTS` | 2124-2125 | bid adjustment percent per block; comment: `hour blocks as bid adjustment percentages (assumptions until account actuals replace them)`. `emergency: [10, 15, 15, 10, 15, 5]`, `retail: [-40, 0, 15, 10, 15, -10]`, `b2b: [-60, 5, 25, 20, -20, -50]`, `crash` = alias of `emergency` (a leftover name) |
| `SEA` | 2132-2144 | month index (mean 100) per line, see 10.3 |
| `SEA_G` | 2145 | grade of each seasonal shape: `replace D, repair C, storm B, hail B, fortified D, metal D, mh C, mf D, comm D, coat D, newc D` |
| `DEF` | 2147-2162 | default assumptions, see 10.3 |
| `A` | 2164 | live assumptions = `DEF` overlaid with `store.get('up.slm.v1')` |
| `LINES`, `LI` | 2165-2166 | `PL` entries extended with `months` (= `SEA[key]`), `mg` (= `SEA_G[key]`), `dayparts` (`'emergency'` for `storm, repair, mh`; `'b2b'` for `comm, coat, mf, newc`; `'retail'` otherwise); `LI` by key |
| `set(patch)`, `reset()` | 2167-2168 | change or restore assumptions, persist, emit `BUS 'slm'` |
| `blended(L, z)` | 2170 | unit economics of line `L` at ZIP `z` (or statewide when `z` is null): returns `{cpc, cvr, cpl, close, cps, feeCase, roi}` |
| `zipLine(z, k)` | 2172 | `{pool, cases, fees, rev, rate}` for ZIP `z` and line `k` |
| `zipAll(z, keys)` | 2173 | sums `zipLine` over `keys` (default all `LINE_KEYS`): `{pool, cases, fees, rev}` |
| `allocate(budget, keys, zips, alpha)` | 2175 | `[{zip, z, w, budget}]` |
| `unitEcon(k)` | 2176 | `blended(LI[k], null)` |
| `seasonFor(k)` | 2177 | `LI[k].months` (falls back to `replace`) |
| `SLM.lineName(k)` | 2178 | line name; `'Unmapped'` for `'unmapped'` |
| `layers()` | 2181-2188 | map layer definitions `r_<key>` and `p_<key>`: `{l, grp, dir, ramp, g, f, note}` |

### 10.3 DATA CONTRACT

Fields read
| Field | Line | Units / meaning | Use |
|---|---|---|---|
| `DATA.ts.month.hail`, `.wind`, `.torn` | 2129, 2130, 2136 | 12 monthly counts each (storm reports by calendar month; Louisiana: hail `[209, 325, 949, 1037, 732, 348, 88, 86, 53, 61, 69, 95]`) | seasonality of `hail`, `repair`, `storm`, `mh` |
| `DATA.ts.trop_month` | 2129, 2130 | 12 monthly counts of tropical storms (Louisiana: `[0, 0, 0, 0, 1, 10, 9, 23, 33, 7, 1, 0]`) | seasonality of `storm` and `mh`; `tropN = norm12(TROP.map(v => v + 0.2))` |
| `META.model.FEE` | 2148 | `0.33`: gross profit as a share of job value | `DEF.fee` |
| `META.model.REP[key]` | 2150-2160 | share of each pool open to marketing ("rep"): `replace 0.84, repair 0.55, storm 0.80, hail 0.85, fortified 0.95, metal 0.88, mh 0.72, mf 0.65, comm 0.55, coat 0.50, newc 0.25` | `DEF.lines[key].rep` |
| `META.model.VAL[key]` | 2150-2160 | average job value in dollars: `replace 15500, repair 950, storm 8500, hail 9500, fortified 19000, metal 26000, mh 5500, mf 60000, comm 85000, coat 40000, newc 11000` | `DEF.lines[key].val` |
| ZIP column `cpc_rel` | 2170, 2175 | relative cost per click of the ZIP (dimensionless multiplier; Louisiana range 0.497 to 1.195, mean 0.81) | multiplies the base cost per click; divides the allocation weight (floored at 0.3) |
| ZIP columns `p_<key>` (11) | 2172 | pool: expected jobs a year for the line in the ZIP | `zipLine().pool` |
| ZIP columns `r_<key>` (11) | 2172 | rate: jobs per 10,000 residents a year | `zipLine().rate`; map layer |
| ZIP column `zip` | 2175 | | allocation output |
| `PL[]` (`key, name, unit, what, g`) | 2165, 2184-2185 | from 04_content.js | line metadata and layer notes |

Constants and formulas, copied exactly
- Line 2126 comment: `/* monthly shape from the data where it exists: storm events spread over the month they happen and the two after (40, 35, 25 percent) */`
- Line 2127: `const norm12 = a => { const m = mean(a) || 1; return a.map(v => Math.round(100 * v / m)); };` (index with mean 100)
- Line 2128: `const lag = a => a.map((_, i) => 0.40 * a[i] + 0.35 * a[(i + 11) % 12] + 0.25 * a[(i + 10) % 12]);`
- Line 2131: `const RAIN = [5.4, 4.6, 4.6, 4.9, 5.1, 6.1, 5.9, 5.6, 4.6, 4.1, 4.2, 5.0];   /* Louisiana statewide normal precipitation, inches (NOAA 1991 to 2020, rounded) */`
- `SEA` (lines 2133-2143):
  - `replace: [82, 86, 104, 110, 110, 100, 95, 95, 100, 110, 106, 82]` (hard-coded)
  - `repair: norm12(RAIN.map((r, i) => r * 0.7 + (windN[i] / 100) * 1.5))`
  - `storm: norm12(lag(tropN.map((t, i) => 0.7 * t + 0.25 * windN[i] + 0.05 * tornN[i])))`
  - `hail: norm12(lag(TM.hail))`
  - `fortified: [70, 70, 85, 95, 105, 120, 120, 115, 110, 110, 100, 100]` (hard-coded; peaks June to August, the hurricane season and the June grant round)
  - `metal:` same array as `replace`
  - `mh: norm12(lag(tropN.map((t, i) => 0.4 * t + 0.4 * windN[i] + 0.2 * 100 * RAIN[i] / 5)))`
  - `mf: [95, 100, 105, 105, 105, 100, 100, 100, 100, 100, 95, 95]`, `comm: [90, 95, 105, 105, 105, 100, 100, 100, 105, 105, 100, 90]`, `coat: [80, 85, 100, 110, 115, 110, 105, 105, 105, 105, 95, 80]`, `newc: [90, 90, 105, 105, 105, 105, 100, 100, 100, 100, 100, 100]` (hard-coded)
- `DEF` (lines 2147-2162): `cpc: 38` (base cost per click, dollars), `budget: 15000` (dollars a month by the look of it; the period is not stated here), `alpha: 1.2`, `fee: META.model.FEE`, and per line:

| key | `cpcMul` | `cvr` (click to lead, %) | `close` (lead to sold job, %) |
|---|---|---|---|
| replace | 1.0 | 9.0 | 25 |
| repair | 0.65 | 12.0 | 55 |
| storm | 1.25 | 12.0 | 30 |
| hail | 1.2 | 10.0 | 28 |
| fortified | 0.55 | 8.0 | 35 |
| metal | 0.75 | 7.0 | 20 |
| mh | 0.45 | 11.0 | 35 |
| mf | 0.8 | 5.0 | 15 |
| comm | 1.1 | 5.0 | 12 |
| coat | 0.7 | 6.0 | 18 |
| newc | 0.5 | 4.0 | 10 |

- Line 2169-2170, exact: `/* unit economics for a line at a ZIP's relative cost: cost per lead, cost per sold job, gross profit per job and its ratio to cost */`
  `function blended(L, z) { const p = A.lines[L.key]; const cpc = A.cpc * p.cpcMul * (z && isN(z.cpc_rel) ? z.cpc_rel : 1); const cvr = p.cvr / 100; const close = p.close / 100; const cpl = cpc / cvr; const cps = cpl / close; const feeCase = p.val * A.fee; return { cpc, cvr: p.cvr, cpl, close: p.close, cps, feeCase, roi: feeCase / cps }; }`
  So: cost per click = base x line multiplier x `cpc_rel`; cost per lead = cpc / cvr; cost per sold job = cpl / close; gross profit per job = value x fee; `roi` = gross profit per job / cost per sold job.
- Line 2171-2172, exact: `/* a ZIP's annual jobs, the jobs open to marketing, and the gross profit pool for a line under the current assumptions */`
  `function zipLine(z, k) { const p = A.lines[k]; const pool = z['p_' + k] || 0; const cases = pool * p.rep; return { pool, cases, fees: cases * p.val * A.fee, rev: cases * p.val, rate: z['r_' + k] }; }`
  So: `cases = p_K x REP_K` ("jobs open to marketing"), `rev = cases x VAL_K`, `fees = cases x VAL_K x FEE` ("gross profit pool"). The names `cases` and `fees` look inherited from an earlier template for another trade (see the `car`, `landlord`, `practice_line` leftovers in sections 11 and 13); here they mean jobs and gross profit.
- Line 2174-2175, exact: `/* budget allocation: share of budget proportional to (gross profit pool / relative cost) ^ alpha across the chosen ZIPs */`
  `function allocate(budget, keys, zips, alpha) { alpha = alpha == null ? A.alpha : alpha; const w = zips.map(z => { const f = zipAll(z, keys).fees; return Math.pow(Math.max(0, f) / Math.max(0.3, z.cpc_rel || 1), alpha); }); const s = sum(w) || 1; return zips.map((z, i) => ({ zip: z.zip, z, w: w[i] / s, budget: budget * w[i] / s })); }`
- Line 2179-2180, exact: `/* top line by gross profit pool for each ZIP (used by the accounts module) */` `Z.forEach(z => { let best = null, bv = -1; LINE_KEYS.forEach(k => { const v = zipLine(z, k).fees; if (v > bv) { bv = v; best = k; } }); z.sl_top = best; });` -> derived ZIP key `z.sl_top` (computed once at load with the stored assumptions).
- Lines 2184-2185 (the only place in my range where the rate columns are explained), exact:

```js
out['r_' + l.key] = { l: `${l.name}: jobs per 10,000 residents a year`, grp: 'Service line rates', dir: 1, ramp: 'green', g: l.g, f: v => D(v, 1), note: `${l.unit}, per 10,000 residents, shrunk toward the parish rate for small ZIPs (prior of 2,500 residents). ${l.what}` };
out['p_' + l.key] = { l: `${l.name}: jobs a year (count)`, grp: 'Service line volume', dir: 1, ramp: 'green', g: l.g, f: v => v < 10 ? D(v, 1) : N(v), note: `${l.unit}. Volume, not rate: large ZIPs shade darker.` };
```

Checks I ran on the Louisiana data (not statements from the code)
- `f_K` equals `p_K x META.model.REP[K] x META.model.VAL[K] x META.model.FEE` to rounding for every ZIP and line (the stored `f_*` columns are the default-assumption gross profit pools; `SLM.zipLine` recomputes them live from `p_*`, so the code in this section never reads `f_*`).
- ZIP column `fees` = sum of the eleven `f_K` (max difference $3); ZIP column `cases` = sum of `p_K x REP_K` (max difference 0.02).
- `META.pools[K]` = sum over ZIPs of `p_K`; `META.cases[K]` = `META.pools[K] x REP[K]`; `META.fees[K]` = sum of `f_K`; `META.fees_tot` = sum of ZIP `fees` (705,313,938).
- `r_K` is consistent with `(p_K + 2500 x parish rate) / (pop + 2500) x 10,000`, where parish rate = parish `p_K` / parish `pop` (median deviation 0.7 percent, 90th percentile 8 percent, a few small ZIPs far off, so the exact prior or population base differs slightly from this reconstruction).
- `res_ok` is 1 for exactly the 441 ZIPs with `pop >= 500` (`META.nres = 441`), and `idx` is non-null for exactly those.

### 10.4 LOUISIANA-SPECIFIC CONTENT
| Line | Item |
|---|---|
| 2129-2130 | `DATA.ts.trop_month` and `tropN`: a tropical-cyclone monthly climatology drives the `storm` and `mh` seasons |
| 2131 | `RAIN = [5.4, 4.6, 4.6, 4.9, 5.1, 6.1, 5.9, 5.6, 4.6, 4.1, 4.2, 5.0]` with the comment `Louisiana statewide normal precipitation, inches (NOAA 1991 to 2020, rounded)` |
| 2133, 2137-2143 | Hard-coded monthly shapes judged for Louisiana (replacement work dips in December to February and mid-summer; FORTIFIED peaks June to August) |
| 2135, 2139 | Seasonal mixes built on tropical storms, thunderstorm wind and tornadoes (weights 0.7 / 0.25 / 0.05 and 0.4 / 0.4 / 0.2) |
| 2136 | `hail` season from hail reports |
| 2148 | `cpc: 38`, `budget: 15000`, `alpha: 1.2` (market-level assumptions; the Louisiana base cost per click) |
| 2150-2160 | `cpcMul`, `cvr`, `close` for the eleven Louisiana lines; `storm` and `hail` carry the highest click-cost multipliers (1.25, 1.2) |
| 2165 | Daypart classes: `['storm', 'repair', 'mh']` -> `emergency`; `['comm', 'coat', 'mf', 'newc']` -> `b2b` (line keys) |
| 2184 | Layer note text `shrunk toward the parish rate for small ZIPs (prior of 2,500 residents)` |

### 10.5 California changes
- `DEF.lines` and `SEA`/`SEA_G` must have exactly the California line keys (they are indexed by `PL[].key`; a line missing from `DEF.lines` makes `blended` and `zipLine` throw on `A.lines[k]`).
- `META.model.REP`, `VAL`, `FEE` must be supplied for the new keys; California job values are materially higher than the Louisiana `VAL` figures (labour, tile, permit and disposal costs), and the base `cpc: 38` should be re-estimated for California markets.
- `RAIN` (line 2131): replace with a California monthly normal. California's precipitation is winter-concentrated (November to March) and near zero in summer, and differs sharply by region, so one statewide vector is a weaker proxy than in Louisiana; consider per-region vectors keyed by `reg`.
- `DATA.ts.trop_month` has no California meaning. The code needs some 12-value hazard climatology or the `storm`/`mh` formulas must be rewritten: candidates are monthly counts of high-wind reports (Santa Ana season, roughly October to February; Diablo winds in autumn), atmospheric-river days (November to March), red-flag or wildfire days (June to November). `ts.month.{hail, wind, torn}` must still exist as 12-value arrays if any formula keeps them (`TM.wind` and `TM.torn` are read unconditionally at line 2130; `TM.hail` at 2136).
- `localStorage` key `up.slm.v1` holds per-line overrides; a California build that changes line keys should change the storage key so stale Louisiana overrides are not merged.
- `shrunk toward the parish rate` -> `county rate`; the prior of 2,500 residents is a data-build parameter to restate.
- Question: the period of `DEF.budget` (15,000) is not stated in this section; modules 05/08 decide (outside my range). `DAYPARTS.crash` is unused by name in my range.

---

## 11. 10_watch_core.js (lines 2193-2359)

### 11.1 What it is
`WATCH`, the Competitor Watch engine: the competitor roster built from `DATA.comp`, a ledger of observed ads, claims and signals kept in `localStorage` (`up.watch.v1`), deep links into the Meta Ad Library and Google Ads Transparency Center, a Meta Ad Library API request builder, importers (API JSON, library links, CSV, atlas JSON), text inference of service line / offer / hook, compliance linting of competitor copy with the Satchel rules, and summary analytics. Comment at 2199-2201, exact: `The ledger lives in this browser (localStorage) and travels as JSON or CSV. Nothing here calls a platform on its own: the Meta Ad Library API bridge builds the request and runs it only when the page is opened outside the Claude viewer (whose network rules block it) and a token is supplied; otherwise the request URL opens in a new tab and the JSON answer is pasted back into the importer.`

### 11.2 Globals
One global, `WATCH` (line 2202, returned at 2358): `{COMPANIES, CI, KINDS, PLATFORMS, FORMATS, OFFERS, HOOKS, LINKS, API_FIELDS, ROSTER_DATE, isBench, S (getter), obs (getter), settings(), setSettings, metaApiUrl, metaApiRun, canFetch, matchCompany, importText, blankObs, add, update, remove, addMany, setMeta, meta, clearSeeds, reseed, replaceAll, activity, forCompany, score, stats, weekly, zipCounts, digest, csv, json, sweepRows, isLive, daysAgo, inferLine, inferOffer, inferHook, lintObs, today, domOf}`.

| Member | Line | Meaning |
|---|---|---|
| `COMPANIES`, `CI` | 2208-2209 | roster objects `{key (slug of name), i, name, domain, url, tier, hq, cities[], offices[], lines[], verified, spanish, title, desc, h1, social[], notes, asof}`; `CI` by key |
| `isBench(c)` | 2210 | true when the competitor's domain equals `BRAND.domain` (the user's own company is excluded) |
| `KINDS` | 2212 | `ad, claim, signal, event, reviews` |
| `PLATFORMS` | 2213 | `meta, google, lsa, youtube, microsoft, tiktok, nextdoor, site, tv, radio, ooh, mail, signs, door, other` |
| `FORMATS` | 2214 | `image, video, carousel, text, lead form, story or reel, display, billboard, sign or hanger, other` |
| `OFFERS` | 2215 | `free, insurance, financing, warranty, reviews, certs, speed, spanish, none` with labels |
| `HOOKS` | 2216 | 14 hook names |
| `inferLine(t)`, `inferOffer(t)`, `inferHook(t)` | 2219-2222 | keyword classifiers |
| `LINKS` | 2242-2253 | URL builders: `metaKw, metaKwAll, metaPage, metaLib, googleDomain, googleAdv, googleCreative, gSearch, gMaps, site` |
| `metaApiUrl(o)`, `metaApiRun(o)`, `canFetch()` | 2256-2272 | Graph API `ads_archive` request (default version `v21.0`, countries `['US']`); runs only outside the viewer |
| `matchCompany(name, domainOrUrl)` | 2275-2280 | match by domain, exact normalised name, then token overlap of at least 0.5 |
| `importText(text, compKey)` | 2302-2308 | returns `{obs, meta, note}` |
| `blankObs(o)` | 2301 | observation shape: `{id, comp, compName, kind, platform, status, first, last, format, line, offer{type, text}, hook, cta, url, geo, zips[], lang, ids{lib, page, adv, cr}, snapshot, text, notes, src, reviews, lint[]}` |
| `lintObs(o)` | 2310 | `satchelLint` on the observation text with `{platform, web, page, noHouse: true}`, notes dropped; returns rule ids |
| CRUD | 2312-2321 | `add, update, remove, addMany, setMeta, meta, clearSeeds, reseed, replaceAll, setSettings` (each saves and emits `BUS 'watch'`) |
| `isLive(o)`, `daysAgo(d)` | 2323-2324 | live = status active, or unknown ad seen in the last 60 days |
| `activity()` | 2325 | live ad counts per company and line (last 120 days, seeds excluded) |
| `score(c)` | 2327-2328 | pressure score: tier weight `{statewide: 30, national: 24, regional: 14, local: 6}` + `min(40, live ads x 6)` + platforms x 5 + 6 if Spanish + `min(10, offices)` + 4 if any insurance offer |
| `stats()`, `weekly(weeks)`, `zipCounts()`, `digest()` | 2329-2352 | analytics; `digest()` returns sentences |
| `csv()`, `json()`, `sweepRows(keys)` | 2354-2356 | exports; CSV header `CSV_H` at line 2289 |

### 11.3 DATA CONTRACT
| Field | Line | Meaning / use |
|---|---|---|
| `META.compiled` | 2203 | `ROSTER_DATE` (fallback `'2026-10-06'`) |
| `DATA.comp[]` (via `COMP`) | 2208 | fields read: `name`, `domain`, `url`, `tier` (`'statewide' \| 'national' \| 'regional' \| 'local'`; Louisiana counts 2 / 3 / 16 / 8), `hq` (city name), `cities[]` (city names), `offices[]` (`{city, lat, lon, hq}`; only the length is used here), `lines[]` (service-line keys), `verified` (bool), `spanish` (bool), `title`, `desc`, `h1` (text read from the competitor's site), `social[]`, `notes`, `asof` (ISO date) |
| `DATA.comp[]` fields present in the data but not read in this section | - | `seg` (`res \| comm \| both`), `phone`, `fin`, `cert[]` |
| `BRAND.domain` | 2210 | to exclude the user's own company |
| `LINE_KEYS` | 2217, 2348 | valid `line` values; coverage counts per line |
| `SLM.lineName` | 2348 | line names in the digest |
| `SAT` rules via `satchelLint` | 2310 | lint ids stored on observations |
No ZIP column, parish field or weather field is read. (`zipCounts()` counts ZIP strings that the analyst typed into observations.)

### 11.4 LOUISIANA-SPECIFIC CONTENT
| Line | Item |
|---|---|
| 2203 | Fallback roster date `'2026-10-06'` |
| 2215 | `OFFERS.certs: 'Certification or FORTIFIED claim'` |
| 2216 | `HOOKS` entries `'FORTIFIED and grants'`, `'storm response'`, `'hail'` |
| 2219 | `inferLine` keyword rules: `/fortified\|fortify\|ibhs/` -> `fortified`; `/hail/` -> `hail`; `/storm\|hurricane\|wind\|tarp\|emergency/` -> `storm` (and the other eight line keys) |
| 2220 | `RX_INS` (claims and deductible wording, the Louisiana enforcement focus) |
| 2221-2222 | `inferOffer` (`fortified` counts as a certification) and `inferHook` (`/fortified\|fortify\|grant/` -> `'FORTIFIED and grants'`; `/storm\|hurricane\|wind\|tarp/` -> `'storm response'`) |
| 2228 | Comment `seed observations from the verified site reads (October 5, 2026)` |
| 2236 | Seed rule keyed to roster notes: `/calls itself\|slogan\|moniker\|big truck/i` (no Louisiana roster note currently matches it) |
| 2243-2249 | Library links fixed to `country=US` / `region=US` (national, keep) |
| 2250 | `gSearch: (name, city) => [...] name + ' ' + (city \|\| 'Louisiana') + ' roofing'` |
| 2251 | `gMaps: (name, city) => [...] name + ' ' + (city \|\| 'Louisiana')` |
| 2274 | `norm()` strips the words `louisiana` and `la` (with `inc, llc, roofing, construction, ...`) before matching company names |
| 2345 | Digest sentence: `` `[...] verified sites talk about insurance or claims in their title or description ([...]). Louisiana bars contractors from advertising claim handling or policy interpretation and from offering anything toward a deductible, so read those pages closely (module 10).` `` |
| 2346 | `"free" needs its conditions beside it (16 CFR Part 251)` (federal, keep) |
| 2354 | CSV note `Competitor Watch ledger, Uplift Louisiana Roofing Atlas, exported [...]` |
| 2355 | JSON export tag `atlas: 'Uplift Louisiana Roofing Atlas, module 13'` |
| data | The roster itself (`DATA.comp`, 29 companies with Louisiana cities and offices: Garcia Roofing, Hargrove Roofing & Construction, Brown's Roofing, Bayou Roofing, Premier South Roofing & Sheet Metal, Vinyltech Roofing, Gulf Coast Construction & Restoration, Lifetime Roofing, 225 Roofers, Roofs Restored, Magnolia Roofing, Ibos Roofing, Gerdes Roofing, Schwander Hutchinson Roofing, Orleans Sheet Metal Works & Roofing, Burford Roofing and Construction, Roof Kings of Louisiana, Pelican Roofing Company, Seegers Roofing & Remodeling, Patriot Roofing & Construction, 318 Construction, CentiMark, Nations Roof, Roofing Solutions, Carriere-Stumm, Coleman Roofing & Construction, RYCARS Construction, Ace Roofing, Guardian Roofing Systems) |

### 11.5 California changes
- `DATA.comp` must be rebuilt with California competitors in the same shape; `tier` must be one of the four keys of `TW` (line 2327) or the company scores 0 for tier; `lines[]` must use the California line keys; `cities[]` and `hq` should be names that exist in `DATA.cities` if modules join on them (outside my range).
- `inferLine`, `inferOffer`, `inferHook`, `HOOKS`, `OFFERS`: re-key to the California lines and hooks (wildfire, cool roof, tile, solar, rain/leak emergency, Santa Ana wind), and drop `fortified`/`hail` branches if those lines go. `HOOKS` strings are stored in ledgers and CSV exports, so a changed list will not match old ledgers; change the storage key `up.watch.v1` (line 2203) for the California build.
- Lines 2250, 2251: fallback `'Louisiana'` -> `'California'`. Line 2274: strip `california|ca` instead of `louisiana|la`.
- Line 2345: the digest's legal sentence must be rewritten from California law (or reduced to a neutral "read those pages closely").
- Lines 2354, 2355: product name in export notes.
- Leftovers that are harmless but reveal the template's history: CSV import accepts a `practice_line` column as a synonym of `service_line` (line 2299).
- Question: `score()` weights are judgement constants; whether California needs a `multi-state` or `franchise` tier is a roster decision.

---

## 12. 11_nws_core.js (lines 2361-2459)

### 12.1 What it is
`NWSX`, the weather reader behind the Weather Desk (module 14): it holds the embedded forecast snapshot (`window.__NWS_SNAPSHOT__`), can refresh it live from `api.weather.gov` when the page runs outside the Claude viewer, and turns the hourly forecast into (a) an hourly "storm demand index" with trigger windows and bid adjustments, (b) roofing work windows per day, and (c) a mapping from NWS alert types to marketing and crew actions.

Header comment (lines 2365-2370), exact: `NWSX: National Weather Service reader, storm triggers and roofing work windows` / `Sources: api.weather.gov (points, gridpoint forecast, hourly forecast, raw grid with wind gusts, thunder and weather attributes, alerts with hail and gust parameters, station observations, forecast discussions), the NHC Atlantic tropical weather outlook and active storms, and the SPC day 1 to 3 convective outlooks, for nine Louisiana points, one per region. A snapshot taken October 6, 2026 is embedded so the desk works offline and inside the Claude viewer, whose network rules block live calls; outside the viewer, Refresh pulls the live forecast.`

### 12.2 Globals
One global, `NWSX` (line 2371, returned at 2457): `{D (getter), live (getter), PTS0, REGOF, hh, partsOf, holiday, BASE, BASE_AI, hourly, windows, workDays, level, actionFor, ALERT_MAP, refresh, scheduleCSV, gridAt}`.

| Member | Line | Meaning |
|---|---|---|
| `NWSX.D` | 2375 | the working weather object: a deep copy of the snapshot, or an empty skeleton built from `PTS0` (`{fetched: null, source: '', points: [{city, lat, lon, periods: [], hourly: [], grid: {}}], alerts: [], obs: [], afd: {}, nhc: {}, spc: {}}`) |
| `NWSX.live` | 2376 | true after a successful `refresh()` |
| `PTS0` | 2374 | the nine forecast points `[city, lat, lon]` |
| `REGOF` | 2373 | forecast point city -> region number (a key of `META.model.REG`) |
| `hh(h)` | 2377 | hour label `12a`, `3p` |
| `partsOf(iso)` | 2378 | `{y, mo, d, h, date}` from the local ISO string (no time-zone conversion: forecast times are read as local wall time) |
| `holiday(date)` | 2382 | name of the holiday window containing `date`, else `''` |
| `BASE` (`BASE_AI` alias) | 2384-2385 | 7 x 24 "lead clock" (day of week x hour), normalised to mean 1.0 |
| `gridAt(arr, iso)` | 2387 | value of an NWS grid series `[[validTime "start/duration", value]]` at an hour |
| `hourly(pi)` | 2390-2411 | per-hour records for point index `pi`: `{t, date, h, dow, tempF, heat, pop, thun, gust, short, base, ai, wx, hol, why[], risk, work, wwhy[], isDay}` |
| `level(r)` | 2413 | `>= 2.0 'high'`, `>= 1.4 'elevated'`, `>= 0.8 'normal'`, else `'low'` |
| `windows(pi)` | 2415-2419 | runs of consecutive hours with `risk >= 1.4`: `{date, dow, start, end, peak, why[], level, bid}` with `bid = peak >= 2.0 ? 25 : 15` |
| `workDays(pi)` | 2420-2424 | per day (daytime hours): `{date, dow, good, marginal, blocked, why[], hol, verdict}`; verdict `'no tear offs'` when `blocked >= 4`, `'repairs and inspections'` when `blocked + marginal >= 4`, else `'full production'` |
| `ALERT_MAP`, `actionFor(ev)` | 2426-2436 | alert event name -> `{kind, text}` |
| `refresh(onStep)` | 2439-2451 | live fetch of points, forecasts, grid data and state alerts; emits `BUS 'nws'`; throws inside the viewer |
| `scheduleCSV()` | 2452-2455 | CSV of trigger windows with campaign names |

### 12.3 DATA CONTRACT

`window.__NWS_SNAPSHOT__` (line 2372) - shape, with what this section reads
| Path | Shape in the Louisiana file | Read in this section |
|---|---|---|
| `fetched` | ISO time `"2026-10-06T05:42:39+00:00"` | printed in `scheduleCSV` note (2454) |
| `source` | `"api.weather.gov (NWS New Orleans/Baton Rouge LIX, Lake Charles LCH, Shreveport SHV, Jackson JAN offices); NHC; SPC"` | not read here |
| `points[]` (9) | `{city, lat, lon, office, gridX, gridY, zone, county, radar, updated, periods[14], hourly[120], grid{}}` | `city` (2453), `hourly`, `grid` (2391-2393). The order of `points` is the index `pi` used by `hourly/windows/workDays`; `city` must be a key of `REGOF` for the region name |
| `points[].hourly[]` | `{t (local ISO with offset), tempF, rh, pop, wind ("5 mph"), short, isDay}` | `t, tempF, rh, pop, short, isDay` |
| `points[].grid.probabilityOfThunder` | `[[validTime, percent]]` | thunder probability |
| `points[].grid.windGust` | `[[validTime, km/h]]` | gust; converted to mph by `kmh = v => v / 1.609` (line 2388; the function name is misleading, it returns mph) |
| `points[].grid.weather` | `[[validTime, "thunderstorms, rain_showers:light"]]` (weather, `:intensity`, `[attributes]`) | tested for `large_hail\|hail`, `damaging_wind`, `tropical storm\|hurricane` |
| `points[].grid.quantitativePrecipitation, windSpeed, probabilityOfPrecipitation, visibility` | `[[validTime, value]]` (mm, km/h, percent, metres) | stored by `refresh`, not read here |
| `points[].periods[]` | `{name, start, end, isDay, tempF, short, pop, wind, detail}` | stored by `refresh`, not read here |
| `alerts[]` | `{id, event, severity, urgency, headline, description, instruction, onset, ends, expires, areas, sent, hail, gust}` (empty in the snapshot) | written by `refresh` (2449); `event` is what `actionFor` classifies |
| `obs[]` (15) | `{id (ICAO), lat, lon, time, tempF, visMi, text, windMph, gustMph}` | not read or refreshed here |
| `afd` | `{LIX, LCH, SHV: {issued, text}}` area forecast discussions by office | not read or refreshed here |
| `nhc` | `{storms[]: {id, name, cls, intensity, pressure, lat, lon, movement, speed, updated}, two: {issued, text}}` | not read or refreshed here |
| `spc` | `{"1","2","3": {valid, levels: {FIPS: 0..}}}` convective outlook level per parish | not read or refreshed here |
`refresh()` replaces only `fetched`, `source`, `points` and `alerts`; `obs`, `afd`, `nhc`, `spc` keep their snapshot values.

Other fields read
| Field | Line | Use |
|---|---|---|
| `REGN` (`META.model.REG`) | 2453 | region name for campaign names and the CSV `region` column |

The computations, copied exactly
- Line 2383-2384 (lead clock): comment `the lead clock: share of roofing leads by day and hour, 1.0 = an average hour (assumption, grade D, until account actuals replace it)`; `day = [0.25, 0.15, 0.1, 0.1, 0.15, 0.35, 0.8, 1.4, 1.9, 2.0, 1.9, 1.8, 1.7, 1.7, 1.6, 1.6, 1.5, 1.4, 1.3, 1.1, 0.9, 0.7, 0.5, 0.35]` (hours 0 to 23), `dw = [0.55, 1.15, 1.15, 1.1, 1.1, 1.0, 0.8]` (Sunday to Saturday), outer product divided by its mean.
- Lines 2389-2400 (storm demand index per hour; comment `per hour: storm demand index (damage potential that becomes roofing work in the days after) and the work window`): `risk = 1`; `if (thun >= 15) risk += 0.6 * thun / 100`; `if (gust >= 30) risk += (gust - 30) / 20` (gust in mph); `if (hail) risk += 1.0`; `if (dwind) risk += 0.8`; `if (trop) risk += 1.5`. Reasons text: `thunder N%`, `gusts N mph`, `hail possible`, `damaging wind possible`, `tropical conditions`.
- Lines 2401-2407 (work window): heat index by the NWS Rothfusz regression (line 2412) when `tempF >= 80`; `pop >= 50` blocked, `pop >= 25` marginal; `thun >= 30` blocked (`lightning`); `gust >= 30` blocked, `gust >= 22` marginal; heat index `>= 105` marginal; otherwise `good`, or `night` when not daytime.
- Line 2418: bid adjustment `25` percent for a window peaking at `>= 2.0`, else `15`.

### 12.4 LOUISIANA-SPECIFIC CONTENT
| Line | Item |
|---|---|
| 2366-2370 | Header comment: `the NHC Atlantic tropical weather outlook and active storms`, `nine Louisiana points, one per region`, `A snapshot taken October 6, 2026` |
| 2373 | `REGOF = { 'New Orleans': 1, 'Baton Rouge': 2, 'Houma': 3, 'Lafayette': 4, 'Lake Charles': 5, 'Alexandria': 6, 'Shreveport': 7, 'Monroe': 8, 'Hammond': 9 }` |
| 2374 | `PTS0 = [['New Orleans', 29.9511, -90.0715], ['Baton Rouge', 30.4515, -91.1871], ['Lafayette', 30.2241, -92.0198], ['Lake Charles', 30.2266, -93.2174], ['Shreveport', 32.5252, -93.7502], ['Monroe', 32.5093, -92.1193], ['Alexandria', 31.3113, -92.4451], ['Houma', 29.5958, -90.7195], ['Hammond', 30.5044, -90.4612]]` |
| 2381 | Holiday windows `HOL` (dated): `Columbus Day weekend` 2026-10-09 to 10-12, `Thanksgiving` 2026-11-25 to 11-29, `Christmas` 2026-12-23 to 12-27, `New Year` 2026-12-31 to 2027-01-03, **`Mardi Gras` 2027-02-05 to 02-09**, `Memorial Day weekend` 2027-05-28 to 05-31, **`Hurricane season opens` 2027-06-01**, `Independence Day` 2027-07-02 to 07-05, `Labor Day weekend` 2027-09-03 to 09-06 |
| 2394, 2400 | `trop = /tropical storm\|hurricane/i.test(wx)` with `risk += 1.5` and reason `tropical conditions` |
| 2394, 2398 | `hail` trigger (`+1.0`) and `damaging_wind` (`+0.8`): convective-storm attributes, rare in California forecasts |
| 2406 | Heat index threshold 105 (humid-climate measure) |
| 2427 | `ALERT_MAP` Tropical: `/Hurricane\|Tropical Storm\|Storm Surge/i` -> `Before landfall: run preparation and tarp capacity messages, never fear; pause replacement ads in the warned parishes while the storm passes. After it: emergency tarping and inspection ads in the hit ZIPs (module 02 shows the footprint), price books frozen at pre storm levels (R.S. 29:732), no claim help or deductible language (R.S. 37:2159.1, 51:451), three day notice on every sale at the home (16 CFR 429).` |
| 2428 | Severe storm: `Read the hail size and gust in the warning. With hail of 1 inch or more or gusts of 58 mph or more, log the warned ZIPs and launch hail or wind inspection ads there once the storm passes, for 30 days; raise bids 15 to 25 percent for the first 72 hours.` |
| 2429 | Tornado: `After the event: tarp and inspection ads in the path ZIPs once the NWS damage survey is out; no canvassing without the three day cancellation notice; keep crews off damaged structures until cleared.` |
| 2430 | Flood: `Flood damage is not roof damage: keep roofing ads on, avoid flood imagery. Heavy rain finds weak flashing, so leak repair ads earn their keep for the next 72 hours.` |
| 2431 | Wind: `/Wind Advisory\|High Wind\|Lake Wind/i` -> `Gusts over 30 mph: no tear offs. After the event, repair ads for lifted and missing shingles in the advisory area.` |
| 2432 | Heat: `Crew safety: start tear offs at first light and stop by early afternoon; hydration breaks; shingles scuff in heat.` |
| 2433 | Freeze: `No work on iced or frosted decks. After a hard freeze, attic pipe leaks look like roof leaks: repair ads with diagnosis language, not storm language.` |
| 2434 | Fog: `No roofing effect beyond early starts.` |
| 2448 | Live alerts URL `https://api.weather.gov/alerts/active?area=LA` |
| 2453 | Campaign name prefix `LA_STORM_GOOGLE_` + region name |
| snapshot | `source` string naming NWS offices LIX, LCH, SHV, JAN; point metadata (offices `LIX, LCH, SHV`; zones `LAZ077, LAZ048, LAZ044, LAZ241, LAZ001, LAZ014, LAZ028, LAZ096, LAZ081`; counties `LAC071, LAC033, LAC055, LAC019, LAC017, LAC073, LAC079, LAC109, LAC105`; radars `KHDC, KLCH, KSHV, KPOE`); observation stations `KMSY, KNEW, KBTR, KLFT, KLCH, KSHV, KMLU, KAEX, KHUM, KHDC, KASD, KBAD, KARA, KDRI, KTVR`; forecast discussions for `LIX, LCH, SHV`; NHC Atlantic outlook text and active storms; SPC levels keyed by the 64 parish FIPS codes |

### 12.5 California changes
- `PTS0` and `REGOF`: one forecast point per California region, with `REGOF` values equal to the keys of the new `META.model.REG`. The number of points is free (the code maps over the array), but each point costs four API calls on refresh.
- Snapshot: regenerate in the same shape. California NWS offices are Eureka (EKA), Sacramento (STO), San Francisco Bay Area/Monterey (MTR), Hanford/San Joaquin Valley (HNX), Los Angeles/Oxnard (LOX), San Diego (SGX), plus Medford (MFR), Reno (REV), Las Vegas (VEF) and Phoenix (PSR) for border counties; `afd` should be keyed by the offices chosen. `spc.levels` must be keyed by the 58 county FIPS codes (`06001`...).
- `nhc`: the Atlantic tropical outlook is irrelevant. California analogues to consider for that slot: SPC fire weather outlooks, WPC excessive rainfall outlooks, CW3E atmospheric-river forecasts, red flag warnings. (The Louisiana snapshot's one active storm is in fact an East Pacific hurricane, `ep182026 Rachel`, which shows the feed is basin-agnostic.)
- Line 2448: `area=CA`. Line 2453: `CA_STORM_GOOGLE_` (or a hazard-neutral prefix).
- Line 2381 `HOL`: remove `Mardi Gras` and `Hurricane season opens`; add what matters to California crews and demand (for example the start of the rainy season, peak fire season, Cesar Chavez Day is a state holiday). The dates are hard-coded for October 2026 to September 2027 and go stale.
- Storm demand index (lines 2394-2400): re-derive the triggers. California roofing demand is triggered by heavy rain (the `quantitativePrecipitation` grid is already stored but unused), high wind (the gust rule works as is), and fire weather; `hail`, `damaging_wind` and `tropical` attributes will almost never fire. Without a rain trigger the index would sit near 1.0 through an atmospheric river.
- Work window: keep the rain, lightning and gust rules; heat index 105 seldom triggers in dry heat, so use air temperature thresholds (and Cal/OSHA outdoor heat rules are a compliance point for the Heat action text); add smoke/air-quality as a crew constraint.
- `ALERT_MAP`: rewrite for the California alert vocabulary: `Red Flag Warning`, `Fire Weather Watch`, `High Wind Warning`/`Wind Advisory`, `Atmospheric River`/`Flood Watch`/`Flash Flood Warning` (burn-scar debris flows), `Winter Storm Warning` (Sierra snow loads), `Excessive Heat Warning`/`Extreme Heat`, `Dense Fog Advisory`, `Air Quality Alert`, `Evacuation` messages. The Tropical row cites Louisiana statutes (R.S. 29:732, 37:2159.1, 51:451) and "warned parishes".
- `BASE` lead clock is a generic assumption and can stay.
- Questions: which module reads `obs`, `afd`, `nhc`, `spc` (module 14, outside my range); how the snapshot was assembled (the fetch script is not in the file), in particular how `spc.levels` per county and `obs` were derived.

---

## 13. 12_accounts_core.js and the CMS files that follow it (lines 2461-4986)

The span the build labels `12_accounts_core.js` is twelve script blocks. Only the first reads atlas data; the rest is a generic publishing layer.

| Lines | Marker | Global | Role |
|---|---|---|---|
| 2462-2788 | `12_accounts_core.js` / `accounts_core` | `ACCT` (also `globalThis.ACCT`) | Ad-platform connectors, actuals store, feedback into `SLM` |
| 2791-3010 | `cms/00_cms_core.js` / `cms_core` | `CMS` (also `globalThis.CMS`) | Publishing contract, HTTP, storage, portable pages, deploy driver |
| 3013-3255 | `cms/10_wordpress.js` / `cms_wordpress` | registers `wp_elementor`, `wp_headless` | WordPress through the FORGE bridge plugin |
| 3258-3433 | `cms/11_drupal.js` | registers `drupal` | Drupal 10 / 11 |
| 3436-3645 | `cms/12_wix.js` / `cms_wix` | registers `wix` | Wix CMS collections and Blog |
| 3648-3814 | `cms/13_duda.js` / `cms_duda` | registers `duda` | Duda |
| 3817-4001 | `cms/14_webflow.js` / `cms_webflow` | registers `webflow` | Webflow CMS collections |
| 4004-4219 | `cms/15_shopify.js` | registers `shopify` | Shopify pages and blog |
| 4222-4422 | `cms/16_hubspot.js` | registers `hubspot` | HubSpot CMS |
| 4425-4538 | `cms/17_joomla.js` | registers `joomla` | Joomla 4.1+ / 5 |
| 4541-4653 | `cms/18_ghost.js` | registers `ghost` | Ghost 5 |
| 4656-4984 | `cms/19_headless_kit.js` | `HEADLESS_KIT` (also on `globalThis`) | Next.js 15 project template for headless WordPress |

### 13.1 `ACCT` (lines 2462-2788): what it is
Header comment (2466-2472), in short: `ACCOUNTS: paid and social connectors, actuals store, model feedback (module 15)`. OAuth and API calls run when the page is a browser extension (host permissions) or, for APIs that allow browser calls, when opened as a file; inside the Claude viewer only file imports work. Credentials and every row of actuals stay in browser storage under the key `cf.accounts.v1` (line 2476; extension local storage when present, else `localStorage`).

Providers (`PROVIDERS`, lines 2498-2527; order `PORDER` 2528): `google` (Google Ads + Business Profile), `lsa` (Local Services Ads), `youtube`, `meta`, `tiktok`, `microsoft`, `linkedin`. API versions in `VERS` (2494): Google Ads `v24` (probe `v25, v24, v23`), Meta `v26.0` (probe `v27.0, v26.0, v25.0`), TikTok `v1.3`, LSA `v1`, YouTube `v2` / data `v3`, Microsoft `v13`, LinkedIn `202509`.

`ACCT` members (returned at 2786): `ENV ('chrome' | 'firefox' | 'viewer' | 'file'), RT, PROVIDERS, PORDER, IMPORTERS, VERS, S (getter), ready(), isReady(), cfg(p), tok(p), status(p), setCfg, connect, refreshToken, pasteToken, disconnect, test, pull, importCSV(text, forceId, srcLabel), templateCSV(), redirectUrl(), rowsAll(kind), byLine(days), byHour(days), observedGrid(), byZip(days), pacing(planBudget), social(days), applyToModels(), revertModels(), clearAll(what), lineOf(name), settings(), setSettings(p), requestHosts(), hostsGranted(), range(n), base(p), ver(p), resolveVer(p, force), windows(since, until, len), localParts(ts, tz)`. Emits `BUS 'acct'`.

The normalised actuals row (line 2601): `{src, kind ('ads' | 'hour' | 'geo' | 'lead' | 'social'), date, hour, campaign, adset, geo ({gid, zip} | {zip} | {region} | null), imp, clicks, spend, leads, calls, conv, msgs, line}`; `line` defaults to `lineOf(campaign)`.

### 13.2 `ACCT` DATA CONTRACT
| Field | Line | Meaning / use |
|---|---|---|
| ZIP column `gid` | 2618 | **Google Ads geo target constant ID of the postal code** (for example `9025099` for ZIP 70001). The Google `geographic_view` report returns `segments.geo_target_postal_code = "geoTargetConstants/<id>"`; the code builds `byGid[String(z.gid)] = z.zip` over all ZIPs and maps report rows to ZIPs. Without correct `gid` values, Google spend by ZIP cannot be joined |
| ZIP column `zip` | 2618, 2776 | join key; `byZip()` attaches `o.z = ZI[o.zip]` |
| `PL[].tok` | 2600 | campaign-name token to line key (`REPLACE, REPAIR, STORM, HAIL, FORT, METAL, MH, MF, COMM, COAT, NEWC`) |
| `SLM.A.cpc`, `SLM.A.lines`, `SLM.LI`, `SLM.set` | 2780-2781 | `applyToModels()` overwrites the model assumptions with observed values and can revert |
No `META` key, parish field or weather field is read.

Formulas, copied exactly
- Line 2600 (campaign name to service line): `function lineOf(name) { const s = String(name || ''); const m = s.match(/LA_([A-Z]+)_/); if (m) { const tok = m[1]; const hit0 = PL.find(l => l.tok === tok); if (hit0) return hit0.key; if (tok === 'BLEND') return 'replace'; } const t = s.toLowerCase(); const pairs = [[/fortified|fortify|ibhs/, 'fortified'], [/hail/, 'hail'], [/mobile home|manufactured|roof ?over/, 'mh'], [/apartment|condo|\bhoa\b|multifamily|multi family/, 'mf'], [/coating|restoration|silicone|maintenance/, 'coat'], [/commercial|flat roof|\btpo\b|\bpvc\b|epdm|low slope/, 'comm'], [/new construction|builder/, 'newc'], [/metal|standing seam/, 'metal'], [/storm|hurricane|wind|tarp|emergency/, 'storm'], [/leak|repair/, 'repair'], [/replace|new roof|reroof|shingle|roof|techo|lsa|local services/, 'replace']]; const hit = pairs.find(([re]) => re.test(t)); return hit ? hit[1] : ''; }`
- Line 2764 (ZIP recognition in CSV imports): `const zip = String(g(r, 'zip') || '').match(/\b(7[01]\d{3})\b/);` Only five-digit codes starting `70` or `71` (Louisiana) are accepted as ZIPs.
- Line 2768 (import template): `toCSV(['date', 'hour', 'campaign', 'zip', 'impressions', 'clicks', 'spend', 'leads', 'calls'], [['2026-10-01', '17', 'LA_REPLACE_META_EN_20261012', '70808', 1200, 18, 42.5, 2, 1]], 'Generic import template: one row per day (or hour) per campaign; zip optional. Campaign names that contain the desk token (LA_REPLACE_, LA_STORM_, LA_HAIL_, ...) map to service lines automatically.')`. The example shows the campaign naming convention: `LA_<LINE TOKEN>_<PLATFORM>_<LANGUAGE>_<YYYYMMDD>`.
- Line 2775 (`observedGrid`): observed lead share by the six hour blocks `[[0, 6], [6, 9], [9, 12], [12, 17], [17, 21], [21, 24]]` (the same blocks as `SLM.BLOCKS`), as a bid adjustment `clamp(round(((share / mean) - 1) * 100 / 5) * 5, -50, 60)`, repeated for seven days.
- Line 2780 (`applyToModels`): base `cpc` = Google + Microsoft spend / clicks (applied when above 0.2); per line `cvr` = Google `(leads + calls) / clicks` when clicks >= 50 and leads + calls >= 3; `metaCpl` and `lsaCpl` when at least 3 leads.

### 13.3 `ACCT` LOUISIANA-SPECIFIC CONTENT
| Line | Item |
|---|---|
| 2600 | Campaign-name prefix regex `/LA_([A-Z]+)_/` (state code `LA`), and the keyword table with `fortified\|fortify\|ibhs`, `hail`, `storm\|hurricane\|wind\|tarp\|emergency` |
| 2764 | ZIP regex `/\b(7[01]\d{3})\b/` (Louisiana ZIP prefixes 70 and 71) |
| 2768 | Template example `LA_REPLACE_META_EN_20261012`, ZIP `70808` (Baton Rouge), and the note naming `LA_REPLACE_, LA_STORM_, LA_HAIL_` |
| 2513 | Meta coverage text: `region and DMA breakdowns (Meta does not break out ZIP)` (generic; Meta `region` values are state names, so a single-state account has one region) |
| 2784 | Extension host permissions include `https://api.weather.gov/*` and `https://www.spc.noaa.gov/*` (weather sources; keep, add any California source hosts) |

Leftovers, apparently from an earlier template for another trade (the names suggest a law-firm atlas), that are wrong for roofing in any state and worth fixing during the rebuild:
| Line | Item |
|---|---|
| 2476, 2893 | Storage keys `cf.accounts.v1` and `cf.cms.v1` (prefix `cf.`, while the rest of the atlas uses `up.`); a California build opened in the same browser profile as the Louisiana one would share stored credentials and actuals |
| 2646 | LSA ad-spend rows are written with `line: 'car'` (two places on the line) |
| 2725 | LinkedIn rows are written with `line: 'landlord'` |
| 2773 | In `byLine`, lead rows without a line fall back to `'car'` (`const k = r.line \|\| 'car'`), while paid rows fall back to `'unmapped'` |
`'car'` and `'landlord'` are not service-line keys, so those rows are ignored by `applyToModels` (`if (!SLM.LI[o.line]) return`) and appear under a line literally named `car` or `landlord` wherever `byLine` is listed.

### 13.4 `ACCT` California changes
- Line 2600: prefix `CA_` (or make the prefix a constant shared with the campaign-name builder in the Campaign Desk module and with `NWSX.scheduleCSV`, line 2453); re-key the keyword table to the California lines.
- Line 2764: California ZIP codes run 90001 to 96162; use `/\b(9[0-6]\d{3})\b/` or, better, test membership in `ZI`.
- Line 2768: template example and note.
- `gid`: the California ZIP table needs the Google Ads geo target constant ID for each postal code (from Google's geotargets CSV: Criteria ID where Target Type = Postal Code and Canonical Name ends `California,United States`).
- Fix the `'car'` / `'landlord'` / `cf.` leftovers above.
- Questions: none of the platform code depends on the state. Meta's `region` breakdown returns state names; if the California build wants sub-state actuals from Meta, the `dma` breakdown (mentioned in the coverage text, not requested in code at line 2680) would have to be added.

### 13.5 `CMS` and the adapters (lines 2791-4653): summary
`CMS` (2813-3010) defines the publishing contract (header comment 2795-2812): a **PortablePage** `{id, slug, title, h1, meta_description, summary, excerpt, language, noindex, canonical, post_type, template, status, html, css, schema, seo{title, description, canonical, noindex, og_image}, elementor_data, page_settings, blueprint, media{slot: {url, id, alt, kind, width, height, mime, asset?}}, featured_media_url, dates{published, modified}, links[{anchor, url}]}` and an **Adapter** `{id, name, group, blurb, fields[], hosts[] | dynamicHost(cfg), setup[], docs, caps{media, urls, publishSite, elementor, schema, seo, postTypes}, base(cfg), test(cfg, ctx), listUrls(cfg, ctx), uploadMedia(cfg, asset, ctx), upsertPage(cfg, page, opts, ctx), publishSite?, remove?}`.

Exports (line 3008): `RT, CmsError, err, register, get, list, ADAPTERS, ORDER`, utilities (`esc, slug, trimSlash, originOf, b64, b64url, b64text, utf8, hex, fromHex, stripTags, stripScripts, words, sleep, sha256, hmacSha256, jwtHS256, md5, blobBytes, dataUrlToBlob, extOf`), `http, basicAuth, ensureOrigin, hasOrigin`, state (`ready, isReady, S, cfg, setCfg, setSettings, settings, deployedFor, markDeployed, clearDeployed, clearCfg, status, fieldsOk`), page builders (`pageFromForge(bp, r, media)` from a `FORGE_COMPILE.compile` result, `pageFromHtml(o)`, `pageFromBundle(b)`), rendering (`brandCss, hexmix, FORGE_CSS_DEFAULT, schemaTag, styleTag, bodyHtml, fullHtml, rewriteMedia, resolveMedia, isPlaceholder, stripPlaceholders, richText, htmlToBlocks, inlineRuns`), and `deploy(adapterId, pages, {publish, onlyNew, log, mediaHost, requireMedia, signal})`, `test(id)`. State key `cf.cms.v1` (line 2893). `deploy` refuses pages whose lint contains a `BLOCK` entry (line 2991).

Adapters registered: `wp_elementor` (3183) and `wp_headless` (3214) [group WordPress], `drupal` (3342), `wix` (3597), `duda` (3778), `webflow` (3945), `shopify` (4178), `hubspot` (4375), `joomla` (4474), `ghost` (4597). `HEADLESS_KIT` (4671-4983; version `1.0.0`, Next.js `15.5`) holds a Next.js App Router project as template strings with placeholders `__WP_HOST__, __SITE_URL__, __SITE_NAME__, __CSS__, __CTA_URL__, __CTA_LABEL__, __FOOTER_LINE__`; API `files(opts), zipEntries(opts), readme(opts), paths, version, next, resolve(opts), raw(path)`.

DATA CONTRACT: none of these files reads `window.__ATLAS_DATA__`, `META` or the weather snapshot. They consume pages built by the Site Forge.

LOUISIANA-SPECIFIC CONTENT: none. Product or trade strings only:
| Line | Text |
|---|---|
| 3174 | WordPress setup step: `In WordPress open Users, Profile, Application Passwords, name it Uplift Atlas and add it. Copy the password once; the site needs HTTPS.` |
| 4837 | Headless kit default form field label `Tell us about the roof` (same default as line 1454) |

California changes: none required (rename `Uplift Atlas` only if the product is renamed).

---

## Appendix A. Shapes of the data members (measured from `la_atlas_data.json`; reference for the data build)

Members marked * are not read by any code in lines 1 to 4986; their meaning is fixed by the modules. Shapes and the sums I checked are facts about the Louisiana file.

| Member | Shape |
|---|---|
| `zcols`, `zrows` | 165 names; 534 rows of 165 values (nulls for model columns of the 93 ZIPs under 500 residents) |
| `parishes[]` (64) | `fips, name, reg, aland, awater, pop, hh, inc, value, own, spanish, viet, french, pop5, a65p, hu, occ, rent, mh, u1, mf5u, seas, yb[10], yb_med, mort_sh, rooms, roofs, ra15, ra20, wave, nxt, hist{"2000".."2026": [age driven, storm driven]}, hd1, hd175, wd50, wd65, td1, hur64, hur50, ts34, n64_00, vmax_00, vmax_20, ev{h1, h175, w58, w75, t, ef1, dmg, n}, trop{hurr, ts, surge, hw}, fema{disaster number: count}, fema_k (= sum of fema), bps{"2005".."2025": [3 numbers]}, ytd26, ytd25, est, roofers, lic, cru, supply, adjusters, ins_agents, nzip, fees, comp, cbp_roof, cbp_roof_emp, cbp_sup` and the eleven `p_<key>`. My sections read only `fips, name, reg, hu, pop` |
| `cities[]` (265) | `name, pi, pop, nzip, zips[], lat, lon, fees, comp, roofers, lic, span, viet, hu, roofs, ra20` and the eleven `p_<key>`. Only unpacked in my range (`CITIES`, `CITYI` by `name`: names must be unique) |
| `places[]` (171) | `name, lat, lon, pop, cdp` (63 are census designated places) |
| `geo` | see section 3.3 |
| `seg[]` (432) | see section 3.3 |
| `routes[]` (38) | `r` (label), `id` (ATCF id such as `AL092021`), `name, year, month, op` (bool), `cat, vmax` (kt in Louisiana), `life` (kt, apparently the storm's lifetime peak), `n34, n50, n64`, `hu50, hu64`, `est`, `dr` (FEMA disaster number or null), `fema` (registrations or null), `lf{t, lat, lon, v, cat, p}` (landfall) or null, `pars[[parish index, value]]`, `start, end`. My reading of the unexplained names, to confirm against module 02: `n34/n50/n64` = number of ZIPs reaching 34, 50, 64 kt; `hu50/hu64` = housing units inside the 50 and 64 kt footprints; `est` = estimated roofs damaged (Ida 2021: 306 / 215 / 139 ZIPs, 1,146,414 / 842,677 units, 247,773) |
| `rlist` (38) | the `r` labels in order |
| `sids[]` (119) | `[name, year, category, peak wind kt]`, 1950 to 2026 |
| `zstorm`* | ZIP -> list of `[index into sids, wind at the ZIP in kt]` (1 to 31 storms per ZIP) |
| `pts[]` (5,115), `ptflags` (11) | see section 1.3 |
| `ts.month`, `ts.hour` | `{hail, wind, torn}` with 12 and 24 counts (`hour`* is not read in my range) |
| `ts.year`* | `"1996".."2025"` -> `{hail, hail1, hail2, wind, wind65, torn}` |
| `ts.dowhour`* | 7 x 24 counts |
| `ts.trop_month` | 12 counts |
| `ts.fema_year` | 18 rows, see section 1.3 |
| `ts.replace_hist`* | `"2000".."2026"` -> `[age driven, storm driven]` replacements; equals the sum over ZIPs of `rhist` (checked for 2005: 41,786 and 325,044) |
| `ts.ppi`* | `{asph, steel}`: monthly `["YYYY-MM", index]` pairs, January 2019 to August 2026 |
| `ts.permits`*, `ts.ytd26`*, `ts.ytd25`* | `"2005".."2025"` -> 3 numbers; two year-to-date scalars |
| `ts.agehist`* | 41 counts (statewide roofs by age 0 to 40) |
| `agez`* | ZIP -> 41 counts of roofs by age 0 to 40; the sum is the ZIP's `roofs`, ages 20 and over sum to `ra20`, ages 15 and over to `ra15` (checked for 70001) |
| `rhist`* | ZIP -> 27 pairs `[age driven, storm driven]` replacements for 2000 to 2026 |
| `hosp[]`* (161) | `id, name, city, zip, parish, type, own, lat, lon, pi` |
| `comp[]` (29) | see section 11.3 |
| `meta` | 35 keys, see `la_meta.json`; `meta.model` has `W, corr, sens, val, valpts, REP, VAL, FEE, GRADE, TIER, DMA, REG, P2R, DMG, WB, ANCH` (`P2R` maps the 64 parish FIPS codes to region numbers; `DMA` gives a cost factor per region: `1: 1.0, 9: 0.95, 2: 0.9, 3: 0.85, 4: 0.8, 5: 0.8, 7: 0.7, 6: 0.65, 8: 0.62`) |

## Appendix B. Open questions carried out of this range

1. Service lines: which eleven (or how many) lines California has. Everything keyed by line (`LINE_KEYS`, `PL`, `FCOPY.AC`, `SLM.DEF.lines`, `SLM.SEA`, ZIP columns `p_/r_/z_/f_`, `META.pools/cases/fees/model.*`, `comp[].lines`, the `inferLine` and `lineOf` keyword tables, campaign tokens `PL[].tok`) must change together.
2. Hazard model: what replaces named tropical storms (`routes`, `rlist`, `sids`, `seg`, `zstorm`, `ts.trop_month`, `ts.fema_year`, the `hurr`/`trop` point flags, `catLab`, the H/T/D track classes, the storm page templates and `{st_*}` tokens).
3. Regions: the California region set for `META.model.REG`, the per-region cost factor (`META.model.DMA`), the forecast point per region (`NWSX.PTS0`, `REGOF`).
4. Law: every statement in `LAWX`, `ADRULES`, `LAWPUB`, `SAT` and the legal facts quoted in copy must be re-researched for California and re-dated; the code only stores and prints them.
5. Map: `W`/`H` and vertex precision for a portrait state with about 1,760 ZIP polygons (section 3.5).
6. Languages: Louisiana carries Spanish, Vietnamese and French columns and Spanish-only copy (`lang: 'es'`, `kwEs`, `FCOPY.ES`); California's language set is a product decision.
7. Template leftovers to clean while rebuilding: `'car'` and `'landlord'` line keys and `cf.` storage keys in `ACCT`, `practice_line` in the watch CSV importer, `DAYPARTS.crash`, the `cases`/`fees` naming, road CSS classes (`.rd`, `.sI`, `.sUS`), `routeLabel`/`routeShort`, `CNAME`/`CO`/`COI`.

