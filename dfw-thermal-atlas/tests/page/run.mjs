/* Page tests: the atlas driven in headless Chromium, one fresh page per test file, no network.
     node tests/page/run.mjs [name-filter] [--file <single-file.html>] [--keep]
   Builds the single file edition into a temporary folder (or uses --file), then runs every tests/page/*.page.mjs.
   A test file exports default async (page, t, ctx): t.ok(condition, label, detail), t.eq(actual, expected, label),
   t.note(text); ctx.show(key) opens a module and waits for it; ctx.download(clickFn) returns { name, text } of a file the
   page saves; ctx.errors is the list of page errors and console errors so far. Exits 1 on any failed check. */
import { createRequire } from 'node:module';
import { mkdtempSync, readdirSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '..', '..');
const a = process.argv.slice(2), opt = k => { const i = a.indexOf('--' + k); return i >= 0 ? a[i + 1] : null; };
const filter = a.find((x, i) => !x.startsWith('--') && a[i - 1] !== '--file');
let file = opt('file'), tmp = null;
if (!file) {
  tmp = mkdtempSync(join(tmpdir(), 'tda-page-'));
  const r = spawnSync(process.execPath, [join(ROOT, 'build.mjs'), '--dist', tmp], { encoding: 'utf8' });
  if (r.status !== 0) { console.error(r.stdout + r.stderr); process.exit(1); }
  file = join(tmp, 'DFW_Thermal_Debt_Atlas.html');
}
const url = pathToFileURL(resolve(file)).href;
const tests = readdirSync(HERE).filter(f => f.endsWith('.page.mjs') && (!filter || f.includes(filter))).sort();
const browser = await chromium.launch();
let failed = 0, passed = 0;
for (const f of tests) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const page = await context.newPage();
  /* no live refresh from a test: the page must not call the public sources */
  await page.addInitScript(() => { try { if (!localStorage.getItem('tda.live.settings')) localStorage.setItem('tda.live.settings', JSON.stringify({ auto: false })); } catch (e) { } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/^Failed to load resource/.test(m.text())) errors.push('console.error: ' + m.text().slice(0, 300)); });
  const lines = []; let bad = 0;
  const t = {
    ok(cond, label, detail) { lines.push(`  ${cond ? 'PASS' : 'FAIL'}  ${label}${detail !== undefined && (!cond || process.env.VERBOSE) ? '  (' + String(typeof detail === 'string' ? detail : JSON.stringify(detail)).replace(/\s+/g, ' ').slice(0, 400) + ')' : ''}`); if (cond) passed++; else { bad++; failed++; } return !!cond; },
    eq(actual, expected, label) { return t.ok(JSON.stringify(actual) === JSON.stringify(expected), label, `got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`); },
    note(text) { lines.push('  NOTE  ' + text); },
  };
  const ctx = {
    url, errors,
    async show(key, payload) { await page.evaluate(([k, p]) => showModule(k, p || undefined), [key, payload || null]); await page.waitForTimeout(150); },
    async download(click) { const [d] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), click()]); const p = await d.path(); return { name: d.suggestedFilename(), text: readFileSync(p, 'utf8') }; },
    async fresh(storage) { await page.evaluate(s => { localStorage.clear(); localStorage.setItem('tda.live.settings', JSON.stringify({ auto: false })); for (const k in (s || {})) localStorage.setItem(k, typeof s[k] === 'string' ? s[k] : JSON.stringify(s[k])); }, storage || null); await page.goto(url, { waitUntil: 'load' }); },
  };
  try {
    await page.goto(url, { waitUntil: 'load' });
    const mod = await import(pathToFileURL(join(HERE, f)).href);
    await mod.default(page, t, ctx);
  } catch (e) { t.ok(false, 'the test ran to the end', (e.stack || e.message).split('\n').slice(0, 4).join(' | ')); }
  console.log(`${bad ? 'FAIL' : 'ok  '}  ${f}`); if (bad || process.env.VERBOSE) console.log(lines.join('\n')); else console.log(lines.filter(l => l.startsWith('  NOTE')).join('\n') || '');
  await context.close();
}
await browser.close();
if (tmp && !a.includes('--keep')) rmSync(tmp, { recursive: true, force: true });
console.log(`\n${passed} checks passed, ${failed} failed, ${tests.length} files`);
process.exit(failed ? 1 : 0);
