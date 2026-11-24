/* node --expose-gc worker_mem.js: what one crowd worker holds after "prepare", and after building a ZIP and the
   statewide 2.5 percent sample. The worker's own source is run here in Node with a stand-in for `self`. */
const fs = require('fs'), path = require('path');
const src = JSON.parse(fs.readFileSync(path.join(__dirname, '../out/legion.worker.js'), 'utf8').replace(/^window\.__LEGION_WORKER_SRC__=/, ''));
const pack = JSON.parse(fs.readFileSync(path.join(__dirname, '../out/legion.pack.js'), 'utf8').replace(/^window\.__LEGION_PACK__=/, ''));
const msgs = []; let waiter = null;
global.self = { postMessage(m) { msgs.push(m); if (waiter && waiter.test(m)) { const w = waiter; waiter = null; w.done(m); } } };
const until = test => new Promise(done => { waiter = { test, done }; });
const mb = () => { if (global.gc) global.gc(); const m = process.memoryUsage(); return { heap: Math.round(m.heapUsed / 1048576), buffers: Math.round(m.arrayBuffers / 1048576), rss: Math.round(m.rss / 1048576) }; };
(async () => {
  const m0 = mb(); (0, eval)(src); const m1 = mb();
  let t = Date.now(); let p = until(m => m.type === 'prepared' || m.type === 'error'); self.onmessage({ data: { type: 'prepare', pack, popSeed: 1849 } }); const r = await p; const m2 = mb();
  console.log('worker source run', JSON.stringify(m1), 'from', JSON.stringify(m0)); console.log('after prepare', r.type, r.ms, 'ms (wall', Date.now() - t, ')', JSON.stringify(m2));
  t = Date.now(); p = until(m => m.type === 'done' || m.type === 'error'); msgs.length = 0; self.onmessage({ data: { type: 'build', id: 1, rate: 1, seed: 1849, popSeed: 1849, focus: null, zips: [10], chunkTarget: 131072, firstChunkTarget: 0, pack: null } }); let d = await p;
  console.log('one ZIP at rate 1 (90012)', d.type, d.summary && { agents: d.summary.agents, households: d.summary.households, ms: d.summary.ms, pickBytesPerAgent: d.summary.pickBytesPerAgent }, 'wall', Date.now() - t, JSON.stringify(mb()));
  t = Date.now(); p = until(m => m.type === 'done' || m.type === 'error'); msgs.length = 0; self.onmessage({ data: { type: 'build', id: 2, rate: 0.025, seed: 1849, popSeed: 1849, focus: null, zips: null, chunkTarget: 131072, firstChunkTarget: 0, pack: null } }); d = await p;
  console.log('the state at rate 0.025, one worker', d.type, d.summary && { agents: d.summary.agents, ms: d.summary.ms }, 'wall', Date.now() - t, 'holding the chunks', JSON.stringify(mb())); msgs.length = 0; console.log('chunks handed on', JSON.stringify(mb()));
})();
