// Legion · lexicon · how Californians say their highways.
//
// Southern California puts "the" in front of a freeway number ("the 405", "the 5", "the 10") and calls State
// Route 1 along the Los Angeles and Orange County coast "PCH". Northern California drops the article ("280",
// "880", "80", "101"), keeps "I-5" for the interstate that runs past everyone at a distance, and says "Highway 1",
// "Highway 17". The Central Valley says "99" or "Highway 99"; the Sierra says "50", "80", "395". Older
// Angelenos and Bay Area natives still use the freeway names ("the Santa Monica Freeway", "the Nimitz").
// And a handful of stretches have names of their own that locals use instead of any number.

import { DIALECT_KEYS } from './geography.mjs';

const KM_PER_DEG = 111.2;

// style: 'socal' (the N), 'norcal' (bare numbers, I-5, Highway N on two-lane routes), 'valley' (99, Highway N),
// 'sierra' (80, 50, 395, Highway N), 'north' (I-5, 101, Highway 299), 'coastal' (101, Highway 1, mixed "the").
// theShare: how often a speaker in this dialect puts "the" before a number. pch: SR 1 on the LA/OC coast is PCH.
const USAGE = {
  sf: { style: 'norcal' }, eastbay: { style: 'norcal' }, southbay: { style: 'norcal' }, peninsula: { style: 'norcal' }, northbay: { style: 'norcal' },
  sacramento: { style: 'norcal' }, 'valley-north': { style: 'valley' }, 'valley-south': { style: 'valley' }, fresno: { style: 'valley' },
  kern: { style: 'socal', theShare: 0.6 },
  'la-westside': { style: 'socal', pch: true }, 'la-central': { style: 'socal', pch: true }, 'la-eastside': { style: 'socal', pch: true },
  sfv: { style: 'socal', pch: true }, 'santa-clarita': { style: 'socal', pch: true }, 'la-south': { style: 'socal', pch: true },
  'southbay-la': { style: 'socal', pch: true }, longbeach: { style: 'socal', pch: true }, sgv: { style: 'socal', pch: true },
  ventura: { style: 'socal', pch: true },
  'oc-coast': { style: 'socal', pch: true }, 'oc-inland': { style: 'socal', pch: true },
  ie: { style: 'socal', pch: true },
  'desert-cv': { style: 'socal', pch: true }, 'high-desert': { style: 'socal', pch: true }, 'antelope-valley': { style: 'socal', pch: true },
  'low-desert': { style: 'socal', pch: true }, imperial: { style: 'socal', pch: true },
  'sd-coast': { style: 'socal' }, 'sd-inland': { style: 'socal' },
  'central-coast': { style: 'coastal', theShare: 0.4 }, 'santa-barbara': { style: 'socal', theShare: 0.85 },
  salinas: { style: 'norcal' }, 'monterey-bay': { style: 'norcal' },
  'north-coast': { style: 'north' }, 'north-inland': { style: 'north' }, 'far-north': { style: 'north' },
  tahoe: { style: 'sierra' }, 'gold-country': { style: 'sierra' }, 'sierra-foothills': { style: 'sierra' }, 'eastern-sierra': { style: 'sierra' },
  'socal-mountains': { style: 'socal', pch: true },
};

// Northern California state routes that are busy freeways and get said as a bare number.
const NORCAL_BARE_SR = new Set([13, 24, 37, 65, 85, 87, 92, 99, 113, 237, 242]);
// Sierra routes said bare ("take 89 to Tahoe City", "28 around the north shore").
const SIERRA_BARE_SR = new Set([28, 89, 267]);
// Fixed local names for a route number regardless of style.
const NORCAL_OVERRIDE = { 51: 'Business 80' };

/**
 * How each dialect treats highway names: {style, the, theShare, pch}. `the` is true where people say "the 405".
 * @type {Readonly<Record<string, {style: string, the: boolean, theShare: number, pch: boolean}>>}
 */
export const ROAD_USAGE = Object.freeze(Object.fromEntries(DIALECT_KEYS.map(k => {
  const u = USAGE[k] || { style: 'norcal' };
  const theShare = u.theShare !== undefined ? u.theShare : (u.style === 'socal' ? 1 : 0);
  return [k, Object.freeze({ style: u.style, the: theShare >= 0.5, theShare, pch: !!u.pch })];
})));

/**
 * Normalize a road given as a roadsNear object ({name:'I-405', route:405, kind:'I'}), a name string
 * ('I-405', 'US 101', 'SR 99', 'CA-1', 'Highway 1', 'Interstate 5') or a bare route number (treated as a state route).
 * @param {object|string|number} road
 * @returns {{kind: 'I'|'US'|'SR', route: number, name: string, aadt: number|null}|null}
 */
export function normalizeRoad(road) {
  if (road == null) return null;
  if (typeof road === 'number') return Number.isFinite(road) && road > 0 ? { kind: 'SR', route: road, name: `SR ${road}`, aadt: null } : null;
  if (typeof road === 'object') {
    let kind = road.kind, route = +road.route;
    if ((!kind || !route) && road.name) { const n = normalizeRoad(String(road.name)); if (n) { kind = kind || n.kind; route = route || n.route; } }
    if (!kind || !(route > 0)) return null;
    kind = String(kind).toUpperCase();
    if (kind !== 'I' && kind !== 'US') kind = 'SR';
    return { kind, route, name: kind === 'I' ? `I-${route}` : `${kind} ${route}`, aadt: Number.isFinite(road.aadt) ? road.aadt : null };
  }
  const s = String(road).trim();
  let m = /^(?:I|Interstate)[\s-]*(\d+)$/i.exec(s);
  if (m) return { kind: 'I', route: +m[1], name: `I-${+m[1]}`, aadt: null };
  m = /^(?:US|U\.S\.)(?:\s*(?:Route|Highway))?[\s-]*(\d+)$/i.exec(s);
  if (m) return { kind: 'US', route: +m[1], name: `US ${+m[1]}`, aadt: null };
  m = /^(?:SR|CA|State Route|Highway|Hwy|Route)[\s-]*(\d+)$/i.exec(s);
  if (m) return { kind: 'SR', route: +m[1], name: `SR ${+m[1]}`, aadt: null };
  return null;
}

function routeKey(r) { return r.kind === 'I' ? `I-${r.route}` : `${r.kind} ${r.route}`; }

function norcalForms(r) {
  const n = r.route;
  if (r.kind === 'I') return n === 5 ? ['I-5', '5'] : [`${n}`, `I-${n}`];
  if (r.kind === 'US') return [`${n}`, `Highway ${n}`];
  if (n === 1) return ['Highway 1'];
  if (NORCAL_OVERRIDE[n]) return [NORCAL_OVERRIDE[n], `${n}`];
  // A one-digit route is "Highway 4", never just "4", however busy.
  const bare = n >= 10 && (NORCAL_BARE_SR.has(n) || (r.aadt != null && r.aadt >= 100000));
  return bare ? [`${n}`, `Highway ${n}`] : [`Highway ${n}`, `${n}`];
}

function valleyForms(r) {
  const n = r.route;
  if (r.kind === 'I') return n === 5 ? ['I-5', '5'] : [`${n}`, `I-${n}`];
  if (r.kind === 'US') return [`${n}`, `Highway ${n}`];
  if (n === 99) return ['99', 'Highway 99'];
  if (n === 1) return ['Highway 1'];
  return [`Highway ${n}`, `${n}`];
}

function sierraForms(r) {
  const n = r.route;
  if (r.kind === 'I') return n === 5 ? ['I-5', '5'] : [`${n}`, `I-${n}`];
  if (r.kind === 'US') return [`${n}`, `Highway ${n}`];
  if (SIERRA_BARE_SR.has(n)) return [`${n}`, `Highway ${n}`];
  return [`Highway ${n}`, `${n}`];
}

function northForms(r) {
  const n = r.route;
  if (r.kind === 'I') return n === 5 ? ['I-5', '5'] : [`I-${n}`, `${n}`];
  if (r.kind === 'US') return [`${n}`, `Highway ${n}`];
  return [`Highway ${n}`, `${n}`];
}

function coastalForms(r) {
  const n = r.route;
  if (r.kind === 'I') return n === 5 ? ['I-5', 'the 5'] : [`${n}`, `the ${n}`];
  if (n === 1) return ['Highway 1', 'the 1'];
  if (r.kind === 'US') return [`${n}`, `Highway ${n}`, `the ${n}`];
  return [`Highway ${n}`, `the ${n}`];
}

function socalForms(r, u) {
  const n = r.route;
  if (r.kind === 'SR' && n === 1) return u.pch ? ['PCH', 'the 1', 'Pacific Coast Highway'] : ['Highway 1', 'the 1'];
  return [`the ${n}`];
}

function neutralForms(r) {
  if (r.kind === 'I') return [`I-${r.route}`];
  if (r.kind === 'US') return [`US ${r.route}`, `Highway ${r.route}`];
  return [`Highway ${r.route}`];
}

function formsFor(r, key) {
  // a state route that is a city street where this speaker lives goes by its street name (fid-21)
  const street = surfaceStreet(r, key);
  if (street) return [street];
  const u = ROAD_USAGE[key];
  if (!u) return neutralForms(r);
  switch (u.style) {
    case 'socal': {
      const the = socalForms(r, u);
      if (u.theShare >= 1) return the;
      // Mixed places (Bakersfield, Santa Barbara) also use the northern forms.
      const plain = r.kind === 'SR' && r.route === 1 ? [] : valleyForms(r);
      return [...the, ...plain.filter(f => !the.includes(f))];
    }
    case 'norcal': return norcalForms(r);
    case 'valley': return valleyForms(r);
    case 'sierra': return sierraForms(r);
    case 'north': return northForms(r);
    case 'coastal': return coastalForms(r);
    default: return neutralForms(r);
  }
}

/**
 * How a local says a highway: "the 405", "880", "I-5", "Highway 1", "PCH", "99", "395".
 * Without an rng the answer is the dialect's usual form; with opts.rng, places where usage is mixed
 * (Bakersfield, the Central Coast, Santa Barbara) sometimes give the other form, and two-form routes
 * ("99" / "Highway 99") vary.
 * @param {object|string|number} road a roadsNear entry ({name, route, kind}), a name like 'I-405', or a route number
 * @param {string} dialectKey a DIALECT_KEYS key (unknown keys get neutral forms: "I-405", "US 101", "Highway 99")
 * @param {{rng?: import('../rng.mjs').Rng}} [opts]
 * @returns {string|null} null when the road cannot be read
 */
export function roadName(road, dialectKey, opts = {}) {
  const r = normalizeRoad(road);
  if (!r) return null;
  const u = ROAD_USAGE[dialectKey];
  const forms = formsFor(r, dialectKey);
  const rng = opts.rng;
  if (!rng || forms.length === 1) return forms[0];
  if (u && u.style === 'socal' && u.theShare < 1 && forms[0].startsWith('the ')) {
    const the = forms.filter(f => f.startsWith('the '));
    const plain = forms.filter(f => !the.includes(f));
    if (plain.length && !rng.chance(u.theShare)) return rng.pick(plain);
    return the[0];
  }
  if (u && u.style === 'coastal' && rng.chance(u.theShare)) {
    const the = forms.find(f => f.startsWith('the '));
    if (the) return the;
  }
  // The second form is the less common one; use it now and then.
  return rng.chance(0.3) ? forms[1] : forms[0];
}

// ------------------------------------------------------------------ freeway names

function townLatLon(world, zi) {
  const z = world.zip(zi);
  if (!z) return null;
  return { lat: Number.isFinite(z.tlat) ? z.tlat : z.lat, lon: Number.isFinite(z.tlon) ? z.tlon : z.lon };
}

const LA_KEYS = ['la-westside', 'la-central', 'la-eastside', 'sfv', 'santa-clarita', 'la-south', 'southbay-la', 'longbeach', 'sgv', 'ventura', 'antelope-valley'];
const OC_KEYS = ['oc-coast', 'oc-inland'];
const IE_KEYS = ['ie', 'high-desert', 'desert-cv', 'socal-mountains'];
const BAY_KEYS = ['sf', 'eastbay', 'southbay', 'peninsula', 'northbay'];

// State routes that are surface streets where these dialects live: locals say the street's name, never "the 39" or
// "Highway 82" (fid-21). Each entry names the dialects (by DIALECT_KEYS) along that stretch of the route.
export const SURFACE_STREETS = Object.freeze([
  { route: 39, name: 'Beach Boulevard', keys: ['oc-coast', 'oc-inland'] },
  { route: 39, name: 'Azusa Avenue', keys: ['sgv'] },
  { route: 72, name: 'Whittier Boulevard', keys: ['la-eastside', 'la-central', 'sgv'] },
  { route: 19, name: 'Lakewood Boulevard', keys: ['longbeach', 'la-south', 'southbay-la', 'la-eastside'] },
  { route: 164, name: 'Rosemead Boulevard', keys: ['sgv', 'la-eastside'] },
  { route: 213, name: 'Western Avenue', keys: ['la-central', 'la-south', 'southbay-la'] },
  { route: 107, name: 'Hawthorne Boulevard', keys: ['southbay-la', 'la-south'] },
  { route: 187, name: 'Venice Boulevard', keys: ['la-westside', 'la-central'] },
  { route: 27, name: 'Topanga Canyon Boulevard', keys: ['sfv', 'la-westside'] },
  { route: 66, name: 'Foothill Boulevard', keys: ['ie', 'sgv'] },
  { route: 133, name: 'Laguna Canyon Road', keys: ['oc-coast', 'oc-inland'] },
  { route: 82, name: 'El Camino Real', keys: ['peninsula', 'southbay', 'sf'] },
  { route: 123, name: 'San Pablo Avenue', keys: ['eastbay'] },
  { route: 185, name: 'International Boulevard', keys: ['eastbay'] },
].map(x => Object.freeze({ ...x, keys: Object.freeze(x.keys) })));

/** The street name a state route goes by in this dialect's area, or null (a freeway, or another area). */
function surfaceStreet(r, key) {
  if (!r || r.kind !== 'SR') return null;
  const hit = SURFACE_STREETS.find(s => s.route === r.route && s.keys.includes(key));
  return hit ? hit.name : null;
}

// The names older drivers use. `where(lat, lon)` picks the segment when a ZIP is known.
const FREEWAY_NAMES = [
  { route: 'I-405', name: 'the San Diego Freeway', keys: [...LA_KEYS, ...OC_KEYS] },
  { route: 'I-5', name: 'the Golden State Freeway', keys: LA_KEYS, where: (lat, lon) => lat > 34.06 || lon < -118.23 },
  { route: 'I-5', name: 'the Santa Ana Freeway', keys: LA_KEYS, where: (lat, lon) => !(lat > 34.06 || lon < -118.23) },
  { route: 'I-5', name: 'the Santa Ana Freeway', keys: OC_KEYS, where: lat => lat > 33.64 },
  { route: 'I-5', name: 'the San Diego Freeway', keys: OC_KEYS, where: lat => lat <= 33.64 },
  { route: 'I-10', name: 'the Santa Monica Freeway', keys: LA_KEYS, where: (lat, lon) => lon < -118.24 },
  { route: 'I-10', name: 'the San Bernardino Freeway', keys: [...LA_KEYS, ...IE_KEYS], where: (lat, lon) => lon >= -118.24 },
  { route: 'US 101', name: 'the Hollywood Freeway', keys: LA_KEYS, where: (lat, lon) => lat < 34.16 && lon > -118.40 },
  { route: 'US 101', name: 'the Ventura Freeway', keys: LA_KEYS, where: (lat, lon) => !(lat < 34.16 && lon > -118.40) },
  { route: 'SR 134', name: 'the Ventura Freeway', keys: LA_KEYS },
  { route: 'SR 170', name: 'the Hollywood Freeway', keys: LA_KEYS },
  { route: 'I-110', name: 'the Pasadena Freeway', keys: LA_KEYS, where: lat => lat > 34.06 },
  { route: 'I-110', name: 'the Harbor Freeway', keys: LA_KEYS, where: lat => lat <= 34.06 },
  { route: 'SR 60', name: 'the Pomona Freeway', keys: [...LA_KEYS, ...IE_KEYS] },
  { route: 'I-710', name: 'the Long Beach Freeway', keys: LA_KEYS },
  { route: 'I-605', name: 'the San Gabriel River Freeway', keys: [...LA_KEYS, ...OC_KEYS] },
  { route: 'I-105', name: 'the Century Freeway', keys: LA_KEYS },
  { route: 'SR 91', name: 'the Artesia Freeway', keys: [...LA_KEYS, ...OC_KEYS], where: (lat, lon) => lon < -117.95 },
  { route: 'SR 91', name: 'the Riverside Freeway', keys: [...OC_KEYS, ...IE_KEYS], where: (lat, lon) => lon >= -117.95 },
  { route: 'I-210', name: 'the Foothill Freeway', keys: [...LA_KEYS, ...IE_KEYS] },
  { route: 'SR 2', name: 'the Glendale Freeway', keys: LA_KEYS },
  { route: 'SR 14', name: 'the Antelope Valley Freeway', keys: LA_KEYS },
  { route: 'SR 90', name: 'the Marina Freeway', keys: LA_KEYS },
  { route: 'SR 118', name: 'the Simi Valley Freeway', keys: LA_KEYS },
  { route: 'SR 57', name: 'the Orange Freeway', keys: [...OC_KEYS, 'sgv'] },
  { route: 'SR 55', name: 'the Costa Mesa Freeway', keys: OC_KEYS },
  { route: 'SR 22', name: 'the Garden Grove Freeway', keys: OC_KEYS },
  { route: 'SR 71', name: 'the Chino Valley Freeway', keys: ['ie', 'sgv'] },
  { route: 'SR 73', name: 'the toll road', keys: OC_KEYS },
  { route: 'SR 241', name: 'the toll road', keys: OC_KEYS },
  { route: 'SR 261', name: 'the toll road', keys: OC_KEYS },
  { route: 'SR 133', name: 'the toll road', keys: OC_KEYS, where: lat => lat > 33.6 },
  { route: 'I-880', name: 'the Nimitz', keys: ['eastbay', 'southbay'] },
  { route: 'US 101', name: 'the Bayshore', keys: ['sf', 'peninsula', 'southbay'] },
  { route: 'I-80', name: 'the Eastshore', keys: ['eastbay'], where: (lat, lon) => lat > 37.80 && lon < -122.20 },
  { route: 'I-580', name: 'the MacArthur', keys: ['eastbay'], where: (lat, lon) => lon < -122.10 },
  { route: 'SR 51', name: 'the Capital City Freeway', keys: ['sacramento'] },
];

/**
 * Every form a local might use for a road, most usual first: numbers ("the 10"), and where a ZIP is given and
 * the dialect has them, the freeway names older drivers use ("the Santa Monica Freeway", "the Nimitz").
 * @param {object|string|number} road
 * @param {string} dialectKey
 * @param {{world?: import('../world.mjs').World, zi?: number}} [opts]
 * @returns {string[]}
 */
export function roadNames(road, dialectKey, opts = {}) {
  const r = normalizeRoad(road);
  if (!r) return [];
  const out = formsFor(r, dialectKey).slice();
  const key = routeKey(r);
  const pt = opts.world && opts.zi != null ? townLatLon(opts.world, opts.zi) : null;
  for (const f of FREEWAY_NAMES) {
    if (f.route !== key || !f.keys.includes(dialectKey)) continue;
    if (f.where && (!pt || !f.where(pt.lat, pt.lon))) continue;
    if (!out.includes(f.name)) out.push(f.name);
  }
  return out;
}

/**
 * The freeway's name (not number) as an older local says it, if this dialect has one for this road here.
 * @param {object|string|number} road
 * @param {string} dialectKey
 * @param {import('../world.mjs').World} world
 * @param {number} zi
 * @returns {string|null}
 */
export function freewayName(road, dialectKey, world, zi) {
  const r = normalizeRoad(road);
  if (!r) return null;
  const pt = townLatLon(world, zi);
  const key = routeKey(r);
  for (const f of FREEWAY_NAMES) {
    if (f.route !== key || !f.keys.includes(dialectKey)) continue;
    if (f.where && (!pt || !f.where(pt.lat, pt.lon))) continue;
    return f.name;
  }
  return null;
}

// ------------------------------------------------------------------ named stretches

/**
 * Famous stretches of the state highway system that locals call by name. `radiusKm` is how far from the
 * stretch people still talk about it as part of their own drive.
 * @type {ReadonlyArray<{name: string, routes: string[], lat: number, lon: number, radiusKm: number, note: string}>}
 */
export const NAMED_STRETCHES = Object.freeze([
  { name: 'the Grapevine', routes: ['I-5'], lat: 34.88, lon: -118.90, radiusKm: 70, note: 'I-5 over Tejon Pass between the San Joaquin Valley and Los Angeles; closes when it snows' },
  { name: 'the Altamont', routes: ['I-580', 'I-205'], lat: 37.74, lon: -121.65, radiusKm: 45, note: 'I-580 over Altamont Pass between Livermore and Tracy; the Central Valley commute to the Bay Area' },
  { name: 'Cajon Pass', routes: ['I-15'], lat: 34.33, lon: -117.44, radiusKm: 40, note: 'I-15 between San Bernardino and the High Desert; wind, snow, and the Vegas traffic on Sundays' },
  { name: 'the Bay Bridge', routes: ['I-80'], lat: 37.80, lon: -122.36, radiusKm: 16, note: 'I-80 between Oakland and San Francisco, the toll plaza and the metering lights' },
  { name: "Devil's Slide", routes: ['SR 1'], lat: 37.574, lon: -122.515, radiusKm: 16, note: 'SR 1 between Pacifica and Montara, now through the tunnels' },
  { name: 'the Sepulveda Pass', routes: ['I-405'], lat: 34.125, lon: -118.475, radiusKm: 14, note: 'the 405 over the Santa Monica Mountains between the Westside and the Valley' },
  { name: 'the Kellogg Hill interchange', routes: ['I-10', 'SR 57', 'SR 71'], lat: 34.075, lon: -117.80, radiusKm: 12, note: 'where the 10, the 57 and the 71 meet at San Dimas and Pomona' },
  { name: 'Donner Summit', routes: ['I-80'], lat: 39.34, lon: -120.35, radiusKm: 45, note: 'I-80 over the Sierra crest above Truckee; chain control in storms' },
  { name: 'Pacheco Pass', routes: ['SR 152'], lat: 37.07, lon: -121.22, radiusKm: 40, note: 'SR 152 between Gilroy and Los Banos' },
  { name: 'the Sunol Grade', routes: ['I-680'], lat: 37.56, lon: -121.88, radiusKm: 14, note: 'I-680 between Fremont and Pleasanton' },
  { name: 'the Caldecott Tunnel', routes: ['SR 24'], lat: 37.857, lon: -122.21, radiusKm: 12, note: 'SR 24 through the Berkeley Hills between Oakland and Orinda' },
  { name: 'the MacArthur Maze', routes: ['I-80', 'I-580', 'I-880'], lat: 37.827, lon: -122.29, radiusKm: 10, note: 'the interchange at the east end of the Bay Bridge' },
  { name: 'the Golden Gate Bridge', routes: ['US 101'], lat: 37.82, lon: -122.478, radiusKm: 16, note: 'US 101 between San Francisco and Marin' },
  { name: 'the Richmond-San Rafael Bridge', routes: ['I-580'], lat: 37.935, lon: -122.43, radiusKm: 12, note: 'I-580 across the bay between Richmond and San Rafael' },
  { name: 'the San Mateo Bridge', routes: ['SR 92'], lat: 37.585, lon: -122.20, radiusKm: 15, note: 'SR 92 between Foster City and Hayward' },
  { name: 'the Dumbarton Bridge', routes: ['SR 84'], lat: 37.505, lon: -122.115, radiusKm: 12, note: 'SR 84 between Menlo Park and Fremont' },
  { name: 'the Carquinez Bridge', routes: ['I-80'], lat: 38.06, lon: -122.226, radiusKm: 12, note: 'I-80 between Crockett and Vallejo' },
  { name: 'the Benicia Bridge', routes: ['I-680'], lat: 38.04, lon: -122.12, radiusKm: 12, note: 'I-680 between Martinez and Benicia' },
  { name: 'the Yolo Causeway', routes: ['I-80'], lat: 38.565, lon: -121.60, radiusKm: 18, note: 'I-80 over the Yolo Bypass between Davis and West Sacramento' },
  { name: 'Echo Summit', routes: ['US 50'], lat: 38.81, lon: -120.03, radiusKm: 25, note: 'US 50 over the Sierra into South Lake Tahoe' },
  { name: 'the Cuesta Grade', routes: ['US 101'], lat: 35.35, lon: -120.63, radiusKm: 20, note: 'US 101 between San Luis Obispo and Atascadero' },
  { name: 'the Conejo Grade', routes: ['US 101'], lat: 34.205, lon: -118.955, radiusKm: 12, note: 'US 101 between Camarillo and Newbury Park' },
  { name: 'the Gaviota Pass', routes: ['US 101'], lat: 34.50, lon: -120.225, radiusKm: 25, note: 'US 101 through the Santa Ynez Mountains north of Gaviota' },
  { name: 'the Rincon', routes: ['US 101'], lat: 34.37, lon: -119.47, radiusKm: 15, note: 'US 101 along the water between Ventura and Carpinteria' },
  { name: 'the Newhall Pass', routes: ['I-5', 'SR 14'], lat: 34.33, lon: -118.51, radiusKm: 15, note: 'where the 5 and the 14 split between Sylmar and Santa Clarita' },
  { name: 'the Cahuenga Pass', routes: ['US 101'], lat: 34.125, lon: -118.34, radiusKm: 8, note: 'the 101 between Hollywood and the Valley' },
  { name: 'the El Toro Y', routes: ['I-5', 'I-405'], lat: 33.645, lon: -117.735, radiusKm: 12, note: 'where the 5 and the 405 merge in Irvine' },
  { name: 'the Orange Crush', routes: ['I-5', 'SR 57', 'SR 22'], lat: 33.78, lon: -117.88, radiusKm: 8, note: 'the 5, 57 and 22 interchange in Orange' },
  { name: 'the East LA Interchange', routes: ['I-5', 'I-10', 'SR 60', 'US 101'], lat: 34.035, lon: -118.215, radiusKm: 6, note: 'the knot of the 5, 10, 60 and 101 east of downtown' },
  { name: 'the four-level', routes: ['US 101', 'I-110'], lat: 34.0625, lon: -118.248, radiusKm: 5, note: 'the stack interchange of the 101 and the 110 downtown' },
  { name: 'the Banning Pass', routes: ['I-10'], lat: 33.92, lon: -116.80, radiusKm: 25, note: 'I-10 between Beaumont and the Coachella Valley; wind' },
  { name: 'the Ortega Highway', routes: ['SR 74'], lat: 33.62, lon: -117.45, radiusKm: 25, note: 'SR 74 over the Santa Ana Mountains between San Juan Capistrano and Lake Elsinore' },
  { name: 'the Angeles Crest', routes: ['SR 2'], lat: 34.28, lon: -118.10, radiusKm: 15, note: 'SR 2 into the San Gabriel Mountains above La Cañada Flintridge' },
  { name: 'Rim of the World', routes: ['SR 18'], lat: 34.23, lon: -117.25, radiusKm: 18, note: 'SR 18 along the crest of the San Bernardino Mountains' },
  { name: 'Pearblossom Highway', routes: ['SR 138'], lat: 34.50, lon: -117.90, radiusKm: 25, note: 'SR 138 across the Antelope Valley toward Cajon Pass' },
  { name: 'the Feather River Canyon', routes: ['SR 70'], lat: 39.87, lon: -121.33, radiusKm: 40, note: 'SR 70 up the Feather River from Oroville toward Quincy' },
  { name: 'Tioga Pass', routes: ['SR 120'], lat: 37.91, lon: -119.26, radiusKm: 30, note: 'SR 120 over the Sierra crest out of Yosemite; closed all winter' },
  { name: 'Sonora Pass', routes: ['SR 108'], lat: 38.33, lon: -119.64, radiusKm: 35, note: 'SR 108 over the Sierra crest; closed all winter' },
  { name: 'Carson Pass', routes: ['SR 88'], lat: 38.69, lon: -119.99, radiusKm: 25, note: 'SR 88 past Kirkwood' },
  { name: 'Ebbetts Pass', routes: ['SR 4'], lat: 38.545, lon: -119.81, radiusKm: 25, note: 'SR 4 over the Sierra crest above Bear Valley; closed all winter' },
  { name: 'the Sherwin Grade', routes: ['US 395'], lat: 37.53, lon: -118.67, radiusKm: 25, note: 'US 395 climbing from Bishop toward Mammoth' },
  { name: 'the Kern River Canyon', routes: ['SR 178'], lat: 35.44, lon: -118.80, radiusKm: 25, note: 'SR 178 up the Kern River from Bakersfield to Lake Isabella' },
  { name: 'the Tehachapi Pass', routes: ['SR 58'], lat: 35.10, lon: -118.28, radiusKm: 20, note: 'SR 58 between Tehachapi and Mojave; wind farms' },
]);

/**
 * Named stretches near a ZIP, nearest first, optionally only those on one road.
 * @param {import('../world.mjs').World} world
 * @param {number} zi
 * @param {object|string|number} [road]
 * @returns {{name: string, routes: string[], note: string, distKm: number}[]}
 */
export function stretchesNear(world, zi, road = null) {
  const pt = townLatLon(world, zi);
  if (!pt) return [];
  const r = road != null ? normalizeRoad(road) : null;
  if (road != null && !r) return [];
  const key = r ? routeKey(r) : null;
  const out = [];
  for (const s of NAMED_STRETCHES) {
    if (key && !s.routes.includes(key)) continue;
    const c = Math.cos((pt.lat + s.lat) * Math.PI / 360);
    const d = Math.hypot((s.lon - pt.lon) * c * KM_PER_DEG, (s.lat - pt.lat) * KM_PER_DEG);
    if (d <= s.radiusKm) out.push({ name: s.name, routes: s.routes.slice(), note: s.note, distKm: +d.toFixed(1) });
  }
  return out.sort((a, b) => a.distKm - b.distKm);
}

/**
 * The famous named segment of this road that a resident of this ZIP would mean ("the Grapevine" on I-5 near
 * Bakersfield, "the Altamont" on I-580 near Tracy), or null when the ZIP is not near one.
 * @param {object|string|number} road
 * @param {import('../world.mjs').World} world
 * @param {number|string} zi ZIP index or code
 * @returns {string|null}
 */
export function namedStretch(road, world, zi) {
  if (typeof zi === 'string') zi = world.indexOf(zi);
  if (!(zi >= 0)) return null;
  const hits = stretchesNear(world, zi, road);
  return hits.length ? hits[0].name : null;
}
