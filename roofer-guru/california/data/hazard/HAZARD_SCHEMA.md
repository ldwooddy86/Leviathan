# HAZARD_SCHEMA.md: California weather and fire data (what replaces Louisiana's hurricane model)

Second issue, 2026-11-23. Names and shapes in this file are FIXED: module writers can code against them now.
Each output's line in the table says whether the file is on disk yet; section 9 (written last) carries the measured
sizes, counts and check results. Nothing here is a hurricane: no tracks, categories, surge or tropical outlooks.

Folder `CA/data/hazard/`. Build: `bash build_hazard.sh` (Python 3 with `-I`; steps 01 to 09, then 10 for the live
weather read). Outputs in `CA/data/hazard/out/`:

| file | key in the page (suggested) | replaces in Louisiana | section |
|---|---|---|---|
| `zcta_hazard.json` | ZIP columns (group E of data/SCHEMA.md) | `hur64`, `hur50`, `ts34`, `last64`, `yrs64`, `hd1` ..., `wd50` ... | 1 |
| `hazard_events.json` | `hz` | `routes`, `rlist`, `seg`, `sids`, `zstorm` | 2 |
| `hazard_ts.json` | merge into `ts` | `ts.month`, `ts.hour`, `ts.year`, `ts.dowhour`, `ts.trop_month` | 3 |
| `hazard_pts.json` | `pts`, `ptflags`, `ptkinds` | `pts`, `ptflags` | 4 |
| `ca_nws_snapshot.json` | `window.__NWS_SNAPSHOT__` | the same | 5 |
| `roof_hazard_model.json`, `roof_hazard_model.md` | `hz.roof` and the Scout outlook | (new) | 6 |
| `fire_rings.json` | not for the page: lon/lat rings of every ledger fire, by fire id | | 2 |
| `CHECKS.md`, `checks.json` | | | 7 |

Grades as Louisiana uses them: A observed record, B derived from records by a stated rule, C judgement rule on records,
D assumption.

## 0. Conventions used by every file

- **ZIP = 2020 ZCTA.** 1,808 rows: every ZCTA with land in California (the atlas keeps 1,763; the data job drops the
  rest). Column `in_ca` is 0 for the five whose largest part is in Nevada or Oregon.
- **Town point.** Every station lookup, distance and "at the ZIP" value is taken at the ZIP's town point: the GeoNames
  postal point (post office or settlement) when it lies in or within 2 km of the ZCTA (1,760 of 1,808), else the Census
  internal point. Columns `lat`, `lon`, `pt_src`. Reason: the internal point of a mountain or desert ZCTA can sit far
  from, and far above, its homes (Mammoth Lakes: internal point 3,318 m, town 2,400 m).
- **Effective distance** between a ZIP and a station: `d_eff = km + |elevation difference in m| / ez (+ cw x |difference
  in distance to the sea, each capped at 60 km|)`. Rain: `ez` 20 (100 m of height counts as 5 km). Heat: `ez` 10 and
  `cw` 1. Gusts: `ez` 20 and `cw` 0.5.
- **Quality flags** `*_q`: `A` nearest station within 15 km effective distance, `B` within 30, `C` within 60, `D`
  beyond 60 (gusts: 10, 25, 50). A `D` value is a regional guess, and the page should say so.
- **Nulls** are explicit and every column that can be null has its reason in the column table.
- **Periods**: station day counts 1996 to 2025 (or 1991 to 2020 normals); zone filed events 2006 to 2025 (the years
  with dated zone outlines); Local Storm Reports 2010 to 2025; atmospheric rivers water years 1960 to 2025;
  fire perimeters 2000 to 2025; damage inspections 2013 to 2025. 2026 fires are in neither CAL FIRE file.
- **Map paths**: fire outlines are atlas path strings in the data job's projection (`geo` of data/SCHEMA.md section 6:
  `W` 4800, `minx` -124.6, `maxy` 42.1, `kx` cos 37.25 deg, `sx` W / (10.7 kx)), read from `CA/data/work/geo.json` at
  build time. `fire_rings.json` keeps the same outlines in lon/lat, and `hazlib.encode_path(rings, geo)` re-encodes them
  if the constants change. The same function for the page:

```js
function hzPath(rings, G) { /* rings: [[[lon, lat], ...], ...]; G = DATA.geo */
  let s = '';
  for (const r of rings) {
    let px = null, py = null;
    for (const [lon, lat] of r) {
      const x = Math.round((lon - G.minx) * G.kx * G.sx), y = Math.round((G.maxy - lat) * G.sx);
      if (px === null) s += 'M' + x + ' ' + y; else if (x !== px || y !== py) s += 'l' + (x - px) + ' ' + (y - py);
      px = x; py = y;
    }
    s += 'z';
  }
  return s;
}
```

## 1. `zcta_hazard.json`: one row per ZIP

`{compiled, n, cols: [names], rows: [[values in cols order]], notes: {topic: text}}`. First column `zip`. The data job
reads it with `03_hazard_in.py` (it finds the `zip` column and carries every other column whole).

### 1a. Place

| column | unit | meaning, source, formula |
|---|---|---|
| `zip` | | ZCTA code |
| `fips`, `county`, `reg` | | county of the largest land share (Census 2020 relationship file), region key of DESIGN.md |
| `in_ca` | 0/1 | 0 for the five cross border ZCTAs whose largest part is outside California |
| `lat`, `lon`, `pt_src` | degrees | town point; `geonames` or `census` |
| `area_km2` | km2 | ZCTA polygon area (California Albers) |
| `elev_m`, `elev_min_m`, `elev_max_m` | m | mean, lowest and highest ground in the ZCTA: AWS terrarium tiles at zoom 10 (about 120 m cells; `m = R x 256 + G + B / 256 - 32768`), every cell inside the polygon (up to about 60,000 cells, larger ZCTAs are sampled on a coarser stride). Sea floor inside a coastal ZCTA counts as 0. Grade A |
| `elev_pt_m` | m | ground at the town point (same tiles) |
| `coast_km` | km | town point to the nearest salt water shore: the Census 1:500,000 state outline (Pacific shore, San Francisco, San Pablo and Suisun bays, Humboldt, Tomales, Morro and San Diego bays, the Channel Islands) with the land borders removed. Grade A for the distance. The Delta east of Suisun Bay is not counted as salt water |
| `coast_min_km` | km | nearest edge of the ZCTA to that shore (0 for a ZIP on the water) |
| `zone` | | NWS public forecast zone holding the town point, outline valid 2026 (for alerts); nearest zone when the point falls outside every outline |

### 1b. Atmospheric rivers (grade B at the coast, C inland)

Source: CW3E U.S. West Coast AR Landfall Catalog (ERA5), the 20 California coast points 32.5 N to 42.0 N, water years
1960 to 2025 (66 years), ranked on the Ralph et al. 2019 scale. Method: each ZIP takes the values of its latitude,
interpolated linearly between the two bracketing coast points (the points are 0.5 degree apart). Nothing is reduced
inland: the catalogue ranks water vapour transport at the coast, not rain at a town, so `ar_q` says how far the ZIP is
from that coast (`A` 50 km or less, `B` 50 to 150 km, `C` beyond: the Sierra lee and the deserts get far less than the
number suggests). Use the rain columns for what falls at the ZIP.

| column | unit | meaning |
|---|---|---|
| `ar_n` | events a year | landfalls of any rank |
| `ar_d` | days a year | hours with an AR overhead / 24, all ranks |
| `ar1d` `ar2d` `ar3d` `ar4d` `ar5d` | days a year | the same by the event's rank (an event's whole duration counts at its rank) |
| `ar_days` | days a year | AR2 or stronger: `ar2d + ar3d + ar4d + ar5d` |
| `ar3_d` | days a year | AR3 or stronger: `ar3d + ar4d + ar5d` |
| `ar3_n` | events a year | AR3 or stronger |
| `ar45_dec` | events a decade | AR4 and AR5 |
| `ar_max`, `ar_max_date` | rank, date | strongest rank on record at the nearest coast point and the day of its peak (ties: highest water vapour transport). Summer dates at the southern points are tropical moisture (the catalogue's own warning), e.g. 9 September 2022 at San Diego |
| `ar_pt` | 0 to 19 | index of the nearest coast point (`hz.ar_pts`), for reading an event's rank at the ZIP from `hz.ar_big[].pr` |
| `ar_q` | A, B, C | distance class above |

### 1c. Rain (grade A at a station, B between stations)

Sources: NCEI 1991 to 2020 monthly normals (750 California stations with rain normals); GHCN-Daily station tables.
Method: inverse distance weighting of the three stations with the smallest effective distance, weight
`1 / (d_eff + 1)^2`.

| column | unit | meaning |
|---|---|---|
| `rain_in` | inches a year | normal annual precipitation 1991 to 2020 |
| `rain_wet_m`, `rain_wet_in` | month 1 to 12, inches | wettest month of the normal year and its normal |
| `rain_d1`, `rain_d2` | days a year | days with 1.00 inch or more, 2.00 inches or more: the normals' day counts where the station has them, else its daily record (10 or more complete years, 1991 to 2020 or 1996 to 2025); 513 stations |
| `rain_rec_in`, `rain_rec_date`, `rain_rec_st`, `rain_rec_km`, `rain_rec_yrs` | inches, YYYYMMDD, name, km, years | wettest day on record at the nearest station (effective distance) that has 20 or more years of daily rain; its full period of record. One station, not blended |
| `rain_st`, `rain_km`, `rain_dz` | name, km, m | nearest normals station, its distance, its height above (+) or below the town point |
| `rain_q`, `raind_q`, `rain_rec_q` | A to D | quality of the normal, of the day counts, of the record |

Not built: 3 inch days per ZIP (the tables hold them; ask if wanted); PRISM gridded normals (not downloaded), which
would be better than stations in steep country.

### 1d. Wind (grade A at an airport, C elsewhere; read the flags)

| column | unit | meaning, source, formula |
|---|---|---|
| `g40`, `g58`, `g75` | days a year | days with a peak gust of 40, 58, 75 mph or more at the nearest screened station (not blended: wind is local). Screened tables of the sources file (gust / sustained < 2.25 and the other rules): 141 sites, IEM airport daily summaries 2002 to 2025 or GHCN-Daily 1996 to 2025, 8 or more complete years. Airports sit in valleys and on coasts: canyon and ridge gusts are far higher |
| `gust_max`, `gust_max_date` | mph, YYYYMMDD | highest screened gust at that station 1996 to 2025; null when the screened maximum is above 101 mph (those the sources file calls doubtful) |
| `gust_st`, `gust_km`, `gust_dz`, `gust_yrs`, `gust_q` | | station, distance, height difference, complete years, quality (A within 10 km effective, B 25, C 50, D beyond) |
| `wd58`, `wd75` | days a year | distinct days, 2010 to 2025, with a measured gust report of 58 (75) mph or more within 25 miles (40 km) of the town point in the NWS Local Storm Reports (non thunderstorm and thunderstorm gusts, qualifier M). Mountain and canyon sensors dominate: this is "strong wind was measured nearby", not "at the roofs". Grade B |
| `lsr_max`, `lsr_max_date`, `lsr_max_at` | mph, date, place | highest measured gust report within 25 miles, 2004 to 2026, and where |
| `hw_yr` | days a year | distinct days with a Storm Events "High Wind" record in the forecast zone that holds the town point, 2006 to 2025 (zone outlines dated by half year). Grade B |
| `sa_ep`, `di_ep`, `su_ep` | episodes | Storm Events episodes 2006 to 2025 whose narrative names a Santa Ana, Diablo or sundowner wind and that include the ZIP's zone. Lower bounds: an untagged narrative is not counted |
| `off_kind` | `sa`, `di`, `su`, `` | the offshore wind named most often for the zone |
| `off_cls` | 0 to 3 | exposure class from the count of the named kind: 0 none; 1 occasional (1 to 4 episodes in 20 years); 2 regular (5 to 19); 3 frequent (20 or more, one a year). Grade C (my rule) |
| `asce_wind` | mph | ASCE 7-22 basic wind speed, Risk Category II (700 year), sampled at the town point from ASCE's own image service, else the nearest point of the 0.05 degree grid on disk. The service does not state units; read as mph (unconfirmed, as the sources file says) |
| `asce_swr` | 0/1 | 1 when the town point is in ASCE's California special wind region (the mapped speed does not apply; the local building department sets it). Null when the live sample could not be taken |

### 1e. Wildfire (grade A)

| column | unit | meaning, source, formula |
|---|---|---|
| `fhsz_vh`, `fhsz_high`, `fhsz_mod` | % of ZCTA area | share of the ZCTA polygon inside a Very High, High, Moderate Fire Hazard Severity Zone: State Responsibility Area map effective 1 April 2024 plus the Local Responsibility Area map of 24 March 2025 (the State Fire Marshal's recommendation; a city's adopted map can differ). Polygon overlay in California Albers. Federal land is in neither map, so a ZIP that is mostly national forest shows a low share |
| `fhsz_sh` | % | `fhsz_vh + fhsz_high` (the stub column of data/SCHEMA.md) |
| `fhsz_any` | % | all three classes |
| `fhsz_resp` | `SRA`, `LRA`, `mixed`, `` | which map supplies the zoned land |
| `fire_n` | count | fire perimeters of 10 acres or more, 2000 to 2025, with at least one acre inside the ZCTA (CAL FIRE FRAP historic perimeters) |
| `fire_big`, `fire_big_yr`, `fire_big_ac` | name, year, acres | the largest of them (whole fire acres, computed from the outline) |
| `fire_last`, `fire_last_yr`, `fire_since` | name, year, years | the latest of them; `2026 - fire_last_yr`. Null when no perimeter touched the ZIP since 2000 |
| `burn_sh` | % | share of the ZCTA inside any of those perimeters (union, so reburns count once) |
| `fire_km`, `fire_near`, `fire_near_yr` | km, name, year | town point to the nearest perimeter of 10 acres or more since 2000 (0 when inside one) |
| `fire_dest`, `fire_dmg` | structures | destroyed (more than 50%), and damaged (major, minor, affected), in the ZCTA in CAL FIRE damage inspections 2013 to 2025, by point in polygon (points up to 500 m outside every ZCTA go to the nearest) |
| `fire_dest_res`, `fire_dmg_res` | residences | the same, residential structure types only (single family, multi family, mobile home, mixed) |
| `fire_insp` | structures | all structures inspected in the ZIP in incidents of 2018 and later, undamaged ones included |
| `lastfire`, `yrsfire` | year, years | most recent incident year with a destroyed or damaged structure in the ZIP; `2026 - lastfire`. Null when none on record |
| `fire_worst`, `fire_worst_yr`, `fire_worst_dest` | name, year, structures | the incident that destroyed most in the ZIP |

Not built: share of buildings or housing units in each zone. It needs building footprints or census blocks over 28,175
zone polygons, and neither was on disk; the area share stands in and overstates risk nowhere but understates it where
homes cluster at the wildland edge of a large ZCTA.
Loss by year per ZIP is in `hz.zdins` (section 2), not in a column.

### 1f. Snow

| column | unit | meaning |
|---|---|---|
| `snow_psf` | lb/ft2 | ASCE 7-22 ground snow load, Risk Category II, at the town point: live sample of ASCE's image service (1 km cells), else the nearest 0.05 degree grid point on disk. Units unconfirmed (read as lb/ft2). The 2022 design load is a reliability target load, far above a 20 year load |
| `snow20_psf` | lb/ft2 | ASCE 7-22 20 year ground snow load at the same point |
| `snow_max_psf` | lb/ft2 | highest Risk Category II value among the 0.05 degree grid points inside the ZCTA (null when no grid point falls inside): what the high ground of the ZIP carries |
| `snow_q` | A to C | `A` live sample at the town point and the ZCTA's ground spans under 300 m; `B` live sample, ground spans 300 m or more (the town value is not the ridge value); `C` grid fallback |
| `apr1_swe_in`, `apr1_st`, `apr1_km`, `apr1_yrs` | inches of water, station, km, water years | mean 1 April snow water content, water years 1996 to 2025, at the nearest CDEC snow sensor within 25 km whose elevation lies inside the ZCTA's elevation range (plus or minus 150 m). Null where no such sensor exists (most of the state, and all of the southern mountains: CDEC has none there). Weight on the ground = inches x 5.2 lb/ft2 |
| `snowfall_in` | inches a year | 1991 to 2020 normal snowfall at the nearest station with a snowfall normal within 30 km effective distance, else null |

### 1g. Heat (grade A at a station)

| column | unit | meaning |
|---|---|---|
| `h90`, `h100`, `h110` | days a year | days with a maximum of 90, 100, 110 F or more, 1996 to 2025: GHCN-Daily cooperative, airport and SNOTEL stations with 10 or more complete years (343 stations; RAWS left out for bad values), three nearest by effective distance (elevation and distance to the sea both count), weighted as rain |
| `heat_rec_f`, `heat_rec_date` | F, YYYYMMDD | highest maximum on record at the nearest of them |
| `heat_st`, `heat_km`, `heat_dz`, `heat_yrs`, `heat_q` | | station, distance, height difference, years, quality |
| `tjul` | F | normal July daily maximum (1991 to 2020 normals, 373 stations, same weighting): used for the marine layer class |

### 1h. Hail, thunderstorm wind, tornado, flood (grade A counts; hail is rare here: say so)

Sources: Storm Prediction Center files (hail 1955 to 2025, wind 1955 to 2025, tornado 1950 to 2025). California has 891
hail reports in 69 years for the whole state, 349 of one inch or more. Most ZIPs have none nearby in a decade.

| column | unit | meaning |
|---|---|---|
| `hail_n25` | reports | hail reports of any size within 25 miles of the town point, 1955 to 2025 |
| `hail1_n25` | reports | of 1 inch or more |
| `hd1` | days a year | distinct days with 1 inch hail within 25 miles, 1996 to 2025 (Louisiana's `hd1`, same rule; nearly always 0.0x) |
| `hail_max_in`, `hail_max_date` | inches, date | largest hail within 25 miles and its day; null when none |
| `tsw_n25` | reports | thunderstorm wind reports within 25 miles, 1955 to 2025 |
| `tor_n25` | tornadoes | tornado start points within 25 miles, 1950 to 2025 |
| `flood_n10` | records | located Storm Events Flood, Flash Flood and Debris Flow records within 10 km of the town point, 1996 to 2025 |

### 1i. Coast

| column | meaning |
|---|---|
| `salt_cls` | 0 to 3 from `coast_km`: 3 within 1 km of salt water, 2 within 5 km, 1 within 15 km, 0 beyond. The breaks are my choice (grade D); the roofing evidence has no California distance rule |
| `marine_cls` | 0 to 3, marine layer exposure (grade D, my rule): 3 `coast_km` 8 or less and town below 300 m and `tjul` under 76 F; 2 `coast_km` 30 or less, below 500 m, `tjul` under 84 F; 1 `coast_km` 60 or less, below 600 m, `tjul` under 90 F; else 0. No observed cloud or fog climatology was used: none was collected |

### 1j. Roof weather stress score (grade D: a ranking aid, not a physical quantity)

Six parts, each 0 to 100, and a weighted sum. Every weight and cap is my choice, stated here so it can be changed.

| column | formula |
|---|---|
| `st_rain` | `100 x (min(1, rain_d1 / 15) + min(1, ar3_d / 5)) / 2` |
| `st_wind` | `100 x (0.5 min(1, g58 / 2) + 0.3 min(1, wd58 / 15) + 0.2 off_cls / 3)` |
| `st_fire` | `100 x min(1, 0.6 (fhsz_vh + 0.5 fhsz_high + 0.2 fhsz_mod) / 100 + 0.25 min(1, burn_sh / 30) + 0.15 [fire_dest > 0])` |
| `st_heat` | `100 x min(1, h100 / 60)` |
| `st_snow` | `100 x min(1, snow_psf / 300)` |
| `st_salt` | `100 x max(0, 1 - coast_km / 10)` |
| `stress` | `0.25 st_rain + 0.25 st_wind + 0.25 st_fire + 0.10 st_heat + 0.10 st_snow + 0.05 st_salt`, rounded |
| `st_top` | which part is largest: `rain`, `wind`, `fire`, `heat`, `snow`, `salt` |

## 2. `hazard_events.json` (`hz`): the event ledger

```
{ compiled, geo: {W, H, minx, maxy, kx, sx} used for the paths,
  fires: [ {...} ],  zfire: {zip: [[fire index, dest, dmg, km, pct], ...]},  zdins: {zip: {year: [res dest, res dmg, all dest, all dmg]}},
  ar: [[start, hours, rank, ivt, peak lat, south lat, north lat], ...],  ar_cols, ar_pts: [ {...} x 20 ],  ar_big: [ {...} ],
  wind: [ {...} ],  zones: [ {i, ugc, name, zips: [...]} ],
  roof: {...},  fhsz: {...},  fema: [[number, type, date, kind, title, counties], ...] }
```

### 2a. `fires` (replaces `routes` and `seg`)

Every CAL FIRE (FRAP) perimeter in California with a year of 2000 or later that is 1,000 acres or larger, or that has
at least one destroyed or damaged structure tied to it in the damage inspections; plus one entry (no outline) for each
inspection incident with damage that matches no perimeter. Sorted by year, then alarm date.

| field | meaning |
|---|---|
| `id` | `F<year>_<FRAP object id>`, or `D<year>_<name>` for an incident without a perimeter |
| `name`, `year`, `start`, `cont`, `month` | FRAP fire name (title case; `Unnamed` when blank), year, alarm date and containment date `YYYY-MM-DD` (null when FRAP has none), alarm month |
| `acres` | area of the perimeter computed from its outline (FRAP `GIS_ACRES` agrees to rounding); null without a perimeter |
| `dest`, `dmg` | structures destroyed, and damaged (major + minor + affected), in the damage inspections tied to this perimeter. **Null for fires before 2013** (no digital inspection records: Cedar 2003, Witch 2007 and the rest have no count here, and none was invented); 0 for a 2013 or later fire with no inspection record |
| `dest_res` | residences among `dest` |
| `insp` | all structures inspected (undamaged included); 2018 and later only, else null |
| `dins` | the inspection incident names tied to the perimeter (up to three) |
| `cause` | FRAP cause text (Lightning, Equipment Use, Arson, Powerline ...), null when not coded |
| `agency`, `complex` | FRAP agency code and complex name |
| `fips` | counties (FIPS) of the ZIPs the perimeter covers or where it damaged structures |
| `lat`, `lon` | a point inside the perimeter (or the mean of the damaged structures when there is no perimeter) |
| `d` | the outline as an atlas path (outer rings only, simplified; parts under 2% of the fire dropped); null without a perimeter |
| `dr` | FEMA declaration numbers tied by name and year (fire management, major disaster or emergency), `[]` when none |
| `note` | why a count is null, or how a perimeter-less incident was placed |

How inspections are tied to perimeters: each inspected structure goes to the perimeter of its incident year (or the
year before or after, for fires that cross a new year) within 1 km whose name or complex name matches the incident
name; without a name match, only when the structure is inside or within 150 m (the inspection rule is 300 feet).
Structures that match nothing form the perimeter-less entries. The ledger totals therefore equal the inspection file's
totals exactly (check in section 7).

### 2b. `zfire` (replaces `zstorm`) and `zdins`

`zfire[zip]` = `[[fire index into fires, destroyed in the ZIP, damaged in the ZIP, km from the town point to the
perimeter (0 inside), percent of the ZCTA inside the perimeter], ...]` for: fires that cover part of the ZIP or damaged
structures in it; fires within 10 km of the town point; and, out to 25 km, only the major fires (100 or more
structures destroyed, or 50,000 acres or more). The 25 km rule for every fire would have doubled the table.
`zdins[zip][year]` = `[residences destroyed, residences damaged, all structures destroyed, all damaged]` (the shape
`03_hazard_in.py` calls `fire_year`), ZIPs and years with damage only.

### 2c. `ar`, `ar_pts`, `ar_big` (atmospheric river landfalls)

`ar`: every landfall of water years 1960 to 2026 (2026 is October to December 2025 only), merged along the coast (point
events at neighbouring coast points that overlap in time are one storm and take the highest rank): `[start date
YYYY-MM-DD (UTC), hours at the point where it lasted longest, rank 1 to 5, peak IVT kg/m/s, latitude of the peak,
southernmost latitude, northernmost latitude]`. `ar_cols` names them.
`ar_pts`: the 20 coast points `{i, lat, lon, name (my label: nearest landmark), n_yr: [AR1..AR5 events a year],
days_yr: [..], max, max_date, max_ivt}`.
`ar_big`: the AR4 and AR5 landfalls (all years) and the notable AR3s since 1996 (reported damage of $10 million or
more, or a FEMA declaration with 20 or more Storm Events records, or two or more direct deaths):
`{id, start, end, peak (UTC hours), year, month, wy, rank, ivt, dur_h, dir, lat0, lat1, peak_lat, peak_at, stretch
('South Coast', 'Central Coast', 'North Coast' or joined), pr (20 digits: the rank at each coast point, 0 = none; a
ZIP's rank is pr[ar_pt]), summer (true June to September: tropical moisture likely), notable3, se_ok (false before
1996: Storm Events has no flood or wind rows then), se_n, se_dmg ($), se_deaths, se_types {type: count}, gust [mph,
zone, date] (highest measured High Wind gust in the tied records; summit sensors included), dr [FEMA numbers]}`.
Tie rule: Storm Events records of the wet and windy types (Flood, Flash Flood, Heavy Rain, Debris Flow, High Wind,
Strong Wind, Winter Storm, Heavy Snow, Blizzard, Coastal Flood, High Surf, Thunderstorm Wind, Tornado, Avalanche)
that begin between 14 hours before the landfall's start and 24 hours after its end, and lie within 0.75 degree of
latitude of its stretch of coast. FEMA: flood, storm, slide and winter declarations whose incident period overlaps the
landfall within 3 days. Damage figures are forecasters' estimates and are incomplete. Grade B.

### 2d. `wind` and `zones` (Santa Ana, Diablo, sundowner, Mono and winter high wind)

One entry per wind event: Storm Events "High Wind" and "Strong Wind" records 1996 to 2026 grouped by kind and by
overlapping dates (records of the same kind whose dates touch or overlap are one event, north and south of 35.8 N
kept apart). Kinds: `santa_ana`, `diablo`, `sundowner`, `mono` (the narrative names the wind), `winter` (October to
April, not named), `other`. Kept: every named event; winter and other events with a measured gust of 75 mph or more
below summit level is not knowable, so the rule is: reported damage of $250,000 or more, or 12 or more zone records,
or a death.

`{id, kind, start, end (YYYY-MM-DD), year, month, gust (mph, highest measured gust in the event's Storm Events
records or Local Storm Reports), where (place or zone of that gust), lat, lon (of that gust: the report's point, or
the zone's inside point), fips (counties), dmg ($ reported), deaths (direct), n (zone records), n58 (measured Local
Storm Reports of 58 mph or more in the event's counties and days; null before 2004), zn (indexes into zones)}`.
`zones[i]` = `{i, ugc, name, zips: [...]}`: the dated zone outline version and the ZIPs whose town point lies in it.
A ZIP's wind events are those whose `zn` includes a zone listing the ZIP. Records of 1996 to 2004 in zones retired
before the outline archive begins are tied by zone name only where the name still exists; the rest have no ZIP list
(`zn` shorter than `n`).

### 2e. `roof`, `fhsz`, `fema`

`roof`: residences in inspection incidents of 2018 and later by roof covering and damage: `{asphalt: {dest, major,
minor, affected, none, total}, metal, tile, concrete, wood, other, unknown}`, and the same shape under `eaves`
(`enclosed`, `unenclosed`, `none`, `unknown`) and `vents` (`mesh_fine`: 1/8 inch or smaller, `mesh_coarse`,
`unscreened`, `none`, `unknown`). Raw cross tabulation: see the caveats in roof_hazard_model.md before printing a share.
`fhsz`: statewide land in each class, km2, from the same overlay (`moderate`, `high`, `very_high`, `zcta_total`), and
the count of ZIPs with any Very High land.
`fema`: every California declaration `[number, type (DR, EM, FM), declared date, kind, title, counties designated]`.

## 3. `hazard_ts.json`: time series (merge into `ts`)

| key | shape | content |
|---|---|---|
| `month` | `{kind: [12]}` January first | `hail`, `tsw`, `torn` (SPC reports 1996 to 2025, Louisiana's three; `wind` is an alias of `tsw`); Storm Events records 1996 to 2025: `hw` High Wind, `sw` Strong Wind, `hrain` Heavy Rain, `flood`, `fflood`, `debris`, `hsnow` Heavy Snow, `wstorm` Winter Storm, `xheat` Excessive Heat, `heat`, `wfire` Wildfire; `g58` Local Storm Report measured gusts of 58 mph or more 2010 to 2025; `fire_n` perimeters started 2000 to 2025, `fire_ac` their acres, `fire_dest`, `fire_dmg` structures 2013 to 2025; `ar1` ... `ar5` landfalls by rank water years 1960 to 2025; `ar_days` mean AR days a year at a California coast point; `sa_days` mean Santa Ana days a year by month (Scripps regional index 1948 to 2018, days with index above 0) |
| `year` | `{"1996".."2025": {kind: n}}` | the same kinds by year (`hail1` hail of 1 inch or more added; `g58`, `g75` from 2004; fire kinds from 2000; `fire_dest`, `fire_dmg`, `fire_dest_res` from 2013) |
| `hour` | `{kind: [24]}` Pacific Standard Time | `hail`, `tsw`, `torn` (SPC), `g58` (Local Storm Reports), `fflood` (Storm Events) |
| `dowhour` | 7 x 24 | counts of the `pts` records (Sunday first) |
| `ar_wy` | `{"1960".."2025": [AR1..AR5 landfalls]}` | merged landfalls by water year and rank |
| `ar_days_wy` | `{wy: [5]}` | AR days by rank, mean over the 20 coast points |
| `sa_year` | `{"1948".."2018": days}` | Santa Ana days by calendar year (no public update after 2018) |
| `rain` | `{north: [12], central: [12], south: [12], state: [12], reg: {nc: [12], ...}}` | normal monthly precipitation, inches, mean of the ZIP values weighted by housing units (ACS). Belts: north = nc, fn, sv, si; central = ba, cc, sj; south = la, oc, ie, sd. This is the vector the service line model needs for the leak season |
| `fema_decl` | `[[number, type, declared date, kind, title, counties], ...]` | every California declaration |
| `fema_decl_year` | `{year: {fire, storm, flood, quake, other}}` | declarations by year declared and kind (storm = Severe Storm, Winter Storm, Coastal Storm, Mud/Landslide, Snowstorm, Freezing, Tornado) |
| `zone_county` | `{fips: {type: count}}` | Storm Events records 2006 to 2025 by county and type, zone filed records placed in the county that holds most of the zone (replaces the parish `trop` field) |
| `fire_year` | `{"2000".."2025": [perimeters, acres, perimeters of 1,000 acres or more, structures destroyed, damaged, residences destroyed]}` | the last three null before 2013 |

Not written here: `fema_year`, `replace_hist`, `ppi`, `permits`, `agehist` (the data job owns them).

## 4. `hazard_pts.json`: located reports

`{ptkinds: [{k, name, unit, src}], ptflags: [...], pts: [[lat, lon, year, month, weekday (1 = Sunday), hour (0 to 23
Pacific Standard Time, -1 unknown), kind, magnitude, flag bits, county index, ZIP row index or -1, damage $ thousand]],
order: {zips: 'CA/data/work/base.json', n_zips, n_counties}}`.
`pi` and `zi` index the data job's county and ZIP order as read from `CA/data/work/base.json` at build time; if that
order changes, rerun step 07 (it re-reads the file).

Kinds: 0 hail (inches), 1 thunderstorm wind (**mph**; Louisiana used knots), 2 tornado (EF number, -1 unrated), 3 flood
(no magnitude: 0), 4 flash flood (0), 5 debris flow (0), 6 heavy rain (inches, from Local Storm Reports of 3 inches or
more), 7 non thunderstorm wind gust (mph, Local Storm Reports of 58 mph or more).
Sources and thinning: kinds 0 to 5 are Storm Events records with coordinates, 1996 to 2026 (kinds 3 and 4: 2006 on).
Kinds 6 and 7 are Local Storm Reports 2010 to 2026 thinned to the highest report per day in each 0.25 degree cell.
Flags, bit order: `h1` (hail 1 inch+), `h175`, `w58` (wind kinds 58 mph+), `w75`, `ef1`, `dmg` ($10,000+), `night`
(hour 20 to 5), `measured` (instrument), `burn` (flash flood or debris flow whose narrative names a burn scar or a
named fire).

## 5. `ca_nws_snapshot.json` (fetched live 2026-11-19; refetch with `python3 -I 10_nws_snapshot.py`)

Louisiana's structure with these differences. `points` (11, one per region: Eureka nc, Redding fn, Sacramento sv,
Truckee si, San Francisco ba, Santa Barbara cc, Fresno sj, Los Angeles la, Santa Ana oc, Riverside ie, San Diego sd)
carry `reg` and `fireZone`; `grid` adds `snowfallAmount`, `snowLevel` (m), `relativeHumidity`, `skyCover`,
`windDirection` (degrees) to Louisiana's seven series. `alerts` add `zones` (UGC codes), `fips` (five digit county
FIPS), `sender`. `obs` (33 airports) adds `rh`. `afd` has all ten offices `{issued, text, name}`.
`nhc` and `spc` are gone. In their place:
`fire` = SPC fire weather outlook: `{names, dry_names, src, "1", "2": {valid, expire, issued, levels: {county FIPS: 0
none, 1 elevated, 2 critical, 3 extremely critical}, dry: {FIPS: 0, 1 isolated, 2 scattered dry thunderstorms}, polys,
dry_polys: [{level, ring}], ok}, text, text2}`;
`ero` = WPC excessive rainfall outlook: `{names, src, "1", "2", "3": {valid, issued, start, end, levels: {FIPS: 0 none,
1 marginal, 2 slight, 3 moderate, 4 high}, polys, ok}}`;
`rain` = `{cnrfc: {issued, text} (California Nevada River Forecast Center discussion), qpf: {city: {mm24, mm72, in24,
in72, gust72_mph}}, src}`;
`ar` = `{available: false, note, afd_mentions: {office: count of "atmospheric river" in its discussion}, page}`: no
machine readable AR scale forecast is public (CW3E publishes images), and the block says so.
A county takes an outlook level when the outlook polygon covers at least 0.5% of it or 25 km2.

## 6. `roof_hazard_model.json` and `roof_hazard_model.md`

For Rooftop Scout: per covering (`shingle3` three tab asphalt, `shingleL` laminated asphalt, `tile_c` concrete tile,
`tile_k` clay tile, `shake` wood shake, `metal`, `membrane` low slope single ply, `bur` built up), what the evidence
supports for wildfire, wind, hail, heat and sun, snow load and salt air, each statement with `value`, `unit`, `basis`,
`src`, `grade`, and a `not_known` list. Keys are described in the markdown note beside it.

## 7. Checks (`CHECKS.md`)

Totals against the sources' own counts (inspection file 70,390 destroyed; AR point events 12,461; SPC 891 hail);
every ZIP has a value or a null with a reason for every column; spot checks at Paradise 95969, Pacific Palisades
90272, Altadena 91001, Santa Rosa 95403 and 95404, South Lake Tahoe 96150, Mammoth Lakes 93546, Death Valley 92328,
Eureka 95501, Burbank 91502, Fremont Canyon (Silverado 92676).

## 8. Decisions and weak methods (short list; details in the sections above)

1. Atmospheric river exposure is by latitude of the coast, not reduced inland (flag `ar_q`).
2. Rain, heat: three nearest stations with elevation care; no gridded climate (PRISM) was used.
3. Gust days come from the nearest screened airport, which can be 50 km or more away (`gust_q` D for 237 ZIPs);
   the Local Storm Report columns are dominated by mountain sensors.
4. Offshore wind class counts narratives that name the wind: a lower bound, and uneven between forecast offices.
5. Fire zone shares are land area, not homes.
6. ASCE values are read as lb/ft2 and mph without confirmation of units.
7. Marine layer and salt classes and the stress score are judgement rules (grade D).
8. Structure counts for fires before 2013 are null.

## 9. Measured results

Written by the last build step: see the end of this file.
