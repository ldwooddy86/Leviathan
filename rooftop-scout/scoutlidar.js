/* ==== rooftop scout: lidar ==== */
/* The measured shape of the neighborhood, keyless: the USGS 3D Elevation Program's airborne lidar of Dallas Fort Worth
   (public domain), read straight from its public Entwine Point Tile copy on Amazon S3 (usgs-lidar-public, open to any
   browser). window.__SCOUT_LIDAR__.load(o) picks the newest collection whose outline holds the point (the table of the
   DFW collections is carried in the file), walks its octree to the pieces that cover the scene, fetches them six at a
   time, decodes them with laz-perf (WebAssembly, carried inline as window.__SCOUT_LAZ__), and returns every point with
   its height above a ground model built from the ground returns, and whether it was a single, last or first of several
   returns (roofs answer once, foliage several times). Coarse levels of the octree, which hold a thin sample of a whole
   county, are skipped: they cost megabytes and add almost no points to one street. Pieces are kept in memory, so walking
   on and coming back fetches nothing twice. Nothing here draws; scout3d.js turns the points into roofs and tree crowns. */
(function () {
  'use strict';
  const RE = 6378137, D2R = Math.PI / 180, BASE = 'https://s3-us-west-2.amazonaws.com/usgs-lidar-public/';
  const pieces = new Map(); let held = 0; const HOLD = 180e6;
  const trees = new Map();   /* collection: { ept, hier, got } */
  let lazP = null;
  const laz = () => lazP || (lazP = (async () => {
    const L = window.__SCOUT_LAZ__; if (!L || !L.create || !L.wasm || L.wasm.length < 1000) throw new Error('the LAZ decoder is not in this build');
    const s = atob(L.wasm), b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
    return L.create({ wasmBinary: b });
  })().catch(e => { lazP = null; throw e; }));
  const inRing = (x, y, R) => { let c = false; for (let i = 0, j = R.length - 1; i < R.length; j = i++) { const a = R[i], b = R[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
  const resourcesAt = (index, la, lo) => (index || []).filter(r => lo >= r[2][0] && lo <= r[2][2] && la >= r[2][1] && la <= r[2][3] && inRing(lo, la, r[3])).sort((a, b) => b[1] - a[1]);
  const tick = () => new Promise(r => setTimeout(r, 0));
  async function getJSON(u, signal) { const r = await fetch(u, { signal, credentials: 'omit' }); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }
  async function getPiece(u, signal) {
    if (pieces.has(u)) { const b = pieces.get(u); pieces.delete(u); pieces.set(u, b); return b; }
    const r = await fetch(u, { signal, credentials: 'omit' }); if (!r.ok) throw new Error('HTTP ' + r.status);
    const b = new Uint8Array(await r.arrayBuffer()); pieces.set(u, b); held += b.length;
    while (held > HOLD && pieces.size > 1) { const k = pieces.keys().next().value; held -= pieces.get(k).length; pieces.delete(k); }
    return b;
  }
  /* growable columns */
  function cols(n) { return { n: 0, cap: n, x: new Float32Array(n), z: new Float32Array(n), e: new Float32Array(n), c: new Uint8Array(n), f: new Uint8Array(n) }; }
  function grow(P) { const cap = P.cap * 2, Q = cols(cap); Q.n = P.n; ['x', 'z', 'e', 'c', 'f'].forEach(k => Q[k].set(P[k].subarray(0, P.n))); return Q; }

  /* o: { index, lat, lon, half (m), kx, ky (m per degree of longitude and latitude at lat), alive(), signal, onProgress(done, total, bytes) } */
  async function load(o) {
    const cands = resourcesAt(o.index, o.lat, o.lon); if (!cands.length) return { none: 'no USGS lidar collection covers this place' };
    const mx0 = RE * o.lon * D2R, my0 = RE * Math.log(Math.tan(Math.PI / 4 + o.lat * D2R / 2));
    const kE = o.kx / (RE * D2R), kN = o.ky * Math.cos(o.lat * D2R) / (RE * D2R);   /* metres per Mercator unit, east and north */
    const hmx = o.half / kE, hmy = o.half / kN, box = [mx0 - hmx, my0 - hmy, mx0 + hmx, my0 + hmy];
    let lastErr = null; const t0 = performance.now();
    for (const res of cands) {
      const base = BASE + res[0] + '/';
      try {
        let t = trees.get(base); if (!t) { t = { ept: await getJSON(base + 'ept.json', o.signal), hier: {}, got: new Set() }; trees.set(base, t); }
        const b = t.ept.bounds, span = b[3] - b[0];
        const getH = async key => { if (t.got.has(key)) return; Object.assign(t.hier, await getJSON(base + 'ept-hierarchy/' + key + '.json', o.signal)); t.got.add(key); };
        await getH('0-0-0-0');
        const dMin = Math.max(0, Math.ceil(Math.log2(span / (1.1 * 2 * Math.max(hmx, hmy))))), keys = [];
        const walk = async (d, x, y, z) => {
          const key = d + '-' + x + '-' + y + '-' + z; let n = t.hier[key]; if (n === undefined) return;
          const s = span / Math.pow(2, d), x0 = b[0] + x * s, y0 = b[1] + y * s; if (x0 > box[2] || x0 + s < box[0] || y0 > box[3] || y0 + s < box[1]) return;
          if (n === -1) { await getH(key); n = t.hier[key]; if (n === undefined || n === -1) return; }
          if (d >= dMin && n > 0) keys.push(key);
          const kids = []; for (let i = 0; i < 8; i++) kids.push(walk(d + 1, 2 * x + (i & 1), 2 * y + ((i >> 1) & 1), 2 * z + ((i >> 2) & 1))); await Promise.all(kids);
        };
        await walk(0, 0, 0, 0);
        if (!o.alive()) return null;
        if (!keys.length) continue;
        const L = await laz(); let P = cols(1 << 20), done = 0, bytes = 0;
        const decode = buf => {
          const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength), fmt = buf[104] & 0x3f, rl = dv.getUint16(105, true), minor = buf[25];
          let cnt = dv.getUint32(107, true); if (!cnt && minor >= 4 && buf.length > 255) cnt = Number(dv.getBigUint64(247, true));
          const sx = dv.getFloat64(131, true), sy = dv.getFloat64(139, true), sz = dv.getFloat64(147, true), ox = dv.getFloat64(155, true), oy = dv.getFloat64(163, true), oz = dv.getFloat64(171, true), x6 = fmt >= 6;
          const fp = L._malloc(buf.length), pp = L._malloc(rl); L.HEAPU8.set(buf, fp); const zr = new L.LASZip();
          try {
            zr.open(fp, buf.length);
            let h = L.HEAPU8, v = new DataView(h.buffer);
            for (let i = 0; i < cnt; i++) {
              zr.getPoint(pp); if (h.buffer !== L.HEAPU8.buffer) { h = L.HEAPU8; v = new DataView(h.buffer); }   /* the wasm memory can grow */
              const X = v.getInt32(pp, true) * sx + ox, Y = v.getInt32(pp + 4, true) * sy + oy;
              if (X < box[0] || X > box[2] || Y < box[1] || Y > box[3]) continue;
              const rb = h[pp + 14], c = x6 ? h[pp + 16] : h[pp + 15] & 31; if (c === 7 || c === 18) continue;
              const rn = x6 ? rb & 15 : rb & 7, nr = x6 ? rb >> 4 : (rb >> 3) & 7;
              if (P.n === P.cap) P = grow(P);
              const k = P.n++; P.x[k] = (X - mx0) * kE; P.z[k] = -(Y - my0) * kN; P.e[k] = v.getInt32(pp + 8, true) * sz + oz; P.c[k] = c;
              P.f[k] = (nr <= 1 || rn >= nr ? 1 : 0) | (nr > 1 && rn === 1 ? 2 : 0);   /* 1: single or last return; 2: the first of several */
            }
          } finally { zr.delete(); L._free(fp); L._free(pp); }
        };
        const q = keys.slice();
        await Promise.all(Array.from({ length: Math.min(6, q.length) }, async () => {
          while (q.length) { const key = q.shift(); const buf = await getPiece(base + 'ept-data/' + key + '.laz', o.signal); if (!o.alive()) throw new Error('stale'); bytes += buf.length; decode(buf); done++; if (o.onProgress) o.onProgress(done, keys.length, bytes); await tick(); }
        }));
        if (!o.alive()) return null;
        const tm = performance.now(), M = model(P, o.half); return Object.assign(M, { resource: res[0], year: res[1] || null, pieces: keys.length, bytes, ms: { fetchDecode: Math.round(tm - t0), model: Math.round(performance.now() - tm) } });
      } catch (e) { if (!o.alive() || (e && e.message === 'stale')) return null; lastErr = e; }
    }
    if (lastErr) throw lastErr;
    return { none: 'the lidar here holds no points for this place' };
  }

  /* the ground model: the lowest ground return in each metre, holes (under buildings, in water) filled from their
     neighbours, then smoothed; and every other point's height above it */
  function model(P, half) {
    const res = 1, nx = Math.ceil(2 * half / res) + 1, N = nx * nx, G = new Float32Array(N).fill(NaN), at = (x, z) => Math.floor((z + half) / res) * nx + Math.floor((x + half) / res);
    let gN = 0;
    for (let i = 0; i < P.n; i++) { if (P.c[i] !== 2) continue; const x = P.x[i], z = P.z[i]; if (x < -half || x > half || z < -half || z > half) continue; const k = at(x, z), e = P.e[i]; if (!(G[k] <= e)) G[k] = e; gN++; }
    if (!gN) { /* no ground classified: the lowest tenth of all points stands in */ const es = Array.from(P.e.subarray(0, P.n)).sort((a, b) => a - b), g0 = es[Math.floor(es.length * 0.05)] || 0; G.fill(g0); }
    let tmp = new Float32Array(N);
    for (let pass = 0, left = 1; pass < 60 && left; pass++) {
      left = 0; tmp.set(G);
      for (let z = 0; z < nx; z++) for (let x = 0; x < nx; x++) { const k = z * nx + x; if (G[k] === G[k]) continue; let s = 0, n = 0;
        for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const xx = x + i, zz = z + j; if (xx < 0 || zz < 0 || xx >= nx || zz >= nx) continue; const v = G[zz * nx + xx]; if (v === v) { s += v; n++; } }
        if (n) tmp[k] = s / n; else left++; }
      G.set(tmp);
    }
    for (let k = 0; k < N; k++) if (G[k] !== G[k]) G[k] = 0;
    for (let z = 1; z < nx - 1; z++) for (let x = 1; x < nx - 1; x++) { let s = 0; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) s += G[(z + j) * nx + x + i]; tmp[z * nx + x] = s / 9; }
    for (let z = 1; z < nx - 1; z++) for (let x = 1; x < nx - 1; x++) G[z * nx + x] = tmp[z * nx + x];
    const ground = (x, z) => { const fx = clampN((x + half) / res, 0, nx - 1.001), fz = clampN((z + half) / res, 0, nx - 1.001), x0 = Math.floor(fx), z0 = Math.floor(fz), tx = fx - x0, tz = fz - z0, k = z0 * nx + x0;
      return (G[k] * (1 - tx) + G[k + 1] * tx) * (1 - tz) + (G[k + nx] * (1 - tx) + G[k + nx + 1] * tx) * tz; };
    /* above ground points only, packed */
    let m = 0; for (let i = 0; i < P.n; i++) if (P.c[i] !== 2) m++;
    const out = { x: new Float32Array(m), z: new Float32Array(m), h: new Float32Array(m), f: new Uint8Array(m) }; let j = 0;
    for (let i = 0; i < P.n; i++) { if (P.c[i] === 2) continue; const hh = P.e[i] - ground(P.x[i], P.z[i]); if (hh < 0.4 || hh > 70) continue; out.x[j] = P.x[i]; out.z[j] = P.z[i]; out.h[j] = hh; out.f[j] = P.f[i]; j++; }
    ['x', 'z', 'h', 'f'].forEach(k => { out[k] = out[k].slice(0, j); });
    return { half, points: P.n, groundPoints: gN, above: out, n: j, ground };
  }
  const clampN = (v, a, b) => Math.max(a, Math.min(b, v));

  window.__SCOUT_LIDAR__ = { load, resourcesAt };
})();
