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
import { DIALECTS as DIALECT_BANKS, LINE_CATEGORIES, WEATHER_CONDITIONS } from '../src/engine/lexicon.mjs';
import { atPacific } from '../src/engine/clock.mjs';
import { Conversation, bark, barkBetween, understand, INTENTS, EMOTIONS, templates, lintTemplates } from '../src/engine/dialogue.mjs';
import { probeOf, screenValue } from '../src/engine/dialogue/probe.mjs';
import { lexiconLineFits, fitsLife, claimedMinutes, sentencesOf, sentenceKey, lintText, TAG_TESTS } from '../src/engine/dialogue/core.mjs';
import { keySentence, cleanFireName, fireName, placeFacts, weatherFacts, fixPlaceLabel } from '../src/engine/dialogue/ground.mjs';
import { makeVoice } from '../src/engine/dialogue/voice.mjs';
import { compose, say, homeWord, memTitleOf, factsOfTemplate, SPANISH, EN, TU_FORMS } from '../src/engine/dialogue/plan.mjs';
import { placeEs, heritageLabelEs } from '../src/engine/dialogue/life.mjs';
import { phrasesFor } from '../src/engine/lexicon.mjs';
import { Rng } from '../src/engine/rng.mjs';

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

/** Like residents(), for a filter that may match nobody in the sample (no assertion). */
function anyResidents(zip, n, filter, seed = 17, sample = 300) {
  const zi = world.indexOf(zip);
  return zi < 0 ? [] : pop.sample(zi, sample, seed).filter(filter).slice(0, n);
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
  ['opinion', 'What do you think about politics?'], ['compliment', 'You are so nice.'], ['insult', 'You are an idiot.'], ['probe', 'What do you think about immigrants?'], ['joke', 'Tell me a joke.'],
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

test('a player speaking Spanish: understood, answered in Spanish by Spanish speakers, politely declined by others', () => {
  // the Spanish lines read through their English paraphrase
  for (const [text, intent] of [['¿Cómo está?', 'how-are-you'], ['¿Cómo se llama?', 'name'], ['¿Tiene hijos?', 'family'], ['¿Qué tiempo hace?', 'weather'],
    ['¿Hay mucho tráfico por aquí?', 'traffic'], ['¿Dónde puedo comer?', 'food'], ['Cuénteme un chiste', 'joke'], ['Hasta luego', 'goodbye'], ['Gracias', 'thanks']]) {
    const u = understand(text, { world });
    assert.equal(u.intent, intent, `"${text}"`);
    assert.ok(u.flags.spanish, `"${text}" reads as Spanish`);
  }
  assert.deepEqual(understand('Me llamo Sam', { world }).appraisal.facts, [{ key: 'name', value: 'Sam' }]);
  for (const text of ['How is traffic in LA?', 'Where is a good café?', 'I love El Cajon', 'Is the hay field still there?']) assert.ok(!understand(text, { world }).flags.spanish, `"${text}" is English`);
  const isSpanish = /[áéíóúñ¿¡]|\b(el|la|los|las|de|que|en|es|muy|no|tengo|hace|grados|hijos|aquí)\b/i;
  // a bilingual answers a Spanish question in Spanish (with the English gloss), then English again
  const [bi] = residents('90011', 1, npc => npc.age >= 25 && npc.languages.home === 'spanish' && npc.languages.english === 'very well', 5);
  const c = conv(bi, 21);
  const es = c.reply('¿Qué tiempo hace?');
  assert.equal(es.intent, 'weather');
  assert.match(es.text, isSpanish, `"${es.text}" is Spanish`);
  assert.ok(es.gloss && !/[¿¡áéíóúñ]/.test(es.gloss), `English gloss: "${es.gloss}"`);
  const en = c.reply('What do you do for work?');
  assert.match(en.text, /\b(I|I'm|I've|my|the|work)\b/, `back to English: "${en.text}"`);
  // a limited-English Spanish speaker understands the Spanish question
  const [lim] = residents('90011', 1, npc => npc.age >= 25 && npc.languages.home === 'spanish' && npc.languages.english === 'limited');
  const l = conv(lim, 4).reply('¿Tiene hijos?');
  assert.equal(l.intent, 'family');
  assert.match(l.text, isSpanish);
  // an English-only speaker gets the everyday words and says so for the rest
  const [eo] = residents('96001', 1, npc => adult(npc) && englishOnly(npc));
  const e = conv(eo, 4);
  assert.equal(e.reply('¿Cómo está?').intent, 'how-are-you');
  const no = e.reply('¿Tiene hijos?');
  assert.match(no.text, /Spanish/, `"${no.text}"`);
  assert.equal(no.gloss, null);
  assert.equal(e.reply('Gracias').intent, 'thanks');
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

// ------------------------------------------------------------------ review fixes

// Lines that claim not to know (the NPC's own life never gets one) and shrugs of an opinion (never for a probe).
const IGNORANCE = /\b(I don't (really )?know|no idea|you've got me there|couldn't tell you|new one on me|not sure I can answer|I'm not sure what you mean)\b/i;
const SHRUG = /depends who you ask|I go back and forth|don't have a strong opinion|don't think about it much|that's important work|that's great|good work|that can't be easy/i;
const textsOf = prefix => templates().filter(t => t.key.startsWith(prefix)).map(t => (t.bank === 'es' || t.bank === 'bark-es' ? t.gloss : t.text));

test('probes: stereotypes, status questions and "go back" are declined and pushed back on, never shrugged at', () => {
  const mexicanBorn = residents('90011', 1, npc => npc.age >= 25 && npc.nativity === 'foreign' && /Mexic|Jalisco|Michoac|Zacatecas|Guanajuato|Oaxaca|Puebla|Guerrero|Sinaloa|Sonora|Chihuahua|Durango|Nayarit|Colima|Baja/.test(String(npc.birthplace)))[0]
    || residents('90011', 1, npc => npc.age >= 25 && npc.nativity === 'foreign')[0];
  const vietnamese = residents('92683', 1, npc => npc.age >= 25 && npc.heritage === 'vietnamese')[0];
  const plain = residents('94110', 2, npc => npc.age >= 25 && englishOnly(npc));
  const hostile = ['Are Mexicans lazy?', 'Do you have papers?', 'Go back to your country', 'Is it true that Asians are bad drivers?', 'Are you an illegal immigrant?', "I'm a racist.", "I'm a nazi.", 'Mexicans are taking our jobs'];
  const declined = ['What do you think about Mexicans?', 'What do you think about immigrants?', 'Are Asians good at math?', 'Are you a citizen?', 'Is there a lot of racism here?'];
  for (const npc of [mexicanBorn, vietnamese, ...plain].filter(Boolean)) {
    for (const text of hostile) {
      const mind = new Mind(P(npc), { t: T });
      const line = conv(npc, 9, mind).reply(text);
      const en = line.gloss || line.text;
      assert.equal(line.intent, 'insult', `${npc.id} "${text}" is hostile: "${en}"`);
      assert.ok(!IGNORANCE.test(en) && !SHRUG.test(en), `${npc.id} "${text}" -> "${en}"`);
      assert.ok(mind.relationship('player').affinity < 0 && mind.feelingsToward('player') !== 'neutral', `${npc.id}: "${text}" costs the player (${JSON.stringify(mind.relationship('player'))})`);
    }
    for (const text of declined) {
      const line = conv(npc, 9).reply(text);
      const en = line.gloss || line.text;
      assert.equal(line.intent, 'probe', `${npc.id} "${text}" -> ${line.intent}`);
      assert.ok(!IGNORANCE.test(en) && !SHRUG.test(en), `${npc.id} "${text}" -> "${en}"`);
      assert.ok(textsOf('probe.').some(x => en.includes(x)), `${npc.id} "${text}" pushes back: "${en}"`);
    }
  }
  // the readings themselves, both ways
  for (const text of hostile) assert.ok(probeOf(text.toLowerCase()), `"${text}" is a probe`);
  for (const text of ['Do a lot of Mexicans live around here?', 'Is there good Mexican food here?', 'The men are fixing the road', 'I have papers to grade', 'Did you finish your papers?', 'My grandpa fought the Nazis in World War II',
    'Can you speak English?', 'Are you Mexican?', 'Are you Catholic?', 'I need to go back to work', 'I have to go back to Mexico next month', 'What do you think about the Chinese restaurant downtown?']) {
    assert.equal(probeOf(text.toLowerCase()), null, `"${text}" is an ordinary line`);
  }
});

test('the NPC never learns or says back a crude, hateful or joke value, and meets an unknown job with a plain nod', () => {
  const npc = residents('94110', 1, npc => npc.age >= 25 && englishOnly(npc))[0];
  const mind = new Mind(P(npc), { t: T });
  const c = conv(npc, 9, mind);
  c.reply("What's your name?");
  const rude = c.reply('My name is Fuckface');
  assert.ok(!/fuckface/i.test(rude.text), `not said back: "${rude.text}"`);
  assert.ok(!mind.relationship('player').facts.some(f => /fuck/i.test(f.value)), 'not learned');
  c.reply("Okay, it's Sam. My name is Sam.");
  assert.equal(mind.relationship('player').facts.find(f => f.key === 'name').value, 'Sam');
  c.reply('My name is Hitler');
  assert.equal(mind.relationship('player').facts.find(f => f.key === 'name').value, 'Sam', 'a joke name does not replace the real one');
  const bye = c.farewell();
  assert.ok(!/fuckface|hitler/i.test(bye.text), bye.text);
  // jobs: a real one is welcomed and remembered, an unknown one gets a plain nod, a hateful one is refused
  for (const [job, kind] of [['I work as a nurse.', 'known'], ["I'm a juggler.", 'unknown'], ['I work as a nazi.', 'refused']]) {
    const m = new Mind(P(npc), { t: T });
    const k = conv(npc, 12, m);
    k.reply('Hi!');
    const line = k.reply(job);
    if (kind === 'known') assert.ok(m.relationship('player').facts.some(f => f.key === 'job' && f.value === 'nurse'), job);
    if (kind === 'unknown') {
      assert.ok(!m.relationship('player').facts.some(f => f.key === 'job'), `not learned: ${JSON.stringify(m.relationship('player').facts)}`);
      assert.ok(!/great|good work|important|can't be easy|how do you like/i.test(line.text), `no praise for "${job}": "${line.text}"`);
    }
    if (kind === 'refused') {
      assert.ok(!m.relationship('player').facts.some(f => f.key === 'job'), `not learned: ${JSON.stringify(m.relationship('player').facts)}`);
      assert.ok(!/nazi/i.test(line.text) && !SHRUG.test(line.text), `"${job}" -> "${line.text}"`);
    }
  }
  for (const v of ['Fuckface', 'Shithead', 'racist', 'nazi', 'Mike Hunt']) assert.ok(screenValue(v, 'name'), `${v} is screened`);
  for (const v of ['Sam', 'José', "O'Brien", 'Dick', 'Jesus', 'nurse', 'Fresno']) assert.equal(screenValue(v, 'name'), null, `${v} is fine`);
});

test('no false negatives about disasters: a long-time Northridge resident never denies a damaging quake', () => {
  const NEGATIVE = /nothing (big|special|serious|that did real damage)|can't think of anything|nothing grave|nada grave|no me acuerdo de nada/i;
  for (const t of [...textsOf('quake.none'), ...textsOf('hist.yearMiss')]) assert.ok(!NEGATIVE.test(t), `a no-record line claims nothing: "${t}"`);
  const locals = residents('91324', 4, npc => npc.age >= 45 && P(npc).residence && P(npc).residence.zipSince <= 1994);
  assert.ok(locals.length >= 2, 'long-time residents of Northridge');
  for (const npc of locals) {
    const c = conv(npc, 7);
    for (const text of ['Do you remember the Northridge earthquake?', 'Were you here in 1994?', 'Do you worry about earthquakes?', 'Any big earthquakes around here?', 'What happened here in 1994?']) {
      const line = c.reply(text);
      const en = line.gloss || line.text;
      assert.ok(!NEGATIVE.test(en), `${npc.id} "${text}" -> "${en}"`);
      assert.ok(!line.facts.includes('fema.county'), `${npc.id}: no claim rests on an absent record: ${line.facts}`);
    }
    const here = conv(npc, 8).reply('Were you here in 1994?');
    assert.ok(here.facts.includes('npc.residence'), `${npc.id}: answered from the record: "${here.text}" ${here.facts}`);
  }
});

test('follow-ups are answered from the NPC\'s own life, never with "I don\'t know"', () => {
  const pairs = [['Do you have kids?', 'What are their names?', 'family'], ['Do you have kids?', 'How old are they?', 'family'], ['What do you do?', 'How long have you done that?', 'job'],
    ["How's the weather today?", 'What about tomorrow?', 'weather'], ['What do you do?', 'How early do you start?', 'job'], ['What do you do?', 'Do you like it?', 'job'], ['Do you have kids?', 'Boys or girls?', 'family']];
  const zips = ['90265', '90011', '94110', '93702', '92683', '91205', '95815', '96001', '92530', '95060'];
  let n = 0;
  for (const zip of zips) for (const npc of residents(zip, 3, npc => npc.age >= 25 && englishOnly(npc))) {
    for (const [a, b, intent] of pairs) {
      const c = conv(npc, 4);
      c.reply(a);
      const line = c.reply(b);
      n++;
      assert.equal(line.intent, intent, `${npc.id} "${a}" / "${b}" -> ${line.intent}: "${line.text}"`);
      assert.ok(!IGNORANCE.test(line.text), `${npc.id} "${a}" / "${b}" -> "${line.text}"`);
      const kids = P(npc).npc.household.members.filter(m => m.role === 'child' && npc.role === 'householder' && npc.age - m.age >= 15);
      if (b === 'What are their names?' && kids.length) for (const k of kids) assert.ok([k.first, String(k.name).split(' ')[0]].filter(Boolean).some(x => line.text.includes(x)), `${npc.id}: names ${k.name} in "${line.text}"`);
      if (b === 'What about tomorrow?') assert.ok(line.facts.includes('weather.next'), `${npc.id}: the forecast: "${line.text}" ${line.facts}`);
    }
  }
  assert.ok(n >= 150);
  // their own words: the workplace, an interest, a worry, the languages they speak, a question about them
  const nurse = anyResidents('92501', 1, npc => npc.occupation && /nurse/i.test(npc.occupation.title || '') && /hospital/.test(npc.occupation.employer || ''), 3, 600)[0];
  if (nurse) {
    const c = conv(nurse, 4);
    c.reply('What do you do?');
    const which = c.reply('Which hospital?');
    assert.equal(which.intent, 'job');
    assert.match(which.text, /hospital/i, which.text);
    assert.equal(conv(nurse, 5).reply('Do you like being a nurse?').intent, 'job');
  }
  const farmers = anyResidents('96101', 2, npc => npc.occupation && /farmer|rancher/.test(npc.occupation.title || '') && englishOnly(npc) && P(npc).interests.includes('the harvest'), 3, 600);
  for (const f of farmers) {
    const harvest = conv(f, 4).reply("How's the harvest going?");
    assert.ok(harvest.facts.includes('persona.interests') && !IGNORANCE.test(harvest.text), `${f.id}: "${harvest.text}"`);
    const water = conv(f, 4).reply('Is water a problem for the farm?');
    assert.ok(!IGNORANCE.test(water.text) && water.facts.length, `${f.id}: "${water.text}" ${water.facts}`);
  }
  for (const npc of residents('94040', 3, npc => npc.age >= 18 && englishOnly(npc))) {
    const eng = conv(npc, 4).reply('Do you speak English?');
    assert.match(eng.text, /English/, eng.text);
    const weekend = conv(npc, 4).reply('What do you do on weekends?');
    assert.ok(!IGNORANCE.test(weekend.text) && weekend.intent === 'about-them', `${npc.id}: "${weekend.text}"`);
    const odd = conv(npc, 4).reply('Do you have a dog?');
    assert.ok(!IGNORANCE.test(odd.text), `deflects, never claims not to know: "${odd.text}"`);
  }
});

test('stale weather: past the forecast window nothing of the snapshot\'s forecast is said, and the estimate is hedged', () => {
  const later = T + 30 * 86400000, earlier = T - 20 * 86400000;
  for (const zip of ['93702', '90265', '96001', '94110']) {
    for (const npc of residents(zip, 2, npc => npc.age >= 18 && englishOnly(npc))) {
      for (const t of [later, earlier]) {
        assert.ok(world.weatherAt(world.indexOf(zip), t).stale, 'the world says stale');
        const c = conv(npc, 3, null, t);
        for (const text of ["What's the forecast for tonight and tomorrow?", "How's the weather today?", 'Will it rain this week?']) {
          const line = c.reply(text);
          assert.ok(!line.facts.some(f => /^weather\.(next|keyMessage|fireOutlook|rainOutlook)$/.test(f) || f.startsWith('alert:')), `${npc.id} at ${new Date(t).toISOString()}: "${line.text}" ${line.facts}`);
          assert.ok(!/typical for|normal for|about normal/i.test(line.text), `the estimate is not a climate fact: "${line.text}"`);
        }
      }
    }
  }
});

test('key messages: list numbering stripped, advisories left to the alerts, nothing about a morning already past', () => {
  const hnx = world.weather.afd.HNX;
  const k = keySentence({ keyMessages: hnx.key, stale: false }, T, Date.parse(hnx.issued));
  assert.ok(k && !/\b\d\.?$|\b\d\. /.test(k.text) && !/advisory|this morning/i.test(k.text), JSON.stringify(k));
  assert.equal(keySentence({ keyMessages: hnx.key, stale: true }, T, Date.parse(hnx.issued)), null, 'a stale forecast has no key message');
  const thursday = atPacific(2026, 11, 28, 10, 0);
  for (const [office, afd] of Object.entries(world.weather.afd)) {
    const late = keySentence({ keyMessages: afd.key, stale: false }, thursday, Date.parse(afd.issued));
    if (late) assert.ok(!/\b(today|tonight|this morning|this afternoon|monday|tuesday|wednesday)\b/i.test(late.text), `${office} on Saturday: "${late.text}"`);
  }
  for (const zip of ['93702', '93301', '93277', '95340']) {
    for (const npc of residents(zip, 6, npc => npc.age >= 18 && englishOnly(npc))) {
      const line = conv(npc, 5).reply("What's the forecast?");
      assert.ok(!/Delano\. 2|\b\d\.\s*$|advisory remains|this morning/i.test(line.text), `${npc.id}: "${line.text}"`);
    }
  }
});

test('a county windstorm\'s gust is said with where it was measured, never as if it blew here', () => {
  const RECORD = /on record here/;
  for (const zip of ['92501', '90265', '91205', '94110', '95815', '92530']) {
    for (const npc of residents(zip, 3, npc => npc.age >= 18 && englishOnly(npc))) {
      for (const text of ['Are the Santa Ana winds bad here?', 'What was the worst windstorm here?']) {
        const line = conv(npc, 7).reply(text);
        for (const sentence of line.text.split(/(?<=[.!?])\s+/)) {
          if (/\d+ miles an hour/.test(sentence) && !RECORD.test(sentence)) assert.match(sentence, / near | in the | in [A-Z]/, `${npc.id}: an unplaced gust: "${sentence}"`);
        }
      }
    }
  }
  const riverside = residents('92501', 4, npc => npc.age >= 18 && englishOnly(npc));
  for (const npc of riverside) {
    const line = conv(npc, 7).reply('Are the Santa Ana winds bad here?');
    if (/130 miles an hour/.test(line.text)) assert.match(line.text, /Agua Dulce/, line.text);
  }
});

/** A voice for the lexicon guard: a short drive to work, inland, under a clear sky, with no alerts. */
function guardVoice(over = {}) {
  return Object.assign({
    commute: { minutes: 21, workCity: 'Jurupa Valley', workZi: world.indexOf('92509'), mode: 'drive' }, world,
    flags: { commuter: true, coast: false, kids: true, partner: true, married: true, spouseSex: 'F', house: true, bornInCounty: true },
    sky: 'clear', wx: { now: { short: 'Sunny', tempF: 66 } }, tempF: 66, alerts: [], offshore: null,
    speaker: { age: 40, works: true, drives: true, tenure: 'own', nativeHere: true, parent: true }, age: 40, relq: { known: false },
  }, over);
}

test('dialect lines never contradict the speaker or the moment: commutes, the sky, the coast, made-up incidents', () => {
  const v = guardVoice();
  const SKY = { fog: /\b(fog|foggy|fogged)\b|\bmarine layer\b/i, rain: /\b(raining|rainy|drizzle|downpour)\b|\bit's pouring\b/i, snow: /\bsnowing\b/i, smoke: /\bsmoky\b/i };
  let checked = 0;
  for (const [key, d] of Object.entries(DIALECT_BANKS)) {
    for (const b of [d, d.youth || {}, d.elder || {}]) {
      for (const cat of [...LINE_CATEGORIES, 'weather']) {
        const lines = cat === 'weather' ? Object.values(b.weather || {}).flat() : (b[cat] || []);
        for (const t of lines) {
          if (typeof t !== 'string') continue;
          checked++;
          const ok = lexiconLineFits(t, v, cat);
          const claim = /each way/i.test(t) ? claimedMinutes(t) : null;
          if (claim !== null && Math.abs(claim - 21) > 15) assert.ok(!ok, `${key} ${cat}: "${t}" claims a ${claim}-minute commute`);
          if (/\bto work in LA\b/.test(t)) assert.ok(!ok, `${key}: "${t}" for someone who works in Riverside County`);
          if (/\b(by|at|off) the (pier|wharf|harbor|boardwalk)\b/i.test(t)) assert.ok(!ok, `${key}: "${t}" for an inland speaker`);
          if (/\bSigAlert on\b|\bthere's an? (accident|crash) on\b/i.test(t)) assert.ok(!ok, `${key}: "${t}" reports an incident`);
          // a habit ("fog in the morning, sun by lunch"), a hedge about somewhere else, or a memory is not a report on now
          if (['weather', 'greetings', 'farewells', 'traffic'].includes(cat) && !/I bet|probably|maybe|after a|every |when |in the morning, \w+ by/i.test(t)) {
            for (const [c, re] of Object.entries(SKY)) if (re.test(t) && !/\bno (fog|rain|snow|smoke)\b/i.test(t)) assert.ok(!ok, `${key} ${cat}: "${t}" claims ${c} under a clear sky`);
          }
        }
      }
    }
  }
  assert.ok(checked > 3000, `${checked} lines checked`);
  // and the same lines in conversation: a 21-minute commuter in Riverside, a stranger, inland Salinas
  const nurse = anyResidents('92501', 1, npc => npc.commute && npc.commute.mode === 'drive' && npc.commute.minutes < 40 && englishOnly(npc), 3)[0];
  if (nurse) {
    for (let seed = 0; seed < 30; seed++) {
      const c = conv(nurse, seed);
      const all = [c.greet(), c.reply("How's the commute?"), c.reply("How's traffic around here?")].map(l => l.text).join(' ');
      assert.ok(!/two hours each way|to work in LA|make it back from the coast/i.test(all), `${nurse.id} seed ${seed}: "${all}"`);
    }
  }
  for (const npc of residents('93905', 3, npc => npc.age >= 18 && englishOnly(npc))) {
    for (let seed = 0; seed < 12; seed++) assert.ok(!/\bpier\b|\bwharf\b/i.test(conv(npc, seed).reply('Where should I eat around here?').text));
  }
  // the guard keeps what is true: a habit, a hedge about somewhere else, a line with no claim at all
  for (const t of ['Everybody in LA measures distance in minutes, not miles.', '{temp} out here, and I bet it\'s foggy in the city. Classic.', 'No fog today. Rare. Enjoy it.']) {
    assert.ok(lexiconLineFits(t, guardVoice(), 'weather'), `"${t}" is fine`);
  }
  // a joke about SigAlerts in general is not a report of one, on a rainy day
  assert.ok(lexiconLineFits("Three drops of rain and there's a SigAlert.", guardVoice({ sky: 'rain', wx: { now: { short: 'Rain', tempF: 58 } } }), 'weather'));
});

test('origins: "born and raised" only for people born in the county; others say where they were born', () => {
  let checked = 0;
  for (const zip of ['94040', '90280', '90059', '90011', '92683', '91205', '93702', '95815']) {
    for (const npc of residents(zip, 40, npc => npc.age >= 13)) {
      const p = P(npc), res = p.residence || {};
      if (!res.grewUpHere || res.bornHere) continue;
      const v = makeVoice(world, p, { t: T });
      if (v.flags.bornInCounty) continue;
      checked++;
      for (const seed of [1, 2, 3]) {
        const line = conv(npc, seed).reply('Where are you from originally?');
        const en = line.gloss || line.text;
        assert.ok(!/born and raised|my whole life|all my life/i.test(en), `${npc.id} (born in ${npc.birthplace}): "${en}"`);
        if (npc.birthplace) assert.ok(en.includes(String(npc.birthplace).replace(/, California$/, '').split(',').pop().trim()), `${npc.id} names where they were born (${npc.birthplace}): "${en}"`);
      }
    }
  }
  assert.ok(checked >= 5, `${checked} people raised here but born elsewhere`);
});

test('first-person lines fit the record: grown and school-age kids together, farmers, the self-employed, spouses', () => {
  const GROWN = /They're grown|They're adults now|Grown kids under one roof|grown, but still at home/;
  let mixed = 0;
  for (const zip of ['90404', '93905', '90011', '93702', '91205']) {
    for (const npc of anyResidents(zip, 60, npc => npc.age >= 30 && ['householder', 'spouse'].includes(npc.role) && englishOnly(npc))) {
      const ages = npc.household.members.filter(m => m.role === 'child').map(m => m.age);
      if (!(ages.some(a => a >= 18) && ages.some(a => a < 18))) continue;
      mixed++;
      for (const seed of [1, 2, 3, 4]) assert.ok(!GROWN.test(conv(npc, seed).reply('Do you have kids?').text), `${npc.id} has kids aged ${ages}`);
    }
  }
  assert.ok(mixed >= 2, `${mixed} households with grown and school-age kids`);
  let farmers = 0;
  for (const zip of ['96101', '95220', '93905', '93277', '95993']) {
    for (const npc of anyResidents(zip, 4, npc => npc.occupation && /^(farmer|rancher)$/.test(npc.occupation.title || '') && englishOnly(npc), 5, 600)) {
      farmers++;
      for (const seed of [1, 2, 3]) {
        const c = conv(npc, seed);
        const all = [c.greet(), c.reply('What do you do?'), c.reply('Do you like it?'), c.reply('How do you get to work?'), c.farewell()].map(l => l.text).join(' ');
        assert.ok(!/Managing is mostly people|solve other people's problems|meetings|Remote work|down the hallway|my boss|somebody notices|coworkers are the dog/i.test(all), `${npc.id} (${npc.occupation.title}, ${npc.occupation.employer}): "${all}"`);
      }
    }
  }
  assert.ok(farmers >= 2, `${farmers} farmers checked`);
  const base = { flags: { partner: true, married: true, spouseSex: 'M', selfEmployed: false }, speaker: { works: true }, age: 70, relq: { known: false } };
  assert.ok(!fitsLife('I told my wife she was drawing her eyebrows too high.', base), 'a woman married to a man has no wife');
  assert.ok(fitsLife('My husband says hi.', base));
  assert.ok(!fitsLife("I'd better get back before somebody notices.", { ...base, flags: { ...base.flags, selfEmployed: true } }), 'no one to hide from at your own business');
  assert.ok(!fitsLife('Born and raised.', { ...base, flags: { ...base.flags, bornInCounty: false }, speaker: { nativeHere: true } }), 'raised here is not born here');
});

test('turned-back questions and small personal questions get real answers', () => {
  for (const npc of residents('95060', 3, npc => npc.age >= 25 && englishOnly(npc))) {
    const c = conv(npc, 6);
    const hay = c.reply('Fine, and you?');
    assert.equal(hay.intent, 'how-are-you', hay.text);
    const fav = c.reply("What's your favorite color?");
    assert.ok(!IGNORANCE.test(fav.text) && fav.intent === 'about-them', fav.text);
    const her = conv(npc, 6).reply('Where is your family from?');
    assert.ok(her.facts.includes('npc.heritage') || her.facts.includes('npc.origin'), `${npc.id}: "${her.text}" ${her.facts}`);
  }
});

// ------------------------------------------------------------------ fix pass 2 (findings 10-23)

const spanishLimited = npc => adult(npc) && npc.languages.home === 'spanish' && npc.languages.english === 'limited';
const bilingualCs = npc => adult(npc) && npc.languages.home === 'spanish' && npc.languages.english === 'very well' && !!P(npc).speech.codeSwitch && P(npc).speech.codeSwitch.rate >= 0.2;
const fold = s => String(s || '').toLowerCase().normalize('NFD').replace(/\p{M}+/gu, '');

test('natural phrasings are heard as their topic: food, things to do, goodbyes, commutes, Spanish questions, home', () => {
  const self = { job: /\b(?:cattle|ranch|ranches|ranching)\b/, interests: [{ name: 'the grandkids', re: /\bgrandkids\b/ }], concerns: ['water'] };
  const CASES = [
    ["Where's a good place to get tamales around here?", 'food'], ['Any good pupusas nearby?', 'food'], ['Where can I get ramen?', 'food'], ['Know any good dim sum places?', 'food'],
    ['Is there a brewery around here?', 'food'], ['Best ice cream in town?', 'food'], ['Any good banh mi spots?', 'food'], ['Is that a good place to get tamales?', 'food'],
    ["What's there to do in Riverside on the weekend?", 'place'], ["What's there to see around here?", 'place'], ['Any good hikes nearby?', 'place'],
    ['What do people do for fun around here?', 'place'], ["What's the closest big town?", 'place'],
    ['Cool, nice meeting you. Later!', 'goodbye'], ['Nice meeting you!', 'goodbye'], ['Later!', 'goodbye'], ['Gotta run, nice chatting.', 'goodbye'], ['Okay, I should let you go.', 'goodbye'],
    ['how do you get to school', 'traffic'], ['How do you get to work?', 'traffic'], ['Do you drive to work?', 'traffic'], ['How do you get around without a car?', 'traffic'],
    ['¿Le gusta vivir en Salinas?', 'neighborhood'], ['¿Le gusta vivir aquí?', 'neighborhood'], ['¿Te gusta vivir aquí?', 'neighborhood'], ['¡Buenas tardes!', 'greeting'],
    ['Hi! You look tired, long day?', 'how-are-you'], ['Rough day?', 'how-are-you'],
    ['What was it like when you first came here?', 'history'], ['What was it like back then?', 'history'],
    ['Do you have grandkids?', 'family'], ["what's your mom do", 'family'], ['What does your dad do?', 'family'], ['How old is he?', 'family', 'family'],
    ["How's the water situation for ranching?", 'opinion'], ['How many head of cattle do you run?', 'job'], ['Do you work from home or go into the office?', 'job'],
    ['What is your background?', 'about-them'], ['Do you miss home?', 'about-them'], ['Do you go back to visit?', 'about-them'],
    ['Do you still have family back home?', 'about-them'], ['Is your family still there?', 'about-them'], ['Do you go back to work tomorrow?', 'job'],
  ];
  const bad = [];
  for (const [text, want, last = 'weather'] of CASES) {
    const u = understand(text, { world, self, lastIntent: last });
    if (u.intent !== want) bad.push(`"${text}": ${u.intent}, not ${want}`);
  }
  assert.deepEqual(bad, []);
  // which part of home the question asks about
  assert.equal(understand('Do you miss home?', { world }).entities.homeland, 'miss');
  assert.equal(understand('Do you go back to visit?', { world }).entities.homeland, 'visit');
  assert.equal(understand('Is your family still there?', { world }).entities.homeland, 'family');
  assert.equal(understand('Would you ever move back?', { world }).entities.homeland, 'return');
  assert.equal(understand('Do you go back to work tomorrow?', { world }).entities.homeland, null);
  // a line with a topic of its own is not taken as "that" of the last topic
  const u = understand('Is that a good place to get tamales?', { world, lastIntent: 'traffic' });
  assert.equal(u.flags.followUp, false);
});

test('accented Spanish never trips the English patterns: "Buenos días" is a greeting, "as hot as" names no team', () => {
  for (const text of ['Buenos días', '¡Buenos días!', 'Buenos días, ¿cómo está?']) {
    const u = understand(text, { world });
    assert.equal(u.entities.team, null, text);
    assert.ok(['greeting', 'how-are-you'].includes(u.intent), `${text}: ${u.intent}`);
  }
  assert.equal(understand('Is it as hot as yesterday?', { world }).entities.team, null);
  assert.equal(understand("Are you a fan of the A's?", { world }).entities.team, "a's");
  assert.ok(!understand('La renta está carísima.', { world }).scores.traffic, '"carísima" holds no "car"');
  const SPORTS = /\b(game|games|team|season|playoffs|partidos?|equipo|temporada)\b/i;
  const people = [...residents('90265', 2, npc => adult(npc) && englishOnly(npc)), ...residents('90011', 2, spanishLimited)];
  for (const npc of people) {
    for (const seed of [1, 2, 3]) {
      const c = conv(npc, seed);
      c.greet();
      const line = c.reply('Buenos días');
      assert.ok(!SPORTS.test(line.text), `${npc.id}: "${line.text}"`);
    }
  }
});

test('ordinary words are not places: "Nice!" or "Cool" after "Where are you from?"; "I\'m from Weed" still is', () => {
  for (const text of ['Nice.', 'Nice!', 'Cool.', 'Cool, nice meeting you.', 'Weed.', "That's a challenge.", 'Likely.']) {
    assert.deepEqual(understand(text, { world }).entities.places.map(p => p.name), [], text);
  }
  for (const [text, name] of [["I'm from Paradise.", 'Paradise'], ["I'm from Weed.", 'Weed'], ['I live in Riverside.', 'Riverside']]) {
    assert.ok(understand(text, { world }).entities.places.some(p => p.name === name), text);
  }
  const npc = residents('90265', 1, n => adult(n) && englishOnly(n))[0];
  const mind = new Mind(P(npc), { t: T });
  const c = conv(npc, 3, mind);
  c.greet();
  for (let i = 0; i < 6; i++) { c.reply('Where are you from?'); c.reply('Nice!'); }
  const facts = mind.relationship('player').facts;
  assert.ok(!facts.some(f => /nice/i.test(String(f.value))), JSON.stringify(facts));
});

test('no sentence is said twice: 30 varied turns, and one question asked 40 times', () => {
  const SCRIPT = ['How are you?', "What's your name?", 'What do you do?', 'Do you like it?', 'Where are you from?', 'Do you have kids?', "How's the weather?",
    'What about tomorrow?', 'How bad is the traffic?', 'Any fires around here?', 'Tell me about the old days.', 'Where should I eat?', "What's rent like?",
    'How are you?', 'What do you do?', 'Any fires around here?', "How's the weather?", 'What do you think of this neighborhood?', 'Tell me more.', 'Really?',
    'Do you have kids?', 'Where should I eat?', 'How hot does it get?', 'When was the last big storm?', 'Do you worry about earthquakes?', 'Where are you from?',
    'Tell me about the old days.', 'How bad is the traffic?', "What's rent like?", 'Thanks!'];
  assert.equal(SCRIPT.length, 30);
  const people = [
    ...residents('90265', 2, n => adult(n) && englishOnly(n)), ...residents('90011', 2, spanishLimited),
    ...residents('93905', 1, n => adult(n) && n.languages.home === 'spanish' && n.languages.english === 'very well'), ...residents('96001', 1, adult),
  ];
  // sentences of four words or more; a restatement asked for by a repeated question ("Like I said, ...") is not counted
  const keysOf = c => c.history.filter(h => h.role === 'npc' && !h.repeat).flatMap(h => sentencesOf(h.text).map(x => sentenceKey(x, null, 4)).filter(Boolean));
  const dups = keys => keys.filter((k, i) => keys.indexOf(k) !== i);
  for (const npc of people) {
    const c = conv(npc, 11);
    c.greet();
    for (const text of SCRIPT) c.reply(text);
    assert.deepEqual(dups(keysOf(c)), [], `${npc.id} said a sentence twice`);
  }
  for (const npc of [people[0], people[2]]) {
    const c = conv(npc, 5);
    c.greet();
    for (let i = 0; i < 40; i++) c.reply("What's the weather like today?");
    const lines = c.history.filter(h => h.role === 'npc').map(h => h.text);
    assert.equal(new Set(lines).size, lines.length, `${npc.id}: no whole line twice`);
    assert.deepEqual(dups(keysOf(c)), [], `${npc.id}: no sentence twice in 40 askings`);
  }
});

test('code-switching: a family word in the home language comes at the speaker\'s rate and stays the same all conversation', () => {
  const bi = residents('93905', 2, bilingualCs);
  for (const npc of bi) {
    const rate = P(npc).speech.codeSwitch.rate;
    let used = 0;
    const words = new Set();
    for (let seed = 1; seed <= 60; seed++) {
      const S = conv(npc, seed)._session(new Rng(seed));
      const a = homeWord(S, 'mom', 'mom');
      assert.deepEqual(homeWord(S, 'mom', 'mom'), a, 'one word per relation for the whole conversation');
      if (!a) continue;
      used++;
      words.add(a.t);
      assert.equal(a.g, 'mom');
      assert.ok(!/madre|materna|paterna/i.test(a.t), `an everyday word, not "${a.t}"`);
    }
    assert.ok(Math.abs(used / 60 - rate) < 0.2, `used in ${used} of 60 conversations at rate ${rate}`);
    assert.equal(words.size, 1, `the persona's own word: ${[...words]}`);
  }
  for (const npc of residents('90265', 2, n => adult(n) && englishOnly(n))) assert.equal(homeWord(conv(npc, 1)._session(new Rng(1)), 'mom', 'mom'), null);
});

test('a surprise phrase in the home language never comes before an "I didn\'t catch that" line', () => {
  const npc = residents('93905', 1, bilingualCs)[0];
  let before = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const a = conv(npc, seed);
    a.voice.lang.cs = Object.assign({}, a.voice.lang.cs, { rate: 1 });
    const S = a._session(new Rng(seed));
    const unk = say(S, 'unk.confused');
    assert.ok(unk, 'an "I didn\'t catch that" line');
    S.st.cs = 'surprise';
    const r = compose(S, 'unknown', { parts: [unk], ask: null, noAsk: true }, null);
    assert.equal(r.gloss, null, `no phrase before "${unk.text}": "${r.text}"`);
    const b = conv(npc, seed);
    b.voice.lang.cs = Object.assign({}, b.voice.lang.cs, { rate: 1 });
    const S2 = b._session(new Rng(seed));
    const ok = say(S2, 'hay.good');
    S2.st.cs = 'surprise';
    if (compose(S2, 'how-are-you', { parts: [ok], ask: null, noAsk: true }, null).gloss) before++;
  }
  assert.ok(before > 0, 'the same phrase does come before an ordinary answer');
});

test('memory titles: a raw declaration gains its "of", a full title stays, a fire is named as people say it', () => {
  assert.equal(memTitleOf({ title: 'the winter storms 2005', source: 'femaOf(06037): DR-1577' }), 'the winter storms of 2005');
  assert.equal(memTitleOf({ title: 'the storms of January to April 2023', source: 'femaOf(06037): DR-4699' }), 'the storms of January to April 2023');
  assert.equal(memTitleOf({ title: 'the record rain of January 2010' }), 'the record rain of January 2010');
  assert.equal(memTitleOf({ title: 'x', source: 'firesOf(06037): Nelson (W-1) 2012' }), 'the Nelson Fire in 2012');
  // the Spanish says it in a form that agrees with any title, singular or plural
  for (const l of SPANISH['hist.event']) assert.ok(!/\bse me olvida\b/.test(l.text), l.text);
  assert.equal(cleanFireName('Czu Lightning Complex'), 'CZU Lightning Complex');
  assert.equal(cleanFireName('Mclaughlin'), 'McLaughlin');
  assert.equal(cleanFireName('Nelson (W-1)'), 'Nelson');
  assert.equal(cleanFireName('Parker2'), 'Parker 2');
  assert.equal(fireName('241 Incident'), null);
  assert.equal(fireName('58 Complex'), 'the 58 Complex');
  // in conversation: no "the of", no doubled "the"
  for (const npc of [...residents('90265', 3, n => n.age >= 40), ...residents('95060', 2, n => n.age >= 40)]) {
    const c = conv(npc, 4);
    for (const text of ['Any fires around here?', 'When was the last big storm?', 'What do you remember from the old days?', 'Tell me more.']) {
      const line = c.reply(text);
      assert.ok(!/\bthe the\b|\bthe of\b|\bof of\b/i.test(line.text), line.text);
    }
  }
});

test('style: no doubled intensifier, and "How about you?" only after saying how they are', () => {
  const DOUBLE = /\b(pretty|hella|real|super|mad|wicked|way) \1\b/i;
  const BACK = /\b(How about you|And you|What about you|And how are you)\?/;
  for (const zip of ['90265', '94110', '93702', '96001', '92262']) {
    for (const npc of residents(zip, 3, n => adult(n) && englishOnly(n))) {
      for (const seed of [1, 2]) {
        const c = conv(npc, seed);
        for (const text of ['Hi!', 'How are you?', "How's the weather?", 'How bad is the traffic?', 'Is it always this hot?', 'What do you do?', "How's it going?", 'Where should I eat?']) {
          const line = c.reply(text);
          assert.ok(!DOUBLE.test(line.text), `${npc.id}: "${line.text}"`);
          if (BACK.test(line.text)) assert.ok(['how-are-you', 'greeting'].includes(line.intent), `${npc.id} asked back after ${line.intent}: "${line.text}"`);
        }
      }
    }
  }
});

test('"Not a cloud in the sky" only under a plain Sunny or Clear forecast', () => {
  const sky = short => ({ wx: { now: { short } } });
  assert.equal(TAG_TESTS.cloudless(sky('Sunny')), true);
  assert.equal(TAG_TESTS.cloudless(sky('Clear')), true);
  for (const short of ['Mostly Sunny', 'Partly Sunny', 'Mostly Clear', 'Partly Cloudy', '']) assert.equal(TAG_TESTS.cloudless(sky(short)), false, short);
  const npc = residents('92262', 1, adult)[0];
  const v = conv(npc, 1).voice;
  for (const [short, fits] of [['Sunny', true], ['Mostly Sunny', false], ['Partly Cloudy', false]]) {
    const vv = Object.assign({}, v, { wx: Object.assign({}, v.wx, { now: Object.assign({}, (v.wx && v.wx.now) || {}, { short }) }) });
    assert.equal(lexiconLineFits('Not a cloud in the sky.', vv, 'weather'), fits, short);
  }
});

test('Spanish wordplay is told only in Spanish: a speaker in plain English never tells an @es joke', () => {
  const wordplay = ['joke.pun', 'joke.kid'].flatMap(k => SPANISH[k] || []).filter(l => l.tags.some(([neg, t]) => !neg && t === 'es'));
  assert.ok(wordplay.length >= 3, 'the Spanish bank has its wordplay');
  const starts = wordplay.map(l => l.gloss.split('?')[0]);
  const simple = residents('92683', 2, n => adult(n) && n.languages.english === 'limited' && !['spanish', 'english'].includes(n.languages.home));
  let jokes = 0;
  for (const npc of simple) {
    for (let seed = 1; seed <= 12; seed++) {
      const c = conv(npc, seed);
      c.greet();
      const line = c.reply('Tell me a joke.');
      assert.ok(!starts.some(st => line.text.includes(st)), `${npc.id}: "${line.text}"`);
      if (line.intent === 'joke') jokes++;
    }
  }
  assert.ok(jokes > 0);
});

test('barks: no phrase for an elder said to someone younger, no tú forms from a speaker who says usted', () => {
  const ELDER = new Set();
  for (const intent of ['greeting', 'how_are_you', 'farewell']) {
    for (const sex of ['M', 'F']) for (const e of phrasesFor('spanish', intent, { sex }) || []) if (/to an (elder|older)/i.test(e.gloss)) ELDER.add(e.text);
  }
  const people = residents('90011', 16, n => n.age >= 13 && n.languages.home === 'spanish');
  let checked = 0;
  for (let i = 0; i < people.length; i++) {
    for (let j = 0; j < people.length; j++) {
      if (i === j || (i + j) % 3) continue;
      const A = people[i], B = people[j];
      const va = makeVoice(world, P(A), { t: T }), vb = makeVoice(world, P(B), { t: T });
      for (let k = 0; k < 3; k++) {
        const [a, b] = barkBetween(world, P(A), P(B), { t: T + k * 60000 });
        for (const [line, v, vo] of [[a, va, vb], [b, vb, va]]) {
          if (!line || !line.gloss) continue;
          checked++;
          const head = line.text.replace(/[.!?]+$/, '');
          if ([...ELDER].some(e => e.replace(/[.!?]+$/, '') === head)) assert.ok(vo.age - v.age >= 8, `"${line.text}" from ${v.age} to ${vo.age}`);
          if (v.lang.usted) assert.ok(!TU_FORMS.test(line.text), `tú form from an usted speaker: "${line.text}"`);
        }
      }
    }
  }
  assert.ok(checked > 10, `${checked} Spanish barks checked`);
});

test('facts only for what a line names: per-slot facts, and place facts named in the words', () => {
  const facts = { '': ['acs.food'], town: 'place:Salinas' };
  assert.deepEqual(factsOfTemplate(facts, { text: 'There are a lot of places here.', gloss: null }), ['acs.food']);
  assert.deepEqual(factsOfTemplate(facts, { text: '{townCap} has a lot of places.', gloss: null }), ['acs.food', 'place:Salinas']);
  assert.deepEqual(factsOfTemplate(facts, { text: 'Hay de todo en {townEs}.', gloss: 'There is everything in {town}.' }), ['acs.food', 'place:Salinas']);
  assert.deepEqual(factsOfTemplate(['a', null, 'b'], { text: 'x', gloss: null }), ['a', 'b']);
  for (const zip of ['93905', '96001', '92262', '95060', '90011']) {
    for (const npc of residents(zip, 2, adult)) {
      const c = conv(npc, 6);
      for (const text of ['What should I see around here?', 'Where should I eat?', "What's the closest big town?", "What's it like living around here?", 'Any good hikes nearby?']) {
        const line = c.reply(text);
        const said = fold(`${line.text} ${line.gloss || ''}`);
        for (const f of line.facts) {
          const m = /^(?:place|landmark):(.+)$/.exec(f);
          if (!m) continue;
          const name = fold(m[1]).replace(/\s+\d{5}$/, '');
          assert.ok(said.includes(name) || said.includes(name.replace(/^(?:mount|mt\.?) /, '')) || said.includes(name.replace(/ (?:mountain|mountains|range|peak|lake|river|creek|bay)$/, '')), `${f} cited by "${line.text}"`);
        }
      }
    }
  }
});

test('lexicon lines in replies pass the template lint: no brands, no accent spellings', () => {
  for (const zip of ['90265', '94110', '93702', '96001', '92262', '95501', '93546']) {
    for (const npc of residents(zip, 2, n => n.age >= 13 && englishOnly(n))) {
      const c = conv(npc, 33);
      for (const text of ['Hi!', "How's the weather?", 'Is it always like this?', 'How bad is the traffic?', 'What do you think about this place?', 'Bye!']) {
        const line = c.reply(text);
        assert.deepEqual(lintText(line.text, findBrands), [], `${npc.id}: "${line.text}"`);
      }
    }
  }
});

test('food: "not many places to eat" only out in the country, never in a dense city ZIP', () => {
  const few = (EN['food.few'] || []).map(l => l.text.replace(/\{[^}]+\}.*$/, '').trim()).filter(Boolean);
  assert.ok(few.length >= 2);
  for (const zip of ['90011', '94110', '92683']) {
    for (const npc of residents(zip, 3, n => adult(n) && englishOnly(n))) {
      for (const seed of [1, 2, 3]) {
        const line = conv(npc, seed).reply('Where should I eat around here?');
        assert.ok(!few.some(f => line.text.includes(f)), `${zip}: "${line.text}"`);
      }
    }
  }
});

test('barks do not depend on which call came first in a ten-minute window', () => {
  const t0 = Math.floor(T / 3600000) * 3600000 + 30 * 60000; // half past the hour: the nearest forecast hour is a tie
  for (const npc of [...residents('90265', 2, adult), ...residents('94110', 2, adult)]) {
    for (const situation of ['weather', 'pass', 'wait']) {
      const primed = persona(world, npc, { population: pop, dialectFor });
      bark(world, primed, { t: t0, situation });
      const a = bark(world, primed, { t: t0 + 9 * 60000, situation });
      const fresh = persona(world, npc, { population: pop, dialectFor });
      const b = bark(world, fresh, { t: t0 + 9 * 60000, situation });
      assert.deepEqual(a, b, `${npc.id} ${situation}`);
    }
  }
});

test('home: "Do you miss home?" and "Is your family still there?" are answered from the birthplace, in Spanish names in Spanish', () => {
  assert.equal(placeEs('Mexico City'), 'la Ciudad de México');
  assert.equal(placeEs('Toluca, State of Mexico'), 'Toluca, Estado de México');
  assert.equal(placeEs('the State of Mexico'), 'el Estado de México');
  assert.equal(placeEs('Manila, Philippines'), 'Manila, Filipinas');
  assert.equal(placeEs('Morelia, Michoacán'), 'Morelia, Michoacán');
  assert.equal(heritageLabelEs('Hispanic', 'F'), 'hispana');
  assert.equal(heritageLabelEs('Latino', 'M'), 'latino');
  const CONFUSED = /no le entendí|no te entendí|no hablo mucho inglés|I don'?t know/i;
  const es = [...anyResidents('90011', 6, n => spanishLimited(n) && n.nativity === 'foreign', 17, 400), ...anyResidents('90022', 4, n => spanishLimited(n) && n.nativity === 'foreign', 17, 400)];
  assert.ok(es.length >= 4);
  for (const npc of es) {
    const c = conv(npc, 9);
    c.greet();
    const from = c.reply('Where are you from?');
    assert.ok(!/Mexico City|State of Mexico|Guatemala City/.test(from.text), `Spanish names in Spanish: "${from.text}"`);
    assert.ok(!/\bde el\b/.test(from.text), from.text);
    for (const text of ['Do you miss home?', 'Do you go back to visit?', 'Is your family still there?']) {
      const line = c.reply(text);
      assert.ok(!CONFUSED.test(line.text), `${npc.id} to "${text}": "${line.text}"`);
    }
  }
  const city = anyResidents('90011', 1, n => spanishLimited(n) && /^Mexico City$|State of Mexico/.test(n.birthplace || ''), 3, 600);
  for (const npc of city) assert.match(conv(npc, 2).reply('Where are you from?').text, /Ciudad de México|Estado de México/);
  for (const npc of residents('90265', 3, n => adult(n) && englishOnly(n))) {
    const c = conv(npc, 9);
    for (const text of ['Do you miss home?', 'Would you ever move back?', 'What is your background?']) {
      const line = c.reply(text);
      assert.equal(line.intent, 'about-them', text);
      assert.ok(!CONFUSED.test(line.text), `${npc.id} to "${text}": "${line.text}"`);
    }
  }
});

test('questions get the answer they ask for: rain, a named dish, last night\'s game, "Buenos días", a hike', () => {
  // rain: the forecast's yes or no comes first
  for (const npc of [...residents('90022', 2, adult), ...residents('96101', 2, adult)]) {
    const c = conv(npc, 4);
    const W = weatherFacts(c.voice);
    const wet = W.periods.some(p => typeof p.pop === 'number' && p.pop >= 30);
    const line = c.reply('Is it going to rain this week?');
    const first = sentencesOf(line.gloss || line.text)[0] || '';
    if (wet) assert.match(line.gloss || line.text, /\d+ percent/, `${npc.id}: "${line.text}"`);
    else assert.match(first, /^(No rain|Doesn't look like it|Not that I('ve seen| know of)|Not that I know)/, `${npc.id}: "${line.text}"`);
  }
  // a dish named in the question is the one the answer is about
  for (const [zip, filter, q, dish] of [['90011', spanishLimited, 'Where can I get good tamales?', /tamales/i], ['94040', n => adult(n) && englishOnly(n), 'Any good ramen places?', /ramen/i], ['93905', adult, 'Where should I get tacos?', /tacos/i]]) {
    for (const npc of residents(zip, 2, filter)) {
      const line = conv(npc, 2).reply(q);
      assert.match(line.text, dish, `${npc.id}: "${line.text}"`);
    }
  }
  // "did you see the game?": about the game, from a fan or not
  const GAME = /caught|had it on|don't miss|off-season|season's over|not my team|heard about it|missed it|sports|who won|no me pierdo|temporada|no lo vi|deportes|vi un poco|lo tenía puesto|no es mi equipo|algo oí/i;
  for (const npc of [...residents('94014', 3, n => n.age >= 13 && englishOnly(n)), ...residents('90265', 2, adult)]) {
    const c = conv(npc, 3);
    c.greet();
    const line = c.reply('Did you see the game last night?');
    assert.match(line.text, GAME, `${npc.id}: "${line.text}"`);
  }
  // "¡Buenos días!" to a Spanish speaker: the hour's greeting back
  for (const npc of residents('90011', 3, spanishLimited)) {
    const c = conv(npc, 6);
    c.greet();
    assert.match(c.reply('¡Buenos días!').text, /Buen(os|as) (días|tardes|noches)/, npc.id);
  }
  // a hike question: the trail first, when they know one
  let trails = 0;
  for (const zip of ['94040', '94014', '91011', '92501', '95060']) {
    for (const npc of anyResidents(zip, 3, adult)) {
      const c = conv(npc, 5);
      const F = placeFacts(c.voice);
      if (!F.trail) continue;
      trails++;
      const line = c.reply('Any good hikes nearby?');
      // the first sentence after an opener ("Well, let's see.")
      const first = sentencesOf(line.text).find(x => x.split(/\s+/).length > 4) || '';
      assert.ok(first.includes(F.trail.label.replace(/^(a trailhead (in the|on)|the trail (up|near)) /, '')), `${npc.id}: "${line.text}" (trail ${F.trail.label})`);
    }
  }
  assert.ok(trails > 0, 'someone knows a trail');
  assert.equal(fixPlaceLabel('a trailhead in the San Bruno Mountain'), 'a trailhead on San Bruno Mountain');
  assert.equal(fixPlaceLabel('a trailhead in the Santa Monica Mountains'), 'a trailhead in the Santa Monica Mountains');
});

test('the same filler, opener or name does not come back turn after turn', () => {
  for (const zip of ['96101', '93702', '90265', '92262']) {
    for (const npc of residents(zip, 3, n => adult(n) && englishOnly(n))) {
      const c = conv(npc, 12);
      c.greet();
      c.reply("Hi, I'm Daniel.");
      const lines = ['How are you?', "What's the weather like?", 'How cold does it get?', 'Does it snow much?', 'What do you do?', 'Is it hard work?', 'How bad is traffic?',
        'Any fires around here?', "What's rent like?", 'Is insurance a problem?', 'Where should I eat?', 'What should I see around here?', 'How long have you lived here?']
        .map(text => c.reply(text).text);
      const named = lines.map((t, i) => (t.includes('Daniel') ? i : -1)).filter(i => i >= 0);
      for (let k = 1; k < named.length; k++) assert.ok(named[k] - named[k - 1] >= 4, `${npc.id}: the name in turns ${named}`);
      const openers = lines.map(t => (/^(Let me tell you|I tell you|Honestly|Basically|Look|Man|Dude|Like|You know|I mean|Good question|Oh, let me think|Hmm)\b/.exec(t) || [])[0]).filter(Boolean);
      const twice = openers.filter((o, i) => openers.indexOf(o) !== i && !/^(Hmm|Like)$/.test(o));
      assert.deepEqual(twice, [], `${npc.id}: ${lines.join(' / ')}`);
    }
  }
});

// ------------------------------------------------------------------ fix pass 3 (review of the second pass)

const DENIAL = /^(No\b|Nope\b|Of course not)|^¡?No[.!]/;
const EVASIVE = /long story|hard question|why do you ask|why would you want|another time|save it|that's personal|a bit personal|rather keep that|por qué lo pregunta|otra historia|largo de contar|pregunta está difícil|Why, (?:are|do|did|is) you/i;

test('accusations are denied and pushed back on, for NPCs of every background; "do you have a bomb?" is never "why do you ask?"', () => {
  const npcs = [
    ...anyResidents('92020', 1, n => adult(n) && /arab|assyrian|iraqi/.test(n.heritage), 3, 800), ...anyResidents('91776', 1, n => adult(n) && /chinese/.test(n.heritage), 3, 800),
    ...anyResidents('93905', 1, n => adult(n) && n.heritage === 'mexican', 3, 800), ...anyResidents('90005', 1, n => adult(n) && n.heritage === 'korean', 3, 800),
    ...anyResidents('92683', 1, n => adult(n) && n.heritage === 'vietnamese', 3, 800), ...residents('96001', 1, adult),
  ];
  assert.ok(npcs.length >= 5, 'NPCs of several backgrounds');
  const ACCUSATIONS = ['Are you a terrorist?', 'Do you have a bomb?', 'Do you sell drugs?', 'Are you in a gang?', 'Is it true you guys eat dogs?', 'Are you a criminal?', 'Do you steal?', 'Is your husband in a gang?'];
  for (const npc of npcs) {
    for (const text of ACCUSATIONS) {
      for (const seed of [1, 2]) {
        const mind = new Mind(P(npc), { t: T });
        const c = conv(npc, seed, mind);
        c.greet();
        const line = c.reply(text);
        const en = line.gloss || line.text;
        assert.equal(line.intent, 'insult', `${npc.id} "${text}" -> ${line.intent}: "${en}"`);
        assert.match(en, DENIAL, `${npc.id} "${text}" is denied: "${en}"`);
        assert.ok(!EVASIVE.test(en), `${npc.id} "${text}" no evasion: "${en}"`);
        assert.ok(mind.relationship('player').affinity < 0, `${npc.id}: "${text}" costs the player`);
      }
    }
    // a border question is an immigration-status probe: pushed back on, never coy
    const border = conv(npc, 3).reply('Did you cross the border?');
    assert.equal(border.intent, 'insult', `${npc.id}: "${border.text}"`);
    assert.ok(!EVASIVE.test(border.gloss || border.text), `${npc.id}: "${border.text}"`);
  }
  for (const text of ['Are you a terrorist?', 'Do you sell drugs?', 'Is it true you guys eat dogs?', 'Did you cross the border?', 'Do you have a bomb?', 'Have you ever been to jail?', "You're a drug dealer, right?"]) {
    assert.ok(probeOf(text.toLowerCase()), `"${text}" is read as a probe`);
  }
  assert.equal(probeOf('is it true you guys eat dogs?').group, true);
  for (const text of ['Do you have a bomb shelter?', 'Did you steal my heart?', 'Do you eat dog food?', 'Are you guys open on Sundays?', 'Do you guys always eat dinner together?',
    'Do you have a record player?', 'Do you have a Coke?', 'Is there a crack in your windshield?', 'Do you take pills for that?', 'Are you a car dealer?', 'Do you grow weed?',
    'Did you see the bomb cyclone?', 'Are you guys having a bad day?', 'Is your son in a band?', 'What do you guys do for fun?']) {
    assert.equal(probeOf(text.toLowerCase()), null, `"${text}" is an ordinary line`);
  }
  // an unrecognized yes-or-no question about them gets a light non-answer, never a suspicious one
  for (const t of textsOf('unk.aboutMeYesNo')) assert.ok(!EVASIVE.test(t.replace(/Why, \{aux\} you\?/, '')) && !/why do you ask|why would you want|hard question/i.test(t), t);
  // Spanish accusations are read too
  for (const text of ['¿Es usted terrorista?', '¿Vende drogas?', '¿Está en una pandilla?', '¿Cruzó la frontera?']) assert.equal(understand(text, { world }).intent, 'insult', text);
});

test('a dish question gets the where first, for everyone; home cooking is a rare aside, never for food people buy, never cited as heritage', () => {
  const HOME = /homemade|made at home|at home|grew up|lo de la casa|en casa|hecho en casa/i;
  for (const [zip, her, q, shop] of [['90011', /mexican/, 'Where can I get good tacos around here?', false], ['92683', /vietnamese/, 'Any good pho places near here?', false],
    ['94122', /chinese/, 'Where can I get boba around here?', true], ['90022', /mexican/, 'Any good burritos around here?', true], ['94133', /italian/, 'Where can I get good pizza?', true]]) {
    const npcs = anyResidents(zip, 25, n => n.age >= 18 && her.test(n.heritage), 3, 400);
    let home = 0;
    for (const npc of npcs) {
      const c = conv(npc, 3);
      c.greet();
      const line = c.reply(q);
      const en = line.gloss || line.text;
      assert.ok(!line.facts.includes('npc.heritage'), `${npc.id}: no heritage fact for a dish: ${line.facts}`);
      // the first sentence is the where, never the kitchen at home
      assert.ok(!HOME.test(sentencesOf(en).find(s => s.split(/\s+/).length > 2) || ''), `${npc.id} "${q}": "${en}"`);
      if (HOME.test(en)) home++;
    }
    if (shop) assert.equal(home, 0, `${zip}: no homemade aside for food people buy`);
    else assert.ok(home <= Math.ceil(npcs.length * 0.35), `${zip}: home cooking is an occasional aside (${home} of ${npcs.length})`);
  }
});

test('after "Where are you from?", a reaction ("Cool.", "Nice!", "Likely.") is never learned as a hometown; real places are, near or far', () => {
  const npc = residents('94110', 1, n => adult(n) && englishOnly(n))[0];
  // the NPC's own question, as a conversation asks it
  const asking = () => {
    for (let seed = 1; seed < 80; seed++) {
      const mind = new Mind(P(npc), { t: T });
      const c = conv(npc, seed, mind);
      c.greet();
      for (const s of ['Hi!', 'What do you do?', 'How long have you been doing that?', 'Nice weather today.']) { c.reply(s); if (c.st.pending === 'from') return { c, mind }; }
    }
    return null;
  };
  for (const said of ['Cool.', 'Nice!', 'Nice.', 'Likely.', 'Whatever.', 'Same.', 'Great!', 'Weed.']) {
    const at = asking();
    assert.ok(at, 'the NPC asks where the player is from');
    at.c.reply(said);
    assert.ok(!at.mind.relationship('player').facts.some(f => f.key === 'from' || f.key === 'lives'), `"${said}" is no hometown: ${JSON.stringify(at.mind.relationship('player').facts)}`);
  }
  for (const [said, want, re] of [['Fresno', 'Fresno', /Fresno/], ['Timbuktu.', 'Timbuktu', /know it|been there|sounds nice|Never been/], ['I am from Nice, in France', 'Nice, France', /long way|Nice, France/], ["I'm from Texas", 'Texas', /long way|Texas/]]) {
    const at = asking();
    const line = at.c.reply(said);
    const f = at.mind.relationship('player').facts.find(x => x.key === 'from');
    assert.equal(f && f.value, want, `"${said}": ${JSON.stringify(at.mind.relationship('player').facts)}`);
    assert.match(line.text, re, `"${said}" -> "${line.text}"`);
    if (want === 'Nice, France') assert.ok(!/miles/.test(line.text), `no California town of that name: "${line.text}"`);
  }
});

test('family follow-ups: a teenager answers about their siblings and parents, never with a dangling "Plus ..."', () => {
  const DANGLING = /^(Plus|Also|Oh, and|And also|And |Y también|También|Ah, y|Además)\b|^(Like I said|Como le decía|Como te decía), (plus|also|oh, and|y también|ah, y)/i;
  let teens = 0;
  for (const zip of ['94014', '90011', '93702', '92683', '95815']) {
    for (const npc of anyResidents(zip, 3, n => n.age >= 10 && n.age <= 17 && n.role === 'child' && n.household.members.filter(m => m.role === 'child' && m.m !== n.m).length >= 1, 9, 300)) {
      teens++;
      const sibs = npc.household.members.filter(m => m.role === 'child' && m.m !== npc.m);
      const c = conv(npc, 5);
      c.greet();
      c.reply('Do you have brothers or sisters?');
      const ages = c.reply('How old are they?');
      const en = ages.gloss || ages.text;
      for (const n of (en.match(/\b\d{1,2}\b/g) || []).map(Number)) assert.ok(sibs.some(s => s.age === n), `${npc.id}: ${n} is a sibling's age in "${en}" (${sibs.map(s => s.age)})`);
      assert.ok(/\d/.test(en), `${npc.id}: ages given: "${en}"`);
      const names = c.reply('What are their names?');
      assert.ok(sibs.some(s => (names.gloss || names.text).includes(String(s.first || s.name).split(' ')[0])), `${npc.id}: names in "${names.text}"`);
      const mom = npc.household.members.find(m => m.m === (npc.parents || [])[0] && m.sex === 'F');
      if (mom) {
        const line = c.reply('How old is your mom?');
        assert.ok((line.gloss || line.text).includes(String(mom.age)), `${npc.id}: mom is ${mom.age}: "${line.text}"`);
      }
      for (const q of ['Who do you live with?', 'Tell me about your family', 'Do you have family here?']) {
        const l = c.reply(q);
        assert.ok(!DANGLING.test(l.text.replace(/^\(.*?\)\s*/, '')), `${npc.id} "${q}": "${l.text}"`);
      }
    }
  }
  assert.ok(teens >= 6, `teenagers with siblings: ${teens}`);
  // and across many households, no reply opens with a continuation
  for (const zip of ['90011', '93702', '92683', '96001']) {
    for (const npc of anyResidents(zip, 10, n => n.age >= 8, 6, 80)) {
      const c = conv(npc, 4);
      c.greet();
      for (const q of ['Who do you live with?', 'Tell me about your family', 'Do you have family here?', 'Tell me more']) {
        const l = c.reply(q);
        assert.ok(!DANGLING.test(l.text.replace(/^\(.*?\)\s*/, '')), `${npc.id} "${q}": "${l.text}"`);
      }
    }
  }
});

test('family follow-ups follow the question\'s own words: "your grandkids" after "your kids" means the grandkids', () => {
  let n = 0;
  for (const zip of ['90011', '93702', '92683', '90022', '93905']) {
    for (const npc of anyResidents(zip, 4, x => x.role === 'householder' && x.age >= 45 && x.household.members.some(m => m.role === 'child') && x.household.members.some(m => m.role === 'grandchild'), 9, 600)) {
      n++;
      const kids = npc.household.members.filter(m => m.role === 'child').map(m => m.age), gks = npc.household.members.filter(m => m.role === 'grandchild').map(m => m.age);
      const c = conv(npc, 2);
      c.greet();
      c.reply('Do you have kids?');
      const line = c.reply('How old are your grandkids?');
      const nums = ((line.gloss || line.text).match(/\b\d{1,3}\b/g) || []).map(Number);
      assert.ok(nums.length && nums.every(x => gks.includes(x)), `${npc.id} kids ${kids} grandkids ${gks}: "${line.text}"`);
    }
  }
  assert.ok(n >= 5, `householders with kids and grandkids: ${n}`);
  // a group with nobody at home is said so, not answered about someone else
  const lone = residents('94110', 1, x => adult(x) && englishOnly(x) && !x.household.members.some(m => m.role === 'grandchild') && x.age >= 45)[0];
  if (lone) {
    const c = conv(lone, 2);
    c.reply('Do you have kids?');
    const line = c.reply('How old are your grandkids?');
    assert.ok(!/\b\d{1,2}\b/.test(line.text) || /I'm \d+/.test(line.text), `${lone.id}: "${line.text}"`);
  }
});

test('a grandchild\'s parent who lives with them is their parent (npc.parents), and they say so', () => {
  let n = 0;
  for (const zip of ['93306', '90011', '93702', '92335', '90001']) {
    for (const npc of anyResidents(zip, 4, x => x.role === 'grandchild' && Array.isArray(x.parents) && x.parents.length && x.age >= 8, 6, 600)) {
      n++;
      const c = conv(npc, 2);
      assert.ok(npc.parents.every(m => c.voice.rel.parents.some(p => p.m === m)), `${npc.id}: parents ${npc.parents} in ${JSON.stringify(c.voice.rel.parents)}`);
      assert.ok(!c.voice.rel.relatives.some(r => npc.parents.includes(r.m)), `${npc.id}: a parent is not a mere relative`);
      c.greet();
      const line = c.reply('Who do you live with?');
      assert.match(line.gloss || line.text, /\b(mom|dad|mother|father|parents)\b/i, `${npc.id}: "${line.text}"`);
      const mom = npc.household.members.find(m => npc.parents.includes(m.m) && m.sex === 'F');
      if (mom) assert.ok(!/don't live with us|not with me/i.test(c.reply('What does your mom do?').text), `${npc.id}: the mother lives here`);
    }
  }
  assert.ok(n >= 4, `grandchildren living with a parent: ${n}`);
});

test('the work week is commute.workDays: someone working from home today never claims a day off', () => {
  let n = 0;
  for (const zip of ['96097', '95014', '94110', '96080', '93905', '95060']) {
    for (const npc of anyResidents(zip, 6, x => x.status === 'employed' && x.commute && x.commute.mode === 'wfh' && (x.commute.workDays & 2), 2, 400)) {
      for (const seed of [1, 2, 3]) {
        const c = conv(npc, seed);
        c.greet();
        const line = c.reply('How are you doing?');
        n++;
        assert.ok(!/off today|day off|not working today/i.test(line.text), `${npc.id}: "${line.text}"`);
      }
      const today = conv(npc, 4).reply('Are you working today?');
      assert.equal(today.intent, 'job');
      assert.ok(!/day off|Not today|Nope, day off/i.test(today.text), `${npc.id}: "${today.text}"`);
    }
  }
  assert.ok(n >= 12, `work-from-home workers asked: ${n}`);
});

test('years here are the speaker\'s own: someone who joined the household later never claims the household\'s move-in year', () => {
  let n = 0;
  for (const zip of ['92243', '90011', '94110', '93905', '96001']) {
    for (const npc of anyResidents(zip, 6, x => x.age >= 18, 6, 300)) {
      const res = P(npc).residence || {}, ym = npc.household.yearMoved;
      if (!(Number.isFinite(ym) && Number.isFinite(res.zipSince) && res.zipSince > ym + 1)) continue;
      n++;
      const c = conv(npc, 2);
      c.greet();
      const txt = ['How long have you lived here?', 'When did you move in?'].map(q => { const l = c.reply(q); return `${l.text} ${l.gloss || ''}`; }).join(' | ');
      assert.ok(!new RegExp(`\\b${ym}\\b`).test(txt) || /bought|compr[oó]|tiene la casa|has had/i.test(txt), `${npc.id} (zipSince ${res.zipSince}, household ${ym}): ${txt}`);
    }
  }
  assert.ok(n >= 3, `adults who joined a household later: ${n}`);
});

test('"How\'s school?" to a student is about their school, never about "the schools"', () => {
  let n = 0;
  for (const zip of ['93306', '94014', '90011']) {
    for (const npc of anyResidents(zip, 5, x => x.age >= 8 && x.age <= 22 && !!x.school, 5, 300)) {
      for (const q of ['Do you like school?', "How's school?", 'How is school going?']) {
        const line = conv(npc, 3).reply(q);
        n++;
        assert.equal(line.intent, 'job', `${npc.id} "${q}"`);
        assert.ok(!/kids in school|don't have kids|my kids|the schools|no tengo hijos|las escuelas/i.test(line.gloss || line.text), `${npc.id} "${q}": "${line.text}"`);
      }
    }
  }
  assert.ok(n >= 15);
  assert.equal(understand('Are the schools any good?', { world }).entities.concern, 'schools', 'the local schools are still a subject of their own');
});

test('everyday questions about the NPC\'s own life are heard as that, with a plain yes or no where one is asked', () => {
  const CASES = [
    ['Did you grow up here?', 'about-them'], ['What brought you here?', 'about-them'], ['When did you come here?', 'about-them'], ['How did you end up here?', 'about-them'],
    ['How long have you been in the US?', 'about-them'], ['Have you lived in Inglewood long?', 'home'], ['Do you live out here?', 'home'], ['Is your work hard?', 'job'],
    ['Where can I buy groceries?', 'directions'], ['How is it going?', 'how-are-you'], ['Happy Thanksgiving!', 'greeting'], ['What are you doing for Thanksgiving?', 'smalltalk'],
    ['Are you working on Thanksgiving?', 'smalltalk'], ['Are you cooking a turkey?', 'smalltalk'], ['Any plans for the holiday?', 'smalltalk'], ['Will it rain on Thanksgiving?', 'weather'],
    ['What do you do on Sundays?', 'about-them'], ['What do you do on your days off?', 'about-them'], ['Are you working today?', 'job'], ['Do you own a nail salon?', 'job'],
    ['Is it hard to find work here?', 'opinion'], ['What kind of music do you like?', 'about-them'], ['Are you a morning person?', 'about-them'], ['Do you have a garden?', 'about-them'],
    ['Do you ever go to the city?', 'place'], ['Have you ever been to Mexico?', 'about-them'], ['Do you like the 49ers?', 'about-them'],
  ];
  const bad = CASES.filter(([text, want]) => understand(text, { world }).intent !== want).map(([text, want]) => `"${text}": ${understand(text, { world }).intent}, not ${want}`);
  assert.deepEqual(bad, []);
  assert.equal(understand('Are you working today?', { world }).flags.sub, 'today');
  assert.equal(understand('Do you work at a liquor store?', { world }).flags.sub, 'workAt');
  assert.equal(understand('Happy Thanksgiving!', { world }).flags.holidayGreeting, true);
  assert.equal(understand('Is it hard to find work here?', { world }).entities.concern, 'jobs');
  // the answers
  const local = residents('96001', 1, x => adult(x) && englishOnly(x) && !(P(x).residence || {}).bornHere && !(P(x).residence || {}).grewUpHere)[0];
  if (local) assert.match(conv(local, 2).reply('Did you grow up here?').text, /^(No|Nope)\b/, `${local.id}: a plain no first`);
  const immigrant = residents('93905', 1, x => adult(x) && x.nativity === 'foreign' && Number.isFinite(x.arrivalYear) && x.languages.english !== 'limited')[0];
  const us = conv(immigrant, 3).reply('How long have you been in the US?');
  assert.ok((us.gloss || us.text).includes(String(immigrant.arrivalYear)), `${immigrant.id} arrived ${immigrant.arrivalYear}: "${us.text}"`);
  const liquor = conv(immigrant, 4).reply('Do you work at a liquor store?');
  if (immigrant.occupation && !/liquor/i.test(immigrant.occupation.title + immigrant.occupation.employer)) assert.match(liquor.gloss || liquor.text, /^(No|Nope)\b/, `${immigrant.id}: "${liquor.text}"`);
  // a new question with nothing left to say is never answered with "you asked me that already"
  for (const npc of residents('96001', 2, x => adult(x) && englishOnly(x))) {
    const c = conv(npc, 9);
    c.greet();
    for (const q of ['Do you have pets?', 'Are you a morning person?', 'Have you ever been to Mexico?', 'Is Bakersfield boring?', 'Do you have a garden?', 'Do you like your neighbors?']) {
      const line = c.reply(q);
      assert.ok(!/asked me that|already told you|same answer|covered that|broken record/i.test(line.text), `${npc.id} "${q}": "${line.text}"`);
    }
  }
});

test('holidays: "Happy Thanksgiving!" is wished back, and the plans come from the household and the work schedule', () => {
  const tg = atPacific(2026, 11, 26, 13, 0);
  for (const npc of [...residents('96001', 2, x => adult(x) && englishOnly(x)), ...residents('90011', 1, spanishLimited)]) {
    const c = conv(npc, 4);
    c.greet();
    const hi = c.reply('Happy Thanksgiving!');
    assert.equal(hi.intent, 'greeting');
    assert.match(hi.gloss || hi.text, /Thanksgiving|Same to you|You too|week/i, `${npc.id}: "${hi.text}"`);
    const plans = c.reply('What are you doing for Thanksgiving?');
    assert.ok(plans.topics.includes('holiday'), `${npc.id}: "${plans.text}"`);
    if (P(npc).npc.household.size === 1) assert.ok(!/our place|our house|hosting|everybody's/i.test(plans.gloss || plans.text), `${npc.id} lives alone: "${plans.text}"`);
    const es = conv(npc, 5).reply('¡Feliz Día de Acción de Gracias!');
    assert.equal(es.intent, 'greeting', `${npc.id}: "Acción de Gracias" is no thank-you: ${es.intent}`);
    assert.equal(conv(npc, 6, null, tg).reply('Happy Thanksgiving!').intent, 'greeting');
  }
  // a worker on the schedule that Thursday, in a job that never closes, says so
  const thu = 1 << 4;
  const nurse = anyResidents('92501', 1, x => x.occupation && /nurse/i.test(x.occupation.title) && x.commute && (x.commute.workDays & thu), 3, 900)[0]
    || anyResidents('92503', 1, x => x.occupation && /nurse|hospital/i.test(`${x.occupation.title} ${x.occupation.employer}`) && x.commute && (x.commute.workDays & thu), 3, 900)[0];
  if (nurse) assert.match(conv(nurse, 3).reply('Are you working on Thanksgiving?').text, /working|work|schedule|shift/i, nurse.id);
});

test('Spanish questions are understood: family, work, home, holidays, accusations; "Acción de Gracias" is not thanks', () => {
  const QS = ['¿Cuántos años tiene?', '¿Tiene familia aquí?', '¿Es pesado el trabajo?', '¿A qué hora empieza a trabajar?', '¿Hace mucho calor aquí en el verano?', '¿Cuánto tiempo tiene viviendo aquí?',
    '¿Vive cerca?', '¿Habla inglés?', '¿Qué hace en su tiempo libre?', '¿Le gusta cocinar?', '¿Tiene nietos?', '¿Cómo se llaman sus hijos?', '¿Cuántos años tienen sus hijos?', '¿Su esposo trabaja?',
    '¿Es difícil vivir aquí?', '¿Cuándo llegó a Estados Unidos?', '¿Por qué se vino para acá?', '¿Extraña México?', '¿Va mucho a la iglesia?', '¿Hay mucho tráfico?', '¿Ha habido incendios?',
    '¿Le gusta su casa?', '¿Renta o es dueña?', '¿Qué me recomienda comer?', '¿Dónde está la tienda más cercana?', '¿Cómo llego al centro?', '¿Se acuerda de cómo era antes?', '¿Qué opina del barrio?',
    '¿Es seguro el barrio?', '¿Qué tal la escuela de sus hijos?', '¿Le gusta el fútbol?', '¿Hace frío en la noche?', '¿Qué tal el trabajo?', '¿Tiene carro?', '¿Cómo se va al trabajo?', '¿Está cansada?',
    '¿Qué va a hacer este fin de semana?', '¿Qué va a cocinar para Navidad?', '¿Dónde nació?'];
  const unknown = QS.filter(q => understand(q, { world }).intent === 'unknown');
  assert.deepEqual(unknown, []);
  const expect = [['¿Cómo se llaman sus hijos?', 'family', 'names'], ['¿Cuántos años tienen sus nietos?', 'family', 'ages'], ['¿Su esposo trabaja?', 'family', 'partnerJob'],
    ['¿Tiene nietos?', 'family', null], ['¿Cuántos años tiene?', 'about-them', null], ['¿Extraña México?', 'about-them', null], ['¡Feliz Día de Acción de Gracias!', 'greeting', null]];
  for (const [q, intent, sub] of expect) {
    const u = understand(q, { world });
    assert.equal(u.intent, intent, q);
    if (sub) assert.equal(u.flags.sub, sub, q);
  }
  assert.ok(!understand('¡Feliz Día de Acción de Gracias!', { world }).scores.thanks, '"gracias" inside the holiday is not thanks');
  assert.equal(understand('¿Extraña México?', { world }).entities.homeland, 'miss');
  // a limited-English Spanish speaker answers them from her own life
  const abuela = residents('90011', 1, spanishLimited)[0];
  const c = conv(abuela, 3);
  c.greet();
  for (const q of ['¿Cuántos años tiene?', '¿Tiene familia aquí?', '¿Qué hace en su tiempo libre?', '¿Cuándo llegó a Estados Unidos?']) {
    const line = c.reply(q);
    assert.ok(line.gloss && !IGNORANCE.test(line.gloss) && !/no sé|no sabría/i.test(line.text), `${abuela.id} "${q}": "${line.text}" [${line.gloss}]`);
  }
  assert.ok(c.reply('¿Cuántos años tiene?').text.length > 0);
});

test('hello in another language: answered in kind by someone who speaks it, kindly in English by anyone else', () => {
  const korean = anyResidents('90005', 1, x => adult(x) && x.languages.home === 'korean', 3, 800)[0];
  const plain = residents('94110', 1, x => adult(x) && englishOnly(x))[0];
  if (korean) {
    const c = conv(korean, 4);
    c.greet();
    const line = c.reply('안녕하세요!');
    assert.equal(line.intent, 'greeting');
    assert.match(line.text, /[가-힯]/, `${korean.id} answers in Korean: "${line.text}"`);
  }
  const c = conv(plain, 4);
  c.greet();
  const ko = c.reply('안녕하세요!');
  assert.equal(ko.intent, 'greeting');
  assert.match(ko.text, /Korean/, `${plain.id}: "${ko.text}"`);
  const zh = c.reply('你好吗？');
  assert.equal(zh.intent, 'how-are-you');
  assert.match(zh.text, /Chinese/, `${plain.id}: "${zh.text}"`);
  // a pending "how are you?" never swallows a hello in another language
  const d = conv(plain, 7);
  d.greet();
  d.st.pending = 'howAreYou';
  assert.equal(d.reply('Xin chào!').intent, 'greeting');
});

test('small things that read wrong: no "I think honestly", no doubled filler, no contradicting gestures, no "Anyway" in a greeting', () => {
  for (const zip of ['94110', '96001', '93905', '92101']) {
    for (const npc of residents(zip, 3, x => adult(x) && englishOnly(x))) {
      const c = conv(npc, 6);
      const lines = [c.greet().text];
      for (const q of ['What do you think about the rent here?', 'What do you think of the schools?', 'Where can I get good ramen?', 'Is housing too expensive?', 'Thoughts on the water situation?']) lines.push(c.reply(q).text);
      for (let k = 0; k < 12; k++) lines.push(c.reply('Purple monkey dishwasher?').text);
      for (const t of lines) {
        assert.ok(!/^I think (honestly|basically|actually|you know|well|so|look)\b/im.test(t), `${npc.id}: "${t}"`);
        const fillers = (t.toLowerCase().match(/\bhonestly\b/g) || []).length;
        assert.ok(fillers <= 1, `${npc.id}: "${t}"`);
        assert.ok(!/shakes \w+ head[^.)]*\band nods\b|\bnods and shakes\b|\bsmiles and smiles\b/.test(t), `${npc.id}: "${t}"`);
      }
      assert.ok(!/^(Kumusta!|¡Buenas!|Hi there\.)?\s*Anyway,/.test(lines[0]), `${npc.id}: "${lines[0]}"`);
    }
  }
});
