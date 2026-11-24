# California Roofer Guru: where it stands and what is next

Written November 24, 2026, when work paused. `california-roofer-guru.html` at the top of the repository is the current
build. Rebuild it with `bash build/assemble_ca.sh <out.html>` (see `../README.md` for the folder layout; the scripts name
the scratch folder they were written in).

## Checked on the current build
- `build/ca_smoke.js` passes at Coronado and at Hollywood (Los Angeles): all eighteen modules render with no page
  errors and no blank values, the Scout tab loads buildings, the engine opens on real terrain, the nine-step rain scale
  and the dry wind scale set, the Alta X warning is word for word, the aircraft kit answers, the M3 comes out.
- The seventeen atlas modules were tested together on the final data (`atlas/INTEGRATION_NOTES.md`).
- Each engine job's own tests are in its folder (`engine/<job>/NOTES.md`, `tests/`, `out/`).

## Not checked, or known not right (most important first)
1. Nothing has run on a real graphics card. Every browser test used a software renderer. Rain streaks, frame rate,
   the frame pacing allowance (`engine/dense`) and the look of the car and the roof patterns need a look on a real card.
2. Rooftop Scout: the quality pass is done on this build (`scout/NOTES.md`): the engine bar by real clicks and keys,
   the eight roof views looked at in pictures at Irvine, Berkeley, Altadena, Mammoth Lakes and Coronado (the tile, shake
   and gravel patterns rewritten until they read right), the card at 22 addresses, layout at 1280, 1024 and 390 px, the
   method and sources text, and Louisiana's suites ported (`scout/tests/la_port`). Left: `inj8` and `inj_sk` moved to a
   single-family area and rerun; `review_fix_check2` rerun; a picture of the 3D view's freeway lines and cable rails;
   the Mammoth snow-load view re-shot after its last change. Not fixed: once, after "Back onto the road" beside a
   building, the pad throttle barely moved the M3 until the next reset; the aircraft switch rebuilds every road (a
   freeze of seconds); `en.air.info()` names only the nearest airport; the offshore wind is named "Diablo" at Mammoth
   Lakes; a 2005 Irvine tile tract reads tile 52 percent, shingles 43; the Thermal view takes air temperature at the
   ZIP's height, not the building's.
3. Engine integration left undone (`engine/integ/NOTES.md`): the 100, 150 and 251 mph runs on the regraded freeway and
   the change of origin at speed; weather on terrain looked at (snow on the far mountains, marine layer and tule fog
   slabs, haze from the ground): `integ/tests/t_wx.js` is written; aircraft and ships against terrain and sea level
   (`t_air.js`); warp, night, idle and memory with everything on (`t_cross.js`); frame cost by part (`t_cost.js`); both
   bridge drives rerun after the last two fixes; the Bay Bridge and Vincent Thomas crossings; tunnels (the car goes over
   the hill, traffic under); buildings and parked cars left in a freeway's lane until their cell rebuilds.
4. No claims review and no code review of the California build as a whole (Louisiana had several rounds of each).
   The places most worth a reviewer's eye: `scout/scout.js` (outlook, weather on record, stated judgments),
   `atlas/src/04_content.js` (law register), `08_forge_copy.js` (page copy), `data/SCHEMA.md` (the 22 assumptions in
   `meta.assume`), the weather kit's step notes.
5. Smaller items: `FOLLOWUPS.md` (all settled by the atlas integration pass, kept for the record); the M3's rear is
   plainer than the real car; no CMV-22B, no parked airliners at gates; cable cars never seen in a picture; real
   California records can show "Tropical Storm" (Hilary 2023) and live forecast text can say "storm surge".

## Choices made for the user that they may want changed
- Name "California Roofer Guru"; module 18's tab "Rooftop Scout".
- Thirteen service lines (hail and FORTIFIED out; wildfire, fire hardening, tile relay, solar detach and reset in).
- Eleven regions. Storage keys start `cg.`.
- The M3 is the model-year 2027 petrol M3 Competition; 251 mph is reached by scaling its engine, and the page says so.
- Rain rate and wind for each atmospheric river rank, the Alta X's 34 mph gust limit, roof pitch (4 to 5 in 12), and
  every figure listed in `meta.assume` are choices, marked as such where they show.
