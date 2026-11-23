/* debug: open the engine at an address and report whether it comes up. node dbg_engine.js <page.html> "<address>" */
const { chromium } = require('playwright');
const path = require('path');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
  const browser = await chromium.launch({ proxy, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: 800, height: 600 } })).newPage();
  const log = []; page.on('pageerror', e => log.push('pageerror: ' + String((e && e.stack) || e).slice(0, 900))); page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') log.push('console.' + m.type() + ': ' + m.text().slice(0, 300)); }); page.on('crash', () => log.push('PAGE CRASHED'));
  await page.goto('file://' + path.resolve(process.argv[2]) + '#rooftops', { waitUntil: 'load', timeout: 180000 });
  for (let i = 0; i < 30; i++) { if (await page.evaluate(() => typeof MODI !== 'undefined' && !!(MODI.rooftops && MODI.rooftops.api))) break; await wait(1500); }
  await page.fill('#scFind', process.argv[3] || '1626 N Las Palmas Ave, Los Angeles, CA'); await page.press('#scFind', 'Enter'); await wait(25000);
  console.log('before', JSON.stringify(await page.evaluate(() => ({ n: MODI.rooftops.api.buildings().length, heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : null }))));
  await page.evaluate(() => { setTimeout(() => document.querySelector('#scMode button[data-v="eng"]').click(), 0); });
  /* low quality at once: the software renderer cannot carry the wider city */
  for (let i = 0; i < 60; i++) { await wait(500); const ok = await page.evaluate(() => { const en = MODI.rooftops.api.en(); if (!en) return false; en.setGraphics({ q: 'low', sun: 15, weather: 'clear', life: false, wide: false, trees: false }); return true; }).catch(() => false); if (ok) break; }
  for (let i = 0; i < 20; i++) { await wait(5000); let r; try { r = await page.evaluate(() => { const en = MODI.rooftops.api.en(); const st = en ? en.state() : null; return { en: !!en, built: st && st.built, queued: st && st.queued, heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : null, bar: (document.querySelector('#scEnBar') || {}).innerText ? document.querySelector('#scEnBar').innerText.length : 0 }; }); } catch (e) { r = 'EVAL: ' + String(e).slice(0, 200); } console.log(i, JSON.stringify(r)); if (typeof r === 'string') break; }
  console.log('LOG:', log.length ? log.slice(0, 15).join('\n') : 'none');
  await browser.close();
})().catch(e => { console.error('ERROR', e); process.exit(2); });
