async () => {
  /* stop the engine's own loop, go to the drone height, and time frames by hand: the update and the draw apart */
  const en = MODI.rooftops.api.en(), E = en.engine, R = E.renderer, gl = E.device.gl, out = [];
  const say = (...a) => console.log('[dense] ' + a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' '));
  E.stop();
  const frame = (label) => {
    const dt = 1 / 30, t0 = performance.now(); E.resize(); E.emit('input', dt); E.emit('update', dt); E.scene.lateUpdate(dt);
    const t1 = performance.now(); let err = null; try { R.render(E.scene, E.camera, E.time.now, dt); } catch (e) { err = String(e).slice(0, 200); }
    const t2 = performance.now(); gl.finish(); const t3 = performance.now(); E.time.frame++;
    const st = en.state(), r = { label, update: Math.round(t1 - t0), render: Math.round(t2 - t1), finish: Math.round(t3 - t2), stats: Object.assign({}, R.stats), built: st.built, cells: st.cells, queued: st.queued, glerr: gl.getError(), err, lost: gl.isContextLost() };
    say('frame', r); out.push(r); return r;
  };
  const nap = ms => new Promise(r => setTimeout(r, ms));
  frame('street0'); await nap(50); frame('street1'); await nap(50);
  en.setHeight((window.__PROBE_MODE__ || 'drone')); say('mode', en.state().mode);
  for (let i = 0; i < 6; i++) { frame('drone' + i); await nap(300); }
  return out.length;
}
