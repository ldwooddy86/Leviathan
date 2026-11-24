// Legion · tests for the app module: the single-file build (tools/build.mjs) and the app's engine-facing code
// (the bus, the Census statistics behind the Place panel, settings, and the services registry in both states:
// modules missing, and modules wired). The page itself is exercised end to end by tests/e2e/run.mjs.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { build, check, bundle, inlineScripts, scriptSafe, jsString, OUT_FILE, PATHS } from '../tools/build.mjs';
import { loadDefaultWorld } from '../src/engine/world.mjs';
import { Population } from '../src/engine/population.mjs';
import { createBus } from '../src/app/bus.mjs';
import { zipScope, cityScope, countyScope, regionScope, scopeFromKey, scopeBBox, placeStats, residentsOf, fidelityTables, COMMUTE_GROUPS } from '../src/app/census.mjs';
import { normalizeSettings, DEFAULT_SETTINGS, DENSITIES } from '../src/app/settings.mjs';
import { daysLabel, fmtPct, fmtMoney, displayName, roadLabel } from '../src/app/format.mjs';

const sha = buf => crypto.createHash('sha256').update(buf).digest('hex');
const scratch = () => fs.mkdtempSync(path.join(process.env.LEGION_SCRATCH || os.tmpdir(), 'legion-build-'));
const world = await loadDefaultWorld();

// ------------------------------------------------------------------ the build

test('the build writes Legion.html with the pack, the app and the worker hook, under 15 MB, and --check passes', async () => {
  const r = await build({ quiet: true });
  assert.ok(fs.existsSync(OUT_FILE), 'Legion.html exists');
  const html = fs.readFileSync(OUT_FILE, 'utf8');
  assert.equal(Buffer.byteLength(html), r.bytes);
  assert.ok(r.bytes < 15 * 1024 * 1024, `${r.bytes} bytes`);

  assert.match(html, /<title>[^<]*Legion[^<]*<\/title>/);
  assert.match(html, /<meta name="description" content="[^"]{40,}">/);
  assert.match(html, /<meta name="viewport" content="width=device-width/);
  assert.match(html, /<meta name="legion-build" content="[0-9a-f]{12}">/);
  assert.doesNotMatch(html, /<script[^>]*\bsrc=/);
  assert.doesNotMatch(html, /type="module"/);
  assert.doesNotMatch(html, /<link[^>]*rel="stylesheet"/);

  // the pack is the exact gzip of data/world.json.gz
  const m = /window\.__LEGION_PACK__="([A-Za-z0-9+/=]+)"/.exec(html);
  assert.ok(m, 'pack script present');
  assert.equal(sha(Buffer.from(m[1], 'base64')), sha(fs.readFileSync(PATHS.pack)));

  // every inline script is a classic script (no import or export statements)
  const scripts = inlineScripts(html);
  assert.ok(scripts.length >= 3, `${scripts.length} scripts`);
  for (const s of scripts) assert.doesNotThrow(() => new vm.Script(s.code));
  const app = scripts.find(s => s.code.length > 50000 && !s.code.startsWith('window.__LEGION_'));
  assert.ok(app, 'app bundle present');
  assert.ok(app.code.includes('__LEGION_PACK__'), 'the app reads the inline pack');

  // the worker hook: present exactly when the crowd's worker module exists
  if (fs.existsSync(PATHS.worker)) {
    const w = scripts.find(s => s.code.startsWith('window.__LEGION_WORKER_SRC__='));
    assert.ok(w, 'worker hook present');
    const src = JSON.parse(w.code.slice('window.__LEGION_WORKER_SRC__='.length));
    assert.ok(src.length > 1000);
    assert.doesNotThrow(() => new vm.Script(src));
  } else {
    assert.ok(!html.includes('window.__LEGION_WORKER_SRC__='), 'no worker hook without crowd-worker.mjs');
  }

  const c = await check(OUT_FILE);
  assert.ok(c.ok, c.problems.join('; '));
  assert.equal(c.info.zips, world.N);
  assert.equal(c.info.population, world.totalPop);
});

test('the build is deterministic: two builds give the same bytes', async () => {
  const dir = scratch();
  try {
    const a = await build({ out: path.join(dir, 'a.html'), quiet: true });
    const b = await build({ out: path.join(dir, 'b.html'), quiet: true });
    assert.equal(a.id, b.id);
    assert.equal(sha(fs.readFileSync(path.join(dir, 'a.html'))), sha(fs.readFileSync(path.join(dir, 'b.html'))));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('the Anthropic SDK bundles for the browser and runs (the Claude bridge will import it)', async () => {
  const dir = scratch();
  const entry = path.join(dir, 'sdk-entry.mjs');
  fs.writeFileSync(entry, [
    "import Anthropic from '@anthropic-ai/sdk';",
    "const client = new Anthropic({ apiKey: 'sk-ant-test', dangerouslyAllowBrowser: true });",
    "globalThis.__legionSdkProbe = typeof client.messages.create === 'function' && typeof client.messages.stream === 'function' ? 'ok' : 'missing';",
  ].join('\n'));
  try {
    const { code, inputs } = await bundle(entry);
    assert.ok(inputs.some(i => i.includes('@anthropic-ai/sdk')), 'the SDK was bundled');
    assert.ok(code.length > 100000, `${code.length} bytes`);
    assert.doesNotThrow(() => new vm.Script(code), 'parses as a classic script');
    vm.runInThisContext(code);
    assert.equal(globalThis.__legionSdkProbe, 'ok');
  } finally {
    delete globalThis.__legionSdkProbe;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('node: imports on Node-only paths become a stub, so the page has no import() left', async () => {
  const dir = scratch();
  const entry = path.join(dir, 'node-entry.mjs');
  fs.writeFileSync(entry, "globalThis.__legionNodeProbe = async () => { const z = await import('node:zlib'); try { z.default.gunzipSync(); return 'called'; } catch (e) { return e.message; } };\n");
  try {
    const { code } = await bundle(entry);
    assert.doesNotMatch(code, /\bimport\s*\(/);
    vm.runInThisContext(code);
    assert.match(await globalThis.__legionNodeProbe(), /node:zlib is not available in the browser/);
  } finally {
    delete globalThis.__legionNodeProbe;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('inline script escaping', () => {
  assert.equal(scriptSafe('a="</script>";b="<!--"'), 'a="<\\/script>";b="<\\x21--"');
  const s = 'x</script><!-- ';
  const lit = jsString(s);
  assert.doesNotMatch(lit, /<\//);
  assert.equal(vm.runInNewContext(lit), s);
});

// ------------------------------------------------------------------ app helpers

test('bus: on, once, off, wildcard, and a throwing listener does not stop the others', () => {
  const errors = [];
  const b = createBus({ onError: e => errors.push(e.message) });
  const seen = [];
  const offA = b.on('npc:select', p => seen.push(['a', p.id]));
  b.on('npc:select', () => { throw new Error('boom'); });
  b.once('npc:select', p => seen.push(['once', p.id]));
  b.on('*', (p, ev) => seen.push(['*', ev]));
  assert.equal(b.emit('npc:select', { id: '94110-1-0' }), 4);
  b.emit('npc:select', { id: '94110-2-0' });
  offA();
  b.emit('npc:select', { id: '94110-3-0' });
  assert.deepEqual(seen, [['a', '94110-1-0'], ['once', '94110-1-0'], ['*', 'npc:select'], ['a', '94110-2-0'], ['*', 'npc:select'], ['*', 'npc:select']]);
  assert.deepEqual(errors, ['boom', 'boom', 'boom']);
  const fn = () => {};
  b.once('x', fn); b.off('x', fn);
  assert.equal(b.count('x'), 0);
});

test('place statistics come from the pack and add up', () => {
  const zi = world.indexOf('94110');
  const scope = zipScope(world, zi);
  assert.equal(scope.title, 'San Francisco');
  assert.match(scope.subtitle, /94110 · San Francisco County · Bay Area/);
  const s = placeStats(world, scope);
  const z = world.zip(zi);
  assert.equal(s.pop, z.pop); assert.equal(s.hh, z.hh); assert.equal(s.income, z.inc); assert.equal(s.value, z.value);
  const langTotal = s.languages.reduce((a, r) => a + r.share, 0);
  assert.ok(Math.abs(langTotal - 100) < 1e-6, `languages sum to ${langTotal}`);
  assert.equal(s.languages[0].key, 'english');
  assert.ok(s.languages.some(r => r.key === 'spanish' && r.lepShare > 0 && r.lepShare < 100));
  const commute = s.commute.groups.reduce((a, g) => a + g.share, 0);
  assert.ok(Math.abs(commute - 100) < 1e-6, `commute sums to ${commute}`);
  assert.deepEqual(s.commute.groups.map(g => g.key), COMMUTE_GROUPS.map(g => g.key));
  assert.equal(s.commute.workers, world.acs(zi, 'comm').reduce((a, b) => a + b, 0));
  for (let k = 1; k < s.heritage.length; k++) assert.ok(s.heritage[k - 1].count >= s.heritage[k].count);
  assert.ok(s.heritage.some(r => r.label === 'Mexican'));
  assert.ok(!s.heritage.some(r => /other/i.test(r.key.split(':')[1]) && r.family !== 'Race'), 'catch-all groups left out');

  // Glendale's heritage comes out Armenian because the ancestry table says so
  const glendale = placeStats(world, zipScope(world, world.indexOf('91205')));
  assert.equal(glendale.heritage.find(r => r.family === 'Ancestry').label, 'Armenian');
});

test('multi-ZIP scopes sum their ZIPs and weight medians', () => {
  const sf = cityScope(world, 'San Francisco');
  assert.equal(sf.kind, 'city');
  assert.ok(sf.zis.length > 10);
  const s = placeStats(world, sf);
  assert.equal(s.pop, sf.zis.reduce((a, i) => a + world.z.pop[i], 0));
  assert.ok(s.weighted && s.income > 50000 && s.income < 400000);
  const ci = world.counties.find(c => c.name === 'Fresno').index;
  const county = countyScope(world, ci);
  assert.equal(county.title, 'Fresno County');
  assert.deepEqual(scopeFromKey(world, 'county', county.key).zis, county.zis);
  const ba = regionScope(world, 'ba');
  assert.equal(placeStats(world, ba).pop, world.zipsOfRegion('ba').reduce((a, i) => a + world.z.pop[i], 0));
  const bb = scopeBBox(world, zipScope(world, world.indexOf('94110')));
  assert.ok(bb[0] < bb[2] && bb[1] < bb[3]);
  assert.equal(scopeFromKey(world, 'zip', '00000'), null);
});

test('residents are distinct, deterministic and live in the scope', () => {
  const pop = new Population(world);
  const scope = cityScope(world, 'Fresno');
  const a = residentsOf(pop, world, scope, 12, 3), b = residentsOf(pop, world, scope, 12, 3);
  assert.equal(a.length, 12);
  assert.deepEqual(a.map(n => n.id), b.map(n => n.id));
  assert.equal(new Set(a.map(n => n.id)).size, 12);
  for (const n of a) assert.ok(scope.zis.includes(n.zi));
});

test('fidelity tables accept fractions, percents and counts, and nothing when the population reports nothing', () => {
  assert.deepEqual(fidelityTables({ generated: {}, acs: {}, stub: true }), []);
  assert.deepEqual(fidelityTables(null), []);
  const t = fidelityTables({
    acs: { tenure: { own: 0.4, rent: 0.6 }, race: { hispanic: 30, white: 70 }, mode: { drove: 600, wfh: 400 }, hhsize: 2.9 },
    generated: { tenure: { own: 0.45, rent: 0.55 }, race: { hispanic: 28, white: 72 }, mode: { drove: 55, wfh: 45 }, hhsize: 2.8 },
  });
  const by = Object.fromEntries(t.map(x => [x.key, x]));
  assert.equal(by.tenure.rows.find(r => r.key === 'own').acs, 40);
  assert.equal(by.tenure.rows.find(r => r.key === 'own').gen, 45);
  assert.equal(by.tenure.rows.find(r => r.key === 'own').label, 'Owns');
  assert.equal(by.race.rows.find(r => r.key === 'white').gen, 72);
  assert.ok(Math.abs(by.mode.rows.find(r => r.key === 'drove').acs - 60) < 1e-9);
  assert.ok(Math.abs(by.tenure.meanGap - 5) < 1e-9);
  assert.deepEqual([by.hhsize.kind, by.hhsize.acs, by.hhsize.gen], ['value', 2.9, 2.8]);
});

test('settings normalize to valid values and keep the defaults safe', () => {
  assert.deepEqual(normalizeSettings(null), JSON.parse(JSON.stringify(DEFAULT_SETTINGS)));
  assert.equal(DEFAULT_SETTINGS.theme, 'dark');
  assert.equal(DEFAULT_SETTINGS.density, 0.025);
  assert.equal(DEFAULT_SETTINGS.claude.model, 'claude-opus-5-5');
  assert.equal(DEFAULT_SETTINGS.claude.effort, 'low');
  assert.deepEqual(DEFAULT_SETTINGS.network, { claude: false, nws: false, osm: false });
  assert.deepEqual(DENSITIES, [0.005, 0.01, 0.025, 0.05, 0.1]);
  const s = normalizeSettings({ density: 0.3, theme: 'neon', claude: { model: 'gpt', effort: 'max', remember: 'yes', apiKey: 'sk-ant-x' }, network: { claude: 1, nws: true } });
  assert.deepEqual(s, { density: 0.025, theme: 'dark', claude: { model: 'claude-opus-5-5', effort: 'low', remember: false }, network: { claude: false, nws: true, osm: false } });
  assert.equal(normalizeSettings({ claude: { model: 'claude-fable-5-2', effort: 'high' } }).claude.model, 'claude-fable-5-2');
});

test('formatting', () => {
  assert.equal(daysLabel(62), 'Mon–Fri');
  assert.equal(daysLabel(127), 'Every day');
  assert.equal(daysLabel(65), 'Weekends');
  assert.equal(daysLabel(2 | 8 | 32), 'Mon, Wed, Fri');
  assert.equal(daysLabel(4 | 8 | 16 | 32 | 64), 'Tue–Sat');
  assert.equal(fmtPct(41.83), '42%'); assert.equal(fmtPct(4.31), '4.3%'); assert.equal(fmtPct(0.04), '<0.1%');
  assert.equal(fmtMoney(1450400, { compact: true }), '$1.45M'); assert.equal(fmtMoney(158351), '$158,351');
  assert.equal(displayName({ first: 'Ana', last: 'Ruiz' }), 'Ana Ruiz');
  assert.equal(roadLabel({ name: 'I-405', route: 405, kind: 'I' }), 'I-405');
  assert.equal(roadLabel('SR 99'), 'SR 99');
});

// ------------------------------------------------------------------ the services registry

async function servicesModule(t) {
  try { return await import('../src/app/services.mjs'); } catch (e) {
    if (e instanceof ReferenceError && /window|document|HTMLElement|navigator|self/.test(e.message)) { t.skip(`a browser module touches the DOM at import time (${e.message})`); return null; }
    throw e;
  }
}

test('services: modules that are not wired yet answer with a clear result, never an exception', async t => {
  const mod = await servicesModule(t);
  if (!mod) return;
  const svc = mod.createServices({ modules: { persona: null, mind: null, schedule: null, dialogue: null, llm: null, street: null } });
  svc.init(world);
  const npc = svc.residents(zipScope(world, world.indexOf('94110')), 1, 1)[0];
  assert.ok(npc && npc.id);
  assert.equal(svc.npc(npc.id).id, npc.id);
  assert.equal(svc.npc('99999-1-0'), null);
  for (const [name, r] of [['persona', svc.persona(npc.id)], ['mind', svc.mind(npc.id)], ['conversation', svc.conversation(npc.id)], ['voice', svc.voice({})], ['prompt', svc.prompt(npc.id)], ['dayPlan', svc.dayPlan(npc.id, world.snapshotTime)], ['streetView', svc.streetView(null)]]) {
    assert.equal(r.ok, false, name);
    assert.equal(r.reason, 'missing', name);
    assert.match(r.message, /next build/, name);
  }
  assert.deepEqual(svc.status().map(m => m.available), [false, false, false, false, false, false]);
  assert.deepEqual(svc.models().map(m => m.id), ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-fable-5-2']);
  assert.deepEqual(svc.efforts(), ['low', 'medium', 'high']);
  assert.equal(mod.npcIdFrom(world, (world.indexOf('94110') << 20) | (123 << 4) | 2), '94110-123-2');
  assert.equal(mod.npcIdFrom(world, '94110-1-0'), '94110-1-0');
});

test('services: wiring a module lights up its hooks (fake modules with the contract API)', async t => {
  const mod = await servicesModule(t);
  if (!mod) return;
  const calls = [];
  class Mind { constructor(p, { state } = {}) { this.p = p; this.state = state || { mood: { valence: 0.1, arousal: 0.4 }, memory: [] }; } toJSON() { return this.state; } remember(text) { this.state.memory.push({ text }); } }
  class Conversation { constructor(o) { calls.push(['conv', o.persona.id, !!o.mind, typeof o.rngSeed]); } greet() { return { text: 'Hey.', intent: 'greeting' }; } reply(x) { return { text: `You said ${x}` }; } }
  class ClaudeVoice { constructor(o) { this.o = o; calls.push(['voice', o.model, o.effort, o.dangerouslyAllowBrowser]); } async reflect() { return { summary: 'We talked about the fog.' }; } }
  const store = new Map();
  const svc = mod.createServices({
    modules: {
      persona: { persona: (w, npc, { population }) => ({ id: npc.id, npc, big5: { O: 0.5 }, hasPopulation: !!population }) },
      mind: { Mind },
      dialogue: { Conversation },
      llm: { ClaudeVoice, systemBlocks: p => [{ type: 'text', text: 'Rules' }, { type: 'text', text: `You are ${p.id}`, cache_control: { type: 'ephemeral' } }], exportPersona: p => ({ id: p.id }), MODELS: ['claude-opus-5-5', 'claude-haiku-5-5'] },
      schedule: { dayPlan: (npc, p, t) => [{ start: t, kind: 'home' }], activityAt: () => ({ kind: 'home' }) },
      street: { StreetView: class { constructor(c, o) { this.o = o; } } },
    },
    mindStore: { get: id => store.get(id) || null, put: (id, s) => { store.set(id, s); return true; } },
  });
  svc.init(world);
  const id = svc.residents(zipScope(world, world.indexOf('90265')), 1, 2)[0].id;
  const p = svc.persona(id);
  assert.ok(p.ok && p.value.id === id && p.value.hasPopulation);
  assert.equal(svc.persona(id).value, p.value, 'cached');
  const m = svc.mind(id);
  assert.ok(m.ok);
  m.value.remember('Met the player at the pier');
  assert.ok(svc.saveMind(id));
  assert.equal(store.get(id).memory[0].text, 'Met the player at the pier');
  const c = svc.conversation(id, { t: world.snapshotTime });
  assert.ok(c.ok);
  assert.equal(c.value.greet().text, 'Hey.');
  assert.deepEqual(calls.at(-1), ['conv', id, true, 'number']);
  assert.equal(svc.voice({ claude: { apiKey: 'sk-ant-x' }, network: { claude: false } }).reason, 'needs-permission');
  assert.equal(svc.voice({ claude: {}, network: { claude: true } }).reason, 'needs-key');
  const v = svc.voice({ claude: { apiKey: 'sk-ant-x', model: 'claude-haiku-5-5', effort: 'low' }, network: { claude: true } });
  assert.ok(v.ok);
  assert.deepEqual(calls.at(-1), ['voice', 'claude-haiku-5-5', 'low', true]);
  assert.ok(svc.voice({ claude: { proxyURL: '/api/claude' }, network: { claude: true } }).ok, 'a local proxy needs no key');
  const pr = svc.prompt(id);
  assert.ok(pr.ok);
  assert.equal(pr.value.text, `Rules\n\nYou are ${id}`);
  assert.equal(pr.value.blocks[1].cache_control.type, 'ephemeral');
  assert.deepEqual(svc.exportPersona(id).value, { id });
  assert.equal(svc.dayPlan(id, 5).value[0].kind, 'home');
  assert.ok(svc.streetView('canvas', { getTime: () => 1 }).value.o.population);
  assert.deepEqual(svc.models().map(x => x.id), ['claude-opus-5-5', 'claude-haiku-5-5']);
  assert.equal(svc.models()[1].label, 'Claude Haiku 5.5');
  const r = await svc.reflect(id, [{ role: 'user', content: 'Foggy, huh?' }], { claude: { apiKey: 'sk-ant-x' }, network: { claude: true } });
  assert.ok(r.ok);
  assert.equal(store.get(id).memory.at(-1).text, 'We talked about the fog.');
  assert.ok(svc.status().every(x => x.available));
});

test('services: a Claude reflection lands in the mind through its public methods', async t => {
  const mod = await servicesModule(t);
  if (!mod) return;
  const memories = [];
  const rel = { affinity: 0.9, trust: -0.2, familiarity: 0.1, facts: [{ key: 'works at the port', value: 'works at the port', text: 'works at the port' }] };
  const mind = { remember: (text, importance, tags, opts) => memories.push({ text, importance, tags, kind: opts.kind, t: opts.t }), relationship: who => (who === 'player' ? rel : null) };
  mod.applyReflection(mind, { summary: 'We talked about the fog.', facts_about_player: ['works at the port', 'has a dog named Lu'], affinity_delta: 0.3, trust_delta: 0.1, mood: 'content', memorable_line: 'Fog is free air conditioning.', follow_up: 'Ask about Lu.' }, 1000);
  assert.deepEqual(memories.map(m => m.kind), ['conversation', 'dialogue', 'intention']);
  assert.equal(memories[0].text, 'We talked about the fog.');
  assert.ok(memories.every(m => m.t === 1000));
  assert.equal(rel.affinity, 1, 'clamped to 1');
  assert.ok(Math.abs(rel.trust - -0.1) < 1e-12);
  assert.deepEqual(rel.facts.map(f => f.text), ['works at the port', 'has a dog named Lu'], 'a known fact is not added twice');
  assert.doesNotThrow(() => mod.applyReflection({}, { summary: 'x' }, 0), 'a mind without the methods is left alone');
});
