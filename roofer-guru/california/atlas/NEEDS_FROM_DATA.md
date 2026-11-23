# What the ledger, weather desk, regions and watch modules need from the data jobs

STATUS 2026-11-23: answered. HAZARD_SCHEMA.md (final, section 10) and the merged ca_atlas_data.json carry everything
below; modules 02, 11, 13, 14 were tested against the merged file. Nothing here is open. Two notes for other readers:
- `09_sl_model.js` reads monthly series through its own `HZ.month` picker, whose name lists do not include the final
  names `sa_days` (Santa Ana days), `hw` (High Wind), `hsnow`/`wstorm` (snow), and it takes `ts.month.wind`, which is an
  alias of thunderstorm wind (`tsw`), as its wind series. Its owner should check those picks against section 3.
- Module 02 reads the ledger as `DATA.hz`; `hz.fhsz` and `hz.fema` are optional (it falls back to `ts.fema_decl`).

The original requests follow, for the record.

Written by the owner of modules 02, 11, 13, 14 (and 10_watch_core.js, 11_nws_core.js), 2026-11-19, against
HAZARD_SCHEMA.md "first draft" and data/SCHEMA.md "first issue". Names are yours to choose: I read the schema
files and adapt. What is listed here is the content and the shapes that will or will not work in the page.
Anything marked MUST would break a screen; the rest degrades to "not in the data".

## 1. Weather snapshot (`ca_nws_snapshot.json`): works as built. Three small things

- `points[].grid`: please add `windDirection` (degrees) to `GRID_KEYS`. The offshore wind trigger (Santa Ana,
  Diablo, sundowner) needs the direction; without it only the humidity test fires. The live refresh already asks for it.
- `alerts[].fips` come out with six characters (`'006019'`). I take the last five, so nothing breaks.
- I read: `fetched, tz, source, points[{city, lat, lon, reg, office, gridX, gridY, zone, county, fireZone, periods,
  hourly, grid}], alerts[{event, severity, onset, ends, expires, areas, zones, fips, hail, gust}], obs, afd{office:
  {issued, text, name}}, fire{names, dry_names, src, '1','2': {valid, levels, dry}, text}, ero{names, src, '1'..'3':
  {valid, levels}}, rain{cnrfc{issued, text}, qpf}, ar{note, afd_mentions, page}`. Please keep these.

## 2. Event ledger (module 02). One top level key in `__ATLAS_DATA__`, here called `hz`

- MUST `hz.fires`: one object per fire that has damage inspection records or a perimeter worth drawing.
  `{id, name, year, start (YYYY-MM-DD), acres, dest, dmg, fips (county FIPS list), lat, lon, d}`.
  `dest` = structures destroyed, `dmg` = major + minor + affected, from the inspections (0 when the fire has none).
  `d` = the perimeter as an atlas path string (`M x y l dx dy ... z`, the `geo` units of the final data file), or
  `ring`/`rings` in lon/lat: either works, I can project rings in the page. `lat, lon` = a point inside the fire, so the
  map can fit to it and a fire with no perimeter still gets a dot. Wanted if you have them: `cont` (containment
  date), `cause`, `dr` (FEMA number), `dest_res` (residences destroyed), `insp` (all structures inspected, 2018 on).
  Size: please keep all perimeters together under about 500 KB (fires of 1,000 acres or more since 2000, plus every
  fire with destroyed structures, simplified to about 60 to 150 points each would do).
- MUST `hz.zfire`: `{zip: [[fire index or id, destroyed in the ZIP, damaged in the ZIP, km from the ZIP's point to the
  perimeter (0 when inside), percent of the ZIP's land inside the perimeter], ...]}` for fires within 25 km of the
  ZIP or with structures in it. The ZIP lookup ("what has touched this ZIP") is built on this.
  Checks I will run: 95969 lists Camp 2018, 90272 Palisades 2025, 91001 Eaton 2025, 96150 Caldor 2021.
- `hz.ar`: atmospheric river landfalls, one row per event merged along the coast:
  `[start date, hours, rank 1 to 5, peak IVT, latitude of the peak, south latitude, north latitude]`.
  All ranks if size allows (about 1,500 rows), else AR2 and up. The map draws them as marks on the coast by rank.
- `hz.wind`: dated wind events with a measured peak gust: `{date, kind ('santa_ana', 'diablo', 'sundowner', 'mono',
  'winter', 'other'), gust (mph), where (place of the peak gust), lat, lon, fips (counties), dmg ($ reported), n58
  (measured reports of 58 mph or more in the event)}`. A point for the peak gust is enough to draw it.
- `hz.roof` (the roof model's table, for "what each kind does to roofs by covering"): residences in incidents of 2018
  and later by roof covering and damage level: `{asphalt: {dest, major, minor, affected, none, total}, metal, tile,
  concrete, wood, other, unknown}`; if you also have it by eaves and by vent screen, same shape under `eaves`, `vents`.
- `hz.fhsz` state totals if cheap: homes or land in Moderate, High, Very High zones (SRA 2024 and LRA 2025).

## 3. Located reports (`pts`, `ptflags`): Louisiana's row shape works

`[lat, lon, year, month, weekday 1 to 7 (Sunday = 1), hour 0 to 23 or -1, kind, magnitude, flag bits, county index,
ZIP row index or -1, damage in $ thousand]`. MUST: `pi` and `zi` index the final `parishes` and `zrows` of the
merged file (the hazard job has 1,808 ZCTAs, the atlas fewer). Hours in Pacific Standard Time. Please publish the
kind list with units next to it (`ptkinds: [{k, name, unit}]`); the ones the module has filters for: hail (inches),
thunderstorm wind, tornado (EF), flood and flash flood, debris flow, heavy rain (inches), non thunderstorm wind gust.
Wind magnitudes in mph for every wind kind would be simplest (Louisiana used knots; tell me which).
Flags I would use if present: `w58`, `w75`, `h1`, `dmg` ($10,000 or more), `night`, `measured`, `burn` (debris flow or
flash flood tied to a burn scar, if the narrative lets you tell).

## 4. ZIP columns (group E) the modules read. Null where not known

Fire: share of the ZIP in Very High, High and Moderate Fire Hazard Severity Zones as three columns (the stub has one
`fhsz_sh`; module 02's ZIP lookup shows "zone shares", so I need the split); `fire_dest`, `fire_dmg`; `lastfire`;
number of fires whose perimeter touched the ZIP; km to the nearest perimeter.
Wind: gust days a year at 40 and at 58 mph (say which station and how far, or a `*_km` column).
Rain: days a year with 1 inch or more; normal annual inches; atmospheric river days a year (say which ranks).
Heat: days at 100 F and at 110 F. Snow: ground snow load. Hail: days a year with 1 inch hail within 25 miles if kept.
The same as county fields (or I take resident weighted means of the ZIP columns, as Louisiana's module 11 did).

## 5. Time series (`ts`)

- By month (arrays of 12, January first) and by year (objects keyed by year) for each kind the ledger charts:
  fires started, acres, structures destroyed; atmospheric rivers by rank; Santa Ana days (Scripps index, to 2018);
  zone filed High Wind, Strong Wind, Heavy Rain, Flood, Flash Flood, Debris Flow, Heavy Snow and Winter Storm,
  Excessive Heat and Heat events; hail, thunderstorm wind, tornado reports. Any naming, as long as month series are
  length 12 and year series are keyed by year. `ts.month` and `ts.year` as the containers would suit the code.
- FEMA declarations by year and kind (the brief says 280 of 325 since 2000 are fire): either a list
  `[number, type (DR, EM, FM), date, kind, title]` or a table `{year: {fire, storm, flood, quake, other}}`.
  `ts.fema_year` (registrations by disaster) is in SCHEMA.md and works as described there.
- Zone filed events by county (the replacement for Louisiana's parish `trop` field): `{fips: {type: count}}`.

## 6. Atlas data (data/SCHEMA.md): works. Two things

- `comp`: three named firms is fine; module 13 is built on `lic_city`, ZIP `lic`, `comp_n25`, county `lic`,
  `cbp_roof`, `roofers` when the roster is short. MUST for every `comp` row: `name`, and arrays (possibly empty) for
  `lines`, `cities`, `offices`; `tier` one of `statewide, national, regional, local`.
- Media markets (module 11): no county list for Nielsen markets is in the evidence, so the module names each region's
  markets by principal city and says so. If `meta.model` gets a market name per region (`MKT`?) I will read it;
  otherwise the names are typed in the module.
