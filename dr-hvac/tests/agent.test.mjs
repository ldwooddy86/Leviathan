/* src/dr/02_dr_llm.js and src/dr/03_dr_agent.js through the real SDK bundle, against a scripted Messages API:
   the request shape, the append only history, tool gating and validation, every stop reason, stop, errors, repair. */
import { makeContext, load, loadSdk, suite, sse, messageEvents } from './lib/load.mjs';
const { ok, eq, done } = suite();

/* ---- a scripted API: each request takes the next script entry; bodies and headers are recorded ---- */
function api(script) {
  const calls = [];
  const fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url; const h = {}; new Headers(init.headers || {}).forEach((v, k) => { h[k] = v; });
    const body = init.body ? JSON.parse(init.body) : null; calls.push({ url, method: init.method, headers: h, body, raw: init.body });
    const step = script.shift(); if (!step) throw new TypeError('fetch failed: the script ran out at request ' + calls.length);
    if (typeof step === 'function') return step(url, init, body);
    if (step.status) return new Response(JSON.stringify({ type: 'error', error: { type: step.errType || 'invalid_request_error', message: step.message || 'bad' } }), { status: step.status, headers: { 'content-type': 'application/json', 'request-id': 'req_err' } });
    return sse(messageEvents(step.blocks, step.opts || {}));
  };
  return { fetch, calls };
}
/* ---- the pieces of the agent the loop needs from the layers above it ---- */
function boot(script, o = {}) {
  const A = api(script); const ran = [];
  const ctx = makeContext({ fetch: A.fetch, globals: o.globals || {} });
  loadSdk(ctx); load(ctx, ['dr/00_dr_core.js', 'dr/02_dr_llm.js', 'dr/03_dr_agent.js']);
  const D = ctx.DRHVAC;
  const T = [
    { name: 'atlas_overview', description: 'Reads the atlas.', risk: 'read', input_schema: { type: 'object', properties: {}, additionalProperties: false }, run: async () => { ran.push('atlas_overview'); await new Promise(r => setTimeout(r, 15)); return { cities: 3 }; }, summary: () => '3 cities' },
    { name: 'atlas_place', description: 'Reads a place.', risk: 'read', input_schema: { type: 'object', required: ['city'], properties: { city: { type: 'string' } }, additionalProperties: false }, run: async i => { ran.push('atlas_place:' + i.city); return { city: i.city }; } },
    { name: 'page_create', description: 'Creates a page in the workshop.', risk: 'local', input_schema: { type: 'object', required: ['slug', 'html'], properties: { slug: { type: 'string', minLength: 1 }, html: { type: 'string' } }, additionalProperties: false }, run: async i => { ran.push('page_create:' + i.slug); return 'created ' + i.slug; } },
    { name: 'page_deploy', description: 'Deploys a page.', risk: i => (i.publish ? 'live' : 'draft'), input_schema: { type: 'object', required: ['slug'], properties: { slug: { type: 'string' }, publish: { type: 'boolean' } }, additionalProperties: false }, confirm: (i, c, risk) => ({ title: (risk === 'live' ? 'Publish ' : 'Send draft ') + i.slug, detail: 'to the site' }), run: async i => { ran.push('page_deploy:' + i.slug + (i.publish ? ':live' : ':draft')); return { ok: true }; } },
    { name: 'fetch_url', description: 'Fetches a URL.', risk: 'read', origins: i => [i.url], input_schema: { type: 'object', required: ['url'], properties: { url: { type: 'string' } }, additionalProperties: false }, run: async i => { ran.push('fetch_url:' + i.url); return 'fetched'; } },
    { name: 'boom', description: 'Fails.', risk: 'read', input_schema: { type: 'object', properties: {} }, run: async () => { const e = new Error('the site said no'); e.hint = 'check the password'; throw e; } },
  ];
  D.tools = { list: () => T, get: n => T.find(t => t.name === n) || null, defs: () => T.map(t => ({ name: t.name, description: t.description, input_schema: t.input_schema })) };
  D.knowledge = { system: () => 'You are Dr. HVAC. ' + 'Build well. '.repeat(40), turnContext: c => 'Date: 2026-11-14\nModule on screen: ' + ((c && c.module) || 'drhvac') };
  const events = []; D.bus.on('agent', e => events.push(e));
  return { ctx, D, A, ran, events };
}
const use = (id, name, input) => ({ type: 'tool_use', id, name, input });
const types = (events, t) => events.filter(e => e.type === t);

/* ============ 1. a plain reply: the request shape ============ */
{
  const { D, A, events } = boot([{ blocks: [{ type: 'thinking', thinking: 'Considering the brief.' }, { type: 'text', text: 'Here is the plan for the Frisco page.' }], opts: { usageStart: { input_tokens: 1200, cache_creation_input_tokens: 900 }, usageEnd: { output_tokens: 300 } } }]);
  await D.saveSettings({ apiKey: 'sk-ant-test' }); await D.agent.load();
  const end = await D.agent.send('Plan a landing page for Frisco', { context: { module: 'forge' } });
  const c = A.calls[0], b = c.body, conv = D.agent.current();
  ok(end === 'end_turn' && D.agent.state() === 'idle', 'a text reply ends the turn and the loop goes idle', end);
  ok(c.url === 'https://api.anthropic.com/v1/messages' && c.method.toUpperCase() === 'POST', 'the Messages endpoint is called', c.url);
  ok(c.headers.authorization === 'Bearer sk-ant-test' && !c.headers['x-api-key'] && c.headers['anthropic-dangerous-direct-browser-access'] === 'true' && c.headers['anthropic-version'] === '2026-10-21', 'the SDK sends the key as a Bearer credential on API version 2026-10-21, with its browser access header', JSON.stringify({ v: c.headers['anthropic-version'] }));
  const betas = (c.headers['anthropic-beta'] || '').split(',').map(s => s.trim());
  ok(['server-side-fallback-2026-07-01', 'thinking-binding-controls-2026-08-01', 'compact-2026-01-12'].every(x => betas.includes(x)), 'the three beta features ride in the anthropic-beta header', c.headers['anthropic-beta']);
  ok(b.model === 'claude-opus-5-5' && b.max_tokens === 64000 && b.stream === true, 'Opus 5.5, 64K output, streamed');
  eq(b.thinking, { type: 'adaptive', display: 'summarized', block_binding: { prefix_mismatch_behavior: 'drop_block' } }, 'adaptive thinking, summarized, mismatched blocks dropped rather than failing');
  eq([b.output_config, b.fallbacks, b.context_management, b.cache_control, b.tool_choice, b.temperature], [{ effort: 'high' }, 'default', { edits: [{ type: 'compact_20260112' }] }, { type: 'ephemeral' }, undefined, undefined], 'explicit effort, default fallbacks, server side compaction, automatic caching; no forced tool choice, no sampling parameters');
  ok(Array.isArray(b.system) && b.system.length === 1 && b.system[0].cache_control.type === 'ephemeral' && b.system[0].text.startsWith('You are Dr. HVAC.'), 'the system prompt is one cached block');
  ok(b.tools.length === 8 && b.tools.slice(0, 6).every(t => t.eager_input_streaming === true && t.input_schema && !t.type) && b.tools[6].type === 'web_search_20260209' && b.tools[7].type === 'web_fetch_20260209' && b.tools[6].eager_input_streaming === undefined, 'six client tools with eager input streaming, then web search and web fetch as server tools');
  const um = b.messages[0];
  ok(b.messages.length === 1 && um.role === 'user' && um.content.length === 2 && /^<dashboard_state>\nDate: 2026-11-14\nModule on screen: forge\n<\/dashboard_state>$/.test(um.content[0].text) && um.content[1].text === 'Plan a landing page for Frisco', 'the user turn carries the state block, then the text');
  ok(conv.messages.length === 2 && conv.messages[1].role === 'assistant' && conv.messages[1].content[0].type === 'thinking' && conv.messages[1].content[0].signature === 'sig_0' && conv.messages[1].content[1].text === 'Here is the plan for the Frisco page.', 'the reply is stored as it came, thinking block and signature included');
  const deltas = types(events, 'stream').map(e => e.ev).filter(e => e.kind === 'text').map(e => e.text).join('');
  ok(deltas === 'Here is the plan for the Frisco page.' && types(events, 'stream').some(e => e.ev.kind === 'thinking' && e.ev.text === 'Considering the brief.') && types(events, 'stream').some(e => e.ev.type === 'block' && e.ev.block.type === 'text'), 'text and thinking stream to the UI as they arrive');
  ok(conv.usage.requests === 1 && conv.usage.input === 1200 && conv.usage.output === 300 && conv.usage.write === 900 && Math.abs(conv.usage.usd - (1200 * 4 + 900 * 4 * 1.25 + 300 * 20) / 1e6) < 1e-12, 'usage and the dollar estimate accumulate', JSON.stringify(conv.usage));
  ok(conv.title === 'Plan a landing page for Frisco' && conv.model === 'claude-opus-5-5' && D.agent.list()[0].id === conv.id && (await D.big.get('conv.' + conv.id)).messages.length === 2, 'the conversation is titled, indexed and saved');
  const tr = D.agent.transcript();
  ok(tr.length === 2 && tr[0].kind === 'user' && tr[0].text === 'Plan a landing page for Frisco' && tr[1].blocks.map(x => x.type).join() === 'thinking,text', 'the transcript shows the user text (not the state block) and the reply');
  /* a reload: the page starts again and reads storage. The first conversation was never chosen from a list, and must still come back. */
  ok(D.settings().current === conv.id, 'the conversation in storage is recorded as the one that is open');
  const again = await D.agent.load();
  ok(again !== conv && again.id === conv.id && again.messages.length === 2 && again.usage.requests === 1 && D.agent.transcript().length === 2, 'after a reload the same conversation is open, with its messages and usage');
  await D.agent.fresh(); const blankId = D.agent.current().id; const back = await D.agent.load();
  ok(back.id === conv.id && blankId !== conv.id && D.settings().current === conv.id, 'a new conversation that was never used does not hide the last real one after a reload');
  await D.agent.remove(conv.id); const none = await D.agent.load(); ok(none.messages.length === 0 && D.agent.list().length === 0, 'with nothing stored a reload starts a blank conversation');
}

/* ============ 2. a tool loop: parallel reads, results in one message, an append only history ============ */
{
  const { D, A, ran, events } = boot([
    { blocks: [{ type: 'thinking', thinking: 'Reading the atlas first.' }, use('t1', 'atlas_overview', {}), use('t2', 'atlas_place', { city: 'Frisco' })] },
    { blocks: [use('t3', 'page_create', { slug: 'lp-frisco', html: '<section>' + 'x'.repeat(300) + '</section>' })] },
    { blocks: [{ type: 'text', text: 'Built /lp-frisco/.' }] },
  ]);
  await D.saveSettings({ apiKey: 'k' }); await D.agent.load();
  const end = await D.agent.send('Build it');
  const conv = D.agent.current();
  ok(end === 'end_turn' && A.calls.length === 3, 'three requests: two tool rounds and the answer');
  eq(ran.slice().sort(), ['atlas_overview', 'atlas_place:Frisco', 'page_create:lp-frisco'], 'each tool ran once');
  eq(conv.messages.map(m => m.role), ['user', 'assistant', 'user', 'assistant', 'user', 'assistant'], 'the history alternates');
  const r1 = conv.messages[2].content;
  ok(r1.length === 2 && r1[0].type === 'tool_result' && r1[0].tool_use_id === 't1' && r1[0].content === '{"cities":3}' && r1[1].tool_use_id === 't2' && !r1[0].is_error, 'both results of a round go back in one user message, in the order asked');
  /* the append only invariant, byte for byte: every request's messages are a prefix of the next request's */
  const prefixOk = [0, 1].every(i => { const a = A.calls[i].body.messages, b = A.calls[i + 1].body.messages; return JSON.stringify(b.slice(0, a.length)) === JSON.stringify(a) && b.length === a.length + 2; });
  ok(prefixOk && JSON.stringify(A.calls[0].body.system) === JSON.stringify(A.calls[2].body.system) && JSON.stringify(A.calls[0].body.tools) === JSON.stringify(A.calls[2].body.tools), 'each request repeats the last one byte for byte and only appends; system and tools never change');
  ok(A.calls[1].body.messages[1].content[0].type === 'thinking' && A.calls[1].body.messages[1].content[0].signature === 'sig_0', 'thinking blocks go back unchanged');
  const starts = types(events, 'tool_start').map(e => e.name), ends = types(events, 'tool_end');
  ok(starts.join() === 'atlas_overview,atlas_place,page_create' && ends.every(e => e.ok) && ends.find(e => e.name === 'atlas_overview').summary === '3 cities' && ends[0].name === 'atlas_place', 'tool start and end events reach the UI with the tool\'s own summary; two reads ran side by side (the quick one finished first)');
  const tr = D.agent.transcript(); const tool = tr[1].blocks.find(b => b.type === 'tool');
  ok(tool.name === 'atlas_overview' && tool.result === '{"cities":3}' && tool.meta.ok === true && tool.meta.ms >= 10, 'the transcript pairs each call with its result and timing');
}

/* ============ 3. validation, unknown tools, failures ============ */
{
  const { D, A, ran } = boot([
    { blocks: [use('a', 'page_create', { slug: '', html: 'x' }), use('b', 'nope', {}), use('c', 'boom', {}), use('d', 'page_create', { slug: 'ok' })] },
    { blocks: [{ type: 'text', text: 'done' }] },
  ]);
  await D.saveSettings({ apiKey: 'k' }); await D.agent.load(); await D.agent.send('go');
  const res = D.agent.current().messages[2].content;
  ok(res.length === 4 && res.every(r => r.is_error) && ran.length === 0, 'four bad calls, four error results, nothing ran');
  const p0 = JSON.parse(res[0].content);
  ok(/slug is shorter than 1/.test(p0.INVALID_INPUT[0]) && p0.received === '{"slug":"","html":"x"}', 'a schema failure returns INVALID_INPUT with what was received', res[0].content);
  ok(/no tool named nope/.test(res[1].content) && res[2].content === 'boom failed: the site said no\nHint: check the password' && /html is required/.test(res[3].content), 'unknown tool, a thrown error with its hint, and a missing field (the shape of a cut off input) each say what happened');
  ok(A.calls.length === 2 && A.calls[1].body.messages[2].content.length === 4, 'the loop continues so the model can correct itself');
}

/* ============ 4. gates: drafts ask, live always asks, a decline changes nothing ============ */
{
  const { D, ran, events } = boot([
    { blocks: [use('d1', 'page_deploy', { slug: 'lp' })] },
    { blocks: [use('d2', 'page_deploy', { slug: 'lp', publish: true })] },
    { blocks: [{ type: 'text', text: 'ok' }] },
  ]);
  await D.saveSettings({ apiKey: 'k' }); await D.agent.load();
  const asks = []; D.bus.on('agent', e => { if (e.type === 'ask') { asks.push(e.ask); setTimeout(() => D.agent.answer(e.id, e.ask.kind === 'draft'), 5); } });
  await D.agent.send('deploy');
  eq(asks.map(a => [a.kind, a.title]), [['draft', 'Send draft lp'], ['live', 'Publish lp']], 'a draft write and a live publish each raise an approval card with the tool\'s own wording');
  eq(ran, ['page_deploy:lp:draft'], 'the approved draft ran; the declined publish did not');
  const res = D.agent.current().messages.filter(m => m.role === 'user' && m.content[0].type === 'tool_result').map(m => m.content[0]);
  ok(!res[0].is_error && res[1].is_error && /declined this action, so nothing was changed/.test(res[1].content), 'the decline goes back to the model as a result, not as silence');
  ok(events.some(e => e.type === 'state' && e.state === 'waiting') && D.agent.state() === 'idle' && D.agent.pending().length === 0, 'the loop waits while a card is open and leaves nothing pending');
  const tm = D.agent.current().toolMeta; ok(tm.d1.risk === 'draft' && tm.d1.approved === true && tm.d2.risk === 'live' && tm.d2.approved === false, 'the risk and the decision are kept with each call');
}
{
  const { D, ran } = boot([{ blocks: [use('d1', 'page_deploy', { slug: 'lp' }), use('d2', 'page_deploy', { slug: 'lp', publish: true })] }, { blocks: [{ type: 'text', text: 'ok' }] }]);
  await D.saveSettings({ apiKey: 'k', autoDrafts: true }); await D.agent.load();
  const asks = []; D.bus.on('agent', e => { if (e.type === 'ask') { asks.push(e.ask.kind); D.agent.answer(e.id, true); } });
  await D.agent.send('deploy');
  eq([asks, ran], [['live'], ['page_deploy:lp:draft', 'page_deploy:lp:live']], 'with drafts allowed in Settings only the live change asks, and writes keep their order');
}

/* ============ 4b. a change to what the person saved in the atlas always asks, whatever drafts are allowed ============ */
{
  const { D, A, ran } = boot([{ blocks: [use('s1', 'brand_set', { tagline: 'Comfort you can count on' })] }, { blocks: [use('s2', 'brand_set', { tagline: 'Again' })] }, { blocks: [{ type: 'text', text: 'done' }] }]);
  D.tools.list().push({ name: 'brand_set', description: 'Changes a brand field.', risk: 'settings', input_schema: { type: 'object', properties: { tagline: { type: 'string' } }, additionalProperties: false }, confirm: i => ({ title: 'Change the brand settings', detail: 'tagline → ' + i.tagline }), run: async i => { ran.push('brand_set:' + i.tagline); return 'changed'; } });
  await D.saveSettings({ apiKey: 'k', autoDrafts: true }); await D.agent.load();
  const cards = []; D.bus.on('agent', e => { if (e.type !== 'ask') return; cards.push([e.ask.kind, e.ask.title, e.ask.detail, e.ask.toolUseId]); D.agent.answer(e.id, cards.length === 1); });
  await D.agent.send('Change the tagline');
  eq(cards, [['settings', 'Change the brand settings', 'tagline → Comfort you can count on', 's1'], ['settings', 'Change the brand settings', 'tagline → Again', 's2']], 'each settings change raises its own card, naming the tool call, even with drafts allowed');
  const tm = D.agent.current().toolMeta; eq([ran, tm.s1.risk, tm.s1.approved, tm.s2.approved], [['brand_set:Comfort you can count on'], 'settings', true, false], 'approved it runs; declined it does not, and the model is told');
  ok(/declined this action/.test(A.calls[2].body.messages[4].content[0].content), 'the refusal reaches the model as the tool result');
}

/* ============ 5. site access inside the browser app: asked once per origin, from a click ============ */
{
  const granted = new Set(); const asked = [];
  const chrome = { runtime: { id: 'ext' }, storage: { local: { _m: {}, async get(k) { return k in this._m ? { [k]: this._m[k] } : {}; }, async set(o) { Object.assign(this._m, o); }, async remove(k) { delete this._m[k]; } } }, permissions: { async contains({ origins }) { return origins.every(o => granted.has(o)); }, async request({ origins }) { asked.push(...origins); origins.forEach(o => granted.add(o)); return true; } } };
  const { D, ran } = boot([{ blocks: [use('f1', 'fetch_url', { url: 'https://www.northside-comfort.test/ac-repair/' })] }, { blocks: [use('f2', 'fetch_url', { url: 'https://www.northside-comfort.test/' }), use('f3', 'fetch_url', { url: 'https://other.test/' })] }, { blocks: [{ type: 'text', text: 'ok' }] }], { globals: { chrome } });
  ok(D.ENV === 'chrome', 'with an extension runtime the environment is the browser app');
  await D.saveSettings({ apiKey: 'k' }); await D.agent.load();
  const cards = []; D.bus.on('agent', async e => { if (e.type !== 'ask') return; cards.push([e.ask.kind, e.ask.origin]); if (e.ask.origin === 'https://other.test') return D.agent.answer(e.id, false); const yes = await D.net.request(e.ask.origins); D.agent.answer(e.id, yes); });
  await D.agent.send('look');
  eq(cards, [['origin', 'https://www.northside-comfort.test'], ['origin', 'https://other.test']], 'a closed origin raises one card; the same site is not asked twice');
  eq([asked, ran], [['https://www.northside-comfort.test/*'], ['fetch_url:https://www.northside-comfort.test/ac-repair/', 'fetch_url:https://www.northside-comfort.test/']], 'the click opens the origin through the permissions API; the refused site is never fetched');
  ok(/did not allow access to https:\/\/other\.test/.test(D.agent.current().messages[4].content[1].content), 'the refusal is reported to the model');
  ok((await chrome.storage.local.get('tda.drhvac.v1'))['tda.drhvac.v1'].apiKey === 'k', 'in the browser app the settings live in extension storage');
}

/* ============ 6. stop reasons ============ */
{
  const { D, A } = boot([{ blocks: [{ type: 'text', text: 'I cannot' }], opts: { stop_reason: 'refusal', stop_details: { type: 'refusal', category: 'cyber' } } }]);
  await D.saveSettings({ apiKey: 'k' }); await D.agent.load(); const end = await D.agent.send('x');
  const c = D.agent.current();
  ok(end === 'refusal' && c.messages.length === 1 && c.events.some(e => e.kind === 'refusal' && /declined this request \(safety category: cyber\)/.test(e.text)), 'a refusal appends nothing and says so with the category');
  ok(A.calls.length === 1 && c.usage.requests === 1, 'a refusal is not retried by the loop (the API\'s fallback already ran)');
}
{
  const { D, ran } = boot([{ blocks: [use('t', 'page_create', { slug: 'half' })], opts: { stop_reason: 'max_tokens' } }]);
  await D.saveSettings({ apiKey: 'k' }); await D.agent.load(); const end = await D.agent.send('x');
  ok(end === 'max_tokens' && ran.length === 0 && D.agent.current().messages.length === 1 && D.agent.current().events.some(e => e.kind === 'error' && /output limit in the middle of a tool call/.test(e.text)), 'a tool call cut off at the output limit is not run and not stored');
}
{
  const { D, A } = boot([{ blocks: [{ type: 'server_tool_use', id: 's1', name: 'web_search', input: { query: 'x' } }], opts: { stop_reason: 'pause_turn' } }, { blocks: [{ type: 'text', text: 'found it' }] }]);
  await D.saveSettings({ apiKey: 'k' }); await D.agent.load(); const end = await D.agent.send('search');
  const m = A.calls[1].body.messages;
  ok(end === 'end_turn' && A.calls.length === 2 && m.length === 2 && m[1].role === 'assistant' && m[1].content[0].type === 'server_tool_use', 'a paused turn is sent back as it is, with no extra user message, and continues');
  ok(D.agent.transcript()[1].blocks[0].type === 'server', 'a server tool call shows in the transcript');
}
{
  const { D } = boot(Array.from({ length: 10 }, (_, i) => ({ blocks: [use('t' + i, 'atlas_overview', {})] })));
  await D.saveSettings({ apiKey: 'k', maxSteps: 4 }); await D.agent.load(); const end = await D.agent.send('loop');
  const c = D.agent.current();
  ok(end === 'limit' && c.usage.requests === 4 && c.messages[c.messages.length - 1].content[0].type === 'tool_result' && c.events.some(e => /Stopped after 4 model requests/.test(e.text)), 'the step limit ends a runaway turn with the history still valid (results appended)');
}

/* ============ 7. a malformed tool input stream is asked for again; an API error is not ============ */
{
  const { D, A, ran } = boot([{ blocks: [{ type: 'tool_use', id: 'j', name: 'page_create', rawJson: '{"slug": "a", "html": }' }] }, { blocks: [use('j2', 'page_create', { slug: 'a', html: 'h' })] }, { blocks: [{ type: 'text', text: 'ok' }] }]);
  await D.saveSettings({ apiKey: 'k' }); await D.agent.load(); const end = await D.agent.send('x');
  ok(end === 'end_turn' && A.calls.length === 3 && ran.join() === 'page_create:a' && JSON.stringify(A.calls[1].body.messages) === JSON.stringify(A.calls[0].body.messages), 'unparseable tool input: the same request is issued again, nothing was stored from the bad turn', `${end} ${A.calls.length}`);
}
{
  const { D, A, events } = boot([{ status: 401, errType: 'authentication_error', message: 'invalid x-api-key' }]);
  await D.saveSettings({ apiKey: 'bad' }); await D.agent.load(); const end = await D.agent.send('x');
  const err = events.find(e => e.type === 'error').error;
  ok(end === 'error' && err.kind === 'auth' && err.status === 401 && /rejected the API key/.test(err.message) && /sk-ant-/.test(err.hint) && A.calls.length === 1, 'a 401 becomes a plain auth error with a hint, and is not retried');
  ok(D.agent.state() === 'idle' && D.agent.current().messages.length === 1 && D.agent.current().events.some(e => e.kind === 'error'), 'after an error the loop is idle and the history is still valid');
}
{
  /* the API refuses the request, and refuses it again without the beta features: the betas were not the cause */
  const { D, A, events } = boot([{ status: 400, message: 'messages.0.content: Input should be a valid list' }, { status: 400, message: 'messages.0.content: Input should be a valid list' }]);
  await D.saveSettings({ apiKey: 'k' }); await D.agent.load(); await D.agent.send('x');
  const err = events.find(e => e.type === 'error').error;
  ok(err.kind === 'bad_request' && /valid list/.test(err.detail) && A.calls.length === 2 && A.calls[0].headers['anthropic-beta'] && !A.calls[1].headers['anthropic-beta'] && D.settings().compat === false, 'a 400 is tried once more without the beta features; refused again, the first refusal is shown and the setting is left as it was', JSON.stringify([A.calls.length, D.settings().compat]));
  ok(/The API said: "messages\.0\.content: Input should be a valid list"\./.test(D.agent.current().events.find(e => e.kind === 'error').text), 'the note quotes the API in its own words');
}
{
  /* the API refuses a beta feature: the same request without the betas goes through, and compatibility mode stays on */
  const { D, A, events } = boot([{ status: 400, message: 'Unexpected value(s) `server-side-fallback-2026-07-01` for the `anthropic-beta` header' }, { blocks: [{ type: 'text', text: 'Here you go.' }] }, { blocks: [{ type: 'text', text: 'And again.' }] }]);
  await D.saveSettings({ apiKey: 'k' }); await D.agent.load(); const end = await D.agent.send('x');
  const b1 = A.calls[1].body, conv = D.agent.current();
  ok(end === 'end_turn' && A.calls.length === 2 && !A.calls[1].headers['anthropic-beta'] && b1.fallbacks === undefined && b1.context_management === undefined && b1.thinking.block_binding === undefined && b1.thinking.type === 'adaptive' && JSON.stringify(b1.messages) === JSON.stringify(A.calls[0].body.messages) && JSON.stringify(b1.tools) === JSON.stringify(A.calls[0].body.tools), 'refused over a beta, the same messages and tools are sent again without the beta features, and the reply arrives');
  ok(D.settings().compat === true && conv.messages.length === 2 && conv.events.some(e => e.kind === 'notice' && /Compatibility mode is now on/.test(e.text) && /server-side-fallback/.test(e.text)) && !events.some(e => e.type === 'error'), 'compatibility mode stays on and the conversation says why; no error is shown');
  await D.agent.send('y'); ok(A.calls.length === 3 && !A.calls[2].headers['anthropic-beta'], 'later requests go without the betas from the start');
}
{
  let n = 0; const { D, A } = boot([() => { n++; return new Response('{"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}', { status: 529, headers: { 'content-type': 'application/json', 'retry-after-ms': '1' } }); }, () => { n++; return new Response('{"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}', { status: 529, headers: { 'content-type': 'application/json', 'retry-after-ms': '1' } }); }, { blocks: [{ type: 'text', text: 'back' }] }]);
  await D.saveSettings({ apiKey: 'k' }); await D.agent.load(); const end = await D.agent.send('x');
  ok(end === 'end_turn' && A.calls.length === 3 && n === 2, 'an overloaded API is retried by the SDK (twice) before the loop ever sees it');
}
{
  const { D, events } = boot([]);
  await D.agent.load(); let threw = null; try { await D.agent.send('x'); } catch (e) { threw = e; }
  ok(threw && threw.kind === 'no_key' && D.agent.current().messages.length === 0 && events.some(e => e.type === 'error'), 'without a key nothing is sent and nothing is stored');
}

/* ============ 8. stop ============ */
{
  const { D, ran } = boot([(url, init) => new Promise((res, rej) => { init.signal.addEventListener('abort', () => { const e = new Error('aborted'); e.name = 'AbortError'; rej(e); }); })]);
  await D.saveSettings({ apiKey: 'k' }); await D.agent.load();
  const p = D.agent.send('long job'); setTimeout(() => D.agent.stop(), 30); const end = await p;
  ok(end === 'stopped' && D.agent.state() === 'idle' && D.agent.current().messages.length === 1 && D.agent.current().events.some(e => e.text === 'Stopped.') && ran.length === 0, 'stop during a reply: idle, nothing half written in the history', end);
}
{
  const { D, ran } = boot([{ blocks: [use('d1', 'page_deploy', { slug: 'lp' }), use('t2', 'page_create', { slug: 'b', html: 'h' })] }]);
  await D.saveSettings({ apiKey: 'k' }); await D.agent.load();
  D.bus.on('agent', e => { if (e.type === 'ask') setTimeout(() => D.agent.stop(), 5); });
  const end = await D.agent.send('x'); const c = D.agent.current(); const res = c.messages[2].content;
  ok(end === 'stopped' && ran.length === 0 && res.length === 2 && res.every(r => r.is_error) && /Stopped by the user|declined/.test(res[0].content + res[1].content), 'stop while a card is open: every pending call gets a result, so the history stays valid', JSON.stringify(res.map(r => r.content.slice(0, 40))));
}

/* ============ 9. compatibility mode and Haiku ============ */
{
  const { D, A } = boot([{ blocks: [{ type: 'text', text: 'ok' }] }]);
  await D.saveSettings({ apiKey: 'k', compat: true, webResearch: false, effort: 'low' }); await D.agent.load(); await D.agent.send('x');
  const c = A.calls[0], b = c.body;
  ok(c.url === 'https://api.anthropic.com/v1/messages' && !c.headers['anthropic-beta'] && b.fallbacks === undefined && b.context_management === undefined && b.betas === undefined, 'compatibility mode: no beta header and no beta fields', c.url);
  eq([b.thinking, b.output_config, b.tools.length], [{ type: 'adaptive', display: 'summarized' }, { effort: 'low' }, 6], 'still adaptive thinking and explicit effort; web research off leaves the six client tools');
}
{
  const { D, A } = boot([{ blocks: [{ type: 'text', text: 'ok' }], opts: { model: 'claude-haiku-5-5' } }]);
  await D.saveSettings({ apiKey: 'k', model: 'claude-haiku-5-5' }); await D.agent.load(); await D.agent.send('x');
  const b = A.calls[0].body, betas = A.calls[0].headers['anthropic-beta'];
  ok(b.model === 'claude-haiku-5-5' && b.fallbacks === undefined && !/server-side-fallback/.test(betas) && /compact-2026-01-12/.test(betas), 'Haiku 5.5 is sent without the refusal fallback it does not have');
}
{
  const { D, A } = boot([{ blocks: [{ type: 'text', text: 'ok' }] }]);
  await D.saveSettings({ apiKey: 'k', baseUrl: 'gateway.example.test/anthropic/' }); await D.agent.load(); await D.agent.send('x');
  ok(A.calls[0].url.startsWith('https://gateway.example.test/anthropic/v1/messages') && A.calls[0].body.tools.slice(0, 6).every(t => t.eager_input_streaming === undefined), 'a custom base URL is used as given, and eager input streaming is left off behind a gateway', A.calls[0].url);
}

/* ============ 10. the second turn of a conversation, and a reload in the middle of a tool ============ */
{
  const { D, A, ctx } = boot([{ blocks: [{ type: 'text', text: 'one' }] }, { blocks: [{ type: 'text', text: 'two' }] }]);
  await D.saveSettings({ apiKey: 'k' }); await D.agent.load(); await D.agent.send('first'); await D.saveSettings({ model: 'claude-fable-5-2', webResearch: false }); await D.agent.send('second');
  const b = A.calls[1].body;
  ok(b.messages.length === 3 && JSON.stringify(b.messages.slice(0, 2)) === JSON.stringify(A.calls[0].body.messages.concat([{ role: 'assistant', content: [{ type: 'text', text: 'one' }] }])) && b.model === 'claude-opus-5-5' && b.tools.length === 8, 'a second turn appends to the same history; the model and tools frozen at the first request hold even after Settings change');
  /* a stored conversation whose last message is an unanswered tool call */
  const id = D.agent.current().id; const stored = await D.big.get('conv.' + id);
  stored.messages.push({ role: 'user', content: [{ type: 'text', text: 'deploy' }] }, { role: 'assistant', content: [use('zz', 'page_deploy', { slug: 'lp' })] }); await D.big.set('conv.' + id, stored);
  const c2 = await D.agent.open(id); const last = c2.messages[c2.messages.length - 1];
  ok(last.role === 'user' && last.content[0].tool_use_id === 'zz' && last.content[0].is_error && /Interrupted/.test(last.content[0].content) && c2.messages.length === stored.messages.length + 1, 'reopening a conversation that stopped mid tool appends an "interrupted, effect unknown" result');
  ok(JSON.stringify(c2.messages.slice(0, stored.messages.length)) === JSON.stringify(stored.messages), 'the repair appends; it never edits what is already there');
  void ctx;
}

/* ============ 11. fallback echo rule ============ */
{
  const { D } = boot([]);
  const content = [{ type: 'thinking', thinking: 'a', signature: 's' }, { type: 'text', text: 'partial' }, { type: 'tool_use', id: 'x', name: 'n', input: {} }, { type: 'server_tool_use', id: 'sv1', name: 'web_search', input: {} }, { type: 'web_search_tool_result', tool_use_id: 'sv1', content: [] }, { type: 'server_tool_use', id: 'sv2', name: 'web_search', input: {} }, { type: 'fallback', from: { model: 'claude-fable-5-2' }, to: { model: 'claude-opus-5-5' } }, { type: 'thinking', thinking: 'b', signature: 't' }, { type: 'text', text: 'rest' }, { type: 'tool_use', id: 'y', name: 'n', input: {} }];
  eq(D.agent.echoable(content).map(b => b.type + (b.id ? ':' + b.id : '')), ['text', 'server_tool_use:sv1', 'web_search_tool_result', 'fallback', 'thinking', 'text', 'tool_use:y'], 'before a fallback marker only text and answered server tools are echoed; the marker and everything after stay');
  const plain = [{ type: 'thinking', thinking: 'a', signature: 's' }, { type: 'text', text: 't' }]; ok(D.agent.echoable(plain) === plain, 'a message with no fallback marker is echoed untouched');
}

/* ============ 12. inside the Claude viewer: the sample capability with page tools ============ */
{
  const seen = {};
  const sample = async (input, opts) => { seen.input = input; seen.opts = opts; const r1 = await opts.tools.find(t => t.name === 'atlas_overview').execute({}, { signal: new AbortController().signal }); let failed = ''; try { await opts.tools.find(t => t.name === 'page_create').execute({ slug: '' }, {}); } catch (e) { failed = e.message; } seen.r1 = r1; seen.failed = failed; opts.onText({ text: 'Built ', delta: 'Built ' }); opts.onText({ text: 'Built it.', delta: 'it.' }); return { text: 'Built it.', truncated: false, modelTierApplied: 'complex' }; };
  sample.limits = async () => ({ maxPromptBytes: 262144, tools: { maxCount: 3 } });
  const { D, A, events, ran } = boot([], { globals: { claude: { use: async n => (n === 'sample' ? sample : null) }, document: {} } });
  ok(D.ENV === 'viewer' && D.transport() === 'viewer', 'inside the viewer the transport is the viewer\'s own Claude');
  await D.agent.load(); const end = await D.agent.send('build a page');
  const c = D.agent.current();
  ok(end === 'end_turn' && A.calls.length === 0 && c.transport === 'viewer' && c.messages[1].content[0].text === 'Built it.', 'the reply comes through sample(), with no API call');
  ok(seen.opts.tools.length === 3 && seen.opts.cache === false && seen.opts.modelTier === 'complex' && seen.opts.tools.every(t => t.description.length <= 1000 && typeof t.execute === 'function'), 'only as many tools as the view allows are offered, uncached, on the complex tier');
  ok(seen.input[0].role === 'user' && seen.input[0].content.startsWith('You are Dr. HVAC.') && /no network/.test(seen.input[0].content) && seen.input[seen.input.length - 1].role === 'user' && seen.input[seen.input.length - 1].content.endsWith('build a page'), 'instructions lead as a user turn and the list ends on the new message');
  ok(seen.r1 === '{"cities":3}' && /INVALID_INPUT/.test(seen.failed) && ran.join() === 'atlas_overview', 'page tools run through the same validation and gates; a failure is thrown back to the model');
  ok(events.filter(e => e.type === 'stream' && e.ev.kind === 'text').map(e => e.ev.text).join('') === 'Built it.' && c.events.filter(e => e.kind === 'tool').map(e => e.text).join() === 'atlas_overview ok,page_create failed', 'text streams to the UI and the actions are kept as notes');
  const sample2calls = []; const s2 = async (input) => { sample2calls.push(input); return { text: 'ok', truncated: true }; }; s2.limits = sample.limits; D.ctxSample = s2;
  void s2;
}
done();
