# Contract: modules 09 to 17 and the shell of the Uplift Louisiana Roofing Atlas

Source read: `la_atlas_source.html`, lines 6901 to 9661 (the file on disk has 9,661 lines; the brief says 9,667). Data checked against `la_atlas_data.json`, `la_meta.json`, `la_nws_snapshot.json` and `la_zcols.txt`. All line numbers below are 1-based lines of `la_atlas_source.html`. Lines 559 and 560 (the data and the weather snapshot) were never printed.

| Module | Script section | Lines | `registerModule` key | Rail number and title |
|---|---|---|---|---|
| 09 | `21_m09_forge.js` | 6901 to 7902 | `forge` | 09 Site Forge |
| 10 | `22_m10_satchel.js` | 7904 to 8103 | `satchel` | 10 Compliance Satchel |
| 11 | `23_m11_regions.js` | 8105 to 8235 | `regions` | 11 Louisiana Regions |
| 12 | `24_m12_lines.js` | 8238 to 8458 | `lines` | 12 Service Lines |
| 13 | `25_m13_watch.js` | 8461 to 8579 | `watch` | 13 Competitor Watch |
| 14 | `26_m14_weather.js` | 8581 to 8730 | `weather` | 14 Storm Desk |
| 15 | `27_m15_accounts.js` | 8732 to 8921 | `accounts` | 15 Accounts |
| 16 | `30_m16_publish.js` | 8923 to 9378 | `publish` | 16 Publish |
| 17 | `31_m17_stock.js` | 9380 to 9640 | `stock` | 17 Roof Stock and Materials |
| shell | `99_shell.js` | 9643 to 9659 | (boot) | builds the rail and opens a module |

Helper sections outside my range that these modules call, and that I read to write this contract: `00_core.js` (563 to 764), `04_content.js` (1135 to 1362: the law register `LAWX`, the eleven service lines `PL`), `05_satchel_rules.js` (1365 to 1439: the rule pack `SAT`), `09_sl_model.js` (2117 to 2191: `SLM`), `10_watch_core.js` (2194 to 2359: `WATCH`), `11_nws_core.js` (2362 to 2459: `NWSX`), `12_accounts_core.js` (2462 to 2787: `ACCT`), the layer catalog at 4991 to 5062 (`LAYERS`, `ageHist`, `ageChart`) and the storm helpers at 5263 to 5330 (`stormFoot`, `dmgShare`, `footStats`, `stormName`).

## How far each statement can be trusted

Three kinds of statement appear below, and they are marked where it matters.

- **Stated**: the dashboard's own code or its method, caveat and source text says it. Quoted with a line number.
- **Verified**: I recomputed it from `la_atlas_data.json` and it matched. The check is described so it can be rerun.
- **Inferred**: the build pipeline that produced the data is not in the HTML. Where a rule had to be recovered from the shipped numbers (the storm resets of the roof age model, several line pools), I say so and give the fit. Treat an inferred rule as a strong hypothesis, not as the original code.

## 1. Every ZIP column, and which of these modules read it

`zrows` is 534 rows by 165 columns. `00_core.js` turns each row into an object `z` (line 579) and adds four derived fields the modules also use: `z.fips` and `z.cty` (the parish FIPS and name, from `pi`), `z.occ = z.hh`, and `z.city` falling back to the parish name (line 580); `09_sl_model.js` adds `z.sl_top`, the line with the largest gross profit pool at the current assumptions (line 2180); module 01 adds `z.fees_pc` (line 5048). `ZR` is the 441 scored ZIPs (`res_ok` and a non null `idx`, line 581); a module that iterates `ZR` is marked as reading `res_ok` and `idx`.

An `x` means the module's own code, or a helper it calls, reads that column from a ZIP row. Module 10 (Satchel) and module 16 (Publish) read no ZIP column at all. Columns with no `x` belong to modules 01 to 08. City and parish objects carry fields with the same names (`roofs`, `ra20`, `fees`, `p_replace` and so on); a read of `c.fees` on a city or `p.roofs` on a parish is not marked here and is listed in the module's own data contract.

| # | column | example | meaning | 09 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 0 | `zip` | "70001" | ZCTA code (string key of every per ZIP block) | x |  | x | x |  | x | x |  | x |
| 1 | `city` | "Metairie" | post office city name of the ZIP (falls back to the parish name, line 580) | x |  |  | x |  |  | x |  | x |
| 2 | `pi` | 25 | index of the parish (row of `parishes`) holding most of the ZIP's residents | x |  | x | x |  | x | x |  | x |
| 3 | `reg` | 1 | region number 1 to 9 (LDH region; parish `reg` is what the modules read) |  |  |  |  |  |  |  |  |  |
| 4 | `lat` | 29.9845 | ZIP centre latitude | x |  |  |  |  |  |  |  |  |
| 5 | `lon` | -90.1695 | ZIP centre longitude | x |  |  |  |  |  |  |  |  |
| 6 | `sqmi` | 6.5 | land area, square miles |  |  |  |  |  |  |  |  |  |
| 7 | `wsqmi` | 0.0 | water area, square miles |  |  |  |  |  |  |  |  |  |
| 8 | `pop` | 38950 | residents (ACS 2020 to 2024) | x |  | x | x |  |  |  |  |  |
| 9 | `hh` | 17808 | households = occupied homes (line 580 copies it into `z.occ`) |  |  |  |  |  |  |  |  | x |
| 10 | `inc` | 67923 | median household income, $ (ACS B19013) |  |  |  |  |  |  |  |  | x |
| 11 | `value` | 339400 | median home value, $ (ACS B25077) |  |  |  | x |  |  |  |  | x |
| 12 | `own_sh` | 51.4 | owner occupied share of occupied homes, % (ACS B25003) |  |  |  | x |  |  |  |  | x |
| 13 | `sfd_sh` | 52.1 | single family detached share of homes, % |  |  |  |  |  |  |  |  |  |
| 14 | `mf5_sh` | 30.6 | share of homes in 5+ unit buildings, % |  |  |  |  |  |  |  |  |  |
| 15 | `span_sh` | 11.7 | residents 5+ who speak Spanish at home, % (ACS C16001) | x |  |  | x |  |  |  |  |  |
| 16 | `span_lep_sh` | 4.7 | Spanish speakers with limited English, % |  |  |  |  |  |  |  |  |  |
| 17 | `viet_sh` | 0.4 | Vietnamese at home, % |  |  |  |  |  |  |  |  |  |
| 18 | `french_sh` | 0.7 | French or Cajun at home, % |  |  |  |  |  |  |  |  |  |
| 19 | `hh100k_sh` | 33.0 | households earning $100,000 or more, % (ACS B19001) |  |  |  | x |  |  |  |  |  |
| 20 | `s65_sh` | 18.6 | residents 65 and over, % |  |  |  |  |  |  |  |  |  |
| 21 | `density` | 6011 | residents per square mile |  |  |  |  |  |  |  |  |  |
| 22 | `gid` | 9025099 | geometry id (map shape key; not read in my range) |  |  |  |  |  |  |  |  |  |
| 23 | `hu` | 19447.0 | housing units (ACS B25001) | x |  |  |  |  |  |  |  | x |
| 24 | `occ` | 17808.0 | occupied housing units (overwritten with `hh` at line 580) |  |  |  |  |  |  |  |  |  |
| 25 | `vac_sh` | 8.4 | vacant share, % |  |  |  |  |  |  |  |  |  |
| 26 | `seas` | 62.0 | seasonal and recreational homes ("camps", ACS B25004) |  |  |  |  |  |  |  |  |  |
| 27 | `u1` | 11492.0 | homes in one unit structures, detached plus attached (ACS B25024) |  |  |  |  |  |  |  |  | x |
| 28 | `mh` | 247.0 | mobile homes (ACS B25024) | x |  |  | x |  |  |  |  | x |
| 29 | `mf24` | 1743.0 | homes in 2 to 4 unit buildings |  |  |  |  |  |  |  |  | x |
| 30 | `mf5u` | 5942.0 | homes in buildings of 5 or more units |  |  |  | x |  |  |  |  | x |
| 31 | `mh_sh` | 1.3 | mobile homes as % of housing units |  |  |  | x |  |  |  |  | x |
| 32 | `yb_med` | 1975.0 | median year built (ACS B25035) |  |  |  | x |  |  |  |  | x |
| 33 | `rooms` | 5.2 | median rooms |  |  |  |  |  |  |  |  |  |
| 34 | `mort_sh` | 59.6 | owners with a mortgage, % (ACS B25081) |  |  | x | x |  |  |  |  | x |
| 35 | `pre80_sh` | 60.9 | homes built before 1980, % (ACS B25034) |  |  |  | x |  |  |  |  | x |
| 36 | `yb20` | 122.0 | homes built 2020 or later (ACS B25034) |  |  |  | x |  |  |  |  | x |
| 37 | `yb10` | 851.0 | homes built 2010 to 2019 |  |  |  | x |  |  |  |  | x |
| 38 | `yb00` | 2156.0 | homes built 2000 to 2009 |  |  |  |  |  |  |  |  | x |
| 39 | `yb90` | 1674.0 | homes built 1990 to 1999 |  |  |  |  |  |  |  |  | x |
| 40 | `yb80` | 2804.0 | homes built 1980 to 1989 |  |  |  |  |  |  |  |  | x |
| 41 | `yb70` | 4338.0 | homes built 1970 to 1979 |  |  |  |  |  |  |  |  | x |
| 42 | `yb60` | 3463.0 | homes built 1960 to 1969 |  |  |  |  |  |  |  |  | x |
| 43 | `yb50` | 2664.0 | homes built 1950 to 1959 |  |  |  |  |  |  |  |  | x |
| 44 | `yb40` | 1008.0 | homes built 1940 to 1949 |  |  |  |  |  |  |  |  | x |
| 45 | `ybold` | 367.0 | homes built 1939 or earlier |  |  |  |  |  |  |  |  | x |
| 46 | `roofs` | 11607 | one unit roofs in the cohort model (= sum of `agez[zip]`) | x |  |  | x |  |  |  |  | x |
| 47 | `ra_med` | 9 | median roof age, years (model) |  |  |  | x |  |  |  |  | x |
| 48 | `ra15` | 4166 | roofs 15 years or older (model) = sum agez[15..40] |  |  |  |  |  |  |  |  | x |
| 49 | `ra20` | 2810 | roofs 20 years or older (model) = sum agez[20..40] | x |  |  |  |  |  |  |  | x |
| 50 | `ra15_sh` | 35.9 | 100 × ra15 / roofs |  |  |  |  |  |  |  |  | x |
| 51 | `ra20_sh` | 24.2 | 100 × ra20 / roofs |  |  |  | x |  |  |  |  | x |
| 52 | `wave` | 1356 | roofs aged 15 to 19 (model) = sum agez[15..19] | x |  |  | x |  |  |  |  | x |
| 53 | `nxt` | 485.9 | age driven replacements in the next 12 months, one to four unit (model) | x |  |  |  |  |  |  |  | x |
| 54 | `last64` | 2021 | last year with modeled hurricane force (64 kt) sustained wind at the ZIP, 1950 on; null if none |  |  |  |  |  |  |  |  | x |
| 55 | `yrs64` | 5 | 2026 − last64 |  |  |  | x |  |  |  |  | x |
| 56 | `hd1` | 1.6 | days a year with hail ≥ 1 inch reported within 25 miles (SPC 1996 to 2025) | x |  | x | x |  |  |  |  |  |
| 57 | `hd175` | 0.6 | days a year with hail ≥ 1.75 inch within 25 miles |  |  | x | x |  |  |  |  |  |
| 58 | `hd2` | 0.1 | days a year with hail ≥ 2 inch within 25 miles |  |  |  |  |  |  |  |  |  |
| 59 | `hd1_10` | 1.4 | hd1 over the recent decade 2016 to 2025 |  |  |  | x |  |  |  |  |  |
| 60 | `wd50` | 5.133 | days a year with thunderstorm wind ≥ 50 kt (58 mph) within 25 miles |  |  |  | x |  |  |  |  |  |
| 61 | `wd65` | 0.333 | days a year with thunderstorm wind ≥ 65 kt (75 mph) within 25 miles |  |  |  |  |  |  |  |  |  |
| 62 | `td1` | 0.833 | days a year with an EF1+ tornado within 25 miles |  |  |  | x |  |  |  |  |  |
| 63 | `hur64` | 7.89 | % of years 1950 to 2025 with modeled sustained wind ≥ 64 kt at the ZIP |  |  | x | x |  |  |  |  |  |
| 64 | `hur50` | 17.11 | % of years with ≥ 50 kt |  |  |  |  |  |  |  |  |  |
| 65 | `ts34` | 60.53 | % of years with ≥ 34 kt |  |  |  |  |  |  |  |  |  |
| 66 | `n64_00` | 4 | count of storms 2000 to 2026 with ≥ 64 kt at the ZIP |  |  |  | x |  |  |  |  |  |
| 67 | `n50_00` | 7 | count of storms 2000 to 2026 with ≥ 50 kt |  |  |  |  |  |  |  |  |  |
| 68 | `vmax_00` | 95.0 | peak modeled sustained wind since 2000, kt |  |  |  |  |  |  |  |  |  |
| 69 | `vmax_20` | 81.0 | peak modeled sustained wind since 2020, kt |  |  |  |  |  |  |  |  |  |
| 70 | `ev_h1` | 0 | NOAA Storm Events hail reports ≥ 1 inch placed in the ZIP, 2016 to 2026 | x |  |  | x |  |  |  |  |  |
| 71 | `ev_h175` | 0 | hail reports ≥ 1.75 inch in the ZIP | x |  |  | x |  |  |  |  |  |
| 72 | `ev_w58` | 3 | thunderstorm wind reports ≥ 58 mph in the ZIP | x |  |  |  |  |  |  |  |  |
| 73 | `ev_w75` | 0 | wind reports ≥ 75 mph in the ZIP |  |  |  |  |  |  |  |  |  |
| 74 | `ev_t` | 0 | tornado touchdowns in the ZIP | x |  |  |  |  |  |  |  |  |
| 75 | `ev_dmg` | 1.0 | reported property damage in the ZIP (units not stated in my range) |  |  |  |  |  |  |  |  |  |
| 76 | `fema_k` | 4000 | FEMA IHP registrations with roof damage or verified wind loss, 2004 to 2026 | x |  |  | x |  |  |  |  |  |
| 77 | `fema_20` | 605 | the same, 2020 on |  |  |  |  |  |  |  |  |  |
| 78 | `fema_ida` | 592 | FEMA verified wind loss, Hurricane Ida (DR 4611) |  |  |  |  |  |  |  |  |  |
| 79 | `fema_laura` | 0 | FEMA verified wind loss, Hurricane Laura (DR 4559) |  |  |  |  |  |  |  |  |  |
| 80 | `fema_rate` | 22.5 | fema_k per 100 occupied homes |  |  |  | x |  |  |  |  |  |
| 81 | `est` | 1234 | business establishments, all types (ZIP Code Business Patterns 2023) |  |  |  |  |  |  |  |  | x |
| 82 | `retail` | 98 | retail establishments (NAICS 44 to 45) |  |  |  | x |  |  |  |  | x |
| 83 | `food` | 84 | restaurants and bars |  |  |  |  |  |  |  |  | x |
| 84 | `lodging` | 13 | hotels and lodging |  |  |  |  |  |  |  |  | x |
| 85 | `whse` | 8 | warehousing establishments (NAICS 493) |  |  |  | x |  |  |  |  | x |
| 86 | `mfg` | 20 | manufacturing establishments (NAICS 31 to 33) |  |  |  | x |  |  |  |  | x |
| 87 | `church` | 13 | religious organizations (NAICS 8131) |  |  |  | x |  |  |  |  | x |
| 88 | `health` | 144 | health care offices and facilities |  |  |  |  |  |  |  |  | x |
| 89 | `school` | 13 | schools and training |  |  |  |  |  |  |  |  | x |
| 90 | `apts` | 9 | apartment lessors (NAICS 531110) |  |  |  | x |  |  |  |  | x |
| 91 | `nonres` | 7 | lessors of nonresidential buildings |  |  |  |  |  |  |  |  | x |
| 92 | `office` | 289 | offices (finance, professional, management) |  |  |  |  |  |  |  |  | x |
| 93 | `auto` | 9 | auto dealers |  |  |  |  |  |  |  |  | x |
| 94 | `roofers` | 5 | roofing contractor establishments (NAICS 238160) |  |  |  |  |  |  |  |  |  |
| 95 | `builders` | 30 | residential builders (ZBP) |  |  |  | x |  |  |  |  |  |
| 96 | `supply` | 0 | roofing supply houses (ZBP) |  |  |  | x |  |  |  |  |  |
| 97 | `ins_agents` | 37 | insurance agencies (ZBP) |  |  |  |  |  |  |  |  |  |
| 98 | `adjusters` | 0 | claims adjusters (ZBP) |  |  |  |  |  |  |  |  |  |
| 99 | `cru` | 883.4 | commercial roofs, estimate (sums to 80,000 statewide) | x |  |  | x |  |  |  |  | x |
| 100 | `lic` | 9.4 | LSLBC roofing licence records in the ZIP's city, split across its ZIPs |  |  |  |  |  |  |  |  |  |
| 101 | `p_replace` | 381.84 | roof replacement line: jobs a year at the ZIP (pool) |  |  | x | x | x |  | x |  |  |
| 102 | `p_repair` | 350.72 | repair and leaks line: jobs a year at the ZIP (pool) |  |  | x | x | x |  | x |  |  |
| 103 | `p_storm` | 958.24 | storm and wind line: jobs a year at the ZIP (pool) |  |  | x | x | x | x | x |  |  |
| 104 | `p_hail` | 69.78 | hail line: jobs a year at the ZIP (pool) |  |  | x | x | x | x | x |  |  |
| 105 | `p_fortified` | 101.56 | FORTIFIED line: jobs a year at the ZIP (pool) |  |  | x | x | x |  | x |  |  |
| 106 | `p_metal` | 71.48 | metal line: jobs a year at the ZIP (pool) |  |  | x | x | x |  | x |  |  |
| 107 | `p_mh` | 34.75 | manufactured home line: jobs a year at the ZIP (pool) |  |  | x | x | x |  | x |  |  |
| 108 | `p_mf` | 34.82 | multifamily line: jobs a year at the ZIP (pool) |  |  | x | x | x |  | x |  |  |
| 109 | `p_comm` | 86.05 | commercial line: jobs a year at the ZIP (pool) |  |  | x | x | x |  | x |  |  |
| 110 | `p_coat` | 26.5 | coatings line: jobs a year at the ZIP (pool) |  |  | x | x | x |  | x |  |  |
| 111 | `p_newc` | 42.83 | new construction line: jobs a year at the ZIP (pool) |  |  | x | x | x |  | x |  |  |
| 112 | `r_replace` | 97.02 | roof replacement line: jobs per 10,000 residents a year, shrunk toward the parish rate |  |  |  | x |  |  |  |  |  |
| 113 | `r_repair` | 90.29 | repair and leaks line: jobs per 10,000 residents a year, shrunk toward the parish rate |  |  |  | x |  |  |  |  |  |
| 114 | `r_storm` | 247.43 | storm and wind line: jobs per 10,000 residents a year, shrunk toward the parish rate |  |  |  | x |  |  |  |  |  |
| 115 | `r_hail` | 17.97 | hail line: jobs per 10,000 residents a year, shrunk toward the parish rate |  |  |  | x |  |  |  |  |  |
| 116 | `r_fortified` | 26.24 | FORTIFIED line: jobs per 10,000 residents a year, shrunk toward the parish rate |  |  |  | x |  |  |  |  |  |
| 117 | `r_metal` | 18.51 | metal line: jobs per 10,000 residents a year, shrunk toward the parish rate |  |  |  | x |  |  |  |  |  |
| 118 | `r_mh` | 9.1 | manufactured home line: jobs per 10,000 residents a year, shrunk toward the parish rate |  |  |  | x |  |  |  |  |  |
| 119 | `r_mf` | 8.71 | multifamily line: jobs per 10,000 residents a year, shrunk toward the parish rate |  |  |  | x |  |  |  |  |  |
| 120 | `r_comm` | 21.98 | commercial line: jobs per 10,000 residents a year, shrunk toward the parish rate |  |  |  | x |  |  |  |  |  |
| 121 | `r_coat` | 6.76 | coatings line: jobs per 10,000 residents a year, shrunk toward the parish rate |  |  |  | x |  |  |  |  |  |
| 122 | `r_newc` | 10.96 | new construction line: jobs per 10,000 residents a year, shrunk toward the parish rate |  |  |  | x |  |  |  |  |  |
| 123 | `z_replace` | 0.449 | roof replacement line: standardized log rate (index component, module 01) |  |  |  |  |  |  |  |  |  |
| 124 | `z_repair` | 0.361 | repair and leaks line: standardized log rate (index component, module 01) |  |  |  |  |  |  |  |  |  |
| 125 | `z_storm` | 0.98 | storm and wind line: standardized log rate (index component, module 01) |  |  |  |  |  |  |  |  |  |
| 126 | `z_hail` | -0.555 | hail line: standardized log rate (index component, module 01) |  |  |  |  |  |  |  |  |  |
| 127 | `z_fortified` | 0.968 | FORTIFIED line: standardized log rate (index component, module 01) |  |  |  |  |  |  |  |  |  |
| 128 | `z_metal` | -1.137 | metal line: standardized log rate (index component, module 01) |  |  |  |  |  |  |  |  |  |
| 129 | `z_mh` | -1.362 | manufactured home line: standardized log rate (index component, module 01) |  |  |  |  |  |  |  |  |  |
| 130 | `z_mf` | 2.139 | multifamily line: standardized log rate (index component, module 01) |  |  |  |  |  |  |  |  |  |
| 131 | `z_comm` | 1.522 | commercial line: standardized log rate (index component, module 01) |  |  |  |  |  |  |  |  |  |
| 132 | `z_coat` | 1.245 | coatings line: standardized log rate (index component, module 01) |  |  |  |  |  |  |  |  |  |
| 133 | `z_newc` | -0.3 | new construction line: standardized log rate (index component, module 01) |  |  |  |  |  |  |  |  |  |
| 134 | `f_replace` | 1640599 | roof replacement line: gross profit pool at defaults, $ (= p × REP × VAL × FEE) |  |  |  |  |  |  |  |  |  |
| 135 | `f_repair` | 60474 | repair and leaks line: gross profit pool at defaults, $ (= p × REP × VAL × FEE) |  |  |  |  |  |  |  |  |  |
| 136 | `f_storm` | 2150285 | storm and wind line: gross profit pool at defaults, $ (= p × REP × VAL × FEE) |  |  |  |  |  |  |  |  |  |
| 137 | `f_hail` | 185954 | hail line: gross profit pool at defaults, $ (= p × REP × VAL × FEE) |  |  |  |  |  |  |  |  |  |
| 138 | `f_fortified` | 604937 | FORTIFIED line: gross profit pool at defaults, $ (= p × REP × VAL × FEE) |  |  |  |  |  |  |  |  |  |
| 139 | `f_metal` | 539683 | metal line: gross profit pool at defaults, $ (= p × REP × VAL × FEE) |  |  |  |  |  |  |  |  |  |
| 140 | `f_mh` | 45414 | manufactured home line: gross profit pool at defaults, $ (= p × REP × VAL × FEE) |  |  |  |  |  |  |  |  |  |
| 141 | `f_mf` | 448109 | multifamily line: gross profit pool at defaults, $ (= p × REP × VAL × FEE) |  |  |  |  |  |  |  |  |  |
| 142 | `f_comm` | 1327547 | commercial line: gross profit pool at defaults, $ (= p × REP × VAL × FEE) |  |  |  |  |  |  |  |  |  |
| 143 | `f_coat` | 174919 | coatings line: gross profit pool at defaults, $ (= p × REP × VAL × FEE) |  |  |  |  |  |  |  |  |  |
| 144 | `f_newc` | 38864 | new construction line: gross profit pool at defaults, $ (= p × REP × VAL × FEE) |  |  |  |  |  |  |  |  |  |
| 145 | `idx` | 88.6 | Roof Demand Index, percentile (module 01); null when the ZIP is not scored |  |  | x | x | x | x |  |  | x |
| 146 | `idx_eq` | 84.1 | the index with equal weights |  |  |  |  |  |  |  |  |  |
| 147 | `fees` | 7216785 | gross profit pool a year, all lines, at the default assumptions, $ (= Σ f_*) |  |  | x |  |  |  |  |  |  |
| 148 | `cases` | 1617.87 | jobs a year open to marketing, all lines (= Σ p_* × REP) |  |  |  |  |  |  |  |  |  |
| 149 | `gi` | 3.96 | Getis Ord Gi* z score of the index |  |  |  |  |  |  |  |  |  |
| 150 | `gicls` | "H99" | hot or cold spot class (H99, H95, H90, C99, C95, C90, ns) |  |  |  |  |  |  |  |  |  |
| 151 | `comp_mass` | 13.34 | distance weighted presence of mapped competitors |  |  |  |  |  |  |  |  |  |
| 152 | `comp_n25` | 8 | mapped competitor offices within 25 km |  |  |  | x |  |  |  |  |  |
| 153 | `roof_mass` | 79.67 | distance weighted roofing establishments and licence records |  |  |  |  |  |  |  |  |  |
| 154 | `roof_per10k` | 3.7 | roofing establishments and licences per 10,000 residents nearby |  |  |  |  |  |  |  |  |  |
| 155 | `comp_pct` | 96.6 | competitive pressure, percentile |  |  |  | x |  |  |  |  |  |
| 156 | `cpc_rel` | 1.186 | relative cost per click (region factor × competition), 1.0 = state base |  |  | x | x |  |  |  |  |  |
| 157 | `eff` | 6084979 | fees ÷ cpc_rel at defaults (module 05) |  |  |  |  |  |  |  |  |  |
| 158 | `effb` | 94.8 | efficiency percentile (module 05) |  |  | x |  |  |  |  |  |  |
| 159 | `oppb` | 97.7 | opportunity percentile (module 05) |  |  |  |  |  |  |  |  |  |
| 160 | `quad` | 0 | quadrant 0 anchor, 1 whitespace, 2 niche, 3 avoid (module 05) |  |  |  |  |  |  |  |  |  |
| 161 | `tier` | "A" | paid tier at defaults, A+ to E (module 05) |  |  |  |  |  |  |  |  |  |
| 162 | `bid` | 20 | bid modifier % for that tier |  |  |  |  |  |  |  |  |  |
| 163 | `res_ok` | 1 | 1 when the ZIP has 500 or more residents (scored); 0 otherwise |  |  | x | x | x | x |  |  | x |
| 164 | `metal_sh` | 6.8 | metal share of residential reroofs, % (assumption) |  |  |  | x |  |  |  |  | x |

## 2. The other data blocks these modules read

Everything is a key of `window.__ATLAS_DATA__` (aliased `DATA`, line 568) unless it says `META` (`DATA.meta`, line 569) or the weather snapshot. Field level detail is in each module's data contract.

| Block | Shape (Louisiana) | Read by (my modules) | What it is |
|---|---|---|---|
| `zrows`, `zcols` | 534 × 165 | 09, 11, 12, 13, 14, 15, 17 | the ZIP table above |
| `parishes` (`PA`, `PAI` by FIPS) | 64 objects | 09, 11, 12, 14, 17 | county equivalents, with ACS sums, model sums, `hist`, `bps`, `ev`, `fema`, `p_*` |
| `cities` (`CITIES`) | 265 objects | 09, 11, 12 | post office cities as sets of ZIPs, with sums (`fees`, `roofs`, `ra20`, `p_*`, `comp`, `roofers`, `lic`, `span`, `viet`) |
| `comp` (`COMP`) | 29 objects | 11, 12, 13, shell | the mapped competitor roster |
| `routes` (`RT`, `RTI` by label) | 38 objects | 09, 11 | named storms 2002 to 2026 with a wind footprint in the state |
| `sids` (`SIDS`) | 119 arrays `[name, year, state category, peak state wind kt]` | 09, 11 | every storm 1950 to 2026; the index into `zstorm` |
| `zstorm` | per ZIP list of `[sids index, peak sustained wind kt]` | 09, 11 | each storm's modeled wind at the ZIP (only winds of 34 kt or more are stored; only storms from Andrew 1992 on appear) |
| `agez` | per ZIP array of 41 counts | 17 | one unit roofs by age 0 to 39 and 40+, as of 2026 (the cohort model's output) |
| `rhist` | per ZIP array of 27 `[age driven, storm driven]` | none of mine (module 02, line 5584) | replacements a year 2000 to 2026 from the cohort model |
| `pts` (`PTS`), `ptflags` | 5,115 reports, 11 flag bits | 09 | NOAA Storm Events hail, wind and tornado reports 2016 to 2026 |
| `ts.month`, `ts.hour` | 12 and 24 counts for hail, wind, torn | 12, 14 (and `SLM`) | storm reports by month and by hour |
| `ts.trop_month` | 12 counts | 14 (and `SLM`) | tropical cyclones reaching the state by month, 1950 to 2025 |
| `ts.fema_year` | 18 rows | 09 | FEMA disasters `[DR, name, year, registrations, roof flag era, owners, insured]` |
| `ts.ppi` | `asph`, `steel`: `[YYYY-MM, index]` | 09, 17 | BLS producer price indexes WPU1361 and WPU1017 |
| `ts.permits`, `ts.ytd26`, `ts.ytd25` | 2005 to 2025 `[one unit units, all units, buildings]` | 09, 17 | Census Building Permits Survey, state |
| `ts.agehist` | 41 counts | 17 | statewide sum of `agez` |
| `ts.replace_hist` | 2000 to 2026 `[age, storm]` | none of mine (module 02, line 5341) | statewide sum of `rhist` |
| `geo.pcent` | per parish `[lon, lat]` | 11 | parish centre points (used to place competitor offices in a region) |
| `META` scalars | see each module | 09, 11, 12, 17, shell | state totals and the model constants in `META.model`, `META.ahs`, `META.fort`, `META.lic` |
| `window.__NWS_SNAPSHOT__` | 8 keys | 14 (through `NWSX`) | the embedded weather read of October 6, 2026 |

Blocks present in the data that none of these modules read: `places`, `geo` (other than `pcent`), `seg`, `rlist`, `hosp`, `ts.year`, `ts.dowhour`, `META.model.corr`, `sens`, `val`, `valpts`, `W`, `TIER`, `GRADE`, `P2R`.

## 3. Things that cut across modules and must be fixed, not copied

These are in or under my range and will break or mislead a California edition if carried over unchanged.

1. **Louisiana only ZIP pattern in the report importer.** `ACCT.importCSV` (line 2764) finds a postal code with `/\b(7[01]\d{3})\b/`. Only ZIPs beginning 70 or 71 are recognized, so every California ZIP (90001 to 96162) in an imported report would be dropped and the "Where the money landed" table of module 15 would stay empty for imports. Replace with `9[0-6]\d{3}`.
2. **Campaign token prefix.** `ACCT.lineOf` (line 2600) maps a campaign to a line from the token `LA_<TOK>_` (`/LA_([A-Z]+)_/`), the import template names `LA_REPLACE_META_EN_20261012` with ZIP `70808` (line 2768), and the Storm Desk CSV names campaigns `LA_STORM_GOOGLE_<REGION>` (line 2453). The Campaign Desk (module 08) writes the same prefix. Pick `CA_` everywhere at once.
3. **A storage key that never matches.** Module 15's pacing card reads the Campaign Desk budget from `store.get('cf.desk.v1', {})` (line 8846), but the Desk saves under `up.desk.v1` (line 6649; the Forge reads that key at line 7627). The card therefore always falls back to the service line model budget (`SLM.A.budget`, default 15,000). Other `cf.` keys are live and consistent: `cf.accounts.v1` (2476), `cf.cms.v1` (2893), `cf.publish.loaded` (9112, 9133), `cf.publish.composer` (9177). The `cf.` prefix is a leftover of an earlier product.
4. **Leftover wording from another edition.** Module 15 prints "outside the twelve counties" for a ZIP that is not in the atlas (line 8875), and `ACCT.byLine` files a lead with no line under the key `'car'` (line 2773). Neither belongs to roofing or to Louisiana.
5. **A dayparting template read that does nothing.** Module 15's hour chart builds its template series from `SLM.DAYPARTS.emergency[0]` (line 8863). `DAYPARTS.emergency` is a flat array of six numbers (line 2124), so `[0]` is the number 10, indexing it gives `undefined`, and the "Template share" series is a flat 4.17 percent every hour. `ACCT.observedGrid()` (line 2775) returns seven rows of six, which is the shape that code expected. Module 14 reads the same template correctly (line 8669).
6. **Time zone.** Hurricane and weather text is formatted in `America/Chicago` and labeled "Central" (module 14, lines 8636 and 8702; helpers at 5311 and 5329). California needs `America/Los_Angeles` and "Pacific".
7. **State abbreviation in generated schema.** The Forge writes `addressRegion: 'LA'`, `name + ', LA'` and `' Parish, LA'` into JSON-LD (lines 7288, 7293, 7341). In a California edition "LA" would read as Los Angeles; every one of these must become `CA` and "County".
8. **Counts printed as literals.** "64 parishes" is typed, not computed, at lines 8150, 8271, 9418 and 9655; "nine regions" at 8110, 8150, 8178, 8270, 9417 and in module 14 ("nine forecast points", "nine points": 8590, 8591, 8646). California has 58 counties and whatever region scheme is chosen.
9. **The compile year is typed in places.** `const yNow = 2026` (line 9520), "January to August 2026" (9542), "(model, 2026)" (9427), `x: { max: 2026.7 }` on the price chart (9573), "since 2002" in the regions module (8122, 8173, 8183), "2004 to" and "2016 to" in labels (8142, 8195, 8196), holidays for 2026 and 2027 in `NWSX.HOL` (line 2381).

---

# Module 09 · Site Forge (`21_m09_forge.js`, lines 6901 to 7902)

## 09.1 What it is for and what it shows

The Forge writes the website the campaigns land on. It plans a set of pages from the atlas (markets, parishes, named storms, service lines), writes each page as a "FORGE blueprint" (one JSON document) from the copy library `FCOPY` (lines 1737 to 2112, outside my range) and the atlas numbers, lints it with the Satchel rule pack, compiles it in the browser to an Elementor template, semantic HTML and JSON-LD (`FORGE_COMPILE`, line 1444), and can deploy it to WordPress as drafts. The engine is the `FORGE` object (6909 to 7512); the screen is the `mount` function (7516 to 7900).

User visible structure, in order (line of the markup):

| # | Element | What it shows or does |
|---|---|---|
| mast | Masthead (7541 to 7543) | Eyebrow "Module 09 · Site Forge", title, a long dek, four facts (cities with roof and storm facts = `CITIES.length`; parishes and named storms = `PA.length`, `RT.length`; guide topics and service lines = `FCOPY.GUIDES.length`, `PL.length`; "Internal links only to live URLs"). Action bar: ↓ Pack, ↓ Elementor, ↓ Blueprints, ↓ Bridge plugin, ↓ Ledger, ⤓ Save, ⤒ Load. |
| callout | "Read this first: what the forge does and does not do" (7545) | Scope and limits: never publishes on its own, never writes a review, never says what insurance covers, never links to a page not on the live sitemap, "never uses Ahrefs". |
| warn | `#f9FirmWarn` (7546, 7622 to 7623) | Appears while the company name, licence number or office city is empty: pages preview with "Your company", "[license number]", "Your city" and every page blocks. |
| 1 | "1 · The company" (7548 to 7559) | 30 fields from `SITE_F` (7525 to 7537: company name, URLs, phone, email, licence number and classifications, qualifying party, office street, city, ZIP and other offices, hours, warranty, financing, certifications, FORTIFIED status, profiles, logo, fonts, button label and URL, form shortcode, video URL, Spanish threshold), three selects (schema entity type, lead form provider, page template), three colour pickers, trust strip, "who the company is", customer statements, four checkboxes (sticky mobile bar, noindex landing pages, guides as posts, Elementor globals). Buttons: "Use the Company panel", "Import markets from the Campaign Desk", checkbox "Follow the Company panel". |
| 2 | "2 · Where to focus" (7561 to 7571) | Scope select (within a drive of the office, selected parishes, all of Louisiana, hand picked cities), miles, parish multi select, "Rank by" (the 14 `METRICS`), city count and minimum residents, hand picked cities. A ZIP map (`ZipMap`) shaded by the ranking metric of the city each ZIP belongs to, with the office as a diamond, and a table of the cities in the plan: City, Parish, Miles, the metric, Roofs 20+ (model), Hail reports, FEMA roof registrations, Residents (ZIPs), Spanish at home. Click a row to drop a city; click a ZIP to add or drop its city. |
| 3 | "3 · What to build" (7573 to 7581) | Nine page type checkboxes (home, about and licence, service page per line, parish hub, city page, storm page per named storm, landing page per line and city, Spanish landing variants, guides); chip rows for service page lines, landing page lines, storms (each chip "label · N roofs" from the modeled damage in the plan's cities) and guide topics; a "Doorway risk" callout; the "Build all pages" button. |
| kpis | `#f9Kpis` (7683 to 7693) | Pages planned (by type); Cities in the plan; Roofs 20 years or older in their ZIPs (grade B, share of `META.ra20`, plus the wave); Gross profit pool a year (grade D, share of `META.fees_tot`); Built (words); Blocking checks (warnings, notes); Internal links. |
| 4 | "4 · Live pages on the site" (7584 to 7586) | A text area for the XML sitemap or a URL list; a summary line. These are the only internal link targets. |
| 5 | "5 · The page ledger" (7588 to 7590, 7694 to 7704) | Filters (type, search, show removed) and a table: #, Type, Page, Slug, Title length, Meta length, Words, Blocks, Warn, Links, Deploy. Click opens the page in the studio. |
| 6 | "6 · Page studio" (7592 to 7597) | Title, H1, slug and meta editors with counters (60, 70, 120 to 158); Apply and rebuild, Discard edits, Remove from plan; downloads (blueprint, Elementor template, preview HTML, bridge bundle); six tabs (Preview, Mobile, Blueprint, Elementor JSON, Schema, HTML); three side lists: Checks, "Facts on this page · value, source, grade", "Internal links · live URLs only". |
| 7 | "7 · Media" (7599 to 7601) | Drop zone; images resized to 1920 px and converted to WebP in the browser (7749); a table to assign each asset to the site default, the author headshot, a page type, a parish, a city or the open page. |
| 8 | "8 · Deploy to WordPress" (7603 to 7611) | URL, user, application password; Test connection; options (upload assets, publish instead of draft, skip already deployed); Deploy pages, Refresh live URLs, Verify links, IndexNow; a log and a results table. |
| 9 | "9 · Method, sources, grades and the hand off" (7613, 7832 to 7871) | Five method paragraphs, the fact table (value, fact as printed, source printed on the page, grade), fourteen judgment calls, the hand off commands for the FORGE skill, nine source rows. |
| foot | (7614) | "Site Forge writes pages; it does not publish them, and nothing here is legal or insurance advice..." |

Exports (7806 to 7829): `site-forge-pack_<brand>_<date>.zip` (plan.json, README.md, forge-bridge.php, ledger.csv and per page blueprint, bundle, Elementor template, HTML, preview, schema, media map, plus assets); `site-forge-elementor-templates.zip`; `site-forge-blueprints.zip`; `forge-bridge.zip`; `site-forge-ledger.csv` (columns `type,label,slug,title,title_len,h1,meta,meta_len,words,blocks,warnings,internal_links,deploy_status,link`); `site-forge-plan_<brand>.json`.

State is stored in `localStorage` under `up.forge.v1` (7519, 7524). Hooks other modules call: `receive({zips|cities, line, storm})` (7874), `feed()` for the Satchel (7880), `publishPages()`, `publishAssets()`, `publishSite()` for module 16 (7883 to 7892).

## 09.2 Data contract

### Statewide constants computed once (`ST`, 6956 to 6968)

| Name | Formula | Source field |
|---|---|---|
| `h1`, `h175` | count of `PTS` whose flag bits include `h1` (hail 1 inch or larger) and `h175` (1.75 inch or larger) | `pts[8]` (flag bits), `ptflags` |
| `bym`, `peak` | `h1` reports by month; index of the busiest month | `pts[3]` (month) |
| `s0`, `s1`, `sSh` | the three consecutive months holding the most `h1` reports (wrapping the year), and their share of all `h1` reports in percent | same |
| `steel`, `ppiYM` | year over year percent change of the last `ts.ppi.steel` point against the same month a year earlier; its month | `ts.ppi.steel` |
| `permYear`, `permUnits` | latest year key of `ts.permits`; element `[1]` of that year (all housing units authorized) | `ts.permits` |
| `fema` | Σ `z.fema_k` over all 534 ZIPs | ZIP `fema_k` |
| `fy0`, `fy1` | min and max of element `[2]` (year) of `ts.fema_year` (fallback 2004 and the compile year) | `ts.fema_year` |
| `py0`, `py1` | min and max report year in `PTS` (fallback 2016 and the compile year) | `pts[2]` |
| `storms`, `ry0`, `ry1` | number of `routes` with `n34 > 0`; first and last route year | `routes[].n34`, `.year` |
| `CUR` | year of `META.compiled` (6952) | `META.compiled` |
| `SPC0`, `SPC1` | 1996 and 2025, typed (6953): "the SPC report years behind the hail days a year columns (hd1, hd175)" | literal |

### Per place facts (`placeFx`, 7003 to 7009)

For a set of ZIPs (a city's `zips`, or every ZIP whose `pi` is the parish): `roofs`, `ra20`, `wave`, `nxt`, `h1` (= Σ `ev_h1`), `h175` (Σ `ev_h175`), `w58` (Σ `ev_w58`), `torn` (Σ `ev_t`), `fema` (Σ `fema_k`), `mh`, `cru` are plain sums; `ra20_sh = 100 × ra20 / roofs`; `hd1` and `span_sh` are resident weighted means (weight `z.pop`); `storms` is the list from `stormsAt`; `s64` and `s50` are the storms with 64 kt or more and 50 kt or more.

`stormsAt(zs)` (6974 to 6978): for each ZIP, read `zstorm[zip]` = `[sids index, kt]`, keep the highest wind per storm across the ZIPs, look up `SIDS[index] = [name, year, ...]`, take the month from the matching route (6 when there is none), drop storms before the first route year, sort newest first.

### Markets (`markets`, 7026 to 7036) and the ranking metrics (`METRICS`, 7019 to 7025)

A city qualifies by scope: `pick` (named cities), `radius` (`distMi` to the office ≤ miles), `parish` (the city's parish FIPS is selected) or `all`, and by `pop ≥ minPop`. Cities are sorted by the chosen metric, cut to `n`, and the office city is appended if it passed the filters. Defaults (7071): scope `radius` when the company has an office city, otherwise `all`; 45 miles; metric `fees`; 8 cities; 10,000 residents. Office coordinates come from the office city's `lat` and `lon`, else the office ZIP, else the saved coordinates, else a typed fallback of 30.4515, −91.1871 (line 7015: Baton Rouge).

| Metric key | Label | Value |
|---|---|---|
| `fees` | Gross profit pool a year, all lines (model) | `city.fees` |
| `ra20`, `wave`, `roofs`, `fema`, `h1` | Roofs 20 years or older (model); Roofs reaching 20 within five years (model); One unit roofs; FEMA roof and wind registrations, fy0 to fy1; Hail reports 1 inch or larger, py0 to py1 | `placeFx` sums over the city's ZIPs |
| `replace`, `storm`, `hail`, `repair`, `metal`, `mh` | "... jobs a year (model)" | `city.p_<line>` |
| `comm` | Commercial, multifamily and coating jobs a year (model) | `city.p_comm + p_coat + p_mf` |
| `pop` | Residents of its ZIP codes | `city.pop` |

City object fields read: `name`, `pi`, `pop`, `zips`, `lat`, `lon`, `fees`, `p_replace`, `p_storm`, `p_hail`, `p_repair`, `p_metal`, `p_mh`, `p_comm`, `p_coat`, `p_mf`. Parish fields read: `fips`, `name`, `i` (row index). Verified: `city.fees`, `pop`, `roofs`, `ra20`, `roofers`, `lic` equal the sums of the city's ZIP rows (New Orleans: 75,799,593; 409,516; 131,149; 23,356; 9; 43.7).

### Storm pages (7037 to 7054)

- `stormLocal(label, markets)` = `footStats` (line 5323) restricted to the plan's ZIPs: for every ZIP in the storm's footprint, count ZIPs at 34, 50 and 64 kt, sum housing units (`z.hu`) at 50 and 64 kt, sum `dmgShare(kt) × z.roofs` into `est`, and keep the peak `kt`.
- `dmgShare(kt)` (line 5307) = `smax / (1 + exp(−(kt − v50) / w))` for `kt ≥ 34`, else 0, with `META.model.DMG` = `smax` 0.5214, `v50` 69.72 kt, `w` 7.263 kt.
- `stormOptions` = the 12 routes with the largest local `est` (at least 1 roof).
- `angleOf(route)` (7043) by age in years (`CUR − year`): `fresh` ≤ 1, `recent` ≤ 6, `wave` 13 to 24, otherwise `past`. Comment at 7042: "recent storms: damage that may still be on the roofs; wave storms: the roofs replaced after them are coming due".
- `chosenStorms` in automatic mode (7044 to 7049): among options with local `est ≥ 50`, the first fresh or recent storm, then the first wave storm, then fill to two.
- `stormCityRows` (7050 to 7054): for each market city (or every city of 10,000 or more), peak `kt` over its ZIPs and Σ `dmgShare(kt) × roofs`; cities under 34 kt are dropped.

Route fields read: `r` (label "Name Year"), `name`, `year`, `month`, `n34`, `vmax`, `life`, `fema`. `stormName` (5301) prefixes "Hurricane", "Tropical Storm" or "Tropical Depression" from `life` or `vmax` (64 and 34 kt).

### Template values (`baseVars`, `parishVars`, `cityVars`, `stormVars`, 7090 to 7144)

| Variable | Formula |
|---|---|
| `s_ra20`, `s_wave`, `s_nxt`, `s_mh`, `s_roofs` | `about(META.ra20)`, `META.wave`, `META.nxt`, `META.mh`, `META.roofs`; `about` rounds for prose (`roundNice`, 6932: to 1,000 above 100,000, to 100 above 10,000, to 10 above 1,000) |
| `s_storms`, `s_fema`, `s_h1`, `s_h175`, `s_hailPeak` | `ST.storms`, `ST.fema`, `ST.h1`, `ST.h175`, month name of `ST.peak` |
| `s_grant` | `M$(META.fort.grant)`, fallback 10000 |
| `s_steelMove`, `s_ppiMonth` | "rose N%" or "fell N%" from `ST.steel`; long month of `ST.ppiYM` |
| `s_permits`, `s_permitYear` | `ST.permUnits`, `ST.permYear` |
| `s_out` | `100 × META.lic.out / META.lic.n` in percent (302 of 950 licence records based out of state) |
| `p_roofs`, `p_ra20`, `p_wave`, `p_fema`, `p_h1` | parish `placeFx` sums; `p_ageWhy`, `p_stormSentence`, `p_hailSentence` are the sentences below; `parishCities` lists up to six plan cities in the parish (or its largest cities) |
| `c_roofs`, `c_ra20`, `c_ra20_sh`, `c_wave`, `c_fema`, `c_h1`, `c_hd1` | city `placeFx` values (`c_hd1` only when ≥ 0.05) |
| `c_lastYear`, `c_lastName` | the most recent storm with 50 kt or more at the city's ZIPs |
| `nearby` | the four nearest plan cities (or cities of 10,000 or more) by `kmLL` |
| `st_name`, `st_year`, `st_month`, `st_when`, `st_age` | from the route |
| `st_mph` | `ktMph(local vmax or route vmax)` (kt × 1.15078, rounded) |
| `st_roofs`, `st_hu64`, `st_hu50` | `about` of the local `est`, `hu64`, `hu50` |
| `st_fema` | `route.fema` (statewide FEMA registrations for that storm) |
| `st_c0`, `st_c1`, `st_area` | the two hardest hit plan cities |

Sentence builders and their thresholds (these are data rules as much as copy):

- `stormSentence` (6979 to 6987): uses the count of storms at 64 kt or more ("hurricane force, 74 mph or more"), else at 50 kt or more ("58 mph or more"), else at 34 kt or more ("tropical storm force"), "Since `ST.ry0`".
- `hailSentence` (6988 to 6991): `ev_h1` and `ev_h175` counts "from py0 to py1", then, when `hd1 ≥ 0.05`, "Within 25 miles, hail that size was reported on about X days a year from 1996 to 2025."
- `ageWhy` (6993 to 6999): only when `ra20_sh < 12` and a storm at 64 kt or more hit within the last 8 years: "Most roofs there are young because [storms] replaced so many of them [in year | from year to year]."
- `femaSentence` (7000): "FEMA recorded N registrations with roof damage or verified wind loss in [place] from fy0 to fy1. FEMA counts only people who applied for federal help, so the count understates the roofs damaged."

### The fact registry (`factItem`, 7147 to 7196)

Every figure a page prints comes from this table, with the source line that is printed beside it on the public page and a grade shown only in the studio. A fact is dropped when its value is null, "0" or "—".

| Key | Value | Label as printed | Source key → printed source | Grade |
|---|---|---|---|---|
| `s_ra20` | About `META.ra20` | one unit roofs in Louisiana are 20 years or older | model | B |
| `s_wave` | About `META.wave` | more Louisiana roofs reach 20 years old within five years | model | B |
| `s_nxt` | About `META.nxt` | Louisiana roofs due for replacement from age alone in the coming year | model | B |
| `life_fact` | "About 20 years" (literal) | typical life of an asphalt shingle roof | nahb | B |
| `life_metal` | "40 years or more" | common life of a metal roof, depending on the metal, the finish and salt exposure | ind | C |
| `life_comm` | "15 to 30 years" | common life of a low slope commercial membrane, by system, thickness and drainage | ind | C |
| `life_coat` | "10 to 20 years" | common warranty term of a commercial roof coating, by product and the thickness applied | ind | C |
| `permit_fact` | "Every reroof" | needs a permit from the parish or city and its inspections, for work beginning on or after August 1, 2025 | "Acts 2025, No. 239" | A |
| `lic7500` | "$7,500" | residential roofing job size at which the Residential Roofing or Residential Construction license is required | "La. R.S. 37:2156.4 (Acts 2026, No. 757)" | A |
| `liab_fact` | "$500,000" | liability coverage residential contractors must keep on file with the LSLBC | "La. R.S. 37:2156.1" | A |
| `comm_fact` | "$50,000" | commercial job size at which a commercial license with the right classification is required | "La. R.S. 37:2150.1 and following" | A |
| `clock_fact` | "14 days" | for an insurer to begin adjusting a property claim after notice, or 30 days after a catastrophic loss | "La. R.S. 22:1892" | A |
| `ded_fact` | "$1,000" | contract size, paid from insurance, that must carry the statutory deductible notice in bold type | "La. R.S. 51:452" | A |
| `gouge_fact` | "Pre storm prices" | apply while a state of emergency is declared, plus documented cost increases | "La. R.S. 29:732" | A |
| `lien_fact` | "Notice and filing" | deadlines keep lien rights for contractors, subcontractors and suppliers on private works | "La. R.S. 9:4801 and following" | A |
| `nhwa_fact` | "1 year" | builder warranty against defects from noncompliance with building standards, 5 years for major structural defects | "La. R.S. 9:3141 and following" | A |
| `grant_fact` | `s_grant` | top Louisiana Fortify Homes Program grant toward a FORTIFIED roof, drawn by lottery for eligible homes | ldi | A |
| `s_storms` | `ST.storms` | named storms brought tropical storm force winds to Louisiana, ry0 to ry1 | hurdat | B |
| `s_fema` | `ST.fema` | FEMA registrations in Louisiana with roof damage or verified wind loss, fy0 to fy1 | fema | A |
| `s_h1`, `s_h175` | `ST.h1`, `ST.h175` | reports of hail 1 inch or larger (1.75 inches or larger, golf ball size) in Louisiana, py0 to py1 | noaa | A |
| `hail_season` | month `s0` to month `s1` | the months with `sSh`% of Louisiana reports of hail 1 inch or larger | noaa | A |
| `s_mh` | About `META.mh` | mobile and manufactured homes in Louisiana | acs | A |
| `mh_cost` | About `M$(META.ahs.s_mh_med)` (5,100) | median cost of a professional roof job on a mobile home in the South | ahs | B |
| `s_steel_fact` | "Up N%" or "Down N%" | producer prices for steel mill products, the metal in roof panels and flashing, [month] against a year earlier | bls | A |
| `s_permits_fact` | `s_permits` | new housing units permitted in Louisiana in [year] | bps | A |
| `s_out` | `s_out` | of roofing license records on the LSLBC roster belong to companies based outside Louisiana | lslbc | B |
| `c_roofs`, `p_roofs` | About the place's roofs | one unit roofs in the [city] ZIP codes / in [parish] Parish | acs | A |
| `c_ra20`, `p_ra20` | About the place's `ra20` | ... are 20 years or older | model | B |
| `c_h1` | `ev_h1` sum, or when zero `c_hd1` | reports of hail 1 inch or larger in the [city] ZIP codes (noaaZ, A); else "days a year with hail 1 inch or larger reported within 25 miles of [city], 1996 to 2025" (spc, B) | | |
| `c_fema`, `p_fema` | `fema_k` sum | FEMA registrations with roof damage or verified wind loss in ... | fema | A |
| `p_h1` | `ev_h1` sum | reports of hail 1 inch or larger in [parish] Parish | noaaZ | A |
| `c_last` | `c_lastYear` | latest year a named storm brought sustained winds of 58 mph or more to the [city] ZIP codes: [storm] | hurdat | B |
| `st_mph` | `st_mph` + " mph" | peak modeled sustained wind of [storm] in the [area], [month year] | hurdat | B |
| `st_roofs` | About `st_roofs` | roofs damaged by [storm] in the [area], by our estimate | dmg | C |
| `st_hu64` | About `st_hu64` | homes in ZIP codes where [storm] brought modeled hurricane force winds | hurdat | B |
| `st_fema` | `st_fema` | FEMA registrations in Louisiana with roof damage or verified wind loss after [storm] | fema | A |

Printed source strings (`SRC`, 7148 to 7153), which are the page's public attribution: `model` = "Estimate from Census American Community Survey 2020 to 2024 housing data, the 2023 American Housing Survey and NHC hurricane tracks"; `acs` = "U.S. Census Bureau, American Community Survey 2020 to 2024"; `noaa` = "NOAA Storm Events Database, py0 to py1"; `noaaZ` adds ", placed by coordinates"; `spc` = "NOAA Storm Prediction Center severe reports, 1996 to 2025"; `fema` = "OpenFEMA Individuals and Households Program, fy0 to fy1"; `hurdat` = "NOAA National Hurricane Center best tracks (HURDAT2), winds modeled to ZIP codes"; `dmg` = "Estimate from modeled winds and a damage curve fitted to FEMA registrations"; `nahb` = "National Association of Home Builders, Study of Life Expectancy of Home Components"; `ind` = "Manufacturer warranty terms and industry estimates"; `ahs` = "U.S. Census Bureau, American Housing Survey 2023"; `bls` = "U.S. Bureau of Labor Statistics, Producer Price Index for steel mill products"; `bps` = "U.S. Census Bureau, Building Permits Survey"; `lslbc` = "Louisiana State Licensing Board for Contractors roster, October 2026"; `ldi` = "La. R.S. 22:1483.1; Louisiana Department of Insurance, Fortify Homes Program".

### The plan (`plan`, 7199 to 7216) and what each page type contains

Page kinds and their ids: `home`, `about`, `practice` (one per line in `build.lines` that has copy in `FCOPY.AC`), `parish` (one per parish of the market cities, off by default), `city` (one per market), `storm` (one per chosen storm), `landing` (one per landing line and city, plus a Spanish variant where the city's resident weighted `span_sh` is at or above the site's threshold, default 8 percent, and the Spanish option is ticked), `guide` (state guides once, city guides once per market). Default build (7072 to 7073): home, about, service pages, city pages, storm pages, landing pages and guides on; parish hubs off; lines `replace, repair, storm, hail, metal` plus `fortified` when the company has a FORTIFIED status and `comm, coat, mf` when its licence classification matches `/commercial|building construction|sheet metal/i`; landing lines `replace, storm`; guide topics `age, storm, hail, license` plus `fortified`.

Titles, H1s, slugs and meta descriptions come from `describe` (7219 to 7234) and are trimmed by `fitTitle` (60 characters) and `fitMeta` (158).

Sections per page type (`blueprint`, 7319 to 7471). Every page also gets the call to action, the form (fields `FCOPY.FIELDS`, consent `FCOPY.CONSENT`), a notice (`FCOPY.NOTICE`), and "Related" links drawn from the live URL list.

| Kind | Sections in order |
|---|---|
| home (7358) | hero; answer "Who {brand} is"; key facts "Louisiana roofs by the numbers" (`s_ra20`, `s_wave`, `s_storms`, `permit_fact`); services; steps (`STEPS.replace`); video; testimonials; FAQ (`HOME_FAQ`); band; form; notice; links |
| about (7367) | hero; answer; key facts "At a glance" (licence, office, qualifying party, hours); "How we work"; "License, insurance and certifications"; FAQ; band; form; notice; links |
| practice (7376) | hero; answer (`A.aq`, `A.answer`); key facts "The numbers and the rules" (`A.facts`); "What the work includes"; "Before you hire a roofer"; "The Louisiana rules that apply" (`lawHTML(A.law)` from `FCOPY.LAWPUB`, section id `louisiana-law`); steps; video; testimonials; FAQ; reviewed by; band; form; notice; links |
| parish (7387) | hero; answer "How old are the roofs in {parish} Parish?"; key facts (`p_roofs`, `p_ra20`, `p_fema`, `p_h1`); table "Roofs and storms in {parish} Parish communities" (Community, One unit roofs, Roofs 20 years or older (estimate), Hail reports 1 inch or larger, FEMA roof and wind registrations) for up to 8 cities, summed over the city's ZIPs inside the parish; "What the parish numbers show"; services; steps; testimonials; FAQ (`PARISH_FAQ`); band; form; notice; links |
| city (7400) | hero; answer "How old are the roofs in {city}, and what hits them?"; key facts (`c_roofs`, `c_ra20`, `c_h1`, `c_fema`); "Storms and hail in {city}"; services; steps; testimonials; FAQ (`CITY_FAQ`); band; form; notice; links |
| storm (7411) | hero whose lede depends on the angle; answer "What did {storm} do to roofs in the {area}?"; key facts (`st_mph`, `st_roofs`, `st_fema`, plus `clock_fact` if fresh, `permit_fact` if recent, `life_fact` otherwise); table "Where {storm} hit hardest in the area" (Community, Peak sustained wind mph (model), One unit roofs, Roofs damaged (estimate)); a rich text block by angle; services; steps; FAQ (`STORM_FAQ`, `STORM_LATE_FAQ` or the first four replacement questions); reviewed by; band; form; notice; links |
| landing (7434) | English: hero (cover); answer; key facts (`A.lfacts`); "Before you call" (licence, office, "The rule that matters" = `A.dl`); three FAQ; form; band. Spanish: the `FCOPY.ES` block. No breadcrumbs; `noindex` by default |
| guide (7453) | hero "Guide · Louisiana" or the city; "The short answer"; "The facts behind it"; for the per city guide a table "Storms that brought winds of 58 mph or more to the {city} ZIP codes since {ry0}" (Storm, Year, Peak sustained wind mph (model), Roofs damaged (estimate)); body sections; FAQ; reviewed by; band; notice; links |

### Checks (`checks`, 7487 to 7509)

Every text field is run through `satchelLint` with `{web: true, lic, offices, certs, fortified, juris: 'Louisiana'}`; the whole page is run for `LIC1` and `LIC2`; the compiled source is run through `SAT.web` (WEB1 to WEB6). Added by the Forge: `COMPANY` (block, when placeholders remain; cite "R.S. 37:2156.4; house style"), `FORT0` (warn: FORTIFIED service page with no FORTIFIED status), `LIC5` (note: commercial page without a commercial classification; cite "La. R.S. 37:2150.1 and following ($50,000 commercial threshold)"), `FORGE` (compiler lint), `LEN` (H1 over 70, title over 60), `VARS` (template values without data). A block stops deploy here and in module 16.

### Other inputs

`BRAND` (the Company panel, `01_brand.js`, lines 766 to 861): `name`, `url`, `domain`, `phone`, `email`, `lic`, `licClass`, `contact`, `street`, `city`, `zip`, `offices`, `lat`, `lon`, `hours`, `warranty`, `financing`, `certs`, `fortified`, `social`, `colors`, `fonts`, `logoUrl`, `languages`. `META`: `compiled`, `ra20`, `wave`, `nxt`, `mh`, `roofs`, `fees_tot`, `ahs.s_mh_med`, `fort.grant`, `lic.out`, `lic.n`. The Campaign Desk plan (`MODI.desk.plan()` or `up.desk.v1`): `spanTh`, `zips`, `scope`, `picks`, `line`, `lines`, `storm` (7627 to 7632).

## 09.3 Louisiana specific content in module 09

Everything in this table is typed into the module and must be rewritten or regenerated. FCOPY (lines 1737 to 2112), which holds the service copy, guides, FAQ and law statements the Forge prints, is outside my range and is at least as Louisiana specific as anything here.

| Lines | What | Text or value to find |
|---|---|---|
| 6904 to 6908 | header comment | "Module 9: Site Forge (Louisiana roofing)", "LSLBC licensing and permits, the claims and deductible statutes" |
| 6911, 7515, 7574 | page type "parish" | `parish: 'Parish hub'`; module description "Service, city, parish, storm and guide pages..."; "Parish hub per parish in the plan" |
| 6915 | running names of the lines | "FORTIFIED roofs", "mobile home roofs" |
| 6953, 6965 to 6966 | data years | 1996, 2025, fallbacks 2004 and 2016 |
| 6973, 6979 to 6987 | hurricane sentences | "Hurricane ", "Tropical Storm "; "brought modeled sustained winds of hurricane force, 74 mph or more"; "none reached hurricane force there"; "named storms brought tropical storm force winds"; "No named storm since ..." |
| 6988 to 6991 | hail sentence | "NOAA logged ... reports of hail 1 inch or larger", "golf ball size or larger", "Within 25 miles ..." |
| 6993 to 6999 | storm reset sentence | "Most roofs there are young because ... replaced so many of them", "Hurricanes " |
| 7000 | FEMA sentence | "FEMA recorded ... registrations with roof damage or verified wind loss ..." |
| 7015 | fallback office point | 30.4515, −91.1871 (Baton Rouge) |
| 7020 to 7024 | metric labels | "FEMA roof and wind registrations", "Hail reports 1 inch or larger", "Mobile home roof jobs a year (model)" |
| 7043, 7573, 7664, 7852 | storm page ages | 1, 6, 13 to 24 years; "the worst recent storm ... and the worst storm of 13 to 24 years ago" |
| 7060, 7501 | LSLBC classification test | `/commercial|building construction|sheet metal/i` |
| 7065, 7336, 7530, 7538, 7754 | LSLBC role | "Qualifying party" |
| 7069 | trust strip default | "LSLBC license {lic} | Office in {officeCity} | {hours}" |
| 7092 to 7096 | state name in values | `state: 'Louisiana'`, ", Louisiana", "Our office is in ..., Louisiana.", fallback area "Louisiana" |
| 7102 | grant fallback | 10000 |
| 7110 to 7113, 7118, 7123, 7133 to 7134, 7140 to 7141 | parish and state wording | "parts of {x} Parish", "{x} Parish", "communities across {x} Parish", "{city}, Louisiana", "across {parish} Parish", " Parish, Louisiana" |
| 7148 to 7153 | printed sources | the fifteen `SRC` strings above (NHC hurricane tracks, HURDAT2, OpenFEMA, LSLBC roster October 2026, La. R.S. 22:1483.1, Louisiana Department of Insurance) |
| 7156 to 7192 | the fact registry | every row above: Act 239 of 2025; R.S. 37:2156.4 (Act 757 of 2026) and $7,500; R.S. 37:2156.1 and $500,000; R.S. 37:2150.1 and $50,000; R.S. 22:1892, 14 and 30 days; R.S. 51:452 and $1,000; R.S. 29:732; R.S. 9:4801; R.S. 9:3141; Fortify Homes grant; "in the South" for the mobile home cost |
| 7222 to 7230 | titles, H1, slugs, meta | "Roofing Contractor in {city}, Louisiana"; "{brand} | Roofing in {city}, LA"; "Licensed roofing contractor in ..., Louisiana ... LSLBC license {lic}"; "About {brand} | Louisiana Roofing Contractor"; "Roofing in {parish} Parish, Louisiana"; slug suffix `-parish-roofing`; "{storm} Roof Damage in ..."; ", Louisiana" |
| 7241 | acronym table for link anchors | `la: 'LA'`, `lslbc: 'LSLBC'`, `fema: 'FEMA'`, `fortified: 'FORTIFIED'` |
| 7258 to 7262 | URL tokens used to match live pages to lines | `hurricane`, `fortified`, `fortify`, `ibhs`, `tarp`, `tarping` |
| 7288, 7292, 7293, 7341, 7342 | schema | `addressRegion: 'LA'`; `propertyID: 'Louisiana State Licensing Board for Contractors license'`; `name: city + ', LA'`; `' Parish, LA'`; `{ '@type': 'State', name: 'Louisiana' }` |
| 7302 to 7303 | image alt text and library queries | "... roofing crew at work in {city}, Louisiana"; "roofing in {parish} Parish, Louisiana"; "Roof repair after {storm} in the {area}"; query "{parish} parish" |
| 7356 | licence paragraph | "holds Louisiana State Licensing Board for Contractors license ...", link `https://lslbc.gov/` |
| 7359 to 7375 | home and about copy | "roofing contractor with an office in {officeCity}, Louisiana, LSLBC license {lic}"; "Licensed Louisiana roofing for ..."; "licensed by the Louisiana State Licensing Board for Contractors"; "a permit from the parish or city"; "Louisiana roofs by the numbers"; "Residential contractors licensed by the board keep at least $500,000 in liability coverage on file with it, and every roofing job in Louisiana needs a permit and inspections." |
| 7383 | service page | heading "The Louisiana rules that apply", section id `louisiana-law` |
| 7389 to 7399 | parish page copy | "How old are the roofs in {parish} Parish?", "By our estimate from Census and storm records ...", "Every roof and reroof in the parish needs a permit from the parish or city ..., and residential roofing of $7,500 or more needs the LSLBC license." |
| 7402 to 7410 | city page copy | "Storms and hail in {city}", "across {parish} Parish" |
| 7414 to 7433 | storm page copy | every sentence: "Wind damage from {storm} is not always visible from the ground"; "at or near the end of a shingle roof's life in Louisiana"; "modeled hurricane force winds"; "By our estimate from its modeled winds and FEMA damage records"; "FEMA recorded {n} Louisiana registrations"; "an insurer must begin adjusting a property claim within 14 days, or within 30 days after a catastrophic loss"; "A roofer may not interpret your policy, negotiate your claim or offer to take on any part of your deductible"; "Most Louisiana shingle roofs last about twenty years"; "$7,500 or more needs the LSLBC license" |
| 7448 | landing page | "LSLBC license {lic}", "Check it on the board's website before you sign anything." (the Spanish block at 7436 to 7443 takes its text from `FCOPY.ES`) |
| 7456, 7460 | guide | "Guide · Louisiana"; "Storms that brought winds of 58 mph or more to the {city} ZIP codes since ..." |
| 7486 | lint context | `juris: 'Louisiana'` |
| 7494, 7500, 7501 | check messages | "LSLBC license number", "R.S. 37:2156.4; house style", "IBHS FORTIFIED program terms", "La. R.S. 37:2150.1 and following ($50,000 commercial threshold)" |
| 7526 to 7536 | field hints | "As licensed with the LSLBC"; "LSLBC license number"; "Residential roofing of $7,500 or more may be advertised only under the Residential Roofing or Residential Construction license (R.S. 37:2156.4)"; "For example: Residential Roofing; Commercial, Roofing and Sheet Metal"; "FORTIFIED status ... Leave blank unless FORTIFIED trained"; "Regulation Z" |
| 7541, 7545 | masthead and callout | "the eleven roofing lines", "optional parish hubs", "storm pages for the named storms that shaped the market's roofs", "the Louisiana law register", "the LSLBC license number" |
| 7548 to 7557 | step 1 | "Qualifying party", "16 CFR Part 465" (federal, keeps) |
| 7561 to 7570 | step 2 | "Selected parishes", "All of Louisiana", "Parishes (parish scope)", placeholder "Baton Rouge, Denham Springs, Gonzales", "Hail reports and FEMA registrations are observed records ..." |
| 7573 to 7579 | step 3 | the storm page paragraph; "Storm page per named storm"; "that city's own roof stock, storm footprints, hail reports and FEMA record"; "parish hubs off" |
| 7622 to 7623 | firm warning | "LSLBC license number", "$7,500", "R.S. 37:2156.4" |
| 7637, 7651 | tooltip and table headers | "FEMA roof and wind registrations", "Parish", "FEMA roof registrations" |
| 7649 | legend | "No office set: the plan is statewide" |
| 7818 | pack README | "built ... by the Uplift Louisiana Roofing Atlas, module 09" |
| 7835 to 7837 | method rows | "NHC best tracks modeled to ZIP codes", "per parish", "homes in hurricane force winds", "NHC HURDAT2 wind radii; a damage curve fitted to FEMA registrations; OpenFEMA" |
| 7839 to 7843 | method paragraphs | "the RoofingContractor entity with the LSLBC license as its identifier"; "the Louisiana rules that apply"; "LSLBC licensing and permits, the claims, deductible and assignment statutes, FORTIFIED and certification claims" |
| 7846 to 7859 | judgment calls | "Since August 1, 2026 advertising residential roofing of $7,500 or more requires ... (R.S. 37:2156.4)"; "$50,000 or more"; "(R.S. 37:2159.1, R.S. 51:451)"; "NHC best tracks"; "Grants are described as drawn by lottery, up to $10,000"; "Law statements link to legis.la.gov, the LSLBC and eCFR pages read on October 5 and 6, 2026 ... (price gouging, home improvement fraud, private works liens, the residential code)"; "in the Lafayette ZIP codes"; "Hablamos español"; "parish hubs off" |
| 7862 to 7870 | source rows and links | LSLBC memorandum on Acts 2025 Nos. 239 and 422 and Acts 2026 No. 757 (`https://lslbc.gov/`); "R.S. 37:2159.1, 51:451 and 51:452, 22:1892, 22:1483.1, 29:732, 9:4801, 9:3141" (`https://legis.la.gov/`); eCFR; ACS tables B25034, B25024, B25127; "NOAA NHC HURDAT2 best tracks and wind radii; NOAA Storm Events Database 2016 to 2026; SPC severe reports 1996 to 2025" (`https://www.nhc.noaa.gov/data/`); "OpenFEMA ... Louisiana disasters 2004 to 2026"; BLS WPU1017, WPU1361; "IBHS FORTIFIED Roof standard; Louisiana Fortify Homes Program (LDI)" (`https://fortifiedhome.org/`); schema.org |

## 09.4 What a California edition of module 09 needs

Carries over unchanged: the planner, the studio, the compiler, the live URL rule, media handling, the WordPress deploy, the exports and every federal rule (16 CFR 429, 465; Regulation Z).

| Louisiana input | California equivalent | Note |
|---|---|---|
| parish objects, "Parish" wording, `-parish-roofing` slugs, `AdministrativeArea` "X Parish, LA" | 58 counties, "County", `-county-roofing`, "X County, CA" | Mechanical, but it touches about forty strings and four schema fields. Avoid "LA" anywhere: it reads as Los Angeles |
| `cities` (265 post office cities with ZIP sets and line pools) | the same structure for about 1,760 ZIPs | Decide how to handle Los Angeles and San Diego neighbourhood names that the Postal Service treats as cities; a `minPop` of 10,000 leaves several hundred candidate cities, so the default of 8 markets within 45 miles matters more |
| LSLBC licence number, classifications, "Qualifying party", $7,500 and $50,000 thresholds, $500,000 liability filing | CSLB licence number, C-39 Roofing classification (B General Building for wider scope), the qualifying individual (RMO, RME or sole owner), the CSLB bond, workers' compensation, which C-39 holders must carry | The licence number on every page is a requirement in California too; the fact registry rows `lic7500`, `liab_fact`, `comm_fact` need new values and citations from the law register |
| "Every reroof needs a permit ... Act 239 of 2025" | local building permits for reroofs under the California Building Standards Code; Title 24 Part 6 cool roof triggers; Chapter 7A and CRC R337 Class A assemblies in Fire Hazard Severity Zones | Better material than Louisiana has: two guides (cool roofs by climate zone, fire zone roofing) with ZIP level facts |
| claims, deductible and assignment statutes; insurer clock (14 and 30 days) | California Insurance Code and Fair Claims Settlement Practices rules; the public adjuster act; contractor rules after a declared disaster | No obvious one to one statute for the deductible notice; the law register must supply what is true |
| `gouge_fact` (R.S. 29:732) | Penal Code 396 (price cap after a declared emergency) | Direct equivalent |
| `nhwa_fact`, `lien_fact` | SB 800 Right to Repair Act; mechanics lien law and the preliminary notice | Direct equivalents in kind |
| FORTIFIED line, Fortify Homes grant, `grant_fact` | no statewide roof grant of that shape. Candidates: the California Wildfire Mitigation Program home hardening retrofits (pilot counties), Safer from Wildfires insurer discounts, utility and local cool roof rebates | The line itself should become a "fire hardened and Class A roof" line; see module 12 |
| `routes`, `sids`, `zstorm` (named storms with a wind footprint per ZIP), `stormName`, the fresh, recent and wave angles | no named wind storms. An "events" table with a per ZIP footprint: wildfires with structures destroyed or damaged (CAL FIRE damage inspection data), federally declared winter storm and atmospheric river disasters, and major downslope wind events | The storm page type becomes an event page. The wave angle (roofs replaced together coming due 13 to 24 years later) applies to rebuilt fire neighbourhoods, not to wind |
| `dmgShare` (logistic curve of roofs replaced against sustained knots) | a damage share per event and ZIP taken from observed counts (structures destroyed, FEMA registrations) rather than a wind curve | The Forge only needs `est` per city and event |
| hail facts (`ev_h1`, `ev_h175`, `hd1`, hail season) | present in the data but small in California | Replace the hail slots in the city and parish key facts with wildfire exposure (share of homes in High or Very High Fire Hazard Severity Zones), wind gust days or rain days |
| `fema_k` and the FEMA sentence | OpenFEMA IHP registrations for California disasters (wildfires, 2023 storms) | Same source, but "roof damage or verified wind loss" is the wrong description; count real property damage by disaster type |
| Spanish landing pages at 8 percent Spanish at home | same rule; consider Chinese, Vietnamese, Tagalog and Korean shares as further layers | The threshold will be passed in most California ZIPs, so the default of English plus Spanish should be decided, not inherited |
| `META.ahs.s_mh_med` "in the South" | AHS Pacific division or West region | Re-pull |
| `META.lic.out` share of licences based out of state | CSLB licence master file by mailing state | Likely available |
| office fallback point (Baton Rouge) | pick a neutral state point or require an office | |

---

# Module 10 · Compliance Satchel (`22_m10_satchel.js`, lines 7904 to 8103)

## 10.1 What it is for and what it shows

The Satchel screens any text a roofing company shows the public (ads, pages, scripts, contracts) against a rule pack, and sorts the findings by who enforces them and how far they can be proven from the page. It has two postures: self audit (a fix list, house style rules on) and competitor (routes and an evidence bar, house style off). It fetches nothing and files nothing.

The rule pack itself is `SAT` in `05_satchel_rules.js` (lines 1371 to 1438, outside my range): 31 copy rules (1379 to 1409), 6 web tests (1412 to 1417) and 10 controls (1420 to 1429), `SAT.version = '2026-10-06'`, `SAT.vertical = 'Roofing, Louisiana'` (1377). Module 10 adds seven rows of its own, `SAT_EXTRA` (7909 to 7917), and the screen.

User visible structure, in order:

| Element | Lines | What it shows or does |
|---|---|---|
| Masthead | 7933 to 7935 | Counts of copy rules, web tests and in person checks; the five dispositions; "Rule pack of October 6, 2026" (`dateL(SAT.version)`); "Research support, not legal advice". Actions: ↓ Findings (CSV), ↓ Screen report (MD), ↓ Rule book (CSV). |
| Callout "Read this before you run it once" | 7937 | A complaint is an accusation; mass reporting backfires; "a Louisiana lawyer and the LSLBC answer licensing questions". |
| "Stage 0 · Posture, target and the question" | 7938 to 7945 | Posture (Self audit, Competitor), target company, domain, the question (Is it safe to run as is? Is there a violation worth raising? What belongs in the compliance file?), platform chips (`PLATS`, `PLAB`, lines 6612 to 6613), four surface checkboxes. |
| "Stages 1 to 4 · Sources and batteries" | 7946 to 7950 | Three sources: paste HTML or text (with a kind: ad or page, contract or estimate, door to door script, call or text script), Campaign Desk feed, Site Forge feed; "Load a fictional competitor page" (the `SAMPLE`, 8039 to 8050). |
| KPI row | 8057 | Confirmed, Candidates, Cleared, Not observable, Intelligence, Answer. |
| "Stage 5 · Findings" | 7952 to 7955, 8055 to 8078 | Filters (disposition, enforcer family); table (Disp., Rule, Where, Hits); detail pane (rule as cited, evidence, "What would settle it", the fix or "Where it goes", the evidence bar for competitor findings, "Move by hand"). |
| "Stage 6 · The controls gate" | 7956, 8053 to 8054 | One checkbox per `SAT.controls` row; a ticked control moves the candidates it answers to CLEARED. |
| Card "License and complaint lookups" | 7958 | Four steps (licence, insurance, complaints, certifications) and three links. |
| Card "Routing: where a finding goes, what it needs, what it does" | 7959, 8079 to 8090 | Eight routes (`ROUTES`); rows in the current run are highlighted. |
| "The rule book" | 7961, 8091 | Every rule: id, family, severity, what it catches, cite, fix. ✔ = "a primary text read for this build (October 2026)", ◐ = secondary source or platform policy. |
| Cards "How the Satchel is built", "Judgment calls" | 7963 to 7972 | Four and four entries. |
| "Sources" | 7974 to 7983 | Eight source rows. |

Disposition logic (8013 to 8014, 8018 to 8019): a rule with `obs === false` is NOT_OBSERVABLE; severity `note` is INTEL; a `block` rule whose text was read (`v === '✔'`) is CONFIRMED; everything else is CANDIDATE; in competitor posture `LIC1` is always CANDIDATE; a ticked control or a manual move overrides. The answer (8067 to 8070): for "safe", "Not yet" if any confirmed, "With fixes" if any candidate, else "Yes"; for "report", "N worth raising" or "Nothing to raise"; for "file", "N items".

Batteries (`screen`, 7992 to 8016): copy rules run sentence by sentence (`satchelLint`, line 1432) except `LIC1` and `LIC2`; a pasted contract runs `DED2`; a door or call script runs `COOL` and `TCPA`; HTML runs the six web tests (WEB1 and WEB2 skipped in competitor posture); the licence statements run once per asset set (self: `LIC1`, `LIC2` against the Company panel; competitor: a licence number pattern `LICNUM`, 7919, and a Louisiana city from `LA_CITIES`, 7920); the not observable rows are added by surface.

Exports: `satchel-findings_<target>.csv` (columns `disposition, rule, vintage, family, severity, name, where, hits, evidence, cite, route, fix, moved`), `satchel-report_<target>.md`, `satchel-rule-book.csv` (8093 to 8097).

## 10.2 Data contract

Module 10 reads **no field of `__ATLAS_DATA__`, `META` or the weather snapshot**. Its inputs are:

| Input | Where | Use |
|---|---|---|
| `SAT.rules`, `SAT.web`, `SAT.controls`, `SAT.version` | 1376 to 1430 | the rule pack |
| `satchelLint(text, ctx)`, `satCtx()` | 1432, 1437 | run the rules; context `{lic, offices, certs, fortified, juris}` from `BRAND` (juris defaults to 'Louisiana') |
| `BRAND.name`, `BRAND.domain` | 7924 | default target |
| `PLATS`, `PLAB` | 6612, 6613 | platform chips |
| `MODI.desk.feed()` | 8035 | every ad the Campaign Desk wrote: `{label, text, plat}` |
| `MODI.forge.feed()` | 8036 | every Forge page: `{label, text, html, plat: 'web', page: true}` |
| `receive({posture, target, domain})` | 8098 | sent by module 13 for a competitor |

The complete rule inventory (id, family, severity, read mark, citation). All of it is content, and nearly all of it is Louisiana law.

| Id (line) | Family | Sev | Read | Cite as printed | What it catches |
|---|---|---|---|---|---|
| LIC1 (1379) | LSLBC | block | ✔ | La. R.S. 37:2156.4 (Acts 2026, No. 757): advertising residential roofing of $7,500 or more requires the Residential Roofing or Residential Construction classification | residential roofing advertised with no licence on file |
| LIC2 (1380) | LSLBC | note | ◐ | Trust signal: owners verify on the LSLBC Contractor Search | licence number not shown |
| LIC3 (1381) | LSLBC | warn | ◐ | La. R.S. 51:1405; La. R.S. 37:2156.1 ($500,000 liability for residential licensees from Aug. 1, 2026) | "licensed and insured" with nothing on file |
| LIC4 (1382) | LSLBC | block | ✔ | Acts 2025, No. 239 (permit and inspection for every roof and reroof from Aug. 1, 2025); Acts 2025, No. 422 (violations) | copy that suggests skipping the permit |
| INS1 (1383) | Insurance claims | block | ✔ | La. R.S. 37:2159.1(7), (8) (Acts 2025, No. 144); R.S. 37:2159.1 (no adjusting) | claim handling or "claims specialist" advertising (`RX_CLAIMSVC`, 1371) |
| INS2 (1384) | Insurance claims | warn | ✔ | La. R.S. 37:2159.1; La. R.S. 22:1693 (unauthorized public adjusting) | "we work with your insurance", "storm restoration company" |
| INS3 (1385) | Insurance claims | block | ✔ | La. R.S. 37:2159.1 (no interpreting policy provisions); La. R.S. 51:451 | "your policy covers", "free roof", "insurance approved" (`RX_COVER`, 1372) |
| DED1 (1386) | Insurance claims | block | ✔ | La. R.S. 51:451 (Acts 2022, No. 734) | pay, waive or rebate a deductible (`RX_DED`, 1373) |
| DED2 (1387) | Insurance claims | block | ✔ | La. R.S. 51:452 | contract lacks the notice; the test looks for the literal sentence "Louisiana law requires a person insured under a property insurance policy to pay any deductible" |
| AOB1 (1388) | Insurance claims | warn | ✔ | La. R.S. 37:2159.1 (no assignment before the work is complete and the insurer has inspected) | assignment of benefits |
| ATTY1 (1389) | Insurance claims | warn | ✔ | La. R.S. 37:2159.1 (no sharing in attorney fees or accepting referral consideration) | attorney referral or lawsuit talk |
| GOUGE (1390) | Louisiana law | warn | ◐ | La. R.S. 29:732 (price gouging during a declared emergency) | "storm pricing", "hurricane rates", "book before prices rise" |
| COOL (1391) | FTC | warn | ✔ | 16 CFR Part 429 (FTC Cooling Off Rule) | door to door sale without the three day notice |
| TCPA (1392) | FTC | warn | ◐ | 47 U.S.C. 227; 47 CFR 64.1200; La. R.S. 45:844.11 et seq. | calls or texts without written consent; "the national and Louisiana Do Not Call lists" |
| SUP1 (1393) | Truth in advertising | warn | ◐ | La. R.S. 51:1405 (LUTPA); FTC Act s. 5 | superlatives |
| LIFE1 (1394) | Truth in advertising | warn | ◐ | La. R.S. 51:1405; manufacturer warranty terms | "lifetime", "hurricane proof", "storm proof" |
| WIND1 (1395) | Truth in advertising | note | ◐ | Manufacturer specifications; ASTM D3161 and D7158 wind classes; state building code | a wind speed rating claim |
| CERT1 (1396) | Truth in advertising | block | ◐ | Manufacturer program terms; La. R.S. 51:1405 | a manufacturer certification not in the Company panel (`RX_CERT`, 1375: GAF, Owens Corning, CertainTeed, Malarkey, IKO, Atlas, Carlisle, Firestone, Johns Manville, Versico, Duro Last) |
| FORT1 (1397) | FORTIFIED | block | ◐ | IBHS FORTIFIED program terms; La. R.S. 22:1483.1 (grant roofs are certified by an evaluator) | FORTIFIED installer claim without a status on file |
| FORT2 (1398) | FORTIFIED | warn | ✔ | R.S. 22:1483.1 (discounts are filed by each insurer; SB 222 of 2025, which would have mandated 20 to 30 percent, did not pass) | a promised insurance discount size |
| GRANT1 (1399) | FORTIFIED | warn | ◐ | R.S. 22:1483.1; LDI program rules (lottery rounds, up to $10,000, eligibility) | a grant promise or an amount above $10,000 |
| FIN1 (1400) | Financing | block | ✔ | 12 CFR 1026.24(d) (Regulation Z) | a financing trigger term with no APR (`RX_FIN`, 1374) |
| META1 (1401) | Meta | warn | ◐ | Meta Advertising Standards, special ad categories | financing language in a Meta ad |
| FTC1 (1402) | FTC | warn | ◐ | 16 CFR Part 465 (eff. Oct. 21, 2024); 16 CFR Part 255 | star and review count claims |
| FTC2 (1403) | FTC | note | ◐ | 16 CFR Part 251 | "free" without conditions |
| FTC3 (1404) | FTC | block | ✔ | 16 CFR 465.4, 465.7 | review incentives or gating |
| STORM1 (1405) | Storm response | note | ◐ | La. R.S. 37:2150.1 et seq. (every contractor needs the Louisiana license for the work); La. R.S. 14:202.1 | "out of state crews", "storm teams arriving" |
| GADS1 (1406) | Google Ads | warn | ◐ | Google Ads responsive search ad limits | headline over 30 characters |
| GADS2 (1407) | Google Ads | warn | ◐ | Google Ads editorial policy | shouting; the allow list of capitals is `FORTIFIED|LSLBC|IBHS|HOA|TPO|PVC|EPDM|FEMA|NOAA` |
| HOUSE1 (1408) | House style | block | ✔ | House style: no hyphens or dashes in copy | any hyphen or dash outside a URL |
| HOUSE2 (1409) | House style | block | ✔ | House style: no explanatory or meta notes inside a deliverable | placeholders, including the literal strings "LSLBC license number", "Your company", "Your city" |
| WEB1 (1412) | Web | warn | ◐ | R.S. 37:2156.4 (licensed to advertise); trust signal | licence number not in the page source |
| WEB2 (1413) | Web | warn | ◐ | Google Business Profile and LSA verification; R.S. 51:1405 | no office city in the page source |
| WEB3 (1414) | Web | warn | ◐ | TCPA (47 U.S.C. 227); 47 CFR 64.1200 | a pre checked consent box |
| WEB4 (1415) | Web | warn | ◐ | Google review snippet guidelines; 16 CFR Part 465 if fabricated | self served `aggregateRating` |
| WEB5 (1416) | Web | warn | ◐ | FTC Act s. 5; platform terms | tracking tags with no privacy link |
| WEB6 (1417) | Web | block | ✔ | R.S. 37:2159.1(7), (8); R.S. 51:451 | claim services or deductible offers on the page |
| DOOR1 (7910) | FTC | warn | ✔, not observable | 16 CFR Part 429 (Cooling Off Rule); parish and city solicitation permits | door to door sales and canvassing |
| CALL1 (7911) | FTC | warn | ◐, not observable | 47 U.S.C. 227; 47 CFR 64.1200; La. R.S. 45:844.11 and following | calls, texts and lead vendors |
| CONT1 (7912) | Insurance claims | block | ✔, not observable | La. R.S. 51:452; La. R.S. 37:2159.1; 16 CFR Part 429 | contracts and estimates |
| SIGN1 (7913) | LSLBC | warn | ◐, not observable | La. R.S. 37:2156.4 (advertising residential roofing requires the license) | yard signs, door hangers, truck wraps and mailers |
| PRICE1 (7914) | Louisiana law | warn | ◐, not observable | La. R.S. 29:732 | storm pricing and price books |
| TV1 (7915) | Truth in advertising | warn | ◐, not observable | La. R.S. 51:1405; La. R.S. 37:2159.1 | television, radio and video spots |
| LOC1 (7916) | Storm response | note | ◐ | "Intelligence: storm crews from out of state often show no local address; Google and Local Services Ads verify the office" | no Louisiana office city in the observable text |

Controls (`SAT.controls`, 1420 to 1429), as `[id, label, rules answered]`: `licensed` (LIC1, LIC2, WEB1), `permits` (LIC4), `claims` (INS1, INS2, INS3, WEB6), `deductible` (DED1, DED2), `estimates` (AOB1), `reviews` (FTC1, FTC3), `financing` (FIN1, META1), `certs` (CERT1, FORT1, FORT2, GRANT1), `door` (COOL, TCPA), `gouge` (GOUGE). Their labels restate the Louisiana rules ("The Residential Roofing or Residential Construction classification is active before any residential roofing ad runs...", "insurance funded contracts carry the 12 point bold notice").

Routing by family (`routeFor`, 8017): LSLBC → "LSLBC complaint (competitor) with dated evidence"; Insurance claims → "Department of Insurance referral (competitor) with evidence of claim handling"; Louisiana law → "attorney general (competitor)"; Web → "intelligence (competitor)"; FTC → "FTC report only if fabricated"; FORTIFIED → "IBHS report (competitor)"; otherwise "Intelligence".

## 10.3 Louisiana specific content in module 10

| Lines | What | Text or value to find |
|---|---|---|
| 7909 to 7917 | `SAT_EXTRA` | the seven rows above: "its LSLBC license", "parish and city solicitation permits", "the Louisiana and national do not call lists", R.S. 51:452, 37:2159.1, 37:2156.4, 29:732, 51:1405, "the bold deductible notice on any contract of $1,000 or more paid from insurance", "no assignment of benefits before the work is complete and the insurer has inspected", "LSLBC complaint (competitor) for unlicensed advertising", "attorney general (competitor)", "No Louisiana office city in the observable text" |
| 7919 | licence number pattern | `/\b(LSLBC|license|lic\.?)\s*(#|no\.?|number)?\s*:?\s*\d{4,7}\b/i` (the pattern expects the word LSLBC, license or lic followed by 4 to 7 digits) |
| 7920 | `LA_CITIES` | New Orleans, Baton Rouge, Shreveport, Lafayette, Lake Charles, Monroe, Alexandria, Houma, Metairie, Kenner, Slidell, Hammond, Bossier City, Covington, Thibodaux, Mandeville, Ruston, Natchitoches, Opelousas, New Iberia, Gonzales, Denham Springs, Prairieville, Zachary, Sulphur, Morgan City, Gretna, Harvey, Marrero, Chalmette, LaPlace, Laplace |
| 7922 | module description | "Ads, pages, scripts and contracts screened against Louisiana licensing, claims and deductible law, the FTC and platform policies" |
| 7933 | dek | "Every surface a Louisiana roofing company shows the public ...: the LSLBC licensing and permit acts of 2025 and 2026, the insurance claim, deductible and assignment statutes, ... the price gouging law" |
| 7937 | callout | "A complaint to the licensing board, the Department of Insurance or the attorney general ..."; "a Louisiana lawyer and the LSLBC answer licensing questions" |
| 7958 | lookups card | "The LSLBC contractor search confirms the company, its classifications (Residential Roofing, Residential Construction, commercial roofing) and its status; residential roofing of $7,500 or more may be advertised only under the license."; "Residential licensees keep $500,000 in liability coverage on file with the board"; "the Louisiana Department of Insurance takes insurance fraud and unlicensed public adjusting; the attorney general's Consumer Protection Section takes deceptive practices and storm price gouging"; "FORTIFIED status ... IBHS's own contractor directories"; links `https://lslbc.gov/`, `https://www.ldi.la.gov/`, `https://www.ag.state.la.us/` |
| 7961 | rule book note | "a primary text read for this build (October 2026)" |
| 7969 to 7972 | judgment calls | "Louisiana bars contractors from advertising claim handling or policy interpretation services and from offering anything toward a deductible"; "The LSLBC contractor search settles it"; "Spanish and Vietnamese ads and pages need a reader of that language" |
| 7975 to 7983 | source rows | "LSLBC memorandum on the 2025 and 2026 statutory changes; Acts 2025, Nos. 239, 422 and 144; Acts 2026, No. 757" (read Oct 6, 2026, `https://lslbc.gov/`); "La. R.S. 37:2159.1, 51:451, 51:452 and 22:1892 on legis.la.gov (module 03 register)" (read Oct 5 and 6, 2026, `https://legis.la.gov/`); the federal rows (16 CFR 465, 429, 251; 12 CFR 1026.24) keep; "IBHS FORTIFIED program terms; La. R.S. 22:1483.1" (`https://fortifiedhome.org/`); platform policies |
| 7995 | competitor context | `juris: 'Louisiana'` |
| 8008 | competitor licence test | "no LSLBC license number found in the observable text; check the LSLBC contractor search"; "no Louisiana office city found in the observable text" |
| 8011 | not observable evidence | "compare invoices after the last declared emergency with the dated price book" |
| 8017 | routes by family | "LSLBC complaint", "Department of Insurance referral", "attorney general", "IBHS report" |
| 8021 to 8027 | "What would settle it" questions | "Does the LSLBC contractor search show the company, active, with the Residential Roofing or Residential Construction classification?"; "Does the IBHS FORTIFIED directory list the company?"; "Does the copy say grants are drawn by lottery for eligible homes, up to $10,000, paid after certification?"; "Is the crew working under a Louisiana license, and does the company show a local address?"; "Is there a Louisiana office address anywhere on the site or the ad account?" |
| 8039 to 8050 | fictional sample page | "Gulf Blast Roofing | #1 Storm Restoration Company in Louisiana"; "Louisiana's Best Roofing Company, 5 Star Rated"; "Hurricane damage? Our insurance claim specialists handle everything ..."; "Out of state storm teams arriving this week. No permit needed for storm repairs."; "our shingles are hurricane proof"; "GAF Master Elite and FORTIFIED certified roofers. Get a 30% insurance discount, and we guarantee the state grant."; label "gulfblast.example/storm-damage (fictional)" |
| 8076 | evidence bar | "the LSLBC search result, and a lawyer's review before anything is filed" |
| 8080 to 8087 | `ROUTES` | "Louisiana State Licensing Board for Contractors · Complaint on lslbc.gov"; "Louisiana Department of Insurance · Fraud and unlicensed adjusting referral"; "Louisiana Attorney General · Consumer Protection Section complaint · ... unfair trade practices and price gouging laws"; "IBHS and manufacturers"; the family names "LSLBC", "Louisiana law", "FORTIFIED" used as match keys |

## 10.4 What a California edition of module 10 needs

The engine (batteries, dispositions, controls gate, exports) is state neutral. The whole rule pack and every route must be replaced, because family names double as routing keys (`/LSLBC/`, `/Louisiana law/`, `/FORTIFIED/` in `routeFor`, and the `ROUTES` table).

| Louisiana rule or input | California equivalent to draft and verify | Kind of change |
|---|---|---|
| family "LSLBC"; LIC1 ($7,500 residential roofing licence), LIC2, LIC3 ($500,000 liability), SIGN1, WEB1 | family "CSLB": a contractor licence is required to advertise and to bid above the minor work exemption; the licence number must appear in all advertising, contracts and bids; C-39 Roofing classification; the contractor bond; C-39 workers' compensation rule; rules on advertising "insured" or "bonded" | new citations and thresholds from the Business and Professions Code |
| LIC4 (permit for every reroof, Acts 2025 Nos. 239 and 422) | no single state act; local permits under the Building Standards Code; Title 24 cool roof compliance on reroofs; Class A in fire zones | rewrite as "no copy suggests skipping the permit, the cool roof rule or the fire zone assembly" |
| INS1, INS2, INS3, AOB1, ATTY1, WEB6 (R.S. 37:2159.1) | the Insurance Code's public adjuster licensing; any Business and Professions Code limits on contractors negotiating claims | needs legal reading; the regular expressions `RX_CLAIMSVC` and `RX_COVER` carry over |
| DED1, DED2 (R.S. 51:451, 51:452 and the literal notice sentence) | whatever California law says on deductible rebates; there is no Louisiana style 12 point notice to test for | `DED2` tests for a Louisiana sentence and must be removed or replaced by the home improvement contract notices California requires |
| GOUGE, PRICE1 (R.S. 29:732) | Penal Code 396: 10 percent cap after a declared emergency, with its own duration rules | direct equivalent, stricter wording |
| COOL, DOOR1 (16 CFR 429) | keep, and add the state home solicitation and home improvement contract rules (three day right to cancel, longer for seniors, extended after a disaster; down payment limit) | add state rows |
| TCPA, CALL1 (La. R.S. 45:844.11) | keep the federal text; drop the Louisiana do not call citation | edit cite |
| SUP1, LIFE1, TV1 (R.S. 51:1405, LUTPA) | Business and Professions Code 17200 (unfair competition) and 17500 (false advertising); "hurricane proof" in the pattern becomes "fireproof", "fire proof", "wildfire proof" | edit cite and pattern |
| FORT1, FORT2, GRANT1 (FORTIFIED, R.S. 22:1483.1, $10,000 lottery grant) | no FORTIFIED programme. Candidates: claims about "Class A", "WUI compliant", "Chapter 7A", "cool roof rated (CRRC)", promised insurance discounts under Safer from Wildfires, promised rebates or grants | new family "Fire and energy claims" |
| STORM1, LOC1, `LA_CITIES`, `LICNUM` | out of area crews after wildfires and storms; a California city list (the top 30 by population or the atlas cities); CSLB licence numbers are numeric, typically 6 to 7 digits, often written "Lic. #" or "CSLB #" | regenerate the list from `cities`; widen the pattern |
| WIND1 | add a rule for fire rating claims (ASTM E108, UL 790 Class A) and cool roof claims | new |
| `ROUTES` and the lookup card | CSLB complaint; California Department of Insurance (fraud division, public adjuster enforcement); Attorney General and district attorney consumer units; Google, Meta, FTC rows keep; manufacturers keep; IBHS drops | rewrite |
| `SAMPLE` fictional page | a fictional California page with the California violations (no CSLB number, "we handle your fire claim", "fireproof roof", a promised FAIR Plan discount, a pre checked box) | rewrite |
| `SAT.vertical`, `juris` default | "Roofing, California", 'California' | |

---

# Module 11 · Louisiana Regions (`23_m11_regions.js`, lines 8105 to 8235)

## 11.1 What it is for and what it shows

One card and one detail panel per region, so a regional campaign can be briefed without reading the ZIP maps: how old the roofs are, which storms reset them, which lines run hot, who advertises, which media market to buy, which languages to build for. Regions are the Louisiana Department of Health's nine administrative regions. Each parish carries its region in `parish.reg`; names come from `META.model.REG` (`REGN`, line 577).

| Region | Name (`META.model.REG`) | Parishes | Main media market (`REG_MKT`, line 6097) | Cost factor (`META.model.DMA`) |
|---|---|---|---|---|
| 1 | Greater New Orleans | Jefferson, Orleans, Plaquemines, St. Bernard | New Orleans | 1.00 |
| 2 | Capital Region | Ascension, East Baton Rouge, East Feliciana, Iberville, Pointe Coupee, West Baton Rouge, West Feliciana | Baton Rouge | 0.90 |
| 3 | Bayou and River Parishes | Assumption, Lafourche, St. Charles, St. James, St. John the Baptist, St. Mary, Terrebonne | New Orleans and Baton Rouge | 0.85 |
| 4 | Acadiana | Acadia, Evangeline, Iberia, Lafayette, St. Landry, St. Martin, Vermilion | Lafayette | 0.80 |
| 5 | Southwest | Allen, Beauregard, Calcasieu, Cameron, Jefferson Davis | Lake Charles | 0.80 |
| 6 | Central | Avoyelles, Catahoula, Concordia, Grant, LaSalle, Rapides, Vernon, Winn | Alexandria | 0.65 |
| 7 | Northwest | Bienville, Bossier, Caddo, Claiborne, De Soto, Natchitoches, Red River, Sabine, Webster | Shreveport | 0.70 |
| 8 | Northeast | Caldwell, East Carroll, Franklin, Jackson, Lincoln, Madison, Morehouse, Ouachita, Richland, Tensas, Union, West Carroll | Monroe and El Dorado | 0.62 |
| 9 | Northshore and Florida Parishes | Livingston, St. Helena, St. Tammany, Tangipahoa, Washington | New Orleans and Baton Rouge | 0.95 |

User visible structure, in order:

| Element | Lines | What it shows |
|---|---|---|
| Masthead | 8150 to 8153 | Eyebrow "Module 11 · Louisiana Regions · nine regions, 64 parishes"; a dek that narrates the hurricane history by region; four facts; actions ↓ Regions CSV and Campaign Desk ↗. |
| Callout "Read this first: how to read the regions" | 8155 | Three computed leaders: the region with the largest share of roofs reaching 20 within five years, the region with the youngest roofs, the region with the most hail. |
| Region cards (`#r11Cards`) | 8182 to 8184 | Per region: parishes, residents, media market; Roofs 20 or older (count and share); Reaching 20 within five years; Latest hurricane force storm; Gross profit pool a year. Click selects the region. |
| Map measure select | 8157, 8138 to 8147 | Nine measures (below). |
| Map | 8172 to 8178 | Parishes filled with their region's value (`fillParish`), eight quantile classes; hover shows the region, the measure, roofs 20 or older, the wave and the latest hurricane force storm. |
| Detail panel | 8185 to 8211 | State view: regions ranked by old roofs. Region view: the rows listed in 11.2, "Lines that run hot" (top four), "Market", the largest cities, the mapped roofers, and two buttons (Roof Demand Index for the region; Top ZIPs to the Desk: the 25 scored ZIPs with the highest `effb`). |
| Table "Regions side by side" | 8162, 8212 | Region, Residents, One unit roofs, Roofs 20+ %, Reaching 20 %, Due a year per 1k, FEMA per 100 homes, Hail days, Hurricane chance, Pool, Cost, Roofers, Spanish %, Media market. |
| Card "The storm resets by region" | 8164, 8213 to 8215 | Table: one row per region, columns for the reset years 2005, 2008, 2012, 2020, 2021, 2024 (each headed with the storms of that year whose modeled damage is 5,000 roofs or more) and "Age driven, 2026"; a Louisiana total row. |
| Card "Which lines run hot where" | 8165, 8216 to 8217 | Heat table: region by line, each cell the region's pool per resident divided by the state's. |
| Card "Gaps: what no public dataset fills" | 8168, 8218 to 8224 | Five rows with a grade. |
| Card "How this tab is built" | 8169, 8225 | One paragraph. |
| Footer | 8226 | "Uplift Louisiana Roofing Atlas, module 11. Regions are the Louisiana Department of Health administrative regions. Compiled [date]." |

Export: `louisiana-roofing-regions.csv` (8228 to 8229), columns `region, parishes, residents, one_unit_roofs, roofs_20_plus_model, roofs_15_to_19_model, due_next_12_months_model, mobile_homes, fema_registrations_2004_<year>, fema_per_100_homes, hail_reports_1in_2016_<year>, wind_reports_58mph, tornadoes, hail_days_1in, hurricane_chance_pct, hurricane_force_storms_since_2002, gross_profit_pool_model, mean_relative_cpc, mapped_roofers, roofing_establishments_cbp, spanish_pct, media_market, storm_resets_2005, ..._2008, ..._2012, ..._2020, ..._2021, ..._2024`.

## 11.2 Data contract

For region `k`: `ps` = parishes with `reg === k`; `zall` = every ZIP whose `pi` is one of them; `zs` = the scored ZIPs (`ZR`) among them (8116).

| Region field | Formula (line 8117 to 8133) | Reads |
|---|---|---|
| `pop`, `hu`, `roofs`, `ra20`, `wave`, `nxt`, `mh`, `cru`, `seas`, `ytd26`, `ytd25` | sum over the region's parishes | parish `pop`, `hu`, `roofs`, `ra20`, `wave`, `nxt`, `mh`, `cru`, `seas`, `ytd26`, `ytd25` |
| `fema` | Σ parish `fema_k` | FEMA roof and wind registrations 2004 to 2026 |
| `area` | Σ parish `aland` ÷ 2.58999e6 | land area, square metres to square miles |
| `h1`, `w58`, `torn` | Σ parish `ev.h1`, `ev.w58`, `ev.t` | NOAA Storm Events reports 2016 to 2026 by parish |
| `hd1`, `hd175`, `hur64`, `mort` | resident weighted mean over `zall` of ZIP `hd1`, `hd175`, `hur64`, `mort_sh` (weight `z.pop`) | ZIP columns |
| `h64` | storms whose highest wind at any ZIP of the region is 64 kt or more and whose year is 2002 or later, newest first; label from `stormName(route)` or "Hurricane " + name | `zstorm`, `sids`, `routes` |
| `hist` | per year, Σ parish `hist[year] = [age driven, storm driven]` | parish `hist` (2000 to 2026) |
| `bps25` | Σ parish `bps['2025'][1]` | housing units authorized in 2025 |
| `fees` | Σ `z.fees` over `zs` | ZIP `fees` |
| `cpc` | mean of `z.cpc_rel` over `zs` | ZIP `cpc_rel` |
| `lines[l]` | Σ `z['p_' + l]` over `zs` for the eleven lines | ZIP `p_*` |
| `firms` | competitors with any office whose nearest parish centre (`geo.pcent[fips] = [lon, lat]`, by `kmLL`) lies in the region | `comp[].offices[].lat/lon`, `geo.pcent` |
| `cbp`, `lic`, `adj`, `agents` | Σ parish `cbp_roof`, `lic`, `adjusters`, `ins_agents` | parish fields. `cbp_roof` is null in 46 of 64 parishes (suppressed cells), so the region sum is a floor: the non null parishes sum to 236 against 267 statewide |
| `span`, `viet`, `french` | 100 × Σ parish `spanish` (`viet`, `french`) ÷ Σ parish `pop5` | speakers at home over residents aged 5 and over |
| `s65` | 100 × Σ `a65p` ÷ Σ `pop` | |
| `inc` | median of the parishes' `inc` | not a true regional median |
| `own` | 100 × Σ `own` ÷ Σ `occ` | owner occupied share |
| `cities` | `cities` whose `pi` is in the region, largest first | |
| `dma` | `META.model.DMA[k]` | assumed cost factor of the media market (grade D, stated at line 6253) |
| `ra20sh`, `wavesh` | 100 × `ra20` (`wave`) ÷ `roofs` | |
| `nxtK` | 1000 × `nxt` ÷ `roofs` | age driven replacements per 1,000 roofs |
| `femaR` | 100 × `fema` ÷ `hu` | |
| hot line ratio | (`lines[l]` ÷ `pop`) ÷ (Σ all regions' `lines[l]` ÷ Σ all regions' `pop`) | 8137, 8190 |

Map measures (`RM`, 8138 to 8147): `ra20` (share), `wave` (share), `nxt` (per 1,000 roofs), `fema` (per 100 homes, "2004 to [year]"), `hail` (`hd1`), `hur` (`hur64`), `fees` (pool per resident), `cpc`, `span`.

Storm reset table (8213 to 8215): `rs(region, y) = hist[y][1]`, `ag(region) = hist[CUR][0]`; the reset years are the typed list `RESET_Y = [2005, 2008, 2012, 2020, 2021, 2024]` (8114); the header names come from `routes` of that year with `RTS[r].est ≥ 5000`. Its note (8215) is the method statement: "Storm driven replacements in the year of the storm, from the roof age model: the modeled winds of every storm at each ZIP times the FEMA fitted damage curve. A reset of tens of thousands of roofs in one year comes due as a wave about twenty years later. Grade B." (Section 17.3 shows the resets are in fact FEMA based where FEMA has registrations.)

Method text to keep as the record of how the regional numbers were built (8225): "Regions follow the Louisiana Department of Health's nine administrative regions, which line up with the main media markets. Roof stock, roof ages and replacements sum the parish tables of the roof age model (module 17); FEMA registrations and storm reports sum by parish; hurricane force storms count distinct storms with modeled sustained winds of 74 mph or more at any ZIP of the region since 2002; hail days and hurricane chances are resident weighted ZIP means; model pools sum the scored ZIPs, each assigned to the parish holding most of its residents; roofers count when any mapped office sits in a parish of the region. The media market named for each region is its main market for buying (grade C): northern parishes on the state line also receive stations from Mississippi, Arkansas and Texas."

Verified: `META.model.P2R` (parish FIPS to region) agrees with `parish.reg` for all 64 parishes; parish `hist` equals the sum of its ZIPs' `rhist` (Acadia 2005: 714 and 5,370); the state sums of parish `hist` equal `ts.replace_hist`.

## 11.3 Louisiana specific content in module 11

| Lines | What | Text or value to find |
|---|---|---|
| 8108, 8110 | title and description | "Louisiana Regions"; "The nine regions on their own: roof stock and age, storm resets, hail, FEMA, competition, media markets and languages" |
| 8114 | reset years | `[2005, 2008, 2012, 2020, 2021, 2024]` (Katrina and Rita; Gustav and Ike; Isaac; Laura, Delta and Zeta; Ida; Francine) |
| 8122, 8173, 8183, 8194 | hurricane threshold and start year | `kt >= 64`, `>= 2002`, "Hurricane ", "none since 2002", "Hurricane force storms since 2002 · latest" |
| 8139 to 8147 | measure labels | "FEMA roof and wind registrations per 100 homes, 2004 to ...", "Hail days a year, 1 inch or larger within 25 miles (resident weighted)", "Chance of hurricane force winds in a year (resident weighted %)" |
| 8150 | masthead | "Module 11 · Louisiana Regions · nine regions, 64 parishes"; dek: "Louisiana is not one roofing market. Hurricanes reset the coast in waves: Ida and Francine left the Bayou and River Parishes with the youngest roofs in the state, Laura and Delta did the same for the Southwest, and the roofs put on after Katrina around New Orleans and the Northshore are now past twenty years, with Gustav's roofs in the Capital Region close behind. The Northwest and Northeast sit outside most hurricane tracks: roofs there simply age, and hail and thunderstorm wind do the damage. The regions are the Louisiana Department of Health's nine administrative regions, which line up with the media markets a roofer buys." |
| 8151 | facts | "LDH administrative regions 1 to 9"; "NHC tracks, NOAA reports, FEMA" |
| 8155 | callout | "a region with few old roofs was usually reroofed by a recent hurricane, and its next wave is a decade or more away" |
| 8160, 8187 | state name | "Louisiana" as the default panel title |
| 8164 | card text | "Roofs replaced after the big storm years (model) ... The resets are the waves that come due twenty years later." |
| 8172 to 8173 | map | "Map of Louisiana regions"; "{parish} Parish"; "Latest hurricane force storm" |
| 8178 | legend | "nine regions in eight classes" |
| 8182 to 8183 | cards | "parishes", "Latest hurricane force storm" |
| 8193 | detail row | "Mobile homes · camps and seasonal homes · commercial roofs (estimate)" ("camps" is the Louisiana word) |
| 8195 to 8198 | detail rows | "FEMA roof and wind registrations, 2004 to ...", "Storm reports 2016 to ...: hail 1 inch+ · damaging wind · tornadoes", "Hail days a year (1 inch+, 1.75 inch+) · hurricane chance a year", "New housing units permitted, 2025 · ... to date against last year" |
| 8201 to 8204 | market rows | "Main media market · cost factor"; "license records"; "Insurance agents (ZBP) · adjusters"; "Spanish · Vietnamese · French at home" |
| 8212 | table headers | "Hurricane chance", "Media market" |
| 8215 | trend table | "Louisiana" total row and the note quoted above |
| 8217 | heat table note | "Replacement, repair, storm and hail rest on the roof stock, the storm record and the FEMA fitted damage curve; FORTIFIED, metal, commercial, coating and new construction lines lean on assumptions (grade D)" |
| 8219 to 8223 | gaps | "the Department of Insurance publishes catastrophe claim totals by event, at best by parish"; "Parish and city permit offices hold them, and every roof has needed one since August 2025"; "the atlas models it by ZIP from year built and storm footprints"; "Radar hail swaths ..." |
| 8225 | method | the paragraph quoted above (LDH regions, 74 mph, since 2002, Mississippi, Arkansas and Texas) |
| 8226, 8229 | footer and CSV note | "Uplift Louisiana Roofing Atlas, module 11"; "Regions are the Louisiana Department of Health administrative regions" |
| 8228 | export | file name `louisiana-roofing-regions.csv`; header names with `hurricane`, `2002`, `parishes` |
| 6097 (outside my range, read here) | `REG_MKT` | the nine media market names in the table at the top of this module |
| data | `META.model.REG`, `DMA`, `P2R`; `parish.reg` | region names, cost factors and the parish to region map |

## 11.4 What a California edition of module 11 needs

| Louisiana input | California equivalent | Note |
|---|---|---|
| nine LDH regions over 64 parishes | a region scheme over 58 counties; no state agency scheme matches media markets as neatly. A workable one follows the television markets and climate: Los Angeles basin; Inland Empire and desert; San Diego; Central Coast; Bay Area; Sacramento Valley; San Joaquin Valley; Sierra and foothills; North Coast and far north | Whatever is chosen, store it as `parish.reg`, `META.model.REG`, `META.model.P2R` and keep the count out of the copy (the word "nine" is typed at 8110, 8150, 8178 and 8225 here, and again in modules 12, 14 and 17) |
| `REG_MKT` and `META.model.DMA` cost factors (assumptions, grade D) | the Nielsen markets that cover California (Los Angeles, San Francisco Oakland San Jose, Sacramento Stockton Modesto, San Diego, Fresno Visalia, Santa Barbara Santa Maria San Luis Obispo, Monterey Salinas, Bakersfield, Palm Springs, Chico Redding, Eureka, Yuma El Centro, plus Reno and Medford Klamath Falls for a few border counties) | The factors must be re-assumed; one region will often span two markets, as regions 3 and 9 do here |
| parish sums of the roof age model (`roofs`, `ra20`, `wave`, `nxt`, `hist`) | the same, by county | No change in code |
| `hur64`, `h64`, "Latest hurricane force storm", the storm reset table and `RESET_Y` | no equivalent. Put wildfire in this slot: share of homes in High and Very High Fire Hazard Severity Zones (resident weighted), structures destroyed by year, and a "rebuild cohorts" table by fire year (2017, 2018, 2020, 2021, 2025) | The reset table only reads `hist[y][1]`; if the California cohort model writes fire rebuilds into the second element the table works as is, with new year labels |
| `hd1`, `hd175`, hail reports | keep the columns but they are near zero outside the mountains and the far north; lead with rain days, wind gust days (Santa Ana, Diablo, atmospheric river) and heat days | New ZIP columns |
| `fema` per 100 homes | OpenFEMA IHP for California disasters | Same structure |
| `seas` "camps and seasonal homes" | second homes (Tahoe, Big Bear, the desert, the coast) | Same ACS table; drop the word "camps" |
| Spanish, Vietnamese, French at home | Spanish, Chinese, Vietnamese, Tagalog, Korean | The parish fields `viet`, `french` and the label must change together |
| `cbp_roof`, `lic` (LSLBC records by city), `adjusters`, `ins_agents` | County Business Patterns NAICS 238160; CSLB C-39 licences by county; the same ZBP counts | CSLB publishes a licence master file, so `lic` can be exact rather than mirrored |
| gap list (8219 to 8223) | rewrite: California does have public reroof permit feeds in many cities, CAL FIRE damage inspection points and the Department of Insurance's wildfire and FAIR Plan data by ZIP | The "no public dataset" claims are weaker in California |

---

# Module 12 · Service Lines (`24_m12_lines.js`, lines 8238 to 8458)

## 12.1 What it is for and what it shows

The module treats a roofing company as eleven businesses and gives each its own map, volume, jobs open to marketing, gross profit pool, season, rules, keywords, competitors and bid modifiers. One line is selected at a time; everything on the page follows it. The numbers come from three places: the precomputed ZIP columns `p_<line>` and `r_<line>`, the editable assumptions held in `SLM.A` (`09_sl_model.js`, lines 2120 to 2190, stored in `localStorage` under `up.slm.v1`), and the line registry `PL` (`04_content.js`, lines 1209 to 1350).

The section opens with three helpers used by modules 05, 07, 08, 09 and 12 (8242 to 8253):

- `LINE_TIER(pct)`: A+ at 95 or more, A at 85, B at 65, C at 40, D at 15, otherwise E.
- `TIER_BID`: A+ +30, A +20, B +10, C 0, D −20, E −50 (percent).
- `lineTargets(k)`: for every scored ZIP, `pool`, `cases`, `fees` from `SLM.zipLine`, `rate = z['r_' + k]`, `eff = fees ÷ max(0.3, z.cpc_rel or 1)`; `pct` is the percentile rank of `eff` among scored ZIPs (share of ZIPs strictly below), and `tier` and `bid` follow.
- `lineCities(k)`: per city, sums of `pool`, `cases`, `fees` over its ZIPs, plus `city.comp`, `city.roofers`, and `span = 100 × city.span ÷ city.pop`.
- `LINE_FIRMS(k)`: competitors whose `lines` include `k`.

User visible structure, in order:

| Element | Lines | What it shows |
|---|---|---|
| Masthead | 8260 to 8263 | Dek ("A Louisiana roofing company is eleven businesses that share a crew yard..."); facts (the eleven lines, scored ZIPs, grades, "Assumptions stored in this browser"); actions ↓ Line targets CSV, ↓ City pages CSV, Campaign Desk ↗, Site Forge ↗. |
| Callout "Read this first" | 8265 | Defines volume, jobs open to marketing and the gross profit pool, and names the source of each line. |
| Line picker | 8304 | Eleven buttons (`PL[].name`). |
| KPI row | 8305 to 8319 | Jobs a year (grade of the line, with `PL.unit`); Jobs open to marketing (D); Gross profit pool a year (D, "ticket × margin"); Cost per sold job (D); Return on paid (D); Peak month (season grade); Largest parish. |
| Controls | 8268 to 8273 | Map metric (per 10,000 residents, jobs a year, gross profit pool, paid target tier); region; parish; find a ZIP or city (placeholder "70001 or Houma"). |
| Map and legend | 8301, 8320 to 8333 | ZIPs with 500 or more residents shaded in eight quantile classes; the legend prints the line's grade and its full `what` text; tier view uses fixed colours. |
| Detail card | 8351 to 8378 | No ZIP selected: jobs a year in scope, per 10,000, "half of them in N of M ZIPs", ZIPs and pool by tier, "What the line counts". ZIP selected: jobs a year, rate against the parish rate, paid percentile, jobs open to marketing, pool, relative click cost, click, lead and sold job costs, bid modifier, mapped roofers within 25 km and competitive pressure, "What drives this line here" (the line's own ZIP facts), a Spanish build callout when `span_sh ≥ 8`, links to modules 01, 02 or 17, and 08. |
| Table "Paid targets for this line" | 8334 to 8338 | ZIP, City, Jobs, Per 10k, Pool, Pct, Tier, Bid. |
| Card "The line in law" | 8282, 8393 | The `LAWX` items named in `PL[k].law`, each with title, grade, citation link, effective date and summary. |
| Card "Unit economics and assumptions" | 8283, 8394 to 8402 | Editable: jobs open to marketing (%), default ticket ($), click cost multiplier, click to lead (%), lead to sold job (%); for all lines: base cost per click ($), gross margin (%), monthly budget ($). Apply and Reset. A judgment call callout listing every default ticket. |
| Table "SEO page targets for this line" | 8285, 8379 to 8389 | City, Parish, Residents, ZIPs, Jobs a year, Open to marketing, Pool, Mapped roofers nearby, Spanish at home, Page plan. |
| Card "Keywords, negatives and angles" | 8287, 8403 to 8408 | `PL[k].kw`, `kwEs`, `neg`, `NEG_COMMON` (line 1354) and the copy angles filled by `fillCopy` (1357). |
| Card "Competitive pressure on this line" | 8288, 8409 to 8411 | Mapped companies that market the line, by reach, with cities and line counts. |
| Card "The year, line by line" | 8290, 8413 to 8417 | Heat table of `SLM.SEA` (12 months × 11 lines, 100 = an average month) with a grade per row. |
| Card "Portfolio: where a month of media should go" | 8292, 8419 to 8423 | The monthly budget split across lines and months. |
| Card "The eleven lines side by side" | 8293, 8424 to 8426 | Horizontal bars of the statewide pool per line. |
| Card "Dayparting templates" | 8295, 8427 to 8430 | Three templates by six hour blocks, plus a row of storm reports by hour as an index. |
| Cards "How the lines are built", "Judgment calls and caveats" | 8297 to 8298, 8431 to 8440 | `PL[].what` for all eleven lines; six caveats. |
| Footer | 8441 | "Lines resolved to N scored ZIPs. Defaults are placeholders; assumptions you change are stored in this browser and flow to modules 01, 05, 08, 09 and 15." |

Exports: `louisiana-<line>-zip-targets.csv` (8449; columns `zip, city, parish, residents, jobs_a_year, per_10k, jobs_open_to_marketing, gross_profit_pool, relative_cpc, percentile, tier, bid_modifier_pct`); `louisiana-<line>-city-pages.csv` (8450; `city, parish, residents, zips, jobs_a_year, jobs_open_to_marketing, gross_profit_pool, mapped_roofers_nearby, spanish_at_home_pct, page_plan, suggested_h1`, the H1 from `FCOPY.AC[line].h1`). Hand offs: the 25 best ZIPs to the Desk (8451), the 12 best cities to the Forge (8452).

## 12.2 Data contract

### The formulas every line shares

| Quantity | Formula | Where | Status |
|---|---|---|---|
| Pool (jobs a year at a ZIP) | ZIP column `p_<line>` | data | precomputed; recipes per line below |
| Rate | ZIP column `r_<line>`: jobs per 10,000 residents, "shrunk toward the parish rate for small ZIPs (prior of 2,500 residents)" (line 2184). The form `(p + 2,500 × parish rate) ÷ (pop + 2,500) × 10,000` reproduces the column with a median error of 0.6 percent; a few ZIPs differ by 40 percent or more, so the pipeline's parish rate is not exactly `parish.p ÷ parish.pop` | data | inferred |
| Probability, called "jobs open to marketing" | `rep` = share of the line's jobs "a contractor wins through search, ads, referrals or the door" (8397). Default `META.model.REP[line]`; `cases = pool × rep` | `SLM.zipLine`, line 2172 | stated; an assumption, "the most uncertain number on the page" (8435) |
| Price, called "default ticket" | `val` = average invoice per job. Default `META.model.VAL[line]` | 2147 to 2161 | stated; "round planning numbers chosen by judgment, not measured" (8400) |
| Margin | `fee` = gross margin, one value for all lines. Default `META.model.FEE` = 0.33 | 2148 | stated |
| Fee, called "gross profit pool" | `fees = cases × val × fee = pool × rep × val × fee`; `rev = cases × val` | 2172 | verified: ZIP column `f_<line>` = `p × REP × VAL × FEE` to within rounding (largest difference $77); ZIP `fees` = Σ `f_*`; ZIP `cases` = Σ `p × REP` |
| State totals | `META.pools[line]` = Σ `p` over all 534 ZIPs (= Σ over parishes); `META.cases` = `pools × REP`; `META.fees` = `cases × VAL × FEE`; `META.fees_tot` = 705,313,938 | data | verified |
| Click cost | `cpc = A.cpc × cpcMul × z.cpc_rel` (1 when no ZIP is given); `A.cpc` default $38 | `SLM.blended`, 2170 | stated; grade D |
| Lead and sold job cost | `cpl = cpc ÷ (cvr ÷ 100)`; `cps = cpl ÷ (close ÷ 100)` | 2170 | stated |
| Return on paid | `roi = (val × fee) ÷ cps` | 2170 | stated |
| Paid tier and bid | percentile of `fees ÷ max(0.3, cpc_rel)` among scored ZIPs → `LINE_TIER` → `TIER_BID` | 8246 to 8248 | stated: "A+ is the top 5% of scored ZIPs (bid +30%), A the next 10% (+20%), B the next 20% (+10%), C 25% (0), D 25% (−20%), E the bottom 15% (−50%)" (8323) |
| Page plan for a city | `cases ≥ 50` "City page + landing page"; `≥ 15` "City page"; `≥ 5` "Section on the parish page"; else "Parish page mention"; " · Spanish page" when `span ≥ 8` | 8379, 8387 | stated |
| Budget split across lines | weight of line in month `m` = `(fees × SEA[line][m] ÷ 100 ÷ max(1, cpc))^alpha`; each month's budget is shared in proportion; `alpha` default 1.2, budget default $15,000 | 8419 to 8421 | stated |
| Budget split across ZIPs | weight = `(fees ÷ max(0.3, cpc_rel))^alpha` | `SLM.allocate`, 2175 | stated |

### Constants per line

`pool`, `cases`, `fees` are `META.pools`, `META.cases`, `META.fees`. `REP`, `VAL`, `GRADE`, `TIER` and `W` are in `META.model` (`TIER` and `W` are index weights used by module 01, not here). `cpcMul`, `cvr`, `close` are typed in `SLM.DEF` (2150 to 2160). The last four columns are computed here from the defaults (base click $38, margin 33 percent, relative cost 1.0).

| Line | Pool (jobs a year) | REP | Cases | VAL ($) | Fees ($ a year) | Grade (`PL.g` = `GRADE`) | cpcMul | cvr % | close % | Click $ | Lead $ | Sold job $ | Margin per job $ | Return |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| replace | 39,080.0 | 0.84 | 32,827.2 | 15,500 | 167,911,222 | B | 1.00 | 9 | 25 | 38.00 | 422 | 1,689 | 5,115 | 3.0× |
| repair | 40,113.0 | 0.55 | 22,062.1 | 950 | 6,916,478 | B | 0.65 | 12 | 55 | 24.70 | 206 | 374 | 314 | 0.8× |
| storm | 81,550.6 | 0.80 | 65,240.5 | 8,500 | 182,999,499 | B | 1.25 | 12 | 30 | 47.50 | 396 | 1,319 | 2,805 | 2.1× |
| hail | 11,722.3 | 0.85 | 9,963.9 | 9,500 | 31,236,896 | C | 1.20 | 10 | 28 | 45.60 | 456 | 1,629 | 3,135 | 1.9× |
| fortified | 9,000.0 | 0.95 | 8,550.0 | 19,000 | 53,608,500 | C in `PL`, D in `GRADE` | 0.55 | 8 | 35 | 20.90 | 261 | 746 | 6,270 | 8.4× |
| metal | 12,157.7 | 0.88 | 10,698.8 | 26,000 | 91,795,834 | D | 0.75 | 7 | 20 | 28.50 | 407 | 2,036 | 8,580 | 4.2× |
| mh | 20,622.1 | 0.72 | 14,847.9 | 5,500 | 26,948,910 | C | 0.45 | 11 | 35 | 17.10 | 155 | 444 | 1,815 | 4.1× |
| mf | 1,151.8 | 0.65 | 748.6 | 60,000 | 14,823,092 | C | 0.80 | 5 | 15 | 30.40 | 608 | 4,053 | 19,800 | 4.9× |
| comm | 6,640.4 | 0.55 | 3,652.2 | 85,000 | 102,444,542 | D | 1.10 | 5 | 12 | 41.80 | 836 | 6,967 | 28,050 | 4.0× |
| coat | 2,400.0 | 0.50 | 1,200.0 | 40,000 | 15,840,000 | D | 0.70 | 6 | 18 | 26.60 | 443 | 2,463 | 13,200 | 5.4× |
| newc | 11,888.7 | 0.25 | 2,972.2 | 11,000 | 10,788,965 | B | 0.50 | 4 | 10 | 19.00 | 475 | 4,750 | 3,630 | 0.8× |

The one grade disagreement in the data: `PL.fortified.g` is `'C'` (line 1264) while `META.model.GRADE.fortified` is `'D'`. The module prints the `PL` grade.

Other `META.model` constants the lines rest on (`ANCH`): `fort` 9,000 (FORTIFIED reroofs a year), `cru` 80,000 (commercial roofs), `hail` [0.0022, 0.004] (share of roofs damaged per 1 inch hail day and per further 1.75 inch day), `wind` [0.0003, 0.0015, 0.0025] (the "stated rates" for thunderstorm wind and tornado days; the order of the three is not labeled anywhere in the HTML, presumably 58 mph wind days, 75 mph wind days, EF1 tornado days), `metal` 0.12, `coat` 0.03, `leak` 0.55, `mh` 0.0258834, `M2020` 3.6 (FEMA multiplier from 2020 on). `DMG` is the damage curve: `smax` 0.5214, `v50` 69.72 kt, `w` 7.263 kt, `n` 2,055 ZIP and storm pairs, `M` 2.0 roofs per FEMA registration, `rho` 0.731.

### Seasons (`SLM.SEA`, lines 2132 to 2144) and their grades (`SEA_G`, 2145)

100 is an average month. Four rows are computed from the data, seven are typed "planning shapes".

| Line | Jan to Dec | Grade | How it is built |
|---|---|---|---|
| replace | 82 86 104 110 110 100 95 95 100 110 106 82 | D | typed |
| repair | 91 80 98 128 127 138 121 110 74 73 72 86 | C | `norm12(RAIN[i] × 0.7 + windN[i] ÷ 100 × 1.5)` |
| storm | 23 20 26 43 58 98 117 181 253 215 126 41 | B | `norm12(lag(0.7 × tropN + 0.25 × windN + 0.05 × tornN))` |
| hail | 40 67 162 245 264 194 101 45 22 19 18 23 | B | `norm12(lag(ts.month.hail))` |
| fortified | 70 70 85 95 105 120 120 115 110 110 100 100 | D | typed ("follows the grant rounds", 8417) |
| metal | same as replace | D | typed |
| mh | 43 42 51 73 92 122 129 159 185 154 97 51 | C | `norm12(lag(0.4 × tropN + 0.4 × windN + 0.2 × 100 × RAIN ÷ 5))` |
| mf | 95 100 105 105 105 100 100 100 100 100 95 95 | D | typed |
| comm | 90 95 105 105 105 100 100 100 105 105 100 90 | D | typed |
| coat | 80 85 100 110 115 110 105 105 105 105 95 80 | D | typed |
| newc | 90 90 105 105 105 105 100 100 100 100 100 100 | D | typed |

Inputs: `norm12(a)` rescales to mean 100 and rounds (2127); `lag(a)[i] = 0.40 × a[i] + 0.35 × a[i−1] + 0.25 × a[i−2]` (2128: "storm events spread over the month they happen and the two after"); `tropN = norm12(ts.trop_month + 0.2)`, `windN = norm12(ts.month.wind)`, `tornN = norm12(ts.month.torn)` (2130); `RAIN = [5.4, 4.6, 4.6, 4.9, 5.1, 6.1, 5.9, 5.6, 4.6, 4.1, 4.2, 5.0]`, "Louisiana statewide normal precipitation, inches (NOAA 1991 to 2020, rounded)" (2131). The computed rows above are what the shipped data gives.

### Dayparting (`SLM.DAYPARTS`, 2124; blocks 2122)

Blocks: 12a to 6a, 6a to 9a, 9a to 12p, 12p to 5p, 5p to 9p, 9p to 12a. Bid adjustments in percent, "assumptions until account actuals replace them": `emergency` (storm, repair, mh) +10 +15 +15 +10 +15 +5; `retail` (replace, hail, fortified, metal) −40 0 +15 +10 +15 −10; `b2b` (comm, coat, mf, newc) −60 +5 +25 +20 −20 −50. The line to template map is at 2165. The module adds a data row (8428): the share of `ts.hour` hail, wind and tornado reports in each block divided by the block's share of the day, which for Louisiana is 0.56, 0.55, 0.69, 1.65, 1.61, 0.74.

### The ZIP facts shown per line (`lineRows`, 8340 to 8350)

| Line | ZIP columns shown |
|---|---|
| replace | `roofs`, `ra20_sh`, `wave`, `ra_med`, `yrs64`; `own_sh`, `mort_sh`, `value` |
| repair | the age row, plus `pre80_sh`, `yb_med` |
| storm | `n64_00`, `hur64`; `fema_k`, `fema_rate`; `wd50`, `td1`; the age row |
| hail | `hd1`, `hd175`, `hd1_10`; `ev_h1`, `ev_h175`; the age row |
| fortified | age, owner and wind rows |
| metal | age and owner rows, plus `hh100k_sh`, `metal_sh` |
| mh | `mh`, `mh_sh`; the wind rows |
| mf | `mf5u`, `apts`; the wind rows |
| comm | `cru`, `whse`, `mfg`, `retail`, `church`; the wind and hail rows |
| coat | the commercial row |
| newc | `yb20`, `yb20 + yb10`; `builders`, `supply` |

The selected ZIP panel also reads `zip`, `city`, `pop`, `cpc_rel`, `comp_n25`, `comp_pct`, `span_sh`, the parish `name`, `pop` and `p_<line>` (for the parish rate, 8366). The KPI row reads parish `p_<line>` for "Largest parish" (8308).

### Each line: what it counts, how the dashboard says it was built, and what the shipped numbers show

Where a formula below is marked verified or fitted, it was recovered by least squares on the ZIP columns of `la_atlas_data.json`; "largest error" is in jobs a year at one ZIP.

**`replace` · Roof replacement** (short label "Replace", campaign token `REPLACE`, grade B, segment `res`; line 1210).

- Unit counted (line 1210): "roofs on one to four unit homes reaching the end of their life in the next twelve months (age driven, not storm driven; metal and FORTIFIED counted in their own lines)"
- Method as printed (`what`, line 1211): "A renewal model of every one to four unit home by decade built (ACS 2020 to 2024, tables B25034 and B25127). Each roof wears out on a Weibull life with a 22 year mean and shape 3, calibrated to the 2023 American Housing Survey rate of roofing projects not paid by insurance, by year built, in the South (model 3.7 to 4.2 percent a year against 3.5 to 4.4 observed), and is reset by every storm that reached the ZIP since 1950: FEMA verified roof and wind damage where FEMA has it, the best track wind footprint elsewhere. The line is the expected age driven replacements over the next twelve months."
- Shipped numbers, verified: `p_replace = nxt × (1 − metal_sh ÷ 100) − 0.70 × p_fortified`. Least squares over the 508 ZIPs with roofs gives coefficients 0.99994, −0.99897 and −0.70027, R² 1.000000, largest error 0.39. So the metal share of the age driven replacements moves to the metal line, and 70 percent of the FORTIFIED pool is taken out of this line.
- `nxt` is the cohort model's output (section 17.3): Σ over ages of roofs × the Weibull hazard at that age, plus the 2 to 4 unit homes at 0.354 roof per home (fit 1.0015 and 0.354, R² 0.99996).
- Constants: `META.model.WB` (`L` 22, `k` 3, `rho` 0.015), `REP` 0.84, `VAL` 15,500. "The replacement ticket sits above the American Housing Survey median of $10,000 for a professional roof job in the West South Central states on purpose, because that median mixes partial jobs and repairs with full reroofs" (8400; `META.ahs.wsc_med`).

**`repair` · Roof repair and leaks** (short label "Repair", campaign token `REPAIR`, grade B, segment `res`; line 1224).

- Unit counted (line 1224): "roof leak repairs a year on one to four unit homes handled by a paid roofer"
- Method as printed (`what`, line 1225): "The 2023 American Housing Survey rate of roof leaks in the last twelve months, by decade built and by owner and renter (South: 2.0 percent for homes built since 2020 up to 8.5 percent before 1940), times the homes in each decade of the ZIP, times 55 percent fixed by a paid roofer rather than the owner or a handyman (assumption, grade D)."
- Shipped numbers, fitted (R² 0.99996, largest error 4.6): `p_repair = Σ over decades of c_d × homes built in the decade × (roofs + mf24) ÷ hu`, with `c_d` = 0.0447 (1939 or earlier), 0.0401 (1940s), 0.0393 (1950s), 0.0279 (1960s), 0.0280 (1970s), 0.0168 (1980s), 0.0189 (1990s), 0.0175 (2000s), 0.0134 (2010s), 0.0111 (2020 or later). Dividing by 0.55 gives leak rates of 8.1, 7.3, 7.1, 5.1, 5.1, 3.0, 3.4, 3.2, 2.4 and 2.0 percent, which is the printed range (the owner and renter mix of each ZIP moves the top end).
- Constants: `META.model.ANCH.leak` 0.55 (assumption, grade D), `REP` 0.55, `VAL` 950. `META.ahs.wsc_leak` (4.14 percent of West South Central homes with a leak in the past year) is the regional figure shown in module 17.

**`storm` · Storm and wind damage** (short label "Storm", campaign token `STORM`, grade B, segment `res`; line 1237).

- Unit counted (line 1237): "roofs a year needing a roofer after wind (hurricanes, tropical storms, thunderstorm wind, tornadoes), long run average, replacements and repairs"
- Method as printed (`what`, line 1238): "Every Atlantic storm from 1950 to 2025 rebuilt as a sustained wind footprint at each ZIP from the HURDAT2 best track wind radii (a modified Rankine profile before 2004). FEMA roof damage registrations from Katrina, Rita, Gustav, Ike and Isaac fix the damage curve: the share of roofs replaced rises on a logistic curve with a 52 percent ceiling, a 70 knot midpoint and a 7.3 knot width, at two roofs replaced per FEMA registration (grade D multiplier); Spearman 0.73 between wind and FEMA damage across 2,055 ZIP storm pairs. Repairs short of replacement and thunderstorm wind and tornado days within 25 miles (SPC 1996 to 2025) add at stated rates (grade D). Metal reroofs are carved out."
- Shipped numbers: the pool is 81,551 jobs a year. Summing `dmgShare(kt) × roofs` over the storms present in `zstorm` and dividing by 76 years gives 22,353 replacements a year, which is a floor, because `zstorm` holds only the storms from 1992 on and the method runs from 1950. The thunderstorm and tornado term at the `ANCH.wind` constants (0.0003, 0.0015, 0.0025 against `wd50`, `wd65`, `td1`) gives 6,912 a year. The rest is "repairs short of replacement" and the pre 1992 storms. A free regression on the wind replacement rate, `hur64`, `hur50`, `ts34`, `wd50`, `wd65`, `td1` and the FORTIFIED pool reaches R² 0.996 but its coefficients do not read as a recipe, so this line cannot be rebuilt from the HTML alone: the repair rates per wind band are not printed anywhere.
- The line is net of metal: every fit improves when the exposure is multiplied by `(1 − metal_sh ÷ 100)`.
- Constants: `META.model.DMG` (the damage curve, with `M` 2.0 and `ANCH.M2020` 3.6 as the FEMA multipliers), `ANCH.wind`, `REP` 0.80, `VAL` 8,500.
- Validation printed in module 01 (line 5205) and held in `META.model.val`: `n` 292 ZIPs, `rho_clim` 0.618 (hurricane history to 2019 against later FEMA damage), `rho_wind` 0.771 (the wind footprint of each 2020 to 2024 storm against the FEMA damage verified later).

**`hail` · Hail damage** (short label "Hail", campaign token `HAIL`, grade C, segment `res`; line 1251).

- Unit counted (line 1251): "roofs a year with hail damage needing a roofer (60 percent replacements)"
- Method as printed (`what`, line 1252): "SPC hail reports, 1996 to 2025: days a year with hail of 1 inch or larger within 25 miles of the ZIP (median 1.9) and days with 1.75 inch hail or larger. Each 1 inch day damages 0.22 percent of roofs and each 1.75 inch day a further 0.40 percent (assumption, grade D: the point chance a swath crosses a roof). Reports cluster where people live, so rural hail is undercounted; the recent decade (2016 to 2025) is shown beside the 30 year rate."
- Shipped numbers, fitted (R² 0.9995, largest error 4.0): `p_hail = (1 − metal_sh ÷ 100) × (roofs + mf24 ÷ 3) × (0.00219 × hd1 + 0.00454 × hd175)`. The first coefficient is the stated 0.22 percent; the second fits at 0.45 percent, not the stated 0.40, so the pipeline's second term is slightly larger than the text says, or uses an input the dashboard does not carry.
- Constants: `META.model.ANCH.hail` [0.0022, 0.004], `REP` 0.85, `VAL` 9,500. The unit says 60 percent of these jobs are replacements; that split is not used anywhere in the dashboard.

**`fortified` · FORTIFIED roofs** (short label "FORTIFIED", campaign token `FORT`, grade C, segment `res`; line 1264).

- Unit counted (line 1264): "FORTIFIED Roof reroofs a year, grant funded and owner paid"
- Method as printed (`what`, line 1265): "Statewide anchor of 9,000 a year: 2026 funding of about $80 million for the Louisiana Fortify Homes Program and $20 million for Restore ROOF at $10,000 a grant, less administration, plus owners who pay for FORTIFIED themselves (grade C). Apportioned by owner occupied single family homes likely to be insured (mortgage share), roofs 15 years or older, coastal parishes (1.6 times) and hurricane frequency. Only FORTIFIED certified roofers can install grant roofs."
- Shipped numbers: Σ `p_fortified` = 9,000.0 = `META.model.ANCH.fort` = `META.fort.anchor`. A log linear fit of the ZIP column (R² 0.94, without the coastal flag, which is not in the data) gives elasticities of 1.02 on owner occupied one unit roofs (`roofs × own_sh`), 0.25 on `mort_sh`, 0.29 on `ra15_sh` and 0.60 on `hur64`. The list of coastal parishes that get the 1.6 multiplier is not in the HTML.
- 70 percent of this pool is subtracted from the replacement line (verified, see `replace`).
- Constants: `META.fort` = `grant` 10,000, `round26` 3,000 (the June 2026 lottery round), `lfhp26` 80,000,000, `restore26` 20,000,000, `total26` 100,000,000, `anchor` 9,000; `REP` 0.95, `VAL` 19,000.

**`metal` · Metal roofing** (short label "Metal", campaign token `METAL`, grade D, segment `res`; line 1277).

- Unit counted (line 1277): "metal reroofs a year on one to four unit homes, whatever the trigger (age, wind or hail)"
- Method as printed (`what`, line 1278): "12 percent of residential reroofs statewide (assumption, grade D), tilted toward rural ZIPs (1.6 times under 300 residents per square mile, 0.6 times over 1,500) and higher income; carved out of the replacement, storm and hail lines so nothing is counted twice. Steel mill producer prices rose 23 percent in the year to August 2026, so quotes age faster than shingle quotes."
- `metal_sh` (ZIP column, percent), fitted (R² 0.986): `ln(metal_sh) = −0.293 + 0.459 × [density < 300] − 0.506 × [density > 1,500] + 0.244 × ln(inc)`. The two density multipliers are e^0.459 = 1.58 and e^−0.506 = 0.60, the stated 1.6 and 0.6; the income elasticity is about 0.24. The roof weighted state mean of `metal_sh` is 12.5 percent (12.2 percent weighted by `nxt`), the stated 12 percent.
- `p_metal`: the carve out from replacement is exactly `metal_sh × nxt` (Σ = 6,310 of the 12,158 pool). The remaining 5,847 fits `metal_sh × (0.52 × gross storm jobs + 0.11 × gross hail jobs)` with R² 0.992, where gross means the line's pool divided by `(1 − metal_sh)`. Read that as: about half of storm jobs and a small part of hail jobs are treated as reroofs that can go metal.
- Constants: `META.model.ANCH.metal` 0.12, `REP` 0.88, `VAL` 26,000. The steel price sentence in `what` is typed text (23 percent in the year to August 2026), not computed.

**`mh` · Manufactured home roofs** (short label "Mobile home", campaign token `MH`, grade C, segment `res`; line 1290).

- Unit counted (line 1290): "manufactured home roof jobs a year (roof overs, recovers, coatings and storm repairs)"
- Method as printed (`what`, line 1291): "Mobile homes (ACS B25024) times 2.6 percent a year professional roofing projects (2023 American Housing Survey, South: 3.58 percent a year less 27.7 percent done by the owner) plus wind damage at 1.3 times the site built rate per unit of wind. Mobile homes are not eligible for Fortify Homes grants."
- Shipped numbers: `META.model.ANCH.mh` = 0.0258834 = 0.0358 × (1 − 0.277), from `META.ahs.s_mh_rate` 3.58 and `s_mh_diy` 27.7. After removing `0.0258834 × mh`, the remainder fits `1.01 × mh × (p_storm ÷ ((1 − metal_sh) × roofs))` with R² 0.979 (largest error 46): mobile homes take wind damage at about the site built storm job rate of the same ZIP. The printed "1.3 times" must apply to a narrower base than the whole storm line.
- Constants: `REP` 0.72, `VAL` 5,500 (`META.ahs.s_mh_med` is 5,100).

**`mf` · Multifamily, condo and HOA** (short label "Multifamily", campaign token `MF`, grade C, segment `com`; line 1302).

- Unit counted (line 1302): "roof replacements a year on apartment, condo and association buildings of five or more units"
- Method as printed (`what`, line 1303): "Buildings estimated from units in structure (7, 14, 30 and 80 units a building for the ACS size classes) and renewed on a 22 year low slope life with storm resets, plus wind damage at 80 percent of the residential replacement rate. Association boards and property managers buy on bids, reserve studies and references."
- Shipped numbers: the pool is 1,151.8 a year against 235,791 homes in buildings of five or more units. The ACS size classes behind "7, 14, 30 and 80 units a building" are not in the ZIP table (only the total `mf5u`), so the column cannot be re-derived here; a regression on `mf5u`, wind and `apts` reaches only R² 0.94.
- Constants: 22 year life, 80 percent of the residential wind rate (both stated in `what`, neither stored in `META`); `REP` 0.65, `VAL` 60,000.

**`comm` · Commercial roof replacement** (short label "Commercial", campaign token `COMM`, grade D, segment `com`; line 1314).

- Unit counted (line 1314): "commercial roof replacements a year (low slope membranes and metal buildings), age and storm driven"
- Method as printed (`what`, line 1315): "80,000 commercial roofs statewide (the CBECS 2018 national building count scaled by population, grade C), apportioned by ZIP Code Business Patterns 2023 establishments weighted by building type (plants and warehouses 0.8 to 0.9 a roof each, retail 0.55, offices 0.25, churches 1.0), replaced on a 22 year cycle plus wind damage at 70 percent of the residential rate and hail at 30 percent."
- Shipped numbers: Σ `cru` = 80,000 (`META.model.ANCH.cru`). Fitted (R² 0.9998, largest error 2.3): `p_comm = cru × (0.0427 + 0.61 × residential storm job rate + 0.34 × residential hail job rate)`, the rates being the line pools divided by `(1 − metal_sh) × (roofs + mf24 ÷ 3)`. Holding the first term at 1 ÷ 22 = 0.0455 gives 0.59 and 0.18. The stated recipe is a 22 year cycle, wind at 70 percent and hail at 30 percent of the residential rate.
- `cru` itself: establishments by type times a roofs per establishment weight (stated: plants and warehouses 0.8 to 0.9, retail 0.55, offices 0.25, churches 1.0), scaled to 80,000. A regression of `cru` on the twelve establishment columns reaches R² 0.992, and 0.9993 when total establishments (`est`) is added, so every establishment carries a base weight and the named types add to it.
- Constants: `REP` 0.55, `VAL` 85,000.

**`coat` · Restoration, coatings and maintenance** (short label "Coatings", campaign token `COAT`, grade D, segment `com`; line 1327).

- Unit counted (line 1327): "commercial roofs restored, coated or put on a maintenance agreement a year"
- Method as printed (`what`, line 1328): "Three percent of the commercial roof stock a year (assumption, grade D) on the same building estimate as the commercial line. Restoration fits roofs that are sound but aging; it competes with replacement and is often bought by facility managers on a budget cycle."
- Shipped numbers, verified: `p_coat = 0.03 × cru` at every ZIP (the ratio runs 0.028 to 0.032 from rounding); the pool is 2,400 = 0.03 × 80,000.
- Constants: `META.model.ANCH.coat` 0.03, `REP` 0.50, `VAL` 40,000.

**`newc` · New construction roofing** (short label "New build", campaign token `NEWC`, grade B, segment `com`; line 1339).

- Unit counted (line 1339): "new roofs a year on newly permitted buildings (builder subcontract work)"
- Method as printed (`what`, line 1340): "Census Building Permits Survey, 2023 to 2025 average by parish (every residential building authorized), apportioned to ZIPs by homes built since 2020 and, at 35 percent weight, since 2010 (ACS). Builder work is won on price, schedule and relationships, so it is reached through builder associations and estimating, not search ads."
- Shipped numbers, verified: the state pool 11,888.7 is the mean of `ts.permits[2023..2025][2]` (11,653, 12,482 and 11,531 buildings). Within a parish the ZIP share is `(yb20 + 0.35 × yb10) ÷ Σ` of the same over the parish's ZIPs (median error 0.002 jobs). The parish total is the Building Permits Survey count of buildings, which the shipped parish array does not fully carry: `parish.bps[year]` is `[units in one unit buildings, all units, a small building count]`, and one unit plus that count matches `p_newc` only where few 2 to 4 unit buildings are built (Orleans: 395 against 228).
- Constants: `REP` 0.25, `VAL` 11,000.

### Method and caveat text printed by the module (the record of the judgment calls)

- 8265: "A line counts roofing jobs a year at each ZIP (the volume), the share an owner gives to a contractor found through search, ads, referrals or the door (jobs open to marketing), and those jobs times a default ticket times a 33% gross margin (the gross profit pool). ... Every default below is a placeholder until it is replaced with your own job history: change it and every module updates."
- 8329 (legend): "Eight quantile classes across N scored ZIPs; gray means fewer than 500 residents."
- 8400: "Tickets are round planning numbers chosen by judgment, not measured ... Click costs are graded D until account actuals arrive (module 15)."
- 8417: "Storm work follows the hurricane season with a lag ... Hail jobs follow the spring hail by a month or so ... Repairs follow rain and thunderstorm wind ... Replacement, metal and coating rows are planning shapes for the drier, milder months; FORTIFIED follows the grant rounds. A flat row means no seasonal evidence was found, not that the line has none."
- 8423: the budget is "split by gross profit pool × season ÷ cost per click, raised to 1.2 (above 1 concentrates money in the strongest lines)".
- 8426: "the market's gross profit, not one company's. Storm is a long run average over 75 years of storms; a real year is either quiet or enormous."
- 8430: "Owners find the damage that evening or the next morning, so the emergency template keeps bids up from early morning to late evening ... Replace every template with the hour report from your accounts (module 15) after 60 days."
- 8434 to 8439: "Every line is counted at the ZIP of the building ... Camps and seasonal homes count where they stand"; "The share of a line's jobs a contractor wins ... is an assumption; the rest go to repeat contractors, insurer programs, handymen or the owner"; "The gross profit pool is the whole market's margin at the defaults, not one company's share"; "Paid tiers rank ZIPs against each other for one line"; "Metal and FORTIFIED reroofs are carved out of replacement, storm and hail; mobile homes and buildings of five or more units count only in their own lines"; "The storm line is the average year over 75 years of storms".

## 12.3 Louisiana specific content in module 12

| Lines | What | Text or value to find |
|---|---|---|
| 8256 | description | "Eleven roofing lines resolved to the ZIP ..." (neutral, but the eleven lines are Louisiana's) |
| 8260 | dek | "A Louisiana roofing company is eleven businesses that share a crew yard. Replacements come due as roofs age, in waves set by the hurricanes that reroofed whole parishes at once; storm and hail work arrives in bursts after the weather; ... FORTIFIED roofs ride a grant drawn by lottery; metal, mobile home, multifamily, commercial, coating and new construction work each has its own buyer and season." |
| 8261 | facts | the list of lines, with "FORTIFIED" and "mobile home" |
| 8265 | callout | "storm from every storm's modeled winds and the damage curve fitted to FEMA registrations; hail from the hail record; ... FORTIFIED from the state grant program" |
| 8270 to 8272 | controls | "All nine regions", "All 64 parishes", "Parish", placeholder "70001 or Houma" |
| 8282, 8393 | law card | "What Louisiana and federal rules do to this line's ads, contracts and jobs."; "Read October 5 and 6, 2026 from the enrolled acts, legis.la.gov, the LSLBC and eCFR ... confirm with a Louisiana lawyer" |
| 8288, 8410 | competitor card | "Mapped Louisiana roofing companies that market this line" |
| 8290, 8417 | season card | "the storm record by month"; "Storm work follows the hurricane season with a lag"; "FORTIFIED follows the grant rounds" |
| 8301, 8317, 8354 to 8355, 8365 to 8367, 8384 | parish wording | "{parish} Parish", "Largest parish", "Louisiana" as the default scope name, "in {parish} Parish", column "Parish" |
| 8342 | age row | "years since hurricane force winds", "none since 1950" |
| 8344 | wind rows | "Hurricane force storms since 2000 · chance a year"; "FEMA roof and wind registrations · per 100 homes"; "Damaging wind days a year · tornado days" |
| 8345 | hail rows | "Hail days a year, 1 inch+ · 1.75 inch+ · recent decade"; "Hail reports in the ZIP ..." |
| 8348 | mobile home row | "Mobile homes · share of homes" |
| 8375 | Spanish callout | "with the license number and the office city in Spanish too"; threshold 8 percent (also 8387) |
| 8376 | link choice | lines `storm`, `hail`, `mh` link to the Storm Ledger; the rest to Roof stock |
| 8379 | page plan | "Section on the parish page", "Parish page mention" |
| 8400 | ticket note | "the West South Central states" |
| 8408 | copy warning | "Avoid ... \"hurricane proof\" in copy unless a named source or the written warranty backs it (La. R.S. 51:1405), and never offer claim help or anything toward a deductible (R.S. 37:2159.1, R.S. 51:451)." |
| 8426, 8439 | storm average | "75 years of storms" |
| 8427 | template names | "Replacement, hail, FORTIFIED and metal (planned purchase)" |
| 8429 to 8430 | hour row | "NOAA storm reports by hour"; "Hail, damaging wind and tornado reports run ..." |
| 8434 | caveat | "Camps and seasonal homes" |
| 8441 | footer | "Uplift Louisiana Roofing Atlas, module 12" |
| 8449 to 8450 | exports | file names `louisiana-<line>-zip-targets.csv`, `louisiana-<line>-city-pages.csv`; header `parish`; notes "Uplift Louisiana Roofing Atlas, module 12" |
| 1209 to 1350 (outside my range, printed here) | `PL` | every line's `name`, `unit`, `what`, `law` ids, copy angles (for example "Licensed Louisiana roofer", "Most Louisiana shingle roofs wear out near 20 years", "Every reroof in Louisiana needs a permit", "Check our LSLBC license", "Louisiana law requires a good faith itemized estimate", "Ask how the Louisiana Fortify Homes grant of up to $10,000 works", "A Roof Built for Louisiana", "Hurricane Rated Roof Systems", "Reemplazo de techos con licencia en Luisiana"), keywords ("hurricane roof damage", "blue tarp roof", "louisiana fortify homes program", "fortified roof louisiana", "subvencion techo luisiana") |
| 1354 (outside) | `NEG_COMMON` | the neighbouring states as negative keywords: "texas", "mississippi", "arkansas", "alabama", "florida" |
| 1357 to 1361 (outside) | `fillCopy` | defaults "Louisiana", "LSLBC license " + number, "LSLBC license number" |
| 2131 (outside) | `RAIN` | "Louisiana statewide normal precipitation, inches (NOAA 1991 to 2020, rounded)": 5.4, 4.6, 4.6, 4.9, 5.1, 6.1, 5.9, 5.6, 4.6, 4.1, 4.2, 5.0 |
| 2148 to 2160 (outside) | `SLM.DEF` | base click $38, budget $15,000, and the per line click multipliers, conversion and close rates: assumptions tuned to this market |
| data | `META.model.REP`, `VAL`, `FEE`, `ANCH`, `DMG`; `META.pools`, `cases`, `fees`; `META.fort`; `META.ahs` | all Louisiana or West South Central figures |

## 12.4 What a California edition of module 12 needs

The screen is line agnostic: it reads `PL`, `SLM` and the `p_`, `r_` columns by key. The work is in choosing the lines and rebuilding each pool. `LINE_KEYS`, `RES_LINES` and `COM_LINES` are typed at lines 593 to 595, and the ZIP table carries four columns per line (`p_`, `r_`, `z_`, `f_`), so changing the number of lines changes the column count, the 11 × 11 `META.model.corr`, and the weights `W`.

| Louisiana line | Does California have it? | What to put in its place, and from what data |
|---|---|---|
| `replace` (age driven, cohort model) | Yes, and it becomes the dominant line | Same cohort model without hurricane resets (section 17.5). Calibrate the life to the AHS Pacific division or the California metro samples (Los Angeles, San Francisco, Riverside, San Jose have their own AHS samples, which Louisiana lacks). Tile roofs are common in the south: the tile outlives its underlayment, so a second life curve for "lift and relay" is worth a column. Ticket well above $15,500 |
| `repair` (AHS leak rate × 55 percent) | Yes | Same recipe with Pacific leak rates. The season inverts: leaks follow the wet months, November to March |
| `storm` (hurricane footprints and the FEMA damage curve) | No hurricanes. A smaller wind and rain line exists | Rebuild from NOAA Storm Events (High Wind, Strong Wind, Heavy Rain, Debris Flow, Thunderstorm Wind), station gust days above a threshold (Santa Ana and Diablo events, atmospheric rivers), and FEMA registrations for the 2023 and later winter storm disasters. No `dmgShare` curve; rates per wind day are assumptions, as `ANCH.wind` is here |
| `hail` | Hardly: reports are rare outside the mountains and the far north | Reuse the slot for wildfire: roofs damaged or destroyed by fire a year (CAL FIRE damage inspection points, annualized by ZIP) and the rebuilds that follow |
| `fortified` (IBHS standard plus a state lottery grant) | No | A fire hardened roof line: Class A assemblies and ember resistant vents in Fire Hazard Severity Zones, driven by Chapter 7A, Safer from Wildfires insurer discounts, nonrenewals and FAIR Plan take up. Anchor: no single statewide count exists; candidates are FAIR Plan policies by ZIP and insurer nonrenewals by ZIP from the Department of Insurance, and the California Wildfire Mitigation Program's retrofit counts |
| `metal` (12 percent of reroofs, rural and higher income tilt) | Yes, smaller, growing in fire country | Re-assume the share; tilt by fire zone and snow country rather than by rural density alone |
| `mh` | Yes: California has several hundred thousand mobile homes, many in parks under state (HCD) rather than local permitting | Same recipe with Pacific AHS rates; note the different permit authority |
| `mf` | Yes, larger | Same recipe; add the balcony and exterior elevated element inspection laws as a driver if the law register covers them |
| `comm` | Yes | Same recipe (CBECS scaled by population, ZBP weights). Wind and hail add ons shrink; Title 24 cool roof rules for low slope reroofs change the product |
| `coat` | Yes | Same 3 percent assumption; cool roof coatings are the Title 24 compliant version |
| `newc` | Yes | Same Building Permits Survey recipe. New homes carry solar under the energy code, so the buyer is a builder who also needs a solar ready roof |
| (none) | Solar | Detach and reset of rooftop solar during a reroof is a California sized line with its own buyer and price; it could take a twelfth key or sit as an angle under `replace` |

Other inputs to replace: `RAIN` (California's wet winter and dry summer; one statewide vector is a poor fit, so consider north and south), `ts.month` and `ts.trop_month` (no tropical month vector; use fire starts by month and high wind days by month), the dayparting row from `ts.hour`, `SLM.DEF` click costs (Los Angeles and the Bay Area are far more expensive than New Orleans), every `VAL`, and `NEG_COMMON` (neighbour states become Nevada, Oregon, Arizona). `META.ahs` must be re-pulled for the Pacific division: `wsc_rate`, `wsc_diy`, `wsc_med`, `wsc_mean`, `wsc_ins`, `wsc_leak`, `s_mh_rate`, `s_mh_diy`, `s_mh_med`, `vint` are all named for the West South Central division and the South.

---

# Module 13 · Competitor Watch (`25_m13_watch.js`, lines 8461 to 8579)

## 13.1 What it is for and what it shows

A ledger of what the mapped competitors say and where they buy: ads seen in the Meta Ad Library and the Google Ads Transparency Center, claims on their sites, signs, mailers, television, Spanish pages, review counts. Every claim is screened by the Satchel rule pack (house style off). The ledger lives in this browser (`localStorage` key `up.watch.v1`) and travels as CSV or JSON. The logic is `WATCH` in `10_watch_core.js` (lines 2202 to 2359); module 13 is the screen.

User visible structure, in order:

| Element | Lines | What it shows |
|---|---|---|
| Masthead | 8470 to 8473 | Dek: "... It starts seeded with the companies' own site titles and descriptions as read on October 6, 2026." Facts: companies tracked, the two libraries, storage, lint. Actions: ↓ Ledger CSV, ↓ Ledger JSON, ↓ Sweep checklist, ⤒ Import, Satchel ↗, Campaign Desk ↗. |
| Callout "Read this first: what the ledger is and is not" | 8475 | What each ad library shows and does not show. |
| KPI row | 8505 | Companies tracked (verified sites); Observations (seeded); Live ads on record (by platform); Companies with entries; Claims tripping a rule; Last sweep. |
| Card "What they are doing right now" | 8477, 8506 | The digest sentences from `WATCH.digest()` (2342 to 2352). |
| Card "The watchlist" | 8479, 8507 to 8511 | Filters (reach: statewide, national, regional, local; find). Table: Company (with "listing" for unverified and "you" for the user's own company), Reach, HQ, Lines, Live ads, Checked, Pressure. |
| Company panel | 8512 to 8532 | Library links (Meta active, Meta all, Meta page, Google transparency by domain, advertiser, Search, Site); Meta page ID and Google advertiser ID fields; buttons Save IDs, Checked today, Screen in the Satchel, Field map; "Lines marketed · offices"; the company's ledger (up to 12 entries with the rules each trips); the form to log an observation (kind, platform, status, first and last seen, format, service line, claim type, hook, language, text, URL, notes; 8533 to 8535). |
| Card "Bring things in" | 8483, 8559 to 8560 | Paste a Meta Ad Library API JSON response, library links or a ledger CSV; buttons Import, Reseed site claims, Clear seeded rows. |
| Card "Meta Ad Library API bridge" | 8484, 8561 to 8566 | Search terms (default "roof replacement louisiana"), page IDs, access token, delivered since; Run, Copy request URL, Open in a new tab. |
| Charts | 8487 to 8492, 8537 to 8546 | Share of voice on record (live ads per company, top 12); Ads logged by week and platform (26 weeks, stacked Meta, Google and YouTube, Other); Claims on record by type; Hooks; Lines. |
| Card "Coverage: companies × service lines" | 8494, 8547 | Heat table: a dot where the company's site markets the line, a number where live ads serve it; a last row "Companies marketing the line". |
| Card "Uncontested value" | 8496, 8548 to 8550 | Per line: gross profit pool a year, companies marketing, live ads on record, pool per company. |
| Card "Sweep planner" | 8497, 8552 to 8556 | Company, Every (days), Since check, Overdue. |
| Cards "How the watch is built", "Library facts to keep in mind" | 8500 to 8501 | Four and four entries. |
| Footer | 8503 | "Uplift Louisiana Roofing Atlas, module 13. The ledger is research on public advertising; competitor names and claims are quoted as published." |

Exports: `competitor-watch-ledger_<date>.csv` and `.json` (8569 to 8570; CSV header `WATCH.CSV_H`, line 2289: `id, competitor, competitor_key, kind, platform, status, first_seen, last_seen, format, service_line, claim_type, claim_text, hook, cta, landing_url, geo, zips, language, meta_library_id, meta_page_id, google_advertiser_id, google_creative_id, snapshot_url, text, notes, source, review_count, review_rating, lint`); `competitor-sweep_<date>.csv` (8571).

## 13.2 Data contract

### The roster: `DATA.comp` (29 companies)

`WATCH.COMPANIES` (line 2208) maps each `comp` row to `{key: slug(name), i, name, domain, url, tier, hq, cities, offices, lines, verified, spanish, title, desc, h1, social, notes, asof}`.

| `comp` field | Meaning | Used for |
|---|---|---|
| `name`, `domain`, `url` | company and site | the key, matching imports (domain first, name second: `matchCompany`, 2275), library links |
| `hq` | head office city | the table, the search link |
| `tier` | reach: `statewide`, `national`, `regional`, `local` | filter, the pressure score, the sweep cadence |
| `seg` | `res`, `comm`, `both` | not read in module 13 |
| `lines` | the service line keys the site markets | coverage table, "Companies marketing the line", `LINE_FIRMS` in module 12 |
| `verified`, `asof` | whether the site was read, and when (27 of 29 verified, all on 2026-10-06) | the "listing" pill; the seed date |
| `cities` | service cities the site lists | table search; sweep CSV |
| `offices` | `[{city, lat, lon, hq}]` | office count in the score; region membership in module 11 |
| `title`, `desc`, `h1` | the site's own title, meta description and H1 as read | seeded as "Site title and description: ..." claims (2229 to 2239) |
| `spanish` | Spanish pages on the site (false for all 29) | a seeded signal; +6 in the score |
| `notes` | analyst note | seeded as a claim only when it matches `/calls itself|slogan|moniker|big truck/i` |
| `phone`, `social`, `fin`, `cert` | phone, social profiles, financing shown, manufacturer certifications claimed | not read in module 13 |

### Derived quantities (all in `WATCH`)

| Quantity | Formula | Line |
|---|---|---|
| live | `status === 'active'`, or status unknown on an ad seen within 60 days | 2324 |
| activity | per company, count of non seeded live ads last seen within 120 days, in total and by line | 2325 |
| pressure score | tier weight (statewide 30, national 24, regional 14, local 6) + min(40, 6 × live ads) + 5 × platforms with a live ad + 6 if Spanish + min(10, offices) + 4 if any insurance claim is on record | 2327 to 2328 |
| sweep cadence | 14 days if a live ad is on record; else 30 (statewide, national), 90 (regional), 180 (local) | 8553 |
| inferred line, claim type, hook | keyword tests on the text (`inferLine` 2219, `inferOffer` 2221, `inferHook` 2222); the line test knows `fortified`, `hail`, `mobile home`, `storm|hurricane|wind|tarp` and so on | |
| lint | `satchelLint(text, {platform, web, page, noHouse: true})`, notes dropped, rule ids kept | 2310 |
| uncontested value | per line: Σ over scored ZIPs of `SLM.zipLine(z, line).fees` (so it follows the module 12 assumptions), divided by the number of companies whose `lines` include it | 8548 |

ZIP columns read: only `p_<line>` for the eleven lines, through `SLM.zipLine` over `ZR`. `META.compiled` gives the roster date (2203). Nothing else of the atlas data is read.

The Meta Ad Library bridge (`metaApiUrl`, 2256 to 2266) builds `https://graph.facebook.com/<version>/ads_archive` with `ad_reached_countries=["US"]`, `ad_type=ALL`, `ad_active_status=ACTIVE`, `search_terms`, `search_page_ids`, `ad_delivery_date_min` and the fields in `API_FIELDS.base` (2255); default version `v21.0` (2225). It runs only outside the Claude viewer and with a token.

Verified digest facts the module prints for Louisiana, so the California roster can be checked the same way: 29 companies; 27 verified; tiers 2 statewide, 3 national, 16 regional, 8 local; segments 12 both, 9 residential, 8 commercial only; none with Spanish pages; 10 show financing and 7 name a manufacturer certification; companies marketing each line: replace 21, repair 21, storm 18, hail 8, fortified 7, metal 12, mh 0, mf 2, comm 25, coat 8, newc 5. No `notes` field matches the slogan pattern, so the seed is site titles and descriptions only.

## 13.3 Louisiana specific content in module 13

| Lines | What | Text or value to find |
|---|---|---|
| data `comp` | the roster | Garcia Roofing (Prairieville), Hargrove Roofing & Construction (Shreveport), Brown's Roofing (Monroe), Bayou Roofing (Many), Premier South Roofing & Sheet Metal (Baton Rouge), Vinyltech Roofing (Kenner), Gulf Coast Construction & Restoration (Mandeville), Lifetime Roofing (Baton Rouge), 225 Roofers (Baton Rouge), Roofs Restored (Hammond), Magnolia Roofing (Mandeville), Ibos Roofing (Covington), Gerdes Roofing (New Orleans), Schwander Hutchinson Roofing (New Orleans), Orleans Sheet Metal Works & Roofing (New Orleans), Burford Roofing and Construction (Lafayette), Roof Kings of Louisiana (Broussard), Pelican Roofing Company (Youngsville), Seegers Roofing & Remodeling (Shreveport), Patriot Roofing & Construction (Shreveport), 318 Construction (Monroe), CentiMark (Baton Rouge), Nations Roof (Scott), Roofing Solutions (Baton Rouge), Carriere-Stumm (New Orleans), Coleman Roofing & Construction (Gonzales), RYCARS Construction (Kenner), Ace Roofing (Lafayette), Guardian Roofing Systems (New Orleans); with their domains, offices, cities, site titles and notes |
| 8470 | dek | "as read on October 6, 2026"; "yard signs, door hangers, truck wraps" |
| 8484 | API default | search terms "roof replacement louisiana" |
| 8500 | method | "Each verified company's site title and description, Spanish pages and notable slogans as read on October 6, 2026" |
| 8503 | footer | "Uplift Louisiana Roofing Atlas, module 13" |
| 8507 to 8511 | reach filter | the tier name "statewide" |
| 8550 | note | "Mapped companies are the ones on the roster; many small roofers market no line online at all." (neutral) |
| 2203 (outside) | roster date fallback | `'2026-10-06'` |
| 2219 to 2222 (outside) | inference keywords | `fortified|fortify|ibhs`, `hurricane`, "FORTIFIED and grants" as a hook, `\bgaf\b|owens corning|certainteed|master elite|platinum` |
| 2215 to 2216 (outside) | taxonomies | claim type "Certification or FORTIFIED claim"; hooks "FORTIFIED and grants", "storm response", "hail" |
| 2250 to 2251 (outside) | search links | `name + ' ' + (city || 'Louisiana') + ' roofing'` |
| 2274 (outside) | name normalizer | strips the words `louisiana` and `la` from company names before matching |
| 2345 (outside) | digest sentence | "Louisiana bars contractors from advertising claim handling or policy interpretation and from offering anything toward a deductible, so read those pages closely (module 10)." |
| 2354 to 2355 (outside) | export notes | "Competitor Watch ledger, Uplift Louisiana Roofing Atlas ..."; `atlas: 'Uplift Louisiana Roofing Atlas, module 13'` |

## 13.4 What a California edition of module 13 needs

- **A new roster.** Nothing carries over. California is several separate markets, so 29 companies will not cover it; plan for a roster per region (a few statewide and national commercial firms, then the leaders of each metro). The same fields are needed, read from each company's own site on a stated date: `name, domain, url, hq, tier, seg, lines, verified, asof, cities, offices[{city, lat, lon, hq}], title, desc, h1, spanish, fin, cert, social, phone, notes`. Sources with a California equivalent: the CSLB licence search (C-39 holders by city, with status), Google Business Profiles, manufacturer contractor directories.
- **Tier names.** "statewide" means little in California; a company that covers Southern California or the Bay Area is the practical top tier. The tier names are used as keys in three weight tables (`TW` at 2327, `tw` at 8409, the cadence at 8553) and in module 07.
- **Spanish.** No Louisiana competitor has Spanish pages; many California roofers will, so the `spanish` signal and the "Spanish service" claim type will carry real counts. Consider a `languages` list instead of one flag.
- **Line keys.** `inferLine`, `OFFERS` and `HOOKS` name FORTIFIED, hail and hurricane; replace with the California lines (fire hardening, cool roof, solar detach and reset, tile) and their keywords.
- **Digest sentence at 2345** and the search link default at 2250 need the state swapped; the name normalizer at 2274 should strip `california` and `ca`.
- Everything else (ledger, importers, the Meta bridge, charts, sweep planner, exports) is state neutral.

---

# Module 14 · Storm Desk (`26_m14_weather.js`, lines 8581 to 8730)

## 14.1 What it is for and what it shows

The Storm Desk reads a weather forecast for one point in each region and turns it into two clocks: a **storm trigger index** (hours when hail, damaging wind or tropical weather may damage roofs, which set ads and bids for the 72 hours after) and a **work window** (which daylight hours crews can tear off, do repairs, or must stay off roofs). The reader and all the arithmetic are `NWSX` in `11_nws_core.js` (lines 2371 to 2458); module 14 is the screen. A snapshot taken on October 6, 2026 is embedded as `window.__NWS_SNAPSHOT__` (line 560) so the desk works offline; a Refresh button pulls live data when the page runs outside the Claude viewer.

User visible structure, in order:

| Element | Lines | What it shows |
|---|---|---|
| Masthead | 8590 to 8593 | Eyebrow "Module 14 · Storm Desk · nine forecast points, one per region". Facts: forecast source, outlooks, triggers (grade C), snapshot. Actions: ↻ Refresh from NWS, ↓ Storm windows CSV, ↓ Work days CSV, Campaign Desk ↗, Storm Ledger ↗, Accounts ↗. |
| Callout "Read this first: the storm trigger index and the work window" | 8595 | The full definition of both measures (quoted in 14.2). |
| Snapshot banner | 8596, 8636 | "Live forecast" or "Embedded snapshot" with the read time in Central time and the source string. |
| KPI row | 8642 to 8650 | Active alerts (A); Tropical outlook (A: the first system's 7 day formation chance, or the count of active Atlantic storms, or "Quiet"); Severe outlook today (A: the highest SPC day 1 category over any parish and how many parishes are at it); Storm trigger windows (C: counts high and elevated across the points); Highest trigger, next 72 hours (C); Full production days ahead (C); Crew calendar (a holiday in the forecast period, or "No holiday"). |
| Card "Tropical outlook" | 8598, 8659 to 8665 | Systems parsed from the NHC outlook text with 48 hour and 7 day formation chances; active storms with class and wind in mph (eastern Pacific storms flagged "no Louisiana effect expected"); a "What to do with it" paragraph; the raw outlook text. |
| Controls | 8599 to 8600 | Forecast point (nine buttons from `NWSX.PTS0`); map layer (SPC day 1, day 2, day 3, trigger peak by region). |
| Map and legend | 8621 to 8624, 8652 to 8656 | Parishes filled by SPC category (six colours) or by the region point's 72 hour trigger peak (three colours: under 1.4, 1.4 to 2.0, 2.0 or more); the nine points as diamonds. Hover on a parish: region, SPC outlook, trigger peak. Hover on a point: trigger peak, current conditions, three work day verdicts. |
| Detail card | 8666 to 8677 | For the selected point: the trigger now and its level, temperature, rain chance, gusts and work window; "Storm windows ahead" (six); "Work days ahead" (six); "Action" (one of three texts by the worst window, plus a tear off note); "Hour blocks for the bid lift" (the emergency dayparting template, or the observed hours from module 15); a button that sends the region's 25 scored ZIPs with the largest `p_storm + p_hail` to the Desk. Subtitle: region, NWS office, grid cell and forecast zone. |
| Card "The next four days, hour by hour" | 8605, 8678 to 8689 | Line chart of the trigger index over 96 hours with lines at 1.4 (elevated) and 2.0 (high) and night shading; a one row strip of the work window by hour (good, marginal, blocked, night); a bar chart of the chance of rain; a note naming the peak hour. |
| Table "Storm windows and actions, every region" | 8607, 8690 to 8693 | Point, Date, Hours, Peak, Level, Next 72h bid, Why. |
| Table "Work days, every region" | 8608, 8694 to 8696 | Point, Date, Call, Good, Marginal, Blocked, Why. |
| Card "Active alerts for Louisiana" | 8611, 8697 to 8700 | Each alert with severity, end time, hail size and gust, areas, and the standing roofing action; when there are none, the table of standing actions (`NWSX.ALERT_MAP`). |
| Table "Seven day forecast" | 8612, 8701 | Period, Temp, Rain, Wind, Forecast for the selected point. |
| Table "Observations" | 8615, 8702 | Station, Temp, Wind, Gust, Visibility, Sky, Time (Central). |
| Card "When storms make roofing work" | 8616, 8707 to 8712 | Stacked bars of hail, damaging wind and tornado reports by month, and a note naming the peak months and the tropical cyclone months. |
| Card "Forecast discussion" | 8618, 8703 to 8706 | One button per office in the snapshot, labeled "New Orleans and Baton Rouge" (LIX), "Lake Charles" (LCH), "Shreveport" (SHV), "Jackson" (JAN); the discussion text. |
| Card "Method and sources" | 8619, 8713 to 8718 | Five method entries and four source rows. |
| Footer | 8620 | "Forecasts from the National Weather Service, the Storm Prediction Center and the National Hurricane Center; the trigger index and the work window are planning tools, not predictions about any roof." |

Exports: `louisiana-storm-trigger-windows.csv` (8722; `NWSX.scheduleCSV`, 2452 to 2455: columns `campaign, point, region, date, start_hour, end_hour, storm_level, bid_adjustment_pct_next_72h, peak_storm_index, reasons`, campaign named `LA_STORM_GOOGLE_<REGION NAME>`); `louisiana-roofing-work-days.csv` (8723; `point, region, date, call, good_hours, marginal_hours, blocked_hours, reasons`).

## 14.2 Data contract

### What is read live, and from where

`NWSX.refresh` (2439 to 2451) runs only outside the Claude viewer. It makes these calls and nothing else:

| Call | Per | What is kept |
|---|---|---|
| `https://api.weather.gov/points/{lat},{lon}` (2442) | each of the nine points | `properties.gridId` (the forecast office), `gridX`, `gridY`, `forecastZone` (last path segment, the public zone), `county` (the county zone), `radarStation`, and the three URLs below |
| `properties.forecast` (2443 to 2444) | point | `updateTime`; 14 periods: `name`, `startTime`, `endTime`, `isDaytime`, `temperature`, `shortForecast`, `probabilityOfPrecipitation.value`, `windSpeed`, `detailedForecast` cut to 300 characters |
| `properties.forecastHourly` (2445) | point | the first 120 hourly periods: `startTime`, `temperature`, `relativeHumidity.value`, `probabilityOfPrecipitation.value`, `windSpeed`, `shortForecast`, `isDaytime` |
| `properties.forecastGridData` (2446) | point | the first 72 values of `probabilityOfThunder`, `quantitativePrecipitation`, `windGust`, `windSpeed`, `probabilityOfPrecipitation`, `visibility` as `[validTime, value]`; and `weather`, each value flattened to a string such as `thunderstorms, rain_showers:light` or with attributes in brackets (`[damaging_wind|large_hail]`) |
| `https://api.weather.gov/alerts/active?area=LA` (2448) | state | per alert: `id`, `event`, `severity`, `urgency`, `headline`, `description` (1,500 characters), `instruction` (800), `onset`, `ends`, `expires`, `areaDesc`, `sent`, `parameters.maxHailSize[0]`, `parameters.maxWindGust[0]` |

A refresh replaces only `fetched`, `source`, `points` and `alerts` (2449). **The station observations, the forecast discussions, the NHC outlook and active storms, and the SPC outlooks by parish are never fetched by the page.** They exist only in the embedded snapshot, built by the offline pipeline, and after a live refresh they are still the snapshot's. The method card nevertheless lists them as sources (8714 to 8715).

### The nine points (`NWSX.PTS0`, line 2374; region map `REGOF`, line 2373) with what the snapshot recorded

| Point | Lat, lon | Region | Office (`gridId`) | Grid x,y | Forecast zone | County zone | Radar |
|---|---|---|---|---|---|---|---|
| New Orleans | 29.9511, −90.0715 | 1 | LIX | 68,88 | LAZ077 | LAC071 | KHDC |
| Baton Rouge | 30.4515, −91.1871 | 2 | LIX | 25,109 | LAZ048 | LAC033 | KHDC |
| Lafayette | 30.2241, −92.0198 | 4 | LCH | 105,95 | LAZ044 | LAC055 | KLCH |
| Lake Charles | 30.2266, −93.2174 | 5 | LCH | 60,94 | LAZ241 | LAC019 | KLCH |
| Shreveport | 32.5252, −93.7502 | 7 | SHV | 74,69 | LAZ001 | LAC017 | KSHV |
| Monroe | 32.5093, −92.1193 | 8 | SHV | 134,69 | LAZ014 | LAC073 | KSHV |
| Alexandria | 31.3113, −92.4451 | 6 | LCH | 88,143 | LAZ028 | LAC079 | KPOE |
| Houma | 29.5958, −90.7195 | 3 | LIX | 43,72 | LAZ096 | LAC109 | KHDC |
| Hammond | 30.5044, −90.4612 | 9 | LIX | 52,112 | LAZ081 | LAC105 | KHDC |

Three forecast offices cover the nine points: New Orleans and Baton Rouge (LIX, at Slidell), Lake Charles (LCH) and Shreveport (SHV). The snapshot's `source` string also names Jackson (JAN), which serves the far northeast parishes, but no point resolves to it and the snapshot carries no JAN discussion.

### Structure of `window.__NWS_SNAPSHOT__` (line 560; `la_nws_snapshot.json`)

| Key | Shape | Content |
|---|---|---|
| `fetched` | string | `"2026-10-06T05:42:39+00:00"` |
| `source` | string | "api.weather.gov (NWS New Orleans/Baton Rouge LIX, Lake Charles LCH, Shreveport SHV, Jackson JAN offices); NHC; SPC" |
| `points` | 9 objects | `city, lat, lon, office, gridX, gridY, zone, county, radar, updated, periods[14], hourly[120], grid{}` |
| `points[].periods[]` | 14 | `name, start, end, isDay, tempF, short, pop, wind, detail` |
| `points[].hourly[]` | 120 | `t` (local ISO time with offset), `tempF`, `rh`, `pop`, `wind`, `short`, `isDay` |
| `points[].grid` | 7 arrays of `[validTime, value]` | `probabilityOfThunder` (percent), `quantitativePrecipitation` (millimetres), `windGust` and `windSpeed` (kilometres an hour; the code converts with `v ÷ 1.609`, line 2388), `probabilityOfPrecipitation` (percent), `visibility` (metres), `weather` (string). `validTime` is `start/ISO duration`, read by `gridAt` (2387) |
| `alerts` | array (empty in the snapshot) | the alert fields listed above |
| `obs` | 15 objects | `id, lat, lon, time, tempF, visMi, text, windMph, gustMph` for stations KMSY, KNEW, KBTR, KLFT, KLCH, KSHV, KMLU, KAEX, KHUM, KHDC, KASD, KBAD, KARA, KDRI, KTVR |
| `afd` | object keyed by office: `LIX`, `LCH`, `SHV` | `{issued, text}`: the Area Forecast Discussion product (AFDLIX, AFDLCH, AFDSHV) |
| `nhc.storms` | array | `id` (for example `ep182026`), `name`, `cls` (HU, TS, TD, STS, PTC), `intensity` (knots, as a string), `pressure`, `lat`, `lon`, `movement`, `speed`, `updated` |
| `nhc.two` | `{issued, text}` | the Atlantic Tropical Weather Outlook text product (TWOAT, header ABNT20 KNHC) |
| `spc` | keys `"1"`, `"2"`, `"3"` | `{valid: "YYYYMMDDHHMM", levels: {parish FIPS: 0 to 6}}`: the SPC categorical convective outlook for days 1 to 3 "intersected with parish boundaries" (8715). Level names (`SPCL`, 8589): 0 None, 1 General thunder, 2 Marginal, 3 Slight, 4 Enhanced, 5 Moderate, 6 High |

In the snapshot, day 1 has two parishes at level 1 and the rest at 0; days 2 and 3 are all 0; the outlook text carries one system (AL92, 80 percent in 48 hours and in 7 days), which `twoSystems` (8629 to 8633) parses with a regular expression on the phrases "Formation chance through 48 hours...X...N percent" and "through 7 days".

### The storm trigger index (`NWSX.hourly`, 2390 to 2411)

For each hourly period: `pop` from the hourly forecast; `thun` = `probabilityOfThunder` at that hour; `gust` = `windGust` in mph; `wx` = the grid weather string plus the short forecast.

`risk = 1` and then: `+ 0.6 × thun ÷ 100` when `thun ≥ 15`; `+ (gust − 30) ÷ 20` when `gust ≥ 30`; `+ 1.0` when `wx` matches `/large_hail|hail/i`; `+ 0.8` when it matches `/damaging_wind/i`; `+ 1.5` when it matches `/tropical storm|hurricane/i`. Level (2413): high at 2.0 or more, elevated at 1.4 or more, normal at 0.8 or more.

As printed (8595): "The storm trigger index starts at 1.0 and adds for each sign of roof damaging weather in the hourly forecast: thunder probability (up to 0.6), wind gusts above 30 mph (one point for every 20 mph more), hail in the forecast weather (1.0), damaging wind (0.8) and tropical storm or hurricane conditions (1.5). Elevated is 1.4 or more and high is 2.0 or more; the weights are assumptions graded C."

Windows (`windows`, 2415 to 2419): consecutive hours on one date with `risk ≥ 1.4` form a window with `start`, `end`, `peak`, the union of reasons, `level`, and `bid` = 25 when the peak is 2.0 or more, otherwise 15 (percent, applied to the 72 hours after the window).

### The work window (same function, 2401 to 2407) and work days (`workDays`, 2420 to 2424)

Blocked: `pop ≥ 50`, or `thun ≥ 30` ("lightning"), or `gust ≥ 30`. Marginal: `pop ≥ 25`, or `gust ≥ 22`, or heat index 105 or more (`heatIndex`, the Rothfusz regression, 2412, from `tempF` and `rh`). Otherwise good; a good hour after dark is `night`. A day (daylight hours only) is "no tear offs" with 4 or more blocked hours, "repairs and inspections" with 4 or more blocked plus marginal hours, otherwise "full production".

As printed (8595): "The work window marks daylight hours as good, marginal (rain chance of 25 to 49 percent, gusts of 22 mph or more, or a heat index of 105 or more) or blocked (rain chance of 50 percent or more, thunder of 30 percent or more, or gusts of 30 mph or more); a day with four or more blocked hours is a day for no tear offs." Source line (8717): "Common roofing practice and manufacturer guidance: no tear offs with rain likely, lightning nearby or gusts over 30 mph; heat index of 105 or more slows crews (grade C)."

### Other pieces of `NWSX`

- Crew calendar `HOL` (2381): date ranges for Columbus Day weekend, Thanksgiving, Christmas, New Year, Mardi Gras (2027-02-05 to 02-09), Memorial Day weekend, "Hurricane season opens" (2027-06-01), Independence Day, Labor Day weekend, for October 2026 to September 2027.
- Lead clock `BASE` (2384): an assumed share of roofing leads by weekday and hour, normalized to 1.0, "grade D, until account actuals replace it". It is attached to every hour as `base` and `ai` but module 14 does not display it.
- Alert actions `ALERT_MAP` (2426 to 2435): eight patterns (Tropical, Severe storm, Tornado, Flood, Wind, Heat, Freeze, Fog), each with a standing roofing action. The tropical action cites R.S. 29:732, R.S. 37:2159.1, 51:451 and 16 CFR 429.

### Atlas data read by module 14

| Field | Use | Line |
|---|---|---|
| `parish.reg`, `parish.name` (`PAI`), `REGN` | map fill, tooltips, region names | 8622, 8652 |
| ZIP `p_storm`, `p_hail`, `pi`, `zip` over `ZR` | the hand off of 25 ZIPs to the Desk | 8676 |
| `ts.month.hail`, `.wind`, `.torn` | the monthly chart; "Hail reports peak in [month] ..." | 8708 to 8711 |
| `ts.trop_month` | "N tropical cyclones brought modeled tropical storm force winds to Louisiana from 1950 to 2025, most in [three months]" (84 in the data, most in September, August and June) | 8711 |
| `SLM.DAYPARTS.emergency`, `SLM.BLOCKS`, `ACCT.observedGrid()` | hour blocks for the bid lift | 8669, 8674 |

## 14.3 Louisiana specific content in module 14

| Lines | What | Text or value to find |
|---|---|---|
| 8586 | description | "National Weather Service forecasts, SPC and NHC outlooks and alerts for nine Louisiana regions, turned into storm triggers for ads and work windows for crews" |
| 8589 | SPC category names | convective outlook categories (hail, wind and tornado risk) |
| 8590 to 8591 | masthead | "nine forecast points, one per region"; "the Storm Prediction Center's severe weather outlooks by parish and the National Hurricane Center's tropical outlook"; "hail, damaging wind or tropical weather"; "SPC days 1 to 3 by parish, NHC Atlantic"; "thunder, gusts, hail, damaging wind, tropical (grade C)" |
| 8595 | callout | the trigger definition above; "every storm message follows module 10: no claim help, no deductible offers, and prices frozen at pre storm levels during a declared emergency" |
| 8598 | card | "Active storms and the Atlantic tropical weather outlook from the National Hurricane Center" |
| 8611, 8643, 8699 | alerts | "Active alerts for Louisiana"; "none for Louisiana in this read"; "No active NWS alerts for Louisiana in this read" |
| 8616, 8711 | record card | "with the months of Louisiana's tropical cyclones (NHC best tracks)"; "tropical cyclones brought modeled tropical storm force winds to Louisiana from 1950 to 2025"; "Hail reports peak in ..., damaging wind from ... into early summer, and tornadoes in ..." |
| 8618, 8704 | discussion card | "from the New Orleans, Lake Charles and Shreveport offices"; labels `LIX: 'New Orleans and Baton Rouge'`, `LCH: 'Lake Charles'`, `SHV: 'Shreveport'`, `JAN: 'Jackson'` |
| 8620 | footer | "Uplift Louisiana Roofing Atlas, module 14 ... the National Hurricane Center" |
| 8621 to 8623 | map | "{parish} Parish"; hover text |
| 8636, 8702 | time zone | `timeZone: 'America/Chicago'`, the word "Central" |
| 8644 to 8645 | KPI text | "active Atlantic storms"; "no Atlantic system in the outlook"; "parishes at that level, SPC day 1"; "no thunder area over Louisiana" |
| 8655 | legend | "Categories by parish: general thunder, marginal, slight, enhanced, moderate and high risk of severe storms (hail of 1 inch or more, gusts of 58 mph or more, or tornadoes). Uncolored parishes sit outside every outlook area." |
| 8661 to 8663 | tropical card | "No Atlantic system in the outlook."; class names (hurricane, tropical storm, tropical depression, subtropical storm, potential tropical cyclone); "eastern Pacific, no Louisiana effect expected"; "A system in the Gulf with a high formation chance is the time to check tarp and crew capacity, freeze price books at today's levels, line up the storm ad groups in the Campaign Desk without launching them, and keep replacement ads running until a watch is issued. Messages before landfall talk about preparation and capacity, never fear; after it, the Storm Ledger (module 02) shows the footprint as soon as the track is in." |
| 8673 | action text | "run storm inspection and tarp ads in the {region} ZIPs with the most storm exposure and raise storm and hail bids 25% for the 72 hours after it"; "launch inspection ads only where hail of 1 inch or more or gusts of 58 mph or more are reported" |
| 8676 | hand off | ranks ZIPs by `p_storm + p_hail`, line `storm` |
| 8714 to 8718 | method and sources | "alerts for Louisiana with their hail and gust parameters"; "area forecast discussions from LIX, LCH and SHV"; "SPC day 1 to 3 categorical convective outlooks, intersected with parish boundaries; the NHC Atlantic tropical weather outlook and active storms"; "hail 1.0, damaging wind 0.8, tropical 1.5"; "Holiday weekends from the federal calendar plus Mardi Gras and the opening of hurricane season."; "snapshot Oct 6, 2026" (three times); links to weather.gov, spc.noaa.gov, nhc.noaa.gov; "SPC severe report database 1996 to 2025; HURDAT2 best tracks" |
| 8722 to 8723 | exports | `louisiana-storm-trigger-windows.csv`, `louisiana-roofing-work-days.csv` |
| 2373 to 2374 (outside) | points and regions | the nine city names and coordinates in the table above |
| 2381 (outside) | calendar | "Mardi Gras", "Hurricane season opens" |
| 2394 to 2400 (outside) | trigger terms | hail, damaging wind, "tropical storm|hurricane" |
| 2427 to 2434 (outside) | alert actions | "Hurricane|Tropical Storm|Storm Surge" and its action text ("Before landfall ... After it: emergency tarping and inspection ads in the hit ZIPs (module 02 shows the footprint), price books frozen at pre storm levels (R.S. 29:732), no claim help or deductible language (R.S. 37:2159.1, 51:451), three day notice on every sale at the home (16 CFR 429)."); "Lake Wind" in the wind pattern; the freeze action ("attic pipe leaks look like roof leaks") |
| 2448 (outside) | alert query | `alerts/active?area=LA` |
| 2453 (outside) | campaign name | `LA_STORM_GOOGLE_<REGION>` |
| 560 (data) | the snapshot | everything in it: offices LIX, LCH, SHV, zones LAZ..., county zones LAC..., stations, discussions, the Atlantic outlook, SPC levels keyed by Louisiana parish FIPS (22001 to 22127) |

## 14.4 What a California edition of module 14 needs

The arithmetic survives; the weather it listens for does not. California's roofing weather is winter rain and wind from atmospheric rivers, downslope wind events (Santa Ana in the south, Diablo in the north), wildfire and smoke, heat, and mountain snow. Hail, tornadoes and tropical systems are rare.

| Louisiana input | California equivalent | Note |
|---|---|---|
| nine points, one per LDH region | one point per chosen region; `REGOF` and `PTS0` are the only two lines to edit, since office, grid and zone are discovered from the `points` call | Coastal and inland weather differ sharply within a county; consider two points for the Los Angeles basin and the Bay Area |
| offices LIX, LCH, SHV (and JAN) | the offices that cover California: Eureka (EKA), Sacramento (STO), San Francisco Bay Area and Monterey (MTR), Hanford and the San Joaquin Valley (HNX), Los Angeles and Oxnard (LOX), San Diego (SGX), plus the out of state offices that serve border counties: Medford (MFR), Reno (REV), Las Vegas (VEF) and Phoenix (PSR) | The discussion card's label map at 8704 must be rewritten; the snapshot builder must fetch each office's discussion |
| `alerts/active?area=LA` | `area=CA` | Events to map: Red Flag Warning and Fire Weather Watch, High Wind Warning and Wind Advisory, Flood and Flash Flood products, Winter Storm Warning, heat products, Air Quality Alert, Evacuation products. Hurricane, Storm Surge and "Lake Wind" drop |
| SPC convective outlooks by parish (snapshot only) | SPC fire weather outlooks (days 1 and 2) by county, and the Weather Prediction Center excessive rainfall outlook by county | Same structure `{valid, levels: {county FIPS: level}}` with new level names. The convective outlook can stay as a minor layer |
| NHC Atlantic outlook and active storms | nothing equivalent. The eastern Pacific outlook rarely matters (the code already labels eastern Pacific storms as having no effect). Put an atmospheric river outlook in the slot (landfall forecasts and the AR scale) | The `twoSystems` parser and the "Tropical outlook" card and KPI become an "Atmospheric river outlook" |
| trigger weights: thunder, gust, hail, damaging wind, tropical | gust (keep), rain rate or daily rainfall (leaks), a red flag or critical fire weather flag (not roof damage, but the moment for fire hardening messages), heavy snow load in the mountains | New assumptions, still grade C. Read `quantitativePrecipitation`, which is already fetched but unused |
| work window: rain, lightning, gust, heat index 105 | rain and gust keep; heat rules follow the state's outdoor heat standard rather than a heat index of 105; add smoke (AQI) as a blocked or marginal condition; add frost and snow for mountain points | Smoke needs a second source (AirNow), which this module does not read today |
| crew calendar with Mardi Gras and "Hurricane season opens" | federal holidays, plus the opening of the rainy season and the peak fire weeks if wanted | |
| `ts.month` hail, wind, tornado and `ts.trop_month` | monthly counts of high wind and heavy rain reports, and fire starts or acres by month | The record card's sentence at 8711 is written around tropical cyclones |
| `America/Chicago`, "Central" | `America/Los_Angeles`, "Pacific" | 8636, 8702 |
| action texts (tarp ads after a hurricane, R.S. citations) | after a wind and rain event: leak repair and inspection ads; after a wildfire: no solicitation rules and price caps apply, so the action text needs the California citations from the law register | |

---

# Module 15 · Accounts (`27_m15_accounts.js`, lines 8732 to 8921)

## 15.1 What it is for and what it shows

"Every other module estimates. This one measures." (8746). The business connects its own ad and social accounts, or imports the reports they export, and the atlas reads what the campaigns did: spend, clicks, leads and calls by service line, hour and ZIP, against the month's plan. One click then writes the observed click cost, conversion rate and lead costs into the service line model. Connectors, the store of actuals and the arithmetic are `ACCT` in `12_accounts_core.js` (lines 2473 to 2787); module 15 is the screen. Everything is kept in the browser (extension storage or `localStorage` key `cf.accounts.v1`).

User visible structure, in order:

| Element | Lines | What it shows |
|---|---|---|
| Masthead | 8746 to 8748 | Eyebrow lists the sources (Google Ads, Local Services Ads, YouTube, Meta, TikTok, Microsoft Advertising, LinkedIn, Business Profile, imports). Facts: where the page runs, storage, providers, imports. Actions: ↻ Sync connected, ↓ Actuals CSV, ↓ Actuals JSON, ↓ Import template, Storm Desk ↗, Campaign Desk ↗. |
| Environment banner | 8778 to 8786 | One of three: inside the Claude viewer (imports only), opened as a file (pasted tokens and imports), or running as the Chrome or Firefox browser app (with the redirect URL to copy). |
| KPI row | 8788 to 8800 | Accounts connected; Rows of actuals held; Paid spend (30 or 90 days); Leads and calls; Observed against model (blended cost per lead against the model's at the same mix); Model state (assumptions or actuals applied). |
| Card "Connectors" | 8752 to 8753, 8802 to 8831 | A range switch (30 or 90 days) and one card per provider in `ACCT.PORDER` (google, lsa, youtube, meta, tiktok, microsoft, linkedin; line 2528): credential and ID fields, Save, Connect, Test, Sync, Disconnect, "Paste a token instead", "What it covers and how to set it up", scopes. |
| Card "Bring in a report" | 8755 to 8759 | Drop zone, format select (`ACCT.IMPORTERS`, line 2747: Google Ads UI export, Meta Ads Manager, TikTok Ads Manager, Microsoft Advertising, Local Services Ads leads, YouTube Studio, call tracking, generic daily spend and leads), source label, paste box, Import, Template CSV, Clear all actuals, Clear tokens, an import log. |
| Card "Month to date against the plan" | 8761, 8845 to 8851 | Spent this month, daily rate, where the month lands, pace against plan, and spend by platform. |
| Table "Actuals against the model, by service line" | 8763 to 8764, 8853 to 8860 | Line, Spend, Clicks, Leads + calls, CPL actual and model, CPC actual and model, CVR actual and model, Platforms. Buttons Apply actuals to the models, Revert. |
| Chart "Hour of the day" | 8766 to 8767, 8862 to 8870 | Lead share and spend share by hour against a template share; a checkbox "Run the Storm Desk plan on the observed hours". |
| Table "Where the money landed" | 8768, 8872 to 8876 | ZIP, City, Spend, Clicks, Leads, CPL, "Atlas read" (the ZIP's top line and parish). |
| Table "Social and profile" | 8771, 8878 to 8885 | Source, Metric, Last 30 days, Prior 30, Change. |
| Table "Lead log" | 8772, 8887 to 8891 | When, Source, Lead type or campaign, Line, Type, Status. |
| Cards "How the module is built", "Judgment calls", "Source register" | 8774 to 8775, 8893 to 8903 | Seven method steps, seven judgment calls, ten source rows with API versions. |
| Footer | 8776 | "Uplift Louisiana Roofing Atlas, module 15. Actuals beat assumptions..." |

Exports: `actuals_<date>.csv` (8912; `source, kind, date, hour, campaign, adset, zip, region, impressions, clicks, spend, leads, calls, messages, conversions, line, note`), `actuals.json` (8913), `atlas-import-template.csv` (8914; `ACCT.templateCSV`, line 2768).

## 15.2 Data contract

Module 15 reads almost nothing from `__ATLAS_DATA__`. Its data is what the user connects or imports.

| Atlas input | Use | Line |
|---|---|---|
| `ZI[zip]` → `z.city`, `z.cty` (parish name), `z.sl_top` (the ZIP's largest line by pool at current assumptions, set at line 2180 from `p_*`) | the "Atlas read" column of the ZIP table | 8875, `ACCT.byZip` 2776 |
| `PL[].tok` (REPLACE, REPAIR, STORM, HAIL, FORT, METAL, MH, MF, COMM, COAT, NEWC) | mapping a campaign name to a line | `ACCT.lineOf`, 2600 |
| `SLM.LI`, `SLM.A`, `SLM.blended`, `SLM.set`, `SLM.DAYPARTS` | model values beside the actuals; the feedback | 8791, 8856, 2780 |
| Campaign Desk budget | `store.get('cf.desk.v1')` (see section 3, item 3: the key is wrong) | 8846 |

The normalized row every source becomes (`row`, line 2601): `{src, kind ('ads' | 'hour' | 'geo' | 'lead' | 'social'), date, hour, campaign, adset, geo {zip, region}, imp, clicks, spend, leads, calls, conv, msgs, line, note}`.

Derived quantities:

| Quantity | Formula | Line |
|---|---|---|
| line of a campaign | the token after `LA_` if it is a `PL` token (`BLEND` counts as replace); otherwise the first keyword match in this order: fortified, hail, mobile home, multifamily, coating, commercial, new construction, metal, storm (`storm|hurricane|wind|tarp|emergency`), repair, replace (`replace|new roof|reroof|shingle|roof|techo|lsa|local services`); LSA leads default to `repair` | 2600, 2637 |
| by line | over daily paid rows in the range: spend, impressions, clicks, leads, calls, by platform; `cpl = spend ÷ (leads + calls)`, `cpc = spend ÷ clicks`, `cvr = 100 × (leads + calls) ÷ clicks` | `byLine`, 2773 |
| by hour | 24 buckets of spend, clicks, leads, calls; `leadSh`, `spendSh` in percent | `byHour`, 2774 |
| observed dayparts | from 90 days of hourly rows: for each of the six blocks, the mean hourly lead share against the overall mean, as a percentage rounded to 5 and clamped to −50 to +60; returned as seven identical rows | `observedGrid`, 2775 |
| by ZIP | spend, clicks, leads, impressions and `cpl` for rows with a postal code, last 90 days | `byZip`, 2776 |
| pacing | this calendar month: spend, days with rows, `rate = spend ÷ days`, `projected = rate × days in month`, `onPace = spend ÷ (plan × day ÷ days in month)`; ahead above 1.15, behind below 0.85 | `pacing`, 2777; 8845 to 8851 |
| feedback | search CPC = Google plus Microsoft spend ÷ clicks (applied when above $0.20); per line: Google conversion rate when the line has 50 clicks and 3 leads; Meta and LSA cost per lead when 3 leads; written with `SLM.set`, with the previous values kept for Revert | `applyToModels`, 2780 |

Providers and versions (`PROVIDERS` 2498 to 2527, `VERS` 2494): Google Ads API (default v24, probes v25, v24, v23), Local Services API v1, YouTube Analytics v2 and Data v3, Meta Graph (default v26.0, probes v27.0, v26.0, v25.0), TikTok Business API v1.3, Microsoft Advertising Reporting v13, LinkedIn Marketing 202509, Business Profile Performance v1. None of this is state specific.

## 15.3 Louisiana specific content in module 15

The module is close to state neutral. What is not:

| Lines | What | Text or value to find |
|---|---|---|
| 8755 | import card | "Campaign names that carry the desk token (LA_REPAIR_, LA_REPLACE_ and so on) map to lines automatically" |
| 8875 | ZIP table | "outside the twelve counties" (a leftover from another edition; Louisiana has parishes); the parish name as "Atlas read" |
| 8776 | footer | "Uplift Louisiana Roofing Atlas, module 15" |
| 8846 | plan budget key | `cf.desk.v1` (wrong key; the Desk writes `up.desk.v1`) |
| 8863 | template series | `SLM.DAYPARTS.emergency[0]` (reads a number where a row was expected; the series is flat) |
| 8890 | lead log default line | `'repair'` |
| 2600 (outside) | token and keywords | `/LA_([A-Z]+)_/`; keywords `fortified|fortify|ibhs`, `hail`, `hurricane`, `techo` |
| 2764 (outside) | ZIP pattern | `/\b(7[01]\d{3})\b/`: only Louisiana ZIPs are recognized in imports |
| 2768 (outside) | template row | `'2026-10-01', '17', 'LA_REPLACE_META_EN_20261012', '70808'` and the note "(LA_REPLACE_, LA_STORM_, LA_HAIL_, ...)" |
| 2773 (outside) | default line key | `'car'` for a lead with no line (a leftover; it should be `'unmapped'` or `'repair'`) |
| 2476 (outside) | storage key | `cf.accounts.v1` |

## 15.4 What a California edition of module 15 needs

Nothing new has to be sourced; this module carries its own data. Four code fixes are required before it works for California at all:

1. The import ZIP pattern (2764) must accept California ZIPs (`9[0-6]\d{3}`), or better, any five digit code that exists in `ZI`.
2. The campaign token prefix (2600, 2768, 8755) must match what the California Campaign Desk writes (`CA_`), and the token list must follow the California line keys.
3. The keyword fallbacks in `lineOf` should drop `hurricane`, `fortified`, `hail` and add the California lines (fire, cool roof, solar, tile).
4. Fix the three defects listed in section 3 (the `cf.desk.v1` key, the `[0]` on the dayparting template, the "twelve counties" and `'car'` leftovers).

Worth knowing for California: Meta reports by DMA, and California spans about a dozen markets, so Meta figures will be "market wide" per region rather than statewide; LSA lead time zones are already converted per account (`localParts`, 2591), so no time zone constant needs changing here.

---

# Module 16 · Publish (`30_m16_publish.js`, lines 8923 to 9378)

## 16.1 What it is for and what it shows

"The Site Forge writes the pages; this module sends them." (8949). One portable page (title, slug, meta description, language, section markup with a scoped stylesheet, JSON-LD, media slots, internal links) goes to whichever platform the site lives on. The module "codes only against the CMS contract" in `cms/00_cms_core.js` (comment at 8928; `CMS` at line 2813) and renders one card per registered adapter: WordPress with Elementor and WordPress headless (3183, 3214), Drupal (3342), Wix (3597), Duda (3778), Webflow (3945), Shopify (4178), HubSpot (4375), Joomla (4474), Ghost (4597), plus the Next.js headless kit (`cms/19_headless_kit.js`).

User visible structure, in order:

| Element | Lines | What it shows |
|---|---|---|
| Masthead | 8949 to 8951 | Facts: where the page runs, targets loaded, storage, "drafts; publishing live is a separate choice". Actions: ↓ Bridge plugin, ↓ Next.js kit, ↓ Ledger CSV, Site Forge ↗. |
| Environment banner | 9001 to 9006 | Claude viewer (nothing can be sent), opened as a file (CORS limits), or the browser app. |
| KPI row | 9008 to 9019 | Targets (configured and connected); Pages loaded (selected); Pages sent; Last deploy; Target. |
| Card "Where to publish" | 8956 to 8959, 9021 to 9100 | Target select, media host select, and one card per adapter grouped by platform: capability chips (uploads, live urls, site publish, elementor, seo fields, json-ld mode, post types), the adapter's own fields, Save, Test, Publish site, Configure, downloads, Setup steps, Clear (forget credentials, clear ledger). |
| Card "What to publish" | 8961 to 8985 | Three tabs: Site Forge (load the pages module 09 built, with warnings for unresolved media and blocked pages, 9155 to 9175); Composer (title, slug, meta, language, post type, noindex, house style, HTML body, JSON-LD, a starter template, 9177 to 9219); Import (bundle, blueprint, array, or a full HTML document, 9221 to 9254). Then the "Pages loaded" table: select, Kind, Title, Slug, Words, Checks, Media, status on the target, Preview and Remove; and a preview frame. |
| Card "Publish" | 8987 to 8991, 9256 to 9306 | Options (publish live, skip pages already sent, require every image); Deploy, Stop, Verify links, Publish site now; a log; a results table (Page, Status, Link, Edit, Notes). |
| Card "Sent so far" | 8993 to 8994, 9307 to 9313 | The ledger for the target: Slug, Title, Status, Link, Time, Notes; CSV. |
| Cards "How it works", "Judgment calls", "Source register" | 8996 to 8997, 9315 to 9348 | Six method steps, eight judgment calls, eleven source rows (WordPress REST, Elementor, Drupal JSON:API, Wix Data Items, Duda content injection, Webflow Data API, Shopify GraphQL Admin, HubSpot CMS, Joomla Web Services, Ghost Admin, Chrome permissions). |
| Footer | 8998 | "Uplift Louisiana Roofing Atlas, module 16. The Site Forge writes; this module sends. Nothing goes live without a second click, and every credential stays in this browser." |

Exports: `forge-bridge.zip` (9102), `forge-headless-kit.zip` (9103 to 9110), `publish-ledger.csv` and `publish-ledger_<target>.csv` (9363, 9366; columns `target, slug, title, status, ok, link, edit, id, time, notes, error`), `<slug>.html` from the preview.

## 16.2 Data contract

Module 16 reads **no field of `__ATLAS_DATA__`, `META` or the weather snapshot**. Inputs:

| Input | Use | Line |
|---|---|---|
| `MODI.forge.publishPages()` | the built pages as portable pages with their media (`CMS.pageFromForge`), each carrying `label`, `kind`, `checks`, `words`, `lint` | 9155 to 9166 (source at 7883 to 7890) |
| `BRAND.name`, `short`, `phone`, `domain`, `colors` | the starter template, internal link detection, the headless kit's brand | 9107 to 9108, 9189 to 9195 |
| `CMS.*` (`list`, `get`, `cfg`, `setCfg`, `test`, `deploy`, `deployedFor`, `status`, `settings`, `pageFromHtml`, `pageFromBundle`, `pageFromForge`, `fullHtml`, `stripScripts`, `words`, `slug`) | adapters, credentials, the deploy driver and the ledger, stored under `cf.cms.v1` (line 2893) | throughout |
| `FORGE_COMPILE.compile` | compiling an imported blueprint | 9225 |
| `FORGE_BRIDGE_PHP`, `HEADLESS_KIT` | the two downloads | 9102 to 9109 |
| `localStorage` | `cf.publish.loaded` (the slugs last loaded, 9112, 9133), `cf.publish.composer` (the composer draft, 9177) | |

Rules worth keeping: a page whose lint has a BLOCK line is refused by the deploy driver (9173); publishing live needs a second click within six seconds (9268); a page already in the target's ledger is updated in place; an unresolved media slot is dropped unless "Require every image" is ticked.

## 16.3 Louisiana specific content in module 16

| Lines | What | Text or value to find |
|---|---|---|
| 8998 | footer | "Uplift Louisiana Roofing Atlas, module 16" |
| 9108, 9190 | call to action label | "Book a roof inspection" (roofing, not Louisiana) |
| 8971 | language options | `en-US`, `es-US`, `es-MX`, `en-GB`, `fr-CA` (no Louisiana content; California may want `zh`, `vi`, `tl`, `ko`) |
| 9112, 9133, 9177 | storage keys | `cf.publish.loaded`, `cf.publish.composer` (the `cf.` prefix leftover) |

Nothing else. The adapters in lines 2791 to 4986 contain no Louisiana string (checked by search for "Louisiana", "LSLBC", "parish").

## 16.4 What a California edition of module 16 needs

No data and no rewrite. Change the footer, decide the language list, and keep the storage keys as they are or rename them all at once. The pages it sends come from module 09, which is where the California work is.

---

# Module 17 · Roof Stock and Materials (`31_m17_stock.js`, lines 9380 to 9640)

## 17.1 What it is for and what it shows

The module answers "what is on the state's roofs and how old is it". It shows the output of the roof age cohort model (one unit roofs by age, per ZIP), the housing stock by decade built and building type, the commercial roof estimate, the service life the model uses and its check against the American Housing Survey, a materials table, producer prices, what owners spend, the FORTIFIED standard, the code and permit rules for a reroof, and building permits. The model itself is not in the HTML: the dashboard receives its results (`agez`, the `ra*`, `wave`, `nxt` columns, `rhist`) and its constants (`META.model.WB`, `DMG`, `ANCH`), and draws them. Section 17.3 reconstructs the model from those.

Two things run at load, before the module is opened: a map layer `metal_sh` is added to `LAYERS` (9383) and `gammaFn`, a Lanczos gamma function, is defined (9385; module 04's `ageProjection` at line 5945 also calls it).

User visible structure, in order:

| Element | Lines | What it shows |
|---|---|---|
| Masthead | 9407 to 9411 | Dek ("What is on Louisiana's roofs and how old it is..."). Facts: one unit roofs, mobile homes, about N commercial roofs; median year built and share built before 1980; "BLS producer price indexes through [month]"; "Grade A housing counts, B roof ages, D material mix". Actions: ↓ ZIP roof stock CSV; Campaign Desk ↗ (the 25 scored ZIPs in scope with the largest `wave`, line `replace`); Service Lines ↗. |
| Callout "Read this first: roof age is modeled, not recorded" | 9413 | Quoted in 17.3. |
| KPI row | 9455 to 9463 | One unit roofs (A); Median roof age (B, with "the 2020 and 2021 storms pulled it down"); Roofs 20 years or older (B, share, and the count 15 or older); The coming wave (B); Due in the next 12 months (B); Asphalt roofing prices (A, change since January 2020 and year over year); Homes built before 1980 (A). |
| Controls | 9415 to 9419 | Map measure (16 layers), region, parish. |
| Map and legend | 9464 to 9465, 9469 to 9476 | ZIPs with 500 or more residents in eight quantile classes; hover shows the measure, one unit roofs and share 20 or older, aged 15 to 19 and due in 12 months, median year built. |
| Detail card | 9485 to 9514 | Area view: one unit roofs, median roof age, median year built (interpolated from the decade counts), 20 or older and 15 or older, aged 15 to 19 and due, mobile homes and 2 to 4 and 5+ unit homes, commercial roofs, owner occupied homes. ZIP view: the same plus "Last hurricane force winds", the metal share, owners with a mortgage, home value and income, a small roof age chart, and links to modules 01, 02 and 08. |
| Table "Roofs coming due" | 9424, 9477 to 9481 | ZIP, City, Roofs, 20 yrs+, 15 to 19, sorted by the map measure when it is a roof age measure, otherwise by `wave`. |
| Chart "Roof age" | 9427, 9515 to 9521 | Bars for ages 0 to 39 and 40+ for the ZIP, parish, region or state; bars from 15 shade darker and from 20 darkest. The note names the median, the shares 20 or older and 15 to 19, and explains the spikes as storm years. |
| Chart "Homes by decade built" | 9429, 9522 to 9525 | Ten bars, 1939 or earlier to 2020 or later; pre 1980 darker. |
| Chart "What kind of roofs" | 9430, 9526 to 9529 | One unit homes, units in 2 to 4 unit buildings, units in 5+ unit buildings, mobile homes, commercial roofs (estimate). |
| Chart "How long a roof lasts here" | 9433, 9554 to 9557 | Two curves for ages 0 to 40: the share of roofs still on the house, and the chance a roof of that age is replaced in the coming year. |
| Table "The model against the American Housing Survey" | 9434, 9558 to 9561 | Five rows by decade built: AHS 2023 (owners), Model, Gap. |
| Table "Materials and service lives" | 9436, 9562 to 9571 | Eight coverings: typical life, Louisiana notes, grade. |
| Chart "Shingle and steel prices" | 9438, 9572 to 9575 | Two producer price indexes rebased to January 2020 = 100. |
| Card "What owners spend on roofs" | 9439, 9576 to 9582 | Six American Housing Survey figures and a note. |
| Card "FORTIFIED Roof: what the standard adds" | 9442, 9583 to 9590 | Five elements of the standard and "The money in 2026". |
| Table "Code and permits for a reroof" | 9443, 9591 to 9597 | Five rows with a grade. |
| Chart "New homes: building permits" | 9446, 9532 to 9543 | Stacked bars by year: one unit homes and units in 2+ unit buildings, for the state, region or parish; a year to date note. |
| Chart "Commercial roof stock" | 9447, 9544 to 9550 | Establishments by twelve types and the commercial roof estimate. |
| Table "From stock to campaign" | 9449, 9600 to 9608 | Seven plays with a grade. |
| Tables "Caveats", "Method and sources" | 9451 to 9452, 9609 to 9627 | Seven caveats; the method paragraph and eight source rows. |
| Footer | 9628 | "Uplift Louisiana Roofing Atlas, module 17. Housing from the Census Bureau, roof projects from the American Housing Survey, prices from the Bureau of Labor Statistics. Roof ages are modeled. Compiled [date]." |

Export: `louisiana-roof-stock-by-zip.csv` (9632), columns `zip, city, parish, one_unit_roofs, roofs_20_plus, share_20_plus, roofs_15_plus, roofs_15_to_19, due_next_12_months, median_roof_age, median_year_built, built_before_1980_pct, mobile_homes, units_2_to_4, units_5_plus, commercial_roofs_est, metal_share_model, last_hurricane_force_year` = ZIP columns `zip, city, cty, roofs, ra20, ra20_sh, ra15, wave, nxt, ra_med, yb_med, pre80_sh, mh, mf24, mf5u, cru, metal_sh, last64`, for the scored ZIPs in scope.

## 17.2 Data contract (what the screen reads)

### Map layers (`KEYS`, 9390; definitions in `LAYERS`: lines 4998 to 5008 for the roof layers, 5025 to 5027 and 5035 for the rest, and 9383)

| Layer | Label | Grade | Note printed in the legend (the record of how the column was built) |
|---|---|---|---|
| `ra20_sh` | Roofs 20 years or older (% of one unit roofs, model) | B | "The roof renewal model (module 17): homes by decade built, a 22 year Weibull roof life calibrated to the 2023 American Housing Survey, reset by every storm that reached the ZIP. Roof debt: past the age at which most Louisiana shingle roofs fail." |
| `ra15_sh` | Roofs 15 years or older (%, model) | B | "The same model at 15 years, where insurers start asking about roof age." |
| `ra20` | Roofs 20 years or older (count, model) | B | "Roof debt in homes, not percent." |
| `wave` | Roofs aged 15 to 19 (the next five years of replacements) | B | "Roofs that cross 20 within five years: the coming wave, largest where a storm reset many roofs at once 15 to 19 years ago (Katrina, Rita, Gustav, Ike)." |
| `nxt` | Age driven replacements, next twelve months (model) | B | "Expected one to four unit roof replacements from wear alone in the coming year." |
| `ra_med` | Median roof age, years (model) | B | "Half the one unit roofs in the ZIP are younger, half older." |
| `yrs64` | Years since hurricane force winds reached the ZIP | B | "Since the most recent storm with modeled sustained winds of 64 knots or more at the ZIP. A short gap means many young roofs and muted age driven demand." Null prints "none since 1950". |
| `yb_med` | Median year built (ACS) | A | "ACS B25035. Older stock carries older decking, flashing and ventilation." |
| `pre80_sh` | Homes built before 1980 (%) | A | "ACS B25034. On their third or fourth roof; decking and code upgrades come with the job." |
| `roofs` | One unit roofs (detached and attached homes) | A | "ACS 2020 to 2024 units in structure by year built (B25034, B25127), one roof per one unit home." |
| `mh_sh` | Mobile homes (% of housing units) | A | "ACS B25024. The roof over and coating market." |
| `metal_sh` | Metal share of residential reroofs (%, model) | D | "An assumption, not a count: 12 percent statewide, scaled up in rural and higher income ZIPs. No public source records the roof covering on each home." (9383) |
| `cru` | Commercial roofs (estimate) | D | "ZIP Code Business Patterns 2023 establishments weighted by building type and scaled to 80,000 commercial roofs statewide (CBECS 2018 national count by population)." |
| `value`, `own_sh`, `mort_sh` | Median home value; owner occupied; owners with a mortgage | A | ACS B25077, B25003, B25081 |

### Fields and formulas, card by card

| Card | Reads | Formula |
|---|---|---|
| KPI row | `META.roofs`, `mh`, `ra20`, `ra15`, `wave`, `nxt`, `yb`, `yb_med`; Σ ZIP `cru`; `ts.agehist`; `ts.ppi.asph` | `medAge` = first age at which the cumulative `ts.agehist` reaches half (`medOf`, 9392): 7 years for Louisiana. `pre80` = share of the five oldest decades of `META.yb` (stored newest first, reversed at 9401): 46.3 percent. `since20` = last index ÷ the January 2020 index − 1 (+50.8 percent for asphalt, +103.5 for steel); `yoy` = last ÷ same month a year earlier − 1 (+3.9 and +23.4 percent). |
| Detail, ZIP | `agez[zip]`; ZIP `roofs`, `yb_med`, `pre80_sh`, `ra20`, `ra20_sh`, `ra15`, `ra15_sh`, `wave`, `nxt`, `last64`, `yrs64`, `mh`, `mf24`, `mf5u`, `cru`, `metal_sh`, `own_sh`, `mort_sh`, `value`, `inc` | median roof age = `medOf(agez[zip])` |
| Detail, area | sums of ZIP `roofs`, `ra20`, `ra15`, `wave`, `nxt`, `cru`, `u1`, `mf24`, `mf5u`, `mh`, `hu`; `ageHist(zips)` (5061: sum of `agez` over the ZIPs); `yb20` to `ybold` | owner occupied homes = Σ `hh × own_sh ÷ 100`; median year built interpolated inside the decade that holds the median (`medYb`, 9484, with the oldest class spread from 1920 to 1939 and the newest over five years) |
| Roof age chart | `agez[zip]`, or `ageHist` of the scope, or `ts.agehist` | spikes are ages 1 to 39 whose bar is more than 1.5 times the mean of its neighbours; the four largest are named with their year (`2026 − age`) and a storm label from the typed table `STORMY` (9520) |
| Homes by decade | ZIP `ybold`, `yb40`, ..., `yb20` | sums |
| What kind of roofs | ZIP `u1`, `mf24`, `mf5u`, `mh`, `hu`, `cru`; `META.model.ANCH.cru` | shares of `hu` |
| Life chart | `META.model.WB.L`, `.k` | `lam = L ÷ Γ(1 + 1/k)`; `S(t) = exp(−(t ÷ lam)^k)`; `Hz(t) = 1 − S(t + 1) ÷ S(t)` (9403 to 9404) |
| AHS table | `META.ahs.vint` = `{decade: [model, AHS]}` (identical to `META.model.WB.fit`); `WB.rho` | gap = model − AHS; `rmse` = root mean square of the five gaps (0.31 points) |
| Prices | `ts.ppi.asph`, `ts.ppi.steel` (monthly, January 2019 to August 2026, 92 points each) | rebased to January 2020 = 100 |
| Owner spending | `META.ahs.wsc_rate` 5.63, `wsc_diy` 15.6, `wsc_med` 10,000, `wsc_mean` 12,557, `wsc_ins` 41.4, `wsc_leak` 4.14, `s_mh_rate` 3.58, `s_mh_diy` 27.7, `s_mh_med` 5,100; `META.model.VAL.replace` | printed as is |
| FORTIFIED | `META.fort.grant` 10,000, `round26` 3,000, `lfhp26` 80,000,000, `restore26` 20,000,000, `anchor` 9,000 | printed as is |
| Building permits | state: `ts.permits[year] = [units in one unit buildings, all units, buildings]`, `ts.ytd26`, `ts.ytd25`; parish or region: `parish.bps[year]` (first two elements), `parish.ytd26`, `ytd25` | bars: element 0, and element 1 − element 0; note: last year's units, the peak year, and "January to August 2026" against the same months of 2025 |
| Commercial stock | ZIP `retail`, `food`, `health`, `office`, `church`, `mfg`, `school`, `auto`, `lodging`, `apts`, `nonres`, `whse`, `est`, `cru`; `META.model.ANCH.coat` | sums |
| From stock to campaign | `META.wave`, `META.mh`, `META.fort.grant`, `META.ahs.s_mh_med`, `pre80` | printed in the text |
| Footer, CSV note | `META.compiled`, `WB.L` | |


## 17.3 The roof age cohort model, complete

The model was run offline; its code is not in the HTML. What follows is (a) every sentence the dashboard prints about it, (b) every constant it ships, and (c) a reconstruction checked against the shipped numbers. The reconstruction reproduces the shipped age histograms to within about 1.5 percent for the median ZIP when the one unit homes by decade are approximated, and exactly where they are not in doubt (for ZIP 70003 every one of the first 26 age bars is within 2 roofs).

### (a) What the dashboard says, verbatim

- 9413: "No public register records when each Louisiana roof was last replaced. The atlas builds roof ages from the decade each home was built (Census), a service life averaging 22 years with a realistic spread (Weibull, shape 3), and the roofs each storm replaced (module 02), then checks the result against the replacement rates owners report to the American Housing Survey. The fit is close by decade built (table below), but a ZIP's roof ages are an estimate. Since August 1, 2025 every reroof needs a permit (Act 239 of 2025), so parish permit logs will turn this estimate into a count over the next few years."
- 9618 (the method paragraph): "Each ZIP's homes by decade built (ACS) enter a cohort model run year by year from 1905 to 2026: roofs fail with a Weibull hazard (mean 22 years, shape 3), storms replace a share of surviving roofs at the modeled wind of every storm since 1950 (module 02), and new homes enter at age zero. The life and shape were fitted so that the model reproduces the AHS 2023 roof replacement rates by decade built. Roofs 20 and older, roofs 15 to 19 and the coming year's age driven replacements come straight from the model's 2026 age distribution."
- 9557: "Mean life 22 years, Weibull shape 3 (scale 24.6 years). Half of roofs are replaced by about 22 years; at 15 years the chance of replacement in the coming year is 4.7%, at 20 it is 8.1% and at 25 it is 12.2%. Storms come on top of this. The life is fitted to Southern owners' reports, slightly above the 20 years the National Association of Home Builders gives asphalt shingles, because many roofs outlive their rated life before owners replace them."
- 9561: "Share of homes replacing the roof in a year, single family owner homes in the South. The model's root mean square error is 0.31 points across the five decades. Homes built since 2010 replace roofs rarely (about 1 percent a year), homes from the 1960s to the 2000s at about 4 percent: that step is the age engine behind the replacement line. The calibration cohort assumes a Southern background of 1.5% a year of storm replacements; Louisiana ZIPs use their own storm footprints instead."
- 9521: "Spikes at ... are storm years: a storm replaces thousands of roofs at once, and those roofs then age together. The model's ages are as of 2026."
- 9610 to 9612 (caveats): "Roof ages come from the year each home was built, a calibrated service life and modeled storm resets. A ZIP where a hailstorm or a reroofing boom replaced roofs outside the model will be younger than shown."; "The storm side of the model is fitted to FEMA registrations multiplied up to roofs (grade D), so the size of the 2020 and 2021 spikes, and the low statewide median age they produce, carry that uncertainty."; "Each one unit home is one roof; attached townhomes are counted as separate roofs though they share one. Units in 2 to 4 unit buildings are counted separately."
- Outside my range but about this model: line 1211 (the `replace` line's `what`, quoted in 12.2): the roof "is reset by every storm that reached the ZIP since 1950: FEMA verified roof and wind damage where FEMA has it, the best track wind footprint elsewhere"; line 1238 (the `storm` line): "the share of roofs replaced rises on a logistic curve with a 52 percent ceiling, a 70 knot midpoint and a 7.3 knot width, at two roofs replaced per FEMA registration (grade D multiplier); Spearman 0.73 between wind and FEMA damage across 2,055 ZIP storm pairs"; line 5211: "damage that never registered is covered by a multiplier (two roofs per registration before 2020, 3.6 since, grade D)"; line 6064: "FEMA's roof damage field is zero for every registration from 2020 on. Verified real property loss without flood damage stands in, with its own multiplier in the damage curve (3.6 against 2.0)."; line 5210: "The 22 year Weibull life fits the South's 2023 American Housing Survey rates by year built (within 0.3 points a year); Louisiana specific roof ages are not published."; line 5705: footprints are "Sustained one minute winds at 10 meters over open ground, from best track positions interpolated hourly and the published wind radii (2004 on) or a fitted wind profile before that."

### (b) Inputs

| Input | Where it is in the data | Role |
|---|---|---|
| Homes by decade built | ZIP columns `ybold`, `yb40`, `yb50`, `yb60`, `yb70`, `yb80`, `yb90`, `yb00`, `yb10`, `yb20` (ACS B25034, all housing units) and, in the pipeline only, ACS B25127 (units in structure by year built) | the cohorts. The model uses one unit homes by decade; the shipped decade columns are all units. `roofs` is the model's one unit total: Σ `roofs` = 1,483,211 against Σ `u1` = 1,437,010 (ratio 1.032, ZIP median 1.02), so `roofs` is not simply the ACS one unit count |
| Storm winds at the ZIP | `zstorm[zip] = [[sids index, peak sustained wind kt], ...]`, `sids[i] = [name, year, state category, peak state wind kt]` | storm resets. Only winds of 34 kt or more are stored. `sids` lists 119 storms from 1950 to 2026 (32 with 0 kt, meaning no footprint); `zstorm` contains only the 45 storms from Andrew 1992 to 2026. The footprints of 1950 to 1991 storms, which the method says were used, are not shipped |
| FEMA registrations | ZIP `fema_k` (all, 2004 to 2026), `fema_20` (2020 on), `fema_ida`, `fema_laura`; parish `fema` = `{DR number: registrations}`; `ts.fema_year` = `[DR, name, year, registrations, roof flag era (true to 2017), owners, with homeowners insurance]` | storm resets where FEMA has registrations. Per ZIP and storm counts exist in the data only for Ida and Laura |
| Occupied homes | ZIP `hh` (= `occ`) | the denominator of the FEMA share |
| Damage curve | `META.model.DMG`: `smax` 0.5214, `v50` 69.72, `w` 7.263, `n` 2,055, `M` 2.0, `rho` 0.731 | `dmgShare(kt) = smax ÷ (1 + exp(−(kt − v50) ÷ w))` for 34 kt or more (line 5307) |
| FEMA multipliers | `DMG.M` 2.0 (disasters to 2017), `META.model.ANCH.M2020` 3.6 (2020 on) | roofs replaced per FEMA registration |
| Service life | `META.model.WB`: `L` 22.0 (mean, years), `k` 3.0 (shape), `rho` 0.015 (calibration background), `fit` (the calibration table) | the Weibull hazard |
| American Housing Survey 2023 | `META.ahs.vint` (= `WB.fit`): replacement rate by decade built, model and observed | calibration target |

### (c) The service life

`lam = L ÷ Γ(1 + 1/k)` = 22 ÷ Γ(4/3) = 24.64 years (the Weibull scale). Survival `S(t) = exp(−(t ÷ lam)^k)`. One year hazard at age `t`: `h(t) = 1 − S(t + 1) ÷ S(t)`. Median life `lam × ln(2)^(1/k)` = 21.8 years.

| Age | 0 | 5 | 10 | 15 | 20 | 25 | 30 | 40 |
|---|---|---|---|---|---|---|---|---|
| Still on the house, S (%) | 100 | 99.2 | 93.5 | 79.8 | 58.6 | 35.2 | 16.4 | 1.4 |
| Replaced in the coming year, h (%) | 0.01 | 0.61 | 2.19 | 4.71 | 8.09 | 12.23 | 17.03 | |

### (d) The calibration, reproduced

`WB.fit` holds, per decade built, `[model, AHS 2023]` in percent of homes replacing the roof in a year: 1960 to 1979 `[3.87, 4.37]`, 1980 to 1989 `[3.72, 3.98]`, 1990 to 1999 `[4.17, 3.93]`, 2000 to 2009 `[3.77, 3.46]`, 2010 to 2019 `[1.24, 1.13]`. The AHS column is "roofing projects not paid by insurance, by year built, in the South" for single family owner homes.

Verified: a cohort of homes built evenly across the years of a decade, stepped one year at a time with (1) the hazard `h(age)` and then (2) a flat 1.5 percent of the survivors replaced by storms (`rho`), gives age driven replacement rates of 3.87, 3.71, 4.18, 3.78 and 1.23 percent in 2022, which is the shipped model column to within 0.01. (Evaluated in 2023 the same run gives 3.88, 3.72, 4.11, 3.95, 1.49, so the pipeline's reading year is 2022, or equivalently its first hazard step falls in the year after the build year.) With `rho = 0` the rates would be 4.2 to 4.8 percent: the storm background matters to the fit. The model rate counts age driven replacements only, which is why it is compared with projects not paid by insurance.

### (e) The yearly loop (verified by simulation against `agez` and `rhist`)

For each ZIP, for each year from 1905 to 2026:

1. **New homes enter at age 0.** The homes of a decade are spread evenly over its years. "1939 or earlier" is spread over 1905 to 1939 (which is why the run starts in 1905); "2020 or later" is spread over the six years 2020 to 2025 and none enter in 2026 (verified: `agez[1]` exceeds the 2025 age driven replacements by one sixth of the ZIP's one unit share of `yb20`, and `agez[0]` equals the 2026 age driven replacements).
2. **Wear.** Every roof of age `a` is replaced with probability `h(a)`. These are the year's age driven replacements (`rhist[zip][year − 2000][0]`).
3. **Storms.** A share `s` of the surviving roofs, the same at every age, is replaced. These are the year's storm driven replacements (`rhist[...][1]`). Verified that storms act on the survivors of step 2 (fits are tighter on survivors than on the opening stock) and that young roofs are not spared (the 2021 cohort of ZIP 70001 is reduced by the 2024 storm share like any other).
4. **Ageing.** Survivors grow one year older; everything replaced in steps 2 and 3, and the new homes, form the new age 0.

Check on ZIP 70001: roofs installed in 2021 = 435.5 (wear) + 1,407.2 (storms) + 20.3 (new homes) = 1,863; times S(5) = 0.9917 and times (1 − 0.0012) for the 2024 storm gives 1,845, which is `agez['70001'][5]`.

### (f) The storm share `s` (inferred from the shipped numbers; the pipeline's code was not available)

For a storm at a ZIP with peak modeled wind `kt` (34 kt or more), the share of surviving roofs replaced is one of three things:

| Case | Share | Evidence in the data |
|---|---|---|
| The storm has no FEMA registration file for roofs (every storm before 2004, and Allison 2001, Isidore and Lili 2002, Bill 2003, Matthew 2004, Cindy 2005, Humberto 2007, Ida 2009, Lee 2011, Cindy, Harvey and Nate 2017, Olga 2019, Claudette 2021, Beryl 2024) | `dmgShare(kt)` | median ratio of the shipped reset to `dmgShare × survivors` between 0.97 and 1.06 for every one of these storms (2011 Lee: 1.002 over 219 ZIPs) |
| The storm has FEMA registrations (Ivan 2004; Katrina and Rita 2005; Gustav and Ike 2008; Isaac 2012; Laura, Delta and Zeta 2020; Ida 2021; Francine 2024) and the ZIP has registrations | `min(0.85, M × registrations ÷ occupied homes)`, with `M` = 2.0 to 2017 and 3.6 from 2020. The wind curve is not used | Ida 2021, 83 ZIPs with 150 or more registrations and no cap: shipped reset ÷ (survivors × registrations ÷ occupied homes) = 3.51 to 3.67, median 3.56 (coefficient of variation 0.7 percent). 25 ZIPs where 3.6 × registrations ÷ occupied homes exceeds 0.95: reset ÷ survivors = 0.846 to 0.869, clustered at 0.850. Parish sums for 2005, 2008 and 2012 are consistent with 2.0 |
| The storm has FEMA registrations but the ZIP has none (it lies outside the parishes FEMA recorded) | `0.5 × dmgShare(kt)` | in parishes with no registrations for the storm, the ratio to `dmgShare × survivors` is 0.50 for every FEMA era storm (Francine: 110 ZIPs, 0.46 to 0.53; Isaac: 68 ZIPs, 0.46 to 0.57; Rita, Ike, Laura, Delta, Zeta, Ida, Ivan the same) |

Other observed facts: Barry 2019 enters at 0.40 × `dmgShare` (38 ZIPs, 0.36 to 0.43), an exception I cannot explain from the HTML. Several storms in one year add (their shares are small enough that the sum and the product agree). No reset is applied in 2026: Arthur, Bertha and Edouard 2026 are in `zstorm` (operational tracks, `routes[].op = true`) but `rhist` shows zero storm replacements for 2026 at every ZIP, matching the method's "1950 to 2025". Disasters that are not tropical cyclones (the 2016 floods, the February 2021 winter storm) appear in `fema_k` but produce no reset. `zstorm` winds are rounded to whole knots, which alone moves a low wind share by about 5 percent.

### (g) Outputs, and how each shipped column follows from the age distribution

`agez[zip]` is the count of one unit roofs at each age 0 to 39, and 40 or older, at the end of the 2026 step, rounded to whole roofs.

| Output | Definition | Check |
|---|---|---|
| `roofs` | Σ `agez[zip]` | equal within rounding (largest difference 9) |
| `ra15`, `ra20` | Σ `agez[15..40]`, Σ `agez[20..40]` | within 5 and 4 |
| `ra15_sh`, `ra20_sh` | 100 × `ra15` (`ra20`) ÷ `roofs` | exact to one decimal |
| `wave` | Σ `agez[15..19]` = `ra15 − ra20` | within 2 |
| `ra_med` | first age at which the cumulative count reaches half | agrees for 501 of 534 ZIPs; the rest differ by rounding |
| `nxt` | Σ over ages of `agez[a] × h(a)`, plus the homes in 2 to 4 unit buildings at about 0.354 roof per home with the same average hazard. It is the wear of the year after the 2026 distribution, not 2026's own | least squares: 1.0015 × Σ `agez × h` + 0.354 × `mf24` × mean hazard, R² 0.99996, largest error 6.7. State: 49,476 + about 2,200 = `META.nxt` 51,690. The 2026 wear itself is 47,786 (`ts.replace_hist['2026'][0]`) |
| `last64`, `yrs64` | last year from 1950 with 64 kt or more at the ZIP; `2026 − last64` | `yrs64 = 2026 − last64` at every ZIP; 178 ZIPs have none |
| `rhist[zip]` | 27 pairs for 2000 to 2026: `[wear, storm]` replacements that year | sums to parish `hist` and to `ts.replace_hist` |
| parish `roofs`, `ra15`, `ra20`, `wave`, `nxt`, `hist` | sums over the parish's ZIPs | verified for `hist` |
| `ts.agehist` | Σ `agez` over all ZIPs (41 numbers) | exact |
| `META.roofs`, `ra15`, `ra20`, `wave`, `nxt` | state sums of the ZIP columns: 1,483,211; 427,015; 233,714; 193,301; 51,690 | `ts.agehist` sums to 1,482,951 (rounding) |
| `ts.replace_hist` | state sums by year; 2005 is `[41,786, 325,044]`, 2021 `[47,232, 219,571]`, 2026 `[47,786, 0]` | equals Σ parish `hist` within 3 |

State results for orientation: median roof age 7 years; 15.7 percent of roofs are 20 or older and 13.0 percent are 15 to 19; the age histogram has spikes at 2 years (2024, Francine), 5 (2021, Ida), 18 (2008, Gustav and Ike), 21 (2005, Katrina and Rita), 24 (2002) and 34 (1992, Andrew).

Where the outputs go: module 17 (this screen), module 01 (map layers, the ZIP ledger chart at 5189), module 02 (the "Storm resets" chart from `ts.replace_hist` at 5341 and the per ZIP chart from `rhist` at 5584), module 04 (`ageProjection`, 5945 to 5950: the 2026 histogram aged forward ten years with the same hazard, no storms, new homes at the 2021 on permit average), module 11 (parish `hist`), module 12 (`p_replace` from `nxt`) and module 09 (page facts).

### (h) Every constant in one place

| Constant | Value | Source field | Meaning |
|---|---|---|---|
| mean life | 22 years | `META.model.WB.L` | Weibull mean |
| shape | 3 | `WB.k` | Weibull shape |
| scale | 24.64 years | derived | `L ÷ Γ(1 + 1/k)` |
| calibration storm background | 1.5 percent a year | `WB.rho` | used only in the calibration cohort |
| calibration table | five decades, model and AHS | `WB.fit` = `META.ahs.vint` | RMSE 0.31 points |
| damage ceiling | 0.5214 | `DMG.smax` | share of roofs replaced at very high wind |
| damage midpoint | 69.72 kt | `DMG.v50` | |
| damage width | 7.263 kt | `DMG.w` | |
| curve fit sample | 2,055 ZIP and storm pairs, Spearman 0.731 | `DMG.n`, `DMG.rho` | fitted on Katrina, Rita, Gustav, Ike, Isaac |
| FEMA multiplier to 2017 | 2.0 | `DMG.M` | roofs replaced per registration with roof damage |
| FEMA multiplier from 2020 | 3.6 | `ANCH.M2020` | per registration with verified wind loss |
| cap on a FEMA based share | 0.85 | not shipped (inferred) | |
| weight of the wind curve where FEMA has no registrations in a declared storm | 0.5 | not shipped (inferred) | |
| minimum wind stored | 34 kt | `zstorm` | tropical storm force |
| first and last model year | 1905, 2026 | text at 9618 | |
| first and last storm year | 1950, 2025 | text at 1211, 1238 | |
| spread of "1939 or earlier" | 1905 to 1939 | inferred from the start year | |
| spread of "2020 or later" | 2020 to 2025 | verified | |
| roofs per 2 to 4 unit home in `nxt` | about 0.354 | not shipped (fitted) | |
| age bins | 0 to 39, and 40+ | `agez` length 41 | |

## 17.4 Louisiana specific content in module 17

| Lines | What | Text or value to find |
|---|---|---|
| 9383 | layer note | "12 percent statewide, scaled up in rural and higher income ZIPs" |
| 9387 | description | "How old Louisiana roofs are, what they are made of, what materials cost and what the code and FORTIFIED require" |
| 9408 | dek | "What is on Louisiana's roofs ... the storms that replaced roofs in waves, and a service life calibrated to the American Housing Survey ... how long each covering lasts in Gulf heat and wind, what the FORTIFIED standard adds" |
| 9413 | callout | "when each Louisiana roof was last replaced"; "Since August 1, 2025 every reroof needs a permit (Act 239 of 2025), so parish permit logs will turn this estimate into a count" |
| 9417 to 9418, 9423, 9467 | scope wording | "All nine regions", "All 64 parishes", default title "Louisiana", "{parish} Parish" |
| 9427 | chart text | "(model, 2026)" |
| 9436, 9562 to 9571 | materials table, column "Louisiana notes" | every row: "Gulf heat and humidity age the asphalt faster"; "The default Louisiana reroof ... ASTM D7158 (Class H) or D3161 (Class F) ... algae resistant granules against the dark streaks that humid parishes get; impact rated (UL 2218 Class 4) versions for hail country in the north"; "Growing in rural parishes and on camps, barns and mobile homes ... Near salt water use aluminum or coated steel"; "Historic New Orleans and high end homes"; "Rare in Louisiana; humidity and rot shorten wood"; "The atlas assumes 22 years"; "(AHS median $5,100)". Typical lives: 20 years (NAHB), 20 to 30, 40 or more, 50 or more (NAHB), 30 and 25 (NAHB), 15 to 30, 10 to 20 per coat, 20 or more |
| 9439, 9582 | owner spending | "West South Central (Louisiana, Texas, Oklahoma, Arkansas) single family owners and Southern mobile homes"; "Four in ten owner roof projects in the region are paid at least partly by insurance, which is why claim rules shape roofing marketing in Louisiana (module 03)" |
| 9442, 9583 to 9590 | FORTIFIED card | the whole card; "interior hurricane damage"; "Louisiana Fortify Homes Program grants of up to $10,000 paid to the contractor after certification; a June round of 3,000 grants by lottery; about $80M for the program plus $20M of HUD money for coastal homes through Restore ROOF ... about 9,000 FORTIFIED reroofs a year statewide (grade C) ... a bill to mandate 20 to 30 percent discounts (SB 222 of 2025) failed" |
| 9443, 9591 to 9597 | code table | "The rules a reroof meets in Louisiana"; Act 239 of 2025 (permit, August 1, 2025); Act 422 of 2025; "$7,500 ... Residential Roofing or Residential Construction classification since August 1, 2026 ... (Act 757 of 2026)"; "$50,000"; "The Louisiana State Uniform Construction Code ... the design wind speed at the site, which rises from north Louisiana to the coast"; "IRC R908.3.1.1"; "Most Louisiana reroofs are full tear offs"; "Act 9 of 2024 (HB 611) ... nonrenew up to 5 percent ... from January 1, 2025" |
| 9457 | KPI note | "the 2020 and 2021 storms pulled it down" |
| 9465, 9488, 9493 | ZIP wording | "{parish} Parish"; "Last hurricane force winds"; "none modeled since 1950" |
| 9520 | storm labels by year | `STORMY = {2005: 'Katrina and Rita', 2008: 'Gustav and Ike', 2012: 'Isaac', 2020: 'Laura, Delta and Zeta', 2021: 'Ida', 2024: 'Francine', 2002: 'Lili and Isidore', 2019: 'Barry'}`; `yNow = 2026` |
| 9521 | chart note | "are storm years: a storm replaces thousands of roofs at once" |
| 9525 | decade note | "Pre 1980 homes often have plank or thin decking and smooth shank nails ... which raises the ticket and is exactly what FORTIFIED requires" |
| 9542 | permit note | "Louisiana"; "January to August 2026"; "since August 2025 they need a local permit" |
| 9549 | commercial note | "The atlas assumes a 22 year membrane life ..." (neutral) |
| 9557, 9561 | life notes | "fitted to Southern owners' reports"; "single family owner homes in the South"; "a Southern background of 1.5% a year of storm replacements; Louisiana ZIPs use their own storm footprints" |
| 9575 | price note | "after a declared emergency, documented cost increases are the one lawful reason to raise prices (R.S. 29:732)" |
| 9601 to 9607 | plays | "the 2005 and 2008 storm cohorts are inside that window now"; "With the three year rule gone (Act 9 of 2024) ... (R.S. 37:2159.1)"; "Register with the Louisiana Fortify Homes Program and train with IBHS"; "of Louisiana homes were built before 1980"; "Spanish language pages matter in many of these ZIPs" |
| 9611, 9614 to 9615 | caveats | "the size of the 2020 and 2021 spikes"; "scaled to Louisiana"; "The American Housing Survey reports for the West South Central division and the South; Louisiana alone is too small a sample to report" |
| 9618 to 9627 | method and sources | "storms replace a share of surviving roofs at the modeled wind of every storm since 1950"; ACS tables B25034, B25024; "IBHS FORTIFIED Roof standard; Louisiana Fortify Homes Program (LDI)"; "Louisiana State Uniform Construction Code (La. R.S. 40:1730.21 et seq.); International Residential Code R908"; "county annual files 2005 to 2025 and 2026 year to date" |
| 9628, 9632 | footer and export | "Uplift Louisiana Roofing Atlas, module 17"; `louisiana-roof-stock-by-zip.csv`; header `parish`, `last_hurricane_force_year` |
| data | `META.ahs`, `META.fort`, `META.model.WB`, `DMG`, `ANCH` | West South Central and Southern survey figures; the Fortify grant; the hurricane damage curve |

## 17.5 What a California edition of module 17 needs

The screen and the age model's skeleton carry over. What changes is the calibration, the reset mechanism and the material and code tables.

| Louisiana input | California equivalent | Note |
|---|---|---|
| ZIP decade built columns, `u1`, `mf24`, `mf5u`, `mh`, `hu`, `hh`, `own_sh`, `mort_sh`, `value`, `inc`, `yb_med`, `pre80_sh` | the same ACS tables (B25034, B25024, B25127, B25035, B25003, B25081, B25077, B19013) for about 1,760 ZCTAs | Direct. Ship one unit homes by decade as well as all units, so the model can be rerun in the browser; the Louisiana file does not |
| Weibull life: mean 22 years, shape 3, fitted to AHS 2023 by decade built for the South, with a 1.5 percent a year storm background | refit to the AHS Pacific division or to the California metropolitan samples. Expect a longer life: little hail, no hurricanes, less humidity. Tile roofs need their own curve (the underlayment fails at 20 to 30 years while the tile lasts 50 or more) | The calibration recipe in 17.3 (d) is reproducible: cohort by decade, hazard then background, read in the year before the survey. Set the background to California's rate of insurance paid reroofs, which is far below 1.5 percent |
| storm resets from `zstorm` winds and FEMA registrations (the logistic curve, the 2.0 and 3.6 multipliers, the 0.85 cap) | no wind footprint model. The resets that exist are wildfire rebuilds: homes destroyed in a fire are rebuilt, with new roofs, over the following one to four years. Source: CAL FIRE damage inspection points (destroyed and damaged structures by fire and location), FEMA registrations for declared fires | The loop's step 3 becomes "a share of the ZIP's roofs is destroyed in year Y and re-enters at age 0 in years Y + 1 to Y + 4". For almost all ZIPs the share is zero, so the California age distribution will be smooth and old, with no storm spikes; the "coming wave" is then the 1980s and 2000s building booms reaching end of life, not storm cohorts |
| `last64`, `yrs64`, "Last hurricane force winds", `STORMY` | last year a wildfire destroyed homes in the ZIP, with fire names by year (for example 2017 Tubbs and Thomas, 2018 Camp and Woolsey, 2020 the August complexes, 2021 Dixie and Caldor, 2025 Palisades and Eaton) | Same slots; the layer label and the typed table at 9520 change |
| `nxt` including 2 to 4 unit homes at about 0.35 roof a home | same | |
| `metal_sh` (12 percent, rural and income tilt) | a material mix that matters more in California: shares of tile, shingle, metal and low slope by region are not public by home either, but assessor and permit data in several counties give roof material | Consider `tile_sh` beside `metal_sh` |
| `cru` (80,000 scaled from CBECS by population) and the twelve establishment columns | same recipe with California's population share and ZIP Business Patterns | |
| `ts.ppi` asphalt and steel | same national BLS series; add concrete and clay tile if a series is wanted | No change |
| `META.ahs` West South Central and South figures | Pacific division figures | The owner spending card names the states of the division at 9439 |
| FORTIFIED card and `META.fort` | a card on what a fire hardened roof adds (Class A assembly, ember resistant vents, metal edges and gutters, cleared roof and gutter debris under the state's Safer from Wildfires list) and the money behind it | No grant figures to copy; `META.fort` needs a new shape |
| code table (Acts 239, 422, 757, the state uniform code, IRC R908, Act 9 of 2024) | CSLB C-39 licence; local permits; Title 24 Part 6 cool roof requirements by climate zone and roof slope; Chapter 7A and CRC R337 in fire zones; recover limits in the California Residential Code; insurer nonrenewal rules and the FAIR Plan | From the law register |
| materials table "Louisiana notes" | rewrite for California: cool roof rated shingles, concrete and clay tile with underlayment replacement, Class A assemblies, coastal salt air and fog, mountain snow loads and ice, UV and heat in the desert and the Central Valley, solar arrays on the roof | Hail and algae notes drop |
| `ts.permits`, parish `bps`, `ytd26`, `ytd25` | Building Permits Survey for California counties | Direct. Ship total buildings by county if the new construction line is to be checked |
| "since August 2025 they need a local permit", "parish permit logs" | California reroofs have long needed local permits, and many cities publish permit data | The headline caveat changes: a count of reroofs by ZIP may be obtainable for the large cities, which would let the model be checked directly |

---

# Shell (`99_shell.js`, lines 9643 to 9659)

## 99.1 What it does

A single boot function (9647 to 9658), run after every module has registered:

1. Restores the saved theme from `localStorage` key `up.theme` (9648) and applies the company branding (`BRANDX.apply()`, 9649).
2. Builds the left rail: one tab per registered module with its number, title and description (9651), and one empty section per module (9652). Modules mount lazily on first show (`showModule`, line 753).
3. Adds the "⚙ Company" button, whose tooltip reads "Company settings: name, LSLBC license, qualifying party, offices, service area, colors" (9654).
4. Fills the header facts (`#shellFacts`, 9655): "64 parishes", one unit roofs, roofs 20+ years old, storms tracked, hail, wind and tornado reports, service lines, roofers watched.
5. Opens the module named in the URL hash, or `index` (9656), and follows later hash changes (9657).

Line 9643 sets the document language to `en` if none is set.

## 99.2 Data contract

| Field | Use |
|---|---|
| `META.roofs` | "N one unit roofs" (1,483,211, shown as 1.48M) |
| `META.ra20` | "N roofs 20+ years old" (233,714) |
| `META.nstorm` | "N storms tracked" (38, the number of `routes`) |
| `META.npts` | "N hail, wind and tornado reports" (5,115, the number of `pts`) |
| `PL.length`, `COMP.length` | "11 service lines", "29 roofers watched" |
| `MODS[]` (`key`, `num`, `title`, `desc`) | the rail |

## 99.3 Louisiana specific content

| Line | Text |
|---|---|
| 9654 | "LSLBC license, qualifying party" in the Company button tooltip |
| 9655 | `<b>64</b> parishes` (a typed literal, not `PA.length`); "storms tracked"; "hail, wind and tornado reports" |

The page title, the header wordmark and the rail markup are in the HTML head and body before line 559, outside my range.

## 99.4 California edition

Replace the literal with `PA.length` and "counties"; change the tooltip to the CSLB licence; choose header facts that suit California (for example homes in fire hazard zones, fires tracked) in place of storms and hail reports, which means new `META` scalars.

---

# Appendix: machine scan of lines 6901 to 9661 for Louisiana terms

A regular expression scan for state, parish, agency, statute, storm, programme, city, media market, file name and storage key terms. It is a checklist, not a substitute for the curated tables in each module's section 3: every line listed here holds at least one string that names Louisiana or its hazards. Generic words (hail, South, Central) are left out of the term lists. Count: 451 lines.


**m09 forge**

- 6904: Louisiana
- 6905: parishes; named storms
- 6906: LSLBC
- 6911: parish; Parish
- 6915: FORTIFIED; mobile home
- 6916: FORTIFIED
- 6953: SPC
- 6973: Hurricane; Tropical
- 6981: hurricane
- 6982: hurricane
- 6983: hurricane
- 6984: hurricane
- 6986: tropical; named storm
- 6997: Hurricane; Hurricanes
- 7000: FEMA
- 7011: parish
- 7023: FEMA
- 7031: parish; parishes
- 7037: named storms
- 7064: <https://www>
- 7069: LSLBC
- 7071: parishes
- 7072: parishes
- 7080: <https://www>
- 7092: Louisiana
- 7093: Louisiana
- 7095: Louisiana
- 7096: Louisiana
- 7107: parish
- 7108: parish
- 7109: parish
- 7110: Parish
- 7111: Parish
- 7113: parish; Parish
- 7118: Louisiana
- 7123: parish; Parish
- 7133: Louisiana
- 7134: Louisiana
- 7139: parish
- 7140: Louisiana; parish; Parish
- 7141: Louisiana; parish
- 7148: hurricane; NHC
- 7150: Hurricane; National Hurricane Center; HURDAT2; Storm Prediction Center; FEMA; OpenFEMA
- 7151: FEMA
- 7153: Louisiana; R.S. 22:1483.1; Department of Insurance; Fortify
- 7156: Louisiana
- 7157: Louisiana
- 7162: parish; Acts 2025, No. 239; August 1, 2025
- 7163: R.S. 37:2156.4; Acts 2026, No. 757; $7,500
- 7164: LSLBC; R.S. 37:2156.1; $500,000
- 7165: R.S. 37:2150.1; $50,000
- 7166: R.S. 22:1892
- 7167: R.S. 51:452; $1,000
- 7168: R.S. 29:732
- 7169: R.S. 9:4801
- 7170: R.S. 9:3141
- 7171: Louisiana; FORTIFIED; Fortify
- 7172: Louisiana; tropical; named storms
- 7173: Louisiana; FEMA
- 7174: Louisiana
- 7175: Louisiana
- 7176: Louisiana
- 7177: Louisiana
- 7178: mobile home
- 7180: Louisiana
- 7181: Louisiana; LSLBC
- 7184: FEMA
- 7185: named storm
- 7186: parish; Parish
- 7187: parish; Parish; FEMA
- 7188: parish; Parish
- 7191: hurricane
- 7192: Louisiana; FEMA
- 7206: parishes; parish
- 7222: Louisiana; LSLBC
- 7223: Louisiana; LSLBC
- 7225: Louisiana; parish; Parish
- 7226: Louisiana; parish; Parish
- 7227: Louisiana
- 7241: LSLBC; FEMA; FORTIFIED
- 7249: <https://example.com>
- 7259: hurricane
- 7292: Louisiana
- 7300: parish
- 7302: Louisiana; parish; Parish
- 7303: parish
- 7333: parish
- 7338: parish
- 7341: Louisiana; parish; Parish
- 7342: Louisiana
- 7356: Louisiana; lslbc.gov | <https://lslbc.gov/>
- 7359: Louisiana; LSLBC
- 7360: Louisiana
- 7361: Louisiana; parish
- 7362: Louisiana
- 7368: Louisiana
- 7369: Louisiana; LSLBC
- 7370: Louisiana
- 7371: Louisiana
- 7372: parish
- 7373: Louisiana; $500,000
- 7383: Louisiana; louisiana-law
- 7387: parish
- 7389: parish; Parish
- 7390: parish; Parish
- 7391: parish; Parish
- 7392: parish; Parish
- 7394: parish; Parish; FEMA
- 7395: parish; LSLBC; $7,500
- 7396: parish; Parish
- 7398: parish; Parish
- 7399: parish; Parish
- 7402: parish; Parish
- 7403: parish; Parish
- 7404: parish; Parish
- 7417: Louisiana
- 7420: hurricane
- 7421: Louisiana; FEMA
- 7427: parish; LSLBC; $7,500
- 7428: Louisiana; LSLBC; $7,500
- 7429: LSLBC; $7,500
- 7448: LSLBC
- 7456: Louisiana
- 7465: <https://www.example.com>
- 7486: Louisiana
- 7494: LSLBC; R.S. 37:2156.4
- 7500: FORTIFIED; IBHS
- 7501: R.S. 37:2150.1; $50,000
- 7511: parish
- 7515: parish
- 7519: up.forge.v1
- 7524: up.forge.v1
- 7526: LSLBC
- 7528: LSLBC; R.S. 37:2156.4; $7,500
- 7534: FORTIFIED
- 7541: Louisiana; parish; LSLBC; named storms
- 7542: parishes; named storms
- 7563: Louisiana; parish; parishes
- 7565: Parishes; parish
- 7568: Baton Rouge; Gonzales; Denham Springs
- 7570: FEMA
- 7573: named storms
- 7574: parishes; Parish; parish; named storm
- 7579: parish; FEMA
- 7585: <https://www.example.com/roof-replacement/&lt;/loc&gt;&lt;/url&gt;...&lt;/urlset&gt>
- 7599: parish
- 7622: LSLBC
- 7623: LSLBC; R.S. 37:2156.4; $7,500
- 7627: up.desk.v1
- 7637: FEMA
- 7638: parishes
- 7639: parishes
- 7647: parishes
- 7651: Parish; FEMA
- 7687: parish
- 7754: parish; Parish
- 7807: <https://www.example.com>
- 7818: Louisiana; Uplift
- 7835: NHC; FEMA; OpenFEMA
- 7836: parish
- 7837: hurricane; NHC; HURDAT2; FEMA; OpenFEMA
- 7839: LSLBC
- 7840: Louisiana; parish; FEMA
- 7841: LSLBC
- 7843: LSLBC; FORTIFIED
- 7846: LSLBC
- 7847: R.S. 37:2156.4; $7,500; $50,000; August 1, 2026
- 7848: R.S. 37:2159.1; R.S. 51:451
- 7849: NHC; FEMA
- 7851: FORTIFIED; $10,000
- 7853: LSLBC; legis.la.gov; October 5 and 6, 2026
- 7854: Lafayette
- 7857: parish
- 7862: LSLBC; Acts 2025, Nos. 239; Acts 2026, No. 757; lslbc.gov; Oct 6, 2026 | <https://lslbc.gov/>
- 7863: Louisiana; R.S. 37:2159.1; legis.la.gov | <https://legis.la.gov/>
- 7864: <https://www.ecfr.gov/>
- 7865: <https://www.census.gov/programs-surveys/acs>
- 7866: NHC; HURDAT2; SPC | <https://www.nhc.noaa.gov/data/>
- 7867: Louisiana; FEMA; OpenFEMA | <https://www.fema.gov/about/openfema/data-sets>
- 7868: <https://fred.stlouisfed.org/series/WPU1017>
- 7869: Louisiana; LDI; FORTIFIED; Fortify; IBHS | <https://fortifiedhome.org/>
- 7870: <https://schema.org/RoofingContractor>

**m10 satchel**

- 7910: parish; LSLBC; attorney general
- 7911: Louisiana; R.S. 45:844.11
- 7912: R.S. 51:452; R.S. 37:2159.1; $1,000
- 7913: LSLBC; R.S. 37:2156.4
- 7914: Louisiana; R.S. 29:732; attorney general
- 7915: R.S. 51:1405; R.S. 37:2159.1
- 7916: Louisiana
- 7918: LSLBC
- 7919: LSLBC
- 7920: New Orleans; Baton Rouge; Shreveport; Lafayette; Lake Charles; Monroe; Alexandria; Houma; Metairie; Kenner; Slidell; Hammond; Bossier; Covington; Thibodaux; Mandeville; Ruston; Natchitoches; Opelousas; New Iberia; Gonzales; Denham Springs; Prairieville; Zachary; Sulphur; Morgan City; Gretna; Harvey; Marrero; Chalmette; LaPlace; Laplace; LA_CITIES
- 7922: Louisiana
- 7933: Louisiana; LSLBC
- 7937: Louisiana; LSLBC; Department of Insurance; attorney general
- 7958: Louisiana; LSLBC; lslbc.gov; ldi.la.gov; ag.state.la.us; Department of Insurance; attorney general; Attorney General; FORTIFIED; IBHS; $7,500; $500,000 | <https://lslbc.gov/> <https://www.ldi.la.gov/> <https://www.ag.state.la.us/>
- 7969: Louisiana
- 7970: LSLBC
- 7972: Vietnamese
- 7975: LSLBC; Acts 2025, Nos. 239; Acts 2026, No. 757; lslbc.gov; Oct 6, 2026 | <https://lslbc.gov/>
- 7976: R.S. 37:2159.1; legis.la.gov | <https://legis.la.gov/>
- 7977: <https://www.ecfr.gov/current/title-16/part-465>
- 7978: <https://www.ecfr.gov/current/title-16/chapter-I/subchapter-D/part-429>
- 7979: <https://www.ecfr.gov/current/title-12/chapter-X/part-1026/subpart-C/section-1026.24>
- 7980: <https://www.ecfr.gov/current/title-16/part-251>
- 7981: R.S. 22:1483.1; FORTIFIED; IBHS | <https://fortifiedhome.org/>
- 7982: <https://support.google.com/adspolicy/>
- 7995: Louisiana
- 8006: Louisiana
- 8008: Louisiana; LSLBC; LA_CITIES
- 8017: Louisiana; LSLBC; Department of Insurance; attorney general; FORTIFIED; IBHS
- 8021: LSLBC
- 8024: FORTIFIED; IBHS; $10,000
- 8025: Louisiana
- 8026: Louisiana
- 8039: Louisiana; Gulf
- 8040: <https://connect.facebook.net/en_US/fbevents.js>
- 8041: Gulf | <https://schema.org>
- 8042: Louisiana
- 8043: Hurricane
- 8046: hurricane
- 8047: FORTIFIED; GAF
- 8051: Gulf
- 8076: LSLBC
- 8080: Louisiana; LSLBC; FORTIFIED
- 8081: Louisiana; LSLBC; lslbc.gov
- 8082: Louisiana; Department of Insurance
- 8083: Louisiana; Attorney General
- 8087: FORTIFIED; IBHS

**m11 regions**

- 8108: Louisiana
- 8110: Louisiana; FEMA; media markets; nine regions
- 8122: Hurricane
- 8131: DMA
- 8142: FEMA
- 8144: hurricane
- 8150: Louisiana; parishes; Parishes; Department of Health; Hurricanes; hurricane; Katrina; Gustav; Laura; Delta; Ida; Francine; media markets; New Orleans; Northshore; Bayou; Capital Region; nine regions
- 8151: LDH; NHC; FEMA; media market
- 8152: Louisiana
- 8155: parishes; hurricane; FEMA
- 8160: Louisiana
- 8172: Louisiana; Parish; Parishes
- 8173: Parish; hurricane
- 8176: Parish
- 8178: nine regions
- 8182: parishes
- 8183: hurricane
- 8184: Parishes
- 8187: Louisiana
- 8193: camps
- 8194: Hurricane
- 8195: FEMA
- 8197: hurricane
- 8201: media market
- 8204: Vietnamese; French
- 8212: Parishes; Hurricane; FEMA
- 8215: Louisiana; FEMA
- 8217: FEMA; FORTIFIED
- 8219: parish; Department of Insurance
- 8220: Parish
- 8225: Louisiana; parish; parishes; Department of Health; hurricane; FEMA; media markets; media market; Mississippi; Arkansas; Texas
- 8226: Louisiana; Department of Health; Uplift
- 8228: parishes; hurricane; louisiana-roofing-regions
- 8229: Louisiana; Uplift

**m12 lines**

- 8260: Louisiana; parishes; hurricanes; FORTIFIED; mobile home
- 8261: FORTIFIED; mobile home
- 8265: FEMA; FORTIFIED; mobile home
- 8270: nine regions
- 8271: Parish; parishes
- 8272: Houma; 70001
- 8282: Louisiana
- 8288: Louisiana
- 8290: mobile home
- 8301: Parish
- 8317: parish
- 8342: hurricane
- 8344: Hurricane; FEMA
- 8354: Louisiana; Parish
- 8365: Parish
- 8367: Parish
- 8379: parish; Parish
- 8384: Parish
- 8393: Louisiana; LSLBC; legis.la.gov; October 5 and 6, 2026
- 8400: West South Central
- 8408: R.S. 51:1405; R.S. 37:2159.1; R.S. 51:451; hurricane
- 8417: hurricane; FORTIFIED
- 8427: FORTIFIED; mobile home
- 8438: FORTIFIED; mobile homes
- 8441: Louisiana; Uplift
- 8446: Parishes
- 8447: Parishes
- 8449: Louisiana; parish; Uplift
- 8450: Louisiana; parish; Uplift

**m13 watch**

- 8470: October 6, 2026
- 8483: <https://www.facebook.com/ads/library/?id=>
- 8500: October 6, 2026
- 8503: Louisiana; Uplift

**m14 weather**

- 8586: Louisiana; NHC; SPC; nine Louisiana
- 8590: parish; Hurricane; tropical; National Hurricane Center; Storm Prediction Center; nine forecast points
- 8591: parish; tropical; NHC; SPC; nine points; api.weather.gov
- 8595: hurricane; tropical
- 8598: Hurricane; Tropical; tropical; National Hurricane Center
- 8600: SPC
- 8611: Louisiana
- 8616: Louisiana; tropical; NHC; SPC
- 8618: New Orleans; Shreveport; Lake Charles
- 8620: Louisiana; Hurricane; National Hurricane Center; Storm Prediction Center; Uplift
- 8621: nine forecast points
- 8622: Parish; SPC
- 8628: NHC
- 8636: America/Chicago; api.weather.gov
- 8643: Louisiana
- 8644: Tropical
- 8645: Louisiana; parishes; SPC
- 8646: nine points
- 8651: tropical
- 8652: Parish
- 8654: Parish
- 8655: parish; parishes; SPC
- 8659: tropical
- 8662: Louisiana; hurricane; tropical
- 8663: Gulf; landfall
- 8664: NHC
- 8699: Louisiana; Hurricane; Tropical
- 8702: America/Chicago
- 8704: New Orleans; Baton Rouge; Shreveport; Lake Charles; Jackson; LIX; LCH; SHV; JAN
- 8711: Louisiana; tropical
- 8714: Louisiana; LIX; LCH; SHV; nine points; api.weather.gov
- 8715: parish; tropical; NHC; SPC
- 8716: tropical
- 8718: hurricane; Hurricane; tropical; National Hurricane Center; HURDAT2; SPC; Storm Prediction Center; Mardi Gras; Oct 6, 2026; api.weather.gov | <https://www.weather.gov/documentation/services-web-api> <https://www.spc.noaa.gov/products/outlook/> <https://www.nhc.noaa.gov/> <https://www.spc.noaa.gov/wcm/>
- 8722: louisiana-storm-trigger-windows
- 8723: louisiana-roofing-work-days

**m15 accounts**

- 8755: LA_REPAIR_; LA_REPLACE_
- 8768: DMA
- 8776: Louisiana; Uplift
- 8808: up.map
- 8846: cf.desk.v1
- 8875: twelve counties; counties
- 8902: DMA
- 8903: <https://developers.google.com/google-ads/api/docs/start> <https://developers.google.com/local-services-ads/guides/reporting> <https://developers.google.com/youtube/analytics/reference/reports/query> <https://developers.google.com/youtube/v3/docs> <https://developers.facebook.com/docs/marketing-api/insights> <https://business-api.tiktok.com/portal/docs/reporting-reference/v1.3> <https://learn.microsoft.com/en-us/adve

**m16 publish**

- 8943: <https://x.invalid>
- 8971: French
- 8975: <https://schema.org>
- 8998: Louisiana; Uplift
- 9042: up.map
- 9112: cf.publish.loaded
- 9133: cf.publish.loaded
- 9177: cf.publish.composer
- 9238: <https://schema.org>
- 9336: <https://developer.wordpress.org/rest-api/using-the-rest-api/authentication/>
- 9337: <https://developers.elementor.com/docs/cli/library-import>
- 9338: <https://www.drupal.org/docs/core-modules-and-themes/core-modules/jsonapi-module/creating-new-resources-post>
- 9339: <https://dev.wix.com/docs/rest/business-solutions/cms/data-items/insert-data-item>
- 9340: <https://developer.duda.co/docs/content-injection-1>
- 9341: <https://developers.webflow.com/data/reference/cms/collection-items/staged-items/create-items>
- 9342: <https://shopify.dev/docs/api/admin-graphql/latest/mutations/pageCreate>
- 9343: <https://developers.hubspot.com/docs/api-reference/cms-posts-v3/basic/get-cms-v3-blogs-posts>
- 9344: <https://manual.joomla.org/docs/general-concepts/webservices/>
- 9345: <https://docs.ghost.org/admin-api>
- 9346: <https://developer.chrome.com/docs/extensions/reference/api/permissions>

**m17 stock**

- 9387: Louisiana; FORTIFIED
- 9408: Louisiana; Gulf; FORTIFIED
- 9409: mobile homes
- 9413: Louisiana; parish; Act 239 of 2025; August 1, 2025
- 9417: nine regions
- 9418: Parish; parishes
- 9423: Louisiana
- 9436: Louisiana; Gulf
- 9439: Louisiana; West South Central; Arkansas; Texas; Oklahoma; mobile homes
- 9442: Louisiana; FORTIFIED; IBHS
- 9443: Louisiana
- 9456: mobile homes
- 9464: Louisiana
- 9465: Parish
- 9467: Louisiana; Parish
- 9488: Parish
- 9493: hurricane
- 9506: Parish
- 9520: Katrina; Rita; Gustav; Ike; Isaac; Laura; Delta; Zeta; Ida; Francine; Lili; Isidore; Barry
- 9525: FORTIFIED
- 9529: mobile homes; mobile home
- 9542: Louisiana; Parish
- 9561: Louisiana
- 9563: Gulf
- 9564: Louisiana; parishes
- 9565: parishes; mobile homes; camps
- 9566: New Orleans
- 9567: Louisiana
- 9570: mobile homes; mobile home
- 9571: Louisiana
- 9575: R.S. 29:732
- 9582: Louisiana; mobile home
- 9584: hurricane
- 9588: FORTIFIED; IBHS
- 9589: Louisiana; SB 222; FORTIFIED; Fortify; Restore ROOF
- 9592: parish; Act 239 of 2025; Act 422 of 2025; August 1, 2025
- 9593: Act 757 of 2026; $7,500; $50,000; August 1, 2026
- 9594: Louisiana
- 9595: Louisiana
- 9596: Act 9 of 2024; HB 611
- 9602: R.S. 37:2159.1; Act 9 of 2024
- 9603: Louisiana; FORTIFIED; Fortify; IBHS
- 9604: Louisiana; FORTIFIED
- 9606: mobile homes
- 9611: FEMA
- 9614: Louisiana
- 9615: Louisiana; West South Central
- 9619: <https://www.census.gov/programs-surveys/acs>
- 9620: <https://www.census.gov/programs-surveys/ahs.html>
- 9621: <https://fred.stlouisfed.org/series/WPU1361>
- 9622: county | <https://www.census.gov/construction/bps/>
- 9623: <https://www.census.gov/programs-surveys/cbp.html>
- 9625: Louisiana; LDI; FORTIFIED; Fortify; IBHS | <https://fortifiedhome.org/>
- 9626: Louisiana; R.S. 40:1730.21
- 9628: Louisiana; Uplift
- 9630: Parishes
- 9631: Parishes
- 9632: Louisiana; parish; hurricane; louisiana-roof-stock-by-zip; Uplift

**shell**

- 9648: up.theme
- 9654: LSLBC
- 9655: parishes
