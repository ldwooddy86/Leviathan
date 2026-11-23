# Integration pass: notes (kept current)

Test page: CA/atlas/integ/page.html (build_ca.py with la_engine.js). Tests: CA/atlas/integ/*.js

## Done
- (start) page assembles; node --check on all parts passes; 07_checks 128/0.

## Next
- full-page browser run of the 17 modules (integ/run_all.js)
- FOLLOWUPS.md items
- consistency sweep, reading pass, final checks
- Baseline full-page run (integ/run_all.js): 17 modules, 0 page errors, no undefined/NaN/[object Object].
- Data: `cz` column added (06_assemble.py, CEC list; 10 of 1,762 null); `ts.ar_wy_state` added (23.5 a year, statewide
  merge) beside `ts.ar_wy` (31.4, neighbouring points only); CBECS verified from EIA Table B1 (5,918 thousand; file in
  data/dl/cbecs) and meta.assume reworded; SCHEMA.md third issue written; build_all 3 run, 128 checks pass.
- NOTE: atlas/src is now the source of truth. The jobs' part files (law_work/04a..d, work_desk/desk_*.js, ca_forge_work/copy,
  m09 ...) are stale after this pass: do not rebuild src from them.
- Jobs' own tests on the full page before fixes: core, desk 65/65, ledger, nws, law all pass; forge harness updated for C-39.
- FOLLOWUPS settled so far (edits via integ/patch.py + e1..e4.json, and inline python):
  - register notes warranty/padj/deductible reworded (04_content.js); GOUGE pattern given a word boundary (05); now
    FCOPY.LAW_SWAPPED is empty. Fallback mechanism kept as a guard.
  - houseClean keeps the hyphen in CSLB classes (00_core.js); HOUSE1 exempts them (05); "C39" in copy -> "C-39" (04);
    Forge wording about hyphens updated (21); Forge harness DASH/LOUISIANA checks updated (ca_forge_work/test/harness.js).
  - 09_sl_model HZ.month: already reads hw / sa_days / hsnow+wstorm (verified); nothing to change.
  - AR KPI: 31.4 (ts.ar_wy, by stretch of coast) labelled, 23.5 (ts.ar_wy_state, statewide merge) stated beside it (14_m02).
  - Media markets: one table MEDIA_MARKETS / REG_MARKETS in 17_m05_paid.js, by principal city, read by modules 05 and 11;
    meta.model.MKT no longer read.
  - Module 06 fhsz label: "Land in ... (%)" (3 places). Module 15: "Weather Desk". requestHosts: spc.noaa.gov dropped
    (nothing calls it; api.weather.gov is the only live weather host). LAWFAQ shown in module 03 (#l3Faq).
  - Inert stand-ins removed: 00_core RT/RTI/RLIST/SIDS; 14_m02 stormKind/stormName/SIDX/stormFoot/dmgShare/footStats/RTS.
    Kept: 02_map SEGS line layer (map API, data ships `seg` empty). PLI is live (04_content.js), not a removed name.
  - Cesar Chavez Day: renamed Farmworkers Day in 2026 (SoS list; courts schedule; copies in integ/web); 11_nws_core + m14 text.
## Next
- rebuild page, run_all, hand-off probes (m02->desk/forge fire event, m06->m01/m02, desk plan->m09/m15, m14 CSV, forge event
  pages on hz, satchel lint of forge output and desk ads, cz cool roof sentence)
- remaining follow-ups: CBECS print in m17, comp rows labelled unverified, SLM.DEF grade D wording, meta.econ vs CA_FACTS
- consistency sweep, reading pass, final checks
- Hand-offs tested (integ/p_hand.js, p_hand2.js, p_lint.js): all work. Fixed: module 02's fire hand-off (Desk matched
  "Camp Fire 2018" to nothing, Forge ignored p.fire): Desk receiver matches by id and by "<Name> Fire <year>", adds the
  option to its 120-row menu, labels fires "Camp Fire 2018"; Forge receiver reads p.fire. With a company set the Satchel
  screens the Desk's 26 assets and the Forge's 34 pages with 0 confirmed / 0 candidates. cz cool roof sentence resolves.
- More follow-ups: CBECS wording in m17; "about 689,998" -> "about 690k"; comp rows already labelled "named only";
  SLM.DEF already printed as grade D; CA_ROOFING (04_content.js) reads META.econ and META.lic for m04/m12/PL text
  (typed 5,602 licence count replaced by the data's 5,587); licence -> license and other British spellings normalized.
## Next
- consistency sweep (names, lines, figures, grades, storage keys, removed names), reading pass, final checks
- Consistency sweep done: module names/numbers agree in rendered text (fallback 'Storm Ledger' in m06 fixed); 13 lines
  same keys/names/order in PL, SLM, Forge, FCOPY, META.model; storage keys all cg.; FAIR_STATE and FIRE_STATE added to
  00_core.js (one statewide FAIR Plan home policy total 665,673 and one wildfire loss total 70,390 / 7,127 for all
  modules: shell top bar, m01, m06 changed); GRADE_KEY in 00_core.js (title on every grade pill) + footer key;
  Forge event sentence "All of them were in..." when the local count is the whole count.
- prose extracted to integ/prose/*.txt (from dump4) for the reading pass.
## Next
- reading pass (01, 02, 03, 04, 06, 11, 12, 14, 17): keep list of changed claims in this file
- final checks: node --check, run_all, jobs' tests, word search
- Reading pass: 01, 02, 04, 06, 11, 12, 14, 17 read in full (integ/prose); 03 by sampling. CLAIMS CHANGED so far:
  1. m02 LA permit pair printed in the wrong order -> "(14,511 against 10,383)".
  2. m02/m01/m11 design snow load: unit caveat added (ASCE service does not state units, HAZARD_SCHEMA "unconfirmed"),
     grade B -> C; "roofs collapsed in ... Nevada City" -> "a school roof in Nevada City" (roofing_law_evidence C5).
  3. m04 "58% built before 1980 and are on their third roof or later" -> "most ... on their second or third roof".
  4. m04 "Typed figures" note rewritten (receipts/establishments/employees now from data).
  5. m06 hail: "349 times in about 75 years ..., about six days a year" -> 349 reports since 1951; 193 days in 1996-2026 (C4).
  6. m06 Zone Zero: "approved ... No source confirmed its approval" -> Board approved the final draft; OAL approval unconfirmed (A11).
  7. m06 cool roof card: "this build does not carry the zone of each ZIP" -> it now does (cz); county panel lists zones; m03 ZIP box.
  8. m06 fire zone labels "Homes in ..." -> "Land in ..." (fhsz_sh is land share).
  9. m17 "(a hailstorm, a lender's requirement...)" -> "(a windstorm, a lender's or an insurer's requirement...)".
  10. m17 shakes: "banned in Los Angeles and San Diego, so every shake roof is a replacement" and "cannot go back on in most
      fire zones" softened to what H&S 13132.7, the two city rules and WUI code 503.2.3 say (A10).
  11. m17 "about 689,998 commercial roofs" -> "about 690k (estimate, grade D)"; CBECS anchor named with its table.
  12. 698,307 FAIR Plan policies labelled "of all kinds" (04_content x2, m03) beside the 665,673 home policies.
  13. $2.91B (all ZIPs) vs $2.90B (scored ZIPs): both now labelled in m01 KPI and m12 note.
  14. AR landfalls a year: 31.4 labelled by stretch of coast, 23.5 statewide merge stated (m02).
  15. Cesar Chavez Day -> Farmworkers Day (2026-03-31 SoS; 2027-04-09 courts' schedule).
  16. PL commercial text: typed "5,602 licenses ... November 19" -> data's 5,587 active licenses (CSLB License Master).
- Also: m12/Forge fire names with "#" print as "Number n" (they tripped SUP1); Forge deploy table has a placeholder row;
  law and Forge harnesses updated for the C-39 hyphen and the two real fires named Louisiana and Hurricane;
  meta.assume media market line reworded (data rebuilt from step 6; 128 checks, 0 failed).

## FINAL STATE (2026-11-23)
- node --check: all 42 parts pass.
- integ/run_all.js on the full page (build_ca.py with la_engine.js): 17 modules, 0 page errors, 0 flags
  (no undefined / NaN / [object Object] / null in text or attributes, no empty svg, no empty table). Same on
  integ/atlas_only.html (the atlas with no module 18 at all): the atlas does not depend on module 18.
- Jobs' tests on the final page: work_core/test_core.js no errors (155 layers, 13 lines); work_desk/harness.js 65/65;
  work_ledger/t_page.js 0 page errors, t_nws.js ok; law_work/harness.js ALL CHECKS PASSED; ca_forge_work/test/harness.js
  real data: 1,802 pages (1,660 event pages on hz), 0 problems, no block or warn finding.
- Hand-off probes: p_hand.js, p_hand2.js, p_lint.js, p_law.js, p_cons.js, p_new.js, p_tok.js (run with integ/ev.js).
- Word search of atlas/src: only DATA['parishes'] and GEO['parish'].
- Left as found (decisions): 02_map.js SEGS line layer (documented map API, data ships `seg` empty); FCOPY.LAW_SWAPPED
  guard kept (now empty); empty data keys routes/rlist/sids/zstorm still shipped (no reader); real California records
  that carry the word "Tropical Storm" (FEMA declarations for Hilary 2023 and Kathleen 1976; a Storm Events record
  type in ts.zone_county) and the Weather Service's own discussion text (which can say "storm surge") are data, shown
  only when a user opens them.
- Not done: module 18 untouched (others own it); engine/scout word leftovers in the assembled page are theirs.
