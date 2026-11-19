"""Round 11: the Scout Engine for the Louisiana atlas. Reads dfw12/engine.js (build 12's engine, verbatim), writes
build/engine.js: Louisiana's roofs and walls, and the roof views (heat, wear, the years ahead) in place of the x-ray of
heating and cooling. Every anchor must occur exactly once.  python3 -I tests/r11/port_lens.py"""
import os
SP = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
s = open(os.path.join(SP, 'dfw12', 'engine.js'), encoding='utf-8').read()
lens = open(os.path.join(SP, 'tests', 'r11', 'engine_lens.js'), encoding='utf-8').read()
def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (s.count(a), a[:100])
    s = s.replace(a, b)
def cut(a, b, new):
    """replace everything from anchor a up to (not including) anchor b"""
    global s
    assert s.count(a) == 1 and s.count(b) == 1, (s.count(a), s.count(b), a[:60], b[:60])
    i, j = s.index(a), s.index(b); assert i < j
    s = s[:i] + new + s[j:]

# ---- the head ----
rep("   window.__SCOUT_E3D__(host, env) at the end of this script. Nothing here reaches the network: the world asks the\n   module for its buildings, streets and imagery, as the three.js view does. */",
    "   window.__SCOUT_E3D__(host, env) at the end of this script. Nothing here reaches the network: the world asks the\n   module for its buildings, streets and imagery, as the three.js view does. In the Louisiana Roofing Atlas the layer\n   that is seen through walls carries the roof views: each roof's heat, its wear and the years ahead, read by the\n   module (env.lens) and drawn here plane by plane. */")

# ---- the layer seen through walls takes its own shaders and uniforms ----
rep("  class XRay {\n    constructor(engine) {\n      this.engine = engine; this.dev = engine.device; this.items = new Set(); this.on = false; this.strength = 1; this.dim = 0.42; this.w = 0; this.h = 0; this.drawn = 0;",
    "  class XRay {\n    /* o: { key, vs, fs, refuse, dim, sets() } for a layer with shaders of its own (the roof views); none for the plain x-ray */\n    constructor(engine, o) {\n      this.o = o || {}; this.engine = engine; this.dev = engine.device; this.items = new Set(); this.on = false; this.strength = 1; this.dim = this.o.dim != null ? this.o.dim : 0.42; this.w = 0; this.h = 0; this.drawn = 0;")
rep("R.settings.viewMode !== 'lit' || R.refused.has('x-ray')) return; const dev = this.dev, T = R.T, w = R.w, h = R.h; let p, pc;\n      try { p = dev.program('xray-mesh', XRAY_VS, XRAY_FS); pc = dev.program('xray-comp', CHUNKS.fullscreen_vs, XRAY_COMP_FS); } catch (e) { R.refuse('x-ray', e); return; }",
    "R.settings.viewMode !== 'lit' || R.refused.has(this.o.refuse || 'x-ray')) return; const dev = this.dev, T = R.T, w = R.w, h = R.h; let p, pc;\n      try { p = dev.program((this.o.key || 'xray') + '-mesh', this.o.vs || XRAY_VS, this.o.fs || XRAY_FS); pc = dev.program('xray-comp', CHUNKS.fullscreen_vs, XRAY_COMP_FS); } catch (e) { R.refuse(this.o.refuse || 'x-ray', e); return; }")
rep("      p.use().sets({ u_viewProj: cam.viewProj, u_camPos: cam.position, u_sun: R.sky.lightDir || [0.3, 0.8, 0.4], u_time: this.engine.time.now || 0 });\n",
    "      p.use().sets({ u_viewProj: cam.viewProj, u_camPos: cam.position, u_sun: R.sky.lightDir || [0.3, 0.8, 0.4], u_time: this.engine.time.now || 0 }); if (this.o.sets) p.sets(this.o.sets());\n")
rep("  SE.XRay = XRay;\n", r"""  SE.XRay = XRay;
  /* The roof views' own shaders for that layer. A corner of a roof carries a reading in its aux: x the value on its scale
     (0 to 1), y how thick the marks lie, z which mark, w which row of colours. The colour is the reading, so the light
     only shapes it a little. Marks are drawn in the plane of the roof, along the eave and up the slope: tabs lost to
     wind (1), hail hits (2), worn patches (3), algae streaks (4), rust (5), a leak (6). Far off, where a mark would be
     smaller than a pixel, they fade into a darker tone of the same weight. */
  SE.LENS_VS = `
layout(location=0) in vec3 a_position; layout(location=1) in vec3 a_normal; layout(location=4) in vec4 a_aux;
uniform mat4 u_viewProj, u_world; uniform vec3 u_camPos; out vec3 v_n; out vec3 v_w; out vec4 v_x;
void main() { vec4 w = u_world * vec4(a_position, 1.0); v_n = mat3(u_world) * a_normal;
  w.xyz += normalize(v_n) * (0.06 + min(0.0009 * distance(u_camPos, w.xyz), 0.5)); v_w = w.xyz; v_x = a_aux; gl_Position = u_viewProj * w; }`;
  SE.LENS_FS = `
in vec3 v_n; in vec3 v_w; in vec4 v_x; uniform vec3 u_camPos, u_sun; uniform float u_time, u_rows; uniform sampler2D u_pal; out vec4 o_color;
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
void main() {
  vec3 N = normalize(v_n); float v = clamp(v_x.x, 0.0, 1.0), row = floor(v_x.w + 0.5), dens = clamp(v_x.y, 0.0, 1.0), kind = floor(v_x.z + 0.5), m = 0.0;
  vec3 base = pow(texture(u_pal, vec2(mix(0.002, 0.998, v), (row + 0.5) / u_rows)).rgb, vec3(2.2));
  vec3 T = abs(N.y) > 0.985 ? vec3(1.0, 0.0, 0.0) : normalize(vec3(N.z, 0.0, -N.x)), B = normalize(cross(N, T)); vec2 q = vec2(dot(v_w, T), dot(v_w, B));
  float px = max(max(fwidth(q.x), fwidth(q.y)), 1e-4), far = smoothstep(0.1, 0.32, px);
  if (dens > 0.012 && kind > 0.5 && far < 1.0) {
    if (kind < 1.5) { vec2 g = vec2(q.x / 0.9, q.y / 0.42), f = fract(g); m = step(h21(floor(g)), dens * 0.5) * step(0.05, f.x) * step(f.x, 0.95) * step(0.08, f.y) * step(f.y, 0.92); }
    else if (kind < 2.5) { vec2 g = q / 0.5, id = floor(g), c = vec2(h21(id + 1.3), h21(id + 2.7)) * 0.6 + 0.2; m = step(h21(id + 7.0), dens * 0.75) * (1.0 - smoothstep(0.11, 0.2, distance(fract(g), c))); }
    else if (kind < 3.5) { m = step(1.0 - dens * 0.85, h21(floor(q / 0.8)) * 0.6 + h21(floor(q / 0.27) + 3.1) * 0.4) * 0.8; }
    else if (kind < 4.5) { float ci = floor(q.x / 0.35), r = h21(vec2(ci, 3.0)); m = step(r, dens * 0.9) * (1.0 - smoothstep(0.2, 0.5, abs(fract(q.x / 0.35) - 0.5))) * step(fract(q.y / 4.0 + r) * 4.0, fract(r * 7.3) * 3.0 + 0.7) * 0.85; }
    else if (kind < 5.5) { m = step(1.0 - dens * 0.7, h21(floor(q / 0.45) + 11.0)) * 0.9; }
    else { vec2 g = q / 1.6; float d = distance(fract(g), vec2(0.5)); m = step(h21(floor(g) + 5.0), dens * 0.6) * (1.0 - smoothstep(0.0, 0.07, abs(d - 0.3))); }
  }
  vec3 mc = kind < 1.5 ? vec3(0.015, 0.02, 0.03) : kind < 2.5 ? vec3(1.0) : kind < 3.5 ? vec3(0.03, 0.02, 0.02) : kind < 4.5 ? vec3(0.008, 0.03, 0.008) : kind < 5.5 ? vec3(0.3, 0.07, 0.02) : vec3(0.85, 1.0, 1.0);
  float key = max(dot(N, normalize(u_sun + vec3(0.0, 0.6, 0.0))), 0.0);
  vec3 col = base * (0.84 + 0.16 * key);
  col = mix(col, mc, m * 0.85 * (1.0 - far));
  if (kind > 0.5) col *= 1.0 - 0.3 * dens * far * (kind > 1.5 && kind < 2.5 ? 0.0 : 1.0);
  o_color = vec4(col, 1.0);
}`;
""")

# ---- Louisiana's walls and roofs ----
rep("      if (c === 'sf' || c === 'garage' || c === 'shed') return F(r < 0.55 ? 'brick' : 'siding', c === 'sf' ? 'home' : 'none');",
    "      /* env.brickShare (optional) gives a house's chance of brick, or null for a building that is not drawn as a house: New\n         Orleans is mostly weatherboard; a duplex to fourplex it calls a house takes the house rule */\n      const bs = env.brickShare ? env.brickShare(b) : null;\n      if (c === 'sf' || c === 'garage' || c === 'shed' || (c === 'mf' && bs != null)) return F(r < (bs != null ? bs : 0.45) ? 'brick' : 'siding', c === 'garage' || c === 'shed' ? 'none' : 'home');")
rep("    const statusCol = b => { const c = hexRGB(env.color(b)); return c; };\n",
    """    const statusCol = b => { const c = hexRGB(env.color(b)); return c; };
    /* the shape of the roof over one ring of a footprint: a hipped roof (the footprint is the eave line, offset inward to the
       ridge) or a flat one behind a parapet. Louisiana homes pitch steeper than a Texas ranch: up to about 7 in 12 on houses
       and apartments where the recorded height leaves a window high eave (2.8 m), 5 in 12 on the rest. The walls and the roof
       views both stand on this, so a reading lies exactly on the roof it is of. */
    K.roofShape = (P, hRaw, flat, cls) => {
      const ar = Math.abs(area(P));
      if (flat) { const para = ar > 120 && hRaw > 4.2, Pi = para ? off(P, 0.3) : null, inner = Pi && validOffset(P, Pi) ? Pi : null; return { flat: true, inner, deck: inner ? hRaw - 0.9 : hRaw, eave: hRaw, rise: 0, top: hRaw, Q: inner || P }; }
      let d = Math.min(9, 0.46 * minWidth(P)), Qr = d > 0.25 ? off(P, d) : null, tries = 0; while (Qr && !validOffset(P, Qr) && tries++ < 4) { d *= 0.7; Qr = off(P, d); }
      let rise; if (Qr && validOffset(P, Qr)) rise = cls === 'sf' || cls === 'mf' ? Math.max(d * 0.42, Math.min(d * 0.58, hRaw - 2.8)) : d * 0.42; else { const [mx, mz] = centroid(P); Qr = P.map(p => [mx + (p[0] - mx) * 0.35, mz + (p[1] - mz) * 0.35]); rise = clamp(0.2 * Math.sqrt(ar), 0.8, 3); }
      let eave = hRaw - rise; if (eave < 2.5) { eave = Math.max(2.2, Math.min(2.5, hRaw - 0.6)); rise = Math.max(0.4, hRaw - eave); }
      return { flat: false, Q: Qr, eave, rise, top: eave + rise };
    };
    /* a building's roof as planes, for the roof views: each with its normal, its area and its triangles; the rings (eave line
       and ridge line) the zones are measured from; a, the width of the edge and corner zones (ASCE 7: a tenth of the least
       width or 0.4 of the height, whichever is less, and at least 4 percent of the width or 0.9 m) */
    K.roofPlanes = b => {
      const rings = K.ringsOf(b); if (!rings.length) return null; const cls = b.cls || 'unk', hRaw = Math.max(2.4, env.height(b)), flat = env.flat(b), out = { planes: [], rings: [], area: 0, bb: [1e9, 1e9, -1e9, -1e9], flat, a: 9 };
      const tArea = (a, c, d) => { const ux = c[0] - a[0], uy = c[1] - a[1], uz = c[2] - a[2], vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2]; return 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx); };
      const lid = (Qr, y) => { const tris = []; let A = 0; SE.Poly.triangulate(Qr).forEach(t => { const a = [Qr[t[0]][0], y, Qr[t[0]][1]], c = [Qr[t[1]][0], y, Qr[t[1]][1]], d = [Qr[t[2]][0], y, Qr[t[2]][1]], ta = tArea(a, c, d); if (ta > 1e-4) { tris.push([a, c, d]); A += ta; } }); if (tris.length) out.planes.push({ n: [0, 1, 0], tris, area: A }); };
      rings.forEach(P => { const sh = K.roofShape(P, hRaw, flat, cls), mw = minWidth(P), hm = flat ? hRaw : (sh.eave + sh.top) / 2, a = Math.max(Math.min(0.1 * mw, 0.4 * hm), 0.04 * mw, 0.9);
        P.forEach(p => { if (p[0] < out.bb[0]) out.bb[0] = p[0]; if (p[1] < out.bb[1]) out.bb[1] = p[1]; if (p[0] > out.bb[2]) out.bb[2] = p[0]; if (p[1] > out.bb[3]) out.bb[3] = p[1]; });
        if (flat) lid(sh.inner || P, sh.deck);
        else { const Qr = sh.Q, eave = sh.eave, top = sh.top;
          for (let i = 0; i < P.length; i++) { const j = (i + 1) % P.length, a3 = [P[i][0], eave, P[i][1]], c3 = [P[j][0], eave, P[j][1]], dq = [Qr[j][0], top, Qr[j][1]], e = [Qr[i][0], top, Qr[i][1]];
            const ux = c3[0] - a3[0], uz = c3[2] - a3[2], v1 = [e[0] - a3[0], e[1] - a3[1], e[2] - a3[2]], v2 = [dq[0] - a3[0], dq[1] - a3[1], dq[2] - a3[2]], v = Math.hypot(v1[0], v1[1], v1[2]) > Math.hypot(v2[0], v2[1], v2[2]) ? v1 : v2;
            let nr = [-uz * v[1], uz * v[0] - ux * v[2], ux * v[1]]; const nl = Math.hypot(nr[0], nr[1], nr[2]) || 1; nr = nr.map(x => x / nl); if (nr[1] < 0) nr = nr.map(x => -x);
            const tris = [], A1 = tArea(a3, c3, dq), A2 = tArea(a3, dq, e); if (A1 > 1e-4) tris.push([a3, c3, dq]); if (A2 > 1e-4) tris.push([a3, dq, e]); if (tris.length) out.planes.push({ n: nr, tris, area: A1 + A2 }); }
          if (Math.abs(area(Qr)) > 0.05) lid(Qr, top); }
        out.rings.push({ P, Q: flat ? null : sh.Q }); out.area += Math.abs(area(P)); if (a < out.a) out.a = a; });
      return out;
    };
""")
rep("""          /* a hipped roof: the footprint is the eave line, offset inward to the ridge; the walls stand 42 cm in, under the eaves */
          let d = Math.min(9, 0.46 * minWidth(P)), Qr = d > 0.25 ? off(P, d) : null, tries = 0; while (Qr && !validOffset(P, Qr) && tries++ < 4) { d *= 0.7; Qr = off(P, d); }
          let rise; if (Qr && validOffset(P, Qr)) rise = d * 0.42; else { const [mx, mz] = centroid(P); Qr = P.map(p => [mx + (p[0] - mx) * 0.35, mz + (p[1] - mz) * 0.35]); rise = clamp(0.2 * Math.sqrt(ar), 0.8, 3); }
          let eave = hRaw - rise; if (eave < 2.5) { eave = Math.max(2.2, Math.min(2.5, hRaw - 0.6)); rise = Math.max(0.4, hRaw - eave); }
          const top = eave + rise, Wo = off(P, 0.42),""",
    """          /* a hipped roof (K.roofShape): the footprint is the eave line, offset inward to the ridge; the walls stand 42 cm in, under the eaves */
          const sh = K.roofShape(P, hRaw, false, cls), Qr = sh.Q, eave = sh.eave;
          const top = sh.top, Wo = off(P, 0.42),""")
rep("          const para = ar > 120 && hRaw > 4.2, deck = para ? hRaw - 0.9 : hRaw, Pi = para ? off(P, 0.3) : null, inner = Pi && validOffset(P, Pi) ? Pi : null;\n",
    "          const sh = K.roofShape(P, hRaw, true, cls), deck = sh.deck, inner = sh.inner;\n")
rep("      cand.forEach(c => { const r = Math.min(6.5, c.d * mx + 0.6);", "      cand.forEach(c => { const r = Math.min(10, c.d * mx + 0.6);   /* live oaks spread wide here */")
rep("  /* Five bodies cut to the measurements of the kinds of vehicle that fill Dallas Fort Worth's streets: the full-size crew cab\n     pickup, the full-size SUV (the class built at Arlington),",
    "  /* Five bodies cut to the measurements of the kinds of vehicle that fill Louisiana's streets: the full-size crew cab\n     pickup, the full-size SUV,")
rep("     floor area, and from those the system such a building most often carries in Dallas–Fort Worth (the same reading the\n     card gives in words:",
    "     floor area, and from those the system such a building most often carries in the Gulf South (as a card would give it\n     in words:")
rep("     is labelled as that wherever it is shown. Sizes are the trade's usual ones for the tonnage the reading implies. */",
    "     is labelled as that wherever it is shown. Sizes are the trade's usual ones for the tonnage the reading implies. In the\n     Louisiana Roofing Atlas only what stands out of doors is drawn (rooftop units, condensers, cooling towers: what a\n     roofer works round); the layer seen through walls carries the roof views instead. */")

# ---- the world: settings, the layer, trees kept for shade ----
rep("    const GFX_KEY = 'tda.scout.engine.v1', GFX0 = { q: 'auto', sun: 'afternoon', weather: 'clear', trees: true, live: true, lamps: true, glow: 'outline', life: true, wide: true, xray: false, roofKit: true };",
    "    const GFX_KEY = 'up.scout.engine.v1', GFX0 = { q: 'auto', sun: 'afternoon', day: 'today', weather: 'clear', trees: true, live: true, lamps: true, glow: 'outline', life: true, wide: true, lens: 'off', roofKit: true };")
rep("    const gfx = (() => { try { return Object.assign({}, GFX0, JSON.parse(localStorage.getItem(GFX_KEY) || '{}')); } catch (e) { return Object.assign({}, GFX0); } })();",
    "    const gfx = (() => { try { return Object.assign({}, GFX0, JSON.parse(localStorage.getItem(GFX_KEY) || '{}')); } catch (e) { return Object.assign({}, GFX0); } })(); if (!['off', 'thermal', 'wear', 'time'].includes(gfx.lens) || !env.lens) gfx.lens = 'off'; if (!['today', 'summer', 'fall', 'winter', 'spring'].includes(gfx.day)) gfx.day = 'today';")
rep("    const HV = HvacKit(engine, K, S, env), XR = new SE.XRay(engine), XM = new Map(); let ALTA = null;",
    "    const HV = HvacKit(engine, K, S, env), XR = new SE.XRay(engine, { key: 'rooflens', refuse: 'roof views', vs: SE.LENS_VS, fs: SE.LENS_FS, dim: 0.36 }), XM = new Map(); let ALTA = null;")
rep("      c.trees = { e, ib, n: list.length }; S.treeN += l", "      c.trees = { e, ib, n: list.length, list }; S.treeN += l")
rep("      xraySync(); if (did || queue.length) need();", "      lensSync(); if (did || queue.length) need();")
cut("    /* ---------- x-ray: the likely heating and cooling of the buildings round the camera, seen through their walls ---------- */\n",
    "    /* what is under a point (a roof, or the ground), and whether a wall stands there at a height: the drone's world */\n", lens)
rep("<span>X-RAY <b>${gfx.xray ? 'on' : 'off'}</b></span></span>", "<span>ROOF VIEW <b>${gfx.lens === 'off' ? 'off' : gfx.lens + (gfx.lens === 'time' ? ' +' + S.year : '')}</b></span></span>")
rep("W S A D fly · ← → turn · ↑ ↓ or R F climb and descend · C camera · X x-ray · H return home", "W S A D fly · ← → turn · ↑ ↓ or R F climb and descend · C camera · X roof views · H return home")
rep("'x-ray': 'the x-ray layer' };", "'x-ray': 'the x-ray layer', 'roof views': 'the roof views' };")

# ---- the sun on a chosen day of the year ----
rep("      const now = new Date(); if (preset === 'now') return now; const offH = lon / 15,",
    "      const now = dayDate(); if (preset === 'now') return now; const offH = lon / 15,")
rep("    const SUN_AT = { morning: 0.2, midday: 0.5, afternoon: 0.72, evening: 0.93 };\n",
    "    const SUN_AT = { morning: 0.2, midday: 0.5, afternoon: 0.72, evening: 0.93 };\n    /* this moment on the chosen day of the year (today, or the 21st of July, October, January or April): the sun's path, and for the Thermal roof view the air's normal temperature, are that day's */\n    const dayDate = () => { const n = new Date(), d = DAYS[gfx.day]; if (!d) return n; const t = new Date(n.getTime()); t.setUTCMonth(d[0], d[1]); return t; };\n")
rep("      const la = S.lat0 || 32.8, lo = S.lon0 || -96.8, t = sunTime(gfx.sun, la, lo),", "      const la = S.lat0 || 30.45, lo = S.lon0 || -91.19, t = sunTime(gfx.sun, la, lo),")
rep("      S.sunNote = p.alt < -1 ? 'The sun is down in Dallas at that hour: the scene is lit by the moon, the lamps and the windows.' : '';",
    "      S.sunNote = p.alt < -1 ? 'The sun is down here at that hour: the scene is lit by the moon, the lamps and the windows.' : '';")

# ---- keys, the lens and the year, what the module is told ----
rep("    I.on('key', code => { if (code === 'KeyX') { setXray(!gfx.xray); return; }",
    "    I.on('key', code => { if (code === 'KeyX') { const L = ['off', 'thermal', 'wear', 'time']; setLens(L[(L.indexOf(gfx.lens) + 1) % L.length]); return; } if (code === 'BracketRight' || code === 'BracketLeft') { if (gfx.lens === 'time') setYear(S.year + (code === 'BracketRight' ? 1 : -1)); return; }")
rep("    function setXray(on) { gfx.xray = !!on; saveGfx(); xraySync(true); drawLegend(); need(3); if (env.onGraphics) env.onGraphics(graphics()); }",
    "    function setLens(l) { if (!LV || !['off', 'thermal', 'wear', 'time'].includes(l)) l = 'off'; if (l === gfx.lens) return; gfx.lens = l; saveGfx(); legT = 0; lensSync(true); drawLegend(); need(3); if (env.onGraphics) env.onGraphics(graphics()); }\n    function setYear(y, quiet) { y = clamp(Math.round(+y || 0), 0, LV ? LV.YEARS : 15); if (y === S.year) return; S.year = y; legT = 0; lensSync(true); need(3); if (!quiet && env.onGraphics) env.onGraphics(graphics()); }")
rep("xray: !!gfx.xray, xrayN: XM.size, roofKit:", "lens: gfx.lens, lensN: [...XM.values()].filter(m => m.mesh && m.gen === lensGen).length, lensPending: lensLeft, year: S.year, day: gfx.day, roofKit:")
rep("S.gen++; xrayClear(); HV.clear();", "S.gen++; lensClear(); HV.clear();")
rep("        if (o.sun != null && o.sun !== gfx.sun) { gfx.sun = o.sun; setSun(); }", "        if (o.day && DAYS[o.day] !== undefined && o.day !== gfx.day) { gfx.day = o.day; setSun(); } if (o.sun != null && o.sun !== gfx.sun) { gfx.sun = o.sun; setSun(); }")
rep("if (o.xray != null && !!o.xray !== !!gfx.xray) setXray(o.xray);", "if (o.lens != null && o.lens !== gfx.lens) setLens(o.lens); if (o.year != null) setYear(o.year, true);")
cut("dropCrate, engine, canvas: cv, kit: K, street: ST, world: S, hvac: HV, hvacRead: id =>", "wideKit: WIDE,",
    "dropCrate, engine, canvas: cv, kit: K, street: ST, world: S, hvac: HV, lens: l => setLens(l), year: y => setYear(y), lensRefresh() { lensGen++; legT = 0; lensSync(true); need(3); }, lensLayer: XR, lensOf: id => lensOf(id), lensMap: XM, ")
# ---- build 12's inference of heating and cooling from Dallas records and statistics has no place over Louisiana roofs: the
#      kit that sets rooftop units on a roof keeps its plain rule (it asks for the inference and is told there is none) ----
cut("  /* ==== rooftop scout on the engine: which heating and cooling system a building most likely has, and how sure ==== */\n", "  /* ==== rooftop scout on the engine: the neighborhood, streamed around the camera ==== */\n",
    "  /* (build 12's inference of heating and cooling from appraisal records and statistics is left out of the Louisiana engine:\n     the rooftop units a roofer works round are placed by the plain rule) */\n  SE.HvacInfer = () => ({ ok: false, setTractFields() {}, famName: {} });\n\n")
# the label over a building says the roof view's reading while a view is on
rep("if (!v.seen) continue; put(s[0] * W, s[1] * H, env.label ? env.label(b) : '',", "if (!v.seen) continue; const lr = gfx.lens !== 'off' && LV && LV.label ? lensOf(l.id) : null; let lt = ''; if (lr) { try { lt = LV.label(gfx.lens, lr) || ''; } catch (e) { lt = ''; } } put(s[0] * W, s[1] * H, lt || (env.label ? env.label(b) : ''),")
open(os.path.join(SP, 'build', 'engine.js'), 'w', encoding='utf-8').write(s)
left = [l for l in ['xraySync', 'xrayClear', 'setXray', 'gfx.xray', 'Dallas', 'tda.'] if l in s]
print('ok', len(s), 'left over:', left)
