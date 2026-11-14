/* ==== src/dr/03_dr_agent.js ==== */
/* ==== dr_agent ==== */
"use strict";
/* ============================ Dr. HVAC: the agent loop ============================
   A conversation is a list of API messages that only ever grows. One user turn runs like this:
     the user message (a short state block, any images, the text) is appended; the model is asked (streamed);
     its message is appended exactly as it came back, thinking blocks included; every tool it asked for is checked,
     gated and run here in the page; all the results go back in one user message; repeat until it stops asking.
   Why append only: on the current models a thinking block is valid only in the conversation that produced it, so an
   edited history fails the next request (or silently loses the reasoning). The system prompt and the tools array are
   therefore frozen into the conversation at its first request; what changes from turn to turn (the date, the module on
   screen, the brand) travels in the state block of each user message; a reminder is appended, never rewritten.
   Gates, by a tool's risk (20_dr_tools.js declares it, sometimes from its input):
     read    looks at the atlas or a public page                    runs
     local   changes something in this browser (a workshop page, the Site Forge plan)   runs
     draft   writes to a site as a draft, or saves a template        asks, unless Settings allows drafts
     live    changes what visitors see (publish, edit a live page, restore)   always asks
   and before any tool reaches a site the browser app has not been opened to, the user is asked to open it: Chrome only
   shows its permission prompt from a click, so the approval card's button makes the request.
   Stop reasons: refusal (nothing is appended, the reason is shown), pause_turn (the turn is sent back to continue),
   max_tokens with a tool call (the input may be cut off, so nothing runs), and a step limit per user turn.
   Inside the Claude viewer the same tools run through the viewer's own Claude (the sample capability): fewer rounds,
   no network, and the platform keeps the loop; see runViewer. */
DRHVAC.agent = (() => {
  const D = DRHVAC; const bus = D.bus;
  const IDX = 'tda.drhvac.convs';
  let INDEX = [];                 /* [{id, title, updated, model, turns}] newest first */
  let CONV = null;                /* the open conversation */
  let STATE = 'idle';             /* idle | running | waiting */
  let ctl = null;                 /* AbortController of the running turn */
  const PENDING = new Map();      /* approval id → {resolve, ask} */
  let sessionDrafts = false;      /* "allow drafts until I close this page" */
  const emit = (type, d) => bus.emit('agent', Object.assign({ type }, d || {}));
  const setState = s => { if (STATE !== s) { STATE = s; emit('state', { state: s }); } };

  /* ---------- conversations ---------- */
  function blank() { return { v: 1, id: D.uid('c'), title: '', created: D.nowIso(), updated: D.nowIso(), transport: '', model: '', system: '', tools: null, messages: [], ui: {}, events: [], toolMeta: {}, usage: { requests: 0, input: 0, output: 0, read: 0, write: 0, usd: 0 } }; }
  async function persist() {
    if (!CONV) return; CONV.updated = D.nowIso(); await D.big.set('conv.' + CONV.id, CONV);
    const row = { id: CONV.id, title: CONV.title || 'New conversation', updated: CONV.updated, model: CONV.model, turns: Object.keys(CONV.ui).length };
    INDEX = [row].concat(INDEX.filter(x => x.id !== CONV.id)).slice(0, 60); await D.kv.set(IDX, INDEX);
    /* a conversation that now exists in storage is the one to come back to after a reload */
    if (D.settings().current !== CONV.id) await D.saveSettings({ current: CONV.id });
  }
  /* a page closed while tools ran leaves an assistant message whose tool calls have no results; the API would refuse the
     next request, so the missing results are appended (never inserted) saying what is known: nothing */
  function repair(c) {
    const last = c.messages[c.messages.length - 1]; if (!last || last.role !== 'assistant' || !Array.isArray(last.content)) return false;
    const open = last.content.filter(b => b.type === 'tool_use'); if (!open.length) return false;
    c.messages.push({ role: 'user', content: open.map(b => ({ type: 'tool_result', tool_use_id: b.id, is_error: true, content: 'Interrupted: the page was closed or reloaded before this tool finished. Its effect is unknown. Check the current state before repeating it.' })) });
    c.events.push({ at: c.messages.length, kind: 'notice', text: 'The last session ended while a tool was running. Its result is unknown.' }); return true;
  }
  async function load() {
    await D.ready(); INDEX = (await D.kv.get(IDX, [])) || []; if (!Array.isArray(INDEX)) INDEX = [];
    /* the conversation that was open; failing that (it was never saved, or it was deleted) the most recent one */
    const ids = [D.settings().current].concat(INDEX.map(x => x.id)).filter((x, i, a) => x && a.indexOf(x) === i); let c = null;
    for (const id of ids) { c = await D.big.get('conv.' + id, null); if (c && Array.isArray(c.messages)) break; c = null; }
    if (c) { CONV = c; if (D.settings().current !== c.id) await D.saveSettings({ current: c.id }); if (repair(CONV)) await persist(); } else CONV = blank();
    emit('opened', { id: CONV.id }); return CONV;
  }
  async function open(id) { if (STATE !== 'idle') stop(); const c = await D.big.get('conv.' + id, null); if (!c) return null; CONV = c; if (repair(CONV)) await persist(); await D.saveSettings({ current: id }); emit('opened', { id }); return CONV; }
  async function fresh() { if (STATE !== 'idle') stop(); CONV = blank(); await D.saveSettings({ current: CONV.id }); emit('opened', { id: CONV.id }); return CONV; }
  async function remove(id) { await D.big.del('conv.' + id); INDEX = INDEX.filter(x => x.id !== id); await D.kv.set(IDX, INDEX); if (CONV && CONV.id === id) await fresh(); emit('index'); }
  const current = () => CONV; const list = () => INDEX.slice(); const state = () => STATE;

  /* ---------- approvals ---------- */
  function ask(a) { return new Promise(resolve => { const id = D.uid('a'); PENDING.set(id, { resolve, ask: a }); setState('waiting'); emit('ask', { id, ask: a }); }); }
  /* the UI answers an approval card. For kind "origin" its click handler has already called DRHVAC.net.request (the browser's own prompt) and passes the outcome. */
  function answer(id, yes, o) { const p = PENDING.get(id); if (!p) return; PENDING.delete(id); if (o && o.sessionDrafts) sessionDrafts = true; const val = p.ask && p.ask.kind === 'question' ? (yes || null) : !!yes; emit('answered', { id, yes: !!yes, value: val }); if (!PENDING.size && STATE === 'waiting') setState('running'); p.resolve(val); }
  const pending = () => [...PENDING.entries()].map(([id, p]) => ({ id, ask: p.ask }));
  function denyAll() { for (const [id, p] of PENDING) { PENDING.delete(id); emit('answered', { id, yes: false }); p.resolve(p.ask && p.ask.kind === 'question' ? null : false); } }

  /* ---------- one tool call ---------- */
  const declined = text => ({ is_error: true, content: text }); const ORIGIN_ASKS = new Map();
  async function gate(tool, input, ctx) {
    if (typeof tool.origins === 'function') {
      let urls = []; try { urls = (await tool.origins(input, ctx)) || []; } catch (e) { urls = []; }
      const closed = [];
      for (const u of urls) {
        const o = D.originOf(u); if (!o || closed.includes(o)) continue;
        if (D.ENV === 'viewer') return declined('The Claude viewer blocks every outbound call, so this tool cannot run here. It works in the browser app or a downloaded copy of the atlas.');
        if (!(await D.net.granted(o))) closed.push(o);
      }
      if (closed.length) {
        /* one card and one browser prompt for everything this call needs; two calls that need the same sites share the card */
        const key = closed.join(' '); let wait = ORIGIN_ASKS.get(key);
        if (!wait) { const hosts = [...new Set(closed.map(D.hostOf))]; const names = hosts.length > 2 ? hosts.slice(0, -1).join(', ') + ' and ' + hosts[hosts.length - 1] : hosts.join(' and '); wait = ask({ kind: 'origin', origin: closed[0], origins: closed, tool: tool.name, toolUseId: ctx.toolUseId, title: `Let Dr. HVAC reach ${names}?`, detail: `The ${tool.name} tool needs to read or write ${closed.join(', ')}. The browser asks once, and remembers the answer for these addresses.` }).finally(() => ORIGIN_ASKS.delete(key)); ORIGIN_ASKS.set(key, wait); }
        const yes = await wait;
        if (!yes) return declined(`The user did not allow access to ${closed.join(', ')}. Do not retry this; say what you needed it for and ask how to proceed.`);
      }
    }
    let risk = 'read'; try { risk = typeof tool.risk === 'function' ? await tool.risk(input, ctx) : (tool.risk || 'read'); } catch (e) { risk = 'live'; }
    ctx.risk = risk;
    /* live: visitors would see it. settings: it changes what the person has saved in the atlas itself (the brand, the Site Forge), which every module reads. Both always ask. draft asks unless drafts were allowed. */
    const mustAsk = risk === 'live' || risk === 'settings' || (risk === 'draft' && !(D.settings().autoDrafts || sessionDrafts));
    if (mustAsk) {
      let c = null; try { c = tool.confirm ? await tool.confirm(input, ctx, risk) : null; } catch (e) { c = null; }
      c = c || { title: tool.name, detail: D.clip(JSON.stringify(input), 500, 'the input') };
      const yes = await ask(Object.assign({ kind: risk, tool: tool.name, toolUseId: ctx.toolUseId }, c));
      if (!yes) return declined('The user declined this action, so nothing was changed. Do not retry it. Ask what they would like instead.');
    }
    return null;
  }
  async function runTool(tu, signal) {
    const t0 = Date.now(); const tools = D.tools; const tool = tools ? tools.get(tu.name) : null;
    const meta = CONV.toolMeta[tu.id] = { name: tu.name, at: D.nowIso() };
    const finish = (res, extra) => { Object.assign(meta, { ms: Date.now() - t0, ok: !res.is_error }, extra || {}); emit('tool_end', { id: tu.id, name: tu.name, ok: !res.is_error, ms: meta.ms, summary: meta.summary || '', risk: meta.risk || 'read' }); return Object.assign({ type: 'tool_result', tool_use_id: tu.id }, res); };
    emit('tool_start', { id: tu.id, name: tu.name, input: tu.input });
    if (!tool) return finish(declined(`There is no tool named ${tu.name} in this build of the atlas.`), { summary: 'unknown tool' });
    /* the input streamed without server side validation: check it against the schema before anything runs */
    const errs = D.validate(tool.input_schema, tu.input);
    if (errs.length) return finish({ is_error: true, content: JSON.stringify({ INVALID_INPUT: errs, received: D.clip(JSON.stringify(tu.input), 1500, 'the input') }) }, { summary: 'invalid input: ' + errs[0] });
    const ctx = { conv: CONV, signal, toolUseId: tu.id, risk: 'read', ask: a => ask(Object.assign({ toolUseId: tu.id }, a)), progress: text => emit('tool_progress', { id: tu.id, text }) };
    try {
      const no = await gate(tool, tu.input, ctx); meta.risk = ctx.risk;
      if (signal && signal.aborted) return finish(declined('Stopped by the user before this ran.'), { summary: 'stopped' });
      if (no) return finish(no, { summary: 'not run', approved: false });
      if (ctx.risk === 'draft' || ctx.risk === 'live' || ctx.risk === 'settings') meta.approved = true;
      const out = await tool.run(tu.input, ctx);
      try { meta.summary = tool.summary ? String(tool.summary(tu.input, out) || '') : ''; } catch (e) { meta.summary = ''; }
      return finish({ content: D.fitResult(out, tool.max) });
    } catch (e) {
      if (signal && signal.aborted) return finish(declined('Stopped by the user while this ran. It may or may not have completed; check before repeating.'), { summary: 'stopped' });
      /* a tool that says no in its own words (nothing connected, a site that refused, a bad reference) is an answer for the model, not a fault; anything else is a defect worth a trace */
      if (!e || !/^(ToolError|NetError|WpError|CmsError)$/.test(e.name || '')) console.error('drhvac tool ' + tu.name, e);
      return finish({ is_error: true, content: `${tu.name} failed: ${(e && e.message) || e}${e && e.hint ? '\nHint: ' + e.hint : ''}` }, { summary: 'failed: ' + ((e && e.message) || e) });
    }
  }
  /* a batch runs side by side only when every call is a plain read; anything that writes keeps the order the model gave */
  async function runTools(uses, signal) {
    const tools = D.tools; const allRead = uses.every(u => { const t = tools && tools.get(u.name); return t && (t.risk || 'read') === 'read' && typeof t.risk !== 'function'; });
    if (allRead) return Promise.all(uses.map(u => runTool(u, signal)));
    const out = []; for (const u of uses) out.push(await runTool(u, signal)); return out;
  }

  /* ---------- what goes back to the API from a message that came through a refusal fallback ----------
     When a model declined part way and another took over, the blocks before the last fallback marker that only the first
     model could own (thinking, tool calls, an unanswered server tool call) are left out; text, answered server tools, the
     marker itself and everything after it are kept in place. */
  function echoable(content) {
    let cut = -1; content.forEach((b, i) => { if (b && b.type === 'fallback') cut = i; }); if (cut < 0) return content;
    const answered = new Set(content.filter(b => b && /_tool_result$/.test(b.type || '') && b.tool_use_id).map(b => b.tool_use_id));
    return content.filter((b, i) => { if (i >= cut) return true; if (!b) return false; if (b.type === 'text') return true; if (b.type === 'server_tool_use') return answered.has(b.id); return /_tool_result$/.test(b.type || ''); });
  }

  /* ---------- the user message ---------- */
  function userMessage(text, o) {
    o = o || {}; const blocks = [];
    let stateBlock = ''; try { stateBlock = D.knowledge && D.knowledge.turnContext ? D.knowledge.turnContext(o.context) : ''; } catch (e) { stateBlock = ''; }
    if (stateBlock) blocks.push({ type: 'text', text: `<dashboard_state>\n${stateBlock}\n</dashboard_state>` });
    (o.images || []).forEach(im => blocks.push({ type: 'image', source: { type: 'base64', media_type: im.mime, data: im.data } }));
    const files = (o.files || []).map(f => `- file id ${f.id}: "${f.name}" (${f.kind || f.mime || 'file'}, ${D.fmtBytes(f.size || 0)})`).join('\n');
    blocks.push({ type: 'text', text: (files ? `<attached_files>\n${files}\nRead them with the file_read tool, or load an Elementor export with elementor_load.\n</attached_files>\n\n` : '') + text });
    return { role: 'user', content: blocks };
  }

  /* ---------- a turn through the API ---------- */
  async function runApi(signal) {
    const S = D.settings(); let steps = 0, jsonRetries = 0, pauses = 0;
    for (;;) {
      if (signal.aborted) return 'stopped';
      if (++steps > S.maxSteps) { note('notice', `Stopped after ${S.maxSteps} model requests in one turn. Say "continue" to go on, or raise the limit in Settings.`); return 'limit'; }
      emit('stream_start', {});
      let msg;
      try { msg = await D.llm.stream(CONV, { signal, on: ev => { if (ev.type === 'compat') { note('notice', 'The API refused a beta feature this build sends' + (ev.detail ? ' ("' + D.clip(String(ev.detail), 160, '') + '")' : '') + ', so the request was sent again without the beta features and Compatibility mode is now on in Settings.'); return; } emit('stream', { ev }); } }); jsonRetries = 0; }
      catch (e) {
        emit('stream_end', { discarded: true });
        if (e && e.jsonError && !signal.aborted && jsonRetries++ < 2) { note('notice', 'A tool input arrived malformed; asking again.'); steps--; continue; }
        if (e && e.jsonError) throw new D.llm.LlmError('The model kept sending a tool input that could not be read.', { kind: 'bad_tool_input', hint: 'Ask for the work in smaller pieces.' });
        throw e;
      }
      D.llm.addUsage(CONV, msg); emit('usage', { usage: CONV.usage });
      if (msg.model && CONV.model && msg.model !== CONV.model && !CONV.servedBy) { CONV.servedBy = msg.model; }
      if (msg.stop_reason === 'refusal') {
        emit('stream_end', { discarded: true }); const d = msg.stop_details || {};
        note('refusal', `Claude declined this request${d.category ? ` (safety category: ${d.category})` : ''}. Nothing was changed. Rephrase the request, or pick another model in Settings.`); return 'refusal';
      }
      const content = echoable(Array.isArray(msg.content) ? msg.content : []);
      const uses = content.filter(b => b.type === 'tool_use');
      if (msg.stop_reason === 'max_tokens' && uses.length) {
        emit('stream_end', { discarded: true });
        note('error', 'The reply hit the output limit in the middle of a tool call, so nothing was run (a cut off input can look complete). Ask for the work in smaller pieces, for example one page at a time.'); return 'max_tokens';
      }
      CONV.messages.push({ role: 'assistant', content }); emit('stream_end', {}); emit('assistant', { index: CONV.messages.length - 1 });
      if (msg.stop_reason === 'pause_turn') { if (++pauses > 6) { note('notice', 'The model paused several times in a row; stopping here.'); await persist(); return 'paused'; } await persist(); continue; }
      if (msg.stop_reason === 'max_tokens') note('notice', 'The reply was cut off at the output limit. Say "continue" for the rest.');
      if (!uses.length) { await persist(); return msg.stop_reason || 'end_turn'; }
      await persist();                               /* the calls are on record before anything runs */
      const results = await runTools(uses, signal);
      CONV.messages.push({ role: 'user', content: results }); emit('results', { index: CONV.messages.length - 1 });
      await persist();
      if (signal.aborted) return 'stopped';
    }
  }

  /* ---------- a turn through the viewer's Claude (the artifact sample capability) ----------
     The platform runs the rounds and calls execute() for each tool; only the final text comes back. The page keeps the
     conversation and re-sends it as plain turns, with one line per action so the model remembers what it did. */
  const VIEWER_RULES = () => `${CONV.system}\n\nYou are running inside the Claude viewer: there is no network, so the tools that reach a website, WordPress or DNS are not offered here. You have a handful of tool rounds per reply; plan them, and finish each reply with what you did and what is left.`;
  function viewerTurns() {
    const out = [{ role: 'user', content: VIEWER_RULES() }];
    CONV.messages.forEach((m, i) => {
      const txt = (Array.isArray(m.content) ? m.content : []).filter(b => b.type === 'text').map(b => b.text).join('\n\n').trim();
      const acts = CONV.events.filter(e => e.kind === 'tool' && e.at === i).map(e => e.text);
      const body = (txt + (acts.length ? `\n\n[Actions taken in this reply: ${acts.join('; ')}]` : '')).trim();
      if (body) out.push({ role: m.role, content: body });
    });
    return out;
  }
  async function runViewer(signal) {
    const sample = await globalThis.claude.use('sample');
    if (!sample) throw new D.llm.LlmError('This view of the atlas was not published with access to Claude.', { kind: 'viewer_unavailable', hint: 'Open the atlas as the browser app or a downloaded file and add an Anthropic API key in Settings, or republish the artifact with the sample capability.' });
    let lim = null; try { lim = await sample.limits(); } catch (e) { lim = null; }
    const maxTools = lim && lim.tools ? lim.tools.maxCount : 0;
    const offered = (D.tools ? D.tools.list() : []).filter(t => t.viewer !== false).slice(0, maxTools);
    const acts = []; let n = 0; const at = CONV.messages.length;
    const tools = offered.map(t => ({ name: t.name, description: String(t.description || '').slice(0, 1000), inputSchema: t.input_schema, execute: async (input, c) => { const id = 'v' + (++n) + '_' + D.uid(''); const r = await runTool({ id, name: t.name, input: input || {} }, c && c.signal ? c.signal : signal); acts.push(`${t.name} ${r.is_error ? 'failed' : 'ok'}`); if (r.is_error) throw new Error(String(r.content)); return D.fitResult(r.content, 30000); } }));
    emit('stream_start', {}); emit('stream', { ev: { type: 'block', index: 0, block: { type: 'text', text: '' } } });
    let res;
    try { res = await sample(viewerTurns(), Object.assign({ cache: false, signal, modelTier: 'complex', onText: ({ delta }) => emit('stream', { ev: { type: 'delta', index: 0, kind: 'text', text: delta } }) }, tools.length ? { tools } : {})); }
    catch (e) {
      emit('stream_end', { discarded: true }); const code = e && e.code;
      if (code === 'cancelled') return 'stopped';
      const M = { not_granted: 'Claude was not allowed for this artifact in this view.', sampling_disabled: 'Claude is not available for this account here.', rate_limited: 'The viewer\'s Claude usage limit was reached; try again later.', refused: 'Claude declined this request. Nothing was changed.', prompt_too_large: 'The conversation is too long for the viewer; start a new conversation.', session_expired: 'Sign in to Claude again.', tools_unavailable: 'This view cannot run tools.' };
      throw new D.llm.LlmError(M[code] || 'The viewer could not reach Claude.', { kind: 'viewer_' + (code || 'error'), detail: (e && e.message) || '' });
    }
    acts.forEach(a => CONV.events.push({ at, kind: 'tool', text: a }));
    CONV.messages.push({ role: 'assistant', content: [{ type: 'text', text: res.text }] }); emit('stream_end', {}); emit('assistant', { index: CONV.messages.length - 1 });
    if (res.truncated) note('notice', 'The reply was cut short by the viewer\'s limits. Ask for less at a time.');
    await persist(); return 'end_turn';
  }

  /* ---------- send ---------- */
  function note(kind, text) { CONV.events.push({ at: CONV.messages.length, kind, text }); emit('note', { kind, text }); }
  async function send(text, o) {
    o = o || {}; text = String(text || '').trim(); if (!text) return null; if (STATE !== 'idle') throw new Error('Dr. HVAC is still working on the last message.');
    if (!CONV) await load();
    const transport = D.transport();
    if (transport === 'none') { const e = new D.llm.LlmError('No Anthropic API key yet.', { kind: 'no_key', hint: 'Open Settings in Dr. HVAC and paste a key from console.anthropic.com.' }); emit('error', { error: e }); throw e; }
    if (!CONV.messages.length) {                 /* frozen here, for the life of the conversation */
      CONV.transport = transport; CONV.model = D.settings().model;
      CONV.system = D.knowledge && D.knowledge.system ? D.knowledge.system() : 'You are Dr. HVAC, a senior web developer.';
      CONV.tools = transport === 'api' ? D.llm.toolDefs(D.tools ? D.tools.defs() : [], { web: !!D.settings().webResearch }) : [];
      CONV.title = text.replace(/\s+/g, ' ').slice(0, 70);
    }
    const um = userMessage(text, o); CONV.messages.push(um);
    CONV.ui[CONV.messages.length - 1] = { text, files: (o.files || []).map(f => ({ id: f.id, name: f.name })), images: (o.images || []).length };
    emit('user', { index: CONV.messages.length - 1 }); await persist();
    ctl = new AbortController(); setState('running'); let end = 'error';
    try { end = (CONV.transport === 'viewer' ? await runViewer(ctl.signal) : await runApi(ctl.signal)); if (end === 'stopped') note('notice', 'Stopped.'); }
    catch (e) { const err = D.llm.explain(e); if (err.kind === 'stopped') { note('notice', 'Stopped.'); end = 'stopped'; } else { note('error', D.llm.words(err)); emit('error', { error: err }); } }
    finally { denyAll(); ctl = null; await persist(); setState('idle'); emit('turn_end', { end }); }
    return end;
  }
  function stop() { if (ctl) ctl.abort(); denyAll(); }

  /* ---------- the transcript, as the UI draws it ----------
     [{kind:'user', text, files}, {kind:'assistant', blocks:[text | thinking | tool {id,name,input,result,isError,meta} | server {name, query}]}, {kind:'note', note, text}] */
  function transcript(c) {
    c = c || CONV; if (!c) return []; const out = []; const results = {};
    c.messages.forEach(m => { if (m.role === 'user' && Array.isArray(m.content)) m.content.forEach(b => { if (b.type === 'tool_result') results[b.tool_use_id] = b; }); });
    const notesAt = i => c.events.filter(e => e.at === i && e.kind !== 'tool').forEach(e => out.push({ kind: 'note', note: e.kind, text: e.text }));
    c.messages.forEach((m, i) => {
      notesAt(i);
      if (m.role === 'user') { if (c.ui[i]) out.push(Object.assign({ kind: 'user', index: i }, c.ui[i])); return; }
      const blocks = [];
      (Array.isArray(m.content) ? m.content : [{ type: 'text', text: String(m.content || '') }]).forEach(b => {
        if (b.type === 'text' && b.text) blocks.push({ type: 'text', text: b.text });
        else if (b.type === 'thinking' && b.thinking) blocks.push({ type: 'thinking', text: b.thinking });
        else if (b.type === 'tool_use') { const r = results[b.id]; blocks.push({ type: 'tool', id: b.id, name: b.name, input: b.input, result: r ? r.content : null, isError: !!(r && r.is_error), meta: c.toolMeta[b.id] || {} }); }
        else if (b.type === 'server_tool_use') blocks.push({ type: 'server', name: b.name, input: b.input });
        else if (b.type === 'fallback') blocks.push({ type: 'thinking', text: `Another model took over this reply (${(b.to && b.to.model) || 'fallback'}).` });
        else if (b.type === 'compaction') blocks.push({ type: 'thinking', text: 'Earlier parts of this conversation were summarized to keep it within the model\'s context.' });
      });
      c.events.filter(e => e.kind === 'tool' && e.at === i).forEach(e => blocks.unshift({ type: 'thinking', text: e.text }));
      if (blocks.length) out.push({ kind: 'assistant', index: i, blocks });
    });
    notesAt(c.messages.length);
    return out;
  }

  return { load, open, fresh, remove, current, list, state, send, stop, ask, answer, pending, transcript, echoable, userMessage, repair, get sessionDrafts() { return sessionDrafts; } };
})();
