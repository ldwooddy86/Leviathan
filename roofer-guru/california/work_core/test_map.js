const { chromium } = require('playwright'); const path = require('path');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 860 } })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e && e.stack || e).slice(0, 500)));
  await page.goto('file://' + path.resolve(process.argv[2]) + '#stock', { waitUntil: 'load', timeout: 240000 }); await wait(3500);
  await page.locator('#k7Map').screenshot({ path: 'out/map-stock.png', timeout: 120000 });
  await page.evaluate(() => { toggleTheme(); const s = document.getElementById('k7Reg'); s.value = '5'; s.onchange({ target: s }); }); await wait(1500);
  await page.locator('#k7Map').screenshot({ path: 'out/map-bay-dark.png', timeout: 120000 });
  await page.evaluate(() => document.getElementById('k7Mat').scrollIntoView()); await wait(500);
  await page.screenshot({ path: 'out/stock-mat.png', timeout: 120000 });
  console.log('ERRORS:', errs.length ? errs.join('\n') : 'none'); await browser.close();
})();
