// One-time recovery tool: split a single-file DFW Thermal Debt Atlas build into the app/ source tree
// (css/, data/, js/) plus atlas.template.html, the page skeleton build.mjs reassembles both editions from.
//   node tools/unpack.mjs <single-file.html> [--force]
// The split is lossless: `node build.mjs --verify <single-file.html>` rebuilds the file byte for byte.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const src = args.find(a => !a.startsWith('--'));
const force = args.includes('--force');
if (!src) { console.error('usage: node tools/unpack.mjs <single-file.html> [--force]'); process.exit(2); }

const text = readFileSync(src, 'utf8');
const lines = text.split('\n');
const out = [];            // template lines
const files = [];          // { path, body }
const put = (path, body) => { files.push({ path, body }); };

for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  if (l === '<style>' || l === '<script>') {
    const close = l === '<style>' ? '</style>' : '</script>';
    let j = i + 1; while (j < lines.length && lines[j] !== close) j++;
    if (j >= lines.length) throw new Error(`unterminated ${l} at line ${i + 1}`);
    const body = lines.slice(i + 1, j).join('\n') + '\n';   // text between "<tag>\n" and "</tag>"
    let path;
    if (l === '<style>') path = 'css/atlas.css';
    else {
      const m = /^\/\* ==== (.+?) ==== \*\//.exec(lines[i + 1] || '');
      if (!m) throw new Error(`script at line ${i + 1} has no section marker`);
      const name = m[1];
      path = name.startsWith('src/') ? 'js/' + name.slice(4) : 'data/' + name;
    }
    if (files.some(f => f.path === path)) throw new Error('duplicate section ' + path);
    put(path, body);
    out.push(`<!--@${l === '<style>' ? 'css' : 'js'} ${path}-->`);
    i = j;
    continue;
  }
  out.push(l);
}

for (const f of files) {
  const p = join(ROOT, 'app', f.path);
  if (existsSync(p) && !force) throw new Error(`${p} exists (pass --force to overwrite)`);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, f.body);
}
const tpl = join(ROOT, 'atlas.template.html');
if (existsSync(tpl) && !force) throw new Error(`${tpl} exists (pass --force to overwrite)`);
writeFileSync(tpl, out.join('\n'));
console.log(`unpacked ${files.length} sections into app/ and wrote atlas.template.html (${out.length} lines)`);
