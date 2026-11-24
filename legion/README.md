# Legion

Legion turns California's public data into every Californian as a character you can watch, meet and talk to.
Each of the 38.4 million people in the state's 13.5 million households (the Census counts 39.3 million residents;
the 0.9 million in dorms, barracks, prisons and nursing homes are not generated) comes from the Census tables of
their own ZIP code: a name, an age, a household, a home on the map, a job or a school, a commute, the languages
spoken at home.
On top of that record each one has a personality, worries drawn from the real conditions of their ZIP (fire hazard,
insurance non-renewals, heat, rent), memories of the fires, storms and heat records that actually happened where they
live, a mood that moves with the weather and the hour, and a voice: an offline dialogue engine that speaks in their
regional register and home language, and a Claude bridge for open conversation that remembers you next time.

Nobody is stored. Every person is a pure function of the world pack, their ZIP, their household and their member
number: `94110-123-0` is the same person on every machine, in the browser and in Node, every time.

What you see when you open it:

* **The state, moving.** A map of California with a crowd of about a million of these people (2.5% of the
  residents by default, from 0.5% to 10%) walking, driving the real state highways, riding transit and cycling on
  their own daily schedules. At 8 AM on a Tuesday the freeways fill; at 3 AM they empty.
* **Any place, explained.** Click a ZIP (or search a city, county or region) for its weather, its numbers, the
  languages and heritages its residents report to the Census, how they get to work, twelve residents to meet, and
  the Census shares next to the shares of the people Legion generated for it.
* **Any person, up close.** Click a dot or a resident for their record, their mind, a conversation, the exact prompt
  Claude would get, and JSON exports for a game engine.
* **The street.** "Walk the streets" opens the neighborhood around a home: houses for the households that live there,
  residents on the sidewalks and in their cars on their own schedules, greeting each other in speech bubbles.

## Open it

`Legion.html` is one self-contained file (about 4.6 MB): the world pack, the code and the Anthropic SDK are inside
it. Double-click it, or drag it into a browser window. It needs a current Chrome, Edge, Firefox or Safari (WebGL2
for the map; without it the map falls back to a slower Canvas 2D drawing) and no network: everything except the
optional features below runs offline.

To keep a Claude API key off the page, start the local server instead and open the address it prints:

```sh
cd legion
ANTHROPIC_API_KEY=sk-ant-... node server/serve.mjs      # or sign in once with `ant auth login`
# Legion on http://127.0.0.1:8787/  ·  Claude proxy at /api/anthropic  ·  credential: ...
```

The server serves `Legion.html` and answers the page's Claude requests itself with its own key, which never reaches
the browser. It listens on 127.0.0.1 unless you pass `--host`, refuses requests from other origins, and relays only
what NPC conversations need (Legion's models, a capped `max_tokens`, text messages, no tools). `node server/serve.mjs
--help` lists the options.

## Using it

* **Search** (press `/`): a ZIP (`94110`), a city (`Oakland`), a county (`Alameda County`), a Census place
  (`East Los Angeles`) or an NPC id (`94110-123-0`). The map flies there and the Place panel opens. Links keep the
  state: `Legion.html#zip=94110&npc=94110-123-0`.
* **The clock** (top bar). The simulation starts at the moment the pack's weather was fetched, Monday November 23,
  2026, 2:38 PM Pacific. Play and pause with the button or `Space`; run at 1×, 60× (a minute a second, the
  default), 600× or 3600×; drag the scrubber to any time of day; the circular arrow goes back to the snapshot.
  Everything follows this clock: the crowd, the night shading, each NPC's "now", the weather, the street view.
* **The crowd legend** (bottom of the map) says what each color is and how many are moving right now: walking
  (amber), driving (two colors: heading out, and heading home in red), cycling (green), transit (blue), out on an
  errand (violet), and at home (faint dots, off by default). Click a chip to show or hide that group. The top bar
  counts the people simulated and the people moving.
* **The NPC panel** has five tabs:
  * **Profile**: who they are (birth, heritage, generation), the languages at home and how well they speak English,
    the household with each member (click one to meet them), the home, the job, the commute, income and education.
  * **Mind**: the Big Five as bars with plain words ("very organized, dependable"), traits, an archetype, values,
    interests with the reason for each, concerns with the data behind them and its source, memories with their year
    and source, and the live mind: mood, needs, how they feel about you, what they have learned about you, and
    what they have come to think.
  * **Talk**: a conversation. The offline engine greets you when the tab opens, answers each line, and says goodbye
    when you leave. A line in another language shows its English gloss underneath; the small (i) under a line lists
    the facts it used and where they come from. The starters are about what their data holds (no question about a
    fire where none burned, no snow question where it doesn't snow). Switch between the offline engine and Claude at
    the top of the tab; the line under the switch says who is speaking.
  * **Prompt**: the exact system blocks Claude receives (the platform rules shared by every NPC, then this NPC's
    character sheet) and the situation message of this moment, with a token estimate and a Copy button.
  * **JSON**: the record, the persona and the mind as JSON (copy or download), and the **Game-engine export**: the
    persona with its system prompt and request settings, ready for another engine.
* **Talking with Claude.** Open Settings (the sliders icon): under Network, allow the Claude API, then either paste
  your API key (kept in memory for the session unless you tick "Remember the key on this device") or open Legion
  from `node server/serve.mjs`, which keeps the key on the server. Pick the model (Claude Opus 5.5 by default) and
  the effort (low by default). Replies stream in; each turn carries the moment (time, weather, what they are doing,
  their mood, memories that come to mind); when you leave, Claude reflects on the conversation and the NPC remembers
  it: your name, what you told them, how it went. Errors and refusals appear as notes from Legion, never in the
  NPC's voice. The offline engine remembers too: what you said and what you talked about.
* **The street view.** "Walk the streets" in the Place panel opens the neighborhood at the town center; the street
  icon in the NPC panel opens it at their home and follows them (if they are at work across town, a note says where
  they are). Click anyone on the street to open their panel; "Back to the map" or `Escape` returns. The clock, its
  speed and the theme are the map's.
* **Settings**: crowd density (0.5% to 10%; 2.5%, about a million people, is the default), theme (dark, light or
  the system's), Claude, and the network permissions, all off by default: the Claude API, **Live NWS weather**
  (fetches the forecast and alerts for the place you look at from api.weather.gov, at most every 15 minutes; it
  follows the clock, so the Place panel offers "Set the clock to now"; on any failure it falls back to the snapshot
  and says so) and **OpenStreetMap streets** (real streets in the street view from the Overpass API instead of
  streets drawn from the ZIP's data). "Clear NPC memories" forgets every conversation.
* **Keyboard**: `/` search, `Space` play or pause, `Escape` closes the street view, then the NPC panel, then the
  Place panel; the arrow keys, `Home` and `End` move between tabs.

## The data and its sources

Everything an NPC says about their place comes from the world pack, `data/world.json.gz`, compiled by
`tools/build_pack.py` from:

* **The California Roofer Guru atlas** (compiled 2026-11-19): 1,762 ZIPs (the pack keeps 137 of the atlas's 365
  columns: housing, roof age, climate records, wildfire history, insurance non-renewals and the FAIR Plan, business
  counts and more), the 58 counties, 774 postal cities and 515 Census places, ZIP and county outlines, the
  coastline and the larger waters.
* **U.S. Census Bureau, American Community Survey 2020-2024 5-year estimates by ZCTA**, tables B01001 (age by sex),
  B03002, B03001, B02015 (race, Hispanic origin, Asian groups), B04006 (ancestry), B05012 (nativity), C16001
  (language at home and English ability), B08301, B08303 (commute mode and time), C24010 (occupation by sex),
  B15003 (education), B12001 (marital status), B21001 (veterans), B23025 (employment), B11001 (household type),
  B25044 (vehicles), B19001 (household income), B14001 (school enrollment).
* **National Weather Service** hourly and period forecasts, observations, alerts, forecast office discussions, the
  SPC fire weather outlook and the WPC excessive rainfall outlook: a snapshot fetched 2026-11-23 22:38:55 UTC. The
  hourly forecast covers three days from then; past it, Legion uses a climate estimate from each ZIP's own records
  and says so. The optional live weather replaces the snapshot with today's forecast.
* **Caltrans Traffic Census 2024** (annual average daily traffic on the state highways).
* **USGS GNIS** domestic names (ranges, peaks, passes, deserts, valleys, waters and islands, with heights from
  USGS 3DEP) and the **California Geological Survey** geomorphic provinces.
* **CAL FIRE** fire perimeters and damage inspections (through 2025) and **FEMA** disaster declarations (through
  2026), as compiled by the atlas.

## The AI platform

* **Persona** (`src/engine/persona.mjs`). From the NPC record and the pack: the Big Five (from age, sex, how dense
  their place is and individual chance, never from heritage), traits, an archetype, Schwartz values, interests
  grounded in the place (surfing within reach of the coast, skiing where it snows, the local teams), concerns
  weighted by the ZIP's data with the column behind each one, memories of the events of their ZIP and county while
  they lived there, what they know about the area, a speech profile (regional dialect, register, fillers,
  code-switching into their home language), a short bio, and things they would bring up.
* **Mind** (`src/engine/mind.mjs`). Mood (valence and arousal) and an emotion word, needs (energy, social, fun,
  comfort, money) that move with the hour, the weather and what they are doing, a memory stream with recall by
  recency, importance and relevance, a relationship with you (affinity, trust, familiarity, facts you told them),
  and reflection that turns repeated topics into beliefs. Minds persist: in the browser in localStorage, in Node in
  a JSON file or any store you pass.
* **The offline dialogue engine** (`src/engine/dialogue.mjs`). Understands greetings, questions about work,
  family, the weather, traffic, fires, rent, insurance, food, directions, history and more; plans an answer from the
  persona, the mind and the pack; realizes it from a large template library in English and Spanish; and styles it
  in the NPC's register and dialect, with their home language mixed in at their own rate and an English gloss.
  It avoids repeating itself within a conversation, declines to generalize about groups of people or to discuss
  anyone's immigration status (and pushes back on slurs), and claims nothing the data does not hold. A reply takes
  two to four milliseconds and no network.
* **The Claude bridge** (`src/engine/llm.mjs`). The persona becomes a system prompt in two blocks: platform rules,
  identical for every NPC, and the NPC's character sheet, which ends with facts about their ZIP from the pack. Each
  player message is followed by a short system message with the moment (time, activity, weather and alerts, mood,
  feelings toward the player, recalled memories), so the cached prefix never changes: three cache breakpoints (the
  shared rules, the sheet, the conversation so far) mean a long conversation is mostly read from the cache. Server-
  side refusal fallback is on for Opus, Sonnet and Fable; thinking is adaptive; effort is low by default. When a
  conversation ends, `reflect` returns structured JSON (a summary, facts about the player, changes in affinity and
  trust, a mood, a memorable line, a follow-up) that the mind stores.
* **The CLI** (`cli/legion.mjs`):

  ```sh
  node cli/legion.mjs sample Oakland 5            # five people of Oakland
  node cli/legion.mjs persona 94110-123-0          # their persona (add --json for JSON)
  node cli/legion.mjs plan 94110-123-0 --date 2026-11-24
  node cli/legion.mjs talk 94110-123-0             # an offline conversation; /bye to leave
  node cli/legion.mjs talk 94110-123-0 --claude --store minds.json   # Claude, remembered between runs
  node cli/legion.mjs export ba 100 > bay-area.jsonl                  # game-engine exports, JSON Lines
  node cli/legion.mjs stats 94110                  # Census versus generated
  ```

  `--claude` uses `ANTHROPIC_API_KEY` or the SDK's own credential chain (`ant auth login`); `--proxy
  http://127.0.0.1:8787/api/anthropic` goes through a running Legion server instead. `--help` lists everything.
* **The game-engine export** (`exportPersona`, the JSON tab, `cli export`): the persona, the system prompt as text
  and as cached blocks, the request defaults (model, max tokens, effort, the refusal-fallback field and header) and
  the voice profile, with the turn protocol spelled out, so any engine can voice the NPC with the Messages API.
* **The platform API** (`src/engine/platform.mjs`), the same in Node and the browser:

  ```js
  import { createLegion } from './src/engine/platform.mjs';
  import { FileStore } from './src/engine/mind.mjs';

  const legion = await createLegion({ store: new FileStore('minds.json') });   // Node: data/world.json.gz
  const npc = legion.sample('Fresno', 20).find(n => n.age >= 18);
  const p = legion.persona(npc.id);
  console.log(p.bio);
  for (const c of p.concerns) console.log(`${c.topic}: ${c.why}`);   // each worry, with the data behind it

  const conv = legion.conversation(npc.id);       // offline, with their mind
  console.log(conv.greet().text);
  console.log(conv.reply("How's the weather today?").text);
  conv.farewell();
  legion.saveMind(npc.id);                         // they remember you next time

  const voice = legion.voice({ model: 'claude-opus-5-5' });   // Claude; the key from ANTHROPIC_API_KEY
  ```

  `legion.npc(id)`, `persona(id, {t})`, `mind(id)`, `conversation(id, {t})`, `voice(options)`, `reflect(id, voice,
  history)`, `prompt(id)`, `exportPersona(id)`, `sample(where, n)` (a ZIP, city, county, region key or `CA`),
  `dayPlan(id, t)`, `activityAt(id, t)`, `weather(zip, t)`, `bark(idA, idB)`. `docs/CONTRACTS.md` documents every
  module's API.

## The rules every NPC follows

* **Data provenance.** Every factual claim about the place (a fire's name and year, a record temperature and its
  date, today's forecast, the highway, how many neighbors rent or speak Spanish) comes from the pack. Nothing
  invents a statistic, a named event or a date; opinions and feelings are the NPC's own.
* **Representation.** Personality, temperament and every character trait depend on age, sex, region, density and
  chance, never on race, ethnicity, heritage, religion, nativity or immigration status. Heritage shapes names, the
  languages spoken at home, family words and some customs, modestly. No phonetic accent spelling and no broken
  English: an NPC with limited English speaks their own language with an English gloss, or plain, correct English.
  Dialect is regional ("hella", "the 405", "tule fog"), not ethnic. Politics stays local and mild; religion appears
  only as an NPC's own practice. Names are synthetic; businesses are generic. People without a home are not in the
  household data, and Legion does not invent them.
* **Determinism.** Generation never reads the clock or `Math.random`: the same inputs give the same person,
  persona, schedule and offline line everywhere.

## Architecture

```
src/engine/   rng, world, clock (the foundation) · population, names, occupations · persona, schedule, mind ·
              lexicon (42 regional dialects, the roads, 26 languages) · dialogue (the offline engine) ·
              llm (the Claude bridge) · platform (createLegion)
src/world/    map (the WebGL2 statewide map) · crowd, crowd-build, crowd-worker (the GPU crowd) ·
              street and street-* (the street view: layout, OSM, residents, simulation, drawing)
src/app/      main (boot) · services (the app's one door to the engine) · stage, place-panel, npc-panel,
              settings, search, simclock, census, nws-live (live weather), provenance · bus, store, format,
              charts, dom · app.css · index.html
cli/          legion.mjs        server/   serve.mjs (the page, /api/health, the Claude proxy)
tools/        build.mjs (Legion.html) · build_pack.py (the world pack)
docs/         CONTRACTS.md (every module's API)
```

* **Two population layers.** Layer 0 (`householdCore`, about ten microseconds a household) is what the crowd
  needs: household type, size, tenure, dwelling, vehicles, the home, and per person the role, sex, age, heritage,
  work or school, the commute mode, minutes, departure time and days, and the destination. Layer 1 (`person`,
  under a millisecond) adds nativity, languages, names, the job title, education, income, marital status and the
  highway they drive, conditioned on layer 0 so the two never disagree. Each ZIP's models are fitted from its own
  Census tables on first use (an EM over household compositions, iterative proportional fitting, logistic
  calibrations).
* **The crowd's GPU motion model.** Each agent is 32 bytes: home and destination, the commute timing and days, the
  mode, a highway leg (an on-ramp, a stretch of a real state highway, an off-ramp) and an errand plan. The vertex
  shader computes where everyone is from the simulation clock alone, so a million people move with no per-frame work
  on the CPU; a JavaScript twin of the same function answers picks and counts. The agents are built in a pool of
  Web Workers (one per spare core, at most four) that start decoding the pack while the page boots; the ZIPs are
  dealt out region by region, the region in view first, and the crowd appears as the chunks stream in.
* **Determinism and caching.** Personas are rebuilt per simulated hour (their concerns mention that hour's alerts);
  minds advance with the clock; a conversation happens at the moment it starts. The street view, the crowd and the
  NPC panel all read the same schedule, so a person is where the crowd says they are.

## Rebuilding

```sh
cd legion
npm install                              # esbuild and @anthropic-ai/sdk, the only packages
python3 tools/build_pack.py              # data/world.json.gz, from the atlas and the cached ACS tables
node tools/build.mjs --check             # Legion.html, then check it is self-contained and its pack loads
```

`build_pack.py` reads the atlas at the repository's `dist/california-roofer-guru.html` (or `--atlas <path>`) and the
ACS tables cached in `data/acs/`; `--fetch-acs` downloads them again from the Census Bureau. `tools/build.mjs`
bundles the app, the crowd worker, the SDK and the pack into `Legion.html`; the same inputs give the same bytes.

## Tests

```sh
cd legion
node tests/run.mjs                       # every unit suite, one process each
node tests/e2e/run.mjs                   # the built Legion.html in headless Chromium (Playwright), desktop and phone
node tests/e2e/crowd.e2e.mjs             # the map and the crowd on their development page
node tests/e2e/street.e2e.mjs            # the street view on its development page
```

The end-to-end tests need Playwright and its Chromium (they look in `PLAYWRIGHT_BROWSERS_PATH`, then
`/opt/pw-browsers`); none of the tests needs the network.

The unit suites cover the world, population, names, lexicon, persona, schedule, mind, dialogue, Claude bridge and
server (with a fake upstream: nothing reaches Anthropic), crowd builder, street view, the app's services and build,
the platform, the CLI and the integration of them all. The end-to-end run checks the page's whole path: boot,
search, the Place panel, every NPC tab, five offline exchanges (the weather answer states the temperature the
Place panel shows), a Spanish speaker's gloss, a Claude reply streamed through `server/serve.mjs` from a fake
upstream and reflected into the NPC's mind, the street view, the phone layout, and no page errors.
