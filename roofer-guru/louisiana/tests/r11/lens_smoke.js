/* The roof views in the Scout Engine: open it on an address, full window, drone height; each view in turn with its key,
   its counts and a picture. node lens_smoke.js <atlas.html> <outdir> [address] */
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const FILE = path.resolve(process.argv[2]), OUT = path.resolve(process.argv[3] || '.'), ADDR = process.argv[4] || '632 Woodgate Blvd, Baton Rouge, LA';
fs.mkdirSync(OUT, { recursive: true });
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
  const browser = await chromium.launch({ proxy, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: +(process.env.VW || 960), height: +(process.env.VH || 600) }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errs = [], logs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + (e && e.stack || e)));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text().slice(0, 300)); });
  await page.goto('file://' + FILE + '#rooftops', { waitUntil: 'load', timeout: 180000 });
  await wait(1500);
  const settle = async (max) => { const t0 = Date.now(); while (Date.now() - t0 < (max || 120000)) { await wait(2000); const st = await page.evaluate(() => MODI.rooftops.api.status()); if (!(st.queued + st.running) && !st.tiles.some(t => t.st === 'load' || t.st === 'queued') && st.tiles.some(t => t.st === 'ok' || t.st === 'err')) return st; } return null; };
  await page.fill('#scFind', ADDR); await page.press('#scFind', 'Enter');
  await settle(150000); await wait(2500);
  console.log('picked:', await page.evaluate(() => { const t = document.querySelector('#scName'); return t && t.textContent; }));
  await page.click('#scMode button[data-v="eng"]');
  for (let i = 0; i < 25; i++) { await wait(3000); const s = await page.evaluate(() => { const en = MODI.rooftops.api.en(); if (!en) return null; const st = en.state(); return { built: st.built, queued: st.queued, roads: st.roads, trees: st.trees }; }); if (s && s.built > 20 && !s.queued && s.roads && i > 5) break; }
  await page.evaluate(() => { const en = MODI.rooftops.api.en(); en.setGraphics({ q: 'medium', day: 'summer', sun: 15, weather: 'clear', life: false, live: false, wide: false }); en.setHeight('drone'); });
  await page.click('#scEnBar [data-a="full"]'); await wait(9000);
  const snap = async (name) => { try { await page.screenshot({ path: path.join(OUT, name), timeout: 150000 }); } catch (e) { console.log('   (no picture ' + name + ': ' + String(e.message).split('\n')[0] + ')'); } };
  console.log('card outlook:', (await page.evaluate(() => { const e = document.querySelector('#scDetail .sc-out'); return e ? e.innerText.replace(/\s+/g, ' ') : '(none)'; })).slice(0, 1500));
  await snap('lens-0-off.png');
  const read = async (lens, extra) => {
    await page.evaluate(([l, x]) => { const en = MODI.rooftops.api.en(); en.setGraphics(Object.assign({ lens: l }, x || {})); }, [lens, extra || null]);
    let g = null; for (let i = 0; i < 40; i++) { await wait(1500); g = await page.evaluate(() => { const g = MODI.rooftops.api.en().graphics(); return { lens: g.lens, n: g.lensN, pending: g.lensPending, year: g.year, day: g.day, fps: g.fps, refused: g.refused, tier: g.tier, sunAlt: g.sunAlt }; }); if (g.n > 5 && !g.pending) break; }
    const leg = await page.evaluate(() => { const l = document.querySelector('.se-legend'); return l && !l.hidden ? l.innerText.replace(/\s+/g, ' ') : '(hidden)'; });
    const lbl = await page.evaluate(() => [...document.querySelectorAll('.se-lbl')].filter(e => e.style.display !== 'none').map(e => e.textContent).slice(0, 8));
    console.log(`== ${lens} ${JSON.stringify(extra || {})} ->`, JSON.stringify(g)); console.log('   legend:', leg.slice(0, 1300)); console.log('   labels:', JSON.stringify(lbl));
    return g;
  };
  await read('thermal'); await snap('lens-1-thermal-july-15h.png');
  await page.evaluate(() => MODI.rooftops.api.en().setGraphics({ sun: 9 })); await wait(8000); await read('thermal'); await snap('lens-1b-thermal-july-9h.png');
  await page.evaluate(() => MODI.rooftops.api.en().setGraphics({ day: 'winter', sun: 13 })); await wait(8000); await read('thermal'); await snap('lens-1c-thermal-jan-13h.png');
  await page.evaluate(() => MODI.rooftops.api.en().setGraphics({ day: 'summer', sun: 15 })); await wait(3000);
  await read('wear'); await snap('lens-2-wear.png');
  await read('time', { year: 5 }); await snap('lens-3-time-05.png');
  await read('time', { year: 15 }); await snap('lens-3-time-15.png');
  await page.evaluate(() => MODI.rooftops.api.en().setHeight('orbit')); await wait(7000); await snap('lens-4-time-15-orbit.png');
  await read('wear'); await snap('lens-4-wear-orbit.png');
  await read('thermal'); await snap('lens-4-thermal-orbit.png');
  console.log('bar:', (await page.evaluate(() => document.querySelector('#scEnBar').innerText)).replace(/\s+/g, ' ').slice(0, 700));
  const dbg = await page.evaluate(() => { const en = MODI.rooftops.api.en(), d = en.debug(), m = [...en.lensMap.values()]; return { err: d.err, programs: d.programs, lensMeshes: m.filter(x => x.mesh).length, tris: m.reduce((t, x) => t + (x.mesh ? x.mesh.tris : 0), 0), canopy: m.filter(x => x.G).map(x => +x.G.canopy.toFixed(2)).slice(0, 12), lum: m.filter(x => x.G).map(x => x.G.lum == null ? null : +x.G.lum.toFixed(2)).slice(0, 12) }; });
  console.log('debug:', JSON.stringify(dbg));
  console.log('PAGE ERRORS:', errs.length ? errs.join('\n') : 'none');
  console.log('CONSOLE:', logs.length ? [...new Set(logs)].filter(l => !/overpass|ERR_FAILED|504|willReadFrequently/.test(l)).slice(0, 20).join('\n') || 'none but network' : 'none');
  await browser.close();
})().catch(e => { console.error('ERROR', e); process.exit(2); });
