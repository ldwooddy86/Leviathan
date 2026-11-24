// Legion · persona: who an NPC is, beyond the census record.
//
// persona(world, npc, opts) turns one layer 1 NPC (population.mjs) into a character: a Big Five profile and
// the adjectives it earns, a life-role archetype, Schwartz values, interests grounded in the place, the worries
// the data gives their ZIP (each with the datum behind it), memories of the fires, storms, wind events and
// records that happened while they lived there, what they know about the area, how they talk, a short bio and
// the things they would bring up unprompted. It also resolves the places their day happens in (the routine that
// schedule.mjs turns into a day plan), because the schedule receives no world.
//
// Everything is a pure function of the pack, the NPC record (its seed drives the individual draws; household
// facts such as the roof, the wedding year, when the family came to the county, churchgoing, the school runs and
// the family outings are drawn from the household id so every member agrees) and the time t used for the weather
// (default: the NWS snapshot). No Math.random, no clock reads. With a population at hand, those household facts
// read every member (layer 0's days, layer 1's birthplaces and arrivals), so each member's persona tells the same
// story: who drives whom to school, that no child came to the county before the family did.
//
// Work is read by Census occupation group (layer 0's PersonCore.occ), never by the layer 1 job key: the key is a
// job slug ('tractor-driver'), the group ('farming') is what archetypes, heat exposure, registers and interests
// are keyed on. Without a population the group comes from occupations.mjs's catalog, then from the job title.
//
// Representation rule 1 is structural here. personality() receives only the basis traitBasis() builds (seed,
// age, sex, density); archetype and values read a life basis that holds no race, heritage, nativity, language,
// religion or name. Heritage reaches the persona in three modest, generation-modulated places only: one
// optional cultural tradition among the interests (never the first two), code-switching in speech, and, for
// immigrants, the family-abroad concern and the arrival memory (nativity facts, not traits).

import { Rng, hash2, hash3, hashStr, u01, clamp, lerp, smoothstep } from './rng.mjs';
import * as Occupations from './occupations.mjs';
import { busyIntervals } from './schedule.mjs';

/** Bumped when the persona model changes shape or meaning. */
export const PERSONA_VERSION = 2;

/** The population's reference year (layer 1: birthYear = 2026 - age). */
export const REF_YEAR = 2026;

/** The ten basic human values (Schwartz 1992), in the names persona.values uses. */
export const SCHWARTZ_VALUES = ['self-direction', 'stimulation', 'hedonism', 'achievement', 'power', 'security', 'conformity', 'tradition', 'benevolence', 'universalism'];

/** NPC fields that must never reach personality, traits, values or the archetype (representation rule 1). */
export const PROTECTED_FIELDS = ['race', 'heritage', 'heritageLabel', 'nativity', 'generation', 'arrivalYear', 'birthplace', 'languages', 'name', 'religion'];

/** Concern topic → the dialogue topic it belongs to (mind.mjs topic vocabulary). */
export const CONCERN_AREAS = {
  insurance: 'insurance', fire: 'fire', smoke: 'fire', heat: 'weather', storms: 'weather', flooding: 'weather',
  wind: 'weather', 'power shutoffs': 'weather', snow: 'weather', housing: 'housing', rent: 'rent', commute: 'traffic',
  roof: 'housing', earthquakes: 'neighborhood', jobs: 'job', water: 'job', health: 'health', schools: 'school',
  'family abroad': 'family',
};

// Salts: one independent random stream per facet, so adding a draw to one facet never moves another.
const S = {
  big5: 0x0b15e5, traits: 0x7a175, values: 0x5c4a12, arch: 0xa7c4e, residence: 0x4e5d1, roof: 0x200f1,
  marry: 0x3a771, practice: 0xc4c4c, teams: 0x7ea35, interests: 0x1a7e5, tradition: 0x7ad17, memories: 0x3e301,
  speech: 0x5bec4, places: 0x91ace, hooks: 0x400c5, life: 0x11fe0, county: 0xc0717, family: 0xfa3117, lines: 0x11e5,
};

// ---------------------------------------------------------------- small helpers

const isNum = v => typeof v === 'number' && Number.isFinite(v);
const num = (v, d = 0) => (isNum(v) ? v : d);
const round = (v, k = 2) => { const f = 10 ** k; return Math.round(v * f) / f; };
const rngFor = (seed, salt) => new Rng(hash2(seed >>> 0, salt));
const str = v => (typeof v === 'string' && v.trim() ? v.trim() : null);
/** A pack name for prose: trimmed, inner runs of whitespace collapsed (the pack has a few doubled spaces). */
const clean = v => { const t = str(v); return t ? t.replace(/\s+/g, ' ') : null; };
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "1,203" without depending on Intl. */
function fmtInt(n) {
  const s = String(Math.round(Math.abs(n)));
  return (n < 0 ? '-' : '') + s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
/** "$1,450,400" (the ACS caps: $2,000,001 reads "$2,000,000+", $250,001 "$250,000+"). */
function fmtMoney(n) {
  if (n >= 2000001) return '$2,000,000+';
  if (n === 250001) return '$250,000+';
  return '$' + fmtInt(n);
}
const fmt1 = n => String(round(n, 1));

/** 'YYYYMMDD' or 'YYYY-MM-DD' (or 'YYYY') → {y, m, d, iso} or null. */
function parseDate(s) {
  if (s === null || s === undefined) return null;
  const t = String(s);
  let m = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(t);
  if (m) return { y: +m[1], m: +m[2], d: +m[3], iso: `${m[1]}-${m[2]}-${m[3]}` };
  m = /^(\d{4})$/.exec(t);
  return m ? { y: +m[1], m: null, d: null, iso: null } : null;
}
const monthYear = dt => (dt.m ? `${MONTHS[dt.m - 1]} ${dt.y}` : String(dt.y));
const fullDate = dt => (dt.m ? `${MONTHS[dt.m - 1]} ${dt.d}, ${dt.y}` : String(dt.y));

/** "a" or "an" for a phrase. */
function article(phrase) {
  const p = String(phrase || '').toLowerCase();
  if (/^(uni|use|usu|one|eu|ur)/.test(p)) return 'a';
  if (/^(hour|honest|heir)/.test(p)) return 'an';
  return /^[aeiou]/.test(p) ? 'an' : 'a';
}
const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s);
const lowerFirst = s => (s && /^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);
function listJoin(items) {
  const a = items.filter(Boolean);
  if (a.length <= 1) return a[0] || '';
  if (a.length === 2) return `${a[0]} and ${a[1]}`;
  return `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`;
}
const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const numWord = n => NUMBER_WORDS[n] || String(n);

// NWS and COOP station-name abbreviations, spelled out ('' drops the word)
const STATION_WORDS = {
  ap: 'Airport', apt: 'Airport', arpt: 'Airport', intl: 'International', muni: 'Municipal', dwtn: 'Downtown', rs: 'Ranger Station',
  wfo: 'Weather Office', is: 'Island', co: 'County', cty: 'County', mtn: 'Mountain', mtns: 'Mountains', vly: 'Valley',
  pk: 'Peak', cyn: 'Canyon', lk: 'Lake', res: 'Reservoir', hq: 'Headquarters', fs: 'Fire Station', afb: 'Air Force Base',
  nas: 'Naval Air Station', usc: 'USC', ucla: 'UCLA', uc: 'UC', asos: '', awos: '', fc: '', nws: 'NWS', ws: '', cdf: 'CAL FIRE',
  ca: '', nr: 'near', st: 'St.', ft: 'Fort', mt: 'Mount', pt: 'Point', spgs: 'Springs', jct: 'Junction', plt: 'Plant', ctr: 'Center', fld: 'Field', stn: 'Station',
};
/**
 * A readable NWS/COOP station name: "Santa Monica Muni Ap" → "Santa Monica Municipal Airport",
 * "Eureka Wfo Woodley Is" → "Eureka Weather Office Woodley Island". Null for an empty name.
 * @param {string} s
 * @returns {string|null}
 */
export function stationName(s) {
  const raw = str(s);
  if (!raw) return null;
  const words = raw.split(/\s+/).map(w => w.split('/').map(part => {
    const key = part.replace(/[^A-Za-z]/g, '').toLowerCase();
    if (/^[A-Za-z]*-?\d+$/.test(part) && /\d/.test(part)) return '';
    if (key in STATION_WORDS) return STATION_WORDS[key];
    return part.length > 1 && part === part.toUpperCase() && /^[A-Z]+$/.test(part) ? part[0] + part.slice(1).toLowerCase() : part;
  }).filter(Boolean).join('/'));
  return words.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim() || raw;
}

const DIRS = { n: 'northern', s: 'southern', e: 'eastern', w: 'western', ne: 'northeastern', nw: 'northwestern', se: 'southeastern', sw: 'southwestern', 'w/s': 'western and southern' };
/**
 * An NWS event location as a phrase: "7 Nw Castaic Lake" → "near Castaic Lake", "Se S.J. Valley" → "in southeastern
 * San Joaquin Valley", "San Diego County Valleys" → "in the San Diego County Valleys". Empty for no location.
 * @param {string} where
 * @returns {string}
 */
export function wherePhrase(where) {
  const w = str(where);
  if (!w) return '';
  const tidy = t => t.replace(/\s+/g, ' ').replace(/\bS\.J\./g, 'San Joaquin').replace(/\bCty\b/g, 'County').replace(/\bMtns\b/g, 'Mountains').replace(/\bVly\b/g, 'Valley')
    .replace(/(?<=\S\s)(And|The|Of|In|At|Near)\b/g, word => word.toLowerCase()).replace(/^The\b/, 'the'); // NWS title case: "Hills And The Diablo Range"
  let m = /^\d+\s+[NSEW]{1,3}\s+(.+)$/i.exec(w);
  if (m) return `near ${tidy(m[1])}`;
  m = /^(N|S|E|W|Ne|Nw|Se|Sw|W\/S)\s+(.+)$/.exec(w);
  if (m) return `in ${DIRS[m[1].toLowerCase()]} ${tidy(m[2])}`;
  // an area ("the San Diego County Valleys", "the East Bay Hills") takes "the"; a town or a county does not
  const area = /\b(valleys?|mountains|hills|range|ranges|coast|foothills|deserts?|delta|basin|islands|area|mesas?|plains|peninsula|beaches|highlands|sierra)$/i.test(w);
  return `in ${area && !/^the\b/i.test(w) ? 'the ' : ''}${tidy(w)}`;
}

/** "the Woolsey Fire", "the Sawtooth Complex", "the Camp Fire". */
function fireName(name) {
  const n = clean(name) || 'unnamed';
  return /\b(fire|complex|fires)$/i.test(n) ? `the ${n}` : `the ${n} Fire`;
}

/**
 * What the family calls a household member: the nickname of the display name ("Bobby Lee") when it has one, else
 * the first name; household.members entries carry name (display) and first, older ones a name object.
 */
function memberName(x) {
  if (!x) return null;
  if (typeof x.name === 'string') {
    const display = str(x.name), first = str(x.first);
    // the display name is "<nick or first> <last>": the given name may have more than one word ("Mary Ann")
    if (display && first && display.startsWith(first + ' ')) return first;
    return display ? str(display.split(/\s+/)[0]) : first;
  }
  if (x.name && typeof x.name === 'object') return str(x.name.nick) || str(x.name.first) || str(x.name.display);
  return str(x.first);
}

// ---------------------------------------------------------------- per-world caches (pure functions of the pack)

const WORLD_INFO = new WeakMap();
const ZIP_INFO = new WeakMap();
const WEATHER = new WeakMap();

const DESERTS = new Set(['Mojave Desert', 'Colorado Desert', 'Basin and Range']);

/** World-wide lookups built once per world: ski towns, the coast, city → county. */
function worldInfo(world) {
  let w = WORLD_INFO.get(world);
  if (w) return w;
  const z = world.z;
  const skiTowns = [], coast = [];
  for (let i = 0; i < world.N; i++) {
    const snow = z.snowfall_in[i], psf = num(z.snow_psf[i]), pop = num(z.pop[i]);
    if (pop >= 800 && ((isNum(snow) && snow >= 50) || (!isNum(snow) && psf >= 240 && num(z.elev_m[i]) >= 1500))) skiTowns.push({ i, x: z.tx[i], y: z.ty[i], city: z.city[i] });
    if (num(z.coast_km[i], 99) <= 2.5 && pop > 0) coast.push({ i, x: z.tx[i], y: z.ty[i], city: z.city[i] });
  }
  const cityCounty = new Map();
  for (const c of world.pack.cities || []) if (c && c[0]) cityCounty.set(String(c[0]).toLowerCase(), c[1]);
  for (const p of world.places || []) if (p && p.name && !cityCounty.has(p.name.toLowerCase())) cityCounty.set(p.name.toLowerCase(), p.county);
  let labels = null;
  try { labels = world.acsLabels('occ'); } catch { labels = null; }
  const groups = new Set(Array.isArray(labels) && labels.length ? labels : OCC_GROUPS_FALLBACK);
  w = { skiTowns, coast, cityCounty, groups };
  WORLD_INFO.set(world, w);
  return w;
}

// ---------------------------------------------------------------- occupation groups

// The 25 Census occupation groups (C24010 leaves) in case a pack lacks the label list.
const OCC_GROUPS_FALLBACK = ['management', 'business', 'computer', 'engineering', 'science', 'social', 'legal', 'education', 'arts',
  'practitioner', 'healthtech', 'healthsupport', 'firefighting', 'police', 'food', 'cleaning', 'personalcare', 'sales', 'office',
  'farming', 'construction', 'repair', 'production', 'transport', 'moving'];

let KEY_GROUP = null;
/** A job key's Census group from occupations.mjs's catalog (read as data: a missing catalog just finds nothing). */
function catalogGroup(key) {
  if (!KEY_GROUP) {
    KEY_GROUP = new Map();
    const cat = Occupations && Occupations.OCCUPATION_CATALOG;
    if (cat && typeof cat === 'object') {
      for (const [group, list] of Object.entries(cat)) {
        if (!Array.isArray(list)) continue;
        for (const x of list) if (x && typeof x.key === 'string' && !KEY_GROUP.has(x.key)) KEY_GROUP.set(x.key, group);
      }
    }
  }
  return KEY_GROUP.get(key) || null;
}

// A job title's Census group, for records whose key no catalog knows. First match wins, so the specific
// titles come before the generic words they contain ('loan officer' before 'officer', 'teaching assistant'
// before 'assistant').
const TITLE_GROUPS = [
  [/\b(farmers?|ranchers?|principal|superintendent|administrator|(general|operations|property|restaurant|hotel|construction|financial|marketing|sales|office|plant|store) manager|business owner|executive|ceo|director)\b/, 'management'],
  [/\b(loan|compliance) officer\b|\b(accountant|auditor|financial analyst|human resources|recruiter|claims adjuster|purchasing|buyer|consultant|event planner|logistics analyst|tax preparer|project manager|labor contractor)\b/, 'business'],
  [/\b(software|web developer|programmer|coder|data scientist|it support|network admin\w*|cybersecurity|database|qa engineer|actuary|developer)\b/, 'computer'],
  [/\b(engineer|architect|drafter|surveyor|engineering tech\w*)\b/, 'engineering'],
  [/\b(scientist|chemist|biologist|geologist|forester|psychologist|economist|urban planner|agricultural inspector|lab technician)\b/, 'science'],
  [/\b(social worker|counselor|case manager|pastor|minister|priest|rabbi|imam|clergy|chaplain|probation officer|community health worker|family therapist|youth (program )?coordinator)\b/, 'social'],
  [/\b(attorney|lawyer|paralegal|judge|court reporter|title examiner|legal assistant)\b/, 'legal'],
  [/\b(teacher|teaching assistant|professor|instructor|lecturer|tutor|librarian)\b/, 'education'],
  [/\b(designer|actor|actress|writer|musician|photographer|reporter|editor|animator|artist|grip|coach|sound engineer|set carpenter)\b/, 'arts'],
  [/\b(registered nurse|nurse practitioner|physician(?! assistant)|doctor|surgeon|dentist|pharmacist|veterinarian|chiropractor|physician assistant|(physical|occupational|respiratory) therapist|speech[\w -]*pathologist)\b/, 'practitioner'],
  [/\b(vocational nurse|lvn|lpn|emt|paramedic|technologist|hygienist|pharmacy tech\w*|sonographer|ultrasound|surgical tech\w*|medical lab|medical records|optician|vet(erinary)? tech\w*)\b/, 'healthtech'],
  [/\b(nursing assistant|cna|home health|caregiver|medical assistant|dental assistant|phlebotomist|aide|psychiatric tech\w*|veterinary assistant)\b/, 'healthsupport'],
  [/\b(nurse|rn)\b/, 'practitioner'],
  [/\b(firefighter|fire captain|fire inspector|security guard|security|lifeguard|crossing guard|screener|animal control|loss prevention)\b/, 'firefighting'],
  [/\b(police|sheriff|deputy|correctional|detective|highway patrol|game warden|officer)\b/, 'police'],
  [/\b(cook|chef|server|waiter|waitress|barista|bartender|dishwasher|fast food|restaurant host|pastry)\b/, 'food'],
  [/\b(janitor|housekeeper|house cleaner|cleaner|landscaper|tree trimmer|groundskeeper|pest control|pool (service )?tech\w*|gardener)\b/, 'cleaning'],
  [/\b(childcare|nanny|hairstylist|barber|nail tech\w*|fitness trainer|personal trainer|recreation|amusement|ski (lift|instructor)|groomer|tour guide|casino|funeral)\b/, 'personalcare'],
  [/\b(cashier|sales|retail|real estate|realtor|insurance agent|store supervisor|account executive|vendor|parts counter)\b/, 'sales'],
  [/\b(clerk|administrative assistant|receptionist|customer service|bookkeeper|dispatcher|bank teller|teller|mail carrier|secretary|eligibility worker|motor vehicle representative)\b/, 'office'],
  [/\b(farmworker|farm worker|field worker|picker|harvester|orchard|vineyard|dairy|ranch hand|nursery|greenhouse|forestry|logger|fishing|deckhand|trimmer|irrigat\w*|produce sorter|tractor driver)\b/, 'farming'],
  [/\b(carpenter|electrician|plumber|construction|roofer|painter|drywall|equipment operator|solar panel installer|concrete|ironworker|foreman|building inspector|tile setter|mason|laborer)\b/, 'construction'],
  [/\b(mechanic|hvac|maintenance tech\w*|lineworker|installer|repair|elevator tech\w*|auto body)\b/, 'repair'],
  [/\b(assembl\w*|food processing|machinist|welder|packing house|bakery worker|press operator|sewing|quality inspector|refinery|cellar|semiconductor|meat cutter|cabinetmaker|plant operator|production)\b/, 'production'],
  [/\b(truck|driver|pilot|flight attendant|parking attendant|train operator|tugboat|bus)\b/, 'transport'],
  [/\b(warehouse|forklift|longshore|crane operator|freight|stocker|packager|refuse|car wash|recycling|ramp agent|mover)\b/, 'moving'],
];

/** The Census group a job title implies, or null. */
function titleGroup(title) {
  const t = String(title || '').toLowerCase();
  if (!t.trim()) return null;
  for (const [re, g] of TITLE_GROUPS) if (re.test(t)) return g;
  return null;
}

/**
 * A worker's Census occupation group (acsLabels('occ')): layer 0's PersonCore.occ first (the contract's leaf),
 * then a record that carries the group itself, then occupations.mjs's catalog by job key, then the title.
 * Null for people with no group (active duty, not working).
 */
function occGroupOf(world, me, occ) {
  const groups = worldInfo(world).groups;
  const fromCore = me ? str(me.occ) : null;
  if (fromCore && groups.has(fromCore)) return fromCore;
  if (me && me.military) return null;
  const key = occ ? str(occ.key) : null;
  if (key && groups.has(key)) return key;
  const fromCatalog = key ? catalogGroup(key) : null;
  if (fromCatalog && groups.has(fromCatalog)) return fromCatalog;
  const fromTitle = occ ? titleGroup(occ.title) : null;
  return fromTitle && groups.has(fromTitle) ? fromTitle : null;
}

/**
 * A job title worth saying in prose: null when it is empty or only a Census group label (a placeholder some
 * records carry instead of a title). A one-word title equal to its job key ('pastor') is a real title.
 */
function jobTitle(world, occ) {
  const t = occ && typeof occ === 'object' ? clean(occ.title) : null;
  if (!t) return null;
  // "orchard worker (almonds)" reads "orchard worker in almonds" in a sentence
  return worldInfo(world).groups.has(t.toLowerCase()) ? null : t.replace(/\s*\(([^)]+)\)\s*$/, ' in $1');
}

// Work done outside or exposed to the heat: by group, narrowed by title where the group mixes indoor and outdoor
// jobs (housekeepers and landscapers are both 'cleaning'; pilots and delivery drivers both 'transport').
const OUTDOOR_GROUPS = new Set(['farming', 'construction', 'moving']);
const OUTDOOR_TITLES = {
  cleaning: /landscap|ground|tree|pool|pest|gardener/, firefighting: /fire|lifeguard|crossing|animal control/,
  transport: /truck|deliver|tow|refuse|parking|deckhand|tug|bus driver|rideshare|driver/, repair: /line|install|hvac|roof|mechanic|maintenance|elevator|body/,
  personalcare: /ski|recreation|tour|amusement/, police: /highway patrol|warden|patrol|deputy|police officer/, office: /mail carrier/,
  sales: /street vendor/, science: /forest|wildlife|environmental|geolog|agricultural/, arts: /grip|set|coach/,
};
/** True when the job keeps them outdoors (heat exposure, weather on the shift). */
function outdoorWork(group, title) {
  if (!group) return false;
  if (OUTDOOR_GROUPS.has(group)) return true;
  const re = OUTDOOR_TITLES[group];
  if (!re) return false;
  const t = String(title || '').toLowerCase();
  // with no title to tell, the groups that are mostly outdoor work count (the Census group alone)
  return t ? re.test(t) : ['cleaning', 'transport', 'repair', 'firefighting'].includes(group);
}

// The Census groups in plain words, for prose ("works in health care").
const GROUP_WORDS = {
  management: 'management', business: 'business and finance', computer: 'computing', engineering: 'engineering', science: 'science',
  social: 'social services', legal: 'law', education: 'education', arts: 'the arts and media', practitioner: 'health care', healthtech: 'health care',
  healthsupport: 'health care', firefighting: 'protective services', police: 'law enforcement', food: 'food service', cleaning: 'building and grounds work',
  personalcare: 'personal care', sales: 'sales', office: 'office work', farming: 'farming', construction: 'construction', repair: 'repair work',
  production: 'production', transport: 'transportation', moving: 'warehousing and moving',
};
/** "as a registered nurse" when the job has a title, else "in health care" (the Census group in words). */
function jobWords(L) {
  return L.jobTitle ? `as ${article(L.jobTitle)} ${lowerFirst(L.jobTitle)}` : `in ${GROUP_WORDS[L.occKey] || 'their line of work'}`;
}

/**
 * True when the job is farm work, whatever its Census group (farmers are managers, farm truck drivers transport);
 * the farming group's loggers, forestry crews and fishing deckhands are not.
 */
function farmWork(group, title) {
  const t = String(title || '').toLowerCase();
  if (group === 'farming') return !/\b(logger|forestry|fishing|deckhand)\b/.test(t);
  return /\b(farm\w*|ranch\w*|orchard|vineyard|dairy|grower|crops?|harvest\w*|agricultur\w*)\b/.test(t);
}

function safeAcs(world, zi, block) {
  try { return world.acs(zi, block) || []; } catch { return []; }
}

/** Derived per-ZIP facts the persona reads often. */
function zipInfo(world, zi) {
  let arr = ZIP_INFO.get(world);
  if (!arr) ZIP_INFO.set(world, arr = new Array(world.N));
  let zc = arr[zi];
  if (zc) return zc;
  const z = world.zip(zi);
  const emp = safeAcs(world, zi, 'emp');
  const lf = num(emp[0]) + num(emp[1]);
  const density = num(z.density);
  zc = {
    z,
    density,
    urban: density >= 8000, core: density >= 10000, suburban: density >= 1500 && density < 8000,
    rural: density < 300 && num(z.inc, 60000) < 150000 && num(z.value, 400000) < 1000000,
    urate: lf >= 80 ? (100 * num(emp[1])) / lf : null,
    churchPer10k: num(z.pop) > 0 ? (10000 * num(z.church)) / z.pop : 0,
    seasonalShare: num(z.hu) > 0 ? num(z.seas) / z.hu : 0,
    desert: DESERTS.has(z.provinceName) || z.cz === 14 || z.cz === 15,
    valley: z.provinceName === 'Great Valley',
    county: world.countyOf(zi),
    fires: world.firesOf(zi) || [],
    ars: world.arsOf(zi, 12) || [],
    winds: world.windsOf(zi, 10) || [],
    fema: world.femaOf(zi) || [],
  };
  arr[zi] = zc;
  return zc;
}

/** world.weatherAt memoized on the exact (zi, t), so repeated personas at one time cost one lookup. */
function weatherOf(world, zi, t) {
  let m = WEATHER.get(world);
  if (!m) WEATHER.set(world, m = new Map());
  const key = `${zi}:${t}`;
  if (m.has(key)) return m.get(key);
  let w = null;
  try { w = world.weatherAt(zi, t); } catch { w = null; }
  if (m.size > 5000) m.clear();
  m.set(key, w);
  return w;
}

// ---------------------------------------------------------------- reading the NPC (defensively)

/** Age in whole years (from age, else the birth year). */
function ageOf(npc) {
  if (isNum(npc?.age)) return clamp(Math.round(npc.age), 0, 110);
  if (isNum(npc?.birthYear)) return clamp(REF_YEAR - Math.round(npc.birthYear), 0, 110);
  return 35;
}
const birthYearOf = npc => (isNum(npc?.birthYear) ? Math.round(npc.birthYear) : REF_YEAR - ageOf(npc));
const seedOf = npc => (isNum(npc?.seed) ? npc.seed >>> 0 : hashStr(String(npc?.id ?? 'npc'), 0x5eed));
const sexOf = npc => (npc?.sex === 'F' || npc?.sex === 'M' ? npc.sex : null);

function zipIndexOf(world, npc) {
  if (Number.isInteger(npc?.zi) && npc.zi >= 0 && npc.zi < world.N) return npc.zi;
  const zip = npc?.zip ?? npc?.place?.zip ?? (typeof npc?.id === 'string' ? npc.id.slice(0, 5) : null);
  return zip ? world.indexOf(zip) : -1;
}

const validPoint = p => (p && isNum(p.x) && isNum(p.y) ? { x: p.x, y: p.y } : null);

/** Layer 0 for this NPC's household, when a population is at hand ({hh, me} or null). */
function layer0(pop, zi, npc) {
  if (!pop || typeof pop.householdCore !== 'function' || !Number.isInteger(npc?.h)) return null;
  try {
    const hh = pop.householdCore(zi, npc.h);
    if (!hh || !Array.isArray(hh.members)) return null;
    const m = Number.isInteger(npc.m) ? npc.m : 0;
    return { hh, me: hh.members[m] || null };
  } catch {
    return null;
  }
}

/** Normalize a shift label and the layer 0 times to 'early' | 'day' | 'evening' | 'night'. */
function shiftOf(label, departMin, commuteMin) {
  if (isNum(departMin)) {
    const start = (departMin + num(commuteMin)) % 1440;
    if (start >= 20 * 60 || start < 3 * 60) return 'night';
    if (start >= 13 * 60 + 30) return 'evening';
    if (start < 6 * 60) return 'early';
    return 'day';
  }
  const s = String(label || '').toLowerCase();
  if (/night|grave|overnight|noc/.test(s)) return 'night';
  if (/even|swing|late|second/.test(s)) return 'evening';
  if (/early|dawn|first/.test(s)) return 'early';
  return 'day';
}

const ADULT_ROLES = new Set(['householder', 'spouse', 'partner']);

/** The household seen from this NPC: partner, kids, grandkids, parents, siblings, roommates (no names). */
function relationsOf(npc, members) {
  const me = Number.isInteger(npc?.m) ? npc.m : -1;
  const others = (Array.isArray(members) ? members : []).filter(x => x && x.m !== me);
  const by = (...roles) => others.filter(x => roles.includes(x.role));
  const out = { partner: null, kids: [], grandkids: [], parents: [], grandparents: [], siblings: [], roommates: [], relatives: [] };
  const role = npc?.role || 'householder';
  if (role === 'householder') {
    out.partner = by('spouse')[0] || by('partner')[0] || null;
    out.kids = by('child'); out.grandkids = by('grandchild'); out.parents = by('parent');
    out.siblings = by('sibling'); out.roommates = by('roommate'); out.relatives = by('relative');
  } else if (role === 'spouse' || role === 'partner') {
    out.partner = by('householder')[0] || null;
    out.kids = by('child'); out.grandkids = by('grandchild'); out.roommates = by('roommate');
    out.relatives = by('parent', 'sibling', 'relative');
  } else if (role === 'child') {
    out.parents = by('householder', 'spouse', 'partner'); out.siblings = by('child'); out.grandparents = by('parent');
    out.relatives = by('grandchild', 'sibling', 'relative');
  } else if (role === 'grandchild') {
    out.grandparents = by('householder', 'spouse', 'partner'); out.siblings = by('grandchild');
    out.relatives = by('child', 'parent', 'sibling', 'relative');
  } else if (role === 'parent') {
    out.kids = by('householder', 'sibling'); out.grandkids = by('child'); out.partner = by('parent')[0] || null;
    out.relatives = by('spouse', 'partner', 'grandchild', 'relative');
  } else if (role === 'sibling') {
    out.siblings = by('householder', 'sibling'); out.parents = by('parent');
    out.relatives = by('spouse', 'partner', 'child', 'grandchild', 'relative');
  } else if (role === 'roommate') {
    out.roommates = others;
  } else {
    out.relatives = others;
  }
  // grown children elsewhere are invisible; only kids who could be theirs count as their kids
  const myAge = ageOf(npc);
  out.kids = out.kids.filter(k => isNum(k.age) && k.age <= myAge - 15);
  return out;
}

/**
 * Everything about the NPC's life the archetype and the values may read: age, sex, household, work and
 * schedule. Built field by field from allowed inputs only (no names, heritage, race, nativity, languages).
 */
function lifeBasis(ctx) {
  const { npc, hh, core, zc } = ctx;
  const me = core && core.me;
  const age = ageOf(npc);
  const occ = npc.occupation && typeof npc.occupation === 'object' ? npc.occupation : null;
  const cm = npc.commute && typeof npc.commute === 'object' ? npc.commute : {};
  const mode = me ? me.mode ?? null : cm.mode ?? null;
  const departMin = me ? me.departMin : cm.departMin;
  const commuteMin = num(me ? me.commuteMin : cm.minutes);
  const dwellMin = num(me ? me.dwellMin : cm.dwellMin);
  const days = num(me ? me.days : cm.days);
  const statusRaw = str(npc.status);
  const worker = me ? !!me.worker : statusRaw ? statusRaw === 'employed' || statusRaw === 'military' : !!occ;
  const military = statusRaw === 'military' || !!(me && me.military);
  const studentRaw = me && me.student ? me.student : null;
  const school = str(npc.school);
  const student = studentRaw === 'grad' || school === 'grad' ? 'grad'
    : studentRaw === 'college' || school === 'college' ? 'college'
      : studentRaw === 'k12' || ['elementary', 'middle', 'high'].includes(school) ? 'k12'
        : studentRaw === 'preschool' || school === 'preschool' ? 'preschool' : null;
  const status = statusRaw || (worker ? 'employed' : age < 18 ? 'child' : age >= 65 ? 'retired' : 'not working');
  const rel = relationsOf(npc, hh.members);
  const kidAges = rel.kids.map(k => k.age).filter(isNum);
  const youngest = kidAges.length ? Math.min(...kidAges) : null;
  const isParent = kidAges.some(k => k < 18) && age >= 16; // raising children (grown kids at home do not count)
  const occKey = worker ? occGroupOf(ctx.world, me, occ) : null;
  const occTitle = occ ? str(occ.title) : null;
  return {
    age, sex: sexOf(npc), role: str(npc.role) || 'householder', status,
    worker, military, student, school,
    retired: status === 'retired' || (!worker && age >= 62 && !['homemaker', 'unemployed', 'student'].includes(status)),
    homemaker: status === 'homemaker', unemployed: status === 'unemployed',
    education: str(npc.education),
    occKey, occTitle,
    jobTitle: jobTitle(ctx.world, occ),
    outdoor: worker && !military && outdoorWork(occKey, occTitle),
    farm: worker && !military && farmWork(occKey, occTitle),
    wfh: mode === 'wfh' || !!(occ && occ.wfh && mode !== 'drive'),
    mode, departMin: isNum(departMin) ? departMin : null, commuteMin, dwellMin, days,
    shift: shiftOf(occ && occ.shift, isNum(departMin) ? departMin : null, commuteMin),
    hhType: str(hh.type) || 'alone', hhSize: num(hh.size, 1), tenure: hh.tenure === 'own' ? 'own' : hh.tenure === 'rent' ? 'rent' : null,
    dwelling: str(hh.dwelling) || 'house', vehicles: num(hh.vehicles, 1),
    yearMoved: isNum(hh.yearMoved) ? hh.yearMoved : null, yearBuilt: isNum(hh.yearBuilt) ? hh.yearBuilt : null,
    income: num(npc.income), householdIncome: num(npc.householdIncome, num(zc.z.inc, 60000)),
    veteran: !!npc.veteran, marital: str(npc.marital),
    partner: !!rel.partner, kidAges, youngestKid: youngest, isParent,
    newParent: isParent && youngest !== null && youngest <= 1 && age < 52,
    isGrandparent: rel.grandkids.length > 0 && age >= 40,
    hasHouse: (str(hh.dwelling) || 'house') === 'house',
    seasonalShare: zc.seasonalShare, density: zc.density,
  };
}

// ---------------------------------------------------------------- personality (rule 1: only seed, age, sex, density)

/**
 * The only inputs personality() may see: the NPC's seed, age, sex and the density of their ZIP. Nothing else
 * is copied, so race, heritage, nativity, languages, religion and names cannot reach the Big Five.
 * @returns {{seed:number, age:number, sex:'F'|'M'|null, density:number}}
 */
export function traitBasis(world, npc) {
  const zi = zipIndexOf(world, npc);
  return { seed: seedOf(npc), age: ageOf(npc), sex: sexOf(npc), density: zi >= 0 ? num(world.z.density[zi]) : 0 };
}

/**
 * Mean Big Five by age, sex and density on a 0..1 scale (population sd about 0.15). Age: conscientiousness dips
 * in the teens and rises through middle age, agreeableness rises, neuroticism falls, openness and extraversion
 * ease in later life (Soto et al. 2011; Roberts, Walton & Viechtbauer 2006). Sex: women slightly higher
 * agreeableness and neuroticism (Costa, Terracciano & McCrae 2001; Schmitt et al. 2008). Place: tiny.
 */
export function big5Prior({ age = 35, sex = null, density = 0 } = {}) {
  const a = clamp(num(age, 35), 0, 100);
  const C = 0.5 + (a < 12 ? -0.02 : a < 18 ? -0.05 : a < 22 ? -0.03 : lerp(-0.03, 0.06, smoothstep(22, 65, a)));
  let A = 0.5 + lerp(-0.03, 0.05, smoothstep(16, 70, a));
  let N = 0.5 + (a < 13 ? 0.01 : lerp(0.03, -0.04, smoothstep(16, 70, a)));
  let O = 0.5 + (a < 30 ? 0.01 : lerp(0.01, -0.04, smoothstep(30, 85, a)));
  const E = 0.5 + lerp(0.02, -0.03, smoothstep(18, 80, a));
  if (sex === 'F') { A += 0.025; N += 0.03; } else if (sex === 'M') { A -= 0.025; N -= 0.03; }
  const d = num(density);
  if (d >= 10000) O += 0.015; else if (d >= 4000) O += 0.008;
  return { O, C: d < 200 ? C + 0.01 : C, E, A, N };
}

const TRAIT_WORDS = {
  O: { hi: ['curious', 'imaginative', 'artistic', 'open-minded', 'inventive'], lo: ['practical', 'conventional', 'down-to-earth', 'no-nonsense'] },
  C: { hi: ['organized', 'dependable', 'punctual', 'hardworking', 'meticulous'], lo: ['easygoing', 'spontaneous', 'scattered', 'laid-back'] },
  E: { hi: ['outgoing', 'talkative', 'sociable', 'energetic', 'chatty'], lo: ['reserved', 'quiet', 'private', 'reflective'] },
  A: { hi: ['warm', 'kind', 'generous', 'patient', 'trusting'], lo: ['blunt', 'skeptical', 'competitive', 'stubborn'] },
  N: { hi: ['anxious', 'sensitive', 'moody', 'high-strung', 'excitable'], lo: ['calm', 'steady', 'unflappable', 'even-keeled'] },
};
// two strong deviations together earn a word of their own
const TRAIT_COMBOS = [
  ['E+', 'A+', 'friendly'], ['E+', 'A-', 'opinionated'], ['E-', 'O+', 'thoughtful'], ['C+', 'N+', 'perfectionist'],
  ['O+', 'E+', 'adventurous'], ['A+', 'N-', 'gentle'], ['C-', 'O+', 'free-spirited'], ['E-', 'A+', 'soft-spoken'],
  ['A-', 'N+', 'prickly'], ['C+', 'A-', 'demanding'], ['C+', 'E+', 'driven'], ['N-', 'E-', 'stoic'],
];

/** 3 to 5 adjectives from the strongest deviations of a Big Five profile. */
export function traitWords(big5, rng) {
  const dims = ['O', 'C', 'E', 'A', 'N'].map(k => ({ k, z: (num(big5[k], 0.5) - 0.5) / 0.15 })).sort((a, b) => Math.abs(b.z) - Math.abs(a.z) || (a.k < b.k ? -1 : 1));
  const n = 3 + Math.min(2, dims.filter(d => Math.abs(d.z) > 1.0).length);
  const out = [];
  const sign = d => `${d.k}${d.z >= 0 ? '+' : '-'}`;
  const strong = dims.filter(d => Math.abs(d.z) > 0.8).map(sign);
  for (const [a, b, word] of TRAIT_COMBOS) if (out.length < 1 && strong.includes(a) && strong.includes(b)) out.push(word);
  for (const d of dims) {
    if (out.length >= n) break;
    const list = TRAIT_WORDS[d.k][d.z >= 0 ? 'hi' : 'lo'];
    const start = rng.int(list.length);
    for (let j = 0; j < list.length; j++) { const w = list[(start + j) % list.length]; if (!out.includes(w)) { out.push(w); break; } }
  }
  for (const d of dims) { // a second word for the strongest dimension when the profile is flat
    if (out.length >= 3) break;
    const list = TRAIT_WORDS[d.k][d.z >= 0 ? 'hi' : 'lo'];
    const w = list.find(x => !out.includes(x));
    if (w) out.push(w);
  }
  return out;
}

/**
 * Big Five and trait adjectives from the basis alone (see traitBasis). Individual spread: a normal draw around
 * the prior with sd 0.15, clamped to [0.01, 0.99].
 * @returns {{big5:{O:number,C:number,E:number,A:number,N:number}, traits:string[]}}
 */
export function personality(basis) {
  const b = basis || {};
  const rng = rngFor(num(b.seed) >>> 0, S.big5);
  const prior = big5Prior(b);
  const big5 = {};
  for (const k of ['O', 'C', 'E', 'A', 'N']) big5[k] = round(rng.clampedNormal(prior[k], 0.15, 0.01, 0.99), 3);
  return { big5, traits: traitWords(big5, rngFor(num(b.seed) >>> 0, S.traits)) };
}

// ---------------------------------------------------------------- archetype and values (life basis + personality)

// A life-role label for workers of a Census group, refined by the job title and the shift. Each entry returns a
// label or null (null falls through to the schedule-based labels below).
const LATE = sh => sh === 'night' || sh === 'evening';
const EARLY_CREW = L => L.shift === 'early' || (isNum(L.departMin) && L.departMin < 390);
const WORK_ROLES = {
  farming: (L, t) => /logger/.test(t) ? 'logger' : /fishing|deckhand/.test(t) ? 'fishing-boat deckhand' : /forestry/.test(t) ? 'forestry worker'
    : EARLY_CREW(L) ? 'farmworker on the morning crew' : 'farmworker',
  transport: (L, t, r) => /pilot/.test(t) ? 'pilot' : /flight attendant/.test(t) ? 'flight attendant' : /school bus/.test(t) ? 'school bus driver'
    : /train/.test(t) ? 'train operator' : /\bbus\b|transit/.test(t) ? 'bus driver' : /rideshare/.test(t) ? 'rideshare driver' : /\btow\b/.test(t) ? 'tow truck driver'
      : /farm truck/.test(t) ? 'farm truck driver' : /tug|deckhand/.test(t) ? 'tugboat deckhand' : /parking/.test(t) ? 'parking attendant'
        : /truck|tractor-trailer|freight|haul/.test(t) ? (L.commuteMin >= 40 || r.float() < 0.45 ? 'long-haul trucker' : 'local trucker')
          : L.shift === 'night' ? 'night-shift driver' : 'delivery driver',
  practitioner: (L, t) => healthRole(L, t, 'practitioner'), healthtech: (L, t) => healthRole(L, t, 'healthtech'), healthsupport: (L, t) => healthRole(L, t, 'healthsupport'),
  firefighting: (L, t) => /wildland/.test(t) ? 'wildland firefighter' : /fire/.test(t) ? 'firefighter' : /lifeguard/.test(t) ? 'lifeguard'
    : /crossing guard/.test(t) ? 'crossing guard' : /security|loss prevention/.test(t) ? (L.shift === 'night' ? 'night-shift security guard' : 'security guard')
      : t ? null : 'firefighter',
  police: (L, t) => /correctional/.test(t) ? 'correctional officer' : /warden/.test(t) ? 'game warden' : /detective/.test(t) ? 'detective'
    : /highway patrol/.test(t) ? 'highway patrol officer' : /deputy|sheriff/.test(t) ? "sheriff's deputy" : L.shift === 'night' ? 'night-shift officer' : 'patrol officer',
  education: (L, t) => /professor|lecturer|instructor/.test(t) ? 'college instructor' : /teaching assistant|aide/.test(t) ? "teacher's aide"
    : /substitute/.test(t) ? 'substitute teacher' : /tutor/.test(t) ? 'tutor' : /librarian/.test(t) ? 'librarian' : /preschool/.test(t) ? 'preschool teacher' : 'teacher',
  food: (L, t) => /bartender/.test(t) ? (LATE(L.shift) ? 'late-shift bartender' : 'bartender') : /barista/.test(t) ? 'barista'
    : /server|waiter|waitress|host/.test(t) ? (LATE(L.shift) ? 'evening-shift server' : 'server') : /fast food/.test(t) ? 'fast-food worker'
      : LATE(L.shift) ? 'late-shift line cook' : /cook|chef|prep|kitchen|dishwasher|food truck/.test(t) || !t ? 'line cook' : 'restaurant worker',
  cleaning: (L, t) => /landscap|ground|tree|garden/.test(t) ? 'landscaper' : /pool/.test(t) ? 'pool tech' : /pest/.test(t) ? 'pest control tech'
    : /housekeep|house cleaner/.test(t) ? 'housekeeper' : L.shift === 'night' ? 'night janitor' : /janitor/.test(t) ? 'janitor' : t ? null : 'housekeeper',
  construction: (L, t) => (EARLY_CREW(L) ? 'early-shift regular' : /laborer/.test(t) ? 'construction laborer' : 'tradesperson'),
  computer: L => (L.wfh ? 'remote worker' : 'tech worker'),
  engineering: L => (L.wfh ? 'remote worker' : /architect/.test(L.occTitle || '') ? 'architect' : 'engineer'),
  management: (L, t) => (/\b(farmer|rancher)\b/.test(t) ? 'farmer' : /principal/.test(t) ? 'school principal' : /business owner|owner/.test(t) ? 'small-business owner' : null),
  social: (L, t) => (/pastor|minister|priest|clergy|rabbi|imam/.test(t) ? 'pastor' : /counselor/.test(t) ? 'counselor' : null),
  personalcare: (L, t) => (/childcare|nanny/.test(t) ? 'childcare worker' : /barber/.test(t) ? 'barber' : /hair|nail/.test(t) ? 'stylist'
    : /fitness|trainer/.test(t) ? 'fitness trainer' : /\bski\b/.test(t) ? 'ski-resort worker' : /casino/.test(t) ? 'casino dealer' : null),
  arts: (L, t) => (/coach/.test(t) ? 'coach' : /reporter/.test(t) ? 'reporter' : /grip|set carpenter|sound/.test(t) ? 'film crew member' : null),
};

function healthRole(L, t, group) {
  const nurse = /\bnurse\b|\brn\b|\blvn\b|\blpn\b/.test(t) && !/assistant|aide/.test(t);
  if (L.shift === 'night') return nurse ? 'night-shift nurse' : group === 'healthsupport' ? 'night-shift caregiver' : 'night-shift health worker';
  if (nurse) return 'nurse';
  if (/physician(?! assistant)|doctor|surgeon/.test(t)) return 'doctor';
  if (/dentist/.test(t)) return 'dentist';
  if (/veterinarian/.test(t)) return 'veterinarian';
  if (/pharmacist/.test(t)) return 'pharmacist';
  if (/emt|paramedic/.test(t)) return 'paramedic';
  return group === 'healthsupport' ? 'caregiver' : 'health-care worker';
}

function workerArchetype(L, r) {
  const k = L.occKey, title = (L.occTitle || '').toLowerCase(), sh = L.shift;
  if (L.tenure === 'own' && L.dwelling === 'small-apartment' && L.age >= 40 && r.float() < 0.35) return 'small landlord';
  const byRole = WORK_ROLES[k] ? WORK_ROLES[k](L, title, r) : null;
  if (byRole) return byRole;
  if (sh === 'night') return 'night-shift worker';
  if (sh === 'early') return 'early-shift regular';
  if (L.wfh) return 'remote worker';
  if (L.commuteMin >= 75) return 'super commuter';
  const byKey = {
    management: 'manager', business: 'office regular', legal: /paralegal|assistant|court reporter|title examiner/.test(title) ? 'paralegal' : /judge/.test(title) ? 'judge' : 'lawyer',
    science: 'lab scientist', social: 'social worker', arts: 'creative freelancer', personalcare: 'service worker',
    sales: 'retail worker', office: 'office regular', production: 'plant worker', repair: 'mechanic', moving: 'warehouse worker',
    firefighting: 'security guard', cleaning: 'janitor',
  };
  return byKey[k] || 'nine-to-fiver';
}

function retireeArchetype(L, r) {
  if (L.isGrandparent && r.float() < 0.55) return 'retired grandparent';
  if (L.tenure === 'own' && L.dwelling === 'small-apartment' && r.float() < 0.6) return 'small landlord';
  if (L.seasonalShare > 0.15 && r.float() < 0.35) return 'snowbird';
  if (L.tenure === 'own' && L.hasHouse && r.float() < 0.42) return 'retired gardener';
  if (L.veteran && r.float() < 0.5) return 'retired veteran';
  if (L.tenure === 'own' && L.householdIncome >= 150000 && r.float() < 0.15) return 'small landlord';
  return 'retiree';
}

/** A short life-role label from the life basis (age, household, work, schedule). */
export function archetypeOf(L, seed) {
  const r = rngFor(seed, S.arch);
  const a = L.age;
  if (a < 1) return 'baby of the house';
  if (a < 3) return 'toddler';
  if (a < 5) return L.student === 'preschool' ? 'preschooler' : 'little kid at home';
  if (a < 11) return 'grade-schooler';
  if (a < 14) return 'middle schooler';
  if (a < 18) return L.worker ? 'high schooler with a part-time job' : 'high schooler';
  if (L.student === 'grad') return L.worker ? 'grad student with a day job' : 'grad student';
  if (L.student === 'college') {
    if (L.worker) return 'working student';
    return L.commuteMin >= 20 && L.mode && L.mode !== 'wfh' ? 'student commuter' : 'college student';
  }
  if (L.military) return 'service member';
  if (L.newParent) return 'new parent';
  if (L.worker) return workerArchetype(L, r);
  if (L.retired) return retireeArchetype(L, r);
  if (L.homemaker) return L.isParent ? 'stay-at-home parent' : 'homemaker';
  if (L.unemployed) return 'job seeker';
  if (a < 26 && (L.role === 'child' || L.role === 'grandchild')) return 'young adult living at home';
  if (L.isParent) return 'stay-at-home parent';
  return 'neighborhood regular';
}

// Pan-cultural value hierarchy (Schwartz & Bardi 2001) as mean importance, and Big Five links (Parks-Leduc,
// Feldman & Bardi 2015): the coefficient multiplies the trait's deviation from 0.5.
const VALUE_BASE = { benevolence: 0.62, 'self-direction': 0.58, universalism: 0.56, security: 0.55, conformity: 0.5, hedonism: 0.46, achievement: 0.45, stimulation: 0.4, tradition: 0.36, power: 0.3 };
const VALUE_BIG5 = {
  'self-direction': { O: 0.45, N: -0.05 }, universalism: { O: 0.3, A: 0.2 }, stimulation: { O: 0.3, E: 0.25, C: -0.1 },
  tradition: { O: -0.2, A: 0.15, C: 0.1 }, conformity: { O: -0.2, A: 0.15, C: 0.25 }, security: { O: -0.2, C: 0.25, N: 0.12 },
  benevolence: { A: 0.45, E: 0.05 }, power: { A: -0.35, E: 0.15 }, achievement: { A: -0.2, E: 0.2, C: 0.2 }, hedonism: { E: 0.2, C: -0.1 },
};

/** Top three Schwartz values from age, life stage, income, parenthood and personality (never heritage). */
export function valuesOf(L, big5, seed) {
  const r = rngFor(seed, S.values);
  const decades = (clamp(L.age, 15, 85) - 40) / 10;
  const inc = L.householdIncome;
  const score = {};
  for (const v of SCHWARTZ_VALUES) {
    let s = VALUE_BASE[v];
    for (const [k, c] of Object.entries(VALUE_BIG5[v] || {})) s += c * (num(big5[k], 0.5) - 0.5) * 2 * 0.5;
    score[v] = s;
  }
  score.tradition += 0.035 * decades; score.conformity += 0.03 * decades; score.security += 0.025 * decades; score.benevolence += 0.015 * decades;
  score.stimulation -= 0.04 * decades; score.hedonism -= 0.035 * decades; score.power -= 0.015 * decades; score.achievement -= 0.025 * decades;
  if (L.student || (L.age >= 16 && L.age < 26)) { score.stimulation += 0.05; score.hedonism += 0.04; score['self-direction'] += 0.03; score.achievement += 0.04; }
  if (L.isParent) { score.security += 0.06; score.benevolence += 0.05; score.hedonism -= 0.04; score.stimulation -= 0.03; }
  if (L.isGrandparent) { score.benevolence += 0.04; score.tradition += 0.03; }
  if (L.retired) { score.benevolence += 0.03; score.universalism += 0.02; score.achievement -= 0.04; }
  if (L.worker) score.achievement += 0.03;
  if (L.unemployed) score.security += 0.06;
  if (inc >= 200000) { score.achievement += 0.04; score.power += 0.03; score['self-direction'] += 0.03; }
  else if (inc > 0 && inc < 40000) { score.security += 0.06; score.power -= 0.01; }
  for (const v of SCHWARTZ_VALUES) score[v] += r.normal(0, 0.05);
  return SCHWARTZ_VALUES.slice().sort((a, b) => score[b] - score[a] || (a < b ? -1 : 1)).slice(0, 3);
}

// ---------------------------------------------------------------- residence, roof, household facts

function birthplaceInCounty(world, zi, birthplace) {
  const b = str(birthplace);
  if (!b) return false;
  const m = /^(.+?),\s*(California|CA)\s*$/i.exec(b);
  if (!m) return false;
  const ci = worldInfo(world).cityCounty.get(m[1].trim().toLowerCase());
  return ci !== undefined && ci === world.z.county[zi];
}

/**
 * The household as every member must see it: each member's role, age and sex, layer 1's birth facts (birth year,
 * birthplace, nativity, arrival) and layer 0's day. With a population the other members' records come from it
 * (the NPC's own record is the one given, which callers may have edited); without one only the NPC's own record
 * and household.members are known, and the household-level facts rest on ages and roles alone.
 * @returns {{m:number, role:string, age:number|null, sex:string|null, birthYear:number|null, birthplace:string|null,
 *   nativity:string|null, arrivalYear:number|null, core:Object|null}[]}
 */
function householdView(ctx) {
  if (ctx.view) return ctx.view;
  const { npc, core, zi, pop } = ctx;
  const list = core ? core.hh.members : Array.isArray(ctx.hh.members) ? ctx.hh.members : [];
  const out = [];
  for (const x of list) {
    if (!x || !Number.isInteger(x.m)) continue;
    let rec = null;
    if (x.m === npc.m) rec = npc;
    else if (pop && typeof pop.person === 'function' && Number.isInteger(npc.h)) { try { rec = pop.person(zi, npc.h, x.m) || null; } catch { rec = null; } }
    const age = x.m === npc.m ? ageOf(npc) : isNum(x.age) ? x.age : rec && isNum(rec.age) ? rec.age : null;
    out.push({
      m: x.m, role: str(x.role) || (rec && str(rec.role)) || 'relative', age, sex: x.sex === 'F' || x.sex === 'M' ? x.sex : rec ? sexOf(rec) : null,
      birthYear: rec && isNum(rec.birthYear) ? Math.round(rec.birthYear) : isNum(age) ? REF_YEAR - age : null,
      birthplace: rec ? str(rec.birthplace) : null, nativity: rec ? str(rec.nativity) : null,
      arrivalYear: rec && rec.nativity === 'foreign' && isNum(rec.arrivalYear) ? rec.arrivalYear : null,
      core: core ? x : null,
    });
  }
  if (!out.some(x => x.m === npc.m)) {
    const age = ageOf(npc);
    out.push({ m: Number.isInteger(npc.m) ? npc.m : 0, role: str(npc.role) || 'householder', age, sex: sexOf(npc), birthYear: birthYearOf(npc), birthplace: str(npc.birthplace), nativity: str(npc.nativity), arrivalYear: npc.nativity === 'foreign' && isNum(npc.arrivalYear) ? npc.arrivalYear : null, core: null });
  }
  return (ctx.view = out);
}

/** The first year a person could have started living in the county on their own: birth for natives born there, else 18 (or arrival). */
function earliestInCounty(world, zi, p) {
  if (!isNum(p.birthYear)) return -Infinity;
  if (p.nativity !== 'foreign' && birthplaceInCounty(world, zi, p.birthplace)) return p.birthYear;
  return Math.max(p.birthYear + 18, isNum(p.arrivalYear) ? p.arrivalYear : -Infinity);
}

/**
 * When the household came to the county, drawn once from the household id so every member agrees: the move into
 * this home, or (most moves stay within a county) some years before it; no later than the birth of a child of
 * the household born in the county, and no earlier than one of the couple could have come.
 */
function householdCounty(ctx, view, hhMoved) {
  const { world, zi, npc } = ctx;
  const hr = new Rng(hash3(S.county, zi, num(npc.h)));
  const couple = view.filter(x => ADULT_ROLES.has(x.role));
  const immigrants = couple.length > 0 && couple.every(x => x.nativity === 'foreign');
  const local = hr.float() < (immigrants ? 0.3 : 0.5);
  let y = local ? hhMoved - hr.range(1, 15) : hhMoved;
  for (const k of view) {
    if ((k.role === 'child' || k.role === 'grandchild') && isNum(k.birthYear) && k.nativity !== 'foreign' && birthplaceInCounty(world, zi, k.birthplace)) y = Math.min(y, k.birthYear);
  }
  const earliest = couple.map(a => earliestInCounty(world, zi, a)).filter(v => v > -Infinity);
  if (earliest.length) y = Math.max(y, Math.min(...earliest));
  return Math.min(y, hhMoved);
}

/**
 * When this person started living in the ZIP and in the county. The household shares its move year; roommates
 * and live-in parents may have joined later; immigrants cannot predate their arrival. The household's children
 * have been in the county since the household came (or since birth, when born after); the couple came with the
 * household, or earlier on their own; people born in the county have lived there since birth.
 */
function residenceOf(ctx, L) {
  const { npc, world, zi, zc, seed } = ctx;
  const r = rngFor(seed, S.residence);
  const birthYear = birthYearOf(npc);
  const hr = new Rng(hash3(S.residence, zi, num(npc.h)));
  let hhMoved = L.yearMoved;
  if (!isNum(hhMoved)) { // the pack's median move-in year, spread by the household
    const own = num(zc.z.own_yr, 2010);
    hhMoved = clamp(Math.round(own + hr.normal(0, 7)), 1960, REF_YEAR);
  }
  hhMoved = Math.min(hhMoved, REF_YEAR);
  let zipSince = Math.max(hhMoved, birthYear);
  if (L.role === 'roommate') zipSince = Math.max(zipSince, REF_YEAR - r.range(0, 6));
  if (L.role === 'parent' || L.role === 'relative') zipSince = Math.max(zipSince, REF_YEAR - r.range(0, 12));
  const arrival = npc.nativity === 'foreign' && isNum(npc.arrivalYear) ? npc.arrivalYear : null;
  if (arrival !== null) zipSince = Math.max(zipSince, Math.min(arrival, REF_YEAR));
  zipSince = Math.min(zipSince, REF_YEAR);
  const bornHere = zipSince <= birthYear;
  const hhCounty = householdCounty(ctx, householdView(ctx), hhMoved);
  const earliest = Math.max(L.age >= 18 ? birthYear + 18 : birthYear, arrival ?? -Infinity);
  const kid = L.role === 'child' || L.role === 'grandchild';
  const nativeHere = arrival === null && birthplaceInCounty(world, zi, npc.birthplace);
  let countySince;
  if (bornHere) countySince = birthYear;
  else if (kid) countySince = Math.max(birthYear, hhCounty, arrival ?? -Infinity); // they grow up with the household
  else if (nativeHere) countySince = birthYear;
  else if (ADULT_ROLES.has(L.role)) {
    countySince = Math.max(hhCounty, earliest);
    // some lived in the county before the household did (a first apartment across town, college)
    if (r.float() < 0.3) countySince = Math.min(countySince, Math.max(earliest, hhCounty - r.range(1, 12)));
  } else {
    const local = r.float() < (arrival !== null ? 0.3 : 0.5); // most moves stay within a county
    countySince = local ? clamp(zipSince - r.range(1, 15), Math.min(earliest, zipSince), zipSince) : zipSince;
  }
  countySince = clamp(countySince, birthYear, zipSince);
  const grewUpHere = bornHere || (nativeHere && !kid) || countySince - birthYear <= 5;
  return { zipSince, countySince, grewUpHere, bornHere, householdCounty: hhCounty, yearsInZip: REF_YEAR - zipSince, yearsInCounty: REF_YEAR - countySince };
}

/** The household's roof (owners only): age, material, solar. Drawn from the household id so members agree. */
function roofOf(ctx, L) {
  if (L.tenure !== 'own' || !['house', 'mobile-home', 'small-apartment'].includes(L.dwelling)) return null;
  const z = ctx.z, r = new Rng(hash3(S.roof, ctx.zi, num(ctx.npc.h)));
  const houseAge = isNum(L.yearBuilt) ? Math.max(1, REF_YEAR - L.yearBuilt) : 40;
  let age = r.float() * 100 < num(z.ra20_sh, 26) ? 20 + r.int(14) : clamp(Math.round(num(z.roof_age, 12) + r.normal(0, 4)), 2, 19);
  age = Math.min(age, houseAge);
  const tile = num(z.tile_sh, 20), wood = num(z.wood_sh, 5), metal = L.dwelling === 'mobile-home' ? 55 : num(z.metal_sh, 4);
  const material = r.weightedKey({ tile, 'wood shake': wood, metal, 'composition shingle': Math.max(5, 100 - tile - wood - metal) });
  return {
    age, material, solar: r.float() * 100 < num(z.solar_sh), installed: REF_YEAR - age, original: age >= houseAge,
    why: [isNum(z.ra20_sh) ? `an estimated ${fmt1(z.ra20_sh)}% of single-family roofs in ${z.zip} are 20 or more years old (ra20_sh)` : null,
      isNum(z.roof_age) ? `the median roof here is an estimated ${z.roof_age} years old (roof_age)` : null].filter(Boolean).join('; '),
  };
}

/**
 * Who in the household goes to church: decided for the whole household from the household id, the ZIP's
 * congregations per capita and the household's ages (never heritage), then member by member from the household
 * id and the member's index, so every member's persona knows who goes. Children under 13 go when a grown-up of
 * the household does.
 * @returns {number[]} member indices
 */
function churchgoersOf(ctx, view) {
  const { zc, npc, zi } = ctx;
  const h = num(npc.h);
  const hr = new Rng(hash3(S.practice, zi, h));
  const ages = view.map(x => x.age).filter(isNum);
  const elder = ages.length ? Math.max(...ages) : ageOf(npc);
  const p = clamp(0.08 + 0.1 * smoothstep(0.5, 5, zc.churchPer10k) + 0.17 * smoothstep(30, 80, elder) + (zc.rural ? 0.03 : 0), 0.05, 0.42);
  const household = hr.float() < p;
  const own = x => u01(hash3(S.practice ^ 0x5a5a, zi, h * 32 + x.m));
  const grown = view.filter(x => isNum(x.age) && x.age >= 13 && (household ? own(x) < (x.age < 18 ? 0.7 : 0.88) : x.age >= 18 && own(x) < 0.06));
  const adultGoes = grown.some(x => x.age >= 18);
  const kids = household && adultGoes ? view.filter(x => isNum(x.age) && x.age < 13) : [];
  return [...grown, ...kids].map(x => x.m).sort((a, b) => a - b);
}

/** This member's own churchgoing ({label, day, why}) or null; never read from heritage. */
function practiceOf(ctx, L, churchgoers) {
  const { zc, npc } = ctx;
  if (!churchgoers.includes(Number.isInteger(npc.m) ? npc.m : 0)) return null;
  return { label: 'church', day: 0, why: `${num(ctx.z.church)} congregations in ${ctx.z.zip} (church), ${fmt1(zc.churchPer10k)} per 10,000 people` };
}

// ---------------------------------------------------------------- teams

// Major-league and college teams are civic identity, the one allowed exception to the no-brands rule. Each
// fan base falls off with distance from the team's home; a team within 35 km counts double (home territory).
const TEAMS = [
  { name: 'Dodgers', label: 'the Dodgers', sport: 'baseball', lat: 34.0739, lon: -118.24, pull: 1.0, reach: 230 },
  { name: 'Angels', label: 'the Angels', sport: 'baseball', lat: 33.8003, lon: -117.8827, pull: 0.55, reach: 55 },
  { name: 'Padres', label: 'the Padres', sport: 'baseball', lat: 32.7076, lon: -117.157, pull: 1.0, reach: 150 },
  { name: 'Giants', label: 'the Giants', sport: 'baseball', lat: 37.7786, lon: -122.3893, pull: 1.0, reach: 280 },
  { name: "A's", label: 'the old Oakland A\'s', sport: 'baseball', lat: 37.7516, lon: -122.2005, pull: 0.5, reach: 40 },
  { name: 'Warriors', label: 'the Warriors', sport: 'basketball', lat: 37.768, lon: -122.3877, pull: 1.0, reach: 300 },
  { name: 'Kings', label: 'the Kings', sport: 'basketball', lat: 38.5802, lon: -121.4997, pull: 1.0, reach: 120 },
  { name: 'Lakers', label: 'the Lakers', sport: 'basketball', lat: 34.043, lon: -118.2673, pull: 1.0, reach: 300 },
  { name: 'Clippers', label: 'the Clippers', sport: 'basketball', lat: 33.945, lon: -118.343, pull: 0.3, reach: 50 },
  { name: 'Rams', label: 'the Rams', sport: 'football', lat: 33.9535, lon: -118.3392, pull: 0.75, reach: 170 },
  { name: 'Chargers', label: 'the Chargers', sport: 'football', lat: 33.9535, lon: -118.3392, pull: 0.4, reach: 110 },
  { name: '49ers', label: 'the 49ers', sport: 'football', lat: 37.403, lon: -121.97, pull: 1.0, reach: 420 },
  { name: 'Sharks', label: 'the Sharks', sport: 'hockey', lat: 37.3327, lon: -121.901, pull: 0.6, reach: 70 },
  { name: 'Ducks', label: 'the Ducks', sport: 'hockey', lat: 33.8078, lon: -117.8765, pull: 0.45, reach: 40 },
  { name: 'LA Kings', label: 'the LA Kings', sport: 'hockey', lat: 34.043, lon: -118.2673, pull: 0.45, reach: 80 },
  { name: 'Galaxy', label: 'the Galaxy', sport: 'soccer', lat: 33.8644, lon: -118.2611, pull: 0.35, reach: 55 },
  { name: 'LAFC', label: 'LAFC', sport: 'soccer', lat: 34.0128, lon: -118.2841, pull: 0.4, reach: 50 },
  { name: 'San Diego FC', label: 'San Diego FC', sport: 'soccer', lat: 32.7831, lon: -117.1196, pull: 0.45, reach: 60 },
  { name: 'UCLA', label: 'UCLA football', sport: 'college', lat: 34.0689, lon: -118.4452, pull: 0.35, reach: 60 },
  { name: 'USC', label: 'USC football', sport: 'college', lat: 34.0224, lon: -118.2851, pull: 0.4, reach: 80 },
  { name: 'Cal', label: 'Cal football', sport: 'college', lat: 37.8719, lon: -122.2585, pull: 0.35, reach: 45 },
  { name: 'Stanford', label: 'Stanford football', sport: 'college', lat: 37.4275, lon: -122.1697, pull: 0.3, reach: 40 },
  { name: 'Fresno State', label: 'Fresno State football', sport: 'college', lat: 36.8121, lon: -119.7481, pull: 1.0, reach: 110 },
  { name: 'San Diego State', label: 'San Diego State', sport: 'college', lat: 32.7757, lon: -117.0719, pull: 0.45, reach: 60 },
];
const SPORT_TASTE = { football: 0.34, baseball: 0.3, basketball: 0.24, soccer: 0.06, hockey: 0.06 };

function kmBetween(lat0, lon0, lat1, lon1) {
  const kx = Math.cos(((lat0 + lat1) / 2) * Math.PI / 180) * 111.32;
  return Math.hypot((lon1 - lon0) * kx, (lat1 - lat0) * 111.32);
}

function teamWeight(team, lat, lon) {
  const d = kmBetween(lat, lon, team.lat, team.lon);
  return team.pull * Math.exp(-((d / team.reach) ** 2)) * (d < 35 ? 2 : 1);
}

/** The NPC's teams (0 to 3), by distance-weighted fan bases. */
function teamsOf(ctx, L, big5) {
  const r = rngFor(ctx.seed, S.teams);
  const lat = num(ctx.z.lat), lon = num(ctx.z.lon);
  const ageCurve = L.age < 8 ? 0.3 : L.age < 14 ? 0.8 : L.age <= 70 ? 1 : 0.8;
  const fan = clamp((0.3 + (L.sex === 'M' ? 0.16 : 0) + 0.2 * (num(big5.E, 0.5) - 0.5)) * ageCurve, 0.05, 0.75);
  const out = [];
  if (r.float() < fan) {
    const sports = Object.keys(SPORT_TASTE);
    const nSports = 1 + (r.float() < 0.45 ? 1 : 0);
    const chosen = [];
    for (let k = 0; k < nSports; k++) {
      const s = r.weightedItem(sports.filter(x => !chosen.includes(x)), x => SPORT_TASTE[x]);
      if (s) chosen.push(s);
    }
    for (const s of chosen) {
      const cands = TEAMS.filter(t => t.sport === s);
      const ws = cands.map(t => teamWeight(t, lat, lon));
      if (Math.max(...ws) < 0.02) continue;
      const i = r.weighted(ws);
      if (i >= 0) out.push(cands[i]);
    }
  }
  const colleges = TEAMS.filter(t => t.sport === 'college').map(t => [t, teamWeight(t, lat, lon)]).filter(([, w]) => w > 0.3).sort((a, b) => b[1] - a[1]);
  // college loyalties are thinner than the pro teams', except where the college is the big local team
  if (colleges.length && r.float() < 0.03 + 0.07 * Math.min(1, colleges[0][1] / 2) + (colleges[0][0].pull >= 0.8 ? 0.12 : 0) + (L.student === 'college' ? 0.15 : 0)) out.push(colleges[0][0]);
  return out;
}

// ---------------------------------------------------------------- knowledge and places

/** "hiking up San Jacinto Peak", "hiking in the Santa Monica Mountains", "hiking near Donner Pass". */
function hikeLabel(trail) {
  const name = trail.name.replace(/^the\s+/i, '');
  return trail.landmarkKind === 'peak' ? `hiking up ${name}` : trail.landmarkKind === 'pass' ? `hiking near ${name}` : `hiking in the ${name}`;
}

function landmarkLabel(lm) {
  if (!lm) return null;
  if (lm.kind === 'peak') return `the trail up ${lm.name}`;
  if (lm.kind === 'range') return `a trailhead in the ${lm.name.replace(/^the\s+/i, '')}`;
  if (lm.kind === 'pass') return `the trail near ${lm.name}`;
  return lm.name;
}

const ROAD_MODES = new Set(['drive', 'carpool', 'taxi', 'motorcycle', 'bus', 'other']);

/** What they know: the neighborhood, county, region, landmarks, roads (home and commute), nearby places, records. */
function knowledgeOf(ctx, L) {
  const { world, z, home, npc } = ctx;
  const lms = world.landmarksNear(home.x, home.y, 40);
  ctx.landmarksAll = lms; // placesOf picks trailheads and fishing water from the full list
  const landmarks = lms.slice(0, 5).map(l => ({ name: clean(l.name), kind: l.kind, distKm: l.distKm, elev: l.elev ?? null, lat: l.lat, lon: l.lon }));
  const roads = [];
  const addRoad = (r, commute) => {
    if (!r || !r.name) return;
    const have = roads.find(x => x.route === r.route && x.name === r.name);
    if (have) { have.commute = have.commute || commute; return; }
    roads.push({ name: r.name, route: r.route ?? null, kind: r.kind ?? null, distKm: r.distKm ?? null, aadt: r.aadt ?? null, commute });
  };
  // the highway layer 1 says a driver takes comes first, then the roads near home, then those along the way
  const given = npc.commute && npc.commute.road;
  if (given) addRoad(typeof given === 'string' ? { name: given } : given, true);
  for (const r of world.roadsNear(home.x, home.y, 10).slice(0, 4)) addRoad(r, false);
  const work = ctx.work;
  // the highways on the way to work, for those who travel them (on foot, by bike or by train they are not "their" road)
  if (work && ROAD_MODES.has(L.mode)) {
    const mx = (home.x + work.x) / 2, my = (home.y + work.y) / 2;
    for (const r of world.roadsNear(mx, my, 6).slice(0, 2)) addRoad(r, true);
    for (const r of world.roadsNear(work.x, work.y, 5).slice(0, 1)) addRoad(r, true);
  }
  const neighborhood = str(z.placeName) || str(z.city) || z.zip;
  const nearbyPlaces = world.placesNear(home.x, home.y, 25).filter(p => p.name !== neighborhood).slice(0, 5).map(p => ({ name: clean(p.name), distKm: p.distKm, pop: p.pop }));
  const records = [];
  const hd = parseDate(z.heat_rec_date), rd = parseDate(z.rain_rec_date), gd = parseDate(z.gust_max_date);
  if (isNum(z.heat_rec_f) && hd) records.push({ kind: 'heat', value: z.heat_rec_f, unit: '°F', date: hd.iso, year: hd.y, station: stationName(z.heat_st), source: 'heat_rec_f' });
  if (isNum(z.rain_rec_in) && rd) records.push({ kind: 'rain', value: z.rain_rec_in, unit: 'in', date: rd.iso, year: rd.y, station: stationName(z.rain_rec_st), source: 'rain_rec_in' });
  if (isNum(z.gust_max) && gd) records.push({ kind: 'gust', value: z.gust_max, unit: 'mph', date: gd.iso, year: gd.y, station: stationName(z.gust_st), source: 'gust_max' });
  const cm = npc.commute || {};
  return {
    neighborhood, city: z.city, zip: z.zip, county: z.countyName, countyLabel: z.countyName ? `${z.countyName} County` : null,
    region: z.regionName, regionThe: z.regionThe, province: z.provinceName, coastKm: isNum(z.coast_km) ? z.coast_km : null,
    landmarks, roads: roads.slice(0, 6), nearbyPlaces,
    workCity: str(cm.workCity) || (isNum(L.workZi) && L.workZi >= 0 ? world.z.city[L.workZi] : null), workZip: str(cm.workZip),
    records,
  };
}

/** A deterministic point near (x, y) at 0.4..1.2 km, for the neighborhood park. */
function nearbyPoint(world, x, y, r) {
  const ang = r.float() * Math.PI * 2, km = 0.4 + r.float() * 0.8;
  return { x: x + Math.cos(ang) * km * world.kmUnit, y: y + Math.sin(ang) * km * world.kmUnit };
}

/** Pick a ZIP near home by weight and a point in it. */
function pickZipPoint(world, home, radiusKm, weightFn, r, key) {
  let near = world.zipsNear(home.x, home.y, radiusKm);
  let ws = near.map(([j, d]) => weightFn(j, d));
  if (!ws.some(w => w > 0)) {
    near = world.zipsNear(home.x, home.y, Math.max(60, radiusKm * 2));
    ws = near.map(([j, d]) => weightFn(j, d));
  }
  const k = r.weighted(ws);
  if (k < 0) return null;
  const zj = near[k][0];
  const p = world.homeFor(zj, (key ^ 0x2a5a5a5) & 0x3fffffff);
  return { zi: zj, x: p.x, y: p.y, city: world.z.city[zj], distKm: round(world.distKm(home.x, home.y, p.x, p.y), 1) };
}

const ERRANDS = [
  { kind: 'grocery', label: 'the grocery store' }, { kind: 'pharmacy', label: 'the pharmacy' }, { kind: 'laundromat', label: 'the laundromat' },
  { kind: 'hardware', label: 'the hardware store' }, { kind: 'post-office', label: 'the post office' },
];

/**
 * Where their day can take them: errands, the park, the gym, the beach, a trailhead, family or friends, the game.
 * The household shares its park, grocery store, beach and church (shared: householdPlaces); the rest is their own.
 */
function placesOf(ctx, L, knowledge, teams, shared) {
  const { world, zc, home, seed } = ctx;
  const r = rngFor(seed, S.places);
  const dens = zc.density;
  const R = dens >= 3000 ? 5 : dens >= 500 ? 12 : 35;
  const shop = (j, d) => (num(world.z.retail[j]) + num(world.z.food[j])) * Math.exp(-d / (R / 2));
  const errands = [];
  for (const e of ERRANDS) {
    if (e.kind === 'grocery' && shared.grocery) { errands.push(shared.grocery); continue; }
    const p = pickZipPoint(world, home, R, shop, r, hash2(seed, hashStr(e.kind)));
    if (p) errands.push(Object.assign({ kind: e.kind, label: e.label }, p));
  }
  const gymZ = pickZipPoint(world, home, R, shop, r, hash2(seed, 0x6779));
  const places = { errands, park: shared.park, gym: gymZ ? Object.assign({ kind: 'gym', label: 'the gym' }, gymZ) : null };
  if (shared.beach) places.beach = shared.beach;
  const lms = ctx.landmarksAll || [];
  const trail = lms.find(l => (l.kind === 'peak' || l.kind === 'range' || l.kind === 'pass') && l.distKm <= 25);
  if (trail) { const p = world.project(trail.lat, trail.lon); places.trailhead = { kind: 'trailhead', label: landmarkLabel(Object.assign({}, trail, { name: clean(trail.name) })), name: clean(trail.name), landmarkKind: trail.kind, x: p.x, y: p.y, distKm: trail.distKm }; }
  const water = lms.find(l => l.kind === 'water' && l.distKm <= 30);
  if (water) { const p = world.project(water.lat, water.lon); places.water = { kind: 'water', label: clean(water.name), name: clean(water.name), x: p.x, y: p.y, distKm: water.distKm }; }
  const fam = pickZipPoint(world, home, 40, (j, d) => (j === ctx.zi ? 0 : num(world.z.pop[j]) * Math.exp(-d / 15)), r, hash2(seed, 0xfa111));
  if (fam) places.visit = Object.assign({ kind: L.age >= 18 && L.age < 30 ? 'friends' : 'family', label: `${L.age >= 18 && L.age < 30 ? 'friends' : 'family'} in ${fam.city}` }, fam);
  const team = teams.find(t => t.sport !== 'college') || teams[0];
  if (team) {
    const p = world.project(team.lat, team.lon);
    const d = world.distKm(home.x, home.y, p.x, p.y);
    if (d <= 90) places.game = { kind: 'stadium', label: `the ${team.name} game`, team: team.name, x: p.x, y: p.y, distKm: round(d, 1) };
  }
  return places;
}

// ---------------------------------------------------------------- the household's day (what schedule.mjs reads)

const CAR_MODES = new Set(['carpool', 'drive', 'taxi', 'other', 'motorcycle']);
// Children younger than ESCORT_CAR_AGE who go to school by car are driven by a household adult; younger than
// ESCORT_WALK_AGE, a household adult walks or bikes there with them, or walks them to the school bus stop.
const ESCORT_CAR_AGE = 11, ESCORT_WALK_AGE = 9;
// The oldest household member who still takes the children to school.
const ESCORT_MAX_AGE = 80;
const ROLE_ORDER = ['householder', 'spouse', 'partner', 'parent', 'relative', 'sibling', 'child', 'grandchild'];
const dayBit = d => 1 << d;
const overlapsAny = (list, s, e) => list.some(([a, b]) => s < b && e > a);
const samePoint = (a, b) => Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6;

/** How a household adult takes a child to school: 'drive', 'walk', 'bike', 'bus-stop', or null (on their own). */
function escortMode(kid, vehicles) {
  if (!kid || !isNum(kid.age) || !kid.student || !isNum(kid.departMin) || !validPoint(kid.work)) return null;
  if (CAR_MODES.has(kid.mode)) return kid.age < ESCORT_CAR_AGE && vehicles > 0 ? 'drive' : null; // no car: a neighbor's carpool
  if (kid.age >= ESCORT_WALK_AGE) return null;
  if (kid.mode === 'walk' || kid.mode === 'bike') return kid.mode;
  if (kid.mode === 'bus' || kid.mode === 'rail' || kid.mode === 'ferry') return 'bus-stop'; // the bus takes them on
  return null;
}

/** Who goes first when a child needs taking: those home all day, then remote workers, then commuters; then by role. */
const escortRank = a => (a.core && a.core.worker ? (a.core.mode === 'wfh' ? 1 : 2) : 0);

/**
 * The school runs of a household, from layer 0. Children who share a school and a way of getting there and leave
 * within 15 minutes of each other go together, led by the first to leave (their layer 0 departure and trip time);
 * children whose school day ends within 20 minutes of each other are picked up together. Each drop-off and pickup
 * goes, day by day, to a household adult whose own layer 0 day leaves it free (yesterday's night shift and the
 * sleep after it included), the adult free on the most of those days first, and never two runs at once.
 * @returns {{kind:'drop-off'|'pickup', mode:string, children:number[], school:{x:number,y:number}, departMin?:number,
 *   arriveMin?:number, leaveMin?:number, commuteMin:number, stopMin:number|null, days:number, window:number[],
 *   drivers:{m:number, days:number}[]}[]} only runs someone takes
 */
function planSchoolRuns(view, vehicles) {
  const kids = view.filter(x => x.core && escortMode(x.core, vehicles)).sort((a, b) => a.core.departMin - b.core.departMin || a.m - b.m);
  if (!kids.length) return [];
  const groups = [];
  for (const k of kids) {
    const c = k.core, mode = escortMode(c, vehicles), school = validPoint(c.work), dep = Math.round(c.departMin);
    const g = groups.find(x => x.mode === mode && x.days === num(c.days) && samePoint(x.school, school) && dep - x.depart <= 15);
    if (g) g.kids.push(k);
    else groups.push({ mode, school, days: num(c.days), depart: dep, commuteMin: Math.max(1, Math.round(num(c.commuteMin))), kids: [k] });
  }
  const legs = [];
  for (const g of groups) {
    const stop = g.mode === 'bus-stop' ? clamp(Math.round(g.commuteMin / 4), 2, 6) : null;
    legs.push({
      kind: 'drop-off', mode: g.mode, children: g.kids.map(k => k.m), school: g.school, departMin: g.depart, commuteMin: g.commuteMin, stopMin: stop,
      days: g.days, window: [g.depart - 5, g.depart + 2 * (stop || g.commuteMin) + 5],
    });
    const ends = g.kids.map(k => ({ m: k.m, c: Math.max(1, Math.round(num(k.core.commuteMin))), end: Math.round(k.core.departMin) + Math.round(num(k.core.commuteMin)) + Math.round(num(k.core.dwellMin)) }))
      .sort((a, b) => a.end - b.end || a.m - b.m);
    const clusters = [];
    for (const e of ends) {
      const last = clusters[clusters.length - 1];
      // bus riders get off one at a time; on foot or by car, a parent waits a few minutes for a sibling
      if (last && e.end - last.arriveMin <= (stop ? 0 : 20)) { last.children.push(e.m); last.leaveMin = e.end; last.commuteMin = e.c; }
      else clusters.push({ children: [e.m], arriveMin: e.end, leaveMin: e.end, commuteMin: e.c });
    }
    for (const cl of clusters) {
      const c = cl.commuteMin;
      legs.push({
        kind: 'pickup', mode: g.mode, children: cl.children, school: g.school, arriveMin: cl.arriveMin, leaveMin: cl.leaveMin, commuteMin: c, stopMin: stop, days: g.days,
        window: stop ? [cl.leaveMin + c - 2 * stop - 5, cl.leaveMin + c + 5] : [cl.arriveMin - c - 5, cl.leaveMin + c + 5],
      });
    }
  }
  const adults = view.filter(x => x.core && isNum(x.age) && x.age >= 18 && x.age < ESCORT_MAX_AGE && x.role !== 'roommate' && x.core.student !== 'k12')
    .sort((a, b) => escortRank(a) - escortRank(b) || ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || a.m - b.m);
  const taken = new Map(adults.map(a => [a.m, [[], [], [], [], [], [], []]]));
  for (const leg of legs) {
    const [s, e] = leg.window;
    const free = (a, d) => !overlapsAny(busyIntervals(a.core, d), s, e) && !overlapsAny(taken.get(a.m)[d], s, e);
    let left = [0, 1, 2, 3, 4, 5, 6].filter(d => leg.days & dayBit(d));
    leg.drivers = [];
    while (left.length) {
      let best = null, bestDays = [];
      for (const a of adults) { const ds = left.filter(d => free(a, d)); if (ds.length > bestDays.length) { best = a; bestDays = ds; } }
      if (!best) break;
      for (const d of bestDays) taken.get(best.m)[d].push([s, e]);
      leg.drivers.push({ m: best.m, days: bestDays.reduce((mask, d) => mask | dayBit(d), 0) });
      left = left.filter(d => !bestDays.includes(d));
    }
  }
  return legs.filter(l => l.drivers.length);
}

/** The household's shared places: one park, one grocery store, one church, one beach, one set of relatives to visit. */
function householdPlaces(ctx, churchgoers) {
  const { world, z, zc, home, zi, npc } = ctx;
  const key = hash3(S.places, zi, num(npc.h)) >>> 0;
  const r = new Rng(key);
  const dens = zc.density, R = dens >= 3000 ? 5 : dens >= 500 ? 12 : 35;
  const shop = (j, d) => (num(world.z.retail[j]) + num(world.z.food[j])) * Math.exp(-d / (R / 2));
  const out = { park: Object.assign({ kind: 'park', label: zc.rural ? 'the town park' : 'the park' }, nearbyPoint(world, home.x, home.y, r)) };
  const g = pickZipPoint(world, home, R, shop, r, hash2(key, hashStr('grocery')));
  if (g) out.grocery = Object.assign({ kind: 'grocery', label: 'the grocery store' }, g);
  if (num(z.coast_km, 999) <= 30) {
    let best = null, bd = Infinity;
    for (const c of worldInfo(world).coast) { const d = world.distKm(home.x, home.y, c.x, c.y); if (d < bd) { bd = d; best = c; } }
    if (best && bd <= 40) {
      const p = world.homeFor(best.i, (key ^ 0x5eac4) & 0x3fffffff);
      out.beach = { kind: 'beach', label: `the beach in ${best.city}`, x: p.x, y: p.y, zi: best.i, city: best.city, distKm: round(bd, 1) };
    }
  }
  if (churchgoers.length) {
    const c = pickZipPoint(world, home, dens >= 500 ? 8 : 30, (j, d) => num(world.z.church[j]) * Math.exp(-d / 4), r, hash2(key, 0xc4c4));
    if (c) out.church = Object.assign({ kind: 'church', label: 'church' }, c);
  }
  const fam = pickZipPoint(world, home, 40, (j, d) => (j === zi ? 0 : num(world.z.pop[j]) * Math.exp(-d / 15)), r, hash2(key, 0xfa111));
  if (fam) out.family = Object.assign({ kind: 'family', label: `family in ${fam.city}` }, fam);
  return out;
}

/**
 * Everything the household's members do together, the same in every member's persona: who is who (layer 0's day
 * for each), the school runs and who takes them, who goes to church, and the shared places. schedule.mjs draws
 * the family outings of a day (church, the park or the store with the young children) from it.
 */
function householdRoutineOf(ctx, L, view, churchgoers, shared) {
  const { npc, zi, world, home, zc } = ctx;
  const names = new Map((Array.isArray(ctx.hh.members) ? ctx.hh.members : []).filter(Boolean).map(x => [x.m, memberName(x)]));
  const legs = ctx.core ? planSchoolRuns(view, L.vehicles) : [];
  return {
    key: hash3(S.family, zi, num(npc.h)) >>> 0, layer0: !!ctx.core, vehicles: L.vehicles, density: zc.density, unitKm: world.unitKm, home,
    members: view.map(x => {
      const c = x.core || {};
      return {
        m: x.m, role: x.role, age: x.age, name: names.get(x.m) || null, student: c.student ?? null, worker: !!c.worker, mode: c.mode ?? null,
        departMin: isNum(c.departMin) ? c.departMin : null, commuteMin: num(c.commuteMin), dwellMin: num(c.dwellMin), days: num(c.days),
      };
    }),
    legs, churchgoers, places: shared,
  };
}

/** The normalized commute routine, school runs and places for schedule.mjs. Layer 0 wins when a population was given. */
function routineOf(ctx, L, places, household, practice) {
  const { npc, core, home, world } = ctx;
  const me = core && core.me;
  const cm = npc.commute && typeof npc.commute === 'object' ? npc.commute : {};
  const src = me ? {
    mode: me.mode ?? null, commuteMin: num(me.commuteMin), departMin: isNum(me.departMin) ? me.departMin : null,
    dwellMin: num(me.dwellMin), days: num(me.days), workZi: isNum(me.workZi) ? me.workZi : -1, work: validPoint(me.work),
  } : {
    mode: cm.mode ?? null, commuteMin: num(cm.minutes), departMin: isNum(cm.departMin) ? cm.departMin : null,
    dwellMin: num(cm.dwellMin), days: num(cm.days), workZi: isNum(cm.workZi) ? cm.workZi : -1, work: validPoint(cm.work),
  };
  const m = Number.isInteger(npc.m) ? npc.m : 0;
  const nameOf = new Map(household.members.map(x => [x.m, x.name]));
  const schoolRuns = [];
  for (const leg of household.legs) {
    for (const d of leg.drivers) {
      if (d.m !== m) continue;
      schoolRuns.push({
        kind: leg.kind, mode: leg.mode, children: leg.children.slice(), childNames: leg.children.map(k => nameOf.get(k) || null), school: leg.school,
        departMin: leg.departMin ?? null, arriveMin: leg.arriveMin ?? null, leaveMin: leg.leaveMin ?? null, commuteMin: leg.commuteMin, stopMin: leg.stopMin, days: d.days,
      });
    }
  }
  const mine = household.legs.filter(leg => leg.children.includes(m));
  const rideLegs = mine.flatMap(leg => leg.drivers.map(d => ({ kind: leg.kind, mode: leg.mode, driver: d.m, days: d.days })));
  const drop = rideLegs.filter(x => x.kind === 'drop-off').sort((a, b) => popcount(b.days) - popcount(a.days) || a.driver - b.driver)[0];
  if (practice && household.places.church) places.church = household.places.church;
  return Object.assign(src, {
    source: me ? 'layer0' : 'npc', m, home, student: L.student, worker: L.worker, occKey: L.occKey, outdoor: L.outdoor, shift: L.shift,
    vehicles: L.vehicles, age: L.age, density: ctx.zc.density, unitKm: world.unitKm,
    schoolRuns, ride: rideLegs.length ? { driver: drop ? drop.driver : rideLegs[0].driver, pickup: rideLegs.some(x => x.kind === 'pickup'), legs: rideLegs } : null,
    household, places,
  });
}

const popcount = v => { let n = 0; for (let x = v >>> 0; x; x &= x - 1) n++; return n; };

// ---------------------------------------------------------------- interests

// Cultural traditions by heritage key: offered at a modest probability modulated by generation, never as one
// of the first two interests (representation rule 2).
const TRADITIONS = {
  mexican: ['Día de los Muertos', 'quinceañeras', 'el Grito on the night of September 15'],
  salvadoran: ['quinceañeras', 'the Central American independence parade in September'],
  guatemalan: ['quinceañeras', 'the Central American independence parade in September'],
  honduran: ['quinceañeras', 'the Central American independence parade in September'],
  nicaraguan: ['La Purísima in December', 'quinceañeras'],
  puertorican: ['parrandas at Christmas'], cuban: ['Nochebuena'], dominican: ['Nochebuena'],
  southamerican: ['quinceañeras'], latino: ['quinceañeras'],
  chinese: ['Lunar New Year', 'the Mid-Autumn Festival'], filipino: ['Simbang Gabi', 'parol lanterns at Christmas'],
  vietnamese: ['Tết', 'the Mid-Autumn Festival'], korean: ['Lunar New Year', 'Chuseok'], japanese: ['Obon festivals', 'mochitsuki at New Year'],
  indian: ['Diwali', 'Holi'], sikh: ['Vaisakhi'], hmong: ['Hmong New Year'], cambodian: ['Khmer New Year'], lao: ['Lao New Year'],
  thai: ['Songkran'], bangladeshi: ['Pohela Boishakh'], afghan: ['Nowruz'], burmese: ['Thingyan'],
  iranian: ['Nowruz', 'Yalda Night'], armenian: ['Vardavar'], assyrian: ['Akitu, the Assyrian New Year'],
  'african-american': ['Juneteenth'], ethiopian: ['Enkutatash'], caribbean: ['Carnival'], native: ['powwows'],
  irish: ["St. Patrick's Day"], italian: ['the Feast of the Seven Fishes'], german: ['Oktoberfest'], portuguese: ['the Holy Ghost festas'],
  scandinavian: ['Midsummer'], polish: ['Wigilia on Christmas Eve'], scottish: ['the Highland games'], russian: ['New Year with a yolka tree'],
  greek: ['the Greek festival'],
};
const TRADITION_P = { 1: 0.32, 2: 0.22, 3: 0.09 };

/** The optional cultural tradition (heritage, modulated by generation). */
function traditionOf(npc, seed) {
  const list = TRADITIONS[str(npc.heritage) || ''];
  if (!list) return null;
  const gen = isNum(npc.generation) ? clamp(Math.round(npc.generation), 1, 3) : npc.nativity === 'foreign' ? 1 : 3;
  const r = rngFor(seed, S.tradition);
  return r.float() < TRADITION_P[gen] ? r.pick(list) : null;
}

/** Interests grounded in the place, age, income, household, work, personality, teams and practice. */
function interestsOf(ctx, L, big5, archetype, knowledge, teams, practice, places) {
  const { z, zc, world, seed } = ctx;
  const r = rngFor(seed, S.interests);
  const O = num(big5.O, 0.5), C = num(big5.C, 0.5), E = num(big5.E, 0.5);
  const a = L.age, inc = L.householdIncome;
  const cands = new Map();
  const add = (name, w, why) => { if (!(w > 0)) return; const c = cands.get(name); if (!c || c.w < w) cands.set(name, { name, w, why }); };
  const coastKm = num(z.coast_km, 999);
  if (coastKm <= 6 && a >= 10 && a <= 62) add('surfing', 0.55 * (1 - coastKm / 8) + 0.25 * (E - 0.5) + (L.sex === 'M' ? 0.05 : 0), `${fmt1(coastKm)} km from the coast (coast_km)`);
  if (coastKm <= 20) add('the beach', 0.42 - coastKm / 60, `${fmt1(coastKm)} km from the coast (coast_km)`);
  if (coastKm <= 3 && inc >= 150000 && a >= 25) add('sailing', 0.18, `on the coast (coast_km ${fmt1(coastKm)}) with a household income of ${fmtMoney(inc)}`);
  const snowIn = z.snowfall_in, psf = num(z.snow_psf);
  const snowy = (isNum(snowIn) && snowIn >= 40) || (!isNum(snowIn) && psf >= 200 && num(z.elev_m) >= 1500);
  if (snowy) add(a >= 8 && a <= 62 ? 'skiing and snowboarding' : 'snowshoeing', 0.6, isNum(snowIn) ? `about ${fmt1(snowIn)} inches of snow a year (snowfall_in)` : `a ${psf} psf ground snow load (snow_psf)`);
  else if (a >= 12 && a <= 60 && inc >= 90000) {
    let best = null, bd = Infinity;
    for (const s of worldInfo(world).skiTowns) { const d = world.distKm(ctx.home.x, ctx.home.y, s.x, s.y); if (d < bd) { bd = d; best = s; } }
    if (best && bd <= 320) add(`ski trips up to ${best.city}`, 0.24 * (1 - bd / 400) + 0.1 * smoothstep(90000, 250000, inc), `${Math.round(bd)} km from ${best.city}, snow country (snowfall_in)`);
  }
  if (places.trailhead && a >= 8) add(hikeLabel(places.trailhead), 0.08 + 0.26 * O + 0.08 * smoothstep(15, 3, places.trailhead.distKm) + (a >= 18 && a <= 65 ? 0.04 : -0.06), `${places.trailhead.name} is ${places.trailhead.distKm} km away (landmarksNear)`);
  if (places.water) add(`fishing at ${places.water.name}`, (0.2 + (zc.rural ? 0.12 : 0) + (L.sex === 'M' ? 0.06 : 0)) * (a >= 8 ? 1 : 0.3), `${places.water.name} is ${places.water.distKm} km away (landmarksNear)`);
  if (zc.desert) {
    add('stargazing out in the desert', 0.3 + 0.15 * O, `${z.provinceName || 'desert'} country (province)${isNum(z.cz) ? `, climate zone ${z.cz} (cz)` : ''}`);
    if (a >= 16 && a <= 60) add('off-roading', 0.24 + (L.sex === 'M' ? 0.06 : 0), `${z.provinceName || 'desert'} country (province)`);
  }
  const farmCountry = (zc.valley || ['sj', 'sv'].includes(z.regionKey)) && zc.density < 1500;
  if (L.farm) { const w = `works ${jobWords(L)} (occupation)`; add('the county fair', 0.4, w); add('the harvest', 0.3, w); }
  else if (farmCountry) add('the county fair', 0.32, `farm country: ${z.provinceName || z.regionName}, ${fmtInt(zc.density)} people per square mile (density)`);
  if (L.isParent && farmCountry && L.kidAges.some(k => k >= 9 && k <= 18)) add('4-H with the kids', 0.3, 'kids at home in farm country');
  if (zc.urban) {
    if (a >= 12) add('trying new restaurants', 0.28 + 0.25 * O, `${num(z.food)} places to eat in ${z.zip} (food)`);
    if (a >= 16 && a <= 50) add('live music', 0.22 + 0.15 * E, `${fmtInt(zc.density)} people per square mile (density)`);
    if (a >= 14) add('the farmers market', 0.22, `a dense neighborhood (density ${fmtInt(zc.density)})`);
    if (a >= 14 && a <= 60) add('biking around town', 0.18 + 0.1 * O, `a dense neighborhood (density ${fmtInt(zc.density)})`);
    if (O > 0.6 && a >= 8) add('museums', 0.22 + 0.2 * (O - 0.6), `city living (density ${fmtInt(zc.density)})`);
  } else if (zc.suburban) {
    if (L.hasHouse && a >= 16) add('backyard barbecues', 0.28 + 0.12 * E, `a house in the suburbs (dwelling, density ${fmtInt(zc.density)})`);
    if (a >= 14) add('car shows', (L.sex === 'M' ? 0.16 : 0.07) + (a >= 35 ? 0.05 : 0), `suburban ${z.city} (density ${fmtInt(zc.density)})`);
  } else if (zc.rural) {
    if (a >= 16 && a <= 72) add('hunting', 0.2 + (L.sex === 'M' ? 0.1 : 0), `rural ${z.city} (density ${fmtInt(zc.density)})`);
    if (a >= 16 && a <= 65) add('four-wheeling', 0.2, `rural ${z.city} (density ${fmtInt(zc.density)})`);
    add('the county fair', 0.25, `rural ${z.city} (density ${fmtInt(zc.density)})`);
  }
  if (zc.desert && a < 8) cands.delete('stargazing out in the desert');
  if (inc >= 200000) {
    if (a >= 35) add('golf', 0.25, `household income ${fmtMoney(inc)}`);
    if (a >= 28) add('wine tasting', 0.24, `household income ${fmtMoney(inc)}`);
    if (a >= 20) add('travel', 0.28 + 0.1 * O, `household income ${fmtMoney(inc)}`);
    if (a >= 14) add('tennis', 0.14, `household income ${fmtMoney(inc)}`);
  } else if (inc > 0 && inc < 50000 && a >= 16) {
    add('swap meets', 0.2, `household income ${fmtMoney(inc)}`);
    add('thrift shopping', 0.15, `household income ${fmtMoney(inc)}`);
    if (L.vehicles > 0) add('fixing up cars', L.sex === 'M' ? 0.22 : 0.08, `household income ${fmtMoney(inc)}`);
  }
  if (a < 3) {
    add('picture books', 0.4, `age ${a}`); add('the playground', 0.35, `age ${a}`); add('stuffed animals', 0.3, `age ${a}`);
  } else if (a < 6) {
    add('cartoons', 0.35, `age ${a}`); add('drawing', 0.3, `age ${a}`); add('the playground', 0.3, `age ${a}`); add('picture books', 0.2, `age ${a}`);
    if (a >= 5) add('soccer practice', 0.2, `age ${a}`);
  } else if (a < 13) {
    add('cartoons', 0.3, `age ${a}`); add('video games', 0.34, `age ${a}`); add('drawing', 0.22, `age ${a}`);
    add(r.float() < 0.5 ? 'soccer practice' : 'Little League', 0.28, `age ${a}`);
  } else if (a < 20) {
    add('video games', 0.38, `age ${a}`); add('music', 0.34, `age ${a}`); add('basketball', 0.24, `age ${a}`);
    add('skateboarding', 0.18, `age ${a}`); add('anime', 0.18, `age ${a}`); add('school sports', 0.28, `age ${a}`);
  } else if (a < 35) {
    add('the gym', 0.32 + 0.1 * C, `age ${a}`); add('concerts', 0.22 + 0.1 * E, `age ${a}`); add('gaming', 0.24, `age ${a}`);
    add('podcasts', 0.18, `age ${a}`);
  } else if (a < 65) {
    if (L.tenure === 'own') add('home projects', 0.3 + 0.1 * C, `homeowner (tenure), age ${a}`);
    add('cooking', 0.28, `age ${a}`); add('podcasts', 0.16, `age ${a}`); add('walking', 0.16, `age ${a}`);
  } else {
    add('walking', 0.34, `age ${a}`); add('crossword puzzles', 0.24 + 0.1 * O, `age ${a}`); add('birdwatching', 0.16 + 0.1 * O, `age ${a}`);
    if (L.isGrandparent) add('the grandkids', 0.62, 'grandchildren at home (household)');
  }
  if (L.hasHouse && a >= 30) add('gardening', 0.22 + (a >= 60 ? 0.22 : 0), `a house with a yard (dwelling)`);
  if (!L.hasHouse && a >= 20) add('houseplants', 0.14, `an apartment (dwelling)`);
  if (L.isParent && L.kidAges.some(k => k >= 5 && k <= 14)) add("the kids' soccer games", 0.3, 'school-age kids at home (household)');
  if (L.newParent) add('baby milestones', 0.5, 'a baby at home (household)');
  const occInterests = {
    construction: ['woodworking', 0.26], repair: ['working on cars', 0.36], computer: ['tech gadgets', 0.26], engineering: ['tech gadgets', 0.24],
    education: ['reading', 0.34], arts: ['photography', 0.3], practitioner: ['running', 0.22], healthtech: ['running', 0.2],
    food: ['cooking', 0.4], transport: ['classic cars', 0.22], management: ['golf', 0.2], science: ['reading', 0.26], legal: ['reading', 0.22],
  };
  if (L.worker && occInterests[L.occKey]) add(occInterests[L.occKey][0], occInterests[L.occKey][1], `works ${jobWords(L)} (occupation)`);
  if (L.occKey === 'computer' || L.occKey === 'engineering') add('board games', 0.18, `works ${jobWords(L)} (occupation)`);
  if (O > 0.62 && a >= 12) { add('reading', 0.2 + 0.3 * (O - 0.62), 'openness'); add('travel', 0.18 + 0.2 * (O - 0.62), 'openness'); }
  if (E > 0.62 && a >= 18) add('hosting friends', 0.22 + 0.3 * (E - 0.62), 'extraversion');
  if (C > 0.65 && a >= 14 && a <= 70) add('running', 0.2 + 0.2 * (C - 0.65), 'conscientiousness');
  if (archetype === 'retired gardener') add('gardening', 1.2, 'retired, with a house and a yard');
  if (archetype === 'snowbird') add('golf', 0.5, `a seasonal town: ${Math.round(100 * L.seasonalShare)}% of homes are seasonal (seas)`);
  if (practice) add('church on Sundays', a < 13 ? 0.08 : 0.3 + 0.22 * smoothstep(40, 80, a), practice.why);
  teams.forEach((t, k) => add(t.label, (k === 0 ? 0.52 : 0.3) + 0.15 * (E - 0.5) + (L.sex === 'M' ? 0.04 : 0), `${t.name} fan base (team home ${t.lat.toFixed(2)}, ${t.lon.toFixed(2)})`));
  const ranked = [...cands.values()].map(c => ({ c, s: c.w * (0.75 + 0.5 * r.float()) })).sort((x, y) => y.s - x.s || (x.c.name < y.c.name ? -1 : 1)).map(x => x.c);
  const n = clamp(3 + (E > 0.6 ? 1 : 0) + (O > 0.6 ? 1 : 0), 3, 5);
  const out = ranked.slice(0, n);
  const tradition = traditionOf(ctx.npc, seed);
  if (tradition && !out.some(x => x.name === tradition)) {
    const item = { name: tradition, w: 0.3, why: `family tradition (${str(ctx.npc.heritageLabel) || 'heritage'}, generation ${isNum(ctx.npc.generation) ? ctx.npc.generation : '3+'})`, tradition: true };
    if (out.length < 5) out.push(item); else out[out.length - 1] = item;
  }
  return out;
}

// ---------------------------------------------------------------- concerns

/** "gusts of 58 mph or more about 1.4 times a year (g58)" / "... about once every 12 years (g58 0.08)". */
function gustRate(g58) {
  if (g58 >= 0.95) return `about ${fmt1(g58)} days a year with gusts of 58 mph or more (g58)`;
  if (g58 > 0) return `a day with gusts of 58 mph or more about once every ${Math.round(1 / g58)} years (g58 ${g58})`;
  return 'gusts of 58 mph or more almost never (g58 0)';
}

const COASTAL_EVENT = /coastal|surf|rip current|beach|tsunami|sneaker wave|lakeshore/i;
/** Alerts that matter where this person lives: coastal alerts cover whole counties but only touch the shore. */
export function relevantAlerts(alerts, coastKm) {
  return (Array.isArray(alerts) ? alerts : []).filter(a => a && a.event && (!COASTAL_EVENT.test(a.event) || num(coastKm, 0) <= 8));
}

const ALERT_BOOST = { Extreme: 0.35, Severe: 0.25, Moderate: 0.15, Minor: 0.08 };
const alertBoost = a => ALERT_BOOST[a && a.severity] ?? 0.05;

/** Worries from the data, each with the datum that drives it. Scaled a little by neuroticism. */
function concernsOf(ctx, L, big5, residence, roof, wx, knowledge) {
  const { z, zc, world, npc } = ctx;
  const out = [];
  const N = num(big5.N, 0.5);
  const worry = 0.75 + 0.5 * (N - 0.5);
  const age = L.age, adult = age >= 18, owner = L.tenure === 'own';
  const owns = ADULT_ROLES.has(L.role) && adult;                 // the people who own or rent the place
  const head = owns || (adult && L.role === 'roommate');          // and those who pay rent on it
  const add = (topic, w, why, extra) => { if (w > 0.02) out.push(Object.assign({ topic, weight: round(clamp(w * worry, 0, 1), 2), why, area: CONCERN_AREAS[topic] || topic }, extra || {})); };
  const alerts = relevantAlerts(wx && wx.alerts, z.coast_km);
  const alertOf = re => alerts.filter(a => re.test(String(a.event || ''))).sort((a, b) => alertBoost(b) - alertBoost(a))[0] || null;
  const zip = z.zip;

  // insurance non-renewals and the FAIR Plan
  if (owner && owns && (isNum(z.nonren_sh) || isNum(z.fair_sh))) {
    const nonren = num(z.nonren_sh), fair = num(z.fair_sh), wf = num(z.wf_hi_sh);
    let risk = 0.5 * smoothstep(7, 18, nonren) + 0.5 * smoothstep(1, 30, fair) + 0.25 * smoothstep(10, 60, wf);
    const shake = roof && roof.material === 'wood shake' && num(z.fhsz_any) > 20;
    if (shake) risk += 0.2;
    const why = [isNum(z.nonren_sh) ? `${fmt1(nonren)}% of residential policies up for renewal in ${zip} were not renewed in 2023 (nonren_sh)` : null,
      isNum(z.fair_sh) ? `there are ${fmt1(fair)} FAIR Plan home policies per 100 homes here (fair_sh)` : null,
      isNum(z.prem) && z.prem > 0 ? `the average homeowners premium here was ${fmtMoney(z.prem)} in 2023 (prem)` : null,
      shake ? `a wood shake roof in a fire hazard zone (roof, fhsz_any ${fmt1(num(z.fhsz_any))}%)` : null].filter(Boolean).join('; ');
    add('insurance', 0.1 + 0.75 * Math.min(1, risk), why);
  }
  // wildfire
  const fires = zc.fires;
  const vh = num(z.fhsz_vh), anyZ = num(z.fhsz_any);
  const fireRisk = Math.max(smoothstep(5, 60, vh), 0.6 * smoothstep(10, 80, anyZ));
  const recentLoss = fires.filter(f => num(f.destInZip) > 0 && num(f.year) >= REF_YEAR - 12).sort((a, b) => num(b.destInZip) - num(a.destInZip))[0];
  const lossW = recentLoss ? Math.min(1, Math.log10(num(recentLoss.destInZip) + 1) / 3) : 0;
  const fireAlert = alertOf(/red flag|fire/i);
  let fireWhy = vh > 0 ? `${fmt1(vh)}% of ${zip} is in a very high fire hazard severity zone (fhsz_vh), ${fmt1(anyZ)}% in any hazard zone (fhsz_any)`
    : anyZ > 0 ? `${fmt1(anyZ)}% of ${zip} is in a fire hazard severity zone (fhsz_any), none of it very high (fhsz_vh)`
      : `none of ${zip} is in a mapped fire hazard zone (fhsz_any 0), but the ${z.fire_near ? fireName(z.fire_near).replace(/^the /, '') : 'nearest fire'} burned ${fmt1(num(z.fire_km))} km away${z.fire_near_yr ? ` in ${z.fire_near_yr}` : ''} (fire_near, fire_km)`;
  if (recentLoss) fireWhy += `; ${fireName(recentLoss.name)} destroyed ${fmtInt(recentLoss.destInZip)} structures here in ${recentLoss.year} (firesOf)`;
  const lostHomes = num(z.fire_dest_res);
  if (lostHomes > 0) fireWhy += `; ${fmtInt(lostHomes)} ${lostHomes === 1 ? 'home' : 'homes'} here destroyed by wildfire since 2013 (fire_dest_res)`;
  if (fireAlert) fireWhy += `; a ${fireAlert.event} is out now (NWS)`;
  const fw = 0.08 + 0.6 * fireRisk + 0.3 * lossW + 0.1 * smoothstep(0, 300, lostHomes) + 0.12 * smoothstep(5, 50, num(z.burn_sh)) + (fireAlert ? alertBoost(fireAlert) : 0);
  if (age >= 13 || fw > 0.6) add('fire', fw * (owner ? 1.1 : 0.9) * (adult ? 1 : 0.6), fireWhy);
  // smoke
  const nearBig = fires.filter(f => num(f.year) >= REF_YEAR - 9 && num(f.acres) >= 10000 && num(f.km, 99) <= 40).sort((a, b) => num(b.acres) - num(a.acres))[0];
  if (nearBig || isNum(z.fire_km)) {
    const sensitive = age >= 65 || (L.isParent && L.youngestKid !== null && L.youngestKid < 10) ? 0.12 : 0;
    const sw = 0.04 + (nearBig ? 0.24 * smoothstep(40, 5, num(nearBig.km, 40)) : 0.06 * smoothstep(30, 3, num(z.fire_km, 30))) + (zc.valley ? 0.1 : 0) + sensitive;
    const why = nearBig ? `${fireName(nearBig.name)} burned ${fmtInt(nearBig.acres)} acres ${num(nearBig.km) <= 0.5 ? 'in and around' : `${fmt1(nearBig.km)} km from`} ${zip} in ${nearBig.year} (firesOf)` : `${z.fire_near ? fireName(z.fire_near) : 'the nearest fire'} burned ${fmt1(num(z.fire_km))} km away in ${num(z.fire_near_yr) || 'recent years'} (fire_near, fire_km)`;
    add('smoke', sw * (adult ? 1 : 0.6), zc.valley ? `${why}; the valley holds smoke (province: ${z.provinceName})` : why);
  }
  // heat
  const h100 = num(z.h100), h90 = num(z.h90), tjul = num(z.tjul, 80);
  const heatAlert = alertOf(/heat/i);
  const heat = 0.5 * smoothstep(5, 60, h100) + 0.2 * smoothstep(30, 120, h90) + 0.3 * smoothstep(85, 105, tjul);
  const outdoor = L.outdoor;
  add('heat', (0.05 + 0.75 * heat + (heatAlert ? alertBoost(heatAlert) : 0)) * (outdoor ? 1.35 : 1) * (age >= 65 ? 1.25 : 1) * (adult ? 1 : 0.6),
    `about ${Math.round(h100)} days a year reach 100°F here (h100) and ${Math.round(h90)} reach 90°F (h90); July highs average ${fmt1(tjul)}°F (tjul)${outdoor ? `; works outdoors ${jobWords(L)} (occupation)` : ''}${heatAlert ? `; a ${heatAlert.event} is out now (NWS)` : ''}`);
  // storms and flooding (atmospheric rivers, flood reports, alerts now)
  const arN = num(z.ar_n), floodN = num(z.flood_n10);
  const stormAlert = alertOf(/flood|surf|storm|rain|winter|blizzard|tsunami/i);
  const ar = smoothstep(6, 14, arN), fl = smoothstep(5, 40, floodN);
  const stw = 0.05 + 0.4 * ar + 0.3 * fl + (stormAlert ? alertBoost(stormAlert) : 0);
  const stTopic = fl > ar + 0.15 ? 'flooding' : 'storms';
  add(stTopic, stw * (owner ? 1.1 : 0.95) * (adult ? 1 : 0.6),
    `about ${fmt1(arN)} atmospheric rivers a year come ashore on the nearest stretch of coast (ar_n), and ${fmtInt(floodN)} located flood, flash-flood and debris-flow ${floodN === 1 ? 'report' : 'reports'} within 10 km since 1996 (flood_n10)${stormAlert ? `; the NWS has a ${stormAlert.event} out now` : ''}`);
  // wind and power shutoffs
  const off = z.off_kind;
  const offName = { sa: 'Santa Ana', di: 'Diablo', su: 'sundowner' }[off] || null;
  const g = smoothstep(0.2, 3, num(z.g58)), eps = smoothstep(2, 40, num(z.sa_ep) + num(z.di_ep));
  const windAlert = alertOf(/wind|red flag/i);
  const ww = 0.04 + 0.35 * g + (offName ? 0.25 * eps : 0) + (windAlert ? alertBoost(windAlert) : 0);
  add('wind', ww * (adult ? 1 : 0.5), `${offName ? `${offName} winds blow here (off_kind ${off}); ` : ''}${gustRate(num(z.g58))}${windAlert ? `; a ${windAlert.event} is out now (NWS)` : ''}`);
  if (offName && anyZ > 20 && adult) {
    add('power shutoffs', 0.08 + 0.5 * smoothstep(20, 80, anyZ) * Math.max(g, eps, 0.3), `${offName} winds (off_kind ${off}) over a fire hazard zone covering ${fmt1(anyZ)}% of ${zip} (fhsz_any)`);
  }
  // snow and chain control
  const snowIn = z.snowfall_in, psf = num(z.snow_psf);
  const s = isNum(snowIn) ? smoothstep(12, 150, snowIn) : smoothstep(60, 300, psf) * (num(z.elev_m) >= 1200 ? 1 : 0.4);
  if (s > 0.02) {
    // the drive and the roof are the grown-ups' worries: the ones who drive, and the ones who own the house
    const drives = L.vehicles > 0 && L.age >= 16, roofWorry = owner && owns && psf >= 100;
    const road = drives ? knowledge.roads.find(x => !x.commute) || knowledge.roads[0] : null;
    const why = (isNum(snowIn) ? `about ${fmt1(snowIn)} inches of snow a year (snowfall_in)` : `a ${psf} psf design ground snow load at ${num(z.elev_m)} m (snow_psf, elev_m)`) + (roofWorry && isNum(snowIn) ? `; roofs here are designed for a ${psf} psf ground snow load (snow_psf)` : '') + (road ? `; drives ${road.name} through the winter (roadsNear)` : '');
    add('snow', (0.1 + 0.7 * s + (roofWorry ? 0.08 : 0) + (drives && adult ? 0.06 : 0)) * (adult ? 1 : 0.6), why,
      drives && s > 0.3 ? { detail: 'chain controls and closures on the drive' } : roofWorry ? { detail: 'shoveling the roof after big storms' } : null);
  }
  // housing costs and rent (value against income; there is no rent column, so the market stands in)
  const value = num(z.value), hinc = Math.max(num(L.householdIncome, num(z.inc, 60000)), 15000);
  const ratio = value > 0 ? value / hinc : 0;
  if (value > 0 && adult) {
    if (L.tenure === 'rent' && (head || age >= 22)) {
      add('rent', 0.1 + 0.6 * smoothstep(3, 12, ratio) + (age >= 20 && age <= 40 ? 0.12 : 0),
        `homes here run about ${fmtMoney(value)} (value) against their household's income of ${fmtMoney(hinc)} (householdIncome)${isNum(z.own_sh) && z.own_sh < 50 ? `, and only ${fmt1(z.own_sh)}% of households here own their home (own_sh)` : ''}`);
    } else if (owner && owns) {
      const recent = isNum(L.yearMoved) && L.yearMoved >= 2019;
      const w = recent ? 0.1 + 0.5 * smoothstep(4, 10, ratio) : age >= 50 ? 0.08 + 0.35 * smoothstep(4, 10, ratio) : 0.06 + 0.25 * smoothstep(4, 10, ratio);
      add('housing', w, `the median home here is worth ${fmtMoney(value)} (value)${isNum(z.val1m_sh) ? ` and ${fmt1(z.val1m_sh)}% of owner homes are worth $1 million or more (val1m_sh)` : ''}${recent ? `; they bought in ${L.yearMoved} (yearMoved)` : ''}`);
    }
  }
  // the commute
  if ((L.worker || L.student === 'college') && L.mode && L.mode !== 'wfh' && L.commuteMin > 45) {
    const road = knowledge.roads.find(x => x.commute) || null;
    const where = knowledge.workCity ? ` to ${knowledge.workCity}` : '';
    add('commute', 0.2 + 0.6 * smoothstep(45, 100, L.commuteMin) + (road && num(road.aadt) >= 150000 ? 0.08 : 0),
      `a ${L.commuteMin}-minute ${L.mode === 'drive' || L.mode === 'carpool' ? 'drive' : 'trip'} each way${where} (commute)${road ? `; ${road.name} carries ${fmtInt(num(road.aadt))} vehicles a day (Caltrans AADT)` : ''}`);
  }
  // an old roof (homeowners; this is a roofing atlas)
  if (roof && owns && roof.age >= 15) {
    const salt = num(z.salt_cls) >= 2, heavySnow = psf >= 100;
    add('roof', 0.1 + 0.6 * smoothstep(15, 30, roof.age) + (salt ? 0.08 : 0) + (heavySnow ? 0.08 : 0) + 0.08 * ar,
      [`their ${roof.material} roof is ${roof.age} years old (roof)`, roof.why, salt ? `salt air class ${z.salt_cls} (salt_cls)` : null].filter(Boolean).join('; '));
  }
  // earthquakes: everyone in California carries a little of this
  const quakeDecl = zc.fema.find(f => f && f[1] === 'Earthquake');
  const oldStock = isNum(z.yb_med) && z.yb_med < 1960;
  add('earthquakes', 0.12 + (quakeDecl ? 0.18 : 0) + 0.1 * smoothstep(0, 20, num(z.fema_quake)) + (oldStock ? 0.08 : 0) + (owner ? 0.04 : 0),
    (quakeDecl ? `the ${clean(quakeDecl[2])} brought a federal disaster declaration to ${z.countyName} County in ${parseDate(quakeDecl[0]).y} (femaOf)` : 'the statewide baseline')
      + `; ${fmtInt(num(z.fema_quake))} FEMA earthquake-disaster ${num(z.fema_quake) === 1 ? 'registration' : 'registrations'} from ${zip} (fema_quake)`
      + (isNum(z.yb_med) ? `; half the homes in ${zip} were built before ${z.yb_med} (yb_med)` : ''));
  // jobs
  if (L.unemployed) add('jobs', 0.75, `out of work (status)${zc.urate !== null ? `; unemployment in ${zip} is ${fmt1(zc.urate)}% (ACS B23025)` : ''}`);
  else if (adult && age < 65 && zc.urate !== null && zc.urate >= 8) add('jobs', 0.12 + 0.3 * smoothstep(8, 16, zc.urate), `unemployment in ${zip} is ${fmt1(zc.urate)}% (ACS B23025)`);
  // water, for farm work
  if (L.farm || (['sj', 'sv'].includes(z.regionKey) && zc.rural && owner)) {
    add('water', 0.3 + 0.4 * smoothstep(20, 5, num(z.rain_in, 15)), `${L.farm ? `works ${jobWords(L)} (occupation)` : `farm country (${z.regionName})`}; about ${fmt1(num(z.rain_in))} inches of rain a year (rain_in)`);
  }
  // aging and health
  if (age >= 60) add('health', 0.1 + 0.6 * smoothstep(60, 88, age), `age ${age}; ${num(z.health)} health-care establishments in ${zip} (health)`);
  // schools, for parents of school-age kids
  const schoolKids = L.kidAges.filter(k => k >= 4 && k <= 17).length;
  if (L.isParent && schoolKids > 0) add('schools', 0.25 + 0.15 * Math.min(2, schoolKids - 1) + 0.1 * (num(big5.C, 0.5) - 0.5) * 2, `${numWord(schoolKids)} school-age ${schoolKids === 1 ? 'kid' : 'kids'} at home (household); ${num(z.school)} schools in ${zip} (school)`);
  // family abroad, for immigrants
  if (adult && npc.nativity === 'foreign') {
    const arr = isNum(npc.arrivalYear) ? npc.arrivalYear : null;
    const years = arr !== null ? REF_YEAR - arr : 20;
    const recent = years <= 15;
    const detail = rngFor(ctx.seed, S.life ^ 0xab).pick(recent
      ? ['sends money home to family', 'is saving up to visit family back home', 'calls family back home every weekend', age >= 30 ? 'worries about aging parents back home' : 'video-calls the family back home']
      : ['keeps in touch with cousins back home', 'visits family back home when they can', 'follows the news from back home']);
    add('family abroad', 0.12 + 0.33 * smoothstep(30, 5, years) + (npc.languages && npc.languages.english === 'limited' ? 0.08 : 0),
      `came to the US${arr !== null ? ` in ${arr} (arrivalYear)` : ''}${str(npc.birthplace) ? ` from ${npc.birthplace} (birthplace)` : ''}`, { detail });
  }
  // children keep to what a child worries about
  const allowed = age < 13 ? new Set(['fire', 'smoke', 'heat', 'storms', 'flooding', 'snow', 'earthquakes', 'wind'])
    : age < 18 ? new Set(['fire', 'smoke', 'heat', 'storms', 'flooding', 'snow', 'earthquakes', 'wind', 'jobs', 'commute']) : null;
  if (age < 6) return [];
  const kept = out.filter(c => !allowed || allowed.has(c.topic)).sort((a, b) => b.weight - a.weight || (a.topic < b.topic ? -1 : 1));
  if (age < 13) return kept.filter(c => c.weight >= 0.3).slice(0, 2);
  const strong = kept.filter(c => c.weight >= 0.15).slice(0, 6);
  return strong.length >= (adult ? 2 : 1) ? strong : kept.slice(0, adult ? 2 : 1);
}

// ---------------------------------------------------------------- memories

const MIN_MEMORY_AGE = 7; // the age from which a person carries their own memory of a public event

function voiceOf(L) {
  const plural = L.hhSize > 1;
  return { we: plural ? 'we' : 'I', We: plural ? 'We' : 'I', our: plural ? 'our' : 'my', Our: plural ? 'Our' : 'My', us: plural ? 'us' : 'me', were: plural ? 'were' : 'was' };
}

const HOME_WORD = { house: 'house', 'small-apartment': 'apartment', apartment: 'apartment', 'mobile-home': 'mobile home' };

// What it was like, by event and by how the person lived it. The facts come from the pack; these lines are the
// person's own (fiction, chosen to fit where they lived and how old they were). Slots: {We} {we} {were} {Our}
// {our} {us} (their household's voice), {age} (their age then), {county}, {vantage}, {days}.
const LINES = {
  fire: {
    county: ['{We} {were} living elsewhere in {county} County then, and the smoke hung over everything for days.',
      'Back then {we} lived in another part of {county} County; {we} followed it on the news every night.',
      '{We} lived across the county then, and ash dusted the cars for days.',
      'I remember the smoke drifting over from the other side of the county.'],
    childSchool: ['I was {age}. I remember the sky going orange and school closing.',
      'I was {age}, and they canceled school for days because of the smoke.',
      'I was {age}; we had to stay inside at recess for a week.'],
    childNear: ['I was {age}. I remember the helicopters going over all day.',
      'I was {age}, and I remember my parents packing the car in a hurry.'],
    child: ['I was {age}. I remember the sun turning red through the smoke.',
      'I was {age}, and I remember the ash on the cars.',
      'I was {age}; I was not allowed to play outside for days.'],
    rebuilt: ['{We} lost the house and rebuilt.'],
    severe: ['{We} evacuated with whatever fit in the car, and some of the neighbors lost everything.',
      '{We} {were} evacuated for {days} days, and when {we} came back houses down the road were gone.',
      '{We} left in the middle of the night and did not know for days if the house made it.'],
    close: ['{We} packed the car and waited for the evacuation order.',
      '{Our} street was under an evacuation warning for a couple of days.',
      '{We} kept the car packed and the important papers by the door for a week.'],
    far: ['I watched the smoke from {vantage}.', 'Ash fell on the cars for days.',
      'The air was so bad {we} kept the windows shut for a week.', 'The sunsets were red from the smoke for days.'],
  },
  storm: {
    child: ['I remember the rain going sideways and the creek running high.',
      'I was {age}; the gutters overflowed and the street turned into a creek.',
      'I was {age}, and I remember the power going out and playing cards by flashlight.'],
    house: ['The roof leaked over the kitchen.', 'The gutters overflowed and the yard turned into a pond.',
      '{We} {were} up all night with buckets and towels.', 'A big branch came down on the fence.'],
    commute: ['The streets flooded on the way to work.'],
    any: ['The power went out for most of a day.', 'It rained so hard the storm drains backed up.',
      'Water came in under the door.', 'The wind and the rain kept {us} up all night.'],
  },
  wind: {
    psps: ['The utility shut {our} power off ahead of it for {days}.', 'The power company cut {our} electricity for {days} before the wind came.'],
    house: ["Half the fence ended up in the neighbor's yard.", 'Shingles from up the street landed in {our} yard.'],
    any: ['{We} lost power for {days}.', 'A big tree came down across the street.', 'Trash cans were rolling down the middle of the street.',
      'It sounded like a train going by all night.'],
  },
  fema: {
    flood: ['Roads around here flooded.', "{We} couldn't get across town for a day.", 'The creek came over its banks.'],
    snow: ['The snow piled up past the windows.', '{We} {were} snowed in for days.'],
    storm: ['The storms knocked out the power and closed roads.', 'Mud and rocks came down onto the roads.', 'It felt like it rained for a month straight.'],
    quake: ['The shaking woke {us} up.', 'Pictures fell off the walls.', '{We} stood in the doorway until it stopped.'],
    fire: ['The smoke kept everyone indoors.', 'The air was brown for a week.', 'Everyone was watching the fire maps.'],
  },
  record: {
    heat: ['I remember that day; nobody went outside.', 'The AC ran all day and still lost.', 'The pavement felt soft under your shoes.'],
    rain: ['The gutters could not keep up.', 'The street turned into a river.', 'It came down in sheets all day.'],
    gust: ['Branches were down everywhere the next morning.', 'It sounded like a train going by all night.', 'The patio furniture ended up across the yard.'],
  },
};

/**
 * Experience lines for one persona: a template is used at most once, so no two of their memories share a
 * sentence. pick(vars, ...pools) fills an unused template from the first pool that still has one; null when
 * every pool is used up (the memory then keeps its fact alone).
 */
class LinePicker {
  constructor(r, voice) { this.r = r; this.voice = voice; this.used = new Set(); }
  pick(vars, ...pools) {
    for (const pool of pools) {
      const fresh = (pool || []).filter(t => !this.used.has(t));
      if (!fresh.length) continue;
      const t = fresh[this.r.int(fresh.length)];
      this.used.add(t);
      const all = Object.assign({}, this.voice, vars);
      return t.replace(/\{(\w+)\}/g, (m, k) => (all[k] !== undefined && all[k] !== null ? String(all[k]) : m));
    }
    return null;
  }
}

const SCHOOL_MONTHS = new Set([1, 2, 3, 4, 5, 9, 10, 11, 12]);

/** A fire they lived through: the pack's facts, and how it reached them (by where they lived and their age). */
function fireMemory(f, ctx, L, res, r) {
  const dt = parseDate(f.start) || { y: f.year, m: null, d: null, iso: null };
  const year = num(f.year, dt.y);
  const zip = ctx.z.zip, county = ctx.z.countyName;
  const inZip = year >= res.zipSince;
  const ageThen = year - L.birthYear;
  const dest = num(f.destInZip), pct = num(f.pct), km = num(f.km, 99);
  const facts = [];
  if (dest > 0) facts.push(`it destroyed ${fmtInt(dest)} ${dest === 1 ? 'structure' : 'structures'} in ${zip}`);
  else if (pct > 0) facts.push(`it burned ${fmt1(pct)}% of ${zip}`);
  else facts.push(`it burned ${fmt1(km)} km from ${zip}`);
  if (num(f.acres) > 0) facts.push(`${fmtInt(f.acres)} acres in all`);
  const fact = `${cap(fireName(f.name))} started ${dt.m ? fullDate(dt) : `in ${year}`}; ${facts.join(', ')}.`;
  const rebuilt = inZip && dest >= 10 && pct >= 1 && L.tenure === 'own' && isNum(L.yearBuilt) && L.yearBuilt > year && L.yearBuilt <= REF_YEAR;
  const near = inZip && (pct > 0 || km <= 5);
  const F = LINES.fire;
  let pools;
  if (!inZip) pools = [F.county, F.far];
  else if (ageThen < 16) pools = [...(near && dt.m && SCHOOL_MONTHS.has(dt.m) ? [F.childSchool] : []), ...(near ? [F.childNear] : []), F.child];
  else if (rebuilt) pools = [F.rebuilt, F.severe];
  else if (dest >= 20 && pct >= 3) pools = [F.severe, F.close];
  else if (pct > 0 || km <= 2) pools = [F.close, F.far];
  else pools = [F.far];
  const vars = { age: ageThen, county, vantage: L.hasHouse ? 'the backyard' : r.pick(['the balcony', 'the parking lot', 'the window']), days: r.pick(['four', 'five', 'six']) };
  const weight = clamp(0.3 + (inZip ? 0.22 : 0) + 0.3 * Math.min(1, Math.log10(dest + 1) / 3) + (pct >= 10 ? 0.1 : 0) + (rebuilt ? 0.2 : 0) + 0.05 * smoothstep(1000, 100000, num(f.acres)), 0, 1);
  return { year, date: dt.iso, kind: 'fire', title: `${fireName(f.name)} in ${year}`, weight: round(weight, 2), source: `firesOf(${zip}): ${f.name} ${year}`, fact, scope: inZip ? 'zip' : 'county', pools, vars };
}

function arMemory(a, ctx, L, r) {
  const dt = parseDate(a.start);
  if (!dt) return null;
  const fact = `The atmospheric river that came ashore ${fullDate(dt)} was a category ${a.rank} storm${clean(a.peakAt) ? `, strongest at ${clean(a.peakAt)}` : ''}${isNum(a.hours) ? `, ${a.hours} hours long` : ''}.`;
  const ageThen = dt.y - L.birthYear;
  const St = LINES.storm;
  const pools = ageThen < 16 ? [St.child, St.any]
    : L.tenure === 'own' && L.hasHouse ? [St.house, St.any]
      : [...(L.worker && ageThen >= 18 ? [St.commute] : []), St.any];
  const exposure = 0.35 + 0.65 * smoothstep(3, 12, num(ctx.z.ar_n));
  const weight = (0.22 + 0.08 * (num(a.rank) - 3) + 0.15 * Math.min(1, Math.log10(num(a.dmg) + 1) / 8) + (num(a.deaths) > 0 ? 0.06 : 0)) * exposure;
  return { year: dt.y, date: dt.iso, kind: 'storm', title: `the atmospheric river of ${monthYear(dt)}`, weight: round(clamp(weight, 0, 1), 2), source: `arsOf(${ctx.z.zip}): ${a.start} rank ${a.rank}`, fact, scope: 'county', pools, vars: { age: ageThen } };
}

const WIND_NAMES = { santa_ana: 'the Santa Ana winds', diablo: 'the Diablo winds', sundowner: 'the sundowner winds', mono: 'the Mono winds', winter: 'the winter windstorm', other: 'the windstorm' };

function windMemory(w, ctx, L, r) {
  const dt = parseDate(w.start);
  if (!dt) return null;
  const where = wherePhrase(w.where);
  const counties = Array.isArray(w.fips) ? w.fips.length : 1;
  const name = cap(WIND_NAMES[w.kind] || 'the windstorm');
  const gust = isNum(w.gust) ? `${w.gust} mph` : null;
  const peak = gust ? `the strongest gust, ${gust}, was recorded${where ? ' ' + where : ''}` : where ? `it was strongest ${where}` : null;
  const fact = counties > 1
    ? `${name} of ${monthYear(dt)} hit ${ctx.z.countyName} County and ${counties - 1 === 1 ? 'one other county' : `${numWord(counties - 1)} other counties`}${peak ? `; ${peak}` : ''}.`
    : `${name} of ${monthYear(dt)} ${gust ? `gusted to ${gust}${where ? ' ' + where : ''}` : `hit ${ctx.z.countyName} County`}.`;
  const psps = (w.kind === 'santa_ana' || w.kind === 'diablo') && dt.y >= 2019 && num(ctx.z.fhsz_any) > 20;
  const W = LINES.wind;
  const pools = psps ? [W.psps, W.any] : L.hasHouse ? [W.any, W.house] : [W.any];
  const weight = 0.22 + 0.12 * smoothstep(60, 120, num(w.gust)) + 0.15 * Math.min(1, Math.log10(num(w.dmg) + 1) / 7) + (num(w.deaths) > 0 ? 0.08 : 0);
  return { year: dt.y, date: dt.iso, kind: 'wind', title: `${WIND_NAMES[w.kind] || 'the windstorm'} of ${monthYear(dt)}`, weight: round(clamp(weight, 0, 1), 2), source: `windsOf(${ctx.z.zip}): ${w.kind} ${w.start}`, fact, scope: 'county', pools, vars: { days: r.pick(['a day', 'two days', 'three days']) } };
}

const FEMA_KIND = k => (k === 'Fire' ? 'fire' : k === 'Earthquake' ? 'quake' : 'storm');
const DAY_MS = 86400000;

/**
 * FEMA declarations as events: declarations of the same kind (fire, quake, storm, where floods and winter and
 * severe storms are all storms) within 120 days of the one before are one event, latest first.
 */
function femaEvents(list) {
  const items = [];
  for (const f of list) { const dt = f && parseDate(f[0]); if (dt && dt.iso) items.push({ f, dt, ms: Date.parse(dt.iso), kind: FEMA_KIND(f[1]) }); }
  items.sort((a, b) => a.ms - b.ms);
  const groups = [];
  for (const it of items) {
    let g = null;
    for (let k = groups.length - 1; k >= 0; k--) if (groups[k].kind === it.kind) { g = groups[k]; break; }
    if (g && it.ms - g.last <= 120 * DAY_MS) { g.items.push(it); g.last = it.ms; } else groups.push({ kind: it.kind, items: [it], last: it.ms });
  }
  return groups.sort((a, b) => b.last - a.last);
}

function femaMemory(g, ctx, L) {
  const first = g.items[0], last = g.items[g.items.length - 1];
  const dt = first.dt, dt2 = last.dt;
  const titles = [...new Set(g.items.map(x => clean(x.f[2]) || x.f[1]))];
  const county = ctx.z.countyName;
  const when = monthYear(dt) === monthYear(dt2) ? monthYear(dt)
    : dt.y === dt2.y && dt.m && dt2.m ? `${MONTHS[dt.m - 1]} to ${MONTHS[dt2.m - 1]} ${dt.y}` : `${monthYear(dt)} to ${monthYear(dt2)}`;
  const fact = g.items.length > 1 ? `Federal disaster declarations for ${county} County, ${when}: ${titles.join('; ')}.` : `Federal disaster declaration for ${county} County, ${when}: ${titles[0]}.`;
  const snowy = num(ctx.z.snowfall_in) >= 60 || num(ctx.z.snow_psf) >= 200;
  const kinds = new Set(g.items.map(x => x.f[1]));
  const Fm = LINES.fema;
  const pools = g.kind === 'fire' ? [Fm.fire] : g.kind === 'quake' ? [Fm.quake]
    : kinds.has('Winter Storm') && snowy ? [Fm.snow, Fm.storm] : kinds.has('Flood') ? [Fm.flood, Fm.storm] : [Fm.storm, Fm.flood];
  const weight = g.kind === 'fire' ? 0.24 : g.kind === 'quake' ? 0.5 : 0.4 + (g.items.length > 1 ? 0.05 : 0);
  const one = titles[0];
  const title = g.items.length > 1 ? `the ${g.kind === 'fire' ? 'fires' : 'storms'} of ${when}` : /^the\b/i.test(one) ? one : `the ${/^(Winter|Autumn|Severe)\b/.test(one) ? lowerFirst(one) : one}`;
  return {
    year: dt.y, date: dt.iso, kind: g.kind === 'fire' ? 'fire' : g.kind === 'quake' ? 'quake' : 'storm', title, weight,
    source: `femaOf(${ctx.z.zip}): ${g.items.map(x => `${x.f[0]} ${clean(x.f[2]) || x.f[1]}`).join(' + ')}`, fact, scope: 'county', pools, vars: {},
  };
}

function recordMemories(ctx, L, res, can) {
  const out = [];
  for (const rec of ctx.knowledge.records) {
    const dt = parseDate(rec.date);
    if (!dt || !can(dt.y, 'county')) continue;
    const at = rec.station ? ` at ${rec.station}` : '';
    let fact, weight;
    if (rec.kind === 'heat') { fact = `The record high${at} is ${rec.value}°F, set ${fullDate(dt)}.`; weight = 0.42; }
    else if (rec.kind === 'rain') { fact = `The one-day rain record${at} is ${rec.value} inches, set ${fullDate(dt)}.`; weight = 0.36; }
    else { fact = `The strongest gust on record${at} is ${rec.value} mph, on ${fullDate(dt)}.`; weight = 0.34; }
    const title = rec.kind === 'heat' ? `the record ${rec.value}°F day in ${dt.y}` : rec.kind === 'rain' ? `the record rain of ${monthYear(dt)}` : `the ${rec.value} mph gust of ${monthYear(dt)}`;
    out.push({ year: dt.y, date: dt.iso, kind: rec.kind, title, weight, source: `zip ${ctx.z.zip}: ${rec.source} ${rec.date}`, fact, scope: 'county', pools: [LINES.record[rec.kind] || LINES.record.gust], vars: {} });
  }
  return out;
}

/**
 * The couple's wedding year, the same in both partners' personas: drawn from the household and the couple, from
 * both partners' ages as the household lists them and the household's children young enough to be both of
 * theirs (an older child of one partner does not bound it). Married couples only: the householder and spouse, or
 * the householder's two parents. Null otherwise.
 */
function weddingYear(ctx, L, family) {
  const p = family.partner;
  if (!p || !isNum(p.age) || L.age < 19) return null;
  const elders = L.role === 'parent' && p.role === 'parent';
  const couple = elders || (L.role === 'householder' && p.role === 'spouse') || (L.role === 'spouse' && p.role === 'householder');
  if (!couple) return null;
  if (L.marital ? L.marital !== 'married' : elders || L.hhType !== 'married') return null;
  const younger = Math.min(L.age, p.age);
  if (younger < 18) return null;
  const members = Array.isArray(ctx.hh.members) ? ctx.hh.members : [];
  const kids = members.filter(x => x && isNum(x.age) && (elders ? x.role === 'householder' || x.role === 'sibling' : x.role === 'child') && x.age <= younger - 15).map(x => x.age);
  const hr = new Rng(hash3(S.marry, ctx.zi, num(ctx.npc.h) * 2 + (elders ? 1 : 0)));
  let at = clamp(Math.round(hr.normal(28, 4.5)), 19, 45);
  if (at > younger) at = younger - hr.int(Math.min(6, younger - 18) + 1); // married in the last few years
  let y = REF_YEAR - younger + at;
  if (kids.length) y = Math.min(y, REF_YEAR - Math.max(...kids) - hr.range(0, 3));
  return clamp(y, REF_YEAR - younger + 18, REF_YEAR);
}

/** "at a winery", "on my family's farm", "at my own shop": an employer in the first person, or null. */
function employerPhrase(employer) {
  let e = clean(employer);
  if (!e || /^a local employer$/i.test(e)) return null;
  e = e.replace(/^their own\b/i, 'my own').replace(/^their family\b/i, "my family's").replace(/^their\b/i, 'my');
  return `${/\b(farm|ranch|orchard|vineyard|boat|crew)\b/i.test(e) ? 'on' : 'at'} ${e}`;
}

/** Life events: arrival, the move, growing up here, kids' births, the wedding, retirement, the job, the roof. */
function lifeMemories(ctx, L, res, roof, family) {
  const { npc } = ctx;
  const r = rngFor(ctx.seed, S.life);
  const v = voiceOf(L);
  const out = [];
  const push = (year, kind, text, weight, source) => { if (isNum(year) && year <= REF_YEAR && year >= L.birthYear) out.push({ year, date: null, kind, title: text.replace(/\.$/, ''), text, weight, source }); };
  if (npc.nativity === 'foreign' && isNum(npc.arrivalYear)) push(npc.arrivalYear, 'life', `I came to the US in ${npc.arrivalYear}${str(npc.birthplace) ? ` from ${clean(npc.birthplace)}` : ''}.`, 0.85, 'npc.arrivalYear');
  if (!res.bornHere && res.zipSince > L.birthYear) push(res.zipSince, 'life', `${L.role === 'roommate' ? 'I' : v.We} moved into this ${HOME_WORD[L.dwelling] || 'place'} in ${res.zipSince}.`, 0.55, 'household.yearMoved');
  if (res.grewUpHere && L.age >= 12) push(L.birthYear, 'life', res.bornHere ? `I have lived in this ${HOME_WORD[L.dwelling] || 'home'} my whole life.` : `I grew up in ${ctx.z.countyName} County.`, 0.45, res.bornHere ? 'household.yearMoved' : 'residence.countySince');
  for (const k of family.kids) {
    const y = REF_YEAR - k.age;
    if (y - L.birthYear >= 15) push(y, 'life', `${k.name || (k.sex === 'F' ? 'My daughter' : 'My son')} was born in ${y}.`, 0.9, 'household.members');
  }
  if (family.grandkids.length) {
    const g = family.grandkids.slice().sort((a, b) => b.age - a.age)[0];
    const y = REF_YEAR - g.age;
    if (y - L.birthYear >= 34) push(y, 'life', g.name ? `My grandchild ${g.name} was born in ${y}.` : `My ${g.sex === 'F' ? 'granddaughter' : 'grandson'} was born in ${y}.`, 0.8, 'household.members');
  }
  const wed = weddingYear(ctx, L, family);
  if (wed !== null) push(wed, 'life', `${family.partner.name || (family.partner.sex === 'F' ? 'My wife' : 'My husband')} and I got married in ${wed}.`, 0.8, 'npc.marital');
  if (L.retired && L.age >= 55) {
    const y = clamp(L.birthYear + r.range(58, 67), REF_YEAR - 30, REF_YEAR - (L.age >= 67 ? 1 : 0));
    push(y, 'life', `I retired in ${y}.`, 0.6, 'npc.status');
  }
  if (L.worker && L.age >= 18) {
    const tenure = clamp(Math.round(r.lognormal(Math.log(2.5 + Math.max(0, L.age - 25) / 6), 0.6)), 0, L.age - 16);
    const y = REF_YEAR - tenure;
    const occ = npc.occupation && typeof npc.occupation === 'object' ? npc.occupation : {};
    const title = L.jobTitle, where = employerPhrase(occ.employer);
    const what = title ? `working as ${article(title)} ${lowerFirst(title)}${where ? ` ${where}` : ''}` : where ? `working ${where}` : 'my current job';
    push(y, 'life', `I started ${what} in ${y}.`, 0.4, 'npc.occupation');
  }
  if (roof && !roof.original && roof.installed >= Math.max(res.zipSince, L.birthYear + 20)) push(roof.installed, 'life', `${v.We} had the roof redone in ${roof.installed}${roof.solar ? ' and put solar on it' : ''}.`, 0.35, 'roof');
  return out;
}

/** The fires, storms, winds, disasters and records they lived through, and their own life events. */
function memoriesOf(ctx, L, res, roof, family) {
  const { zc } = ctx;
  const r = rngFor(ctx.seed, S.memories);
  const can = (year, scope) => isNum(year) && year <= REF_YEAR && year - L.birthYear >= MIN_MEMORY_AGE && year >= (scope === 'zip' ? res.zipSince : res.countySince);
  const events = [];
  const fires = zc.fires.filter(f => {
    if (!can(num(f.year), 'county')) return false;
    if (num(f.year) >= res.zipSince) return true;
    return num(f.destInZip) >= 50 || num(f.acres) >= 10000; // elsewhere in the county: only the big ones
  }).map(f => fireMemory(f, ctx, L, res, r)).sort((a, b) => b.weight - a.weight).slice(0, 3);
  events.push(...fires);
  const winter = a => { const d = parseDate(a.start); return d ? (d.m >= 7 ? d.y : d.y - 1) : 0; };
  const seenWinter = new Set();
  const ars = zc.ars.filter(a => num(a.rank) >= 4 && can(parseDate(a.start)?.y, 'county'))
    .sort((a, b) => num(b.rank) - num(a.rank) || num(b.dmg) - num(a.dmg))
    .filter(a => { const w = winter(a); if (seenWinter.has(w)) return false; seenWinter.add(w); return true; })
    .slice(0, num(ctx.z.ar_n) >= 6 ? 2 : 1).map(a => arMemory(a, ctx, L, r)).filter(Boolean);
  const winds = zc.winds.filter(w => can(parseDate(w.start)?.y, 'county') && (num(w.dmg) >= 250000 || num(w.deaths) > 0 || ((w.kind === 'santa_ana' || w.kind === 'diablo') && num(w.gust) >= 80)))
    .slice(0, 1).map(w => windMemory(w, ctx, L, r)).filter(Boolean);
  // federal declarations, minus the fires and storms already remembered by name or date, merged into events
  const fireNames = fires.map(m => m.source.split(': ')[1].replace(/ \d{4}$/, '').toLowerCase());
  const nearAr = d => ars.some(m => m.date && Math.abs(Date.parse(m.date) - Date.parse(d)) < 60 * DAY_MS);
  const declared = zc.fema.filter(f => f && can(parseDate(f[0])?.y, 'county'))
    .filter(f => !(f[1] === 'Fire' && fireNames.some(n => String(f[2]).toLowerCase().includes(n))))
    .filter(f => !(FEMA_KIND(f[1]) === 'storm' && nearAr(parseDate(f[0]).iso)));
  const fema = femaEvents(declared).sort((a, b) => (a.kind === 'fire' ? 1 : 0) - (b.kind === 'fire' ? 1 : 0) || b.last - a.last)
    .slice(0, 2).map(g => femaMemory(g, ctx, L));
  events.push(...ars, ...winds, ...fema, ...recordMemories(ctx, L, res, can).slice(0, 2));
  // how much each event marked this person: the same storm is a story for one neighbor and a footnote for another
  const mark = rngFor(ctx.seed, S.memories ^ 0x3a3a);
  for (const m of events) m.weight = round(clamp(m.weight * (0.85 + 0.3 * mark.float()), 0, 1), 2);
  const kept = events.sort((a, b) => b.weight - a.weight).slice(0, 7);
  // their own experience of each, most important first, never the same sentence twice
  const lines = new LinePicker(rngFor(ctx.seed, S.lines), voiceOf(L));
  for (const m of kept) {
    const exp = lines.pick(m.vars, ...m.pools);
    m.experience = exp;
    m.text = exp ? `${m.fact} ${exp}` : m.fact;
    delete m.pools; delete m.vars;
  }
  const life = lifeMemories(ctx, L, res, roof, family);
  const all = [...kept, ...life.sort((a, b) => b.weight - a.weight).slice(0, 5)];
  return all.sort((a, b) => b.weight - a.weight || b.year - a.year);
}

// ---------------------------------------------------------------- speech

const EDU_LEVEL = { nohs: 0.05, hs: 0.25, somecollege: 0.4, associate: 0.45, bachelor: 0.65, master: 0.8, professional: 0.9, doctorate: 1 };
const FORMAL_OCC = new Set(['legal', 'management', 'education', 'practitioner', 'business', 'science']);
const PLAIN_OCC = new Set(['construction', 'food', 'transport', 'moving', 'farming', 'repair', 'production', 'cleaning']);

const FILLERS = {
  young: ['like', 'honestly', 'literally', 'lowkey', 'I mean', 'kinda'],
  mid: ['you know', 'I mean', 'honestly', 'basically', 'kind of', 'anyway'],
  old: ['well', 'you know', 'I tell you', 'mind you', 'anyhow', 'let me tell you'],
};

/**
 * Code-switching: {lang, rate} for a non-English home language, null otherwise. The rate falls by generation and
 * rises with limited English: first generation with limited English 0.55..0.75, first generation speaking English
 * very well 0.25..0.40, second generation 0.08..0.24, third 0.01..0.04.
 */
export function codeSwitchOf(npc, seed) {
  const lang = str(npc && npc.languages && npc.languages.home);
  if (!lang || lang === 'english') return null;
  const eng = npc.languages.english;
  const gen = isNum(npc.generation) ? clamp(Math.round(npc.generation), 1, 3) : npc.nativity === 'foreign' ? 1 : 2;
  const [lo, hi] = gen === 1 ? (eng === 'limited' ? [0.55, 0.75] : [0.25, 0.4]) : gen === 2 ? (eng === 'limited' ? [0.16, 0.24] : [0.08, 0.16]) : [0.01, 0.04];
  return { lang, rate: round(lerp(lo, hi, rngFor(seed, S.speech ^ 0xc0de).float()), 3) };
}

function catchphrasesOf(ctx, L, big5, teams, humorStyle, interests, r) {
  const { z, zc } = ctx;
  const O = num(big5.O, 0.5), C = num(big5.C, 0.5), E = num(big5.E, 0.5), A = num(big5.A, 0.5), N = num(big5.N, 0.5);
  const place = str(z.placeName) || z.city;
  const team = teams.find(t => t.sport !== 'college') || teams[0];
  const T = [
    [0.5 + (N < 0.4 ? 0.4 : 0), 'It is what it is.'],
    [0.4, "Can't complain. Well, I could, but who'd listen?"],
    [0.35 + (C > 0.6 ? 0.3 : 0), 'One thing at a time.'],
    [team ? 0.9 : 0, team ? `${team.name} all the way.` : ''],
    [E > 0.6 ? 0.6 : 0.1, `Never a dull day in ${place}.`],
    [A > 0.6 ? 0.6 : 0.05, 'Be good to each other.'],
    [C > 0.62 || L.shift === 'early' ? 0.55 : 0.05, 'Early bird gets the worm.'],
    [(num(z.snowfall_in) >= 40 || num(z.snow_psf) >= 200) ? 0.7 : 0, 'Chains in the trunk, always.'],
    [num(z.h100) >= 30 ? 0.65 : 0, "They say it's a dry heat. It's still hot."],
    [num(z.coast_km, 99) <= 10 && num(z.tjul, 80) <= 72 ? 0.6 : 0, `Bring a jacket. It's ${place}.`],
    [L.isParent ? 0.5 : 0, 'Kids keep you young.'],
    [L.retired ? 0.6 : 0, "Every day's a Saturday now."],
    [L.farm ? 0.7 : 0, 'No farms, no food.'],
    [L.occKey === 'construction' ? 0.6 : 0, 'Measure twice, cut once.'],
    [N > 0.62 ? 0.55 : 0, 'Knock on wood.'],
    [O > 0.62 ? 0.5 : 0, "Life's too short for boring food."],
    [humorStyle === 'dry' && num(z.rain_in) >= 30 ? 0.6 : 0, 'Could be worse. Could be raining. Oh, wait.'],
    [A < 0.4 ? 0.5 : 0, "I'm just saying what everyone's thinking."],
    [L.commuteMin >= 45 ? 0.6 : 0, 'Traffic was brutal, as usual.'],
    [zc.rural ? 0.4 : 0, 'Out here, everybody knows your truck.'],
    [interests.some(i => i.name === 'surfing') ? 0.6 : 0, 'The ocean always wins.'],
    [0.3, 'Same old, same old.'],
    [0.25, "We'll see."],
  ].filter(([w, t]) => w > 0 && t);
  const n = 2 + (E > 0.62 ? 1 : 0);
  const out = [];
  while (out.length < n && T.length) {
    const i = r.weighted(T.map(x => x[0]));
    if (i < 0) break;
    out.push(T[i][1]);
    T.splice(i, 1);
  }
  return out;
}

/** How they talk: dialect, register, verbosity, slang, humor, directness, code-switching, fillers, catchphrases. */
function speechOf(ctx, L, big5, dialectFor, interests, teams) {
  const { world, zi, z, zc, seed, npc } = ctx;
  const r = rngFor(seed, S.speech);
  const O = num(big5.O, 0.5), C = num(big5.C, 0.5), E = num(big5.E, 0.5), A = num(big5.A, 0.5), N = num(big5.N, 0.5);
  let dialect = null;
  if (typeof dialectFor === 'function') { try { dialect = dialectFor(world, zi) || null; } catch { dialect = null; } }
  dialect = dialect || z.regionKey || 'ca';
  const a = L.age;
  const edu = EDU_LEVEL[L.education] ?? (a < 18 ? clamp(a / 40, 0, 0.4) : 0.35);
  const formality = 0.3 + (a >= 50 ? 0.12 : 0) + (a >= 70 ? 0.06 : 0) + 0.18 * edu + 0.2 * (C - 0.5) + 0.1 * (A - 0.5) - (a < 25 ? 0.15 : 0)
    + (FORMAL_OCC.has(L.occKey) ? 0.1 : 0) - (PLAIN_OCC.has(L.occKey) ? 0.05 : 0) + r.normal(0, 0.05);
  const register = formality >= 0.5 ? 'formal' : formality <= 0.28 ? 'casual' : 'neutral';
  const verbosity = round(clamp(0.5 + 0.6 * (E - 0.5) + 0.2 * (O - 0.5) + (a >= 60 ? 0.05 : 0) + r.normal(0, 0.06), 0, 1), 2);
  const slang = round(clamp(0.12 + 0.45 * smoothstep(48, 15, a) + 0.25 * (E - 0.5) + (zc.urban ? 0.06 : 0) - (register === 'formal' ? 0.12 : 0) + r.normal(0, 0.05), 0, 1), 2);
  const humor = round(clamp(0.42 + 0.35 * (E - 0.5) + 0.25 * (O - 0.5) - 0.25 * (N - 0.5) + r.normal(0, 0.06), 0, 1), 2);
  const humorStyle = humor < 0.25 ? 'earnest' : E < 0.45 && O >= 0.5 ? 'dry' : A < 0.42 ? 'sarcastic' : E > 0.58 && A >= 0.5 ? 'playful' : a >= 60 ? 'gentle' : 'wry';
  const directness = round(clamp(0.5 - 0.6 * (A - 0.5) + 0.3 * (E - 0.5) - 0.2 * (N - 0.5) + (a >= 50 ? 0.04 : 0) + r.normal(0, 0.05), 0, 1), 2);
  if (a < 13) { // children: plain, playful, no grown-up sayings
    const kidHumor = humor < 0.25 ? 'earnest' : 'playful';
    const fillersKid = a < 8 ? ['um'] : r.sample(['um', 'like', 'wait'], verbosity >= 0.5 ? 2 : 1);
    const phrases = a < 8 ? [] : r.sample(["That's so cool.", 'Wait, really?', 'No way.', "That's not fair."], E > 0.6 ? 2 : 1);
    return { dialect, register: 'casual', verbosity, slang: round(clamp(0.1 + 0.05 * (a - 5) + r.normal(0, 0.04), 0, 0.5), 2), humor, humorStyle: kidHumor, directness, codeSwitch: codeSwitchOf(npc, seed), fillers: fillersKid, catchphrases: phrases };
  }
  const pool = (a < 25 ? FILLERS.young : a < 55 ? FILLERS.mid : FILLERS.old).filter(f => register !== 'formal' || !['like', 'lowkey', 'literally', 'kinda'].includes(f));
  const nf = verbosity >= 0.65 ? 3 : verbosity >= 0.35 ? 2 : 1;
  const fillers = r.sample(pool, nf);
  const catchphrases = catchphrasesOf(ctx, L, big5, teams, humorStyle, interests, r);
  return { dialect, register, verbosity, slang, humor, humorStyle, directness, codeSwitch: codeSwitchOf(npc, seed), fillers, catchphrases };
}

// ---------------------------------------------------------------- family (with names, for the bio, memories and hooks)

function familyOf(ctx) {
  const rel = relationsOf(ctx.npc, ctx.hh.members);
  const named = x => (x ? { m: x.m, role: x.role, name: memberName(x), age: isNum(x.age) ? x.age : null, sex: x.sex === 'F' || x.sex === 'M' ? x.sex : null } : null);
  return {
    partner: named(rel.partner), kids: rel.kids.map(named), grandkids: rel.grandkids.map(named), parents: rel.parents.map(named),
    grandparents: rel.grandparents.map(named), siblings: rel.siblings.map(named), roommates: rel.roommates.map(named), relatives: rel.relatives.map(named),
  };
}

function pronouns(npc) {
  const given = String(npc.pronouns || '').toLowerCase();
  const she = given ? /^she/.test(given) : npc.sex === 'F';
  return she ? { sub: 'she', obj: 'her', pos: 'her', Sub: 'She', Pos: 'Her' } : { sub: 'he', obj: 'him', pos: 'his', Sub: 'He', Pos: 'His' };
}

function kinPhrase(list, one, many, P) {
  if (!list.length) return null;
  if (list.length === 1) { const k = list[0]; return `${P.pos} ${one(k)}`; }
  return `${numWord(list.length)} ${many}`;
}

/** "her husband and two kids" from the NPC's point of view. */
function householdPhrase(L, fam, P) {
  const parts = [];
  if (fam.partner) parts.push(`${P.pos} ${L.role === 'partner' || fam.partner.role === 'partner' ? 'partner' : fam.partner.sex === 'F' ? 'wife' : fam.partner.sex === 'M' ? 'husband' : 'spouse'}`);
  if (fam.kids.length) parts.push(fam.kids.length === 1 ? `${P.pos} ${fam.kids[0].sex === 'F' ? 'daughter' : 'son'}` : `${numWord(fam.kids.length)} kids`);
  if (fam.parents.length) parts.push(fam.parents.length >= 2 ? `${P.pos} parents` : `${P.pos} ${fam.parents[0].sex === 'F' ? 'mother' : 'father'}`);
  if (fam.grandparents.length) parts.push(fam.grandparents.length >= 2 ? `${P.pos} grandparents` : `${P.pos} ${fam.grandparents[0].sex === 'F' ? 'grandmother' : 'grandfather'}`);
  if (fam.siblings.length) parts.push(kinPhrase(fam.siblings, k => (k.sex === 'F' ? 'sister' : 'brother'), 'siblings', P));
  if (fam.grandkids.length) parts.push(fam.grandkids.length === 1 ? `a grandchild` : `${numWord(fam.grandkids.length)} grandchildren`);
  if (fam.roommates.length) parts.push(fam.roommates.length === 1 ? 'a roommate' : `${numWord(fam.roommates.length)} roommates`);
  if (fam.relatives.length && parts.length < 3) parts.push(fam.relatives.length === 1 ? 'a relative' : 'relatives');
  return parts.length ? `with ${listJoin(parts.slice(0, 4))}` : null;
}

// How a life role reads in a bio when it is not a job ("retired gardener" is a retiree who gardens, not a former gardener)
const ROLE_PHRASE = {
  retiree: 'is retired', 'retired gardener': 'is retired and keeps a big garden', 'retired grandparent': 'is retired and helps raise the grandkids',
  'retired veteran': 'is a retired veteran', snowbird: 'is retired and spends the winters here', 'stay-at-home parent': 'stays home with the kids',
  homemaker: 'keeps the household running', 'job seeker': 'is looking for work', 'new parent': 'has a new baby at home',
};

const MODE_VERB = { drive: 'drives', carpool: 'carpools', bus: 'takes the bus', rail: 'takes the train', ferry: 'takes the ferry', taxi: 'takes rideshares', motorcycle: 'rides a motorcycle', bike: 'bikes', walk: 'walks', other: 'travels' };

/** Two or three sentences from the facts. */
function bioOf(ctx, L, archetype, res, interests, concerns, knowledge, fam) {
  const { npc } = ctx;
  const P = pronouns(npc);
  const name = (npc.name && (str(npc.name.display) || str(npc.name.full) || str(npc.name.first))) || 'This neighbor';
  const place = knowledge.neighborhood;
  const title = L.jobTitle;
  let s1;
  if (L.age < 5) s1 = `${name} is ${L.age === 0 ? 'a baby' : `${numWord(L.age)} years old`}.`;
  else if (L.worker && title && L.age >= 16) {
    const where = knowledge.workCity && knowledge.workCity !== knowledge.city && L.mode !== 'wfh' ? ` in ${knowledge.workCity}` : L.mode === 'wfh' ? ' from home' : '';
    s1 = `${name}, ${L.age}, works as ${article(title)} ${lowerFirst(title)}${where}${L.shift === 'night' ? ', on nights' : L.shift === 'early' ? ', starting before dawn' : ''}.`;
  } else {
    const onlyKid = archetype === 'stay-at-home parent' && fam.kids.filter(k => isNum(k.age) && k.age < 18).length === 1 ? fam.kids.find(k => k.age < 18) : null;
    const role = onlyKid ? `stays home to raise ${P.pos} ${onlyKid.sex === 'F' ? 'daughter' : 'son'}` : ROLE_PHRASE[archetype] || `is ${article(archetype)} ${archetype} in ${place}`;
    s1 = `${name}, ${L.age}, ${role}.`;
  }
  const homeWord = { house: 'house', 'small-apartment': 'small apartment', apartment: 'apartment', 'mobile-home': 'mobile home' }[L.dwelling] || 'home';
  const decides = ADULT_ROLES.has(L.role) && L.tenure;
  const verb = decides ? (L.tenure === 'own' ? 'owns' : 'rents') : 'lives in';
  const withWho = householdPhrase(L, fam, P);
  const since = res.bornHere ? `, where ${P.sub} has lived all ${P.pos} life` : res.grewUpHere ? `, in the county where ${P.sub} grew up` : `, and has lived there since ${res.zipSince}`;
  const s2 = `${P.Sub} ${verb} ${article(homeWord)} ${homeWord} in ${place}${withWho ? ' ' + withWho : L.hhSize <= 1 ? ' on ' + P.pos + ' own' : ''}${since}.`;
  const top = concerns[0];
  const firstInterest = interests[0] ? interests[0].name : null;
  let s3 = null;
  if (L.mode && L.mode !== 'wfh' && L.commuteMin >= 30 && knowledge.workCity && L.age >= 16) {
    const road = ROAD_MODES.has(L.mode) ? knowledge.roads.find(x => x.commute) : null;
    const to = knowledge.workCity === knowledge.city ? (L.student && !L.worker ? 'to school' : 'to work') : `to ${knowledge.workCity}`;
    s3 = `${P.Sub} ${MODE_VERB[L.mode] || 'travels'} ${L.commuteMin} minutes each way ${to}${road ? ` on ${road.name}` : ''}${top ? ` and worries about ${CONCERN_WORDS[top.topic] || top.topic}` : ''}.`;
  } else if (firstInterest) {
    s3 = `${P.Sub} loves ${firstInterest}${top && L.age >= 13 ? ` and worries about ${CONCERN_WORDS[top.topic] || top.topic}` : ''}.`;
  }
  return [s1, s2, s3].filter(Boolean).join(' ');
}

const CONCERN_WORDS = {
  insurance: 'keeping the house insured', fire: 'the next wildfire', smoke: 'smoke season', heat: 'the summer heat', storms: 'the winter storms',
  flooding: 'flooding', wind: 'the wind', 'power shutoffs': 'power shutoffs', snow: 'the snow', housing: 'what housing costs', rent: 'the rent',
  commute: 'the commute', roof: 'the old roof', earthquakes: 'the next big earthquake', jobs: 'finding work', water: 'water for the farms',
  health: 'staying healthy', schools: 'the schools', 'family abroad': 'family back home',
};

// ---------------------------------------------------------------- hooks

/** Three to five things they would bring up unprompted: the weather or an alert, a worry, an interest, a memory, family. */
function hooksOf(ctx, L, big5, interests, concerns, memories, fam, wx) {
  const r = rngFor(ctx.seed, S.hooks);
  const E = num(big5.E, 0.5);
  const items = [];
  const near = relevantAlerts(wx && wx.alerts, ctx.z.coast_km);
  const alert = near.length ? near.slice().sort((a, b) => alertBoost(b) - alertBoost(a))[0] : null;
  const now = wx && wx.now ? wx.now : null;
  if (alert && L.age >= 13) items.push({ kind: 'weather', topic: 'weather', text: `the ${alert.event} the weather service has out`, w: 0.9 + alertBoost(alert) });
  else if (now && isNum(now.tempF)) {
    const short = String(now.short || (wx.period && wx.period.short) || '').toLowerCase();
    const hot = now.tempF >= 95, cold = now.tempF <= 40, wet = /rain|shower|storm|drizzle|snow/.test(short);
    items.push({ kind: 'weather', topic: 'weather', text: hot ? `the heat today, ${now.tempF}°F` : cold ? `the cold today, ${now.tempF}°F` : wet ? `the ${/snow/.test(short) ? 'snow' : 'rain'} today` : `the weather today, ${short || 'mild'} and ${now.tempF}°F`, w: hot || cold || wet ? 0.8 : 0.45 });
  }
  if (concerns[0] && L.age >= 13) items.push({ kind: 'concern', topic: concerns[0].area, text: CONCERN_WORDS[concerns[0].topic] || concerns[0].topic, w: 0.6 + 0.4 * concerns[0].weight });
  const interest = interests.find(i => !i.tradition);
  if (interest) items.push({ kind: 'interest', topic: /the (Dodgers|Angels|Padres|Giants|A's|Warriors|Kings|Lakers|Clippers|Rams|Chargers|49ers|Sharks|Ducks|LA Kings|Galaxy)|LAFC|San Diego FC|football|San Diego State/.test(interest.name) ? 'sports' : 'interest', text: interest.name, w: 0.55 + 0.2 * E });
  const events = memories.filter(m => m.kind !== 'life').slice(0, 3);
  const memory = events.length ? r.weightedItem(events, m => m.weight) : memories[0];
  if (memory && L.age >= 10) items.push({ kind: 'memory', topic: memory.kind === 'fire' ? 'fire' : 'history', text: memory.title || memory.text, w: 0.45 + 0.4 * memory.weight });
  const kidNames = [...new Set(fam.kids.map(k => k.name).filter(Boolean))];
  if (fam.kids.length === 1) items.push({ kind: 'family', topic: 'family', text: `their ${fam.kids[0].sex === 'F' ? 'daughter' : 'son'}${kidNames[0] ? ', ' + kidNames[0] : ''}`, w: 0.6 });
  else if (fam.kids.length) items.push({ kind: 'family', topic: 'family', text: kidNames.length ? `their kids, ${listJoin(kidNames.slice(0, 3))}` : 'their kids', w: 0.6 });
  else if (fam.grandkids.length) items.push({ kind: 'family', topic: 'family', text: 'their grandkids', w: 0.6 });
  else if (fam.partner) items.push({ kind: 'family', topic: 'family', text: `their ${fam.partner.role === 'partner' ? 'partner' : fam.partner.sex === 'F' ? 'wife' : 'husband'}${fam.partner.name ? ', ' + fam.partner.name : ''}`, w: 0.35 });
  if (concerns[1] && L.age >= 18) items.push({ kind: 'concern', topic: concerns[1].area, text: CONCERN_WORDS[concerns[1].topic] || concerns[1].topic, w: 0.35 + 0.3 * concerns[1].weight });
  // never fewer than three: more of what they love, then what else is on their mind
  for (const i of interests) if (items.length < 3 && !i.tradition && !items.some(x => x.text === i.name)) items.push({ kind: 'interest', topic: 'interest', text: i.name, w: 0.3 });
  for (const m of memories) if (items.length < 3 && L.age >= 10 && !items.some(x => x.text === (m.title || m.text))) items.push({ kind: 'memory', topic: 'history', text: m.title || m.text, w: 0.25 });
  if (items.length < 3) items.push({ kind: 'place', topic: 'neighborhood', text: `life in ${ctx.knowledge.neighborhood}`, w: 0.2 });
  const n = clamp(3 + (E > 0.55 ? 1 : 0) + (E > 0.7 ? 1 : 0), 3, 5);
  return items.map(x => ({ x, s: x.w * (0.85 + 0.3 * r.float()) })).sort((a, b) => b.s - a.s).slice(0, n).map(({ x }) => ({ kind: x.kind, topic: x.topic, text: x.text }));
}

// ---------------------------------------------------------------- the persona

/**
 * @typedef {Object} Persona
 * @property {number} v                    PERSONA_VERSION
 * @property {string} id                   the NPC id
 * @property {Object} npc                  the layer 1 NPC record
 * @property {{O:number,C:number,E:number,A:number,N:number}} big5   0..1
 * @property {string[]} traits             3 to 5 adjectives
 * @property {string} archetype            a short life-role label
 * @property {string[]} values             top three Schwartz values
 * @property {string[]} interests          3 to 6 interests
 * @property {{name:string, why:string, tradition?:boolean}[]} interestDetails   the datum behind each interest
 * @property {{name:string, sport:string}[]} teams
 * @property {{label:string, day:number, why:string}|null} practice   their own churchgoing
 * @property {{topic:string, weight:number, why:string, area:string}[]} concerns
 * @property {{year:number, date:string|null, kind:string, text:string, weight:number, source:string, title?:string, fact?:string, experience?:string|null, scope?:string}[]} memories
 *   events: text = fact (from the pack) + experience (their own, never repeated within one persona); life events: text alone
 * @property {{neighborhood:string, city:string, zip:string, county:string, countyLabel:string, region:string, regionThe:string, province:string,
 *   landmarks:{name:string,kind:string,distKm:number}[], roads:{name:string,route:number,kind:string,distKm:number,aadt:number,commute:boolean}[],
 *   nearbyPlaces:{name:string,distKm:number,pop:number}[], workCity:string|null, workZip:string|null,
 *   records:{kind:string,value:number,unit:string,date:string,year:number,station:string,source:string}[]}} knowledge
 * @property {{dialect:string, register:'casual'|'neutral'|'formal', verbosity:number, slang:number, humor:number, humorStyle:string,
 *   directness:number, codeSwitch:{lang:string, rate:number}|null, fillers:string[], catchphrases:string[]}} speech
 * @property {string} bio
 * @property {string[]} hooks              things they would bring up unprompted
 * @property {{kind:string, topic:string, text:string}[]} hookDetails
 * @property {{zipSince:number, countySince:number, grewUpHere:boolean, bornHere:boolean, householdCounty:number, yearsInZip:number, yearsInCounty:number}} residence
 *   householdCounty: when the household came to the county (the same for every member; its children never predate it)
 * @property {{age:number, material:string, solar:boolean, installed:number, original:boolean, why:string}|null} roof
 * @property {Object} routine              what schedule.mjs reads: layer 0's commute fields (mode, departMin, commuteMin, dwellMin,
 *   days, work), occKey (the Census occupation group) and outdoor, schoolRuns (the escort legs this adult takes: {kind
 *   'drop-off'|'pickup', mode 'drive'|'walk'|'bike'|'bus-stop', children, school, departMin | arriveMin and leaveMin,
 *   commuteMin, stopMin, days}), ride (for a child: {driver, pickup, legs:[{kind, mode, driver, days}]}), household (the
 *   same in every member's persona: members' layer 0 days, the school runs with their drivers, churchgoers and the
 *   shared park, grocery store, church, beach and relatives; schedule.familyOutings reads it) and places
 * @property {number} t                    the time the weather-dependent parts were computed for (epoch ms)
 */

/**
 * The persona of one NPC. Deterministic from the pack, the NPC (its seed) and opts.t; about half a millisecond.
 * @param {import('./world.mjs').World} world
 * @param {Object} npc                      a layer 1 NPC (population.mjs person/get)
 * @param {{population?:Object, dialectFor?:(world:Object, zi:number)=>string, t?:number}} [opts]
 *   population: read for layer 0 (householdCore) commute fields and school runs; dialectFor: lexicon.dialectFor
 *   (falls back to the region key); t: epoch ms for the weather and alerts in concerns and hooks (default the
 *   NWS snapshot time).
 * @returns {Persona}
 */
export function persona(world, npc, opts = {}) {
  if (!world || !npc) throw new Error('persona(world, npc): both are required');
  const zi = zipIndexOf(world, npc);
  if (zi < 0) throw new Error(`persona: NPC ${npc && npc.id} has no ZIP in this world`);
  const zc = zipInfo(world, zi), z = zc.z;
  const hh = npc.household && typeof npc.household === 'object' ? npc.household : {};
  const core = layer0(opts.population, zi, npc);
  const home = validPoint(hh.home) || (core && validPoint(core.hh.home)) || (Number.isInteger(npc.h) ? world.homeFor(zi, npc.h) : { x: z.tx, y: z.ty });
  const t = isNum(opts.t) ? opts.t : world.snapshotTime;
  const ctx = { world, npc, zi, z, zc, hh, core, home, t, seed: seedOf(npc), pop: opts.population || null, view: null };
  const L = lifeBasis(ctx);
  L.birthYear = birthYearOf(npc);
  L.workZi = core && core.me ? core.me.workZi : (npc.commute && npc.commute.workZi);
  ctx.work = (core && core.me && validPoint(core.me.work)) || (npc.commute && validPoint(npc.commute.work)) || null;

  const { big5, traits } = personality(traitBasis(world, npc));
  const archetype = archetypeOf(L, ctx.seed);
  const values = valuesOf(L, big5, ctx.seed);

  const view = householdView(ctx);
  const residence = residenceOf(ctx, L);
  const roof = roofOf(ctx, L);
  const churchgoers = churchgoersOf(ctx, view);
  const practice = practiceOf(ctx, L, churchgoers);
  const knowledge = knowledgeOf(ctx, L);
  ctx.knowledge = knowledge;
  const teams = teamsOf(ctx, L, big5);
  const shared = householdPlaces(ctx, churchgoers);
  const places = placesOf(ctx, L, knowledge, teams, shared);
  const interestItems = interestsOf(ctx, L, big5, archetype, knowledge, teams, practice, places);
  const wx = weatherOf(world, zi, t);
  const concerns = concernsOf(ctx, L, big5, residence, roof, wx, knowledge);
  const fam = familyOf(ctx);
  const memories = memoriesOf(ctx, L, residence, roof, fam);
  const speech = speechOf(ctx, L, big5, opts.dialectFor, interestItems, teams);
  const bio = bioOf(ctx, L, archetype, residence, interestItems, concerns, knowledge, fam);
  const hookDetails = hooksOf(ctx, L, big5, interestItems, concerns, memories, fam, wx);
  const routine = routineOf(ctx, L, places, householdRoutineOf(ctx, L, view, churchgoers, shared), practice);

  return {
    v: PERSONA_VERSION,
    id: str(npc.id) || `${z.zip}-${npc.h}-${npc.m}`,
    npc,
    big5, traits, archetype, values,
    interests: interestItems.map(i => i.name),
    interestDetails: interestItems.map(i => (i.tradition ? { name: i.name, why: i.why, tradition: true } : { name: i.name, why: i.why })),
    teams: teams.map(tm => ({ name: tm.name, sport: tm.sport })),
    practice,
    concerns, memories, knowledge, speech, bio,
    hooks: hookDetails.map(h => h.text), hookDetails,
    residence, roof, routine, t,
  };
}
