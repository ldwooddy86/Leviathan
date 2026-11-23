/* Screens of the weather, step by step, at California addresses, on the test bed page.
   node shots.js <testbed.html> <plan.json> <outdir>
   plan: [{ addr, shots: [{ name, h (street|drone|bird|metro|saucer), js (run with `en` in scope), steps (0.05 s steps of the kit's clock, by hand), wait (ms) }] }] */
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const FILE = path.resolve(process.argv[2]), PLAN = JSON.parse(fs.readFileSync(process.argv[3], 'utf8')), OUT = path.resolve(process.argv[4] || 'shots');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
  const browser = await chromium.launch({ proxy, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 1 })).newPage();
  const errs = []; page.on('pageerror', e => { errs.push('pageerror: ' + (e && e.stack || e)); console.log('PAGEERROR', String(e && e.stack || e).slice(0, 600)); });
  page.on('console', m => { if (m.type() === 'error') { const t = m.text(); if (!/Failed to load resource|net::|CORS|404|403/.test(t)) console.log('console.error', t.slice(0, 300)); } });
  await page.goto('file://' + FILE + '#rooftops', { waitUntil: 'load', timeout: 180000 }); await wait(1500);
  const settle = async (max) => { const t0 = Date.now(); while (Date.now() - t0 < (max || 120000)) { await wait(2000); const st = await page.evaluate(() => MODI.rooftops.api.status()); if (!(st.queued + st.running) && !st.tiles.some(t => t.st === 'load' || t.st === 'queued') && st.tiles.some(t => t.st === 'ok' || t.st === 'err')) return st; } return null; };
  let first = true;
  for (const place of PLAN) {
    await page.fill('#scFind', place.addr); await page.press('#scFind', 'Enter'); await settle(150000); await wait(2500);
    if (first) { await page.click('#scMode button[data-v="eng"]'); first = false; }
    let s = null;
    for (let i = 0; i < 30; i++) { await wait(3000); s = await page.evaluate(() => { const en = MODI.rooftops.api.en(); if (!en) return null; const st = en.state(); return { built: st.built, queued: st.queued, roads: st.roads, lat: st.lat, lon: st.lon }; }); if (s && s.built > 20 && !s.queued && s.roads && i > 5) break; }
    console.log('PLACE', place.addr, JSON.stringify(s));
    await page.evaluate(() => { const en = MODI.rooftops.api.en(); en.setGraphics({ q: 'low', sun: 13, weather: 'clear', life: false, wide: false, storm: 0, wind: 0, skyState: 0, snowLevel: null, elevation: null }); }); await wait(4000);
    for (const sh of place.shots) {
      const info = await page.evaluate(({ js, steps, h }) => { const en = MODI.rooftops.api.en(); if (h) en.setHeight(h); let r; try { r = new Function('en', js || '')(en); } catch (e) { return { error: String(e && e.stack || e) }; }
        const SK = en.stormKit, cam = en.engine.camera; for (let i = 0; i < (steps || 0); i++) SK.update(0.05, cam, true); en.engine.requestRender(6);
        const st = en.state(), wx = SK.info(); return { r: r === undefined ? null : r, text: wx.text, gust: st.gustMph, rain: st.rainMmH, precip: st.precip, fly: st.altaCanFly, elev: st.elevationM, snowLevel: st.snowLevelM, vis: st.visKm, mode: st.mode, now: SK.now && { snow: +SK.now.snow.toFixed(2), pond: +SK.now.pond.toFixed(2), wet: +SK.now.wet.toFixed(2), fog: +SK.now.fog.toFixed(5) } }; }, { js: sh.js, steps: sh.steps == null ? 700 : sh.steps, h: sh.h });
      await wait(sh.wait || 9000);
      const box = await page.evaluate(() => { const c = MODI.rooftops.api.en().canvas; c.scrollIntoView({ block: 'center' }); const r = c.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
      await wait(800);
      await page.screenshot({ path: path.join(OUT, sh.name + '.png'), timeout: 180000, clip: { x: Math.max(0, box.x), y: Math.max(0, box.y), width: Math.min(1100, box.width), height: Math.min(800, box.height) } });
      console.log('SHOT', sh.name, JSON.stringify(info));
    }
  }
  console.log('PAGE ERRORS:', errs.length ? errs.join('\n') : 'none');
  await browser.close();
})().catch(e => { console.error('ERROR', e); process.exit(2); });
