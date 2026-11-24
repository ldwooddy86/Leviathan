// Legion · occupations: what Californians do for a living, by Census occupation group (C24010), place and person.
//
// population.mjs decides each worker's occupation group from the ZIP's C24010 table (by sex and age) and the
// shift behind their departure time; this module turns that into a specific job: a title, a sector, a generic
// employer (never a brand), a shift and an annual wage in California dollars. Titles fit the place through
// affinities to the pack's own data: the region, the ZIP's mix of establishments (warehouses, factories,
// hotels, restaurants, hospitals, offices, schools, auto shops, builders, solar firms, insurance agents), the
// coast, density, desert heat, snow, fire country, ports (a dense coastal ZIP among warehouses) and
// institutions (a large group-quarters population). So a farmworker in the San Joaquin Valley picks almonds,
// table grapes or citrus or works a dairy, on the Central Coast strawberries or lettuce, on the North Coast
// works in forestry or on a fishing boat; software jobs concentrate in the Bay Area, film and TV crews in Los
// Angeles, warehouses in the Inland Empire and longshore work at the ports. Field work is in the fields: in a dense
// city ZIP the farming group's jobs are the ones a city has (a plant nursery, a wholesale produce market). Wages
// scale with experience, education and the county's income level, and never fall below California's minimum wage for
// full-time work (population.mjs pays part-timers for their hours, never below the hourly minimum either, with time
// and a half over 40 hours a week). Service members are paid by the federal tables, not the state minimum wage: basic
// pay from a private's (MIL_PAY_FLOOR) up, the same everywhere; each military title belongs to a branch
// (MILITARY_BRANCHES), which population.mjs takes from the installation a member reports to. Licensed titles
// (nurses, physicians, attorneys, teachers, engineers...) carry their degree always: population.mjs picks the title
// first (chooseTitle) and draws education within it, then the wage (titleWage). A worker who works from home gets a
// title that can be done from home, and only home-based work (a home daycare, a cottage-food baker) is never done
// elsewhere. Nothing here depends on a person's heritage.

/** The 25 Census occupation groups (C24010 leaves), in the pack's order (world.acsLabels('occ')). */
export const OCC_GROUPS = ['management', 'business', 'computer', 'engineering', 'science', 'social', 'legal', 'education', 'arts',
  'practitioner', 'healthtech', 'healthsupport', 'firefighting', 'police', 'food', 'cleaning', 'personalcare', 'sales', 'office',
  'farming', 'construction', 'repair', 'production', 'transport', 'moving'];

/** Education levels (B15003 keys) from least to most. */
export const EDUCATION_LEVELS = ['nohs', 'hs', 'somecollege', 'associate', 'bachelor', 'master', 'professional', 'doctorate'];

/** Shift keys used by population.mjs and the catalog. */
export const SHIFTS = ['early', 'day', 'mid', 'evening', 'night', 'h24'];

/** California's minimum wage in 2026 (Department of Industrial Relations): dollars an hour. */
export const MIN_WAGE_HOURLY = 16.9;
/** The least a full-time (40 hours a week, 52 weeks) job pays in California in 2026, rounded up to $500. */
export const MIN_WAGE_FULL_TIME = Math.ceil(MIN_WAGE_HOURLY * 2080 / 500) * 500;
/**
 * The least a year of active duty pays in 2026: a private's basic pay (E-1 with over four months of service, about
 * $2,400 a month on the federal pay table). Service members are federal employees: the state minimum wage does not
 * apply to them, and housing and food allowances are not wages.
 */
export const MIL_PAY_FLOOR = 28900;
/** The branches of the armed forces: key -> the employer a member's job names. */
export const MILITARY_BRANCHES = Object.freeze({
  navy: 'the U.S. Navy', marines: 'the U.S. Marine Corps', army: 'the U.S. Army', airforce: 'the U.S. Air Force',
  spaceforce: 'the U.S. Space Force', coastguard: 'the U.S. Coast Guard',
});
const BRANCH_OF_EMPLOYER = Object.fromEntries(Object.entries(MILITARY_BRANCHES).map(([k, e]) => [e, k]));

/**
 * Work patterns of each occupation group (plus active-duty military), used by population.mjs for layer 0.
 * shifts: weights of shift starts (early 4:30-7:00, day 7:00-9:30, mid 10:00-12:00, evening 14:00-17:00,
 * night 21:00-23:00, h24 a 24-hour shift); weekend: share whose work week includes Saturday or Sunday;
 * partTime: share part time; long: share of full-timers on 12-hour shifts; median: a typical California wage.
 * The firefighting group is the Census's "firefighting and other protective service" (security guards too).
 */
export const GROUP_PROFILES = {
  management: { shifts: { early: 0.08, day: 0.85, evening: 0.04, night: 0.03 }, weekend: 0.12, partTime: 0.05, long: 0, median: 135000 },
  business: { shifts: { early: 0.05, day: 0.93, mid: 0.02 }, weekend: 0.05, partTime: 0.08, long: 0, median: 95000 },
  computer: { shifts: { early: 0.04, day: 0.9, mid: 0.06 }, weekend: 0.05, partTime: 0.05, long: 0, median: 150000 },
  engineering: { shifts: { early: 0.12, day: 0.86, evening: 0.02 }, weekend: 0.05, partTime: 0.04, long: 0, median: 125000 },
  science: { shifts: { early: 0.08, day: 0.85, evening: 0.04, night: 0.03 }, weekend: 0.06, partTime: 0.08, long: 0, median: 100000 },
  social: { shifts: { early: 0.04, day: 0.78, mid: 0.08, evening: 0.1 }, weekend: 0.12, partTime: 0.14, long: 0, median: 68000 },
  legal: { shifts: { early: 0.03, day: 0.95, mid: 0.02 }, weekend: 0.05, partTime: 0.07, long: 0, median: 120000 },
  education: { shifts: { early: 0.25, day: 0.7, evening: 0.05 }, weekend: 0.03, partTime: 0.2, long: 0, median: 78000 },
  arts: { shifts: { early: 0.05, day: 0.45, mid: 0.2, evening: 0.22, night: 0.08 }, weekend: 0.35, partTime: 0.3, long: 0, median: 82000 },
  practitioner: { shifts: { early: 0.15, day: 0.58, evening: 0.12, night: 0.15 }, weekend: 0.35, partTime: 0.15, long: 0.38, median: 130000 },
  healthtech: { shifts: { early: 0.12, day: 0.53, evening: 0.17, night: 0.18 }, weekend: 0.4, partTime: 0.15, long: 0.3, median: 68000 },
  healthsupport: { shifts: { early: 0.12, day: 0.5, evening: 0.18, night: 0.2 }, weekend: 0.45, partTime: 0.25, long: 0.15, median: 42000 },
  firefighting: { shifts: { h24: 0.3, early: 0.08, day: 0.3, evening: 0.14, night: 0.18 }, weekend: 0.6, partTime: 0.12, long: 0.1, median: 62000 },
  police: { shifts: { early: 0.15, day: 0.35, evening: 0.27, night: 0.23 }, weekend: 0.5, partTime: 0.04, long: 0.2, median: 105000 },
  food: { shifts: { early: 0.16, day: 0.14, mid: 0.35, evening: 0.33, night: 0.02 }, weekend: 0.72, partTime: 0.45, long: 0, median: 36000 },
  cleaning: { shifts: { early: 0.27, day: 0.35, evening: 0.22, night: 0.16 }, weekend: 0.3, partTime: 0.25, long: 0, median: 41000 },
  personalcare: { shifts: { early: 0.06, day: 0.52, mid: 0.24, evening: 0.18 }, weekend: 0.45, partTime: 0.35, long: 0, median: 38000 },
  sales: { shifts: { early: 0.06, day: 0.43, mid: 0.27, evening: 0.24 }, weekend: 0.6, partTime: 0.33, long: 0, median: 52000 },
  office: { shifts: { early: 0.08, day: 0.86, mid: 0.02, evening: 0.04 }, weekend: 0.1, partTime: 0.15, long: 0, median: 52000 },
  farming: { shifts: { early: 0.85, day: 0.15 }, weekend: 0.35, partTime: 0.1, long: 0, median: 36000 },
  construction: { shifts: { early: 0.8, day: 0.2 }, weekend: 0.12, partTime: 0.07, long: 0, median: 62000 },
  repair: { shifts: { early: 0.35, day: 0.55, evening: 0.1 }, weekend: 0.15, partTime: 0.05, long: 0, median: 64000 },
  production: { shifts: { early: 0.35, day: 0.33, evening: 0.2, night: 0.12 }, weekend: 0.2, partTime: 0.06, long: 0.05, median: 46000 },
  transport: { shifts: { early: 0.4, day: 0.3, mid: 0.08, evening: 0.12, night: 0.1 }, weekend: 0.35, partTime: 0.12, long: 0, median: 55000 },
  moving: { shifts: { early: 0.3, day: 0.3, evening: 0.24, night: 0.16 }, weekend: 0.35, partTime: 0.2, long: 0.05, median: 42000 },
  military: { shifts: { early: 0.62, day: 0.38 }, weekend: 0.05, partTime: 0, long: 0, median: 60000 },
};

// ------------------------------------------------------------------ the catalog

const SH = { e: 'early', d: 'day', m: 'mid', v: 'evening', n: 'night', h: 'h24' };
const ED = Object.fromEntries(EDUCATION_LEVELS.map((k, i) => [k, i]));

// Titles whose education is a license or credential requirement (the degree is never missing), and the youngest
// age at which each level is usually finished
const LICENSED = new Set(['registered-nurse', 'telehealth-nurse', 'family-physician', 'er-physician', 'telemedicine-physician', 'pharmacist',
  'dentist', 'physical-therapist', 'nurse-practitioner', 'physician-assistant', 'respiratory-therapist', 'veterinarian', 'speech-pathologist',
  'occupational-therapist', 'chiropractor', 'lvn', 'rad-tech', 'dental-hygienist', 'sonographer', 'surgical-tech', 'paramedic', 'attorney', 'judge',
  'psychologist', 'family-therapist', 'architect', 'elementary-teacher', 'middle-school-teacher', 'high-school-teacher', 'special-ed-teacher',
  'school-counselor', 'school-principal', 'professor', 'cc-instructor', 'librarian', 'civil-engineer', 'mechanical-engineer', 'electrical-engineer',
  'aerospace-engineer', 'hardware-engineer', 'environmental-engineer', 'process-engineer', 'research-scientist', 'navy-officer',
  'marine-officer', 'army-officer', 'air-force-officer', 'space-force-officer', 'coast-guard-officer']);
const EDU_AGE = [16, 18, 19, 20, 22, 24, 25, 26];
const WAGE_FLOOR = 35200;   // every civilian catalog range starts at or above a full-time minimum-wage salary

/**
 * A title: t(key, title, sector, employers, [wageLo, wageHi], shifts ('edmvnh' letters), wfh (0 never, 1 possible,
 * 2 typical, 3 always: the work is at home, like a home daycare), minimum education, weight, affinities, female
 * share, minimum age). Affinities: r region multipliers (r0 for regions not listed), e establishment-share
 * exponents, and [where true, elsewhere] multipliers for coast, dense (urban) / rural, desert, snow, port, fire
 * (fire country), hot, inst. Licensed titles (LICENSED) hold their degree always, so they start no younger than it.
 * A military title (sector 'military') starts at federal basic pay (MIL_PAY_FLOOR) and carries its branch, the one
 * its employer names (MILITARY_BRANCHES).
 */
function t(key, title, sector, employers, wage, shifts, wfh, edu, weight, aff = {}, fs = 0.5, minAge = 16) {
  const list = Array.isArray(employers) ? employers : [employers], mil = sector === 'military';
  const e = ED[edu], licensed = LICENSED.has(key), lo = Math.max(wage[0], mil ? MIL_PAY_FLOOR : WAGE_FLOOR);
  return {
    key, title, sector, employers: list, wage: [lo, Math.max(wage[1], lo + 2000)],
    shifts: [...shifts].map(c => SH[c]), wfh, edu: e, licensed, weight, aff, fs, minAge: licensed ? Math.max(minAge, EDU_AGE[e]) : minAge,
    branch: mil ? BRANCH_OF_EMPLOYER[list[0]] || null : null,
  };
}

// Where the farming group's field titles are: in the fields (rural ZIPs, never a dense city ZIP, whose farming jobs
// are a plant nursery's or a wholesale produce market's)
const FIELD = [0.005, 1.15];
// Where each branch's members who work off base are found (an enlisted title and its branch's officers alike)
const MIL_AFF = {
  navy: { coast: [3, 0.2], r: { sd: 4, ba: 0.6, la: 0.6, cc: 0.6, sj: 0.6, ie: 0.3 } },
  marines: { r: { sd: 4, ie: 2, r0: 0.2 }, desert: [1.5, 1] },
  army: { desert: [3, 0.5], r: { cc: 1.2, si: 0.8 } },
  airforce: { r: { sv: 3, ba: 1.5, cc: 2, la: 1, ie: 1, sd: 0.4 }, desert: [2, 1] },
  spaceforce: { r: { cc: 4, la: 2, r0: 0.1 } },
  coastguard: { coast: [5, 0.05] },
};

const FARM_REGIONS_LOW = { la: 0.15, oc: 0.05, ba: 0.4 };

/** Job titles by occupation group (plus 'military'). */
export const OCCUPATION_CATALOG = {
  management: [
    t('general-manager', 'general manager', 'retail', ['a regional retail chain', 'a grocery store', 'a home improvement store'], [80000, 160000], 'ed', 1, 'hs', 3, { e: { retail: 0.6 } }),
    t('operations-manager', 'operations manager', 'logistics', ['a distribution company', 'a manufacturing plant', 'a food processor'], [90000, 170000], 'ed', 1, 'somecollege', 3, { e: { whse: 0.4, mfg: 0.4 } }),
    t('restaurant-manager', 'restaurant manager', 'food service', ['a family restaurant', 'a busy diner', 'a restaurant group'], [60000, 95000], 'mvd', 0, 'hs', 3, { e: { food: 0.7 } }),
    t('construction-manager', 'construction manager', 'construction', ['a general contractor', 'a homebuilder'], [100000, 185000], 'ed', 0, 'hs', 2, { e: { builders: 0.7 } }, 0.1, 25),
    t('property-manager', 'property manager', 'real estate', ['a property management company', 'an apartment complex'], [60000, 110000], 'd', 1, 'hs', 2, { dense: [1.4, 0.7] }, 0.55),
    t('financial-manager', 'financial manager', 'finance', ['a regional bank', 'a credit union', 'an insurance company', 'a hospital system'], [130000, 230000], 'd', 2, 'bachelor', 2, { e: { office: 0.6 } }, 0.5, 27),
    t('engineering-manager', 'engineering manager', 'technology', ['a software company', 'a chip company', 'a tech company'], [190000, 330000], 'd', 2, 'bachelor', 2, { r: { ba: 5, la: 1.2, sd: 1.3, oc: 1.2 }, e: { office: 0.5 } }, 0.25, 28),
    t('school-principal', 'school principal', 'education', ['a public elementary school', 'a public high school', 'the school district'], [130000, 190000], 'ed', 0, 'master', 1.5, { e: { school: 0.4 } }, 0.6, 32),
    t('hospital-administrator', 'hospital administrator', 'health care', ['a regional hospital', 'a medical center', 'a clinic network'], [120000, 220000], 'd', 1, 'bachelor', 1.2, { e: { health: 0.7 } }, 0.65, 28),
    t('farmer', 'farmer', 'agriculture', ['their family farm', 'their own orchard', 'their vineyard', 'their cattle ranch'], [60000, 150000], 'e', 2, 'hs', 2.5, { r: { sj: 5, sv: 4, cc: 3, nc: 2, fn: 3, si: 2, ie: 0.8, sd: 0.8, ...FARM_REGIONS_LOW }, dense: [0.05, 2.5] }, 0.2, 25),
    t('hotel-manager', 'hotel manager', 'hospitality', ['a hotel', 'a resort'], [65000, 120000], 'dv', 0, 'hs', 1, { e: { lodging: 1 } }),
    t('marketing-manager', 'marketing manager', 'marketing', ['a consumer brand', 'an advertising agency', 'a tech company'], [120000, 210000], 'd', 2, 'bachelor', 1.5, { dense: [1.4, 0.7], r: { ba: 1.6, la: 1.4 } }, 0.6, 26),
    t('business-owner', 'small business owner', 'small business', ['their own shop', 'a family business', 'their own contracting business'], [45000, 150000], 'edm', 1, 'hs', 2.5, {}, 0.35, 22),
    t('city-manager', 'city department manager', 'government', ['the city', 'the county'], [110000, 190000], 'd', 1, 'bachelor', 1.2, {}, 0.5, 30),
  ],
  business: [
    t('accountant', 'accountant', 'finance', ['an accounting firm', 'a regional bank', 'a hospital system', 'a property management company'], [70000, 130000], 'd', 2, 'bachelor', 3, { e: { office: 0.5 } }, 0.6),
    t('financial-analyst', 'financial analyst', 'finance', ['a bank', 'an investment firm', 'a tech company'], [85000, 160000], 'd', 2, 'bachelor', 2, { r: { ba: 1.6, la: 1.2 }, dense: [1.3, 0.7] }, 0.4),
    t('hr-specialist', 'human resources specialist', 'corporate', ['a hospital system', 'a staffing agency', 'a manufacturer', 'a school district'], [65000, 110000], 'd', 2, 'bachelor', 2.5, {}, 0.72),
    t('project-manager', 'project manager', 'professional services', ['an engineering firm', 'a construction company', 'a tech company'], [95000, 170000], 'd', 2, 'bachelor', 2.5, {}, 0.45),
    t('buyer', 'purchasing agent', 'wholesale', ['a grocery chain', 'a manufacturer', 'a school district'], [60000, 110000], 'd', 1, 'hs', 1.5, { e: { retail: 0.3, mfg: 0.3 } }),
    t('claims-adjuster', 'insurance claims adjuster', 'insurance', ['an insurance company'], [65000, 105000], 'd', 2, 'hs', 1.5, { e: { ins_agents: 0.6 }, fire: [1.4, 1] }, 0.55),
    t('loan-officer', 'loan officer', 'finance', ['a credit union', 'a mortgage lender', 'a bank'], [60000, 140000], 'd', 1, 'hs', 1.5),
    t('consultant', 'management consultant', 'consulting', ['a consulting firm'], [100000, 190000], 'd', 2, 'bachelor', 1.5, { dense: [1.5, 0.6] }, 0.45),
    t('market-research', 'market research analyst', 'marketing', ['a marketing firm', 'a consumer brand'], [70000, 130000], 'd', 2, 'bachelor', 1.5, { r: { la: 1.3, ba: 1.3 } }, 0.6),
    t('compliance-officer', 'compliance officer', 'finance', ['a bank', 'a health plan'], [75000, 130000], 'd', 2, 'bachelor', 1, {}, 0.55),
    t('event-planner', 'event planner', 'hospitality', ['a hotel', 'a wedding venue', 'an event company', 'a winery'], [50000, 85000], 'dv', 1, 'somecollege', 1, { e: { lodging: 0.8 } }, 0.8),
    t('logistics-analyst', 'logistics analyst', 'logistics', ['a distribution company', 'a shipping company'], [65000, 110000], 'd', 1, 'bachelor', 1.2, { e: { whse: 0.8 }, r: { ie: 1.8 }, port: [2, 1] }),
    t('farm-labor-contractor', 'farm labor contractor', 'agriculture', ['their own harvest crew business'], [45000, 90000], 'e', 0, 'hs', 0.6, { r: { sj: 6, cc: 4, sv: 3, sd: 1, ie: 1, r0: 0.1 } }, 0.2, 25),
    t('tax-preparer', 'tax preparer', 'finance', ['a tax preparation office', 'their own tax business'], [45000, 80000], 'd', 2, 'somecollege', 1, {}, 0.6),
  ],
  computer: [
    t('software-developer', 'software developer', 'technology', ['a software company', 'a tech startup', 'a big tech company', 'a fintech company'], [130000, 260000], 'dm', 2, 'bachelor', 5, { r: { ba: 3, la: 1.1, sd: 1.3, oc: 1.2, sv: 0.6, sj: 0.4, ie: 0.5, cc: 0.7, nc: 0.4, fn: 0.3, si: 0.4 }, e: { office: 0.4 } }, 0.25),
    t('web-developer', 'web developer', 'technology', ['a digital agency', 'a retailer', 'a media company'], [80000, 150000], 'dm', 2, 'somecollege', 1.5, {}, 0.35),
    t('it-support', 'IT support specialist', 'technology', ['a school district', 'a hospital', 'a managed IT firm', 'the county'], [55000, 95000], 'ed', 1, 'somecollege', 3, { r: { ba: 0.7 } }, 0.3),
    t('network-admin', 'network administrator', 'technology', ['a hospital system', 'a university', 'a telecom company'], [85000, 140000], 'd', 1, 'associate', 2, {}, 0.2),
    t('data-scientist', 'data scientist', 'technology', ['a tech company', 'a health insurer', 'a research lab'], [130000, 230000], 'd', 2, 'master', 1.5, { r: { ba: 3, la: 1.2, sd: 1.3 } }, 0.35),
    t('security-analyst', 'cybersecurity analyst', 'technology', ['a bank', 'a defense contractor', 'a tech company'], [110000, 190000], 'dn', 2, 'bachelor', 1.2, {}, 0.25),
    t('database-admin', 'database administrator', 'technology', ['a health system', 'a state agency'], [95000, 160000], 'd', 2, 'bachelor', 1, {}, 0.3),
    t('qa-engineer', 'QA engineer', 'technology', ['a software company', 'a game studio'], [90000, 160000], 'd', 2, 'bachelor', 1.2, { r: { ba: 2, la: 1.3, oc: 1.3 } }, 0.35),
    t('game-programmer', 'video game programmer', 'entertainment', ['a game studio'], [100000, 190000], 'dm', 2, 'bachelor', 0.6, { r: { la: 2.5, oc: 2.5, ba: 2, r0: 0.3 } }, 0.2),
    t('actuary', 'actuary', 'insurance', ['an insurance company', 'a pension fund'], [110000, 200000], 'd', 2, 'bachelor', 0.5, {}, 0.35),
  ],
  engineering: [
    t('civil-engineer', 'civil engineer', 'engineering', ['an engineering firm', 'the state transportation department', 'a water agency', 'the county public works department'], [95000, 170000], 'ed', 1, 'bachelor', 3, {}, 0.25),
    t('mechanical-engineer', 'mechanical engineer', 'manufacturing', ['an aerospace company', 'an equipment maker', 'an engineering firm'], [100000, 175000], 'd', 1, 'bachelor', 2.5, { e: { mfg: 0.5 } }, 0.15),
    t('electrical-engineer', 'electrical engineer', 'technology', ['a semiconductor company', 'the electric utility', 'an electronics maker'], [115000, 200000], 'd', 1, 'bachelor', 2, { r: { ba: 2.5, sd: 1.3, la: 1.1 } }, 0.15),
    t('aerospace-engineer', 'aerospace engineer', 'aerospace', ['an aerospace company', 'a defense contractor', 'a rocket company'], [120000, 200000], 'd', 1, 'bachelor', 1.2, { r: { la: 2.5, ba: 1.2, sd: 1.3, cc: 1.4, oc: 1.2, r0: 0.4 }, desert: [2, 1] }, 0.15),
    t('hardware-engineer', 'hardware engineer', 'technology', ['a chip company', 'a device maker'], [140000, 240000], 'd', 1, 'bachelor', 1, { r: { ba: 4, sd: 1.5, oc: 1, la: 0.8, r0: 0.25 } }, 0.15),
    t('architect', 'architect', 'design', ['an architecture firm'], [90000, 170000], 'd', 2, 'master', 1.2, { dense: [1.5, 0.7] }, 0.35),
    t('drafter', 'CAD drafter', 'engineering', ['an engineering firm', 'an architecture firm', 'a homebuilder'], [60000, 95000], 'd', 1, 'associate', 1.5, {}, 0.3),
    t('engineering-tech', 'engineering technician', 'manufacturing', ['an electronics plant', 'a test lab', 'a utility'], [60000, 100000], 'edv', 0, 'associate', 2, { e: { mfg: 0.6 } }, 0.2),
    t('surveyor', 'land surveyor', 'engineering', ['a surveying firm', 'the county'], [75000, 130000], 'ed', 0, 'associate', 1, { dense: [0.8, 1.3] }, 0.1),
    t('environmental-engineer', 'environmental engineer', 'engineering', ['a water agency', 'an environmental consulting firm'], [95000, 160000], 'd', 1, 'bachelor', 1, {}, 0.35),
    t('process-engineer', 'process engineer', 'manufacturing', ['an oil refinery', 'a food processing plant', 'a semiconductor fab'], [100000, 170000], 'ed', 0, 'bachelor', 1, { e: { mfg: 0.7 } }, 0.25),
  ],
  science: [
    t('lab-technician', 'lab technician', 'research', ['a biotech lab', 'a university lab', 'a water quality lab'], [50000, 85000], 'ed', 0, 'associate', 3, { r: { ba: 1.6, sd: 1.6 } }, 0.55),
    t('research-scientist', 'research scientist', 'biotech', ['a biotech company', 'a university', 'a national lab'], [100000, 190000], 'd', 1, 'doctorate', 1.5, { r: { ba: 2.2, sd: 2.2, la: 1.2, oc: 1 } }, 0.45, 26),
    t('environmental-scientist', 'environmental scientist', 'government', ['a state agency', 'a water district', 'an environmental consulting firm'], [80000, 130000], 'ed', 1, 'bachelor', 2, {}, 0.5),
    t('agricultural-inspector', 'agricultural inspector', 'agriculture', ['the county agriculture department'], [55000, 85000], 'ed', 0, 'somecollege', 1.5, { r: { sj: 4, sv: 3, cc: 3, ie: 1.2, sd: 1, ...FARM_REGIONS_LOW } }, 0.4),
    t('forester', 'forester', 'forestry', ['the forest service', 'a timber company', 'the state forestry agency'], [65000, 105000], 'ed', 0, 'bachelor', 1, { r: { nc: 6, fn: 6, si: 5, sv: 1, r0: 0.15 } }, 0.25),
    t('psychologist', 'clinical psychologist', 'health care', ['a private practice', 'a county mental health clinic'], [110000, 180000], 'd', 2, 'doctorate', 1.2, {}, 0.7, 27),
    t('chemist', 'chemist', 'manufacturing', ['a pharmaceutical company', 'a refinery lab', 'a cosmetics maker'], [75000, 130000], 'd', 0, 'bachelor', 1, {}, 0.45),
    t('geologist', 'geologist', 'energy', ['an engineering firm', 'an oil company', 'the state geological survey'], [90000, 150000], 'd', 1, 'bachelor', 0.8, { r: { sj: 2 } }, 0.3),
    t('urban-planner', 'urban planner', 'government', ['the city planning department', 'a regional transportation agency'], [85000, 135000], 'd', 1, 'master', 1, { dense: [1.3, 0.8] }, 0.5),
    t('food-scientist', 'food scientist', 'food processing', ['a food processing company', 'a winery lab'], [75000, 125000], 'd', 0, 'bachelor', 0.8, { r: { sj: 2, sv: 1.5, cc: 1.5 } }, 0.55),
    t('wildlife-biologist', 'fish and wildlife biologist', 'government', ['the state fish and wildlife department', 'a national park'], [75000, 120000], 'ed', 0, 'bachelor', 0.8, { r: { nc: 3, fn: 3, si: 3, r0: 0.6 } }, 0.45),
    t('economist', 'economist', 'government', ['a state agency', 'a university research center'], [100000, 170000], 'd', 2, 'master', 0.5, { r: { sv: 2, ba: 1.5 } }, 0.35),
  ],
  social: [
    t('social-worker', 'social worker', 'social services', ['the county social services department', 'a nonprofit agency', 'a hospital'], [65000, 105000], 'd', 1, 'bachelor', 4, {}, 0.8),
    t('substance-counselor', 'substance abuse counselor', 'health care', ['a treatment center', 'a nonprofit clinic'], [50000, 80000], 'dv', 0, 'somecollege', 2.5, {}, 0.65),
    t('school-counselor', 'school counselor', 'education', ['a public high school', 'a middle school'], [75000, 115000], 'ed', 0, 'master', 2, {}, 0.75),
    t('case-manager', 'case manager', 'social services', ['a housing nonprofit', 'a county agency', 'a senior services center'], [50000, 80000], 'd', 1, 'bachelor', 2.5, {}, 0.75),
    t('pastor', 'pastor', 'religion', ['a neighborhood church', 'a local congregation'], [45000, 90000], 'dv', 1, 'bachelor', 1.2, { e: { church: 1 } }, 0.2, 25),
    t('youth-coordinator', 'youth program coordinator', 'nonprofit', ['a community center', 'a youth nonprofit', 'the city recreation department'], [45000, 70000], 'dmv', 0, 'somecollege', 1.5, {}, 0.6),
    t('probation-officer', 'probation officer', 'government', ['the county probation department'], [75000, 120000], 'd', 0, 'bachelor', 1.5, {}, 0.5),
    t('community-health-worker', 'community health worker', 'health care', ['a community clinic', 'the county health department'], [45000, 70000], 'd', 0, 'hs', 1.5, {}, 0.75),
    t('family-therapist', 'marriage and family therapist', 'health care', ['a private practice', 'a community clinic'], [70000, 120000], 'dv', 2, 'master', 1.5, {}, 0.8),
  ],
  legal: [
    t('attorney', 'attorney', 'legal', ['a law firm', "the public defender's office", "the district attorney's office", 'a corporate legal department'], [130000, 320000], 'd', 2, 'professional', 4, { dense: [1.4, 0.7] }, 0.42, 26),
    t('paralegal', 'paralegal', 'legal', ['a law firm', 'a corporate legal department', 'an immigration law office'], [60000, 95000], 'd', 2, 'associate', 4, {}, 0.8),
    t('judge', 'judge', 'government', ['the superior court'], [200000, 260000], 'd', 0, 'professional', 0.3, {}, 0.4, 40),
    t('court-reporter', 'court reporter', 'legal', ['the superior court', 'a court reporting firm'], [70000, 120000], 'd', 1, 'associate', 0.8, {}, 0.8),
    t('title-examiner', 'title examiner', 'real estate', ['a title company'], [55000, 90000], 'd', 2, 'hs', 0.8, {}, 0.7),
    t('legal-assistant', 'legal assistant', 'legal', ['a family law office', 'a personal injury firm', 'a legal aid office'], [50000, 75000], 'd', 1, 'somecollege', 2, {}, 0.8),
  ],
  education: [
    t('elementary-teacher', 'elementary school teacher', 'education', ['a public elementary school', 'a charter school', 'a parochial school'], [70000, 115000], 'ed', 0, 'bachelor', 5, {}, 0.85),
    t('middle-school-teacher', 'middle school teacher', 'education', ['a public middle school'], [72000, 118000], 'ed', 0, 'bachelor', 3, {}, 0.7),
    t('high-school-teacher', 'high school teacher', 'education', ['a public high school', 'a charter high school'], [75000, 125000], 'ed', 0, 'bachelor', 4, {}, 0.6),
    t('special-ed-teacher', 'special education teacher', 'education', ['a public elementary school', 'a public high school'], [75000, 120000], 'ed', 0, 'bachelor', 1.5, {}, 0.8),
    t('preschool-teacher', 'preschool teacher', 'education', ['a preschool', 'a Head Start center', 'a church preschool'], [38000, 55000], 'ed', 0, 'somecollege', 3, {}, 0.95),
    t('teaching-assistant', 'teaching assistant', 'education', ['a public elementary school', 'a public middle school'], [35000, 50000], 'ed', 0, 'hs', 3, {}, 0.85),
    t('professor', 'professor', 'higher education', ['a state university', 'a research university', 'a private college'], [90000, 200000], 'dm', 1, 'doctorate', 1.5, { e: { school: 0.6 } }, 0.45, 28),
    t('cc-instructor', 'community college instructor', 'higher education', ['a community college'], [70000, 120000], 'dv', 1, 'master', 1.5, {}, 0.5),
    t('tutor', 'tutor', 'education', ['a tutoring center', 'their own tutoring business', 'an online tutoring service'], [35000, 65000], 'mv', 2, 'somecollege', 1.2, {}, 0.6),
    t('librarian', 'librarian', 'government', ['the public library', 'a school library', 'a university library'], [70000, 110000], 'd', 0, 'master', 1, {}, 0.8),
    t('substitute-teacher', 'substitute teacher', 'education', ['the school district'], [35000, 60000], 'ed', 0, 'bachelor', 1.5, {}, 0.65),
  ],
  arts: [
    t('graphic-designer', 'graphic designer', 'design', ['a design studio', 'an advertising agency', 'a print shop'], [55000, 100000], 'dm', 2, 'bachelor', 3, {}, 0.55),
    t('film-grip', 'film crew grip', 'entertainment', ['a film and TV production company', 'a studio lot'], [60000, 120000], 'edn', 0, 'hs', 1.2, { r: { la: 9, ba: 0.6, r0: 0.05 } }, 0.15),
    t('video-editor', 'video editor', 'entertainment', ['a post-production house', 'a streaming studio', 'a TV station'], [70000, 140000], 'dm', 2, 'bachelor', 1, { r: { la: 6, ba: 1, r0: 0.4 } }, 0.35),
    t('actor', 'actor', 'entertainment', ['film and TV productions', 'a theater company'], [25000, 120000], 'mv', 0, 'somecollege', 0.6, { r: { la: 8, ba: 0.6, r0: 0.1 } }, 0.5),
    t('writer', 'writer', 'media', ['a streaming studio', 'a magazine', 'freelance clients'], [55000, 140000], 'dm', 2, 'bachelor', 1.2, { r: { la: 3, ba: 1.5 } }, 0.55),
    t('musician', 'musician', 'entertainment', ['local venues', 'a recording studio', 'a church'], [25000, 80000], 'vn', 1, 'hs', 1, {}, 0.3),
    t('photographer', 'photographer', 'media', ['a wedding photography business', 'a local news outlet', 'their own studio'], [40000, 85000], 'dv', 1, 'somecollege', 1.2, {}, 0.5),
    t('reporter', 'news reporter', 'media', ['a local newspaper', 'a TV station', 'a public radio station'], [55000, 100000], 'dm', 1, 'bachelor', 1, {}, 0.5),
    t('interior-designer', 'interior designer', 'design', ['a design firm', 'a furniture store'], [60000, 105000], 'd', 1, 'bachelor', 0.8, {}, 0.8),
    t('coach', 'high school coach', 'sports', ['a high school', 'a youth sports club'], [35000, 75000], 'mv', 0, 'bachelor', 1.2, {}, 0.35),
    t('animator', 'animator', 'entertainment', ['an animation studio', 'a game studio'], [85000, 160000], 'dm', 2, 'bachelor', 0.7, { r: { la: 5, ba: 2.5, r0: 0.2 } }, 0.4),
    t('sound-engineer', 'sound engineer', 'entertainment', ['a live venue', 'a recording studio', 'a production company'], [50000, 110000], 'mvn', 0, 'somecollege', 0.8, { r: { la: 3 } }, 0.2),
    t('set-builder', 'set carpenter', 'entertainment', ['a studio lot', 'a theme park'], [55000, 100000], 'ed', 0, 'hs', 0.5, { r: { la: 6, oc: 1.5, r0: 0.05 } }, 0.15),
  ],
  practitioner: [
    t('registered-nurse', 'registered nurse', 'health care', ['a regional hospital', 'a medical center', 'a county hospital', 'a dialysis clinic'], [110000, 190000], 'edvn', 0, 'associate', 8, { e: { health: 0.3 } }, 0.88),
    t('family-physician', 'family physician', 'health care', ['a medical group', 'a community clinic'], [220000, 340000], 'd', 0, 'professional', 2, {}, 0.45, 28),
    t('er-physician', 'emergency physician', 'health care', ['a regional hospital', 'a trauma center'], [280000, 420000], 'edvn', 0, 'professional', 0.6, {}, 0.35, 29),
    t('pharmacist', 'pharmacist', 'health care', ['a drugstore pharmacy', 'a hospital pharmacy'], [140000, 180000], 'dmv', 0, 'professional', 1.5, {}, 0.6, 25),
    t('dentist', 'dentist', 'health care', ['their own dental practice', 'a dental group'], [160000, 300000], 'd', 0, 'professional', 1, {}, 0.4, 26),
    t('physical-therapist', 'physical therapist', 'health care', ['an outpatient clinic', 'a hospital', 'a sports medicine practice'], [100000, 140000], 'd', 0, 'doctorate', 1.5, {}, 0.65),
    t('nurse-practitioner', 'nurse practitioner', 'health care', ['a community clinic', 'an urgent care', 'a medical group'], [140000, 190000], 'd', 0, 'master', 1.5, {}, 0.9),
    t('physician-assistant', 'physician assistant', 'health care', ['an urgent care', 'a medical group'], [130000, 170000], 'dv', 0, 'master', 1, {}, 0.7),
    t('respiratory-therapist', 'respiratory therapist', 'health care', ['a regional hospital', 'a children\'s hospital'], [90000, 130000], 'edvn', 0, 'associate', 1.2, {}, 0.6),
    t('veterinarian', 'veterinarian', 'animal care', ['an animal hospital', 'a large-animal practice'], [120000, 200000], 'd', 0, 'professional', 0.8, { r: { sj: 1.3 } }, 0.65, 26),
    t('speech-pathologist', 'speech-language pathologist', 'health care', ['the school district', 'a pediatric clinic'], [95000, 140000], 'ed', 0, 'master', 1, {}, 0.95),
    t('occupational-therapist', 'occupational therapist', 'health care', ['a rehabilitation hospital', 'the school district'], [95000, 135000], 'd', 0, 'master', 0.8, {}, 0.85),
    t('chiropractor', 'chiropractor', 'health care', ['their own practice'], [70000, 140000], 'd', 0, 'professional', 0.5, {}, 0.3),
    t('telehealth-nurse', 'telehealth nurse', 'health care', ["a health plan's nurse advice line", 'a telehealth service', 'a hospital system'], [110000, 160000], 'dvn', 2, 'associate', 0.5, {}, 0.9),
    t('telemedicine-physician', 'telemedicine physician', 'health care', ['a telehealth service', 'a medical group'], [220000, 320000], 'dv', 2, 'professional', 0.25, {}, 0.5, 30),
  ],
  healthtech: [
    t('lvn', 'licensed vocational nurse', 'health care', ['a skilled nursing facility', 'a clinic', 'a home health agency', 'a state prison clinic'], [60000, 85000], 'edvn', 0, 'somecollege', 5, { inst: [1.6, 1] }, 0.85),
    t('pharmacy-tech', 'pharmacy technician', 'health care', ['a drugstore pharmacy', 'a hospital pharmacy'], [42000, 60000], 'dmv', 0, 'hs', 3, {}, 0.75),
    t('emt', 'EMT', 'emergency services', ['a private ambulance company', 'the county EMS agency'], [40000, 60000], 'edvnh', 0, 'somecollege', 2, {}, 0.35),
    t('paramedic', 'paramedic', 'emergency services', ['an ambulance company', 'the fire department'], [60000, 95000], 'hen', 0, 'associate', 1.5, {}, 0.3),
    t('rad-tech', 'radiologic technologist', 'health care', ['a hospital', 'an imaging center'], [85000, 125000], 'dvn', 0, 'associate', 1.5, {}, 0.65),
    t('surgical-tech', 'surgical technologist', 'health care', ['a hospital', 'a surgery center'], [65000, 90000], 'ed', 0, 'associate', 1, {}, 0.75),
    t('dental-hygienist', 'dental hygienist', 'health care', ['a dental office'], [100000, 140000], 'd', 0, 'associate', 1.5, {}, 0.95),
    t('lab-tech-medical', 'medical lab technician', 'health care', ['a hospital lab', 'a clinical lab'], [60000, 95000], 'dvn', 0, 'associate', 1.2, {}, 0.7),
    t('sonographer', 'ultrasound technician', 'health care', ['a hospital', 'an imaging center'], [90000, 125000], 'd', 0, 'associate', 0.8, {}, 0.8),
    t('medical-records', 'medical records specialist', 'health care', ['a hospital', 'a medical group'], [45000, 70000], 'd', 2, 'somecollege', 1.5, {}, 0.85),
    t('vet-tech', 'veterinary technician', 'animal care', ['an animal hospital'], [42000, 60000], 'dv', 0, 'associate', 1, {}, 0.9),
    t('optician', 'optician', 'health care', ['an eyeglass shop', 'an optometry office'], [40000, 60000], 'dm', 0, 'hs', 0.6, {}, 0.6),
  ],
  healthsupport: [
    t('home-health-aide', 'home health aide', 'home care', ['a home care agency', 'the county in-home supportive services program'], [34000, 42000], 'edv', 0, 'nohs', 6, {}, 0.85),
    t('cna', 'certified nursing assistant', 'health care', ['a skilled nursing facility', 'a hospital', 'an assisted living home'], [38000, 50000], 'edvn', 0, 'hs', 5, {}, 0.85),
    t('medical-assistant', 'medical assistant', 'health care', ['a medical office', 'a community clinic', 'an urgent care'], [40000, 52000], 'd', 0, 'hs', 5, {}, 0.9),
    t('dental-assistant', 'dental assistant', 'health care', ['a dental office'], [42000, 55000], 'd', 0, 'hs', 2.5, {}, 0.92),
    t('phlebotomist', 'phlebotomist', 'health care', ['a clinical lab', 'a hospital'], [42000, 55000], 'ed', 0, 'hs', 1.2, {}, 0.8),
    t('caregiver', 'caregiver', 'home care', ['an assisted living home', 'a residential care home', 'a memory care home'], [33000, 42000], 'edvn', 0, 'nohs', 3, {}, 0.8),
    t('pt-aide', 'physical therapy aide', 'health care', ['an outpatient clinic'], [35000, 45000], 'd', 0, 'hs', 0.8, {}, 0.6),
    t('psych-tech', 'psychiatric technician', 'health care', ['a state hospital', 'a behavioral health center'], [55000, 80000], 'edvn', 0, 'somecollege', 0.8, { inst: [3, 1] }, 0.55),
    t('vet-assistant', 'veterinary assistant', 'animal care', ['an animal hospital', 'a boarding kennel'], [34000, 42000], 'd', 0, 'hs', 0.8, {}, 0.8),
    t('family-caregiver', 'in-home caregiver for a family member', 'home care', ['the county in-home supportive services program'], [35200, 45000], 'edv', 3, 'nohs', 1.2, {}, 0.8, 18),
    t('medical-transcriptionist', 'medical transcriptionist', 'health care', ['a medical transcription service', 'a hospital system', 'a radiology group'], [40000, 58000], 'dm', 2, 'somecollege', 0.4, {}, 0.85),
  ],
  firefighting: [
    t('security-guard', 'security guard', 'security', ['a security company', 'a hospital', 'a shopping center', 'an office tower', 'a construction site'], [36000, 52000], 'edvn', 0, 'hs', 6, { dense: [1.3, 0.7] }, 0.25),
    t('firefighter', 'firefighter', 'fire service', ['the city fire department', 'the county fire department'], [85000, 150000], 'h', 0, 'somecollege', 3, {}, 0.06),
    t('wildland-firefighter', 'wildland firefighter', 'fire service', ['the state fire agency', 'the forest service'], [50000, 95000], 'he', 0, 'hs', 1.5, { fire: [3, 0.4], dense: [0.3, 1.8] }, 0.1),
    t('fire-captain', 'fire captain', 'fire service', ['the city fire department', 'the county fire department'], [120000, 180000], 'h', 0, 'somecollege', 0.6, {}, 0.05, 32),
    t('lifeguard', 'lifeguard', 'recreation', ['the county beaches department', 'a city pool', 'a water park'], [36000, 55000], 'd', 0, 'hs', 0.6, { coast: [3, 0.6] }, 0.45),
    t('crossing-guard', 'crossing guard', 'education', ['the school district', 'the city'], [30000, 38000], 'e', 0, 'hs', 0.6, { dense: [1.3, 0.7] }, 0.6, 18),
    t('tsa-officer', 'airport security screener', 'government', ['the airport security checkpoint'], [45000, 65000], 'edvn', 0, 'hs', 0.6, { dense: [1.2, 0.6] }, 0.45),
    t('animal-control', 'animal control officer', 'government', ['the county animal services department'], [50000, 75000], 'd', 0, 'hs', 0.4, {}, 0.5),
    t('loss-prevention', 'loss prevention officer', 'retail', ['a department store', 'a big-box store'], [38000, 52000], 'dmv', 0, 'hs', 0.8, { e: { retail: 0.8 } }, 0.35),
    t('fire-inspector', 'fire inspector', 'fire service', ['the city fire department'], [80000, 120000], 'd', 0, 'associate', 0.4, {}, 0.15),
    t('alarm-monitor', 'security alarm monitor', 'security', ['a security monitoring company'], [38000, 54000], 'edvn', 1, 'hs', 0.4, {}, 0.45),
  ],
  police: [
    t('police-officer', 'police officer', 'law enforcement', ['the city police department'], [95000, 160000], 'edvn', 0, 'somecollege', 4, { dense: [1.3, 0.6] }, 0.15),
    t('sheriffs-deputy', "sheriff's deputy", 'law enforcement', ["the county sheriff's department"], [90000, 150000], 'edvn', 0, 'somecollege', 3, { dense: [0.7, 1.6] }, 0.18),
    t('correctional-officer', 'correctional officer', 'corrections', ['a state prison', 'the county jail'], [75000, 120000], 'edvn', 0, 'hs', 2.5, { inst: [6, 0.5] }, 0.25),
    t('detective', 'detective', 'law enforcement', ['the city police department', "the county sheriff's department"], [110000, 170000], 'dv', 0, 'somecollege', 1, {}, 0.2, 30),
    t('highway-patrol', 'highway patrol officer', 'law enforcement', ['the state highway patrol'], [95000, 150000], 'edvn', 0, 'somecollege', 1.2, {}, 0.1),
    t('game-warden', 'fish and game warden', 'law enforcement', ['the state fish and wildlife department'], [80000, 120000], 'ed', 0, 'bachelor', 0.3, { dense: [0.3, 2.5] }, 0.15),
    t('transit-police', 'transit police officer', 'law enforcement', ['the transit agency'], [90000, 140000], 'dvn', 0, 'somecollege', 0.3, { dense: [3, 0.1] }, 0.2),
  ],
  food: [
    t('line-cook', 'line cook', 'restaurants', ['a family restaurant', 'a taqueria', 'a hotel kitchen', 'a busy diner', 'a pho place'], [36000, 50000], 'emvn', 0, 'nohs', 6, {}, 0.3),
    t('fast-food', 'fast food worker', 'restaurants', ['a burger stand', 'a fried chicken counter', 'a pizza place', 'a sandwich shop'], [33000, 40000], 'emvn', 0, 'nohs', 6, {}, 0.6),
    t('server', 'server', 'restaurants', ['a family restaurant', 'a steakhouse', 'a diner', 'a hotel restaurant', 'a sushi bar'], [35000, 60000], 'mv', 0, 'hs', 5, {}, 0.7),
    t('barista', 'barista', 'cafes', ['a neighborhood coffee shop', 'a coffee bar', 'a bakery cafe'], [33000, 42000], 'em', 0, 'hs', 3, { dense: [1.4, 0.8] }, 0.65),
    t('bartender', 'bartender', 'bars', ['a neighborhood bar', 'a brewpub', 'a hotel bar', 'a winery tasting room'], [38000, 70000], 'vn', 0, 'hs', 2, {}, 0.55),
    t('dishwasher', 'dishwasher', 'restaurants', ['a restaurant kitchen', 'a hotel kitchen'], [33000, 39000], 'mvn', 0, 'nohs', 2.5, {}, 0.25),
    t('prep-cook', 'prep cook', 'restaurants', ['a restaurant', 'a catering kitchen'], [34000, 44000], 'em', 0, 'nohs', 2.5, {}, 0.4),
    t('chef', 'chef', 'restaurants', ['a restaurant', 'a hotel', 'a country club'], [55000, 90000], 'mv', 0, 'hs', 1.2, { dense: [1.3, 0.8] }, 0.25, 22),
    t('food-truck-cook', 'food truck cook', 'street food', ['a taco truck', 'a family food truck'], [32000, 50000], 'mvn', 0, 'nohs', 1.2, { dense: [1.3, 0.7] }, 0.35),
    t('cafeteria-cook', 'cafeteria cook', 'education', ['a school district kitchen', 'a hospital cafeteria'], [34000, 46000], 'e', 0, 'nohs', 1.2, {}, 0.7),
    t('host', 'restaurant host', 'restaurants', ['a family restaurant', 'a steakhouse'], [33000, 38000], 'mv', 0, 'hs', 1.2, {}, 0.75),
    t('baker-cafe', 'pastry cook', 'restaurants', ['a panadería', 'a neighborhood bakery', 'a hotel kitchen'], [35000, 50000], 'e', 0, 'nohs', 0.8, {}, 0.55),
    t('cottage-baker', 'home baker', 'cottage food', ['their own cottage food kitchen'], [35200, 52000], 'em', 3, 'nohs', 0.4, {}, 0.75),
  ],
  cleaning: [
    t('janitor', 'janitor', 'building services', ['a janitorial contractor', 'a school district', 'an office building', 'a hospital'], [36000, 50000], 'evn', 0, 'nohs', 6, {}, 0.4),
    t('hotel-housekeeper', 'hotel housekeeper', 'hospitality', ['a hotel', 'a resort', 'a casino hotel'], [36000, 46000], 'ed', 0, 'nohs', 3, { e: { lodging: 1 }, snow: [1.8, 1] }, 0.85),
    t('house-cleaner', 'house cleaner', 'home services', ['their own cleaning business', 'a cleaning service'], [32000, 50000], 'ed', 0, 'nohs', 3, {}, 0.85),
    t('landscaper', 'landscaper', 'landscaping', ['a landscaping company', 'their own gardening route'], [36000, 55000], 'ed', 0, 'nohs', 5, {}, 0.05),
    t('tree-trimmer', 'tree trimmer', 'landscaping', ['a tree service', 'a utility vegetation contractor'], [42000, 65000], 'e', 0, 'nohs', 1.2, { fire: [1.5, 1] }, 0.05),
    t('groundskeeper', 'groundskeeper', 'grounds', ['a golf course', 'the parks department', 'a university', 'a cemetery'], [38000, 55000], 'ed', 0, 'hs', 1.5, {}, 0.15),
    t('pest-control', 'pest control technician', 'home services', ['a pest control company'], [42000, 60000], 'ed', 0, 'hs', 0.8, {}, 0.1),
    t('pool-tech', 'pool service technician', 'home services', ['a pool service'], [38000, 55000], 'ed', 0, 'hs', 0.6, { hot: [2, 0.8] }, 0.1),
  ],
  personalcare: [
    t('childcare-worker', 'childcare worker', 'childcare', ['a daycare center', 'a preschool', 'an after-school program'], [33000, 42000], 'ed', 0, 'hs', 4, {}, 0.92),
    t('family-childcare', 'family childcare provider', 'childcare', ['their own home daycare'], [35000, 60000], 'ed', 3, 'hs', 2, {}, 0.97, 21),
    t('hairstylist', 'hairstylist', 'personal services', ['a hair salon', 'their own salon chair'], [32000, 70000], 'dm', 0, 'hs', 3, {}, 0.85),
    t('barber', 'barber', 'personal services', ['a neighborhood barbershop'], [32000, 65000], 'dm', 0, 'hs', 1.5, {}, 0.15),
    t('nail-technician', 'nail technician', 'personal services', ['a nail salon'], [32000, 45000], 'dm', 0, 'nohs', 2, {}, 0.85),
    t('fitness-trainer', 'fitness trainer', 'fitness', ['a gym', 'a yoga studio', 'their own training business'], [38000, 75000], 'emv', 0, 'hs', 2, {}, 0.5),
    t('recreation-leader', 'recreation leader', 'recreation', ['the city parks and recreation department', 'a summer camp', 'a community center'], [33000, 45000], 'mv', 0, 'hs', 1.5, {}, 0.55),
    t('amusement-attendant', 'amusement park attendant', 'recreation', ['a theme park', 'a water park', 'a county fair'], [33000, 40000], 'dmv', 0, 'hs', 1, { r: { oc: 3, la: 2, sd: 1.5, ie: 1.2 } }, 0.5),
    t('ski-lift-operator', 'ski lift operator', 'recreation', ['a ski resort'], [36000, 48000], 'ed', 0, 'hs', 0.4, { snow: [40, 0.02] }, 0.3),
    t('ski-instructor', 'ski instructor', 'recreation', ['a ski resort'], [35000, 60000], 'ed', 0, 'hs', 0.3, { snow: [40, 0.02] }, 0.4),
    t('dog-groomer', 'dog groomer', 'pet care', ['a pet grooming salon', 'their own mobile grooming van'], [33000, 50000], 'd', 0, 'hs', 1, {}, 0.8),
    t('tour-guide', 'tour guide', 'tourism', ['a tour company', 'a winery', 'a park concessioner'], [35000, 55000], 'dm', 0, 'hs', 0.5, { e: { lodging: 1 } }, 0.5),
    t('casino-dealer', 'casino dealer', 'gaming', ['a tribal casino', 'a card room'], [35000, 60000], 'mvn', 0, 'hs', 0.5, {}, 0.45),
    t('funeral-attendant', 'funeral attendant', 'personal services', ['a funeral home'], [35000, 48000], 'd', 0, 'hs', 0.3, {}, 0.4),
  ],
  sales: [
    t('cashier', 'cashier', 'retail', ['a grocery store', 'a drugstore', 'a gas station convenience store', 'a big-box store'], [33000, 40000], 'emvn', 0, 'nohs', 6, { e: { retail: 0.3 } }, 0.7),
    t('retail-sales', 'retail sales associate', 'retail', ['a clothing store', 'a home improvement store', 'a department store', 'an electronics store'], [33000, 48000], 'dmv', 0, 'hs', 6, { e: { retail: 0.4 } }, 0.55),
    t('sales-rep', 'sales representative', 'wholesale', ['a food distributor', 'an industrial supplier', 'a medical device company', 'a beverage distributor'], [60000, 140000], 'd', 1, 'somecollege', 3, {}, 0.3),
    t('real-estate-agent', 'real estate agent', 'real estate', ['a real estate brokerage'], [45000, 160000], 'dm', 1, 'somecollege', 2.5, {}, 0.6, 21),
    t('insurance-agent', 'insurance agent', 'insurance', ['an independent insurance agency'], [50000, 110000], 'd', 1, 'somecollege', 1.5, { e: { ins_agents: 1 } }, 0.55),
    t('store-supervisor', 'store supervisor', 'retail', ['a grocery store', 'a pharmacy', 'a clothing store'], [45000, 70000], 'edm', 0, 'hs', 2.5, {}, 0.5),
    t('car-salesperson', 'car salesperson', 'auto retail', ['a car dealership'], [45000, 110000], 'dm', 0, 'hs', 1.5, { e: { auto: 1 } }, 0.15),
    t('account-executive', 'account executive', 'technology', ['a software company', 'a cloud services company'], [100000, 220000], 'd', 2, 'bachelor', 1.5, { r: { ba: 3, la: 1.3, oc: 1.2, sd: 1.2 } }, 0.4),
    t('parts-counter', 'parts counter clerk', 'auto parts', ['an auto parts store'], [35000, 48000], 'dm', 0, 'hs', 1, { e: { auto: 0.8 } }, 0.2),
    t('street-vendor', 'street vendor', 'street food', ['their own fruit cart', 'their own elote cart'], [20000, 40000], 'mv', 0, 'nohs', 0.8, { dense: [1.6, 0.4] }, 0.5),
    t('solar-sales', 'solar sales consultant', 'energy', ['a solar installer'], [50000, 110000], 'd', 1, 'hs', 0.6, { e: { solar_co: 1.5 } }, 0.3),
    t('phone-store', 'mobile phone sales associate', 'retail', ['a phone store'], [36000, 55000], 'dmv', 0, 'hs', 1, {}, 0.4),
  ],
  office: [
    t('office-clerk', 'office clerk', 'administration', ['a medical office', 'a city office', 'an insurance office'], [40000, 55000], 'd', 1, 'hs', 5, {}, 0.75),
    t('admin-assistant', 'administrative assistant', 'administration', ['a law office', 'the school district office', 'a property management firm', 'a hospital'], [48000, 70000], 'd', 1, 'hs', 5, {}, 0.85),
    t('receptionist', 'receptionist', 'administration', ['a medical office', 'a dental office', 'a hotel front desk', 'a law firm'], [38000, 50000], 'd', 0, 'hs', 3, {}, 0.88),
    t('customer-service', 'customer service representative', 'customer service', ['a call center', 'the gas and electric utility', 'an airline', 'an online retailer'], [40000, 58000], 'dmv', 2, 'hs', 5, {}, 0.65),
    t('bookkeeper', 'bookkeeper', 'finance', ['a small business', 'an accounting office'], [48000, 70000], 'd', 2, 'hs', 3, {}, 0.85),
    t('shipping-clerk', 'shipping and receiving clerk', 'logistics', ['a warehouse', 'a distribution center'], [40000, 52000], 'ed', 0, 'hs', 2.5, { e: { whse: 1 } }, 0.35),
    t('dispatcher', 'dispatcher', 'logistics', ['a trucking company', 'the 911 dispatch center', 'a towing company'], [48000, 80000], 'dvn', 0, 'hs', 1.5, {}, 0.6),
    t('bank-teller', 'bank teller', 'finance', ['a bank branch', 'a credit union'], [38000, 48000], 'd', 0, 'hs', 1.5, {}, 0.8),
    t('mail-carrier', 'mail carrier', 'postal service', ['the post office'], [55000, 75000], 'ed', 0, 'hs', 1.5, {}, 0.4),
    t('stock-clerk', 'stock clerk', 'retail', ['a grocery store', 'a big-box store'], [36000, 48000], 'en', 0, 'hs', 3, {}, 0.35),
    t('medical-secretary', 'medical secretary', 'health care', ['a hospital', 'a medical group'], [45000, 62000], 'd', 1, 'hs', 2, {}, 0.92),
    t('payroll-clerk', 'payroll clerk', 'finance', ['a staffing company', 'a manufacturer'], [50000, 70000], 'd', 2, 'somecollege', 1, {}, 0.85),
    t('court-clerk', 'court clerk', 'government', ['the superior court'], [55000, 80000], 'd', 0, 'hs', 0.8, {}, 0.75),
    t('eligibility-worker', 'eligibility worker', 'government', ['the county social services department'], [55000, 80000], 'd', 1, 'hs', 1.2, {}, 0.75),
    t('dmv-representative', 'motor vehicle representative', 'government', ['the state DMV office'], [45000, 60000], 'd', 0, 'hs', 0.6, {}, 0.65),
  ],
  farming: [
    t('almond-worker', 'orchard worker (almonds)', 'agriculture', ['an almond grower', 'a farm labor contractor crew'], [34000, 44000], 'e', 0, 'nohs', 3, { r: { sj: 6, sv: 2.5, r0: 0.04 }, dense: FIELD }, 0.25),
    t('vineyard-worker', 'vineyard worker', 'agriculture', ['a table grape grower', 'a wine grape vineyard'], [34000, 45000], 'e', 0, 'nohs', 3, { r: { sj: 4, cc: 2.5, ba: 2, nc: 1.5, sv: 1, ie: 1, sd: 0.4, r0: 0.05 }, dense: FIELD }, 0.3),
    t('citrus-picker', 'citrus picker', 'agriculture', ['a citrus grower', 'a packing house crew'], [34000, 44000], 'e', 0, 'nohs', 2, { r: { sj: 4, ie: 1.5, sd: 0.8, la: 0.4, cc: 0.3, sv: 0.3, r0: 0.02 }, dense: FIELD }, 0.25),
    t('dairy-milker', 'dairy milker', 'agriculture', ['a dairy farm'], [36000, 48000], 'en', 0, 'nohs', 2, { r: { sj: 5, nc: 1.5, sv: 0.8, ba: 0.6, ie: 0.4, cc: 0.3, r0: 0.02 }, dense: FIELD }, 0.15),
    t('strawberry-picker', 'strawberry picker', 'agriculture', ['a berry grower', 'a farm labor contractor crew'], [34000, 46000], 'e', 0, 'nohs', 3, { r: { cc: 7, la: 2, sd: 0.3, sj: 0.2, r0: 0.02 }, dense: FIELD }, 0.4),
    t('lettuce-harvester', 'lettuce harvester', 'agriculture', ['a vegetable grower', 'a harvest crew'], [34000, 46000], 'e', 0, 'nohs', 2.5, { r: { cc: 6, sd: 1.2, sj: 0.5, r0: 0.02 }, desert: [1.5, 1], dense: FIELD }, 0.3),
    t('vegetable-worker', 'field worker (tomatoes and vegetables)', 'agriculture', ['a vegetable grower', 'a farm labor contractor crew'], [34000, 44000], 'e', 0, 'nohs', 2, { r: { sj: 3, sv: 2, cc: 1.5, sd: 1, r0: 0.1 }, dense: FIELD }, 0.3),
    t('rice-worker', 'rice farm worker', 'agriculture', ['a rice farm'], [36000, 50000], 'e', 0, 'nohs', 1, { r: { sv: 6, sj: 0.2, r0: 0.01 }, dense: FIELD }, 0.1),
    t('orchard-worker', 'orchard worker (peaches and walnuts)', 'agriculture', ['a fruit and nut orchard'], [34000, 46000], 'e', 0, 'nohs', 2, { r: { sv: 5, sj: 2, r0: 0.03 }, dense: FIELD }, 0.3),
    t('date-worker', 'date palm worker', 'agriculture', ['a date grower'], [34000, 46000], 'e', 0, 'nohs', 0.6, { desert: [8, 0.01], r: { ie: 3, sd: 2 }, dense: FIELD }, 0.15),
    t('avocado-worker', 'avocado grove worker', 'agriculture', ['an avocado grove'], [35000, 46000], 'e', 0, 'nohs', 1, { r: { sd: 4, la: 2, cc: 1.5, ie: 0.5, r0: 0.02 }, dense: FIELD }, 0.2),
    t('nursery-worker', 'nursery and greenhouse worker', 'agriculture', ['a plant nursery', 'a greenhouse grower'], [34000, 44000], 'ed', 0, 'nohs', 1.5, { r: { sd: 2.5, la: 1.5, oc: 1.2, cc: 1.5, ba: 1, ie: 1.2, sj: 0.8 }, dense: [2.5, 1] }, 0.4),
    t('ranch-hand', 'ranch hand', 'agriculture', ['a cattle ranch'], [36000, 52000], 'e', 0, 'nohs', 1.5, { r: { fn: 6, si: 4, nc: 2, sj: 1.5, cc: 1.2, sv: 1, sd: 0.6, ie: 0.4, r0: 0.02 }, dense: [0.005, 1.6] }, 0.1),
    t('forestry-technician', 'forestry technician', 'forestry', ['the forest service', 'a timber company'], [40000, 60000], 'e', 0, 'hs', 1.5, { r: { nc: 5, fn: 5, si: 4, r0: 0.03 }, dense: FIELD }, 0.2),
    t('logger', 'logger', 'forestry', ['a logging company'], [45000, 70000], 'e', 0, 'nohs', 1, { r: { nc: 5, fn: 5, si: 2, r0: 0.01 }, dense: FIELD }, 0.05),
    t('fishing-deckhand', 'commercial fishing deckhand', 'fishing', ['a commercial fishing boat', 'a crab boat'], [35000, 70000], 'en', 0, 'nohs', 0.7, { coast: [4, 0.02], r: { nc: 3, cc: 2, ba: 1, la: 0.6, sd: 0.8, oc: 0.4 } }, 0.1),
    t('cannabis-trimmer', 'cannabis farm trimmer', 'agriculture', ['a licensed cannabis farm'], [34000, 50000], 'd', 0, 'hs', 0.8, { r: { nc: 5, fn: 1.2, cc: 0.8, sj: 0.4, r0: 0.05 }, dense: FIELD }, 0.45),
    t('irrigator', 'irrigation worker', 'agriculture', ['a farm', 'the irrigation district'], [38000, 52000], 'e', 0, 'nohs', 1, { r: { sj: 3, sv: 2.5, ie: 1, sd: 1, cc: 1, r0: 0.1 }, dense: FIELD }, 0.1),
    t('produce-sorter', 'produce sorter', 'agriculture', ['a packing shed', 'a fruit packing house'], [34000, 42000], 'ed', 0, 'nohs', 1.5, { r: { sj: 4, cc: 3, sv: 2, ie: 1, sd: 1, r0: 0.1 }, dense: [0.1, 1.2] }, 0.6),
    t('tractor-driver', 'tractor driver', 'agriculture', ['a farm', 'a custom harvesting outfit'], [38000, 55000], 'e', 0, 'nohs', 1.5, { r: { sj: 4, sv: 3, cc: 2, ie: 1, sd: 1, r0: 0.05 }, dense: FIELD }, 0.1),
    t('produce-market-worker', 'produce market worker', 'agriculture', ['a wholesale produce market', 'a produce distributor'], [34000, 46000], 'en', 0, 'nohs', 0.5, { dense: [8, 0.05] }, 0.3),
    t('farmworker', 'farmworker', 'agriculture', ['a farm', 'a farm labor contractor crew'], [34000, 44000], 'e', 0, 'nohs', 1, { dense: FIELD }, 0.3),
  ],
  construction: [
    t('carpenter', 'carpenter', 'construction', ['a homebuilder', 'a framing contractor', 'a general contractor'], [55000, 95000], 'e', 0, 'nohs', 4, { e: { builders: 0.3 } }, 0.03),
    t('electrician', 'electrician', 'construction', ['an electrical contractor', 'a union electrical shop'], [65000, 120000], 'ed', 0, 'hs', 3, {}, 0.03),
    t('plumber', 'plumber', 'construction', ['a plumbing contractor', 'their own plumbing business'], [60000, 110000], 'ed', 0, 'hs', 2.5, {}, 0.02),
    t('construction-laborer', 'construction laborer', 'construction', ['a general contractor', 'a concrete contractor', 'a road crew'], [45000, 70000], 'e', 0, 'nohs', 6, {}, 0.04),
    t('roofer', 'roofer', 'construction', ['a roofing contractor'], [45000, 75000], 'e', 0, 'nohs', 1.5, { e: { roofers: 1.2 } }, 0.02),
    t('painter', 'painter', 'construction', ['a painting contractor', 'their own painting business'], [45000, 70000], 'ed', 0, 'nohs', 2.5, {}, 0.08),
    t('drywall-installer', 'drywall installer', 'construction', ['a drywall contractor'], [50000, 80000], 'e', 0, 'nohs', 1.5, {}, 0.03),
    t('equipment-operator', 'heavy equipment operator', 'construction', ['a grading contractor', 'a road construction company'], [65000, 110000], 'e', 0, 'hs', 1.5, {}, 0.04),
    t('solar-installer', 'solar panel installer', 'energy', ['a solar installer'], [45000, 70000], 'e', 0, 'hs', 1, { e: { solar_co: 1.5 }, hot: [1.4, 1] }, 0.05),
    t('concrete-finisher', 'concrete finisher', 'construction', ['a concrete contractor'], [50000, 85000], 'e', 0, 'nohs', 1.5, {}, 0.02),
    t('ironworker', 'ironworker', 'construction', ['a steel erection contractor'], [65000, 110000], 'e', 0, 'hs', 0.8, { dense: [1.4, 0.7] }, 0.02),
    t('foreman', 'construction foreman', 'construction', ['a general contractor', 'a homebuilder'], [80000, 130000], 'e', 0, 'hs', 1.2, {}, 0.04, 28),
    t('building-inspector', 'building inspector', 'government', ['the city building department', 'the county'], [80000, 125000], 'd', 0, 'hs', 0.6, {}, 0.15, 30),
    t('tile-setter', 'tile setter', 'construction', ['a flooring contractor'], [50000, 80000], 'e', 0, 'nohs', 0.8, {}, 0.03),
  ],
  repair: [
    t('auto-mechanic', 'auto mechanic', 'auto repair', ['an auto repair shop', 'a car dealership service department', 'a tire shop'], [45000, 85000], 'ed', 0, 'hs', 5, { e: { auto: 1 } }, 0.03),
    t('hvac-technician', 'HVAC technician', 'home services', ['a heating and air conditioning company'], [55000, 95000], 'ed', 0, 'hs', 2.5, { hot: [1.6, 0.9], desert: [1.4, 1] }, 0.02),
    t('maintenance-technician', 'maintenance technician', 'facilities', ['an apartment complex', 'a school district', 'a hospital', 'a hotel'], [45000, 70000], 'ed', 0, 'hs', 5, {}, 0.05),
    t('diesel-mechanic', 'diesel mechanic', 'transportation', ['a trucking company', 'a transit agency', 'a farm equipment dealer'], [55000, 90000], 'edn', 0, 'hs', 2, { e: { whse: 0.6 } }, 0.02),
    t('lineworker', 'utility lineworker', 'utilities', ['the electric utility'], [100000, 160000], 'ed', 0, 'hs', 1.2, { fire: [1.4, 1] }, 0.03),
    t('telecom-installer', 'telecom installer', 'telecommunications', ['a cable and internet provider'], [50000, 85000], 'd', 0, 'hs', 1.5, {}, 0.05),
    t('aircraft-mechanic', 'aircraft mechanic', 'aviation', ['an airline maintenance base', 'an aerospace company'], [70000, 115000], 'edn', 0, 'associate', 0.8, { desert: [1.6, 1], r: { la: 1.5 } }, 0.05),
    t('appliance-repair', 'appliance repair technician', 'home services', ['an appliance repair company'], [45000, 70000], 'd', 0, 'hs', 0.8, {}, 0.05),
    t('industrial-mechanic', 'industrial machinery mechanic', 'manufacturing', ['a food processing plant', 'a factory', 'a bottling plant'], [60000, 95000], 'edv', 0, 'hs', 1.5, { e: { mfg: 0.8 } }, 0.04),
    t('farm-equipment-mechanic', 'farm equipment mechanic', 'agriculture', ['a tractor dealer', 'a farm'], [50000, 80000], 'ed', 0, 'hs', 0.8, { r: { sj: 4, sv: 3, cc: 2, fn: 1.5, ...FARM_REGIONS_LOW } }, 0.03),
    t('elevator-technician', 'elevator technician', 'facilities', ['an elevator service company'], [90000, 140000], 'd', 0, 'hs', 0.3, { dense: [3, 0.1] }, 0.03),
    t('auto-body', 'auto body repairer', 'auto repair', ['a collision repair shop'], [45000, 80000], 'd', 0, 'hs', 1.2, { e: { auto: 0.8 } }, 0.04),
  ],
  production: [
    t('assembler', 'assembly line worker', 'manufacturing', ['an electronics plant', 'an aerospace parts maker', 'a furniture factory', 'an RV plant'], [38000, 55000], 'edvn', 0, 'nohs', 4, { e: { mfg: 1 } }, 0.4),
    t('food-processing', 'food processing worker', 'food processing', ['a fruit cannery', 'a nut processor', 'a meat packing plant', 'a tortilla factory', 'a frozen food plant'], [36000, 52000], 'edvn', 0, 'nohs', 3.5, { r: { sj: 3, sv: 2, cc: 1.5, la: 1, ie: 1, ba: 0.8 } }, 0.5),
    t('machinist', 'machinist', 'manufacturing', ['a machine shop', 'an aerospace supplier'], [50000, 85000], 'edv', 0, 'hs', 2.5, { e: { mfg: 1 } }, 0.05),
    t('welder', 'welder', 'manufacturing', ['a fabrication shop', 'a shipyard', 'a trailer factory'], [48000, 80000], 'ed', 0, 'hs', 2.5, { port: [1.6, 1] }, 0.05),
    t('packing-house', 'packing house worker', 'agriculture', ['a produce packing house', 'a packaging plant'], [34000, 44000], 'ed', 0, 'nohs', 3, { r: { sj: 3, cc: 3, sv: 2, sd: 1, ie: 1, r0: 0.3 }, dense: [0.3, 1.5] }, 0.6),
    t('bakery-worker', 'bakery worker', 'food processing', ['a commercial bakery', 'a neighborhood bakery'], [35000, 50000], 'en', 0, 'nohs', 1.5, {}, 0.5),
    t('press-operator', 'print press operator', 'manufacturing', ['a printing plant'], [40000, 60000], 'dv', 0, 'hs', 0.8, {}, 0.2),
    t('sewing-operator', 'sewing machine operator', 'apparel', ['a garment factory', 'an upholstery shop'], [33000, 42000], 'd', 0, 'nohs', 1.2, { r: { la: 4, r0: 0.3 } }, 0.75),
    t('quality-inspector', 'quality inspector', 'manufacturing', ['a manufacturing plant', 'a food processing plant'], [45000, 70000], 'dv', 0, 'hs', 1.5, {}, 0.45),
    t('refinery-operator', 'refinery operator', 'energy', ['an oil refinery'], [90000, 140000], 'evnh', 0, 'hs', 0.6, { r: { ba: 2, la: 2, sj: 1, r0: 0.05 } }, 0.1),
    t('cellar-worker', 'winery cellar worker', 'wine', ['a winery'], [38000, 58000], 'ed', 0, 'hs', 0.6, { r: { ba: 3, cc: 2.5, nc: 2, sj: 1.5, si: 1, r0: 0.05 }, dense: [0.05, 2] }, 0.25),
    t('fab-technician', 'semiconductor technician', 'technology', ['a chip fab'], [55000, 90000], 'evn', 0, 'associate', 0.8, { r: { ba: 5, sd: 1, oc: 0.8, la: 0.5, r0: 0.05 } }, 0.3),
    t('meat-cutter', 'meat cutter', 'food processing', ['a grocery store meat counter', 'a meat packing plant'], [40000, 60000], 'ed', 0, 'nohs', 1, {}, 0.2),
    t('cabinetmaker', 'cabinetmaker', 'manufacturing', ['a cabinet shop'], [42000, 65000], 'ed', 0, 'nohs', 0.8, {}, 0.1),
    t('water-operator', 'water treatment plant operator', 'utilities', ['the water district', 'the city wastewater plant'], [75000, 115000], 'edvn', 0, 'hs', 0.8, {}, 0.15),
    t('home-seamstress', 'alterations seamstress', 'apparel', ['their own alterations business'], [35200, 52000], 'd', 3, 'nohs', 0.4, {}, 0.85),
  ],
  transport: [
    t('truck-driver', 'truck driver', 'trucking', ['a trucking company', 'a freight carrier', 'a grocery distribution fleet'], [55000, 90000], 'edn', 0, 'hs', 6, { r: { ie: 1.5, sj: 1.4 }, port: [1.5, 1] }, 0.05),
    t('delivery-driver', 'delivery driver', 'delivery', ['a parcel delivery service', 'a beverage distributor', 'an online retailer', 'a furniture store'], [42000, 62000], 'ed', 0, 'hs', 4, {}, 0.15),
    t('bus-driver', 'bus driver', 'public transit', ['the transit agency', 'a charter bus company'], [50000, 85000], 'edv', 0, 'hs', 2.5, { dense: [1.4, 0.7] }, 0.35),
    t('rideshare-driver', 'rideshare driver', 'gig economy', ['a rideshare app'], [25000, 55000], 'mvn', 0, 'hs', 2, { dense: [1.5, 0.5] }, 0.2),
    t('school-bus-driver', 'school bus driver', 'education', ['the school district'], [42000, 60000], 'e', 0, 'hs', 1.2, {}, 0.55),
    t('airline-pilot', 'airline pilot', 'aviation', ['an airline', 'a regional airline', 'a cargo airline'], [150000, 300000], 'edv', 0, 'bachelor', 0.6, {}, 0.06, 25),
    t('flight-attendant', 'flight attendant', 'aviation', ['an airline'], [50000, 90000], 'edv', 0, 'hs', 0.8, {}, 0.75, 20),
    t('parking-attendant', 'parking attendant', 'parking', ['a parking garage', 'a hotel valet stand'], [33000, 42000], 'mvn', 0, 'nohs', 1.5, { dense: [1.6, 0.4] }, 0.15),
    t('train-operator', 'train operator', 'rail', ['the transit agency', 'a freight railroad'], [70000, 120000], 'edvn', 0, 'hs', 0.6, { dense: [1.5, 0.6] }, 0.2),
    t('tug-deckhand', 'tugboat deckhand', 'maritime', ['a harbor tug company'], [50000, 90000], 'en', 0, 'hs', 0.4, { port: [8, 0.01] }, 0.05),
    t('tow-driver', 'tow truck driver', 'towing', ['a towing company'], [40000, 60000], 'edn', 0, 'hs', 1, {}, 0.04),
    t('farm-truck-driver', 'farm truck driver', 'agriculture', ['a harvest hauler'], [40000, 65000], 'e', 0, 'hs', 0.8, { r: { sj: 4, sv: 3, cc: 2, r0: 0.1 } }, 0.05),
  ],
  moving: [
    t('warehouse-associate', 'warehouse associate', 'logistics', ['a fulfillment center', 'a distribution warehouse', 'a third-party logistics company'], [38000, 52000], 'edvn', 0, 'nohs', 6, { e: { whse: 1.2 }, r: { ie: 3, sj: 1.5, sv: 1.2 } }, 0.35),
    t('forklift-operator', 'forklift operator', 'logistics', ['a distribution center', 'a lumber yard', 'a cold storage warehouse'], [42000, 58000], 'edvn', 0, 'hs', 3, { e: { whse: 1 } }, 0.1),
    t('longshore-worker', 'longshore worker', 'ports', ['a container terminal at the port'], [90000, 170000], 'edvn', 0, 'hs', 1, { port: [30, 0.004] }, 0.15),
    t('crane-operator', 'container crane operator', 'ports', ['a container terminal at the port'], [120000, 200000], 'edvn', 0, 'hs', 0.3, { port: [30, 0.003] }, 0.1, 25),
    t('freight-handler', 'freight handler', 'logistics', ['a trucking terminal', 'an air cargo facility'], [38000, 52000], 'en', 0, 'nohs', 3, {}, 0.2),
    t('grocery-stocker', 'grocery stocker', 'retail', ['a grocery store', 'a warehouse club'], [36000, 48000], 'ne', 0, 'nohs', 3, {}, 0.3),
    t('hand-packager', 'hand packager', 'logistics', ['a produce packing shed', 'a fulfillment center'], [34000, 44000], 'ed', 0, 'nohs', 2, { r: { sj: 2, cc: 2 } }, 0.55),
    t('refuse-collector', 'refuse collector', 'sanitation', ['the city sanitation department', 'a waste hauler'], [50000, 80000], 'e', 0, 'hs', 1.2, {}, 0.05),
    t('car-wash', 'car wash attendant', 'auto services', ['a car wash'], [33000, 40000], 'dm', 0, 'nohs', 1.5, {}, 0.1),
    t('recycling-worker', 'recycling center worker', 'sanitation', ['a recycling center'], [35000, 45000], 'ed', 0, 'nohs', 0.6, {}, 0.3),
    t('ramp-agent', 'airport ramp agent', 'aviation', ['an airline ground crew'], [38000, 55000], 'edvn', 0, 'hs', 0.8, { dense: [1.2, 0.6] }, 0.15),
  ],
  // Active duty: basic pay by the federal tables (enlisted from a private's to a senior sergeant's, officers from a
  // second lieutenant's or an ensign's to a colonel's or a captain's), the same in every county. Each title is one
  // branch's; a member's branch is the installation's they report to (population.mjs), and the affinities here only
  // place the members who work off base (recruiters, reserve centers, headquarters). About one in six is an officer.
  military: [
    t('navy-sailor', 'Navy sailor', 'military', ['the U.S. Navy'], [28900, 75000], 'edn', 0, 'hs', 3, MIL_AFF.navy, 0.2),
    t('navy-corpsman', 'Navy hospital corpsman', 'military', ['the U.S. Navy'], [28900, 70000], 'edn', 0, 'hs', 0.8, { coast: [3, 0.3], r: { sd: 4 } }, 0.35),
    t('marine', 'Marine', 'military', ['the U.S. Marine Corps'], [28900, 72000], 'ed', 0, 'hs', 2.5, MIL_AFF.marines, 0.1),
    t('army-soldier', 'Army soldier', 'military', ['the U.S. Army'], [28900, 72000], 'ed', 0, 'hs', 1.5, MIL_AFF.army, 0.15),
    t('airman', 'Air Force airman', 'military', ['the U.S. Air Force'], [28900, 75000], 'edn', 0, 'hs', 2, MIL_AFF.airforce, 0.2),
    t('guardian', 'Space Force guardian', 'military', ['the U.S. Space Force'], [28900, 80000], 'edn', 0, 'hs', 0.25, MIL_AFF.spaceforce, 0.2),
    t('coast-guard', "Coast Guard boatswain's mate", 'military', ['the U.S. Coast Guard'], [28900, 72000], 'edn', 0, 'hs', 0.6, MIL_AFF.coastguard, 0.15),
    t('navy-officer', 'Navy officer', 'military', ['the U.S. Navy'], [48000, 150000], 'd', 0, 'bachelor', 0.7, MIL_AFF.navy, 0.2, 22),
    t('marine-officer', 'Marine Corps officer', 'military', ['the U.S. Marine Corps'], [48000, 150000], 'd', 0, 'bachelor', 0.45, MIL_AFF.marines, 0.1, 22),
    t('army-officer', 'Army officer', 'military', ['the U.S. Army'], [48000, 150000], 'd', 0, 'bachelor', 0.3, MIL_AFF.army, 0.2, 22),
    t('air-force-officer', 'Air Force officer', 'military', ['the U.S. Air Force'], [48000, 150000], 'd', 0, 'bachelor', 0.4, MIL_AFF.airforce, 0.2, 22),
    t('space-force-officer', 'Space Force officer', 'military', ['the U.S. Space Force'], [48000, 150000], 'd', 0, 'bachelor', 0.15, MIL_AFF.spaceforce, 0.2, 22),
    t('coast-guard-officer', 'Coast Guard officer', 'military', ['the U.S. Coast Guard'], [48000, 150000], 'd', 0, 'bachelor', 0.12, MIL_AFF.coastguard, 0.2, 22),
  ],
};

// ------------------------------------------------------------------ place features and choosing a title

const EST_COLS = ['retail', 'food', 'lodging', 'whse', 'mfg', 'church', 'health', 'school', 'office', 'auto', 'builders', 'roofers', 'solar_co', 'ins_agents'];
const featureCache = new WeakMap();

/** Statewide shares of each establishment column and per-ZIP feature records, cached per world. */
function worldFeatures(world) {
  let F = featureCache.get(world);
  if (F) return F;
  const z = world.z, share = {};
  let est = 0; for (let i = 0; i < world.N; i++) est += z.est[i] || 0;
  for (const c of EST_COLS) { let s = 0; for (let i = 0; i < world.N; i++) s += z[c][i] || 0; share[c] = est > 0 ? s / est : 0; }
  let inc = world.state && world.state.inc;
  if (!(inc > 0)) { let s = 0, n = 0; for (let i = 0; i < world.N; i++) if (z.inc[i] > 0 && z.hh[i] > 0) { s += z.inc[i] * z.hh[i]; n += z.hh[i]; } inc = n > 0 ? s / n : 90000; }
  F = { share, inc, zips: new Array(world.N), weights: new Map() };
  featureCache.set(world, F);
  return F;
}

/** What a ZIP looks like to a job: region, establishment mix and landscape (pack data only). */
function zipFeatures(world, zi) {
  const F = worldFeatures(world);
  let f = F.zips[zi];
  if (f) return f;
  const z = world.z, est = z.est[zi] || 0, ratio = {};
  for (const c of EST_COLS) { const sh = F.share[c] || 1e-9; ratio[c] = ((z[c][zi] || 0) + 2 * sh) / (est + 2) / sh; }
  let whseNear = 0;
  const coastKm = z.coast_km[zi] ?? 99, dens = z.density[zi] || 0;
  if (coastKm < 8 && dens > 2500) for (const [j] of world.zipsNear(z.tx[zi], z.ty[zi], 10)) whseNear += z.whse[j] || 0;
  const pop = z.pop[zi] || 0, hhPop = (z.hh[zi] || 0) * (z.hhsize[zi] || 0);
  const county = world.countyOf(zi);
  const cinc = county && county.inc > 0 ? county.inc : (z.inc[zi] > 0 ? z.inc[zi] : F.inc);
  f = {
    region: z.region[zi], ratio,
    coast: coastKm < 10, dense: dens >= 4000, rural: dens < 500,
    desert: (z.rain_in[zi] ?? 20) < 8 && (z.tjul[zi] ?? 0) >= 92,
    snow: (z.snowfall_in[zi] || 0) > 60,
    port: coastKm < 8 && dens > 2500 && whseNear >= 10,
    fire: (z.fhsz_any[zi] || 0) > 25,
    hot: (z.h100[zi] || 0) > 12,
    inst: pop > 500 && (pop - hhPop) / pop > 0.15,
    wage: Math.min(1.3, Math.max(0.8, Math.pow(cinc / F.inc, 0.35))),
  };
  F.zips[zi] = f;
  return f;
}

function placeWeight(title, f) {
  const a = title.aff;
  let w = title.weight;
  if (a.r) { const m = a.r[f.region]; w *= m !== undefined ? m : (a.r.r0 !== undefined ? a.r.r0 : 1); }
  if (a.e) for (const c in a.e) w *= Math.min(8, Math.max(0.15, Math.pow(f.ratio[c] || 1, a.e[c])));
  for (const k of ['coast', 'desert', 'snow', 'port', 'fire', 'hot', 'inst']) if (a[k]) w *= f[k] ? a[k][0] : a[k][1];
  if (a.dense) w *= f.dense ? a.dense[0] : f.rural ? a.dense[1] : 1;
  return w;
}

/** Place affinity weights of a group's titles in a ZIP, cached. */
function placeWeights(world, zi, group) {
  const F = worldFeatures(world), key = zi * 32 + OCC_GROUP_INDEX[group];
  let w = F.weights.get(key);
  if (w) return w;
  const f = zipFeatures(world, zi);
  w = Float64Array.from(OCCUPATION_CATALOG[group], title => placeWeight(title, f));
  F.weights.set(key, w);
  return w;
}
const OCC_GROUP_INDEX = Object.fromEntries([...OCC_GROUPS, 'military'].map((g, i) => [g, i]));

// per group: whether any title can be done from home, and whether any can be done away from home
const ANY_REMOTE = Object.fromEntries(Object.entries(OCCUPATION_CATALOG).map(([g, list]) => [g, list.some(x => x.wfh > 0)]));
const ANY_ONSITE = Object.fromEntries(Object.entries(OCCUPATION_CATALOG).map(([g, list]) => [g, list.some(x => x.wfh < 3)]));

/** An education key or index as an index into EDUCATION_LEVELS ('in school' counts as some college); undefined passes through. */
function eduIndex(e) {
  if (e === undefined || e === null) return undefined;
  if (typeof e === 'number') return e;
  return e in ED ? ED[e] : e === 'in school' ? 2 : 1;
}

/**
 * A catalog title for a worker: by the place (region, establishments, landscape), sex, age, shift and whether the
 * work is done from home. Working from home picks only titles that can be (when the group has any) and working
 * away from home never picks an always-at-home title (a home daycare). A known education rules out licensed titles
 * the person lacks the degree for and makes others less likely the further short it falls; eduMax (the most
 * schooling the person's age allows) rules out titles needing more. When nothing fits, the group's least demanding
 * titles stand in. A service member's branch (a MILITARY_BRANCHES key), when given, keeps the draw to its titles.
 * @param {import('./rng.mjs').Rng} rng
 * @param {{group: string, world?: object, zi?: number, sex?: 'F'|'M', age?: number, education?: string|number,
 *   eduMax?: string|number, shift?: string, wfh?: boolean, branch?: string}} opts
 * @returns {object} the catalog entry (key, title, sector, employers, wage range, shifts, wfh, edu, licensed, branch, ...)
 */
export function chooseTitle(rng, { group, world, zi, sex = 'F', age = 40, education, eduMax, shift, wfh, branch } = {}) {
  const g = OCCUPATION_CATALOG[group] ? group : 'office';
  const list = OCCUPATION_CATALOG[g];
  const base = world && zi >= 0 ? placeWeights(world, zi, g) : null;
  const edu = eduIndex(education), cap = eduIndex(eduMax);
  const br = g === 'military' && Object.prototype.hasOwnProperty.call(MILITARY_BRANCHES, branch) ? branch : null;
  const w = new Float64Array(list.length);
  let tot = 0;
  for (let i = 0; i < list.length; i++) {
    const x = list[i];
    if (br && x.branch !== br) continue;
    let v = base ? base[i] : x.weight;
    v *= sex === 'F' ? 0.3 + 1.4 * x.fs : 0.3 + 1.4 * (1 - x.fs);
    if (edu !== undefined && edu < x.edu) v *= x.licensed ? 0 : edu === x.edu - 1 ? 0.2 : 0.02;
    if (cap !== undefined && cap < x.edu) v = 0;
    if (age < x.minAge) v *= x.licensed ? 0 : 0.02;
    if (shift && !x.shifts.includes(shift)) v *= 0.1;
    if (wfh === true) v *= x.wfh === 0 ? (ANY_REMOTE[g] ? 0 : 1) : x.wfh === 1 ? 1 : 2;
    else if (wfh === false && x.wfh === 3 && ANY_ONSITE[g]) v = 0;
    w[i] = v; tot += v;
  }
  if (!(tot > 0)) {
    // no title meets every requirement (an education the person lacks): the least demanding titles that still fit
    // working from home or not, and the age a license needs; the education rules alone are relaxed
    const fits = x => (wfh !== true || !ANY_REMOTE[g] || x.wfh > 0) && !(wfh === false && x.wfh === 3 && ANY_ONSITE[g]) && (!br || x.branch === br);
    const old = x => !x.licensed || age >= x.minAge;
    let pool = list.filter(x => fits(x) && old(x));
    if (!pool.length) pool = list.filter(fits);
    if (!pool.length) pool = list;
    let lo = Infinity; for (const x of pool) if (x.edu < lo) lo = x.edu;
    for (let i = 0; i < list.length; i++) { const x = list[i]; w[i] = x.edu === lo && pool.includes(x) ? (base ? base[i] : x.weight) : 0; tot += w[i]; }
  }
  let last = list.length - 1;
  while (last > 0 && !(w[last] > 0)) last--;
  let u = rng.float() * tot, k = 0;
  while (k < last && (u >= w[k] || !(w[k] > 0))) { u -= w[k]; k++; }
  return list[k];
}

/**
 * The annual wage of a title for a person: its California range by experience (age), education beyond the
 * title's minimum and a personal draw u, scaled by the county's income level, never below a full-time minimum-wage
 * salary (MIN_WAGE_FULL_TIME; the population pays part-timers by their hours). A service member's is federal basic
 * pay: the same in every county and never below a private's (MIL_PAY_FLOOR), not the state minimum wage.
 * @param {object} title a catalog entry
 * @param {{world?: object, zi?: number, age?: number, education?: string|number}} who
 * @param {number} u a uniform in [0, 1)
 * @returns {number} dollars a year, a multiple of $500
 */
export function titleWage(title, { world, zi, age = 40, education } = {}, u = 0.5) {
  const mil = title.sector === 'military';
  const f = !mil && world && zi >= 0 ? zipFeatures(world, zi) : null;
  const edu = eduIndex(education) ?? title.edu;
  const exp = Math.pow(Math.min(1, Math.max(0, (age - 18) / 25)), 0.7);
  const pos = Math.min(1, Math.max(0, 0.12 + 0.6 * exp + 0.07 * Math.max(0, edu - title.edu) + 0.3 * (u - 0.5)));
  const wage = Math.round((title.wage[0] + (title.wage[1] - title.wage[0]) * pos) * (f ? f.wage : 1) / 500) * 500;
  return Math.max(mil ? MIL_PAY_FLOOR : MIN_WAGE_FULL_TIME, wage);
}

/**
 * A specific job for a worker (chooseTitle, then an employer, the shift and titleWage).
 * @param {import('./rng.mjs').Rng} rng
 * @param {{group: string, world: object, zi: number, sex?: 'F'|'M', age?: number, education?: string,
 *   shift?: string, wfh?: boolean, branch?: string}} opts group: a Census occupation group or 'military'; zi: the ZIP
 *   where the job is (the workplace when known); education: a B15003 key ('in school' counts as some college); shift
 *   and wfh, when given, are honored (titles that fit them are preferred) and returned unchanged; branch: a service
 *   member's branch (MILITARY_BRANCHES key).
 * @returns {{key: string, title: string, sector: string, employer: string, shift: string, wfh: boolean, wage: number}}
 */
export function pickOccupation(rng, opts = {}) {
  const { world, zi, age = 40, education = 'hs', shift, wfh } = opts;
  const x = chooseTitle(rng, { ...opts, education });
  const employer = x.employers[rng.int(x.employers.length)];
  const sh = shift || x.shifts[rng.int(x.shifts.length)];
  const wage = titleWage(x, { world, zi, age, education }, rng.float());
  return { key: x.key, title: x.title, sector: x.sector, employer, shift: sh, wfh: typeof wfh === 'boolean' ? wfh : x.wfh >= 2, wage };
}

/** A typical California wage for an occupation group (dollars per year), for ranking household earnings. */
export function typicalWage(group) { return (GROUP_PROFILES[group] || GROUP_PROFILES.office).median; }
