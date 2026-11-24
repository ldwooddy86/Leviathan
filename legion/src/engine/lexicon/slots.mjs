// Legion · lexicon · template slots, filling, and the brand guard.
//
// Every regional line is a template: "{road} was a parking lot", "Snow on {landmark}!". The dialogue engine
// fills the slots from the world pack (see slotsFor in lexicon.mjs), so the facts in a line always come from
// the data. fill() never returns a line with an unfilled slot: if anything is missing it returns null and the
// caller picks another line.

/**
 * The documented slot vocabulary. Templates may use only these names.
 * @type {Readonly<Record<string, string>>}
 */
export const SLOTS = Object.freeze({
  road: 'a state highway near the speaker, as locals say it (roadName): "the 405", "880", "Highway 99", "PCH"',
  stretch: 'a famous named stretch near the speaker (namedStretch): "the Grapevine", "the Altamont", "Cajon Pass"',
  place: "the speaker's town or community as they'd name it: the Census place (\"East Los Angeles\", \"Lennox\"), or a big city's mailing neighborhood (\"Van Nuys\", \"San Pedro\")",
  city: "the ZIP's mailing city: \"Van Nuys\", \"San Diego\"",
  neighborhood: 'the local community name, as for place: "Florence-Graham", "Sherman Oaks", "Daly City"',
  landmark: 'the most prominent named peak, range, water or island nearby, with its article: "Twin Peaks", "the Berkeley Hills", "Humboldt Bay"',
  peak: 'a prominent mountain in view that is high enough to get snow, with its article: "Mount Diablo", "the San Gabriel Mountains"',
  county: 'the county name without the word County: "Fresno"',
  region: 'the region as locals say it (DIALECTS[key].regionThe): "the Bay Area", "the IE", "the Valley", "Tahoe"',
  temp: 'a temperature in degrees Fahrenheit, digits only: "104"',
  fire: 'a wildfire from the pack as people name it (fireLabel): "the Camp Fire", "the August Complex"',
  year: 'a four-digit year from the pack, paired with the fire or event in the same line: "2018"',
  team: 'a local sports team the speaker follows: "the Giants", "Fresno State"',
  weather: 'a short forecast description from the NWS snapshot, lowercase: "patchy fog", "sunny"',
  season: 'a season or seasonal phrase: "summer", "fire season", "the rainy season", "ski season"',
  month: 'a month name: "November"',
  day: 'a weekday name: "Monday"',
  alert: 'an active NWS alert name: "Wind Advisory", "Red Flag Warning"',
});

/** The slot names, in documentation order. */
export const SLOT_NAMES = Object.freeze(Object.keys(SLOTS));

const SLOT_SET = new Set(SLOT_NAMES);
const SLOT_RE = /\{([A-Za-z_][A-Za-z0-9_]*)\}/g;

/**
 * The slot names a template uses, in order of first appearance.
 * @param {string} template
 * @returns {string[]}
 */
export function templateSlots(template) {
  const out = [];
  for (const m of String(template).matchAll(SLOT_RE)) if (!out.includes(m[1])) out.push(m[1]);
  return out;
}

/** Upper-case the first letter of the line and of each sentence that a slot value opened in lower case. */
function capitalizeSentences(s) {
  return s.replace(/(^|[.!?]\s+)([a-z])/g, (m, pre, ch) => pre + ch.toUpperCase());
}

/**
 * Fill a template's {slots} from an object. Returns null when any slot is missing, empty, unknown (not in
 * SLOTS), or when the result would still contain a brace, so a caller can always pick another line. A slot
 * value that opens a sentence is capitalized ("the 405 was a parking lot" becomes "The 405 was a parking lot").
 * @param {string} template
 * @param {Record<string, string|number|null|undefined>} [slots]
 * @returns {string|null}
 */
export function fill(template, slots = {}) {
  if (typeof template !== 'string' || !template) return null;
  let ok = true;
  const out = template.replace(SLOT_RE, (m, name) => {
    if (!SLOT_SET.has(name)) { ok = false; return ''; }
    const v = slots ? slots[name] : undefined;
    if (v === undefined || v === null || (typeof v === 'number' && !Number.isFinite(v))) { ok = false; return ''; }
    const s = String(v).trim();
    if (!s) { ok = false; return ''; }
    return s;
  });
  if (!ok || /[{}]/.test(out)) return null;
  return capitalizeSentences(out);
}

// CAL FIRE unit and park codes that start complex names ("SCU Lightning Complex", "KNP Complex").
const FIRE_CODES = new Set('SCU CZU LNU BTU SHU TCU MEU TUU MMU RRU BDU LMU FKU BEU NEU SKU AEU HUU MVU SLU KNP SQF YNP LPF ANF SNF STF ENF TNF PNF MNF KNF CNF INF'.split(' '));

/**
 * A fire's name as people say it: "Camp" -> "the Camp Fire", "August Complex" -> "the August Complex",
 * "Scu Lightning Complex" -> "the SCU Lightning Complex". Null for unnamed or number-only fires.
 * @param {string|{name: string}} fire a pack fire name or fire object
 * @returns {string|null}
 */
export function fireLabel(fire) {
  let n = fire && typeof fire === 'object' ? fire.name : fire;
  if (!n) return null;
  n = String(n).trim().replace(/\s+/g, ' ');
  if (!n || /^unnamed$/i.test(n) || /^\d+$/.test(n)) return null;
  n = n.split(' ').map((w, k) => (k === 0 && FIRE_CODES.has(w.toUpperCase()) ? w.toUpperCase() : w)).join(' ');
  if (/\b(complex|fire)$/i.test(n)) return `the ${n.replace(/\b(complex|fire)$/i, w => w[0].toUpperCase() + w.slice(1).toLowerCase())}`;
  return `the ${n} Fire`;
}

// Businesses are generic in Legion ("the taco truck on the corner"), never brands. This list covers the chains
// and companies a California NPC would most plausibly name; the dialogue engine can also run Claude's output
// through findBrands. Entries are regex sources; those that are also ordinary words (written with a leading
// \b) match case-sensitively, the rest in any case.
const BRANDS = [
  'In-N-Out', 'In N Out', 'Starbucks', 'Walmart', 'Wal-Mart', '\\bTarget\\b', 'Costco', "McDonald'?s", 'Taco Bell',
  'Chipotle', "Trader Joe'?s", 'Whole Foods', 'Safeway', 'Ralphs', '\\bVons\\b', 'Albertsons', 'Kroger', 'Home Depot',
  "\\bLowe'?s\\b", 'Best Buy', 'Walgreens', '\\bCVS\\b', 'Rite Aid', '7-Eleven', "Denny'?s", '\\bIHOP\\b',
  'Jack in the Box', "Carl'?s Jr", 'Del Taco', "Wendy'?s", 'Burger King', '\\bKFC\\b', '\\bSubway\\b(?! Line)',
  'Panda Express', "Raising Cane'?s", 'Chick-fil-A', 'Dutch Bros', "\\bPeet'?s\\b", '\\bPhilz\\b', 'Blue Bottle',
  'Sizzler', '\\bAmazon\\b', '\\bGoogle\\b', 'Facebook', 'Instagram', 'TikTok', 'Netflix', '\\bDisney', "Knott'?s",
  'Six Flags', 'Magic Mountain', 'Universal Studios', 'Legoland', 'SeaWorld', '\\bTesla\\b', '\\bUber\\b',
  '\\bLyft\\b', 'DoorDash', '\\bWaze\\b', '\\bYelp\\b', 'PG&E', 'SDG&E', 'SoCal Edison', 'Chevron', '\\bARCO\\b',
  '\\bArco\\b', '\\bShell\\b(?! Beach)', '\\bKaiser\\b', "Raley'?s", 'Save Mart', 'WinCo', 'Stater Bros',
  'Food 4 Less', 'Smart & Final', 'Grocery Outlet', 'H Mart', '99 Ranch', 'Seafood City', 'Northgate Market',
  "\\bMacy'?s\\b", 'Nordstrom', 'TJ Maxx', 'Marshalls', "\\bPink'?s\\b", "Porto'?s", "Randy'?s Donuts",
  "Bob'?s Big Boy", 'Wienerschnitzel', "Rubio'?s", "Roberto'?s", 'El Pollo Loco', 'Yoshinoya', 'Boiling Crab',
  'Kung Fu Tea', 'Round Table', "Mountain Mike'?s", 'Fosters Freeze', 'Black Bear Diner', 'Coca-Cola', '\\bPepsi\\b',
  '\\bSpam\\b', 'iPhone', 'Apple Store', '\\bSoFi\\b', 'Crypto\\.com', 'Dodger Dogs?',
];
const BRAND_RES = BRANDS.map(src => new RegExp(src, src.startsWith('\\b') ? '' : 'i'));

/** Brand and company names that must never appear in a generated line (regex sources). */
export const BRAND_BLACKLIST = Object.freeze(BRANDS.slice());

/**
 * Brand names found in a text (from BRAND_BLACKLIST), as matched.
 * @param {string} text
 * @returns {string[]}
 */
export function findBrands(text) {
  const out = [];
  const s = String(text || '');
  for (const re of BRAND_RES) { const m = re.exec(s); if (m) out.push(m[0]); }
  return out;
}
