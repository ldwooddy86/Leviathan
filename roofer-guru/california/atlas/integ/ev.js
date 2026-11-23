/* Open the page and run a probe in it: node ev.js <page.html> <probe.js> [hash]
   The probe file holds one async function expression `async (page-side) => {...}` evaluated in the page; its return is printed. */
const { chromium } = require('playwright');
const path = require('path'); const fs = require('fs');
const FILE = path.resolve(process.argv[2]); const PROBE = fs.readFileSync(path.resolve(process.argv[3]), 'utf8'); const HASH = process.argv[4] || 'index';
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1, acceptDownloads: true });
  const page = await ctx.newPage();
  await ctx.route(/^https?:\/\//, r => r.abort());
  const errs = []; page.on('pageerror', e => errs.push(String(e && e.stack || e).slice(0, 700)));
  page.on('console', m => { if (m.type() === 'error' && !/net::ERR|Failed to load resource/.test(m.text())) errs.push('console: ' + m.text().slice(0, 300)); });
  await page.goto('file://' + FILE + '#' + HASH, { waitUntil: 'load', timeout: 300000 }); await wait(4000);
  const out = await page.evaluate('(' + PROBE + ')()');
  console.log(typeof out === 'string' ? out : JSON.stringify(out, null, 1));
  console.log('PAGE ERRORS (' + errs.length + '):', errs.length ? '\n' + [...new Set(errs)].join('\n---\n') : 'none');
  await browser.close();
})().catch(e => { console.error('ERROR', e); process.exit(2); });
