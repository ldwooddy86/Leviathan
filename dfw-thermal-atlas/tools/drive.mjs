// Drive the atlas in headless Chromium and report what a person would see: console errors, page errors, failed
// requests, and a screenshot. Used by the checks and by anyone debugging a module.
//   node tools/drive.mjs [--file <html>] [--module <key>] [--theme light|dark] [--width 1440] [--height 900]
//                        [--out shot.png] [--full] [--eval "<js run in the page, result printed>"] [--wait 600] [--all] [--live]
// --all visits every module in rail order and prints one line per module (errors, mount time), no screenshot unless --out
// is a directory. Exit code 1 when any page error or console error was seen.
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const a = process.argv.slice(2);
const opt = (k, d) => { const i = a.indexOf('--' + k); return i >= 0 ? a[i + 1] : d; };
const flag = k => a.includes('--' + k);
const file = resolve(opt('file', join(ROOT, 'dist', 'DFW_Thermal_Debt_Atlas.html')));
if (!existsSync(file)) { console.error(`no such file: ${file} (run "node build.mjs" first)`); process.exit(2); }
const width = +opt('width', 1440), height = +opt('height', 900), wait = +opt('wait', 600);
const theme = opt('theme', 'light'), out = opt('out', null), evalJs = opt('eval', null);

const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
const browser = await chromium.launch(proxy ? { proxy: { server: proxy } } : {});
const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, colorScheme: theme === 'dark' ? 'dark' : 'light' });
const page = await ctx.newPage();
/* the single file refreshes its live data when opened and a run is due; a check run must not call the public sources unless asked (--live) */
if (!flag('live')) await page.addInitScript(() => { try { if (!localStorage.getItem('tda.live.settings')) localStorage.setItem('tda.live.settings', JSON.stringify({ auto: false })); } catch (e) { } });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + (e.stack || e.message).split('\n').slice(0, 3).join(' | ')));
const notes = [];
/* images, fonts and stylesheets on hosts this sandbox cannot reach (the brand logo, Google Fonts) are noise here, not defects */
page.on('console', m => { if (m.type() !== 'error') return; const t = m.text(); if (/^Failed to load resource: net::ERR_(TUNNEL_CONNECTION_FAILED|NAME_NOT_RESOLVED|INTERNET_DISCONNECTED|PROXY_CONNECTION_FAILED|CONNECTION_RESET)/.test(t)) notes.push('blocked resource: ' + ((m.location() || {}).url || '')); else errors.push('console.error: ' + t.slice(0, 400)); });
page.on('requestfailed', r => { const u = r.url(), kind = r.resourceType(); if (['image', 'font', 'stylesheet', 'media'].includes(kind)) notes.push(`blocked ${kind}: ${u.slice(0, 160)}`); else errors.push('requestfailed: ' + u.slice(0, 200) + ' ' + (r.failure() || {}).errorText); });

const url = pathToFileURL(file).href;
async function visit(key) {
  const t0 = Date.now(); const before = errors.length;
  await page.goto(url + (key ? '#' + key : ''), { waitUntil: 'load' });
  await page.evaluate(k => { if (k && typeof showModule === 'function') showModule(k); }, key);
  await page.waitForTimeout(wait);
  return { ms: Date.now() - t0, errs: errors.slice(before) };
}

let bad = false;
if (flag('all')) {
  await page.goto(url, { waitUntil: 'load' });
  const mods = await page.evaluate(() => MODS.map(m => ({ key: m.key, num: m.num, title: m.title })));
  const dir = out && (!existsSync(out) || statSync(out).isDirectory()) ? out : null; if (dir) mkdirSync(dir, { recursive: true });
  for (const m of mods) {
    const r = await visit(m.key);
    const failed = await page.evaluate(k => { const s = document.getElementById('mod-' + k); return !!(s && s.querySelector('.callout .ct') && /failed to load/i.test(s.querySelector('.callout .ct').textContent)); }, m.key);
    const size = await page.evaluate(k => document.getElementById('mod-' + k).innerHTML.length, m.key);
    const ovf = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    console.log(`${m.num} ${m.key.padEnd(9)} ${String(r.ms).padStart(5)}ms html=${String(size).padStart(7)} overflowX=${ovf}px ${failed ? 'MOUNT FAILED ' : ''}${r.errs.length ? 'ERRORS: ' + r.errs.join(' || ') : 'ok'}`);
    if (failed || r.errs.length) bad = true;
    if (dir) await page.screenshot({ path: join(dir, `${m.num}-${m.key}-${theme}-${width}.png`), fullPage: flag('full') });
  }
} else {
  const key = opt('module', '');
  const r = await visit(key);
  if (evalJs) { try { const v = await page.evaluate(evalJs); console.log('eval →', typeof v === 'string' ? v : JSON.stringify(v, null, 1)); } catch (e) { console.log('eval threw:', e.message); bad = true; } }
  if (out) { mkdirSync(dirname(resolve(out)), { recursive: true }); await page.screenshot({ path: out, fullPage: flag('full') }); console.log('screenshot →', resolve(out)); }
  console.log(`${key || '(default)'}: ${r.ms}ms, ${errors.length} error(s)${notes.length ? ', ' + [...new Set(notes)].length + ' resource(s) blocked by the sandbox network (ignored)' : ''}`); errors.forEach(e => console.log('  ' + e));
  if (errors.length) bad = true;
}
await browser.close();
process.exit(bad ? 1 : 0);
