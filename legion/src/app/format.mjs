// Legion · formatting and the words the page uses for the engine's keys.
//
// Every label the UI shows for a population or Census key lives here, so the panels never print a raw key
// ('small-apartment', 'wfh') and the wording stays consistent between the Place panel and the NPC panel.

import { fmtClock } from '../engine/clock.mjs';

const INT = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const COMPACT = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const MONEY = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const isNum = v => typeof v === 'number' && Number.isFinite(v);

/** "39,286,245"; an em dash for missing values. */
export function fmtInt(n) { return isNum(n) ? INT.format(Math.round(n)) : '—'; }

/** "982K", "1.9M"; full digits below 10,000. */
export function fmtCompact(n) {
  if (!isNum(n)) return '—';
  return Math.abs(n) < 10000 ? INT.format(Math.round(n)) : COMPACT.format(n);
}

/** "$158,351"; "$1.45M" when compact and at least a million. */
export function fmtMoney(n, { compact = false } = {}) {
  if (!isNum(n) || n <= 0) return '—';
  if (compact && n >= 1e6) return '$' + (n / 1e6).toFixed(n >= 1e7 ? 1 : 2).replace(/\.?0+$/, '') + 'M';
  if (compact && n >= 1e5) return '$' + Math.round(n / 1000) + 'K';
  return MONEY.format(Math.round(n));
}

/** A share in percent (0-100) as "41.8%" / "4.3%" / "<0.1%". */
export function fmtPct(p, digits) {
  if (!isNum(p)) return '—';
  if (p > 0 && p < 0.1) return '<0.1%';
  const d = digits ?? (p >= 10 ? 0 : 1);
  return p.toFixed(d).replace(/\.0$/, '') + '%';
}

/** Minutes after midnight as "7:05 AM". */
export function fmtMinute(min) { return isNum(min) ? fmtClock(min) : '—'; }

/** "35 min" / "1 h 10 min". */
export function fmtDuration(min) {
  if (!isNum(min)) return '—';
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

/** "1 person" / "4 people" style plurals. */
export function plural(n, one, many = one + 's') { return `${fmtInt(n)} ${n === 1 ? one : many}`; }

/** Capitalize the first letter. */
export function capitalize(s) { s = String(s ?? ''); return s ? s[0].toUpperCase() + s.slice(1) : s; }

/** 'small-apartment' or 'some_college' to 'Small apartment'. */
export function humanize(key) { return capitalize(String(key ?? '').replace(/[-_]+/g, ' ').trim()); }

/** Look a key up in a label table, falling back to a humanized key. */
export function label(table, key, fallback) {
  if (key === null || key === undefined || key === '') return fallback ?? '—';
  return Object.prototype.hasOwnProperty.call(table, key) ? table[key] : humanize(key);
}

/** Initials for an avatar ("Maria José Hernández" to "MH"). */
export function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = parts[0][0], last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** A commute-days bit mask (Sun = 1 ... Sat = 64, as 1 << dow) as "Mon–Fri", "Every day", "Tue, Thu". */
export function daysLabel(mask) {
  if (!isNum(mask) || mask <= 0) return 'No set days';
  const on = DAY_ABBR.map((_, d) => (mask >> d) & 1);
  const n = on.reduce((a, b) => a + b, 0);
  if (n === 7) return 'Every day';
  if (mask === 62) return 'Mon–Fri';
  if (mask === 65) return 'Weekends';
  // a single run of consecutive days inside the week reads as a range
  const first = on.indexOf(1), last = on.lastIndexOf(1);
  if (n >= 3 && last - first + 1 === n) return `${DAY_ABBR[first]}–${DAY_ABBR[last]}`;
  return DAY_ABBR.filter((_, d) => on[d]).join(', ');
}

// ------------------------------------------------------------------ population vocabulary (CONTRACTS section 5)

/** Household types (B11001). */
export const HH_TYPE = {
  married: 'Married couple', father: 'Family, male householder', mother: 'Family, female householder',
  alone: 'Lives alone', roommates: 'Shared with roommates',
};
/** Tenure. */
export const TENURE = { own: 'Owns', rent: 'Rents' };
/** Dwelling kinds. */
export const DWELLING = {
  house: 'House', 'small-apartment': 'Small apartment building', apartment: 'Apartment building',
  'mobile-home': 'Mobile home',
};
/** Household roles. */
export const ROLE = {
  householder: 'Householder', spouse: 'Spouse', partner: 'Partner', child: 'Child', grandchild: 'Grandchild',
  parent: 'Parent', sibling: 'Sibling', relative: 'Relative', roommate: 'Roommate',
};
/** Commute modes as a noun phrase. */
export const MODE = {
  drive: 'Drives alone', carpool: 'Carpools', bus: 'Bus', rail: 'Train', ferry: 'Ferry', taxi: 'Taxi or rideshare',
  motorcycle: 'Motorcycle', bike: 'Bike', walk: 'Walks', other: 'Other way', wfh: 'Works from home',
};
/** Commute modes as a verb phrase ("Takes the train"). */
export const MODE_VERB = {
  drive: 'Drives', carpool: 'Carpools', bus: 'Takes the bus', rail: 'Takes the train', ferry: 'Takes the ferry',
  taxi: 'Takes a taxi or rideshare', motorcycle: 'Rides a motorcycle', bike: 'Bikes', walk: 'Walks',
  other: 'Gets there another way', wfh: 'Works from home',
};
/** Education (B15003 keys plus the NPC's non-adult states). */
export const EDUCATION = {
  nohs: 'No high school diploma', hs: 'High school diploma', somecollege: 'Some college', associate: "Associate's degree",
  bachelor: "Bachelor's degree", master: "Master's degree", professional: 'Professional degree', doctorate: 'Doctorate',
  'in school': 'In school', child: 'Too young for school',
};
/** School levels. */
export const SCHOOL = {
  preschool: 'Preschool', elementary: 'Elementary school', middle: 'Middle school', high: 'High school',
  college: 'College', grad: 'Graduate school', k12: 'School',
};
/** Activity status. */
export const STATUS = {
  employed: 'Employed', unemployed: 'Looking for work', retired: 'Retired', student: 'Student', homemaker: 'Homemaker',
  child: 'Child', military: 'Armed forces', 'not working': 'Not working',
};
/** English ability. */
export const ENGLISH = { only: 'English only', 'very well': 'Speaks English very well', limited: 'Limited English' };
/** Marital status (B12001). */
export const MARITAL = {
  never: 'Never married', married: 'Married', separated: 'Separated', absent: 'Married, spouse away',
  widowed: 'Widowed', divorced: 'Divorced',
};
/** Generation since immigration. */
export const GENERATION = { 1: 'Immigrant (first generation)', 2: 'Second generation', 3: 'Third generation or more' };
/** Home-language keys. */
export const LANGUAGE = {
  english: 'English', spanish: 'Spanish', chinese: 'Chinese', cantonese: 'Cantonese', mandarin: 'Mandarin',
  vietnamese: 'Vietnamese', tagalog: 'Tagalog', korean: 'Korean', arabic: 'Arabic', armenian: 'Armenian',
  farsi: 'Persian (Farsi)', russian: 'Russian', ukrainian: 'Ukrainian', punjabi: 'Punjabi', hindi: 'Hindi',
  urdu: 'Urdu', hmong: 'Hmong', khmer: 'Khmer', lao: 'Lao', japanese: 'Japanese', portuguese: 'Portuguese',
  french: 'French', german: 'German', italian: 'Italian', polish: 'Polish', thai: 'Thai', gujarati: 'Gujarati',
  bengali: 'Bengali', telugu: 'Telugu', tamil: 'Tamil', amharic: 'Amharic', tigrinya: 'Tigrinya', somali: 'Somali',
  hebrew: 'Hebrew', greek: 'Greek', assyrian: 'Assyrian (Neo-Aramaic)', burmese: 'Burmese', indonesian: 'Indonesian',
  samoan: 'Samoan', tongan: 'Tongan', yoruba: 'Yoruba', igbo: 'Igbo', mixtec: 'Mixtec', zapotec: 'Zapotec',
  other: 'Another language',
};
/** Occupation groups (C24010 leaves). */
export const OCCUPATION_GROUP = {
  management: 'Management', business: 'Business and finance', computer: 'Computers and math', engineering: 'Engineering',
  science: 'Science', social: 'Community and social service', legal: 'Legal', education: 'Education', arts: 'Arts, media, sports',
  practitioner: 'Health care practitioners', healthtech: 'Health technicians', healthsupport: 'Health care support',
  firefighting: 'Firefighting', police: 'Law enforcement', food: 'Food service', cleaning: 'Building and grounds',
  personalcare: 'Personal care', sales: 'Sales', office: 'Office and administrative', farming: 'Farming, fishing, forestry',
  construction: 'Construction', repair: 'Installation and repair', production: 'Production', transport: 'Transportation',
  moving: 'Material moving',
};

// ------------------------------------------------------------------ Census vocabulary (the pack's ACS blocks)

/** Languages spoken at home (C16001 groups). */
export const ACS_LANGUAGE = {
  english: 'English only', spanish: 'Spanish', french: 'French, Haitian, Cajun', german: 'German and West Germanic',
  slavic: 'Russian, Polish, Slavic', indoeuro: 'Other Indo-European', korean: 'Korean', chinese: 'Chinese',
  vietnamese: 'Vietnamese', tagalog: 'Tagalog and Filipino', asianpi: 'Other Asian and Pacific Island',
  arabic: 'Arabic', other: 'Other languages',
};
/** Race and ethnicity (B03002; the first seven non-Hispanic). */
export const RACE = {
  hispanic: 'Hispanic or Latino', white: 'White', black: 'Black or African American', asian: 'Asian',
  aian: 'American Indian or Alaska Native', nhpi: 'Native Hawaiian or Pacific Islander', multi: 'Multiracial',
  other: 'Another race',
};
/** Hispanic origins (B03001). */
export const HISPANIC_ORIGIN = {
  mexican: 'Mexican', puertorican: 'Puerto Rican', cuban: 'Cuban', dominican: 'Dominican', guatemalan: 'Guatemalan',
  honduran: 'Honduran', nicaraguan: 'Nicaraguan', salvadoran: 'Salvadoran', centralam: 'Other Central American',
  southam: 'South American', spanish: 'Spaniard', otherhisp: 'Other Hispanic',
};
/** Asian groups (B02015). */
export const ASIAN_GROUP = {
  chinese: 'Chinese', filipino: 'Filipino', vietnamese: 'Vietnamese', korean: 'Korean', japanese: 'Japanese',
  indian: 'Indian', hmong: 'Hmong', cambodian: 'Cambodian', lao: 'Lao', thai: 'Thai', pakistani: 'Pakistani',
  bangladeshi: 'Bangladeshi', sikh: 'Sikh', afghan: 'Afghan', burmese: 'Burmese', indonesian: 'Indonesian',
  otherasian: 'Other Asian',
};
/** Ancestries (B04006). */
export const ANCESTRY = {
  armenian: 'Armenian', iranian: 'Iranian', arab: 'Arab', assyrian: 'Assyrian', russian: 'Russian', ukrainian: 'Ukrainian',
  polish: 'Polish', irish: 'Irish', italian: 'Italian', german: 'German', english: 'English', scottish: 'Scottish',
  scotchirish: 'Scotch-Irish', french: 'French', portuguese: 'Portuguese', dutch: 'Dutch', swedish: 'Swedish',
  norwegian: 'Norwegian', danish: 'Danish', greek: 'Greek', basque: 'Basque', turkish: 'Turkish',
  african: 'Sub-Saharan African', westindian: 'West Indian', american: 'American', israeli: 'Israeli',
  brazilian: 'Brazilian', australian: 'Australian', canadian: 'Canadian', swiss: 'Swiss', hungarian: 'Hungarian',
  czech: 'Czech', romanian: 'Romanian', egyptian: 'Egyptian', lebanese: 'Lebanese', ethiopian: 'Ethiopian',
  nigerian: 'Nigerian', jamaican: 'Jamaican',
};
/** Commute modes (B08301). */
export const ACS_COMMUTE = {
  drove: 'Drove alone', carpool: 'Carpool', bus: 'Bus', rail: 'Rail', ferry: 'Ferry', taxi: 'Taxi', motorcycle: 'Motorcycle',
  bike: 'Bike', walk: 'Walk', other: 'Other', wfh: 'Worked from home',
};

/** Words for the dimensions a fidelity check (pop.validate) may report. */
export const FIDELITY_DIMENSION = {
  type: 'Household type', hht: 'Household type', size: 'Household size', hhsize: 'Household size', age: 'Age',
  sex: 'Sex', race: 'Race and ethnicity', heritage: 'Heritage', mode: 'Commute mode', comm: 'Commute mode',
  ctime: 'Commute time', tenure: 'Tenure', own: 'Tenure', vehicles: 'Vehicles', veh: 'Vehicles', occ: 'Occupation',
  occupation: 'Occupation', edu: 'Education', education: 'Education', hinc: 'Household income', income: 'Household income',
  emp: 'Employment', workers: 'Employment', lang: 'Language at home', language: 'Language at home', mar: 'Marital status',
  marital: 'Marital status', nat: 'Nativity', nativity: 'Nativity', school: 'School', sch: 'School', dwelling: 'Dwelling',
};

/** A road from the population (a string or a world.roadsNear record) as "I-80". */
export function roadLabel(road) {
  if (!road) return null;
  if (typeof road === 'string') return road;
  return road.name || (road.kind && road.route ? `${road.kind === 'I' ? 'I-' : road.kind + ' '}${road.route}` : null);
}

/** A person's name record (or a plain string) as the name to show. */
export function displayName(name) {
  if (!name) return 'Unnamed resident';
  if (typeof name === 'string') return name;
  return name.display || name.full || [name.first, name.last].filter(Boolean).join(' ') || 'Unnamed resident';
}

/** Dialect keys (CONTRACTS section 7) as names; region keys fall back to the world's region names. */
export const DIALECT = {
  sf: 'San Francisco', eastbay: 'East Bay', southbay: 'South Bay', peninsula: 'Peninsula', northbay: 'North Bay',
  sacramento: 'Sacramento', 'valley-north': 'North Valley', 'valley-south': 'South Valley', fresno: 'Fresno', kern: 'Kern County',
  'la-westside': 'LA Westside', 'la-eastside': 'LA Eastside', sfv: 'San Fernando Valley', 'la-south': 'South LA',
  'southbay-la': 'LA South Bay', longbeach: 'Long Beach', sgv: 'San Gabriel Valley', 'oc-coast': 'Coastal Orange County',
  'oc-inland': 'Inland Orange County', ie: 'Inland Empire', 'desert-cv': 'Coachella Valley', 'high-desert': 'High Desert',
  'sd-coast': 'Coastal San Diego', 'sd-inland': 'Inland San Diego', imperial: 'Imperial Valley', 'central-coast': 'Central Coast',
  salinas: 'Salinas Valley', 'north-coast': 'North Coast', 'far-north': 'Far North', tahoe: 'Tahoe', 'gold-country': 'Gold Country',
  'eastern-sierra': 'Eastern Sierra', la: 'Los Angeles', oc: 'Orange County', sd: 'San Diego', ba: 'Bay Area',
};

/**
 * A persona's speech profile in words: numbers in 0..1 (verbosity, slang, humor, directness) become phrases.
 * @param {{verbosity?: number|string, slang?: number|string, humor?: number|string, humorStyle?: string, directness?: number|string}} sp
 * @returns {string[]}
 */
export function speechWords(sp) {
  if (!sp) return [];
  const pick = (v, lo, mid, hi) => (typeof v === 'string' ? v : typeof v === 'number' && Number.isFinite(v) ? (v < 0.35 ? lo : v > 0.65 ? hi : mid) : null);
  const humor = typeof sp.humor === 'number' && sp.humor < 0.3 ? 'rarely jokes'
    : sp.humorStyle ? `${sp.humorStyle} humor` : pick(sp.humor, 'rarely jokes', 'some humor', 'jokes a lot');
  return [
    pick(sp.verbosity, 'says little', 'average talker', 'talkative'),
    pick(sp.directness, 'diplomatic', null, 'direct'),
    humor,
    pick(sp.slang, null, 'some slang', 'lots of slang'),
  ].filter(Boolean);
}
