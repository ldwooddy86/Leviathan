/* ==== src/dr/02_dr_llm.js ==== */
/* ==== dr_llm ==== */
"use strict";
/* ============================ Dr. HVAC: the model client ============================
   One streamed request to Claude through the official Anthropic SDK (vendor/anthropic-sdk.min.js, global AnthropicSDK):
   the SDK builds the request, retries the retryable failures, parses the stream and raises its own typed errors.
   The request shape follows Anthropic's guidance for the current models:
     thinking      adaptive and always on (Opus 5.5 and Fable 5.2 reject "disabled" and budgets); display "summarized",
                   so the short notes the model writes between tool calls come back as readable thinking text
     effort        output_config.effort from the settings (Opus 5.5 would default to medium)
     tool choice   auto only: these models reject a forced tool call
     tools         eager_input_streaming on every client tool, so a long page streams as it is written; the agent loop
                   validates each input before it runs (03_dr_agent.js)
     caching       a breakpoint on the frozen system prompt plus automatic caching on the growing tail
     refusals      stop_reason "refusal" is a normal answer here; with beta features on, fallbacks: "default" lets the API
                   retry a classifier decline on the model Anthropic names for that category
     history       sent exactly as stored. Thinking blocks are bound to the conversation that produced them, so the loop
                   only ever appends; block_binding "drop_block" makes the API drop a block it cannot accept instead
                   of failing the request, and server side compaction summarizes a very long session without an edit here
   compat mode (settings) sends none of the three beta features, for a key or a gateway that rejects them. */
DRHVAC.llm = (() => {
  const D = DRHVAC;
  const BETA = { fallback: 'server-side-fallback-2026-07-01', binding: 'thinking-binding-controls-2026-08-01', compact: 'compact-2026-01-12' };
  const MAX_TOKENS = 64000;                  /* room for the thinking and a whole page in one reply; streaming, so no timeout */
  const WEB_TOOLS = [{ type: 'web_search_20260209', name: 'web_search', max_uses: 8 }, { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 8 }];
  const sdk = () => globalThis.AnthropicSDK || null;

  let client = null, clientSig = '';
  function getClient() {
    const S = D.settings(); const K = sdk(); if (!K) throw new LlmError('The Anthropic SDK did not load (vendor/anthropic-sdk.min.js).', { kind: 'setup' });
    if (!S.apiKey) throw new LlmError('No Anthropic API key yet.', { kind: 'no_key', hint: 'Open Settings in Dr. HVAC and paste a key from console.anthropic.com.' });
    const sig = S.apiKey + '|' + (S.baseUrl || '');
    if (client && sig === clientSig) return client;
    /* dangerouslyAllowBrowser: the SDK's own switch for calling the API from a page. The key is the user's own, kept in
       this browser profile and sent only to the API host. fetch is looked up per call so a test can swap it. */
    client = new K.Client({ apiKey: S.apiKey, baseURL: S.baseUrl ? D.withScheme(S.baseUrl).replace(/\/+$/, '') : undefined, dangerouslyAllowBrowser: true, maxRetries: 2, fetch: (...a) => globalThis.fetch(...a) });
    clientSig = sig; return client;
  }

  class LlmError extends Error { constructor(msg, o) { super(msg); this.name = 'LlmError'; Object.assign(this, o || {}); } }

  /* ---------- the tools array a conversation freezes at its first request ---------- */
  function toolDefs(clientTools, o) {
    o = o || {}; const eager = !D.settings().baseUrl;   /* a gateway in front of the API may reject the field: left off unless the key talks to the API itself */
    const defs = (clientTools || []).map(t => Object.assign({ name: t.name, description: t.description, input_schema: t.input_schema }, eager ? { eager_input_streaming: true } : {}));
    return o.web ? defs.concat(D.clone(WEB_TOOLS)) : defs;
  }

  /* ---------- one request ---------- */
  function params(conv) {
    const S = D.settings(); const beta = !S.compat; const haiku = /haiku/.test(conv.model);
    const p = {
      model: conv.model, max_tokens: MAX_TOKENS,
      system: [{ type: 'text', text: conv.system, cache_control: { type: 'ephemeral' } }],
      messages: conv.messages,
      thinking: { type: 'adaptive', display: 'summarized' },
      output_config: { effort: S.effort },
      cache_control: { type: 'ephemeral' },
    };
    if (conv.tools && conv.tools.length) p.tools = conv.tools;
    if (beta) {
      p.betas = [BETA.binding, BETA.compact];
      p.thinking.block_binding = { prefix_mismatch_behavior: 'drop_block' };
      p.context_management = { edits: [{ type: 'compact_20260112' }] };
      if (!haiku) { p.betas.unshift(BETA.fallback); p.fallbacks = 'default'; }   /* Haiku 5.5 has no server side fallback */
    }
    return p;
  }
  /* stream(conv, {signal, on}) resolves the final message. on(event) receives:
       {type:'start', model}                                   the request is open
       {type:'block', index, block}                            a content block began (text, thinking, tool_use, server tool, ...)
       {type:'delta', index, kind:'text'|'thinking'|'input', text}
       {type:'block_end', index}
     It rejects LlmError (see explain) or, when a streamed tool input could not be parsed at all, the SDK's own error
     with jsonError = true so the loop can re-issue the turn. */
  /* A refusal of the request itself (a 400) while beta features are on is tried once more without them: a key, a model
     or a gateway that does not take one of the betas then still works. If the plain request goes through, compatibility
     mode stays on and the caller is told ({type:'compat'}); if it is refused too, the betas were not the cause, the
     setting goes back and the first refusal is the one reported. Nothing has streamed when a 400 arrives. */
  async function stream(conv, o) {
    o = o || {};
    try { return await streamOnce(conv, o); }
    catch (e) {
      if (!e || e.kind !== 'bad_request' || D.settings().compat || (o.signal && o.signal.aborted)) throw e;
      await D.saveSettings({ compat: true });
      let msg; try { msg = await streamOnce(conv, o); } catch (e2) { await D.saveSettings({ compat: false }); throw (e2 && e2.kind === 'stopped' ? e2 : e); }
      try { (o.on || (() => { }))({ type: 'compat', detail: e.detail || '' }); } catch (x) { }
      return msg;
    }
  }
  async function streamOnce(conv, o) {
    o = o || {}; const on = o.on || (() => { }); const c = getClient(); const p = params(conv); const beta = !!p.betas;
    let st;
    try { st = beta ? c.beta.messages.stream(p, { signal: o.signal }) : c.messages.stream(p, { signal: o.signal }); }
    catch (e) { throw explain(e); }
    st.on('streamEvent', ev => {
      try {
        if (ev.type === 'message_start') on({ type: 'start', model: ev.message && ev.message.model });
        else if (ev.type === 'content_block_start') on({ type: 'block', index: ev.index, block: ev.content_block });
        else if (ev.type === 'content_block_delta') { const d = ev.delta || {}; if (d.type === 'text_delta') on({ type: 'delta', index: ev.index, kind: 'text', text: d.text }); else if (d.type === 'thinking_delta') on({ type: 'delta', index: ev.index, kind: 'thinking', text: d.thinking }); else if (d.type === 'input_json_delta') on({ type: 'delta', index: ev.index, kind: 'input', text: d.partial_json }); }
        else if (ev.type === 'content_block_stop') on({ type: 'block_end', index: ev.index });
      } catch (err) { console.error('drhvac stream listener', err); }
    });
    try { return await st.finalMessage(); }
    catch (e) { const K = sdk(); if (K && e instanceof K.Errors.APIError) throw explain(e); if (o.signal && o.signal.aborted) throw explain(e); e.jsonError = true; throw e; }
  }

  /* ---------- errors, in plain words ----------
     Typed by the SDK's classes, most specific first; nothing here reads an error message to decide what happened. */
  /* an error as one line for the person: what happened, what the API said in its own words, what to do */
  function words(e) { const x = explain(e); const d = x.detail && x.detail !== x.message ? String(x.detail).trim().slice(0, 300) : ''; return x.message + (d ? ` The API said: "${d}".` : '') + (x.hint ? ' ' + x.hint : ''); }
  function explain(e) {
    if (e instanceof LlmError) return e; const K = sdk(); const E = K ? K.Errors : {}; const is = n => E[n] && e instanceof E[n];
    const api = (e && e.error && e.error.error && e.error.error.message) || (e && e.message) || String(e); const status = e && e.status; const rid = (e && (e.requestID || e.request_id)) || '';
    const mk = (msg, o) => new LlmError(msg, Object.assign({ status, detail: api, requestId: rid, cause: e }, o));
    if (is('APIUserAbortError')) return mk('Stopped.', { kind: 'stopped' });
    if (is('AuthenticationError')) return mk('Anthropic rejected the API key.', { kind: 'auth', hint: 'Check the key in Settings. Keys start with sk-ant- and are created at console.anthropic.com.' });
    if (is('PermissionDeniedError')) return mk('This API key may not use that model or feature.', { kind: 'permission', hint: 'Pick another model in Settings, or check the workspace limits in the Anthropic Console.' });
    if (is('NotFoundError')) return mk('The API did not find that model for this key.', { kind: 'not_found', hint: 'Pick another model in Settings.' });
    if (is('RateLimitError')) return mk('The key hit its rate limit.', { kind: 'rate_limit', retryable: true, hint: 'Wait a minute and send again; the SDK already retried twice.' });
    if (is('BadRequestError')) return mk('The API refused the request.', { kind: 'bad_request', hint: D.settings().compat ? '' : 'If the message names a beta feature or an unknown field, turn on Compatibility mode in Settings and send again.' });
    if (is('APIConnectionTimeoutError')) return mk('The request to Anthropic timed out.', { kind: 'timeout', retryable: true });
    if (is('APIConnectionError')) return mk('Could not reach api.anthropic.com.', { kind: 'network', retryable: true, hint: D.ENV === 'viewer' ? 'The Claude viewer blocks outbound calls.' : 'Check the connection' + (D.RT ? ' and that the browser app may reach api.anthropic.com.' : '.') });
    if (is('InternalServerError') || (status && status >= 500)) return mk('Anthropic had a problem on its side.', { kind: 'server', retryable: true, hint: 'Send again in a moment.' });
    if (is('APIError')) return mk('The API returned an error.', { kind: 'api' });
    return mk(api, { kind: 'unknown' });
  }

  /* ---------- the key check: the Models API, which spends no tokens ---------- */
  async function test() {
    const c = getClient(); const id = D.settings().model;
    try { const m = await c.models.retrieve(id); return { ok: true, model: (m && m.id) || id, name: (m && m.display_name) || (D.MODEL(id) || {}).name || id }; }
    catch (e) { throw explain(e); }
  }

  /* ---------- usage ---------- */
  /* adds one response's usage to a conversation's running total; the dollars are an estimate from list prices */
  function addUsage(conv, msg) {
    const u = (msg && msg.usage) || {}; const t = conv.usage || (conv.usage = { requests: 0, input: 0, output: 0, read: 0, write: 0, usd: 0 });
    t.requests++; t.input += u.input_tokens || 0; t.output += u.output_tokens || 0; t.read += u.cache_read_input_tokens || 0; t.write += u.cache_creation_input_tokens || 0;
    t.usd += D.costOf((msg && msg.model) || conv.model, u); return t;
  }

  return { BETA, MAX_TOKENS, WEB_TOOLS, LlmError, getClient, toolDefs, params, stream, explain, words, test, addUsage, reset() { client = null; clientSig = ''; } };
})();
