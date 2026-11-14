/* src/dr/00_dr_core.js: settings, the two stores, the cost arithmetic, the schema check and the network wrapper. */
import { makeContext, load, suite, mockFetch } from './lib/load.mjs';
const { ok, eq, throwsAsync, done } = suite();

const log = [];
const ctx = makeContext({ fetch: mockFetch([
  ['https://site.test/ok', () => ({ status: 200, headers: { 'content-type': 'text/html', Server: 'nginx' }, body: '<title>Hi</title>' })],
  ['https://site.test/missing', () => ({ status: 404, body: 'nope' })],
  ['https://site.test/big', () => ({ status: 200, body: 'x'.repeat(5000) })],
  ['https://site.test/json', () => ({ json: { a: 1 } })],
  ['https://site.test/slow', (u, init) => new Promise((res, rej) => { init.signal.addEventListener('abort', () => { const e = new Error('aborted'); e.name = 'AbortError'; rej(e); }); })],
], log) });
load(ctx, ['dr/00_dr_core.js']);
const D = ctx.DRHVAC;

/* ---- environment and settings ---- */
ok(D.ENV === 'node' && D.transport() === 'none' && D.canNetwork(), 'outside a browser the environment is the harness, with no transport until a key is set');
await D.ready();
eq([D.settings().model, D.settings().effort, D.settings().autoDrafts, D.settings().compat], ['claude-opus-5-5', 'high', false, false], 'defaults: Opus 5.5, high effort, drafts ask, beta features on');
await D.saveSettings({ apiKey: 'sk-test', model: 'not-a-model', effort: 'ludicrous', maxSteps: 9999 });
eq([D.settings().model, D.settings().effort, D.settings().maxSteps, D.transport()], ['claude-opus-5-5', 'high', 120, 'api'], 'a bad model, effort or step count falls back or is clamped; a key turns the transport on');
ok(JSON.parse(ctx.localStorage.getItem('tda.drhvac.v1')).apiKey === 'sk-test', 'settings persist under tda.drhvac.v1');
ok(D.MODELS.length === 4 && D.MODELS.every(m => /^claude-(opus|fable|sonnet|haiku)-5-[25]$/.test(m.id)) && D.MODELS[0].id === 'claude-opus-5-5', 'four current models, Opus 5.5 first', D.MODELS.map(m => m.id).join(','));

/* ---- cost ---- */
const c = D.costOf('claude-opus-5-5', { input_tokens: 1e6, output_tokens: 1e6 });
ok(Math.abs(c - 24) < 1e-9, 'a million tokens in and out on Opus 5.5 is $24', c);
const c2 = D.costOf('claude-opus-5-5', { input_tokens: 0, cache_read_input_tokens: 1e6, cache_creation_input_tokens: 1e6, output_tokens: 0 });
ok(Math.abs(c2 - (4 * 0.05 + 4 * 1.25)) < 1e-9, 'cache reads bill at 0.05 of input and writes at 1.25', c2);

/* ---- stores ---- */
await D.kv.set('k1', { a: [1, 2] }); eq(await D.kv.get('k1'), { a: [1, 2] }, 'kv round trip');
await D.kv.del('k1'); eq(await D.kv.get('k1', 'gone'), 'gone', 'kv delete returns the default');
await D.big.set('conv.x', { messages: [{ role: 'user', content: 'hi' }] }); eq((await D.big.get('conv.x')).messages[0].content, 'hi', 'big store round trip (memory here: no extension storage, no IndexedDB)');
await D.big.del('conv.x'); eq(await D.big.get('conv.x', null), null, 'big store delete');
ok(/memory/.test(D.big.where()), 'the big store says where it keeps things', D.big.where());

/* ---- helpers ---- */
eq([D.hostOf('example.com/x'), D.originOf('http://a.test:8080/p?q'), D.bareDomain('https://www.Example.com/')], ['example.com', 'http://a.test:8080', 'example.com'], 'host, origin and bare domain, with or without a scheme');
ok(D.clip('abcdefghij', 4, 'the page').startsWith('abcd\n[cut here: 6 more characters of the page'), 'clip says what it left out');
ok(D.fitResult({ a: 'x'.repeat(100) }, 50).includes('cut here') && D.fitResult(null) === 'done' && D.fitResult('s') === 's', 'fitResult clips long JSON and names an empty result');
eq(D.slugify('  AC Repair — Frisco, TX!  '), 'ac-repair-frisco-tx', 'slugify');

/* ---- schema check ---- */
const S = { type: 'object', additionalProperties: false, required: ['slug', 'mode'], properties: { slug: { type: 'string', minLength: 1, maxLength: 10 }, mode: { type: 'string', enum: ['a', 'b'] }, n: { type: 'integer', minimum: 1, maximum: 5 }, tags: { type: 'array', maxItems: 2, items: { type: 'string' } }, o: { type: ['object', 'null'] } } };
eq(D.validate(S, { slug: 'x', mode: 'a', n: 3, tags: ['t'], o: null }), [], 'a fitting input has no findings');
const e = D.validate(S, { slug: '', mode: 'c', n: 9, tags: ['a', 2, 'c'], extra: 1 });
ok(e.some(x => /slug is shorter/.test(x)) && e.some(x => /mode should be one of "a", "b"/.test(x)) && e.some(x => /n is above 5/.test(x)) && e.some(x => /tags takes at most 2/.test(x)) && e.some(x => /tags\[1\] should be string, got integer/.test(x)) && e.some(x => /extra is not a field/.test(x)), 'each kind of misfit is named', e.join(' | '));
ok(D.validate(S, { mode: 'a' }).some(x => /input.slug is required/.test(x)), 'a missing required field (the shape of a cut off input) is caught');
ok(D.validate({ type: 'object' }, 'str')[0] === 'input should be object, got string' && D.validate({ type: 'number' }, 3).length === 0, 'the wrong top level type is named; an integer is a number');

/* ---- network ---- */
let r = await D.net.get('site.test/ok');
eq([r.status, r.ok, r.headers.server, r.text, r.cut], [200, true, 'nginx', '<title>Hi</title>', false], 'get resolves status, lower cased headers and text; a bare host gets https');
r = await D.net.get('https://site.test/missing'); eq([r.status, r.ok, r.text], [404, false, 'nope'], 'a 404 is a finding, not an exception');
r = await D.net.get('https://site.test/big', { maxBytes: 100 }); ok(r.cut && r.text.length === 100, 'a large body is cut at maxBytes and says so');
r = await D.net.json('https://site.test/json'); eq(r.json, { a: 1 }, 'json parses');
ok(await throwsAsync(() => D.net.json('https://site.test/ok'), /not with JSON/), 'json rejects a non JSON answer');
ok(await throwsAsync(() => D.net.get('https://nowhere.test/'), /Could not reach nowhere\.test/), 'an unreachable host rejects with its name');
ok(await throwsAsync(() => D.net.get('https://site.test/slow', { timeout: 40 }), /No answer from site\.test/), 'a timeout rejects with a plain reason');
const ac = new AbortController(); setTimeout(() => ac.abort(), 20);
ok(await throwsAsync(() => D.net.get('https://site.test/slow', { signal: ac.signal, timeout: 5000 }), /Stopped/), 'the caller\'s stop signal ends a request');
ok(await throwsAsync(() => D.net.get('::::'), /Not a URL/), 'a non URL is refused before any request');
ok(await D.net.granted('https://site.test/') === true, 'with no permission API (file, tests) an origin counts as open');
ok(log.every(l => l.method === 'GET'), 'only GETs went out');

/* ---- the viewer blocks the network ---- */
const v = makeContext({ globals: { claude: { use: async () => null } , document: {} } }); load(v, ['dr/00_dr_core.js']);
ok(v.DRHVAC.ENV === 'viewer' && v.DRHVAC.transport() === 'viewer' && !v.DRHVAC.canNetwork(), 'inside the viewer the transport is the viewer and the network is off');
ok(await throwsAsync(() => v.DRHVAC.net.get('https://site.test/ok'), /viewer blocks every outbound call/), 'net.get refuses inside the viewer with the reason');
ok(await v.DRHVAC.net.granted('https://site.test/') === false, 'no origin is open inside the viewer');
done();
