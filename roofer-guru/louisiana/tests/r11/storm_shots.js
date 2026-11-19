/* The storm scale in the Scout Engine: open it on an address, step the scale, take a picture at each step and say what the
   engine reports. node storm_shots.js <atlas.html> <outdir> [levels, comma separated] [height] [address] */
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const FILE = path.resolve(process.argv[2]), OUT = path.resolve(process.argv[3] || '.'), LEVELS = (process.argv[4] || '0,1,3,5,9').split(',').map(Number), HEIGHT = process.argv[5] || 'drone', ADDR = process.argv[6] || '632 Woodgate Blvd, Baton Rouge, LA';
const Q = process.env.Q || 'low', VW = +(process.env.VW || 1100), VH = +(process.env.VH || 760), HOLD = +(process.env.HOLD || 9000);
fs.mkdirSync(OUT, { recursive: true });
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
  const browser = await chromium.launch({ proxy, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1 })).newPage();
  const errs = [], logs = []; page.on('pageerror', e => errs.push('pageerror: ' + (e && e.stack || e))); page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text().slice(0, 400)); });
  await page.goto('file://' + FILE + '#rooftops', { waitUntil: 'load', timeout: 180000 }); await wait(1500);
  const settle = async (max) => { const t0 = Date.now(); while (Date.now() - t0 < (max || 120000)) { await wait(2000); const st = await page.evaluate(() => MODI.rooftops.api.status()); if (!(st.queued + st.running) && !st.tiles.some(t => t.st === 'load' || t.st === 'queued') && st.tiles.some(t => t.st === 'ok' || t.st === 'err')) return st; } return null; };
  await page.fill('#scFind', ADDR); await page.press('#scFind', 'Enter'); await settle(150000); await wait(2500);
  await page.click('#scMode button[data-v="eng"]');
  for (let i = 0; i < 25; i++) { await wait(3000); const s = await page.evaluate(() => { const en = MODI.rooftops.api.en(); if (!en) return null; const st = en.state(); return { built: st.built, queued: st.queued, roads: st.roads }; }); if (s && s.built > 20 && !s.queued && s.roads && i > 5) break; }
  await page.evaluate(([q, h]) => { const en = MODI.rooftops.api.en(); en.setGraphics({ q, sun: 15, weather: 'cloudy' }); en.setHeight(h); }, [Q, HEIGHT]);
  await page.click('#scEnBar [data-a="full"]').catch(() => {}); await wait(6000);
  const box = await page.evaluate(() => { const r = document.querySelector('.se-canvas').getBoundingClientRect(); return { x: Math.max(0, r.left), y: Math.max(0, r.top), width: Math.min(r.width, innerWidth - Math.max(0, r.left)), height: Math.min(r.height, innerHeight - Math.max(0, r.top)) }; }); const cv = { screenshot: o => page.screenshot(Object.assign({ clip: box, timeout: 120000, animations: 'disabled' }, o)) };
  for (const n of LEVELS) {
    const info = await page.evaluate(k => MODI.rooftops.api.en().storm(k), n); await wait(HOLD);
    await cv.screenshot({ path: path.join(OUT, `storm-${HEIGHT}-${n}.png`) });
    const g = await page.evaluate(() => { const g = MODI.rooftops.api.en().graphics(), e = MODI.rooftops.api.en().engine.scene.env; return { fps: g.fps, ms: g.ms, tris: g.tris, draws: g.draws, refused: g.refused, broken: g.broken, fog: +e.fogDensity.toFixed(5), wet: +e.wetness.toFixed(2), wind: +e.wind.toFixed(2), clouds: e.clouds, surge: g.surge, tier: g.tier }; });
    console.log(n, JSON.stringify(info), JSON.stringify(g));
    if (info.cat || n === 3) { await page.evaluate(() => { const en = MODI.rooftops.api.en(); en.stormKit.freezeFlash = true; en.stormKit.strike(en.engine.camera); }); await wait(2500); await cv.screenshot({ path: path.join(OUT, `storm-${HEIGHT}-${n}-flash.png`) }); await page.evaluate(() => { MODI.rooftops.api.en().stormKit.freezeFlash = false; }); await wait(800); }
  }
  console.log('PAGE ERRORS:', errs.length ? errs.join('\n') : 'none'); console.log('CONSOLE:', logs.length ? [...new Set(logs)].slice(0, 12).join('\n') : 'none');
  await browser.close();
})().catch(e => { console.error('ERROR', e); process.exit(2); });
