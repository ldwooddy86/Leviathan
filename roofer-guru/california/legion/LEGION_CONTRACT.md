# Legion: contract for the integration into Rooftop Scout

Written November 24, 2026, from Legion's own code (build `05200b91d183`, `CA/legion/orig/Legion.html`, never edited)
and from the app run in headless Chromium. Line numbers are in `CA/legion/work/bundle.pretty.js` and
`work/worker.pretty.js` (the bundle and the worker put through prettier; `work/decode.py` and prettier remake them).
Names in `code` followed by a short name in brackets, like `Population [xy]`, give the plain name first and the
minified name of this build second. Section 9 lists every minified name with the text that finds it again.

Everything in Legion is **synthetic**. The people are drawn from Census tables for a ZIP area. No person, name,
address, household, job or sentence is a record of a real resident. Section 10 says what that means for the page.

## 1. What the file is

`Legion.html` is one page of 5.3 MB:

| part | where | size | what |
|---|---|---|---|
| head | start | 1.6 KB | title, one script that reads `localStorage['legion.settings.v1']` for the theme before first paint |
| stylesheet | one `<style>` | 44.8 KB | global selectors (section 7) |
| markup | `<body>` | 2.6 KB | fixed ids: `topbar brand search-input search-icon search-list clock-host count-agents count-moving theme-button settings-button stage map count-agents-m count-moving-m place-panel npc-panel settings-dialog toasts boot boot-mark boot-steps boot-bar` |
| `window.__LEGION_PACK__` | script 1 | 2.0 MB | `world.json`, gzip, base64 (1.5 MB gzip, 4.9 MB JSON) |
| `window.__LEGION_WORKER_SRC__` | script 2 | 0.5 MB | the crowd worker's source, as a JSON string (an IIFE of 504 KB) |
| bundle | script 3 | 2.7 MB | one esbuild IIFE; its last statement is `goe();` (the boot) |

About 1.4 MB of the bundle is the Anthropic TypeScript SDK (lines 100 to 1000 and 47 690 to 64 220), used only by
the optional Claude voice. The rest is Legion: name and language tables (1 900 to 11 400), the population
(11 400 to 13 830), persona, schedule, mind and offline dialogue (13 830 to 47 690), the street view
(64 220 to 75 320), live weather (75 320 to 75 990), the map (75 990 to 77 030), the crowd (77 030 to 79 730),
the services object (79 730 to 81 460) and the page's own interface (81 460 to the end).

Nothing is fetched on load. With the default settings the page makes no network request at all (checked: section 7).

## 2. The world pack

`window.__LEGION_PACK__` decodes (`unpack [b1]`: base64, gunzip with `DecompressionStream`, `JSON.parse`) to one
object, "Legion world pack" `v` 1, `compiled` 2026-11-19. Its first source is this dashboard:
`sources[0] = { k: 'atlas', name: 'California Roofer Guru atlas', vintage: 'compiled 2026-11-19' }`.
The other sources named in `sources`: ACS 2020-2024 five-year by ZCTA (tables B01001, B03002, B03001, B02015, B04006,
B05012, B08301, B08303, B11001, B12001, B14001, B15003, B19001, B21001, B23025, B25044, C16001, C24010), the NWS
snapshot carried by the atlas (fetched 2026-11-23T22:38:55Z), Caltrans Traffic Census 2024, USGS GNIS, the California
Geological Survey's provinces, CAL FIRE perimeters and damage inspections through 2025, FEMA declarations, and a
curated table of neighborhood names in the eight biggest cities.

### 2.1 Geography, and the join with the dashboard

**Legion is keyed on the dashboard's own ZIP rows.** `z.zip` is the same 1,762 ZCTAs as `__ATLAS_DATA__.zrows`
(`CA/data/SCHEMA.md` section 0.6), **in the same order**: Legion's ZIP index `zi` is the dashboard's row index
(checked: equal lists). There are no tracts, blocks or cells below the ZIP. Below a ZIP a home is a point (section 3.4).

`proj` is the dashboard's `geo` projection, number for number: `W` 4800, `H` 5467, `minx` -124.6, `maxy` 42.1,
`kx` 0.796002002534622, `sx` 563.564073221801. World units:

    x = (lon - minx) * kx * sx        y = (maxy - lat) * sx          (World.project / World.unproject)
    one unit = 111.32 / sx = 0.19753 km (World.unitKm); east-west distance is corrected by cos(lat) / kx (World.distKm)

Of the 146 ZIP columns, 134 have the dashboard's name and meaning (units and sources: `CA/data/SCHEMA.md` section 2).
Compared value by value with `CA/data/out/ca_atlas_data.json` of 2026-11-23, they are equal except:
`tlat`, `tlon` (rounded to 4 places), `metal_sh` (1 place), `off_kind` (`null` where the dashboard has `''`) and
`zone` (1,259 rows differ: Legion carries the public forecast zone of the older issue, for example `CAZ041` where
the dashboard now has `CAZ368`; use the dashboard's). The twelve columns only Legion has:

| column | meaning |
|---|---|
| `county` | index into `counties` (the dashboard's `pi`) |
| `region` | region key `nc fn sv si ba cc sj la oc ie sd` (the dashboard's `reg` is the number 1 to 11) |
| `x`, `y` | the ZIP's label point (`lat`, `lon`) in world units |
| `tx`, `ty` | the ZIP's town point (`tlat`, `tlon`) in world units; the street view of a place opens here |
| `province` | index into `provinces` (11 geomorphic provinces, CGS Note 36, simplified) |
| `zoneName` | index into `zones` (209 rows `[zone code, zone name]`) |
| `wfo` | NWS forecast office of the ZIP: `LOX STO SGX MTR HNX EKA REV VEF MFR PSR` |
| `fires` | list of `[index into fires, structures destroyed in this ZIP, damaged in this ZIP, km to the perimeter, percent of the ZIP burned]` |
| `nbhd` | neighborhood names inside the ZIP (190 ZIPs of the eight biggest cities have any); the first is the main one |
| `roof_age` | estimated median roof age in years (the dashboard's roof model, `SCHEMA.md` section 11) |

Columns Legion's generator and voice read most: `pop hh hhsize inc value own_sh sfd_sh mf5_sh mh_sh vac_sh hu yb_med
own_yr moved10_sh density sqmi` (households and homes), `roof_age ra20_sh tile_sh wood_sh metal_sh solar_sh` (roofs),
`fhsz_vh fhsz_any fire_* burn_sh fair_sh nonren_sh prem wf_hi_sh` (wildfire and insurance), `rain_in rain_rec_* gust_max
g58 sa_ep di_ep off_kind snow_psf snowfall_in h90 h100 h110 heat_rec_* tjul hail_* ar_* marine_cls salt_cls` (weather on
record), `elev_m elev_pt_m coast_km cz` (setting), `est retail food ... roofers solar_co ins_agents` (business counts,
used to place work sites and errands).

### 2.2 Tables

| key | shape | what |
|---|---|---|
| `state` | `{pop 39,287,377, hh 13,548,091, inc, value, age_med, nzip 1762}` | state totals as published; the sum of `z.pop` is 39,286,245 and of `z.hh` 13,547,871 |
| `regions` | 11 `{key, name, the, counties: [fips]}` | DESIGN.md's eleven regions |
| `counties` | 58 `{fips, name, region, seat, lat, lon, pop, hh, inc, value, lastfire, fema: [[date, type, title, 'DR']]}` | FIPS order, the dashboard's county order |
| `zcols`, `z` | 146 names; `z[name]` is an array of 1,762 | the ZIP table, column by column |
| `acs` | `layout` (18 blocks `[offset, length]`), `labels`, `rows` (1,762 arrays of 306 integers) | ACS counts per ZIP: `age` 46 (23 bands, male then female), `race` 8, `hisp` 12, `asian` 17, `anc` 38, `nat` 2, `lang` 25 (13 languages, then 12 "speaks English less than very well"), `comm` 11 (means of travel to work), `ctime` 12 (minutes), `occ` 50 (25 occupations, male then female), `edu` 8, `mar` 12, `vet` 20, `emp` 4, `hht` 5 (household type), `veh` 12 (vehicles, owners then renters), `hinc` 16, `sch` 8 |
| `shapes` | `zip` (1,762 SVG paths), `county` (58), `outline`, `water` (85) + `waterName`, `neighbors` (4) | outlines in world units, paths of `M`, `l`, `z` |
| `places` | 515 rows `[name, lat, lon, pop, cdp, seat, county index, x, y]` | Census places of 10,000 or more and every county seat |
| `cities` | 774 rows `[name, county index, pop, [zips], lat, lon]` | postal cities |
| `gaz`, `gazKinds` | 2,613 rows `[name, kind index, rank, lat, lon, elevation m, x, y]` | GNIS ranges 358, peaks 1,432, passes 698, deserts 23, valleys 41, waters 46, islands 15 |
| `roads` | 197 `{r, kind 'I'/'US'/'SR', name, lines: [[[x, y, AADT in thousands], ...]]}` | state highways (23 Interstates, 4 US, 170 State Routes; 4,124 points) with Caltrans daily traffic. **The only streets in the pack.** |
| `weather` | `fetched`, `points` (11 cities: 14 forecast periods and 72 hourly rows `[time, tempF, rh, pop, wind, short, isDay]`), `obs` (33 stations), `alerts` (38), `afd` (key messages by office), `fire` and `ero` (outlook level by county FIPS), `offices` | the NWS snapshot of 2026-11-23 |
| `fires`, `fireCols` | 1,116 rows `name, year, acres, dest, dmg, lat, lon, cause, start` | CAL FIRE perimeters since 2000 with structures destroyed and damaged |
| `ars`, `arCols`, `arPts` | 148 rows `start, rank, peak_at, stretch, lat0, lat1, dmg, deaths, hours, gust_at, pr`; 20 coast points | atmospheric rivers since 1960; `pr` is the rank at each coast point, one digit each |
| `winds`, `windCols` | 367 rows `kind, start, gust, where, fips, dmg, deaths, lat, lon, zips` | Santa Ana, Diablo, sundowner and winter wind events since 1996 |

The model over it is `World [y1]` (line 1340): `indexOf(zip)`, `zip(zi)` (one row as an object, with `countyName`,
`regionName`, `provinceName`, `neighborhood`), `acs(zi, block)`, `project`, `unproject`, `distKm`, `zipRings(zi)`,
`zipBBox(zi)`, `zipAt(x, y)` (a 2-unit raster of the ZIP shapes, then exact polygon tests), `homeFor(zi, h)`,
`roadsNear`, `placesNear`, `landmarksNear`, `zipsNear`, `firesOf(zi)`, `arsOf(zi)`, `windsOf(zi)`, `femaOf(zi)`,
`weatherAt(zi, t)`, `climateAt(zi, t)`, `search(text)`.

## 3. How a person is made

### 3.1 The generator

`Population [xy]` (line 11505) is built on the world with one seed, `1849` (`Vd`; the page never changes it). It makes
**households**, not loose persons: `z.hh[zi]` households for each ZIP, numbered `h = 0 ... hh - 1`, and the members of
each, numbered `m = 0 ... size - 1`. Everything about a household is a pure function of `(seed, zi, h)`; nothing is
stored, nothing depends on what was asked for before, and the same id gives the same person on every load and in the
worker (the page checks six people of every worker build against its own generator and refuses the build if one differs).

- **Id**: `"<ZIP>-<h>-<m>"`, for example `90012-12435-1`; a household is `"<ZIP>-<h>"`. `parseId [Ay]` reads it. In the
  crowd arrays the same id is one 32-bit number `zi << 20 | h << 4 | m` (the largest ZIP has 32,594 households, so it
  always fits).
- **How many**: 13,547,871 households; their members add up to about 38.4 million. The 39,286,245 of the title is the
  Census population; the difference (about 0.87 million) is people in group quarters (dormitories, barracks, prisons,
  nursing homes), who are **not generated**: 90012 has 37,336 residents and 29,498 generated people because the county
  jail is there. 35 ZIPs have no household and no people.
- **Fitting** (`_core(zi)`, built once per ZIP in 3 to 40 ms): household composition is fitted so that the generated
  ZIP reproduces its ACS tables: household type and size, the age and sex pyramid (after taking out group quarters),
  tenure by type and age, dwelling by tenure, vehicles by tenure and size, race and heritage (Hispanic origin, Asian
  origin, ancestry), school enrolment, employment and occupation by sex, means and time of travel to work. ZIPs with
  small tables borrow from their county. The place panel's "fidelity" table (`services.validate(zi, n)`) shows generated
  shares beside the ACS shares.
- **`householdCore(zi, h)`** (about 10 microseconds): `{ zi, h, id, size, type, tenure, dwelling, vehicles, home, heritage,
  members[] }`. `type` is `married | father | mother | alone | roommates`; `tenure` `own | rent`; `dwelling`
  `house | small-apartment | apartment | mobile-home`; a member has `m, role, sex, age, heritage, worker, military, occ,
  student, mode, commuteMin, departMin, dwellMin, days, workDays, workZi, work {x, y}, shift`.
- **`person(zi, h, m)`** / `get(id)` (about 0.4 ms the first time, then from a cache of 8,192): the full person, below.

### 3.2 What a person has (`services.npc(id)`, and `__LEGION__.npc(id)`: the same object)

| field | values |
|---|---|
| `id`, `hid`, `zip`, `zi`, `h`, `m`, `seed` | identity |
| `role` | `householder spouse partner child grandchild parent sibling relative roommate` |
| `sex`, `age`, `birthYear`, `pronouns` | `M`/`F`; age in 2026 |
| `name` | `{ first, last, full, display, nick }`, drawn from name tables by heritage, sex and birth decade |
| `race`, `heritage`, `heritageLabel`, `origin`, `nativity`, `generation`, `arrivalYear`, `birthplace`, `mainlandYear` | for example `asian`, `Asian American`, `foreign`, 1, 1974, `New Delhi, India` |
| `languages` | `{ home, english: only/well/limited..., list[] }` |
| `education`, `school`, `status` | `nohs ... doctorate`, `child`, `in school`; status `employed retired student unemployed ...` |
| `occupation` | `null` or `{ key (25 ACS groups), title, sector, employer, shift }`, for example School counselor, Education, a middle school, day shift |
| `income`, `householdIncome` | dollars a year |
| `marital`, `veteran`, `parents[]` | `never married separated absent widowed divorced`; parents are member numbers |
| `commute` | `{ mode, minutes, departMin, dwellMin, days (bit per weekday, bit 0 = Sunday), workDays, workZi, workZip, workCity, work {x, y}, road }`; `mode` is `drive carpool bus rail ferry taxi motorcycle bike walk other wfh` or `null`; `departMin` is minutes after midnight; `road` is the state highway the drive would take, if any |
| `household` | `{ id, size, type, tenure, dwelling, vehicles, yearMoved, yearBuilt, home { x, y, lat, lon }, members[{ m, role, name, first, age, sex }] }` |
| `place` | `{ zip, city, place, neighborhood, countyName, countyFips, region, regionName, province, zone }` |

Students get a school trip (three school sites per level in a ZIP, placed by the generator, not real schools); workers
get a work ZIP and a work point (sites placed from the ZIP's business counts; military members go to the bases; some
work from home, `mode: 'wfh'`); college students get a campus ZIP.

**Persona** (`services.persona(id, { t })`, about 0.6 ms, version 2, changes by the hour only in what depends on the
weather): `big5` (O, C, E, A, N from 0 to 1, "from age, sex, region and individual chance; never from heritage"),
`traits`, `archetype`, `values` (Schwartz), `interests` + `interestDetails` (each with the datum behind it), `teams`,
`practice`, `concerns` (section 6), `memories` (section 6), `knowledge` (neighborhood, landmarks, roads, nearby places,
weather records), `speech` (dialect, register, code-switching language and rate, fillers, catchphrases), `bio` (two or
three sentences), `hooks`, `residence` (`zipSince`, `countySince`, `bornHere`, `grewUpHere`), `roof` (section 6),
`routine` (the places of their week: grocery, pharmacy, park, gym, beach, family, church), `kin`.

### 3.3 The day plan

`schedule.dayPlan(npc, persona, t)` gives the local day of `t` as a list of legs, and `schedule.activityAt(...)` the
leg at `t`: `{ start, end (epoch ms), startMin, endMin, kind, place { kind, x, y, label }, mode, travel, from, label,
progress, traveling, position { x, y } }`. `kind` is `sleep home work school errand leisure exercise worship visit`;
travelling legs carry `travel: true`, the `mode` and `from`. The NPC panel's line "Now: At work in Los Angeles · until
4:57 PM" is `activityText [pI](activityAt(...))`. The plan uses the person's commute (same mode, departure, length and
dwell as section 3.2) and adds sleep, meals, errands, exercise, school runs, family outings and worship from the persona.

### 3.4 Where a home is

A home is **a point**, never a building or an address: `World.homeFor(zi, h)`, a point drawn uniformly inside the ZIP's
outline (from the 2-unit raster of the shape). In sparse ZIPs (under 500 people per square mile and over 12 square
miles) 72 percent of homes are drawn in a bell around the ZIP's town point or around a Census place inside the ZIP.
So a home can fall in a park, on a freeway or on a hillside; it knows nothing of streets or footprints. Legion's own
street view repairs this for the block it shows (section 5.2); section 10.3 gives the tie to real footprints.

### 3.5 Listing, finding, asking where

| question | Legion's own call | library |
|---|---|---|
| the people of a place, in order | `for h < householdCount(zi)`, `for m < householdSize(zi, h)`: `person(zi, h, m)` | `npcsOf(zip, { limit, offset })` |
| the twelve the place panel shows | `services.residents(scope, 12, page)` = `Population.sample(zi, 12, page)`: a draw weighted by household size, seeded by the page number | `npcsOf(zip, { sample: true, limit: 12, page })` |
| one person | `services.npc(id)` | `npc(id)` |
| where at time t | `services.activityAt(id, t)` (the day plan), or `crowd.positionOf(id)` for a person in the drawn sample (the crowd model, section 4) | `whereIs(id, t)`, which gives the day plan's answer and, in `.crowd`, the crowd model's when the ZIP is built |

## 4. The simulation

There is **no stepping simulation of the state**. The moving crowd is a closed formula: a person's packed plan and the
time give their state and place. Any time can be asked in any order, at the same cost.

### 4.1 An agent (32 bytes; `crowdGen [NE]`, line 77874, class `vE` line 77560)

For every member of every household taken into the sample (`Population.includes(zi, h, rate)`: a hash of
`(seed, zi, h)` below `rate`, so a higher rate always contains the lower one), the builder writes:

| array | type | content |
|---|---|---|
| `ids` | Uint32 | `zi << 20 | h << 4 | m` (sorted within a ZIP, so a person is found by bisection) |
| `home`, `dest` | Uint16 x 2 | home and work or school point, as 1/65535 of the world's width and height (14 m east-west, 16 m north-south) |
| `timing` | Uint16 x 3 | `departMin`, `commuteMin` (at most 360), `dwellMin` |
| `days` | Uint8 | weekday bits of the commute (0 = no commute: no job, works from home, no destination) |
| `mode` | Uint8 | commute mode code 0 to 11 (`null drive carpool bus rail ferry taxi motorcycle bike walk other wfh`), bit 16 = school trip |
| `route` | Uint16 x 3 | for drivers: state highway line + 1, entry and exit along it; 0 = no highway |
| `errand` | Uint32 | one errand: start minute, stay, weekday bits, by car or on foot, repeats, lane and curve bits |
| `eoff` | Int8 x 2 | where the errand is, as an offset from home in quarter units (at most 6 km) |

plus `pick`, a compressed index of which agents can ever be in which 32-unit cell (for picking under the pointer),
about 3.2 bytes an agent.

### 4.2 State and place at a time (`agentAt [zE]` line 78128; `Bg`, `O3`)

Input: `minute` (minute of the day in Pacific time, with a fraction) and `dow` (0 = Sunday), from `minuteDow [L3](t)`.

- **State**: `home`, `to-work`, `at-work`, `to-home` (from the commute: out at `departMin`, `commuteMin` long, stays
  `dwellMin`, the same back; night shifts wrap past midnight), else `to-errand`, `at-errand`, `from-errand`, else `home`.
  Outside the commute and the one errand everybody is at home: the crowd model has no lunch, no evening out, no visits.
- **Kind** of a mover (what the map colours): `walk` (walk, other), `drive` (drive, carpool, taxi, motorcycle), `bike`,
  `transit` (bus, rail, ferry), `errand`; `home`.
- **Place**: at home, at the destination, or on the way. On the way is a quadratic curve from home to destination
  (bent sideways by 8 percent of its length, to one side by a per-person bit, and shifted to a lane 0.03 to 0.4 units to
  the right), run at constant speed over `commuteMin`. Drivers with a `route` go in three parts: a straight line to the
  highway (at 40 km/h with a 1.3 detour factor), **along the real highway polyline** (at the line's speed, slowed to as
  little as 30 percent in the weekday peaks around 07:45 and 17:15), and a straight line to the destination.
  Errands are a curve to the errand point and back (4.8 km/h on foot, 24 km/h by car).

**The crowd does not follow streets.** Only the 197 state highways are real lines. A person "driving to work" at
street scale is a dot gliding along a gentle curve across blocks. Speeds follow from distance over time: the test saw 2
to 66 km/h. This is the main thing the Scout Engine has to supply itself (section 10.4).

### 4.3 The worker (`window.__LEGION_WORKER_SRC__`, an IIFE of its own with the world, the population and the builder)

One message in, messages out (`self.onmessage`, worker line 13913):

| in | out |
|---|---|
| `{ type: 'prepare', pack, popSeed }` | `{ type: 'prepared', ms }`: unpacks the pack, builds world, population, road net and raster |
| `{ type: 'build', id, rate, seed, popSeed, focus, zips, regions, chunkTarget, firstChunkTarget, pack }` | `loaded {ms}`, then `chunk { chunk, progress }` (arrays transferred) and `progress`, then `done { summary }`, or `error { message }`. `zips: null` = the whole state, ordered outward from `focus` |
| `{ type: 'topup', id, zips, rate, below, seed, popSeed }` | `topchunk`, `topdone { summary }`, `toperror`: the households of those ZIPs with hash in `[below, rate)` |
| `{ type: 'stats', seq, minute, dow, t }` | `{ type: 'stats', seq, stats, t }`: counts by state and kind over what it built |
| `droptopup`, `adopt { chunks }`, `cancel` | none |

A worker runs one build at a time (a new `build` ends the one before). `Crowd [$g]` (line 78806) runs a pool of
`min(4, hardwareConcurrency - 1)` (2 on devices with under 4 GB), started before the page has unpacked its own pack
(`prewarmCrowd`), and falls back to building on the main thread (`_buildOnMain`, the same generator in slices of 8 ms).

### 4.4 Level of detail: how 39 million becomes what is drawn

- **The statewide sample**: `settings.density`, one of 0.5, 1, 2.5 (default), 5 or 10 percent of households, at most
  5 million agents. At 2.5 percent: 961,346 people in 338,984 households, 36 chunks; 575,398 commute, 140,956 by a
  state highway, 823,912 have an errand.
- **Top-up** (`Stage._maybeTopUp`, `Yg`): when the view is narrower than 60 km, the ZIPs in view are raised to
  `min(1, density + budget / people in those ZIPs)`, budget 1,500,000 agents (250,000 on a software renderer); dropped
  again when the view passes 90 km. At street scale that is every resident of the ZIPs in view. People of other ZIPs who
  work in or pass through the view stay at the statewide rate.
- **Drawing thinning**: `crowd.keep` (1 down to 0.05) drops a hash-chosen share of points when frames run long
  (more than 26 ms for 40 frames), and at once on a software renderer (to about 300,000 points).
- **Cache**: the built chunks are kept in IndexedDB `legion-crowd` under `legion-<build>|rate|seed|popSeed` (not over
  4 million agents) and checked against the generator when read back.
- The street view (section 5.2) is the third level: every resident of a 1.2 km square, each with their day plan.

### 4.5 The clock (`Clock [Zv]`, line 82190)

`{ t (epoch ms), t0, speed, playing }`; `speed` is simulated milliseconds per real millisecond: 1, 60 (default: a minute
a second), 600 or 3600. `advance(realMs)` is called from the page's frame loop; `set(t)`, `setMinuteOfDay(m)`, `pause()`,
`play()`, `hold(1)` (while talking), `parts()` (Pacific date parts), `subscribe(fn)`. It starts at the snapshot time,
2026-11-23 14:38:55 Pacific (a Monday). The crowd reads only minute of day and weekday, so every Monday is the same
Monday; the day plan and the weather read the date as well.

### 4.6 What it costs (measured here: headless Chromium, software GL, the JavaScript at native speed)

| step | time | memory |
|---|---|---|
| unpack the pack and build the world (page) | 0.3 to 0.5 s | about 30 MB of heap, 40 to 70 MB with typed arrays before collection |
| one worker after `prepare` | 0.25 to 0.5 s | about 50 MB (24 MB heap + 25 MB arrays) |
| statewide sample, 2.5 percent | 4.6 to 8 s on three workers; 7.3 s on one | 32 bytes an agent on the page (31 MB) + 3 MB index; 14 bytes an agent kept in the workers for counts |
| one ZIP at rate 1 (90012: 29,498 people) | 0.2 s in a worker | 35 bytes a person |
| state of one agent | about 60 ns; 1.3 million agents counted in 0.2 to 0.28 s | none |
| `householdCore` / `person` / `persona` / `activityAt` / `dayPlan` | 0.01 / 0.4 / 0.6 / 0.15 / 0.02 ms | caches of 2,048 households, 8,192 people, 512 personas |

Drawing is one `drawArrays(POINTS)` per chunk; the vertex shader computes each point's place from the same formula
(`W3`, the GLSL twin of `agentAt`), so the cost per frame is on the graphics card, not in JavaScript.

## 5. The map and the street view

### 5.1 The map (`MapView [Sv]`, line 75990; `Stage [e1]`, line 82914)

- A WebGL2 canvas (falls back to a 2D canvas) plus a 2D canvas for labels, inside `#map`. Camera `{ x, y, zoom }` in
  world units (`zoom` = CSS pixels per unit; `fitState()` is about 0.106 on a 1000-pixel window; the stage flies to at
  most 40 to 60 pixels a unit, where one pixel is 3 to 5 m).
- Base layers: the state outline, neighbours, water, county lines, the 1,762 ZIP outlines (fills by scope), the 197
  highways as lines, labels of places and landmarks by zoom. No basemap tiles, no streets, no buildings.
- People: `gl.POINTS`, one per agent, 1.25 to 7 pixels by zoom, coloured by class: walking, driving out, driving home,
  cycling, transit, errand, at home (smaller and faint). `crowd.setVisible({ walk, drive, bike, transit, errand, home })`
  is the legend's filter. At night the map is shaded and moving points glow. There are no vehicle shapes on the map:
  a car is a dot.
- Picking: `crowd.pick(x, y, radius)` through the cell index gives the nearest agent (`id`, `state`, `mode`, `kind`,
  `x`, `y`); `crowd.positionOf(id)` the place of one person; `crowd.gpuEval` reads places back from the card
  (transform feedback), used by the page's own checks.

### 5.2 The street view (`street.StreetView [lE]`, line 74610; scene `wB`, line 70130; simulation `fv`; renderer `wv`)

- Opened on a point (`open(x, y, { radiusM: 600 })`): a square of 1.2 km in **local metres** around it (frame `us`:
  `fx`, `fy` metres per world unit, `toWorld`), drawn top-down on a **2D canvas** in tiles, with pan, zoom and follow.
- Streets and buildings: generated from the ZIP's character (density, year built, dwelling mix, business counts,
  relief: grid, tract or curving styles; `source: 'procedural'`), or, when the user has allowed OpenStreetMap
  (`settings.network.osm`), real ones from **Overpass** (`way["highway"]` and `way["building"]` in the box; kept in
  `localStorage` `legion.osm.v2.<tile>` by 0.01 degree tile; `source: 'osm'` when at least 4 street edges come back).
- People: every household whose home point is in the square (the test saw 2,404 households and 5,033 residents in
  downtown Los Angeles, 316 residents in Mammoth Lakes). Each household is given a building: households in a fixed
  hash order take the nearest building of their dwelling kind with a unit free, within 250 m (`gB`, line 69689; a house
  holds one, apartments share the apartment households by floor area). Section 10.3 is this rule made independent of
  the view.
- Movement: here there is a real stepping simulation (`fv`): residents follow their **day plan** (section 3.3) on the
  street graph (router `ev`), cars with turn signals, stop signs and signals, parked cars on driveways and kerbs, people
  on sidewalks who stop and exchange lines (`bark`, drawn as bubbles). People are drawn as small figures, vehicles as
  top-down car shapes with head and tail lights, roofs as polygons, trees, street names, rain or snow and cloud shadow
  from the weather at the time. Residents of the square who are elsewhere are simply absent (the panel says so).

## 6. The voice, and what people know about weather, wildfire and homes

### 6.1 Built in (no network; `dialogue [Hb]`, line 29593; templates in English and Spanish, with glosses)

- `new dialogue.Conversation({ world, persona, mind, t, population, rngSeed })` with `greet()`, `reply(text)`,
  `farewell()`; each returns `{ text, gloss, intent, topics, emotion, facts }`. `reply` first reads the player's text
  (`understand [vb]`: 33 intents, among them `weather traffic fire storm heat housing rent insurance earthquake home
  neighborhood job family history`), then answers from the persona: every figure in an answer is the person's own
  attribute or their ZIP's datum, and `facts` names it (`fire:Eaton:2025`, `npc.household`).
- `dialogue.bark(world, persona, { situation, t })`: a passing remark for `pass wait weather alert traffic work home`;
  `barkBetween` gives a line and its answer for two people who meet.
- Lines come out in the person's dialect and register, with code-switching for people who speak another language at
  home (Hindi, Spanish, Cantonese and others: the `text` then carries the other language and `gloss` the English).
- A safety layer answers self-harm, abuse and threats with fixed notes (988, 911) and ends the talk; children's
  answers are restricted.
- `mind [kS]`: mood, needs, a memory stream and the relationship with the player, kept per NPC in
  `localStorage['legion.mind.<id>']` once the user has talked with them.

### 6.2 Claude (optional, off by default; `llm [Cx]`, line 47688)

Only when the user turns on "Claude API" under Network in Legion's settings **and** enters their own key there (or the
page is served by Legion's own server, which proxies at `/api/anthropic`; a page opened from a file never asks for
`/api/health`). Then a turn is `client.beta.messages.stream({ model, max_tokens, system, messages, output_config: { effort } })`
to `https://api.anthropic.com` straight from the browser (the bundled Anthropic SDK with `dangerouslyAllowBrowser`).
What is sent: two system blocks (Legion's rules for an NPC, and the character sheet: the persona of section 3.2 as text),
the conversation so far, the player's words, and a "situation" block (time, weather at the ZIP, what the person is
doing, memories recalled). After a talk, one `beta.messages.create` with a JSON schema writes a reflection into the
NPC's mind. Models offered: `claude-opus-5-5` (default), `claude-sonnet-5-5`, `claude-haiku-5-5`, `claude-fable-5-2`;
effort `low` (default), `medium`, `high`. The key lives in memory in the `Settings` object; it is written to
`localStorage['legion.claude.apiKey']` only if the user ticks "remember". Nothing of the dashboard is sent.
**The library never touches this path**: it has no call that takes, returns, stores or sends a key, and `say()` uses
the built-in voice only. The Claude voice is reached only inside Legion's own mounted view, by the user.

### 6.3 Weather, wildfire, roofs, insurance: what a person knows and says

All of it is the dashboard's own ZIP data, turned into a person's knowledge. Useful as it stands for a roofing page.

- **`persona.roof`** (owners of a house, a mobile home or a small apartment building; `null` for renters and big
  buildings): `{ age, material, solar, installed, original, why }`. Age: with the ZIP's share of roofs 20 years or older
  (`ra20_sh`) it is 20 to 33 years, else around the ZIP's median roof age (`roof_age`), never older than the house.
  Material: drawn from the ZIP's `tile_sh`, `wood_sh`, `metal_sh` (55 for a mobile home), the rest composition
  shingle. Solar: `solar_sh`. Seeded by `(zi, h)`: one roof per household. Example (93546-4-0): composition shingle,
  22 years, redone 2004, "an estimated 27.9% of single-family roofs in 93546 are 20 or more years old (ra20_sh)".
- **`persona.concerns`**: up to six of `insurance fire smoke heat storms flooding wind power shutoffs snow housing rent
  commute roof earthquakes jobs water health schools family abroad`, each with a weight and the data behind it in words,
  with the column names: "8.8% of residential policies up for renewal in 93546 were not renewed in 2023 (nonren_sh);
  there are 15.5 FAIR Plan home policies per 100 homes here (fair_sh); the average homeowners premium here was $3,055
  in 2023 (prem)"; "a 351 psf design ground snow load at 2672 m (snow_psf, elev_m)"; "48% of 90012 is in a very high
  fire hazard severity zone (fhsz_vh)"; "a wood shake roof in a fire hazard zone".
- **`persona.memories`**: life events plus the ZIP's and county's record, each with its source: fires
  (`firesOf(zi)`: name, date, distance, acres, structures lost in the ZIP), storms (FEMA declarations; atmospheric
  rivers with their rank at the nearest coast point), wind events (Santa Ana, Diablo, sundowner: strongest gust and
  where), heat and rain records of the nearest station, and for owners "had the roof redone in 2004".
- **`persona.knowledge.records`**: record heat, one-day rain and gust with station, date and distance.
- **Weather now** (`World.weatherAt(zi, t)`): the NWS snapshot of 2026-11-23 for the nearest of 11 forecast points in
  the ZIP's office within 80 km, carried for height (3.5 F per 1,000 ft) and nudged by the nearest of 33 stations; alerts for the
  ZIP's zone or county; the office's key messages; fire-weather and excessive-rain outlook levels for the county.
  Outside the three forecast days it is a climate estimate from the ZIP's July temperature, latitude, height, distance to
  the coast and rain (`climateAt`), flagged `stale` and `climate`. With `settings.network.nws` on, Legion fetches
  `api.weather.gov` for a ZIP when its panel opens (`weather.LiveWeather`; an answer is kept 15 minutes).
- **Said** (the built-in voice; the test page has these word for word): on fire, "I was here for the Pack Fire, back in
  2025. I packed the car and waited for the evacuation order."; on insurance, "A lot of people around here got dropped
  and ended up on the FAIR Plan. About 16 in every 100 homes here are on it."; on the roof, "The roof was redone in 2004,
  before we bought it." / "The roof's original. That's on my list."; on storms, "The big one was early December 1966. A
  category 4 atmospheric river."; on heat, "we get about 89 days over 100 a year"; in snow country, "The roofs up here
  are built to hold 351 pounds per square foot of it." Renters answer as renters ("I rent, so I don't know much about
  that."). Legion's atmospheric-river "category" is the dashboard's AR rank.

What they do not know: their own roof's real condition, any real permit, claim, contractor or address; nothing about
hail beyond the ZIP's counts; nothing of the dashboard's service lines or prices.

## 7. Everything Legion touches outside itself

| kind | what | when |
|---|---|---|
| network | `https://api.weather.gov` (points, forecast, hourly, alerts) | only with `settings.network.nws` on, per ZIP opened |
| network | `https://overpass-api.de/api/interpreter` (POST, streets and buildings of a 1.2 km square) | only with `settings.network.osm` on, when a street view opens |
| network | `https://api.anthropic.com` (or `/api/anthropic` on Legion's own server) | only with `settings.network.claude` on and a key entered by the user |
| network | `/api/health` | only when the page is served over http(s) and `network.claude` is on |
| localStorage | `legion.settings.v1` `{ density, theme, claude { model, effort, remember }, network { claude, nws, osm } }` | on any settings change; read by the head script and at boot |
| localStorage | `legion.claude.apiKey` | only if "remember" is ticked |
| localStorage | `legion.mind.<id>`, `legion.mind.__index` | after talking with an NPC (at most 400) |
| localStorage | `legion.osm.v2.<lat>_<lon>` (and it clears `legion.osm.v1.*`) | street data from Overpass |
| IndexedDB | database `legion-crowd`, stores `builds` and `chunks` | after each crowd build |
| globals read | `window.__LEGION_PACK__`, `window.__LEGION_WORKER_SRC__` | boot, workers |
| globals written | `window.legion` (frozen: `services bus settings clock stage placePanel npcPanel dialog world map crowd street build select(id) place(zip)`) | end of boot |
| document | `<html data-theme data-state>`, `<meta name="theme-color">`, `<body data-place-open data-npc-open data-street-open>`, `document.title` is not changed | boot, panels |
| document listeners | `keydown` on `document` twice (Space plays and pauses, `/` focuses the search, Escape closes), `error` and `unhandledrejection` on `window` (any error becomes a toast), `resize`, `hashchange`, `pointerup` | boot, never removed |
| location | `history.replaceState` writes `#zip=...&npc=...`; the hash is read at boot and on `hashchange` (`zip place neighborhood city county region npc`) | every selection |
| frames | one `requestAnimationFrame` loop that never ends; `matchMedia('(min-width: 1180px)')`, `(prefers-color-scheme)`, `(prefers-reduced-motion)` | boot |
| graphics | one WebGL2 context (map), 2D canvases (labels, overlay, street view, colour parsing) | map, street view |
| workers | up to 4 `Worker`s named `legion-crowd` from a blob URL | boot |
| DOM ids | the 21 of section 1, and made at run time: `npc-name`, `npc-tab-<k>` and `npc-tabpanel-<k>` for `profile mind talk prompt json`, `settings-title-<n>`, `speed-<n>`, ids of form controls by counter | |

With default settings the test harness (which refuses and lists every request that is not `file:`, `blob:`, `data:` or
`about:`) saw **no request at all** from the original, the patched page, the library or the mounted view.

## 8. Legion as a library: `window.__LEGION__`

`port_legion.py <Legion.html> <out dir>` cuts the page into its parts and changes the bundle in three places and no
others (it also proves that undoing the three gives the original bundle back, byte for byte):

1. the boot call at the end becomes `window.__LEGION_EMBED__ ? __LG_API__() : goe()`;
2. `function __LG_API__(){...}` (`legion_api.js`, 37 KB) is added before it: a declaration, run only when called;
3. the seven storage names go through `__LGK(name)`, which returns the name unchanged unless
   `window.__LEGION_STORAGE__` is set. With `'cg.legion'`: `legion.settings.v1` becomes **`cg.legion.v1`**, and
   `legion.claude.apiKey`, `legion.mind.`, `legion.osm.v2.`, `legion.osm.v1.`, IndexedDB `legion-crowd` become
   `cg.legion.claude.apiKey`, `cg.legion.mind.`, `cg.legion.osm.v2.`, `cg.legion.osm.v1.`, `cg.legion.crowd`.

With both flags unset the patched page is the original: `test/out/same.txt` (37 comparisons of the two pages run the
same way: crowd of 961,346 and its counts at 08:00, four people's places, the place panel, the NPC panel and its Mind,
Prompt and JSON tabs, a built-in talk, the settings dialog, storage keys `legion.*`, IndexedDB `legion-crowd`, the
street view's scene, no request, no error).

### 8.1 Putting it in the page

`out/legion.embed.html` is the block for the host page (5,332,400 bytes; the dashboard is 20,175,834 today):

    <script>window.__LEGION_EMBED__=true;window.__LEGION_STORAGE__="cg.legion";window.__LEGION_PARTS__={build,css,markup};window.__LEGION_LOAD__=function(){...}</script>
    <script>window.__LEGION_PACK__="..."</script>                 2.0 MB, a string: not decoded until ready()
    <script>window.__LEGION_WORKER_SRC__="..."</script>           0.5 MB, a string
    <script type="text/plain" id="cg-legion-bundle">...</script>  2.75 MB, text: not parsed at page load

`window.__LEGION_LOAD__()` runs the bundle on first use (0.26 s here) and resolves to `window.__LEGION__`. Nothing else
of Legion runs at page load. The bundle text stays in the page once; `mount()` hands the same text to its frame.
(The parts are also written one by one: `legion.pack.js`, `legion.worker.js`, `legion.bundle.js`, `legion.css`,
`legion.markup.html`, `legion.parts.js`.)

### 8.2 The calls

Times are epoch milliseconds, a `Date` or an ISO string; left out, the library's clock. Places are ZIP strings.
Coordinates are WGS84 degrees. A box is `[west, south, east, north]`, `{ west, south, east, north }` or Leaflet bounds.
Every call but `ready`, `crowd`, `crowdBase` and `mount().ready` answers at once. Calls before `ready()` has resolved throw.

| call | returns |
|---|---|
| `ready({ workers = 1 })` | `Promise<{ ready, version, build, compiled, snapshot, places 1762, people 39286245, households 13547871, seed 1849, workers, ms { unpack, world, workers, total }, synthetic }>`. Decodes the pack, builds world and population, starts the worker(s). Safe to call again (same promise). `workers: 0` builds on the page's own thread |
| `isReady`, `info`, `version`, `build`, `NOTICE` | state; `NOTICE` is the sentence every surface must carry |
| `places()` | array of 1,762, in the dashboard's ZIP row order: `{ id, zi, zip, city, place, neighborhood, county, countyFips, region, lat, lon, pop, households, housingUnits, sqmi, bbox [w, s, e, n] }` (`id === zip`) |
| `place(zip)` | one of those; throws on an unknown ZIP |
| `placeAt(lat, lon)` | the place whose outline holds the point, or `null` (sea, other states); 2 microseconds |
| `npcsOf(zip, { limit = 24 (max 500), offset = 0, full = false })` | `{ place, total, households, offset, limit, sample: false, people[], synthetic }`: the people in household order, `total` of them. A brief person is `{ id, household, name, age, sex, role, heritage, status, job, size, tenure, dwelling, yearBuilt, lat, lon, synthetic: true }`; `full: true` gives section 3.2's objects |
| `npcsOf(zip, { sample: true, limit = 12, page = 1 })` | the same shape, `sample: true`, `offset: null`: the people Legion's place panel lists (page 1 first; its "Others" button is the next page) |
| `npc(id)` | the person of section 3.2, or `null`. The object is Legion's cached one: do not change it |
| `household(id)` | `{ id, zi, h, zip, size, type, tenure, dwelling, vehicles, heritage, income, yearMoved, yearBuilt, home { x, y, lat, lon }, members[] }` or `null`; takes a household id or a person id |
| `whereIs(id, time)` | the day plan's leg at that time: `{ id, t, kind, label, text, traveling, mode, lat, lon, x, y, heading, from, to, start, end, progress, crowd }` or `null`. `text` is the NPC panel's "Now" line without "Now: "; `from` and `to` are `{ lat, lon, x, y, label, kind }`; `heading` is degrees clockwise from north, from `from` to `to`, when travelling; `crowd` is the crowd model's answer for the same person (a `crowd()` person, below) when their ZIP is built, else `null` |
| `plan(id, time)` | the legs of that local day, each as `whereIs` gives them (without `id`, `t`, `crowd`) |
| `trip(id)` | the commute: `{ id, mode, vehicle, home { lat, lon }, work { lat, lon } or null, workZip, workCity, departMin, minutes, dwellMin, returnMin, days [0..6, 0 = Sunday], road, vehicles, synthetic }` |
| `crowd(box, time, { max = 2000, only = 'all', rate, budget = 400000, visitors })` | `Promise` of the `crowdNow` answer, after building what the box needs: every ZIP whose bounding box meets it, at rate 1 if their people fit `budget`, else at the highest of 0.5, 0.25, 0.1, 0.05, 0.025, 0.01 that fits. `visitors: true` also builds the statewide sample first |
| `crowdNow(box, time, { max, only, visitors })` | at once, from what is built: `{ t, minute, dow, bbox, zips[], missing[] (ZIPs not built), rates { zip: rate }, visitors (rate or null), found, counts { total, home, atWork, atErrand, walk, drive, bike, transit, errand }, estimate { ... }, truncated, people[], synthetic }`. `counts` are the people found in the box (every state, before `only` and `max`); `estimate` weights each by 1 / its rate. A person: `{ id, lat, lon, state, moving, kind, mode, commuteMode, vehicle, heading, kmh, weight, visitor }`; `state` is `home to-work at-work to-home to-errand at-errand from-errand`; `kind` `walk drive bike transit errand home` or `null` at work; `mode` the way they move now; `vehicle` `car motorcycle bus rail ferry bike` or `null`; `heading` degrees clockwise from north and `kmh`, for movers; `weight` how many people this one stands for; `visitor` true for a person of the statewide sample whose home ZIP is not built. `only`: `'all'`, `'out'` (not at home), `'moving'`. Over `max`, people are thinned by a hash of their id (the same people stay as the box moves) and `truncated` is true |
| `crowdBase({ rate = 0.025 })` | `Promise<{ rate, agents 961346, chunks, ms, bytes }>`: the statewide sample of Legion's own map. After it, `crowdNow` adds people from elsewhere who are in the box (`visitor: true`, weight 40) |
| `describe(id, time)` | `{ id, name, meta, now, sections[{ title, rows[{ label, value }] }], bio, archetype, traits, values, interests, concerns[{ topic, weight, why }], memories[{ year, kind, text, source }], roof, hooks, text, synthetic }`. `name`, `meta`, `now` and `sections` are read from Legion's own NPC panel, drawn off screen (header and Profile tab: Who, Languages, Household, Where, Work or School); the rest is the persona. `text` is all of it as plain lines, ending with `NOTICE` |
| `say(id, topic, { time, ambient })` | `{ id, topic, asked, text, gloss, intent, topics, emotion, facts, source: 'built-in', synthetic: true }` or `null`. `topic` `'greeting'`; one of `topics` (`weather fire smoke storm wind heat roof home housing rent insurance earthquake neighborhood job family traffic history self`), asked with a fixed question (`asked`); `'bark:<situation>'` with one of `barks` for a passing remark; any other string is taken as the player's own words. Same id, topic and time: same line. Nothing is remembered and nothing leaves the page |
| `homesIn(box, { max = 5000, detail = true })` | `{ bbox, total, truncated, households[{ id, zip, h, lat, lon, size, tenure, dwelling, vehicles, type }], synthetic }`: households whose home point is in the box |
| `cellOf(lat, lon)` | `{ key, bbox }`: the cell of the fixed statewide lattice (2 world units, about 395 m) holding the point |
| `housing(cellKey, buildings, { strict })` | section 10.3: `{ cell, bbox, households, units, housed, unhoused[], vacant, byBuilding { id: { households[], units, over } }, byHousehold { hid: buildingId }, synthetic }` |
| `clock` (get, set) | the library's clock, epoch ms; starts at the snapshot time (2026-11-23 14:38:55 Pacific). It does not run by itself |
| `timeAt('HH:MM', base)` | epoch ms of that Pacific wall time on the day of `base` (default: the clock) |
| `timeParts(time)` | `{ year, month, day, dow, hour, minute, second, minuteOfDay, dayName, monthName, iso, label }` in Pacific time |
| `weather(zip, time)` | Legion's `weatherAt`: `{ now { tempF, rh, pop, wind, short, isDay }, period, next[], alerts[], keyMessages[], fireWeather, excessiveRain, obs, basis, source, stale, approx }` |
| `mount(host, { zip, npc, time, playing, theme, onNpc(id, source), onPlace(zip, source), onTime(t), timeout })` | a handle `{ frame, host, window, legion, ready: Promise<handle>, select(id), place(zip), setTime(t), time(), unmount() }`: Legion's whole view in a frame that fills `host` (section 8.3). After `ready`, `handle.legion` is the frame's own `window.legion` (section 7) |
| `unmount()`, `mounted` | removes the frame (its workers, graphics context, listeners and frame loop end with it); `true` if there was one |
| `settings.key` / `.get()` / `.set(patch)` | `'cg.legion.v1'`; `{ density, theme, claude { model, effort, remember, hasKey }, network { claude, nws, osm } }`, read from storage each time; `set` stores a patch of those and passes it to a mounted view. It throws if given an API key: a key is entered only in Legion's own settings dialog |
| `stats()` | `{ ready, workers, workersLive, workerPrepareMs[], zipsBuilt, zipAgents, zipBytes, baseAgents, baseBytes, queued, mounted }` |
| `dropCrowd()` | forgets every built ZIP, the statewide sample and the home and prefix caches |
| `internals` | `{ services, world, population, clock, bus, events, modules { schedule, dialogue, persona } }`: Legion's own objects, for what this table lacks (section 9 names them) |

Built ZIPs are kept up to 900,000 people (about 31 MB), oldest dropped first.

### 8.3 `mount`: a same-origin frame, and why not a scoped stylesheet

`mount` writes an `<iframe srcdoc>` (class `cg-legion-frame`, 100 percent of the host) holding Legion's own head,
stylesheet and markup from `__LEGION_PARTS__`; on its load it gives the frame the pack and worker strings (the same
strings, not copies), sets `__LEGION_STORAGE__` there, and runs the bundle text in it with the embed flag unset, so the
frame boots Legion's whole page: map, panels, search, clock, settings, street view. A `srcdoc` frame has the host's
origin (also for a page opened from a file), so the host reaches `handle.legion` directly and both share
`cg.legion.v1`.

Scoping the stylesheet under a class and resolving ids inside a host element was looked at and set aside, from the code:

- the page glue (`yoe`, line 85820) listens on `document` for every key (Space toggles the clock, `/` takes the focus,
  Escape closes) and on `window` for every error, which it shows as "Something went wrong";
- it writes the page's hash on every selection (`history.replaceState('#zip=...&npc=...')`) and reads `hashchange`:
  the dashboard routes by hash (`#rooftops`);
- it sets `data-theme` and `data-state` on `<html>` and `data-*-open` on `<body>`, and the stylesheet (44.8 KB) is
  written against those, against `html`, `body`, `:root` variables, bare element selectors and `dialog`;
- its layout switches on the **viewport** (`matchMedia('(min-width: 1180px)')` and the stylesheet's media queries):
  in a 900 pixel host on a wide page it would lay out for a wide page. In a frame the frame is the viewport;
- its frame loop never stops and nothing it adds is ever removed: there is no way to unmount it but to destroy its document.

A frame costs a second copy of the world and of the code while it is mounted (measured below) and gives a clean
unmount and no collisions at all. The test page has its own `#map` (Leaflet), `#stage`, `#topbar`, `#toasts`, global
styles, hash and storage key: all untouched (`test/out/mount.txt`).

### 8.4 Measured (test page; headless Chromium with software GL)

| | time | page memory | workers |
|---|---|---|---|
| page load with the block | no measurable change (three string assignments) | +8 MB (the strings) | 0 |
| `__LEGION_LOAD__()` | 0.26 s | +5 MB heap (+11 MB with tables) | 0 |
| `ready()` | 0.5 s | +30 to 60 MB | 1 (about 50 MB) |
| `crowd()` first time in a box | 0.03 s (Mammoth Lakes, 1 ZIP) to 0.6 s (downtown Los Angeles, 5 ZIPs, 157,000 people) | 35 bytes a person | |
| `crowd()` / `crowdNow()` again | 0.4 ms (Mammoth) to 9 to 20 ms (5 ZIPs at rate 1) | none | |
| `crowdBase()` | 6.6 to 7 s on one worker | +34 MB | |
| `crowdNow(whole state)` over 1.3 million | 0.2 to 0.28 s | | |
| `npc` 0.43 ms (0.002 again), `whereIs` 0.7 ms, `plan` 0.02 ms, `trip` 0.002 ms, `describe` 0.4 ms, `say` 4 to 7 ms, a bark 0.5 ms, `npcsOf(24)` 3.6 ms, `homesIn` (148,000 households) 0.13 s then 4 ms | | | |
| `mount()` to ready | 1.2 s, then 5 s for its crowd | +20 MB of heap, +90 to 140 MB with arrays | +3 (about 50 MB each) |
| `unmount()` | at once | back to the level before (heap 14, 34, 14 MB over two rounds) | back to 1 |

## 9. Internal names of this build, and the text that finds each

The bundle is minified; names change with every build of Legion. `port_legion.py` finds each name by a pattern on text
that does not change (property names and string literals), asserts exactly one match, and writes `out/names.json`.
`[\w$]+` stands for any name; the captured name is in **bold** position.

| plain name | this build | what | found by |
|---|---|---|---|
| `services` | `Xa` | the one object over everything (`init npc residents persona activityAt dayPlan bark conversation weather streetView createMap createCrowd validate ...`, line 81458) | `NAME.prewarmCrowd(` |
| `bus`, `events` | `Fa`, `ka` | event bus (`on off once emit`) and its event names (`NPC_SELECT 'npc:select'`, `PLACE_SELECT`, `TIME_CHANGE`, `VIEW_CHANGE`, `SETTINGS_CHANGE`, `WEATHER_CHANGE`) | `NAME.emit(NAME.NPC_SELECT,{id:V,source:"link"})` |
| `Settings` | `Yv` | settings class | `new NAME({bus:Fa,models:` |
| `Clock` | `Zv` | clock class | `new NAME({t0:a.snapshotTime,speed:60` |
| `NpcPanel` | `s1` | the NPC panel | `new NAME({el:qa("#npc-panel")` |
| `PlacePanel` | `t1` | the place panel | `new NAME({el:qa("#place-panel")` |
| `crowdGen` | `NE` | generator of agent chunks | `=NAME(this.world,this.population,{rate:this.rate,seed:this.seed,focus:` |
| `roadNet` | `CE` | highway net for agent places | `this.net=NAME(t),this.chunks=[]` |
| `agentAt` | `zE` | state and place of an agent at (minute, dow) | `=NAME(o.chunk,o.i,this.minute,this.dow,this.net)` |
| `agentId` | `Iv` | `{ zi, h, m, id }` of an agent | `_describe(e,t,n){let o=NAME(` |
| `minuteDow` | `L3` | epoch ms to `{ minute, dow }` (Pacific) | `this.t=+e;let t=NAME(this.t)` |
| `modeNames`, `stateNames`, `kindNames` | `ks`, `I3`, `Mv` | the three name tables of section 4 | `commuteMode:NAME[r],state:NAME[n.state],school:...,kind:n.kind>=0?NAME[` |
| `persona mind schedule dialogue llm street weather` | `iS kS N_ Hb Cx hE mE` | the seven modules, each an object of named exports | `Object.freeze({persona:NAME,mind:NAME,schedule:NAME,dialogue:NAME,llm:NAME,street:NAME,weather:NAME})` |
| `activityText` | `pI` | a day-plan leg as the "Now" line | `this.services.activityAt(this.id,e),n=t.ok?NAME(` |
| `boot` | `goe` | the page boot | the last statement: `}}}NAME();})();` |
| `MindStore` | `Cv` | minds in localStorage | `.setMindStore(new NAME)` |
| `buildId` | `yI` | reads `<meta name="legion-build">` | `buildId:NAME(),getBuild` |
| `toast` | `bn` | toast into `#toasts` | `function NAME(a,{kind:e="info",timeout:` |

Not needed by the library, for whoever reads the bundle (find them by the quoted text):
`World [y1]` "not a Legion world pack"; `makeWorld [TI]`; `unpack [b1]` `startsWith("H4sI")`; `Population [xy]`
"Population needs a Legion world"; `parseId [Ay]` `/^(\d{5})-(\d{1,9})(?:-(\d{1,3}))?$/`; default seed `Vd = 1849`;
hashes `Ga`, `me`, `Pe`, `dt` (constants 2146121005, 2654435769) and the generator class `oa` (first lines of Legion's
own code, line 944); `Crowd [$g]` "Crowd needs a map, a world and a population"; chunk builder `vE` (`quantPoint`,
`errandPlan`, `packPick`); crowd constants `da` (`streetKmh:40,highwayKmh:100`); the shader source `W3`
(`agentEval(`); top-up rule `Yg` (`maxKm:60,dropKm:90,budget:15e5`); `MapView [Sv]`; `Stage [e1]` (`div.map-ui`);
`StreetView [lE]` "StreetView needs a world and a population"; street scene `wB`, households to buildings `gB`
(`unitsDemand`); Overpass query `bae` (`[out:json][timeout:`); page glue `yoe` (`window.legion=Object.freeze(`);
`residents [RF]` (`dt("residents",`); settings defaults `Jv` (`density:.025`); storage helpers `Dg yi Ss tne`.
The chunk and person field names of sections 3 and 4 are property names: they are not minified and do not change.

## 10. How the two integrations should use it

### 10.1 Common ground

- **Assembly**: put `out/legion.embed.html` into the page once (for example before `</body>`, in
  `CA/build/assemble_ca.sh`): +5.33 MB on 20.18 MB. Call `window.__LEGION_LOAD__()` and `ready()` when the user first
  turns the people on in Rooftop Scout, not at page load and not when the tab merely opens: it costs 0.8 s, 40 to
  70 MB on the page and about 50 MB in one worker. Keep `workers` at 1 unless the statewide sample is wanted quickly.
- **One clock**: Legion wants an absolute time. Keep one time for people in the Scout tab and set
  `__LEGION__.clock`; from an hour of the day use `timeAt('HH:MM', day)`. The weekday matters (commutes run on their
  days: the default day is Monday 23 November 2026); the date matters only for weather and the day plan.
- **One join**: `places()[i]` is the dashboard's ZIP row `i`; `placeAt(lat, lon)` gives the ZIP of a point by Legion's
  outlines (the dashboard's own, at 197 m a unit).
- **One rule for homes**: section 10.3, through `housing()`, on both surfaces. Never tie a household to a building
  any other way in one place and this way in another.
- **One notice**: every surface that shows a person, a household, a name, a line of speech or a count of them carries
  `__LEGION__.NOTICE` or words to the same effect, where the person is shown, not only in the method text.
- **Network**: the library makes no request. The dashboard should not turn on `network.nws`, `network.osm` or
  `network.claude` for the user; those are the user's switches inside Legion's own settings (in the mounted view).

### 10.2 The Scout map and card

1. **A statewide view by place** (zooms where ZIPs show): colour or label the dashboard's own ZIP shapes from
   `places()` (`households`, `pop`; the generated people of a ZIP are `npcsOf(zip, { limit: 0 }).total`). A click on a
   ZIP lists `npcsOf(zip, { sample: true, limit: 12, page })` with an "Others" button (`page + 1`), as Legion does,
   and can page through everyone with `limit` and `offset`. For "moving now" over the state, `crowdBase()` once
   (7 s, 34 MB) and `crowdNow([-124.6, 32.4, -114, 42.1], t, { max: 0 }).counts` (0.25 s): at 08:00 on the Monday,
   54,395 driving, 18,864 walking, 9,816 on transit, 2,405 cycling of the 961,346 sampled (times 40 for the state).
2. **A crowd layer at street zooms** (zoom 14 to 17, a box of at most a few kilometres): on `moveend`,
   `await crowd(map.getBounds(), t, { max: 600, only: 'out' })`, draw one canvas layer of dots coloured by `kind`;
   while the clock runs call `crowdNow` at most once a second and move the dots between calls by `heading` and `kmh`.
   First call in a new area 0.03 to 0.6 s (in the worker), then 1 to 20 ms. Say in the legend that the dots are people
   of the ZIPs in view (`rates`), that people from elsewhere are missing unless the statewide sample is loaded, and
   that **dots do not follow streets**: at zoom 18 and closer a moving dot crosses blocks, so stop drawing movers
   there and show homes instead (item 3).
3. **Who lives in the picked building**: `c = cellOf(lat, lon)` of the building's centre; take every residential
   building Scout has whose centre is inside `c.bbox` (load the tiles that cover it first); `housing(c.key, list,
   { strict: true })`; the card shows `byBuilding[id].households`, each through `household(hid)` (names, ages, roles)
   and each member through `describe(id)`. A building with no household shows "no synthetic household here" (vacant
   units are real: `vac_sh`). A building that is not residential, or a cell whose buildings are not all loaded, shows
   the ZIP's sample instead, labelled as the ZIP's.
4. **The person's own panel**: `describe(id, t)` gives the rows and the text; `whereIs(id, t).text` the line for now;
   `say(id, 'insurance' | 'fire' | 'storm' | 'heat' | 'wind' | 'home')` a line in their voice with its `facts`. A button
   "Open in Legion" calls `mount(host, { npc: id, zip, time: t, playing: false })` in an element of at least 900 by 600:
   the full panel (Mind, Talk, Prompt, JSON), Legion's map and street view. Talking with Claude exists only there,
   with the user's own key in Legion's own dialog.
5. **Two things on the card need care.** First, the Profile row "Location" and `household.home` are Legion's home
   **point**, which is not the picked building: when a household is shown at a building, show the building and drop
   that row. Second, `describe().roof`, the `roof` concern and what `say(id, 'roof' | 'home')` says about the roof come
   from ZIP shares, drawn per household; Scout's own roof model for that footprint is the better statement about that
   roof. On a building card leave Legion's roof out (or show Scout's and say the household "has not been told"); keep
   the lines whose facts are the ZIP's (insurance, fire, storms, heat, snow load).

### 10.3 Tying a household to a real footprint

`housing(cellKey, buildings, { strict })` is the rule, the same for the map, the card and the engine:

- The state is cut into fixed cells of 2 world units (about 395 m): `cellOf(lat, lon)` gives a cell's key and box.
- The households of a cell are those whose home point (section 3.4) is in it: `homesIn(cell.bbox)`.
- The caller gives **every** residential building whose centre is in the cell: `{ id, lat, lon, units }`, or `kind`
  (`house`, `mobile-home`, `small-apartment`, `apartment`) with `area` (square metres of footprint) and `levels` when
  it has no unit count. From Scout: `units` is the roof model's (`parcel.units` from the assessor where there is one,
  else its estimate; 1 for `cls` `sf` and `mh`), `kind` from `cls` (`sf` house, `mh` mobile-home, `mf` with 2 to 4
  units small-apartment, more apartment), `id` the footprint's own id.
- Households are taken in the order of a hash of their id. Each takes the nearest building of its own dwelling kind
  with a unit free, else the nearest building with a unit free. When every unit is taken: with `strict: true` the
  household stays without a building (`unhoused`); otherwise it goes to the nearest apartment or small apartment
  building beyond its count (`over`), never to a house. A house or a mobile home never holds more than one household.
- The answer depends only on the cell key and on the buildings given (their ids, centres and units), not on their
  order, the view, the zoom or what was asked before: the test gave the same answer twice and with the list reversed
  (`test/out/crowd.json`, `housing`: 327 households, 385 units, 58 vacant, none over, houses one each).
- From a person to their building: `cellOf(npc(id).household.home.lat, .lon)`, the housing of that cell,
  `byHousehold[hid]`.

What this honours and what it cannot: unit counts are honoured building by building, and the same building always has
the same households as long as Scout gives the same buildings for the cell. But Legion spreads a ZIP's homes evenly
over the ZIP's outline, so the number of households in a cell is the ZIP's average for that much land, not what is
built there: a cell of apartment blocks gets too few households (units stay empty), a cell of large lots or parkland
too many (they stay unhoused under `strict`). Over a ZIP the totals agree with the Census; block by block they do not.
If footprints change (a new tile source, a new building), households can move: do not store the tie, compute it.

### 10.4 The Scout Engine

The engine already makes its own traffic on real streets (`CA/engine/traffic`: freeway flow from Caltrans counts,
street cars, signals). Legion should give that traffic **who** and **when**, and the engine keeps deciding **where**:
Legion's own movement is curves across blocks (section 4.2) and must not be drawn in a world with streets.

1. **Residents and their trips, per built cell, not per frame.** When the engine builds an area, for each lattice cell
   in it: `housing(key, buildings)` (once; under a millisecond for a cell after the first `homesIn` of the ZIP), then
   for every member `trip(id)` (2 microseconds once the person is cached, 0.4 ms the first time; a cell of 300
   households is about 0.3 s once: do it in slices, or in idle time). That gives a table for the cell: person,
   building, `mode`, `vehicle`, `departMin`, `minutes`, `dwellMin`, `returnMin`, `days`, the bearing to `work`. Legion is
   not needed again until the area changes.
2. **A commute as a real trip at the engine's clock.** At `departMin` (engine clock, on a day in `days`) the person's
   car leaves their building's driveway or kerb, is routed on the engine's street graph toward the work point if it
   is inside the built area, else to the area's edge in the work point's bearing, where it leaves; at `returnMin` it
   comes in from that edge and parks. `vehicle: null` people walk (`mode: 'walk'`), ride (`'bike'`) or walk to the
   nearest major street and leave (`'bus'`, `'rail'`): those are the pedestrians. School children are in the same
   table (their `mode` is `walk`, `bike`, `bus`, `carpool` or `drive`; `work` is the school point).
   A carpool has no partner in the data: treat it as a car of its own.
3. **Parked cars and lit windows** fall out of the table: a household has `vehicles` cars, less those out on a trip;
   people are at home outside their trip (and, if wanted, outside the day plan's errands: `plan(id, t)`).
4. **Identities for the engine's own flow** (through traffic, the freeway): the engine keeps generating it from its
   counts. To put a name on such a vehicle, take people from `crowdNow(areaBox, t, { only: 'moving', visitors: true })`
   whose `vehicle` matches, nearest first, one person per vehicle until it leaves. That needs `crowdBase()` (34 MB)
   for people from elsewhere; without it only residents can be named. Call `crowdNow` when vehicles are spawned or
   once a second at most (5 to 20 ms for five ZIPs at rate 1), never per frame.
5. **Picking**: a picked car or walker gives its person id; the bar shows `describe(id)`, `whereIs(id, t).text`
   and `say(id, 'bark:traffic')` or `'bark:weather'` for a bubble. The engine's weather steps are the engine's; a
   person's remark about the weather comes from Legion's snapshot or climate estimate and may not match a storm the
   user has dialled in: use barks for `traffic`, `pass`, `work` and `home` there, not `weather`.
6. **Per frame, from Legion: nothing.** Positions, headings, lanes, signals and collisions are the engine's. The data
   Legion gives is per cell (who lives where, when they leave, by what, toward where) and per pick (the panel text).
   Memory: 35 bytes a person for built ZIPs (dropped oldest first past 900,000), plus the cell tables the engine keeps.
7. The engine's clock is an hour of the day. Choose the weekday once (Monday to Friday for a commute picture;
   Saturday and Sunday have no school and few commutes) and say which on the bar.

## 11. What Legion's data can and cannot support

- **These are synthetic people.** Each is drawn from published statistics for a ZIP area (ACS 2020-2024) and from the
  dashboard's own ZIP table. None is a record of a resident. A generated name can by chance be the name of a real
  person in that ZIP; that is chance. No surface may read as a directory, a lead list or a statement about who lives
  at an address, and none of it belongs in the account, campaign or outreach modules.
- **A household at a footprint is a placement, not a finding.** `housing()` puts statistical households into real
  buildings so that the picture is stable. Their tenure, income, ages, languages, heritage, roof and insurance worries
  are the ZIP's mix, not that building's. On a building card keep to what a reader cannot mistake for fact about the
  occupants, and keep the notice on the card. The fuller profile belongs in the person's own panel, opened on purpose.
- **Within a ZIP everything is even.** A hillside of large houses and a flat of apartments in one ZIP get the same
  mix and the same density. There is no tract, block or parcel under the ZIP in the pack.
- **Not generated**: people in group quarters (about 0.87 million), visitors, the homeless, anyone in a vacant or
  seasonal unit (a resort ZIP is as empty as its year-round households), businesses' real staff.
- **Invented points**: homes, work sites, schools, shops, parks, churches. Employers are generic ("a middle school").
  Only ZIPs, counties, places, landmarks, the 197 state highways with their traffic counts, the fires, storms, wind
  events, records and insurance figures are real data.
- **Movement** is a statement of how many are out, when, and by what means, fitted to ACS commute tables: good for
  counts by hour and for giving trips a time and a mode. It is not a traffic model: no streets, no congestion beyond a
  peak-hour slowing on highways, no transit lines, one errand a day. The day plan (panel) and the crowd model (map)
  agree on the commute and differ on the rest: of 400 people in 94110 they put the same person in the same kind of
  place 100 percent of the time at 03:00, 93 at 08:00, 73 at noon and at 17:30; commuters in both were a median 140 m
  apart (`test/out/cost.json`).
- **Weather** in the pack is one snapshot (2026-11-23) good for three days, then a climate estimate; live weather is
  the user's switch. A person's "memories" of fires and storms are the dashboard's records, said in the first person:
  the event is real, the experience ("I packed the car") is written.
- **Vintage**: the pack was made from the atlas of 2026-11-19; the dashboard's data has moved since (`zone` in
  particular). A new atlas build wants a new Legion pack (`tools/build_pack.py` in Legion's own source, which is not
  in this folder); until then the 134 shared columns read the same but for rounding.
- **The Claude voice** needs the user's own key, entered in Legion's own dialog inside the mounted view. The library
  and the dashboard must never ask for, hold, log or send one, and the tests never call that service.

## 12. Files, and how it was checked

    CA/legion/
      orig/Legion.html            the user's file, untouched
      port_legion.py              the port (python3 -I port_legion.py orig/Legion.html out)
      legion_api.js               the library, with @@names@@ the port fills in
      LEGION_CONTRACT.md, NOTES.md
      out/                        legion.embed.html (the block for the page), Legion.patched.html, the parts, names.json
      work/                       parts and pretty-printed sources for reading (decode.py, schema.py remake them)
      test/                       probe.js (harness), build_test.py (the bare host page), the s_*.js scripts,
                                  cmp.js, same.js, t_mount.js, t_leak.js, worker_mem.js, out/ (results and pictures)

| check | how | result |
|---|---|---|
| the port | anchors once each, undo gives the original bundle, `node --check` on bundle, API and parts | passes |
| patched page = original, flags unset | `s_same.js` in both, `same.js` | 37 of 37 equal (`test/out/same.txt`) |
| `ready`, `places` | `s_api1.js` | resolves in 0.5 s; 1,762 places, 58 counties, 11 regions, 39,286,245 people; `placeAt` right for Los Angeles, Mammoth Lakes, Twentynine Palms, San Francisco, `null` at sea and in Reno |
| people = Legion's own interface | `s_cmp.js` in the original (panels read from the page) and in the library, `cmp.js` | 90012, 93546, 92277: the twelve listed residents, two NPC panels as drawn (every row, "Now", bio), 94 people field for field: all equal (`test/out/cmp.txt`) |
| deterministic across reloads | the library page run twice | equal digests |
| `crowd` | `s_crowd.js` | four boxes at 03:00, 08:00, 12:00, 17:30: sensible (downtown Los Angeles box: 7,909 at home and 5 moving at 03:00; 194 moving and 832 at work at 08:00; 1,138 at work and 591 on errands at noon; 316 moving at 17:30), the same answer twice each, all inside the box, headings 0 to 360, speeds 2 to 66 km/h; statewide sample counts equal the original app's at 08:00 |
| `housing` | `s_crowd.js` | same twice, same in reverse order, houses at most one, strict never over |
| `mount` | `t_mount.js` | 32 checks: 900 by 600 beside the host's Leaflet `#map`; neither breaks the other; settings under `cg.legion.v1`; IndexedDB `cg.legion.crowd`; unmount and mount again; no page error; no request (`test/out/mount.txt`, pictures `mount_map.png`, `mount_street.png`) |
| memory and workers | `t_leak.js`, `worker_mem.js`, `s_cost.js` | section 8.4 |

Not done, or not right:

- Nothing ran on a real graphics card or in Firefox or Safari. `DecompressionStream` is required (as in Legion).
- The mounted view has not been tried inside the real dashboard page, only in the bare host page; the embed block has
  not been put through `assemble_ca.sh`.
- `housing()` was tried on made-up footprints, not on Scout's.
- The worker's memory is measured by running its source in Node, not in the browser (a worker cannot report it there).
- `describe()` reads the header and the Profile tab; the Mind tab's sections are given as persona fields, not as drawn.
- `say()` asks one fixed question per topic (`test/out/say.json`: every topic is understood). The built-in voice has no
  answer of its own for wind or smoke: `wind` is answered as a storm (the wind events of the county), `smoke` as a
  fire, and `roof` as the home (owners speak of the roof there; renters say they rent).
- `crowd()` builds whole ZIPs: a box touching a very large ZIP waits for all of it (0.2 s for 30,000 people).
- With `visitors`, people from elsewhere come only at the statewide rate (weight 40), so they look thin beside
  residents at rate 1; the `estimate` corrects counts, not the picture.
- A mounted view builds its own statewide crowd (5 s, three workers) even if the library has one: they are separate
  documents and do not share it.
