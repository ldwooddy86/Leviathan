  /* ==== terrain: the real ground under the Scout Engine ====
     The world used to be flat at y = 0. With this kit the ground, and everything that stands, moves or is pointed at on it,
     takes its height from elevation tiles: the AWS terrarium tiles (zoom 14, 12, 10 and 8, fetched as they are needed and
     decoded in the page: metres = R * 256 + G + B / 256 - 32768), with a small grid of California carried in the page
     (SE.TERRAIN_GRID, about 1.9 km to a post) for the horizon before any tile has arrived and for a page that is offline.

     WHAT THE OTHER KITS MAY USE (all on the shared state S, all synchronous, all safe before any data has arrived):

       S.gy(x, z)          local metres in (x east, z south, as S.toL gives them); the height of the ground there in local y.
                           It is the surface that is drawn: the finest ground mesh built at that place, read from the very
                           triangle a thing would stand on. Where no mesh is built yet it reads the elevation itself; where
                           nothing is known it returns 0. Never NaN. About 0.1 to 0.5 microseconds a call near the camera.
       S.y0                metres above sea level of local y = 0 (the datum). It is set when the world is built round a new
                           origin (every 12 km of travel, on a far jump) and does not change in between.
                           Height above sea level of a local y:  y + S.y0.   Local y of sea level:  -S.y0.
       S.elevAt(lat, lon)  metres above sea level at a place, from the finest elevation loaded (S.y0 where nothing is known).
       S.slopeAt(x, z)     [dy/dx, dy/dz] of the drawn ground at a point (rise per metre east and per metre south).
       S.terr              this kit (below). S.terr.onGround(instanceBuffer) makes an instance buffer put what is added at
                           y = 0 on the ground and tilt it with the slope (cars); S.terr.drape lays a flat shape on the ground.
       en.state()          gains elev (the camera, metres above sea level), agl (the camera above the ground under it),
                           ground (the ground under the camera, above sea level) and terrain (tile counts).

     HOW THE GROUND IS DRAWN. Six levels of square tiles, each a grid of posts: a cell (zoom 18, 8 m posts), zoom 17 (the
     same 8 m posts, so a cell and the tile under it are the same surface), the wider city's squares (zoom 15, 32 m), zoom
     13 (127 m), zoom 10 (500 m) and zoom 7 (4 km, from the carried grid, to the camera's far plane). A tile is cut into
     runs, one for each tile of the next finer level that can lie over it; a run is not drawn while that finer tile is built.
     So the levels never overlap and never fight for depth, and nothing has to be sunk under anything else. Where a fine tile
     meets a coarse one their edges differ by the coarse one's error; every run carries a skirt (a strip hanging from its
     edge) that is drawn along such a border and closes it.

     The datum keeps heights small and keeps every number that means "above the ground" (the haze, the clouds, the eye
     heights) meaning it round the origin. Elevation tiles outlive a change of origin; meshes do not. */
  function TerrainKit(engine, S, H) {
    const dev = engine.device, scene = engine.scene, env = H.env || {}, T = {};
    const LAD = [14, 12, 10, 8], NL = LAD.length;      /* the zooms fetched; index NL means the carried grid */
    /* land below sea level is real only here (south, north, west, east): Death Valley, the Salton trough, the Delta. Anywhere else a height under 0 is sea bed, and the sea is drawn at 0 */
    const INLAND = [[35.5, 37.1, -117.7, -116.2], [32.2, 33.95, -116.45, -114.9], [37.6, 38.45, -121.95, -121.2]];
    const TILES = LAD.map(() => new Map()), NETQ = []; let active = 0, clock = 1, total = 0;
    T.on = env.elevation !== false; T.epoch = 1; T.stats = { ok: 0, err: 0, loading: 0, held: 0, built: 0, grounds: 0, queue: 0 };
    const mercV = la => { const r = la * RAD; return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2; };
    const lonU = lo => (lo + 180) / 360;
    const vLat = v => DEG * Math.atan(Math.sinh(Math.PI * (1 - 2 * v)));

    /* ---------- the grid carried in the page ---------- */
    let GRID = null, gridTried = false;
    function grid() {
      if (gridTried) return GRID; gridTried = true; const G = SE.TERRAIN_GRID; if (!G || !G.d) return null;
      try { const s = atob(G.d), n = G.w * G.h, qv = new Int16Array(n), a = new Float32Array(n); let p = 0, run = 0;
        for (let i = 0; i < n; i++) { const prev = i % G.w ? qv[i - 1] : i ? qv[i - G.w] : 0; if (run) { run--; qv[i] = prev; continue; }
          let u = 0, sh = 0, b; do { b = s.charCodeAt(p++); u |= (b & 127) << sh; sh += 7; } while (b & 128);
          if (u === 0) { run = s.charCodeAt(p++); qv[i] = prev; continue; } qv[i] = prev + ((u >>> 1) ^ -(u & 1)); }
        for (let i = 0; i < n; i++) a[i] = qv[i] * G.q;
        GRID = { a, w: G.w, h: G.h, x0: G.x0, y0: G.y0, s: 256 << G.z }; } catch (e) { GRID = null; }
      return GRID;
    }
    function gridAt(u, v) {
      const G = GRID || grid(); if (!G) return NaN; const fx = u * G.s - G.x0 - 0.5, fy = v * G.s - G.y0 - 0.5; if (!(fx >= 0 && fy >= 0 && fx <= G.w - 1 && fy <= G.h - 1)) return NaN;
      const i = Math.min(G.w - 2, Math.floor(fx)), j = Math.min(G.h - 2, Math.floor(fy)), a = fx - i, b = fy - j, d = G.a, o = j * G.w + i;
      return (d[o] * (1 - a) + d[o + 1] * a) * (1 - b) + (d[o + G.w] * (1 - a) + d[o + G.w + 1] * a) * b;
    }

    /* ---------- elevation tiles: fetched, decoded, kept ---------- */
    let cv2 = null, g2 = null;
    function decode(bmp, z, x, y) {
      if (!cv2) { cv2 = document.createElement('canvas'); cv2.width = cv2.height = 256; g2 = cv2.getContext('2d', { willReadFrequently: true }); }
      g2.globalCompositeOperation = 'copy'; g2.imageSmoothingEnabled = false; g2.drawImage(bmp, 0, 0, 256, 256); if (bmp.close) bmp.close();
      const px = g2.getImageData(0, 0, 256, 256).data, d = new Float32Array(65536), n = 1 << z, lw = x / n * 360 - 180, le = (x + 1) / n * 360 - 180, ln = vLat(y / n), ls = vLat((y + 1) / n);
      const boxes = INLAND.filter(b => b[0] < ln && b[1] > ls && b[2] < le && b[3] > lw), raw = z <= 10 ? new Uint8Array(65536) : null; let bad = 0, sea = 0;
      for (let j = 0, k = 0; j < 256; j++) { const la = boxes.length ? vLat((y + (j + 0.5) / 256) / n) : 0;
        for (let i = 0; i < 256; i++, k++) { let h = px[k * 4] * 256 + px[k * 4 + 1] + px[k * 4 + 2] / 256 - 32768;
          let shore = h <= 3; if (h < 0) { let inl = false; if (boxes.length) { const lo = lw + (le - lw) * (i + 0.5) / 256; for (const b of boxes) if (la >= b[0] && la <= b[1] && lo >= b[2] && lo <= b[3]) { inl = true; break; } } h = inl ? Math.max(h, -95) : 0; if (inl) shore = false; }
          else if (h > 9000) { h = 0; bad++; }
          d[k] = h; if (raw) { raw[k] = shore ? 1 : 0; if (shore) sea++; } } }
      if (bad > 60000) throw new Error('not an elevation tile'); if (z <= 10 && sea < 65536) despike(d, raw, z <= 8 ? 150 : 120, z <= 8 ? 700 : 350); return d;
    }
    /* The coarse tiles (zoom 10 and 8) carry false heights along the coast: single pixels and small knots of them reading
       hundreds or thousands of metres where the land is at sea level (San Diego Bay reads 3,096 m in tile 8/44/103; the fine
       tiles read 0 there). They are where the sea bed and the land were joined. So within three pixels of the sea, a pixel
       that stands more than `over` metres above all but five of the 24 pixels round it is taken for one of them, and is
       given the middle value of its sound neighbours. A real slope from the shore is left alone (the pixels inland of it
       are higher); a real lone crag at the water's edge that fine would be lost at this zoom, and comes back in the finer tiles.
       A few such pixels stand inland too (by lakes: 1,100 m over their surroundings in tile 8/42/96); anywhere, a pixel more than
       `overAny` metres above all but five of its 24 neighbours goes the same way: no real summit is that sharp at these pixel sizes. */
    function despike(d, shore, over, overAny) {
      const near = new Uint8Array(65536), flag = []; let cur = [];
      for (let k = 0; k < 65536; k++) if (shore[k]) cur.push(k);
      for (let ring = 1; ring <= 3; ring++) { const nx = []; for (const k of cur) { const i = k & 255, j = k >> 8; for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { const x = i + a, y = j + b; if (x < 0 || y < 0 || x > 255 || y > 255) continue; const q = y * 256 + x; if (!shore[q] && !near[q]) { near[q] = ring; nx.push(q); } } } cur = nx; }
      const w = [];
      for (let k = 0; k < 65536; k++) { if (shore[k] || d[k] <= over || (!near[k] && d[k] <= overAny)) continue; const i = k & 255, j = k >> 8, lim = d[k] - (near[k] ? over : overAny); let c = 0, n = 0; for (let b = -2; b <= 2; b++) for (let a = -2; a <= 2; a++) { if (!a && !b) continue; const x = i + a, y = j + b; if (x < 0 || y < 0 || x > 255 || y > 255) continue; n++; if (d[y * 256 + x] >= lim) c++; } if (c < Math.min(6, n)) flag.push(k); }
      if (!flag.length) return 0; const isF = new Uint8Array(65536); for (const k of flag) isF[k] = 1;
      for (const k of flag) { const i = k & 255, j = k >> 8; w.length = 0; for (let b = -2; b <= 2; b++) for (let a = -2; a <= 2; a++) { const x = i + a, y = j + b; if (x < 0 || y < 0 || x > 255 || y > 255) continue; const q = y * 256 + x; if (!isF[q]) w.push(d[q]); } w.sort((p, q) => p - q); d[k] = w.length ? w[w.length >> 1] : 0; }
      return flag.length;
    }
    async function load(t) {
      const z = LAD[t.li], url = env.elevURL ? env.elevURL(z, t.x, t.y) : 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/' + z + '/' + t.x + '/' + t.y + '.png';
      const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null, tm = setTimeout(() => { if (ctl) ctl.abort(); }, 60000);
      try { const r = await fetch(url, { mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer', signal: ctl ? ctl.signal : undefined }); if (!r.ok) throw new Error('HTTP ' + r.status);
        const b = await r.blob(); let bmp; try { bmp = await createImageBitmap(b, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' }); } catch (e) { bmp = await createImageBitmap(b); }
        return decode(bmp, z, t.x, t.y); } finally { clearTimeout(tm); }
    }
    let tellT = 0; const tellSoon = () => { if (tellT) return; tellT = setTimeout(() => { tellT = 0; stale(); if (H.onData) H.onData(); }, 90); };
    function pumpNet() {
      while (active < 6 && NETQ.length) { const t = NETQ.shift(); if (t.st !== 'load' || t.going) continue; active++; t.going = true;
        load(t).then(d => { active--; t.going = false; t.d = d; t.st = 'ok'; T.stats.ok++; T.epoch++; trim(); tellSoon(); pumpNet(); },
          e => { active--; t.going = false; t.st = 'err'; t.at = performance.now(); t.tries++; t.why = String((e && e.message) || e).slice(0, 80); T.stats.err++; tellSoon(); pumpNet(); }); }
    }
    function request(li, x, y) {
      const n = 1 << LAD[li]; if (!T.on || x < 0 || y < 0 || x >= n || y >= n) return null; const k = x * 65536 + y; let t = TILES[li].get(k); if (t) { t.used = clock; if (t.st === 'err' && performance.now() - t.at > Math.min(30000, 4000 * Math.pow(2, t.tries))) { t.st = 'load'; t.at = performance.now(); NETQ.push(t); pumpNet(); } return t; }   /* a tile that failed is asked for again after 8 and 16 seconds, then every 30, for as long as something wants it */
      t = { li, x, y, st: 'load', d: null, at: performance.now(), tries: 0, used: clock, going: false }; TILES[li].set(k, t); total++; NETQ.push(t); pumpNet(); return t;
    }
    /* no more than 72 tiles are held (about 19 MB): the ones longest unread go first */
    function trim() { if (total <= 72) return; const all = []; TILES.forEach(m => m.forEach((t, k) => { if (t.st !== 'load') all.push([t, k]); })); all.sort((a, b) => a[0].used - b[0].used); for (let i = 0; i < all.length && total > 60; i++) { TILES[all[i][0].li].delete(all[i][1]); total--; } }
    /* metres above sea level at (u, v) (the map's 0 to 1), from the finest tile loaded at ladder index li0 or coarser, else the carried grid; NaN where nothing is known */
    function sample(u, v, li0) {
      for (let li = li0; li < NL; li++) { const n = 256 << LAD[li], fx = u * n, fy = v * n, tx = fx >> 8, ty = fy >> 8, t = TILES[li].get(tx * 65536 + ty); if (!t || !t.d) continue; t.used = clock;
        const px = fx - 0.5, py = fy - 0.5, i0 = Math.floor(px), j0 = Math.floor(py), a = px - i0, b = py - j0, bx = tx << 8, by = ty << 8, li2 = i0 - bx, lj2 = j0 - by, d = t.d;
        if (li2 >= 0 && lj2 >= 0 && li2 < 255 && lj2 < 255) { const o = lj2 * 256 + li2; return (d[o] * (1 - a) + d[o + 1] * a) * (1 - b) + (d[o + 256] * (1 - a) + d[o + 257] * a) * b; }
        const M2 = TILES[li], P = (i, j) => { const ti = i >> 8, tj = j >> 8; if (ti === tx && tj === ty) return d[(j - by) * 256 + i - bx]; const nb = M2.get(ti * 65536 + tj); if (nb && nb.d) return nb.d[(j - (tj << 8)) * 256 + i - (ti << 8)]; return d[clamp(j - by, 0, 255) * 256 + clamp(i - bx, 0, 255)]; };
        return (P(i0, j0) * (1 - a) + P(i0 + 1, j0) * a) * (1 - b) + (P(i0, j0 + 1) * (1 - a) + P(i0 + 1, j0 + 1) * a) * b; }
      return gridAt(u, v);
    }
    /* the tiles a rectangle of local metres reads at one ladder index (a little more than the rectangle: a post's slope looks one post beyond it) */
    function span(r, li, f) { const ex = (r.x1 - r.x0) * 0.07, ez = (r.zS - r.zN) * 0.07, a = H.toLL(r.x0 - ex, r.zN - ez), b = H.toLL(r.x1 + ex, r.zS + ez), n = 1 << LAD[li], x0 = Math.floor(lonU(a[1]) * n), x1 = Math.floor(lonU(b[1]) * n), y0 = Math.floor(mercV(a[0]) * n), y1 = Math.floor(mercV(b[0]) * n);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) f(x, y); }
    /* which elevation a rectangle would be built from now: a number that changes when better has arrived */
    function verOf(r, li0) { let ver = 0; for (let li = li0; li < NL; li++) { let got = 0, all = 0; span(r, li, (x, y) => { all++; const t = TILES[li].get(x * 65536 + y); if (t && t.d) got++; }); ver = ver * 64 + Math.min(got, 62) + 1; if (got === all) return ver * 16 + li; } return ver * 16 + 9; }
    /* ask for a rectangle's tiles; how many are still on their way */
    function want(r, li) { if (li >= NL || !T.on) return 0; let pend = 0; span(r, li, (x, y) => { const t = request(li, x, y); if (t && t.st === 'load') pend++; }); return pend; }
    T.want = want; T.verOf = verOf;
    /* is a rectangle's finest elevation still on its way (and not for long: a tile that has not come in 6 seconds is not waited for) */
    T.waiting = r => { if (!T.on) return false; let w = false; const now = performance.now(); span(r, 0, (x, y) => { const t = request(0, x, y); if (t && t.st === 'load' && now - t.at < 6000) w = true; }); return w; };
    T.elev = (lat, lon, li) => sample(lonU(lon), mercV(lat), li || 0);
    /* every zoom's tile at a place, asked for now; resolves when they have come (or failed, or 5 seconds have passed) */
    T.prime = (lat, lon) => { if (!T.on) return Promise.resolve(false); const u = lonU(lon), v = mercV(lat), ts = []; for (let li = 0; li < NL; li++) { const n = 1 << LAD[li]; ts.push(request(li, Math.floor(u * n), Math.floor(v * n))); }
      return new Promise(res => { const t0 = performance.now(), tick = () => { if (ts.every(t => !t || t.st !== 'load') || performance.now() - t0 > 5000) res(true); else setTimeout(tick, 60); }; tick(); }); };
    /* the best height known at a place now, for a datum (0 where nothing is known) */
    T.datum = (lat, lon) => { const h = sample(lonU(lon), mercV(lat), 0); return h === h ? Math.round(h) : 0; };

    /* ---------- a grid of posts over a rectangle ---------- */
    /* r: the rectangle; m: quads a side; li: the finest ladder index it may read. h: (m + 1) squared heights in local y, row by row from the north-west corner; n: the ground's normal at each. The slopes are taken from the heights one post beyond the edge too, so two grids that share an edge agree along it. */
    function makeKid(r, m, li) {
      const m1 = m + 1, m3 = m + 3, hh = new Float32Array(m3 * m3), us = new Float64Array(m3), vs = new Float64Array(m3), y0 = S.y0 || 0, dx = (r.x1 - r.x0) / m, dz = (r.zS - r.zN) / m;
      for (let i = 0; i < m3; i++) { const k = i - 1, ll = H.toLL(k === m ? r.x1 : r.x0 + dx * k, k === m ? r.zS : r.zN + dz * k); us[i] = lonU(ll[1]); vs[i] = mercV(ll[0]); }
      for (let j = 0, o = 0; j < m3; j++) for (let i = 0; i < m3; i++, o++) { const h = sample(us[i], vs[j], li); hh[o] = h === h ? h - y0 : 0; }
      const h = new Float32Array(m1 * m1), n = new Float32Array(m1 * m1 * 3); let lo = Infinity, hi = -Infinity;
      for (let j = 0, k = 0; j < m1; j++) for (let i = 0; i < m1; i++, k++) { const o = (j + 1) * m3 + i + 1, v = hh[o]; h[k] = v; if (v < lo) lo = v; if (v > hi) hi = v;
        const sx = (hh[o + 1] - hh[o - 1]) / (2 * dx), sz = (hh[o + m3] - hh[o - m3]) / (2 * dz), l = Math.hypot(sx, 1, sz); n[k * 3] = -sx / l; n[k * 3 + 1] = 1 / l; n[k * 3 + 2] = -sz / l; }
      return { r, m, h, n, lo, hi };
    }
    /* the height in a grid at a point: on the triangle that is drawn there (each quad is cut from its north-east corner to its south-west) */
    function interp(k, x, z) {
      const r = k.r, m = k.m, u = clamp((x - r.x0) / (r.x1 - r.x0), 0, 1) * m, v = clamp((z - r.zN) / (r.zS - r.zN), 0, 1) * m, i = Math.min(m - 1, Math.floor(u)), j = Math.min(m - 1, Math.floor(v)), fu = u - i, fv = v - j, o = j * (m + 1) + i, h = k.h;
      return fu + fv <= 1 ? h[o] + fu * (h[o + 1] - h[o]) + fv * (h[o + m + 1] - h[o]) : h[o + m + 2] + (1 - fu) * (h[o + m + 1] - h[o + m + 2]) + (1 - fv) * (h[o + 1] - h[o + m + 2]);
    }
    function slope(k, x, z) {
      const r = k.r, m = k.m, dx = (r.x1 - r.x0) / m, dz = (r.zS - r.zN) / m, u = clamp((x - r.x0) / (r.x1 - r.x0), 0, 1) * m, v = clamp((z - r.zN) / (r.zS - r.zN), 0, 1) * m, i = Math.min(m - 1, Math.floor(u)), j = Math.min(m - 1, Math.floor(v)), o = j * (m + 1) + i, h = k.h;
      return u - i + v - j <= 1 ? [(h[o + 1] - h[o]) / dx, (h[o + m + 1] - h[o]) / dz] : [(h[o + m + 2] - h[o + m + 1]) / dx, (h[o + m + 2] - h[o + 1]) / dz];
    }
    /* the 8 m lattice: one grid of 16 by 16 quads to a cell (zoom 18), kept and shared by the cell's ground, the zoom 17 tile under it, the streets laid on it and S.gy */
    const LAT = new Map();
    T.block = (X, Y) => { const key = X * 4194304 + Y; let b = LAT.get(key); if (b && b.ep === T.epoch) return b; const r = H.rectOf(X, Y), ver = verOf(r, 0); if (b && b.ver === ver) { b.ep = T.epoch; return b; }
      b = makeKid(r, 16, 0); b.ver = ver; b.ep = T.epoch; LAT.delete(key); LAT.set(key, b); if (LAT.size > 1400) { let n = 0; for (const k of LAT.keys()) { LAT.delete(k); if (++n >= 300) break; } } return b; };
    const cellXY = (x, z) => { const ll = H.toLL(x, z); return [Math.floor(lonU(ll[1]) * 262144), Math.floor(mercV(ll[0]) * 262144)]; };

    /* ---------- the ground meshes ---------- */
    /* C: child tiles a side; m: quads a side in each; li: the elevation it reads; kz: the zoom of the tiles that can lie over it; skirt: how far its skirts hang (0: down to below the lowest land) */
    const LV = { 18: { C: 1, m: 16, li: 0, kz: 18, skirt: 6 }, 17: { C: 2, m: 16, li: 0, kz: 18, skirt: 16 }, 15: { C: 4, m: 8, li: 1, kz: 17, skirt: 50 }, 13: { C: 4, m: 8, li: 2, kz: 15, skirt: 180 }, 10: { C: 8, m: 8, li: 3, kz: 13, skirt: 600 }, 7: { C: 8, m: 8, li: NL, kz: 10, skirt: 0 } };
    const ZS = [18, 17, 15, 13, 10, 7], REG = new Map(), BQ = [], gkey = (z, X, Y) => z * 17592186044416 + X * 4194304 + Y; let regGen = 1, coverDirty = false, bqDirty = false;
    T.levels = LV; T.reg = REG;
    /* a tile of ground: made now, built when its turn comes (T.pump) or at once (T.ensure). o: { parent, mat, shadow } */
    T.ground = (z, X, Y, o) => {
      const L = LV[z], g = { z, X, Y, key: gkey(z, X, Y), L, m: z === 10 && engine.quality === 'low' ? 4 : L.m, r: H.rectOf(X, Y, z), kids: null, e: null, mr: null, mesh: null, v: 0, ver: -1, built: false, queued: true, dead: false, parent: o.parent, mat: o.mat, shadow: !!o.shadow, name: 'Ground ' + z + '/' + X + '/' + Y };
      const old = REG.get(g.key); if (old) T.drop(old); REG.set(g.key, g); want(g.r, L.li); BQ.push(g); bqDirty = true; T.stats.grounds = REG.size; return g;
    };
    T.drop = g => { if (!g || g.dead) return; g.dead = true; if (REG.get(g.key) === g) REG.delete(g.key); if (g.e && !g.e.destroyed) g.e.destroy(); if (g.mesh) g.mesh.dispose(); g.mesh = null; g.e = null; g.kids = null; g.built = false; regGen++; coverDirty = true; T.stats.grounds = REG.size; };
    function build(g) {
      const L = g.L, C = L.C, m = g.m, m1 = m + 1, R0 = g.r, kids = [], nk = C * C, vk = m1 * m1 + 4 * m, P = new Float32Array(nk * vk * 3), Nn = new Float32Array(nk * vk * 3), U = new Float32Array(nk * vk * 2), ik = m * m * 6 + 4 * m * 6, I = new Uint16Array(nk * ik), cl = [];
      const wx = R0.x1 - R0.x0, wz = R0.zS - R0.zN, deep = -(S.y0 || 0) - 140;
      for (let cy = 0, kn = 0; cy < C; cy++) for (let cx = 0; cx < C; cx++, kn++) {
        const k = L.li === 0 ? T.block(g.X * C + cx, g.Y * C + cy) : makeKid(z7rect(g, cx, cy), m, L.li), r = k.r, v0 = kn * vk, dx = (r.x1 - r.x0) / m, dz = (r.zS - r.zN) / m; kids.push(k);
        for (let j = 0, q = 0; j < m1; j++) for (let i = 0; i < m1; i++, q++) { const o = (v0 + q) * 3, x = i === m ? r.x1 : r.x0 + dx * i, z = j === m ? r.zS : r.zN + dz * j; P[o] = x; P[o + 1] = k.h[q]; P[o + 2] = z; Nn[o] = k.n[q * 3]; Nn[o + 1] = k.n[q * 3 + 1]; Nn[o + 2] = k.n[q * 3 + 2]; U[(v0 + q) * 2] = (x - R0.x0) / wx; U[(v0 + q) * 2 + 1] = (z - R0.zN) / wz; }
        let ii = kn * ik; const i0 = ii;
        for (let j = 0; j < m; j++) for (let i = 0; i < m; i++) { const a = v0 + j * m1 + i, b = a + 1, c = a + m1, d = c + 1; I[ii++] = a; I[ii++] = c; I[ii++] = b; I[ii++] = b; I[ii++] = c; I[ii++] = d; }
        /* the skirt: the edge's posts again, lower; walked clockwise as seen from above, so its faces look outward */
        const ring = []; for (let i = 0; i < m; i++) ring.push(i); for (let j = 0; j < m; j++) ring.push(j * m1 + m); for (let i = m; i > 0; i--) ring.push(m * m1 + i); for (let j = m; j > 0; j--) ring.push(j * m1);
        const s0 = v0 + m1 * m1; for (let q = 0; q < 4 * m; q++) { const src = (v0 + ring[q]) * 3, o = (s0 + q) * 3; P[o] = P[src]; P[o + 1] = L.skirt ? P[src + 1] - L.skirt : Math.min(deep, P[src + 1] - 600); P[o + 2] = P[src + 2]; Nn[o] = Nn[src]; Nn[o + 1] = Nn[src + 1]; Nn[o + 2] = Nn[src + 2]; U[(s0 + q) * 2] = U[(v0 + ring[q]) * 2]; U[(s0 + q) * 2 + 1] = U[(v0 + ring[q]) * 2 + 1]; }
        const i1 = ii; for (let q = 0; q < 4 * m; q++) { const q2 = (q + 1) % (4 * m), p = v0 + ring[q], pn = v0 + ring[q2], lo = s0 + q, ln = s0 + q2; I[ii++] = p; I[ii++] = pn; I[ii++] = ln; I[ii++] = p; I[ii++] = ln; I[ii++] = lo; }
        const c = [(r.x0 + r.x1) / 2, (k.lo + k.hi) / 2, (r.zN + r.zS) / 2], rad = Math.hypot(r.x1 - r.x0, k.hi - k.lo, r.zS - r.zN) / 2 + 0.5, sk = L.skirt || (k.hi - deep + 600);
        cl.push({ start: i0 * 2, count: i1 - i0, c, r: rad, axis: [0, 1, 0], cone: 0, hidden: false }, { start: i1 * 2, count: ii - i1, c: [c[0], c[1] - sk / 2, c[2]], r: rad + sk / 2, axis: [0, 1, 0], cone: 0, hidden: C > 1 });
      }
      const mesh = new Mesh(dev, { name: g.name, positions: P, normals: Nn, uvs: U, indices: I }); mesh.clusters = cl; mesh.maskable = true;
      if (!g.e || g.e.destroyed) { g.e = scene.createEntity(g.name, { parent: g.parent, transient: true }); g.mr = g.e.add('MeshRenderer'); g.mr.material = g.mat; g.mr.castShadow = g.shadow; g.mr.pickable = false; }
      const old = g.mesh; g.mr.mesh = mesh; g.mesh = mesh; if (old) old.dispose(); g.kids = kids; g.built = true; g.queued = false; g.v++; g.ver = verOf(g.r, L.li); g.hid = null; regGen++; coverDirty = true; T.stats.built++;
    }
    const z7rect = (g, cx, cy) => H.rectOf(g.X * g.L.C + cx, g.Y * g.L.C + cy, g.L.kz);
    /* build a tile now if it is not built, or was built from less than is known now. Returns true if it built */
    T.ensure = g => { if (!g || g.dead) return false; if (g.built && g.ver === verOf(g.r, g.L.li)) return false; build(g); if (H.onGround) H.onGround(g); return true; };
    /* better elevation has arrived: every tile built from less goes back in the queue */
    function stale() { REG.forEach(g => { if (g.built && !g.queued && g.ver !== verOf(g.r, g.L.li)) { g.queued = true; BQ.push(g); bqDirty = true; } }); }
    /* a run is not drawn while the finer tile over it is built; a run's skirt is drawn where it borders a run that is not, and along the tile's own edge */
    function cover() {
      coverDirty = false;
      REG.forEach(g => { if (!g.built || g.L.C < 2) return; const L = g.L, C = L.C, cl = g.mesh.clusters, hid = g.hid || (g.hid = new Uint8Array(C * C));
        for (let cy = 0, k = 0; cy < C; cy++) for (let cx = 0; cx < C; cx++, k++) { const f = REG.get(gkey(L.kz, g.X * C + cx, g.Y * C + cy)); hid[k] = f && f.built ? 1 : 0; }
        for (let cy = 0, k = 0; cy < C; cy++) for (let cx = 0; cx < C; cx++, k++) { const h = hid[k], edge = cx === 0 || cy === 0 || cx === C - 1 || cy === C - 1 || hid[k - 1] || hid[k + 1] || hid[k - C] || hid[k + C]; cl[k * 2].hidden = !!h; cl[k * 2 + 1].hidden = !!h || !edge; } });
    }
    /* each frame: build what waits, the nearest first and the coarse before the fine, for up to ms milliseconds */
    T.pump = (ms, cx, cz) => {
      clock++; T.stats.queue = BQ.length; let did = false;
      if (BQ.length) { const t0 = performance.now();
        if (bqDirty) { bqDirty = false; for (const g of BQ) { const r = g.r; g.pr = Math.max(0, Math.hypot((r.x0 + r.x1) / 2 - cx, (r.zN + r.zS) / 2 - cz) - (r.x1 - r.x0) * 0.75) + g.z * 0.01; } BQ.sort((a, b) => b.pr - a.pr); }
        while (BQ.length && performance.now() - t0 < ms) { const g = BQ.pop(); if (g.dead) continue; g.queued = false; if (g.built && g.ver === verOf(g.r, g.L.li)) continue; build(g); did = true; if (H.onGround) H.onGround(g); } }
      if (coverDirty) { cover(); did = true; } T.stats.loading = NETQ.length + active; T.stats.held = total; return did || BQ.length > 0;
    };
    T.resort = () => { bqDirty = true; };
    /* every few seconds the ground that exists asks for its elevation again: that is what brings back a tile that failed */
    setInterval(() => { if (!T.on || !engine.running || !T.stats.err) return; let any = false; TILES.forEach(m => m.forEach(t => { if (t.st === 'err') any = true; })); if (any) REG.forEach(g => { if (!g.dead) want(g.r, g.L.li); }); }, 4000);

    /* ---------- the height of the drawn ground ---------- */
    let gk = null, gkGen = -1;
    function kidAt(x, z) {
      if (gk && gkGen === regGen) { const r = gk.r; if (x >= r.x0 && x <= r.x1 && z >= r.zN && z <= r.zS) return gk; }
      const ll = H.toLL(x, z), X = Math.floor(lonU(ll[1]) * 262144), Y = Math.floor(mercV(ll[0]) * 262144);
      for (let q = 0; q < 6; q++) { const zz = ZS[q], sh = 18 - zz, g = REG.get(gkey(zz, X >> sh, Y >> sh)); if (!g || !g.built) continue; const L = g.L, ks = 18 - L.kz, k = g.kids[((Y >> ks) - g.Y * L.C) * L.C + (X >> ks) - g.X * L.C]; if (!k) continue; if (L.li === 0) { gk = k; gkGen = regGen; } else gk = null; return k; }   /* only a grid of the finest lattice is remembered for the next call: a coarse one's rectangle also holds places where finer ground is drawn */
      gk = null; return null;
    }
    T.gy = (x, z) => { const k = kidAt(x, z); if (k) return interp(k, x, z); const ll = H.toLL(x, z), h = sample(lonU(ll[1]), mercV(ll[0]), 0); return h === h ? h - (S.y0 || 0) : 0; };
    T.slope = (x, z) => { const k = kidAt(x, z); if (k) return slope(k, x, z); const e = 6, g = T.gy; return [(g(x + e, z) - g(x - e, z)) / (2 * e), (g(x, z + e) - g(x, z - e)) / (2 * e)]; };
    /* the 8 m lattice's height at a point, whatever is drawn there: what the streets are laid on */
    let lb = null; const blockAt = (x, z) => { if (lb && lb.ep === T.epoch) { const r = lb.r; if (x >= r.x0 && x <= r.x1 && z >= r.zN && z <= r.zS) return lb; } const c = cellXY(x, z); lb = T.block(c[0], c[1]); return lb; };
    T.gyL = (x, z) => interp(blockAt(x, z), x, z);

    /* ---------- laying flat things on the ground ---------- */
    const clipHP = (P, a, b, c) => { const o = []; for (let i = 0, n = P.length; i < n; i++) { const p = P[i], q = P[(i + 1) % n], dp = a * p[0] + b * p[1] + c, dq = a * q[0] + b * q[1] + c; if (dp <= 0) o.push(p); if ((dp < 0 && dq > 0) || (dp > 0 && dq < 0)) { const t = dp / (dp - dq); o.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); } } return o; };
    /* A convex shape in plan ([[x, z], ...]) laid on the ground, lift metres above it: the shape is cut by the triangles of the 8 m lattice, so every piece lies in the plane of the ground under it and a lift of a few centimetres is enough everywhere.
       emit(points, normal): points [[x, y, z], ...] of one convex piece, and the ground's normal there */
    /* Only what is within T.fineR metres of the place the streets were last built round (T.center) is cut to the triangles: a street
       map can run to 150 km of line, and cut that way it is three quarters of a million triangles. Farther off a shape is laid
       whole, each corner on the drawn ground and 22 cm higher, which at that distance is not seen. */
    let fineC = null; const UPV = [0, 1, 0]; T.fineR = 360; T.center = (x, z) => { fineC = [x, z]; };
    const farOff = (x, z) => !!fineC && Math.hypot(x - fineC[0], z - fineC[1]) > T.fineR;
    T.drape = (P, lift, emit) => {
      { let sx = 0, sz = 0; for (const p of P) { sx += p[0]; sz += p[1]; } if (farOff(sx / P.length, sz / P.length)) { emit(P.map(p => [p[0], T.gy(p[0], p[1]) + lift + 0.22, p[1]]), UPV); return; } }
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; for (const p of P) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < z0) z0 = p[1]; if (p[1] > z1) z1 = p[1]; }
      if (!(x1 - x0 < 400 && z1 - z0 < 400)) return; const ca = cellXY(x0, z0), cb = cellXY(x1, z1);
      for (let Y = ca[1]; Y <= cb[1]; Y++) for (let X = ca[0]; X <= cb[0]; X++) {
        const k = T.block(X, Y), r = k.r, h = k.h; let Q0 = P; if (x0 < r.x0) Q0 = clipHP(Q0, -1, 0, r.x0); if (x1 > r.x1) Q0 = clipHP(Q0, 1, 0, -r.x1); if (z0 < r.zN) Q0 = clipHP(Q0, 0, -1, r.zN); if (z1 > r.zS) Q0 = clipHP(Q0, 0, 1, -r.zS); if (Q0.length < 3) continue;
        let qx0 = Infinity, qx1 = -Infinity, qz0 = Infinity, qz1 = -Infinity; for (const p of Q0) { if (p[0] < qx0) qx0 = p[0]; if (p[0] > qx1) qx1 = p[0]; if (p[1] < qz0) qz0 = p[1]; if (p[1] > qz1) qz1 = p[1]; }
        const dx = (r.x1 - r.x0) / 16, dz = (r.zS - r.zN) / 16, i0 = clamp(Math.floor((qx0 - r.x0) / dx), 0, 15), i1 = clamp(Math.floor((qx1 - r.x0) / dx), 0, 15), j0 = clamp(Math.floor((qz0 - r.zN) / dz), 0, 15), j1 = clamp(Math.floor((qz1 - r.zN) / dz), 0, 15);
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
          const xa = r.x0 + dx * i, xb = i === 15 ? r.x1 : r.x0 + dx * (i + 1), za = r.zN + dz * j, zb = j === 15 ? r.zS : r.zN + dz * (j + 1); let Q1 = Q0;
          if (qx0 < xa) Q1 = clipHP(Q1, -1, 0, xa); if (qx1 > xb) Q1 = clipHP(Q1, 1, 0, -xb); if (qz0 < za) Q1 = clipHP(Q1, 0, -1, za); if (qz1 > zb) Q1 = clipHP(Q1, 0, 1, -zb); if (Q1.length < 3) continue;
          const o = j * 17 + i, ha = h[o], hb = h[o + 1], hc = h[o + 17], hd = h[o + 18], A = 1 / dx, B = 1 / dz, Cc = -xa / dx - za / dz - 1;
          const P1 = clipHP(Q1, A, B, Cc); if (P1.length >= 3) { const sx = (hb - ha) / dx, sz = (hc - ha) / dz, l = Math.hypot(sx, 1, sz); emit(P1.map(p => [p[0], ha + (p[0] - xa) * sx + (p[1] - za) * sz + lift, p[1]]), [-sx / l, 1 / l, -sz / l]); }
          const P2 = clipHP(Q1, -A, -B, -Cc); if (P2.length >= 3) { const sx = (hd - hc) / dx, sz = (hd - hb) / dz, l = Math.hypot(sx, 1, sz); emit(P2.map(p => [p[0], hd + (p[0] - xb) * sx + (p[1] - zb) * sz + lift, p[1]]), [-sx / l, 1 / l, -sz / l]); }
        } }
    };
    /* a triangle of a mesh builder, laid on the ground. a, b, c: [x, anything, z]; uv(point) gives a piece's corner its uv, or is null */
    T.drapeTri = (Bd, a, b, c, lift, uv, col, ax) => T.drape([[a[0], a[2]], [b[0], b[2]], [c[0], c[2]]], lift, (pts, n) => { for (let i = 1; i + 1 < pts.length; i++) Bd.tri(pts[0], pts[i], pts[i + 1], n, uv ? uv(pts[0]) : null, uv ? uv(pts[i]) : null, uv ? uv(pts[i + 1]) : null, col, ax, ax, ax); });
    /* a convex shape in plan ([[x, z], ...]) of a mesh builder, laid on the ground */
    T.drapePoly = (Bd, P, lift, uv, col, ax) => T.drape(P, lift, (pts, n) => { for (let i = 1; i + 1 < pts.length; i++) Bd.tri(pts[0], pts[i], pts[i + 1], n, uv ? uv(pts[0]) : null, uv ? uv(pts[i]) : null, uv ? uv(pts[i + 1]) : null, col, ax, ax, ax); });
    /* a quad: laid as one shape when it is convex (it nearly always is), as its two triangles when it is not */
    T.drapeQuad = (Bd, a, b, c, d, lift, uv, col, ax) => { const P = [[a[0], a[2]], [b[0], b[2]], [c[0], c[2]], [d[0], d[2]]]; let pos = 0, neg = 0; for (let i = 0; i < 4; i++) { const p = P[i], q = P[(i + 1) % 4], r = P[(i + 2) % 4], cr = (q[0] - p[0]) * (r[1] - q[1]) - (q[1] - p[1]) * (r[0] - q[0]); if (cr > 1e-9) pos++; else if (cr < -1e-9) neg++; }
      if (pos && neg) { T.drapeTri(Bd, a, b, c, lift, uv, col, ax); T.drapeTri(Bd, a, c, d, lift, uv, col, ax); } else T.drapePoly(Bd, P, lift, uv, col, ax); };
    /* a straight line in plan cut where it crosses the lattice's lines: [[x, y, z], ...] from one end to the other, y on the ground */
    T.cuts = (ax, az, bx, bz) => {
      if (farOff((ax + bx) / 2, (az + bz) / 2)) return [[ax, T.gy(ax, az) + 0.22, az], [bx, T.gy(bx, bz) + 0.22, bz]];
      const k = blockAt((ax + bx) / 2, (az + bz) / 2), r = k.r, su = 16 / (r.x1 - r.x0), sv = 16 / (r.zS - r.zN), u0 = (ax - r.x0) * su, u1 = (bx - r.x0) * su, v0 = (az - r.zN) * sv, v1 = (bz - r.zN) * sv, ts = [0, 1];
      const add = (f0, f1) => { if (Math.abs(f1 - f0) < 1e-9) return; const lo = Math.min(f0, f1), hi = Math.max(f0, f1); for (let q = Math.ceil(lo + 1e-7); q < hi - 1e-7; q++) ts.push((q - f0) / (f1 - f0)); };
      add(u0, u1); add(v0, v1); add(u0 + v0, u1 + v1); ts.sort((a, b) => a - b); const out = []; let last = -1;
      for (const t of ts) { if (t - last < 1e-5 && t < 1) continue; last = t; const x = ax + (bx - ax) * t, z = az + (bz - az) * t; out.push([x, T.gyL(x, z), z]); }
      return out;
    };
    /* A line in plan ([[x, z], ...]) with points added so that no step is longer than step metres. own: for each point, whether it was one of the line's own */
    T.dense = (pts, step) => { const out = [], own = []; for (let i = 0; i < pts.length; i++) { if (i) { const a = pts[i - 1], b = pts[i], n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step); for (let q = 1; q < n; q++) { out.push([a[0] + (b[0] - a[0]) * q / n, a[1] + (b[1] - a[1]) * q / n]); own.push(false); } } out.push(pts[i]); own.push(true); } out.own = own; return out; };

    /* ---------- things added to an instance buffer stand on the ground ---------- */
    /* Cars and the like: an instance added with y = 0 is put on the ground under it; a long one (o.len, o.wid metres: a car) is also pitched and rolled to the slope. An instance added with any other y is left at that height and only tilted. */
    T.onGround = (ib, o) => {
      if (!ib || ib._onGround) return ib; ib._onGround = true; o = o || {}; const add0 = ib.add, hl = (o.len || 4.6) * 0.32, hw = (o.wid || 1.8) * 0.4;
      ib.add = function (x, y, z, yaw, sx, sy, sz, r, g, b, a) {
        const gy = T.gy; if (!y) y = gy(x, z); const n = add0.call(this, x, y, z, yaw, sx, sy, sz, r, g, b, a); if (o.flat) return n;
        const c = Math.cos(yaw || 0), s = Math.sin(yaw || 0), hf = gy(x + s * hl, z + c * hl), hb = gy(x - s * hl, z - c * hl), hr = gy(x + c * hw, z - s * hw), hq = gy(x - c * hw, z + s * hw), pf = (hf - hb) / (2 * hl), pr = (hr - hq) / (2 * hw);
        if (Math.abs(pf) < 0.004 && Math.abs(pr) < 0.004) return n; if (Math.abs(pf) > 1 || Math.abs(pr) > 1) return n;
        /* the car's own axes on the slope: forward (its +z) and right (its +x) follow the ground, up is square to both */
        let fx = s, fy = pf, fz = c, rx = c, ry = pr, rz = -s; const fl = Math.hypot(fx, fy, fz); fx /= fl; fy /= fl; fz /= fl; const d = rx * fx + ry * fy + rz * fz; rx -= fx * d; ry -= fy * d; rz -= fz * d; const rl = Math.hypot(rx, ry, rz); rx /= rl; ry /= rl; rz /= rl;
        const ux = fy * rz - fz * ry, uy = fz * rx - fx * rz, uz = fx * ry - fy * rx, D = this.data, q = n * 16, X = sx == null ? 1 : sx, Yv = sy == null ? X : sy, Z = sz == null ? X : sz;
        D[q] = rx * X; D[q + 1] = ux * Yv; D[q + 2] = fx * Z; D[q + 4] = ry * X; D[q + 5] = uy * Yv; D[q + 6] = fy * Z; D[q + 7] = (hf + hb + hr + hq) / 4 + (y - gy(x, z)); D[q + 8] = rz * X; D[q + 9] = uz * Yv; D[q + 10] = fz * Z; return n; };
      return ib;
    };

    /* ---------- a new origin: grids in local metres are dropped (tiles of elevation stay) ---------- */
    T.reset = () => { [...REG.values()].forEach(T.drop); BQ.length = 0; LAT.clear(); lb = null; gk = null; regGen++; };
    T.info = () => ({ on: T.on, ok: T.stats.ok, failed: T.stats.err, loading: NETQ.length + active, held: total, grounds: REG.size, built: T.stats.built, queue: BQ.length, grid: !!grid(), datum: S.y0 || 0 });
    T.tiles = () => TILES.map((m, li) => [...m.values()].map(t => LAD[li] + '/' + t.x + '/' + t.y + ':' + t.st + (t.why ? ' ' + t.why : '')));
    S.terr = T; S.gy = T.gy; S.slopeAt = T.slope; S.y0 = S.y0 || 0; S.elevAt = (lat, lon) => { const h = T.elev(lat, lon, 0); return h === h ? h : S.y0 || 0; };
    return T;
  }
  SE.TerrainKit = TerrainKit;

