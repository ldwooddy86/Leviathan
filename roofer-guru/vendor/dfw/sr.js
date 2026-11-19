<script id="scout-sr">
/* ==== rooftop scout: AI detail for the satellite map ==== */
/* Real-ESRGAN (realesr-general-x4v3, BSD-3-Clause, Xintao Wang and contributors): a compact super-resolution network
   (64 features, 32 convolutions with PReLU, x4 by pixel shuffle, added to a nearest-neighbour upscale of its input) that
   draws four times the detail from a picture. It runs here in TensorFlow.js on the graphics card (window.__SCOUT_TF__),
   with its 1.2 million weights carried in the page as float16 (window.__SCOUT_SRW__). window.__SCOUT_SR__.enhance(canvas)
   returns a canvas four times larger. The map asks for one imagery tile at a time with a 16 pixel margin from its
   neighbours, so the edges between enhanced tiles do not show. Nothing leaves the browser.
   The detail it adds is inferred, not photographed: it sharpens what the picture holds and invents fine texture
   consistent with it. The map says so wherever it shows. */
(function () {
  'use strict';
  let netP = null, busy = Promise.resolve();
  const f16 = h => { const s = h >> 15, e = (h >> 10) & 31, m = h & 1023; return (s ? -1 : 1) * (e === 0 ? m * 5.960464477539063e-8 : e === 31 ? (m ? NaN : Infinity) : Math.pow(2, e - 15) * (1 + m / 1024)); };
  function load() {
    if (netP) return netP;
    netP = (async () => {
      const tf = window.__SCOUT_TF__, W = window.__SCOUT_SRW__; if (!tf || !W || !W.bin) throw new Error('the AI model is not in this build');
      try { await tf.setBackend('webgl'); } catch (e) { /* the default backend then */ }
      await tf.ready(); if (tf.getBackend() !== 'webgl') throw new Error('this browser gives the AI no WebGL');
      const raw = atob(W.bin), u16 = new Uint16Array(raw.length / 2); for (let i = 0; i < u16.length; i++) u16[i] = raw.charCodeAt(2 * i) | (raw.charCodeAt(2 * i + 1) << 8);
      const take = l => { const a = u16.subarray(l.offset / 2, (l.offset + l.bytes) / 2), f = new Float32Array(a.length); for (let i = 0; i < a.length; i++) f[i] = f16(a[i]); return tf.tensor(f, l.shape, 'float32'); };
      const layers = []; W.meta.layers.forEach(l => { if (l.kind === 'kernel') layers.push({ k: take(l) }); else if (l.kind === 'bias') layers[layers.length - 1].b = take(l); else layers.push({ a: take(l) }); });
      return { tf, layers, scale: W.meta.scale };
    })().catch(e => { netP = null; throw e; });
    return netP;
  }
  /* one picture through the network: float RGB in 0..1, [h, w, 3] -> [4h, 4w, 3] */
  function forward(N, x0) {
    const tf = N.tf;
    return tf.tidy(() => {
      const inp = tf.expandDims(x0, 0); let x = inp;
      for (const L of N.layers) x = L.k ? tf.add(tf.conv2d(x, L.k, 1, 'same'), L.b) : tf.prelu(x, L.a);
      x = tf.depthToSpace(x, N.scale, 'NHWC');
      const [, h, w] = inp.shape, base = tf.image.resizeNearestNeighbor(inp, [h * N.scale, w * N.scale]);
      return tf.squeeze(tf.clipByValue(tf.add(x, base), 0, 1), [0]);
    });
  }
  /* enhance a canvas (any size): returns a canvas scale times larger; one job at a time on the graphics card */
  function enhance(src) {
    const job = busy.then(async () => {
      const N = await load(), tf = N.tf, t0 = performance.now();
      const x = tf.tidy(() => tf.div(tf.cast(tf.browser.fromPixels(src), 'float32'), 255));
      const y = forward(N, x); x.dispose();
      const out = document.createElement('canvas'); out.width = src.width * N.scale; out.height = src.height * N.scale;
      await tf.browser.toPixels(y, out); y.dispose();
      enhance.lastMs = Math.round(performance.now() - t0); return out;
    });
    busy = job.catch(() => {}); return job;
  }
  /* for tests: run raw floats [h, w, 3] and return floats [4h, 4w, 3] */
  async function runFloat(data, h, w) { const N = await load(), tf = N.tf, x = tf.tensor(data, [h, w, 3], 'float32'), y = forward(N, x); x.dispose(); const out = await y.data(); y.dispose(); return out; }
  window.__SCOUT_SR__ = { load, enhance, runFloat, get backend() { const tf = window.__SCOUT_TF__; return tf ? tf.getBackend() : null; } };
})();
</script>
