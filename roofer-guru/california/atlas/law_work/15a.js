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
