/* Unit tests: node tests/run.mjs. Runs every tests/*.test.mjs in its own process (some set the time zone). */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const files = fs.readdirSync(DIR).filter(f => f.endsWith('.test.mjs')).sort();
let failed = 0, passed = 0;
for (const f of files) {
  const r = spawnSync(process.execPath, [path.join(DIR, f)], { encoding: 'utf8', timeout: 300000 });
  const out = (r.stdout || '') + (r.stderr || '');
  process.stdout.write(out);
  passed += (out.match(/^PASS /gm) || []).length;
  const f2 = (out.match(/^FAIL /gm) || []).length;
  failed += f2;
  if (r.status !== 0 && !f2) { failed++; console.log(`FAIL  ${f}: exited with ${r.status}${r.signal ? ' (' + r.signal + ')' : ''}`); }
}
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
