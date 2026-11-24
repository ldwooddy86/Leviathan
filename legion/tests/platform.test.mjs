// Legion · tests for the platform facade (src/engine/platform.mjs, CONTRACTS section 11): createLegion from the
// default pack, a pack object and gzip bytes; NPCs, personas, minds in a pluggable store, conversations, the Claude
// voice, sampling by ZIP, city, county, region and state, day plans and the weather; determinism across instances.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLegion, resolvePlace, Legion } from '../src/engine/platform.mjs';
import { FileStore } from '../src/engine/mind.mjs';
import { ClaudeVoice, History } from '../src/engine/llm.mjs';
import { LEGION_SEED } from '../src/engine/population.mjs';

const PACK = fileURLToPath(new URL('../data/world.json.gz', import.meta.url));
const legion = await createLegion();
const world = legion.world;
const T = world.snapshotTime;

test('createLegion: the default pack, a pack object or gzip bytes; the population seed', async () => {
  assert.ok(legion instanceof Legion);
  assert.equal(world.N, 1762);
  assert.equal(legion.seed, LEGION_SEED);
  assert.equal(legion.t, T, 'times default to the NWS snapshot');
  const fromBytes = await createLegion({ pack: fs.readFileSync(PACK) });
  assert.equal(fromBytes.world.N, world.N);
  const fromObject = await createLegion({ pack: world.pack, seed: 7 });
  assert.equal(fromObject.seed, 7);
  const fromWorld = await createLegion({ world });
  assert.equal(fromWorld.world, world, 'an existing World is used as is');
  // the same pack and seed give the same people; another seed other people
  const a = legion.sample('94110', 5).map(n => n.id), b = fromBytes.sample('94110', 5).map(n => n.id);
  assert.deepEqual(a, b);
  assert.deepEqual(fromBytes.npc(a[0]).name, legion.npc(a[0]).name);
  assert.notDeepEqual(fromObject.sample('94110', 5).map(n => fromObject.npc(n.id).name.full), legion.sample('94110', 5).map(n => legion.npc(n.id).name.full));
});

test('npc, persona and the day: deterministic, cached per hour, clear errors for unknown ids', () => {
  const [n] = legion.sample('Fresno', 1);
  const npc = legion.npc(n.id);
  assert.equal(npc.id, n.id);
  assert.equal(legion.npc('99999-0-0'), null);
  assert.equal(legion.npc('not an id'), null);
  assert.throws(() => legion.persona('99999-0-0'), /No NPC has the id 99999-0-0/);
  const p = legion.persona(n.id);
  assert.equal(p.id, n.id);
  for (const k of ['big5', 'traits', 'archetype', 'values', 'interests', 'concerns', 'memories', 'knowledge', 'speech', 'bio', 'hooks']) assert.ok(k in p, k);
  assert.equal(legion.persona(n.id), p, 'cached');
  assert.equal(p.speech.dialect, 'fresno', "the lexicon's dialect");
  const other = new Legion(world);
  assert.deepEqual(other.persona(n.id).big5, p.big5);
  assert.equal(other.persona(n.id).bio, p.bio);
  const plan = legion.dayPlan(n.id, T);
  assert.ok(plan.length >= 2);
  assert.equal(plan[0].start, legion.clock.dayStart(T));
  for (let i = 1; i < plan.length; i++) assert.equal(plan[i].start, plan[i - 1].end, 'the plan tiles the day');
  const a = legion.activityAt(n.id, T);
  assert.ok(a.kind && a.position && Number.isFinite(a.position.x));
  assert.ok(legion.parseId(n.id).zip === n.zip);
});

test('sample: a ZIP, a city, a Census place, a county by name or FIPS, a region, the state; distinct and inside', () => {
  const inside = (npcs, zis) => npcs.every(x => zis.includes(x.zi));
  const zip = legion.sample('94110', 8);
  assert.equal(zip.length, 8);
  assert.ok(zip.every(x => x.zip === '94110'));
  const oakland = legion.sample('Oakland', 12);
  assert.equal(new Set(oakland.map(x => x.id)).size, 12);
  assert.ok(inside(oakland, resolvePlace(world, 'Oakland').zis));
  const county = legion.sample('Alameda County', 10);
  assert.ok(inside(county, world.zipsOfCounty('06001')));
  assert.deepEqual(legion.sample('06001', 10).map(x => x.id), county.map(x => x.id), 'the FIPS and the name are the same county');
  const region = legion.sample('ba', 10, { seed: 3 });
  assert.ok(region.every(x => x.place.region === 'ba'));
  assert.deepEqual(legion.sample('Bay Area', 10, { seed: 3 }).map(x => x.id), region.map(x => x.id));
  assert.equal(legion.sample('CA', 6).length, 6);
  assert.deepEqual(legion.sample('CA', 6).map(x => x.id), legion.sample('california', 6).map(x => x.id));
  // a name that is both a city and a county is the city unless it says County
  assert.equal(resolvePlace(world, 'Sacramento').kind, 'city');
  assert.equal(resolvePlace(world, 'Sacramento County').kind, 'county');
  assert.equal(resolvePlace(world, 'East Los Angeles').kind, 'place');
  assert.equal(resolvePlace(world, 'Contra Costa').kind, 'county', 'a county name that is no city');
  assert.throws(() => legion.sample('Atlantis', 3), /Unknown place "Atlantis"/);
  assert.deepEqual(legion.sample('94110', 0), []);
});

test('minds persist in a pluggable store: a conversation is remembered by the next platform', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'legion-platform-'));
  try {
    const file = path.join(dir, 'minds.json');
    const one = new Legion(world, { store: new FileStore(file) });
    const [n] = one.sample('91042', 1, { seed: 4 });
    const conv = one.conversation(n.id);
    assert.ok(conv.greet().text);
    const line = conv.reply('Hi! My name is Dana and I work as a nurse.');
    assert.ok(line.text);
    conv.farewell();
    one.mind(n.id).reflect(T, { force: true });
    assert.ok(one.saveMind(n.id));
    assert.ok(fs.existsSync(file));
    const two = new Legion(world, { store: new FileStore(file) });
    const m = two.mind(n.id, { t: T + 86400000 });
    assert.ok(m.relationship('player').facts.some(f => /Dana/.test(f.text || f.value)), 'the NPC remembers the name');
    assert.ok(m.toJSON().memory.some(x => /Dana/.test(x.text)));
    two.forgetMind(n.id);
    assert.equal(new FileStore(file).get(n.id), null);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('conversation, weather, prompt, export and barks', () => {
  const [n] = legion.sample('93721', 1, { seed: 2 });
  const conv = legion.conversation(n.id, { t: T });
  conv.greet();
  const wx = legion.weather('93721', T);
  assert.equal(wx.now.tempF, world.weatherAt(world.indexOf('93721'), T).now.tempF);
  assert.deepEqual(legion.weather(world.indexOf('93721'), T).now, wx.now);
  assert.throws(() => legion.weather('00000'), /Unknown ZIP/);
  const line = conv.reply("What's the weather like today?");
  assert.ok(line.facts.includes('weather.now'), JSON.stringify(line));
  assert.ok(line.text.includes(String(wx.now.tempF)) || line.text.includes(String(wx.now.short).toLowerCase()), line.text);
  const pr = legion.prompt(n.id);
  assert.equal(pr.blocks.length, 2);
  assert.ok(pr.blocks.every(b => b.cache_control), 'both system blocks carry a cache breakpoint');
  assert.equal(pr.text, pr.blocks.map(b => b.text).join('\n\n'));
  assert.match(pr.situation, /Local time: Monday, November 23, 2026/);
  const ex = legion.exportPersona(n.id, { model: 'claude-haiku-5-5' });
  assert.equal(ex.format, 'legion.persona/1');
  assert.equal(ex.defaults.model, 'claude-haiku-5-5');
  assert.ok(!('fallbacks' in ex.defaults), 'Haiku has no server-side refusal fallback');
  const [m] = legion.sample('93721', 2, { seed: 2 }).slice(1);
  const pair = legion.bark(n.id, m.id, { t: T });
  assert.ok(Array.isArray(pair) && pair.length === 2);
  assert.ok(pair.some(Boolean));
  const alone = legion.bark(n.id, null, { t: T, situation: 'wait' });
  assert.ok(alone === null || typeof alone.text === 'string');
});

test('voice: a ClaudeVoice with the world, streaming through an injected client (no network)', async () => {
  const [n] = legion.sample('94110', 1);
  const calls = [];
  const events = [
    { type: 'message_start', message: { id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [], stop_reason: null, usage: { input_tokens: 10, output_tokens: 0 } } },
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Foggy again, ' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'like always.' } },
    { type: 'content_block_stop', index: 0 },
    { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 6 } },
    { type: 'message_stop' },
  ];
  // the smallest SDK-shaped client ClaudeVoice needs: beta.messages.stream(params) with on('text') and finalMessage()
  const client = {
    beta: { messages: { stream(params) {
      calls.push(params);
      const handlers = [];
      return {
        on(ev, fn) { if (ev === 'text') handlers.push(fn); return this; },
        async finalMessage() {
          let text = '';
          for (const e of events) if (e.type === 'content_block_delta') { text += e.delta.text; for (const fn of handlers) fn(e.delta.text, text); }
          return { id: 'msg_1', model: 'claude-opus-5-5', role: 'assistant', content: [{ type: 'text', text }], stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 6, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } };
        },
      };
    } } },
  };
  const voice = legion.voice({ client });
  assert.ok(voice instanceof ClaudeVoice);
  assert.equal(voice.world, world);
  assert.equal(voice.model, 'claude-opus-5-5');
  const history = new History();
  const seen = [];
  const out = await voice.stream(legion.persona(n.id), legion.mind(n.id), history, 'How is the weather?', { t: T, weather: legion.weather(n.zip, T), onText: d => seen.push(d) });
  assert.equal(out.text, 'Foggy again, like always.');
  assert.deepEqual(seen, ['Foggy again, ', 'like always.']);
  assert.equal(history.length, 1);
  const params = calls[0];
  assert.equal(params.messages.at(-1).role, 'system', 'the situation note follows the player message');
  assert.equal(params.system.length, 2);
});
