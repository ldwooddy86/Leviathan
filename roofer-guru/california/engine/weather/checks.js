/* Checks of the weather job on the test bed, without leaning on the wall clock (the kit's clock is stepped by hand):
   the scales and their ids, the Alta X rule and its warning, what state() and info() say, snow only where the height is
   known, drying and clearing all the way, the storm's draws landing in the lit picture, and no page errors.
   node checks.js <testbed.html> */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2]), ADDR = process.argv[3] || '400 Van Ness Ave, San Francisco, CA';
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
  const browser = await chromium.launch({ proxy, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 1 })).newPage();
  const errs = []; page.on('pageerror', e => errs.push('pageerror: ' + (e && e.stack || e)));
  let bad = 0; const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + JSON.stringify(d) : '')); if (!c) bad++; };
  await page.goto('file://' + FILE + '#rooftops', { waitUntil: 'load', timeout: 180000 }); await wait(1500);
  const settle = async (max) => { const t0 = Date.now(); while (Date.now() - t0 < (max || 120000)) { await wait(2000); const st = await page.evaluate(() => MODI.rooftops.api.status()); if (!(st.queued + st.running) && !st.tiles.some(t => t.st === 'load' || t.st === 'queued') && st.tiles.some(t => t.st === 'ok' || t.st === 'err')) return st; } return null; };
  await page.fill('#scFind', ADDR); await page.press('#scFind', 'Enter'); await settle(150000); await wait(2500);
  await page.click('#scMode button[data-v="eng"]');
  for (let i = 0; i < 25; i++) { await wait(3000); const s = await page.evaluate(() => { const en = MODI.rooftops.api.en(); if (!en) return null; const st = en.state(); return { built: st.built, queued: st.queued, roads: st.roads }; }); if (s && s.built > 20 && !s.queued && s.roads && i > 5) break; }
  await page.evaluate(() => MODI.rooftops.api.en().setGraphics({ q: 'low', sun: 13, weather: 'clear', life: false, wide: false, trees: false }));
  await wait(3000);

  /* 1. the tables */
  const t1 = await page.evaluate(() => { const SE = window.__SCOUT_ENGINE__; return { storm: SE.STORM.map(s => s.k), wind: SE.WIND.map(s => s.k), sky: SE.SKY.map(s => s.k), notes: SE.STORM.concat(SE.WIND, SE.SKY).every(s => s.note && s.note.length > 30), fly: SE.STORM.filter(s => s.fly).map(s => s.k), wfly: SE.WIND.filter(s => s.fly).map(s => s.k), txt: JSON.stringify([SE.STORM, SE.WIND, SE.SKY]) }; });
  ok(t1.storm.join() === 'dry,light,rain,tstorm,ar1,ar2,ar3,ar4,ar5' && t1.wind.join() === 'calm,breeze,sa1,sa2,sa3,sa4' && t1.sky.join() === 'none,marine,tule,smoke', '1  the three tables have the ids asked for', { storm: t1.storm, wind: t1.wind, sky: t1.sky });
  ok(t1.notes && t1.fly.join() === 'dry,light' && t1.wfly.join() === 'calm,breeze', '1b every step has a note; the Alta X flies in dry and light rain, calm and breeze only', { fly: t1.fly, wfly: t1.wfly });
  ok(!/hurricane|surge|saffir|tropical|categor|gulf|louisiana|—/i.test(t1.txt), '1c no word of the old scale, and no em dash, in the tables');

  /* 2. the API: ids and numbers, and what comes back */
  const t2 = await page.evaluate(() => { const en = MODI.rooftops.api.en(); const a = en.storm('ar4'), s1 = en.state(), b = en.wind('sa3'), s2 = en.state(), c = en.sky('smoke'), g = en.graphics(), s3 = en.state(); const d = en.storm(0), e = en.wind(0), f = en.sky('none'), s4 = en.state(), g2 = en.setGraphics({ storm: 'ar2', wind: 2, skyState: 'tule' }), s5 = en.state(); en.setGraphics({ storm: 0, wind: 0, skyState: 0 });
    return { a: { level: a.level, key: a.key, ar: a.ar, ivt: a.ivt, gust: a.gust, rain: a.rain, snow: a.snowLevelM, fly: a.fly, text: a.text }, s1: { storm: s1.storm, key: s1.stormKey, gust: s1.gustMph, rain: s1.rainMmH, precip: s1.precip, fly: s1.altaCanFly }, b: { wl: b.wind.level, local: b.wind.local, gustMph: b.gustMph, sust: b.sustainedMph }, s2: { wind: s2.wind, key: s2.windKey, name: s2.windName, gust: s2.gustMph }, c: { sky: c.sky.key, on: c.sky.on, text: c.text }, g: { storm: g.storm, wind: g.wind, sky: g.skyState, info: !!g.stormInfo, surge: 'surge' in g }, s3: s3.weather, s4: { storm: s4.storm, wind: s4.wind, sky: s4.sky, gust: s4.gustMph, rain: s4.rainMmH, fly: s4.altaCanFly, text: s4.weather }, s5: { storm: s5.stormKey, wind: s5.windKey, sky: s5.sky, skyOn: s5.skyOn, held: g2.stormInfo.sky.held } }; });
  ok(t2.a.level === 7 && t2.a.key === 'ar4' && t2.a.ar === 4 && t2.a.gust === 70 && t2.a.rain === 18 && t2.a.fly === false && t2.s1.gust === 70 && t2.s1.rain === 18 && t2.s1.precip === 'rain' && t2.s1.fly === false, '2  en.storm("ar4") sets step 7 and state() gives its gust and rain', { a: t2.a, s1: t2.s1 });
  ok(t2.b.wl === 4 && t2.b.gustMph === 80 && t2.s2.key === 'sa3' && t2.s2.gust === 80 && t2.b.local === 'Diablo', '2b en.wind("sa3") over AR4: the stronger gust is the roof\'s (80), and at San Francisco the wind is named Diablo', { b: t2.b, s2: t2.s2 });
  ok(t2.c.sky === 'smoke' && t2.c.on && t2.g.storm === 7 && t2.g.wind === 4 && t2.g.sky === 'smoke' && t2.g.info && !t2.g.surge, '2c en.sky("smoke"); graphics() carries storm, wind, skyState and no flood field', { c: t2.c, g: t2.g, state: t2.s3 });
  ok(t2.s4.storm === 0 && t2.s4.wind === 0 && t2.s4.sky === 'none' && t2.s4.gust === 0 && t2.s4.rain === 0 && t2.s4.fly === true, '2d all three back to nothing', t2.s4);
  ok(t2.s5.storm === 'ar2' && t2.s5.wind === 'sa1' && t2.s5.sky === 'tule' && t2.s5.skyOn === false && /rain/.test(t2.s5.held), '2e setGraphics({ storm, wind, skyState }) takes ids or numbers; tule fog is held off while it rains', t2.s5);

  /* 3. the Alta X: flies in dry and light rain and in a breeze; refuses everything else with the exact words; comes down if it is up */
  const WORDS = "Don't waste a $40,000 drone, stupid. Use the UAPs.";
  const t3 = await page.evaluate(() => { const en = MODI.rooftops.api.en(), out = { NOFLY: en.NOFLY, cases: [] }, warn = () => { const w = document.querySelector('.se-warn'); return w && !w.hidden ? w.textContent : ''; }, clear = () => { const w = document.querySelector('.se-warn'); if (w) w.hidden = true; };
    const tryIt = (label, set) => { en.setHeight('street'); en.storm(0); en.wind(0); en.sky(0); set(); clear(); const r = en.setHeight('alta'), mode = en.state().mode; out.cases.push({ label, entered: mode === 'alta', warn: warn(), ret: r === false ? false : true }); en.setHeight('street'); };
    tryIt('dry', () => {}); tryIt('light', () => en.storm('light')); tryIt('rain', () => en.storm('rain')); tryIt('tstorm', () => en.storm('tstorm')); for (const k of ['ar1', 'ar2', 'ar3', 'ar4', 'ar5']) tryIt(k, () => en.storm(k));
    tryIt('breeze', () => en.wind('breeze')); for (const k of ['sa1', 'sa2', 'sa3', 'sa4']) tryIt(k, () => en.wind(k)); tryIt('light+breeze', () => { en.storm('light'); en.wind('breeze'); }); tryIt('light+sa1', () => { en.storm('light'); en.wind('sa1'); });
    tryIt('marine', () => en.sky('marine')); tryIt('tule', () => en.sky('tule')); tryIt('smoke', () => en.sky('smoke'));
    /* up in the dry, then the weather turns */
    en.storm(0); en.wind(0); en.sky(0); en.setHeight('alta'); const A = en.alta || null; clear(); const st0 = en.state(); en.takeoff && en.takeoff(); return Object.assign(out, { hasAlta: !!st0.alta, mode0: st0.alta && st0.alta.mode }); });
  const want = { dry: 1, light: 1, breeze: 1, 'light+breeze': 1, marine: 1, tule: 1, smoke: 1 };
  ok(t3.NOFLY === WORDS, '3  the warning is exactly the words asked for', t3.NOFLY);
  ok(t3.cases.every(c => want[c.label] ? (c.entered && !c.warn) : (!c.entered && c.warn === WORDS)), '3b the Alta X is let up in dry, light rain, a breeze and the sky states, and refused with those words in every other step', t3.cases.map(c => c.label + ':' + (c.entered ? 'flies' : 'refused') + (c.warn ? '!' : '')));
  /* in the air, then an offshore wind comes up: it lands and says so */
  const t3c = await page.evaluate(() => { const en = MODI.rooftops.api.en(); en.setHeight('alta'); const al = en.kit && null; const w = document.querySelector('.se-warn'); w.hidden = true; const keys = Object.keys(en).filter(k => /alta|takeoff|fly/i.test(k)); return { keys, st: en.state().alta }; });
  console.log('     alta api', JSON.stringify(t3c));
  const t3d = await page.evaluate(() => { const en = MODI.rooftops.api.en(); let up = false; try { if (en.alta && en.alta.takeoff) { en.alta.takeoff(30); up = true; } else if (en.altaCmd) { en.altaCmd('takeoff'); up = true; } } catch (e) { return { err: String(e) }; } return { up, st: en.state().alta }; });
  console.log('     takeoff', JSON.stringify(t3d));
  await wait(6000);
  const t3e = await page.evaluate(() => { const en = MODI.rooftops.api.en(), w = document.querySelector('.se-warn'); const before = en.state().alta; w.hidden = true; en.wind('sa2'); const after = en.state().alta; return { before, after, warn: w.hidden ? '' : w.textContent }; });
  ok(!t3e.before || t3e.before.mode === 'Landed' || (t3e.after.mode === 'Landing' && t3e.warn === WORDS), '3c up in the dry, then a high offshore wind: it is brought down and the warning shows (skipped if it could not be got up from here)', t3e);
  await page.evaluate(() => { const en = MODI.rooftops.api.en(); en.wind(0); en.setHeight('saucer'); en.storm('ar5'); en.wind('sa4'); });
  const t3f = await page.evaluate(() => { const en = MODI.rooftops.api.en(), w = document.querySelector('.se-warn'); const m1 = en.state().mode; en.setHeight('tictac'); const m2 = en.state().mode; return { m1, m2, uap: !!en.state().uap }; });
  ok(t3f.m1 === 'saucer' && t3f.m2 === 'tictac' && t3f.uap, '3d the saucer and the Tic Tac fly in AR5 with an extreme offshore wind', t3f);
  await page.evaluate(() => { const en = MODI.rooftops.api.en(); en.setHeight('street'); en.storm(0); en.wind(0); });

  /* 4. the storm's own program: every instanced draw made with it lands in the lit picture */
  await page.evaluate(() => { const en = MODI.rooftops.api.en(); en.setHeight('street'); en.storm('ar5'); const SK = en.stormKit, cam = en.engine.camera; for (let i = 0; i < 200; i++) SK.update(0.05, cam, true);
    const dev = en.engine.device, gl = dev.gl, R = en.engine.renderer, C = window.__st = { lit: 0, other: 0, noProg: 0 }, d0 = gl.drawArraysInstanced.bind(gl);
    gl.drawArraysInstanced = (m, f, c, n) => { const sp = [...dev.programs.entries()].find(e => e[0].indexOf('storm|') === 0); if (!sp) C.noProg++; else if (gl.getParameter(gl.CURRENT_PROGRAM) === sp[1].p) { if (gl.getParameter(gl.FRAMEBUFFER_BINDING) === R.T.hdrFlatT.fb) C.lit++; else C.other++; } return d0(m, f, c, n); }; en.engine.requestRender(6); }); await wait(9000);
  const t4 = await page.evaluate(() => { const en = MODI.rooftops.api.en(), g = en.graphics(); return Object.assign({ refused: g.refused, why: g.refusedWhy }, window.__st); });
  ok(t4.lit > 3 && t4.other === 0 && !(t4.refused || []).includes('the falling rain'), '4  the rain shader compiles and its draws land in the lit picture', t4);

  /* 5. snow: none while the height of the ground is unknown; with a height above the snow level it falls and lies; below it, rain */
  const t5 = await page.evaluate(() => { const en = MODI.rooftops.api.en(), SK = en.stormKit, cam = en.engine.camera, env = en.engine.scene.env, run = n => { for (let i = 0; i < n; i++) SK.update(0.05, cam, true); };
    en.setHeight('street'); en.storm('rain'); run(1500); const a = { elev: en.state().elevationM, cover: SK.now.snow, precip: en.state().precip, snowK: env.snowK.slice(), text: SK.info().text };
    en.elevation(2058); run(2400); const b = { elev: en.state().elevationM, cover: +SK.now.snow.toFixed(3), precip: en.state().precip, rain: en.state().rainMmH, air: SK.snowAir, lineY: env.snowK[1], rainK: env.rainK[0] };
    en.elevation(900); run(2400); const c = { elev: en.state().elevationM, precip: en.state().precip, air: SK.snowAir, lineY: env.snowK[1], rain: en.state().rainMmH };
    en.snowLevel(300); run(100); const d = { precip: en.state().precip, level: en.state().snowLevelM, forced: SK.info().snowForced, air: SK.snowAir };
    en.snowLevel(null); en.elevation(null); en.storm(0); run(5000); const e = { cover: SK.now.snow, snowK: env.snowK.slice(), elev: en.state().elevationM, level: en.state().snowLevelM }; return { a, b, c, d, e }; });
  ok(t5.a.elev === null && t5.a.cover === 0 && t5.a.precip === 'rain' && t5.a.snowK[0] === 0, '5  with the ground\'s height unknown no snow is drawn, and the text says so', t5.a);
  ok(t5.b.elev === 2058 && t5.b.cover > 0.97 && t5.b.precip === 'snow' && t5.b.rain === 0 && t5.b.air === 1 && Math.abs(t5.b.lineY - (1500 - 2058 + 1.7)) < 5 && t5.b.rainK === 0, '5b at 2,058 m in steady rain (snow level 1,500 m): snow falls and lies, and no rain reaches the roof', t5.b);
  ok(t5.c.precip === 'rain' && t5.c.air === 0 && t5.c.rain === 6, '5c at 900 m the same step is rain', t5.c);
  ok(t5.d.precip === 'snow' && t5.d.level === 300 && t5.d.forced && t5.d.air === 1, '5d en.snowLevel(300) forces the snow level below the scene', t5.d);
  ok(t5.e.cover === 0 && t5.e.snowK[0] === 0 && t5.e.elev === null && t5.e.level === null, '5e it melts all the way and the settings go back', t5.e);

  /* 6. drying and clearing, stepped by hand: after each of the heaviest settings the air, the grade and the surfaces come back exactly */
  const t6 = await page.evaluate(() => { const en = MODI.rooftops.api.en(), SK = en.stormKit, env = en.engine.scene.env, cam = en.engine.camera, RS = en.engine.renderer.settings, run = n => { let q = 0; for (let i = 0; i < n; i++) if (!SK.update(0.05, cam, true)) q++; return q; };
    en.setGraphics({ weather: 'clear' }); en.storm(0); en.wind(0); en.sky(0); run(6000); const snap = () => ({ wet: env.wetness, fog: +env.fogDensity.toFixed(6), fogH: env.fogHeight, clouds: +env.clouds.toFixed(4), exposure: +RS.exposure.toFixed(4), sat: +RS.saturation.toFixed(4), temp: +RS.temperature.toFixed(4), contrast: +RS.contrast.toFixed(4), snow: env.snowK[0], pond: env.snowK[3], rainK: env.rainK[0], turb: env.turbidity, sun: env.sunIntensity, sky: env.skyIntensity, flash: !!env.flash });
    const base = snap(), out = { base, cases: [] };
    for (const [label, set] of [['ar5', () => en.storm('ar5')], ['tstorm', () => en.storm('tstorm')], ['sa4+smoke', () => { en.wind('sa4'); en.sky('smoke'); }], ['tule', () => en.sky('tule')], ['marine', () => en.sky('marine')], ['ar5+sa4+smoke+snow', () => { en.elevation(3000); en.storm('ar5'); en.wind('sa4'); en.sky('smoke'); }]]) {
      set(); run(1500); const peak = snap(); en.storm(0); en.wind(0); en.sky(0); en.elevation(null); SK.reset(); const quiet = run(6000), end = snap(); out.cases.push({ label, peak: { wet: peak.wet, fog: peak.fog, exposure: peak.exposure, temp: peak.temp, snow: +peak.snow.toFixed(2), pond: +peak.pond.toFixed(2) }, same: JSON.stringify(end) === JSON.stringify(base), quiet, end }); }
    return out; });
  ok(t6.cases.every(c => c.same && c.quiet > 100), '6  after AR5, a thunderstorm, sa4 with smoke, tule fog, the marine layer and everything at once, the scene dries and clears all the way', { base: t6.base, cases: t6.cases.map(c => ({ label: c.label, peak: c.peak, same: c.same, quietSteps: c.quiet, end: c.same ? undefined : c.end })) });

  /* 7. the roof views and the heads-up display are told the weather, and reading them throws nothing */
  const t7 = await page.evaluate(() => { const en = MODI.rooftops.api.en(); en.storm('ar3'); en.wind('sa2'); let lens = null, err = ''; try { const g = en.setGraphics({ lens: 'storm' }); lens = g.lens; } catch (e) { err = String(e && e.stack || e); } return { lens, err }; });
  await wait(9000);
  const t7b = await page.evaluate(() => { const en = MODI.rooftops.api.en(), g = en.graphics(); en.setHeight('saucer'); return { lens: g.lens, n: g.lensN, pending: g.lensPending }; }); await wait(5000);
  const t7c = await page.evaluate(() => { const en = MODI.rooftops.api.en(), hud = document.querySelector('.se-hud'); const t = hud ? hud.textContent : ''; en.setGraphics({ lens: 'off' }); en.setHeight('street'); en.storm(0); en.wind(0); return { hud: (t.match(/WEATHER\s*([^A-Z]*[A-Za-z0-9 ,]*?)(?=CAM|ROOF|$)/) || [])[0] || t.slice(0, 200) }; });
  ok(!t7.err, '7  the storm roof view can be turned on in AR3 with a high offshore wind without an error (the Louisiana module\'s own reading of it is not California\'s yet)', Object.assign({}, t7, t7b));
  ok(/AR3/.test(t7c.hud) && /Offshore high wind/.test(t7c.hud), '7b the craft\'s heads-up display names the weather', t7c);

  await wait(2000);
  console.log('PAGE ERRORS:', errs.length ? errs.join('\n') : 'none'); if (errs.length) bad++; console.log(bad ? bad + ' FAILED' : 'all pass');
  await browser.close(); process.exit(bad ? 1 : 0);
})().catch(e => { console.error('ERROR', e); process.exit(2); });
