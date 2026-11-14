# DFW Thermal Debt Atlas · Build 5 · the browser app

Heating and cooling campaign intelligence for the 12 counties of Dallas Fort Worth, built for Integrity Air (Mesquite, Texas):
where the demand is, ZIP by ZIP, which service lines it splits into, what the competitors are doing, and the campaigns, pages
and compliance checks built on it. Build 5 turns the single file atlas into a Chrome extension that keeps its public data
current on its own, and adds the Heat Desk: where and when to spend on heating services and heating repair.

Two editions come out of one source tree:

| Edition | Where | What it is |
|---|---|---|
| **Browser app** (Chrome, Edge, Brave) | `app/`, or `../DFW-Thermal-Debt-Atlas-browser-app.zip` | Manifest V3 extension. A background worker refreshes every public source once a week and takes a light weather pulse every morning, whether or not the atlas is open. Toolbar badge and notifications for cold triggers. |
| **Single file** | `DFW_Thermal_Debt_Atlas.html` | Everything inline in one HTML file, as before. Opens from disk or any static host. It refreshes its live data when it is opened and a run is due; sources that do not allow calls from a web page need the browser app. |

Nothing runs on a server and nothing about you is sent anywhere. The refresh is a set of plain read requests to the public
sources listed below; brand settings, plans, API keys and account tokens stay in the browser. Two other requests are made
when the page opens, as in Build 4: the brand logo is loaded from the address set in the Brand dialog, and the single file
loads its typefaces from Google Fonts (the browser app carries the typefaces in its own folder).

## Install the browser app

From the zip, no checkout needed:

1. Download `DFW-Thermal-Debt-Atlas-browser-app.zip` from the repository root and unzip it. It holds one folder, `dfw-thermal-debt-atlas/`.
2. Open `chrome://extensions` (Edge: `edge://extensions`, Brave: `brave://extensions`), turn on **Developer mode**, choose **Load unpacked** and pick that folder.
3. The Heat Desk opens in a tab and the first refresh starts by itself. Pin the icon.

From a checkout: **Load unpacked** on `dfw-thermal-atlas/app/`.

Ways in after that:

- **The toolbar popup**: this week's cold read, the state of the live data, a refresh button, and a search over modules, cities and ZIP codes.
- **The badge**: the coldest forecast low of the next seven nights, once it reaches 40°F (blue at a freeze, violet at a hard freeze).
- **Keyboard**: `Alt+Shift+H` opens the atlas (`chrome://extensions/shortcuts` changes it).
- **Address bar**: type `tda`, a space, then a module, a city or a ZIP (`tda heat`, `tda 75150`, `tda mesquite`).
- **Links**: `atlas.html#heat`, `atlas.html#heat.75150`, `atlas.html#live`; the hash follows the module, so any view can be bookmarked.

An unpacked extension does not update its own code. What updates every week is the data. To move to a newer build, replace
the folder (or `git pull`) and press Reload on the extensions page; stored data, settings and plans are kept.

## The Heat Desk: where and when to spend on heating

Module 17 answers one question for a heating contractor with one dispatch point: where does the next ad dollar earn the
most, and what does this week's weather change. It opens with the answer in plain words, and everything under it is the
working behind that answer.

- **The answer.** Four short paragraphs: *Where* (how many ZIP codes, how close to the shop, which counties and cities
  lead), *On what* (the split between heating repair, furnace replacement, heat pump replacement and tune ups, and why),
  *This week* (what the forecast does to the budgets) and *On Monday* (the settings to change in the ad accounts).
- **The plan.** The few numbers an owner sets: monthly heating media, the month, the share held back as a freeze reserve,
  how far a lead is worth driving for each line, the bidding mode, ZIP codes to pin or block, and the line mix (automatic,
  repair first, replacement first or your own). Every other assumption sits under Advanced with its grade. The page
  recomputes as you type and keeps the settings in the browser.
- **This week.** Seven nights of National Weather Service lows turned into a budget per line and per day, with the cold
  rules that fired. Three rehearsal weeks (a freeze on the rim, a first freeze across the metro, an arctic outbreak) show
  what the same rules would do, labeled as simulations.
- **Where.** A map and a ranked table of ZIP codes with dollars, bid adjustment, confidence and the reason for each; the ZIP
  codes close to the shop that were held back and why; counties, with the observed permits and gas tests of Dallas and Fort
  Worth beside the model.
- **How sure.** Each outcome carries a range (the 10th to 90th percentile of 120 replays of the plan with the stated
  assumptions shaken) and each figure a grade from A, measured by the publisher, to D, stated. Homes, heating fuel, system
  ages and the weather are measured. Lead costs, close rates, tickets and the size of each cold response are stated
  benchmarks, so the dollar outcomes are arithmetic to steer by and never a promise.
- **Files.** The Monday pack is a zip of everything the ad accounts take: the Google Ads campaign and location files (for
  Google Ads Editor; every campaign arrives paused), Microsoft locations, the Meta and Nextdoor ZIP lists, the Local Services
  sheet, exclusions, the week sheet, the plan by ZIP and the assumptions behind them. Each file also has its own button,
  and the plan hands over to the Campaign Desk (module 08) for keywords and ad copy.

The season line, the two week outlook, permits, licenses, recalls and federal rules on the page come from the live sources
below and are hidden, with a note, until the first refresh has stored them. An outlook is a reason to hold the reserve; only
the seven day forecast and active alerts move a budget.

## What refreshes, and when

| | |
|---|---|
| **Weekly, Monday 6 am by default** | every source in the table below (about 85 small requests, half a minute) |
| **Daily, 5 am by default** | the morning pulse: forecast lows and alerts, the heating season to date, the two week outlooks, the blend of models and the Texas grid (about 45 small requests) |
| **At browser start** | a catch up, when a scheduled run was missed while the browser was closed |
| **On demand** | Refresh in the popup or in module 18, Live Data, for everything or one source |
| **Yearly, by rebuild** | the stock model (housing, heating fuel, system counts and ages, incomes) from the Census American Community Survey |

Module 18, Live Data, shows every source with its last answer, age, weight and grade, what changed since the previous week,
the run log, the schedule, and the settings (refresh day and time, the daily pulse, notifications, optional API keys, and a
switch per source). A source that fails keeps its last good data and says so.

<!-- SOURCES:BEGIN -->
12 public sources, read with plain requests (no account, no cookies). The evidence grade runs from A (measured by the publisher) to D (stated).

| Source | Publisher | What the atlas uses it for | Refresh | Grade | Where it runs |
|---|---|---|---|---|---|
| [Forecast lows, heating load and alerts](https://www.weather.gov/fwd/) | National Weather Service, Fort Worth office (NOAA) | The forecaster grid at 20 points across the 12 counties: the low of each of the next seven nights, wind chill, snow and ice, the highs and the forecast heating degree days, plus every active watch, warning and advisory. Drives the cold triggers in the Heat Desk, the toolbar badge and the notifications. | every morning | A | browser app and single file |
| [Heating equipment recalls](https://www.cpsc.gov/Recalls) | U.S. Consumer Product Safety Commission | Recalls since 2019 of furnaces and their coils, heat pumps, boilers, room heaters and carbon monoxide alarms, with units and hazard. Feeds the recall check offer and the safety copy in the Heat Desk. | weekly | A | browser app and single file |
| [Heating season to date](https://www.rcc-acis.org/) | NOAA Regional Climate Centers (ACIS), with PRISM grids from Oregon State University | Observed heating degree days since July 1 against the 1991 to 2020 normal at every reporting station in and around the 12 counties, freeze nights, first and last freeze, the same span in 30 past falls, and 4 km grids and county means of the season so far. Feeds the season line, the Heat Desk pacing and the season to date by county and ZIP. | every morning | A/C | browser app and single file |
| [Cold watches, warnings and advisories issued](https://mesonet.agron.iastate.edu/request/gis/watchwarn.phtml) | Iowa Environmental Mesonet, Iowa State University | Every dated freeze, frost, extreme cold, wind chill, winter storm, ice storm and winter weather product the National Weather Service in Fort Worth issued for the 12 counties, ten winters back and this season to date. Feeds the cold season record: products and cold hazard days by county, and how early the first Freeze Warning usually comes. | weekly | B | browser app and single file |
| [Two week outlooks and cold hazards](https://www.cpc.ncep.noaa.gov/products/predictions/814day/) | NOAA Climate Prediction Center and Weather Prediction Center | Where the seven day forecast stops: the odds of a colder or warmer than normal stretch 6 to 10 and 8 to 14 days out for the 12 counties, cold and winter hazard areas drawn for days 3 to 14, winter storm impact odds for the coming week, the hazards the forecasters name in their discussions, and the monthly and seasonal lean. Sets how early the Heat Desk stages heating repair and no heat budgets. | every morning | B | browser app and single file |
| [Blend lows and highs, days 6 to 11](https://mesonet.agron.iastate.edu/mos/) | National Weather Service blend of models, served by the Iowa Environmental Mesonet | The National Blend of Models station bulletins for six airports: each night's low and each day's high 6 to 11 days out, with the spread between the models. Bridges the seven day forecast and the 8 to 14 day outlook, and puts a number on the chance of a freeze in days 8 to 11, where a first freeze shows before any outlook map does. | every morning | B | browser app and single file |
| [Texas grid conditions and demand forecast](https://www.ercot.com/gridmktinfo/dashboards) | Electric Reliability Council of Texas (ERCOT) | The Texas grid operator's public dashboards: the grid condition level, the six day demand forecast and the measured load of the North Central weather zone. It can tell a heating advertiser when the whole state braces for cold (a Weather Watch comes days ahead of a hard freeze; a Conservation Appeal or an Energy Emergency Alert means outage risk and no heat calls when power returns) and when electric heat carries the grid (the daily peak moves to the morning). It cannot tell which county or ZIP is cold, how hard gas furnaces run, or anything past six days; most weeks it reads normal and says nothing. | every morning | B | browser app only |
| [Dallas mechanical permits and gas tests](https://www.dallasopendata.com/d/e7gq-4sah) | City of Dallas, Dallas OpenData | Residential heating and air conditioning permits of the City of Dallas by month and by ZIP code, the ones that name heating equipment, and gas tests: plumbing permits for a pressure test of a home's gas line, usually after a shut off, a meter release or a repair, which mark homes putting gas heat back in service (a lead indicator of heating demand by ZIP code, grade C, not a count of heating jobs). ZIP codes are usable from June 2025 on (and in 2018 to 2020), months before May 2024 are a gap in the city's file and are left out, and contractor and value are empty from October 2025 on. | weekly | B | browser app and single file |
| [Fort Worth mechanical permits](https://www.arcgis.com/home/item.html?id=d2740f4d746b4bfaa03e25de0376238b) | City of Fort Worth, Development Services | Heating and air conditioning permits pulled outside a building permit in Fort Worth: by month for three years, by ZIP code for the last 12 months, and the last eight weeks against the same weeks a year earlier. The one observed count of replacement work by ZIP code, used to check the replacement model and to see where the work is being done; the city does not record whether a job was heating or cooling. | weekly | B | browser app and single file |
| [Air conditioning contractor licenses](https://data.texas.gov/dataset/TDLR-All-Licenses/7358-krk7) | Texas Department of Licensing and Regulation, on the Texas Open Data Portal | Active air conditioning and refrigeration contractor and technician licenses in each of the 12 counties, the licenses expiring soon and the license numbers first issued in the last 12 months. Contractors per home is the competition a heating ad bids against, and the new licenses show where it is growing. | weekly | A | browser app and single file |
| [Census vintage watch](https://www.census.gov/programs-surveys/acs/news/data-releases.html) | U.S. Census Bureau, American Community Survey | Watches for the next American Community Survey five year file. The stock model (heating fuel, owner or renter, year built) is compiled from the 2020 to 2024 file; when a newer one is published this says so, and the model can be rebuilt. *(takes an optional free API key)* | weekly | A | browser app and single file |
| [Federal rules on heating equipment, refrigerants and advertising](https://www.federalregister.gov/) | Office of the Federal Register (National Archives) | Federal Register documents of the last 24 months on consumer furnaces and heat pumps, refrigerants, the residential energy credits, and reviews, fees and recurring plans in advertising, plus the standing rules still in force. Keeps heating offers and ad copy in step with the rules: which equipment may be sold, which dates are coming, which claims are regulated. | weekly | A | browser app and single file |

Hosts the browser app may call for these: `api.census.gov`, `api.weather.gov`, `data.rcc-acis.org`, `data.texas.gov`, `mapservices.weather.noaa.gov`, `mesonet.agron.iastate.edu`, `services5.arcgis.com`, `www.dallasopendata.com`, `www.ercot.com`, `www.federalregister.gov`, `www.saferproducts.gov`, `www2.census.gov`. The Weather Desk also reads `api.weather.gov` and `www.spc.noaa.gov` when it is open.
<!-- SOURCES:END -->

## Adding a source

A source is one file under `app/live/sources/` that calls `TDA_LIVE.register({...})`, plus one line in
`atlas.template.html` (the build copies the list into the worker and the popup) and its host in the manifest's
`host_permissions` (a test fails until all three agree).

```js
TDA_LIVE.register({
  id: 'my_source',                       // snake_case; also the storage key
  name: 'What it is', publisher: 'Who publishes it', page: 'https://a page a person can read',
  about: 'One sentence: what the atlas uses it for.',
  hosts: ['api.example.gov'],            // every host run() calls
  cadence: 'weekly',                     // or 'daily' for the morning pulse
  cors: true,                            // false: the host refuses calls from a web page, so only the browser app and Node run it
  grade: 'A', terms: 'License or terms of use, in a few words',
  labels: { count: ['Things counted', 'n'] },   // how each digest figure is named in "what changed since last week"
  async run(ctx) {                       // ctx: { http: { json, text }, now, prev, key, settings, env, geo }
    const rows = await ctx.http.json('https://api.example.gov/things?since=2026-01-01');
    return { rows: rows.map(r => ({ d: r.date, n: +r.n })) };       // small, plain JSON: this is what is stored
  },
  digest: data => ({ count: data.rows.length })                      // a few numbers to compare week over week
});
```

`ctx.http` waits its turn per host, times out, retries only 429 and 5xx, sends no cookies and no identifying header. A
source that throws keeps its last good record and shows the error in Live Data. Keep what `run` returns small (the whole
store should stay under a few megabytes), record a real answer under `tests/fixtures/<id>/` and test the parser against
it, and state the evidence grade honestly. `node tools/refresh.mjs --only my_source --dry` runs one collector from the
command line.

## How it is built

- `atlas.template.html` is the page skeleton. `build.mjs` turns each `<!--@js path-->` line into an inline `<script>` for the
  single file and a `<script src>` for the browser app page, so both editions run the same code. Extension pages may not run
  inline script or `eval`; the atlas uses neither, and the build refuses a tree that would.
- `app/live/core.js` is the live layer: a registry of collectors, a polite HTTP helper (one request at a time per host, a hard
  timeout, retries only for 429 and 5xx, no cookies), the schedule and the store. The same file runs in three places: the
  atlas page, the background worker and Node. `app/live/sources/*.js` are the collectors, one per source; each documents its
  requests and states its evidence grade. `app/live/derive.js` turns the records into the cold picture, the badge and the notices.
- `app/background.js` owns the schedule in the browser app: one shot alarms set again before every run (so daylight saving
  never drifts them and a run that is cut short cannot take the schedule with it), a lock so the page and the worker never
  refresh at once, and a catch up at start. Chrome stops an idle worker after 30 seconds, so a run in progress keeps the
  worker awake, and a retry alarm picks up a run that was stopped anyway: it keeps what was already fetched. The same
  alarm stays armed when a run ends with sources that failed (a laptop fires its missed alarms the moment it wakes, often
  before its network is back): eight minutes later it asks again for what is due, or else only for the sources that
  failed, and gives up after two tries per scheduled run. When not one source has answered (a machine with no network)
  it goes on looking once an hour until the run is in. A weekly source that was down on Monday is asked once more with
  each morning's pulse until it answers. A full refresh that comes due while a smaller run is in flight follows it, and a
  cold spell or a cold shot in the outlook is announced once, not again every morning as its nights pass. The morning pulse goes by its hour, not by the time since the last refresh, so a
  refresh pressed in the afternoon does not cost the next morning its forecast.
- `app/live/page.js` is the page's handle on all of it (`LIVE`): the records, their ages, a refresh the page can run itself,
  and a `live` event the modules redraw on. `app/data/live-baseline.js` is a snapshot of the records baked at build time, so a
  fresh install and the single file open with current data before their first refresh.
- The modules are the Build 4 scripts, one file each under `app/js/`, plus `28_heat_core.js` (the Heat Desk engine, `HEATX`:
  the plan, the week, the ranges and the export files, with no page code in it), `31_m17_heat.js` (the Heat Desk page) and
  `32_m18_live.js` (Live Data).

```
app/                     the unpacked extension: manifest, worker, popup, the atlas page and everything it loads
  atlas.html             generated: the atlas page with external scripts
  registry.js            generated: modules and ZIP codes for the popup, the address bar and the worker
  background.js          service worker: schedule, refresh, badge, notifications, keyboard command, address bar keyword
  popup.html / popup.js  the toolbar popup
  open.js                search over modules and ZIPs; find or open the atlas tab
  css/ js/ data/ fonts/ icons/
  live/                  the live layer: core, geo, sources/, derive (cold picture), climate (season), outlook (two weeks), permits, page
atlas.template.html      the page skeleton both editions are rendered from
build.mjs                build, validate, release
DFW_Thermal_Debt_Atlas.html   the single file edition (written by a release build)
tools/                   unpack (the one time split of the Build 4 file), fonts, icons, drive, refresh, snapshot
tests/                   unit tests, page tests, the end to end run, recorded fixtures
```

## Build, refresh, release

Node 22, no packages.

```
node build.mjs                 # app/atlas.html, app/registry.js and dist/DFW_Thermal_Debt_Atlas.html
node build.mjs --check         # validate only
node tools/refresh.mjs         # run every collector in Node and bake app/data/live-baseline.js
node tools/snapshot.mjs        # re bake the Weather Desk snapshot with the page's own fetch code
node build.mjs --release       # also write DFW_Thermal_Debt_Atlas.html here and ../DFW-Thermal-Debt-Atlas-browser-app.zip
```

A release is `refresh`, `build`, `snapshot`, `build --release`, in that order. `tools/fonts.mjs` and `tools/icons.mjs`
regenerate the bundled typefaces and the icons; `tools/unpack.mjs` is the one time, lossless split of the Build 4 single file
(`node build.mjs --verify <that file>` proved the tree rebuilt it byte for byte before anything was changed).

## Tests

```
node tests/run.mjs             # unit: the live runtime, every collector against recorded answers, the calendar and bad answers, the cold picture, the worker's schedule, the build
node tests/page/run.mjs        # page: every module and every fix, driven in headless Chromium with no network
node tests/e2e/run.mjs         # end to end: the unpacked extension in Chromium, the worker's own first refresh against the live sources
```

The page and end to end runs need Playwright (`npm install` here, then `npx playwright install chromium`). The end to end run
calls the public sources once; `--offline` skips that part.
