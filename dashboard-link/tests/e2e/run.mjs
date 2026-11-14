/* Runs every tests/e2e/*.test.mjs in its own process and reports. `node dashboard-link/tests/e2e/run.mjs [filter]`
   These open a real dashboard in headless Chromium through Playwright. Where no browser is available each file says
   so and passes, and this runner reports it as skipped. Set ATLAS_HTML to a dashboard file to test that one as well. */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const dir = path.dirname(fileURLToPath(import.meta.url));
const filter = process.argv[2] || '';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.test.mjs') && f.includes(filter)).sort();
let fail = 0, skip = 0;
for (const f of files) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [path.join(dir, f)], { encoding: 'utf8', timeout: 900000 });
  const ok = r.status === 0, skipped = ok && /^skip /m.test(r.stdout || '');
  if (!ok) fail++; if (skipped) skip++;
  console.log(`${!ok ? 'FAIL' : skipped ? 'SKIP' : 'PASS'}  ${f}  (${Date.now() - t0} ms)${skipped ? '  ' + (r.stdout.match(/^skip +(.*)$/m) || [])[1] : ''}`);
  if (!ok) { console.log((r.stdout || '').split('\n').filter(l => !l.startsWith('ok ')).slice(-40).join('\n')); console.log(r.stderr || ''); }
  else if (process.env.VERBOSE) console.log(r.stdout);
}
console.log(`\n${files.length - fail - skip} passed, ${skip} skipped, ${fail} failed`);
process.exit(fail ? 1 : 0);
