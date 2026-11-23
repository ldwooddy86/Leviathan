/* ==== scout topo ==== */
/* The terrain side of Rooftop Scout: California's mountains, deserts and valleys on the map and in what is read for each
   building. Self-contained: the Scout module calls window.__SCOUT_TOPO__.init({ map, LF, root, ... }) once, right after
   the map is made, and gets back the hooks it uses (card, csv, ready).
   - Relief: a Leaflet GridLayer drawn in the page. Each tile's heights come from the AWS Terrain Tiles (terrarium PNG,
     metres = R*256 + G + B/256 - 32768, zoom 15 at the finest; under them the USGS 10 m model), are shaded from their
     neighbours with the true metres per pixel at that latitude, and are shown as a shade over the imagery, as an elevation
     tint, or as site slope. Contours are a second layer off the same heights.
   - The statewide picture: an embedded grid of the whole state (topo_grid.js, one post per zoom 7 pixel, about 1 km),
     which draws zooms 7 and below with no network at all and stands in, coarse, for any tile that fails.
   - Names: a gazetteer from the USGS Geographic Names Information System (topo_gaz.js) and the California Geological
     Survey's eleven geomorphic provinces (topo_prov.js), labelled by zoom.
   - The building card and the CSV: ground elevation, site slope and aspect, province, the nearest named range, valley or
     desert and peak, distance to the coast, and the readings a roofer uses (snow, marine air, exposure).
   Plain script, no library beyond the Leaflet the Scout module carries. */
(function () {
  'use strict';
  const GRID = window.__SCOUT_TOPO_GRID__ || null, PROVD = window.__SCOUT_TOPO_PROV__ || null, GAZD = window.__SCOUT_TOPO_GAZ__ || null, EXTRA = window.__SCOUT_TOPO_EXTRA__ || null;
  const TILE_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png', TILE_MAXZ = 15;
  const ESRI_HS = 'https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}';
  const KEY = 'cg.scout.topo.v1', FT = 3.28084, MI = 1609.344, D2R = Math.PI / 180;
  const CA_BOUNDS = [[32.53, -124.42], [42.01, -114.13]];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const N0 = v => Math.round(v).toLocaleString('en-US');
  const isN = v => typeof v === 'number' && isFinite(v);

  /* ---------- Web Mercator ---------- */
  const wpx = (lon, z) => (lon + 180) / 360 * 256 * Math.pow(2, z);
  const wpy = (lat, z) => { const s = Math.sin(lat * D2R); return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 256 * Math.pow(2, z); };
  const latOfWpy = (y, z) => { const n = Math.PI - 2 * Math.PI * y / (256 * Math.pow(2, z)); return Math.atan(Math.sinh(n)) / D2R; };
  const mpp = (lat, z) => 40075016.686 * Math.cos(lat * D2R) / (256 * Math.pow(2, z));       /* metres per pixel */
  function distM(la1, lo1, la2, lo2) { const a = Math.sin((la2 - la1) * D2R / 2), b = Math.sin((lo2 - lo1) * D2R / 2), h = a * a + Math.cos(la1 * D2R) * Math.cos(la2 * D2R) * b * b; return 12742017.6 * Math.asin(Math.min(1, Math.sqrt(h))); }
  function bearing(la1, lo1, la2, lo2) { const y = Math.sin((lo2 - lo1) * D2R) * Math.cos(la2 * D2R), x = Math.cos(la1 * D2R) * Math.sin(la2 * D2R) - Math.sin(la1 * D2R) * Math.cos(la2 * D2R) * Math.cos((lo2 - lo1) * D2R); return (Math.atan2(y, x) / D2R + 360) % 360; }
  const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const compass = d => COMPASS[Math.round(((d % 360) + 360) % 360 / 22.5) % 16];
  const COMPASS_L = { N: 'north', NE: 'northeast', E: 'east', SE: 'southeast', S: 'south', SW: 'southwest', W: 'west', NW: 'northwest' };
  const compass8 = d => ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(((d % 360) + 360) % 360 / 45) % 8];

  /* ---------- the terrain tiles: fetch, decode, keep ---------- */
  const tiles = new Map();                                                /* 'z/x/y' -> { p: Promise<Float32Array|null>, a: Float32Array|null, t: last use, bad: time of failure } */
  const TILE_KEEP = 72;
  let tileOk = 0, tileErr = 0, failRun = 0, downAt = 0;
  function decodeImage(img) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 256; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, 256, 256);
    const d = x.getImageData(0, 0, 256, 256).data, a = new Float32Array(65536);
    for (let i = 0, j = 0; i < 65536; i++, j += 4) a[i] = d[j] * 256 + d[j + 1] + d[j + 2] / 256 - 32768;
    return a;
  }
  function loadTile(z, x, y) {
    const n = Math.pow(2, z); if (y < 0 || y >= n || z < 0) return Promise.resolve(null); x = ((x % n) + n) % n;
    const k = z + '/' + x + '/' + y; let e = tiles.get(k);
    if (e && (e.a || e.pending || (e.bad && Date.now() - e.bad < 45000))) { e.t = Date.now(); return e.p; }
    e = { a: null, t: Date.now(), bad: 0, pending: true };
    e.p = new Promise(res => {
      if (failRun >= 8 && Date.now() - downAt < 20000) { e.pending = false; e.bad = Date.now(); res(null); return; }   /* the service is not answering: stop asking for a while */
      const img = new Image(); img.crossOrigin = 'anonymous'; let done = false;
      const fin = a => { if (done) return; done = true; e.pending = false; if (a) { e.a = a; tileOk++; failRun = 0; } else { e.bad = Date.now(); tileErr++; failRun++; downAt = Date.now(); } res(a); };
      img.onload = () => { let a = null; try { a = decodeImage(img); } catch (err) { a = null; } fin(a); };
      img.onerror = () => fin(null);
      setTimeout(() => fin(null), 20000);
      img.src = TILE_URL.replace('{z}', z).replace('{x}', x).replace('{y}', y);
    });
    tiles.set(k, e);
    if (tiles.size > TILE_KEEP) { const old = [...tiles.entries()].filter(([, v]) => !v.pending).sort((p, q) => p[1].t - q[1].t).slice(0, tiles.size - TILE_KEEP); old.forEach(([kk]) => tiles.delete(kk)); }
    return e.p;
  }
  const cached = (z, x, y) => { const e = tiles.get(z + '/' + x + '/' + y); if (e && e.a) { e.t = Date.now(); return e.a; } return null; };
  /* a height from the kept tiles, bilinear; NaN when the tile is not in hand */
  function sampleCached(lat, lon, z) {
    const fx = wpx(lon, z) - 0.5, fy = wpy(lat, z) - 0.5, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
    const at = (px, py) => { const a = cached(z, px >> 8, py >> 8); return a ? a[(py & 255) * 256 + (px & 255)] : NaN; };
    const a = at(x0, y0), b = at(x0 + 1, y0), c = at(x0, y0 + 1), d = at(x0 + 1, y0 + 1);
    if (isNaN(a)) return NaN; const bb = isNaN(b) ? a : b, cc = isNaN(c) ? a : c, dd = isNaN(d) ? (isNaN(b) ? cc : bb) : d;
    return (a * (1 - tx) + bb * tx) * (1 - ty) + (cc * (1 - tx) + dd * tx) * ty;
  }
  /* make sure the tiles round a point are in hand: r metres each way at zoom z */
  function ensure(lat, lon, z, r) {
    const m = mpp(lat, z), px = wpx(lon, z), py = wpy(lat, z), pad = r / m + 2, ps = [];
    for (let ty = Math.floor((py - pad) / 256); ty <= Math.floor((py + pad) / 256); ty++) for (let tx = Math.floor((px - pad) / 256); tx <= Math.floor((px + pad) / 256); tx++) ps.push(loadTile(z, tx, ty));
    return Promise.all(ps);
  }
  /* one height, from the tiles (fetched if need be), else from the statewide grid */
  function eleAt(lat, lon, z) { z = Math.min(TILE_MAXZ, z == null ? 14 : z); return ensure(lat, lon, z, 0).then(() => { const v = sampleCached(lat, lon, z); return isNaN(v) ? gridAt(lat, lon) : v; }); }

  /* ---------- the embedded statewide grid ---------- */
  const mips = [];                                                        /* mips[k] = { w, h, a } : the grid averaged 2^k to a side */
  let gridReady = null, gridFail = false;
  function loadGrid() {
    if (gridReady) return gridReady;
    gridReady = new Promise(res => {
      if (!GRID || !GRID.b64) { gridFail = true; res(false); return; }
      const img = new Image();
      img.onload = () => {
        try {
          const c = document.createElement('canvas'); c.width = GRID.w; c.height = GRID.h; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0);
          const d = x.getImageData(0, 0, GRID.w, GRID.h).data, a = new Float32Array(GRID.w * GRID.h);
          for (let i = 0, j = 0; i < a.length; i++, j += 4) { const q = d[j] * 256 + d[j + 1]; a[i] = q ? q * GRID.step - GRID.off : NaN; }
          mips[0] = { w: GRID.w, h: GRID.h, a }; res(true);
        } catch (e) { gridFail = true; res(false); }
      };
      img.onerror = () => { gridFail = true; res(false); };
      img.src = 'data:image/' + GRID.fmt + ';base64,' + GRID.b64;
    });
    return gridReady;
  }
  function mip(k) {
    if (mips[k] || !mips[0]) return mips[k] || null;
    const s = mip(k - 1), w = Math.ceil(s.w / 2), h = Math.ceil(s.h / 2), a = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let t = 0, n = 0; for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) { const sx = x * 2 + dx, sy = y * 2 + dy; if (sx < s.w && sy < s.h) { const v = s.a[sy * s.w + sx]; if (v === v) { t += v; n++; } } } a[y * w + x] = n >= 2 ? t / n : NaN; }
    return (mips[k] = { w, h, a });
  }
  function mipSample(M, fx, fy) {
    const x0 = Math.floor(fx), y0 = Math.floor(fy); if (x0 < -1 || y0 < -1 || x0 >= M.w || y0 >= M.h) return NaN;
    const tx = fx - x0, ty = fy - y0; let t = 0, wsum = 0;
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) { const x = x0 + dx, y = y0 + dy; if (x < 0 || y < 0 || x >= M.w || y >= M.h) continue; const v = M.a[y * M.w + x]; if (v !== v) continue; const w = (dx ? tx : 1 - tx) * (dy ? ty : 1 - ty); t += v * w; wsum += w; }
    return wsum > 0.35 ? t / wsum : NaN;
  }
  function gridAt(lat, lon) { if (!mips[0]) return NaN; return mipSample(mips[0], wpx(lon, GRID.z) - GRID.x0 - 0.5, wpy(lat, GRID.z) - GRID.y0 - 0.5); }

  /* ---------- heights for one map tile: a 258 x 258 block (one post of margin each side) ---------- */
  function blockFromGrid(c) {
    if (!mips[0]) return null;
    const H = new Float32Array(258 * 258), dz = GRID.z - c.z; let any = false;
    if (dz >= 0) {                                                        /* zoom 7 and out: the grid, averaged to this zoom */
      const k = Math.min(dz, 5), M = mip(k), f = Math.pow(2, dz), fk = Math.pow(2, k);
      for (let j = 0; j < 258; j++) for (let i = 0; i < 258; i++) { const gx = (c.x * 256 + i - 1 + 0.5) * f - GRID.x0, gy = (c.y * 256 + j - 1 + 0.5) * f - GRID.y0, v = mipSample(M, gx / fk - 0.5, gy / fk - 0.5); H[j * 258 + i] = v; if (v === v) any = true; }
    } else {                                                              /* closer in: the grid stretched (the stand-in when a tile will not load) */
      const f = Math.pow(2, -dz), M = mips[0];
      for (let j = 0; j < 258; j++) for (let i = 0; i < 258; i++) { const v = mipSample(M, (c.x * 256 + i - 1 + 0.5) / f - GRID.x0 - 0.5, (c.y * 256 + j - 1 + 0.5) / f - GRID.y0 - 0.5); H[j * 258 + i] = v; if (v === v) any = true; }
    }
    return any ? H : null;
  }
  function blockFromTile(a, c) {
    const H = new Float32Array(258 * 258);
    if (c.z <= TILE_MAXZ) {
      for (let j = 0; j < 256; j++) for (let i = 0; i < 256; i++) H[(j + 1) * 258 + i + 1] = a[j * 256 + i];
    } else {                                                              /* past the tiles' finest zoom: the zoom 15 tile, stretched */
      const f = Math.pow(2, c.z - TILE_MAXZ), ox = (c.x % f) * 256 / f, oy = (c.y % f) * 256 / f;
      for (let j = 0; j < 256; j++) for (let i = 0; i < 256; i++) {
        const fx = Math.min(255, Math.max(0, ox + (i + 0.5) / f - 0.5)), fy = Math.min(255, Math.max(0, oy + (j + 0.5) / f - 0.5)), x0 = Math.min(254, Math.floor(fx)), y0 = Math.min(254, Math.floor(fy)), tx = fx - x0, ty = fy - y0, p = y0 * 256 + x0;
        H[(j + 1) * 258 + i + 1] = (a[p] * (1 - tx) + a[p + 1] * tx) * (1 - ty) + (a[p + 256] * (1 - tx) + a[p + 257] * tx) * ty;
      }
    }
    /* the margin: carried on in a straight line, so the slope at the edge is the slope just inside it */
    for (let i = 1; i <= 256; i++) { H[i] = 2 * H[258 + i] - H[516 + i]; H[257 * 258 + i] = 2 * H[256 * 258 + i] - H[255 * 258 + i]; }
    for (let j = 0; j < 258; j++) { H[j * 258] = 2 * H[j * 258 + 1] - H[j * 258 + 2]; H[j * 258 + 257] = 2 * H[j * 258 + 256] - H[j * 258 + 255]; }
    return H;
  }
  /* resolves { H, src: 'tile' | 'grid' } or null */
  function blockFor(c) {
    if (c.z <= (GRID ? GRID.z : -1)) return loadGrid().then(() => { const H = blockFromGrid(c); return H ? { H, src: 'grid' } : null; });
    const f = c.z > TILE_MAXZ ? Math.pow(2, c.z - TILE_MAXZ) : 1, tz = Math.min(c.z, TILE_MAXZ);
    return loadTile(tz, Math.floor(c.x / f), Math.floor(c.y / f)).then(a => {
      if (a) return { H: blockFromTile(a, c), src: 'tile' };
      return loadGrid().then(() => { const H = blockFromGrid(c); return H ? { H, src: 'grid' } : null; });
    });
  }

  /* ---------- colours ---------- */
  /* elevation tint: metres -> colour. From below sea level (Death Valley, the Salton Sink) to the Sierra crest. */
  const HYPSO = [[-90, 56, 96, 110], [-1, 96, 150, 150], [0, 108, 150, 96], [100, 132, 170, 104], [300, 172, 190, 116], [600, 214, 208, 132], [1000, 222, 188, 116], [1500, 204, 158, 98], [2000, 178, 128, 88], [2500, 160, 118, 100], [3000, 176, 156, 148], [3500, 208, 200, 196], [4000, 236, 234, 232], [4450, 255, 255, 255]];
  const RAMP = new Uint8Array(4600 * 3);                                  /* one entry per metre from -100 */
  (function () { let s = 0; for (let m = 0; m < 4600; m++) { const h = m - 100; while (s < HYPSO.length - 2 && h > HYPSO[s + 1][0]) s++; const a = HYPSO[s], b = HYPSO[s + 1], t = Math.min(1, Math.max(0, (h - a[0]) / (b[0] - a[0]))); for (let k = 0; k < 3; k++) RAMP[m * 3 + k] = Math.round(a[k + 1] + (b[k + 1] - a[k + 1]) * t); } })();
  /* site slope, in the words a crew uses. Per cent = rise over run. */
  const SLOPES = [[5, 'Level', null], [15, 'Gentle', [120, 190, 90]], [30, 'Hillside', [245, 205, 60]], [50, 'Steep', [240, 130, 40]], [1e9, 'Very steep', [200, 40, 50]]];
  const slopeClass = p => SLOPES.find(s => p < s[0]);
  const SLOPE_NOTE = { Level: 'level ground: trucks, dumpsters and conveyors set up anywhere', Gentle: 'a gentle grade: normal access', Hillside: 'a hillside lot: check where the truck and the dumpster can stand, and the downhill eave is taller than it looks', Steep: 'a steep site: staging, ladders and material hoists need planning, and the low side may need scaffolding', 'Very steep': 'a very steep site: expect scaffolding or rope access on the downhill side and hand carried material' };
  const exag = z => z <= 6 ? 7 : z === 7 ? 6 : z === 8 ? 4.5 : z === 9 ? 3.6 : z === 10 ? 3 : z === 11 ? 2.5 : z === 12 ? 2 : z === 13 ? 1.7 : 1.4;
  const LIGHT = (function () { const az = 315 * D2R, al = 45 * D2R; return [Math.sin(az) * Math.cos(al), Math.cos(az) * Math.cos(al), Math.sin(al)]; })();   /* east, north, up */
  /* contour interval in feet by zoom: [interval, heavier line every] */
  const contourFt = z => z <= 7 ? [2000, 4000] : z <= 9 ? [1000, 5000] : z <= 11 ? [500, 2500] : z <= 13 ? [200, 1000] : z === 14 ? [100, 500] : [40, 200];

  function paint(cv, H, c, mode) {
    const ctx = cv.getContext('2d'), im = ctx.createImageData(256, 256), d = im.data, ze = exag(c.z);
    for (let j = 0; j < 256; j++) {
      const m = mpp(latOfWpy(c.y * 256 + j + 0.5, c.z), c.z), k = 1 / (2 * m);
      for (let i = 0; i < 256; i++) {
        const p = (j + 1) * 258 + i + 1, h = H[p], o = (j * 256 + i) * 4;
        if (h !== h) { d[o + 3] = 0; continue; }
        let hl = H[p - 1], hr = H[p + 1], hu = H[p - 258], hd = H[p + 258];
        if (hl !== hl) hl = h; if (hr !== hr) hr = h; if (hu !== hu) hu = h; if (hd !== hd) hd = h;
        const gE = (hr - hl) * k, gN = (hu - hd) * k;                   /* rise per metre to the east and to the north */
        if (mode === 'slope') {
          const s = slopeClass(Math.sqrt(gE * gE + gN * gN) * 100);
          if (!s[2]) { d[o + 3] = 0; continue; } d[o] = s[2][0]; d[o + 1] = s[2][1]; d[o + 2] = s[2][2]; d[o + 3] = 215; continue;
        }
        const nx = -gE * ze, ny = -gN * ze, sh = Math.max(0, (nx * LIGHT[0] + ny * LIGHT[1] + LIGHT[2]) / Math.sqrt(nx * nx + ny * ny + 1));
        if (mode === 'tint') {
          const r = Math.min(4599, Math.max(0, Math.round(h) + 100)) * 3, f = 0.42 + 0.82 * sh;
          d[o] = Math.min(255, RAMP[r] * f); d[o + 1] = Math.min(255, RAMP[r + 1] * f); d[o + 2] = Math.min(255, RAMP[r + 2] * f); d[o + 3] = 255;
        } else {                                                          /* shade: dark on the lee side, light toward the sun, nothing on flat ground */
          const t = sh - LIGHT[2];
          if (t < 0) { d[o] = 8; d[o + 1] = 12; d[o + 2] = 24; d[o + 3] = Math.min(225, -t * 520); } else { d[o] = 255; d[o + 1] = 250; d[o + 2] = 235; d[o + 3] = Math.min(150, t * 560); }
        }
      }
    }
    ctx.putImageData(im, 0, 0);
  }
  function paintContours(cv, H, c) {
    const ctx = cv.getContext('2d'), im = ctx.createImageData(256, 256), d = im.data, [iv, idx] = contourFt(c.z), q = FT / iv, n5 = idx / iv;
    for (let j = 0; j < 256; j++) for (let i = 0; i < 256; i++) {
      const p = (j + 1) * 258 + i + 1, h = H[p]; if (h !== h) continue;
      const a = Math.floor(h * q), b = Math.floor(H[p + 1] * q), e = Math.floor(H[p + 258] * q);
      if (a === b && a === e) continue; if (b !== b || e !== e) continue;
      const lvl = Math.max(a, a !== b ? b : a, a !== e ? e : a), heavy = lvl % n5 === 0, o = (j * 256 + i) * 4;
      d[o] = 70; d[o + 1] = 40; d[o + 2] = 12; d[o + 3] = heavy ? 235 : 135;
      if (lvl === 0) { d[o] = 20; d[o + 1] = 70; d[o + 2] = 140; d[o + 3] = 235; }      /* sea level */
    }
    ctx.putImageData(im, 0, 0);
  }

  /* ---------- provinces, names ---------- */
  function unpack(s) { const out = []; let i = 0, la = 0, lo = 0; while (i < s.length) { for (let k = 0; k < 2; k++) { let r = 0, sh = 0, b; do { b = s.charCodeAt(i++) - 63; r |= (b & 31) << sh; sh += 5; } while (b >= 32); const dv = r & 1 ? ~(r >> 1) : r >> 1; if (k) lo += dv; else la += dv; } out.push([la / 1000, lo / 1000]); } return out; }
  const PROV = PROVD ? PROVD.prov.map(p => { const rings = p.r.map(unpack); let b = [90, 180, -90, -180]; rings.forEach(r => r.forEach(([la, lo]) => { if (la < b[0]) b[0] = la; if (lo < b[1]) b[1] = lo; if (la > b[2]) b[2] = la; if (lo > b[3]) b[3] = lo; })); /* the way the province runs on the map (Sierra Nevada, Great Valley and Coast Ranges run northwest to southeast): its name is set along it */
    const big = rings.reduce((a, r) => r.length > a.length ? r : a, rings[0]); let mx = 0, my = 0; const P = big.map(([la, lo]) => [wpx(lo, 8), wpy(la, 8)]); P.forEach(q => { mx += q[0]; my += q[1]; }); mx /= P.length; my /= P.length;
    let sxx = 0, syy = 0, sxy = 0; P.forEach(q => { const dx = q[0] - mx, dy = q[1] - my; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; });
    const th = 0.5 * Math.atan2(2 * sxy, sxx - syy), tr = sxx + syy, det = sxx * syy - sxy * sxy, l1 = tr / 2 + Math.sqrt(Math.max(0, tr * tr / 4 - det)), l2 = tr - l1;
    let ang = l2 > 0 && l1 / l2 > 3 ? th / D2R : 0; if (ang > 90) ang -= 180; if (ang < -90) ang += 180; ang = Math.max(-62, Math.min(62, ang));
    return { n: p.n, u: p.u, la: p.la, lo: p.lo, rings, b, ang }; }) : [];
  const COAST = PROVD ? PROVD.coast.map(unpack) : [];
  function inRing(r, la, lo) { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const a = r[i], b = r[j]; if ((a[0] > la) !== (b[0] > la) && lo < (b[1] - a[1]) * (la - a[0]) / (b[0] - a[0]) + a[1]) c = !c; } return c; }
  function provinceAt(la, lo) {
    for (const p of PROV) if (la >= p.b[0] && la <= p.b[2] && lo >= p.b[1] && lo <= p.b[3] && p.rings.some(r => inRing(r, la, lo))) return { n: p.n, u: p.u, near: false };
    let best = null, bd = 1e9; const cl = Math.cos(la * D2R);                    /* just outside every outline (a pier, an island): the nearest one, said as such */
    for (const p of PROV) for (const r of p.rings) for (const v of r) { const dd = (v[0] - la) * (v[0] - la) + (v[1] - lo) * (v[1] - lo) * cl * cl; if (dd < bd) { bd = dd; best = p; } }
    return best && Math.sqrt(bd) * 111 < 60 ? { n: best.n, u: best.u, near: true } : null;
  }
  function segDist(la, lo, a, b, cl) { const ax = (a[1] - lo) * cl, ay = a[0] - la, bx = (b[1] - lo) * cl, by = b[0] - la, dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy, t = L ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / L)) : 0, x = ax + t * dx, y = ay + t * dy; return Math.sqrt(x * x + y * y); }
  function coastKm(la, lo) { if (!COAST.length) return null; const cl = Math.cos(la * D2R); let best = 1e9; for (const l of COAST) for (let i = 1; i < l.length; i++) { const dd = segDist(la, lo, l[i - 1], l[i], cl); if (dd < best) best = dd; } return best * 111.19; }
  const KINDS = GAZD ? GAZD.k : [];
  const GAZ = GAZD ? GAZD.f.map(f => ({ n: f[0], k: KINDS[f[1]], t: f[2], la: f[3] / 1e4, lo: f[4] / 1e4, m: f[5] })) : [];
  function nearest(la, lo, kinds, maxKm, minTier) {
    let best = null, bd = 1e12; const cl = Math.cos(la * D2R);
    for (const g of GAZ) { if (!kinds.includes(g.k) || (minTier && g.t > minTier)) continue; const dy = g.la - la, dx = (g.lo - lo) * cl, dd = dx * dx + dy * dy; if (dd < bd) { bd = dd; best = g; } }
    if (!best) return null; const m = distM(la, lo, best.la, best.lo); if (maxKm && m > maxKm * 1000) return null;
    return { n: best.n, k: best.k, m: best.m, km: m / 1000, dir: compass8(bearing(la, lo, best.la, best.lo)), la: best.la, lo: best.lo };
  }

  /* ---------- what the ground is like at one point ---------- */
  /* Elevation: zoom 14 tile (7 to 8 m a pixel here; the USGS 10 m model under it), bilinear.
     Slope and aspect: the fall across 30 m each way (Horn's eight neighbours at 15 m), so it is the lot's grade, not a kerb.
     Position: the point's height against the mean of a ring 300 m out (zoom 12): a ridge or knoll stands above its ring,
     a valley floor or hollow sits below it. A described judgment, not a measurement of wind. */
  function readSite(la, lo) {
    const g = gridAt(la, lo); let e = sampleCached(la, lo, 14), src = 'tiles';
    const out = { la, lo, elev: null, slope: null, aspect: null, src: null, tpi: null };
    if (isNaN(e)) { e = g; src = 'grid'; }
    if (isNaN(e)) return out;
    out.elev = e; out.src = src;
    const dLa = 15 / 111320, dLo = 15 / (111320 * Math.cos(la * D2R));
    const S = src === 'tiles' ? (y, x) => sampleCached(la + y * dLa, lo + x * dLo, 14) : null;
    if (S) {
      const a = S(1, -1), b = S(1, 0), c = S(1, 1), d = S(0, -1), f = S(0, 1), gg = S(-1, -1), h = S(-1, 0), i = S(-1, 1);
      if (![a, b, c, d, f, gg, h, i].some(isNaN)) {
        const gE = ((c + 2 * f + i) - (a + 2 * d + gg)) / (8 * 15), gN = ((a + 2 * b + c) - (gg + 2 * h + i)) / (8 * 15);
        out.slope = Math.sqrt(gE * gE + gN * gN) * 100; out.aspect = out.slope >= 2 ? (Math.atan2(-gE, -gN) / D2R + 360) % 360 : null;
      }
      let t = 0, n = 0; for (let k = 0; k < 8; k++) { const v = sampleCached(la + Math.cos(k * Math.PI / 4) * 300 / 111320, lo + Math.sin(k * Math.PI / 4) * 300 / (111320 * Math.cos(la * D2R)), 12); if (!isNaN(v)) { t += v; n++; } }
      const c12 = sampleCached(la, lo, 12); if (n >= 6 && !isNaN(c12)) out.tpi = c12 - t / n;
    }
    return out;
  }
  function describe(r, ctx) {
    const la = r.la, lo = r.lo;
    r.prov = provinceAt(la, lo);
    r.range = nearest(la, lo, ['range'], 40); r.low = nearest(la, lo, ['valley', 'desert'], 40); r.peak = nearest(la, lo, ['peak'], 16);
    r.pass = nearest(la, lo, ['pass'], 25, 2);                              /* the named passes of the curated list only: a notch on a trail is not a wind gap */
    r.coast = coastKm(la, lo);
    r.pos = r.tpi == null ? null : r.tpi >= 12 ? 'ridge' : r.tpi <= -12 ? 'hollow' : (r.slope != null && r.slope >= 15 ? 'slope' : 'flat');
    if (EXTRA && EXTRA.read) { try { EXTRA.read(r, ctx || {}); } catch (e) { } }
    return r;
  }
  function siteAt(la, lo, ctx) { return loadGrid().then(() => Promise.all([ensure(la, lo, 14, 40), ensure(la, lo, 12, 320)])).then(() => describe(readSite(la, lo), ctx)); }
  const ftm = m => `${N0(m * FT)} ft (${N0(m)} m)`;
  const miles = km => km < 0.16 ? `${N0(km * 1000 * FT / 10) * 10} ft` : km / 1.609344 < 10 ? (km / 1.609344).toFixed(1) + ' mi' : N0(km / 1.609344) + ' mi';
  const POS_TXT = {
    ridge: m => `On a ridge or knoll: ${N0(m * FT)} ft above the ground 300 m around it. Ridge tops and upper slopes take the wind first and hardest; edges, ridge caps and hip lines are where it shows.`,
    hollow: m => `In a hollow or on a valley floor: ${N0(-m * FT)} ft below the ground 300 m around it. Sheltered from most wind; cold air, fog and frost settle here and roofs dry slowly.`,
    slope: () => 'On an open slope, neither crest nor floor: wind runs up or down the hill, so the uphill and downhill eaves see different weather.',
    flat: () => 'On even ground, neither crest nor floor: no shelter and no added exposure from the land itself.'
  };

  /* ---------- the module, once the map exists ---------- */
  function init(o) {
    const map = o.map, LF = o.LF, root = o.root || document, G = typeof o.G === 'function' ? o.G : (() => '');
    const zipOf = (la, lo) => { try { return o.zipAt ? o.zipAt(la, lo) : null; } catch (e) { return null; } };
    const ziOf = z => { try { return o.zi ? o.zi(z) : null; } catch (e) { return null; } };
    const ctxOf = (la, lo, zip) => { const z = zip || zipOf(la, lo); return { zip: z || null, zi: z ? ziOf(z) : null }; };
    let st = { mode: 'shade', op: 0.75, contours: false, names: true, prov: true };
    try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && typeof s === 'object') st = Object.assign(st, s); } catch (e) { }
    if (o.state) st = Object.assign(st, o.state);
    const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { } };
    try { if (map.getMinZoom() > 6) map.setMinZoom(6); } catch (e) { }     /* the whole state fits a small map only from zoom 6 */
    [['scTopo', 405], ['scTopoC', 406], ['scTopoP', 416], ['scTopoL', 446]].forEach(([n, z]) => { const p = map.createPane(n); p.style.zIndex = z; p.style.pointerEvents = 'none'; });
    loadGrid();

    /* the relief and contour layers */
    const Relief = LF.GridLayer.extend({
      createTile: function (c, done) {
        const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256; const kind = this.options.kind;
        blockFor(c).then(b => { try { if (b) { if (kind === 'contour') paintContours(cv, b.H, c); else paint(cv, b.H, c, kind); if (b.src === 'grid' && c.z > GRID.z) coarse(); } } catch (e) { } done(null, cv); }, () => done(null, cv));
        return cv;
      }
    });
    let relief = null, contour = null, esriHs = null, coarseAt = 0;
    const ATTR = 'Terrain: <a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noopener">AWS Terrain Tiles</a> (USGS 3DEP, Mapzen)';
    function coarse() { coarseAt = Date.now(); note(); }
    function setLayers() {
      if (relief) { map.removeLayer(relief); relief = null; } if (esriHs) { map.removeLayer(esriHs); esriHs = null; } if (contour) { map.removeLayer(contour); contour = null; }
      if (st.mode === 'esri') esriHs = LF.tileLayer(ESRI_HS, { pane: 'scTopo', maxZoom: 22, maxNativeZoom: 16, opacity: st.op, className: 'sc-topo-mul', attribution: 'Hillshade: Esri, USGS, NOAA' }).addTo(map);
      else if (st.mode !== 'off') relief = new Relief({ pane: 'scTopo', kind: st.mode, tileSize: 256, maxZoom: 22, minZoom: 0, opacity: st.op, updateWhenZooming: false, keepBuffer: 1, attribution: ATTR }).addTo(map);
      if (st.contours) contour = new Relief({ pane: 'scTopoC', kind: 'contour', tileSize: 256, maxZoom: 22, minZoom: 0, opacity: 0.9, updateWhenZooming: false, keepBuffer: 1, attribution: ATTR }).addTo(map);
      legend(); note();
    }

    /* province outlines and the names */
    const gProv = LF.layerGroup(), gLab = LF.layerGroup().addTo(map);
    PROV.forEach(p => p.rings.forEach(r => LF.polyline(r.concat([r[0]]), { pane: 'scTopoP', color: '#fff', weight: 1.2, opacity: 0.75, dashArray: '5 4', interactive: false }).addTo(gProv)));
    const KCLS = { range: 'r', peak: 'p', pass: 'g', desert: 'd', valley: 'v', water: 'w', island: 'i' };
    function labelText(g) { if (g.k === 'peak' && isN(g.m)) return `${g.n} ${N0(g.m * FT)} ft`; if (g.k === 'pass' && isN(g.m)) return `${g.n} ${N0(g.m * FT)} ft`; if (isN(g.m) && g.m < 0) return `${g.n} ${N0(-g.m * FT)} ft below sea level`; return g.n; }
    function labels() {
      gLab.clearLayers();
      const z = map.getZoom(), sz = map.getSize();
      if (st.prov && z <= 10 && PROV.length) { if (!map.hasLayer(gProv)) gProv.addTo(map); } else if (map.hasLayer(gProv)) map.removeLayer(gProv);
      if (!st.names) return;
      const b = map.getBounds().pad(0.05), items = [];
      if (z <= 9) PROV.forEach(p => { if (b.contains([p.la, p.lo])) items.push({ n: p.n, la: p.la, lo: p.lo, cls: z <= 6 ? 'pv sc-tl-pv6' : 'pv', pv: 1, ang: p.ang, pr: 0, txt: p.n }); });
      const maxTier = z <= 7 ? 1 : z <= 10 ? 2 : 3;
      for (const g of GAZ) { if (g.t > maxTier || g.la < b.getSouth() || g.la > b.getNorth() || g.lo < b.getWest() || g.lo > b.getEast()) continue; if (g.t === 3 && z < 12 && g.k !== 'range') continue; items.push({ n: g.n, la: g.la, lo: g.lo, cls: KCLS[g.k] || 'r', pr: g.t * 10 + (g.k === 'peak' ? 2 : g.k === 'pass' ? 3 : 1), txt: labelText(g), dot: g.k === 'peak' || g.k === 'pass' }); }
      items.sort((p, q) => p.pr - q.pr);
      const taken = [], cap = z <= 7 ? 60 : 110; let n = 0;
      for (const it of items) {
        const pt = map.latLngToContainerPoint([it.la, it.lo]); if (pt.x < -20 || pt.y < -10 || pt.x > sz.x + 20 || pt.y > sz.y + 10) continue;
        /* room is kept by a row of discs along the name, so a name set at an angle only blocks what it covers */
        const w = it.txt.length * (it.pv ? (z <= 6 ? 8 : 10.2) : 6.4) + (it.dot ? 14 : 6), h = it.pv ? 15 : 13, a = (it.ang || 0) * D2R, ca = Math.cos(a), sa = Math.sin(a), rad = h / 2 + 1.5, half = Math.max(0, w / 2 - h / 2), ds = [];
        for (let t = -half; t <= half + 0.01; t += Math.max(4, Math.min(h * 0.8, half || 1))) ds.push([pt.x + t * ca, pt.y + t * sa, rad]);
        if (taken.some(t => ds.some(d => { const dx = d[0] - t[0], dy = d[1] - t[1], rr = d[2] + t[2]; return dx * dx + dy * dy < rr * rr; }))) continue;
        ds.forEach(d => taken.push(d));
        LF.marker([it.la, it.lo], { pane: 'scTopoL', interactive: false, keyboard: false, icon: LF.divIcon({ className: 'sc-tl sc-tl-' + it.cls, html: `<span${it.ang ? ` style="transform:translate(-50%,-50%) rotate(${it.ang.toFixed(0)}deg)"` : ''}>${it.dot ? '<i></i>' : ''}${esc(it.txt)}</span>`, iconSize: [0, 0] }) }).addTo(gLab);
        if (++n >= cap) break;
      }
    }
    let labT = 0; const labelsSoon = () => { clearTimeout(labT); labT = setTimeout(labels, 120); };
    map.on('moveend zoomend resize', labelsSoon);

    /* the control on the map */
    const ctl = LF.control({ position: 'topleft' }); let box = null;
    ctl.onAdd = () => {
      box = LF.DomUtil.create('div', 'sc-topo-ctl leaflet-bar');
      box.innerHTML = `<button type="button" class="sc-topo-b" id="scTopoB" aria-expanded="false" title="Terrain: relief, elevation, slope, contours and place names">Terrain</button>
        <div class="sc-topo-p" id="scTopoP" hidden>
          <label class="sc-topo-r"><span>Relief</span><select id="scTopoMode"><option value="off">Off</option><option value="shade">Shaded relief over the imagery</option><option value="tint">Elevation tint</option><option value="slope">Site slope (access)</option><option value="esri">Esri World Hillshade (ready made)</option></select></label>
          <label class="sc-topo-r"><span>Strength</span><input type="range" id="scTopoOp" min="0.1" max="1" step="0.05"></label>
          <label class="sc-topo-c"><input type="checkbox" id="scTopoCon"> Contour lines</label>
          <label class="sc-topo-c"><input type="checkbox" id="scTopoNm"> Ranges, deserts, valleys, peaks, passes</label>
          <label class="sc-topo-c"><input type="checkbox" id="scTopoPv"> Province outlines</label>
          <div class="sc-topo-acts"><button type="button" id="scTopoState">Whole state</button>${EXTRA && EXTRA.profile ? '<button type="button" id="scTopoProf">Profile</button>' : ''}</div>
          <div class="sc-topo-leg" id="scTopoLeg"></div><div class="sc-topo-note" id="scTopoNote"></div>
        </div>`;
      LF.DomEvent.disableClickPropagation(box); LF.DomEvent.disableScrollPropagation(box);
      const q = s => box.querySelector(s);
      q('#scTopoB').onclick = () => { const p = q('#scTopoP'); p.hidden = !p.hidden; q('#scTopoB').setAttribute('aria-expanded', String(!p.hidden)); };
      q('#scTopoMode').value = st.mode; q('#scTopoOp').value = st.op; q('#scTopoCon').checked = !!st.contours; q('#scTopoNm').checked = !!st.names; q('#scTopoPv').checked = !!st.prov;
      q('#scTopoMode').onchange = e => { st.mode = e.target.value; save(); setLayers(); };
      q('#scTopoOp').oninput = e => { st.op = +e.target.value; save(); if (relief) relief.setOpacity(st.op); if (esriHs) esriHs.setOpacity(st.op); };
      q('#scTopoCon').onchange = e => { st.contours = e.target.checked; save(); setLayers(); };
      q('#scTopoNm').onchange = e => { st.names = e.target.checked; save(); labels(); };
      q('#scTopoPv').onchange = e => { st.prov = e.target.checked; save(); labels(); };
      q('#scTopoState').onclick = () => stateView();
      const pb = q('#scTopoProf'); if (pb) pb.onclick = () => EXTRA.profile(api);
      return box;
    };
    ctl.addTo(map);
    function stateView() { if (st.mode === 'off' || st.mode === 'shade' || st.mode === 'esri') { st.mode = 'tint'; st.op = Math.max(st.op, 0.9); save(); if (box) { box.querySelector('#scTopoMode').value = st.mode; box.querySelector('#scTopoOp').value = st.op; } setLayers(); } try { map.setMaxBounds(null); } catch (e) { } map.fitBounds(CA_BOUNDS, { animate: false }); labelsSoon(); }
    function legend() {
      const el = box && box.querySelector('#scTopoLeg'); if (!el) return; let h = '';
      if (st.mode === 'tint') {
        const g = HYPSO.map(s => `rgb(${s[1]},${s[2]},${s[3]}) ${(((s[0] + 90) / 4540) * 100).toFixed(1)}%`).join(',');
        h = `<div class="sc-topo-lt">Elevation</div><div class="sc-topo-ramp" style="background:linear-gradient(90deg,${g})"></div><div class="sc-topo-tk">${[['-280 ft', -86], ['0', 0], ['3,281', 1000], ['6,562', 2000], ['9,843', 3000], ['14,505 ft', 4421]].map(([l, m]) => `<span style="left:${(((m + 90) / 4540) * 100).toFixed(1)}%">${l}</span>`).join('')}</div><div class="sc-topo-ln">From Badwater Basin, about 280 ft below sea level, to Mount Whitney, 14,505 ft (4,421 m). Blue green is below sea level.</div>`;
      } else if (st.mode === 'slope') {
        h = `<div class="sc-topo-lt">Site slope, rise over run</div>${SLOPES.map((s, i) => `<div class="sc-topo-sw"><i style="background:${s[2] ? `rgb(${s[2].join(',')})` : 'transparent'};${s[2] ? '' : 'outline:1px dashed currentColor'}"></i>${esc(s[1])} ${i ? '' : 'under '}${i ? SLOPES[i - 1][0] + (i < SLOPES.length - 1 ? ' to ' + s[0] : ' and over') : s[0]}%</div>`).join('')}<div class="sc-topo-ln">The grade of the ground, not the pitch of the roof. From zoom 12 the slope is of the lot; farther out it is the average over a wider pixel.</div>`;
      } else if (st.mode === 'shade' || st.mode === 'esri') h = `<div class="sc-topo-ln">Light from the northwest: slopes facing southeast are dark.${st.mode === 'esri' ? ' Esri\'s ready-made hillshade tiles, multiplied over the imagery.' : ''}</div>`;
      if (st.contours) { const [iv, ix] = contourFt(map.getZoom()); h += `<div class="sc-topo-ln">Contours every ${N0(iv)} ft at this zoom, heavier every ${N0(ix)} ft; sea level in blue.</div>`; }
      el.innerHTML = h;
    }
    function note() {
      const el = box && box.querySelector('#scTopoNote'); if (!el) return; const z = map.getZoom(); let t = '';
      if (st.mode !== 'off' && st.mode !== 'esri' || st.contours) {
        if (GRID && z <= GRID.z) t = 'Drawn from the statewide grid carried in this file (about 1 km posts): no network needed at this zoom.';
        else if (Date.now() - coarseAt < 30000) t = 'The terrain tiles did not load, so this is the statewide grid stretched: the shape is right, the detail is not.';
        else if (z > TILE_MAXZ) t = 'The terrain tiles stop at zoom 15 (the USGS 10 m model): closer than that the same heights are stretched.';
      }
      el.textContent = t;
    }
    map.on('zoomend', () => { legend(); note(); });

    /* ---------- the building card ---------- */
    function rows(r) {
      const R = [];
      if (r.elev == null) return '<p class="sc-note">No terrain reading here: the terrain tiles did not load and the point is outside the statewide grid.</p>';
      const approx = r.src === 'grid';
      R.push(['Ground elevation', `<b>${approx ? 'about ' : ''}${ftm(r.elev)}</b>${approx ? ' <span class="sc-topo-q">statewide grid, 1 km posts</span>' : ''}`]);
      if (r.slope != null) { const sc = slopeClass(r.slope); R.push(['Site slope', `<b>${r.slope < 1 ? 'under 1' : N0(r.slope)}%</b> (${(Math.atan(r.slope / 100) / D2R).toFixed(r.slope < 10 ? 1 : 0)}°), ${esc(sc[1].toLowerCase())}`]); R.push(['Faces', r.aspect == null ? 'level, no aspect' : `<b>${compass(r.aspect)}</b> (${N0(r.aspect)}°): the ground falls to the ${COMPASS_L[compass8(r.aspect)]}`]); }
      if (r.prov) R.push(['Province', `<b>${esc(r.prov.n)}</b>${r.prov.near ? ' (nearest outline)' : ''}`]);
      if (r.range) R.push(['Nearest named range', `${esc(r.range.n)}, ${miles(r.range.km)} ${r.range.dir}`]);
      if (r.low) R.push([r.low.k === 'desert' ? 'Nearest named desert or basin' : 'Nearest named valley', `${esc(r.low.n)}, ${miles(r.low.km)} ${r.low.dir}`]);
      if (r.peak) R.push(['Nearest named peak', `${esc(r.peak.n)}${isN(r.peak.m) ? ', ' + N0(r.peak.m * FT) + ' ft' : ''}, ${miles(r.peak.km)} ${r.peak.dir}`]);
      if (r.pass) R.push(['Pass nearby', `${esc(r.pass.n)}${isN(r.pass.m) ? ', ' + N0(r.pass.m * FT) + ' ft' : ''}, ${miles(r.pass.km)} ${r.pass.dir}`]);
      if (r.coast != null) R.push(['Coast or bay shore', r.coast < 0.15 ? 'at the shore' : miles(r.coast) + ' away']);
      let h = R.map(([k, v]) => `<div class="rowl"><span>${k}</span><span class="sc-topo-v">${v}</span></div>`).join('');
      const L = [];
      if (r.slope != null) L.push(`<b>Access</b>: ${esc(SLOPE_NOTE[slopeClass(r.slope)[1]])}.`);
      if (r.pos) L.push(`<b>Exposure</b> (a judgment from the shape of the land, not a wind measurement): ${esc(POS_TXT[r.pos](r.tpi))}`);
      if (EXTRA && EXTRA.lines) { try { EXTRA.lines(r).forEach(x => L.push(x)); } catch (e) { } }
      if (L.length) h += `<ul class="sc-ev sc-topo-ul">${L.map(x => `<li>${x}</li>`).join('')}</ul>`;
      h += `<p class="sc-note">Heights: ${approx ? 'the statewide grid carried in this file (AWS Terrain Tiles averaged to about 1 km)' : 'AWS Terrain Tiles, zoom 14, over the USGS 10 m model; a sharp summit reads a few metres low'} ${G('B')}. Slope across 30 m each way. Province: California Geological Survey ${G('A')}. Names: USGS GNIS points (a range's point is its highest part, a valley's the middle of its length), so "nearest" is by that point ${G('B')}.</p>`;
      return h;
    }
    let cardSeq = 0;
    function card(sel, b, dt) {
      if (!dt || !sel || sel.type === 'zip') return;
      const pt = b ? { la: b.lat, lo: b.lon } : (sel.type === 'pt' ? { la: sel.lat, lo: sel.lon } : null); if (!pt || !isN(pt.la) || !isN(pt.lo)) return;
      const old = dt.querySelector('.sc-topo-sec'); if (old) old.remove();
      const sec = document.createElement('div'); sec.className = 'sc-sec sc-topo-sec';
      const draw = r => { sec.innerHTML = `<p class="sc-k">The ground it stands on</p>${rows(r)}`; };
      if (b && b.topo && b.topo.src === 'tiles') draw(b.topo); else sec.innerHTML = '<p class="sc-k">The ground it stands on</p><p class="sc-note">Reading the terrain…</p>';
      const anchor = dt.querySelector('.sc-check') || dt.querySelector('.sc-acts'); if (anchor && anchor.parentNode === dt) dt.insertBefore(sec, anchor); else dt.appendChild(sec);
      if (b && b.topo && b.topo.src === 'tiles') return;
      const my = ++cardSeq;
      siteAt(pt.la, pt.lo, ctxOf(pt.la, pt.lo, b && b.zip)).then(r => { if (b) b.topo = r; if (my === cardSeq && sec.isConnected) draw(r); }, () => { if (my === cardSeq && sec.isConnected) sec.innerHTML = '<p class="sc-k">The ground it stands on</p><p class="sc-note">The terrain could not be read here.</p>'; });
    }

    /* ---------- the CSV ---------- */
    const CSV_COLS = ['ground_elev_ft', 'ground_elev_m', 'elev_source', 'site_slope_pct', 'site_aspect', 'terrain_position', 'province', 'nearest_range', 'nearest_range_mi', 'nearest_valley_or_desert', 'nearest_peak', 'nearest_peak_ft', 'nearest_peak_mi', 'coast_mi'].concat(EXTRA && EXTRA.csvCols ? EXTRA.csvCols : []);
    const mi1 = km => km == null ? '' : +(km / 1.609344).toFixed(1);
    function csvRow(b) {
      let r = b.topo && b.topo.src === 'tiles' ? b.topo : null;
      if (!r && isN(b.lat) && isN(b.lon)) { r = describe(readSite(b.lat, b.lon), ctxOf(b.lat, b.lon, b.zip)); if (r.src === 'tiles') b.topo = r; }
      if (!r || r.elev == null) return CSV_COLS.map(() => '');
      return [Math.round(r.elev * FT), +r.elev.toFixed(1), r.src === 'tiles' ? 'terrain tiles z14' : 'statewide grid 1 km', r.slope == null ? '' : +r.slope.toFixed(1), r.aspect == null ? (r.slope == null ? '' : 'level') : compass(r.aspect), r.pos ? { ridge: 'ridge or knoll', hollow: 'hollow or valley floor', slope: 'open slope', flat: 'even ground' }[r.pos] : '', r.prov ? r.prov.n : '', r.range ? r.range.n : '', r.range ? mi1(r.range.km) : '', r.low ? r.low.n : '', r.peak ? r.peak.n : '', r.peak && isN(r.peak.m) ? Math.round(r.peak.m * FT) : '', r.peak ? mi1(r.peak.km) : '', mi1(r.coast)].concat(EXTRA && EXTRA.csvRow ? EXTRA.csvRow(r) : []);
    }
    function csv(header, rws, bs) { try { if (!Array.isArray(bs) || bs.length !== rws.length) return [header, rws]; return [header.concat(CSV_COLS), rws.map((row, i) => row.concat(csvRow(bs[i])))]; } catch (e) { return [header, rws]; } }
    const csvNote = 'Terrain columns: ground elevation from AWS Terrain Tiles (zoom 14, over the USGS 10 m model) or, where a tile was not in hand, from the statewide 1 km grid (see elev_source); site slope and aspect across 30 m each way; terrain_position compares the point with the ground 300 m around it; province from the California Geological Survey; nearest range, valley, desert and peak by their USGS GNIS points; coast_mi to the Natural Earth coast line (ocean or bay shore).' + (EXTRA && EXTRA.csvNote ? ' ' + EXTRA.csvNote : '') + '\n';
    /* before an export: the terrain tiles under the view, so every row reads from them (gives up after 6 s) */
    function ready() {
      if (map.getZoom() < 13) return Promise.resolve();
      const b = map.getBounds(), ps = [];
      [[14, 60], [12, 320]].forEach(([z, pad]) => { const m = mpp(b.getCenter().lat, z), x0 = Math.floor((wpx(b.getWest(), z) - pad / m) / 256), x1 = Math.floor((wpx(b.getEast(), z) + pad / m) / 256), y0 = Math.floor((wpy(b.getNorth(), z) - pad / m) / 256), y1 = Math.floor((wpy(b.getSouth(), z) + pad / m) / 256); if ((x1 - x0 + 1) * (y1 - y0 + 1) <= 30) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) ps.push(loadTile(z, x, y)); });
      return Promise.race([Promise.all(ps).then(loadGrid), new Promise(r => setTimeout(r, 6000))]);
    }

    const api = { card, csv, csvNote, ready, siteAt: (la, lo) => siteAt(la, lo, ctxOf(la, lo)), eleAt, gridAt, provinceAt, nearest, stateView, map, LF, root, G, labels,
      set: s => { Object.assign(st, s || {}); save(); if (box) { box.querySelector('#scTopoMode').value = st.mode; box.querySelector('#scTopoOp').value = st.op; box.querySelector('#scTopoCon').checked = !!st.contours; box.querySelector('#scTopoNm').checked = !!st.names; box.querySelector('#scTopoPv').checked = !!st.prov; } setLayers(); labels(); },
      state: () => ({ st: Object.assign({}, st), tiles: tiles.size, ok: tileOk, err: tileErr, pending: [...tiles.values()].filter(e => e.pending).length, grid: !!mips[0], gridFail, prov: PROV.length, gaz: GAZ.length, labels: gLab.getLayers().length }) };
    window.__SCOUT_TOPO__.api = api;                                    /* for tests and the browser console */
    setLayers(); labelsSoon();
    if (EXTRA && EXTRA.init) { try { EXTRA.init(api, { loadTile, sampleCached, ensure, mpp, wpx, wpy, distM, ftm, miles, esc, N0, FT, PROV, GAZ, HYPSO, loadGrid }); } catch (e) { } }
    return api;
  }
  window.__SCOUT_TOPO__ = { init, eleAt, loadGrid, gridAt: (la, lo) => gridAt(la, lo), provinceAt };
})();
