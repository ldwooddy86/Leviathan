// Run the live layer's collectors in Node, exactly as the browser app's background worker runs them, and bake the result
// into the build as app/data/live-baseline.js, so a fresh install and the single file edition open with current data.
//   node tools/refresh.mjs                 every source, then write the baseline
//   node tools/refresh.mjs --only a,b      just these sources (the others keep what the baseline already holds)
//   node tools/refresh.mjs --dry           run and report, write nothing
//   node tools/refresh.mjs --key census=…  an API key for sources that take one (repeatable); never written to the baseline
// Node 22, no packages. Behind an HTTPS proxy the script restarts itself with NODE_USE_ENV_PROXY=1 so fetch honours it.
import vm from 'node:vm';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

if ((process.env.HTTPS_PROXY || process.env.https_proxy) && !process.env.NODE_USE_ENV_PROXY) {
  const r = spawnSync(process.execPath, ['--no-warnings', ...process.argv.slice(1)], { stdio: 'inherit', env: Object.assign({}, process.env, { NODE_USE_ENV_PROXY: '1' }) });
  process.exit(r.status ?? 1);
}
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const APP = join(ROOT, 'app'), OUT = join(APP, 'data', 'live-baseline.js');
const a = process.argv.slice(2), has = k => a.includes(k), val = k => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : null; };
const keys = {}; a.forEach((x, i) => { if (x === '--key' && a[i + 1]) { const [k, ...v] = a[i + 1].split('='); keys[k] = v.join('='); } });

/* the live layer in template order, minus the page's own glue */
const files = readFileSync(join(ROOT, 'atlas.template.html'), 'utf8').split('\n').map(l => /^<!--@js (live\/[^ ]+)-->$/.exec(l)).filter(Boolean).map(m => m[1]).filter(f => f !== 'live/page.js');
const ctx = vm.createContext({ console, setTimeout, clearTimeout, URL, URLSearchParams, AbortController, TextEncoder, TextDecoder, Intl, fetch: (u, i) => fetch(u, Object.assign({}, i, { headers: Object.assign({ 'User-Agent': 'dfw-thermal-atlas/5.0 (weekly public data refresh; github.com/ldwooddy86/Leviathan)' }, (i && i.headers) || {}) })) });
ctx.globalThis = ctx; ctx.self = ctx;
for (const f of files) vm.runInContext(readFileSync(join(APP, f), 'utf8'), ctx, { filename: f });
const L = ctx.TDA_LIVE;

/* start from the baseline already in the tree, so a partial run or a failed source keeps its last good record */
let old = { records: {} };
if (existsSync(OUT)) { try { const raw = readFileSync(OUT, 'utf8'); old = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)); } catch (e) { console.error('could not read the existing baseline, starting empty: ' + e.message); } }
const seed = {}; for (const [id, r] of Object.entries(old.records || {})) seed[L.K.src(id)] = r;
seed[L.K.settings] = { keys };
const store = L.memoryStore(seed);
const only = val('--only'); const scope = only ? only.split(',').map(s => s.trim()).filter(Boolean) : 'weekly';
if (Array.isArray(scope)) for (const id of scope) if (!L.BY_ID[id]) { console.error(`no such source: ${id}. Known: ${L.SOURCES.map(s => s.id).join(', ')}`); process.exit(2); }

console.log(`refreshing ${Array.isArray(scope) ? scope.join(', ') : 'all ' + L.SOURCES.length + ' sources'} …`);
const t0 = Date.now();
const r = await L.refresh({ scope, store, env: 'node', force: true, onProgress: p => console.log(`  ${String(p.done).padStart(2)}/${p.total}  ${p.status.padEnd(7)} ${p.id}`) });
const records = {}; let bytes = 0;
for (const s of L.SOURCES) { const rec = await store.get(L.K.src(s.id)); if (rec && rec.data != null) { delete rec.skipped; records[s.id] = rec; } }
for (const s of L.SOURCES) {
  const rec = records[s.id]; const size = rec ? JSON.stringify(rec).length : 0; bytes += size;
  console.log(`${(rec ? (rec.ok ? 'ok' : 'kept') : 'none').padEnd(5)} ${s.id.padEnd(22)} ${rec ? String(rec.n || 0).padStart(3) + ' req ' + String(Math.round(size / 1024)).padStart(5) + ' KB stored  ' + (rec.at || '') : ''}${rec && rec.ok === false ? '   FAILED now: ' + rec.err.msg : ''}${rec && s.digest && rec.digest ? '\n        ' + JSON.stringify(rec.digest) : ''}`);
}
for (const f of r.failed) if (!records[f.id]) console.log(`FAILED ${f.id}: ${f.msg}`);
for (const f of r.skipped) console.log(`skipped ${f.id}: ${f.why}`);
console.log(`${r.ran.length} refreshed, ${r.failed.length} failed, ${r.skipped.length} skipped in ${((Date.now() - t0) / 1000).toFixed(1)} s; baseline ${Math.round(bytes / 1024)} KB`);
if (has('--dry')) process.exit(r.failed.length ? 1 : 0);
if (!Object.keys(records).length) { console.error('nothing to write'); process.exit(1); }
const body = JSON.stringify({ v: L.V, built: new Date().toISOString(), records });
if (/<\/script/i.test(body)) { console.error('a record holds a literal </script; refusing to write it into an inline script'); process.exit(1); }
writeFileSync(OUT, `/* ==== live-baseline.js ==== */\n/* The live records as of the build, written by tools/refresh.mjs. The page overlays whatever its own store holds that is newer. */\nwindow.__LIVE_BASELINE__ = ${body};\n`);
console.log(`wrote app/data/live-baseline.js`);
process.exit(r.failed.length ? 1 : 0);
