// Legion · lexicon · dialect geography.
//
// Which regional voice does a ZIP speak with? California's dialect map is mostly a map of identities people
// actually claim ("the East Bay", "the IE", "the 559", "the High Desert"), and those follow counties, towns,
// the coast and the mountains far more than any line on a linguist's chart. So the rules below read the
// county, the mailing city and Census place, the town point, elevation, coast distance, density and the
// physiographic province from the world pack. Nothing here is keyed on a ZIP code, and nothing here looks at
// who lives in a ZIP: dialect is regional, never ethnic.

const KM_PER_DEG = 111.2;

/** Every dialect key, statewide, in rough north-to-south order within each family. */
export const DIALECT_KEYS = Object.freeze([
  'sf', 'eastbay', 'southbay', 'peninsula', 'northbay',
  'sacramento', 'valley-north',
  'valley-south', 'fresno', 'kern',
  'la-westside', 'la-central', 'la-eastside', 'sfv', 'santa-clarita', 'la-south', 'southbay-la', 'longbeach', 'sgv', 'ventura',
  'oc-coast', 'oc-inland',
  'ie',
  'desert-cv', 'high-desert', 'antelope-valley', 'low-desert', 'imperial',
  'sd-coast', 'sd-inland',
  'central-coast', 'santa-barbara', 'salinas', 'monterey-bay',
  'north-coast', 'north-inland', 'far-north',
  'tahoe', 'gold-country', 'sierra-foothills', 'eastern-sierra', 'socal-mountains',
]);

const names = s => new Set(s.split('|'));

/** Approximate great-circle distance in km between two lat/lon points (equirectangular; fine at this scale). */
function km(lat1, lon1, lat2, lon2) {
  const c = Math.cos((lat1 + lat2) * Math.PI / 360);
  return Math.hypot((lon2 - lon1) * c * KM_PER_DEG, (lat2 - lat1) * KM_PER_DEG);
}

// ------------------------------------------------------------------ name tables

// Mailing cities that sit outside the county their ZIP centroid falls in, or that a county rule would misread.
const CITY_OVERRIDES = {
  'San Clemente': 'oc-coast',
  'Frazier Park': 'socal-mountains', 'Lebec': 'socal-mountains', 'Pine Mountain Club': 'socal-mountains',
  'Wrightwood': 'socal-mountains', 'Mt Baldy': 'socal-mountains', 'Mount Baldy': 'socal-mountains',
  'Maricopa': 'kern', 'Inyokern': 'high-desert', 'Arnold': 'gold-country',
  'Rosamond': 'antelope-valley', 'Mojave': 'antelope-valley',
};

// Santa Clara County towns that call themselves the Peninsula (the Midpeninsula) rather than the South Bay.
const MIDPENINSULA = names('Palo Alto|Stanford|Los Altos|Los Altos Hills');

// Monterey County's peninsula and coast, as opposed to the Salinas Valley.
const MONTEREY_PENINSULA = names('Monterey|Pacific Grove|Carmel|Carmel by the Sea|Carmel-by-the-Sea|Carmel Valley|Pebble Beach|Seaside|Marina|Del Rey Oaks|Sand City|Big Sur');

// The Pajaro Valley farms with Salinas, not with Santa Cruz's beach towns.
const PAJARO_VALLEY = names('Watsonville|Freedom|Aromas|Pajaro');

// Orange County cities that touch the ocean.
const OC_COAST = names('Newport Beach|Corona del Mar|Newport Coast|Huntington Beach|Sunset Beach|Surfside|Seal Beach|Costa Mesa|Laguna Beach|Laguna Niguel|Dana Point|Capistrano Beach|San Clemente');

// The mountain towns of Southern California: snow, pines, "down the hill".
const SOCAL_MOUNTAIN_TOWNS = names('Big Bear Lake|Big Bear City|Fawnskin|Sugarloaf|Lake Arrowhead|Blue Jay|Twin Peaks|Rimforest|Skyforest|Cedar Glen|Cedarpines Park|Crestline|Running Springs|Green Valley Lake|Forest Falls|Angelus Oaks|Lytle Creek|Idyllwild|Mountain Center|Pine Cove|Julian|Mount Laguna|Pine Valley|Palomar Mountain|Descanso|Guatay|Santa Ysabel|Warner Springs|Ranchita|Wrightwood|Mt Baldy|Frazier Park|Lebec|Pine Mountain Club');

// The Coachella Valley, including the towns on its northern (Transverse Ranges) edge.
const COACHELLA_VALLEY = names('Palm Springs|North Palm Springs|Cathedral City|Rancho Mirage|Palm Desert|Indian Wells|La Quinta|Indio|Coachella|Thermal|Mecca|Desert Hot Springs|Thousand Palms|Bermuda Dunes|Whitewater|Sky Valley|Oasis');

// The Morongo Basin sits in the Transverse Ranges province but lives a high-desert life.
const MORONGO_BASIN = names('Yucca Valley|Joshua Tree|Twentynine Palms|Landers|Morongo Valley|Pioneertown|Flamingo Heights');

// Los Angeles County by mailing city or Census place.
const LA_CITY = (() => {
  const t = {};
  const put = (key, list) => { for (const c of list.split('|')) t[c] = key; };
  put('la-westside', 'Santa Monica|Venice|Marina del Rey|Marina Del Rey|Playa del Rey|Playa Del Rey|Playa Vista|Pacific Palisades|Malibu|Pepperdine University|Topanga|Beverly Hills|West Hollywood|Culver City');
  put('la-eastside', 'East Los Angeles|Commerce|Vernon|Bell|Bell Gardens|Cudahy|Maywood|Huntington Park|South Gate|Downey|Pico Rivera|Montebello|Whittier|South Whittier|West Whittier-Los Nietos|Santa Fe Springs|Norwalk|La Mirada');
  put('la-south', 'Florence-Graham|West Rancho Dominguez|Willowbrook|Compton|Lynwood|Inglewood|Lennox|Ladera Heights|View Park-Windsor Hills|Westmont|West Athens');
  put('southbay-la', 'Redondo Beach|Hermosa Beach|Manhattan Beach|El Segundo|Torrance|West Carson|Palos Verdes Peninsula|Palos Verdes Estates|Rancho Palos Verdes|Rolling Hills|Rolling Hills Estates|Lomita|Harbor City|San Pedro|Wilmington|Carson|Gardena|Hawthorne|Lawndale|Alondra Park|Avalon');
  put('longbeach', 'Long Beach|Signal Hill|Lakewood|Hawaiian Gardens|Bellflower|Paramount|Artesia|Cerritos');
  put('sgv', 'Pasadena|South Pasadena|San Marino|Altadena|Sierra Madre|Arcadia|Monrovia|Duarte|Bradbury|Azusa|Glendora|Covina|West Covina|Baldwin Park|Irwindale|El Monte|South El Monte|Rosemead|San Gabriel|East San Gabriel|Temple City|Alhambra|Monterey Park|La Puente|Hacienda Heights|Rowland Heights|Walnut|Diamond Bar|Pomona|Claremont|La Verne|San Dimas|Industry|City of Industry');
  put('sfv', 'Van Nuys|North Hollywood|Studio City|Sherman Oaks|Encino|Tarzana|Woodland Hills|Canoga Park|Winnetka|West Hills|Reseda|Northridge|Chatsworth|Granada Hills|Porter Ranch|Mission Hills|North Hills|Panorama City|Sylmar|Pacoima|San Fernando|Sun Valley|Sunland|Tujunga|Arleta|Valley Village|Universal City|Toluca Lake|Burbank|Glendale|La Crescenta|La Crescenta-Montrose|Montrose|Verdugo City|La Canada Flintridge|La Cañada Flintridge|Calabasas|Agoura Hills|Hidden Hills|Westlake Village');
  put('santa-clarita', 'Santa Clarita|Valencia|Newhall|Canyon Country|Saugus|Stevenson Ranch|Castaic|Val Verde');
  put('antelope-valley', 'Lancaster|Palmdale|Quartz Hill|Littlerock|Llano|Pearblossom|Valyermo|Lake Hughes|Acton|Leona Valley|Juniper Hills|Lake Los Angeles|Agua Dulce');
  return t;
})();

// The city of Los Angeles mails most of its ZIPs as "Los Angeles", so its neighborhoods are told apart by the
// nearest anchor point. Every LA sub-dialect has anchors so that any unlisted town still lands somewhere sensible.
const LA_ANCHORS = [
  ['la-central', 34.047, -118.250], ['la-central', 34.060, -118.300], ['la-central', 34.098, -118.330], ['la-central', 34.115, -118.290],
  ['la-central', 34.085, -118.265], ['la-central', 34.060, -118.350], ['la-central', 34.125, -118.340], ['la-central', 34.073, -118.365],
  ['la-central', 34.118, -118.262],
  ['la-westside', 34.063, -118.445], ['la-westside', 34.065, -118.475], ['la-westside', 34.040, -118.440], ['la-westside', 34.025, -118.405],
  ['la-westside', 34.002, -118.430], ['la-westside', 34.052, -118.385], ['la-westside', 33.955, -118.410], ['la-westside', 34.090, -118.455],
  ['la-westside', 34.057, -118.415], ['la-westside', 34.050, -118.530],
  ['la-eastside', 34.035, -118.205], ['la-eastside', 34.075, -118.210], ['la-eastside', 34.080, -118.180], ['la-eastside', 34.112, -118.195],
  ['la-eastside', 34.138, -118.210], ['la-eastside', 34.110, -118.235], ['la-eastside', 33.960, -118.150],
  ['la-south', 34.000, -118.270], ['la-south', 33.940, -118.240], ['la-south', 33.990, -118.330], ['la-south', 34.010, -118.360],
  ['la-south', 34.030, -118.330], ['la-south', 34.020, -118.287], ['la-south', 33.955, -118.295],
  ['southbay-la', 33.850, -118.360], ['southbay-la', 33.740, -118.290], ['southbay-la', 33.890, -118.300],
  ['longbeach', 33.780, -118.190], ['longbeach', 33.820, -118.130],
  ['sgv', 34.147, -118.140], ['sgv', 34.080, -118.050], ['sgv', 34.060, -117.850],
  ['sfv', 34.190, -118.450], ['sfv', 34.230, -118.580], ['sfv', 34.170, -118.300],
  ['santa-clarita', 34.410, -118.520],
  ['antelope-valley', 34.650, -118.150],
];

// ------------------------------------------------------------------ rule helpers

/** Lake Tahoe's basin and the Truckee–Donner country, at altitude. */
function isTahoe(c) {
  if (c.elev < 1500) return false;
  return km(c.lat, c.lon, 39.09, -120.03) <= 32 || km(c.lat, c.lon, 39.33, -120.18) <= 25;
}

function nearestAnchor(lat, lon, anchors) {
  let best = null, bd = Infinity;
  for (const [key, a, b] of anchors) {
    const d = km(lat, lon, a, b);
    if (d < bd) { bd = d; best = key; }
  }
  return best;
}

function losAngeles(c) {
  if (LA_CITY[c.city]) return [LA_CITY[c.city], 'LA city name'];
  if (c.place && LA_CITY[c.place]) return [LA_CITY[c.place], 'LA Census place'];
  if (c.province === 'Mojave Desert') return ['antelope-valley', 'Mojave Desert in LA County'];
  return [nearestAnchor(c.lat, c.lon, LA_ANCHORS), 'nearest LA neighborhood anchor'];
}

function riverside(c) {
  if (SOCAL_MOUNTAIN_TOWNS.has(c.city) || (c.elev >= 1300 && c.density < 100)) return ['socal-mountains', 'San Jacinto Mountains'];
  const desert = c.province === 'Colorado Desert' || c.province === 'Mojave Desert';
  if (COACHELLA_VALLEY.has(c.city) || (desert && c.lon < -115.8)) return ['desert-cv', 'Coachella Valley'];
  if (desert) return ['low-desert', 'Colorado River country'];
  return ['ie', 'western Riverside County'];
}

function sanBernardino(c) {
  const mountain = SOCAL_MOUNTAIN_TOWNS.has(c.city)
    || (c.province === 'Transverse Ranges' && c.elev >= 1350 && c.density < 1200 && c.lon < -116.7);
  if (mountain) return ['socal-mountains', 'San Bernardino Mountains'];
  if (MORONGO_BASIN.has(c.city) || c.province === 'Mojave Desert' || c.province === 'Basin and Range') {
    return c.lon > -115.0 ? ['low-desert', 'Colorado River country'] : ['high-desert', 'Mojave Desert'];
  }
  return ['ie', 'San Bernardino Valley'];
}

function sanDiego(c) {
  if (c.province === 'Colorado Desert' || c.city === 'Borrego Springs') return ['low-desert', 'Anza-Borrego desert'];
  if (SOCAL_MOUNTAIN_TOWNS.has(c.city) || (c.elev >= 1100 && c.density < 120)) return ['socal-mountains', 'San Diego backcountry mountains'];
  return c.coast <= 7.5 ? ['sd-coast', 'within 7.5 km of the ocean'] : ['sd-inland', 'inland San Diego County'];
}

// The Tehachapi Mountains (Tehachapi, Bear Valley Springs, Keene, Caliente) sit in the Sierra Nevada province
// above about 1,000 m: mountain towns with snow on 58, not the valley floor's tule fog and triple digits.
const TEHACHAPI_ELEV_M = 900;

function kern(c) {
  if (c.province === 'Mojave Desert' || c.province === 'Basin and Range') return ['high-desert', 'eastern Kern desert'];
  if (c.province === 'Sierra Nevada' && c.lat > 35.5) return ['sierra-foothills', 'Kern River Valley and the southern Sierra'];
  if (c.province === 'Sierra Nevada' && c.elev >= TEHACHAPI_ELEV_M) return ['sierra-foothills', 'Tehachapi Mountains'];
  return ['kern', 'Kern County valley floor'];
}

function southernSanJoaquin(c) {
  if (c.province === 'Basin and Range' || c.province === 'Mojave Desert') return ['high-desert', 'Indian Wells Valley'];
  if (c.province === 'Sierra Nevada' && c.elev >= 350) return ['sierra-foothills', 'southern Sierra foothills'];
  return ['fresno', 'the 559 valley floor'];
}

function motherLode(c) {
  if (isTahoe(c)) return ['tahoe', 'Lake Tahoe and Truckee'];
  if (c.province === 'Great Valley' && (c.county === 'Placer' || c.county === 'El Dorado')) return ['sacramento', 'Sacramento suburbs below the foothills'];
  return ['gold-country', 'Sierra foothills'];
}

function alpine(c) {
  if (isTahoe(c) || km(c.lat, c.lon, 38.69, -120.07) <= 12) return ['tahoe', 'Tahoe ski country'];
  return c.lon > -119.95 ? ['eastern-sierra', 'east of the Sierra crest'] : ['gold-country', 'west slope of the Sierra'];
}

function eastSide(c) {
  return c.lon > -117.4 ? ['high-desert', 'Death Valley and the Mojave'] : ['eastern-sierra', 'Owens Valley and Mono'];
}

// County name -> key, or a rule returning [key, reason].
const COUNTY_RULES = {
  'San Francisco': 'sf',
  'San Mateo': 'peninsula',
  'Santa Clara': c => MIDPENINSULA.has(c.city) ? ['peninsula', 'Midpeninsula'] : ['southbay', 'Santa Clara Valley'],
  'Alameda': 'eastbay', 'Contra Costa': 'eastbay',
  'Marin': 'northbay', 'Sonoma': 'northbay', 'Napa': 'northbay', 'Solano': 'northbay',
  'Sacramento': 'sacramento', 'Yolo': 'sacramento',
  'Sutter': 'valley-north', 'Butte': 'valley-north', 'Glenn': 'valley-north', 'Colusa': 'valley-north',
  'Yuba': c => c.province === 'Sierra Nevada' ? ['gold-country', 'Yuba foothills'] : ['valley-north', 'Yuba valley floor'],
  'Tehama': 'far-north', 'Shasta': 'far-north', 'Siskiyou': 'far-north', 'Modoc': 'far-north', 'Lassen': 'far-north',
  'Trinity': 'far-north', 'Plumas': 'far-north',
  'Humboldt': 'north-coast', 'Del Norte': 'north-coast',
  'Mendocino': c => c.coast > 20 ? ['north-inland', 'inland Mendocino'] : ['north-coast', 'Mendocino coast and redwoods'],
  'Lake': 'north-inland',
  'San Joaquin': 'valley-south', 'Stanislaus': 'valley-south', 'Merced': 'valley-south',
  'Fresno': southernSanJoaquin, 'Madera': southernSanJoaquin, 'Tulare': southernSanJoaquin, 'Kings': southernSanJoaquin,
  'Kern': kern,
  'Placer': motherLode, 'El Dorado': motherLode, 'Nevada': motherLode, 'Sierra': motherLode, 'Amador': motherLode,
  'Calaveras': motherLode, 'Tuolumne': motherLode, 'Mariposa': motherLode,
  'Alpine': alpine, 'Mono': eastSide, 'Inyo': eastSide,
  'Monterey': c => MONTEREY_PENINSULA.has(c.city) ? ['monterey-bay', 'Monterey Peninsula'] : ['salinas', 'Salinas Valley'],
  'Santa Cruz': c => PAJARO_VALLEY.has(c.city) || PAJARO_VALLEY.has(c.place) ? ['salinas', 'Pajaro Valley'] : ['monterey-bay', 'Santa Cruz County'],
  'San Benito': 'salinas',
  'San Luis Obispo': 'central-coast',
  'Santa Barbara': c => c.lat < 34.5 && c.lon > -120.1 ? ['santa-barbara', 'Santa Barbara south coast'] : ['central-coast', 'Santa Maria and Santa Ynez valleys'],
  'Ventura': 'ventura',
  'Los Angeles': losAngeles,
  'Orange': c => OC_COAST.has(c.city) || c.coast <= 4.5 ? ['oc-coast', 'coastal Orange County'] : ['oc-inland', 'inland Orange County'],
  'Riverside': riverside,
  'San Bernardino': sanBernardino,
  'San Diego': sanDiego,
  'Imperial': 'imperial',
};

// Fallback by the pack's region key, should a county ever be missing from the table.
const REGION_FALLBACK = { nc: 'north-coast', fn: 'far-north', sv: 'sacramento', si: 'gold-country', ba: 'eastbay', cc: 'central-coast', sj: 'fresno', la: 'la-central', oc: 'oc-inland', ie: 'ie', sd: 'sd-inland' };

function context(world, zi) {
  const z = world.zip(zi);
  return {
    zi, county: z.countyName, city: z.city || '', place: z.place || '',
    lat: Number.isFinite(z.tlat) ? z.tlat : z.lat, lon: Number.isFinite(z.tlon) ? z.tlon : z.lon,
    elev: z.elev_m || 0, coast: Number.isFinite(z.coast_km) ? z.coast_km : 999, density: z.density || 0,
    province: z.provinceName || '', region: z.regionKey,
  };
}

/**
 * The dialect decision for one ZIP with the rule that made it, for the UI's place panel and for tests.
 * @param {import('../world.mjs').World} world
 * @param {number|string} zi ZIP index or ZIP code
 * @returns {{key: string, rule: string}|null}
 */
export function explainDialect(world, zi) {
  if (typeof zi === 'string') zi = world.indexOf(zi);
  if (!(zi >= 0 && zi < world.N)) return null;
  const c = context(world, zi);
  if (CITY_OVERRIDES[c.city]) return { key: CITY_OVERRIDES[c.city], rule: `town: ${c.city}` };
  const r = COUNTY_RULES[c.county];
  if (typeof r === 'string') return { key: r, rule: `county: ${c.county}` };
  if (typeof r === 'function') { const [key, why] = r(c); return { key, rule: `${c.county}: ${why}` }; }
  return { key: REGION_FALLBACK[c.region] || 'central-coast', rule: `region fallback: ${c.region}` };
}

const tables = new WeakMap();

/**
 * The dialect key for a ZIP, at sub-regional grain ('sf', 'eastbay', 'la-eastside', 'ie', 'tahoe', …; see
 * DIALECT_KEYS). Decided from county, city and place names, coordinates, elevation, coast distance, density
 * and terrain. Cached per world; every ZIP gets a key.
 * @param {import('../world.mjs').World} world
 * @param {number|string} zi ZIP index or ZIP code
 * @returns {string|null} null only for an index outside the world
 */
export function dialectFor(world, zi) {
  if (typeof zi === 'string') zi = world.indexOf(zi);
  if (!(zi >= 0 && zi < world.N)) return null;
  let t = tables.get(world);
  if (!t) { t = new Array(world.N); tables.set(world, t); }
  return t[zi] || (t[zi] = explainDialect(world, zi).key);
}

/**
 * Every ZIP's dialect key as one array (index = ZIP index), computed once per world.
 * @param {import('../world.mjs').World} world
 * @returns {string[]}
 */
export function dialectTable(world) {
  const out = new Array(world.N);
  for (let i = 0; i < world.N; i++) out[i] = dialectFor(world, i);
  return out;
}
