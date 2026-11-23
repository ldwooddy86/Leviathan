/* ==== 15_m03_law.js ==== */
/* ==== m03 Code, License and Claims ==== */
"use strict";
/* [iso date or null, date label when there is no single day, title, what it does, register id] */
const LAW_TIMELINE = [
  ['1989-08-25', null, 'Los Angeles restricts wood roofs', 'City of Los Angeles Ordinance 165047 restricts wood shake and shingle roofs for new construction and for replacement over 10 percent of the roof, treated or not. Today the city prohibits all wood roofing.', 'shake'],
  ['2005-12-01', null, 'Fire zone roofing and vent rules begin', 'The roofing and attic vent requirements of the wildfire building standards take effect; the full Chapter 7A applies to permits applied for on or after July 1, 2008 (January 1, 2008 in State Responsibility Areas).', 'wuidetail'],
  ['2013-01-01', null, 'Roofers lose the workers\' compensation exemption', 'AB 2219: a C-39 licensee must keep a workers\' compensation certificate on file even with no employees, or the C-39 class is removed from the license.', 'wc'],
  [null, '2018 session', 'One year moratorium on non-renewal after a wildfire', 'SB 824 of 2018: for one year after a declared state of emergency, insurers may not cancel or refuse to renew home policies in ZIP Codes within or next to the fire perimeter only because of the wildfire. SB 894 added two renewals after a total loss.', 'nonrenew'],
  ['2020-01-01', null, 'Solar on every new home', 'The 2019 Energy Code requires a photovoltaic system on every new single family home.', 'solarnew'],
  ['2021-01-01', null, 'Five days to cancel for seniors; felony for unlicensed disaster work', 'SB 1474: the right to cancel a home improvement contract becomes five business days for a senior citizen, for contracts from this date. SB 1189: unlicensed contracting on disaster damage may be charged as a felony.', 'cancel'],
  ['2022-10-14', null, 'Safer from Wildfires', 'Cal. Code Regs. tit. 10, 2644.9: insurers that price on wildfire risk must reflect a Class A roof and eleven other mitigation items in the rate. No percentage is set.', 'sfw'],
  ['2023-01-01', null, 'Contractor bond rises to $25,000', 'SB 607: the contractor\'s bond becomes $25,000. The 2022 edition of Title 24 takes effect the same day.', 'bond'],
  ['2023-04-15', null, 'Net billing replaces net metering', 'CPUC Decision 22-12-056: the Net Billing Tariff applies to customers who apply to interconnect solar on or after this date.', 'solarnew'],
  ['2025-01-01', null, 'License line moves from $500 to $1,000', 'AB 2622: the minor work exemption rises to $1,000, but only where the work needs no permit and the person employs no one. Cal/OSHA\'s lower lead exposure limits also start.', 'c39'],
  ['2025-01-07', null, 'State of emergency: Palisades and Eaton fires', 'The declaration starts the one year non-renewal moratorium, the 180 day price cap on repairs, the seven day right to cancel on repair contracts and the 36 month replacement cost window for the fire areas.', 'nonrenew'],
  ['2025-07-01', null, 'Fall protection at 6 feet', 'Title 8, section 1731 as amended: residential roofing and reroofing, tear off included, needs fall protection where the fall distance is 6 feet or more (it was 15 feet), and at any height on slopes steeper than 7:12.', 'fall'],
  ['2025-10-01', null, 'Residential building standards frozen', 'AB 130 (effective June 30, 2025): no new state or local residential building standards from this date to June 1, 2031, except emergency standards and home hardening.', 'codecycle'],
  ['2025-10-13', null, 'Zone Zero statute amended', 'AB 1455 amends Public Resources Code 4291: the ember resistant zone within 5 feet takes effect for new structures when the Board of Forestry updates its regulations, and for existing structures three years later.', 'zone0'],
  ['2026-01-01', null, '2025 Title 24 in force: fire rules move to their own code', 'The 2025 codes apply. The wildfire rules leave Chapter 7A for the new Wildland-Urban Interface Code, where replacing 50 percent or more of a roof in 12 months triggers the new roof rules. The cool roof values are unchanged.', 'classa'],
  ['2026-01-01', null, 'Cancel by email; name the subcontractors; higher workers\' compensation penalties', 'AB 1327: contracts carry an email address for cancellation. SB 517: subcontractors are disclosed on request. SB 291: minimum penalties of $10,000 and $20,000 for employing workers without coverage. AB 888 creates the Safe Homes grant program.', 'emailcancel'],
  ['2026-07-01', null, 'Higher minimum CSLB penalties; policy forms follow the new proof of loss rules', 'SB 779, by the CSLB bulletin: fines for unlicensed activity start at $1,500. Insurance Code 2051.5: all policy forms issued or renewed must comply with the section in full.', 'unlic'],
  ['2026-08-19', null, 'Board of Forestry approves Zone Zero', 'The Board approves the final draft of the Zone 0 defensible space regulations. As of November 19, 2026 no source confirmed approval by the Office of Administrative Law or an effective date.', 'zone0'],
  ['2028-01-01', null, 'Due: workers\' compensation for every licensee', 'The current Business and Professions Code 7125 sunsets on this date, when the rule roofers already live under is due to reach all contractors.', 'wc'],
  ['2031-06-01', null, 'Due: the residential code freeze ends', 'The moratorium on new residential building standards under AB 130 ends.', 'codecycle'],
];
/* what the evidence could not support: shown in the module so no one builds on it */
const LAW_GAPS = [
  ['Zone Zero', 'No confirmation of Office of Administrative Law approval, an effective date or the final rule text.'],
  ['Statute text', 'The Legislature\'s own site refused automated reading. Statutes were read as dated archive captures or on california.public.law, and Title 24 on UpCodes; a section may have been amended since its capture.'],
  ['Business days and senior citizens', 'The Civil Code definition of a business day and the age that makes a buyer a senior citizen for the five day right to cancel were not read. The contract screen counts days the way the federal rule does.'],
  ['Claims', 'No statute or agency notice read says how far a roofer may go when meeting an adjuster; no assignment of benefits statute for roofing was found; People v. Montgomery-Sansome is one trial court decision and an appeal was not checked.'],
  ['Insurance discounts', 'Class A roof discount percentages by insurer, and the FAIR Plan\'s figure for the roof alone, are not published in the documents opened. Moratorium ZIP Code lists could not be downloaded.'],
  ['Permits', 'Reroof permit rules were read as written rules only for the City of San Diego and Los Angeles County. Los Angeles and San Francisco are known from their permit data; San Jose and Sacramento were not opened.'],
  ['Fire maps and shake bans', 'The 2025 Fire Hazard Severity Zone maps were seen only in search summaries of city pages. Only Los Angeles and San Diego wood roof rules were confirmed from current documents.'],
  ['Solar', 'Whether a detach and reset changes an older net metering status; the CSLB\'s own statement on which license reinstalls panels (read only as Los Angeles County describes it).'],
  ['Advertising law', 'California\'s general unfair competition and false advertising statutes, any rule on advertising the contractor bond, state telephone solicitation rules and privacy statutes were not read.'],
  ['Hazardous materials', 'The federal lead renovation rule, the federal asbestos demolition rule and air district asbestos notification rules were not opened.'],
  ['Grants and rebates', 'Safe Homes grant amounts and whether applications opened; Wildfire Mitigation Program amounts; PACE; utility rebates other than the Los Angeles Department of Water and Power.'],
  ['Prices', 'No audited price series. San Francisco figures are applicant declared permit costs; Los Angeles valuations are nominal and are not shown as prices. The calculators\' default prices are examples, not market figures.'],
];
/* cool roof minimums for reroofs (2022 and 2025 Energy Code, identical values): building -> slope -> [{z: climate zones, sr, te, sri, sec}] */
const zr = (a, b) => { const o = []; for (let i = a; i <= b; i++) o.push(i); return o; };
const COOLROOF = {
  sf: { label: 'Single family', trig: 'more than 50 percent of the roof', sec: '150.2(b)1I',
    steep: [{ z: [4].concat(zr(8, 15)), sr: 0.20, te: 0.75, sri: 16, sec: '150.2(b)1Ii' }],
    low: [{ z: [4].concat(zr(6, 15)), sr: 0.63, te: 0.75, sri: 75, sec: '150.2(b)1Iiia' }] },
  mf: { label: 'Multifamily', trig: 'more than 50 percent of the roof area or more than 2,000 square feet, whichever is less', sec: '180.2(b)1A',
    steep: [{ z: [4].concat(zr(8, 15)), sr: 0.20, te: 0.75, sri: 16, sec: '180.2(b)1Aii' }],
    low: [{ z: [2, 4].concat(zr(6, 15)), sr: 0.63, te: 0.75, sri: 75, sec: '180.2(b)1Ai' }] },
  nr: { label: 'Nonresidential', trig: 'more than 50 percent of the roof area or more than 2,000 square feet, whichever is less', sec: '141.0(b)2B',
    steep: [{ z: [1, 3], sr: 0.20, te: 0.75, sri: 16, sec: '140.3(a)1Aib1' }, { z: [2].concat(zr(4, 16)), sr: 0.25, te: 0.80, sri: 23, sec: '140.3(a)1Aib2' }],
    low: [{ z: zr(1, 16), sr: 0.63, te: 0.75, sri: 75, sec: '140.3(a)1Aia' }] },
  hm: { label: 'Hotel and motel guest rooms', trig: 'more than 50 percent of the roof area or more than 2,000 square feet, whichever is less', sec: '141.0(b)2B',
    steep: [{ z: zr(2, 15), sr: 0.20, te: 0.75, sri: 16, sec: '140.3(a)1Aiib' }],
    low: [{ z: [9, 10, 11, 13, 14, 15], sr: 0.55, te: 0.75, sri: 64, sec: '140.3(a)1Aiia' }] },
};
const addYears = (d, n) => { const x = new Date(d.getTime()); x.setUTCFullYear(x.getUTCFullYear() + n); return x; };
const addMonths = (d, n) => { const x = new Date(d.getTime()); x.setUTCMonth(x.getUTCMonth() + n); return x; };
const addDays = (d, n) => new Date(d.getTime() + n * 864e5);
const fmtDate = d => d ? d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }) : '—';
const parseD = v => { if (!v) return null; const d = new Date(v + 'T00:00:00Z'); return isNaN(d) ? null : d; };
/* the business holidays named in the FTC Cooling Off Rule (16 CFR 429.0): New Year's, Washington's Birthday, Memorial, Independence, Labor, Columbus, Veterans, Thanksgiving, Christmas */
function ftcHolidays(y) {
  const nth = (m, wd, n) => { const d = new Date(Date.UTC(y, m, 1)); const off = (wd - d.getUTCDay() + 7) % 7; return Date.UTC(y, m, 1 + off + 7 * (n - 1)); };
  const last = (m, wd) => { const d = new Date(Date.UTC(y, m + 1, 0)); const off = (d.getUTCDay() - wd + 7) % 7; return Date.UTC(y, m + 1, 0 - off); };
  return new Set([Date.UTC(y, 0, 1), nth(1, 1, 3), last(4, 1), Date.UTC(y, 6, 4), nth(8, 1, 1), nth(9, 1, 2), Date.UTC(y, 10, 11), nth(10, 4, 4), Date.UTC(y, 11, 25)]);
}
/* midnight of the nth business day after d, counting as the federal rule counts (every day but Sundays and the listed holidays).
   California's own definition of a business day was not read for this build, so the date is a screen. n: 3 ordinary buyer, 5 senior citizen, 7 disaster repair. */
function cancelBy(d, days) { const need = days || 3; let x = new Date(d.getTime()), n = 0; while (n < need) { x = addDays(x, 1); if (x.getUTCDay() === 0 || ftcHolidays(x.getUTCFullYear()).has(x.getTime())) continue; n++; } return x; }
/* the largest lawful down payment on a home improvement contract (Bus. & Prof. Code 7159.5) */
const downCap = price => Math.max(0, Math.min(1000, 0.10 * (+price || 0)));
/* cool roof rule for one reroof: {trig, rows[], exempt[], ins} */
function coolRule(b, slope, zone, area, repl, opt) {
  opt = opt || {}; const C = COOLROOF[b] || COOLROOF.sf; const share = area > 0 ? repl / area : 0;
  const trig = b === 'sf' ? share > 0.5 : (share > 0.5 || repl > 2000);
  const row = (C[slope] || []).find(r => r.z.includes(zone)) || null;
  const exempt = [];
  if (opt.heavy) exempt.push('the roof construction weighs at least 25 pounds per square foot');
  if (opt.bipv) exempt.push('the area under building integrated solar is exempt');
  if (b === 'sf' && slope === 'steep') {
    if (opt.x === 'r38') exempt.push('the attic is insulated to R-38 or the ceiling U-factor is 0.025 or lower');
    if (opt.x === 'rb') exempt.push('a radiant barrier is in the attic, not directly above spaced sheathing');
    if (opt.x === 'r2') exempt.push('R-2 or more continuous insulation sits above or below the deck');
    if (opt.x === 'noduct' && [2, 4, 9, 10, 12, 14].includes(zone)) exempt.push('there are no ducts in the attic (climate zones 2, 4, 9, 10, 12 and 14 only)');
  }
  let ins = '';
  if (slope === 'low') {
    if (b === 'sf' || b === 'mf') ins = [1, 2, 4].concat(zr(8, 16)).includes(zone) ? 'R-14 continuous insulation or a roof assembly U-factor of 0.039 for the replaced or recovered area' + (b === 'mf' ? ' (a recoat is exempt)' : '') : 'no added insulation in this climate zone';
    else if (b === 'nr') ins = (zone >= 6 && zone <= 8 ? 'R-17 continuous (U-0.047)' : 'R-23 continuous (U-0.037)') + ' with at least R-10 above the deck; a recover with new R-10 above the deck and a recoat are exempt (2025 text)';
    else ins = 'the insulation rule for guest room roofs was not read for this build';
  }
  return { share, trig, row, exempt, ins, C };
}
/* ============================ Module 3: Code, License and Claims ============================ */
registerModule({
  key: 'law', num: '03', title: 'Code, License and Claims', desc: 'The C-39 license at $1,000, the home improvement contract, down payment and cancellation rules, claims and deductibles, price gouging, Class A roofs in fire zones, cool roofs and the insurer clock, with screening calculators',
  mount(root) {
    const st = { line: '' };
    const nA = LAWX.items.filter(x => x.g === 'A').length, nB = LAWX.items.filter(x => x.g === 'B').length;
    root.innerHTML = mastHTML({ eyebrow: 'Module 03 · Code, License and Claims · as read November 19, 2026', title: 'Code, License and Claims',
      dek: 'More law touches a California roofer than a roofer almost anywhere else. The license line is $1,000 and the license number goes on every ad. A residential job over $500 needs the state\'s written contract, a down payment capped at $1,000 or 10 percent, and a right to cancel of three, five or seven business days. Roofers alone must carry workers\' compensation with no employees. After a declared disaster prices are capped for 180 days and unlicensed work can be a felony. In a fire zone, replacing half a roof brings the Class A new roof rules; across most of the state, replacing more than half brings the cool roof rules. Insurers work to a 15, 40 and 30 day clock and must weigh a Class A roof in the rate, at no set percentage. Each item below carries its citation, its source and a grade, and the calculators turn the rules into answers for one job.',
      meta: [`<b>Register</b> ${N(LAWX.items.length)} items: ${N(nA)} grade A, ${N(nB)} grade B`, '<b>Sources</b> statutes by archive capture and california.public.law; Title 10 and Title 8 regulations; Title 24; CSLB; Department of Insurance; eCFR', '<b>Read</b> November 19, 2026', '<b>Use</b> research for marketing and operations, not legal advice'],
      bar: 'Code, License and Claims', barsub: 'What the rules are, and what they do to a job',
      actions: [{ id: 'l3Csv', label: '↓ Register CSV' }, { id: 'l3Sat', label: 'Compliance Satchel ↗', title: 'Screen ads, pages and contracts against the rules' }] }) +
      `<div class="wrap">
      ${callout('', 'Read this first: research, not advice', 'This register is written for the people who run and market a California roofing company: what the law is and what each rule does to licensing, contracts, claims, codes and copy. It is not legal advice, the calculators are screening tools, and a contract, a license question or a dispute belongs with a California lawyer and the Contractors State License Board. Grades: A, the primary text was read (an agency page, or the Legislature\'s page by dated archive capture); B, the text was read on a transcription host; C, a secondary source; D, our own reading, or searched for and not found. Where something could not be verified the register says so instead of guessing, and the last card lists every gap.')}
      <div class="kpis" id="l3Kpis"></div>
      ${card('What changed, and when', 'The sequence of changes that sets today\'s rules for roofers, and two dates still ahead.', '<div id="l3Time"></div>', 'mt')}
      <div class="split">
        ${card('License and job screen', 'Which license, bond, insurance, contract form and notices a job needs. Enter the job.', '<div id="l3Lic"></div>')}
        ${card('Contract screen', 'The cancellation deadline by buyer and situation, the down payment cap and the deductible rule for one contract.', '<div id="l3Con"></div>')}
      </div>
      <div class="split">
        ${card('Insurer claim clock', 'The deadlines an insurer works to after a property claim, and how long the owner has to finish the roof and collect.', '<div id="l3Clock"></div>')}
        ${card('Price gouging screen', 'Whether a price charged after an emergency declaration stays within Penal Code 396.', '<div id="l3Gouge"></div>')}
      </div>
      <div class="split">
        ${card('Class A and cool roof triggers', 'What a reroof must meet, by the share of the roof replaced, the fire zone, the building, the slope and the climate zone.', '<div id="l3Trig"></div>')}
        ${card('Fire hardening and the insurance bill', 'What a hardened roof costs over a plain reroof, set against a discount the owner\'s insurer has stated. No rule sets the percentage.', '<div id="l3Pay"></div>')}
      </div>
      <div class="split">
        ${card('Mechanics lien deadlines', 'Preliminary notice, recording and suit dates for one job.', '<div id="l3Lien"></div>')}
        ${card('Crew safety screen', 'Fall protection, heat and asbestos thresholds for one job.', '<div id="l3Safe"></div>')}
      </div>
      ${card('What the rules do to marketing', 'Each rule translated into offers, copy, crews and case selection.', '<div id="l3Mkt"></div>', 'mt')}
      ${card('The register', 'Every item with its citation, effective date and grade. Filter by service line.', `<div class="seg" id="l3Line" style="margin-bottom:10px;flex-wrap:wrap"><button data-v="" aria-pressed="true">All lines</button>${PL.map(l => `<button data-v="${l.key}" aria-pressed="false">${esc(l.short)}</button>`).join('')}</div><div id="l3Reg"></div>`, 'mt')}
      ${card('Questions owners ask', 'Plain answers written from the register, for a sales call, a page or a guide. Each names the register items it rests on; open the item in the register above before quoting it.', '<div id="l3Faq"></div>', 'mt')}
      <div class="split">
        ${card('Advertising and selling rules', 'The rules every ad, page, script and contract must meet, and where the atlas checks them. The Compliance Satchel (module 10) screens copy against these.', '<div id="l3Ads"></div>')}
        ${card('Pending, unsettled and not found', 'What is not yet law, or could not be confirmed, so no one builds copy on it.', '<div id="l3Pend"></div>')}
      </div>
      ${card('What could not be verified', 'The gaps in the evidence behind this module. Each is a reason to check before relying on a row.', '<div id="l3Gaps"></div>', 'mt')}
      <div class="foot" id="l3Foot"></div></div>`;
    $('#l3Kpis', root).innerHTML = kpiHTML([
      { l: 'License needed from', g: 'A', v: '$1,000', d: 'total job price since January 1, 2025; any price with a permit or an employee (B&P 7048)' },
      { l: 'Contractor bond', g: 'A', v: '$25,000', d: 'on file with the CSLB since January 1, 2023 (B&P 7071.6)' },
      { l: 'Workers\' compensation', g: 'B', v: 'Every C-39', d: 'no exemption for roofers with no employees (B&P 7125)' },
      { l: 'Down payment cap', g: 'A', v: '$1,000 or 10%', d: 'whichever is less, on a home improvement contract (B&P 7159.5)' },
      { l: 'Right to cancel', g: 'A', v: '3 / 5 / 7 days', d: 'business days: any buyer, senior citizen, disaster repair (B&P 7159)' },
      { l: 'Price cap after a declaration', g: 'B', v: '10% for 180 days', d: 'on a contractor\'s repair prices (Penal Code 396)' },
      { l: 'Insurer clock', g: 'B', v: '15 / 40 / 30 days', d: 'acknowledge, accept or deny, pay (10 CCR 2695.5, 2695.7)' },
      { l: 'Class A trigger in a fire zone', g: 'B', v: '50% in 12 months', d: 'or more of the roof replaced (2025 WUI Code 507.1)' },
      { l: 'Cool roof trigger', g: 'A', v: 'Over 50%', d: 'of the roof replaced; or 2,000 square feet on other buildings (Title 24, Part 6)' },
      { l: 'Fall protection', g: 'A', v: '6 feet', d: 'residential roofing since July 1, 2025 (8 CCR 1731)' },
    ]);
    $('#l3Time', root).innerHTML = `<div class="xscroll"><table><thead><tr><th class="l">Effective</th><th class="l">Change</th><th class="l">What it does</th></tr></thead><tbody>${LAW_TIMELINE.map(([d, dl, t, s, id]) => { const x = id ? LAWX.items.find(i => i.id === id) : null; return `<tr><td class="l"><b>${d ? fmtDate(parseD(d)) : esc(dl)}</b></td><td class="l wrap" style="min-width:200px"><b>${esc(t)}</b>${x ? `<div class="mini"><a href="${x.url}" target="_blank" rel="noopener">${esc(x.cite)}</a></div>` : ''}</td><td class="l wrap">${esc(s)}</td></tr>`; }).join('')}</tbody></table></div>`;
    const today = new Date().toISOString().slice(0, 10); const now = parseD(today);
    const fmtISO = d => d.toISOString().slice(0, 10);
    const yes = id => $(id, root).value === 'yes';
    const num = id => +$(id, root).value || 0;
    const left = d => { const days = Math.round((d - now) / 864e5); return days < 0 ? `${N(-days)} days ago` : days === 0 ? 'today' : `${N(days)} days from today`; };
    const chk = (ok, txt, g) => `<div class="rowl" style="align-items:flex-start"><span style="flex:0 0 22px">${ok === true ? '✔' : ok === false ? '✖' : '•'}</span><span style="flex:1;white-space:normal">${txt}</span>${g ? `<b>${G(g)}</b>` : ''}</div>`;
    const sel = (id, label, opts) => `<label class="efld"><span>${label}</span><select id="${id}">${opts.map(o => `<option value="${o[0]}">${o[1]}</option>`).join('')}</select></label>`;
    const inp = (id, label, type, val, extra) => `<label class="efld"><span>${label}</span><input type="${type}" id="${id}" value="${val}" ${extra || ''}></label>`;
    const YN = [['no', 'No'], ['yes', 'Yes']], NY = [['yes', 'Yes'], ['no', 'No']];
    const wire = (ids, fn) => { ids.forEach(id => $(id, root).addEventListener('input', fn)); fn(); };
    const note = t => `<div class="mini" style="margin-top:6px">${t}</div>`;
    // ---------- license and job ----------
    $('#l3Lic', root).innerHTML = `<div class="calc">${sel('l3LB', 'Building', [['res', 'House or building of 1 to 4 units'], ['mf', 'Apartments, condominium or association'], ['com', 'Commercial']])}${inp('l3LV', 'Total job price ($)', 'number', 18500, 'step="100" min="0"')}${sel('l3LP', 'Does the work need a building permit here?', [['yes', 'Yes'], ['no', 'No'], ['ns', 'Not sure']])}${sel('l3LE', 'Anyone employed on the job?', NY)}${sel('l3LH', 'Sold at the home by a salesperson?', YN)}${sel('l3LR', 'Our role', [['direct', 'Hired by the owner'], ['sub', 'Subcontractor or supplier']])}${sel('l3LS', 'Solar panels to come off and go back?', YN)}${sel('l3LA', 'Asbestos roofing of 100 square feet or more?', YN)}</div><div class="calcout" id="l3LO"></div>`;
    function lic() {
      const b = $('#l3LB', root).value, res = b === 'res', v = num('#l3LV'), pm = $('#l3LP', root).value, emp = yes('#l3LE'), home = yes('#l3LH'), sub = $('#l3LR', root).value === 'sub', solar = yes('#l3LS'), asb = yes('#l3LA'); const out = [];
      const need = v >= 1000 || pm === 'yes' || emp;
      if (need) out.push(chk(null, `<b>A contractor license is required: C-39 Roofing</b>, or another class that covers the work. ${v >= 1000 ? 'The total price is $1,000 or more.' : pm === 'yes' ? 'Work that needs a building permit needs a license at any price.' : 'A person who employs anyone on the job cannot use the minor work exemption.'} Splitting a job into contracts under $1,000 to avoid the license is not allowed (Bus. & Prof. Code 7048).`, 'A'));
      else out.push(chk(true, `Under $1,000 with no permit and no employee: the minor work exemption applies${pm === 'ns' ? ', if the building department confirms no permit is needed' : ''}. An unlicensed person may advertise only such jobs and must say in the ad that the person is not licensed (Bus. & Prof. Code 7027.2, 7048).`, 'A'));
      if (need) {
        out.push(chk(null, '<b>License number</b> on every ad, bid and contract (Bus. & Prof. Code 7030.5).', 'B'));
        out.push(chk(null, 'A <b>$25,000 contractor bond</b> on file with the CSLB (7071.6), and a <b>workers\' compensation certificate</b> on file even with no employees, because the license is C-39 (7125). The insurer audits a roofer\'s payroll every year in person (Insurance Code 11665).', 'A'));
      }
      if (res && v > 500) out.push(chk(null, `<b>Written home improvement contract</b> with its headings and notices, signed by both sides, copy to the buyer before work starts (7159). Largest down payment on this job: <b>${M$(downCap(v))}</b> ($1,000 or 10 percent, whichever is less); after that, nothing ahead of work done or material delivered (7159.5).${v <= 750 ? ' At $750 or less the short service and repair contract may be used, but only if the buyer made the first contact, nothing beyond the needed repair is sold, and no payment is taken until the work is complete (7159.10).' : ''}`, 'A'));
      else if (res) out.push(chk(true, 'At $500 or less the home improvement contract statute does not require the written form. Write the job down anyway.', 'A'));
      else out.push(chk(null, 'The home improvement contract statute covers residential property. For an association or apartment owner, confirm with counsel whether the job is home improvement; commercial work is outside it.', 'D'));
      if (home && res) out.push(chk(null, `The seller must be a <b>registered home improvement salesperson</b> (officers, the qualifier and appointment setters are excepted) and must give the contractor's business name and license number before the pitch (7152, 7153). The buyer gets a <b>right to cancel</b>: a contract received today could be cancelled until midnight of ${fmtDate(cancelBy(now, 3))} (three business days), ${fmtDate(cancelBy(now, 5))} for a senior citizen, ${fmtDate(cancelBy(now, 7))} for disaster repairs.`, 'A'));
      if (pm === 'yes') out.push(chk(null, '<b>Pull the permit.</b> At issuance the contractor shows a valid workers\' compensation certificate, or the city verifies it electronically (Labor Code 3800).', 'B'));
      else out.push(chk(null, `${pm === 'no' ? 'No permit here by your entry.' : 'Check with the building department.'} Los Angeles, San Francisco and Los Angeles County issue reroof permits; the City of San Diego requires none to renew a covering where the structure is not altered, but does when sheathing over 25 percent, framing or heavier material is involved. San Jose and Sacramento were not read.`, 'A'));
      if (sub) out.push(chk(null, `<b>Preliminary notice within 20 days</b> of first furnishing work, to the owner, the direct contractor and any construction lender, or there is no lien right (Civil Code 8200, 8204).`, 'A'));
      else out.push(chk(null, 'Hired by the owner: a preliminary notice goes only to a construction lender, if there is one (Civil Code 8200).', 'A'));
      if (solar) out.push(chk(null, 'Solar reinstall: a <b>separate permit</b> in Los Angeles County and an electrical permit in the City of San Diego. Los Angeles County states that a C-10 or C-46 contractor reinstalls the system, or an A or B licensee does both trades. Old bonding clips are not reused.', 'A'));
      if (asb) out.push(chk(null, 'Asbestos at 100 square feet or more: <b>Cal/OSHA registration</b> before work (8 CCR 341.6) and the <b>C-22 class or the CSLB asbestos certification</b>; an uncertified contractor may take the job only if a C-22 or certified contractor does the asbestos part (7058.5, 7058.6).', 'A'));
      $('#l3LO', root).innerHTML = out.join('') + note('Screening only. Confirm classifications with the CSLB (cslb.ca.gov) before bidding; building departments set their own permit rules and fees.');
    }
    wire(['#l3LB', '#l3LV', '#l3LP', '#l3LE', '#l3LH', '#l3LR', '#l3LS', '#l3LA'], lic);
    // ---------- contract ----------
    $('#l3Con', root).innerHTML = `<div class="calc">${inp('l3CD', 'Date the buyer received the signed copy', 'date', today)}${sel('l3CW', 'Where was it negotiated?', [['home', 'At the home, by phone or online'], ['shop', 'At the contractor\'s place of business']])}${sel('l3CB', 'Buyer', [['any', 'Not a senior citizen'], ['senior', 'Senior citizen']])}${sel('l3CE', 'Repair of damage from a declared disaster?', YN)}${inp('l3CP', 'Contract price ($)', 'number', 18500, 'step="100" min="0"')}${inp('l3CA', 'Down payment asked ($)', 'number', 1850, 'step="50" min="0"')}${sel('l3CN', 'Performance and payment bond furnished?', YN)}${sel('l3CI', 'Insurance expected to pay?', YN)}${inp('l3CK', 'Owner\'s deductible ($)', 'number', 2500, 'step="100" min="0"')}${inp('l3CX', 'Discount or credit offered ($)', 'number', 0, 'step="100" min="0"')}</div><div class="calcout" id="l3CO"></div>`;
    function con() {
      const d = parseD($('#l3CD', root).value) || now, shop = $('#l3CW', root).value === 'shop', senior = $('#l3CB', root).value === 'senior', dis = yes('#l3CE'), p = num('#l3CP'), dp = num('#l3CA'), bond = yes('#l3CN'), ins = yes('#l3CI'), ded = num('#l3CK'), disc = num('#l3CX'); const out = [];
      if (p <= 500) out.push(chk(true, 'At $500 or less the written home improvement contract is not required by section 7159; the rows below describe a contract above that line.', 'A'));
      const days = dis ? 7 : senior ? 5 : 3; const c = cancelBy(d, days);
      if (shop && !dis) out.push(chk(true, 'Negotiated at the contractor\'s place of business: the three or five day cancellation notice is not required (7159(e)(6)(A)). The federal rule for sales at the home does not apply either.', 'A'));
      else out.push(chk(null, `<b>Cancellation window:</b> the buyer may cancel until midnight of <b>${fmtDate(c)}</b> (${left(c)}), the ${days === 3 ? 'third' : days === 5 ? 'fifth' : 'seventh'} business day after receiving the signed and dated copy: ${dis ? 'the Seven-Day Right to Cancel for repairs after a declared disaster' : senior ? 'five business days for a senior citizen' : 'three business days'}. The buyer may cancel by email, mail, fax or delivery; from 2026 the first page carries the email address and a help telephone number (AB 1327). Anything paid goes back within 10 days of the notice. Work started inside the window is work the buyer can still cancel.`, 'A'));
      out.push(chk(null, 'Days are counted here as the federal rule counts them: every day except Sundays and the federal holidays it lists. California\'s own definition of a business day, and the age that makes a buyer a senior citizen, were not read for this build. Check both before relying on the date.', 'D'));
      const cap = downCap(p);
      if (bond) out.push(chk(true, 'A performance and payment bond (or an approved blanket bond or joint control) exempts the contract from the down payment and progress payment limits (7159.5(a)(8)).', 'A'));
      else out.push(chk(dp <= cap, dp <= cap ? `Down payment ${M$(dp)} is within the cap of <b>${M$(cap)}</b> ($1,000 or 10 percent of the price, whichever is less).` : `<b style="color:var(--critical)">Down payment ${M$(dp)} is ${M$(dp - cap)} over the cap of ${M$(cap)}</b> ($1,000 or 10 percent of the price, whichever is less). Taking it is a misdemeanor: a fine of $100 to $5,000, up to a year in county jail, or both${dis ? '; in a declared disaster area the court must impose the maximum fine' : ''} (7159.5).`, 'A'));
      out.push(chk(null, 'After the down payment, no request or payment may exceed the value of the work performed or the material delivered. On request, give an unconditional lien release for the part already paid.', 'A'));
      if (ins) {
        const flag = disc > 0 && ded > 0 && disc >= ded * 0.5;
        out.push(chk(flag ? false : true, flag ? `<b>A ${M$(disc)} discount against a ${M$(ded)} deductible reads as a discount meant to offset the deductible</b>, which Penal Code 551 forbids unless the insurer has determined the claim amount and the work follows that determination or estimates the insurer accepted. Remove the credit or document an unrelated reason in writing. (The half of the deductible line is this screen's rule of thumb; the statute turns on intent.)` : `The owner pays the ${M$(ded)} deductible. Never offer or give a discount meant to offset it (Penal Code 551).`, 'B'));
        out.push(chk(null, 'Write the estimate and the scope; do not negotiate the claim. Acting for an insured in settling a claim for pay needs a public adjuster license (Insurance Code 15006, 15007).', 'A'));
      }
      if (dis) out.push(chk(null, 'Declared disaster: repair prices stay within 10 percent of the pre emergency price for 180 days (Penal Code 396), and the work needs a California license (Bus. & Prof. Code 7028.16).', 'B'));
      $('#l3CO', root).innerHTML = out.join('') + note('Screening only. Paste the contract into the Compliance Satchel (module 10) to test for the required headings, sentences and notices.');
    }
    wire(['#l3CD', '#l3CW', '#l3CB', '#l3CE', '#l3CP', '#l3CA', '#l3CN', '#l3CI', '#l3CK', '#l3CX'], con);
    // ---------- claim clock ----------
    $('#l3Clock', root).innerHTML = `<div class="calc">${inp('l3KL', 'Date of loss', 'date', fmtISO(addDays(now, -3)))}${inp('l3KN', 'Date the insurer got notice of the claim', 'date', today)}${inp('l3KP', 'Date of proof of claim', 'date', fmtISO(addDays(now, 14)))}${inp('l3KQ', 'Date the insurer accepted (blank if not yet)', 'date', '')}${inp('l3KA', 'Date of the first actual cash value payment (blank if none)', 'date', '')}${sel('l3KE', 'Loss in a declared state of emergency?', YN)}</div><div class="calcout" id="l3KO"></div><div id="l3KChart" style="margin-top:10px"></div>`;
    function clock() {
      const L = parseD($('#l3KL', root).value) || now, n = parseD($('#l3KN', root).value) || now, pr = parseD($('#l3KP', root).value), q = parseD($('#l3KQ', root).value), a = parseD($('#l3KA', root).value), em = yes('#l3KE'); const out = [];
      const ack = addDays(n, 15); out.push(chk(null, `<b>Acknowledge by ${fmtDate(ack)}</b> (${left(ack)}): within 15 calendar days of notice the insurer acknowledges the claim, provides forms and help, and begins any investigation (10 CCR 2695.5(e)).`, 'B'));
      let dec = null, pay = null;
      if (pr) { dec = addDays(pr, 40); out.push(chk(null, `<b>Accept or deny by ${fmtDate(dec)}</b> (${left(dec)}): 40 calendar days after proof of claim. If the insurer needs more time it must say so in writing within the 40 days and again every 30 calendar days (2695.7(b), (c)(1)).`, 'B')); }
      else out.push(chk(null, 'Enter the date of proof of claim for the 40 day decision deadline.', ''));
      if (q || dec) { pay = addDays(q || dec, 30); out.push(chk(null, `<b>Pay by ${fmtDate(pay)}</b> (${left(pay)}): 30 calendar days after ${q ? 'acceptance' : 'the latest lawful acceptance date; enter the real date when known'} (2695.7(h)).`, 'B')); }
      const rc = a ? addMonths(a, em ? 36 : 12) : null;
      out.push(chk(null, a ? `<b>Replacement cost: finish and collect by ${fmtDate(rc)} at the earliest limit a policy may set</b>: ${em ? '36 months for a loss in a declared state of emergency' : '12 months'} from the first actual cash value payment, plus six month extensions for good cause, which includes permit delays, missing materials and the unavailability of contractors (Insurance Code 2051.5).` : `Replacement cost: a policy may not give less than ${em ? '36' : '12'} months from the first actual cash value payment to finish and collect. Enter that payment date for the day.`, 'B'));
      if (em) { const pol = addDays(L, 100); out.push(chk(null, `After a declared emergency the insurer may not require proof of loss before <b>${fmtDate(pol)}</b>, 100 days after the loss (2051.5(b)(3)).`, 'B')); }
      const suit = addMonths(L, em ? 24 : 12); out.push(chk(null, `Suit against the insurer must start by <b>${fmtDate(suit)}</b>: ${em ? '24 months after the start of the loss for a declared emergency' : '12 months after the start of the loss'} (Insurance Code 2071, the standard fire policy form). That is the owner's deadline and a question for the owner's lawyer.`, 'A'));
      out.push(chk(null, 'Also the insurer\'s duty on a replacement cost policy: replace all items in the damaged area when new ones would not match in quality, color or size; do not depreciate labor; give the owner a copy of its estimate; do not require a particular roofer (2695.9).', 'B'));
      $('#l3KO', root).innerHTML = out.join('') + note('Fair Claims Settlement Practices Regulations, read on the Cornell Legal Information Institute. No fixed penalty percentage was found. Use the clock to plan when insurance money arrives and to explain the timeline in general terms. Negotiating the claim needs a public adjuster license (Insurance Code 15006).');
      const rows = [{ l: 'Acknowledge', v: Math.max(0, (ack - n) / 864e5), t: fmtDate(ack), color: ramp('lime')[5] }];
      if (dec) rows.push({ l: 'Accept or deny', v: Math.max(0, (dec - n) / 864e5), t: fmtDate(dec), color: ramp('teal')[5] });
      if (pay) rows.push({ l: 'Pay', v: Math.max(0, (pay - n) / 864e5), t: fmtDate(pay), color: ramp('green')[6] });
      hbarChart($('#l3KChart', root), rows, { W: 520, L: 130, R: 150, rowH: 26, aria: 'Days from notice of claim to each insurer deadline' });
    }
    wire(['#l3KL', '#l3KN', '#l3KP', '#l3KQ', '#l3KA', '#l3KE'], clock);
    // ---------- price gouging ----------
    $('#l3Gouge', root).innerHTML = `<div class="calc">${sel('l3GE', 'Emergency proclaimed or declared for the area?', NY)}${inp('l3GD', 'Date of the declaration', 'date', today)}${sel('l3GK', 'What is being sold', [['svc', 'Repair, reconstruction or cleanup services'], ['mat', 'Building materials or other goods']])}${inp('l3GP', 'Our price just before the declaration ($ per square)', 'number', 1000, 'step="10" min="0"')}${inp('l3GN', 'Price charged now ($ per square)', 'number', 1180, 'step="10" min="0"')}${inp('l3GC', 'Provable cost now, labor and materials ($ per square; 0 if not claimed)', 'number', 0, 'step="10" min="0"')}${inp('l3GM', 'Customary markup on cost (%)', 'number', 35, 'step="1" min="0"')}</div><div class="calcout" id="l3GO"></div><div id="l3GChart" style="margin-top:10px"></div>`;
    function gouge() {
      const e = yes('#l3GE'), d0 = parseD($('#l3GD', root).value) || now, svc = $('#l3GK', root).value === 'svc', p0 = num('#l3GP'), p1 = num('#l3GN'), cost = num('#l3GC'), mk = num('#l3GM');
      if (!e) { $('#l3GO', root).innerHTML = 'No declared emergency: Penal Code 396 does not apply, though prices must still be truthful and agreed in writing.'; $('#l3GChart', root).innerHTML = ''; return; }
      const end = addDays(d0, svc ? 180 : 30); const base = p0 * 1.10; const alt = cost > 0 ? cost * (1 + mk / 100) * 1.10 : 0; const cap = Math.max(base, alt); const over = p1 - cap; const open = now <= end;
      $('#l3GO', root).innerHTML = `The cap runs for <b>${svc ? '180' : '30'} days, to ${fmtDate(end)}</b> (${left(end)}), unless the Governor, the Legislature or a local body extends it; a local extension is at most 30 days each. ${open ? '' : '<b>By these dates the period has run</b>; check for an extension before pricing above the cap. '}Ceiling: 10 percent above the price charged immediately before the declaration, <b>${M$(base)}</b> a square${alt > base ? `; with the cost defense, 10 percent above cost plus the customary markup, <b>${M$(alt)}</b>, but only if the increase is proven to be directly attributable to higher labor or material costs` : ''}. ${over > 0 ? `<b style="color:var(--critical)">${M$(p1)} is ${M$(over)} (${P(over / cap * 100, 0)}) above it.</b> Lower the price or document the added costs with invoices.` : `<b>${M$(p1)} is within it</b>, with ${M$(-over)} to spare.`}${note('Penal Code 396(b), (c), (g), (h), read on california.public.law. A violation is a misdemeanor (up to a year in county jail, a fine up to $10,000, or both) and unfair competition. The default prices are examples, not market figures. Keep the price book dated before the declaration.')}`;
      hbarChart($('#l3GChart', root), [{ l: 'Before the declaration', v: p0, t: M$(p0), color: ramp('lime')[5] }, { l: 'Allowed ceiling', v: cap, t: M$(cap), color: ramp('teal')[5] }, { l: 'Charged now', v: p1, t: M$(p1), color: over > 0 ? cssv('--critical') : ramp('green')[6] }], { W: 520, L: 150, R: 70, rowH: 26, aria: 'Price against the price gouging ceiling' });
    }
    wire(['#l3GE', '#l3GD', '#l3GK', '#l3GP', '#l3GN', '#l3GC', '#l3GM'], gouge);
    // ---------- Class A and cool roof triggers ----------
    $('#l3Trig', root).innerHTML = `<div class="calc">${sel('l3TB', 'Building', Object.keys(COOLROOF).map(k => [k, COOLROOF[k].label]))}${sel('l3TS', 'Slope', [['steep', 'Steep (2:12 or more)'], ['low', 'Low (under 2:12)']])}${ZC.includes('cz') ? inp('l3TZip', 'ZIP code (optional: fills the climate zone)', 'text', '', 'inputmode="numeric" maxlength="5" placeholder="9xxxx"') : ''}${sel('l3TZ', 'Energy Code climate zone', zr(1, 16).map(z => [z, 'Zone ' + z]))}${inp('l3TA', 'Roof area (square feet)', 'number', 2200, 'step="100" min="0"')}${inp('l3TR', 'Area replaced within 12 months (square feet)', 'number', 1300, 'step="100" min="0"')}${sel('l3TF', 'Fire zone?', [['yes', 'Yes: State Responsibility Area, High or Very High zone, or local interface area'], ['no', 'No'], ['ns', 'Not sure']])}${sel('l3TC', 'Permit applied for', [['25', 'On or after January 1, 2026 (2025 codes)'], ['22', 'Before 2026 (2022 codes)']])}${sel('l3TW', 'Roof weighs 25 pounds per square foot or more (most tile)?', YN)}${sel('l3TX', 'Other cool roof exception', [['', 'None'], ['r38', 'Attic at R-38 or better'], ['rb', 'Radiant barrier in the attic'], ['noduct', 'No ducts in the attic'], ['r2', 'R-2 or more continuous at the deck'], ['bipv', 'Area under building integrated solar']])}</div><div class="calcout" id="l3TO"></div><div id="l3TChart" style="margin-top:10px"></div>`;
    $('#l3TZ', root).value = '10';
    function trig() {
      const b = $('#l3TB', root).value, slope = $('#l3TS', root).value, z = +$('#l3TZ', root).value, A = num('#l3TA'), R = Math.min(num('#l3TR'), A || Infinity), fz = $('#l3TF', root).value, c25 = $('#l3TC', root).value === '25', x = $('#l3TX', root).value; const out = [];
      const r = coolRule(b, slope, z, A, R, { heavy: yes('#l3TW'), x, bipv: x === 'bipv' }); const sh = r.share;
      out.push(chk(null, `<b>${P(sh * 100, 0)} of the roof</b> is being replaced (${N(R)} of ${N(A)} square feet).`, ''));
      const fireTrig = c25 ? sh >= 0.5 : sh > 0.5;
      if (fz !== 'no') out.push(chk(fireTrig ? null : true, (fz === 'ns' ? '<b>If the address is in a fire zone:</b> ' : '') + (fireTrig ? (c25 ? '<b>The whole roof must meet the rules for a new roof</b>: a Class A assembly tested to ASTM E108 or UL 790, with the fire rated layer under tile on a wood deck (2025 Wildland-Urban Interface Code 507.1, 504.2: 50 percent or more replaced in a 12 month period).' : '<b>The entire roof covering must be at least Class A</b> (2022 Building Code 1505.1.1: more than 50 percent replaced within one year).') : `Below the ${c25 ? '50 percent' : 'more than 50 percent'} trigger: only the part applied must be at least Class A. The rest of the roof may stay.`) + ' Class A is the rating of the assembly, not of the covering alone. Vents, gutters and eaves have their own rules when they are replaced.', 'B'));
      if (fz !== 'yes') out.push(chk(null, (fz === 'ns' ? '<b>If it is not:</b> ' : '') + (sh > 0.5 ? 'More than 50 percent replaced in a year: the entire covering must be at least <b>Class C</b>' : 'Any covering applied must be at least <b>Class C</b>') + ' (2022 Building Code 1505.1.2). Cities may ask for more: the City of Los Angeles permits Class A or B.', 'B'));
      if (fz === 'ns') out.push(chk(null, 'Check the address on the State Fire Marshal\'s Fire Hazard Severity Zone viewer and with the building department. The 2025 maps were not read for this build.', 'D'));
      const C = r.C;
      if (!r.trig) out.push(chk(true, `<b>Cool roof rule not triggered.</b> ${C.label}: the trigger is ${C.trig} (Title 24, Part 6, ${C.sec}).`, 'A'));
      else if (!r.row) out.push(chk(true, `Cool roof trigger met (${C.trig}), but <b>climate zone ${z} has no reflectance requirement</b> for a ${slope} sloped ${C.label.toLowerCase()} reroof.`, 'A'));
      else if (r.exempt.length) out.push(chk(true, `Cool roof trigger met, and the zone has a requirement, but <b>an exception applies</b>: ${esc(r.exempt.join('; '))}. Keep the proof in the permit file.`, 'A'));
      else out.push(chk(null, `<b>Cool roof required:</b> aged solar reflectance of at least <b>${D(r.row.sr, 2)}</b> and thermal emittance of at least ${D(r.row.te, 2)}, or a Solar Reflectance Index of at least <b>${r.row.sri}</b> (Title 24, Part 6, ${r.row.sec}; trigger: ${C.trig}). The product must be rated and labeled by the Cool Roof Rating Council; an unrated asphalt shingle is assumed to be 0.08.`, 'A'));
      if (x === 'noduct' && !(b === 'sf' && slope === 'steep' && [2, 4, 9, 10, 12, 14].includes(z))) out.push(chk(null, 'The no ducts exception applies only to steep single family roofs in climate zones 2, 4, 9, 10, 12 and 14.', 'A'));
      if (r.trig && r.ins) out.push(chk(null, `Insulation on a low slope reroof: ${esc(r.ins)}.`, 'A'));
      $('#l3TO', root).innerHTML = out.join('') + note('2025 Energy Code (the 2022 values are the same) and the 2025 Wildland-Urban Interface Code; code text read in the Energy Commission\'s PDF and on UpCodes. The 16 climate zones are set by ZIP code in Reference Joint Appendix JA2. A local ordinance can change the fire rule.');
      const cut = b === 'sf' || !A ? 50 : Math.min(50, 2000 / A * 100);
      hbarChart($('#l3TChart', root), [{ l: 'Share replaced', v: sh * 100, t: P(sh * 100, 0), color: ramp('green')[6] }, { l: 'Class A trigger (fire zone)', v: 50, t: c25 ? '50% or more' : 'over 50%', color: ramp('teal')[5] }, { l: 'Cool roof trigger', v: cut, t: 'over ' + P(cut, 0), color: ramp('lime')[5] }], { W: 520, L: 170, R: 90, rowH: 26, aria: 'Share of the roof replaced against the Class A and cool roof triggers' });
    }
    wire(['#l3TB', '#l3TS', '#l3TZ', '#l3TA', '#l3TR', '#l3TF', '#l3TC', '#l3TW', '#l3TX'], trig);
    /* the zone of a ZIP comes from the Energy Commission's list by ZIP (data column cz); a ZIP can straddle two zones, so the address decides */
    { const zi = $('#l3TZip', root); if (zi) zi.addEventListener('input', () => { const z = ZI[String(zi.value).trim()]; if (z && isN(z.cz)) { $('#l3TZ', root).value = String(z.cz); trig(); } }); }
    // ---------- hardening and the insurance bill ----------
    $('#l3Pay', root).innerHTML = `<div class="calc">${sel('l3PI', 'Insurer', [['fair', 'California FAIR Plan (dwelling)'], ['adm', 'Another insurer'], ['com', 'California FAIR Plan (commercial)']])}${inp('l3PC', 'Plain reroof price ($, example)', 'number', 22000, 'step="500" min="0"')}${inp('l3PH', 'Hardened roof price: Class A assembly, vents, gutters, eaves ($, example)', 'number', 26500, 'step="500" min="0"')}${inp('l3PW', 'Annual premium the discount applies to ($)', 'number', 3200, 'step="100" min="0"')}${inp('l3PD', 'Discount the insurer has stated (%), your entry', 'number', 5, 'step="0.5" min="0" max="60"')}</div><div class="calcout" id="l3PO"></div><div id="l3PChart" style="margin-top:10px"></div>`;
    function pay() {
      const who = $('#l3PI', root).value, cp = num('#l3PC'), hp = num('#l3PH'), prem = num('#l3PW'), dsc = clamp(num('#l3PD'), 0, 60);
      const maxF = who === 'fair' ? 16.4 : who === 'com' ? 13.8 : null; const extra = hp - cp, save = prem * dsc / 100; const yrs = save > 0 ? extra / save : null;
      $('#l3PO', root).innerHTML = `The hardened roof costs <b>${M$(Math.abs(extra))} ${extra >= 0 ? 'more' : 'less'}</b> than the plain reroof. A ${P(dsc, 1)} discount on ${M$(prem)} saves about ${M$(save)} a year, ${extra <= 0 ? 'from the first year' : yrs != null ? `paying back the difference in about <b>${D(yrs, 1)} years</b>` : 'which does not pay back the difference'}. ${maxF != null ? (dsc > maxF ? `<b style="color:var(--critical)">${P(dsc, 1)} is above the FAIR Plan's published maximum of ${P(maxF, 1)}</b>, which is for all 12 hardening measures together and applies only to the wildfire part of the premium.` : `The FAIR Plan publishes a maximum of ${P(maxF, 1)} off the wildfire part of the premium for all 12 measures together; a Class A roof is one of them, and the figure for the roof alone is not published.`) : 'The Safer from Wildfires regulation makes insurers reflect a Class A roof in the rate but sets no percentage; each insurer files its own, and percentages by insurer were not found.'}${note('The percentage is your entry: take it from the owner\'s insurer in writing. Never quote a discount in copy (Satchel FIRE2) and never promise renewal (FIRE3). The saving shows at the start of the next policy period after the owner reports the work; proof or an inspection may be needed. If the roof must be Class A anyway under the trigger screen, the extra cost is the vents, gutters and eaves, not the covering. Prices are examples, not market figures.')}`;
      const ys = [...Array(16).keys()];
      lineChart($('#l3PChart', root), { series: [{ name: 'Plain reroof', color: ramp('teal')[5], pts: ys.map(t => [t, cp]), dash: '6 4', fmt: v => M$(v) }, { name: 'Hardened roof, net of the stated discount', color: ramp('green')[6], pts: ys.map(t => [t, hp - save * t]), fmt: v => M$(v) }], x: { ticks: [0, 3, 6, 9, 12, 15], fmt: v => v + ' yrs' }, y: { label: 'Net cost to the owner', fmt: v => K(v), zero: true }, H: 210, W: 560, tipTitle: v => 'Year ' + v, aria: 'Net cost of a hardened roof against a plain reroof over time' });
      $('#l3PChart', root).insertAdjacentHTML('beforeend', legendRow([{ name: 'Plain reroof', color: ramp('teal')[5], dash: 1 }, { name: 'Hardened roof, net of the stated discount', color: ramp('green')[6] }]));
    }
    wire(['#l3PI', '#l3PC', '#l3PH', '#l3PW', '#l3PD'], pay);
    // ---------- lien deadlines ----------
    $('#l3Lien', root).innerHTML = `<div class="calc">${sel('l3NR', 'Our role', [['direct', 'Direct contractor (hired by the owner)'], ['sub', 'Subcontractor or supplier']])}${inp('l3NF', 'Date we first furnished work', 'date', fmtISO(addDays(now, -10)))}${inp('l3NP', 'Date the preliminary notice was given (blank if not yet)', 'date', '')}${inp('l3NC', 'Date the work of improvement was completed (blank if not yet)', 'date', '')}${inp('l3NN', 'Date the owner recorded a notice of completion or cessation (blank if none)', 'date', '')}${inp('l3NL', 'Date our lien was recorded (blank if none)', 'date', '')}</div><div class="calcout" id="l3NO"></div>`;
    function lien() {
      const sub = $('#l3NR', root).value === 'sub', f = parseD($('#l3NF', root).value) || now, pn = parseD($('#l3NP', root).value), cdt = parseD($('#l3NC', root).value), nc = parseD($('#l3NN', root).value), rec = parseD($('#l3NL', root).value); const out = [];
      const due = addDays(f, 20);
      if (sub) { if (!pn) out.push(chk(now <= due ? null : false, `<b>Preliminary notice due by ${fmtDate(due)}</b> (${left(due)}), 20 days after first furnishing work, to the owner, the direct contractor and any construction lender. Without it there is no valid lien. A late notice protects only work from 20 days before it is served.`, 'A')); else if (pn <= due) out.push(chk(true, `Preliminary notice given ${fmtDate(pn)}, inside the 20 days: all work is protected.`, 'A')); else out.push(chk(false, `Preliminary notice given ${fmtDate(pn)}, after the 20 days: it protects only work done on or after <b>${fmtDate(addDays(pn, -20))}</b>.`, 'A')); }
      else out.push(chk(null, `A contractor hired by the owner gives a preliminary notice only to a construction lender, if there is one, by ${fmtDate(due)}.`, 'A'));
      if (cdt) { const a = addDays(cdt, 90), b2 = nc ? addDays(nc, sub ? 30 : 60) : null; const by = b2 && b2 < a ? b2 : a; out.push(chk(null, `<b>Record the lien by ${fmtDate(by)}</b> (${left(by)}): the earlier of 90 days after completion${nc ? ` (${fmtDate(a)})` : ''} or ${sub ? '30' : '60'} days after a recorded notice of completion or cessation${b2 ? ` (${fmtDate(b2)})` : ''} (Civil Code ${sub ? '8414' : '8412'}). Serve a copy with the Notice of Mechanics Lien on the owner (8416).`, 'A')); }
      else out.push(chk(null, `Enter the completion date for the recording deadline: the earlier of 90 days after completion or ${sub ? '30' : '60'} days after a recorded notice of completion.`, ''));
      if (rec) { const s = addDays(rec, 90); out.push(chk(now <= s ? null : false, `<b>File suit to enforce by ${fmtDate(s)}</b> (${left(s)}), 90 days after recording, or the lien expires and is unenforceable (Civil Code 8460).`, 'A')); }
      $('#l3NO', root).innerHTML = out.join('') + note('Civil Code 8200, 8204, 8412, 8414, 8416, 8460, read as archive captures of the Legislature\'s pages. Calendar days. Screening only: lien work belongs with a construction lawyer or a notice service.');
    }
    wire(['#l3NR', '#l3NF', '#l3NP', '#l3NC', '#l3NN', '#l3NL'], lien);
    // ---------- crew safety ----------
    $('#l3Safe', root).innerHTML = `<div class="calc">${sel('l3SK', 'Work', [['res', 'Roofing on houses, townhouses, duplexes and similar'], ['oth', 'Other roofing']])}${sel('l3SS', 'Slope', [['low', 'Up to and including 7:12'], ['steep', 'Steeper than 7:12']])}${inp('l3SH', 'Fall distance to the level below (feet)', 'number', 10, 'step="1" min="0"')}${inp('l3ST', 'Forecast temperature (°F)', 'number', 92, 'step="1"')}${inp('l3SA', 'Asbestos containing roofing to be disturbed (square feet)', 'number', 0, 'step="10" min="0"')}</div><div class="calcout" id="l3SO"></div>`;
    function safe() {
      const res = $('#l3SK', root).value === 'res', steep = $('#l3SS', root).value === 'steep', h = num('#l3SH'), t = +$('#l3ST', root).value || 0, a = num('#l3SA'); const out = [];
      if (res) { const need = steep || h >= 6; out.push(chk(need ? null : true, need ? `<b>Fall protection required</b>${steep ? ' at any height on a slope steeper than 7:12' : ': the fall distance is 6 feet or more'}. Personal fall protection, scaffolding, safety nets or guardrails; a fall protection plan with monitors only if the employer shows those are infeasible. Parapets do not count toward height. Train and document (8 CCR 1731, operative July 1, 2025).` : 'Under 6 feet on a slope up to 7:12: section 1731 does not require fall protection at this height.', 'A')); }
      else out.push(chk(h > 20 ? null : true, h > 20 ? '<b>Fall protection required</b>: other roofing above 20 feet (8 CCR 1730).' : 'At 20 feet or less section 1730 does not require it, except at any height when a felt laying machine is pulled by a worker walking backwards.', 'A'));
      out.push(chk(null, `Heat: one quart of drinking water per employee per hour for the whole shift. ${t >= 95 ? '<b>At 95 degrees or more, high heat procedures apply</b>, and shade must be up.' : t > 80 ? '<b>Above 80 degrees, shade must be present.</b>' : 'Shade is required when the temperature exceeds 80 degrees.'} (8 CCR 3395.)`, 'A'));
      if (a >= 100) out.push(chk(null, '<b>Asbestos, 100 square feet or more:</b> register with Cal/OSHA before work (8 CCR 341.6); the C-22 class or the CSLB asbestos certification is needed (Bus. & Prof. Code 7058.5). Removal of asbestos roofing is Class II asbestos work (8 CCR 1529).', 'A'));
      else if (a > 0) out.push(chk(null, 'Asbestos under 100 square feet: still Class II asbestos work under 8 CCR 1529, below the registration line.', 'A'));
      $('#l3SO', root).innerHTML = out.join('') + note('Title 8 read on dir.ca.gov. The federal lead and asbestos rules and air district notification rules were not read for this build.');
    }
    wire(['#l3SK', '#l3SS', '#l3SH', '#l3ST', '#l3SA'], safe);
    // ---------- marketing ----------
    $('#l3Mkt', root).innerHTML = proseTable([
      ['<b>The license number is the ad</b>', 'It must be in all advertising, so put the CSLB number on every ad, page, truck, sign and door hanger, and say "check our license". It is the fastest answer to out of area crews after a fire or a storm, and the first thing the board looks for.'],
      ['<b>Sell the contract terms</b>', 'The down payment cap, the right to cancel by email and the written warranty are consumer protections most owners do not know. "No big deposit" and "three days to change your mind" are lawful, true and hard for an unlicensed seller to match.'],
      ['<b>No claims talk</b>', '"We handle your claim" and "we negotiate with your insurer" describe public adjusting, which needs its own license. Say what a roofer does: inspect, document damage with photos, write an itemized estimate and scope, and do the work.'],
      ['<b>Deductibles</b>', '"We pay your deductible", "deductible assistance" and credits sized to the deductible are barred by Penal Code 551. Financing the owner\'s share is the lawful answer to a large deductible, with Regulation Z disclosures.'],
      ['<b>Fire: the assembly, not a promise</b>', 'Say "Class A fire rated roof assembly" and name it. Never "fireproof". Most roofs inside the January 2025 fire perimeters were already Class A; vents, eaves, gutters and the first five feet decide as much, so sell the roof edge with the roof.'],
      ['<b>Insurance pressure</b>', 'With 698,307 FAIR Plan policies of all kinds and non-renewal notices arriving 75 days ahead, owners in fire zones are looking for what an insurer wants to see. A page on what Safer from Wildfires lists, with "ask your insurer for the figure", meets them honestly. Never a discount size, never a promise of renewal.'],
      ['<b>Cool roofs</b>', 'Past 50 percent of the roof, most inland and southern climate zones need rated reflective products. "We check your climate zone and file the rating sheet" is a claim a careless competitor cannot make. Most tile is exempt by weight.'],
      ['<b>Tile</b>', 'The tile era homes of 1980 to 1999 are past the underlayment life two practitioners give. "Your tile is fine, the paper under it is not" explains the job; the code lets sound tile go back.'],
      ['<b>After a declaration</b>', 'Prices stay within 10 percent for 180 days, repair contracts carry seven days to cancel, and every crew needs the California license. A dated price book and a local address are the proof.'],
      ['<b>At the door</b>', 'A registered salesperson who names the contractor and license first, the right notice for the buyer, and no talk of claims or deductibles. Local solicitation permits were not researched.'],
    ]);
    function drawReg() {
      const items = LAWX.items.filter(x => !st.line || (x.lines || []).includes(st.line));
      $('#l3Reg', root).innerHTML = items.map(x => `<div class="lawi"><div class="lh"><b>${esc(x.t)}</b> ${G(x.g)}</div><div class="mini" style="margin:2px 0 4px">${x.grp ? esc(x.grp) + ' · ' : ''}<a href="${x.url}" target="_blank" rel="noopener">${esc(x.cite)}</a> · ${esc(x.eff)} · ${esc((x.lines || []).length === PL.length ? 'All lines' : (x.lines || []).map(k => PLI[k] ? PLI[k].short : k).join(', '))}</div><p class="mini" style="color:var(--ink-2)">${esc(x.s)}</p></div>`).join('') || '<p class="mini">No register items for this line.</p>';
    }
    wireSeg($('#l3Line', root), v => { st.line = v; drawReg(); }); drawReg();
    $('#l3Ads', root).innerHTML = `<div class="xscroll"><table><thead><tr><th class="l">Rule</th><th class="l">Subject</th><th class="l">What it requires</th><th class="l">Where the atlas applies it</th></tr></thead><tbody>${ADRULES.map(r => `<tr><td class="l"><b>${esc(r[0])}</b></td><td class="l">${esc(r[1])}</td><td class="l wrap">${esc(r[2])}</td><td class="l wrap mini">${esc(r[3] || 'Satchel')}</td></tr>`).join('')}</tbody></table></div><p class="mini" style="margin-top:8px">Sources: statutes as archived from <a href="https://leginfo.legislature.ca.gov/" target="_blank" rel="noopener">leginfo.legislature.ca.gov</a> and on california.public.law, the <a href="https://www.cslb.ca.gov/" target="_blank" rel="noopener">CSLB</a> industry bulletins, the <a href="https://www.insurance.ca.gov/" target="_blank" rel="noopener">Department of Insurance</a>, and the federal rules on <a href="https://www.ecfr.gov/" target="_blank" rel="noopener">eCFR</a>. Licensing questions go to the CSLB; insurance questions to the Department of Insurance.</p>`;
    /* the owner questions (LAWFAQ in 04_content.js), each with the citations of the register items behind it */
    $('#l3Faq', root).innerHTML = (typeof LAWFAQ !== 'undefined' && LAWFAQ.length) ? LAWFAQ.map(([q, ans, ids]) => { const its = (ids || []).map(id => LAWX.items.find(i => i.id === id)).filter(Boolean);
      return `<details class="lawi"><summary><b>${esc(q)}</b></summary><p class="mini" style="color:var(--ink-2);margin-top:6px">${esc(ans)}</p><div class="mini">${its.length ? its.map(x => `<a href="${x.url}" target="_blank" rel="noopener">${esc(x.cite)}</a> ${G(x.g)}`).join(' · ') : 'No register item is tied to this answer.'}</div></details>`; }).join('') : '<p class="mini">No questions are carried in this build.</p>';
    $('#l3Pend', root).innerHTML = LAWX.pending.map(x => `<div class="lawi"><div class="lh"><b>${esc(x.t)}</b> ${G(x.g)}</div><p class="mini" style="color:var(--ink-2);margin-top:4px">${esc(x.s)}</p><div class="mini">${esc(x.src)}</div></div>`).join('');
    $('#l3Gaps', root).innerHTML = proseTable(LAW_GAPS.map(([t, s]) => [`<b>${esc(t)}</b>`, esc(s)]));
    $('#l3Foot', root).innerHTML = `<b style="color:var(--ink)">California Roofer Guru</b>, module 03. Statements of law as read November 19, 2026 from statutes, regulations, codes and agency pages, each with its source and grade; screening calculators only. Not legal advice.`;
    $('#l3Csv', root).onclick = () => saveFile('california-roofing-law-register.csv', toCSV(['item', 'group', 'citation', 'effective', 'grade', 'lines', 'summary', 'source'], LAWX.items.map(x => [x.t, x.grp || '', x.cite, x.eff, x.g, (x.lines || []).join('; '), x.s, x.url]), 'California Roofer Guru, module 03. Read November 19, 2026. Research material, not legal advice.'));
    $('#l3Sat', root).onclick = () => goModule('satchel');
    BUS.on('theme', () => { clock(); gouge(); trig(); pay(); });
  }
});
