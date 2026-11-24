/* California port of tests/layout.js (CA/scout/tests/la_port/port_suites.py) */
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
  const browser = await chromium.launch({ proxy });
  for (const [name, vp, theme] of [['phone-dark', { width: 390, height: 844 }, 'dark'], ['desktop-dark', { width: 1400, height: 1000 }, 'dark'], ['w1280-light', { width: 1280, height: 900 }, 'light'], ['w1024-light', { width: 1024, height: 800 }, 'light']]) {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, colorScheme: theme });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e)));
    await page.goto('file://' + path.resolve(process.argv[2]) + '#rooftops', { waitUntil: 'load', timeout: 240000 });
    await page.waitForTimeout(4000);
    await page.evaluate(() => MODI.rooftops.api.goTo(37.7570, -122.4187, 18));
    await page.waitForTimeout(25000);
    const over = await page.evaluate(() => ({ docW: document.documentElement.scrollWidth, winW: window.innerWidth, wide: [...document.querySelectorAll('#mod-rooftops *')].filter(e => { const r = e.getBoundingClientRect(); return r.width && r.right > innerWidth + 1 && !e.closest('.leaflet-container, .sc-3d, table, .tablewrap, [style*="overflow"]'); }).map(e => (e.id || e.className || e.tagName) + '').slice(0, 6), theme: document.documentElement.dataset.theme || 'system' }));
    await page.locator('.sc-grid').screenshot({ path: path.join(process.argv[3], name + '.png'), timeout: 60000 }).catch(e => console.log('shot failed', e.message.split('\n')[0]));
    console.log(name, JSON.stringify(over), 'errors:', errs.length ? errs : 'none');
    await ctx.close();
  }
  await browser.close();
})();
