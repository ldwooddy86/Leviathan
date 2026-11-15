/* ==== rooftop scout: the 3D view traced from 2024-or-newer satellite imagery ==== */
/* No public 3D survey of Dallas Fort Worth is newer than 2018 (USGS lidar; FEMA's footprints there come from 2015 lidar,
   OpenStreetMap's from 2009 photos), so the 3D view is traced from the newest satellite photo Esri serves for the place,
   if it was captured in 2024 or later: Vantor's December 9, 2025 picture over Lakewood, for one. An AI model that finds
   the outline of whatever it is pointed at, SlimSAM (Segment Anything, pruned; Apache-2.0, Chen et al.), runs on this
   computer through ONNX Runtime Web: on the graphics card where WebGPU answers, else on the processor. Its weights (14 to
   40 MB) come from Hugging Face and the runtime from jsDelivr, both once; nothing is sent anywhere.
   For every building on record it is pointed at the old outline: where the roof in the photo still fits that outline, the
   building is confirmed as it stands in the photo; where a roof is there but its outline differs (an addition, a rebuild),
   the building is redrawn from the photo; where no roof shows (under trees), the old outline is kept and says so. Every
   tree crown is traced from the photo on a grid of points, its height estimated from its spread. The photo leans (a
   satellite looks a little sideways, so a roof shows a little off its walls): the lean is measured from the confirmed
   roofs and taken out. window.__SCOUT_TRACE__.trace(opts) returns the buildings, the trees, the photo's date and the lean. */
(function () {
  'use strict';
  const ORT_CDN = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.30.0/dist/';
  const HF = 'https://huggingface.co/Xenova/slimsam-77-uniform/resolve/5850ab45f587c112167512ffef949107115e26a0/onnx/';
  const META = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/identify';
  const S = 1024, MIN_DATE = Date.UTC(2024, 0, 1);
  let M = null, loading = null;

  /* ---------- the model: WebGPU (half precision where the card has it) or the processor (8 bit) ---------- */
  async function fetchModel(name, onBytes) {
    const url = HF + name; let cache = null;
    try { cache = window.caches ? await caches.open('rooftop-scout-ai-v1') : null; } catch (e) { cache = null; }
    if (cache) { try { const hit = await cache.match(url); if (hit) return new Uint8Array(await hit.arrayBuffer()); } catch (e) { /* fetch it */ } }
    const r = await fetch(url, { mode: 'cors', credentials: 'omit' }); if (!r.ok) throw new Error('the AI model did not download (' + r.status + ')');
    const total = +r.headers.get('content-length') || 0, rd = r.body && r.body.getReader ? r.body.getReader() : null;
    let buf;
    if (rd) { const parts = []; let got = 0; for (;;) { const { done, value } = await rd.read(); if (done) break; parts.push(value); got += value.length; if (onBytes) onBytes(got, total); } buf = new Uint8Array(got); let o = 0; parts.forEach(p => { buf.set(p, o); o += p.length; }); }
    else buf = new Uint8Array(await r.arrayBuffer());
    if (cache) { try { await cache.put(url, new Response(buf.slice(0), { headers: { 'content-type': 'application/octet-stream' } })); } catch (e) { /* not kept */ } }
    return buf;
  }
  async function pickBackend() {
    try {
      if (!navigator.gpu || !window.__SCOUT_ORT_GPU__) return { kind: 'wasm' };
      const ad = await navigator.gpu.requestAdapter(); if (!ad) return { kind: 'wasm' };
      return { kind: 'webgpu', f16: !!(ad.features && ad.features.has && ad.features.has('shader-f16')) };
    } catch (e) { return { kind: 'wasm' }; }
  }
  function load(onProgress) {
    if (M) return Promise.resolve(M); if (loading) return loading;
    loading = (async () => {
      let be = await pickBackend(); const tryLoad = async b => {
        const ort = b.kind === 'webgpu' ? window.__SCOUT_ORT_GPU__ : window.__SCOUT_ORT_WASM__; if (!ort) throw new Error('the AI runtime is not in this build');
        ort.env.wasm.wasmPaths = ORT_CDN; ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 1) : 1; ort.env.logLevel = 'error';
        const sfx = b.kind === 'webgpu' ? (b.f16 ? '_fp16' : '') : '_quantized', names = ['vision_encoder' + sfx + '.onnx', 'prompt_encoder_mask_decoder' + sfx + '.onnx'], got = [0, 0];
        const MB = { _quantized: 13.8, _fp16: 20.8, '': 39.8 }[sfx]; let shown = 0;   /* the two files' sizes (Hugging Face does not always say) */
        const bytes = await Promise.all(names.map((n, i) => fetchModel(n, g => { got[i] = g; const now = performance.now(); if (onProgress && now - shown > 400) { shown = now; onProgress(`Downloading the AI model (once): ${((got[0] + got[1]) / 1e6).toFixed(1)} of ${MB} MB`); } })));
        if (onProgress) onProgress('Starting the AI model…');
        const opt = { executionProviders: [b.kind], graphOptimizationLevel: 'all' };
        const enc = await ort.InferenceSession.create(bytes[0], opt), dec = await ort.InferenceSession.create(bytes[1], opt);
        return { ort, enc, dec, backend: b.kind + (b.kind === 'webgpu' ? (b.f16 ? ' fp16' : ' fp32') : ' int8') };
      };
      try { M = await tryLoad(be); }
      catch (e) { if (be.kind !== 'webgpu') throw e; be = { kind: 'wasm' }; M = await tryLoad(be); }   /* a card that fails falls back to the processor */
      return M;
    })().catch(e => { loading = null; throw e; });
    return loading;
  }

  /* ---------- the photo: the newest capture of 2024 or later among the finest zooms ---------- */
  const ZOOM_OF = { '15cm Resolution Metadata': 20, '30cm Resolution Metadata': 19, '60cm Resolution Metadata': 18 };
  const parseDate = v => { if (typeof v === 'number') return v; const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(String(v || '')); return m ? Date.UTC(+m[3], +m[1] - 1, +m[2]) : NaN; };
  async function source(lat, lon) {
    const d = 0.004, q = new URLSearchParams({ geometry: lon.toFixed(6) + ',' + lat.toFixed(6), geometryType: 'esriGeometryPoint', sr: '4326', layers: 'all', tolerance: '1', mapExtent: [lon - d, lat - d, lon + d, lat + d].map(v => v.toFixed(6)).join(','), imageDisplay: '800,800,96', returnGeometry: 'false', f: 'json' });
    const r = await fetch(META + '?' + q, { mode: 'cors', credentials: 'omit' }); if (!r.ok) throw new Error('the imagery dates did not load');
    const j = await r.json(), out = [];
    (j.results || []).forEach(x => { const z = ZOOM_OF[x.layerName]; if (!z) return; const a = x.attributes || {}, t = parseDate(a.SRC_DATE2 || a.SRC_DATE); if (!isFinite(t)) return;
      out.push({ zoom: z, date: t, res: +a.SRC_RES || null, name: String(a.NICE_DESC || a.SRC_DESC || '').trim() || 'satellite', label: new Date(t).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) }); });
    const ok = out.filter(o => o.date >= MIN_DATE).sort((a, b) => b.date - a.date || b.zoom - a.zoom);
    return { best: ok[0] || null, all: out };
  }

  /* ---------- small geometry and raster helpers ---------- */
  const area = P => { let a = 0; for (let i = 0, n = P.length; i < n; i++) { const p = P[i], q = P[(i + 1) % n]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };
  const cen = P => { let x = 0, y = 0; P.forEach(p => { x += p[0]; y += p[1]; }); return [x / P.length, y / P.length]; };
  function inPoly(x, y, P) { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
  function hull(pts) {
    const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]); if (p.length < 3) return p;
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], up = [];
    p.forEach(q => { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); });
    for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
    return lo.slice(0, -1).concat(up.slice(0, -1));
  }
  function minRect(pts) {   /* the smallest rectangle around the points: its angle, sides and area (rotating the hull's edges) */
    const H = hull(pts); let best = null;
    for (let i = 0; i < H.length; i++) { const a = H[i], b = H[(i + 1) % H.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1e-9) continue;
      const ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L; let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      H.forEach(p => { const s = p[0] * ux + p[1] * uy, t = -p[0] * uy + p[1] * ux; if (s < x0) x0 = s; if (s > x1) x1 = s; if (t < y0) y0 = t; if (t > y1) y1 = t; });
      const ar = (x1 - x0) * (y1 - y0); if (!best || ar < best.area) best = { area: ar, ang: Math.atan2(uy, ux), w: x1 - x0, h: y1 - y0, ux, uy, x0, x1, y0, y1 }; }
    return best || { area: 0, ang: 0, w: 0, h: 0, ux: 1, uy: 0, x0: 0, x1: 0, y0: 0, y1: 0 };
  }
  function dp(P, eps) {   /* Douglas-Peucker on a closed ring, split first at the vertex farthest from the start */
    const n = P.length; if (n < 4) return P.slice();
    let fi = 0, far = -1; for (let i = 1; i < n; i++) { const d = Math.hypot(P[i][0] - P[0][0], P[i][1] - P[0][1]); if (d > far) { far = d; fi = i; } }
    const Q = P.concat([P[0]]), keep = new Uint8Array(n + 1), st = [[0, fi], [fi, n]]; keep[0] = keep[fi] = 1;
    while (st.length) { const [s0, e] = st.pop(), A = Q[s0], B = Q[e], dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy); let md = 0, mi = -1;
      for (let i = s0 + 1; i < e; i++) { const d = L > 1e-9 ? Math.abs((Q[i][0] - A[0]) * dy - (Q[i][1] - A[1]) * dx) / L : Math.hypot(Q[i][0] - A[0], Q[i][1] - A[1]); if (d > md) { md = d; mi = i; } }
      if (md > eps && mi > 0) { keep[mi] = 1; st.push([s0, mi], [mi, e]); } }
    const out = []; for (let i = 0; i < n; i++) if (keep[i]) out.push(P[i]); return out;
  }
  /* straighten a traced roof: edges within 20 degrees of the roof's axes are made exactly square to them; two parallel
     edges in a row get the short step between them back */
  function squareUp(P, ang) {
    const c = Math.cos(-ang), s = Math.sin(-ang), R = P.map(p => [p[0] * c - p[1] * s, p[0] * s + p[1] * c]), n = R.length; if (n < 4) return null;
    let L = [];
    for (let i = 0; i < n; i++) { const a = R[i], b = R[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy); if (len < 1e-6) continue; const t = Math.atan2(Math.abs(dy), Math.abs(dx));
      L.push(t < 0.35 ? { k: 'h', v: (a[1] + b[1]) / 2, len, a, b } : t > Math.PI / 2 - 0.35 ? { k: 'v', v: (a[0] + b[0]) / 2, len, a, b } : { k: 'd', len, a, b }); }
    const same = (p, q) => p.k === q.k && p.k !== 'd' && Math.abs(p.v - q.v) < 1.2;
    const M = []; L.forEach(l => { const p = M[M.length - 1]; if (p && same(p, l)) { p.v = (p.v * p.len + l.v * l.len) / (p.len + l.len); p.len += l.len; p.b = l.b; } else M.push(Object.assign({}, l)); });
    if (M.length > 2 && same(M[0], M[M.length - 1])) { const l = M.pop(); M[0].v = (M[0].v * M[0].len + l.v * l.len) / (M[0].len + l.len); M[0].len += l.len; M[0].a = l.a; }
    if (M.length < 4) return null;
    const lineOf = l => l.k === 'h' ? [[0, l.v], [1, l.v]] : l.k === 'v' ? [[l.v, 0], [l.v, 1]] : [l.a, l.b];
    const meet = (A, B) => { const [[x1, y1], [x2, y2]] = lineOf(A), [[x3, y3], [x4, y4]] = lineOf(B), den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4); if (Math.abs(den) < 1e-6) return null; const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den; return [x1 + t * (x2 - x1), y1 + t * (y2 - y1)]; };
    const out = [];
    for (let i = 0; i < M.length; i++) { const A = M[i], B = M[(i + 1) % M.length], j = A.b;
      if (A.k !== 'd' && A.k === B.k) { if (A.k === 'h') out.push([j[0], A.v], [j[0], B.v]); else out.push([A.v, j[1]], [B.v, j[1]]); continue; }
      const p = meet(A, B); out.push(p || j); }
    const ci = Math.cos(ang), si = Math.sin(ang);
    return out.map(p => [p[0] * ci - p[1] * si, p[0] * si + p[1] * ci]);
  }
  function selfCross(P) { const n = P.length, X = (a, b, c, d) => { const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])); return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0; };
    for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) { if (i === 0 && j === n - 1) continue; if (X(P[i], P[(i + 1) % n], P[j], P[(j + 1) % n])) return true; } return false; }

  /* one mask: the 256 x 256 logits for the 1024 picture, upsampled inside the box around the prompt's component */
  function maskAt(lo, px, py) {
    const N = 256, at = (x, y) => lo[Math.min(N - 1, Math.max(0, y)) * N + Math.min(N - 1, Math.max(0, x))];
    let sx = Math.min(N - 1, Math.max(0, Math.round(px / 4 - 0.5))), sy = Math.min(N - 1, Math.max(0, Math.round(py / 4 - 0.5)));
    if (!(at(sx, sy) > 0)) { let best = null; for (let r = 1; r <= 3 && !best; r++) for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (at(sx + i, sy + j) > 0) { best = [sx + i, sy + j]; break; } if (!best) return null; [sx, sy] = best; }
    /* the component on the 256 grid (4-connected), then its box, refined at full resolution */
    const seen = new Uint8Array(N * N), st = [sy * N + sx]; seen[st[0]] = 1; let x0 = sx, x1 = sx, y0 = sy, y1 = sy, n = 0;
    while (st.length) { const k = st.pop(), x = k % N, y = (k - x) / N; n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (x > 0 && !seen[k - 1] && lo[k - 1] > 0) { seen[k - 1] = 1; st.push(k - 1); } if (x < N - 1 && !seen[k + 1] && lo[k + 1] > 0) { seen[k + 1] = 1; st.push(k + 1); }
      if (y > 0 && !seen[k - N] && lo[k - N] > 0) { seen[k - N] = 1; st.push(k - N); } if (y < N - 1 && !seen[k + N] && lo[k + N] > 0) { seen[k + N] = 1; st.push(k + N); } }
    if (n < 2) return null;
    const X0 = Math.max(0, x0 * 4 - 4), Y0 = Math.max(0, y0 * 4 - 4), X1 = Math.min(S - 1, x1 * 4 + 7), Y1 = Math.min(S - 1, y1 * 4 + 7), W = X1 - X0 + 1, H = Y1 - Y0 + 1, m = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) { const fy = (Y0 + y + 0.5) / 4 - 0.5, iy = Math.floor(fy), ty = fy - iy;
      for (let x = 0; x < W; x++) { const fx = (X0 + x + 0.5) / 4 - 0.5, ix = Math.floor(fx), tx = fx - ix;
        const v = (at(ix, iy) * (1 - tx) + at(ix + 1, iy) * tx) * (1 - ty) + (at(ix, iy + 1) * (1 - tx) + at(ix + 1, iy + 1) * tx) * ty;
        if (v > 0 && seen[Math.min(N - 1, Math.max(0, Math.round(fy))) * N + Math.min(N - 1, Math.max(0, Math.round(fx)))]) m[y * W + x] = 1; } }
    /* keep the component holding the prompt */
    const q = [], keep = new Uint8Array(W * H); let qx = Math.min(W - 1, Math.max(0, Math.round(px) - X0)), qy = Math.min(H - 1, Math.max(0, Math.round(py) - Y0));
    if (!m[qy * W + qx]) { let f = -1; for (let r = 1; r < 12 && f < 0; r++) for (let j = -r; j <= r && f < 0; j++) for (let i = -r; i <= r; i++) { const x = qx + i, y = qy + j; if (x >= 0 && y >= 0 && x < W && y < H && m[y * W + x]) { f = y * W + x; break; } } if (f < 0) return null; qx = f % W; qy = (f - qx) / W; }
    q.push(qy * W + qx); keep[q[0]] = 1; let cnt = 0, sx2 = 0, sy2 = 0;
    while (q.length) { const k = q.pop(), x = k % W, y = (k - x) / W; cnt++; sx2 += x; sy2 += y;
      if (x > 0 && !keep[k - 1] && m[k - 1]) { keep[k - 1] = 1; q.push(k - 1); } if (x < W - 1 && !keep[k + 1] && m[k + 1]) { keep[k + 1] = 1; q.push(k + 1); }
      if (y > 0 && !keep[k - W] && m[k - W]) { keep[k - W] = 1; q.push(k - W); } if (y < H - 1 && !keep[k + W] && m[k + W]) { keep[k + W] = 1; q.push(k + W); } }
    return { X0, Y0, W, H, m: keep, n: cnt, cx: X0 + sx2 / cnt, cy: Y0 + sy2 / cnt };
  }
  /* its outline: the boundary pixels traced in order (Moore neighbourhood), in picture pixels */
  function outline(mk) {
    const { W, H, m } = mk, at = (x, y) => x >= 0 && y >= 0 && x < W && y < H && m[y * W + x] === 1;
    let s = -1; for (let k = 0; k < W * H; k++) if (m[k]) { s = k; break; } if (s < 0) return [];
    const sx = s % W, sy = (s - sx) / W, D = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]], out = [];
    let x = sx, y = sy, dir = 6, guard = 0;
    do { out.push([mk.X0 + x + 0.5, mk.Y0 + y + 0.5]); let found = false;
      for (let i = 0; i < 8; i++) { const d = (dir + 6 + i) % 8, nx = x + D[d][0], ny = y + D[d][1]; if (at(nx, ny)) { x = nx; y = ny; dir = d; found = true; break; } }
      if (!found) break; } while ((x !== sx || y !== sy) && ++guard < 40000);
    return out;
  }
  function shapeOf(mk) {
    /* square-edgedness: the share of the simplified outline, by length, within 15 degrees of the outline's own axes
       (roofs 0.7 to 0.95, crowns about a third) */
    const C = outline(mk); if (C.length < 8) return null; const R = minRect(C), Q = dp(C, 1.3); let tot = 0, sq = 0;
    for (let i = 0; i < Q.length; i++) { const a = Q[i], b = Q[(i + 1) % Q.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); let t = Math.atan2(b[1] - a[1], b[0] - a[0]) - R.ang; t = Math.abs(((t + Math.PI / 4) % (Math.PI / 2) + Math.PI / 2) % (Math.PI / 2) - Math.PI / 4); tot += L; if (t < 0.262) sq += L; }
    return { C, R, ortho: tot ? sq / tot : 0, rect: mk.n / Math.max(1, R.area) };
  }
  const iouMask = (mk, P) => { let inter = 0, pa = Math.abs(area(P)); const [x0, y0, x1, y1] = P.reduce((b, p) => [Math.min(b[0], p[0]), Math.min(b[1], p[1]), Math.max(b[2], p[0]), Math.max(b[3], p[1])], [1e9, 1e9, -1e9, -1e9]);
    for (let y = Math.max(mk.Y0, Math.floor(y0)); y <= Math.min(mk.Y0 + mk.H - 1, Math.ceil(y1)); y++) for (let x = Math.max(mk.X0, Math.floor(x0)); x <= Math.min(mk.X0 + mk.W - 1, Math.ceil(x1)); x++) if (mk.m[(y - mk.Y0) * mk.W + x - mk.X0] && inPoly(x + 0.5, y + 0.5, P)) inter++;
    return { iou: inter / Math.max(1, mk.n + pa - inter), cover: inter / Math.max(1, pa) }; };

  /* ---------- the run ---------- */
  async function trace(o) {
    const t0 = performance.now(), say = t => { if (o.onProgress) o.onProgress(t); }, alive = () => !o.alive || o.alive();
    const src = o.source || (await source(o.lat0, o.lon0)).best;
    if (!src) return { none: true };
    const net = await load(say); if (!alive()) return { stale: true };
    /* the picture: 1024 pixels over 2 x half metres around the scene's centre, at about the photo's own resolution */
    say(`Reading the ${src.label} photo…`);
    const half = o.half, mpp = 2 * half / S, z = src.zoom, n = 2 ** z, lat2t = la => (1 - Math.log(Math.tan(la * Math.PI / 180) + 1 / Math.cos(la * Math.PI / 180)) / Math.PI) / 2 * n, lon2t = lo => (lo + 180) / 360 * n;
    const t2lat = y => Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) * 180 / Math.PI, t2lon = x => x / n * 360 - 180;
    const [laN, loW] = o.toLL(-half, -half), [laS, loE] = o.toLL(half, half), tx0 = Math.floor(lon2t(loW)), tx1 = Math.floor(lon2t(loE)), ty0 = Math.floor(lat2t(laN)), ty1 = Math.floor(lat2t(laS));
    const cv = document.createElement('canvas'); cv.width = cv.height = S; const g = cv.getContext('2d', { willReadFrequently: true }); g.fillStyle = '#6f7764'; g.fillRect(0, 0, S, S);
    const toPx = (x, zz) => [(x + half) / mpp, (zz + half) / mpp], fromPx = (px, py) => [px * mpp - half, py * mpp - half];
    const jobs = []; for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) jobs.push(new Promise(res => { const im = new Image(); im.crossOrigin = 'anonymous';
      im.onload = () => { const [xw, zn] = o.toL(t2lat(ty), t2lon(tx)), [xe, zs] = o.toL(t2lat(ty + 1), t2lon(tx + 1)), [a, b] = toPx(xw, zn), [c, d] = toPx(xe, zs); g.drawImage(im, a, b, c - a, d - b); res(1); };
      im.onerror = () => res(0); im.src = o.tileURL(z, tx, ty); }));
    const okTiles = (await Promise.all(jobs)).reduce((s, v) => s + v, 0); if (!alive()) return { stale: true };
    if (okTiles < jobs.length * 0.7) throw new Error('the 2025 photo did not load');
    const px = g.getImageData(0, 0, S, S).data, x = new Float32Array(3 * S * S), MEAN = [0.485, 0.456, 0.406], SD = [0.229, 0.224, 0.225];
    for (let i = 0; i < S * S; i++) for (let c = 0; c < 3; c++) x[c * S * S + i] = (px[i * 4 + c] / 255 - MEAN[c]) / SD[c];
    say('The AI is looking at the photo…');
    const te = performance.now(), E = await net.enc.run({ pixel_values: new net.ort.Tensor('float32', x, [1, 3, S, S]) }), encMs = performance.now() - te; if (!alive()) return { stale: true };
    const emb = E.image_embeddings, pos = E.image_positional_embeddings;
    let decN = 0, decMs = 0;
    async function decode(prompts) {   /* prompts: [{pts: [[x, y]..], lab: [1|0..]}], all with the same number of points */
      const B = prompts.length, k = prompts[0].pts.length, P = new Float32Array(B * k * 2), L = new BigInt64Array(B * k);
      prompts.forEach((p, i) => p.pts.forEach((q, j) => { P[(i * k + j) * 2] = q[0]; P[(i * k + j) * 2 + 1] = q[1]; L[i * k + j] = BigInt(p.lab[j]); }));
      const td = performance.now(), out = await net.dec.run({ input_points: new net.ort.Tensor('float32', P, [1, B, k, 2]), input_labels: new net.ort.Tensor('int64', L, [1, B, k]), image_embeddings: emb, image_positional_embeddings: pos });
      decMs += performance.now() - td; decN += B;
      const iou = out.iou_scores.data, pm = out.pred_masks.data, res = [];
      for (let i = 0; i < B; i++) { const r = []; for (let j = 0; j < 3; j++) r.push({ score: iou[i * 3 + j], lo: pm.subarray((i * 3 + j) * 65536, (i * 3 + j + 1) * 65536) }); res.push(r); }
      return res;
    }
    const stab = lo => { let a = 0, b = 0; for (let i = 0; i < lo.length; i++) { if (lo[i] > 1) a++; if (lo[i] > -1) b++; } return (a + 1) / (b + 1); };
    const m2 = npx => npx * mpp * mpp, inside = p => p[0] > 4 && p[1] > 4 && p[0] < S - 4 && p[1] < S - 4;

    /* the buildings on record, in picture pixels */
    const recs = o.priors.map(b => { const P = b.ring.map(p => toPx(p[0], p[1])), c = cen(P); return { id: b.id, h: b.h || 5, P, c, a: Math.abs(area(P)) }; }).filter(r => inside(r.c) && r.a * mpp * mpp > 12);
    const roofLike = (sh, mk) => sh && sh.ortho > 0.62 && sh.rect > 0.62 && m2(mk.n) > 20 && m2(mk.n) < 3000;
    /* pass 1: one point on each of the largest outlines; roofs that come back about their old size give the photo's lean */
    say(`The AI is checking ${recs.length} buildings against the photo…`);
    const big = recs.slice().sort((a, b) => b.a - a.a).slice(0, 48), anchors = [];
    for (let i = 0; i < big.length; i += 16) { const part = big.slice(i, i + 16), res = await decode(part.map(r => ({ pts: [r.c], lab: [1] }))); if (!alive()) return { stale: true };
      res.forEach((r3, j) => { const r = part[j]; r3.sort((a, b) => b.score - a.score); for (const c of r3) { const mk = maskAt(c.lo, r.c[0], r.c[1]); if (!mk) continue; const sh = shapeOf(mk);
        if (roofLike(sh, mk) && mk.n > 0.5 * r.a && mk.n < 2 * r.a) { anchors.push({ dx: mk.cx - r.c[0], dy: mk.cy - r.c[1], h: r.h, r, mk }); break; } } }); }
    const med = a => { const s = a.slice().sort((p, q) => p - q); return s.length ? s[Math.floor(s.length / 2)] : 0; };
    let shift = [0, 0], hRef = 5, lean = [0, 0];
    if (anchors.length >= 5) { shift = [med(anchors.map(a => a.dx)), med(anchors.map(a => a.dy))]; hRef = Math.max(3, med(anchors.map(a => a.h * 0.75)));
      const mag = Math.hypot(shift[0], shift[1]) * mpp / hRef, cap = Math.min(1, 0.5 / Math.max(1e-6, mag)); lean = [shift[0] * mpp / hRef * cap, shift[1] * mpp / hRef * cap]; }
    const leanPx = h => [lean[0] * h / mpp, lean[1] * h / mpp];
    /* pass 2: every building, pointed at its outline as the photo shows it (shifted by the lean at its roof's height);
       anchors that already fit their leaned outline are confirmed, sheds under 30 square metres keep their record */
    const out = new Map(), roofs = [], dbg = []; let nMatch = 0, nRedraw = 0, nHidden = 0, nSmall = 0;
    anchors.forEach(an => { const r = an.r, [lx, ly] = leanPx(r.h * 0.75), ov = iouMask(an.mk, r.P.map(p => [p[0] + lx, p[1] + ly])); if (ov.iou >= 0.5) { out.set(r.id, { status: 'match', iou: +ov.iou.toFixed(2) }); roofs.push(an.mk); nMatch++; } });
    const todo = recs.filter(r => { if (out.has(r.id)) return false; if (r.a * mpp * mpp < 30) { out.set(r.id, { status: 'small' }); nSmall++; return false; } return true; });
    const prompts = todo.map(r => { const [lx, ly] = leanPx(r.h * 0.75), P = r.P.map(p => [p[0] + lx, p[1] + ly]), c = [r.c[0] + lx, r.c[1] + ly], pos2 = [c];
      const neg = recs.filter(q => q !== r && Math.hypot(q.c[0] - r.c[0], q.c[1] - r.c[1]) * mpp < 30).sort((a, b) => Math.hypot(a.c[0] - r.c[0], a.c[1] - r.c[1]) - Math.hypot(b.c[0] - r.c[0], b.c[1] - r.c[1])).slice(0, 4).map(q => { const [qx, qy] = leanPx(q.h * 0.75); return [q.c[0] + qx, q.c[1] + qy]; });
      const pts = pos2.concat(neg), lab = pos2.map(() => 1).concat(neg.map(() => 0)); while (pts.length < 5) { pts.push(neg.length ? neg[0] : c); lab.push(neg.length ? 0 : 1); }
      return { r, P, c, pts, lab }; });
    const judge = (p, r3, last) => { const r = p.r; let best = null; const why = o.debug ? [] : null;
        r3.forEach(c => { const mk = maskAt(c.lo, p.c[0], p.c[1]); if (!mk) { if (why) why.push('no mask'); return; } const ratio = mk.n / Math.max(1, r.a), sh = shapeOf(mk), ov = iouMask(mk, p.P);
          if (why) why.push([+c.score.toFixed(2), +ratio.toFixed(2), sh ? +sh.ortho.toFixed(2) : null, sh ? +sh.rect.toFixed(2) : null, +ov.cover.toFixed(2), +ov.iou.toFixed(2)].join('/'));
          if (ratio < 0.3 || ratio > 3.2 || !sh) return;
          const pc = cen(p.P), dC = [mk.cx - pc[0], mk.cy - pc[1]], near = Math.hypot(dC[0], dC[1]) * mpp <= 6, ovA = near ? iouMask(mk, p.P.map(q => [q[0] + dC[0], q[1] + dC[1]])) : { iou: 0 };
          /* a match: the roof fits the old outline, or fits it a few metres over (the old survey's error), or is the part of
             it the photo shows (hipped roofs often come back as their sunlit half; trees hide the rest) */
          const prec = ov.cover / Math.max(1e-6, ratio), part = c.score >= 0.75 && ov.cover >= 0.35 && prec >= 0.75;
          const isMatch = ((ov.iou >= 0.5 || (ovA.iou >= 0.55 && ratio > 0.6 && ratio < 1.6)) && c.score >= 0.7) || part, isRedraw = !isMatch && ov.cover >= 0.6 && ratio >= 1.2 && ratio <= 2.2 && c.score >= 0.88 && sh.ortho >= 0.7 && sh.rect >= 0.72 && m2(mk.n) < 3000;
          if (!isMatch && !isRedraw) return; const v = (isMatch ? 2 : 0) + c.score + Math.max(ov.iou, ovA.iou); if (!best || v > best.v) best = { v, mk, sh, ov, score: c.score, isMatch, off: isMatch && ov.iou < 0.5 ? dC.map(d => +(d * mpp).toFixed(1)) : null }; });
        if (why && dbg.length < 400) dbg.push(r.id + ' @' + Math.round(r.c[0]) + ',' + Math.round(r.c[1]) + ' h' + r.h + (last ? ' (fenced) ' : ' ') + why.join('  '));
        if (!best) { if (last) { out.set(r.id, { status: 'hidden' }); nHidden++; } return false; }
        roofs.push(best.mk);
        if (best.isMatch) { out.set(r.id, { status: 'match', iou: +best.ov.iou.toFixed(2), off: best.off }); nMatch++; return true; }
        /* redrawn: the photo's outline, squared up, moved back from roof height to the ground */
        const ratio = best.mk.n / Math.max(1, r.a), h = ratio > 1.5 ? Math.max(r.h, 7.8) : r.h, [lx, ly] = leanPx(h * 0.75);
        let Q = dp(best.sh.C, 0.9 / mpp); const sq = squareUp(Q, best.sh.R.ang); if (sq && !selfCross(sq) && Math.abs(Math.abs(area(sq)) / best.mk.n - 1) < 0.25) Q = sq;
        if (best.sh.rect > 0.86) { const R = best.sh.R, cs = [[R.x0, R.y0], [R.x1, R.y0], [R.x1, R.y1], [R.x0, R.y1]]; Q = cs.map(([s, t]) => [s * R.ux - t * R.uy, s * R.uy + t * R.ux]); }
        const ring = Q.map(q => fromPx(q[0] - lx, q[1] - ly));
        out.set(r.id, { status: 'redrawn', ring, h, grew: +ratio.toFixed(2), iou: +best.ov.iou.toFixed(2) }); nRedraw++; return true; };
    const again = [];
    for (let i = 0; i < prompts.length; i += 16) {
      const part = prompts.slice(i, i + 16), res = await decode(part.map(p => ({ pts: p.pts, lab: p.lab }))); if (!alive()) return { stale: true };
      if (i % 64 === 0) say(`The AI is checking buildings against the photo: ${Math.min(prompts.length, i + 16)} of ${prompts.length}…`);
      res.forEach((r3, j) => { if (!judge(part[j], r3, false)) again.push(part[j]); });
    }
    /* once more for the unsettled, fenced in: points across the old outline, and points just outside each side of it */
    const fenced = again.map(p => { const c = cen(p.P), R = minRect(p.P), off = 3.5 / mpp, v = [-R.uy, R.ux], sm = (R.x0 + R.x1) / 2, tm = (R.y0 + R.y1) / 2, at = (s2, t2) => [s2 * R.ux - t2 * R.uy, s2 * R.uy + t2 * R.ux];
      void v; const inner = [c].concat([[0.35, 0], [-0.35, 0], [0, 0.35], [0, -0.35]].map(([a, b]) => at(sm + a * (R.x1 - R.x0), tm + b * (R.y1 - R.y0))));
      const outer = [at(R.x0 - off, tm), at(R.x1 + off, tm), at(sm, R.y0 - off), at(sm, R.y1 + off)];
      return Object.assign({}, p, { pts: inner.concat(outer), lab: [1, 1, 1, 1, 1, 0, 0, 0, 0] }); });
    for (let i = 0; i < fenced.length; i += 16) {
      const part = fenced.slice(i, i + 16), res = await decode(part.map(p => ({ pts: p.pts, lab: p.lab }))); if (!alive()) return { stale: true };
      res.forEach((r3, j) => judge(part[j], r3, true));
    }
    /* trees: a grid of points away from roofs and roads, nearest the centre first; every crown the AI outlines that is not
       square-edged like a roof, and not already taken, is a tree */
    const roofPix = new Uint8Array(S * S); roofs.forEach(mk => { for (let y = 0; y < mk.H; y++) for (let x = 0; x < mk.W; x++) if (mk.m[y * mk.W + x]) roofPix[(mk.Y0 + y) * S + mk.X0 + x] = 1; });
    const roadPix = new Uint8Array(S * S);
    (o.roads || []).forEach(rd => { const w = (rd.w || 8) / 2 / mpp; for (let i = 0; i + 1 < rd.pts.length; i++) { const a = toPx(rd.pts[i][0], rd.pts[i][1]), b = toPx(rd.pts[i + 1][0], rd.pts[i + 1][1]), L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let s = 0; s <= L; s += 2) { const cx = a[0] + (b[0] - a[0]) * s / (L || 1), cy = a[1] + (b[1] - a[1]) * s / (L || 1); for (let yy = Math.floor(cy - w); yy <= cy + w; yy++) for (let xx = Math.floor(cx - w); xx <= cx + w; xx++) if (xx >= 0 && yy >= 0 && xx < S && yy < S && (xx - cx) ** 2 + (yy - cy) ** 2 <= w * w) roadPix[yy * S + xx] = 1; } } });
    const step = Math.max(14, Math.round((o.treeSpacing || 11) / mpp)), grid = [];
    const texAt = (cx, cy) => { let a = 0, b = 0, n2 = 0; for (let j = -4; j <= 4; j++) for (let i = -4; i <= 4; i++) { const xx = Math.floor(cx) + i, yy = Math.floor(cy) + j; if (xx < 0 || yy < 0 || xx >= S || yy >= S) continue; const k = (yy * S + xx) * 4, Y = 0.299 * px[k] + 0.587 * px[k + 1] + 0.114 * px[k + 2]; a += Y; b += Y * Y; n2++; } const m = a / n2; return Math.sqrt(Math.max(0, b / n2 - m * m)); };
    for (let y = step / 2; y < S; y += step) for (let xx = step / 2; xx < S; xx += step) { const k = Math.floor(y) * S + Math.floor(xx); if (!roofPix[k] && !roadPix[k] && texAt(xx, y) >= (o.treeTex || 9)) grid.push([xx, y]); }
    grid.sort((a, b) => Math.hypot(a[0] - S / 2, a[1] - S / 2) - Math.hypot(b[0] - S / 2, b[1] - S / 2));
    const taken = new Uint8Array(S * S), trees = [], budget = o.treePrompts || (net.backend.startsWith('webgpu') ? 2400 : 700);
    let asked = 0, reachPx = 0;
    for (let i = 0; i < grid.length && asked < budget; ) {
      const part = []; while (part.length < 16 && i < grid.length) { const q = grid[i++]; if (!taken[Math.floor(q[1]) * S + Math.floor(q[0])]) part.push(q); }
      if (!part.length) break; asked += part.length; part.forEach(q => { const d = Math.hypot(q[0] - S / 2, q[1] - S / 2); if (d > reachPx) reachPx = d; });
      const res = await decode(part.map(q => ({ pts: [q], lab: [1] }))); if (!alive()) return { stale: true };
      if (asked % 96 < 16) { say(`The AI is tracing the trees: ${trees.length} so far…`); if (o.onPartial && trees.length) o.onPartial({ trees: trees.slice(), buildings: out, reach: reachPx * mpp, half }); }
      res.forEach((r3, j) => { const q = part[j]; r3.sort((a, b) => b.score - a.score); const c = r3[0]; if (c.score < 0.72 || stab(c.lo) < 0.8) return;
        const mk = maskAt(c.lo, q[0], q[1]); if (!mk) return; const a2 = m2(mk.n); if (a2 < 5 || a2 > 1100) return;
        let onRoof = 0, onRoad = 0, dup = 0, sr = 0, sg = 0, sb = 0, nn = 0;
        for (let y = 0; y < mk.H; y++) for (let xx = 0; xx < mk.W; xx++) { if (!mk.m[y * mk.W + xx]) continue; const k = (mk.Y0 + y) * S + mk.X0 + xx; if (roofPix[k]) onRoof++; if (roadPix[k]) onRoad++; if (taken[k]) dup++; if ((xx + y) % 3 === 0) { sr += px[k * 4]; sg += px[k * 4 + 1]; sb += px[k * 4 + 2]; nn++; } }
        if (onRoof > 0.15 * mk.n || onRoad > 0.5 * mk.n || dup > 0.4 * mk.n) return;
        const sh = shapeOf(mk); if (!sh || sh.ortho > 0.64) return;   /* square edged: a roof, a pool, a court, not a crown */
        const lum = (sr + sg + sb) / (3 * Math.max(1, nn)); if (lum > 190) return;   /* bright concrete or roofing */
        for (let y = 0; y < mk.H; y++) for (let xx = 0; xx < mk.W; xx++) if (mk.m[y * mk.W + xx]) taken[(mk.Y0 + y) * S + mk.X0 + xx] = 1;
        const d = 2 * Math.sqrt(a2 / Math.PI), h = Math.min(24, Math.max(4, 2.5 + 0.95 * d)), [lx, ly] = leanPx(h * 0.7);
        const ring = dp(sh.C, 0.6 / mpp).map(p => fromPx(p[0] - lx, p[1] - ly)), [x0, z0] = fromPx(mk.cx - lx, mk.cy - ly);
        trees.push({ x: x0, z: z0, ring, area: a2, r: d / 2, h, col: nn ? [sr / nn, sg / nn, sb / nn] : [70, 85, 55] }); });
    }
    const done = !grid.some(q => !taken[Math.floor(q[1]) * S + Math.floor(q[0])] && Math.hypot(q[0] - S / 2, q[1] - S / 2) > reachPx + 0.5), reach = done ? half * Math.SQRT2 : reachPx * mpp;
    const ms = Math.round(performance.now() - t0);
    return { source: src, backend: net.backend, half, mpp, lean, reach, anchors: anchors.length, buildings: out, counts: { match: nMatch, redrawn: nRedraw, hidden: nHidden, small: nSmall, trees: trees.length, prompts: decN },
      trees, ms, encMs: Math.round(encMs), decMs: Math.round(decMs), canvas: o.keepCanvas ? cv : null, debug: o.debug ? dbg : undefined };
  }

  window.__SCOUT_TRACE__ = { load, source, trace, get backend() { return M ? M.backend : null; }, _t: { minRect, dp, squareUp, hull, maskAt, outline, shapeOf } };
})();
