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
sources listed below; brand settings, plans, API keys and account tokens stay in the browser.

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

## What refreshes, and when

| | |
|---|---|
| **Weekly, Monday 6 am by default** | every source in the table below |
| **Daily, 5 am by default** | the weather pulse: forecast lows and alerts (about 20 small requests) |
| **At browser start** | a catch up, when a scheduled run was missed while the browser was closed |
| **On demand** | Refresh in the popup or in module 18, Live Data, for everything or one source |
| **Yearly, by rebuild** | the stock model (housing, heating fuel, system counts and ages, incomes) from the Census American Community Survey |

Module 18, Live Data, shows every source with its last answer, age, weight and grade, what changed since the previous week,
the run log, the schedule, and the settings (refresh day and time, the daily pulse, notifications, optional API keys, and a
switch per source). A source that fails keeps its last good data and says so.

<!-- SOURCES:BEGIN -->
<!-- SOURCES:END -->

## How it is built

- `atlas.template.html` is the page skeleton. `build.mjs` turns each `<!--@js path-->` line into an inline `<script>` for the
  single file and a `<script src>` for the browser app page, so both editions run the same code. Extension pages may not run
  inline script or `eval`; the atlas uses neither, and the build refuses a tree that would.
- `app/live/core.js` is the live layer: a registry of collectors, a polite HTTP helper (one request at a time per host, a hard
  timeout, retries only for 429 and 5xx, no cookies), the schedule and the store. The same file runs in three places: the
  atlas page, the background worker and Node. `app/live/sources/*.js` are the collectors, one per source; each documents its
  requests and states its evidence grade. `app/live/derive.js` turns the records into the cold picture, the badge and the notices.
- `app/background.js` owns the schedule in the browser app: one shot alarms re armed after every run (so daylight saving never
  drifts them), a lock so the page and the worker never refresh at once, and a catch up at start.
- `app/live/page.js` is the page's handle on all of it (`LIVE`): the records, their ages, a refresh the page can run itself,
  and a `live` event the modules redraw on. `app/data/live-baseline.js` is a snapshot of the records baked at build time, so a
  fresh install and the single file open with current data before their first refresh.
- The modules are the Build 4 scripts, one file each under `app/js/`, plus `31_m17_heat.js` (Heat Desk) and `32_m18_live.js`
  (Live Data).

```
app/                     the unpacked extension: manifest, worker, popup, the atlas page and everything it loads
  atlas.html             generated: the atlas page with external scripts
  registry.js            generated: modules and ZIP codes for the popup, the address bar and the worker
  background.js          service worker: schedule, refresh, badge, notifications, keyboard command, address bar keyword
  popup.html / popup.js  the toolbar popup
  open.js                search over modules and ZIPs; find or open the atlas tab
  css/ js/ data/ fonts/ icons/
  live/                  the live layer: core, geo, sources/, derive, page
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
node tests/run.mjs             # unit: the live runtime, every collector against recorded answers, the cold picture, the build
node tests/page/run.mjs        # page: every module and every fix, driven in headless Chromium with no network
node tests/e2e/run.mjs         # end to end: the unpacked extension in Chromium, the worker's own first refresh against the live sources
```

The page and end to end runs need Playwright (`npm install` here, then `npx playwright install chromium`). The end to end run
calls the public sources once; `--offline` skips that part.
