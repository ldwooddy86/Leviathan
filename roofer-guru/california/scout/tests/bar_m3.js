/* The engine bar against the real stack, part 1: the M3, by real clicks and keys.
   node bar_m3.js <page.html> ["address"] [shot dir] */
const L = require('./lib.js'), path = require('path');
const FILE = process.argv[2], ADDR = process.argv[3] || '1100 Orange Ave, Coronado, CA', DIR = process.argv[4] || '';
(async () => {
  const { page, errs, close } = await L.launch({ w: 900, h: 720, hard: 14 }); const C = L.checker(), wait = L.wait;
  await L.openPage(page, FILE); await L.find(page, ADDR);
  const s0 = await L.engine(page, { life: true }); C.ok(s0 && s0.built > 5, 'engine opens', s0);
  const ev = f => page.evaluate(f);
  const car = () => page.evaluate(() => { const en = MODI.rooftops.api.en(), st = en.state(), c = st.car; return { mode: st.mode, car: c && { mph: +(+c.mph).toFixed(1), gear: c.gear, rpm: Math.round(c.rpm), tc: c.tc, onRoad: c.onRoad, grip: c.grip, driving: c.driving }, cam: en.graphics().carCam, where: (document.querySelector('#scEnWhere') || {}).innerText.slice(0, 330) }; });
  /* the button, its tooltip and the keys help */
  const btn = await ev(() => { const b = document.querySelector('#scEnBar [data-h="m3"]'), en = MODI.rooftops.api.en(); return b && { text: b.textContent, title: b.title, note: en.car.note, keys: en.car.keys, short: en.car.short, same: b.title === en.car.note }; });
  C.ok(btn && btn.text === 'BMW M3' && btn.same, 'M3 button, tooltip is en.car.note', btn);
  await page.click('#scEnBar [data-h="m3"]'); await wait(7000);
  let c = await car(); C.ok(c.mode === 'm3' && c.car, 'click takes the car out', c);
  const pad = async () => ev(() => [...document.querySelectorAll('#scEnPad button')].map(b => ({ k: b.dataset.k, hidden: b.hidden || getComputedStyle(b).display === 'none', label: b.getAttribute('aria-label'), title: b.title, text: b.textContent })));
  console.log('     pad', JSON.stringify(await pad()));
  console.log('     car group', JSON.stringify(await ev(() => [...document.querySelectorAll('#scEnBar [data-car]')].map(b => ({ a: b.dataset.car, text: b.textContent, title: b.title, pressed: b.getAttribute('aria-pressed') })))));
  if (DIR) await L.shot(page, path.join(DIR, 'm3_bar.png'), { x: 0, y: 0, width: 900, height: 720 });
  /* the pad: throttle held with the mouse */
  const hold = async (k, ms) => { await ev(() => document.querySelector('#scEnPad').scrollIntoView({ block: 'center' })); await wait(400); const b = await page.$('#scEnPad button[data-k="' + k + '"]'); const r = await b.boundingBox(); if (!r) return false; await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2); await page.mouse.down(); await wait(ms); const mid = await car(); await page.mouse.up(); return mid; };
  let m = await hold('fwd', 9000); C.ok(m && m.car && m.car.mph > 3, 'pad: throttle held moves the car', m && m.car);
  m = await hold('left', 900); console.log('     steer left held', JSON.stringify(m && m.car));
  m = await hold('back', 6000); C.ok(m && m.car && m.car.mph < 15, 'pad: brake held slows it (then reverses)', m && m.car);
  await wait(2500); c = await car(); console.log('     after brake', JSON.stringify(c.car));
  /* handbrake on the pad */
  await ev(() => document.querySelector('#scEnBar').scrollIntoView({ block: 'start' })); await page.click('#scEnBar [data-car="reset"]'); await wait(2500);
  const hb = await ev(() => { const b = document.querySelector('#scEnPad button[data-k="down"]'); return b && { hidden: b.hidden, label: b.getAttribute('aria-label'), title: b.title }; });
  C.ok(hb && !hb.hidden && /handbrake/i.test(hb.label + hb.title), 'pad shows Handbrake for the M3', hb);
  await page.keyboard.down('w'); await wait(100); await page.keyboard.up('w'); m = await hold('fwd', 7000); const v0 = m.car.mph; await wait(300); const c1 = await car(); m = await hold('down', 2500); C.ok(m.car.mph < c1.car.mph - 3, 'pad: Handbrake held slows the car', { atThrottle: v0, before: c1.car.mph, held: m.car.mph });
  const up = await ev(() => { const b = document.querySelector('#scEnPad button[data-k="up"]'); return b && { hidden: b.hidden || getComputedStyle(b).display === 'none' }; });
  C.ok(up && up.hidden, 'pad hides Climb for the M3', up);
  /* keys: W then S, then space */
  await page.click('#scEnBar [data-car="reset"]'); await wait(2500); await ev(() => MODI.rooftops.api.en().canvas.focus()); await page.keyboard.down('w'); await wait(8000); c = await car(); await page.keyboard.up('w');
  C.ok(c.car && c.car.mph > 3 && c.car.gear >= 1, 'key W drives', c.car);
  C.ok(/Driving the M3 on [^:]+: \d+ mph, gear \d, [\d,]+ rpm, traction control (on|working)/.test(c.where), 'status sentence: speed, gear, rpm, traction control', c.where);
  const b0 = await car(); await page.keyboard.down('Space'); await wait(3000); c = await car(); await page.keyboard.up('Space'); C.ok(c.car.mph < b0.car.mph - 3, 'Space: handbrake slows the car', { before: b0.car.mph, held: c.car.mph });
  /* the car's buttons */
  const cams = []; for (let i = 0; i < 4; i++) { await page.click('#scEnBar [data-car="camera"]'); await wait(900); cams.push(await ev(() => ({ g: MODI.rooftops.api.en().graphics().carCam, text: document.querySelector('#scEnBar [data-car="camera"]').textContent }))); }
  C.ok(new Set(cams.map(x => x.g)).size === 4 && cams.every(x => /seat|bonnet|behind|round/i.test(x.text)), 'Camera cycles four views and names each', cams);
  await page.click('#scEnBar [data-car="tc"]'); await wait(900); let t1 = await ev(() => ({ tc: MODI.rooftops.api.en().state().car.tc, text: document.querySelector('#scEnBar [data-car="tc"]').textContent, pressed: document.querySelector('#scEnBar [data-car="tc"]').getAttribute('aria-pressed') }));
  C.ok(/off/i.test(t1.text) && t1.pressed === 'false', 'Traction control off by its button, and the button says so', t1);
  await page.click('#scEnBar [data-car="tc"]'); await wait(900); t1 = await ev(() => ({ tc: MODI.rooftops.api.en().state().car.tc, text: document.querySelector('#scEnBar [data-car="tc"]').textContent }));
  C.ok(/: on/i.test(t1.text), 'Traction control back on', t1);
  const hasRev = await ev(() => !!document.querySelector('#scEnBar [data-car="reverse"]')); C.ok(hasRev, 'a Reverse button');
  if (hasRev) { await wait(3000); await page.click('#scEnBar [data-car="reverse"]'); await wait(600); await ev(() => MODI.rooftops.api.en().canvas.focus()); await page.keyboard.down('w'); await wait(6000); c = await car(); await page.keyboard.up('w'); C.ok(c.car && c.car.gear === -1, 'Reverse: throttle backs the car', c.car); C.ok(/reverse/i.test(c.where), 'status sentence says reverse', c.where);
    await page.click('#scEnBar [data-car="reverse"]'); await wait(600); }
  await page.click('#scEnBar [data-car="reset"]'); await wait(4000); c = await car(); C.ok(c.car && c.car.onRoad && Math.abs(c.car.mph) < 3, 'Back onto the road', c.car);
  if (DIR) await L.shot(page, path.join(DIR, 'm3_view.png'));
  /* leaving and returning */
  await page.click('#scEnBar [data-h="street"]'); await wait(3000); c = await car(); C.ok(c.mode === 'street' && (!c.car || !c.car.driving), 'leaving the car', c);
  const padS = await pad(); C.ok(padS.find(x => x.k === 'down').hidden, 'pad drops Handbrake on foot', padS.find(x => x.k === 'down'));
  await page.click('#scEnBar [data-h="m3"]'); await wait(5000); c = await car(); C.ok(c.mode === 'm3' && c.car && c.car.driving, 'returning to the car', c);
  const what = await ev(() => (document.querySelector('#scEnWhat') || {}).innerText); C.ok(/The M3\./.test(what) && /251 mph is this dashboard/.test(what) && /Traffic/.test(what), 'captions: the M3 and the traffic say what is measured, chosen, generated', what);
  await page.click('#scEnBar [data-h="drone"]'); await wait(2000);
  console.log('PAGE ERRORS:', errs.length ? errs.length + '\n' + [...new Set(errs)].slice(0, 8).join('\n') : 'none'); console.log(C.bad ? C.bad + ' FAILED' : 'all pass');
  await close(); process.exit(C.bad || errs.length ? 1 : 0);
})().catch(e => { console.error('ERROR', e); process.exit(2); });
