# California live sources for the Scout tab: what was tested on 2026-11-19

Every request below was sent with `curl -H "Origin: null"` (a page opened from disk) through the session proxy, with TLS
checks on. "ACAO" is the `Access-Control-Allow-Origin` header that came back. `*` or `null` (the server echoing the origin)
both let a page with origin "null" read the answer; no header means the browser blocks it. All the ArcGIS and Socrata
queries here are plain GETs with no custom headers, so the browser sends no preflight; where a POST is needed it is
form-encoded (`Content-Type: application/x-www-form-urlencoded`), which is also preflight-free.

SP = `/tmp/claude-0/-home-user-Leviathan/3de4e742-518d-5f10-b5db-2b34e6723642/scratchpad`. Samples are under
`SP/ca/dl/scout/<topic>/`; the scripts that made them are under `SP/research/ca/scout_scripts/`.
Boxes are written west,south,east,north (longitude, latitude) unless a service wants another order.

The container restarted twice during the work. Tests finished before a restart were not repeated; their samples were on
disk. Sections were written as each finished, so the order in the file is 1, 2, 4, 5, 6, 7, 8, 3 (permits), 9, with the
last part of section 3 (Sacramento, San Jose, Santa Rosa, statewide, summary table) after section 9.

---

## 1. Buildings: FEMA USA Structures (works, same service and fields as Louisiana)

- Endpoint (unchanged from `EP.bldg`):
  `https://services2.arcgis.com/FiaPA4ga0iQKduv3/arcgis/rest/services/USA_Structures_View/FeatureServer/0/query`
- Query that worked (the one `fetchBuildings` already sends, plus `IMAGE_DATE`):
  `?where=1%3D1&geometry=-118.3000,34.0600,-118.2945,34.0645&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=BUILD_ID,OCC_CLS,PRIM_OCC,SEC_OCC,PROP_ADDR,PROP_CITY,PROP_ZIP,HEIGHT,SQFEET,LATITUDE,LONGITUDE,UUID,IMAGE_DATE,IMAGE_NAME,SOURCE,VAL_METHOD,PROD_DATE,OUTBLDG&returnGeometry=true&outSR=4326&geometryPrecision=6&f=geojson`
- Cross-origin: `access-control-allow-origin: *` on the layer description, the count and the query. No preflight.
- Limits: `maxRecordCount` 2000. Formats JSON, geoJSON, PBF. A fuller box comes back with
  `properties.exceededTransferLimit: true` (geoJSON) or `exceededTransferLimit: true` (JSON). Paging works here:
  `&resultOffset=2000&resultRecordCount=2000&orderByFields=OBJECTID` returned the next 2,000 of a 14,821 building box
  (the comment in `scout.js` says the service does not page; it does now, so quartering is optional).
- Fields are the same 36 as in Louisiana: `OCC_CLS, PRIM_OCC, SEC_OCC, PROP_ADDR, PROP_CITY, PROP_ST, PROP_ZIP, OUTBLDG,
  HEIGHT, SQMETERS, SQFEET, H_ADJ_ELEV, L_ADJ_ELEV, FIPS, CENSUSCODE, PROD_DATE, SOURCE, USNG, LONGITUDE, LATITUDE,
  IMAGE_NAME, IMAGE_DATE, VAL_METHOD, REMARKS, UUID, ...`. Polygons.
- California holds 11,978,450 structures (`where=STATE_FIPS='06'&returnCountOnly=true`). By `OCC_CLS`: Residential
  10,772,686; Commercial 368,770; Agriculture 208,378; Education 165,264; Industrial 162,977; Unclassified 139,503;
  Government 92,210; Assembly 47,087; Utility and Misc 21,575 (a group-by that took about two minutes).

Test boxes (all HTTP 200, ACAO `*`, 0.4 to 0.6 s):

| Box (w,s,e,n) | Buildings | HEIGHT filled | IMAGE_DATE | Sample |
|---|---|---|---|---|
| Los Angeles, Koreatown -118.3000,34.0600,-118.2945,34.0645 | 70 | 60 of 70 (2.6 to 99 m) | 2012-10-17 (60), 2024-08-17 (9) | `buildings/fema_la_koreatown.geojson` |
| Los Angeles, downtown -118.2600,34.0450,-118.2500,34.0530 | 113 | 99 of 113 (to 193 m) | 2012-10-17 (99), 2024-09-22 (8) | `buildings/fema_la_downtown.geojson` |
| San Francisco, Mission -122.4200,37.7580,-122.4145,37.7625 | 118 | 101 of 118 | 2012-10-01 (101), 2024-10-08 (16) | `buildings/fema_sf_mission.geojson` |
| Sierra: Truckee -120.1900,39.3250,-120.1800,39.3320 | 237 | 0 of 237 | 2015-08-13 | `buildings/fema_truckee.geojson` |
| Desert: Twentynine Palms -116.0600,34.1320,-116.0500,34.1400 | 469 | 0 of 469 | 2024-07-19 (438), 2016-05-12 (31) | `buildings/fema_twentynine_palms.geojson` |

The layer description is saved as `buildings/usa_structures_layer.json`.

What is different from Louisiana, measured on 2,000 building samples in 25 California places:

- `PROP_ADDR` is empty in every place sampled (0% in all 25: Los Angeles, Van Nuys, Long Beach, San Diego, Coronado,
  Anaheim, Riverside, San Bernardino, San Francisco, Oakland, San Jose, Sacramento, Fresno, Bakersfield, Stockton, Santa
  Rosa, Redding, South Lake Tahoe, Mammoth Lakes, Palm Springs, Barstow, Eureka, Paradise, Pacific Palisades, Altadena).
  Baton Rouge is 96% filled in the same service. In California the address has to come from the parcel (situs) or from
  the geocoder.
- `HEIGHT` is filled only on the footprints whose `SOURCE` is `NGA` (2010 to 2012 lidar era, metro areas): central Los
  Angeles 65%, Anaheim 78%, San Francisco Sunset 79%, Oakland 74%, Coronado 67%, Stockton 50%, Van Nuys 46%, San Jose
  40%, Sacramento 40%, San Diego North Park 40%, Long Beach 39%, Altadena 33%, San Bernardino 23%, Fresno 23%,
  Bakersfield 22%, Riverside 13%. It is 0% in Santa Rosa, Redding, South Lake Tahoe, Mammoth Lakes, Palm Springs, Barstow,
  Eureka, Paradise, Pacific Palisades, Truckee and Twentynine Palms (all `SOURCE` = `ORNL`).
- `OCC_CLS` is known (not `Unclassified`) for 92% to 99.8% of buildings in every place.
- `IMAGE_DATE` is 2010 to 2012 on the NGA footprints and 2014 to 2024 on the ORNL ones (2024 in much of Los Angeles,
  San Diego, Fresno, Bakersfield, Riverside, Santa Rosa, Eureka, Mammoth Lakes; 2023 in San Jose, Sacramento, Barstow;
  2022 in Pacific Palisades and Redding; 2021 in South Lake Tahoe and Stockton; 2016 in Palm Springs).

What did not work:

- Statewide counts on unindexed fields (`PROP_ADDR IS NOT NULL`, `HEIGHT > 0`, `IMAGE_DATE >= ...`, a group-by on
  `SOURCE,VAL_METHOD`) return `{"error":{"code":400,"details":["Unable to perform query..."]}}`. Box queries are fast.
- USACE National Structure Inventory (`https://nsi.sec.usace.army.mil/nsiapi/structures?bbox=...&fmt=fc`) answers with a
  point per structure carrying `occtype, num_story, sqft, found_type, bldgtype, med_yr_blt` (a census median, the same
  year on all 153 structures of the test box), but sends **no** `Access-Control-Allow-Origin` for any origin, so a
  browser cannot read it. Sample: `buildings/nsi_san_bernardino_box.geojson`.

---

## 2. Parcels with year built and use

All are ArcGIS REST layers queried exactly like `EP.parcel` (`where=1=1&geometry=<w,s,e,n>&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=...&returnGeometry=true&outSR=4326&geometryPrecision=6&f=json`),
except San Francisco (Socrata). `f=geojson` also works on every one. One line per test is in
`parcels/parcels_summary.jsonl` (the full query URL, bytes, seconds, counts); a 25 parcel sample of each is
`parcels/<key>_parcels_box_sample.json`.

| County | Year built | Use | Situs address | ACAO | Record limit | Parcels in layer |
|---|---|---|---|---|---|---|
| Los Angeles | `YearBuilt1`..`5`, `EffectiveYear1`..`5` (95% valid in test box) | `UseType`, `UseDescription`, `UseCode` | `SitusFullAddress` | `null` (echo) | 1000 | 2,433,681 |
| San Diego | `year_effective`, two digits (83% filled) | `nucleus_use_cd`, `asr_landuse` | `situs_address` + `situs_street` + `situs_suffix` | `null` (echo) | 2000 | 1,088,570 |
| Orange | `YEAR_BUILT` (82% valid) | none in this layer (use SCAG land use, below) | `SITE_ADDRESS` | `null` (echo) | 1000 | 703,000 |
| Riverside | `YEAR_BUILT` in table 80, joined by APN; also `ROOF_TYPE` | `CLASS_CODE` | `SITUS_STREET` | `null` (echo) | 2000 | 847,641 (table 1,205,360 rows) |
| San Bernardino | **none public** (`BaseYear` is the tax base year) | `AssessClass`, `AssessDescription` | none | `*` | 1000 | 840,352 |
| Santa Clara | `Year_Built` (98% valid) | none in this layer | `Situs_Address_Full` | `*` | 2000 | 505,060 |
| Alameda | **none public** | `UseCode` | `SitusAddress` | `*` | 2000 | 489,727 |
| Contra Costa | `YR_HS_BLT` (84% valid), `YR_BUILT` (non-residential) | `USE_CODE`, `Description` | `full_address_display` | `null` (echo) | 2000 | 387,980 |
| Sacramento | **none public** | `LU_GENERAL`, `LU_SPECIF`, `LU_DETAIL` | `STREET_NBR` + `STREET_NAM` | `*` | 2000 | 502,528 |
| San Francisco | `year_property_built` (95% valid) | `use_definition`, `property_class_code_definition` | `property_location` | `*` | Socrata `$limit` | 211,547 rows in roll year 2025 |
| San Mateo | **not usable** (`OFFICEYEARBUILT` filled on 705 of 235,488 parcels) | `PUCDESC` empty in the test box | `SITUS_ADDR` | `null` (echo) | 2000 | 235,488 |
| Fresno | **none public** (APN only) | none | none | `*` | 2000 | 310,608 |
| Kern | **none public** (APN only) | none | none | `*` | 2000 | 424,125 |
| Ventura | `YR_BLT` (two layers, snapshot of 2023-05-03) | none | none | `*` | 2000 | 202,132 + 23,595 |
| San Joaquin | `YEAR_BUILT` (95% valid), `STORIES` | `USECODE`, `DESCRIPTION`, `CATEGORY` | `FULL_ADDRESS` | `*` | 2000 | 253,737 |
| Sonoma | `BuildingPrimaryYearBuilt` (93% valid), `BuildingPrimaryEffectiveYear` | `UseCode`, `UseCodeDescription`, `UseCodeType` | `SitusFormatted1` | `null` (echo) | 2000 | 189,239 |
| Placer | **none public** | `UseCode`, `UseCodeName` | `SitusAddressFull` | `*` | 2000 | 199,346 |

Large counties with no public year built that a browser can query: **San Bernardino, Alameda, Sacramento, San Mateo,
Fresno, Kern, Placer**. (Orange, Santa Clara and Ventura have the year but no use code in the same layer.)

### Per county: URL, fields, test

**Los Angeles County Assessor.**
`https://public.gis.lacounty.gov/public/rest/services/LACounty_Cache/LACounty_Parcel/MapServer/0/query`
with `outFields=AIN,APN,SitusFullAddress,SitusAddress,SitusCity,SitusZIP,UseCode,UseType,UseDescription,YearBuilt1,EffectiveYear1,YearBuilt2,Units1,SQFTmain1,Roll_Year,DesignType1`.
Box -118.3050,34.0480,-118.3000,34.0520: 345 parcels, 214 KB, 0.7 s. `YearBuilt1` is a string, `"0000"` when unknown;
329 of 345 were real years. `Roll_Year` 2026. Each parcel carries up to five buildings (`YearBuilt2`..`5`,
`SQFTmain2`..`5`, `Units`, `Bedrooms`, `DesignType`, `QualityClass`). With `outFields=*` the same box is 728 KB (legal
descriptions), so name the fields. Sample: `parcels/la_parcels_box_sample.json` (and the all-field
`parcels/la_county_parcel_sample.json`).

**San Diego County (SANDAG's hosted copy of the SanGIS parcels).**
`https://geo.sandag.org/server/rest/services/Hosted/Parcels/FeatureServer/0/query` with
`outFields=apn,situs_address,situs_pre_dir,situs_street,situs_suffix,situs_suite,situs_community,situs_zip,year_effective,nucleus_use_cd,asr_landuse,unitqty,total_lvg_area,usable_sq_feet,qual_class_shape`.
Box -117.1350,32.7400,-117.1300,32.7440 (North Park): 322 parcels. Two traps:
(1) `year_effective` is the last **two digits** of the effective year (`"25"`, `"02"`), filled on 268 of 322. North Park
reads 14, 22, 24, 25 (1914 to 1925); 4S Ranch reads 02, 03 (2002, 2003). The century has to be inferred (a footprint
whose FEMA `SOURCE` is NGA stood in 2012, so a value above 12 on it is 19xx; `"00"` is ambiguous).
(2) Condominium parcels repeat the whole complex outline: the box came back with 188,308 vertices and 4.6 MB. Add
`&maxAllowableOffset=0.000005` (22,073 vertices, 611 KB) or ask `returnGeometry=false&returnCentroid=true` (96 KB).
`nucleus_use_cd` is the assessor's three digit use code (111 single family, 110/112 other residential, 130 and up
multifamily, 2xx commercial ...). Layer edited 2026-11-03. The county's own server
(`gis-public.sandiegocounty.gov/arcgis/rest/services/sdep_warehouse/PARCELS_ALL`) answers `499 Token Required`.
The same SANDAG folder also serves `Hosted/Address_Points`, `Hosted/Building_Outlines`, `Hosted/Land_Use_2025`.
Sample: `parcels/sd_parcels_box_sample.json`.

**Orange County (OC Survey).**
`https://www.ocgis.com/arcpub/rest/services/Map_Layers/Parcels/FeatureServer/0/query` with
`outFields=SITE_ADDRESS,ASSESSMENT_NO,YEAR_BUILT,NBR_BEDROOMS` (those are all the fields there are).
Box -117.9350,33.8450,-117.9300,33.8490 (Anaheim): 129 parcels, 52 KB, `YEAR_BUILT` valid on 106. No use code: join
SCAG's land use for it (below). Sample: `parcels/oc_parcels_box_sample.json`.

**Riverside County Assessor (two requests).**
Polygons: `https://gis.countyofriverside.us/arcgis_mapping/rest/services/OpenData/Assessor/MapServer/50/query` with
`outFields=APN,SITUS_STREET,SITUS_CITY,ZIP_CODE,CLASS_CODE,MULTIPLE,ACREAGE,LAND,STRUCTURES`.
Characteristics table: `.../OpenData/Assessor/MapServer/80/query?where=PIN IN ('223050004','...')&outFields=PIN,BUILDING_ID,YEAR_BUILT,NUMBER_OF_STORIES,ROOF_TYPE,DESIGN_TYPE,CONSTRUCTION_TYPE,QUALITY_CODE,LIVING_AREA,ACTUAL_AREA,HAS_POOL&f=json`
(GET with 84 APNs was a 1,795 character URL; the same as a form POST also returned ACAO `null`).
Box -117.3800,33.9500,-117.3750,33.9540: 84 parcels; the table returned 141 building rows for all 84 parcels, 136 with a
real `YEAR_BUILT` (1776 is the placeholder for unknown). **`ROOF_TYPE` is a real roof covering field**: `Rock/Composite`,
`Shake/Wood Shingles`, `Tile/Slate`, `Membrane / Asphalt Roll`, `Corrugated Steel`, `Copper`, `Structural Concrete`,
`Other`, `Unknown`. The table has 1,205,360 rows, 904,202 with `YEAR_BUILT > 1800`.
**Caveat:** this worked at the first test (samples saved), then from about 40 minutes later the whole server
(`gis.countyofriverside.us/arcgis_mapping/rest/services`) answered `HTTP 500 Application Error` with no ACAO header on
every URL, including the service root. See the re-test note at the end of this file.
Samples: `parcels/riverside_parcels_crest_sample.json`, `parcels/riverside_property_char_sample.json`.

**San Bernardino County.**
`https://services.arcgis.com/aA3snZwJfFkVyDuP/arcgis/rest/services/Parcels_for_San_Bernardino_County/FeatureServer/0/query`
with `outFields=ParcelNumber,AssessClass,AssessDescription,BaseYear,Zoning,ZoningDescription,Jurisdiction,Acreage,TaxStatus`.
145 parcels in the test box. `AssessClass` (`COMMERCIAL`, `RESIDENTIAL` ...) and `AssessDescription` give the use;
`BaseYear` is the Proposition 13 base year, not the year built. No situs address. The county's own server
(`maps.sbcounty.gov/arcgis/rest/services`) has only a four field parcel layer. Sample: `parcels/sb_parcels_box_sample.json`.

**Santa Clara County (Planning Office).**
`https://services2.arcgis.com/tcv2cMrq63AgvbHF/arcgis/rest/services/Parcels_Public_View/FeatureServer/0/query` with
`outFields=APN,Year_Built,Situs_Address_Full,Sq_Ft_Rec,Acres_Rec,TRA`. Box -121.9000,37.3050,-121.8950,37.3090 (San Jose):
247 parcels, 88 KB, `Year_Built` (string, `"0000"` when unknown) valid on 241. No use code. Edited 2026-10-14.
Sample: `parcels/scl_parcels_box_sample.json`.

**Alameda County.**
`https://services5.arcgis.com/ROBnTHSNjoZ2Wm1P/arcgis/rest/services/Parcels/FeatureServer/0/query` with
`outFields=APN,SitusAddress,SitusCity,SitusZip,UseCode,Land,Imps,LatestDocumentDate`. 539 parcels in the Oakland box.
`UseCode` is the assessor's four digit code (table: `.../Assessor_Office_Use_Codes/FeatureServer/0`). No year built in
this layer or in any of the county's 250 hosted services (the secured rolls `Assessor_Office_Secured_Tax_Roll_2025_to_2026`
carry values and use codes only). Sample: `parcels/ala_parcels_box_sample.json`.

**Contra Costa County.**
`https://gis.cccounty.us/arcgis/rest/services/CCMAP/Assessment_Parcels_ArcPro/MapServer/0/query` with
`outFields=APN,full_address_display,s_city,S_ZIP,USE_CODE,Description,YR_BUILT,YR_HS_BLT,BLDG_SQFT,TOT_AREA,TLA,ACREAGE`.
Box -122.0500,37.9150,-122.0450,37.9190 (Walnut Creek): 341 parcels, 250 KB. `YR_HS_BLT` (year the house was built)
valid on 285; `YR_BUILT` is filled on non-residential parcels (1 here). `USE_CODE` with a plain `Description`.
Sample: `parcels/cc_parcels_box_sample.json`.

**Sacramento County.**
`https://services1.arcgis.com/5NARefyPVtAeuJPU/arcgis/rest/services/Parcels/FeatureServer/0/query` with
`outFields=APN,STREET_NBR,STREET_NAM,CITY,ZIP,LANDUSE,LU_GENERAL,LU_SPECIF,LU_DETAIL,LOT_SIZE`. 161 parcels in the test
box. Use in three levels (`Residential` / `Four Family` / `Fourplex`). No year built in any of the county's 218 hosted
services. Sample: `parcels/sac_parcels_box_sample.json`.

**San Francisco (Socrata, on the new host).**
Assessor roll, one point per parcel:
`https://data.sf.gov/resource/wv5m-vpq2.json?$select=closed_roll_year,property_location,parcel_number,use_code,use_definition,property_class_code,property_class_code_definition,year_property_built,number_of_stories,number_of_units,property_area,construction_type,the_geom&$where=within_box(the_geom,37.7625,-122.4200,37.7580,-122.4145) AND closed_roll_year=2025&$limit=5000`
(`within_box` takes north, west, south, east). 564 rows, 255 KB, ACAO `*`; `year_property_built` valid on 536.
Newest roll year is 2025 (211,547 rows). Parcel outlines, to join on `blklot` = `parcel_number`:
`https://data.sf.gov/resource/acdm-wktn.geojson?$select=mapblklot,blklot,from_address_num,to_address_num,street_name,street_type,zoning_code,zoning_district,active,shape&$where=intersects(shape,'POLYGON((-122.4200 37.7580,-122.4145 37.7580,-122.4145 37.7625,-122.4200 37.7625,-122.4200 37.7580))') AND active='true'&$limit=5000`
(638 polygons, 317 KB, ACAO `*`).
**The old host fails from a browser:** `https://data.sfgov.org/resource/...` now answers `301` to `data.sf.gov` with
`Access-Control-Allow-Origin: https://data.sfgov.org`, which a page of origin "null" cannot follow. Use `data.sf.gov`.
Samples: `parcels/sf_assessor_roll_box.json`, `parcels/sf_parcels_poly_box.geojson`.

**San Mateo County.**
`https://gis.smcgov.org/maps/rest/services/Common/ACTIVE_PARCELS_APN/FeatureServer/0/query`. Has `OFFICEYEARBUILT`, but
only 705 of 235,488 parcels carry one (5 of 240 in the test box), and `PUCDESC` (use) was empty in the box. Situs address
only. Sample: `parcels/sm_parcels_box_sample.json`.

**Fresno County.** Only outlines with `APN` are public
(`https://services6.arcgis.com/tXJI2YlHpcXmq7ZL/arcgis/rest/services/All_Fresno_parcels/FeatureServer/0`, a third party
copy edited 2026-08-13; ACAO `*`). No year built, use or address. Sample: `parcels/fre_parcels_box_sample.json`.

**Kern County.** `https://services5.arcgis.com/Y8jwjGUWbRjuqpG5/arcgis/rest/services/Assessor_Parcels_Land_2026_gdb/FeatureServer/0`
(KernGIS, 2026): `APN`, `APN9`, `APN_LABEL`, area only. The City of Bakersfield layer
(`https://gis.bakersfieldcity.us/webmaps/rest/services/General/Cadastre/MapServer/1`, ACAO echo) adds a situs address
(`ADDR_ID`) but no year or use. Sample: `parcels/kern_parcels_box_sample.json`.

**Ventura County.** The year built sits in two layers split at 1955, outlines only (no APN, no use), last edited 2023-05-03:
`https://services2.arcgis.com/XJ5Tb7dTYtAMoyYT/arcgis/rest/services/Parcels1955on/FeatureServer/6/query` (202,132 parcels,
`YR_BLT`, `CTY_STA`, `ZIP`, `MH_PARK`) and `.../ParcelsBefore1955/FeatureServer/7/query` (23,595 parcels, `YR_BLT`).
Ask both for the box; a building takes the year of the outline its centre falls in. The current parcel layer
(`.../Parcels_Quarterly/FeatureServer/0`, 268,177 parcels, edited 2026-11-05) has `APN` only.
Samples: `parcels/ven55_parcels_box_sample.json`, `parcels/venpre_parcels_box_sample.json`, `parcels/venall_parcels_box_sample.json`.

**San Joaquin County.**
`https://services2.arcgis.com/GQhSReJEO6f7tsvy/arcgis/rest/services/Parcels/FeatureServer/0/query` with
`outFields=APN,FULL_ADDRESS,YEAR_BUILT,STORIES,TOTALLIV_AREA,NUMBER_UNITS,USECODE,DESCRIPTION,CATEGORY,QCS,VALUE_ROLL_YEAR`.
Box -121.3050,37.9650,-121.3000,37.9690 (Stockton): 214 parcels, 96 KB, `YEAR_BUILT` valid on 204, `STORIES` on 204.
Roll year 2026, edited 2026-11-05. Sample: `parcels/sj_parcels_box_sample.json`.

**Sonoma County.**
`https://socogis.sonomacounty.ca.gov/map/rest/services/CRAPublic/ParcelsPublic/FeatureServer/0/query` with
`outFields=APN,SitusFormatted1,SitusFormatted2,UseCode,UseCodeDescription,UseCodeType,BuildingPrimaryYearBuilt,BuildingPrimaryEffectiveYear,BuildingPrimaryStories,BuildingPrimarySize,BuildingPrimaryUnitCount,BuildingPrimaryQualityClass,LandSizeSqft`.
Box -122.7150,38.4450,-122.7100,38.4490 (Santa Rosa): 242 parcels, 148 KB, year built valid on 226.
Sample: `parcels/son_parcels_box_sample.json`.

**Placer County.**
`https://services9.arcgis.com/NENkjkswKTzMfG3A/arcgis/rest/services/County_Parcels_-_Public_View/FeatureServer/0/query`
with `outFields=Apn,SitusAddressFull,FormattedSitus1,UseCode,UseCodeName,LandValue,Structure,Acres,Jurisdiction`.
216 parcels in the Roseville box. Use and address, no year built. Sample: `parcels/pla_parcels_box_sample.json`.

**Use for the six SCAG counties (Los Angeles, Orange, Riverside, San Bernardino, Ventura, Imperial).** SCAG's parcel level
existing land use carries a four digit land use code per parcel (`LU24`, 1110 = single family) and no year built:
`https://rdp.scag.ca.gov/mapping/rest/services/LDX/Existinglanduse_poly_OR/MapServer/0/query` (the folder listing also
has `Existinglanduse_poly_LA`, `_RV`, `_SB`, `_VN`, `_IM`; only `_OR` was queried), fields `APN24, COUNTY, CITY, LU24,
LU24_2ND, LU19, ACRES, YEAR` (`YEAR` is the data year, 2024). ACAO echoes `null`, limit 2000. 127 parcels in the
Anaheim box -117.9150,33.8350,-117.9100,33.8390.


---

## 4. Elevation for 3D terrain

### 4a. AWS terrarium tiles (works; the simplest thing a browser can decode)

- URL, confirmed: `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png` (256 px RGB PNG, XYZ tile
  numbering, Web Mercator). Tiles were last modified 2017-11-11.
- Cross-origin: `access-control-allow-origin: *` on every tile (the bucket sends it when the request carries an `Origin`,
  which a browser `fetch` or an `<img crossorigin="anonymous">` does). No preflight. Draw the PNG to a canvas and read the pixels.
- Height formula, proved below: **`metres = R * 256 + G + B / 256 - 32768`**.
  Example, mid Lake Tahoe: pixel (135, 105, 141) gives 135*256 + 105 + 141/256 - 32768 = 1897.55 m.
- Largest zoom over California: **15** (HTTP 200 at z13, z14, z15; **HTTP 404 at z16, z17, z18** at Mount Whitney, downtown
  Los Angeles and Badwater). z15 is about 3.9 m per pixel at 36 N; the heights underneath are the USGS 10 m model, so z14
  (7.7 m per pixel) already holds all the detail and z15 is slightly oversampled. z10 tiles carry whole metres only (B = 0).

Decoded heights (tile fetched with `Origin: null`, pixel under the point):

| Point | z12 | z14 | z15 | Known height |
|---|---|---|---|---|
| Mount Whitney summit 36.57858, -118.291995 | 4412.4 m | 4411.8 m | 4412.3 m (tile max 4414.4) | 4,421 m; USGS 1 m lidar reads 4418.6 m at the same point |
| Badwater Basin boardwalk 36.2297, -116.7672 | -80.0 m | -77.8 m (tile min -89.3) | -77.3 m (tile min -85.3) | about -85.5 m at the lowest point; USGS 1 m reads -81.9 m at the point |
| San Francisco, Ferry Building 37.7955, -122.3937 | 2.5 m | 2.0 m | 2.0 m | near sea level; USGS reads 3.3 m |
| San Francisco, Twin Peaks 37.7513, -122.4475 | 268.9 m | 259.0 m | 261.7 m (tile max 280.8) | about 281 m at the top |
| Lake Tahoe, mid lake 39.0968, -120.0324 | 1897.6 m | 1897.6 m | 1897.6 m | lake surface about 1,897 m; USGS reads 1897.9 m |
| South Lake Tahoe airport 38.8939, -119.9953 | 1907.7 m | 1907.9 m | 1907.9 m | field elevation 1,909 m |

The summit of a sharp peak reads 4 to 9 m low because the source is a 10 m grid. Samples and the full table:
`elevation/terrarium_*.png` (z12 and z15 tiles of each point), `elevation/terrarium_tests.json`.
Script: `SP/research/ca/scout_scripts/terrarium.py`.

### 4b. Alternatives (all three work cross-origin)

**Mapterhorn** (open terrain tiles, the same terrarium formula, sharper): `https://tiles.mapterhorn.com/{z}/{x}/{y}.webp`,
512 px WebP, ACAO `*`, TileJSON at `https://tiles.mapterhorn.com/tilejson.json` (`"encoding":"terrarium","tileSize":512`).
Over California it reached **z16** at Mount Whitney, San Francisco, Lake Tahoe and Los Angeles (a 512 px z16 tile is
about 1 m per pixel) and 404 at z17; at Badwater it stopped at **z13** (404 from z14), so the client must fall back to
the parent tile. Decoded: Whitney 4418.7 m at z16, Badwater -81.8 m at z13, Ferry Building 3.2 m, Tahoe 1897.9 m,
Los Angeles City Hall 92.0 m. Results: `elevation/elevation_alternatives_tests.json`, tiles `elevation/mapterhorn_*.webp`.

**Esri World Elevation Terrain3D** (keyless, but LERC, not an image):
`https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer/tile/{z}/{y}/{x}`
(row before column). ACAO `*`, `application/octet-stream`, 257 x 257 float32 metres in LERC, levels to **z16** (2.39 m per
pixel); a z17 request returns a 67 byte empty answer. Needs Esri's LERC decoder (`lerc` on npm/jsDelivr, JS + WASM) in the
page. Decoded with the Python `lerc` module: Whitney 4418.4 m at z16, Badwater -81.8 m, Ferry Building 3.3 m, Tahoe
1897.9 m (z12), City Hall 93.0 m. Tile: `elevation/esri_terrain3d_12_1600_702.lerc`; description `elevation/esri_terrain3d_service.json`.
(`https://elevation.arcgis.com/.../WorldElevation/Terrain/ImageServer` is the token-protected one; not this.)

**USGS 3DEP image service** (what `scout3d.js` already uses for the photoreal ground):
`https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer`, ACAO `*`.
- A grid: `/exportImage?bbox=-118.2940,36.5766,-118.2900,36.5806&bboxSR=4326&imageSR=4326&size=64,64&format=tiff&pixelType=F32&noDataInterpretation=esriNoDataMatchAny&interpolation=RSP_BilinearInterpolation&f=image`
  returned an uncompressed float32 TIFF (66 KB, 2.0 s; min 3876.9, max 4418.7 m). Sample `elevation/3dep_whitney_64.tif`.
- Points: `/getSamples?geometry={"points":[[lon,lat],...],"spatialReference":{"wkid":4326}}&geometryType=esriGeometryMultipoint&returnFirstValueOnly=true&f=json`
  returned Whitney 4418.56, Badwater -81.86, Ferry Building 3.26, Tahoe 1897.89, each with `"resolution":1` (1 m lidar).
  Sample `elevation/3dep_getsamples_4pts.json`. `/identify` gives the same one point at a time.
- `https://epqs.nationalmap.gov/v1/json?x=-118.291995&y=36.57858&units=Meters&wkid=4326` also answers with ACAO `*` (4418.56).
It is the most accurate (1 m where lidar exists) but it is a rendering service: about 2 s per request, so use it for a
neighbourhood grid, not for map tiles.

---

## 5. Imagery

### 5a. Esri World Imagery (the service now used; works, and is the sharpest keyless source statewide)

- Tiles: `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}` (row before
  column), JPEG, `Access-Control-Allow-Origin: *`, no preflight. The service lists levels to 23.
- Real detail ends at **z20** in Los Angeles, San Francisco and Coronado, and at **z19** in Truckee, Twentynine Palms and
  on Mount Whitney. Past that the server still answers HTTP 200 with a 2,521 byte "map data not yet available" JPEG, so
  test the size (or the tilemap) before trusting a tile.
- Date and sharpness at a point (what `scout.js` line 2480 already asks):
  `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/identify?geometry=-118.2428,34.0537&geometryType=esriGeometryPoint&sr=4326&layers=all&tolerance=1&mapExtent=-118.2433,34.0532,-118.2423,34.0542&imageDisplay=400,400,96&returnGeometry=false&f=json`
  ACAO `*`. The attributes are named `DATE (YYYYMMDD)`, `RESOLUTION (M)`, `ACCURACY (M)`, `DESCRIPTION`, `SOURCE_INFO`,
  `SOURCE`, `SRC_DATE2`.

What it holds in California today (27 places, `imagery/esri_world_imagery_identify_27_places.json`):

| Place | Date | Resolution | Source |
|---|---|---|---|
| Los Angeles (City Hall, Koreatown), Altadena | 2025-11-26 | 0.34 m | Vantor Vivid Advanced |
| Van Nuys / Long Beach / Anaheim / Riverside | 2026-01-09 / 2026-01-10 / 2025-12-04 / 2025-10-20 | 0.34 / 0.5 / 0.34 / 0.34 m | Vantor |
| Pacific Palisades | 2025-12-20 | 0.34 m | Vantor |
| San Diego North Park, Coronado and North Island | 2026-03-07 | 0.34 m | Vantor Vivid Premium |
| San Francisco / Oakland | 2026-05-26 / 2026-03-24 | 0.34 m | Vantor |
| San Jose | 2024-11-28 | 0.076 m | Santa Clara County aerial |
| Santa Rosa | 2025-04-21 | 0.046 m | City of Santa Rosa aerial |
| San Bernardino, Barstow, Twentynine Palms | 2026-05-23 | 1 ft | San Bernardino County aerial |
| Sacramento / Fresno / Bakersfield / Stockton | 2026-02-03 / 2026-02-28 / 2025-08-29 / 2025-09-13 | 0.5 / 0.34 / 0.31 / 0.31 m | Vantor |
| Truckee / South Lake Tahoe / Mammoth Lakes | 2025-10-21 / 2025-09-25 / 2025-10-26 | 0.5 / 0.31 / 0.5 m | Vantor |
| Palm Springs / Redding / Eureka | 2025-10-12 / 2026-03-21 / 2025-09-23 | 0.31 / 0.34 / 0.34 m | Vantor |

Sample tiles: `imagery/esri_<place>_z19_<row>_<col>.jpg`.

### 5b. Is anything public newer or sharper statewide? No.

- **USGS NAIP image service (works cross-origin, but older and coarser).**
  `https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPImagery/ImageServer`, ACAO `*`, four bands (with near
  infrared), up to 4000 x 4000 px per request. In California it serves **NAIP 2022 at 0.6 m** (flown April to July 2022:
  Los Angeles 2022-05-11, San Francisco 2022-05-18, San Diego 2022-04-25, Sacramento 2022-06-21, Truckee 2022-07-21,
  Twentynine Palms 2022-04-28; from `/identify?...&returnCatalogItems=true`). As a map tile:
  `/exportImage?bbox=<xmin,ymin,xmax,ymax in EPSG:3857>&bboxSR=3857&imageSR=3857&size=256,256&format=jpg&f=image`
  returned in 1.6 to 1.8 s at z17 and z18 and **6.7 to 8.3 s at z19 and z20** per 256 px tile, so it is too slow for a
  pannable layer; ask one larger image per view. `USGSNAIPPlus/ImageServer` holds the same 2022 California tiles.
  Useful as a second, dated look (spring 2022) and for the infrared band (trees), not as a sharper base.
  Samples: `imagery/usgs_naip_la_cityhall_z17..z20_*.jpg`.
- **USGS Imagery Only tile cache**: `https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}`,
  ACAO `*`, fast, but cached only to **z16** (HTTP 404 from z17). Sample `imagery/usgs_imageryonly_la_cityhall_z16.jpg`.
- **USDA's own NAIP server** (`https://gis.apfo.usda.gov/arcgis/rest/services/NAIP/USDA_CONUS_PRIME/ImageServer`): could
  not be reached from here; the connection was reset three times (no HTTP answer), so its cross-origin header is unknown.
- **California Fish and Wildlife** (`https://map.dfg.ca.gov/arcgis/rest/services/Base_Remote_Sensing`): answers with an
  HTML page and no ACAO; not a usable REST root at that address.

### 5c. Esri Wayback: the same imagery at earlier dates (works; useful for before and after a fire or a storm)

- Release list: `https://s3-us-west-2.amazonaws.com/config.maptiles.arcgis.com/waybackconfig.json` (ACAO `*`; 198 releases,
  2014-02-20 to 2026-10-29; each entry has `itemURL` and `metadataLayerUrl`). Saved as `imagery/esri_waybackconfig.json`.
- Tiles: `https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default028mm/MapServer/tile/{release}/{z}/{y}/{x}`.
  The server answers `301` (ACAO `*`) to the release that actually holds that tile on the same host, then `200 image/jpeg`
  (ACAO `*`), which a browser follows. Tested in Altadena (z18, row 104551, col 45045) for release 43291 (2026-10-29)
  and 16453 (2024-12-12, before the January 2025 Eaton fire): `imagery/esri_wayback_altadena_z18_*`.
- The date of a release at a point: `<metadataLayerUrl>/identify?...` (same parameters as above), ACAO `*`; the
  2024-12-12 release in Altadena reads `SRC_DATE 20220615, SRC_RES 0.3, NICE_DESC Maxar`.
- Wrong host to avoid: `wayback.maptiles.arcgisonline.com` does not exist (the proxy answered 502).

---

## 6. Streets: Overpass API

### Reaching the servers (read this first)

From this sandbox the public Overpass servers were hard to reach; that is a property of this network path, not of the
servers' cross-origin rules, but it shaped the tests:

| Server | From here | ACAO when it answered |
|---|---|---|
| `https://overpass-api.de/api/interpreter` | TLS handshake reset every time (also `lz4.`, `z.`, `gall.`, `lambert.`) | not seen over HTTPS |
| `http://overpass-api.de/api/interpreter` (plain HTTP, same server) | answered about one try in three (others: gateway 503 "remote connection failure") | `*` |
| `https://maps.mail.ru/osm/tools/overpass/api/interpreter` | 504 at first, then HTTP 200 on later tries (16 to 22 s) | `*` (also on the 504) |
| `https://overpass.kumi.systems/api/interpreter` | timed out (45 s) | not seen |
| `https://overpass.private.coffee/api/interpreter` | timed out | not seen |
| `https://overpass.openstreetmap.fr/api/interpreter` | `403 This service is only available to white-listed usages` | none |

The request is the one `roads3d` already sends: `POST`, `Content-Type: application/x-www-form-urlencoded`, body
`data=<url-encoded query>`. That is a "simple" request, so no preflight. `GET ?data=` works too.
A last-resort fallback that did answer over HTTPS with `access-control-allow-origin: null` (echo) is the OpenStreetMap
API itself, `https://api.openstreetmap.org/api/0.6/map.json?bbox=-118.2500,34.0500,-118.2450,34.0540` (2.2 MB for a
460 m box, everything mapped, 50,000 node cap; its usage policy is for editors, so keep it for emergencies).

### The query that was run (identical for the three boxes; bbox is south,west,north,east)

```
[out:json][timeout:90][bbox:34.040,-118.265,34.066,-118.230];
(
  way["highway"];
  node["highway"~"^(traffic_signals|motorway_junction|stop)$"];
  way["railway"~"^(rail|light_rail|subway|tram|monorail|funicular|narrow_gauge|disused|abandoned)$"];
  node["railway"~"^(station|halt|tram_stop|level_crossing)$"];
  way["man_made"~"^(pier|quay|breakwater|bridge)$"];
  way["aeroway"];
  node["aeroway"~"^(helipad|aerodrome|navigationaid)$"];
  relation["aeroway"];
  relation["route"~"^(tram|light_rail|subway|train|ferry)$"];
);
out tags geom;
```

What each part returns: motorways with `lanes` (`highway=motorway`), ramps (`highway=motorway_link`), bridges
(`bridge=yes|viaduct|movable` plus `layer`, and the outlines `man_made=bridge` with `bridge:structure` and the name),
tunnels (`tunnel=yes` plus `layer`), one-way streets (`oneway=yes`), speed limits (`maxspeed`, written `"35 mph"`),
signals (`highway=traffic_signals` nodes), railways, trams, piers and aeroways. Relations come back with tags and bounds
only (route names), no member geometry.

### Results

| Box (S,W,N,E) | Server that answered | Time | Elements | JSON as sent | gzip on the wire | Saved |
|---|---|---|---|---|---|---|
| Central Los Angeles 34.040,-118.265,34.066,-118.230 (2.9 x 3.2 km) | `http://overpass-api.de` | 34.6 s | 9,978 (9,202 ways, 721 nodes, 55 relations) | 5.37 MB | 868 KB | `streets/overpass_la_central.json` |
| San Francisco north-east 37.776,-122.420,37.812,-122.385 (4.0 x 3.1 km) | `maps.mail.ru` | 22.4 s | 14,069 (12,564 ways, 1,427 nodes, 78 relations) | 7.29 MB | 1.13 MB | `streets/overpass_sf_northeast.json` |
| Coronado and North Island 32.670,-117.235,32.720,-117.140 (5.6 x 8.9 km) | `maps.mail.ru` | 16.3 s | 10,419 (9,223 ways, 1,171 nodes, 25 relations) | 5.63 MB | 923 KB | `streets/overpass_coronado.json` |

Overpass indents its JSON; the same data compact is 4.1 / 5.6 / 4.3 MB. Sidewalks and crossings mapped as their own
ways (`highway=footway` + `footway=sidewalk|crossing`) are the largest single share (39% of the Los Angeles bytes).
Dropping them and the route relations leaves 2.5 / 3.6 / 3.3 MB (374 / 518 / 512 KB gzip); roads, rail, piers and
aeroways only (no foot or cycle ways at all) is 2.0 / 2.5 / 2.7 MB (296 / 348 / 404 KB gzip). To drop sidewalks in the
query itself, replace the first line of the union with:
`way["highway"]["footway"!~"^(sidewalk|crossing)$"];` (derived by filtering the saved answers; this variant was not
sent to a server).

Tag completeness, as a share of road length (from `streets/overpass_<box>.stats.json`):

| Class | Los Angeles: lanes / maxspeed / oneway | San Francisco | Coronado and San Diego bayfront |
|---|---|---|---|
| motorway | 100% / 86% / 100% (14.5 km) | 100% / 100% / 100% (10.2 km) | 100% / 89% / 100% (14.0 km) |
| motorway_link (ramps) | 83% / 3% / 100% (16.7 km) | 100% / 95% / 100% (4.5 km) | 74% / 2% / 100% (13.6 km) |
| trunk, primary, secondary | 97% / 41% / 50% (79 km) | 95% / 83% / 83% (57 km) | 86% / 29% / 70% (80 km) |
| tertiary | 93% / 22% / 5% (17 km) | 85% / 46% / 60% (42 km) | 78% / 18% / 34% (54 km) |
| residential, unclassified | 43% / 11% / 5% (40 km) | 31% / 20% / 49% (66 km) | 38% / 7% / 13% (114 km) |
| service (alleys, drives) | 1% / 5% / 23% (90 km) | 3% / 1% / 27% (50 km) | 1% / 1% / 23% (212 km) |
| all drivable public roads | **83% / 32% / 44%** (168 km) | **70% / 52% / 66%** (179 km) | **65% / 20% / 43%** (276 km) |

Reading it: `lanes` is dependable on motorways and arterials and missing on most residential streets (assume 2).
`maxspeed` is good on San Francisco arterials and motorways and thin elsewhere (assume 25 mph residential, 65 mph
freeway). `oneway` is only written where a street is one-way (`oneway=yes`; `oneway=no` is on 2 to 6% of length), so a
missing tag means two-way; every motorway and ramp carries it.

Other counts:

| | Los Angeles | San Francisco | Coronado box |
|---|---|---|---|
| Road bridge ways / with `layer` | 258 / 251 | 160 / 154 | 134 / 126 |
| `man_made=bridge` outlines | 54 | 10 (Bay Bridge west span, `bridge:structure=suspension`) | 29 (San Diego-Coronado Bridge named) |
| Ways with `maxheight` | 54 (`15'`, `15'2"`, `14'0"`, `default`) | 27 (`13'6"`, `12'6"`, `default`) | 48 (`none`, `default`, `15'5"`) |
| Ways with `height` | 4 | 3 | 0 |
| Tunnel ways / with `layer` | 217 / 177 (light rail, subway, 2nd and 3rd Street) | 320 / 232 (Broadway, Stockton, Muni, busway) | 69 / 22 |
| `oneway=yes` road ways | 1,257 | 1,595 | 1,904 |
| Traffic signal nodes | 416 | 495 | 392 |
| Stop sign nodes / motorway junctions | 174 / 31 | 373 / 5 | 554 / 14 |
| Railway ways | rail 79, light_rail 76, subway 74, funicular 6 (Angels Flight) | tram 94, light_rail 69, rail 13, subway 10, funicular 2 | light_rail 139, rail 105, monorail 4 |
| Piers / breakwaters | 0 | 527 / 6 | 302 / 13 |
| Aeroway ways | helipad 90 | none | runway 2, taxiway 47, taxilane 4, apron 5, stopway 4, helipad 28, hangar 4, parking_position 8, aerodrome 1 |

Clearance: there is no bridge clearance tag to rely on. `maxheight` sits on the road that passes **under** a structure,
on 27 to 54 ways per box, and a third of those say `default` or `none`. Vertical order must come from `layer`
(present on 94 to 97% of bridge ways) and deck height has to be assumed (about 5 m per layer).

Cable cars in San Francisco are `railway=tram` with `cable_tram` set and `electrified=no` (35 of the 94 tram ways carry
`cable_tram`; 67 are `electrified=no`); the six route relations are `route=tram` named "Muni Powell/Hyde Cable Car ...",
"Muni Powell/Mason Cable Car ...", "Muni California Cable Car ...". There is no `railway=cable_car` way.
North Island's runways in the Coronado box: `ref=18/36, surface=paved, width=61, length=2439` and
`ref=11/29, width=61, length=2286, ele=19ft` (metres).

Scripts: `SP/research/ca/scout_scripts/overpass_streets.py` (query + statistics), `overpass_bytes.py` (byte shares),
`overpass_run.py` (tries the servers in turn). The exact query of each box is in `streets/overpass_<box>.query.txt`.

---

## 7. Airports and runways

### 7a. OurAirports (works; one small file covers the state)

- Files (GitHub Pages, `access-control-allow-origin: *`, last modified 2026-11-18):
  `https://davidmegginson.github.io/ourairports-data/airports.csv` (12.8 MB) and
  `https://davidmegginson.github.io/ourairports-data/runways.csv` (4.0 MB). They are too big to fetch on every page
  load; the California extract below is what to ship or cache.
- Filter: `iso_region = "US-CA"`; runways join on `airport_ref` = airport `id`.
- California: 2,431 airport records (944 heliports, 722 closed, 673 small, 65 medium, 13 large, 12 seaplane bases,
  2 balloonports) and 1,208 runway rows (21 closed). Length, width and surface are on 1,205 / 1,204 / 1,205 rows.
  **Both runway ends have coordinates on 457 rows** (432 of the 645 open runways at fixed-wing airports); both end
  elevations on 377; true headings on 403. The rest have length and width only.
- Runway fields: `length_ft, width_ft, surface, lighted, closed, le_ident, le_latitude_deg, le_longitude_deg,
  le_elevation_ft, le_heading_degT, le_displaced_threshold_ft` and the same for `he_`.
- Saved: `airports/ca_airports.csv` (302 KB), `airports/ca_runways.csv` (95 KB), `airports/ca_airports_runways.json`
  (823 KB, one object per airport with its runways), `airports/ca_15_named_airports.json`; raw files in
  `airports/ourairports_raw/`. Script: `SP/research/ca/scout_scripts/airports_ca.py`.

The fifteen named airports (all have both ends, elevations, width and surface; feet):

| Ident | Airport | Field elev. | Runways (length x width, surface) |
|---|---|---|---|
| KLAX | Los Angeles International | 125 | 6L/24R 8926x150 CON; 6R/24L 10859x150 CON; 7L/25R 12894x150 CON; 7R/25L 11095x200 CON |
| KSFO | San Francisco International | 13 | 10L/28R 11870x200 ASP; 10R/28L 11381x200 ASP; 1L/19R 7650x200 ASP; 1R/19L 8660x200 ASP |
| KSAN | San Diego International | 17 | 09/27 9401x200 ASP |
| KNZY | NAS North Island (Halsey Field) | 26 | 11/29 7501x200 PEM; 18/36 8001x200 PEM |
| KOAK | Oakland | 9 | 10L/28R 5457x150; 10R/28L 6213x150; 12/30 10520x150; 15/33 3376x75 (all ASP) |
| KSJC | San Jose (Mineta) | 62 | 12L/30R 11000x150 CON; 12R/30L 11000x150 CON; 11/29 4599x100 closed |
| KSMF | Sacramento International | 27 | 17L/35R 8605x150 CON; 17R/35L 8598x150 CON |
| KBUR | Hollywood Burbank | 778 | 08/26 5802x150 ASP; 15/33 6886x150 ASP |
| KLGB | Long Beach | 60 | 12/30 10000x200; 08L/26R 6192x150; 08R/26L 3918x100; 16L/34R and 16R/34L closed |
| KSNA | John Wayne | 56 | 02L/20R 5700x150 ASP; 02R/20L 2886x75 ASP |
| KONT | Ontario | 944 | 08L/26R 12197x150 CON; 08R/26L 10200x150 CON |
| KPSP | Palm Springs | 477 | 13R/31L 10000x150 ASP; 13L/31R 4953x75 ASP |
| KFAT | Fresno Yosemite | 336 | 11L/29R 9539x150 ASP; 11R/29L 8008x150 ASP |
| KNKX | MCAS Miramar | 477 | 06L/24R 12000x200 CON; 06R/24L 8001x200 PEM; 10/28 2800x200 closed; helipads |
| KNLC | NAS Lemoore (Reeves Field) | 232 | 14L/32R 13502x200 CON; 14R/32L 13501x200 CON |

Example of the end coordinates: LAX 7L 33.935556,-118.422089 (119 ft, heading 83) to 25R 33.939881,-118.379794 (94 ft);
North Island 18 32.709999,-117.211998 (19 ft) to 36 32.688801,-117.219002 (10 ft).

### 7b. FAA feature services (work; live, queryable by box, with pavement outlines)

All on `https://services6.arcgis.com/ssFJjBXIUyZDrSYZ/arcgis/rest/services/`, ACAO `*`, edited 2026-10-29, same query
shape as the parcel layers:

- `US_Airport/FeatureServer/0` (points, limit 1000): `IDENT, ICAO_ID, NAME, LATITUDE, LONGITUDE, ELEVATION, TYPE_CODE,
  SERVCITY, STATE, OPERSTATUS, PRIVATEUSE, MIL_CODE`. `where=STATE='CA'` gives 873 (475 airports, 390 heliports; 29 military).
- `Runways/FeatureServer/0` (polygons, limit 2000): `AIRPORT_ID` (= airport `GLOBAL_ID`), `DESIGNATOR, LENGTH, WIDTH,
  DIM_UOM, COMP_CODE` (surface: ASPH, CONC, CONC+ASPH, DIRT, GRASS, GRAVE, MATS, ROOF), `LIGHTINTNS`. 1,079 runway
  outlines on California airports. No end elevations; the ends are the short sides of each outline.
- `AM_Runway`, `AM_Taxiway`, `AM_Apron` `/FeatureServer/0` (polygons with `FAA_ID, ICAO_ID, DESIGNATOR, SURFACE`): the
  airport mapping pavement. The LAX box -118.45,33.92,-118.37,33.96 returned 4 runways, 384 taxiway pieces (263 KB) and
  24 aprons. This is the layer to draw taxiways from.
- Saved: `airports/faa_ca_airports.geojson` (873 points), `airports/faa_ca_runways.geojson` (1,079 outlines with
  `IDENT`, `ICAO_ID` and the airport name joined on). All fifteen named airports are in both, with the same lengths as
  OurAirports within a few feet (LAX 07L/25R 12923 against 12894; SFO 01R/19L 8650 against 8660).

---

## 8. Traffic volumes

### 8a. Caltrans annual average daily traffic (works; whole table downloaded)

- Layer: `https://caltrans-gis.dot.ca.gov/arcgis/rest/services/CHhighway/Traffic_AADT/FeatureServer/0/query`
  (points at count locations on the state highway system, ACAO echoes `null`, limit 2000, paging works).
- Box query that worked: `?where=1=1&geometry=-118.30,34.02,-118.20,34.08&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=*&outSR=4326&f=json`
  (122 points, 45 KB, 0.2 s).
- Fields (all strings): `DISTRICT, RTE, RTE_SFX, CNTY, PM_PFX, PM, PM_SFX, DESCRIPTION, BACK_PEAK_HOUR, BACK_PEAK_MADT,
  BACK_AADT, AHEAD_PEAK_HOUR, AHEAD_PEAK_MADT, AHEAD_AADT`. "Back" and "ahead" are the two sides of the count point along
  the route (both directions summed); `PEAK_HOUR` is the peak hour volume, `PEAK_MADT` the busiest month's daily average.
- Year: the layer's metadata names it `Traffic_Volumes_AADT_2024` ("2024 Traffic Volumes", count year October to
  September), published 2026-09. Saved `traffic/caltrans_aadt_metadata.xml`.
- Downloaded whole: **14,080 points on 242 routes**, all 12 districts (District 7 Los Angeles 1,853; District 4 Bay Area
  2,317; District 11 San Diego 1,251; District 12 Orange 538). 12,861 have an ahead AADT, 14,067 a peak hour.
  Busiest: I-5 in Orange County at Tustin Ranch Road, 386,600 a day (peak hour 34,500); I-10 at Vermont Avenue in Los
  Angeles 345,000 (peak hour 20,900). Peak hour is a median 9.4% of AADT (10th percentile 6.6%, 90th 14.4%).
  Files: `traffic/caltrans_aadt_points.csv` (1.46 MB), `traffic/caltrans_aadt_points.geojson` (5.4 MB).
- Same folder, same cross-origin answer, each queried once in the Los Angeles box:
  `CHhighway/Truck_Volumes_AADT/FeatureServer/0` (`VEHICLE_AADT_TOTAL, TOT_TRK_AADT, TRK_PERCENT_TOT`, axle classes; 55 points),
  `CHhighway/Bottlenecks/FeatureServer/0` (lines: `Fwy, Name, Shift` AM/PM, `Number_Days_Active, Avg_Extent__Miles_,
  Total_Delay__veh_hrs_`; 4 in the box, I-110 north at Solano Avenue ranked first),
  `CHhighway/HOV/FeatureServer/0` (carpool lanes with `Hours_of_Operation`),
  `CHhighway/State_Highway_Bridges/FeatureServer/0` (points: `NAME, YRBLT, LENG, DECKWIDTH, DESIGN_MAIN, MATERIAL_MAIN,
  INTERSEC`; 195 in the box; no clearance field). The folder also lists `All_Roads`, `Express_Lanes`, `Local_Bridges`,
  `SHN_Postmiles`, `CCTV`.

### 8b. Hourly profile: nothing public that a browser can read

- Caltrans PeMS (`https://pems.dot.ca.gov`), the source of hourly and 5 minute freeway counts for Los Angeles, the Bay
  Area and San Diego, sits behind an account login and sends no ACAO. Not usable.
- data.ca.gov (`/api/3/action/package_search?q=hourly traffic volume`) has only the AADT and truck AADT layers above and
  an active transportation count file. No hourly table.
- FHWA's station data page (`https://www.fhwa.dot.gov/policyinformation/tables/tmasdata/`) answered 301 with no ACAO; not
  followed further.
- City counts exist but are daily totals: LADOT `https://data.lacity.org/resource/94wu-3ps3.json` (ACAO `*`; fields
  `primary_street, cross_street, count_date, day, n_b, s_b, e_b, w_b, total`).
- What can be built without it: the day's shape from the Caltrans numbers that are public (peak hour share per point,
  AM or PM shift from `Bottlenecks`), with a standard urban freeway hourly curve scaled so its peak equals `PEAK_HOUR`
  and its sum equals `AADT`. That is a model, not a measurement, and should be labelled so.

---

## 3. Building permits that identify roofing work

(Written city by city as each was tested; the summary table is at the end of this section.)

### City of Los Angeles, LADBS (works; the best roofing permit source in the state)

- Socrata, ACAO `*`, no preflight, refreshed 2026-11-16. Three tables with the same columns:
  `https://data.lacity.org/resource/pi9x-tg5x.json` (issued 2020 to present),
  `https://data.lacity.org/resource/dyxf-7hc4.json` (2010 to 2019), `https://data.lacity.org/resource/e67z-kt2n.json` (before 2010, from 1996).
- Fields: date `issue_date` (also `submitted_date`, `status_date`, `cofo_date`); address `primary_address`, `zip_code`;
  coordinates `lat`, `lon` and the point `geolocation` (82,594 of 82,595 roofing permits since 2020 have one); work
  `work_desc`; type `permit_type` (`Bldg-Alter/Repair`), `permit_sub_type` (`1 or 2 Family Dwelling`, `Apartment`,
  `Commercial`), `use_desc`; `valuation`; `status_desc`; `apn`, `pin_nbr`.
- A re-roof is recognised by words, not a code: `work_desc` begins "Re-roof with Class A or B roof covering material ...
  ( 106 ) Squares" (the standard LADBS text, which also gives the roof area in squares).
  Filter: `upper(work_desc) like '%RE-ROOF%' OR ... '%REROOF%' OR ... '%RE ROOF%' OR ... '%TEAR OFF%' OR ... '%ROOFING%'`.
- Roofing permits a year with that filter: 1997 6,476; 2000 5,386; 2005 6,149; 2010 4,988; 2015 7,013; 2017 9,099;
  2019 9,204; 2020 8,970; 2021 9,111; 2022 10,476; **2023 14,636; 2024 14,449; 2025 12,115; 2026 12,838 to date**.
- Near a point (8 rows within 300 m of 34.062,-118.297, 0.5 s):
  `https://data.lacity.org/resource/pi9x-tg5x.json?$select=permit_nbr,primary_address,zip_code,permit_type,permit_sub_type,issue_date,status_desc,valuation,work_desc,lat,lon,apn&$where=within_circle(geolocation,34.062,-118.297,300) AND (upper(work_desc) like '%RE-ROOF%' OR upper(work_desc) like '%REROOF%' OR upper(work_desc) like '%RE ROOF%' OR upper(work_desc) like '%TEAR OFF%' OR upper(work_desc) like '%ROOFING%')&$order=issue_date DESC&$limit=200`
  By tile, exactly as the New Orleans call: `$where=within_box(geolocation,34.0645,-118.3000,34.0600,-118.2945) AND (...)`
  (north, west, south, east). Sample: `permits/la_city_ladbs_reroof_near_point.json`.

### San Francisco, Department of Building Inspection (works; has a re-roof flag)

- `https://data.sf.gov/resource/i98e-djp9.json` (Socrata, ACAO `*`, updated daily; **use `data.sf.gov`**, the old
  `data.sfgov.org` redirects with a cross-origin header a "null" page cannot pass).
- Fields: dates `issued_date`, `filed_date`, `completed_date`, `status_date`; address `street_number`, `street_name`,
  `street_suffix`, `unit`, `zipcode`, `block`, `lot`; coordinates `location` (point; on 34,782 of 34,789 re-roof permits
  since 2015); work `description`; type `permit_type`, `permit_type_definition`; value `estimated_cost`, `revised_cost`;
  `existing_use`; `status`; and **`reroof` = `Y`** on 117,142 permits (1908 to 2026-11-03).
- A re-roof is recognised by `reroof='Y'` or by the words (`upper(description) like '%REROOF%' OR '%RE-ROOF%' OR '%RE ROOF%'`);
  99% of them are `permit_type_definition = 'otc alterations permit'` (type 8).
- Per year (words filter): 2015 3,038; 2016 2,611; 2017 2,862; 2018 2,625; 2019 2,731; 2020 2,107; 2021 2,460; 2022 2,910;
  2023 3,525; 2024 4,379; 2025 4,021; 2026 1,872 to date.
- Near a point (86 rows within 250 m of 37.760,-122.417 since 2015, 41 KB, 1.4 s):
  `https://data.sf.gov/resource/i98e-djp9.json?$select=permit_number,permit_type_definition,street_number,street_name,street_suffix,unit,description,status,issued_date,completed_date,estimated_cost,revised_cost,existing_use,reroof,block,lot,location&$where=within_circle(location,37.760,-122.417,250) AND reroof='Y' AND issued_date>='2015-01-01'&$order=issued_date DESC&$limit=500`
  (tested with the words filter in place of `reroof='Y'`). `block`+`lot` join to the assessor roll's `parcel_number`.
  Sample: `permits/sf_dbi_reroof_near_point.json`.

### Los Angeles County, EPIC-LA (works; unincorporated areas and the contract cities, 2018 on)

- `https://services.arcgis.com/RmCCgQtiZLDCtblq/arcgis/rest/services/EPIC-LA_Case_History_view/FeatureServer/0/query`
  (points, ACAO `*`, limit 2000 with paging, edited daily; 626,306 permit rows under `MODULENAME='PermitManagement'`).
- Fields: dates `ISSUANCE_DATE`, `APPLY_DATE`, `COMPLETE_DATE`, `LAST_INSPECTION_DATE` (epoch ms); address
  `MAIN_ADDRESS`; parcel `MAIN_AIN` (= the assessor layer's `AIN`); geometry point; work `DESCRIPTION`; type
  `WORKCLASS_NAME` (`Repair/Replacement`) and `CASENAME` (`Unincorporated Building Residential`, or a city's name for
  contract cities such as Lakewood, Cerritos, Artesia, Westlake Village); `PERMIT_VALUATION`; `STATUS`.
- Re-roof by words in `DESCRIPTION` (`REROOF`, `RE-ROOF`, `RE ROOF`, `TEAR OFF`); 35,281 of them are
  `Repair/Replacement` + `Unincorporated Building Residential`. Do **not** match `WORKCLASS_NAME LIKE '%ROOF%'`: that is
  rooftop solar (`Roof Mount Residential`, 30,223 rows).
- Per year: 2018 3,632; 2019 5,523; 2020 3,292; 2021 2,750; 2022 4,017; 2023 4,734; 2024 5,173; 2025 4,439; 2026 2,438
  to date. Nothing before 2018.
- Box query (Altadena, -118.16,34.17,-118.12,34.21; 2,000 rows and `exceededTransferLimit`, 1.1 MB, 2.8 s, so use zoom
  16 tiles): `?where=MODULENAME='PermitManagement' AND (UPPER(DESCRIPTION) LIKE '%REROOF%' OR UPPER(DESCRIPTION) LIKE '%RE-ROOF%' OR UPPER(DESCRIPTION) LIKE '%RE ROOF%' OR UPPER(DESCRIPTION) LIKE '%TEAR OFF%' OR UPPER(DESCRIPTION) LIKE '%TEAR-OFF%')&geometry=-118.16,34.17,-118.12,34.21&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=CASENUMBER,WORKCLASS_NAME,CASENAME,STATUS,DESCRIPTION,MAIN_ADDRESS,MAIN_AIN,APPLY_DATE,ISSUANCE_DATE,COMPLETE_DATE,PERMIT_VALUATION,USE_CURR&returnGeometry=true&outSR=4326&geometryPrecision=6&orderByFields=ISSUANCE_DATE DESC&f=json`
  The same layer carries the 2025 fire rebuild fields (`DISASTER_TYPE`, `REBUILD_PROGRESS`, `BUILD_PERMIT_ISSUED`).
  Sample: `permits/la_county_epicla_reroof_altadena_box.json`.

### San Diego County (works cross-origin, but stale and weak for roofing)

- `https://data.sandiegocounty.gov/resource/dyzh-7eat.json` (Socrata, ACAO `*`; unincorporated county; **rows last
  updated 2024-08-28, newest issue date 2023-12**).
- Fields: `issued_date`, `open_date`; `full_address`, `street_address`, `city`, `zip_code`; `geocoded_column` (location);
  `parcel_number`; work text in `use` ("Description of Work: ..."); type `record_type`, `record_category`,
  `primary_scope_code`; `valuation`; `record_status`; `contractor_name`.
- There is no re-roof type. `primary_scope_code LIKE '%ROOF%'` returns only rooftop solar (62,000 rows). Re-roofs are
  found by words in `use` (`upper(use) like '%REROOF%' OR '%RE-ROOF%' OR '%RE ROOF%'`): 2015 417; 2018 532; 2020 520;
  2021 565; 2022 814; 2023 816. `within_circle(geocoded_column, lat, lon, metres)` works.
  Sample: `permits/sd_county_reroof_sample.json`.

### City of San Diego (does not work from a browser)

- The city publishes yearly CSV files, for example
  `https://seshat.datasd.org/development_permits/approvals_closed_2025_datasd.csv` (17 MB, 29,077 rows, modified
  2026-11-18; columns `GIS_ADDRESS, GIS_APN, GIS_LATITUDE, GIS_LONGITUDE, APPROVAL_TYPE, APPROVAL_SCOPE,
  APPROVAL_ISSUE_DATE, APPROVAL_CLOSE_DATE, APPROVAL_VALUATION, PROJECT_SCOPE`). The file came back with **no
  `Access-Control-Allow-Origin`**, there is no query API, and only 187 rows of the 2025 file mention re-roofing or
  roofing at all (55 of them solar). Sample of those rows: `permits/sd_city_approvals_closed_2025_roof_sample.csv`.

---

## 9. Naval Base Coronado and Naval Base San Diego in OpenStreetMap

- Query: `navy/overpass_navy_san_diego_bay.query.txt` (box south 32.640, west -117.260, north 32.745, east -117.095;
  `military`, `landuse=military`, piers/quays/breakwaters/bridges, every `aeroway`, motorway to secondary bridge ways,
  names matching Naval/Navy/Carrier/Coronado Bridge/Quay/Wharf/Berth/USS, seamarks, docks, ports; `out tags geom;`).
- Answered by `https://overpass.kumi.systems/api/interpreter` after 77.7 s (HTTP 200, ACAO `*`; mail.ru gave 504 and
  overpass-api.de reset the connection on that round). **That server's copy of the map is dated 2026-07-24**, four months
  behind the other two servers (2026-11-19), so prefer them when they answer.
- Saved: `navy/overpass_navy_san_diego_bay.json` (1.19 MB, 1,917 elements: 1,611 ways, 284 nodes, 22 relations).

What it holds:

- **Base outlines** (`landuse=military`): Naval Air Station North Island (way 31929333, `military=base`,
  `military_service=navy`, 93 point outline, 32.6818 to 32.7155 N, -117.2281 to -117.1804), Naval Amphibious Base
  Coronado (way 554351629, 66 points, plus relation 6890930), Naval Base San Diego (relation 6992107, 32.6584 to 32.6927
  N, -117.1357 to -117.1096), Naval Base Point Loma (relation 253786), Silver Strand Training Complex (North), Marine
  Corps Recruit Depot, Naval Medical Center, Coast Guard Air Station San Diego. 43 `landuse=military` areas, 23
  `military=office`, 20 bunkers (the Point Loma batteries), 14 checkpoints (Carrier Gate, VADM Stockdale Gate, NBSD Gates
  23, 29, 32, Gate 1), 5 barracks. Relations came back with tags and bounds only: `out tags geom` drops their members,
  so to draw the three relation outlines ask those relations with `out geom;`.
- **Piers**: 648 `man_made=pier` in the box, 71 named. Naval Base San Diego has its numbered piers as centre lines:
  Pier 1 (291 m), 2 (368), 3 (413), 4 (407), 5 (380), 6 (455), 7 (447), 8 (487), 10 (454), 12 (450), 13 (428), plus the
  Ready Reserve Force Pier. Naval Base Point Loma has Sierra, Mike and November piers (submarine piers, mapped as areas).
  Naval Amphibious Base Coronado has 21 unnamed pier areas (110 to 250 m). North Island has one large concrete pier area
  on its west shore (way 1175881447, 392 x 82 m, `military_service=navy`) and many small unnamed ones.
- **The carrier quay at North Island is not mapped as a quay or pier.** There is no `man_made=quay` anywhere in the box.
  The only traces are the road `Quay Road` along the north-east shore (about 32.7027 to 32.7059 N, -117.1900 to
  -117.1819) and the checkpoint `Carrier Gate` (32.7030, -117.1826). The carrier berths have to be drawn from the base
  outline's shoreline next to Quay Road (or from the imagery). No ships are mapped (USS Midway Museum is, as a building,
  at 32.7137, -117.1752, with B Street and Broadway piers).
- **Runways**: North Island `18/36` (`surface=paved, width=61, length=2439`, mapped line 2,445 m) and `11/29`
  (`width=61, length=2286, ele=19ft`, 2,287 m), the aerodrome outline (`iata=NZY, icao=KNZY`), plus San Diego
  International's `09/27` in three pieces (`surface=asphalt, width=200 ft`). In all: 5 runway ways, 174 taxiways, 6
  taxilanes, 10 aprons, 7 stopways, 32 helipads, 8 hangars, 156 parking positions, 53 gates, 3 terminals.
- **Coronado Bridge**: six `highway=motorway` ways tagged `bridge=yes`, `bridge:name=San Diego–Coronado Bridge`,
  `ref=CA 75`, `layer=1`, `oneway=yes`, `lanes=3` (one piece `lanes=2`), `maxspeed=50 mph` on four of them, about
  2.6 km each way; and the deck outline `man_made=bridge` (way 1538967145, 74 points, 5.4 km perimeter). **No height,
  clearance or `bridge:structure` tag**: the 61 m (200 ft) navigation clearance and the curve's rise have to be supplied
  by the page. Two "San Diego-Coronado Bridge Fog Signal" seamark nodes mark the channel piers.
- Seamarks: 18 `harbour`, 5 `mooring` (a "Navy Lighted Mooring Buoy"), 3 `berth` (Coast Guard cutters), 2
  `restricted_area`.

### City of Sacramento (works; no coordinates, joins by parcel number; very good roof detail)

- Two tables without geometry, ACAO `*`, limit 2000, edited 2026-11-01:
  `https://services5.arcgis.com/54falWtcpty3V47Z/arcgis/rest/services/BldgPermitIssued_Archive/FeatureServer/0/query`
  (200,914 rows, 2016 to 2025) and `.../BldgPermitIssued_CurrentYear/FeatureServer/0/query` (17,589 rows, 2026).
- Fields: `Status_Date` (text `MM/DD/YYYY`), `Address`, `ZIP`, `Parcel_No` (14 digits, the county parcel layer's `APN`),
  `Work_Desc`, `Type` (Residential, Commercial), `Sub_Type` (`Web-Minor`), `Category`, `Activity_Code` (`R1 REROOF`
  on over-the-counter ones), `Valuation`, `Contractor`, `Current_Status`. No latitude or longitude.
- Re-roof recognised by `Activity_Code = 'R1 REROOF'` or, for the e-permits that are most of them, the fixed text
  `Work_Desc` = "Tear Off - Yes, Resheet - No, 1 layer(s), 21 squares of 30yr Laminated Dimensional Composition" (it
  names the **roof covering and the squares**: composition, TPO Single Ply, Built-up Roofing ...).
  Filter used: `UPPER(Work_Desc) LIKE '%TEAR OFF%' OR '%REROOF%' OR '%RE-ROOF%' OR '%RE ROOF%' OR UPPER(Activity_Code) LIKE '%ROOF%'`.
- Per year (archive, by `Status_Date LIKE '%/2023'`): 2016 2,466; 2017 3,431; 2018 2,945; 2019 2,872; 2020 2,125;
  2021 2,563; 2022 2,302; 2023 3,631; 2024 3,168; 2025 2,552; 2026 to date 2,274 (current year table).
- Near a point, two steps: the Sacramento County parcel layer gives the `APN`s of the tile (161 in box
  -121.4750,38.5600,-121.4700,38.5640), then a form `POST` to the archive `query` with
  `where=Parcel_No IN ('01000540220000', ...) AND (<filter>)&outFields=Application,Type,Sub_Type,Category,Status_Date,Current_Status,Parcel_No,Address,ZIP,Valuation,Activity_Code,Contractor,Work_Desc&f=json`
  returned 31 re-roof permits (17.8 KB, ACAO `*`; a 4.2 KB body, so POST rather than GET).
  Sample: `permits/sacramento_reroof_by_parcel_box.json`.

### San Jose (works cross-origin, but partial: only active, expired and under-inspection permits; no coordinates)

- CKAN datastore, ACAO `*`, refreshed daily: `https://data.sanjoseca.gov/api/3/action/datastore_search_sql?sql=...`
  (plain GET) on resources `761b7ae8-3be1-4ad6-923d-c7af6404a904` (active, 17,406 rows),
  `df4b8461-0c7a-4d16-b85d-ff7f71c5fed5` (expired, 76,370), `89ccdad9-7309-4826-a5f3-2fcf1fcb20fa` (under inspection,
  10,806). Finaled permits are not published, so this is not the full roofing history.
- Fields: `ISSUEDATE`, `FINALDATE` (text `M/D/YYYY h:mm:ss AM`), `gx_location` (address text), `ASSESSORS_PARCEL_NUMBER`
  (8 digits, the county parcel layer's `APN`), `WORKDESCRIPTION`, `SUBTYPEDESCRIPTION`, `FOLDERDESC`, `FOLDERNAME`,
  `PERMITVALUATION`, `CONTRACTOR`, `Status`.
- Re-roof is a type: **`WORKDESCRIPTION = 'ReRoof'`** (expired file: 4,904 single family, 383 apartment, 229 condo, 227
  townhouse, 172 duplex, 146 office). In the expired file by issue year: 2015 416; 2017 431; 2020 388; 2021 439;
  2022 378; 2023 365; 2024 336 (958 more in each of the active and under-inspection files).
- Near a point: parcels of the tile from the Santa Clara County layer, then
  `sql=SELECT ... FROM "df4b8461-0c7a-4d16-b85d-ff7f71c5fed5" WHERE "ASSESSORS_PARCEL_NUMBER" IN ('...') AND "WORKDESCRIPTION"='ReRoof'`.
  Sample: `permits/san_jose_reroof_by_parcel_box.json`. `datastore_search?resource_id=...&q=reroof` also works.

### Santa Rosa (works cross-origin, but the data stops in 2018)

- `https://services2.arcgis.com/BhTdzxiJkq4oXsPh/arcgis/rest/services/Building_Permits/FeatureServer/0` (points, ACAO
  `*`, 20,913 rows, last edited 2018-09-25; newest rows are from 2017). Fields `IssuedDate`, `OriginalAddress1`,
  `Description`, `PermitType`, `PermitClass`, `EstProjectCost`, `ParcelNumber`. Not current; not queried further.
  The city's fire rebuild layer (`RC_Building_Permits_SharedOpenData`) covers only rebuilt parcels.

### Statewide: HCD housing permits (works; new housing only, so it gives a year built from 2018, not roofing)

- `https://data.ca.gov/api/3/action/datastore_search_sql?sql=...` on resource `fe505d9b-8c36-42ba-ba30-08bc4f34e022`
  ("Housing Element Annual Progress Report, Table A2", every city and county, updated 2026-11-13). CKAN, ACAO `*`, GET.
- 927,020 rows; 629,073 have a building permit date and all but one of those a `LATITUDE`/`LONGITUDE`; report years
  2018 to 2025. Fields `JURIS_NAME, CNTY_NAME, YEAR, APN, STREET_ADDRESS, UNIT_CAT` (SFD, ADU, 2 to 4, 5+, MH),
  `BP_ISSUE_DT1` (permit issued), `CO_ISSUE_DT1` (certificate of occupancy), `NO_BUILDING_PERMITS`, `LATITUDE, LONGITUDE`.
- Box query that worked (Fresno, 84 rows, 22 KB, 1.2 s):
  `sql=SELECT "JURIS_NAME","YEAR","APN","STREET_ADDRESS","UNIT_CAT","BP_ISSUE_DT1","CO_ISSUE_DT1","NO_BUILDING_PERMITS","LATITUDE","LONGITUDE" FROM "fe505d9b-8c36-42ba-ba30-08bc4f34e022" WHERE "LATITUDE" BETWEEN 36.74 AND 36.77 AND "LONGITUDE" BETWEEN -119.80 AND -119.76 AND "BP_ISSUE_DT1" IS NOT NULL LIMIT 500`
  Samples: `permits/hcd_apr_table_a2_fresno_box.json`, `permits/hcd_apr_table_a2_fresno_sample.json`.
- Use: in the counties with no assessor year built (Fresno, Kern, Sacramento, Alameda, San Bernardino, San Mateo,
  Placer) it at least marks the homes built since 2018. No statewide table of re-roof permits was found.

### Cities with nothing usable found

| City | What was checked | Result |
|---|---|---|
| Oakland | Socrata catalog of `data.oaklandca.gov` for "permit"; ArcGIS Online | only parking permit zones and housing pipeline; no building permits |
| Long Beach | the city's ArcGIS organisation (`services6.arcgis.com/yCArG7wGXGyWLqav`, 167 services) | inspector districts and a housing permit summary; no permit records |
| Fresno, Bakersfield, Anaheim, Santa Ana, Irvine | ArcGIS Online search for building permits by city | no public permit service found |
| Riverside (city) | ArcGIS Online search | no building permit service found (county server down, see below) |
| San Diego (city) | yearly CSV files on `seshat.datasd.org` | no ACAO, no query API, almost no re-roof rows |
| Santa Rosa | city ArcGIS organisation | permits end in 2018 |

These were searches, not proofs of absence: a city may publish permits only through a vendor portal (Accela, EnerGov,
Tyler) that has no cross-origin API.

### Summary of section 3

| Place | Endpoint | Box or point query | Re-roof recognised by | Roofing permits a year | ACAO | Usable |
|---|---|---|---|---|---|---|
| Los Angeles (city) | `data.lacity.org/resource/pi9x-tg5x.json` (+ `dyxf-7hc4`, `e67z-kt2n`) | `within_box`, `within_circle` on `geolocation` | words in `work_desc` ("Re-roof ... Squares") | 12,000 to 14,600 (2023 to 2026) | `*` | yes, 1996 on |
| Los Angeles County (unincorporated, contract cities) | `EPIC-LA_Case_History_view/FeatureServer/0` | ArcGIS envelope | words in `DESCRIPTION` | 4,000 to 5,200 | `*` | yes, 2018 on |
| San Francisco | `data.sf.gov/resource/i98e-djp9.json` | `within_box`, `within_circle` on `location` | `reroof='Y'` or words in `description` | 3,500 to 4,400 | `*` | yes, decades |
| Sacramento (city) | `BldgPermitIssued_Archive` and `_CurrentYear` tables | by `Parcel_No` (parcel layer first) or `Address` | `Activity_Code='R1 REROOF'` or "Tear Off ..." text | 2,300 to 3,600 | `*` | yes, 2016 on |
| San Jose | `data.sanjoseca.gov` CKAN SQL | by `ASSESSORS_PARCEL_NUMBER` or address text | `WORKDESCRIPTION='ReRoof'` | 340 to 440 in the files published | `*` | partial |
| San Diego County | `data.sandiegocounty.gov/resource/dyzh-7eat.json` | `within_circle` on `geocoded_column` | words in `use` | 500 to 800 | `*` | weak, ends 2023 |
| San Diego (city), Oakland, Long Beach, Fresno, Bakersfield, Anaheim, Santa Ana, Riverside, Irvine, Santa Rosa | see above | | | | | no |
| Statewide (HCD APR A2) | `data.ca.gov` CKAN SQL | latitude/longitude range | not roofing: new housing permits | about 80,000 to 120,000 new-unit rows a year | `*` | for year built since 2018 |

---

## Closing notes

- **Riverside County re-test.** `https://gis.countyofriverside.us/arcgis_mapping/rest/services/OpenData/Assessor/MapServer/80?f=json`
  still answered `HTTP 500` (no ACAO) at the end of the session, well after the first, successful test. The
  layer and table are real (samples saved) but the page needs to treat this server as one that can be down.
- **Geocoder.** `EP.geocode` (Esri World Geocoder) was not re-tested; only its `searchExtent`/`location` need changing
  for California (roughly `-124.6,32.4,-114.0,42.1`).
- **Census TIGER roads** (`EP.roads`) were not re-tested; the service is national.
- Hosts that could not be reached from this sandbox at all (so nothing can be said about their cross-origin headers):
  `gis.apfo.usda.gov` (USDA NAIP), `overpass-api.de` over HTTPS, `overpass.private.coffee`.
- The "about 80,000 to 120,000 a year" figure for the statewide table is the 629,073 permitted rows spread over eight
  report years; it was not counted year by year.
