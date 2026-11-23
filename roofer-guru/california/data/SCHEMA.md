# California Roofer Guru: data schema (`window.__ATLAS_DATA__`)

Second issue, 2026-11-23, by the data build (CA/data). It describes the file as built: `CA/data/out/ca_atlas_data.json`
(5.5 MB at this issue; `out/build_report.md` has sizes and the 128 checks; `out/ca_zip_index.json` has the ZIP row order,
the county order and the map constants). First issue 2026-11-19.
This file is the contract for everyone rewriting page modules. A dated change list is at the end:
read it if you come back to this file.

Status words used below. **kept**: same name and same meaning as Louisiana (`la_atlas_data.json`).
**kept, new meaning**: same name (the page's code reads it) but the content differs: read the note.
**renamed**: Louisiana name gone, new name given. **dropped**: not in the California file.
**new**: California only. **hazard job**: the column or key is written by the hazard data job
(CA/data/hazard/out, described in its HAZARD_SCHEMA.md) and merged in by this build; its names are
final only when that file exists (see section 4).

## 0. Decisions that touch every module

1. **`parishes` and `pi` keep their names.** `DATA.parishes` holds the 58 counties (array order is the
   county index), and the ZIP column `pi` is the index into it. The readers are too many to rename
   safely in one pass (core 571 to 580 `PA`, `PAI`, `PNAME`, `z.fips`, `z.cty`; map 904, 930, 993; every
   module's county menu, `pts[].pi`, `cities[].pi`). In code a county is "a parish"; on screen it must
   say County. `CNAME`, `CO`, `COI` aliases already exist in core. `geo.parish` and `geo.pcent` also keep
   their names (county shapes and county label points by FIPS `06001` to `06115`).
2. **Regions are numbers 1 to 11** (the page converts `META.model.REG` keys with `Number`). The order is
   DESIGN.md's: 1 North Coast (`nc`), 2 Far North (`fn`), 3 Sacramento Valley (`sv`), 4 Sierra (`si`),
   5 Bay Area (`ba`), 6 Central Coast (`cc`), 7 San Joaquin Valley (`sj`), 8 Los Angeles and Ventura
   (`la`), 9 Orange County (`oc`), 10 Inland Empire (`ie`), 11 San Diego and Imperial (`sd`).
   `META.model.REG` = number to name; `META.model.REGK` = number to the two letter key (new);
   `META.model.P2R` = county FIPS to region number.
3. **Thirteen service lines**, in this order everywhere a list is ordered (columns, `META.pools`,
   `corr`): `replace, repair, storm, fire, harden, tile, solar, metal, mh, mf, comm, coat, newc`.
   `hail` and `fortified` do not exist. Residential lines: the first nine. Commercial: `mf, comm, coat, newc`.
4. **No hurricane data.** The nine hurricane ZIP columns are dropped (section 2, group G). The keys
   `seg`, `routes`, `rlist`, `sids`, `zstorm` ship as empty (`[]`, `[]`, `[]`, `[]`, `{}`) so a reader not yet
   removed does not throw; nothing may be drawn from them. `hosp` and `meta.nhosp` are dropped (never read).
5. **Map units.** `geo.W` is 4800 (Louisiana: 2400), because California at 2400 would give 380 m per
   unit and city ZIPs of three units. At 4800 one unit is about 197 m (Louisiana: 212 m). Constants in
   `02_map.js` written in view box units for W = 2400 must be multiplied by `geo.u` (= 2, new field):
   label collision box 70/95/30 (line 874), `fitBox` pads 90, 140, 120, 80 (lines 925 to 969).
6. **Rows.** One row per populated California ZCTA (2020 ZCTAs, ACS 2020-2024): a ZCTA is in when its
   largest land share is in California and ACS B01003 shows one resident or more: **1,762 rows**
   (1,531 scored). Out: 5 ZCTAs that are mostly Nevada or Oregon, 40 with no residents, and 97635 (an
   Oregon post office whose ZCTA lies mostly in Modoc County, 239 residents: the page's ZIP pattern
   `9[0-6]ddd` cannot match it). Model columns (`r_`, `z_`, `idx` and what follows from them) are
   null where `res_ok` = 0 (fewer than 500 residents), as in Louisiana.
7. **Years.** Model year 2026 ("now"); roof model runs 1905 to 2026; ACS 2020-2024; Business Patterns
   2023; FAIR Plan year-ends 2022-09-30 to 2026-09-30; CDI non-renewals to 2023; CSLB November 2026.

## 1. Top-level keys

| key | status | shape | what it is |
|---|---|---|---|
| `zcols`, `zrows` | kept | names; one array per ZIP | the ZIP table, section 2 |
| `parishes` | kept, new meaning | 58 objects, FIPS order | counties, section 3 |
| `cities` | kept | objects, unique `name` | postal cities of 1,500 residents or more, section 5 |
| `places` | kept | `{name, lat, lon, pop, cdp, seat, pi}` | Census places for map labels (all 498 places of 10,000 or more, plus every county seat: 515); section 5 |
| `geo` | kept, extended | section 6 | map geometry |
| `seg`, `routes`, `rlist`, `sids`, `zstorm` | kept empty | `[]`, `[]`, `[]`, `[]`, `{}` | hurricane structures: empty, readers to be removed |
| `pts`, `ptflags`, `ptkinds` | hazard job | section 4 | located weather reports; `[]` until `hazard_pts.json` exists |
| `hz` | hazard job | section 4 | the event ledger (`hazard_events.json`: fires, `zfire`, `zdins`, atmospheric rivers, wind events); absent until that file exists |
| `ts` | shared | section 7 | time series: hazard job owns the weather and fire series, this build owns `fema_year`, `replace_hist`, `ppi`, `permits`, `ytd26`, `ytd25`, `agehist` |
| `agez` | kept | ZIP -> 41 counts | one unit roofs by age 0 to 39 and 40+, 2026 (age of the covering; for tile roofs the age of the underlayment) |
| `agez_t` | new | ZIP -> 41 counts | the tile part of `agez` (tile roofs by underlayment age); `agez - agez_t` is every other covering |
| `rhist` | kept, new meaning | ZIP -> 27 pairs | 2000 to 2026 `[age driven replacements incl. tile relays, wildfire rebuild roofs]` |
| `hosp` | dropped | | never read |
| `comp` | kept, limited | section 8 | named roofing companies with public evidence only |
| `lic_city` | new | `[[city, county index, active C-39 licences, all C-39], ...]` | CSLB C-39 by mailing city, every city with one or more |
| `ins` | new | section 9 | insurance rollups by county, region, state and year |
| `fema` | new | section 9 | FEMA disasters with California household registrations |
| `permits_city` | new | section 9 | re-roof permit counts by year for cities with open data |
| `relief` | new, optional | | NOT BUILT: `null`. (The Scout tab gets terrain separately.) |
| `meta` | kept, extended | section 10 | totals, model constants, sources |

## 2. ZIP columns

Order in `zcols` is the order of the groups below, top to bottom. Read columns by name, never by number.
Units: counts are homes or people unless said; `_sh` columns are percent 0 to 100, one decimal.

### A. Identity and place

| column | status | meaning, unit | source and formula |
|---|---|---|---|
| `zip` | kept | 5 character ZCTA code; key of `geo.zcta`, `agez`, `rhist` | Census 2020 ZCTA |
| `city` | kept | postal city name, title case (never null in California) | ZIP Code Business Patterns 2023 `city`; GeoNames postal file where missing |
| `pi` | kept, new meaning | index of the ZIP's county in `parishes` (0 to 57) | Census 2020 ZCTA to county file: county with the largest land share |
| `reg` | kept | region number 1 to 11 = `parishes[pi].reg` | DESIGN.md region list |
| `lat`, `lon` | kept | internal point of the ZCTA, degrees | Census Gazetteer 2025 |
| `sqmi`, `wsqmi` | kept | land and water area, square miles | Census Gazetteer 2025 |
| `gid` | kept | Google Ads location criterion ID of the postal code; null when Google lists none | Google Ads API geotargets file (see change list for the file date; null everywhere if the file could not be reached) |
| `place` | new | largest Census place by land share, name without "city"/"CDP"; null when the ZIP is mostly outside any place | Census 2020 ZCTA to place file |
| `ncty` | new | number of counties the ZCTA touches (1 to 4) | same county file |
| `cz` | new (third issue) | Title 24 building climate zone, 1 to 16; null where the list has no row for the ZIP | California Energy Commission, "Building Climate Zones by ZIP Code" (Energy Code Reference Joint Appendix JA2), the file the topography job fetched 2026-11-19 (`CA/scout/topo/dl/cec/zip.xlsx`, copied to `CA/data/dl/cec/zip.xlsx`). Grade A for the zone; a ZCTA is treated as the postal ZIP of the same number |

### B. People (ACS 2020-2024 five-year, by ZCTA)

| column | status | meaning | formula |
|---|---|---|---|
| `pop` | kept | residents | B01003_001 |
| `hh` | kept | households (= occupied homes) | B11001_001 |
| `inc` | kept | median household income, $; null where not published | B19013_001 |
| `value` | kept | median home value, $; null where not published | B25077_001 |
| `own_sh` | kept | owner occupied, % of occupied homes | B25003_002 / _001 |
| `sfd_sh` | kept | one unit detached, % of homes | B25024_002 / _001 |
| `mf5_sh` | kept | homes in buildings of 5+ units, % | B25024_006.._009 / _001 |
| `span_sh`, `span_lep_sh` | kept | speak Spanish at home; and with limited English: % of residents 5 and over | C16001_003, _005 / _001 |
| `viet_sh` | kept | speak Vietnamese at home, % | C16001_024 / _001 |
| `french_sh` | dropped | (French and Cajun: a Louisiana column) | |
| `chin_sh` | new | speak Chinese (incl. Mandarin, Cantonese) at home, % | C16001_021 / _001 |
| `tagalog_sh` | new | speak Tagalog (incl. Filipino), % | C16001_027 / _001 |
| `korean_sh` | new | speak Korean, % | C16001_018 / _001 |
| `arabic_sh` | new | speak Arabic, % | C16001_033 / _001 |
| `slavic_sh` | new | speak Russian, Polish or another Slavic language, % | C16001_012 / _001 |
| `oie_sh` | new | speak another Indo-European language, % (the published stand-in for Armenian and Persian: Glendale 91201 is 50%) | C16001_015 / _001 |
| `chin_lep_sh`, `viet_lep_sh`, `korean_lep_sh`, `tagalog_lep_sh` | new | speakers of that language with limited English, % of residents 5 and over | C16001_023, _026, _020, _029 / _001 |
| `lep_sh` | new | residents 5+ who speak English less than very well, any language, % | C16001 sum of the "less than very well" lines / _001 |
| `lang2` | new | the largest non-English, non-Spanish language group in the ZIP: one of `chin, viet, tagalog, korean, arabic, slavic, oie`, or null when none reaches 3% | from the columns above |
| `anc_arm`, `anc_iran` | new | residents reporting Armenian, Iranian ancestry, count (Armenian and Persian speakers are not published by ZIP) | B04006_016, _048 |
| `hisp_sh`, `asian_sh` | new | Hispanic or Latino; Asian alone not Hispanic: % of residents | B03002_012, _006 / _001 |
| `hh100k_sh` | kept | households earning $100,000+, % | B19001_014.._017 / _001 |
| `hh200k_sh` | new | households earning $200,000+, % | B19001_017 / _001 |
| `s65_sh` | kept | residents 65+, % | B01001 |
| `age_med` | new | median age, years | B01002_001 |
| `density` | kept | residents per square mile of land | pop / sqmi |

### C. Homes (ACS 2020-2024)

| column | status | meaning | formula |
|---|---|---|---|
| `hu`, `occ` | kept | housing units; occupied homes (`occ` = `hh`) | B25001_001; B25003_001 |
| `vac_sh` | kept | vacant, % of homes | B25002_003 / _001 |
| `seas` | kept | seasonal and recreational homes (cabins, second homes), count | B25004_006 |
| `u1` | kept | one unit homes, detached + attached | B25024_002 + _003 |
| `u1a` | new | one unit attached homes (townhomes) | B25024_003 |
| `mh`, `mh_sh` | kept | mobile homes, count and % of homes | B25024_010 |
| `mf24`, `mf5u` | kept | homes in 2 to 4 unit buildings; in 5+ unit buildings | B25024_004+005; _006.._009 |
| `mf5_9`, `mf10_19`, `mf20_49`, `mf50` | new | homes in buildings of 5 to 9, 10 to 19, 20 to 49, 50+ units (the `mf` line's building count comes from these) | B25024_006, _007, _008, _009 |
| `mfb` | new | estimated buildings of 5+ units = mf5_9/7 + mf10_19/14 + mf20_49/30 + mf50/80 | Louisiana's stated recipe |
| `yb_med` | kept | median year built | B25035_001 |
| `rooms` | kept | median rooms | B25018_001 |
| `mort_sh` | kept | owners with a mortgage, % | B25081_002 / _001 |
| `pre80_sh` | kept | built before 1980, % | B25034_007.._011 / _001 |
| `yb20, yb10, yb00, yb90, yb80, yb70, yb60, yb50, yb40, ybold` | kept | homes by decade built (2020 or later ... 1939 or earlier), all structure types | B25034_002.._011 |
| `o20, o10, o00, o90, o80, o70, o60, o50, o40, oold` | new | ONE UNIT homes by decade built: the roof model's cohorts, shipped so the model can be rerun in the page | B25127 (tenure x year built x units; six year bands for one unit homes) split into decades in proportion to B25034 inside each band, then scaled so the ten sum to `u1` |
| `rent1` | new | renter occupied one unit homes (single family rentals), count | B25032 renter 1 detached + 1 attached |
| `val1m_sh` | new | owner homes valued $1,000,000 or more, % of owner homes | B25075_025.._027 / _001 |
| `hhsize` | new | average household size | B25010_001 |
| `moved10_sh` | new | households that moved in 2010 or later, % (owners and renters) | B25038 (_003.._005 + _010.._012) / _001 |
| `own_yr` | new | median year owners moved in | B25039_002 |

### D. Roof stock (the cohort model, section 11; grade B for age, D for material)

| column | status | meaning | formula |
|---|---|---|---|
| `roofs` | kept | one unit roofs, count (= sum of `agez[zip]`; = `u1` to rounding, less homes destroyed by fire in 2024 and 2025 and not yet rebuilt) | model |
| `ra_med` | kept | median roof age, years | first age where cumulative `agez` reaches half |
| `ra15`, `ra20` | kept | roofs 15+ and 20+ years old | sums of `agez` |
| `ra15_sh`, `ra20_sh` | kept | the same, % of `roofs` | |
| `ra25`, `ra25_sh` | new | roofs 25+ years old, count and % (California roofs run older than Louisiana's; 25 is where tile underlayment is due) | sums of `agez` |
| `wave` | kept | roofs aged 15 to 19 = `ra15 - ra20` | |
| `nxt` | kept, new meaning | age driven replacements expected in the next twelve months on one to four unit homes, every covering EXCEPT tile relays: sum of `(agez - agez_t)[a] x h(a)`, plus `mf24` at 0.354 roof per home with the ZIP's mean hazard | model |
| `nxt_t` | new | tile underlayment jobs (lift and relay) expected in the next twelve months = sum of `agez_t[a] x h_t(a)` | model |
| `tile_sh` | new | tile roofs (clay and concrete), % of one unit roofs, modeled | RECS 2020 California shares by era built (6.8% before 1960, 17.4% 1960-79, 43.0% 1980-99, 62.2% 2000 on) applied to `o*`, times a climate factor by region (hot dry 1.13, marine and mountain 0.67), rescaled to 27.4% statewide |
| `tile_n` | new | tile roofs, count = `roofs x tile_sh / 100` | |
| `tile25` | new | tile roofs whose underlayment is 25 years or older, count | sum of `agez_t[25..40]` |
| `wood_sh` | new | wood shake or shingle roofs, % of one unit roofs, modeled | RECS 2020 by era (8.5, 3.1, 5.6, 3.0%), rescaled to 5.4% statewide; no local data |
| `metal_sh` | kept, new meaning | metal share of residential reroofs, % (assumption: 4% statewide against 2.2% of today's stock; 1.6 times under 300 residents per square mile, 0.6 times over 1,500; 1.5 times where 25% or more of homes are in a High or Very High fire zone or snow country) | assumption, grade D |
| `solar_n` | new | one unit homes with rooftop solar, count | California Distributed Generation Statistics, interconnection applications to 2026-09-30 (PG&E, SCE, SDG&E): interconnected residential photovoltaic sites, not decommissioned, distinct sites. Where a city or district utility serves the ZIP (338 ZIPs: Los Angeles DWP, SMUD and others) the file has nothing: the ZIP takes its county's share from covered ZIPs or the older Google Project Sunroof count, whichever is larger |
| `solar_sh` | new | `solar_n / u1 x 100`, capped at 80 | |
| `solar_src` | new | `nem` (counted) or `est` (estimated as above) | |
| `solar_new` | new | of the counted sites, those approved in 2020 or later | same file |
| `solar_batt` | new | counted sites with battery storage | same file |
| `lastfire` | renamed from `last64` | most recent year a wildfire destroyed or damaged structures in the ZIP (CAL FIRE damage inspections 2013 to 2025); null when none on record | hazard job (this build's own count until its file exists) |
| `yrsfire` | renamed from `yrs64` | `2026 - lastfire` | |
| `fire_dest`, `fire_dmg` | new | structures destroyed, and damaged, in the ZIP in CAL FIRE damage inspections 2013 to 2025 | hazard job (own point in polygon count until then) |
| `fire_res` | new, temporary | residences destroyed (this build's count). Dropped when the hazard job's `fire_dest_res` is present | |
| `fire_nxt` | new | wildfire rebuild and repair roofs expected in the next twelve months: 40% of residences destroyed in 2022 to 2025, a quarter each year, plus half of the residences damaged in 2025 | model, grade D |

### E. Hazard columns (hazard job; merged by this build)

Every ZIP column that `CA/data/hazard/HAZARD_SCHEMA.md` section 1 declares is carried under the name given
there, with that file's meaning, unit and grade: atmospheric rivers (`ar_n`, `ar_d`, `ar1d`..`ar5d`, `ar_days`,
`ar3_d`, `ar3_n`, `ar45_dec`, `ar_max`, ...), rain (`rain_in`, `rain_d1`, `rain_d2`, `rain_rec_in`, ...), wind (`g40`,
`g58`, `g75`, `gust_max`, `wd58`, `wd75`, `hw_yr`, `sa_ep`, `di_ep`, `su_ep`, `off_kind`, `off_cls`, `asce_wind`, ...),
wildfire (`fhsz_vh`, `fhsz_high`, `fhsz_mod`, `fhsz_sh`, `fhsz_any`, `fire_n`, `fire_big`, `burn_sh`, `fire_km`,
`fire_dest`, `fire_dmg`, `fire_dest_res`, `fire_dmg_res`, `fire_insp`, `lastfire`, `fire_worst`, ...), snow (`snow_psf`,
...), heat (`h90`, `h100`, `h110`, `tjul`, ...), hail and thunderstorm counts (`hd1`, `hail_n25`, ...), coast
(`coast_km`, `salt_cls`, `marine_cls`), elevation, and the stress scores (`st_*`, `stress`, `st_top`).
HAZARD_SCHEMA.md is the record for those columns; this file does not repeat it. Three rules of the merge:

- The hazard job's `lat`, `lon` (its "town point") are carried as **`tlat`, `tlon`**. `lat`, `lon` stay the Census
  internal point (group A).
- Its identity columns (`zip`, `fips`, `county`, `reg`, `in_ca`) are not carried: use `zip`, `pi`, `reg` of group A.
- Where it and this build both have a column (`fire_dest`, `fire_dmg`, `lastfire`, `yrsfire`), the hazard job's value is shipped.

The list actually shipped is in `meta.hazard.cols`, and `meta.hazard.src` says where it came from.
**State at this issue:** `out/zcta_hazard.json` did not exist yet, so the columns come from the hazard job's work
tables (`zcta_station`, `zcta_ar`, `zcta_fire`, `zcta_wind`, `zcta_base`): 95 columns, only names its schema declares.
Columns from its later steps (snow, hail, the stress scores, `ar_days`, `zone`) are not in the file yet. Rerunning
`bash build_all.sh 3` after the hazard job finishes carries its whole final table.
Louisiana's `hd1` survives only as the hazard job's column; `hd175, hd2, hd1_10, wd50, wd65, td1, ev_h1, ev_h175,
ev_w58, ev_w75, ev_t, ev_dmg` are dropped unless that job writes them.

### F. FEMA (OpenFEMA Individuals and Households Program, read 2026-11-18)

"Roof or property registrations" below means: registrations with the roof damage flag (disasters to
2018), or with verified real property loss and no flood damage (disasters from 2020: the roof flag is
empty from 2020 on). The COVID-19 declaration (4482) is left out everywhere.

| column | status | meaning |
|---|---|---|
| `fema_k` | kept, new meaning | roof or property registrations at the ZIP, all 20 disasters 2003 to 2025 (fire, storm, flood, earthquake) |
| `fema_20` | kept | the same, disasters declared 2020 or later |
| `fema_rate` | kept | `fema_k / occ x 100` |
| `fema_fire` | new | the same measure, fire disasters only |
| `fema_storm` | new | the same, severe storm, flood and winter storm disasters only |
| `fema_quake` | new | the same, earthquake disasters (San Simeon 2003, Napa 2014) |
| `fema_dest` | new | homes FEMA recorded as destroyed, all disasters |
| `fema_reg` | new | all household registrations at the ZIP (any damage or none), all disasters except 4482 |
| `fema_la25` | new (takes the place of `fema_ida`) | all registrations, DR 4856, the January 2025 Los Angeles wildfires and winds |
| `fema_w23` | new (takes the place of `fema_laura`) | roof or property registrations, the 2023 winter storm disasters (DR 4683, 4699, 4707) |
| `fema_ida`, `fema_laura` | dropped | |

### G. Dropped hurricane columns

`last64`, `yrs64` (renamed, see D), `hur64`, `hur50`, `ts34`, `n64_00`, `n50_00`, `vmax_00`, `vmax_20`: dropped.
Readers named by the contracts: module 01 layers 5005, 5014 to 5016 and notes 5159, 5173, 5178, 5179;
module 02 5448, 5573, 5576; module 04 predictor 5958 and filter 5956; module 12 `lineRows` 8342, 8344;
module 17 9488, 9493 and the `STORMY` table 9520; module 09 fact registry.

### H. Business (ZIP Code Business Patterns 2023; postal ZIPs that are not ZCTAs are left out of ZIP rows and counted in county totals)

| column | status | meaning (NAICS) |
|---|---|---|
| `est` | kept | all establishments |
| `retail, food, lodging, whse, mfg, church, health, school, apts, nonres, office, auto` | kept | 44-45; 722; 721; 493; 31-33; 8131; 62; 61; 531110; 531120; 52+54+55; 441 |
| `roofers` | kept | roofing contractors 238160 (cells under 3 withheld, so small towns read 0) |
| `builders` | kept | sum of the published six digit 236xxx rows |
| `supply` | kept | roofing, siding and insulation wholesalers 423330 |
| `ins_agents`, `adjusters` | kept | 524210; 524291 |
| `solar_co` | new | electrical contractors 238210 (the trade that holds most solar installers; not solar alone) |
| `pm` | new | residential property managers 531311 |
| `cru` | kept | commercial roofs, estimate: establishments weighted by building type (0.15 each, plus 0.85 plants, 0.80 warehouses, 0.55 retail, 0.25 offices, 1.0 churches, 0.6 schools, 0.5 lodging, 0.3 health, 0.4 auto, 0.3 food), scaled to the state anchor `META.model.ANCH.cru` (CBECS 2018 national building count x California's share of US residents) |
| `lic` | kept, new meaning | CSLB C-39 Roofing licences, active and unsuspended (status CLEAR), whose mailing ZIP is this ZIP. A whole number: Louisiana's was a city count split across ZIPs |
| `lic_all` | new | the same, all C-39 on the renewed roll including suspended |

### I. Insurance (new: California Department of Insurance and California FAIR Plan Association)

| column | meaning | source |
|---|---|---|
| `fair_pif` | FAIR Plan residential (dwelling) policies in force, 2026-09-30 | CFP five year ZIP file, DWE |
| `fair_pif22` | the same at 2022-09-30 | same |
| `fair_x` | growth multiple `fair_pif / fair_pif22` (null when the 2022 count is under 10) | |
| `fair_sh` | FAIR Plan residential policies per 100 housing units, 2026 (`fair_pif / hu x 100`, capped at 100) | |
| `fair_tiv` | FAIR Plan residential exposure (total insured value), $ million, 2026-09-30 | CFP TIV ZIP file |
| `fair_com` | FAIR Plan commercial policies in force, 2026-09-30 | CFP COM file |
| `fair_hi` | FAIR Plan residential policies the Plan classes as high wildfire risk | CFP policies by category |
| `fair_own` | FAIR Plan policies on owner occupied single family homes (all risk classes) | same |
| `fair_dist` | 1 when the Plan flags the ZIP as a distressed area, else 0 | same |
| `fair22_sh` | FAIR Plan share of insured dwelling units in 2022, % (the Department's own share) | CDI FAIR vs voluntary 2022 |
| `ins_pol` | voluntary market residential policies, 2023 (new + renewed) | CDI new, renewed, non-renewed 2020-2023 |
| `nonren` | policies non-renewed in 2023 (insurer and insured initiated together: the 2020-2023 file does not split them) | same |
| `nonren_sh` | `nonren / (renewed + nonren) x 100`, 2023 | same |
| `nonren4` | non-renewals 2020 to 2023, sum | same |
| `insnr_sh` | insurer initiated non-renewals per 100 policies up for renewal, 2021 (the last year with the split) | CDI 2015-2021 file |
| `wf_hi_sh` | homeowners policies rated High or Extreme wildfire risk by their insurer, % of exposures with a rating, 2023 | CDI wildfire risk report (Ins. Code 929), policy type HO |
| `wf_score` | average insurer fire risk score, homeowners, 2023 (insurers' own scales pooled by the Department; relative only) | same |
| `wf_claims` | fire and smoke claims paid, all policy types, 2018 to 2023, count | same |
| `wf_loss` | fire and smoke losses, all policy types, 2018 to 2023, $ thousand | same |
| `prem` | average homeowners (HO) premium per exposure, 2023, $ | same: earned premium / earned exposure |
| `cova` | average Coverage A (dwelling limit), homeowners, 2023, $ | same |

### J. Service lines (13 lines x 4 columns) and the index

| column | status | meaning |
|---|---|---|
| `p_<line>` | kept | expected jobs a year in the ZIP, section 12 |
| `r_<line>` | kept | jobs per 10,000 residents a year, shrunk: `(p + 2500 x county rate) / (pop + 2500) x 10000`, county rate = sum p / sum pop over the county's ZIP rows |
| `z_<line>` | kept | z score of ln(`r` + 0.01) across the 1,531 scored ZIPs (population SD). The 0.01 is new: a California ZIP can have a zero rate, a Louisiana one could not |
| `f_<line>` | kept | gross profit pool, $ a year = `p x REP x VAL x FEE` |
| `idx` | kept | Roof Demand Index: percentile 0 to 100 among scored ZIPs of sum `W[line] x z_<line>` |
| `idx_eq` | kept | the same with every weight 1 |
| `fees`, `cases` | kept | sum of `f_*`; sum of `p x REP` |
| `gi`, `gicls` | kept | Getis-Ord Gi* z on `idx` (ZIP and its eight nearest scored neighbours); class H99, H95, H90, C99, C95, C90, ns |
| `comp_n25` | kept, new meaning | active C-39 roofing licences within 25 km of the ZIP's centre (licence mailing ZIPs; Louisiana counted mapped company offices) |
| `comp_mass` | kept, new meaning | distance weighted active C-39 licences: sum of `lic / (1 + (d/10 km)^2)` |
| `roof_mass` | kept | distance weighted roofing establishments (ZBP 238160) with the same kernel |
| `roof_per10k` | kept | `(roofers + lic) / pop x 10000` |
| `comp_pct` | kept | competitive pressure: percentile among scored ZIPs of `0.6 x percentile(comp_mass) + 0.4 x percentile(roof_mass)` |
| `storm_x` | new | the wind and rain exposure index the storm line is spread by, x 1000 (section 12) |
| `cpc_rel` | kept | `META.model.DMA[reg] x (0.8 + 0.4 x comp_pct / 100)` |
| `eff`, `effb`, `oppb` | kept | `fees / cpc_rel`; percentile of `eff`; percentile of `fees` |
| `quad`, `tier`, `bid` | kept | quadrant 0 Anchor (oppb >= 60 and comp_pct >= 60), 1 Whitespace (only oppb), 2 Niche (neither), 3 Avoid (only comp_pct); tier cuts at effb 95, 85, 65, 40, 15 -> A+, A, B, C, D, E; bid +30, +20, +10, 0, -20, -50 |
| `res_ok` | kept | 1 when `pop >= 500` |
| `p_hail, r_hail, z_hail, f_hail, p_fortified, r_fortified, z_fortified, f_fortified` | dropped | |

## 3. `parishes` (the 58 counties)

Kept fields, same meaning: `fips` ("06001"), `name` (no "County"), `reg`, `aland`, `awater`, `pop`, `hh`,
`inc`, `value`, `own`, `spanish`, `viet`, `pop5`, `a65p`, `hu`, `occ`, `rent`, `mh`, `u1`, `mf5u`, `seas`,
`yb[10]` (newest first), `yb_med`, `mort_sh`, `rooms` (all from the ACS county rows, not ZIP sums);
`roofs`, `ra15`, `ra20`, `wave`, `nxt`, `hist` (ZIP sums; `hist` = `{"2000".."2026": [age driven incl. tile relays,
wildfire rebuild and repair roofs]}`); `fema` (`{disaster number: roof or property registrations}`), `fema_k`;
`bps` (`{"2005".."2025": [units in one unit buildings, all units, buildings]}`: element 2 is ALL residential
buildings authorized, unlike Louisiana's small third number), `ytd26`, `ytd25` (January to September, units);
`est`, `roofers`, `lic`, `cru`, `supply`, `adjusters`, `ins_agents` (ZIP sums); `nzip`; `fees`; `comp` (offices of
named companies in the county); `cbp_roof`, `cbp_roof_emp`, `cbp_sup` (County Business Patterns 2023, null when
withheld: 8 counties); the thirteen `p_<line>`.

Dropped: `french`, `hd1`, `hd175`, `wd50`, `wd65`, `td1`, `hur64`, `hur50`, `ts34`, `n64_00`, `vmax_00`,
`vmax_20`, `trop`, `ev`.

New: `seat` (county seat), `lat`, `lon` (label point), `chin`, `tagalog`, `korean`, `arabic` (speakers),
`ra25`, `nxt_t`, `tile_n`, `tile25`, `solar_n`, `lic_all`, `lic_cnty`, `lic_cnty_all` (CSLB's own county field: active,
and all), `nes2381`, `nes2381_rcpt` (Nonemployer Statistics 2024, firms and receipts in $1,000, NAICS 2381),
`fair_pif`, `fair_pif22`, `fair_tiv` ($ million, 2026), `fair_all` (all lines, five year-ends, the Plan's county
file), `ins_pol`, `nonren`, `nonren_sh` (2023), `nonren4`, `wf_claims`, `wf_loss`, `wf_hi_sh`, `fema_reg`, `fema_dest`,
`fema_all` (`{disaster number: all registrations}`), `fire_dest`, `fire_dmg`, `lastfire`, and
`hz` = `{hazard column: resident weighted mean of the county's ZIP values}` for every numeric hazard column
(the replacement for Louisiana's county hazard rates: `PA[i].hz.g58`, `.rain_in`, `.fhsz_sh` and so on).

## 4. Hazard job keys (not written here; merged from CA/data/hazard/out when the files exist)

| hazard file | where it lands | state at this issue |
|---|---|---|
| `zcta_hazard.json` | ZIP columns of group E; county `hz` | not on disk: interim work tables used |
| `hazard_events.json` | top-level `hz`, whole | not on disk: no `hz` key |
| `hazard_ts.json` | every key into `ts` (`month`, `hour`, `year`, `dowhour`, `ar_wy`, `sa_year`, `rain`, `fema_decl`, `zone_county`, `fire_year`, ...) | not on disk: `ts.month`, `ts.hour`, `ts.year` are `{}` |
| `hazard_pts.json` | `pts`, `ptflags`, `ptkinds` | not on disk: `pts` and `ptflags` are `[]` |
| `ca_nws_snapshot.json` | not merged: it is `window.__NWS_SNAPSHOT__`, a separate file | on disk |

`pts[].pi` and `pts[].zi` index `parishes` and `zrows` of this file. The hazard job indexes the order in
`CA/data/work/base.json` (the same order; `out/ca_zip_index.json` is a small copy). A ZIP index at or past the
row count becomes -1 in the merge. Shapes are in HAZARD_SCHEMA.md sections 2 to 4.

## 5. `cities` and `places`

`cities[]`: `name` (unique; where two counties share a postal city name the smaller is written
"Name (County)": none needed in this build), `pi`, `pop`, `nzip`, `zips[]`, `lat`, `lon` (population weighted centre), `fees`,
`comp` (active C-39 licences within 8 km: kept name, new meaning), `roofers`, `lic`, `span`, `viet`,
`chin`, `tagalog`, `korean` (speakers, counts), `hu`, `roofs`, `ra20`, `tile_n`, `fair_pif`, `nonren`,
and the thirteen `p_<line>`. A city is the set of ZIP rows sharing a postal city name (774 cities); `pi` is the
county holding most of its residents; kept when the set has 1,500 residents or more. No two cities share a name
and no ZIP is in two cities.

`places[]`: `name`, `lat`, `lon`, `pop`, `cdp` (bool), plus new `seat` (bool, county seat) and `pi`.
Census places 2024 with ACS 2020-2024 population.

## 6. `geo`

Projection exactly as Louisiana: `x = (lon - minx) x kx x sx`, `y = (maxy - lat) x sx`.
`W` 4800, `H` 5467, `minx` -124.6, `maxy` 42.1, `kx` = cos(37.25 deg) = 0.796002, `sx` = W / (10.7 x kx) = 563.564
(the box runs to longitude -113.9 and latitude 32.4), `u` 2 (new: multiply Louisiana's view box constants by this).
One unit is about 197 m. Paths: `M x y` then `l dx dy` ... `z`, integers, as Louisiana. The block is 1.15 MB.

| member | content |
|---|---|
| `outline` | the state: 15 rings (mainland and the Channel Islands), the county edges that only one county uses |
| `neighbors` | `{"Baja California", Oregon, Nevada, Arizona}` in that order, clipped to the box. Draw them in key order and California on top: Baja California is a hand drawn strip south of the border (no boundary file was used) whose north edge runs under California and Arizona |
| `parish` | 58 county paths by FIPS (Census 2024, 1:500,000) |
| `zcta` | 1,762 paths by ZIP (Census 2020 ZCTAs, 1:500,000); key set = the `zip` column. ZCTAs do not cover the whole state: unpopulated land shows the outline's fill |
| `water` | 85 paths: 22 bay and strait polygons (TIGER 2025 area water of 15 square km or more: San Francisco, San Pablo, Suisun, Monterey, San Diego, Humboldt and other bays) then 63 lakes and reservoirs of 8 square km or more (USGS 1:1,000,000: Salton Sea, Lake Tahoe, Goose, Honey, Mono, Clear Lake, Shasta ...) |
| `wname` | new: the name of each `water` path, same order |
| `pcent` | FIPS -> `[lon, lat]` county label point (Census Gazetteer internal point) |

County and ZIP layers were each cut into shared arcs and every arc simplified once (Douglas-Peucker, tolerance
0.3 unit, end points fixed), so neighbours share one border line: no slivers or gaps. County lines and ZIP
lines are different Census products and do not coincide exactly. One ZIP (91046, a single site in Glendale) is too
small for the grid and is a 2 x 2 unit square. Census shapes stop at the shore, so the Pacific and the bays are
simply outside the outline; the bay polygons in `water` are there for a named fill.

## 7. `ts` keys written by this build

| key | status | shape |
|---|---|---|
| `fema_year` | kept, new meaning | 20 rows `[disaster number, label, year, roof or property registrations (in ZIP rows), roof flag era (true to 2018), owners among ALL registrations, registrants reporting homeowners insurance among ALL registrations, incident kind ("fire", "storm", "quake"), all registrations]`. Labels such as "Camp and Woolsey fires" are this build's, not FEMA's. Positions 0 to 6 as Louisiana; 7 and 8 are new. `FEMA_INS` (core 615) reads 3, 5, 6: note 5 and 6 are now counted on all registrations, so compute the insured share as `a[6] / a[8]` |
| `replace_hist` | kept, new meaning | `{"2000".."2026": [age driven replacements incl. tile relays, wildfire rebuild and repair roofs]}` (2018: 329,680 and 1,426; 2026: 353,025 and 2,117) |
| `month`, `hour`, `year` | hazard job | `{}` until `hazard_ts.json` exists (section 4). `09_sl_model.js` reads `ts.month.hail/wind/torn`: guard it |
| `ppi` | kept | `{asph, steel}` monthly `[YYYY-MM, index]` (BLS WPU1361, WPU1017), January 2019 on; carried from the Louisiana file (January 2019 to August 2026, 92 points each): BLS refused the download |
| `permits` | kept | `{"2005".."2025": [units in one unit buildings, all units, buildings]}` state, Census Building Permits Survey |
| `ytd26`, `ytd25` | kept | units January to September 2026 and 2025 (Louisiana: to August) |
| `agehist` | kept | 41 counts, state sum of `agez` |
| `agehist_t` | new | 41 counts, state sum of `agez_t` |
| `ar_wy_state` | new (third issue) | `{"1960".."2026": [AR1..AR5]}`: atmospheric river landfalls by water year and rank, every event on the California coast that overlaps in time merged into one (the research tabulation, `CA/dl/hazard/atmospheric_rivers/CW3E_AR_counts_by_coast_stretch_wateryear_scale.csv`, row "All California"): 23.5 a water year 1960 to 2025. The hazard job's `ar_wy` merges only neighbouring coast points, so rivers ashore at once on separate stretches of coast count separately: 31.4 a water year. Both are this atlas's tabulations of the CW3E catalogue, not counts CW3E publishes |
| `trop_month` | dropped | |

## 8. `comp`

Four rows. Same fields as Louisiana (`name, domain, url, hq, tier, seg, lines, verified, asof, cities, phone, title,
desc, h1, social, spanish, fin, cert, notes, offices[{city, lat, lon, hq, zip}]`) plus `lic_no` (CSLB licence
number) and `src` (where the name comes from). `lines`, `cities`, `offices`, `social`, `cert` are always arrays;
`tier` is one of `statewide, national, regional, local`; `verified` is false on every row and `domain`, `url`,
`phone`, `title`, `desc`, `h1` are null, because no company site was read.
Rows: Best Contracting Services (Gardena) and Kodiak Roofing and Waterproofing (Roseville), both named in Roofing
Contractor magazine's 2025 regional list and found in the CSLB file; Flynn Group of Companies (named by the
magazine, no C-39 licence under that name, no office mapped); Tecta America's three California licensees (CSLB
only; no ranking verified). A ranked California roster could not be built honestly: there is no public size
measure. Competitive pressure therefore rests on CSLB licence counts (`lic`, `comp_n25`, `comp_mass`, `lic_city`)
and Business Patterns establishments (`roofers`, `roof_mass`, county `cbp_roof`), not on `comp`.

## 9. `ins`, `fema`, `permits_city`

`ins`: `{years: [2022, 2023, 2024, 2025, 2026], state: {...}, county: {fips: {...}}, region: {"1".."11": {...}}}`.
Each block: `fair_pif[5]` (FAIR Plan residential policies at the five year-ends), `fair_tiv[5]` ($ million),
`fair_com` (commercial policies, 2026), `fair_hi` (residential policies in the Plan's high wildfire class),
`fair_own` (owner occupied single family), `fair_dist_zips` (ZIPs flagged distressed), `ins_pol`
(`{"2020".."2023"}` voluntary market new + renewed), `nonren` and `renewed` (`{"2015".."2023"}`), `insnr`
(`{"2015".."2021"}` insurer initiated non-renewals), `wf_claims`, `wf_loss` ($ thousand, 2018 to 2023),
`wf_hi_sh`, `hu`. County blocks add `fair_all[5]` (all lines, the Plan's own county file).
County and region blocks sum ALL postal ZIPs the source files place in the county (not only ZIP rows of
the atlas), by the source's own county field. State: 665,673 residential policies at 2026-09-30 (265,909 in 2022).

`fema`: 21 objects `{dr, type, date, kind ("fire", "storm", "quake", "other"), label, title, regs, owners, renters,
insured, roof_n, rpfvl_noflood, destroyed, k (roof or property registrations), nzip}`; 4482 (COVID-19) has kind
"other" and `k` 0.

`permits_city`: `{"Los Angeles": {src, years: {"2020".."2026": n}, note}, "San Francisco": {src, years:
{"2016".."2026": n}, note}}` re-roof permits by year (counts taken from roofing_law_evidence.md D2, read from the
cities' open data on 2026-11-19). Sacramento is not in the evidence and is not built.

## 10. `meta`

Kept keys: `compiled` ("2026-11-19"), `nzip` (1,762), `nres` (1,531), `npar` (58), `pop`, `hu`, `occ`, `own`, `rent`,
`mh`, `u1`, `yb`, `yb_med`, `seas`, `mort_sh`, `roofs`, `ra15`, `ra20`, `wave`, `nxt`, `npts`, `ncomp` (4), `ncomp_ver` (0),
`cbp` (`{est, emp, ap, sup_est, sup_emp}`), `nes` (`{est2381, rcpt2381}`), `pools`, `cases`, `fees`, `fees_tot`.
`meta.pop`, `roofs`, `ra*`, `wave`, `nxt`, pools are ZIP sums; `hu, mh, u1, seas, occ, own, rent, yb` are county sums
(as Louisiana). Dropped: `nstorm`, `nhosp`, `fort`.

New scalars: `ra25`, `nxt_t`, `tile_n`, `tile25`, `solar_n`.
`meta.state` (new): the ACS state row (`pop, hh, hu, inc, value, own_sh, sfd_sh, mf5_sh, mh, mh_sh, yb_med, pre80_sh,
mort_sh, vac_sh, seas, hh100k_sh, s65_sh, span_sh, span_lep_sh, chin_sh, viet_sh, tagalog_sh, korean_sh, lep_sh, u1,
mf24, mf5u, age_med`).

`meta.lic` (kept, new meaning): `{n` 5,829 (C-39 on the renewed roll), `clear` 5,587 (active, unsuspended), `firms`
(= n), `inca` 5,659 (California mailing address; Louisiana's `inla`), `out` 170, `only` 3,933 (hold C-39 alone),
`susp` 242, `in_rows` 5,340 (licences whose mailing ZIP is a ZIP row; the rest sit at post office box ZIPs),
`top: [[city, active licences] x 25]}`.

`meta.ahs` (renamed fields): `pac_rate, pac_diy, pac_med, pac_mean, pac_ins, pac_leak` (Pacific division 2023; they
take the place of `wsc_*`), `w_mh_rate, w_mh_diy, w_mh_med` (West region mobile homes; they take the place of
`s_mh_*`), `metros` (`{la, sf, riv, pool, sj}` each `{rate, diy, med, mean, ins, leak, n, jobs, year}`), `west`, `us`
(same fields), `vint` (`{"before 1960", "1960-1979", "1980-1989", "1990-1999", "2000-2009", "2010-2019": [model,
AHS West net of insurance paid jobs]}`: six bands, Louisiana had five).

`meta.harden` (takes the place of `meta.fort`): `{anchor` (state pool of the harden line), `rate` 0.02,
`fair_disc` 16.4 (percent off the FAIR Plan wildfire premium for all twelve measures), `safe_homes26`
3,000,000 (California Safe Homes grant money secured, $)`}`.

`meta.ins` (new): state totals (`fair_pif` and `fair_tiv` by year-end, `fair_com`, `fair_hi`, `fair_own`,
`fair_dist_zips`, `nonren`, `renewed`, `insnr`, `ins_pol` by year, `wf_claims`, `wf_loss`, `wf_hi_sh`).
`meta.mat` (new): the RECS 2020 material shares used (`state`, `era`, `climate`).
`meta.econ` (new): Economic Census 2022 California roofing contractors (`rcpt22` $1,000, `estab22`, `emp22`).
`meta.hazard` (new): `{src, merged (hazard files merged), cols (hazard ZIP columns shipped), skipped, fire_src, fire_check}`.
`meta.notes` (new): what the build left out (ZCTAs skipped, postal ZIPs that are not ZCTAs, unmatched insurance and FEMA rows).

`meta.model`: `W, corr` (13 x 13), `sens`, `REP, VAL, FEE, GRADE, TIER, DMA, REG, REGK` (new), `P2R`,
`WB` (`{L 24.5, k 3, rho 0.0035, fit, rmse}` non-tile roofs), `WBT` (new: `{L 27, k 3}` tile underlayment), `ROOF`
(new: the roof model's other constants), `ANCH` (new contents: `cru, coat, leak, mh, metal, harden, harden_carve,
fire_rb, fire_dm, fire_years, storm_ins, storm_rate, storm_mult, storm_w, mf_life, comm_life, mf_storm, comm_storm,
mf24_roof, solar_cap`), `LINES` (the thirteen keys in order), `RES`, `COM`, `PRIOR` (2500), `CRU_W`, `LEAK`
(leak rate by decade, newest first, %), `LEAK_F`, `storm_anchor`, `haz_used`, `haz_src`, `MKT` (new: media market
names per region by principal city, typed from general knowledge, not a Nielsen county list).
Dropped: `DMG`, `val`, `valpts` (the hurricane damage curve and its validation: module 01 lines 5070 and 5201 to
5205 and module 02 line 5307 read them).

`meta.src` (new): `[{k, name, vintage, url, grade}]` for every source used.
`meta.assume` (new): plain sentences, one per assumption with no evidence behind it (22).

## 11. The roof age model (constants in `meta.model.WB`, `WBT`, `ROOF`)

Two cohorts per ZIP from the one unit homes by decade (`o*`): tile roofs (RECS share by era x climate factor,
capped at 90%) and all other coverings. Yearly loop 1905 to 2026 as Louisiana's: new homes enter at age 0 (a
decade's homes spread evenly over its years; "1939 or earlier" over 1905 to 1939; "2020 or later" over 2020 to
2025), wear, resets, ageing. A reroofed home keeps its kind of covering.

- **Non-tile roofs** wear on a Weibull life, mean 24.5 years, shape 3 (Louisiana: 22). Fitted, as contract 17.3 (d)
  describes, to the AHS 2023 West region replacement rates by year built less the 9.5% of jobs paid by insurance,
  with a 0.35% a year background in the calibration cohort and California's tile share in each band. Model against
  target, % of homes a year: before 1960 3.83 / 3.76; 1960-79 3.76 / 4.24; 1980-89 3.74 / 3.22; 1990-99 4.24 / 3.71;
  2000-09 2.80 / 2.77; 2010-19 0.67 / 0.99. Root mean square gap 0.39 points (Louisiana: 0.31).
- **Tile roofs** wear on a 27 year Weibull, shape 3: what fails is the underlayment, and the job is a lift and
  relay (`nxt_t`, the `tile` line), after which the same tile goes back and the age returns to 0.
- **No hurricane resets and no storm background** in California ZIPs. The only resets are wildfire:
  (a) half of the residences CAL FIRE recorded as damaged (not destroyed) get a new roof the year after;
  (b) residences destroyed in 2024 or 2025 leave the stock in the fire year (the ACS 2020-2024 homes still count
  them) and 40% re-enter at age 0, a quarter in each of the four following years. Homes destroyed up to 2023
  are already out of, or rebuilt in, the Census year-built counts, so they are not reset a second time; their
  rebuild roofs are still shown in `rhist` and `hist` (second element) for the record.
- Results: 9.43 million one unit roofs; median age 13 years (Louisiana: 7); 27.0% are 20 or older, 14.3% are 25
  or older; 2.58 million tile roofs, 399,000 with underlayment 25 or older; wear now 3.77% a year (AHS California
  metros pooled: 4.13% of owner homes with a roofing job a year, insurance and owner jobs included; Pacific 3.67%).
  The age histogram is smooth: there are no storm spikes.

## 12. Service line pools (constants in `meta.model.ANCH`; every assumption is in `meta.assume`)

State pools at this issue, jobs a year: replace 263,275; repair 301,912; storm 34,750; fire 2,769; harden 10,560;
tile 88,958; solar 87,424; metal 12,221; mh 13,426; mf 9,719; comm 31,922; coat 20,700; newc 62,614.
Gross profit pool at the defaults: $2.91 billion (`meta.fees_tot`). For scale: the 2022 Economic Census puts
California roofing contractor revenue at $6.21 billion.

| line | pool | REP | VAL $ | grade |
|---|---|---|---|---|
| `replace` | `max(0, nxt x (1 - metal_sh/100) - 0.70 x p_harden)`: age driven reroofs of non-tile roofs on one to four unit homes | 0.84 | 19,000 | B |
| `repair` | leak rate by decade built (2.2% for homes built 2020 on, up to 8.8% before 1940: the Southern AHS profile by decade rescaled so California's stock averages the AHS Pacific 5.25%) x homes by decade x `(roofs + mf24) / hu` x 0.55 fixed by a paid roofer | 0.55 | 1,350 | B |
| `storm` | wind and rain damage. State total = 3.5% (AHS Pacific share of roof jobs paid by insurance) x 3.67% (AHS Pacific roof jobs a year) x one unit roofs x 3 (repairs short of replacement: a guess) = 36,300, spread over ZIPs by `(roofs + mf24/3) x storm_x`, `storm_x` = 0.5 + 0.3 x `g58` + 1.2 x `g75` + 0.3 x `ar3_d` + 0.2 x `rain_d2` (hazard columns; weights by judgment), then less the metal share | 0.80 | 7,500 | C |
| `fire` | `(fire_nxt + 0.5 x prior) x (1 - metal_sh/100)`: the rebuild roofs due in the next twelve months, plus half the 2013 to 2025 state yearly mean (40% of residences destroyed + 50% of residences damaged, a year) spread by wildfire exposed homes (`fhsz_sh x u1`; insurer rated High or Extreme exposures when the hazard column is missing) | 0.60 | 19,000 | C |
| `harden` | 2% a year x wildfire exposed owner homes = the larger of (homeowners exposures insurers rate High or Extreme, CDI 2023) and (`fair_own`), capped at owner occupied one unit homes (`u1 - rent1`) | 0.85 | 24,000 | D |
| `tile` | `nxt_t`: tile underlayment jobs due in the next twelve months | 0.84 | 16,000 | C |
| `solar` | `(nxt + nxt_t) x solar_sh / 100`: detach and reset of rooftop solar for a reroof or relay. An added job on the same roof, not carved out of `replace` | 0.50 | 4,500 | C |
| `metal` | `metal_sh/100 x (nxt + 0.5 x gross storm jobs + gross fire jobs)` | 0.88 | 28,000 | D |
| `mh` | `mh x 0.0224` (AHS West: 4.15% a year less 46% done by the owner) + `mh x` the ZIP's storm jobs per roof | 0.72 | 7,000 | C |
| `mf` | `mfb / 22` + `mfb x 0.8 x` the ZIP's storm replacement rate (storm jobs per roof / 3) | 0.65 | 40,000 | C |
| `comm` | `cru x (1/22 + 0.7 x` the ZIP's storm replacement rate`)`; `cru` sums to 690,000 (5.9 million U.S. commercial buildings, CBECS 2018, x California's 11.73% of U.S. residents) | 0.55 | 75,000 | D |
| `coat` | `0.03 x cru` | 0.50 | 40,000 | D |
| `newc` | Building Permits Survey residential buildings, 2023 to 2025 county mean, spread over the county's ZIPs by `yb20 + 0.35 x yb10` | 0.25 | 13,000 | B |

`TIER` (index confidence): replace, repair, newc 1.0; storm, fire, tile, mh, mf 0.75; harden, solar, metal, comm,
coat 0.5. `W` = line's share of `fees_tot` x `TIER` (replace 0.48, tile 0.10, comm 0.07; sum 0.81).
`DMA` (regional click cost factor, assumption): regions 5, 8, 9 = 1.00; 11 = 0.90; 10 = 0.85; 3, 6 = 0.80; 7 = 0.65;
1, 4 = 0.60; 2 = 0.55.

## Change list

- 2026-11-19, first issue. Hazard columns of group E are stubs until HAZARD_SCHEMA.md exists.
- 2026-11-23, second issue (the file is built and checked: 1,762 rows, 333 columns, 128 checks pass).
  - Rows: 1,762, not "about 1,768". 97635 dropped (section 0, item 6).
  - New ZIP columns since the first issue: `solar_n`, `solar_sh`, `solar_src`, `solar_new`, `solar_batt`, `fire_dest`,
    `fire_dmg`, `fire_res` (temporary), `fire_nxt`, `storm_x`, `tlat`, `tlon` and the hazard job's columns.
  - Group E: the stub names are gone. The hazard job's own names are carried (its HAZARD_SCHEMA.md, second issue, fixes
    them). Of the stub names, `fhsz_sh`, `fire_dest`, `fire_dmg`, `snow_psf`, `wd58`, `ar_days`, `rain_in` exist in its
    schema with the same meaning; `heat100` is `h100`.
  - `val1m_sh` is B25075 lines 25 to 27 (the first issue said 24 to 27).
  - `gid`: Google's geotargets file of 2026-10-06 was reached; 1,707 of 1,762 ZIPs have an ID, the rest are null.
  - Cities are grouped by postal city name alone (first issue: name within a county).
  - `tile` ticket $16,000; `fire` line built from the next twelve months' rebuilds plus half the long run mean
    (first issue: half the ZIP's own record, half the mean); wildfire rebuild share 40% (first issue: left open).
  - Top level: `hz` and `ptkinds` named for the hazard merge; `relief` is null (not built); `out/ca_zip_index.json` added.
  - `meta`: `ahs.west`, `econ`, `hazard`, `notes`, `model.MKT`, `model.ROOF`, `model.PRIOR`, `model.CRU_W`, `model.LEAK` added.
  - Still open: the hazard job's final files were not on disk; rerun `bash build_all.sh 3` when they are, and this
    list will record the merge.
- 2026-11-23, third issue (integration pass).
  - Hazard merge is final: `meta.hazard.src` is "hazard job"; `hz`, `pts`, `ptflags`, `ptkinds`, the hazard `ts` keys and
    the group E columns (with `snow_psf`) come from CA/data/hazard/out. Section 4's "state at this issue" column is history.
  - New ZIP column `cz` (group A, after `ncty`): Title 24 building climate zone from the Energy Commission's list by ZIP.
  - New `ts.ar_wy_state` beside the hazard job's `ts.ar_wy` (section 7 says which count is which).
  - The CBECS figure behind `meta.model.ANCH.cru` was checked against the survey's own table: EIA, CBECS 2018, Table B1,
    "All buildings" 5,918 thousand (file kept as `CA/data/dl/cbecs/b1.xlsx`, read 2026-11-23). The `meta.assume` line now
    names the table and says which parts are assumption (California's share by residents; the weights by building type).
