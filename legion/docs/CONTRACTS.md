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
  data/world.json.gz       the world pack (tools/build_pack.py writes it) — read-only for everyone
  data/acs/*.dat.gz        cached ACS tables (California ZCTAs)
  docs/CONTRACTS.md        this file
  src/engine/              environment-neutral ES modules (browser + Node). No DOM, no fetch except llm.mjs.
    rng.mjs                [foundation] hashing, seeded Rng, Alias tables
    world.mjs              [foundation] pack loading, ZIP access, geometry, raster, lookups, weather
    clock.mjs              [foundation] Pacific time helpers
    population.mjs         [population] households and people (layer 0 core, layer 1 full)
    names.mjs              [population] name pools by heritage, sex, birth cohort
    occupations.mjs        [population] job titles by Census occupation group, sector, region, shift, wages
    persona.mjs            [persona] personality, interests, concerns, memories, speech profile, bio
    schedule.mjs           [persona] daily routines and activity at a time
    mind.mjs               [persona] mood, needs, memory stream, relationships, appraisal
    lexicon.mjs            [lexicon] regional dialects, road naming, multilingual phrase banks
    dialogue.mjs           [dialogue] the offline dialogue engine, barks
    llm.mjs                [llm] Claude bridge: prompts, streaming, reflection, model list
    platform.mjs           [integration] the public facade (createLegion) tying it all together
  src/world/               browser-only rendering
    map.mjs                [crowd] WebGL2 statewide map: base layers, camera, labels
    crowd.mjs              [crowd] GPU crowd renderer and picking
    crowd-build.mjs        [crowd] agent buffer builder (runs in a Worker; pure, testable in Node)
    street.mjs             [street] neighborhood simulation and renderer
  src/app/                 [app] the page: layout, panels, settings, styles, boot
  tools/build_pack.py      [foundation] world pack compiler
  tools/build.mjs          [app] bundles everything into Legion.html (esbuild)
  cli/legion.mjs           [app] Node CLI
  server/serve.mjs         [app] local server + Claude proxy
  tests/*.test.mjs         one file per module (node tests/run.mjs runs them all)
  tests/e2e/run.mjs        Playwright end-to-end on the built Legion.html
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
browser-only. No network calls except: `llm.mjs` (Claude), the optional live NWS refresh and the optional
OpenStreetMap (Overpass) street fetch, each behind an explicit user setting and each with an offline fallback.

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
   group. Religion appears only as an NPC's own practice (church on Sunday), never as a judgment.
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
import { Population, parseId, LEGION_SEED } from './population.mjs';
const pop = new Population(world, { seed: LEGION_SEED });
```

Addressing. Households of ZIP `zi` are `h = 0 … world.z.hh[zi]-1`. A person is `(zi, h, m)` with
`m = 0 … size-1`. Ids are strings: household `"94110-123"`, person `"94110-123-0"` (ZIP, household, member, in
decimal). `parseId(id)` → `{zip, zi, h, m}` (or null). The total over ZIPs of household sizes is the ZIP's
household population (≈ `hh × hhsize`, ≈ `pop`).

Two layers, consistent by construction: layer 0 is everything the crowd needs, computed fast; layer 1 adds the
rest and never contradicts layer 0 (it reads layer 0 and conditions on it).

**Layer 0** — `pop.householdCore(zi, h)` (≤ 5 µs, no caching needed), `pop.householdSize(zi, h)` (O(1)):

```js
HouseholdCore = {
  zi, h, id,                 // id "94110-123"
  size,                      // persons
  type,                      // 'married' | 'father' | 'mother' | 'alone' | 'roommates'   (B11001)
  tenure,                    // 'own' | 'rent'                                           (own_sh)
  dwelling,                  // 'house' | 'small-apartment' | 'apartment' | 'mobile-home'  (sfd_sh, mf5_sh, mh_sh; owners mostly houses)
  vehicles,                  // 0..5                                                     (B25044 by tenure)
  home: {x, y},              // world.homeFor(zi, h)
  heritage,                  // household heritage key (below); members inherit with some mixing
  members: [PersonCore …]    // length size
}
PersonCore = {
  m, role,                   // 'householder' | 'spouse' | 'partner' | 'child' | 'grandchild' | 'parent' | 'sibling' | 'relative' | 'roommate'
  sex,                       // 'F' | 'M'
  age,                       // integer years
  heritage,                  // usually the household's
  worker, military,          // booleans (B23025, by age)
  occ,                       // Census occupation leaf (acsLabels('occ')) for workers, else null (C24010 by sex)
  student,                   // null | 'preschool' | 'k12' | 'college' | 'grad'          (B14001, by age)
  mode,                      // 'drive' | 'carpool' | 'bus' | 'rail' | 'ferry' | 'taxi' | 'motorcycle' | 'bike' | 'walk' | 'other' | 'wfh' | null
  commuteMin,                // one way, minutes (B08303); 0 for wfh; school trips get short times
  departMin,                 // minutes after local midnight when they leave on a commute day, or null
  dwellMin,                  // minutes spent at work or school
  days,                      // bit mask of commute days, Sun=1, Mon=2, Tue=4 … Sat=64 (matches clock dow: 1 << dow)
  workZi,                    // ZIP index of the workplace or school, -1 if none or wfh
  work                       // {x, y} of the workplace or school, or null
}
```

Calibration targets (tests check these on a few thousand generated households per ZIP, for a spread of ZIPs):
household type shares ≈ B11001; mean household size ≈ `hhsize`; age-sex pyramid of persons ≈ B01001 (median
age within ±3 years, shares under 18 and 65+ within ±5 points); race shares ≈ B03002 (±4 points per group);
workers per adult ≈ B23025; commute mode shares among workers ≈ B08301 (±4 points); commute times ≈ B08303;
occupation mix by sex ≈ C24010; tenure ≈ `own_sh`; vehicles ≈ B25044. Work places: a gravity choice over ZIPs
weighted by establishments (`est`) at a distance consistent with the commute time and mode (precompute per-ZIP
alias tables by distance band; never search all ZIPs per person). Departure times: by occupation group
(construction and farming early, food service and health care with evening and night shifts, offices 7-9),
spread by the person's hash. Children go to school on weekdays (8:00 ± 20 min, back mid afternoon), mostly
nearby (walk, carpool/drive with a parent, bus). Retirees and others have no commute (mode null); their errands
are the schedule module's job.

**Heritage keys** (shared vocabulary for names, lexicon, persona, dialogue):
Hispanic `mexican salvadoran guatemalan honduran nicaraguan puertorican cuban dominican southamerican spanish
latino`; Asian `chinese filipino vietnamese korean japanese indian hmong cambodian lao thai pakistani
bangladeshi sikh afghan burmese indonesian asian`; Black `african-american ethiopian nigerian caribbean
african`; White by ancestry `armenian iranian arab assyrian russian ukrainian polish irish italian german
english scottish french portuguese dutch scandinavian greek european american`; `native` (American Indian,
California tribes); `pacific` (Native Hawaiian and Pacific Islander); `multiracial`; `other`.
Race from B03002; the Hispanic origin from B03001; the Asian group from B02015; among non-Hispanic white and
Black people the ancestry from B04006 (people of Armenian, Iranian, Arab and Assyrian ancestry are mostly
reported as white; African and Caribbean ancestries among Black people). Glendale and Burbank should produce
many Armenian households; Irvine and Westwood Iranian; Fresno and Sacramento Hmong; Long Beach Cambodian;
Little Saigon (Westminster, Garden Grove) Vietnamese; Daly City Filipino; the Central Valley Punjabi Sikh
(Yuba City, Live Oak); Ethiopian and Eritrean communities in Oakland and San Jose — all because the tables say
so, never because the code names the place.

**Layer 1** — `pop.household(zi, h)` and `pop.person(zi, h, m)` (≤ 0.3 ms, LRU-cached), `pop.get(id)`,
`pop.members(zi, h)`:

```js
NPC = {
  id, hid, zip, zi, h, m,
  role, sex, age, birthYear,                       // from layer 0 (birthYear = 2026 - age, give or take the birthday)
  pronouns,                                        // 'she/her' | 'he/him'
  race,                                            // 'hispanic' | 'white' | 'black' | 'asian' | 'aian' | 'nhpi' | 'multi' | 'other'
  heritage, heritageLabel,                         // e.g. 'salvadoran', 'Salvadoran American'
  nativity, generation, arrivalYear, birthplace,   // 'native'|'foreign'; 1 (immigrant), 2, 3 (or more); arrival for immigrants; 'Guadalajara, Jalisco' / 'Bakersfield, California' / 'Ohio'
  name: { first, last, full, display, nick },      // names.mjs, by heritage, sex, birth cohort and generation
  languages: { home, english, list },              // home language key (english spanish chinese vietnamese tagalog korean arabic armenian farsi russian punjabi hindi hmong khmer lao japanese portuguese other …); english: 'only' | 'very well' | 'limited'
  education,                                       // edu label for 25+; 'in school' or 'child' otherwise   (B15003)
  school,                                          // null | 'preschool' | 'elementary' | 'middle' | 'high' | 'college' | 'grad'
  status,                                          // 'employed' | 'unemployed' | 'retired' | 'student' | 'homemaker' | 'child' | 'military' | 'not working'
  occupation,                                      // null or { key, title, sector, employer, shift, wfh, wage }   (occupations.mjs; region-aware titles)
  income, householdIncome,                         // personal and household annual dollars   (B19001 brackets)
  commute,                                         // { mode, minutes, departMin, dwellMin, days, workZi, workZip, workCity, work, road }   (road: the highway a driver takes, from world.roadsNear)
  marital, veteran,                                // (B12001 by sex; B21001 by sex and age); consistent with role (householder and spouse are married)
  household: { id, size, type, tenure, dwelling, vehicles, yearMoved, yearBuilt, home: {x, y, lat, lon}, members: [{m, role, name, age, sex}] },
  place: { zip, city, place, countyName, countyFips, region, regionName, province, zone },
  seed                                             // uint32 for the persona
}
```

`pop.sample(zi, n, seed)` → n distinct NPCs uniform over persons; `pop.sampleState(n, seed)`;
`pop.includes(zi, h, rate)` (the crowd's deterministic household sample: `u01(hash3(seed ^ 0xC0, zi, h)) <
rate`); `pop.validate(zi, households)` → `{generated, acs}` share tables for tests and the UI's fidelity panel.

## 6. Persona, schedule, mind (`persona.mjs`, `schedule.mjs`, `mind.mjs`)

```js
import { persona } from './persona.mjs';
const p = persona(world, npc, { population: pop });   // deterministic from npc.seed and the pack, ≤ 3 ms
p = {
  id, npc,
  big5: { O, C, E, A, N },                // 0..1; priors by age and sex (small) and region/density (small) + individual spread; never by heritage
  traits: [ 'warm', 'blunt', … ],         // 3-5 adjectives derived from big5
  archetype,                              // a short role-in-life label, e.g. 'early-shift regular', 'retired gardener', 'new parent'
  values: [ … ],                          // top 3 Schwartz values (benevolence, security, self-direction …)
  interests: [ … ],                       // grounded in place, age, income, household: surfing (coast_km), skiing (snowfall_in), fishing (water nearby), hiking (peaks), gardening (house), soccer, church (church count), car shows, wine country, farmers markets, the local team …
  concerns: [ { topic, weight, why } ],   // from the data: insurance non-renewals (nonren_sh, fair_sh), wildfire (fhsz_any, firesOf), heat (h100), floods (ar_n, flood_n10), housing costs (value/inc, tenure), rent, commute (minutes), roof age (owners, roof_age, ra20_sh), smoke, water/drought (farming), jobs (unemployed) …; `why` names the datum
  memories: [ { year, date, kind, text, weight, source } ],   // the fires, ARs, wind events, FEMA disasters, heat/rain/gust records of their ZIP and county that happened while they lived there (by age and yearMoved), plus life events (moved here, kids, retirement)
  knowledge: { neighborhood, county, region, landmarks, roads, nearbyPlaces },
  speech: { dialect, register, verbosity, slang, humor, directness, codeSwitch: { lang, rate } | null, fillers, catchphrases },
  bio,                                    // two or three sentences
  hooks: [ … ]                            // things they would bring up unprompted
}
```

`schedule.mjs`: `dayPlan(npc, persona, t)` → `[{start, end, kind, place:{kind, x, y, label}, mode}]` for the
Pacific day containing `t` (kinds `sleep home commute work school errand leisure exercise worship visit`),
built from layer 0's commute fields plus errands and leisure drawn from the persona; `activityAt(npc, persona,
t)` → the current item plus `{progress, position:{x,y}}` while traveling.

`mind.mjs`: `new Mind(persona, {state})` with `state` (serializable): `mood {valence, arousal}` and an emotion
label, `needs {energy, social, fun, comfort, money}` (0..1), `memory` (stream of `{t, kind, text, importance,
tags}`), `relationships` (`{player: {affinity, trust, familiarity, met, lastSeen, facts:[…]}}`).
Methods: `tick(t, {weather, activity})`, `observe(event)`, `appraise(text)` → `{sentiment, intents, topics,
toxicity}`, `remember(text, importance, tags)`, `recall(query, k)` (recency × importance × lexical relevance),
`reflect(t)` (offline consolidation into beliefs), `feelingsToward('player')`, `toJSON()`.
`MindStore` interface: `get(id)`, `put(id, state)` with an in-memory default, a localStorage one in the app,
a JSON-file one in Node.

## 7. Voice (`lexicon.mjs`, `dialogue.mjs`, `llm.mjs`)

`lexicon.mjs` (content-heavy, data-driven):
* `dialectFor(world, zi)` → a dialect key at sub-regional grain (e.g. `sf eastbay southbay peninsula northbay
  sacramento valley-north valley-south fresno kern la-westside la-eastside sfv la-south southbay-la longbeach sgv
  oc-coast oc-inland ie desert-cv high-desert sd-coast sd-inland imperial central-coast salinas north-coast
  far-north tahoe gold-country eastern-sierra`), decided from county, place, density, coast and terrain.
* `DIALECTS[key]` → `{ name, the: true|false (SoCal "the 405"), words: {…regional vocabulary}, greetings,
  farewells, fillers, intensifiers, weather: {fog, heat, rain, wind, cold}, localTerms, prideLines,
  complaintLines }` — slot templates like `"{road} was a parking lot"`.
* `roadName(road, dialectKey)` → "the 405" / "405" / "Highway 99" / "the 99" / "PCH" / "the 1" — California
  usage by region.
* `LANGUAGES[lang]` → `{ name, greetings, thanks, farewells, interjections, family: {grandmother, …},
  affection, food: [...], phrases: {intent: [[native, gloss]]} }` for spanish tagalog vietnamese korean
  cantonese mandarin armenian farsi arabic russian ukrainian punjabi hindi hmong khmer lao japanese portuguese
  and more; every phrase correct in its language with an English gloss.
* `codeSwitch(lang, intent, rng)` → `{text, gloss}`.

`dialogue.mjs` (the offline engine; no network):
* `new Conversation({ world, persona, mind, t, rngSeed })` with `greet()`, `reply(text)` → `Line`,
  `farewell()`; `Line = { text, gloss?, intent, topics, emotion, facts: [ids of pack facts used] }`.
* Understanding: intents (greeting, how-are-you, name, job, family, weather, traffic, fire, housing, rent,
  insurance, recommend food / place, directions, opinion, history/memory, compliment, insult, joke, goodbye,
  unknown) and topics from keywords and the mind's appraisal; small talk works without the player asking.
* Generation: plan (intent → content from persona + world facts + memories + current weather and activity) →
  realize (templates with slots, many variants) → style (register, verbosity, dialect words, fillers,
  code-switching per speech.codeSwitch, mood coloring). Never the same line twice in a conversation.
* `bark(world, persona, context)` → a short line for a speech bubble (two NPCs passing, waiting at a light,
  reacting to the weather or an alert).

`llm.mjs` (Claude; the official `@anthropic-ai/sdk`):
* `MODELS` — `claude-opus-5-5` (default), `claude-sonnet-5-5`, `claude-haiku-5-5`, `claude-fable-5-2`. Use the
  exact ids. Default effort `low` for conversation (`output_config: {effort}`); thinking is adaptive (omit the
  parameter; never send `budget_tokens`, never `thinking: {type: 'disabled'}`, no sampling parameters, no
  assistant prefill).
* `systemBlocks(persona, world)` → `[platform rules (stable for every NPC), persona sheet (stable per NPC,
  cache_control ephemeral)]`. Per-turn situation (time, weather, mood, activity, recalled memories) goes in a
  mid-conversation `{role: 'system'}` message after the player's turn, so the cached prefix never changes.
* `new ClaudeVoice({ apiKey, model, effort, baseURL, proxyURL, dangerouslyAllowBrowser })` →
  `stream(persona, mind, history, playerText, {t, weather, onText})` (streams, returns `{text, usage,
  stopReason, model}`; handles `refusal`), `reflect(persona, transcript)` → structured output
  (`output_config.format` JSON schema: `{summary, facts_about_player[], affinity_delta, trust_delta, mood,
  memorable_line, follow_up}`) that the mind stores. Server-side refusal fallback on by default for Opus, Sonnet
  and Fable (`betas: ['server-side-fallback-2026-07-01']`, `fallbacks: 'default'`); typed SDK errors mapped to
  plain messages.
* `exportPersona(persona)` → the JSON a game engine needs (the persona, the system prompt, the voice settings).

## 8. Crowd and map (`map.mjs`, `crowd.mjs`, `crowd-build.mjs`)

`crowd-build.mjs` (pure; runs in a Worker and in Node tests): `buildAgents(world, pop, {rate, seed})` →
typed arrays for every person of every household `pop.includes(zi, h, rate)` selects:
`home Float32Array(2n)`, `dest Float32Array(2n)` (workplace or school), `route` (highway leg for drivers on
long trips: polyline id, start and end arc length), `timing Uint16Array` (departMin, commuteMin, dwellMin),
`days Uint8Array`, `mode Uint8Array`, `ids Uint32Array` (zi << 20 | h << 4 | m when h < 65536 and m < 16, plus a
side table for the rare overflow), with a summary (counts by mode, ZIPs covered). Drivers going over ~8 km take
the state highway network: on-ramp near home, along a `world.roads` polyline, off-ramp near the destination.
Non-commuters run errands near home at midday by hash. Built progressively (by region, statewide in under 3 s
for a million agents).

`crowd.mjs`: WebGL2 points, positions computed in the vertex shader from the simulation clock (minute of day,
day of week) and the per-agent arrays, colored by mode (walkers, drivers, cyclists, transit, people out on
errands), people at home and at work hidden (optionally shown dim as the population layer). Picking: the CPU
mirrors the shader's position function for the agents near the cursor and returns the NPC id.

`map.mjs`: the statewide canvas: state outline, neighbors, water, county lines, highways (width by AADT), ZIP
outlines when zoomed, place labels by population and zoom; pan, zoom (wheel, pinch, keys), `flyTo`; dark and
light themes from CSS custom properties.

## 9. Street view (`street.mjs`)

`new StreetView(canvas, { world, population, persona, schedule, dialogue, getTime })` with `open(x, y)`
(world units) and `close()`. Streets: OpenStreetMap ways from Overpass when the user allows network (cached
per tile), else a deterministic procedural street network shaped by the ZIP's density, dwelling mix and era
(grids for pre-war cores, curvilinear subdivisions, rural roads). Houses are placed along streets for the
households whose homes fall in view; residents follow `schedule.dayPlan`; pedestrians use sidewalks, drivers
use lanes with simple car following and stops at intersections; speech bubbles from `dialogue.bark` when NPCs
meet. Click an NPC to select it (emits `npc:select`). Day/night lighting and rain from the weather.

## 10. The app (`src/app`, `tools/build.mjs`, `cli`, `server`)

One page: a top bar (Legion, search by ZIP/city/county, the simulation clock with pause and speed, the
count of NPCs on screen and moving, settings), the map (crowd or street view), and a side panel for the
selected NPC with tabs **Profile** (identity, household, work, commute, home), **Mind** (Big Five, values,
interests, concerns, memories, mood, relationship), **Talk** (offline engine or Claude, streaming), **Prompt**
(the generated system prompt), **JSON** (export). A **Place** panel summarizes the ZIP under the cursor (the
data behind its people: Census shares vs. generated shares). Settings: crowd density, Claude key (session only
unless "remember on this device"), model, effort, network permissions (Claude, live weather, OpenStreetMap).

`app/bus.mjs`: `on(event, fn)`, `off`, `emit(event, payload)`. Events: `npc:select {id}`, `npc:hover {id}`,
`view:change {mode, x, y, zoom}`, `time:change {t}`, `settings:change {…}`, `place:select {zi}`.

`tools/build.mjs`: esbuild bundles `src/app/main.mjs` (and the crowd Worker as an inline string) into one
script, inlines the CSS and the world pack (gzip, base64) and writes `Legion.html`. `--check` verifies the
output loads in Node (no DOM) as far as the engine goes.

`cli/legion.mjs`: `sample <zip|city> [n]`, `npc <id>`, `persona <id>`, `prompt <id>`, `talk <id>` (offline, or
Claude with `ANTHROPIC_API_KEY` / `--model`), `export <zip> <n> > personas.jsonl`, `stats <zip>`.

`server/serve.mjs`: serves `Legion.html` and `POST /api/claude` (streams; the key from the server's
environment, never sent to the page), `GET /api/health`.

## 11. Integration facade (`platform.mjs`)

```js
const legion = await createLegion({ pack, seed });   // world + population
legion.npc(id)            // NPC (layer 1)
legion.persona(id)        // persona
legion.mind(id)           // Mind (from the store)
legion.conversation(id, {t})
legion.voice(options)     // ClaudeVoice
legion.sample(where, n)   // where: zip | city | county | region key
legion.dayPlan(id, t)
legion.weather(zip, t)
```
