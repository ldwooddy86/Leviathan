// Legion · tests · the offline dialogue engine (src/engine/dialogue.mjs).
//
// Run from legion/: node --test tests/dialogue.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import { loadDefaultWorld } from '../src/engine/world.mjs';
import { Population, LEGION_SEED } from '../src/engine/population.mjs';
import { persona } from '../src/engine/persona.mjs';
import { Mind } from '../src/engine/mind.mjs';
import { dialectFor, roadNames, findBrands, fireLabel, DIALECTS } from '../src/engine/lexicon.mjs';
import { Conversation, bark, barkBetween, understand, INTENTS, EMOTIONS, templates, lintTemplates } from '../src/engine/dialogue.mjs';

const world = await loadDefaultWorld();
const pop = new Population(world, { seed: LEGION_SEED });
const T = world.snapshotTime;

const personaCache = new Map();
/** The persona of an NPC (cached). */
function P(npc) {
  let p = personaCache.get(npc.id);
  if (!p) { p = persona(world, npc, { population: pop, dialectFor }); personaCache.set(npc.id, p); }
  return p;
}

/** The first n NPCs of a ZIP that pass a filter, from a deterministic sample. */
function residents(zip, n, filter = () => true, seed = 17) {
  const zi = world.indexOf(zip);
  assert.ok(zi >= 0, `ZIP ${zip} is in the pack`);
  const out = [];
  for (const npc of pop.sample(zi, 200, seed)) { if (filter(npc)) out.push(npc); if (out.length >= n) break; }
  assert.ok(out.length >= Math.min(n, 1), `found residents of ${zip}`);
  return out;
}

const adult = npc => npc.age >= 25 && npc.age < 75;
const englishOnly = npc => npc.languages.english === 'only';
const conv = (npc, seed = 7, mind = null, t = T) => new Conversation({ world, persona: P(npc), mind: mind || new Mind(P(npc), { t }), t, rngSeed: seed, population: pop });

const LEFTOVER = /\{|\}|\bundefined\b|\bnull\b|\bNaN\b|\[object|\bInfinity\b/;
function assertClean(line, where) {
  assert.ok(line && typeof line.text === 'string' && line.text.trim().length > 0, `non-empty line (${where})`);
  assert.ok(!LEFTOVER.test(line.text), `no leftovers in "${line.text}" (${where})`);
  if (line.gloss !== null) assert.ok(typeof line.gloss === 'string' && line.gloss.trim() && !LEFTOVER.test(line.gloss), `clean gloss "${line.gloss}" (${where})`);
  assert.ok(INTENTS.includes(line.intent), `known intent ${line.intent} (${where})`);
  assert.ok(Array.isArray(line.topics) && Array.isArray(line.facts), `topics and facts arrays (${where})`);
  assert.ok(typeof line.emotion === 'string' && EMOTIONS.includes(line.emotion), `known emotion ${line.emotion} (${where})`);
}

// One probe per intent: what a player might say, and the intent the engine should hear.
const PROBES = [
  ['greeting', 'Hello there!'], ['how-are-you', 'How are you doing today?'], ['name', "What's your name?"],
  ['about-them', 'Tell me about yourself.'], ['job', 'What do you do for a living?'], ['family', 'Do you have any kids?'],
  ['home', 'Where do you live?'], ['neighborhood', "What's it like living around here?"], ['weather', "How's the weather today?"],
  ['traffic', 'How bad is the traffic around here?'], ['fire', 'Have there been wildfires near here?'], ['storm', 'When was the last big storm or flood?'],
  ['heat', 'How hot does it get in the summer?'], ['housing', 'Can people afford to buy a house here?'], ['rent', "What's rent like around here?"],
  ['insurance', 'Is home insurance a problem here?'], ['earthquake', 'Do you worry about earthquakes?'], ['food', 'Where should I eat around here?'],
  ['place', 'What should I see while I am in town?'], ['directions', 'How do I get to Sacramento?'], ['history', 'What do you remember from the old days?'],
  ['opinion', 'What do you think about politics?'], ['compliment', 'You are so nice.'], ['insult', 'You are an idiot.'], ['joke', 'Tell me a joke.'],
  ['thanks', 'Thank you!'], ['apology', 'Sorry about that.'], ['smalltalk', 'What are you up to?'], ['goodbye', 'Goodbye!'], ['unknown', 'Purple monkey dishwasher.'],
];

// Ten-plus ZIPs from every corner of the state: city, suburb, farm town, coast, desert, mountains, the far north.
const ZIPS = ['90265', '90011', '94110', '93702', '92683', '91205', '95815', '96001', '92530', '95060', '92262', '96150', '93546', '95501'];

test('every intent has a probe, and the engine hears each probe as that intent', () => {
  assert.deepEqual([...new Set(PROBES.map(p => p[0]))].sort(), [...INTENTS].sort());
  for (const [intent, text] of PROBES) assert.equal(understand(text, { world }).intent, intent, `"${text}"`);
});

test('understanding: entities, follow-ups and combinations', () => {
  const u = understand('How do I get to Santa Monica from here?', { world });
  assert.equal(u.intent, 'directions');
  assert.ok(u.entities.places.some(p => p.name === 'Santa Monica'));
  assert.deepEqual(understand('Is the 405 bad today?', { world }).entities.roads, [{ route: 405, kind: null }]);
  assert.deepEqual(understand('Take I-80 or PCH?', { world }).entities.roads.map(r => r.route), [80, 1]);
  assert.deepEqual(understand('What happened here in 2018?', { world }).entities.years, [2018]);
  assert.equal(understand('Tell me about the Woolsey Fire', { world, fires: [{ name: 'Woolsey' }] }).entities.fires[0].name, 'Woolsey');
  assert.equal(understand('Tell me more', { world, lastIntent: 'fire' }).intent, 'fire', '"tell me more" continues the topic');
  assert.equal(understand('Hi! How are you?', { world }).intent, 'how-are-you', 'a greeting plus a question is the question');
  assert.equal(understand('What do you think about the rent here?', { world }).intent, 'rent', 'an opinion on a topic is the topic');
  assert.equal(understand('Thanks, bye!', { world }).intent, 'goodbye');
  assert.ok(understand('zxqv blorp', { world }).flags.unclear);
  assert.ok(!understand('fired from my job', { world }).scores.fire, '"fired" is not fire');
});

test('determinism: the same seed and the same history give the same lines; another seed differs', () => {
  const npc = residents('90265', 1, adult)[0];
  const script = ['Hi!', 'What do you do?', 'How is the weather?', 'Any fires here?', 'Tell me more', 'What should I eat?', 'Bye!'];
  const run = seed => { const c = conv(npc, seed); return [c.greet(), ...script.map(s => c.reply(s)), c.farewell()].map(l => JSON.stringify(l)); };
  assert.deepEqual(run(11), run(11));
  assert.notDeepEqual(run(11), run(12));
});

test('every intent gets a non-empty, in-character reply from NPCs in 14 ZIPs', () => {
  let n = 0;
  for (const zip of ZIPS) {
    const npcs = residents(zip, 2, npc => npc.age >= 18);
    for (const npc of npcs) {
      const c = conv(npc, 5);
      assertClean(c.greet(), `${npc.id} greet`);
      for (const [intent, text] of PROBES) {
        const line = c.reply(text);
        assertClean(line, `${npc.id} "${text}"`);
        n++;
        // in character: an English-only speaker never glosses; a limited-English Spanish speaker glosses every line
        if (englishOnly(npc)) assert.equal(line.gloss, null, `${npc.id} speaks only English: "${line.text}"`);
        if (npc.languages.english === 'limited' && npc.languages.home === 'spanish') assert.ok(line.gloss, `${npc.id} answers in Spanish with a gloss: "${line.text}"`);
        if (!['unknown', 'insult', 'apology', 'thanks', 'compliment'].includes(intent) && line.intent !== intent) {
          // the only legitimate re-reading is an answer to the NPC's own question
          assert.ok(['smalltalk', 'how-are-you', 'name', 'job', 'family', 'traffic', 'food', 'neighborhood'].includes(line.intent), `${npc.id} "${text}" heard as ${line.intent}`);
        }
      }
      assertClean(c.farewell(), `${npc.id} farewell`);
    }
  }
  assert.ok(n >= 14 * 2 * PROBES.length - 1);
});

test('grounding: a weather reply carries the temperature world.weatherAt gives, with its fact', () => {
  for (const zip of ['90265', '96001', '93702', '96150', '92262']) {
    for (const npc of residents(zip, 2, npc => npc.age >= 13)) {
      const c = conv(npc, 3);
      const line = c.reply("How's the weather today?");
      const temp = world.weatherAt(world.indexOf(zip), T).now.tempF;
      assert.ok(line.text.includes(String(temp)), `${npc.id}: "${line.text}" mentions ${temp}`);
      assert.ok(line.facts.includes('weather.now'), `${npc.id}: weather.now in ${line.facts}`);
    }
  }
});

test('grounding: a fire question in 90265 names the Woolsey Fire (2018) or the Palisades Fire (2025)', () => {
  for (const npc of residents('90265', 6, npc => npc.age >= 18)) {
    const line = conv(npc, 9).reply('Has there ever been a big fire around here?');
    assert.match(line.text + ' ' + (line.gloss || ''), /(Woolsey Fire|incendio Woolsey)[^.]*2018|(Palisades Fire|incendio Palisades)[^.]*2025|2018[^.]*Woolsey|2025[^.]*Palisades/, `${npc.id}: "${line.text}"`);
    assert.ok(line.facts.some(f => f === 'fire:Woolsey:2018' || f === 'fire:Palisades:2025'), `${npc.id}: ${line.facts}`);
  }
});

/** Every name locals use for the highways near a resident. */
function localRoadNames(npc) {
  const zi = world.indexOf(npc.zip), z = world.zip(zi), key = dialectFor(world, zi);
  const home = npc.household.home;
  const roads = [...world.roadsNear(home.x, home.y, 25), ...world.roadsNear(z.tx, z.ty, 25)];
  if (npc.commute && npc.commute.road) roads.push(npc.commute.road);
  return { key, names: new Set(roads.flatMap(r => roadNames(r, key, { world, zi }))) };
}

test('grounding: a traffic question names a nearby highway the local way (the 405 in SoCal, 280 in the Bay Area)', () => {
  const cases = [['90265', /\bthe \d{1,3}\b|\bPCH\b/i], ['90011', /\bthe \d{1,3}\b/i], ['92683', /\bthe \d{1,3}\b|\bPCH\b/i], ['94110', /(?<![Tt]he )\b\d{2,3}\b/], ['95815', /(?<![Tt]he )\b\d{2,3}\b/]];
  for (const [zip, style] of cases) {
    for (const npc of residents(zip, 3, npc => npc.age >= 18 && englishOnly(npc))) {
      const line = conv(npc, 4).reply("How's the traffic around here?");
      const { key, names } = localRoadNames(npc);
      const said = [...names].filter(nm => line.text.toLowerCase().includes(nm.toLowerCase()));
      assert.ok(said.length, `${npc.id} (${key}): "${line.text}" names one of ${[...names].join(', ')}`);
      assert.match(line.text, style, `${npc.id} (${key}) says roads the local way: "${line.text}"`);
      assert.ok(line.facts.some(f => f.startsWith('road:')), `${npc.id}: a road fact in ${line.facts}`);
      if (DIALECTS[key].the) assert.ok(!/\b(I|US|SR)-? ?\d/.test(line.text), `SoCal does not say "I-405": "${line.text}"`);
    }
  }
});

test('no unfilled slot, "undefined" or "null" in thousands of generated lines and barks', () => {
  const script = PROBES.map(p => p[1]).concat(['Tell me more', 'Why?', 'And then?', "I'm Sam, nice to meet you", "I'm from Fresno", 'I am a nurse', 'What happened in 2018?', 'Do you surf?', 'Did you see the game?', 'Is it safe here?', 'Where is the nearest grocery store?', 'How do I get to the beach?', 'What is the forecast for tomorrow?']);
  let lines = 0;
  const zips = ['90265', '90011', '94110', '93702', '92683', '91205', '95815', '96001', '92530', '95060', '92262', '96150', '93546', '95501', '92101', '93101', '94601', '95376', '93301', '92404'];
  for (const zip of zips) {
    for (const npc of residents(zip, 3, () => true, 23)) {
      const c = conv(npc, 2);
      for (const line of [c.greet(), ...script.map(s => c.reply(s)), c.farewell()]) { assertClean(line, `${npc.id}`); lines++; }
      for (const situation of ['pass', 'wait', 'weather', 'alert', 'traffic', 'work', 'home']) {
        const b = bark(world, P(npc), { t: T, situation });
        if (b) { assert.ok(!LEFTOVER.test(b.text + ' ' + (b.gloss || '')), `bark "${b.text}"`); lines++; }
      }
    }
  }
  assert.ok(lines >= 2500, `${lines} lines`);
});

test('no repeated line within a 30-turn conversation, even when the player repeats themselves', () => {
  const turns = ["Hi!", "How's it going?", "What's the weather like?", "Is it always like this?", "What's the weather like?", "How's traffic?", "How's traffic?",
    "Any fires around here?", "Tell me more", "Tell me more", "Really?", "What's your name?", "What's your name?", "Where should I eat?", "Where should I eat?",
    "Tell me a joke", "Tell me a joke", "Another joke?", "What do you do?", "Do you have kids?", "How long have you lived here?", "What's it like here?",
    "Thanks!", "Thanks!", "hmm", "ok", "What are you up to?", "What do you think about the rent?", "Do you get earthquakes?", "Bye!"];
  assert.equal(turns.length, 30);
  for (const zip of ['90265', '94110', '93702', '92262', '96150', '90011']) {
    for (const npc of residents(zip, 3, npc => npc.age >= 5)) {
      const c = conv(npc, 21);
      const said = new Set([c.greet().text]);
      for (const text of turns) {
        const line = c.reply(text);
        assert.ok(!said.has(line.text), `${npc.id} repeated "${line.text}" (to "${text}")`);
        said.add(line.text);
      }
    }
  }
});

test('a limited-English Spanish speaker answers in Spanish with a gloss; an English-only speaker never glosses', () => {
  const es = residents('90011', 3, npc => npc.age >= 18 && npc.languages.home === 'spanish' && npc.languages.english === 'limited');
  assert.ok(es.length >= 2);
  for (const npc of es) {
    const c = conv(npc, 8);
    for (const text of ['Hello!', "How's the weather?", 'What do you do?', 'Where should I eat?']) {
      const line = c.reply(text);
      assert.ok(line.gloss, `"${line.text}" has a gloss`);
      assert.match(line.text, /[áéíóúñ¿¡]|\b(el|la|los|las|de|del|que|en|es|muy|no|estoy|ahora|pero|por|con|mi|me|se|un|una|hay|hace|voy|tengo|soy|vivo|trabajo|estamos|grados|gracias|ver)\b/i, `"${line.text}" is Spanish`);
      assert.ok(!/[áéíóúñ¿¡]/.test(line.gloss), `the gloss is English: "${line.gloss}"`);
    }
  }
  const en = residents('90265', 3, npc => npc.age >= 18 && englishOnly(npc));
  for (const npc of en) {
    const c = conv(npc, 8);
    for (const text of ['Hello!', "How's the weather?", 'What do you do?', 'Where should I eat?', 'Thanks!', 'Bye!']) {
      const line = c.reply(text);
      assert.equal(line.gloss, null, `"${line.text}"`);
      assert.ok(!/[¿¡]|\b(gracias|hola|adiós|señor|amigo)\b/i.test(line.text), `no Spanish from an English-only speaker: "${line.text}"`);
    }
  }
});

test('a bilingual speaker code-switches now and then, always with the English in the gloss', () => {
  const bi = residents('90011', 6, npc => npc.age >= 25 && npc.languages.home === 'spanish' && npc.languages.english === 'very well', 5);
  let switched = 0;
  for (const npc of bi) {
    const c = conv(npc, 13);
    for (const text of ['Hi!', 'Thanks!', "How's traffic?", 'Is rent expensive here?', "How's the weather?", 'Bye!']) {
      const line = c.reply(text);
      if (line.gloss) {
        switched++;
        assert.notEqual(line.gloss, line.text);
        assert.ok(!/[¿¡áéíóúñ]/.test(line.gloss), `English gloss: "${line.gloss}"`);
      }
    }
  }
  assert.ok(switched > 0, 'some Spanish slips in for bilingual speakers');
});

test('Line.facts cover the claims: years, temperatures, fires and roads in a line come with fact ids', () => {
  const firesByZip = new Map();
  for (const zip of ['90265', '96001', '92530', '91205', '95060']) {
    const zi = world.indexOf(zip);
    firesByZip.set(zip, world.firesOf(zi).map(f => ({ label: fireLabel(f.name), id: `fire:${f.name}:${f.year}` })).filter(f => f.label));
    for (const npc of residents(zip, 3, npc => npc.age >= 18 && englishOnly(npc))) {
      const c = conv(npc, 6);
      for (const text of ["How's the weather?", 'Any big fires here?', 'Tell me more', 'When was the last big storm?', 'How hot does it get?', 'What happened in 2018?', "How's traffic?", 'Is insurance a problem?', 'How much do houses cost here?']) {
        const line = c.reply(text);
        const facts = new Set(line.facts);
        const where = `${npc.id} "${text}" -> "${line.text}" [${line.facts}]`;
        if (/\b(19|20)\d\d\b/.test(line.text)) assert.ok(line.facts.length > 0, `a year needs a source: ${where}`);
        if (/\b\d{2,3} degrees\b|\bit's \d{2,3}\b/i.test(line.text)) assert.ok(line.facts.some(f => /^(weather|record|clim)/.test(f)), `a temperature needs a source: ${where}`);
        for (const f of firesByZip.get(zip)) if (line.text.includes(f.label)) assert.ok(facts.has(f.id) || line.facts.some(x => x.startsWith('persona.memory')), `${f.label} needs ${f.id}: ${where}`);
        if (/\$\d|million dollars/.test(line.text)) assert.ok(line.facts.some(f => /^(acs\.value|ins\.prem)/.test(f)), `money needs a source: ${where}`);
        if (/cars a day/.test(line.text)) assert.ok(line.facts.some(f => f.startsWith('aadt:')), `a traffic count needs a source: ${where}`);
        if (/FAIR Plan/.test(line.text) && /\d/.test(line.text)) assert.ok(facts.has('ins.fair'), `FAIR Plan share needs ins.fair: ${where}`);
      }
    }
  }
});

test('memory continuity: a second conversation on the same mind remembers the first', () => {
  for (const npc of residents('90265', 3, npc => npc.age >= 25 && englishOnly(npc))) {
    const p = P(npc);
    const mind = new Mind(p, { t: T });
    const a = new Conversation({ world, persona: p, mind, t: T, rngSeed: 31 });
    a.greet();
    a.reply("Hi, I'm Sam, nice to meet you");
    const fire = a.reply('Tell me about the fires around here');
    assert.ok(fire.facts.some(f => f.startsWith('fire:')), 'the first conversation was about a fire');
    a.farewell();
    const later = T + 2 * 86400000;
    const b = new Conversation({ world, persona: p, mind, t: later, rngSeed: 32 });
    const hello = b.greet();
    const again = b.reply('So what about those fires?');
    const both = `${hello.text} ${again.text}`;
    assert.match(both, /\bSam\b/, `the name is remembered: "${both}"`);
    assert.match(both, /last time|we last spoke/i, `the last conversation comes up: "${both}"`);
    assert.match(both, /(Woolsey|Palisades|Franklin)[^.]*(19|20)\d\d|fires around here/, `and what it was about: "${both}"`);
    assert.ok(mind.recall('fire', 10).some(m => /asked me about/.test(m.text)), 'the mind can recall it');
  }
});

test('the mind hears the player: compliments warm, insults hurt and end the conversation, apologies help', () => {
  const npc = residents('94110', 1, npc => npc.age >= 25 && englishOnly(npc))[0];
  const mind = new Mind(P(npc), { t: T });
  const c = conv(npc, 41, mind);
  c.reply('You are really kind, thank you.');
  assert.ok(mind.relationship('player').affinity > 0);
  const hurt = c.reply('You are a stupid idiot.');
  assert.equal(hurt.intent, 'insult');
  assert.ok(['hurt', 'annoyed', 'angry'].includes(hurt.emotion));
  const done = c.reply('You are a useless moron.');
  assert.equal(done.intent, 'insult');
  const after = c.reply("What's the weather like?");
  const temp = world.weatherAt(world.indexOf(npc.zip), T).now.tempF;
  assert.ok(!after.text.includes(String(temp)) && !after.facts.includes('weather.now'), `no small talk after the NPC ended it: "${after.text}"`);
  assert.equal(after.emotion, 'annoyed');
  const sorry = c.reply("I'm sorry, I was rude.");
  assert.equal(sorry.intent, 'apology');
  assert.ok(c.reply("How's the weather?").text.length > 0);
});

test('names: the NPC gives its own and learns the player\'s, and uses it', () => {
  const npc = residents('93702', 1, npc => npc.age >= 25 && englishOnly(npc))[0];
  const mind = new Mind(P(npc), { t: T });
  const c = conv(npc, 51, mind);
  const mine = c.reply("What's your name?");
  assert.match(mine.text, new RegExp(npc.name.first));
  c.reply("I'm Priya.");
  assert.equal(mind.relationship('player').facts.find(f => f.key === 'name').value, 'Priya');
  const texts = [];
  for (const q of ['What do you do?', 'How is the weather?', 'Where should I eat?', 'Any fires here?', 'What is it like here?', 'Bye!']) texts.push(c.reply(q).text);
  assert.ok(texts.some(t => t.includes('Priya')), `the name comes back: ${texts.join(' / ')}`);
});

test('life fits the record: no commute talk from children, no landlord from owners, kids only when there are kids', () => {
  const kids = [...residents('90011', 3, npc => npc.age >= 6 && npc.age <= 11), ...residents('93702', 3, npc => npc.age >= 6 && npc.age <= 11)];
  for (const npc of kids) {
    const c = conv(npc, 61);
    for (const q of ["How's traffic?", 'What do you do?', 'Is rent expensive?', 'Is insurance a problem?']) {
      const line = c.reply(q);
      const en = line.gloss || line.text;
      assert.ok(!/\bmy (commute|boss|paycheck|landlord|mortgage)\b|\bI drive\b|\bI work as\b/i.test(en), `${npc.id} (age ${npc.age}): "${en}"`);
    }
  }
  const owners = residents('96001', 4, npc => npc.age >= 30 && npc.household.tenure === 'own' && ['householder', 'spouse'].includes(npc.role) && englishOnly(npc));
  for (const npc of owners) {
    const c = conv(npc, 62);
    for (const q of ['What is rent like here?', 'Do you own or rent?', 'Tell me about your home.']) assert.ok(!/\bmy landlord\b|\bI rent\b/i.test(c.reply(q).text));
  }
  const childless = residents('94110', 3, npc => npc.age >= 30 && englishOnly(npc) && !npc.household.members.some(m => m.role === 'child'));
  for (const npc of childless) {
    const line = conv(npc, 63).reply('Do you have kids?');
    assert.ok(!/\bmy (son|daughter|kids)\b/i.test(line.text) || /grown/.test(line.text), `${npc.id}: "${line.text}"`);
  }
});

test('babies do not talk, toddlers barely do, and neither repeats', () => {
  const babies = residents('90011', 2, npc => npc.age <= 1);
  for (const npc of babies) {
    const c = conv(npc, 71);
    const said = new Set();
    for (let i = 0; i < 30; i++) {
      const line = c.reply(PROBES[i % PROBES.length][1]);
      assert.match(line.text, /^\(.+\)$/, `a baby acts: "${line.text}"`);
      assert.ok(!said.has(line.text));
      said.add(line.text);
    }
    assert.equal(bark(world, P(npc), { t: T }), null, 'babies do not bark');
  }
});

test('barks: neighbors greet in their register, in Spanish when both speak it, about the weather or an alert', () => {
  const pairs = residents('90011', 12, npc => npc.age >= 18 && npc.languages.home === 'spanish');
  let spanish = 0;
  for (let i = 0; i + 1 < pairs.length; i += 2) {
    for (let k = 0; k < 6; k++) {
      const [a, b] = barkBetween(world, P(pairs[i]), P(pairs[i + 1]), { t: T + k * 60000 });
      assert.ok(a && b, 'two lines');
      for (const l of [a, b]) assert.ok(typeof l.text === 'string' && l.text && !LEFTOVER.test(l.text));
      if (a.gloss && /[¡¿]|hola|buen|qué/i.test(a.text)) spanish++;
    }
  }
  assert.ok(spanish > 0, 'Spanish speakers greet each other in Spanish sometimes');
  const en = residents('96150', 6, npc => npc.age >= 18 && englishOnly(npc));
  for (let i = 0; i + 1 < en.length; i += 2) {
    const [a, b] = barkBetween(world, P(en[i]), P(en[i + 1]), { t: T });
    assert.equal(a.gloss, null);
    assert.equal(b.gloss, null);
  }
  // an alert gets mentioned when one is out (the snapshot has a Coastal Flood Warning for San Francisco)
  const sf = residents('94110', 8, npc => npc.age >= 18 && englishOnly(npc));
  const lines = sf.flatMap(p => [0, 1, 2, 3].map(k => bark(world, P(p), { t: T + k * 60000, situation: 'alert' }))).filter(Boolean);
  assert.ok(lines.some(l => /Coastal Flood Warning|High Surf Warning/.test(l.text)), lines.map(l => l.text).join(' / '));
  const one = bark(world, P(sf[0]), { t: T, situation: 'weather' });
  assert.ok(one && typeof one.text === 'string');
  assert.deepEqual(bark(world, P(sf[0]), { t: T, situation: 'weather' }), one, 'barks are deterministic');
});

test('template lint: no brand names, no accent spelling, no mock foreign words, balanced slots', () => {
  const all = templates();
  assert.ok(all.length > 1500, `${all.length} templates`);
  const problems = lintTemplates();
  assert.deepEqual(problems, []);
  // the same checks, done here directly over every English text and gloss
  const ACCENT = /(?<![\w'’])(ze|zis|zat|dat|dis|dem|dey|wit|ah'm|velly|herro|prease)(?![\w'’])|\b\w+in'(?=\W|$)|\b(gonna|wanna|y'all)\b/i;
  for (const t of all) {
    const english = t.bank === 'es' || t.bank === 'bark-es' ? t.gloss : t.text;
    assert.deepEqual(findBrands(t.text), [], `brand in "${t.text}"`);
    assert.ok(!ACCENT.test(english), `accent spelling in "${english}"`);
    assert.equal((t.text.match(/\{/g) || []).length, (t.text.match(/\}/g) || []).length, `braces in "${t.text}"`);
  }
  // and over generated output, which also carries the lexicon's regional lines
  for (const npc of residents('90011', 4, npc => npc.age >= 13)) {
    const c = conv(npc, 81);
    for (const [, text] of PROBES) {
      const line = c.reply(text);
      assert.deepEqual(findBrands(line.text), [], line.text);
      assert.ok(!ACCENT.test(line.gloss || line.text), line.text);
    }
  }
});

test('performance: a reply takes well under 20 ms', () => {
  const npcs = [...residents('90265', 3, adult), ...residents('94110', 3, adult), ...residents('93702', 3, adult)];
  const times = [];
  for (const npc of npcs) {
    const c = conv(npc, 91);
    c.reply('Hi!');
    for (const [, text] of PROBES) {
      const t0 = performance.now();
      c.reply(text);
      times.push(performance.now() - t0);
    }
  }
  times.sort((a, b) => a - b);
  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  const p95 = times[Math.floor(times.length * 0.95)];
  assert.ok(mean < 5, `mean ${mean.toFixed(2)} ms`);
  assert.ok(p95 < 20, `p95 ${p95.toFixed(2)} ms`);
});

test('a Conversation without a mind makes its own, and serializes its state', () => {
  const npc = residents('95060', 1, adult)[0];
  const c = new Conversation({ world, persona: P(npc), t: T, rngSeed: 3 });
  assertClean(c.greet(), 'greet');
  assertClean(c.reply('What is it like here?'), 'reply');
  const json = JSON.parse(JSON.stringify(c.toJSON()));
  assert.equal(json.history.length, 3);
  assert.equal(json.history[1].role, 'player');
  assert.equal(c.history[2].role, 'npc');
  assert.throws(() => new Conversation({ world }), /persona/);
});
