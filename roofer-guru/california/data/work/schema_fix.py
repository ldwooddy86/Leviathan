import re, sys
p = sys.argv[1]
s = open(p).read()


def sec(start, end, new):
    global s
    i = s.index(start)
    j = s.index(end, i + len(start))
    s = s[:i] + new + s[j:]


def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (s.count(a), a[:60])
    s = s.replace(a, b)


rep("Written 2026-11-19 by the data build (CA/data). Output file: `CA/data/out/ca_atlas_data.json`.",
    "Second issue, 2026-11-23, by the data build (CA/data). It describes the file as built: `CA/data/out/ca_atlas_data.json`\n(4.9 MB at this issue; `out/build_report.md` has sizes and the 128 checks; `out/ca_zip_index.json` has the ZIP row order,\nthe county order and the map constants). First issue 2026-11-19.")
rep("   largest land share is in California and ACS B01003 shows one resident or more. ZCTAs that are\n   mostly Nevada or Oregon are out.",
    "   largest land share is in California and ACS B01003 shows one resident or more: **1,762 rows**\n   (1,531 scored). Out: 5 ZCTAs that are mostly Nevada or Oregon, 40 with no residents, and 97635 (an\n   Oregon post office whose ZCTA lies mostly in Modoc County, 239 residents: the page's ZIP pattern\n   `9[0-6]ddd` cannot match it).")
rep("| `pts`, `ptflags` | hazard job | section 4 | located weather and fire reports |",
    "| `pts`, `ptflags`, `ptkinds` | hazard job | section 4 | located weather reports; `[]` until `hazard_pts.json` exists |\n| `hz` | hazard job | section 4 | the event ledger (`hazard_events.json`: fires, `zfire`, `zdins`, atmospheric rivers, wind events); absent until that file exists |")
rep("| `places` | kept | `{name, lat, lon, pop, cdp}` | Census places for map labels (all places of 10,000 or more, plus every county seat); section 5 |",
    "| `places` | kept | `{name, lat, lon, pop, cdp, seat, pi}` | Census places for map labels (all 457 places of 10,000 or more, plus every county seat: 515); section 5 |")
rep("| `relief` | new, optional | section 6 | small shaded relief grid for the atlas map (only if built; null otherwise) |",
    "| `relief` | new, optional | | NOT BUILT: `null`. (The Scout tab gets terrain separately.) |")
rep("| `val1m_sh` | new | owner homes valued $1,000,000 or more, % of owner homes | B25075_024.._027 / _001 |",
    "| `val1m_sh` | new | owner homes valued $1,000,000 or more, % of owner homes | B25075_025.._027 / _001 |")
rep("| `moved10_sh` | new | households that moved in 2010 or later... % (owners and renters) | B25038 |",
    "| `moved10_sh` | new | households that moved in 2010 or later, % (owners and renters) | B25038 (_003.._005 + _010.._012) / _001 |")
rep("| `roofs` | kept | one unit roofs, count (= sum of `agez[zip]` = `u1` to rounding) | model |",
    "| `roofs` | kept | one unit roofs, count (= sum of `agez[zip]`; = `u1` to rounding, less homes destroyed by fire in 2024 and 2025 and not yet rebuilt) | model |")
rep("| `lastfire` | renamed from `last64` | most recent year a wildfire destroyed or damaged structures in the ZIP (CAL FIRE damage inspections); null when none on record | hazard job |",
    "| `solar_n` | new | one unit homes with rooftop solar, count | California Distributed Generation Statistics, interconnection applications to 2026-09-30 (PG&E, SCE, SDG&E): interconnected residential photovoltaic sites, not decommissioned, distinct sites. Where a city or district utility serves the ZIP (338 ZIPs: Los Angeles DWP, SMUD and others) the file has nothing: the ZIP takes its county's share from covered ZIPs or the older Google Project Sunroof count, whichever is larger |\n| `solar_sh` | new | `solar_n / u1 x 100`, capped at 80 | |\n| `solar_src` | new | `nem` (counted) or `est` (estimated as above) | |\n| `solar_new` | new | of the counted sites, those approved in 2020 or later | same file |\n| `solar_batt` | new | counted sites with battery storage | same file |\n| `lastfire` | renamed from `last64` | most recent year a wildfire destroyed or damaged structures in the ZIP (CAL FIRE damage inspections 2013 to 2025); null when none on record | hazard job (this build's own count until its file exists) |")
rep("| `yrsfire` | renamed from `yrs64` | `2026 - lastfire` | |",
    "| `yrsfire` | renamed from `yrs64` | `2026 - lastfire` | |\n| `fire_dest`, `fire_dmg` | new | structures destroyed, and damaged, in the ZIP in CAL FIRE damage inspections 2013 to 2025 | hazard job (own point in polygon count until then) |\n| `fire_res` | new, temporary | residences destroyed (this build's count). Dropped when the hazard job's `fire_dest_res` is present | |\n| `fire_nxt` | new | wildfire rebuild and repair roofs expected in the next twelve months: 40% of residences destroyed in 2022 to 2025, a quarter each year, plus half of the residences damaged in 2025 | model, grade D |")
sec("### E. Hazard columns", "### F. FEMA", """### E. Hazard columns (hazard job; merged by this build)

Every ZIP column that `CA/data/hazard/HAZARD_SCHEMA.md` section 1 declares is carried under the name given
there, with that file's meaning, unit and grade: atmospheric rivers (`ar_n`, `ar_d`, `ar1d`..`ar5d`, `ar_days`,
`ar3_d`, `ar3_n`, `ar45_dec`, `ar_max`, ...), rain (`rain_in`, `rain_d1`, `rain_d2`, `rain_rec_in`, ...), wind (`g40`,
`g58`, `g75`, `gust_max`, `wd58`, `wd75`, `hw_yr`, `sa_ep`, `di_ep`, `su_ep`, `off_kind`, `off_cls`, `asce_wind`, ...),
wildfire (`fhsz_vh`, `fhsz_high`, `fhsz_mod`, `fhsz_sh`, `fhsz_any`, `fire_n`, `fire_big`, `burn_sh`, `fire_km`,
`fire_dest`, `fire_dmg`, `fire_dest_res`, `fire_dmg_res`, `fire_insp`, `lastfire`, `fire_worst`, ...), snow (`snow_psf`,
...), heat (`h90`, `h100`, `h110`, `tjul`, ...), hail and thunderstorm counts (`hd1`, `hail_n25`, ...), coast
(`coast_km`, `salt_cls`, `marine_cls`), elevation, and the stress scores (`st_*`, `stress`, `st_top`).
HAZARD_SCHEMA.md is the record for those columns; this file does not repeat it. Three rules of the merge:

- The hazard job's `lat`, `lon` (its "town point") are carried as **`tlat`, `tlon`**. `lat`, `lon` stay the Census
  internal point (group A).
- Its identity columns (`zip`, `fips`, `county`, `reg`, `in_ca`) are not carried: use `zip`, `pi`, `reg` of group A.
- Where it and this build both have a column (`fire_dest`, `fire_dmg`, `lastfire`, `yrsfire`), the hazard job's value is shipped.

The list actually shipped is in `meta.hazard.cols`, and `meta.hazard.src` says where it came from.
**State at this issue:** `out/zcta_hazard.json` did not exist yet, so the columns come from the hazard job's work
tables (`zcta_station`, `zcta_ar`, `zcta_fire`, `zcta_wind`, `zcta_base`): 95 columns, only names its schema declares.
Columns from its later steps (snow, hail, the stress scores, `ar_days`, `zone`) are not in the file yet. Rerunning
`bash build_all.sh 3` after the hazard job finishes carries its whole final table.
Louisiana's `hd1` survives only as the hazard job's column; `hd175, hd2, hd1_10, wd50, wd65, td1, ev_h1, ev_h175,
ev_w58, ev_w75, ev_t, ev_dmg` are dropped unless that job writes them.

""")
rep("| `z_<line>` | kept | z score of ln(`r` + 0.01) across scored ZIPs (population SD). The 0.01 is new: a California ZIP can have a zero rate (`fire`), a Louisiana one could not |",
    "| `z_<line>` | kept | z score of ln(`r` + 0.01) across the 1,531 scored ZIPs (population SD). The 0.01 is new: a California ZIP can have a zero rate, a Louisiana one could not |")
rep("| `comp_pct` | kept | competitive pressure percentile among scored ZIPs of `0.6 x rank(comp_mass) + 0.4 x rank(roof_mass)` |",
    "| `comp_pct` | kept | competitive pressure: percentile among scored ZIPs of `0.6 x percentile(comp_mass) + 0.4 x percentile(roof_mass)` |\n| `storm_x` | new | the wind and rain exposure index the storm line is spread by, x 1000 (section 12) |")
sec("## 3. `parishes`", "## 4. Hazard job keys", """## 3. `parishes` (the 58 counties)

Kept fields, same meaning: `fips` ("06001"), `name` (no "County"), `reg`, `aland`, `awater`, `pop`, `hh`,
`inc`, `value`, `own`, `spanish`, `viet`, `pop5`, `a65p`, `hu`, `occ`, `rent`, `mh`, `u1`, `mf5u`, `seas`,
`yb[10]` (newest first), `yb_med`, `mort_sh`, `rooms` (all from the ACS county rows, not ZIP sums);
`roofs`, `ra15`, `ra20`, `wave`, `nxt`, `hist` (ZIP sums; `hist` = `{"2000".."2026": [age driven incl. tile relays,
wildfire rebuild and repair roofs]}`); `fema` (`{disaster number: roof or property registrations}`), `fema_k`;
`bps` (`{"2005".."2025": [units in one unit buildings, all units, buildings]}`: element 2 is ALL residential
buildings authorized, unlike Louisiana's small third number), `ytd26`, `ytd25` (January to September, units);
`est`, `roofers`, `lic`, `cru`, `supply`, `adjusters`, `ins_agents` (ZIP sums); `nzip`; `fees`; `comp` (offices of
named companies in the county); `cbp_roof`, `cbp_roof_emp`, `cbp_sup` (County Business Patterns 2023, null when
withheld: 8 counties); the thirteen `p_<line>`.

Dropped: `french`, `hd1`, `hd175`, `wd50`, `wd65`, `td1`, `hur64`, `hur50`, `ts34`, `n64_00`, `vmax_00`,
`vmax_20`, `trop`, `ev`.

New: `seat` (county seat), `lat`, `lon` (label point), `chin`, `tagalog`, `korean`, `arabic` (speakers),
`ra25`, `nxt_t`, `tile_n`, `tile25`, `solar_n`, `lic_all`, `lic_cnty`, `lic_cnty_all` (CSLB's own county field: active,
and all), `nes2381`, `nes2381_rcpt` (Nonemployer Statistics 2024, firms and receipts in $1,000, NAICS 2381),
`fair_pif`, `fair_pif22`, `fair_tiv` ($ million, 2026), `fair_all` (all lines, five year-ends, the Plan's county
file), `ins_pol`, `nonren`, `nonren_sh` (2023), `nonren4`, `wf_claims`, `wf_loss`, `wf_hi_sh`, `fema_reg`, `fema_dest`,
`fema_all` (`{disaster number: all registrations}`), `fire_dest`, `fire_dmg`, `lastfire`, and
`hz` = `{hazard column: resident weighted mean of the county's ZIP values}` for every numeric hazard column
(the replacement for Louisiana's county hazard rates: `PA[i].hz.g58`, `.rain_in`, `.fhsz_sh` and so on).

""")
sec("## 4. Hazard job keys", "## 5. `cities`", """## 4. Hazard job keys (not written here; merged from CA/data/hazard/out when the files exist)

| hazard file | where it lands | state at this issue |
|---|---|---|
| `zcta_hazard.json` | ZIP columns of group E; county `hz` | not on disk: interim work tables used |
| `hazard_events.json` | top-level `hz`, whole | not on disk: no `hz` key |
| `hazard_ts.json` | every key into `ts` (`month`, `hour`, `year`, `dowhour`, `ar_wy`, `sa_year`, `rain`, `fema_decl`, `zone_county`, `fire_year`, ...) | not on disk: `ts.month`, `ts.hour`, `ts.year` are `{}` |
| `hazard_pts.json` | `pts`, `ptflags`, `ptkinds` | not on disk: `pts` and `ptflags` are `[]` |
| `ca_nws_snapshot.json` | not merged: it is `window.__NWS_SNAPSHOT__`, a separate file | on disk |

`pts[].pi` and `pts[].zi` index `parishes` and `zrows` of this file. The hazard job indexes the order in
`CA/data/work/base.json` (the same order; `out/ca_zip_index.json` is a small copy). A ZIP index at or past the
row count becomes -1 in the merge. Shapes are in HAZARD_SCHEMA.md sections 2 to 4.

""")
rep("and the thirteen `p_<line>`. A city is the set of ZIP rows sharing a postal city name in one county;\nkept when the set has 1,500 residents or more.",
    "and the thirteen `p_<line>`. A city is the set of ZIP rows sharing a postal city name (774 cities); `pi` is the\ncounty holding most of its residents; kept when the set has 1,500 residents or more. No two cities share a name\nand no ZIP is in two cities.")
rep('"Name (County)"), `pi`', '"Name (County)": none needed in this build), `pi`')
sec("## 6. `geo`", "## 7. `ts` keys", """## 6. `geo`

Projection exactly as Louisiana: `x = (lon - minx) x kx x sx`, `y = (maxy - lat) x sx`.
`W` 4800, `H` 5467, `minx` -124.6, `maxy` 42.1, `kx` = cos(37.25 deg) = 0.796002, `sx` = W / (10.7 x kx) = 563.564
(the box runs to longitude -113.9 and latitude 32.4), `u` 2 (new: multiply Louisiana's view box constants by this).
One unit is about 197 m. Paths: `M x y` then `l dx dy` ... `z`, integers, as Louisiana. The block is 1.15 MB.

| member | content |
|---|---|
| `outline` | the state: 15 rings (mainland and the Channel Islands), the county edges that only one county uses |
| `neighbors` | `{"Baja California", Oregon, Nevada, Arizona}` in that order, clipped to the box. Draw them in key order and California on top: Baja California is a hand drawn strip south of the border (no boundary file was used) whose north edge runs under California and Arizona |
| `parish` | 58 county paths by FIPS (Census 2024, 1:500,000) |
| `zcta` | 1,762 paths by ZIP (Census 2020 ZCTAs, 1:500,000); key set = the `zip` column. ZCTAs do not cover the whole state: unpopulated land shows the outline's fill |
| `water` | 85 paths: 22 bay and strait polygons (TIGER 2025 area water of 15 square km or more: San Francisco, San Pablo, Suisun, Monterey, San Diego, Humboldt and other bays) then 63 lakes and reservoirs of 8 square km or more (USGS 1:1,000,000: Salton Sea, Lake Tahoe, Goose, Honey, Mono, Clear Lake, Shasta ...) |
| `wname` | new: the name of each `water` path, same order |
| `pcent` | FIPS -> `[lon, lat]` county label point (Census Gazetteer internal point) |

County and ZIP layers were each cut into shared arcs and every arc simplified once (Douglas-Peucker, tolerance
0.3 unit, end points fixed), so neighbours share one border line: no slivers or gaps. County lines and ZIP
lines are different Census products and do not coincide exactly. One ZIP (91046, a single site in Glendale) is too
small for the grid and is a 2 x 2 unit square. Census shapes stop at the shore, so the Pacific and the bays are
simply outside the outline; the bay polygons in `water` are there for a named fill.

""")
rep("| `fema_year` | kept, new meaning | rows `[disaster number, label, year, roof or property registrations, roof flag era (true to 2018), owners among ALL registrations, registrants reporting homeowners insurance among ALL registrations, incident kind (\"fire\", \"storm\", \"quake\"), all registrations]`.",
    "| `fema_year` | kept, new meaning | 20 rows `[disaster number, label, year, roof or property registrations (in ZIP rows), roof flag era (true to 2018), owners among ALL registrations, registrants reporting homeowners insurance among ALL registrations, incident kind (\"fire\", \"storm\", \"quake\"), all registrations]`. Labels such as \"Camp and Woolsey fires\" are this build's, not FEMA's.")
rep("| `replace_hist` | kept, new meaning | `{\"2000\"..\"2026\": [age driven replacements incl. tile relays, fire rebuild roofs]}` |",
    "| `replace_hist` | kept, new meaning | `{\"2000\"..\"2026\": [age driven replacements incl. tile relays, wildfire rebuild and repair roofs]}` (2018: 368,000 and 1,300; 2026: 357,000 and 4,900) |\n| `month`, `hour`, `year` | hazard job | `{}` until `hazard_ts.json` exists (section 4). `09_sl_model.js` reads `ts.month.hail/wind/torn`: guard it |")
rep("carried from the Louisiana file through August 2026 if BLS cannot be reached |", "carried from the Louisiana file (January 2019 to August 2026, 92 points each): BLS refused the download |")
sec("## 8. `comp`", "## 9. `ins`", """## 8. `comp`

Four rows. Same fields as Louisiana (`name, domain, url, hq, tier, seg, lines, verified, asof, cities, phone, title,
desc, h1, social, spanish, fin, cert, notes, offices[{city, lat, lon, hq, zip}]`) plus `lic_no` (CSLB licence
number) and `src` (where the name comes from). `lines`, `cities`, `offices`, `social`, `cert` are always arrays;
`tier` is one of `statewide, national, regional, local`; `verified` is false on every row and `domain`, `url`,
`phone`, `title`, `desc`, `h1` are null, because no company site was read.
Rows: Best Contracting Services (Gardena) and Kodiak Roofing and Waterproofing (Roseville), both named in Roofing
Contractor magazine's 2025 regional list and found in the CSLB file; Flynn Group of Companies (named by the
magazine, no C-39 licence under that name, no office mapped); Tecta America's three California licensees (CSLB
only; no ranking verified). A ranked California roster could not be built honestly: there is no public size
measure. Competitive pressure therefore rests on CSLB licence counts (`lic`, `comp_n25`, `comp_mass`, `lic_city`)
and Business Patterns establishments (`roofers`, `roof_mass`, county `cbp_roof`), not on `comp`.

""")
sec("## 9. `ins`", "## 10. `meta`", """## 9. `ins`, `fema`, `permits_city`

`ins`: `{years: [2022, 2023, 2024, 2025, 2026], state: {...}, county: {fips: {...}}, region: {"1".."11": {...}}}`.
Each block: `fair_pif[5]` (FAIR Plan residential policies at the five year-ends), `fair_tiv[5]` ($ million),
`fair_com` (commercial policies, 2026), `fair_hi` (residential policies in the Plan's high wildfire class),
`fair_own` (owner occupied single family), `fair_dist_zips` (ZIPs flagged distressed), `ins_pol`
(`{"2020".."2023"}` voluntary market new + renewed), `nonren` and `renewed` (`{"2015".."2023"}`), `insnr`
(`{"2015".."2021"}` insurer initiated non-renewals), `wf_claims`, `wf_loss` ($ thousand, 2018 to 2023),
`wf_hi_sh`, `hu`. County blocks add `fair_all[5]` (all lines, the Plan's own county file).
County and region blocks sum ALL postal ZIPs the source files place in the county (not only ZIP rows of
the atlas), by the source's own county field. State: 665,673 residential policies at 2026-09-30 (265,909 in 2022).

`fema`: 21 objects `{dr, type, date, kind ("fire", "storm", "quake", "other"), label, title, regs, owners, renters,
insured, roof_n, rpfvl_noflood, destroyed, k (roof or property registrations), nzip}`; 4482 (COVID-19) has kind
"other" and `k` 0.

`permits_city`: `{"Los Angeles": {src, years: {"2020".."2026": n}, note}, "San Francisco": {src, years:
{"2016".."2026": n}, note}}` re-roof permits by year (counts taken from roofing_law_evidence.md D2, read from the
cities' open data on 2026-11-19). Sacramento is not in the evidence and is not built.

""")
sec("## 10. `meta`", "## 11. The roof age model", """## 10. `meta`

Kept keys: `compiled` ("2026-11-19"), `nzip` (1,762), `nres` (1,531), `npar` (58), `pop`, `hu`, `occ`, `own`, `rent`,
`mh`, `u1`, `yb`, `yb_med`, `seas`, `mort_sh`, `roofs`, `ra15`, `ra20`, `wave`, `nxt`, `npts`, `ncomp` (4), `ncomp_ver` (0),
`cbp` (`{est, emp, ap, sup_est, sup_emp}`), `nes` (`{est2381, rcpt2381}`), `pools`, `cases`, `fees`, `fees_tot`.
`meta.pop`, `roofs`, `ra*`, `wave`, `nxt`, pools are ZIP sums; `hu, mh, u1, seas, occ, own, rent, yb` are county sums
(as Louisiana). Dropped: `nstorm`, `nhosp`, `fort`.

New scalars: `ra25`, `nxt_t`, `tile_n`, `tile25`, `solar_n`.
`meta.state` (new): the ACS state row (`pop, hh, hu, inc, value, own_sh, sfd_sh, mf5_sh, mh, mh_sh, yb_med, pre80_sh,
mort_sh, vac_sh, seas, hh100k_sh, s65_sh, span_sh, span_lep_sh, chin_sh, viet_sh, tagalog_sh, korean_sh, lep_sh, u1,
mf24, mf5u, age_med`).

`meta.lic` (kept, new meaning): `{n` 5,829 (C-39 on the renewed roll), `clear` 5,587 (active, unsuspended), `firms`
(= n), `inca` 5,659 (California mailing address; Louisiana's `inla`), `out` 170, `only` 3,933 (hold C-39 alone),
`susp` 242, `in_rows` 5,340 (licences whose mailing ZIP is a ZIP row; the rest sit at post office box ZIPs),
`top: [[city, active licences] x 25]}`.

`meta.ahs` (renamed fields): `pac_rate, pac_diy, pac_med, pac_mean, pac_ins, pac_leak` (Pacific division 2023; they
take the place of `wsc_*`), `w_mh_rate, w_mh_diy, w_mh_med` (West region mobile homes; they take the place of
`s_mh_*`), `metros` (`{la, sf, riv, pool, sj}` each `{rate, diy, med, mean, ins, leak, n, jobs, year}`), `west`, `us`
(same fields), `vint` (`{"before 1960", "1960-1979", "1980-1989", "1990-1999", "2000-2009", "2010-2019": [model,
AHS West net of insurance paid jobs]}`: six bands, Louisiana had five).

`meta.harden` (takes the place of `meta.fort`): `{anchor` (state pool of the harden line), `rate` 0.02,
`fair_disc` 16.4 (percent off the FAIR Plan wildfire premium for all twelve measures), `safe_homes26`
3,000,000 (California Safe Homes grant money secured, $)`}`.

`meta.ins` (new): state totals (`fair_pif` and `fair_tiv` by year-end, `fair_com`, `fair_hi`, `fair_own`,
`fair_dist_zips`, `nonren`, `renewed`, `insnr`, `ins_pol` by year, `wf_claims`, `wf_loss`, `wf_hi_sh`).
`meta.mat` (new): the RECS 2020 material shares used (`state`, `era`, `climate`).
`meta.econ` (new): Economic Census 2022 California roofing contractors (`rcpt22` $1,000, `estab22`, `emp22`).
`meta.hazard` (new): `{src, merged (hazard files merged), cols (hazard ZIP columns shipped), skipped, fire_src, fire_check}`.
`meta.notes` (new): what the build left out (ZCTAs skipped, postal ZIPs that are not ZCTAs, unmatched insurance and FEMA rows).

`meta.model`: `W, corr` (13 x 13), `sens`, `REP, VAL, FEE, GRADE, TIER, DMA, REG, REGK` (new), `P2R`,
`WB` (`{L 24.5, k 3, rho 0.0035, fit, rmse}` non-tile roofs), `WBT` (new: `{L 27, k 3}` tile underlayment), `ROOF`
(new: the roof model's other constants), `ANCH` (new contents: `cru, coat, leak, mh, metal, harden, harden_carve,
fire_rb, fire_dm, fire_years, storm_ins, storm_rate, storm_mult, storm_w, mf_life, comm_life, mf_storm, comm_storm,
mf24_roof, solar_cap`), `LINES` (the thirteen keys in order), `RES`, `COM`, `PRIOR` (2500), `CRU_W`, `LEAK`
(leak rate by decade, newest first, %), `LEAK_F`, `storm_anchor`, `haz_used`, `haz_src`, `MKT` (new: media market
names per region by principal city, typed from general knowledge, not a Nielsen county list).
Dropped: `DMG`, `val`, `valpts` (the hurricane damage curve and its validation: module 01 lines 5070 and 5201 to
5205 and module 02 line 5307 read them).

`meta.src` (new): `[{k, name, vintage, url, grade}]` for every source used.
`meta.assume` (new): plain sentences, one per assumption with no evidence behind it (22).

""")
sec("## 11. The roof age model", "## Change list", """## 11. The roof age model (constants in `meta.model.WB`, `WBT`, `ROOF`)

Two cohorts per ZIP from the one unit homes by decade (`o*`): tile roofs (RECS share by era x climate factor,
capped at 90%) and all other coverings. Yearly loop 1905 to 2026 as Louisiana's: new homes enter at age 0 (a
decade's homes spread evenly over its years; "1939 or earlier" over 1905 to 1939; "2020 or later" over 2020 to
2025), wear, resets, ageing. A reroofed home keeps its kind of covering.

- **Non-tile roofs** wear on a Weibull life, mean 24.5 years, shape 3 (Louisiana: 22). Fitted, as contract 17.3 (d)
  describes, to the AHS 2023 West region replacement rates by year built less the 9.5% of jobs paid by insurance,
  with a 0.35% a year background in the calibration cohort and California's tile share in each band. Model against
  target, % of homes a year: before 1960 3.83 / 3.76; 1960-79 3.76 / 4.24; 1980-89 3.74 / 3.22; 1990-99 4.24 / 3.71;
  2000-09 2.80 / 2.77; 2010-19 0.67 / 0.99. Root mean square gap 0.39 points (Louisiana: 0.31).
- **Tile roofs** wear on a 27 year Weibull, shape 3: what fails is the underlayment, and the job is a lift and
  relay (`nxt_t`, the `tile` line), after which the same tile goes back and the age returns to 0.
- **No hurricane resets and no storm background** in California ZIPs. The only resets are wildfire:
  (a) half of the residences CAL FIRE recorded as damaged (not destroyed) get a new roof the year after;
  (b) residences destroyed in 2024 or 2025 leave the stock in the fire year (the ACS 2020-2024 homes still count
  them) and 40% re-enter at age 0, a quarter in each of the four following years. Homes destroyed up to 2023
  are already out of, or rebuilt in, the Census year-built counts, so they are not reset a second time; their
  rebuild roofs are still shown in `rhist` and `hist` (second element) for the record.
- Results: 9.43 million one unit roofs; median age 13 years (Louisiana: 7); 27.0% are 20 or older, 14.3% are 25
  or older; 2.58 million tile roofs, 399,000 with underlayment 25 or older; wear now 3.77% a year (AHS California
  metros pooled: 4.13% of owner homes with a roofing job a year, insurance and owner jobs included; Pacific 3.67%).
  The age histogram is smooth: there are no storm spikes.

## 12. Service line pools (constants in `meta.model.ANCH`; every assumption is in `meta.assume`)

State pools at this issue, jobs a year: replace 263,275; repair 301,912; storm 34,750; fire 2,769; harden 10,560;
tile 88,958; solar 87,424; metal 12,221; mh 13,426; mf 9,719; comm 31,922; coat 20,700; newc 62,614.
Gross profit pool at the defaults: $2.91 billion (`meta.fees_tot`). For scale: the 2022 Economic Census puts
California roofing contractor revenue at $6.21 billion.

| line | pool | REP | VAL $ | grade |
|---|---|---|---|---|
| `replace` | `max(0, nxt x (1 - metal_sh/100) - 0.70 x p_harden)`: age driven reroofs of non-tile roofs on one to four unit homes | 0.84 | 19,000 | B |
| `repair` | leak rate by decade built (2.1% for homes built 2020 on, up to 8.4% before 1940: the Southern AHS profile by decade rescaled so California's stock averages the AHS Pacific 5.25%) x homes by decade x `(roofs + mf24) / hu` x 0.55 fixed by a paid roofer | 0.55 | 1,350 | B |
| `storm` | wind and rain damage. State total = 3.5% (AHS Pacific share of roof jobs paid by insurance) x 3.67% (AHS Pacific roof jobs a year) x one unit roofs x 3 (repairs short of replacement: a guess) = 36,300, spread over ZIPs by `(roofs + mf24/3) x storm_x`, `storm_x` = 0.5 + 0.3 x `g58` + 1.2 x `g75` + 0.3 x `ar3_d` + 0.2 x `rain_d2` (hazard columns; weights by judgment), then less the metal share | 0.80 | 7,500 | C |
| `fire` | `(fire_nxt + 0.5 x prior) x (1 - metal_sh/100)`: the rebuild roofs due in the next twelve months, plus half the 2013 to 2025 state yearly mean (40% of residences destroyed + 50% of residences damaged, a year) spread by wildfire exposed homes (`fhsz_sh x u1`; insurer rated High or Extreme exposures when the hazard column is missing) | 0.60 | 19,000 | C |
| `harden` | 2% a year x wildfire exposed owner homes = the larger of (homeowners exposures insurers rate High or Extreme, CDI 2023) and (`fair_own`), capped at owner occupied one unit homes (`u1 - rent1`) | 0.85 | 24,000 | D |
| `tile` | `nxt_t`: tile underlayment jobs due in the next twelve months | 0.84 | 16,000 | C |
| `solar` | `(nxt + nxt_t) x solar_sh / 100`: detach and reset of rooftop solar for a reroof or relay. An added job on the same roof, not carved out of `replace` | 0.50 | 4,500 | C |
| `metal` | `metal_sh/100 x (nxt + 0.5 x gross storm jobs + gross fire jobs)` | 0.88 | 28,000 | D |
| `mh` | `mh x 0.0224` (AHS West: 4.15% a year less 46% done by the owner) + `mh x` the ZIP's storm jobs per roof | 0.72 | 7,000 | C |
| `mf` | `mfb / 22` + `mfb x 0.8 x` the ZIP's storm replacement rate (storm jobs per roof / 3) | 0.65 | 40,000 | C |
| `comm` | `cru x (1/22 + 0.7 x` the ZIP's storm replacement rate`)`; `cru` sums to 690,000 (5.9 million U.S. commercial buildings, CBECS 2018, x California's 11.73% of U.S. residents) | 0.55 | 75,000 | D |
| `coat` | `0.03 x cru` | 0.50 | 40,000 | D |
| `newc` | Building Permits Survey residential buildings, 2023 to 2025 county mean, spread over the county's ZIPs by `yb20 + 0.35 x yb10` | 0.25 | 13,000 | B |

`TIER` (index confidence): replace, repair, newc 1.0; storm, fire, tile, mh, mf 0.75; harden, solar, metal, comm,
coat 0.5. `W` = line's share of `fees_tot` x `TIER` (replace 0.48, tile 0.10, comm 0.08; sum 0.81).
`DMA` (regional click cost factor, assumption): regions 5, 8, 9 = 1.00; 11 = 0.90; 10 = 0.85; 3, 6 = 0.80; 7 = 0.65;
1, 4 = 0.60; 2 = 0.55.

""")
s = s.rstrip('\n') + """
- 2026-11-23, second issue (the file is built and checked: 1,762 rows, 333 columns, 128 checks pass).
  - Rows: 1,762, not "about 1,768". 97635 dropped (section 0, item 6).
  - New ZIP columns since the first issue: `solar_n`, `solar_sh`, `solar_src`, `solar_new`, `solar_batt`, `fire_dest`,
    `fire_dmg`, `fire_res` (temporary), `fire_nxt`, `storm_x`, `tlat`, `tlon` and the hazard job's columns.
  - Group E: the stub names are gone. The hazard job's own names are carried (its HAZARD_SCHEMA.md, second issue, fixes
    them). Of the stub names, `fhsz_sh`, `fire_dest`, `fire_dmg`, `snow_psf`, `wd58`, `ar_days`, `rain_in` exist in its
    schema with the same meaning; `heat100` is `h100`.
  - `val1m_sh` is B25075 lines 25 to 27 (the first issue said 24 to 27).
  - `gid`: Google's geotargets file of 2026-10-06 was reached; 1,707 of 1,762 ZIPs have an ID, the rest are null.
  - Cities are grouped by postal city name alone (first issue: name within a county).
  - `tile` ticket $16,000; `fire` line built from the next twelve months' rebuilds plus half the long run mean
    (first issue: half the ZIP's own record, half the mean); wildfire rebuild share 40% (first issue: left open).
  - Top level: `hz` and `ptkinds` named for the hazard merge; `relief` is null (not built); `out/ca_zip_index.json` added.
  - `meta`: `ahs.west`, `econ`, `hazard`, `notes`, `model.MKT`, `model.ROOF`, `model.PRIOR`, `model.CRU_W`, `model.LEAK` added.
  - Still open: the hazard job's final files were not on disk; rerun `bash build_all.sh 3` when they are, and this
    list will record the merge.
"""
open(p, 'w').write(s)
print('ok', len(s))
