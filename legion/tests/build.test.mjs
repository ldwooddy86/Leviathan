// Legion · tests for the app module: the single-file build (tools/build.mjs, its --check), and the app's
// engine-facing code: the bus, the Census statistics and the Census-versus-generated tables behind the Place panel,
// search and its scopes, settings and the Legion server's Claude proxy, the Talk tab's starters, and the services
// registry in both states (modules missing, and modules wired). The page itself is exercised end to end by
// tests/e2e/run.mjs.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { build, check, bundle, inlineScripts, scriptSafe, jsString, externalResourceProblems, importProblems, OUT_FILE, PATHS, parseBuildArgs } from '../tools/build.mjs';
import { loadDefaultWorld } from '../src/engine/world.mjs';
import { Population } from '../src/engine/population.mjs';
import { createBus } from '../src/app/bus.mjs';
import {
  zipScope, cityScope, placeScope, countyScope, regionScope, scopeFromKey, scopeFromSearch, scopeBBox, placeStats, residentsOf,
  fidelityTables, fidelityValueText, COMMUTE_GROUPS,
} from '../src/app/census.mjs';
import { normalizeSettings, serverFromHealth, claudeStatus, Settings, DEFAULT_SETTINGS, DENSITIES, DEFAULT_PROXY_PATH } from '../src/app/settings.mjs';
import { daysLabel, fmtPct, fmtMoney, displayName, roadLabel, humanize, incomeBracketLabel, commuteTimeLabel, vehiclesLabel } from '../src/app/format.mjs';
import { searchItems, normalizeQuery, fold, editDistance, MORE_DIGITS } from '../src/app/search.mjs';
import { startersFor, fireName, byteSize, lineMeta, builtText } from '../src/app/npc-panel.mjs';
import { memberRelation, householdRelations, withArticle } from '../src/app/format.mjs';
import { plainWhy } from '../src/app/provenance.mjs';
import { neighborhoodScope } from '../src/app/census.mjs';

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
  assert.equal(by.tenure.rows.find(r => r.key === 'own').label, 'Owners');
  assert.equal(by.race.rows.find(r => r.key === 'white').gen, 72);
  assert.ok(Math.abs(by.mode.rows.find(r => r.key === 'drove').acs - 60) < 1e-9);
  assert.ok(Math.abs(by.tenure.meanGap - 5) < 1e-9);
  assert.deepEqual([by.hhsize.kind, by.hhsize.acs, by.hhsize.gen], ['value', 2.9, 2.8]);
  assert.equal(by.mode.rows.find(r => r.key === 'drove').label, 'Drove alone', 'an alias dimension uses its view');
  assert.ok(by.tenure.featured && by.mode.featured);
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

test('services: modules that are not wired answer with a clear result, never an exception', async t => {
  const mod = await servicesModule(t);
  if (!mod) return;
  const svc = mod.createServices({ modules: { persona: null, mind: null, schedule: null, dialogue: null, llm: null, street: null, weather: null } });
  svc.init(world);
  const npc = svc.residents(zipScope(world, world.indexOf('94110')), 1, 1)[0];
  assert.ok(npc && npc.id);
  assert.equal(svc.npc(npc.id).id, npc.id);
  assert.equal(svc.npc('99999-1-0'), null);
  for (const [name, r] of [['persona', svc.persona(npc.id)], ['mind', svc.mind(npc.id)], ['conversation', svc.conversation(npc.id)], ['voice', svc.voice({})], ['prompt', svc.prompt(npc.id)], ['dayPlan', svc.dayPlan(npc.id, world.snapshotTime)], ['streetView', svc.streetView(null)]]) {
    assert.equal(r.ok, false, name);
    assert.equal(r.reason, 'missing', name);
    assert.match(r.message, /is not loaded in this page/, name);
  }
  assert.deepEqual(svc.status().map(m => [m.key, m.available]), [['persona', false], ['mind', false], ['schedule', false], ['dialogue', false], ['llm', false], ['street', false], ['weather', false]]);
  // without the live layer the weather is the pack's snapshot, and says so
  assert.equal(svc.weather(world.indexOf('94110'), world.snapshotTime).live, undefined);
  assert.equal(svc.weatherStatus(world.indexOf('94110')).state, 'off');
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
  assert.ok(svc.status().filter(x => x.key !== 'weather').every(x => x.available), 'the six engine modules are wired');
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

// ------------------------------------------------------------------ review fixes: the Place panel's fidelity tables

test('fidelity: every table pop.validate reports reads in words, ordinal tables in order, six featured', () => {
  const pop = new Population(world);
  const raw = pop.validate(world.indexOf('94110'), 600);
  const tables = fidelityTables(raw);
  const shares = tables.filter(t => t.kind === 'shares');
  const by = Object.fromEntries(shares.map(t => [t.key, t]));
  // every Census block validate returns becomes a table (heritage has no Census side)
  for (const dim of Object.keys(raw.acs)) assert.ok(by[dim], `${dim} is drawn`);
  // headings and rows are words, never the population's keys
  const rawKey = /^(?:[mf]\d|[mf]<|[mf]_|own\d|rent\d|<\d|\d+-\d+k?$|\d+k\+$|[a-z]+_lep$)|\b(?:Hisp|Lep|OccM|OccF|Vet|Nilf|Southam|Puertorican|Otherasian)\b|\d \d/;
  for (const t of shares) {
    assert.doesNotMatch(t.label, rawKey, `heading ${t.label}`);
    assert.ok(t.note && t.note.length > 8, `${t.key} says what its shares are of`);
    for (const r of t.rows) assert.doesNotMatch(r.label, rawKey, `${t.key} row ${r.label}`);
  }
  assert.equal(by.hisp.label, 'Hispanic origin');
  assert.equal(by.asian.label, 'Asian group');
  assert.equal(by.occM.label, 'Occupation, men');
  assert.equal(by.occF.label, 'Occupation, women');
  assert.equal(by.lep.label, 'Limited English');
  assert.ok(by.hisp.rows.some(r => r.label === 'Salvadoran'));
  assert.ok(by.emp.rows.some(r => r.label === 'Not in the labor force'));
  assert.ok(by.lep.rows.some(r => r.label === 'Spanish'));
  // ordinal tables keep their own order and show every row
  assert.deepEqual(by.age.rows.map(r => r.label), ['Under 18', '18–24', '25–34', '35–44', '45–54', '55–64', '65–74', '75 and over']);
  assert.deepEqual(by.hinc.rows.map(r => r.label), ['Under $25k', '$25k–50k', '$50k–75k', '$75k–100k', '$100k–150k', '$150k–200k', '$200k or more']);
  assert.equal(by.ctime.rows[0].label, 'Under 5 min');
  assert.ok(by.ctime.rows.some(r => r.label === '30–34 min'));
  assert.equal(by.ctime.rows.at(-1).label, '90 min or more');
  assert.deepEqual(by.veh.rows.slice(0, 3).map(r => r.label), ['Owners · no vehicle', 'Owners · 1 vehicle', 'Owners · 2 vehicles']);
  assert.equal(by.veh.rows.at(-1).label, 'Renters · 5 or more vehicles');
  assert.equal(by.edu.rows[0].label, 'No high school diploma');
  assert.ok(!by.sch.rows.some(r => r.key === 'none'), 'not enrolled is the remainder, not a row');
  assert.ok(by.vet.rows.every(r => /^Ages /.test(r.label)));
  // grouped rows still add up: age bands are the whole age table
  const ageSum = by.age.rows.reduce((a, r) => a + r.acs, 0);
  assert.ok(Math.abs(ageSum - 100) < 1e-6, `age sums to ${ageSum}`);
  // marital status merges the sexes into six statuses
  assert.equal(new Set(by.mar.rows.map(r => r.label)).size, by.mar.rows.length);
  assert.ok(by.mar.rows.length <= 6);
  // the featured six lead, in the panel's order; the rest fold away
  assert.deepEqual(shares.filter(t => t.featured).map(t => t.key), ['hht', 'tenure', 'race', 'lang', 'comm', 'edu']);
  assert.ok(shares.findIndex(t => !t.featured) > shares.findLastIndex(t => t.featured));
  // the scalar pairs become key figures; shares print as percents
  const values = Object.fromEntries(tables.filter(t => t.kind === 'value').map(t => [t.key, t]));
  assert.deepEqual(Object.keys(values), ['hhsize', 'medianAge', 'under18', 'over65', 'foreign', 'own']);
  assert.equal(values.own.label, 'Owners');
  assert.ok(Math.abs(values.own.acs - world.z.own_sh[world.indexOf('94110')]) < 0.01, 'owner share in percent');
  assert.equal(fidelityValueText(values.hhsize.acs, values.hhsize.format), String(raw.scalars.hhsize.acs));
  assert.match(fidelityValueText(values.foreign.gen, 'share'), /^\d+(\.\d)?%$/);
  assert.equal(fidelityValueText(39.21, 'years'), '39.2');
});

test('humanize keeps number ranges; bracket keys read as words', () => {
  assert.equal(humanize('150-200k'), '150–200k');
  assert.equal(humanize('small-apartment'), 'Small apartment');
  assert.equal(humanize('some_college'), 'Some college');
  assert.equal(humanize('g1-4'), 'G1–4');
  assert.equal(incomeBracketLabel('<10k'), 'Under $10k');
  assert.equal(incomeBracketLabel('150-200k'), '$150k–200k');
  assert.equal(incomeBracketLabel('200k+'), '$200k or more');
  assert.equal(commuteTimeLabel('30-34'), '30–34 min');
  assert.equal(commuteTimeLabel('<5'), 'Under 5 min');
  assert.equal(vehiclesLabel('own2'), 'Owners · 2 vehicles');
  assert.equal(vehiclesLabel('rent0'), 'Renters · no vehicle');
  assert.equal(vehiclesLabel('own5+'), 'Owners · 5 or more vehicles');
});

test('services.validate reports the households actually compared, and caches', async t => {
  const mod = await servicesModule(t);
  if (!mod) return;
  // the real population: Bodega (94922) has 3 households, so 3 are compared, not the 600 asked for
  const svc = mod.createServices();
  svc.init(world);
  const zi = world.indexOf('94922');
  const r = svc.validate(zi, 600);
  assert.ok(r, 'tables for Bodega');
  assert.equal(r.households, world.z.hh[zi]);
  assert.ok(r.households < 600);
  assert.ok(r.persons >= r.households);
  assert.equal(svc.validate(zi, 600), r, 'cached');
  // a population that reports no count: the smaller of the sample and the ZIP's households
  let calls = 0;
  class FakePopulation extends Population { validate() { calls++; return { generated: { tenure: { own: 0.4, rent: 0.6 } }, acs: { tenure: { own: 0.5, rent: 0.5 } } }; } }
  const fake = mod.createServices({ PopulationClass: FakePopulation });
  fake.init(world);
  assert.equal(fake.validate(zi, 600).households, Math.min(600, world.z.hh[zi]));
  const big = world.indexOf('94110');
  assert.equal(fake.validate(big, 600).households, 600);
  assert.equal(calls, 2);
  assert.equal(fake.validate(big, 600).gq, null);
});

// ------------------------------------------------------------------ review fixes: search and scopes

test('search: each scope once, counties by name, places open their own ZIPs', () => {
  const pop = new Population(world);
  const items = q => searchItems(world, pop, q);
  const scopeOf = it => scopeFromSearch(world, it);
  for (const q of ['Sacramento', 'Los Angeles', 'San', 'Oakland', 'Orange', 'Bay', 'Santa']) {
    const list = items(q);
    const ids = list.map(it => scopeOf(it).zis.join(','));
    assert.equal(new Set(ids).size, ids.length, `${q}: every row opens a different set of ZIPs`);
    assert.equal(new Set(list.map(it => `${it.kind}:${it.label}`)).size, list.length, `${q}: no duplicate rows`);
  }
  // a trailing "County" finds the county (case-insensitive)
  for (const name of ['Los Angeles', 'Sacramento', 'Alameda']) {
    for (const q of [`${name} County`, `${name.toLowerCase()} county`]) {
      const list = items(q);
      assert.equal(list[0] && list[0].kind, 'county', q);
      assert.equal(scopeOf(list[0]).title, `${name} County`);
    }
  }
  // a city name offers its city first, then its county
  const sac = items('Sacramento');
  assert.deepEqual(sac.slice(0, 3).map(it => [it.kind, it.label]), [['place', 'Sacramento'], ['city', 'Sacramento'], ['county', 'Sacramento County']]);
  assert.equal(sac[0].tag, 'City');
  assert.equal(sac[1].tag, 'Postal city');
  const sacPlace = scopeOf(sac[0]), sacPostal = scopeOf(sac[1]);
  assert.ok(sacPlace.zis.every(i => world.z.place[i] === 'Sacramento'));
  assert.ok(sacPostal.zis.every(i => world.z.city[i] === 'Sacramento'));
  assert.notEqual(sacPlace.zis.length, sacPostal.zis.length);
  // a match on the Census place opens the place, never the postal city of the ZIP that matched
  const oakland = items('Oakland');
  assert.ok(!oakland.some(it => it.label === 'Emeryville' || it.label === 'Berkeley'), oakland.map(it => it.label).join(', '));
  assert.ok(scopeOf(oakland[0]).zis.every(i => world.z.place[i] === 'Oakland'));
  const eastLA = items('East Los');
  assert.equal(eastLA[0].label, 'East Los Angeles');
  assert.equal(eastLA[0].tag, 'Community');
  assert.deepEqual(scopeOf(eastLA[0]).zis.map(i => world.zips[i]).sort(), ['90022', '90063']);
  // a short prefix reaches the biggest cities and keeps a county on the list
  const san = items('San').map(it => it.label);
  for (const city of ['San Diego', 'San Jose', 'San Francisco']) assert.ok(san.includes(city), `${city} in ${san.join(', ')}`);
  assert.ok(items('San').some(it => it.kind === 'county'));
  // a one-ZIP postal city keeps the name it was found by
  const emery = items('Emeryville')[0];
  const s = scopeOf(emery);
  assert.deepEqual([s.kind, s.key, s.title], ['zip', '94608', 'Emeryville']);
  assert.equal(zipScope(world, world.indexOf('94608')).title, world.z.place[world.indexOf('94608')]);
  // ZIP prefixes and NPC ids still work
  assert.equal(items('94110')[0].kind, 'zip');
  const npc = pop.sample(world.indexOf('94110'), 1, 1)[0];
  assert.deepEqual(items(npc.id).map(it => [it.kind, it.id]), [['npc', npc.id]]);
  assert.deepEqual(items('zzzz'), []);
  assert.deepEqual(normalizeQuery('  San Diego,  CA '), { q: 'san diego', county: false });
  assert.deepEqual(normalizeQuery('Orange County'), { q: 'orange', county: true });
});

test('scopes: Census places, postal cities and deep links', () => {
  const la = placeScope(world, 'los angeles');
  assert.equal(la.kind, 'place');
  assert.equal(la.title, 'Los Angeles');
  assert.equal(la.eyebrow, 'City');
  assert.ok(la.zis.length > cityScope(world, 'Los Angeles').zis.length, 'the city of LA has more ZIPs than mail to "Los Angeles"');
  assert.equal(cityScope(world, 'Los Angeles').eyebrow, 'Postal city');
  assert.deepEqual(scopeFromKey(world, 'place', 'Oakland').zis, placeScope(world, 'Oakland').zis);
  assert.equal(placeScope(world, 'Nowhere Special'), null);
  assert.equal(scopeFromSearch(world, { kind: 'city', index: world.indexOf('94110') }).title, 'San Francisco', 'a city item by ZIP index still works');
});

// ------------------------------------------------------------------ review fixes: the Legion server's Claude proxy

test('the Legion server: its advertised proxy is used only when it holds a key', () => {
  assert.equal(DEFAULT_PROXY_PATH, '/api/anthropic');
  const health = { ok: true, service: 'legion', keyConfigured: true, proxy: '/api/anthropic', models: [] };
  assert.deepEqual(serverFromHealth(health), { keyConfigured: true, proxy: '/api/anthropic', hint: '' });
  assert.equal(serverFromHealth({ ...health, proxy: '/proxy/claude/' }).proxy, '/proxy/claude', 'the path the server names');
  assert.equal(serverFromHealth({ ...health, proxy: 'https://elsewhere.example/v1' }).proxy, '/api/anthropic', 'never another origin');
  assert.equal(serverFromHealth({ ...health, proxy: '//elsewhere.example' }).proxy, '/api/anthropic');
  assert.equal(serverFromHealth({ ...health, proxy: undefined }).proxy, '/api/anthropic');
  assert.equal(serverFromHealth({ ...health, keyConfigured: false }).keyConfigured, false);
  assert.equal(serverFromHealth({ ok: true }), null, 'not a Legion server');
  assert.equal(serverFromHealth(null), null);

  const events = [];
  const settings = new Settings({ bus: { emit: (ev, p) => events.push(p.changed) } });
  settings.setServer(serverFromHealth(health));
  assert.equal(settings.proxyURL, '/api/anthropic');
  assert.equal(settings.get().claude.proxyURL, '/api/anthropic');
  settings.setServer(serverFromHealth({ ...health, keyConfigured: false }));
  assert.equal(settings.proxyURL, '', 'a server without a key leaves Claude to the player’s own key');
  assert.equal(settings.server.keyConfigured, false);
  settings.setServer(null);
  assert.equal(settings.server, null);
  assert.deepEqual(events, [['claude.server', 'claude.proxyURL'], ['claude.server', 'claude.proxyURL'], ['claude.server']]);

  const s = { network: { claude: true }, claude: { apiKey: '', proxyURL: '' } };
  assert.match(claudeStatus(s, { bridge: true, server: { keyConfigured: false } }), /server has no Anthropic key\. Add your own key/);
  assert.match(claudeStatus({ ...s, claude: { apiKey: 'sk-ant-x', proxyURL: '' } }, { bridge: true, server: { keyConfigured: false } }), /use yours/);
  assert.match(claudeStatus({ ...s, claude: { apiKey: '', proxyURL: '/api/anthropic' } }, { bridge: true, server: { keyConfigured: true } }), /proxy/);
  assert.match(claudeStatus(s, { bridge: false }), /Claude bridge is not loaded in this page/);
  assert.match(claudeStatus({ ...s, network: { claude: false } }, { bridge: true }), /off until you allow/);
});

// ------------------------------------------------------------------ review fixes: Talk

test('conversation starters are grounded in the pack: a fire only where one burned', () => {
  const pop = new Population(world);
  const mission = pop.sample(world.indexOf('94110'), 1, 1)[0];
  assert.equal(world.firesOf(mission.zi).length, 0);
  const plain = startersFor(world, mission, { weather: null });
  assert.ok(!plain.some(s => /fire/i.test(s)), plain.join(' | '));
  assert.ok(plain.includes('How long have you lived here?'));
  assert.ok(plain.includes('How’s the weather treating you?'));
  // an adult of Paradise is asked about the Camp Fire (2018); a child born after it is not
  const paradise = pop.sample(world.indexOf('95969'), 40, 1).find(n => n.age >= 18);
  assert.ok(startersFor(world, paradise).includes('What was the Camp Fire like?'));
  assert.ok(!startersFor(world, { ...paradise, age: 6, birthYear: 2020, occupation: null, status: 'child', school: 'elementary' }).some(s => /Camp Fire/.test(s)));
  // an NWS alert active there, and the NPC's own highway
  const alerted = startersFor(world, mission, { weather: { alerts: [{ event: 'High Surf Warning' }] } });
  assert.ok(alerted.includes('Heard about the High Surf Warning?'));
  const driver = { ...mission, occupation: { key: 'sales' }, commute: { mode: 'drive', road: { name: 'I-80', route: 80, kind: 'I' } } };
  assert.ok(startersFor(world, driver).includes('How’s traffic on I-80?'));
  assert.ok(startersFor(world, { ...mission, occupation: null, school: null, status: 'retired' }).includes('What keeps you busy these days?'));
  assert.ok(!startersFor(world, { ...mission, occupation: null, status: 'child', school: 'elementary' }).includes('What do you do for work?'));
  // babies and small children are not asked about traffic, restaurants or the news (ux-1022)
  const baby = startersFor(world, { ...mission, age: 0, birthYear: 2026, occupation: null, status: 'child', school: null, commute: {} });
  assert.ok(baby.length >= 3 && !baby.some(s => /traffic|eat|Heard about|work/i.test(s)), baby.join(' | '));
  const kid = startersFor(world, { ...mission, age: 8, birthYear: 2018, occupation: null, status: 'child', school: 'elementary', commute: {} }, { weather: { alerts: [{ event: 'High Surf Warning' }] } });
  assert.ok(!kid.some(s => /traffic|Where should I eat/i.test(s)) && kid.includes('How’s school going?'), kid.join(' | '));
  assert.equal(fireName('Camp'), 'the Camp Fire');
  // CAL FIRE unit codes in capitals, as the dialogue says them; a name that is only a code or a number is no name
  assert.equal(fireName('Btu Lightning Complex'), 'the BTU Lightning Complex');
  assert.equal(fireName('Scu Lightning Complex'), 'the SCU Lightning Complex');
  assert.equal(fireName('Unnamed'), null);
  assert.equal(fireName('241 Incident'), null);
  assert.equal(fireName('58 Complex'), 'the 58 Complex');
  const scu = pop.sample(world.indexOf('94603'), 1, 1)[0];
  assert.ok(startersFor(world, scu).some(q => /the [A-Z]{3} Lightning Complex|the \w+ Fire/.test(q)), startersFor(world, scu).join(' | '));
  assert.ok(!startersFor(world, scu).some(q => /\b(Scu|Btu|Czu|Lnu)\b/.test(q)), startersFor(world, scu).join(' | '));
});

test('services: a conversation without a time runs on the simulation epoch, not the wall clock', async t => {
  const mod = await servicesModule(t);
  if (!mod) return;
  const seeds = [];
  class Conversation { constructor(o) { seeds.push([o.rngSeed, o.t]); } }
  const svc = mod.createServices({ modules: { persona: { persona: (w, npc) => ({ id: npc.id, npc }) }, dialogue: { Conversation } } });
  svc.init(world);
  const id = svc.residents(zipScope(world, world.indexOf('94110')), 1, 1)[0].id;
  assert.ok(svc.conversation(id).ok);
  assert.ok(svc.conversation(id, { t: world.snapshotTime }).ok);
  assert.deepEqual(seeds[0], seeds[1]);
  assert.equal(seeds[0][1], world.snapshotTime);
  // a reflection without a time stamps the memory with the simulation epoch too
  const stamps = [];
  class Mind { constructor() { this.state = {}; } remember(text, importance, tags, o) { stamps.push(o.t); } toJSON() { return this.state; } }
  class ClaudeVoice { async reflect() { return { summary: 'We talked.' }; } }
  svc.wire({ mind: { Mind }, llm: { ClaudeVoice } });
  const r = await svc.reflect(id, [], { claude: { apiKey: 'sk-ant-x' }, network: { claude: true } });
  assert.ok(r.ok);
  assert.deepEqual(stamps, [world.snapshotTime]);
  assert.throws(() => svc.wire({ nonsense: {} }), /unknown module/);
  assert.equal(svc.wire({ llm: null }).find(m => m.key === 'llm').available, false);
});

test('the JSON tab counts bytes as a file holds them', () => {
  assert.equal(byteSize('abc'), '3 bytes');
  assert.equal(byteSize('Peña'), '5 bytes', 'ñ is two bytes in UTF-8');
  assert.equal(byteSize('x'.repeat(300 * 1024)), '300 KB');
});

// ------------------------------------------------------------------ review fixes: --check

test('--check finds imports in the worker and anything the page would load from outside', async () => {
  // the pieces on crafted inputs
  assert.deepEqual(externalResourceProblems('<link rel="icon" href="data:image/svg+xml,x"><a href="https://example.com">x</a><div style="background:url(#g)"></div>'), []);
  assert.equal(externalResourceProblems('<img src="https://example.com/x.png">').length, 1);
  assert.deepEqual(externalResourceProblems("<img srcset='a.png 1x, data:image/png;base64,AA 2x'>"), ['<img srcset="a.png"> loads a resource from outside the page']);
  assert.equal(externalResourceProblems("<img srcset='data:image/png;base64,AA, data:image/png;base64,BB 2x'>").length, 0);
  assert.equal(externalResourceProblems('<style>@import url("https://fonts.googleapis.com/css2?family=Barlow");</style>').length, 1);
  assert.equal(externalResourceProblems('<style>.a{background:url(https://example.com/bg.png)}</style>').length, 1);
  assert.equal(externalResourceProblems('<div style="background-image:url(\'//cdn.example.com/x.png\')"></div>').length, 1);
  assert.deepEqual(externalResourceProblems('<script>const u = "https://api.anthropic.com"; const i = "<img src=https://x>";</script>'), [], 'script bodies are code');
  assert.match((await importProblems('import("./w.js")', 'the worker source', { worker: true })).join(), /still imports \.\/w\.js \(dynamic-import\)/);
  assert.match((await importProblems('importScripts("x.js")', 'the worker source', { worker: true })).join(), /importScripts/);
  assert.deepEqual(await importProblems('const s = "import(\\"./x.js\\")"; self.onmessage = () => {};', 'w', { worker: true }), [], 'strings do not count');

  // and the whole check on crafted copies of the real page
  if (!fs.existsSync(OUT_FILE)) await build({ quiet: true });
  const html = fs.readFileSync(OUT_FILE, 'utf8');
  const dir = scratch();
  try {
    const variants = {
      worker: html.replace('window.__LEGION_WORKER_SRC__="', 'window.__LEGION_WORKER_SRC__="import(\\"./w.js\\");'),
      font: html.replace('<style>', '<style>@import url("https://fonts.googleapis.com/css2?family=Barlow");'),
      image: html.replace('<body>', '<body><img src="https://example.com/x.png" alt="">'),
    };
    const expected = { worker: /the worker source still imports/, font: /@imports https:\/\/fonts/, image: /<img src="https:\/\/example\.com\/x\.png">/ };
    for (const [name, page] of Object.entries(variants)) {
      assert.notEqual(page, html, `${name} variant was made`);
      const file = path.join(dir, `${name}.html`);
      fs.writeFileSync(file, page);
      const r = await check(file);
      assert.equal(r.ok, false, name);
      assert.match(r.problems.join('\n'), expected[name], name);
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('services: through the Legion server’s proxy the player’s key never reaches the voice', async t => {
  const mod = await servicesModule(t);
  if (!mod) return;
  const made = [];
  class ClaudeVoice { constructor(o) { made.push({ apiKey: o.apiKey, proxyURL: o.proxyURL }); } }
  const svc = mod.createServices({ modules: { llm: { ClaudeVoice } } });
  svc.init(world);
  assert.ok(svc.voice({ claude: { apiKey: 'sk-ant-player', proxyURL: '/api/anthropic', model: 'claude-opus-5-5', effort: 'low' }, network: { claude: true } }).ok);
  assert.deepEqual(made.at(-1), { apiKey: undefined, proxyURL: '/api/anthropic' });
  assert.ok(svc.voice({ claude: { apiKey: 'sk-ant-player', proxyURL: '', model: 'claude-opus-5-5', effort: 'low' }, network: { claude: true } }).ok);
  assert.deepEqual(made.at(-1), { apiKey: 'sk-ant-player', proxyURL: undefined }, 'without a proxy the player’s key is used');
});

// ------------------------------------------------------------------ final review fixes

test('search: accents, St./Mt., everyday short names and misspellings find their place (ux-1004)', () => {
  const pop = new Population(world);
  const first = q => searchItems(world, pop, q)[0] || {};
  assert.equal(first('San José').label, 'San Jose');
  assert.equal(first('La Canada').label, 'La Cañada Flintridge');
  assert.equal(first('Mt Shasta').label, 'Mount Shasta');
  assert.equal(first('St. Helena').label, 'Saint Helena');
  assert.equal(first('SF').label, 'San Francisco');
  assert.equal(first('LA').label, 'Los Angeles');
  assert.equal(first('East LA').label, 'East Los Angeles');
  for (const [typo, name] of [['San Fransisco', 'San Francisco'], ['Oaklnd', 'Oakland'], ['Los Angelos', 'Los Angeles'], ['Frenso', 'Fresno']]) {
    const r = first(typo);
    assert.equal(r.label, name, typo);
    assert.equal(r.fuzzy, true, `${typo} is offered as a suggestion`);
  }
  assert.deepEqual(searchItems(world, pop, '94'), [], 'two digits narrow nothing down');
  assert.match(MORE_DIGITS, /at least 3 digits/);
  assert.equal(fold('  The  Saint-Helena '), 'saint-helena');
  assert.equal(fold('Piñon Hills'), 'pinon hills');
  assert.equal(editDistance('frenso', 'fresno'), 1, 'a swap of two letters is one edit');
  assert.equal(editDistance('abc', 'xyzw', 2), 3, 'stops past the limit');
});

test('search: the neighborhoods of the big cities are names too, and open their ZIPs (exp-68)', () => {
  const pop = new Population(world);
  const mission = world.indexOf('94110'), boyle = world.indexOf('90033');
  // the foundation's world.neighborhoods(), or a stand-in with its shape where the pack has none yet
  const own = typeof world.neighborhoods === 'function' ? world.neighborhoods() : [];
  const w = own && own.some(n => n.key === 'mission') ? world : Object.create(world, { neighborhoods: { value: () => [
    { name: 'the Mission', key: 'mission', zis: [mission], city: 'San Francisco', primary: true },
    { name: 'Boyle Heights', key: 'boyle heights', zis: [boyle], city: 'Los Angeles', primary: true },
  ] } });
  const hood = q => searchItems(w, pop, q).find(it => it.kind === 'neighborhood');
  const m = hood('the Mission');
  assert.ok(m, 'the Mission is found');
  assert.equal(searchItems(w, pop, 'Mission')[0].kind, 'neighborhood', 'the exact neighborhood before Mission Viejo');
  const s = scopeFromSearch(w, m);
  assert.ok(s.zis.includes(mission));
  assert.match(s.title, /^The Mission$|Mission/);
  assert.ok(hood('Boyle'), 'Boyle Heights by its start');
  const deep = neighborhoodScope(w, 'boyle heights');
  assert.ok(deep && deep.zis.includes(boyle));
  assert.ok(scopeFromKey(w, 'neighborhood', 'the Mission'));
  // deep links: a county by name as well as by FIPS
  assert.equal(scopeFromKey(world, 'county', 'Alameda').title, 'Alameda County');
  assert.equal(scopeFromKey(world, 'county', 'Alameda County').key, '06001');
  assert.equal(scopeFromKey(world, 'county', 'Atlantis'), null);
});

test('the NPC panel: relatives as the NPC sees them, mood in words, no column codes, the ACS top code (eng-53, ux-1023, ux-1013, exp-65)', () => {
  // Jon (the householder's son) sees the householder's sister as his aunt and the other child as his brother
  const members = [{ m: 0, role: 'householder', sex: 'M', age: 57 }, { m: 1, role: 'sibling', sex: 'F', age: 59 }, { m: 2, role: 'child', sex: 'M', age: 21 }, { m: 3, role: 'child', sex: 'M', age: 22 }];
  const jon = { m: 2, role: 'child', parents: [0], household: { members } };
  assert.deepEqual(householdRelations(jon).map(r => r.relation), ['father', 'aunt', 'brother']);
  assert.equal(memberRelation({ role: 'householder', m: 0 }, members[2], members), 'son');
  assert.equal(withArticle('unit in a small building'), 'a unit in a small building');
  assert.equal(withArticle('apartment'), 'an apartment');
  assert.equal(withArticle('house'), 'a house');
  assert.equal(lineMeta({ emotion: 'content' }, 'offline'), 'offline engine · feeling content');
  assert.equal(lineMeta({ emotion: 'neutral' }, 'offline'), 'offline engine');
  assert.equal(plainWhy('2.8 km from the coast (coast_km)'), '2.8 km from the coast');
  assert.equal(plainWhy('Cal fan base (team home 37.87, -122.26)'), 'Cal fan base');
  assert.equal(plainWhy('Santa Ana winds (off_kind di) and gusts (g58).'), 'Santa Ana winds and gusts.');
  assert.equal(plainWhy('homes here run about $1,450,400 (value) against their household income (householdIncome)'), 'homes here run about $1,450,400 against their household income');
  assert.equal(plainWhy('a rent that doubled (about 40%)'), 'a rent that doubled (about 40%)', 'words in parentheses stay');
  const top = { yb_med: 1938, ybBefore1940: true }, later = { yb_med: 1962 };
  assert.equal(builtText(1938, top), 'built before 1940');
  assert.equal(builtText(1925, top), 'built 1925');
  assert.equal(builtText(1938, later), 'built 1938');
});

test('tools/build.mjs: --out needs a file name; the next option is never taken for one (eng-57)', () => {
  assert.match(parseBuildArgs(['--out', '--check']).error, /--out/);
  assert.match(parseBuildArgs(['--nope']).error, /nope/);
  const ok = parseBuildArgs(['--out', 'x.html', '--check']);
  assert.equal(path.basename(ok.out), 'x.html');
  assert.equal(ok.check, true);
  assert.equal(parseBuildArgs([]).out, OUT_FILE);
});
