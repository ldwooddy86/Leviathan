/* node t_leak.js <test.html>: page heap (after a full collection asked through the debugger) when ready, while Legion's
   view is mounted with its crowd built, and after unmount; twice, to see that nothing piles up. */
const { chromium } = require('playwright'); const path = require('path');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const killer = setTimeout(() => { console.error('HARD TIMEOUT'); process.exit(3); }, 400000);
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-precise-memory-info'] });
  try {
    const page = await (await browser.newContext({ viewport: { width: 1400, height: 760 } })).newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e)));
    const cdp = await page.context().newCDPSession(page); await cdp.send('HeapProfiler.enable');
    const mem = async () => { for (let i = 0; i < 3; i++) { await cdp.send('HeapProfiler.collectGarbage'); await wait(400); } const u = await cdp.send('Runtime.getHeapUsage'); return Math.round(u.usedSize / 1048576); };
    await page.goto('file://' + path.resolve(process.argv[2]), { waitUntil: 'load' }); const out = { start: await mem() };
    await page.evaluate(async () => { await window.__LEGION_LOAD__(); }); out.loaded = await mem();
    await page.evaluate(async () => { await window.__LEGION__.ready(); }); out.ready = await mem();
    for (let k = 1; k <= 2; k++) {
      await page.evaluate(async () => { const wait = ms => new Promise(r => setTimeout(r, ms)); const h = window.__LEGION__.mount(document.querySelector('#legion-host'), { zip: '90012' }); await h.ready;
        for (let i = 0; i < 120 && (h.legion.stage.build.building || !h.legion.crowd || !h.legion.crowd.summary); i++) await wait(500); await wait(1000); });
      out['mounted' + k] = await mem(); out['workers' + k] = page.workers().length;
      await page.evaluate(() => { window.__LEGION__.unmount(); }); await wait(2000); out['unmounted' + k] = await mem();
    }
    out.workersEnd = page.workers().length; console.log(JSON.stringify(out), 'errors', errs.length);
  } finally { await browser.close(); clearTimeout(killer); }
})().catch(e => { console.error('ERROR', e); process.exit(2); });
