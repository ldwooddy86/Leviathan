/* debugging aid: where the page spends its time after a step given as code. Pauses the debugger a few times and prints the stack.
   node dbg_walk.js <page.html> "<js run in the page with en>" */
const L = require('./lib.js'), { wait } = L;
(async () => {
  const T = await L.start(process.argv[2], '1000 Filbert St, San Francisco, CA', {});
  await T.open(37.80016, -122.41857, 90, { mode: 'street' }); console.log('ready', JSON.stringify(await T.ready(120000, true)));
  const cdp = await T.page.context().newCDPSession(T.page); await cdp.send('Debugger.enable');
  let paused = null; cdp.on('Debugger.paused', e => { paused = e; });
  await T.page.evaluate(code => { const en = MODI.rooftops.api.en(); (new Function('en', code))(en); }, process.argv[3] || "en.setHeight('walk')");
  for (let i = 0; i < 6; i++) { await wait(2500); paused = null; await cdp.send('Debugger.pause'); for (let k = 0; k < 40 && !paused; k++) await wait(100);
    if (!paused) { console.log('not paused (idle)'); continue; }
    console.log('--- stack', i); paused.callFrames.slice(0, 9).forEach(f => console.log('   ', f.functionName || '(anon)', f.location.lineNumber + ':' + f.location.columnNumber));
    await cdp.send('Debugger.resume'); }
  await T.browser.close(); process.exit(0);
})().catch(e => { console.error('ERROR', e); process.exit(2); });
