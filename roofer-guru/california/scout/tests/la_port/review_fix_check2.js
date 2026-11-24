/* California port of tests/r11/review_fix_check2.js (CA/scout/tests/la_port/port_suites.py) */
/* Four of the review's scenarios again, without leaning on the wall clock (a software renderer advances the engine's time
   far slower than real time): which picture the storm's own draws land in, the scene drying all the way, a craft coming
   down to the height asked, and the streets asked for once a fast craft has slowed.
   node review_fix_check2.js <atlas.html> */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2]), ADDR = '2300 J St, Sacramento, CA';
const wait = ms => new Promise(r => setTimeout(r, ms));
const __hard = setTimeout(() => { console.log('HARD TIMEOUT'); process.exit(3); }, (+process.env.HARD || 14) * 60000);
(async () => {
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
  const browser = await chromium.launch({ proxy, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 1 })).newPage();
  const errs = []; page.on('pageerror', e => errs.push('pageerror: ' + (e && e.stack || e)));
  let bad = 0; const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + JSON.stringify(d) : '')); if (!c) bad++; };
  await page.goto('file://' + FILE + '#rooftops', { waitUntil: 'load', timeout: 240000 }); await wait(4000);
  const settle = async (max) => { const t0 = Date.now(); while (Date.now() - t0 < (max || 120000)) { await wait(2000); const st = await page.evaluate(() => MODI.rooftops.api.status()); if (!(st.queued + st.running) && !st.tiles.some(t => t.st === 'load' || t.st === 'queued') && st.tiles.some(t => t.st === 'ok' || t.st === 'err')) return st; } return null; };
  await page.fill('#scFind', ADDR); await page.press('#scFind', 'Enter'); await settle(150000); await wait(2500);
  await page.click('#scMode button[data-v="eng"]');
  for (let i = 0; i < 25; i++) { await wait(3000); const s = await page.evaluate(() => { const en = MODI.rooftops.api.en(); if (!en) return null; const st = en.state(); return { built: st.built, queued: st.queued, roads: st.roads }; }); if (s && s.built > 20 && !s.queued && s.roads && i > 5) break; }
  await page.evaluate(() => MODI.rooftops.api.en().setGraphics({ q: 'low', sun: 15, weather: 'clear', life: false, wide: false, trees: false }));

  /* 1. the storm's own program: every instanced draw made with it lands in the lit picture, roof view on, looking straight up */
  await page.evaluate(() => { const en = MODI.rooftops.api.en(); en.setHeight('street'); en.storm('ar2'); en.setGraphics({ lens: 'cover' }); });
  for (let i = 0; i < 30; i++) { await wait(1500); const g = await page.evaluate(() => { const g = MODI.rooftops.api.en().graphics(); return [g.lensN, g.lensPending]; }); if (g[0] > 5 && !g[1]) break; }
  await wait(4000);
  await page.evaluate(() => { const en = MODI.rooftops.api.en(), dev = en.engine.device, gl = dev.gl, R = en.engine.renderer, C = window.__st = { lit: 0, other: 0, noProg: 0 }, d0 = gl.drawArraysInstanced.bind(gl);
    gl.drawArraysInstanced = (m, f, c, n) => { const sp = [...dev.programs.entries()].find(e => e[0].indexOf('storm|') === 0); if (!sp) C.noProg++; else if (gl.getParameter(gl.CURRENT_PROGRAM) === sp[1].p) { if (gl.getParameter(gl.FRAMEBUFFER_BINDING) === R.T.hdrFlatT.fb) C.lit++; else C.other++; } return d0(m, f, c, n); };
    en.world.pitch = 84; en.engine.requestRender(4); }); await wait(7000);
  const s1 = await page.evaluate(() => Object.assign({ roofsDrawn: MODI.rooftops.api.en().lensLayer.drawn }, window.__st));
  ok(s1.lit > 3 && s1.other === 0, '1  roof view on, looking straight up (no roof in the frame): the storm\'s draws land in the lit picture', s1);
  await page.evaluate(() => { const en = MODI.rooftops.api.en(); en.world.pitch = 0; en.setGraphics({ lens: 'off' }); });

  /* 10. drying, stepped by hand: 200 seconds of the kit's own clock after the storm ends */
  const s10 = await page.evaluate(() => { const en = MODI.rooftops.api.en(), SK = en.stormKit, env = en.engine.scene.env, cam = en.engine.camera; en.storm('dry'); en.wind('calm'); en.sky('none'); let quiet = 0; for (let i = 0; i < 4000; i++) { const r = SK.update(0.05, cam, true); if (!r) quiet++; } return { wetness: env.wetness, fog: +env.fogDensity.toFixed(5), quietSteps: quiet }; });
  ok(s10.wetness === 0 && s10.quietSteps > 100, '10 the scene dries all the way once the storm is over', s10);

  /* 12. a craft sent 6 m off and 364 m down, stepped by hand for 20 seconds of its clock */
  const s12 = await page.evaluate(() => { const en = MODI.rooftops.api.en(); en.setHeight('saucer'); const U = en.uap.craft, st = U.state; st.y = 400; U.goTo(st.x + 6, st.z + 3, 36); let gone = -1; for (let i = 0; i < 400; i++) { U.update(0.05, { floor: () => 0, block: () => false }); if (!st.target && gone < 0) gone = i; } return { y: +st.y.toFixed(1), mode: st.mode, targetDroppedAtStep: gone }; });
  ok(Math.abs(s12.y - 36) < 1.5 && s12.targetDroppedAtStep > 40, '12 it keeps its target until it has the height asked for too', s12);

  /* 2. the streets are asked for once when a fast craft has slowed */
  const r0 = await page.evaluate(() => { const en = MODI.rooftops.api.en(); en.uap.craft.state.y = 1400; en.hold('fwd', true); return en.world.roadsAsk || 0; });
  for (let i = 0; i < 30; i++) { await wait(1500); if (await page.evaluate(() => MODI.rooftops.api.en().world.fast)) break; }
  await wait(5000); const mid = await page.evaluate(() => { const en = MODI.rooftops.api.en(), w = en.world; en.hold('fwd', false); return { fast: w.fast, asks: (w.roadsAsk || 0), mph: Math.round(en.state().uap.speed * 2.237) }; });
  let slow = null; for (let i = 0; i < 80; i++) { await wait(1500); slow = await page.evaluate(() => { const en = MODI.rooftops.api.en(), w = en.world; return { fast: w.fast, asks: (w.roadsAsk || 0) }; }); if (!slow.fast) break; }
  await wait(1500); const end = await page.evaluate(() => MODI.rooftops.api.en().world.roadsAsk || 0);
  ok(mid.fast && mid.asks === r0 && !slow.fast && end === r0 + 1, '2  no street maps asked for at speed, and one when it has slowed', { before: r0, atSpeed: mid, slowed: slow, after: end });

  console.log('PAGE ERRORS:', errs.length ? errs.join('\n') : 'none'); console.log(bad ? bad + ' FAILED' : 'all four pass');
  await browser.close(); clearTimeout(__hard); process.exit(bad ? 1 : 0);
})().catch(e => { console.error('ERROR', e); process.exit(2); });
