#!/usr/bin/env node
// Legion · build: one self-contained Legion.html.
//
//   node tools/build.mjs                build legion/Legion.html and print its size
//   node tools/build.mjs --check        build, then verify the file (below); exit 1 on a problem
//   node tools/build.mjs --check-only   verify the existing Legion.html without building
//   node tools/build.mjs --out <file>   write somewhere else (the tests build twice to compare bytes)
//
// What goes in: src/app/main.mjs bundled by esbuild as one IIFE for modern browsers (es2022, minified); the crowd
// Worker (src/world/crowd-worker.mjs, when it exists) bundled separately and exposed as the string
// window.__LEGION_WORKER_SRC__ (the crowd starts its Worker from a Blob URL of it); src/app/app.css minified; and
// the world pack (data/world.json.gz) as base64 in window.__LEGION_PACK__. The page is src/app/index.html with its
// stylesheet link and module script replaced by those inline blocks. The same inputs give the same bytes: no
// timestamps, and the build id in <meta name="legion-build"> is a hash of the content.
//
// The engine runs in Node too, so some modules lazily `await import('node:…')` on Node-only paths. For the
// browser those imports resolve to a stub module that throws if ever called, so no import() is left in the page.
//
// --check verifies: the title, description and viewport; that every script is inline and parses as a classic
// script (no import or export statements, no import() or require left); that nothing loads from outside the file
// (no src or href to a URL, no CSS url() or @import beyond data: URIs); the app bundle is there; the pack decodes
// and loads in Node as far as the engine goes (World + Population); the worker source parses and imports nothing.

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import vm from 'node:vm';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** The legion/ folder. */
export const LEGION_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/** Where the page is written by default. */
export const OUT_FILE = path.join(LEGION_DIR, 'Legion.html');
/** Inputs. */
export const PATHS = Object.freeze({
  template: path.join(LEGION_DIR, 'src/app/index.html'),
  app: path.join(LEGION_DIR, 'src/app/main.mjs'),
  css: path.join(LEGION_DIR, 'src/app/app.css'),
  worker: path.join(LEGION_DIR, 'src/world/crowd-worker.mjs'),
  pack: path.join(LEGION_DIR, 'data/world.json.gz'),
  nodeModules: path.join(LEGION_DIR, 'node_modules'),
});

const TITLE = 'Legion · every Californian as an NPC';
const DESCRIPTION = "Legion turns California's Census, housing, climate and wildfire data into 39 million deterministic NPCs: a live crowd walking and driving the state, each person with a home, a job, a commute, a personality and a voice.";
const CSS_TARGET = ['chrome111', 'edge111', 'firefox113', 'safari16.4'];

let esbuildModule = null;
async function esbuild() {
  if (!esbuildModule) esbuildModule = await import(pathToFileURL(path.join(PATHS.nodeModules, 'esbuild/lib/main.js')).href);
  return esbuildModule;
}

/** esbuild plugin: `node:*` imports become a module that throws when used (they sit on Node-only code paths). */
export const nodeBuiltinsStub = Object.freeze({
  name: 'legion-node-builtins',
  setup(b) {
    b.onResolve({ filter: /^node:/ }, args => ({ path: args.path, namespace: 'legion-node-stub' }));
    b.onLoad({ filter: /.*/, namespace: 'legion-node-stub' }, args => ({
      loader: 'js',
      contents: `const unavailable = () => { throw new Error(${JSON.stringify(`${args.path} is not available in the browser`)}); };\n` +
        'export default new Proxy({}, { get: (t, k) => (k === "then" ? undefined : unavailable) });\n',
    }));
  },
});

/**
 * Bundle one entry for the browser as a minified IIFE (es2022). Bare imports resolve from legion/node_modules,
 * wherever the entry lives (the tests bundle a temporary entry from a scratch folder).
 * @param {string} entry absolute path
 * @returns {Promise<{code: string, inputs: string[]}>}
 */
export async function bundle(entry) {
  const { build } = await esbuild();
  const r = await build({
    entryPoints: [entry],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: ['es2022'],
    minify: true,
    legalComments: 'none',
    charset: 'utf8',
    write: false,
    metafile: true,
    // warnings print; import.meta is only read on paths the single file never takes (world.mjs's Node loader,
    // the crowd's unbundled-worker fallback when no inline worker source exists), so its warning is silenced
    logLevel: 'warning',
    logOverride: { 'empty-import-meta': 'silent' },
    absWorkingDir: LEGION_DIR,
    nodePaths: [PATHS.nodeModules],
    plugins: [nodeBuiltinsStub],
  });
  const code = r.outputFiles[0].text.trimEnd();
  return { code, inputs: Object.keys(r.metafile.inputs).sort() };
}

/**
 * Make bundled code safe inside an inline <script>. `</script` would end the element and `<!--` (followed later by
 * `<script`) would put the HTML parser in its double-escaped state, where the real end tag no longer closes it.
 * Minified code can only hold either inside a string, template or regular expression, where `<\/` and `\x21` mean
 * the same characters (esbuild already escapes `</script`; this is the backstop).
 */
export function scriptSafe(code) {
  return code.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\x21--');
}

// U+2028 and U+2029 are legal in modern string literals but end a line in older parsers; escape them anyway.
const LINE_SEPARATORS = new RegExp('[\\u2028\\u2029]', 'g');

/** A JS string literal of text, safe inside an inline <script>. */
export function jsString(text) {
  return JSON.stringify(text).replace(/</g, '\\u003c').replace(LINE_SEPARATORS, c => (c === '\u2028' ? '\\u2028' : '\\u2029'));
}

function ensureHead(html, test, tag) {
  return test.test(html) ? html : html.replace(/<meta charset="utf-8">/i, m => `${m}\n  ${tag}`);
}

const KB = n => `${(n / 1024).toFixed(0)} KB`;
const MB = n => `${(n / 1048576).toFixed(2)} MB`;

/**
 * Build the page in memory.
 * @returns {Promise<{html: string, bytes: number, id: string, sizes: {pack: number, app: number, worker: number, css: number}, worker: boolean, inputs: string[]}>}
 */
export async function buildHTML() {
  const { transform } = await esbuild();
  let html = fs.readFileSync(PATHS.template, 'utf8');
  const css = (await transform(fs.readFileSync(PATHS.css, 'utf8'), { loader: 'css', minify: true, target: CSS_TARGET, legalComments: 'none', charset: 'utf8' })).code.trim();
  const app = await bundle(PATHS.app);
  const hasWorker = fs.existsSync(PATHS.worker);
  const worker = hasWorker ? await bundle(PATHS.worker) : null;
  const pack = fs.readFileSync(PATHS.pack);
  if (pack[0] !== 0x1f || pack[1] !== 0x8b) throw new Error(`${PATHS.pack} is not gzip`);
  const packB64 = pack.toString('base64');

  const appCode = scriptSafe(app.code);
  const id = crypto.createHash('sha256').update(appCode).update('\0').update(css).update('\0').update(worker ? worker.code : '').update('\0').update(pack).digest('hex').slice(0, 12);

  const scripts = [
    `<script>window.__LEGION_PACK__="${packB64}"</script>`,
    worker ? `<script>window.__LEGION_WORKER_SRC__=${jsString(worker.code)}</script>` : null,
    `<script>${appCode}</script>`,
  ].filter(Boolean).join('\n  ');

  const cssTag = /<link\b[^>]*data-legion-inline="css"[^>]*>/i;
  const appTag = /<script\b[^>]*data-legion-inline="app"[^>]*>\s*<\/script>/i;
  if (!cssTag.test(html)) throw new Error('src/app/index.html has no <link data-legion-inline="css">');
  if (!appTag.test(html)) throw new Error('src/app/index.html has no <script data-legion-inline="app">');
  // function replacers: the bundle contains `$&`-style sequences that a replacement string would expand
  html = html.replace(cssTag, () => `<style>${css.replace(/<\/(style)/gi, '<\\/$1')}</style>`);
  html = html.replace(appTag, () => scripts);
  html = ensureHead(html, /<title>[^<]+<\/title>/i, `<title>${TITLE}</title>`);
  html = ensureHead(html, /<meta\s+name="description"/i, `<meta name="description" content="${DESCRIPTION.replace(/"/g, '&quot;')}">`);
  html = ensureHead(html, /<meta\s+name="viewport"/i, '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">');
  html = html.replace(/<meta charset="utf-8">/i, m => `${m}\n  <meta name="legion-build" content="${id}">`);

  const bytes = Buffer.byteLength(html);
  return {
    html, bytes, id, worker: hasWorker,
    sizes: { pack: packB64.length, app: Buffer.byteLength(appCode), worker: worker ? Buffer.byteLength(worker.code) : 0, css: Buffer.byteLength(css) },
    inputs: [...new Set([...app.inputs, ...(worker ? worker.inputs : [])])].sort(),
  };
}

/**
 * Build and write the page.
 * @param {{out?: string, quiet?: boolean}} [options]
 */
export async function build({ out = OUT_FILE, quiet = false } = {}) {
  const t0 = Date.now();
  const r = await buildHTML();
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, r.html);
  if (!quiet) {
    const rel = path.relative(process.cwd(), out) || out;
    console.log(`${rel}  ${MB(r.bytes)}  (pack ${MB(r.sizes.pack)} · app ${KB(r.sizes.app)} · ${r.worker ? `worker ${KB(r.sizes.worker)}` : 'no worker yet'} · css ${KB(r.sizes.css)})  build ${r.id}  ${Date.now() - t0} ms`);
  }
  return { ...r, out };
}

/** The inline scripts of a page: [{attrs, code}]. */
export function inlineScripts(html) {
  const out = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) out.push({ attrs: m[1].trim(), code: m[2] });
  return out;
}

// A reference that stays inside the page: a data: or blob: URL, a fragment (#map, url(#grad)), or nothing.
const INSIDE = /^\s*(?:$|#|data:|blob:|about:blank)/i;

/** The URLs of a srcset, as the HTML spec splits it: a URL runs to whitespace (data: URLs hold commas). */
function srcsetURLs(value) {
  const s = String(value), out = [];
  let i = 0;
  while (i < s.length) {
    while (i < s.length && /[\s,]/.test(s[i])) i++;
    let j = i;
    while (j < s.length && !/\s/.test(s[j])) j++;
    let url = s.slice(i, j);
    if (!url) break;
    if (/,$/.test(url)) { out.push(url.replace(/,+$/, '')); i = j; continue; }   // "a.png, b.png": no descriptors
    out.push(url);
    while (j < s.length && s[j] !== ',') j++;   // skip the descriptors ("2x", "640w")
    i = j + 1;
  }
  return out;
}
// Attributes whose URL the browser loads by itself (a link's href only loads when followed, so it is not one).
const LOADING_ATTRS = new Set(['src', 'href', 'srcset', 'poster', 'data', 'background', 'manifest', 'imagesrcset']);

/**
 * What a page would load from outside itself: URLs in loading attributes (src, href except on a link, srcset,
 * poster ...) and in CSS (url(), @import), in <style> blocks and style attributes. Script bodies are code, which
 * importProblems checks. Returns problem strings (none for a self-contained page).
 * @param {string} html
 * @returns {string[]}
 */
export function externalResourceProblems(html) {
  const problems = new Set();
  const markup = html.replace(/(<script\b[^>]*>)[\s\S]*?(<\/script>)/gi, '$1$2');
  const styles = [];
  const bare = markup.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, (m, open, css, close) => { styles.push(css); return open + close; });
  const tagRe = /<([a-z][\w-]*)\b([^>]*)>/gi;
  let t;
  while ((t = tagRe.exec(bare))) {
    const tag = t[1].toLowerCase();
    const attrRe = /([^\s"'=<>/]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
    let a;
    while ((a = attrRe.exec(t[2]))) {
      const name = a[1].toLowerCase(), value = a[2] ?? a[3] ?? a[4] ?? '';
      if (name === 'style') { styles.push(value); continue; }
      if (!LOADING_ATTRS.has(name) || ((tag === 'a' || tag === 'area') && name === 'href')) continue;
      const urls = name.endsWith('srcset') ? srcsetURLs(value) : [value];
      for (const u of urls) if (!INSIDE.test(u)) problems.add(`<${tag} ${name}="${u.slice(0, 80)}"> loads a resource from outside the page`);
    }
  }
  for (const css of styles) {
    let m;
    const imported = new Set();
    const importRe = /@import\s+(?:url\(\s*)?(["']?)([^"')\s;]+)\1/gi;
    while ((m = importRe.exec(css))) { imported.add(m[2]); problems.add(`the CSS @imports ${m[2].slice(0, 80)}`); }
    const urlRe = /url\(\s*(["']?)([^"')]*)\1\s*\)/gi;
    while ((m = urlRe.exec(css))) if (!INSIDE.test(m[2]) && !imported.has(m[2])) problems.add(`the CSS loads ${m[2].slice(0, 80)} from outside the page`);
  }
  return [...problems];
}

/**
 * import or require left in a script, as esbuild's parser sees it (strings and comments do not count), and, for a
 * worker, importScripts calls. Returns problem strings.
 * @param {string} code
 * @param {string} name for the messages ("script 3", "the worker source")
 * @param {{worker?: boolean}} [options]
 */
export async function importProblems(code, name, { worker = false } = {}) {
  const problems = [];
  const { build: esb } = await esbuild();
  try {
    const r = await esb({ stdin: { contents: code, loader: 'js', sourcefile: `${name.replace(/\W+/g, '-')}.js` }, bundle: true, write: false, metafile: true, platform: 'browser', format: 'iife', logLevel: 'silent', external: ['*'] });
    const imports = Object.values(r.metafile.inputs).flatMap(x => x.imports || []);
    if (imports.length) problems.push(`${name} still imports ${imports.map(i => `${i.path} (${i.kind})`).join(', ')}`);
  } catch (e) { problems.push(`${name} could not be analyzed: ${e.message.split('\n')[0]}`); }
  if (worker && /\bimportScripts\s*\(/.test(code)) problems.push(`${name} calls importScripts, which loads code from outside the page`);
  return problems;
}

/**
 * Verify a built page. Returns {ok, problems, info}; never throws for a problem in the page.
 * @param {string} [file]
 */
export async function check(file = OUT_FILE) {
  const problems = [];
  const info = {};
  if (!fs.existsSync(file)) return { ok: false, problems: [`${file} does not exist`], info };
  const html = fs.readFileSync(file, 'utf8');
  info.bytes = Buffer.byteLength(html);

  if (!/<title>[^<]{3,}<\/title>/i.test(html)) problems.push('no <title>');
  if (!/<meta\s+name="description"\s+content="[^"]{20,}"/i.test(html)) problems.push('no meta description');
  if (!/<meta\s+name="viewport"\s+content="[^"]*width=device-width/i.test(html)) problems.push('no viewport meta');
  if (/<script\b[^>]*\bsrc=/i.test(html)) problems.push('a <script src> remains: the page must be self-contained');
  if (/<script\b[^>]*type="module"/i.test(html)) problems.push('a module script remains');
  if (/<link\b[^>]*rel="stylesheet"/i.test(html)) problems.push('an external stylesheet remains');
  if (!/<style>[\s\S]{1000,}<\/style>/i.test(html)) problems.push('the stylesheet is not inline');
  // nothing may load from outside the file: no remote fonts, images or @imports (the page works offline)
  problems.push(...externalResourceProblems(html));

  const scripts = inlineScripts(html);
  let packB64 = null, workerSrc = null, app = null;
  for (const [k, s] of scripts.entries()) {
    const name = `script ${k + 1}`;
    try { new vm.Script(s.code, { filename: `${name}.js` }); } catch (e) { problems.push(`${name} does not parse as a classic script: ${e.message}`); continue; }
    if (s.code.startsWith('window.__LEGION_PACK__=')) {
      const m = /^window\.__LEGION_PACK__="([A-Za-z0-9+/=]+)"$/.exec(s.code.trim());
      if (m) packB64 = m[1]; else problems.push('the pack script is malformed');
      continue;
    }
    if (s.code.startsWith('window.__LEGION_WORKER_SRC__=')) {
      try { workerSrc = JSON.parse(s.code.slice('window.__LEGION_WORKER_SRC__='.length)); } catch (e) { problems.push(`the worker script is malformed: ${e.message}`); }
      continue;
    }
    if (s.code.length > 50000) app = s.code;
    // import() or require() left behind (strings do not count: this is the parser's view)
    problems.push(...await importProblems(s.code, name));
  }
  if (!app) problems.push('the app bundle is missing');
  else info.app = Buffer.byteLength(app);

  if (!packB64) problems.push('the world pack (window.__LEGION_PACK__) is missing');
  else {
    try {
      const bytes = Buffer.from(packB64, 'base64');
      const original = fs.existsSync(PATHS.pack) ? fs.readFileSync(PATHS.pack) : null;
      if (original && !original.equals(bytes)) problems.push('the inline pack differs from data/world.json.gz');
      const pack = JSON.parse(zlib.gunzipSync(bytes).toString('utf8'));
      const { createWorld } = await import(pathToFileURL(path.join(LEGION_DIR, 'src/engine/world.mjs')).href);
      const { Population } = await import(pathToFileURL(path.join(LEGION_DIR, 'src/engine/population.mjs')).href);
      const world = createWorld(pack);
      const pop = new Population(world);
      const zi = world.indexOf('94110');
      const people = pop.sample(zi >= 0 ? zi : 0, 3, 1);
      info.zips = world.N; info.population = world.totalPop; info.sampled = people.map(p => p && p.id);
      if (world.N < 1000) problems.push(`the pack has only ${world.N} ZIPs`);
      if (!people.length || !people[0] || !people[0].id) problems.push('the population produced no one from the inline pack');
    } catch (e) { problems.push(`the inline pack does not load: ${e.message}`); }
  }

  const workerFile = fs.existsSync(PATHS.worker);
  info.worker = typeof workerSrc === 'string' ? Buffer.byteLength(workerSrc) : 0;
  if (typeof workerSrc === 'string') {
    let parses = true;
    try { new vm.Script(workerSrc, { filename: 'crowd-worker.js' }); } catch (e) { parses = false; problems.push(`the worker source does not parse: ${e.message}`); }
    // the worker runs from a Blob URL: an import() or importScripts in it would reach for files that are not there
    if (parses) problems.push(...await importProblems(workerSrc, 'the worker source', { worker: true }));
  } else if (workerSrc !== null) problems.push('the worker script does not hold a string');
  else if (workerFile) problems.push('src/world/crowd-worker.mjs exists but the page has no window.__LEGION_WORKER_SRC__');

  return { ok: problems.length === 0, problems, info };
}

/** The command line: `node tools/build.mjs [--out FILE] [--check | --check-only] [--quiet]`. */
export const USAGE = 'Usage: node tools/build.mjs [--out FILE] [--check | --check-only] [--quiet]';

/**
 * The options of the command line, or {error} for a usage error: an unknown option, or --out without a file name
 * (a value that starts with "--" is the next option, never the file).
 * @param {string[]} args the arguments after the script
 * @returns {{out: string, check: boolean, checkOnly: boolean, quiet: boolean} | {error: string}}
 */
export function parseBuildArgs(args) {
  let parsed;
  try {
    parsed = parseArgs({ args, options: { out: { type: 'string' }, check: { type: 'boolean' }, 'check-only': { type: 'boolean' }, quiet: { type: 'boolean' } }, strict: true, allowPositionals: false });
  } catch (e) { return { error: e.message }; }
  const v = parsed.values;
  if (v.out !== undefined && (!v.out || v.out.startsWith('-'))) return { error: `--out needs a file name, not "${v.out}"` };
  return { out: v.out ? path.resolve(v.out) : OUT_FILE, check: !!v.check, checkOnly: !!v['check-only'], quiet: !!v.quiet };
}

async function main(argv) {
  const o = parseBuildArgs(argv.slice(2));
  if (o.error) { console.error(`${o.error}\n${USAGE}`); process.exitCode = 2; return; }
  const out = o.out;
  if (!o.checkOnly) await build({ out, quiet: o.quiet });
  if (o.check || o.checkOnly) {
    const r = await check(out);
    if (r.ok) console.log(`check ok: ${MB(r.info.bytes)}, app ${KB(r.info.app)}, ${r.info.worker ? `worker ${KB(r.info.worker)}` : 'no worker'}, pack loads (${r.info.zips} ZIPs, ${r.info.population.toLocaleString('en-US')} people; sampled ${r.info.sampled.join(', ')})`);
    else { console.error(`check failed:\n  - ${r.problems.join('\n  - ')}`); process.exitCode = 1; }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv).catch(e => { console.error(e && e.stack ? e.stack : e); process.exitCode = 1; });
}
