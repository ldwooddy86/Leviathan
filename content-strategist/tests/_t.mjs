/* shared by the tests: a counter, the fixtures, a scratch folder outside the repository */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export const DIR = path.dirname(fileURLToPath(import.meta.url));
export const FX = path.join(DIR, 'fixtures');
export const ROOT = path.resolve(DIR, '..');
let fails = 0;
export const ok = (c, label, extra) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${label}${extra !== undefined ? '  (' + String(typeof extra === 'string' ? extra : JSON.stringify(extra)).replace(/\s+/g, ' ').slice(0, 300) + ')' : ''}`); if (!c) fails++; };
export const done = () => { if (fails) { console.log(`\n${fails} failed`); process.exit(1); } };
export const read = f => fs.readFileSync(path.join(FX, f), 'utf8');
export const json = f => JSON.parse(read(f));
export const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'cs-test-'));
