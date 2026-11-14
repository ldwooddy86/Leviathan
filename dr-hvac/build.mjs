/* Builds Dr. HVAC (module 19) into the DFW Thermal Debt Atlas.

     node build.mjs --html <single file dashboard.html> --app <browser app .zip or folder> --out <folder outside this repo>
       [--no-forge-fix]

   The atlas ships as two editions cut from the same sources: one HTML file with every script inline, and a browser app
   (a Manifest V3 extension) that loads the same scripts as files. This tool adds the same new files to both:
   the vendored Claude SDK, the agent (src/dr), the module (src/33_m19_drhvac.js) and its stylesheet. The module
   registers itself the way the other eighteen do, and the shell picks it up.

   One repair is made to the atlas's own code, at its owner's request (fixForge below): the Site Forge's site fields,
   which lost a change instead of saving it. --no-forge-fix leaves the forge exactly as it was. Nothing else in the
   atlas's code is rewritten.

   Every edit is anchored on text that must be found exactly once, so a dashboard this tool does not recognize fails
   loudly instead of being half patched. Running it on an already patched dashboard replaces the earlier Dr. HVAC
   blocks, so the result is the same however many times it runs.

   The built dashboard carries the client's data and names. It is written to --out, which must be outside this
   repository: the repository holds the agent's source, never a built atlas. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readZip, writeZip } from './lib/zip.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const BUILD = { n: 6, from: 5, date: 'November 14, 2026' };
export const SCRIPTS = ['vendor/anthropic-sdk.min.js', 'src/dr/00_dr_core.js', 'src/dr/01_dr_knowledge.js', 'src/dr/02_dr_llm.js', 'src/dr/03_dr_agent.js', 'src/dr/10_dr_html.js', 'src/dr/11_dr_elementor.js', 'src/dr/12_dr_wp.js', 'src/dr/13_dr_hosting.js', 'src/dr/14_dr_connector_raw.js', 'src/dr/20_dr_tools.js', 'src/dr/21_dr_tools_work.js', 'src/33_m19_drhvac.js'];
export const CSS = 'src/css/drhvac.css';
export const LICENSE = 'vendor/LICENSE-anthropic-sdk.txt';
/* Hosts the agent reaches without asking: Claude itself and the two public DNS resolvers. Every website is asked for. */
export const HOSTS = ['https://api.anthropic.com/*', 'https://cloudflare-dns.com/*', 'https://dns.google/*'];
export const OPTIONAL_HOSTS = ['https://*/*', 'http://*/*'];

const MARK = {
  css: ['<!-- drhvac:css -->', '<!-- /drhvac:css -->'],
  js: ['<!-- drhvac:js · Dr. HVAC, the web developer agent (module 19): the Claude SDK, the agent and its tools, then the module -->', '<!-- /drhvac:js -->'],
  popup: ['<!-- drhvac:popup -->', '<!-- /drhvac:popup -->'],
  popupJs: ['/* drhvac:popup */', '/* /drhvac:popup */'],
};
const SHELL = '<!-- shell boot: builds the rail and shows the module in the hash -->';
const FOOT_AT = 'once a week.</span><span>Model figures are estimates';
const FOOT_ADD = `; Build ${BUILD.n} ${BUILD.date} adds Dr. HVAC (module 19), a web developer agent that builds and changes pages, works from Elementor templates and plans hosting moves, and asks before anything reaches a site`;
const FOOT_FIX = ', and repairs the Site Forge\'s site fields, where a change used to be lost instead of saved';

export class BuildError extends Error { }
const fail = msg => { throw new BuildError(msg); };
const count = (s, a) => s.split(a).length - 1;
/* replace `anchor` (found exactly once) with `to` */
function once(s, anchor, to, what) { const n = count(s, anchor); if (n !== 1) fail(`${what}: expected its anchor once and found it ${n} times. This does not look like the Build ${BUILD.from} atlas this tool was written for.`); return s.replace(anchor, () => to); }
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const dropBetween = (s, [a, b]) => s.replace(new RegExp(reEsc(a) + '[\\s\\S]*?' + reEsc(b) + '\\n?', 'g'), '');

/* Is this code safe inside an inline script element? The HTML parser ends the element at the first closing script tag,
   and after a comment opener it treats a script opener as nested, which would swallow the real closing tag. */
export function inlineProblem(code) {
  if (/<\/script/i.test(code)) return 'it spells out a closing script tag';
  let i = 0;
  for (;;) { const a = code.indexOf('<!--', i); if (a < 0) return ''; const b = code.indexOf('-->', a + 2); if (b < 0) return 'it opens an HTML comment and never closes it'; if (/<script/i.test(code.slice(a, b))) return 'it has a script opener inside an HTML comment'; i = b + 3; }
}

/* ---------- the sources ---------- */
export function sources(root = HERE) {
  const read = f => { const p = path.join(root, f); if (!fs.existsSync(p)) fail(`missing ${f}${f.startsWith('vendor/') ? ' (npm install, then npm run vendor)' : ''}`); return fs.readFileSync(p, 'utf8'); };
  const scripts = SCRIPTS.map(f => {
    let text = read(f).replace(/\r\n/g, '\n'); const bad = inlineProblem(text); if (bad) fail(`${f} cannot be inlined: ${bad}`);
    if (!text.startsWith('/* ==== ')) text = `/* ==== ${f} ==== */\n` + text;
    const app = f.startsWith('vendor/') ? 'js/' + f : f.startsWith('src/dr/') ? 'js/dr/' + path.basename(f) : 'js/' + path.basename(f);
    return { file: f, app, text: text.endsWith('\n') ? text : text + '\n' };
  });
  const css = read(CSS).replace(/\r\n/g, '\n'); if (/<\/style/i.test(css)) fail(`${CSS} spells out a closing style tag`);
  const mod = scripts[scripts.length - 1].text;
  const m = /registerModule\(\{\s*key:\s*'([a-z0-9_]+)',\s*num:\s*'(\d+)',\s*title:\s*'((?:[^'\\]|\\.)*)',\s*desc:\s*'((?:[^'\\]|\\.)*)'/.exec(mod);
  if (!m) fail('could not read the module\'s key, number, title and description from src/33_m19_drhvac.js');
  const un = s => s.replace(/\\(.)/g, '$1');
  const pkg = JSON.parse(read('package.json'));
  return { scripts, css, license: read(LICENSE), module: { key: m[1], num: m[2], title: un(m[3]), desc: un(m[4]) }, version: pkg.version };
}

/* ---------- what both editions share: the title and the footer ---------- */
function titleAndFooter(html, log, forgeFixed) {
  const t = /<title>[^<]*<\/title>/.exec(html.slice(0, 4000)); if (!t) fail('no <title> near the top of the page');
  if (new RegExp(`Build ${BUILD.from}</title>$`).test(t[0])) { html = html.replace(t[0], () => t[0].replace(`Build ${BUILD.from}</title>`, `Build ${BUILD.n}</title>`)); log.push(`title: Build ${BUILD.from} → Build ${BUILD.n}`); }
  else if (new RegExp(`Build ${BUILD.n}</title>$`).test(t[0])) log.push(`title: already Build ${BUILD.n}`);
  else fail(`the page title does not end in "Build ${BUILD.from}": ${t[0].length} characters. This tool patches the Build ${BUILD.from} atlas.`);
  html = html.split(FOOT_ADD + FOOT_FIX).join('').split(FOOT_ADD).join('');
  html = once(html, FOOT_AT, FOOT_AT.replace('once a week.', 'once a week' + FOOT_ADD + (forgeFixed ? FOOT_FIX : '') + '.'), 'footer');
  log.push('footer: the Build ' + BUILD.n + ' sentence' + (forgeFixed ? ', naming the Site Forge repair' : ''));
  return html;
}

/* ---------- one repair to the atlas's own code ----------
   The Site Forge (module 09) reads and writes its site fields with a selector that takes every element in the module
   that carries data-k. Its two sortable tables put data-k on their header cells as well (dataTable in the core does),
   so reading the fields reaches a table header, which has no value, and throws before the change is saved or the plan
   is redrawn. A site field edited in the forge was lost without a word. The repair names the form controls the fields
   are. Three places, each of which must be found exactly once: the forge as shipped, or the forge already repaired. */
export const FORGE_FIELDS = 'input[data-k],select[data-k],textarea[data-k]';
const FORGE_ALL = '[data-k]';
const QUERY = sel => '$' + "$('" + sel + "', root)";                     /* the atlas's own query helper, spelled out */
const FORGE_SITES = [
  sel => 'function writeSite() { ' + QUERY(sel) + '.forEach(',
  sel => 'function readSite() { ' + QUERY(sel) + '.forEach(',
  sel => QUERY(sel) + ".forEach(i => i.addEventListener('change', () => { readSite(); save(); replan(); }));",
];
/* 'fixed' when all three places name the form controls, 'original' when all three are as shipped, '' otherwise */
export function forgeState(text) {
  const n = sel => FORGE_SITES.map(mk => count(text, mk(sel)));
  const orig = n(FORGE_ALL), fixed = n(FORGE_FIELDS);
  if (fixed.every(x => x === 1) && orig.every(x => x === 0)) return 'fixed';
  if (orig.every(x => x === 1) && fixed.every(x => x === 0)) return 'original';
  return '';
}
export function fixForge(text, what) {
  const st = forgeState(text);
  if (st === 'fixed') return { text, changed: 0 };
  if (st !== 'original') fail(`${what}: the Site Forge's site field code is not the code this repair was written for, so it was left alone and nothing was built. Build with --no-forge-fix to add Dr. HVAC without the repair.`);
  for (const mk of FORGE_SITES) text = text.replace(mk(FORGE_ALL), () => mk(FORGE_FIELDS));
  return { text, changed: FORGE_SITES.length };
}

/* ---------- edition one: the single HTML file ---------- */
export function patchSingle(html, S, o) {
  const log = []; html = String(html).replace(/^﻿/, ''); o = o || {};
  if (!html.includes('/* ==== src/99_shell.js ==== */')) fail('this is not the single file edition of the atlas (its inline shell script is missing)');
  html = dropBetween(dropBetween(html, MARK.css), MARK.js);
  if (o.forgeFix !== false) { const r = fixForge(html, 'the single file'); html = r.text; log.push(r.changed ? `Site Forge: its site fields now save (${r.changed} places in src/21_m09_forge.js read the form controls, not every element with data-k)` : 'Site Forge: already repaired'); }
  html = titleAndFooter(html, log, forgeState(html) === 'fixed');
  const HEAD = '\n</head>\n<body>\n<header class="shell-top">';
  html = once(html, HEAD, `\n${MARK.css[0]}\n<style>\n${S.css}</style>\n${MARK.css[1]}${HEAD}`, 'stylesheet');
  log.push(`stylesheet: ${CSS} inline, ${S.css.length.toLocaleString('en-US')} characters`);
  const blocks = S.scripts.map(x => `<script>\n${x.text}</script>\n`).join('');
  html = once(html, SHELL, `${MARK.js[0]}\n${blocks}${MARK.js[1]}\n${SHELL}`, 'scripts');
  log.push(`scripts: ${S.scripts.length} inline blocks before the shell, ${blocks.length.toLocaleString('en-US')} characters`);
  return { html, log };
}

/* ---------- edition two: the browser app ---------- */
/* files: Map of path → Buffer, paths relative to the folder that holds manifest.json */
export function patchApp(files, S, o) {
  o = o || {}; const log = []; const text = n => { const b = files.get(n); if (!b) fail(`the browser app has no ${n}`); return b.toString('utf8'); };
  const put = (n, s) => files.set(n, Buffer.from(s, 'utf8'));
  for (const n of ['manifest.json', 'atlas.html', 'registry.js', 'popup.html', 'popup.js', 'js/99_shell.js', 'css/atlas.css']) text(n);
  /* the new files; anything a previous run left under js/dr is replaced */
  for (const n of [...files.keys()]) if (n.startsWith('js/dr/')) files.delete(n);
  for (const x of S.scripts) put(x.app, x.text);
  put('js/vendor/LICENSE-anthropic-sdk.txt', S.license); put('css/drhvac.css', S.css);
  log.push(`files: ${S.scripts.length} scripts, css/drhvac.css and the SDK license`);

  /* the Site Forge repair, in the forge's own file */
  const FORGE = 'js/21_m09_forge.js'; let forgeFixed = false;
  if (o.forgeFix !== false) { const r = fixForge(text(FORGE), FORGE); put(FORGE, r.text); forgeFixed = true; log.push(r.changed ? `Site Forge: its site fields now save (${r.changed} places in ${FORGE} read the form controls, not every element with data-k)` : 'Site Forge: already repaired'); }
  else forgeFixed = files.has(FORGE) && forgeState(text(FORGE)) === 'fixed';

  /* atlas.html */
  let html = dropBetween(text('atlas.html'), MARK.js).replace(/<link rel="stylesheet" href="css\/drhvac\.css">\n?/g, '');
  html = titleAndFooter(html, log, forgeFixed);
  const HEAT = '<link rel="stylesheet" href="css/heat.css">\n';
  html = once(html, HEAT, HEAT + '<link rel="stylesheet" href="css/drhvac.css">\n', 'atlas.html stylesheet');
  html = once(html, SHELL, `${MARK.js[0]}\n${S.scripts.map(x => `<script src="${x.app}"></script>\n`).join('')}${MARK.js[1]}\n${SHELL}`, 'atlas.html scripts');
  put('atlas.html', html); log.push(`atlas.html: the stylesheet link and ${S.scripts.length} script tags before the shell`);

  /* manifest.json: the version, and the hosts the agent reaches without asking */
  const man = JSON.parse(text('manifest.json'));
  if (man.manifest_version !== 3) fail('manifest.json is not Manifest V3');
  const csp = (man.content_security_policy || {}).extension_pages || '';
  if (/connect-src/.test(csp)) fail('manifest.json sets connect-src, which would block the Claude API; add https://api.anthropic.com to it by hand');
  const add = (list, more) => { const out = Array.isArray(list) ? list.slice() : []; more.forEach(h => { if (!out.includes(h)) out.push(h); }); return out; };
  man.version = S.version; man.host_permissions = add(man.host_permissions, HOSTS); man.optional_host_permissions = add(man.optional_host_permissions, OPTIONAL_HOSTS);
  put('manifest.json', JSON.stringify(man, null, 2) + '\n'); log.push(`manifest.json: version ${S.version}; host access for ${HOSTS.map(h => h.replace(/^https:\/\/|\/\*$/g, '')).join(', ')}; websites stay optional and asked for one at a time`);

  /* registry.js: what the popup and the address bar keyword list */
  const reg = text('registry.js'); const a = reg.indexOf('{'), b = reg.lastIndexOf('}'); if (a < 0 || b < a) fail('registry.js has no object');
  const R = JSON.parse(reg.slice(a, b + 1)); if (!Array.isArray(R.modules)) fail('registry.js has no module list');
  R.version = S.version; R.modules = R.modules.filter(m => m.key !== S.module.key).concat([S.module]);
  put('registry.js', reg.slice(0, a) + JSON.stringify(R) + reg.slice(b + 1)); log.push(`registry.js: version ${S.version}, module ${S.module.num} ${S.module.title}`);

  /* the popup: a button that opens the conversation */
  /* taken out with the indent they were put in with, so a second run leaves the files byte for byte the same */
  let pop = text('popup.html').replace(new RegExp('[ \\t]*' + reEsc(MARK.popup[0]) + '[\\s\\S]*?' + reEsc(MARK.popup[1]) + '\\n?', 'g'), '');
  const LIVE_BTN = '    <button class="b" id="goLive" type="button">Live data and sources</button>\n';
  pop = once(pop, LIVE_BTN, LIVE_BTN + `    ${MARK.popup[0]}<button class="b" id="goDr" type="button" style="grid-column:1 / -1">Ask Dr. HVAC: build or change a page</button>${MARK.popup[1]}\n`, 'popup.html button');
  put('popup.html', pop);
  let pjs = text('popup.js').replace(new RegExp('\\n[ \\t]*' + reEsc(MARK.popupJs[0]) + '[\\s\\S]*?' + reEsc(MARK.popupJs[1]), 'g'), '');
  const GO = "$('goLive').onclick = e => open('live', e);";
  pjs = once(pjs, GO, GO + `\n  ${MARK.popupJs[0]} { const dr = $('goDr'); if (dr) dr.onclick = e => open('${S.module.key}', e); } ${MARK.popupJs[1]}`, 'popup.js button');
  put('popup.js', pjs); log.push('popup: the Ask Dr. HVAC button');
  return { files, log };
}

/* ---------- reading and writing the browser app ---------- */
export function readApp(src) {
  const st = fs.statSync(src); const files = new Map(); let top = '';
  if (st.isDirectory()) {
    const walk = (dir, rel) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name), r = rel ? rel + '/' + e.name : e.name; if (e.isDirectory()) walk(p, r); else if (e.isFile()) files.set(r, fs.readFileSync(p)); } };
    walk(src, ''); top = path.basename(path.resolve(src));
  } else for (const e of readZip(fs.readFileSync(src))) if (!e.dir) files.set(e.name, e.data);
  /* the app may sit in one top folder inside the zip */
  const man = [...files.keys()].filter(n => /(^|\/)manifest\.json$/.test(n)).sort((x, y) => x.length - y.length)[0];
  if (man == null) fail('no manifest.json in ' + src);
  const prefix = man.slice(0, man.length - 'manifest.json'.length);
  if (prefix) { top = prefix.replace(/\/$/, ''); for (const [n, b] of [...files]) { files.delete(n); if (n.startsWith(prefix)) files.set(n.slice(prefix.length), b); } }
  return { files, top: top || 'dfw-thermal-debt-atlas' };
}
export function zipApp(files, top) { return writeZip([...files.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)).map(([name, data]) => ({ name: top + '/' + name, data }))); }

/* the repository this tool lives in, if it is in one: the built atlas must not land inside it */
export function repoRoot(from = HERE) { let d = path.resolve(from); for (;;) { if (fs.existsSync(path.join(d, '.git'))) return d; const up = path.dirname(d); if (up === d) return ''; d = up; } }
export function checkOut(out, root = repoRoot()) {
  const abs = path.resolve(out); const inside = (a, b) => { const r = path.relative(b, a); return r === '' || (!r.startsWith('..') && !path.isAbsolute(r)); };
  if (root && inside(abs, root)) fail(`--out ${abs} is inside the repository (${root}). The built atlas carries the client's data and names, which this repository does not hold: write it somewhere else.`);
  return abs;
}

export function build({ html, app, out, root = HERE, log = console.log, forgeFix = true }) {
  if (!html && !app) fail('give --html, --app or both');
  if (!out) fail('give --out, a folder outside this repository');
  const dest = checkOut(out); const S = sources(root); fs.mkdirSync(dest, { recursive: true }); const made = [];
  log(`Dr. HVAC ${S.version}: ${S.scripts.length} scripts, ${(S.scripts.reduce((n, x) => n + Buffer.byteLength(x.text), 0) / 1024).toFixed(0)} KB`);
  if (html) {
    const r = patchSingle(fs.readFileSync(html, 'utf8'), S, { forgeFix }); const again = patchSingle(r.html, S, { forgeFix }).html;
    if (again !== r.html) fail('the single file build is not stable when run twice');
    const f = path.join(dest, `DFW_Thermal_Debt_Atlas_Build${BUILD.n}.html`); fs.writeFileSync(f, r.html); made.push(f);
    log(`\nSingle file edition → ${f}  (${(Buffer.byteLength(r.html) / 1048576).toFixed(2)} MB)`); r.log.forEach(l => log('  ' + l));
  }
  if (app) {
    const A = readApp(app); const r = patchApp(A.files, S, { forgeFix }); const again = patchApp(new Map(r.files), S, { forgeFix }).files;
    for (const [n, b] of r.files) if (!again.has(n) || !again.get(n).equals(b)) fail(`the browser app build is not stable when run twice (${n})`);
    const zip = zipApp(r.files, A.top);
    const back = readApp0(zip); if (back !== r.files.size) fail('the browser app zip did not read back whole');
    const f = path.join(dest, `DFW-Thermal-Debt-Atlas-browser-app-${S.version}.zip`); fs.writeFileSync(f, zip); made.push(f);
    log(`\nBrowser app → ${f}  (${(zip.length / 1048576).toFixed(2)} MB, ${r.files.size} files in ${A.top}/)`); r.log.forEach(l => log('  ' + l));
  }
  return made;
}
const readApp0 = zip => readZip(zip).filter(e => !e.dir).length;

/* ---------- command line ---------- */
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = {}; const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) { if (argv[i] === '--no-forge-fix') { args.forgeFix = false; continue; } const m = /^--(html|app|out)(?:=(.*))?$/.exec(argv[i]); if (!m) { console.error('Unknown argument: ' + argv[i]); process.exit(2); } args[m[1]] = m[2] != null ? m[2] : argv[++i]; }
  if (!args.html && !args.app) { console.error('Usage: node build.mjs --html <single file dashboard.html> --app <browser app .zip or folder> --out <folder outside this repository> [--no-forge-fix]'); process.exit(2); }
  try { build(args); } catch (e) { if (e instanceof BuildError) { console.error('\nBuild stopped: ' + e.message); process.exit(1); } throw e; }
}
