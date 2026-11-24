/* The engine bar against the real stack, part 2: the rain scale's nine steps and the dry wind scale's six by the arrow
   keys on the sliders, the four sky states and what is held off when, the snow line and elevation read-outs, the Alta
   X rule with its exact warning in rain and in offshore wind, the aircraft switch and its read-out, sound.
   node bar_wx.js <page.html> ["address"] [shot dir] */
const L = require('./lib.js'), path = require('path');
const FILE = process.argv[2], ADDR = process.argv[3] || '1100 Orange Ave, Coronado, CA', DIR = process.argv[4] || '';
const NOFLY = "Don't waste a $40,000 drone, stupid. Use the UAPs.";
(async () => {
  const { page, errs, close } = await L.launch({ w: 900, h: 720, hard: 14 }); const C = L.checker(), wait = L.wait;
  await L.openPage(page, FILE); await L.find(page, ADDR);
  const s0 = await L.engine(page, {}); C.ok(s0 && s0.built > 5, 'engine opens', s0);
  const ev = (f, a) => page.evaluate(f, a);
  const read = () => ev(() => { const en = MODI.rooftops.api.en(), st = en.state(), g = en.graphics(), I = en.weather(); const q = s => document.querySelector(s);
    return { stormKey: st.stormKey, windKey: st.windKey, windName: st.windName, sky: st.sky, skyOn: st.skyOn, gust: st.gustMph, sus: st.sustainedMph, rain: st.rainMmH, precip: st.precip, snowM: st.snowLevelM, elev: st.elev, elevM: st.elevationM, vis: st.visKm, fly: st.altaCanFly, held: I.sky && I.sky.held, flyWhy: I.flyWhy,
      line: q('#scEnStormO').innerText, flyChip: q('.sc-fly').textContent, flyTitle: q('.sc-fly').title, altaTitle: q('#scEnBar [data-h="alta"]').title, altaStruck: q('#scEnBar [data-h="alta"]').classList.contains('nofly'), rainTick: (q('#scEnRain').parentNode.querySelector('.sc-stormt i.on') || {}).textContent, windTick: (q('#scEnWind').parentNode.querySelector('.sc-stormt i.on') || {}).textContent, rainVal: q('#scEnRain').getAttribute('aria-valuetext'), windVal: q('#scEnWind').getAttribute('aria-valuetext'), skyPressed: [...document.querySelectorAll('#scEnBar [data-sky][aria-pressed="true"]')].map(b => b.dataset.sky).join(), where: q('#scEnWhere').innerText.slice(0, 160) }; });
  const key = async (sel, k) => { const ok = await ev(s => { const e = document.querySelector(s); if (!e) return false; e.focus({ preventScroll: true }); return document.activeElement === e; }, sel); if (!ok) { console.log('     NO ' + sel, JSON.stringify(await ev(() => ({ bar: document.querySelector('#scEnBar').innerText.slice(0, 200), hidden: document.querySelector('#scEnW').hidden, mode: document.querySelector('#scMode [aria-pressed="true"]').textContent })))); throw new Error('no ' + sel); } await page.keyboard.press(k); await wait(1500); };
  /* the rain scale, step by step with the right arrow */
  const RAIN = ['dry', 'light', 'rain', 'tstorm', 'ar1', 'ar2', 'ar3', 'ar4', 'ar5'], WIND = ['calm', 'breeze', 'sa1', 'sa2', 'sa3', 'sa4'];
  let r = await read(), a, m; const rows = [];
  if (!process.env.TAIL) {
  C.ok(r.stormKey === 'dry' && r.fly === true && r.flyChip === 'Alta X can fly', 'dry: the Alta X may fly', { line: r.line, elev: r.elev });
  for (let i = 1; i < RAIN.length; i++) { await key('#scEnRain', 'ArrowRight'); r = await read(); rows.push(r);
    C.ok(r.stormKey === RAIN[i] && r.fly === (i <= 1) && (r.flyChip === (i <= 1 ? 'Alta X can fly' : 'Alta X grounded')) && r.altaStruck === (i > 1) && (i <= 1 || (r.flyTitle === NOFLY && r.altaTitle === NOFLY)), 'rain step ' + i + ' ' + RAIN[i], { tick: r.rainTick, val: r.rainVal, gust: r.gust, rain: r.rain, precip: r.precip, snowM: r.snowM, elev: r.elev, vis: r.vis, line: r.line.slice(0, 420) }); }
  C.ok(rows.every(x => x.precip === 'rain') && rows[5].snowM === 2200, 'at the coast every step rains; AR3 snows above 2,200 m', rows.map(x => x.snowM));
  C.ok(rows.every(x => /ft above the sea/.test(x.line) && /snow/i.test(x.line)), 'the line gives the snow level and the ground height at every wet step');
  if (DIR) { await ev(() => document.querySelector('#scEnBar').scrollIntoView({ block: 'start' })); await L.shot(page, path.join(DIR, 'wx_bar_ar5.png'), { x: 0, y: 0, width: 900, height: 720 }); }
  /* the Alta X in rain: the click is refused with the exact words, on the page and over the view */
  await key('#scEnRain', 'Home'); await key('#scEnRain', 'ArrowRight'); await key('#scEnRain', 'ArrowRight');
  const tryAlta = async () => { await page.click('#scEnBar [data-h="alta"]'); await wait(1500); return ev(() => ({ mode: MODI.rooftops.api.en().state().mode, toast: [...document.querySelectorAll('.toast, [class*="toast"]')].map(e => e.textContent).filter(Boolean).slice(-2), warn: (document.querySelector('.se-warn') || {}).textContent, warnShown: !(document.querySelector('.se-warn') || {}).hidden })); };
  a = await tryAlta(); C.ok(a.mode !== 'alta' && a.warn === NOFLY && a.warnShown && a.toast.some(t => t === NOFLY), 'steady rain: the Alta X stays down, warning exact', a);
  await key('#scEnRain', 'Home'); r = await read(); C.ok(r.stormKey === 'dry' && r.fly, 'Home on the slider: dry again');
  /* light rain: it flies */
  await key('#scEnRain', 'ArrowRight'); await page.click('#scEnBar [data-h="alta"]'); await wait(4000); m = await ev(() => MODI.rooftops.api.en().state().mode); C.ok(m === 'alta', 'light rain: the Alta X flies', m);
  /* flying, then the rain comes on: it is put down with the same words */
  await key('#scEnRain', 'ArrowRight'); await wait(2500); a = await ev(() => ({ mode: MODI.rooftops.api.en().state().mode, alta: MODI.rooftops.api.en().state().alta && MODI.rooftops.api.en().state().alta.mode, warn: (document.querySelector('.se-warn') || {}).textContent })); C.ok(a.warn === NOFLY, 'rain while it flies: the same warning', a);
  await page.click('#scEnBar [data-h="drone"]'); await key('#scEnRain', 'Home');
  /* the dry wind scale */
  const wrows = [];
  for (let i = 1; i < WIND.length; i++) { await key('#scEnWind', 'ArrowRight'); r = await read(); wrows.push(r);
    C.ok(r.windKey === WIND[i] && r.fly === (i <= 1) && r.flyChip === (i <= 1 ? 'Alta X can fly' : 'Alta X grounded') && (i <= 1 || r.altaTitle === NOFLY), 'wind step ' + i + ' ' + WIND[i], { tick: r.windTick, val: r.windVal, name: r.windName, gust: r.gust, sus: r.sus, precip: r.precip, line: r.line.slice(0, 420) }); }
  await key('#scEnWind', 'Home'); await key('#scEnWind', 'ArrowRight'); await key('#scEnWind', 'ArrowRight');
  a = await tryAlta(); C.ok(a.mode !== 'alta' && a.warn === NOFLY && a.toast.some(t => t === NOFLY), 'offshore wind advisory: the Alta X stays down, warning exact', a);
  /* sky states, and what is held off when */
  const sky = async k => { await page.click('#scEnBar [data-sky="' + k + '"]'); await wait(1800); return read(); };
  r = await sky('marine'); C.ok(r.skyPressed === 'marine' && r.held && /held off/i.test(r.line), 'marine layer chosen in offshore wind: held off, and the bar says why', { sky: r.sky, on: r.skyOn, held: r.held, line: r.line.slice(0, 500) });
  await key('#scEnWind', 'Home'); r = await read(); C.ok(r.skyOn === true && !r.held && r.sky === 'marine', 'calm again: the marine layer comes in', { sky: r.sky, on: r.skyOn, vis: r.vis, line: r.line.slice(0, 400) });
  if (DIR) await L.shot(page, path.join(DIR, 'wx_marine.png'));
  r = await sky('tule'); C.ok(r.sky === 'tule' && r.skyOn, 'tule fog', { vis: r.vis, line: r.line.slice(0, 400) });
  await key('#scEnRain', 'End'); r = await read(); C.ok(r.held && r.skyOn === false && /held off/i.test(r.line), 'tule fog under an AR5: held off', { held: r.held, line: r.line.slice(0, 300) });
  r = await sky('smoke'); C.ok(r.sky === 'smoke', 'smoke with rain', { on: r.skyOn, held: r.held, line: r.line.slice(0, 300) });
  await key('#scEnRain', 'Home'); r = await sky('smoke'); C.ok(r.sky === 'smoke' && r.skyOn && r.fly, 'wildfire smoke, dry and calm', { vis: r.vis, line: r.line.slice(0, 400) });
  r = await sky('none'); C.ok(r.skyPressed === 'none' && /Dry and calm/.test(r.line), 'clear: dry and calm', r.line);
  }
  /* the aircraft switch and its line */
  const air = () => ev(() => { const en = MODI.rooftops.api.en(), b = document.querySelector('#scEnBar [data-eg^="air:"]'), i = en.air.info(); return { btn: b.textContent, pressed: b.getAttribute('aria-pressed'), g: en.graphics().air, st: en.state().air, line: (document.querySelector('#scEnAirO') || {}).innerText || '', info: { airport: i.airport, name: i.name, km: i.km, landing: i.landing, departing: i.departing, arr: i.arrivalsPerHour, dep: i.departuresPerHour, arriving: i.arriving, departingNow: i.departingNow, drawn: i.drawn, helicopters: i.helicopters, boats: i.boats, built: i.built, bridges: i.bridges } }; });
  let ar = await air(); C.ok(ar.pressed === 'true' && /Nearest airport/.test(ar.line) && ar.line.includes(ar.info.name) && /Generated, not observed/.test(ar.line), 'aircraft on: the line reads en.air.info()', ar);
  let t0 = Date.now(); await page.click('#scEnBar [data-eg^="air:"]', { timeout: 120000 }); await wait(2500); ar = await air(); console.log('     the switch took ' + Math.round((Date.now() - t0) / 1000) + ' s (it rebuilds the roads for the bridge decks)'); C.ok(ar.pressed === 'false' && ar.g === false && ar.line === '' && /off/.test(ar.btn) && ar.st && ar.st.on === false, 'aircraft switched off: no line, nothing in the sky', { btn: ar.btn, st: ar.st, where: (await read()).where });
  await page.click('#scEnBar [data-eg^="air:"]', { timeout: 120000 }); await wait(9000); ar = await air(); C.ok(ar.pressed === 'true' && ar.g !== false && /Nearest airport/.test(ar.line), 'aircraft back on', { st: ar.st, line: ar.line.slice(0, 300) });
  r = await read(); C.ok(/ground 20 ft above the sea/.test(r.where) && Math.abs(r.elev - 8.6) < 1.5, 'ground height: Coronado about 7 m (20 ft), the eye 1.7 m above it', { where: r.where, elev: r.elev });
  /* sound */
  const snd = async () => { await page.click('#scEnBar [data-a="sound"]'); await wait(1200); return ev(() => { const b = document.querySelector('#scEnBar [data-a="sound"]'); return { text: b.textContent, pressed: b.getAttribute('aria-pressed') }; }); };
  let sd = await snd(); C.ok(sd.pressed === 'true' && sd.text === 'Sound on', 'sound on', sd); await key('#scEnRain', 'End'); await wait(2000); sd = await snd(); C.ok(sd.pressed === 'false' && sd.text === 'Sound off', 'sound off', sd); await key('#scEnRain', 'Home');
  const cap = await ev(() => ({ what: (document.querySelector('#scEnWhat') || {}).innerText || '', bar: document.querySelector('#scEnBar').innerText.replace(/\s+/g, ' ').length })); console.log('     captions', JSON.stringify(cap));
  console.log('PAGE ERRORS:', errs.length ? errs.length + '\n' + [...new Set(errs)].slice(0, 8).join('\n') : 'none'); console.log(C.bad ? C.bad + ' FAILED' : 'all pass');
  await close(); process.exit(C.bad || errs.length ? 1 : 0);
})().catch(e => { console.error('ERROR', e); process.exit(2); });
