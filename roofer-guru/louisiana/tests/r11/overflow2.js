/* The same, on the map with buildings loaded (network on), as the layout test does it. node overflow2.js <atlas.html> [width] */
const { chromium } = require('playwright'), path = require('path');
(async () => {
  const W = +(process.argv[3] || 1400), proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined, browser = await chromium.launch({ proxy });
  const page = await (await browser.newContext({ viewport: { width: W, height: 1000 }, colorScheme: 'dark' })).newPage();
  await page.goto('file://' + path.resolve(process.argv[2]) + '#rooftops', { waitUntil: 'load', timeout: 180000 }); await page.waitForTimeout(1500);
  await page.evaluate(() => MODI.rooftops.api.goTo(29.9716, -90.0829, 18));
  for (const wait of [6000, 10000, 12000]) { await page.waitForTimeout(wait);
    console.log(JSON.stringify(await page.evaluate(() => {
      const W = window.innerWidth, out = [], docW = document.documentElement.scrollWidth;
      document.querySelectorAll('body *').forEach(e => { const r = e.getBoundingClientRect(); if (r.width > 0 && r.right > W + 2) { const p = e.parentElement, pr = p ? p.getBoundingClientRect() : null; if (!pr || pr.right <= W + 2 || p === document.body) out.push({ tag: e.tagName, id: e.id, cls: String(e.className && e.className.baseVal != null ? e.className.baseVal : e.className).slice(0, 70), left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width), hidden: getComputedStyle(e).visibility + '/' + getComputedStyle(e).position, text: (e.textContent || '').replace(/\s+/g, ' ').slice(0, 80) }); } });
      return { docW, W, st: MODI.rooftops.api.status ? (() => { const s = MODI.rooftops.api.status(); return { n: s.buildings || s.n, queued: s.queued }; })() : null, out: out.slice(0, 10) };
    }), null, 1)); }
  await browser.close();
})().catch(e => { console.error('ERROR', e); process.exit(2); });
