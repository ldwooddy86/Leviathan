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
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { createLegion } from '../src/engine/platform.mjs';
import { FileStore } from '../src/engine/mind.mjs';
import { History, MODELS, EFFORTS, DEFAULTS, exportJSONL } from '../src/engine/llm.mjs';
import { atPacific, fmtClock, fmtTime, pacific } from '../src/engine/clock.mjs';

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

/** The simulated time from --t: ISO with a zone, a Pacific wall time, 'now', epoch ms; null when absent. */
export function parseTime(s) {
  if (s === undefined || s === null || s === '') return null;
  const v = String(s).trim();
  if (v === 'now') return Date.now();
  if (/^\d{10,}$/.test(v)) return Number(v);
  const wall = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?$/.exec(v);
  if (wall) return atPacific(+wall[1], +wall[2], +wall[3], wall[4] ? +wall[4] : 12, wall[5] ? +wall[5] : 0);
  const ms = Date.parse(v);
  if (Number.isFinite(ms)) return ms;
  throw new UsageError(`--t "${v}" is not a time: use an ISO time with a zone, a Pacific YYYY-MM-DDTHH:MM, or now`);
}

const money = n => (Number.isFinite(n) ? `$${Math.round(n).toLocaleString('en-US')}` : '—');
const DWELLING = { house: 'house', 'small-apartment': 'unit in a small building', apartment: 'apartment', 'mobile-home': 'mobile home' };
const withArticle = w => `${/^[aeiou]/i.test(w) ? 'an' : 'a'} ${w}`;
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
    ...((hh.members || []).filter(m => m.m !== n.m).map(m => `    ${m.role}: ${m.name}, ${m.age}`)),
    `  Languages: ${l.home || 'english'} at home${l.english && l.english !== 'only' ? ` (English: ${l.english})` : ''}`,
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

/** Print a value: JSON (pretty for one value) under --json, else the human text. */
function emit(io, json, value, text) {
  io.out(json ? JSON.stringify(value, null, 2) : text);
}

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
  const interactive = !!(process.stdin.isTTY && process.stdout.isTTY);
  const rl = readline.createInterface({ input: process.stdin, output: interactive ? process.stdout : undefined, terminal: interactive });
  if (interactive) rl.setPrompt('> ');
  const done = new Set(['/bye', '/quit', '/exit', 'bye!']);
  // piped input is not on the screen: echo it, so the output reads as a conversation
  const echo = text => { if (json) io.out(JSON.stringify({ who: 'player', text })); else if (!interactive) io.out(`You: ${text}`); };

  if (!opts.claude) {
    if (!json) io.err(`Talking with ${name(npc)} (${npc.id}) offline, at ${fmtTime(t)} PT. Type /bye to leave.`);
    const conv = legion.conversation(npc.id, { t });
    say('npc', conv.greet());
    if (interactive) rl.prompt();
    for await (const raw of rl) {
      const text = raw.trim();
      if (!text) { if (interactive) rl.prompt(); continue; }
      if (done.has(text.toLowerCase())) break;
      echo(text);
      say('npc', conv.reply(text));
      if (interactive) rl.prompt();
    }
    say('npc', conv.farewell());
    legion.mind(npc.id).reflect(t);
    legion.saveMind(npc.id);
    rl.close();
    return;
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
    mind.observe({ kind: 'utterance', from: 'player', text, t });
    if (!json) process.stdout.write(`${first}: `);
    let r;
    try {
      r = await voice.stream(persona, mind, history, text, {
        t, weather: legion.weather(npc.zi, t), activity: legion.activityAt(npc.id, t),
        onText: json ? undefined : delta => process.stdout.write(delta),
      });
    } catch (e) {
      if (!json) process.stdout.write('\n');
      rl.close();
      throw e;
    }
    if (r.refusal) { if (!json) process.stdout.write('\n'); io.err(`(Legion) ${r.refusal.message}`); }
    else if (r.text) {
      turns++;
      mind.observe({ kind: 'utterance', from: 'self', text: r.text, t });
      if (json) io.out(JSON.stringify({ who: 'npc', text: r.text, model: r.model, stopReason: r.stopReason, usage: r.usage }));
      else process.stdout.write('\n');
    } else if (!json) process.stdout.write('\n');
    legion.saveMind(npc.id);
    if (interactive) rl.prompt();
  }
  rl.close();
  if (turns) {
    try {
      const reflection = await legion.reflect(npc.id, voice, history, { t });
      if (json) io.out(JSON.stringify({ who: 'reflection', ...reflection }));
      else io.err(`(${first} remembers: ${reflection.summary})`);
    } catch (e) { io.err(`(Legion) The conversation could not be saved to memory: ${e.message}`); }
  }
  legion.saveMind(npc.id);
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
    const seed = v.seed === undefined ? undefined : Number(v.seed);
    if (v.seed !== undefined && !Number.isInteger(seed)) throw new UsageError(`--seed must be an integer, not "${v.seed}"`);
    const store = v.store ? new FileStore(path.resolve(v.store)) : undefined;
    const legion = await createLegion({ ...(seed !== undefined ? { seed } : {}), ...(store ? { store } : {}) });
    const t = parseTime(v.t) ?? legion.t;
    const need = (k, label) => { if (rest[k] === undefined) throw new UsageError(`${cmd} needs ${label}: node cli/legion.mjs ${cmd} ${COMMANDS[cmd].args}`); return rest[k]; };
    const npcOf = id => { const n = legion.npc(id); if (!n) throw new Error(`No NPC has the id ${id} (ids look like 94110-123-0)`); return n; };
    switch (cmd) {
      case 'sample': {
        const where = need(0, 'a place');
        const n = rest[1] === undefined ? 10 : Number(rest[1]);
        if (!Number.isInteger(n) || n < 0) throw new UsageError(`n must be a whole number, not "${rest[1]}"`);
        const people = legion.sample(where, n);
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
        let when = t;
        if (v.date) {
          const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.date);
          if (!d) throw new UsageError(`--date must be YYYY-MM-DD, not "${v.date}"`);
          when = atPacific(+d[1], +d[2], +d[3], 12, 0);
        }
        const plan = legion.dayPlan(n.id, when);
        emit(IO, v.json, plan, planText(n, plan));
        return 0;
      }
      case 'talk': {
        const id = npcOf(need(0, 'an id')).id;
        if (v.model && !MODELS.some(m => m.id === v.model)) throw new UsageError(`--model must be one of ${MODELS.map(m => m.id).join(', ')}`);
        if (v.effort && !EFFORTS.includes(v.effort)) throw new UsageError(`--effort must be one of ${EFFORTS.join(', ')}`);
        await talk(legion, id, { t, json: v.json, claude: v.claude, model: v.model, effort: v.effort, proxy: v.proxy }, IO);
        return 0;
      }
      case 'export': {
        const where = need(0, 'a place'), n = Number(need(1, 'a count'));
        if (!Number.isInteger(n) || n < 0) throw new UsageError(`n must be a whole number, not "${rest[1]}"`);
        const personas = legion.sample(where, n).map(x => legion.persona(x.id, { t }));
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
