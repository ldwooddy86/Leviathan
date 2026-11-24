# Legion · module contracts

This is the shared specification every Legion module is written against. Read it whole before writing code.
Where a module's file already exists, its exported API is the contract; where it does not, this document is.

## 1. What Legion is

Legion turns the California Roofer Guru atlas (1,762 ZIPs × 365 columns: housing, language, roof age,
climate records, wildfire history, insurance, business counts; the 58 counties; ZIP and county outlines; the
NWS snapshot of 2026-11-23; the Caltrans 2024 traffic census; the USGS gazetteer) plus the Census ACS 2020-2024
tables by ZIP into **every Californian as an NPC**: 39,286,245 people in 13.5 million households, each one a
pure function of (world pack, ZIP, household, member). Nothing is stored; any of them can be materialized
instantly, the same way every time, in the browser and in Node.

On top of the people:

* a **GPU crowd** of up to several million of them at once on a map of the state, walking, driving the real
  highway network, riding transit and cycling on their own daily schedules (rush hour shows);
* a **street view**: zoom into a neighborhood and the residents of the houses there walk the sidewalks and
  drive the streets as individual sprites, chatting to each other in speech bubbles;
* an **AI layer**: each NPC has a personality (Big Five, values, interests, worries, memories of the real
  fires, storms and heat waves of their ZIP), a mind (mood, needs, a memory stream, relationships), and a
  voice: an offline dialogue engine that speaks in the NPC's regional register and languages, and a Claude
  bridge that turns the same persona into a system prompt for open conversation, with memory carried across
  conversations;
* a **platform**: one JS API (browser and Node), a CLI, a local server that proxies Claude with a key kept on
  the server, and exports (persona JSON, JSONL batches with system prompts) for game engines.

The deliverable is `legion/Legion.html`, one self-contained file that opens anywhere (the world pack, the code
and the Anthropic SDK inline), plus the Node tooling.

## 2. Layout and ownership

```
legion/
  Legion.html              built single-file app (tools/build.mjs writes it)
  README.md                what Legion is and how to use it
  data/world.json.gz       the world pack (tools/build_pack.py writes it) — read-only for everyone
  data/acs/*.dat.gz        cached ACS tables (California ZCTAs)
  docs/CONTRACTS.md        this file
  src/engine/              environment-neutral ES modules (browser + Node). No DOM, no fetch except llm.mjs.
    rng.mjs                [foundation] hashing, seeded Rng, Alias tables
    world.mjs              [foundation] pack loading, ZIP access, geometry, raster, lookups, weather
    clock.mjs              [foundation] Pacific time helpers
    population.mjs         [population] households and people (layer 0 core, layer 1 full)
    names.mjs              [population] name pools by heritage, sex, birth cohort, generation and language
    occupations.mjs        [population] job titles by Census occupation group, sector, region, shift, wages
    persona.mjs            [persona] personality, interests, concerns, memories, speech profile, bio, routine
    schedule.mjs           [persona] daily routines and activity at a time
    mind.mjs               [persona] mood, needs, memory stream, relationships, appraisal, reflection
    lexicon.mjs            [lexicon] regional dialects, road naming, multilingual phrase banks (content in lexicon/)
    dialogue.mjs           [dialogue] the offline dialogue engine, barks (the engine's parts in dialogue/)
    llm.mjs                [llm] Claude bridge: prompts, streaming, reflection, model list, exports
    platform.mjs           [integration] the public facade (createLegion) tying it all together
  src/world/               browser-only rendering
    map.mjs                [crowd] WebGL2 statewide map: base layers, camera, labels
    crowd.mjs              [crowd] GPU crowd renderer, picking, the Worker pool
    crowd-build.mjs        [crowd] agent buffer builder (runs in Workers; pure, testable in Node)
    crowd-worker.mjs       [crowd] the build Worker
    street.mjs             [street] neighborhood simulation and renderer (parts in street-*.mjs)
  src/app/                 [app] the page: layout, panels, settings, styles, boot, services (the engine's one door),
                           nws-live.mjs (the optional live weather), provenance.mjs (facts and sources in words)
  tools/build_pack.py      [foundation] world pack compiler
  tools/build.mjs          [app] bundles everything into Legion.html (esbuild)
  cli/legion.mjs           [integration] Node CLI
  server/serve.mjs         [llm] local server + Claude proxy
  tests/*.test.mjs         one file per module (node tests/run.mjs runs them all); integration, platform, cli
  tests/e2e/run.mjs        Playwright end-to-end on the built Legion.html (crowd.e2e.mjs, street.e2e.mjs: the dev pages)
```

A module's owner writes only its own files (and its own tests). If you need something from a module you do not
own, use its exported API; if that API is missing something, write the smallest local helper and note it in
your report rather than editing another owner's file.

## 3. Rules for every module

**Determinism.** Generation code never calls `Math.random()` or reads the clock. Randomness comes from
`rng.mjs` (`hash2`, `hash3`, `hashStr`, `new Rng(seed)`, `rng.fork(label)`), seeded from the NPC's ids and the
population seed. Time is always passed in (epoch ms) and read through `clock.mjs`. The same inputs give the same
person, persona, schedule and offline dialogue line, in Node and in the browser. (UI code and the live
simulation loop may use real time and randomness for animation only.)

**Environment.** `src/engine` modules are plain ES modules that run unchanged in Node 22 and modern browsers:
no DOM, no Node built-ins at import time (lazy `await import('node:...')` inside a Node-only code path is fine),
no dependencies except each other (and `@anthropic-ai/sdk` in `llm.mjs` only). `src/world` and `src/app` are
browser-only. No network calls except: `llm.mjs` (Claude), the optional live NWS refresh (`src/app/nws-live.mjs`,
api.weather.gov) and the optional OpenStreetMap (Overpass) street fetch, each behind an explicit user setting
(all off by default) and each with an offline fallback.

**Performance budgets.** World load + init < 1 s. `householdCore` ≤ 5 µs average. `person` ≤ 0.3 ms.
`persona` ≤ 3 ms. An offline dialogue reply ≤ 20 ms. Crowd: one million agents built in < 3 s (in a Worker),
rendered at 60 fps on a desktop GPU; the page must stay responsive while building.

**Data provenance.** Every factual claim an NPC makes about the place (a fire's name and year, a record
temperature and its date, today's forecast, the highway, the share of neighbors who speak Spanish) comes from
the world pack. Never invent a statistic, a named event or a date. Opinions and feelings are the NPC's own.

**Representation rules (hard requirements).**

1. Personality (Big Five), intelligence, temperament, honesty, work ethic and every other character trait are
   **never** conditioned on race, ethnicity, heritage, religion, nativity or immigration status. They may
   depend on age, sex (small effects from the literature), region and density (small effects) and individual
   randomness, nothing else.
2. Heritage shapes names, the languages spoken at home, family terms and some cultural references, each as a
   modest probability modulated by generation and English ability, never as a caricature. Most lines from
   most NPCs are about the same things everyone talks about: the weather, traffic, work, family, rent, the
   fire last year, the game.
3. No phonetic accent spelling and no "broken English". An NPC with limited English speaks their own language
   (with an English gloss shown in brackets) or plain, correct, simple English.
4. Dialect markers are regional ("hella", "the 405", "tule fog", "June Gloom"), not ethnic.
5. Politics stays local and mild (housing costs, insurance, traffic, water, fire). No content that demeans any
   group. Religion appears only as an NPC's own practice, never as a judgment, and never inferred from heritage: the
   atlas counts congregations of every faith, so a practicing NPC goes to "religious services" (no day of the week and
   no house of worship named for them) and nobody says "church", "iglesia" or "God" unless a faith their record holds
   is Christian (none does today); the one exception is the Census Asian group 'sikh', itself a faith, whose
   households go to "the gurdwara". persona.practice.faith is the only source of a faith.
6. Names are synthetic combinations from common-name pools; no real individuals. Public places, highways,
   natural features and named historical disasters from the data are fine to mention. Businesses are generic
   ("the taco truck on the corner", "a pho place"), not brands.
7. The household data does not cover people without a home; Legion does not invent them.

**Style.** Small, readable functions; JSDoc on every export; no giant switch on ZIP codes (drive behavior from
the data). Comments explain why, not what.

**Tests.** Each module ships `legion/tests/<module>.test.mjs`, runnable alone with `node tests/<file>` from
`legion/` and through `node tests/run.mjs`, using `node:test` and `node:assert/strict`. Load the world with
`loadDefaultWorld()` from `src/engine/world.mjs`. Tests must be deterministic and finish in under 60 s each.

## 4. Foundation APIs (implemented)

### rng.mjs
`mix32(x)`, `hash2(a,b)`, `hash3(a,b,c)`, `hashStr(s, seed)`, `hashAll(...parts)`, `u01(h)`;
`new Rng(seed)` with `next() float() int(n) range(lo,hi) uniform(lo,hi) chance(p) pick(arr) weighted(weights)
weightedKey(obj) weightedItem(items, fn) gauss() normal(mu,sd) clampedNormal(mu,sd,lo,hi) lognormal(mu,s)
shuffle(arr) sample(arr,k) fork(label)`; `new Alias(weights).draw(rng | u1,u2)`; `cumulative`, `drawCumulative`;
`clamp`, `lerp`, `smoothstep`.

### world.mjs
`await loadPack(src)` (object, JSON, gzip bytes, base64 gzip string, path or URL), `createWorld(pack)`,
`await loadDefaultWorld()` (Node). A `World` has:

* `N`, `zips` (sorted ZIP strings), `indexOf(zip)`, `col(name)`, `get(i, name)`, `zip(i)` → every column as one
  object plus `countyName countyFips regionKey regionName regionThe provinceName zoneTitle placeName label`.
* Columns (`world.pack.zcols`): identity `zip city place county(index) region(key) lat lon tlat tlon x y tx ty`
  (tx,ty = the town point), size `sqmi density pop hh hhsize hu`, money and housing `inc value own_sh sfd_sh
  mf5_sh mh_sh vac_sh seas yb_med rooms mort_sh val1m_sh moved10_sh own_yr hh100k_sh hh200k_sh`, people
  `age_med s65_sh hisp_sh asian_sh span_sh span_lep_sh viet_sh chin_sh tagalog_sh korean_sh arabic_sh slavic_sh
  oie_sh lep_sh anc_arm anc_iran`, roofs `roof_age ra20_sh tile_sh wood_sh metal_sh solar_sh`, terrain and
  climate `cz elev_m elev_max_m coast_km zone zoneName rain_in rain_wet_m rain_rec_in rain_rec_date rain_rec_st
  gust_max gust_max_date gust_st g58 sa_ep di_ep off_kind snow_psf snowfall_in h90 h100 h110 heat_rec_f
  heat_rec_date heat_st tjul hail_n25 hail_max_in tor_n25 flood_n10 marine_cls salt_cls ar_n ar_days ar_max
  ar_max_date st_top stress province`, wildfire `fhsz_vh fhsz_any fire_n fire_big fire_big_yr fire_big_ac
  fire_last fire_last_yr fire_near fire_near_yr fire_km burn_sh fire_dest_res fire_worst fire_worst_yr
  fire_worst_dest fires`, disasters and insurance `fema_k fema_fire fema_storm fema_quake fair_sh nonren_sh prem
  wf_hi_sh`, establishments `est retail food lodging whse mfg church health school office auto builders roofers
  solar_co ins_agents`. Shares are percents (0-100). Dates are 'YYYYMMDD' or 'YYYY-MM-DD' strings.
  `off_kind` is the offshore wind regime ('sa' Santa Ana, 'di' Diablo, '' none). `st_top` is the ZIP's top
  weather stress ('wind','rain','fire','heat','snow','salt'). `cz` is the Title 24 climate zone (1-16).
* Census: `acs(i, block)` → integer counts; `acsLabels(block)`; `acsNamed(i, block)` → `{label: count}`.
  Blocks: `age` (23 male brackets then 23 female: `<5 5-9 10-14 15-17 18-19 20 21 22-24 25-29 30-34 35-39 40-44
  45-49 50-54 55-59 60-61 62-64 65-66 67-69 70-74 75-79 80-84 85+`), `race` (`white black aian asian nhpi other
  multi hispanic`, the first seven non-Hispanic), `hisp` (`mexican puertorican cuban dominican guatemalan honduran
  nicaraguan salvadoran centralam southam spanish otherhisp`), `asian` (`chinese filipino vietnamese korean
  japanese indian hmong cambodian lao thai pakistani bangladeshi sikh afghan burmese indonesian otherasian`),
  `anc` (38 ancestries reported, a person may report two: `armenian iranian arab assyrian russian ukrainian
  polish irish italian german english scottish scotchirish french portuguese dutch swedish norwegian danish greek
  basque turkish african westindian american israeli brazilian australian canadian swiss hungarian czech romanian
  egyptian lebanese ethiopian nigerian jamaican`), `nat` (`native foreign`), `lang` (13 totals `english spanish
  french german slavic indoeuro korean chinese vietnamese tagalog asianpi arabic other`, then 12 limited-English
  counts in the same order without english), `comm` (`drove carpool bus rail ferry taxi motorcycle bike walk
  other wfh`), `ctime` (`<5 5-9 10-14 15-19 20-24 25-29 30-34 35-39 40-44 45-59 60-89 90+` minutes), `occ`
  (25 male leaves then 25 female: `management business computer engineering science social legal education arts
  practitioner healthtech healthsupport firefighting police food cleaning personalcare sales office farming
  construction repair production transport moving`), `edu` (25+: `nohs hs somecollege associate bachelor master
  professional doctorate`), `mar` (15+, male then female: `never married separated absent widowed divorced`),
  `vet` (18+, male vet ×5 age bands, male non-vet ×5, female vet ×5, female non-vet ×5; bands `18-34 35-54 55-64
  65-74 75+`), `emp` (16+: `employed unemployed military nilf`), `hht` (households: `married male female alone
  roommates`; male/female = a householder with family and no spouse), `veh` (owner 0..5+, renter 0..5+),
  `hinc` (16 household income brackets `<10k … 200k+`), `sch` (3+: `preschool kindergarten g1-4 g5-8 g9-12
  undergrad grad none`).
* Places: `county(ci)`, `countyOf(i)`, `regionOf(i)` (`{key, name, the, counties}`), `zipsOfCounty`,
  `zipsOfRegion`, `search(q)`, `regions` (keys `nc fn sv si ba cc sj la oc ie sd`), `counties`, `places`,
  `placesIn(i)`, `placesNear(x,y,km)`.
* Geometry (units: x = (lon - minx)·kx·sx, y = (maxy - lat)·sx; `unitKm` ≈ 0.1975 km): `project(lat,lon)`,
  `unproject(x,y)`, `distKm(x0,y0,x1,y1)`, `zipRings(i)`, `zipBBox(i)`, `countyRings(ci)`, `outlineRings()`,
  `waterRings()`, `neighborRings()`, `raster()` (`{cell, W, H, grid, offsets, cells}`), `zipAt(x,y)`,
  `zipCells(i)`, `sampleHome(i, rng)`, `homeFor(i, key)` (deterministic), `zipsNear(x,y,km)`.
* Nearby: `landmarksNear(x,y,km,kinds)` (gazetteer kinds `range peak pass desert valley water island`),
  `roadsNear(x,y,km)` (`[{name:'I-405', route:405, kind:'I'|'US'|'SR', distKm, aadt}]`), `world.roads`
  (`[{r, kind, name, lines:[[x,y,aadtThousands],…]}]`).
* History: `firesOf(i)` (`[{name, year, acres, dest, dmg, cause, start, destInZip, dmgInZip, km, pct}]`, most
  destructive first), `arsOf(i)` (atmospheric rivers covering the ZIP's latitude: `{start, rank 1-5, peakAt,
  stretch, dmg, deaths, hours}`), `windsOf(i)` (`{kind:'santa_ana'|'diablo'|'sundowner'|'mono'|'winter'|'other',
  start, gust, where, dmg, deaths}`), `femaOf(i)` (`[[date, kind, title, type]]`, latest first).
* Weather: `weatherAt(i, t)` → `{now:{tempF, rh, pop, wind, short, isDay, time}, period:{name, detailed…},
  next:[…], obs, alerts:[{event, severity, headline, onset, ends, description, instruction}], keyMessages:[…],
  fireWeather:{level,name}, excessiveRain:{level,name}, stale, fetched, point, office}`. `world.snapshotTime` is
  the NWS fetch time (2026-11-23T22:38:55Z); the forecast covers about a week from it; beyond that `stale` is
  true and `now` is a climate estimate.

### clock.mjs
`pacific(t)` → `{year, month (1-12), day, dow (0 Sun..6 Sat), hour, minute, minuteOfDay, iso, label}` in
America/Los_Angeles; `atPacific(year, month, day, hour, minute)` → epoch ms; `dayPart(minuteOfDay)` →
`'night'|'early'|'morning'|'midday'|'afternoon'|'evening'|'late'`; `isWeekend(t)`; `fmtTime(t)`.

## 5. Population (`population.mjs`, `names.mjs`, `occupations.mjs`)

```js
import { Population, parseId, LEGION_SEED, POPULATION_YEAR, HERITAGE_KEYS, originInfo } from './population.mjs';
const pop = new Population(world, { seed: LEGION_SEED, cache: 2048 });   // LEGION_SEED = 1849; cache: layer 1 households kept
```

Addressing. Households of ZIP `zi` are `h = 0 … world.z.hh[zi]-1` (`pop.householdCount(zi)`). A person is `(zi, h,
m)` with `m = 0 … size-1`. Ids are strings: household `"94110-123"`, person `"94110-123-0"` (ZIP, household, member,
in decimal). `parseId(id[, world])` → `{zip, zi, h, m}` (m null for a household id; zi -1 for a ZIP not in the
world) or null; `pop.parseId(id)` uses the population's world. The total over households of their sizes is the
ZIP's household population (`pop.expectedPersons(zi)` ≈ `hh × hhsize`; group-quarters residents are not in
households and are left out, see `validate`).

Two layers, consistent by construction: layer 0 is everything the crowd needs, computed fast; layer 1 adds the
rest and never contradicts layer 0 (it reads layer 0 and conditions on it). Each ZIP's models are fitted lazily on
first use and cached (about 2 ms a ZIP for layer 0: the cost of a cold statewide crowd build, see section 8).

**Layer 0** — `pop.householdCore(zi, h)` (≤ 5 µs warm), `pop.householdSize(zi, h)` (O(1)):

```js
HouseholdCore = {
  zi, h, id,                 // id "94110-123"
  size,                      // persons
  type,                      // 'married' | 'father' | 'mother' | 'alone' | 'roommates'   (B11001)
  tenure,                    // 'own' | 'rent'                                           (own_sh)
  dwelling,                  // 'house' | 'small-apartment' | 'apartment' | 'mobile-home'  (sfd_sh, mf5_sh, mh_sh)
  vehicles,                  // 0..5                                                     (B25044 by tenure)
  home: {x, y},              // world.homeFor(zi, h)
  heritage,                  // household heritage key (below); members inherit with some mixing
  members: [PersonCore …]    // length size
}
PersonCore = {
  m, role,                   // 'householder' | 'spouse' | 'partner' | 'child' | 'grandchild' | 'parent' | 'sibling' | 'relative' | 'roommate'
  sex, age, heritage,        // 'F' | 'M'; integer years; usually the household's heritage
  worker, military,          // booleans (B23025, by age)
  occ,                       // Census occupation group (acsLabels('occ')) for civilian workers, else null (C24010 by sex)
  student,                   // null | 'preschool' | 'k12' | 'college' | 'grad'          (B14001, by age)
  mode,                      // 'drive' | 'carpool' | 'bus' | 'rail' | 'ferry' | 'taxi' | 'motorcycle' | 'bike' | 'walk' | 'other' | 'wfh' | null
  commuteMin,                // one way, minutes (B08303); 0 for wfh
  departMin, dwellMin,       // minutes after midnight they leave on a commute day (or null); minutes at work or school
  days,                      // commute days, bit mask Sun=1 … Sat=64 (1 << clock dow); 0 when they work from home
  workDays,                  // the days they work or attend school (wfh included)
  shift,                     // 'early' | 'day' | 'mid' | 'evening' | 'night' | 'h24' | null: the shift behind departMin
  workZi, work               // ZIP index and {x, y} of the workplace or school (-1 / null if none or wfh)
}
```

Calibration targets (tests check these per ZIP on thousands of households): household types ≈ B11001; mean size ≈
`hhsize`; the age-sex pyramid ≈ B01001 (with group quarters removed); race ≈ B03002; workers ≈ B23025; commute modes
≈ B08301; commute times ≈ B08303; occupations by sex ≈ C24010; tenure ≈ `own_sh`; vehicles ≈ B25044. A worker's mode
and minutes imply a distance: trips under 15 km end that far from home; longer ones at a ZIP chosen by a gravity model
over establishments in that distance band; service members at a base within reach. Children go to the nearest school
of their level; departures follow the occupation group's shift pattern.

**Heritage keys** (shared vocabulary for names, lexicon, persona, dialogue; `HERITAGE_KEYS`):
Hispanic `mexican salvadoran guatemalan honduran nicaraguan puertorican cuban dominican southamerican spanish
latino`; Asian `chinese filipino vietnamese korean japanese indian hmong cambodian lao thai pakistani bangladeshi
sikh afghan burmese indonesian asian`; Black `african-american ethiopian nigerian caribbean african`; White by
ancestry `armenian iranian arab assyrian russian ukrainian polish irish italian german english scottish french
portuguese dutch scandinavian greek european american`; `native`; `pacific`; `multiracial`; `other`. Race from
B03002, the Hispanic origin from B03001, the Asian group from B02015, ancestry from B04006 — never from a list of
places in the code. `npc.origin` refines it (`originInfo(key)`: e.g. 'taiwanese', 'oaxacan' … with a label).

**Layer 1** — `pop.household(zi, h)`, `pop.person(zi, h, m)` (≤ 0.3 ms warm, LRU-cached), `pop.get(id)` (a household
id gives the householder; null for no one), `pop.members(zi, h)`:

```js
NPC = {
  id, hid, zip, zi, h, m,
  role, sex, age, birthYear, pronouns,             // birthYear = 2026 - age, give or take the birthday; 'she/her' | 'he/him'
  race,                                            // 'hispanic' | 'white' | 'black' | 'asian' | 'aian' | 'nhpi' | 'multi' | 'other'
  heritage, heritageLabel, origin,                 // 'salvadoran', 'Salvadoran American', a finer origin key
  nativity, generation, arrivalYear, birthplace,   // 'native'|'foreign'; 1, 2, 3 (or more); arrival for immigrants; 'San Miguel, El Salvador'
  mainlandYear,                                    // born in Puerto Rico, Guam or American Samoa (native born): the year they moved, else null
  name: { first, last, full, display, nick },      // names.mjs, by heritage, sex, cohort, generation, home language and origin
  languages: { home, english, list },              // home: 'english' or the language key (spanish tagalog vietnamese korean cantonese
                                                   // mandarin armenian farsi arabic russian punjabi hindi urdu hmong khmer lao japanese
                                                   // portuguese telugu tamil … and 'other'); english: 'only' | 'very well' | 'limited'
  education,                                       // 'nohs' … 'doctorate' for 25+ (B15003, never short of the job's degree); 'in school' or 'child'
  school,                                          // null | 'preschool' | 'elementary' | 'middle' | 'high' | 'college' | 'grad'
  status,                                          // 'employed' | 'unemployed' | 'retired' | 'student' | 'homemaker' | 'child' | 'military' | 'not working'
  occupation,                                      // null or { key, title, sector, employer, shift, wfh, wage, hours } (wage: a year's pay for
                                                   // `hours` a week, never under the minimum wage)
  income, householdIncome,                         // personal and household annual dollars (B19001)
  commute: { mode, minutes, departMin, dwellMin, days, workDays, workZi, workZip, workCity, work,
             road },                               // road: the state highway a driver takes, an object {name, route, kind, distKm, aadt}
                                                   // (a world.roadsNear record; consumers read road.name), or null
  marital, veteran,                                // B12001 by sex; B21001 by sex and age
  parents,                                         // member indices of the parents who live in the household, mother first
  household: { id, size, type, tenure, dwelling, vehicles, yearMoved, yearBuilt, home: {x, y, lat, lon},
               members: [{m, role, name, first, age, sex}] },
  place: { zip, city, place, countyName, countyFips, region, regionName, province, zone },
  seed                                             // uint32 for the persona
}
```

`pop.sample(zi, n, seed)` → n distinct NPCs uniform over persons; `pop.sampleState(n, seed)`; `pop.includes(zi, h,
rate)` (the crowd's deterministic household sample: `u01(hash3(seed ^ 0xC0, zi, h)) < rate`); `pop.validate(zi,
households)` → `{zi, zip, city, households, persons, gq: {persons, share}, generated, acs, target, scalars}` (share
tables `hht tenure veh dwelling hinc sex age race heritage hisp asian nat lang lep emp comm ctime occM occF edu mar vet
sch`; scalars `hhsize medianAge under18 over65 foreign own`, each `{generated, acs, target}`).

`names.mjs`: `surname(rng, heritage, opts)`, `givenName(rng, opts)`, `nickname(rng, given, opts)`, `surnameCustoms`,
`marriedSurname`, `nameFor`, `isReservedName` and the pools (see its header). `occupations.mjs`: `OCC_GROUPS`,
`GROUP_PROFILES`, `OCCUPATION_CATALOG`, `chooseTitle`, `titleWage`, `pickOccupation`, `MIN_WAGE_HOURLY`.

## 6. Persona, schedule, mind (`persona.mjs`, `schedule.mjs`, `mind.mjs`)

```js
import { persona } from './persona.mjs';
import { dialectFor } from './lexicon.mjs';
const p = persona(world, npc, { population: pop, dialectFor, t });   // deterministic from npc.seed, the pack and t; ≈ 0.5-3 ms
p = {
  v, id, npc,                             // v = PERSONA_VERSION
  big5: { O, C, E, A, N },                // 0..1; from age and sex (small effects), region and density (small) and individual spread;
                                          // never from race, heritage, nativity, language, religion or name (PROTECTED_FIELDS)
  traits: [ 'warm', 'blunt', … ],         // 3-5 adjectives from big5
  archetype,                              // a life-role label: 'early-shift regular', 'retired gardener', 'new parent' …
  values: [ … ],                          // top 3 Schwartz values (SCHWARTZ_VALUES)
  interests: [ … ], interestDetails: [ {name, why, tradition?} ],   // grounded in place, age, income, household
  teams: [ {name, sport} ], practice,     // practice: their own {label, place, interest, faith, day, why} or null: 'religious
                                          // services on Sunday mornings' (place 'religious services', faith null), or for a
                                          // household of the Census group 'sikh' 'Sunday services at the gurdwara' (place
                                          // 'the gurdwara', faith 'sikh'); the household goes to one place, so every member's
                                          // persona names it alike (routine.places.church.label, the schedule's worship label)
  concerns: [ { topic, weight, why, area } ],   // `why` cites the columns in parentheses ("(nonren_sh)"); area: the dialogue topic
  memories: [ { year, date, kind, text, weight, source, title?, fact?, experience?, scope? } ],
                                          // fires, ARs, wind events, FEMA disasters, records of their ZIP and county while they lived
                                          // there, and life events; source: 'firesOf(91042): Station 2009', 'household.yearMoved' …
  knowledge: { neighborhood, city, zip, county, countyLabel, region, regionThe, province, coastKm, landmarks, roads, nearbyPlaces,
               workCity, workZip, records },
  speech: { dialect, register, verbosity, slang, humor, humorStyle, directness, codeSwitch: { lang, rate } | null, fillers, catchphrases },
  bio, hooks: [ … ], hookDetails: [ {kind, topic, text} ],   // 3-5; the moment's weather or alert first when worth saying
  lastingHooks: [ {kind, topic, text} ],  // the hooks that hold whatever the hour: the Claude sheet is built from these, so
                                          // the cached sheet is byte-identical from hour to hour
  residence: { zipSince, countySince, grewUpHere, bornHere, householdCounty, yearsInZip, yearsInCounty },
  roof,                                   // owners: {age, material, solar, installed, original, why} or null
  routine,                                // what schedule.mjs reads (layer 0's commute, the occupation group, school runs, the household)
  t                                       // the time the weather-dependent parts (alert clauses, weather hooks) were computed for
}
```

`schedule.mjs`: `dayPlan(npc, persona, t)` → frozen items tiling the Pacific day holding t, midnight to midnight:
`{start, end, startMin, endMin, kind, place: {kind, x, y, label}, mode, travel, from, label, anchor?, leg?, escort?,
run?, together?}` (kinds `PLAN_KINDS`: `sleep home commute work school errand leisure exercise worship visit`);
`activityAt(npc, persona, t)` → the item plus `{progress, traveling, position: {x, y}}`; also `dayInfo`,
`busyIntervals`, `familyOutings`, `routineOf`, `rhythmOf`, `NIGHT_REST`, `ALONE_AGE`.

`mind.mjs`: `new Mind(persona, {state} | {t})` with a serializable state (`MIND_VERSION`): `mood {valence, arousal}`
and an `emotion` label, `needs {energy, social, fun, comfort, money}` (0..1), `memory` (`{id, t, kind, text,
importance, tags}`), `relationships` (`{player: {affinity, trust, familiarity, met, lastSeen, facts: [{key, value, t,
text}], interactions, grievance, lastInsult}}`), `beliefs`. Methods: `tick(t, {weather, activity})`, `observe(event)`
(`{kind: 'utterance', from: 'player'|'self'|id, text, t}`, `'meet'`, `'gift'`, `'help'`, `'alert'`),
`appraise(text)` → `{sentiment, intents, topics, toxicity, facts}`, `remember(text, importance, tags, {t, kind})`,
`recall(query, k, {t})`, `reflect(t, {force})` (offline consolidation into beliefs), `applyReflection(r, t)` (stores
a Claude reflection: memories, affinity and trust, facts, a nudge to the mood), `relationship(who)`,
`feelingsToward(who)`, `toJSON()`, `Mind.fromJSON(json, persona)`, `Mind.load(store, persona)`, `mind.save(store)`.
MindStores (`get(id)`, `put(id, state)`, `delete`, `keys`): `MemoryStore`, `LocalStorageStore` (every access
guarded), `FileStore(path)` (Node; atomic writes). The app keeps its own guarded `LocalMindStore` (src/app/store.mjs).

## 7. Voice (`lexicon.mjs`, `dialogue.mjs`, `llm.mjs`)

`lexicon.mjs` (content in `lexicon/*.mjs`; data-driven, regional, never ethnic):
* `dialectFor(world, zi)` → one of `DIALECT_KEYS` (42): `sf eastbay southbay peninsula northbay sacramento
  valley-north valley-south fresno kern la-westside la-central la-eastside sfv santa-clarita la-south southbay-la
  longbeach sgv ventura oc-coast oc-inland ie desert-cv high-desert antelope-valley low-desert imperial sd-coast
  sd-inland central-coast santa-barbara salinas monterey-bay north-coast north-inland far-north tahoe gold-country
  sierra-foothills eastern-sierra socal-mountains`, from county, place, density, coast and terrain
  (`explainDialect`, `dialectTable`).
* `DIALECTS[key]` → `{key, name, region, regionThe, family, familyName, areaCodes, the, theShare, pch, roadStyle,
  register, words, greetings, farewells, fillers, intensifiers, agreement, surprise, traffic, prideLines,
  complaintLines, food, weather: {fog, heat, rain, wind, cold, smoke, snow, clear}, regional, youth, elder, slang,
  teams, teamNames, localTerms}`. Lines are slot templates (`SLOT_NAMES`: `road stretch place city neighborhood
  landmark peak county region temp fire year team teamName weather season month day alert`) and may carry leading
  tags (`parseTagged`, `lineTags`, `lineFits`): `@m11-2` months, `@h6-9` hours, `@wx:fog,rain` conditions
  (`WEATHER_CONDITIONS`), `@alert:redflag` (`ALERT_KINDS`: `redflag flashflood frost heat wind winter`),
  `@county:Kern`, `@coast` / `@inland` / `@offshore`, and what the line presupposes of the speaker
  (`SPEAKER_NEEDS`: `@adult @drives @works @owns @rents @parent @native @rooted`). `linesFor` and `pickLine` leave out
  a line the moment or the speaker contradicts; `Picker` never repeats within a conversation; `slotsFor(world, zi,
  {t, rng})` → `{values, context, facts}`; `speakerFacts(npc, persona)`; `slangFor`; `dialectSummary`.
* `roadName(road, dialectKey)` → "the 405" / "405" / "Highway 99" / "the 99" / "PCH" — California usage by region;
  `roadNames`, `freewayName`, `namedStretch`, `stretchesNear`, `NAMED_STRETCHES`.
* `LANGUAGES[lang]` → `{key, name, native, script, notes, varieties, defaultVariety, greetings, howAreYou, thanks,
  farewells, yes, no, affection, polite, food, interjections, family, phrases: {intent: [[native, gloss]]}}` for
  `LANGUAGE_KEYS` (`spanish tagalog vietnamese korean cantonese mandarin japanese armenian farsi dari pashto arabic
  assyrian amharic russian ukrainian punjabi hindi urdu hmong khmer lao thai portuguese samoan tongan`); intents
  `PHRASE_INTENTS`; religious formulas (`RELIGIOUS_INTENTS`) only for a speaker of that faith (`faithFor`).
* `codeSwitch(lang, intent, rng, {sex, t, variety, faith})` → `{text, gloss, lang, intent}`; `phrasesFor`,
  `familyTerm`, `resolveLanguage`, `varietyFor`, `weatherCondition`, `offshoreWind`, `findBrands`, `fireLabel`.

`dialogue.mjs` (the offline engine; no network; a reply in a few milliseconds):
* `new Conversation({ world, persona, mind, t, rngSeed, population })` with `greet()`, `reply(text)`, `farewell()`
  → `Line = { text, gloss, intent, topics, emotion, facts, safety?, note?, ended? }` (safety: 'crisis' | 'sexual' |
  'threat' for a line that is not part of the game, read before any other intent: someone in crisis gets a kind line
  that steps out of the scene with 988 and 911, and `note`, Legion's own note (988, 911; the app shows it as a note
  from Legion, never in the NPC's bubble, the CLI on stderr); a sexual line, a lure or a threat ends the conversation,
  `ended: true`, and it stays ended (the Talk tab offers no "Talk again" in that visit, the server's session answers
  409); gloss: the English when the line or part of it is in
  another language, else null; facts: ids of the pack facts used, e.g. `fire:Station:2009`, `weather.now`,
  `road:I-210`, `acs.lang.spanish`, `npc.occupation` — see dialogue/ground.mjs); `toJSON()`. The mind hears the
  player's lines (observe) and the NPC's own; `farewell()` remembers the conversation. Intents `INTENTS`, emotions
  `EMOTIONS`, `DIALOGUE_VERSION`.
* `bark(world, persona, {t, other, situation})` → `{text, gloss}` or null; `barkBetween(world, personaA, personaB,
  context)` → `[lineA, lineB]` that agree; `BARK_SITUATIONS` (`pass wait weather alert traffic work home`);
  `templates()`, `lintTemplates()`, `understand(text, ctx)`.

`llm.mjs` (Claude through the official `@anthropic-ai/sdk`):
* `MODELS` — `[{id, label, note, fallback, price: {input, output}}]` for `claude-opus-5-5` (default),
  `claude-sonnet-5-5`, `claude-haiku-5-5` (no server-side refusal fallback), `claude-fable-5-2`; `modelInfo`,
  `normalizeModel`, `EFFORTS` (`low … max`), `DEFAULTS` (`effort: 'low'`, maxTokens 1024 …), `PROMPT_VERSION`,
  `FALLBACK_BETA`, `fallbackParams(model)` (`betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default'`).
  Thinking is adaptive (never sent), effort is `output_config.effort`, no sampling parameters, no prefill.
* `PLATFORM_RULES` (byte-identical for every NPC), `personaSheet(persona, world)`, `systemBlocks(persona, world)` →
  `[rules + cache_control, sheet + cache_control]`, `systemPrompt`. With the breakpoint on the newest player message,
  a turn uses three cache breakpoints: the rules (shared by every NPC), the sheet (per NPC), the conversation.
* `situation(persona, mind, {t, weather, activity, recalled, world})` — the per-turn `{role: 'system'}` message after
  the player's turn; `recallFor(mind, said, t)`; `History` (append-only, trimmed from the oldest end in chunks).
* `new ClaudeVoice({ apiKey, model, effort, maxTokens, baseURL, proxyURL, dangerouslyAllowBrowser, client, world,
  fallbacks, reflectEffort, reflectMaxTokens, historyBudget, timeout, maxRetries })` → `request(...)` (the exact
  request, unsent), `stream(persona, mind, history, playerText, {t, weather, activity, recalled, onText, signal})` →
  `{text, usage, stopReason, model, refusal, truncated, fallback, cacheHit, situation, id}`, `reflect(persona,
  transcript)` → `{summary, facts_about_player, affinity_delta, trust_delta, mood, memorable_line, follow_up}`
  (`REFLECTION_SCHEMA`, `validateReflection`, `MOODS`), `ping()`. Errors are `VoiceError {code, message, retryable,
  status, retryAfter}` (`describeError`); through `proxyURL` the page holds no key (`PROXY_DUMMY_KEY`).
* `exportPersona(persona, world, {model, effort, maxTokens})` → `{format: 'legion.persona/1', promptVersion, id,
  name, persona, systemPrompt, system, defaults, headers, voice, turnProtocol}`; `exportJSONL(personas, world, opts)`.

## 8. Crowd and map (`map.mjs`, `crowd.mjs`, `crowd-build.mjs`, `crowd-worker.mjs`)

`crowd-build.mjs` (pure; runs in Workers and in Node tests): `buildAgentsGen(world, pop, {rate, seed, zips, regions,
focus, chunkTarget, firstChunkTarget, byRegion, pickIndex, roadNet})` yields `{type: 'chunk', chunk, progress}` and
`{type: 'tick', progress}` and returns the summary; `buildAgents(...)` builds synchronously. Every person of every
household `pop.includes(zi, h, rate)` selects is one agent, 32 bytes, as a structure of arrays per chunk:

```
home    Uint16Array(2n)  x, y fixed point over the projection extent (q / 65535 × proj.W | proj.H, ~15 m), zipAt-safe
dest    Uint16Array(2n)  workplace or school, same encoding (= home for people without commute trips)
timing  Uint16Array(3n)  departMin (0xFFFF = none), commuteMin, dwellMin            (commuteTiming(member))
days    Uint8Array(n)    commute days, bit (1 << dow); 0 = no commute trips
mode    Uint8Array(n)    MODES code in bits 0-3 (mode & 15); bit 4 (STUDENT_BIT) = the destination is a school
route   Uint16Array(3n)  highway leg: polyline + 1 (0 = none), entry and exit arc length as q / 65535 of the polyline
errand  Uint32Array(n)   start minute | dwell / 2 << 11 | days << 18 | drives << 25 | lane << 26 (2 bits) | curve << 28
                         (2 bits) | repeats << 30 (2 bits): on a day without a commute the outing goes again `repeats`
                         times (half as many on a weekday, at twice the spacing; a weekend's first an hour earlier),
                         errandJitter, outingsOn, outingPeriod, WEEKEND_EARLY
eoff    Int8Array(2n)    errand point minus home, in quarter units (±31.75 units, ~±6 km)
ids     Uint32Array(n)   zi << 20 | h << 4 | m, or 0x80000000 | k for overflow[3k .. 3k+2] = (zi, h, m)
```

plus a pick index per chunk (`chunk.pick`: cells crossed by each agent's paths, delta-varint coded, ~3.5 bytes an
agent) and `{count, households, region, zis, byMode, commuters, highway, errands, overflow, start}`. The summary:
`{agents, households, zips, zipsWithAgents, chunks, byMode, byKind, commuters, highway, errands, overflow, regions,
rate, seed, bytesPerAgent, pickBytes, pickBytesPerAgent, ms}`. Drivers going over ~8 km take the state highway
network; non-commuters run errands near home by hash. The JS position function (`agentPhase`, `agentPosition`) and
its GLSL twin (`agentGLSL`) must change together.

The outings are calibrated to the NPCs' own day plans: at a weekday or Saturday midday the share of the crowd on the
move is within 30% of the share their schedules have traveling (tests/crowd-build.test.mjs). A commute day's span may
reach into the day after next (24-hour shifts keep their length; the position function looks back two days). Each
state highway line has a free-flow speed (`lineSpeedKmh`: interstates and lines carrying 60,000 a day are freeways at
100 km/h, a state route through dense blocks is a 50 km/h boulevard, a quiet rural one 80 km/h), in `net.lines` (the
fourth float, which the shader reads) and in `net.info[l].kmh`; the planner and both twins use it. `buildAgentsGen`
takes `below`: a top-up of only the households `rate` takes that `below` did not.

`crowd.mjs`: `new Crowd(mapView, {world, population, rate, seed, pack, worker, workers, maxAgents, cache})`; `topUp({zis,
rate})` adds, for a zoomed-in view, the households of those ZIPs the statewide rate left out (built in the Workers,
drawn, picked and counted with the rest; nobody twice) and `dropTopUp()` removes them (the Stage asks below 60 km
across, up to 1.5 million more people, 250,000 on software WebGL, and drops them past 90 km; `topUpFor`, `TOPUP`);
`await crowd.build({rate, onProgress(fraction, agents), focus})` → the summary plus `{mode: 'worker'|'main'|'cache',
workers, pack, totalMs, rateCapped, rate, bytesPerAgent, pickBytesPerAgent, mainBytesPerAgent, workerBytesPerAgent,
workerLoadMs, verified, verifyMaxMs, cached}` or `{cancelled: true}`. `cache` (a key naming this build of the code and
the pack: the app passes Legion.html's build id, nothing in development) keeps a finished build in IndexedDB
(`readCachedCrowd`, `writeCachedCrowd`, `clearCachedCrowds`; one build kept, up to `CACHE_MAX_AGENTS`): the next visit at
the same rate and seeds loads it (`mode: 'cache'`) after the same spot check against the page's population, and
`crowd.cacheWrite` resolves true once a fresh build is kept. On software WebGL (`map.software`) only the agents the
level of detail keeps are drawn (an index buffer of `lodValue(i) < keep`); `setTime(t)`, `setVisible(kinds)` (`walk drive bike
transit errand home`), `visibleKinds()`, `pick(x, y, radiusUnits)` → `{id, zip, zi, h, m, mode, travel, commuteMode,
state, school, kind, x, y, dist, index}`, `positionOf(id)`, `stats()` → `{agents, moving: {walk, drive, bike,
transit, errand}, movingTotal, atHome, atWork, atErrand, toWork, toHome, t}`, `setQuality({keep, auto})`, `gpuEval`,
`destroy()`. A build runs in a pool of Workers (`defaultWorkerCount()`: one per spare core, at most four): the ZIPs
in build order (the region under the camera first) are dealt to them in turn, chunks draw as they arrive (a small
first chunk from each), and a spot check against the page's population resolves it. `prewarmCrowd({pack, popSeed,
workers})` starts the pool and its pack decoding at page boot; the first Crowd adopts it. Worker messages:
`prepare`, `build {zips, …}`, `stats`, `cancel` in; `prepared`, `loaded`, `chunk`, `progress`, `done`, `error`,
`stats` out; `adopt {chunks}` hands the Workers the state arrays of a kept build for stats.

`map.mjs`: `new MapView(container, {world, theme, maxDpr, labels})`; `camera {x, y, zoom}`, `flyTo`, `fitState`,
`setCamera`, `zoomBy`, `screenToWorld`, `worldToScreen`, `viewBounds`, `setTheme`, `setShade`, `requestRender`,
`render`, `addLayer` / `removeLayer` (layers draw after the base map; `layer.pick` answers clicks), `pickAt`,
`getGL`, `resize`, `destroy`; events `move`, `click` (with `hit`), `hover`, `leave`, `theme`, `resize`. Dark and light
themes from CSS custom properties (`--map-*`, `--crowd-*`). On software WebGL (`softwareGL(gl)`: SwiftShader, llvmpipe)
the base map (fills and lines) is drawn into a texture once per view (camera, size, palette) and copied each frame,
under the night shade and the layers.

## 9. Street view (`street.mjs`)

`new StreetView(container, { world, population, getTime, planFor, bark, persona, allowNetwork, theme, trafficScale,
schedule, dialogue, onSelect, onHover })`: `container` is an element to fill or a canvas; `planFor(id, t)` the
schedule activity of an NPC (the app passes `schedule.activityAt` with the NPC's persona), `bark(idA, idB, context)`
a bubble line (the app's agrees through `dialogue.barkBetween`), `persona(id)` the persona lookup. `await
view.open(x, y, {radiusM})` (world units; ~1.2 km across) → `{x, y, radiusM, zip, city, style, source:
'procedural'|'osm', osm, buildMs, households, residents, buildings, streets, streetKm}` or null; `close()`,
`destroy()`, `select(id)`, `selectAt(px, py)`, `follow(on)`, `setTheme(theme)`, `setTime(t)`, `zoomBy`, `panBy`,
`agentAt`, `stats()`, `agentsOnScreen()`, `conditions()`, `brightness()`; events `select {id}`, `hover {id}`, `open`,
`close`, `stats`, `follow {on, id}`, `error {message}`. Keys on the view: arrows pan, `+`/`-` zoom, `F` follows, Escape
clears a selection (with nothing selected it is left to the page, which goes back to the map). Streets: OpenStreetMap ways from Overpass when allowed
(cached per tile), else a deterministic procedural network shaped by the ZIP's density, dwelling mix and era. Houses
for the households whose homes fall in view; residents follow their plans; in-commuters and bus drivers are real
NPCs, and through traffic is driven by real NPCs whose own day has them on that commute at that moment (and can be
clicked only while it still does); a car or a walker no NPC's day accounts for (a shopper, a passer-by at an hour few
commute) goes unnamed and cannot be picked. A trip that starts or ends outside the view is on the street for the plan's
own time inside it, at the plan's pace; the person selected and their household follow their schedule at once
(`sim.upgradeIds`), the rest in order of distance from the camera; someone selected who is indoors at home in view has
their house outlined (`sim.homeOf`). Day/night lighting and rain from the weather.

## 10. The app (`src/app`, `tools/build.mjs`, `cli`, `server`)

One page: a top bar (Legion, search by ZIP/city/county/region/NPC id, the simulation clock with play, pause, speed
1×–3600× and a time-of-day scrubber, the counts of NPCs simulated and moving, the theme and settings), the map with
the crowd (or the street view), a **Place** panel (the weather, live or from the snapshot with a note saying which;
totals and medians; languages, heritage and commute mixes; twelve residents; Census versus generated tables; "Walk
the streets") and an **NPC** panel with tabs **Profile**, **Mind** (Big Five in plain words, traits, archetype,
values, interests, concerns with their data, memories with year and source, mood, needs, the relationship and what
they know about you), **Talk** (offline engine or Claude, streaming; glosses under lines in other languages; each
line's facts a tap away; starters only about what the NPC's data holds; a conversation happens in real time, the
clock held at 1× while the tab is open, and one the clock has left 15 minutes behind starts again at the present),
**Prompt** (the system blocks and the situation note, token estimate, copy) and **JSON** (record, persona and mind;
the game-engine export). Escape leaves the street view from anywhere in it. Settings:
crowd density (2.5% default, about a million agents; a view under 60 km across gets more of the people in it, see
Crowd.topUp), theme, Claude key (session only unless remembered), model,
effort, network permissions (Claude, live NWS weather, OpenStreetMap; all off by default).

`app/services.mjs` (the page's one door to the engine; every hook returns `{ok, value}` or `{ok: false, reason,
message}`; it also exports `fireLabel(name)`, the lexicon's fire names for the panels): `init`, `setClock(fn)`, `npc`, `residents`, `persona(id, {t, any})` (per simulated hour), `mind(id,
{t})`, `saveMind`, `observe(id, event)`, `reflectOffline(id, {t})`, `conversation(id, {t})`, `voice(settings)`,
`history()`, `reflect(id, transcript, settings, {t})` (Claude reflection through `Mind.applyReflection`),
`prompt(id, {t, said})` → `{blocks, text, situation}`, `exportPersona(id, settings)`, `dayPlan`, `activityAt`,
`bark(idA, idB, context)`, `streetView(canvas, opts)`, `weather(zi, t)` (live-aware), `setLiveWeather(on)`,
`refreshWeather(zi, t)`, `weatherStatus(zi, t)` → `{state: 'off'|'idle'|'loading'|'live'|'outside'|'error', note}`,
`validate`, `createMap`, `createCrowd`, `prewarmCrowd(pack)`, `models`, `efforts`, `dialectName`, `wire(modules)`,
`status()`, `safety(text, {age})` (the dialogue engine's reading of a player's line, `{kind, sub, note}` or null: the
Talk tab adds the note (988, 911) under a Claude reply as it does under the offline engine's line).

Search finds ZIPs, Census places, postal cities, counties, regions, the neighborhoods of the big cities
(world.neighborhoods: "the Mission", "Boyle Heights"; a scope of kind 'neighborhood'), NPC ids, and everyday short
names (SF, LA, East LA, the OC); names and queries are folded (accents, St./Mt./Ft., a leading "the"), a query nothing
matches gets the closest names ("Did you mean"), and one or two digits ask for a third. Deep links (`#zip=`, `#place=`,
`#neighborhood=`, `#city=`, `#county=` FIPS or name, `#region=`, `#npc=`) are read at boot and on every hashchange; a
key that names nothing says so. The Place panel names a borrowed forecast's point and distance and marks estimates
("≈52°F", world.weatherAt's approx and basis), and says "before 1940" for the ACS top code.

`app/nws-live.mjs`: `new LiveWeather({world, fetch, enabled, ttlMs, now})` → `refresh(zi)` (api.weather.gov
`/points/{lat},{lon}`, its `forecastHourly` and `forecast`, `/alerts/active?point=`; cached 15 minutes a ZIP),
`weatherAt(zi, t)` (world.weatherAt's shape with `live: true`, or null outside the live hours), `status(zi, t)`,
`world()` (a view of the world whose weatherAt answers live where it can); `adaptLive`, `liveWeatherAt`, `liveWorld`;
`cleanForecastText(s)` (NWS text without the generator's `{{placeholders}}`, for every panel), `alertsForZip(alerts,
coastKm)` (shore-only events, `COASTAL_EVENT`, left out more than `COASTAL_ALERT_KM` = 8 km inland: the Place panel, the
starters and the dialogue agree).

`app/bus.mjs`: `on(event, fn)`, `off`, `once`, `emit(event, payload)`. Events: `npc:select {id, source}`, `npc:hover
{id, mode}`, `view:change {mode: 'map'|'street', x, y, zoom}`, `time:change {t, speed, rate, held, playing}` (`rate` the speed the
clock runs at: `SimClock.hold(1)` caps it at real time while a conversation is on screen, `release()` ends that, and
choosing a speed ends it too), `settings:change
{settings, changed}` (no key in the payload), `place:select {zi, kind, key, title, source}`, `weather:change {zi,
status}`.

`tools/build.mjs`: esbuild bundles `src/app/main.mjs` and the crowd Worker (as an inline string), inlines the CSS and
the world pack (gzip, base64) and writes `Legion.html` (deterministic bytes; about 4.8 MB). `--check` verifies the
page is self-contained and that the pack loads in Node as far as the engine goes.

`cli/legion.mjs`: `sample <zip|city|county|region|CA> [n]`, `npc <id>`, `persona <id>`, `prompt <id>`, `plan <id>
[--date YYYY-MM-DD]`, `talk <id>` (offline REPL; `--claude` with `ANTHROPIC_API_KEY` or the SDK's credential chain,
`--model`, `--effort`, `--proxy URL` for a Legion server, `--store FILE` to keep the mind), `export <where> <n>`
(JSON Lines of `exportPersona`), `stats <zip>`; `--json` for every command, `--seed` (0 to 4294967295), `--t` (a
Pacific wall time that exists, ISO with a zone, epoch ms of 10 digits or more, or now), `--help`. A --store that is a
directory or in a missing folder is refused before the conversation; a mind that cannot be saved is an error (exit 1).
In talk, Legion's own notes (988 and 911 for someone in crisis, a failed Claude turn) go to stderr as "(Legion) …"; a
failed turn that can be retried does not end the conversation; a line the NPC will not answer ends it.

`server/serve.mjs`: serves `Legion.html` (and `legion/` for development); `GET /api/health` (`{service: 'legion',
keyConfigured, credential, proxy: '/api/anthropic', models, defaultModel, maxTokens}`); the SDK-compatible proxy
`POST /api/anthropic/v1/messages` (streaming or not; `POST /api/claude` is the same) and `GET
/api/anthropic/v1/models/{id}`, with the key from the server's environment, never sent to the page. Same-origin
only, bound to 127.0.0.1 by default; a fallback model must be one of Legion's too, and max_tokens at least 1. The NPC
API (`NPC_API`): `GET /api/npc/{id}`, `/api/persona/{id}?t=`, `/api/prompt/{id}?t=`, `/api/situation/{id}?t=&said=`,
`/api/plan/{id}?date=|t=`, `/api/activity/{id}?t=`, `/api/export/{id}?t=&model=&effort=`, `/api/weather/{zip}?t=`,
`/api/sample?where=&n=&seed=` and `POST /api/talk/{id} {session?, text?, end?, t?}` → `{session, npc, t, lines, ended}`
(the offline engine; sessions kept in memory, ended ones answer 409; minds in `--store FILE` when given), on a platform
(createLegion) made at the first call; same origin, or the origins `--cors` names (never the Claude proxy). Bound to
any other interface it serves only Legion.html and the API and asks every request for a token made at start
(`?token=` once, which becomes an HttpOnly cookie, or the `x-legion-token` header) and says so loudly at start.
`createServer({root, clientFactory, env, log, host, token, corsOrigins, storePath, legion, …})` for tests.

## 11. Integration facade (`platform.mjs`)

```js
import { createLegion } from './src/engine/platform.mjs';
const legion = await createLegion({ pack, seed, store, t });  // pack: object | bytes | base64 | path | URL; omitted: data/world.json.gz
                                                             // in Node, window.__LEGION_PACK__ in a page; store: a MindStore
legion.world, legion.population, legion.seed, legion.store, legion.clock
legion.npc(id)                      // NPC (layer 1), or null
legion.persona(id, {t})             // persona for the hour holding t (with the lexicon's dialectFor)
legion.mind(id, {t})                // Mind (from the store, kept live); legion.saveMind(id), legion.forgetMind(id)
legion.conversation(id, {t})        // offline Conversation with the NPC's mind
legion.voice(options)               // ClaudeVoice with this world
legion.reflect(id, voice, history)  // a Claude reflection stored in the mind (Mind.applyReflection) and saved
legion.prompt(id, {t})              // {blocks, text, situation}
legion.exportPersona(id, options)   // the game-engine export
legion.sample(where, n, {seed})     // where: ZIP | city | Census place | county (name or FIPS) | region key or name | 'CA'
legion.resolve(where)               // {kind, key, title, zis}
legion.dayPlan(id, t), legion.activityAt(id, t)
legion.weather(zip, t)              // world.weatherAt for a ZIP code or index
legion.bark(idA, idB, {t})          // [A's line, B's answer] (dialogue.barkBetween)
```

Methods that take an id throw a clear Error for an id that names no one; times default to the NWS snapshot.
