async () => {
  /* How deep does the queue of undrawn frames get, and what stops the page answering?
     Three phases of window.__PACE_S__ seconds each (default 30), the camera turning the whole time so frames are wanted:
       A as the engine is; B the black-picture watch switched off; C watch off and a fence gate (a frame is not started
       until the frame before it has been drawn). Each phase reports frames started, the longest time the page's main
       thread did not come back to its event loop, the time inside the watch, and at the end how long one readPixels
       takes (that is the queue: everything handed over and not yet drawn). */
  const en = MODI.rooftops.api.en(), E = en.engine, gl = E.device.gl, px = new Uint8Array(4), SEC = window.__PACE_S__ || 30, out = [];
  const say = (...a) => console.log('[dense] ' + a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' '));
  const nap = ms => new Promise(r => setTimeout(r, ms));
  const drain = () => { const t = performance.now(); E.device.bind(null); gl.readPixels(1, 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); return Math.round(performance.now() - t); };
  const frame0 = E._frame, watch0 = E._watch.bind(E);
  let frames = 0, watchMs = 0, watchN = 0, skipped = 0;
  const phase = async (label) => {
    drain(); const p0 = E.pacing ? E.pacing() : null; frames = 0; watchMs = 0; watchN = 0; skipped = 0; let gap = 0, last = performance.now(); const t0 = last;
    const tick = setInterval(() => { const n = performance.now(); gap = Math.max(gap, n - last); last = n; en.turn(0.7); }, 100);
    while (performance.now() - t0 < SEC * 1000) await nap(250);
    clearInterval(tick); gap = Math.max(gap, performance.now() - last); const wall = Math.round(performance.now() - t0), q = drain();
    const r = { label, wallMs: wall, framesStarted: frames, skippedTurns: skipped, longestFreezeMs: Math.round(gap), watchCalls: watchN, watchMs: Math.round(watchMs), queueAtEndMs: q, tris: E.renderer.stats.tris, draws: E.renderer.stats.draws, pacing: E.pacing ? E.pacing() : null, drawn: p0 ? E.pacing().drawn - p0.drawn : null };
    say('pace', r); out.push(r); await nap(300);
  };
  /* count frames; time the watch */
  E._frame = function (now) { frames++; return frame0(now); };
  E._watch = function () { const t = performance.now(); const W = E._watchS; const before = W ? W.left : null; watch0(); const d = performance.now() - t; if (d > 1) { watchMs += d; watchN++; } };
  if (E._watchS) { E._watchS.left = 12; }
  const PH = String(window.__PACE_PHASES__ || 'ABC');
  if (PH.includes('A')) await phase('A as it is');
  E._watch = function () {};
  if (PH.includes('B')) await phase('B watch off');
  let sync = null;
  E._frame = function (now) {
    if (sync) { const st = gl.clientWaitSync(sync, 0, 0); if (st === gl.TIMEOUT_EXPIRED) { skipped++; E._raf = requestAnimationFrame(E._frame); return; } gl.deleteSync(sync); sync = null; }
    frames++; frame0(now); sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0); gl.flush();
  };
  if (PH.includes('C')) await phase('C watch off, fence gate');
  E._frame = frame0; E._watch = watch0; if (sync) gl.deleteSync(sync);
  return out;
}
