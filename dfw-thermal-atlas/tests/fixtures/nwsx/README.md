# Fixtures for the Weather Desk page test (tests/page/16-weather.page.mjs)

The test opens the atlas with no network and puts these files in place of the snapshot baked into the build, of the page's
weather cache (`localStorage['tda.nws.v2']`) and of the live layer records the desk reads, so that a re baked snapshot or baseline never
moves what the test expects. Layers no screen reads (sky cover, wind gust, relative humidity, rain probability, heat risk)
are emptied and long texts are cut; the shape is the one `NWSX` caches.

| File | What it is |
|---|---|
| `snapshot-2026-09-26.json` | The National Weather Service snapshot Build 4 shipped with (`app/data/nws-snapshot.js` at commit 84081bd), fetched 2026-09-26 20:18 UTC: a hot late September week with one Air Quality Alert. |
| `cache-live-week-2026-11-13.json` | `{ fetched, data }` as the page caches it: the answer of api.weather.gov and www.spc.noaa.gov on 2026-11-13 18:15 UTC, recorded by the page's own fetch code. A mild November week (lows 44 to 58°F at the Mesquite grid). |
| `synthetic-cache-freeze-week.json` | The same week made 24°F colder (hourly forecast, grid highs, lows, apparent temperature, station reports), with twelve hand made alerts: nine winter products, a statement with no rule, and a freeze warning whose message has lapsed while its hazard has not. Never a real forecast. |
| `live-nws-cold-2026-11-13.json` | The `nws_cold` record of the live layer (20 forecast points in the 12 counties) as collected on 2026-11-13 18:15 UTC. Coldest low: 40°F on Sunday night at Denton. |
| `live-acis-season-2026-11-13.json` | The `acis_season` record of the live layer, made by running the collector on the recorded ACIS answers of `tests/fixtures/acis/` and cut down to DFW Airport: through 2026-11-12, 29 heating degree days against a normal of 157, no freeze yet. |
| `synthetic-live-outlook-2026-11-13.json` | Hand made, never published by anyone: the three outlook records of the live layer (`cpc_outlook`, `nbm_extended`, `ercot_grid`) copied from the base case of `tests/fixtures/outlook/synthetic-outlook-cases.json` and moved 18 days back to 2026-11-13. `quiet`: near normal on both outlook maps (the live layer reads "No cold signal past the seven day forecast"). `cold`: the same with days 8 to 14 below normal at 50 percent ("Cold favored, Nov 20 to 26: days 8 to 14 favor a colder than normal stretch (50 to 60 percent)"). Drives the one optional outlook line of the heating view. |
| `build4-summer-desk.json` | Not an input: what the Build 4 single file (commit 84081bd) shows on the Weather Desk with `snapshot-2026-09-26.json` as its snapshot, no network, the clock at 2026-09-26 21:00 UTC and the browser in America/Chicago. Tiles, day cards, plain words, alert, station table, outlook table, season boxes, the bid windows of all 14 lines, their ad schedule files in full, and the first 16 characters of the SHA 256 of each hourly plan file and of the weather file. The test holds the summer desk of Build 5 to it, line by line, apart from the defects it names. |

The figures the test expects for the freeze week were worked out by hand from `synthetic-cache-freeze-week.json`; the sums
are written beside them in the test.
