/* Rooftop Scout, California: the Scout Engine's bar and roof views. Opens the page at an address, picks the building,
   opens the engine (low quality, near only), then: reads the bar's rows; sets every roof view in turn and reads its
   legend and the number of roofs read; moves the rain scale (and the wind scale and sky where the engine has them);
   checks the Alta X rule and its exact warning. node engine_ca.js <page.html> "<address>" [shot.png]
   Software rendering is slow: a small window, and long waits. */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2]), ADDR = process.argv[3] || '1626 N Las Palmas Ave, Los Angeles, CA', SHOT = process.argv[4] || '';
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
  const browser = await chromium.launch({ proxy, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: 640, height: 480 }, deviceScaleFactor: 1 })).newPage();
  const errs = []; page.on('pageerror', e => errs.push('pageerror: ' + String((e && e.stack) || e).slice(0, 700)));
  await page.goto('file://' + FILE + '#rooftops', { waitUntil: 'load', timeout: 180000 });
  for (let i = 0; i < 30; i++) { if (await page.evaluate(() => typeof MODI !== 'undefined' && !!(MODI.rooftops && MODI.rooftops.api))) break; await wait(1500); }
  const settle = async (max) => { const t0 = Date.now(); while (Date.now() - t0 < (max || 120000)) { await wait(2000); const st = await page.evaluate(() => MODI.rooftops.api.status()); if (!(st.queued + st.running) && !st.tiles.some(t => t.st === 'load' || t.st === 'queued') && st.tiles.some(t => t.st === 'ok' || t.st === 'err')) return st; } return null; };
  await page.fill('#scFind', ADDR); await page.press('#scFind', 'Enter'); await settle(180000); await wait(3000);
  await page.evaluate(() => { setTimeout(() => document.querySelector('#scMode button[data-v="eng"]').click(), 0); });
  /* low quality at once: the software renderer cannot carry the wider city */
  for (let i = 0; i < 60; i++) { await wait(500); const ok = await page.evaluate(() => { const en = MODI.rooftops.api.en(); if (!en) return false; en.setGraphics({ q: 'low', sun: 15, weather: 'clear', life: false, wide: false, trees: false }); return true; }).catch(() => false); if (ok) break; }
  let s = null;
  for (let i = 0; i < 40; i++) { await wait(3000); s = await page.evaluate(() => { const en = MODI.rooftops.api.en(); if (!en) return null; const st = en.state(); return { built: st.built, queued: st.queued, roads: st.roads, mode: st.mode }; }); if (s && s.built > 10 && !s.queued && i > 4) break; }
  const out = { engine: s };
  await page.evaluate(() => { const en = MODI.rooftops.api.en(); en.setGraphics({ q: 'low', sun: 15, weather: 'clear', life: false, wide: false, trees: false }); en.setHeight('bird'); }); await wait(8000);
  out.has = await page.evaluate(() => MODI.rooftops.api.has());
  out.rows = await page.evaluate(() => [...document.querySelectorAll('#scEnBar .sc-enrow')].map(r => ({ label: (r.querySelector('.sc-enlab') || {}).textContent, buttons: [...r.querySelectorAll('button')].map(b => b.textContent.trim()).slice(0, 14), sliders: [...r.querySelectorAll('input[type=range]')].map(x => x.id) })));
  out.lens = {};
  const lenses = await page.evaluate(() => MODI.rooftops.api.lens.list.map(x => x[0]));
  for (const l of lenses) { if (l === 'off') continue;
    await page.evaluate(k => { const b = document.querySelector('#scEnBar [data-lens="' + k + '"]'); if (b) b.click(); }, l);
    let g = null; for (let i = 0; i < 25; i++) { await wait(2500); g = await page.evaluate(() => { const gg = MODI.rooftops.api.en().graphics(); return { lens: gg.lens, n: gg.lensN, pend: gg.lensPending }; }); if (g.lens === l && g.n > 0 && !g.pend) break; }
    const leg = await page.evaluate(() => { const e = document.querySelector('.se-legend, .se-leg'); return e ? e.innerText.replace(/\s+/g, ' ').slice(0, 420) : ''; });
    out.lens[l] = { n: g.n, pend: g.pend, on: g.lens === l, leg };
    if (l === 'storm') {
      const setR = async v => { await page.evaluate(x => { const r = document.querySelector('#scEnRain'); r.value = x; r.dispatchEvent(new Event('input', { bubbles: true })); r.dispatchEvent(new Event('change', { bubbles: true })); }, v); await wait(6000); return page.evaluate(() => { const e = document.querySelector('.se-legend, .se-leg'), en = MODI.rooftops.api.en(), g2 = en.graphics(); return { wx: Object.assign({}, MODI.rooftops.api.wx), line: document.querySelector('#scEnStormO').innerText.slice(0, 200), fly: document.querySelector('.sc-fly').textContent, flyTitle: document.querySelector('.sc-fly').title, altaTitle: document.querySelector('#scEnBar [data-h="alta"]').title, engStorm: g2.storm, engName: g2.stormInfo && g2.stormInfo.name, leg: e ? e.innerText.replace(/\s+/g, ' ').slice(0, 300) : '' }; }); };
      out.rain1 = await setR(1); out.rain6 = await setR(6); out.rain8 = await setR(8);
      await setR(0);
    }
  }
  out.where = await page.evaluate(() => (document.querySelector('#scEnWhere') || {}).innerText || '');
  out.barText = await page.evaluate(() => document.querySelector('#scEnBar').innerText.replace(/\s+/g, ' ').slice(0, 900));
  console.log(JSON.stringify(out, null, 1));
  if (SHOT) { try { await page.screenshot({ path: SHOT, timeout: 90000 }); } catch (e) { console.log('no picture: the software renderer did not hand one over in 90 s'); } }
  console.log('PAGE ERRORS:', errs.length ? errs.join('\n') : 'none');
  await browser.close();
})().catch(e => { console.error('ERROR', e); process.exit(2); });
