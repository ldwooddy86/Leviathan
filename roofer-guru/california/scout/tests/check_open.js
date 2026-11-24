/* The short check: the Scout tab opens at Coronado, the card is drawn, the Scout Engine opens with its bar (Roof View,
   Move with the M3, Weather with both scales, the sky and the aircraft switch), one roof view reads roofs, no page errors.
   node check_open.js <page.html> */
const L = require('./lib.js');
(async () => {
  const { page, errs, close } = await L.launch({ w: 1100, h: 800, hard: 6 }); const C = L.checker(), wait = L.wait;
  await L.openPage(page, process.argv[2]); const st = await L.find(page, '1100 Orange Ave, Coronado, CA');
  const card = await page.evaluate(() => ({ name: document.querySelector('#scName').textContent, len: document.querySelector('#scDetail').innerText.length, topo: document.querySelectorAll('#scDetail .sc-topo-sec').length, n: MODI.rooftops.api.buildings().length }));
  C.ok(st && card.n > 20 && card.len > 3000 && card.topo === 1, 'the Scout tab opens at Coronado, the card is drawn', card);
  const s = await L.engine(page, {}); C.ok(s && s.built > 20, 'the Scout Engine opens', s);
  const bar = await page.evaluate(() => { const b = document.querySelector('#scEnBar'), q = s => !!b.querySelector(s); return { rows: [...b.querySelectorAll('.sc-enrow .sc-enlab')].map(e => e.textContent), lenses: b.querySelectorAll('[data-lens]').length, m3: q('[data-h="m3"]'), rain: +b.querySelector('#scEnRain').max + 1, wind: +b.querySelector('#scEnWind').max + 1, sky: b.querySelectorAll('[data-sky]').length, air: q('[data-eg^="air:"]'), sound: q('[data-a="sound"]'), fly: b.querySelector('.sc-fly').textContent, where: b.querySelector('#scEnWhere').innerText.slice(0, 140) }; });
  C.ok(bar.rows.join() === 'Roof View,Move,Weather' && bar.lenses === 9 && bar.m3 && bar.rain === 9 && bar.wind === 6 && bar.sky === 4 && bar.air && bar.sound, 'the bar: Roof View, Move with the M3, Weather with nine and six steps, four skies, the aircraft switch', bar);
  await page.click('#scEnBar [data-lens="cover"]'); let g = null; for (let i = 0; i < 20; i++) { await wait(2500); g = await page.evaluate(() => { const g = MODI.rooftops.api.en().graphics(); return { lens: g.lens, n: g.lensN, pend: g.lensPending }; }); if (g.n > 0 && !g.pend) break; }
  C.ok(g && g.lens === 'cover' && g.n > 5, 'the Covering view reads roofs', g);
  await page.click('#scEnBar [data-h="m3"]'); await wait(5000); const car = await page.evaluate(() => { const st = MODI.rooftops.api.en().state(); return { mode: st.mode, car: !!st.car, pad: document.querySelector('#scEnPad [data-k="down"]').textContent, where: document.querySelector('#scEnWhere').innerText.slice(0, 90) }; });
  C.ok(car.mode === 'm3' && car.car && car.pad === 'Handbrake', 'the M3 comes out by its button, with its pad', car);
  console.log('PAGE ERRORS:', errs.length ? errs.length + '\n' + [...new Set(errs)].slice(0, 8).join('\n') : 'none'); console.log(C.bad ? C.bad + ' FAILED' : 'all pass');
  await close(); process.exit(C.bad || errs.length ? 1 : 0);
})().catch(e => { console.error('ERROR', e); process.exit(2); });
