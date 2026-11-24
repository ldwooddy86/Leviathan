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

// ------------------------------------------------------------------ final review fixes

test('the CLI refuses impossible dates, times and seeds, checks export options, and says why a place has no one (eng-54)', async () => {
  for (const args of [['plan', '94110-123-0', '--date', '2026-02-30'], ['plan', '94110-123-0', '--date', '2026-13-45'], ['prompt', '94110-123-0', '--t', '2026-11-24T25:00'], ['prompt', '94110-123-0', '--t', '12345'], ['prompt', '94110-123-0', '--t', '99999999999999999'], ['npc', '94110-123-0', '--seed', '4294967297'], ['npc', '94110-123-0', '--seed', '1.5'], ['export', '94110', '1', '--model', 'gpt-x'], ['export', '94110', '1', '--effort', 'turbo']]) {
    const r = await run(args);
    assert.equal(r.code, 2, `${args.join(' ')} → ${r.code} ${r.stdout.slice(0, 80)}`);
  }
  const empty = await run(['sample', '90071', '3']);
  assert.equal(empty.code, 1);
  assert.match(empty.stderr, /has no households \(its [\d,]+ residents live in group quarters/);
  // the household as this NPC's relatives, the dwelling with its article, the language by name (eng-53)
  const jon = (await run(['npc', '94110-1686-2'])).stdout;
  assert.match(jon, /rents a unit in a small building/);
  assert.doesNotMatch(jon, /\ban unit\b|^\s+(sibling|child|householder): /m);
  assert.match(jon, /Languages: [A-Z]/);
});

test('talk --store: a directory or a missing folder stops the command before the conversation (eng-48)', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'legion-cli-'));
  try {
    const asDir = await run(['talk', '94110-123-0', '--store', dir], { input: 'hi\n/bye\n' });
    assert.equal(asDir.code, 2);
    assert.match(asDir.stderr, /is a directory/);
    assert.ok(!fs.existsSync(`${dir}.tmp`), 'no stray .tmp file beside the directory');
    const nowhere = await run(['talk', '94110-123-0', '--store', path.join(dir, 'no', 'such', 'minds.json')], { input: 'hi\n/bye\n' });
    assert.equal(nowhere.code, 2);
    assert.match(nowhere.stderr, /does not exist/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('talk --claude: a failed turn is a note from Legion and the conversation goes on; no credential says what to do (eng-49)', async () => {
  // a Legion server whose upstream fails once with an overload, then answers
  const up = fakeUpstream();
  let failures = 1;
  const factory = () => { const c = up.factory(); const create = c.beta.messages.create; c.beta.messages.create = async params => { if (params.stream && failures-- > 0) { const e = new Error('Overloaded'); e.status = 529; e.error = { error: { type: 'overloaded_error', message: 'Overloaded' } }; throw e; } return create(params); }; return c; };
  const server = createServer({ root: ROOT, clientFactory: factory, env: {}, log: () => {} });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const proxy = `http://127.0.0.1:${server.address().port}/api/anthropic`;
    const r = await run(['talk', '94110-123-0', '--claude', '--proxy', proxy], { input: 'Hi!\nIs the fog gone?\n/bye\n' });
    assert.equal(r.code, 0, r.stderr);
    assert.match(r.stderr, /\(Legion\) /, 'the failure is a note from Legion');
    assert.equal(r.stdout.split('\n').filter(l => l.endsWith(up.text)).length, 1, 'the second turn was answered');
    assert.doesNotMatch(r.stdout, /^\w+: $/m, 'no dangling name before a failed reply');
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});

test('the Legion server: the NPC API answers in JSON, and offline talk keeps a session (exp-70)', async () => {
  const server = createServer({ root: ROOT, env: {}, log: () => {} });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const get = async p => { const r = await fetch(base + p); return { status: r.status, body: await r.json() }; };
  const post = async (p, b) => { const r = await fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }); return { status: r.status, body: await r.json() }; };
  try {
    const npc = await get('/api/npc/94110-123-0');
    assert.equal(npc.status, 200);
    assert.equal(npc.body.id, '94110-123-0');
    assert.equal((await get('/api/npc/99999-1-0')).status, 404);
    const sample = await get('/api/sample?where=Oakland&n=3');
    assert.equal(sample.body.length, 3);
    assert.ok(sample.body.every(p => p.place.city === 'Oakland'));
    assert.equal((await get('/api/sample?where=Atlantis&n=3')).status, 404);
    assert.equal((await get('/api/sample?where=CA&n=5000')).status, 400);
    const persona = await get('/api/persona/94110-123-0?t=2026-11-24T16:00:00Z');
    assert.equal(persona.body.npc, '94110-123-0');
    assert.ok(persona.body.big5 && persona.body.speech);
    const prompt = await get('/api/prompt/94110-123-0');
    assert.equal(prompt.body.blocks.length, 2);
    const situation = await get('/api/situation/94110-123-0?said=fog');
    assert.match(situation.body.situation, /Situation for this turn/);
    const plan = await get('/api/plan/94110-123-0?date=2026-11-25');
    assert.equal(new Date(plan.body[0].start).toISOString(), '2026-11-25T08:00:00.000Z');
    const activity = await get('/api/activity/94110-123-0');
    assert.ok(activity.body.kind);
    const ex = await get('/api/export/94110-123-0?model=claude-sonnet-5-5');
    assert.equal(ex.body.format, 'legion.persona/1');
    assert.equal(ex.body.defaults.model, 'claude-sonnet-5-5');
    assert.equal((await get('/api/export/94110-123-0?model=gpt-x')).status, 400);
    assert.ok(Number.isFinite((await get('/api/weather/94110')).body.now.tempF));
    assert.equal((await get('/api/persona/94110-123-0?t=yesterday')).status, 400);
    // a conversation: a session greets, answers, says goodbye, then stays ended
    const start = await post('/api/talk/94110-123-0', {});
    assert.equal(start.status, 200);
    assert.ok(start.body.session && start.body.lines.length === 1 && start.body.lines[0].who === 'npc');
    const turn = await post('/api/talk/94110-123-0', { session: start.body.session, text: 'How is the weather today?' });
    assert.ok(turn.body.lines[0].facts.includes('weather.now'), JSON.stringify(turn.body.lines[0]));
    const bye = await post('/api/talk/94110-123-0', { session: start.body.session, end: true });
    assert.equal(bye.body.ended, true);
    assert.equal((await post('/api/talk/94110-123-0', { session: start.body.session, text: 'hi' })).status, 409);
    assert.equal((await post('/api/talk/94110-1686-2', { session: start.body.session, text: 'hi' })).status, 409, 'a session is one NPC');
    // cross-origin requests are refused unless --cors names the origin
    const cross = await fetch(`${base}/api/npc/94110-123-0`, { headers: { origin: 'http://localhost:3000' } });
    assert.equal(cross.status, 403);
    const health = await get('/api/health');
    assert.ok(health.body.npcApi.some(r => /\/api\/talk/.test(r)));
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
  // --cors opens the NPC API (not the Claude proxy) to one origin
  const open = createServer({ root: ROOT, env: {}, log: () => {}, corsOrigins: ['http://localhost:3000'] });
  await new Promise(resolve => open.listen(0, '127.0.0.1', resolve));
  try {
    const b = `http://127.0.0.1:${open.address().port}`;
    const ok = await fetch(`${b}/api/weather/94110`, { headers: { origin: 'http://localhost:3000' } });
    assert.equal(ok.status, 200);
    assert.equal(ok.headers.get('access-control-allow-origin'), 'http://localhost:3000');
    const proxy = await fetch(`${b}/api/anthropic/v1/messages`, { method: 'POST', headers: { origin: 'http://localhost:3000', 'content-type': 'application/json' }, body: '{}' });
    assert.equal(proxy.status, 403);
  } finally {
    open.closeAllConnections();
    await new Promise(resolve => open.close(resolve));
  }
});

test('the Legion server on the network asks for its token and serves only the app; the proxy keeps to Legion\'s models (eng-50, eng-51)', async () => {
  const up = fakeUpstream();
  const server = createServer({ root: ROOT, host: '0.0.0.0', token: 'test-token-123', clientFactory: up.factory, env: {}, log: () => {} });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port, base = `http://127.0.0.1:${port}`;
  const body = JSON.stringify({ model: 'claude-opus-5-5', max_tokens: 100, messages: [{ role: 'user', content: 'hi' }] });
  try {
    assert.equal(server.legionToken, 'test-token-123');
    // no token: nothing, the Claude proxy included
    assert.equal((await fetch(`${base}/api/health`)).status, 401);
    assert.equal((await fetch(`${base}/api/claude`, { method: 'POST', headers: { 'content-type': 'application/json', host: `192.168.1.50:${port}` }, body })).status, 401);
    assert.equal(up.calls.length, 0, 'nothing reached the upstream');
    // the header (scripts) or the cookie the printed URL sets (the page)
    assert.equal((await fetch(`${base}/api/health`, { headers: { 'x-legion-token': 'test-token-123' } })).status, 200);
    const visit = await fetch(`${base}/?token=test-token-123`, { redirect: 'manual' });
    assert.equal(visit.status, 303);
    const cookie = visit.headers.get('set-cookie');
    assert.match(cookie, /legion_token=test-token-123; Path=\/; HttpOnly; SameSite=Strict/);
    assert.equal((await fetch(`${base}/api/health`, { headers: { cookie: 'legion_token=test-token-123' } })).status, 200);
    assert.equal((await fetch(`${base}/?token=wrong`, { redirect: 'manual' })).status, 403);
    // on the network only the app is served, not the sources or the data
    assert.equal((await fetch(`${base}/README.md`, { headers: { 'x-legion-token': 'test-token-123' } })).status, 404);
    assert.equal((await fetch(`${base}/data/world.json.gz`, { headers: { 'x-legion-token': 'test-token-123' } })).status, 404);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
  // the proxy: a fallback must be one of Legion's models too, and max_tokens at least 1
  const { validateMessagesRequest } = await import('../server/serve.mjs');
  const ok = { model: 'claude-opus-5-5', max_tokens: 100, messages: [{ role: 'user', content: 'hi' }] };
  assert.equal(validateMessagesRequest({ ...ok, fallbacks: [{ model: 'claude-sonnet-5-5' }] }).ok, true);
  assert.equal(validateMessagesRequest({ ...ok, fallbacks: [{ model: 'claude-opus-4-1-20250805' }] }).ok, false);
  assert.equal(validateMessagesRequest({ ...ok, fallbacks: [{ model: 'claude-x' }] }).ok, false);
  assert.equal(validateMessagesRequest({ ...ok, fallbacks: 'default' }).ok, true);
  assert.equal(validateMessagesRequest({ ...ok, max_tokens: 0 }).ok, false);
});
