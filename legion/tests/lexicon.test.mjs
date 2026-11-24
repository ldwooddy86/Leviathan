import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadDefaultWorld } from '../src/engine/world.mjs';
import { Rng } from '../src/engine/rng.mjs';
import { atPacific } from '../src/engine/clock.mjs';
import {
  dialectFor, explainDialect, dialectTable, DIALECT_KEYS, DIALECTS, DIALECT_FAMILIES, LINE_CATEGORIES, WORD_CATEGORIES, WEATHER_CONDITIONS, AGE_CATEGORIES,
  roadName, roadNames, freewayName, namedStretch, stretchesNear, normalizeRoad, NAMED_STRETCHES, ROAD_USAGE, SURFACE_STREETS,
  ES_CATEGORIES, glossOf, insuranceLevel, INSURANCE_LEVELS,
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
      // a state route that is a surface street there goes by the street's name (fid-21), and only then
      const street = r.kind === 'SR' && SURFACE_STREETS.some(x => x.route === r.route && x.name === n && x.keys.includes(key));
      assert.ok(String(n).includes(String(r.route)) || n === 'PCH' || n === 'Business 80' || street, `${key} ${r.name} -> ${n}`);
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
  // Children get the plain lines, not teen slang.
  const child = linesFor('sf', 'agreement', { age: 9 });
  assert.ok(!child.includes('Hella.') && !child.includes('No cap.') && child.includes('For sure.'));
  assert.ok(!linesFor('fresno', 'greetings', { age: 2 }).includes('Sup.') && linesFor('fresno', 'greetings', { age: 15 }).includes('Sup.'));
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
  let temps = 0;
  for (const zip of ['94110', '90022', '93301', '96150', '92262', '95501', '91401', '92109', '96001', '95814']) {
    const zi = world.indexOf(zip), key = dialectFor(world, zi);
    const { values, facts } = slotsFor(world, zi, { rng: new Rng(1) });
    for (const k of Object.keys(values)) assert.ok(SLOT_NAMES.includes(k), k);
    assert.ok(values.place && values.city && values.county && values.region && values.month && values.day && values.season, zip);
    // the temperature is a slot for the ZIP's own forecast; an estimate (borrowed, climate) is not said flatly (decision 1)
    const wx = world.weatherAt(zi, world.snapshotTime);
    const own = !wx.stale && wx.approx !== true && !(wx.basis && wx.basis.kind && wx.basis.kind !== 'forecast');
    if (own) { assert.ok(Number.isFinite(values.temp), `${zip} temp`); temps++; } else assert.equal(values.temp, null, `${zip}: an estimate is not a {temp}`);
    assert.ok(values.road, `${zip} road`);
    if (DIALECTS[key].theShare === 1) assert.ok(values.road.startsWith('the ') || values.road === 'PCH', `${zip} ${values.road}`);
    if (DIALECTS[key].theShare === 0) assert.ok(!values.road.startsWith('the '), `${zip} ${values.road}`);
    assert.ok(roadNames(facts.road.slice(5), key).includes(values.road), `${zip} ${values.road}`);
    assert.equal(values.fire === null, values.year === null, `${zip} fire and year go together`);
    if (values.year) assert.match(values.year, /^\d{4}$/);
    if (values.fire) assert.ok(world.firesOf(zi).some(f => facts.fire === `fire:${f.name}:${f.year}`), zip);
    for (const t of templatesOf(DIALECTS[key])) { const s = fill(t, values); assert.ok(s === null || !/[{}]/.test(s)); }
  }
  assert.ok(temps >= 5, `${temps} of 10 ZIPs have their own forecast temperature`);
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

// ------------------------------------------------------------------ review regressions: teams

test('team lines are grammatical with the real team names of every dialect', () => {
  assert.equal(teamName('the Giants'), 'Giants');
  assert.equal(teamName('Fresno State'), 'Fresno State');
  assert.equal(teamName({ name: 'Dodgers', label: 'the Dodgers' }), 'Dodgers');
  assert.equal(teamName({ name: 'UCLA', label: 'UCLA football' }), 'UCLA');
  assert.equal(teamName(''), null);
  assert.equal(teamName(null), null);
  const bad = /\b(a|an|go|the) the\b|\b(a|an) (LAFC|UCLA|USC|UC|CSUB|UCSB)\b/i;
  let teamLines = 0;
  for (const k of DIALECT_KEYS) {
    const d = DIALECTS[k];
    assert.equal(d.teamNames.length, d.teams.length);
    const zi = dialectTable(world).indexOf(k);
    const { values } = slotsFor(world, zi);
    assert.equal(values.teamName, teamName(values.team), k);
    for (const t of templatesOf(d)) {
      if (!/\{team(Name)?\}/.test(t)) continue;
      teamLines++;
      // No indefinite article right before a team slot: "a LAFC game" and "a the Rams game" are both wrong.
      assert.ok(!/\b(a|an) \{team/i.test(t), `${k}: "${t}"`);
      for (const team of d.teams) {
        const s = fill(t, { ...values, team, teamName: teamName(team) });
        assert.ok(s && !bad.test(s), `${k} / ${team}: "${s}"`);
      }
    }
  }
  assert.ok(teamLines >= 20, `${teamLines} team lines`);
  // The review's case: a 30-turn Central LA conversation, with the Picker.
  const { values, context } = slotsFor(world, '90012');
  const picker = new Picker(5), rng = new Rng(5);
  for (let i = 0; i < 30; i++) {
    const l = pickLine('la-central', 'prideLines', rng, { ...context, slots: values, picker });
    assert.ok(l && !bad.test(l.text), l && l.text);
  }
  assert.equal(fill('Go {teamName}. Always.', slotsFor(world, '94110').values), `Go ${slotsFor(world, '94110').values.teamName}. Always.`);
});

// ------------------------------------------------------------------ review regressions: temperatures

const BAY = ['sf', 'eastbay', 'southbay', 'peninsula', 'northbay'];
// A temperature said with a named place is the speaker's own reading, so the place must be where every ZIP of
// the dialect is.
const TEMP_PLACES = [
  [/\bin the Valley\b/, ['sfv']], [/\b[Ii]n the Bay\b/, BAY], [/\bin the 559\b/, ['fresno']], [/\bin the IE\b/, ['ie']],
  [/\bin the SGV\b/, ['sgv']], [/\bin the SCV\b/, ['santa-clarita']], [/\bin the valley\b/, ['imperial']], [/\binland\b/, ['oc-inland']],
];
const PLACE_PHRASE = /\b(?:in|at|down in|by|east of|out in|over in)\s+(?:the\s+)?(?:[A-Z0-9]|valley\b|foothills\b|river\b|lake\b|beach\b|coast\b|desert\b|mountains\b)/;

test('a temperature is never put on a place the speaker does not live in', () => {
  let checked = 0;
  for (const k of DIALECT_KEYS) {
    for (const t of templatesOf(DIALECTS[k])) {
      if (!t.includes('{temp}')) continue;
      checked++;
      const rule = TEMP_PLACES.find(([re]) => re.test(t));
      if (rule) assert.ok(rule[1].includes(k), `${k} says "${t}"`);
      else assert.ok(!PLACE_PHRASE.test(t), `${k}: "${t}" puts the temperature on another place`);
    }
  }
  assert.ok(checked > 100);
  // The review's cases.
  for (const k of ['la-westside', 'la-central', 'la-eastside', 'sgv', 'longbeach', 'ventura']) assert.ok(!linesFor(k, 'weather', { condition: 'heat', ignoreTags: true }).includes('{temp} in the Valley. Of course.'), k);
  assert.ok(linesFor('sfv', 'weather', { condition: 'heat' }).includes('{temp} in the Valley. Of course.'));
  for (const k of DIALECT_KEYS) {
    const heat = linesFor(k, 'weather', { condition: 'heat', ignoreTags: true }).join('\n');
    assert.ok(!/\{temp\}[^\n]*\b(in Bako|in Palm Springs|in Anaheim|in East County|in the 916|down in the valley|downtown|east of the river|by the river|at the lake|in the foothills)\b/.test(heat), k);
  }
  // Statewide, with each ZIP's own situation on a hot July afternoon.
  const tab = dialectTable(world), july = atPacific(2026, 7, 20, 15, 0);
  for (let i = 0; i < world.N; i += 3) {
    const { values, context } = slotsFor(world, i, { t: july });
    for (const t of linesFor(tab[i], 'weather', { ...context, condition: 'heat' })) {
      const s = fill(t, { ...values, temp: 101 });
      if (!s || !s.includes('101')) continue;
      const rule = TEMP_PLACES.find(([re]) => re.test(t));
      if (rule) assert.ok(rule[1].includes(tab[i]), `${world.zips[i]} (${tab[i]}): "${s}"`);
    }
  }
});

// ------------------------------------------------------------------ review regressions: seasons and times

test('every line that names a season, month or holiday says when it is true, and its tags agree with it', () => {
  let n = 0;
  for (const k of DIALECT_KEYS) {
    for (const t of templatesOf(DIALECTS[k])) {
      if (!SEASONAL_RE.test(t) && !MONTH_RE.test(t)) continue;
      MONTH_RE.lastIndex = 0;
      n++;
      const g = lineTags(t);
      assert.ok(g && (g.months || g.flags.includes('anytime')), `${k}: "${t}" names a season or month without @m or @anytime`);
      if (!g.months) continue;
      const months = monthsNamed(t);
      if (months.length) assert.ok(months.some(m => g.months.includes(m)), `"${t}" is tagged ${g.months} but names ${months}`);
      const seasons = seasonsNamed(t);
      if (seasons.length) {
        const ok = new Set(seasons.flatMap(s => SEASON_MONTHS[s]));
        assert.ok(g.months.every(m => ok.has(m)), `"${t}" is tagged ${g.months} but names ${seasons}`);
      }
    }
  }
  assert.ok(n > 100, `${n} seasonal lines`);
});

test('for each month, no weather line names another month or season as the present one', () => {
  for (let month = 1; month <= 12; month++) {
    for (const k of DIALECT_KEYS) {
      for (const condition of WEATHER_CONDITIONS) {
        for (const coastKm of [1, 40]) {
          const lines = linesFor(k, 'weather', { ...ANY_SITUATION, condition, month, hour: 12, coastKm, county: 'Los Angeles' });
          for (const t of lines) {
            const g = lineTags(t);
            if (g && g.flags.includes('anytime')) continue;
            const seasons = seasonsNamed(t);
            if (seasons.length) assert.ok(seasons.some(s => SEASON_MONTHS[s].includes(month)), `${k} in month ${month}: "${t}"`);
            const months = monthsNamed(t);
            if (months.length) assert.ok(g && g.months && g.months.includes(month) && months.some(m => g.months.includes(m)), `${k} in month ${month}: "${t}"`);
          }
        }
      }
    }
  }
  // The review's cases, on the pack's own default time (the NWS snapshot, Nov 23).
  const { context: nov, values: novSlots } = slotsFor(world, '90028');
  const picker = new Picker(9), rng = new Rng(9);
  for (let i = 0; i < 200; i++) {
    for (const [k, condition] of [['la-central', 'fog'], ['sf', 'fog'], ['oc-coast', 'fog'], ['north-coast', 'fog'], ['monterey-bay', 'fog'], ['fresno', 'clear'], ['la-westside', 'clear']]) {
      const l = pickLine(k, 'weather', rng, { ...nov, condition, coastKm: 2, slots: { ...FULL_SLOTS, ...novSlots }, picker });
      assert.ok(l && !/June|May Gray|summer|August|It's \w+ and I'm wearing a puffer|Spring|blooming/i.test(l.text), `${k} in November: "${l && l.text}"`);
    }
  }
  const june = { t: atPacific(2026, 6, 10, 9, 0), condition: 'fog', coastKm: 3 };
  assert.ok(linesFor('la-central', 'weather', june).includes('June Gloom, every single day.'));
  assert.ok(linesFor('sf', 'weather', { ...june, t: atPacific(2026, 8, 3, 9, 0) }).includes("It's {month} and I'm wearing a puffer."));
  assert.equal(fill("It's {month} and I'm wearing a puffer.", slotsFor(world, '94110', { t: atPacific(2026, 8, 3, 9, 0) }).values), "It's August and I'm wearing a puffer.");
});

test('time-of-day lines and phrases only at that time of day', () => {
  const at = h => ({ month: 11, hour: h, condition: 'clear' });
  assert.ok(linesFor('fresno', 'greetings', at(8)).includes('Morning!'));
  for (const h of [13, 20, 23]) assert.ok(!linesFor('fresno', 'greetings', at(h)).some(t => /^(Good )?[Mm]orning/.test(t)), h);
  assert.ok(linesFor('fresno', 'greetings', at(19)).includes('Evening.'));
  assert.ok(!linesFor('fresno', 'farewells', at(9)).includes('Have a good night.'));
  assert.ok(linesFor('fresno', 'farewells', at(21)).includes('Have a good night.'));
  // A greeting that assumes the weather needs that weather, and so does chain control.
  assert.ok(!linesFor('ie', 'greetings', { ...at(9), condition: 'rain' }).includes("Hey, what's up? Hot enough for you?"));
  assert.ok(linesFor('ie', 'greetings', { ...at(9), condition: 'heat' }).includes("Hey, what's up? Hot enough for you?"));
  assert.ok(!linesFor('sierra-foothills', 'traffic', at(9)).includes('Chain control on {road} again.'));
  assert.ok(linesFor('sierra-foothills', 'traffic', { ...at(9), condition: 'snow' }).includes('Chain control on {road} again.'));
  // A Sacramento line stays in Sacramento.
  assert.ok(templatesOf(DIALECTS.sacramento).includes('I-5 through downtown backs up for no reason at all.'));
  assert.ok(!templatesOf(DIALECTS['valley-north']).includes('I-5 through downtown backs up for no reason at all.'));
  // Languages: "Buenos días" in the morning only, never without a time.
  const greet = o => phrasesFor('spanish', 'greeting', o).map(e => e.text);
  assert.ok(greet({ hour: 8 }).includes('Buenos días.') && !greet({ hour: 8 }).includes('Buenas noches.'));
  assert.ok(greet({ hour: 20 }).includes('Buenas noches.') && !greet({ hour: 20 }).includes('Buenos días.'));
  assert.ok(!greet({}).some(t => /^Buen/.test(t)) && greet({}).includes('¡Hola!'));
  const t9 = atPacific(2026, 11, 24, 9, 0);
  for (let i = 0; i < 40; i++) {
    const e = codeSwitch('japanese', 'greeting', new Rng(i), { t: t9 });
    assert.ok(e && e.text !== 'こんばんは。', e && e.text);
  }
  for (const L of Object.values(LANGUAGES)) for (const f of ['greetings', 'farewells']) for (const e of L[f]) if (e.time) assert.ok(TIMES_OF_DAY.includes(e.time));
});

// ------------------------------------------------------------------ review regressions: who can say a line

const PRESUPPOSITIONS = [
  [/\bmy (landlord|studio)\b|\bin rent\b|\bmy (second )?rent\b/i, 'rents'],
  [/\bmy homeowner|\bmy gutters\b/i, 'owns'],
  [/\bmy paycheck\b|\bnear work\b|\bafter work\b|\blong shift\b|\bby the office\b|\bjump on a call\b|\bmy commute\b|\bbefore work\b|\b(up|each way) to work\b/i, 'works'],
  [/\bmy kids\b/i, 'parent'],
  [/\bborn and raised\b|\braised me\b|\bI grew up with\b/i, 'native'],
  [/\bfor generations\b/i, 'rooted'],
  [/\b(took me\b|I left early|I left at|my car\b|my steering wheel|scrape|took the long way|took surface streets|took the toll road|I'm avoiding|side streets over|chains in the trunk|find a spot|my headlights)/i, 'drives'],
];
const ADULT_NEEDS = ['drives', 'works', 'owns', 'rents', 'parent', 'adult'];

test('lines that presuppose something about the speaker are tagged with it', () => {
  for (const [line, tags] of taggedLines()) for (const n of tags.needs) assert.ok(SPEAKER_NEEDS[n], `${line}: ${n}`);
  for (const k of DIALECT_KEYS) {
    for (const t of templatesOf(DIALECTS[k])) {
      for (const [re, need] of PRESUPPOSITIONS) {
        if (re.test(t)) assert.ok((lineTags(t) || { needs: [] }).needs.includes(need), `${k}: "${t}" needs @${need}`);
      }
    }
  }
});

test('a nine-year-old renter never gets a grown-up line, and an immigrant never claims to be born here', () => {
  const kid = { age: 9, tenure: 'rent' };
  for (const k of DIALECT_KEYS) {
    for (const c of [...LINE_CATEGORIES, 'weather']) {
      for (const condition of c === 'weather' ? WEATHER_CONDITIONS : [null]) {
        for (const t of linesFor(k, c, { ...ANY_SITUATION, condition, month: 7, hour: 12, coastKm: 1, speaker: kid })) {
          const g = lineTags(t);
          assert.ok(!g || !g.needs.some(n => ADULT_NEEDS.includes(n)), `${k}.${c}: a 9-year-old says "${t}"`);
        }
      }
    }
    // Every dialect still has something a child can complain about and be proud of.
    assert.ok(linesFor(k, 'complaintLines', { speaker: kid }).length >= 3, `${k} kid complaints`);
    assert.ok(linesFor(k, 'prideLines', { speaker: kid }).length >= 5, `${k} kid pride`);
  }
  // The review's case: complaint lines for a Westside nine-year-old.
  const rng = new Rng(3);
  for (let i = 0; i < 300; i++) {
    const l = pickLine('la-westside', 'complaintLines', rng, { age: 9, tenure: 'rent' });
    assert.ok(l && !/paycheck|homeowner|my car|landlord|rent|afford|insurance|parking/i.test(l.text), l && l.text);
  }
  const arrived2019 = { age: 40, nativeHere: false, generation: 1, tenure: 'rent', drives: true, works: true };
  for (const k of DIALECT_KEYS) {
    for (const t of linesFor(k, 'prideLines', { ...ANY_SITUATION, county: 'Los Angeles', speaker: arrived2019 })) {
      assert.ok(!/born and raised|raised me|for generations|I grew up/i.test(t), `${k}: an immigrant says "${t}"`);
    }
  }
  // A renter is never handed a homeowner's line; a retiree who no longer drives no driving or work lines.
  assert.ok(!linesFor('la-westside', 'complaintLines', { tenure: 'rent' }).includes("My homeowner's insurance went up again."));
  assert.ok(linesFor('la-westside', 'complaintLines', { tenure: 'own' }).includes("My homeowner's insurance went up again."));
  const retiree = { age: 74, drives: false, works: false, tenure: 'own', parent: false };
  for (const t of linesFor('fresno', 'traffic', { ...ANY_SITUATION, month: 8, hour: 9, speaker: retiree }).concat(linesFor('fresno', 'complaintLines', { speaker: retiree }))) {
    const g = lineTags(t);
    assert.ok(!g || !g.needs.some(n => ['drives', 'works', 'rents', 'parent'].includes(n)), t);
  }
  // Boyle Heights is not where La Mirada grew up: the line names the speaker's own place.
  assert.ok(!templatesOf(DIALECTS['la-eastside']).includes('Boyle Heights raised me.'));
  assert.equal(fill(linesFor('la-eastside', 'prideLines', { nativeHere: true }).find(t => /raised me/.test(t)), slotsFor(world, '90638').values), "La Mirada raised me, and I'll never forget it.");
});

test('speakerFacts reads the NPC record and the persona', () => {
  const kid = speakerFacts({ age: 9, role: 'child', m: 2, status: 'child', household: { tenure: 'rent', vehicles: 2, members: [] }, nativity: 'native', generation: 2 });
  assert.deepEqual(kid, { age: 9, drives: false, works: false, tenure: null, parent: false, generation: 2 });
  const members = [{ m: 0, role: 'householder', age: 41 }, { m: 1, role: 'spouse', age: 39 }, { m: 2, role: 'child', age: 7 }];
  const mom = speakerFacts({ age: 39, role: 'spouse', m: 1, status: 'employed', occupation: { key: 'healthtech' }, commute: { mode: 'drive' }, household: { tenure: 'own', vehicles: 2, members }, nativity: 'foreign', generation: 1 });
  assert.deepEqual(mom, { age: 39, drives: true, works: true, tenure: 'own', parent: true, nativeHere: false, generation: 1 });
  const roommate = speakerFacts({ age: 27, role: 'roommate', m: 3, status: 'employed', commute: { mode: 'rail' }, household: { tenure: 'own', vehicles: 0, members } }, { residence: { grewUpHere: true } });
  assert.deepEqual(roommate, { age: 27, drives: false, works: true, tenure: 'rent', parent: false, nativeHere: true });
  const grandpa = speakerFacts({ age: 78, role: 'parent', m: 4, status: 'retired', household: { tenure: 'own', vehicles: 2, members } }, { residence: { grewUpHere: false } });
  assert.deepEqual(grandpa, { age: 78, drives: true, works: false, tenure: null, parent: false, nativeHere: false });
  assert.deepEqual(speakerFacts(null), {});
  // Facts left out stay out, so an adult with an unknown car still fits a driving line.
  assert.ok(lineFits('Took me forty minutes to go five miles on {road}.', { age: 40 }));
  assert.ok(!lineFits('Took me forty minutes to go five miles on {road}.', { age: 40, drives: false }));
  assert.ok(!lineFits('Took me forty minutes to go five miles on {road}.', { age: 12 }));
});

// ------------------------------------------------------------------ the tag grammar

test('line tags parse strictly and are checked against the situation', () => {
  const p = parseTagged('@m11-2 @h20-3 @wx:fog,rain @alert:frost @coast @county:San_Luis_Obispo|Fresno @drives Cold night on {road}.');
  assert.equal(p.text, 'Cold night on {road}.');
  assert.deepEqual([...p.tags.months], [11, 12, 1, 2]);
  assert.deepEqual([...p.tags.hours], [20, 21, 22, 23, 0, 1, 2, 3]);
  assert.deepEqual([...p.tags.wx], ['fog', 'rain']);
  assert.deepEqual([...p.tags.alerts], ['frost']);
  assert.deepEqual([...p.tags.counties], ['San Luis Obispo', 'Fresno']);
  assert.deepEqual([...p.tags.flags], ['coast']);
  assert.deepEqual([...p.tags.needs], ['drives']);
  assert.deepEqual(parseTagged('Plain line.'), { text: 'Plain line.', tags: null });
  for (const bad of ['@m13 Bad month.', '@h24 Bad hour.', '@wx:hail Bad weather.', '@alert:tsunami Bad alert.', '@nonsense Bad tag.', '@m6', '@coast @inland Both.']) {
    assert.throws(() => parseTagged(bad), /lexicon/, bad);
  }
  registerLine('Test line for the registry.', null);
  assert.throws(() => registerLine('Test line for the registry.', parseTagged('@drives Test line for the registry.').tags), /different tags/);
  assert.ok(ALERT_KINDS.includes('redflag') && ALERT_KINDS.includes('flashflood'));
  // Unknown situation leaves situational lines out; t gives the month and hour in Pacific time.
  const june9 = situationOf({ t: atPacific(2026, 6, 10, 9, 30) });
  assert.equal(june9.month, 6);
  assert.equal(june9.hour, 9);
  assert.ok(!lineFits('June Gloom, every single day.', {}));
  assert.ok(lineFits('June Gloom, every single day.', { t: atPacific(2026, 6, 10, 9, 30) }));
  assert.ok(!lineFits('Flash flood warning. Stay out of the washes.', { alerts: ['Coastal Flood Warning'] }));
  assert.ok(lineFits('Flash flood warning. Stay out of the washes.', { alerts: [{ event: 'Flash Flood Warning' }] }));
  assert.ok(!lineFits('909 forever.', { county: 'Riverside' }) && lineFits('909 forever.', { slots: { county: 'San Bernardino' } }));
  assert.ok(!lineFits('Clear enough to see Catalina from the beach.', {}) && lineFits('Clear enough to see Catalina from the beach.', { coastKm: 3 }));
  assert.ok(!lineFits('Clear enough to see Catalina from the beach.', { coastKm: 25 }));
});

test('Santa Ana, Diablo and sundowner lines only when the forecast has offshore winds', () => {
  const santaAna = "Santa Anas are blowing. Everybody's nervous.";
  assert.ok(linesFor('la-central', 'weather', { condition: 'wind', ignoreTags: true }).includes(santaAna));
  assert.ok(!linesFor('la-central', 'weather', { condition: 'wind' }).includes(santaAna));
  assert.ok(!linesFor('la-central', 'weather', { condition: 'wind', offshore: false }).includes(santaAna));
  assert.ok(linesFor('la-central', 'weather', { condition: 'wind', offshore: true }).includes(santaAna));
  const z = { off_kind: 'sa' };
  const wx = (detail, alerts = []) => ({ period: { detail }, alerts });
  assert.equal(offshoreWind(wx('Sunny. Northeast wind 15 to 25 mph, with gusts as high as 45 mph.'), z), 'santa_ana');
  assert.equal(offshoreWind(wx('Sunny. North northeast wind 10 to 15 mph.'), { off_kind: 'di' }), 'diablo');
  assert.equal(offshoreWind(wx('Clear. North wind 20 mph.'), { off_kind: 'su' }), 'sundowner');
  assert.equal(offshoreWind(wx('Rain. South southeast wind 18 to 23 mph, with gusts as high as 39 mph.', [{ event: 'Wind Advisory' }]), z), null);
  assert.equal(offshoreWind(wx('Sunny. North wind around 5 mph.'), z), null);
  assert.equal(offshoreWind(wx('Sunny. North wind around 5 mph.', [{ event: 'Red Flag Warning' }]), z), 'santa_ana');
  assert.equal(offshoreWind(wx('Northeast wind 20 mph.'), { off_kind: '' }), null);
  // At the pack's snapshot the wind is a southerly storm: nobody says Santa Ana.
  for (let i = 0; i < world.N; i += 5) assert.equal(slotsFor(world, i).context.offshore, false, world.zips[i]);
});

test('slotsFor gives the situation lines are checked against', () => {
  const { values, context } = slotsFor(world, '94110');
  assert.equal(context.t, world.snapshotTime);
  assert.equal(context.month, 11);
  assert.ok(Number.isInteger(context.hour));
  assert.equal(context.condition, weatherCondition(world.weatherAt(world.indexOf('94110'), world.snapshotTime)));
  assert.ok(Array.isArray(context.alerts) && context.alerts.every(a => typeof a === 'string'));
  assert.ok(context.coastKm >= 0 && context.coastKm < 10);
  assert.equal(context.county, 'San Francisco');
  assert.equal(values.county, 'San Francisco');
  const withTeam = slotsFor(world, '90012', { team: { name: 'Dodgers', label: 'the Dodgers' } }).values;
  assert.equal(withTeam.team, 'the Dodgers');
  assert.equal(withTeam.teamName, 'Dodgers');
  // An ordinary afternoon still leaves every dialect plenty to say, in its most populous ZIP.
  const tab = dialectTable(world), biggest = {};
  for (let i = 0; i < world.N; i++) if (biggest[tab[i]] === undefined || world.zip(i).pop > world.zip(biggest[tab[i]]).pop) biggest[tab[i]] = i;
  for (const k of DIALECT_KEYS) {
    const zi = biggest[k];
    const s = slotsFor(world, zi);
    const adult = { ...s.context, speaker: { age: 45, drives: true, works: true, tenure: 'own', parent: true } };
    for (const [c, min] of [['greetings', 12], ['farewells', 12], ['prideLines', 15], ['complaintLines', 15], ['food', 10], ['agreement', 12], ['surprise', 12]]) {
      assert.ok(linesFor(k, c, adult).length >= min, `${k}.${c}: ${linesFor(k, c, adult).length}`);
    }
    assert.ok(linesFor(k, 'traffic', adult).filter(t => fill(t, s.values)).length >= 12, `${k} traffic`);
    for (const condition of WEATHER_CONDITIONS) assert.ok(linesFor(k, 'weather', { ...adult, condition }).length >= 5, `${k}.weather.${condition}`);
  }
});

test('fillers and intensifiers come back as they go mid-sentence', () => {
  const rng = new Rng(2), picker = new Picker(2);
  for (const c of WORD_CATEGORIES) {
    for (let i = 0; i < 40; i++) {
      const l = pickLine('eastbay', c, rng, { age: 19, picker });
      assert.ok(l && l.text === l.template && !/^[A-Z]/.test(l.text.replace(/^I\b/, 'i')), `${c}: "${l && l.text}"`);
    }
  }
  assert.ok(DIALECTS.eastbay.intensifiers.includes('hella'));
  assert.equal(fill('hella', {}, { capitalize: false }), 'hella');
  assert.equal(fill('hella', {}), 'Hella');
  const line = pickLine('eastbay', 'agreement', rng, { age: 19 });
  assert.match(line.text, /^[A-Z]/);
});

// ------------------------------------------------------------------ review regressions: languages

const MX_ONLY = e => e.region && e.region.length === 1 && e.region[0] === 'mx';

function sayable(lang, opts) {
  const out = [];
  for (const intent of ['greeting', 'how_are_you', 'thanks', 'farewell', 'yes', 'no', ...INTERJECTION_KINDS, 'affection', 'polite', 'food', ...PHRASE_INTENTS]) {
    out.push(...phrasesFor(lang, intent, { hour: 9, ...opts }), ...phrasesFor(lang, intent, { hour: 21, ...opts }));
  }
  const L = LANGUAGES[lang];
  for (const rel of Object.keys(L.family)) for (let i = 0; i < 12; i++) { const e = familyTerm(lang, rel, new Rng(i), opts); if (e) out.push(e); }
  return out;
}

test('Spanish speakers who are not Mexican never get Mexican regionalisms', () => {
  const heritages = { cuban: 'cu', puertorican: 'pr', dominican: 'do', southamerican: 'sa', spanish: 'es', salvadoran: 'sv', guatemalan: 'gt', honduran: 'hn', nicaraguan: 'ni', mexican: 'mx' };
  for (const [h, v] of Object.entries(heritages)) {
    assert.equal(varietyFor('spanish', h), v, h);
    assert.ok(LANGUAGES.spanish.varieties[v], v);
    const said = sayable('spanish', { variety: varietyFor('spanish', h), sex: 'F', to: 'M' });
    assert.ok(said.length > 60, h);
    for (const e of said) if (e.region) assert.ok(e.region.includes(v), `${h} says ${e.text}`);
    if (h !== 'mexican') assert.ok(!said.some(MX_ONLY), `${h} gets a Mexican-only phrase`);
  }
  // The review's case: a Cuban grandmother over many picks.
  const rng = new Rng(4);
  for (let i = 0; i < 400; i++) {
    for (const intent of ['yes', 'no', 'greeting', 'surprise', 'frustration', 'delight', 'welcome', 'busy']) {
      const e = codeSwitch('spanish', intent, rng, { variety: varietyFor('spanish', 'cuban'), sex: 'F', register: 'respect' });
      if (e) assert.ok(!['¡No manches!', 'Órale.', '¡Órale!', 'Simón.', 'Nel.', '¡Qué chido!', 'Pásale.'].includes(e.text), e.text);
    }
  }
  // 'latino' (origin not given) gets the shared Spanish, unless the birthplace says more; null means exactly that.
  assert.equal(varietyFor('spanish', 'latino'), null);
  assert.equal(varietyFor('spanish', 'latino', { birthplace: 'Guadalajara, Jalisco' }), 'mx');
  assert.equal(varietyFor('spanish', 'latino', { birthplace: 'Lima, Peru' }), 'sa');
  assert.ok(sayable('spanish', { variety: null }).every(e => !e.region));
  assert.ok(sayable('spanish', {}).some(MX_ONLY), 'with no variety given, California Spanish defaults to Mexican');
  // Other languages' varieties from the birthplace.
  assert.equal(varietyFor('armenian', 'armenian'), 'east');
  assert.equal(varietyFor('armenian', 'armenian', { birthplace: 'Beirut, Lebanon' }), 'west');
  assert.equal(varietyFor('portuguese', 'portuguese', { birthplace: 'São Paulo, Brazil' }), 'br');
  assert.equal(varietyFor('portuguese', 'portuguese', { birthplace: 'Ponta Delgada, Azores' }), 'pt');
  assert.equal(varietyFor('korean', 'korean'), null);
  assert.equal(varietyFor('nonsense', 'mexican'), null);
});

test('God-willing means God willing; thanks to God and blessings have their own intents', () => {
  for (const intent of RELIGIOUS_INTENTS) assert.ok(PHRASE_INTENTS.includes(intent));
  for (const [k, L] of Object.entries(LANGUAGES)) {
    for (const e of L.phrases.god_willing || []) assert.match(e.gloss, /God willing|if God|hopefully|God grant/i, `${k}: ${e.text} (${e.gloss})`);
    for (const e of L.phrases.thank_god || []) assert.match(e.gloss, /thank|thanks|grace|mercy/i, `${k}: ${e.text} (${e.gloss})`);
    for (const e of L.phrases.blessing || []) assert.match(e.gloss, /bless|admiration/i, `${k}: ${e.text} (${e.gloss})`);
  }
  assert.equal(LANGUAGES.samoan.phrases.god_willing, undefined);
  assert.equal(LANGUAGES.tongan.phrases.god_willing, undefined);
  for (const k of ['arabic', 'urdu', 'dari', 'pashto', 'russian', 'ukrainian', 'portuguese', 'tagalog', 'hindi', 'spanish']) assert.ok(LANGUAGES[k].phrases.thank_god.length, `${k} thank_god`);
  // The review's case: hoping the rain holds off never comes out as "Thank God" or mashallah.
  const rng = new Rng(6);
  for (let i = 0; i < 300; i++) {
    for (const k of ['arabic', 'urdu', 'dari', 'pashto', 'amharic', 'russian', 'ukrainian', 'portuguese', 'punjabi', 'hindi', 'tagalog', 'samoan', 'tongan']) {
      const e = codeSwitch(k, 'god_willing', rng, { faith: 'christian' });
      if (e) assert.match(e.gloss, /God willing|if God|hopefully|God grant/i, `${k}: ${e.text}`);
    }
  }
  assert.equal(codeSwitch('samoan', 'god_willing', rng), null);
  assert.ok(codeSwitch('samoan', 'blessing', rng));
});

test('faith formulas only for a speaker of that faith', () => {
  for (const L of Object.values(LANGUAGES)) for (const [, e] of languageEntries(L)) if (e.faith) assert.ok(FAITHS.includes(e.faith), e.text);
  assert.equal(faithFor('sikh'), 'sikh');
  for (const h of ['pakistani', 'indian', 'arab', 'ethiopian', 'mexican', 'afghan']) assert.equal(faithFor(h), null, h);
  assert.equal(varietyFor('punjabi', 'pakistani'), 'pk');
  assert.equal(varietyFor('punjabi', 'sikh'), 'in');
  assert.equal(varietyFor('punjabi', 'indian'), 'in');
  const SIKH_OR_HINDU = /ਸਤ ਸ੍ਰੀ ਅਕਾਲ|ਨਮਸਤੇ|ਵਾਹਿਗੁਰੂ|ਲੰਗਰ/;
  // A Pakistani-heritage Punjabi speaker, Muslim or of unknown faith, never gets Sikh or Hindu formulas.
  for (const faith of [null, 'muslim']) {
    const said = sayable('punjabi', { variety: varietyFor('punjabi', 'pakistani'), faith, sex: 'M' });
    assert.ok(said.length > 40);
    assert.ok(!said.some(e => SIKH_OR_HINDU.test(e.text)), `faith ${faith}`);
    assert.ok(said.some(e => e.text === 'ਸਲਾਮ'));
  }
  // A Hindu Punjabi speaker gets no Sikh formula; a Sikh speaker gets Sat Sri Akal and no Namaste.
  const hindu = sayable('punjabi', { variety: 'in', faith: 'hindu' }).map(e => e.text);
  assert.ok(hindu.includes('ਨਮਸਤੇ') && !hindu.some(t => /ਸਤ ਸ੍ਰੀ ਅਕਾਲ|ਵਾਹਿਗੁਰੂ/.test(t)));
  const sikh = sayable('punjabi', { variety: varietyFor('punjabi', 'sikh'), faith: faithFor('sikh') }).map(e => e.text);
  assert.ok(sikh.includes('ਸਤ ਸ੍ਰੀ ਅਕਾਲ') && sikh.some(t => /ਵਾਹਿਗੁਰੂ/.test(t)) && !sikh.includes('ਨਮਸਤੇ'));
  // Without a faith, no Punjabi speaker is handed any religious greeting.
  assert.equal(codeSwitch('punjabi', 'greeting', new Rng(1), { variety: 'in' }), null);
  // Amharic Egziabher phrases are Christian; Arabic as-salāmu ʿalaykum is Muslim.
  assert.ok(!sayable('amharic', {}).some(e => /እግዚአብሔር/.test(e.text)));
  assert.ok(sayable('amharic', { faith: 'christian' }).some(e => /እግዚአብሔር/.test(e.text)));
  assert.ok(!sayable('arabic', {}).some(e => e.text === 'السلام عليكم'));
  assert.ok(sayable('arabic', { faith: 'muslim' }).some(e => e.text === 'السلام عليكم'));
});

test('Assyrian entries are the attested forms', () => {
  const A = LANGUAGES.assyrian;
  assert.deepEqual(A.howAreYou.map(e => [e.text, e.to]), [['Dakhi wit?', 'M'], ['Dakhi wat?', 'F']]);
  assert.ok(A.farewells.some(e => e.text === 'Push bshena'));
  assert.ok(!languageEntries(A).some(([, e]) => /\bwita\b|\bPash\b/.test(e.text)));
  for (let i = 0; i < 20; i++) assert.equal(codeSwitch('assyrian', 'how_are_you', new Rng(i), { to: 'F' }).text, 'Dakhi wat?');
});

// ---------------------------------------------------------------- final review fixes

test('Spanish regional lines: 12+ per Spanish-heavy family, glossed, tagged, through linesFor and pickLine (exp-66)', () => {
  const families = { la: 'la-eastside', ie: 'ie', sd: 'sd-inland', sjv: 'fresno', cc: 'salinas', bay: 'eastbay', desert: 'desert-cv' };
  const all = d => [...ES_CATEGORIES.flatMap(c => d.es[c]), ...WEATHER_CONDITIONS.flatMap(w => d.es.weather[w])];
  for (const [family, key] of Object.entries(families)) {
    assert.equal(DIALECTS[key].family, family);
    const lines = all(DIALECTS[key]);
    assert.ok(lines.length >= 12, `${family}: ${lines.length} Spanish lines`);
    for (const t of lines) {
      const g = glossOf(t);
      assert.ok(g && g !== t, `${t} has an English gloss`);
      assert.deepEqual(templateSlots(t).sort(), templateSlots(g).sort(), `same slots: ${t}`);
      // a stranger and a friend alike: no tú or usted, no faith formulas, no brands
      assert.ok(!/(?<!\p{L})(tú|usted|te|ti|contigo|Dios)(?!\p{L})|bendig/iu.test(t), `neutral to the listener: ${t}`);
      assert.deepEqual(findBrands(t), [], t);
      assert.ok(/[a-záéíóúñ]/i.test(t) && !/\{(road|team|teamName|fire|weather|month|day|season|region|stretch|alert|peak|landmark)\}/.test(t), `only names and numbers as slots: ${t}`);
    }
    for (const cat of ES_CATEGORIES) assert.ok(DIALECTS[key].es[cat].length >= 1, `${family} ${cat}`);
  }
  const rng = new Rng(9);
  const hit = pickLine('la-eastside', 'prideLines', rng, { lang: 'es', slots: { neighborhood: 'Boyle Heights' }, age: 40, county: 'Los Angeles' });
  assert.ok(hit && hit.lang === 'es' && hit.gloss && !/\{/.test(hit.text + hit.gloss), JSON.stringify(hit));
  const fog = linesFor('fresno', 'weather', { lang: 'es', condition: 'fog', month: 12 });
  assert.ok(fog.some(t => /neblina/.test(t)));
  assert.deepEqual(linesFor('fresno', 'weather', { lang: 'es', condition: 'fog', month: 7 }).filter(t => /neblina/.test(t) && lineTags(t)), [], 'tule fog lines keep their months');
  // the tags hold for Spanish as for English: a child does not complain about rent, a non-driver about the freeway
  for (const t of linesFor('la-eastside', 'complaintLines', { lang: 'es', age: 9 })) assert.ok(!/renta/.test(t), t);
  for (const t of linesFor('la-eastside', 'traffic', { lang: 'es', drives: false, age: 40 })) assert.ok(!/Agarré el freeway/.test(t), t);
  // English stays English, and there are no Spanish greetings to mix up with the engine's own
  assert.ok(pickLine('fresno', 'food', rng, { age: 40 }).gloss === undefined);
  assert.deepEqual(linesFor('fresno', 'greetings', { lang: 'es' }), []);
  // a dialect with no Spanish bank gives nothing, not English
  assert.deepEqual(linesFor('tahoe', 'food', { lang: 'es' }), []);
});

test('lines that state a fact about insurance play only where the data says so (fid-19)', () => {
  const eureka = slotsFor(world, '95501').context;
  assert.equal(eureka.insurance, 'normal', JSON.stringify(eureka));
  const lines = linesFor('north-coast', 'complaintLines', Object.assign({}, eureka, { age: 50 }));
  assert.ok(!lines.some(t => /insurance/i.test(t) && /impossible|out of reach|won't|don't want/i.test(t)), lines.join(' | '));
  const paradise = slotsFor(world, '95969').context;
  assert.equal(paradise.insurance, 'high');
  assert.ok(INSURANCE_LEVELS.includes('high'));
  assert.equal(insuranceLevel({ fair_sh: 9, nonren_sh: 3 }), 'high');
  assert.equal(insuranceLevel({ fair_sh: 1.7, nonren_sh: 7.4 }), 'normal');
  assert.equal(insuranceLevel({}), null);
  for (const [t, tags] of taggedLines()) if (/insurance/i.test(t) && /impossible|out of reach|won't write|don't want to cover|pulling out|forget it/i.test(t)) assert.equal(tags.ins, 'high', t);
});

test('greetings that presuppose an acquaintance are kept for someone the NPC has met (exp-74)', () => {
  const acquainted = /\b(back in town|haven'?t seen you|how'?s the family|long time|you made it|still living|good to see you|how was the drive|you survived|how'?s everybody|you'?re back)\b/i;
  for (const key of DIALECT_KEYS) {
    const d = DIALECTS[key];
    for (const g of [...d.greetings, ...(d.youth.greetings || []), ...(d.elder.greetings || [])]) {
      if (acquainted.test(g)) assert.ok((lineTags(g) || { flags: [] }).flags.includes('met'), `${key}: "${g}" needs @met`);
    }
    for (const g of linesFor(key, 'greetings', { age: 40 })) assert.ok(!acquainted.test(g), `${key}: a stranger hears "${g}"`);
  }
  assert.ok(linesFor('valley-north', 'greetings', { age: 40, met: true }).some(g => acquainted.test(g)));
});

test('valley-north and Sacramento-family traffic lines name only the routes of their counties (exp-75)', () => {
  const routeLine = /\b(80|50|70|99)\b/;
  // every line a valley-north speaker can draw (their own, the Sacramento Valley family's, the statewide bank)
  for (const key of ['valley-north']) {
    for (const t of DIALECTS[key].traffic) {
      if (!routeLine.test(t) || /\{road\}/.test(t)) continue;
      assert.ok((lineTags(t) || {}).counties, `${key}: "${t}" names a route and needs a county`);
    }
  }
  const yubaCity = slotsFor(world, '95993').context, chico = slotsFor(world, '95926').context, redding = slotsFor(world, '96001').context;
  for (const ctx of [yubaCity, chico, redding]) {
    const lines = linesFor('valley-north', 'traffic', Object.assign({}, ctx, { age: 40, drives: true }));
    assert.ok(!lines.some(t => /\b80\b|up 50\b/.test(t)), `${ctx.county}: ${lines.join(' | ')}`);
  }
  assert.ok(!linesFor('valley-north', 'traffic', Object.assign({}, redding, { age: 40, drives: true })).some(t => /^99 between|^70 down/.test(t)));
});

test('state routes that are city streets go by their street names (fid-21)', () => {
  const sr = route => ({ name: `SR ${route}`, route, kind: 'SR' });
  assert.equal(roadName(sr(39), 'oc-inland'), 'Beach Boulevard');
  assert.equal(roadName(sr(82), 'peninsula'), 'El Camino Real');
  assert.equal(roadName(sr(72), 'la-eastside'), 'Whittier Boulevard');
  assert.equal(roadName(sr(213), 'southbay-la'), 'Western Avenue');
  assert.equal(roadName(sr(123), 'eastbay'), 'San Pablo Avenue');
  assert.equal(roadName({ name: 'I-405', route: 405, kind: 'I' }, 'la-westside'), 'the 405');
  assert.equal(roadName(sr(99), 'fresno'), '99');
  assert.equal(roadName(sr(39), 'fresno'), 'Highway 39', 'only where the route is that street');
  for (const x of SURFACE_STREETS) for (const k of x.keys) assert.ok(DIALECT_KEYS.includes(k), `${x.name}: ${k}`);
});

test('slots: the neighborhood the pack names, roads from the home, no flat temperature for an estimate', () => {
  const zi = world.indexOf('94110');
  const z = world.zip(zi);
  const sl = slotsFor(world, zi);
  assert.equal(sl.values.neighborhood, z.neighborhood || sl.values.place);
  // a home far from the town point gets the roads near it
  const home = { x: z.tx + 30 / world.unitKm, y: z.ty };
  const far = slotsFor(world, zi, { home });
  assert.ok(far.values.road === null || far.facts.road !== sl.facts.road || world.roadsNear(home.x, home.y, 15).length > 0);
  // a temperature is a slot only when it is the ZIP's own forecast
  const stale = slotsFor(world, zi, { t: world.snapshotTime + 30 * 86400000 });
  assert.equal(stale.values.temp, null, 'past the forecast the temperature is an estimate: no "It\'s {temp}" line');
  const now = slotsFor(world, zi, { t: world.snapshotTime });
  const wx = world.weatherAt(zi, world.snapshotTime);
  if (!wx.approx && !(wx.basis && wx.basis.kind !== 'forecast')) assert.equal(now.values.temp, Math.round(wx.now.tempF));
  else assert.equal(now.values.temp, null);
});
