/* Drives the M3 in the California test bed. node drive.js <page.html> "<address>" <tag> [steps...]
   steps (in order given): shots  dyn  wall  night  rain  top  cams  leave
   Dynamics are stepped by hand (en.car.step) because software rendering is far slower than real time. */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2]), ADDR = process.argv[3], TAG = process.argv[4] || 't', STEPS = process.argv.slice(5);
const SHOTS = path.join(__dirname, '..', 'shots');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
  const browser = await chromium.launch({ proxy, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: 760, height: 900 }, deviceScaleFactor: 1 })).newPage();
  const errs = []; page.on('crash', () => console.log('PAGE CRASHED', new Date().toISOString())); browser.on('disconnected', () => console.log('BROWSER GONE', new Date().toISOString())); page.on('pageerror', e => errs.push('pageerror: ' + (e && e.stack || e))); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errs.push('console: ' + m.text().slice(0, 300)); });
  await page.goto('file://' + FILE + '#rooftops', { waitUntil: 'load', timeout: 180000 }); await wait(1500);
  const settle = async (max) => { const t0 = Date.now(); while (Date.now() - t0 < (max || 120000)) { await wait(2000); const st = await page.evaluate(() => MODI.rooftops.api.status()); if (!(st.queued + st.running) && !st.tiles.some(t => t.st === 'load' || t.st === 'queued') && st.tiles.some(t => t.st === 'ok' || t.st === 'err')) return st; } return null; };
  await page.fill('#scFind', ADDR); await page.press('#scFind', 'Enter'); await settle(150000); await wait(2000);
  await page.click('#scMode button[data-v="eng"]', { timeout: 240000, noWaitAfter: true });
  let s = null;
  for (let i = 0; i < 30; i++) { await wait(3000); s = await page.evaluate(() => { const en = MODI.rooftops.api.en(); if (!en) return null; const st = en.state(); return { built: st.built, queued: st.queued, roads: st.roads, lat: st.lat, lon: st.lon, mode: st.mode, note: st.note }; }); if (s && s.built > 20 && !s.queued && s.roads && i > 4) break; }
  console.log('engine', JSON.stringify(s));
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const box = await ev(() => { const c = MODI.rooftops.api.en().canvas; c.scrollIntoView({ block: 'center' }); const r = c.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
  const shot = async (name, ms) => { await wait(ms || 9000); const f0 = await ev(() => MODI.rooftops.api.en().engine.time.frame); await wait(2000); const f1 = await ev(() => { const en = MODI.rooftops.api.en(); return [en.engine.time.frame, en.graphics().ms, en.graphics().draws]; }); console.log('frames in 2 s before the shot', f1[0] - f0, 'ms', f1[1], 'draws', f1[2]); await page.screenshot({ path: path.join(SHOTS, TAG + '_' + name + '.png'), timeout: 240000, clip: { x: Math.max(0, box.x), y: Math.max(0, box.y), width: Math.min(800, box.width), height: Math.min(600, box.height) } }); console.log('shot', TAG + '_' + name + '.png'); };
  const car = () => ev(() => { const en = MODI.rooftops.api.en(), c = en.state().car; return c && { mph: +c.mph.toFixed(1), gear: c.gear, rpm: Math.round(c.rpm), yaw: +c.yaw.toFixed(1), lat: +c.lat.toFixed(5), lon: +c.lon.toFixed(5), y: +c.y.toFixed(2), onRoad: c.onRoad, grip: +c.grip.toFixed(2), tc: c.tc, hit: c.hit, struck: c.struck, hits: c.hits, rest: c.atRest, drift: c.drifting, fast: c.fast, lamps: c.lamps, brk: c.braking, top: +c.topMph.toFixed(2), odo: Math.round(c.odo) }; });
  /* drive by script for t seconds of the car's own clock, in steps of 1/60 s; returns the state and the greatest values seen */
  const run = (inp, t, o) => ev(([inp, t, o]) => { const en = MODI.rooftops.api.en(); en.car.drive(inp); const n = Math.round(t * 60); let mx = 0, lat = 0, yr = 0, hits0 = en.car.state.hits, slide = 0, mn = 1e9, c = null; for (let i = 0; i < n; i++) { c = en.car.step(1 / 60, 1); const a = en.car.state; if (a.mph > mx) mx = a.mph; if (a.mph < mn) mn = a.mph; if (Math.abs(a.gLat) > lat) lat = Math.abs(a.gLat); if (Math.abs(a.yawRate) > yr) yr = Math.abs(a.yawRate); if (a.slide > slide) slide = a.slide; if (o && o.until && o.until === 'rest' && a.atRest) break; if (o && o.untilMph && a.mph >= o.untilMph) { c.t = (i + 1) / 60; break; } }
    return { mph: +c.mph.toFixed(2), maxMph: +mx.toFixed(2), minMph: +mn.toFixed(2), maxLatG: +lat.toFixed(2), maxYawRate: +yr.toFixed(1), slide: +slide.toFixed(2), hits: c.hits - hits0, struck: c.struck, gear: c.gear, rest: c.atRest, yaw: +c.yaw.toFixed(1), odo: Math.round(c.odo), t: c.t, onRoad: c.onRoad, grip: +c.grip.toFixed(2), tc: c.tc, drift: c.drifting, fast: c.fast, lat: +c.lat.toFixed(5), lon: +c.lon.toFixed(5) }; }, [inp, t, o || null]);
  await ev(() => { const en = MODI.rooftops.api.en(); en.setGraphics({ q: 'low', sun: 15, weather: 'clear', life: false, wide: false }); en.setHeight('m3'); }); await wait(4000);
  console.log('entered', JSON.stringify(await car()), JSON.stringify(await ev(() => { const en = MODI.rooftops.api.en(), st = en.state(), h = en.world.hero; return { mode: st.mode, road: st.road, kind: st.roadKind, hero: h && { x: +h.x.toFixed(1), z: +h.z.toFixed(1), yaw: +h.yaw.toFixed(1), speed: h.speed, on: h.on }, hud: document.querySelector('.se-hud') ? document.querySelector('.se-hud').textContent.slice(0, 160) : null, spec: en.car.spec().topSpeedNote }; })));
      /* a straight stretch of street with no footprint across it (the footprints include bridges between buildings, which stand on the street as walls) */
  const clearStretch = async () => { const clear = await ev(() => { const en = MODI.rooftops.api.en(), W = en.world, ph = en.engine.physics; let best = null;
        for (const r of W.roads) { if (r.kind !== 'street' && r.kind !== 'major') continue; for (let k = 0; k + 1 < r.pts.length; k++) for (const dir of [1, -1]) { const p = r.pts[dir > 0 ? k : k + 1], q = r.pts[dir > 0 ? k + 1 : k], dx = q[0] - p[0], dz = q[1] - p[1], l = Math.hypot(dx, dz); if (l < 40) continue; const hx = dx / l, hz = dz / l; let d = 0; for (; d < 420; d += 3) { const x = p[0] + hx * d - hz * 2, z = p[1] + hz * d + hx * 2; if (ph.prismsIn(x - 2.6, z - 2.6, x + 2.6, z + 2.6, []).some(pr => pr.y1 > 0.5 && ph._prismSide(pr, x, z, 2.5))) break; } if (!best || d > best.d) best = { d, x: p[0] + hx * 6, z: p[1] + hz * 6, yaw: (Math.atan2(hx, -hz) * 180 / Math.PI + 360) % 360, name: r.name, kind: r.kind }; } }
        if (!best) return null; en.car.place(W.lat0 - best.z / W.ky, W.lon0 + best.x / W.kx, best.yaw); return { clearM: best.d, name: best.name, kind: best.kind, yaw: +best.yaw.toFixed(1) }; });
    console.log('put on a clear stretch', JSON.stringify(clear), JSON.stringify(await car())); };
  const park = async () => { await run({ brake: 1 }, 12, { until: 'rest' }); await ev(() => MODI.rooftops.api.en().car.drive(null)); };
  if (!STEPS.includes('hud')) await page.addStyleTag({ content: '.se-hud,.se-note,.se-labels,.se-lbl,.sc-enpad,.sc-ennote{display:none!important}' });
  for (const step of STEPS) {
    if (step === 'clear') await clearStretch();
    if (step === 'shots') {
      await park();
      await shot('chase');
      await ev(() => { const en = MODI.rooftops.api.en(); en.world.cchase.yaw = -150; en.world.cchase.pitch = -8; en.world.cchase.dist = 5; en.labels(); }); await shot('front34');
      await ev(() => { const en = MODI.rooftops.api.en(); en.world.cchase.yaw = -90; en.world.cchase.pitch = -4; en.world.cchase.dist = 5.6; en.labels(); }); await shot('side');
      await ev(() => { const en = MODI.rooftops.api.en(); en.world.cchase.yaw = 180; en.world.cchase.pitch = -5; en.world.cchase.dist = 5.5; en.labels(); }); await shot('front');
      await ev(() => { const en = MODI.rooftops.api.en(); en.world.cchase.yaw = -28; en.world.cchase.pitch = -14; en.world.cchase.dist = 5; en.labels(); }); await shot('rear34');
      await ev(() => { const en = MODI.rooftops.api.en(); en.world.cchase.yaw = 0; en.world.cchase.pitch = -9; en.world.cchase.dist = 7.2; en.labels(); });
    }
    if (step === 'cams') { await park(); for (const c of ['bonnet', 'cockpit', 'orbit', 'chase']) { await ev(c => { const en = MODI.rooftops.api.en(); en.car.camera(c); en.labels(); }, c); if (c !== 'chase') await shot('cam_' + c); } }
    if (step === 'dyn') {
      await clearStretch();
      console.log('launch to 60', JSON.stringify(await run({ throttle: 1 }, 8, { untilMph: 60 })));
      console.log('on to 6 s more', JSON.stringify(await run({ throttle: 1 }, 3)));
      console.log('brake to rest', JSON.stringify(await run({ brake: 1 }, 8, { until: 'rest' })));
      console.log('30 mph then full right lock 3 s', JSON.stringify(await run({ throttle: 0.5 }, 3)), JSON.stringify(await run({ throttle: 0.4, steer: 1 }, 3)));
      await ev(() => MODI.rooftops.api.en().car.tc(false));
      console.log('TC off, throttle + lock + handbrake: slide', JSON.stringify(await run({ throttle: 1, steer: 1, handbrake: 1 }, 1.2)), JSON.stringify(await run({ throttle: 1, steer: 1 }, 2)));
      await shot('slide', 6000);
      await ev(() => MODI.rooftops.api.en().car.tc(true));
      console.log('recover: lift, straighten', JSON.stringify(await run({ throttle: 0.15, steer: 0 }, 4)));
      console.log('stop', JSON.stringify(await run({ brake: 1 }, 6, { until: 'rest' })));
      console.log('reverse (brake held at rest)', JSON.stringify(await run({ brake: 1 }, 3)));
      console.log('stop again', JSON.stringify(await run({ throttle: 1 }, 2.5)), JSON.stringify(await car()));
      await ev(() => MODI.rooftops.api.en().car.reset()); console.log('back on the road', JSON.stringify(await car()));
    }
    if (step === 'wall') {
      /* aim at the nearest building: turn the car toward it, drive, see it stop */
      const aim = await ev(() => { const en = MODI.rooftops.api.en(), W = en.world, a = en.car.state, ph = en.engine.physics; let best = null; for (const p of ph.prisms) { if (p.y1 < 3) continue; const cx = (p.bb[0] + p.bb[2]) / 2, cz = (p.bb[1] + p.bb[3]) / 2, d = Math.hypot(cx - a.x, cz - a.z); if (d > 18 && (!best || d < best.d)) best = { d, cx, cz }; } if (!best) return null; const yaw = (Math.atan2(best.cx - a.x, -(best.cz - a.z)) * 180 / Math.PI + 360) % 360, ll = [W.lat0 - a.z / W.ky, W.lon0 + a.x / W.kx]; en.car.place(ll[0], ll[1], yaw, { exact: true }); return { d: +best.d.toFixed(1), yaw: +yaw.toFixed(1), prisms: ph.prisms.length }; });
      console.log('aimed at a building', JSON.stringify(aim));
      if (aim) { const r = await run({ throttle: 0.7 }, 6); console.log('drove at it', JSON.stringify(r)); const r2 = await run({ throttle: 1 }, 2); console.log('throttle held against it', JSON.stringify(r2));
        const inside = await ev(() => { const en = MODI.rooftops.api.en(), a = en.car.state, ph = en.engine.physics, y = a.yaw * Math.PI / 180; let n = 0; for (const d of [2.3, 0, -2.3]) { const x = a.x + Math.sin(y) * d, z = a.z - Math.cos(y) * d; for (const p of ph.prismsIn(x, z, x, z, [])) if (p.y1 > 1 && ph._edge(p, x, z, {}).inside) n++; } return n; }); console.log('points of the car inside a building:', inside); await shot('wall', 6000); await run({ brake: 1 }, 1); await ev(() => MODI.rooftops.api.en().car.reset()); }
    }
    if (step === 'night') { await ev(() => { const en = MODI.rooftops.api.en(); en.setGraphics({ sun: 'night' }); en.world.cchase.yaw = 150; en.world.cchase.pitch = -8; en.labels(); }); await run({ brake: 1 }, 0.3); await shot('night_front', 12000); await ev(() => { const en = MODI.rooftops.api.en(); en.world.cchase.yaw = 20; en.labels(); }); await run({ brake: 1 }, 0.2); await shot('night_rear_braking', 9000); console.log('night', JSON.stringify(await car())); await ev(() => { const en = MODI.rooftops.api.en(); en.setGraphics({ sun: 15 }); en.world.cchase.yaw = 0; }); }
    if (step === 'rain') {
      await clearStretch();
      const dry = await run({ throttle: 1 }, 9, { untilMph: 60 }); const dryStop = await ev(() => { const en = MODI.rooftops.api.en(); const o0 = en.car.state.odo; en.car.drive({ brake: 1 }); for (let i = 0; i < 900 && !en.car.state.atRest; i++) en.car.step(1 / 60, 1); return +(en.car.state.odo - o0).toFixed(1); });
      await clearStretch();
      await ev(() => { const en = MODI.rooftops.api.en(); en.storm(3); }); await wait(9000); await run({}, 0.5);
      const wet = await run({ throttle: 1 }, 12, { untilMph: 60 }); const wetStop = await ev(() => { const en = MODI.rooftops.api.en(); const o0 = en.car.state.odo; en.car.drive({ brake: 1 }); for (let i = 0; i < 1200 && !en.car.state.atRest; i++) en.car.step(1 / 60, 1); return +(en.car.state.odo - o0).toFixed(1); });
      console.log('dry: 0-60 in', dry.t, 's, grip', dry.grip, ', stop from', dry.mph, 'mph in', dryStop, 'm | storm step 3: 0-60 in', wet.t, 's, grip', wet.grip, ', stop from', wet.mph, 'in', wetStop, 'm');
      await run({ throttle: 0.6 }, 2.5); await shot('rain_spray', 8000); await run({ brake: 1 }, 5, { until: 'rest' }); await ev(() => MODI.rooftops.api.en().storm(0));
    }
    if (step.startsWith('goto:')) {
      const [la, lo] = step.slice(5).split(',').map(Number), want = step.slice(5).split(',')[2] || ''; await ev(([la, lo]) => { const en = MODI.rooftops.api.en(); en.open(la, lo, 90, { mode: 'm3' }); }, [la, lo]);
      let n = 0; for (let i = 0; i < 40; i++) { await wait(3000); n = await ev(() => MODI.rooftops.api.en().state().roads); if (n > 0 && i > 3) break; }
      const put = await ev((want) => { const en = MODI.rooftops.api.en(), W = en.world; let best = null;
        /* for every road near the camera: how far it runs from here, each way, before it leaves a straight line by 1.5 m */
        for (const r of W.roads) { if (r.kind === 'path' || r.kind === 'drive' || (want && !(r.name || '').includes(want))) continue; const P = r.pts; let ni = -1, nd = 1e9, nt = 0; for (let k = 0; k + 1 < P.length; k++) { const dx = P[k + 1][0] - P[k][0], dz = P[k + 1][1] - P[k][1], l2 = dx * dx + dz * dz; if (!l2) continue; const t = Math.max(0, Math.min(1, ((W.x - P[k][0]) * dx + (W.z - P[k][1]) * dz) / l2)), d = Math.hypot(W.x - P[k][0] - dx * t, W.z - P[k][1] - dz * t); if (d < nd) { nd = d; ni = k; nt = t; } }
          if (ni < 0 || nd > 400) continue; const sx = P[ni][0] + (P[ni + 1][0] - P[ni][0]) * nt, sz = P[ni][1] + (P[ni + 1][1] - P[ni][1]) * nt;
          for (const dir of [1, -1]) { const a = P[dir > 0 ? ni + 1 : ni], l0 = Math.hypot(a[0] - sx, a[1] - sz) || 1, hx0 = (P[ni + 1][0] - P[ni][0]) * dir, hz0 = (P[ni + 1][1] - P[ni][1]) * dir, hl = Math.hypot(hx0, hz0), hx = hx0 / hl, hz = hz0 / hl; let run = 0; void l0;
            for (let k = dir > 0 ? ni + 1 : ni; k >= 0 && k < P.length; k += dir) { const ex = P[k][0] - sx, ez = P[k][1] - sz, along = ex * hx + ez * hz, side = Math.abs(-ex * hz + ez * hx); if (side > 3 || along < run - 1) break; run = along; }
            if (!best || run > best.run) best = { run, x: sx, z: sz, hx, hz, name: r.name, kind: r.kind, n: P.length }; } }
        if (!best) return null; const yaw = (Math.atan2(best.hx, -best.hz) * 180 / Math.PI + 360) % 360; en.car.place(W.lat0 - best.z / W.ky, W.lon0 + best.x / W.kx, yaw); return { straightAheadM: Math.round(best.run), name: best.name, kind: best.kind, pts: best.n, yaw: +yaw.toFixed(1), roads: W.roads.length, names: [...new Set(W.roads.map(r => r.name))].join('|') }; }, want);
      console.log('went to', la, lo, 'roads', n, 'put on', JSON.stringify(put), JSON.stringify(await ev(() => MODI.rooftops.api.en().state().note)));
    }
    if (step === 'top') {
      /* full throttle along the road the car stands on: a small helmsman holds the lane (steers at the nearest road piece that runs the car's way) */
      const leg = (t, thr) => ev(([t, thr]) => { const en = MODI.rooftops.api.en(), W = en.world, n = Math.round(t * 60); let mx = 0, off = 0, offMax = 0, c = null, onN = 0;
        for (let i = 0; i < n; i++) { const a = en.car.state, y = a.yaw * Math.PI / 180, fx = Math.sin(y), fz = -Math.cos(y);
          if (i % 2 === 0) { let best = null; for (const r of W.roads) { if (r.kind === 'path' || r.kind === 'drive') continue; for (let k = 0; k + 1 < r.pts.length; k++) { const p = r.pts[k], q = r.pts[k + 1], dx = q[0] - p[0], dz = q[1] - p[1], l = Math.hypot(dx, dz); if (l < 1) continue; const al = (dx * fx + dz * fz) / l; if (Math.abs(al) < 0.95) continue; const tt = Math.max(0, Math.min(1, ((a.x - p[0]) * dx + (a.z - p[1]) * dz) / (l * l))), ex = a.x - p[0] - dx * tt, ez = a.z - p[1] - dz * tt, d = Math.hypot(ex, ez); if (!best || d < best.d) best = { d, r, k, tt, sg: al > 0 ? 1 : -1 }; } }
            let steer = 0; if (best && best.d < 25) { /* walk ahead along that road */ const P = best.r.pts, sg = best.sg; let need = Math.max(30, a.speed * 1.3), k = best.k, px = P[k][0] + (P[k + 1][0] - P[k][0]) * best.tt, pz = P[k][1] + (P[k + 1][1] - P[k][1]) * best.tt, hx = 0, hz = 0;
              for (let g = 0; g < 400 && need > 0; g++) { const e = sg > 0 ? k + 1 : k; if (e < 0 || e >= P.length) break; const dx = P[e][0] - px, dz = P[e][1] - pz, l = Math.hypot(dx, dz); if (l > 1e-6) { hx = dx / l; hz = dz / l; } if (l >= need) { px += hx * need; pz += hz * need; need = 0; } else { px = P[e][0]; pz = P[e][1]; need -= l; k += sg; if (k < 0 || k + 1 >= P.length) break; } }
              px += -hz * 2.2; pz += hx * 2.2; const tx = px - a.x, tz = pz - a.z, L = Math.hypot(tx, tz) || 1, sinE = (fx * -tz + fz * tx) / L * -1, alat = 2 * a.speed * a.speed * sinE / L, cap = 9.81 * (a.speed < 50 ? 1.2 : Math.max(0.5, 1.2 - 0.7 * (a.speed - 50) / 65)); steer = Math.max(-1, Math.min(1, alat / cap)); off = best.d; }
            en.car.drive({ throttle: thr, brake: 0, steer }); }
          c = en.car.step(1 / 60, 1); if (c.mph > mx) mx = c.mph; if (Math.abs(off) > offMax) offMax = Math.abs(off); if (c.onRoad) onN++; }
        const st = en.state(), d = en.debug(), ra = W.roadsAt; return { mph: +c.mph.toFixed(2), max: +mx.toFixed(3), fast: c.fast, odoKm: +(c.odo / 1000).toFixed(2), onRoadPct: Math.round(onN / n * 100), off: +offMax.toFixed(1), hits: c.hits, struck: c.struck, roads: st.roads, roadsAheadM: ra ? Math.round(Math.hypot(ra[0] - en.car.state.x, ra[1] - en.car.state.z)) : null, cells: st.cells, far: d.far, origin: Math.round(Math.hypot(en.car.state.x, en.car.state.z)), lat: +c.lat.toFixed(4), lon: +c.lon.toFixed(4), yaw: +c.yaw.toFixed(1), gl: d.err }; }, [t, thr]);
      console.log('start', JSON.stringify(await car()));
      for (let k = 0; k < 22; k++) { const r = await leg(5, 1); console.log('t=' + (k * 5 + 5) + ' s', JSON.stringify(r)); await wait(4000); if (k === 14) await shot('top_speed', 6000); }
      console.log('after the run', JSON.stringify(await car()));
      console.log('brake from top', JSON.stringify(await run({ brake: 1 }, 25, { until: 'rest' })));
      await shot('after_top', 15000); console.log('world after stopping', JSON.stringify(await ev(() => { const en = MODI.rooftops.api.en(), st = en.state(); return { roads: st.roads, cells: st.cells, built: st.built, note: st.note, fast: en.world.fast }; })));
    }
    if (step === 'marks') {
      await clearStretch(); await ev(() => MODI.rooftops.api.en().car.tc(false));
      const m1 = await run({ throttle: 1 }, 1.6), m2 = await run({ throttle: 0, brake: 0, steer: 0.5, handbrake: 1 }, 1.4), m3 = await run({ brake: 1 }, 8, { until: 'rest' });
      const mk = await ev(() => { const en = MODI.rooftops.api.en(), d = en.debug(); en.car.tc(true); en.car.drive(null); en.car.camera('orbit'); en.world.cchase.pitch = -38; en.world.cchase.dist = 9; en.labels(); return { gl: d.err, marks: en.car.craft.root.scene ? [...en.engine.scene.entities.values()].filter(e => e.name === 'Tyre marks').map(e => e.active + ':' + e.get('InstancedRenderer').instances.count).join() : '' }; });
      console.log('launch, handbrake turn, stop', JSON.stringify(m1), JSON.stringify(m2), JSON.stringify(m3), 'marks', JSON.stringify(mk)); await shot('marks', 9000); await ev(() => { const en = MODI.rooftops.api.en(); en.car.camera('chase'); en.world.cchase.pitch = -9; en.world.cchase.dist = 7.2; });
    }
    if (step === 'hudshot') { await page.addStyleTag({ content: '.se-hud{display:flex!important}' }); await run({ throttle: 0.6 }, 2.2); await shot('hud', 6000); await park(); }
    if (step === 'recenter') {
      /* the world moves its origin when the camera is 12 km from it: put the car 11.93 km east, drive east across the line, and see that nothing jumps */
      const r = await ev(() => { const en = MODI.rooftops.api.en(), W = en.world, o0 = [W.lat0, W.lon0]; en.car.place(W.lat0, W.lon0 + 11930 / W.kx, 90, { exact: true }); en.car.drive({ throttle: 0.35 }); const log = []; let jump = 0, prev = null, moved = null;
        for (let i = 0; i < 600; i++) { const c = en.car.step(1 / 60, 1), a = en.car.state; if (prev) { const dLat = (c.lat - prev.lat) * 111132, dLon = (c.lon - prev.lon) * W.kx, d = Math.hypot(dLat, dLon), dv = Math.abs(a.speed - prev.v); if (Math.abs(d - a.speed / 60) > jump) jump = Math.abs(d - a.speed / 60); if (dv > 1) log.push('speed jump ' + dv.toFixed(2) + ' at step ' + i); }
          if (!moved && (W.lat0 !== o0[0] || W.lon0 !== o0[1])) moved = { step: i, mph: +c.mph.toFixed(1), localX: +a.x.toFixed(1), localZ: +a.z.toFixed(1) }; prev = { lat: c.lat, lon: c.lon, v: a.speed }; }
        const a = en.car.state, h = W.hero; return { originMoved: moved, greatestStepError_m: +jump.toFixed(4), log, endMph: +a.mph.toFixed(1), endLocal: [+a.x.toFixed(1), +a.z.toFixed(1)], hero: h && [+h.x.toFixed(1), +h.z.toFixed(1)], cam: [+W.x.toFixed(1), +W.z.toFixed(1)], yaw: +a.yaw.toFixed(1) }; });
      console.log('origin moved under a moving car', JSON.stringify(r)); await park(); await wait(8000);
      console.log('world after', JSON.stringify(await ev(() => { const en = MODI.rooftops.api.en(), st = en.state(), d = en.debug(); return { roads: st.roads, cells: st.cells, far: d.far, gl: d.err, note: (st.note || '').slice(0, 50) }; })));
    }
    if (step === 'leave') { await ev(() => { const en = MODI.rooftops.api.en(); en.car.drive(null); en.setHeight('drone'); }); await wait(3000); console.log('left', JSON.stringify(await ev(() => { const en = MODI.rooftops.api.en(), st = en.state(), h = en.world.hero; return { mode: st.mode, car: st.car && { mph: st.car.mph, driving: st.car.driving }, hero: h && { on: h.on, driving: h.driving, speed: h.speed } }; }))); await shot('parked_from_drone', 8000); await ev(() => MODI.rooftops.api.en().setHeight('m3')); await wait(1500); console.log('back in', JSON.stringify(await car())); }
  }
  console.log('PAGE ERRORS:', errs.length ? errs.join('\n') : 'none');
  await browser.close();
})().catch(e => { console.error('ERROR', e); process.exit(2); });
