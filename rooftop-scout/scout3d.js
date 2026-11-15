/* ==== rooftop scout: the 3D street view ==== */
/* A street level model of the neighborhood, built in the browser from open data, with no key: every building is its FEMA
   footprint raised to its height (a hipped roof on houses, a flat one on the rest), its roof and the ground under it are
   Esri's satellite and aerial imagery, and every street, alley and service drive from OpenStreetMap (the Census TIGER file
   where OpenStreetMap does not answer) is a path the camera walks. Because the page draws the scene itself, it always knows
   where the camera stands and looks, so the green, orange and red glows sit exactly on the buildings.
   It walks at eye level street by street and alley by alley, or rises to drone and bird height for the roofs.
   window.__SCOUT_3D__(THREE, host, env) builds the view in host and returns its controls. env supplies the data (buildings,
   roads, imagery tiles) and hears what happens (hover, pick, a request to stand in front of a building, moves). Three.js
   r149 is carried inline beside it and kept private (window.__SCOUT_THREE__). */
(function () {
  'use strict';
  window.__SCOUT_3D__ = function create3D(THREE, host, env) {
    if (!THREE || !host) return null;
    const R = d => d * Math.PI / 180, DG = r => r * 180 / Math.PI, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }); } catch (e) { return null; }
    if (!renderer || !renderer.getContext()) return null;
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.outputEncoding = THREE.sRGBEncoding;
    const cv = renderer.domElement; cv.className = 'sc-3dc'; cv.tabIndex = 0; cv.setAttribute('aria-label', 'Street level 3D view. Drag to look around, W and S or the arrow keys to walk the street, A and D to turn, click a building to read it.');
    host.appendChild(cv);
    const SKY = 0xcfe1ef, scene = new THREE.Scene(); scene.background = new THREE.Color(SKY); scene.fog = new THREE.Fog(SKY, 260, 1100);
    const camera = new THREE.PerspectiveCamera(65, 1, 0.3, 5000);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8d8775, 0.8));
    const sun = new THREE.DirectionalLight(0xffffff, 0.55); sun.position.set(-180, 300, 140); scene.add(sun);
    const G = { ground: new THREE.Group(), roads: new THREE.Group(), bld: new THREE.Group(), sel: new THREE.Group(), labels: new THREE.Group() };
    Object.values(G).forEach(g => scene.add(g));

    /* ---------- state ---------- */
    const S = { ok: false, gen: 0, lat0: 0, lon0: 0, kx: 1, ky: 1, x: 0, z: 0, yaw: 0, pitch: 0, fov: 65, mode: 'street', eye: 1.7, roads: [], graph: [], on: null, img: null, cur: null, hov: null, owners: { wall: [], roof: [] }, meshes: [], labels: [], keys: {}, tween: null, running: false, needs: true, last: 0, built: 0, note: '' };
    const HEIGHT = { street: { eye: 1.7, pitch: 2 }, drone: { eye: 38, pitch: -32 }, bird: { eye: 120, pitch: -58 } };
    const RADIUS = 250, REBUILD = 170;     /* buildings drawn within 250 m of the scene's centre; past 170 m of walking the scene is rebuilt around the camera */
    const mLat = la => 111132.92 - 559.82 * Math.cos(2 * R(la)) + 1.175 * Math.cos(4 * R(la)), mLon = la => 111412.84 * Math.cos(R(la)) - 93.5 * Math.cos(3 * R(la));
    const toL = (la, lo) => [(lo - S.lon0) * S.kx, -(la - S.lat0) * S.ky];          /* [x east, z south] in meters; north is -z */
    const toLL = (x, z) => [S.lat0 - z / S.ky, S.lon0 + x / S.kx];
    const lon2t = (lo, z) => (lo + 180) / 360 * Math.pow(2, z), lat2t = (la, z) => { const r = R(la); return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * Math.pow(2, z); };
    const t2lon = (x, z) => x / Math.pow(2, z) * 360 - 180, t2lat = (y, z) => DG(Math.atan(Math.sinh(Math.PI * (1 - 2 * y / Math.pow(2, z)))));
    const need = () => { S.needs = true; if (S.running && !S.raf) S.raf = requestAnimationFrame(frame); };
    const note = t => { S.note = t; if (env.onNote) env.onNote(t); };

    /* ---------- imagery: Esri tiles composed into one canvas per ring, refreshed as tiles arrive ---------- */
    const dirty = new Set(); let dirtyT = 0;
    const dirtyTex = t => { dirty.add(t); if (!dirtyT) dirtyT = setTimeout(() => { dirtyT = 0; dirty.forEach(x => { x.needsUpdate = true; }); dirty.clear(); need(); }, 250); };
    function imagery(z, n, fill) {
      const c = document.createElement('canvas'); c.width = c.height = n * 256; const g = c.getContext('2d'); g.fillStyle = fill; g.fillRect(0, 0, c.width, c.height);
      const tex = new THREE.CanvasTexture(c); tex.encoding = THREE.sRGBEncoding; tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      const x0 = Math.floor(lon2t(S.lon0, z)) - Math.floor(n / 2), y0 = Math.floor(lat2t(S.lat0, z)) - Math.floor(n / 2), gen = S.gen;
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const im = new Image(); im.crossOrigin = 'anonymous'; im.decoding = 'async';
        im.onload = () => { if (S.gen !== gen) return; g.drawImage(im, i * 256, j * 256); dirtyTex(tex); };
        im.src = env.tileURL(z, x0 + i, y0 + j);
      }
      const W = (t2lon(x0, z) - S.lon0) * S.kx, E = (t2lon(x0 + n, z) - S.lon0) * S.kx, N = (t2lat(y0, z) - S.lat0) * S.ky, So = (t2lat(y0 + n, z) - S.lat0) * S.ky;
      return { tex, xW: W, xE: E, nN: N, nS: So };
    }
    function groundPlane(img, y) {
      const geo = new THREE.PlaneGeometry(img.xE - img.xW, img.nN - img.nS); geo.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: img.tex })); m.position.set((img.xW + img.xE) / 2, y, -(img.nS + img.nN) / 2); return m;
    }
    /* a wall texture: a window module every 4 m along a wall and 3 m up it, multiplied by the building's colour */
    const facade = (() => {
      const c = document.createElement('canvas'); c.width = 128; c.height = 96; const g = c.getContext('2d');
      g.fillStyle = '#f4f1ea'; g.fillRect(0, 0, 128, 96); g.fillStyle = '#e9e4d8'; g.fillRect(0, 88, 128, 8);
      g.fillStyle = '#5b6873'; g.fillRect(42, 28, 44, 40); g.fillStyle = '#7d8c97'; g.fillRect(45, 31, 38, 34); g.fillStyle = '#e9e4d8'; g.fillRect(62, 31, 3, 34); g.fillRect(45, 47, 38, 3);
      const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t;
    })();

    /* ---------- buildings: one merged mesh for walls, one for roofs, one for edges, three glow shells ---------- */
    const mats = {
      wall: new THREE.MeshLambertMaterial({ map: facade, vertexColors: true, side: THREE.DoubleSide }),
      roof: new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }),
      edge: new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95 }),
      selEdge: new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, depthTest: false }),
      hovEdge: new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }),
    };
    const glowMat = hex => new THREE.MeshBasicMaterial({ color: new THREE.Color(hex), transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide });
    const hexMix = (a, b, t) => { const A = new THREE.Color(a), B = new THREE.Color(b); return A.lerp(B, t); };
    function ringsOf(b) {
      const out = [];
      (b.rings || []).forEach(r => {
        let P = r.map(([la, lo]) => toL(la, lo)); if (P.length > 1) { const a = P[0], z = P[P.length - 1]; if (Math.abs(a[0] - z[0]) < 1e-6 && Math.abs(a[1] - z[1]) < 1e-6) P = P.slice(0, -1); }
        if (P.length < 3) return; let area = 0; for (let i = 0, j = P.length - 1; i < P.length; j = i++) area += (P[j][0] * -P[i][1]) - (P[i][0] * -P[j][1]);   /* signed area in x, north */
        if (Math.abs(area) < 2) return; if (area < 0) P.reverse(); out.push(P);
      });
      return out;
    }
    function buildBuildings() {
      [G.bld, G.sel].forEach(g => { g.children.slice().forEach(o => { g.remove(o); if (o.geometry) o.geometry.dispose(); if (o.material && !Object.values(mats).includes(o.material)) o.material.dispose(); }); });
      if (!S.img) return;
      const img = S.img, W = [], WN = [], WU = [], WC = [], Rf = [], RN = [], RU = [], RC = [], E = [], EC = [], glow = {}, ownW = [], ownR = [];
      const roofUV = (x, z) => [(x - img.xW) / (img.xE - img.xW), (-z - img.nS) / (img.nN - img.nS)];
      const push3 = (arr, a) => { arr.push(a[0], a[1], a[2]); };
      let n = 0;
      env.buildings().forEach(b => {
        const [cx, cz] = toL(b.lat, b.lon); if (Math.hypot(cx - S.x, cz - S.z) > RADIUS + 30 || Math.hypot(cx, cz) > RADIUS + 40) return;
        const rings = ringsOf(b); if (!rings.length) return; n++;
        const h = Math.max(2.4, env.height(b)), flat = env.flat(b), eave = flat ? h : Math.max(2.6, h * 0.6), col = env.color(b);
        const wc = hexMix('#c9c1b2', col, 0.5), rc = hexMix('#ffffff', col, 0.22), ec = new THREE.Color(col), gl = glow[col] = glow[col] || [];
        rings.forEach(P => {
          let along = 0; const cxr = P.reduce((s, p) => s + p[0], 0) / P.length, czr = P.reduce((s, p) => s + p[1], 0) / P.length;
          for (let i = 0; i < P.length; i++) {
            const a = P[i], c = P[(i + 1) % P.length], dx = c[0] - a[0], dz = c[1] - a[1], len = Math.hypot(dx, dz); if (len < 0.05) continue;
            const nx = -dz / len, nz = dx / len, u0 = along / 4, u1 = (along + len) / 4, v1 = eave / 3; along += len;   /* outward normal for a ring counter clockwise in x, north */
            const q = [[a[0], 0, a[1]], [c[0], 0, c[1]], [c[0], eave, c[1]], [a[0], eave, a[1]]], uv = [[u0, 0], [u1, 0], [u1, v1], [u0, v1]];
            [0, 1, 2, 0, 2, 3].forEach(k => { push3(W, q[k]); WN.push(nx, 0, nz); WU.push(uv[k][0], uv[k][1]); WC.push(wc.r, wc.g, wc.b); });
            ownW.push(b.id, b.id);
            E.push(a[0], 0, a[1], a[0], eave, a[1], a[0], eave, a[1], c[0], eave, c[1]); for (let k = 0; k < 4; k++) EC.push(ec.r, ec.g, ec.b);
            /* the glow shell: the wall pushed out 0.8 m and up past the roof */
            const ga = [a[0] + (a[0] - cxr) * 0.04 + nx * 0.5, a[1] + (a[1] - czr) * 0.04 + nz * 0.5], gc = [c[0] + (c[0] - cxr) * 0.04 + nx * 0.5, c[1] + (c[1] - czr) * 0.04 + nz * 0.5], top = flat ? h + 0.5 : eave + 0.35;
            [[ga[0], 0, ga[1]], [gc[0], 0, gc[1]], [gc[0], top, gc[1]], [ga[0], 0, ga[1]], [gc[0], top, gc[1]], [ga[0], top, ga[1]]].forEach(p => push3(gl, p));
          }
          /* the roof: flat, or hipped toward a ridge area at the building's height; its picture is the aerial image of that roof */
          const addTri = (p, q, r, nrm) => { [p, q, r].forEach(v => { push3(Rf, v); RN.push(nrm[0], nrm[1], nrm[2]); const t = roofUV(v[0], v[2]); RU.push(t[0], t[1]); RC.push(rc.r, rc.g, rc.b); }); ownR.push(b.id); };
          const capAt = (Q, y) => { let tris = []; try { tris = THREE.ShapeUtils.triangulateShape(Q.map(p => new THREE.Vector2(p[0], -p[1])), []); } catch (e) { tris = []; } tris.forEach(t => addTri([Q[t[0]][0], y, Q[t[0]][1]], [Q[t[1]][0], y, Q[t[1]][1]], [Q[t[2]][0], y, Q[t[2]][1]], [0, 1, 0])); };
          if (flat) { capAt(P, h); for (let i = 0; i < P.length; i++) { const a = P[i], c = P[(i + 1) % P.length]; E.push(a[0], h, a[1], c[0], h, c[1]); EC.push(ec.r, ec.g, ec.b, ec.r, ec.g, ec.b); } }
          else {
            const k = 0.42, Q = P.map(p => [cxr + (p[0] - cxr) * k, czr + (p[1] - czr) * k]);
            for (let i = 0; i < P.length; i++) {
              const j = (i + 1) % P.length, a = [P[i][0], eave, P[i][1]], c = [P[j][0], eave, P[j][1]], d = [Q[j][0], h, Q[j][1]], e = [Q[i][0], h, Q[i][1]];
              const u = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], v = [e[0] - a[0], e[1] - a[1], e[2] - a[2]]; let nr = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; const l = Math.hypot(nr[0], nr[1], nr[2]) || 1; nr = nr.map(x => x / l); if (nr[1] < 0) nr = nr.map(x => -x);
              addTri(a, c, d, nr); addTri(a, d, e, nr);
              E.push(e[0], e[1], e[2], d[0], d[1], d[2], a[0], a[1], a[2], e[0], e[1], e[2]); for (let m = 0; m < 4; m++) EC.push(ec.r, ec.g, ec.b);
            }
            capAt(Q, h);
          }
        });
      });
      const mesh = (pos, nrm, uv, col, mat) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); if (nrm) g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); if (uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); if (col) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeBoundingSphere(); return new THREE.Mesh(g, mat); };
      if (W.length) { const m = mesh(W, WN, WU, WC, mats.wall); m.name = 'walls'; G.bld.add(m); }
      if (Rf.length) { mats.roof.map = img.tex; mats.roof.needsUpdate = true; const m = mesh(Rf, RN, RU, RC, mats.roof); m.name = 'roofs'; G.bld.add(m); }
      if (E.length) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(E, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(EC, 3)); G.bld.add(new THREE.LineSegments(g, mats.edge)); }
      Object.entries(glow).forEach(([hex, pos]) => { if (!pos.length) return; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); const m = new THREE.Mesh(g, glowMat(hex)); m.renderOrder = 2; G.bld.add(m); });
      S.owners = { wall: ownW, roof: ownR }; S.built = n;
      highlight(); labels(); need();
    }
    /* the current building gets a white outline seen through everything, and a stronger glow; the one pointed at, a white outline */
    function outlineOf(b, mat, lift) {
      const rings = ringsOf(b); if (!rings.length) return null; const h = Math.max(2.4, env.height(b)), flat = env.flat(b), eave = flat ? h : Math.max(2.6, h * 0.6), E = [];
      rings.forEach(P => { const cx = P.reduce((s, p) => s + p[0], 0) / P.length, cz = P.reduce((s, p) => s + p[1], 0) / P.length, Q = flat ? P : P.map(p => [cx + (p[0] - cx) * 0.42, cz + (p[1] - cz) * 0.42]);
        for (let i = 0; i < P.length; i++) { const j = (i + 1) % P.length; E.push(P[i][0], lift, P[i][1], P[j][0], lift, P[j][1], P[i][0], lift, P[i][1], P[i][0], eave, P[i][1], P[i][0], eave, P[i][1], P[j][0], eave, P[j][1], P[i][0], eave, P[i][1], Q[i][0], h, Q[i][1], Q[i][0], h, Q[i][1], Q[j][0], h, Q[j][1]); } });
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(E, 3)); return new THREE.LineSegments(g, mat);
    }
    function highlight() {
      G.sel.children.slice().forEach(o => { G.sel.remove(o); if (o.geometry) o.geometry.dispose(); if (o.material && !Object.values(mats).includes(o.material)) o.material.dispose(); });
      const cur = S.cur && env.byId(S.cur), hov = S.hov && S.hov !== S.cur && env.byId(S.hov);
      if (cur) { const o = outlineOf(cur, mats.selEdge, 0.05); if (o) { o.renderOrder = 5; G.sel.add(o); }
        const rings = ringsOf(cur), hc = Math.max(2.4, env.height(cur)), h = (env.flat(cur) ? hc : Math.max(2.6, hc * 0.6)) + 0.9, pos = [];
        rings.forEach(P => { const cx = P.reduce((s, p) => s + p[0], 0) / P.length, cz = P.reduce((s, p) => s + p[1], 0) / P.length; for (let i = 0; i < P.length; i++) { const j = (i + 1) % P.length, a = [cx + (P[i][0] - cx) * 1.08, cz + (P[i][1] - cz) * 1.08], c = [cx + (P[j][0] - cx) * 1.08, cz + (P[j][1] - cz) * 1.08]; pos.push(a[0], 0, a[1], c[0], 0, c[1], c[0], h, c[1], a[0], 0, a[1], c[0], h, c[1], a[0], h, a[1]); } });
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); const m = new THREE.Mesh(g, glowMat(env.color(cur))); m.material.opacity = 0.26; m.renderOrder = 3; G.sel.add(m); }
      if (hov) { const o = outlineOf(hov, mats.hovEdge, 0.05); if (o) G.sel.add(o); }
      need();
    }

    /* ---------- labels over the buildings near the camera, and the street names ---------- */
    const labelCache = new Map();
    function labelSprite(text, bg, fg, ring, occlude) {
      const key = text + bg + fg + (ring ? 1 : 0) + (occlude ? 1 : 0); let m = labelCache.get(key);
      if (!m) {
        const c = document.createElement('canvas'), g = c.getContext('2d'), fs = 34; g.font = `600 ${fs}px "IBM Plex Sans", system-ui, sans-serif`; const w = Math.ceil(g.measureText(text).width) + 36; c.width = w; c.height = 58;
        g.font = `600 ${fs}px "IBM Plex Sans", system-ui, sans-serif`; g.fillStyle = bg; const r = 26; g.beginPath(); g.moveTo(r, 3); g.arcTo(w - 3, 3, w - 3, 55, r); g.arcTo(w - 3, 55, 3, 55, r); g.arcTo(3, 55, 3, 3, r); g.arcTo(3, 3, w - 3, 3, r); g.closePath(); g.fill();
        if (ring) { g.lineWidth = 5; g.strokeStyle = '#ffffff'; g.stroke(); } g.fillStyle = fg; g.textBaseline = 'middle'; g.fillText(text, 18, 30);
        const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; m = { mat: new THREE.SpriteMaterial({ map: t, depthTest: !!occlude, depthWrite: false, transparent: true }), aspect: w / 58 }; labelCache.set(key, m);
        if (labelCache.size > 400) { const k0 = labelCache.keys().next().value, o = labelCache.get(k0); o.mat.map.dispose(); o.mat.dispose(); labelCache.delete(k0); }
      }
      const s = new THREE.Sprite(m.mat); s.userData.aspect = m.aspect; s.renderOrder = 10; return s;
    }
    function labels() {
      G.labels.children.slice().forEach(o => G.labels.remove(o)); S.labels = [];
      const near = env.buildings().map(b => { const [x, z] = toL(b.lat, b.lon); return { b, x, z, d: Math.hypot(x - S.x, z - S.z) }; }).filter(o => o.d < 110 || o.b.id === S.cur).sort((a, b) => a.d - b.d).slice(0, 22);
      near.forEach(o => { const b = o.b, s = labelSprite(env.label(b), env.color(b), env.labelInk(b), b.id === S.cur, b.id !== S.cur); s.position.set(o.x, Math.max(2.4, env.height(b)) + 2.6, o.z); s.userData.kind = 'b'; G.labels.add(s); S.labels.push(s); });
      const named = new Map(); S.roads.forEach(r => { if (!r.name || r.kind === 'path' || r.kind === 'drive') return; let best = null; r.pts.forEach(p => { const d = Math.hypot(p[0] - S.x, p[1] - S.z); if (!best || d < best.d) best = { d, p }; }); if (best && best.d < 240) { const o = named.get(r.name); if (!o || best.d < o.d) named.set(r.name, best); } });
      [...named.entries()].sort((a, b) => a[1].d - b[1].d).slice(0, 16).forEach(([name, o]) => { const s = labelSprite(name, 'rgba(16,25,31,.78)', '#ffffff', false, true); s.position.set(o.p[0], 2.2, o.p[1]); s.userData.kind = 'r'; G.labels.add(s); S.labels.push(s); });
      need();
    }

    /* ---------- streets and alleys: drawn on the ground, and the paths the camera walks ---------- */
    const roadMat = { street: new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 }), major: new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.75 }), alley: new THREE.LineBasicMaterial({ color: 0xffc46b, transparent: true, opacity: 0.8 }), service: new THREE.LineBasicMaterial({ color: 0xdfe6ea, transparent: true, opacity: 0.55 }), drive: new THREE.LineBasicMaterial({ color: 0xdfe6ea, transparent: true, opacity: 0.3 }), path: new THREE.LineBasicMaterial({ color: 0xb6f0c4, transparent: true, opacity: 0.4 }) };
    const WALK = new Set(['street', 'major', 'alley', 'service']);
    function setRoads(list) {
      G.roads.children.slice().forEach(o => { G.roads.remove(o); o.geometry.dispose(); });
      S.roads = list.map(r => ({ name: r.name || '', kind: r.kind, pts: r.pts.map(([la, lo]) => toL(la, lo)) })).filter(r => r.pts.length >= 2);
      const by = {}; S.roads.forEach(r => { const a = by[r.kind] = by[r.kind] || []; for (let i = 0; i + 1 < r.pts.length; i++) a.push(r.pts[i][0], 0.16, r.pts[i][1], r.pts[i + 1][0], 0.16, r.pts[i + 1][1]); });
      Object.entries(by).forEach(([k, a]) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(a, 3)); G.roads.add(new THREE.LineSegments(g, roadMat[k] || roadMat.street)); });
      S.graph = S.roads.filter(r => WALK.has(r.kind)); S.on = null; labels(); need();
    }
    function nearestOnRoads(x, z, maxD) {
      let best = null;
      S.graph.forEach((r, ri) => { for (let i = 0; i + 1 < r.pts.length; i++) { const a = r.pts[i], b = r.pts[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz; let t = L2 ? ((x - a[0]) * dx + (z - a[1]) * dz) / L2 : 0; t = clamp(t, 0, 1); const px = a[0] + t * dx, pz = a[1] + t * dz, d = Math.hypot(px - x, pz - z); if (!best || d < best.d) best = { ri, si: i, t, x: px, z: pz, d }; } });
      return best && best.d <= (maxD || 1e9) ? best : null;
    }
    const roadAt = () => { const o = S.on || nearestOnRoads(S.x, S.z, 25); return o ? S.graph[o.ri] : null; };
    /* walking: along the street the camera stands on, in the direction nearest where it looks; at a street's end, onto the
       connecting street that best keeps that direction (a turn at a corner is made by looking down the new street) */
    function walk(dist) {
      if (S.mode !== 'street' || !S.graph.length) { S.x += Math.sin(R(S.yaw)) * dist; S.z -= Math.cos(R(S.yaw)) * dist; after(); return; }
      let o = S.on || nearestOnRoads(S.x, S.z, 40); if (!o) { S.x += Math.sin(R(S.yaw)) * dist; S.z -= Math.cos(R(S.yaw)) * dist; after(); return; }
      const sgn = dist >= 0 ? 1 : -1; let rem = Math.abs(dist), guard = 0; const hx = Math.sin(R(S.yaw)) * sgn, hz = -Math.cos(R(S.yaw)) * sgn;
      /* a turn at a crossing: when the view looks down another way that passes within 6 m, step onto it */
      { const r0 = S.graph[o.ri], a0 = r0.pts[o.si], b0 = r0.pts[o.si + 1], l0 = Math.hypot(b0[0] - a0[0], b0[1] - a0[1]) || 1, cur = Math.abs(((b0[0] - a0[0]) * hx + (b0[1] - a0[1]) * hz) / l0);
        if (cur < 0.8) { let best = null; S.graph.forEach((r, ri) => { if (ri === o.ri) return; for (let i = 0; i + 1 < r.pts.length; i++) { const a = r.pts[i], b = r.pts[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz; if (!L2) continue; const t = clamp(((S.x - a[0]) * dx + (S.z - a[1]) * dz) / L2, 0, 1), px = a[0] + t * dx, pz = a[1] + t * dz, d = Math.hypot(px - S.x, pz - S.z); if (d > 6) continue; const al = Math.abs((dx * hx + dz * hz) / Math.sqrt(L2)); if (al > cur + 0.25 && al > 0.7 && (!best || al - d * 0.02 > best.s)) best = { s: al - d * 0.02, ri, si: i, t }; } });
          if (best) o = { ri: best.ri, si: best.si, t: best.t }; } }
      let dir = 0;
      while (rem > 1e-6 && guard++ < 200) {
        const r = S.graph[o.ri], a = r.pts[o.si], b = r.pts[o.si + 1], dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz) || 1e-6;
        if (!dir) dir = (dx * hx + dz * hz) >= 0 ? 1 : -1;
        const room = dir > 0 ? (1 - o.t) * len : o.t * len;
        if (rem <= room) { o.t += dir * rem / len; rem = 0; break; }
        rem -= room; o.t = dir > 0 ? 1 : 0;
        if (dir > 0 && o.si + 1 < r.pts.length - 1) { o.si++; o.t = 0; continue; }
        if (dir < 0 && o.si > 0) { o.si--; o.t = 1; continue; }
        /* the end of this way: carry on along the best aligned way that meets it */
        const end = dir > 0 ? b : a, tx = dir > 0 ? dx / len : -dx / len, tz = dir > 0 ? dz / len : -dz / len; let next = null;
        S.graph.forEach((q, qi) => { if (qi === o.ri) return; q.pts.forEach((p, pi) => { if (Math.hypot(p[0] - end[0], p[1] - end[1]) > 4) return;
          [[pi, 1], [pi, -1]].forEach(([k, dd]) => { const k2 = k + dd; if (k2 < 0 || k2 >= q.pts.length) return; const ex = q.pts[k2][0] - p[0], ez = q.pts[k2][1] - p[1], el = Math.hypot(ex, ez) || 1; const al = (ex * tx + ez * tz) / el * 0.5 + (ex * hx + ez * hz) / el * 0.5;
            if (al > 0.25 && (!next || al > next.al)) next = { al, ri: qi, si: dd > 0 ? k : k2, t: dd > 0 ? 0 : 1, d: dd }; }); }); });
        if (!next) break;
        o = { ri: next.ri, si: next.si, t: next.t }; dir = next.d;
      }
      const r = S.graph[o.ri], a = r.pts[o.si], b = r.pts[o.si + 1]; S.x = a[0] + (b[0] - a[0]) * o.t; S.z = a[1] + (b[1] - a[1]) * o.t; S.on = o;
      /* walking forward turns the view to follow the street, the way a car does */
      if (sgn > 0 && dir) { const ty = DG(Math.atan2((b[0] - a[0]) * dir, -(b[1] - a[1]) * dir)); let dy = ((ty - S.yaw + 540) % 360) - 180; if (Math.abs(dy) < 70) S.yaw = (S.yaw + dy * 0.35 + 360) % 360; }
      after();
    }
    function after() { need(); if (env.onMove) env.onMove(state()); if (Math.hypot(S.x, S.z) > REBUILD) { const [la, lo] = toLL(S.x, S.z); recenter(la, lo); } else if (S.labelsAt && Math.hypot(S.x - S.labelsAt[0], S.z - S.labelsAt[1]) > 25) { S.labelsAt = [S.x, S.z]; labels(); } }

    /* ---------- building the scene around a point ---------- */
    async function recenter(la, lo, keep) {
      const keepLL = keep || toLL(S.x, S.z);
      S.gen++; const gen = S.gen; S.lat0 = la; S.lon0 = lo; S.ky = mLat(la); S.kx = mLon(la);
      [S.x, S.z] = toL(keepLL[0], keepLL[1]); S.on = null; S.labelsAt = [S.x, S.z];
      G.ground.children.slice().forEach(o => { G.ground.remove(o); o.geometry.dispose(); if (o.material.map) o.material.map.dispose(); o.material.dispose(); });
      const inner = imagery(19, 8, '#6f7764'), outer = imagery(17, 8, '#77806b'); S.img = inner;
      G.ground.add(groundPlane(outer, -0.06)); G.ground.add(groundPlane(inner, 0));
      buildBuildings(); setRoads([]); note('Loading the streets and alleys…');
      if (env.ensure) env.ensure(la, lo, RADIUS + 60);
      try { const list = await env.roads(la, lo, RADIUS + 150); if (gen !== S.gen) return; setRoads(list); note(list.source || ''); if (S.mode === 'street') { const o = nearestOnRoads(S.x, S.z, 45); if (o) { S.on = o; S.x = o.x; S.z = o.z; } } }
      catch (e) { if (gen === S.gen) note('The streets did not load: ' + (e && e.message || e) + '. The view still walks freely.'); }
      need(); if (env.onMove) env.onMove(state());
    }

    /* ---------- the camera, the loop and the pointer ---------- */
    function placeCamera() {
      const eye = HEIGHT[S.mode].eye, p = R(S.pitch), y = R(S.yaw);
      camera.position.set(S.x, eye, S.z); camera.lookAt(S.x + Math.sin(y) * Math.cos(p) * 10, eye + Math.sin(p) * 10, S.z - Math.cos(y) * Math.cos(p) * 10);
      if (camera.fov !== S.fov) { camera.fov = S.fov; camera.updateProjectionMatrix(); }
      S.labels.forEach(s => { const d = s.position.distanceTo(camera.position), k = clamp(d * (s.userData.kind === 'r' ? 0.03 : 0.042), 0.55, s.userData.kind === 'r' ? 9 : 14); s.scale.set(k * s.userData.aspect, k, 1); s.visible = d < (s.userData.kind === 'r' ? 300 : 160); });
    }
    function resize() { const w = host.clientWidth || 1, h = host.clientHeight || 1; renderer.setSize(w, h, false); cv.style.width = w + 'px'; cv.style.height = h + 'px'; camera.aspect = w / h; camera.updateProjectionMatrix(); need(); }
    function frame(t) {
      S.raf = 0; const dt = Math.min(1, S.last ? (t - S.last) / 1000 : 0.016);   /* real time, so a slow machine walks at the same pace in fewer frames */ S.last = t; let moving = false;
      const k = S.keys, sp = S.mode === 'street' ? 7 : S.mode === 'drone' ? 18 : 45;
      if (k.fwd || k.back) { walk((k.fwd ? 1 : -1) * sp * dt); moving = true; }
      if (k.left || k.right) { S.yaw = (S.yaw + (k.right ? 1 : -1) * 75 * dt + 360) % 360; moving = true; need(); if (env.onMove) env.onMove(state()); }
      if (S.tween) { const w = S.tween, u = Math.min(1, (t - w.t0) / w.ms), e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
        S.x = w.x0 + (w.x1 - w.x0) * e; S.z = w.z0 + (w.z1 - w.z0) * e; if (w.yaw1 != null) { const dy = ((w.yaw1 - w.yaw0 + 540) % 360) - 180; S.yaw = (w.yaw0 + dy * e + 360) % 360; } if (w.p1 != null) S.pitch = w.p0 + (w.p1 - w.p0) * e;
        moving = true; if (u >= 1) { S.tween = null; after(); } }
      if (S.needs || moving) { placeCamera(); renderer.render(scene, camera); S.needs = false; }
      if (S.running && (moving || S.needs)) S.raf = requestAnimationFrame(frame); else S.last = 0;
    }
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
    function hit(e) {
      const r = cv.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera);
      const objs = G.bld.children.filter(o => o.name === 'walls' || o.name === 'roofs'), hs = ray.intersectObjects(objs, false);
      for (const h of hs) { const own = h.object.name === 'walls' ? S.owners.wall : S.owners.roof, id = own[Math.floor(h.faceIndex)]; if (id) { const b = env.byId(id); if (b) return { b, point: h.point }; } }
      const gs = ray.intersectObjects(G.ground.children, false); return gs.length ? { ground: gs[0].point } : null;
    }
    let drag = null, hovT = 0;
    cv.addEventListener('pointerdown', e => { cv.focus({ preventScroll: true }); drag = { x: e.clientX, y: e.clientY, yaw: S.yaw, pitch: S.pitch, moved: false }; try { cv.setPointerCapture(e.pointerId); } catch (x) { /* fine */ } });
    cv.addEventListener('pointermove', e => {
      if (drag) { const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true; if (drag.moved) { const f = S.fov / 65 * 0.22; S.yaw = (drag.yaw - dx * f + 3600) % 360; S.pitch = clamp(drag.pitch + dy * f, -85, 80); S.tween = null; need(); if (env.onMove) env.onMove(state()); if (env.onHover) env.onHover(null, e); } return; }
      const now = performance.now(); clearTimeout(hovLate); if (now - hovT < 60) { const ev = { clientX: e.clientX, clientY: e.clientY }; hovLate = setTimeout(() => point(ev), 70); return; } hovT = now; point(e);
    });
    let hovLate = 0;
    function point(e) { if (drag) return; const h = hit(e), b = h && h.b, id = b ? b.id : null; if (id !== S.hov) { S.hov = id; highlight(); } cv.style.cursor = b ? 'pointer' : h && h.ground ? 'crosshair' : 'grab'; if (env.onHover) env.onHover(b || null, e); }
    cv.addEventListener('pointerup', e => {
      const d = drag; drag = null; if (!d || d.moved) return; const h = hit(e); if (!h) return;
      if (h.b) { S.cur = h.b.id; highlight(); labels(); if (env.onPick) env.onPick(h.b); return; }
      if (h.ground) goTo(h.ground.x, h.ground.z);
    });
    cv.addEventListener('dblclick', e => { const h = hit(e); if (h && h.b && env.onFront) env.onFront(h.b); });
    cv.addEventListener('pointerleave', () => { if (S.hov) { S.hov = null; highlight(); } if (env.onHover) env.onHover(null); });
    cv.addEventListener('wheel', e => { e.preventDefault(); S.fov = clamp(S.fov * (1 + e.deltaY * 0.0011), 22, 95); need(); }, { passive: false });
    const KEYS = { ArrowUp: 'fwd', KeyW: 'fwd', ArrowDown: 'back', KeyS: 'back', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
    cv.addEventListener('keydown', e => { const k = KEYS[e.code]; if (k) { e.preventDefault(); if (!S.keys[k]) { S.keys[k] = true; S.last = 0; need(); } } else if (e.code === 'KeyQ' || e.code === 'PageUp') setHeight(S.mode === 'street' ? 'drone' : 'bird'); else if (e.code === 'KeyE' || e.code === 'PageDown') setHeight(S.mode === 'bird' ? 'drone' : 'street'); });
    cv.addEventListener('keyup', e => { const k = KEYS[e.code]; if (k) S.keys[k] = false; });
    cv.addEventListener('blur', () => { S.keys = {}; });
    if (window.ResizeObserver) new ResizeObserver(resize).observe(host);

    /* ---------- moves ---------- */
    function goTo(x, z, yaw, pitch) {
      let tx = x, tz = z, o = null; if (S.mode === 'street') { o = nearestOnRoads(x, z, 45); if (o) { tx = o.x; tz = o.z; } }
      S.tween = { t0: performance.now(), ms: clamp(Math.hypot(tx - S.x, tz - S.z) * 18, 250, 1400), x0: S.x, z0: S.z, x1: tx, z1: tz, yaw0: S.yaw, yaw1: yaw != null ? yaw : null, p0: S.pitch, p1: pitch != null ? pitch : null };
      S.on = o; need();
    }
    function faceAt(b, smooth) {
      if (!b) return; const [x, z] = toL(b.lat, b.lon), d = Math.max(1, Math.hypot(x - S.x, z - S.z)), yaw = (DG(Math.atan2(x - S.x, -(z - S.z))) + 360) % 360;
      const eye = HEIGHT[S.mode].eye, mid = Math.max(2.4, env.height(b)) * 0.55, pitch = clamp(DG(Math.atan2(mid - eye, d)), -80, 45);
      if (smooth) S.tween = { t0: performance.now(), ms: 500, x0: S.x, z0: S.z, x1: S.x, z1: S.z, yaw0: S.yaw, yaw1: yaw, p0: S.pitch, p1: pitch }; else { S.yaw = yaw; S.pitch = pitch; }
      need(); if (env.onMove) env.onMove(state());
    }
    function setHeight(m) { if (!HEIGHT[m] || m === S.mode) return; const was = S.mode; S.mode = m; S.pitch = HEIGHT[m].pitch; if (m === 'street') { const o = nearestOnRoads(S.x, S.z, 60); if (o) { S.on = o; S.x = o.x; S.z = o.z; } } else if (was === 'street') S.on = null; need(); if (env.onMove) env.onMove(state()); }
    function state() { const [la, lo] = toLL(S.x, S.z), r = roadAt(); return { lat: la, lon: lo, yaw: S.yaw, pitch: S.pitch, mode: S.mode, road: r ? r.name : '', roadKind: r ? r.kind : '', built: S.built, roads: S.roads.length, note: S.note }; }

    return {
      /* stand at lat, lon (on the nearest street at street level) looking at heading yaw; the scene is rebuilt when far */
      async open(lat, lon, yaw, o) {
        o = o || {}; S.running = true; resize();
        if (o.mode && HEIGHT[o.mode]) S.mode = o.mode;
        const far = !S.ok || Math.hypot(...toL(lat, lon)) > REBUILD; S.ok = true;
        if (far) { await recenter(lat, lon, [lat, lon]); }
        [S.x, S.z] = toL(lat, lon); S.on = null; if (S.mode === 'street') { const r = nearestOnRoads(S.x, S.z, 45); if (r) { S.on = r; S.x = r.x; S.z = r.z; } }
        S.yaw = yaw != null ? yaw : S.yaw; S.pitch = o.pitch != null ? o.pitch : HEIGHT[S.mode].pitch;
        if (o.cur !== undefined) S.cur = o.cur; if (o.face) faceAt(o.face, false);
        highlight(); labels(); S.labelsAt = [S.x, S.z]; need(); if (env.onMove) env.onMove(state());
      },
      face: b => faceAt(b, true), walk: m => walk(m), turn: d => { S.yaw = (S.yaw + d + 360) % 360; need(); if (env.onMove) env.onMove(state()); }, setHeight, state,
      setCurrent(id) { S.cur = id; highlight(); labels(); }, refresh() { if (S.ok) { buildBuildings(); } }, labels: () => labels(),
      hold(k, on) { S.keys[k] = !!on; S.last = 0; need(); },
      start() { S.running = true; resize(); need(); }, stop() { S.running = false; S.keys = {}; if (S.raf) { cancelAnimationFrame(S.raf); S.raf = 0; } },
      project(lat, lon, up) { const [x, z] = toL(lat, lon), v = new THREE.Vector3(x, up, z).project(camera); return v.z > 1 ? null : [(v.x + 1) / 2 * host.clientWidth, (1 - v.y) / 2 * host.clientHeight]; },
      canvas: cv,
    };
  };
})();
