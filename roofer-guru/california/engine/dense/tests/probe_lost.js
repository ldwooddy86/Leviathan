async () => {
  /* the graphics context taken away and given back (WEBGL_lose_context): is it said in the view, does the page live */
  const en = MODI.rooftops.api.en(), E = en.engine, gl = E.device.gl, out = {};
  const say = (...a) => console.log('[dense] ' + a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' '));
  const nap = ms => new Promise(r => setTimeout(r, ms));
  const noteEl = document.querySelector('#scEnNote'), warnEl = E.canvas.parentNode.querySelector('.se-warn');
  const read = () => ({ note: noteEl ? noteEl.textContent.slice(0, 260) : null, warn: warnEl && !warnEl.hidden ? warnEl.textContent.slice(0, 90) : null, lost: gl.isContextLost(), deviceLost: E.device.lost, broken: E.broken || null, graphicsBroken: en.graphics().broken || null, running: E.running, pacing: E.pacing ? E.pacing() : null });
  out.before = read(); say('before', out.before);
  const ext = gl.getExtension('WEBGL_lose_context'); if (!ext) { say('no WEBGL_lose_context'); return out; }
  ext.loseContext(); await nap(1500); en.turn(5); await nap(1500);
  out.lost = read(); say('after the context was lost', out.lost);
  ext.restoreContext(); await nap(2500); en.turn(5); await nap(1500);
  out.restored = read(); say('after it was given back', out.restored);
  /* the page still does its other work */
  let ticks = 0; const t = setInterval(() => ticks++, 50); await nap(1000); clearInterval(t); out.ticksInOneSecond = ticks; say('timer ticks in one second', ticks, 'state', en.state().mode);
  return out;
}
