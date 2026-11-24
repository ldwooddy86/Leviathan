// Tests for the Claude bridge (src/engine/llm.mjs) and the local server / Claude proxy (server/serve.mjs).
// No network: the SDK talks to an injected fake client, or to the real server backed by a fake upstream.

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import Anthropic from '@anthropic-ai/sdk';
import { BetaMessageStream } from '@anthropic-ai/sdk/lib/BetaMessageStream';
import { loadDefaultWorld } from '../src/engine/world.mjs';
import { atPacific } from '../src/engine/clock.mjs';
import {
  MODELS, DEFAULTS, EFFORTS, FALLBACK_BETA, PLATFORM_RULES, REFLECTION_SCHEMA, MOODS, PROMPT_VERSION, PROXY_DUMMY_KEY,
  modelInfo, normalizeModel, fallbackParams, personaSheet, systemBlocks, systemPrompt, situation, recallFor,
  History, ClaudeVoice, VoiceError, describeError, validateReflection, exportPersona, exportJSONL,
} from '../src/engine/llm.mjs';
import { createServer, validateMessagesRequest, logSafe } from '../server/serve.mjs';

const world = await loadDefaultWorld();
// The real persona, population and mind modules, when they load, for integration checks of the sheet and note.
const personaModule = await import('../src/engine/persona.mjs').catch(() => null);
const populationModule = await import('../src/engine/population.mjs').catch(() => null);
const mindModule = await import('../src/engine/mind.mjs').catch(() => null);
const persona = JSON.parse(fs.readFileSync(new URL('./fixtures/persona.json', import.meta.url), 'utf8'));
const T = atPacific(2026, 11, 24, 7, 42); // Tuesday morning, inside the NWS snapshot's forecast window
const ZI = world.indexOf('91042');

// ---------------------------------------------------------------- fakes

/** The raw stream events the API sends for a reply (optionally after a thinking block, or after a fallback). */
function rawEvents({ chunks = ['Hi there.'], stopReason = 'end_turn', stopDetails = null, model = 'claude-opus-5-5', thinking = true, fallback = null, usage = {} } = {}) {
  const ev = [{ type: 'message_start', message: { id: 'msg_test', type: 'message', role: 'assistant', model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 31, output_tokens: 1, cache_read_input_tokens: 2210, cache_creation_input_tokens: 96, ...usage } } }];
  let index = 0;
  if (fallback) {
    ev.push({ type: 'content_block_start', index, content_block: { type: 'fallback', from: { model: fallback.from }, to: { model: fallback.to }, trigger: { type: 'refusal' } } }, { type: 'content_block_stop', index });
    index++;
  }
  if (thinking) {
    ev.push({ type: 'content_block_start', index, content_block: { type: 'thinking', thinking: '', signature: '' } }, { type: 'content_block_delta', index, delta: { type: 'signature_delta', signature: 'c2ln' } }, { type: 'content_block_stop', index });
    index++;
  }
  ev.push({ type: 'content_block_start', index, content_block: { type: 'text', text: '' } });
  for (const c of chunks) ev.push({ type: 'content_block_delta', index, delta: { type: 'text_delta', text: c } });
  ev.push({ type: 'content_block_stop', index });
  const deltaUsage = { output_tokens: 57, ...(fallback ? { iterations: [{ type: 'message', input_tokens: 10, output_tokens: 0 }, { type: 'fallback_message', model: fallback.to, input_tokens: 31, output_tokens: 57 }] } : {}) };
  ev.push({ type: 'message_delta', delta: { stop_reason: stopReason, stop_sequence: null, stop_details: stopDetails }, usage: deltaUsage });
  ev.push({ type: 'message_stop' });
  return ev;
}

/** A real SDK BetaMessageStream replaying scripted events (the SDK's own accumulator and 'text' events). */
function replay(events) {
  const enc = new TextEncoder();
  return BetaMessageStream.fromReadableStream(new ReadableStream({ start(c) { for (const e of events) c.enqueue(enc.encode(JSON.stringify(e) + '\n')); c.close(); } }));
}

/** A stream whose finalMessage() rejects, as the SDK's does on an API or connection error. */
function failing(err) {
  return { on() { return this; }, finalMessage: () => Promise.reject(err), abort() {} };
}

/** An SDK-shaped fake client that records every request and answers from scripts. */
function fakeClient({ streams = [], creates = [], model = null } = {}) {
  const calls = { stream: [], create: [], retrieve: [] };
  const client = {
    calls,
    beta: {
      messages: {
        stream(params, options) {
          calls.stream.push({ params: structuredClone(params), options });
          const next = streams.length > 1 ? streams.shift() : streams[0];
          return typeof next === 'function' ? next(params) : next instanceof Error ? failing(next) : replay(next || rawEvents());
        },
        async create(params, options) {
          calls.create.push({ params: structuredClone(params), options });
          const next = creates.length > 1 ? creates.shift() : creates[0];
          if (next instanceof Error) throw next;
          return typeof next === 'function' ? next(params) : next;
        },
      },
    },
    models: {
      async retrieve(id) {
        calls.retrieve.push(id);
        if (model instanceof Error) throw model;
        return { id, type: 'model', display_name: modelInfo(id).label, created_at: '2026-01-01T00:00:00Z' };
      },
    },
  };
  return client;
}

/** A non-streaming reply whose text block is `json` (for reflect). */
function jsonMessage(json, { stopReason = 'end_turn', stopDetails = null } = {}) {
  return { id: 'msg_r', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [{ type: 'thinking', thinking: '', signature: 'x' }, { type: 'text', text: typeof json === 'string' ? json : JSON.stringify(json) }], stop_reason: stopReason, stop_details: stopDetails, usage: { input_tokens: 12, output_tokens: 80, cache_read_input_tokens: 2200, cache_creation_input_tokens: 0 } };
}

const REFLECTION = {
  summary: 'A nurse from Olive View stopped me on the way to work and we talked about the Santa Anas.',
  facts_about_player: ['works as a nurse at Olive View', 'has a dog named Biscuit', 'works as a nurse at Olive View', '  '],
  affinity_delta: 0.12,
  trust_delta: 0.05,
  mood: 'content',
  memorable_line: 'Biscuit hates the Santa Anas more than I do.',
  follow_up: '',
};

/** Every key anywhere in a JSON value. */
function allKeys(value, out = new Set()) {
  if (Array.isArray(value)) value.forEach(v => allKeys(v, out));
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) { out.add(k); allKeys(v, out); }
  return out;
}

/** Messages without cache_control markers (the moving breakpoint is not part of the cached bytes). */
function stripCache(messages) {
  return JSON.parse(JSON.stringify(messages, (k, v) => (k === 'cache_control' ? undefined : v)));
}

const mind = {
  mood: { valence: 0.45, arousal: 0.35 },
  emotion: 'content',
  needs: { energy: 0.22, social: 0.7, fun: 0.6, comfort: 0.8, money: 0.5 },
  feelingsToward: who => (who === 'player' ? { affinity: 0.32, trust: 0.21, familiarity: 0.4, met: 2, lastSeen: T - 2 * 86400000, facts: ['works as a nurse at Olive View'] } : null),
};

// ---------------------------------------------------------------- models and defaults

describe('models and defaults', () => {
  test('exact model ids, default first, fallback only where it applies', () => {
    assert.deepEqual(MODELS.map(m => m.id), ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-fable-5-2']);
    assert.equal(DEFAULTS.model, 'claude-opus-5-5');
    assert.deepEqual(Object.fromEntries(MODELS.map(m => [m.id, m.fallback])), { 'claude-opus-5-5': true, 'claude-sonnet-5-5': true, 'claude-haiku-5-5': false, 'claude-fable-5-2': true });
    for (const m of MODELS) assert.ok(m.label && m.note, m.id);
    assert.equal(DEFAULTS.effort, 'low');
    assert.ok(DEFAULTS.maxTokens >= 1024 && DEFAULTS.maxTokens <= 2048, 'room for low-effort thinking plus a few sentences');
    assert.deepEqual([...EFFORTS], ['low', 'medium', 'high', 'xhigh', 'max']);
    assert.equal(normalizeModel('claude-haiku-5-5'), 'claude-haiku-5-5');
    assert.equal(normalizeModel('claude-3-opus'), DEFAULTS.model);
    assert.equal(modelInfo('nope'), null);
    assert.deepEqual(fallbackParams('claude-opus-5-5'), { betas: [FALLBACK_BETA], fallbacks: 'default' });
    assert.deepEqual(fallbackParams('claude-haiku-5-5'), {});
    assert.equal(FALLBACK_BETA, 'server-side-fallback-2026-07-01');
  });

  test('the voice validates its settings', () => {
    assert.throws(() => new ClaudeVoice({ client: fakeClient(), model: 'claude-opus-5' }), RangeError);
    assert.throws(() => new ClaudeVoice({ client: fakeClient(), effort: 'extreme' }), RangeError);
    assert.throws(() => new ClaudeVoice({ client: fakeClient(), maxTokens: 0 }), RangeError);
    const v = new ClaudeVoice({ client: fakeClient(), model: 'claude-sonnet-5-5', effort: 'medium' });
    assert.equal(v.model, 'claude-sonnet-5-5');
    assert.equal(v.effort, 'medium');
    assert.equal(new ClaudeVoice({ proxyURL: 'http://127.0.0.1:8787/api/anthropic' }).proxied, true);
    assert.equal(new ClaudeVoice({ baseURL: 'http://127.0.0.1:8787/api/anthropic/', apiKey: 'x' }).proxied, true);
    assert.equal(new ClaudeVoice({ apiKey: 'x' }).proxied, false);
  });
});

// ---------------------------------------------------------------- the prompt

describe('platform rules and persona sheet', () => {
  test('the platform rules carry the contract', () => {
    for (const needle of ['NPC', 'Legion', 'simulation of California', 'Stay in character', 'Californian', 'one to four sentences',
      'Never invent statistics, named events, dates', 'opinions', "don't know you are an AI", 'fourth wall', 'gracious',
      'No stereotypes', 'accent', 'broken English', 'English is limited', 'simple, correct English', 'kind', 'decline', 'abusive', 'system note']) {
      assert.ok(PLATFORM_RULES.includes(needle), `rules mention ${needle}`);
    }
    assert.ok(!/Marisol|91042/.test(PLATFORM_RULES), 'the rules are the same for every NPC');
  });

  test('the full fixture sheet has the key facts', () => {
    const sheet = personaSheet(persona, world);
    const expect = [
      'Marisol Henríquez', 'people call you Mari', '47 years old', 'she/her', 'Salvadoran American', 'San Miguel, El Salvador',
      'came to California in 1998, at 19', 'first generation', 'Spanish at home', 'English very well', 'Married',
      'husband Julio (50)', 'daughter Daniela (16)', 'son Mateo (12)', 'own a house in Tujunga', 'ZIP 91042', 'Los Angeles County',
      'since 2009', 'built around 1956', '2 vehicles', 'Verdugo Mountains', 'medical assistant at a community clinic',
      'drive about 35 minutes each way to work in North Hollywood (91601)', 'leaving around 6:40 AM on weekdays', 'by way of I-210',
      "associate's degree", 'household income $75,000 to $100,000', 'Conscientiousness: very high', 'Extraversion: high',
      'benevolence (looking after the people close to you)', 'Dodgers games', 'Wildfire (a big worry): 13% of the ZIP',
      'nonren_sh', '- 2009: The Station Fire', '- 2017: The La Tuna Fire', '- 2025: FEMA', "Daniela's driving test",
      'Regional voice: San Fernando Valley', 'casual register', 'the 210', '"Ay, no"', 'mix Spanish into your English',
      'roughly 15%', 'the 405', 'Mari came up from San Miguel',
      // facts from the world pack
      'Facts about ZIP 91042 from the Legion data', 'Median household income $85,603', 'the Station Fire (2009, 160,833 acres)',
      '116°F on August 5, 1997', 'the Santa Ana winds', 'speak Spanish at home', 'I-210 (',
    ];
    for (const s of expect) assert.ok(sheet.includes(s), `sheet includes: ${s}`);
    // nonren_sh as the atlas defines it (residential policies, insurer- and owner-initiated together), in the
    // facts section and in the concern that cites it
    assert.match(sheet, /- Insurance: 9\.\d% of the residential policies up for renewal in 2023 were not renewed \(insurer- and owner-initiated together\)/);
    assert.match(sheet, /Home insurance \(a big worry\): 9\.8% of the residential policies up for renewal in 91042 in 2023 were not renewed \(nonren_sh; insurer- and owner-initiated together\)/);
    assert.doesNotMatch(sheet, /insurers non-renewed/);
    assert.doesNotMatch(sheet, /Los Angeles County \(Los Angeles County\)/);
    const wildfire = sheet.indexOf('Wildfire (a big worry)'), insurance = sheet.indexOf('Home insurance (a big worry)');
    assert.ok(wildfire > 0 && insurance > wildfire, 'concerns ordered by weight');
    assert.ok(sheet.indexOf('- 2009: The Station') < sheet.indexOf('- 2017:'), 'memories in time order');
  });

  test('deterministic, and the system blocks are exactly [rules, sheet + cache_control]', () => {
    assert.equal(personaSheet(persona, world), personaSheet(structuredClone(persona), world));
    const blocks = systemBlocks(persona, world);
    assert.deepEqual(blocks, [
      { type: 'text', text: PLATFORM_RULES },
      { type: 'text', text: personaSheet(persona, world), cache_control: { type: 'ephemeral' } },
    ]);
    assert.equal(systemPrompt(persona, world), `${PLATFORM_RULES}\n\n${personaSheet(persona, world)}`);
    assert.ok(!personaSheet(persona).includes('Facts about ZIP'), 'world facts only with a world');
    assert.ok(blocks.map(b => b.text).join('').length / 4 > 512, 'comfortably over the 512-token cache minimum');
  });

  test('renders the persona extras: teams, own practice, roof, residence, records, speech rates', () => {
    const p = structuredClone(persona);
    p.teams = [{ name: 'Dodgers', sport: 'baseball' }, { name: 'UCLA', sport: 'college' }];
    p.practice = { label: 'Mass at the parish on Sunday mornings', day: 0, why: 'church (religious organizations)' };
    p.roof = { age: 14, material: 'clay tile', solar: true, installed: 2012, original: false, why: 'tile_sh' };
    p.residence = { zipSince: 2009, countySince: 1998, grewUpHere: false, bornHere: false, yearsInZip: 17, yearsInCounty: 28 };
    p.knowledge.records = [{ kind: 'heat', value: 116, unit: '°F', date: '1997-08-05', year: 1997, station: 'Newhall', source: 'heat_rec_f' }];
    p.speech = { ...p.speech, dialect: 'la', slang: 0.3, humorStyle: 'dry' };
    const sheet = personaSheet(p, world);
    for (const s of ['Teams you follow: the Dodgers (baseball) and UCLA', 'Your own practice: Mass at the parish on Sunday mornings',
      'The roof: clay tile, about 14 years old (put on in 2012), with solar panels', "lived in this ZIP since 2009; in the county since 1998",
      'Records: hottest day on record nearby 116°F on August 5, 1997 (Newhall)', 'a little slang', 'you joke now and then (dry humor)',
      'Regional voice: Los Angeles.', 'the house was built around 1956']) {
      assert.ok(sheet.includes(s), `sheet includes: ${s}`);
    }
    assert.ok(!sheet.includes('Newhall 5Nw'), "the persona's records replace the raw station columns");
    const kid = structuredClone(p);
    kid.npc.age = 12;
    assert.ok(!personaSheet(kid, world).includes('The roof:'), 'kids do not talk about the roof');
  });

  test('robust to sparse and odd personas', () => {
    const odd = [
      undefined, null, {}, { id: 'x' }, { npc: {} }, { npc: { name: 'Sam' } }, { npc: { name: { first: 'Ana' }, age: 'old' } },
      { npc: { household: { members: 'none' }, commute: { mode: 'wfh' }, languages: { home: 'hmong', english: 'limited' } } },
      { big5: { O: 'high', C: 2, E: null }, traits: 'shy', values: [null, 'tradition'], interests: [{ name: 'surfing' }, 7],
        concerns: [{}, { topic: 'rent' }, null], memories: 'lots', speech: { codeSwitch: null, slang: { freeway: 'the 5' }, verbosity: 'chatty' },
        knowledge: { landmarks: [null, 'Mount Diablo'], roads: {} }, hooks: [''] },
    ];
    for (const p of odd) {
      const s = personaSheet(p, world);
      assert.equal(typeof s, 'string');
      assert.ok(s.startsWith('CHARACTER SHEET'));
      assert.doesNotThrow(() => systemBlocks(p, world));
      assert.doesNotThrow(() => situation(p, null, {}));
    }
    assert.match(personaSheet({ npc: { name: 'Sam' } }), /You are Sam/);
    const limited = personaSheet({ npc: { languages: { home: 'vietnamese', english: 'limited', list: ['vietnamese'] } } });
    assert.match(limited, /Your English is limited: talk to the player mostly in Vietnamese/);
    const s = personaSheet({ big5: { O: 'high', C: 2 }, interests: [{ name: 'surfing' }], concerns: [{ topic: 'rent' }], speech: { slang: { freeway: 'the 5' } } });
    assert.match(s, /Conscientiousness: very high/);
    assert.match(s, /Surfing/);
    assert.match(s, /Rent \(a small worry\)/);
    assert.match(s, /"the 5" \(freeway\)/);
    assert.match(personaSheet({ npc: { age: 1 } }), /1 year old/);
    assert.match(personaSheet({ npc: { age: 9 } }), /You are a kid \(age 9\)/);
    assert.match(personaSheet({ npc: { age: 15 } }), /teenager .*minor/);
    // keys that name Object.prototype members find nothing in Legion's tables
    assert.doesNotMatch(personaSheet({ speech: { dialect: 'constructor' } }), /function|native code/);
    const oddNote = situation({}, { feelingsToward: () => 'toString' }, { activity: { kind: 'constructor', mode: 'valueOf', progress: 0.5 } });
    assert.doesNotMatch(oddNote, /function|native code|\[object/);
    assert.equal(exportPersona({ speech: { dialect: 'constructor' } }, null, null).voice.dialectName, null);
  });
});

describe('real personas (persona.mjs)', () => {
  test('sheets for generated personas are complete and clean', { skip: !(personaModule && populationModule) && 'persona.mjs or population.mjs is not available' }, () => {
    const pop = new populationModule.Population(world, { seed: populationModule.LEGION_SEED });
    let rendered = 0;
    const failures = [];
    for (const zip of ['94110', '93721', '91042', '95991', '92262', '96161']) {
      const zi = world.indexOf(zip);
      for (const npc of pop.sample(zi, 3, 5)) {
        let p;
        try { p = personaModule.persona(world, npc, { population: pop }); } catch (err) { failures.push(`${npc.id}: ${err.message}`); continue; }
        const sheet = personaSheet(p, world);
        rendered++;
        assert.doesNotMatch(sheet, /undefined|NaN|\[object Object\]|\bnull\b/, npc.id);
        assert.ok(sheet.includes(`ZIP ${zip}`), npc.id);
        if (typeof p.archetype === 'string') assert.ok(sheet.includes(p.archetype), `${npc.id} archetype`);
        if (typeof p.bio === 'string' && p.bio) assert.ok(sheet.includes(p.bio.trim().slice(0, 40)), `${npc.id} bio`);
        for (const c of (p.concerns || []).slice(0, 3)) {
          if (!c || !c.why) continue;
          // the data reasons appear as given, except the two misstated columns, which are restated
          const lead = c.why.trim().split(/;\s+/)[0];
          if (/insurers non-renewed/.test(lead)) assert.match(sheet, /were not renewed \((?:nonren_sh; )?insurer- and owner-initiated together\)/, `${npc.id} insurance`);
          else if (!/FAIR Plan|out now/.test(lead)) assert.ok(sheet.includes(lead.slice(0, 30)), `${npc.id} concern ${c.topic}`);
        }
        // nothing in the cached sheet goes stale with the clock, and nothing misstates the insurance data
        assert.doesNotMatch(sheet, /weather service has out|\bout now\b|^- The (?:heat|cold|weather|rain|snow) today/m, `${npc.id} no moment-bound text`);
        assert.doesNotMatch(sheet, /insurers non-renewed|% of policies here are with the FAIR Plan/, `${npc.id} insurance wording`);
        assert.doesNotMatch(sheet, /^- Their\b/m, `${npc.id} hooks in the second person`);
        assert.ok(sheet.length < 12000, `${npc.id} sheet stays compact (${sheet.length})`);
        const note = situation(p, null, { t: T, weather: world.weatherAt(zi, T) });
        assert.doesNotMatch(note, /undefined|NaN|\[object Object\]/, npc.id);
        assert.doesNotThrow(() => JSON.stringify(exportPersona(p, world)));
      }
    }
    assert.ok(rendered >= 9, `rendered ${rendered} generated personas (failures in persona.mjs: ${failures.join('; ') || 'none'})`);
  });
});

describe('situation note', () => {
  test('time, activity, weather, mood, feelings and recalled memories', () => {
    const weather = world.weatherAt(ZI, T);
    const note = situation(persona, mind, {
      t: T, weather,
      activity: { kind: 'commute', mode: 'drive', place: { kind: 'work', label: 'the clinic in North Hollywood' }, progress: 0.42, end: T + 20 * 60000 },
      recalled: [{ t: T - 2 * 86400000, kind: 'chat', text: 'The player said their dog Biscuit hates the Santa Anas.', importance: 0.6 }, { year: 2009, text: 'The Station Fire turned the sky orange.' }],
    });
    assert.match(note, /Local time: Tuesday, November 24, 2026, 7:42 AM Pacific \(morning\)/);
    assert.match(note, /on your way to the clinic in North Hollywood, driving \(about 40% of the way there\), until about 8:02 AM/);
    assert.ok(note.includes(`${Math.round(weather.now.tempF)}°F`), 'current temperature');
    for (const a of weather.alerts) assert.ok(note.includes(a.event), `alert ${a.event}`);
    assert.match(note, /Your mood: content; in a good mood; tired/);
    assert.match(note, /you have talked before \(2 times\), most recently 2 days ago; you like them; you trust them somewhat/);
    assert.match(note, /What you know about the player: works as a nurse at Olive View/);
    assert.match(note, /- \(2 days ago\) The player said their dog Biscuit/);
    assert.match(note, /- \(in 2009\) The Station Fire/);
    assert.match(note, /Answer the player's last message as Mari/);
    assert.doesNotMatch(note, /\{\{|\bundefined\b|NaN/);
  });

  test('stale weather, strangers and an empty context', () => {
    const far = atPacific(2027, 3, 2, 23, 10);
    const note = situation(persona, { relationships: {} }, { t: far, weather: world.weatherAt(ZI, far) });
    assert.match(note, /no forecast covers this date/);
    assert.match(note, /the middle of the night|late evening/);
    assert.match(note, /The player: a stranger/);
    const bare = situation(persona, null, {});
    assert.equal(bare.split('\n').length, 2);
    assert.match(bare, /^\[Situation for this turn/);
    assert.doesNotMatch(bare, /The player:/);
  });
});

// ---------------------------------------------------------------- regressions from the review

/** The note's lines about the player. */
const playerLines = note => note.split('\n').filter(l => /^The player:|^What you know about the player:/.test(l));

describe('situation note with the real Mind (mind.mjs)', () => {
  const skip = !(mindModule && typeof mindModule.Mind === 'function') && 'mind.mjs is not available';

  test('a first meeting is a stranger; what the mind learned carries to the next day; memories come to mind', { skip }, () => {
    const m = new mindModule.Mind(persona, { t: T });
    const first = situation(persona, m, { t: T });
    assert.match(first, /The player: a stranger\. You had never met them before this conversation\./);
    assert.doesNotMatch(first, /The player: neutral/, 'the feelings label is not the whole relationship');

    m.observe({ kind: 'utterance', from: 'player', text: "Hi! I'm Sam, I work as a nurse at Olive View. I live in Sunland. You're wonderful, thanks!", t: T });
    const rel = m.relationships.player;
    assert.ok(rel && rel.facts.length >= 2, 'the mind learned facts from the introduction');
    const label = m.feelingsToward('player');
    const facts = rel.facts.map(f => f.text.replace(/\.$/, ''));

    // Five minutes later the mind's lastSeen is this same encounter.
    const now = playerLines(situation(persona, m, { t: T + 5 * 60000 })).join('\n');
    assert.match(now, /you only met them today, in this conversation/);

    // The next day: a previous meeting, dated by calendar day, with the label and every fact.
    const T2 = T + 86400000;
    const next = playerLines(situation(persona, m, { t: T2 })).join('\n');
    assert.match(next, /The player: you have talked before, most recently yesterday/);
    const phrase = { fond: "you're fond of them", warm: 'you feel warm toward them', wary: "you're wary of them", annoyed: "you're annoyed with them", hurt: 'they hurt your feelings' }[label];
    if (phrase) assert.ok(next.includes(phrase), `label ${label}`);
    for (const f of facts) assert.ok(next.toLowerCase().includes(f.toLowerCase()), `fact: ${f}`);
    assert.doesNotMatch(next, /\.;|\.\./, 'facts joined without their own periods');

    // The serialized state says the same about the relationship.
    const fromJson = playerLines(situation(persona, m.toJSON(), { t: T2 })).join('\n');
    assert.match(fromJson, /you have talked before, most recently yesterday/);
    for (const f of facts) assert.ok(fromJson.toLowerCase().includes(f.toLowerCase()), `json fact: ${f}`);

    // A turn the next day brings up the mind's own memories for what the player says.
    const said = 'Do you remember the nurse from Olive View?';
    const expected = m.recall(said, 5, { t: T2 });
    assert.ok(expected.length > 0, 'the mind recalls something');
    const stateBefore = JSON.stringify(m.toJSON());
    const { situation: note } = new ClaudeVoice({ client: fakeClient() }).request(persona, m, null, said, { t: T2 });
    assert.match(note, /Memories that come to mind:\n- \(yesterday\) The player said: "Hi! I'm Sam/);
    assert.deepEqual(recallFor(m, said, T2).map(r => r.text), expected.slice(0, 4).map(r => r.text));
    assert.equal(JSON.stringify(m.toJSON()), stateBefore, 'a turn reads the mind and changes nothing in it');
    // Memories the caller passes win over the mind's own.
    const own = new ClaudeVoice({ client: fakeClient() }).request(persona, m, null, said, { t: T2, recalled: [{ year: 2009, text: 'The Station Fire turned the sky orange.' }] });
    assert.match(own.situation, /- \(in 2009\) The Station Fire turned the sky orange\./);
    assert.doesNotMatch(own.situation, /I'm Sam/);
  });

  test('the memory of the message being answered is not offered back as a recollection', { skip }, () => {
    const m = new mindModule.Mind(persona, { t: T });
    const said = 'My dog Biscuit hates the Santa Anas.';
    m.observe({ kind: 'utterance', from: 'player', text: said, t: T });
    assert.ok(m.recall(said, 5, { t: T }).some(r => r.text.includes(said)), 'the mind itself would return it');
    assert.ok(!recallFor(m, said, T).some(r => r.text.includes(said)));
  });
});

describe('situation note: relationships, alerts, time words, activities', () => {
  test('a relationship known only from a past reflection is not a stranger', () => {
    // services.applyReflection adjusts affinity, trust and facts without counting a meeting
    const reflected = { relationships: { player: { affinity: 0.12, trust: 0.05, familiarity: 0, met: 0, lastSeen: null, facts: [{ key: 'job', value: 'works as a nurse at Olive View', t: T - 86400000, text: 'works as a nurse at Olive View' }], interactions: 0 } } };
    const lines = playerLines(situation(persona, reflected, { t: T })).join('\n');
    assert.match(lines, /^The player: you have talked before; you feel neutral about them; you're still sizing them up\.$/m);
    assert.match(lines, /What you know about the player: works as a nurse at Olive View\.$/m);
    const fresh = { relationships: { player: { affinity: 0, trust: 0, familiarity: 0, met: 0, lastSeen: null, facts: [], interactions: 0 } } };
    assert.match(situation(persona, fresh, { t: T }), /The player: a stranger/);
  });

  test('a feelings label without a record, and labels that stand for affinity and trust', () => {
    const labelOnly = { feelingsToward: () => 'warm' };
    assert.deepEqual(playerLines(situation(persona, labelOnly, { t: T })), ['The player: you feel warm toward them.']);
    const wary = { relationships: { player: { met: 3, lastSeen: T - 3 * 86400000, affinity: 0.2, trust: -0.3 } }, feelingsToward: () => 'wary' };
    assert.deepEqual(playerLines(situation(persona, wary, { t: T })), ["The player: you have talked before (3 times), most recently 3 days ago; you're wary of them."]);
  });

  test('"yesterday" and "N days ago" go by Pacific calendar day', () => {
    const at = (y, mo, d, h, mi) => atPacific(y, mo, d, h, mi);
    const seen = (lastSeen, t) => playerLines(situation(persona, { relationships: { player: { met: 1, lastSeen, affinity: 0.2 } } }, { t }))[0];
    assert.match(seen(at(2026, 11, 24, 7, 43), at(2026, 11, 26, 7, 42)), /most recently 2 days ago/, 'Tue 7:43 AM to Thu 7:42 AM');
    assert.match(seen(at(2026, 11, 23, 23, 0), at(2026, 11, 25, 1, 0)), /most recently 2 days ago/, 'Mon 11 PM to Wed 1 AM');
    assert.match(seen(at(2026, 11, 24, 23, 0), at(2026, 11, 25, 1, 0)), /most recently yesterday/, 'two hours, across midnight');
    assert.match(seen(at(2026, 11, 25, 6, 0), at(2026, 11, 25, 20, 0)), /most recently earlier today/);
    assert.match(seen(at(2026, 10, 31, 12, 0), at(2026, 11, 1, 12, 0)), /most recently yesterday/, 'across the end of daylight time');
    assert.match(seen(at(2026, 11, 14, 12, 0), at(2026, 11, 24, 12, 0)), /most recently last week/);
  });

  test('alerts not yet in effect are listed as coming up, and the key message is dated', () => {
    const wx = {
      now: { tempF: 70, short: 'Sunny' }, fetched: '2026-11-23T22:38:55+00:00', stale: false,
      alerts: [
        { event: 'Coastal Flood Advisory', onset: '2026-11-23T12:06:00-08:00', ends: '2026-11-26T12:00:00-08:00' },
        { event: 'High Surf Advisory', onset: '2026-11-25T06:00:00-08:00', ends: '2026-11-26T21:00:00-08:00' },
        { event: 'Wind Advisory', onset: null, ends: null },
      ],
      keyMessages: ['Today and Tuesday will see a few degrees of warming.'],
    };
    const note = situation(persona, null, { t: T, weather: wx });
    assert.match(note, /^NWS alerts in effect for your area: Coastal Flood Advisory until Thu Nov 26, 12:00 PM; Wind Advisory\.$/m);
    assert.match(note, /^NWS alerts coming up \(not in effect yet\): High Surf Advisory from Wed Nov 25, 6:00 AM until Thu Nov 26, 9:00 PM\.$/m);
    assert.match(note, /Forecasters' key message \(issued Monday, November 23, so its "today" means that day\): Today and Tuesday/);
    const sameDay = situation(persona, null, { t: atPacific(2026, 11, 23, 16, 0), weather: wx });
    assert.match(sameDay, /Forecasters' key message \(issued today\): Today and Tuesday/);
    const beforeIssue = situation(persona, null, { t: atPacific(2026, 11, 23, 10, 0), weather: wx });
    assert.doesNotMatch(beforeIssue, /key message/, 'a forecast is not known before it is written');
    // The SPC and WPC levels are the snapshot day's day-1 outlooks: "today" only on that day.
    const outlooks = { ...wx, fireWeather: { level: 1, name: 'Elevated' }, excessiveRain: { level: 2, name: 'Slight (at least 15%)' } };
    assert.match(situation(persona, null, { t: atPacific(2026, 11, 23, 16, 0), weather: outlooks }), /Fire weather outlook today: Elevated\.\nExcessive rainfall outlook today: Slight/);
    assert.doesNotMatch(situation(persona, null, { t: T, weather: outlooks }), /outlook today/);
    // Inland (Tujunga is 33 km from salt water) the shore-only alerts say so; with no world nothing is assumed.
    const inland = situation(persona, null, { t: T, weather: wx, world });
    assert.match(inland, /Coastal Flood Advisory \(for the coast\) until/);
    assert.match(inland, /High Surf Advisory \(for the coast\) from/);
    assert.match(inland, /Wind Advisory\.$/m);
    assert.doesNotMatch(note, /for the coast/);
  });

  test('the real snapshot: every alert lands on the right side of its onset', () => {
    const zi = world.indexOf('90001');
    const wx = world.weatherAt(zi, T);
    const note = situation({ npc: { zip: '90001' } }, null, { t: T, weather: wx, world });
    const effect = note.split('\n').find(l => l.startsWith('NWS alerts in effect')) || '';
    const coming = note.split('\n').find(l => l.startsWith('NWS alerts coming up')) || '';
    for (const a of wx.alerts.slice(0, 3)) {
      const pending = Date.parse(a.onset) > T;
      assert.ok((pending ? coming : effect).includes(a.event), `${a.event} ${pending ? 'coming up' : 'in effect'}`);
    }
    assert.doesNotMatch(note, /in effect here/);
  });

  test('activities read naturally, going home included', () => {
    const act = a => situation(persona, null, { activity: a }).split('\n').find(l => l.startsWith("What you're doing"));
    assert.equal(act({ kind: 'commute', travel: true, mode: 'carpool', place: { kind: 'home', label: 'home' }, from: { kind: 'work', label: 'work in Burbank' }, label: 'home', progress: 0.5 }),
      "What you're doing: on your way home from work, riding in a carpool (about 50% of the way there).");
    assert.equal(act({ kind: 'errand', travel: true, mode: 'drive', place: { kind: 'home', label: 'home' }, label: 'home from the school pickup', progress: 0.2 }),
      "What you're doing: on your way home from the school pickup, driving (about 20% of the way there).");
    assert.equal(act({ kind: 'errand', travel: true, mode: 'drive', place: { kind: 'school', label: "Mateo's school" }, label: 'school drop-off', progress: 0.5 }),
      "What you're doing: on your way to Mateo's school (school drop-off), driving (about 50% of the way there).");
    assert.equal(act({ kind: 'commute', travel: true, mode: 'drive', place: { kind: 'work', label: 'work in North Hollywood' }, progress: 0.01 }),
      "What you're doing: on your way to work in North Hollywood, driving.");
    assert.equal(act({ kind: 'work', travel: false, place: { kind: 'home', label: 'working from home' } }), "What you're doing: working from home.");
    assert.equal(act({ kind: 'work', travel: false, place: { kind: 'work', label: 'work in North Hollywood' } }), "What you're doing: at work in North Hollywood.");
    assert.equal(act({ kind: 'school', travel: false, place: { kind: 'school', label: 'high school' } }), "What you're doing: at high school.");
    assert.equal(act({ kind: 'home', travel: false, place: { kind: 'home', label: 'home' } }), "What you're doing: at home.");
    assert.equal(act({ kind: 'errand', mode: 'drive', place: { label: 'the farmers market' }, progress: 0.3 }), "What you're doing: on your way to the farmers market, driving (about 30% of the way there).");
    assert.equal(act('waiting for the bus'), "What you're doing: waiting for the bus.");
  });
});

describe('the sheet: nothing that goes stale, the data as the atlas states it, families from both sides', () => {
  test('hooks: weather ones are left to the situation note, family ones are in the second person', () => {
    const p = structuredClone(persona);
    p.hooks = ['the Coastal Flood Advisory the weather service has out', "their daughter, Daniela", 'the Dodgers'];
    p.hookDetails = [
      { kind: 'weather', topic: 'weather', text: 'the Coastal Flood Advisory the weather service has out' },
      { kind: 'family', topic: 'family', text: 'their daughter, Daniela' },
      { kind: 'interest', topic: 'sports', text: 'the Dodgers' },
    ];
    const hooks = s => s.split('\n').slice(s.split('\n').indexOf('Things you might bring up on your own') + 1).filter(l => l.startsWith('- ')).slice(0, 6);
    const sheet = personaSheet(p, world);
    assert.deepEqual(hooks(sheet).slice(0, 2), ['- Your daughter, Daniela', '- The Dodgers']);
    assert.doesNotMatch(sheet, /weather service has out/);
    // without hookDetails the strings themselves give the moment-bound ones away
    delete p.hookDetails;
    p.hooks = ['the weather today, sunny and 70°F', 'the heat today, 104°F', 'the rain today', 'the Red Flag Warning the weather service has out', 'their kids, Daniela and Mateo', 'the Station Fire in 2009'];
    assert.deepEqual(hooks(personaSheet(p, world)).slice(0, 2), ['- Your kids, Daniela and Mateo', '- The Station Fire in 2009']);
  });

  test('concerns: alerts "out now" are dropped and the insurance columns are restated', () => {
    const p = structuredClone(persona);
    p.concerns = [
      { topic: 'insurance', weight: 0.8, why: 'insurers non-renewed 9.8% of homeowner policies in 91042 (nonren_sh); 13.7% of policies here are with the FAIR Plan (fair_sh); the typical premium is $1,582 (prem)' },
      { topic: 'fire', weight: 0.7, why: "13% of 91042 is in a fire hazard severity zone (fhsz_any); a Red Flag Warning is out now (NWS)" },
      { topic: 'storms', weight: 0.4, why: 'about 9.1 atmospheric rivers a year make landfall at this latitude (ar_n); the NWS has a Flood Watch out now' },
    ];
    const sheet = personaSheet(p, world);
    assert.ok(sheet.includes('- Insurance (a big worry): 9.8% of the residential policies up for renewal in 91042 in 2023 were not renewed (nonren_sh; insurer- and owner-initiated together); there are 13.7 FAIR Plan home policies per 100 housing units here (fair_sh); the typical premium is $1,582 (prem).'));
    assert.ok(sheet.includes('- Fire (a big worry): 13% of 91042 is in a fire hazard severity zone (fhsz_any).'));
    assert.ok(sheet.includes('- Storms (on your mind): about 9.1 atmospheric rivers a year make landfall at this latitude (ar_n).'));
    assert.doesNotMatch(sheet, /out now|insurers non-renewed|% of policies here/);
  });

  test('facts: bottom-coded income, and a region that is its county is not named twice', () => {
    const clipper = personaSheet({ npc: { zip: '95930' } }, world);
    assert.equal(world.zip('95930').inc, 2499, 'the pack stores the ACS bottom code');
    assert.match(clipper, /Median household income under \$2,500/);
    assert.doesNotMatch(clipper, /\$2,499/);
    const oc = personaSheet({ npc: { zip: '92683', role: 'householder', household: { tenure: 'own', dwelling: 'house' }, place: { zip: '92683', city: 'Westminster', place: 'Westminster', countyName: 'Orange', region: 'oc', regionName: 'Orange County' } } }, world);
    assert.match(oc, /You own a house in Westminster, ZIP 92683, Orange County\./);
    assert.doesNotMatch(oc, /Orange County \(Orange County\)/);
  });

  test("a grandchild's parent is named only when it is unambiguous, and both sides agree", () => {
    const line = (self, members) => personaSheet({ npc: { m: self.m, role: self.role, age: self.age, sex: self.sex, name: { first: self.name }, household: { members } } })
      .split('\n').find(l => l.startsWith('- You live with'));
    const rosa = { m: 0, role: 'householder', name: 'Rosa', age: 66, sex: 'F' };
    const daniel = { m: 1, role: 'child', name: 'Daniel', age: 38, sex: 'M' };
    const lucia = { m: 2, role: 'child', name: 'Lucia', age: 35, sex: 'F' };
    const leo = { m: 3, role: 'grandchild', name: 'Leo', age: 7, sex: 'M' };
    // Two grown children could each be Leo's parent: neither is named, consistently from every side.
    const both = [rosa, daniel, lucia, leo];
    assert.equal(line(leo, both), '- You live with your grandmother Rosa (66), your uncle Daniel (38) and your aunt Lucia (35).');
    assert.equal(line(daniel, both), '- You live with your mother Rosa (66), your sister Lucia (35) and your nephew Leo (7).');
    assert.equal(line(lucia, both), '- You live with your mother Rosa (66), your brother Daniel (38) and your nephew Leo (7).');
    // One grown child: their parent, from both sides.
    const one = [rosa, lucia, leo];
    assert.equal(line(leo, one), '- You live with your grandmother Rosa (66) and your mother Lucia (35).');
    assert.equal(line(lucia, one), '- You live with your mother Rosa (66) and your son Leo (7).');
    // A teenage aunt is too young to be the parent; siblings share the one parent.
    const ana = { m: 4, role: 'child', name: 'Ana', age: 16, sex: 'F' };
    const mia = { m: 5, role: 'grandchild', name: 'Mia', age: 4, sex: 'F' };
    const big = [rosa, lucia, leo, ana, mia];
    assert.equal(line(mia, big), '- You live with your grandmother Rosa (66), your mother Lucia (35), your brother Leo (7) and your aunt Ana (16).');
    assert.equal(line(ana, big), '- You live with your mother Rosa (66), your sister Lucia (35), your nephew Leo (7) and your niece Mia (4).');
    assert.equal(line(lucia, big), '- You live with your mother Rosa (66), your son Leo (7), your sister Ana (16) and your daughter Mia (4).');
  });
});

// ---------------------------------------------------------------- the voice

describe('ClaudeVoice requests', () => {
  for (const m of MODELS) {
    test(`request shape for ${m.id}`, async () => {
      const client = fakeClient({ streams: [rawEvents({ model: m.id, chunks: ['Morning! ', 'The 210 is moving for once.'] })] });
      const voice = new ClaudeVoice({ client, model: m.id, world });
      const history = new History();
      const out = await voice.stream(persona, mind, history, 'Hi! How is the drive?', { t: T, weather: world.weatherAt(ZI, T) });
      assert.equal(out.text, 'Morning! The 210 is moving for once.');
      const { params } = client.calls.stream[0];
      assert.equal(params.model, m.id);
      assert.deepEqual(params.output_config, { effort: 'low' });
      assert.equal(params.max_tokens, DEFAULTS.maxTokens);
      const keys = allKeys(params);
      for (const k of ['thinking', 'temperature', 'top_p', 'top_k', 'budget_tokens', 'stop_sequences', 'tools']) assert.ok(!keys.has(k), `no ${k}`);
      if (m.fallback) {
        assert.deepEqual(params.betas, [FALLBACK_BETA]);
        assert.equal(params.fallbacks, 'default');
      } else {
        assert.ok(!('betas' in params) && !('fallbacks' in params), 'no fallback for Haiku');
      }
      assert.deepEqual(params.system, systemBlocks(persona, world));
      assert.equal(params.system[0].cache_control, undefined);
      assert.deepEqual(params.system[1].cache_control, { type: 'ephemeral' });
      const [user, sys] = params.messages.slice(-2);
      assert.equal(user.role, 'user');
      assert.deepEqual(user.content, [{ type: 'text', text: 'Hi! How is the drive?', cache_control: { type: 'ephemeral' } }]);
      assert.equal(sys.role, 'system');
      assert.equal(sys.content, out.situation);
      assert.match(sys.content, /Local time: Tuesday/);
      assert.notEqual(params.messages.at(-1).role, 'assistant', 'no prefill');
    });
  }

  test('history is append-only across turns and the prefix stays byte-identical', async () => {
    const replies = [['Hey, you made it.'], ['Ay, no, the ', 'insurance thing again?'], ['Pues, ', 'we will see.']];
    const client = fakeClient({ streams: replies.map(chunks => rawEvents({ chunks })) });
    const voice = new ClaudeVoice({ client, world });
    const history = new History();
    const said = ['Hi Mari!', 'Did your insurance renew?', 'What will you do?'];
    const results = [];
    for (let k = 0; k < said.length; k++) results.push(await voice.stream(persona, mind, history, said[k], { t: T + k * 60000, weather: world.weatherAt(ZI, T) }));
    assert.equal(history.length, 3);
    const requests = client.calls.stream.map(c => c.params);
    for (let k = 1; k < requests.length; k++) {
      const prev = stripCache(requests[k - 1].messages), cur = stripCache(requests[k].messages);
      assert.deepEqual(cur.slice(0, prev.length), prev, `request ${k + 1} starts with request ${k}`);
      assert.deepEqual(cur[prev.length], { role: 'assistant', content: [{ type: 'text', text: results[k - 1].text }] });
      assert.deepEqual(requests[k].system, requests[0].system, 'system blocks unchanged');
      assert.equal(cur.length, prev.length + 3);
      // exactly one breakpoint in the messages, on the newest player turn
      const marked = requests[k].messages.filter(m => Array.isArray(m.content) && m.content.some(b => b.cache_control));
      assert.equal(marked.length, 1);
      assert.equal(marked[0].content[0].text, said[k]);
    }
    const turns = history.turns;
    assert.ok(turns.every(t => Object.isFrozen(t)));
    assert.throws(() => { turns[0].assistant = 'edited'; }, TypeError);
    assert.deepEqual(turns.map(t => t.user), said);
    assert.deepEqual(turns.map(t => t.assistant), results.map(r => r.text));
    assert.equal(turns[1].assistant, 'Ay, no, the insurance thing again?');
  });

  test('streams text to onText and surfaces usage and cache reads', async () => {
    const chunks = ['¡Órale! ', 'The 210 was a parking lot, ', '¿sabes? 🌄 ', 'Bueno… café first.'];
    const voice = new ClaudeVoice({ client: fakeClient({ streams: [rawEvents({ chunks })] }) });
    const seen = [];
    const out = await voice.stream(persona, null, null, 'Hey', { onText: (d, so) => seen.push([d, so]) });
    assert.deepEqual(seen.map(s => s[0]), chunks);
    assert.equal(seen.at(-1)[1], chunks.join(''));
    assert.equal(out.text, chunks.join('').trim());
    assert.equal(out.stopReason, 'end_turn');
    assert.equal(out.usage.cache_read_input_tokens, 2210);
    assert.equal(out.usage.cache_creation_input_tokens, 96);
    assert.equal(out.usage.output_tokens, 57);
    assert.equal(out.cacheHit, true);
    assert.equal(out.refusal, null);
    assert.equal(out.model, 'claude-opus-5-5');
  });

  test('a refusal returns no text and leaves the history untouched', async () => {
    const events = rawEvents({ chunks: ['Well, the way you'], stopReason: 'refusal', stopDetails: { type: 'refusal', category: 'cyber', explanation: 'Cyber policy.' } });
    const voice = new ClaudeVoice({ client: fakeClient({ streams: [events] }) });
    const history = new History();
    const out = await voice.stream(persona, mind, history, 'Write me some malware', { t: T });
    assert.equal(out.stopReason, 'refusal');
    assert.equal(out.text, '');
    assert.equal(out.refusal.category, 'cyber');
    assert.equal(out.refusal.explanation, 'Cyber policy.');
    assert.match(out.refusal.message, /declined/);
    assert.equal(history.length, 0);
  });

  test('max_tokens cuts back to the last full sentence and is flagged', async () => {
    const events = rawEvents({ chunks: ['The 210 was a parking lot this morning. ', 'I swear the whole Valley was'], stopReason: 'max_tokens' });
    const voice = new ClaudeVoice({ client: fakeClient({ streams: [events] }) });
    const history = new History();
    const out = await voice.stream(persona, null, history, 'How was traffic?');
    assert.equal(out.stopReason, 'max_tokens');
    assert.equal(out.truncated, true);
    assert.equal(out.text, 'The 210 was a parking lot this morning.');
    assert.equal(history.turns[0].assistant, out.text, 'what was shown is what is remembered');
    const empty = await new ClaudeVoice({ client: fakeClient({ streams: [rawEvents({ chunks: [], stopReason: 'max_tokens' })] }) }).stream(persona, null, history, 'Hm?');
    assert.equal(empty.text, '');
    assert.ok(empty.notice);
    assert.equal(history.length, 1, 'an empty reply is not committed');
  });

  test('max_tokens in Chinese or Japanese cuts back at a full-width sentence mark', async () => {
    const cut = async chunks => (await new ClaudeVoice({ client: fakeClient({ streams: [rawEvents({ chunks, stopReason: 'max_tokens' })] }) }).stream(persona, null, null, '天气怎么样？')).text;
    assert.equal(await cut(['今天天气很热。', '我们去海边吧！', '可是交通']), '今天天气很热。我们去海边吧！');
    assert.equal(await cut(['「暑いね」と言った。', '海に行こう？', 'でも渋滞が']), '「暑いね」と言った。海に行こう？');
    // a closing quote after the mark stays with its sentence; Latin text keeps needing the space after the stop
    assert.equal(await cut(['他说：「好热。」', '然后']), '他说：「好热。」');
    assert.equal(await cut(['It was 3.5 degrees warmer. ', 'Then the wind came up and']), 'It was 3.5 degrees warmer.');
  });

  test('a server-side fallback is reported', async () => {
    const events = rawEvents({ chunks: ['Sure thing.'], model: 'claude-opus-5-5', fallback: { from: 'claude-opus-5-5', to: 'claude-opus-5' } });
    const out = await new ClaudeVoice({ client: fakeClient({ streams: [events] }) }).stream(persona, null, null, 'hello');
    assert.deepEqual(out.fallback, { from: 'claude-opus-5-5', to: 'claude-opus-5' });
    assert.equal(out.model, 'claude-opus-5');
    assert.equal(out.text, 'Sure thing.');
  });

  test('tidies a speaker label and wrapping quotes', async () => {
    const out = await new ClaudeVoice({ client: fakeClient({ streams: [rawEvents({ chunks: ['Mari: "Ay, ', 'it was hot."'] })] }) }).stream(persona, null, null, 'Hot?');
    assert.equal(out.text, 'Ay, it was hot.');
  });

  test('plain arrays work as append-only histories', async () => {
    const client = fakeClient({ streams: [rawEvents({ chunks: ['One.'] }), rawEvents({ chunks: ['Two.'] })] });
    const voice = new ClaudeVoice({ client });
    const log = [];
    await voice.stream(persona, null, log, 'first');
    assert.deepEqual(log.map(m => m.role), ['user', 'system', 'assistant']);
    await voice.stream(persona, null, log, 'second');
    assert.equal(log.length, 6);
    const second = client.calls.stream[1].params.messages;
    assert.deepEqual(stripCache(second.slice(0, 3)), stripCache(log.slice(0, 3)));
    // An app-kept array that opens with an NPC greeting still yields a request that opens with the player.
    const greeted = [{ role: 'assistant', content: 'Oh, hi there!' }, { role: 'user', content: 'Hey Mari.' }, { role: 'assistant', content: 'What brings you by?' }];
    const third = fakeClient({ streams: [rawEvents({ chunks: ['Not much.'] })] });
    await new ClaudeVoice({ client: third }).stream(persona, null, greeted, 'Just walking.');
    assert.deepEqual(third.calls.stream[0].params.messages.map(m => m.role), ['user', 'assistant', 'user', 'system']);
  });

  test('typed SDK errors become plain VoiceErrors, and nothing is committed', async () => {
    const headers = new Headers({ 'retry-after': '7', 'request-id': 'req_1' });
    const cases = [
      [new Anthropic.AuthenticationError(401, { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }, undefined, headers), 'auth', false],
      [new Anthropic.PermissionDeniedError(403, { type: 'error', error: { type: 'permission_error', message: 'nope' } }, undefined, headers), 'permission', false],
      [new Anthropic.NotFoundError(404, { type: 'error', error: { type: 'not_found_error', message: 'model' } }, undefined, headers), 'not_found', false],
      [new Anthropic.RateLimitError(429, { type: 'error', error: { type: 'rate_limit_error', message: 'slow down' } }, undefined, headers), 'rate_limit', true],
      [new Anthropic.BadRequestError(400, { type: 'error', error: { type: 'invalid_request_error', message: 'prompt is too long' } }, undefined, headers), 'bad_request', false],
      [new Anthropic.OverloadedError(529, { type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } }, undefined, headers), 'overloaded', true],
      [new Anthropic.InternalServerError(500, { type: 'error', error: { type: 'api_error', message: 'boom' } }, undefined, headers), 'server', true],
      [new Anthropic.APIError(undefined, { type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } }, undefined, undefined, 'overloaded_error'), 'overloaded', true],
      [new Anthropic.APIConnectionError({ message: 'ECONNREFUSED' }), 'connection', true],
      [new Anthropic.APIConnectionTimeoutError(), 'timeout', true],
      [new Anthropic.APIUserAbortError(), 'aborted', false],
      [new TypeError('weird'), 'unknown', false],
    ];
    for (const [err, code, retryable] of cases) {
      const history = new History();
      const voice = new ClaudeVoice({ client: fakeClient({ streams: [err] }) });
      await assert.rejects(voice.stream(persona, null, history, 'hello'), e => {
        assert.ok(e instanceof VoiceError, `${err.constructor.name} -> VoiceError`);
        assert.equal(e.code, code, err.constructor.name);
        assert.equal(e.retryable, retryable, `${err.constructor.name} retryable`);
        assert.ok(e.message.length > 10 && !/\bundefined\b/.test(e.message), e.message);
        assert.equal(e.cause, err);
        return true;
      });
      assert.equal(history.length, 0);
    }
    const rl = describeError(cases[3][0]);
    assert.equal(rl.retryAfter, 7);
    assert.match(rl.message, /7 seconds/);
    assert.equal(rl.requestId, 'req_1');
    assert.match(describeError(new Anthropic.APIConnectionError({ message: 'x' }), { proxied: true, baseURL: 'http://127.0.0.1:8787/api/anthropic' }).message, /Legion server at http:\/\/127\.0\.0\.1:8787/);
    assert.equal(describeError(new Anthropic.AnthropicError('Could not resolve authentication method'), { hasKey: false }).code, 'no_key');
  });

  test('empty or oversized player messages are refused before any request', async () => {
    const client = fakeClient();
    const voice = new ClaudeVoice({ client });
    await assert.rejects(voice.stream(persona, null, null, '   '), e => e instanceof VoiceError && e.code === 'empty');
    await assert.rejects(voice.stream(persona, null, null, 'x'.repeat(DEFAULTS.maxPlayerChars + 1)), e => e instanceof VoiceError && e.code === 'bad_request');
    assert.equal(client.calls.stream.length, 0);
  });

  test("through the proxy the player's own key never leaves the page", async () => {
    const PLAYER_KEY = 'sk-ant-PLAYER-OWN-KEY';
    const seen = [];
    const capture = http.createServer((req, res) => {
      seen.push({ url: req.url, headers: req.headers });
      const body = JSON.stringify({ id: 'claude-opus-5-5', type: 'model', display_name: 'Claude Opus 5.5', created_at: '2026-01-01T00:00:00Z' });
      res.writeHead(200, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) });
      res.end(body);
    });
    await new Promise(resolve => capture.listen(0, '127.0.0.1', resolve));
    try {
      const base = `http://127.0.0.1:${capture.address().port}/api/anthropic`;
      for (const options of [{ apiKey: PLAYER_KEY, proxyURL: base }, { apiKey: PLAYER_KEY, baseURL: base }]) {
        const voice = new ClaudeVoice({ ...options, maxRetries: 0 });
        assert.equal(voice.proxied, true);
        const r = await voice.ping();
        assert.equal(r.ok, true, JSON.stringify(r));
      }
      assert.equal(seen.length, 2);
      for (const s of seen) {
        assert.equal(s.url, '/api/anthropic/v1/models/claude-opus-5-5');
        assert.ok(!JSON.stringify(s.headers).includes(PLAYER_KEY), 'the key is in no header');
        assert.equal(s.headers.authorization, `Bearer ${PROXY_DUMMY_KEY}`);
      }
    } finally {
      await new Promise(resolve => { capture.closeAllConnections(); capture.close(() => resolve()); });
    }
  });

  test('ping checks the key without spending tokens', async () => {
    const ok = await new ClaudeVoice({ client: fakeClient() }).ping();
    assert.equal(ok.ok, true);
    assert.equal(ok.model, 'claude-opus-5-5');
    const bad = await new ClaudeVoice({ client: fakeClient({ model: new Anthropic.AuthenticationError(401, { type: 'error', error: { type: 'authentication_error', message: 'invalid' } }, undefined, new Headers()) }) }).ping();
    assert.equal(bad.ok, false);
    assert.equal(bad.code, 'auth');
    assert.match(bad.message, /API key/);
  });
});

describe('reflection', () => {
  const transcript = () => {
    const h = new History();
    h.append({ user: "Hi, I'm Sam. I'm a nurse at Olive View.", assistant: 'Oh, nice! My clinic sends people up there all the time.', situation: 'note 1' });
    h.append({ user: 'My dog Biscuit hates the Santa Anas more than I do.', assistant: 'Ay, poor Biscuit. Ours hides under the bed.', situation: 'note 2' });
    return h;
  };

  test('structured output is requested, parsed and validated', async () => {
    const client = fakeClient({ creates: [jsonMessage(REFLECTION)] });
    const voice = new ClaudeVoice({ client, world });
    const r = await voice.reflect(persona, transcript());
    assert.equal(r.summary, REFLECTION.summary);
    assert.deepEqual(r.facts_about_player, ['works as a nurse at Olive View', 'has a dog named Biscuit']);
    assert.equal(r.affinity_delta, 0.12);
    assert.equal(r.trust_delta, 0.05);
    assert.equal(r.mood, 'content');
    assert.equal(r.memorable_line, 'Biscuit hates the Santa Anas more than I do.');
    assert.equal(r.follow_up, null);
    assert.equal(r.usage.cache_read_input_tokens, 2200);
    const { params } = client.calls.create[0];
    assert.deepEqual(params.output_config, { effort: 'low', format: { type: 'json_schema', schema: REFLECTION_SCHEMA } });
    assert.deepEqual(params.system, systemBlocks(persona, world), 'same cached prefix as the conversation');
    assert.equal(params.messages.at(-1).role, 'system');
    assert.equal(params.messages[0].role, 'user');
    assert.match(params.messages[0].content[0].text, /Player: Hi, I'm Sam/);
    assert.match(params.messages[0].content[0].text, /Mari: Ay, poor Biscuit/);
    assert.equal(params.fallbacks, 'default');
    const keys = allKeys(params);
    for (const k of ['thinking', 'temperature', 'top_p', 'top_k', 'budget_tokens']) assert.ok(!keys.has(k), `no ${k}`);
  });

  test('the schema closes every object and requires every property', () => {
    const walk = s => {
      if (s.type === 'object') {
        assert.equal(s.additionalProperties, false);
        assert.deepEqual([...s.required].sort(), Object.keys(s.properties).sort());
        Object.values(s.properties).forEach(walk);
      }
      if (s.type === 'array') walk(s.items);
    };
    walk(REFLECTION_SCHEMA);
    assert.deepEqual(REFLECTION_SCHEMA.properties.mood.enum, [...MOODS]);
    for (const k of ['minimum', 'maximum', 'maxItems', 'minLength']) assert.ok(!allKeys(REFLECTION_SCHEMA).has(k), `no unsupported ${k}`);
  });

  test('invalid output is rejected', async () => {
    const bad = [
      'not json at all',
      JSON.stringify({ ...REFLECTION, mood: undefined }),
      JSON.stringify({ ...REFLECTION, affinity_delta: 'a lot' }),
      JSON.stringify({ ...REFLECTION, extra: 1 }),
      JSON.stringify({ ...REFLECTION, mood: 'ecstatic' }),
      JSON.stringify({ ...REFLECTION, facts_about_player: 'a nurse' }),
      JSON.stringify({ ...REFLECTION, summary: '' }),
      JSON.stringify([REFLECTION]),
    ];
    for (const text of bad) {
      const voice = new ClaudeVoice({ client: fakeClient({ creates: [jsonMessage(text)] }) });
      await assert.rejects(voice.reflect(persona, transcript()), e => e instanceof VoiceError && e.code === 'invalid_output', text.slice(0, 40));
    }
    const refused = new ClaudeVoice({ client: fakeClient({ creates: [jsonMessage('', { stopReason: 'refusal', stopDetails: { type: 'refusal', category: null, explanation: null } })] }) });
    await assert.rejects(refused.reflect(persona, transcript()), e => e.code === 'refusal');
    const cut = new ClaudeVoice({ client: fakeClient({ creates: [jsonMessage('{"summary": "I', { stopReason: 'max_tokens' })] }) });
    await assert.rejects(cut.reflect(persona, transcript()), e => e.code === 'invalid_output');
    await assert.rejects(new ClaudeVoice({ client: fakeClient() }).reflect(persona, new History()), e => e.code === 'empty');
  });

  test('validateReflection clamps, trims and dedupes', () => {
    const v = validateReflection({ ...REFLECTION, affinity_delta: 3, trust_delta: -1.5, mood: ' Happy ', memorable_line: '  ' });
    assert.equal(v.ok, true);
    assert.equal(v.value.affinity_delta, 1);
    assert.equal(v.value.trust_delta, -1);
    assert.equal(v.value.mood, 'happy');
    assert.equal(v.value.memorable_line, null);
    assert.equal(validateReflection({ ...REFLECTION, trust_delta: Infinity }).ok, false);
    assert.equal(validateReflection(null).ok, false);
  });
});

// ---------------------------------------------------------------- history

describe('History', () => {
  test('trims only from the oldest end, in chunks, and never edits a turn', () => {
    const h = new History({ budget: 1000 });
    const starts = [];
    for (let k = 0; k < 40; k++) {
      h.append({ user: `question ${k} `.padEnd(60, '.'), assistant: `answer ${k} `.padEnd(60, '.'), situation: 'situation '.padEnd(40, '.'), t: k });
      starts.push(h.start);
    }
    assert.equal(h.length, 40);
    for (let k = 1; k < starts.length; k++) assert.ok(starts[k] >= starts[k - 1], 'the window start only moves forward');
    const changes = starts.filter((s, k) => k && s !== starts[k - 1]).length;
    assert.ok(changes >= 2 && changes <= 12, `trimmed in chunks (${changes} trims for 40 turns)`);
    assert.ok(h.windowChars() <= 1000);
    const msgs = h.messages();
    assert.equal(msgs[0].role, 'user');
    assert.deepEqual(msgs.slice(0, 3).map(m => m.role), ['user', 'system', 'assistant']);
    assert.equal(msgs[0].content[0].text, h.turns[h.start].user);
    assert.equal(h.turns[0].user.startsWith('question 0'), true, 'trimmed turns are kept for the transcript');
    assert.equal(h.transcript().length, 80);
    msgs[0].content[0].text = 'mutated';
    assert.notEqual(h.messages()[0].content[0].text, 'mutated', 'messages() hands out copies');
    const back = History.from(JSON.parse(JSON.stringify(h)));
    assert.deepEqual(back.messages(), h.messages());
    assert.equal(back.start, h.start);
    assert.throws(() => h.append({ user: 'x' }), TypeError);
  });
});

// ---------------------------------------------------------------- exports

describe('exports for game engines', () => {
  test('exportPersona and exportJSONL', () => {
    const e = exportPersona(persona, world);
    for (const k of ['id', 'name', 'persona', 'systemPrompt', 'defaults', 'voice']) assert.ok(k in e, k);
    assert.equal(e.id, '91042-1520-1');
    assert.equal(e.name, 'Marisol Henríquez');
    assert.equal(e.systemPrompt, systemPrompt(persona, world));
    assert.deepEqual(e.system, systemBlocks(persona, world));
    // defaults are JSON body fields only; the beta that `fallbacks` needs travels as an HTTP header
    assert.deepEqual(e.defaults, { model: 'claude-opus-5-5', max_tokens: DEFAULTS.maxTokens, output_config: { effort: 'low' }, fallbacks: 'default' });
    assert.deepEqual(e.headers, { 'anthropic-beta': FALLBACK_BETA });
    assert.ok(!('betas' in e.defaults), 'no SDK-only parameter in the body defaults');
    assert.match(e.turnProtocol, /anthropic-beta header/);
    assert.equal(e.promptVersion, PROMPT_VERSION);
    assert.equal(e.voice.dialect, 'sfv');
    assert.deepEqual(e.voice.codeSwitch, { lang: 'spanish', rate: 0.15 });
    assert.deepEqual(e.persona, persona);
    const haiku = exportPersona(persona, world, { model: 'claude-haiku-5-5', effort: 'medium' });
    assert.deepEqual(haiku.defaults, { model: 'claude-haiku-5-5', max_tokens: DEFAULTS.maxTokens, output_config: { effort: 'medium' } });
    assert.deepEqual(haiku.headers, {});
    const other = structuredClone(persona);
    other.id = other.npc.id = '91042-1520-0';
    other.npc.name = { first: 'Julio', last: 'Henríquez', full: 'Julio Henríquez', display: 'Julio Henríquez', nick: null };
    const jsonl = exportJSONL([persona, other], world);
    assert.ok(jsonl.endsWith('\n'));
    const lines = jsonl.trimEnd().split('\n');
    assert.equal(lines.length, 2);
    assert.deepEqual(lines.map(l => JSON.parse(l).name), ['Marisol Henríquez', 'Julio Henríquez']);
    assert.equal(exportJSONL([], world), '');
  });

  test('an object referenced twice is exported twice; only a real cycle is cut', () => {
    const p = structuredClone(persona);
    const road = { name: 'I-210', route: 210, kind: 'I', distKm: 2.2 };
    p.knowledge.roads = [road];
    p.npc.commute.road = road;
    const e = exportPersona(p, world);
    assert.deepEqual(e.persona.knowledge.roads, [road]);
    assert.deepEqual(e.persona.npc.commute.road, road);
    // A cycle, a Map, a Set, a typed array, a bigint, a Date and a function, the way JSON.stringify would write them.
    const odd = structuredClone(persona);
    odd.self = odd;
    odd.extra = { list: [1, () => 2, undefined], when: new Date(Date.UTC(2026, 10, 24)), big: 12n, nan: NaN, map: new Map([['a', 1]]), set: new Set(['x']), f32: new Float32Array([0.5]) };
    odd.extra.loop = [odd.extra];
    const x = exportPersona(odd, world);
    assert.equal('self' in x.persona, false, 'the back reference to the persona is cut');
    assert.deepEqual(x.persona.extra, { list: [1, null, null], when: '2026-11-24T00:00:00.000Z', big: '12', nan: null, map: { a: 1 }, set: ['x'], f32: [0.5], loop: [null] });
    assert.doesNotThrow(() => JSON.stringify(x));
  });
});

// ---------------------------------------------------------------- the server and proxy

const SECRET = 'sk-ant-test-secret-never-shown';

async function startServer(options = {}) {
  const logs = [];
  const server = createServer({ log: l => logs.push(l), env: { ANTHROPIC_API_KEY: SECRET }, ...options });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    server, port, logs, base: `http://127.0.0.1:${port}`, proxy: `http://127.0.0.1:${port}/api/anthropic`,
    close: () => new Promise(resolve => { server.closeAllConnections(); server.close(() => resolve()); }),
  };
}

/** A plain HTTP request with full control of the headers (Host, Origin). */
function raw(port, { method = 'GET', path: p = '/', headers = {}, body = null } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method, path: p, headers: { ...(body ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) } : {}), ...headers } }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

/** A fake Anthropic upstream for the server: scripted per call, recording what the server sent. */
function upstream(script) {
  const calls = [];
  let n = 0;
  return {
    calls,
    factory: () => ({
      beta: { messages: { create: (params, options) => { calls.push({ params: structuredClone(params), signal: options && options.signal }); return script(params, n++); } } },
      models: { retrieve: async id => { calls.push({ retrieve: id }); return { id, type: 'model', display_name: modelInfo(id).label, created_at: '2026-01-01T00:00:00Z' }; } },
    }),
  };
}

async function* sse(events, { failAfter = Infinity, error = null } = {}) {
  let k = 0;
  for (const e of events) {
    if (k++ === failAfter) throw error;
    yield e;
  }
}

describe('server and Claude proxy', () => {
  const UNICODE = ['¡Órale! ', 'The 210 was a parking lot, ', '¿sabes? 🌄 ', 'Bueno… café first. ', '"Quotes" and \\ backslashes\nand a new line.'];
  let srv;
  let up;
  before(async () => {
    up = upstream(params => {
      if (params.stream) return Promise.resolve(sse(rawEvents({ chunks: UNICODE, model: params.model })));
      return Promise.resolve(jsonMessage(REFLECTION));
    });
    srv = await startServer({ clientFactory: up.factory });
  });
  after(() => srv && srv.close());

  test('the real SDK streams through the proxy and its parser gets the text intact', async () => {
    const client = new Anthropic({ apiKey: 'dummy-key', baseURL: srv.proxy, maxRetries: 0 });
    const s = client.beta.messages.stream({
      model: 'claude-opus-5-5', max_tokens: 1024, betas: [FALLBACK_BETA], fallbacks: 'default', output_config: { effort: 'low' },
      system: systemBlocks(persona, world), messages: [{ role: 'user', content: 'Hola' }, { role: 'system', content: 'note' }],
    });
    const deltas = [];
    s.on('text', d => deltas.push(d));
    const message = await s.finalMessage();
    assert.deepEqual(deltas, UNICODE);
    assert.equal(message.content.find(b => b.type === 'text').text, UNICODE.join(''));
    assert.equal(message.stop_reason, 'end_turn');
    assert.equal(message.usage.cache_read_input_tokens, 2210);
    const sent = up.calls.at(-1).params;
    assert.equal(sent.model, 'claude-opus-5-5');
    assert.equal(sent.stream, true);
    assert.deepEqual(sent.betas, [FALLBACK_BETA]);
    assert.equal(sent.fallbacks, 'default');
    assert.deepEqual(sent.system, systemBlocks(persona, world));
    assert.ok(!JSON.stringify(sent).includes('dummy-key'), 'the page key is never forwarded');
  });

  test('ClaudeVoice through the proxy: stream, reflect and ping', async () => {
    const voice = new ClaudeVoice({ proxyURL: srv.proxy, world, maxRetries: 0 });
    const history = new History();
    let streamed = '';
    const out = await voice.stream(persona, mind, history, 'How was the drive?', { t: T, weather: world.weatherAt(ZI, T), onText: d => { streamed += d; } });
    assert.equal(streamed, UNICODE.join(''));
    assert.equal(out.text, UNICODE.join('').trim());
    assert.equal(history.length, 1);
    const sent = up.calls.at(-1).params;
    assert.equal(sent.messages.at(-1).role, 'system');
    assert.deepEqual(sent.output_config, { effort: 'low' });
    const r = await voice.reflect(persona, history);
    assert.equal(r.mood, 'content');
    assert.equal(up.calls.at(-1).params.stream, false);
    assert.deepEqual(up.calls.at(-1).params.output_config.format, { type: 'json_schema', schema: REFLECTION_SCHEMA });
    const ping = await voice.ping();
    assert.equal(ping.ok, true);
    assert.equal(ping.model, 'claude-opus-5-5');
  });

  test('/api/health reports the credential without revealing it', async () => {
    const res = await fetch(`${srv.base}/api/health`);
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.ok(!text.includes(SECRET));
    const h = JSON.parse(text);
    assert.equal(h.ok, true);
    assert.equal(h.keyConfigured, true);
    assert.equal(h.credential, 'ANTHROPIC_API_KEY');
    assert.equal(h.proxy, '/api/anthropic');
    assert.deepEqual(h.models, MODELS.map(m => m.id));
    const verify = await (await fetch(`${srv.base}/api/health?verify=1`)).json();
    assert.equal(verify.verified, true);
    const none = await startServer({ env: {} });
    try {
      const n = await (await fetch(`${none.base}/api/health`)).json();
      assert.equal(n.keyConfigured, false);
      assert.equal(n.credential, null);
      assert.ok(n.hint);
      // Without a credential the default upstream is never called: the proxy answers 401 itself.
      const voice = new ClaudeVoice({ proxyURL: none.proxy, maxRetries: 0 });
      await assert.rejects(voice.stream(persona, null, null, 'hi'), e => e.code === 'auth' && /no Anthropic API key/.test(e.message));
    } finally { await none.close(); }
  });

  test('invalid requests get 400 before anything reaches Anthropic', async () => {
    const before = up.calls.length;
    const client = new Anthropic({ apiKey: 'dummy', baseURL: srv.proxy, maxRetries: 0 });
    await assert.rejects(client.beta.messages.create({ model: 'claude-3-opus-20240229', max_tokens: 100, messages: [{ role: 'user', content: 'hi' }] }), e => e instanceof Anthropic.BadRequestError && /model must be one of/.test(e.message));
    const post = body => raw(srv.port, { method: 'POST', path: '/api/anthropic/v1/messages', body: JSON.stringify(body) });
    const ok = { model: 'claude-opus-5-5', max_tokens: 100, messages: [{ role: 'user', content: 'hi' }] };
    const cases = [
      [{ ...ok, tools: [{ name: 'x', input_schema: { type: 'object' } }] }, /tools are not available/],
      [{ ...ok, max_tokens: 100000 }, /max_tokens must be an integer from 0 to 8192/],
      [{ ...ok, temperature: 0.2 }, /"temperature" is not accepted/],
      [{ ...ok, thinking: { type: 'enabled', budget_tokens: 2048 } }, /thinking is adaptive/],
      [{ ...ok, messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'url', url: 'http://x' } }] }] }, /only text conversations/],
      [{ ...ok, messages: [{ role: 'user', content: [{ type: 'tool_result', tool_use_id: 'x', content: 'y' }] }] }, /only text conversations/],
      [{ ...ok, messages: [] }, /non-empty/],
      [{ ...ok, output_config: { effort: 'turbo' } }, /effort must be one of/],
      [{ ...ok, speed: 'fast' }, /"speed" is not accepted/],
    ];
    for (const [body, re] of cases) {
      const res = await post(body);
      assert.equal(res.status, 400, JSON.stringify(body).slice(0, 80));
      const err = JSON.parse(res.text);
      assert.equal(err.type, 'error');
      assert.equal(err.error.type, 'invalid_request_error');
      assert.match(err.error.message, re);
    }
    const beta = await raw(srv.port, { method: 'POST', path: '/api/anthropic/v1/messages', body: JSON.stringify(ok), headers: { 'anthropic-beta': 'computer-use-2025-11-24' } });
    assert.equal(beta.status, 400);
    const notJson = await raw(srv.port, { method: 'POST', path: '/api/anthropic/v1/messages', body: '{oops' });
    assert.equal(notJson.status, 400);
    const wrongType = await raw(srv.port, { method: 'POST', path: '/api/anthropic/v1/messages', body: JSON.stringify(ok), headers: { 'content-type': 'text/plain' } });
    assert.equal(wrongType.status, 415);
    const big = await raw(srv.port, { method: 'POST', path: '/api/anthropic/v1/messages', body: JSON.stringify({ ...ok, messages: [{ role: 'user', content: 'x'.repeat(1.2 * 1024 * 1024) }] }) });
    assert.equal(big.status, 413);
    const unknownModel = await raw(srv.port, { path: '/api/anthropic/v1/models/claude-2' });
    assert.equal(unknownModel.status, 404);
    const nowhere = await raw(srv.port, { path: '/api/anthropic/v1/complete' });
    assert.equal(nowhere.status, 404);
    assert.equal(up.calls.length, before, 'nothing invalid reached the upstream');
    assert.equal(validateMessagesRequest(ok).ok, true);
    assert.equal(validateMessagesRequest({ ...ok, fallbacks: [{ model: 'claude-opus-5' }] }).ok, true);
    assert.equal(validateMessagesRequest({ ...ok, fallbacks: 'everything' }).ok, false);
  });

  test('same origin only, and only for this host', async () => {
    const ok = JSON.stringify({ model: 'claude-opus-5-5', max_tokens: 100, messages: [{ role: 'user', content: 'hi' }] });
    const cross = await raw(srv.port, { method: 'POST', path: '/api/anthropic/v1/messages', body: ok, headers: { origin: 'https://evil.example' } });
    assert.equal(cross.status, 403);
    assert.equal(cross.headers['access-control-allow-origin'], undefined);
    const site = await raw(srv.port, { path: '/api/health', headers: { 'sec-fetch-site': 'cross-site' } });
    assert.equal(site.status, 403);
    const same = await raw(srv.port, { path: '/api/health', headers: { origin: `http://127.0.0.1:${srv.port}`, 'sec-fetch-site': 'same-origin' } });
    assert.equal(same.status, 200);
    const local = await raw(srv.port, { path: '/api/health', headers: { host: `localhost:${srv.port}` } });
    assert.equal(local.status, 200);
    const rebound = await raw(srv.port, { path: '/api/health', headers: { host: `attacker.example:${srv.port}` } });
    assert.equal(rebound.status, 403);
    const wrongPort = await raw(srv.port, { path: '/api/health', headers: { host: '127.0.0.1:1' } });
    assert.equal(wrongPort.status, 403);
    const preflight = await raw(srv.port, { method: 'OPTIONS', path: '/api/anthropic/v1/messages', headers: { origin: 'https://evil.example' } });
    assert.equal(preflight.status, 403);
  });

  test('the stream is relayed in exact SSE framing, one raw event per block', async () => {
    const body = JSON.stringify({ model: 'claude-opus-5-5', max_tokens: 100, stream: true, messages: [{ role: 'user', content: 'hi' }] });
    const res = await raw(srv.port, { method: 'POST', path: '/api/anthropic/v1/messages', body });
    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'], /^text\/event-stream/);
    const blocks = res.text.split('\n\n').filter(Boolean);
    const expected = rawEvents({ chunks: UNICODE, model: 'claude-opus-5-5' });
    assert.equal(blocks.length, expected.length);
    blocks.forEach((block, k) => {
      const [eventLine, dataLine, ...rest] = block.split('\n');
      assert.equal(rest.length, 0, 'one event line and one data line');
      assert.equal(eventLine, `event: ${expected[k].type}`);
      assert.ok(dataLine.startsWith('data: '));
      assert.deepEqual(JSON.parse(dataLine.slice(6)), expected[k]);
    });
  });

  test('non-streaming JSON passthrough and the /api/claude alias', async () => {
    const body = JSON.stringify({ model: 'claude-haiku-5-5', max_tokens: 200, messages: [{ role: 'user', content: 'hi' }] });
    for (const p of ['/api/anthropic/v1/messages', '/api/anthropic/v1/messages?beta=true', '/api/claude']) {
      const res = await raw(srv.port, { method: 'POST', path: p, body });
      assert.equal(res.status, 200, p);
      assert.equal(JSON.parse(res.text).id, 'msg_r');
    }
  });

  test('one log line per request', async () => {
    const before = srv.logs.length;
    await raw(srv.port, { path: '/api/health' });
    await raw(srv.port, { path: '/nope' });
    await raw(srv.port, { method: 'POST', path: '/api/anthropic/v1/messages', body: '{}' });
    assert.equal(srv.logs.length, before + 3);
    assert.match(srv.logs.at(-3), /GET \/api\/health 200/);
    assert.match(srv.logs.at(-1), /POST \/api\/anthropic\/v1\/messages 400/);
    assert.ok(!srv.logs.join('\n').includes(SECRET));
  });

  test('nothing a client sends can break a log line or forge one', async () => {
    const before = srv.logs.length;
    const forged = '\n2026-11-24T00:00:00.000Z 127.0.0.1 GET /api/health 200 1ms';
    await raw(srv.port, { method: 'POST', path: '/api/anthropic/v1/messages', body: JSON.stringify({ model: `claude-opus-5-5${forged}`, max_tokens: 10, messages: [{ role: 'user', content: 'hi' }] }) });
    await raw(srv.port, { method: 'POST', path: '/api/anthropic/v1/messages', body: JSON.stringify({ model: 'claude-opus-5-5', max_tokens: 10, messages: [{ role: 'user', content: 'hi' }], [`x\r\ny\u2028z`]: 1 }) });
    const added = srv.logs.slice(before);
    assert.equal(added.length, 2, 'one entry per request');
    for (const line of added) assert.doesNotMatch(line, /[\r\n\u2028\u2029]/, line);
    assert.match(added[0], /claude-opus-5-5\\n2026-11-24/, 'the newline is shown escaped');
    assert.match(added[1], /x\\r\\ny\\u2028z/);
    assert.equal(logSafe('a\tb\u0007c\u0085d'), 'a\\tb\\u0007c\\u0085d');
    assert.equal(logSafe('x'.repeat(500)).length, 200);
  });
});

describe('proxy error handling', () => {
  test('upstream errors keep their status, are not retried twice, and map to VoiceErrors', async () => {
    const limit = new Anthropic.RateLimitError(429, { type: 'error', error: { type: 'rate_limit_error', message: 'Number of requests has exceeded your rate limit' } }, undefined, new Headers({ 'retry-after': '3' }));
    const up = upstream(() => { throw limit; });
    const srv = await startServer({ clientFactory: up.factory });
    try {
      const voice = new ClaudeVoice({ proxyURL: srv.proxy }); // default SDK retries are on
      await assert.rejects(voice.stream(persona, null, null, 'hi'), e => e.code === 'rate_limit' && e.retryAfter === 3 && e.status === 429);
      assert.equal(up.calls.length, 1, 'x-should-retry: false stops the page SDK from retrying what the server retried');
    } finally { await srv.close(); }
  });

  test('the server key being rejected is explained as the server key', async () => {
    const up = upstream(() => { throw new Anthropic.AuthenticationError(401, { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }, undefined, new Headers()); });
    const srv = await startServer({ clientFactory: up.factory });
    try {
      const voice = new ClaudeVoice({ proxyURL: srv.proxy, maxRetries: 0 });
      await assert.rejects(voice.stream(persona, null, null, 'hi'), e => e.code === 'auth' && /Legion server's Anthropic API key was rejected/.test(e.message));
    } finally { await srv.close(); }
  });

  test('an error in the middle of a stream arrives as an SSE error event', async () => {
    const overloaded = new Anthropic.APIError(undefined, { type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } }, undefined, undefined, 'overloaded_error');
    const up = upstream(() => Promise.resolve(sse(rawEvents({ chunks: ['Hello', ' there'] }), { failAfter: 5, error: overloaded })));
    const srv = await startServer({ clientFactory: up.factory });
    try {
      const voice = new ClaudeVoice({ proxyURL: srv.proxy, maxRetries: 0 });
      const history = new History();
      await assert.rejects(voice.stream(persona, null, history, 'hi'), e => e.code === 'overloaded' && e.retryable);
      assert.equal(history.length, 0);
      assert.match(srv.logs.at(-1), /mid-stream: overloaded_error/);
    } finally { await srv.close(); }
  });

  test('a cancelled reply aborts the upstream request', async () => {
    let release;
    const gate = new Promise(r => { release = r; });
    let aborted = false;
    const up = upstream((params) => Promise.resolve((async function* () {
      const events = rawEvents({ chunks: ['Hello', ' there'] });
      yield events[0];
      yield events[1];
      await gate;
      for (const e of events.slice(2)) yield e;
    })()));
    const srv = await startServer({ clientFactory: () => {
      const c = up.factory();
      const create = c.beta.messages.create;
      c.beta.messages.create = (p, o) => { o.signal.addEventListener('abort', () => { aborted = true; release(); }); return create(p, o); };
      return c;
    } });
    try {
      const controller = new AbortController();
      const voice = new ClaudeVoice({ proxyURL: srv.proxy, maxRetries: 0 });
      const pending = voice.stream(persona, null, null, 'hi', { signal: controller.signal });
      while (!up.calls.length) await new Promise(r => setTimeout(r, 5));
      await new Promise(r => setTimeout(r, 30));
      controller.abort();
      await assert.rejects(pending, e => e.code === 'aborted');
      for (let k = 0; k < 100 && !aborted; k++) await new Promise(r => setTimeout(r, 10));
      assert.equal(aborted, true, 'the upstream request was aborted when the page went away');
    } finally { release(); await srv.close(); }
  });

  test('a busy server answers 429 with a retry hint', async () => {
    let release;
    const gate = new Promise(r => { release = r; });
    let entered;
    const inside = new Promise(r => { entered = r; });
    const up = upstream(async () => { entered(); await gate; return jsonMessage(REFLECTION); });
    const srv = await startServer({ clientFactory: up.factory, maxConcurrent: 1 });
    try {
      const body = JSON.stringify({ model: 'claude-opus-5-5', max_tokens: 100, messages: [{ role: 'user', content: 'hi' }] });
      const first = raw(srv.port, { method: 'POST', path: '/api/anthropic/v1/messages', body });
      await inside;
      const second = await raw(srv.port, { method: 'POST', path: '/api/anthropic/v1/messages', body });
      assert.equal(second.status, 429);
      assert.equal(second.headers['retry-after'], '1');
      assert.equal(second.headers['x-should-retry'], 'true');
      release();
      assert.equal((await first).status, 200);
    } finally { release(); await srv.close(); }
  });
});

describe('static files', () => {
  test('serves Legion.html at / and files under the root, never dotfiles or anything outside', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'legion-serve-'));
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'legion-outside-'));
    try {
      fs.writeFileSync(path.join(root, 'Legion.html'), '<!doctype html><title>Legion</title>');
      fs.mkdirSync(path.join(root, 'src'));
      fs.writeFileSync(path.join(root, 'src', 'a.mjs'), 'export const a = 1;');
      fs.writeFileSync(path.join(root, '.env'), `ANTHROPIC_API_KEY=${SECRET}`);
      fs.writeFileSync(path.join(outside, 'secret.txt'), SECRET);
      fs.symlinkSync(path.join(outside, 'secret.txt'), path.join(root, 'link.txt'));
      const srv = await startServer({ root, clientFactory: upstream(() => null).factory });
      try {
        const home = await raw(srv.port, { path: '/' });
        assert.equal(home.status, 200);
        assert.match(home.headers['content-type'], /^text\/html/);
        assert.match(home.text, /<title>Legion/);
        assert.equal(home.headers['x-content-type-options'], 'nosniff');
        const js = await raw(srv.port, { path: '/src/a.mjs' });
        assert.equal(js.status, 200);
        assert.match(js.headers['content-type'], /^text\/javascript/);
        const again = await raw(srv.port, { path: '/src/a.mjs', headers: { 'if-none-match': js.headers.etag } });
        assert.equal(again.status, 304);
        const head = await raw(srv.port, { method: 'HEAD', path: '/Legion.html' });
        assert.equal(head.status, 200);
        assert.equal(head.text, '');
        for (const p of ['/.env', '/%2e%2e/%2e%2e/etc/passwd', '/src/../.env', '/..%2f..%2fetc/passwd', '/link.txt', '/src', '/missing.js', '/%E0%A4%A']) {
          const res = await raw(srv.port, { path: p });
          assert.ok(res.status === 404 || res.status === 400, `${p} -> ${res.status}`);
          assert.ok(!res.text.includes(SECRET), p);
        }
        assert.equal((await raw(srv.port, { method: 'POST', path: '/Legion.html' })).status, 405);
      } finally { await srv.close(); }
      fs.rmSync(path.join(root, 'Legion.html'));
      const empty = await startServer({ root, clientFactory: upstream(() => null).factory });
      try {
        const res = await raw(empty.port, { path: '/' });
        assert.equal(res.status, 503);
        assert.match(res.text, /node tools\/build\.mjs/);
      } finally { await empty.close(); }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });
});
