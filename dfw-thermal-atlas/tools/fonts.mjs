// Bundle the atlas typefaces into app/fonts/ so the extension page never calls Google Fonts.
//   node tools/fonts.mjs
// Reads the same Google Fonts stylesheet the single-file edition links, keeps the latin and latin-ext subsets,
// downloads each woff2 once and writes app/fonts/fonts.css with relative URLs. All five families ship under the
// SIL Open Font License 1.1 (IBM Plex Sans, IBM Plex Sans Condensed, IBM Plex Mono, Bebas Neue, Open Sans).
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'app', 'fonts');
const CSS_URL = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans+Condensed:wght@500;600;700&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Bebas+Neue&family=Open+Sans:ital,wght@0,400;0,600;0,700;1,400&display=swap';
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';   // asks for woff2 with unicode-range subsets
const KEEP = new Set(['latin', 'latin-ext']);
// curl honours the sandbox proxy and CA bundle; Node's fetch does not read HTTPS_PROXY
const get = (url, binary) => execFileSync('curl', ['-sS', '--fail', '-m', '60', '-A', UA, url], { maxBuffer: 64 << 20, encoding: binary ? 'buffer' : 'utf8' });

mkdirSync(OUT, { recursive: true });
const css = get(CSS_URL, false);
const blocks = [...css.matchAll(/\/\* ([a-z-]+) \*\/\s*@font-face\s*\{([^}]+)\}/g)].map(m => ({ subset: m[1], body: m[2] })).filter(b => KEEP.has(b.subset));
if (blocks.length < 16) throw new Error(`expected at least 16 latin faces, got ${blocks.length}`);
const prop = (body, k) => { const m = new RegExp(k + '\\s*:\\s*([^;]+);').exec(body); return m ? m[1].trim() : ''; };
const out = ['/* Bundled by tools/fonts.mjs from Google Fonts (latin and latin-ext subsets). SIL Open Font License 1.1: see LICENSE.txt */'];
let bytes = 0, n = 0;
for (const b of blocks) {
  const family = prop(b.body, 'font-family').replace(/['"]/g, ''), style = prop(b.body, 'font-style'), weight = prop(b.body, 'font-weight'), stretch = prop(b.body, 'font-stretch'), range = prop(b.body, 'unicode-range');
  const url = /url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2)\)/.exec(b.body); if (!url) throw new Error('no woff2 url in ' + family);
  const file = `${family.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${weight}${style === 'italic' ? 'i' : ''}-${b.subset}.woff2`;
  const p = join(OUT, file);
  if (!existsSync(p)) writeFileSync(p, get(url[1], true));
  bytes += readFileSync(p).length; n++;
  out.push(`@font-face{font-family:'${family}';font-style:${style};font-weight:${weight};${stretch && stretch !== 'normal' ? `font-stretch:${stretch};` : ''}font-display:swap;src:url(${file}) format('woff2');unicode-range:${range}}`);
}
writeFileSync(join(OUT, 'fonts.css'), out.join('\n') + '\n');
writeFileSync(join(OUT, 'LICENSE.txt'), `The font files in this folder are redistributed under the SIL Open Font License, Version 1.1 (https://openfontlicense.org).

IBM Plex Sans, IBM Plex Sans Condensed, IBM Plex Mono: Copyright IBM Corp. (https://github.com/IBM/plex)
Bebas Neue: Copyright The Bebas Neue Project Authors (https://github.com/dharmatype/Bebas-Neue)
Open Sans: Copyright The Open Sans Project Authors (https://github.com/googlefonts/opensans)

Downloaded from Google Fonts by tools/fonts.mjs, latin and latin-ext subsets only, unmodified.
`);
console.log(`${n} faces, ${(bytes / 1024).toFixed(0)} KB → app/fonts/`);
