# California Roofer Guru: data schema (`window.__ATLAS_DATA__`)

Written 2026-11-19 by the data build (CA/data). Output file: `CA/data/out/ca_atlas_data.json`.
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
   largest land share is in California and ACS B01003 shows one resident or more. ZCTAs that are
   mostly Nevada or Oregon are out. Model columns (`r_`, `z_`, `idx` and what follows from them) are
   null where `res_ok` = 0 (fewer than 500 residents), as in Louisiana.
7. **Years.** Model year 2026 ("now"); roof model runs 1905 to 2026; ACS 2020-2024; Business Patterns
   2023; FAIR Plan year-ends 2022-09-30 to 2026-09-30; CDI non-renewals to 2023; CSLB November 2026.

## 1. Top-level keys

| key | status | shape | what it is |
|---|---|---|---|
| `zcols`, `zrows` | kept | names; one array per ZIP | the ZIP table, section 2 |
| `parishes` | kept, new meaning | 58 objects, FIPS order | counties, section 3 |
| `cities` | kept | objects, unique `name` | postal cities of 1,500 residents or more, section 5 |
| `places` | kept | `{name, lat, lon, pop, cdp}` | Census places for map labels (all places of 10,000 or more, plus every county seat); section 5 |
| `geo` | kept, extended | section 6 | map geometry |
| `seg`, `routes`, `rlist`, `sids`, `zstorm` | kept empty | `[]`, `[]`, `[]`, `[]`, `{}` | hurricane structures: empty, readers to be removed |
| `pts`, `ptflags` | hazard job | section 4 | located weather and fire reports |
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
| `relief` | new, optional | section 6 | small shaded relief grid for the atlas map (only if built; null otherwise) |
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
| `val1m_sh` | new | owner homes valued $1,000,000 or more, % of owner homes | B25075_024.._027 / _001 |
| `hhsize` | new | average household size | B25010_001 |
| `moved10_sh` | new | households that moved in 2010 or later... % (owners and renters) | B25038 |
| `own_yr` | new | median year owners moved in | B25039_002 |

### D. Roof stock (the cohort model, section 11; grade B for age, D for material)

| column | status | meaning | formula |
|---|---|---|---|
| `roofs` | kept | one unit roofs, count (= sum of `agez[zip]` = `u1` to rounding) | model |
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
| `lastfire` | renamed from `last64` | most recent year a wildfire destroyed or damaged structures in the ZIP (CAL FIRE damage inspections); null when none on record | hazard job |
| `yrsfire` | renamed from `yrs64` | `2026 - lastfire` | |

### E. Hazard columns (hazard job; merged by this build)

Louisiana's hail, wind and tornado climate columns (`hd1, hd175, hd2, hd1_10, wd50, wd65, td1`) and its
located report counts (`ev_h1, ev_h175, ev_w58, ev_w75, ev_t, ev_dmg`) are written by the hazard job for
California if it keeps them, under the names in its HAZARD_SCHEMA.md. Until that file exists this build
runs on a stub with these names (they are placeholders and WILL be replaced by the hazard job's names;
the change list at the end will say so):

| stub column | meaning |
|---|---|
| `wd58` | days a year with a measured or reported gust of 58 mph or more within 25 miles |
| `ar_days` | atmospheric river days a year (AR2 or stronger) at the ZIP's stretch of coast or inland |
| `rain_in` | normal annual precipitation, inches (1991 to 2020) |
| `fhsz_sh` | share of the ZIP's homes or land in a High or Very High Fire Hazard Severity Zone, % |
| `fire_dest`, `fire_dmg` | structures destroyed, and damaged, by wildfire in the ZIP, all years on record (CAL FIRE DINS) |
| `snow_psf` | design ground snow load, pounds per square foot |
| `heat100` | days a year at 100 F or more |

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
| `z_<line>` | kept | z score of ln(`r` + 0.01) across scored ZIPs (population SD). The 0.01 is new: a California ZIP can have a zero rate (`fire`), a Louisiana one could not |
| `f_<line>` | kept | gross profit pool, $ a year = `p x REP x VAL x FEE` |
| `idx` | kept | Roof Demand Index: percentile 0 to 100 among scored ZIPs of sum `W[line] x z_<line>` |
| `idx_eq` | kept | the same with every weight 1 |
| `fees`, `cases` | kept | sum of `f_*`; sum of `p x REP` |
| `gi`, `gicls` | kept | Getis-Ord Gi* z on `idx` (ZIP and its eight nearest scored neighbours); class H99, H95, H90, C99, C95, C90, ns |
| `comp_n25` | kept, new meaning | active C-39 roofing licences within 25 km of the ZIP's centre (licence mailing ZIPs; Louisiana counted mapped company offices) |
| `comp_mass` | kept, new meaning | distance weighted active C-39 licences: sum of `lic / (1 + (d/10 km)^2)` |
| `roof_mass` | kept | distance weighted roofing establishments (ZBP 238160) with the same kernel |
| `roof_per10k` | kept | `(roofers + lic) / pop x 10000` |
| `comp_pct` | kept | competitive pressure percentile among scored ZIPs of `0.6 x rank(comp_mass) + 0.4 x rank(roof_mass)` |
| `cpc_rel` | kept | `META.model.DMA[reg] x (0.8 + 0.4 x comp_pct / 100)` |
| `eff`, `effb`, `oppb` | kept | `fees / cpc_rel`; percentile of `eff`; percentile of `fees` |
| `quad`, `tier`, `bid` | kept | quadrant 0 Anchor (oppb >= 60 and comp_pct >= 60), 1 Whitespace (only oppb), 2 Niche (neither), 3 Avoid (only comp_pct); tier cuts at effb 95, 85, 65, 40, 15 -> A+, A, B, C, D, E; bid +30, +20, +10, 0, -20, -50 |
| `res_ok` | kept | 1 when `pop >= 500` |
| `p_hail, r_hail, z_hail, f_hail, p_fortified, r_fortified, z_fortified, f_fortified` | dropped | |

## 3. `parishes` (the 58 counties)

Kept fields, same meaning: `fips` ("06001"), `name` (no "County"), `reg`, `aland`, `awater`, `pop`, `hh`,
`inc`, `value`, `own`, `spanish`, `viet`, `pop5`, `a65p`, `hu`, `occ`, `rent`, `mh`, `u1`, `mf5u`, `seas`,
`yb[10]` (newest first), `yb_med`, `mort_sh`, `rooms` (all from the ACS county rows, not ZIP sums);
`roofs`, `ra15`, `ra20`, `wave`, `nxt`, `hist` (ZIP sums; `hist` = `{"2000".."2026": [age driven, fire rebuild]}`);
`fema` (`{disaster number: roof or property registrations}`), `fema_k`; `bps` (`{"2005".."2025": [units in
one unit buildings, all units, buildings]}`: element 2 is ALL residential buildings authorized, unlike
Louisiana's small third number), `ytd26`, `ytd25` (January to September, units); `est`, `roofers`, `lic`,
`cru`, `supply`, `adjusters`, `ins_agents` (ZIP sums); `nzip`; `fees`; `comp` (named companies with an
office in the county); `cbp_roof`, `cbp_roof_emp`, `cbp_sup` (County Business Patterns 2023, null when
withheld); the thirteen `p_<line>`.

Dropped: `french`, `hd1`, `hd175`, `wd50`, `wd65`, `td1`, `hur64`, `hur50`, `ts34`, `n64_00`, `vmax_00`,
`vmax_20`, `trop`. `ev` and the hazard rates come from the hazard job under its names.

New: `seat` (county seat), `lat`, `lon` (label point), `chin`, `tagalog`, `korean`, `arabic` (speakers),
`ra25`, `nxt_t`, `tile_n`, `ra25`, `lic_all`, `lic_cnty` (CSLB's own county field count, active),
`nes2381`, `nes2381_rcpt` (Nonemployer Statistics 2024, firms and receipts $1,000, NAICS 2381),
`fair_pif`, `fair_pif22`, `fair_tiv` ($ million), `fair_all` (all lines, the Plan's county file),
`ins_pol`, `nonren`, `nonren_sh`, `nonren4`, `wf_claims`, `wf_loss`, `fema_reg`, `fema_dest`,
`fema_all` (`{disaster number: all registrations}`).

## 4. Hazard job keys (not written here; merged from CA/data/hazard/out)

`pts`, `ptflags`, `ts.month`, `ts.hour`, `ts.year`, `ts.dowhour` and any fire or weather event tables,
the ZIP hazard columns of group E, county hazard fields, and `ca_nws_snapshot.json`. Their shapes are in
HAZARD_SCHEMA.md. This file's change list records the merge.

## 5. `cities` and `places`

`cities[]`: `name` (unique; where two counties share a postal city name the smaller is written
"Name (County)"), `pi`, `pop`, `nzip`, `zips[]`, `lat`, `lon` (population weighted centre), `fees`,
`comp` (active C-39 licences within 8 km: kept name, new meaning), `roofers`, `lic`, `span`, `viet`,
`chin`, `tagalog`, `korean` (speakers, counts), `hu`, `roofs`, `ra20`, `tile_n`, `fair_pif`, `nonren`,
and the thirteen `p_<line>`. A city is the set of ZIP rows sharing a postal city name in one county;
kept when the set has 1,500 residents or more.

`places[]`: `name`, `lat`, `lon`, `pop`, `cdp` (bool), plus new `seat` (bool, county seat) and `pi`.
Census places 2024 with ACS 2020-2024 population.

## 6. `geo`

Projection exactly as Louisiana: `x = (lon - minx) x kx x sx`, `y = (maxy - lat) x sx`.
`W` 4800, `H` 5467, `minx` -124.6, `maxy` 42.1, `kx` = cos(37.25 deg), `sx` = W / (10.7 x kx) (the box
runs to longitude -113.9 and latitude 32.4), `u` 2 (new: multiply Louisiana's view box constants by this).
Paths: `M x y` then `l dx dy` ... `z`, integers, as Louisiana.
`outline` (state, with the Channel Islands), `neighbors` (`{Oregon, Nevada, Arizona, "Baja California"}`
clipped to the box; Baja California and Sonora are drawn as one land mass south of the border from the
box edge, not from a boundary file), `parish` (58 county paths by FIPS), `zcta` (paths by ZIP, key set =
the `zip` column), `water` (array of paths: San Francisco, San Pablo and Suisun bays where they cut into
counties, Lake Tahoe, Salton Sea, Mono Lake, Clear Lake, and other lakes and reservoirs of 8 square km
or more), `pcent` (FIPS -> `[lon, lat]`), new `wname` (names for `water`, same order), new `zcent`
omitted (use the `lat`, `lon` columns). County and ZIP shapes are simplified on shared arcs, so
neighbours meet without gaps. Optional `relief`: see top-level table.

## 7. `ts` keys written by this build

| key | status | shape |
|---|---|---|
| `fema_year` | kept, new meaning | rows `[disaster number, label, year, roof or property registrations, roof flag era (true to 2018), owners among ALL registrations, registrants reporting homeowners insurance among ALL registrations, incident kind ("fire", "storm", "quake"), all registrations]`. Positions 0 to 6 as Louisiana; 7 and 8 are new. `FEMA_INS` (core 615) reads 3, 5, 6: note 5 and 6 are now counted on all registrations, so compute the insured share as `a[6] / a[8]` |
| `replace_hist` | kept, new meaning | `{"2000".."2026": [age driven replacements incl. tile relays, fire rebuild roofs]}` |
| `ppi` | kept | `{asph, steel}` monthly `[YYYY-MM, index]` (BLS WPU1361, WPU1017), January 2019 on; carried from the Louisiana file through August 2026 if BLS cannot be reached |
| `permits` | kept | `{"2005".."2025": [units in one unit buildings, all units, buildings]}` state, Census Building Permits Survey |
| `ytd26`, `ytd25` | kept | units January to September 2026 and 2025 (Louisiana: to August) |
| `agehist` | kept | 41 counts, state sum of `agez` |
| `agehist_t` | new | 41 counts, state sum of `agez_t` |
| `trop_month` | dropped | |

## 8. `comp`

Same fields as Louisiana (`name, domain, url, hq, tier, seg, lines, verified, asof, cities, phone, title,
desc, h1, social, spanish, fin, cert, notes, offices[{city, lat, lon, hq}]`) plus `lic_no` (CSLB licence
number) and `src` (where the name comes from). Only companies named in the evidence files are listed
(Roofing Contractor magazine's 2025 regional list names three Pacific firms). Fields nobody read on a
company's own site are null and `verified` is false. A ranked California roster could not be built
honestly: there is no public size measure. Competitive pressure therefore rests on CSLB licence counts
(`lic`, `comp_n25`, `comp_mass`, `lic_city`) and Business Patterns establishments, not on `comp`.

## 9. `ins`, `fema`, `permits_city`

`ins`: `{years: [2022..2026], state: {...}, county: {fips: {...}}, region: {reg: {...}}}` where each
block has `fair_pif[5]` (residential, year-ends 2022 to 2026), `fair_tiv[5]` ($ million), `fair_com`
(2026), `fair_hi`, `fair_own`, `ins_pol` (`{2020..2023}`), `nonren` (`{2015..2023}`), `renewed`
(`{2015..2023}`), `insnr` (`{2015..2021}` insurer initiated), `wf_claims`, `wf_loss`, `wf_hi_sh`, `hu`.
County and region blocks are sums of ALL postal ZIPs the source files place in the county (not only
ZIP rows of the atlas), using the source's own county field.

`fema`: `[{dr, type ("DR"), date, kind, title, regs, owners, renters, insured, roof_n, rpfvl_noflood,
destroyed, k (roof or property registrations), nzip}]` for the 21 disasters; 4482 is listed with `k` 0.

`permits_city`: `{"Los Angeles": {src, years: {yyyy: n}, note}, "San Francisco": {...}}` re-roof permits
by year from the cities' open data as read on 2026-11-19 (figures from roofing_law_evidence.md D2).

## 10. `meta`

Kept keys: `compiled` ("2026-11-19"), `nzip`, `nres`, `npar` (58), `pop`, `hu`, `occ`, `own`, `rent`, `mh`,
`u1`, `yb`, `yb_med`, `seas`, `mort_sh`, `roofs`, `ra15`, `ra20`, `wave`, `nxt`, `npts` (hazard job), `ncomp`,
`ncomp_ver`, `cbp` (`{est, emp, ap, sup_est, sup_emp}`), `nes` (`{est2381, rcpt2381}`), `pools`, `cases`,
`fees`, `fees_tot`. `meta.pop`, `roofs`, `ra*`, `wave`, `nxt`, pools are ZIP sums; `hu, mh, u1, seas, occ,
own, rent, yb` are county sums (as Louisiana); `meta.state` (new) holds the ACS state row itself.
`nstorm`, `nhosp`, `fort` dropped.

`meta.lic` (kept, new meaning): `{n` (C-39 on the renewed roll, 5,829), `clear` (active, 5,586),
`firms` (= n), `inla` -> renamed `inca` (California mailing address), `out` (out of state), `only` (hold
C-39 alone), `susp`, `top: [[city, active licences] x 25]}`.

`meta.ahs` (renamed fields): `pac_rate, pac_diy, pac_med, pac_mean, pac_ins, pac_leak` (Pacific division
2023; they take the place of `wsc_*`), `w_mh_rate, w_mh_diy, w_mh_med` (West region mobile homes; they
take the place of `s_mh_*`), `metros` (`{la, sf, riv, pool, sj}` each `{rate, diy, med, mean, ins, leak, n,
jobs, year}`), `us` (same fields), `vint` (`{band: [model, AHS West]}`).

`meta.harden` (takes the place of `meta.fort`): `{anchor` (state pool of the harden line), `rate`,
`fair_disc` 16.4 (percent off the FAIR Plan wildfire premium for all twelve measures), `safe_homes26`
3,000,000 (California Safe Homes grant money secured, $)`}`.

`meta.ins` (new): state totals (FAIR Plan residential policies by year-end, exposure, distressed ZIPs,
non-renewals by year).

`meta.mat` (new): the RECS 2020 material shares used (`state`, `era`, `climate`).

`meta.model`: `W, corr` (13 x 13), `sens`, `REP, VAL, FEE, GRADE, TIER, DMA, REG, REGK` (new), `P2R`,
`WB` (`{L, k, rho, fit}` non-tile roofs), `WBT` (new: `{L, k}` tile underlayment), `ANCH` (new contents:
`cru, coat, leak, mh, metal, harden, fire_rb, fire_dm, storm, solar_dr, mf_life, comm_life`), `LINES`
(new: the thirteen keys in order), `RES`, `COM` (new). `DMG`, `val`, `valpts` dropped (hurricane damage
curve and its validation).

`meta.src` (new): list of `{k, name, vintage, url, grade}` for every source used.
`meta.assume` (new): list of plain sentences, one per assumption with no evidence behind it.

## 11. The roof age model (summary; full constants in `meta.model`)

Two cohorts per ZIP from the one unit homes by decade (`o*`): tile roofs (era share x climate factor)
and all other coverings. Yearly loop 1905 to 2026 as Louisiana's (new homes at age 0, wear, resets,
ageing). Non-tile roofs wear on a Weibull life `WB` (refit to the AHS West region replacement rates by
year built, net of jobs paid by insurance). Tile roofs wear on `WBT`: the "replacement" is the
underlayment (lift and relay), after which the same tile goes back. No hurricane resets. The only
reset is wildfire: structures CAL FIRE recorded as destroyed in the ZIP in year Y (hazard job's
fire losses by year) leave the stock and re-enter at age 0 over years Y+1 to Y+4 at the rebuild share
`ANCH.fire_rb`. `rhist` and `hist` carry them in the second element.

## 12. Service line pools (recipes; constants in `meta.model.ANCH`, assumptions listed in `meta.assume`)

| line | pool |
|---|---|
| `replace` | `nxt x (1 - metal_sh/100) - 0.70 x p_harden` (floor 0): age driven reroofs of non-tile roofs on one to four unit homes |
| `repair` | AHS leak rate by decade built (Louisiana's decade profile rescaled to the Pacific division mean, 5.25% of owner homes a year) x homes by decade x `(roofs + mf24) / hu` x 0.55 fixed by a paid roofer |
| `storm` | wind and rain damage jobs: state anchor (AHS Pacific share of roof jobs paid by insurance x professional roof jobs, x 3 for repairs short of replacement) spread over ZIPs by `roofs x` the hazard job's wind and atmospheric river exposure |
| `fire` | wildfire damage and rebuild roofs a year: half from the ZIP's own CAL FIRE record (destroyed x rebuild share + damaged x 0.5, a year, 2013 to 2025), half from the state yearly mean spread by homes in Very High fire zones |
| `harden` | `ANCH.harden` x wildfire exposed owner homes: the larger of (homeowners exposures insurers rate High or Extreme, CDI 2023) and (FAIR Plan owner occupied policies), capped at owner occupied one unit homes |
| `tile` | `nxt_t x (1 - 0.3 x metal... )` no: simply `nxt_t` (tile underlayment jobs due next year) |
| `solar` | detach and reset: `(nxt + nxt_t) x` share of one unit homes with rooftop solar (source and vintage in the change list; a statewide share if no ZIP source is reachable) |
| `metal` | `metal_sh/100 x (nxt + 0.5 x gross storm jobs + rebuild roofs)` |
| `mh` | `mh x ANCH.mh` (AHS West: 4.15% a year less 46% done by the owner) + mobile homes x the ZIP's storm job rate |
| `mf` | `mfb / ANCH.mf_life` + `mfb x 0.8 x` the ZIP's storm replacement rate |
| `comm` | `cru x (1 / ANCH.comm_life + 0.7 x` the ZIP's storm rate`)` |
| `coat` | `ANCH.coat x cru` (3%) |
| `newc` | Building Permits Survey buildings, 2023 to 2025 county mean, spread over the county's ZIPs by `yb20 + 0.35 x yb10` |

## Change list

- 2026-11-19, first issue. Hazard columns of group E are stubs until HAZARD_SCHEMA.md exists.
