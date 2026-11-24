/* how long the aircraft switch takes, and whether the page stays alive: node dbg_air.js <page.html> */
const L = require('./lib.js');
(async () => {
  const { page, errs, close } = await L.launch({ w: 900, h: 720, hard: 8 }); const wait = L.wait;
  page.on('console', m => { const t = m.text(); if (/sky kit|error|warn/i.test(t)) console.log('console:', t.slice(0, 300)); });
  await L.openPage(page, process.argv[2]); await L.find(page, process.argv[3] || '1100 Orange Ave, Coronado, CA');
  console.log('engine', JSON.stringify(await L.engine(page, {})));
  const t = async (label, f) => { const t0 = Date.now(); let r; try { r = await Promise.race([page.evaluate(f), new Promise(res => setTimeout(() => res('TIMEOUT 60 s'), 60000))]); } catch (e) { r = 'ERR ' + String(e).slice(0, 200); } console.log(label, Date.now() - t0, 'ms', JSON.stringify(r)); };
  await t('state', () => { const en = MODI.rooftops.api.en(); return { air: en.state().air, g: en.graphics().air, fps: en.graphics().fps, ground: en.state().ground, elev: en.state().elev, agl: en.state().agl }; });
  await t('air off (setGraphics)', () => { const en = MODI.rooftops.api.en(); const t0 = performance.now(); en.setGraphics({ air: false }); return { ms: Math.round(performance.now() - t0), air: en.state().air }; });
  await wait(3000); await t('state after', () => { const en = MODI.rooftops.api.en(); return { air: en.state().air, g: en.graphics().air, fps: en.graphics().fps, bar: document.querySelector('#scEnBar [data-eg^="air:"]').textContent }; });
  await t('air on (setGraphics)', () => { const en = MODI.rooftops.api.en(); const t0 = performance.now(); en.setGraphics({ air: true }); return { ms: Math.round(performance.now() - t0), air: en.state().air }; });
  await wait(4000); await t('state after', () => { const en = MODI.rooftops.api.en(); return { air: en.state().air, g: en.graphics().air, fps: en.graphics().fps }; });
  const t0 = Date.now(); try { await page.click('#scEnBar [data-eg^="air:"]', { timeout: 60000 }); console.log('real click', Date.now() - t0, 'ms'); } catch (e) { console.log('real click failed after', Date.now() - t0, String(e).slice(0, 300)); }
  await wait(2000); await t('state after click', () => { const en = MODI.rooftops.api.en(); return { air: en.state().air, g: en.graphics().air, line: (document.querySelector('#scEnAirO') || {}).innerText || '', btn: document.querySelector('#scEnBar [data-eg^="air:"]').textContent, where: document.querySelector('#scEnWhere').innerText.slice(0, 120) }; });
  console.log('PAGE ERRORS:', errs.length ? errs.join('\n') : 'none'); await close();
})().catch(e => { console.error('ERROR', e); process.exit(2); });
