// Unit tests: Node 22, no packages.   node tests/run.mjs [name-filter]
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const filter = process.argv[2];
const files = readdirSync(here).filter(f => f.endsWith('.test.mjs') && (!filter || f.includes(filter))).sort().map(f => join(here, f));
const r = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
process.exit(r.status ?? 1);
