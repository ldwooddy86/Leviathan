/* What the terrain costs. Run on the page with the terrain and on the page without (the Louisiana engine), at the same
   place, quality and views. The renderer here is software, so frame times are only good against each other; triangles,
   draws and the script's own time are the figures that carry to a real card.
   node t_perf.js <page.html> <label> [high|low] */
const L = require('./lib.js'), { wait } = L;
const FILE = process.argv[2], LABEL = process.argv[3] || 'page', Q = process.argv[4] || 'high';
(async () => {
  const T = await L.start(FILE, '1000 Filbert St, San Francisco, CA', { gfx: { q: Q, life: true, wide: true, trees: true, lamps: true }, w: 800, h: 600 });
  await T.open(37.80016, -122.41857, 81, { mode: 'street' }); await wait(20000);
  for (let i = 0; i < 40; i++) { await wait(3000); const s = await T.ev(() => { const en = MODI.rooftops.api.en(), st = en.state(), g = en.graphics(); return [st.queued, st.terrain ? st.terrain.loading + st.terrain.queue : 0, g.widePending]; }); if (!s[0] && !s[1] && !s[2] && i > 3) break; }
  const out = { label: LABEL, q: Q };
  /* a frame in each view: triangles, draws, and the time of one render call (software) */
  for (const m of ['street', 'drone', 'bird', 'metro']) { await T.ev(m2 => { const en = MODI.rooftops.api.en(); en.setHeight(m2); en.world.yaw = 20; if (m2 === 'street') en.world.pitch = 2; en.engine.requestRender(3); }, m); await wait(m === 'metro' ? 30000 : 14000);
    for (let i = 0; i < 20; i++) { await wait(2500); const s = await T.ev(() => { const en = MODI.rooftops.api.en(), st = en.state(), g = en.graphics(); return [st.queued, st.terrain ? st.terrain.loading + st.terrain.queue : 0, g.widePending]; }); if (!s[0] && !s[1] && !s[2]) break; }
    out[m] = await T.ev(() => { const en = MODI.rooftops.api.en(), E = en.engine, R = E.renderer; E.stop(); const ts = []; for (let i = 0; i < 3; i++) { E.emit('update', 0.016); const t0 = performance.now(); R.render(E.scene, E.camera, E.time.now, 0.016); E.device.gl.finish(); ts.push(performance.now() - t0); } const st = R.stats; ts.sort((a, b) => a - b); const r = { tris: st.tris, draws: st.draws, clusters: st.clusters, renderMs: +ts[1].toFixed(0) }; en.start(); return r; }); }
  /* the script's own time: updates while walking 60 m (cells and ground built on the way), one S.gy, one street build */
  out.script = await T.ev(() => { const en = MODI.rooftops.api.en(), E = en.engine, S = en.world, r = {}; E.stop(); en.setHeight('walk'); S.yaw = 81; S.keys.fwd = true; const ts = []; for (let i = 0; i < 400; i++) { const t0 = performance.now(); E.emit('update', 0.033); ts.push(performance.now() - t0); } S.keys.fwd = false; ts.sort((a, b) => a - b);
    r.updateMedianMs = +ts[200].toFixed(3); r.updateP95Ms = +ts[380].toFixed(2); r.updateMaxMs = +ts[399].toFixed(1);
    if (S.gy) { let acc = 0; const t0 = performance.now(); for (let i = 0; i < 200000; i++) acc += S.gy(S.x + (i % 200) - 100, S.z + ((i / 200) % 200) - 100); r.gyNs = +((performance.now() - t0) / 200000 * 1e6).toFixed(0); const t1 = performance.now(); for (let i = 0; i < 200000; i++) acc += S.gy(S.x + (i * 7919 % 9000) - 4500, S.z + (i * 104729 % 9000) - 4500); r.gyFarNs = +((performance.now() - t1) / 200000 * 1e6).toFixed(0); r.terrain = en.state().terrain; }
    r.roads = S.roads.length; r.cells = en.debug().cells.length; r.far = en.debug().far; r.buffers = en.debug().buffers; en.start(); return r; });
  console.log(JSON.stringify(out));
  console.log('errors', T.errs.length ? T.errs.slice(0, 3) : 'none');
  await T.browser.close(); process.exit(0);
})().catch(e => { console.error('ERROR', e); process.exit(2); });
