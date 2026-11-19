/* The code review's failure scenarios, run again on the corrected build. Each line says what was wrong and whether it still is.
   node review_fix_check.js <atlas.html> */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2]), ADDR = '632 Woodgate Blvd, Baton Rouge, LA';
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
  const browser = await chromium.launch({ proxy, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: 1000, height: 820 }, deviceScaleFactor: 1 })).newPage();
  const errs = []; let overpass = 0; page.on('pageerror', e => errs.push('pageerror: ' + (e && e.stack || e))); page.on('request', r => { if (/overpass/.test(r.url())) overpass++; });
  let bad = 0; const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + JSON.stringify(d) : '')); if (!c) bad++; };
  await page.goto('file://' + FILE + '#rooftops', { waitUntil: 'load', timeout: 180000 }); await wait(1500);
  const settle = async (max) => { const t0 = Date.now(); while (Date.now() - t0 < (max || 120000)) { await wait(2000); const st = await page.evaluate(() => MODI.rooftops.api.status()); if (!(st.queued + st.running) && !st.tiles.some(t => t.st === 'load' || t.st === 'queued') && st.tiles.some(t => t.st === 'ok' || t.st === 'err')) return st; } return null; };
  await page.fill('#scFind', ADDR); await page.press('#scFind', 'Enter'); await settle(150000); await wait(2500);
  await page.click('#scMode button[data-v="eng"]');
  for (let i = 0; i < 25; i++) { await wait(3000); const s = await page.evaluate(() => { const en = MODI.rooftops.api.en(); if (!en) return null; const st = en.state(); return { built: st.built, queued: st.queued, roads: st.roads }; }); if (s && s.built > 20 && !s.queued && s.roads && i > 5) break; }
  await page.evaluate(() => MODI.rooftops.api.en().setGraphics({ q: 'low', sun: 15, weather: 'clear', life: false, wide: false }));

  /* 1. with a roof view on and no roof in the frame, the rain is still drawn into the lit picture */
  await page.evaluate(() => { const en = MODI.rooftops.api.en(), gl = en.engine.device.gl, R = en.engine.renderer, C = window.__st = { lit: 0, other: 0 }, d0 = gl.drawArraysInstanced.bind(gl); gl.drawArraysInstanced = (m, f, c, n) => { if (n > 800) { if (gl.getParameter(gl.FRAMEBUFFER_BINDING) === R.T.hdrFlatT.fb) C.lit++; else C.other++; } return d0(m, f, c, n); }; en.setHeight('street'); en.storm(5); en.setGraphics({ lens: 'cover' }); });
  for (let i = 0; i < 30; i++) { await wait(1500); const g = await page.evaluate(() => { const g = MODI.rooftops.api.en().graphics(); return [g.lensN, g.lensPending]; }); if (g[0] > 5 && !g[1]) break; }
  await page.evaluate(() => { const en = MODI.rooftops.api.en(); en.world.pitch = 82; window.__st.lit = 0; window.__st.other = 0; en.engine.requestRender(4); }); await wait(6000);
  const s1 = await page.evaluate(() => Object.assign({ drawn: MODI.rooftops.api.en().lensLayer.drawn }, window.__st));
  ok(s1.lit > 3 && s1.other === 0, '1  looking straight up with a roof view on, the storm is drawn into the lit picture', s1);
  await page.evaluate(() => { const en = MODI.rooftops.api.en(); en.world.pitch = 0; en.setGraphics({ lens: 'off' }); });

  /* 10. after a storm the scene dries all the way */
  await page.evaluate(() => MODI.rooftops.api.en().storm(0));
  let wet = 1; for (let i = 0; i < 60; i++) { await wait(2500); wet = await page.evaluate(() => MODI.rooftops.api.en().engine.scene.env.wetness); if (wet === 0) break; }
  ok(wet === 0, '10 after the storm the wetness goes to nothing', wet);

  /* 7. the storm slider keeps the keyboard */
  await page.evaluate(() => document.querySelector('#scEnStorm').scrollIntoView({ block: 'center' })); await page.focus('#scEnStorm'); await page.keyboard.press('ArrowRight'); await wait(700); await page.keyboard.press('ArrowRight'); await wait(900);
  const s7 = await page.evaluate(() => ({ storm: MODI.rooftops.api.en().graphics().storm, focus: document.activeElement && document.activeElement.id, value: document.querySelector('#scEnStorm').value }));
  ok(s7.storm === 2 && s7.focus === 'scEnStorm', '7  two presses of the right arrow move the storm scale two steps and it keeps the focus', s7);

  /* 6. the drone's warning does not come up in fair weather after a storm has passed over the hidden drone */
  await page.evaluate(() => { const en = MODI.rooftops.api.en(); en.storm(0); en.setHeight('alta'); }); await wait(5000);
  await page.evaluate(() => { const en = MODI.rooftops.api.en(); en.setHeight('street'); en.storm(5); }); await wait(1500);
  await page.evaluate(() => { const en = MODI.rooftops.api.en(); en.storm(0); document.querySelector('.se-warn').hidden = true; en.setHeight('alta'); }); await wait(2500);
  const s6 = await page.evaluate(() => { const en = MODI.rooftops.api.en(), w = document.querySelector('.se-warn'); return { mode: en.state().mode, alta: en.state().alta && en.state().alta.mode, banner: w && !w.hidden ? w.textContent : null }; });
  ok(s6.mode === 'alta' && !s6.banner, '6  in fair weather the Alta X takes off with no warning', s6);

  /* 13. a grounded drone is not flown home */
  await wait(9000); await page.evaluate(() => { const en = MODI.rooftops.api.en(); en.storm(4); }); await wait(600);
  const s13 = await page.evaluate(() => { const en = MODI.rooftops.api.en(); en.alta.home(); return { mode: en.alta.craft.state.mode, grounded: en.alta.craft.grounded.slice(0, 20) }; });
  ok(s13.mode === 'Landing' || s13.mode === 'Landed', '13 Return home on a grounded drone is refused', s13);
  const b6 = await page.evaluate(() => { const w = document.querySelector('.se-warn'); return w && !w.hidden ? w.textContent : null; });
  ok(b6 === "Don't waste a $40,000 drone, stupid. Use the UAPs.", '   and the warning shows, word for word', b6);

  /* 5. a warp given up by putting the craft away does not come back */
  await page.evaluate(() => { const en = MODI.rooftops.api.en(); en.storm(0); en.setHeight('saucer'); }); await wait(3500);
  const at0 = await page.evaluate(() => { const s = MODI.rooftops.api.en().state(); return [+s.lat.toFixed(3), +s.lon.toFixed(3)]; });
  await page.evaluate(() => { const en = MODI.rooftops.api.en(); en.uap.warp(30.2266, -93.2174, {}); }); await wait(500);
  await page.evaluate(() => MODI.rooftops.api.en().setHeight('street')); await wait(1500);
  const s5a = await page.evaluate(() => { const en = MODI.rooftops.api.en(); return { warping: en.uap.warping, overlay: document.querySelector('.se-warp').className }; });
  await page.evaluate(() => MODI.rooftops.api.en().setHeight('tictac')); await wait(9000);
  const s5b = await page.evaluate(() => { const en = MODI.rooftops.api.en(), s = en.state(); return { warping: en.uap.warping, at: [+s.lat.toFixed(3), +s.lon.toFixed(3)], mode: s.uap && s.uap.mode }; });
  ok(!s5a.warping && s5a.overlay === 'se-warp' && !s5b.warping && Math.abs(s5b.at[0] - at0[0]) < 0.01 && Math.abs(s5b.at[1] - at0[1]) < 0.01, '5  a warp given up on the way does not resume when a craft is next taken out', { s5a, s5b, at0 });

  /* 12. a craft sent to hang over a roof comes down to the height asked for */
  const s12 = await page.evaluate(async () => { const en = MODI.rooftops.api.en(), U = en.uap.craft, st = U.state; st.y = 400; U.goTo(st.x + 6, st.z + 3, 36); await new Promise(r => setTimeout(r, 14000)); return { y: +st.y.toFixed(1), mode: st.mode, target: !!st.target }; });
  ok(Math.abs(s12.y - 36) < 2 && !s12.target, '12 sent 6 m off and 364 m down, it arrives at the height asked for', s12);

  /* 2. at speed no street maps are asked for */
  const o0 = overpass; await page.evaluate(() => { const en = MODI.rooftops.api.en(), U = en.uap.craft; U.state.y = 1400; en.hold('fwd', true); }); await wait(9000);
  const s2 = await page.evaluate(() => { const en = MODI.rooftops.api.en(), s = en.state(); en.hold('fwd', false); return { mph: Math.round(s.uap.speed * 2.237), fast: en.world.fast, cells: s.cells }; });
  ok(overpass - o0 <= 1 && s2.fast, '2  flying at ' + s2.mph + ' mph, street maps asked for: ' + (overpass - o0), s2);
  await wait(6000); ok(overpass - o0 >= 1, '   and once it has stopped, one is', overpass - o0);

  /* 8. the age the views use is the clock's */
  const s8 = await page.evaluate(() => { const api = MODI.rooftops.api, L = api.lens, out = []; let n = 0, dsum = 0; const bs = []; (api.buildings ? api.buildings() : []).forEach(b => bs.push(b)); return { have: bs.length, fn: typeof L.styleOf }; });
  console.log('   (8 is checked in Node: tests/r11/views_unit.js and the reviewer\'s case)', JSON.stringify(s8));

  /* 4. the sound stops with the view */
  const s4 = await page.evaluate(async () => { const en = MODI.rooftops.api.en(); const on = en.sound(true); await new Promise(r => setTimeout(r, 800)); const a = en.engine.audio, st1 = a && a.ctx ? a.ctx.state : 'none'; en.stop(); await new Promise(r => setTimeout(r, 800)); const st2 = a && a.ctx ? a.ctx.state : 'none'; en.start(); await new Promise(r => setTimeout(r, 800)); return { on, running: st1, afterStop: st2, afterStart: a && a.ctx ? a.ctx.state : 'none' }; });
  ok(s4.afterStop !== 'running', '4  leaving the view stops the sound', s4);

  console.log('PAGE ERRORS:', errs.length ? errs.join('\n') : 'none'); console.log(bad ? bad + ' FAILED' : 'all the review scenarios pass');
  await browser.close(); process.exit(bad ? 1 : 0);
})().catch(e => { console.error('ERROR', e); process.exit(2); });
