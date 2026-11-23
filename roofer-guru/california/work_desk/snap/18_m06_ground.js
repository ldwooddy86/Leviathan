/* ==== 18_m06_ground.js ==== */
/* ==== m06 Ground Truth (California) ==== */
"use strict";
/* County measures as counted by public agencies, and what is known in the field about California roofs. Rates use ACS homes and
   residents and Census land area. In code a county is a "parish" (DATA.parishes, PA, PAI): on screen it is always a county.
   Reads from each county: fips, name, reg, i, aland, pop, hu, mh, yb[10], roofs, ra20, ra25, wave, nxt, nxt_t, tile_n, fema{}, fema_k,
   fema_reg, fema_dest, bps{}, ytd26, ytd25, roofers, lic, lic_all, lic_cnty, nes2381, ins_agents, nzip, fees, comp, cbp_roof, cbp_sup,
   fair_pif, fair_pif22, fair_tiv, nonren, nonren_sh, nonren4, ins_pol, wf_claims, wf_loss, p_<line>.
   Reads from ZIP rows, summed to the county (hazard job's columns, stub names until its schema is final): fire_dest, fire_dmg, fhsz_sh,
   wd58, ar_days, snow_psf, heat100. A measure whose field is missing from the build is left out of the menu, not shown as zero. */
const sqmiP = p => Math.max(1, p.aland / 2.58999e6);
const FEMA_YR = {}, FEMA_KIND = {}; ((DATA.ts && DATA.ts.fema_year) || []).forEach(a => { FEMA_YR[a[0]] = a[2]; FEMA_KIND[a[0]] = a[7] || ''; });
const femaSince = (p, y) => sum(Object.entries(p.fema || {}).filter(([dr]) => (FEMA_YR[dr] || 0) >= y).map(e => e[1]));
const femaOfKind = (p, k) => sum(Object.entries(p.fema || {}).filter(([dr]) => FEMA_KIND[dr] === k).map(e => e[1]));
/* county roll ups of ZIP columns, cached: a sum, or a mean weighted by homes */
const G6Z = (() => { const cache = {}; const has = c => ZC.includes(c);
  const get = (c, mode) => { const k = c + '|' + mode; if (cache[k]) return cache[k]; const num = {}, den = {}; Z.forEach(z => { const v = z[c]; if (!isN(v)) return; const w = mode === 'sum' ? 1 : (z.hu || z.pop || 0); num[z.pi] = (num[z.pi] || 0) + v * w; den[z.pi] = (den[z.pi] || 0) + w; }); const o = {}; Object.keys(num).forEach(i => o[i] = mode === 'sum' ? num[i] : (den[i] ? num[i] / den[i] : null)); return cache[k] = o; };
  return { has, sum: (p, c) => has(c) ? (get(c, 'sum')[p.i] != null ? get(c, 'sum')[p.i] : 0) : null, mean: (p, c) => has(c) ? (get(c, 'mean')[p.i] != null ? get(c, 'mean')[p.i] : null) : null }; })();
const g6PermYears = p => Object.keys((p && p.bps) || (DATA.ts && DATA.ts.permits) || {}).map(Number).filter(isN).sort((a, b) => a - b).slice(-5);
const g6Units = a => Array.isArray(a) ? (isN(a[1]) ? a[1] : a[0]) : 0;   /* all housing units authorized */
const g6Div = (a, b) => isN(a) && isN(b) && b ? a / b : null;
const PMET = {
  fair: { l: 'FAIR Plan home policies per 100 homes', s: 'FAIR Plan per 100 homes', f: p => isN(p.fair_pif) ? p.fair_pif / Math.max(1, p.hu) * 100 : null, fmt: v => D(v, 1), g: 'A', note: 'California FAIR Plan Association, residential policies in force at its latest fiscal year end, by the Plan\'s own county file. The FAIR Plan is the insurer of last resort: a high rate marks where the ordinary market has pulled back. Its dwelling policy covers named perils only, so a wind or rain leak on a FAIR only home depends on a separate policy.' },
  fairx: { l: 'FAIR Plan home policies, growth multiple over four years', s: 'FAIR Plan growth ×', f: p => isN(p.fair_pif) && p.fair_pif22 >= 10 ? p.fair_pif / p.fair_pif22 : null, fmt: v => isN(v) ? D(v, 1) + '×' : '—', g: 'A', note: 'Latest year end count over the count four year ends earlier. Left blank where the earlier count was under ten policies.' },
  nonren: { l: 'Home policies not renewed, per 100 up for renewal', s: 'Non renewed per 100', f: p => isN(p.nonren_sh) ? p.nonren_sh : null, fmt: v => D(v, 1), g: 'A', note: 'California Department of Insurance, residential policies renewed and not renewed, latest year in its file. Insurer and policyholder decisions are counted together: the file does not split them.' },
  wfloss: { l: 'Fire and smoke claims paid per home ($, six years)', s: 'Fire losses per home', f: p => isN(p.wf_loss) ? p.wf_loss * 1000 / Math.max(1, p.hu) : null, fmt: v => M$(v), g: 'A', note: 'California Department of Insurance wildfire risk report (Insurance Code 929): fire and smoke losses paid by insurers, all policy types, summed over the years in its file.' },
  dins: { l: 'Structures destroyed by wildfire per 1,000 homes (CAL FIRE inspections)', s: 'Destroyed per 1,000 homes', f: p => { const v = G6Z.sum(p, 'fire_dest'); return v == null ? null : v / Math.max(1, p.hu) * 1000; }, fmt: v => D(v, 1), g: 'A', note: 'CAL FIRE damage inspections, digital records from 2013, summed from the ZIPs of the county. Covers structures inside or within 300 feet of a fire perimeter; fires on local or federal land may be missing.' },
  fhsz: { l: 'Homes in High or Very High Fire Hazard Severity Zones (%)', s: 'In fire zones %', f: p => G6Z.mean(p, 'fhsz_sh'), fmt: v => P(v, 0), g: 'B', note: 'State Fire Marshal zone maps laid over ZIPs and averaged by homes. A reroof of half the roof or more inside these zones must be a Class A assembly. Cities adopt the local map by ordinance and may add area.' },
  fema: { l: 'FEMA roof or property registrations per 100 homes, all disasters on file', s: 'FEMA per 100 homes', f: p => isN(p.fema_k) ? p.fema_k / Math.max(1, p.hu) * 100 : null, fmt: v => D(v, 2), g: 'A', note: `OpenFEMA Individuals and Households Program: registrations with the roof damage flag (older disasters) or verified real property loss without flood damage (2020 on). Fire, storm, flood and earthquake disasters together. Counts only people who applied for federal help; ${inTen(FEMA_INS.sh)} registrants reported homeowners insurance.` },
  femafire: { l: 'FEMA registrations per 100 homes, wildfire disasters', s: 'FEMA fire per 100', f: p => p.fema ? femaOfKind(p, 'fire') / Math.max(1, p.hu) * 100 : null, fmt: v => D(v, 2), g: 'A', note: 'The same count for disasters FEMA lists as fires.' },
  femastorm: { l: 'FEMA registrations per 100 homes, storm and flood disasters', s: 'FEMA storm per 100', f: p => p.fema ? femaOfKind(p, 'storm') / Math.max(1, p.hu) * 100 : null, fmt: v => D(v, 2), g: 'A', note: 'The same count for severe storm, flood and winter storm disasters. Most roof leaks never reach FEMA.' },
  wind: { l: 'Days a year with a gust of 58 mph or more within 25 miles', s: 'Gust 58 mph days', f: p => G6Z.mean(p, 'wd58'), fmt: v => D(v, 1), g: 'B', note: 'Measured and reported gusts, averaged over the county\'s ZIPs by homes. Forecasters\' narratives begin to mention roof damage at gusts of about 60 to 70 mph.' },
  ar: { l: 'Atmospheric river days a year, AR2 or stronger', s: 'AR days', f: p => G6Z.mean(p, 'ar_days'), fmt: v => D(v, 1), g: 'B', note: 'CW3E landfall catalog on the Ralph scale (AR1 to AR5), at the ZIP\'s stretch of coast or inland, averaged by homes.' },
  snow: { l: 'Design ground snow load (pounds per square foot, homes weighted mean)', s: 'Snow load psf', f: p => G6Z.mean(p, 'snow_psf'), fmt: v => D(v, 0), g: 'B', note: 'Design value, not a measurement of any winter. Mountain towns set their own loads by subdivision; check the building department.' },
  heat: { l: 'Days a year at 100 °F or more', s: '100 °F days', f: p => G6Z.mean(p, 'heat100'), fmt: v => D(v, 0), g: 'A', note: 'Station records averaged over the county\'s ZIPs by homes. Cal/OSHA high heat procedures start at 95 °F.' },
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
/* ============================ Module 6: Ground Truth ============================ */
registerModule({
  key: 'ground', num: '06', title: 'Ground Truth', desc: 'The counties as counted: FAIR Plan policies and non renewals, wildfire losses, FEMA registrations, permits, housing and licensed roofers, and what is known in the field about California roofs',
  mount(root) {
    const NC = PA.length; const SLN = (typeof MODI !== 'undefined' && MODI.storms && MODI.storms.title) || 'Storm Ledger'; const andList = a => a.length <= 1 ? (a[0] || '') : a.length === 2 ? a[0] + ' and ' + a[1] : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
    const capS = s => String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1);
    const compiled = dateL(META.compiled || '2026-11-19'); const cy = +String(META.compiled || '2026-11-19').slice(0, 4);
    /* only measures the build can fill */
    const MK = Object.keys(PMET).filter(k => PA.some(p => isN(PMET[k].f(p)))); const has = k => MK.includes(k);
    const missing = Object.keys(PMET).filter(k => !has(k));
    const st = { m: has('fair') ? 'fair' : has('fema') ? 'fema' : MK[0], sel: null };
    const T = k => sum(PA.map(p => k(p)));
    const huAll = T(p => p.hu || 0), popAll = T(p => p.pop || 0);
    /* FEMA: one roll up for the whole atlas. Module 01 sums the ZIP column; the county records can differ from it, because some postal
       ZIPs are not ZIP rows. The headline uses the ZIP column where it exists and says how far the county records stand from it. */
    const femaCty = T(p => p.fema_k || 0), femaCty20 = T(p => femaSince(p, 2020));
    const femaZip = ZC.includes('fema_k') ? sum(Z.map(z => z.fema_k || 0)) : null, femaZip20 = ZC.includes('fema_20') ? sum(Z.map(z => z.fema_20 || 0)) : null;
    const femaAll = femaZip != null ? femaZip : femaCty, fema20 = femaZip20 != null ? femaZip20 : femaCty20;
    const FY = (DATA.ts && DATA.ts.fema_year) || []; const nDis = FY.filter(a => (+a[3] || 0) > 0).length; const fyYears = FY.map(a => +a[2]).filter(isN);
    const permY = (DATA.ts && DATA.ts.permits) || {}; const pYears = Object.keys(permY).map(Number).sort((a, b) => a - b); const lastY = pYears[pYears.length - 1];
    const ytdOk = isN(DATA.ts && DATA.ts.ytd26) && isN(DATA.ts && DATA.ts.ytd25) && DATA.ts.ytd25 > 0;
    const lic = META.lic || {}; const INS = DATA.ins || null; const insY = (INS && INS.years) || [];
    const fairAll = T(p => p.fair_pif || 0), fair22 = T(p => p.fair_pif22 || 0), nonAll = T(p => p.nonren || 0);
    const destAll = G6Z.has('fire_dest') ? T(p => G6Z.sum(p, 'fire_dest') || 0) : null, dmgAll = G6Z.has('fire_dmg') ? T(p => G6Z.sum(p, 'fire_dmg') || 0) : null;
    const PC = DATA.permits_city || null; const permCity = n => (PC && PC[n] && PC[n].years) || G6_PERMITS[n] || {};
    root.innerHTML = mastHTML({ eyebrow: `Module 06 · Ground Truth · ${N(NC)} counties as counted, and the roofs as built`, title: 'Ground Truth',
      dek: `Before any model, the record. The FAIR Plan and the Department of Insurance counted every policy written, dropped and paid; CAL FIRE inspected every structure a wildfire reached; FEMA counted every household that registered after a declared disaster; the Census Bureau counted every home, its age and type, every building permit and every roofing contractor; the Contractors State License Board lists every licensed roofer. This module lays those records side by side for the ${N(NC)} counties, so every modeled number elsewhere can be checked against what was counted. Below the records it sets down what is known about the roofs themselves: what they are made of by era and climate, tile and its underlayment, wood shake, cool roof and fire zone rules, weather, and permits by city.`,
      meta: [fairAll ? `<b>FAIR Plan</b> ${N(fairAll)} home policies` : '', `<b>FEMA</b> ${N(femaAll)} roof or property registrations, ${N(nDis)} disasters`, isN(lic.clear || lic.n) ? `<b>CSLB</b> ${N(lic.clear || lic.n)} active C-39 licenses` : '', '<b>Grade</b> A for counts, lower where noted'].filter(Boolean),
      bar: 'Ground Truth', barsub: 'Counted county records and field knowledge',
      actions: [{ id: 'g6Csv', label: '↓ Counties CSV' }, { id: 'g6CiCsv', label: '↓ Cities CSV' }, { id: 'g6Paid', label: 'Paid ↗' }, { id: 'g6Cor', label: SLN + ' ↗' }] }) +
      `<div class="wrap">
      ${callout('', 'Read this first: counted layers first, modeled layers second', `Most measures on this tab were counted by a public agency or a statutory body: policies by the FAIR Plan and the Department of Insurance, burned structures by CAL FIRE, registrations by FEMA, homes and permits by the Census Bureau, licenses by the Contractors State License Board. Each has its own blind spot, listed below: the FAIR Plan shows where insurance retreated, not where roofs failed; FEMA sees only the damage people asked federal help for after declared disasters; permits count new homes, not reroofs; a license sits where the firm gets its mail. The modeled measures (tile share, roof age, the gross profit pool) are graded B or D and say so. Use these records to check every ZIP number in modules 01, 05 and 12.${missing.length ? ` Not in this build, and so left out of the menu: ${esc(andList(missing.map(k => PMET[k].s.toLowerCase())))}.` : ''}`)}
      <div class="kpis" id="g6Kpis"></div>
      <div class="controls"><div class="ctl" style="flex:1 1 360px"><label class="fl" for="g6Met">County measure</label><select id="g6Met">${MK.map(k => `<option value="${k}">${esc(PMET[k].l)}</option>`).join('')}</select></div></div>
      <div class="grid2">
        <div class="card mapcard"><div id="g6Map"></div><div class="legend" id="g6Leg"></div></div>
        <div class="stack">
          <div class="card"><div class="card-h" style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start"><div><h3 id="g6Name">California</h3><p id="g6Sub">Click a county for its record</p></div><span class="pill" id="g6Pill">State</span></div><div class="card-b" id="g6Detail"></div></div>
        </div>
      </div>
      ${card('Counties', 'Every county with its counted rates. Click a row to open the county; click a header to sort.', '<div class="tscroll" id="g6Tbl"></div>', 'mt')}
      <div class="split">
        ${card('One record against another', 'Two independent records, county by county. Where they agree, each supports the other; the counties far from the line are named.', '<div id="g6Sc1"></div><p class="chartnote" id="g6Sc1n"></p><div id="g6Sc2"></div><p class="chartnote" id="g6Sc2n"></p>')}
        ${card('Where the record concentrates', 'Counties ranked on the lead measure against the state rate, with the volume behind each.', '<div id="g6Out"></div>')}
      </div>
      ${card('Cities', 'Postal cities of 1,500 residents or more: roofs, service line jobs summed over their ZIPs, licensed roofers nearby, FAIR Plan policies and language at home.', '<div class="tscroll short" id="g6Cities"></div>', 'mt')}
      ${card('What California roofs are made of', 'The one statewide count found: a federal survey of households, 2020. Percent of single family homes.', '<div id="g6Mat"></div>', 'mt')}
      <div class="split">
        ${card('Tile and its underlayment', 'Why a tile roof leaks at 25 years with the tile intact.', '<div id="g6Tile"></div>')}
        ${card('Wood shake and its bans', 'A shrinking stock that state law and cities no longer let you renew in kind.', '<div id="g6Wood"></div>')}
      </div>
      ${card('Low slope and cool roofs: Title 24, Part 6', 'When a reroof must use a reflective product, by building type, slope and Energy Code climate zone. The values are the same in the 2022 and 2025 codes.', '<div id="g6Cool"></div>', 'mt')}
      <div class="split">
        ${card('Fire zones', 'What a reroof must be in a Fire Hazard Severity Zone, and what the fire record says a roof can and cannot do.', '<div id="g6Fire"></div>')}
        ${card('Rain, wind, hail, snow, heat and salt air', 'What the weather record supports, and where it is silent.', '<div id="g6Wx"></div>')}
      </div>
      <div class="split">
        ${card('Permits, inspections and who may do the work', 'Whether a reroof needs a permit depends on the city. What was read, city by city.', '<div id="g6Perm"></div>')}
        ${card('Reroof permits in two cities that require them', 'Permits a year from the cities\' open data. They measure the reroof market only where a permit is required.', '<div id="g6PermC"></div><p class="chartnote" id="g6PermN"></p>')}
      </div>
      <div class="split">
        ${card('How to read this module', 'What each record is and is not.', '<div id="g6Read"></div>')}
        ${card('Caveats and sources', 'Where the counts can mislead, and where they came from.', '<div id="g6Src"></div>')}
      </div>
      <div class="foot" id="g6Foot"></div></div>`;
    const kp = [];
    if (fairAll) kp.push({ l: 'FAIR Plan home policies', g: 'A', v: K(fairAll), d: `${D(fairAll / Math.max(1, huAll) * 100, 1)} per 100 homes${fair22 ? ` · ${D(fairAll / fair22, 1)}× the count four years earlier` : ''}` });
    if (nonAll) kp.push({ l: 'Home policies not renewed, latest year', g: 'A', v: K(nonAll), d: 'insurer and policyholder decisions together (Department of Insurance)' });
    if (destAll != null) kp.push({ l: 'Structures destroyed by wildfire', g: 'A', v: K(destAll), d: `${dmgAll != null ? N(dmgAll) + ' more damaged · ' : ''}CAL FIRE inspections on record` });
    kp.push({ l: 'FEMA roof or property registrations', g: 'A', v: K(femaAll), d: `${fyYears.length ? Math.min(...fyYears) + ' to ' + Math.max(...fyYears) : 'all disasters on file'}; ${K(fema20)} since 2020 · ${D(femaAll / Math.max(1, huAll) * 100, 2)} per 100 homes` });
    if (lastY) kp.push({ l: `Homes permitted, ${lastY}`, g: 'A', v: N(g6Units(permY[lastY])), d: ytdOk ? `${N(DATA.ts.ytd26)} so far in ${lastY + 1}, ${S((DATA.ts.ytd26 / DATA.ts.ytd25 - 1) * 100, 0)}% on the same months of ${lastY}` : 'Census Building Permits Survey' });
    if (META.cbp) kp.push({ l: 'Roofing contractors with employees', g: 'A', v: N(META.cbp.est), d: `${N(META.cbp.emp)} employees (County Business Patterns)${META.nes ? `; ${N(META.nes.est2381)} nonemployer exterior trades firms` : ''}` });
    if (isN(lic.clear || lic.n)) kp.push({ l: 'Active C-39 Roofing licenses', g: 'A', v: N(lic.clear || lic.n), d: `${isN(lic.n) && isN(lic.clear) ? N(lic.n) + ' on the renewed roll · ' : ''}${isN(lic.out) ? N(lic.out) + ' with an out of state address' : 'CSLB master file'}` });
    $('#g6Kpis', root).innerHTML = kpiHTML(kp.slice(0, 7));
    const tipRows = p => [has('fair') && ['FAIR Plan home policies', N(p.fair_pif)], ['FEMA registrations, all disasters', N(p.fema_k)], has('dins') && ['Structures destroyed by wildfire', N(G6Z.sum(p, 'fire_dest'))], has('lic') && ['Active C-39 licenses', N(p.lic)], ['Homes built before 1980', P(PMET.old.f(p), 0)]].filter(Boolean);
    const map = new ZipMap($('#g6Map', root), { segHit: 'none', roads: false, parishLabels: true, countyLabels: true, aria: 'Map of California counties', onParish: f => { st.sel = st.sel === f ? null : f; render(); }, onParishHover: (f, e) => { const p = PAI[f]; if (!p) return; const M = PMET[st.m]; showTip(parishTip(f, [[esc(M.s), M.fmt(M.f(p))]].concat(tipRows(p))), e); } });
    function render() {
      const M = PMET[st.m]; const vals = PA.map(p => M.f(p));
      const sc = M.div ? divScale(vals, 0) : qScale(vals, 'green', 1);
      map.fillParish(f => sc.f(M.f(PAI[f]))); map.selectParish(st.sel);
      const v = vals.filter(isN);
      $('#g6Leg', root).innerHTML = legendHTML({ title: M.l, R: sc.R, lo: M.fmt(M.div ? sc.lo : Math.min(...v)), hi: M.fmt(M.div ? sc.hi : Math.max(...v)), note: `<b>${M.div ? 'Copper rose, blue fell' : 'Darker counties rank higher'}.</b> ${M.div ? 'Diverging scale centered on zero.' : `Eight quantile classes across the ${N(v.length)} counties with a value.`} ${G(M.g)}<br>${esc(M.note)}` });
      drawDetail(); drawTable();
    }
    const TBL = ['fair', 'fairx', 'nonren', 'dins', 'fhsz', 'fema', 'tile', 'ra25', 'permits', 'old', 'mh', 'roofers', 'lic'].filter(has);
    function drawTable() {
      const cols = [{ k: 'name', h: 'County', l: 1, f: v => `<b>${esc(v)}</b>` }, { k: 'reg', h: 'Region', l: 1, v: r => REGN[r.reg] }, { k: 'hu', h: 'Homes', f: v => N(v) }]
        .concat(TBL.map(k => ({ k: 'm_' + k, h: PMET[k].s, v: r => PMET[k].f(r), f: v => PMET[k].fmt(v), t: PMET[k].l })));
      dataTable($('#g6Tbl', root), cols, PA, { sortKey: 'm_' + (TBL.includes(st.m) ? st.m : TBL[0]), id: r => r.fips, onClick: f => { st.sel = f; render(); window.scrollTo({ top: $('#g6Map', root).getBoundingClientRect().top + scrollY - 120, behavior: 'smooth' }); }, rowClass: r => r.fips === st.sel ? 'sel' : '' });
    }
    /* the eleven years ending with the compile year */
    const RY = Array.from({ length: 11 }, (_, i) => cy - 10 + i);
    const femaByYear = pf => { const o = {}; FY.forEach(a => { const n = pf ? ((pf.fema || {})[a[0]] || 0) : (+a[3] || 0); o[a[2]] = (o[a[2]] || 0) + n; }); return o; };
    const insBlock = p => !INS ? null : p ? ((INS.county || {})[p.fips] || null) : (INS.state || null);
    const yrOf = (o, y) => o == null ? null : Array.isArray(o) ? (insY.indexOf(y) >= 0 ? o[insY.indexOf(y)] : null) : (o[y] != null ? o[y] : null);
    function drawDetail() {
      const p = st.sel ? PAI[st.sel] : null; const box = $('#g6Detail', root);
      const yTable = (pp, title) => { const fy = femaByYear(pp); const ib = insBlock(pp); const ps = PTS.length ? PTS.filter(q => !pp || q.pi === pp.i) : null;
        const bp = y => y === lastY + 1 ? (pp ? pp.ytd26 : DATA.ts.ytd26) : pp ? ((pp.bps || {})[y] ? g6Units(pp.bps[y]) : null) : (permY[y] ? g6Units(permY[y]) : null);
        const rows = [['FEMA', 'FEMA roof or property registrations, in the year of the disaster', y => fy[y] || 0], ['Permits', `Homes permitted (${lastY + 1} is the year to date)`, bp]];
        if (ib && ib.fair_pif) rows.push(['FAIR Plan', 'FAIR Plan home policies in force at the fiscal year end', y => yrOf(ib.fair_pif, y)]);
        if (ib && ib.nonren) rows.push(['Not renewed', 'Home policies not renewed in the year', y => yrOf(ib.nonren, y)]);
        if (ps && ps.length) rows.push(['Reports', 'Located weather and fire reports', y => ps.filter(q => q.y === y).length]);
        return `<div class="xscroll"><table class="keep compact"><thead><tr><th class="l">${esc(title)}</th>${rows.map(r => `<th title="${esc(r[1])}">${r[0]}</th>`).join('')}</tr></thead><tbody>${RY.map(y => `<tr><td class="l">${y}${y === lastY + 1 ? '*' : ''}</td>${rows.map(r => { const v = r[2](y); return `<td>${v == null ? '—' : N(v)}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div><p class="mini" style="margin-top:4px">FEMA counts sit in the year of the disaster. A dash means the source has no figure for that year. *Permits for ${lastY + 1} are the year to date.</p>`; };
      if (!p) {
        $('#g6Name', root).textContent = 'California'; $('#g6Sub', root).textContent = 'Click a county for its record'; $('#g6Pill', root).textContent = 'State';
        const fy = femaByYear(null); const top = Object.entries(fy).sort((a, b) => b[1] - a[1]).slice(0, 2).filter(e => e[1] > 0); const first5 = pYears.slice(-5)[0];
        box.innerHTML = yTable(null, 'Statewide') + `<p class="mini" style="margin-top:8px">${top.length ? `FEMA counts belong to the year of the disaster: the largest years on file are ${top.map(([y, n]) => `${y} (${N(n)}: ${esc(andList(FY.filter(a => +a[2] === +y && a[3] > 0).map(a => String(a[1])).slice(0, 3)))})`).join(' and ')}. ` : ''}${lastY && first5 ? `Homes permitted went from ${N(g6Units(permY[first5]))} in ${first5} to ${N(g6Units(permY[lastY]))} in ${lastY}${ytdOk ? `, and ${lastY + 1} to date runs ${P(Math.abs((DATA.ts.ytd26 / DATA.ts.ytd25 - 1) * 100), 0)} ${DATA.ts.ytd26 < DATA.ts.ytd25 ? 'below' : 'above'} the same months of ${lastY}` : ''}.` : ''}${fairAll && fair22 ? ` FAIR Plan home policies stand at ${N(fairAll)}, ${D(fairAll / fair22, 1)} times the count four year ends earlier.` : ''}</p>`;
        return;
      }
      $('#g6Name', root).textContent = p.name + ' County'; $('#g6Sub', root).textContent = `${REGN[p.reg] || ''} · ${N(p.hu)} homes · ${N(p.pop)} residents · ${N(p.nzip)} ZIPs`; $('#g6Pill', root).textContent = 'County';
      const fl = FY.filter(a => (p.fema || {})[a[0]] > 0).sort((a, b) => b[2] - a[2]);
      const cs = CITIES.filter(x => x.pi === p.i).sort((a, b) => b.pop - a.pop).slice(0, 6);
      const stRate = k => { const xs = PA.map(q => [PMET[k].f(q), q.hu || 0]).filter(a => isN(a[0])); const w = sum(xs.map(a => a[1])); return w ? sum(xs.map(a => a[0] * a[1])) / w : null; };
      const row = (a, b) => `<div class="rowl"><span>${a}</span><b>${b}</b></div>`;
      const pl = (typeof PL !== 'undefined' ? PL : []).filter(l => isN(p['p_' + l.key]));
      box.innerHTML = yTable(p, p.name) + `
        <div class="dsec">Insurance</div>
        ${isN(p.fair_pif) ? row('FAIR Plan home policies · four year ends earlier · exposure', `${N(p.fair_pif)} · ${N(p.fair_pif22)} · ${isN(p.fair_tiv) ? MM(p.fair_tiv * 1e6) : '—'}`) : '<p class="mini">No FAIR Plan figures in this build.</p>'}
        ${isN(p.nonren) ? row('Home policies not renewed, latest year · share · four years', `${N(p.nonren)} · ${P(p.nonren_sh, 1)} · ${N(p.nonren4)}`) : ''}
        ${isN(p.wf_claims) ? row('Fire and smoke claims paid · losses (six years)', `${N(p.wf_claims)} · ${MM((p.wf_loss || 0) * 1000)}`) : ''}
        ${has('dins') ? row('Structures destroyed · damaged by wildfire (CAL FIRE)', `${N(G6Z.sum(p, 'fire_dest'))} · ${G6Z.has('fire_dmg') ? N(G6Z.sum(p, 'fire_dmg')) : '—'}`) : ''}
        ${has('fhsz') ? row('Homes in High or Very High fire zones', P(PMET.fhsz.f(p), 0)) : ''}
        <div class="dsec">FEMA registrations by disaster</div>${fl.map(a => row(`${esc(a[1])} (${a[2]}, DR ${esc(a[0])}${a[7] ? ', ' + esc(a[7]) : ''})`, `${N(p.fema[a[0]])} · ${D(p.fema[a[0]] / Math.max(1, p.hu) * 100, 2)} per 100 homes`)).join('') || '<p class="mini">No FEMA roof or property registrations recorded for the county.</p>'}
        ${isN(p.fema_reg) ? row('All household registrations · homes recorded destroyed', `${N(p.fema_reg)} · ${N(p.fema_dest)}`) : ''}
        <div class="dsec">Against the state (homes weighted)</div>
        ${['fair', 'nonren', 'dins', 'fema', 'tile', 'ra25', 'permits', 'lic'].filter(has).map(k => { const M = PMET[k]; const v = M.f(p), sv = stRate(k); return row(esc(M.s), `${M.fmt(v)}${isN(v) && sv ? ' · ' + D(v / sv, 2) + '× state' : ''}`); }).join('')}
        <div class="dsec">Roof stock (model) and the ${N(pl.length)} service lines at default assumptions</div>
        ${row('One unit roofs · 20 years or older · 25 or older', `${N(p.roofs)} · ${N(p.ra20)} · ${isN(p.ra25) ? N(p.ra25) : '—'}`)}
        ${isN(p.tile_n) ? row('Tile roofs · tile underlayment jobs due in twelve months', `${N(p.tile_n)} · ${isN(p.nxt_t) ? N(p.nxt_t) : '—'}`) : ''}
        ${row('Gross profit pool a year', MM(p.fees))}
        ${pl.map(l => row(esc(l.name), `${p['p_' + l.key] < 10 ? D(p['p_' + l.key], 1) : N(p['p_' + l.key])} jobs a year`)).join('')}
        <div class="dsec">Places and trades</div>
        ${row('Largest cities', cs.map(x => esc(x.name)).join(', ') || '—')}
        ${row('Roofing contractors: county file · ZIP file', `${p.cbp_roof != null ? N(p.cbp_roof) : 'not published'} · ${N(p.roofers)}`)}
        ${row('C-39 licenses: active by mailing ZIP · all on the roll · CSLB county field', `${N(p.lic)} · ${isN(p.lic_all) ? N(p.lic_all) : '—'} · ${isN(p.lic_cnty) ? N(p.lic_cnty) : '—'}`)}
        ${row('Nonemployer exterior trades firms · roofing supply wholesalers · insurance agencies', `${isN(p.nes2381) ? N(p.nes2381) : '—'} · ${p.cbp_sup != null ? N(p.cbp_sup) : 'not published'} · ${N(p.ins_agents)}`)}
        <div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap"><button class="ibtn" id="g6PIdx">Roof Demand Index ↗</button><button class="ibtn" id="g6PCor">${esc(SLN)} ↗</button><button class="ibtn" id="g6Clr">Clear</button></div>`;
      /* modules 01 and 02 take a county through their county menus (#i1Par, #s2Par) */
      const send = (mod, selId) => { goModule(mod, { fips: p.fips }); const sel = $(selId); if (sel && [...sel.options].some(o => o.value === p.fips)) { sel.value = p.fips; sel.dispatchEvent(new Event('change')); } };
      $('#g6PIdx', root).onclick = () => send('index', '#i1Par'); $('#g6PCor', root).onclick = () => send('storms', '#s2Par');
      $('#g6Clr', root).onclick = () => { st.sel = null; render(); };
    }
    /* two records set against each other; the pairs are tried in order and the first two the build can fill are drawn */
    const PAIRS = [['fhsz', 'fair', 'Where the fire zone maps put homes, the FAIR Plan writes policies'], ['fhsz', 'dins', 'Fire zone share against structures CAL FIRE found destroyed'], ['fair', 'nonren', 'FAIR Plan take up against policies not renewed'], ['wind', 'femastorm', 'Gust days against FEMA storm registrations'], ['old', 'ra25', 'Old homes against old roofs (the model against the census)'], ['roofers', 'lic', 'Roofing establishments against C-39 licenses']].filter(a => has(a[0]) && has(a[1])).slice(0, 2);
    function drawStatic() {
      ['#g6Sc1', '#g6Sc2'].forEach((id, i) => { const pr = PAIRS[i]; const host = $(id, root), note = $(id + 'n', root); if (!pr) { host.innerHTML = ''; note.textContent = i === 0 ? 'This build does not carry two independent county records to set against each other.' : ''; return; }
        const X = PMET[pr[0]], Y = PMET[pr[1]]; const rows = PA.filter(p => isN(X.f(p)) && isN(Y.f(p)));
        const big = rows.slice().sort((a, b) => (b.hu || 0) - (a.hu || 0)).slice(0, 5).map(p => p.fips); const hi = rows.slice().sort((a, b) => Y.f(b) - Y.f(a)).slice(0, 4).map(p => p.fips);
        const pts = rows.map(p => ({ x: X.f(p), y: Y.f(p), r: 3 + Math.sqrt((p.hu || 0) / 4e4), c: ramp(i ? 'teal' : 'green')[6], tip: `<div class="tt">${esc(p.name)} County</div>${tipRow(esc(X.s), X.fmt(X.f(p)))}${tipRow(esc(Y.s), Y.fmt(Y.f(p)))}`, lab: big.includes(p.fips) || hi.includes(p.fips) ? p.name : '' }));
        const r = scatter(host, { pts, x: { label: X.l, fmt: v => D(v, v < 10 ? 1 : 0) }, y: { label: Y.l, fmt: v => D(v, v < 10 ? 1 : 0) }, labels: 8, H: 300, aria: pr[2] });
        const xs = rows.map(p => X.f(p)), ys = rows.map(p => Y.f(p)); const mx = mean(xs), my = mean(ys); let sxy = 0, sxx = 0; xs.forEach((x, j) => { sxy += (x - mx) * (ys[j] - my); sxx += (x - mx) ** 2; }); const b = sxy / (sxx || 1), a = my - b * mx;
        const o = rows.map((p, j) => [p.name, ys[j] - (a + b * xs[j])]).sort((u, v) => v[1] - u[1]); const rr = r && isN(r.r) ? r.r : pearson(xs, ys);
        note.innerHTML = `<b>${esc(pr[2])}.</b> Across ${N(rows.length)} counties r = ${DS(rr, 2)}${Math.abs(rr) >= 0.5 ? ': the two records move together' : Math.abs(rr) >= 0.25 ? ': a loose tie' : ': little tie, so neither record can stand in for the other'}. Furthest above the line: ${esc(andList(o.slice(0, 4).map(q => q[0])))}; furthest below: ${esc(andList(o.slice(-3).map(q => q[0])))}. Dot size follows homes. The counties off the line are where to look for a reason the records do not carry: a recent fire, a city that adopted a wider map, or insurers leaving for causes other than fire.`; });
    }
    drawStatic();
    const LEAD = has('fair') ? 'fair' : has('fema') ? 'fema' : MK[0]; const LM = PMET[LEAD];
    const lrows = PA.map(p => ({ p, v: LM.f(p) })).filter(o => isN(o.v)); const wsum = sum(lrows.map(o => o.p.hu || 0)); const sr = wsum ? sum(lrows.map(o => o.v * (o.p.hu || 0))) / wsum : null;
    const out = lrows.map(o => Object.assign(o, { r: sr ? o.v / sr : null })).sort((a, b) => b.v - a.v);
    const extra = LEAD === 'fair' ? [['Policies', o => N(o.p.fair_pif)], ['Growth', o => PMET.fairx.fmt(PMET.fairx.f(o.p))], ['Not renewed %', o => isN(o.p.nonren_sh) ? D(o.p.nonren_sh, 1) : '—']] : [['Registrations', o => N(o.p.fema_k)], ['Since 2020', o => N(femaSince(o.p, 2020))]];
    const orow = (o, bold) => `<tr><td class="l">${bold ? '<b>' : ''}${esc(o.p.name)}${bold ? '</b>' : ''}</td><td>${LM.fmt(o.v)}</td><td>${isN(o.r) ? D(o.r, 2) + '×' : '—'}</td>${extra.map(e => `<td>${e[1](o)}</td>`).join('')}</tr>`;
    const topReg = (() => { const c = {}; out.slice(0, 12).forEach(o => { const n = REGN[o.p.reg] || ''; c[n] = (c[n] || 0) + 1; }); return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n, k]) => `${n} (${k})`); })();
    $('#g6Out', root).innerHTML = `<div class="xscroll"><table><thead><tr><th class="l">County</th><th>${esc(LM.s)}</th><th>× state</th>${extra.map(e => `<th>${e[0]}</th>`).join('')}</tr></thead><tbody>${out.slice(0, 12).map(o => orow(o, 1)).join('')}<tr><td class="l mini" colspan="${3 + extra.length}">Lowest</td></tr>${out.slice(-6).map(o => orow(o)).join('')}</tbody></table></div><p class="chartnote">The state rate is ${LM.fmt(sr)} (${esc(LM.s.toLowerCase())}, homes weighted). The twelve highest counties sit mostly in ${esc(andList(topReg))}. ${LEAD === 'fair' ? 'A high FAIR Plan rate is a record of insurers leaving, which is the market for fire hardened roofs; it is not a record of roof damage, and the Plan\'s own totals differ slightly between its county file and its web page.' : 'FEMA counts only declared disasters and only those who applied.'}</p>`;
    const c0 = CITIES[0] || {}; const cj = ['replace', 'repair', 'storm', 'tile', 'harden'].filter(k => ('p_' + k) in c0); const lg = [['span', 'Spanish %'], ['chin', 'Chinese %'], ['viet', 'Vietnamese %'], ['tagalog', 'Tagalog %'], ['korean', 'Korean %']].filter(a => a[0] in c0);
    dataTable($('#g6Cities', root), [{ k: 'name', h: 'City', l: 1, f: v => `<b>${esc(v)}</b>` }, { k: 'par', h: 'County', l: 1, v: r => PA[r.pi] ? PA[r.pi].name : '' }, { k: 'pop', h: 'Residents', f: v => N(v) }, { k: 'roofs', h: 'Roofs', f: v => N(v) }, { k: 'ra20s', h: '20 yrs+', v: r => r.ra20 / Math.max(1, r.roofs) * 100, f: v => P(v, 0) }]
      .concat(cj.map(k => ({ k: 'p_' + k, h: (typeof PLI !== 'undefined' && PLI[k] ? PLI[k].short : capS(k)), f: v => N(v) })))
      .concat([{ k: 'fees', h: 'Profit pool', f: v => MM(v) }, { k: 'comp', h: 'C-39 within 8 km', f: v => N(v), t: 'Active C-39 Roofing licenses whose mailing ZIP lies within 8 km of the city center' }, { k: 'lic', h: 'Licenses', f: v => D(v, 0) }])
      .concat('tile_n' in c0 ? [{ k: 'tile_n', h: 'Tile roofs', f: v => N(v) }] : []).concat('fair_pif' in c0 ? [{ k: 'fair_pif', h: 'FAIR Plan', f: v => N(v) }] : [])
      .concat(lg.map(([k, h]) => ({ k: 'l_' + k, h, v: r => (r[k] || 0) / Math.max(1, r.pop) * 100, f: v => P(v, 1) }))), CITIES, { sortKey: 'fees' });
    /* ---------- field knowledge ---------- */
    const matT = (title, rows) => `<div class="dsec">${esc(title)}</div><div class="xscroll"><table class="keep compact"><thead><tr><th class="l"></th><th>Homes sampled</th>${G6_MAT.cols.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(([l, n, v]) => `<tr><td class="l">${esc(l)}</td><td>${N(n)}</td>${v.map(x => `<td>${P(x, 1)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    $('#g6Mat', root).innerHTML = matT('Statewide and the nation', G6_MAT.state) + matT('By era built (California)', G6_MAT.era) + matT('By climate (California)', G6_MAT.clim) + `<p class="mini" style="margin-top:6px">${esc(G6_MAT.src)}. ${G('B')} The occupant names the material, so clay and concrete tile are easily confused; samples are small (the mountain and mixed dry climates had too few homes to report); the survey is from 2020.</p>` + proseTable(G6_FIELD.mat.map(r => [`<b>${esc(r[0])}</b>`, esc(r[1])]));
    const pt = (id, k) => { $(id, root).innerHTML = proseTable(G6_FIELD[k].map(r => [`<b>${esc(r[0])}</b>`, esc(r[1])])); };
    pt('#g6Tile', 'tile'); pt('#g6Wood', 'wood'); pt('#g6Fire', 'fire'); pt('#g6Wx', 'weather'); pt('#g6Perm', 'permit');
    $('#g6Cool', root).innerHTML = `<div class="xscroll"><table><thead><tr><th class="l">Building</th><th class="l">Trigger</th><th class="l">Slope</th><th class="l">Climate zones</th><th>Aged solar reflectance, at least</th><th>Or SRI, at least</th></tr></thead><tbody>${G6_COOL.map(r => `<tr><td class="l">${esc(r[0])}</td><td class="l wrap">${esc(r[1])}</td><td class="l">${esc(r[2])}</td><td class="l">${esc(r[3])}</td><td>${r[4]}</td><td>${r[5]}</td></tr>`).join('')}</tbody></table></div><p class="mini" style="margin-top:6px">Thermal emittance must also be at least 0.75 (0.80 for the steep nonresidential rule in zones 2 and 4 to 16). Low slope means under 2:12. Products must be rated and labeled by the Cool Roof Rating Council or take a penalty default: 0.08 for an unrated asphalt shingle, 0.10 for anything else. Exceptions a roofer uses: roofs of 25 pounds per square foot or more (most tile); a steep house roof over an attic insulated to R-38, with a radiant barrier, or with R-2 continuous insulation at the deck; area under building integrated solar; and, on low slopes, trading reflectance for deck insulation. A low slope reroof also triggers insulation: R-14 continuous on houses and multifamily, R-23 on nonresidential roofs (R-17 in zones 6 to 8), with recoats exempt. The 16 climate zones are assigned by ZIP in the Energy Code's Joint Appendix JA2; this build does not carry the zone of each ZIP, so check the address. Source: California Energy Commission, 2022 and 2025 Building Energy Efficiency Standards, sections 150.2(b), 180.2(b) and 141.0(b). ${G('A')}</p>`;
    function drawPerm() { const names = ['Los Angeles', 'San Francisco'].filter(n => Object.keys(permCity(n)).length); const host = $('#g6PermC', root); if (!names.length) { host.innerHTML = '<p class="mini">No city permit series in this build.</p>'; return; }
      const yrs = [...new Set(names.flatMap(n => Object.keys(permCity(n)).map(Number)))].filter(y => y < cy).sort((a, b) => a - b);
      barChart(host, { cats: yrs.map(String), series: names.map((n, i) => ({ name: n, color: ramp(i ? 'teal' : 'green')[6], values: yrs.map(y => permCity(n)[y] || 0) })), H: 220, W: 520, fmt: v => K(v), aria: 'Reroof permits a year in Los Angeles and San Francisco' });
      const la = permCity('Los Angeles'); const pk = Object.entries(la).filter(e => +e[0] < cy).sort((a, b) => b[1] - a[1])[0];
      $('#g6PermN', root).innerHTML = `${names.map((n, i) => `<span style="color:${ramp(i ? 'teal' : 'green')[6]}">■</span> ${esc(n)}`).join(' &nbsp; ')}. ${pk ? `The City of Los Angeles issued the most reroof permits in ${pk[0]} (${N(pk[1])})${la[+pk[0] - 1] ? `, ${S((pk[1] / la[+pk[0] - 1] - 1) * 100, 0)}% on the year before` : ''}. ` : ''}Los Angeles counts permits issued whose description names a reroof; San Francisco counts permits filed with its reroof flag. The current year is left off because it is not complete. San Diego requires no permit for most reroofs, so its counts would miss the market. City open data as read for this build. ${G('A')} for the counts.`; }
    drawPerm();
    $('#g6Read', root).innerHTML = proseTable([
      ['FAIR Plan policies', 'Policies in force with the insurer of last resort, by its own county and ZIP files at its fiscal year ends. A measure of where the ordinary market stopped writing. It covers fire and a short list of named perils; it is not a count of damage.'],
      ['Non renewals', 'Residential policies not renewed, from the Department of Insurance. The recent file joins insurer and policyholder decisions; only the older file splits them.'],
      ['Wildfire inspections', 'CAL FIRE inspectors record each structure inside or near a fire perimeter as destroyed, damaged or unharmed. Digital records start in 2013; undamaged structures were collected only from 2018.'],
      ['FEMA registrations', `Owners and renters who applied for federal individual assistance after a declared disaster and showed roof damage (older disasters) or verified property loss without flood (2020 on). ${capS(inTen(FEMA_INS.sh))} registrants reported homeowners insurance. Fires, storms and earthquakes are all in the count: read the split measures.`],
      ['Permits', 'New housing units authorized by local permit offices, as reported to the Census Bureau. Reroofs are not in this survey; where a city requires a reroof permit its own data holds them (two cities are charted above).'],
      ['Contractors and licenses', 'County Business Patterns counts establishments with employees and withholds small cells; license records count C-39 licenses by mailing address, about two for every employer establishment, because many licensees have no payroll.'],
      ['Modeled measures', 'Tile share, roof age and the gross profit pool come from the atlas\'s own models, included so the record and the model sit side by side. They carry grades B and D.'],
    ]);
    const fyr = fyYears.length ? `${Math.min(...fyYears)} to ${Math.max(...fyYears)}` : '';
    $('#g6Src', root).innerHTML = proseTable([
      ['Two FEMA roll ups', femaZip != null && femaCty && femaZip !== femaCty ? `Summed over ZIP rows the count is ${N(femaZip)}; summed over county records it is ${N(femaCty)}. The difference is registrations at postal ZIPs that are not ZIP rows of the atlas. The headline here and in module 01 uses the ZIP rows.` : 'The headline is the same count module 01 shows.'],
      ['Declared disasters only', 'Most wind and rain damage never reaches a federal declaration, and insured owners have little reason to register.'],
      ['Small counties', 'Rates in counties of a few thousand homes swing on a handful of records. Read the counts beside the rates.'],
      ['Mailing addresses', 'A license or a policy sits at the address on file, which can be a county away from the roof.'],
      ['Field knowledge', 'The cards below the tables quote the evidence file compiled for this build. Where it found nothing they say so; nothing was filled in from memory.'],
    ]) + srcRows((Array.isArray(META.src) && META.src.length ? META.src.map(s => [esc(s.k || ''), esc(s.name || ''), s.grade || '', esc(s.vintage || ''), s.url || '']) : [
      ['FAIR Plan', 'California FAIR Plan Association, policies in force and exposure by county and ZIP, five fiscal year ends', 'A', '', 'https://www.cfpnet.com/key-statistics-data/'],
      ['Non renewals and fire losses', 'California Department of Insurance, residential policies renewed and not renewed; wildfire risk information report', 'A', '', 'https://www.insurance.ca.gov/'],
      ['Wildfire inspections and zones', 'CAL FIRE Damage Inspection data; State Fire Marshal Fire Hazard Severity Zone maps', 'A', '', 'https://www.fire.ca.gov/'],
      ['FEMA registrations', `OpenFEMA Individuals and Households Program valid registrations, ${N(nDis)} California disasters ${fyr}`, 'A', 'v2', 'https://www.fema.gov/openfema-data-page/individuals-and-households-program-valid-registrations-v2'],
      ['Homes', 'ACS five year; Census Gazetteer for land area', 'A', '', 'https://www.census.gov/'],
      ['Permits', 'Census Building Permits Survey, county annual and year to date', 'A', '', 'https://www.census.gov/construction/bps/'],
      ['Contractors and suppliers', 'County and ZIP Business Patterns (NAICS 238160, 423330, 524210); Nonemployer Statistics (NAICS 2381)', 'A', '', 'https://www.census.gov/programs-surveys/cbp.html'],
      ['Licenses', 'Contractors State License Board, License Master file, C-39 Roofing', 'A', '', 'https://www.cslb.ca.gov/onlineservices/dataportal/ContractorList.aspx'],
    ]).concat([
      ['Roofing material', G6_MAT.src, 'B', '2020', 'https://www.eia.gov/consumption/residential/data/2020/'],
      ['Cool roofs', 'California Energy Commission, Building Energy Efficiency Standards (Title 24, Part 6), 2022 and 2025', 'A', '2025', 'https://www.energy.ca.gov/programs-and-topics/programs/building-energy-efficiency-standards'],
      ['Reroof and fire zone rules', 'California Residential Code R908; California Wildland-Urban Interface Code (Title 24, Part 7), read on a transcription host', 'B', '2025', ''],
      ['City reroof permits', 'City of Los Angeles and City and County of San Francisco open data, building permits', 'A', String(cy), 'https://data.lacity.org/'],
    ]));
    $('#g6Foot', root).innerHTML = `<b style="color:var(--ink)">California Roofer Guru</b>, module 06. Records as published by the FAIR Plan, the Department of Insurance, CAL FIRE, FEMA, the Census Bureau and the Contractors State License Board. Compiled ${esc(compiled)}.`;
    $('#g6Met', root).value = st.m; $('#g6Met', root).onchange = e => { st.m = e.target.value; render(); };
    const csvCounties = () => { const ks = MK; return { head: ['county', 'fips', 'region', 'homes', 'residents'].concat(ks).concat(['fema_registrations', 'fair_plan_home_policies', 'policies_not_renewed', 'wildfire_structures_destroyed', 'cbp_roofing_establishments', 'c39_licenses_active']), rows: PA.map(p => [p.name, p.fips, REGN[p.reg], p.hu, p.pop].concat(ks.map(k => { const v = PMET[k].f(p); return isN(v) ? +D(v, 3) : ''; })).concat([p.fema_k, isN(p.fair_pif) ? p.fair_pif : '', isN(p.nonren) ? p.nonren : '', G6Z.has('fire_dest') ? G6Z.sum(p, 'fire_dest') : '', p.cbp_roof != null ? p.cbp_roof : '', p.lic])) }; };
    const lk = (typeof LINE_KEYS !== 'undefined' ? LINE_KEYS : []).filter(k => ('p_' + k) in c0);
    const csvCities = () => ({ head: ['city', 'county', 'residents', 'zips', 'one_unit_roofs', 'roofs_20_plus', 'gross_profit_pool'].concat(lk.map(k => 'jobs_' + k)).concat(['c39_licenses_within_8km', 'license_records']).concat(lg.map(a => ({ span: 'spanish', chin: 'chinese', viet: 'vietnamese', tagalog: 'tagalog', korean: 'korean' })[a[0]] + '_speakers')), rows: CITIES.map(c => [c.name, PA[c.pi] ? PA[c.pi].name : '', c.pop, c.nzip, c.roofs, c.ra20, c.fees].concat(lk.map(k => c['p_' + k])).concat([c.comp, c.lic]).concat(lg.map(a => c[a[0]]))) });
    $('#g6Csv', root).onclick = () => { const o = csvCounties(); saveFile('california-county-records.csv', toCSV(o.head, o.rows, 'California Roofer Guru, module 06. FAIR Plan, Department of Insurance, CAL FIRE, FEMA, Census and CSLB records by county.')); };
    $('#g6CiCsv', root).onclick = () => { const o = csvCities(); saveFile('california-cities.csv', toCSV(o.head, o.rows, 'California Roofer Guru, module 06.')); };
    $('#g6Paid', root).onclick = () => goModule('paid'); $('#g6Cor', root).onclick = () => goModule('storms');
    BUS.on('theme', () => { render(); drawStatic(); drawPerm(); });
    this.receive = p => { if (p && p.fips && PAI[p.fips]) { st.sel = p.fips; render(); } };
    this.api = { measures: () => MK.slice(), missing: () => missing.slice(), csvCounties, csvCities, fema: () => ({ zip: femaZip, county: femaCty, shown: femaAll, since2020: fema20, disasters: nDis }), pairs: () => PAIRS.map(a => a.slice(0, 2)) };
    render();
  }
});
