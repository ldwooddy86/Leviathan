/* Round 11 in one pass: the bar's rows, each new roof view (readings, key, picture), the storm scale from the slider, the
   Alta X refused, a craft warped from the bar's box. node r11_smoke.js <atlas.html> <outdir> [address] */
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const FILE = path.resolve(process.argv[2]), OUT = path.resolve(process.argv[3] || '.'), ADDR = process.argv[4] || '632 Woodgate Blvd, Baton Rouge, LA';
const Q = process.env.Q || 'low', VW = +(process.env.VW || 1280), VH = +(process.env.VH || 900);
fs.mkdirSync(OUT, { recursive: true });
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
  const browser = await chromium.launch({ proxy, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1 })).newPage();
  const errs = [], logs = []; page.on('pageerror', e => errs.push('pageerror: ' + (e && e.stack || e))); page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text().slice(0, 500)); });
  await page.goto('file://' + FILE + '#rooftops', { waitUntil: 'load', timeout: 180000 }); await wait(1500);
  const settle = async (max) => { const t0 = Date.now(); while (Date.now() - t0 < (max || 120000)) { await wait(2000); const st = await page.evaluate(() => MODI.rooftops.api.status()); if (!(st.queued + st.running) && !st.tiles.some(t => t.st === 'load' || t.st === 'queued') && st.tiles.some(t => t.st === 'ok' || t.st === 'err')) return st; } return null; };
  await page.fill('#scFind', ADDR); await page.press('#scFind', 'Enter'); await settle(150000); await wait(2500);
  await page.click('#scMode button[data-v="eng"]');
  for (let i = 0; i < 25; i++) { await wait(3000); const s = await page.evaluate(() => { const en = MODI.rooftops.api.en(); if (!en) return null; const st = en.state(); return { built: st.built, queued: st.queued, roads: st.roads }; }); if (s && s.built > 20 && !s.queued && s.roads && i > 5) break; }
  await page.evaluate(q => { const en = MODI.rooftops.api.en(); en.setGraphics({ q, sun: 15, weather: 'clear', life: false }); en.setHeight('drone'); }, Q); await wait(4000);
  const shot = name => page.screenshot({ timeout: 120000, animations: 'disabled', path: path.join(OUT, name + '.png') });
  console.log('rows:', JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('#scEnBar .sc-enrow')].map(r => r.innerText.replace(/\s+/g, ' ').slice(0, 170)))));
  await page.evaluate(() => document.querySelector('#scEnBar').scrollIntoView({ block: 'start' })); await wait(500); await shot('bar-1');
  const read = async lens => { await page.click(`#scEnBar [data-lens="${lens}"]`); for (let i = 0; i < 50; i++) { await wait(1500); const g = await page.evaluate(() => { const g = MODI.rooftops.api.en().graphics(); return [g.lensN, g.lensPending, g.lens]; }); if (g[0] > 5 && !g[1]) break; }
    const r = await page.evaluate(() => { const g = MODI.rooftops.api.en().graphics(), L = document.querySelector('.se-legend'); return { lens: g.lens, n: g.lensN, pending: g.lensPending, refused: g.refused, legend: L && !L.hidden ? L.innerText.replace(/\s+/g, ' ').slice(0, 620) : null, labels: [...document.querySelectorAll('.se-labels > *')].slice(0, 6).map(x => x.textContent) }; });
    console.log(lens + ':', JSON.stringify(r)); await shot('view-' + lens); };
  await read('cover'); await read('style');
  /* the storm scale from its slider, then the Storm view */
  await page.evaluate(() => { const s = document.querySelector('#scEnStorm'); s.value = 7; s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true })); }); await wait(2500);
  console.log('scale at 7:', JSON.stringify(await page.evaluate(() => ({ out: document.querySelector('#scEnStormO').innerText, fly: document.querySelector('.sc-fly').textContent, storm: MODI.rooftops.api.en().graphics().storm }))));
  await read('storm');
  await page.evaluate(() => { const s = document.querySelector('#scEnStorm'); s.value = 2; s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true })); }); await wait(9000);
  console.log('storm view in heavy rain:', JSON.stringify(await page.evaluate(() => { const g = MODI.rooftops.api.en().graphics(), L = document.querySelector('.se-legend'); return { n: g.lensN, pending: g.lensPending, legend: L.innerText.replace(/\s+/g, ' ').slice(0, 420) }; })));
  /* the Alta X button in heavy rain */
  await page.click('#scEnBar [data-h="alta"]'); await wait(1200);
  console.log('Alta X pressed in heavy rain:', JSON.stringify(await page.evaluate(() => { const w = document.querySelector('.se-warn'); return { mode: MODI.rooftops.api.en().state().mode, warn: w && !w.hidden ? w.textContent : null }; })));
  await shot('alta-refused');
  /* the saucer, and a warp typed into the bar */
  await page.click('#scEnBar [data-lens="off"]'); await page.click('#scEnBar [data-h="saucer"]'); await wait(4000);
  await page.fill('#scWarp', '30.2266, -93.2174'); await page.press('#scWarp', 'Enter');
  for (let i = 0; i < 30; i++) { await wait(1500); const s = await page.evaluate(() => { const en = MODI.rooftops.api.en(), s = en.state(); return { warp: s.uap && s.uap.warp, lat: +s.lat.toFixed(4), lon: +s.lon.toFixed(4), built: s.built, btn: (document.querySelector('#scWarpF button') || {}).textContent }; }); if (i % 3 === 0 || !s.warp) console.log('  warp', JSON.stringify(s)); if (!s.warp && i > 2) break; }
  await settle(90000); await wait(8000);
  console.log('after the warp:', JSON.stringify(await page.evaluate(() => { const en = MODI.rooftops.api.en(), s = en.state(), g = en.graphics(); return { mode: s.mode, uap: s.uap, lat: +s.lat.toFixed(4), lon: +s.lon.toFixed(4), built: s.built, surge: g.surge, surgeNote: g.surgeNote, info: document.querySelector('#scEnBar .sc-svinfo').innerText.replace(/\s+/g, ' ').slice(0, 160), where: document.querySelector('#scEnWhere').innerText.slice(0, 260) }; })));
  await shot('warp-arrived');
  await page.fill('#scWarp', '32.7767, -96.7970'); await page.press('#scWarp', 'Enter'); await wait(1500);
  console.log('a warp to Dallas:', JSON.stringify(await page.evaluate(() => ({ toast: [...document.querySelectorAll('.toast, .sc-toast, [role="status"]')].map(x => x.textContent).filter(Boolean).slice(-2), warp: MODI.rooftops.api.en().state().uap.warp }))));
  console.log('PAGE ERRORS:', errs.length ? errs.join('\n') : 'none'); console.log('CONSOLE:', logs.length ? [...new Set(logs)].filter(l => !/overpass|ERR_FAILED|504|willReadFrequently/.test(l)).slice(0, 12).join('\n') || 'only the known network notes' : 'none');
  await browser.close();
})().catch(e => { console.error('ERROR', e); process.exit(2); });
