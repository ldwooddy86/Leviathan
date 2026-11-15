/* The Agent Desk: one place inside the dashboard where both agents' work arrives.

   The link's other doors add nothing to a dashboard: they hand a file to a control the build already has. This is the one
   thing that is added, and it is added to a copy. The dashboard file a person connected is never written to; the copy is
   that file with one block put in front of its shell script:

     <!-- leviathan:agent-desk:start ... -->
     <style id="lvp-repairs">          panel/atlas-repairs.css: repairs to the layout of the dashboard's own modules
     <script id="lvp-repairs-js">      panel/atlas-repairs.js: the one repair a style sheet cannot make (chart labels)
     <style id="lvp-style">            the module's styles, scoped under .lvp, drawn with the dashboard's own tokens
     <script type="application/json" id="lvp-data">   the hand-offs put in the file, as data
     <script>                          panel/agent-desk.js: a module registered the way the dashboard's own are
     <!-- leviathan:agent-desk:end -->

   The dashboard builds its rail from whatever modules are registered when its shell runs, so the Agent Desk appears as
   the next numbered module and everything else is as it was. Take the block out and the file is the original, byte for
   byte: stripPanel(installPanel(x)) === x. connect() strips it first, so a copy with the Agent Desk in it connects as the
   same dashboard.

   The repairs fix places where the dashboard's own text and controls overlap, crowd or spill (lib/layout.mjs finds
   them). They ride in the same block, so they too are only ever in the copy and come out with it, and they can be left
   out: refresh() remembers the choice beside the connection.

   A hand-off is a bundle: what an agent built, in one JSON object (the plan the Campaign Desk loads, the specialist's own
   copy, the claims waiting on the owner, the gate's findings and the bulk files; or the pages for Publish with what the
   gate measured). Each agent writes its bundle beside its other files as handoff.json and registers it here, outside the
   repository; refresh() writes the copy of the connected dashboard with the registered bundles in it. */
import fs from 'node:fs';
import path from 'node:path';
import { HERE, LINK, outside, readJson, writeJson } from './paths.mjs';

export const PANEL = 2;
export const BUNDLE = 'leviathan.handoff.bundle';
export const ANSWERS = 'leviathan.owner-answers';
const SRC = path.join(HERE, 'panel');
const START = '<!-- leviathan:agent-desk:start', END = '<!-- leviathan:agent-desk:end -->';
const BOOT = '(function boot() {', RAIL = 'rail.innerHTML = MODS.map';

export class NoSeam extends Error { }

/* ---------- the block ---------- */
export const hasPanel = text => String(text).includes(START);
/* the file without the Agent Desk: exactly what it was before installPanel */
export function stripPanel(text) {
  let out = String(text);
  for (;;) {
    const a = out.indexOf(START); if (a < 0) return out;
    const b = out.indexOf(END, a); if (b < 0) throw new Error('This file holds the start of an Agent Desk block and no end of one. It was cut short or edited by hand: go back to the dashboard file as it was delivered.');
    let e = b + END.length; if (out[e] === '\n') e++;
    out = out.slice(0, a) + out.slice(e);
  }
}
/* Where a module's script must go: before the script that builds the rail from the registered modules. A file with no
   such script is not a build this panel knows how to join, and is left alone. */
function seam(text) {
  const boot = text.indexOf(BOOT);
  if (boot < 0 || text.indexOf(BOOT, boot + 1) >= 0 || !text.includes('function registerModule(')) throw new NoSeam('This dashboard file has no module shell this panel knows (no single boot script that builds the rail from registered modules), so the Agent Desk cannot be added to it. Nothing was written.');
  const rail = text.indexOf(RAIL, boot), s = text.lastIndexOf('<script', boot);
  if (rail < 0 || rail - boot > 4000 || s < 0 || text.slice(s, boot).includes('</script>')) throw new NoSeam('This dashboard file\'s shell does not build its rail the way this panel expects, so the Agent Desk cannot be added to it. Nothing was written.');
  /* the comment that introduces the shell stays with it */
  const c = text.lastIndexOf('<!--', s);
  return c >= 0 && /^<!--(?:(?!-->)[\s\S])*-->\s*$/.test(text.slice(c, s)) ? c : s;
}
/* can the Agent Desk be added to this dashboard text? {ok, why} */
export function joins(text) { try { seam(stripPanel(text)); return { ok: true, why: '' }; } catch (e) { return { ok: false, why: e.message }; } }
const source = name => fs.readFileSync(path.join(SRC, name), 'utf8');
/* JSON that is safe inside a script element: no "<" is left to open a tag or a comment */
const dataText = v => JSON.stringify(v).replace(/</g, '\\u003c');
/* The dashboard text with the Agent Desk in it. bundles: the hand-offs to put in the file. atlas: {name, build, sha256}
   of the dashboard the block goes into, so the panel can tell a hand-off made for another file. A file that already has
   the block gets a fresh one, never two. */
export function installPanel(text, { bundles = [], atlas = null, at = new Date().toISOString(), repairs = true } = {}) {
  const clean = stripPanel(text), i = seam(clean), js = source('agent-desk.js'), css = source('agent-desk.css'), rcss = repairs ? source('atlas-repairs.css') : '', rjs = repairs ? source('atlas-repairs.js') : '';
  for (const [name, t] of [['agent-desk.js', js], ['atlas-repairs.js', rjs]]) if (/<\/script/i.test(t) || t.includes('<!--')) throw new Error(`panel/${name} holds a closing script tag or an HTML comment, which would end its script block early.`);
  for (const [name, t] of [['agent-desk.css', css], ['atlas-repairs.css', rcss]]) if (/<\/style/i.test(t)) throw new Error(`panel/${name} holds a closing style tag.`);
  const bad = bundles.filter(b => !isBundle(b)); if (bad.length) throw new Error(`${bad.length} of the hand-offs given ${bad.length === 1 ? 'is' : 'are'} not a hand-off bundle.`);
  const block = `${START} v${PANEL} · the Agent Desk, a module added by Leviathan's dashboard link${repairs ? ', with repairs to the layout of the dashboard\'s own modules' : ''}. Everything outside this block is the dashboard as it was delivered; take the block out, through the end marker, and the file is the original. -->\n`
    + (repairs ? `<style id="lvp-repairs">\n${rcss}</style>\n<script id="lvp-repairs-js">\n${rjs}</script>\n` : '')
    + `<style id="lvp-style">\n${css}</style>\n`
    + `<script type="application/json" id="lvp-data">${dataText({ v: PANEL, installed: at, atlas, repairs: !!repairs, bundles })}</script>\n`
    + `<script>\n${js}</script>\n${END}`;
  return clean.slice(0, i) + block + '\n' + clean.slice(i);
}
/* does a file carry the layout repairs? */
export const hasRepairs = text => String(text).includes('<style id="lvp-repairs">');
/* what a file with the Agent Desk in it carries: {v, installed, atlas, repairs, bundles} or null */
export function embeddedData(text) {
  const m = /<script type="application\/json" id="lvp-data">([\s\S]*?)<\/script>/.exec(String(text)); if (!m) return null;
  try { const d = JSON.parse(m[1]); return d && typeof d === 'object' ? Object.assign(d, { bundles: (Array.isArray(d.bundles) ? d.bundles : []).filter(isBundle) }) : null; } catch { return null; }
}

/* ---------- bundles ---------- */
const isBlueprint = p => !!p && typeof p === 'object' && !!p.page && typeof p.page === 'object' && typeof p.page.slug === 'string' && Array.isArray(p.sections);
export const isBundle = o => !!o && typeof o === 'object' && o.format === BUNDLE && typeof o.id === 'string' && !!o.id
  && ((!!o.paid && typeof o.paid === 'object' && !!o.paid.plan && typeof o.paid.plan === 'object') || (!!o.content && typeof o.content === 'object' && Array.isArray(o.content.pages) && o.content.pages.some(isBlueprint)));
/* A hand-off bundle. connection is the dashboard connection it was made under; `client` and `atlas` say whose dashboard
   it belongs in, so one client's work is never put in another's file. */
export function bundle({ id, agent, title = '', connection = null, made = new Date().toISOString(), paid = null, content = null }) {
  const i = (connection && connection.identity) || {};
  const b = Object.assign({ format: BUNDLE, v: 1, id: String(id), agent, made, title, client: (connection && connection.client) || '', atlas: { name: i.atlas || '', build: i.build || null, sha256: i.sha256 ? i.sha256.slice(0, 16) : null } }, paid ? { paid } : {}, content ? { content } : {});
  if (!isBundle(b)) throw new Error('A hand-off needs an id and either a plan (paid) or at least one page (content).');
  return b;
}
/* the same hand-off without the text of its bulk files */
export const slim = b => (b.paid && Array.isArray(b.paid.files) ? Object.assign({}, b, { paid: Object.assign({}, b.paid, { files: b.paid.files.map(f => ({ name: f.name, what: f.what, text: null })) }) }) : b);

/* ---------- the registry: every hand-off made on this machine, outside the repository ---------- */
export const registry = () => path.join(LINK, 'handoffs');
const fileFor = id => path.join(registry(), (String(id).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^[-.]+|[-.]+$/g, '').slice(0, 80) || 'handoff') + '.json');
export function registerBundle(b) {
  if (!isBundle(b)) throw new Error('Not a hand-off bundle.');
  outside(registry(), 'The hand-off registry (under LEVIATHAN_DASHBOARD)');
  const f = fileFor(b.id); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(b) + '\n'); return f;
}
/* newest first; a file that is not a bundle is passed over */
export function listBundles() {
  const dir = registry(); if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const n of fs.readdirSync(dir)) { if (!n.endsWith('.json')) continue; try { const b = JSON.parse(fs.readFileSync(path.join(dir, n), 'utf8')); if (isBundle(b)) out.push(b); } catch { /* not a bundle */ } }
  return out.sort((a, b) => String(b.made).localeCompare(String(a.made)));
}
/* forgets one hand-off by id, or all of them: returns the ids forgotten. The agents' own folders are not touched. */
export function forgetBundles(which) {
  const gone = [];
  for (const b of listBundles()) { if (which !== 'all' && b.id !== which) continue; const f = fileFor(b.id); if (fs.existsSync(f)) { fs.unlinkSync(f); gone.push(b.id); } }
  return gone;
}
/* does a hand-off belong in the dashboard that is connected? The same client and the same atlas, whatever the build. */
export const belongs = (b, connection) => (b.client || '') === ((connection && connection.client) || '') && (!b.atlas || !b.atlas.name || !connection || b.atlas.name === connection.identity.atlas);

/* ---------- the copy of the dashboard with the Agent Desk in it ---------- */
export function workingName(connection) {
  const i = (connection && connection.identity) || {};
  return `${`${i.atlas || 'Dashboard'}${i.build ? ' Build ' + i.build : ''}`.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '')}_Agent_Desk.html`;
}
export const workingFile = connection => path.join(LINK, workingName(connection));
/* Writes the copy. src is the dashboard file as it was connected (the kept copy); it is read and never written. The only
   file this ever writes over is an earlier copy of its own making: a file at the target that has no Agent Desk in it is
   someone's dashboard, and is left alone. The newest hand-offs for this client go in whole until `budget` bytes of them
   are in; older ones go in without the text of their bulk files; past `max` they stay in the registry only.
   `repairs` says whether the layout repairs go in: true or false sets the choice and keeps it beside the connection, so
   that an agent writing the copy again later does as the person last asked; left out, the kept choice stands (in, at first).
   Returns {file, bytes, bundles, slimmed, leftOut, others, repairs}. */
export const settingsFile = () => path.join(LINK, 'panel.json');
export function refresh(connection, src, { out = '', budget = 4e6, max = 12, at = undefined, repairs = undefined } = {}) {
  if (!src || !fs.existsSync(src)) throw new Error('The connected dashboard file is gone from this machine. Connect it again.');
  const file = path.resolve(out || workingFile(connection)); outside(path.dirname(file), 'The folder for the dashboard copy');
  if (path.resolve(src) === file) throw new Error(`${file} is the dashboard file itself. The Agent Desk goes into a copy: give another name.`);
  if (fs.existsSync(file) && (!fs.statSync(file).isFile() || !hasPanel(fs.readFileSync(file, 'utf8')))) throw new Error(`${file} is already there and is not a copy this panel made (it has no Agent Desk in it), so it was left alone. Give another name with --out.`);
  const mine = listBundles().filter(b => belongs(b, connection)), put = [], slimmed = [], leftOut = []; let size = 0;
  for (const b of mine) {
    if (put.length >= max) { leftOut.push(b.id); continue; }
    const whole = JSON.stringify(b).length;
    if (!put.length || size + whole <= budget) { put.push(b); size += whole; } else { const s = slim(b); put.push(s); size += JSON.stringify(s).length; slimmed.push(b.id); }
  }
  const kept = readJson(settingsFile(), {}) || {}, withRepairs = typeof repairs === 'boolean' ? repairs : kept.repairs !== false;
  if (typeof repairs === 'boolean' && repairs !== (kept.repairs !== false)) writeJson(settingsFile(), Object.assign({}, kept, { repairs }));
  const i = connection.identity, text = installPanel(fs.readFileSync(src, 'utf8'), { bundles: put, atlas: { name: i.atlas || '', build: i.build || null, sha256: i.sha256 ? i.sha256.slice(0, 16) : null }, at, repairs: withRepairs });
  fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text);
  return { file, bytes: Buffer.byteLength(text), bundles: put.map(b => ({ id: b.id, agent: b.agent, title: b.title, made: b.made, kind: b.paid ? 'paid' : 'content' })), slimmed, leftOut, others: listBundles().length - mine.length, repairs: withRepairs };
}
