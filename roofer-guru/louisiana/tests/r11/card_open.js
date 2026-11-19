/* The outlook card with its fold-out open, desktop and phone: a picture, the page's width, and the fold-out's text. node card_open.js <atlas.html> <outdir> [lat lon] */
const { chromium } = require('playwright'), path = require('path'), fs = require('fs');
(async () => {
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined, browser = await chromium.launch({ proxy }); fs.mkdirSync(process.argv[3], { recursive: true });
  const la = +(process.argv[4] || 30.3859), lo = +(process.argv[5] || -91.1431);
  for (const [name, vp] of [['desktop', { width: 1400, height: 1000 }], ['phone', { width: 390, height: 844 }]]) {
    const page = await (await browser.newContext({ viewport: vp, deviceScaleFactor: 2 })).newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e)));
    await page.goto('file://' + path.resolve(process.argv[2]) + '#rooftops', { waitUntil: 'load', timeout: 180000 }); await page.waitForTimeout(1500);
    await page.evaluate(([a, b]) => MODI.rooftops.api.goTo(a, b, 18), [la, lo]); await page.waitForTimeout(16000);
    const el = page.locator('.sc-out').first(); const n = await el.count(); let txt = '';
    if (n) { await page.evaluate(() => { const d = document.querySelector('.sc-out details'); if (d) d.open = true; }); await el.scrollIntoViewIfNeeded(); await el.screenshot({ path: path.join(process.argv[3], 'open-' + name + '.png') }); txt = await page.evaluate(() => { const d = document.querySelector('.sc-out details'); return d ? d.innerText.replace(/\s+/g, ' ') : '(no fold-out)'; }); }
    console.log(name, 'card:', n, 'docW', await page.evaluate(() => document.documentElement.scrollWidth), 'errors:', errs.length ? errs : 'none', '|', txt.slice(0, name === 'desktop' ? 2600 : 200));
  }
  await browser.close();
})().catch(e => { console.error('ERROR', e); process.exit(2); });
