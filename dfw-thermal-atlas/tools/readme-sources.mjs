// Writes the table of live sources in README.md from the collectors themselves, so the table can never drift from the code.
//   node tools/readme-sources.mjs            rewrite the block between <!-- SOURCES:BEGIN --> and <!-- SOURCES:END -->
//   node tools/readme-sources.mjs --check    exit 1 when the README is out of step (used by the tests)
import vm from 'node:vm';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { liveList } from '../build.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..'), APP = join(ROOT, 'app'), README = join(ROOT, 'README.md');
const BEGIN = '<!-- SOURCES:BEGIN -->', END = '<!-- SOURCES:END -->';

export function sources() {
  const ctx = vm.createContext({ console, setTimeout, clearTimeout, URL, URLSearchParams, AbortController, TextEncoder, TextDecoder, Promise, JSON, Math, Date, Intl });
  ctx.globalThis = ctx; ctx.self = ctx;
  for (const f of liveList()) vm.runInContext(readFileSync(join(APP, f), 'utf8'), ctx, { filename: f });
  return ctx.TDA_LIVE.SOURCES.map(s => ({ id: s.id, name: s.name, publisher: s.publisher, page: s.page, about: s.about, cadence: s.cadence, cors: s.cors !== false, grade: s.grade || '', hosts: s.hosts || [], key: s.key ? (s.keyRequired ? 'needs a free API key' : 'takes an optional free API key') : '' }));
}
const cell = t => String(t == null ? '' : t).replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
export function table() {
  const rows = sources();
  const head = '| Source | Publisher | What the atlas uses it for | Refresh | Grade | Where it runs |\n|---|---|---|---|---|---|';
  const body = rows.map(s => `| ${s.page ? `[${cell(s.name)}](${s.page})` : cell(s.name)} | ${cell(s.publisher)} | ${cell(s.about)}${s.key ? ' *(' + s.key + ')*' : ''} | ${s.cadence === 'daily' ? 'every morning' : 'weekly'} | ${cell(s.grade)} | ${s.cors ? 'browser app and single file' : 'browser app only'} |`).join('\n');
  const hosts = [...new Set(rows.flatMap(s => s.hosts))].sort();
  return `${rows.length} public sources, read with plain requests (no account, no cookies). The evidence grade runs from A (measured by the publisher) to D (stated).\n\n${head}\n${body}\n\nHosts the browser app may call for these: ${hosts.map(h => '`' + h + '`').join(', ')}. The Weather Desk also reads \`api.weather.gov\` and \`www.spc.noaa.gov\` when it is open.`;
}
export function render(readme) {
  const a = readme.indexOf(BEGIN), b = readme.indexOf(END);
  if (a < 0 || b < a) throw new Error('README.md lacks the SOURCES markers');
  return readme.slice(0, a + BEGIN.length) + '\n' + table() + '\n' + readme.slice(b);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const now = readFileSync(README, 'utf8'), next = render(now);
  if (process.argv.includes('--check')) { if (now !== next) { console.error('README.md source table is out of step: run node tools/readme-sources.mjs'); process.exit(1); } console.log('README.md source table is in step'); }
  else if (now === next) console.log('README.md source table already in step');
  else { writeFileSync(README, next); console.log('README.md source table rewritten'); }
}
