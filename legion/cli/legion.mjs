#!/usr/bin/env node
// Legion · the command line: every Californian from a terminal.
//
//   node cli/legion.mjs sample <zip|city|county|region|CA> [n]     n NPCs of a place (default 10)
//   node cli/legion.mjs npc <id>                                  the NPC record (CONTRACTS section 5)
//   node cli/legion.mjs persona <id>                              their persona: Big Five, values, concerns, memories, voice
//   node cli/legion.mjs prompt <id>                               the Claude system prompt and this moment's situation note
//   node cli/legion.mjs plan <id> [--date YYYY-MM-DD]             their day, minute by minute
//   node cli/legion.mjs talk <id> [--claude] [--model M] [--effort E] [--proxy URL] [--store FILE]
//   node cli/legion.mjs export <where> <n> > personas.jsonl       game-engine exports (JSON Lines)
//   node cli/legion.mjs stats <zip>                               Census versus generated, for a ZIP
//
// Every command takes --json (machine-readable output), --seed N (the population seed, default 1849) and --t TIME
// (the simulated time: an ISO time with a zone, a Pacific wall time YYYY-MM-DDTHH:MM, or "now"; default the NWS
// snapshot, 2026-11-23 2:38 PM). talk is an offline conversation by default (the dialogue engine, no network);
// with --claude it is Claude, using ANTHROPIC_API_KEY or the SDK's own credential chain (`ant auth login`), or a
// running Legion server's proxy with --proxy http://127.0.0.1:8787/api/anthropic (the key stays on the server).
// --store FILE keeps the NPC's mind in a JSON file, so they remember you next time.

import readline from 'node:readline';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { createLegion } from '../src/engine/platform.mjs';
import { FileStore } from '../src/engine/mind.mjs';
import { History, MODELS, EFFORTS, DEFAULTS, exportJSONL } from '../src/engine/llm.mjs';
import * as dialogue from '../src/engine/dialogue.mjs';
import * as safety from '../src/engine/dialogue/safety.mjs';
import { atPacific, fmtClock, fmtTime, pacific } from '../src/engine/clock.mjs';
import { householdRelations, withArticle, label, LANGUAGE } from '../src/app/format.mjs';

/** The commands, with their arguments, for --help and validation. */
export const COMMANDS = Object.freeze({
  sample: { args: '<zip|city|county|region|CA> [n]', help: 'n NPCs of a place, uniform over its people (default 10)' },
  npc: { args: '<id>', help: 'the NPC record: identity, household, work, commute, languages' },
  persona: { args: '<id>', help: 'their persona: Big Five, traits, values, interests, concerns, memories, speech' },
  prompt: { args: '<id>', help: 'the Claude system prompt (two cached blocks) and the situation note of the moment' },
  plan: { args: '<id> [--date YYYY-MM-DD]', help: 'their plan for a Pacific day (default the simulated day)' },
  talk: { args: '<id> [--claude] [--model M] [--effort E] [--proxy URL] [--store FILE]', help: 'talk with them: offline by default, or with Claude' },
  export: { args: '<where> <n>', help: 'game-engine exports of n NPCs of a place, as JSON Lines' },
  stats: { args: '<zip> [--households N]', help: 'Census versus generated shares for a ZIP (default 2000 households)' },
});

const OPTIONS = {
  json: { type: 'boolean', default: false },
  help: { type: 'boolean', short: 'h', default: false },
  seed: { type: 'string' },
  t: { type: 'string' },
  date: { type: 'string' },
  claude: { type: 'boolean', default: false },
  model: { type: 'string' },
  effort: { type: 'string' },
  proxy: { type: 'string' },
  store: { type: 'string' },
  households: { type: 'string' },
};

/** Usage text. */
export function usage() {
  const rows = Object.entries(COMMANDS).map(([k, c]) => `  ${`${k} ${c.args}`.padEnd(78)} ${c.help}`);
  return [
    'Legion: every Californian in the atlas data as a deterministic NPC.',
    '',
    'Usage: node cli/legion.mjs <command> [arguments] [options]',
    '',
    'Commands:',
    ...rows,
    '',
    'Options:',
    '  --json                 machine-readable output (talk: one JSON line per turn)',
    '  --seed N               population seed (default 1849)',
    '  --t TIME               simulated time: ISO with a zone, Pacific YYYY-MM-DDTHH:MM, or now (default the NWS snapshot)',
    '  --date YYYY-MM-DD      plan: the Pacific day',
    `  --claude               talk: Claude instead of the offline engine (ANTHROPIC_API_KEY or \`ant auth login\`)`,
    `  --model M              talk: ${MODELS.map(m => m.id).join(', ')} (default ${DEFAULTS.model})`,
    `  --effort E             talk: ${EFFORTS.join(', ')} (default ${DEFAULTS.effort})`,
    '  --proxy URL            talk: a Legion server\'s Claude proxy (node server/serve.mjs), e.g. http://127.0.0.1:8787/api/anthropic',
    '  --store FILE           talk: keep the NPC\'s mind in a JSON file between runs',
    '  --households N         stats: households to generate (default 2000)',
    '  -h, --help             this help',
    '',
    'Ids look like 94110-123-0 (ZIP, household, member). Places: a ZIP, a city (Oakland), a county (Alameda County),',
    `a region key (${'nc fn sv si ba cc sj la oc ie sd'}) or CA. In talk, type /bye to leave.`,
  ].join('\n');
}

/** A usage error (exit code 2). */
class UsageError extends Error {}

/** The latest and earliest epoch ms a JavaScript Date holds. */
const MAX_TIME = 8.64e15;

/**
 * A Pacific wall time as epoch ms, refusing one that does not exist (February 30, hour 25, minute 61, the hour the
 * clocks skip in spring): the fields must come back the same from the epoch ms.
 * @param {string} what the option, for the message
 */
export function pacificWall(y, mo, d, h, mi, what) {
  const bad = () => new UsageError(`${what} is not a real Pacific date and time`);
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) throw bad();
  const t = atPacific(y, mo, d, h, mi);
  const p = Number.isFinite(t) ? pacific(t) : null;
  if (!p || p.year !== y || p.month !== mo || p.day !== d || p.hour !== h || p.minute !== mi) throw bad();
  return t;
}

/** The simulated time from --t: ISO with a zone, a Pacific wall time, 'now', epoch ms; null when absent. */
export function parseTime(s) {
  if (s === undefined || s === null || s === '') return null;
  const v = String(s).trim();
  if (v === 'now') return Date.now();
  if (/^-?\d+$/.test(v)) {
    // bare digits are epoch milliseconds (ten digits and more: a year would read as one)
    const n = Number(v);
    if (!/^-?\d{10,}$/.test(v) || !(Math.abs(n) <= MAX_TIME)) throw new UsageError(`--t "${v}": bare digits are epoch milliseconds (10 or more digits, at most ${MAX_TIME})`);
    return n;
  }
  const wall = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?$/.exec(v);
  if (wall) return pacificWall(+wall[1], +wall[2], +wall[3], wall[4] ? +wall[4] : 12, wall[5] ? +wall[5] : 0, `--t "${v}"`);
  const ms = Date.parse(v);
  if (Number.isFinite(ms) && Math.abs(ms) <= MAX_TIME) return ms;
  throw new UsageError(`--t "${v}" is not a time: use an ISO time with a zone, a Pacific YYYY-MM-DDTHH:MM, or now`);
}

/** The population seed from --seed: a whole number from 0 to 4294967295 (it is a 32-bit seed). */
export function parseSeed(s) {
  if (s === undefined) return undefined;
  const v = String(s).trim();
  const n = Number(v);
  if (!/^\d+$/.test(v) || !Number.isSafeInteger(n) || n > 0xFFFFFFFF) throw new UsageError(`--seed must be a whole number from 0 to 4294967295, not "${s}"`);
  return n;
}

/** --model and --effort, checked against what Legion offers (talk and export alike). */
function checkVoiceOptions(v) {
  if (v.model && !MODELS.some(m => m.id === v.model)) throw new UsageError(`--model must be one of ${MODELS.map(m => m.id).join(', ')}`);
  if (v.effort && !EFFORTS.includes(v.effort)) throw new UsageError(`--effort must be one of ${EFFORTS.join(', ')}`);
}

/**
 * The --store file, checked before any conversation: not a directory, in a folder that exists. Opened (read) here,
 * so a file Legion cannot read stops the command at once rather than losing the conversation at its end.
 */
async function openStore(file) {
  const abs = path.resolve(file);
  let st = null;
  try { st = fs.statSync(abs); } catch (e) { if (e.code !== 'ENOENT') throw new UsageError(`--store ${file}: ${e.message}`); }
  if (st && st.isDirectory()) throw new UsageError(`--store ${file} is a directory: give a file path, e.g. ${path.join(file, 'minds.json')}`);
  const dir = path.dirname(abs);
  let ds = null;
  try { ds = fs.statSync(dir); } catch { ds = null; }
  if (!ds || !ds.isDirectory()) throw new UsageError(`--store ${file}: the folder ${dir} does not exist`);
  const store = new FileStore(abs);
  try { await store.open(); } catch (e) { throw new UsageError(`--store ${file}: ${e && e.message ? e.message : e}`); }
  return store;
}

/** Where to find help, said by Legion (not the NPC) when someone in a Claude conversation says they are in crisis. */
export const CRISIS_NOTE = 'If you are thinking about suicide or hurting yourself, or someone is hurting you, call or text 988 (the Suicide & Crisis Lifeline) any time; it answers in Spanish too. If you or someone else is in danger right now, call 911.';

/**
 * What the offline engine's safety check makes of a line, for the Claude path (the offline engine answers it
 * itself): the note Legion prints for someone in crisis (988, 911), or null.
 */
export function crisisNote(text, { age } = {}) {
  try {
    if (typeof safety.safetyOf === 'function') {
      const r = safety.safetyOf(String(text || ''), { age });
      if (!r) return null;
      const notes = safety.SAFETY_NOTES || {};
      const key = r.kind === 'crisis' ? (r.sub === 'abuse' ? 'abuse' : r.sub === 'emergency' ? 'emergency' : 'crisis') : r.kind === 'threat' && r.sub === 'mass' ? 'mass' : null;
      return key ? (r.es && notes[`${key}Es`]) || notes[key] || (r.kind === 'crisis' ? CRISIS_NOTE : null) : null;
    }
    const u = typeof dialogue.understand === 'function' ? dialogue.understand(String(text || ''), {}) : null;
    return u && (u.safety || u.intent) === 'crisis' ? (typeof u.note === 'string' && u.note) || CRISIS_NOTE : null;
  } catch { return null; }
}

const money = n => (Number.isFinite(n) ? `$${Math.round(n).toLocaleString('en-US')}` : '—');
const DWELLING = { house: 'house', 'small-apartment': 'unit in a small building', apartment: 'apartment', 'mobile-home': 'mobile home' };
const pct = v => `${(v * 100).toFixed(1)}%`;
const name = npc => (npc.name && (npc.name.display || npc.name.full)) || npc.id;

function npcLine(n) {
  const job = n.occupation ? n.occupation.title : n.school ? `${n.school} student` : n.status;
  const c = n.commute || {};
  const commute = c.mode && c.mode !== 'wfh' && c.minutes ? `${c.mode} ${c.minutes} min${c.road && c.road.name ? ` on ${c.road.name}` : ''}` : c.mode === 'wfh' ? 'works from home' : '';
  return [n.id.padEnd(16), name(n).padEnd(28), String(n.age).padStart(3), n.sex, (n.heritageLabel || '').padEnd(24), (job || '').padEnd(30), commute].join('  ').trimEnd();
}

function npcText(n) {
  const c = n.commute || {}, hh = n.household || {}, l = n.languages || {};
  const lines = [
    `${name(n)} (${n.id}), ${n.age}, ${n.pronouns}`,
    `  Born ${n.birthYear}${n.birthplace ? ` in ${n.birthplace}` : ''}${n.arrivalYear ? `, came in ${n.arrivalYear}` : ''} · ${n.heritageLabel || n.heritage} · generation ${n.generation}`,
    `  Lives in ${n.place.city} ${n.zip} (${n.place.countyName} County, ${n.place.regionName})`,
    `  Household: ${hh.size} ${hh.size === 1 ? 'person' : 'people'}, ${hh.type}, ${hh.tenure === 'own' ? 'owns' : 'rents'} ${withArticle(DWELLING[hh.dwelling] || hh.dwelling)}, ${hh.vehicles} vehicle${hh.vehicles === 1 ? '' : 's'}, income ${money(n.householdIncome)}`,
    // each member as this NPC's relative (the Census roles are the householder's)
    ...householdRelations(n).map(({ member: m, relation }) => `    ${relation}: ${typeof m.name === 'object' && m.name ? (m.name.display || m.name.full) : m.name}, ${m.age}`),
    `  Languages: ${label(LANGUAGE, l.home || 'english')} at home${l.english && l.english !== 'only' ? ` (English: ${l.english})` : ''}`,
    `  ${n.occupation ? `Work: ${n.occupation.title}${n.occupation.employer ? `, ${n.occupation.employer}` : ''}, ${money(n.income)} a year` : `Status: ${n.status}${n.school ? ` (${n.school})` : ''}`}`,
    c.mode === 'wfh' ? '  Commute: works from home' : c.mode ? `  Commute: ${c.mode}${c.minutes ? `, ${c.minutes} min` : ''}${c.workCity ? ` to ${c.workCity} (${c.workZip})` : ''}${Number.isFinite(c.departMin) ? `, leaves ${fmtClock(c.departMin)}` : ''}${c.road && c.road.name ? `, on ${c.road.name}` : ''}` : null,
    n.age >= 25 ? `  Education: ${n.education}` : null,
    `  Marital: ${n.marital}${n.veteran ? ' · veteran' : ''}`,
  ];
  return lines.filter(Boolean).join('\n');
}

function personaText(p) {
  const b = p.big5;
  const out = [
    `${name(p.npc)} (${p.id}): ${p.archetype}`,
    `  ${p.bio}`,
    `  Big Five: O ${b.O.toFixed(2)} · C ${b.C.toFixed(2)} · E ${b.E.toFixed(2)} · A ${b.A.toFixed(2)} · N ${b.N.toFixed(2)}`,
    `  Traits: ${p.traits.join(', ')} · Values: ${p.values.join(', ')}`,
    `  Interests: ${p.interests.join(', ')}`,
    '  Concerns:',
    ...p.concerns.slice(0, 6).map(c => `    ${c.topic} (${Math.round(c.weight * 100)}): ${c.why}`),
    '  Memories:',
    ...p.memories.slice(0, 8).map(m => `    ${m.year}: ${m.text}`),
    `  Speech: ${p.speech.dialect} dialect, ${p.speech.register} register${p.speech.codeSwitch ? `, mixes in ${p.speech.codeSwitch.lang} (${Math.round(p.speech.codeSwitch.rate * 100)}%)` : ''}`,
    p.hooks.length ? `  Would bring up: ${p.hooks.slice(0, 4).join('; ')}` : null,
  ];
  return out.filter(Boolean).join('\n');
}

function planText(npc, plan) {
  const p = pacific(plan[0].start);
  const rows = plan.map(it => `  ${fmtClock(it.startMin).padStart(8)} – ${fmtClock(it.endMin % 1440).padStart(8)}  ${it.kind.padEnd(8)} ${it.travel && it.mode ? `${it.mode.padEnd(9)}` : ''.padEnd(9)} ${it.label || (it.place && it.place.label) || ''}`.trimEnd());
  return [`${name(npc)} (${npc.id}) on ${p.dayName}, ${p.monthName} ${p.day}, ${p.year}:`, ...rows].join('\n');
}

function statsText(v) {
  const s = v.scalars;
  const row = (label, x, f) => `  ${label.padEnd(22)} ${f(x.acs).padStart(9)} ${f(x.generated).padStart(11)}`;
  const out = [
    `${v.zip} ${v.city}: ${v.households.toLocaleString('en-US')} households, ${v.persons.toLocaleString('en-US')} people generated${v.gq && v.gq.persons ? ` (${v.gq.persons.toLocaleString('en-US')} in group quarters are not in households)` : ''}`,
    `  ${''.padEnd(22)} ${'Census'.padStart(9)} ${'Generated'.padStart(11)}`,
    row('Household size', s.hhsize, x => x.toFixed(2)), row('Median age', s.medianAge, x => x.toFixed(1)),
    row('Under 18', s.under18, pct), row('65 and over', s.over65, pct), row('Born abroad', s.foreign, pct), row('Owners', s.own, pct),
  ];
  for (const table of ['hht', 'race', 'lang', 'comm', 'edu']) {
    const a = v.acs[table] || {}, g = v.generated[table] || {};
    const keys = [...new Set([...Object.keys(a), ...Object.keys(g)])].sort((x, y) => (a[y] || 0) - (a[x] || 0)).slice(0, 8);
    out.push('', `  ${{ hht: 'Household type', race: 'Race and ethnicity', lang: 'Language at home', comm: 'Commute mode', edu: 'Education (25+)' }[table]}`);
    for (const k of keys) out.push(`  ${k.padEnd(22)} ${pct(a[k] || 0).padStart(9)} ${pct(g[k] || 0).padStart(11)}`);
  }
  return out.join('\n');
}

/** --date YYYY-MM-DD as noon Pacific of that day (a day that does not exist is refused). */
function parseDate(s) {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s));
  if (!d) throw new UsageError(`--date must be YYYY-MM-DD, not "${s}"`);
  return pacificWall(+d[1], +d[2], +d[3], 12, 0, `--date ${s}`);
}

/** Why a place gives no one to sample: "90071 has no households (its 556 residents live in group quarters)". */
function emptyScope(legion, where) {
  let r = null;
  try { r = legion.resolve(where); } catch { r = null; }
  const zis = r && Array.isArray(r.zis) ? r.zis : [];
  const z = legion.world.z;
  const pop = zis.reduce((a, i) => a + (z.pop[i] || 0), 0);
  const title = (r && r.title) || where;
  return pop > 0 ? `${title} has no households (its ${pop.toLocaleString('en-US')} residents live in group quarters, which Legion does not generate)` : `${title} has no households and no residents in the data`;
}

/** Print a value: JSON (pretty for one value) under --json, else the human text. */
function emit(io, json, value, text) {
  io.out(json ? JSON.stringify(value, null, 2) : text);
}

/** Errors after which a Claude conversation cannot go on (the key, the account, the setup), as VoiceError codes. */
const FATAL_VOICE = new Set(['no_key', 'config', 'auth', 'permission', 'billing']);

/** A VoiceError (or any error) as what the player reads: the no-credential case says how to set one up. */
function voiceErrorText(e) {
  const msg = String((e && e.message) || e || 'unknown error');
  if ((e && e.code === 'no_key') || /could not resolve authentication method|apiKey|authToken/i.test(msg)) {
    return 'Claude needs a credential: set ANTHROPIC_API_KEY, sign in with `ant auth login`, or pass --proxy http://127.0.0.1:8787/api/anthropic (a running node server/serve.mjs).';
  }
  return msg;
}

/**
 * The talk command. Resolves with the exit code: 0, or 1 when the mind could not be saved to --store or Claude
 * could not be used at all (no credential, a rejected key).
 */
async function talk(legion, id, opts, io) {
  const npc = legion.npc(id);
  if (!npc) throw new Error(`No NPC has the id ${id}`);
  const t = opts.t;
  const first = (npc.name && npc.name.first) || name(npc);
  const json = opts.json;
  const say = (who, line) => {
    if (json) { io.out(JSON.stringify({ who, ...line })); return; }
    io.out(`${who === 'npc' ? first : 'You'}: ${line.text}${line.gloss ? `\n${' '.repeat(first.length + 2)}[${line.gloss}]` : ''}`);
  };
  // what Legion itself says (where to find help, a failed request): a note on stderr, never in the NPC's voice
  const note = text => { if (json) io.out(JSON.stringify({ who: 'legion', text })); else io.err(`(Legion) ${text}`); };
  const interactive = !!(process.stdin.isTTY && process.stdout.isTTY);
  const rl = readline.createInterface({ input: process.stdin, output: interactive ? process.stdout : undefined, terminal: interactive });
  if (interactive) rl.setPrompt('> ');
  const done = new Set(['/bye', '/quit', '/exit', 'bye!']);
  // piped input is not on the screen: echo it, so the output reads as a conversation
  const echo = text => { if (json) io.out(JSON.stringify({ who: 'player', text })); else if (!interactive) io.out(`You: ${text}`); };
  let code = 0;
  const save = () => {
    if (legion.saveMind(npc.id) || !opts.store) return;
    note(`Could not save ${first}'s mind to ${opts.store}.`);
    code = 1;
  };

  if (!opts.claude) {
    if (!json) io.err(`Talking with ${name(npc)} (${npc.id}) offline, at ${fmtTime(t)} PT. Type /bye to leave.`);
    const conv = legion.conversation(npc.id, { t });
    say('npc', conv.greet());
    let ended = false;
    if (interactive) rl.prompt();
    for await (const raw of rl) {
      const text = raw.trim();
      if (!text) { if (interactive) rl.prompt(); continue; }
      if (done.has(text.toLowerCase())) break;
      echo(text);
      let line = null;
      try { line = conv.reply(text); } catch (e) { note(`The dialogue engine failed on that line: ${e && e.message ? e.message : e}`); if (interactive) rl.prompt(); continue; }
      say('npc', line);
      // a line that steps out of the scene carries Legion's note (988, 911); a line the NPC will not answer ends it
      if (line && line.note) note(line.note);
      if ((line && line.ended === true) || conv.ended === true) { ended = true; if (!json) io.err(`(${first} has left the conversation.)`); break; }
      if (interactive) rl.prompt();
    }
    if (ended) { try { conv.farewell(); } catch { /* the mind keeps what it heard */ } }
    else say('npc', conv.farewell());
    try { legion.mind(npc.id).reflect(t); } catch { /* reflection is a bonus */ }
    save();
    rl.close();
    return code;
  }

  const voice = legion.voice({ model: opts.model || undefined, effort: opts.effort || undefined, proxyURL: opts.proxy || undefined });
  if (!json) io.err(`Talking with ${name(npc)} (${npc.id}) through ${voice.model}${opts.proxy ? ` via ${opts.proxy}` : ''}, at ${fmtTime(t)} PT. Type /bye to leave.`);
  const history = new History();
  const persona = legion.persona(npc.id, { t });
  let turns = 0;
  if (interactive) rl.prompt();
  for await (const raw of rl) {
    const text = raw.trim();
    if (!text) { if (interactive) rl.prompt(); continue; }
    if (done.has(text.toLowerCase())) break;
    echo(text);
    const mind = legion.mind(npc.id, { t });
    try { mind.observe({ kind: 'utterance', from: 'player', text, t }); } catch { /* the reply matters more than the memory */ }
    // the NPC's name goes out with the first words of the reply, not before a request that may fail
    let started = false;
    const onText = json ? undefined : delta => { if (!started) { started = true; process.stdout.write(`${first}: `); } process.stdout.write(delta); };
    let r;
    try {
      r = await voice.stream(persona, mind, history, text, { t, weather: legion.weather(npc.zi, t), activity: legion.activityAt(npc.id, t), onText });
    } catch (e) {
      if (started) process.stdout.write('\n');
      note(voiceErrorText(e));
      // a turn that failed for a moment (connection, rate limit, overload) or a line refused: the conversation goes on;
      // a missing or rejected credential ends it
      if (FATAL_VOICE.has(e && e.code) || /could not resolve authentication method/i.test(String(e && e.message))) { code = 1; break; }
      if (interactive) rl.prompt();
      continue;
    }
    if (r.refusal) { if (started) process.stdout.write('\n'); note(r.refusal.message); }
    else if (r.text) {
      turns++;
      try { mind.observe({ kind: 'utterance', from: 'self', text: r.text, t }); } catch { /* as above */ }
      if (json) io.out(JSON.stringify({ who: 'npc', text: r.text, model: r.model, stopReason: r.stopReason, usage: r.usage }));
      else process.stdout.write(started ? '\n' : `${first}: ${r.text}\n`);
    } else if (started) process.stdout.write('\n');
    const crisis = crisisNote(text, { age: npc.age });
    if (crisis) note(crisis);
    save();
    if (interactive) rl.prompt();
  }
  rl.close();
  if (turns) {
    try {
      const reflection = await legion.reflect(npc.id, voice, history, { t });
      if (json) io.out(JSON.stringify({ who: 'reflection', ...reflection }));
      else io.err(`(${first} remembers: ${reflection.summary})`);
    } catch (e) { note(`The conversation could not be saved to memory: ${e.message}`); }
  }
  save();
  return code;
}

/**
 * Run the CLI with argv (process.argv.slice(2)); resolves with the exit code. io.out / io.err print lines.
 * @param {string[]} argv
 * @param {{out?: (s: string) => void, err?: (s: string) => void}} [io]
 * @returns {Promise<number>}
 */
export async function main(argv, io = {}) {
  const out = io.out || (s => process.stdout.write(`${s}\n`));
  const err = io.err || (s => process.stderr.write(`${s}\n`));
  const IO = { out, err };
  let parsed;
  try { parsed = parseArgs({ args: argv, options: OPTIONS, allowPositionals: true, strict: true }); } catch (e) { err(`${e.message}\n\n${usage()}`); return 2; }
  const { values: v, positionals: pos } = parsed;
  const [cmd, ...rest] = pos;
  if (v.help || !cmd || cmd === 'help') { out(usage()); return v.help || cmd === 'help' ? 0 : 2; }
  if (!COMMANDS[cmd]) { err(`Unknown command "${cmd}".\n\n${usage()}`); return 2; }
  try {
    const seed = parseSeed(v.seed);
    const t0 = parseTime(v.t);
    if (v.date !== undefined) parseDate(v.date);
    const store = v.store ? await openStore(v.store) : undefined;
    const legion = await createLegion({ ...(seed !== undefined ? { seed } : {}), ...(store ? { store } : {}) });
    const t = t0 ?? legion.t;
    const need = (k, label) => { if (rest[k] === undefined) throw new UsageError(`${cmd} needs ${label}: node cli/legion.mjs ${cmd} ${COMMANDS[cmd].args}`); return rest[k]; };
    const npcOf = id => { const n = legion.npc(id); if (!n) throw new Error(`No NPC has the id ${id} (ids look like 94110-123-0)`); return n; };
    switch (cmd) {
      case 'sample': {
        const where = need(0, 'a place');
        const n = rest[1] === undefined ? 10 : Number(rest[1]);
        if (!Number.isInteger(n) || n < 0) throw new UsageError(`n must be a whole number, not "${rest[1]}"`);
        const people = legion.sample(where, n);
        if (n > 0 && !people.length) throw new Error(emptyScope(legion, where));
        emit(IO, v.json, people, people.map(npcLine).join('\n'));
        return 0;
      }
      case 'npc': { const n = npcOf(need(0, 'an id')); emit(IO, v.json, n, npcText(n)); return 0; }
      case 'persona': {
        const p = legion.persona(npcOf(need(0, 'an id')).id, { t });
        const { npc: _npc, ...rest2 } = p;
        emit(IO, v.json, { npc: p.npc.id, ...rest2 }, personaText(p));
        return 0;
      }
      case 'prompt': {
        const r = legion.prompt(npcOf(need(0, 'an id')).id, { t });
        emit(IO, v.json, r, `${r.blocks.map((b, k) => `=== system block ${k + 1}${b.cache_control ? ' (cache breakpoint)' : ''} ===\n${b.text}`).join('\n\n')}\n\n=== situation message (after each player message) ===\n${r.situation}`);
        return 0;
      }
      case 'plan': {
        const n = npcOf(need(0, 'an id'));
        const when = v.date ? parseDate(v.date) : t;
        const plan = legion.dayPlan(n.id, when);
        emit(IO, v.json, plan, planText(n, plan));
        return 0;
      }
      case 'talk': {
        const id = npcOf(need(0, 'an id')).id;
        checkVoiceOptions(v);
        return await talk(legion, id, { t, json: v.json, claude: v.claude, model: v.model, effort: v.effort, proxy: v.proxy, store: v.store }, IO);
      }
      case 'export': {
        const where = need(0, 'a place'), n = Number(need(1, 'a count'));
        if (!Number.isInteger(n) || n < 0) throw new UsageError(`n must be a whole number, not "${rest[1]}"`);
        checkVoiceOptions(v);
        const sampled = legion.sample(where, n);
        if (n > 0 && !sampled.length) throw new Error(emptyScope(legion, where));
        const personas = sampled.map(x => legion.persona(x.id, { t }));
        const text = exportJSONL(personas, legion.world, { model: v.model, effort: v.effort }).replace(/\n$/, '');
        if (text) out(text);
        return 0;
      }
      case 'stats': {
        const zip = need(0, 'a ZIP');
        const zi = legion.world.indexOf(zip);
        if (zi < 0) throw new Error(`Unknown ZIP "${zip}"`);
        const households = v.households === undefined ? 2000 : Number(v.households);
        if (!Number.isInteger(households) || households < 1) throw new UsageError('--households must be a positive whole number');
        const r = legion.population.validate(zi, households);
        emit(IO, v.json, r, statsText(r));
        return 0;
      }
      default: return 2;
    }
  } catch (e) {
    if (e instanceof UsageError) { err(e.message); return 2; }
    err(e && e.message ? e.message : String(e));
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(code => { process.exitCode = code; }, e => { process.stderr.write(`${e && e.stack ? e.stack : e}\n`); process.exitCode = 1; });
}
