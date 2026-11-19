# Contract for modules 01 to 08 of the Uplift Louisiana Roofing Atlas

Source read: `la_atlas_source.html`, lines 4987 to 6900 (the eight script sections `13_m01_index.js` to `20_m08_desk.js`), plus the helpers those sections call in lines 563 to 4986. Data checked against `la_atlas_data.json`, `la_zcols.txt` and `la_meta.json`. Nothing but this file was written.

All line numbers are lines of `la_atlas_source.html`. The file on disk has 9,661 lines, not 9,667. The eight modules sit here:

| module | script section | lines | registered key | title |
|---|---|---|---|---|
| 01 | `13_m01_index.js` | 4987 to 5258 | `index` | Roof Demand Index |
| 02 | `14_m02_storms.js` | 5260 to 5745 | `storms` | Storm Ledger |
| 03 | `15_m03_law.js` | 5747 to 5910 | `law` | Code, License and Claims |
| 04 | `16_m04_drivers.js` | 5912 to 6090 | `drivers` | Demand Drivers |
| 05 | `17_m05_paid.js` | 6092 to 6291 | `paid` | Paid Acquisition |
| 06 | `18_m06_ground.js` | 6293 to 6460 | `ground` | Ground Truth |
| 07 | `19_m07_field.js` | 6462 to 6605 | `field` | Competitive Field |
| 08 | `20_m08_desk.js` | 6607 to 6899 | `desk` | Campaign Desk |

How this file is laid out:

- Part A: one table of all 165 ZIP columns, marking which of the eight modules read each.
- Part B: every other structure in `window.__ATLAS_DATA__` (parishes, cities, places, geo, seg, routes, rlist, pts, ptflags, ts, hosp, comp, agez, rhist, zstorm, sids, meta) with its fields and the modules that read them.
- Part C: the shared helpers the eight modules depend on, the fields created at load time, and the names these modules export to later modules.
- Parts 01 to 08: one chapter per module, each with (1) purpose and visible structure, (2) data contract, (3) Louisiana content, (4) what a California edition needs.
- Part Z: cross cutting list of Louisiana strings that repeat in every module, and what I checked against the data.

Conventions used below:

- "ZIP column" means a name in `zcols`; a ZIP row becomes an object `z` at line 579, so `z.hd1` is column `hd1`.
- Text in quotation marks is copied from the source. Where a sentence explains how a number was built, it is copied whole with its line number, because those sentences are the only record of the build.
- "Checked" means I recomputed the relation from `la_atlas_data.json` and it held. "Inferred" means the source never labels the field and the meaning comes from its name, its values or a neighbouring field.
- Statements about California law and data in the "California edition" sections are my suggestions from memory. I did not look any of them up in this session. Treat every California citation as a lead to verify against the primary source, exactly as the Louisiana register was.

---

## Part A. ZIP columns (`zcols`, 165 columns, 534 rows) and the modules that read them

Legend for the module cells: `L` = the column is a selectable map layer in the shared `LAYERS` catalog (lines 4991 to 5045; module 01 offers every key in its layer menu, shades the map with it, prints its note under the legend and shows it in the ranking table); `T` = tooltip; `D` = detail panel; `K` = headline figure; `X` = CSV export; a bare number is a line. Modules 03 (law) and 06 (ground) read no ZIP column at all: 03 is all hard coded text plus two meta values, 06 works on the parish, city and report tables. "—" means not read.

Counts: module 01 reads 103 of the 165 columns, module 02 reads 22, module 04 reads 18, module 05 reads 23, module 07 reads 14, module 08 reads 21. 56 columns are read by none of the eight modules (listed after the table).

| # | column | example | meaning and units | core and helpers (lines 563 to 4986) | 01 index | 02 storms | 04 drivers | 05 paid | 07 field | 08 desk |
|---|---|---|---|---|---|---|---|---|---|---|
| 0 | `zip` | "70001" | ZCTA / ZIP code, 5 character string; key of ZI, geo.zcta, agez, rhist, zstorm | 579-580 (ZI key); 892, 929 (map) | T 5054; K 5112; table 5133; D 5153-5154; find 5243; X 5244 | ZIX 5264; 5442; T 5449; tables 5496-5506; 5529-5530; 5541; D 5572; X 5732 | X 6084 | 6151, 6155; table 6184; D 6198; X 6282 | T 6519; D 6555; table 6565 | 6653, 6701; T 6787; 6806; table 6815; LSA 6827, 6872; X 6858, 6873, 6879; plan 6893 |
| 1 | `city` | "Metairie" | USPS city name of the ZIP (null in 30 rows; line 580 falls back to the parish name) | 580 (fallback to parish name) | T 5054; K 5112; table 5133; D 5154; find by prefix 5243; X 5244 | T 5431, 5449; tables 5496, 5502; storm cities 5531; D 5572 | X 6084 | T 6158; table 6184; D 6198; scatter 6212; plan 6233; text 6248; X 6282 | T 6519; D 6555, 6557-6558 (match against comp.cities); table 6565 | ad copy {City} 6723; T 6787; 6806; table 6815; local keywords 6836, 6863; Path 2 6867; X 6873, 6879 |
| 2 | `pi` | 25 | index of the ZIP's parish in the parishes array (0 to 63) | 580 (sets z.fips, z.cty) | scope 5115 (PA[z.pi].reg); D 5154 | scope 5425 | (via z.cty) X 6084 | scope 6148; D 6197; rollups 6238, 6253; X 6282-6283 | text 6579 (PA[z.pi].reg) | (via z.fips 6699, z.cty 6723, 6879) |
| 3 | `reg` | 1 | region number 1 to 9 (META.model.REG); identical to parishes[pi].reg in all 534 rows (checked) | not read: every module takes the region from PA[z.pi].reg | — | — | — | — | — | — |
| 4 | `lat` | 29.9845 | latitude of the ZIP centre, degrees | 929 (ZipMap.fitTo) | map.fitTo 5243, 5253 | 5541 (ZIPs within 16 km of a report); fitTo 5739 | — | fitTo 6212, 6287 | distance to offices 6538, 6556, 6565; fitTo 6565 | — |
| 5 | `lon` | -90.1695 | longitude of the ZIP centre, degrees | 929 (ZipMap.fitTo) | map.fitTo 5243, 5253 | 5541; fitTo 5739 | — | fitTo 6212, 6287 | 6538, 6556, 6565 | — |
| 6 | `sqmi` | 6.5 | land area, square miles | — | — | — | ZD filter 5956; density predictor 5964; hail reports per 100 sq mi 5970 | — | — | — |
| 7 | `wsqmi` | 0.0 | water area, square miles (inferred from the name; no label in the source) | — | — | — | — | — | — | — |
| 8 | `pop` | 38950 | residents (ACS B01003) | 5048 (fees_pc, needs pop >= 200) | T 5054; scope totals 5142-5145; D 5154; find sort 5243; X 5244 | — | density 5964; licences per 10k 5969 | D 6198; quadrant shares 6210-6211; rollup 6238 | K 6515 (whitespace residents) | market filter minpop 6698; K 6794 |
| 9 | `hh` | 17808 | households (= occupied homes; equal to occ in every row) | 580: z.occ = z.hh | — | — | — | — | — | — |
| 10 | `inc` | 67923 | median household income, $ (ACS B19013); null in 68 rows | — | L 5028; D 5184; X 5244 | — | ZD filter 5956; predictor log10 5962 | — | — | — |
| 11 | `value` | 339400 | median home value, $ (ACS B25077); null in 78 rows | — | L 5027; D 5184; X 5244 | — | — | — | — | — |
| 12 | `own_sh` | 51.4 | owner occupied, % of occupied homes (ACS B25003) | — | L 5025; D 5183; X 5244 | — | predictor 5963 | — | — | — |
| 13 | `sfd_sh` | 52.1 | single family detached share of homes, % (inferred; not labelled in lines 4987-6900) | — | — | — | — | — | — | — |
| 14 | `mf5_sh` | 30.6 | homes in buildings of 5 or more units, % (inferred) | — | — | — | — | — | — | — |
| 15 | `span_sh` | 11.7 | speak Spanish at home, % of residents 5 and over (ACS C16001) | — | L 5032; note at >= 8 5162; D 5185; X 5244 | — | — | — | — | Spanish build flag: span_sh >= P.spanTh (default 8) 6704 |
| 16 | `span_lep_sh` | 4.7 | Spanish speakers with limited English, % of residents 5 and over | — | note text 5162 | — | — | — | — | — |
| 17 | `viet_sh` | 0.4 | speak Vietnamese at home, % (ACS C16001) | — | L 5033; note at >= 3 5163; D 5185; X 5244 | — | — | — | — | — |
| 18 | `french_sh` | 0.7 | speak French or Cajun at home, % (ACS C16001) | — | L 5034; D 5185 | — | — | — | — | — |
| 19 | `hh100k_sh` | 33.0 | households earning $100,000 or more, % (ACS B19001) | — | L 5029 | — | — | — | — | — |
| 20 | `s65_sh` | 18.6 | residents 65 and over, % (ACS B01001) | — | L 5030 | — | — | — | — | — |
| 21 | `density` | 6011 | residents per square mile (precomputed; module 04 recomputes pop / sqmi instead) | — | — | — | — | — | — | — |
| 22 | `gid` | 9025099 | Google Ads location criterion ID of the ZIP; null in 81 rows | — | — | — | — | — | — | K count 6658; "ID" column of the Google Ads Editor CSV 6858 |
| 23 | `hu` | 19447.0 | housing units (ACS B25001) | — | L 5024; T 5054; table 5134; totals 5143; D 5154; X 5244 | homes in 58 and 74 mph winds 5323 | regression weight 6001; X 6084 | — | — | — |
| 24 | `occ` | 17808.0 | occupied homes; overwritten at load with hh (line 580) | 580 | — | — | — | — | — | — |
| 25 | `vac_sh` | 8.4 | vacant homes, % (inferred: (hu - occ) / hu, checked) | — | — | — | — | — | — | — |
| 26 | `seas` | 62.0 | seasonal and recreational homes ("camps"), count (ACS B25004) | — | L 5031 | — | — | — | — | — |
| 27 | `u1` | 11492.0 | one unit homes, count (ACS B25024; differs from roofs by up to 1,459) | — | — | — | — | — | — | — |
| 28 | `mh` | 247.0 | mobile homes, count (ACS B25024) | — | D 5170 | — | — | — | — | — |
| 29 | `mf24` | 1743.0 | homes in 2 to 4 unit buildings, count (inferred) | — | — | — | — | — | — | — |
| 30 | `mf5u` | 5942.0 | homes in buildings of 5 or more units, count | — | D 5170 ("5+ unit homes") | — | — | — | — | — |
| 31 | `mh_sh` | 1.3 | mobile homes, % of housing units (ACS B25024) | — | L 5008; note at >= 20 5161; X 5244 | — | predictor 5961 | — | — | — |
| 32 | `yb_med` | 1975.0 | median year built (ACS B25035); null in 31 rows | — | L 5006; D 5171 | — | — | — | — | — |
| 33 | `rooms` | 5.2 | median rooms (inferred, ACS B25018 is in the source list at 5225) | — | — | — | — | — | — | — |
| 34 | `mort_sh` | 59.6 | owners with a mortgage, % (ACS B25081) | — | L 5026; D 5183; X 5244 | — | — | — | — | — |
| 35 | `pre80_sh` | 60.9 | homes built before 1980, % (ACS B25034; = yb70+yb60+yb50+yb40+ybold over all decades, checked) | — | L 5007 | — | predictor 5960 | — | — | — |
| 36 | `yb20` | 122.0 | homes built 2020 or later, count (ACS B25034) | — | — | — | — | — | — | — |
| 37 | `yb10` | 851.0 | homes built 2010 to 2019, count (ACS B25034) | — | — | — | — | — | — | — |
| 38 | `yb00` | 2156.0 | homes built 2000 to 2009, count (ACS B25034) | — | — | — | — | — | — | — |
| 39 | `yb90` | 1674.0 | homes built 1990 to 1999, count (ACS B25034) | — | — | — | — | — | — | — |
| 40 | `yb80` | 2804.0 | homes built 1980 to 1989, count (ACS B25034) | — | — | — | — | — | — | — |
| 41 | `yb70` | 4338.0 | homes built 1970 to 1979, count (ACS B25034) | — | — | — | — | — | — | — |
| 42 | `yb60` | 3463.0 | homes built 1960 to 1969, count (ACS B25034) | — | — | — | — | — | — | — |
| 43 | `yb50` | 2664.0 | homes built 1950 to 1959, count (ACS B25034) | — | — | — | — | — | — | — |
| 44 | `yb40` | 1008.0 | homes built 1940 to 1949, count (ACS B25034) | — | — | — | — | — | — | — |
| 45 | `ybold` | 367.0 | homes built before 1940, count (ACS B25034) | — | — | — | — | — | — | — |
| 46 | `roofs` | 11607 | one unit roofs (detached and attached homes), count; ACS B25034 x B25127, one roof per one unit home | — | L 4998; totals 5142-5144; D 5170; X 5244 | footStats 5323; T 5447, 5449; tables 5496; 5529, 5531, 5548; D 5573 | — | — | table 6565 | — |
| 47 | `ra_med` | 9 | median roof age, years (renewal model); null in 26 rows | — | L 5004; D 5171; X 5244 | — | — | — | — | — |
| 48 | `ra15` | 4166 | roofs 15 years or older, count (model) | — | — (only ra15_sh is a layer) | — | — | — | — | — |
| 49 | `ra20` | 2810 | roofs 20 years or older, count (model) | — | L 5001; totals 5144; note 5158; D 5172; X 5244 | — | — | — | — | — |
| 50 | `ra15_sh` | 35.9 | roofs 15 years or older, % of one unit roofs (model) | — | L 5000 | — | — | — | — | — |
| 51 | `ra20_sh` | 24.2 | roofs 20 years or older, % of one unit roofs (model) | — | L 4999; T 5056; note at >= 22 5158; D 5172; X 5244 | — | predictor 5965 | — | — | — |
| 52 | `wave` | 1356 | roofs aged 15 to 19, count (= ra15 - ra20, checked) | — | L 5002; totals 5144; D 5172; X 5244 | — | — | — | — | — |
| 53 | `nxt` | 485.9 | age driven replacements expected in the next twelve months (model) | — | L 5003; X 5244 | — | — | — | — | — |
| 54 | `last64` | 2021 | year of the most recent storm with modeled sustained wind of 64 kt or more at the ZIP; null in 178 rows | — | note 5159; D 5173; X 5244 | T 5448; D 5573 | — | — | — | — |
| 55 | `yrs64` | 5 | years since last64 (= 2026 - last64, checked); null in 178 rows | — | L 5005; note at <= 6 5159; D 5173 | D 5573 | — | — | — | — |
| 56 | `hd1` | 1.6 | hail days a year, 1 inch or larger within 25 miles (SPC 1996 to 2025) | — | L 5009; T 5056; D 5176; X 5244 | ZIP shading "30 year rate" via SF.clim 5278-5280, 5462-5465; T 5448; D 5574 | ZD filter 5956; predictor 5959 | — | — | — |
| 57 | `hd175` | 0.6 | hail days a year, 1.75 inch or larger within 25 miles | — | L 5010; note at >= 1.0 5160; D 5176; X 5244 | shading via SF.clim 5281, 5288; D 5574 | — | — | — | — |
| 58 | `hd2` | 0.1 | hail days a year, 2 inch or larger within 25 miles | — | — | shading via SF.clim 5282 | — | — | — | — |
| 59 | `hd1_10` | 1.4 | hail days a year, 1 inch or larger, recent decade 2016 to 2025 | — | L 5011 | — | — | — | — | — |
| 60 | `wd50` | 5.133 | thunderstorm wind days a year, 50 kt (58 mph) or more within 25 miles (SPC 1996 to 2025) | — | L 5012; D 5177; X 5244 | shading via SF.clim 5283-5284, 5289; D 5575 | — | — | — | — |
| 61 | `wd65` | 0.333 | thunderstorm wind days a year, 65 kt (75 mph) or more within 25 miles | — | — | shading via SF.clim 5285 | — | — | — | — |
| 62 | `td1` | 0.833 | tornado days a year, EF1 or stronger within 25 miles (SPC 1996 to 2025) | — | L 5013; D 5177; X 5244 | shading via SF.clim 5286-5287; D 5575 | — | — | — | — |
| 63 | `hur64` | 7.89 | share of years 1950 to 2025 with modeled sustained wind of 64 kt or more at the ZIP, % | — | L 5014; T 5056; D 5178; X 5244 | T 5448; D 5576 | ZD filter 5956; predictor 5958 | — | — | — |
| 64 | `hur50` | 17.11 | share of years 1950 to 2025 with modeled sustained wind of 50 kt or more, % | — | L 5015 | — | — | — | — | — |
| 65 | `ts34` | 60.53 | share of years with modeled sustained wind of 34 kt or more, % (inferred from the name) | — | — | — | — | — | — | — |
| 66 | `n64_00` | 4 | storms 2000 to 2026 with modeled sustained wind of 64 kt or more at the ZIP, count | — | L 5016; D 5178; X 5244 | — (5603 reads the parish field) | — | — | — | — |
| 67 | `n50_00` | 7 | storms 2000 to 2026 with 50 kt or more at the ZIP, count (inferred) | — | — | — | — | — | — | — |
| 68 | `vmax_00` | 95.0 | peak modeled sustained wind at the ZIP since 2000, kt (inferred from the parish field of the same name, 5603) | — | — | — (parish field only) | — | — | — | — |
| 69 | `vmax_20` | 81.0 | peak modeled sustained wind at the ZIP since 2020, kt | — | D 5179 | — | — | — | — | — |
| 70 | `ev_h1` | 0 | NOAA Storm Events hail reports of 1 inch or more located in the ZIP, 2016 to 2026 | — | L 5017; D 5180; X 5244 | D 5577 | outcome "hailrep": ev_h1 / sqmi x 100, 5970 | — | — | — |
| 71 | `ev_h175` | 0 | hail reports of 1.75 inch or more in the ZIP, 2016 to 2026 | — | — | — | — | — | — | — |
| 72 | `ev_w58` | 3 | thunderstorm wind reports of 50 kt (58 mph) or more in the ZIP, 2016 to 2026 | — | L 5018; D 5180; X 5244 | D 5577 | — | — | — | — |
| 73 | `ev_w75` | 0 | wind reports of 65 kt (75 mph) or more in the ZIP, 2016 to 2026 | — | — | — | — | — | — | — |
| 74 | `ev_t` | 0 | tornado begin points in the ZIP, 2016 to 2026 | — | L 5019; D 5180 | D 5577 | — | — | — | — |
| 75 | `ev_dmg` | 1.0 | NOAA estimated property damage of the located reports in the ZIP, $ thousands (inferred from the parish ev.dmg x 1000 at 6307) | — | — | — | — | — | — | — |
| 76 | `fema_k` | 4000 | FEMA IHP registrations with roof damage (2004 to 2017 disasters) or verified wind loss (2020 on), count | — | L 5020; K 5104; totals 5146; D 5181; X 5244 | D 5578 | — | — | — | — |
| 77 | `fema_20` | 605 | the same, disasters since 2020 only | — | K 5104 | D 5578 | — | — | — | — |
| 78 | `fema_ida` | 592 | FEMA verified wind loss registrations, Hurricane Ida, DR 4611 | — | L 5022 | — | — | — | — | — |
| 79 | `fema_laura` | 0 | FEMA verified wind loss registrations, Hurricane Laura, DR 4559 | — | L 5023 | — | — | — | — | — |
| 80 | `fema_rate` | 22.5 | fema_k per 100 occupied homes (checked: fema_k / occ x 100); null in 67 rows | — | L 5021; D 5181 | — | outcome "fema" (logged) 5968 | — | — | — |
| 81 | `est` | 1234 | business establishments, ZIP Code Business Patterns 2023 (inferred: total) | — | — | — | — | — | — | — |
| 82 | `retail` | 98 | retail establishments, NAICS 44 to 45 (ZBP 2023) | — | L 5038 | — | — | — | — | — |
| 83 | `food` | 84 | food service establishments (inferred) | — | — | — | — | — | — | — |
| 84 | `lodging` | 13 | lodging establishments (inferred) | — | — | — | — | — | — | — |
| 85 | `whse` | 8 | warehousing establishments, NAICS 493 | — | L 5036; D 5186 | — | — | — | — | — |
| 86 | `mfg` | 20 | manufacturing establishments, NAICS 31 to 33 | — | L 5037 | — | — | — | — | — |
| 87 | `church` | 13 | religious organizations, NAICS 8131 | — | L 5039; D 5186 | — | — | — | — | — |
| 88 | `health` | 144 | health care establishments (inferred) | — | — | — | — | — | — | — |
| 89 | `school` | 13 | schools (inferred) | — | — | — | — | — | — | — |
| 90 | `apts` | 9 | apartment lessors, NAICS 531110 | — | L 5040 | — | — | — | — | — |
| 91 | `nonres` | 7 | lessors of nonresidential buildings (inferred) | — | — | — | — | — | — | — |
| 92 | `office` | 289 | office type establishments (inferred) | — | — | — | — | — | — | — |
| 93 | `auto` | 9 | auto related establishments (inferred) | — | — | — | — | — | — | — |
| 94 | `roofers` | 5 | roofing contractor establishments in the ZIP, NAICS 238160 (ZBP 2023; cells under three suppressed) | — | L 5042; X 5244 | — | — | D 6203 | T 6519; D 6558 | — |
| 95 | `builders` | 30 | building contractor establishments (inferred) | — | — | — | — | — | — | — |
| 96 | `supply` | 0 | roofing supply wholesalers, NAICS 423330 (inferred from 6446) | — | — | — | — | — | — | — |
| 97 | `ins_agents` | 37 | insurance agencies, NAICS 524210 (inferred from 6446) | — | — | — | — | — | — | — |
| 98 | `adjusters` | 0 | claims adjusters (inferred) | — | — | — | — | — | — | — |
| 99 | `cru` | 883.4 | commercial roofs, estimate (ZBP establishments weighted by building type, scaled to 80,000 statewide) | — | L 5035; D 5186; X 5244 | — | — | — | — | — |
| 100 | `lic` | 9.4 | LSLBC roofing licence records in the ZIP's city, split across the city's ZIPs (fractional) | — | L 5043; X 5244 | — | outcome "lic": lic / pop x 10,000 (logged) 5969 | — | D 6558 | — |
| 101 | `p_replace` | 381.84 | expected replace jobs a year in the ZIP (service line model) | 2172-2173 (SLM.zipLine, zipAll); 2180 (sl_top) | L (2185); totals 5145; D 5168; X 5244 | — | — | profit pool 6151; K 6172; D 6204; plan 6225 | — | markets 6700; line mix 6706; T 6787 |
| 102 | `p_repair` | 350.72 | expected repair jobs a year in the ZIP (service line model) | 2172-2173 (SLM.zipLine, zipAll); 2180 (sl_top) | L (2185); totals 5145; D 5168; X 5244 | — | — | profit pool 6151; K 6172; D 6204; plan 6225 | — | markets 6700; line mix 6706; T 6787 |
| 103 | `p_storm` | 958.24 | expected storm jobs a year in the ZIP (service line model) | 2172-2173 (SLM.zipLine, zipAll); 2180 (sl_top) | L (2185); totals 5145; D 5168; X 5244 | — | — | profit pool 6151; K 6172; D 6204; plan 6225 | — | markets 6700; line mix 6706; T 6787 |
| 104 | `p_hail` | 69.78 | expected hail jobs a year in the ZIP (service line model) | 2172-2173 (SLM.zipLine, zipAll); 2180 (sl_top) | L (2185); totals 5145; D 5168; X 5244 | — | — | profit pool 6151; K 6172; D 6204; plan 6225 | — | markets 6700; line mix 6706; T 6787 |
| 105 | `p_fortified` | 101.56 | expected fortified jobs a year in the ZIP (service line model) | 2172-2173 (SLM.zipLine, zipAll); 2180 (sl_top) | L (2185); totals 5145; D 5168; X 5244 | — | — | profit pool 6151; K 6172; D 6204; plan 6225 | — | markets 6700; line mix 6706; T 6787 |
| 106 | `p_metal` | 71.48 | expected metal jobs a year in the ZIP (service line model) | 2172-2173 (SLM.zipLine, zipAll); 2180 (sl_top) | L (2185); totals 5145; D 5168; X 5244 | — | — | profit pool 6151; K 6172; D 6204; plan 6225 | — | markets 6700; line mix 6706; T 6787 |
| 107 | `p_mh` | 34.75 | expected mh jobs a year in the ZIP (service line model) | 2172-2173 (SLM.zipLine, zipAll); 2180 (sl_top) | L (2185); totals 5145; D 5168; X 5244 | — | — | profit pool 6151; K 6172; D 6204; plan 6225 | — | markets 6700; line mix 6706; T 6787 |
| 108 | `p_mf` | 34.82 | expected mf jobs a year in the ZIP (service line model) | 2172-2173 (SLM.zipLine, zipAll); 2180 (sl_top) | L (2185); totals 5145; D 5168; X 5244 | — | — | profit pool 6151; K 6172; D 6204; plan 6225 | — | markets 6700; line mix 6706; T 6787 |
| 109 | `p_comm` | 86.05 | expected comm jobs a year in the ZIP (service line model) | 2172-2173 (SLM.zipLine, zipAll); 2180 (sl_top) | L (2185); totals 5145; D 5168; X 5244 | — | — | profit pool 6151; K 6172; D 6204; plan 6225 | — | markets 6700; line mix 6706; T 6787 |
| 110 | `p_coat` | 26.5 | expected coat jobs a year in the ZIP (service line model) | 2172-2173 (SLM.zipLine, zipAll); 2180 (sl_top) | L (2185); totals 5145; D 5168; X 5244 | — | — | profit pool 6151; K 6172; D 6204; plan 6225 | — | markets 6700; line mix 6706; T 6787 |
| 111 | `p_newc` | 42.83 | expected newc jobs a year in the ZIP (service line model) | 2172-2173 (SLM.zipLine, zipAll); 2180 (sl_top) | L (2185); totals 5145; D 5168; X 5244 | — | — | profit pool 6151; K 6172; D 6204; plan 6225 | — | markets 6700; line mix 6706; T 6787 |
| 112 | `r_replace` | 97.02 | replace jobs per 10,000 residents a year, shrunk toward the parish rate (prior 2,500 residents) | 2172 (returned as rate, unused by modules 01 to 08) | L (2184); z bar label 5165; X 5244 | — | — | — | — | — |
| 113 | `r_repair` | 90.29 | repair jobs per 10,000 residents a year, shrunk toward the parish rate (prior 2,500 residents) | 2172 (returned as rate, unused by modules 01 to 08) | L (2184); z bar label 5165; X 5244 | — | — | — | — | — |
| 114 | `r_storm` | 247.43 | storm jobs per 10,000 residents a year, shrunk toward the parish rate (prior 2,500 residents) | 2172 (returned as rate, unused by modules 01 to 08) | L (2184); z bar label 5165; X 5244 | — | — | — | — | — |
| 115 | `r_hail` | 17.97 | hail jobs per 10,000 residents a year, shrunk toward the parish rate (prior 2,500 residents) | 2172 (returned as rate, unused by modules 01 to 08) | L (2184); z bar label 5165; X 5244 | — | — | — | — | — |
| 116 | `r_fortified` | 26.24 | fortified jobs per 10,000 residents a year, shrunk toward the parish rate (prior 2,500 residents) | 2172 (returned as rate, unused by modules 01 to 08) | L (2184); z bar label 5165; X 5244 | — | — | — | — | — |
| 117 | `r_metal` | 18.51 | metal jobs per 10,000 residents a year, shrunk toward the parish rate (prior 2,500 residents) | 2172 (returned as rate, unused by modules 01 to 08) | L (2184); z bar label 5165; X 5244 | — | — | — | — | — |
| 118 | `r_mh` | 9.1 | mh jobs per 10,000 residents a year, shrunk toward the parish rate (prior 2,500 residents) | 2172 (returned as rate, unused by modules 01 to 08) | L (2184); z bar label 5165; X 5244 | — | — | — | — | — |
| 119 | `r_mf` | 8.71 | mf jobs per 10,000 residents a year, shrunk toward the parish rate (prior 2,500 residents) | 2172 (returned as rate, unused by modules 01 to 08) | L (2184); z bar label 5165; X 5244 | — | — | — | — | — |
| 120 | `r_comm` | 21.98 | comm jobs per 10,000 residents a year, shrunk toward the parish rate (prior 2,500 residents) | 2172 (returned as rate, unused by modules 01 to 08) | L (2184); z bar label 5165; X 5244 | — | — | — | — | — |
| 121 | `r_coat` | 6.76 | coat jobs per 10,000 residents a year, shrunk toward the parish rate (prior 2,500 residents) | 2172 (returned as rate, unused by modules 01 to 08) | L (2184); z bar label 5165; X 5244 | — | — | — | — | — |
| 122 | `r_newc` | 10.96 | newc jobs per 10,000 residents a year, shrunk toward the parish rate (prior 2,500 residents) | 2172 (returned as rate, unused by modules 01 to 08) | L (2184); z bar label 5165; X 5244 | — | — | — | — | — |
| 123 | `z_replace` | 0.449 | z score of ln(r_replace) across the 441 scored ZIPs (population SD, checked) | — | z bars 5165 | — | — | — | — | — |
| 124 | `z_repair` | 0.361 | z score of ln(r_repair) across the 441 scored ZIPs (population SD, checked) | — | z bars 5165 | — | — | — | — | — |
| 125 | `z_storm` | 0.98 | z score of ln(r_storm) across the 441 scored ZIPs (population SD, checked) | — | z bars 5165 | — | — | — | — | — |
| 126 | `z_hail` | -0.555 | z score of ln(r_hail) across the 441 scored ZIPs (population SD, checked) | — | z bars 5165 | — | — | — | — | — |
| 127 | `z_fortified` | 0.968 | z score of ln(r_fortified) across the 441 scored ZIPs (population SD, checked) | — | z bars 5165 | — | — | — | — | — |
| 128 | `z_metal` | -1.137 | z score of ln(r_metal) across the 441 scored ZIPs (population SD, checked) | — | z bars 5165 | — | — | — | — | — |
| 129 | `z_mh` | -1.362 | z score of ln(r_mh) across the 441 scored ZIPs (population SD, checked) | — | z bars 5165 | — | — | — | — | — |
| 130 | `z_mf` | 2.139 | z score of ln(r_mf) across the 441 scored ZIPs (population SD, checked) | — | z bars 5165 | — | — | — | — | — |
| 131 | `z_comm` | 1.522 | z score of ln(r_comm) across the 441 scored ZIPs (population SD, checked) | — | z bars 5165 | — | — | — | — | — |
| 132 | `z_coat` | 1.245 | z score of ln(r_coat) across the 441 scored ZIPs (population SD, checked) | — | z bars 5165 | — | — | — | — | — |
| 133 | `z_newc` | -0.3 | z score of ln(r_newc) across the 441 scored ZIPs (population SD, checked) | — | z bars 5165 | — | — | — | — | — |
| 134 | `f_replace` | 1640599 | gross profit pool of the replace line, $ a year at default assumptions (= p x REP x VAL x 0.33, checked) | — | — | — | — | — | — | — |
| 135 | `f_repair` | 60474 | gross profit pool of the repair line, $ a year at default assumptions (= p x REP x VAL x 0.33, checked) | — | — | — | — | — | — | — |
| 136 | `f_storm` | 2150285 | gross profit pool of the storm line, $ a year at default assumptions (= p x REP x VAL x 0.33, checked) | — | — | — | — | — | — | — |
| 137 | `f_hail` | 185954 | gross profit pool of the hail line, $ a year at default assumptions (= p x REP x VAL x 0.33, checked) | — | — | — | — | — | — | — |
| 138 | `f_fortified` | 604937 | gross profit pool of the fortified line, $ a year at default assumptions (= p x REP x VAL x 0.33, checked) | — | — | — | — | — | — | — |
| 139 | `f_metal` | 539683 | gross profit pool of the metal line, $ a year at default assumptions (= p x REP x VAL x 0.33, checked) | — | — | — | — | — | — | — |
| 140 | `f_mh` | 45414 | gross profit pool of the mh line, $ a year at default assumptions (= p x REP x VAL x 0.33, checked) | — | — | — | — | — | — | — |
| 141 | `f_mf` | 448109 | gross profit pool of the mf line, $ a year at default assumptions (= p x REP x VAL x 0.33, checked) | — | — | — | — | — | — | — |
| 142 | `f_comm` | 1327547 | gross profit pool of the comm line, $ a year at default assumptions (= p x REP x VAL x 0.33, checked) | — | — | — | — | — | — | — |
| 143 | `f_coat` | 174919 | gross profit pool of the coat line, $ a year at default assumptions (= p x REP x VAL x 0.33, checked) | — | — | — | — | — | — | — |
| 144 | `f_newc` | 38864 | gross profit pool of the newc line, $ a year at default assumptions (= p x REP x VAL x 0.33, checked) | — | — | — | — | — | — | — |
| 145 | `idx` | 88.6 | Roof Demand Index, percentile 0 to 100 across scored ZIPs of the weighted sum of z scores; null in 93 unscored rows | 581 (ZR needs idx != null) | L 4992; T 5056; sort 5069; table 5133; D 5153, 5164; top 25 5248; X 5244 | — | (via ZR) | coherence check 6244, 6248 | — | — |
| 146 | `idx_eq` | 84.1 | the same index with equal weights | — | L 4993; X 5244 | — | — | — | — | — |
| 147 | `fees` | 7216785 | gross profit pool, all eleven lines, $ a year at default assumptions (= sum of f_*) | 5048 (fees_pc) | L 4994; T 5056; table 5134; totals 5147; X 5244 | — | — | — (recomputed from p_* with the current assumptions) | T 6519; whitespace layer 6523; reach 6538; table 6565 | — (recomputed) |
| 148 | `cases` | 1617.87 | jobs a year open to marketing, all lines (= sum of p x REP, checked) | — | L 4996; X 5244 | — | — | — (recomputed) | — | — |
| 149 | `gi` | 3.96 | Getis Ord Gi* z statistic on idx (ZIP and its eight nearest neighbours) | — | L 4997 (diverging scale 5118); note 5157; X 5244 | — | — | — | — | — |
| 150 | `gicls` | "H99" | Gi* class: H99, H95, H90, C99, C95, C90, ns | — | note when it starts with H 5157; X 5244 | — | — | — | — | — |
| 151 | `comp_mass` | 13.34 | distance weighted presence of the mapped roofing companies | — | L 5041 | — | — | — | — | — |
| 152 | `comp_n25` | 8 | mapped roofing company offices within 25 km, count | — | D 5187 | — | — | D 6203 | K 6475, 6515; T 6519; layers 6523-6524; whitespace table 6565 | — |
| 153 | `roof_mass` | 79.67 | distance weighted roofing establishments and licence records nearby (the 40 percent half of comp_pct) | — | — | — | — | — | — | — |
| 154 | `roof_per10k` | 3.7 | roofing contractors plus licence records per 10,000 residents (about (roofers + lic) / pop x 10,000); null in 58 rows | — | — | — | — | — | layer 6524; D 6558 | — |
| 155 | `comp_pct` | 96.6 | competitive pressure percentile, 0 to 100 | — | L 5044; D 5187; X 5244 | — | — | 6151 (quadrant split at 60, map layer, scatter x) | T 6519; layer 6524; D 6558 | — |
| 156 | `cpc_rel` | 1.186 | relative cost per click (= DMA factor of the region x (0.8 + 0.4 x comp_pct / 100), checked exactly) | 2170, 2175 (SLM.blended, allocate) | — | — | — | efficiency = fees / max(0.3, cpc_rel) 6151; D 6197-6202 | — | efficiency 6700; forecast 6710; Max CPC 6864 |
| 157 | `eff` | 6084979 | fees / cpc_rel, precomputed for all eleven lines | — | — | — | — | — (recomputed live) | — | — |
| 158 | `effb` | 94.8 | percentile of eff, precomputed | — | — | — | — | — (recomputed as x.pct) | — | — |
| 159 | `oppb` | 97.7 | percentile of fees, precomputed | — | — | — | — | — (recomputed as x.opp) | — | — |
| 160 | `quad` | 0 | quadrant 0 Anchor, 1 Whitespace, 2 Niche, 3 Avoid, precomputed for all lines | — | pill "Paid: ..." 5155 | — | — | — (recomputed) | — | — |
| 161 | `tier` | "A" | paid tier A+, A, B, C, D, E, precomputed for all lines | — | X 5244 | — | — | — (recomputed) | — | markets table 6815; X 6879 |
| 162 | `bid` | 20 | bid modifier, % (+30, +20, +10, 0, -20, -50), precomputed | — | X 5244 | — | — | — (recomputed) | — | bidOf 6653 (default bid modifier in every export) |
| 163 | `res_ok` | 1 | 1 when the ZIP has 500 or more residents and is scored (441 rows), else 0 | 581 (ZR filter) | 5119, 5139 | 5529-5530, 5541 | (via ZR) | (via ZR) | 6519, 6523-6524 | 6787, 6802 |
| 164 | `metal_sh` | 6.8 | modeled metal roof share, % (used by modules 12 and 17, not by 01 to 08) | — | — | — | — | — | — | — |

Columns read by none of modules 01 to 08 (56): `reg`, `wsqmi`, `hh` (copied to `occ` at load, nothing else), `sfd_sh`, `mf5_sh`, `density`, `occ`, `vac_sh`, `u1`, `mf24`, `rooms`, `yb20`, `yb10`, `yb00`, `yb90`, `yb80`, `yb70`, `yb60`, `yb50`, `yb40`, `ybold`, `ra15`, `ts34`, `n50_00`, `vmax_00`, `ev_h175`, `ev_w75`, `ev_dmg`, `est`, `food`, `lodging`, `health`, `school`, `nonres`, `office`, `auto`, `builders`, `supply`, `ins_agents`, `adjusters`, the eleven `f_*` columns, `roof_mass`, `eff`, `effb`, `oppb`, `metal_sh`. Some of these are read by modules outside my range (a quick token scan finds the decade columns, `u1`, `mf24`, `ra15`, `metal_sh` and the business counts in `24_m12_lines.js` and `31_m17_stock.js`, and `effb` in `23_m11_regions.js`); I did not verify those. `eff`, `effb`, `oppb`, `quad`, `tier`, `bid` are a precomputed copy, for all eleven lines at default assumptions, of what module 05 recomputes live.

Relations between columns that I checked on all rows (useful as build tests for California):

- `f_<line>` = `p_<line>` x `META.model.REP[line]` x `META.model.VAL[line]` x `META.model.FEE` (0.33), to rounding. `fees` = sum of the eleven `f_*`. `cases` = sum of `p_<line>` x `REP[line]`.
- `r_<line>` = (`p_<line>` + 2,500 x parish rate) / (`pop` + 2,500) x 10,000, where the parish rate is the sum of `p_<line>` over the parish's ZIPs divided by the sum of their `pop` (matches to 0.03). This is the "empirical Bayes prior worth 2,500 residents" of line 5195.
- `z_<line>` = (ln `r_<line>` minus its mean) / its population standard deviation, over the 441 scored ZIPs.
- `idx` is the percentile rank among the 441 scored ZIPs of the sum over lines of `META.model.W[line]` x `z_<line>` (reproduced to within half a percentile point); `idx_eq` is the same with every weight 1.
- `META.model.W[line]` = (line's share of `META.fees_tot`) x `META.model.TIER[line]`; the weights are not rescaled and sum to 0.787.
- `cpc_rel` = `META.model.DMA[region]` x (0.8 + 0.4 x `comp_pct` / 100), exact. `eff` = `fees` / `cpc_rel`. `effb` and `oppb` are the percentile ranks of `eff` and `fees`. `tier` follows `effb` with cuts at 95, 85, 65, 40, 15; `bid` follows `tier` (+30, +20, +10, 0, -20, -50); `quad` = 0 when `oppb` >= 60 and `comp_pct` >= 60, 1 when only `oppb` >= 60, 2 when neither, 3 when only `comp_pct` >= 60. All exact.
- `wave` = `ra15` - `ra20`; `yrs64` = 2026 - `last64`; `fema_rate` = `fema_k` / `occ` x 100; `pre80_sh` = (`yb70`+`yb60`+`yb50`+`yb40`+`ybold`) / all ten decade columns; `occ` = `hh` in every row; `res_ok` = 1 exactly when `pop` >= 500 (441 rows), and `idx` is non null exactly on those rows.
- `ev_h1`, `ev_w58`, `ev_t`, `ev_dmg` equal the counts (and summed damage, $ thousands) of the `pts` records whose ZIP index points at the row. Parish `ev.*` equal the same counts by parish index.
- State sums of `pop`, `roofs`, `ra15`, `ra20`, `wave`, `nxt`, `p_*` over the ZIP rows equal the `meta` totals. `meta.hu`, `meta.mh`, `meta.u1`, `meta.seas`, `meta.occ`, `meta.own`, `meta.rent` and `meta.yb` are the sums of the parish records instead, and the ZIP sums run slightly lower (2,108,420 against 2,108,902 homes). `meta.pop` (4,611,100) is the ZIP sum; the parish records sum to 4,611,961.
- A stored `tier` differs from the tier module 05 computes live in 5 of 441 ZIPs and a stored `quad` in 1 (percentile rounding), so do not expect module 01's pill, module 08's table and module 05's map to agree to the last ZIP.

---

## Part B. Every other structure in `window.__ATLAS_DATA__` and the modules that read it

Module numbers are 01 to 08; "core" is `00_core.js`, "map" is `02_map.js`, "SLM" is `09_sl_model.js`. A field with no module listed is read by none of modules 01 to 08.

### B1. `parishes` (64 objects, one per parish; array order is the parish index `pi`; core adds `p.i` at line 571)

| field | meaning (example: Acadia) | read by |
|---|---|---|
| `fips` | 5 digit county FIPS, "22001" | key of `PAI` (571) and of `geo.parish`, `geo.pcent`; 01: 5081, 5140; 02: 5365, 5413, 5424; 05: 6122, 6239; 06: 6374, 6410, 6451; 08: 6669, 6699 |
| `name` | parish name without the word Parish, "Acadia" | every module with a parish menu, tooltip or table: 01 5081, 5140; 02 5365, 5431, 5536, 5560, 5603, 5666, 5732; 05 6122, 6238, 6240, 6283; 06 6372, 6389, 6415, 6427, 6451; 07 6566; 08 6669; map 904, 993 |
| `reg` | region number 1 to 9 | 01 5115, 5154, 5239; 02 5424 to 5425, 5726; 05 6148, 6197, 6238, 6240, 6253, 6280, 6282 to 6283; 06 6372, 6389, 6451; 07 6579; map 993 |
| `aland` | land area, square metres (1,697,073,812) | 06: `sqmiP = max(1, aland / 2.58999e6)` (6297) |
| `awater` | water area, square metres | — |
| `pop` | residents (56,955) | 06 6314, 6315, 6389, 6420, 6451; 07 6566; map 993 |
| `hh`, `inc`, `value`, `own`, `spanish`, `viet`, `french`, `pop5`, `a65p`, `occ`, `rent`, `u1`, `mf5u`, `seas`, `yb_med`, `mort_sh`, `rooms` | ACS counts and medians for the parish | — |
| `hu` | housing units (25,107) | 06 6301, 6302, 6307, 6310, 6313, 6316, 6324, 6389, 6394, 6415, 6451; map 993 |
| `mh` | mobile homes | 06 6313 |
| `yb` | ten counts of homes by decade built, newest first (2020 on, 2010s, 2000s, 1990s, 1980s, 1970s, 1960s, 1950s, 1940s, before 1940) | 06 6312: `sum(yb.slice(5)) / sum(yb)` = built before 1980 |
| `roofs`, `ra20`, `wave` | one unit roofs, roofs 20 years or older, roofs aged 15 to 19 (model) | 06 6402 |
| `ra15`, `nxt` | roofs 15 or older; age driven replacements next twelve months | — |
| `hist` | `{year: [wear replacements, storm replacements]}`, 2000 to 2026 (model) | 02 5603: sum of the storm element = "Roofs replaced after storms, 2000 to 2026 (model)" |
| `hd1` | hail days a year, 1 inch or larger within 25 miles, parish value | 06 6420, 6422 |
| `hd175`, `wd50`, `wd65`, `td1`, `hur50`, `ts34`, `vmax_20` | parish hazard rates | — |
| `hur64` | chance of hurricane force winds in a year, % | 02 5414; 06 6415, 6418 |
| `n64_00`, `vmax_00` | hurricane force storms since 2000; strongest modeled wind since 2000, kt | 02 5603 |
| `ev` | `{h1, h175, w58, w75, t, ef1, dmg, n}`: counts of located NOAA reports 2016 to 2026 in the parish (hail 1 inch, hail 1.75 inch, wind 58 mph, wind 75 mph, tornadoes, EF1 or stronger, damage in $ thousands, all reports) | 02 5414 (`n`, `h1`, `h175`, `w58`, `t`); 06 6303 to 6307, 6362, 6392, 6397 to 6398, 6451 |
| `trop` | `{hurr, ts, surge, hw}`: NOAA Storm Events zone records since 2000 (hurricane, tropical storm, storm surge, high wind), matched to the parish | 02 5603; 06 6308, 6309, 6357, 6396 |
| `fema` | `{disaster number: registrations}` (FEMA IHP roof and wind registrations by declared disaster) | 06 6299 (`femaSince`), 6377, 6390, 6394 |
| `fema_k` | sum of `fema` (6,752) | 02 5414, 5603; 06 6301, 6324, 6362, 6427, 6451 |
| `bps` | `{year: [a, b, c]}`, 2005 to 2025, Census Building Permits Survey. Element 1 is housing units authorized, all building sizes (6310). Element 0 sums to the state's one unit figure, so it is one unit homes (inferred). Element 2 is small (51 statewide in 2025; inferred: buildings of five or more units) | 06 6310, 6380 (element 1 only) |
| `ytd26`, `ytd25` | homes permitted January to August 2026 and 2025 | 06 6311, 6380 |
| `est`, `cru`, `supply`, `adjusters` | establishments, commercial roofs, supply houses, adjusters | — |
| `roofers` | roofing contractor establishments, ZIP Business Patterns summed to the parish | 06 6314, 6407; 07 6566 |
| `lic` | LSLBC roofing licence records (fractional, by mailing city) | 06 6315, 6407, 6451; 07 6566 |
| `ins_agents` | insurance agencies | 06 6408 |
| `nzip` | ZIPs in the parish | 06 6389 |
| `fees` | gross profit pool, all lines, default assumptions | 06 6316, 6403 |
| `comp` | mapped competitor offices in the parish | 06 6408; 07 6566 |
| `cbp_roof` | roofing contractor establishments in County Business Patterns 2023 (null unless published: 18 of 64 parishes) | 06 6407, 6451; 07 6566 |
| `cbp_roof_emp` | their employees | — |
| `cbp_sup` | roofing supply wholesalers, County Business Patterns | 06 6408 |
| `p_<line>` (eleven) | expected jobs a year by service line | 06 6404 |

### B2. `cities` (265 objects; USPS cities of 1,500 residents or more)

Fields: `name`, `pi` (parish index), `pop`, `nzip`, `zips` (array), `lat`, `lon`, `fees`, `comp` (the CSV header at 6452 calls it "mapped_roofers_within_8km"), `roofers`, `lic`, `span` (Spanish speakers, count), `viet` (Vietnamese speakers, count), `hu`, `roofs`, `ra20`, `p_<line>` (eleven).

- 05: city rollup 6240 to 6241 reads `zips`, `name`, `pi`, `pop`, `comp`.
- 06: 6391 (`pi`, `pop`, `name`: six largest cities of a parish); cities table 6428 (`name`, `pi`, `pop`, `roofs`, `ra20`, `p_replace`, `p_storm`, `p_hail`, `p_repair`, `fees`, `comp`, `lic`, `span`, `viet`); cities CSV 6452 (adds `nzip` and all eleven `p_<line>`).
- 07: 6577 (`span`, `name`: the four cities with the most Spanish speakers).
- `lat`, `lon`, `roofers`, `hu`: not read by modules 01 to 08.

### B3. `places` (171 objects: `name`, `lat`, `lon`, `pop`, `cdp`)

Census places used for map labels and for naming where a report fell. Map: `MAP_CITIES` (870 to 876) keeps places of 20,000 residents or more plus a hard coded list of 77 Louisiana town names (line 871). 02: `nearPlace` (5314) reads `lat`, `lon`, `pop`, `name`. `cdp` is never read.

### B4. `geo` (drawing only, through the `ZipMap` class at 880 to 989)

`W` 2400, `H` 2182 (SVG view box), `minx` -94.1, `maxy` 33.05, `kx`, `sx` (projection: x = (lon - minx) x kx x sx, y = (maxy - lat) x sx, line 868), `outline` (state outline path), `neighbors` (3 paths keyed Texas, Arkansas, Mississippi, drawn as grey background), `parish` (64 paths by FIPS), `zcta` (534 paths by ZIP), `water` (443 paths), `pcent` (parish label points by FIPS, [lon, lat]). No module in 01 to 08 touches `geo` directly; every one except 03 and 04 builds a `ZipMap`.

### B5. Storm tracks: `seg`, `routes`, `rlist`, `sids`, `zstorm`

`seg` (432 arrays) becomes `SEGS` at 879: `[0]` storm label ("Rita 2005") -> `r`; `[1]` SVG path -> `d`; `[2]` mean sustained wind of the leg, kt -> `v`; `[3]` Saffir Simpson category of the leg (-1 below tropical storm force, 0 tropical storm, 1 to 5) -> `cat`; `[4]` status code (TS, HU, TD, EX, LO, DB, SS) -> `stc`; `[5]` central pressure, mb -> `p`; `[6]` start time "2005-09-24T12" (UTC) -> `t`; `[7]`, `[8]` midpoint latitude and longitude; `[9]` nearest parish index. Read by 01 (5114: `r`, `t`, `cat`, `v`; 5122: `cat >= 3`) and 02 (5415, 5476 to 5481, 5549, 5556: `r`, `t`, `v`, `stc`, `cat`, `p`). The midpoint and parish index are not read by 01 to 08.

`routes` (38 objects) becomes `RT` and `RTI[r]` at 586: "named storms 2002 to 2026 with a Louisiana wind footprint".

| field | meaning (example: Katrina 2005) | read by |
|---|---|---|
| `r` | label "Katrina 2005", the key everywhere | 02 throughout; 08 6675 |
| `id` | NHC storm id "AL122005" | — |
| `name`, `year`, `month` | "Katrina", 2005, 8 | 02 5362, 5407, 5436, 5490, 5550, 5613 to 5616; 08 6675, 6743, 6831 |
| `op` | true for the three 2026 storms taken from operational best tracks (preliminary) | 02 5344, 5407, 5513, 5550, 5731 |
| `cat` | Saffir Simpson class of the strongest modeled wind over Louisiana ZIPs (-1, 0, 1 to 5) | 02 5350, 5438 |
| `vmax` | strongest modeled sustained wind over a Louisiana ZIP, kt (112) | 02 5438, 5615 |
| `life` | lifetime peak wind of the storm, kt (150) | 02 5300 (`stormKind` uses `life` or `vmax`), 5551 |
| `n34`, `n50`, `hu50`, `hu64`, `est` | precomputed footprint totals | — (module 02 recomputes them in `footStats` from `zstorm`; the recomputed roofs damaged differ from the stored `est` by a fraction of a percent in 30 of 38 storms) |
| `n64` | ZIPs with 64 kt or more | 02 5344 (count of storms with hurricane force winds) |
| `dr`, `fema` | FEMA disaster number and statewide roof and wind registrations, null when no individual assistance declaration | 02 5403, 5438, 5517, 5555, 5616, 5707, 5731 |
| `lf` | Louisiana landfall `{t, lat, lon, v (kt), cat, p (mb)}` or null | 02 5509, 5552 |
| `pars` | `[[parish index, homes in 50 kt winds], ...]`, descending | 02 5560, 5610 |
| `start`, `end` | dates of the track | — |

`rlist` (38 labels) becomes `RLIST` (587) and is never used.

`sids` (119 arrays `[name, year, Louisiana category, peak Louisiana wind kt]`, 1950 to 2026): "every storm in the ZIP footprints" (588). 02 builds `SIDX["name year"]` (5302) and lists a ZIP's storms (5571 to 5581).

`zstorm` (`{zip: [[index into sids, peak sustained wind at the ZIP in kt], ...]}`; only winds of 34 kt or more are stored; range 34 to 129): 02 `stormFoot` (5305) inverts it into storm -> ZIP -> wind; 02 5571 reads a ZIP's own list.

### B6. Storm reports: `pts`, `ptflags`

`pts` (5,115 arrays) becomes `PTS` objects at 591: "NOAA Storm Events reports 2016 to 2026: k = 0 hail (mag inches), 1 thunderstorm wind (mag knots), 2 tornado (mag EF)" (590). Positions: `[0]` lat, `[1]` lon, `[2]` year `y`, `[3]` month `m`, `[4]` weekday `dw` (1 = Sunday to 7 = Saturday, see `DOW` 5268), `[5]` hour `h` (0 to 23, local standard time), `[6]` kind `k`, `[7]` magnitude `mag`, `[8]` flag bits `b`, `[9]` parish index `pi`, `[10]` ZIP row index `zi` (-1 when the point falls in no ZIP; 42 points), `[11]` property damage `dmg` in $ thousands.

`ptflags` = `['h1','h175','h2','w58','w75','ef1','dmg','night','measured','hurr','trop']`, the bit order of `b` (589, 592). Definitions, checked against the data with zero mismatches: `h1` hail of 1 inch or more (1,053 points); `h175` 1.75 inch or more (255); `h2` 2 inch or more (86); `w58` thunderstorm wind of 50 kt or more (3,153); `w75` 65 kt or more (248); `ef1` tornado rated EF1 or stronger (518); `dmg` damage of $10,000 or more (824); `night` hour 20 to 5 (1,506); `measured` wind measured by an instrument (191). `hurr` and `trop` are set on no point and read by no code.

Read by 02 (everything) and 06 (6325: `dmg`; 6380 to 6381: `pi`, `y`, `k`, flags `h1`, `w58`; 6386: `y`, `m`).

### B7. `ts` (time series)

| key | shape and meaning | read by |
|---|---|---|
| `month` | `{hail, wind, torn}`, 12 counts each: Storm Prediction Center reports for Louisiana by month, 1996 to 2025 | SLM 2129 to 2139 (seasonal curves); 04 6013, 6046, 6085 |
| `hour` | `{hail, wind, torn}`, 24 counts each, same source, by hour (local standard time) | 04 6039 to 6043, 6085 |
| `year` | `{"1996".."2025": {hail, hail1, hail2, wind, wind65, torn}}`: SPC reports by year (all hail, 1 inch, 2 inch, all wind, 65 kt, tornadoes) | 02 5604, 5608, 5687 |
| `dowhour` | 7 x 24 counts of the `pts` records | — (module 02 rebuilds the grid from `PTS`) |
| `trop_month` | 12 counts: named storms that brought tropical storm force winds to Louisiana, by month, 1950 to 2025 (sum 84) | SLM 2129; 02 5685 to 5686; 04 6013 |
| `fema_year` | 18 rows `[disaster number, event name, year, registrations, roof flag (true = "roof damage" measure, false = "wind loss" measure), owners, registrants reporting homeowners insurance]` | core 615 (`FEMA_INS`); 02 5680 to 5684; 06 6298, 6377, 6390 |
| `replace_hist` | `{"2000".."2026": [wear replacements, storm replacements]}`, statewide, model | 02 5341 to 5342, 5674 to 5679 |
| `ppi` | `{asph, steel}` monthly producer price indexes 2019 to August 2026 | — (module 17) |
| `permits` | `{"2005".."2025": [one unit homes, all housing units, buildings]}` statewide (meaning of elements 0 and 2 inferred from their sizes) | 04 5973, 6035 (element 0: "new homes enter at about ... a year"); 06 6326, 6358, 6380, 6386, 6392 (element 1) |
| `ytd26`, `ytd25` | homes permitted January to August 2026 (9,022) and 2025 (10,249) | 06 6358, 6380, 6386 |
| `agehist` | 41 counts: one unit roofs statewide by modeled age 0 to 39 and 40 or more, in 2026 (equals the sum of `agez`) | 04 5973 |

### B8. `agez`, `rhist`

`agez[zip]`: 41 counts of one unit roofs by modeled age (0 to 39, then 40 or more). 01: `ageHist` (5061) sums it over ZIPs; 5189 draws one ZIP.

`rhist[zip]`: 27 pairs `[wear replacements, storm replacements]` for 2000 to 2026 (model). 02: 5584 to 5585 (ZIP storm history chart). Sums over ZIPs equal `ts.replace_hist`.

### B9. `hosp` (161 hospital records)

Never referenced anywhere in the file (no `DATA.hosp`, no `hosp` token outside the data line). `meta.nhosp` is likewise unused. It looks like a leftover from an earlier atlas; a California build can drop it.

### B10. `comp` (29 mapped roofing companies; becomes `COMP` at 584)

Fields: `name`, `domain`, `url`, `hq` (city), `tier` (`statewide`, `national`, `regional`, `local`), `seg` (`res`, `comm`, `both`), `lines` (service line keys the company markets), `verified` (true when read on its own site), `asof`, `cities` (service cities it lists), `phone`, `title`, `desc`, `h1` (as read on the site), `social` (URLs), `spanish` (bool; false for all 29), `fin` (bool), `cert` (manufacturer names: Owens Corning, CertainTeed, GAF), `notes`, `offices` (array of `{city, lat, lon, hq}`; 34 in all, geocoded to the city centre).

Read by 01 (5083 count; pins 5114, 5123: `offices`, `tier`, `name`, `hq`, `verified`), 05 (pins 6167; 6266 count) and 07 (every field).

### B11. `meta`

| key | value now | read by |
|---|---|---|
| `compiled` | "2026-10-06" | 02 5719; 04 6082; 06 6449 (01, 05 and 07 print the date as a literal instead) |
| `nzip` | 534 | 01 5072, 5236 |
| `nres`, `npar`, `nstorm`, `nhosp`, `ncomp`, `occ`, `own`, `rent`, `u1`, `yb`, `seas`, `mort_sh`, `ra15` | 441, 64, 38, 161, 29, ... | — |
| `pop` | 4,611,100 | 04 6020 |
| `hu` | 2,108,902 | 01 5072 |
| `mh`, `yb_med` | 264,776; 1983 | 01 5106 |
| `roofs`, `ra20`, `wave`, `nxt` | 1,483,211; 233,714; 193,301; 51,690 | 01 5072, 5106 to 5108 |
| `npts` | 5,115 | 01 5076 |
| `ncomp_ver` | 27 | 01 5234; 05 6266; 07 6477, 6481, 6510, 6583 |
| `cbp` | `{est: 267, emp: 1724, ap, sup_est, sup_emp}` County Business Patterns 2023, roofing contractors | 06 6359 (`est`, `emp`); 07 6481 (`est`) |
| `nes` | `{est2381: 4899, rcpt2381}` Nonemployer Statistics, NAICS 2381 | 06 6359; 07 6481 (`est2381`) |
| `lic` | `{n: 950, firms: 824, inla: 648, out: 302, top: [[city, records] x 25]}` LSLBC roofing licence roster mirror | 01 5234 (`n`); 02 5692, 5698 (`out`, `n`); 04 5974, 6020 (`inla`, `out`); 06 6327, 6360 (`n`, `firms`, `out`); 07 6477, 6481, 6513, 6568 to 6570 (all five) |
| `ahs` | American Housing Survey 2023 rates | — |
| `fort` | `{grant: 10000, round26: 3000, lfhp26: 8e7, restore26: 2e7, total26: 1e8, anchor: 9000}` | 03 5811, 5878, 5880 (`grant`, `round26` only) |
| `pools` | expected jobs a year by line, statewide (sum 236,327) | 01 5070, 5109 (`storm`); 04 5972, 6016, 6036 |
| `cases` | jobs open to marketing by line (sum 172,763) | 04 5972 |
| `fees` | gross profit pool by line | — |
| `fees_tot` | 705,313,938 | 01 5111 |
| `model.W`, `model.TIER` | index weights and confidence tiers by line | 01 5068, 5194, 5196 |
| `model.corr` | 11 x 11 Pearson correlations of the standardized line rates | 01 5199 |
| `model.sens` | `[Pearson, Spearman]` of weighted against equal weight index: 0.895, 0.883 | 01 5199 |
| `model.val` | `{n: 292, rho_clim: 0.618, p_clim, rho_wind: 0.771, p_wind}` | 01 5070, 5203 to 5205 |
| `model.valpts` | 292 rows `[zip, clim, wind, obs]` | 01 5201 |
| `model.REP`, `model.VAL`, `model.FEE` | share of jobs open to marketing, default job value in $, gross margin 0.33 | SLM 2148 to 2160 (defaults behind every profit figure in 01, 05, 08) |
| `model.GRADE`, `model.P2R`, `model.ANCH` | grades by line; parish FIPS to region; model anchors | — |
| `model.DMA` | cost factor by region number (1.00 Greater New Orleans to 0.62 Northeast) | 05 6197, 6253 |
| `model.REG` | region number to name | core 577 (`REGN`), used by every region menu |
| `model.DMG` | `{smax: 0.5214, v50: 69.72, w: 7.263, n: 2055, M: 2.0, rho: 0.731}` logistic damage curve | 02 5307 (`smax`, `v50`, `w`), 5707, 5712 (`n`, `rho`) |
| `model.WB` | `{L: 22, k: 3, rho: 0.015, fit}` Weibull roof life | 04 5946 (`L`, `k`) |

---

## Part C. Shared machinery the eight modules depend on

### C1. Fields created at load time (not in the data file)

| field | created at | definition | used by |
|---|---|---|---|
| `z.fips` | 580 | `parishes[z.pi].fips` | scope filters in 01, 02, 05, 08 |
| `z.cty` | 580 | `parishes[z.pi].name` (printed as "<name> Parish") | tooltips, detail panels and CSVs in 01, 02, 04, 05, 07, 08 |
| `z.occ` | 580 | overwritten with `z.hh` | — |
| `z.city` | 580 | falls back to the parish name when null | all |
| `ZR` | 581 | ZIPs with `res_ok` and a non null `idx`: "residential ZIPs scored by the models (500+ residents)", 441 rows | the universe of 01, 04, 05, 07, 08 |
| `z.sl_top` | 2180 | the line with the largest gross profit pool in the ZIP under the current assumptions | 01 tooltip 5056 |
| `z.fees_pc` | 5048 | `fees / pop x 1000` when `pop >= 200`, else null | 01 layer "Gross profit pool per 1,000 residents" |
| `p.i` | 571 | index of the parish | 05 6238; 06 6391, 6393 |
| `FEMA_INS` | 615 | from `ts.fema_year`: `n` = sum of registrations, `own` = owners, `ins` = insured, `sh` = `ins / n x 100` (43.2), `ownSh` = `ins / own x 100` (53.7) | 01 5020, 5211; 02 5684; 06 6301, 6430 through `inTen()` ("about four in ten") |
| `RTS[r]` | 5324 | `footStats(r)` for each of the 38 storms: `{n34, n50, n64, hu50, hu64, est, vmax}` | 02; 08 6675; later modules |

### C2. Helpers defined before line 4987 that the modules call

- Core (563 to 764): formatters `N`, `D`, `S`, `DS`, `P`, `M$`, `MM`, `K`, `dateL`, `dateS`, `inTen`, `esc`; statistics `sum`, `mean`, `median`, `pearson`; scales `qScale` (eight quantile classes), `divScale`, `ramp`; UI builders `mastHTML`, `kpiHTML`, `callout`, `card`, `srcRows`, `proseTable`, `judgList`, `dataTable`, `wireSeg`; files `saveFile`, `toCSV`, `copyText`; router `registerModule`, `goModule`, `BUS`; `store` (localStorage); `houseClean` (strips hyphens and dashes from copy, and rewrites `I-10` to "Interstate 10" and `US-90` or `LA-1` to "US 90", "LA 1" at line 645: the `LA` there is the Louisiana highway prefix); `catLab` (599: "below storm force", "tropical storm", "Category n"); `ktMph`.
- Constants at 593 to 596: `LINE_KEYS = ['replace','repair','storm','hail','fortified','metal','mh','mf','comm','coat','newc']`, `RES_LINES` (first seven), `COM_LINES` (last four), `YEARS_F` (2016 to 2026, unused by 01 to 08).
- Brand (766 to 858): `BRAND` (company name, `lic` = LSLBC licence number, `licClass`, `city`, `offices`, `phone`, `url`, `financing`, `warranty`, `certs`, `fortified`, `contact`; defaults `juris: 'Louisiana'`, `state: 'LA'`, map point 30.4515, -91.1871), `brandSet`, `brandOffices`, `BRANDX.panel`. Module 08 reads these for every ad.
- Map (862 to 993): `GEO`, `proj`, `MAP_CITIES`, `SEGS`, class `ZipMap` (methods `fill`, `fillParish`, `dim`, `select`, `selectParish`, `roads`, `showRoads`, `selectSeg`, `fitTo`, `fitParishes`, `fitRoute`, `pins`, `points`, `reset`), `legendHTML`, `parishTip` (prints "<name> Parish", region, homes, residents and "Click for the parish ledger").
- Charts (996 to 1132): `lineChart`, `barChart`, `hbarChart`, `scatter` (returns Pearson `r`), `coefPlot`, `corrMatrix`, `legendRow`.
- Content (1135 to 1361): `LAWX` (the law register, 20 items and 3 pending, "asof: '2026-10-06'"), `ADRULES` (15 rows), `PL` and `PLI` (the eleven service lines with `name`, `short`, `tok`, `g`, `seg`, `unit`, `what`, `law`, `angles`, `kw`, `kwEs`, `neg`), `LAWLINK`, `NEG_COMMON`, `fillCopy` (fills `{City}`, `{Parish}`, `{Company}`, `{Lic}`, `{Office}`, `{Phone}`; falls back to "Louisiana", "LSLBC license number", "Your company").
- Satchel rules (1365 to 1437): `SAT.rules` (31), `SAT.web` (6), `SAT.controls` (10), `satchelLint`, `satCtx`. Module 08 lints every ad with them and prints the rule list.
- Service line model `SLM` (2117 to 2190): assumptions `SLM.A` (stored in localStorage `up.slm.v1`; defaults `cpc: 38`, `budget: 15000`, `alpha: 1.2`, `fee: META.model.FEE`, and per line `rep` and `val` from `META.model.REP` and `VAL` plus hard coded `cpcMul`, `cvr`, `close`), `SLM.SEA` (monthly demand indexes by line), `SLM.zipLine(z, k)` = `{pool: p_k, cases: p_k x rep, fees: cases x val x fee, rev, rate: r_k}`, `SLM.zipAll(z, keys)`, `SLM.blended(L, z)` = `{cpc: A.cpc x cpcMul x cpc_rel, cvr, cpl: cpc / cvr, close, cps: cpl / close, feeCase: val x fee, roi: feeCase / cps}`, `SLM.allocate`, `SLM.seasonFor`, `SLM.lineName`, `SLM.layers()` (adds the 22 `r_<line>` and `p_<line>` map layers).

`SLM.SEA` deserves a note because modules 04 and 08 draw it and nothing else records how it was built (2126 to 2145): "monthly shape from the data where it exists: storm events spread over the month they happen and the two after (40, 35, 25 percent)". `storm` = normalised lag of 0.7 x tropical months (`ts.trop_month` + 0.2) + 0.25 x SPC wind reports by month + 0.05 x tornado reports. `hail` = normalised lag of SPC hail reports by month. `repair` = normalised `RAIN x 0.7 + wind index x 1.5`, where `RAIN = [5.4, 4.6, 4.6, 4.9, 5.1, 6.1, 5.9, 5.6, 4.6, 4.1, 4.2, 5.0]` is "Louisiana statewide normal precipitation, inches (NOAA 1991 to 2020, rounded)" (2131). `mh` = normalised lag of 0.4 tropical + 0.4 wind + 0.2 rain. `replace`, `fortified`, `metal`, `mf`, `comm`, `coat`, `newc` are hard coded twelve number arrays (2133 to 2143), graded D in `SEA_G` (2145).

### C3. Names defined inside lines 4987 to 6900 that later modules use

A rebuild that changes any of these must change both sides.

| name | defined | used later at |
|---|---|---|
| `LAYERS`, `LAYER_GROUPS`, `layerOptions` | 4991 to 5049 ("shared layer catalog (modules 1, 4, 5, 6, 7, 11, 12, 17)") | 9383 to 9636 (module 17) |
| `ageHist`, `ageChart` | 5061 to 5062 | 9500 to 9518 |
| `kmLL`, `MONL`, `MON3`, `DOW`, `DOW3`, `listAnd`, `cap1` | 5265 to 5274 | 6921 to 9573 (modules 09, 11, 12, 14, 17) |
| `SIDX`, `stormFoot`, `dmgShare`, `footStats`, `RTS`, `stormName` | 5300 to 5324 | 6973 to 7460 (module 09), 8122, 8214 (module 11) |
| `REG_MKT` | 6097 | 8182 to 8229 (module 11) |
| `PLATS`, `PLAB` | 6612 to 6613 | 7924, 7943 (module 10) |
| `MODI.desk.plan()` | 6893 | 7627 (module 09 reads the Desk plan) |
| `gammaFn` | 9385 (module 17) | used by module 04 at 5946, so module 04 depends on a later section |
| `LINE_TIER`, `TIER_BID`, `LINE_FIRMS` | 8242, 8243, 8253 (module 12) | used by module 05 at 6154, 6194 and module 07 at 6563, 6578 |

### C4. Messages between modules (`goModule(key, payload)` calls `receive(payload)` of the target)

| from | to | payload |
|---|---|---|
| 01 | `field` `{comp}`; `storms` `{seg}` or `{zip}`; `stock` `{zip}`; `desk` `{zips}` (the selected ZIP or the top 25 by index in view); `forge` `{zips}`; `lines` `{zip}` | 5114, 5246 to 5251 |
| 02 | `desk` `{zips, storm}`, `{zips, event}` or `{zips}`; `forge` `{zips, storm}`; `index` `{zip}`; `stock` `{zip}` | 5541, 5563 to 5564, 5587, 5733 to 5734 |
| 03 | `satchel` (no payload) | 5905 |
| 05 | `field` `{comp}`; `lines` `{zip}`; `desk` `{zips}` or `{zips, lines}` | 6159, 6207, 6284 |
| 06 | `index`, `storms`, `paid` with no payload; it then sets the parish menus `#i1Par` and `#s2Par` of modules 01 and 02 directly and fires their change events | 6410 to 6411, 6453 |
| 07 | `watch` `{comp}` | 6551, 6599 |
| 08 | receives `{zips, bids, line, lines, storm, event}` (6892); accepts `receive` from 01, 02, 05 and from modules 11, 12, 14, 15 | |

Module `receive` signatures: 01 `{zip}` (5253); 02 `{filt}`, `{seg}`, `{storm}` or `{route}`, `{zip}` (5736 to 5740); 05 `{zip}` (6287); 06 `{fips}` (6455); 07 `{comp}` (6601); 08 as above. Events on `BUS`: `theme` (all redraw), `brand` (08), `slm` (05, 08).

Browser storage keys touched by these modules: `up.desk.v1` (the whole Desk plan, 6649 to 6652), `up.slm.v1` (budget and concentration set from module 05 at 6234), `up.brand.v1` (read), `up.theme`.

---

# Module 01. Roof Demand Index (`13_m01_index.js`, lines 4987 to 5258, key `index`)

## 01.1 What it is for and what it shows

Purpose (5065): "Where roofing jobs arise across eleven residential and commercial lines, ZIP by ZIP, for all 64 parishes". It is the master heat map: one choropleth of the scored ZIPs with 75 selectable layers, a ledger for the selected ZIP, a ranking table, and the explanation of how the index was built and tested. The section also defines, before the module itself, things other modules reuse: the layer catalog `LAYERS` (4991 to 5045), `LAYER_GROUPS` (5046), `z.fees_pc` (5048), `layerOptions` (5049), `GI_LAB` (5050), the quadrant names `QN = ['Anchor', 'Whitespace', 'Niche', 'Avoid']` (5051), `zipTip` (5052 to 5058), `zbarH` (5059), `ageHist` and `ageChart` (5061 to 5062).

Visible structure, top to bottom:

| # | element | lines | content |
|---|---|---|---|
| 1 | Masthead | 5071 to 5074 | Eyebrow "Module 01 · Roof Demand Index · Louisiana, 64 parishes". Title "Roof Demand Index". Dek (verbatim): "Every roofing job in Louisiana starts with one of three things: a roof that wore out, a storm that broke it, or a building that is new. This module estimates where those jobs arise for eleven residential and commercial service lines, from the age of every home, the hail, wind and hurricane record and FEMA's damage files, and resolves them to the ZIP codes where the roofs are. The map below is the master heatmap for ads and SEO; every other tab reads from it." Meta strip: "Coverage 534 ZIPs · 441 scored · 64 parishes · 2.11M homes"; "Roof stock 1.48M one unit roofs, 234k aged 20 years or more (model)"; "Confidence every layer graded A to D"; "Compiled October 6, 2026" (a literal). Bar buttons: "↓ ZIP CSV", "Storm Ledger ↗", "Roof Stock ↗", "Campaign Desk ↗", "Site Forge ↗", "Service Lines ↗", "◐ Theme". |
| 2 | Callout "Read this first: what the index is and is not" | 5076 | Copied in 01.2 (method texts). |
| 3 | Seven headline tiles | 5105 to 5113 | "One unit roofs" 1.48M (grade A; "plus 265k mobile homes; median home built 1983"). "Roofs 20 years or older" 234k (B; "16% of one unit roofs; 193k more reach 20 within five years"). "Age driven replacements, next 12 months" 52k (B; "3.5% of roofs, before any storm"). "Storm and wind jobs a year" 82k (B; "long run average, replacements and repairs"). "FEMA roof and wind registrations" 497k (A; "2004 to 2026; 124k since 2020 (verified wind loss)"). "Gross profit pool a year" $705M (D; "all eleven lines at default assumptions"). "Most roofing demand" 70358 ("Grand Isle · Jefferson Parish"). |
| 4 | Controls | 5078 to 5085 | "Map layer" menu (75 options in ten groups: Index, Service line rates, Service line volume, Roof stock and age, Hazard, Storm record, Homes and owners, Language, Commercial stock, Competition). "Region" menu ("All nine regions" plus the nine names). "Parish" menu ("All 64 parishes" plus 64 names, alphabetical). "Find a ZIP or city" search box, placeholder "70808 or Lafayette" (exact ZIP, else the most populous scored ZIP whose city starts with the text). Checkbox "Show the 29 mapped roofers". Checkbox "Storm tracks since 2002". |
| 5 | Map and legend | 5087, 5114 to 5126 | Choropleth of the 441 scored ZIPs for the chosen layer: eight quantile classes (`qScale`), or a diverging scale centred on zero for the hot spot layer; unscored ZIPs grey ("gray means fewer than 500 residents"); ZIPs outside the chosen region or parish dimmed; selected ZIP outlined. Optional competitor pins (one per office; radius by reach: statewide 5.2, national 4.6, regional 3.8, local 3; headquarters as diamonds). Optional storm tracks: all 432 legs, with legs of Category 3 or stronger drawn in the track highlight colour (5122). Hover a ZIP: tooltip (`zipTip`). Hover a pin: company, office city, reach. Hover a track leg: storm, date, class, "Sustained wind on this leg". Click a ZIP: select. Click a pin: open module 07. Click a leg: open module 02 on that leg. Legend: layer label, colour ramp, min and max, the grade and the layer's note. |
| 6 | Detail card | 5089, 5137 to 5190 | With no ZIP selected: totals for the view (state, region or parish): homes, one unit roofs, ZIPs; roofs 20 or older and the 15 to 19 wave; one row per service line ("jobs a year · per 10k"); FEMA registrations; gross profit pool; a roof age histogram of all roofs in view (ages 0 to 39 and 40+, bars shaded darker past 15 and 20) with a paragraph naming the storm spikes. With a ZIP selected: the index percentile and rank; eleven bars of the line z scores, each labelled "<short> <rate>/10k"; a table "Expected a year (model)" (Line, Jobs, Open to marketing, Gross profit); "Roofs (ACS, renewal model)" rows; the ZIP's own roof age histogram; "Hazard and record" rows; "Owners and buildings (ACS, ZBP)" rows; up to seven advisory notes (rules in 01.2). Pill: "State", "Region", "Parish" or "Paid: <quadrant>". |
| 7 | Ranking table | 5090, 5128 to 5136 | Columns ZIP, City, Index, a fourth column ("Gross profit" when the layer is the index, otherwise "Value" of the chosen layer), Homes. Rows: scored ZIPs in view. Sorted by the layer; click a header to sort, a row to select. |
| 8 | Card "How the index is built" | 5094, 5193 to 5198 | Method paragraph; table Line (name and unit), Profit share, Tier (with grade), Weight, and a total weight row; two "Judgment call" callouts. |
| 9 | Card "Is this one variable or eleven?" | 5095, 5199 | 11 x 11 correlation matrix of the line rates and a paragraph. |
| 10 | Card "Does the storm model point where roofs were actually damaged?" | 5097, 5200 to 5205 | Two scatter plots of 292 ZIPs with fitted lines and notes, then a "Judgment call" callout. |
| 11 | Card "Caveats: the fine print" | 5099, 5206 to 5215 | Eight rows. |
| 12 | Card "What this atlas cannot show" | 5100, 5216 to 5223 | Six rows with a grade each. |
| 13 | Card "Source register" | 5102, 5224 to 5235 | Ten rows: layer, dataset, grade, vintage, link. |
| 14 | Footer | 5236 | Copied in 01.3. |
| 15 | Export | 5244 to 5245 | `louisiana-roof-demand-index-by-zip.csv`: one row per scored ZIP with `zip, city, cty, pop, hu, idx, idx_eq, gi, gicls, fees, cases`, then `p_<line>, r_<line>` for the eleven lines, then `roofs, ra_med, ra20, ra20_sh, wave, nxt, last64, hd1, hd175, wd50, td1, hur64, n64_00, ev_h1, ev_w58, fema_k, own_sh, mort_sh, value, inc, mh_sh, span_sh, viet_sh, cru, roofers, lic, comp_pct, tier, bid`. Header note: "Uplift Louisiana Roofing Atlas, module 01, compiled 2026-10-06. p_ = expected jobs a year; r_ = per 10,000 residents (shrunk toward the parish rate); fees = gross profit pool at default job values and a 33 percent margin. idx = percentile of weighted z scores of log rates; gi = Getis Ord Gi* z on the index." |

## 01.2 Data contract

### ZIP columns

All 103 columns are listed in Part A with their lines. How each group is used:

- Map and ranking: `vals = ZR.map(z => z[layer])` (5117); `qScale(vals, ramp, dir)` or `divScale(vals, 0)` for `gi` (5118); legend min and max are the min and max of `vals` (5125).
- Tooltip (5052 to 5057): `zip`, `city`, parish, `hu`, `pop`, the layer value, `idx` ("th pct." or "not scored"), `ra20_sh`, `hd1`, `hur64`, `fees`, and "Top line" = `z.sl_top`.
- Scope filter (5115): `(!par || z.fips === par) && (!reg || parishes[z.pi].reg === reg)`.
- View totals (5142 to 5147): sums over the scored ZIPs in view of `hu`, `roofs`, `ra20`, `wave`, `p_<line>`, `fema_k`, `fees`; the per 10k figure is `sum(p) / sum(pop) x 10,000`; the percentage is `sum(ra20) / sum(roofs)`.
- Selected ZIP (5153 to 5188): rank = position of the ZIP in `ZR` sorted by `idx` descending. z bars use `z_<line>` (width 17 percent of the track per standard deviation, capped at 47) labelled with `r_<line>`. The "Expected a year" table calls `SLM.zipLine(z, line)`: Jobs = `p_<line>`, Open to marketing = `p x rep`, Gross profit = `p x rep x val x fee`, with `rep`, `val`, `fee` taken from the user's current assumptions (they start at `META.model.REP`, `VAL`, `FEE` but change when the user edits module 12), so this table can differ from the stored `fees` column.
- Advisory notes and their triggers (5157 to 5163): hot spot note when `gicls` starts with "H" (text uses `gi`); "Roof debt" when `ra20_sh >= 22`; "Recent storm reset" when `yrs64 <= 6`; "Hail exposure" when `hd175 >= 1.0`; "Mobile home market" when `mh_sh >= 20`; "Spanish build" when `span_sh >= 8` (text also prints `span_lep_sh`); "Vietnamese speakers" when `viet_sh >= 3`.
- Headline tiles (5104): `fema20 = sum over all 534 ZIPs of fema_20`, `femaAll = sum of fema_k`.
- "Most roofing demand": the scored ZIP with the highest `idx` (5069).
- Desk and Forge hand off (5248 to 5250): the selected ZIP, or the 25 scored ZIPs in view with the highest `idx`.

### The layer catalog (`LAYERS`, lines 4991 to 5045), with every note verbatim

Each note is printed under the legend when the layer is chosen. They are the build record for the columns, so they are copied whole. `fees_pc` is the one key that is not a data column (computed at 5048).

| line | key | label (as shown in the layer menu) | group | grade | scale | note shown under the legend (verbatim) |
|---|---|---|---|---|---|---|
| 4992 | `idx` | Roof Demand Index (percentile) | Index | C | high = dark, green | Weighted composite of the eleven service line rates (log of expected jobs per 10,000 residents, standardized). A percentile across the scored ZIPs: 100 carries the most roofing demand per resident, not "100 percent of anything". |
| 4993 | `idx_eq` | Roof Demand Index, equal weights (percentile) | Index | C | high = dark, green | The same eleven components with every weight equal. The sensitivity check for the weighted index. |
| 4994 | `fees` | Gross profit pool a year at default assumptions ($) | Index | D | high = dark, green | Jobs open to marketing times the default job value times a 33 percent gross margin, summed over the eleven lines. Volume, so big ZIPs shade darker. The assumptions are yours to change in modules 05 and 12. |
| 4995 | `fees_pc` | Gross profit pool per 1,000 residents ($) | Index | D | high = dark, green | Gross profit pool divided by residents: where each household carries the most roofing value. |
| 4996 | `cases` | Jobs a year open to marketing (all lines, model) | Index | D | high = dark, green | Expected jobs times the share an owner gives to a contractor found through search, ads, referrals or the door (default assumptions). |
| 4997 | `gi` | Hot spot statistic, Getis Ord Gi* on the index (z) | Index | C | diverging at 0, div | Each ZIP and its eight nearest neighbors against the state: above 1.96 is a statistically significant cluster of high roofing demand (95%), below minus 1.96 a cold cluster. Clusters are where a radius or DMA buy beats ZIP lists. |
| 4998 | `roofs` | One unit roofs (detached and attached homes) | Roof stock and age | A | high = dark, teal | ACS 2020 to 2024 units in structure by year built (B25034, B25127), one roof per one unit home. |
| 4999 | `ra20_sh` | Roofs 20 years or older (% of one unit roofs, model) | Roof stock and age | B | high = dark, green | The roof renewal model (module 17): homes by decade built, a 22 year Weibull roof life calibrated to the 2023 American Housing Survey, reset by every storm that reached the ZIP. Roof debt: past the age at which most Louisiana shingle roofs fail. |
| 5000 | `ra15_sh` | Roofs 15 years or older (%, model) | Roof stock and age | B | high = dark, green | The same model at 15 years, where insurers start asking about roof age. |
| 5001 | `ra20` | Roofs 20 years or older (count, model) | Roof stock and age | B | high = dark, green | Roof debt in homes, not percent. |
| 5002 | `wave` | Roofs aged 15 to 19 (the next five years of replacements) | Roof stock and age | B | high = dark, green | Roofs that cross 20 within five years: the coming wave, largest where a storm reset many roofs at once 15 to 19 years ago (Katrina, Rita, Gustav, Ike). |
| 5003 | `nxt` | Age driven replacements, next twelve months (model) | Roof stock and age | B | high = dark, green | Expected one to four unit roof replacements from wear alone in the coming year. |
| 5004 | `ra_med` | Median roof age, years (model) | Roof stock and age | B | high = dark, teal | Half the one unit roofs in the ZIP are younger, half older. |
| 5005 | `yrs64` | Years since hurricane force winds reached the ZIP | Roof stock and age | B | high = dark, teal | Since the most recent storm with modeled sustained winds of 64 knots or more at the ZIP. A short gap means many young roofs and muted age driven demand. |
| 5006 | `yb_med` | Median year built (ACS) | Roof stock and age | A | inverted (low = dark), teal | ACS B25035. Older stock carries older decking, flashing and ventilation. |
| 5007 | `pre80_sh` | Homes built before 1980 (%) | Roof stock and age | A | high = dark, teal | ACS B25034. On their third or fourth roof; decking and code upgrades come with the job. |
| 5008 | `mh_sh` | Mobile homes (% of housing units) | Roof stock and age | A | high = dark, teal | ACS B25024. The roof over and coating market. |
| 5009 | `hd1` | Hail days a year, 1 inch or larger within 25 miles | Hazard | B | high = dark, teal | SPC severe report database 1996 to 2025: distinct days with a report of hail 1 inch or larger within 25 miles of the ZIP, a year. Reports cluster where people live. |
| 5010 | `hd175` | Damaging hail days a year, 1.75 inch or larger within 25 miles | Hazard | B | high = dark, teal | Golf ball hail: the size that damages most asphalt shingles. |
| 5011 | `hd1_10` | Hail days a year, recent decade (2016 to 2025) | Hazard | B | high = dark, teal | The recent decade beside the 30 year rate. |
| 5012 | `wd50` | Damaging wind days a year, 58 mph or more within 25 miles | Hazard | B | high = dark, teal | SPC thunderstorm wind reports of 50 knots or more, 1996 to 2025. |
| 5013 | `td1` | Tornado days a year, EF1 or stronger within 25 miles | Hazard | B | high = dark, teal | SPC tornado database, 1996 to 2025. |
| 5014 | `hur64` | Chance of hurricane force winds in a year (%) | Hazard | B | high = dark, teal | Share of years 1950 to 2025 with modeled sustained winds of 64 knots or more at the ZIP (HURDAT2 best tracks and wind radii). |
| 5015 | `hur50` | Chance of 50 knot winds in a year (%) | Hazard | B | high = dark, teal | Share of years 1950 to 2025 with modeled sustained winds of 50 knots (58 mph) or more. |
| 5016 | `n64_00` | Hurricane force storms since 2000 | Hazard | B | high = dark, teal | Count of storms 2000 to 2026 with modeled sustained winds of 64 knots or more at the ZIP. |
| 5017 | `ev_h1` | Hail reports of 1 inch or more in the ZIP, 2016 to 2026 | Storm record | A | high = dark, green | NOAA Storm Events Database reports placed by their coordinates. Observed, not modeled. |
| 5018 | `ev_w58` | Damaging wind reports in the ZIP, 2016 to 2026 | Storm record | A | high = dark, green | Thunderstorm wind reports of 50 knots or more. |
| 5019 | `ev_t` | Tornado touchdowns in the ZIP, 2016 to 2026 | Storm record | A | high = dark, green | Begin points of tornado tracks. |
| 5020 | `fema_k` | FEMA roof and wind damage registrations, 2004 to 2026 | Storm record | A | high = dark, green | OpenFEMA Individuals and Households Program: registrations with FEMA inspected roof damage (2004 to 2017 disasters) or verified real property wind loss (2020 on). Counts only people who applied for federal help; about four in ten reported homeowners insurance, and most insured roof claims never reach FEMA, so the count understates damaged roofs. |
| 5021 | `fema_rate` | FEMA roof and wind registrations per 100 occupied homes | Storm record | A | high = dark, green | The same count divided by occupied homes (ACS 2020 to 2024). |
| 5022 | `fema_ida` | FEMA verified wind loss, Hurricane Ida (2021) | Storm record | A | high = dark, green | Owner registrations with verified real property loss and no flood damage, DR 4611. |
| 5023 | `fema_laura` | FEMA verified wind loss, Hurricane Laura (2020) | Storm record | A | high = dark, green | DR 4559. |
| 5024 | `hu` | Housing units (ACS) | Homes and owners | A | high = dark, lime | ACS B25001. |
| 5025 | `own_sh` | Owner occupied (% of occupied homes) | Homes and owners | A | high = dark, lime | ACS B25003. Owners buy roofs; landlords buy repairs. |
| 5026 | `mort_sh` | Owners with a mortgage (%) | Homes and owners | A | high = dark, lime | ACS B25081. A mortgage requires hazard insurance with wind coverage, so storm and hail work runs through claims; free and clear owners may be uninsured and buy on price and financing. |
| 5027 | `value` | Median home value ($) | Homes and owners | A | high = dark, lime | ACS B25077. |
| 5028 | `inc` | Median household income ($) | Homes and owners | A | high = dark, lime | ACS B19013. |
| 5029 | `hh100k_sh` | Households earning $100,000 or more (%) | Homes and owners | A | high = dark, lime | ACS B19001. Metal, FORTIFIED and premium shingle buyers. |
| 5030 | `s65_sh` | Residents 65 and over (%) | Homes and owners | A | high = dark, lime | ACS B01001. Long tenure owners on older roofs. |
| 5031 | `seas` | Seasonal and recreational homes (camps) | Homes and owners | A | high = dark, lime | ACS B25004. Owners who live elsewhere: reach them where they live. |
| 5032 | `span_sh` | Speak Spanish at home (% of residents 5+) | Language | A | high = dark, lime | ACS C16001. Sets the Spanish build in the Desk and the Forge. |
| 5033 | `viet_sh` | Speak Vietnamese at home (%) | Language | A | high = dark, lime | ACS C16001. New Orleans East, the West Bank and the coastal parishes. |
| 5034 | `french_sh` | Speak French or Cajun at home (%) | Language | A | high = dark, lime | ACS C16001. Acadiana. |
| 5035 | `cru` | Commercial roofs (estimate) | Commercial stock | D | high = dark, teal | ZIP Code Business Patterns 2023 establishments weighted by building type and scaled to 80,000 commercial roofs statewide (CBECS 2018 national count by population). |
| 5036 | `whse` | Warehousing establishments (ZBP 2023) | Commercial stock | B | high = dark, teal | NAICS 493. Big low slope roofs. |
| 5037 | `mfg` | Manufacturing establishments | Commercial stock | B | high = dark, teal | NAICS 31 to 33. |
| 5038 | `retail` | Retail establishments | Commercial stock | B | high = dark, teal | NAICS 44 to 45: strip centers and stand alone stores. |
| 5039 | `church` | Religious organizations | Commercial stock | B | high = dark, teal | NAICS 8131: one building, a board decision and a capital campaign. |
| 5040 | `apts` | Apartment lessors | Commercial stock | B | high = dark, teal | NAICS 531110. |
| 5041 | `comp_mass` | Competitor presence (distance weighted) | Competition | C | high = dark, teal | The mapped Louisiana roofers' offices weighted by reach (statewide 3, national 2.5, regional 1.5, local 1) and exp(minus distance over 20 km), plus their advertised service cities at 35 percent. |
| 5042 | `roofers` | Roofing contractor establishments in the ZIP (ZBP 2023) | Competition | C | high = dark, teal | NAICS 238160 employer establishments. ZIP cells under three are suppressed, so small towns read zero; the state has 267 (CBP 2023). |
| 5043 | `lic` | LSLBC roofing license records in the ZIP's city | Competition | C | high = dark, teal | Roofing license records by mailing city as mirrored from the LSLBC roster (StateCreds, October 4, 2026), split across the city's ZIPs. Supply, including firms without employees. |
| 5044 | `comp_pct` | Competitive pressure (percentile) | Competition | C | high = dark, teal | 60 percent mapped roofer presence, 40 percent roofing establishments and license records within about 10 km, as percentiles. |

Lines 5047 and 2181 to 2188 add two layers per service line: `r_<line>` "<line name>: jobs per 10,000 residents a year" (group "Service line rates", note: "<unit>, per 10,000 residents, shrunk toward the parish rate for small ZIPs (prior of 2,500 residents). <what>") and `p_<line>` "<line name>: jobs a year (count)" (group "Service line volume", note: "<unit>. Volume, not rate: large ZIPs shade darker."). `<unit>` and `<what>` come from the service line table `PL` (lines 1209 to 1350, outside my range but printed here and in the method table at 5196). They are the only record of how each `p_<line>` was derived:

| line | key | name / short / token | grade | seg | unit (verbatim) | what (verbatim: how the line's jobs were derived) | law ids |
|---|---|---|---|---|---|---|---|
| 1210 | `replace` | Roof replacement / Replace / REPLACE | B | res | roofs on one to four unit homes reaching the end of their life in the next twelve months (age driven, not storm driven; metal and FORTIFIED counted in their own lines) | A renewal model of every one to four unit home by decade built (ACS 2020 to 2024, tables B25034 and B25127). Each roof wears out on a Weibull life with a 22 year mean and shape 3, calibrated to the 2023 American Housing Survey rate of roofing projects not paid by insurance, by year built, in the South (model 3.7 to 4.2 percent a year against 3.5 to 4.4 observed), and is reset by every storm that reached the ZIP since 1950: FEMA verified roof and wind damage where FEMA has it, the best track wind footprint elsewhere. The line is the expected age driven replacements over the next twelve months. | resroof, permit, liab, cooling, regz, reviews, lutpa, fraud |
| 1224 | `repair` | Roof repair and leaks / Repair / REPAIR | B | res | roof leak repairs a year on one to four unit homes handled by a paid roofer | The 2023 American Housing Survey rate of roof leaks in the last twelve months, by decade built and by owner and renter (South: 2.0 percent for homes built since 2020 up to 8.5 percent before 1940), times the homes in each decade of the ZIP, times 55 percent fixed by a paid roofer rather than the owner or a handyman (assumption, grade D). | permit, resroof, gouge, cooling, reviews, lutpa |
| 1237 | `storm` | Storm and wind damage / Storm / STORM | B | res | roofs a year needing a roofer after wind (hurricanes, tropical storms, thunderstorm wind, tornadoes), long run average, replacements and repairs | Every Atlantic storm from 1950 to 2025 rebuilt as a sustained wind footprint at each ZIP from the HURDAT2 best track wind radii (a modified Rankine profile before 2004). FEMA roof damage registrations from Katrina, Rita, Gustav, Ike and Isaac fix the damage curve: the share of roofs replaced rises on a logistic curve with a 52 percent ceiling, a 70 knot midpoint and a 7.3 knot width, at two roofs replaced per FEMA registration (grade D multiplier); Spearman 0.73 between wind and FEMA damage across 2,055 ZIP storm pairs. Repairs short of replacement and thunderstorm wind and tornado days within 25 miles (SPC 1996 to 2025) add at stated rates (grade D). Metal reroofs are carved out. | claimads, claimacts, deductible, claimclock, gouge, cooling, resroof, permit, tcpa |
| 1251 | `hail` | Hail damage / Hail / HAIL | C | res | roofs a year with hail damage needing a roofer (60 percent replacements) | SPC hail reports, 1996 to 2025: days a year with hail of 1 inch or larger within 25 miles of the ZIP (median 1.9) and days with 1.75 inch hail or larger. Each 1 inch day damages 0.22 percent of roofs and each 1.75 inch day a further 0.40 percent (assumption, grade D: the point chance a swath crosses a roof). Reports cluster where people live, so rural hail is undercounted; the recent decade (2016 to 2025) is shown beside the 30 year rate. | claimads, claimacts, deductible, claimclock, cooling, resroof, permit |
| 1264 | `fortified` | FORTIFIED roofs / FORTIFIED / FORT | C | res | FORTIFIED Roof reroofs a year, grant funded and owner paid | Statewide anchor of 9,000 a year: 2026 funding of about $80 million for the Louisiana Fortify Homes Program and $20 million for Restore ROOF at $10,000 a grant, less administration, plus owners who pay for FORTIFIED themselves (grade C). Apportioned by owner occupied single family homes likely to be insured (mortgage share), roofs 15 years or older, coastal parishes (1.6 times) and hurricane frequency. Only FORTIFIED certified roofers can install grant roofs. | fortify, resroof, code, permit, lutpa |
| 1277 | `metal` | Metal roofing / Metal / METAL | D | res | metal reroofs a year on one to four unit homes, whatever the trigger (age, wind or hail) | 12 percent of residential reroofs statewide (assumption, grade D), tilted toward rural ZIPs (1.6 times under 300 residents per square mile, 0.6 times over 1,500) and higher income; carved out of the replacement, storm and hail lines so nothing is counted twice. Steel mill producer prices rose 23 percent in the year to August 2026, so quotes age faster than shingle quotes. | resroof, permit, code, regz, lutpa |
| 1290 | `mh` | Manufactured home roofs / Mobile home / MH | C | res | manufactured home roof jobs a year (roof overs, recovers, coatings and storm repairs) | Mobile homes (ACS B25024) times 2.6 percent a year professional roofing projects (2023 American Housing Survey, South: 3.58 percent a year less 27.7 percent done by the owner) plus wind damage at 1.3 times the site built rate per unit of wind. Mobile homes are not eligible for Fortify Homes grants. | resroof, permit, cooling, gouge, regz, fraud |
| 1302 | `mf` | Multifamily, condo and HOA / Multifamily / MF | C | com | roof replacements a year on apartment, condo and association buildings of five or more units | Buildings estimated from units in structure (7, 14, 30 and 80 units a building for the ACS size classes) and renewed on a 22 year low slope life with storm resets, plus wind damage at 80 percent of the residential replacement rate. Association boards and property managers buy on bids, reserve studies and references. | thresholds, permit, claimads, deductible, lien, code |
| 1314 | `comm` | Commercial roof replacement / Commercial / COMM | D | com | commercial roof replacements a year (low slope membranes and metal buildings), age and storm driven | 80,000 commercial roofs statewide (the CBECS 2018 national building count scaled by population, grade C), apportioned by ZIP Code Business Patterns 2023 establishments weighted by building type (plants and warehouses 0.8 to 0.9 a roof each, retail 0.55, offices 0.25, churches 1.0), replaced on a 22 year cycle plus wind damage at 70 percent of the residential rate and hail at 30 percent. | thresholds, permit, code, lien, claimads, deductible |
| 1327 | `coat` | Restoration, coatings and maintenance / Coatings / COAT | D | com | commercial roofs restored, coated or put on a maintenance agreement a year | Three percent of the commercial roof stock a year (assumption, grade D) on the same building estimate as the commercial line. Restoration fits roofs that are sound but aging; it competes with replacement and is often bought by facility managers on a budget cycle. | thresholds, permit, lutpa, lien |
| 1339 | `newc` | New construction roofing / New build / NEWC | B | com | new roofs a year on newly permitted buildings (builder subcontract work) | Census Building Permits Survey, 2023 to 2025 average by parish (every residential building authorized), apportioned to ZIPs by homes built since 2020 and, at 35 percent weight, since 2010 (ACS). Builder work is won on price, schedule and relationships, so it is reached through builder associations and estimating, not search ads. | thresholds, nhwa, permit, code, lien |

### Other structures

| read | lines | use |
|---|---|---|
| `META.model.W`, `META.model.TIER` | 5068, 5194 to 5196 | Method table. `fs = W[line] / TIER[line]`; Profit share = `fs / sum(fs)`; Tier = `TIER[line]` with the line's grade `PL.g`; Weight = `W[line]`; Total weight = `sum(W)` (0.787). Current weights: replace 0.238, repair 0.010, storm 0.259, hail 0.033, fortified 0.038, metal 0.065, mh 0.029, mf 0.016, comm 0.073, coat 0.011, newc 0.015. Tiers: 1.0 for replace, repair, storm, newc; 0.75 for hail, mh, mf; 0.5 for fortified, metal, comm, coat. |
| `META.model.corr` | 5199 | `corrMatrix(LINE_KEYS, short names, corr)`; the paragraph prints `corr.replace.repair` (0.39), `corr.storm.replace` (-0.50), `corr.hail.storm` (-0.49). |
| `META.model.sens` | 5199 | "Weighted and equal weight versions correlate r = 0.895 (Spearman 0.883)". |
| `META.model.valpts` | 5201 to 5204 | 292 rows `[zip, clim, wind, obs]`. Plot 1: x = `clim` ("Storm climatology 1950 to 2019, roofs needing work per 1,000 a year"), y = `log10(1 + obs)` ("FEMA verified wind damage per 1,000 homes (log10 of 1 + rate)"; the tooltip calls `obs` "FEMA 2020 to 2024 per 1,000 homes"). Plot 2: x = `log10(1 + wind)` ("Modeled replacements from the 2020 to 2024 footprints (log10 of 1 + per 1,000)"), same y. |
| `META.model.val` | 5070, 5203 to 5205 | Notes: "Climate: Spearman ρ = 0.62 across 292 ZIPs with 1,000 homes or more (p < 0.001)" (`rho_clim`, `n`, `p_clim`); "Footprint: Spearman ρ = 0.77 (p < 0.001)" (`rho_wind`, `p_wind`). |
| `META.pools.storm` | 5109 | tile "Storm and wind jobs a year". |
| `META.nzip`, `hu`, `roofs`, `ra20`, `wave`, `nxt`, `mh`, `yb_med`, `npts`, `fees_tot`, `ncomp_ver`, `lic.n` | 5072, 5076, 5106 to 5111, 5234, 5236 | masthead, callout, tiles, source register, footer. Shares: `ra20 / roofs` and `nxt / roofs`. |
| `agez` | 5061, 5150, 5189 | roof age histograms: the view (sum over its ZIPs) and the selected ZIP. |
| `COMP` | 5083, 5114, 5123, 5234 | count in the checkbox label and the source register; pins from `offices[].lat/lon/hq`, `tier`; pin tooltip `name`, office `city` or `hq`, `tier`, `verified`. |
| `SEGS` | 5114, 5122 | track tooltip (`r`, `t` date part, `cat`, `v` in kt and mph); highlight rule `cat >= 3`. |
| `parishes` | 5081, 5115, 5140, 5154, 5239 to 5240 | parish menu (`fips`, `name`), region of a ZIP (`reg`), zoom to a region or parish. |
| `REGN` (`META.model.REG`) | 5080, 5140, 5154 | region menu and labels. |
| `PL` | 5145, 5165, 5168, 5193, 5196 | line names, short names, units, grades. |
| `FEMA_INS.sh` | 5020, 5211 | "about four in ten reported homeowners insurance". |

### Method, caveat and source texts (verbatim)

Callout, line 5076: "This maps where roofing jobs arise, not where they are sold. No agency counts roof replacements by ZIP, and Louisiana only began requiring a permit for every reroof on August 1, 2025. What can be counted is everything around the roof: the homes and the decade each was built (Census), the hail, wind and tornado reports (NOAA, 5.1k placed by coordinates since 2016), every hurricane track and wind radius since 1950 (NHC), FEMA's roof and wind damage registrations for every Louisiana disaster since 2004, the commercial buildings (Business Patterns) and new permits (Census). A roof renewal model ages every roof, calibrated to the American Housing Survey, and resets it whenever a storm replaced it. The replacement, repair, storm and new construction lines rest on observed data (grade B); hail and the commercial and specialty lines lean on stated assumptions (grades C and D) that you can change. A high index is a ZIP where more roofing jobs arise per resident; module 05 turns that into reachable jobs against competition, module 02 shows the storms, and module 17 the roofs themselves."

Method, line 5195: "For each line the expected jobs per 10,000 residents are shrunk toward the parish rate for small ZIPs (an empirical Bayes prior worth 2,500 residents), log transformed, standardized across the 441 scored ZIPs (a z score), multiplied by the weight, summed and turned into a percentile. Weight is the line's share of the statewide gross profit pool at default assumptions times a tier: 1.0 where the line rests on observed counts (grades A and B), 0.75 for graded models (C), 0.5 for lines anchored on an assumption (D). Money stands in for importance because a roofer's choice between lines is a choice between job values; that substitution is the largest judgment call in the build."

Line 5166 (under the z bars): "Bars are standard deviations of the log rate from the scored ZIP mean; right and copper means more than average."

Judgment call, line 5197, "wear and storms are separate lines": "A roof replaced because it wore out (retail, financing, price shopping) and one replaced after a storm (insurance, urgency, trust) are different sales. The renewal model splits them: age driven replacements go to the replacement line, storm driven ones to the storm and hail lines, and a storm that replaces a roof resets its clock, which is why Lake Charles, after Laura, shows young roofs and low age driven demand."

Judgment call, line 5198, "no double counting": "Metal reroofs and FORTIFIED reroofs are carved out of the replacement, storm and hail lines, mobile homes are only in their own line, and five unit buildings sit in the multifamily line. Repairs count leaks fixed by a paid roofer, not every leak."

Coherence paragraph, line 5199: "They are not one variable. The residential lines that follow the roof stock move together (replacement and repair r = 0.39), the storm line follows the coast and the hurricane record (storm and replacement r = −0.50), hail follows the north and the SPC record (hail and storm r = −0.49), and the commercial lines follow business districts. Weighted and equal weight versions correlate r = 0.895 (Spearman 0.883). Pick the line, not the index, when you buy for one service."

Validation card, line 5097: "Two holdout tests against FEMA's verified wind damage from Laura, Delta, Zeta, Ida and Francine (2020 to 2024), per 1,000 occupied homes. None of those registrations were inputs to either prediction."

Validation judgment, line 5205: "The first test asks whether 70 years of hurricane history, frozen at 2019, says where the next storms would damage roofs. It does (ρ = 0.62): Louisiana's exposure is persistent, which is what lets a long run storm line guide a standing budget. The second asks whether the wind footprint of each 2020 to 2024 storm, run through a damage curve fit only on Katrina, Rita, Gustav, Ike and Isaac, finds the damage FEMA verified later (ρ = 0.77): the wind model and its damage curve travel across storms. FEMA counts only people who applied for federal help, so these are tests of where, not of how many; the absolute storm volume rests on the two roofs per registration multiplier (grade D)."

Roof age paragraph, line 5149: "Bars past 15 years shade darker, past 20 darkest. The spikes at 5 and 6 years are Hurricanes Ida (2021) and Laura, Delta and Zeta (2020); the spikes at 18 and 21 years are Gustav and Ike (2008) and Katrina and Rita (2005). Storms replace roofs in waves, and the waves come due together: the 2005 and 2008 roofs are entering the replacement window now, and the 2020 and 2021 roofs will follow in the late 2030s."

Caveats, lines 5207 to 5214 (title, then text):

1. "Jobs, not sales": "Every layer describes roofs, storms and buildings, not signed contracts. No agency counts roof replacements by place, though the 2025 permit mandate will change that at the parish level."
2. "Ecological reading only": "A high ZIP contains new roofs and careful owners; nothing here describes a household."
3. "ACS is a survey": "ZIP estimates carry margins of error, largest in small rural ZIPs; the index shrinks small ZIP rates toward the parish rate for that reason."
4. "The roof life is calibrated, not observed": "The 22 year Weibull life fits the South's 2023 American Housing Survey rates by year built (within 0.3 points a year); Louisiana specific roof ages are not published."
5. "Storm damage leans on FEMA": "FEMA counts only people who applied for federal help (about four in ten reported homeowners insurance); damage that never registered is covered by a multiplier (two roofs per registration before 2020, 3.6 since, grade D)."
6. "Hail reports follow people": "SPC hail reports cluster along highways and in towns, so rural hail is undercounted and the hail line runs low in empty places."
7. "Default job values are placeholders": "The gross profit pool multiplies jobs by default values (replacement $15,500, commercial $85,000 and so on) and a 33 percent margin. Replace them with your closed job history in module 12."
8. "Research material": "Not legal or insurance advice. Verify statutes and program rules against the primary source before relying on them."

"What this atlas cannot show", lines 5217 to 5222 (title, text, grade):

1. "Roof permits by ZIP": "Act 239 of 2025 requires a permit for every reroof from August 1, 2025, but parishes and cities keep permits in separate systems and few publish them; New Orleans publishes building permits that capture only a fraction of roof work." C
2. "Insurance claims by ZIP": "The Department of Insurance collects claim counts after declared catastrophes by parish, not ZIP, and not in a usable public file; FEMA stands in." C
3. "Search volume and CPC by ZIP": "No keyword or Ahrefs data was pulled for this build. Cost per click is modeled from region and competition (grade D) until account actuals arrive in module 15." D
4. "Roof material by home": "No public source records roof covering by parcel; material mix is modeled from building type, age and region (module 17)." D
5. "Commercial roof age and size": "Assessor files that carry building area and year are not published statewide; the commercial lines run on establishment counts and a national building count." D
6. "Licensed roofers by parish, officially": "The LSLBC search is per contractor; the roster used here is a third party mirror of it by mailing city." C

Source register, lines 5225 to 5234 (layer; dataset; grade; vintage; link):

1. "Homes by year built, structure and tenure"; "U.S. Census Bureau, ACS 2020 to 2024 five year, table based summary file (B01003, B19001, B19013, B25001 to B25004, B25018, B25024, B25034, B25035, B25036, B25077, B25081, B25127, C16001)"; A; "Jan 2026"; https://www2.census.gov/programs-surveys/acs/summary_file/2024/table-based-SF/
2. "Roofing projects, leaks and costs by year built"; "U.S. Census Bureau and HUD, American Housing Survey 2023 national public use file (projects, roof leaks, missing shingles)"; A; "Sep 2024"; https://www2.census.gov/programs-surveys/ahs/2023/
3. "Hail, wind and tornado reports"; "NOAA SPC severe weather database 1996 to 2025; NOAA NCEI Storm Events Database 2016 to 2026 (Louisiana, located reports)"; A; "Sep 2026"; https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/
4. "Hurricane tracks and wind radii"; "NHC HURDAT2 Atlantic best tracks 1851 to 2025 (September 23, 2026 release) and NHC operational best tracks for 2026 (Arthur, Bertha, Edouard)"; A; "Sep 2026"; https://www.nhc.noaa.gov/data/hurdat/
5. "Roof and wind damage"; "FEMA OpenFEMA: Individuals and Households Program valid registrations (roof damage flag 2004 to 2017; verified real property loss without flood 2020 on), Housing Assistance Program owners, disaster declarations"; A; "Oct 2026"; https://www.fema.gov/about/openfema/data-sets
6. "Commercial buildings and roofers"; "County and ZIP Code Business Patterns 2023 (238160 roofing contractors, 423330 roofing supply, retail, warehousing, manufacturing, churches, apartments); Nonemployer Statistics 2024"; B; "2023 to 2024"; https://www2.census.gov/programs-surveys/cbp/datasets/2023/
7. "New construction"; "Census Building Permits Survey, county annual 2005 to 2025 and 2026 year to date through August"; A; "Sep 2026"; https://www2.census.gov/econ/bps/County/
8. "Material prices"; "BLS producer price indexes via FRED: prepared asphalt and tar roofing and siding products (WPU1361); steel mill products (WPU1017)"; B; "Aug 2026"; https://fred.stlouisfed.org/series/WPU1361
9. "Licensing, permits and claims law"; "Acts 239 and 422 of 2025, Act 757 of 2026 (LSLBC notice of July 13, 2026); Act 144 of 2025; Act 734 of 2022; Act 3 of 2024; Act 533 of 2024"; A; "Oct 2026"; https://legis.la.gov/
10. "Roofers"; "29 Louisiana roofing companies; 27 read on their own websites October 6, 2026; LSLBC roofing license roster mirror (950 records)"; C; "Oct 2026"; no link.

Footer, line 5236: "Uplift Louisiana Roofing Atlas, module 01. Compiled October 6, 2026 for 534 ZIP codes in all 64 parishes. The index is a percentile of expected roofing jobs per resident, not a count of sales. Grades: A primary and direct; B primary with a caveat or a model on primary data; C secondary, volatile or proxy; D assumption or over ten years old. Built from public data only; no keyword or Ahrefs data was pulled for this build."

## 01.3 Louisiana specific content in module 01

Every item below is hard coded text or a hard coded rule. Items inside the layer catalog are in the table in 01.2 with their line numbers; the list here names the ones that carry Louisiana or hurricane content.

| line | what | text or rule to find |
|---|---|---|
| 4999 | layer note | "Roof debt: past the age at which most Louisiana shingle roofs fail." Also the model statement "a 22 year Weibull roof life calibrated to the 2023 American Housing Survey, reset by every storm that reached the ZIP". |
| 5002 | layer note, storm names | "largest where a storm reset many roofs at once 15 to 19 years ago (Katrina, Rita, Gustav, Ike)". |
| 5005 | layer label and null text | "Years since hurricane force winds reached the ZIP"; "none since 1950"; "modeled sustained winds of 64 knots or more". |
| 5009 to 5013 | hazard layers built on hail, thunderstorm wind and tornado days | "SPC severe report database 1996 to 2025", "Golf ball hail: the size that damages most asphalt shingles", "SPC thunderstorm wind reports of 50 knots or more", "SPC tornado database". |
| 5014 to 5016 | hurricane layers | "Chance of hurricane force winds in a year (%)", "Chance of 50 knot winds in a year (%)", "Hurricane force storms since 2000"; "HURDAT2 best tracks and wind radii". |
| 5017 to 5019 | storm record layers | hail, damaging wind and tornado report counts, "NOAA Storm Events Database". |
| 5020 to 5023 | FEMA layers | "FEMA roof and wind damage registrations, 2004 to 2026"; "FEMA verified wind loss, Hurricane Ida (2021)", "DR 4611"; "FEMA verified wind loss, Hurricane Laura (2020)", "DR 4559". |
| 5026 | layer note | "A mortgage requires hazard insurance with wind coverage, so storm and hail work runs through claims". |
| 5029 | layer note | "Metal, FORTIFIED and premium shingle buyers." |
| 5031 | layer label | "Seasonal and recreational homes (camps)". |
| 5033 | layer note | "New Orleans East, the West Bank and the coastal parishes." |
| 5034 | layer label and note | "Speak French or Cajun at home (%)"; "Acadiana." |
| 5035 | layer note | "scaled to 80,000 commercial roofs statewide (CBECS 2018 national count by population)". |
| 5041 | layer note | "The mapped Louisiana roofers' offices". |
| 5042 | layer note, number | "the state has 267 (CBP 2023)". |
| 5043 | layer label, source | "LSLBC roofing license records in the ZIP's city"; "mirrored from the LSLBC roster (StateCreds, October 4, 2026)". |
| 5046 | group names | "Hazard", "Storm record", "Language" (kept only if the layers under them survive). |
| 5054 | tooltip | "<name> Parish". |
| 5056 | tooltip rows | "Hail days a year (1 inch+, 25 mi)", "Hurricane force chance a year". |
| 5065 | module description | "for all 64 parishes". |
| 5071 | eyebrow and dek | "Louisiana, 64 parishes"; "Every roofing job in Louisiana ..."; "the hail, wind and hurricane record and FEMA's damage files". |
| 5072 | masthead | "64 parishes"; "Compiled October 6, 2026". |
| 5076 | callout | "Louisiana only began requiring a permit for every reroof on August 1, 2025"; "every hurricane track and wind radius since 1950 (NHC)"; "FEMA's roof and wind damage registrations for every Louisiana disaster since 2004". |
| 5080, 5081 | menus | "All nine regions"; label "Parish"; "All 64 parishes". |
| 5082 | placeholder | "70808 or Lafayette". |
| 5084 | checkbox | "Storm tracks since 2002". |
| 5097 | card subtitle | "Laura, Delta, Zeta, Ida and Francine (2020 to 2024)". |
| 5106 to 5112 | tile texts | "mobile homes"; "Storm and wind jobs a year"; "FEMA roof and wind registrations", "since 2020 (verified wind loss)"; "<name> Parish". |
| 5114 | track tooltip | hurricane class words from `catLab` (599), "Click for the Storm Ledger". |
| 5122 | rule | tracks are highlighted when the leg is Category 3 or stronger. |
| 5140 to 5141, 5154 | labels | "<name> Parish", pill "Parish". |
| 5146 | row | "FEMA roof and wind registrations, 2004 to 2026". |
| 5149 | paragraph | names Ida (2021), Laura, Delta, Zeta (2020), Gustav and Ike (2008), Katrina and Rita (2005), and the ages 5, 6, 18, 21 at which their spikes sit; "the late 2030s". |
| 5158 | note | "insurers are re underwriting these roofs". |
| 5159 | note, rule `yrs64 <= 6` | "Hurricane force winds reached this ZIP n years ago (year). Many roofs here are young, so age driven demand is muted until the early 2040s; repairs, gutters and FORTIFIED upgrades lead." |
| 5160 | note, rule `hd175 >= 1.0` | "days a year with golf ball hail within 25 miles (SPC 1996 to 2025). Keep a hail inspection campaign built and paused". |
| 5161 | note, rule `mh_sh >= 20` | "Roof over and coating offers outperform shingle replacement copy here." |
| 5162 | note, rule `span_sh >= 8` | "Run Spanish ad groups and a Spanish landing page with the same license and estimate statements." |
| 5163 | note, rule `viet_sh >= 3` | "A Vietnamese speaking estimator and page outperform translation of English ads." |
| 5173, 5176 to 5181 | detail rows | "Last hurricane force winds", "none modeled since 1950", "Hail days a year, 1 inch+ · 1.75 inch+ (25 mi)", "Damaging wind days · EF1+ tornado days a year", "Chance of hurricane force winds a year · storms since 2000", "Peak modeled wind since 2020", "below 34 kt", "Reports 2016 to 2026: hail 1 inch+ · wind 58 mph+ · tornado", "FEMA roof and wind registrations · per 100 homes". |
| 5185 | detail row | "Spanish · Vietnamese · French at home". |
| 5195 | method | "shrunk toward the parish rate". |
| 5197 | judgment call | "which is why Lake Charles, after Laura, shows young roofs and low age driven demand". |
| 5198 | judgment call | "Metal reroofs and FORTIFIED reroofs are carved out ...". |
| 5199 | paragraph | "the storm line follows the coast and the hurricane record", "hail follows the north and the SPC record"; reads `corr.storm.replace`, `corr.hail.storm` by key. |
| 5202 to 5205 | validation | axis labels and the callout quoted in 01.2: "70 years of hurricane history", "Louisiana's exposure is persistent", "Katrina, Rita, Gustav, Ike and Isaac", "two roofs per registration multiplier". |
| 5207 to 5214 | caveats | "the 2025 permit mandate ... at the parish level"; "toward the parish rate"; "fits the South's 2023 American Housing Survey rates"; "Louisiana specific roof ages are not published"; "two roofs per registration before 2020, 3.6 since"; "replacement $15,500, commercial $85,000 ... 33 percent margin". |
| 5217 to 5222 | gaps | "Act 239 of 2025", "parishes and cities", "New Orleans publishes building permits", "The Department of Insurance collects claim counts after declared catastrophes by parish", "The LSLBC search is per contractor". |
| 5227 to 5229, 5233, 5234 | source rows | "(Louisiana, located reports)"; "NHC HURDAT2 Atlantic best tracks 1851 to 2025 (September 23, 2026 release) and NHC operational best tracks for 2026 (Arthur, Bertha, Edouard)"; the FEMA row; the law row with the seven acts and https://legis.la.gov/; "Louisiana roofing companies ... read on their own websites October 6, 2026; LSLBC roofing license roster mirror". |
| 5236 | footer | "Uplift Louisiana Roofing Atlas"; "Compiled October 6, 2026"; "in all 64 parishes". |
| 5245 | export | file name `louisiana-roof-demand-index-by-zip.csv`; note "Uplift Louisiana Roofing Atlas, module 01, compiled 2026-10-06"; "shrunk toward the parish rate". |
| 1209 to 1350 (helper, printed here) | service line units and derivations | every `unit` and `what` in the table in 01.2: hurricanes and tropical storms in the storm unit; "Katrina, Rita, Gustav, Ike and Isaac", "HURDAT2", "a modified Rankine profile before 2004", "52 percent ceiling, a 70 knot midpoint and a 7.3 knot width"; "South: 2.0 percent ... up to 8.5 percent"; "median 1.9" hail days; "Louisiana Fortify Homes Program", "Restore ROOF", "coastal parishes (1.6 times) and hurricane frequency"; "Steel mill producer prices rose 23 percent in the year to August 2026"; "Mobile homes are not eligible for Fortify Homes grants"; "80,000 commercial roofs statewide"; "by parish". |

Hard coded numbers that are true only of this data set: the 22, 8, 3, 20, 1.0 and 6 thresholds of the notes (5158 to 5163); the track highlight at Category 3 (5122); the 25 ZIP hand off (5248); the "early 2040s" and "late 2030s" dates (5159, 5149).

## 01.4 What a California edition of module 01 needs

The module's code is state neutral once the catalog and the texts are rewritten: it shades any ZIP column named in `LAYERS`, and everything else is text. The work is in the columns.

Inputs with an obvious California equivalent (same national source, same method):

| Louisiana input | California equivalent | note |
|---|---|---|
| ACS 2020 to 2024 ZCTA tables (homes, year built, tenure, value, income, language) | the same tables for about 1,760 California ZCTAs and 58 counties | `z.cty` becomes the county; every "Parish" label becomes "County". Keep `res_ok` (500 residents) or raise it. |
| American Housing Survey 2023, South region (roof life, leak rates, projects) | AHS 2023 West region (and its California metro samples, to be checked) | The 22 year Weibull life and the leak rates must be refitted; tile and low slope roofs behave differently from Gulf shingles. |
| ZIP and County Business Patterns, Nonemployer Statistics, Building Permits Survey, BLS producer prices, CBECS scaling of commercial roofs | identical sources | The commercial roof anchor (80,000) scales with population. |
| SPC hail, wind and tornado days within 25 miles; NOAA Storm Events located reports | same files exist for California | They are thin there. Keep the columns but they stop being the main hazard layers. |
| OpenFEMA Individuals and Households registrations | same data set for California disasters (wildfires, 2023 winter storms, floods) | The meaning changes: "verified loss without flood" after a wildfire is mostly total loss, so it feeds rebuilds, not reroofs. |
| LSLBC licence roster by mailing city (third party mirror) | CSLB licence data, classification C-39 Roofing, with address | Likely better than Louisiana's: an official file by ZIP rather than a mirror by city (verify the download and its fields). `lic` and the layer at 5043 become "CSLB C-39 licences". |
| Getis Ord hot spots, shrinkage toward the county rate, percentile index, weights from profit share times tier | identical arithmetic | Recompute `W`, `TIER`, `corr`, `sens`. |

Inputs with no California equivalent, and what I would put in their place:

| Louisiana input | why it does not carry | replacement |
|---|---|---|
| `hur64`, `hur50`, `ts34`, `n64_00`, `n50_00`, `vmax_00`, `vmax_20`, `last64`, `yrs64` (HURDAT2 wind footprints) | no hurricanes | Wildfire exposure: share of homes in High and Very High Fire Hazard Severity Zones (CAL FIRE), structures destroyed and damaged by fire in or near the ZIP (CAL FIRE damage inspection records), years since the last large fire perimeter touched the ZIP. Wind: days a year with gusts at High Wind Warning strength, and a Santa Ana or Diablo indicator by region. Rain: atmospheric river days a year and extreme one day rainfall. Heat: days at or above 100 F and the Title 24 building climate zone. Snow: ground snow load or elevation band for the Sierra and the northern mountains. Coast: distance to the ocean for salt air. |
| The storm reset in the roof renewal model ("reset by every storm that reached the ZIP") | California roofs are not replaced in hurricane waves | Reset only for wildfire rebuilds; otherwise let age, material and climate drive the life. The histogram text at 5149 and the "Recent storm reset" note at 5159 lose their meaning and need a different story (for example post fire rebuild cohorts, or wet winter repair spikes). |
| `fema_ida`, `fema_laura` layers | named Louisiana hurricanes | One or two named California disasters if FEMA registrations are kept, otherwise drop. |
| FORTIFIED line (`p_fortified` and the grant anchor of 9,000 a year) | the grant program is Louisiana's; FORTIFIED is a wind and hail standard | A wildfire hardening line: Class A fire rated reroofs in fire zones under Chapter 7A, with IBHS Wildfire Prepared Home as the comparable voluntary standard and the state's home hardening grant pilots as the (much smaller) grant anchor. |
| `hail` line as a main line | hail of 1 inch is rare in California | Fold hail into the storm line, or keep it as a minor line graded D. Free the slot for a line California has and Louisiana lacks: cool roof replacements under Title 24, tile roof underlayment relays, or reroofs tied to solar. |
| `french_sh` | no Cajun French | Chinese, Tagalog, Korean or another language from the same ACS table; `viet_sh` stays (Orange County, San Jose). The Spanish note threshold of 8 percent (5162) would fire in most California ZIPs: raise it or key it on limited English (`span_lep_sh`). |
| Validation against FEMA wind damage 2020 to 2024 (card at 5097, `valpts`, `val`) | no hurricane hold out | A hold out of the same shape: fire exposure frozen at an earlier year against structures destroyed in later fires, and the rain and wind line against FEMA registrations or reroof permits after the 2023 storms. Axis labels at 5202 to 5204 are hard coded. |
| "Roof permits by ZIP" gap (5217) | California is richer here | Several large California cities publish permit files that separate reroofs. If used, this gap row turns into a source row and the replacement line can be calibrated on counts. |
| Nine LDH regions (`META.model.REG`, `P2R`) | Louisiana regions | A California region table keyed by county FIPS; the menu text "All nine regions" (5080) is a literal. |

Texts that must be rewritten rather than edited: the dek (5071), the callout (5076), the two judgment calls (5197, 5198), the coherence paragraph (5199, which reads the storm and hail correlations by key), the validation card (5097, 5202 to 5205), caveats 4 and 5, all six gap rows, source rows 3, 4, 5, 9 and 10, and every `what` in the service line table.

---

# Module 02. Storm Ledger (`14_m02_storms.js`, lines 5260 to 5745, key `storms`)

## 02.1 What it is for and what it shows

Purpose (5334): "Every hurricane track, hail report, damaging gust and tornado, with modeled roof damage by storm and ZIP". It is the storm response view: named storm tracks drawn on the map and coloured by strength, a modeled wind footprint and roof damage estimate for each storm and ZIP, every located NOAA hail, wind and tornado report as a dot, and the timing charts.

Lines 5263 to 5330 hold "storm record helpers shared by modules 02, 04, 11 and 14": `ZIX`, `kmLL`, `DOW`, `DOW3`, `MON3`, `MONL`, `hourLab`, `listAnd`, `cap1`, `KIND_L`, the report filters `SF`, `sfOk`, `CLIM_L`, `catOfKt`, the colour tables, `CAT_SHORT`, `stormKind`, `stormName`, `SIDX`, `stormFoot`, `dmgShare`, `ptMag`, `STAT_L`, `legTime`, `nearPlace`, the small count scale (`stretchClasses` and friends), `WBANDS`, `footStats`, `RTS`, `LANDMARKS`, `COMPASS`, `landfallWhere`, `lfClock`, `wbandOf`.

State (5336): report filter `all`, view `both`, shading `rate`, years 2002 to 2026, no parish, region, storm, track leg, report or ZIP selected, grid mode `count`.

Visible structure, top to bottom:

| # | element | lines | content |
|---|---|---|---|
| 1 | Masthead | 5352 to 5356 | Eyebrow "Module 02 · Storm Ledger · hurricanes, hail, damaging wind and tornadoes". Dek (verbatim): "Where storms hit roofs. Every named storm whose winds reached Louisiana from 2002 to 2026 is drawn on its track and colored by strength, with a modeled footprint of the wind each ZIP felt and the roofs it likely damaged. Every hail, damaging wind and tornado report NOAA located in Louisiana from 2016 to 2026 sits at its coordinates. This is the view for storm response: which ZIPs to work after an event, when hail and wind season peaks, and how two decades of storms reset the roof stock that module 01 ages." Meta strip: "Storms 38 named storms, 432 track legs (NHC best track)"; "Reports 5,115 hail, wind and tornado reports, 2016 to 2026 (NOAA)"; "Footprints modeled sustained wind at every ZIP, 1950 to 2026"; "Grade A observed reports, B modeled footprints". Buttons "↓ Storms CSV", "↓ Reports CSV", "Campaign Desk ↗", "Site Forge ↗", "◐ Theme". |
| 2 | Callout "Read this first: a storm report is not a damaged roof" | 5358 | Copied in 02.2. |
| 3 | Seven headline tiles | 5400 to 5408 | "Named storms with Louisiana winds" 38 (A; "2002 to 2026; 16 put modeled hurricane force winds over Louisiana ZIPs"). "Storm share of roof replacements" 49% (B; "1.03M roofs replaced after storms since 2000, against 1.09M replaced for age"). "Most destructive storm" Ida 2021 (B; "about 247k roofs damaged (model); 79k FEMA roof registrations"). "Hail 1 inch or larger" 1,053 (A; "reports 2016 to 2026; 255 of golf ball size or larger; peak month April"). "Damaging wind reports" 3,153 (A; "58 mph or more, 2016 to 2026; 248 of 75 mph or more"). "Tornadoes" 743 (A; "2016 to 2026; 518 rated EF1 or stronger"). "2026 so far" 3 storms (A; "Tropical Storm Arthur, Tropical Storm Bertha and Tropical Storm Edouard; 327 storm reports through June"). |
| 4 | Controls | 5360 to 5368 | "Report type" (the twelve `SF` filters). "Named storm" ("All storms in the years chosen", then storms grouped "2020s", "2010s", "2000s", each option "<label> · Category n, tropical storm or depression · <roofs> roofs"). "Years" from and to (2002 to 2026). "Region" ("All nine regions"). "Parish" ("All 64 parishes"). "Show": Tracks, Tracks and reports, Reports. "Shade ZIPs by": 30 year rate, Reports, None. |
| 5 | Map and legend | 5370, 5410 to 5418, 5453 to 5490 | See "Map behaviour" below. |
| 6 | Detail card | 5372, 5532 to 5607 | Four states: a selected report, a selected storm, a selected ZIP, or the summary of the view. See "Detail card" below. |
| 7 | Side table | 5373, 5493 to 5508 | With a storm selected, "The hardest hit ZIPs": ZIP, City, Wind mph, Roofs, Damaged, Share (all footprint ZIPs in view at 34 kt or more). Otherwise "ZIPs with the most reports": ZIP, City, Selection, Hail 1 in+, Wind 58+, Tornado. |
| 8 | Card "Storms ranked" | 5376, 5510 to 5519 | Table: Storm (with "2026 preliminary" tag), Month, "Louisiana strength", Peak mph, ZIPs 39 mph+, ZIPs 74 mph+, Homes 58 mph+, Homes 74 mph+, "Roofs damaged (model)", FEMA (DR number), "FEMA roof regs". Click a row to open the storm. |
| 9 | Cards "Roofs damaged, by storm" and "Homes in hurricane force winds" | 5378 to 5379, 5520 to 5527 | Two horizontal bar charts, the twelve largest storms in the selection, bars coloured by storm class; a note counts the seasons with hurricane force winds. |
| 10 | Card "When storms strike" | 5381, 5624 to 5640 | A 7 by 24 grid (day of week by hour) of the filtered reports, toggle "Count" or "Share of the week", a computed note, and "↓ Grid CSV". |
| 11 | Cards "By month" and "By year and type" | 5383 to 5384, 5641 to 5648, 5685 to 5689 | Stacked bars of the filtered reports by month and by year, by type; under them the fixed chart of named storms by month since 1950 and the fixed chart of Storm Prediction Center reports by year 1996 to 2025. |
| 12 | Cards "Storm resets: roofs replaced by storms and by age" and "FEMA roof and wind registrations by disaster" | 5387 to 5388, 5673 to 5684 | Stacked bars by year 2000 to 2026 of modeled replacements (wear, storm) with a note; a table of the 18 disasters (DR, Event, Year, Registrations, Owners %, Insured %, Measure) with a note. |
| 13 | Cards "Hail size, wind speed and tornado strength" and "Places hit again and again" | 5391 to 5392, 5651 to 5668 | Ten bar classes of report magnitude for all report types in view, with a note; a table by nearest town (Town with parish, Reports, Years hit, Hail 1.75 in+, Wind 58+, Tornado). |
| 14 | Card "From storm to campaign" | 5394, 5693 to 5701 | Seven rows of playbook text with a grade each. |
| 15 | Cards "Caveats" and "Method and sources" | 5396 to 5397, 5702 to 5718 | Eight caveat rows; a method paragraph and five source rows. |
| 16 | Footer | 5719 | Copied in 02.3. |
| 17 | Exports | 5640, 5731, 5732 | `louisiana-storms.csv`, `louisiana-storm-reports.csv`, `louisiana-storm-reports-day-hour.csv`. Columns in 02.2. |

Map behaviour (5453 to 5490):

- Storm selected: each ZIP is shaded by the wind band of its modeled peak sustained wind in that storm (five bands, `WBANDS`); ZIPs below 34 kt are flat grey; only that storm's track is drawn (width 2.6 + 0.55 per category); no report dots. Legend "Modeled peak sustained wind, <storm>" and the note "ZIPs are shaded by the modeled peak sustained wind; gray ZIPs stayed below 39 mph. Gusts ran higher than the sustained winds shown."
- No storm, shading "30 year rate": each ZIP in view is shaded by the climatology column tied to the report filter (`SF[filter].clim`: `hd1`, `hd175`, `hd2`, `wd50`, `wd65` or `td1`) in six light quantile classes (eight when only tracks are shown). Legend "<rate name>, 1996 to 2025".
- Shading "Reports": each ZIP is shaded by the number of filtered reports located inside it, in at most five classes.
- Shading "None": the map switches to parish outlines; a parish can be hovered (tooltip: storm reports, hail 1 inch and 1.75 inch, wind 58 mph and tornadoes, FEMA registrations since 2004, chance of hurricane force winds) and clicked to focus it.
- Tracks (unless view is "Reports"): every leg of every storm whose year is in range, coloured by the leg's Saffir Simpson class (`catColor`), width 1.1 + 0.42 per class step.
- Report dots (unless view is "Tracks" or a storm is selected): one dot per filtered report, coloured by kind (hail, thunderstorm wind, tornado), radius by magnitude (hail under 1 inch, 1, 1.75, 2 inch; wind under 55, 55, 65 kt; tornado EF0, EF1, EF2 or more).
- Hover: ZIP tooltip (storm mode: "Modeled peak sustained wind" and "Roofs damaged (model)"; otherwise the report count, the 30 year rate, "Chance of hurricane force winds in a year", "Last hurricane force winds"); track leg tooltip (storm, time in Central time, sustained wind, status, central pressure, "Roofs damaged in Louisiana (model)"); report tooltip (`ptTip`: magnitude, month, year, weekday, hour "CST", parish, ZIP, "Property damage NOAA estimated", measured or estimated speed, after dark).
- Click: a ZIP opens its storm history, a track leg opens its storm, a report opens the report.

Detail card (5532 to 5607):

- Report: the tooltip content, "Same month within 25 miles" (counts of hail, wind and tornado reports in the same year and month within 40 km), a caution paragraph, buttons "Open ZIP n", "ZIPs within 10 miles to the Desk ↗" (scored ZIPs within 16 km, nearest 25), "Clear".
- Storm: roofs damaged (model) in the view; "Peak modeled sustained wind ... mph over Louisiana (<class>) · lifetime peak ... mph"; "Louisiana landfall" (place phrase, Central time, wind) or "none; its winds reached the state from offshore or across a state line"; "ZIPs at 39 · 58 · 74 mph or more"; "Homes in 58 mph · 74 mph winds"; "FEMA declaration · roof and wind registrations" or "none for individual assistance"; the clicked track point; "Footprint by wind band" table (Sustained wind mph, ZIPs, Roofs, Damaged); "Parishes with the most homes in 58 mph winds"; the "Storm page brief"; buttons "n footprint ZIPs to the Desk ↗", "Storm page to the Forge ↗", "Copy brief", "Clear".
- ZIP: number of storms with modeled hurricane force winds since 1950; storms with tropical storm force winds; last hurricane force winds; one unit roofs; hail, wind and tornado day rates; chance of hurricane force winds; located reports; FEMA registrations since 2004 and since 2020; chart "Roof replacements by year: wear and storms (model)"; table "Every storm with tropical storm force winds at the ZIP" (Storm, Wind mph, Class at the ZIP, Roofs damaged as a share); buttons to modules 01, 17 and 08.
- Summary: count of filtered reports with a per year rate and "in property damage NOAA estimated"; rows for hail (all, 1 inch, 1.75 inch), wind (all, 58 mph, 75 mph), tornadoes (all, EF1 or stronger); "The most destructive storms" (six rows); then, with a parish chosen, the "<name> Parish ledger" (NOAA zone events since 2000, FEMA registrations, hurricane force storms since 2000 and strongest modeled wind, roofs replaced after storms 2000 to 2026), otherwise the "Statewide record (Storm Prediction Center, 1996 to 2025)" (mean reports a year).

## 02.2 Data contract

### Fixed tables defined in the module

Report filters `SF` (5277 to 5290): key, label, test, climatology column.

| key | label | counts a report when | `clim` |
|---|---|---|---|
| `all` | All storm reports | always | `hd1` |
| `hail` | Hail, any size | `k === 0` | `hd1` |
| `h1` | Hail 1 inch or larger | flag `h1` | `hd1` |
| `h175` | Hail 1.75 inch or larger (golf ball) | flag `h175` | `hd175` |
| `h2` | Hail 2 inch or larger | flag `h2` | `hd2` |
| `wind` | Thunderstorm wind, any speed | `k === 1` | `wd50` |
| `w58` | Wind 58 mph or more | flag `w58` | `wd50` |
| `w75` | Wind 75 mph or more | flag `w75` | `wd65` |
| `torn` | Tornado, any strength | `k === 2` | `td1` |
| `ef1` | Tornado EF1 or stronger | flag `ef1` | `td1` |
| `dmg` | Property damage of $10,000 or more | flag `dmg` | `hd175` |
| `night` | After dark (8 p.m. to 6 a.m.) | flag `night` | `wd50` |

Some filters also carry `line: 'hail'` or `line: 'storm'`; nothing in the file reads that property.

Other constants: `catOfKt` (5294): below 34 kt -1, below 64 kt 0, below 83 kt 1, below 96 kt 2, below 113 kt 3, below 137 kt 4, else 5. `CAT_SHORT` (5298): "Below storm force", "Tropical storm", "Category 1" to "Category 5". `stormKind` (5300): "Hurricane" when the storm's lifetime peak (`life`, else `vmax`) is 64 kt or more, "Tropical Storm" at 34 kt, else "Tropical Depression". `STAT_L` (5310): TD "tropical depression", TS "tropical storm", HU "hurricane", EX "post tropical cyclone", SS "subtropical storm", SD "subtropical depression", LO "remnant low", DB "disturbance", WV "tropical wave". `WBANDS` (5321), in knots with their mph text: 34 to 50 "39 to 57 mph"; 50 to 64 "58 to 73 mph"; 64 to 83 "74 to 95 mph (Category 1)"; 83 to 96 "96 to 110 mph (Category 2)"; 96 and up "111 mph or more (Category 3 or stronger)". Report years are fixed at `R0 = 2016`, `R1 = 2026` (5338); the year menus run 2002 to 2026 (5337); decade groups at 5351.

### Formulas

- Damage share (5306 to 5307): "share of roofs a storm damages enough to replace at a given sustained wind (logistic curve fitted to FEMA registrations, module 01)". `dmgShare(kt) = DMG.smax / (1 + exp(-(kt - DMG.v50) / DMG.w))` for `kt >= 34`, else 0, with `smax` 0.5214, `v50` 69.72 kt, `w` 7.263 kt. Worked values: 0.4 percent of one unit roofs at 34 kt, 3.2 percent at 50 kt, 26.6 percent at 70 kt, 50.8 percent at 96 kt; the ceiling is 52 percent.
- Footprint (5303 to 5305): `stormFoot(i)` = `{zip: peak sustained wind kt}` for storm index `i`, built by inverting `zstorm`.
- Storm totals (5322 to 5323), `footStats(label, ok)`: over the footprint ZIPs that pass `ok`: `n34` = ZIPs at 34 kt or more; `n50` and `hu50` = ZIPs and housing units (`hu`) at 50 kt or more; `n64` and `hu64` at 64 kt or more; `est` = sum of `dmgShare(kt) x roofs`; `vmax` = highest wind. `RTS[r]` holds the statewide result for each of the 38 storms.
- Storms in view (5434 to 5440): storms with `year` in range; when a parish or region is chosen the totals are recomputed for its ZIPs and the class becomes `catOfKt(vmax in view)`, otherwise `routes.cat` and `routes.vmax` are used; storms with `n34 = 0` are dropped.
- Report counts per ZIP (5442): reports with a ZIP index that pass the year range, the parish or region scope (by the report's own parish index) and the filter.
- Report years text (5420 to 5422): the overlap of the chosen years with 2016 to 2026.
- Hardest hit ZIPs (5496): `est = dmgShare(kt) x roofs`, `sh = dmgShare(kt) x 100`.
- ZIPs sent to the Desk or the Forge for a storm (5529): scored ZIPs in view by `dmgShare(kt) x roofs`, top 25 (Desk) or 12 (Forge). For reports (5530): scored ZIPs in view by report count, top 25.
- Storm cities for the brief (5531): cities ranked by summed `dmgShare(kt) x roofs` of their ZIPs.
- Nearest place (5312 to 5314): "each place gets a radius that grows with population (about 16 km for New Orleans, 2 km for a town of 4,000); the place with the smallest distance to radius ratio wins"; radius = `1.2 x sqrt(max(2500, pop) / 2000)` km; a report is assigned when it is inside the radius or within 8 km.
- Landfall phrase (5325 to 5328): nearest of the 16 `LANDMARKS`; within 9 km "near <landmark>"; within 90 km "about n miles <compass direction> of <landmark>"; otherwise the coordinates.
- Times: track times are UTC in the data and printed in `America/Chicago` with the word "Central" (5311, 5329); report hours are printed as recorded with "CST" (5431, 5633).
- Grid (5626 to 5639): `g[weekday][hour]` counts; share = count / total; the note reports the share in hours 12 to 19 ("Noon to 8 p.m."), in hours 20 to 5 ("8 p.m. to 6 a.m."), and in the 17 busiest of the 168 cells.
- Headline tiles: `nHu` = storms with `routes.n64 > 0`; storm share = sum of the storm element of `ts.replace_hist` / (storm + wear); `topStorm` = storm with the largest recomputed `est`; `hailPeak` = month with the most hail records in `pts`; `last26` = last month with a 2026 record.
- Storm reset note (5677 to 5679): "big" years are those with more than 50,000 storm replacements; the normal wear volume is the mean wear of 2022 to 2026.
- Size chart classes (5654 to 5656): hail under 1, 1 to 1.74, 1.75 to 1.99, 2 inch or more; wind under 50 kt, 50 to 64, 65 or more; tornado EF0 or unrated, EF1, EF2 or stronger.

### What is read

| read | lines | use |
|---|---|---|
| ZIP columns | Part A | `zip`, `city`, `pi`, `lat`, `lon`, `hu`, `roofs`, `res_ok`, `last64`, `yrs64`, `hd1`, `hd175`, `hd2`, `wd50`, `wd65`, `td1`, `hur64`, `ev_h1`, `ev_w58`, `ev_t`, `fema_k`, `fema_20`. |
| `pts`, `ptflags` | 5339 to 5349, 5427 to 5431, 5442, 5485, 5502, 5537 to 5541, 5570, 5591 to 5600, 5625 to 5666, 5732 | every field. |
| `seg` (`SEGS`) | 5354, 5415 to 5416, 5476 to 5483, 5549, 5556 | `r`, `t`, `v`, `stc`, `cat`, `p`, the path. |
| `routes` (`RT`, `RTI`) | see Part B5 | `r`, `name`, `year`, `month`, `op`, `cat`, `vmax`, `life`, `n64`, `dr`, `fema`, `lf`, `pars`. |
| `sids`, `zstorm` | 5302, 5305, 5571 to 5581 | footprints and the ZIP storm list. |
| `rhist` | 5584 to 5585 | ZIP chart of wear and storm replacements by year. |
| `ts.replace_hist` | 5341 to 5342, 5674 to 5679 | tile and reset chart. |
| `ts.year` | 5604, 5608, 5687 to 5688 | statewide SPC means and yearly chart (1996 to 2025). |
| `ts.fema_year` | 5680 to 5684 | disaster table; `own = a[5] / a[3]`, `ins = a[6] / a[3]`, measure "roof damage" when `a[4]` else "wind loss". |
| `ts.trop_month` | 5685 to 5686 | chart and the August and September share. |
| `parishes` | 5365, 5414, 5424 to 5425, 5431, 5472, 5560, 5603 | `fips`, `name`, `reg`, `ev.n/h1/h175/w58/t`, `fema_k`, `hur64`, `trop.hurr/ts/surge/hw`, `n64_00`, `vmax_00`, `hist`. |
| `places` | 5314 | town names for the "Places hit again and again" table. |
| `META.model.DMG` | 5307, 5707, 5712 | curve parameters; `n` and `rho` in the texts. |
| `META.lic` | 5692, 5698 | `out`, `n`. |
| `META.compiled` | 5719 | footer date. |
| `FEMA_INS` | 5684 | `sh`, `ownSh`. |

### Export columns

- `louisiana-storms.csv` (5731): `storm, year, month, strength_in_area, peak_wind_mph, zips_39mph, zips_58mph, zips_74mph, homes_58mph, homes_74mph, roofs_damaged_model, fema_disaster, fema_registrations_statewide, preliminary`. Note: "Uplift Louisiana Roofing Atlas, module 02. Named storms with modeled tropical storm force winds at a Louisiana ZIP, <years>, <scope>. Winds are modeled sustained winds from NHC best tracks; roofs damaged is the FEMA fitted damage curve times one unit roofs."
- `louisiana-storm-reports.csv` (5732): `year, month, weekday, hour_cst, type, magnitude, unit, parish, zip, lat, lon, damage_usd, measured, after_dark` (wind magnitude converted to mph; damage x 1000).
- `louisiana-storm-reports-day-hour.csv` (5640): `day, h0 ... h23`. Note: "NOAA Storm Events located reports, Louisiana, <filter>, <years>, <scope>. Hours are Central Standard Time."

### Method, caveat and source texts (verbatim)

Callout, 5358: "A storm report is a place where a spotter, a member of the public, an emergency manager or an instrument recorded hail, damaging wind or a tornado. Reports cluster along roads and in towns, so a rural parish with few dots may have had the same storm; the 30 year rate behind the map smooths that by counting storm days within 25 miles of each ZIP. Hurricane footprints are modeled from the National Hurricane Center best track and its wind radii, and the roofs each storm damaged come from a damage curve fitted to FEMA registrations (module 01 method). Use reports to place a storm, footprints to size the roof market it left, and neither as proof that a given roof was damaged."

Card subtitles: 5376 "Every named storm from 2002 to 2026 whose modeled winds reached tropical storm force at a Louisiana ZIP, for the years and area chosen above. Roofs damaged is the footprint model: the share of one unit roofs a storm replaces at the wind each ZIP felt, summed. Click a row to open the storm." 5378 "Modeled roofs damaged in the area chosen, the twelve largest storms in the years chosen." 5379 "Homes in ZIPs where the modeled sustained wind reached 74 mph, the twelve largest storms in the years chosen." 5381 "Day of week by hour of day for the report type, years and area chosen above (NOAA Storm Events, 2016 to 2026). Darker cells hold more reports. This is the grid for staging crews, tarps and emergency ad budgets." 5383 "Reports by month of the year for the selection, stacked by type; below, named storms that brought tropical storm force winds to Louisiana by month since 1950." 5384 "Located reports by year for the selection, stacked by type, with the 30 year statewide record from the Storm Prediction Center below." 5387 "Modeled one unit roof replacements in Louisiana each year, split into replacements driven by wear and those driven by storm damage (module 01 cohort model)." 5388 "OpenFEMA Individuals and Households Program registrations in Louisiana with roof damage or verified wind loss, by declared disaster." 5391 "The size distribution of the reports in the years and area chosen above, all report types." 5392 "Towns with the most reports of the type chosen above, by the nearest town to each report, with the number of separate years they were hit." 5394 "How the storm record turns into pages, placements and crews, with the Louisiana rules that bound each use."

Legend note, 5490 (no storm): "Tracks are every named storm with Louisiana winds, <years>; dots are n <filter>, <report years>. ZIP shading is the long run rate within 25 miles, which corrects for reports clustering in towns. [or] ZIP shading counts the reports located inside each ZIP. Larger dots are bigger hail, faster wind and stronger tornadoes."

Hurricane seasons note, 5527: "n of the n seasons in <years> brought hurricane force winds to <scope>. Large storms reset thousands of roofs at once, which is why replacement demand comes in waves (see the storm reset chart below and module 01's roof age histogram)."

Report caution, 5539: "One record from the NOAA Storm Events Database. It locates the storm, not a damaged roof: canvass and advertise to the ZIPs around it, and confirm damage roof by roof with the owner's permission."

ZIP history note, 5582: "n located storm reports in the ZIP from 2016 to 2026. Roofs damaged is the modeled share of roofs a storm of that strength replaces; storms since 2002 open in this module."

Grid note, 5639: "Noon to 8 p.m. (a third of the day) holds x% of these reports and 8 p.m. to 6 a.m. holds x%. The busiest 10 percent of the week's hours (17 of 168) hold x%; an even spread would hold 10 percent. Peak cells: .... Day of week carries little signal for weather; the hour does. Storm time is not search time: leak and tarp searches spike the same evening and the next morning, inspection and replacement searches follow for weeks. Use the grid to stage crews and emergency budgets, not to switch ads off." Axis text 5634: "Hours are Central Standard Time as NOAA records them."

Year chart note, 5647: "2026 runs through June; NOAA posts each month about three months after it ends."

Size note, 5661: "x% of hail reports are 1 inch or larger, the size at which asphalt shingles begin to bruise and shed granules; x% reach 1.75 inch (golf ball), the size that damages most asphalt shingles. x% of wind speeds were measured by an instrument; the rest are observer estimates, which cluster at 58 mph because that is the warning threshold. Tornado ratings come from damage surveys, so an EF0 in an empty field and an EF0 through a subdivision read the same here."

Storm reset note, 5679: "Storms replaced about 1.03M one unit roofs from 2000 to 2026, 49% of all replacements. Most of it came in a handful of years: 2002 (60k), 2005 (325k), 2008 (120k), 2020 (131k) and 2021 (220k). A storm year replaces many times the normal wear volume of about 45k roofs, then suppresses wear replacements for years because the stock is young, which is why age driven demand dropped after 2005 and again after 2021. The cohorts those storms installed come due together twenty or so years later." Grade B.

FEMA note, 5684: "Through 2017, FEMA inspectors flagged roof damage directly (371,861 registrations). From 2020 the flag is gone, so the atlas counts registrations with verified real property loss and no flood damage (126,165), which is mostly wind and mostly roofs. FEMA counts only people who applied for federal help: 43% of these registrants (54% of the owners) reported homeowners insurance, and owners whose policy paid for the roof had little reason to apply, so insured roof claims after the same storms ran larger still." Grade A.

Tropical months note, 5686: "84 storms brought tropical storm force winds to Louisiana from 1950 to 2025; 67% came in August and September. Hail peaks in April, so the two storm seasons barely overlap: spring is hail and squall lines, late summer is tropical."

SPC note, 5689: "Storm Prediction Center reports for Louisiana, 1996 to 2025. Report counts rise over time partly because more people report (spotter networks, phones, social media), so compare decades with care."

Caveats, 5703 to 5710 (title, text):

1. "Reports follow people": "Storm reports cluster in towns and along highways; a hail swath over farmland may produce one report or none. The 30 year rates count storm days within 25 miles of each ZIP, which smooths the gaps but cannot fill them."
2. "Sizes are estimates": "Most hail sizes are judged against coins and balls, and most wind speeds are estimated; observers round to the warning thresholds of 1 inch hail and 58 mph wind."
3. "Footprints are modeled": "Sustained one minute winds at 10 meters over open ground, from best track positions interpolated hourly and the published wind radii (2004 on) or a fitted wind profile before that. Gusts run higher, trees and buildings slow winds inland, and tornadoes inside hurricanes are not in the footprint."
4. "Damage is a scale, not a count": "The damage curve is fitted to FEMA registrations multiplied up to roofs; FEMA misses most insured owners, so the multiplier is the weakest assumption in the chain (grade D). Rank storms and ZIPs with it; do not quote it as a count of claims."
5. "Single storms can miss": "The curve ranks storm and ZIP pairs well (rank correlation 0.73) but misses individual storms. Rita is the clearest case: about 71k modeled roofs against 76k FEMA roof registrations, 86 percent of them in the Lake Charles and Lafayette ZIP areas (705 and 706), so Rita's real roof damage in southwest Louisiana and Acadiana ran well above what its modeled winds predict." (The 0.73, 71k and 76k are computed; "86 percent" and "705 and 706" are typed in.)
6. "Since 2020, wind loss stands in for roof damage": "FEMA stopped publishing its roof damage flag after 2017. Verified real property loss without flood damage is mostly roofs after a hurricane, but it also includes siding, windows and fallen trees."
7. "2026 is preliminary": "The 2026 tracks are operational best tracks, revised after the season; the 2026 reports run through the most recent month NOAA has published."
8. "Tornado points are touchdowns": "Each tornado is drawn where it began; tracks can run miles beyond the dot."

Method paragraph, 5712: "Reports are NOAA Storm Events records for Louisiana with coordinates, typed as hail (1,198), thunderstorm wind (3,174) and tornado (743), placed in ZIPs and parishes by their coordinates. Tracks are HURDAT2 six hourly best track positions interpolated to hourly legs; each ZIP's peak sustained wind is the strongest wind any hour of the storm put over the ZIP's center, from the quadrant wind radii where published and a modified Rankine profile elsewhere. Roofs damaged = the logistic damage share at that wind (fitted to 2,055 ZIP and storm pairs of FEMA registrations, rank correlation 0.73) × one unit roofs (ACS). Storm resets come from the module 01 cohort model. The 30 year rates are Storm Prediction Center storm days within 25 miles of each ZIP center." (The three counts in brackets are typed in; they match the data today.)

Sources, 5713 to 5717 (layer; dataset; grade; vintage; link):

1. "Storm reports"; "NOAA NCEI Storm Events Database, Louisiana details files 2016 to 2026"; A; "through June 2026"; https://www.ncdc.noaa.gov/stormevents/
2. "30 year rates and yearly record"; "NOAA Storm Prediction Center severe weather database (hail, wind, tornado), 1996 to 2025"; A; "2025 files"; https://www.spc.noaa.gov/wcm/
3. "Tracks and wind radii"; "NHC HURDAT2 Atlantic best track, 1851 to 2025; 2026 operational best tracks"; A; "HURDAT2 2025 release; 2026 preliminary"; https://www.nhc.noaa.gov/data/
4. "Wind and roof damage"; "OpenFEMA Individuals and Households Program valid registrations, Louisiana disasters 2004 to 2026"; A; "v2"; https://www.fema.gov/openfema-data-page/individuals-and-households-program-valid-registrations-v2
5. "Homes and roofs"; "Census ACS 2020 to 2024 five year estimates, ZCTA"; A; "2024 release"; https://www.census.gov/programs-surveys/acs

Comment in the map helper, 877 to 878, on the track legs: "storm track legs (HURDAT2 six hour fixes, 2002 to 2025, and NHC operational best tracks for 2026): label, path, mean sustained wind (kt), Saffir Simpson category of the leg, status code, central pressure, start time, midpoint, nearest parish".

## 02.3 Louisiana specific content in module 02

| line | what | text or rule to find |
|---|---|---|
| 5276 to 5292 | report vocabulary | `KIND_L = ['Hail', 'Thunderstorm wind', 'Tornado']`; the twelve filter labels; `CLIM_L` labels ("Hail days a year, 1 inch or larger within 25 miles" and five more). Not Louisiana as such, but the whole report model is the Gulf and Plains hazard set. |
| 5293 to 5301 | hurricane classification | `catOfKt`, `CATC_L`, `CATC_D`, `CAT_SHORT` ("Tropical storm", "Category 1" to "Category 5"), `stormKind` ("Hurricane", "Tropical Storm", "Tropical Depression"), `stormName`. |
| 5306 to 5307 | damage curve | "logistic curve fitted to FEMA registrations"; the curve was "fit only on Katrina, Rita, Gustav, Ike and Isaac" (5205). |
| 5310 | status words | `STAT_L`, nine tropical cyclone status codes. |
| 5311, 5329 | time zone | `timeZone: 'America/Chicago'`, suffix " Central". |
| 5312 to 5313 | comment | "near Lafayette"; "about 16 km for New Orleans". |
| 5321 | wind bands | five bands with Saffir Simpson category names. |
| 5325 to 5326 | landfall landmarks | comment "coastal landmarks for describing a landfall the way the Hurricane Center does" and 16 names with coordinates: Port Fourchon, Grand Isle, Cocodrie, Dulac, Morgan City, Marsh Island, Intracoastal City, Pecan Island, Creole, Cameron, Holly Beach, Johnson Bayou, Buras, Venice, Pointe a la Hache, "the mouth of the Mississippi River". |
| 5334 | module description | "Every hurricane track, hail report, damaging gust and tornado". |
| 5336 to 5338, 5351 | year constants | years 2002 to 2026; reports 2016 to 2026; decade groups "2020s", "2010s", "2000s". |
| 5350 | storm option text | "Category n", "tropical storm", "depression". |
| 5352 to 5354 | eyebrow, dek, meta | "hurricanes, hail, damaging wind and tornadoes"; "reached Louisiana"; "(NHC best track)"; "1950 to 2026". |
| 5358 | callout | "a rural parish"; "Hurricane footprints are modeled from the National Hurricane Center best track". |
| 5364 to 5365 | menus | "All nine regions"; "Parish"; "All 64 parishes". |
| 5372 | default name | "Louisiana". |
| 5376 to 5394 | card titles and subtitles | "at a Louisiana ZIP"; "Homes in hurricane force winds"; "named storms that brought tropical storm force winds to Louisiana by month since 1950"; "replacements in Louisiana"; "FEMA roof and wind registrations by disaster"; "with the Louisiana rules that bound each use". |
| 5401 to 5407 | tile texts | "Named storms with Louisiana winds"; "hurricane force winds over Louisiana ZIPs"; "FEMA roof registrations"; "Hail 1 inch or larger"; "Tornadoes"; "2026 so far". |
| 5410 | map label | "Map of Louisiana with hurricane tracks and storm reports". |
| 5414 | parish tooltip rows | "FEMA roof and wind registrations since 2004"; "Chance of hurricane force winds in a year"; "Click to focus this parish". |
| 5415 | track tooltip | "Roofs damaged in Louisiana (model)"; "Category n". |
| 5423 | scope name | "<name> Parish" or "Louisiana". |
| 5431, 5633, 5634 | clock | "CST"; "Hours are Central Standard Time as NOAA records them." |
| 5447 to 5449 | ZIP tooltip | "Modeled peak sustained wind"; "below storm force"; "Chance of hurricane force winds in a year"; "Last hurricane force winds"; "none since 1950"; "<name> Parish". |
| 5460, 5465, 5490 | legends | "Modeled peak sustained wind"; ", 1996 to 2025"; "gray ZIPs stayed below 39 mph"; "every named storm with Louisiana winds". |
| 5507 | empty text | "Reports start in 2016." |
| 5509 | landfall text | "none; its winds reached the state from offshore or across a state line". |
| 5513 to 5519 | storms table | "2026 preliminary"; "Louisiana strength"; "Saffir Simpson class of the strongest modeled sustained wind over the area chosen"; "FEMA"; "FEMA roof regs"; "No named storm reached tropical storm force in the area and years chosen." |
| 5521 to 5527 | charts | "FEMA roof registrations, statewide"; "Homes in 74 mph winds"; "ZIPs at hurricane force"; the seasons note. |
| 5536, 5550 to 5560 | storm detail | "<name> Parish"; "in Louisiana"; "over Louisiana"; "Louisiana landfall"; "2026 operational best track, preliminary"; "FEMA declaration"; "none for individual assistance"; "Parishes with the most homes in 58 mph winds"; "No parish saw modeled sustained winds of 58 mph." |
| 5572 to 5582 | ZIP detail | "storms with modeled hurricane force winds since 1950"; "with tropical storm force winds"; "none since 1950"; "FEMA roof and wind registrations since 2004 · since 2020"; "Every storm with tropical storm force winds at the ZIP"; "No modeled tropical storm force winds since 1950." |
| 5603 to 5604 | parish ledger and statewide record | "<name> Parish ledger"; "NOAA zone events since 2000: hurricane · tropical storm · surge · high wind"; "Hurricane force storms since 2000 · strongest modeled wind"; "Statewide record (Storm Prediction Center, 1996 to 2025)". |
| 5610 to 5620 | storm page brief (sent to the clipboard and the Forge) | fallback city "Louisiana"; "Roof Repair After <storm> in <city>"; "<storm> Roof Damage Repair \| <city>, Louisiana"; "brought modeled sustained winds of about n mph to Louisiana"; "Louisiana ZIP codes"; "FEMA recorded n Louisiana registrations with roof damage or verified wind loss"; the sections line: "how to confirm a roofer's Louisiana license and insurance; why every reroof needs a permit and inspections; why the deductible is yours to pay under Louisiana law; how FORTIFIED roofs and the Louisiana Fortify Homes grants work"; query cluster "roof replacement after hurricane <city>"; "the FORTIFIED page"; and the rule line: "Never advertise as an insurance claims specialist or offer to interpret or handle the claim (R.S. 37:2159.1(7), (8)); never offer to pay, waive or rebate a deductible (R.S. 51:451); keep prices at pre storm levels while an emergency declaration stands (R.S. 29:732)." |
| 5640 | export | `louisiana-storm-reports-day-hour.csv`; "Louisiana"; "Central Standard Time". |
| 5684 to 5689 | fixed notes | FEMA note; "Named storms with Louisiana winds, 1950 to 2025"; "August and September"; "spring is hail and squall lines, late summer is tropical"; "Storm Prediction Center reports for Louisiana". |
| 5694 | playbook "Storm pages" | "published within a day or two of landfall"; "Lead with the National Hurricane Center facts and the footprint"; "the deductible law"; "since August 1, 2025 a contractor may not advertise as an insurance claims specialist or offer claim or policy interpretation services (Act 144 of 2025, R.S. 37:2159.1(7), (8))". Grade A. |
| 5695 | playbook "Hail days" | "a contractor may not interpret coverage, adjust the claim or take an assignment of benefits before the work is done and the insurer has inspected (R.S. 37:2159.1, Act 734 of 2022)". Grade A. |
| 5696 | playbook "Canvassing" | "(16 CFR Part 429)"; "Check the parish or city solicitation ordinance and carry the license card. Never quote a price that waives, absorbs or rebates the deductible (R.S. 51:451); contracts of $1,000 or more paid from a claim need the bold deductible notice (R.S. 51:452)." Grade A. |
| 5697 | playbook "After a declaration" | "(R.S. 29:732)"; "Since August 1, 2026 anyone who advertises, solicits, bids or performs residential roofing of $7,500 or more needs the Residential Roofing or Residential Construction license (Act 757 of 2026), and every reroof needs a permit and inspections (Act 239 of 2025)." Grade A. |
| 5698 | playbook "Out of state crews" | "302 of the 950 roofing license records on file (32%) belong to out of state firms, and they arrive with the storms. A local address, a license number on every ad and permits pulled in the homeowner's parish are the trust signals that beat them. Module 07 has the roster." Grade B. |
| 5699 | playbook "Wind season and hail season" | "Hail peaks in April and tropical winds in August and September"; "storm reserves from March to May and from August to October". Grade B. |
| 5700 | playbook "What never to publish" | '"free roof", "we pay your deductible", "we handle your claim" or "insurance approved"'. Grade A. |
| 5703 to 5712 | caveats and method | all eight caveats and the method paragraph quoted in 02.2: hail, HURDAT2, Rita, Lake Charles, Lafayette, "ZIP areas (705 and 706)", "southwest Louisiana and Acadiana", "hail (1,198), thunderstorm wind (3,174) and tornado (743)", "ZIPs and parishes". |
| 5713 to 5717 | sources | "Louisiana details files"; "NHC HURDAT2 Atlantic best track"; "Louisiana disasters 2004 to 2026". |
| 5719 | footer | "Uplift Louisiana Roofing Atlas, module 02. Storm reports from NOAA NCEI and SPC, tracks from the National Hurricane Center, registrations from OpenFEMA. No homeowner names or addresses are kept. Compiled October 6, 2026." |
| 5731 to 5732 | exports | `louisiana-storms.csv`, `louisiana-storm-reports.csv`; column names `hour_cst`, `parish`; notes naming Louisiana and NHC. |
| data | storm names | the 38 route labels (Bertha 2002 to Edouard 2026) and the 119 `sids` names appear in menus, tables and tooltips; the 18 `ts.fema_year` event names (Ivan, Katrina, Rita, "October 2006 storms", Gustav, Ike, Isaac, "March 2016 storms", "August 2016 floods", "February 2017 tornadoes", Laura, Delta, Zeta, "February 2021 winter storms", "May 2021 storms", Ida, Francine, Arthur) fill the FEMA table. |

## 02.4 What a California edition of module 02 needs

This module is the one that cannot be translated; it has to be redesigned around California's hazards. The frame can stay (a map with event shapes, event points, a per event footprint over ZIPs, a ranked event table, timing charts, a brief generator, hand off to the Desk and the Forge). Every data structure behind it changes meaning.

What has an obvious equivalent:

| Louisiana structure | California equivalent | note |
|---|---|---|
| `pts`: located hail, thunderstorm wind and tornado reports, NOAA Storm Events 2016 to 2026 | the same file for California | It exists but is thin: a few hundred hail and thunderstorm wind points and a handful of tornadoes. Keep the layer and the filters, but it cannot carry the module. Report hours would be Pacific Standard Time; replace `America/Chicago`, "Central", "CST" and the `hour_cst` column name. |
| SPC 1996 to 2025 rates (`hd1` ... `td1`), `ts.month`, `ts.hour`, `ts.year` | same source | Same remark. The "two storm seasons" story (5686, 5699) does not hold. |
| `ts.fema_year`, `routes.dr`, `routes.fema`, parish `fema` | OpenFEMA registrations for California's declared disasters | Available, but the measure "roof damage or verified wind loss" has to be redefined per disaster type (wildfire total loss, flood, winter storm). The roof damage flag exists only through 2017. |
| `rhist`, `ts.replace_hist`, parish `hist` (wear and storm replacements by year) | same model outputs | The second series becomes "event driven" (fire rebuilds, wind and rain events) and will be a small share, not 49 percent. The storm reset card and tile need new wording. |
| `places`, `nearPlace` | Census places for California | Same code. |

What has no equivalent, and what I would put in its place:

| Louisiana structure | replacement |
|---|---|
| `routes` (38 named tropical storms), `seg` (track legs with wind and Saffir Simpson class), `sids`, `zstorm` (peak sustained wind per ZIP per storm since 1950), `META.model.DMG` (wind to roof replacement curve fitted on FEMA registrations) | An event table with a `kind` field and one footprint per event. (a) Named wildfires: CAL FIRE perimeters as the drawn shape instead of a track; per ZIP footprint = structures destroyed and damaged from CAL FIRE damage inspection records (those records also carry a roof type field, to be confirmed) plus homes inside or near the perimeter; "roofs damaged" becomes observed destroyed and damaged structures, grade A, so no fitted curve is needed for fire. (b) Wind events (Santa Ana in the south, Diablo in the north, winter storm winds): no best track exists, so the footprint must come from observed peak gusts (airport and fire weather stations) or NWS High Wind Warning and Storm Events "High Wind" zone records, gridded to ZIPs; a damage curve would have to be refitted on gusts, and there is far less FEMA wind data to fit it on (grade D at best). (c) Atmospheric river storms: dated events with an intensity scale (the 1 to 5 scale published by Scripps), footprint = rainfall total or exceedance by ZIP; they drive leaks and repairs rather than replacements. (d) Mountain snow events for the Sierra and the northern mountains: snow load, a small regional line. The one tropical cyclone that reached California with a tropical storm warning (Hilary, August 2023) can be kept as a curiosity. |
| Saffir Simpson colouring, `catOfKt`, `CAT_SHORT`, `WBANDS`, `stormKind`, `STAT_L` | Per kind scales: fire by structures destroyed or acres; wind by gust band (for example 40, 58, 75 mph, 58 being the High Wind Warning level); atmospheric rivers by their 1 to 5 scale. |
| `LANDMARKS`, `landfallWhere`, `lfClock`, `routes.lf` ("Louisiana landfall") | Drop. For a fire use origin and containment dates and the communities inside the perimeter; for an atmospheric river the landfall latitude band. |
| `hur64`, `last64`, `yrs64` in tooltips and the ZIP history ("storms with modeled hurricane force winds since 1950") | Fire history of the ZIP (fires whose perimeter touched it, structures lost, years since), wind event days, atmospheric river days. |
| `ts.trop_month` ("named storms with Louisiana winds by month since 1950") | Monthly climatology of the chosen hazards: acres or structures burned by month (peaks late summer to December), strong wind days by month (October to February), atmospheric river days by month (November to March). |
| parish `trop` (hurricane, tropical storm, surge, high wind zone records) | Storm Events zone records that matter in California: High Wind, Strong Wind, Heavy Rain, Flood, Flash Flood, Debris Flow, Winter Storm, Heavy Snow, Wildfire, Excessive Heat, matched from forecast zones to counties (the zone matching problem described at 6065 is worse in California because zones split counties by elevation). |
| The "out of state crews" playbook row (`META.lic.out`) | CSLB licences are held by California entities with a California address in most cases; the storm chaser story is weaker. After a declared disaster California makes unlicensed contracting a felony (to verify), which is the stronger message. |
| The storm page brief (5609 to 5622) | Event page briefs per kind: wildfire rebuild and smoke or ember damage, wind damage, leak response after an atmospheric river. Every statute in the rule line (5620) and the sections line (5617) is Louisiana law and must be replaced from the California register (see module 03). |

Other points for the rebuild:

- Many California hazards are filed by forecast zone, not by coordinates (high wind, heavy rain, winter storm, wildfire). The dot layer therefore under represents exactly the hazards that matter; plan a zone or grid layer as the default shading and treat dots as secondary.
- The "30 year rate" shading is tied to the report filter by `SF[filter].clim`. New filters need a matching climatology column per ZIP.
- Hard coded numbers to regenerate: the three report counts in the method paragraph (5712), "86 percent" and "705 and 706" (5707), the year ranges 2002 to 2026 and 2016 to 2026, the 50,000 threshold for a "big" year (5677), the 25 and 12 ZIP hand off sizes.
- The FEMA table at 5681 assumes a boolean "roof damage or wind loss" measure per disaster (`a[4]`).

---

# Module 03. Code, License and Claims (`15_m03_law.js`, lines 5747 to 5910, key `law`)

## 03.1 What it is for and what it shows

Purpose (5775): "Licensing at $7,500, permits for every reroof, the claims and deductible rules, price gouging, FORTIFIED grants and the insurer clock, with screening calculators". It is a law register for roofers with five calculators. It has no map and reads almost no data: two values from `META.fort`, and the hard coded tables `LAW_TIMELINE` (5751 to 5761, in the module), `LAWX` (1141 to 1189), `ADRULES` (1191 to 1207) and the line names in `PL`.

Helpers defined in the section: `addYears` (5762, never used), `addDays`, `fmtDate`, `parseD` (5763 to 5765), `ftcHolidays` (5767 to 5771) and `cancelBy` (5772).

Visible structure, top to bottom:

| # | element | lines | content |
|---|---|---|---|
| 1 | Masthead | 5778 to 5782 | Eyebrow "Module 03 · Code, License and Claims · as read October 6, 2026". Dek (verbatim): "Louisiana rewrote the rules for roofers in four sessions. Contractors were barred from handling claims and waiving deductibles in 2022, insurers got a new claim clock and the freedom to drop long held policies in 2024, claims specialist advertising and unpermitted reroofs ended in 2025, and in 2026 residential roofing got its own license, which now covers advertising itself. Every change moves what a job is worth, which offers are lawful and what a page or a door knocker may say. Each item below was read from the act, the statute or the agency, with its citation, and the calculators turn the rules into answers for a specific job." Meta strip: "Register 20 items, 12 grade A" (counted from `LAWX.items`); "Sources enrolled acts and statutes on legis.la.gov; LSLBC; LDI; eCFR"; "Read October 6, 2026"; "Use research for marketing and operations, not legal advice". Buttons "↓ Register CSV", "Compliance Satchel ↗", "◐ Theme". |
| 2 | Callout "Read this first: research, not advice" | 5784 | "This register is written for the people who run and market a Louisiana roofing company: what the law now is and what each change does to licensing, contracts, claims and copy. It is not legal advice, the calculators are screening tools, and a contract, a license question or a dispute belongs with a Louisiana lawyer and the LSLBC. Where a rule is new and untested, or a date was not stated in the act, the register says so instead of guessing." |
| 3 | Seven headline tiles | 5805 to 5813 | All literals except the grant: "Residential roofing license" $7,500 (A; "and up; advertising counts (Act 757 of 2026)"). "Liability coverage" $500,000 (A; "residential licensees from August 1, 2026 (R.S. 37:2156.1)"). "Permits" Every reroof (A; "with inspections, projects from August 1, 2025 (Act 239)"). "Claims specialist ads" Banned (A; "R.S. 37:2159.1(7), (8), Act 144 of 2025"). "Deductible" Owner pays (A; "never waived or rebated (R.S. 51:451); bold notice at $1,000 (51:452)"). "FORTIFIED grant" $10,000 from `META.fort.grant` (B; "up to, paid to the contractor; 3,000 grants in the June 2026 round" from `META.fort.round26`). "Insurer must start adjusting" 14 days (A; "from notice; 30 after a catastrophe (R.S. 22:1892)"). |
| 4 | Card "What changed, and when" | 5786, 5814 | Table Effective, Change, What it does, from `LAW_TIMELINE`; under each change the citation of the linked register item as a link to its source. |
| 5 | Card "License and permit screen" | 5788, 5819 to 5836 | Calculator 1 below. |
| 6 | Card "Contract screen" | 5789, 5838 to 5851 | Calculator 2. |
| 7 | Card "Insurer claim clock" | 5792, 5853 to 5862 | Calculator 3. |
| 8 | Card "Price gouging screen" | 5793, 5864 to 5872 | Calculator 4, with a three bar chart. |
| 9 | Card "FORTIFIED grant and payback" | 5796, 5874 to 5885 | Calculator 5, with a line chart over 15 years. |
| 10 | Card "What the rules do to marketing" | 5797, 5886 to 5894 | Seven rows of text. |
| 11 | Card "The register" | 5799, 5895 to 5899 | Buttons "All lines" and one per service line (short names); each register item whose `lines` contain the chosen line: title, grade, citation as a link to `url`, effective date, the lines, the summary. |
| 12 | Card "Advertising and selling rules" | 5801, 5900 to 5901 | Table Rule, Subject, What it requires, "Where the atlas applies it" from `ADRULES` and a lookup at 5900; then the sources sentence. |
| 13 | Card "Pending and failed" | 5802, 5902 | The three `LAWX.pending` items. |
| 14 | Footer | 5903 | "Uplift Louisiana Roofing Atlas, module 03. Statements of law read October 6, 2026 from enrolled acts, statutes and agency memoranda; screening calculators only. Not legal advice." |
| 15 | Export | 5904 | `louisiana-roofing-law-register.csv`, columns `item, citation, effective, grade, lines, summary, source` (one row per register item). Note: "Uplift Louisiana Roofing Atlas, module 03. Read October 6, 2026. Research material, not legal advice." |

### The five calculators (inputs, defaults, rules, outputs)

Calculator 1, licence and permit (5819 to 5835). Inputs: Building ("Residence of 1 to 4 units" or "Commercial, or 5 or more units"); Job value ($16,500); "Structural work (rafters, trusses, walls)?"; "Sold at the owner's home?"; "Paid from an insurance claim?". Output lines, each with a grade:

- Residence with structural work: "Residential Construction license (residential building): structural work needs the full residential license, which also covers the roofing." A
- Residence, value of $7,500 or more: "Residential Roofing classification or Residential Construction license. Residential roofing of $7,500 or more, and since August 1, 2026 advertising, soliciting, quoting or bidding it, requires one of the two (Act 757 of 2026)." A. At $50,000 or more it adds "At $50,000 or more, confirm with the LSLBC that no other part of the job (decking beyond roofing, framing, other trades) calls for the full residential license." and the grade drops to B.
- Residence under $7,500: "Under $7,500: no state roofing license for this job, though advertising roofing generally invites jobs above the line, and parish or city occupational licenses still apply." A
- Residence at $7,500 or more or structural: "At least $500,000 liability coverage filed with the LSLBC, and workers' compensation kept in force while the license is active (R.S. 37:2156.1)." A
- Commercial at $50,000 or more: "Commercial license with the roofing classification: commercial work of $50,000 or more; subcontracts of $50,000 or more also need licensed subcontractors." A. Under $50,000: "Under $50,000 on a commercial building: no state commercial license for this job; local licenses still apply." A
- Always: "Permit before work starts from the parish or municipality, with the inspections it requires (Act 239 of 2025). Starting early, skipping inspections or understating the value or scope is a licensing violation (Act 422 of 2025)." A
- Sold at the home and value of $25 or more: "Three business day right to cancel with the written notice the FTC Cooling Off Rule prescribes (16 CFR Part 429). A contract signed today could be cancelled until midnight of <date>." A
- Insurance paid: "Itemized good faith estimate of services and materials before any repair agreement, no interpreting the policy, no adjusting, no assignment of benefits before the work is done and the insurer has inspected (R.S. 37:2159.1)." A; and at $1,000 or more "Deductible notice in at least 12 point bold type on the contract; the deductible is the owner's to pay (R.S. 51:451, 51:452)." A
- Footnote: "Screening only. Confirm classifications with the LSLBC (lslbc.gov) before bidding; local permit offices set their own fees and inspection steps."

Calculator 2, contract (5838 to 5850). Inputs: date signed (today); "Signed at the owner's home?" (default yes; "No, at our office or online"); contract price ($14,800); "Insurance expected to pay?" (yes); owner's deductible ($2,500); discount or credit offered ($0). Rules:

- At the home and price of $25 or more: cancel by `cancelBy(date)` = the third day after signing, not counting Sundays or the holidays in `ftcHolidays` (comment at 5766: "the business holidays named in the FTC Cooling Off Rule (16 CFR 429.0): New Year's, Washington's Birthday, Memorial, Independence, Labor, Columbus, Veterans, Thanksgiving, Christmas"). Text: "Cancellation window: the owner may cancel until midnight of <date>, three business days after signing (Sundays and the rule's federal holidays do not count). Hand over the cancellation form and keep a copy. Work started inside the window is work the owner can still cancel; the rule's emergency waiver applies only when the owner started the contact and signs a separate statement for a genuine emergency." Otherwise: "Not a sale at the home: the FTC three day rule does not apply (check any financing terms for their own rescission rights)."
- Insurance paid: at $1,000 or more "Contract of $1,000 or more expected to be paid from insurance: it must carry the statutory deductible notice in at least 12 point bold type (R.S. 51:452)."; under it "Under $1,000: the bold notice is not required, though the deductible rule still applies."
- Deductible flag when discount > 0 and deductible > 0 and discount >= half the deductible: "A $x discount against a $y deductible reads as absorbing or rebating the deductible, which R.S. 51:451 forbids, as it forbids raising the price to cover it. Remove the credit or document an unrelated reason in writing." Otherwise: "The owner pays the $y deductible. Never advertise, promise or agree to pay, waive, absorb or rebate it, or pad the price by it (R.S. 51:451)."
- "Assignment of benefits or a direction to pay: only after the work is complete and the insurer has made its first inspection, and only for the contracted scope (R.S. 37:2159.1)."
- Footnote: "Screening only. The Compliance Satchel (module 10) checks contract text for the notice and the deductible wording."

Calculator 3, insurer claim clock (5853 to 5860). Inputs: date the insurer was notified (today); loss type ("Ordinary loss", "Catastrophic loss", "Catastrophic, extended 30 days by the commissioner"); date of satisfactory proof of loss (today + 21 days); amount due ($18,000); paid within 30 days of proof ($12,000). Rules: adjusting must begin by notice + 14, 30 or 60 days; offer due by proof + 30 days; `unpaid = max(0, due - paid)`; penalty = `max(0.5 x unpaid, 1000)`. Text: "Adjusting must begin by <date> (n days from today): 14 days after notice [or] 30 days after notice of a catastrophic loss [or] 30 days plus the 30 day extension the commissioner may grant after a declared disaster. A written offer and payment of the undisputed amount are due by <date>, 30 days after satisfactory proof of loss. If the $x still unpaid is withheld arbitrarily, capriciously or without probable cause, the insurer faces a penalty of 50 percent of the amount found due or $1,000, whichever is greater, plus proven economic damages, attorney fees and costs: about $y on top of the amount itself." Footnote: "R.S. 22:1892 as amended by Act 3 of 2024. Use it to plan when insurance money arrives and to explain the timeline in general terms. Advising an owner on their coverage or negotiating the claim is barred to contractors (R.S. 37:2159.1); public adjusting needs its own license (R.S. 22:1693)."

Calculator 4, price gouging (5864 to 5871). Inputs: "State of emergency declared for the parish?" (yes); price before the emergency ($520 per square); price charged now ($610); documented cost increase ($45). Rule: ceiling = before + documented increase; over = now - ceiling. Text with no emergency: "No declared emergency: R.S. 29:732 does not apply, though prices must still be truthful and agreed in writing." Otherwise: "Ceiling: the pre emergency price plus documented cost increases, $x a square." then "$y is $z (n%) above it. Lower the price or document the added costs (materials, overtime, travel, disposal) with invoices." or "$y is within it, with $z to spare." Footnote: "R.S. 29:732 applies while a state of emergency is declared and covers goods and services in the area. Keep the price book dated before the season and the supplier invoices that justify any increase." Chart bars: "Before the emergency", "Allowed ceiling", "Charged now".

Calculator 5, FORTIFIED grant and payback (5874 to 5884). Inputs: Home ("Site built house, owner occupied with homestead", "Site built house, rented or no homestead", "Mobile or manufactured home", "Condominium unit", "Recently built or already FORTIFIED"); "Wind coverage in force?"; "Flood zone (SFHA)?" (No; "Yes, with flood insurance"; "Yes, without flood insurance"); FORTIFIED reroof price ($21,500); code reroof price ($16,500); annual wind premium ($2,400); insurer discount (25 percent, clamped 0 to 80). Rules: not eligible when rented or no homestead ("the home must be owner occupied with a homestead exemption"), mobile home ("mobile homes are not eligible"), condominium ("condominiums are not eligible"), new or already FORTIFIED ("recently built and already FORTIFIED homes are not eligible"), no wind coverage ("the home must carry wind coverage"), flood zone without flood insurance ("a home in a flood zone must carry flood insurance"). `grant = eligible ? min(META.fort.grant, FORTIFIED price) : 0`; `owner = price - grant`; `extra = owner - code price`; `save = premium x discount / 100`; payback years = `extra / save`. Text: "Fits the grant's basic rules. Up to $10,000 is paid to the contractor after the roof is certified; rounds are drawn by lottery, so the owner may not be selected." or "Not eligible for the grant: ...". Then "The owner pays $x for the FORTIFIED roof against $y for a code roof, $z more [or less]. A n% discount on a $p wind premium saves about $s a year, from the first year [or] paying back the difference in about n years [or] which does not pay back the difference." Footnote: "R.S. 22:1483.1 and LDI program rules. Discounts are filed by each insurer and vary; never promise one (Satchel FORT2) or a grant (GRANT1). Grant rounds, amounts and eligibility change by year; confirm on the program site before quoting." Chart: "Code roof" (flat) against "FORTIFIED roof, net of grant and discount" = `owner - save x year`, years 0 to 15, y axis "Net cost to the owner".

## 03.2 Data contract

| read | lines | use |
|---|---|---|
| `META.fort.grant` (10000) | 5811, 5878, 5880 | tile value; cap on the grant in calculator 5; text "Up to $10,000". |
| `META.fort.round26` (3000) | 5811 | tile text "3,000 grants in the June 2026 round". |
| `LAWX.items` (20), `LAWX.pending` (3) | 5780, 5814, 5896 to 5897, 5902, 5904 | register, timeline links, CSV. Fields `id`, `t`, `cite`, `eff`, `g`, `lines`, `url`, `s`; pending: `t`, `s`, `g`, `src`. |
| `ADRULES` (15 rows of `[rule, subject, requirement]`) | 5901 | advertising rules table. |
| `PL`, `PLI` | 5799, 5897 | line buttons and line names in the register. |
| `LAW_TIMELINE` (9 rows) | 5814 | timeline. |

No ZIP column, parish field, time series, storm or competitor data is read. `META.fort.lfhp26`, `restore26`, `total26` and `anchor` exist but the $80 million, $20 million and $100 million figures in this module are typed into the text.

How the law was read, comment at 1138 to 1140: "Statements of Louisiana law below were read from the enrolled acts, resume digests and statutes on legis.la.gov, the LSLBC notices of July 13, 2026 and its licensing brochure, and federal rules on ecfr.gov, on October 6, 2026; each carries its citation. Research material, not legal or insurance advice." `LAWX.asof` is "2026-10-06" (1142).

## 03.3 Louisiana specific content: everything in this module

### The register (`LAWX.items`, lines 1144 to 1182): all 20 rows

"lines" are service line keys. Grades as in the source. Rows 11, 12 and 13 are federal rules and carry over unchanged; row 14 is federal with one Louisiana citation; the other 16 are Louisiana law or Louisiana programs.

| # | line | id | item (t) | citation (cite) | effective (eff) | grade | lines | summary (s), verbatim | source (url) |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 1144 | `resroof` | Residential roofing needs its own license at $7,500 | La. R.S. 37:2150.1, 37:2156.4 (Acts 2025, No. 422; Acts 2026, No. 757) | January 1, 2026; broadened August 1, 2026 | A | replace, repair, storm, hail, fortified, metal, mh | Act 422 of 2025 created the Residential Roofing classification. Since August 1, 2026 (Act 757 of 2026) a person who advertises, solicits, quotes, bids, contracts, supervises or performs roofing work worth $7,500 or more on a building used mainly as a residence with up to four units must hold the Residential Roofing or the Residential Construction classification. Advertising is itself covered, so an unlicensed roofer may not run ads for full replacements. Holders of residential construction, building construction or commercial roofing licenses were exempted from the new trade exam. | https://lslbc.gov/wp-content/uploads/LSLBC_Memorandum_Statutory_Changes_July_13_2026_REVISED.pdf |
| 2 | 1146 | `permit` | Every roof and reroof needs a permit and inspections | Acts 2025, No. 239; Acts 2025, No. 422 (LSLBC violations) | Projects beginning on or after August 1, 2025 | B | replace, repair, storm, hail, fortified, metal, mh, mf, comm, coat, newc | Roof construction and reroofing of residential and commercial structures require a permit from the parish or municipality and the inspections the law requires. Act 422 makes it a violation to work without a required permit, to start before the permit issues, to misrepresent the value or scope of the work, or to skip inspections. Permit counts by jurisdiction now record nearly every reroof in the state, which makes local permit logs a demand signal from 2026 on. | https://www.adamsandreese.com/insights/louisiana-enacts-new-requirements-on-roofing-permits-and-licensing |
| 3 | 1148 | `liab` | $500,000 liability coverage for residential licensees | La. R.S. 37:2156.1; LAC 46:XXIX.105 (Acts 2026, No. 757) | August 1, 2026 | A | replace, repair, storm, hail, fortified, metal, mh | Residential construction licensees, their subclassifications and specialties (residential roofing included) and home improvement registrants must keep at least $500,000 in liability insurance or qualifying trust fund protection, filed by the agent, broker or insurer with the LSLBC as certificate holder, with no exclusion for licensed scopes. Workers' compensation and liability protection must stay in force while the license is active. | https://lslbc.gov/wp-content/uploads/LSLBC_Memorandum_Statutory_Changes_July_13_2026_REVISED.pdf |
| 4 | 1150 | `thresholds` | Who needs which license | La. R.S. 37:2150.1 et seq.; LSLBC licensing requirements (June 2025) | In force | A | mf, comm, coat, newc, replace | Commercial projects of $50,000 or more (anything but residences of up to four units) need a commercial license with the right classification, and subcontracts of that size need licensed subcontractors. Residential construction or home improvement of $50,000 or more, or any structural work, needs a residential building license. Home improvement work over $7,500 and up to $50,000 needs at least a home improvement registration, except that residential roofing of $7,500 or more now needs the roofing classification. | https://lslbc.gov/wp-content/uploads/2025/06/Licensing-Requirements-for-Contractors-in-Louisiana.pdf |
| 5 | 1152 | `claimads` | No advertising as an insurance claims specialist | La. R.S. 37:2159.1(7), (8); R.S. 22:1706(H)(11) (Acts 2025, No. 144) | August 1, 2025 | A | storm, hail, replace, fortified, mf, comm | A person performing home improvement contracting may not advertise or solicit as an insurance claims specialist, or as providing any insurance claim or policy interpretation related service to an insured. A public adjuster may not act as the contractor or subcontractor or provide roofing or repair services on a claim the adjuster processed. Copy such as "we handle your claim", "claim specialists" or "we work with your insurance company for you" is now a licensing violation, not just a style risk. | https://legis.la.gov/legis/ViewDocument.aspx?d=1427858 |
| 6 | 1154 | `claimacts` | What a roofer may not do on an insurance claim | La. R.S. 37:2159.1 (enacted as R.S. 37:2175.3(A)(12) to (18) by Acts 2022, No. 734) | In force | A | storm, hail, replace, mf, comm | A contractor, or anyone it pays, may not interpret coverage or duties under the owner's property policy, may not adjust the claim, may not hand an insured a repair agreement without a good faith itemized estimate of services and materials, may not share in or pay for attorney referrals, and may not take an assignment of the insured's rights or proceeds before the work is complete and the insurer has made its first inspection (and then only for the contracted scope). | https://legis.la.gov/legis/ViewDocument.aspx?d=1290211 |
| 7 | 1156 | `deductible` | Deductibles: never paid, waived or rebated, and the notice | La. R.S. 51:451, 51:452 (Acts 2022, No. 734) | In force | A | storm, hail, replace, fortified, metal, mf, comm | A seller paid from a property insurance claim may not advertise, promise or agree to pay, waive, absorb or rebate the insured's deductible, or pad the price by the deductible. Any contract of $1,000 or more reasonably expected to be paid from claim proceeds must carry, in at least 12 point bold type, the statutory notice that Louisiana law requires the insured to pay the deductible. | https://legis.la.gov/legis/ViewDocument.aspx?d=1290211 |
| 8 | 1158 | `claimclock` | The insurer's clock after a roof claim | La. R.S. 22:1892 (Acts 2024, No. 3, SB 323); R.S. 22:1973 repealed | In force (2024 Regular Session) | A | storm, hail | Except for a catastrophic loss, the insurer must start adjusting a property claim within 14 days of notice; after a catastrophe, within 30 days, which the commissioner may extend by up to 30 more days for a declared disaster. A written offer is due within 30 days of satisfactory proof of loss. An arbitrary failure carries a penalty of 50 percent of the amount due plus proven economic damages, or $1,000 if greater, with attorney fees. The separate bad faith statute, R.S. 22:1973, was repealed into this section. Explaining the timeline in general terms is consumer education; advising a specific owner on coverage is not allowed (R.S. 37:2159.1). | https://legis.la.gov/legis/ViewDocument.aspx?d=1372369 |
| 9 | 1160 | `fortify` | Louisiana Fortify Homes Program | La. R.S. 22:1483.1 (Acts 2024, No. 533) | Permanent since June 10, 2024 | B | fortified, replace, storm | Grants of up to $10,000 retrofit an owner occupied, homesteaded, insured home (wind coverage required; flood insurance where the home sits in a flood zone) to the IBHS FORTIFIED Roof standard. The grant is paid to the contractor after the roof is certified; permits, inspections and random reinspections apply. Condominiums, mobile homes and recently built homes are not eligible. In 2026 the June round offered 3,000 grants by lottery, the program gained about $80 million (a $50 million transfer of Katrina and Rita bond assessment funds approved in 2026 plus about $30 million a year in fees), and the state added $20 million of HUD money for coastal homes through Restore ROOF. | https://legis.la.gov/legis/ViewDocument.aspx?d=1384506 |
| 10 | 1162 | `gouge` | Price gouging after a declared emergency | La. R.S. 29:732 | During any declared state of emergency | B | storm, hail, repair, mh | While a state of emergency is declared, prices for goods and services in the area may not exceed those ordinarily charged before the emergency, except for documented increases in cost and business risk. Tarping, repairs and materials after a hurricane are squarely covered; price books dated before the storm are the defense. | https://legis.la.gov/legis/LawSearch.aspx |
| 11 | 1164 | `cooling` | Three days to cancel a sale made at the home | 16 CFR Part 429 (FTC Cooling Off Rule) | In force | A | replace, repair, storm, hail, metal, mh, fortified | A sale of $25 or more made at the buyer's home carries a right to cancel within three business days, with the written notice the rule prescribes. An emergency exception exists only where the buyer starts the contact, needs the work for a genuine emergency and waives the right in a separate signed statement; storm canvassing does not fit it. | https://www.ecfr.gov/current/title-16/chapter-I/subchapter-D/part-429 |
| 12 | 1166 | `reviews` | Reviews and testimonials | 16 CFR Part 465 (eff. October 21, 2024); 16 CFR Part 255 | In force | A | replace, repair, storm, hail, fortified, metal, mh, mf, comm, coat, newc | No fake or AI written reviews, no reviews bought on the condition that they are positive, no undisclosed reviews by staff or relatives, no company controlled "independent" review sites, no suppression of negative reviews, and no fake social media indicators. Civil penalties apply per violation. | https://www.ecfr.gov/current/title-16/chapter-I/subchapter-D/part-465 |
| 13 | 1168 | `regz` | Financing ads and trigger terms | 12 CFR 1026.24 (Regulation Z) | In force | A | replace, metal, fortified, mh, repair | A financing ad that states a payment amount, a number or period of payments, a down payment or a finance charge must also state the down payment, the terms of repayment and the annual percentage rate, using that term. "Financing available" alone triggers nothing. | https://www.ecfr.gov/current/title-12/chapter-X/part-1026/subpart-C/section-1026.24 |
| 14 | 1170 | `tcpa` | Calls and texts | 47 U.S.C. 227; 47 CFR 64.1200; La. R.S. 45:844.11 et seq. | In force | B | replace, repair, storm, hail, fortified, metal, mh, mf, comm, coat, newc | Autodialed or prerecorded marketing calls and texts to mobile phones need prior express written consent; marketing calls must honor the national and the Louisiana Public Service Commission Do Not Call lists. Storm lead lists bought from third parties rarely carry valid consent. | https://www.ecfr.gov/current/title-47/chapter-I/subchapter-B/part-64/subpart-L/section-64.1200 |
| 15 | 1172 | `code` | The state building code governs every roof | La. R.S. 40:1730.21 et seq. (Louisiana State Uniform Construction Code) | In force; confirm the edition with the LSUCC Council | B | replace, storm, hail, fortified, metal, mh, mf, comm, newc | Louisiana enforces the International Residential and Building Codes as adopted with state amendments, including the roof covering wind resistance and underlayment provisions keyed to the design wind speed. FORTIFIED goes beyond code with a sealed roof deck, ring shank nails and tested edges. | https://lsuccc.dps.louisiana.gov/ |
| 16 | 1174 | `lutpa` | Unfair and deceptive advertising | La. R.S. 51:1405 (Louisiana Unfair Trade Practices Act) | In force | A | replace, repair, storm, hail, fortified, metal, mh, mf, comm, coat, newc | Unfair or deceptive acts in trade are unlawful, with private actions and attorney general enforcement. "Number one roofer", "lifetime roof", "insurance approved", "hurricane proof" and invented discounts are the claims that draw complaints. | https://legis.la.gov/legis/LawSearch.aspx |
| 17 | 1176 | `fraud` | Home improvement and contractor fraud | La. R.S. 14:202, 14:202.1 | In force | B | replace, repair, storm, hail, mh | Taking payment for home improvement work and failing to perform, and misapplying payments meant for materials and subcontractors, are crimes with restitution. After a disaster these cases rise, and so does homeowner suspicion of door knockers; licensing, permits and itemized estimates are the trust signals that answer it. | https://legis.la.gov/legis/LawSearch.aspx |
| 18 | 1178 | `nhwa` | New Home Warranty Act | La. R.S. 9:3141 et seq. | In force | B | newc | Builders warrant new homes for one year against defects from noncompliance with building standards, two years for plumbing, electrical, heating and cooling, and five years for major structural defects; roof work done for a builder is measured against that warranty, so builder contracts allocate it. | https://lslbc.gov/wp-content/uploads/New_Home_Warranty_Act.pdf |
| 19 | 1180 | `lien` | Private Works Act liens | La. R.S. 9:4801 et seq. | In force | B | comm, mf, newc, coat | Contractors, subcontractors and suppliers on private works keep lien and privilege rights only by meeting the notice and filing deadlines of the Act; commercial roofers build those dates into every job. | https://legis.la.gov/legis/LawSearch.aspx |
| 20 | 1182 | `threeyr` | Insurers may again nonrenew long held homeowners policies | Acts 2024, No. 9 (HB 611); La. R.S. 22:1265; LDI Regulation 131 | August 1, 2024; coverage changes from January 1, 2025 | A | replace, fortified, metal, storm, hail | Act 9 of 2024 ended the rule that barred insurers from cancelling or nonrenewing homeowners policies in force more than three years. Insurers may file plans to nonrenew up to 5 percent of those policies, and from January 1, 2025 may raise deductibles or change coverage on them. Roof condition and age are common grounds for an insurer inspection, so owners of older roofs now face renewal pressure that turns into replacement demand. | https://legis.la.gov/legis/BillInfo.aspx?s=24RS&b=HB611&sbi=y |

### Pending and failed (`LAWX.pending`, lines 1185 to 1187)

| # | line | title (t) | text (s), verbatim | grade | source note (src) |
|---|---|---|---|---|---|
| 1 | 1185 | Mandatory FORTIFIED discount bill did not pass | SB 222 of 2025 would have required insurers to give a 20 to 30 percent premium discount or rate reduction for FORTIFIED construction by October 1, 2026. It stalled in committee. Discounts remain whatever each insurer files; LDI publishes them under Act 533 of 2024. Copy must not promise a discount size. | A | legis.la.gov, 2025 Regular Session, SB 222 bill history |
| 2 | 1186 | Ban on ads inviting roof insurance claims failed in 2024 | HB 459 of 2024 would have barred contractor ads that encourage owners to contact a contractor or public adjuster to make a roof damage claim. It failed House final passage; Act 144 of 2025 then reached claim specialist advertising instead. Expect the narrower 2024 idea to return. | A | legis.la.gov, 2024 Regular Session, HB 459 bill history |
| 3 | 1187 | Renewal notices now show last year's premium | Act 11 of 2025 requires homeowners renewals to show the prior premium beside the new one and rewrote the rate standards. Owners see premium jumps plainly, which sends some of them looking for FORTIFIED and roof age discounts. | A | legis.la.gov, Act 11 of 2025 (HB 148) resume digest |

### Timeline (`LAW_TIMELINE`, lines 5752 to 5760)

| line | effective date shown | change (title) | what it does (verbatim) | linked register id |
|---|---|---|---|---|
| 5752 | 2022-08-01 | Contractors barred from claim handling; deductible law tightened | Act 734 of 2022: no interpreting coverage, no adjusting, an itemized estimate before any repair agreement, no attorney referral money, no assignment of benefits before the work and the insurer's inspection; no paying, waiving or rebating deductibles, with a bold notice on insurance paid contracts. | `claimacts` |
| 5753 | 2024 session | Insurer claim clock rewritten | Act 3 of 2024 (SB 323): adjusting starts within 14 days of notice (30 after a catastrophe), offers within 30 days of proof of loss, penalties folded into R.S. 22:1892 and R.S. 22:1973 repealed. | `claimclock` |
| 5754 | 2024-06-10 | Fortify Homes made permanent | Act 533 of 2024 makes the Louisiana Fortify Homes Program permanent, adds reinspections and an actuarial study of FORTIFIED discounts. | `fortify` |
| 5755 | 2024-08-01 | The three year rule ends | Act 9 of 2024 (HB 611): insurers may file plans to nonrenew up to 5 percent of homeowners policies in force more than three years; from January 1, 2025 they may change deductibles and coverage on them. | `threeyr` |
| 5756 | 2025-08-01 | No claims specialist advertising | Act 144 of 2025: no advertising or soliciting as an insurance claims specialist or claim interpretation service; public adjusters may not roof the claims they adjust. | `claimads` |
| 5757 | 2025-08-01 | Every reroof permitted and inspected | Act 239 of 2025: roof construction and reroofing need a permit and inspections, for projects beginning on or after August 1, 2025. | `permit` |
| 5758 | 2026-01-01 | Residential Roofing license at $7,500 | Act 422 of 2025 creates the Residential Roofing classification and makes unpermitted work, early starts and understated scope licensing violations. | `resroof` |
| 5759 | 2026-06-01 | Fortify Homes: $100 million year | A June lottery round of 3,000 grants; about $80 million for the program and $20 million of HUD money for coastal homes through Restore ROOF. | `fortify` |
| 5760 | 2026-08-01 | Advertising residential roofing needs the license | Act 757 of 2026: anyone who advertises, solicits, quotes, bids, contracts, supervises or performs residential roofing of $7,500 or more (up to four units) needs the Residential Roofing or Residential Construction license; $500,000 liability coverage for residential licensees. | `liab` |

### Advertising and selling rules (`ADRULES`, lines 1192 to 1206, with the "where" lookup at 5900)

| line | rule (col 1) | subject | what it requires (verbatim) | "where the atlas applies it" (map at line 5900) | Louisiana or federal |
|---|---|---|---|---|---|
| 1192 | R.S. 37:2156.4 (Act 757 of 2026) | Licensed to advertise | Advertising, soliciting or quoting residential roofing of $7,500 or more requires the Residential Roofing or Residential Construction classification. | Satchel LIC1, LIC2, WEB1; Forge footer | Louisiana |
| 1193 | R.S. 37:2159.1(7), (8) (Act 144 of 2025) | No claims specialist claims | No advertising or soliciting as an insurance claims specialist or as providing claim or policy interpretation services. | Satchel INS1, INS2, WEB6; Desk and Forge copy | Louisiana |
| 1194 | R.S. 37:2159.1 (Act 734 of 2022) | Claims conduct | No interpreting coverage, no adjusting, a good faith itemized estimate before any repair agreement, no attorney referral fees, no assignment of benefits before the work and the insurer's first inspection. | Satchel INS3, AOB1, ATTY1 | Louisiana |
| 1195 | R.S. 51:451 | Deductibles | No ad, promise or agreement to pay, waive, absorb or rebate a deductible, and no price padding to cover it. | Satchel DED1, WEB6; Desk and Forge copy | Louisiana |
| 1196 | R.S. 51:452 | Deductible notice | Contracts of $1,000 or more expected to be paid from insurance carry the statutory notice in 12 point bold type. | Satchel DED2 (contracts) | Louisiana |
| 1197 | Act 239 of 2025; Act 422 of 2025 | Permits | Every roof and reroof is permitted and inspected; no start before the permit; no understated value or scope. | Satchel LIC4 | Louisiana |
| 1198 | 16 CFR Part 465 | Reviews | No fake, bought, insider or suppressed reviews; no fake follower or rating indicators. | Satchel FTC1, FTC3, WEB4 | federal |
| 1199 | 16 CFR Part 255 | Endorsements | Disclose material connections; testimonials reflect typical experience. | Satchel FTC1 | federal |
| 1200 | 16 CFR Part 429 | Sales at the home | Three business day cancellation notice for sales of $25 or more made at the home. | Satchel COOL; contract screen above | federal |
| 1201 | 12 CFR 1026.24 | Financing | Trigger terms require the down payment, repayment terms and the annual percentage rate. | Satchel FIN1, META1 | federal |
| 1202 | 47 U.S.C. 227; R.S. 45:844.11 | Calls and texts | Written consent for autodialed or prerecorded marketing; honor the national and Louisiana Do Not Call lists. | Satchel TCPA, WEB3 | federal + Louisiana |
| 1203 | R.S. 29:732 | Price gouging | During a declared emergency, no increases beyond documented costs. | Satchel GOUGE; Storm Desk; screen above | Louisiana |
| 1204 | R.S. 51:1405 (LUTPA) | Truthful claims | Superlatives, lifetime and wind claims, discounts and "insurance approved" must be true and substantiated. | Satchel SUP1, LIFE1, WIND1, LIC3 | Louisiana |
| 1205 | Manufacturer program terms | Certifications and warranties | Name a certification or a manufacturer warranty only as the program allows and only while current. | Satchel CERT1 | program terms (not state law) |
| 1206 | IBHS FORTIFIED program | FORTIFIED claims | FORTIFIED is an IBHS standard: only a FORTIFIED certified roofer advertises installing it, and only an IBHS evaluator issues a designation. | Satchel FORT1, FORT2, GRANT1 | program terms (not state law) |

Sources sentence under the table (5901): "Sources: the statutes on legis.la.gov, the LSLBC memoranda on the 2025 and 2026 acts, and the federal rules on eCFR. Licensing questions go to the LSLBC; consumer complaints go to the Attorney General's Consumer Protection Section." Links: https://legis.la.gov/, https://lslbc.gov/, https://www.ecfr.gov/.

Link table `LAWLINK` (1352; defined, but no line of the file reads it): Act 757 of 2026 -> https://lslbc.gov/wp-content/uploads/LSLBC_Memorandum_Statutory_Changes_July_13_2026_REVISED.pdf; Act 144 of 2025 -> https://legis.la.gov/legis/ViewDocument.aspx?d=1427858; Act 734 of 2022 -> https://legis.la.gov/legis/ViewDocument.aspx?d=1290211; Act 3 of 2024 -> https://legis.la.gov/legis/ViewDocument.aspx?d=1372369; Act 533 of 2024 -> https://legis.la.gov/legis/ViewDocument.aspx?d=1384506; Act 11 of 2025 -> https://legis.la.gov/legis/BillInfo.aspx?s=25RS&b=HB148; LSLBC requirements -> https://lslbc.gov/wp-content/uploads/2025/06/Licensing-Requirements-for-Contractors-in-Louisiana.pdf; LSLBC contractor search -> https://lslbc.gov/contractor-search/; plus the three eCFR links.

### "What the rules do to marketing" (5887 to 5893), verbatim

1. "Licensed to advertise": "Since August 1, 2026 the ad itself is a licensed act for residential roofing of $7,500 or more. Put the LSLBC license number on every ad, page, truck wrap and door hanger; it is the fastest trust signal against storm chasers and the first thing a regulator checks."
2. "No claims talk": "\"We handle your insurance claim\", \"claims specialists\" and \"we work with your insurance company for you\" are licensing violations, not style choices. Say what a roofer does: inspect, document damage with photos, write an itemized estimate, meet the adjuster at the owner's request, and do the work."
3. "Deductibles": "\"We pay your deductible\", \"deductible assistance\" and credits sized to the deductible are unlawful in ads and in the contract. Financing the owner's share is the lawful answer to a large deductible, with Regulation Z disclosures."
4. "Permits as proof": "Every reroof is now permitted, so \"we pull the permit and pass the inspection\" is a claim competitors without a license cannot make. Permit logs are public records: they show who is working where, and from 2026 they are the best count of the reroof market by parish."
5. "Insurance pressure": "With the three year rule gone and renewal notices showing last year's premium (Act 11 of 2025), owners with older roofs face inspections, nonrenewals and price jumps. A page on what an insurer's roof inspection looks for, and FORTIFIED as the way to lower the premium, meets them at the decision."
6. "FORTIFIED": "The grant pays the contractor, so the certified roofer is the program's sales channel. Market eligibility and the process; never the grant as a sure thing or a discount size."
7. "Door to door": "Three business day cancellation on every sale at the home, the deductible notice on insurance paid contracts, and the license card in hand. Local solicitation permits vary by parish and city."

### Other Louisiana items by line

| line | what |
|---|---|
| 5775 | module description: "Licensing at $7,500, permits for every reroof, the claims and deductible rules, price gouging, FORTIFIED grants and the insurer clock". |
| 5778 to 5780 | eyebrow date; dek; "legis.la.gov; LSLBC; LDI; eCFR"; "Read October 6, 2026". |
| 5784 | callout: "a Louisiana roofing company", "a Louisiana lawyer and the LSLBC". |
| 5786 to 5802 | card titles: "License and permit screen", "Insurer claim clock", "Price gouging screen", "FORTIFIED grant and payback" with "whether a home fits the Louisiana Fortify Homes Program". |
| 5806 to 5812 | the seven tiles: thresholds $7,500, $500,000, 14 days, $1,000 and their citations are literals. |
| 5819 to 5834 | calculator 1: thresholds 7,500, 50,000, 25, 1,000; all the texts above; "lslbc.gov". |
| 5838 to 5849 | calculator 2: the 50 percent of deductible flag; R.S. 51:451, 51:452, 37:2159.1. |
| 5853 to 5860 | calculator 3: 14, 30, 60 and 30 days; 50 percent or $1,000; R.S. 22:1892, Act 3 of 2024, R.S. 22:1693; "the commissioner". |
| 5864 to 5869 | calculator 4: "declared for the parish"; R.S. 29:732; the ceiling rule. |
| 5874 to 5883 | calculator 5: homestead exemption, wind coverage, flood zone, mobile home and condominium rules; R.S. 22:1483.1; "LDI program rules"; "drawn by lottery"; Satchel rule ids FORT2, GRANT1. |
| 5900 | the lookup keyed on the exact Louisiana citation strings of `ADRULES`. If a California `ADRULES` uses new first column strings, this lookup must be rebuilt or every row falls back to "Satchel". |
| 5903, 5904 | footer and CSV file name and note. |

## 03.4 What a California edition of module 03 needs

The code is reusable; the content is replaced in full. Three federal rows carry over as they are (16 CFR Part 429 cooling off, 16 CFR Parts 465 and 255 reviews and endorsements, 12 CFR 1026.24 financing ads), as does the federal part of the calls and texts row. `META.fort` needs a California counterpart or the grant tile and calculator 5 go.

The table gives, for each Louisiana register row, the California subject I would research first. These are leads from memory, not citations I have read. The Louisiana register was built by reading each act; the California one must be built the same way, and any row that cannot be confirmed should say so, as the callout at 5784 promises.

| # | Louisiana row | California lead to verify | my confidence that an equivalent exists |
|---|---|---|---|
| 1 | Residential roofing licence at $7,500, advertising covered | Contractors State License Law (Business and Professions Code 7000 and following): a licence is needed above a small job threshold (raised to $1,000 in 2025, to verify), the roofing classification is C-39, advertising work that needs a licence without holding one is an offence, and the licence number must appear in advertising, bids and contracts. | high |
| 2 | Every reroof needs a permit | No single statute I know of: reroof permits come from the California Building Standards Code (Title 24) as adopted and amended by each city and county. The row becomes "check the local building department", possibly with the common rule for when a partial reroof triggers a full one. | medium |
| 3 | $500,000 liability coverage | Different instruments: the contractor's licence bond ($25,000, to verify), workers' compensation, which C-39 roofers must carry even with no employees (to verify), and a required statement in home improvement contracts on whether the contractor carries general liability insurance. No general liability minimum that I know of for sole owners and corporations. | high that the row changes shape |
| 4 | Who needs which licence | CSLB classifications: C-39 Roofing, B General Building (roofing only as part of a larger job, to verify), C-43 Sheet Metal, C-46 Solar; and the Home Improvement Salesperson registration for anyone who sells home improvement contracts away from the contractor's office. | high |
| 5 | No advertising as an insurance claims specialist | No roofing specific ban that I know of. The nearest rule is the Public Insurance Adjusters Act in the Insurance Code (only a licensed public adjuster may negotiate a claim for an insured). | low; may have no equivalent |
| 6 | What a roofer may not do on a claim (interpret, adjust, assignment of benefits) | Same lead as row 5. I know of no California assignment of benefits statute for roofers. | low |
| 7 | Deductibles never paid, waived or rebated; bold notice | I know of no California statute like R.S. 51:451 and 51:452 for roofing. General insurance fraud law would cover inflating an invoice to hide a waived deductible. Do not carry the notice rule or the 12 point bold requirement over. | low; likely no equivalent |
| 8 | Insurer's clock after a claim | Fair Claims Settlement Practices Regulations (California Code of Regulations, title 10, section 2695.5 and 2695.7): acknowledge a claim within 15 days, accept or deny within 40 days of proof of claim, pay within 30 days of acceptance (all to verify), with longer periods after a declared emergency. There is no fixed statutory penalty like Louisiana's 50 percent. | high on the clock, the penalty part goes |
| 9 | Louisiana Fortify Homes Program | California Wildfire Mitigation Program home hardening grants (pilot communities only), the Department of Insurance "Safer from Wildfires" rule that makes insurers recognise mitigation such as a Class A roof in rates, and IBHS Wildfire Prepared Home as the voluntary standard. | medium |
| 10 | Price gouging after a declared emergency | Penal Code 396: after a declared emergency prices may not rise more than 10 percent, with a longer period for repair and reconstruction services (to verify). | high |
| 11 | Three days to cancel a sale at the home | Federal rule unchanged, plus California's home solicitation and home improvement contract law: three business days, five for buyers 65 and over, and a longer period for repair contracts after a disaster (all to verify). | high |
| 12 | Reviews and testimonials | Federal, unchanged. | n/a |
| 13 | Financing ads | Federal, unchanged. PACE financing of roofs is a California topic worth a row. | n/a |
| 14 | Calls and texts | Federal part unchanged; replace the Louisiana Public Service Commission Do Not Call citation. | high |
| 15 | State building code governs every roof | Title 24: roof assemblies in the Building and Residential Codes; the Energy Code's cool roof requirements for reroofs by climate zone and slope; Chapter 7A and its residential twin for fire hazard severity zones (Class A roofing), which I believe moved into a separate wildland urban interface code in the 2025 edition (to verify). | high |
| 16 | Unfair and deceptive advertising (LUTPA) | Unfair Competition Law and False Advertising Law (Business and Professions Code 17200 and 17500), the Consumers Legal Remedies Act, and contractor specific rules, including one that forbids advertising the licence bond ("bonded"), to verify. | high |
| 17 | Home improvement and contractor fraud | Unlicensed contracting offences, with a stiffer one in declared disaster areas; diversion of construction funds; the down payment limit on home improvement contracts ($1,000 or 10 percent, whichever is less, to verify). | high |
| 18 | New Home Warranty Act | The Right to Repair Act for new homes (Civil Code 895 and following). | high |
| 19 | Private Works Act liens | Mechanics lien law (Civil Code 8000 and following), with its preliminary notice and recording deadlines. | high |
| 20 | Insurers may nonrenew long held policies | California's own insurance squeeze: insurer withdrawals and nonrenewals, growth of the FAIR Plan, the one year moratorium on nonrenewal in ZIP codes around a wildfire after a declared emergency, the notice period for nonrenewal, and the Department of Insurance rule package that ties catastrophe models in rates to writing in distressed areas (all to verify). | high that the topic exists |

Calculators:

| Louisiana calculator | California version |
|---|---|
| 1 Licence and permit | Inputs stay (building, value, structural, sold at home, insurance). Rules become the CSLB threshold and classification, bond and workers' compensation, salesperson registration when sold at the home, the local permit, and the down payment limit. The $7,500, $50,000 and $500,000 constants go. |
| 2 Contract | Keep `cancelBy` (Sundays and the listed holidays; California defines business days the same way as far as I recall, to verify). Add buyer age 65 or over and a disaster flag for the longer windows. Replace the deductible block with the down payment and progress payment check. |
| 3 Insurer claim clock | Three dates from the claims regulations (acknowledge, decide, pay) instead of 14, 30, 60 and 30 days; drop the penalty arithmetic. |
| 4 Price gouging | Ceiling = 110 percent of the pre emergency price (with the cost pass through the statute allows, to verify) instead of "before plus documented increase"; label "declared for the county". |
| 5 FORTIFIED grant and payback | Same arithmetic (extra cost over a code roof, annual premium saving, years to pay back) for a Class A or wildfire hardened roof: eligibility inputs become fire zone, pilot community and owner occupancy; the premium becomes the wildfire or FAIR Plan premium; the grant cap comes from the program. |
| new | Two screens California needs and Louisiana lacks: does this reroof trigger the cool roof rules (climate zone, slope, share of the roof replaced), and does it trigger Class A roofing (fire hazard zone, share replaced). |

Tiles, timeline, the seven marketing rows, the pending list and `ADRULES` all follow from the new register. The claims themes (rows 5 to 7 and marketing rows 2 and 3) are the centre of the Louisiana module; if California has no counterpart they should be dropped, not softened, and the centre moves to licence number in advertising, the contract and down payment rules, the fire zone and cool roof code, and the insurance squeeze.

---

# Module 04. Demand Drivers (`16_m04_drivers.js`, lines 5912 to 6090, key `drivers`)

## 04.1 What it is for and what it shows

Purpose (5953): "What drives roofing demand in Louisiana: hurricanes against hail, income and insurance, roof age, the seasons and the clock". It tests the model's explanations against three observed outcomes with a weighted regression across ZIPs computed in the page, projects age driven replacements ten years ahead, shows when in the day and the year storm work arrives, and records the data problems met in the build. There is no map.

The section defines a statistics kit `STATS` (5916 to 5943): `wls` (weighted least squares with an intercept; returns coefficients, standard errors, degrees of freedom, R², adjusted R², n), `zstd` (weighted standardisation), `pT` (two sided p value of a t statistic), `tCrit` (the 5 percent critical t), `shapley` (Shapley split of R² over the predictors: it fits all 256 subsets of the eight predictors). It also defines `ageProjection` (5944 to 5950).

Visible structure, top to bottom:

| # | element | lines | content |
|---|---|---|---|
| 1 | Masthead | 5975 to 5979 | Eyebrow "Module 04 · Demand Drivers · 422 ZIPs, thirty years of storms". Dek (verbatim): "Why one ZIP files FEMA roof claims after every hurricane and another two hours north never does, why hail and hurricanes are different businesses, why roofers cluster in cities while roofs fail in the country, and when in the year and the day the work arrives. This module tests the obvious explanations against observed outcomes with a weighted regression across ZIPs, projects the age engine ten years out, reads the seasons and the clock from thirty years of storm reports, and records every problem found in the public data and how it was handled." Meta strip: "Units 422 ZIPs with 500 or more residents, weighted by homes"; "Outcomes FEMA registrations, LSLBC license records, NOAA hail reports"; "Clock SPC reports 1996 to 2025"; "Method standardized WLS, Shapley R²". Buttons "↓ ZIP predictors CSV", "↓ Seasons and hours CSV", "◐ Theme". |
| 2 | Callout "Read this first: four findings that should change a media plan" | 5981 | Copied in 04.3. |
| 3 | Six headline tiles | 6014 to 6021 | "Roofing jobs a year (model)" 236k (C; "173k of them open to marketing, all eleven lines"). "Storm, wind and hail share" 39% (B; "of jobs in a long run average year; far more in a storm year"). "Age driven, 2026 to 2031" 49k to 58k (B; "a year with no new storm; 66k by 2036"). "FEMA damage explained" 67% (A; "of the variation across ZIPs, by hurricane exposure, hail, income and ownership"). "Two storm seasons" Apr and Sep (A; "hail peak and tropical peak"). "Licensed roofers per 10,000" 1.4 (B; "648 license records based in Louisiana, 302 more out of state"). |
| 4 | Card "What predicts the outcome" | 5984, 6022 to 6027 | Buttons "Storm damage", "Roofers", "Hail reports"; a coefficient plot (eight predictors, effect in standard deviations with 95 percent intervals, p value and Shapley R² per row; filled dots significant at 5 percent); a note with R², adjusted R², n, degrees of freedom and the significant predictors. |
| 5 | Card "How the predictors relate to each other" | 5985, 6028 to 6030 | 8 by 8 Pearson correlation matrix and a note. |
| 6 | Card "The age engine, 2026 to 2036" | 5988, 6033 to 6035 | Line chart of projected age driven replacements, eleven points, with a note. |
| 7 | Card "Where the jobs come from" | 5989, 6036 to 6038 | Horizontal bars of statewide jobs a year by line, largest first, each labelled with its count and share; a note. |
| 8 | Card "The hour of the day" | 5992, 6039 to 6043 | Line chart of SPC hail, thunderstorm wind and tornado reports by hour, 1996 to 2025; a note. |
| 9 | Card "The month of the year" | 5993, 6044 to 6050 | Line chart of the seasonal index (average month = 100) for replacement, storm, hail and leak repair, with hail plus wind reports by month as a fifth line; a note. |
| 10 | Card "What this means for a roofing marketer" | 5995, 6053 to 6059 | Five rows. |
| 11 | Card "Data integrity: problems found in the public files and how each was handled" | 5997, 6060 to 6070 | Nine rows. |
| 12 | Card "Judgment calls and sources" | 5998, 6071 to 6081 | Four judgment rows and four source rows. |
| 13 | Footer | 6082 | "Uplift Louisiana Roofing Atlas, module 04. Regressions computed in the page from the embedded ZIP data. Compiled October 6, 2026." |
| 14 | Exports | 6084, 6085 | `louisiana-zip-demand-predictors.csv`: `zip, city, parish, homes, hur, hail, old, mh, inc, own, dens, age20, fema, lic, hailrep`; note "Uplift Louisiana Roofing Atlas, module 04. Raw predictor values (logs as labeled) and observed outcomes." `louisiana-roofing-seasons-hours.csv`: `kind, index, hail_reports, wind_reports, tornado_reports, replace_index, storm_index, hail_index, repair_index` (12 month rows, then 24 hour rows); note "Storm Prediction Center reports for Louisiana 1996 to 2025; seasonal indexes from the service line model." |

## 04.2 Data contract

### The regression (5956 to 6011)

Units: `ZD` = scored ZIPs with `inc > 0`, `sqmi > 0`, and non null `hur64` and `hd1` (422 of 441). Weights: `hu` (1 when zero).

Predictors `PRED` (5957 to 5966), each standardised with the weights before fitting:

| key | label | value |
|---|---|---|
| `hur` | Chance of hurricane force winds in a year (%) | `hur64` |
| `hail` | Hail days a year, 1 inch or larger | `hd1` |
| `old` | Homes built before 1980 (%) | `pre80_sh` |
| `mh` | Mobile homes (% of homes) | `mh_sh` |
| `inc` | Median household income (log) | `log10(inc)` |
| `own` | Owner occupied homes (%) | `own_sh` |
| `dens` | Residents per square mile (log) | `log10(max(1, pop) / sqmi)` |
| `age20` | Roofs 20 years or older (%, model) | `ra20_sh` |

Outcomes `OUT` (5967 to 5971), all logged:

| key | button | label | value |
|---|---|---|---|
| `fema` | Storm damage | FEMA roof and wind registrations per 100 homes, 2004 to 2026 | `fema_rate` |
| `lic` | Roofers | Roofing license records per 10,000 residents (LSLBC) | `lic / max(1, pop) x 10,000` |
| `hailrep` | Hail reports | Hail reports of 1 inch or larger per 100 square miles, 2016 to 2026 | `ev_h1 / sqmi x 100` |

Fit (6004 to 6010): zero outcomes are replaced by half the smallest positive value, then `y = zstd(ln(value))`; `fit = wls(y, X, W)`; `shapley(y, X, W)`; interval = `b ± tCrit(df) x se`; p from `pT`. Results today (my recomputation, to compare a California build against):

| outcome | R² | n, df | coefficients (standard deviations), Shapley share |
|---|---|---|---|
| `fema` | 0.67 | 422, 413 | hur +0.40 (0.26), hail −0.43 (0.29), inc −0.27 (0.02), own +0.30 (0.04), age20 −0.09 (0.04), dens +0.11, old −0.03, mh −0.01; 3 ZIPs with a zero outcome |
| `lic` | 0.33 | 422, 413 | dens +0.58 (0.15), old −0.18, hail +0.14; 226 ZIPs with no licence record |
| `hailrep` | 0.25 | 422, 413 | hail +0.35 (0.12), inc +0.28, own −0.23, old −0.12; 135 ZIPs with no report |

Predictor correlations printed in the note at 6030 (unweighted Pearson over `ZD`): hurricane and hail −0.54; hail and roofs 20+ +0.35; hurricane and roofs 20+ −0.38; mobile homes and density −0.68; pre 1980 and income −0.39.

### The age projection (5944 to 5950, 5973)

Comment: "ten year projection of age driven replacements from the 2026 roof age distribution, with no new storms". `lam = WB.L / gamma(1 + 1 / WB.k)` (so the mean life is `L` = 22 years with shape `k` = 3); survival `S(t) = exp(-(t / lam)^k)`; one year hazard `H(t) = 1 - S(t + 1) / S(t)`. Start from `ts.agehist` (41 age bins). Each year: replacements = sum of `count[age] x H(age)`; survivors move up one bin (the last bin, 40 and over, keeps its survivors); bin 0 = replacements + new homes a year. New homes a year = the mean of `ts.permits[year][0]` for 2021 to 2025 (13,011). Output today: 49,476 in 2026, 58,180 in 2031, 65,633 in 2036 (+33 percent). `gammaFn` comes from module 17 (9385).

### Other reads

| read | lines | use |
|---|---|---|
| `META.pools` | 5972, 6015 to 6016, 6036 to 6037 | total jobs (236,327); storm plus hail share (39 percent); bars by line with `pool / total`. |
| `META.cases` | 5972, 6015 | jobs open to marketing (172,763). |
| `META.lic.inla`, `META.lic.out`, `META.pop` | 5974, 6020 | licensed roofers per 10,000 = `inla / pop x 10,000`. |
| `ts.month` (`hail`, `wind`, `torn`) | 6013, 6046, 6085 | hail peak month; index of hail plus wind reports = value / mean x 100; CSV. |
| `ts.trop_month` | 6013 | tropical peak month. |
| `ts.hour` | 6039 to 6043, 6085 | hour chart; afternoon share = hours 13 to 19 / total (hail 58 percent, wind 51 percent); night share for tornadoes = hours 20 to 5 (31 percent). |
| `ts.agehist`, `ts.permits` | 5973, 6035 | projection. |
| `SLM.SEA` | 6044 to 6050, 6085 | seasonal curves for `replace`, `storm`, `hail`, `repair` (built in `09_sl_model.js`, see Part C2). |
| `META.model.WB` | 5946 | `L`, `k`. |
| `META.compiled` | 6082 | footer date. |
| `PL` | 6036 | line names. |

### Method and data integrity texts (verbatim)

Regression card subtitle, 5984: "Standardized coefficients from a weighted regression across ZIPs (weights = homes; outcome logged). Bars are 95% intervals; filled dots are significant at 5%. Shapley R² splits the explained variance among predictors." 5985: "Pearson correlations across ZIPs. Strongly related predictors share credit in the regression; Shapley R² handles that fairly."

Regression note, 6026: "<outcome label>. R² = x (adjusted x), n = n ZIPs, n degrees of freedom; n ZIPs with none were set to half the smallest observed rate before logging. Significant at 5%: .... " followed by one of: "Young roofs predict more FEMA damage, not less: storms reset the roofs of the ZIPs they hit, so roof age here is partly an effect of past damage." (fema); "Many ZIPs have no license record at all, so this fit describes where roofers base themselves, not where they work." (lic); "Hail reports depend on who is there to report them; the 30 year hail day rate is the better guide to where hail falls." (hailrep); and always "ZIP rates are ecological: they describe places, not households."

Age engine subtitle, 5988: "Age driven one unit roof replacements a year if no new storm reset the stock: the 2026 roof age distribution aged forward with the model's service life, new homes entering at age zero." Note, 6035: "With no new storm, age driven replacements rise from about 49k in 2026 to 58k in 2031 and 66k in 2036, 33% more, as the roofs the 2005 to 2008 storms installed pass twenty and the 2020 and 2021 storm roofs reach their teens. A major hurricane would replace tens of thousands of roofs at once, then push this curve down for a decade in the ZIPs it hit. New homes enter at about 13k a year (permits, 2021 to 2025)." Grade B.

Jobs note, 6038: "Storm work (wind and tropical, replacements and repairs) is the largest pool in a long run average year, then repairs and age driven replacements. Counts are jobs, not dollars: a commercial reroof is one job worth many residential repairs, which module 12 weighs. Grades run from B for storm and age driven work to D for coatings and commercial, where the inputs are assumptions you can replace."

Hour note, 6043: "Hail and wind peak between 1 p.m. and 8 p.m. (58% of hail and 51% of wind reports), when the afternoon heat drives storms. Tornadoes spread across the clock: 31% come between 8 p.m. and 6 a.m., which is why overnight tornado damage fills the next morning's phones. Staff answering and emergency tarping for the evening and the morning after."

Month note, 6050 (the two months are the peaks of `SLM.SEA.storm` and `SLM.SEA.hail`; today September and May): "Storm demand peaks in <month> and hail demand in <month>: each follows its storms by a month or two as inspections, claims and permits run their course (the model spreads each storm month's work over that month and the next two). Age driven replacement is steady with a spring and fall shoulder and a holiday dip; leak repairs follow the rain. The storm curves are built from the data (grade B); replacement, FORTIFIED and commercial seasons are assumptions (grade D) until your own job history replaces them in module 12."

Data integrity rows, 6061 to 6069 (title, text). These are build notes and apply to any rebuild that uses the same sources:

1. "Census API key": "The Census API now requires a key for this volume of requests; the ACS 2020 to 2024 tables were read from the bulk summary files instead. ZIP sums match the state totals within 0.1 percent."
2. "ACS sentinel values": "Medians the Census cannot estimate are published as large negative codes (such as −666,666,666); they were set to missing before any average, rate or regression."
3. "SPC yearly files": "The Storm Prediction Center's single year report files for 2000 to 2007 are not posted (the links return an error page); its combined 2000 to 2004 and 2005 to 2007 files were used."
4. "FEMA roof flag": "FEMA's roof damage field is zero for every registration from 2020 on. Verified real property loss without flood damage stands in, with its own multiplier in the damage curve (3.6 against 2.0)."
5. "Storm Events zones": "Hurricane, storm surge and high wind events are filed by forecast zone, not coordinates; zone names such as Upper Jefferson or Coastal Cameron were matched to parishes by removing the qualifier."
6. "Storm Events clock": "NOAA records event times in local standard time all year; summer reports read an hour early on a daylight time clock. Times were kept as recorded."
7. "2026 hurricanes": "HURDAT2 runs through 2025; the 2026 storms come from National Hurricane Center operational best track files and are marked preliminary."
8. "Wind radii before 2004": "HURDAT2 carries wind radii only from 2004; earlier storms use a modified Rankine wind profile with the radius of maximum winds estimated from intensity and latitude (Willoughby)."
9. "Business Patterns detail": "ZIP level business patterns leave many establishments without detailed industry codes, so ZIP counts by industry run below county totals (roofers 152 against 267); statewide totals use the county file and commercial roofs are anchored to a statewide count."

Judgment rows, 6072 to 6075: "Weights": "ZIPs are weighted by homes so a small ZIP's noisy rate counts less; unweighted fits give rural ZIPs more say and strengthen the hurricane effect." "Logs": "Outcomes, density and income are logged because they are skewed; ZIPs with a zero outcome are set to half the smallest observed rate. Coefficients are in standard deviations." "Observed outcomes only": "The modeled job counts are not used as outcomes here, because they are built from these same predictors; FEMA registrations, license records and hail reports are observed." "Ecology": "Associations between ZIP averages do not describe individual homeowners."

Sources, 6077 to 6080: "FEMA registrations"; "OpenFEMA Individuals and Households Program valid registrations, Louisiana disasters 2004 to 2026"; A; "v2"; https://www.fema.gov/openfema-data-page/individuals-and-households-program-valid-registrations-v2. "License records"; "LSLBC roofing license records via a public mirror, 950 records"; B; "October 2026"; https://lslbc.gov/. "Storm reports and rates"; "NOAA NCEI Storm Events 2016 to 2026; Storm Prediction Center 1996 to 2025"; A; "2026"; https://www.spc.noaa.gov/wcm/. "Predictors"; "ACS 2020 to 2024 (B25034, B25024, B25003, B19013, B01003); hurricane climatology from HURDAT2 1950 to 2025"; A; "2026"; https://www.census.gov/.

## 04.3 Louisiana specific content in module 04

| line | what | text or rule to find |
|---|---|---|
| 5953 | module description | "What drives roofing demand in Louisiana: hurricanes against hail, income and insurance ...". |
| 5958, 5959 | predictors | `hur64` and `hd1` are the first two predictors by design; labels "Chance of hurricane force winds in a year (%)", "Hail days a year, 1 inch or larger". |
| 5968 to 5970 | outcomes | "FEMA roof and wind registrations per 100 homes, 2004 to 2026"; "Roofing license records per 10,000 residents (LSLBC)"; "Hail reports of 1 inch or larger per 100 square miles, 2016 to 2026". |
| 5975 to 5977 | eyebrow, dek, meta | "thirty years of storms"; "files FEMA roof claims after every hurricane and another two hours north never does"; "hail and hurricanes are different businesses"; "LSLBC license records". |
| 5981 | callout, four findings (verbatim) | "1. Hurricanes and hail are two markets at opposite ends of the state. FEMA roof and wind registrations rise with hurricane exposure and fall with hail days, because hail belongs to north Louisiana and rarely brings a federal declaration, while hurricanes belong to the south and usually do. A statewide roofer runs a hurricane business and a hail business, with different seasons, offers and crews. 2. Income decides who pays. At the same hurricane exposure, lower income ZIPs file more FEMA roof registrations, a sign that more of their damage falls outside insurance. Those owners need repair first offers, financing and grant information; insured owners in higher income ZIPs carry the claim funded replacements. 3. Roofers live where people live. License records follow population density, not storm exposure, so the rural parishes that take the hurricanes have the fewest local roofers, which is the opening for a regional company and for storm chasers. 4. Demand runs on two clocks. Storms come in spring (hail and squall lines) and late summer (tropical), and every big storm schedules a replacement wave about twenty years later." The findings are typed in, not computed; only the regression beneath them is live. |
| 5988 to 5993 | card subtitles | "if no new storm reset the stock"; "Storm Prediction Center reports in Louisiana by hour, 1996 to 2025 (local standard time)"; "against hail and wind reports by month". |
| 6016 to 6020 | tiles | "Storm, wind and hail share" (adds `pools.storm + pools.hail` by key); "FEMA damage explained ... by hurricane exposure, hail, income and ownership"; "Two storm seasons ... hail peak and tropical peak"; "license records based in Louisiana". |
| 6026 | regression notes | the three outcome specific sentences quoted in 04.2. |
| 6028 | short labels | "Hurricane", "Hail days", "Pre 1980", "Mobile homes", "Income", "Owners", "Density", "Roofs 20+". |
| 6030 | correlation note | "the coast takes the hurricanes and the north takes the hail, and the north's roofs are older because no hurricane has reset them"; reads `corr.hur.hail`, `corr.hail.age20`, `corr.hur.age20`, `corr.mh.dens`, `corr.old.inc` by key. |
| 6035 | projection note | "the roofs the 2005 to 2008 storms installed pass twenty and the 2020 and 2021 storm roofs reach their teens. A major hurricane would replace tens of thousands of roofs at once". |
| 6038 | jobs note | "Storm work (wind and tropical, replacements and repairs) is the largest pool". |
| 6040 to 6048 | chart series | "Hail", "Thunderstorm wind", "Tornado"; season lines keyed `replace`, `storm`, `hail`, `repair` with labels "Replacement (age driven)", "Storm and wind", "Hail", "Leak repair". |
| 6043, 6050 | notes | afternoon heat storms, overnight tornadoes; "replacement, FORTIFIED and commercial seasons are assumptions". |
| 6054 | marketer row "Two storm businesses" | "Hurricane work in the south (tarps, emergency repair, FORTIFIED, insured replacement after a declaration) and hail work in the north (inspections after a hail day, impact rated shingles, insured replacement without any declaration). Separate pages, campaigns, crews and calendars; module 02 finds both." |
| 6055 | marketer row "Who pays decides the offer" | "In lower income, owner occupied ZIPs storm damage often lands on owners without enough insurance: lead with repair, financing and the Fortify Homes grant. In higher income ZIPs the claim funded full replacement is the offer, inside the claim rules (module 03)." |
| 6056 | marketer row "Go where the roofers are not" | "Rural storm parishes have few licensed local roofers. A regional company with a local address, permits pulled in the parish and a license number on every ad wins there; module 07 maps the competition." |
| 6057 | marketer row "Budget for the waves" | "Age driven demand is growing a few percent a year for the next decade as storm cohorts age. Fund replacement campaigns in the ZIPs where roofs aged 15 to 19 concentrate (module 17), and hold a storm reserve for the two seasons." |
| 6058 | marketer row "Time the day" | "Afternoon storms mean evening and next morning calls. Put emergency ad groups and answering on the evening and early morning, not only office hours." |
| 6061 to 6069 | data integrity | rows 3 to 8 are about SPC files, the FEMA roof flag, hurricane zones ("Upper Jefferson or Coastal Cameron ... matched to parishes"), HURDAT2 and wind radii; row 9 has the typed in "roofers 152 against 267". |
| 6072 | judgment | "strengthen the hurricane effect". |
| 6077 to 6080 | sources | "Louisiana disasters 2004 to 2026"; "LSLBC roofing license records via a public mirror, 950 records" (950 typed in); "hurricane climatology from HURDAT2 1950 to 2025". |
| 6082, 6084, 6085 | footer and exports | "Uplift Louisiana Roofing Atlas"; file names `louisiana-zip-demand-predictors.csv`, `louisiana-roofing-seasons-hours.csv`; column name `parish`; "Storm Prediction Center reports for Louisiana 1996 to 2025". |
| 2131 (helper) | rain normals | `RAIN`, "Louisiana statewide normal precipitation, inches (NOAA 1991 to 2020, rounded)", feeds the repair season drawn at 6047. |

## 04.4 What a California edition of module 04 needs

The statistics kit, the projection and all chart code are state neutral. The module needs three things from a California data set: observed outcomes, hazard predictors, and seasonal and hourly series.

| Louisiana input | California equivalent or replacement |
|---|---|
| Outcome `fema` (`fema_rate`): the strongest test in Louisiana (R² 0.67) because hurricanes bring declarations | FEMA registrations exist only where a wildfire, flood or winter storm was declared, and measure total losses more than roof work. Better observed outcomes for California, if they can be had by ZIP: reroof permits per 1,000 homes in the cities that publish them; wildfire structures destroyed or damaged per 1,000 homes; the share of homes insured by the FAIR Plan or the insurer nonrenewal rate (the Department of Insurance has published ZIP level counts, to verify). Each would answer a different question, as the three Louisiana outcomes do. |
| Outcome `lic` (LSLBC records per 10,000) | CSLB C-39 licences per 10,000 residents by ZIP: a direct equivalent, and probably cleaner. |
| Outcome `hailrep` (`ev_h1` per 100 square miles) | Too sparse in California. Replace with located wind damage reports, or drop to two outcomes. |
| Predictors `hur64` and `hd1` | Fire hazard zone share, wind event days, atmospheric river or heavy rain days; possibly a heat measure and distance to the coast. Keep `pre80_sh`, `mh_sh`, income, ownership, density and `ra20_sh` as they are. With more than eight predictors the Shapley routine grows as 2 to the power of the count (256 fits now, 1,024 at ten), still fine in a browser for 1,760 ZIPs but worth checking. |
| `ts.month`, `ts.hour` (SPC hail, wind, tornado reports for Louisiana) and `ts.trop_month` | Monthly series for California's hazards: structures or acres burned, high wind events, heavy rain events, by month. An hourly series has little meaning for those; the "hour of the day" card can be dropped or rebuilt on wind gusts. The tile "Two storm seasons" (hail peak and tropical peak) needs a new pair, for example the rain season and the fire and wind season. |
| `SLM.SEA` seasonal curves, including the Louisiana rain normals | Rebuilt in the service line model from California series (rain for leaks, fire and wind months for the event lines). The lag rule (40, 35, 25 percent over three months) is a judgment that can stay. |
| `ts.agehist`, `ts.permits`, `META.model.WB` | Same structures; refit the life. The note's storm cohorts (6035) go. |
| `META.pools`, `META.cases`, `META.lic` | Same structures with the new lines; the tile at 6016 adds two lines by key (`storm`, `hail`). |

The four findings in the callout (5981) and the five marketer rows (6054 to 6058) are conclusions drawn from Louisiana's results. They must be written after the California regressions are run, not translated. Data integrity rows 1, 2, 6 and 9 will recur in California as they stand; rows 3, 4, 5, 7 and 8 are tied to the storm sources and should be replaced by whatever the fire, wind and rain sources throw up (zone based events and elevation split forecast zones are the likely first entry).

---

# Module 05. Paid Acquisition (`17_m05_paid.js`, lines 6092 to 6291, key `paid`)

## 05.1 What it is for and what it shows

Purpose (6108): "Where an ad dollar reaches the most sold jobs: gross profit pool per click cost, quadrants, tiers and bid modifiers by ZIP". For any mix of the eleven service lines it divides each scored ZIP's gross profit pool by a modeled relative cost per click, ranks the ZIPs, assigns tiers, bid modifiers and quadrants, and prices a monthly budget over a chosen set of ZIPs.

Defined before the module: `REG_MKT` (6097), `QUAD_PLAY` (6098 to 6103), `quadColor` (6105). State (6110): all eleven lines on, map layer `tier`, no region, parish or ZIP, target set `A`, 40 ZIPs.

Visible structure, top to bottom:

| # | element | lines | content |
|---|---|---|---|
| 1 | Masthead | 6111 to 6114 | Eyebrow "Module 05 · Paid Acquisition · every scored ZIP". Dek (verbatim): "Job flow is not the same as a good place to spend. New Orleans, Baton Rouge and the Northshore carry the most roofs and the most expensive clicks, because every statewide roofer and every storm crew buys them. This module divides each ZIP's gross profit pool by what a click is likely to cost there, splits the state into four quadrants of demand and competition, and turns the ranking into tiers and bid modifiers the Campaign Desk can upload." Meta strip: "ZIPs 441 scored"; "Cost modeled from region and competition (grade D)"; "Lines choose any mix of the eleven"; "Output tiers, bid modifiers, budget split". Buttons "↓ Bid modifiers CSV", "↓ Parish rollup CSV", "Campaign Desk ↗", "◐ Theme". |
| 2 | Callout "Read this first: what this module claims and does not" | 6116 | Copied in 05.2. |
| 3 | Six headline tiles (recomputed for the chosen lines) | 6170 to 6182 | With all lines on: "Gross profit pool in the plan" $702M (D; "11 lines · 441 ZIPs"). "Tier A+ and A ZIPs" 66 (D; "51% of the gross profit pool in 15% of ZIPs"). "Whitespace ZIPs" 51 (C; "$126M gross profit pool with a thin field"). "Cost per sold job" $2,384 (D; "blended across the plan at state average click cost"). "Return on paid" 3.5× (D; "gross profit per job ÷ cost per sold job"). "Click cost spread" 2.4× (D; "most to least expensive ZIP, modeled"). |
| 4 | Controls | 6118 to 6123 | "Service lines in the plan": one chip per line (short names) plus "All", "Storm lines only" (sets `storm`, `hail`, `repair`), "Residential only" (`RES_LINES`), "Commercial only" (`COM_LINES`); at least one line stays on. "Map layer": "Paid tier and bid modifier", "Quadrant", "Efficiency percentile", "Gross profit pool a year", "Relative cost per click", "Competitive pressure". "Region" ("All nine regions"). "Parish" ("All 64 parishes"). |
| 5 | Map and legend | 6125, 6157 to 6167 | Scored ZIPs coloured by tier (six steps of one ramp, E to A+), by quadrant (four colours), or in eight quantile classes for the other four layers; unscored ZIPs grey; ZIPs out of scope dimmed. Competitor pins only on the "Competitive pressure" layer. Hover: ZIP, city, parish, quadrant, "Gross profit pool a year", "Relative cost per click", "Efficiency percentile", "Tier · bid modifier". Click: select the ZIP. Click a pin: module 07. |
| 6 | Detail card | 6127, 6187 to 6208 | No ZIP: gross profit pool in view, ZIP count, mean relative click cost, a row per quadrant (ZIPs and pool), a row per tier (ZIPs, bid, pool). ZIP selected: tier and bid, the three percentiles, "Gross profit pool a year (plan lines)", "Jobs open to marketing a year", "Relative click cost x = region × competition", "Mapped roofers within 25 km · roofing contractors in the ZIP", the pool by line, the quadrant play text, buttons "Service Lines ↗" and "This ZIP to the Desk ↗". |
| 7 | Table "Ranking by efficiency" | 6128, 6183 to 6186 | ZIP, City, Profit pool, Cost, Pct, Tier, Bid for the ZIPs in view. |
| 8 | Card "The four quadrants" | 6132, 6209 to 6211 | Table Quadrant, ZIPs, Residents (share), Profit pool (share), Cost (median relative cost), then the four plays. |
| 9 | Card "Demand against competition" | 6133, 6212 to 6214 | Scatter of every scored ZIP: x competitive pressure percentile, y gross profit pool percentile, guide lines at 60, dot size by pool, colour by quadrant; click a dot to select the ZIP. |
| 10 | Card "What a ZIP set costs to own" | 6135, 6216 to 6236 | Inputs: "Monthly budget ($)", "Target set" ("Tiers A+ and A in view", "Whitespace plus A+ in view", "Top ZIPs by efficiency in view"), "How many (top set)" (5 to 400), "Concentration (alpha)" (0 to 3). Output sentence and a table ZIP, City, Budget, Clicks, Leads, Jobs (▲ when capped), Profit, Bid. |
| 11 | Card "Coherence check: this map disagrees with module 01, on purpose" | 6137, 6243 to 6252 | Pearson and Spearman correlation of the index with the efficiency percentile, the five ZIPs that rise most and fall most, and a judgment callout. |
| 12 | Card "Region cost factors" | 6138, 6253 | Table Region, "Main media market", Factor, "Mean cost in region", Profit pool; a note. |
| 13 | Card "Parish rollup: where the money sits" | 6140, 6237 to 6239 | Parish, Region, ZIPs, Residents, Profit pool, Cost, "Profit per cost unit", "A+ and A ZIPs", "Whitespace ZIPs". Click a row to focus the parish. |
| 14 | Card "City rollup" | 6141, 6240 to 6241 | "The same by city (USPS city name, 1,500 residents or more)": City, Parish, Residents, ZIPs, Profit pool, Cost, "Mapped roofers", "A+ and A ZIPs". |
| 15 | Cards "How the model is built" and "Judgment calls, exclusions and caveats" | 6143 to 6144, 6255 to 6270 | Six steps; six rows. |
| 16 | Footer | 6271 | "Uplift Louisiana Roofing Atlas, module 05. Costs are modeled (grade D) until account actuals replace them in module 15. Compiled October 6, 2026." (date typed in). |
| 17 | Exports | 6282, 6283 | `louisiana-zip-bid-modifiers.csv`: `zip, city, parish, region, gross_profit_pool, relative_cpc, efficiency_pct, tier, bid_modifier_pct, quadrant`, sorted by efficiency; note "Uplift Louisiana Roofing Atlas, module 05. Lines: <keys>. Bid modifiers are location adjustments; costs modeled (grade D)." `louisiana-parish-paid-rollup.csv`: `parish, region, zips, gross_profit_pool, profit_weighted_relative_cpc, a_plus_and_a_zips, whitespace_zips`. |

## 05.2 Data contract

### Formulas (6149 to 6156 unless noted)

For each scored ZIP and the chosen line keys:

- `fees` = sum over lines of `p_<line> x rep x val x fee`; `cases` = sum of `p_<line> x rep` (through `SLM.zipAll`; `rep`, `val`, `fee` are the user's current assumptions, defaults from `META.model`).
- `cpc` = `cpc_rel` (1 when missing); `comp` = `comp_pct`; `eff` = `fees / max(0.3, cpc)`.
- `pct` = share of scored ZIPs with a strictly smaller `eff`, x 100; `opp` = the same for `fees`.
- `tier` = `LINE_TIER(pct)` (8242): 95 and up A+, 85 A, 65 B, 40 C, 15 D, below E. `bid` = `TIER_BID[tier]` (8243): +30, +20, +10, 0, −20, −50.
- `quad`: with `hd = opp >= 60` and `hc = comp >= 60`: 0 Anchor (both), 1 Whitespace (`hd` only), 2 Niche (neither), 3 Avoid (`hc` only).
- Tiles (6171 to 6180): unit economics per line from `SLM.blended(line, null)`: `cpc = A.cpc x cpcMul` (38 x multiplier), `cpl = cpc / cvr`, `cps = cpl / close`, `feeCase = val x fee`, `roi = feeCase / cps`; the blended cost per sold job and return are averages weighted by each line's statewide gross profit pool. Click cost spread = max `cpc` / min `cpc`.
- ZIP ledger (6197): `dma = META.model.DMA[region of the ZIP]`; competition term = `cpc / dma`.
- Budget plan (6216 to 6229): weight = `(max(0, fees) / max(0.3, cpc)) ^ alpha`; ZIP budget = monthly budget x weight / sum of weights. Inside a ZIP the budget is split over lines by each line's share of the ZIP's pool; per line `clicks = budget / (A.cpc x cpcMul x cpc_rel)`, `leads = clicks x cvr`, `jobs = leads x close`, `profit = jobs x val x fee`. Cap: a ZIP cannot yield more than `cases / 12` jobs a month ("a twelfth of the year's jobs open to marketing"); when capped, jobs and profit are scaled down and the row is marked.
- Parish rollup (6238): `fees` = sum; `cpc` = pool weighted mean of ZIP `cpc`; "Profit per cost unit" = `fees / max(0.3, cpc)`; counts of A+ and A ZIPs and of Whitespace ZIPs. City rollup (6240): the same over `cities[].zips`, plus `cities[].comp`.
- Coherence (6244 to 6248): Pearson of `idx` with `pct` (0.40 today), Spearman from ranks; the lists are the ZIPs with the largest rank gain and loss.
- Hand off to the Desk (6284): the planned set, top 60 by efficiency, with the chosen lines.

### What is read

| read | lines | use |
|---|---|---|
| ZIP columns | Part A | `p_<line>` (through `SLM.zipLine`), `cpc_rel`, `comp_pct`, `zip`, `city`, `pi`, `pop`, `idx`, `comp_n25`, `roofers`, `res_ok`, `lat`, `lon`. The stored `fees`, `cases`, `eff`, `effb`, `oppb`, `quad`, `tier`, `bid` are not read; everything is recomputed. |
| `SLM.A` | 6172, 6223, 6226, 6234 | `budget` (15,000), `alpha` (1.2), `cpc` (38), and per line `rep`, `val`, `cpcMul`, `cvr`, `close`; the two inputs write back with `SLM.set`. Default per line values (2150 to 2160): `cpcMul` replace 1.0, repair 0.65, storm 1.25, hail 1.2, fortified 0.55, metal 0.75, mh 0.45, mf 0.8, comm 1.1, coat 0.7, newc 0.5; `cvr` (lead conversion, %) 9, 12, 12, 10, 8, 7, 11, 5, 5, 6, 4; `close` (%) 25, 55, 30, 28, 35, 20, 35, 15, 12, 18, 10. |
| `META.model.DMA` | 6197, 6253 | region factor: 1 Greater New Orleans 1.00, 9 Northshore and Florida Parishes 0.95, 2 Capital Region 0.90, 3 Bayou and River Parishes 0.85, 4 Acadiana 0.80, 5 Southwest 0.80, 7 Northwest 0.70, 6 Central 0.65, 8 Northeast 0.62. |
| `REG_MKT` | 6253 | media market name per region (below). |
| `parishes` | 6122, 6148, 6190, 6197, 6238 to 6240, 6253, 6280 to 6283 | `fips`, `name`, `reg`, `i`. |
| `cities` | 6240 to 6241 | `zips`, `name`, `pi`, `pop`, `comp`. |
| `COMP` | 6167, 6266 | pins (`offices`, `tier`), count. |
| `META.ncomp_ver` | 6266 | text. |
| `PL`, `PLI`, `LINE_KEYS`, `RES_LINES`, `COM_LINES`, `QN` | 6119, 6204, 6275 to 6278 | chips and labels. |

### Method texts (verbatim)

Callout, 6116: "Efficiency here is gross profit pool a year ÷ relative cost per click, ranked across the scored ZIPs. The gross profit pool comes from the service line model at your assumptions (module 12). The relative cost is a stated model, not a keyword pull: a regional factor for each media market (New Orleans 1.00 down to Northeast 0.62) times a competition term from the mapped roofing companies and the roofing contractors nearby (0.8 to 1.2). No keyword planner, auction or Ahrefs data was used. When your accounts are connected (module 15), actual cost per click and cost per sold job replace the model ZIP by ZIP."

Tier legend, 6162: "Darker ZIPs return more gross profit per click dollar for the lines in the plan. A+ top 5% (+30%), A next 10% (+20%), B next 20% (+10%), C 25% (0), D 25% (−20%), E bottom 15% (−50%)." Grade D. Quadrant legend, 6163: "Demand against competition, each split at the 60th percentile. Whitespace is high job flow with a thin field: the first money of any budget." Grade C.

"How the model is built", 6256 to 6261:

1. "Gross profit pool": "For each ZIP and each line in the plan: jobs a year × share open to marketing × default job value × gross margin (module 12 assumptions), summed over the lines chosen."
2. "Relative cost": "Region factor (New Orleans 1.00 to Northeast 0.62) × (0.8 + 0.4 × competitive pressure percentile). Pressure is 60% the distance weighted presence of the mapped roofing companies (statewide companies weigh 3, national 2.5, regional 1.5, local 1; exp(minus km over 20), plus about a third of that weight for each city a company says it serves) and 40% the roofing contractors nearby (Business Patterns establishments and LSLBC license records within 30 km; exp(minus km over 10))." This sentence is the only record of how `comp_mass`, `roof_mass`, `comp_pct` and `cpc_rel` were built.
3. "Efficiency": "Gross profit pool ÷ relative cost, ranked as a percentile across the scored ZIPs."
4. "Tiers and bids": "A+ at the 95th percentile and up (+30%), A 85th (+20%), B 65th (+10%), C 40th (0), D 15th (−20%), E below (−50%). Upload as location bid adjustments; never above +30% until account data confirms the ZIP."
5. "Quadrants": "Gross profit pool percentile and competitive pressure percentile, each split at 60."
6. "Budget": "Share of budget ∝ (gross profit pool ÷ cost)^alpha within the target set; clicks, leads and jobs from each line's click cost, conversion and close rates; capped at a twelfth of the ZIP's jobs open to marketing a year."

Judgment rows, 6264 to 6269: "No keyword data": "No search volume, auction or Ahrefs data was pulled for this build. Search volume by ZIP does not exist publicly; Google reports it by metro and state." "Long run, not this week": "ZIPs are ranked by their roofs and their storms over the long run. After a specific storm, the footprint in module 02 and the Storm Desk (module 14) override this ranking for weeks." "Competitor list is partial": "29 roofing companies are mapped, 27 of them verified on their own sites. Small local roofers are present only through Business Patterns and license counts." "Not used: demographics as targeting": "Race, ethnicity, religion and similar attributes are not inputs, and the Desk never targets by them. Language spoken at home is used only to decide where to add Spanish or Vietnamese ads and pages." "Not used: single homes as targets": "Lists of specific damaged homes, owners named in claim or FEMA records, and geofences drawn around one property are excluded. Target ZIPs and storm footprints, and confirm damage roof by roof with the owner's permission." "Caveat: job values": "Default job values are placeholders. A company that does not sell commercial or metal work should switch those lines off, and one with a higher ticket should raise the replacement value, before trusting the ranking."

Coherence texts, 6249 to 6252: "Across 441 ZIPs the index and the efficiency percentile correlate r = 0.40 (Spearman x). They agree on the broad picture and part ways on two kinds of ZIP." "Rises here: big suburban ZIPs where the roof count is large and clicks are cheaper than the metro core: ..." "Falls here: ZIPs with high job flow per resident but small populations or a crowded field: ..." Judgment call "buy volume per dollar, write pages for rates": "Paid media pays for clicks, so it should follow gross profit per click (this module). Organic pages earn rank by relevance, so a small town with old roofs, frequent storms and no competitor page is often the better SEO target (module 01 and the city table in module 12)."

## 05.3 Louisiana specific content in module 05

| line | what | text or rule to find |
|---|---|---|
| 6096 to 6097 | `REG_MKT`, media market per region | comment "region cost factors (assumption, grade D) with the main media market each region buys through"; 1 "New Orleans", 2 "Baton Rouge", 3 "New Orleans and Baton Rouge", 4 "Lafayette", 5 "Lake Charles", 6 "Alexandria", 7 "Shreveport", 8 "Monroe and El Dorado", 9 "New Orleans and Baton Rouge". Also used by module 11. |
| 6099 to 6102 | `QUAD_PLAY`, the four plays (verbatim) | Anchor, "High job flow, crowded field": "Defend: exact and phrase match on the line terms, brand plus city ad groups, highest bids only where the tier is A or better. Organic: city pages with local storm and roof age facts, reviews, photos of local jobs and Spanish pages; these markets are won on trust and coverage, not on bids." Whitespace, "High job flow, thin field": "Expand first: the cheapest sold jobs in the state sit here. Broader match, radius around the ZIP cluster, Local Services Ads where available, and a city page for every town in the cluster. This is the first money of any new budget." Niche, "Low job flow, thin field": "Maintain: low bids and parish level pages; let organic, maps and referrals carry the volume. Raise the line that is unusually strong in the ZIP (module 12), not the whole account." Avoid, "Low job flow, crowded field": "Exclude or bid down 50%: clicks priced by roofers chasing the neighboring metro. Keep the brand terms on." Louisiana wording: "local storm and roof age facts", "parish level pages". |
| 6111 | dek | "New Orleans, Baton Rouge and the Northshore carry the most roofs and the most expensive clicks, because every statewide roofer and every storm crew buys them." |
| 6114 | button | "↓ Parish rollup CSV". |
| 6116 | callout | "(New Orleans 1.00 down to Northeast 0.62)". |
| 6119 | chip | "Storm lines only", wired at 6276 to the keys `storm`, `hail`, `repair`. |
| 6121, 6122 | menus | "All nine regions"; "Parish"; "All 64 parishes". |
| 6140, 6141 | card titles | "Parish rollup: where the money sits"; "by parish"; "(USPS city name, 1,500 residents or more)". |
| 6158, 6190, 6191, 6198 | labels | "<name> Parish"; "Louisiana" as the name of the unfiltered view; pill "Parish". |
| 6239, 6241 | table headers | "Parish". |
| 6253 | region note (verbatim) | "Region factors are assumptions (grade D): New Orleans is the most contested roofing market in the state, then the Northshore and Baton Rouge, the Bayou parishes, Acadiana and the Southwest, the Northwest, Central and the Northeast. The competition term adds up to 20% where many roofers sit nearby and subtracts up to 20% where few do. After a hurricane, clicks in the footprint can cost several times these levels for weeks while storm crews bid in." |
| 6257 | method step 2 | "Region factor (New Orleans 1.00 to Northeast 0.62)"; "LSLBC license records within 30 km". |
| 6265 | judgment | "by their roofs and their storms"; "After a specific storm, the footprint in module 02 and the Storm Desk (module 14) override this ranking for weeks." |
| 6267 | judgment | "Spanish or Vietnamese ads and pages". |
| 6268 | judgment | "owners named in claim or FEMA records"; "storm footprints". |
| 6271 | footer | "Uplift Louisiana Roofing Atlas"; "Compiled October 6, 2026". |
| 6282, 6283 | exports | file names `louisiana-zip-bid-modifiers.csv`, `louisiana-parish-paid-rollup.csv`; column names `parish`. |
| data | region names and factors | `META.model.REG` (nine names) and `META.model.DMA` (nine factors) appear in the menus and the region table. |

## 05.4 What a California edition of module 05 needs

The arithmetic is state neutral. Three inputs carry the state:

| Louisiana input | California equivalent |
|---|---|
| `p_<line>` with `REP`, `VAL`, `FEE` | The same columns and tables for the California line set. Job values in California run higher than the Louisiana defaults ($15,500 replacement and so on); they are placeholders in both states but should be re based. |
| `cpc_rel` = region factor x (0.8 + 0.4 x competitive pressure) | Same formula. It needs a California `META.model.DMA` table (one factor per region) and a `REG_MKT` table naming the media market of each region. California has about a dozen television markets (Los Angeles, San Francisco Bay Area, Sacramento and Stockton, San Diego, Fresno, Bakersfield, Santa Barbara and San Luis Obispo, Monterey and Salinas, Palm Springs, Chico and Redding, Eureka, plus border counties served from Yuma, Reno and Medford). The factors are assumptions (grade D) in Louisiana and would be in California; the spread between the Los Angeles or Bay Area core and the far north is probably wider than Louisiana's 1.00 to 0.62, so the 0.3 floor in `max(0.3, cpc)` and the 0.8 to 1.2 competition band deserve a second look. |
| `comp_pct`, `comp_n25`, `roofers`, competitor pins | Rebuilt from a California competitor list, ZIP Business Patterns and CSLB C-39 licences by ZIP (the Louisiana licence count is by mailing city within 30 km; California can use the licence address directly). |
| base cost per click `SLM.A.cpc = 38` | An assumption for "roofing terms in Louisiana metros" (module 08, line 6615). California roofing clicks may well cost more; re base it from account data or a keyword tool, and expect the tile "Cost per sold job" to move with it. |
| `idx` (coherence check) | Same. |

Text and presets to rewrite: the dek (6111), the region note (6253), `REG_MKT`, the "Storm lines only" chip and its three keys (6276), the judgment rows that speak of storms and FEMA (6265, 6268), "parish" in the plays, titles, headers, file names and CSV columns. The plan's ZIP count input stops at 400 (6230), which is fine for 1,760 ZIPs but worth knowing; the Desk hand off sends at most 60 ZIPs (6284).

Nothing in this module has no California equivalent. Its weakest input in both states is the cost model, and the callout already says so.

---

# Module 06. Ground Truth (`18_m06_ground.js`, lines 6293 to 6460, key `ground`)

## 06.1 What it is for and what it shows

Purpose (6320): "The 64 parishes as observed: FEMA roof registrations, hail, wind and tornado reports, hurricane records, permits, housing and roofers". It lays the observed public records side by side at parish level so the modeled ZIP numbers elsewhere can be checked. It reads no ZIP column: everything comes from `parishes`, `cities`, `pts`, `ts` and `meta`.

Defined before the module (6296 to 6317): comment "parish measures as observed by public agencies; rates use ACS 2020 to 2024 homes and residents and Census land area"; `sqmiP(p) = max(1, p.aland / 2.58999e6)`; `FEMA_YR` (disaster number to year, from `ts.fema_year`); `femaSince(p, year)` = sum of `p.fema[disaster]` over disasters of that year or later; and the measure table `PMET`.

Visible structure, top to bottom:

| # | element | lines | content |
|---|---|---|---|
| 1 | Masthead | 6328 to 6332 | Eyebrow "Module 06 · Ground Truth · 64 parishes as observed". Dek (verbatim): "Before any model, the record. FEMA counted every owner who registered roof or wind damage after a declared disaster; NOAA logged every hail stone, damaging gust, tornado, hurricane and surge its observers reported; the Census Bureau counted every home, its age and type, every building permit and every roofing contractor. This module lays those records side by side for the 64 parishes, so every modeled number elsewhere in the atlas can be checked against what was actually counted." Meta strip: "FEMA 497,296 roof and wind registrations, 18 disasters" (18 typed in); "NOAA 5,115 located storm reports and zone records since 2000"; "Census ACS 2020 to 2024, permits 2005 to 2026, Business Patterns 2023"; "Grade A for counts, B where noted". Buttons "↓ Parishes CSV", "↓ Cities CSV", "Paid ↗", "Storm Ledger ↗", "◐ Theme". |
| 2 | Callout "Read this first: observed layers first, modeled layers second" | 6334 | Copied in 06.2. |
| 3 | Six headline tiles | 6354 to 6361 | "FEMA roof and wind registrations" 497k (A; "2004 to 2026; 126k since 2020 · 23.6 per 100 homes"). "Storm report damage, 2016 to 2026" $710M (B; "NOAA estimates for located hail, wind and tornado reports"). "Hurricane zone records since 2000" 295 (A; "460 tropical storm and 256 surge records (NOAA)"). "Homes permitted, 2025" 14,203 (A; "9,022 January to August 2026, −12% on 2025"). "Roofing contractors" 267 (A; "1,724 employees (CBP 2023); 4,899 nonemployer exterior trades firms"). "Roofing license records" 950 (B; "824 firms; 32% held out of state"). Note: this tile's "126k since 2020" is the sum of the parish records; module 01's tile says "124k since 2020" from the ZIP column `fema_20`. |
| 4 | Control | 6336 | "Parish measure" menu with the 16 `PMET` measures. |
| 5 | Map and legend | 6338, 6362 to 6368 | Parish choropleth with parish name labels, eight quantile classes over the 64 parishes (a diverging scale centred on zero for the one measure flagged `div`). Hover: parish tooltip with the measure, "FEMA registrations since 2004", "Hail 1 inch · wind 58 mph · tornadoes, 2016 to 2026", "Homes built before 1980". Click: select the parish. Legend note "Darker parishes rank higher. Eight quantile classes across the 64 parishes." or "Copper rose, blue fell. Diverging scale centered on zero.", then the grade and the measure's note. |
| 6 | Detail card | 6340, 6378 to 6413 | No parish: "Louisiana", a year table 2016 to 2026 (columns "Hail 1 in", "Wind 58", "Tornado", "FEMA", "Permits") and a paragraph. Parish selected: "<name> Parish", "<region> · homes · residents · ZIPs"; the year table for the parish; "FEMA registrations by disaster" (one row per disaster with a count: "<event> (<year>, DR <number>)", count and per 100 homes); "NOAA records" (zone records since 2000: hurricane, tropical storm, surge, high wind; located reports 2016 to 2026: hail 1.75 inch, wind 75 mph, EF1 or stronger; property damage); "Against the state" (five measures with their ratio to the state rate); "Model, all eleven lines (default assumptions)" (one unit roofs, 20 years or older, aged 15 to 19; gross profit pool; jobs a year per line); "Places and trades" (six largest cities; "Roofing contractors: county file · ZIP file · license records"; "Roofing supply wholesalers · insurance agencies · mapped competitor offices"); buttons "Roof Demand Index ↗", "Storm Ledger ↗" (both set the parish menu of the target module), "Clear". |
| 7 | Card "Parishes" | 6343, 6371 to 6375 | Sortable table: Parish, Region, Homes and eleven measures (`fema`, `fema20`, `h1`, `w58`, `torn`, `trop`, `permits`, `old`, `mh`, `roofers`, `lic`) under their short labels. |
| 8 | Card "Hazard against the record" | 6345, 6415 to 6423 | Two parish scatters with fitted lines and computed notes: chance of hurricane force winds against FEMA registrations per 100 homes (r = 0.72 today), and the 30 year hail day rate against hail reports per 100 square miles (r = 0.71 today). |
| 9 | Card "Where storm damage concentrates" | 6346, 6426 to 6427 | Table Parish, "Per 100 homes", "× state", Registrations, "Since 2020": the twelve highest parishes and the six lowest; a note. |
| 10 | Card "Cities" | 6348, 6428 | Sortable table over the 265 cities: City, Parish, Residents, Roofs, "20 yrs+", Replace, Storm, Hail, Repair, "Profit pool", "Mapped roofers", Licenses, "Spanish %", "Vietnamese %". |
| 11 | Cards "How to read this module" and "Caveats and sources" | 6350 to 6351, 6429 to 6448 | Six rows; three caveat rows and six source rows. |
| 12 | Footer | 6449 | "Uplift Louisiana Roofing Atlas, module 06. Records as published by FEMA, NOAA, the Census Bureau and the LSLBC. Compiled October 6, 2026." |
| 13 | Exports | 6451, 6452 | `louisiana-parish-records.csv`: `parish, fips, region, homes, residents`, the 16 measure keys, then `fema_registrations, hail_1in_reports, wind_58mph_reports, tornadoes, cbp_roofing_establishments, license_records`; note "Uplift Louisiana Roofing Atlas, module 06. FEMA, NOAA, Census and LSLBC records by parish." `louisiana-cities.csv`: `city, parish, residents, zips, one_unit_roofs, roofs_20_plus, gross_profit_pool`, eleven `jobs_<line>` columns, `mapped_roofers_within_8km, license_records, spanish_speakers, vietnamese_speakers`. |

## 06.2 Data contract

### The sixteen parish measures (`PMET`, lines 6301 to 6316)

`p` is a parish record. Each measure has a long label (menu and legend), a short label (table header), a formula, a grade and a note printed under the legend.

| line | key | label | formula | grade | note (verbatim) |
|---|---|---|---|---|---|
| 6301 | `fema` | FEMA roof and wind registrations per 100 homes, 2004 to 2026 (short: "FEMA per 100 homes") | `p.fema_k / max(1, p.hu) x 100` | A | "OpenFEMA Individuals and Households Program: registrations with roof damage (2004 to 2017 disasters) or verified wind loss (2020 on). Counts only people who applied for federal help; about four in ten reported homeowners insurance, and most insured roof claims never reach FEMA." |
| 6302 | `fema20` | FEMA wind loss registrations per 100 homes since 2020 ("FEMA since 2020 per 100") | `femaSince(p, 2020) / max(1, p.hu) x 100` | A | "Laura, Delta, Zeta, the 2021 winter and May storms, Ida, Francine and Arthur." |
| 6303 | `h1` | Hail reports of 1 inch or larger per 100 square miles, 2016 to 2026 ("Hail 1 in per 100 sq mi") | `p.ev.h1 / sqmiP(p) x 100` | A | "NOAA Storm Events reports placed by coordinates. Reports follow people as well as hail." |
| 6304 | `h175` | Hail reports of 1.75 inch or larger per 100 square miles, 2016 to 2026 ("Hail 1.75 in per 100 sq mi") | `p.ev.h175 / sqmiP(p) x 100` | A | "Golf ball hail, the size that damages most asphalt shingles." |
| 6305 | `w58` | Damaging wind reports per 100 square miles, 2016 to 2026 ("Wind 58 mph per 100 sq mi") | `p.ev.w58 / sqmiP(p) x 100` | A | "Thunderstorm wind reports of 58 mph or more." |
| 6306 | `torn` | Tornadoes per 1,000 square miles, 2016 to 2026 ("Tornadoes per 1,000 sq mi") | `p.ev.t / sqmiP(p) x 1000` | A | "Tornado touchdown points." |
| 6307 | `dmg` | Storm damage NOAA estimated per home, 2016 to 2026 ($) ("NOAA damage per home") | `p.ev.dmg x 1000 / max(1, p.hu)` | B | "Property damage estimates attached to located hail, wind and tornado reports; rough, and missing for many reports." |
| 6308 | `trop` | Hurricane and tropical storm zone records since 2000 ("Tropical zone records") | `p.trop.hurr + p.trop.ts` | A | "NOAA Storm Events records of hurricane or tropical storm conditions by forecast zone, matched to parishes. A parish split into several zones can count one storm more than once." |
| 6309 | `surge` | Storm surge records since 2000 ("Surge records") | `p.trop.surge` | A | "NOAA Storm Events storm surge and tide records by forecast zone." |
| 6310 | `permits` | New homes permitted per 1,000 homes a year, 2021 to 2025 ("Permits per 1,000 homes") | mean over 2021 to 2025 of `p.bps[year][1]`, `/ max(1, p.hu) x 1000` | A | "Census Building Permits Survey, housing units authorized, all building sizes." |
| 6311 | `ytd` | Change in homes permitted, January to August 2026 against 2025 (%) ("Permits 2026 vs 2025"); diverging scale | `(p.ytd26 / p.ytd25 - 1) x 100`, null when `ytd25` is 0 | A | "Census Building Permits Survey year to date files. Small parishes swing widely." |
| 6312 | `old` | Homes built before 1980 (%) ("Built before 1980") | `sum(p.yb.slice(5)) / max(1, sum(p.yb)) x 100` | A | "ACS 2020 to 2024, year structure built." |
| 6313 | `mh` | Mobile homes (% of homes) ("Mobile homes %") | `p.mh / max(1, p.hu) x 100` | A | "ACS 2020 to 2024, units in structure." |
| 6314 | `roofers` | Roofing contractors per 10,000 residents (ZIP Business Patterns 2023) ("Roofers per 10k") | `p.roofers / p.pop x 10,000` | B | "ZIP level counts summed to the parish. They run below the county file (152 against 267 statewide) because many ZIP records lack a detailed industry code." |
| 6315 | `lic` | Roofing license records per 10,000 residents (LSLBC) ("Licenses per 10k") | `p.lic / p.pop x 10,000` | B | "LSLBC roofing license records by the license holder's city, from a public mirror of the board's records." |
| 6316 | `fees` | Gross profit pool per home, all eleven lines ($ a year) ("Profit pool per home") | `p.fees / max(1, p.hu)` | D | "Service line model at default assumptions (module 12)." |

### Other formulas

- Statewide totals (6323 to 6325): `femaAll` = sum of `p.fema_k` (497,296); `fema20` = sum of `femaSince(p, 2020)` (126,112); `huAll` = sum of `p.hu`; `dmgAll` = sum of `pts[].dmg` x 1000 ($710 million).
- Year table (6376 to 6382): for each year 2016 to 2026: reports with flag `h1`, with flag `w58`, tornadoes (`k = 2`), restricted to the parish index when a parish is chosen; FEMA registrations by year of the disaster (`ts.fema_year` row counts statewide, `p.fema[disaster]` for a parish); permits = `ts.permits[year][1]` or `p.bps[year][1]`, and for 2026 `ts.ytd26` or `p.ytd26`. Footnote: "FEMA counts sit in the year of the disaster. *2026 reports run through the latest month NOAA has posted; permits run through August."
- State paragraph (6386): "Storm reports run through June 2026. FEMA counts belong to the year of the disaster: 35,372 in 2020 (Laura, Delta, Zeta) and 80,401 in 2021 (Ida and the winter storms). Permits fell from 19,147 homes in 2021 to 14,203 in 2025, and January to August 2026 ran 12% below the same months of 2025." The storm names in brackets are typed in.
- "Against the state" (6392, 6400): state rates `femaAll / huAll x 100` (23.6); hail `sum(ev.h1) / sum(sqmiP) x 100` (2.44); wind (7.30); tornadoes per 1,000 square miles (17.2); permits = mean of `ts.permits[2021..2025][1] / huAll x 1000` (7.35). Each row prints the parish value and `value / state value`.
- Scatter 1 (6415 to 6419): x `p.hur64`, y the `fema` measure, dot radius `3 + sqrt(hu / 10,000)`, labels on parishes above 25 per 100 homes or with more than 150,000 homes. The note names the six parishes furthest above an ordinary least squares line and the four furthest below (today above: St. James, St. John the Baptist, Assumption, St. Helena, Washington, Beauregard; below: St. Martin, Iberia, Vermilion, Lafayette).
- Scatter 2 (6420 to 6423): x `p.hd1`, y the `h1` measure, radius `3 + sqrt(pop / 20,000)`, labels above 4 reports per 100 square miles; the note names the five parishes furthest above the line (today Caddo, Ouachita, East Baton Rouge, St. Charles, Lafayette).
- Concentration table (6426 to 6427): parishes sorted by `fema` measure / state rate.
- Cities table (6428): "20 yrs+" = `ra20 / max(1, roofs) x 100`; "Spanish %" = `span / max(1, pop) x 100`; "Vietnamese %" = `viet / max(1, pop) x 100`; the four job columns are `p_replace`, `p_storm`, `p_hail`, `p_repair` by key.

### What is read

| read | lines | fields |
|---|---|---|
| `parishes` | throughout | `fips`, `name`, `reg`, `i`, `aland`, `pop`, `hu`, `mh`, `yb`, `roofs`, `ra20`, `wave`, `hd1`, `hur64`, `ev` (`h1`, `h175`, `w58`, `w75`, `t`, `ef1`, `dmg`), `trop` (`hurr`, `ts`, `surge`, `hw`), `fema`, `fema_k`, `bps`, `ytd26`, `ytd25`, `roofers`, `lic`, `ins_agents`, `nzip`, `fees`, `comp`, `cbp_roof`, `cbp_sup`, `p_<line>`. |
| `cities` | 6391, 6428, 6452 | `name`, `pi`, `pop`, `nzip`, `roofs`, `ra20`, `fees`, `comp`, `lic`, `span`, `viet`, `p_<line>`. |
| `pts`, `ptflags` | 6325, 6330, 6380 to 6381, 6386 | `dmg`, `pi`, `y`, `m`, `k`, flags `h1`, `w58`. |
| `ts.fema_year` | 6298, 6377, 6390 | disaster number, name, year, registrations. |
| `ts.permits`, `ts.ytd26`, `ts.ytd25` | 6326, 6358, 6380, 6386, 6392 | element 1 of each year; year to date totals. |
| `META.lic` (`n`, `firms`, `out`), `META.cbp` (`est`, `emp`), `META.nes.est2381`, `META.compiled` | 6327, 6359 to 6360, 6449 | tiles and footer. |
| `FEMA_INS.sh` | 6301, 6430 | "about four in ten". |
| `PL`, `LINE_KEYS`, `REGN` | 6404, 6452, 6372 | line names, CSV columns, region names. |

### Method texts (verbatim)

Callout, 6334: "Every measure on this tab except one was counted by a public agency: registrations by FEMA inspectors and caseworkers, storm reports by NOAA's observers and forecast offices, homes and permits by the Census Bureau, contractors by the Census Bureau and the LSLBC. Each has its own blind spot, listed below: FEMA sees only the damage people asked federal help for after declared disasters, storm reports follow people, and permits count new homes, not reroofs. The one modeled measure, the gross profit pool, is labeled grade D. Use these records to check every ZIP number in modules 01, 05 and 12."

Scatter notes, 6419 and 6423: "FEMA registrations rise with hurricane exposure (r = 0.72): the parishes that see hurricane force winds every few decades carry most of the record. Parishes furthest above the line (...) took the brunt of a recent storm, Ida along the river and Laura in the southwest; parishes furthest below it (...) carry similar long run exposure but registered far less, because recent storms passed them by or more of their owners were insured." "Recent hail reports follow the 30 year rate (r = 0.71), so the hail layer is a fair guide to the next decade. Much of the scatter around the line is reporting: the parishes furthest above it (...) are mostly urban, where more people see and report the same storms."

Concentration note, 6427: "The state rate is 23.6 FEMA roof and wind registrations per 100 homes over 2004 to 2026. The top of the list is the hurricane coast; the bottom is the north and northwest, where hail and tornado damage is real but rarely federally declared, so it reaches insurers and roofers without ever reaching FEMA. That is why this record understates the north and why module 02 adds the storm reports."

"How to read this module", 6430 to 6435: "FEMA registrations": "Owners and renters who applied for federal individual assistance after a declared disaster and showed roof damage (through 2017) or verified wind loss (2020 on). About four in ten registrants reported homeowners insurance; owners whose policy paid for the roof had little reason to apply, so the count leans to the uninsured and underinsured share of the damage." "Storm reports": "Hail, damaging wind and tornado reports placed by coordinates. They locate storms; their density also tracks population and roads." "Zone records": "Hurricane, tropical storm, surge and high wind records filed by NOAA forecast zone, matched to parishes. They show which parishes were under those conditions, not how bad it was." "Permits": "New housing units authorized by local permit offices, as reported to the Census Bureau. Reroofs are not in this survey; since August 2025 they need local permits, which parish offices hold." "Contractors": "County Business Patterns counts establishments with employees (published for 18 parishes for roofing); ZIP counts are less complete; license records count licenses by the holder's city, wherever the work is done." "Gross profit pool": "The only modeled measure on this tab (grade D), included so the record and the model sit side by side."

Caveats, 6438 to 6440: "Declared disasters only": "Hail and most tornadoes never reach a federal declaration; FEMA undercounts the north." "Small numbers": "Tornadoes and large hail in a small parish swing year to year. Read ten year totals, not single years." "Damage estimates": "NOAA damage figures are estimates made at the time, often missing, and not insurance losses."

Sources, 6442 to 6447 (layer; dataset; grade; vintage; link): "FEMA registrations"; "OpenFEMA Individuals and Households Program valid registrations, 18 Louisiana disasters 2004 to 2026"; A; "v2"; https://www.fema.gov/openfema-data-page/individuals-and-households-program-valid-registrations-v2. "Storm reports and zone records"; "NOAA NCEI Storm Events Database, Louisiana, 2000 to 2026"; A; "2026"; https://www.ncdc.noaa.gov/stormevents/. "Homes"; "ACS 2020 to 2024 five year; Census 2024 Gazetteer for land area"; A; "2026"; https://www.census.gov/. "Permits"; "Census Building Permits Survey, county annual 2005 to 2025 and August 2026 year to date"; A; "2026"; https://www.census.gov/construction/bps/. "Contractors and suppliers"; "County and ZIP Business Patterns 2023 (NAICS 238160, 423330, 524210); Nonemployer Statistics 2024 (NAICS 2381)"; A; "2023 and 2024"; https://www.census.gov/programs-surveys/cbp.html. "License records"; "LSLBC roofing license records via a public mirror"; B; "October 2026"; https://lslbc.gov/.

## 06.3 Louisiana specific content in module 06

| line | what | text or rule to find |
|---|---|---|
| 6296 | comment | "parish measures". |
| 6301 to 6316 | measure labels and notes | every label and note in the table above. Storm and state content: "FEMA roof and wind registrations", "verified wind loss (2020 on)", "Laura, Delta, Zeta, the 2021 winter and May storms, Ida, Francine and Arthur" (6302, typed in), hail and tornado measures, "Hurricane and tropical storm zone records since 2000", "Storm surge records since 2000", "matched to parishes", "152 against 267 statewide" (typed in), "(LSLBC)", "public mirror of the board's records". |
| 6320 | module description | "The 64 parishes as observed: FEMA roof registrations, hail, wind and tornado reports, hurricane records, permits, housing and roofers". |
| 6328 to 6330 | eyebrow, dek, meta | "64 parishes as observed"; "hurricane and surge"; "for the 64 parishes"; "18 disasters". |
| 6332 | button | "↓ Parishes CSV". |
| 6334 | callout | "the Census Bureau and the LSLBC". |
| 6336, 6340, 6343 | labels | "Parish measure"; "Louisiana"; "Click a parish for its record"; card "Parishes", "Every parish with its observed rates". |
| 6345, 6346 | card subtitles | "hurricane exposure against FEMA registrations, and the 30 year hail rate against recent hail reports"; "Parishes ranked by FEMA roof and wind registrations per 100 homes". |
| 6348 | card subtitle | "USPS cities of 1,500 residents or more: roofs, the service line pools summed over their ZIPs, competition and language at home." |
| 6355 to 6360 | tiles | "FEMA roof and wind registrations"; "Hurricane zone records since 2000", "tropical storm and ... surge records (NOAA)"; "held out of state". |
| 6362 | map label and tooltip | "Map of Louisiana parishes"; "FEMA registrations since 2004"; "Hail 1 inch · wind 58 mph · tornadoes, 2016 to 2026". |
| 6368 | legend | "Darker parishes rank higher"; "across the 64 parishes". |
| 6372 | table header | "Parish". |
| 6376 | years | `RY` = 2016 to 2026, typed in. |
| 6381 to 6382 | year table | row names "Hail 1 inch or larger", "Wind 58 mph or more", "Tornadoes", "FEMA roof and wind registrations", "Homes permitted (2026 to August)"; headers "Hail 1 in", "Wind 58", "Tornado", "FEMA", "Permits". |
| 6384, 6386 | state view | "Louisiana"; "(Laura, Delta, Zeta)", "(Ida and the winter storms)". |
| 6389 to 6409 | parish view | "<name> Parish"; "FEMA registrations by disaster"; "No FEMA roof or wind registrations recorded for the parish."; "Zone records since 2000: hurricane · tropical storm · surge · high wind"; "Located reports 2016 to 2026: hail 1.75 inch · wind 75 mph · EF1 or stronger"; "Roofing contractors: county file · ZIP file · license records"; "not published". |
| 6415 to 6423 | scatters | axis labels "Chance of hurricane force winds in a year (%, model from best tracks)", "FEMA roof and wind registrations per 100 homes", "Hail days a year, 1 inch or larger within 25 miles (1996 to 2025)", "Hail reports per 100 square miles, 2016 to 2026"; the notes with "Ida along the river and Laura in the southwest". |
| 6427 | table and note | "The top of the list is the hurricane coast; the bottom is the north and northwest". |
| 6428 | cities table | headers "Parish", "Storm", "Hail", "Spanish %", "Vietnamese %"; job columns keyed `p_replace`, `p_storm`, `p_hail`, `p_repair`. |
| 6430 to 6440 | reading notes and caveats | all quoted in 06.2: "since August 2025 they need local permits, which parish offices hold"; "published for 18 parishes for roofing" (typed in); "FEMA undercounts the north". |
| 6442 to 6447 | sources | "18 Louisiana disasters 2004 to 2026"; "NOAA NCEI Storm Events Database, Louisiana, 2000 to 2026"; LSLBC. |
| 6449 | footer | "Uplift Louisiana Roofing Atlas"; "the LSLBC". |
| 6451, 6452 | exports | `louisiana-parish-records.csv`, `louisiana-cities.csv`; column names `parish`, `spanish_speakers`, `vietnamese_speakers`. |
| 6410, 6411 | coupling | the buttons write the parish FIPS into `#i1Par` and `#s2Par` (the parish menus of modules 01 and 02). |
| 993 (helper) | parish tooltip | "<name> Parish"; "Click for the parish ledger". |

## 06.4 What a California edition of module 06 needs

The module is a county table with a map and it carries over more easily than any other: 58 counties instead of 64 parishes, the same code. What changes is which records exist.

| Louisiana measure | California equivalent | note |
|---|---|---|
| `old`, `mh`, `permits`, `ytd`, `roofers`, `fees` | identical sources (ACS, Building Permits Survey, ZIP and County Business Patterns, the model) | County Business Patterns publishes roofing for more California counties than the 18 Louisiana parishes; the "not published" fallback still matters for small counties. |
| `lic` | CSLB C-39 licences by county | direct equivalent. |
| `h1`, `h175`, `w58`, `torn`, `dmg` (located NOAA reports) | same file | Kept for completeness; they will be near zero in most counties and should not lead the menu. |
| `fema`, `fema20` | OpenFEMA registrations for California disasters | Exists, but concentrated in a handful of fire and flood counties and in different damage types. The default measure of the module (`st.m = 'fema'`, 6322) and the card "Where storm damage concentrates" need a better lead measure. |
| `trop`, `surge` (hurricane, tropical storm and surge zone records) | none | Replace with zone records that occur in California: high wind, heavy rain and flood, winter storm and heavy snow, wildfire, excessive heat. The matching of forecast zones to counties is harder (zones follow elevation). |
| none in Louisiana | records California has and Louisiana lacks | Wildfire: acres burned and structures destroyed and damaged by county and year (CAL FIRE); homes in fire hazard severity zones. Insurance: FAIR Plan policies and insurer nonrenewals by county or ZIP (Department of Insurance, to verify). Reroof permits where cities publish them. Solar installations by county. Each is an observed count and belongs here before it belongs in a model. |

Scatter plots: the two checks ("hurricane exposure against FEMA", "30 year hail rate against recent hail reports") are checks of a hazard layer against an independent record. California pairs with the same logic: fire hazard zone share against structures destroyed; modeled wind or rain exposure against zone records or FEMA registrations after the 2023 storms. The residual lists and their explanatory sentences (6419, 6423, 6427) are written for Louisiana's coast and north and must be rewritten after the data is in.

The year table (6376 to 6382) has five fixed columns, three of them hail, wind and tornado reports. In California it would read better as fire structures lost, high wind events, heavy rain events, FEMA registrations and permits. The cities table has four job columns chosen by key (replace, storm, hail, repair) and two language columns (Spanish, Vietnamese); with 58 counties and several hundred cities above 1,500 residents the tables stay usable.

Typed in numbers to regenerate: "18 disasters" (6330, 6442), "18 parishes" (6434), "152 against 267" (6314), the storm names at 6302 and 6386, the year list at 6376.

---

# Module 07. Competitive Field (`19_m07_field.js`, lines 6462 to 6605, key `field`)

## 07.1 What it is for and what it shows

Purpose (6471): "The roofing companies already in the market: offices, reach, lines, certifications, the license roster, pressure by ZIP and the whitespace between them". It maps the 29 hand built competitor records and their 34 offices over a competition surface by ZIP, lists the companies, reads the licence roster, and shows where no mapped company reaches.

Defined before the module: `TIERW = { statewide: 3, national: 2.5, regional: 1.5, local: 1 }` (6466); `firmLinks(c)` (6467), which builds three links for a company: Meta Ad Library (`https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=US&q=<name>&search_type=keyword_unordered`), Google Ads Transparency (`https://adstransparency.google.com/?region=US&domain=<domain>`) and the company's own site; `SEG_L = { res: 'Residential', comm: 'Commercial', both: 'Residential and commercial' }` (6468). State (6473): layer `comp_pct`, all four reach tiers on, no line or market filter, no company or ZIP selected.

Visible structure, top to bottom:

| # | element | lines | content |
|---|---|---|---|
| 1 | Masthead | 6476 to 6479 | Eyebrow "Module 07 · Competitive Field · mapped roofing companies, contractors and licenses". Dek (verbatim): "Louisiana roofing is a long tail: a few statewide and national residential brands headquartered around Baton Rouge, the Northshore and Monroe, commercial specialists in Baton Rouge, New Orleans and Lafayette, hundreds of local contractors, and a third of all roofing license records held by companies based out of state, most of which arrive with the storms. This module maps the companies, their offices, lines and certifications, reads the license roster, turns the footprint into a pressure surface by ZIP, and shows where the field thins out." Meta strip: "Companies 29 mapped, 27 verified on their own sites October 6, 2026"; "Offices 34 mapped"; "Licenses 950 roofing license records, 302 out of state"; "Grade C: public listings, partial". Buttons "↓ Companies CSV", "Competitor Watch ↗", "◐ Theme". |
| 2 | Callout "Read this first: three counts, three denominators" | 6481 | Copied in 07.2. |
| 3 | Six headline tiles | 6509 to 6516 | "Mapped roofing companies" 29 (C; "27 verified; 8 commercial specialists"). "Statewide and national" 5 (C; "the brands on television, billboards and trucks"). "Offices mapped" 34 (C; "in 16 cities"). "Out of state licenses" 32% (B; "302 of 950 roofing license records"). "Companies with Spanish pages" 0 (C; "of the mapped sites; an open lane"). "Whitespace ZIPs" 268 (C; "1,523,195 residents with no mapped office within 25 km"). |
| 4 | Controls | 6483 to 6488 | "Map layer": "Competitive pressure percentile", "Mapped roofers within 25 km", "Roofing contractors and licenses per 10,000 residents", "Whitespace: profit pool where few roofers reach". "Market": "Residential and commercial", "Residential roofers", "Commercial roofers". "Companies marketing": "Any line" or one of the eleven lines. "Reach" chips: statewide, national, regional, local. |
| 5 | Map and legend | 6490, 6518 to 6526 | Scored ZIPs in eight quantile classes of the layer. The whitespace layer shades a ZIP by `fees` only when at most one mapped office is within 25 km and draws the others flat. One pin per office of every company passing the filters: radius `2.6 + 0.9 x reach weight`, diamonds for headquarters, the selected company highlighted. Hover a ZIP: "Competitive pressure percentile", "Mapped roofers within 25 km", "Roofing contractors in the ZIP", "Gross profit pool a year". Hover a pin: company, office city, reach, "headquarters", market, offices, lines marketed, "Verified on the company's site" or "From public listings; confirm before use". Click a ZIP or a pin to select. Legend note "Darker is more crowded. Diamonds are headquarters, circles other offices; size follows reach." or "Darker is more job value with a thin field. ZIPs with two or more mapped roofers within 25 km are drawn flat." |
| 6 | Detail card | 6492, 6534 to 6564 | Company: name, "<hq> · <reach> · <market> · n offices", pill "Verified" or "Listing"; website; offices; lines marketed; "Cities it says it serves"; "Manufacturer programs · financing · Spanish pages"; phone; "Scored ZIPs within 25 km of an office" (count and gross profit pool); "Their site, as read <date>" (page title, description, H1); notes; social links; "Watch their ads" (the three links and "Competitor Watch ↗"); a caution paragraph. ZIP: pressure percentile; contractors and licences per 10,000; contractors in the ZIP and licence records; "Mapped roofers within 60 km" with distances; "Companies that list <city> as a service city". Default: "Headquarters" (companies by city) and "Lines marketed by the mapped companies" (count per line). |
| 7 | Card "The companies" | 6495, 6529 to 6533 | Table Company (with a "listing" tag when unverified), Reach, Market, Headquarters, Offices, "Cities served", "Marketed lines", "Manufacturer programs", Financing, Spanish. |
| 8 | Card "Whitespace: job flow the field does not reach" | 6497, 6565 | Scored ZIPs with no mapped office within 25 km: ZIP, City, Parish, Roofs, "Profit pool", "Nearest roofer" (km). |
| 9 | Card "The local trade by parish" | 6498, 6566 to 6567 | Parish, Residents, "Contractors (county)", Licenses, "Per 10k", "Mapped offices". |
| 10 | Card "The license roster" | 6501, 6568 to 6570 | Bars: the 15 cities with the most licence records, then "Out of state"; a note. |
| 11 | Card "Certifications, financing and Spanish" | 6502, 6571 to 6574 | Bars over the verified companies: "Any manufacturer program" (7 of 27), Owens Corning (6), CertainTeed (5), GAF (4), "Financing offered" (10), "Spanish pages" (0), "Residential lines" (19), "Commercial lines" (20); a note. |
| 12 | Cards "What the field means for a campaign" and "Judgment calls and sources" | 6505 to 6506, 6575 to 6592 | Five rows; five rows and three source rows. |
| 13 | Footer | 6593 | "Uplift Louisiana Roofing Atlas, module 07. Company names and claims are quoted from public sources for competitive research. Compiled October 6, 2026." (date typed in). |
| 14 | Export | 6598 | `louisiana-roofing-companies.csv`: `company, domain, reach, market, headquarters, offices, office_cities, service_cities, lines, manufacturer_programs, financing, spanish_pages, verified, as_of`; note "Uplift Louisiana Roofing Atlas, module 07. Public sources; listing companies not verified." |

## 07.2 Data contract

### Formulas

- Company filter (6517): reach tier is on, and the chosen line is in `c.lines`, and the chosen market equals `c.seg` or `c.seg` is `both`.
- Whitespace tile and table (6475, 6565): scored ZIPs with `comp_n25 = 0`. Whitespace map layer (6523): `comp_n25 <= 1`.
- Company reach (6538): scored ZIPs whose centre is within 25 km (`kmLL`) of any of the company's offices; the sum of their `fees`.
- ZIP view (6556 to 6557): companies whose nearest office is within 60 km, sorted by distance; companies whose `cities` list contains the ZIP's `city` string exactly.
- Nearest roofer (6565): minimum distance from the ZIP centre to any office of any company.
- Parish trade table (6566): "Per 10k" = `((cbp_roof if published, else roofers) + lic) / pop x 10,000`.
- Licence roster (6568 to 6570): `META.lic.top` first 15 rows and `META.lic.out`.
- Certification chart (6571 to 6573): counts over `verified` companies of each `cert` name, `fin`, `spanish`, `seg != 'comm'`, `seg != 'res'`.
- Thin lines (6578): the three lines with the fewest companies in `LINE_FIRMS(line)` (8253); today manufactured home roofs (0), multifamily (2), new construction (5).
- Whitespace by region (6579): count of whitespace ZIPs by `parishes[z.pi].reg`, top three; today Central (55), Northwest (45), Northeast (40).

How the pressure columns were built is not in this module; the only record is module 05 line 6257 and the layer notes at 5041 and 5044 (quoted in chapters 01 and 05) and the callout below: 60 percent mapped companies weighted by reach and distance, 40 percent local contractors and licences.

### What is read

| read | lines | fields |
|---|---|---|
| ZIP columns | Part A | `comp_pct`, `comp_n25`, `roof_per10k`, `roofers`, `lic`, `fees`, `roofs`, `pop`, `zip`, `city`, `pi`, `lat`, `lon`, `res_ok`. |
| `comp` | throughout | `name`, `domain`, `url`, `hq`, `tier`, `seg`, `lines`, `verified`, `asof`, `cities`, `phone`, `title`, `desc`, `h1`, `social` (links matching `facebook.com/tr` are hidden, 6548), `spanish`, `fin`, `cert`, `notes`, `offices[]` (`city`, `lat`, `lon`, `hq`). |
| `META.ncomp_ver` | 6477, 6481, 6510, 6583 | 27. |
| `META.lic` | 6477, 6481, 6513, 6568 to 6570 | `n` 950, `firms` 824, `inla` 648, `out` 302, `top` (city, records). |
| `META.cbp.est`, `META.nes.est2381` | 6481 | 267 and 4,899. |
| `parishes` | 6566 to 6567, 6579 | `name`, `pop`, `cbp_roof`, `roofers`, `lic`, `comp`, `reg`. |
| `cities` | 6577 | `span`, `name`. |
| `PL`, `PLI`, `REGN`, `REG_KEYS`, `LINE_FIRMS` | 6486, 6531, 6563, 6578 to 6579 | labels. |

### Method texts (verbatim)

Callout, 6481: "The 29 mapped companies are roofers that market across a city, a region or the state; 27 were checked against their own websites on October 6, 2026 (offices, service cities, lines, certifications, financing, Spanish pages), the rest come from public listings and are flagged. Roofing contractors (267 establishments with employees in County Business Patterns 2023, NAICS 238160, and 4,899 nonemployer firms in the exterior trades) measure the whole local trade. License records (950 roofing records held by 824 companies) show who may legally sell residential roofing of $7,500 or more, wherever they are based. Competitive pressure blends the mapped companies (60%, weighted by reach and distance) with the local contractors and licenses (40%). None of this measures ad spend; module 13 watches the ads themselves."

Companies card subtitle, 6495: "Every mapped roofing company. Click a row to open it. Reach weights the pressure surface: statewide 3, national 2.5, regional 1.5, local 1."

Company caution, 6550: "Claims on competitor sites (years in business, ratings, certifications, warranties) are theirs, quoted as found. Never use a competitor's name, slogan or certification in your own ads; comparisons need substantiation (R.S. 51:1405), and a manufacturer certification may be named only as its program allows (Satchel CERT1)."

Licence note, 6570: "950 roofing license records are held by 824 companies; 648 records belong to Louisiana addresses and 302 (32%) to companies based out of state, more than Baton Rouge, Metairie, New Orleans and Shreveport combined. Out of state holders are legal when licensed, but they are the storm chasers owners fear: a local office, local references, permits pulled in the parish and the license number on every ad are the answer (Satchel STORM1). Since August 1, 2026 even advertising residential roofing of $7,500 or more requires the license." Grade B. (The four city comparison is typed in; it is true of today's data: 86 + 47 + 44 + 35 = 212.)

Certification note, 6574: "Of the 27 verified companies, 7 show a manufacturer program (shingle maker certifications that carry longer warranties), 10 advertise financing and 0 have Spanish pages. Certifications are a trust signal owners recognize; claim one only while it is current and in the program's own words. Financing ads need Regulation Z disclosures (module 03)."

"What the field means for a campaign", 6576 to 6580:

1. "The statewide tier": "Garcia Roofing, Brown's Roofing, Bayou Roofing, CentiMark, Nations Roof market across several metros and are the most visible roofing brands in the state. Competing on volume terms (\"roofing company\", \"roof replacement\") in their home cities buys the most contested clicks; compete on the lines, towns and languages they underserve, and check where they actually buy in module 13." (names computed from `tier`).
2. "Spanish is open": "0 of the mapped roofers show Spanish pages, while New Orleans (21k), Baton Rouge (18k), Metairie (17k), Kenner (15k) hold the most residents who speak Spanish at home. A complete Spanish build, with the license number and the deductible and cancellation notices in Spanish, is a clear opening."
3. "Thin lines": "Manufactured home roofs (0 companies), Multifamily, condo and HOA (2 companies), New construction roofing (5 companies) are marketed by the fewest mapped companies. These lines reward a strong page and builder, property manager or insurer agent relationships more than bids."
4. "Where the whitespace is": "Whitespace ZIPs (no mapped office within 25 km) concentrate in Central (55), Northwest (45), Northeast (40). Rural job flow is smaller per ZIP, but roofs there are often older, mobile homes and metal are common, and the next storm brings out of state crews; a regional company with a local address wins them."
5. "Pressure is not price": "The pressure surface feeds the cost model in module 05; actual auction prices arrive with account data (module 15). After a hurricane, storm crews flood the footprint and prices jump for weeks."

Judgment rows, 6583 to 6587: "Verified companies": "27 company websites were read on October 6, 2026 for offices, service cities, lines, certifications, financing and Spanish pages; titles and descriptions are quoted as found." "Listing companies": "The rest are known roofers whose sites blocked automated reads or were not checked; their offices come from public listings and are flagged \"listing\"." "Office geocodes": "Offices sit at the city center, not the street address; distances are city to ZIP centroid." "Missing companies": "Hundreds of local roofers are not mapped individually; the Business Patterns and license counts carry them." "License roster": "Records come from a public mirror of LSLBC license data, grouped by the holder's mailing city. A company can hold several records (classifications and related entities), so records outnumber companies."

Sources, 6589 to 6591: "Company sites"; "Roofing company websites as read October 6, 2026"; C; "Oct 2026"; no link. "Contractors"; "County and ZIP Business Patterns 2023, NAICS 238160 Roofing Contractors; Nonemployer Statistics 2024, NAICS 2381"; A; "2023 and 2024"; https://www.census.gov/programs-surveys/cbp.html. "Licenses"; "LSLBC roofing license records via a public mirror; check any company on the LSLBC contractor search"; B; "Oct 2026"; https://lslbc.gov/.

## 07.3 Louisiana specific content in module 07

| line | what | text or rule to find |
|---|---|---|
| data | the competitor list | 29 companies with Louisiana headquarters and offices: Garcia Roofing (Prairieville, statewide), Hargrove Roofing & Construction (Shreveport, listing), Brown's Roofing (Monroe, national), Bayou Roofing (Many, statewide), Premier South Roofing & Sheet Metal (Baton Rouge), Vinyltech Roofing (Kenner), Gulf Coast Construction & Restoration (Mandeville), Lifetime Roofing (Baton Rouge), 225 Roofers (Baton Rouge), Roofs Restored (Hammond), Magnolia Roofing (Mandeville), Ibos Roofing (Covington), Gerdes Roofing (New Orleans), Schwander Hutchinson Roofing (New Orleans), Orleans Sheet Metal Works & Roofing (New Orleans), Burford Roofing and Construction (Lafayette), Roof Kings of Louisiana (Broussard), Pelican Roofing Company (Youngsville, listing), Seegers Roofing & Remodeling (Shreveport), Patriot Roofing & Construction (Shreveport), 318 Construction (Monroe), CentiMark (Baton Rouge, national), Nations Roof (Scott, national), Roofing Solutions (Baton Rouge), Carriere-Stumm (New Orleans), Coleman Roofing & Construction (Gonzales), RYCARS Construction (Kenner), Ace Roofing (Lafayette), Guardian Roofing Systems (New Orleans). Their names, domains, phone numbers, page titles, notes and service cities are printed as stored. |
| data | licence roster | `META.lic.top`: Baton Rouge 86, Metairie 47, New Orleans 44, Shreveport 35, Denham Springs 26, Kenner 25, Lafayette 23, Mandeville 19, Gonzales 18, Prairieville 18, Monroe 15, West Monroe 15, Slidell 12, Lake Charles 12, Hammond 11 and ten more. |
| 6467 | company name clean up | the pattern strips "LLC, LLP, PLC, APLC, Inc" from a company name before searching; APLC and PLC are law firm suffixes, so this line looks carried over from an atlas built for another trade. |
| 6471, 6476 | description and dek | "the license roster"; "Louisiana roofing is a long tail"; "Baton Rouge, the Northshore and Monroe"; "Baton Rouge, New Orleans and Lafayette"; "a third of all roofing license records held by companies based out of state, most of which arrive with the storms". |
| 6477 | meta | "verified on their own sites October 6, 2026"; "roofing license records, ... out of state". |
| 6481 | callout | "who may legally sell residential roofing of $7,500 or more". |
| 6484 to 6487 | controls | layer names; reach tier names `statewide`, `national`, `regional`, `local`. |
| 6498, 6501 | card titles | "The local trade by parish"; "LSLBC roofing license records by the license holder's city: who may sell residential roofing of $7,500 or more, and where they are based." |
| 6513 to 6515 | tiles | "Out of state licenses"; "Companies with Spanish pages ... an open lane". |
| 6519, 6555, 6565 | labels | "<name> Parish", header "Parish". |
| 6550 | caution | "(R.S. 51:1405)"; "(Satchel CERT1)". |
| 6567 | table | header "Parish"; tooltip "County Business Patterns 2023, NAICS 238160; published for 18 parishes" (18 typed in). |
| 6569 to 6570 | licence chart and note | bar "Out of state"; the note quoted in 07.2 with the four city comparison, "storm chasers", "permits pulled in the parish", "(Satchel STORM1)", "Since August 1, 2026 even advertising residential roofing of $7,500 or more requires the license". |
| 6576 to 6580 | campaign rows | "the most visible roofing brands in the state"; "the deductible and cancellation notices in Spanish"; "insurer agent relationships"; "mobile homes and metal are common, and the next storm brings out of state crews"; "After a hurricane, storm crews flood the footprint". |
| 6583 to 6587, 6589 to 6591 | judgment and sources | "read on October 6, 2026"; "public mirror of LSLBC license data"; "the LSLBC contractor search"; https://lslbc.gov/. |
| 6593, 6598 | footer and export | "Uplift Louisiana Roofing Atlas"; "Compiled October 6, 2026"; `louisiana-roofing-companies.csv`. |

## 07.4 What a California edition of module 07 needs

The module is driven entirely by the `comp` list, the licence totals in `META.lic` and five ZIP columns. All of them have California equivalents, but each must be built again by hand or from a new source.

| Louisiana input | California equivalent | note |
|---|---|---|
| `comp` (29 companies read on their own sites) | a California list, same fields | The fields can stay as they are. California is about eight times the population with several separate metro markets, so the list needs to be several times longer to mean the same thing, and the reach tiers want a tier between "regional" and "statewide" (a company that covers Southern California only is not statewide). The two national commercial firms in the Louisiana list operate nationally and probably have California offices (to verify). |
| `offices` geocoded to the city centre | same method | A city centre is a poor proxy in Los Angeles or San Diego, where one city spans dozens of ZIPs. Use the office ZIP. |
| `comp_n25` (offices within 25 km), `comp_mass` (decay over 20 km), `roof_mass` (within 30 km, decay over 10 km), `comp_pct`, `roof_per10k` | same formulas | The distances were chosen for Louisiana. In California's large metros almost every ZIP has an office within 25 km, so the whitespace test (`comp_n25 = 0`) will fire only in the rural north, the Sierra and the desert; consider drive time or a shorter radius. |
| `META.lic` (`n`, `firms`, `inla`, `out`, `top` by city) and ZIP `lic` | CSLB C-39 licence file | The "out of state" share is the headline of this module in Louisiana (a tile, the dek, the roster note, the playbook). I would not expect it to matter in California; the tile and the note should be replaced by what the CSLB file can show (active licences, licences per 10,000 residents, concentration by city). |
| `META.cbp`, `META.nes`, parish `cbp_roof`, `roofers` | identical Census sources by county | Same. |
| `spanish` flag and the "Spanish is open" row | same flag, plus other languages | In Louisiana no mapped site had Spanish pages. In California that must be measured, not assumed; add flags for the other languages the ZIP data carries. |
| `cert` (GAF, Owens Corning, CertainTeed) | same, plus programs that matter in California | Tile and low slope manufacturers, cool roof product ratings, solar roofing partners, the IBHS wildfire designation. The Satchel's certification pattern (1375) would need the same additions. |
| `cities[].span` | same | Used for the four largest Spanish speaking cities. |

Text to rewrite: the dek (6476), the callout's licence sentence (6481), the roster card (6501, 6570), the Spanish, whitespace and pressure rows (6577, 6579, 6580), the caution's citation (6550). "Parish" in three tables, "18 parishes" in the tooltip (6567), the file name and the footer. The name clean up at 6467 should lose the law firm suffixes.

Nothing here lacks an equivalent. The cost is labour: the Louisiana list was read by hand on one day.

---

# Module 08. Campaign Desk (`20_m08_desk.js`, lines 6607 to 6899, key `desk`)

## 08.1 What it is for and what it shows

Purpose (6646): "Budgets, ZIP targets, keywords, ads with the license number built in, and bulk files for six ad platforms". It turns a service line (or a blend), a budget and a market scope into a media plan: ZIPs chosen from the paid model, a split across six platforms, a seasonal flight, a forecast of clicks, leads and sold jobs, ad copy written to each platform's limits and linted against the compliance rule pack, and export files. It connects to no platform.

Constants before the module: `PLATS = ['google', 'lsa', 'dg', 'meta', 'microsoft', 'tiktok']` and labels `PLAB` (6612 to 6613); platform assumptions `ASM0` (6614 to 6621); platform mix by line `MIX0` (6622); platform playbook `PBOOK` (6623 to 6630); social phrases `SOC` (6631); question keywords `QKW` (6632 to 6644).

The plan `P` (6648) is stored in the browser under `up.desk.v1`. Defaults: line `replace`; blend lines `replace, repair, storm, hail, fortified`; budget = `SLM.A.budget` or 15,000; start = today + 7 days; 13 weeks; scope `top`; no parishes or picks; 30 ZIPs; minimum 2,000 residents; alpha 1.2; Spanish threshold 8; no storm, event or URL; mix = `MIX0.replace`; assumptions = `ASM0`.

Visible structure, top to bottom:

| # | element | lines | content |
|---|---|---|---|
| 1 | Masthead | 6657 to 6659 | Eyebrow "Module 08 · Campaign Desk". Dek (verbatim): "The atlas's ZIPs turned into media buys for a Louisiana roofing company: a budget allocated by ZIP and platform and paced to each line's season, targeting lists with each platform's identifiers and the bid modifiers from module 05, keyword and negative sets, ads written to every platform's limits with the company name, the LSLBC license number and an office city built in, storm ad groups for a named storm, Spanish where the ZIPs call for it, and a bulk file or build sheet for every ads manager." Meta strip: "441 ZIPs available as markets"; "453 with Google criterion IDs"; "6 platforms · 11 service lines · English and Spanish"; "No keyword volumes pulled". Buttons "↓ Plan", "↓ Google", "↓ LSA", "↓ YouTube", "↓ Meta", "↓ Microsoft", "↓ TikTok", "↓ Creative", "↓ Keywords", "⤓ Save", "⤒ Load", "◐ Theme". |
| 2 | Callout "Read this first: what the desk does and does not do" | 6661 | Copied in 08.2. |
| 3 | Warnings | 6773 to 6775 | "The Company panel is incomplete" when the licence number (for a residential plan), office city, company name or phone is missing: "Missing: LSLBC license number (required to advertise residential roofing of $7,500 or more), office city, company name, phone. The desk leaves these out rather than inventing them, and the Satchel lint flags every ad set until they are filled." with a button to the Company panel. "Storm response ad group" when another module sent an event. |
| 4 | Card "The plan" | 6663 to 6678 | "Service line" ("Blend of lines" or one of eleven); "Lines in the blend" chips; "Monthly budget ($)" ("Media only."); "Flight start · weeks"; "Market scope" ("Top ZIPs by efficiency, statewide", "Top ZIPs in selected parishes", "Hand picked ZIPs"); "Parishes (for parish scope)" multi select of the 64; "Hand picked ZIPs" (placeholder "70808, 70810, 70816"; "Other modules send ZIPs here."); "ZIPs to buy · minimum residents" (1 to 441; any, 1,000+, 2,000+, 5,000+, 10,000+); "Concentration α" slider 0.5 to 2.5 ("1 spends in proportion to the profit pool; 2 concentrates on the best ZIPs."); "Spanish build where Spanish at home ≥ (%)"; "Landing URL base" (placeholder `https://www.yourroofingco.com`); "Storm ad group (optional)" ("None" or one of the 38 named storms, newest first, "<storm> · <roofs> roofs (model)"; "Adds storm keywords and headlines (module 02)."). Then "Platform mix (% of budget)" sliders (0 to 80, rescaled to 100) with "Reset mix to line default", and "Platform assumptions (editable)": Platform, Basis, Cost ($), CTR %, Lead CVR %, Min $/day, Grade, Source, with "Reset to defaults". |
| 5 | Seven headline tiles | 6792 to 6800 | With the default plan and an empty Company panel: "Monthly media" $15,000 (D; "Roof replacement; 13 weeks from <date>"); "Markets bought" 30 (C; "2 with a Spanish build · 958,808 residents"); "Clicks a month" 2,031 (D); "Leads a month" 136 (D); "Sold jobs a month" 25.1 (D); "Cost per sold job" $598 (D; "$128K expected gross profit a month at default values"); "Campaign objects" (campaigns, ad groups, ads). |
| 6 | Card "Markets in the buy" | 6681, 6787, 6801 to 6803 | Map: bought ZIPs shaded by monthly allocation (six steps), other scored ZIPs light grey. Click a ZIP to add or drop it (scope becomes hand picked). Hover: "Monthly allocation", "Bid modifier", "Spanish build", or "Not in the buy · click to add", and "Gross profit pool (plan lines)". |
| 7 | Card "Plan summary" | 6682, 6813 to 6819 | Tabs. "Markets": ZIP, City, Tier, Bid, $/mo, ES, Profit pool. "Platforms": Platform, $/mo, Clicks, Leads, Sold, Cost/sold, with a "Below the daily minimum" warning per platform. "Flight and pacing": bars and a table Month, Days, Seasonal index, Media, with a note. "Campaign objects": a count sentence. |
| 8 | Card "Platform builders: what will be created, and the file that creates it" | 6684 to 6685, 6820 to 6830 | Tabs for the six platforms; "Ad group", "Language" (English, Spanish) and "Preview market" selectors. Left: "Structure", "Targeting", "Rules that bind this buy" (from `PBOOK`), "Monthly media on this platform". Right: the creative for the chosen ad group with character counts ("n/30", "n/90", "n/125 visible", "n/300") and the Satchel lint result; for video platforms a 15 second script; for Local Services a build sheet. |
| 9 | Card "Keyword desk: Google Search and Microsoft" | 6687, 6834 to 6840 | Keywords of the chosen ad group with match types (exact, phrase, question, local, spanish), campaign negatives, "Copy keywords", "Copy negatives". |
| 10 | Card "Measurement, naming and operating rules" | 6688, 6841 to 6844 | Seven rows (copied in 08.2). |
| 11 | Card "Compliance: the rules behind the lint" | 6690, 6845 | Table Rule, Cite, "What the desk does or you must do": the 31 rules of `SAT.rules` (name, citation with its ✔ or ◐ mark, fix). |
| 12 | Cards "How the desk is built" and "Judgment calls" | 6692 to 6693, 6846 to 6847 | Seven steps; nine items. |
| 13 | Footer | 6695 | "Uplift Louisiana Roofing Atlas, module 08. Media plans are cold start priors built from public data and stated assumptions. Replace every assumption with account data after the first thirty to sixty days." |
| 14 | Exports | 6870 to 6881 | Ten files, listed in 08.2. |

## 08.2 Data contract

### Hard coded tables

`ASM0` (6615 to 6620), all grade D:

| platform | basis | cost | CTR % | lead CVR % | min $/day | source text |
|---|---|---|---|---|---|---|
| google | CPC | 38 | 5.5 | 9.0 | 30 | "Assumption: base cost per click for roofing terms in Louisiana metros, times each line's multiplier and each ZIP's relative cost (module 05). Storm weeks run several times higher." |
| lsa | CPL | 90 | 0 | 100 | 20 | "Assumption: cost per Local Services lead for roofing; disputed and unqualified leads are credited on request" |
| dg | CPM | 12 | 0.5 | 1.5 | 15 | "Assumption" |
| meta | CPM | 18 | 0.9 | 6.0 | 15 | "Assumption; lead form objective, home services audiences" |
| microsoft | CPC | 26 | 4.5 | 8.0 | 15 | "Assumption; about two thirds of the Google base" |
| tiktok | CPM | 9 | 0.8 | 1.5 | 15 | "Assumption" |

`MIX0` (6622), percent of budget in the order google, lsa, dg, meta, microsoft, tiktok: replace 50, 22, 6, 14, 6, 2; repair 50, 30, 2, 10, 8, 0; storm 55, 25, 2, 12, 6, 0; hail 52, 22, 4, 16, 6, 0; fortified 45, 10, 10, 25, 8, 2; metal 48, 10, 12, 22, 6, 2; mh 45, 20, 2, 25, 6, 2; mf 70, 0, 5, 10, 15, 0; comm 70, 0, 5, 8, 17, 0; coat 65, 0, 10, 10, 15, 0; newc 60, 0, 5, 20, 15, 0; blend 52, 20, 6, 14, 6, 2.

`SOC` (6631): replace "roof replacement", repair "roof repair", storm "storm damage roof repair", hail "hail damage roof repair", fortified "FORTIFIED roofs", metal "metal roofing", mh "mobile home roofing", mf "multifamily roofing", comm "commercial roofing", coat "roof coating and restoration", newc "new construction roofing".

`QKW` (6633 to 6643), question keywords by line: replace: "how much does a new roof cost in louisiana", "how long does a roof last in louisiana", "signs you need a new roof", "roof replacement financing". repair: "roof leak repair near me", "how much to fix a roof leak", "emergency roof repair", "repair or replace roof". storm: "what to do after storm damage to roof", "emergency roof tarp", "how to tell if a roof has wind damage", "roof damage after hurricane". hail: "how to tell if a roof has hail damage", "what size hail damages a roof", "hail damage roof inspection", "hail damage roof replacement". fortified: "louisiana fortify homes program", "fortified roof grant louisiana", "what is a fortified roof", "fortified roof insurance discount". metal: "metal roof cost louisiana", "metal roof vs shingles", "standing seam metal roof", "metal roof over shingles". mh: "mobile home roof replacement", "mobile home roof over", "mobile home roof leak repair", "metal roof for mobile home". mf: "apartment roof replacement", "hoa roof replacement", "condo roof repair", "multifamily roofing contractor". comm: "commercial roof replacement cost", "tpo roofing contractor", "flat roof repair", "commercial roof inspection". coat: "silicone roof coating", "commercial roof restoration", "metal roof coating", "roof maintenance program". newc: "new construction roofing contractor", "builder roofing subcontractor", "roofing for new homes".

`PBOOK` (6624 to 6629), per platform `geo`, `bulk`, `policy`:

- google. geo: "ZIP criteria with bid modifiers; Google criterion IDs carried for most Louisiana ZIPs, the rest resolve by name. Presence only (\"people in or regularly in\"), not interest." bulk: "Google Ads Editor CSV: Account, Import, From file. Every object is paused." policy: "Roofing is not a restricted category for search ads in the United States; editorial rules apply (no exclamation in headlines, no shouting, no phone numbers in ad text)." "Every ad set carries the company name and the LSLBC license number in a description; since August 1, 2026 advertising residential roofing of $7,500 or more requires the Residential Roofing or Residential Construction license (Act 757 of 2026)." "No claims specialist language and no deductible offers in any asset (R.S. 37:2159.1(7), (8); R.S. 51:451); the desk never writes them and the lint blocks them." "Financing trigger terms (a payment, a term, a rate) need the Regulation Z disclosures in the same ad; the desk writes \"financing available\" at most."
- lsa. geo: "Service area by ZIP list per business profile". bulk: "No bulk upload. Build sheet: business profile, license and insurance documents, job types, service ZIPs, weekly budget, hours, languages." policy: "Google checks the business license and insurance and runs background checks before the Google Guaranteed badge shows; the LSLBC license must be current." "Leads are charged per lead; dispute unqualified leads in the console window." "Ranking follows responsiveness, reviews and proximity; answer every lead fast, especially in storm weeks."
- dg. geo: "Same Google criteria; YouTube placements and custom segments". bulk: "Build sheet plus custom segment term lists." policy: "Custom segments from the keyword desk terms." "Video: show your own crews and real local jobs, with each owner's written permission for their home; storm footage must be real and labeled with place and date."
- meta. geo: "ZIP keys (US:70808) or radius around office cities. Roofing is not a special ad category; ads that offer financing fall under Financial products and services, which limits targeting." bulk: "Ads Manager, Import and Export: CSV with Campaign Name, Objective, Ad Set Name, Zip, Ad Name, Title, Body, Link, Call to Action." policy: "Personal attributes: never assert the reader's finances, credit or hardship (\"behind on bills\", \"bad credit\"); describe the service and the place." "Lead forms: consent language for calls and texts, unchecked; ask the address and the best time to inspect, not insurance or claim details." "The license number appears in the primary text."
- microsoft. geo: "ZIP and city by name". bulk: "Import from Google Ads, or the same Editor CSV with campaign names suffixed _MS." policy: "Same editorial practice as Google; audience network off at launch."
- tiktok. geo: "Designated market area or city level; ZIP targeting is limited." bulk: "Build sheet for TikTok Ads Manager." policy: "Home improvement ads are allowed with platform review; claims, reviews and testimonials follow the FTC rules (16 CFR Parts 255 and 465)." "Creator content counts as the company's advertising once paid or boosted."

### Formulas

- Markets (6697 to 6705): start from scored ZIPs with `pop >= minpop`; in parish scope keep ZIPs whose `fips` is selected; `val(z)` = gross profit pool of the plan lines (`SLM.zipAll`); `eff(z) = val / max(0.3, cpc_rel)`; keep the top `n` by `eff` (hand picked scope uses the picked scored ZIPs instead, with no population filter); weight = `max(1, eff) ^ alpha`; `spend = budget x weight / sum`; Spanish build flag `es = span_sh >= spanTh`.
- Line mix (6706): each plan line's share of the bought markets' gross profit pool.
- Forecast (6707 to 6717): `close`, `cpcMul` and gross profit per job (`val x fee`) are line mix weighted averages of the service line assumptions. Platform spend = `budget x mix[p] / sum(mix)`. `cm` = allocation weighted mean `cpc_rel` of the markets. CPC platforms: `clicks = spend / (cost x cpcMul x cm)`, `leads = clicks x cvr`. CPM platforms: impressions = `spend / cost x 1000`, `clicks = impressions x ctr`, `leads = clicks x cvr`. Local Services: `leads = spend / cost`. Sold jobs = `leads x close`, with `close` halved for Meta and TikTok and multiplied by 0.6 for YouTube and Demand Gen. Profit = jobs x gross profit per job.
- Pacing (6811 to 6812): monthly index = line mix weighted `SLM.seasonFor(line)[month]`; flight total = `budget x weeks / 4.345`; each calendar month of the flight gets a share proportional to index x days.
- Ad groups (6725 to 6731): one per English angle of the line (label "<short> · <Angle>"), or one per line for a blend; plus "Storm · <storm>" when a named storm is chosen, or "Storm response · <event>" when a module sent an event (its line is `hail` when the event text contains "hail", else `storm`).
- Campaign objects (6809): Google and Microsoft: one campaign per language, two ad groups and two ads per group per language; Local Services one campaign; the other platforms one campaign, one ad set per group, one ad per group and language.
- Bid modifier of a market (6653): a bid sent by another module, else the stored ZIP column `bid` (which is the all lines tier, whatever line the plan is for).
- Measurement (6842): target cost per sold job = 15 percent of the line mix weighted gross profit per job.

### How the copy is written

Mandatory line (`reqLines`, 6733 to 6737): "LSLBC license <number>. Office in <city>." or, with only one of the two, "LSLBC license <number>." or "Local office in <city>." Spanish: "Licencia LSLBC <number>. Oficina en <city>.", "Licencia LSLBC <number>.", "Oficina en <city>."

Responsive search ad (`rsaFor`, 6738 to 6752): up to 15 headlines of 30 characters and 4 descriptions of 90, de duplicated, passed through `fillCopy` and `houseClean`; a template is skipped when it needs a company field that is empty. Headline templates in order:

- Storm group: "<Hurricane or Tropical Storm> <name> Roof Repair", "Roof Damage From <name>?", "<name> Storm Damage Repair", "Emergency Roof Tarps", "Storm Damage Roof Repair", "Roof Inspection After a Storm".
- Event group: hail: "Hail Damage Roof Inspection", "Hail Damage Roof Repair", "Was Your Roof Hit by Hail?"; otherwise "Storm Damage Roof Repair", "Emergency Roof Tarps", "Roof Inspection After a Storm".
- Spanish: the line's Spanish angle headlines, then "Techos en {City}", "Hablamos Español", "Oficina en {Office}", "Reparación de Techos", "Llame o Escriba Hoy", and with a licence "Techador con Licencia".
- English: the angle headlines, "<Line Name> {City}", "<Line Name> in {City}", "Roofing Company in {City}", "Louisiana Roofing Company", with a licence "Licensed Louisiana Roofer", "Itemized Written Estimates", "Permitted and Inspected Work", "Office in {Office}", the company name, "Call or Message Us Today", with financing "Financing Available", and with a parish "Roofing in {Parish} Parish", "Serving {Parish} Parish".

Descriptions in order: the mandatory line; for a storm group "Storm damage from <storm>? A licensed local roofer inspects, photographs the damage and writes an itemized estimate."; the angle descriptions; then "Louisiana <line name> from a licensed local roofer. Inspections, itemized estimates, permits." or in Spanish "Techador con licencia en Luisiana. Inspección, presupuesto detallado y permiso para cada trabajo."

Social and video copy (`socialFor`, 6757 to 6764; comment "social copy speaks about the service and the place, never about the reader's finances or hardship (Meta personal attributes policy)"): body = one lead sentence plus the mandatory line. Leads: Spanish "Techador con licencia para {City} y toda Luisiana. Hablamos español. Inspección del techo, presupuesto detallado por escrito y permiso para cada trabajo."; storm "Storm damage roof repair near {City} after <storm>. A licensed Louisiana roofer inspects, photographs the damage, tarps what needs it and writes an itemized estimate."; event "Storm damage roof repair near {City}. A licensed Louisiana roofer inspects, photographs the damage and writes an itemized estimate."; otherwise "<Social phrase> for {City} from a licensed Louisiana roofer. Roof inspections, itemized written estimates and a permit for every job." Title "<Social phrase> in {City}" or "Techos en {City}" (40 characters for Meta, 60 elsewhere). Description "Licensed Louisiana roofer" or "Hablamos español".

Video script (6826): "Script (15 seconds): open on a roof your crew finished in <city>, shown with the owner's written permission; the owner of the company or a crew lead speaks to camera; one line on what to do first (photograph the damage from the ground and call for a tarp [storm] / look for dented gutters and vents, then book an inspection [hail] / check the roof's age and book an inspection [other]); end card with <company>, <LSLBC license number> and <office city>."

Local Services build sheet (6827): "Business name", "LSLBC license · classification", "Job types", "Service ZIPs", "Weekly budget" (`spend / 4.345`), "Languages" ("English, Spanish (answer in Spanish)"), "Bio (500 max)": "<company> replaces and repairs roofs across {Parish} Parish and Louisiana: <three line names>. Licensed by the LSLBC (<number>), with an office in <city or Louisiana>. Every job is permitted and inspected."

Keywords (`kwFor`, 6831 to 6833): storm group: "<hurricane or tropical storm> <name> roof damage", "<name> roof damage", "roof repair after <kind> <name>", "storm damage roof repair", "emergency roof tarp", "roof tarp service"; hail event: "hail damage roof repair", "hail damage roof inspection", "roof hail damage", "hail damage roofer"; storm event: "storm damage roof repair", "emergency roof tarp", "wind damage roof repair", "roof storm damage"; otherwise the line's `kw`. Questions from `QKW`. Spanish from `kwEs`. Negatives = `NEG_COMMON` plus the line's `neg`. Local variants = the first keywords joined to the market city names in lower case.

Lint (6754 to 6755): every creative is run through `satchelLint` with the company context (`lic`, offices, certifications, FORTIFIED status), `asset: true`, `res: resPlan()` and the platform; headlines over 30 characters are caught by rule GADS1. `resPlan()` (6719) tests `seg !== 'comm'`, but the service line table uses `'com'` for commercial lines (1302, 1314, 1327, 1339), so it is always true: a commercial only plan is still treated as residential and still warns that the LSLBC licence is missing. A rebuild should fix the test.

### The angle and keyword libraries the Desk prints (`PL`, lines 1209 to 1350)

| line key | angle id | lang | headline (h) | description (d) |
|---|---|---|---|---|
| `replace` | local | en | New Roof in {City} | Licensed Louisiana roofer, written itemized estimates. {Company}, {Office} office. |
| `replace` | age | en | Is Your Roof 20 Years Old? | Most Louisiana shingle roofs wear out near 20 years. Book a roof inspection today. |
| `replace` | permit | en | Permitted and Inspected Roofs | Every reroof in Louisiana needs a permit and inspections. We pull and pass both. |
| `replace` | license | en | Licensed Residential Roofer | Check our LSLBC license before you sign. {Lic}. {Company}, {Office}. |
| `replace` | spanish | es | Techo Nuevo en {City} | Reemplazo de techos con licencia en Luisiana. {Company}, oficina en {Office}. |
| `repair` | leak | en | Roof Repair {City} | Leak tracing, flashing and shingle repairs by a licensed roofer. Call {Company}. |
| `repair` | early | en | Stop a Roof Leak Early | Small leaks rot decking and ceilings. Get it found and fixed. {Office} office. |
| `repair` | flash | en | Flashing and Chimney Leaks | Most leaks start at flashing, vents and valleys. Photo report with every repair. |
| `repair` | spanish | es | Reparación de Techos | Arreglamos goteras y tejas dañadas. Hablamos español. Oficina en {Office}. |
| `storm` | tarp | en | Emergency Roof Tarping | Storm tore your roof? We tarp it, photograph the damage and repair it. {Company}. |
| `storm` | inspect | en | Storm Damage Roof Inspection | Wind lifts shingles you cannot see from the ground. Get a written photo report. |
| `storm` | local | en | Storm Repair {City} | Licensed roofer for wind and storm repairs. Written estimates. {Office} office. |
| `storm` | estimate | en | Itemized Storm Repair Quotes | Louisiana law requires a good faith itemized estimate. You get one before any work. |
| `storm` | spanish | es | Daños de Tormenta al Techo | Lonas de emergencia y reparación de techos. Hablamos español. Oficina en {Office}. |
| `hail` | hail | en | Hail Damage Roof Inspection | Hail bruises shingles and knocks off granules. A licensed roofer shows you where. |
| `hail` | local | en | Hail Hit {City}? | Get a written roof report from a licensed local roofer. {Company}, {Office} office. |
| `hail` | size | en | Golf Ball Hail Damages Roofs | Hail of 1.75 inches or larger damages most shingles. Book an inspection. |
| `hail` | spanish | es | Daños por Granizo | Inspección de techos después del granizo. Hablamos español. Oficina en {Office}. |
| `fortified` | grant | en | FORTIFIED Roof Installer | Ask how the Louisiana Fortify Homes grant of up to $10,000 works. {Company}. |
| `fortified` | std | en | FORTIFIED Standard Roofs | Sealed roof deck, ring shank nails and tested edges, built to the IBHS standard. |
| `fortified` | insure | en | Ask Your Insurer About Credits | Many Louisiana insurers file FORTIFIED discounts. Ask yours, then call {Company}. |
| `fortified` | spanish | es | Techos FORTIFIED | Pregunte por la subvención de hasta $10,000 del programa Fortify Homes. |
| `metal` | metal | en | Metal Roofs in {City} | Standing seam and exposed fastener metal roofs installed by a licensed roofer. |
| `metal` | built | en | A Roof Built for Louisiana | Metal sheds wind and rain for decades. Get a written quote from {Company}. |
| `metal` | over | en | Metal Roof Over Shingles? | We tell you in writing whether your deck and the code allow it. {Office} office. |
| `metal` | spanish | es | Techos de Metal | Instalación de techos de metal con licencia. Hablamos español. Oficina en {Office}. |
| `mh` | over | en | Mobile Home Roof Over | Metal roof overs and coatings for manufactured homes. Licensed roofer in {Office}. |
| `mh` | leak | en | Mobile Home Roof Leaks | Stop leaks at seams and vents before the ceiling fails. Call {Company}. |
| `mh` | spanish | es | Techos de Casas Móviles | Techos de metal y reparaciones para casas móviles. Hablamos español. |
| `mf` | hoa | en | HOA and Condo Roofing | Phased replacements, reserve planning and storm repairs for associations. |
| `mf` | apts | en | Apartment Roof Replacement | Low slope and shingle roofs for multifamily owners. Licensed commercial roofer. |
| `mf` | storm | en | Multifamily Storm Repairs | Tarping, temporary repairs and full replacement across buildings. {Company}. |
| `comm` | tpo | en | Commercial Roof Replacement | TPO, PVC, modified bitumen and metal roofs. Licensed commercial roofer. |
| `comm` | local | en | Commercial Roofing | Warehouses, retail, churches and offices in {City}. Licensed commercial roofer. |
| `comm` | wind | en | Hurricane Rated Roof Systems | Wind rated assemblies designed to the Louisiana building code. Request a bid. |
| `comm` | church | en | Church and School Roofs | Replacement and repair planned around services and school calendars. |
| `coat` | coat | en | Silicone Roof Coatings | Restore a sound commercial roof and add years before replacement. |
| `coat` | maint | en | Roof Maintenance Plans | Twice yearly inspections and repairs keep roofs and warranties in shape. |
| `coat` | leak | en | Commercial Roof Leak Repair | Leak tracing on flat and metal roofs with photo reports. {Company}. |
| `newc` | builder | en | Roofing for Home Builders | Production roofing crews, permits and inspections handled. {Office} office. |
| `newc` | sched | en | New Construction Roofing | Crews scheduled to your build calendar, permits and inspections included. |

| line key | kw (English keywords) | kwEs | neg (line negatives) |
|---|---|---|---|
| `replace` | roof replacement; new roof; roof replacement cost; roofing company; roofers near me; roofing contractor; shingle roof replacement; architectural shingles; reroof; roof installation; residential roofing; roof estimate; roofing companies near me; new roof cost | reemplazo de techo; techos nuevos; compañia de techos; techeros cerca de mi | roofing nails; roofing shingles for sale; shingle calculator; roof rack; car roof; shed roof; dog house; roofing license exam; roof truss; roof pitch calculator |
| `repair` | roof repair; roof leak repair; leaking roof; emergency roof repair; roof repair near me; flashing repair; chimney leak repair; shingle repair; roof patch; roof leak; roof inspection | reparacion de techos; goteras en el techo | flex seal; roof sealant; rv roof; camper roof; car sunroof; tarp for sale; roof coating home depot |
| `storm` | storm damage roof repair; hurricane roof damage; wind damage roof repair; roof tarp; emergency roof tarp; roof inspection after storm; missing shingles; tree on roof; blue tarp roof; roof damage repair; storm roof repair | daños de tormenta techo; lona para techo | public adjuster; insurance agent; insurance quote; fema application; car insurance; tarp for sale; harbor freight |
| `hail` | hail damage roof; hail damage roof repair; hail roof inspection; hail damaged shingles; roof hail damage; hail storm roof | daños por granizo techo | hail damage car; paintless dent repair; hail netting; auto hail; hail guard |
| `fortified` | fortified roof; fortified roof cost; fortified roof contractor; louisiana fortify homes program; fortified roof grant; fortified roof louisiana; ibhs fortified roof; wind mitigation roof; fortified roofer near me | techo fortified; subvencion techo luisiana | fortified wine; fortified milk; fortified cereal; fortified foods; vitamin |
| `metal` | metal roofing; metal roof installation; standing seam metal roof; metal roof cost; metal roof contractor; metal roof over shingles; metal roofing near me; metal roof replacement | techos de metal; techo de lamina | metal roofing panels for sale; metal building kit; carport kit; scrap metal; metal roof paint; diy metal roof |
| `mh` | mobile home roof; mobile home roof over; mobile home roof repair; manufactured home roof replacement; trailer roof leak; mobile home metal roof; mobile home roof coating | techo para casa movil | rv roof; camper roof; mobile home for sale; mobile home parts; mobile home lot |
| `mf` | apartment roofing; multifamily roofing contractor; hoa roof replacement; condo roof replacement; townhome roof replacement; property management roofing | — | apartment for rent; condo for sale; apartments near me; hoa fees |
| `comm` | commercial roofing; commercial roof replacement; flat roof replacement; tpo roofing; pvc roofing; modified bitumen roof; commercial roofing contractor; warehouse roof replacement; church roof replacement; metal building roof | — | commercial roofing jobs; roofing salary; rubber roof kit; flat roof diy; roofing apprenticeship |
| `coat` | commercial roof coating; silicone roof coating; roof restoration; flat roof coating; commercial roof repair; roof maintenance program; commercial roof inspection | — | roof coating home depot; elastomeric paint; diy roof coating; roof coating gallon |
| `newc` | new construction roofing; roofing subcontractor; builder roofing contractor; roofing for builders; roof installation new home | — | roofing jobs; roofing apprenticeship; roofing license; build my own house |

`NEG_COMMON` (1354): jobs, job, career, salary, hiring, apprentice, apprenticeship, training, how to, diy, do it yourself, youtube, reddit, wiki, definition, meaning, license exam, osha, home depot, lowes, menards, for sale, wholesale, texas, mississippi, arkansas, alabama, florida.

### The rule pack shown in "Compliance: the rules behind the lint" (`SAT.rules`, lines 1379 to 1409)

✔ means "read from the primary text this build", ◐ "secondary or platform policy" (1368). `SAT.vertical` is "Roofing, Louisiana", `SAT.version` "2026-10-06" (1377).

| line | id | family | severity | name | cite (verbatim) | read | fix (verbatim) |
|---|---|---|---|---|---|---|---|
| 1379 | LIC1 | LSLBC | block | Residential roofing advertised with no license on file | La. R.S. 37:2156.4 (Acts 2026, No. 757): advertising residential roofing of $7,500 or more requires the Residential Roofing or Residential Construction classification | ✔ | Hold the Residential Roofing or Residential Construction classification before advertising replacements, then enter the license number in the Company panel. |
| 1380 | LIC2 | LSLBC | note | License number not shown | Trust signal: owners verify on the LSLBC Contractor Search | ◐ | Add "LSLBC license #" and the number to a description, a callout or the landing page footer. |
| 1381 | LIC3 | LSLBC | warn | "Licensed and insured" with nothing on file | La. R.S. 51:1405; La. R.S. 37:2156.1 ($500,000 liability for residential licensees from Aug. 1, 2026) | ◐ | Claim only the license and coverage you hold; the license number substantiates the claim. |
| 1382 | LIC4 | LSLBC | block | Suggests skipping the permit | Acts 2025, No. 239 (permit and inspection for every roof and reroof from Aug. 1, 2025); Acts 2025, No. 422 (violations) | ✔ | Every roofing and reroofing job needs a permit and inspections; say "permitted and inspected". |
| 1383 | INS1 | Insurance claims | block | Advertises claim handling or claims specialist services | La. R.S. 37:2159.1(7), (8) (Acts 2025, No. 144); R.S. 37:2159.1 (no adjusting) | ✔ | Advertise the roofing work (inspection, photo report, itemized estimate, repair), never the claim. Owners deal with their insurer or a licensed public adjuster. |
| 1384 | INS2 | Insurance claims | warn | Insurance adjacent wording needs care | La. R.S. 37:2159.1; La. R.S. 22:1693 (unauthorized public adjusting) | ✔ | Describe what the roofer does on the roof and in the estimate; a roofer may show damage to an adjuster but may not adjust or negotiate. |
| 1385 | INS3 | Insurance claims | block | Interprets coverage or implies insurance pays | La. R.S. 37:2159.1 (no interpreting policy provisions); La. R.S. 51:451 | ✔ | Never say what a policy covers or that insurance will pay. "Get a written report of the damage" is safe. |
| 1386 | DED1 | Insurance claims | block | Offers to pay, waive or rebate a deductible | La. R.S. 51:451 (Acts 2022, No. 734) | ✔ | Remove it. Louisiana bars advertising, promising or agreeing to pay, waive, absorb or rebate a deductible, and padding the price to cover it. |
| 1387 | DED2 | Insurance claims | block | Contract lacks the statutory deductible notice | La. R.S. 51:452 | ✔ | Contracts of $1,000 or more expected to be paid from insurance must carry the R.S. 51:452 notice in at least 12 point bold type. |
| 1388 | AOB1 | Insurance claims | warn | Assignment of benefits or direction to pay | La. R.S. 37:2159.1 (no assignment before the work is complete and the insurer has inspected) | ✔ | Do not take or advertise an assignment before the work is complete and the insurer has made its first inspection; limit any assignment to the contracted scope. |
| 1389 | ATTY1 | Insurance claims | warn | Attorney referral or lawsuit talk | La. R.S. 37:2159.1 (no sharing in attorney fees or accepting referral consideration) | ✔ | Keep attorneys out of roofing ads; never accept anything of value for a referral. |
| 1390 | GOUGE | Louisiana law | warn | Storm pricing language | La. R.S. 29:732 (price gouging during a declared emergency) | ◐ | During a declared emergency price only at pre storm levels plus documented cost increases; keep dated price books. |
| 1391 | COOL | FTC | warn | Door to door sale: three day cancellation notice | 16 CFR Part 429 (FTC Cooling Off Rule) | ✔ | Give the buyer the cancellation notice and a copy of the contract; the emergency waiver applies only when the owner starts the contact and signs a separate waiver. |
| 1392 | TCPA | FTC | warn | Calls or texts need written consent | 47 U.S.C. 227; 47 CFR 64.1200; La. R.S. 45:844.11 et seq. | ◐ | Capture consent on your own forms (unchecked box, clear language); do not buy storm lead lists. |
| 1393 | SUP1 | Truth in advertising | warn | Superlative or comparison needs substantiation | La. R.S. 51:1405 (LUTPA); FTC Act s. 5 | ◐ | Cite a verifiable, dated basis beside the claim or remove it. |
| 1394 | LIFE1 | Truth in advertising | warn | Lifetime, proof or never claims | La. R.S. 51:1405; manufacturer warranty terms | ◐ | State the warranty exactly as written (who issues it, years, what it covers, transferability). |
| 1395 | WIND1 | Truth in advertising | note | Wind speed rating claim | Manufacturer specifications; ASTM D3161 and D7158 wind classes; state building code | ◐ | Quote the rating of the specific product and installation (nail count, starter, high wind application) that earns it. |
| 1396 | CERT1 | Truth in advertising | block | Manufacturer certification not on file | Manufacturer program terms; La. R.S. 51:1405 | ◐ | Claim only certifications you currently hold, named exactly as the manufacturer allows. |
| 1397 | FORT1 | FORTIFIED | block | FORTIFIED installer claim without certification on file | IBHS FORTIFIED program terms; La. R.S. 22:1483.1 (grant roofs are certified by an evaluator) | ◐ | Only a FORTIFIED certified roofer advertises installing FORTIFIED Roofs; designations come from IBHS evaluators. |
| 1398 | FORT2 | FORTIFIED | warn | Promises an insurance discount size | R.S. 22:1483.1 (discounts are filed by each insurer; SB 222 of 2025, which would have mandated 20 to 30 percent, did not pass) | ✔ | Say FORTIFIED roofs can qualify for discounts that insurers file, and send owners to their insurer for the figure. |
| 1399 | GRANT1 | FORTIFIED | warn | Grant promise or wrong amount | R.S. 22:1483.1; LDI program rules (lottery rounds, up to $10,000, eligibility) | ◐ | Grants are awarded by LDI by lottery to eligible homeowners, up to $10,000, paid to the contractor after certification. |
| 1400 | FIN1 | Financing | block | Financing trigger term without the disclosures | 12 CFR 1026.24(d) (Regulation Z) | ✔ | Add the down payment, terms of repayment and the annual percentage rate, or say only "financing available". |
| 1401 | META1 | Meta | warn | Credit offer: Financial products special ad category | Meta Advertising Standards, special ad categories (financial products and services) | ◐ | Run financing ads under the Financial products and services category (radius at least 15 miles, no age or gender targeting) or drop the financing line. |
| 1402 | FTC1 | FTC | warn | Review or rating claim must match real reviews | 16 CFR Part 465 (eff. Oct. 21, 2024); 16 CFR Part 255 | ◐ | Quote the live count and the source with a date; never buy, gate or write reviews. |
| 1403 | FTC2 | FTC | note | "Free" needs its conditions | 16 CFR Part 251 | ◐ | State what is free and any condition beside it. |
| 1404 | FTC3 | FTC | block | Review incentive or gating | 16 CFR 465.4, 465.7 | ✔ | Ask every customer for an honest review, with no condition on sentiment. |
| 1405 | STORM1 | Storm response | note | Out of state storm crews | La. R.S. 37:2150.1 et seq. (every contractor needs the Louisiana license for the work); La. R.S. 14:202.1 | ◐ | Lead with the Louisiana license, a local office and a permit on every job; owners screen door knockers hard after storms. |
| 1406 | GADS1 | Google Ads | warn | Headline over 30 characters | Google Ads responsive search ad limits | ◐ | Cut to 30 characters or fewer. |
| 1407 | GADS2 | Google Ads | warn | Editorial: shouting or gimmicky punctuation | Google Ads editorial policy | ◐ | Use sentence case and single punctuation. |
| 1408 | HOUSE1 | House style | block | Hyphen or dash in copy | House style: no hyphens or dashes in copy | ✔ | Rewrite without the hyphen or dash (write "ring shank", "well being", "24 hour"). URLs are exempt. |
| 1409 | HOUSE2 | House style | block | Meta note or placeholder left in copy | House style: no explanatory or meta notes inside a deliverable | ✔ | Fill the Company panel (name, license, office) or remove the note. |

### Exports

| button | file | content |
|---|---|---|
| ↓ Google | `google-ads-editor_<tok>_<start>.csv` | Columns `GH` (6852): Campaign, Campaign Type, Networks, Budget, Budget type, Languages, Bid Strategy Type, Start Date, End Date, Campaign Status, Location, ID, Bid Modifier, Criterion Type, Status, Ad Group, Ad Group Type, Max CPC, Ad Group Status, Keyword, Ad type, Headline 1 to 15, Description 1 to 4, Path 1, Path 2, Final URL, Callout text, Header, Snippet values, Phone number, Country code. Rows (6854 to 6868): per language one campaign ("Search", "Google search", daily budget = monthly / 30.4, "Maximize conversions", "Paused"; Spanish gets 25 percent of the platform budget and only the Spanish markets, English 75 percent or all of it); one location row per market: "<zip>, Louisiana, United States", ID = `gid`, bid modifier; negative phrase rows; callouts ("Itemized Written Estimates", "Permitted and Inspected", "Call or Message Today", and with a licence "Licensed Louisiana Roofer"; Spanish "Hablamos Español", "Presupuesto Detallado", "Techador con Licencia"); a "Services" or "Servicios" snippet of line names; the phone; per ad group a "Core" set (keywords and questions, exact and phrase) and a "Local" set (first four keywords x up to ten cities, phrase), or an "ES" set; Max CPC = platform cost x line multiplier x `cpc_rel` of the first market; one responsive search ad per set with Path 1 from the line, Path 2 from the city and a Final URL carrying `utm_source`, `utm_medium=cpc`, `utm_campaign`, `utm_content`. |
| ↓ Microsoft | `microsoft-ads_<tok>_<start>.csv` | The same rows with campaign names suffixed `_MS` and no location ID. |
| ↓ LSA | `lsa-build-sheet_<start>.csv` | Field, Value: Business name; "LSLBC license number"; License classification; Qualifying party or owner; Phone; Weekly budget; Job types; Service ZIPs; Languages; "Documents to upload" ("LSLBC license, general liability insurance certificate, business registration, owner identification for background checks"); Hours. |
| ↓ Meta, ↓ YouTube, ↓ TikTok | `meta-ads-import_<start>.csv`, `youtube-demand-gen-build-sheet_<start>.csv`, `tiktok-build-sheet_<start>.csv` | One row per ad group and language: Campaign Name, Campaign Objective "Leads", Ad Set Name, Zip (Meta: "US:<zip>" list), Locations (others: up to 20 cities then ", Louisiana"), Ad Name, Title, Body, Link, Call to Action ("Contact Us" for Meta, "Learn More" otherwise), Status "Paused". |
| ↓ Creative | `creative-library_<start>.csv` | `ad_group, language, type, text, chars` for every headline and description in both languages. |
| ↓ Keywords | `keyword-desk.csv` | `ad_group, keyword, match_type`. |
| ↓ Plan | `campaign-plan_<tok>_<start>.csv` | `zip, city, parish, tier, bid_modifier, monthly_usd, spanish, gross_profit_pool`. |
| ⤓ Save, ⤒ Load | `campaign-desk-plan.json` | the plan object. |

Campaign names (6850): `LA_<line token or BLEND>_<PLATFORM>_<LANG>_<start date digits>`. Landing page (6853): the company URL (or `https://www.example.com`) + "/" + a slug of "<storm> roof repair", "hail damage roof repair", "storm damage roof repair" or the line name.

### What is read

| read | lines | use |
|---|---|---|
| ZIP columns | Part A | `pop`, `cpc_rel`, `span_sh`, `p_<line>` (through `SLM`), `zip`, `city`, `pi` (as `fips`, `cty`), `gid`, `tier`, `bid`, `res_ok`. |
| `SLM.A`, `SLM.zipAll`, `SLM.zipLine`, `SLM.seasonFor`, `SLM.MONTHS` | 6648, 6700 to 6708, 6812, 6842, 6864 | budget default, `fee`, per line `close`, `cpcMul`, `val`; seasonal curves. |
| `routes` (`RT`, `RTI`), `RTS` | 6675, 6720, 6729, 6743, 6831 | storm menu (`r`, `year`, `month`, recomputed roofs damaged), storm name and kind (`name`, `life`, `vmax`). |
| `PL`, `PLI` | throughout | `name`, `short`, `tok`, `seg`, `angles`, `kw`, `kwEs`, `neg`. |
| `BRAND` | 6718, 6723, 6773, 6827, 6860 to 6862, 6872 | `name`, `short`, `lic`, `licClass`, `contact`, `city`, offices, `phone`, `financing`, `warranty`, `url`. |
| `SAT.rules`, `satchelLint`, `satCtx` | 6754 to 6755, 6845 | lint and the rules table. |
| `NEG_COMMON` | 6833 | negatives. |
| `parishes` | 6669 | `fips`, `name` for the parish selector. |

### Method texts (verbatim)

Callout, 6661: "Choose a service line (or a blend), a budget and a market scope. The desk picks ZIPs from the paid model, splits the money across Google Search, Local Services Ads, YouTube and Demand Gen, Meta, Microsoft and TikTok, paces it to the line's season, forecasts clicks, leads and sold jobs from assumptions you can edit, and writes what each platform expects: location targets with bid modifiers, keywords with match types and negatives, responsive search ads with the city filled in, social and video copy, and build sheets. Every ad set carries the company name, the LSLBC license number and an office city (advertising residential roofing of $7,500 or more requires the license since August 1, 2026); nothing claims to handle insurance claims or deductibles; copy has no hyphens or dashes. It connects to no platform, pulls no keyword volumes and spends no Ahrefs units. Exports set every object to paused. Fill the Company panel (top right) first: the desk refuses to invent a license number."

Assumptions note, 6783: "Search costs multiply by each line's click cost multiplier (module 12) and each ZIP's relative cost (module 05). Sold jobs use each line's lead to sale rate; social lead forms (Meta, TikTok) close at half that rate and video leads at 60%, because form leads carry more unqualified contacts."

Flight note, 6817: "The flight spends $x across n weeks, weighted by the line's seasonal index (module 12): tropical storm months (lagged for inspections and claims) for the storm line, hail months for hail, rain for leak repairs, the spring and fall shoulders for replacements. Storm rule: hold 15 to 25 percent of the monthly budget in reserve from March to May and August to October, and release it to the storm and repair groups in the footprint for 72 hours after a hail day or a named storm (module 14)."

Measurement rows, 6843: "Conversion actions": "Calls from ads of 60 seconds or more; calls from the website number (forwarding); form submits on the thank you page; chat leads; LSA leads; inspections booked; sold jobs imported from the CRM weekly as offline conversions with the contract value. Send no insurance, claim or policy details to any ad platform." "Naming": `LA_<TOKEN>_{PLATFORM}_{GEO}_{LANG}_<start>`. "UTM": `utm_source={platform}&utm_medium=cpc&utm_campaign={campaign}&utm_content={group}&utm_term={keyword}`. "Target cost per sold job": "$x (15% of the expected gross profit per job at your assumptions). Pause an ad group after 60 clicks with no qualified lead, or when cost per sold job runs above $2x for four weeks." "Lead handling": "Answer within 60 seconds during staffed hours; after hours, route to an answering service that books inspections. Ask the address, the roof's age, what the owner sees and whether a leak is active; never interpret coverage or promise what insurance will pay (R.S. 37:2159.1)." "Weather rule": "Severe thunderstorm warnings with large hail or damaging wind, and the 72 hours after a hurricane or tropical storm, move budget to the storm, hail and repair groups in the warned parishes and pause replacement ads there while the storm passes (module 14)." "Bid modifiers": "Start from the atlas tiers (A+ +30% to E −50%); after 60 to 90 days replace with observed cost per sold job by ZIP (module 15)."

"How the desk is built", 6846: "Markets. ZIPs are ranked by gross profit pool per relative click cost for the chosen lines (module 05 logic), or come from your parishes or picks, filtered by residents." "Weights. Each market's share is its efficiency to the power α, normalized." "Costs. Search platforms scale the base cost per click by the line multiplier and each market's relative cost; CPM platforms convert impressions to clicks by CTR; Local Services converts spend to leads at the stated cost per lead." "Forecast. Leads times each line's lead to sale rate give sold jobs; expected gross profit uses each line's default job value and margin (module 12)." "Pacing. The flight spreads the budget across its months by the profit weighted seasonal index of the lines in the plan." "Creative. Every asset is filled from the line's angle library with the market's city and parish, cut to the platform's limits, cleaned of hyphens and dashes, given the company name, the LSLBC license number and an office city from the Company panel, and linted by the Satchel rule pack." "Exports. One file per platform in the format its bulk tool takes, every object paused."

"Judgment calls", 6847: "The license number is automatic": "The company name, the LSLBC license number and an office city go into a description of every responsive search ad and into every social ad, rather than trusting the writer; advertising residential roofing without the license is a violation since August 1, 2026." "No claims or deductible language": "The desk never writes \"we handle your claim\", \"insurance approved\" or anything about deductibles; storm copy describes the inspection, the photos and the itemized estimate." "No \"free\" without conditions": "Free inspection offers are left out of the generated copy; add one only with its conditions stated (16 CFR Part 251)." "Financing stays generic": "\"Financing available\" is the most the desk writes; a payment, term or rate needs the Regulation Z disclosures in the same ad." "No single homes as targets": "Location targets are ZIPs and radius around office cities only; no lists of damaged homes or owners." "Spanish is additive": "Spanish campaigns run alongside English ones in qualifying ZIPs, with the license number repeated in Spanish." "Form leads close less often": "Meta and TikTok form leads are counted at half the line's lead to sale rate and video leads at 60%; replace with account data." "Default costs are assumptions": "Roofing click costs swing widely by metro and spike for weeks after a storm; replace the base after 30 days." "Paused exports": "Every exported object is paused so nothing spends before a person reviews it."

## 08.3 Louisiana specific content in module 08

| line | what | text or rule to find |
|---|---|---|
| 6615 | assumption source | "roofing terms in Louisiana metros"; "Storm weeks run several times higher." |
| 6622, 6631, 6632 to 6644 | tables keyed by the eleven line keys | `MIX0`, `SOC`, `QKW`. Louisiana strings in `QKW`: "how much does a new roof cost in louisiana", "how long does a roof last in louisiana", "roof damage after hurricane", the four hail questions, "louisiana fortify homes program", "fortified roof grant louisiana", "what is a fortified roof", "fortified roof insurance discount", "metal roof cost louisiana", the four mobile home questions. `SOC.fortified` "FORTIFIED roofs". |
| 6624 | Google playbook | "most Louisiana ZIPs"; "the LSLBC license number"; "since August 1, 2026 ... (Act 757 of 2026)"; "(R.S. 37:2159.1(7), (8); R.S. 51:451)". |
| 6625 | Local Services playbook | "the LSLBC license must be current"; "especially in storm weeks". |
| 6626 | video playbook | "storm footage must be real and labeled with place and date". |
| 6627 | Meta playbook | example key "US:70808". |
| 6646 | description | "ads with the license number built in". |
| 6648 | defaults | blend lines `replace, repair, storm, hail, fortified`; `parishes`; Spanish threshold 8. |
| 6657 | dek | "a Louisiana roofing company"; "the LSLBC license number"; "storm ad groups for a named storm". |
| 6661 | callout | "the LSLBC license number"; "$7,500 or more requires the license since August 1, 2026"; "nothing claims to handle insurance claims or deductibles". |
| 6668 to 6671 | plan fields | "Top ZIPs in selected parishes"; "Parishes (for parish scope)"; placeholder "70808, 70810, 70816"; `max="441"` on the ZIP count. |
| 6675 | storm ad group menu | the 38 named storms; "Adds storm keywords and headlines (module 02)." |
| 6695 | footer | "Uplift Louisiana Roofing Atlas". |
| 6723 | copy context | fallback city "Louisiana"; `parish` taken from `z.cty`. |
| 6729 to 6730 | group labels | "Storm · <storm>"; "Storm response · <event>"; the hail test. |
| 6734 to 6736 | mandatory line | "LSLBC license ..."; "Licencia LSLBC ...". |
| 6743 to 6746 | headlines | hurricane and tropical storm names; "Emergency Roof Tarps"; hail headlines; "Louisiana Roofing Company"; "Licensed Louisiana Roofer"; "Permitted and Inspected Work"; "Roofing in {Parish} Parish"; "Serving {Parish} Parish". |
| 6749, 6751 | descriptions | "Storm damage from <storm>?"; "Louisiana <line> from a licensed local roofer"; "Techador con licencia en Luisiana". |
| 6760, 6763 | social copy | "toda Luisiana"; "A licensed Louisiana roofer"; "Licensed Louisiana roofer". |
| 6773 | warning | "LSLBC license number (required to advertise residential roofing of $7,500 or more)". |
| 6817 | flight note | "tropical storm months"; "hail months"; "from March to May and August to October"; "after a hail day or a named storm". |
| 6826 | video script | tarp and hail lines; "the LSLBC license number". |
| 6827 | Local Services sheet | "LSLBC license · classification"; "across {Parish} Parish and Louisiana"; "Licensed by the LSLBC". |
| 6831 to 6832 | storm keywords | hurricane and tropical storm names; hail keywords; "emergency roof tarp". |
| 6843 | measurement | prefix "LA_"; "(R.S. 37:2159.1)"; "the 72 hours after a hurricane or tropical storm"; "storm, hail and repair groups in the warned parishes". |
| 6846, 6847 | method and judgment | "city and parish"; "the LSLBC license number"; "since August 1, 2026"; "spike for weeks after a storm". |
| 6850 | campaign name | prefix "LA_". |
| 6853 | landing slugs | "<storm> roof repair", "hail damage roof repair", "storm damage roof repair". |
| 6858 | Google location | "<zip>, Louisiana, United States". |
| 6860 | callouts | "Licensed Louisiana Roofer". |
| 6872 | Local Services export | "LSLBC license number"; "LSLBC license, general liability insurance certificate, ...". |
| 6873 | social export | ", Louisiana" after the city list. |
| 6879 | plan export | column `parish`. |
| 6892 | receive | a storm payload switches the line to `storm` unless it is `storm`, `repair` or `hail`. |
| 1209 to 1350 (helper, printed here) | angles and keywords | in the two tables above: "Licensed Louisiana roofer", "Most Louisiana shingle roofs wear out near 20 years", "Every reroof in Louisiana needs a permit and inspections", "Check our LSLBC license before you sign", "licencia en Luisiana", "Louisiana law requires a good faith itemized estimate", the whole FORTIFIED set ("Louisiana Fortify Homes grant of up to $10,000", "Many Louisiana insurers file FORTIFIED discounts", "subvención de hasta $10,000 del programa Fortify Homes"), "A Roof Built for Louisiana", "Hurricane Rated Roof Systems", "the Louisiana building code", the hail set, "hurricane roof damage", "blue tarp roof", "louisiana fortify homes program", "fortified roof louisiana", "subvencion techo luisiana". |
| 1354 (helper) | common negatives | the neighbouring states "texas", "mississippi", "arkansas", "alabama", "florida". |
| 1359 (helper) | `fillCopy` fallbacks | "Louisiana", "LSLBC license number". |
| 1376 to 1431 (helper, printed at 6845) | rule pack | every rule in the table above whose family is LSLBC, Insurance claims, Louisiana law or FORTIFIED, and the Louisiana citations inside the truth in advertising, storm response and FTC rules (R.S. 51:1405, 45:844.11, 37:2150.1, 14:202.1). GADS2 exempts the words "FORTIFIED" and "LSLBC" from the all capitals test (1407); HOUSE2 treats "LSLBC license number" as an unfilled placeholder (1409). |

## 08.4 What a California edition of module 08 needs

The Desk's machinery (market choice, mix, forecast, pacing, ad assembly, lint, exports) is state neutral. Its inputs and its words are not.

Inputs with an obvious California equivalent:

| Louisiana input | California equivalent |
|---|---|
| ZIP columns `pop`, `cpc_rel`, `span_sh`, `p_<line>`, `tier`, `bid`, `res_ok` | same columns from the California build. |
| `gid` (Google location criterion ID per ZIP, 453 of 534 present) | the same Google geotarget table lists California ZIPs; the location string becomes "<zip>, California, United States" (6858) and the social locations ", California" (6873). |
| `BRAND.lic` printed as "LSLBC license <number>" in every ad | "CSLB license <number>" (the usual form adds the "#"). California's own rule that the licence number appears in all advertising (to verify, see module 03) makes this feature more central, not less. `BRAND.licClass` would hold "C-39". |
| `SLM` assumptions, seasonal curves | same structure, re based. |
| Campaign prefix "LA_" (6843, 6850) | "CA_". Note the Louisiana prefix would read as Los Angeles in a California account; a longer state token avoids confusion. |
| Platform assumptions `ASM0`, mix `MIX0` | same tables; the $38 click and $90 lead are Louisiana guesses. |
| Federal rules in the lint (FTC, Regulation Z, TCPA, platform policies) | unchanged. |

Inputs with no California equivalent, and replacements:

| Louisiana input | replacement |
|---|---|
| Storm ad group built from `routes` (hurricane and tropical storm names, `stormKind`, roofs damaged) | An event ad group built from the California event table of module 02: a named wildfire, a wind event or an atmospheric river, each with its own headline, keyword and landing slug templates (rebuild and smoke damage after a fire; wind damage and tarps; leak repair after heavy rain). The `event` path (6730, 6744, 6832) only knows "hail" and "storm". |
| Lines `hail` and `fortified` in defaults, `MIX0`, `SOC`, `QKW`, video script and `receive` | whatever the California line set is; every table keyed by line key must be re keyed together with `LINE_KEYS`, `PL` and `META.model`. |
| Rule families LSLBC, Insurance claims, Louisiana law, FORTIFIED in `SAT` | a California pack: licence number missing from an ad; "bonded" claims (to verify); home improvement salesperson registration for door to door; down payment wording; price gouging after a declared emergency; wildfire claims such as "fireproof roof"; Class A and cool roof rating claims; grant and insurance discount promises under the wildfire programs. Whether the claim handling and deductible blocks have any California basis must be settled by the register first (module 03, rows 5 to 7); the Desk's judgment call "No claims or deductible language" can stay as a house rule even if the law does not require it. |
| The reserve rule "March to May and August to October" and the "Weather rule" (6817, 6843) | California seasons: a rain reserve for November to March and a wind and fire reserve for late summer to December, tied to red flag and high wind warnings rather than severe thunderstorm warnings. |

Details to change in code: `max="441"` on the ZIP count (6671); the Spanish threshold default of 8 percent (6648), which only 44 of 441 Louisiana ZIPs reach but most California ZIPs would, so the Spanish campaign's fixed 25 percent budget share (6856) and the "es" market list need rethinking; one Spanish variant only, where California may want other languages; "{Parish} Parish" in two headlines and the Local Services bio; the parish selector; `resPlan()` (the `'comm'` against `'com'` mismatch); the stored `bid` being the all lines tier; the two separate copies of the base click cost (`SLM.A.cpc` and `P.asm.google.cost`), which can drift apart.

---

# Part Z. Cross cutting notes for the California rebuild

## Z1. Louisiana strings that repeat in every module (global replacements)

| string or pattern | where | California form |
|---|---|---|
| "Uplift Louisiana Roofing Atlas" | every footer and CSV note (5236, 5245, 5719, 5731, 5732, 5903, 5904, 6082, 6084, 6271, 6282, 6283, 6449, 6451, 6452, 6593, 6598, 6695) | new product name |
| "Parish", "parish", "parishes", "All 64 parishes", "64 parishes" | menus, tooltips, table headers, pills, CSV columns in modules 01, 02, 05, 06, 07, 08; `parishTip` (993); `{Parish} Parish` in ad copy | "County", "All 58 counties"; the data key `parishes` and the names `PA`, `PAI`, `PNAME` can stay as code names |
| "All nine regions" | 5080, 5364, 6121 | the California region count; `META.model.REG`, `P2R`, `DMA` and `REG_MKT` (6097) must be rebuilt together |
| "Louisiana" as the name of the statewide view | 5372, 5384 area, 5423, 5551, 6190, 6340, 6384 | "California" |
| File names starting `louisiana-` | 5245, 5640, 5731, 5732, 5904, 6084, 6085, 6282, 6283, 6451, 6452, 6598 | `california-` |
| "October 6, 2026" typed as a literal | 5072, 5236, 5778, 5780, 5903, 5904, 6271, 6477, 6481, 6583, 6589, 6593 (modules 02, 04, 06 use `META.compiled`) | use `META.compiled` everywhere |
| "LSLBC" | modules 01, 03, 04, 06, 07, 08 and the helpers | "CSLB" |
| "FEMA roof and wind registrations" | modules 01, 02, 04, 06 | redefine or replace the measure |
| Hurricane vocabulary (hurricane force, tropical storm, Category n, landfall, HURDAT2, NHC) | modules 01, 02, 04, 05, 06, 07, 08 | the California event vocabulary of module 02 |
| "hail" and "tornado" as first rank hazards | modules 01, 02, 04, 06, 08 | demoted |
| "FORTIFIED", "Fortify Homes", "Restore ROOF" | modules 01, 02, 03, 04, 08 and the helpers | the wildfire hardening equivalents, once verified |
| `America/Chicago`, "Central", "CST", `hour_cst` | 5311, 5329, 5431, 5633, 5634, 5640, 5732 | `America/Los_Angeles`, "Pacific", "PST" |
| Example ZIPs and towns in placeholders | 5082, 6627, 6670 | California examples |
| Campaign prefix "LA_" and ", Louisiana, United States" | 6843, 6850, 6858, 6873 | California forms |
| Map helpers outside my range that every map here uses | `MAP_CITIES` keep list of 77 Louisiana towns (871); `geo.neighbors` Texas, Arkansas, Mississippi; map aria label "Map of Louisiana ZIP codes" (882); brand defaults `juris: 'Louisiana'`, `state: 'LA'`, 30.4515, -91.1871 (776 to 777) | California lists and defaults |

## Z2. Everything keyed on the eleven service line keys inside lines 4987 to 6900

Changing the line set (`replace, repair, storm, hail, fortified, metal, mh, mf, comm, coat, newc`) touches, besides `LINE_KEYS`, `PL`, `SLM` and `META.model`: module 01 `P0.storm` (5109) and `corr.replace.repair`, `corr.storm.replace`, `corr.hail.storm` (5199); module 02 `SF[..].line` (unused); module 04 `pools.storm + pools.hail` (6016) and the four season lines (6044); module 05 the "Storm lines only" preset (6276); module 06 the four city job columns (6428); module 08 `MIX0`, `SOC`, `QKW`, the default blend (6648), the script and keyword branches on `storm` and `hail` (6730, 6744, 6826, 6832, 6853) and `receive` (6892).

## Z3. Numbers typed into text that happen to match today's data

5042 "267"; 5712 "hail (1,198), thunderstorm wind (3,174) and tornado (743)"; 5707 "86 percent ... (705 and 706)"; 6069 and 6314 "152 against 267"; 6078 "950 records"; 6330 and 6442 "18 disasters"; 6434 and 6567 "18 parishes"; 6570 "more than Baton Rouge, Metairie, New Orleans and Shreveport combined"; 6671 `max="441"`; 6116 and 6257 "New Orleans 1.00 ... Northeast 0.62"; 5213 "$15,500 ... $85,000 ... 33 percent"; 5211 "two roofs per registration before 2020, 3.6 since". Each must be regenerated or computed.

## Z4. Defects and oddities found while reading (worth fixing rather than copying)

1. `resPlan()` at 6719 compares `seg` with `'comm'`; the service line table uses `'com'`, so every plan counts as residential.
2. Module 01's tile says "124k since 2020" (ZIP column `fema_20`), module 06's says "126k since 2020" (parish records). Two roll ups of one measure.
3. Stored `tier`, `bid`, `quad` (all lines, default assumptions) are shown in modules 01 and 08 while module 05 recomputes them for the chosen lines and current assumptions; the Desk's bid modifier therefore ignores the plan's line.
4. `routes[].est`, `n34`, `n50`, `hu50`, `hu64` are stored but module 02 recomputes them; the two differ slightly in 30 of 38 storms.
5. Unused data and code: `hosp` (161 records) and `meta.nhosp`; `rlist`; `ts.dowhour`; flags `hurr` and `trop`; `LAWLINK`; `addYears`; `YEARS_F`; `SF[..].line`. The company name clean up at 6467 strips law firm suffixes (APLC, PLC, LLP). These look like leftovers from an atlas for another trade.
6. Module 04 calls `gammaFn`, defined in module 17 (9385); modules 05 and 07 call `LINE_TIER`, `TIER_BID`, `LINE_FIRMS`, defined in module 12 (8242 to 8253). They work only because modules mount lazily after all scripts have loaded.
7. Module 06 drives modules 01 and 02 by writing into their parish menus (`#i1Par`, `#s2Par`) and firing change events (6410 to 6411).
8. Two copies of the base cost per click: `SLM.A.cpc` (module 05) and `P.asm.google.cost` (module 08), both 38 by default, edited separately.
9. The file has 9,661 lines, not 9,667. Another agent's work files share the folder `ca_work`; mine are in `ca_m01_08_work`.

## Z5. What I checked and what I did not

Checked against `la_atlas_data.json`: every relation listed at the end of Part A; the report flag definitions; ZIP and parish report counts against `pts`; the headline figures quoted for each module (recomputed in Python, not rendered in a browser); the three regressions of module 04; the seasonal peaks; the default Desk forecast.

Not checked: how the build pipeline produced the columns beyond what the texts say (there is no build script in the file); the truth of any Louisiana legal statement; any California statement (all from memory, flagged as leads); the modules outside lines 4987 to 6900 except the helper definitions cited.
