/* Rebuilds vendor/anthropic-sdk.min.js from the pinned @anthropic-ai/sdk in node_modules (npm install first).
   One classic script, no eval, no dynamic import, so it loads under the browser app's script-src 'self' policy and
   inline in the single file edition. The build refuses a bundle that carries either construct or a closing script tag. */
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(HERE, 'node_modules/@anthropic-ai/sdk/package.json'), 'utf8'));
const out = path.join(HERE, 'vendor/anthropic-sdk.min.js');
const banner = `/*! @anthropic-ai/sdk ${pkg.version} (Apache-2.0, https://github.com/anthropics/anthropic-sdk-typescript), cut down to the Messages and Models APIs for Dr. HVAC. License text: vendor/LICENSE-anthropic-sdk.txt */`;
await build({ entryPoints: [path.join(HERE, 'vendor/anthropic-sdk.entry.mjs')], bundle: true, format: 'iife', globalName: 'AnthropicSDK', platform: 'browser', target: ['chrome116', 'firefox115'], minify: true, legalComments: 'none', define: { __SDK_VERSION__: JSON.stringify(pkg.version) }, banner: { js: banner }, outfile: out, logLevel: 'warning' });
let js = fs.readFileSync(out, 'utf8');
/* a string inside the SDK names import() in an error message; nothing calls it. Checked on the code with strings removed. */
const code = js.replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/g, '""');
const bad = [[/\beval\s*\(/, 'eval('], [/new\s+Function\s*\(/, 'new Function('], [/\bimport\s*\(/, 'import(']].filter(([re]) => re.test(code)).map(x => x[1]);
if (bad.length) throw new Error('the bundle uses ' + bad.join(', ') + ': it would not load under script-src \'self\'');
if (/<\/script/i.test(js)) { js = js.replace(/<\/script/gi, '<\\/script'); fs.writeFileSync(out, js); }
fs.copyFileSync(path.join(HERE, 'node_modules/@anthropic-ai/sdk/LICENSE'), path.join(HERE, 'vendor/LICENSE-anthropic-sdk.txt'));
console.log(`vendor/anthropic-sdk.min.js  @anthropic-ai/sdk ${pkg.version}  ${(fs.statSync(out).size / 1024).toFixed(1)} KB`);
