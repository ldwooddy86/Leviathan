#!/usr/bin/env node
// Legion · local server and Claude proxy.
//
//   node server/serve.mjs [--port 8787] [--host 127.0.0.1] [--max-tokens 8192] [--allow-host name]
//
// Serves legion/Legion.html at / (and the files under legion/ for development), and proxies Claude so the API
// key stays on this machine: the page's ClaudeVoice points the official SDK at http://host:port/api/anthropic
// with a dummy key, and this server answers the SDK's own requests (POST /v1/messages, streaming or not, and
// GET /v1/models/{id}) by calling Anthropic with the official SDK and the server's credential
// (ANTHROPIC_API_KEY, or the SDK's default credential chain). Streams are relayed one raw event at a time in the
// server-sent-event framing the SDK's parser reads (event: <type>, data: <json>, blank line).
//
// The proxy only takes what Legion's NPC conversations need (a model from MODELS, a capped max_tokens, text
// messages, no tools, a size limit), binds to 127.0.0.1 by default, refuses cross-origin and foreign-Host
// requests (no CORS, DNS-rebinding safe), and writes one log line per request. It never logs or returns a key.

import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import Anthropic from '@anthropic-ai/sdk';
import { MODELS, DEFAULTS, EFFORTS, FALLBACK_BETA } from '../src/engine/llm.mjs';

/** legion/ — the static root. */
export const LEGION_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Where the SDK-compatible proxy lives; ClaudeVoice({proxyURL: origin + PROXY_PATH}). */
export const PROXY_PATH = '/api/anthropic';

/** Default limits. */
export const LIMITS = Object.freeze({ maxBodyBytes: 1 << 20, maxTokens: 8192, maxConcurrent: 6, maxMessages: 2000 });

const MODEL_IDS = new Set(MODELS.map(m => m.id));
const ALLOWED_BETAS = new Set([FALLBACK_BETA, 'server-side-fallback-2026-06-01']);
const ALLOWED_FIELDS = new Set(['model', 'max_tokens', 'messages', 'system', 'stream', 'output_config', 'fallbacks', 'metadata', 'stop_sequences', 'cache_control', 'thinking']);
const BLOCK_TYPES = { user: new Set(['text']), assistant: new Set(['text', 'thinking', 'redacted_thinking', 'fallback']), system: new Set(['text']) };

const MIME = {
  '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8', '.gz': 'application/gzip', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8', '.wasm': 'application/wasm', '.csv': 'text/csv; charset=utf-8',
  '.jsonl': 'application/x-ndjson; charset=utf-8', '.py': 'text/plain; charset=utf-8',
};

const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'SAMEORIGIN',
  'cross-origin-resource-policy': 'same-origin',
};

// ---------------------------------------------------------------- request validation

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);

function checkCacheControl(cc, where) {
  if (cc === undefined) return null;
  if (!isObj(cc) || cc.type !== 'ephemeral' || Object.keys(cc).some(k => k !== 'type' && k !== 'ttl') || (cc.ttl !== undefined && cc.ttl !== '5m' && cc.ttl !== '1h')) return `${where}.cache_control must be {type: "ephemeral", ttl?: "5m" | "1h"}`;
  return null;
}

function checkTextBlock(b, where) {
  if (!isObj(b) || b.type !== 'text' || typeof b.text !== 'string') return `${where} must be a text block`;
  if (Object.keys(b).some(k => k !== 'type' && k !== 'text' && k !== 'cache_control' && k !== 'citations')) return `${where} has fields the Legion proxy does not accept`;
  return checkCacheControl(b.cache_control, where);
}

function checkMessage(m, i) {
  const where = `messages[${i}]`;
  if (!isObj(m)) return `${where} must be an object`;
  if (!BLOCK_TYPES[m.role]) return `${where}.role must be "user", "assistant" or "system"`;
  if (Object.keys(m).some(k => k !== 'role' && k !== 'content')) return `${where} has fields the Legion proxy does not accept`;
  if (typeof m.content === 'string') return null;
  if (!Array.isArray(m.content)) return `${where}.content must be a string or an array of blocks`;
  const allowed = BLOCK_TYPES[m.role];
  for (let j = 0; j < m.content.length; j++) {
    const b = m.content[j];
    const w = `${where}.content[${j}]`;
    if (!isObj(b) || !allowed.has(b.type)) return `${w}: the Legion proxy takes only text conversations (no tools, images or documents)`;
    if (b.type === 'text') { const e = checkTextBlock(b, w); if (e) return e; }
  }
  return null;
}

/**
 * Check a Messages API request body against what Legion's NPC conversations use.
 * @param {unknown} body  the parsed JSON body
 * @param {{maxTokens?: number, maxMessages?: number, betas?: string[]}} [limits]
 * @returns {{ok: true} | {ok: false, message: string}}
 */
export function validateMessagesRequest(body, { maxTokens = LIMITS.maxTokens, maxMessages = LIMITS.maxMessages, betas = [] } = {}) {
  const bad = message => ({ ok: false, message });
  if (!isObj(body)) return bad('the request body must be a JSON object');
  for (const b of betas) if (!ALLOWED_BETAS.has(b)) return bad(`the beta "${b}" is not enabled on the Legion proxy`);
  for (const k of Object.keys(body)) {
    if (k === 'tools' || k === 'tool_choice' || k === 'mcp_servers' || k === 'container') return bad('tools are not available through the Legion proxy');
    if (!ALLOWED_FIELDS.has(k)) return bad(`the field "${k}" is not accepted by the Legion proxy`);
  }
  if (!MODEL_IDS.has(body.model)) return bad(`model must be one of ${[...MODEL_IDS].join(', ')}`);
  if (!Number.isInteger(body.max_tokens) || body.max_tokens < 0 || body.max_tokens > maxTokens) return bad(`max_tokens must be an integer from 0 to ${maxTokens} on the Legion proxy`);
  if (body.stream !== undefined && typeof body.stream !== 'boolean') return bad('stream must be a boolean');
  if (!Array.isArray(body.messages) || body.messages.length === 0) return bad('messages must be a non-empty array');
  if (body.messages.length > maxMessages) return bad(`too many messages (the Legion proxy takes up to ${maxMessages})`);
  for (let i = 0; i < body.messages.length; i++) { const e = checkMessage(body.messages[i], i); if (e) return bad(e); }
  if (body.system !== undefined && typeof body.system !== 'string') {
    if (!Array.isArray(body.system)) return bad('system must be a string or an array of text blocks');
    for (let i = 0; i < body.system.length; i++) { const e = checkTextBlock(body.system[i], `system[${i}]`); if (e) return bad(e); }
  }
  if (body.output_config !== undefined) {
    const oc = body.output_config;
    if (!isObj(oc) || Object.keys(oc).some(k => k !== 'effort' && k !== 'format')) return bad('output_config takes only effort and format on the Legion proxy');
    if (oc.effort !== undefined && oc.effort !== null && !EFFORTS.includes(oc.effort)) return bad(`output_config.effort must be one of ${EFFORTS.join(', ')}`);
    if (oc.format !== undefined && oc.format !== null && (!isObj(oc.format) || oc.format.type !== 'json_schema' || !isObj(oc.format.schema))) return bad('output_config.format must be {type: "json_schema", schema: {...}}');
  }
  if (body.thinking !== undefined) {
    const t = body.thinking;
    if (!isObj(t) || t.type !== 'adaptive' || Object.keys(t).some(k => k !== 'type' && k !== 'display')) return bad('thinking is adaptive on these models: omit it, or send {type: "adaptive"}');
  }
  if (body.fallbacks !== undefined) {
    const f = body.fallbacks;
    const okEntry = e => isObj(e) && typeof e.model === 'string' && /^claude-[a-z0-9.-]+$/.test(e.model) && Object.keys(e).every(k => k === 'model' || (k === 'max_tokens' && Number.isInteger(e.max_tokens) && e.max_tokens > 0 && e.max_tokens <= maxTokens));
    if (f !== 'default' && !(Array.isArray(f) && f.length >= 1 && f.length <= 3 && f.every(okEntry))) return bad('fallbacks must be "default" or a list of up to 3 {model} entries');
  }
  if (body.metadata !== undefined && (!isObj(body.metadata) || Object.keys(body.metadata).some(k => k !== 'user_id') || (body.metadata.user_id !== undefined && typeof body.metadata.user_id !== 'string'))) return bad('metadata takes only user_id');
  if (body.stop_sequences !== undefined && (!Array.isArray(body.stop_sequences) || body.stop_sequences.length > 8 || body.stop_sequences.some(s => typeof s !== 'string'))) return bad('stop_sequences must be up to 8 strings');
  const cc = checkCacheControl(body.cache_control, 'request');
  if (cc) return bad(cc);
  return { ok: true };
}

// ---------------------------------------------------------------- credentials

/**
 * Which credential the default upstream client will use, without revealing it: the environment variables the
 * SDK reads, then (for the server's own environment) a profile on disk from `ant auth login`.
 * @param {Record<string, string|undefined>} env
 * @returns {Promise<{configured: boolean, source: string|null, error?: string}>}
 */
export async function detectCredential(env = process.env) {
  if (env.ANTHROPIC_API_KEY) return { configured: true, source: 'ANTHROPIC_API_KEY' };
  if (env.ANTHROPIC_AUTH_TOKEN) return { configured: true, source: 'ANTHROPIC_AUTH_TOKEN' };
  if (env.ANTHROPIC_FEDERATION_RULE_ID && env.ANTHROPIC_ORGANIZATION_ID && (env.ANTHROPIC_IDENTITY_TOKEN_FILE || env.ANTHROPIC_IDENTITY_TOKEN)) return { configured: true, source: 'workload identity federation' };
  if (env !== process.env) return { configured: false, source: null };
  try {
    const { loadConfig } = await import('@anthropic-ai/sdk/core/credentials');
    const config = await loadConfig();
    if (config) return { configured: true, source: env.ANTHROPIC_PROFILE ? `profile "${env.ANTHROPIC_PROFILE}"` : 'Anthropic profile on disk' };
  } catch (err) {
    return { configured: false, source: null, error: String(err && err.message || err) };
  }
  return { configured: false, source: null };
}

// ---------------------------------------------------------------- responses

function send(res, status, body, headers = {}) {
  const data = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, {
    'content-type': typeof body === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(data),
    'cache-control': 'no-store',
    ...SECURITY_HEADERS,
    ...headers,
  });
  res.end(data);
}

/** An error in the Messages API's own shape, so the SDK on the page raises its typed error for the status. */
function apiError(res, status, type, message, headers = {}) {
  send(res, status, { type: 'error', error: { type, message } }, { 'x-should-retry': 'false', ...headers });
}

const STATUS_TYPES = { 400: 'invalid_request_error', 401: 'authentication_error', 402: 'billing_error', 403: 'permission_error', 404: 'not_found_error', 413: 'request_too_large', 429: 'rate_limit_error', 529: 'overloaded_error' };

function isAbort(err) {
  return (typeof Anthropic.APIUserAbortError === 'function' && err instanceof Anthropic.APIUserAbortError) || (err && err.name === 'AbortError');
}

/** Status and Messages-API-shaped body for an upstream failure; the page's SDK must not retry what we already retried. */
function upstreamFailure(err) {
  const status = err && typeof err.status === 'number' ? err.status : null;
  const upstreamMsg = (err && (err.apiMessage || (err.error && err.error.error && err.error.error.message))) || (err && err.message) || 'unknown error';
  const headers = { 'x-should-retry': 'false' };
  if (status) {
    const retryAfter = err.headers && typeof err.headers.get === 'function' ? err.headers.get('retry-after') : null;
    if (retryAfter) headers['retry-after'] = retryAfter;
    const requestId = err.requestID || (err.headers && typeof err.headers.get === 'function' ? err.headers.get('request-id') : null);
    if (requestId) headers['request-id'] = requestId;
    const type = (err.error && err.error.error && err.error.error.type) || err.type || STATUS_TYPES[status] || (status >= 500 ? 'api_error' : 'invalid_request_error');
    let message = upstreamMsg;
    if (status === 401) message = `The Legion server's Anthropic API key was rejected (${upstreamMsg}). Check ANTHROPIC_API_KEY where the server runs.`;
    else if (status === 403) message = `The Legion server's Anthropic key is not allowed to do this (${upstreamMsg}).`;
    return { status, headers, body: { type: 'error', error: { type, message } } };
  }
  const connection = typeof Anthropic.APIConnectionError === 'function' && err instanceof Anthropic.APIConnectionError;
  // An error the API sent inside a stream has no status, but keeps its type (overloaded_error, api_error, ...).
  const streamedType = !connection && ((err && err.error && err.error.error && err.error.error.type) || (err && typeof err.type === 'string' && err.type)) || null;
  if (streamedType) return { status: 502, headers, body: { type: 'error', error: { type: streamedType, message: upstreamMsg } } };
  const message = connection ? `The Legion server could not reach the Anthropic API (${upstreamMsg}).` : `The Legion server's Anthropic client failed: ${upstreamMsg}`;
  return { status: 502, headers, body: { type: 'error', error: { type: 'api_error', message } } };
}

/** Write one SSE event, waiting for the socket to drain when its buffer is full. */
function writeEvent(res, event, data) {
  if (res.destroyed || res.writableEnded) return Promise.resolve();
  const ok = res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  if (ok) return Promise.resolve();
  return new Promise(resolve => {
    const done = () => { res.off('drain', done); res.off('close', done); resolve(); };
    res.on('drain', done);
    res.on('close', done);
  });
}

// ---------------------------------------------------------------- the server

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers['content-length']);
    if (Number.isFinite(declared) && declared > limit) { reject(Object.assign(new Error('too large'), { code: 'too_large' })); req.resume(); return; }
    const chunks = [];
    let size = 0;
    let over = false;
    req.on('data', chunk => {
      if (over) return;
      size += chunk.length;
      if (size > limit) { over = true; reject(Object.assign(new Error('too large'), { code: 'too_large' })); return; }
      chunks.push(chunk);
    });
    req.on('end', () => { if (!over) resolve(Buffer.concat(chunks)); });
    req.on('error', reject);
  });
}

const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;

/**
 * A value made safe for the one-line request log: control characters, line and paragraph separators are
 * escaped (\n, \r, \t, \uXXXX), so nothing a client sends (a model name, a field name quoted in a validation
 * message) can break a log entry across lines or forge one.
 * @param {unknown} value
 * @param {number} [max] longest piece kept, in characters
 * @returns {string}
 */
export function logSafe(value, max = 200) {
  const s = String(value ?? '').slice(0, max);
  return s.replace(/[\p{Cc}\p{Zl}\p{Zp}]/gu, c => (c === '\n' ? '\\n' : c === '\r' ? '\\r' : c === '\t' ? '\\t' : `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`));
}

function hostAllowed(hostHeader, port, ctx) {
  if (typeof hostHeader !== 'string' || !hostHeader) return false;
  const m = /^(\[[0-9a-f:.]+\]|[^:]+)(?::(\d+))?$/i.exec(hostHeader.trim());
  if (!m) return false;
  const name = m[1].toLowerCase();
  const p = m[2] ? Number(m[2]) : 80;
  if (p !== port) return false;
  if (ctx.allowedHosts.has(name)) return true;
  if (name === 'localhost' || name === '127.0.0.1' || name === '[::1]') return true;
  // Literal IP addresses cannot be DNS-rebound; when bound to every interface (LAN use) they are fine.
  if (ctx.wildcard && (IPV4.test(name) || name.startsWith('['))) return true;
  return name === ctx.boundHost;
}

/**
 * The Legion server: static files, /api/health and the Claude proxy. Returns an http.Server that is not yet
 * listening (call .listen(port, host)).
 * @param {{root?: string, clientFactory?: () => object, env?: Record<string, string|undefined>, log?: (line: string) => void,
 *   maxBodyBytes?: number, maxTokens?: number, maxConcurrent?: number, allowedHosts?: string[], host?: string}} [options]
 * @returns {import('node:http').Server}
 */
export function createServer(options = {}) {
  const root = path.resolve(options.root || LEGION_ROOT);
  const realRoot = fs.realpathSync(root);
  const env = options.env || process.env;
  const customClient = typeof options.clientFactory === 'function';
  const clientFactory = customClient ? options.clientFactory : () => new Anthropic();
  const log = typeof options.log === 'function' ? options.log : line => console.log(line);
  const maxBodyBytes = options.maxBodyBytes || LIMITS.maxBodyBytes;
  const maxTokens = options.maxTokens || LIMITS.maxTokens;
  const maxConcurrent = options.maxConcurrent || LIMITS.maxConcurrent;
  const boundHost = String(options.host || '127.0.0.1').toLowerCase();
  const ctx = {
    allowedHosts: new Set((options.allowedHosts || []).map(h => String(h).toLowerCase())),
    wildcard: boundHost === '0.0.0.0' || boundHost === '::' || boundHost === '[::]',
    boundHost: boundHost.includes(':') && !boundHost.startsWith('[') ? `[${boundHost}]` : boundHost,
  };
  let client = null;
  let inflight = 0;
  let credential = null;
  let credentialAt = 0;

  const upstream = () => (client ||= clientFactory());
  const credentialStatus = async () => {
    if (!credential || Date.now() - credentialAt > 30000) { credential = await detectCredential(env); credentialAt = Date.now(); }
    return credential;
  };

  const server = http.createServer((req, res) => {
    const started = Date.now();
    const note = { model: null, stream: false, usage: null, detail: null };
    let logged = false;
    const finish = () => {
      if (logged) return;
      logged = true;
      const status = res.headersSent ? res.statusCode : 0;
      const bits = [new Date(started).toISOString(), logSafe(req.socket.remoteAddress || '-', 64), logSafe(req.method, 16), logSafe((req.url || '').split('?')[0]), status || 'aborted', `${Date.now() - started}ms`];
      if (note.model) bits.push(logSafe(note.model, 60) + (note.stream ? ' stream' : ''));
      if (note.usage) bits.push(`in=${Number(note.usage.input_tokens) || 0} out=${Number(note.usage.output_tokens) || 0} cache_read=${Number(note.usage.cache_read_input_tokens) || 0}`);
      if (note.detail) bits.push(logSafe(note.detail, 240));
      try { log(bits.join(' ')); } catch { /* logging must never take the server down */ }
    };
    res.on('finish', finish);
    res.on('close', finish);
    handle(req, res, note).catch(err => {
      note.detail = `error: ${err && err.message}`;
      if (!res.headersSent) send(res, 500, { ok: false, error: 'internal error' });
      else res.destroy();
    });
  });

  async function handle(req, res, note) {
    const port = server.address() && server.address().port;
    if (!hostAllowed(req.headers.host, port, ctx)) {
      note.detail = 'refused: host';
      return send(res, 403, 'Forbidden: this server only answers requests addressed to localhost or its own address.\n');
    }
    let url;
    try { url = new URL(req.url || '/', 'http://localhost'); } catch { return send(res, 400, 'Bad request\n'); }
    const pathname = url.pathname;
    if (pathname === '/api' || pathname.startsWith('/api/')) {
      // Same origin only: the page that talks to the proxy must have come from this server.
      const origin = req.headers.origin;
      const site = req.headers['sec-fetch-site'];
      if ((origin && origin !== `http://${req.headers.host}`) || (site && site !== 'same-origin' && site !== 'none')) {
        note.detail = 'refused: cross-origin';
        return apiError(res, 403, 'permission_error', 'Cross-origin requests are not allowed: open Legion from this server to use its Claude proxy.');
      }
      return api(req, res, url, note);
    }
    return serveStatic(req, res, pathname);
  }

  async function api(req, res, url, note) {
    const p = url.pathname;
    if (p === '/api/health') {
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { ok: false, error: 'method not allowed' }, { allow: 'GET, HEAD' });
      const cred = await credentialStatus();
      const body = {
        ok: true,
        service: 'legion',
        keyConfigured: cred.configured,
        credential: cred.source,
        proxy: PROXY_PATH,
        models: MODELS.map(m => m.id),
        defaultModel: DEFAULTS.model,
        maxTokens,
        app: fs.existsSync(path.join(root, 'Legion.html')),
      };
      if (!cred.configured) body.hint = 'Start the server with ANTHROPIC_API_KEY set (or sign in with `ant auth login`) to use Claude through it.';
      if (url.searchParams.get('verify') === '1') {
        try {
          const info = await upstream().models.retrieve(DEFAULTS.model);
          body.verified = true;
          body.verifiedModel = (info && info.id) || DEFAULTS.model;
        } catch (err) {
          body.verified = false;
          body.verifyError = upstreamFailure(err).body.error.message;
        }
      }
      return send(res, 200, body);
    }
    const isMessages = p === `${PROXY_PATH}/v1/messages` || p === '/api/claude';
    if (isMessages) {
      if (req.method !== 'POST') return apiError(res, 405, 'invalid_request_error', 'Use POST for messages.', { allow: 'POST' });
      return proxyMessages(req, res, note);
    }
    const model = new RegExp(`^${PROXY_PATH}/v1/models/([^/]+)$`).exec(p);
    if (model) {
      if (req.method !== 'GET') return apiError(res, 405, 'invalid_request_error', 'Use GET for models.', { allow: 'GET' });
      let id;
      try { id = decodeURIComponent(model[1]); } catch { return apiError(res, 400, 'invalid_request_error', 'Malformed model id.'); }
      return proxyModel(req, res, id, note);
    }
    return apiError(res, 404, 'not_found_error', `Not found: the Legion proxy answers POST ${PROXY_PATH}/v1/messages and GET ${PROXY_PATH}/v1/models/{model}.`);
  }

  async function guardUpstream(res, note) {
    if (!customClient) {
      const cred = await credentialStatus();
      if (!cred.configured) {
        note.detail = 'refused: no credential';
        apiError(res, 401, 'authentication_error', 'The Legion server has no Anthropic API key. Restart it with ANTHROPIC_API_KEY set (or sign in with `ant auth login`).');
        return false;
      }
    }
    if (inflight >= maxConcurrent) {
      note.detail = 'refused: busy';
      apiError(res, 429, 'rate_limit_error', `The Legion server is busy (${inflight} Claude requests in flight). Try again in a moment.`, { 'retry-after': '1', 'x-should-retry': 'true' });
      return false;
    }
    return true;
  }

  async function proxyModel(req, res, id, note) {
    if (!MODEL_IDS.has(id)) return apiError(res, 404, 'not_found_error', `The Legion proxy offers ${[...MODEL_IDS].join(', ')}.`);
    note.model = id;
    if (!(await guardUpstream(res, note))) return;
    const controller = new AbortController();
    res.on('close', () => { if (!res.writableEnded) controller.abort(); });
    inflight++;
    try {
      const info = await upstream().models.retrieve(id, { signal: controller.signal });
      send(res, 200, info);
    } catch (err) {
      if (isAbort(err)) return;
      const f = upstreamFailure(err);
      note.detail = `upstream ${f.status}`;
      send(res, f.status, f.body, f.headers);
    } finally {
      inflight--;
    }
  }

  async function proxyMessages(req, res, note) {
    if (!/^application\/json\b/i.test(String(req.headers['content-type'] || ''))) return apiError(res, 415, 'invalid_request_error', 'Send the request as application/json.');
    let raw;
    try {
      raw = await readBody(req, maxBodyBytes);
    } catch (err) {
      if (err && err.code === 'too_large') { note.detail = 'refused: body too large'; return apiError(res, 413, 'request_too_large', `The request is larger than the Legion proxy's ${Math.round(maxBodyBytes / 1024)} KB limit.`, { connection: 'close' }); }
      throw err;
    }
    let body;
    try { body = JSON.parse(raw.toString('utf8')); } catch { return apiError(res, 400, 'invalid_request_error', 'The request body is not valid JSON.'); }
    const betas = String(req.headers['anthropic-beta'] || '').split(',').map(s => s.trim()).filter(Boolean);
    const check = validateMessagesRequest(body, { maxTokens, betas });
    note.model = isObj(body) && typeof body.model === 'string' ? body.model.slice(0, 60) : null;
    if (!check.ok) { note.detail = `refused: ${check.message.slice(0, 120)}`; return apiError(res, 400, 'invalid_request_error', check.message); }
    note.stream = body.stream === true;
    if (!(await guardUpstream(res, note))) return;

    const { stream, ...rest } = body;
    const params = { ...rest, ...(betas.length ? { betas } : {}) };
    const controller = new AbortController();
    res.on('close', () => { if (!res.writableEnded) controller.abort(); });
    inflight++;
    try {
      if (!note.stream) {
        let message;
        try {
          message = await upstream().beta.messages.create({ ...params, stream: false }, { signal: controller.signal });
        } catch (err) {
          if (isAbort(err)) return;
          const f = upstreamFailure(err);
          note.detail = `upstream ${f.status}`;
          return send(res, f.status, f.body, f.headers);
        }
        note.usage = message && message.usage;
        return send(res, 200, message);
      }
      let events;
      let requestId = null;
      try {
        const pending = upstream().beta.messages.create({ ...params, stream: true }, { signal: controller.signal });
        if (pending && typeof pending.withResponse === 'function') {
          const { data, response } = await pending.withResponse();
          events = data;
          requestId = response && response.headers && typeof response.headers.get === 'function' ? response.headers.get('request-id') : null;
        } else {
          events = await pending;
        }
      } catch (err) {
        if (isAbort(err)) return;
        const f = upstreamFailure(err);
        note.detail = `upstream ${f.status}`;
        return send(res, f.status, f.body, f.headers);
      }
      res.writeHead(200, {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache, no-transform',
        'x-accel-buffering': 'no',
        ...SECURITY_HEADERS,
        ...(requestId ? { 'request-id': requestId } : {}),
      });
      res.flushHeaders();
      // Keep idle connections (long thinking before the first token) alive; the SDK's parser skips pings.
      const keepAlive = setInterval(() => { if (!res.writableEnded) res.write('event: ping\ndata: {"type": "ping"}\n\n'); }, 15000);
      const usage = {};
      try {
        for await (const event of events) {
          if (!isObj(event) || typeof event.type !== 'string') continue;
          if (event.type === 'message_start' && isObj(event.message) && isObj(event.message.usage)) Object.assign(usage, event.message.usage);
          if (event.type === 'message_delta' && isObj(event.usage)) for (const [k, v] of Object.entries(event.usage)) if (v !== null && v !== undefined) usage[k] = v;
          await writeEvent(res, event.type, event);
        }
      } catch (err) {
        if (!isAbort(err) && !res.writableEnded) {
          const f = upstreamFailure(err);
          note.detail = `upstream error mid-stream: ${f.body.error.type}`;
          await writeEvent(res, 'error', f.body);
        }
      } finally {
        clearInterval(keepAlive);
        note.usage = usage;
        if (!res.writableEnded) res.end();
      }
    } finally {
      inflight--;
    }
  }

  async function serveStatic(req, res, pathname) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed\n', { allow: 'GET, HEAD' });
    let decoded;
    try { decoded = decodeURIComponent(pathname === '/' ? '/Legion.html' : pathname); } catch { return send(res, 400, 'Bad request\n'); }
    if (decoded.includes('\0') || decoded.includes('\\')) return send(res, 400, 'Bad request\n');
    const segments = decoded.split('/').filter(Boolean);
    // Dot segments are refused outright: no traversal, no .env, no .git.
    if (!segments.length || segments.some(s => s.startsWith('.'))) return send(res, 404, 'Not found\n');
    const file = path.join(root, ...segments);
    let real;
    try { real = await fsp.realpath(file); } catch {
      if (pathname === '/' || decoded === '/Legion.html') return notBuilt(res);
      return send(res, 404, 'Not found\n');
    }
    if (real !== realRoot && !real.startsWith(realRoot + path.sep)) return send(res, 404, 'Not found\n');
    let st;
    try { st = await fsp.stat(real); } catch { return send(res, 404, 'Not found\n'); }
    if (!st.isFile()) return send(res, 404, 'Not found\n');
    const etag = `W/"${st.size.toString(16)}-${Math.floor(st.mtimeMs).toString(16)}"`;
    const headers = {
      'content-type': MIME[path.extname(real).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-cache',
      etag,
      ...SECURITY_HEADERS,
    };
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, headers); return res.end(); }
    res.writeHead(200, { ...headers, 'content-length': st.size });
    if (req.method === 'HEAD') return res.end();
    await new Promise(resolve => {
      const s = fs.createReadStream(real);
      s.on('error', () => { res.destroy(); resolve(); });
      s.on('end', resolve);
      res.on('close', () => { s.destroy(); resolve(); });
      s.pipe(res);
    });
  }

  function notBuilt(res) {
    const html = '<!doctype html><meta charset="utf-8"><title>Legion</title><body style="font:16px system-ui;margin:3em;max-width:40em">'
      + '<h1>Legion has not been built yet</h1><p>Run <code>node tools/build.mjs</code> in <code>legion/</code>, then reload this page.</p>'
      + `<p>The Claude proxy is already running at <code>${PROXY_PATH}</code>; <a href="/api/health">/api/health</a> shows its status.</p></body>`;
    res.writeHead(503, { 'content-type': 'text/html; charset=utf-8', 'content-length': Buffer.byteLength(html), 'cache-control': 'no-store', ...SECURITY_HEADERS });
    res.end(html);
  }

  return server;
}

// ---------------------------------------------------------------- command line

const HELP = `Legion server: serves Legion.html and proxies Claude with the key kept on this machine.

  node server/serve.mjs [--port 8787] [--host 127.0.0.1] [--max-tokens ${LIMITS.maxTokens}] [--allow-host name]

  --port        port to listen on (default 8787)
  --host        interface to bind (default 127.0.0.1; 0.0.0.0 to reach it from your LAN by IP address)
  --max-tokens  cap on max_tokens per Claude request (default ${LIMITS.maxTokens})
  --allow-host  an extra Host name to answer to (repeatable), e.g. a hostname on your LAN

The Claude proxy uses ANTHROPIC_API_KEY (or your \`ant auth login\` profile). Open http://host:port/ and point
Claude at this server (proxy URL /api/anthropic) in Settings; the page never sees the key.`;

/** Run the server from the command line. */
export async function main(argv = process.argv.slice(2)) {
  let args;
  try {
    args = parseArgs({ args: argv, options: { port: { type: 'string', default: '8787' }, host: { type: 'string', default: '127.0.0.1' }, 'max-tokens': { type: 'string' }, 'allow-host': { type: 'string', multiple: true }, help: { type: 'boolean', short: 'h' } } }).values;
  } catch (err) {
    console.error(`${err.message}\n\n${HELP}`);
    process.exitCode = 2;
    return null;
  }
  if (args.help) { console.log(HELP); return null; }
  const port = Number(args.port);
  const maxTokens = args['max-tokens'] === undefined ? LIMITS.maxTokens : Number(args['max-tokens']);
  if (!Number.isInteger(port) || port < 0 || port > 65535) { console.error(`--port must be a port number, not "${args.port}"`); process.exitCode = 2; return null; }
  if (!Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > 128000) { console.error('--max-tokens must be an integer from 1 to 128000'); process.exitCode = 2; return null; }
  const server = createServer({ host: args.host, maxTokens, allowedHosts: args['allow-host'] || [] });
  server.on('error', err => {
    console.error(err.code === 'EADDRINUSE' ? `Port ${port} is already in use on ${args.host}. Try --port ${port + 1}.` : `Server error: ${err.message}`);
    process.exitCode = 1;
  });
  server.listen(port, args.host, async () => {
    const addr = server.address();
    const host = args.host.includes(':') ? `[${args.host}]` : args.host;
    const cred = await detectCredential(process.env);
    console.log(`Legion on http://${host === '0.0.0.0' || host === '[::]' ? '127.0.0.1' : host}:${addr.port}/  ·  Claude proxy at ${PROXY_PATH}  ·  ${cred.configured ? `credential: ${cred.source}` : 'no Anthropic credential (set ANTHROPIC_API_KEY to enable Claude)'}`);
    if (!fs.existsSync(path.join(LEGION_ROOT, 'Legion.html'))) console.log('Legion.html is not built yet: run node tools/build.mjs');
  });
  const stop = () => {
    server.close(() => process.exit(0));
    server.closeAllConnections();
    setTimeout(() => process.exit(0), 2000).unref();
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
