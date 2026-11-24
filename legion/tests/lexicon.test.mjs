import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadDefaultWorld } from '../src/engine/world.mjs';
import { Rng } from '../src/engine/rng.mjs';
import { atPacific } from '../src/engine/clock.mjs';
import {
  dialectFor, explainDialect, dialectTable, DIALECT_KEYS, DIALECTS, DIALECT_FAMILIES, LINE_CATEGORIES, WORD_CATEGORIES, WEATHER_CONDITIONS, AGE_CATEGORIES,
  roadName, roadNames, freewayName, namedStretch, stretchesNear, normalizeRoad, NAMED_STRETCHES, ROAD_USAGE,
  SLOTS, SLOT_NAMES, fill, templateSlots, fireLabel, teamName, BRAND_BLACKLIST, findBrands,
  lineTags, lineFits, situationOf, taggedLines, SPEAKER_NEEDS, ALERT_KINDS,
  LANGUAGES, LANGUAGE_KEYS, PHRASE_INTENTS, RELIGIOUS_INTENTS, FAMILY_RELATIONS, INTERJECTION_KINDS, LANGUAGE_LIST_FIELDS, FAITHS, TIMES_OF_DAY,
  resolveLanguage, varietyFor, faithFor,
  Picker, linesFor, pickLine, slangFor, codeSwitch, familyTerm, phrasesFor, weatherCondition, offshoreWind, slotsFor, speakerFacts, landmarkLabel, dialectSummary,
} from '../src/engine/lexicon.mjs';
import { parseTagged, registerLine } from '../src/engine/lexicon/tags.mjs';

const world = await loadDefaultWorld();

const KNOWN = {
  94110: 'sf', 94612: 'eastbay', 95014: 'southbay', 94401: 'peninsula', 94952: 'northbay', 95814: 'sacramento',
  95928: 'valley-north', 95354: 'valley-south', 93721: 'fresno', 93301: 'kern', 90401: 'la-westside', 90022: 'la-eastside',
  91401: 'sfv', 90044: 'la-south', 90277: 'southbay-la', 90813: 'longbeach', 91776: 'sgv', 92660: 'oc-coast',
  92805: 'oc-inland', 92501: 'ie', 92262: 'desert-cv', 92392: 'high-desert', 92109: 'sd-coast', 92021: 'sd-inland',
  92243: 'imperial', 93401: 'central-coast', 93901: 'salinas', 95501: 'north-coast', 96001: 'far-north', 96150: 'tahoe',
  95667: 'gold-country', 93514: 'eastern-sierra',
};

const SOCAL = ['la-westside', 'la-central', 'la-eastside', 'sfv', 'santa-clarita', 'la-south', 'southbay-la', 'longbeach', 'sgv', 'ventura', 'oc-coast', 'oc-inland', 'ie', 'desert-cv', 'high-desert', 'antelope-valley', 'low-desert', 'imperial', 'sd-coast', 'sd-inland', 'socal-mountains', 'santa-barbara'];
const NORCAL = ['sf', 'eastbay', 'southbay', 'peninsula', 'northbay', 'sacramento', 'valley-north', 'valley-south', 'fresno', 'salinas', 'monterey-bay', 'north-coast', 'north-inland', 'far-north', 'tahoe', 'gold-country', 'sierra-foothills', 'eastern-sierra', 'central-coast'];

// Every template in a dialect: all categories, weather, youth and elder banks.
function templatesOf(d) {
  const out = [];
  for (const c of LINE_CATEGORIES) out.push(...d[c]);
  for (const w of WEATHER_CONDITIONS) out.push(...d.weather[w]);
  for (const band of ['youth', 'elder']) for (const c of AGE_CATEGORIES) out.push(...d[band][c]);
  return out;
}

function languageEntries(L) {
  const out = [];
  for (const f of LANGUAGE_LIST_FIELDS) out.push(...L[f].map(e => [f, e]));
  for (const k of INTERJECTION_KINDS) out.push(...L.interjections[k].map(e => [`interjections.${k}`, e]));
  for (const [rel, list] of Object.entries(L.family)) out.push(...list.map(e => [`family.${rel}`, e]));
  for (const [intent, list] of Object.entries(L.phrases)) out.push(...list.map(e => [`phrases.${intent}`, e]));
  return out;
}

const FULL_SLOTS = {
  road: 'the 405', stretch: 'the Grapevine', place: 'Fresno', city: 'Fresno', neighborhood: 'the Tower District', landmark: 'Mount Diablo',
  peak: 'Mount Baldy', county: 'Fresno', region: 'the Valley', temp: 104, fire: 'the Creek Fire', year: '2020', team: 'the Giants',
  teamName: 'Giants', weather: 'sunny', season: 'summer', month: 'July', day: 'Monday', alert: 'Heat Advisory',
};

// A situation in which every situational tag can pass: lines are then only filtered by the speaker.
const ANY_SITUATION = { alerts: ['Red Flag Warning', 'Flash Flood Warning', 'Frost Advisory', 'Excessive Heat Warning', 'Wind Advisory', 'Winter Storm Warning'], offshore: true };

// The source block (statewide, family or key) each dialect key's lines come from, to find which keys say a line.
function keysSaying(template) {
  return DIALECT_KEYS.filter(k => templatesOf(DIALECTS[k]).includes(template));
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
// How Californians use the season words: generous, overlapping months (winter in the mountains starts in October).
const SEASON_MONTHS = { spring: [2, 3, 4, 5, 6], summer: [5, 6, 7, 8, 9, 10], fall: [9, 10, 11, 12], autumn: [9, 10, 11, 12], winter: [10, 11, 12, 1, 2, 3, 4] };
const SEASON_RE = /\b(spring|summers?|fall|autumn|winters?)\b/gi;
const MONTH_RE = new RegExp(`\\b(${MONTH_NAMES.join('|')})\\b`, 'g');
const SEASONAL_RE = /\b(spring|summers?|fall|autumn|winters?|seasons?|harvest|holidays?|snowbirds?|bloom\w*|blossoms?|New Year|Christmas)\b/i;
const seasonsNamed = t => [...new Set([...t.matchAll(SEASON_RE)].map(m => m[1].toLowerCase().replace(/s$/, '')))];
const monthsNamed = t => [...new Set([...t.matchAll(MONTH_RE)].map(m => MONTH_NAMES.indexOf(m[1]) + 1))];

// ------------------------------------------------------------------ dialect geography

test('every ZIP gets a dialect key, and every key is used somewhere', () => {
  const table = dialectTable(world);
  assert.equal(table.length, world.N);
  const used = new Set();
  for (let i = 0; i < world.N; i++) {
    assert.ok(DIALECT_KEYS.includes(table[i]), `${world.zips[i]} -> ${table[i]}`);
    used.add(table[i]);
  }
  for (const k of DIALECT_KEYS) assert.ok(used.has(k), `no ZIP speaks ${k}`);
  assert.equal(new Set(DIALECT_KEYS).size, DIALECT_KEYS.length);
});

test('known ZIPs get their dialects', () => {
  for (const [zip, key] of Object.entries(KNOWN)) {
    assert.equal(dialectFor(world, zip), key, `${zip}: ${JSON.stringify(explainDialect(world, zip))}`);
    assert.equal(dialectFor(world, world.indexOf(zip)), key);
  }
});

test('more of the map: Glendale is the 818, Palo Alto the Peninsula, Watsonville the Salinas Valley, Big Bear the mountains', () => {
  const cases = { 91205: 'sfv', 94301: 'peninsula', 95076: 'salinas', 92315: 'socal-mountains', 96161: 'tahoe', 93101: 'santa-barbara', 93454: 'central-coast', 93950: 'monterey-bay', 95482: 'north-inland', 93534: 'antelope-valley', 91355: 'santa-clarita', 93030: 'ventura', 92225: 'low-desert', 93555: 'high-desert', 93644: 'sierra-foothills', 90028: 'la-central', 92683: 'oc-inland', 92648: 'oc-coast' };
  for (const [zip, key] of Object.entries(cases)) assert.equal(dialectFor(world, zip), key, `${zip}: ${JSON.stringify(explainDialect(world, zip))}`);
});

test('the Tehachapi Mountains are mountain towns, not the Bakersfield valley floor', () => {
  for (const zip of ['93561', '93581', '93518', '93531']) {
    assert.equal(dialectFor(world, zip), 'sierra-foothills', `${zip}: ${JSON.stringify(explainDialect(world, zip))}`);
    assert.match(explainDialect(world, zip).rule, /Tehachapi/);
  }
  for (const zip of ['93301', '93306', '93307', '93215', '93203', '93263', '93268']) assert.equal(dialectFor(world, zip), 'kern', zip);
  // No valley-floor fog or orchard lines and no Bakersfield temperature for Tehachapi.
  const teh = linesFor('sierra-foothills', 'weather', { condition: 'fog', ignoreTags: true }).concat(linesFor('sierra-foothills', 'weather', { condition: 'heat', ignoreTags: true }), linesFor('sierra-foothills', 'weather', { condition: 'cold', ignoreTags: true }));
  for (const t of teh) assert.ok(!/tule fog|on 99|wind machines|Bako/i.test(t), t);
});

test('dialectFor is stable and rejects bad input', () => {
  assert.equal(dialectFor(world, 123456), null);
  assert.equal(dialectFor(world, -1), null);
  assert.equal(dialectFor(world, '00000'), null);
  const zi = world.indexOf('90044');
  assert.equal(dialectFor(world, zi), dialectFor(world, zi));
  const why = explainDialect(world, zi);
  assert.equal(why.key, 'la-south');
  assert.ok(why.rule.length > 0);
});

// ------------------------------------------------------------------ roads

test('road naming: Southern California says "the" and PCH', () => {
  assert.equal(roadName({ name: 'I-405', route: 405, kind: 'I' }, 'la-westside'), 'the 405');
  assert.equal(roadName('I-5', 'sfv'), 'the 5');
  assert.equal(roadName('I-10', 'ie'), 'the 10');
  assert.equal(roadName('US 101', 'sfv'), 'the 101');
  assert.equal(roadName('SR 1', 'la-westside'), 'PCH');
  assert.equal(roadName('SR 1', 'oc-coast'), 'PCH');
  assert.equal(roadName('SR 1', 'southbay-la'), 'PCH');
  assert.equal(roadName('I-15', 'sd-inland'), 'the 15');
  assert.equal(roadName('I-805', 'sd-coast'), 'the 805');
  assert.equal(roadName('SR 91', 'oc-inland'), 'the 91');
  for (const k of SOCAL) assert.equal(DIALECTS[k].the, true, k);
});

test('road naming: Northern California drops the article and says I-5, Highway 1, 101', () => {
  assert.equal(roadName('I-405', 'southbay'), '405');
  assert.equal(roadName('I-280', 'peninsula'), '280');
  assert.equal(roadName('I-880', 'eastbay'), '880');
  assert.equal(roadName('I-80', 'sacramento'), '80');
  assert.equal(roadName('I-5', 'sacramento'), 'I-5');
  assert.equal(roadName('I-5', 'far-north'), 'I-5');
  assert.equal(roadName('SR 1', 'monterey-bay'), 'Highway 1');
  assert.equal(roadName('SR 1', 'peninsula'), 'Highway 1');
  assert.equal(roadName('US 101', 'sf'), '101');
  assert.equal(roadName('US 101', 'north-coast'), '101');
  assert.equal(roadName('SR 17', 'monterey-bay'), 'Highway 17');
  assert.equal(roadName('SR 24', 'eastbay'), '24');
  assert.equal(roadName('SR 51', 'sacramento'), 'Business 80');
  for (const k of NORCAL) assert.equal(DIALECTS[k].the, false, k);
  for (const k of NORCAL) for (const r of ['I-880', 'US 101', 'SR 99', 'I-80']) assert.ok(!roadName(r, k).startsWith('the '), `${k} ${r}`);
});

test('road naming: the Central Valley says 99, the Sierra 50, 80, 395', () => {
  assert.ok(['99', 'Highway 99'].includes(roadName('SR 99', 'fresno')));
  assert.ok(['99', 'Highway 99'].includes(roadName('SR 99', 'valley-south')));
  assert.equal(roadName('SR 41', 'fresno'), 'Highway 41');
  assert.equal(roadName('US 50', 'tahoe'), '50');
  assert.equal(roadName('I-80', 'tahoe'), '80');
  assert.equal(roadName('US 395', 'eastern-sierra'), '395');
  assert.equal(roadName('SR 49', 'gold-country'), 'Highway 49');
  assert.equal(roadName('SR 89', 'tahoe'), '89');
  // Bakersfield is mixed: "the 99" mostly, "99" or "Highway 99" sometimes.
  assert.equal(roadName('SR 99', 'kern'), 'the 99');
  const rng = new Rng(11), seen = new Set();
  for (let i = 0; i < 400; i++) seen.add(roadName('SR 99', 'kern', { rng }));
  assert.deepEqual([...seen].sort(), ['99', 'Highway 99', 'the 99']);
  for (let i = 0; i < 100; i++) assert.ok(['99', 'Highway 99'].includes(roadName('SR 99', 'fresno', { rng })));
});

test('road names parse in every common spelling, and unknown dialects get neutral forms', () => {
  assert.deepEqual(normalizeRoad('Interstate 5'), { kind: 'I', route: 5, name: 'I-5', aadt: null });
  assert.equal(normalizeRoad('CA-1').route, 1);
  assert.equal(normalizeRoad('Highway 99').kind, 'SR');
  assert.equal(normalizeRoad('US-101').kind, 'US');
  assert.equal(normalizeRoad(17).name, 'SR 17');
  assert.equal(normalizeRoad({ name: 'I-405' }).route, 405);
  assert.equal(normalizeRoad('Main Street'), null);
  assert.equal(roadName('Main Street', 'sf'), null);
  assert.equal(roadName(null, 'sf'), null);
  assert.equal(roadName('I-405', 'nowhere'), 'I-405');
  assert.equal(roadName('US 101', 'nowhere'), 'US 101');
  assert.equal(roadName('SR 99', 'nowhere'), 'Highway 99');
  for (const k of DIALECT_KEYS) assert.ok(ROAD_USAGE[k], k);
});

test('every road in the pack has a name in every dialect, from the roads near real ZIPs', () => {
  for (let i = 0; i < world.N; i += 9) {
    const key = dialectFor(world, i), z = world.zip(i);
    for (const r of world.roadsNear(z.tx, z.ty, 15)) {
      const n = roadName(r, key);
      assert.ok(typeof n === 'string' && n.length >= 2, `${z.zip} ${r.name}`);
      assert.ok(!/\{|\}|undefined|NaN/.test(n), n);
      assert.ok(String(n).includes(String(r.route)) || n === 'PCH' || n === 'Business 80', `${key} ${r.name} -> ${n}`);
    }
  }
});

test('freeway names older drivers use, by segment', () => {
  const zi = z => world.indexOf(z);
  assert.ok(roadNames('I-10', 'la-westside', { world, zi: zi('90034') }).includes('the Santa Monica Freeway'));
  assert.ok(roadNames('I-10', 'sgv', { world, zi: zi('91776') }).includes('the San Bernardino Freeway'));
  assert.ok(roadNames('US 101', 'la-central', { world, zi: zi('90028') }).includes('the Hollywood Freeway'));
  assert.ok(roadNames('US 101', 'sfv', { world, zi: zi('91401') }).includes('the Ventura Freeway'));
  assert.ok(roadNames('I-880', 'eastbay', { world, zi: zi('94612') }).includes('the Nimitz'));
  assert.equal(freewayName('I-405', 'la-westside', world, zi('90401')), 'the San Diego Freeway');
  assert.equal(freewayName('I-405', 'sf', world, zi('94110')), null);
  assert.equal(roadNames('I-405', 'la-westside')[0], 'the 405');
});

test('named stretches near the ZIPs that drive them', () => {
  const cases = [
    ['93301', 'I-5', 'the Grapevine'], ['95376', 'I-580', 'the Altamont'], ['92392', 'I-15', 'Cajon Pass'],
    ['94107', 'I-80', 'the Bay Bridge'], ['94044', 'SR 1', "Devil's Slide"], ['90049', 'I-405', 'the Sepulveda Pass'],
    ['91765', 'SR 57', 'the Kellogg Hill interchange'], ['96161', 'I-80', 'Donner Summit'], ['93635', 'SR 152', 'Pacheco Pass'],
  ];
  for (const [zip, road, name] of cases) assert.equal(namedStretch({ name: road }, world, zip), name, `${zip} ${road}`);
  assert.equal(namedStretch('I-5', world, '92262'), null);
  assert.equal(namedStretch('I-80', world, '90001'), null);
  assert.ok(stretchesNear(world, world.indexOf('93301')).some(s => s.name === 'the Grapevine'));
  for (const s of NAMED_STRETCHES) {
    assert.ok(s.name && s.routes.length && s.radiusKm > 0 && s.note, s.name);
    for (const r of s.routes) assert.ok(normalizeRoad(r), `${s.name}: ${r}`);
  }
});

// ------------------------------------------------------------------ dialect content

test('every dialect has every field, and dozens of lines per category', () => {
  const min = { greetings: 24, farewells: 24, traffic: 24, prideLines: 24, complaintLines: 24, food: 15, fillers: 12, intensifiers: 8, agreement: 12, surprise: 12 };
  for (const k of DIALECT_KEYS) {
    const d = DIALECTS[k];
    assert.equal(d.key, k);
    for (const f of ['name', 'region', 'regionThe', 'family', 'familyName', 'register', 'roadStyle']) assert.ok(typeof d[f] === 'string' && d[f], `${k}.${f}`);
    assert.equal(typeof d.the, 'boolean');
    assert.ok(Array.isArray(d.areaCodes) && d.areaCodes.length && d.areaCodes.every(c => /^\d{3}$/.test(c)), `${k} area codes`);
    assert.ok(Object.keys(d.words).length >= 8, `${k} words`);
    for (const [term, w] of Object.entries(d.words)) assert.ok(term && w.kind && w.note, `${k} word ${term}`);
    assert.ok(d.localTerms.length >= 6 && d.localTerms.every(t => d.words[t]), `${k} localTerms`);
    for (const c of LINE_CATEGORIES) assert.ok(d[c].length >= min[c], `${k}.${c} has ${d[c].length}`);
    for (const w of WEATHER_CONDITIONS) assert.ok(d.weather[w].length >= 8, `${k}.weather.${w} has ${d.weather[w].length}`);
    for (const c of LINE_CATEGORIES) assert.ok(d.regional[c].length >= 1, `${k}.regional.${c}`);
    for (const c of AGE_CATEGORIES) assert.ok(d.youth[c].length >= 1 && Array.isArray(d.elder[c]), `${k} youth/elder ${c}`);
    assert.ok(d.slang.length >= 15, `${k} slang`);
    assert.ok(d.teams.length >= 2, `${k} teams`);
    assert.ok(Object.isFrozen(d) && Object.isFrozen(d.greetings) && Object.isFrozen(d.weather.fog));
  }
  for (const [fk, f] of Object.entries(DIALECT_FAMILIES)) assert.ok(f.keys.length >= 1 && f.name && f.register, fk);
});

test('regional vocabulary is where Californians actually use it', () => {
  const has = (k, term) => assert.ok(DIALECTS[k].words[term], `${k} lacks "${term}"`);
  for (const k of ['sf', 'eastbay', 'southbay', 'peninsula', 'northbay', 'sacramento']) has(k, 'hella');
  has('eastbay', 'hecka');
  for (const k of ['sf', 'eastbay', 'northbay']) has(k, 'the city');
  assert.match(DIALECTS.eastbay.words['the city'].note, /San Francisco/);
  has('sfv', 'the Valley'); assert.match(DIALECTS.sfv.words['the Valley'].note, /San Fernando/);
  has('fresno', 'the Valley'); assert.match(DIALECTS.fresno.words['the Valley'].note, /Central Valley/);
  has('sacramento', 'the Valley'); assert.match(DIALECTS.sacramento.words['the Valley'].note, /never the San Fernando Valley/);
  has('ie', 'the IE');
  for (const [k, code] of [['sfv', '818'], ['ie', '909'], ['ie', '951'], ['fresno', '559'], ['valley-south', '209'], ['northbay', '707'], ['sacramento', '916'], ['sgv', '626']]) {
    has(k, `the ${code}`);
    assert.ok(DIALECTS[k].areaCodes.includes(code), `${k} ${code}`);
  }
  has('sf', 'NorCal'); has('la-westside', 'SoCal');
  for (const k of ['fresno', 'valley-south', 'kern', 'sacramento']) { has(k, 'tule fog'); has(k, 'frontage road'); }
  for (const k of ['la-westside', 'sfv', 'longbeach']) { has(k, 'June Gloom'); has(k, 'May Gray'); has(k, 'Santa Anas'); }
  for (const k of ['oc-coast', 'sd-coast']) has(k, 'June Gloom');
  has('sf', 'Karl the Fog'); has('sf', 'the marine layer'); has('la-central', 'the marine layer');
  has('ie', 'Santa Anas'); has('oc-inland', 'Santa Anas');
  has('eastbay', 'Diablo winds');
  has('santa-barbara', 'sundowner');
  for (const k of ['tahoe', 'gold-country', 'socal-mountains']) has(k, 'chain control');
  for (const k of ['tahoe', 'eastern-sierra', 'socal-mountains']) has(k, 'powder day');
  assert.ok(DIALECTS.tahoe.slang.some(s => s.term === 'powder day'));
  for (const k of ['desert-cv', 'high-desert', 'imperial', 'low-desert']) { has(k, 'dry heat'); has(k, 'snowbirds'); }
  has('desert-cv', 'date shake');
  for (const k of ['fresno', 'kern', 'valley-south']) has(k, 'the 99');
  has('kern', 'the Grapevine'); has('valley-south', 'the Altamont');
  has('sf', 'BART'); has('peninsula', 'Caltrain'); has('sf', 'Muni'); has('la-central', 'the Metro');
  has('sd-coast', 'the Coaster'); has('sd-inland', 'the trolley');
  for (const k of ['sacramento', 'fresno', 'central-coast', 'sd-coast', 'la-westside']) has(k, 'Amtrak');
});

test('the dialects that say "the 405" are exactly the Southern California ones, and their lines agree', () => {
  for (const k of DIALECT_KEYS) {
    const d = DIALECTS[k];
    const lines = templatesOf(d).join('\n');
    if (d.theShare === 0) assert.ok(!/\bthe (5|10|15|101|405|605|710|805|880|280|580|680)\b/.test(lines), `${k} uses SoCal "the"`);
    if (d.theShare === 1) assert.ok(!/(^|[^\w-])(405|880|280|580|680)\b/.test(lines.replace(/the \d+/gi, '')), `${k} uses a bare NorCal number`);
  }
});

test('every template uses only documented slots, and fill never leaves a brace', () => {
  assert.ok(SLOT_NAMES.length >= 13);
  for (const s of ['road', 'place', 'city', 'neighborhood', 'landmark', 'county', 'region', 'temp', 'fire', 'year', 'team', 'weather', 'season']) assert.ok(SLOTS[s], s);
  const rng = new Rng(5);
  for (const k of DIALECT_KEYS) {
    for (const t of templatesOf(DIALECTS[k])) {
      for (const s of templateSlots(t)) assert.ok(SLOT_NAMES.includes(s), `${k}: unknown slot {${s}} in "${t}"`);
      assert.ok(!/[{}]/.test(t.replace(/\{[A-Za-z_]+\}/g, '')), `stray brace in "${t}"`);
      assert.ok(!/^@/.test(t), `${k}: tags left in the text of "${t}"`);
      const full = fill(t, FULL_SLOTS);
      assert.ok(full && !/[{}]/.test(full), `${k}: "${t}" -> ${full}`);
      assert.ok(/^[A-Z0-9¡¿"']/.test(full) || /^[a-z]/.test(t) === false, `${k}: "${full}" should start capitalized`);
      // Any partial slot set either fills completely or gives null.
      const partial = Object.fromEntries(Object.entries(FULL_SLOTS).filter(() => rng.chance(0.5)));
      const out = fill(t, partial);
      assert.ok(out === null || !/[{}]/.test(out), `${k}: partial fill of "${t}" -> ${out}`);
    }
  }
});

test('fill fills, capitalizes, and refuses what it cannot fill', () => {
  assert.equal(fill('{road} was a parking lot this morning.', { road: 'the 405' }), 'The 405 was a parking lot this morning.');
  assert.equal(fill("It's {temp} out. {road} is empty.", { temp: 101, road: 'the 99' }), "It's 101 out. The 99 is empty.");
  assert.equal(fill('{road} was a parking lot.', {}), null);
  assert.equal(fill('{road} was a parking lot.', { road: '' }), null);
  assert.equal(fill('{road} was a parking lot.', { road: null }), null);
  assert.equal(fill('{temp} degrees.', { temp: NaN }), null);
  assert.equal(fill('Hello {nonsense}.', { nonsense: 'x' }), null);
  assert.equal(fill('Hello {place}.', { place: '{evil}' }), null);
  assert.equal(fill('No slots at all.'), 'No slots at all.');
  assert.equal(fill(''), null);
  assert.equal(fill(null), null);
  assert.deepEqual(templateSlots('{fire} in {year}, then {fire} again'), ['fire', 'year']);
});

test('fires are named the way people say them', () => {
  assert.equal(fireLabel('Camp'), 'the Camp Fire');
  assert.equal(fireLabel('August Complex'), 'the August Complex');
  assert.equal(fireLabel('Scu Lightning Complex'), 'the SCU Lightning Complex');
  assert.equal(fireLabel({ name: 'Knp Complex' }), 'the KNP Complex');
  assert.equal(fireLabel('Highway 70'), 'the Highway 70 Fire');
  assert.equal(fireLabel('Unnamed'), null);
  assert.equal(fireLabel('165'), null);
  assert.equal(fireLabel(''), null);
});

test('no brand names anywhere in the lexicon', () => {
  assert.ok(BRAND_BLACKLIST.length >= 40);
  assert.deepEqual(findBrands('Grabbed a coffee at Starbucks, then In-N-Out.'), ['In-N-Out', 'Starbucks']);
  assert.deepEqual(findBrands('Clam chowder in Shell Beach, then target practice.'), []);
  assert.deepEqual(findBrands('We went to Costco and Target.'), ['Target', 'Costco']);
  const texts = [];
  for (const k of DIALECT_KEYS) {
    const d = DIALECTS[k];
    texts.push(...templatesOf(d), ...d.teams, d.name, d.region, d.register);
    for (const [term, w] of Object.entries(d.words)) texts.push(term, w.note);
    for (const s of d.slang) texts.push(s.term, s.gloss, s.example);
  }
  for (const L of Object.values(LANGUAGES)) for (const [, e] of languageEntries(L)) texts.push(e.text, e.gloss, e.roman || '');
  for (const s of NAMED_STRETCHES) texts.push(s.name, s.note);
  for (const t of texts) assert.deepEqual(findBrands(t), [], `brand in "${t}"`);
});

test('dialect lines stay regional: no heritage family words, no accent spellings', () => {
  // Heritage kinship and endearment words that must stay in LANGUAGES, never leak into regional English lines.
  const kin = new Set(['abuela', 'abuelita', 'abuelo', 'abuelito', 'mijo', 'mija', 'compadre', 'comadre', 'carnal', 'compa', 'chero', 'lola', 'lolo', 'tita', 'tito', 'kuya', 'anak', 'barkada', 'halmeoni', 'harabeoji', 'oppa', 'eonni', 'nuna', 'hyeong', 'imo', 'dādī', 'nānī', 'beṭā', 'bhaiyā', 'dīdī', 'khāla', 'amu', 'tatik', 'papik', 'ḥabībī', 'babushka', 'dedushka', 'cưng', 'putt']);
  for (const lang of ['spanish', 'tagalog', 'korean', 'hindi', 'armenian', 'russian']) {
    const L = LANGUAGES[lang];
    const terms = [...Object.values(L.family).flat(), ...L.affection].map(e => (e.roman || e.text).toLowerCase());
    assert.ok([...kin].some(w => terms.includes(w)), `the kinship list covers ${lang}`);
  }
  const accent = /\b(dat|dis|dem|ze|zis|vat|vill|goin'|nothin'|lemme|gonna be)\b/i;
  for (const k of DIALECT_KEYS) {
    for (const t of templatesOf(DIALECTS[k])) {
      const words = t.toLowerCase().match(/[a-zà-ÿ']+/g) || [];
      for (const w of words) assert.ok(!kin.has(w), `${k}: "${t}" uses the family word "${w}"`);
      assert.ok(!accent.test(t.replace(/gonna be/gi, '')), `${k}: accent spelling in "${t}"`);
    }
  }
});

test('age-graded lines and slang', () => {
  const rng = new Rng(21);
  const teen = linesFor('sf', 'agreement', { age: 16 }), elder = linesFor('sf', 'agreement', { age: 72 }), adult = linesFor('sf', 'agreement', { age: 40 });
  assert.ok(teen.includes('Hella.') && !adult.includes('Hella.'));
  assert.ok(elder.includes("That's the truth.") && !adult.includes("Isn't that the truth."));
  assert.ok(teen.length > adult.length && elder.length > adult.length);
  assert.deepEqual(linesFor('sf', 'weather', { condition: 'fog', ignoreTags: true }), [...DIALECTS.sf.weather.fog]);
  // With no time, place or weather given, only lines that hold in any situation come back.
  const bare = linesFor('sf', 'weather', { condition: 'fog' });
  assert.ok(bare.length >= 8 && bare.length < DIALECTS.sf.weather.fog.length);
  for (const t of bare) { const g = lineTags(t); assert.ok(!g || (!g.months && !g.hours && !g.wx && !g.alerts && !g.counties && !g.flags.some(f => f !== 'anytime')), t); }
  assert.deepEqual(linesFor('sf', 'weather'), []);
  assert.deepEqual(linesFor('nowhere', 'greetings'), []);
  let regional = 0;
  for (let i = 0; i < 300; i++) {
    const s = slangFor('sf', 17, rng);
    assert.ok(s && s.level <= 3 && s.ages[0] <= 17 && 17 <= s.ages[1], JSON.stringify(s));
    if (s.origin !== 'common') regional++;
    const old = slangFor('sf', 70, rng);
    assert.ok(old === null || (old.level === 1 && old.ages[1] >= 70), JSON.stringify(old));
    const kid = slangFor('fresno', 10, rng);
    assert.ok(kid === null || kid.level === 1);
    const mid = slangFor('la-westside', 38, rng);
    assert.ok(mid === null || mid.level <= 2);
  }
  assert.ok(regional > 60, `regional slang ${regional}/300`);
  assert.equal(slangFor('sf', 17, rng, { maxLevel: 0 }), null);
  assert.equal(slangFor('nowhere', 17, rng), null);
  assert.ok(DIALECTS.sf.slang.some(s => s.term === 'hella' && s.level === 1));
  assert.ok(DIALECTS.sf.slang.some(s => s.level === 3));
});

// ------------------------------------------------------------------ Picker and lines

test('Picker avoids repeats until a category is exhausted, then never repeats the last pick', () => {
  const items = ['a', 'b', 'c', 'd', 'e'];
  const p = new Picker(3);
  const first = [];
  for (let i = 0; i < items.length; i++) first.push(p.pick('x', items));
  assert.deepEqual([...first].sort(), items);
  let last = first[first.length - 1];
  for (let i = 0; i < 50; i++) { const n = p.pick('x', items); assert.notEqual(n, last); last = n; }
  // categories are independent
  assert.ok(items.includes(p.pick('y', items)));
  // state round-trips
  const q = Picker.fromJSON(JSON.parse(JSON.stringify(p.toJSON())), 9);
  for (const c of ['x', 'y']) assert.deepEqual([...q.used.get(c)].sort(), [...p.used.get(c)].sort());
  assert.equal(p.pick('z', []), undefined);
  assert.equal(new Picker(1).pick('one', ['only']), 'only');
  // pickWhere only accepts items that pass
  const hit = new Picker(4).pickWhere('t', ['{road} jam', 'no slot'], t => fill(t, {}));
  assert.deepEqual(hit, { item: 'no slot', value: 'No slot' });
});

test('pickLine fills from the world and never repeats inside a conversation', () => {
  const zi = world.indexOf('93721');
  const { values: slots, context } = slotsFor(world, zi);
  const picker = new Picker(77), rng = new Rng(77);
  const seen = new Set();
  const n = linesFor('fresno', 'traffic', context).filter(t => fill(t, slots)).length;
  assert.ok(n >= 15, `fresno traffic has ${n} lines that fit`);
  for (let i = 0; i < n; i++) {
    const l = pickLine('fresno', 'traffic', rng, { ...context, slots, picker });
    assert.ok(l && l.text && !/[{}]/.test(l.text));
    assert.ok(!seen.has(l.text), `repeat: ${l.text}`);
    assert.ok(lineFits(l.template, context), l.template);
    seen.add(l.text);
  }
  const a = pickLine('kern', 'prideLines', new Rng(5), { slots: slotsFor(world, world.indexOf('93301')).values });
  const b = pickLine('kern', 'prideLines', new Rng(5), { slots: slotsFor(world, world.indexOf('93301')).values });
  assert.deepEqual(a, b);
  assert.equal(pickLine('fresno', 'weather', rng, { slots }), null);
  assert.ok(pickLine('fresno', 'weather', rng, { slots, condition: 'fog' }));
  assert.equal(pickLine('nowhere', 'traffic', rng), null);
  // with no slots at all, only slot-free lines come back
  for (let i = 0; i < 30; i++) { const l = pickLine('la-south', 'traffic', rng, {}); assert.ok(l && !/[{}]/.test(l.text)); }
});

test('slotsFor grounds every slot in the pack', () => {
  for (const zip of ['94110', '90022', '93301', '96150', '92262', '95501', '91401', '92109', '96001', '95814']) {
    const zi = world.indexOf(zip), key = dialectFor(world, zi);
    const { values, facts } = slotsFor(world, zi, { rng: new Rng(1) });
    for (const k of Object.keys(values)) assert.ok(SLOT_NAMES.includes(k), k);
    assert.ok(values.place && values.city && values.county && values.region && values.month && values.day && values.season, zip);
    assert.ok(Number.isFinite(values.temp), `${zip} temp`);
    assert.ok(values.road, `${zip} road`);
    if (DIALECTS[key].theShare === 1) assert.ok(values.road.startsWith('the ') || values.road === 'PCH', `${zip} ${values.road}`);
    if (DIALECTS[key].theShare === 0) assert.ok(!values.road.startsWith('the '), `${zip} ${values.road}`);
    assert.ok(roadNames(facts.road.slice(5), key).includes(values.road), `${zip} ${values.road}`);
    assert.equal(values.fire === null, values.year === null, `${zip} fire and year go together`);
    if (values.year) assert.match(values.year, /^\d{4}$/);
    if (values.fire) assert.ok(world.firesOf(zi).some(f => facts.fire === `fire:${f.name}:${f.year}`), zip);
    for (const t of templatesOf(DIALECTS[key])) { const s = fill(t, values); assert.ok(s === null || !/[{}]/.test(s)); }
  }
  assert.equal(slotsFor(world, '91401').values.place, 'Van Nuys');
  assert.equal(slotsFor(world, '90022').values.place, 'East Los Angeles');
  assert.equal(slotsFor(world, '96001').values.peak, 'Mount Shasta');
  assert.equal(slotsFor(world, '92262').values.region, 'the Coachella Valley');
  assert.equal(slotsFor(world, '00000'), null);
  assert.equal(landmarkLabel({ name: 'San Gabriel Mountains', kind: 'range' }), 'the San Gabriel Mountains');
  assert.equal(landmarkLabel({ name: 'Mount San Antonio', kind: 'peak' }), 'Mount Baldy');
  assert.equal(landmarkLabel({ name: 'Twin Peaks', kind: 'peak' }), 'Twin Peaks');
  assert.equal(landmarkLabel({ name: 'Salton Sea', kind: 'water' }), 'the Salton Sea');
  assert.equal(landmarkLabel(null), null);
});

test('weather conditions from forecasts and alerts', () => {
  assert.equal(weatherCondition({ now: { short: 'Patchy Fog', tempF: 52 }, alerts: [] }), 'fog');
  assert.equal(weatherCondition({ now: { short: 'Sunny', tempF: 104 }, alerts: [] }), 'heat');
  assert.equal(weatherCondition({ now: { short: 'Sunny', tempF: 85 }, alerts: [{ event: 'Excessive Heat Warning' }] }), 'heat');
  assert.equal(weatherCondition({ now: { short: 'Chance Rain Showers', tempF: 58 }, alerts: [] }), 'rain');
  assert.equal(weatherCondition({ now: { short: 'Mostly Sunny', tempF: 60 }, alerts: [{ event: 'Coastal Flood Warning' }] }), 'clear');
  assert.equal(weatherCondition({ now: { short: 'Sunny', tempF: 60 }, alerts: [{ event: 'Flash Flood Warning' }] }), 'rain');
  assert.equal(weatherCondition({ now: { short: 'Snow Showers', tempF: 28 }, alerts: [] }), 'snow');
  assert.equal(weatherCondition({ now: { short: 'Sunny', tempF: 70 }, alerts: [{ event: 'Red Flag Warning' }] }), 'wind');
  assert.equal(weatherCondition({ now: { short: 'Haze', tempF: 75 }, alerts: [{ event: 'Air Quality Alert' }] }), 'smoke');
  assert.equal(weatherCondition({ now: { short: 'Clear', tempF: 35 }, alerts: [] }), 'cold');
  assert.equal(weatherCondition({ now: { short: 'Mostly Cloudy', tempF: 60 }, alerts: [] }), null);
  assert.equal(weatherCondition(null), null);
  const c = weatherCondition(world.weatherAt(world.indexOf('96161')));
  assert.ok(c === null || WEATHER_CONDITIONS.includes(c));
});

test('dialect summaries for the Claude prompt', () => {
  for (const k of DIALECT_KEYS) {
    const s = dialectSummary(k);
    assert.ok(s.includes(DIALECTS[k].name) && s.length > 120, k);
  }
  assert.match(dialectSummary('la-westside'), /"the" before freeway numbers/);
  assert.match(dialectSummary('eastbay'), /no "the"/);
  assert.equal(dialectSummary('nowhere'), '');
});

// ------------------------------------------------------------------ languages

const REQUIRED_LANGUAGES = ['spanish', 'tagalog', 'vietnamese', 'korean', 'cantonese', 'mandarin', 'armenian', 'farsi', 'arabic', 'russian', 'ukrainian', 'punjabi', 'hindi', 'hmong', 'khmer', 'lao', 'japanese', 'portuguese', 'amharic', 'assyrian', 'samoan', 'tongan', 'dari', 'pashto'];
const SCRIPTS = { spanish: 'Latn', tagalog: 'Latn', vietnamese: 'Latn', korean: 'Hang', cantonese: 'Hant', mandarin: 'Hans', armenian: 'Armn', farsi: 'Arab', arabic: 'Arab', russian: 'Cyrl', ukrainian: 'Cyrl', punjabi: 'Guru', hindi: 'Deva', hmong: 'Latn', khmer: 'Khmr', lao: 'Laoo', japanese: 'Jpan', portuguese: 'Latn', amharic: 'Ethi', assyrian: 'Latn', samoan: 'Latn', tongan: 'Latn', dari: 'Arab', pashto: 'Arab' };

test('every language has the required fields, and every entry has text, a gloss and (off Latin) a romanization', () => {
  for (const k of REQUIRED_LANGUAGES) assert.ok(LANGUAGES[k], `missing ${k}`);
  assert.ok(LANGUAGE_KEYS.length >= REQUIRED_LANGUAGES.length);
  for (const [k, L] of Object.entries(LANGUAGES)) {
    assert.equal(L.key, k);
    assert.ok(L.name && L.native && L.script && L.notes, k);
    if (SCRIPTS[k]) assert.equal(L.script, SCRIPTS[k], k);
    for (const f of LANGUAGE_LIST_FIELDS) assert.ok(Array.isArray(L[f]), `${k}.${f}`);
    for (const f of ['greetings', 'howAreYou', 'thanks', 'farewells', 'yes', 'no']) assert.ok(L[f].length >= 1, `${k}.${f} is empty`);
    for (const ik of INTERJECTION_KINDS) assert.ok(Array.isArray(L.interjections[ik]), `${k} interjections.${ik}`);
    // Assyrian's bank is deliberately small: only phrases we are sure of.
    if (k !== 'assyrian') assert.ok(Object.values(L.interjections).some(a => a.length), `${k} has no interjections`);
    for (const r of ['mother', 'father', 'son', 'daughter', 'grandmother', 'grandfather']) assert.ok(L.family[r] && L.family[r].length, `${k}.family.${r}`);
    assert.ok(L.food.length >= 5, `${k} food`);
    for (const intent of Object.keys(L.phrases)) assert.ok(PHRASE_INTENTS.includes(intent), `${k} phrases.${intent}`);
    const entries = languageEntries(L);
    assert.ok(entries.length >= 30, `${k} has only ${entries.length} entries`);
    for (const [where, e] of entries) {
      assert.ok(typeof e.text === 'string' && e.text.trim(), `${k}.${where} text`);
      assert.ok(typeof e.gloss === 'string' && e.gloss.trim().length >= 2, `${k}.${where} "${e.text}" gloss`);
      if (L.script === 'Latn') assert.equal(e.roman, undefined, `${k}.${where}`);
      else {
        assert.ok(typeof e.roman === 'string' && e.roman.trim(), `${k}.${where} "${e.text}" roman`);
        assert.ok(!/[A-Za-z]/.test(e.text) || k === 'japanese', `${k}.${where} "${e.text}" mixes Latin into the script`);
        assert.ok(/^[\p{Script=Latin}\p{M}\p{Lm}\p{N}\p{P}\p{Zs}ʻʿʾ]+$/u.test(e.roman), `${k}.${where} roman "${e.roman}"`);
      }
      if (e.sex) assert.ok(e.sex === 'F' || e.sex === 'M');
      if (e.to) assert.ok(e.to === 'F' || e.to === 'M');
      if (e.region) for (const r of e.region) assert.ok(L.varieties[r], `${k} variety ${r}`);
      assert.ok(Object.isFrozen(e));
    }
  }
  for (const k of ['spanish', 'tagalog', 'vietnamese', 'korean', 'cantonese', 'mandarin', 'japanese', 'russian', 'hindi', 'farsi', 'arabic', 'portuguese', 'armenian', 'punjabi']) {
    assert.ok(languageEntries(LANGUAGES[k]).length >= 90, `${k} has ${languageEntries(LANGUAGES[k]).length} entries`);
  }
  // The big languages carry the full intent set (the religious ones only where culturally natural).
  for (const k of ['spanish', 'tagalog', 'vietnamese', 'korean', 'cantonese', 'mandarin', 'japanese', 'russian', 'hindi', 'farsi', 'arabic', 'portuguese']) {
    for (const intent of PHRASE_INTENTS.filter(i => !RELIGIOUS_INTENTS.includes(i))) assert.ok(LANGUAGES[k].phrases[intent] && LANGUAGES[k].phrases[intent].length, `${k}.phrases.${intent}`);
    for (const r of FAMILY_RELATIONS) assert.ok(LANGUAGES[k].family[r] && LANGUAGES[k].family[r].length, `${k}.family.${r}`);
  }
});

test('language specifics: voseo, Taglish, tone marks, hangul, Jyutping, both Armenians', () => {
  const S = LANGUAGES.spanish;
  assert.match(S.notes, /voseo/);
  const vos = [...S.howAreYou, ...S.farewells].filter(e => e.region && e.region.includes('sv'));
  assert.ok(vos.some(e => /vos|andás|hacés|Cuidate/.test(e.text)));
  assert.ok(LANGUAGES.tagalog.phrases.traffic_bad.some(e => /Taglish/.test(e.gloss)));
  assert.ok(LANGUAGES.vietnamese.thanks.some(e => e.text === 'Cảm ơn.'));
  assert.ok(languageEntries(LANGUAGES.vietnamese).filter(([, e]) => /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i.test(e.text)).length > 60);
  assert.ok(LANGUAGES.korean.greetings.some(e => e.text.startsWith('안녕하세요') && e.roman === 'annyeonghaseyo'));
  assert.ok(languageEntries(LANGUAGES.cantonese).every(([, e]) => /[1-6]/.test(e.roman)), 'every Jyutping has tone numbers');
  assert.ok(LANGUAGES.mandarin.thanks.some(e => e.roman === 'xièxie'));
  const arm = languageEntries(LANGUAGES.armenian).map(([, e]) => e);
  assert.ok(arm.some(e => e.region && e.region.includes('west')) && arm.some(e => e.region && e.region.includes('east')));
  assert.ok(LANGUAGES.hmong.greetings.some(e => e.text === 'Nyob zoo!'));
  assert.ok(LANGUAGES.punjabi.greetings.some(e => e.text === 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ'));
  assert.ok(LANGUAGES.assyrian.greetings.some(e => e.text === 'Shlama'));
  for (const k of ['arabic', 'farsi', 'dari', 'pashto', 'urdu', 'spanish', 'tagalog']) assert.ok(LANGUAGES[k].phrases.god_willing && LANGUAGES[k].phrases.god_willing.length, `${k} god_willing`);
});

test('codeSwitch picks a phrase for the speaker, or null', () => {
  const rng = new Rng(8);
  for (const k of LANGUAGE_KEYS) {
    const e = codeSwitch(k, 'thanks', rng, { sex: 'F', to: 'M' });
    assert.ok(e && e.text && e.gloss && e.lang === k && e.intent === 'thanks', k);
    if (LANGUAGES[k].script !== 'Latn') assert.ok(e.roman, k);
  }
  for (const intent of ['greeting', 'how_are_you', 'farewell', 'yes', 'no', 'surprise', 'delight', 'food', ...PHRASE_INTENTS]) {
    const e = codeSwitch('spanish', intent, rng, { sex: 'M', to: 'F' });
    if (intent === 'frustration') continue;
    assert.ok(e, intent);
  }
  assert.equal(codeSwitch('klingon', 'thanks', rng), null);
  assert.equal(codeSwitch('spanish', 'teleport', rng), null);
  assert.equal(codeSwitch('assyrian', 'traffic_bad', rng), null);
  // grammatical gender: only the forms that agree with the speaker
  for (let i = 0; i < 40; i++) {
    const f = codeSwitch('spanish', 'tired', rng, { sex: 'F' });
    assert.ok(f.text !== 'Estoy cansado.');
    const n = codeSwitch('spanish', 'tired', rng);
    assert.equal(n.text, '¡Qué cansancio!');
    const r = codeSwitch('russian', 'tired', rng, { sex: 'M' });
    assert.ok(r.text !== 'Я устала.');
  }
  // varieties: voseo only for Central American speakers; Mexican slang by default
  const sv = new Set(), def = new Set();
  for (let i = 0; i < 200; i++) {
    sv.add(codeSwitch('spanish', 'how_are_you', rng, { variety: 'sv' }).text);
    def.add(codeSwitch('spanish', 'how_are_you', rng).text);
  }
  assert.ok([...sv].some(t => /vos|andás|hacés/.test(t)));
  assert.ok(![...def].some(t => /vos|andás|hacés/.test(t)));
  assert.equal(varietyFor('spanish', 'salvadoran'), 'sv');
  assert.equal(varietyFor('portuguese', 'brazilian'), 'br');
  assert.equal(varietyFor('korean', 'korean'), null);
  // respect register avoids casual forms
  for (let i = 0; i < 50; i++) assert.notEqual(codeSwitch('korean', 'thanks', rng, { register: 'respect' }).register, 'casual');
  // deterministic for the same seed
  assert.deepEqual(codeSwitch('vietnamese', 'weather_hot', new Rng(3)), codeSwitch('vietnamese', 'weather_hot', new Rng(3)));
  // a Picker spreads choices without repeats
  const p = new Picker(2), texts = new Set();
  const n = LANGUAGES.japanese.farewells.length;
  for (let i = 0; i < n; i++) texts.add(codeSwitch('japanese', 'farewell', rng, { picker: p }).text);
  assert.equal(texts.size, n);
});

test('aliases resolve one speaker to one language', () => {
  assert.equal(resolveLanguage('Spanish'), 'spanish');
  assert.equal(resolveLanguage('filipino'), 'tagalog');
  assert.equal(resolveLanguage('persian'), 'farsi');
  assert.equal(resolveLanguage('cambodian'), 'khmer');
  assert.equal(resolveLanguage('nonsense'), null);
  assert.equal(resolveLanguage(''), null);
  const got = new Set();
  for (let s = 0; s < 200; s++) {
    const a = resolveLanguage('chinese', s);
    assert.equal(resolveLanguage('chinese', s), a);
    got.add(a);
  }
  assert.deepEqual([...got].sort(), ['cantonese', 'mandarin']);
  assert.equal(codeSwitch('chinese', 'thanks', new Rng(1), { seed: 7 }).lang, resolveLanguage('chinese', 7));
});

test('familyTerm, with aliases and speaker-dependent terms', () => {
  const rng = new Rng(4);
  assert.equal(familyTerm('tagalog', 'grandma', rng).text, 'lola');
  assert.equal(familyTerm('korean', 'older_brother', rng, { sex: 'F' }).text, '오빠');
  assert.equal(familyTerm('korean', 'older_brother', rng, { sex: 'M' }).roman, 'hyeong');
  assert.equal(familyTerm('korean', 'older_brother', rng), null);
  assert.ok(['ate'].includes(familyTerm('tagalog', 'older_sister', rng).text));
  for (const k of LANGUAGE_KEYS) {
    const e = familyTerm(k, 'mother', rng, { sex: 'F' });
    assert.ok(e && e.text && e.gloss && e.relation === 'mother', k);
  }
  assert.equal(familyTerm('spanish', 'cousin-in-law', rng), null);
  assert.equal(familyTerm('nowhere', 'mother', rng), null);
  const a = familyTerm('vietnamese', 'grandmother', new Rng(9)), b = familyTerm('vietnamese', 'grandmother', new Rng(9));
  assert.deepEqual(a, b);
});

test('the lexicon is fast enough for a 20 ms dialogue turn', () => {
  const rng = new Rng(1), picker = new Picker(1);
  const { values: slots, context } = slotsFor(world, world.indexOf('90044'));
  const t0 = performance.now();
  for (let i = 0; i < 2000; i++) {
    const speaker = { age: 20 + (i % 60), drives: i % 3 > 0, works: i % 4 > 0, tenure: i % 2 ? 'rent' : 'own' };
    pickLine('la-south', LINE_CATEGORIES[i % LINE_CATEGORIES.length], rng, { ...context, speaker, slots, picker });
    pickLine('la-south', 'weather', rng, { ...context, speaker, slots, picker });
    codeSwitch('spanish', PHRASE_INTENTS[i % PHRASE_INTENTS.length], rng, { sex: 'F', t: context.t, variety: 'sv' });
    slangFor('la-south', 20 + (i % 50), rng);
  }
  const per = (performance.now() - t0) / 2000;
  assert.ok(per < 0.5, `${per.toFixed(3)} ms per turn of lexicon work`);
});
