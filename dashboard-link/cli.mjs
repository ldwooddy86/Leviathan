#!/usr/bin/env node
/* The dashboard link: how Leviathan's agents connect to a dashboard. Node 22, no packages.

   node dashboard-link/cli.mjs <command>

     connect <atlas.html> [--id dfw] [--no-live] [--no-copy]
                              read a Thermal Debt atlas once for both agents: the packs each works from, this client's
                              model and brand (kept outside the repository), and what the running dashboard computes
     status                   what is connected, what each agent can do with it, and anything out of step
     doors                    what the dashboard takes in and gives out with its own controls
     check <file>             hand a file to the real dashboard, headless, through its own control, and report what it
                              made of it: a plan goes through the Campaign Desk's Load button, pages through the Publish
                              import box. Add --files <folder> to keep the desk's own bulk files for the plan.
     heat [--budget n] [--month 1..12] [--lsa]
                              the Heat Desk's plan and its reading of the week, from the running dashboard
     read <file>              what a file saved from the dashboard holds: a desk plan, the competitor ledger, account results

   Add --json for machine output. The paid ads and content strategist command lines take connect and dashboard too.
   A browser is needed for check and heat (Playwright with Chromium); connect uses one when it is there. */
import fs from 'node:fs';
import path from 'node:path';
import { connect, status, requireConnection, atlasFile, NotConnected } from './lib/connect.mjs';
import * as live from './lib/live.mjs';
import { readFile, ledger, actuals } from './lib/handoff.mjs';
import { connectText, statusText, deskCheckText, publishCheckText, heatText } from './lib/report.mjs';
import { outside, rel } from './lib/paths.mjs';

const BOOL = new Set(['json', 'no-live', 'no-copy', 'lsa', 'help']);
function args(argv) { const o = { _: [] }; for (let i = 0; i < argv.length; i++) { const a = argv[i]; if (a.startsWith('--')) { const k = a.slice(2); if (BOOL.has(k) || i + 1 >= argv.length || argv[i + 1].startsWith('--')) o[k] = true; else o[k] = argv[++i]; } else o._.push(a); } return o; }
const A = args(process.argv.slice(2)), cmd = A._.shift() || 'help';
const out = (v, text) => console.log(A.json ? JSON.stringify(v, null, 1) : text);
const die = (msg, code = 2) => { console.error(msg); process.exit(code); };

/* shared with the two agents' command lines */
export async function runConnect(file, o = {}) { const c = await connect(file, o); return { value: c, text: connectText(c) }; }
export function runStatus() { const s = status(); return { value: s, text: statusText(s) }; }
/* the dashboard file the checks run, or a reason there is none */
export async function liveFile() {
  requireConnection(); const f = atlasFile(); if (!f) throw new Error('The connected dashboard file is gone from this machine. Connect it again.');
  const av = await live.available(); if (!av.ok) throw new live.Unavailable('This needs to run the dashboard, and no browser is available here: ' + av.why);
  return f;
}
/* hands a file to the running dashboard through the control a person would use */
export async function runCheck(file, { filesTo = '' } = {}) {
  const { kind } = readFile(file), atlas = await liveFile();
  if (kind === 'desk-plan') {
    const d = await live.withDashboard(atlas, s => live.desk(s, file, { files: !!filesTo }));
    if (filesTo && d.files) { const dir = outside(filesTo, 'The folder for the desk\'s files'); fs.mkdirSync(dir, { recursive: true }); for (const f of d.files) fs.writeFileSync(path.join(dir, path.basename(f.name)), f.text); d.filesDir = dir; }
    return { kind, value: d, ok: d.accepted, text: deskCheckText(d) + (d.filesDir ? `\n  Saved to ${rel(d.filesDir)}` : '') };
  }
  if (kind === 'pages') { const r = await live.withDashboard(atlas, s => live.publish(s, file)); return { kind, value: r, ok: r.accepted, text: publishCheckText(r) }; }
  throw new Error(`${file} is not a file the dashboard takes: a Campaign Desk plan (line, budget, start, ...) or a pages file (a "pages" list of blueprints).`);
}
export async function runHeat(settings) { const atlas = await liveFile(); const h = await live.withDashboard(atlas, s => live.heat(s, settings)); return { value: h, text: heatText(h) }; }

/* what a file saved from the dashboard holds */
export function runRead(f) {
  const { kind, value } = readFile(f);
  if (kind === 'ledger') { const L = ledger(value); return { kind, value: L, text: [`Competitor ledger${L.exported ? ', exported ' + L.exported : ''}: ${L.entries} entries (${L.seeded} seeded from website intel, ${L.logged} logged), ${L.liveAds} live ads on record.`, L.byCompany.length ? '  Live ads by company: ' + L.byCompany.slice(0, 12).map(x => `${x.k} ${x.n}`).join(', ') : '  No live ads are logged. That is a gap in the log, not proof that nobody is advertising.', L.prices.length ? '  Prices on record: ' + L.prices.slice(0, 15).map(x => `${x.company} $${x.price}${x.line ? ' ' + x.line : ''}`).join('; ') : '', L.financing.length ? '  Financing offers: ' + L.financing.slice(0, 10).map(x => `${x.company}: ${x.financing || x.text}`).join('; ') : ''].filter(Boolean).join('\n') }; }
  if (kind === 'actuals') { const R = actuals(value); return { kind, value: R, text: [`Account results${R.exported ? ', exported ' + R.exported : ''}: ${R.rowsRead} rows from ${R.from || '?'} to ${R.to || '?'} (last ${R.days} days).`, ...R.rows.map(r => `  ${r.line.padEnd(12)} ${r.platform.padEnd(11)} $${String(Math.round(r.spend)).padStart(7)}  ${String(r.clicks).padStart(6)} clicks  ${String(r.leads + r.calls).padStart(5)} leads and calls  CPC ${r.cpc ?? 'n/a'}  CPL ${r.cpl ?? 'n/a'}  ${r.thin ? '(thin: do not plan on it yet)' : ''}`), R.unmapped ? `  $${Math.round(R.unmapped)} sits in campaigns the dashboard could not map to a service line. Name campaigns DFW_<LINE>_... so it can.` : ''].filter(Boolean).join('\n') }; }
  if (kind === 'desk-plan') return { kind, value, text: `A Campaign Desk plan: line ${value.line}, $${value.budget} a month, ${value.weeks} weeks from ${value.start}, scope ${value.scope}${Array.isArray(value.picks) && value.picks.length ? ', ' + value.picks.length + (value.picks.length === 1 ? ' ZIP picked' : ' ZIPs picked') : ''}${value.handoff ? `. Made by ${value.handoff.agent} on ${String(value.handoff.made).slice(0, 10)}.` : '. Saved from the dashboard.'}` };
  if (kind === 'pages') { const n = Array.isArray(value.pages) ? value.pages.length : 1; return { kind, value, text: `A pages file with ${n} page${n === 1 ? '' : 's'} for the Publish module.` }; }
  throw new Error(`${f} is not a file this link knows: a desk plan, a pages file, the competitor ledger (JSON export) or account results (actuals.json).`);
}

const C = {
  help() { console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('*/')[0].replace(/^#!.*\n\/\* ?/, '')); },
  async connect() { const f = A._[0] || die('connect <atlas.html> [--id dfw] [--no-live] [--no-copy]'); const r = await runConnect(f, { id: A.id && A.id !== true ? A.id : undefined, live: A['no-live'] ? false : 'auto', copy: !A['no-copy'] }); out(r.value, r.text); },
  status() { const r = runStatus(); out(r.value, r.text); if (r.value.connected && r.value.problems.length) process.exitCode = 1; },
  doors() { const s = requireConnection(); out(s.connection.doors, s.connection.doors.map(d => `${d.dir === 'in' ? 'in ' : 'out'}  ${d.what}\n     ${d.how}`).join('\n')); },
  async check() { const f = A._[0] || die('check <campaign-desk-plan.json | pages.json> [--files folder]'); const r = await runCheck(f, { filesTo: A.files && A.files !== true ? A.files : '' }); out(r.value, r.text); if (!r.ok) process.exitCode = 1; },
  async heat() { const P = {}; if (A.budget && A.budget !== true) P.budget = +A.budget; if (A.month && A.month !== true) P.month = +A.month - 1; if (A.lsa) P.lsaLive = true; const r = await runHeat(P); out(r.value, r.text); },
  read() { const f = A._[0] || die('read <file saved from the dashboard>'); const r = runRead(f); out(r.value, r.text); },
};

const direct = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (direct) {
  if (A.help || !C[cmd]) { C.help(); if (!C[cmd] && cmd !== 'help') process.exitCode = 2; }
  else Promise.resolve().then(() => C[cmd]()).then(() => { if (process.exitCode == null) process.exitCode = 0; }).catch(e => { console.error(e instanceof NotConnected || e instanceof live.Unavailable ? e.message : (process.env.LV_DEBUG && e && e.stack) || 'Error: ' + (e && e.message ? e.message : e)); process.exit(e instanceof live.Unavailable ? 3 : 2); });
}
