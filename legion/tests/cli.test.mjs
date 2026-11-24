// Legion · tests for the command line (cli/legion.mjs), run as a child process the way a user runs it: every command
// with --json, the human output, --help and errors, an offline conversation over stdin with the mind kept in a file,
// and a Claude conversation through server/serve.mjs whose upstream is a fake (nothing reaches the network).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createServer } from '../server/serve.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(ROOT, 'cli', 'legion.mjs');

/** Run the CLI: {code, stdout, stderr}. No API key in its environment, so nothing could reach Anthropic. */
function run(args, { input = null, env = {} } = {}) {
  return new Promise((resolve, reject) => {
    const base = { ...process.env };
    delete base.ANTHROPIC_API_KEY; delete base.ANTHROPIC_AUTH_TOKEN;
    const child = spawn(process.execPath, [CLI, ...args], { cwd: ROOT, env: { ...base, ...env }, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', d => { stdout += d; });
    child.stderr.on('data', d => { stderr += d; });
    child.on('error', reject);
    child.on('close', code => resolve({ code, stdout, stderr }));
    if (input !== null) child.stdin.end(input); else child.stdin.end();
  });
}
const json = r => JSON.parse(r.stdout);

test('--help, unknown commands and bad arguments', async () => {
  const help = await run(['--help']);
  assert.equal(help.code, 0);
  for (const cmd of ['sample', 'npc', 'persona', 'prompt', 'plan', 'talk', 'export', 'stats', '--json', '--claude', '--proxy']) assert.ok(help.stdout.includes(cmd), cmd);
  const none = await run([]);
  assert.equal(none.code, 2);
  const unknown = await run(['dance']);
  assert.equal(unknown.code, 2);
  assert.match(unknown.stderr, /Unknown command "dance"/);
  const badOpt = await run(['sample', '94110', '--nope']);
  assert.equal(badOpt.code, 2);
  const noId = await run(['npc', '99999-1-0']);
  assert.equal(noId.code, 1);
  assert.match(noId.stderr, /No NPC has the id 99999-1-0/);
  const noPlace = await run(['sample', 'Atlantis', '2']);
  assert.equal(noPlace.code, 1);
  assert.match(noPlace.stderr, /Unknown place "Atlantis"/);
  const badN = await run(['sample', '94110', 'many']);
  assert.equal(badN.code, 2);
});

test('sample, npc, persona, prompt and plan: JSON for machines, text for people, deterministic', async () => {
  const s = await run(['sample', 'Oakland', '4', '--json']);
  assert.equal(s.code, 0, s.stderr);
  const people = json(s);
  assert.equal(people.length, 4);
  assert.ok(people.every(p => /^\d{5}-\d+-\d+$/.test(p.id) && p.place.city === 'Oakland'));
  assert.deepEqual(json(await run(['sample', 'Oakland', '4', '--json'])).map(p => p.id), people.map(p => p.id), 'the same people every run');
  const text = await run(['sample', 'Oakland', '4']);
  assert.equal(text.stdout.trim().split('\n').length, 4);
  assert.ok(text.stdout.includes(people[0].id));

  const id = people[0].id;
  const npc = json(await run(['npc', id, '--json']));
  assert.equal(npc.id, id);
  assert.ok(npc.household && npc.commute && npc.languages);
  if (npc.commute.road) assert.equal(typeof npc.commute.road.name, 'string', 'commute.road is an object with a name');
  const npcText = (await run(['npc', id])).stdout;
  assert.ok(npcText.startsWith(`${npc.name.display || npc.name.full} (${id})`), npcText.split('\n')[0]);

  const persona = json(await run(['persona', id, '--json']));
  assert.equal(persona.npc, id);
  for (const k of ['big5', 'traits', 'archetype', 'values', 'concerns', 'memories', 'speech', 'bio']) assert.ok(k in persona, k);
  assert.match((await run(['persona', id])).stdout, /Big Five: O \d\.\d\d · C/);

  const prompt = json(await run(['prompt', id, '--json']));
  assert.equal(prompt.blocks.length, 2);
  assert.ok(prompt.blocks.every(b => b.cache_control));
  assert.match(prompt.situation, /Local time: Monday, November 23, 2026/);
  const promptText = (await run(['prompt', id, '--t', '2026-11-24T08:15'])).stdout;
  assert.match(promptText, /=== system block 1 \(cache breakpoint\) ===/);
  assert.match(promptText, /Local time: Tuesday, November 24, 2026, 8:15 AM Pacific/);

  const plan = json(await run(['plan', id, '--date', '2026-11-25', '--json']));
  assert.ok(plan.length >= 2);
  assert.equal(new Date(plan[0].start).toISOString(), '2026-11-25T08:00:00.000Z', 'midnight Pacific on the date asked');
  for (let i = 1; i < plan.length; i++) assert.equal(plan[i].start, plan[i - 1].end);
  assert.match((await run(['plan', id, '--date', '2026-11-25'])).stdout, /on Wednesday, November 25, 2026:\n\s+12:00 AM/);
  assert.equal((await run(['plan', id, '--date', 'tomorrow'])).code, 2);
});

test('export writes JSON Lines of game-engine records; stats compares Census and generated', async () => {
  const ex = await run(['export', '94110', '3', '--model', 'claude-sonnet-5-5']);
  assert.equal(ex.code, 0, ex.stderr);
  const lines = ex.stdout.trim().split('\n').map(l => JSON.parse(l));
  assert.equal(lines.length, 3);
  for (const r of lines) {
    assert.equal(r.format, 'legion.persona/1');
    assert.equal(r.defaults.model, 'claude-sonnet-5-5');
    assert.equal(r.system.length, 2);
    assert.ok(r.systemPrompt.includes('CHARACTER SHEET'));
  }
  const st = json(await run(['stats', '94110', '--households', '300', '--json']));
  assert.equal(st.zip, '94110');
  assert.equal(st.households, 300);
  for (const k of ['hhsize', 'medianAge', 'under18', 'over65', 'foreign', 'own']) assert.ok(Number.isFinite(st.scalars[k].acs) && Number.isFinite(st.scalars[k].generated), k);
  const text = (await run(['stats', '94110', '--households', '300'])).stdout;
  assert.match(text, /^94110 San Francisco: 300 households/);
  assert.match(text, /Household size\s+\d\.\d\d\s+\d\.\d\d/);
  assert.match(text, /Language at home/);
});

test('talk (offline): a conversation over stdin, remembered in --store for the next one', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'legion-cli-'));
  try {
    const store = path.join(dir, 'minds.json');
    const [p] = json(await run(['sample', '91042', '1', '--json']));
    const r = await run(['talk', p.id, '--store', store, '--json'], { input: 'Hi, my name is Dana.\nHow is the weather today?\nWhat do you do for work?\nAny fires around here?\nThanks, nice talking!\n/bye\n' });
    assert.equal(r.code, 0, r.stderr);
    const turns = r.stdout.trim().split('\n').map(l => JSON.parse(l));
    const npcTurns = turns.filter(x => x.who === 'npc');
    assert.equal(npcTurns.length, 7, 'a greeting, five replies and a goodbye');
    assert.equal(turns.filter(x => x.who === 'player').length, 5);
    assert.ok(npcTurns.every(x => typeof x.text === 'string' && x.text.length > 0 && Array.isArray(x.facts)));
    assert.equal(npcTurns[0].intent, 'greeting');
    assert.equal(npcTurns.at(-1).intent, 'goodbye');
    assert.ok(npcTurns[2].facts.includes('weather.now'), JSON.stringify(npcTurns[2]));
    const saved = JSON.parse(fs.readFileSync(store, 'utf8'))[p.id];
    assert.ok(saved.memory.some(m => /The player said: "Hi, my name is Dana\."/.test(m.text)));
    assert.ok(saved.relationships.player.facts.some(f => /Dana/.test(f.text || f.value)));
    // the next conversation: the NPC knows the player
    const again = await run(['talk', p.id, '--store', store, '--t', '2026-11-24T18:00'], { input: '/bye\n' });
    assert.equal(again.code, 0, again.stderr);
    assert.match(again.stderr, /Talking with .* offline, at Tue Nov 24, 6:00 PM PT/);
    const text = again.stdout.split('\n')[0];
    assert.ok(text.length > 3, 'a greeting');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// a fake Anthropic upstream for server/serve.mjs: streams a reply, answers the reflection, records the requests
function fakeUpstream() {
  const calls = [];
  const reply = ['Oh, hey! ', 'The marine layer ', 'finally burned off.'];
  async function* events(model) {
    yield { type: 'message_start', message: { id: 'msg_cli', type: 'message', role: 'assistant', model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 40, output_tokens: 1, cache_read_input_tokens: 1200, cache_creation_input_tokens: 0 } } };
    yield { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } };
    for (const c of reply) yield { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: c } };
    yield { type: 'content_block_stop', index: 0 };
    yield { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 12 } };
    yield { type: 'message_stop' };
  }
  const reflection = { summary: 'Dana from Burbank asked about the weather.', facts_about_player: ['lives in Burbank'], affinity_delta: 0.1, trust_delta: 0.05, mood: 'content', memorable_line: 'Is the fog gone?', follow_up: 'Ask how Burbank is.' };
  return {
    calls, text: reply.join(''),
    factory: () => ({
      beta: { messages: { create: async params => {
        calls.push(params);
        if (params.stream) return events(params.model);
        return { id: 'msg_r', type: 'message', role: 'assistant', model: params.model, content: [{ type: 'text', text: JSON.stringify(reflection) }], stop_reason: 'end_turn', usage: { input_tokens: 30, output_tokens: 60 } };
      } } },
      models: { retrieve: async id => ({ id, type: 'model', display_name: id }) },
    }),
  };
}

test('talk --claude through a Legion server (fake upstream): streams, keeps the history, reflects into the mind', async () => {
  const up = fakeUpstream();
  const server = createServer({ root: ROOT, clientFactory: up.factory, env: {}, log: () => {} });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const proxy = `http://127.0.0.1:${server.address().port}/api/anthropic`;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'legion-cli-'));
  try {
    const [p] = json(await run(['sample', '91502', '1', '--json']));
    const store = path.join(dir, 'minds.json');
    const r = await run(['talk', p.id, '--claude', '--proxy', proxy, '--model', 'claude-sonnet-5-5', '--store', store], { input: "Hi! I'm Dana, from Burbank.\nIs the fog gone?\n/bye\n" });
    assert.equal(r.code, 0, r.stderr);
    assert.match(r.stderr, /through claude-sonnet-5-5 via http:\/\/127\.0\.0\.1/);
    const lines = r.stdout.trim().split('\n');
    assert.deepEqual(lines.filter(l => l.startsWith('You: ')), ["You: Hi! I'm Dana, from Burbank.", 'You: Is the fog gone?']);
    assert.equal(lines.filter(l => l.endsWith(up.text)).length, 2, 'both replies streamed in full');
    assert.match(r.stderr, /remembers: Dana from Burbank asked about the weather\./);
    // two turns and a reflection reached the (fake) upstream; the second turn carries the first as history
    const turns = up.calls.filter(c => c.stream);
    assert.equal(turns.length, 2);
    assert.equal(turns[0].model, 'claude-sonnet-5-5');
    assert.equal(turns[1].messages.length, turns[0].messages.length + 3, 'user, situation and reply of the first turn');
    assert.equal(turns[1].messages.at(-1).role, 'system');
    assert.equal(JSON.stringify(turns[1]).match(/"cache_control"/g).length, 3, 'three cache breakpoints');
    const reflect = up.calls.find(c => !c.stream);
    assert.equal(reflect.output_config.format.type, 'json_schema');
    const saved = JSON.parse(fs.readFileSync(store, 'utf8'))[p.id];
    assert.ok(saved.memory.some(m => m.text === 'Dana from Burbank asked about the weather.'), 'the reflection is in the mind');
    assert.ok(saved.memory.some(m => /The player said: "Is the fog gone\?"/.test(m.text)), 'the player\'s lines are in the mind');
    assert.ok(saved.relationships.player.facts.some(f => f.text === 'lives in Burbank'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
