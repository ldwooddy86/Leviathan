/* Rooftop Scout, California: a picture of the building card at an address (no engine), and a check that nothing on the
   module's page runs wider than the window. node shot_card.js <page.html> "<address>" <out.png> */
const { chromium } = require('playwright');
const path = require('path');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
  const browser = await chromium.launch({ proxy, args: ['--disable-gpu'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(String((e && e.stack) || e).slice(0, 400)));
  await page.goto('file://' + path.resolve(process.argv[2]) + '#rooftops', { waitUntil: 'load', timeout: 180000 });
  for (let i = 0; i < 30; i++) { if (await page.evaluate(() => typeof MODI !== 'undefined' && !!(MODI.rooftops && MODI.rooftops.api))) break; await wait(1500); }
  await page.fill('#scFind', process.argv[3]); await page.press('#scFind', 'Enter');
  for (let i = 0; i < 60; i++) { await wait(2000); const st = await page.evaluate(() => MODI.rooftops.api.status()); if (!(st.queued + st.running) && st.tiles.some(t => t.st === 'ok')) break; } await wait(5000);
  const o = await page.evaluate(() => { const w = document.documentElement.clientWidth, wide = [...document.querySelectorAll('.sc *')].filter(e => e.getBoundingClientRect().right > w + 2 && e.offsetParent && !e.closest('.sc-map, .tscroll, .leaflet-container')).slice(0, 5).map(e => e.tagName + '.' + e.className); return { scrollW: document.documentElement.scrollWidth, w, wide, name: document.querySelector('#scName').textContent, text: document.querySelector('#scDetail').innerText.slice(0, 6000) }; });
  console.log(JSON.stringify({ scrollW: o.scrollW, w: o.w, wide: o.wide, name: o.name })); console.log(o.text);
  const el = await page.$('#scDetail'); if (el && process.argv[4]) { await el.scrollIntoViewIfNeeded(); await page.screenshot({ path: process.argv[4], fullPage: true, timeout: 120000 }).catch(e => console.log('no picture', String(e).slice(0, 100))); }
  console.log('PAGE ERRORS:', errs.length ? errs.join('\n') : 'none');
  await browser.close();
})().catch(e => { console.error('ERROR', e); process.exit(2); });
