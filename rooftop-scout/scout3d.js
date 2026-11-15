/* ==== rooftop scout: the 3D street view ==== */
/* A street level model of the neighborhood, built in the browser from open data with no key, and drawn the way a modern
   game engine draws a scene. Every building is its FEMA footprint raised to its height: houses get walls set back under
   their eaves, a hipped roof, a foundation, a front door facing the street and a garage door facing the alley; the rest
   get flat roofs behind parapets. Walls are physically based materials (brick, lap siding, stucco, storefront, curtain
   wall glass, metal panel) with windows that reflect the sky; roofs and the ground carry Esri's aerial and satellite
   imagery; streets are asphalt, alleys and drives concrete, from OpenStreetMap (or the Census TIGER file); the trees stand
   where the aerial photograph shows canopy.
   The light is the engine's: a physical sky with the sun where it stands over Dallas at the chosen hour, image based light
   from that sky, sun shadows, ambient occlusion (GTAO), bloom (three.js's port of Unreal Engine's bloom) and filmic tone
   mapping, at the quality the machine can carry (High, Medium or Basic, chosen by itself and lowered if the walk stutters).
   Because the page draws the scene itself, it always knows where the camera stands and looks, so the green, orange and red
   glows sit exactly on the buildings. The area also exports as a glTF model that opens in Unreal Engine 5 or Blender.
   window.__SCOUT_3D__(THREE, host, env) builds the view in host and returns its controls; THREE is three.js r186 with the
   add-ons in THREE.addons (vendor/three-entry.js), carried inline and kept private (window.__SCOUT_THREE__). env supplies
   the data (buildings, roads, imagery tiles, facts) and hears what happens (hover, pick, moves, notes). */
(function () {
  'use strict';
  window.__SCOUT_3D__ = function create3D(THREE, host, env) {
    if (!THREE || !host) return null;
    const A = THREE.addons || {};
    const R = d => d * Math.PI / 180, DG = r => r * 180 / Math.PI, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
    const hash01 = s => { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 100003) / 100003; };
    let seed = 1; const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }); } catch (e) { return null; }
    if (!renderer || !renderer.getContext()) return null;
    renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.AgXToneMapping; renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    const cv = renderer.domElement; cv.className = 'sc-3dc'; cv.tabIndex = 0; cv.setAttribute('aria-label', 'Street level 3D view. Drag to look around, W and S or the arrow keys to walk the street, A and D to turn, click a building to read it.');
    host.appendChild(cv);
    const ANISO = Math.min(8, renderer.capabilities.getMaxAnisotropy());

    /* ---------- graphics: the quality the machine can carry, the hour of the sun, the trees ---------- */
    const GFX_KEY = 'tda.scout.gfx.v1', GFX0 = { q: 'auto', sun: 'afternoon', trees: true, photo: false, ai: true };
    const gfx = (() => { try { return Object.assign({}, GFX0, JSON.parse(localStorage.getItem(GFX_KEY) || '{}')); } catch (e) { return Object.assign({}, GFX0); } })();
    const saveGfx = () => { try { localStorage.setItem(GFX_KEY, JSON.stringify({ q: gfx.q, sun: gfx.sun, trees: gfx.trees, photo: !!gfx.photo, ai: gfx.ai !== false })); } catch (e) { /* this browser keeps no settings */ } };
    const TIERS = {
      high: { label: 'High', pr: 2, shadow: 2048, ao: true, bloom: true, msaa: 4, trees: 6000, post: true, leafVox: 1.0, leaves: 170000, img: 20 },
      medium: { label: 'Medium', pr: 1.25, shadow: 1024, ao: false, bloom: true, msaa: 4, trees: 3000, post: true, leafVox: 1.4, leaves: 75000, img: 19 },
      basic: { label: 'Basic', pr: 1, shadow: 0, ao: false, bloom: false, msaa: 0, trees: 900, post: false, leafVox: 2.0, leaves: 28000, img: 19 },
    };
    const GPU = (() => { try { const gl = renderer.getContext(), x = gl.getExtension('WEBGL_debug_renderer_info'); return String(x ? gl.getParameter(x.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)); } catch (e) { return ''; } })();
    let autoTier = /swiftshader|llvmpipe|softpipe|software|basic render/i.test(GPU) ? 'basic' : (navigator.maxTouchPoints || 0) > 1 && Math.min(screen.width, screen.height) < 820 ? 'medium' : 'high';
    const tierName = () => (TIERS[gfx.q] ? gfx.q : autoTier);
    let T = TIERS[tierName()];

    /* ---------- the scene: sky, sun, haze; an overlay scene for the labels and the current outline, never tone mapped ---------- */
    const scene = new THREE.Scene(), overlay = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(65, 1, 0.3, 6000);
    const sky = A.Sky ? new A.Sky() : null, SU = sky ? sky.material.uniforms : null;
    if (sky) {
      sky.scale.setScalar(5000); sky.name = 'sky'; scene.add(sky); SU.mieCoefficient.value = 0.004; SU.mieDirectionalG.value = 0.82; if (SU.cloudCoverage) { SU.cloudCoverage.value = 0.3; SU.cloudDensity.value = 0.35; }
      /* the sky at the scene's exposure, never negative (a cloud over the sun can take it below zero) and never past what a
         half float buffer holds, so the sun neither turns black nor floods the bloom */
      SU.skyGain = { value: 0.5 };
      sky.material.onBeforeCompile = sh => { sh.uniforms.skyGain = SU.skyGain; sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'uniform float skyGain;\nvoid main() {').replace('#include <tonemapping_fragment>', 'gl_FragColor.rgb = clamp( gl_FragColor.rgb * skyGain, 0.0, 10.0 );\n#include <tonemapping_fragment>'); };
      sky.material.customProgramCacheKey = () => 'scout-sky'; sky.material.needsUpdate = true;
    }
    else scene.background = new THREE.Color('#c6d6e4');
    const skyScene = new THREE.Scene(); if (sky) { const s2 = new THREE.Mesh(sky.geometry, sky.material); s2.scale.setScalar(5000); skyScene.add(s2); }
    const hemi = new THREE.HemisphereLight(0xdde8f3, 0x6e6653, 0.35); scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffffff, 3); scene.add(sun); scene.add(sun.target);
    sun.shadow.bias = -0.0004; sun.shadow.radius = 2.2;
    scene.fog = new THREE.FogExp2(0xb2c0cd, 0.0008);
    const sunDir = new THREE.Vector3(0.4, 0.6, 0.5).normalize();
    const G = { ground: new THREE.Group(), roads: new THREE.Group(), bld: new THREE.Group(), trees: new THREE.Group(), fx: new THREE.Group(), sel: new THREE.Group() };
    Object.values(G).forEach(g => scene.add(g));
    const O = { labels: new THREE.Group(), sel: new THREE.Group() }; Object.values(O).forEach(g => overlay.add(g));
    const pmrem = new THREE.PMREMGenerator(renderer); let envRT = null;

    /* ---------- photoreal: Google's Photorealistic 3D Tiles, the city as photographed (a Google key with the Map Tiles API) ---------- */
    /* Google's 3D mesh of the real streets, houses, trees and cars, built from aerial photographs (the data behind Google
       Earth's 3D), streamed tile by tile around the camera by the 3D Tiles renderer. It shows alone: the modeled ground,
       roofs, roads and trees hide (Google's terms keep its tiles off other maps), while the glows, outlines and labels stay,
       on the FEMA footprints at the ground's real height (USGS 3DEP bare earth), and the hidden model still answers
       clicks. The photographs carry their own light, so the tiles are drawn unlit with a neutral tone curve that keeps their
       colours; sun shadows and ambient occlusion are off. The camera stands on the mesh's own ground. Google's logo and the
       tiles' data credits show in the corner, as Google requires. */
    const XT = THREE.tiles || null, GEOID = -26.6;   /* the geoid over DFW: sea level lies about 26.6 m below the WGS84 ellipsoid */
    const PR = { on: !!gfx.photo, tiles: null, reo: null, wrap: new THREE.Group(), key: '', err: '', calib: 0, gy: 0, gyAt: null, gyT: 0, gyTarget: null, attr: '', attrT: 0 };
    PR.wrap.rotation.y = Math.PI; PR.wrap.name = 'photoreal'; PR.wrap.visible = false; scene.add(PR.wrap);   /* the plugin puts +X west and +Z north; half a turn gives +X east and +Z south, as here */
    let dracoL = null;
    const draco = () => { if (dracoL) return dracoL; const d = new XT.DRACOLoader(); d.setDecoderConfig({ type: 'wasm' }); const str = atob(XT.dracoWasm), bin = new Uint8Array(str.length); for (let i = 0; i < str.length; i++) bin[i] = str.charCodeAt(i);
      d._loadLibrary = (url, type) => Promise.resolve(type === 'arraybuffer' ? bin.buffer.slice(0) : XT.dracoJs); return (dracoL = d); };
    const prKey = () => (env.googleKey ? env.googleKey() : '') || '';
    const prOn = () => PR.on && !!PR.tiles && !PR.err;
    const prH0 = () => (DEMS.d ? DEMS.d.ground(0, 0) + GEOID : 140);
    const groundRel = (x, z) => (DEMS.d ? DEMS.d.ground(x, z) - DEMS.d.ground(0, 0) : 0);
    const esc3 = v => String(v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    /* what to tell the person when Google refuses: from the status alone (the library's own text can hold the request's
       address, and with it the key, so it is never shown) */
    function prErrText(e) {
      const m = String((e && e.error && e.error.message) || (e && e.message) || ''), c = (m.match(/\b([45]\d\d)\b/) || [])[1];
      if (c === '400') return 'Google says the key is not valid: check it was pasted whole.';
      if (c === '403') return 'Google refused the key: turn on the Map Tiles API for it (Google Cloud console, APIs and Services) with billing on its project, and do not limit the key to web addresses (a file opened from this computer sends none).';
      if (c === '429') return 'Google says the key has used up its quota for now.';
      if (c) return 'Google did not send its 3D tiles (error ' + c + ').';
      return 'Google did not answer: the network, a blocker or the browser stopped the request.';
    }
    function prStart() {
      if (!XT || !prKey()) return false; if (!DEMS.d) loadDEM(S.gen);
      if (PR.tiles && PR.key === prKey()) { prPlace(); return true; }
      prStop();
      try {
        const t = new XT.TilesRenderer(); PR.key = prKey(); PR.err = ''; PR.calib = 0;
        t.registerPlugin(new XT.GoogleCloudAuthPlugin({ apiToken: PR.key, autoRefreshToken: true }));
        t.registerPlugin(new XT.GLTFExtensionsPlugin({ dracoLoader: draco() }));
        PR.reo = new XT.ReorientationPlugin({ lat: R(S.lat0), lon: R(S.lon0), height: prH0() }); t.registerPlugin(PR.reo);
        t.errorTarget = T === TIERS.high ? 8 : T === TIERS.medium ? 12 : 18;   /* screen space error in pixels: lower is sharper and loads more */
        t.setCamera(camera); t.setResolutionFromRenderer(camera, renderer);
        t.addEventListener('load-model', ({ scene: sc }) => { sc.traverse(o => { if (!o.isMesh || !o.material) return; const m = o.material; if (!m.isMeshBasicMaterial) { o.material = new THREE.MeshBasicMaterial({ map: m.map || null, color: m.map ? 0xffffff : (m.color ? m.color.getHex() : 0xbbbbbb) }); m.dispose(); } o.castShadow = o.receiveShadow = false; }); need(); });
        t.addEventListener('needs-update', () => need());
        t.addEventListener('load-tile-set', () => { PR.calWant = true; PR.calTries = 0; need(); });   /* the root has come: the camera's tiles can be asked for now */
        t.addEventListener('tiles-load-end', () => { PR.calWant = true; PR.calTries = 0; need(); });   /* a tile reported loaded joins the scene on the next update: calibrate from the loop */
        t.addEventListener('load-error', e => { if (e && e.tile && t.root) return; PR.err = prErrText(e); prApply(); setTimeout(() => { if (PR.err && PR.tiles === t) prStop(); }, 0); });   /* a refused start is dropped, so the next key (or the same one, fixed) starts afresh */
        PR.wrap.add(t.group); PR.tiles = t; PR.t0 = performance.now(); prPlace(); return true;
      } catch (e) { PR.err = 'The photoreal view could not start: ' + ((e && e.message) || e); return false; }
    }
    function prStop() { if (!PR.tiles) return; try { PR.wrap.remove(PR.tiles.group); PR.tiles.dispose(); } catch (e) { /* gone either way */ } PR.tiles = null; PR.reo = null; }
    function prPlace() { if (!PR.tiles || !PR.reo) return; PR.reo.lat = R(S.lat0); PR.reo.lon = R(S.lon0); PR.reo.height = prH0(); PR.reo.transformLatLonHeightToOrigin(PR.reo.lat, PR.reo.lon, PR.reo.height); PR.wrap.position.y = 0; PR.calib = 0; PR.calTries = 0; PR.calWant = true; PR.gyAt = null; PR.gyTarget = null; need(); }
    /* the lowest surface under a point is the ground (canopy, wires and roofs lie above it) */
    const prRay = new THREE.Raycaster(), DOWN = new THREE.Vector3(0, -1, 0), V3 = new THREE.Vector3();
    function prLowest(x, z) { if (!PR.tiles) return null; prRay.set(V3.set(x, 500, z), DOWN); prRay.far = 1200; let hs = []; try { hs = prRay.intersectObject(PR.tiles.group, true); } catch (e) { return null; } return hs.length ? hs[hs.length - 1].point.y : null; }
    /* once tiles near the camera are in, the mesh's ground along the street is set to the elevation model's (or to zero) */
    function prCalibrate() {
      if (!prOn() || PR.calib >= 6) return false;
      const o = nearestOnRoads(S.x, S.z, 60), bx = o ? o.x : S.x, bz = o ? o.z : S.z, d = [];
      for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) { const x = bx + i * 3, z = bz + j * 3, y = prLowest(x, z); if (y != null) d.push(y - groundRel(x, z)); }
      if (d.length < 5) return false; d.sort((a, b) => a - b); const off = d[Math.floor(d.length / 2)];
      if (Math.abs(off) > 0.03) { PR.wrap.position.y -= off; PR.gyAt = null; PR.gyTarget = null; } PR.calib++; PR.calWant = false; need(); return true;
    }
    /* the ground under the camera: Google's mesh, re-read as the camera moves, eased so steps do not jolt */
    function prGround(x, z) {
      if (!prOn()) return 0; const now = performance.now();
      if (!PR.gyAt || Math.hypot(PR.gyAt[0] - x, PR.gyAt[1] - z) > 0.8 || now - PR.gyT > 700) { PR.gyT = now; const y = prLowest(x, z); if (y != null) { PR.gyAt = [x, z]; PR.gyTarget = y; } else if (PR.gyTarget == null) PR.gyTarget = groundRel(x, z); }
      const tgt = PR.gyTarget != null ? PR.gyTarget : 0; PR.gy += (tgt - PR.gy) * 0.5; if (Math.abs(tgt - PR.gy) > 0.01) S.needs = true; return PR.gy;
    }
    const ATTR = host.querySelector('.sc-3dattr'), ATTR0 = ATTR ? ATTR.innerHTML : '';
    function prAttr(force) {
      if (!ATTR) return; const now = performance.now(); if (!force && now - PR.attrT < 1500) return; PR.attrT = now;
      if (!prOn()) { ATTR.classList.remove('sc-3dattr-g'); if (ATTR.innerHTML !== ATTR0) ATTR.innerHTML = ATTR0; PR.attr = ''; return; }
      const list = []; try { PR.tiles.getAttributions(list); } catch (e) { /* none yet */ }
      const txt = list.filter(a => a.type === 'string' && a.value).map(a => a.value).join('; ');
      const html = `<img src="${window.__SCOUT_GLOGO__ || ''}" alt="Google" class="sc-glogo"> ${esc3(txt || 'Google')} · Glows: FEMA footprints, the atlas's readings`;
      ATTR.classList.add('sc-3dattr-g'); if (html !== PR.attr) { PR.attr = html; ATTR.innerHTML = html; }
    }
    function prApply() {
      const on = prOn(); [G.ground, G.roads, G.bld, G.trees].forEach(g => { g.visible = !on; }); PR.wrap.visible = on;
      pipeline(); if (S.ok) buildBuildings(); prAttr(true); need(); if (env.onGraphics) env.onGraphics(graphics());
    }

    /* ---------- state ---------- */
    const S = { ok: false, gen: 0, lat0: 0, lon0: 0, kx: 1, ky: 1, x: 0, z: 0, yaw: 0, pitch: 0, fov: 65, mode: 'street', roads: [], graph: [], on: null, img: null, cur: null, hov: null, pick: [], labels: [], keys: {}, tween: null, running: false, needs: true, last: 0, built: 0, note: '',
      geo: new Map(), parts: [], batches: null, shell: null, doorRanges: new Map(), treeList: [], treeN: 0, sunAlt: 45, sunNote: '', fs: [], lastT: 0, raf: 0 };
    const HEIGHT = { street: { eye: 1.7, pitch: 2 }, drone: { eye: 38, pitch: -32 }, bird: { eye: 120, pitch: -58 } };
    const RADIUS = 250, REBUILD = 170;     /* buildings drawn within 250 m of the scene's centre; past 170 m of walking the scene is rebuilt around the camera */
    const mLat = la => 111132.92 - 559.82 * Math.cos(2 * R(la)) + 1.175 * Math.cos(4 * R(la)), mLon = la => 111412.84 * Math.cos(R(la)) - 93.5 * Math.cos(3 * R(la));
    const toL = (la, lo) => [(lo - S.lon0) * S.kx, -(la - S.lat0) * S.ky];          /* [x east, z south] in meters; north is -z */
    const toLL = (x, z) => [S.lat0 - z / S.ky, S.lon0 + x / S.kx];
    const lon2t = (lo, z) => (lo + 180) / 360 * Math.pow(2, z), lat2t = (la, z) => { const r = R(la); return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * Math.pow(2, z); };
    const t2lon = (x, z) => x / Math.pow(2, z) * 360 - 180, t2lat = (y, z) => DG(Math.atan(Math.sinh(Math.PI * (1 - 2 * y / Math.pow(2, z)))));
    const need = () => { S.needs = true; if (S.running && !S.raf) S.raf = requestAnimationFrame(frame); };
    const note = t => { S.roadNote = t || ''; S.note = [S.roadNote, typeof TR !== 'undefined' ? TR.note : ''].filter(Boolean).join(' '); if (env.onNote) env.onNote(S.note); };
    const later = (fn, ms) => { let t = 0; return () => { clearTimeout(t); t = setTimeout(fn, ms); }; };

    /* ---------- the sun: where it stands over the scene at the chosen hour of today (NOAA's low precision formulas) ---------- */
    function solar(date, lat, lon) {
      const d = date.getTime() / 86400000 - 10957.5, g = R(357.529 + 0.98560028 * d), q = 280.459 + 0.98564736 * d;
      const L = R(q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)), e = R(23.439 - 0.00000036 * d);
      const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)), dec = Math.asin(Math.sin(e) * Math.sin(L));
      const gmst = ((18.697374558 + 24.06570982441908 * d) % 24 + 24) % 24, H = R(gmst * 15 + lon) - ra, phi = R(lat);
      const alt = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
      const az = Math.atan2(-Math.sin(H), Math.tan(dec) * Math.cos(phi) - Math.sin(phi) * Math.cos(H));
      return { alt: DG(alt), az: (DG(az) + 360) % 360 };
    }
    const SUN_AT = { morning: 0.2, midday: 0.5, afternoon: 0.72, evening: 0.93 };
    function sunTime(preset, lat, lon) {
      const now = new Date(); if (preset === 'now') return now;
      const off = lon / 15, sol = new Date(now.getTime() + off * 3600e3), day0 = Date.UTC(sol.getUTCFullYear(), sol.getUTCMonth(), sol.getUTCDate()) - off * 3600e3;
      let rise = null, set = null; for (let m = 0; m <= 1440; m += 5) { if (solar(new Date(day0 + m * 60e3), lat, lon).alt > -0.8) { if (rise == null) rise = m; set = m; } }
      return rise == null ? now : new Date(day0 + (rise + (set - rise) * (SUN_AT[preset] || 0.72)) * 60e3);
    }
    function bakeEnv() {
      if (!sky) return;
      try { SU.showSunDisc.value = 0; const rt = pmrem.fromScene(skyScene, 0, 1, 7000); if (envRT) envRT.dispose(); envRT = rt; scene.environment = rt.texture; scene.environmentIntensity = 0.42; if (MAT.win) { MAT.win.envMap = rt.texture; MAT.win.needsUpdate = true; } } catch (e) { /* the sky still lights the scene through the sun and the hemisphere */ } finally { SU.showSunDisc.value = 1; }
    }
    function setSun() {
      const la = S.lat0 || 32.8, lo = S.lon0 || -96.8, t = sunTime(gfx.sun, la, lo); let { alt, az } = solar(t, la, lo); S.sunNote = '';
      if (alt < 4) { S.sunNote = gfx.sun === 'now' ? 'The sun is down in Dallas now, so the scene is lit as at sundown.' : ''; alt = 4; }
      S.sunAlt = alt; S.sunTime = t; const ca = Math.cos(R(alt)); sunDir.set(Math.sin(R(az)) * ca, Math.sin(R(alt)), -Math.cos(R(az)) * ca).normalize();
      const k = smooth(3, 38, alt);
      sun.color.setRGB(1, 0.7 + 0.3 * k, 0.48 + 0.52 * k); sun.intensity = 1.3 + 3.5 * smooth(0, 30, alt);
      hemi.intensity = 0.12 + 0.08 * k;
      if (sky) { SU.sunPosition.value.copy(sunDir); SU.rayleigh.value = 1.0 + 1.8 * (1 - k); SU.turbidity.value = 3.5 + 4 * (1 - k); }
      scene.fog.color.copy(new THREE.Color('#c7b39a').lerp(new THREE.Color('#b2c0cd'), k));
      bakeEnv(); need();
    }

    /* ---------- textures painted in the page: facades, doors, shingles, asphalt, concrete, ground and leaf detail ---------- */
    const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h || w; return c; };
    const texOf = (c, srgb) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = ANISO; return t; };
    function normalFrom(hc, k) {
      const w = hc.width, h = hc.height, src = hc.getContext('2d').getImageData(0, 0, w, h).data, c = canvas(w, h), g = c.getContext('2d'), out = g.createImageData(w, h), d = out.data;
      const H = (x, y) => src[((((y % h) + h) % h) * w + (((x % w) + w) % w)) * 4] / 255;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const dx = (H(x + 1, y) - H(x - 1, y)) * k, dy = (H(x, y + 1) - H(x, y - 1)) * k, l = Math.hypot(dx, dy, 1), i = (y * w + x) * 4;
        d[i] = (-dx / l * 0.5 + 0.5) * 255; d[i + 1] = (dy / l * 0.5 + 0.5) * 255; d[i + 2] = (1 / l * 0.5 + 0.5) * 255; d[i + 3] = 255;
      }
      g.putImageData(out, 0, 0); return c;
    }
    /* a painter for three canvases at once: colour (sRGB), height (for the normal map), and R: 1, G: roughness, B: where the
       building's own colour applies (wall 1; glass, trim, shutters 0) */
    function painter(N, w, h) {
      const ca = canvas(N), ch = canvas(N), co = canvas(N), a = ca.getContext('2d'), hh = ch.getContext('2d'), o = co.getContext('2d'), sx = N / w, sy = N / h;
      const box = (x0, y0, x1, y1, col, ht, ro, tint) => { const X = x0 * sx, Y = (h - y1) * sy, W = (x1 - x0) * sx, Hh = (y1 - y0) * sy; if (W <= 0 || Hh <= 0) return; a.fillStyle = col; a.fillRect(X, Y, W, Hh); hh.fillStyle = `rgb(${ht},${ht},${ht})`; hh.fillRect(X, Y, W, Hh); o.fillStyle = `rgb(255,${ro},${tint ? 255 : 0})`; o.fillRect(X, Y, W, Hh); };
      return { ca, ch, co, box };
    }
    const jit = (base, j) => { const f = 1 + (rnd() - 0.5) * j; return `rgb(${base.map(c => clamp(Math.round(c * f * (1 + (rnd() - 0.5) * 0.06)), 0, 255)).join(',')})`; };
    const FAC = { brick: { mw: 3.6, fh: 2.9 }, siding: { mw: 3.6, fh: 2.9 }, stucco: { mw: 4.0, fh: 3.3 }, store: { mw: 4.5, fh: 4.2 }, glass: { mw: 1.6, fh: 3.8 }, metal: { mw: 6, fh: 6 } };
    function glassPane(box, x0, y0, x1, y1) { for (let k = 0; k < 12; k++) { const t = k / 12, v = Math.round(46 + 58 * t); box(x0, y0 + (y1 - y0) * t, x1, y0 + (y1 - y0) * (t + 1 / 12), `rgb(${v - 10},${v + 4},${v + 16})`, 55, 14, 0); } }
    function paintFacade(kind) {
      const F = FAC[kind], P = painter(512, F.mw, F.fh), box = P.box; seed = 101 + kind.charCodeAt(0) * 7 + kind.length * 31;
      if (kind === 'brick') {
        box(0, 0, F.mw, F.fh, '#b9b2a6', 70, 245, 1); const ch = 0.0762, bl = 0.2032, mt = 0.011;
        for (let r = 0, y = 0; y < F.fh; r++, y += ch) { const off = (r % 2) * bl / 2; for (let x = -off; x < F.mw; x += bl) box(Math.max(0, x + mt / 2), y + mt / 2, Math.min(F.mw, x + bl - mt / 2), Math.min(F.fh, y + ch - mt / 2), jit([162, 86, 64], 0.24), 190 + Math.floor(rnd() * 35), 225, 1); }
      } else if (kind === 'siding') {
        const bh = 0.165; for (let y = 0; y < F.fh; y += bh) { box(0, y, F.mw, y + bh, '#ece9e2', 150, 205, 1); box(0, y + bh * 0.55, F.mw, y + bh, '#f2efe9', 120, 205, 1); box(0, y, F.mw, y + bh * 0.18, '#dcd7ce', 205, 205, 1); box(0, y, F.mw, y + 0.012, '#b9b3a8', 40, 220, 1); }
      } else if (kind === 'stucco' || kind === 'store') {
        box(0, 0, F.mw, F.fh, '#ded5c5', 150, 240, 1); for (let i = 0; i < 2400; i++) { const x = rnd() * F.mw, y = rnd() * F.fh, s = 0.01 + rnd() * 0.035; box(x, y, x + s, y + s, rnd() < 0.5 ? '#d3c9b7' : '#e8dfd1', 135 + Math.floor(rnd() * 35), 240, 1); }
      } else if (kind === 'metal') {
        box(0, 0, F.mw, F.fh, '#c3c7c9', 130, 115, 1); for (let x = 0; x < F.mw; x += 0.3) { box(x, 0, x + 0.07, F.fh, '#d6dadc', 215, 105, 1); box(x + 0.07, 0, x + 0.1, F.fh, '#a5aaad', 85, 125, 1); }
        box(0, 0, F.mw, 0.22, '#8e9396', 120, 180, 1);
      } else if (kind === 'glass') {
        glassPane(box, 0, 0, F.mw, F.fh); box(0, F.fh - 0.95, F.mw, F.fh, '#38424a', 95, 55, 0);
        box(0, 0, 0.06, F.fh, '#7d868d', 225, 90, 1); box(F.mw - 0.06, 0, F.mw, F.fh, '#7d868d', 225, 90, 1); box(0, F.fh - 1.0, F.mw, F.fh - 0.93, '#7d868d', 225, 90, 1);
      }
      if (kind === 'brick' || kind === 'siding' || kind === 'stucco') {
        const x0 = F.mw * 0.31, x1 = F.mw * 0.69, y0 = 0.9, y1 = 2.25, tr = 0.075, trim = kind === 'stucco' ? '#4d4743' : '#f1efe9';
        if (kind === 'siding') { box(x0 - 0.5, y0, x0 - 0.09, y1, '#2f3b35', 185, 170, 0); box(x1 + 0.09, y0, x1 + 0.5, y1, '#2f3b35', 185, 170, 0); }
        if (kind === 'brick') box(x0 - 0.06, y1, x1 + 0.06, y1 + 0.11, '#8c4b39', 180, 225, 1);
        box(x0 - 0.07, y0 - 0.07, x1 + 0.07, y0, '#d2ccc1', 232, 160, 0);
        box(x0, y0, x1, y1, trim, 215, 140, 0); glassPane(box, x0 + tr, y0 + tr, x1 - tr, y1 - tr);
        box((x0 + x1) / 2 - 0.025, y0, (x0 + x1) / 2 + 0.025, y1, trim, 205, 140, 0); box(x0, (y0 + y1) / 2 - 0.025, x1, (y0 + y1) / 2 + 0.025, trim, 205, 140, 0);
      } else if (kind === 'store') {
        const x0 = 0.25, x1 = F.mw - 0.25, y0 = 0.3, y1 = 3.1;
        box(x0 - 0.08, y0 - 0.08, x1 + 0.08, y1 + 0.08, '#3a3d41', 205, 110, 0); glassPane(box, x0, y0, x1, y1);
        for (let x = x0 + 1.33; x < x1 - 0.2; x += 1.33) box(x - 0.03, y0, x + 0.03, y1, '#3a3d41', 205, 110, 0);
        box(x0, 2.35, x1, 2.41, '#3a3d41', 205, 110, 0); box(0, 3.35, F.mw, 3.8, '#cfc6b6', 175, 230, 1);
      }
      return { map: texOf(P.ca, true), normalMap: texOf(normalFrom(P.ch, kind === 'metal' ? 4 : 2.6)), orm: texOf(P.co) };
    }
    function paintDoors() {
      const P = painter(512, 2, 1), box = P.box; seed = 77;   /* left half: a panel front door, 1 by 2.1 m drawn on 1 by 1; right: a sectional garage door */
      box(0, 0, 1, 1, '#f1efe9', 210, 150, 0); box(0.06, 0, 0.94, 0.965, '#cfc8bc', 150, 170, 1);
      for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) { const x = 0.15 + c * 0.37, y = 0.07 + r * 0.3; box(x, y, x + 0.3, y + 0.24, '#d9d3c8', 190, 170, 1); box(x + 0.03, y + 0.03, x + 0.27, y + 0.21, '#cbc4b8', 165, 170, 1); }
      box(0.8, 0.44, 0.85, 0.47, '#c8a04a', 230, 60, 0);
      box(1, 0, 2, 1, '#e9e6df', 150, 190, 1);
      for (let r = 0; r < 4; r++) { const y = r * 0.25; box(1, y, 2, y + 0.012, '#a9a49b', 60, 200, 1); for (let c = 0; c < 4; c++) { const x = 1.04 + c * 0.24; box(x, y + 0.04, x + 0.2, y + 0.21, '#efece6', 175, 190, 1); } }
      for (let c = 0; c < 4; c++) { const x = 1.06 + c * 0.24; glassPane(box, x, 0.81, x + 0.16, 0.93); }
      return { map: texOf(P.ca, true), normalMap: texOf(normalFrom(P.ch, 2.2)), orm: texOf(P.co) };
    }
    function paintShingles() {
      const c = canvas(256), g = c.getContext('2d'); seed = 31;   /* one tile: 1.12 m, eight courses of 14 cm */
      for (let r = 0; r < 8; r++) { const y = r * 32, off = (r % 2) * 24; for (let x = -off; x < 256; x += 48) { const v = 150 + Math.floor(rnd() * 40); const gr = g.createLinearGradient(0, y, 0, y + 32); gr.addColorStop(0, `rgb(${v - 70},${v - 70},${v - 70})`); gr.addColorStop(1, `rgb(${v},${v},${v})`); g.fillStyle = gr; g.fillRect(x, y, 46, 32); g.fillStyle = '#202020'; g.fillRect(x + 46, y, 2, 32); } g.fillStyle = '#303030'; g.fillRect(0, y + 31, 256, 1); }
      const t = texOf(normalFrom(c, 2.2)); t.channel = 1; return t;
    }
    function paintNoise(N, base, spread, dots, tileFn) {
      const c = canvas(N), g = c.getContext('2d'); g.fillStyle = base; g.fillRect(0, 0, N, N);
      for (let i = 0; i < dots; i++) { const x = rnd() * N, y = rnd() * N, s = 0.6 + rnd() * 2.2, v = Math.round((rnd() - 0.5) * spread); g.fillStyle = v > 0 ? `rgba(255,255,255,${v / 255})` : `rgba(0,0,0,${-v / 255})`; g.fillRect(x, y, s, s); }
      if (tileFn) tileFn(g, N); return c;
    }
    const asphaltTex = (() => { seed = 41; const c = paintNoise(256, '#4b4d50', 70, 9000, (g, N) => { for (let i = 0; i < 14; i++) { g.fillStyle = `rgba(0,0,0,${0.04 + rnd() * 0.05})`; g.beginPath(); g.ellipse(rnd() * N, rnd() * N, 10 + rnd() * 40, 6 + rnd() * 24, rnd() * 3, 0, 7); g.fill(); } }); return texOf(c, true); })();
    const concreteTex = (() => { seed = 43; const c = paintNoise(256, '#bdb8ae', 36, 6000, (g, N) => { for (let i = 0; i < 10; i++) { g.fillStyle = `rgba(80,70,60,${0.03 + rnd() * 0.04})`; g.beginPath(); g.ellipse(rnd() * N, rnd() * N, 12 + rnd() * 30, 8 + rnd() * 20, rnd() * 3, 0, 7); g.fill(); } }); return texOf(c, true); })();
    const detailTex = (() => { seed = 47; const c = canvas(256), g = c.getContext('2d'), d = g.createImageData(256, 256);
      const coarse = new Float32Array(16 * 16).map(() => rnd());
      for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) { const fx = x / 16, fy = y / 16, x0 = Math.floor(fx) % 16, y0 = Math.floor(fy) % 16, x1 = (x0 + 1) % 16, y1 = (y0 + 1) % 16, tx = fx - Math.floor(fx), ty = fy - Math.floor(fy);
        const cg = (coarse[y0 * 16 + x0] * (1 - tx) + coarse[y0 * 16 + x1] * tx) * (1 - ty) + (coarse[y1 * 16 + x0] * (1 - tx) + coarse[y1 * 16 + x1] * tx) * ty, i = (y * 256 + x) * 4;
        d.data[i] = 70 + rnd() * 120; d.data[i + 1] = 40 + cg * 175; d.data[i + 2] = 128; d.data[i + 3] = 255; }
      g.putImageData(d, 0, 0); return texOf(c); })();
    const grassTex = (() => { const u = (window.__SCOUT_TEX__ || {}).grass_diff; if (!u) return null; const t = new THREE.Texture(); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = ANISO; t.colorSpace = THREE.SRGBColorSpace; const im = new Image(); im.onload = () => { t.image = im; t.needsUpdate = true; }; im.src = u; return t; })();
    const leafNormal = (() => { seed = 53; const c = canvas(256), g = c.getContext('2d'); g.fillStyle = '#606060'; g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 1400; i++) { const x = rnd() * 256, y = rnd() * 256, r = 2 + rnd() * 6, v = 90 + Math.floor(rnd() * 165), gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgb(${v},${v},${v})`); gr.addColorStop(1, 'rgba(96,96,96,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
      const t = texOf(normalFrom(c, 3)); t.repeat.set(3, 2); return t; })();

    /* ---------- photo-scanned materials (CC0, Poly Haven and ambientCG, carried in the page as window.__SCOUT_TEX__) ---------- */
    const TEXD = window.__SCOUT_TEX__ || {}, hasPhoto = k => !!TEXD[k + '_diff'];
    const photoTex = (key, srgb, channel) => { const u = TEXD[key]; if (!u) return null; const t = new THREE.Texture(); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = ANISO; if (srgb) t.colorSpace = THREE.SRGBColorSpace; if (channel) t.channel = channel;
      const im = new Image(); im.onload = () => { t.image = im; t.needsUpdate = true; need(); }; im.src = u; return t; };
    const PHOTO_TILE = { brick: 1.6, siding: 2.4, stucco: 2.5, metal: 3.0 };   /* metres of wall one tile of each photo covers */
    const LEAF_AVG = [0.0803, 0.1379, 0.0276];                                   /* the leaf card's mean colour, linear */

    /* ---------- materials ---------- */
    /* the building's colour tints the wall but not its windows, trim or shutters: the B channel of the roughness map says where */
    function maskedTint(m, key) {
      m.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', '#if defined( USE_COLOR ) && defined( USE_ROUGHNESSMAP )\n{ float tintMask = texture2D( roughnessMap, vRoughnessMapUv ).b; diffuseColor.rgb *= mix( vec3( 1.0 ), vColor.rgb, tintMask ); }\n#elif defined( USE_COLOR )\ndiffuseColor.rgb *= vColor.rgb;\n#endif'); };
      m.customProgramCacheKey = () => 'scout-tint-' + key;
    }
    function groundDetail(m) {
      m.onBeforeCompile = sh => {
        sh.uniforms.detailMap = { value: detailTex }; sh.uniforms.grassMap = { value: grassTex || detailTex }; sh.uniforms.hasGrass = { value: grassTex ? 1 : 0 };
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vScoutW;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvScoutW = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D detailMap; uniform sampler2D grassMap; uniform float hasGrass;\nvarying vec3 vScoutW;').replace('#include <map_fragment>', '#include <map_fragment>\n{ float dd = length( vScoutW - cameraPosition ); float k = 1.0 - smoothstep( 20.0, 150.0, dd ); float f = texture2D( detailMap, vScoutW.xz * 0.42 ).r, c = texture2D( detailMap, vScoutW.xz * 0.061 ).g;\n  vec3 base = diffuseColor.rgb; float mx = max( base.r, max( base.g, base.b ) ), mn = min( base.r, min( base.g, base.b ) ), sat = ( mx - mn ) / max( mx, 0.001 ), lum = dot( base, vec3( 0.2126, 0.7152, 0.0722 ) );\n  float lawn = hasGrass * smoothstep( 0.12, 0.35, sat ) * ( 1.0 - smoothstep( 0.18, 0.4, lum ) );\n  vec3 g = texture2D( grassMap, vScoutW.xz / 1.7 ).rgb / vec3( 0.3099, 0.2288, 0.1001 );\n  diffuseColor.rgb *= mix( vec3( mix( 1.0, ( 0.62 + f * 0.75 ) * ( 0.8 + c * 0.4 ), k ) ), clamp( g, 0.2, 2.5 ), k * lawn * 0.9 ); }');
      };
      m.customProgramCacheKey = () => 'scout-ground';
    }
    const MAT = {};
    function mats() {
      if (MAT.brick) return MAT;
      Object.keys(FAC).forEach(k => {
        if (PHOTO_TILE[k] && hasPhoto(k)) { MAT[k] = new THREE.MeshStandardMaterial({ map: photoTex(k + '_diff', true), normalMap: photoTex(k + '_nor'), roughnessMap: photoTex(k + '_rough'), roughness: 1, metalness: k === 'metal' ? 0.45 : 0, vertexColors: true }); MAT[k].userData.photo = true; return; }
        const t = paintFacade(k); const m = new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, roughnessMap: t.orm, roughness: 1, metalness: k === 'glass' ? 0.2 : k === 'metal' ? 0.35 : 0, vertexColors: true }); m.normalScale.set(0.9, 0.9); maskedTint(m, k); MAT[k] = m; });
      /* windows: glass that mirrors the sky, frames and sills in the trim colour */
      MAT.win = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.05, metalness: 0.1, envMapIntensity: 1.6 });
      MAT.winframe = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0 });
      if (envRT) MAT.win.envMap = envRT.texture;
      MAT.trim = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0 });
      MAT.roof = new THREE.MeshStandardMaterial({ roughness: 0.88, metalness: 0, normalMap: TEXD.shingle_nor ? photoTex('shingle_nor', false, 1) : paintShingles(), vertexColors: true, side: THREE.DoubleSide }); MAT.roof.normalScale.set(0.6, 0.6);
      if (TEXD.shingle_rough) { MAT.roof.roughnessMap = photoTex('shingle_rough', false, 1); MAT.roof.roughness = 1; }
      const dr = paintDoors(); MAT.door = new THREE.MeshStandardMaterial({ map: dr.map, normalMap: dr.normalMap, roughnessMap: dr.orm, roughness: 1, vertexColors: true }); dr.map.wrapS = dr.map.wrapT = THREE.ClampToEdgeWrapping; maskedTint(MAT.door, 'door');
      const po = (f, u) => ({ polygonOffset: true, polygonOffsetFactor: f, polygonOffsetUnits: u });
      MAT.asphalt = new THREE.MeshStandardMaterial(Object.assign(hasPhoto('asphalt') ? { map: photoTex('asphalt_diff', true), normalMap: photoTex('asphalt_nor'), roughnessMap: photoTex('asphalt_rough'), roughness: 1 } : { map: asphaltTex, roughness: 0.93 }, { metalness: 0 }, po(-1, -4)));
      MAT.concrete = new THREE.MeshStandardMaterial(Object.assign(hasPhoto('concrete') ? { map: photoTex('concrete_diff', true), normalMap: photoTex('concrete_nor'), roughnessMap: photoTex('concrete_rough'), roughness: 1 } : { map: concreteTex, roughness: 0.86 }, { metalness: 0 }, po(-1, -3)));
      MAT.paintY = new THREE.MeshStandardMaterial(Object.assign({ color: '#e0b13c', roughness: 0.6 }, po(-2, -8)));
      MAT.paintW = new THREE.MeshStandardMaterial(Object.assign({ color: '#e9e7e0', roughness: 0.6 }, po(-2, -8)));
      MAT.crown = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, normalMap: leafNormal }); MAT.crown.normalScale.set(1.1, 1.1);
      MAT.trunk = hasPhoto('bark') ? new THREE.MeshStandardMaterial({ map: photoTex('bark_diff', true), normalMap: photoTex('bark_nor'), roughness: 0.95 }) : new THREE.MeshStandardMaterial({ color: '#5a4c40', roughness: 0.95 });
      if (MAT.trunk.map) MAT.trunk.map.repeat.set(2, 3);
      /* foliage: photographed leaves on twigs, alpha tested (and alpha to coverage under multisampling), lit softly through */
      /* leaves are matte: a glossy card catches the bright sky at a grazing angle, and thousands of them read as frost */
      MAT.leaf = TEXD.leaves_card ? new THREE.MeshLambertMaterial({ map: photoTex('leaves_card', true), alphaTest: 0.5, side: THREE.DoubleSide, alphaToCoverage: true }) : null;
      if (MAT.leaf) { MAT.leaf.map.wrapS = MAT.leaf.map.wrapT = THREE.ClampToEdgeWrapping; }
      /* the glow: a shell round each building, brightest at its silhouette and its foot, in HDR so the bloom catches it */
      MAT.shell = new THREE.ShaderMaterial({
        uniforms: { base: { value: 0.22 }, rim: { value: 1.7 }, far: { value: 560 } },
        vertexShader: 'attribute vec3 gcol; attribute float gh; varying vec3 vC; varying float vH; varying vec3 vN; varying vec3 vW;\nvoid main() { vec4 w = modelMatrix * vec4( position, 1.0 ); vW = w.xyz; vN = normalize( mat3( modelMatrix ) * normal ); vC = gcol; vH = gh; gl_Position = projectionMatrix * viewMatrix * w; }',
        fragmentShader: 'uniform float base; uniform float rim; uniform float far; varying vec3 vC; varying float vH; varying vec3 vN; varying vec3 vW;\nvoid main() { vec3 V = normalize( cameraPosition - vW ); float f = 1.0 - abs( dot( normalize( vN ), V ) ); float a = base * mix( 1.0, 0.3, vH ) + rim * pow( f, 2.4 ) * mix( 1.0, 0.5, vH ) * ( 1.0 - 0.6 * abs( V.y ) ); a *= 1.0 - smoothstep( far * 0.55, far, length( cameraPosition - vW ) ); gl_FragColor = vec4( vC * a, 1.0 );\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      });
      MAT.aura = MAT.shell.clone(); MAT.aura.uniforms.base.value = 0.45; MAT.aura.uniforms.rim.value = 2.6; MAT.aura.uniforms.far.value = 2000;
      MAT.halo = new THREE.MeshBasicMaterial(Object.assign({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }, po(-4, -16)));
      MAT.edge = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false });
      MAT.hov = new THREE.LineBasicMaterial({ color: new THREE.Color(1.7, 1.7, 1.7), transparent: true, depthWrite: false });
      MAT.selEdge = new THREE.LineBasicMaterial({ color: 0xffffff, depthTest: false, depthWrite: false, transparent: true, toneMapped: false });
      return MAT;
    }

    /* ---------- imagery: Esri tiles composed into one canvas per ring, refreshed as tiles arrive ---------- */
    const dirty = new Set(); let dirtyT = 0;
    const dirtyTex = t => { dirty.add(t); if (!dirtyT) dirtyT = setTimeout(() => { dirtyT = 0; dirty.forEach(x => { x.needsUpdate = true; }); dirty.clear(); need(); }, 250); };
    function imagery(z, n, fill, onAll) {
      const c = canvas(n * 256), g = c.getContext('2d', { willReadFrequently: false }); g.fillStyle = fill; g.fillRect(0, 0, c.width, c.height);
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = ANISO;
      const x0 = Math.floor(lon2t(S.lon0, z)) - Math.floor(n / 2), y0 = Math.floor(lat2t(S.lat0, z)) - Math.floor(n / 2), gen = S.gen, out = { tex, c, done: 0, ok: 0, total: n * n, zoom: z };
      const fin = () => { out.done++; if (out.done === out.total && onAll && S.gen === gen) onAll(out); };
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const im = new Image(); im.crossOrigin = 'anonymous'; im.decoding = 'async';
        im.onload = () => { if (S.gen !== gen) return; g.drawImage(im, i * 256, j * 256); out.ok++; dirtyTex(tex); fin(); };
        im.onerror = () => { if (S.gen === gen) fin(); };
        im.src = env.tileURL(z, x0 + i, y0 + j);
      }
      out.xW = (t2lon(x0, z) - S.lon0) * S.kx; out.xE = (t2lon(x0 + n, z) - S.lon0) * S.kx; out.nN = (t2lat(y0, z) - S.lat0) * S.ky; out.nS = (t2lat(y0 + n, z) - S.lat0) * S.ky;
      return out;
    }
    function groundPlane(img, y, detail) {
      const geo = new THREE.PlaneGeometry(img.xE - img.xW, img.nN - img.nS); geo.rotateX(-Math.PI / 2);
      const m = new THREE.MeshStandardMaterial({ map: img.tex, roughness: 1, metalness: 0 }); if (detail) groundDetail(m);
      const o = new THREE.Mesh(geo, m); o.position.set((img.xW + img.xE) / 2, y, -(img.nS + img.nN) / 2); o.receiveShadow = true; o.name = 'ground'; return o;
    }

    /* ---------- polygon tools: rings counter clockwise in (x, north), offsets, widths ---------- */
    const area = P => { let s = 0; for (let i = 0, j = P.length - 1; i < P.length; j = i++) s += (P[j][0] * -P[i][1]) - (P[i][0] * -P[j][1]); return s / 2; };
    function ringsOf(b) {
      const out = [];
      (b.rings || []).forEach(r => {
        let P = r.map(([la, lo]) => toL(la, lo)); if (P.length > 1) { const a = P[0], z = P[P.length - 1]; if (Math.abs(a[0] - z[0]) < 1e-6 && Math.abs(a[1] - z[1]) < 1e-6) P = P.slice(0, -1); }
        if (P.length < 3) return; const s = area(P); if (Math.abs(s) < 1) return; if (s < 0) P.reverse();
        /* drop jogs shorter than 30 cm and corners within 7 degrees of straight, so the offsets below stay clean */
        for (let pass = 0; pass < 3 && P.length > 3; pass++) {
          const Q = []; for (let i = 0; i < P.length; i++) { const p0 = Q.length ? Q[Q.length - 1] : P[P.length - 1], p1 = P[i], p2 = P[(i + 1) % P.length], ax = p1[0] - p0[0], az = p1[1] - p0[1], bx = p2[0] - p1[0], bz = p2[1] - p1[1], la = Math.hypot(ax, az), lb = Math.hypot(bx, bz);
            if (la < 0.3 || (la > 0 && lb > 0 && Math.abs(ax * bz - az * bx) / (la * lb) < 0.12 && ax * bx + az * bz > 0)) continue; Q.push(p1); }
          if (Q.length < 3 || Math.abs(area(Q)) < Math.abs(area(P)) * 0.8) break; P = Q;
        }
        out.push(P);
      });
      return out;
    }
    function offsetRing(P, d) {
      const n = P.length, out = [];
      for (let i = 0; i < n; i++) {
        const p0 = P[(i - 1 + n) % n], p1 = P[i], p2 = P[(i + 1) % n]; let ax = p1[0] - p0[0], az = p1[1] - p0[1], la = Math.hypot(ax, az) || 1, bx = p2[0] - p1[0], bz = p2[1] - p1[1], lb = Math.hypot(bx, bz) || 1; ax /= la; az /= la; bx /= lb; bz /= lb;
        const n1x = -az, n1z = ax, n2x = -bz, n2z = bx; let mx = n1x + n2x, mz = n1z + n2z; const ml = Math.hypot(mx, mz); if (ml < 1e-6) { mx = n1x; mz = n1z; } else { mx /= ml; mz /= ml; }
        const k = d / Math.max(0.35, mx * n1x + mz * n1z); out.push([p1[0] + mx * k, p1[1] + mz * k]);
      }
      return out;
    }
    function validOffset(P, Q) { for (let i = 0, n = P.length; i < n; i++) { const j = (i + 1) % n; if ((P[j][0] - P[i][0]) * (Q[j][0] - Q[i][0]) + (P[j][1] - P[i][1]) * (Q[j][1] - Q[i][1]) <= 0) return false; } return area(Q) > 0.15; }
    function raySeg(ox, oz, dx, dz, p, q) { const ex = q[0] - p[0], ez = q[1] - p[1], den = dx * ez - dz * ex; if (Math.abs(den) < 1e-9) return -1; const t = ((p[0] - ox) * ez - (p[1] - oz) * ex) / den, u = ((p[0] - ox) * dz - (p[1] - oz) * dx) / den; return u >= 0 && u <= 1 ? t : -1; }
    function minWidth(P) {
      let best = Infinity; const n = P.length;
      for (let i = 0; i < n; i++) { const a = P[i], c = P[(i + 1) % n], dx = c[0] - a[0], dz = c[1] - a[1], len = Math.hypot(dx, dz); if (len < 0.8) continue;
        const mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2, ix = dz / len, iz = -dx / len; let w = Infinity;
        for (let j = 0; j < n; j++) { if (j === i) continue; const t = raySeg(mx, mz, ix, iz, P[j], P[(j + 1) % n]); if (t > 0.05 && t < w) w = t; }
        if (w < best) best = w; }
      return isFinite(best) ? best : Math.sqrt(Math.abs(area(P)));
    }
    const centroid = P => [P.reduce((s, p) => s + p[0], 0) / P.length, P.reduce((s, p) => s + p[1], 0) / P.length];
    function inPoly(x, z, P) { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j]; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }

    /* ---------- geometry batches: one merged mesh per material, each triangle remembering its building ---------- */
    const batch = () => ({ p: [], n: [], u: [], u1: [], c: [], own: [] });
    function tri(B, a, b, c, nrm, ua, ub, uc, col, id, wa, wb, wc) {
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2], cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
      if (cx * cx + cy * cy + cz * cz < 1e-10) return;
      if (cx * nrm[0] + cy * nrm[1] + cz * nrm[2] < 0) { let t = b; b = c; c = t; t = ub; ub = uc; uc = t; t = wb; wb = wc; wc = t; }
      B.p.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]); B.n.push(nrm[0], nrm[1], nrm[2], nrm[0], nrm[1], nrm[2], nrm[0], nrm[1], nrm[2]);
      B.u.push(ua[0], ua[1], ub[0], ub[1], uc[0], uc[1]); if (wa) B.u1.push(wa[0], wa[1], wb[0], wb[1], wc[0], wc[1]);
      B.c.push(col.r, col.g, col.b, col.r, col.g, col.b, col.r, col.g, col.b); B.own.push(id);
    }
    const quad = (B, a, b, c, d, nrm, uv, col, id) => { tri(B, a, b, c, nrm, uv[0], uv[1], uv[2], col, id); tri(B, a, c, d, nrm, uv[0], uv[2], uv[3], col, id); };
    const Z2 = [0, 0], ZUV = [Z2, Z2, Z2, Z2];
    function batchMesh(B, mat, name) {
      if (!B.own.length) return null;
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(B.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(B.n, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(B.u, 2));
      if (B.u1.length) g.setAttribute('uv1', new THREE.Float32BufferAttribute(B.u1, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(B.c, 3)); g.computeBoundingSphere();
      const m = new THREE.Mesh(g, mat); m.name = name; m.castShadow = true; m.receiveShadow = true; m.userData.own = B.own; return m;
    }
    const C = hex => new THREE.Color(hex);
    const TRIM = { white: C('#ece9e2'), found: C('#99958c'), cap: C('#bcb8b0'), para: C('#a9a59d') };
    const TINTS = { brick: hasPhoto('brick') ? ['#ffffff', '#f1e3d8', '#e3cdbf', '#d6b9a8', '#fff4ea', '#cdb1a0'] : ['#ffffff', '#d9bfae', '#f2dccb', '#c49a86', '#e8d3c4', '#b98d7b'], siding: ['#f4f2ec', '#c3c8c6', '#dccfb5', '#adbccb', '#bcc6ab', '#e8dcae', '#9fa6ab'], stucco: ['#ffffff', '#efe2cc', '#d9d4ca', '#e9d6bf'], store: ['#ffffff', '#ece3d3', '#d6d2cb'], glass: ['#ffffff'], metal: ['#ffffff', '#c9d3db', '#e2dccd'] };
    const DOORS = ['#7c2a26', '#1f3550', '#2b2b2b', '#7a5a3a', '#f1efe9', '#3d5243'];
    function facadeOf(b, h) {
      const c = b.cls || 'unk', r = hash01(b.id + 'f');
      if (c === 'sf' || c === 'garage' || c === 'shed') return r < 0.55 ? 'brick' : 'siding';
      if (c === 'mh') return 'siding';
      if (['mf', 'hotel', 'dorm', 'care'].includes(c)) return r < 0.6 ? 'brick' : 'stucco';
      if (['whse', 'ind', 'indh', 'indf', 'ag', 'util', 'avn', 'parking'].includes(c)) return 'metal';
      if (h > 14) return 'glass';
      if (['retail', 'svc', 'ent', 'bank', 'vet', 'theater'].includes(c)) return 'store';
      return r < 0.5 ? 'stucco' : 'brick';
    }
    const tintOf = (kind, id) => { const L = TINTS[kind]; return C(L[Math.floor(hash01(id + 't') * L.length) % L.length]); };

    /* ---------- 2025: the scene traced by AI from the newest satellite photo of 2024 or later (scouttrace.js) ---------- */
    /* No public 3D survey of the area is newer than 2018, so the buildings and trees are checked against, and drawn from,
       the newest photo Esri serves here when it was taken in 2024 or later (Vantor's December 9, 2025 picture over
       Lakewood). The photo leans a little (a satellite looks slightly sideways): TR.res.lean, metres in the picture per
       metre of height, is taken out of every traced outline and put back when the photo is laid on a roof. */
    const TRACE = window.__SCOUT_TRACE__ || null, TR = { state: 'off', res: null, src: null, all: null, note: '', partial: null, reach: 0, ms: null };
    const bboxOf = P => { let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity; P.forEach(p => { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); }); return [x0, z0, x1, z1]; };
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    /* a traced outline the way ringsOf gives the recorded ones: open, counter-clockwise seen from above */
    const normRing = P => { if (!P || P.length < 3) return []; let Q = P.slice(); const a = Q[0], z = Q[Q.length - 1]; if (Math.abs(a[0] - z[0]) < 1e-6 && Math.abs(a[1] - z[1]) < 1e-6) Q = Q.slice(0, -1); if (Q.length < 3) return []; const s2 = area(Q); if (Math.abs(s2) < 1) return []; if (s2 < 0) Q.reverse(); return [Q]; };

    /* the ground's height for the photoreal view: USGS 3DEP bare earth (one 2.5 m grid from the elevation service; the
       ground changes little, so its date matters little), read from an uncompressed float TIFF */
    const DEMS = { d: null, gen: -1 };
    function tiffF32(buf) {
      const v = new DataView(buf), le = v.getUint16(0) === 0x4949, u16 = o => v.getUint16(o, le), u32 = o => v.getUint32(o, le); if (u16(2) !== 42) return null;
      const ifd = u32(4), n = u16(ifd), T = {}; for (let i = 0; i < n; i++) { const e = ifd + 2 + i * 12, tag = u16(e), type = u16(e + 2), cnt = u32(e + 4), val = e + 8;
        const one = k => type === 3 ? u16(k) : u32(k), size = type === 3 ? 2 : 4; T[tag] = cnt === 1 ? one(val) : (cnt * size <= 4 ? [one(val), one(val + size)].slice(0, cnt) : Array.from({ length: cnt }, (_, j) => one(u32(val) + j * size))); }
      const w = T[256], h = T[257]; if (!w || !h || (T[259] && T[259] !== 1) || [].concat(T[258])[0] !== 32) return null;
      const out = new Float32Array(w * h);
      if (T[324]) {   /* tiles (what the elevation service sends): row-major blocks, clipped at the right and bottom edges */
        const tw = T[322], th = T[323], offs = [].concat(T[324]), across = Math.ceil(w / tw);
        offs.forEach((o, k) => { const tx = (k % across) * tw, ty = Math.floor(k / across) * th; for (let r = 0; r < th && ty + r < h; r++) for (let i = 0; i < tw && tx + i < w; i++) out[(ty + r) * w + tx + i] = v.getFloat32(o + (r * tw + i) * 4, le); });
      } else {   /* strips */
        const offs = [].concat(T[273]), rps = T[278] || h; let row = 0;
        offs.forEach(o => { for (let r = 0; r < rps && row < h; r++, row++) for (let i = 0; i < w; i++) out[row * w + i] = v.getFloat32(o + (r * w + i) * 4, le); });
      }
      return { w, h, z: out };
    }
    async function loadDEM(gen) {
      if (DEMS.gen === gen) return; DEMS.gen = gen; DEMS.d = null;
      const h = RADIUS + 40, n = Math.round(2 * h / 2.5), [laN, loW] = toLL(-h, -h), [laS, loE] = toLL(h, h);
      const q = new URLSearchParams({ bbox: [loW, laS, loE, laN].map(x => x.toFixed(7)).join(','), bboxSR: '4326', imageSR: '4326', size: n + ',' + n, format: 'tiff', pixelType: 'F32', noDataInterpretation: 'esriNoDataMatchAny', interpolation: 'RSP_BilinearInterpolation', f: 'image' });
      try {
        const r = await fetch('https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/exportImage?' + q, { mode: 'cors', credentials: 'omit' }); if (!r.ok) return;
        const g = tiffF32(await r.arrayBuffer()); if (!g || gen !== S.gen) return; let ok = 0, n2 = 0; for (let i = 0; i < g.z.length; i += 97) { n2++; if (g.z[i] > -100 && g.z[i] < 3000 && Math.abs(g.z[i]) > 0.01) ok++; } if (ok < n2 * 0.8) return;   /* a real surface, not empty or no-data cells */
        const at = (x, z) => { const fx = clamp((x + h) / (2 * h) * (g.w - 1), 0, g.w - 1.001), fz = clamp((z + h) / (2 * h) * (g.h - 1), 0, g.h - 1.001), i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j, w = g.w, Z = g.z;
          return (Z[j * w + i] * (1 - tx) + Z[j * w + i + 1] * tx) * (1 - tz) + (Z[(j + 1) * w + i] * (1 - tx) + Z[(j + 1) * w + i + 1] * tx) * tz; };
        DEMS.d = { ground: at }; if (PR.tiles) prPlace(); if (prOn()) buildBuildings();
      } catch (e) { /* the photoreal glows then stand on the camera's ground */ }
    }

    /* ---------- buildings ---------- */
    function clearGroup(g, keep) { g.children.slice().forEach(o => { g.remove(o); if (o.geometry && !(keep && keep(o))) o.geometry.dispose(); }); }
    /* the wall a door goes on: the one facing the nearest street (a front door), or the alley or drive (a garage door) */
    function doorSpot(W, cls, kind) {
      const garage = cls === 'garage', home = cls === 'sf' || cls === 'mh' || cls === 'mf'; if ((!garage && !home) || !S.roads.length) return null;
      const [cx, cz] = centroid(W), road = nearestRoad(cx, cz, garage ? null : ['street', 'major', 'service'], garage ? 30 : 60); if (!road) return null;
      let best = null;
      for (let i = 0; i < W.length; i++) { const a2 = W[i], c2 = W[(i + 1) % W.length], dx = c2[0] - a2[0], dz = c2[1] - a2[1], len = Math.hypot(dx, dz); if (len < (garage ? 2.9 : 2.0)) continue;
        const nx = -dz / len, nz = dx / len, mx = (a2[0] + c2[0]) / 2, mz = (a2[1] + c2[1]) / 2, vx = road.x - mx, vz = road.z - mz, vl = Math.hypot(vx, vz) || 1, f = (nx * vx + nz * vz) / vl;
        if (f > 0.35 && (!best || f * Math.min(len, 9) > best.sc)) best = { sc: f * Math.min(len, 9), i, a: a2, c: c2, len, nx, nz }; }
      if (!best) return null;
      const F = FAC[kind] || FAC.brick, mods = Math.round(best.len / F.mw);
      best.garage = garage; best.w = garage ? (best.len >= 6 ? 4.9 : Math.min(2.5, best.len - 0.4)) : 0.98;
      best.s = garage ? best.len / 2 : clamp(mods >= 2 ? Math.floor(mods / 2) / mods * best.len : best.len * 0.16 + 0.1, 0.6, best.len - 0.6);
      return best;
    }
    /* windows as geometry on a wall from a to c: frames, a sill, muntins, glass that mirrors the sky; shutters on some siding */
    const GLASS = [C('#25313a'), C('#2c3a44'), C('#3a4650'), C('#4a4f52'), C('#33393d')], FRAME = { white: C('#f2f0ea'), bronze: C('#4a4440'), black: C('#26282a') }, SHUT = [C('#27342d'), C('#1f2326'), C('#3b2f2a'), C('#2a3442')];
    function windowsOn(Wg, Wf, a, c, topMin, kind, id, door) {
      const dx = c[0] - a[0], dz = c[1] - a[1], len = Math.hypot(dx, dz); if (len < 1.7 || topMin < 2.3) return;
      const tx = dx / len, tz = dz / len, nx = -tz, nz = tx, r = hash01(id + 'w'), apt = kind === 'stucco' || r > 0.92;
      const ww = apt ? 1.2 : 0.95 + r * 0.55, wh = apt ? 1.45 : 1.3 + r * 0.25, fh = apt ? 3.1 : 2.9, sp = apt ? 3.0 : 3.1 + r * 0.6;
      const floors = Math.max(1, Math.floor((topMin - 0.4) / fh)), count = Math.max(len >= 2.4 ? 1 : 0, Math.floor((len - 1.3) / sp));
      const fcol = kind === 'stucco' ? FRAME.bronze : r < 0.12 ? FRAME.black : FRAME.white, shutters = kind === 'siding' && r < 0.55, scol = SHUT[Math.floor(r * 97) % SHUT.length];
      const W3 = (s2, y, o) => [a[0] + tx * s2 + nx * o, y, a[1] + tz * s2 + nz * o];
      const face = (B, s0, s1, y0, y1, o, col, nrm) => quad(B, W3(s0, y0, o), W3(s1, y0, o), W3(s1, y1, o), W3(s0, y1, o), nrm, ZUV, col, id);
      const out = [nx, 0, nz], upN = [0, 1, 0], dnN = [0, -1, 0], lt = [-tx, 0, -tz], rt = [tx, 0, tz];
      const box = (B, s0, s1, y0, y1, o, col, sides) => { face(B, s0, s1, y0, y1, o, col, out);
        if (sides.includes('t')) quad(B, W3(s0, y1, 0), W3(s1, y1, 0), W3(s1, y1, o), W3(s0, y1, o), upN, ZUV, col, id);
        if (sides.includes('b')) quad(B, W3(s0, y0, o), W3(s1, y0, o), W3(s1, y0, 0), W3(s0, y0, 0), dnN, ZUV, col, id);
        if (sides.includes('l')) quad(B, W3(s0, y0, 0), W3(s0, y0, o), W3(s0, y1, o), W3(s0, y1, 0), lt, ZUV, col, id);
        if (sides.includes('r')) quad(B, W3(s1, y0, o), W3(s1, y0, 0), W3(s1, y1, 0), W3(s1, y1, o), rt, ZUV, col, id); };
      for (let k = 0; k < count; k++) {
        const s2 = len / 2 + (k - (count - 1) / 2) * sp; if (s2 - ww / 2 < 0.45 || s2 + ww / 2 > len - 0.45) continue;
        for (let f = 0; f < floors; f++) {
          const y0 = f * fh + 0.92, y1 = y0 + wh; if (y1 > topMin - 0.3) continue;
          if (door && f === 0 && Math.abs(s2 - door.s) < door.w / 2 + ww / 2 + 0.35) continue;
          const ft = 0.07, fo = 0.06, g = GLASS[Math.floor(hash01(id + ':' + k + ':' + f) * GLASS.length) % GLASS.length];
          face(Wg, s2 - ww / 2 + ft, s2 + ww / 2 - ft, y0 + ft, y1 - ft, 0.015, g, out);
          box(Wf, s2 - ww / 2, s2 - ww / 2 + ft, y0, y1, fo, fcol, 'r'); box(Wf, s2 + ww / 2 - ft, s2 + ww / 2, y0, y1, fo, fcol, 'l');
          box(Wf, s2 - ww / 2 + ft, s2 + ww / 2 - ft, y1 - ft, y1, fo, fcol, 'b'); box(Wf, s2 - ww / 2 + ft, s2 + ww / 2 - ft, y0, y0 + ft, fo, fcol, 't');
          box(Wf, s2 - ww / 2 - 0.06, s2 + ww / 2 + 0.06, y0 - 0.07, y0, 0.11, TRIM.cap, 't');
          if (!apt) { face(Wf, s2 - 0.018, s2 + 0.018, y0 + ft, y1 - ft, 0.035, fcol, out); face(Wf, s2 - ww / 2 + ft, s2 + ww / 2 - ft, (y0 + y1) / 2 - 0.018, (y0 + y1) / 2 + 0.018, 0.036, fcol, out); }
          if (shutters) { face(Wf, s2 - ww / 2 - 0.46, s2 - ww / 2 - 0.04, y0, y1, 0.03, scol, out); face(Wf, s2 + ww / 2 + 0.04, s2 + ww / 2 + 0.46, y0, y1, 0.03, scol, out); }
        }
      }
    }
    function buildBuildings() {
      clearGroup(G.bld); clearGroup(G.fx); S.pick = []; S.geo = new Map(); S.parts = [];
      if (!S.img) return; mats();
      const img = S.img, Bt = { brick: batch(), siding: batch(), stucco: batch(), store: batch(), glass: batch(), metal: batch(), trim: batch(), roof: batch(), win: batch(), winframe: batch() };
      const SH = { p: [], n: [], c: [], h: [] }, HA = { p: [], c: [] }, ED = { p: [], c: [] };
      const lean = TR.res && img.zoom === TR.res.source.zoom ? TR.res.lean : [0, 0];   /* the photo shows a roof this far over per metre of height */
      const imgUV = (x, z) => [(x - img.xW) / (img.xE - img.xW), (-z - img.nS) / (img.nN - img.nS)], uv3 = p => imgUV(p[0] + lean[0] * p[1], p[2] + lean[1] * p[1]);
      const occ = [], photo = prOn(), haloY = photo ? 0.5 : 0.16, tc = { match: 0, redrawn: 0, hidden: 0 }; let n = 0;
      env.buildings().forEach(b => {
        const [cx, cz] = toL(b.lat, b.lon); if (Math.hypot(cx - S.x, cz - S.z) > RADIUS + 30 || Math.hypot(cx, cz) > RADIUS + 40) return;
        const tb = TR.res ? TR.res.buildings.get(b.id) : null, rings = tb && tb.status === 'redrawn' ? normRing(tb.ring) : ringsOf(b); if (!rings.length) return; n++; if (tb && tc[tb.status] != null) tc[tb.status]++;
        const id = b.id, cls = b.cls || 'unk', hRaw = Math.max(2.4, tb && tb.status === 'redrawn' ? tb.h : env.height(b)), flat = env.flat(b), scol = C(env.color(b)), kind = facadeOf(b, hRaw), F = FAC[kind], tint = tintOf(kind, id), WB = Bt[kind], photo = MAT[kind] && MAT[kind].userData.photo, tile = PHOTO_TILE[kind] || 2;
        const start = {}, p0 = {}; Object.keys(Bt).forEach(k => { start[k] = Bt[k].own.length; p0[k] = Bt[k].p.length; }); const sh0 = SH.h.length / 6, sp0 = SH.p.length, hp0 = HA.p.length, ep0 = ED.p.length, yb = photo ? groundRel(cx, cz) : 0;
        const geo = { rings: [], flat, h: hRaw, kind, cls, door: null, yb, trace: tb ? tb.status : null };
        rings.forEach((P, ri) => {
          const ar = area(P), rec = { P, W: P, Q: null, eave: hRaw, h: hRaw, flat };
          /* a wall run from a to c, its top following topAt (the measured roof) or level; photo materials tile at their real
             size (siding laid horizontal), painted ones fit their window module to the wall */
          const wallRun = (a2, c2, topAt) => { const dx = c2[0] - a2[0], dz = c2[1] - a2[1], len = Math.hypot(dx, dz); if (len < 0.05) return; const nrm = [-dz / len, 0, dx / len], k = topAt.level ? 1 : Math.max(1, Math.ceil(len / 0.9));
            const mods = Math.round(len / F.mw), pier = mods < 1 || len < F.mw * 0.6;
            for (let j = 0; j < k; j++) { const s0 = len * j / k, s1 = len * (j + 1) / k, p0 = [a2[0] + dx * j / k, a2[1] + dz * j / k], p1 = [a2[0] + dx * (j + 1) / k, a2[1] + dz * (j + 1) / k], t0 = topAt(p0[0], p0[1]), t1 = topAt(p1[0], p1[1]);
              const uv = (sx, y) => photo ? (kind === 'siding' ? [y / tile, sx / tile] : [sx / tile, y / tile]) : [pier ? 0.02 + 0.2 * sx / len : sx * mods / len, y / F.fh];
              quad(WB, [p0[0], 0, p0[1]], [p1[0], 0, p1[1]], [p1[0], t1, p1[1]], [p0[0], t0, p0[1]], nrm, [uv(s0, 0), uv(s1, 0), uv(s1, t1), uv(s0, t0)], tint, id); } };
          const wallsOf = (W, topAt, door) => { for (let i = 0; i < W.length; i++) { const a2 = W[i], c2 = W[(i + 1) % W.length]; wallRun(a2, c2, topAt);
            if (photo && kind !== 'metal') { const tm = Math.min(topAt(a2[0], a2[1]), topAt(c2[0], c2[1]), topAt((a2[0] + c2[0]) / 2, (a2[1] + c2[1]) / 2)); windowsOn(Bt.win, Bt.winframe, a2, c2, tm, kind, id, door && door.i === i ? door : null); } } };
          const capAt = (Q, y, B, uvf, up) => { let tris = []; try { tris = THREE.ShapeUtils.triangulateShape(Q.map(p => new THREE.Vector2(p[0], -p[1])), []); } catch (e) { tris = []; }
            const nrm = [0, up === false ? -1 : 1, 0]; tris.forEach(t => { const a2 = [Q[t[0]][0], y, Q[t[0]][1]], b2 = [Q[t[1]][0], y, Q[t[1]][1]], c2 = [Q[t[2]][0], y, Q[t[2]][1]]; tri(B, a2, b2, c2, nrm, uvf(a2), uvf(b2), uvf(c2), B === Bt.roof ? WHITE : TRIM.cap, id, B === Bt.roof ? [a2[0] / 2, a2[2] / 2] : null, B === Bt.roof ? [b2[0] / 2, b2[2] / 2] : null, B === Bt.roof ? [c2[0] / 2, c2[2] / 2] : null); }); };
          const flatRing = (A2, B2, y, B, col, ny) => { for (let i = 0; i < A2.length; i++) { const j = (i + 1) % A2.length; quad(B, [A2[i][0], y, A2[i][1]], [A2[j][0], y, A2[j][1]], [B2[j][0], y, B2[j][1]], [B2[i][0], y, B2[i][1]], [0, ny, 0], ZUV, col, id); } };
          const ring = (A2, B2, ya, yb, B, col, inward) => { for (let i = 0; i < A2.length; i++) { const j = (i + 1) % A2.length, a2 = A2[i], c2 = A2[j], dx = c2[0] - a2[0], dz = c2[1] - a2[1], len = Math.hypot(dx, dz) || 1, sg = inward ? -1 : 1;
            quad(B, [a2[0], ya, a2[1]], [c2[0], ya, c2[1]], [B2[j][0], yb, B2[j][1]], [B2[i][0], yb, B2[i][1]], [sg * -dz / len, 0, sg * dx / len], ZUV, col, id); } };
          const level = y => { const f = () => y; f.level = true; return f; };
          if (!flat) {
            /* a hipped roof: the footprint is the eave line, offset inward to the ridge; the walls stand 42 cm in, under the eaves */
            let d = Math.min(9, 0.46 * minWidth(P)), Q = d > 0.25 ? offsetRing(P, -d) : null, tries = 0;
            while (Q && !validOffset(P, Q) && tries++ < 4) { d *= 0.7; Q = offsetRing(P, -d); }
            let rise; if (Q && validOffset(P, Q)) rise = d * 0.42; else { const [mx, mz] = centroid(P); Q = P.map(p => [mx + (p[0] - mx) * 0.35, mz + (p[1] - mz) * 0.35]); rise = clamp(0.2 * Math.sqrt(ar), 0.8, 3); }
            let eave = hRaw - rise; if (eave < 2.5) { eave = Math.max(2.2, Math.min(2.5, hRaw - 0.6)); rise = Math.max(0.4, hRaw - eave); }
            const top = eave + rise, Wo = offsetRing(P, -0.42), W = validOffset(P, Wo) && area(Wo) > 0.55 * ar ? Wo : P;
            if (ri === 0) geo.door = doorSpot(W, cls, kind);
            wallsOf(W, level(eave), ri === 0 ? geo.door : null);
            if (W !== P) flatRing(P, W, eave, Bt.trim, TRIM.white, -1);   /* the soffit */
            for (let i = 0; i < P.length; i++) { const j = (i + 1) % P.length, a2 = P[i], c2 = P[j], dx = c2[0] - a2[0], dz = c2[1] - a2[1], len = Math.hypot(dx, dz) || 1; quad(Bt.trim, [a2[0], eave - 0.22, a2[1]], [c2[0], eave - 0.22, c2[1]], [c2[0], eave + 0.03, c2[1]], [a2[0], eave + 0.03, a2[1]], [-dz / len, 0, dx / len], ZUV, TRIM.white, id); }
            const Wf = offsetRing(W, 0.03); ring(Wf, Wf, 0, 0.34, Bt.trim, TRIM.found, false);
            for (let i = 0; i < P.length; i++) {
              const j = (i + 1) % P.length, a2 = [P[i][0], eave, P[i][1]], c2 = [P[j][0], eave, P[j][1]], dq = [Q[j][0], top, Q[j][1]], e = [Q[i][0], top, Q[i][1]];
              const ux = c2[0] - a2[0], uz = c2[2] - a2[2], ul = Math.hypot(ux, uz) || 1, tx = ux / ul, tz = uz / ul;
              const v1 = [e[0] - a2[0], e[1] - a2[1], e[2] - a2[2]], v2 = [dq[0] - a2[0], dq[1] - a2[1], dq[2] - a2[2]], v = Math.hypot(...v1) > Math.hypot(...v2) ? v1 : v2;
              let nr = [-uz * v[1], uz * v[0] - ux * v[2], ux * v[1]];
              const nl = Math.hypot(nr[0], nr[1], nr[2]) || 1; nr = nr.map(x => x / nl); if (nr[1] < 0) nr = nr.map(x => -x);
              const sx = nr[1] * tz, sy = nr[2] * tx - nr[0] * tz, sz = -nr[1] * tx, sl = Math.hypot(sx, sy, sz) || 1, sg = sy >= 0 ? 1 / sl : -1 / sl;
              const w1 = p => [((p[0] - a2[0]) * tx + (p[2] - a2[2]) * tz) / 2, ((p[0] - a2[0]) * sx + (p[1] - a2[1]) * sy + (p[2] - a2[2]) * sz) * sg / 2];
              tri(Bt.roof, a2, c2, dq, nr, uv3(a2), uv3(c2), uv3(dq), WHITE, id, w1(a2), w1(c2), w1(dq));
              tri(Bt.roof, a2, dq, e, nr, uv3(a2), uv3(dq), uv3(e), WHITE, id, w1(a2), w1(dq), w1(e));
            }
            if (area(Q) > 0.05) capAt(Q, top, Bt.roof, uv3);
            Object.assign(rec, { W, Q, eave, h: top });
            occ.push({ id, P, h: eave + rise * 0.5 + yb });
          } else {
            /* a flat roof behind a parapet */
            const para = ar > 120 && hRaw > 4.2, deck = para ? hRaw - 0.9 : hRaw, Pi = para ? offsetRing(P, -0.3) : null, inner = Pi && validOffset(P, Pi) ? Pi : null;
            wallsOf(P, level(hRaw), null);
            if (inner) { ring(inner, inner, deck, hRaw, Bt.trim, TRIM.para, true); flatRing(P, inner, hRaw, Bt.trim, TRIM.cap, 1); capAt(inner, deck, Bt.roof, uv3); }
            else capAt(P, hRaw, Bt.roof, uv3);
            Object.assign(rec, { eave: hRaw, h: hRaw, Q: inner || P });
            occ.push({ id, P, h: hRaw + yb });
          }
          geo.rings.push(rec);
          /* the glow shell: the footprint pushed out 55 cm and up past the eaves; the halo: a pool of the colour on the ground */
          const Sg = offsetRing(P, 0.55), sTop = flat ? rec.h + 0.6 : rec.eave + 0.55;
          for (let i = 0; i < Sg.length; i++) { const j = (i + 1) % Sg.length, a2 = Sg[i], c2 = Sg[j], dx = c2[0] - a2[0], dz = c2[1] - a2[1], len = Math.hypot(dx, dz) || 1, nx = -dz / len, nz = dx / len;
            [[a2, 0, 0], [c2, 0, 0], [c2, sTop, 1], [a2, 0, 0], [c2, sTop, 1], [a2, sTop, 1]].forEach(([p, y, hh]) => { SH.p.push(p[0], y, p[1]); SH.n.push(nx, 0, nz); SH.c.push(scol.r, scol.g, scol.b); SH.h.push(hh); }); }
          const H1 = offsetRing(P, 0.3), H2 = offsetRing(P, 2.8);
          for (let i = 0; i < H1.length; i++) { const j = (i + 1) % H1.length; [[H1[i], 0.5], [H1[j], 0.5], [H2[j], 0], [H1[i], 0.5], [H2[j], 0], [H2[i], 0]].forEach(([p, al]) => { HA.p.push(p[0], haloY, p[1]); HA.c.push(scol.r * 1.2, scol.g * 1.2, scol.b * 1.2, al); }); }
          const eC = [scol.r * 1.35, scol.g * 1.35, scol.b * 1.35], E = (p, y, q, y2) => { ED.p.push(p[0], y, p[1], q[0], y2, q[1]); ED.c.push(...eC, ...eC); };
          const eAt = () => rec.eave + 0.04;
          for (let i = 0; i < P.length; i++) { const j = (i + 1) % P.length; E(P[i], eAt(P[i]), P[j], eAt(P[j])); if (!flat) { E(P[i], rec.eave + 0.04, rec.Q[i], rec.h + 0.04); E(rec.Q[i], rec.h + 0.04, rec.Q[j], rec.h + 0.04); } }
        });
        if (yb) { const lift = (arr, from) => { for (let q = from + 1; q < arr.length; q += 3) arr[q] += yb; }; Object.keys(Bt).forEach(k => lift(Bt[k].p, p0[k])); lift(SH.p, sp0); lift(HA.p, hp0); lift(ED.p, ep0); }
        S.geo.set(id, geo);
        const ranges = {}; Object.keys(Bt).forEach(k => { if (Bt[k].own.length > start[k]) ranges[k] = [start[k], Bt[k].own.length]; });
        S.parts.push({ id, ranges, shell: [sh0, SH.h.length / 6], status: b.status, kind });
      });
      Object.entries(Bt).forEach(([k, B]) => { const m = batchMesh(B, MAT[k], k); if (m) { if (k === 'roof') { MAT.roof.map = img.tex; MAT.roof.needsUpdate = true; } if (k === 'win') m.castShadow = false; G.bld.add(m); S.pick.push(m); } });
      S.batches = Bt;
      if (SH.p.length) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(SH.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(SH.n, 3)); g.setAttribute('gcol', new THREE.Float32BufferAttribute(SH.c, 3)); g.setAttribute('gh', new THREE.Float32BufferAttribute(SH.h, 1)); const m = new THREE.Mesh(g, MAT.shell); m.renderOrder = 2; m.name = 'glow'; G.fx.add(m); S.shell = g; } else S.shell = null;
      if (HA.p.length) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(HA.p, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(HA.c, 4)); const m = new THREE.Mesh(g, MAT.halo); m.renderOrder = 1; m.name = 'halo'; G.fx.add(m); }
      if (ED.p.length) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(ED.p, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(ED.c, 3)); const m = new THREE.LineSegments(g, MAT.edge); m.renderOrder = 3; m.name = 'edges'; G.fx.add(m); }
      occIndex(occ); S.built = n; S.traced = tc;
      buildDoors(); highlight(); labels(); treesSoon(); need();
    }
    const WHITE = new THREE.Color(1, 1, 1);

    /* ---------- doors: a front door on the wall that faces the nearest street, a garage door on the wall facing the alley or drive ---------- */
    function nearestRoad(x, z, kinds, maxD) {
      let best = null;
      S.roads.forEach(r => { if (kinds && !kinds.includes(r.kind)) return; for (let i = 0; i + 1 < r.pts.length; i++) { const a = r.pts[i], b = r.pts[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz; const t = L2 ? clamp(((x - a[0]) * dx + (z - a[1]) * dz) / L2, 0, 1) : 0, px = a[0] + t * dx, pz = a[1] + t * dz, d = Math.hypot(px - x, pz - z); if (d <= maxD && (!best || d < best.d)) best = { x: px, z: pz, d }; } });
      return best;
    }
    function buildDoors() {
      G.bld.children.filter(o => o.name === 'doors').forEach(o => { G.bld.remove(o); o.geometry.dispose(); }); S.pick = S.pick.filter(o => o.name !== 'doors'); S.doorRanges = new Map();
      if (!S.geo.size) return; mats();
      const B = batch();
      S.geo.forEach((g, id) => {
        const best = g.door; if (!best) return;
        const t0 = B.own.length, dirx = (best.c[0] - best.a[0]) / best.len, dirz = (best.c[1] - best.a[1]) / best.len, off = 0.035;
        const col = best.garage ? C(hash01(id + 'g') < 0.7 ? '#ffffff' : '#e6dccb') : C(DOORS[Math.floor(hash01(id + 'd') * DOORS.length) % DOORS.length]);
        const put = (s2, w, h, u0, u1) => { const p0 = [best.a[0] + dirx * (s2 - w / 2) + best.nx * off, best.a[1] + dirz * (s2 - w / 2) + best.nz * off], p1 = [best.a[0] + dirx * (s2 + w / 2) + best.nx * off, best.a[1] + dirz * (s2 + w / 2) + best.nz * off];
          const yy = g.yb || 0; quad(B, [p0[0], 0.02 + yy, p0[1]], [p1[0], 0.02 + yy, p1[1]], [p1[0], h + yy, p1[1]], [p0[0], h + yy, p0[1]], [best.nx, 0, best.nz], [[u0, 0], [u1, 0], [u1, 1], [u0, 1]], col, id); };
        if (best.garage) { if (best.len >= 6) { put(best.len / 2 - 1.24, 2.4, 2.15, 0.505, 0.995); put(best.len / 2 + 1.24, 2.4, 2.15, 0.505, 0.995); } else put(best.len / 2, best.w, 2.15, 0.505, 0.995); }
        else put(best.s, 0.98, 2.1, 0.005, 0.495);
        if (B.own.length > t0) S.doorRanges.set(id, [t0, B.own.length]);
      });
      const m = batchMesh(B, MAT.door, 'doors'); S.doorBatch = B; if (m) { G.bld.add(m); S.pick.push(m); }
      need();
    }

    /* ---------- the current building: a white outline seen through everything and a brighter glow; the one pointed at, an outline ---------- */
    function outlineOf(id, mat) {
      const g = S.geo.get(id); if (!g) return null; const E = [];
      g.rings.forEach(r => { const P = r.P, W = r.W, Q = r.Q || P, ea = () => r.eave;
        for (let i = 0; i < P.length; i++) { const j = (i + 1) % P.length, k = (i + 1) % W.length; E.push(W[i][0], 0.05, W[i][1], W[k][0], 0.05, W[k][1], W[i][0], 0.05, W[i][1], W[i][0], r.eave, W[i][1], P[i][0], ea(P[i]), P[i][1], P[j][0], ea(P[j]), P[j][1]);
          if (!r.flat) E.push(P[i][0], r.eave, P[i][1], Q[i][0], r.h, Q[i][1], Q[i][0], r.h, Q[i][1], Q[j][0], r.h, Q[j][1]); } });
      if (g.yb) for (let q = 1; q < E.length; q += 3) E[q] += g.yb;
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(E, 3)); return new THREE.LineSegments(geo, mat);
    }
    function highlight() {
      clearGroup(G.sel); clearGroup(O.sel); mats();
      const cur = S.cur && S.geo.get(S.cur), b = S.cur && env.byId(S.cur);
      if (cur && b) { const o = outlineOf(S.cur, MAT.selEdge); if (o) { o.renderOrder = 5; O.sel.add(o); }
        const col = C(env.color(b)), pos = [], nrm = [], gc = [], gh = [];
        cur.rings.forEach(r => { const Sg = offsetRing(r.P, 0.9), top = (r.flat ? r.h : r.eave) + 1.0;
          for (let i = 0; i < Sg.length; i++) { const j = (i + 1) % Sg.length, a = Sg[i], c = Sg[j], dx = c[0] - a[0], dz = c[1] - a[1], len = Math.hypot(dx, dz) || 1;
            [[a, 0, 0], [c, 0, 0], [c, top, 1], [a, 0, 0], [c, top, 1], [a, top, 1]].forEach(([p, y, hh]) => { pos.push(p[0], y + (cur.yb || 0), p[1]); nrm.push(-dz / len, 0, dx / len); gc.push(col.r, col.g, col.b); gh.push(hh); }); } });
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); g.setAttribute('gcol', new THREE.Float32BufferAttribute(gc, 3)); g.setAttribute('gh', new THREE.Float32BufferAttribute(gh, 1));
        const m = new THREE.Mesh(g, MAT.aura); m.renderOrder = 4; G.sel.add(m); }
      if (S.hov && S.hov !== S.cur) { const o = outlineOf(S.hov, MAT.hov); if (o) G.sel.add(o); }
      need();
    }

    /* ---------- labels over the buildings near the camera, and the street names: drawn last, untouched by the tone mapping,
       hidden when a building stands between them and the camera ---------- */
    const OCC = { cells: new Map(), list: [] }, OC = 16;
    function occIndex(list) {
      OCC.cells = new Map(); OCC.list = list;
      list.forEach((o, i) => { let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; o.P.forEach(p => { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); }); Object.assign(o, { x0, x1, z0, z1 });
        for (let cx = Math.floor(x0 / OC); cx <= Math.floor(x1 / OC); cx++) for (let cz = Math.floor(z0 / OC); cz <= Math.floor(z1 / OC); cz++) { const k = cx + ',' + cz, a = OCC.cells.get(k); if (a) a.push(i); else OCC.cells.set(k, [i]); } });
    }
    function segBlocked(ax, ay, az, bx, by, bz, o) {
      if (Math.max(ax, bx) < o.x0 || Math.min(ax, bx) > o.x1 || Math.max(az, bz) < o.z0 || Math.min(az, bz) > o.z1 || Math.min(ay, by) >= o.h) return false;
      const ts = [0, 1], P = o.P, dx = bx - ax, dz = bz - az;
      for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length], ex = q[0] - p[0], ez = q[1] - p[1], den = dx * ez - dz * ex; if (Math.abs(den) < 1e-12) continue; const t = ((p[0] - ax) * ez - (p[1] - az) * ex) / den, u = ((p[0] - ax) * dz - (p[1] - az) * dx) / den; if (t > 0 && t < 1 && u >= 0 && u <= 1) ts.push(t); }
      ts.sort((x, y) => x - y);
      for (let k = 0; k + 1 < ts.length; k++) { const tm = (ts[k] + ts[k + 1]) / 2; if (ts[k + 1] - ts[k] > 1e-6 && inPoly(ax + dx * tm, az + dz * tm, P) && Math.min(ay + (by - ay) * ts[k], ay + (by - ay) * ts[k + 1]) < o.h) return true; }
      return false;
    }
    function occluded(ax, ay, az, bx, by, bz, skip) {
      const L = Math.hypot(bx - ax, bz - az), steps = Math.max(1, Math.ceil(L / (OC * 0.5))), seen = new Set();
      for (let s = 0; s <= steps; s++) { const x = ax + (bx - ax) * s / steps, z = az + (bz - az) * s / steps, arr = OCC.cells.get(Math.floor(x / OC) + ',' + Math.floor(z / OC)); if (!arr) continue;
        for (const i of arr) { if (seen.has(i)) continue; seen.add(i); const o = OCC.list[i]; if (o.id !== skip && segBlocked(ax, ay, az, bx, by, bz, o)) return true; } }
      return false;
    }
    const labelCache = new Map();
    function labelSprite(text, bg, fg, ring) {
      const key = text + bg + fg + (ring ? 1 : 0); let m = labelCache.get(key);
      if (!m) {
        const c = canvas(8, 58), g = c.getContext('2d'), fs = 34; g.font = `600 ${fs}px "IBM Plex Sans", system-ui, sans-serif`; const w = Math.ceil(g.measureText(text).width) + 36; c.width = w; c.height = 58;
        g.font = `600 ${fs}px "IBM Plex Sans", system-ui, sans-serif`; g.fillStyle = bg; const r = 26; g.beginPath(); g.moveTo(r, 3); g.arcTo(w - 3, 3, w - 3, 55, r); g.arcTo(w - 3, 55, 3, 55, r); g.arcTo(3, 55, 3, 3, r); g.arcTo(3, 3, w - 3, 3, r); g.closePath(); g.fill();
        if (ring) { g.lineWidth = 5; g.strokeStyle = '#ffffff'; g.stroke(); } g.fillStyle = fg; g.textBaseline = 'middle'; g.fillText(text, 18, 30);
        const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; m = { mat: new THREE.SpriteMaterial({ map: t, depthTest: false, depthWrite: false, transparent: true, toneMapped: false, fog: false }), aspect: w / 58 }; labelCache.set(key, m);
        if (labelCache.size > 400) { const k0 = labelCache.keys().next().value, o = labelCache.get(k0); o.mat.map.dispose(); o.mat.dispose(); labelCache.delete(k0); }
      }
      const s = new THREE.Sprite(m.mat); s.userData.aspect = m.aspect; s.renderOrder = 10; return s;
    }
    function labels() {
      O.labels.children.slice().forEach(o => O.labels.remove(o)); S.labels = [];
      const near = env.buildings().map(b => { const [x, z] = toL(b.lat, b.lon); return { b, x, z, d: Math.hypot(x - S.x, z - S.z) }; }).filter(o => o.d < 110 || o.b.id === S.cur).sort((a, b) => a.d - b.d).slice(0, 22);
      near.forEach(o => { const b = o.b, s = labelSprite(env.label(b), env.color(b), env.labelInk(b), b.id === S.cur); const g = S.geo.get(b.id), top = g ? Math.max(...g.rings.map(r => r.h)) : Math.max(2.4, env.height(b)); s.position.set(o.x, top + 2.4 + (g ? g.yb || 0 : 0), o.z); s.userData.kind = 'b'; s.userData.id = b.id; s.userData.cur = b.id === S.cur; O.labels.add(s); S.labels.push(s); });
      const named = new Map(); S.roads.forEach(r => { if (!r.name || r.kind === 'path' || r.kind === 'drive') return; let best = null; r.pts.forEach(p => { const d = Math.hypot(p[0] - S.x, p[1] - S.z); if (!best || d < best.d) best = { d, p }; }); if (best && best.d < 240) { const o = named.get(r.name); if (!o || best.d < o.d) named.set(r.name, best); } });
      [...named.entries()].sort((a, b) => a[1].d - b[1].d).slice(0, 16).forEach(([name, o]) => { const s = labelSprite(name, 'rgba(16,25,31,.78)', '#ffffff', false); s.position.set(o.p[0], 2.2 + (prOn() ? groundRel(o.p[0], o.p[1]) : 0), o.p[1]); s.userData.kind = 'r'; O.labels.add(s); S.labels.push(s); });
      need();
    }

    /* ---------- streets and alleys: asphalt and concrete on the ground, and the paths the camera walks ---------- */
    const WALK = new Set(['street', 'major', 'alley', 'service']);
    const ROADW = { major: [12, 0.1, 'asphalt'], street: [8.2, 0.09, 'asphalt'], service: [5.2, 0.085, 'asphalt'], alley: [4.2, 0.08, 'concrete'], drive: [3, 0.075, 'concrete'], path: [1.6, 0.07, 'concrete'] };
    function ribbon(B, pts, w, y, tile, off) {
      const n = pts.length, hw = w / 2, L = [], Rr = [], o = off || 0;
      for (let i = 0; i < n; i++) {
        const p = pts[i], a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)]; let t1x = 0, t1z = 0, t2x = 0, t2z = 0;
        if (i > 0) { const dx = p[0] - a[0], dz = p[1] - a[1], l = Math.hypot(dx, dz) || 1; t1x = dx / l; t1z = dz / l; } if (i < n - 1) { const dx = b[0] - p[0], dz = b[1] - p[1], l = Math.hypot(dx, dz) || 1; t2x = dx / l; t2z = dz / l; }
        if (i === 0) { t1x = t2x; t1z = t2z; } if (i === n - 1) { t2x = t1x; t2z = t1z; }
        let tx = t1x + t2x, tz = t1z + t2z; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl; const nx = -tz, nz = tx, k = 1 / Math.max(0.4, nx * -t1z + nz * t1x);
        L.push([p[0] + nx * (o + hw) * k, p[1] + nz * (o + hw) * k]); Rr.push([p[0] + nx * (o - hw) * k, p[1] + nz * (o - hw) * k]);
      }
      const up = [0, 1, 0], uv = (x, z) => [x / tile, z / tile];
      for (let i = 0; i + 1 < n; i++) { const a = [L[i][0], y, L[i][1]], b = [Rr[i][0], y, Rr[i][1]], c = [Rr[i + 1][0], y, Rr[i + 1][1]], d = [L[i + 1][0], y, L[i + 1][1]]; tri(B, a, b, c, up, uv(a[0], a[2]), uv(b[0], b[2]), uv(c[0], c[2]), WHITE, 0); tri(B, a, c, d, up, uv(a[0], a[2]), uv(c[0], c[2]), uv(d[0], d[2]), WHITE, 0); }
      if (!off) [0, n - 1].concat(pts.map((_, i) => i).filter(i => i > 0 && i < n - 1)).forEach(i => { const p = pts[i]; for (let s = 0; s < 12; s++) { const a0 = s / 12 * Math.PI * 2, a1 = (s + 1) / 12 * Math.PI * 2, a = [p[0], y, p[1]], b = [p[0] + Math.cos(a0) * hw, y, p[1] + Math.sin(a0) * hw], c = [p[0] + Math.cos(a1) * hw, y, p[1] + Math.sin(a1) * hw]; tri(B, a, b, c, up, uv(a[0], a[2]), uv(b[0], b[2]), uv(c[0], c[2]), WHITE, 0); } });
    }
    function setRoads(list) {
      clearGroup(G.roads); mats();
      S.roads = list.map(r => ({ name: r.name || '', kind: r.kind, pts: r.pts.map(([la, lo]) => toL(la, lo)) })).filter(r => r.pts.length >= 2);
      const by = {}; S.roads.forEach(r => { const spec = ROADW[r.kind] || ROADW.street, B = by[r.kind] = by[r.kind] || batch(); ribbon(B, r.pts, spec[0], spec[1], spec[2] === 'asphalt' ? 4 : 3); });
      Object.entries(by).forEach(([k, B]) => { const spec = ROADW[k] || ROADW.street, m = batchMesh(B, MAT[spec[2]], 'road-' + k); if (m) { m.castShadow = false; m.renderOrder = -1; G.roads.add(m); } });
      const paint = batch(), paintW = batch(); S.roads.filter(r => r.kind === 'major').forEach(r => { ribbon(paint, r.pts, 0.11, 0.115, 1, 0.12); ribbon(paint, r.pts, 0.11, 0.115, 1, -0.12); ribbon(paintW, r.pts, 0.12, 0.115, 1, 5.4); ribbon(paintW, r.pts, 0.12, 0.115, 1, -5.4); });
      [[paint, MAT.paintY], [paintW, MAT.paintW]].forEach(([B, M]) => { const m = batchMesh(B, M, 'paint'); if (m) { m.castShadow = false; G.roads.add(m); } });
      S.graph = S.roads.filter(r => WALK.has(r.kind)); S.on = null; buildBuildings(); need();
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

    /* ---------- trees: where the aerial photograph shows canopy ---------- */
    /* The inner imagery (about 25 cm a pixel) is read in 1 m cells. A cell is canopy when it is textured and dark, and green or
       brown (leafless winter crowns read brown); footprints and roads are masked out, specks are removed, and a distance
       transform finds the crowns' centres and radii. The crowns are drawn as lumpy instanced shapes tinted with the photo's
       own colour there; their shapes are generic, their places and sizes come from the photo. */
    function detectTrees() {
      const img = S.img; if (!img || !img.c || !img.ok) return [];
      const N = img.c.width, CP = 4, M = Math.floor(N / CP); let data;
      try { data = img.c.getContext('2d').getImageData(0, 0, N, N).data; } catch (e) { return []; }
      const mx = (img.xE - img.xW) / M, mz = (img.nN - img.nS) / M, can = new Uint8Array(M * M), cr = new Float32Array(M * M), cg = new Float32Array(M * M), cb = new Float32Array(M * M);
      for (let cy = 0; cy < M; cy++) for (let cx = 0; cx < M; cx++) {
        let sr = 0, sg = 0, sb = 0, sy = 0, syy = 0;
        for (let y = 0; y < CP; y++) { let i = ((cy * CP + y) * N + cx * CP) * 4; for (let x = 0; x < CP; x++, i += 4) { const r = data[i], g = data[i + 1], b = data[i + 2], Y = 0.299 * r + 0.587 * g + 0.114 * b; sr += r; sg += g; sb += b; sy += Y; syy += Y * Y; } }
        const k = cy * M + cx, q = CP * CP, r = sr / q, g = sg / q, b = sb / q, Y = sy / q, sd = Math.sqrt(Math.max(0, syy / q - Y * Y)), exg = 2 * g - r - b; cr[k] = r; cg[k] = g; cb[k] = b;
        can[k] = ((exg > 8 && Y < 150 && sd > 7) || (exg > 0 && Y < 100 && sd > 9) || (r >= b - 4 && Y < 118 && sd > 15 && exg > -14)) && b < g + 22 ? 1 : 0;
      }
      /* footprints and roads out */
      const mc = canvas(M), mg = mc.getContext('2d'); mg.fillStyle = '#000'; mg.strokeStyle = '#000'; mg.lineCap = 'round'; mg.lineJoin = 'round';
      const cxOf = x => (x - img.xW) / mx, cyOf = z => (img.nN + z) / mz;
      S.geo.forEach(g => g.rings.forEach(r => { mg.beginPath(); r.P.forEach((p, i) => { const X = cxOf(p[0]), Y = cyOf(p[1]); if (i) mg.lineTo(X, Y); else mg.moveTo(X, Y); }); mg.closePath(); mg.fill(); }));
      S.roads.forEach(r => { const w = (ROADW[r.kind] || ROADW.street)[0]; mg.lineWidth = w / mx + 1; mg.beginPath(); r.pts.forEach((p, i) => { const X = cxOf(p[0]), Y = cyOf(p[1]); if (i) mg.lineTo(X, Y); else mg.moveTo(X, Y); }); mg.stroke(); });
      const md = mg.getImageData(0, 0, M, M).data; for (let k = 0; k < M * M; k++) if (md[k * 4 + 3] > 40) can[k] = 0;
      const morph = (src, grow) => { const out = new Uint8Array(M * M); for (let y = 1; y < M - 1; y++) for (let x = 1; x < M - 1; x++) { let s = 0; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) s += src[(y + j) * M + x + i]; out[y * M + x] = grow ? (s > 0 ? 1 : 0) : (s === 9 ? 1 : 0); } return out; };
      let m = morph(morph(can, false), true); m = morph(morph(m, true), false);
      for (let k = 0; k < M * M; k++) if (md[k * 4 + 3] > 40) m[k] = 0;
      const D = new Float32Array(M * M); for (let k = 0; k < M * M; k++) D[k] = m[k] ? 1e6 : 0;
      for (let y = 1; y < M; y++) for (let x = 1; x < M - 1; x++) { const k = y * M + x; if (!D[k]) continue; D[k] = Math.min(D[k], D[k - 1] + 1, D[k - M] + 1, D[k - M - 1] + 1.414, D[k - M + 1] + 1.414); }
      for (let y = M - 2; y >= 0; y--) for (let x = M - 2; x >= 1; x--) { const k = y * M + x; if (!D[k]) continue; D[k] = Math.min(D[k], D[k + 1] + 1, D[k + M] + 1, D[k + M + 1] + 1.414, D[k + M - 1] + 1.414); }
      const cand = [];
      for (let y = 2; y < M - 2; y++) for (let x = 2; x < M - 2; x++) { const k = y * M + x, d = D[k]; if (d < 1.8 || d > 1e5) continue; let top = true; for (let j = -2; j <= 2 && top; j++) for (let i = -2; i <= 2; i++) { const v = D[k + j * M + i]; if (v > d || (v === d && (j * M + i) > 0)) { top = false; break; } } if (top) cand.push({ x, y, d }); }
      cand.sort((a, b) => b.d - a.d);
      const out = [], grid = new Map(), GC = 8, key = (x, y) => Math.floor(x / GC) + ',' + Math.floor(y / GC);
      cand.forEach(c => { const r = Math.min(6.5, c.d * mx + 0.6); let ok = true;
        for (let j = -1; j <= 1 && ok; j++) for (let i = -1; i <= 1 && ok; i++) { const a = grid.get((Math.floor(c.x / GC) + i) + ',' + (Math.floor(c.y / GC) + j)); if (a) for (const o of a) { if (Math.hypot(o.cx - c.x, o.cy - c.y) * mx < 0.72 * (o.r + r)) { ok = false; break; } } }
        if (!ok) return; let rr = 0, gg = 0, bb = 0, nn = 0; const rc = Math.max(1, Math.round(c.d * 0.6));
        for (let j = -rc; j <= rc; j++) for (let i = -rc; i <= rc; i++) { const k = (c.y + j) * M + c.x + i; if (k >= 0 && k < M * M && m[k]) { rr += cr[k]; gg += cg[k]; bb += cb[k]; nn++; } }
        const o = { cx: c.x, cy: c.y, r, x: img.xW + (c.x + 0.5) * mx, z: -(img.nN - (c.y + 0.5) * mz), col: nn ? [rr / nn, gg / nn, bb / nn] : [70, 85, 55] };
        const kk = key(c.x, c.y), a = grid.get(kk); if (a) a.push(o); else grid.set(kk, [o]); out.push(o); });
      out.forEach(o => { o.h = clamp(4.5 + o.r * (1.15 + hash01(o.x.toFixed(1) + o.z.toFixed(1)) * 0.6), 6, 22); o.d = Math.hypot(o.x, o.z); });
      return out.sort((a, b) => a.d - b.d);
    }
    /* ---------- trees: each crown the shape the 2025 photo shows, filled with photographed leaves ---------- */
    /* A crown is the AI's outline of it in the photo (a circle where only the imagery reading has the tree), carried up into
       a dome: its base about a third of the way up the tree, its top at the tree's height (estimated from the crown's
       spread), with leaf clusters laid over the dome's skin, thinner underneath. A trunk rises to the crown and splits into
       limbs that reach up into it. The leaves take summer colours: the December photo shows the evergreen live oaks green
       and the deciduous trees in their fall colour, and both are drawn as they stand in leaf. */
    let trunkGeo = null, limbGeo = null;
    const crownOf = o => { const ch = Math.min(o.h * 0.34, o.r * 0.82), trunk = Math.max(3 + o.h * 0.22, o.h - ch * 2); return [ch, trunk]; };   /* the export's simple crowns */
    const treeColor = (o, c) => { const ev = leafKind(o) === 'ev'; c.setRGB(ev ? 0.16 : 0.25, ev ? 0.3 : 0.38, ev ? 0.1 : 0.12, THREE.SRGBColorSpace); return c; };
    const leafKind = o => { const [r, g, b] = o.col || [70, 85, 55]; return g >= r * 0.98 && g > b ? 'ev' : 'de'; };   /* green in December: evergreen */
    function clearTrees() { G.trees.children.slice().forEach(o => { G.trees.remove(o); if (o.dispose) o.dispose(); }); S.treeN = 0; S.leafN = 0; }
    function treeGeos() { if (trunkGeo) return; trunkGeo = new THREE.CylinderGeometry(0.62, 1, 1, 8, 1, true); trunkGeo.translate(0, 0.5, 0); limbGeo = new THREE.CylinderGeometry(0.45, 1, 1, 6, 1, true); limbGeo.translate(0, 0.5, 0); }
    let clumpGeo = null;
    function leafClump() {   /* three crossed cards of photographed leaves, their normals bent outward so a cluster shades as a ball */
      if (clumpGeo) return clumpGeo;
      const parts = [[0, 0], [60, 0.4], [120, -0.3]].map(([deg, tilt]) => new THREE.PlaneGeometry(1, 1).rotateX(tilt).rotateY(R(deg)));
      const g = A.mergeGeometries ? A.mergeGeometries(parts) : parts[0], p = g.attributes.position, nrm = g.attributes.normal;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i) + 0.3, z = p.getZ(i), l = Math.hypot(x, y, z) || 1; nrm.setXYZ(i, x / l, y / l, z / l); }
      g.computeBoundingSphere(); return (clumpGeo = g);
    }
    /* how far the crown reaches from its centre in a direction: where a ray crosses its outline (a circle without one) */
    function reachOf(o) {
      const P = o.ring; if (!P || P.length < 3) return () => o.r;
      return (dx, dz) => { let best = 0; for (let i = 0, n = P.length; i < n; i++) { const t = raySeg(o.x, o.z, dx, dz, P[i], P[(i + 1) % n]); if (t > best) best = t; } return best > 0.5 ? best : o.r; };
    }
    function buildTrees() {
      clearTrees();
      if (!gfx.trees || !S.treeList.length) { need(); return; }
      treeGeos(); mats(); const list = S.treeList.slice(0, T.trees), n = list.length; if (!n) return; seed = 71;
      const cap = Math.min(T.leaves, gfx.leafCap > 0 ? gfx.leafCap : Infinity), size = T.leafVox * 2.1;
      const skin = list.map(o => { const hc = Math.max(1.2, (o.h - clamp(o.h * 0.34, 1.9, 6.5)) / 2); return Math.PI * (o.r * o.r + 2 * o.r * hc); });
      const tot = skin.reduce((a, b) => a + b, 0), want = skin.map(a => Math.max(10, a / (size * size * 0.3))), wantSum = want.reduce((a, b) => a + b, 0), k0 = Math.min(1, cap / Math.max(1, wantSum));
      const per = want.map(w => Math.max(6, Math.round(w * k0))), total = per.reduce((a, b) => a + b, 0); void tot;
      const leafMat = MAT.leaf || MAT.crown, im = new THREE.InstancedMesh(MAT.leaf ? leafClump() : new THREE.IcosahedronGeometry(0.5, 1), leafMat, total); im.castShadow = im.receiveShadow = true; im.name = 'leaves';
      const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), e3 = new THREE.Euler(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), col = new THREE.Color(), up = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3();
      const limbs = []; let k = 0;
      list.forEach((o, ti) => {
        const h = o.h, base = clamp(h * 0.34, 1.9, 6.5), hc = Math.max(1.2, (h - base) / 2), mid = base + hc, reach = reachOf(o), ev = leafKind(o) === 'ev', vary = 0.86 + hash01(o.x.toFixed(1) + 'c' + o.z.toFixed(1)) * 0.28;
        const tgt = ev ? [0.03, 0.06, 0.016] : [0.048, 0.094, 0.02];   /* the clusters' mean colour, linear: live oak, and the rest in leaf */
        for (let i = 0; i < per[ti] && k < total; i++, k++) {
          const a = rnd() * 6.2832, dx = Math.cos(a), dz = Math.sin(a), Rr = reach(dx, dz) * 0.9, w0 = rnd(), upper = w0 < 0.68, inner = w0 > 0.86;   /* the skin above, below, and some within */
          const phi = upper || inner ? Math.asin(Math.pow(rnd(), 0.8)) : -Math.asin(rnd() * 0.9), shell = inner ? 0.3 + rnd() * 0.45 : 0.78 + rnd() * 0.22, cp = Math.cos(phi);
          const x = o.x + dx * Rr * cp * shell, z = o.z + dz * Rr * cp * shell, y = mid + hc * Math.sin(phi) * (phi < 0 ? 0.62 : 1) * shell;
          e3.set((rnd() - 0.5) * 0.9, rnd() * 6.283, (rnd() - 0.5) * 0.9); q4.setFromEuler(e3); const s1 = size * (0.8 + rnd() * 0.5); sc.set(s1, s1, s1); ps.set(x, y, z); m4.compose(ps, q4, sc); im.setMatrixAt(k, m4);
          const shade = (0.55 + 0.45 * clamp((y - base) / (2 * hc), 0, 1)) * vary * (0.92 + rnd() * 0.16);
          if (MAT.leaf) col.setRGB(tgt[0] / LEAF_AVG[0] * shade, tgt[1] / LEAF_AVG[1] * shade, tgt[2] / LEAF_AVG[2] * shade); else col.setRGB(tgt[0] * 3 * shade, tgt[1] * 3 * shade, tgt[2] * 3 * shade);
          im.setColorAt(k, col);
        }
        /* the trunk and the limbs */
        const rt = 0.11 + 0.021 * h, fork = base * 0.92; limbs.push([o.x, 0, o.z, o.x, fork + 0.6, o.z, rt]);
        const nl = 3 + Math.floor(hash01(o.z.toFixed(1) + 'l') * 3);
        for (let j = 0; j < nl; j++) { const a = (j + hash01(o.x.toFixed(1) + j)) / nl * 6.283, Rr = reach(Math.cos(a), Math.sin(a)) * 0.55; limbs.push([o.x, fork, o.z, o.x + Math.cos(a) * Rr, mid + hc * (0.1 + 0.45 * hash01(j + o.x.toFixed(1))), o.z + Math.sin(a) * Rr, rt * 0.5]); }
      });
      im.count = k; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.computeBoundingSphere(); G.trees.add(im);
      const tm = new THREE.InstancedMesh(limbGeo, MAT.trunk, limbs.length); tm.castShadow = true; tm.name = 'trunks';
      limbs.forEach(([x0, y0, z0, x1, y1, z1, r], i) => { dir.set(x1 - x0, y1 - y0, z1 - z0); const L = dir.length() || 1; dir.divideScalar(L); q4.setFromUnitVectors(up, dir); ps.set(x0, y0, z0); sc.set(r, L, r); m4.compose(ps, q4, sc); tm.setMatrixAt(i, m4); });
      tm.instanceMatrix.needsUpdate = true; tm.computeBoundingSphere(); G.trees.add(tm);
      S.treeN = n; S.leafN = k; S.leafTotal = total; need();
    }
    /* the trees: the AI's crowns from the photo as far as it has looked; the imagery reading beyond that */
    function treeListNow() {
      const ai = TR.res ? TR.res.trees : TR.partial, base = S.img && S.img.ok ? detectTrees() : [];
      if (!ai || !ai.length) return base;
      const reach = TR.res ? TR.res.reach : TR.reach, half = TR.res ? TR.res.half : 180, out = ai.map(t => ({ x: t.x, z: t.z, r: clamp(t.r, 1.2, 16), h: t.h, col: t.col, ring: t.ring, ai: true, d: Math.hypot(t.x, t.z) }));
      const near = new Map(), K = 12, key = (x, z) => Math.floor(x / K) + ',' + Math.floor(z / K);
      out.forEach(t => { const k2 = key(t.x, t.z); if (!near.has(k2)) near.set(k2, []); near.get(k2).push(t); });
      const covered = o => { for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) { const a = near.get((Math.floor(o.x / K) + i) + ',' + (Math.floor(o.z / K) + j)); if (a) for (const t of a) { if (Math.hypot(t.x - o.x, t.z - o.z) < 0.75 * (t.r + o.r) || (t.ring && inPoly(o.x, o.z, t.ring))) return true; } } return false; };
      base.forEach(o => { const inWin = Math.abs(o.x) <= half && Math.abs(o.z) <= half; if (!inWin || Math.hypot(o.x, o.z) > reach + 4 || !covered(o)) out.push(o); });   /* the imagery reading wherever the AI has no crown */
      return out.sort((a, b) => a.d - b.d);
    }
    const treesSoon = later(() => { if (!S.img) return; S.treeList = treeListNow(); buildTrees(); }, 900);

    /* ---------- the AI pass: once per scene centre, after the streets; the buildings and trees are rebuilt as it lands ---------- */
    const traceNote = t => { TR.note = t || ''; note(S.roadNote || ''); };
    async function traceScene(gen) {
      if (!TRACE || gfx.ai === false) { TR.state = 'off'; treesSoon(); return; }
      if (!TR.src) { TR.state = 'none'; const nw = (TR.all || []).slice().sort((a, b) => b.date - a.date)[0]; traceNote(`No satellite photo of 2024 or later covers this spot${nw ? ' (the newest is ' + nw.label + ')' : ''}, so the buildings stand as recorded and the trees as that photo shows them.`); treesSoon(); return; }
      TR.state = 'loading'; traceNote(`Tracing the ${TR.src.label} photo with AI…`);
      let last = -1; for (let i = 0; i < 16; i++) { const c = env.buildings().length; if (c && c === last) break; last = c; await sleep(700); if (gen !== S.gen) return; }   /* the area's buildings first */
      const priors = []; env.buildings().forEach(b => { const rs = ringsOf(b); if (!rs.length) return; const [cx, cz] = centroid(rs[0]); if (Math.abs(cx) > 185 || Math.abs(cz) > 185) return; priors.push({ id: b.id, ring: rs[0], h: Math.max(2.4, env.height(b)) }); });
      const roads = S.roads.map(r => ({ pts: r.pts, w: (ROADW[r.kind] || ROADW.street)[0] }));
      try {
        const res = await TRACE.trace({ lat0: S.lat0, lon0: S.lon0, toL, toLL, half: 180, priors, roads, tileURL: env.tileURL, source: TR.src, treePrompts: gfx.aiTrees > 0 ? gfx.aiTrees : 0,
          alive: () => gen === S.gen, onProgress: t => { if (gen === S.gen) traceNote(t); }, onPartial: pp => { if (gen !== S.gen) return; TR.partial = pp.trees; TR.reach = pp.reach || 0; treesSoon(); } });
        if (gen !== S.gen || !res || res.stale) return;
        if (res.none) { TR.state = 'none'; traceNote('No satellite photo of 2024 or later covers this spot.'); treesSoon(); return; }
        TR.res = res; TR.state = 'ok'; TR.ms = { all: res.ms, encoder: res.encMs, decoder: res.decMs, prompts: res.counts.prompts, backend: res.backend }; TR.partial = null;
        buildBuildings();
        const c = res.counts; traceNote(`Traced by AI from ${res.source.name}'s ${res.source.label} photo: ${c.match} buildings confirmed, ${c.redrawn} redrawn, ${c.hidden} under trees (their recorded outlines kept), ${c.trees} trees traced.`);
      } catch (e) { if (gen !== S.gen) return; TR.state = 'failed'; traceNote('The AI did not run (' + ((e && e.message) || e) + '), so the buildings stand as recorded and the trees as the photo shows them.'); treesSoon(); }
    }

    /* ---------- building the scene around a point ---------- */
    async function recenter(la, lo, keep) {
      const keepLL = keep || toLL(S.x, S.z);
      S.gen++; const gen = S.gen; S.lat0 = la; S.lon0 = lo; S.ky = mLat(la); S.kx = mLon(la);
      [S.x, S.z] = toL(keepLL[0], keepLL[1]); S.on = null; S.labelsAt = [S.x, S.z];
      G.ground.children.slice().forEach(o => { G.ground.remove(o); o.geometry.dispose(); if (o.material.map) o.material.map.dispose(); o.material.dispose(); });
      S.treeList = []; clearTrees(); Object.assign(TR, { state: TRACE ? 'waiting' : 'off', res: null, src: null, all: null, note: '', partial: null, reach: 0, ms: null });
      /* the photo: the newest of 2024 or later among the finest zooms, so the roofs, the AI and the lean all read one picture */
      if (TRACE) { try { const sr = await Promise.race([TRACE.source(la, lo), sleep(6000).then(() => { throw new Error('slow'); })]); if (gen !== S.gen) return; TR.src = sr.best; TR.all = sr.all; } catch (e) { TR.src = null; } if (gen !== S.gen) return; }
      const zs = TR.src && (TR.src.zoom === 20 || TR.src.zoom === 19) ? TR.src.zoom : (T.img === 20 ? 20 : 19), z20 = zs === 20 && renderer.capabilities.maxTextureSize >= 4096;
      const inner = imagery(z20 ? 20 : 19, z20 ? 16 : 8, '#6f7764', () => treesSoon()), outer = imagery(17, 8, '#77806b'); S.img = inner;
      G.ground.add(groundPlane(outer, -0.06, false)); G.ground.add(groundPlane(inner, 0, true));
      if (!S.sunSet) { S.sunSet = true; setSun(); }
      if (PR.on) { if (PR.tiles) prPlace(); else if (prStart()) prApply(); }
      if (PR.on) loadDEM(gen);
      buildBuildings(); setRoads([]); note('Loading the streets and alleys…');
      if (env.ensure) env.ensure(la, lo, RADIUS + 60);
      try { const list = await env.roads(la, lo, RADIUS + 150); if (gen !== S.gen) return; setRoads(list); note(list.source || ''); if (S.mode === 'street') { const o = nearestOnRoads(S.x, S.z, 45); if (o) { S.on = o; S.x = o.x; S.z = o.z; } } }
      catch (e) { if (gen === S.gen) note('The streets did not load: ' + (e && e.message || e) + '. The view still walks freely.'); }
      if (gen === S.gen) traceScene(gen);
      need(); if (env.onMove) env.onMove(state());
    }

    /* ---------- the render pipeline for the chosen quality ---------- */
    let composer = null, bloomComposer = null;
    const DARK = new THREE.MeshBasicMaterial({ color: 0x000000, fog: false }), DARKL = new THREE.LineBasicMaterial({ color: 0x000000, fog: false }), stash = new Map(); let DARKLEAF = null;
    /* what feeds the bloom: the glowing outlines and the shells' silhouettes, not the halos on the ground nor the shells' fill,
       which would spread the colour over the whole picture */
    const glowing = o => (o.parent === G.fx && o.name !== 'halo') || o.parent === G.sel;
    function drawBloom() {
      mats();   /* the scene can draw before its first buildings (the photo's date is asked first) */
      const skyOn = sky ? sky.visible : false, b0 = MAT.shell.uniforms.base.value, b1 = MAT.aura.uniforms.base.value; if (sky) sky.visible = false;
      MAT.shell.uniforms.base.value = 0; MAT.aura.uniforms.base.value = 0.1;
      if (!DARKLEAF && MAT.leaf) DARKLEAF = new THREE.MeshBasicMaterial({ color: 0x000000, fog: false, map: MAT.leaf.map, alphaTest: 0.5, side: THREE.DoubleSide });
      scene.traverse(o => { if (!o.material || glowing(o) || o === sky) return; stash.set(o, o.material); o.material = o.isLine ? DARKL : o.material === MAT.leaf && DARKLEAF ? DARKLEAF : DARK; });
      try { bloomComposer.render(); } finally { stash.forEach((m, o) => { o.material = m; }); stash.clear(); if (sky) sky.visible = skyOn; MAT.shell.uniforms.base.value = b0; MAT.aura.uniforms.base.value = b1; }
    }
    function pipeline() {
      T = TIERS[tierName()];
      [composer, bloomComposer].forEach(c => { if (!c) return; try { c.passes.forEach(p => p.dispose && p.dispose()); c.renderTarget1.dispose(); c.renderTarget2.dispose(); } catch (e) { /* gone either way */ } }); composer = bloomComposer = null;
      const dpr = Math.min(T.pr, window.devicePixelRatio || 1); renderer.setPixelRatio(dpr);
      const photo = prOn(); renderer.toneMapping = photo ? THREE.NeutralToneMapping : THREE.AgXToneMapping; renderer.toneMappingExposure = photo ? 1.0 : 1.15;
      if (PR.tiles) { PR.tiles.errorTarget = T === TIERS.high ? 8 : T === TIERS.medium ? 12 : 18; PR.tiles.setResolutionFromRenderer(camera, renderer); }
      const shadows = !!T.shadow && !photo;
      if (renderer.shadowMap.enabled !== shadows) { renderer.shadowMap.enabled = shadows; scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => { m.needsUpdate = true; }); }); }
      sun.castShadow = shadows; if (shadows) { sun.shadow.mapSize.set(T.shadow, T.shadow); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
      const w = host.clientWidth || 1, h = host.clientHeight || 1;
      if (T.post && A.EffectComposer && A.RenderPass && A.OutputPass) {
        try {
          const rt = new THREE.WebGLRenderTarget(Math.round(w * dpr), Math.round(h * dpr), { type: THREE.HalfFloatType, samples: T.msaa });
          composer = new A.EffectComposer(renderer, rt); composer.setPixelRatio(dpr); composer.setSize(w, h);
          composer.addPass(new A.RenderPass(scene, camera));
          if (T.ao && A.GTAOPass && !photo) {
            const ao = new A.GTAOPass(scene, camera, w, h); ao.output = A.GTAOPass.OUTPUT.Default; ao.blendIntensity = 0.9;
            ao.updateGtaoMaterial({ radius: 2.2, distanceExponent: 1.4, thickness: 1.2, scale: 1, samples: 12, distanceFallOff: 1 }); ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2, samples: 12 });
            const r0 = ao.render.bind(ao); ao.render = function () { const v = [G.fx.visible, sky ? sky.visible : false, G.sel.visible, G.trees.visible]; G.fx.visible = false; G.sel.visible = false; G.trees.visible = false; if (sky) sky.visible = false; try { r0.apply(null, arguments); } finally { G.fx.visible = v[0]; G.sel.visible = v[2]; G.trees.visible = v[3]; if (sky) sky.visible = v[1]; } };
            composer.addPass(ao);
          }
          if (T.bloom && A.UnrealBloomPass && A.ShaderPass) {
            const rb = new THREE.WebGLRenderTarget(Math.round(w * dpr / 2), Math.round(h * dpr / 2), { type: THREE.HalfFloatType });
            bloomComposer = new A.EffectComposer(renderer, rb); bloomComposer.renderToScreen = false; bloomComposer.setPixelRatio(dpr / 2); bloomComposer.setSize(w, h);
            bloomComposer.addPass(new A.RenderPass(scene, camera)); bloomComposer.addPass(new A.UnrealBloomPass(new THREE.Vector2(w, h), 0.55, 0.22, 0));
            const mix = new A.ShaderPass(new THREE.ShaderMaterial({ uniforms: { baseTexture: { value: null }, bloomTexture: { value: bloomComposer.renderTarget2.texture } },
              vertexShader: 'varying vec2 vUv;\nvoid main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }',
              fragmentShader: 'uniform sampler2D baseTexture; uniform sampler2D bloomTexture; varying vec2 vUv;\nvoid main() { gl_FragColor = texture2D( baseTexture, vUv ) + vec4( texture2D( bloomTexture, vUv ).rgb, 0.0 ); }' }), 'baseTexture');
            mix.needsSwap = true; composer.addPass(mix);
          }
          composer.addPass(new A.OutputPass());
        } catch (e) { composer = null; }
      }
      if (S.treeList.length) buildTrees();
      need();
    }
    function draw() {
      if (composer) { if (bloomComposer) drawBloom(); composer.render(); } else renderer.render(scene, camera);
      if (O.labels.children.length || O.sel.children.length) { renderer.autoClear = false; renderer.clearDepth(); renderer.render(overlay, camera); renderer.autoClear = true; }
    }

    /* ---------- the camera, the loop and the pointer ---------- */
    function placeCamera() {
      const gy = prOn() ? prGround(S.x, S.z) : 0, eye = gy + HEIGHT[S.mode].eye, p = R(S.pitch), y = R(S.yaw);
      camera.position.set(S.x, eye, S.z); camera.lookAt(S.x + Math.sin(y) * Math.cos(p) * 10, eye + Math.sin(p) * 10, S.z - Math.cos(y) * Math.cos(p) * 10);
      const near = S.mode === 'street' ? 0.3 : 1.5; if (camera.fov !== S.fov || camera.near !== near) { camera.fov = S.fov; camera.near = near; camera.updateProjectionMatrix(); }
      camera.updateMatrixWorld();
      if (sun.castShadow) {
        const half = S.mode === 'street' ? 105 : S.mode === 'drone' ? 190 : 330, tx = 2 * half / sun.shadow.mapSize.x, fx = Math.round((S.x + Math.sin(y) * half * 0.55) / tx) * tx, fz = Math.round((S.z - Math.cos(y) * half * 0.55) / tx) * tx;
        sun.target.position.set(fx, 0, fz); sun.position.set(fx + sunDir.x * 700, sunDir.y * 700, fz + sunDir.z * 700); sun.target.updateMatrixWorld();
        const sc = sun.shadow.camera; if (sc.right !== half) { sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half; sc.near = 1; sc.far = 1600; sc.updateProjectionMatrix(); } sun.shadow.normalBias = tx * 0.7;
      } else { sun.position.copy(sunDir).multiplyScalar(700); sun.target.position.set(0, 0, 0); }
      const cam = camera.position;
      S.labels.forEach(s => { const d = s.position.distanceTo(cam), r = s.userData.kind === 'r', k = clamp(d * (r ? 0.03 : 0.042), 0.55, r ? 9 : 14); s.scale.set(k * s.userData.aspect, k, 1);
        s.visible = d < (r ? 300 : 160) && (s.userData.cur || !occluded(cam.x, cam.y, cam.z, s.position.x, s.position.y - (r ? 0 : 1.2), s.position.z, s.userData.id)); });
    }
    function resize() { const w = host.clientWidth || 1, h = host.clientHeight || 1; renderer.setSize(w, h, false); cv.style.width = w + 'px'; cv.style.height = h + 'px'; camera.aspect = w / h; camera.updateProjectionMatrix(); if (composer) composer.setSize(w, h); if (bloomComposer) bloomComposer.setSize(w, h); if (PR.tiles) PR.tiles.setResolutionFromRenderer(camera, renderer); need(); }
    function frame(t) {
      S.raf = 0; const dt = Math.min(1, S.last ? (t - S.last) / 1000 : 0.016);   /* real time, so a slow machine walks at the same pace in fewer frames */ S.last = t; let moving = false;
      const k = S.keys, sp = S.mode === 'street' ? 7 : S.mode === 'drone' ? 18 : 45;
      if (k.fwd || k.back) { walk((k.fwd ? 1 : -1) * sp * dt); moving = true; }
      if (k.left || k.right) { S.yaw = (S.yaw + (k.right ? 1 : -1) * 75 * dt + 360) % 360; moving = true; need(); if (env.onMove) env.onMove(state()); }
      if (S.tween) { const w = S.tween, u = Math.min(1, (t - w.t0) / w.ms), e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
        S.x = w.x0 + (w.x1 - w.x0) * e; S.z = w.z0 + (w.z1 - w.z0) * e; if (w.yaw1 != null) { const dy = ((w.yaw1 - w.yaw0 + 540) % 360) - 180; S.yaw = (w.yaw0 + dy * e + 360) % 360; } if (w.p1 != null) S.pitch = w.p0 + (w.p1 - w.p0) * e;
        moving = true; if (u >= 1) { S.tween = null; after(); } }
      const streaming = prOn() && (PR.tiles.loadProgress < 1 || (!PR.tiles.root && performance.now() - (PR.t0 || 0) < 60000));   /* keep asking until the root has come */
      if (S.needs || moving || streaming) {
        S.needs = false; placeCamera();   /* placeCamera may ask for another frame (the photoreal ground easing in) */
        if (prOn()) { PR.tiles.update(); prAttr(false);
          if ((PR.calWant || !PR.calib) && (PR.calTries || 0) < 60) { if (t - (PR.calT || 0) > 400) { PR.calT = t; PR.calTries = (PR.calTries || 0) + 1; if (prCalibrate()) PR.calTries = 0; } S.needs = true; } }
        draw(); }
      watchPace(t, moving);
      if (S.running && (moving || S.needs || streaming)) S.raf = requestAnimationFrame(frame); else S.last = 0;
    }
    /* on Auto, a walk that runs under about 19 frames a second steps the quality down once, and says so */
    function watchPace(t, moving) {
      if (!moving || gfx.q !== 'auto' || tierName() === 'basic') { S.lastT = 0; S.fs = []; return; }
      if (S.lastT) { const iv = t - S.lastT; if (iv > 0 && iv < 1500) S.fs.push(iv); } S.lastT = t;
      if (S.fs.length >= 40) { const avg = S.fs.reduce((a, b) => a + b, 0) / S.fs.length; S.fs = [];
        if (avg > 52) { autoTier = autoTier === 'high' ? 'medium' : 'basic'; pipeline(); note(`Graphics lowered to ${TIERS[autoTier].label} to keep the walk smooth; the Graphics menu above changes it.`); if (env.onGraphics) env.onGraphics(graphics()); } }
    }
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
    function hit(e) {
      const r = cv.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera);
      const hs = ray.intersectObjects(S.pick, false);
      for (const h of hs) { const own = h.object.userData.own, id = own && own[h.faceIndex]; if (id) { const b = env.byId(id); if (b) return { b, point: h.point }; } }
      const gs = ray.intersectObjects(G.ground.children, false); return gs.length ? { ground: gs[0].point } : null;
    }
    let drag = null, hovT = 0, hovLate = 0;
    cv.addEventListener('pointerdown', e => { cv.focus({ preventScroll: true }); drag = { x: e.clientX, y: e.clientY, yaw: S.yaw, pitch: S.pitch, moved: false }; try { cv.setPointerCapture(e.pointerId); } catch (x) { /* fine */ } });
    cv.addEventListener('pointermove', e => {
      if (drag) { const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true; if (drag.moved) { const f = S.fov / 65 * 0.22; S.yaw = (drag.yaw - dx * f + 3600) % 360; S.pitch = clamp(drag.pitch + dy * f, -85, 80); S.tween = null; need(); if (env.onMove) env.onMove(state()); if (env.onHover) env.onHover(null, e); } return; }
      const now = performance.now(); clearTimeout(hovLate); if (now - hovT < 60) { const ev = { clientX: e.clientX, clientY: e.clientY }; hovLate = setTimeout(() => point(ev), 70); return; } hovT = now; point(e);
    });
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
    cv.addEventListener('keydown', e => { const k = KEYS[e.code]; if (k) { e.preventDefault(); if (!S.keys[k]) { S.keys[k] = true; S.last = performance.now(); need(); } } else if (e.code === 'KeyQ' || e.code === 'PageUp') setHeight(S.mode === 'street' ? 'drone' : 'bird'); else if (e.code === 'KeyE' || e.code === 'PageDown') setHeight(S.mode === 'bird' ? 'drone' : 'street'); });
    /* on a slow machine a short press can end before a frame runs: the release then moves for the time it was held */
    function settle(k) { if (!S.keys[k]) return; const dt = Math.min(1, Math.max(0, (performance.now() - (S.last || performance.now())) / 1000)), sp = S.mode === 'street' ? 7 : S.mode === 'drone' ? 18 : 45; S.keys[k] = false; S.last = performance.now();
      if (dt <= 0) return; if (k === 'fwd' || k === 'back') walk((k === 'fwd' ? 1 : -1) * sp * dt); else { S.yaw = (S.yaw + (k === 'right' ? 1 : -1) * 75 * dt + 360) % 360; need(); if (env.onMove) env.onMove(state()); } }
    cv.addEventListener('keyup', e => { const k = KEYS[e.code]; if (k) settle(k); });
    cv.addEventListener('blur', () => { S.keys = {}; });
    cv.addEventListener('webglcontextlost', e => { e.preventDefault(); note('The graphics card dropped the 3D view; it comes back when the page has the card again.'); });
    if (window.ResizeObserver) new ResizeObserver(resize).observe(host);

    /* ---------- moves ---------- */
    function goTo(x, z, yaw, pitch) {
      let tx = x, tz = z, o = null; if (S.mode === 'street') { o = nearestOnRoads(x, z, 45); if (o) { tx = o.x; tz = o.z; } }
      S.tween = { t0: performance.now(), ms: clamp(Math.hypot(tx - S.x, tz - S.z) * 18, 250, 1400), x0: S.x, z0: S.z, x1: tx, z1: tz, yaw0: S.yaw, yaw1: yaw != null ? yaw : null, p0: S.pitch, p1: pitch != null ? pitch : null };
      S.on = o; need();
    }
    function faceAt(b, smooth2) {
      if (!b) return; const [x, z] = toL(b.lat, b.lon), d = Math.max(1, Math.hypot(x - S.x, z - S.z)), yaw = (DG(Math.atan2(x - S.x, -(z - S.z))) + 360) % 360;
      const eye = HEIGHT[S.mode].eye, mid = Math.max(2.4, env.height(b)) * 0.55, pitch = clamp(DG(Math.atan2(mid - eye, d)), -80, 45);
      if (smooth2) S.tween = { t0: performance.now(), ms: 500, x0: S.x, z0: S.z, x1: S.x, z1: S.z, yaw0: S.yaw, yaw1: yaw, p0: S.pitch, p1: pitch }; else { S.yaw = yaw; S.pitch = pitch; }
      need(); if (env.onMove) env.onMove(state());
    }
    function setHeight(m) { if (!HEIGHT[m] || m === S.mode) return; const was = S.mode; S.mode = m; S.pitch = HEIGHT[m].pitch; if (m === 'street') { const o = nearestOnRoads(S.x, S.z, 60); if (o) { S.on = o; S.x = o.x; S.z = o.z; } } else if (was === 'street') S.on = null; need(); if (env.onMove) env.onMove(state()); }
    function state() { const [la, lo] = toLL(S.x, S.z), r = roadAt(); return { lat: la, lon: lo, yaw: S.yaw, pitch: S.pitch, mode: S.mode, road: r ? r.name : '', roadKind: r ? r.kind : '', built: S.built, roads: S.roads.length, trees: S.treeN, leaves: S.leafN || 0, leafTotal: S.leafTotal || 0, trace: TR.state, traced: S.traced || null, aiTrees: TR.res ? TR.res.counts.trees : (TR.partial || []).length, note: S.note }; }
    function graphics() { const t = tierName(); return { q: gfx.q, tier: t, label: TIERS[t].label, auto: autoTier, sun: gfx.sun, trees: gfx.trees, gpu: GPU, post: !!composer, sunAlt: Math.round(S.sunAlt), sunTime: S.sunTime || null, sunNote: S.sunNote, ai: gfx.ai !== false, trace: TR.state, traceDate: TR.src ? TR.src.label : null, traceSource: TR.src ? TR.src.name : null, traceBackend: TR.res ? TR.res.backend : null, photo: PR.on, photoReady: prOn(), photoErr: PR.err, hasKey: !!prKey(), photoAvail: !!XT, photoLoad: PR.tiles ? +PR.tiles.loadProgress.toFixed(2) : null, photoCalib: PR.calib, photoLift: +PR.wrap.position.y.toFixed(2) }; }

    /* ---------- the area as a glTF model for Unreal Engine 5, Blender or any 3D tool ---------- */
    /* One node per building, named by its address, with the module's reading in its extras (Unreal's Interchange importer
       keeps glTF extras as metadata); its glow as an emissive shell (KHR_materials_emissive_strength), so Unreal's bloom
       lights it; the streets, the tree crowns and a plain ground. Esri's imagery is left out: its terms keep it on Esri's
       servers. Units are meters; +X is east, +Y up, +Z south, and the origin's latitude and longitude are in the scene's extras. */
    async function exportGLB() {
      if (!A.GLTFExporter) throw new Error('the exporter is not in this build');
      if (!S.batches) throw new Error('nothing is built yet');
      mats();
      const root = new THREE.Scene(), [la, lo] = [S.lat0, S.lon0], r = roadAt();
      root.name = 'Rooftop Scout 3D';
      root.userData = { generator: 'DFW Thermal Debt Atlas, Rooftop Scout', origin: { lat: +la.toFixed(7), lon: +lo.toFixed(7) }, units: 'meters', axes: '+X east, +Y up, +Z south (glTF); Unreal converts to Z up on import', street: r ? r.name : '', exported: new Date().toISOString(), legend: { green: 'likely needs HVAC work', orange: 'maybe', red: 'not likely' },
        sources: 'Buildings: FEMA USA Structures (public domain). Streets: (c) OpenStreetMap contributors, ODbL, or the U.S. Census TIGER file. Trees: placed where Esri imagery shows canopy; their shapes are generic. Facades, doors and roof pitches are generic, not observed. Esri imagery is not included.' };
      const slice = (B, t0, t1, colors, uv) => { const g = new THREE.BufferGeometry(), a = 9 * t0, b = 9 * t1; g.setAttribute('position', new THREE.Float32BufferAttribute(B.p.slice(a, b), 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(B.n.slice(a, b), 3)); if (uv !== false) g.setAttribute('uv', new THREE.Float32BufferAttribute(B.u.slice(6 * t0, 6 * t1), 2)); if (colors) g.setAttribute('color', new THREE.Float32BufferAttribute(B.c.slice(a, b), 3)); return g; };
      /* tangents for the walls' normal maps, from each triangle's positions and texture coordinates (the glTF way: xyz and a handedness) */
      const tangents = g => { const P = g.attributes.position.array, Nn = g.attributes.normal.array, U = g.attributes.uv.array, n = P.length / 3, Tg = new Float32Array(n * 4);
        for (let t = 0; t + 2 < n; t += 3) { const a = t * 3, ua = t * 2, e1 = [P[a + 3] - P[a], P[a + 4] - P[a + 1], P[a + 5] - P[a + 2]], e2 = [P[a + 6] - P[a], P[a + 7] - P[a + 1], P[a + 8] - P[a + 2]], du1 = U[ua + 2] - U[ua], dv1 = U[ua + 3] - U[ua + 1], du2 = U[ua + 4] - U[ua], dv2 = U[ua + 5] - U[ua + 1], d = du1 * dv2 - du2 * dv1, r = Math.abs(d) < 1e-12 ? 0 : 1 / d;
          let tv = [0, 1, 2].map(k => (e1[k] * dv2 - e2[k] * dv1) * r), bv = [0, 1, 2].map(k => (e2[k] * du1 - e1[k] * du2) * r);
          for (let k = 0; k < 3; k++) { const v = (t + k) * 3, nn = [Nn[v], Nn[v + 1], Nn[v + 2]], dn = nn[0] * tv[0] + nn[1] * tv[1] + nn[2] * tv[2]; let tt = [tv[0] - nn[0] * dn, tv[1] - nn[1] * dn, tv[2] - nn[2] * dn]; let l = Math.hypot(...tt);
            if (l < 1e-8) { tt = Math.abs(nn[1]) < 0.9 ? [nn[2], 0, -nn[0]] : [1, 0, 0]; l = Math.hypot(...tt); } tt = tt.map(x => x / l);
            const cx = nn[1] * tt[2] - nn[2] * tt[1], cy = nn[2] * tt[0] - nn[0] * tt[2], cz = nn[0] * tt[1] - nn[1] * tt[0], w = cx * bv[0] + cy * bv[1] + cz * bv[2] < 0 ? -1 : 1; Tg.set([tt[0], tt[1], tt[2], w], (t + k) * 4); } }
        g.setAttribute('tangent', new THREE.Float32BufferAttribute(Tg, 4)); return g; };
      const XM = {}; Object.keys(FAC).forEach(k => { XM[k] = new THREE.MeshStandardMaterial({ map: MAT[k].map, normalMap: MAT[k].normalMap, roughness: k === 'glass' ? 0.15 : 0.85, metalness: k === 'metal' ? 0.3 : 0, name: 'facade-' + k }); });
      XM.trim = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, name: 'trim' }); XM.winframe = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, name: 'window frames' }); XM.win = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.05, metalness: 0.1, name: 'window glass' }); XM.roof = new THREE.MeshStandardMaterial({ color: '#57524c', roughness: 0.88, name: 'roof' }); XM.door = new THREE.MeshStandardMaterial({ map: MAT.door.map, roughness: 0.7, name: 'door' });
      const GL = {}; ['g', 'o', 'r'].forEach(k => { const b = env.buildings().find(x => x.status === k); GL[k] = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: C(b ? env.color(b) : k === 'g' ? '#1fbf4c' : k === 'o' ? '#ff9f1a' : '#f04438'), emissiveIntensity: 4, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false, name: 'glow-' + k }); });
      const sp = S.shell ? { p: S.shell.attributes.position.array, n: S.shell.attributes.normal.array } : null;
      S.parts.forEach(pt => {
        const b = env.byId(pt.id); if (!b) return; const facts = env.facts ? env.facts(b) : {}, g = new THREE.Group();
        g.name = String(facts.address || 'Building ' + pt.id).slice(0, 90); g.userData = Object.assign({ id: String(pt.id) }, facts);
        Object.entries(pt.ranges).forEach(([k, [t0, t1]]) => { const sg = slice(S.batches[k], t0, t1, k === 'trim' || k === 'win' || k === 'winframe', !!FAC[k]); if (FAC[k]) tangents(sg); const m = new THREE.Mesh(sg, XM[k] || XM.trim); m.name = k === 'roof' ? 'roof' : k === 'trim' ? 'trim' : k === 'win' ? 'window glass' : k === 'winframe' ? 'window frames' : 'walls'; g.add(m); });
        const dr = S.doorRanges.get(pt.id); if (dr && S.doorBatch) { const m = new THREE.Mesh(slice(S.doorBatch, dr[0], dr[1], false), XM.door); m.name = 'doors'; g.add(m); }
        if (sp && pt.shell[1] > pt.shell[0]) { const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp.p.slice(pt.shell[0] * 18, pt.shell[1] * 18), 3)); sg.setAttribute('normal', new THREE.Float32BufferAttribute(sp.n.slice(pt.shell[0] * 18, pt.shell[1] * 18), 3)); const m = new THREE.Mesh(sg, GL[b.status] || GL.o); m.name = 'glow'; g.add(m); }
        root.add(g);
      });
      const roads = new THREE.Group(); roads.name = 'Streets and alleys';
      G.roads.children.forEach(o => { const m = new THREE.Mesh(o.geometry.clone().deleteAttribute('uv1'), new THREE.MeshStandardMaterial({ color: o.material.map === concreteTex ? '#b9b4aa' : o.material === MAT.paintY ? '#e0b13c' : o.material === MAT.paintW ? '#e9e7e0' : '#45474a', roughness: 0.9, name: o.name })); m.geometry.deleteAttribute('color'); m.geometry.deleteAttribute('uv'); m.name = o.name; roads.add(m); }); root.add(roads);
      const bb = new THREE.Box3().setFromObject(root); bb.expandByScalar(15); const gw = Math.max(50, bb.max.x - bb.min.x), gd = Math.max(50, bb.max.z - bb.min.z);
      const gr = new THREE.Mesh(new THREE.PlaneGeometry(gw, gd).rotateX(-Math.PI / 2).translate((bb.min.x + bb.max.x) / 2, -0.02, (bb.min.z + bb.max.z) / 2).deleteAttribute('uv'), new THREE.MeshStandardMaterial({ color: '#6b7650', roughness: 1, name: 'ground' })); gr.name = 'Ground'; root.add(gr);
      if (S.treeList.length && gfx.trees) {
        const parts = [], m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), lo2 = new THREE.IcosahedronGeometry(1, 0), cl = new THREE.Color();
        S.treeList.slice(0, 2500).forEach(o => { const [ch, trunk] = crownOf(o), g = lo2.clone(); p.set(o.x, trunk + ch, o.z); s.set(o.r, ch, o.r); m4.compose(p, q, s); g.applyMatrix4(m4); treeColor(o, cl); const cc = []; for (let i = 0; i < g.attributes.position.count; i++) cc.push(cl.r, cl.g, cl.b); g.setAttribute('color', new THREE.Float32BufferAttribute(cc, 3)); g.deleteAttribute('uv'); parts.push(g); });
        if (parts.length && A.mergeGeometries) { const tg = A.mergeGeometries(parts); const tmesh = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, name: 'tree crowns' })); tmesh.name = 'Trees'; root.add(tmesh); }
      }
      const ex = new A.GLTFExporter();
      const buf = await ex.parseAsync(root, { binary: true, onlyVisible: false, maxTextureSize: 512 });
      root.traverse(o => { if (o.geometry) o.geometry.dispose(); });
      return new Blob([buf], { type: 'model/gltf-binary' });
    }

    pipeline();
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
      hold(k, on) { if (on) { if (!S.keys[k]) { S.keys[k] = true; S.last = performance.now(); } } else settle(k); need(); },
      start() { S.running = true; resize(); need(); }, stop() { S.running = false; S.keys = {}; if (S.raf) { cancelAnimationFrame(S.raf); S.raf = 0; } },
      project(lat, lon, up) { const [x, z] = toL(lat, lon), v = new THREE.Vector3(x, up, z).project(camera); return v.z > 1 ? null : [(v.x + 1) / 2 * host.clientWidth, (1 - v.y) / 2 * host.clientHeight]; },
      graphics,
      setGraphics(o) {
        o = o || {}; let pipe = false, sunCh = false, tr = false;
        if (o.q && o.q !== gfx.q && (o.q === 'auto' || TIERS[o.q])) { gfx.q = o.q; pipe = true; }
        if (o.sun && o.sun !== gfx.sun && (o.sun === 'now' || SUN_AT[o.sun])) { gfx.sun = o.sun; sunCh = true; }
        if (o.trees != null && !!o.trees !== gfx.trees) { gfx.trees = !!o.trees; tr = true; }
        if (o.ai != null && !!o.ai !== (gfx.ai !== false)) { gfx.ai = !!o.ai; saveGfx(); if (S.ok) recenter(...toLL(0, 0)); return graphics(); }
        if (o.photo != null && (!!o.photo !== PR.on || (o.photo && !PR.tiles))) { PR.on = gfx.photo = !!o.photo; PR.err = ''; if (PR.on && S.ok) prStart(); saveGfx(); prApply(); return graphics(); }
        saveGfx(); if (pipe) pipeline(); else if (tr) buildTrees(); if (sunCh) setSun(); return graphics();
      },
      exportGLB,
      /* for tests: what the renderer holds, and lights to switch off to see the shadows alone */
      debug(o) { if (o && o.probe) { const meshes = []; if (PR.tiles) PR.tiles.group.traverse(m => { if (m.isMesh) meshes.push(m); }); prRay.set(V3.set(S.x, 500, S.z), DOWN); prRay.far = 1200; const direct = meshes.length ? prRay.intersectObjects(meshes, false).map(h => +h.point.y.toFixed(2)) : [];
          let grp = []; try { grp = PR.tiles ? prRay.intersectObject(PR.tiles.group, true).map(h => +h.point.y.toFixed(2)) : []; } catch (e) { grp = ['error ' + e.message]; }
          const bb = new THREE.Box3(); meshes.forEach(m => bb.expandByObject(m)); const tl = PR.tiles; return { tiles: tl ? { root: !!tl.root, kids: tl.root && tl.root.children ? tl.root.children.length : null, stats: Object.assign({}, tl.stats), visible: tl.visibleTiles ? tl.visibleTiles.size : null, active: tl.activeTiles ? tl.activeTiles.size : null, progress: tl.loadProgress, inScene: !!tl.group.parent, wrapVis: PR.wrap.visible, cams: tl.cameras ? tl.cameras.length : null, t: tl.group.matrixWorld.elements.slice(12, 15).map(v => Math.round(v)), sameCam: tl.cameras ? tl.cameras[0] === camera : null, res: tl.cameraMap && tl.cameras && tl.cameras[0] ? (tl.cameraMap.get(tl.cameras[0]) || {}).x : null, err: PR.err, on: PR.on, calTries: PR.calTries || 0, calib: PR.calib } : null, meshes: meshes.length, direct: direct.slice(0, 6), group: grp.slice(0, 6), lowest: prLowest(S.x, S.z), box: meshes.length ? [bb.min.toArray().map(v => +v.toFixed(1)), bb.max.toArray().map(v => +v.toFixed(1))] : null, cam: [+S.x.toFixed(1), +S.z.toFixed(1)], wrapY: PR.wrap.position.y }; }
        if (o && o.env != null) scene.environmentIntensity = o.env; if (o && o.hemi != null) hemi.intensity = o.hemi; if (o) need();
        const casters = []; scene.traverse(x => { if (x.castShadow) casters.push(x.name || x.type); });
        return { traceMs: TR.ms || null, trace: TR.res ? { lean: TR.res.lean, anchors: TR.res.anchors, counts: TR.res.counts, reach: TR.res.reach } : null, shadows: renderer.shadowMap.enabled, sunCasts: sun.castShadow, map: !!sun.shadow.map, mapSize: sun.shadow.mapSize.x, cam: [sun.shadow.camera.left, sun.shadow.camera.right, sun.shadow.camera.near, sun.shadow.camera.far], sunPos: sun.position.toArray().map(v => +v.toFixed(1)), target: sun.target.position.toArray().map(v => +v.toFixed(1)), sunDir: sunDir.toArray().map(v => +v.toFixed(3)), casters, passes: composer ? composer.passes.map(p => p.constructor.name) : [], env: scene.environmentIntensity, calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
      },
      canvas: cv,
    };
  };
})();
