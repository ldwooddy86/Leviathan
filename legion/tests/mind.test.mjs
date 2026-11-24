// Mind: appraisal (intents, topics, sentiment, toxicity, facts), the memory stream and recall ranking,
// reflection into beliefs, relationships and feelings, needs and mood over simulated time, JSON round trips
// and the three stores.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadDefaultWorld } from '../src/engine/world.mjs';
import { Population, LEGION_SEED } from '../src/engine/population.mjs';
import { persona } from '../src/engine/persona.mjs';
import { activityAt } from '../src/engine/schedule.mjs';
import { atPacific } from '../src/engine/clock.mjs';
import { Mind, MemoryStore, LocalStorageStore, FileStore, appraise, stem, emotionLabel, baselineMood, TOPICS, INTENTS, FEELINGS } from '../src/engine/mind.mjs';

const world = await loadDefaultWorld();
const pop = new Population(world, { seed: LEGION_SEED });
const npcAt = (zip, h = 5, m = 0) => pop.person(world.indexOf(zip), h, m);
const P = npc => persona(world, npc, { population: pop });
const T0 = atPacific(2026, 11, 24, 9, 0);
const H = 3600000;
const withBig5 = (p, big5) => Object.assign({}, p, { big5: Object.assign({}, p.big5, big5) });

test('appraisal: intents', () => {
  const cases = [
    ['Hi there!', ['greeting']], ['Hello, how are you?', ['greeting', 'question']], ['Good morning', ['greeting']], ['Morning! Hot one today.', ['greeting']],
    ['Where can I get good tacos around here?', ['question']], ['Is the fire getting closer?', ['question']],
    ['You are so kind, thank you!', ['compliment', 'thanks']], ['Nice garden!', ['compliment']], ['your house is beautiful', ['compliment']],
    ["You're an idiot.", ['insult']], ['Shut up, nobody cares', ['insult']], ['f*** you', ['insult']], ['You suck', ['insult']],
    ['Thanks a lot', ['thanks']], ['gracias', ['thanks']], ['Sorry about that', ['apology']], ['my bad', ['apology']],
    ['Bye!', ['farewell']], ['See you later', ['farewell']], ['Gotta go, have a good one', ['farewell']],
    ['Can you tell me where the post office is?', ['request', 'question']], ['Please help me find the trailhead', ['request']],
    ["Hi, I'm Sam. I'm from Fresno.", ['greeting', 'self-introduction']], ['My name is maria and I work as a nurse.', ['self-introduction']],
  ];
  for (const [text, want] of cases) {
    const a = appraise(text);
    for (const w of want) assert.ok(a.intents.includes(w), `${text} → ${w} (got ${a.intents})`);
    for (const i of a.intents) assert.ok(INTENTS.includes(i));
  }
  for (const [text, not] of [['Evening plans?', 'greeting'], ["I'm sorry to hear about your house", 'apology'], ["I'll do it later", 'farewell'], ['What a stupid question', 'insult'], ['This weather is stupid', 'insult'], ['Take care', 'request'], ['Hell yeah, the Warriors won!', 'insult']]) {
    assert.ok(!appraise(text).intents.includes(not), `${text} is not ${not}`);
  }
});

test('appraisal: topics, sentiment and toxicity', () => {
  const topics = [
    ['The traffic on the 405 was hella bad', 'traffic'], ['Did your insurance drop you too?', 'insurance'], ['Is the FAIR Plan any good?', 'insurance'],
    ['The smoke from the fire was awful', 'fire'], ['The rent is killing me', 'rent'], ['I got fired last week', 'job'], ['Remember back in the day?', 'history'],
    ['Did you see the Dodgers game?', 'sports'], ['Is it gonna rain tomorrow?', 'weather'], ['My kids go to the middle school', 'family'],
    ['My kids go to the middle school', 'school'], ['Best pho around here?', 'food'], ['I have a doctor appointment', 'health'], ['How long have you lived in this neighborhood?', 'neighborhood'],
    ['Mortgage rates and home prices are wild', 'housing'],
  ];
  for (const [text, want] of topics) { const a = appraise(text); assert.ok(a.topics.includes(want), `${text} → ${want} (got ${a.topics})`); for (const k of a.topics) assert.ok(TOPICS.includes(k)); }
  assert.ok(!appraise('I got fired last week').topics.includes('fire'));
  assert.deepEqual(appraise('Is the fire season getting worse up here?').topics, ['fire']);
  // a disagreeable neighbor warms more slowly to the same compliments
  const cold = new Mind(withBig5(P(npcAt('93721')), { A: 0.05 }), { t: T0 }), kind = new Mind(withBig5(P(npcAt('93721')), { A: 0.9 }), { t: T0 });
  for (const x of [cold, kind]) x.observe({ from: 'player', text: 'You are so kind, thank you!', t: T0 });
  assert.ok(kind.relationship('player').affinity > cold.relationship('player').affinity);
  assert.ok(!appraise('Can you tell me where the post office is?').topics.includes('job'));
  assert.ok(!appraise("that's sick, dude").topics.includes('health'));
  const s = t => appraise(t).sentiment;
  assert.ok(s('This is hella good') > 0.4 && s('The traffic was hella bad') < -0.4);
  assert.ok(s('not bad at all') > 0 && s("I'm not happy about the rent") < 0);
  assert.ok(s('You are wonderful, thank you so much!') > 0.7);
  assert.ok(s('I hate this, it is terrible') < -0.7);
  assert.ok(s('The fire was scary but the firefighters were amazing') > 0, 'what comes after "but" weighs more');
  for (const t of ['hello', 'The bus was late', 'Is it going to rain?']) assert.ok(Math.abs(s(t)) <= 0.3, t);
  const tox = t => appraise(t).toxicity;
  assert.ok(tox("You're an idiot.") >= 0.5 && tox('f*** you') >= 0.5 && tox('I will hurt you') >= 0.7);
  assert.ok(tox('Hell yeah, the Warriors won!') === 0 && tox('This is hella good') === 0 && tox('Hello, neighbor') === 0);
  assert.ok(tox('damn, that was a good burrito') > 0 && tox('damn, that was a good burrito') < 0.3, 'mild profanity, not hostility');
  assert.ok(tox('YOU ARE USELESS AND STUPID') > tox('you are useless and stupid') - 0.001);
  const f = appraise("Hi, I'm Sam. I'm from Fresno and I work as a teacher.").facts;
  assert.deepEqual(f, [{ key: 'name', value: 'Sam' }, { key: 'from', value: 'Fresno' }, { key: 'job', value: 'teacher' }]);
  assert.deepEqual(appraise('My name is maria and I like tacos').facts, [{ key: 'name', value: 'Maria' }]);
  assert.deepEqual(appraise("I'm tired").facts, []);
  assert.equal(stem('evacuation'), stem('evacuated'));
  assert.equal(stem('insurer'), stem('insurance'));
});

test('recall ranks by recency, importance and lexical relevance', () => {
  const m = new Mind(P(npcAt('90265')), { t: T0 });
  m.remember('The player asked about the fire evacuation routes', 0.5, ['player', 'fire'], { t: T0 });
  m.remember('The player said the tacos on Cross Creek are great', 0.5, ['player', 'food'], { t: T0 + 1 * H });
  m.remember('The player asked whether the fire jumped the ridge', 0.5, ['player', 'fire'], { t: T0 + 20 * H });
  m.remember('Heard on the radio that the evacuation order for the fire was lifted', 0.95, ['fire'], { t: T0 + 2 * H });
  const now = T0 + 24 * H;
  const r = m.recall('fire evacuation', 5, { t: now, background: false });
  assert.ok(r.length >= 3);
  assert.ok(r.every(x => /fire|evacuat/i.test(x.text)), 'only relevant memories come back');
  assert.ok(!r.some(x => /tacos/.test(x.text)));
  for (let i = 1; i < r.length; i++) assert.ok(r[i - 1].score >= r[i].score);
  // recency: the same text and importance, newer first
  const m2 = new Mind(P(npcAt('90265')), { t: T0 });
  m2.remember('talked about the rent going up', 0.5, [], { t: T0 });
  m2.remember('talked about the rent going up again', 0.5, [], { t: T0 + 30 * H });
  assert.match(m2.recall('rent', 2, { t: T0 + 31 * H })[0].text, /again/);
  // importance: the same time and text, more important first
  const m3 = new Mind(P(npcAt('90265')), { t: T0 });
  m3.remember('the landlord called about the lease', 0.2, [], { t: T0 });
  m3.remember('the landlord called about the lease, it is ending', 0.9, [], { t: T0 });
  assert.match(m3.recall('landlord lease', 2, { t: T0 + H })[0].text, /ending/);
  // an empty query ranks everything by recency x importance; k is respected
  assert.equal(m.recall('', 2, { t: now }).length, 2);
  assert.deepEqual(m.recall('volleyball tournament', 5, { t: now, background: false }), []);
  // the persona's background memories are recallable: a Malibu resident who lived through it recalls the Woolsey Fire
  let witness = null;
  for (let h = 0; h < 2000 && !witness; h++) { const p = P(npcAt('90265', h, 0)); if (p.memories.some(x => /Woolsey/.test(x.text))) witness = p; }
  assert.ok(witness, 'someone in Malibu remembers the Woolsey Fire');
  const got = new Mind(witness).recall('Woolsey fire', 3);
  assert.ok(got.some(x => x.kind === 'background' && /Woolsey/.test(x.text)), JSON.stringify(got));
});

test('reflection turns repeated questions into beliefs', () => {
  const m = new Mind(P(npcAt('95521')), { t: T0 });
  assert.deepEqual(m.reflect(T0), [], 'nothing to reflect on yet');
  const lines = ['Is the fire season getting worse up here?', 'Were you ever evacuated for a fire?', 'Does the smoke from the fires bother you?', 'Thanks for telling me about it.'];
  lines.forEach((text, i) => m.observe({ kind: 'utterance', from: 'player', text, t: T0 + i * 60000 }));
  const beliefs = m.reflect(T0 + 10 * 60000);
  const fire = beliefs.find(b => b.about === 'player' && b.topic === 'fire');
  assert.ok(fire, JSON.stringify(beliefs));
  assert.equal(fire.text, 'the player keeps asking about fire; they may be worried about it');
  assert.ok(m.recall('worried about fire', 3).some(x => x.kind === 'reflection'), 'the reflection is remembered');
  assert.deepEqual(m.reflect(T0 + 11 * 60000), [], 'importance was consumed');
  ['Where is good food around here?', 'Any good tacos?', 'What about pho?'].forEach((text, i) => m.observe({ from: 'player', text, t: T0 + (20 + i) * 60000 }));
  const again = m.reflect(T0 + 30 * 60000, { force: true });
  assert.ok(again.some(b => b.topic === 'food' && /seems interested in food/.test(b.text)));
  assert.equal(m.beliefs.filter(b => b.key === 'player:fire').length, 1, 'beliefs are keyed, not duplicated');
});

test('relationships: compliments and thanks warm, insults sting, meetings build familiarity, facts are learned', () => {
  const p = withBig5(P(npcAt('93721')), { A: 0.6, N: 0.5 }); // an average-agreeable neighbor (compliments land softer on disagreeable ones)
  const m = new Mind(p, { t: T0 });
  assert.equal(m.feelingsToward('player'), 'neutral');
  m.observe({ kind: 'utterance', from: 'player', text: "Hi! I'm Sam, I'm from Fresno and I work as a teacher.", t: T0 });
  let r = m.relationship('player');
  assert.equal(r.met, 1);
  assert.deepEqual(r.facts.map(f => [f.key, f.value]), [['name', 'Sam'], ['from', 'Fresno'], ['job', 'teacher']]);
  assert.equal(r.facts[0].text, 'Their name is Sam.');
  const a0 = r.affinity, f0 = r.familiarity;
  m.observe({ from: 'player', text: 'You are so kind, thank you!', t: T0 + 60000 });
  m.observe({ from: 'player', text: 'Your garden is beautiful.', t: T0 + 120000 });
  r = m.relationship('player');
  assert.ok(r.affinity > a0 + 0.15, `affinity ${a0} → ${r.affinity}`);
  assert.equal(r.met, 1, 'one meeting so far');
  for (let d = 1; d <= 5; d++) m.observe({ kind: 'meet', from: 'player', t: T0 + d * 24 * H });
  r = m.relationship('player');
  assert.equal(r.met, 6);
  assert.ok(r.familiarity > f0 + 0.3, `familiarity ${f0} → ${r.familiarity}`);
  assert.ok(['warm', 'fond'].includes(m.feelingsToward('player')));
  m.observe({ from: 'player', text: 'Thanks again, you are the best!', t: T0 + 6 * 24 * H });
  assert.equal(m.feelingsToward('player'), 'fond');
  // insults lower affinity and trust, and move the mood
  const m2 = new Mind(withBig5(p, { A: 0.8, N: 0.75 }), { t: T0 });
  const before = m2.mood.valence;
  m2.observe({ from: 'player', text: "You're a useless idiot.", t: T0 });
  m2.observe({ from: 'player', text: 'Shut up, nobody likes you.', t: T0 + 60000 });
  const r2 = m2.relationship('player');
  assert.ok(r2.affinity < -0.3 && r2.trust < -0.2, JSON.stringify(r2));
  assert.ok(m2.mood.valence < before - 0.3);
  assert.equal(m2.feelingsToward('player'), 'hurt');
  assert.ok(['angry', 'upset', 'irritated', 'sad', 'anxious', 'down'].includes(m2.emotion), m2.emotion);
  const m3 = new Mind(withBig5(p, { A: 0.2, N: 0.25 }), { t: T0 });
  m3.observe({ from: 'player', text: "You're a useless idiot.", t: T0 });
  m3.observe({ from: 'player', text: 'Shut up, nobody likes you.', t: T0 + 60000 });
  assert.equal(m3.feelingsToward('player'), 'annoyed');
  // an apology mends some of it
  const t1 = m3.relationship('player').trust;
  m3.observe({ from: 'player', text: "I'm sorry, I didn't mean it.", t: T0 + 120000 });
  assert.ok(m3.relationship('player').trust > t1);
  // wary: trust lost without much dislike
  const m4 = new Mind(p, { t: T0 });
  Object.assign(m4.relationship('player'), { affinity: 0.05, trust: -0.3 });
  assert.equal(m4.feelingsToward('player'), 'wary');
  for (const x of [m.feelingsToward(), m2.feelingsToward(), m4.feelingsToward()]) assert.ok(FEELINGS.includes(x));
});

test('needs and mood move with simulated time, weather and activity', () => {
  const p = P(npcAt('92262'));
  const m = new Mind(p, { t: T0 });
  m.tick(T0, { activity: 'home' });
  const e0 = m.needs.energy;
  m.tick(T0 + 8 * H, { activity: { kind: 'work', place: { kind: 'work' } } });
  const e1 = m.needs.energy;
  assert.ok(e1 < e0 - 0.4, `energy falls awake: ${e0} → ${e1}`);
  m.tick(T0 + 16 * H, { activity: 'sleep' });
  assert.ok(m.needs.energy > 0.9, `and recovers asleep: ${m.needs.energy}`);
  const lone = new Mind(withBig5(p, { E: 0.9 }), { t: T0 });
  lone.tick(T0, { activity: 'home' });
  lone.tick(T0 + 10 * H, { activity: 'home' });
  assert.ok(lone.needs.social < 0.3 && lone.needs.fun < 0.5, JSON.stringify(lone.needs));
  lone.tick(T0 + 13 * H, { activity: { kind: 'visit', place: { kind: 'family' } } });
  assert.ok(lone.needs.social > 0.4, 'company refills social');
  // comfort: 108°F outdoors at work is hard; the same heat at home is easier
  const hot = { now: { tempF: 108, short: 'Sunny', wind: '5 mph' }, alerts: [] };
  const atWork = { kind: 'work', place: { kind: 'work' } };
  const comfortAtWork = persona => { const x = new Mind(persona, { t: T0 }); x.tick(T0, {}); x.tick(T0 + 3 * H, { weather: hot, activity: atWork }); return x.needs.comfort; };
  const outside = new Mind(Object.assign({}, p, { routine: Object.assign({}, p.routine, { outdoor: true }) }), { t: T0 });
  outside.tick(T0, {}); outside.tick(T0 + 3 * H, { weather: hot, activity: atWork });
  const inside = new Mind(p, { t: T0 });
  inside.tick(T0, {}); inside.tick(T0 + 3 * H, { weather: hot, activity: { kind: 'home', place: { kind: 'home' } } });
  assert.ok(outside.needs.comfort < 0.4 && outside.needs.comfort < inside.needs.comfort - 0.2, `${outside.needs.comfort} vs ${inside.needs.comfort}`);
  // the job is read by Census group (routine.occKey), never by the layer 1 job key, which is a slug like 'tractor-driver'
  const byGroup = (occKey, jobKey) => Object.assign({}, p, { routine: Object.assign({}, p.routine, { outdoor: undefined, occKey }), npc: Object.assign({}, p.npc, { occupation: { key: jobKey, title: 'x' } }) });
  assert.ok(comfortAtWork(byGroup('construction', 'roofer')) < 0.4, 'a construction worker works outside');
  assert.ok(comfortAtWork(byGroup('office', 'construction')) > 0.6, 'the Census group decides, not a job key that happens to look like one');
  // mood returns to the personality baseline after an upset
  const calm = new Mind(p, { t: T0 });
  calm.observe({ from: 'player', text: 'You are pathetic and stupid', t: T0 });
  assert.ok(calm.mood.valence < calm.baseline().valence - 0.2);
  calm.tick(T0, {});
  calm.tick(T0 + 12 * H, { activity: 'home' });
  assert.ok(Math.abs(calm.mood.valence - calm.baseline().valence) < 0.15, `${calm.mood.valence} vs ${calm.baseline().valence}`);
  // alerts weigh on neurotic people more
  const alert = { now: { tempF: 60, short: 'Rain', wind: '25 mph' }, alerts: [{ event: 'Flood Warning', severity: 'Severe', onset: '2026-11-24T08:00:00-08:00' }] };
  const nervous = new Mind(withBig5(p, { N: 0.9 }), { t: T0 }), steady = new Mind(withBig5(p, { N: 0.1 }), { t: T0 });
  for (const x of [nervous, steady]) { x.tick(T0, {}); x.tick(T0 + 3 * H, { weather: alert, activity: 'home' }); }
  const dn = nervous.baseline().valence - nervous.mood.valence, ds = steady.baseline().valence - steady.mood.valence;
  assert.ok(dn > ds + 0.03, `neuroticism scales the alert: ${dn} vs ${ds}`);
  assert.ok(nervous.recall('flood warning', 2).some(x => x.kind === 'alert'), 'the alert is noted in the stream');
  nervous.tick(T0 + 4 * H, { weather: alert, activity: 'home' });
  assert.equal(nervous.state.memory.filter(x => x.kind === 'alert').length, 1, 'noted once');
  // world weather and schedule activity plug straight in
  const real = new Mind(p, { t: T0 });
  real.tick(T0, { weather: world.weatherAt(p.npc.zi, T0), activity: activityAt(p.npc, p, T0) });
  real.tick(T0 + 2 * H, { weather: world.weatherAt(p.npc.zi, T0 + 2 * H), activity: activityAt(p.npc, p, T0 + 2 * H) });
  for (const v of Object.values(real.needs)) assert.ok(v >= 0 && v <= 1);
  assert.equal(typeof real.emotion, 'string');
  assert.equal(emotionLabel(0.6, 0.8), 'excited');
  assert.equal(emotionLabel(-0.6, 0.8, null, true), 'angry');
  const b = baselineMood({ O: 0.5, C: 0.5, E: 0.9, A: 0.6, N: 0.1 }), c = baselineMood({ O: 0.5, C: 0.5, E: 0.1, A: 0.4, N: 0.9 });
  assert.ok(b.valence > c.valence + 0.5);
});

test('state is plain JSON: toJSON and fromJSON round-trip, and minds are deterministic', () => {
  const p = P(npcAt('94110'));
  const run = () => {
    const m = new Mind(p, { t: T0 });
    m.tick(T0, { weather: world.weatherAt(p.npc.zi, T0), activity: 'home' });
    m.observe({ from: 'player', text: "Hi, I'm Ana. Is the coastal flooding bad down here?", t: T0 + 60000 });
    m.observe({ from: 'player', text: 'Thanks, you are very helpful!', t: T0 + 120000 });
    m.observe({ kind: 'gift', from: 'player', t: T0 + 180000 });
    m.tick(T0 + 5 * H, { activity: 'work' });
    m.reflect(T0 + 5 * H, { force: true });
    return m;
  };
  const a = run(), b = run();
  assert.deepEqual(a.toJSON(), b.toJSON());
  const text = JSON.stringify(a);
  const back = Mind.fromJSON(JSON.parse(text), p);
  assert.deepEqual(back.toJSON(), a.toJSON());
  const back2 = Mind.fromJSON(p, text);
  assert.deepEqual(back2.toJSON(), a.toJSON());
  assert.deepEqual(back.recall('flooding', 3), a.recall('flooding', 3));
  assert.equal(back.feelingsToward('player'), a.feelingsToward('player'));
  back.observe({ from: 'player', text: 'See you later!', t: T0 + 6 * H });
  a.observe({ from: 'player', text: 'See you later!', t: T0 + 6 * H });
  assert.deepEqual(back.toJSON(), a.toJSON(), 'a restored mind behaves the same');
  const damaged = new Mind(p, { state: { mood: { valence: 9 }, needs: { energy: -3 }, memory: [null, { text: 'kept', importance: 4 }], relationships: { player: { affinity: 0.2 } } } });
  assert.equal(damaged.mood.valence, 1);
  assert.equal(damaged.needs.energy, 0);
  assert.equal(damaged.state.memory.length, 1);
  assert.equal(damaged.state.memory[0].importance, 1);
  assert.deepEqual(damaged.relationship('player').facts, []);
  for (let i = 0; i < 400; i++) a.remember(`note ${i} about the weather`, (i % 10) / 10, ['weather'], { t: T0 + i * 60000 });
  assert.ok(a.state.memory.length <= 300, 'the stream stays bounded');
  assert.ok(a.state.memory.some(x => x.kind === 'reflection'), 'reflections are kept');
});

test('stores: memory, localStorage (guarded) and a JSON file', async () => {
  const p = P(npcAt('94110'));
  const m = new Mind(p, { t: T0 });
  m.observe({ from: 'player', text: 'Hello! My name is Lee.', t: T0 });
  const mem = new MemoryStore();
  m.save(mem);
  assert.deepEqual(Mind.load(mem, p).toJSON(), m.toJSON());
  assert.equal(mem.get('missing'), null);
  const st = mem.get(m.id); st.mood.valence = -1;
  assert.notEqual(mem.get(m.id).mood.valence, -1, 'the store keeps its own copy');
  const data = new Map();
  const storage = { getItem: k => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)), removeItem: k => data.delete(k), key: i => [...data.keys()][i] ?? null, get length() { return data.size; } };
  const ls = new LocalStorageStore({ storage });
  assert.equal(ls.put(m.id, m.toJSON()), true);
  assert.deepEqual(Mind.load(ls, p).toJSON(), m.toJSON());
  assert.deepEqual(ls.keys(), [m.id]);
  const broken = new LocalStorageStore({ storage: { getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('QuotaExceeded'); }, removeItem() { throw new Error('x'); }, key() { throw new Error('x'); }, get length() { throw new Error('x'); } } });
  assert.equal(broken.get('a'), null);
  assert.equal(broken.put('a', {}), false);
  assert.deepEqual(broken.keys(), []);
  assert.equal(new LocalStorageStore().put('a', {}), false, 'no localStorage in Node: put reports false, never throws');
  assert.equal(Mind.load(broken, p).feelingsToward(), 'neutral');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'legion-mind-'));
  try {
    const file = path.join(dir, 'minds.json');
    const fsStore = new FileStore(file);
    m.save(fsStore);
    assert.ok(fs.existsSync(file));
    const reopened = await new FileStore(file).open();
    assert.deepEqual(Mind.load(reopened, p).toJSON(), m.toJSON());
    assert.deepEqual(reopened.keys(), [m.id]);
    fs.writeFileSync(file, '{not json');
    const fresh = new FileStore(file);
    assert.equal(fresh.get(m.id), null);
    fresh.put('x', { ok: 1 });
    assert.ok(fs.existsSync(file + '.corrupt'), 'an unreadable file is kept aside');
    assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { x: { ok: 1 } });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('neighbors talk too: relationships are kept per speaker', () => {
  const m = new Mind(P(npcAt('94110')), { t: T0 });
  m.observe({ from: '94110-9-1', text: 'Morning! Did the rain flood your street too?', t: T0 });
  m.observe({ from: 'player', text: 'You are an idiot.', t: T0 + 60000 });
  assert.ok(m.relationship('94110-9-1').affinity > 0);
  assert.ok(m.relationship('player').affinity < 0);
  assert.equal(m.feelingsToward('94110-9-1'), 'neutral');
  assert.ok(m.recall('flood street rain', 2).some(x => x.tags.includes('94110-9-1') && /94110-9-1 said/.test(x.text)));
  assert.deepEqual(Object.keys(m.relationships).sort(), ['94110-9-1', 'player']);
});

test("the NPC's own lines are remembered without moving its mood or making a relationship", () => {
  const m = new Mind(P(npcAt('94110')), { t: T0 });
  const mood = m.mood;
  m.observe({ from: 'self', text: 'You are an idiot if you think rent is going down.', t: T0 });
  assert.deepEqual(m.mood, mood);
  assert.deepEqual(Object.keys(m.relationships), []);
  const r = m.recall('rent', 1, { background: false })[0];
  assert.match(r.text, /^I said: "/);
  assert.ok(r.tags.includes('self') && r.tags.includes('rent'));
});

test('hostility: everyday, sympathetic and teasing lines are not insults', () => {
  const calm = [
    'Did the fire hurt you?', 'Can the smoke hurt you?', 'This heat will kill you out here.', 'The Dodgers are going to beat you this year.',
    'Do you know when garbage day is?', 'Can you help me? I feel like such a fool.', 'I love shiitake mushrooms', "I'd beat you at chess any day.",
    'I would never hurt you.', 'Did you freak out when the power went off?', "You're nobody's fool.", 'My uncle Dick is visiting this weekend.',
    'What a stupid question, sorry.', 'This weather is stupid.', 'My boss is an idiot.', 'Is the trash pickup on Tuesday?', 'Shut up! No way!',
    "Shut up, that's amazing!", 'That class was a pain.',
  ];
  for (const line of calm) {
    const a = appraise(line);
    assert.ok(!a.intents.includes('insult'), `${line} → ${a.intents}`);
    assert.ok(a.toxicity < 0.3, `${line} → toxicity ${a.toxicity}`);
  }
  for (const line of ['Did the fire hurt you?', 'This heat will kill you out here.', 'Do you know when garbage day is?', 'I love shiitake mushrooms']) assert.equal(appraise(line).toxicity, 0, line);
  // the real thing still registers, aimed at the listener
  const hostile = ["You're an idiot.", 'you idiot', 'Idiot!', 'Thank you, idiot.', 'Are you stupid?', 'You look like a clown.', 'your house is ugly',
    "I'll hurt you", "I'm gonna punch you", 'Go to hell', 'Shut up and listen.', 'You suck', 'Screw you', 'Nobody likes you.'];
  for (const line of hostile) assert.ok(appraise(line).intents.includes('insult'), line);
  // swearing about something else is not an insult, and stings only a little
  const swear = appraise('fuck this traffic');
  assert.ok(!swear.intents.includes('insult') && swear.toxicity > 0 && swear.toxicity < 0.45);
  // a Malibu neighbor asked about the fires in a friendly way does not end up hurt
  const p = P(npcAt('90265'));
  const m = new Mind(p, { t: T0 });
  ['Hi! I heard about the Woolsey Fire.', 'Did the fire hurt you?', 'Can the smoke hurt you?', "I'm Mexican, by the way.", 'Do you know when garbage day is?']
    .forEach((text, i) => m.observe({ from: 'player', text, t: T0 + i * 60000 }));
  const r = m.relationship('player');
  assert.ok(r.affinity >= 0 && r.trust >= 0 && r.grievance === 0, JSON.stringify(r));
  assert.ok(['neutral', 'warm', 'fond'].includes(m.feelingsToward('player')), m.feelingsToward('player'));
  assert.notEqual(m.emotion, 'angry');
  m.reflect(T0 + 10 * 60000, { force: true });
  assert.ok(!m.beliefs.some(b => b.topic === 'rude'), JSON.stringify(m.beliefs));
  assert.ok(m.beliefs.some(b => b.topic === 'fire'), 'they asked about fire twice');
});

test('facts: names only from introductions, jobs only from job words, never a heritage', () => {
  const none = ["I'm Mexican, by the way.", "I'm Korean too.", 'Call me crazy, but I love the heat.', 'Call me later.', 'Call me back when you can.',
    'My name is not important.', "It's Monday.", 'This is California.', 'Hello, I am Tired', "I'm Catholic.", "Hi, I'm Filipino-American."];
  for (const line of none) assert.ok(!appraise(line).facts.some(f => f.key === 'name'), `${line} → ${JSON.stringify(appraise(line).facts)}`);
  const names = [["Hi, I'm Sam.", 'Sam'], ['Call me Ishmael.', 'Ishmael'], ["I'm Ana, nice to meet you.", 'Ana'], ["Nice to meet you, I'm Jun.", 'Jun'],
    ["I'm Lupe, by the way.", 'Lupe'], ['hi im sam', 'Sam'], ['My name is Rosa Delgado.', 'Rosa Delgado'], ['Everyone calls me Bud.', 'Bud'], ["I'm Mei.", 'Mei']];
  for (const [line, want] of names) assert.deepEqual(appraise(line).facts.find(f => f.key === 'name'), { key: 'name', value: want }, line);
  const noJob = ["I'm a mother.", "I'm a vegetarian.", "I'm a grandfather and I love it.", "I'm a Californian.", "I'm a hard worker.", "I'm a good cook.",
    "I'm a member of the church.", "I'm a beginner at surfing.", "I'm a Dodgers fan."];
  for (const line of noJob) assert.ok(!appraise(line).facts.some(f => f.key === 'job'), `${line} → ${JSON.stringify(appraise(line).facts)}`);
  const jobs = [["I'm a registered nurse.", 'registered nurse'], ['I work as a dental hygienist.', 'dental hygienist'], ["I'm a farm worker.", 'farm worker'],
    ["I'm a truck driver.", 'truck driver'], ["I'm a stay-at-home mom.", 'stay-at-home mom'], ["I'm retired.", 'retired'], ["I'm a student at Fresno State.", 'student']];
  for (const [line, want] of jobs) assert.deepEqual(appraise(line).facts.find(f => f.key === 'job'), { key: 'job', value: want }, line);
  // what the mind learns, and so what reaches the Claude prompt, carries no heritage as a name
  const m = new Mind(P(npcAt('90265')), { t: T0 });
  m.observe({ from: 'player', text: "I'm Mexican, by the way.", t: T0 });
  m.observe({ from: 'player', text: "I'm a mother of two.", t: T0 + 60000 });
  m.observe({ from: 'player', text: "I'm a student, actually.", t: T0 + 120000 });
  const facts = m.relationship('player').facts;
  assert.ok(!facts.some(f => f.key === 'name'), JSON.stringify(facts));
  assert.deepEqual(facts.map(f => f.text), ['They are a student.']);
  m.reflect(T0 + 5 * 60000, { force: true });
  assert.ok(!m.beliefs.some(b => /Mexican|mother/.test(b.text)), JSON.stringify(m.beliefs));
});
