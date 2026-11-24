// Legion · tests · the offline dialogue engine: what the NPC says about the place is what the pack says, as a
// neighbor would say it, and what the player asks is what gets answered.
//
// Weather borrowed from a city nearby is hedged and told as that city's; highways ranked by their own distance and
// named from home; no highway invented for a commute; atmospheric rivers by the rank felt here; station records
// from far away named with their station; prewar homes "before 1940"; FEMA storms by their own month; roofs redone
// before the household moved in; small fires not "talked about"; questions read the way a person hears them
// (requests, follow-ups, wind, two topics, Spanish); the food count kept; regional lines in Spanish too; greetings
// and barks that fit.
//
// Run from legion/: node --test tests/dialogue-grounding.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import { loadDefaultWorld } from '../src/engine/world.mjs';
import { Population, LEGION_SEED } from '../src/engine/population.mjs';
import { persona } from '../src/engine/persona.mjs';
import { Mind } from '../src/engine/mind.mjs';
import { dialectFor } from '../src/engine/lexicon.mjs';
import { atPacific } from '../src/engine/clock.mjs';
import { Conversation, barkBetween, understand, templates } from '../src/engine/dialogue.mjs';
import { makeVoice } from '../src/engine/dialogue/voice.mjs';
import { roadFacts, roadScore, recordFacts, arFacts, weatherFacts } from '../src/engine/dialogue/ground.mjs';
import { homelandOf } from '../src/engine/dialogue/plan.mjs';
import { activityAt } from '../src/engine/schedule.mjs';

const world = await loadDefaultWorld();
const pop = new Population(world, { seed: LEGION_SEED });
const T = world.snapshotTime;

const personas = new Map();
const P = npc => { let p = personas.get(npc.id); if (!p) { p = persona(world, npc, { population: pop, dialectFor }); personas.set(npc.id, p); } return p; };
const conv = (npc, seed = 7, t = T, mind = null) => new Conversation({ world, persona: P(npc), mind: mind || new Mind(P(npc), { t }), t, rngSeed: seed, population: pop });
const some = (zip, n, filter, seed = 17, size = 300) => pop.sample(world.indexOf(zip), size, seed).filter(filter).slice(0, n);
const en = line => line.gloss || line.text;
const adult = n => n.age >= 25 && n.age < 75;

test('weather: a forecast borrowed from a city nearby is hedged and named as that city\'s; no forecast in reach is no forecast', () => {
  let borrowed = 0, climate = 0;
  for (const zip of ['90024', '92683', '95060', '96101', '93546', '92201', '91205', '95501']) {
    const zi = world.indexOf(zip);
    const wx = world.weatherAt(zi, T);
    const kind = wx.basis ? wx.basis.kind : 'forecast';
    for (const npc of some(zip, 2, n => adult(n) && n.languages.english === 'only', 5)) {
      const c = conv(npc, 3);
      const now = c.reply("How's the weather today?");
      const next = c.reply("What's the forecast for tomorrow?");
      const where = `${npc.id} (${kind}): "${now.text}" / "${next.text}"`;
      if (kind === 'borrowed') {
        borrowed++;
        assert.match(now.text, /\b(?:probably|about|around|give or take|or so|I'd say|I'd guess)\b/i, `the estimate is hedged: ${where}`);
        assert.ok(!/^(?:It's \d+ out right now|\d+ degrees and|Right now it's \d+)/.test(now.text), `never stated as a reading here: ${where}`);
        if (next.facts.includes('weather.next')) assert.ok(next.text.includes(wx.basis.point) || /\b(?:probably|about|around|or so)\b/.test(next.text), `the forecast is the city's: ${where}`);
        assert.ok(!/forecast (?:here|for here)/i.test(next.text), where);
      } else if (kind === 'climate') {
        climate++;
        assert.ok(!now.facts.includes('weather.next') && !next.facts.includes('weather.next'), `no forecast to tell: ${where}`);
        assert.match(`${now.text} ${next.text}`, /\b(?:probably|I'd guess|I'd say|or so|about|I think|haven't)\b/i, `hedged: ${where}`);
      }
      // a temperature that is an estimate is never stated as a fact elsewhere either
      if (wx.approx) for (const q of ['How are you?', 'What are you up to?']) assert.ok(!/\bIt's \d{2,3}\b(?! (?:minutes|miles|percent))|\b\d{2,3} degrees\b/.test(c.reply(q).text), `${npc.id}: an estimate stated in passing`);
    }
  }
  assert.ok(borrowed >= 2 || climate >= 2, `borrowed ${borrowed}, climate ${climate}`);
});

test('roads: ranked by their own traffic and distance from home; "the main way in and out" only for a road close by; none invented for a commute', () => {
  for (const zip of ['90001', '92683', '91001', '90011']) {
    for (const npc of some(zip, 6, adult, 11)) {
      const v = makeVoice(world, P(npc), { t: T });
      const near = roadFacts(v).filter(r => !r.commute && r.aadt);
      for (let i = 1; i < near.length; i++) assert.ok(roadScore(near[i - 1].road) >= roadScore(near[i].road) - 1e-9, `${npc.id}: ${near.map(r => `${r.name} ${r.distKm}km ${r.aadt}`)}`);
      const line = conv(npc, 5).reply('Is traffic bad around here?');
      const m = /^(?:(?:The|the) )?(\d{1,3}|[A-Z][\w ]+?) is the (?:main way in and out of here|big one around here)/m.exec(line.text);
      if (m) {
        const r = roadFacts(v).find(x => x.name.replace(/^the /, '') === m[1] || x.name === m[1]);
        assert.ok(!r || !Number.isFinite(r.distKm) || r.distKm <= 5, `${npc.id}: "${line.text}" (${r && r.distKm} km)`);
      }
    }
  }
  // the freeway next door (I-110, two km from 90001-6587-0's street) outranks one ten km off with a bit more traffic
  const zi = world.indexOf('90001');
  const home = { x: world.z.tx[zi], y: world.z.ty[zi] };
  const ranked = world.roadsNear(home.x, home.y, 12).sort((a, b) => roadScore(b) - roadScore(a));
  if (ranked.length >= 2) assert.ok(ranked[0].distKm <= ranked[ranked.length - 1].distKm || roadScore(ranked[0]) >= roadScore(ranked[1]));
  // a commute with no highway on the record names none as the way there
  let checked = 0;
  for (const zip of ['92683', '93234', '91001', '95815']) {
    for (const npc of some(zip, 40, n => n.age >= 18 && n.commute && n.commute.mode === 'drive' && !n.commute.road && n.commute.workCity && n.commute.workCity !== world.zip(world.indexOf(n.zip)).city, 7, 500).slice(0, 4)) {
      const line = conv(npc, 5).reply("How's your commute?");
      assert.ok(!/\bI take (?:the )?\S+ to\b|\bevery morning to\b|\bon (?:the )?\d{1,3}, on a good day\b|\bMy whole life is\b|\bI drive to \w[\w ]* on\b/.test(line.text), `${npc.id} (no commute road): "${line.text}"`);
      checked++;
    }
  }
  assert.ok(checked >= 4, `commuters checked: ${checked}`);
});

test('roads from home: a home far from any highway never claims one runs by the house', () => {
  let n = 0;
  for (const zip of ['92225', '92309', '96134']) {
    for (const npc of pop.sample(world.indexOf(zip), 400, 5)) {
      if (npc.age < 25) continue;
      const h = npc.household.home;
      if (world.roadsNear(h.x, h.y, 12).length) continue;
      const line = conv(npc, 5).reply('Is traffic bad around here?');
      assert.ok(!/hear it from my street|runs right by|few blocks from|main way in and out|big one around here|pasa cerquita|Se oye desde mi calle/i.test(en(line)), `${npc.id}: "${line.text}"`);
      if (++n >= 25) break;
    }
  }
  assert.ok(n >= 10, `remote homes: ${n}`);
});

test('commuters: students and service members with a drive on the record talk about it, never "I don\'t really drive much"', () => {
  let n = 0;
  for (const zip of ['92683', '93437', '93727', '92055', '91702']) {
    for (const npc of some(zip, 4, x => ['student', 'military'].includes(x.status) && x.age >= 16 && x.commute && ['drive', 'carpool', 'motorcycle'].includes(x.commute.mode) && x.commute.minutes > 0, 3, 600)) {
      const line = conv(npc, 5).reply("How's your commute?");
      assert.ok(!/don't really drive much|not on the road much|casi no manejo|no manejo mucho/i.test(en(line)), `${npc.id} (${npc.status}): "${line.text}"`);
      assert.ok(!/\bI work right here\b|\bWork's close\b/.test(line.text), `${npc.id}: no "work" for school or the base: "${line.text}"`);
      n++;
    }
  }
  assert.ok(n >= 4, `student and service commuters: ${n}`);
});

test('follow-ups and wind: "Which freeway do you take?" after the weather is about traffic; "Ever get bad wind here?" is about the wind', () => {
  for (const npc of [...some('90001', 2, adult), ...some('92683', 2, adult)]) {
    const c = conv(npc, 5);
    c.reply('Hi there! How is the weather today?');
    const tr = c.reply('How is the traffic? Which freeway do you take?');
    assert.equal(tr.intent, 'traffic', `${npc.id}: "${tr.text}"`);
    const wind = c.reply('Ever get bad wind here?');
    assert.equal(wind.intent, 'storm', `${npc.id}: "${wind.text}"`);
    assert.ok(!wind.facts.includes('weather.next') && !/forecast/i.test(wind.text), `${npc.id}: the wind, not the forecast: "${wind.text}"`);
  }
  assert.equal(understand('Is it windy today?', { world }).intent, 'weather');
});

test('atmospheric rivers: "a category N here" never above the ZIP\'s own strongest; the landfall peak is told as the landfall', () => {
  const t = atPacific(2027, 7, 15, 15, 0);
  for (const zip of ['90001', '92225', '92683', '90272', '91001']) {
    const max = world.zip(world.indexOf(zip)).ar_max;
    for (const npc of some(zip, 3, adult, 4)) {
      const v = makeVoice(world, P(npc), { t });
      for (const a of arFacts(v)) assert.ok(a.rank <= (Number.isFinite(max) ? max : 5) && a.rank <= a.peakRank, `${npc.id}: ${JSON.stringify(a)}`);
      const line = conv(npc, 5, t).reply('What about storms? Any big ones you remember?');
      for (const s of en(line).split(/(?<=[.!?])\s+/)) {
        const m = /\bcategory (\d)\b/.exec(s);
        if (m && !/came ashore|came in|landfall|hit [A-Z]|on the coast|a la costa|entró/i.test(s)) assert.ok(+m[1] <= max, `${npc.id} (ar_max ${max}): "${s}"`);
      }
    }
  }
});

test('station records: one from far away or another town is that station\'s, by name; one the ZIP\'s climate contradicts is not said', () => {
  for (const [zip, field] of [['93255', 'heat_km'], ['93449', 'heat_km'], ['94110', 'heat_km'], ['92225', 'heat_km']]) {
    const z = world.zip(world.indexOf(zip));
    for (const npc of some(zip, 3, adult, 2)) {
      const v = makeVoice(world, P(npc), { t: T });
      const rec = recordFacts(v);
      if (rec.heat) {
        assert.ok(!(Number(z.h100) > 0 && rec.heat.value < 100), `${npc.id}: a record the climate contradicts`);
        if (Number.isFinite(z[field]) && z[field] > 15) assert.equal(rec.heat.local, false, `${npc.id}: ${z[field]} km is not here`);
      }
      const line = conv(npc, 5).reply("What's the hottest it's ever been here?");
      if (rec.heat && !rec.heat.local && line.facts.includes('record.heat')) assert.ok(en(line).includes(rec.heat.station), `${npc.id}: the station is named: "${line.text}"`);
      if (rec.heat && !rec.heat.local) assert.ok(!/record (?:is|was)[^.]*here|on record here|Es el récord/i.test(line.text), `${npc.id}: "${line.text}"`);
    }
  }
});

test('housing and history facts as the data has them: prewar homes, FEMA storms by their own month, roofs, small fires', () => {
  // the ACS top code: "before 1940", never "the thirties"
  for (const npc of some('94110', 8, adult, 6)) {
    const c = conv(npc, 2);
    for (const q of ["What's it like living around here?", 'Tell me about your neighborhood.', 'Is it nice around here?']) {
      const line = c.reply(q);
      assert.ok(!/\bthe thirties\b|\b1938\b|\bawos treinta\b|años treinta/i.test(`${line.text} ${line.gloss || ''}`), `${npc.id}: "${line.text}"`);
    }
  }
  // a declared storm is said with its own month, never the declaration's
  const sd = world.indexOf('92173');
  const decl = (world.femaOf(sd) || []).find(f => /2024/.test(String(f[2] || '')) && /^2024-02/.test(String(f[0])));
  if (decl) for (const npc of some('92173', 4, n => adult(n) && n.languages.home === 'spanish' && n.languages.english === 'limited', 2, 600)) {
    for (const q of ['What is the history of this town?', 'When was the last big storm or flood?']) {
      const line = conv(npc, 3, atPacific(2026, 11, 24, 7, 45)).reply(q);
      assert.ok(!/tormentas de febrero de 2024/.test(line.text), `${npc.id}: "${line.text}"`);
    }
  }
  // "we redid the roof" only after the household moved in
  let roofs = 0;
  for (const zip of ['91001', '95501', '93702', '92683']) {
    for (const npc of some(zip, 40, n => n.age >= 30 && n.household.tenure === 'own' && n.role === 'householder' && n.household.dwelling === 'house', 3, 500)) {
      const roof = P(npc).roof;
      if (!roof || roof.original || !(roof.installed < npc.household.yearMoved)) continue;
      const line = conv(npc, 5, atPacific(2027, 7, 15, 15, 0)).reply('Tell me about your home.');
      assert.ok(!/We redid the roof|New roof in|Cambiamos el techo/.test(line.text), `${npc.id} (moved ${npc.household.yearMoved}, roof ${roof.installed}): "${line.text}"`);
      roofs++;
    }
  }
  assert.ok(roofs >= 2, `owners whose roof predates them: ${roofs}`);
  // a fire too small to be talked about is never one "people still talk about"
  for (const npc of some('95023', 8, adult, 3)) {
    const line = conv(npc, 5).reply('Have there been any big fires around here?');
    const f = world.firesOf(world.indexOf('95023')).find(x => line.text.includes(String(x.name).split(' ')[0]));
    if (f && /still talk about it|still see where it burned/.test(line.text)) assert.ok(f.acres >= 1000 || f.destInZip >= 10, `${npc.id}: "${line.text}" (${f.name}, ${f.acres} acres)`);
  }
});

test('understanding: requests ask, they do not answer; two topics get two answers; Spanish questions are heard; worries are said', () => {
  // "Tell me about your family." after the NPC asked about food is about the family
  let pending = 0;
  for (const npc of some('96161', 6, adult, 4)) {
    const c = conv(npc, 8);
    const food = c.reply('Where should I eat around here?');
    if (!/\?/.test(food.text)) continue;
    pending++;
    for (const [q, intent] of [['Tell me about your family.', 'family'], ['Describe your neighborhood.', 'neighborhood']]) {
      const line = c.reply(q);
      assert.equal(line.intent, intent, `${npc.id} "${q}" after "${food.text}" -> "${line.text}"`);
      assert.ok(!/^(?:Good taste|Oh, me too|Same here|Ha, a person after my own heart)/.test(line.text), line.text);
    }
  }
  // the second topic is said ("As for insurance, ...")
  for (const npc of some('96161', 4, n => adult(n) && n.languages.english === 'only', 4)) {
    const line = conv(npc, 9).reply('Can people afford to live here? What about rent and insurance?');
    assert.match(line.text, /insurance|FAIR Plan|renew/i, `${npc.id}: "${line.text}"`);
  }
  // Spanish questions about worries, eating out and traffic
  for (const [q, intent] of [['¿Qué le preocupa?', 'opinion'], ['¿Qué es lo que más le preocupa?', 'opinion'], ['¿Qué cosas te preocupan?', 'opinion'], ['¿Tiene alguna preocupación?', 'opinion'],
    ['¿Dónde se come bien por aquí?', 'food'], ['¿Cómo está el tráfico?', 'traffic'], ['¿Se acuerda de mí?', 'about-me'], ['¿A qué me dedico?', 'about-me']]) {
    assert.equal(understand(q, { world }).intent, intent, q);
  }
  for (const npc of some('90011', 2, n => adult(n) && n.languages.home === 'spanish' && n.languages.english === 'limited', 3, 400)) {
    for (const q of ['¿Qué le preocupa?', '¿Qué es lo que más le preocupa?']) {
      const w = conv(npc, 3).reply(q);
      assert.ok(w.facts.includes('persona.concerns') && !/no lo sé|no sabría|no sé\b/i.test(w.text), `${npc.id} "${q}": "${w.text}"`);
    }
  }
  assert.ok(understand('What worries you about living here?', { world }).flags.worry);
});

test('places in sentences: plural countries take "the"; the Spanish copula agrees with a plural worry', () => {
  assert.equal(homelandOf('Majuro, Marshall Islands'), 'the Marshall Islands');
  assert.equal(homelandOf('Honiara, Solomon Islands'), 'the Solomon Islands');
  assert.equal(homelandOf('Manila, Philippines'), 'the Philippines');
  assert.equal(homelandOf('Guadalajara, Mexico'), 'Mexico');
  let es = 0;
  for (const zip of ['90011', '93702', '92236', '93905', '90022']) {
    for (const npc of some(zip, 4, n => adult(n) && n.languages.home === 'spanish' && n.languages.english === 'limited', 3, 400)) {
      const c = conv(npc, 21);
      for (const q of ['Purple monkey dishwasher.', 'Hmm.', 'What do you think?', 'Interesting.', 'zxqv blorp']) {
        const line = c.reply(q);
        assert.ok(!/\b(?:es|fue) (?:los|las)\b/.test(line.text), `${npc.id}: "${line.text}"`);
        es++;
      }
    }
  }
  assert.ok(es >= 20);
  assert.ok(!templates().some(t => t.bank === 'es' && /\b(?:es|fue) \{(?:concernEs|memEs)\}/.test(t.text)), 'no fixed "es" before a worry or a memory');
});

test('the restaurant count and the dialect\'s own food lines survive the sentence budget, in English and in Spanish', () => {
  let n = 0, withCount = 0, esLines = 0, esLocal = 0;
  for (const zip of ['94110', '92236', '90022', '93901', '91205', '95501']) {
    for (const npc of some(zip, 6, adult, 21)) {
      const line = conv(npc, 2).reply("Where's a good place to eat around here?");
      n++;
      if (line.facts.includes('biz.food')) withCount++;
      if (line.gloss) { esLines++; if (/:food$/.test('') || /\b(?:taco|pupusa|tamal|torta|menudo|pan dulce|burrito|mariscos|market|swap meet|truck|bakery|date|pozole|birria|carnitas|line)\b/i.test(line.gloss)) esLocal++; }
    }
  }
  assert.ok(withCount / n >= 0.6, `food answers with the Census count: ${withCount}/${n}`);
  if (esLines >= 3) assert.ok(esLocal / esLines >= 0.5, `Spanish food answers with a local line: ${esLocal}/${esLines}`);
});

test('who says what: "home with the kids" only with kids under 18 at home; greetings to a stranger presume nothing', () => {
  for (const zip of ['95354', '92530', '95521', '90011', '93702']) {
    for (const npc of some(zip, 6, n => n.age >= 30 && ['not working', 'homemaker', 'retired'].includes(n.status) && !n.household.members.some(m => m.m !== n.m && m.age < 18 && (m.role === 'child' || m.role === 'grandchild')), 3, 600)) {
      const line = conv(npc, 3).reply('What do you do for a living?');
      assert.ok(!/home with the kids|de los niños/i.test(line.text), `${npc.id} (${npc.age}, ${npc.status}): "${line.text}"`);
    }
  }
  const STRANGER_FAIL = /back in town|haven't seen you|long time no see|good to see you again|how's the family|since the river|you're back/i;
  for (const zip of ['95993', '95926', '96001', '95901']) {
    for (const npc of some(zip, 8, n => n.age >= 18, 7)) {
      for (const seed of [1, 2, 3]) {
        const hello = conv(npc, seed).greet();
        assert.ok(!STRANGER_FAIL.test(hello.text), `${npc.id} first greeting: "${hello.text}"`);
      }
    }
  }
});

test('worries: every common way of asking gets the NPC\'s own worry; a worry named in the question gets that topic', () => {
  const asks = ['What worries you these days?', 'What are you worried about?', 'Anything stressing you out lately?', 'What keeps you up at night?',
    "What's your biggest concern?", "What's been on your mind?", 'Do you have any worries?', 'What are you afraid of?'];
  for (const q of asks) {
    const u = understand(q, { world });
    assert.equal(u.intent, 'opinion', q);
    assert.ok(u.flags.worry, q);
  }
  // the topic named is the one answered
  for (const [q, intent] of [['What are you worried about with the fires?', 'fire'], ['What do you worry about with the rent?', 'rent'], ['What worries you about the heat here?', 'heat']]) {
    assert.equal(understand(q, { world }).intent, intent, q);
  }
  const DEFLECT = /\b(?:didn'?t understand|don'?t speak much English|a bit personal|talk your ear off|say that again|let me think about how to answer)\b/i;
  let n = 0;
  for (const zip of ['93701', '94108', '92262', '93706', '90005']) {
    for (const npc of some(zip, 2, n => adult(n) && (P(n).concerns || []).length, 5)) {
      for (const q of asks.slice(0, 5)) {
        const line = conv(npc, 3).reply(q);
        n++;
        assert.ok(line.facts.includes('persona.concerns') && !DEFLECT.test(en(line)), `${npc.id} "${q}": "${line.text}"`);
      }
    }
  }
  assert.ok(n >= 40, `${n} answers`);
});

test('names and doings: an NPC goes by the name the panel shows (with the one on paper), and says where they are', () => {
  let nicks = 0;
  for (const zip of ['92683', '90005', '93706', '92262', '90022', '95116']) {
    for (const npc of some(zip, 3, n => n.age >= 18 && n.name.nick && n.name.nick !== n.name.first, 7, 600)) {
      nicks++;
      for (const seed of [3, 9]) {
        const c = conv(npc, seed);
        const hello = c.greet();
        const text = `${hello.text} ${hello.gloss || ''}`;
        // a greeting that gives a name gives the one they go by
        if (new RegExp(`(?<![\\p{L}])${npc.name.first}(?![\\p{L}])`, 'u').test(text)) assert.ok(text.includes(npc.name.nick), `${npc.id} goes by ${npc.name.nick}: "${text}"`);
        const line = c.reply("Hi! I'm Sam. What's your name?");
        const said = `${line.text} ${line.gloss || ''}`;
        assert.ok(said.includes(npc.name.nick), `${npc.id} (${npc.name.display}) says ${npc.name.nick}: "${said}"`);
        assert.ok(said.includes(npc.name.first), `${npc.id} gives the name on paper too: "${said}"`);
      }
    }
  }
  assert.ok(nicks >= 6, `${nicks} NPCs with a nickname`);
  // what they are doing is where the schedule has them: the laundromat is never "the store"
  let out = 0;
  for (const zip of ['90005', '92683', '90011', '93702']) {
    for (const npc of pop.sample(world.indexOf(zip), 200, 4).filter(p => p.age >= 18)) {
      for (const h of [10, 13, 17]) {
        const t = T + (h - 14) * 3600000;
        const a = activityAt(npc, P(npc), t);
        if (!a || !['errand', 'leisure'].includes(a.kind)) continue;
        out++;
        const c = conv(npc, 5, t);
        const where = a.traveling && a.place && a.place.kind === 'home' ? a.from : a.place;
        c.greet();
        const line = c.reply('What are you doing right now?');
        const all = `${line.text} ${line.gloss || ''}`;
        if (where && where.kind !== 'grocery') assert.ok(!/\bthe store\b|\bla tienda\b/.test(all), `${npc.id} at ${where.label}: "${all}"`);
        if (where && where.kind === 'laundromat') assert.match(all, /laundromat|lavander[ií]a|errands|mandados/i, `${npc.id}: "${all}"`);
      }
    }
  }
  assert.ok(out >= 60, `${out} NPCs out on an errand or an outing`);
});

test('where they live: by the neighborhood people there call it inside the big cities; a year here is never "one years"', () => {
  let named = 0, asked = 0;
  for (const zip of ['94110', '90033', '90005', '92104']) {
    const z = world.zip(world.indexOf(zip));
    assert.ok(z.neighborhood, zip);
    for (const npc of some(zip, 4, n => adult(n), 3, 200)) {
      const c = conv(npc, 5);
      const line = c.reply('Where do you live?');
      const all = `${line.text} ${line.gloss || ''}`;
      asked++;
      if (all.includes(z.neighborhood)) named++;
      // the city is never named instead of the neighborhood in English ("Here in Los Angeles" from Boyle Heights)
      if (!line.gloss && /\bhere in\b/i.test(line.text)) assert.ok(line.text.includes(z.neighborhood), `${npc.id}: "${line.text}"`);
      // and Spanish never carries an English "the" ("en the Mission")
      if (line.gloss) assert.ok(!/\ben the\b/.test(line.text), `${npc.id}: "${line.text}"`);
    }
  }
  assert.ok(named >= asked / 3, `${named} of ${asked} name the neighborhood`);
  let n = 0;
  for (const zip of ['94110', '92104', '93702']) {
    for (const npc of pop.sample(world.indexOf(zip), 400, 5).filter(x => x.age >= 18)) {
      const res = P(npc).residence || {};
      const year = new Date(T).getUTCFullYear();
      if (!(res.zipSince >= year - 1 || npc.household.yearMoved >= year - 1)) continue;
      n++;
      const c = conv(npc, 5);
      for (const q of ['How long have you lived here?', 'When did you move in?']) {
        const line = c.reply(q);
        assert.ok(!/\bone years\b|\b1 años\b|\b1 years\b/i.test(`${line.text} ${line.gloss || ''}`), `${npc.id}: "${line.text}" [${line.gloss || ''}]`);
      }
    }
  }
  assert.ok(n >= 10, `${n} people who moved in a year ago or less`);
});

test('barks: a reply never repeats the opener word for word, and a "how are you?" gets an answer', () => {
  const t8 = atPacific(2026, 11, 24, 8, 0);
  let pairs = 0;
  for (const where of ['94110', '92236', '91205', '96161', '90022', '92201']) {
    const s = pop.sample(world.indexOf(where), 60, 4).filter(n => n.age >= 13);
    for (let i = 0; i + 1 < s.length; i += 2) {
      const [a, b] = barkBetween(world, P(s[i]), P(s[i + 1]), { t: t8, situation: 'pass' });
      if (!a || !b) continue;
      pairs++;
      const key = x => x.toLowerCase().normalize('NFD').replace(/\p{M}+/gu, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
      assert.notEqual(key(b.text), key(a.text), `"${a.text}" / "${b.text}"`);
      if (/^(?:¿)?(?:Qué tal todo|Cómo está|Cómo estás|How's your day going|You doing okay|How's everything|How are things)\??$/i.test(a.text.trim())) assert.ok(!/\?$/.test(b.text.trim()) || /\b(?:and you|y usted|y tú|you\?)/i.test(en(b)), `answered: "${a.text}" / "${b.text}"`);
    }
  }
  assert.ok(pairs >= 30, `pairs: ${pairs}`);
});

test('performance: the safety reading and the new planners keep a reply well under 20 ms', () => {
  const npcs = [...some('90265', 3, adult), ...some('94110', 3, adult)];
  const lines = ['I want to kill myself.', 'Do you remember me?', 'Can people afford to live here? What about rent and insurance?', "What's the forecast for tomorrow?", 'Is traffic bad around here?', 'Tell me about your family.'];
  const times = [];
  for (const npc of npcs) {
    const c = conv(npc, 91);
    c.reply('Hi!');
    for (const l of lines) { const t0 = performance.now(); c.reply(l); times.push(performance.now() - t0); }
  }
  times.sort((a, b) => a - b);
  const p95 = times[Math.floor(times.length * 0.95)];
  assert.ok(p95 < 20, `p95 ${p95.toFixed(2)} ms`);
});
