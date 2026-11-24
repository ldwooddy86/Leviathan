/* Legion probe: opens a page (the original Legion.html or a test page), waits for a condition, runs a snippet inside
   it and prints the answer as JSON. Every request that is not file:, blob:, data: or about: is refused and listed, so
   nothing goes to an outside service from a test (no api.anthropic.com, no Overpass, no api.weather.gov).
   node probe.js <page.html> <snippet.js> [--wait "<js expression>"] [--w 1000] [--h 700] [--timeout 240] [--shot out.png]
   The snippet is the body of an async function; it may use `arg` (the JSON given with --arg). */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const A = process.argv.slice(2), opt = {}; const pos = [];
for (let i = 0; i < A.length; i++) { if (A[i].startsWith('--')) opt[A[i].slice(2)] = A[++i]; else pos.push(A[i]); }
const FILE = path.resolve(pos[0]), SNIP = fs.readFileSync(pos[1], 'utf8');
const W = +(opt.w || 1000), H = +(opt.h || 700), TMO = 1000 * +(opt.timeout || 240);
const WAITFOR = opt.wait || "document.documentElement.dataset.state === 'ready' && !!window.legion";
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const killer = setTimeout(() => { console.error('HARD TIMEOUT'); process.exit(3); }, TMO + 60000);
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-precise-memory-info'] });
  try {
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const errs = [], refused = [], logs = [];
    page.on('pageerror', e => errs.push(String(e && e.stack || e).slice(0, 700)));
    page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text().slice(0, 300)); });
    await ctx.route('**/*', r => { const u = r.request().url(); if (/^(file|blob|data|about):/.test(u)) return r.continue(); refused.push(u.slice(0, 200)); return r.abort(); });
    const t0 = Date.now();
    await page.goto('file://' + FILE + (opt.hash || ''), { waitUntil: 'load', timeout: TMO });
    const tLoad = Date.now() - t0;
    await page.waitForFunction(WAITFOR, null, { timeout: TMO, polling: 500 });
    const tReady = Date.now() - t0;
    if (opt.settle) await wait(1000 * +opt.settle);
    let out;
    try { out = await page.evaluate(new Function('arg', 'return (async () => {' + SNIP + '\n})()'), opt.arg ? JSON.parse(opt.arg) : null); }
    catch (e) { out = { EVAL_ERROR: String(e && e.message || e).slice(0, 1500) }; }
    if (opt.shot) await page.screenshot({ path: opt.shot, timeout: 180000 });
    console.log(JSON.stringify({ tLoad, tReady, out, errs, refused, logs: logs.slice(0, 20) }, null, 1));
  } finally { await browser.close(); clearTimeout(killer); }
})().catch(e => { console.error('ERROR', e); process.exit(2); });
