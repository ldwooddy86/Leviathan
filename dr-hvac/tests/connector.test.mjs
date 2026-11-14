/* The connector plugin under PHP: syntax, then every route against the stand in for WordPress in tests/wp/stubs.php, once
   as a site with Elementor and once without. Skipped with a notice when no php binary is on the path.
   This is not a real WordPress; tests/wp/README.md says how to run the same checks against one. */
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { suite, ROOT } from './lib/load.mjs';
const { ok, done } = suite();
const here = path.dirname(fileURLToPath(import.meta.url));
const php = spawnSync('php', ['-v'], { encoding: 'utf8' });
if (php.error || php.status !== 0) { console.log('skip  no php binary: the connector plugin was not exercised'); process.exit(0); }
const ver = (php.stdout.match(/PHP (\d+\.\d+\.\d+)/) || [])[1];
const lint = spawnSync('php', ['-l', path.join(ROOT, 'src/connector/drhvac-connector.php')], { encoding: 'utf8' });
ok(lint.status === 0 && /No syntax errors/.test(lint.stdout), `the plugin has no syntax errors under PHP ${ver}`, lint.stdout.trim() + lint.stderr.trim());
for (const withEl of ['1', '0']) {
  const r = spawnSync('php', [path.join(here, 'wp', 'run.php')], { encoding: 'utf8', env: Object.assign({}, process.env, { WITH_ELEMENTOR: withEl }) });
  const lines = r.stdout.split('\n'); const pass = lines.filter(l => l.startsWith('ok ')).length; const bad = lines.filter(l => l.startsWith('FAIL'));
  ok(r.status === 0 && pass >= 40 && !bad.length && !/Fatal error|Parse error/.test(r.stdout + r.stderr), `every route scenario passes ${withEl === '1' ? 'with' : 'without'} Elementor (${pass} checks)`, bad.slice(0, 3).join(' | ') + r.stderr.slice(0, 200));
}
done();
