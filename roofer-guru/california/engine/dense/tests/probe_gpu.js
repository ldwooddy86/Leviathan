async () => {
  /* the real cost of a frame on the graphics side: draw it, then read one pixel back (that waits until it is drawn).
     Then parts of the scene are switched off one at a time to see what the cost is made of. window.__PROBE_MODE__: the height. */
  const en = MODI.rooftops.api.en(), E = en.engine, R = E.renderer, gl = E.device.gl, S = E.scene, rows = [];
  const say = (...a) => console.log('[dense] ' + a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' '));
  const nap = ms => new Promise(r => setTimeout(r, ms)), px = new Uint8Array(4);
  E.stop(); await nap(200);
  const sync = () => { E.device.bind(null); gl.readPixels(1, 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); };
  sync();
  const frame = (label) => {
    const dt = 1 / 30, t0 = performance.now(); E.emit('input', dt); E.emit('update', dt); S.lateUpdate(dt);
    const t1 = performance.now(); R.render(S, E.camera, E.time.now, dt); const t2 = performance.now(); sync(); const t3 = performance.now(); E.time.frame++;
    const st = R.stats, r = { label, upd: Math.round(t1 - t0), calls: Math.round(t2 - t1), gpu: Math.round(t3 - t2), draws: st.draws, tris: st.tris, inst: st.instances, sh: st.shadowDraws, vis: st.visible };
    say('gpu', r); rows.push(r); return r;
  };
  const mode = window.__PROBE_MODE__ || 'drone';
  frame('as found (' + en.state().mode + ')'); await nap(30); frame('as found 2'); await nap(30);
  if (en.state().mode !== mode) { en.setHeight(mode); frame(mode + ' first'); await nap(30); frame(mode + ' 2'); await nap(30); frame(mode + ' 3'); await nap(30); }
  const set = R.settings, keep = Object.assign({}, set);
  const off = async (label, f, undo) => { f(); frame(label + ' a'); await nap(30); frame(label + ' b'); undo(); await nap(30); };
  await off('no shadows', () => { set.shadows = false; }, () => { set.shadows = keep.shadows; });
  await off('no bloom', () => { set.bloom = false; }, () => { set.bloom = keep.bloom; });
  for (const name of ['Cells', 'Far ground', 'Streets', 'Wider city (context, generated blocks)', 'Lights and weather', 'Horizon']) {
    const e = S.find(name); if (!e) { say('no entity', name); continue; }
    await off('without ' + name, () => e.setActive(false), () => e.setActive(true));
  }
  { const wk = [...S.entities.values()].filter(e => /^Wide |^Skyline/.test(e.name)); const was = wk.map(e => e.active); await off('without Wide* and Skyline (' + wk.length + ')', () => wk.forEach(e => e.setActive(false)), () => wk.forEach((e, i) => e.setActive(was[i]))); }
  { const wk = [...S.entities.values()].filter(e => /^Tile /.test(e.name)); const was = wk.map(e => e.active); await off('without Tile* (' + wk.length + ')', () => wk.forEach(e => e.setActive(false)), () => wk.forEach((e, i) => e.setActive(was[i]))); }
  /* each cell alone off */
  if (window.__PROBE_CELLS__) { const cs = [...S.entities.values()].filter(e => /^Cell /.test(e.name)); for (const c of cs) await off('without ' + c.name, () => c.setActive(false), () => c.setActive(true)); }
  frame('all back'); E.start();
  return rows;
}
