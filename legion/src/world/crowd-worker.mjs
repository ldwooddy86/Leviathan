// Legion · the crowd Worker: builds the agents off the main thread and answers stats queries.
//
// Messages in
//   {type: 'build', id, pack, popSeed, rate, seed, focus, regions, chunkTarget}
//       pack: gzip bytes, a base64 gzip string or the parsed pack object (null: reuse the world already loaded)
//   {type: 'stats', seq, minute, dow, t}    counts by state over the chunks of the latest build
//   {type: 'cancel'}                        stop the running build at the next chunk
// Messages out
//   {type: 'loaded', id, ms} · {type: 'chunk', id, chunk, progress} (typed arrays transferred) ·
//   {type: 'progress', id, progress} · {type: 'done', id, summary} · {type: 'error', id, message} ·
//   {type: 'stats', seq, stats, t}
//
// The World and Population built here are the main thread's twins: both are pure functions of the pack and the seed.
// Bundled as a classic IIFE for the single-file app (no import.meta here), or run as a module worker in development.

import { loadPack, createWorld } from '../engine/world.mjs';
import { Population } from '../engine/population.mjs';
import { buildRoadNet, buildAgentsGen, countStates } from './crowd-build.mjs';

const S = { world: null, pop: null, popKey: null, net: null, chunks: [], job: 0 };

const post = (msg, transfer) => self.postMessage(msg, transfer || []);
const nextTask = () => new Promise(r => setTimeout(r, 0));
const buffersOf = c => [c.home, c.dest, c.timing, c.days, c.mode, c.route, c.errand, c.eoff, c.ids, c.overflow, c.zis, c.byMode]
  .concat(c.pick ? [c.pick.start, c.pick.items] : []).map(a => a.buffer);

async function build(m) {
  const id = m.id;
  S.job = id;
  try {
    const t0 = performance.now();
    if (m.pack != null) { S.world = createWorld(await loadPack(m.pack)); S.pop = null; S.net = null; }
    if (!S.world) throw new Error('no world pack');
    if (S.job !== id) return;
    const key = m.popSeed == null ? 'default' : String(m.popSeed);
    if (!S.pop || S.popKey !== key) { S.pop = new Population(S.world, m.popSeed == null ? {} : { seed: m.popSeed }); S.popKey = key; }
    if (!S.net) S.net = buildRoadNet(S.world);
    S.world.raster();
    post({ type: 'loaded', id, ms: Math.round(performance.now() - t0) });
    S.chunks = [];
    const gen = buildAgentsGen(S.world, S.pop, {
      rate: m.rate, seed: m.seed, focus: m.focus || null, regions: m.regions || null,
      chunkTarget: m.chunkTarget || 131072, byRegion: true, roadNet: S.net, pickIndex: true,
    });
    let r, last = 0;
    while (!(r = gen.next()).done) {
      if (S.job !== id) return;
      const v = r.value;
      if (v.type === 'chunk') {
        const c = v.chunk;
        // the state arrays stay here (copies) for stats; everything else moves to the main thread
        S.chunks.push({ count: c.count, unitKm: c.unitKm, days: c.days.slice(), timing: c.timing.slice(), errand: c.errand.slice(), eoff: c.eoff.slice(), mode: c.mode.slice() });
        post({ type: 'chunk', id, chunk: c, progress: v.progress }, buffersOf(c));
        last = v.progress;
        await nextTask();
      } else if (v.progress - last >= 0.02) {
        post({ type: 'progress', id, progress: v.progress });
        last = v.progress;
      }
    }
    if (S.job === id) post({ type: 'done', id, summary: r.value });
  } catch (err) {
    post({ type: 'error', id, message: String((err && (err.stack || err.message)) || err) });
  }
}

function stats(m) {
  const st = countStates(S.chunks, m.minute, m.dow);
  post({ type: 'stats', seq: m.seq, stats: st, t: m.t });
}

self.onmessage = e => {
  const m = e.data || {};
  if (m.type === 'build') build(m);
  else if (m.type === 'stats') stats(m);
  else if (m.type === 'cancel') S.job = -1;
};
