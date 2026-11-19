# California weather and hazard records: sources tested and downloaded

Written 2026-11-19 (UTC). Every URL below was fetched from this session unless marked NOT REACHED.
No API keys were used. Nothing here is estimated: counts are row counts of the files on disk.

**Root of all downloads** (written `H/` below):
`/tmp/claude-0/-home-user-Leviathan/3de4e742-518d-5f10-b5db-2b34e6723642/scratchpad/ca/dl/hazard/`

Sections are numbered as in the brief and appear in this order: 1, 2, 3, 4, 9, 5, 6, 7, 10, 8, then what
was not obtained.

Each topic folder holds the raw files, the download script beside them, and the tables made from them.
`H/_scripts/verify_files.py` re-tests every file (gzip, zip, JSON); last run at the end of the work, after the
second container restart: 3,380 files, 2 flagged, both expected (a JavaScript file served under a `.json` name, and an
empty body from an endpoint that answers 302).

| # | Topic | Folder | California rows on disk |
|---|-------|--------|-------------------------|
| 1 | NOAA Storm Events 1950-2026 | `H/stormevents/` | 41,790 events (40,554 in 1996-2025) |
| 1 | NWS zones, counties, dated zone history | `H/nws_zones/` | 209 current public zones; 655 dated zone/county outlines |
| 2 | SPC tornado, hail, wind reports | `H/spc/` | 486 tornadoes, 891 hail, 1,216 wind |
| 2+ | NWS Local Storm Reports 2004-2026 (point reports) | `H/lsr/` | 82,938 reports |
| 3 | Airport daily summaries (IEM) | `H/asos_daily/` | 161 stations, 8,086 station-years |
| 3, 4, 9 | GHCN-Daily station files | `H/ghcnd/` | 922 stations, 48,415 station-years |
| 4, 9 | 1991-2020 climate normals | `H/normals/` | 768 stations (355 with temperature and rain); curated set of 70 |
| 5 | Atmospheric rivers | `H/atmospheric_rivers/` | 12,461 AR events at 20 California coast points; SIO-R1 4,247 ARs |
| 6 | Santa Ana winds | `H/santa_ana_diablo/` | daily index 1948-2018 (25,933 days), hourly 1948-2012 |
| 7 | CAL FIRE DINS, perimeters, FHSZ | `H/calfire/` | 132,522 structures; 23,334 perimeters; 46,728 zone polygons |
| 8 | Snow: CDEC sensors; local design documents | `H/snow/` | 145 stations, 6,553 station-water-years |
| 8 | ASCE 7-22 ground snow load and wind speed | `H/asce7/` | 768 station points; 40,320 grid points |
| 10 | NWS offices and api.weather.gov | `H/nws_api/` | 10 offices; 209 public, 58 county, 170 fire zones |

---

## 1. NOAA Storm Events Database (NCEI), California, bulk yearly files

- **URL that worked**: directory `https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/`; files
  `StormEvents_details-ftp_v1.0_d<YYYY>_c<created>.csv.gz`, plus `StormEvents_locations-...` and
  `StormEvents_fatalities-...`. Creation stamps on the day of download: `c20261118` for most years
  1996-2026, `c20260323` for the rest. The exact file name, byte size, SHA-256 and row counts of all 231
  files are in `H/stormevents/manifest_all.json`.
- **Filter**: `STATE == 'CALIFORNIA'` in details; locations and fatalities joined by `EVENT_ID`.
- **Years**: 1950-2026 downloaded. 1950-1995 hold only tornado, thunderstorm wind and hail (29 or fewer
  California rows a year). All 48+ event types start in 1996. 2025 runs to 26 Dec 2025; 2026 is partial
  (to 28 Aug 2026, 685 rows).
- **Rows**: details 41,790 (1996-2025: 40,554); locations 35,500; fatalities 1,361.
- **Fields (51 in details)**: BEGIN_YEARMONTH, BEGIN_DAY, BEGIN_TIME, END_YEARMONTH, END_DAY, END_TIME,
  EPISODE_ID, EVENT_ID, STATE, STATE_FIPS, YEAR, MONTH_NAME, EVENT_TYPE, CZ_TYPE (C county, Z forecast
  zone, M marine), CZ_FIPS, CZ_NAME, WFO, BEGIN_DATE_TIME, CZ_TIMEZONE, END_DATE_TIME, INJURIES_DIRECT,
  INJURIES_INDIRECT, DEATHS_DIRECT, DEATHS_INDIRECT, DAMAGE_PROPERTY, DAMAGE_CROPS, SOURCE, MAGNITUDE,
  MAGNITUDE_TYPE, FLOOD_CAUSE, CATEGORY, TOR_F_SCALE, TOR_LENGTH, TOR_WIDTH, TOR_OTHER_*, BEGIN_RANGE,
  BEGIN_AZIMUTH, BEGIN_LOCATION, END_*, BEGIN_LAT, BEGIN_LON, END_LAT, END_LON, EPISODE_NARRATIVE,
  EVENT_NARRATIVE, DATA_SOURCE. Locations (11): YEARMONTH, EPISODE_ID, EVENT_ID, LOCATION_INDEX, RANGE,
  AZIMUTH, LOCATION, LATITUDE, LONGITUDE, LAT2, LON2. Format documents saved:
  `H/stormevents/raw/Storm-Data-Bulk-csv-Format.pdf`, `Storm-Data-Export-Format.pdf`, `README`.
- **Local files**
  - `H/stormevents/CA_StormEvents_details_1950_2026.csv.gz` (5.7 MB), `..._locations_...`, `..._fatalities_...`
  - `H/stormevents/ca_by_year/CA_StormEvents_<kind>_<year>.csv.gz` (one per year and kind)
  - `H/stormevents/CA_stormevents_counts_by_type_year.csv` (event type x year, with C/Z/M split, rows
    with coordinates, magnitude types)
  - `H/stormevents/CA_stormevents_cz_codes_used.csv` (325 distinct county/zone codes used)
  - scripts `download_stormevents.py`, `tabulate_stormevents.py`
- **Counts by event type, 1996-2025** (full year-by-year table is the CSV above):

| Event type | 1996-2025 | filed by | has lat/lon |
|---|---|---|---|
| High Wind | 7,077 | zone | no |
| Flood | 4,099 | county | 3,731 of 4,253 |
| Heavy Snow | 3,740 | zone | no |
| Flash Flood | 2,808 | county | 2,276 of 2,843 |
| Dense Fog | 2,377 | zone | no |
| Strong Wind | 2,365 | zone | no |
| Heavy Rain | 2,038 | county | 1,542 of 2,055 |
| Drought | 1,870 | zone | no |
| Winter Storm | 1,643 | zone | no |
| Wildfire | 1,590 | 1,092 zone, 501 county | no |
| Frost/Freeze | 1,490 | zone | no |
| Excessive Heat | 1,481 | zone | no |
| Winter Weather | 1,470 | zone | no |
| Heat | 1,171 | zone | no |
| Thunderstorm Wind | 1,064 (1,369 since 1955) | county | 1,283 of 1,369 |
| Hail | 827 (939 since 1955) | county | 903 of 939 |
| Debris Flow | 803 | 704 county, 103 zone | 706 of 807 |
| High Surf | 496 | zone | no |
| Tornado | 268 (489 since 1950) | county | 470 of 489 |
| Funnel Cloud 444, Lightning 355, Dust Storm 234, Cold/Wind Chill 193, Extreme Cold 119, Rip Current 116, Coastal Flood 93, Avalanche 53, Blizzard 44, Waterspout 44, Dense Smoke 35, Storm Surge/Tide 32, Tropical Storm 23, Tsunami 21, Sneakerwave 20, Dust Devil 18, Astronomical Low Tide 17, Freezing Fog 7, Ice Storm 7, Lake-Effect Snow 1, Marine High Wind 1 | | | |

- **Rows per year** rise from 396 (1996) to 3,148 (2023): reporting practice changed, so a raw trend is
  not a climate trend. Rows by office: HNX 12,878, SGX 6,887, MTR 4,308, STO 4,259, REV 2,999, LOX 2,900,
  VEF 2,234, EKA 2,122, MFR 1,695, PSR 959 (HNX splits events across many small zones).
- **Limits**: wind, winter, heat and most wildfire rows carry a zone code and no coordinates (27,932 zone
  rows). They must be placed through the zone outlines in section 1b. `DAMAGE_PROPERTY` is non-zero in
  only 5-35% of rows a year. Pre-1996 WFO codes are legacy strings.

### 1b. NWS public forecast zones, counties and zone-county correspondence

- **Current official files** (page `https://www.weather.gov/gis/ZoneCounty`, `/gis/PublicZones`,
  `/gis/FireZones`, `/gis/CWABounds`, `/gis/Counties`), valid 16 April 2026:
  - `https://www.weather.gov/source/gis/Shapefiles/County/bp16ap26.dbx` (pipe text: STATE|ZONE|CWA|NAME|
    STATE_ZONE|COUNTY|FIPS|TIME_ZONE|FE_AREA|LAT|LON). California: **306 rows, 209 zones, 58 counties,
    10 offices** -> `H/nws_zones/CA_zone_county_bp16ap26.csv`. Caution: its LAT/LON repeat across the
    zones of an office in places (CA101-CA105 all 41.0243, -124.0956); use the centroids below instead.
  - `.../WSOM/z_16ap26.zip` public zones -> `CA_public_zones_z_16ap26.geojson` + `.csv` (209 zones, with
    centroid, inside point, bounding box). Previous version `z_18mr25.zip` -> 173 zones.
  - `.../WSOM/fz16ap26.zip` fire weather zones -> `CA_fire_zones_fz16ap26.geojson` (170).
  - `.../WSOM/w_16ap26.zip` county warning areas -> `CA_cwa_w_16ap26.geojson` (10 offices).
  - `.../County/c_16ap26.zip` counties -> `CA_counties_c_16ap26.geojson` (58).
  - change logs `zone_ch_log.txt`, `fz_ch_log.txt`, `cwa_chg_log.txt`, `cty_chg_log.txt` in `H/nws_zones/raw/`.
- **Zone history** (zones were redrawn many times; 339 California zones before 2008, 209 now):
  `https://mesonet.agron.iastate.edu/api/1/nws/ugcs.geojson?state=CA&valid=YYYY-MM-DDT00:00:00Z`
  (Iowa Environmental Mesonet; it tracks changes since 2007, simplified outlines). Snapshots taken for
  1 Jan and 1 Jul of 2005-2026 (44 files in `H/nws_zones/raw/iem_ugc_snapshots/`), merged into
  - `H/nws_zones/CA_ugc_history_iem_2005_2026.geojson` and `.csv`: **655 distinct outline versions of 400
    codes (577 zone versions)** with first and last snapshot date, centroid, inside point, area;
  - `H/nws_zones/CA_ugc_history_county_overlap.csv`: 1,106 rows, share of each zone version in each county;
  - `H/nws_zones/CA_stormevents_zone_lookup.csv`: the 389 (zone code, name) pairs used in Storm Events,
    years used, and the centroid of the outline valid at the event date.
- **Test result**: of 27,932 zone-filed Storm Events rows, 27,536 (98.6%) find their code in the snapshot
  valid at the event date. **Not matched: 396 rows, 1996-2005**, in zones retired before the archive
  begins (CAZ008-012, 020-025, 049, 074, 075: Santa Clara, coastal Monterey, Siskiyou, Modoc, the old
  San Joaquin Valley and southern Sierra zones, Riverside valleys, Santa Cruz, San Mateo). Their names
  give the county; no outline was found. NCEI's own `ugc_areas.csv` (in `H/stormevents/raw/`, 188
  California rows) has names and partial dates but zero coordinates for most zones.
- Scripts: `extract_ca_zones.py`, `download_iem_ugcs.py`, `build_ugc_history.py`,
  `crosscheck_stormevents_zones.py`. Leftover test files in `H/nws_zones/raw/iem_ugcs/` can be ignored.

---

## 2. Storm Prediction Center severe weather database (tornado, hail, wind)

- **URL that worked**: `https://www.spc.noaa.gov/wcm/data/` files `1950-2025_actual_tornadoes.csv`,
  `1950-2025_all_tornadoes.csv` (county segments), `1955-2025_hail.csv.zip`, `1955-2025_wind.csv.zip`;
  format `SPC_severe_database_description.pdf` (a scanned image; read from page images), `changelog.txt`.
- **Filter**: `st == 'CA'`. **Rows**: tornadoes 486 of 73,458 (1951-2025); hail 891 of 414,481
  (1957-2025); thunderstorm wind 1,216 of 562,088 (1955-2025).
- **Fields**: om, yr, mo, dy, date, time, tz (3 = CST), st, stf, stn, mag, inj, fat, loss, closs, slat,
  slon, elat, elon, len (miles), wid (yards), ns, sn, sg, f1-f4 (county FIPS), fc (tornado), mt (wind),
  edat, etime. `mag` is F/EF rating for tornadoes (-9 unknown), **hail diameter in inches**, **wind speed
  in knots** (1 knot = 1.15 mph; 0 = not given). `mt`: EG estimated gust, MG measured gust, MS measured
  sustained, ES estimated sustained (from 2006).
- **California magnitudes**: tornadoes EF0 322, EF1 132, EF2 24, EF3 2, unknown 6. Hail: 0.75 in 276,
  1.00 in 248, 0.88 in 68, 1.25 in 25, 1.5 in 26, 1.75 in 40, 2 in or more 12 (largest 3.00 in, 2
  reports); 193 reports under 0.75 in. Wind: 146 with speed 0 (not given); 488 EG, 299 MG, 2 ES, 427 blank.
- **Local files**: `H/spc/CA_spc_torn_1950-2025.csv`, `CA_spc_torn_all_segments_1950-2025.csv`,
  `CA_spc_hail_1955-2025.csv`, `CA_spc_wind_1955-2025.csv`, `CA_spc_counts_by_year.csv`,
  `CA_spc_summary.json`, `manifest_spc.json`, national raw files in `H/spc/raw/`, script `download_spc.py`.
- **Limit**: these are thunderstorm reports only. Santa Ana, Diablo and winter-storm gusts are not in SPC
  files; they are in Storm Events (zone rows) and in the Local Storm Reports below.

### 2b. NWS Local Storm Reports with coordinates (added because California wind is mostly non-thunderstorm)

- **URL that worked**: `https://mesonet.agron.iastate.edu/cgi-bin/request/gis/lsr.py?state=CA&sts=<Y>-01-01T00:00Z&ets=<Y+1>-01-01T00:00Z&fmt=csv`
  (one request per year; help page saved `H/lsr/raw/lsr_help.html`).
- **Years**: requested 1996-2026; the archive returns **nothing before 2004** (2004: 181 rows). Through
  mid-November 2026.
- **Rows: 82,938.** By type: NON-TSTM WND GST 22,389; SNOW 14,690; HEAVY RAIN 7,359; FLOOD 7,321; HEAVY
  SNOW 6,688; NON-TSTM WND DMG 5,660; FLASH FLOOD 3,268; HAIL 3,114; RAIN 2,123; DEBRIS FLOW 1,501; FOG
  1,253; TSTM WND GST 1,087; DENSE FOG 1,053; TSTM WND DMG 1,003; HIGH SUST WINDS 669; LANDSLIDE 610;
  HIGH SURF 531; EXCESSIVE HEAT 403; FUNNEL CLOUD 316; DUST STORM 304; LIGHTNING 290; WILDFIRE 288;
  TORNADO 216; others below 200.
- **Fields**: VALID (UTC), VALID2, LAT, LON, MAG (mph for wind, inches for hail, rain and snow), WFO,
  TYPECODE, TYPETEXT, CITY, COUNTY, STATE, SOURCE, REMARK, UGC, UGCNAME, QUALIFIER (E/M/U).
- **Local files**: `H/lsr/CA_lsr_1996_2026.csv`, `CA_lsr_counts_by_type_year.csv`, `raw/by_year/`,
  `manifest_lsr.json`, script `download_lsr_ca.py`. Two rows needed repair for stray commas.
- **Limit**: reports are what offices chose to send; coverage grows over time (181 rows in 2004, about
  5,900 in 2019). Mountain RAWS and mesonet gusts dominate the wind rows.

---

## 3. Measured wind: daily peak gust at airport stations

Two sources were downloaded. **Both contain spurious gust spikes and must not be used raw** (see the
screen below); screened tables are provided.

### 3a. Iowa Environmental Mesonet daily summaries, network CA_ASOS

- **Station list**: `https://mesonet.agron.iastate.edu/geojson/network/CA_ASOS.geojson` -> **161
  stations** (149 online) -> `H/asos_daily/CA_ASOS_stations.csv` (sid, name, lat, lon, elev_m,
  archive_begin, archive_end, online, county, wfo, ugc_zone, ugc_county, climate_site, ncei91 = GHCN id,
  ghcnh_id, wmo_synop).
- **Data URL that worked** (one request per station, 2.5 s apart; the service throttles per IP and
  answered one 429 in 161 requests):
  `https://mesonet.agron.iastate.edu/cgi-bin/request/daily.py?sts=1928-01-01&ets=2026-11-17&network=CA_ASOS&stations=<SID>&format=csv&na=M`
- **Years**: each station from its archive start (earliest in the 1900s; most in the 1940s or 1970s) to 17 Nov 2026.
  All 161 files came back; 8,086 station-years.
- **Fields**: station, day, max_temp_f, min_temp_f, max_dewpoint_f, min_dewpoint_f, precip_in,
  avg_wind_speed_kts, avg_wind_drct, min_rh, avg_rh, max_rh, snow_in, snowd_in, min_feel, avg_feel,
  max_feel, max_wind_speed_kts, **max_wind_gust_kts**, srad_mj, network, climo_high_f, climo_low_f,
  climo_precip_in. Wind is in knots.
- **Local files**: `H/asos_daily/raw/by_station/<SID>.csv.gz` (161 files);
  `H/asos_daily/CA_gust_days_iem_asos_by_station_year.csv` and `..._station_summary.csv` (screened and
  raw days at 40, 50, 58, 65, 75 mph); `H/asos_daily/CA_ASOS_days_by_station_year.csv` and
  `CA_ASOS_station_summary.csv` (rain days at 1, 2, 3 in; max-temperature days at 90, 100, 105, 110,
  115 F; its gust columns are labelled RAW_UNSCREENED). Scripts `download_iem_daily.py`,
  `tabulate_asos_daily.py`, `H/_scripts/gust_qc_tables.py`.
- **Limit 1, early years**: before about 2002 the daily gust is filled only on days when a gust was
  reported (LAX: 35 gust values in 1996, 356 in 2002, 365 after 2004). A blank then means "no gust
  reported". The tables treat a blank as no gust and count a year complete when it has 330 or more
  days with any observation.
- **Limit 2, bad values**: raw maxima include 1,098 mph (Gray Butte), 526 mph (Mojave), 293 mph
  (Modesto). Raw San Luis Obispo shows 100 days of 58 mph or more in 2012 while its fastest sustained
  wind those days was 14-21 knots.

### 3b. GHCN-Daily peak gust (WSF5 fastest 5-second wind, WSFG peak gust)

- Same files as section 4. **107 California stations have gust data; 74 have 15 or more complete years
  in 1996-2025** (73 have 20 or more). Only 10 span every year 1996-2025.
- Tables: `H/ghcnd/CA_gust_days_ghcnd_by_station_year.csv`, `..._station_summary.csv`.
- The NCEI quality flag does not remove the spikes (Oxnard raw: 194 days of 58 mph or more in 14 years;
  Point Mugu "196 mph").

### The screen applied to both (my rule, stated so it can be changed)

A daily gust of 40 mph or more is kept only if **gust / fastest sustained wind of the day < 2.25**, and
**fastest sustained / daily mean wind < 8**, and **gust <= 130 mph**. When the sustained or mean wind
is missing the day is kept only if the gust is under 75 mph. Evidence for the rule (in
`gust_qc_tables.py` output): of 26,125 GHCN station-days with a gust of 40 mph or more, 89% have a
gust/sustained ratio between 1.0 and 2.0; 2,189 have a ratio of 2.5 or more, and those cluster in
2007-2013 (136 to 390 a year against 9 to 47 a year in 2002-2006 and 2015-2022). The same cluster
appears in the IEM data (7,626 of 48,274 station-days at ratio 2.5 or more, 427 to 1,191 a year in 2008-2013).
The cause of the 2007-2013 cluster was not verified here.

| 1996-2025 station-days | 40 mph | 50 mph | 58 mph | 65 mph | 75 mph | rejected |
|---|---|---|---|---|---|---|
| GHCN raw | 26,357 | 6,609 | 3,090 | 1,812 | 1,269 | |
| GHCN screened | 23,516 | 4,526 | 1,252 | 350 | 60 | 2,841 |
| IEM raw | 47,231 | 13,871 | 7,576 | 4,679 | 3,332 | |
| IEM screened | 38,707 | 8,223 | 2,803 | 940 | 272 | 8,524 |

Screened days a year at 40 / 50 / 58 / 65 / 75 mph (GHCN, complete years in 1996-2025): Sandberg 88.7 /
29.2 / 11.1 / 3.8 / 0.44 (27 years, top 101 mph on 24 Nov 2010); Barstow-Daggett 52.2 / 11.8 / 2.6 / 0.6
/ 0.04; South Lake Tahoe 31.2 / 7.9 / 2.0 / 0.33 / 0; Crescent City 34.8 / 8.4 / 2.0 / 0.78 / 0; San
Francisco airport 30.0 / 5.8 / 1.7 / 0.4 / 0.1 (30 years, top 83 mph on 14 Dec 2024); Ontario 10.8 / 4.1
/ 1.6 / 0.44 / 0.08; Redding 15.7 / 4.2 / 1.2 / 0.3 / 0.04; Oxnard 11.1 / 2.2 / 1.0 / 0.5 / 0.12. The two
sources agree after screening (Sandberg IEM 86.9 / 28.4 / 11.6 / 3.8 / 0.68).

**Remaining doubt**: the screen cannot catch a day on which the sustained wind was corrupted too. Some
screened maxima still look wrong (IEM: Bicycle Lake 124 mph, Mojave 114 mph, Inyokern 112 mph). Counts
at 75 mph are the least reliable. Airports sit in valleys and on coasts; ridge and canyon gusts in
Santa Ana and Diablo events are far higher than any airport record (see sections 2b and 6).

---

## 4. Rain days and 1991-2020 climate normals

### 4a. GHCN-Daily (NCEI) station files

- **URLs that worked**: `https://www.ncei.noaa.gov/pub/data/ghcn/daily/ghcnd-stations.txt`,
  `ghcnd-inventory.txt`, `readme.txt`, `ghcnd-version.txt` (version 3.35-upd-2026111517), and
  `https://www.ncei.noaa.gov/pub/data/ghcn/daily/by_station/<ID>.csv.gz`
  (ID, DATE, ELEMENT, VALUE, MFLAG, QFLAG, SFLAG, OBSTIME).
- **Selection**: of 3,241 California stations in the list, the 922 whose inventory shows PRCP, TMAX,
  SNWD, WSF5, WSFG or WESD ending in 1996 or later, in networks USW (airports, 142 listed), USC
  (cooperative), USS (SNOTEL, 33), USR (RAWS), USP. **The 1,553 CoCoRaHS (US1) volunteer gauges were not
  downloaded** (the script takes `--cocorahs` to add them). All 922 files came back (304 MB), each over
  its full period of record.
- **Units**: PRCP tenths of mm (254 = 1.00 in); TMAX tenths of deg C; SNOW, SNWD mm; WESD tenths of mm;
  wind tenths of m/s. Values with a quality flag are dropped in the tables.
- **Tables**: `H/ghcnd/CA_ghcnd_days_by_station_year.csv` (48,415 station-years: values present, days of
  rain at 1, 2, 3 in, annual total, wettest day; days of max temperature at 90, 100, 105, 110, 115 F,
  hottest day; raw gust columns; greatest snow depth, snowfall total, greatest snow-water equivalent);
  `H/ghcnd/CA_ghcnd_station_summary.csv` (means a year over complete years, 1996-2025 and 1991-2020);
  `H/ghcnd/CA_ghcnd_stations.csv` (all 3,241 stations with first and last year of each element).
- **Coverage**: **306 stations have 20 or more complete rain years in 1996-2025** (330+ daily values);
  484 have 20 or more complete max-temperature years.
- Scripts `download_ghcnd_ca.py`, `tabulate_ghcnd.py`.

### 4b. NCEI U.S. Climate Normals 1991-2020, monthly

- **URLs that worked**: inventory `https://www.ncei.noaa.gov/data/normals-monthly/1991-2020/doc/inventory_30yr.txt`;
  station `https://www.ncei.noaa.gov/data/normals-monthly/1991-2020/access/<ID>.csv`; annual and seasonal
  `https://www.ncei.noaa.gov/data/normals-annualseasonal/1991-2020/access/<ID>.csv`; documentation PDFs
  in `H/normals/raw/`. (The `access/` directory listing itself timed out; single files answer in 0.5 s.)
- **Rows**: **768 California stations**, all downloaded in both products. 373 have temperature normals,
  750 rain, **355 both**, 278 snowfall.
- **Fields (110 variables a month)** include MLY-TMAX-NORMAL, MLY-TMIN-NORMAL, MLY-TAVG-NORMAL,
  MLY-PRCP-NORMAL, MLY-SNOW-NORMAL, MLY-TMAX-AVGNDS-GRTH090 and GRTH100 (days at 90 and 100 F),
  MLY-TMIN-AVGNDS-LSTH032, MLY-PRCP-AVGNDS-GE001HI / GE010HI / GE025HI / GE050HI / **GE100HI (1.00 in)** /
  **GE200HI (2.00 in)** / GE400HI / GE600HI, MLY-SNOW-AVGNDS-*, MLY-SNWD-AVGNDS-*, degree days; each with
  completeness flags (S standard, R representative, P provisional, Q quasi-normal, E estimated).
  Station latitude, longitude and elevation (m) are in every file.
- **Tables**: `H/normals/CA_normals_1991_2020_monthly_long.csv` (station x month, 20 variables with
  flags); `H/normals/CA_normals_1991_2020_station_annual.csv` (768 stations: annual means and day counts).
- **Curated set: 70 stations in 16 climate regions**
  `H/normals/CA_selected_70_stations_normals_and_threshold_days.csv` (and `.json`): region, id, name, lat,
  lon, elevation, 12 monthly normal max, min and rain values, normals day counts, and GHCN-Daily days a
  year of rain at 1, 2, 3 in and of max temperature at 100, 105, 110, 115 F with the number of complete
  years behind each. Regions and counts: North coast 3 (Crescent City, Eureka, Ukiah); Bay Area 6;
  Central coast 6; Los Angeles basin 8; San Diego 4; Inland Empire 4; Sacramento Valley 3; San Joaquin
  Valley 5; Sierra foothills 4; High Sierra 6 (Blue Canyon, Yosemite HQ, Mammoth Lakes, Huntington Lake,
  Lodgepole, Bishop); Tahoe 3; Shasta, Cascades and northeast 5; Mojave 5; Coachella and Imperial 4;
  Death Valley 1; Southern California mountains 3 (Big Bear Lake, Idyllwild, Sandberg).
- **Limits**: the normals give days at 1 and 2 inches but **not 3 inches**, and 100 F but **not 110 F**;
  those come from the daily data. Some curated stations have short daily records in 1996-2025 (Chico
  4-6 complete years, Three Rivers 5 for temperature, Auburn 8-9, Ukiah 8-13); the year counts are in
  the table. Chico, Mammoth Lakes and China Lake have no normals rain-day counts. Fort Bragg,
  Placerville and Mariposa have no station with both temperature and rain normals.

## 9. Heat: days at 100 F and 110 F

Answered by the same files. Normals give days at 90 and 100 F for 373 stations; GHCN-Daily gives 100,
105, 110 and 115 F by year for 922 stations. Examples from the curated table (days a year, normals
100 F / daily 1996-2025 100 F / 110 F): Death Valley 146.9 / 148.2 / 98.2; Needles 122.4 / 122.8 / 48.9;
Blythe 121.6 / 121.6 / 38.7; Palm Springs 114.8 / 116.6 / 34.7; Imperial 120.9 / 118.9 / 32.1; Barstow-
Daggett 88.1 / 88.7 / 12.6; Redding 40.9 / 44.1 / 4.5; Fresno 38.5 / 42.5 / 1.3; Bakersfield 35.4 / 38.5 /
1.2; Woodland Hills 35.5 / 39.4 / 2.4; Riverside 21.6 / 22.7 / 0.7; Sacramento 14.0 / 15.9 / 0.4; Burbank
7.2 / 6.8 / 0.4; downtown Los Angeles 1.9 / 1.6 / 0.1; San Francisco downtown 0.1 / 0.13 / 0.

---

## 5. Atmospheric rivers

### 5a. The AR scale, exactly as published

Ralph, Rutz, Cordeira, Dettinger, Anderson, Reynolds, Schick and Smallcomb (2019), "A Scale to
Characterize the Strength and Impacts of Atmospheric Rivers", Bulletin of the American Meteorological
Society 100(2), 269-289, doi:10.1175/BAMS-D-18-0023.1. Abstract text retrieved from
`https://api.crossref.org/works/10.1175/BAMS-D-18-0023.1` and `https://pubs.usgs.gov/publication/70202024`
(both saved in `H/atmospheric_rivers/raw/`):

> "AR categories 1-5 are defined by thresholds for maximum IVT (3-h average) of 250, 500, 750, 1,000,
> and 1,250 kg m-1 s-1, and by IVT exceeding 250 kg m-1 s-1 continuously for 24-48 h. If the AR event
> duration is less than 24 h, it is downgraded by one category. If it is longer than 48 h, it is
> upgraded one category."

IVT is vertically integrated water vapor transport; duration is the time IVT stays at or above
250 kg m-1 s-1 at one point. Names (CW3E release of 5 Feb 2019, saved): AR1 weak, primarily beneficial;
AR2 moderate, mostly beneficial, also hazardous; AR3 strong, balance of beneficial and hazardous; AR4
extreme, mostly hazardous, also beneficial; AR5 exceptional, primarily hazardous.

| Maximum IVT (kg m-1 s-1) | duration under 24 h | 24 to 48 h | over 48 h |
|---|---|---|---|
| 250 to 500 | not an AR (rank 0) | AR1 | AR2 |
| 500 to 750 | AR1 | AR2 | AR3 |
| 750 to 1,000 | AR2 | AR3 | AR4 |
| 1,000 to 1,250 | AR3 | AR4 | AR5 |
| 1,250 and above | AR4 | AR5 | AR5 |

The table was checked against all 12,461 California rows of the catalogue below: every row's rank
follows it (for example 4,032 rows with 500-750 and under 24 h are all rank 1; no row has 250-500 with
under 24 h). The cell "1,250 and above, under 24 h" has no California case. The full paper was not
retrieved (publisher site returned 403/405); the thresholds above are from the abstract.

### 5b. CW3E U.S. West Coast AR Landfall Catalog (ERA5; ranked by the scale)

- **Page**: `https://cw3e.ucsd.edu/tools/observations/ar-landfall-catalog/`
- **URLs that worked**: points `https://cw3e.ucsd.edu/Projects/ARCatalog/json/points.json` (a JavaScript
  file, 61 coastal points every 0.5 degree from 25N to 55N); events
  `https://cw3e.ucsd.edu/Projects/ARCatalog/csv/eventData/CW3E_ARoutput_<lat x10>_<lon x10>.csv`
  (example `CW3E_ARoutput_375_1225.csv` = 37.5N 122.5W).
- **Not downloaded**: hourly IVT per point,
  `.../csv/pointData/CW3E_pointData_<lat>_<lon>.csv` (20-22 MB each, 1 Jan 1959 to 10 Jan 2026).
- **Years**: events starting 7 Oct 1959 to 31 Dec 2025. The page text says to 30 Sep 2025; the files run
  later. Water years 1960-2025 are complete; water year 2026 holds October-December 2025 only.
- **Fields (no header in the source; 13 columns)**: start (YYYYMMDDHH UTC), time of maximum IVT, end,
  duration (h), maximum IVT, **AR scale**, average IVT, direction of maximum IVT, average direction,
  maximum IWV (mm), average IWV, average uIVT, average vIVT.
- **Rows**: 57,815 at all 61 points; **12,461 at the 20 California points (32.5N to 42.0N)**: AR1 6,767,
  AR2 3,588, AR3 1,580, AR4 417, AR5 109.
- **Local files**: `H/atmospheric_rivers/raw/cw3e_ar_catalog/eventData/` (61 files);
  `H/atmospheric_rivers/CW3E_AR_events_all_points.csv` (with header);
  `CW3E_AR_counts_by_point_wateryear_scale.csv` (point x water year x rank);
  `CW3E_AR_mean_per_year_by_point_scale.csv` (means for water years 1960-2025, 1991-2020, 1996-2025);
  `CW3E_AR_counts_by_coast_stretch_wateryear_scale.csv`; scripts `download_cw3e_ar_catalog.py`,
  `tabulate_cw3e_ar.py`.
- **ARs a water year at selected points, water years 1960-2025 (AR1, AR2, AR3, AR4, AR5 totals in 66 years)**:
  32.5N San Diego 3.3 a year (128, 65, 21, 5, 2); 34.0N Los Angeles 3.0 (128, 51, 21, 1, 0); 34.5N
  Santa Barbara 4.4 (179, 81, 26, 3, 0); 35.5N 6.8 (253, 120, 53, 19, 1); 36.5N Monterey 9.5 (335, 187,
  73, 25, 7); 37.5N San Francisco 11.5 (399, 224, 98, 30, 8); 38.0N Bodega 13.6 (501, 227, 124, 34, 13);
  40.0N 14.4 (516, 255, 121, 44, 12); 42.0N Oregon border 15.4 (500, 332, 137, 41, 8).
- **By stretch of coast** (my grouping; events at neighbouring points that overlap in time are merged
  and take the highest rank; means a water year 1960-2025 for AR1 / AR2 / AR3 / AR4 / AR5): South coast
  32.5-34.5N 3.29 / 1.83 / 0.67 / 0.15 / 0.03 (10 AR4 and 2 AR5 in 66 years); Central coast 35.0-37.0N
  6.48 / 3.38 / 1.86 / 0.53 / 0.15; North coast 37.5-42.0N 10.05 / 6.32 / 3.48 / 1.15 / 0.32; all
  California 10.92 / 6.82 / 4.02 / 1.35 / 0.36.
- **Limits**: ranks are at a coastal grid point, not inland. Counts by stretch are my tabulation, not a
  CW3E publication. CW3E's own end-of-water-year posts ("Distribution of landfalling atmospheric
  rivers over the U.S. West Coast") were **not** collected. Tropical systems off Baja can appear as ARs
  at the southern points (the page warns of this).

### 5c. SIO-R1 catalogue (Gershunov and others 2017, Geophys. Res. Lett., doi:10.1002/2017GL074175)

- **Page** `https://weclima.ucsd.edu/data-products/` -> public Google Drive folder
  `https://drive.google.com/drive/folders/1iiP1cizIBQw3mJhESib7glPqT0iikwnc`; file fetched with
  `https://drive.usercontent.google.com/download?id=1kzWninHGrlF_V8QtUsbnRPVscdVQkOmQ&export=download&confirm=t`
  (`ARcatalog_NCEP_NEW_1948-2018_Comprehensive_FINAL_29JAN18.txt`, 2.1 MB) and its readme PDF
  (id `1kUXJ7woz1o7ZRVW2SqkH9Y1cAq15SF4V`).
- **Years**: 1 Jan 1948 to 19 Jan 2018, 6-hourly, NCEP/NCAR Reanalysis 1 on a 2.5 degree grid.
- **Rows**: 35,154 six-hour steps in **4,247 ARs**; 1,720 ARs have a landfall step on the California
  coast (32.5-42.5N), 24.6 a water year for 1949-2017.
- **Fields (13, from the readme)**: AR id, year, month, day, hour, coastal latitude of landfall (AR
  centre), coastal longitude, IVT at the landfall grid point, IVT v, IVT u, IWV, u and v wind at 850 mb.
- **Local files**: `H/atmospheric_rivers/SIO_R1_AR_catalog_1948_2018.csv`,
  `SIO_R1_AR_events_summary.csv` (one row per AR), `SIO_R1_CA_landfalls_by_wateryear.csv`,
  script `tabulate_sio_r1.py`.
- **Limits**: no AR scale rank in this file; landfall latitude only at 32.5, 35, 37.5, 40, 42.5N. The
  folder's yearly netCDF grids (`SIOR1_ARday_PR_LOCALTIME_<year>.nc`, 1948 onward) were **not** downloaded.

---

## 6. Santa Ana, Diablo and sundowner winds

### 6a. Santa Ana Winds Regional Index (Scripps)

- **Source**: `https://weclima.ucsd.edu/data-products/` -> Google Drive folder
  `https://drive.google.com/drive/folders/1LlJsqPEdVQNYfwtEZUHc0387iL008eLl` (4 files, all fetched;
  manifest `H/santa_ana_diablo/raw/sawri/gdrive_manifest.json`).
  - `R1DSAWRI_010148_123118_red.txt`: **daily index 1 Jan 1948 to 31 Dec 2018, 25,933 days** (Guzman-
    Morales and Gershunov 2019, doi:10.1029/2018GL080261). Value 0 = no Santa Ana conditions.
  - `CaRD10SAWRI_010148_123112.txt`: hourly index 1948-2012, 569,800 hours (Guzman-Morales, Gershunov,
    Theiss, Li, Cayan 2016, Geophys. Res. Lett. 43, 2827-2834, doi:10.1002/2016GL067887).
  - `Coastal Temperature Index/CTmax_CTmin.txt` and its description (Gershunov et al. 2021).
- **Tabulated from the daily file (my counts)**: 3,258 days with index above zero, **45.9 Santa Ana days
  a year** (1948-2018; 47.4 for 1981-2010; 46.4 for 1996-2018). Mean days by month: Jan 11.9, Feb 6.7,
  Mar 2.8, Apr 0.6, May 0.1, Jun 0.1, Jul 0, Aug 0, Sep 0.4, Oct 3.5, Nov 7.8, Dec 12.2. Strongest days
  by index: 12 Jan 1963, 3 Jan 1972, 16 Jan 2008, 14 Dec 1996, 10 Jan 1962, 7 Jan 1982, 21 Nov 1957,
  11 Dec 1997, 21 Oct 2007.
- **Local files**: `H/santa_ana_diablo/SAWRI_daily_R1D_1948_2018.csv`,
  `SAWRI_daily_days_by_year_month.csv`, `SAWRI_hourly_CaRD10_events_1948_2012.csv`,
  `SAWRI_hourly_CaRD10_by_year.csv`, script `tabulate_sawri.py`.
- **Limits**: the record stops in 2018; **no public update for 2019-2025 was found**. The index is one
  number for the whole Southern California domain, not by place. The hourly file is non-zero in 29.5% of
  hours, so it needs the paper's event threshold, which I could not read (Wiley returned 403); my
  hourly "event" tables use any value above zero and are **not** the paper's event count. The
  published day-count climatology of Guzman-Morales et al. 2016 was not retrieved in full text; only
  the abstract (saved, `raw/crossref_10.1002_2016GL067887.json`).

### 6b. Santa Ana Wildfire Threat Index (SAWTI)

- Rolinski, Capps, Fovell, Cao, D'Agostino, Vanderburg (2016), Weather and Forecasting 31, 1881-1897,
  doi:10.1175/WAF-D-15-0141.1. Author copy downloaded from
  `https://escholarship.org/content/qt4s84k92w/qt4s84k92w.pdf` ->
  `H/santa_ana_diablo/raw/papers/rolinski2016_sawti_escholarship.pdf` and `.txt`.
- From the paper: large fire potential **LFP = 0.001 x Ws^2 x Dd x FMC** (Ws 10 m sustained wind in mph,
  Dd dew point depression in F, FMC fuel moisture component); four zones from Point Conception to the
  Mexican border; ratings No rating, Marginal, Moderate, High, Extreme, with breakpoints "at the 50th,
  75th, 90th, and 97th percentiles"; climatology from a 3 km model run of January 1984 to December 2013.
- **Live service**: `https://fsapps.nwcg.gov/psp/sawti` (the old `sawti.fs.usda.gov` did not connect).
  JSON `https://fsapps.nwcg.gov/psp/sawti/api/forecast` (zone, date, forecastValue, DL, LFM, G) and
  `/api/wrf` answer; both are a 6-day forecast only. On 18 Nov 2026 the page said forecasts were
  unavailable for technical reasons and the forecast text read "Test."
- **Not found**: any downloadable history of daily SAWTI ratings, or published counts of days a year by
  rating.

### 6c. Diablo and sundowner winds: what was and was not obtained

- Abstracts only (saved as Crossref JSON in `H/santa_ana_diablo/raw/`): Smith, Hatchett and Kaplan
  (2018), "A Surface Observation Based Climatology of Diablo-Like Winds in California's Wine Country and
  Western Sierra Nevada", Fire 1(2), 25, doi:10.3390/fire1020025 (18 years of station data; Diablo winds
  "tend to occur overnight through early morning in fall, winter and spring"); McClung and Mass (2020),
  Weather and Forecasting 35, 2163-2178, doi:10.1175/WAF-D-19-0221.1 (Bay Area frequency "minimum
  during midsummer, a maximum in October"; Sierra maximum October to January; "little trend in event
  frequency during the past two decades").
- **Not obtained**: full text or tables of either paper (MDPI, AMS, Wiley, Springer, preprints.org and
  the NOAA repository all returned 403 or 405 here), so **no published days-a-year figure for Diablo or
  sundowner winds is recorded**. No sundowner climatology paper was retrieved. Gershunov et al. 2021
  full text was retrieved from Europe PMC (`raw/papers/gershunov2021_PMC8165508_fulltext.xml`).

### 6d. Offshore wind events in the public event records (dated, placed, with measured gusts)

- Script `H/santa_ana_diablo/offshore_wind_events.py` tags Storm Events High Wind and Strong Wind rows
  whose narratives name the wind. 1996-2025: 7,077 High Wind and 2,365 Strong Wind rows; narratives
  naming **Santa Ana 1,033 rows in 235 episodes; Diablo 93 rows in 31 episodes; sundowner 22 rows in 13
  episodes; Mono wind 26 rows in 8 episodes**; "north wind" 488 rows; "offshore" 590 rows. Of all 9,569
  rows (1950-2026), 6,425 carry a measured gust (MG, knots).
  Files: `stormevents_highwind_rows_tagged.csv`, `stormevents_wind_rows_by_year_and_wind_type.csv`.
  A narrative that does not name the wind is not tagged, so these are lower bounds.
- **Strongest measured gusts in rows naming the wind (Storm Events)**: Santa Ana: 105 mph Johnson Valley
  6 Mar 2012; 103-104 mph Marshall Peak 7 Jan 2025; 102 mph Magic Mountain Truck Trail 15 Nov 2022; 102
  mph Sill Hill 9 Jan 2025; 100 mph Mount Lukens Truck Trail 7 Jan 2025; 99 mph Magic Mountain Truck
  Trail 19 Jan 2021. Diablo: 75 mph Mount Diablo 8 Oct 2017; 72 mph Mount Diablo 28 Nov 2009. Sundowner:
  70 mph Montecito 9 May 2022; 68 mph Montecito Hills 9 Apr 2021; 67 mph Gaviota 7 Sep 2019. Mono wind:
  107 mph southern Sierra 21 Nov 2004; 106 mph 5 Jan 2003.
- **Local Storm Reports, non-thunderstorm gusts** (`lsr_nonthunderstorm_gusts_ge75mph.csv`): 22,386
  reports with a speed, 21,596 measured; 12,597 at 58 mph or more, 2,234 at 75 mph or more, 326 at 100
  mph or more. Highest by office: Los Angeles 130 mph Magic Mountain Truck Trail 20 Nov 2023 and 108 mph
  near Castaic Lake 21 Oct 2007; San Diego 115 mph Lucerne Valley 20 Mar 2011 and 110 mph Burns Canyon
  21 Dec 2017; Bay Area 108 mph Pablo Point 24 Dec 2025; Sacramento 119 mph near Alpine Meadows 26 Oct
  2020; Eureka 101 mph Ship Mountain 3 Dec 2007; Hanford 120 mph Upper Bull 5 Feb 2024; Reno office
  (Sierra crest) 199 mph Alpine Meadows summit 21 Feb 2017 and 179 mph Mammoth Mountain 31 Dec 2014.
  These are ridge-top and canyon sensors, not rooftops in towns.

---

## 7. Wildfire: CAL FIRE damage inspections, perimeters, hazard zones

All three are hosted feature services of CAL FIRE at
`https://services1.arcgis.com/jUJYIo9tSA7EHvfZ/arcgis/rest/services/` (the catalogue of 418 services is
saved as `H/calfire/raw/agol_services.json`; layer and item metadata as `H/calfire/raw/layer_*.json`,
`item_*.json`). Download method for every layer (script `H/calfire/arcgis_dump.py`): ask for all object
ids (`/query?where=1=1&returnIdsOnly=true&f=json`), then POST batches to
`/query` with `objectIds=<list>&outFields=*&outSR=4326&f=geojson&geometryPrecision=6`. Output per layer:
`<name>.ndjson.gz` (one GeoJSON feature per line, WGS84), `<name>_attributes.csv`, `<name>_meta.json`
(fields, coded values, edit dates, download time). The file download on `www.fire.ca.gov` (FRAP
geodatabase) answered **403** from here and `www.osfm.fire.ca.gov` did not connect, so everything below
came from the services. The services also advertise export as csv, shapefile, geopackage, filegdb.

### 7a. Damage Inspection (DINS): structures damaged or destroyed

- **Layer**: `.../POSTFIRE_MASTER_DATA_SHARE/FeatureServer/0` (item 994d3dc4569640caadbbc3198d5a3da1,
  "CAL FIRE Damage Inspection (DINS) Data", owner dins.CALFIRE; data last edited 6 Jan 2026).
- **Rows: 132,522 points, all downloaded**, every one with coordinates. Incident start years 2013-2025;
  436 incident names. Largest: Camp 2018 23,624; Eaton 2025 18,428; Palisades 2025 12,137; Tubbs 2017
  6,023; LNU Lightning Complex 2020 5,121; CZU 2020 4,820; Glass 2020 4,767; Caldor 2021 4,444; Dixie
  2021 3,841.
- **Fields (45)**: OBJECTID, GLOBALID, **DAMAGE**, **STRUCTURETYPE**, STREETNUMBER, STREETNAME,
  STREETTYPE, STREETSUFFIX, CITY, STATE, ZIPCODE, CALFIREUNIT, COUNTY, COMMUNITY, BATTALION,
  **INCIDENTNAME**, INCIDENTNUM, **INCIDENTSTARTDATE**, HAZARDTYPE, WHEREFIRESTARTEDONSTRUCTURE,
  WHATDIDFIRESTARTFROM, DEFENSIVEACTIONS, STRUCTURECATEGORY, NUMBEROFUNITPERSTRUCTURE,
  NOOUTBUILDINGSDAMAGED, NOOUTBUILDINGSNOTDAMAGED, NOOFCARSONPROPERTY, **ROOFCONSTRUCTION**, **EAVES**,
  **VENTSCREEN**, EXTERIORSIDING, WINDOWPANE, DECKPORCHONGRADE, DECKPORCHELEVATED, PATIOCOVERCARPORT,
  FENCEATTACHEDTOSTRUCTURE, PROPANETANKDISTANCE, UTILITYMISCSTRUCTUREDISTANCE, FIRENAME, APN,
  ASSESSEDIMPROVEDVALUE, **YEARBUILT** (89,943 rows filled), SITEADDRESS, **LATITUDE**, **LONGITUDE**.
- **Publisher's notes** (item description, saved): digital records start in 2013; "Beginning in 2018
  the DINS Program collected all non-damaged structures, prior to 2018 only damaged/destroyed structures
  were collected"; covers structures "inside or within 300 feet of the fire perimeter"; fires in local or
  federal responsibility areas "may or may not be included".
- **Local files**: `H/calfire/dins/DINS_POSTFIRE_MASTER.ndjson.gz` (12.9 MB),
  `DINS_POSTFIRE_MASTER_attributes.csv` (61.8 MB), `_meta.json`; tables from `tabulate_dins.py`:
  `dins_damage_by_year.csv`, `dins_roof_by_damage_all_years.csv`, `dins_roof_by_damage_2018on.csv`,
  `dins_roof_by_damage_2018on_residences.csv`, `dins_roof_by_year_damage.csv`,
  `dins_roof_by_structurecategory_damage.csv`, `dins_roof_by_eaves_2018on_residences.csv`,
  `dins_roof_by_yearbuilt_era_2018on_residences.csv`, `dins_yearbuilt_era_by_damage_2018on_residences.csv`,
  `dins_eaves_...`, `dins_ventscreen_...`, `dins_exteriorsiding_...`, `dins_windowpane_...`,
  `dins_deckporchelevated_...`, `dins_patiocovercarport_...`, `dins_fenceattachedtostructure_...`,
  `dins_structuretype_by_damage.csv`, `dins_county_by_year_damage.csv`, `dins_by_incident.csv`.

**Damage level, all rows**: Destroyed (>50%) 70,390; Major (25-50%) 714; Minor (10-25%) 1,356; Affected
(>0-10%) 5,057; No Damage 54,414; Inaccessible 591.

| Incident year | Destroyed | Major | Minor | Affected | No damage | Inaccessible | Total |
|---|---|---|---|---|---|---|---|
| 2013 | 259 | 11 | 3 | 0 | 6 | 0 | 279 |
| 2014 | 296 | 7 | 7 | 0 | 0 | 0 | 310 |
| 2015 | 3,081 | 18 | 35 | 59 | 0 | 0 | 3,193 |
| 2016 | 881 | 13 | 21 | 29 | 0 | 0 | 944 |
| 2017 | 10,922 | 137 | 309 | 697 | 692 | 0 | 12,757 |
| 2018 | 22,701 | 139 | 236 | 1,148 | 4,179 | 0 | 28,403 |
| 2019 | 555 | 26 | 51 | 170 | 1,286 | 20 | 2,108 |
| 2020 | 9,494 | 107 | 194 | 826 | 17,801 | 204 | 28,626 |
| 2021 | 3,243 | 33 | 54 | 205 | 8,586 | 132 | 12,253 |
| 2022 | 772 | 13 | 21 | 70 | 2,133 | 1 | 3,010 |
| 2023 | 53 | 2 | 2 | 18 | 152 | 2 | 229 |
| 2024 | 1,621 | 58 | 85 | 216 | 6,060 | 77 | 8,117 |
| 2025 | 16,512 | 150 | 338 | 1,619 | 13,519 | 155 | 32,293 |

**Roof construction, all years, all structure types**

| Roof | Destroyed | Major | Minor | Affected | No damage | Inaccessible | Total | Destroyed share |
|---|---|---|---|---|---|---|---|---|
| Asphalt | 34,867 | 206 | 503 | 2,465 | 20,903 | 48 | 58,992 | 59.1% |
| Metal | 10,508 | 174 | 229 | 689 | 9,687 | 16 | 21,303 | 49.3% |
| Unknown | 6,576 | 33 | 43 | 131 | 11,262 | 490 | 18,535 | 35.5% |
| Fire Resistant | 11,113 | 132 | 324 | 681 | 476 | 0 | 12,726 | 87.3% |
| Tile | 3,588 | 85 | 149 | 784 | 6,214 | 32 | 10,852 | 33.1% |
| (blank) | 574 | 20 | 10 | 34 | 4,092 | 0 | 4,730 | 12.1% |
| Other | 676 | 23 | 23 | 69 | 696 | 1 | 1,488 | 45.4% |
| Combustible | 1,309 | 19 | 26 | 53 | 61 | 0 | 1,468 | 89.2% |
| Wood | 811 | 8 | 18 | 45 | 440 | 2 | 1,324 | 61.3% |
| Concrete | 367 | 14 | 31 | 106 | 576 | 1 | 1,095 | 33.5% |
| Concrete Slab 7, No Deck/Porch 1, Non Combustible 1 | | | | | | | 9 | |

**Roof construction, residences only, incidents of 2018 and later (the comparable set: undamaged homes are recorded)**

| Roof | Destroyed | Major | Minor | Affected | No damage | Inaccessible | Total | Destroyed share |
|---|---|---|---|---|---|---|---|---|
| Asphalt | 25,185 | 139 | 381 | 1,929 | 14,644 | 41 | 42,319 | 59.5% |
| Metal | 5,944 | 25 | 64 | 273 | 4,818 | 12 | 11,136 | 53.4% |
| Unknown | 2,612 | 4 | 15 | 57 | 7,364 | 224 | 10,276 | 25.4% |
| Tile | 2,995 | 68 | 134 | 678 | 5,421 | 30 | 9,326 | 32.1% |
| (blank) | 0 | 0 | 0 | 27 | 3,061 | 0 | 3,088 | 0% |
| Other | 525 | 10 | 11 | 36 | 396 | 0 | 978 | 53.7% |
| Concrete | 287 | 6 | 18 | 67 | 339 | 1 | 718 | 40.0% |
| Wood | 324 | 1 | 4 | 21 | 202 | 2 | 554 | 58.5% |

- **Limits that change how the roof numbers may be read**
  1. The roof categories changed. 2014-2017 records use only "Fire Resistant", "Combustible" and
     "Unknown" (Fire Resistant 12,726 rows, all 2014-2017; Combustible 1,467 of 1,468). Material names
     (Asphalt, Metal, Tile, Wood, Concrete, Other) appear from 2018.
  2. Before 2018 only damaged or destroyed structures were recorded, so the 87% and 89% "destroyed
     shares" of the two old categories are a recording effect, not a performance figure.
  3. A destroyed share is a raw cross-tabulation. It is not adjusted for fire intensity, spacing,
     vegetation, defence actions or building age, and "Unknown" is 14% of rows. Three fires (Camp, Eaton,
     Palisades) supply 41% of all rows.
  4. A few values are in the wrong column (ROOFCONSTRUCTION "No Deck/Porch"; VENTSCREEN ">30").
  5. Roof covering type only; no roof age, slope or condition.

### 7b. Historic fire perimeters (FRAP)

- **Service**: `.../California_Historic_Fire_Perimeters/FeatureServer` (item
  c3c10388e3b24cec8a954ba10458039d, owner egis.CALFIRE; data last edited 21 May 2026). Layers: 0
  "California Fire Perimeters (all)" 23,334; 1 "Recent Large Fire Perimeters (GT 5000 acres)"; 2
  "California Fire Perimeters (1950+)" 18,064.
- **Downloaded: the whole of layer 0, 23,334 polygons at full detail** (years 1878-2025; 77 without a
  year; 17 outside California). Subset also saved: 1,557 fires of 1,000 acres or more since 1990.
- **Fields**: OBJECTID, YEAR_, STATE, AGENCY, UNIT_ID, FIRE_NAME, INC_NUM, IRWINID, ALARM_DATE,
  CONT_DATE, CAUSE (19 codes: 1 Lightning, 2 Equipment Use, 7 Arson, 11 Electrical Power, 14 Unknown ...),
  C_METHOD, OBJECTIVE, GIS_ACRES, COMMENTS, COMPLEX_NAME, COMPLEX_ID, FIRE_NUM, GlobalID, DECADES.
  Code lists saved in `CA_fire_perimeters_coded_domains.json`.
- **Counts**: 10,884 perimeters since 1990; 9,834 in 1996-2025 covering 24.16 million GIS acres
  (overlaps counted twice). By year (perimeters / acres / of 1,000 acres or more): 2017 611 / 1.43 M /
  75; 2018 416 / 1.58 M / 52; 2020 504 / 4.18 M / 75; 2021 388 / 2.51 M / 34; 2024 553 / 1.01 M / 55;
  2025 521 / 0.51 M / 35. Full table `CA_fire_perimeters_by_year.csv`.
- **Local files** in `H/calfire/perimeters/`: `CA_fire_perimeters_all_fullres.ndjson.gz` (50 MB),
  `CA_fire_perimeters_all_fullres_attributes.csv`, `CA_fire_perimeters_ge1000ac_1990on_fullres.ndjson.gz`
  (21 MB), `..._attributes.csv`, `CA_fire_perimeters_all_attrs_attributes.csv`, script
  `tabulate_perimeters.py`.
- **Limits (publisher)**: "it is still incomplete"; some fires missing, duplicates, over-generalised old
  perimeters that show unburned islands as burned. The set is released each spring with the previous
  calendar year, so 2026 fires are not in it. Minimum sizes for inclusion differ by agency and era.

### 7c. Fire Hazard Severity Zones (newest)

| Map | Service layer URL (under the root above) | Polygons | Classes | Fields | Local file in `H/calfire/fhsz/` |
|---|---|---|---|---|---|
| State Responsibility Area, adopted 31 Jan 2024, effective 1 Apr 2024 | `FHSZSRA_23_3/FeatureServer/0` (item 6000aebca6f24b3892ecb01b598f7545) | 18,423 | Moderate 4,188; High 5,824; Very High 8,411 | OBJECTID, SRA, FHSZ (code), FHSZ_Description, Shape__Area, Shape__Length | `FHSZ_SRA_23_3_effective_2024-04-01.ndjson.gz` |
| State Responsibility Area revised for the July 2025 SRA map (in the regulatory process, not final) | `FHSZSRA25_3/FeatureServer/0` (item b481389204564ed5bc5aa6b56e622387) | 18,553 | Moderate 4,195; High 5,904; Very High 8,454 | OBJECTID, xxFHSZSRA25_3_FHSZ, xxFHSZSRA25_3_FHSZ_Description, xxFHSZSRA25_3_SRA | `FHSZ_SRA25_3_revised_2025_SRA.ndjson.gz` |
| Local Responsibility Area, map dated 24 Mar 2025, all rollout phases | `FHSALRA25_v1_All/FeatureServer/0` (item 018035e18cdc4778afcbe06185c01426; layer name FHSZLRA25_v1_All) | 9,752 | NonWildland 1,954; Moderate 4,741; High 2,049; Very High 1,008 | OBJECTID, SRA (= LRA), FHSZ, FHSZ_Description | `FHSZ_LRA25_v1_All.ndjson.gz` |

- All three were downloaded in full with geometry. Other related services seen and **not** downloaded:
  `fhsz24_1` (21,169 polygons, field FHSZ_6Class), `fhsz24_5` "FHSZ FOR REAL ESTATE INSPECTIONS"
  (21,157, FHSZ_7Class), `SRA25_2` and `SRA22_2` (responsibility areas),
  `NWS_Red_Flag_Warning_CAL_FIRE_Public`, per-fire DINS views (for example `DINS_2025_Eaton_Public_View`,
  `DINS_2025_Palisades_Public_View`).
- **Limits**: the LRA map is the State Fire Marshal's recommendation; each city or county adopts it by
  ordinance and may add area, so the legally effective local map can differ. Federal responsibility
  land is in neither. `Shape__Area` is in the service's own projection (web mercator for
  `FHSZSRA_23_3`, California Albers for the other two); recompute areas from the geometry.

---

## 10. National Weather Service offices and api.weather.gov endpoints

Ten offices issue for California. Counties are those with at least one public zone of the office in the
16 April 2026 zone-county file (a county can be split between offices). Table on disk:
`H/nws_api/CA_nws_offices.csv`; zone lists `H/nws_api/CA_zones_from_api.csv`; raw JSON in
`H/nws_api/raw/`; script `H/nws_api/download_nws_api.py`; request log `request_log.json` (30 requests,
none failed, 18-19 Nov 2026).

| Office | Name (location) | California public zones | California counties |
|---|---|---|---|
| EKA | Eureka | 18 | Del Norte, Humboldt, Lake, Mendocino, Trinity |
| MFR | Medford, Oregon | 6 | Modoc, Siskiyou |
| STO | Sacramento | 44 | Alpine, Amador, Butte, Calaveras, Colusa, El Dorado, Glenn, Lassen, Nevada, Placer, Plumas, Sacramento, San Joaquin, Shasta, Sierra, Solano, Stanislaus, Sutter, Tehama, Tuolumne, Yolo, Yuba |
| MTR | San Francisco Bay Area (Monterey) | 19 | Alameda, Contra Costa, Marin, Monterey, Napa, San Benito, San Francisco, San Mateo, Santa Clara, Santa Cruz, Sonoma |
| REV | Reno, Nevada | 4 | Alpine, El Dorado, Lassen, Modoc, Mono, Nevada, Placer, Plumas, Sierra (their eastern parts) |
| HNX | San Joaquin Valley (Hanford) | 40 | Fresno, Kern, Kings, Madera, Mariposa, Merced, Tulare, Tuolumne |
| LOX | Los Angeles (Oxnard) | 44 | Los Angeles, San Luis Obispo, Santa Barbara, Ventura |
| SGX | San Diego | 13 | Orange, Riverside, San Bernardino, San Diego |
| VEF | Las Vegas, Nevada | 10 | Inyo, San Bernardino |
| PSR | Phoenix (Tempe), Arizona | 11 | Imperial, Riverside, San Bernardino |

Endpoints tested (all answered 200; a `User-Agent` header is required, no key):

| Purpose | URL | Returned |
|---|---|---|
| Office record | `https://api.weather.gov/offices/{EKA,MFR,STO,MTR,REV,HNX,LOX,SGX,VEF,PSR}` | name, address, responsibleCounties, responsibleForecastZones, responsibleFireZones, approvedObservationStations |
| Public zones | `https://api.weather.gov/zones?area=CA&type=public&include_geometry=false` | 209 zones: id, name, effectiveDate, state, cwa, forecastOffices, gridIdentifier, timeZone, observationStations, radarStation |
| County zones | `https://api.weather.gov/zones?area=CA&type=county&include_geometry=false` | 58 |
| Fire weather zones | `https://api.weather.gov/zones?area=CA&type=fire&include_geometry=false` | 170 |
| One zone with outline | `https://api.weather.gov/zones/forecast/CAZ362` | "Malibu Coast", Polygon |
| Active alerts | `https://api.weather.gov/alerts/active?area=CA` | 59 at the time (15 Wind Advisory, 11 Flood Advisory, 11 Winter Storm Warning, 6 High Surf Advisory ...); fields id, areaDesc, geocode (UGC, SAME), affectedZones, sent, effective, onset, expires, ends, status, messageType, category, severity, certainty, urgency, event, senderName, headline, description, instruction, response, parameters |
| Alert event names | `https://api.weather.gov/alerts/types` | 111 event types |
| Forecast discussions, list | `https://api.weather.gov/products/types/AFD/locations/{office}` | LOX: 56 recent products (id, issuingOffice, issuanceTime) |
| One discussion | `https://api.weather.gov/products/{id}` | productText (LOX, issued 2026-11-19T00:27Z, 9,860 characters) |
| Point to grid | `https://api.weather.gov/points/34.0522,-118.2437` | cwa LOX, grid 155,45, forecastZone CAZ368, county CAC037, fireWeatherZone CAZ368 |
| Grid forecast | `https://api.weather.gov/gridpoints/LOX/155,45/forecast` | 14 periods |

- `type=coastal` returned 0 zones for `area=CA`.
- **Limits**: the alerts endpoint holds active and recent alerts only; it is not a 30-year archive. Past
  warnings by zone are in Storm Events (section 1) or the IEM archives. Historical alert archives were
  not downloaded.

---

## 8. Snow: depth, water content and design ground snow load

Four sources, all tested.

### 8a. GHCN-Daily snow depth, snowfall and snow-water equivalent (already on disk, section 4a)

- `H/ghcnd/CA_ghcnd_days_by_station_year.csv` holds, per station and year, the greatest snow depth
  (SNWD), snowfall total (SNOW) and greatest snow-water equivalent (WESD, the 33 SNOTEL sites).
  `CA_ghcnd_station_summary.csv` gives the 1996-2025 mean and record of the yearly maxima.
- **114 stations** have 10 or more snow-depth years with a record depth of 12 in or more; **44** have 10
  or more years of snow-water equivalent.
- Towns (cooperative stations; mean yearly greatest depth / record depth 1996-2025, years): Tahoe City
  48.3 in / 81 in (30); Truckee Ranger Station 52.5 / 73 (13); Donner Memorial State Park 45.1 / 88
  (20); Mammoth Lakes Ranger Station 41.2 / 75 (25); Lodgepole 73.2 / 164 (27); Grant Grove 52.3 / 112
  (29); Mount Shasta 23.4 / 40 (23); Lee Vining 23.3 / 64 (30); Big Bear Lake 17.3 / 48 (30); Idyllwild
  10.0 / 21 (28); Lake Arrowhead 7.6 / 24 (13); Cuyamaca 4.4 / 26 (24); Julian 3.0 / 12 (21).
- SNOTEL records (mean yearly peak water equivalent / record, 1996-2025): Leavitt Lake 63.8 in / 122.1
  in; "Squaw Valley G.C." 52.4 / 88.6; Independence Lake 47.6 / 86.5; Echo Peak 45.2 / 89.9; "Css
  Lab" 40.0 / 77.5; Truckee #2 19.6 / 38.7.
- 1991-2020 normals include monthly snowfall (MLY-SNOW-NORMAL) for 278 stations: Lodgepole 220.4 in a
  year, Truckee Ranger Station 206.6, Grant Grove 186.0, Donner Memorial 182.9, Tahoe City 179.0, Mount
  Shasta 89.3, Big Bear Lake 58.6, Idyllwild 30.7, Lake Arrowhead 22.4.
- **Limit**: South Lake Tahoe airport, Blue Canyon, Huntington Lake and Sandberg have no usable snow
  depth series in 1996-2025.

### 8b. CDEC snow sensors (California Department of Water Resources)

- **Station search that worked**:
  `https://cdec.water.ca.gov/dynamicapp/staSearch?sta=&sensor_chk=on&sensor=<3|18>&collect=NONE+SPECIFIED&dur_chk=on&dur=D&active=&lon1=&lon2=&lat1=&lat2=&elev1=-5&elev2=99000&nearby=&basin=NONE+SPECIFIED&hydro=NONE+SPECIFIED&county=NONE+SPECIFIED&agency_num=160&display=sta`
  (sensor 3 = snow water content, 18 = snow depth) -> **145 stations** -> `H/snow/CDEC_snow_stations.csv`
  (id, name, river basin, county, lat, lon, elevation ft, operator, which sensors).
- **Data URL that worked** (4 stations a request):
  `https://cdec.water.ca.gov/dynamicapp/req/CSVDataServlet?Stations=<ID,ID,ID,ID>&SensorNums=3,18&dur_code=D&Start=1980-01-01&End=2026-11-17`
  Fields: STATION_ID, DURATION, SENSOR_NUMBER, SENSOR_TYPE, DATE TIME, OBS DATE, VALUE, DATA_FLAG, UNITS
  (inches). 37 files, 156 MB, in `H/snow/raw/cdec_daily/`; 1.92 million daily values.
- **Tables**: `H/snow/CDEC_snow_annual_peaks_by_station_wateryear.csv` (6,553 station-water-years: peak,
  date, raw maximum, 1 April value) and `CDEC_snow_station_summary.csv` (141 stations with water
  content, 115 with depth). Scripts `download_cdec_snow.py`, `tabulate_cdec_snow.py`.
- **Counties with sensors**: El Dorado 14, Tulare 14, Alpine 14, Fresno 12, Tuolumne 11, Mono 10,
  Trinity 7, Plumas 7, Placer 7, Madera 6, Inyo 5, Mariposa 5, Sierra 5, Modoc 4, Nevada 4, Shasta 4,
  Siskiyou 4, Lassen 2, Glenn 2, Calaveras 1, Mendocino 1, Amador 1 (3 are in Nevada state).
  **None in the San Bernardino, San Gabriel or San Jacinto mountains.**
- **Limit**: the feed is unedited telemetry. It contains readings of 250-400 in of water, which are not
  physical. My screen: drop negatives, water content above 150 in and depth above 400 in, and take the
  yearly peak as the largest 7-day running median. After it, well-kept sites match SNOTEL (Leavitt Lake
  peak 125.4 in against 122.1 in in GHCN), but some station maxima near the cap remain doubtful
  (Blackcap Basin 149.7 in, Middle Boulder 3 143.8 in). Weight on the ground in lb/ft2 = inches of
  water x 5.2 (a unit conversion: 62.4 lb/ft3 divided by 12).

### 8c. ASCE 7-22 ground snow load and basic wind speed (the data behind the ASCE Hazard Tool)

- **Service root that worked**: `https://gis.asce.org/arcgis/rest/services/ASCE722/` (folder listings
  saved in `H/snow/raw/asce_folder_*.json`). Image services, sampled with
  `.../<service>/ImageServer/getSamples` (POST, multipoint in WGS84, `returnFirstValueOnly=true`,
  `f=json`) or `.../identify` for one point:
  - `s2022_RiskCategory2` ground snow load, Risk Category II (cell 0.00833 degree, about 1 km; range 3
    to 1,016); `s2022_RiskCategory1`, `3`, `4` exist for the other categories (not sampled);
  - `s2022_20yrMRI` 20-year ground snow load; `s2022_Elevation` the elevation the snow model used (m);
  - `w2022_mri700` basic wind speed, 700-year (Risk Category II); `w2022_SWR_CA` California special
    wind region (answers only inside the region).
  - ASCE 7-16 equivalents are under `.../services/ASCE/` (`SnowLoad`, `wind2016_700`).
- **Downloaded**: values at all 768 normals stations -> `H/asce7/ASCE722_at_normals_stations.csv`; and a
  0.05 degree grid over 32.5-42.05N, 124.5-114.05W (40,320 points, the four statewide services; 30,224 return a snow value and 29,931 a wind
  value, the rest are ocean or outside the rasters; the box also covers parts of Nevada, Arizona and
  Mexico) -> `H/asce7/ASCE722_grid_0p05deg.csv`. Script `H/asce7/sample_asce722.py` (resumable).
- **Values returned at station coordinates (Risk Category II ground snow load / 20-year / model
  elevation)**: Tahoe City 383 / 174 / 1,947 m; Truckee Ranger Station 314 / 131 / 1,818 m; Donner
  Memorial 429 / 191 / 1,905 m; South Lake Tahoe airport 256 / 98 / 1,945 m; Mammoth Lakes Ranger
  Station 437 / 172 / 2,430 m; Lodgepole 741 / 351 / 2,329 m; Blue Canyon 428 / 176 / 1,504 m; Mount
  Shasta 166 / 68 / 1,159 m; Big Bear Lake 392 / 94 / 2,173 m; Lake Arrowhead 245 / 61 / 1,621 m;
  Idyllwild 263 / 67 / 1,925 m; Julian 71 / 19; Sandberg 41 / 14; Ontario 5.9; Sacramento 6.1; Los
  Angeles airport 3.1. Of the 768 stations, 209 return 30 or more and 112 return 100 or more.
- 700-year wind speed at the 768 stations ranges only from 91.3 to 99.1; 13 stations (Kern County and
  the Indian Wells Valley) get an answer from the special wind region service, several of them sentinels.
- **Limits**: the service metadata does not state units; separate `_SI` services exist, so these are
  read as lb/ft2 and mph, which was **not confirmed** against the printed standard. The cell is about
  1 km and uses its own elevation (Big Bear Lake station 2,058 m, cell 2,173 m; Idyllwild 1,640 m
  against 1,925 m), so a value at a town can be off where terrain is steep. Risk Category II values
  are far above the 20-year values (Big Bear 392 against 94) because the 2022 standard's design loads
  are set by a reliability target rather than a 50-year return period; that reading of the standard is
  mine and was not checked against its text. The special-wind-region service returned sentinel values
  (0 and 339999) at some points and must be cleaned before use.

### 8d. County and town design snow loads (Tahoe, Mammoth, Big Bear)

- **Found and saved** (`H/snow/raw/local_design/`):
  - Town of Mammoth Lakes Building Division, "Residential Rooftop Solar PV Heavy Snow Exception", 13
    July 2021 (`https://www.townofmammothlakes.ca.gov/DocumentCenter/View/11856`): the regional Building
    Working Group (Town of Truckee, Town of Mammoth Lakes, Nevada, Sierra, Mono and Placer counties)
    "determined that a ground snow load of 230 psf would be the limit of when rooftop solar panels can
    be installed without the risk of damage or structural failure".
  - A 21 October 2024 public comment to the California Building Standards Commission on local authority
    to set ground snow loads by case study
    (`https://www.dgs.ca.gov/-/media/Divisions/BSC/03-Rulemaking/2024-Triennial-Cycle/Public-Comments/BFO-SDLF-HF-45-Day/Multi-BSC-HCD-PT2-RMCarney-JJGlicker_Reicker-Pfau-Pyle-McRoy-LLP_Snow-Loads.pdf`).
- **Not obtained**: the official elevation tables themselves. Mono County's design-criteria PDFs returned
  404 or 525; a search summary (not a document I read) reports Mono County figures of Bridgeport 6,470
  ft 65 psf ground / 50 psf roof and June Lake 7,600 ft 155 / 119, which are **unverified**. No official
  Placer County, Town of Truckee, El Dorado County, City of South Lake Tahoe, City of Big Bear Lake or
  San Bernardino County snow load table was retrieved.

---

## What could not be obtained (plainly)

| Wanted | Result |
|---|---|
| Storm Events zone outlines for 396 rows of 1996-2005 in zones retired before 2007 | Not found; zone names only |
| Daily airport peak gust free of sensor errors | Not available from either source; screened tables supplied, 75 mph counts remain doubtful |
| IEM daily gust before about 2002 on calm days | Blank in the source (no gust reported) |
| Local Storm Reports before 2004 | Archive returns none |
| CoCoRaHS rain gauges (1,553 in California) | Not downloaded (script flag exists) |
| Normals days at 3 inches of rain or 110 F | Not in the normals product; taken from daily data instead |
| CW3E's published yearly AR counts by scale and coast region (end-of-water-year posts) | Not collected; counts here are my tabulation of CW3E's event catalogue |
| Full text of Ralph et al. 2019 | Publisher returned 403/405; scale taken from the abstract and confirmed against 12,461 catalogue rows |
| Hourly IVT files at each coast point; SIO-R1 yearly netCDF grids | Not downloaded |
| Santa Ana wind index after 2018 | No public update found |
| Guzman-Morales et al. 2016 full text and its event threshold and published day counts | 403 from Wiley; abstract only. Day counts given are my tabulation of the authors' daily index |
| Daily history of the Santa Ana Wildfire Threat Index, or days a year by rating | Not found; the service is forecast-only and was out of order on 18 Nov 2026; old host did not connect |
| A Diablo or sundowner catalogue, or published days a year for either | Not found; two abstracts only; event rows tagged in Storm Events instead |
| FRAP geodatabase file download and FHSZ pages on fire.ca.gov / osfm.fire.ca.gov | 403 and no connection; the same data taken from CAL FIRE's feature services |
| Official county or town snow load tables (Placer, Truckee, El Dorado, South Lake Tahoe, Mono, Mammoth Lakes, Big Bear, San Bernardino County) | Not retrieved; one Mammoth Lakes policy memo and one state rulemaking comment saved |
| Units of the ASCE 7-22 rasters | Not stated by the service; read as lb/ft2 and mph, unconfirmed |
| Marine layer and salt air | No source was sought or downloaded for these two |
| Desert monsoon thunderstorms as a separate catalogue | None sought; they are in Storm Events (Thunderstorm Wind, Flash Flood, Dust Storm), SPC wind and hail, and the Local Storm Reports |

## Notes for whoever builds per-ZIP counts

- County-filed Storm Events (flood, flash flood, heavy rain, hail, thunderstorm wind, tornado, debris
  flow) mostly carry BEGIN_LAT/BEGIN_LON and can be counted by distance from a ZIP. Zone-filed events
  (high wind, heavy snow, winter storm, heat, frost, fog, most wildfire) need
  `H/nws_zones/CA_ugc_history_iem_2005_2026.geojson` joined on zone code and event date between
  `first_snapshot` and `last_snapshot` (half-year steps).
- For wind by place, the Local Storm Reports (22,386 non-thunderstorm gust points, 2004-2026) are the
  only point record; they over-represent ridge sensors.
- Two container restarts interrupted this work. Every file was re-tested afterwards with
  `H/_scripts/verify_files.py`; the one truncated file (all fire perimeters) was fetched again in full.
