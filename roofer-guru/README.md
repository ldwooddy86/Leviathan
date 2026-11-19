# Roofer Guru: how the dashboards are built

`louisiana-roofer-guru.html` at the top of this repository is assembled from the pieces kept here. They were written in a
scratch folder during the sessions that built the dashboard; this folder is their copy of record, so the work can be
rebuilt and carried on (a California edition is being built on it).

## What is here

| Path | What it is |
|---|---|
| `vendor/atlas/uplift-louisiana-roofing-atlas-source.html` | The Uplift Louisiana Roofing Atlas as first supplied: seventeen modules and their data, without module 18. Never edited; fixes are applied when the page is assembled. |
| `vendor/dfw/` | Libraries carried by module 18, taken from the DFW Thermal Debt Atlas's Rooftop Scout: Leaflet, three.js, the tracing model's data, ONNX Runtime, TensorFlow.js, the detail model. |
| `vendor/dfw12/` | The Scout Engine and its stylesheet as delivered in DFW build 12, before any Louisiana change. |
| `louisiana/build/` | `build.py` assembles the page; `src_fixes.json` holds the fixes to the original modules; `scout-style.css`, `scout3d.js`, `trace.js` are module 18's parts adapted for Louisiana. |
| `louisiana/tests/r10/scout_pre_r10.js` | Module 18's dashboard script as it stood before the Scout Engine was added: the base the later steps patch. |
| `louisiana/tests/r11/` | The current sources and the steps that build module 18 and the engine from them, in the order `build_r11.sh` runs them, with this round's tests. |
| `louisiana/tests/` and `louisiana/tests/suites/` | The browser suites run on every build (Playwright, headless Chromium). |

## How a build runs

`louisiana/tests/r11/build_r11.sh <out.html>` runs, in order:

1. `gen_lens.py`, `gen_en.py`: write the roof views' and the engine bar's dashboard code from the round 10 sources (`*.pre_r11.js`) plus `views_block.js`.
2. `port_engine.py`, `port_card.py`, `port_css.py`, `port_docs.py`, `port_docs2.py`: build module 18's dashboard script (`build/scout.js`) and stylesheet from the round 9 base and the block sources (`en_block.js`, `lens_block.js`, `outlook_block.js`, `card_block.js`), then its method, caveats and sources.
3. `port_lens.py`, `port_storm.py`, `port_uap.py`, `port_views.py`: build the engine (`build/engine.js`) from `vendor/dfw12/engine.js` by anchored patches: Louisiana's roofs and roof views, the storm scale (`storm_engine.js`), the flying saucer and the Tic Tac (`uap_engine.js`), and the roofing patterns.
4. `build/build.py`: puts module 18 into the original atlas and writes the page; `tests/syntax.js` parses every script in it.

Every patch is anchored on text that must occur exactly once, so a step fails loudly instead of patching the wrong place.

## Paths

The scripts name the scratch folder they were written in (`SP = /tmp/claude-0/.../scratchpad`) with this layout:
`SP/build`, `SP/dfw`, `SP/dfw12`, `SP/tests/r10`, `SP/tests/r11`, and the original atlas under the session's uploads.
To rebuild elsewhere, lay these folders out the same way (`louisiana/build` to `SP/build`, `vendor/dfw` to `SP/dfw`,
`vendor/dfw12` to `SP/dfw12`, `louisiana/tests` to `SP/tests`) and change `SP` in `build_r11.sh` and `SRC` in `build.py`.

## Tests

`louisiana/tests/r11/run_r11.sh <page> <outdir>` runs the twelve suites; `views_unit.js` checks the roof views'
arithmetic in Node; `r11_smoke.js`, `uap_shots.js`, `storm_shots.js`, `surge_shots.js`, `pattern_shots.js` and
`review_fix_check2.js` drive the engine in the browser. They were run on a software renderer (no graphics card).
