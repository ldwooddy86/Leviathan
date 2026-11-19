# California atlas: people, homes, business, FEMA, insurance and licensing sources

Compiled 2026-11-19. Every URL below was fetched that day and the result checked.

`DL/` = `/tmp/claude-0/-home-user-Leviathan/3de4e742-518d-5f10-b5db-2b34e6723642/scratchpad/ca/dl/people/`

Layout: each topic folder holds its download and parse scripts; downloaded files are in its
`raw/` subfolder (archives unpacked each into its own folder); files made from them are in
`derived/` or `raw/ca/`. Run the Python with `python3 -I <script> <paths>`.

## 0. Things that apply to every item

- No API key was used and no personal information was sent. Client name sent where a site
  wants one: `Mozilla/5.0 (compatible; research-downloader)`.
- **The Census Data API cannot be used without a key.** Every data request to
  `https://api.census.gov/data/...` (tested with ACS 2024 and 2023, county and ZCTA queries)
  answers `HTTP 302 -> https://api.census.gov/data/missing_key.html`, header
  `x-datawebapi-keyerror: 1`. Only the discovery files open without a key
  (`.../2024/acs/acs5/variables.json`, `geography.json`). Everything from the Census Bureau
  below therefore comes from the bulk files on `www2.census.gov`: same published numbers.
- The container restarted twice mid-run. After each restart every file was re-checked (zip
  test, PDF end marker, row count against the count the API reports) and cut-off jobs resumed.
- Formulas were proven on Louisiana before use: the ACS and Business Patterns formulas below
  return the Louisiana atlas row for ZIP 70001 exactly, and the housing survey script returns
  the Louisiana "ahs" block exactly.

## 1. ACS five-year by ZCTA, county, place — DONE

**Vintage:** ACS 2020-2024 five-year, released 2026-01-29. It is the newest five-year set:
`summary_file/2025/` holds one-year data only (2021-2025 five-year is not out yet).

**Source that worked** (table-based summary file: one national pipe-delimited file per table,
every geography in it):
`https://www2.census.gov/programs-surveys/acs/summary_file/2024/table-based-SF/data/5YRData/acsdt5y2024-<table>.dat`
Columns `GEO_ID|<T>_E001|<T>_M001|...` (E estimate, M margin of error). Labels:
`.../table-based-SF/documentation/ACS20245YR_Table_Shells.txt`; names: `.../documentation/Geos20245YR.txt`.

**How one state's ZCTAs are pulled.** ZCTA rows are `GEO_ID = 860Z200US<zcta5>`: no state part,
so there is no "ZCTAs in California" query. The national file is filtered with the Census 2020
ZCTA-to-county relationship file
`https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_county20_natl.txt`
(47,863 ZCTA-county parts, pipe-delimited, `GEOID_ZCTA5_20`, `GEOID_COUNTY_20`, `AREALAND_PART`,
`AREAWATER_PART`). Every ZCTA with a part in a county `06xxx` is kept.

**California rows that came back, per table:** 1 state, 58 counties, 1,618 places (cities and
CDPs), **1,808 ZCTAs**, plus the United States row and all 935 metro and micro areas.
- 1,808 ZCTAs touch California; 1,803 have their largest land share in California; 6 cross the
  state line (89010, 89019, 89060, 89061, 89439 are mostly Nevada; 97635 is mostly Modoc County).
- 1,768 of the 1,808 have residents. Medians are missing where the Census cannot estimate
  them: median income present for 1,596 ZCTAs, median home value for 1,605, median year built
  for 1,709. (The brief's "about 1,760" matches the populated count.)
- Check: the 58 counties sum to the state row exactly (population 39,287,377; housing units
  14,644,735). The 1,808 ZCTAs sum to 39,312,960 (0.07% over, from the Nevada-side ZCTAs).

**Tables downloaded (32).** National bytes read: 2.1 GB; kept: 28 MB.
Louisiana-equivalent: B01001, B01003, B11001, B19001, B19013, B25001, B25002, B25003, B25004,
B25018, B25024, B25034, B25035, B25036, B25077, B25081, B25127, C16001.
California additions: B16001 (42-language detail), C16002 (limited-English households), B04006
(ancestry), B05006 (country of birth), B02015 (Asian groups), B03002 (Hispanic origin), B25032
(tenure by units in structure), B25037, B25038, B25039 (years in the home), B25075 (value
bands), B25010, B01002, B25040.

**Column formulas** (each equals the Louisiana atlas value for ZIP 70001):

| column | formula |
|---|---|
| pop | B01003_001 |
| hh, occ | B11001_001, B25003_001 |
| inc, value | B19013_001, B25077_001 |
| own_sh | B25003_002 / B25003_001 |
| hu | B25001_001 |
| sfd_sh | B25024_002 / _001 (one unit detached) |
| u1 | B25024_002 + _003 (detached + attached) |
| mf24, mf5u, mf5_sh | B25024_004+005; _006.._009; mf5u / _001 |
| mh, mh_sh | B25024_010; / _001 |
| yb20, yb10, yb00, yb90, yb80, yb70, yb60, yb50, yb40, ybold | B25034_002 .. _011 (2020 or later ... 1939 or earlier) |
| pre80_sh | B25034_007.._011 / _001 |
| yb_med, rooms | B25035_001, B25018_001 |
| mort_sh | B25081_002 / _001 |
| vac_sh, seas | B25002_003 / _001; B25004_006 |
| hh100k_sh | B19001_014.._017 / _001 |
| s65_sh | B01001 (020..025 + 044..049) / _001 |
| span_sh, span_lep_sh | C16001_003, _005 / _001 |
| viet_sh, french_sh | C16001_024, _006 / _001 |

**Languages for California.** C16001 (ZCTA, county, place) gives: Spanish (_003, limited English
_005), Chinese incl. Mandarin and Cantonese (_021, _023), Vietnamese (_024, _026), Tagalog incl.
Filipino (_027, _029), Korean (_018, _020), Arabic (_033), "Russian, Polish or other Slavic"
(_012) and "Other Indo-European" (_015).
- **Armenian, Persian and Russian are NOT published by ZCTA, county or place.** They exist only
  in B16001 (Armenian _039, Persian incl. Farsi and Dari _042, Russian _027), and the 2020-2024
  five-year B16001 covers only the nation, states, PUMAs, congressional districts, metro
  divisions and combined areas (3,200 rows nationally). Kept: the 281 California PUMA rows, 52
  congressional districts, plus C16001 and B01003 for the same PUMAs, and the tract-to-PUMA and
  ZCTA-to-tract relationship files so PUMA detail can be spread over ZCTAs.
- ZCTA-level stand-ins that were downloaded: C16001 "Other Indo-European" (in Glendale 91201
  it is 50.4% of residents, almost all Armenian), ancestry B04006 (Armenian line 16, Iranian
  48, Russian 64) and country of birth B05006 (Armenia 80, Iran 61, Russia 42).
- State totals: Spanish 10,513,931 speakers (28.3%; 4,107,223 limited English), Chinese
  1,291,832, Tagalog 773,155, Vietnamese 562,956, Korean 356,231, Slavic group 278,007,
  Arabic 221,836; Armenian ancestry 251,808, Iranian ancestry 223,959.

**State row (for sense-checking the build):** population 39,287,377; households 13,548,091;
median household income $99,122; median home value $734,700; owners 55.9%; one-unit detached
57.0%; 5+ units 24.1%; mobile homes 513,758 (3.5%); median year built 1976; built before 1980
56.0%; mortgage 67.4% of owners; vacant 7.5%; seasonal 357,596; households over $100k 49.6%;
65 and over 15.7%.

**Files**
- `DL/acs/get_acs.py`, `get_acs_puma.py`, `make_ca_acs_columns.py`, logs beside them
- `DL/acs/raw/ca_acs5y2024_<table>.dat` (32 files; rows as published, header first; 4,422 lines each)
- `DL/acs/raw/ca_acs5y2024_{b16001,c16001,b01003}_puma.dat` (556 rows each)
- `DL/acs/raw/ca_Geos20245YR.txt`, `ACS20245YR_Table_Shells.txt`, `manifest_acs.jsonl` (URL, bytes, sha256, Last-Modified, rows kept)
- `DL/acs/raw/ca_2020_Census_Tract_to_2020_PUMA.txt` (9,129 tracts), `ca_tab20_zcta520_tract20_natl.txt` (15,104 parts)
- `DL/acs/raw/check_la/` (Louisiana 70001 rows used for the formula test)
- `DL/acs/derived/ca_zcta_acs_columns.csv` (1,808 rows), `ca_county_acs_columns.csv` (58),
  `ca_place_acs_columns.csv` (1,618), `ca_state_acs_columns.csv` (1): 71 columns in Louisiana names

**Limits.** No API (key needed). Negative ACS sentinels (-666666666) are blanked in the derived
files, left as published in `raw/`. Margins of error are in `raw/` only. ZCTAs are 2020 ZCTAs.

## 2. Geometry — DONE (nothing simplified)

| layer | source file (zip size) | California features | points | GeoJSON size |
|---|---|---|---|---|
| ZCTAs 2020 | `GENZ2020/shp/cb_2020_us_zcta520_500k.zip` (66.7 MB, national, about 33,800 polygons) | 1,808 | 335,336 | 8.39 MB |
| counties 1:500k | `GENZ2024/shp/cb_2024_us_county_500k.zip` (11.6 MB) | 58 | 39,692 | 0.98 MB |
| counties 1:5m | `cb_2024_us_county_5m.zip` (3.0 MB) | 58 | 8,690 | 231 KB |
| counties 1:20m | `cb_2024_us_county_20m.zip` (0.9 MB) | 58 | 1,848 | 64 KB |
| state outline 1:500k | `cb_2024_us_state_500k.zip` (3.2 MB) | 1 | 5,115 | 138 KB |
| state outline 1:5m / 1:20m | `cb_2024_us_state_5m.zip`, `_20m.zip` | 1 | 2,411 / 468 | 63 KB / 12 KB |
| neighbours (OR, NV, AZ) 1:5m | same state file | 3 | 2,698 | 69 KB |
| places (cities + CDPs) | `GENZ2024/shp/cb_2024_06_place_500k.zip` (1.4 MB) | 1,618 | 119,694 | 3.37 MB |
| water, all | TIGER/Line 2025 `AREAWATER/tl_2025_06<county>_areawater.zip` x 58 (25.6 MB) | 38,839 | 2,276,516 | 63.0 MB |
| water, 0.5 km2 and larger | same | 936 | 988,590 | 23.7 MB |
| water, USGS 1:1,000,000 | `wtrbdyp010g.shp_nt00886.tar.gz` (35.2 MB, national) | 448 | 41,367 | 1.81 MB |

URLs: `https://www2.census.gov/geo/tiger/GENZ2020/shp/`, `.../GENZ2024/shp/`,
`https://www2.census.gov/geo/tiger/TIGER2025/AREAWATER/`,
`https://prd-tnm.s3.amazonaws.com/StagedProducts/Small-scale/data/Hydrography/wtrbdyp010g.shp_nt00886.tar.gz`.
- ZCTA boundaries exist only in the 2020 cartographic set (none in the 2023, 2024 or 2025 sets). County,
  state and place files are the 2024 vintage, the boundary year of ACS 2020-2024, so the 1,618
  place codes match the ACS place rows one for one.
- **Places with population and coordinates:** polygons above; coordinates and land area from
  `https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2024_Gazetteer/2024_gaz_place_06.txt`
  (1,618 rows: GEOID, NAME, LSAD, ALAND, AWATER, INTPTLAT, INTPTLONG; the 2025 file has 1,619);
  population from ACS B01003 by place (`DL/acs/derived/ca_place_acs_columns.csv`, join on GEOID).
  Counties: `2024_gaz_counties_06.txt` (58 rows).
- Water: the USGS layer (448 lakes, reservoirs, bays) is the light choice for a state map;
  the TIGER layer is the detailed one and includes the ocean and bay polygons.
- Also fetched, not cut: `cb_2024_06_cousub_500k`, `cb_2024_us_cbsa_500k`, `cb_2024_us_nation_5m`, `cb_2020_06_place_500k`.

**Files:** `DL/geo/get_geo.sh`, `filter_ca.py`; zips in `DL/geo/raw/zips/`; unpacked shapefiles in
`DL/geo/raw/<name>/`; California cuts in `DL/geo/raw/ca/*.geojson` with `sizes.tsv`;
gazetteers in `DL/geo/raw/gazetteer/`. All 72 zips pass `unzip -t`.
**Limits.** GeoJSON is NAD83 as published. The shapefile reader (pyshp) was installed into
`DL/_scripts/pylib` only.

## 3. ZIP to city, ZIP to county, land and water area — DONE

One row per ZCTA: `DL/xwalk/raw/ca_zcta_crosswalk.csv` (**1,808 rows**, 24 columns).

| need | source that worked | rows |
|---|---|---|
| ZIP to county, largest share | Census 2020 ZCTA-to-county relationship file (URL in section 1); the county with the largest `AREALAND_PART` | 1,808 ZCTAs; 1,633 lie in one county, 156 in two, 18 in three, 1 in four; all parts in `ca_zcta_county_parts.csv` (2,003 rows) |
| land and water area, centre point | `https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2025_Gazetteer/2025_Gaz_zcta_national.zip` (GEOID, ALAND, AWATER, ALAND_SQMI, AWATER_SQMI, INTPTLAT, INTPTLONG) | 1,808 of 1,808 matched |
| ZIP to city, postal name | ZIP Code Business Patterns 2023 totals file, fields `city`, `cty_name` (`https://www2.census.gov/programs-surveys/cbp/datasets/2023/zbp23totals.zip`) | 1,728 of 1,808 |
| ZIP to city, postal name (fills the gaps) | GeoNames postal file `https://download.geonames.org/export/zip/US.zip` (CC BY 4.0: place name, county, lat, lon) | 1,808 of 1,808 (2,593 California ZIP rows in all) |
| ZIP to city, Census place | Census 2020 ZCTA-to-place relationship file `.../rel2020/zcta520/tab20_zcta520_place20_natl.txt`: place with the largest land share, plus the share outside any place | 1,708 of 1,808 have a place part; parts in `ca_zcta_place_parts.csv` |
| ZIP to city, as the insurance department prints it | CDI 2022 FAIR Plan table (section 6) carries County, ZIP, City | 1,719 ZIPs |

- Example: 90210 -> Los Angeles County; postal city BEVERLY HILLS; largest Census place Los
  Angeles city (60.5% of its land). The postal name is the one to show; the Census place is the
  one to use for city totals.
- **Limits.** "Largest share" is by land area, which is what the Census file gives; a
  population-weighted share would need block-level counts (the 1.0 GB
  `tab20_zcta520_tabblock20_natl.txt` plus 2020 block populations) and was not built. The
  HUD-USPS ZIP crosswalk needs an account token and the USPS city-state file is paid: neither
  was used. Business Patterns and insurance files are keyed by postal ZIP, not ZCTA: 2,192
  California ZIPs appear in Business Patterns, 1,728 of them are also ZCTAs (the rest are
  post-office-box and single-site ZIPs that must be folded into a neighbouring ZCTA).

**Files:** `DL/xwalk/get_xwalk.py`, `DL/xwalk/raw/` (relationship files, `geonames_US/`, the three CSVs).

## 4. Businesses by ZIP — DONE

**Vintage:** County Business Patterns **2023** (released 2025-06-26) is the newest:
`https://www2.census.gov/programs-surveys/cbp/datasets/2024/` is empty. Nonemployer Statistics
**2024** (released 2026-09-29).

**Sources that worked**
- `https://www2.census.gov/programs-surveys/cbp/datasets/2023/zbp23detail.zip` (ZIP x NAICS:
  `zip, name, naics, est, n<5 ... n1000, city, stabbr, cty_name`), `zbp23totals.zip` (ZIP totals:
  `emp, qp1, ap, est` with noise flags), `cbp23co.zip` (county x NAICS: `emp, qp1, ap, est`),
  `cbp23st.zip`, `cbp23us.zip`, `cbp23msa.zip`
- `https://www2.census.gov/programs-surveys/nonemployer-statistics/datasets/2024/historical-datasets/nonemp24co.zip`
  (`ST, CTY, NAICS, ESTAB, RCPTOT` in $1,000), `nonemp24st.zip`, `nonemp24us.zip`, `nonemp24msa.zip`

**NAICS map** (reproduces the Louisiana row for 70001: est 1234, retail 98, food 84, lodging 13,
whse 8, mfg 20, church 13, health 144, school 13, apts 9, nonres 7, office 289, auto 9,
roofers 5, builders 30, supply 0, ins_agents 37, adjusters 0):

| column | NAICS code in the file | meaning |
|---|---|---|
| est | `------` | all establishments |
| retail | `44----` | retail trade (44-45) |
| food | `722///` | food services and drinking places |
| lodging | `721///` | accommodation |
| whse | `493///` | warehousing and storage |
| mfg | `31----` | manufacturing (31-33) |
| church | `8131//` | religious organizations |
| health | `62----` | health care and social assistance |
| school | `61----` | educational services |
| apts | `531110` | lessors of residential buildings |
| nonres | `531120` | lessors of nonresidential buildings |
| office | `52----` + `54----` + `55----` | finance and insurance, professional services, management |
| auto | `441///` | motor vehicle and parts dealers |
| roofers | `238160` | roofing contractors |
| builders | sum of the published six-digit `236xxx` rows (236115, 236116, 236117, 236118, 236210, 236220) | matches Louisiana for 70001, 70002, 70003, 70005, 70006; the three-digit `236///` total is larger (36 against 30 in 70001) and is also written as `builders236` |
| supply | `423330` | roofing, siding and insulation material wholesalers |
| ins_agents | `524210` | insurance agencies and brokerages |
| adjusters | `524291` | claims adjusting |

**California rows**
- `zbp23detail`: 317,073 California rows, **2,192 ZIPs**; `zbp23totals`: 2,192 ZIPs.
- State (CBP 2023): 1,029,689 establishments. Roofing contractors 238160: **2,926
  establishments, 23,903 employees, $1.722 billion annual payroll**. Roofing supply 423330: 234
  establishments, 2,948 employees. Insurance agencies 13,919. Claims adjusters 297.
- Roofers by ZIP: **436 ZIPs have a published 238160 cell, summing to 2,241 of the 2,926**
  (77%). Cells with fewer than 3 establishments are withheld, so small towns read zero, as in
  Louisiana.
- Roofers by county: 50 of 58 counties have a published 238160 row (sum 2,919). Missing:
  Alpine, Colusa, Glenn, Inyo, Kings, Mariposa, Modoc, Sierra. Largest: Los Angeles 487,
  San Diego 253, Orange 252, Riverside 186, San Bernardino 165, Sacramento 142, Santa Clara
  141, Alameda 130.
- **Nonemployer Statistics 2024, roofing by county:** the finest industry is NAICS **2381**
  (foundation, structure and building exterior contractors, which holds roofing); 238160 alone
  is not published. California: **17,116 firms without employees, $1.162 billion receipts**;
  55 of 58 counties have a row. All construction (23): 246,176 firms, $18.7 billion.

**Files:** `DL/biz/get_biz.sh`, `make_ca_biz.py`; national files in `DL/biz/raw/<name>/`;
California cuts in `DL/biz/raw/ca/`: `zbp23detail_CA.csv`, `zbp23totals_CA.csv`, `cbp23co_CA.csv`
(45,231 rows), `cbp23st_CA.csv` (10,033), `nonemp24co_CA.csv` (18,961), `nonemp24st_CA.csv`,
**`ca_zip_business_columns_zbp2023.csv`** (2,192 ZIPs x the 18 Louisiana columns plus extras),
**`ca_county_roofing_cbp2023_nes2024.csv`** (58 counties + state row).
**Limits.** Postal ZIPs, not ZCTAs (see section 3). Employment and payroll carry noise flags
(G, H, J) in the `_nf` columns. No API (key needed).

## 5. FEMA — DONE

**Source:** OpenFEMA, no key. `https://www.fema.gov/api/open/<version>/<DataSet>` with
`$filter`, `$top` (10,000 at most), `$skip`, `$orderby=id`, `$format=csv`, `$count=true`.
Data refreshed by FEMA 2026-11-18. Every file's row count equals the count the API reports.

| data set (version) | query that worked | California rows | file under `DL/fema/raw/` |
|---|---|---|---|
| DisasterDeclarationsSummaries (v2) | `$filter=state eq 'CA'` | 1,692 county-level rows = 398 disasters, 1954 to 2026-10-16 | `DisasterDeclarationsSummaries_CA.csv` |
| FemaWebDisasterDeclarations (v1) | `$filter=stateCode eq 'CA'` | 398 (one row per disaster) | `FemaWebDisasterDeclarations_CA.csv` |
| FemaWebDisasterSummaries (v1) | `disasterNumber eq ...` for the 398 numbers | 337 (dollar totals) | `FemaWebDisasterSummaries_CA.csv` |
| IndividualsAndHouseholdsProgramValidRegistrations (v2) | `$filter=damagedStateAbbreviation eq 'CA' and disasterNumber eq <n>` paged | **557,847** in 21 disasters (API count for CA: 557,848; the one other row is filed under Texas disaster 4879 and saved apart) | `ihp/IHP_CA_DR<n>.csv` (21 files, 233 MB), `ihp/IHP_CA_other_disaster_numbers.csv` |
| HousingAssistanceOwners (v2) | `$filter=state eq 'CA'` | 5,791 (disaster x county x city x ZIP; 21 disasters, 1,624 ZIPs; 318,546 owner registrations) | `HousingAssistanceOwners_CA.csv` |
| HousingAssistanceRenters (v2) | `$filter=state eq 'CA'` | 6,698 (21 disasters, 1,711 ZIPs) | `HousingAssistanceRenters_CA.csv` |
| RegistrationIntakeIndividualsHouseholdPrograms (v2) | `$filter=state eq 'CA'` | 8,530 (22 disasters, 1,897 ZIPs) | `RegistrationIntakeIndividualsHouseholdPrograms_CA.csv` |
| IndividualAssistanceHousingRegistrantsLargeDisasters (v1) | `$filter=damagedStateAbbreviation eq 'CA'` | 2 (the set covers Gulf hurricanes; useless for California) | `..._CA.csv` |
| DataSetFields (v1) | all | 1,208 (field dictionary) | `DataSetFields.csv` |

**Declarations 2000 to 2026:** 1,044 county rows = **325 disasters**: 259 fire management (FM),
53 major disaster (DR), 13 emergency (EM). By incident type: Fire 280, Severe Storm 19, Flood 8,
Earthquake 6, Hurricane 3, Biological 2, Dam/Levee Break 2, and one each of Freezing, Tsunami,
Tropical Storm, Winter Storm, Chemical. Fields: `disasterNumber, declarationType,
declarationDate, incidentType, declarationTitle, ihProgramDeclared, iaProgramDeclared,
paProgramDeclared, incidentBeginDate, incidentEndDate, fipsCountyCode, designatedArea`.

**Registrations by ZIP and disaster.** The registration file is one row per household with
`disasterNumber, damagedZipCode, damagedCity, county, censusGeoid (block group), ownRent,
residenceType, homeOwnersInsurance, inspnReturned, rpfvl (real property verified loss),
destroyed, habitabilityRepairsRequired, floodDamage, roofDamage, roofDamageAmount,
foundationDamage, repairAmount, replacementAmount, ihpAmount, haAmount` (100 fields in all).
Fire and quake names in brackets in the table are added for orientation and are not in the FEMA file.
Rolled up in `DL/fema/derived/ihp_ca_by_zip_disaster.csv` (**6,388 ZIP x disaster rows, 1,898
ZIPs**) and `ihp_ca_by_disaster.csv`:

| disaster | declared | incident | registrations | owners | roof flag | verified loss > 0 | destroyed |
|---|---|---|---|---|---|---|---|
| 1498 | 2003-10-27 | Fire (Cedar, Old fires) | 37,935 | 11,407 | 55 | 719 | 1,109 |
| 1505 | 2004-01-13 | Earthquake (San Simeon) | 4,660 | 4,168 | 711 | 3,756 | 3 |
| 1577 | 2005-02-04 | Severe Storm | 26,655 | 12,536 | 1,251 | 7,857 | 34 |
| 1628 | 2006-02-03 | Severe Storm | 5,119 | 3,236 | 258 | 2,630 | 33 |
| 1731 | 2007-10-24 | Fire | 18,804 | 8,807 | 279 | 2,465 | 1,320 |
| 1810 | 2008-11-18 | Fire | 2,487 | 1,224 | 47 | 1,009 | 745 |
| 4193 | 2014-09-11 | Earthquake (Napa) | 7,091 | 5,183 | 494 | 4,333 | 10 |
| 4240 | 2015-09-22 | Fire (Valley, Butte) | 3,716 | 2,237 | 27 | 1,243 | 1,727 |
| 4344 | 2017-10-10 | Fire (North Bay) | 23,610 | 14,680 | 12 | 601 | 1,845 |
| 4353 | 2018-01-02 | Fire, mudflows (Thomas) | 3,706 | 2,035 | 17 | 418 | 399 |
| 4382 | 2018-08-04 | Fire and high winds (Carr) | 4,282 | 2,552 | 8 | 311 | 564 |
| 4407 | 2018-11-12 | Fire (Camp, Woolsey) | 27,057 | 15,773 | 30 | 3,397 | 9,387 |
| 4482 | 2020-03-22 | COVID-19 (not property) | 48,481 | 1,896 | 0 | 0 | 0 |
| 4558 | 2020-08-22 | Fire | 21,722 | 10,957 | 0 | 998 | 595 |
| 4569 | 2020-10-16 | Fire | 8,688 | 4,729 | 0 | 363 | 121 |
| 4610 | 2021-08-24 | Fire | 1,997 | 905 | 0 | 138 | 281 |
| 4683 | 2023-01-14 | Winter storms, flooding | 25,093 | 16,474 | 0 | 5,866 | 24 |
| 4699 | 2023-04-03 | Winter storms, straight-line winds | 17,435 | 10,056 | 0 | 4,143 | 37 |
| 4707 | 2023-04-25 | Winter storms, mudslides | 533 | 463 | 0 | 277 | 1 |
| 4758 | 2024-02-19 | Storm and flooding (San Diego) | 7,658 | 3,358 | 0 | 1,439 | 0 |
| 4856 | 2025-01-08 | Wildfires and straight-line winds (Los Angeles) | 261,118 | 185,871 | 0 | 9,795 | 11,562 |

**Limits, plainly.**
- **The roof-damage flag is empty from 2020 on** (last non-zero: 2018), the same break the
  Louisiana atlas met. From 2020 use verified real property loss without flood damage
  (`rpfvl > 0 and floodDamage = 0`, column `rpfvl_noflood_n`) and `destroyed`.
- There is no wind-damage or fire-damage field. Fire and wind are known only from the
  disaster's incident type; fire losses show up mostly as `destroyed`.
- Registrations start in 2003. Nothing by ZIP exists for 2000 to 2002, and most of the 325
  declarations (all 259 fire management grants, public-assistance-only storms such as the 2017
  and 2019 winter storms) have no household registrations at all.
- Housing assistance tables give FEMA-inspected damage bands by ZIP, not roof damage.

**Files:** `DL/fema/get_fema.py` (resumable), `summarize_ihp.py`, `raw/manifest_fema.json`.

## 6. Insurance — DONE (public files); PDFs parsed to CSV

### 6a. California Department of Insurance
Index pages: `https://www.insurance.ca.gov/01-consumers/200-wrr/DataAnalysisOnWildfiresAndInsurance.cfm`,
`.../01-consumers/200-wrr/WildfireRiskInfoRpt.cfm`,
`https://www.insurance.ca.gov/0400-news/0200-studies-reports/0250-homeowners-study/index.cfm`.
All files are under `https://www.insurance.ca.gov` + the path shown. The server resets
connections that arrive close together: one request every 5 seconds with retries got all 16.

| file (path) | vintage | what it holds | California rows | flat copy in `DL/insurance/derived/` |
|---|---|---|---|---|
| `/01-consumers/200-wrr/upload/Residential-Insurance-Voluntary-Market-New-Renew-NonRenew-by-ZIP-2020-2023.xlsx` | 2020-2023 (newest posted) | County, ZIP Code, Year, New, Renewed, Non-Renewed | 8,032 rows, 2,171 ZIPs x 4 years | `cdi_new_renew_nonrenew_zip_2020_2023.csv` |
| `/01-consumers/200-wrr/upload/Residential-Property-Voluntary-Market-New-Renew-NonRenew-by-ZIP-2015-2021.xlsx` | 2015-2021 | County, ZIP, Year, New, Renewed, Insured-Initiated Nonrenewed, Insurer-Initiated Nonrenewed | 15,538 rows, 2,654 ZIPs x 7 years | `cdi_new_renew_nonrenew_zip_2015_2021.csv` |
| `/01-consumers/200-wrr/upload/Residential-Property-Coverage-Amounts-Wildfire-Risk-and-Losses.xlsx` (Insurance Code 929 / SB 824 report) | 2018-2023 | per ZIP x year x policy type (HO homeowners, DO and DT dwelling fire owner and tenant, RT renters, CO condo, MH mobile home, **FP FAIR Plan**) x source: earned premium, earned exposure, average Coverage A and C, average protection class, average fire risk score, exposure counts by wildfire risk (negligible, low, moderate, high, extreme), fire and smoke claims and losses, catastrophe and not | **197,290 records, 2,522 ZIPs** | `cdi_wildfire_risk_records.csv` (32 columns) |
| `/01-consumers/200-wrr/upload/Number-of-Residential-Dwelling-Units-Insured-in-2022-FAIR-Plan-vs-Voluntary.pdf` | 2022 | County, ZIP, City, units insured by the voluntary market, units insured by the FAIR Plan, FAIR Plan % | 1,719 ZIPs (8,210,510 voluntary, 269,468 FAIR Plan units) | `cdi_fair_vs_voluntary_zip_2022.csv` |
| `/01-consumers/200-wrr/upload/Residential-Insurance-Policy-Analysis-by-County-2020-to-2023-2.pdf`, `...-2015-to-2021-2.pdf` | 2015-2023 | new, renewed, non-renewed by county, with FAIR Plan counts | 58 counties (PDF, text in `derived/txt/`) | not parsed |
| `/01-consumers/200-wrr/upload/Availability-and-Affordability-Report-Appendix-C.pdf` | 2023 report | dwelling units per county in high and very high wildfire risk | 58 counties (PDF) | not parsed |
| `/0400-news/0200-studies-reports/0250-homeowners-study/upload/A-Part-I-Data-Summary.xlsx` | 2008-2023 | statewide written premium, exposures, average premium by policy form and coverage band | statewide | as downloaded |
| `.../0250-homeowners-study/upload/C-<2017,2019,2021,2023>-Number-of-Residential-Property-with-Fire-or-Earthquake-Insurance-by-County.pdf` | 2017-2023 | fire and earthquake policy counts by county | 58 counties x 4 (PDF) | not parsed |
| three fact sheets (2021, 2022, 2023 data) and `Format-of-the-Report-and-Methodology.docx` | | statewide trend tables, method | | as downloaded |

- The wildfire-risk workbook looks like a 6-row summary: it is a pivot table. The ZIP records
  sit in its pivot cache (`xl/pivotCache/pivotCacheRecords1.xml`); `parse_cdi.py` writes them out.
- **Limits.** Newest non-renewal year is **2023**; no 2024 or 2025 file is posted. The 2020-2023
  file no longer splits non-renewals into insurer-initiated and insured-initiated (the 2015-2021
  file does, and the two overlap in 2020 and 2021). ZIP 90000 and blank-county rows are
  "unknown ZIP" buckets. Earthquake Authority data was not looked for.

### 6b. California FAIR Plan Association (its own figures)
Index: `https://www.cfpnet.com/key-statistics-data/`; files under
`https://www.cfpnet.com/wp-content/uploads/2026/10/`. Vintage: **fiscal year end 2026-09-30**,
five year-ends back to 2022-09-30. All 18 PDFs downloaded, converted with `pdftotext -layout`.

| file | what | rows parsed |
|---|---|---|
| `CFP-5-yr-PIF-Zip-FY26-DWE-261020.pdf`, `-COM-`, `-All-` | policies in force by ZIP, residential / commercial / all, 5 year-ends | 1,687 ZIPs each; ZIP sums equal the printed totals exactly |
| `CFP-5-yr-TIV-Zip-FY26-DWE-261020.pdf`, `-COM-`, `-All-` | total insured value (exposure) by ZIP, 5 year-ends | 1,687 ZIPs each |
| `CFP-5-yr-PIF-County-FY26-All-261020.pdf`, `CFP-5-yr-TIV-County-FY26-All-261020.pdf` | the same by county | 58 counties |
| `Policies-by-category-DWE-as-of-260930-DL-261019v001.pdf` | residential policies by ZIP, county, distressed-area flag, region, wildfire risk (low, medium, high) x category (owner-occupied single family, tenant-occupied, renters, condo, other) | 1,662 ZIPs (sum 665,368 of the printed 665,673) |
| `Premium-by-category-DWE-...`, `Exposure-by-category-DWE-...`, and the six `-COM-under-20M-` / `-COM-over-20M-` files | premium and exposure in the same layout; commercial | downloaded, text in `derived/txt/`, not parsed |

State totals: residential policies **665,673** at 2026-09-30 (621,234 in 2025; 449,832 in 2024;
320,572 in 2023; 265,909 in 2022); all lines 686,376; residential exposure $714.7 billion;
576 of the 1,662 ZIPs are flagged distressed.
Parsed: `DL/insurance/derived/fairplan_zip_5yr.csv` (5,061 rows = 1,687 ZIPs x 3 lines),
`fairplan_county_5yr.csv`, `fairplan_zip_category_dwe_20260930.csv`.

**Files:** `DL/insurance/get_cdi.sh`, `get_fairplan.sh`, `parse_cdi.py`, `parse_fairplan.py`;
downloads in `DL/insurance/raw/cdi/` (16 files), `raw/fairplan/` (18), saved index pages in `raw/pages/`.

## 7. Contractors State License Board, C-39 Roofing — DONE

**Source that worked:** the board's public data portal, statewide "License Master" file
(page `https://www.cslb.ca.gov/onlineservices/dataportal/ContractorList.aspx`), as a workbook:
`https://www.cslb.ca.gov/onlineservices/dataportal/DownLoadFile.ashx?fName=MasterLicenseData&type=X`
(56.3 MB xlsx, 24 seconds on the try that completed). Data current to November 2026.
52 fields: `LicenseNo, LastUpdate, BusinessName, FullBusinessName, MailingAddress, City, State,
County, ZIPCode, BusinessPhone, BusinessType, IssueDate, ExpirationDate, InactivationDate,
ReactivationDate, PrimaryStatus, SecondaryStatus, Classifications(s)`, then workers'
compensation and bond fields. The file lists renewed (active) licences only: every row
expires in 2026 or later and every inactivation date is followed by a reactivation date.

**Rows:** **245,550 licences** statewide, all classifications.

**C-39 Roofing** (a licence is C-39 when `C39` is one of the codes in `Classifications(s)`):
- **5,829 C-39 licences on the active roll; 5,586 with status CLEAR (active and unsuspended)**;
  243 suspended (169 of them for lapsed workers' compensation); 3,933 hold C-39 and nothing
  else; 5,659 have a California mailing address, 170 are out of state.
- That is about 2.0 C-39 licences per employer roofing establishment (2,926 in Business
  Patterns 2023), so many licensees have no payroll.
- By county, CLEAR licences (56 of 58 counties have one or more): Los Angeles 1,178, Orange
  454, San Diego 418, Riverside 355, San Bernardino 311, Sacramento 284, Santa Clara 221,
  Alameda 204, Contra Costa 171, Ventura 168, Fresno 128, Placer 105.
- By mailing city (657 California cities): Los Angeles 165, San Jose 131, Sacramento 116, San
  Diego 100, Fresno 85, San Francisco 76, Bakersfield 67, Riverside 66, Anaheim 64.
- By mailing ZIP: 1,270 California ZIPs carry one or more (top: 94124 with 28, 92806 with 24).

**Files**
- `DL/cslb/get_cslb.sh`, `count_c39.py`, `cslb_postback.py` (the form helper that was refused)
- `DL/cslb/raw/master/MasterLicenseData.xlsx` (passes the zip test)
- `DL/cslb/derived/c39_licences.csv` (5,829 rows: licence number, business name, city, county,
  ZIP, status, dates, classifications; no phone or street address), `c39_by_county.csv` (86
  rows incl. out of state), `c39_by_city.csv` (776), `c39_by_zip.csv` (1,414)

**Limits and failures, plainly**
- The csv variant (`type=C`) cannot be completed: the server sends it at about 480 KB/s and
  closes the connection at 150 seconds, so it always arrives about 5% short (four attempts).
  The xlsx variant also failed four times (cut at 150 seconds or dropped mid-way) before one
  clean run; expect to retry.
- The portal's "List of contractors by classification" and "by classification and county"
  pages (`ListByClassification.aspx`, `ListByCounty.aspx`) are form postbacks; the site's
  firewall answered the scripted request with "Request Rejected". I did not disguise the
  client as a browser to get past it; the master file made it unnecessary.
- Counts are by the licence's mailing address: where the firm is, not where it works.
- Inactive and expired-but-renewable C-39 licences are not in this file, so 5,829 is the active
  roll, not everyone who ever held the classification.

## 8. American Housing Survey — DONE

**Vintage:** **2023** is the newest. There is no 2025 survey folder; the next thing posted is
the 2026-2027 questionnaire (`https://www2.census.gov/programs-surveys/ahs/2026/`).

**Sources that worked** (public use microdata, comma-delimited: `household.csv`, `project.csv`,
`person.csv`, `mortgage.csv`):
- `https://www2.census.gov/programs-surveys/ahs/2023/AHS%202023%20National%20PUF%20v1.1%20CSV.zip` (129 MB)
- `https://www2.census.gov/programs-surveys/ahs/2023/AHS%202023%20Metropolitan%20PUF%20v1.1%20CSV.zip` (20 MB)
- `https://www2.census.gov/programs-surveys/ahs/2021/AHS%202021%20Metropolitan%20PUF%20v1.0%20CSV.zip` (45 MB)
- value labels, table specifications, sample design PDFs from the same 2023 folder

**Which California metros are sampled**
- 2023 national file (`OMB13CBSA`): **Los Angeles-Long Beach-Anaheim (31080), San
  Francisco-Oakland-Hayward (41860), Riverside-San Bernardino-Ontario (40140)**.
- 2021 metropolitan file: **San Jose-Sunnyvale-Santa Clara (41940)**; it was not re-surveyed in 2023.
- **San Diego and Sacramento are not sampled** as separate metros in 2021 or 2023 (the 2023
  metropolitan file holds Cincinnati, Cleveland, Denver, Milwaukee and New Orleans only). They
  fall in "all other metropolitan areas"; use the Pacific division figures for them.

**Definitions** (they return the Louisiana "ahs" block exactly for the West South Central
division: rate 5.63, diy 15.6, med 10000, mean 12557, ins 41.4, leak 4.14). Universe: owner-occupied
one-family houses, detached or attached (`TENURE = 1`, `BLD` 02 or 03). Roofing job =
`project.csv` row with `JOBTYPE = 16` ("Added or replaced roofing"), reported for the two years
before the interview. Weight `WEIGHT`.

| area (file) | owners sampled | roofing jobs sampled | share replacing in 2 years | per year (`rate`) | done by owner (`diy`) | median cost, hired (`med`) | mean cost, hired (`mean`) | paid by insurance (`ins`) | roof leak in 12 months (`leak`) |
|---|---|---|---|---|---|---|---|---|---|
| Los Angeles (2023) | 757 | 71 | 9.77% | 4.89% | 8.5% | $14,300 | $14,378 | 2.0% | 7.08% |
| San Francisco-Oakland (2023) | 879 | 66 | 7.63% | 3.82% | 7.8% | $15,000 | $19,654 | 1.3% | 6.36% |
| Riverside-San Bernardino (2023) | 925 | 60 | 5.87% | 2.94% | 25.6% | $10,000 | $12,094 | 8.4% | 6.23% |
| the three pooled (2023) | 2,561 | 197 | 8.26% | 4.13% | 11.5% | $14,300 | $15,204 | 3.0% | 6.69% |
| San Jose (2021) | 979 | 71 | 7.32% | 3.66% | 8.8% | $16,900 | $19,776 | 0.0% | 1.92% |
| Pacific division (2023) | 4,712 | 364 | 7.33% | 3.67% | 15.6% | $13,700 | $15,591 | 3.5% | 5.25% |
| West region (2023) | 6,524 | 511 | 7.30% | 3.65% | 14.7% | $12,000 | $14,101 | 9.5% | 4.87% |
| United States (2023) | 25,017 | 2,413 | 9.86% | 4.93% | 13.4% | $10,000 | $12,573 | 24.3% | 4.28% |
| West South Central (2023), Louisiana's block | 3,286 | 362 | 11.25% | 5.63% | 15.6% | $10,000 | $12,557 | 41.4% | 4.14% |

- Costs are for jobs not done by the household (`JOBDIY = 2`), cost above zero; insurance share
  is `JOBFUNDS = 4` (homeowner's insurance settlement) over all roofing jobs.
- The California finding: **insurance pays for about 2 to 3 percent of roof jobs** in the
  California metros against 41 percent in Louisiana's division, and jobs cost about 40% more.
- Mobile homes, owners: Pacific division 8.4% in two years, 60% done by the owner (19 jobs
  sampled: too thin); West region 8.3%, 46% by owner, median hired cost $7,000 (22 costs).
- By year built (West region, per-year rate): before 1960 4.16%, 1960-79 4.69%, 1980-89 3.56%,
  1990-99 4.10%, 2000-09 3.06%, 2010-19 1.09%.

**Limits.** Metro cells rest on 60 to 71 sampled roofing jobs each: treat them as plus or
minus a third. No sampling errors were computed (replicate weights are in the file). San Jose
is two years older than the others.

**Files:** `DL/ahs/get_ahs.sh`, `ahs_roofing.py`; unpacked microdata in `DL/ahs/raw/<name>/`;
results in `DL/ahs/derived/ahs2023_national_roofing.json`, `ahs2021_metro_roofing.json`,
`ahs2023_metro_roofing.json` (and `.txt` copies).

## 9. Roofing contractor revenue and establishments — DONE

| source | vintage | California, roofing contractors | file |
|---|---|---|---|
| Economic Census, `https://www2.census.gov/programs-surveys/economic-census/data/2022/sector23/EC2223BASIC.zip` (NAICS 238160, state row `0400000US06`) | 2022 | **2,781 establishments, 2,762 firms, revenue $6.207 billion**, payroll $1.588 billion, 25,383 employees; value of construction work $6.056 billion; materials $2.116 billion; subcontracted $346 million; value added $3.592 billion; advertising bought $35.2 million | `DL/econ/raw/ca/EC2223BASIC_CA_roofing.dat` |
| same folder, `EC2223KOB.zip` (revenue by kind of work) | 2022 | of the $6.207 billion: roofing work $5.733 billion, waterproofing $184 million, metal curtain wall $72 million, gutters $47 million, siding $21 million | `EC2223KOB_CA_roofing.dat` |
| same folder, `EC2223VALCON.zip` (where the work was done) | 2022 | $6.015 billion of the $6.056 billion was done in California | `EC2223VALCON_CA_roofing.dat` |
| same folder, `EC2223LOCCONS.zip` (establishments by size) | 2022 | 2,147 operated all year: 1,175 under 5 employees, 438 with 5-9, 291 with 10-19, 163 with 20-49, 49 with 50-99, 25 with 100-249 | `EC2223LOCCONS_CA_roofing.dat` |
| Statistics of U.S. Businesses, `https://www2.census.gov/programs-surveys/susb/tables/2022/us_state_6digitnaics_2022.txt` | 2022 | 2,775 firms, 2,795 establishments, 24,523 employees, receipts $5.996 billion; by firm size: under 5 employees 1,681 firms $770 million; 5-9 555 firms $718 million; 10-19 295 firms $780 million; 20-99 212 firms $2.013 billion; 100-499 27 firms $1.259 billion; 500+ 5 firms $455 million | `DL/econ/raw/ca/susb2022_CA_roofing.csv` |
| County Business Patterns (section 4) | 2023 | 2,926 establishments, 23,903 employees, payroll $1.722 billion; 50 counties published | `DL/biz/raw/ca/cbp23st_CA.csv`, `ca_county_roofing_cbp2023_nes2024.csv` |
| Nonemployer Statistics (section 4), NAICS 2381 | 2024 | 17,116 firms without employees, receipts $1.162 billion (all exterior trades, roofing not split out) | `DL/biz/raw/ca/nonemp24st_CA.csv`, `nonemp24co_CA.csv` |
| BLS Quarterly Census of Employment and Wages, `https://data.bls.gov/cew/data/api/2025/a/industry/23816.csv` (also `238161` residential, `238162` nonresidential; 2024 annual; 2026 first quarter) | 2025 annual | 3,640 establishments, 32,614 employees, wages $2.449 billion, average pay $75,076. Residential roofing 3,246 establishments, 21,570 employees; nonresidential 395 establishments, 11,044 employees. County rows for the larger counties | `DL/econ/raw/qcew/qcew_2025_a_23816.csv` and 9 more |

- Louisiana's summary block maps to: `cbp.est` 2,926, `cbp.emp` 23,903, `cbp.ap` 1,721,609
  ($1,000), `cbp.sup_est` 234, `cbp.sup_emp` 2,948, `nes.est2381` 17,116, `nes.rcpt2381` 1,161,695.
- **Limits.** The Economic Census publishes 238160 for the nation and states only in this
  file: no county or metro revenue. BLS has no code 238160 (`.../industry/238160.csv` is a 404):
  it splits roofing into 238161 and 238162 under 23816. Employer counts differ by source
  (2,781 to 3,640) because of year and coverage.

**Files:** `DL/econ/get_econ.sh`; `DL/econ/raw/EC2223*/`, `raw/susb/`, `raw/qcew/`, `raw/ca/`.

## 10. Building permits by county (asked for by the coordinator, as in the Louisiana atlas) — DONE

- Census Building Permits Survey: `https://www2.census.gov/econ/bps/County/co<yyyy>a.txt`
  (annual 2005 to 2025) and `co2609y.txt` (2026 year to date through September; `co2509y.txt`
  for the same months of 2025). Fields per county: buildings, units and value for 1-unit,
  2-unit, 3-4 unit and 5+ unit structures, estimated and reported-only.
- **58 California rows in each of the 23 files.** State: 2025 = 103,856 units (57,739
  one-unit); 2026 through September = 83,850 units (43,331 one-unit) against 77,096 (44,217)
  a year earlier; 2005 = 205,020 units (154,703 one-unit).
- Files: `DL/permits/get_permits.sh`, `DL/permits/raw/national/`, `DL/permits/raw/ca/ca_co*.txt`.

## 11. What could not be had, in one place

1. Census Data API: needs a key for every data call (bulk files used instead; nothing lost).
2. Armenian, Persian and Russian speakers by ZIP, city or county: not published. PUMA rows
   (281), plus ZCTA ancestry and country-of-birth counts, were taken as stand-ins.
3. County Business Patterns 2024: not posted; 2023 used. Roofers by ZIP are withheld below 3
   establishments (436 ZIPs show 2,241 of the state's 2,926).
4. Nonemployer roofing alone: not published; NAICS 2381 (all exterior trades) is the finest.
5. FEMA roof-damage flag: empty from 2020 on; no wind or fire damage field; no ZIP data
   before 2003 or for fire management and public-assistance-only declarations.
6. Insurance non-renewals after 2023 and insurer-initiated split after 2021: not posted.
   County PDFs and FAIR Plan premium/exposure-by-category PDFs were downloaded but not parsed.
7. American Housing Survey: no 2025 survey; San Diego and Sacramento are not sampled; San Jose
   is 2021.
8. Roofing revenue below state level: not in the Economic Census file.
9. ZIP-to-county by population share: not built (land-area share only). HUD-USPS crosswalk
   needs a token.
10. CSLB lists by classification: firewall refused the scripted form; the full master file
    was obtained instead (after several cut-off downloads).

Disk used by `DL/`: about 2.5 GB (AHS microdata 860 MB, Business Patterns 640 MB, geometry
510 MB, FEMA 233 MB).
