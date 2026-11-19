/* ==== 13_m01_index.js ==== */
/* ==== m01_index ==== */
"use strict";
/* ============================ shared layer catalog (modules 1, 4, 5, 6, 7, 11, 12, 17) ============================ */
const LAYERS = {
  idx: { l: 'Roof Demand Index (percentile)', grp: 'Index', dir: 1, ramp: 'green', g: 'C', f: v => D(v, 0), note: 'Weighted composite of the eleven service line rates (log of expected jobs per 10,000 residents, standardized). A percentile across the scored ZIPs: 100 carries the most roofing demand per resident, not "100 percent of anything".' },
  idx_eq: { l: 'Roof Demand Index, equal weights (percentile)', grp: 'Index', dir: 1, ramp: 'green', g: 'C', f: v => D(v, 0), note: 'The same eleven components with every weight equal. The sensitivity check for the weighted index.' },
  fees: { l: 'Gross profit pool a year at default assumptions ($)', grp: 'Index', dir: 1, ramp: 'green', g: 'D', f: v => MM(v), note: 'Jobs open to marketing times the default job value times a 33 percent gross margin, summed over the eleven lines. Volume, so big ZIPs shade darker. The assumptions are yours to change in modules 05 and 12.' },
  fees_pc: { l: 'Gross profit pool per 1,000 residents ($)', grp: 'Index', dir: 1, ramp: 'green', g: 'D', f: v => M$(v), note: 'Gross profit pool divided by residents: where each household carries the most roofing value.' },
  cases: { l: 'Jobs a year open to marketing (all lines, model)', grp: 'Index', dir: 1, ramp: 'green', g: 'D', f: v => D(v, 1), note: 'Expected jobs times the share an owner gives to a contractor found through search, ads, referrals or the door (default assumptions).' },
  gi: { l: 'Hot spot statistic, Getis Ord Gi* on the index (z)', grp: 'Index', dir: 0, ramp: 'div', g: 'C', f: v => S(v, 2), note: 'Each ZIP and its eight nearest neighbors against the state: above 1.96 is a statistically significant cluster of high roofing demand (95%), below minus 1.96 a cold cluster. Clusters are where a radius or DMA buy beats ZIP lists.' },
  roofs: { l: 'One unit roofs (detached and attached homes)', grp: 'Roof stock and age', dir: 1, ramp: 'teal', g: 'A', f: v => N(v), note: 'ACS 2020 to 2024 units in structure by year built (B25034, B25127), one roof per one unit home.' },
  ra20_sh: { l: 'Roofs 20 years or older (% of one unit roofs, model)', grp: 'Roof stock and age', dir: 1, ramp: 'green', g: 'B', f: v => P(v, 0), note: 'The roof renewal model (module 17): homes by decade built, a 22 year Weibull roof life calibrated to the 2023 American Housing Survey, reset by every storm that reached the ZIP. Roof debt: past the age at which most Louisiana shingle roofs fail.' },
  ra15_sh: { l: 'Roofs 15 years or older (%, model)', grp: 'Roof stock and age', dir: 1, ramp: 'green', g: 'B', f: v => P(v, 0), note: 'The same model at 15 years, where insurers start asking about roof age.' },
  ra20: { l: 'Roofs 20 years or older (count, model)', grp: 'Roof stock and age', dir: 1, ramp: 'green', g: 'B', f: v => N(v), note: 'Roof debt in homes, not percent.' },
  wave: { l: 'Roofs aged 15 to 19 (the next five years of replacements)', grp: 'Roof stock and age', dir: 1, ramp: 'green', g: 'B', f: v => N(v), note: 'Roofs that cross 20 within five years: the coming wave, largest where a storm reset many roofs at once 15 to 19 years ago (Katrina, Rita, Gustav, Ike).' },
  nxt: { l: 'Age driven replacements, next twelve months (model)', grp: 'Roof stock and age', dir: 1, ramp: 'green', g: 'B', f: v => D(v, 0), note: 'Expected one to four unit roof replacements from wear alone in the coming year.' },
  ra_med: { l: 'Median roof age, years (model)', grp: 'Roof stock and age', dir: 1, ramp: 'teal', g: 'B', f: v => isN(v) ? D(v, 0) : '—', note: 'Half the one unit roofs in the ZIP are younger, half older.' },
  yrs64: { l: 'Years since hurricane force winds reached the ZIP', grp: 'Roof stock and age', dir: 1, ramp: 'teal', g: 'B', f: v => isN(v) ? D(v, 0) : 'none since 1950', note: 'Since the most recent storm with modeled sustained winds of 64 knots or more at the ZIP. A short gap means many young roofs and muted age driven demand.' },
  yb_med: { l: 'Median year built (ACS)', grp: 'Roof stock and age', dir: -1, ramp: 'teal', g: 'A', f: v => isN(v) ? D(v, 0) : '—', note: 'ACS B25035. Older stock carries older decking, flashing and ventilation.' },
  pre80_sh: { l: 'Homes built before 1980 (%)', grp: 'Roof stock and age', dir: 1, ramp: 'teal', g: 'A', f: v => P(v, 0), note: 'ACS B25034. On their third or fourth roof; decking and code upgrades come with the job.' },
  mh_sh: { l: 'Mobile homes (% of housing units)', grp: 'Roof stock and age', dir: 1, ramp: 'teal', g: 'A', f: v => P(v, 0), note: 'ACS B25024. The roof over and coating market.' },
  hd1: { l: 'Hail days a year, 1 inch or larger within 25 miles', grp: 'Hazard', dir: 1, ramp: 'teal', g: 'B', f: v => D(v, 2), note: 'SPC severe report database 1996 to 2025: distinct days with a report of hail 1 inch or larger within 25 miles of the ZIP, a year. Reports cluster where people live.' },
  hd175: { l: 'Damaging hail days a year, 1.75 inch or larger within 25 miles', grp: 'Hazard', dir: 1, ramp: 'teal', g: 'B', f: v => D(v, 2), note: 'Golf ball hail: the size that damages most asphalt shingles.' },
  hd1_10: { l: 'Hail days a year, recent decade (2016 to 2025)', grp: 'Hazard', dir: 1, ramp: 'teal', g: 'B', f: v => D(v, 2), note: 'The recent decade beside the 30 year rate.' },
  wd50: { l: 'Damaging wind days a year, 58 mph or more within 25 miles', grp: 'Hazard', dir: 1, ramp: 'teal', g: 'B', f: v => D(v, 1), note: 'SPC thunderstorm wind reports of 50 knots or more, 1996 to 2025.' },
  td1: { l: 'Tornado days a year, EF1 or stronger within 25 miles', grp: 'Hazard', dir: 1, ramp: 'teal', g: 'B', f: v => D(v, 2), note: 'SPC tornado database, 1996 to 2025.' },
  hur64: { l: 'Chance of hurricane force winds in a year (%)', grp: 'Hazard', dir: 1, ramp: 'teal', g: 'B', f: v => P(v, 1), note: 'Share of years 1950 to 2025 with modeled sustained winds of 64 knots or more at the ZIP (HURDAT2 best tracks and wind radii).' },
  hur50: { l: 'Chance of 50 knot winds in a year (%)', grp: 'Hazard', dir: 1, ramp: 'teal', g: 'B', f: v => P(v, 1), note: 'Share of years 1950 to 2025 with modeled sustained winds of 50 knots (58 mph) or more.' },
  n64_00: { l: 'Hurricane force storms since 2000', grp: 'Hazard', dir: 1, ramp: 'teal', g: 'B', f: v => N(v), note: 'Count of storms 2000 to 2026 with modeled sustained winds of 64 knots or more at the ZIP.' },
  ev_h1: { l: 'Hail reports of 1 inch or more in the ZIP, 2016 to 2026', grp: 'Storm record', dir: 1, ramp: 'green', g: 'A', f: v => N(v), note: 'NOAA Storm Events Database reports placed by their coordinates. Observed, not modeled.' },
  ev_w58: { l: 'Damaging wind reports in the ZIP, 2016 to 2026', grp: 'Storm record', dir: 1, ramp: 'green', g: 'A', f: v => N(v), note: 'Thunderstorm wind reports of 50 knots or more.' },
  ev_t: { l: 'Tornado touchdowns in the ZIP, 2016 to 2026', grp: 'Storm record', dir: 1, ramp: 'green', g: 'A', f: v => N(v), note: 'Begin points of tornado tracks.' },
  fema_k: { l: 'FEMA roof and wind damage registrations, 2004 to 2026', grp: 'Storm record', dir: 1, ramp: 'green', g: 'A', f: v => N(v), note: `OpenFEMA Individuals and Households Program: registrations with FEMA inspected roof damage (2004 to 2017 disasters) or verified real property wind loss (2020 on). Counts only people who applied for federal help; ${inTen(FEMA_INS.sh)} reported homeowners insurance, and most insured roof claims never reach FEMA, so the count understates damaged roofs.` },
  fema_rate: { l: 'FEMA roof and wind registrations per 100 occupied homes', grp: 'Storm record', dir: 1, ramp: 'green', g: 'A', f: v => isN(v) ? D(v, 1) : '—', note: 'The same count divided by occupied homes (ACS 2020 to 2024).' },
  fema_ida: { l: 'FEMA verified wind loss, Hurricane Ida (2021)', grp: 'Storm record', dir: 1, ramp: 'green', g: 'A', f: v => N(v), note: 'Owner registrations with verified real property loss and no flood damage, DR 4611.' },
  fema_laura: { l: 'FEMA verified wind loss, Hurricane Laura (2020)', grp: 'Storm record', dir: 1, ramp: 'green', g: 'A', f: v => N(v), note: 'DR 4559.' },
  hu: { l: 'Housing units (ACS)', grp: 'Homes and owners', dir: 1, ramp: 'lime', g: 'A', f: v => N(v), note: 'ACS B25001.' },
  own_sh: { l: 'Owner occupied (% of occupied homes)', grp: 'Homes and owners', dir: 1, ramp: 'lime', g: 'A', f: v => P(v), note: 'ACS B25003. Owners buy roofs; landlords buy repairs.' },
  mort_sh: { l: 'Owners with a mortgage (%)', grp: 'Homes and owners', dir: 1, ramp: 'lime', g: 'A', f: v => P(v), note: 'ACS B25081. A mortgage requires hazard insurance with wind coverage, so storm and hail work runs through claims; free and clear owners may be uninsured and buy on price and financing.' },
  value: { l: 'Median home value ($)', grp: 'Homes and owners', dir: 1, ramp: 'lime', g: 'A', f: v => M$(v), note: 'ACS B25077.' },
  inc: { l: 'Median household income ($)', grp: 'Homes and owners', dir: 1, ramp: 'lime', g: 'A', f: v => M$(v), note: 'ACS B19013.' },
  hh100k_sh: { l: 'Households earning $100,000 or more (%)', grp: 'Homes and owners', dir: 1, ramp: 'lime', g: 'A', f: v => P(v), note: 'ACS B19001. Metal, FORTIFIED and premium shingle buyers.' },
  s65_sh: { l: 'Residents 65 and over (%)', grp: 'Homes and owners', dir: 1, ramp: 'lime', g: 'A', f: v => P(v), note: 'ACS B01001. Long tenure owners on older roofs.' },
  seas: { l: 'Seasonal and recreational homes (camps)', grp: 'Homes and owners', dir: 1, ramp: 'lime', g: 'A', f: v => N(v), note: 'ACS B25004. Owners who live elsewhere: reach them where they live.' },
  span_sh: { l: 'Speak Spanish at home (% of residents 5+)', grp: 'Language', dir: 1, ramp: 'lime', g: 'A', f: v => P(v), note: 'ACS C16001. Sets the Spanish build in the Desk and the Forge.' },
  viet_sh: { l: 'Speak Vietnamese at home (%)', grp: 'Language', dir: 1, ramp: 'lime', g: 'A', f: v => P(v), note: 'ACS C16001. New Orleans East, the West Bank and the coastal parishes.' },
  french_sh: { l: 'Speak French or Cajun at home (%)', grp: 'Language', dir: 1, ramp: 'lime', g: 'A', f: v => P(v), note: 'ACS C16001. Acadiana.' },
  cru: { l: 'Commercial roofs (estimate)', grp: 'Commercial stock', dir: 1, ramp: 'teal', g: 'D', f: v => D(v, 0), note: 'ZIP Code Business Patterns 2023 establishments weighted by building type and scaled to 80,000 commercial roofs statewide (CBECS 2018 national count by population).' },
  whse: { l: 'Warehousing establishments (ZBP 2023)', grp: 'Commercial stock', dir: 1, ramp: 'teal', g: 'B', f: v => N(v), note: 'NAICS 493. Big low slope roofs.' },
  mfg: { l: 'Manufacturing establishments', grp: 'Commercial stock', dir: 1, ramp: 'teal', g: 'B', f: v => N(v), note: 'NAICS 31 to 33.' },
  retail: { l: 'Retail establishments', grp: 'Commercial stock', dir: 1, ramp: 'teal', g: 'B', f: v => N(v), note: 'NAICS 44 to 45: strip centers and stand alone stores.' },
  church: { l: 'Religious organizations', grp: 'Commercial stock', dir: 1, ramp: 'teal', g: 'B', f: v => N(v), note: 'NAICS 8131: one building, a board decision and a capital campaign.' },
  apts: { l: 'Apartment lessors', grp: 'Commercial stock', dir: 1, ramp: 'teal', g: 'B', f: v => N(v), note: 'NAICS 531110.' },
  comp_mass: { l: 'Competitor presence (distance weighted)', grp: 'Competition', dir: 1, ramp: 'teal', g: 'C', f: v => D(v, 1), note: 'The mapped Louisiana roofers\' offices weighted by reach (statewide 3, national 2.5, regional 1.5, local 1) and exp(minus distance over 20 km), plus their advertised service cities at 35 percent.' },
  roofers: { l: 'Roofing contractor establishments in the ZIP (ZBP 2023)', grp: 'Competition', dir: 1, ramp: 'teal', g: 'C', f: v => N(v), note: 'NAICS 238160 employer establishments. ZIP cells under three are suppressed, so small towns read zero; the state has 267 (CBP 2023).' },
  lic: { l: 'LSLBC roofing license records in the ZIP\'s city', grp: 'Competition', dir: 1, ramp: 'teal', g: 'C', f: v => D(v, 1), note: 'Roofing license records by mailing city as mirrored from the LSLBC roster (StateCreds, October 4, 2026), split across the city\'s ZIPs. Supply, including firms without employees.' },
  comp_pct: { l: 'Competitive pressure (percentile)', grp: 'Competition', dir: 1, ramp: 'teal', g: 'C', f: v => D(v, 0), note: '60 percent mapped roofer presence, 40 percent roofing establishments and license records within about 10 km, as percentiles.' },
};
const LAYER_GROUPS = ['Index', 'Service line rates', 'Service line volume', 'Roof stock and age', 'Hazard', 'Storm record', 'Homes and owners', 'Language', 'Commercial stock', 'Competition'];
Object.assign(LAYERS, SLM.layers());
Z.forEach(z => { z.fees_pc = z.pop >= 200 ? z.fees / z.pop * 1000 : null; });
function layerOptions(keys, sel) { const groups = LAYER_GROUPS.filter(g => keys.some(k => (LAYERS[k] || {}).grp === g)); return groups.map(g => `<optgroup label="${g}">${keys.filter(k => (LAYERS[k] || {}).grp === g).map(k => `<option value="${k}" ${k === sel ? 'selected' : ''}>${esc((LAYERS[k] || {}).l || k)}</option>`).join('')}</optgroup>`).join(''); }
const GI_LAB = { H99: 'Hot spot, 99%', H95: 'Hot spot, 95%', H90: 'Hot spot, 90%', C99: 'Cold spot, 99%', C95: 'Cold spot, 95%', C90: 'Cold spot, 90%', ns: 'No cluster' };
const QN = ['Anchor', 'Whitespace', 'Niche', 'Avoid'];
function zipTip(z, lay) {
  const L = LAYERS[lay] || {}; const v = z[lay];
  return `<div class="tt">${esc(z.zip)} · ${esc(z.city)}</div><div class="ts">${esc(z.cty)} Parish · ${N(z.hu)} homes · ${N(z.pop)} residents</div>` +
    (lay !== 'idx' ? tipRow(esc((L.l || lay).replace(/\s*\(.*\)$/, '')), L.f ? L.f(v) : D(v, 1)) : '') +
    tipRow('Roof Demand Index', isN(z.idx) ? D(z.idx, 0) + 'th pct.' : 'not scored') + tipRow('Roofs 20+ years (model)', P(z.ra20_sh, 0)) + tipRow('Hail days a year (1 inch+, 25 mi)', D(z.hd1, 1)) + tipRow('Hurricane force chance a year', P(z.hur64, 1)) + tipRow('Gross profit pool a year', MM(z.fees)) + tipRow('Top line', esc(SLM.lineName(z.sl_top))) +
    `<div class="tf">Click for the full ledger</div>`;
}
function zbarH(lab, zv, txt) { const w = Math.min(47, Math.abs(zv) * 17), lft = zv >= 0 ? '50%' : (50 - w) + '%'; return `<div class="zbar"><div class="zl">${lab}</div><div class="zt"><div class="zm"></div><div class="zf" style="left:${lft};width:${w}%;background:${zv >= 0 ? cssv('--heat') : cssv('--cool')}"></div></div><div class="zv">${txt}</div></div>`; }
/* roof age histogram for a ZIP or a set of ZIPs (model), ages 0 to 39 and 40+ */
function ageHist(zips) { const a = Array(41).fill(0); zips.forEach(zz => { const r = DATA.agez[zz]; if (r) r.forEach((v, i) => a[i] += v); }); return a; }
function ageChart(host, a, H) { const cats = a.map((_, i) => i === 40 ? '40+' : String(i)); const R = ramp('green'); barChart(host, { cats, series: [{ name: 'One unit roofs', color: cssv('--accent'), values: a }], H: H || 170, L: 46, B: 30, maxLabels: 9, fmt: v => K(v), highlight: i => i >= 20 ? R[6] : i >= 15 ? R[4] : R[2], aria: 'Roof age distribution' }); }
/* ============================ Module 1: Roof Demand Index ============================ */
registerModule({
  key: 'index', num: '01', title: 'Roof Demand Index', desc: 'Where roofing jobs arise across eleven residential and commercial lines, ZIP by ZIP, for all 64 parishes',
  mount(root) {
    const st = { layer: 'idx', sel: null, par: '', reg: '', comp: false, roads: false };
    const W = META.model.W; const Wsum = sum(Object.values(W));
    const tops = ZR.slice().sort((a, b) => b.idx - a.idx); const most = tops[0];
    const V = META.model.val; const P0 = META.pools;
    root.innerHTML = mastHTML({ eyebrow: 'Module 01 · Roof Demand Index · Louisiana, 64 parishes', title: 'Roof Demand Index', dek: 'Every roofing job in Louisiana starts with one of three things: a roof that wore out, a storm that broke it, or a building that is new. This module estimates where those jobs arise for eleven residential and commercial service lines, from the age of every home, the hail, wind and hurricane record and FEMA\'s damage files, and resolves them to the ZIP codes where the roofs are. The map below is the master heatmap for ads and SEO; every other tab reads from it.',
      meta: [`<b>Coverage</b> ${N(META.nzip)} ZIPs · ${N(ZR.length)} scored · 64 parishes · ${K(META.hu)} homes`, `<b>Roof stock</b> ${K(META.roofs)} one unit roofs, ${K(META.ra20)} aged 20 years or more (model)`, '<b>Confidence</b> every layer graded A to D', '<b>Compiled</b> October 6, 2026'],
      bar: 'Roof Demand Index', barsub: 'Eleven service lines · scored ZIPs · works offline',
      actions: [{ id: 'i1Csv', label: '↓ ZIP CSV' }, { id: 'i1Cor', label: 'Storm Ledger ↗', title: 'Open the storm tracks and reports' }, { id: 'i1Stock', label: 'Roof Stock ↗', title: 'Roof age and materials for the selected ZIP' }, { id: 'i1Desk', label: 'Campaign Desk ↗', title: 'Send the top ZIPs in view to the Campaign Desk' }, { id: 'i1Forge', label: 'Site Forge ↗', title: 'Send the top cities in view to the Site Forge' }, { id: 'i1Lines', label: 'Service Lines ↗', title: 'Open the selected ZIP in the Service Lines ledger' }] }) +
      `<div class="wrap">
      ${callout('', 'Read this first: what the index is and is not', `This maps <b>where roofing jobs arise, not where they are sold</b>. No agency counts roof replacements by ZIP, and Louisiana only began requiring a permit for every reroof on August 1, 2025. What can be counted is everything around the roof: the homes and the decade each was built (Census), the hail, wind and tornado reports (NOAA, ${K(META.npts)} placed by coordinates since 2016), every hurricane track and wind radius since 1950 (NHC), FEMA's roof and wind damage registrations for every Louisiana disaster since 2004, the commercial buildings (Business Patterns) and new permits (Census). A roof renewal model ages every roof, calibrated to the American Housing Survey, and resets it whenever a storm replaced it. The replacement, repair, storm and new construction lines rest on observed data (grade B); hail and the commercial and specialty lines lean on stated assumptions (grades C and D) that you can change. A high index is a ZIP where more roofing jobs arise per resident; <b>module 05</b> turns that into reachable jobs against competition, <b>module 02</b> shows the storms, and <b>module 17</b> the roofs themselves.`)}
      <div class="kpis" id="i1Kpis"></div>
      <div class="controls">
        <div class="ctl" style="flex:1 1 320px"><label class="fl" for="i1Layer">Map layer</label><select id="i1Layer">${layerOptions(Object.keys(LAYERS), 'idx')}</select></div>
        <div class="ctl"><label class="fl" for="i1Reg">Region</label><select id="i1Reg"><option value="">All nine regions</option>${REG_KEYS.map(k => `<option value="${k}">${esc(REGN[k])}</option>`).join('')}</select></div>
        <div class="ctl"><label class="fl" for="i1Par">Parish</label><select id="i1Par"><option value="">All 64 parishes</option>${PA.slice().sort((a, b) => a.name.localeCompare(b.name)).map(p => `<option value="${p.fips}">${esc(p.name)}</option>`).join('')}</select></div>
        <div class="ctl"><label class="fl" for="i1Find">Find a ZIP or city</label><input type="search" id="i1Find" placeholder="70808 or Lafayette" autocomplete="off"></div>
        <label class="chk"><input type="checkbox" id="i1Comp"> Show the ${COMP.length} mapped roofers</label>
        <label class="chk"><input type="checkbox" id="i1Roads"> Storm tracks since 2002</label>
      </div>
      <div class="grid2">
        <div class="card mapcard"><div id="i1Map"></div><div class="legend" id="i1Leg"></div></div>
        <div class="stack">
          <div class="card"><div class="card-h" style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start"><div><h3 id="i1Name">All scored ZIPs</h3><p id="i1Sub">Click any ZIP on the map or a row in the ranking</p></div><span class="pill" id="i1Pill">State</span></div><div class="card-b" id="i1Detail"></div></div>
          <div class="card"><div class="card-h"><h3>Ranking: <span id="i1TblName"></span></h3><p>Click a row to select it. Click a header to sort.</p></div><div class="tscroll short" id="i1Tbl"></div></div>
        </div>
      </div>
      <div class="split">
        ${card('How the index is built', 'Eleven components, one per service line. Each weight is the line\'s share of the statewide gross profit pool at default assumptions times a confidence tier. Every number in the chain is shown.', '<div id="i1Method"></div>')}
        ${card('Is this one variable or eleven?', 'Pearson correlations between the standardized line rates across the scored ZIPs, with the weighted against equal weight sensitivity check.', '<div id="i1Cohere"></div>')}
      </div>
      ${card('Does the storm model point where roofs were actually damaged?', 'Two holdout tests against FEMA\'s verified wind damage from Laura, Delta, Zeta, Ida and Francine (2020 to 2024), per 1,000 occupied homes. None of those registrations were inputs to either prediction.', `<div class="split" style="margin-top:0"><div><div id="i1Sc1"></div><p class="chartnote" id="i1Sc1n"></p></div><div><div id="i1Sc2"></div><p class="chartnote" id="i1Sc2n"></p></div></div><div id="i1Val"></div>`, 'mt')}
      <div class="split">
        ${card('Caveats: the fine print', 'Eight things that would change a conclusion drawn from this map.', '<div id="i1Cav"></div>')}
        ${card('What this atlas cannot show', 'Documented gaps. Each says why, so the next request goes to the right custodian.', '<div id="i1Gap"></div>')}
      </div>
      ${card('Source register', 'Every layer traced to the dataset it came from, with the grade applied to that layer.', '<div id="i1Src"></div>', 'mt')}
      <div class="foot" id="i1Foot"></div></div>`;
    const fema20 = sum(Z.map(z => z.fema_20 || 0)), femaAll = sum(Z.map(z => z.fema_k || 0));
    $('#i1Kpis', root).innerHTML = kpiHTML([
      { l: 'One unit roofs', g: 'A', v: K(META.roofs), d: `plus ${K(META.mh)} mobile homes; median home built ${META.yb_med}` },
      { l: 'Roofs 20 years or older', g: 'B', v: K(META.ra20), d: `${P(META.ra20 / META.roofs * 100, 0)} of one unit roofs; ${K(META.wave)} more reach 20 within five years` },
      { l: 'Age driven replacements, next 12 months', g: 'B', v: K(META.nxt), d: `${P(META.nxt / META.roofs * 100, 1)} of roofs, before any storm` },
      { l: 'Storm and wind jobs a year', g: 'B', v: K(P0.storm), d: 'long run average, replacements and repairs' },
      { l: 'FEMA roof and wind registrations', g: 'A', v: K(femaAll), d: `2004 to 2026; ${K(fema20)} since 2020 (verified wind loss)` },
      { l: 'Gross profit pool a year', g: 'D', v: MM(META.fees_tot), d: 'all eleven lines at default assumptions' },
      { l: 'Most roofing demand', g: '', v: esc(most.zip), d: `${esc(most.city)} · ${esc(most.cty)} Parish` },
    ]);
    const map = new ZipMap($('#i1Map', root), { segHit: 'thin', roads: false, onSelect: z => select(z), onHover: (z, e) => { const r = ZI[z]; if (r) showTip(r.res_ok ? zipTip(r, st.layer) : zipTip(r, st.layer).replace('Click for the full ledger', 'Not scored: fewer than 500 residents'), e); }, onPin: id => goModule('field', { comp: +String(id).split(':')[0] }), onPinHover: (id, e) => { const [ci, oi] = String(id).split(':').map(Number); const c = COMP[ci]; const o = c.offices[oi] || {}; showTip(`<div class="tt">${esc(c.name)}</div><div class="ts">${esc(o.city || c.hq)} · ${esc(c.tier)}${c.verified ? ' · read on its own site' : ''}</div><div class="tf">Click to open in Competitive Field</div>`, e); }, onSegHover: (i, e) => { const s = SEGS[i]; showTip(`<div class="tt">${esc(s.r)}</div><div class="ts">${esc(String(s.t).slice(0, 10))} · ${esc(catLab(s.cat))}</div>${tipRow('Sustained wind on this leg', s.v + ' kt (' + ktMph(s.v) + ' mph)')}<div class="tf">Click for the Storm Ledger</div>`, e); }, onSeg: i => goModule('storms', { seg: i }) });
    const inScope = z => (!st.par || z.fips === st.par) && (!st.reg || PA[z.pi].reg === +st.reg);
    function render() {
      const L = LAYERS[st.layer]; const vals = ZR.map(z => z[st.layer]);
      const sc = st.layer === 'gi' ? divScale(vals, 0) : qScale(vals, L.ramp, L.dir);
      map.fill(zip => { const z = ZI[zip]; if (!z || !z.res_ok) return null; return sc.f(z[st.layer]); });
      const scope = (st.par || st.reg) ? new Set(Z.filter(inScope).map(z => z.zip)) : null; map.dim(scope);
      map.select(st.sel);
      map.showRoads(st.roads); map.roads(s => s.cat >= 3 ? { c: cssv('--track-h'), w: 2.4, z: 2 } : null);
      map.pins(st.comp ? COMP.flatMap((c, i) => c.offices.map((o, j) => ({ id: i + ':' + j, lat: o.lat, lon: o.lon, r: c.tier === 'statewide' ? 5.2 : c.tier === 'national' ? 4.6 : c.tier === 'regional' ? 3.8 : 3, fill: o.hq ? cssv('--ink') : cssv('--ink-2'), shape: o.hq ? 'diamond' : '', op: o.hq ? .95 : .7 }))) : []);
      const v = vals.filter(isN);
      $('#i1Leg', root).innerHTML = legendHTML({ title: L.l, R: sc.R, lo: L.f(st.layer === 'gi' ? sc.lo : Math.min(...v)), hi: L.f(st.layer === 'gi' ? sc.hi : Math.max(...v)), note: `<b>${st.layer === 'gi' ? 'Copper is a high demand cluster, blue a cold cluster' : 'Higher values shade darker'}.</b> ${st.layer === 'gi' ? 'Diverging scale centered on zero.' : 'Eight quantile classes across the scored ZIPs'}; gray means fewer than 500 residents. ${G(L.g)}<br>${esc(L.note)}` });
      drawTable(); drawDetail();
    }
    function drawTable() {
      const L = LAYERS[st.layer]; $('#i1TblName', root).textContent = L.l;
      const rows = ZR.filter(inScope);
      const k2 = st.layer === 'idx' ? 'fees' : st.layer; const L2 = LAYERS[k2];
      dataTable($('#i1Tbl', root), [
        { k: 'zip', h: 'ZIP', l: 1, f: v => `<b>${esc(v)}</b>` }, { k: 'city', h: 'City', l: 1 }, { k: 'idx', h: 'Index', f: v => D(v, 0) },
        { k: k2, h: st.layer === 'idx' ? 'Gross profit' : 'Value', f: v => L2.f(v) }, { k: 'hu', h: 'Homes', f: v => N(v) }
      ], rows, { sortKey: st.layer === 'idx' ? 'idx' : st.layer, id: r => r.zip, onClick: z => select(z), rowClass: r => r.zip === st.sel ? 'sel' : '' });
    }
    function drawDetail() {
      const z = st.sel ? ZI[st.sel] : null;
      if (!z || !z.res_ok) {
        const rows = ZR.filter(inScope); const nm = st.par ? PNAME(st.par) + ' Parish' : st.reg ? REGN[st.reg] : 'All scored ZIPs';
        $('#i1Name', root).textContent = nm; $('#i1Sub', root).textContent = 'Position in view · click any ZIP'; $('#i1Pill', root).textContent = st.par ? 'Parish' : st.reg ? 'Region' : 'State';
        const tot = k => sum(rows.map(r => r[k] || 0)); const pop = tot('pop'); const roofs = tot('roofs');
        $('#i1Detail', root).innerHTML = `<div class="rowl"><span>Homes · one unit roofs · ZIPs</span><b>${N(tot('hu'))} · ${N(roofs)} · ${N(rows.length)}</b></div>
          <div class="rowl"><span>Roofs 20+ years (model) · aging into 20 in five years</span><b>${N(tot('ra20'))} (${P(tot('ra20') / Math.max(1, roofs) * 100, 0)}) · ${N(tot('wave'))}</b></div>
          ${PL.map(l => `<div class="rowl"><span>${esc(l.name)}</span><b>${tot('p_' + l.key) < 10 ? D(tot('p_' + l.key), 1) : N(tot('p_' + l.key))} jobs a year · ${D(tot('p_' + l.key) / Math.max(1, pop) * 1e4, 1)} per 10k</b></div>`).join('')}
          <div class="rowl"><span>FEMA roof and wind registrations, 2004 to 2026</span><b>${N(tot('fema_k'))}</b></div>
          <div class="rowl"><span>Gross profit pool a year (default assumptions)</span><b>${MM(tot('fees'))}</b></div>
          <div class="dsec">Roof age, all one unit roofs in view (model)</div><div id="i1Age"></div>
          <p class="mini" style="margin-top:8px">Bars past 15 years shade darker, past 20 darkest. The spikes at 5 and 6 years are Hurricanes Ida (2021) and Laura, Delta and Zeta (2020); the spikes at 18 and 21 years are Gustav and Ike (2008) and Katrina and Rita (2005). Storms replace roofs in waves, and the waves come due together: the 2005 and 2008 roofs are entering the replacement window now, and the 2020 and 2021 roofs will follow in the late 2030s.</p>`;
        ageChart($('#i1Age', root), ageHist(rows.map(r => r.zip)));
        return;
      }
      const rank = tops.findIndex(r => r.zip === z.zip) + 1;
      $('#i1Name', root).textContent = `${z.zip} · ${z.city}`; $('#i1Sub', root).textContent = `${z.cty} Parish · ${REGN[PA[z.pi].reg]} · ${N(z.hu)} homes · ${N(z.pop)} residents`;
      $('#i1Pill', root).textContent = 'Paid: ' + (QN[z.quad] || '—');
      const notes = [];
      if (z.gicls && z.gicls[0] === 'H') notes.push(callout('note tight', GI_LAB[z.gicls], `This ZIP and its eight nearest neighbors form a statistically significant cluster of high roofing demand (Gi* z = ${D(z.gi, 2)}). Buy the cluster as a radius or a list, not the ZIP alone.`));
      if ((z.ra20_sh || 0) >= 22) notes.push(callout('judg tight', 'Roof debt', `${P(z.ra20_sh, 0)} of one unit roofs are modeled at 20 years or older (${N(z.ra20)} roofs). Age driven replacement and repair copy fits better here than storm copy, and insurers are re underwriting these roofs.`));
      if (isN(z.yrs64) && z.yrs64 <= 6) notes.push(callout('tight', 'Recent storm reset', `Hurricane force winds reached this ZIP ${z.yrs64} years ago (${z.last64}). Many roofs here are young, so age driven demand is muted until the early 2040s; repairs, gutters and FORTIFIED upgrades lead.`));
      if ((z.hd175 || 0) >= 1.0) notes.push(callout('tight', 'Hail exposure', `${D(z.hd175, 1)} days a year with golf ball hail within 25 miles (SPC 1996 to 2025). Keep a hail inspection campaign built and paused, ready for the day after a storm.`));
      if ((z.mh_sh || 0) >= 20) notes.push(callout('tight', 'Mobile home market', `${P(z.mh_sh, 0)} of homes are mobile homes. Roof over and coating offers outperform shingle replacement copy here.`));
      if ((z.span_sh || 0) >= 8) notes.push(callout('judg tight', 'Spanish build', `${P(z.span_sh, 0)} of residents speak Spanish at home (${P(z.span_lep_sh, 0)} with limited English). Run Spanish ad groups and a Spanish landing page with the same license and estimate statements.`));
      if ((z.viet_sh || 0) >= 3) notes.push(callout('judg tight', 'Vietnamese speakers', `${P(z.viet_sh, 1)} of residents speak Vietnamese at home. A Vietnamese speaking estimator and page outperform translation of English ads.`));
      $('#i1Detail', root).innerHTML = `<div class="big">${D(z.idx, 0)}<span style="font-size:13px;font-weight:500;color:var(--ink-3)">th percentile</span></div><div class="mini" style="margin-bottom:10px">Roof Demand Index · rank ${rank} of ${ZR.length} (1 = most roofing demand per resident)</div>
        ${PL.map(l => zbarH(`${l.short} ${D(z['r_' + l.key], 1)}/10k`, z['z_' + l.key] || 0, S(z['z_' + l.key], 1) + 'σ')).join('')}
        <p class="mini" style="margin:6px 0 10px">Bars are standard deviations of the log rate from the scored ZIP mean; right and copper means more than average.</p>
        <div class="dsec">Expected a year (model)</div>
        <div class="xscroll"><table class="keep"><thead><tr><th class="l">Line</th><th>Jobs</th><th>Open to marketing</th><th>Gross profit</th></tr></thead><tbody>${PL.map(l => { const o = SLM.zipLine(z, l.key); return `<tr><td class="l">${esc(l.name)} ${G(l.g)}</td><td>${D(o.pool, o.pool < 10 ? 1 : 0)}</td><td>${D(o.cases, 1)}</td><td>${MM(o.fees)}</td></tr>`; }).join('')}</tbody></table></div>
        <div class="dsec">Roofs (ACS, renewal model)</div>
        <div class="rowl"><span>One unit roofs · mobile homes · 5+ unit homes</span><b>${N(z.roofs)} · ${N(z.mh)} · ${N(z.mf5u)}</b></div>
        <div class="rowl"><span>Median roof age · median year built</span><b>${isN(z.ra_med) ? z.ra_med + ' years' : '—'} · ${isN(z.yb_med) ? z.yb_med : '—'}</b></div>
        <div class="rowl"><span>Roofs 20+ · aging into 20 within five years</span><b>${N(z.ra20)} (${P(z.ra20_sh, 0)}) · ${N(z.wave)}</b></div>
        <div class="rowl"><span>Last hurricane force winds</span><b>${z.last64 ? z.last64 + ' (' + z.yrs64 + ' years ago)' : 'none modeled since 1950'}</b></div>
        <div id="i1Age"></div>
        <div class="dsec">Hazard and record</div>
        <div class="rowl"><span>Hail days a year, 1 inch+ · 1.75 inch+ (25 mi)</span><b>${D(z.hd1, 2)} · ${D(z.hd175, 2)}</b></div>
        <div class="rowl"><span>Damaging wind days · EF1+ tornado days a year</span><b>${D(z.wd50, 1)} · ${D(z.td1, 2)}</b></div>
        <div class="rowl"><span>Chance of hurricane force winds a year · storms since 2000</span><b>${P(z.hur64, 1)} · ${N(z.n64_00)}</b></div>
        <div class="rowl"><span>Peak modeled wind since 2020</span><b>${z.vmax_20 ? z.vmax_20 + ' kt (' + ktMph(z.vmax_20) + ' mph)' : 'below 34 kt'}</b></div>
        <div class="rowl"><span>Reports 2016 to 2026: hail 1 inch+ · wind 58 mph+ · tornado</span><b>${N(z.ev_h1)} · ${N(z.ev_w58)} · ${N(z.ev_t)}</b></div>
        <div class="rowl"><span>FEMA roof and wind registrations · per 100 homes</span><b>${N(z.fema_k)} · ${isN(z.fema_rate) ? D(z.fema_rate, 1) : '—'}</b></div>
        <div class="dsec">Owners and buildings (ACS, ZBP)</div>
        <div class="rowl"><span>Owners · with a mortgage</span><b>${P(z.own_sh, 0)} · ${P(z.mort_sh, 0)}</b></div>
        <div class="rowl"><span>Median value · median income</span><b>${M$(z.value)} · ${M$(z.inc)}</b></div>
        <div class="rowl"><span>Spanish · Vietnamese · French at home</span><b>${P(z.span_sh, 0)} · ${P(z.viet_sh, 1)} · ${P(z.french_sh, 1)}</b></div>
        <div class="rowl"><span>Commercial roofs (est.) · warehouses · churches</span><b>${D(z.cru, 0)} · ${N(z.whse)} · ${N(z.church)}</b></div>
        <div class="rowl"><span>Mapped roofers within 25 km · pressure</span><b>${N(z.comp_n25)} · ${D(z.comp_pct, 0)}th pct.</b></div>
        ${notes.join('')}`;
      ageChart($('#i1Age', root), DATA.agez[z.zip] || [], 140);
    }
    function select(zip) { if (st.sel !== zip && !(ZI[zip] && ZI[zip].res_ok)) return; st.sel = st.sel === zip ? null : zip; render(); }
    // method
    const lab = {}; PL.forEach(l => lab[l.key] = l.short);
    const fsum = sum(PL.map(x => META.model.W[x.key] / META.model.TIER[x.key]));
    $('#i1Method', root).innerHTML = `<p class="body">For each line the expected jobs per 10,000 residents are shrunk toward the parish rate for small ZIPs (an empirical Bayes prior worth 2,500 residents), log transformed, standardized across the ${N(ZR.length)} scored ZIPs (a z score), multiplied by the weight, summed and turned into a percentile. <b>Weight</b> is the line's share of the statewide gross profit pool at default assumptions times a <b>tier</b>: 1.0 where the line rests on observed counts (grades A and B), 0.75 for graded models (C), 0.5 for lines anchored on an assumption (D). Money stands in for importance because a roofer's choice between lines is a choice between job values; that substitution is the largest judgment call in the build.</p>
      <div class="xscroll"><table style="margin-top:10px"><thead><tr><th class="l">Line</th><th>Profit share</th><th>Tier</th><th>Weight</th></tr></thead><tbody>${PL.map(l => { const fs = META.model.W[l.key] / META.model.TIER[l.key]; return `<tr><td class="l wrap" style="min-width:220px"><b>${esc(l.name)}</b><div class="mini" style="margin-top:2px">${esc(l.unit)}</div></td><td>${P(fs / fsum * 100, 1)}</td><td>${D(META.model.TIER[l.key], 2)} ${G(l.g)}</td><td><b>${D(W[l.key], 3)}</b></td></tr>`; }).join('')}<tr><td class="l" colspan="3" style="text-align:right">Total weight</td><td><b>${D(Wsum, 3)}</b></td></tr></tbody></table></div>
      ${callout('judg tight', 'Judgment call: wear and storms are separate lines', 'A roof replaced because it wore out (retail, financing, price shopping) and one replaced after a storm (insurance, urgency, trust) are different sales. The renewal model splits them: age driven replacements go to the replacement line, storm driven ones to the storm and hail lines, and a storm that replaces a roof resets its clock, which is why Lake Charles, after Laura, shows young roofs and low age driven demand.')}
      ${callout('judg tight', 'Judgment call: no double counting', 'Metal reroofs and FORTIFIED reroofs are carved out of the replacement, storm and hail lines, mobile homes are only in their own line, and five unit buildings sit in the multifamily line. Repairs count leaks fixed by a paid roofer, not every leak.')}`;
    $('#i1Cohere', root).innerHTML = corrMatrix(LINE_KEYS, lab, META.model.corr) + `<p class="body" style="margin-top:12px"><b>They are not one variable.</b> The residential lines that follow the roof stock move together (replacement and repair r = ${DS(META.model.corr.replace.repair, 2)}), the storm line follows the coast and the hurricane record (storm and replacement r = ${DS(META.model.corr.storm.replace, 2)}), hail follows the north and the SPC record (hail and storm r = ${DS(META.model.corr.hail.storm, 2)}), and the commercial lines follow business districts. Weighted and equal weight versions correlate r = ${DS(META.model.sens[0], 3)} (Spearman ${D(META.model.sens[1], 3)}). Pick the line, not the index, when you buy for one service.</p>`;
    // validation
    const VP = META.model.valpts.map(r => ({ zip: r[0], clim: r[1], wind: r[2], obs: r[3] }));
    const mk = (host, note, xf, xl, txt) => { const pts = VP.map(v => ({ x: xf(v), y: Math.log10(1 + v.obs), lab: v.zip, tip: `<div class="tt">${v.zip} · ${esc((ZI[v.zip] || {}).city || '')}</div>${tipRow(xl, D(xf(v), 2))}${tipRow('FEMA 2020 to 2024 per 1,000 homes', D(v.obs, 1))}` })); const r = scatter($(host, root), { pts, x: { label: xl, fmt: v => D(v, 1) }, y: { label: 'FEMA verified wind damage per 1,000 homes (log10 of 1 + rate)', fmt: v => D(v, 1) }, H: 320 }); $(note, root).innerHTML = txt(r); };
    mk('#i1Sc1', '#i1Sc1n', v => v.clim, 'Storm climatology 1950 to 2019, roofs needing work per 1,000 a year', r => `<b>Climate</b>: Spearman ρ = ${D(V.rho_clim, 2)} across ${N(V.n)} ZIPs with 1,000 homes or more (p ${V.p_clim < 0.001 ? '< 0.001' : '= ' + D(V.p_clim, 3)}).`);
    mk('#i1Sc2', '#i1Sc2n', v => Math.log10(1 + v.wind), 'Modeled replacements from the 2020 to 2024 footprints (log10 of 1 + per 1,000)', r => `<b>Footprint</b>: Spearman ρ = ${D(V.rho_wind, 2)} (p ${V.p_wind < 0.001 ? '< 0.001' : '= ' + D(V.p_wind, 3)}).`);
    $('#i1Val', root).innerHTML = callout('judg', 'Judgment call: both checks pass, and they mean different things', `The first test asks whether 70 years of hurricane history, frozen at 2019, says where the next storms would damage roofs. It does (ρ = ${D(V.rho_clim, 2)}): Louisiana's exposure is persistent, which is what lets a long run storm line guide a standing budget. The second asks whether the wind footprint of each 2020 to 2024 storm, run through a damage curve fit only on Katrina, Rita, Gustav, Ike and Isaac, finds the damage FEMA verified later (ρ = ${D(V.rho_wind, 2)}): the wind model and its damage curve travel across storms. FEMA counts only people who applied for federal help, so these are tests of where, not of how many; the absolute storm volume rests on the two roofs per registration multiplier (grade D).`);
    $('#i1Cav', root).innerHTML = proseTable([
      ['Jobs, not sales', 'Every layer describes roofs, storms and buildings, not signed contracts. No agency counts roof replacements by place, though the 2025 permit mandate will change that at the parish level.'],
      ['Ecological reading only', 'A high ZIP contains new roofs and careful owners; nothing here describes a household.'],
      ['ACS is a survey', 'ZIP estimates carry margins of error, largest in small rural ZIPs; the index shrinks small ZIP rates toward the parish rate for that reason.'],
      ['The roof life is calibrated, not observed', 'The 22 year Weibull life fits the South\'s 2023 American Housing Survey rates by year built (within 0.3 points a year); Louisiana specific roof ages are not published.'],
      ['Storm damage leans on FEMA', `FEMA counts only people who applied for federal help (${inTen(FEMA_INS.sh)} reported homeowners insurance); damage that never registered is covered by a multiplier (two roofs per registration before 2020, 3.6 since, grade D).`],
      ['Hail reports follow people', 'SPC hail reports cluster along highways and in towns, so rural hail is undercounted and the hail line runs low in empty places.'],
      ['Default job values are placeholders', 'The gross profit pool multiplies jobs by default values (replacement $15,500, commercial $85,000 and so on) and a 33 percent margin. Replace them with your closed job history in module 12.'],
      ['Research material', 'Not legal or insurance advice. Verify statutes and program rules against the primary source before relying on them.'],
    ]);
    $('#i1Gap', root).innerHTML = proseTable([
      ['Roof permits by ZIP', 'Act 239 of 2025 requires a permit for every reroof from August 1, 2025, but parishes and cities keep permits in separate systems and few publish them; New Orleans publishes building permits that capture only a fraction of roof work.', 'C'],
      ['Insurance claims by ZIP', 'The Department of Insurance collects claim counts after declared catastrophes by parish, not ZIP, and not in a usable public file; FEMA stands in.', 'C'],
      ['Search volume and CPC by ZIP', 'No keyword or Ahrefs data was pulled for this build. Cost per click is modeled from region and competition (grade D) until account actuals arrive in module 15.', 'D'],
      ['Roof material by home', 'No public source records roof covering by parcel; material mix is modeled from building type, age and region (module 17).', 'D'],
      ['Commercial roof age and size', 'Assessor files that carry building area and year are not published statewide; the commercial lines run on establishment counts and a national building count.', 'D'],
      ['Licensed roofers by parish, officially', 'The LSLBC search is per contractor; the roster used here is a third party mirror of it by mailing city.', 'C'],
    ].map(r => [r[0], r[1], G(r[2])]));
    $('#i1Src', root).innerHTML = srcRows([
      ['Homes by year built, structure and tenure', 'U.S. Census Bureau, ACS 2020 to 2024 five year, table based summary file (B01003, B19001, B19013, B25001 to B25004, B25018, B25024, B25034, B25035, B25036, B25077, B25081, B25127, C16001)', 'A', 'Jan 2026', 'https://www2.census.gov/programs-surveys/acs/summary_file/2024/table-based-SF/'],
      ['Roofing projects, leaks and costs by year built', 'U.S. Census Bureau and HUD, American Housing Survey 2023 national public use file (projects, roof leaks, missing shingles)', 'A', 'Sep 2024', 'https://www2.census.gov/programs-surveys/ahs/2023/'],
      ['Hail, wind and tornado reports', 'NOAA SPC severe weather database 1996 to 2025; NOAA NCEI Storm Events Database 2016 to 2026 (Louisiana, located reports)', 'A', 'Sep 2026', 'https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/'],
      ['Hurricane tracks and wind radii', 'NHC HURDAT2 Atlantic best tracks 1851 to 2025 (September 23, 2026 release) and NHC operational best tracks for 2026 (Arthur, Bertha, Edouard)', 'A', 'Sep 2026', 'https://www.nhc.noaa.gov/data/hurdat/'],
      ['Roof and wind damage', 'FEMA OpenFEMA: Individuals and Households Program valid registrations (roof damage flag 2004 to 2017; verified real property loss without flood 2020 on), Housing Assistance Program owners, disaster declarations', 'A', 'Oct 2026', 'https://www.fema.gov/about/openfema/data-sets'],
      ['Commercial buildings and roofers', 'County and ZIP Code Business Patterns 2023 (238160 roofing contractors, 423330 roofing supply, retail, warehousing, manufacturing, churches, apartments); Nonemployer Statistics 2024', 'B', '2023 to 2024', 'https://www2.census.gov/programs-surveys/cbp/datasets/2023/'],
      ['New construction', 'Census Building Permits Survey, county annual 2005 to 2025 and 2026 year to date through August', 'A', 'Sep 2026', 'https://www2.census.gov/econ/bps/County/'],
      ['Material prices', 'BLS producer price indexes via FRED: prepared asphalt and tar roofing and siding products (WPU1361); steel mill products (WPU1017)', 'B', 'Aug 2026', 'https://fred.stlouisfed.org/series/WPU1361'],
      ['Licensing, permits and claims law', 'Acts 239 and 422 of 2025, Act 757 of 2026 (LSLBC notice of July 13, 2026); Act 144 of 2025; Act 734 of 2022; Act 3 of 2024; Act 533 of 2024', 'A', 'Oct 2026', 'https://legis.la.gov/'],
      ['Roofers', `${COMP.length} Louisiana roofing companies; ${META.ncomp_ver} read on their own websites October 6, 2026; LSLBC roofing license roster mirror (${N(META.lic.n)} records)`, 'C', 'Oct 2026', ''],
    ]);
    $('#i1Foot', root).innerHTML = `<b style="color:var(--ink)">Uplift Louisiana Roofing Atlas</b>, module 01. Compiled October 6, 2026 for ${N(META.nzip)} ZIP codes in all 64 parishes. The index is a percentile of expected roofing jobs per resident, not a count of sales. Grades: A primary and direct; B primary with a caveat or a model on primary data; C secondary, volatile or proxy; D assumption or over ten years old. Built from public data only; no keyword or Ahrefs data was pulled for this build.`;
    // wiring
    $('#i1Layer', root).onchange = e => { st.layer = e.target.value; render(); };
    $('#i1Reg', root).onchange = e => { st.reg = e.target.value; st.par = ''; $('#i1Par', root).value = ''; if (st.sel && !inScope(ZI[st.sel])) st.sel = null; if (st.reg) map.fitParishes(PA.filter(p => p.reg === +st.reg).map(p => p.fips)); else map.reset(); render(); };
    $('#i1Par', root).onchange = e => { st.par = e.target.value; if (st.par && st.reg && PAI[st.par] && PAI[st.par].reg !== +st.reg) { st.reg = ''; $('#i1Reg', root).value = ''; } if (st.sel && !inScope(ZI[st.sel])) st.sel = null; if (st.par) map.fitParishes([st.par]); else map.reset(); render(); };
    $('#i1Comp', root).onchange = e => { st.comp = e.target.checked; render(); };
    $('#i1Roads', root).onchange = e => { st.roads = e.target.checked; render(); };
    $('#i1Find', root).addEventListener('change', e => { const q = e.target.value.trim().toLowerCase(); if (!q) return; const hit = ZI[q] || ZR.filter(z => (z.city || '').toLowerCase().startsWith(q)).sort((a, b) => b.pop - a.pop)[0]; if (hit) { st.sel = hit.res_ok ? hit.zip : null; map.fitTo([hit.zip]); render(); if (!hit.res_ok) toast(`${hit.zip} has fewer than 500 residents, so the atlas does not score it`); } else toast('No ZIP or city matches'); });
    $('#i1Csv', root).onclick = () => { const keys = ['zip', 'city', 'cty', 'pop', 'hu', 'idx', 'idx_eq', 'gi', 'gicls', 'fees', 'cases'].concat(LINE_KEYS.flatMap(k => ['p_' + k, 'r_' + k])).concat(['roofs', 'ra_med', 'ra20', 'ra20_sh', 'wave', 'nxt', 'last64', 'hd1', 'hd175', 'wd50', 'td1', 'hur64', 'n64_00', 'ev_h1', 'ev_w58', 'fema_k', 'own_sh', 'mort_sh', 'value', 'inc', 'mh_sh', 'span_sh', 'viet_sh', 'cru', 'roofers', 'lic', 'comp_pct', 'tier', 'bid']);
      saveFile('louisiana-roof-demand-index-by-zip.csv', toCSV(keys.map(k => ({ cases: 'jobs_open_to_marketing', fees: 'gross_profit_pool' })[k] || k), ZR.map(z => keys.map(k => z[k])), 'Uplift Louisiana Roofing Atlas, module 01, compiled 2026-10-06.\np_ = expected jobs a year; r_ = per 10,000 residents (shrunk toward the parish rate); gross_profit_pool = jobs_open_to_marketing at default job values times a 33 percent margin.\nidx = percentile of weighted z scores of log rates; gi = Getis Ord Gi* z on the index.')); };
    $('#i1Cor', root).onclick = () => goModule('storms', st.sel ? { zip: st.sel } : {});
    $('#i1Stock', root).onclick = () => goModule('stock', st.sel ? { zip: st.sel } : {});
    const topZ = () => ZR.filter(inScope).sort((a, b) => b.idx - a.idx).slice(0, 25).map(z => z.zip);
    $('#i1Desk', root).onclick = () => goModule('desk', { zips: st.sel ? [st.sel] : topZ() });
    $('#i1Forge', root).onclick = () => goModule('forge', { zips: st.sel ? [st.sel] : topZ() });
    $('#i1Lines', root).onclick = () => goModule('lines', st.sel ? { zip: st.sel } : {});
    BUS.on('theme', () => render()); BUS.on('slm', () => render());
    this.receive = p => { if (p && p.zip && ZI[p.zip]) { st.sel = ZI[p.zip].res_ok ? p.zip : null; map.fitTo([p.zip]); render(); } };
    render();
  }
});
