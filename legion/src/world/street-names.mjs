// Legion · street names for the procedural street view.
//
// California street naming has recognizable habits: numbered streets crossing named ones in old grids
// (16th and Mission), lettered streets in Sacramento, Eureka and Arcata, trees and saints, Spanish forms
// everywhere (Calle, Via, Camino, Avenida), presidents and pioneers in valley towns, whimsical compounds in
// post-1980 subdivisions (Silverwood, Stonebrook), and county road numbers in the Central Valley ("Road 24",
// "Avenue 12"). Names here are drawn from the ZIP's region and era and from the lattice index of the street, so
// a street keeps its name every time the same place is opened. They are generic, not claims about real streets.

import { hash2, hash3, hashStr, mix32 } from '../engine/rng.mjs';

const TREES = ['Oak', 'Elm', 'Maple', 'Sycamore', 'Walnut', 'Cedar', 'Pine', 'Magnolia', 'Jacaranda', 'Acacia', 'Laurel',
  'Willow', 'Cypress', 'Redwood', 'Juniper', 'Olive', 'Orange', 'Lemon', 'Almond', 'Peach', 'Cherry', 'Alder', 'Aspen',
  'Birch', 'Buckeye', 'Madrone', 'Manzanita', 'Pepper Tree', 'Eucalyptus', 'Palm', 'Ash', 'Poplar', 'Chestnut', 'Hawthorn',
  'Holly', 'Myrtle', 'Linden', 'Fig', 'Pomegranate', 'Avocado', 'Persimmon', 'Plum', 'Apricot', 'Locust', 'Spruce', 'Fir',
  'Hemlock', 'Sequoia', 'Cottonwood', 'Bay Laurel'];
const SAINTS = ['San Carlos', 'San Jose', 'Santa Rosa', 'San Pablo', 'Santa Clara', 'San Bruno', 'Santa Ana', 'San Miguel',
  'San Gabriel', 'Santa Barbara', 'San Fernando', 'Santa Cruz', 'San Juan', 'Santa Ines', 'San Mateo', 'San Lorenzo',
  'Santa Monica', 'San Benito', 'Santa Teresa', 'San Rafael', 'San Antonio', 'Santa Paula', 'San Pedro', 'Santa Lucia',
  'San Luis', 'San Felipe', 'Santa Ysabel', 'San Marcos', 'San Simeon', 'Santa Fe', 'San Diego', 'Santa Maria'];
const SPANISH = ['Alameda', 'Alvarado', 'Valencia', 'Guerrero', 'Dolores', 'Hidalgo', 'Del Mar', 'Del Rio', 'Buena Vista',
  'Mar Vista', 'Alta Vista', 'Loma Linda', 'La Cresta', 'Encina', 'Sierra Vista', 'Monte Vista', 'Vista Grande',
  'Las Palmas', 'Los Robles', 'Las Flores', 'Paloma', 'Mariposa', 'Golondrina', 'Primavera', 'Esperanza', 'Bonita',
  'Hermosa', 'Arroyo', 'Ladera', 'Rancho', 'Casa Linda', 'Avila', 'Castillo', 'Portola', 'Serra', 'Anza', 'Pico',
  'Sepulveda', 'Vallejo', 'Estrada', 'Figueroa', 'Olivera', 'Cabrillo', 'Balboa', 'Coronado', 'Madera', 'Alamo',
  'Corona', 'Montecito', 'Escondido', 'Placentia', 'Laguna', 'Linda Vista', 'Miramar', 'Las Lomas', 'Los Altos'];
const SPANISH_SHORT = ['Lucia', 'Sonora', 'Verde', 'Del Sol', 'Lido', 'Serena', 'Marina', 'Paloma', 'Aurora', 'Brisa',
  'Cielo', 'Estrella', 'Luna', 'Rosa', 'Alegre', 'Bonita', 'Hermosa', 'Montaña', 'Oro', 'Plata', 'Pradera', 'Sombra',
  'Tierra', 'Ventana', 'Linda', 'Amapola', 'Azul', 'Corta', 'Larga', 'Vista', 'Fresca', 'Esperanza', 'Gaviota', 'Cresta'];
/**
 * The adjectives of SPANISH_SHORT in their masculine forms. Calle and Via are feminine (Calle Serena, Via
 * Bonita), Camino and Paseo masculine, so an adjective after them agrees: Camino Corto, Paseo Hermoso. Nouns in
 * apposition (Camino Estrella, Paseo Luna) and adjectives with one form (Verde, Alegre, Azul) stay as they are.
 */
const SPANISH_MASC = { Serena: 'Sereno', Bonita: 'Bonito', Hermosa: 'Hermoso', Linda: 'Lindo', Corta: 'Corto', Larga: 'Largo', Fresca: 'Fresco' };
const MASCULINE_PREFIX = new Set(['Camino', 'Paseo']);

/** A Spanish-style street name: a prefix (Calle, Via, Camino, Paseo) and a word that agrees with it. */
export function spanishStreet(prefix, word) {
  return `${prefix} ${MASCULINE_PREFIX.has(prefix) && SPANISH_MASC[word] ? SPANISH_MASC[word] : word}`;
}
const PEOPLE = ['Lincoln', 'Washington', 'Jefferson', 'Madison', 'Franklin', 'Grant', 'Jackson', 'Monroe', 'Adams',
  'Harrison', 'Garfield', 'Cleveland', 'McKinley', 'Roosevelt', 'Wilson', 'Taft', 'Hamilton', 'Webster', 'Fremont',
  'Sutter', 'Muir', 'Stanford', 'Bancroft', 'Burbank', 'Huntington', 'Mason', 'Taylor', 'Powell', 'Hyde', 'Polk',
  'Fillmore', 'Pierce', 'Buchanan', 'Marshall', 'Kearny', 'Larkin', 'Bidwell', 'Vallejo', 'Carrillo'];
const PREFIX = ['Silver', 'Stone', 'Willow', 'Oak', 'Pine', 'Maple', 'Cedar', 'Golden', 'Sun', 'Shadow', 'Spring',
  'Summer', 'Autumn', 'Misty', 'Quiet', 'Hidden', 'Eagle', 'Hawk', 'Fox', 'Deer', 'Elk', 'Falcon', 'Raven', 'Cobble',
  'Wind', 'Sea', 'Star', 'Moon', 'Cloud', 'River', 'Lake', 'Mill', 'Garden', 'Rose', 'Ivy', 'Holly', 'Laurel', 'Birch',
  'Aspen', 'Sierra', 'Canyon', 'Meadow', 'Quail', 'Heron', 'Sage', 'Poppy', 'Amber', 'Crystal', 'Copper', 'Indigo'];
const SUFFIXW = ['wood', 'brook', 'ridge', 'field', 'crest', 'view', 'gate', 'stone', 'haven', 'wick', 'ford', 'dale',
  'mont', 'vale', 'glen', 'side', 'point', 'hill', 'creek', 'meadow', 'shire', 'bend', 'spring', 'port'];
const NATURE = ['Meadowlark', 'Sandpiper', 'Quail', 'Heron', 'Kestrel', 'Wren', 'Bluebird', 'Oriole', 'Finch', 'Larkspur',
  'Primrose', 'Lavender', 'Sage', 'Rosemary', 'Poppy', 'Lupine', 'Iris', 'Clover', 'Fern', 'Brookside', 'Ridgeview',
  'Canyon Oak', 'Hollow Oak', 'Glenview', 'Summit', 'Crestview', 'Harbor View', 'Cove', 'Mesa', 'Bluff', 'Knoll', 'Meadow',
  'Grove', 'Orchard', 'Vineyard', 'Harvest', 'Saddle', 'Stirrup', 'Mustang', 'Palomino', 'Tumbleweed', 'Juniper Ridge'];
const RURAL = ['Grizzly Bluff', 'Old Mill', 'Ranch', 'Creek', 'Ridge', 'Valley', 'Canyon', 'Mountain View', 'Summit',
  'Pleasant Valley', 'Bear Creek', 'Deer Creek', 'Cottonwood', 'Willow Creek', 'Mill Creek', 'Oak Knoll', 'Schoolhouse',
  'Church', 'Dairy', 'Orchard', 'Vineyard', 'Quarry', 'Cemetery', 'Lone Pine', 'Big Oak', 'Elk Ridge', 'Hidden Valley',
  'Sunset', 'Pine Grove', 'Fern Gulch', 'Coyote Hill', 'Redwood Flat', 'Barn', 'Grange', 'Cattle Pass', 'Hay Press',
  'Woodcutter', 'Pony Express', 'Stagecoach', 'Gold Hill', 'Copper Mine', 'Apple Orchard', 'Walnut Grove', 'Sheep Ranch'];
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const ABBR = { Street: 'St', Avenue: 'Ave', Boulevard: 'Blvd', Drive: 'Dr', Lane: 'Ln', Court: 'Ct', Circle: 'Cir',
  Way: 'Way', Terrace: 'Ter', Place: 'Pl', Parkway: 'Pkwy', Road: 'Rd', Highway: 'Hwy', Alley: 'Aly', Trail: 'Trl', Loop: 'Loop' };

/** "1st", "2nd", "23rd", "11th". */
export function ordinal(n) {
  const v = n % 100;
  if (v >= 11 && v <= 13) return n + 'th';
  return n + (['th', 'st', 'nd', 'rd'][n % 10] || 'th');
}

/** Abbreviated form for map labels: "Valencia Street" → "Valencia St"; Spanish prefixed names are kept. */
export function shortName(name) {
  if (!name) return '';
  const parts = name.split(' ');
  const last = parts[parts.length - 1];
  if (ABBR[last]) parts[parts.length - 1] = ABBR[last];
  return parts.join(' ');
}

const pick = (arr, h) => arr[(h >>> 0) % arr.length];

/**
 * A namer for one ZIP: stable names for lattice lines, generated streets, rural roads and highways.
 * @param {object} world
 * @param {number} zi ZIP index of the style ZIP
 * @param {string} style 'grid' | 'tract' | 'curvi' | 'rural'
 */
export function createNamer(world, zi, style) {
  const z = world.zip(zi);
  const seed = hashStr(z.zip, 0x57ee7);
  const region = z.regionKey;
  const south = ['la', 'oc', 'sd', 'ie'].includes(region);
  const coastMission = ['cc', 'ba', 'la', 'sd', 'oc'].includes(region);
  const valley = ['sv', 'sj'].includes(region);
  const spanishW = south ? 0.38 : coastMission ? 0.28 : valley ? 0.18 : 0.12;
  // the grid's naming scheme: which axis is numbered, which pool names the other
  const hs = mix32(seed ^ 0x51);
  const numberedAxis = style === 'grid' ? ((hs & 3) === 0 ? null : (hs & 4 ? 'u' : 'v')) : style === 'tract' ? ((hs & 7) < 2 ? (hs & 8 ? 'u' : 'v') : null) : null;
  const lettered = style === 'grid' && !!numberedAxis && (hs % 9) === 1;
  const namedPools = [TREES, PEOPLE, SAINTS, SPANISH, TREES, SPANISH];
  const namedPool = numberedAxis || lettered ? namedPools[(hs >>> 8) % namedPools.length] : null;
  const base = 2 + ((hs >>> 12) % 22);
  const used = new Set();
  // generated streets get distinct names where the pools allow it (a real town rarely repeats a court name)
  const fresh = (make, h) => {
    let name = make(h);
    for (let k = 1; k < 6 && used.has(name); k++) name = make(hash2(h, k));
    used.add(name);
    return name;
  };

  function suffixFor(cls, h, shape) {
    if (cls === 'arterial') return style === 'curvi' ? pick(['Parkway', 'Boulevard', 'Road', 'Avenue'], h) : pick(['Avenue', 'Boulevard', 'Street', 'Avenue'], h);
    if (cls === 'collector') return style === 'curvi' ? pick(['Drive', 'Road', 'Way', 'Parkway'], h) : pick(['Avenue', 'Street', 'Drive', 'Road'], h);
    if (cls === 'rural' || cls === 'highway') return 'Road';
    if (shape === 'culdesac') return pick(['Court', 'Court', 'Place', 'Circle', 'Lane'], h);
    if (shape === 'loop') return pick(['Circle', 'Loop', 'Lane', 'Way'], h);
    if (style === 'curvi') return pick(['Drive', 'Lane', 'Way', 'Terrace', 'Drive', 'Street'], h);
    if (style === 'tract') return pick(['Avenue', 'Street', 'Drive', 'Place', 'Way', 'Avenue'], h);
    return pick(['Street', 'Avenue', 'Street'], h);
  }

  function plainName(h) {
    const u = (h >>> 0) / 4294967296;
    if (u < spanishW) return pick(SPANISH, h >>> 3);
    if (u < spanishW + 0.12 && coastMission) return pick(SAINTS, h >>> 5);
    if (style === 'curvi') return (h & 1) ? pick(PREFIX, h >>> 7) + pick(SUFFIXW, h >>> 13) : pick(NATURE, h >>> 9);
    if (u < spanishW + 0.5) return pick(TREES, h >>> 4);
    return pick(PEOPLE, h >>> 6);
  }

  return {
    seed, numberedAxis, lettered, valley,
    /**
     * Name of a lattice line: axis 'u' or 'v', integer index along the ZIP's lattice, road class.
     * Numbered or lettered axes count from the ZIP's base; the other axis draws from one pool in order.
     */
    line(axis, index, cls) {
      const h = hash3(seed, axis === 'u' ? 1 : 2, index);
      if (axis === numberedAxis) {
        const num = base + index;
        if (num >= 1 && num <= 60) return `${ordinal(num)} ${axis === 'u' ? 'Street' : 'Avenue'}`;
      }
      if (lettered && axis !== numberedAxis) {
        const k = index + 6;
        if (k >= 0 && k < 26) return `${LETTERS[k]} Street`;
      }
      if (namedPool && axis !== numberedAxis) {
        const off = (seed >>> 3) % namedPool.length;
        const nm = namedPool[(((off + index) % namedPool.length) + namedPool.length) % namedPool.length];
        return `${nm} ${suffixFor(cls, h, 'line')}`;
      }
      return `${plainName(h)} ${suffixFor(cls, h >>> 2, 'line')}`;
    },
    /** Name of a generated street (curved local, cul-de-sac, loop, collector) from a stable hash. */
    street(h, cls, shape = 'street') {
      return fresh(g => {
        g = hash2(seed, g);
        if (south && style === 'curvi' && (g % 5) === 0 && cls !== 'arterial') return spanishStreet(pick(['Calle', 'Via', 'Camino', 'Paseo'], g >>> 4), pick(SPANISH_SHORT, g >>> 9));
        if (style === 'curvi' && cls !== 'arterial' && (g % 7) === 3) return spanishStreet(pick(['Via', 'Calle'], g >>> 3), pick(SPANISH_SHORT, g >>> 11));
        return `${plainName(g)} ${suffixFor(cls, g >>> 2, shape)}`;
      }, h);
    },
    /**
     * The stem of a place's name (a park, a school, a shopping center, an apartment complex): a name from the
     * place's pools with no street suffix to strip ("Sycamore", "Las Flores", "San Miguel", "Silverbrook").
     */
    place(h) { return plainName(hash2(seed, (h ^ 0x9e3779b9) >>> 0)); },
    /** A rural road: county numbers in the valley ("Road 24"), named roads elsewhere. */
    rural(h, axis = null, index = 0) {
      if (valley && axis) return axis === 'u' ? `Road ${Math.abs(index * 2 + (seed % 40) + 10)}` : `Avenue ${Math.abs(index * 2 + ((seed >>> 6) % 40) + 8)}`;
      return fresh(g => `${pick(RURAL, hash2(seed, g))} Road`, h);
    },
    /** A short private lane to rural homes. */
    lane(h) { return fresh(g => `${pick(RURAL.concat(NATURE), hash2(seed, g))} Lane`, h); },
    /** Display name for a state highway from the pack ("I-80", "US 101", "SR 1"). */
    highway(road) {
      if (!road) return 'Highway';
      if (road.kind === 'I') return `Interstate ${road.r}`;
      if (road.kind === 'US') return `US Highway ${road.r}`;
      return `Highway ${road.r}`;
    },
    /** An alley ("Alley" or a named one in older cores). */
    alley(h) { h = hash2(seed, h); return (h % 3) === 0 ? `${pick(TREES.concat(PEOPLE), h >>> 4)} Alley` : 'Alley'; },
  };
}
