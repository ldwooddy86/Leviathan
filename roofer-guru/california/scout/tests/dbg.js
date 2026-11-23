/* debug: open the page and print what a snippet returns. node dbg.js <page.html> "<js expression>" [hash] */
const { chromium } = require('playwright');
const path = require('path');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
  const browser = await chromium.launch({ proxy, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: 1100, height: 900 } })).newPage();
  const errs = []; page.on('pageerror', e => errs.push('pageerror: ' + String((e && e.stack) || e).slice(0, 900))); page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 300)); });
  await page.goto('file://' + path.resolve(process.argv[2]) + (process.argv[4] || '#rooftops'), { waitUntil: 'load', timeout: 180000 }); await wait(3000);
  let r; try { r = await page.evaluate(process.argv[3]); } catch (e) { r = 'EVAL ERROR ' + e; }
  console.log(typeof r === 'string' ? r : JSON.stringify(r));
  console.log('ERRORS:', errs.length ? errs.slice(0, 12).join('\n') : 'none');
  await browser.close();
})().catch(e => { console.error('ERROR', e); process.exit(2); });
