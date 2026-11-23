/* Sky job: opens the test bed, jumps the engine from place to place and takes pictures; prints what the sky kit says.
   node tests/run.js <testbed.html> <plan.json> <outdir>
   plan: { addr, shots: [{ name, lat, lon | pos (js returning [lat, lon], `en` in scope), yaw, pitch, mode, sun (hour), js, wait, q }] } */
const { chromium } = require('playwright'); const path = require('path'), fs = require('fs');
const FILE = path.resolve(process.argv[2]), PLAN = JSON.parse(fs.readFileSync(process.argv[3], 'utf8')), OUT = path.resolve(process.argv[4] || 'shots');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
  const browser = await chromium.launch({ proxy, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 1 })).newPage();
  const errs = []; page.on('pageerror', e => { errs.push(String(e && e.stack || e)); console.log('PAGEERROR', String(e && e.stack || e).slice(0, 700)); });
  page.on('console', m => { const t = m.text(); if (/sky kit/.test(t) || (m.type() === 'error' && !/Failed to load resource|net::|CORS|404|403/.test(t))) console.log('console', m.type(), t.slice(0, 400)); });
  await page.goto('file://' + FILE + '#rooftops', { waitUntil: 'load', timeout: 180000 }); await wait(1500);
  const settle = async (max) => { const t0 = Date.now(); while (Date.now() - t0 < (max || 120000)) { await wait(2000); const st = await page.evaluate(() => MODI.rooftops.api.status()); if (!(st.queued + st.running) && !st.tiles.some(t => t.st === 'load' || t.st === 'queued') && st.tiles.some(t => t.st === 'ok' || t.st === 'err')) return st; } return null; };
  await page.fill('#scFind', PLAN.addr); await page.press('#scFind', 'Enter'); await settle(150000); await wait(2000);
  await page.click('#scMode button[data-v="eng"]');
  for (let i = 0; i < 20; i++) { await wait(3000); const s = await page.evaluate(() => { const en = MODI.rooftops.api.en(); return en ? en.state().built : null; }); if (s != null && i > 3) break; }
  await page.evaluate(() => { const en = MODI.rooftops.api.en(); en.setGraphics({ q: 'low', sun: 13, weather: 'clear', life: false, wide: false }); });
  console.log('OPENED', PLAN.addr);
  for (const sh of PLAN.shots) {
    const t0 = Date.now();
    const info = await page.evaluate(async (sh) => { const en = MODI.rooftops.api.en(); try {
      en.setGraphics(Object.assign({ sun: sh.sun == null ? 13 : sh.sun }, sh.gfx || {})); let ll = sh.pos ? new Function('en', sh.pos)(en) : [sh.lat, sh.lon];
      if (sh.mode) en.setHeight(sh.mode); await en.open(ll[0], ll[1], sh.yaw || 0, { mode: sh.mode || 'street', pitch: sh.pitch == null ? 0 : sh.pitch });
      let r = sh.js ? new Function('en', sh.js)(en) : null; en.engine.wake(); en.engine.requestRender(8); return { ll, r }; } catch (e) { return { error: String(e && e.stack || e) }; } }, sh);
    if (info.error) { console.log('SHOT', sh.name, 'ERROR', info.error); continue; }
    for (let k = 0; k < Math.ceil((sh.wait || 30000) / 4000); k++) { await wait(4000); await page.evaluate(() => { const en = MODI.rooftops.api.en(); en.engine.wake(); en.engine.requestRender(4); }); }
    if (sh.after) await page.evaluate(js => new Function('en', js)(MODI.rooftops.api.en()), sh.after), await wait(sh.afterWait || 6000);
    const box = await page.evaluate(() => { const c = MODI.rooftops.api.en().canvas; c.scrollIntoView({ block: 'center' }); const r = c.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
    const out = await page.evaluate((sh) => { const en = MODI.rooftops.api.en(), i = en.sky.info(), st = en.state(), g = en.graphics(); let chk = null; try { chk = sh.check ? new Function('en', sh.check)(en) : null; } catch (e) { chk = 'check error ' + e; }
      return { air: st.air, airport: i.airport, km: i.km, hour: i.hour, landing: i.landing, departing: i.departing, arriving: i.arriving, depNow: i.departingNow, drawn: i.drawn, helos: i.helicopters, built: i.built, err: i.error, flights: (i.flights || []).slice(0, 6), fps: g.fps, ms: g.ms, draws: g.draws, tris: g.tris, check: chk }; }, sh);
    await page.screenshot({ path: path.join(OUT, sh.name + '.png'), timeout: 240000, clip: { x: Math.max(0, box.x), y: Math.max(0, box.y), width: Math.min(1100, box.width), height: Math.min(800, box.height) } });
    console.log('SHOT', sh.name, ((Date.now() - t0) / 1000).toFixed(0) + 's', JSON.stringify(out));
  }
  console.log('PAGE ERRORS:', errs.length ? errs.join('\n') : 'none');
  await browser.close();
})().catch(e => { console.error('ERROR', e); process.exit(2); });
