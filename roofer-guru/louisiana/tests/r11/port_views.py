"""Round 11: the roof views in the Scout Engine take three more (Covering, Shingle style, Storm). Reads build/engine.js
as port_uap.py left it and writes it back: the roof view shader draws each covering's pattern at its real size, the view
names come from the module's list, and the storm on the scale reaches the readings. Every anchor must occur exactly once.
  python3 -I tests/r11/port_views.py"""
import os
SP = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
P = os.path.join(SP, 'build', 'engine.js')
s = open(P, encoding='utf-8').read()
def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (s.count(a), a[:110])
    s = s.replace(a, b)

# ---- the shader: patterns in the plane of the roof, along the eave (q.x) and up the slope (q.y), in metres ----
rep("wind (1), hail hits (2), worn patches (3), algae streaks (4), rust (5), a leak (6). Far off, where a mark would be",
    "wind (1), hail hits (2), worn patches (3), algae streaks (4), rust (5), a leak (6). From 7 up the mark is the\n"
    "     covering itself, drawn at its real size: three tab strips (7: 12 inch tabs, 5 inch exposure, each course half a\n"
    "     tab over), laminated shingles (8: 5 5/8 inch exposure, tabs of uneven width over a darker layer), standing seam\n"
    "     (9: 16 inches), ribbed panels with their screws showing (10: ribs at 12 inches), barrel tile (11), slate (12), a\n"
    "     white membrane's seams (13: 10 ft sheets) and a dark one's (14: 1 m rolls). Far off, where a mark would be")
rep("  if (dens > 0.012 && kind > 0.5 && far < 1.0) {\n", """  float pm = 0.0, lite = 0.0;
  if (kind > 6.5) {
    float fineK = 1.0 - smoothstep(0.035, 0.1, px), midK = 1.0 - smoothstep(0.1, 0.3, px), wideK = 1.0 - smoothstep(0.5, 1.6, px);
    if (kind < 7.5) { float cy = q.y / 0.127, rw = floor(cy), fy = fract(cy), fx = fract(q.x / 0.305 + 0.5 * mod(rw, 2.0));
      pm = max(1.0 - smoothstep(0.006, 0.006 + px, min(fy, 1.0 - fy) * 0.127), 1.0 - smoothstep(0.005, 0.005 + px, min(fx, 1.0 - fx) * 0.305)) * fineK; }
    else if (kind < 8.5) { float cy = q.y / 0.143, rw = floor(cy), fy = fract(cy), u = q.x / 0.17 + h21(vec2(rw, 7.0)) * 5.0, tb = floor(u), fx = fract(u), r = h21(vec2(tb, rw)), w = 0.4 + 0.55 * r, up = step(fx, w);
      pm = max((1.0 - smoothstep(0.006, 0.006 + px, min(fy, 1.0 - fy) * 0.143)) * 0.85, max((1.0 - up) * 0.5, up * (1.0 - smoothstep(0.006, 0.006 + px, abs(fx - w) * 0.17)) * 0.7)) * fineK; lite = up * (r - 0.5) * 0.25 * fineK; }
    else if (kind < 9.5) { float fx = fract(q.x / 0.406), d = min(fx, 1.0 - fx) * 0.406; pm = (1.0 - smoothstep(0.012, 0.012 + px, d)) * midK; lite = (1.0 - smoothstep(0.012, 0.05, d)) * 0.25 * midK * step(0.5, fx); }
    else if (kind < 10.5) { float fx = fract(q.x / 0.305), d = min(fx, 1.0 - fx) * 0.305; vec2 g = vec2((fx > 0.5 ? fx - 1.0 : fx) * 0.305 - 0.05, (fract(q.y / 0.61) - 0.5) * 0.61);
      pm = max((1.0 - smoothstep(0.02, 0.02 + px, d)) * 0.8 * midK, (1.0 - smoothstep(0.014, 0.014 + px, length(g))) * fineK); }
    else if (kind < 11.5) { float fy = fract(q.y / 0.26), fx = fract(q.x / 0.21); pm = max((1.0 - smoothstep(0.012, 0.012 + px, min(fy, 1.0 - fy) * 0.26)) * 0.9, (0.5 - 0.5 * cos(fx * 6.2832)) * 0.55) * midK; lite = (0.5 + 0.5 * cos(fx * 6.2832)) * 0.2 * midK; }
    else if (kind < 12.5) { float cy = q.y / 0.216, rw = floor(cy), fy = fract(cy), cx = q.x / 0.28 + 0.5 * mod(rw, 2.0), fx = fract(cx);
      pm = max(1.0 - smoothstep(0.005, 0.005 + px, min(fy, 1.0 - fy) * 0.216), 1.0 - smoothstep(0.004, 0.004 + px, min(fx, 1.0 - fx) * 0.28)) * fineK; lite = (h21(vec2(floor(cx), rw)) - 0.5) * 0.3 * fineK; }
    else { float sp = kind < 13.5 ? 3.05 : 0.9, fx = fract(q.x / sp), d = min(fx, 1.0 - fx) * sp; pm = (1.0 - smoothstep(0.03, 0.03 + px, d)) * 0.7 * (kind < 13.5 ? wideK : midK); }
  }
  if (dens > 0.012 && kind > 0.5 && kind < 6.5 && far < 1.0) {
""")
rep("""  col = mix(col, mc, m * 0.85 * (1.0 - far));
  if (kind > 0.5) col *= 1.0 - 0.3 * dens * far * (kind > 1.5 && kind < 2.5 ? 0.0 : 1.0);
""", """  if (kind > 6.5) { col *= 1.0 + lite; col = mix(col, vec3(0.012, 0.014, 0.018), pm * 0.8 * dens); }
  else { col = mix(col, mc, m * 0.85 * (1.0 - far)); if (kind > 0.5) col *= 1.0 - 0.3 * dens * far * (kind > 1.5 && kind < 2.5 ? 0.0 : 1.0); }
""")

# ---- the views are the module's list ----
rep("if (!['off', 'thermal', 'wear', 'time'].includes(gfx.lens) || !env.lens) gfx.lens = 'off';", "if (!env.lens || !env.lens.list.some(x => x[0] === gfx.lens)) gfx.lens = 'off';")
rep("if (!LV || !['off', 'thermal', 'wear', 'time'].includes(l)) l = 'off';", "if (!LV || !LV.list.some(x => x[0] === l)) l = 'off';")
rep("const L = ['off', 'thermal', 'wear', 'time']; setLens(L[(L.indexOf(gfx.lens) + 1) % L.length]); return; }", "const L = LV ? LV.list.map(x => x[0]) : ['off']; setLens(L[(L.indexOf(gfx.lens) + 1) % L.length]); return; }")

# ---- the storm on the scale reaches the readings: the Storm view reads it, and under a storm's cloud the Thermal view reads an overcast sky ----
rep("return { year: S.year, weather: gfx.weather,", "return { year: S.year, storm: S.storm, stormStep: SE.STORM[S.storm], surgeNote: S.surgeNote, weather: S.storm ? 'rain' : gfx.weather,")
rep("weatherLabel: WLAB[gfx.weather] || gfx.weather };", "weatherLabel: S.storm ? SE.STORM[S.storm].l.toLowerCase() : WLAB[gfx.weather] || gfx.weather };")
rep("S.storm = n; setSun(); grounded(); engine.wake();", "S.storm = n; setSun(); grounded(); engine.wake(); if (gfx.lens === 'storm' || gfx.lens === 'thermal') { lensGen++; legT = 0; lensSync(true); }")

open(P, 'w', encoding='utf-8').write(s)
print('views ok', len(s))
