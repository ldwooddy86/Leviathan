/* ==== 18_m06_ground.js ==== */
/* ==== m06 Ground Truth (California) ==== */
"use strict";
/* County measures as counted by public agencies, and what is known in the field about California roofs. Rates use ACS homes and
   residents and Census land area. The county records are PA and PAI (the first key of the data file keeps its old name); on screen they are counties.
   Reads from each county: fips, name, reg, i, aland, pop, hu, mh, yb[10], roofs, ra20, ra25, wave, nxt, nxt_t, tile_n, fema{}, fema_k,
   fema_reg, fema_dest, bps{}, ytd26, ytd25, roofers, lic, lic_all, lic_cnty, nes2381, ins_agents, nzip, fees, comp, cbp_roof, cbp_sup,
   fair_pif, fair_pif22, fair_tiv, nonren, nonren_sh, nonren4, ins_pol, wf_claims, wf_loss, p_<line>.
   Hazard: county fire_dest, fire_dmg, and the county hz block (resident weighted means of the ZIP hazard columns): fhsz_sh, g58, ar3_d,
   snow_psf, h100. Where a county field is absent the ZIP column of the same name is rolled up. A measure whose field is missing from the
   build is left out of the menu, not shown as zero. */
const sqmiP = p => Math.max(1, p.aland / 2.58999e6);
const FEMA_YR = {}, FEMA_KIND = {}; ((DATA.ts && DATA.ts.fema_year) || []).forEach(a => { FEMA_YR[a[0]] = a[2]; FEMA_KIND[a[0]] = a[7] || ''; });
const femaSince = (p, y) => sum(Object.entries(p.fema || {}).filter(([dr]) => (FEMA_YR[dr] || 0) >= y).map(e => e[1]));
const femaOfKind = (p, k) => sum(Object.entries(p.fema || {}).filter(([dr]) => FEMA_KIND[dr] === k).map(e => e[1]));
/* county roll ups of ZIP columns, cached: a sum, or a mean weighted by homes */
const G6Z = (() => { const cache = {}; const has = c => ZC.includes(c);
  const get = (c, mode) => { const k = c + '|' + mode; if (cache[k]) return cache[k]; const num = {}, den = {}; Z.forEach(z => { const v = z[c]; if (!isN(v)) return; const w = mode === 'sum' ? 1 : (z.hu || z.pop || 0); num[z.pi] = (num[z.pi] || 0) + v * w; den[z.pi] = (den[z.pi] || 0) + w; }); const o = {}; Object.keys(num).forEach(i => o[i] = mode === 'sum' ? num[i] : (den[i] ? num[i] / den[i] : null)); return cache[k] = o; };
  return { has, sum: (p, c) => has(c) ? (get(c, 'sum')[p.i] != null ? get(c, 'sum')[p.i] : 0) : null, mean: (p, c) => has(c) ? (get(c, 'mean')[p.i] != null ? get(c, 'mean')[p.i] : null) : null }; })();
/* a hazard value for a county: its hz block first, else the homes weighted mean of the ZIP column; a count: the county field, else the ZIP sum */
const g6Hz = (p, cols) => { for (const c of cols) { if (p.hz && isN(p.hz[c])) return +p.hz[c]; if (G6Z.has(c)) { const v = G6Z.mean(p, c); if (isN(v)) return v; } } return null; };
const g6Cnt = (p, c) => isN(p[c]) ? +p[c] : G6Z.sum(p, c);
const g6PermYears = p => Object.keys((p && p.bps) || (DATA.ts && DATA.ts.permits) || {}).map(Number).filter(isN).sort((a, b) => a - b).slice(-5);
const g6Units = a => Array.isArray(a) ? (isN(a[1]) ? a[1] : a[0]) : 0;   /* all housing units authorized */
const g6Div = (a, b) => isN(a) && isN(b) && b ? a / b : null;
const PMET = {
  fair: { l: 'FAIR Plan home policies per 100 homes', s: 'FAIR Plan per 100 homes', f: p => isN(p.fair_pif) ? p.fair_pif / Math.max(1, p.hu) * 100 : null, fmt: v => D(v, 1), g: 'A', note: 'California FAIR Plan Association, residential policies in force at its latest fiscal year end, by the Plan\'s own county file. The FAIR Plan is the insurer of last resort: a high rate marks where the ordinary market has pulled back. Its dwelling policy covers named perils only, so a wind or rain leak on a FAIR only home depends on a separate policy.' },
  fairx: { l: 'FAIR Plan home policies, growth multiple over four years', s: 'FAIR Plan growth ×', f: p => isN(p.fair_pif) && p.fair_pif22 >= 10 ? p.fair_pif / p.fair_pif22 : null, fmt: v => isN(v) ? D(v, 1) + '×' : '—', g: 'A', note: 'Latest year end count over the count four year ends earlier. Left blank where the earlier count was under ten policies.' },
  nonren: { l: 'Home policies not renewed, per 100 up for renewal', s: 'Non renewed per 100', f: p => isN(p.nonren_sh) ? p.nonren_sh : null, fmt: v => D(v, 1), g: 'A', note: 'California Department of Insurance, residential policies renewed and not renewed, latest year in its file. Insurer and policyholder decisions are counted together: the file does not split them.' },
  wfloss: { l: 'Fire and smoke claims paid per home ($, six years)', s: 'Fire losses per home', f: p => isN(p.wf_loss) ? p.wf_loss * 1000 / Math.max(1, p.hu) : null, fmt: v => M$(v), g: 'A', note: 'California Department of Insurance wildfire risk report (Insurance Code 929): fire and smoke losses paid by insurers, all policy types, summed over the years in its file.' },
  dins: { l: 'Structures destroyed by wildfire per 1,000 homes (CAL FIRE inspections)', s: 'Destroyed per 1,000 homes', f: p => { const v = g6Cnt(p, 'fire_dest'); return v == null ? null : v / Math.max(1, p.hu) * 1000; }, fmt: v => D(v, 1), g: 'A', note: 'CAL FIRE damage inspections, digital records from 2013. Covers structures inside or within 300 feet of a fire perimeter; fires on local or federal land may be missing.' },
  fhsz: { l: 'Homes in High or Very High Fire Hazard Severity Zones (%)', s: 'In fire zones %', f: p => g6Hz(p, ['fhsz_sh']), fmt: v => P(v, 0), g: 'B', note: 'State Fire Marshal zone maps laid over ZIPs and averaged over the county. A reroof of half the roof or more inside these zones must be a Class A assembly. Cities adopt the local map by ordinance and may add area.' },
  fema: { l: 'FEMA roof or property registrations per 100 homes, all disasters on file', s: 'FEMA per 100 homes', f: p => isN(p.fema_k) ? p.fema_k / Math.max(1, p.hu) * 100 : null, fmt: v => D(v, 2), g: 'A', note: `OpenFEMA Individuals and Households Program: registrations with the roof damage flag (older disasters) or verified real property loss without flood damage (2020 on). Fire, storm, flood and earthquake disasters together. Counts only people who applied for federal help; ${inTen(FEMA_INS.sh)} registrants reported homeowners insurance.` },
  femafire: { l: 'FEMA registrations per 100 homes, wildfire disasters', s: 'FEMA fire per 100', f: p => p.fema ? femaOfKind(p, 'fire') / Math.max(1, p.hu) * 100 : null, fmt: v => D(v, 2), g: 'A', note: 'The same count for disasters FEMA lists as fires.' },
  femastorm: { l: 'FEMA registrations per 100 homes, storm and flood disasters', s: 'FEMA storm per 100', f: p => p.fema ? femaOfKind(p, 'storm') / Math.max(1, p.hu) * 100 : null, fmt: v => D(v, 2), g: 'A', note: 'The same count for severe storm, flood and winter storm disasters. Most roof leaks never reach FEMA.' },
  wind: { l: 'Days a year with a peak gust of 58 mph or more', s: 'Gust 58 mph days', f: p => g6Hz(p, ['g58', 'wd58']), fmt: v => D(v, 2), g: 'B', note: 'Peak gusts at the nearest screened station to each ZIP, averaged over the county. Wind is local: a canyon mouth and a valley floor in one county differ widely. Forecasters\' narratives begin to mention roof damage at gusts of about 60 to 70 mph.' },
  ar: { l: 'Atmospheric river days a year, AR3 or stronger', s: 'AR3+ days', f: p => g6Hz(p, ['ar3_d', 'ar_days']), fmt: v => D(v, 1), g: 'B', note: 'CW3E landfall catalog on the Ralph scale (AR1 to AR5), read at the coast point nearest each ZIP and averaged over the county.' },
  snow: { l: 'Design ground snow load (pounds per square foot, homes weighted mean)', s: 'Snow load psf', f: p => g6Hz(p, ['snow_psf']), fmt: v => D(v, 0), g: 'C', note: 'ASCE 7-22 ground snow load at each ZIP\'s town point, averaged over the county: a design value, not a measurement of any winter, and the town value is not the ridge value. Mountain towns set their own loads by subdivision; check the building department.' },
  heat: { l: 'Days a year at 100 °F or more', s: '100 °F days', f: p => g6Hz(p, ['h100', 'heat100']), fmt: v => D(v, 0), g: 'A', note: 'Station records, 1996 to 2025, averaged over the county. Cal/OSHA high heat procedures start at 95 °F.' },
  tile: { l: 'Tile roofs, share of one unit roofs (%, model)', s: 'Tile roofs %', f: p => isN(p.tile_n) && p.roofs ? p.tile_n / p.roofs * 100 : null, fmt: v => P(v, 0), g: 'D', note: 'Modeled from the federal energy survey\'s California shares by era built and climate, not counted locally. No county count of roofing material exists.' },
  ra25: { l: 'One unit roofs 25 years or older (%, model)', s: 'Roofs 25 yrs+', f: p => isN(p.ra25) && p.roofs ? p.ra25 / p.roofs * 100 : null, fmt: v => P(v, 0), g: 'B', note: 'Roof age cohort model (module 17). For tile roofs the age is the underlayment\'s; 25 years is where it comes due.' },
  permits: { l: 'New homes permitted per 1,000 homes a year, latest five years', s: 'Permits per 1,000 homes', f: p => { const ys = g6PermYears(p); return ys.length ? mean(ys.map(y => g6Units((p.bps || {})[y]))) / Math.max(1, p.hu) * 1000 : null; }, fmt: v => D(v, 1), g: 'A', note: 'Census Building Permits Survey, housing units authorized, all building sizes. New homes only: reroofs are not in this survey.' },
  ytd: { l: 'Change in homes permitted this year to date against last year (%)', s: 'Permits year to date', f: p => p.ytd25 ? (p.ytd26 / p.ytd25 - 1) * 100 : null, fmt: v => isN(v) ? S(v, 0) + '%' : '—', g: 'A', div: true, note: 'Census Building Permits Survey year to date files. Small counties swing widely.' },
  old: { l: 'Homes built before 1980 (%)', s: 'Built before 1980', f: p => sum(p.yb || []) ? sum((p.yb || []).slice(5)) / sum(p.yb || []) * 100 : null, fmt: v => P(v, 0), g: 'A', note: 'ACS five year, year structure built.' },
  mh: { l: 'Mobile homes (% of homes)', s: 'Mobile homes %', f: p => isN(p.mh) ? p.mh / Math.max(1, p.hu) * 100 : null, fmt: v => P(v, 0), g: 'A', note: 'ACS five year, units in structure.' },
  roofers: { l: 'Roofing contractors per 10,000 residents (ZIP Business Patterns)', s: 'Roofers per 10k', f: p => isN(p.roofers) && p.pop ? p.roofers / p.pop * 1e4 : null, fmt: v => D(v, 2), g: 'B', note: 'ZIP level counts of establishments with employees (NAICS 238160) summed to the county. Cells under three are withheld, so small towns read zero and the sum runs below the county file.' },
  lic: { l: 'Active C-39 Roofing licenses per 10,000 residents (CSLB)', s: 'C-39 per 10k', f: p => isN(p.lic) && p.pop ? p.lic / p.pop * 1e4 : null, fmt: v => D(v, 2), g: 'A', note: 'Contractors State License Board master file: licenses with the C-39 class, active and not suspended, by the mailing ZIP of the license. Where the firm is, not where it works.' },
  fees: { l: 'Gross profit pool per home, all service lines ($ a year)', s: 'Profit pool per home', f: p => isN(p.fees) ? p.fees / Math.max(1, p.hu) : null, fmt: v => M$(v), g: 'D', note: 'Service line model at default assumptions (module 12).' },
};
/* ---------- field knowledge: what is known about California roofs, from the evidence file (each row carries its source) ---------- */
/* Roofing material on single family homes. U.S. Energy Information Administration, 2020 Residential Energy Consumption Survey, public
   microdata, weighted; California sample 837 single family homes. The occupant names the material: clay and concrete tile are easily
   confused and there is no flat roof category. */
const G6_MAT = {
  src: 'U.S. Energy Information Administration, Residential Energy Consumption Survey 2020, public microdata (occupant reported)',
  cols: ['Composition shingles', 'Clay tile', 'Concrete tile', 'Tile, both', 'Wood', 'Metal', 'Other'],
  state: [['California single family', 837, [61.9, 18.1, 9.3, 27.4, 5.4, 2.2, 2.0]], ['United States single family', 14070, [79.3, 5.0, 2.0, 7.0, 4.3, 7.3, 1.1]]],
  era: [['Built before 1960', 235, [74.9, 6.0, 0.8, 6.8, 8.5, 4.6, 3.8]], ['1960 to 1979', 239, [75.4, 11.5, 5.9, 17.4, 3.1, 1.5, 1.8]], ['1980 to 1999', 218, [48.7, 25.9, 17.1, 43.0, 5.6, 1.0, 0.9]], ['2000 to 2020', 145, [32.9, 42.1, 20.1, 62.2, 3.0, 0.6, 0.6]]],
  clim: [['Hot and dry (most of Southern California and the Central Valley)', 601, [60.3, 20.3, 10.6, 30.9, 5.6, 1.4, 1.0]], ['Marine (the coast from about Santa Barbara County north)', 215, [65.8, 12.1, 6.2, 18.3, 5.7, 3.6, 5.5]]],
};
/* Title 24 Part 6 cool roof rules for reroofs (2022 and 2025 Energy Codes, identical on these values). */
const G6_COOL = [
  ['Single family house', 'More than half the roof replaced', 'Steep (2:12 or more)', '4 and 8 to 15', '0.20', '16'],
  ['Single family house', 'More than half the roof replaced', 'Low slope', '4 and 6 to 15', '0.63', '75'],
  ['Multifamily', 'More than half the roof or 2,000 square feet, whichever is less', 'Low slope', '2, 4 and 6 to 15', '0.63', '75'],
  ['Multifamily', 'Same', 'Steep', '4 and 8 to 15', '0.20', '16'],
  ['Nonresidential', 'More than half the roof or 2,000 square feet, whichever is less', 'Low slope', 'All 16', '0.63', '75'],
  ['Nonresidential', 'Same', 'Steep', '1 and 3', '0.20', '16'],
  ['Nonresidential', 'Same', 'Steep', '2 and 4 to 16', '0.25', '23'],
  ['Hotel and motel guest rooms', 'Same', 'Low slope', '9, 10, 11, 13, 14, 15', '0.55', '64'],
];
/* Reroof permits by year in the two cities whose open data was read (used only when the data build does not carry permits_city). */
const G6_PERMITS = { 'Los Angeles': { 2020: 8890, 2021: 9024, 2022: 10383, 2023: 14511, 2024: 14273, 2025: 11954 }, 'San Francisco': { 2016: 2656, 2017: 2911, 2018: 2694, 2019: 2773, 2020: 2140, 2021: 2490, 2022: 2911, 2023: 3527, 2024: 4426, 2025: 4084 } };
const G6_FIELD = {
  mat: [
    ['Asphalt shingles lead, tile follows', 'About 62 percent of California single family homes have composition shingles and 27 percent tile (18 clay, 9 concrete), against 79 and 7 percent nationally. Wood is 5 percent, metal 2.'],
    ['The tile era', 'Tile is on 7 percent of homes built before 1960, 17 percent of those from 1960 to 1979, 43 percent from 1980 to 1999 and 62 percent of homes built since 2000. A tract of the 1990s is a tile tract.'],
    ['Climate', 'Tile is on about three in ten homes in the hot, dry south and valley and under two in ten on the marine coast from about Santa Barbara County north.'],
    ['Flat roofs are invisible in the survey', 'The survey has no category for built up, modified bitumen or single ply roofs. San Francisco shows what it hides: of reroof permits filed 2023 to 2026 that name a material, three in four are modified bitumen, torch down or cap sheet and one in six composition shingles (city open data, keyword match).'],
    ['Los Angeles', 'Nearly all City of Los Angeles reroof permits use the standard lightweight description (under 6 pounds per square foot): shingles and membranes. The median house roof is 22 squares; one permit in five calls for new solid sheathing (city open data, 2023 to 2026).'],
    ['What is not known', 'No count of roofing material by metro, county or ZIP was found. The tile, wood and metal shares elsewhere in this atlas are the survey\'s statewide shares by era and climate applied to local housing ages: grade D.'],
  ],
  tile: [
    ['Tile outlives what is under it', 'The tile can last generations; the underlayment does not. A reserve study consultant puts standard underlayment at about 25 years, a trade source at 20 to 30. Neither is a test.'],
    ['Lift and relay', 'The code lets sound slate, clay or cement tile be taken up and reinstalled; damaged tile may not go back, and rusted or damaged flashings and vents must be replaced (California Residential Code R908.5). One consultant plans for about 30 percent breakage.'],
    ['Who is due', 'About 939,000 California single family homes built 1980 to 1999 have tile. In 2026 that whole cohort is at or past the stated underlayment life.'],
    ['No recover over tile', 'A second layer is not allowed over slate, clay, cement or asbestos cement tile (R908.3.1.1).'],
    ['Cool roof rule', 'Roofs of 25 pounds per square foot or more are exempt from the reflectance rule, which is why most tile relays are. Los Angeles permits say so in words.'],
    ['In fire zones', 'Under tile on a wood deck: a 72 pound cap sheet or a Class A rated underlayment, bird stops at the eaves, hips and ridges closed. A relay of half the roof or more in twelve months triggers it.'],
    ['Associations', 'One consultant reports a 30 year old Orange County association that spent over $400,000 patching "lifetime" tile roofs with no reserve, then assessed about $12,000 a unit. One account of one project.'],
  ],
  wood: [
    ['The stock', 'About 5 percent of California single family homes report wood shingles or shakes, some 466,000 homes, most often on homes built before 1960 (8.5 percent).'],
    ['State law', 'No untreated or unlisted wood roofing may be sold or applied anywhere in California; it needs State Fire Marshal listing and five years passed of the ten year weathering test (Health and Safety Code 13132.7). Fire retardant shakes in the wildland interface must be part of a Class A assembly.'],
    ['City bans', 'The City of Los Angeles has prohibited all wood shake and shingle roofing since August 25, 1989 (Ordinance 165047): new work, reroofs and repairs, with remaining shakes off when over half the roof is redone. The City of San Diego allows no wood renewals and no covering over wood. Others were listed in 2003 (Santa Barbara, Carlsbad, Del Mar, El Cajon, Vista and more). No current statewide list was found.'],
    ['Covering shakes', 'Tile or metal may go over shakes only with a fire barrier layer first (R908.4).'],
    ['Why', 'Wood roof fires spread by flying embers: Oakland 1991 (2,886 structures), Laguna Beach 1993 (366), Anaheim 1982 (550).'],
  ],
  fire: [
    ['Where the rule applies', 'All State Responsibility Area land, High and Very High Fire Hazard Severity Zones in local areas, and local interface areas (2025 California Wildland-Urban Interface Code, in force January 1, 2026). The State Fire Marshal\'s 2025 local maps show Moderate and High zones for the first time.'],
    ['The reroof trigger', 'Half the roof or more replaced in twelve months: the roof must meet the rules for new construction. Every repaired part must be at least Class A. The 2022 code said "more than 50 percent".'],
    ['What the roof must be', 'A Class A assembly tested to ASTM E108 or UL 790; valley metal over a 36 inch cap sheet; noncombustible gutters and downspouts; listed flame and ember resistant vents or 1/16 to 1/8 inch noncombustible mesh; enclosed eaves.'],
    ['Outside the zones', 'Class C is the statewide floor for new roofs, for the whole roof when more than half is replaced in a year, and for any repaired part.'],
    ['Class A is necessary, not enough', 'About nine in ten structures inside the January 2025 Palisades and Eaton perimeters had Class A coverings (CAL FIRE inspection data); 16,264 structures were destroyed. The weak points were vents, eaves, windows and the first five feet. Only 10 percent of assessed structures in the Palisades area and 6 percent in the Eaton area had vent screens of 1/8 inch or finer.'],
    ['What the older fires showed', 'With wood roofs still common, the roof decided it: in the 1990 Painted Cave fire 70 percent of homes with non flammable roofs survived against 19 percent with flammable ones. In the 2018 Camp Fire 11.5 percent of homes built before 1997 survived against 38.5 percent built later.'],
    ['Where roofs ignite', 'At edges, intersections, gutters and vents, where debris collects. Keeping roofs and gutters clear is already the law in the zones.'],
    ['Zone Zero', 'The Board of Forestry approved the five foot ember resistant zone rule on August 19, 2026 and filed it on August 28. No source confirmed its approval or an effective date by the compile date. Treat it as pending.'],
  ],
  weather: [
    ['Rain', 'Reroof permits in the City of Los Angeles rose from 10,383 in 2022 to 14,511 in 2023, the year of the wet winter, and San Francisco\'s from 2,911 to 3,527. That rain caused the jump is a reading, not a finding. No count of roof leak claims was found.'],
    ['Wind', 'Forecasters\' narratives begin to mention roof damage at gusts of about 60 to 70 mph. The largest Santa Ana roof damage event on record is October 21, 2007 (Inland Empire $35 million in the federal storm database, which understates). Gusts on January 7, 2025 reached 84 mph at Burbank Airport.'],
    ['Hail', 'Hail of an inch or more has been reported 349 times in about 75 years in the whole state, about six days a year. It is not a roofing market here.'],
    ['Snow country', 'In the storms of late February 2023, 100 inches fell at Crestline and roofs collapsed in Crestline and Lake Arrowhead; a school roof collapsed in Nevada City. Truckee\'s own example uses a ground snow load of 325 pounds per square foot. Design loads for Big Bear, South Lake Tahoe and the Placer and El Dorado high country were not found: ask the building department.'],
    ['Heat and sun', 'No California field study of shingle life in desert or valley heat was found, nor one for coatings. A trade article for Phoenix, not California, reports 15 to 18 years. Reflective products are required on reroofs in the hot zones (below).'],
    ['Coastal salt air', 'No California source was found. Metal roofing warranties commonly exclude or limit sites near salt water: read the maker\'s distance rule before selling metal near the ocean.'],
    ['Earthquakes', 'No source was opened. Reroofing with a heavier covering is a structural question: San Diego requires a permit and calculations above 6 pounds per square foot.'],
  ],
  permit: [
    ['Tear off', 'A roof replacement removes every existing layer down to the deck (R908.3). A recover is barred over a wet or deteriorated roof, over tile or slate, and over two or more layers.'],
    ['City of Los Angeles', 'Permits are issued for reroofs in the thousands every year on a standard description. The code sentence that requires them was not opened.'],
    ['City of San Diego', 'No building permit to renew a roof covering when the structure is not altered. A permit is needed if framing or sheathing is altered (up to 25 percent of the deck may be replaced in kind without one on houses), if the new covering weighs more than 6 pounds per square foot, if skip sheathing is replaced, or on a historic property (Information Bulletin 123).'],
    ['Los Angeles County, unincorporated', 'A building permit for the reroof and a separate solar permit if panels come off and go back. Overlays only over one layer of shingles, metal, roll or built up roofing (Building Code Manual 1512).'],
    ['San Francisco', 'Reroof permits are filed over the counter and flagged in the city\'s data.'],
    ['San Jose, Sacramento and the rest', 'Not read. Ask the building department before quoting a permit line.'],
    ['Solar on the roof', 'Los Angeles County states the license split: C-39 for the roof, C-10 or C-46 for the panels, or an A or B licensee for both. Old bonding clips may not be reused. Whether taking panels off and putting the same ones back changes a customer\'s older net metering status was not found: do not say either way.'],
    ['Who may do the work', 'A license is needed for any job of $1,000 or more, and below that if the work needs a permit or the person employs anyone. Every C-39 licensee must carry workers\' compensation even with no employees. Fall protection is required at 6 feet on residential roofs since July 1, 2025.'],
    ['Code freeze', 'New state and local residential building standards are frozen from October 1, 2025 to June 1, 2031 (Assembly Bill 130), with home hardening exempt: wildfire rules can still change.'],
  ],
};
