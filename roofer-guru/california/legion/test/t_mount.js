/* node t_mount.js <test.html> <out dir>: the mount test (s_mount.js, s_mount2.js), with pictures, the number of
   workers and their memory at each step. Every request that is not file:, blob:, data: or about: is refused and listed. */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const FILE = path.resolve(process.argv[2]), OUT = path.resolve(process.argv[3] || 'out');
const run = (page, file, arg) => page.evaluate(new Function('arg', 'return (async () => {' + fs.readFileSync(path.join(__dirname, file), 'utf8') + '\n})()'), arg || null);
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const killer = setTimeout(() => { console.error('HARD TIMEOUT'); process.exit(3); }, 560000);
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-precise-memory-info'] });
  let bad = 0; const say = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d != null ? '  ' + JSON.stringify(d).slice(0, 420) : '')); if (!c) bad++; };
  try {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 760 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage(); const errs = [], refused = [];
    page.on('pageerror', e => errs.push(String(e && e.stack || e).slice(0, 500)));
    await ctx.route('**/*', r => { const u = r.request().url(); if (/^(file|blob|data|about):/.test(u)) return r.continue(); refused.push(u.slice(0, 200)); return r.abort(); });
    await page.goto('file://' + FILE, { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction("typeof window.__LEGION_LOAD__ === 'function' && !!window.HOST", null, { timeout: 60000 });
    const workerMem = async () => { const a = []; for (const w of page.workers()) { try { a.push(await w.evaluate(() => (self.performance && performance.memory) ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null)); } catch (e) { a.push('?'); } } return a; };
    const host0 = await page.evaluate(() => { const cs = (sel, prop) => getComputedStyle(document.querySelector(sel))[prop]; location.hash = '#rooftops';
      return { title: document.title, h1: cs('#host-title', 'color'), btn: cs('#host-button', 'backgroundColor'), font: cs('body', 'fontFamily'), bg: cs('body', 'backgroundColor'), panel: cs('#host-note', 'backgroundColor'), topbar: cs('#topbar', 'backgroundColor'),
        mapSize: HOST.map.getSize().x + 'x' + HOST.map.getSize().y, attrs: [...document.documentElement.attributes].map(a => a.name).join(','), bodyAttrs: [...document.body.attributes].map(a => a.name).join(','), kids: document.body.children.length, toasts: document.querySelector('#toasts').children.length }; });
    const sheets = await page.evaluate(() => [...document.styleSheets].length);
    console.log('workers before the library loads', page.workers().length);
    const a = await run(page, 's_mount.js'); a.checks.forEach(c => say(c[0], c[1], c[2]));
    console.log('     base', JSON.stringify(a.base), '| mount ms', a.mountMs, '| frame crowd', JSON.stringify(a.frameCrowd), '| page heap MB', JSON.stringify(a.mem));
    console.log('     workers while mounted', page.workers().length, 'worker heaps MB', JSON.stringify(await workerMem()));
    await page.screenshot({ path: path.join(OUT, 'mount_street.png'), timeout: 180000 });
    const b = await run(page, 's_mount2.js', { phase: 'street-close' }); b.checks.forEach(c => say(c[0], c[1], c[2]));
    await page.screenshot({ path: path.join(OUT, 'mount_map.png'), timeout: 180000 });
    const c = await run(page, 's_mount2.js', { phase: 'rest', host0, sheets }); c.checks.forEach(x => say(x[0], x[1], x[2]));
    console.log('     page heap MB', JSON.stringify(c.mem), '| stats', JSON.stringify(c.stats));
    await wait(1500);
    console.log('     workers after the second mount', page.workers().length);
    await page.evaluate(() => window.__LEGION__.unmount()); await wait(2500);
    const n = page.workers().length; say(n === 1, 'after unmount only the library\'s one worker is left (the frame\'s workers ended with it)', { workers: n, heapsMB: await workerMem() });
    say(errs.length === 0, 'no page errors', errs); say(refused.length === 0, 'no request left the page', refused);
    await page.screenshot({ path: path.join(OUT, 'mount_after.png'), timeout: 180000 });
  } finally { await browser.close(); clearTimeout(killer); }
  console.log(bad ? 'FAILED ' + bad : 'ALL OK'); process.exit(bad ? 1 : 0);
})().catch(e => { console.error('ERROR', e); process.exit(2); });
