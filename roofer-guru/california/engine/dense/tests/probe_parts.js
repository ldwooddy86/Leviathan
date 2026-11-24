async () => {
  /* which part of a frame is slow: reading the canvas size (layout), resize, input, update, lateUpdate, draw, watch */
  const en = MODI.rooftops.api.en(), E = en.engine, R = E.renderer, gl = E.device.gl, rows = [];
  const say = (...a) => console.log('[dense] ' + a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' '));
  const nap = ms => new Promise(r => setTimeout(r, ms));
  const T = f => { const t = performance.now(); let v; try { v = f(); } catch (e) { v = 'ERR ' + e; } return [Math.round((performance.now() - t) * 10) / 10, v]; };
  E.stop(); await nap(100);
  const one = () => {
    const dt = 1 / 30, r = {};
    r.clientW = T(() => E.canvas.clientWidth)[0];
    r.resize = T(() => E.resize()); r.input = T(() => E.emit('input', dt))[0];
    r.fixed = T(() => { E.scene.fixedUpdate(E.time.fixed); if (E.physics) E.physics.step(E.time.fixed); })[0];
    r.sceneUpdate = T(() => E.scene.update(dt))[0];
    r.update = T(() => E.emit('update', dt))[0]; r.late = T(() => E.scene.lateUpdate(dt))[0];
    r.clientW2 = T(() => E.canvas.clientWidth)[0];
    r.draw = T(() => R.render(E.scene, E.camera, E.time.now, dt))[0]; r.watch = T(() => E._watch && E._watch())[0]; r.frameEv = T(() => E.emit('frame', dt))[0];
    r.finish = T(() => gl.finish())[0]; r.clientW3 = T(() => E.canvas.clientWidth)[0]; E.time.frame++; return r;
  };
  for (let i = 0; i < 4; i++) { const r = one(); say('parts', r); rows.push(r); await nap(200); }
  /* the page: how many elements, how long a forced layout takes */
  const dom = { all: document.getElementsByTagName('*').length, host: E.canvas.parentNode.getElementsByTagName('*').length };
  const lay = T(() => { document.body.style.paddingBottom = '1px'; const h = document.body.offsetHeight; document.body.style.paddingBottom = ''; return h; });
  say('dom', dom, 'forced layout ms', lay[0]);
  /* listeners on update: time each */
  const L = (E._l && E._l.update) || (E.listeners && E.listeners.update) || null; say('emitter keys', Object.keys(E).filter(k => k[0] === '_').slice(0, 30));
  E.start();
  return rows.length;
}
