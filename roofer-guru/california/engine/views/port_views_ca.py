"""California roof views, engine side: four more roofing patterns in the roof view shader (flat concrete tile, S tile,
wood shakes, a gravel surfaced built up roof), and a number the dashboard reads to know the engine can draw them.
The views themselves (Covering, Shingle style, Thermal, Wear, Weather, Fire, Solar and cool roof, Time) are the
dashboard's (CA/scout/scout.js: LENS): the engine takes their list, colours and readings from env.lens, so nothing
else in the engine changes for them. Applied last, after the terrain, weather, traffic, car and sky ports; every
anchor is inside the lens code and must occur exactly once.

  python3 -I port_views_ca.py <in.js> <out.js>

Patterns, in the plane of the roof (q.x along the eave, q.y up the slope, metres), at common nominal sizes:
  15 flat concrete tile   14 inches (0.356 m) to the weather, 12 inches (0.305 m) wide, each course half a tile over;
                          the butt line strong, the joints hairlines, each tile its own shade
  16 S tile               14 inch courses, crowns at 11 3/4 inches (0.298 m): a lit crown beside a pan in shadow, the
                          corrugation up the slope the strong mark, the courses stepping down over each crown
  17 wood shakes          10 inch (0.254 m) exposure, shakes of uneven width (about 4 to 12 inches), butts uneven, each
                          shake weathered to its own tone; the courses carry to a drone's height
  18 built up, gravel     pea gravel as a 2 cm speckle close by; from higher, the mottle of thick and thin gravel and the
                          dark patches where it has scoured off (noise at 0.8 m and 2.6 m)
Looked at in pictures from 13 m and from 37 m (CA/scout_integ/shots, CA/scout/tests/views_shots.js).
7 to 14 stay as they were (three tab, laminated, standing seam, ribbed panels, barrel tile, slate, a white membrane's
sheets, a cap sheet's rolls)."""
import sys
if len(sys.argv) != 3:
    sys.exit(__doc__)
s = open(sys.argv[1], encoding='utf-8').read()
n = 0
def rep(a, b):
    global s, n
    c = s.count(a)
    assert c == 1, (c, a[:120])
    s = s.replace(a, b); n += 1

# ---- the shader's note ----
rep("white membrane's seams (13: 10 ft sheets) and a dark one's (14: 1 m rolls). Far off, where a mark would be",
    "white membrane's seams (13: 10 ft sheets), a cap sheet's or other dark roll roofing's (14: 1 m rolls), flat\n"
    "     concrete tile (15: 14 inches to the weather, 12 wide, courses broken half a tile), S tile (16: crowns at 11 3/4\n"
    "     inches), wood shakes (17: 10 inch exposure, uneven widths) and the gravel of a built up roof (18). Far off, where a mark would be")

# ---- the patterns ----
rep("    else { float sp = kind < 13.5 ? 3.05 : 0.9, fx = fract(q.x / sp), d = min(fx, 1.0 - fx) * sp; pm = (1.0 - smoothstep(0.03, 0.03 + px, d)) * 0.7 * (kind < 13.5 ? wideK : midK); }\n",
    "    else if (kind < 14.5) { float sp = kind < 13.5 ? 3.05 : 0.9, fx = fract(q.x / sp), d = min(fx, 1.0 - fx) * sp; pm = (1.0 - smoothstep(0.03, 0.03 + px, d)) * 0.7 * (kind < 13.5 ? wideK : midK); }\n"
    # 15 flat concrete tile: the butt of each course is the strong line (a thick tile throws a shadow on the course below),
    #    the joints between tiles in a course are hairlines, each tile a shade of its own, lighter toward its butt
    "    else if (kind < 15.5) { float cy = q.y / 0.356, rw = floor(cy), fy = fract(cy), cx = q.x / 0.305 + 0.5 * mod(rw, 2.0), fx = fract(cx), tn = h21(vec2(floor(cx), rw));\n"
    "      pm = max((1.0 - smoothstep(0.016, 0.016 + px, min(fy, 1.0 - fy) * 0.356)) * 0.95, (1.0 - smoothstep(0.003, 0.003 + px * 0.6, min(fx, 1.0 - fx) * 0.305)) * 0.38) * midK; lite = ((tn - 0.5) * 0.16 + (0.5 - fy) * 0.14) * midK; }\n"
    # 16 S tile: what shows from above is the corrugation, a lit crown beside a pan in shadow running up the slope; the
    #    courses cross it as fainter lines that step down over each crown
    "    else if (kind < 16.5) { float u = fract(q.x / 0.298), sw = sin(u * 6.2832), cr = max(sw, 0.0), fy = fract(q.y / 0.356 - 0.1 * cr);\n"
    "      pm = max((1.0 - smoothstep(0.012, 0.012 + px, min(fy, 1.0 - fy) * 0.356)) * 0.55, max((0.5 - 0.5 * sw) * step(0.5, u) * 0.8, (1.0 - smoothstep(0.0, 0.04, abs(u - 0.5))) * 0.5)) * midK; lite = (cr * 0.42 - 0.05) * midK; }\n"
    # 17 wood shakes: ragged courses that still show from a drone's height, shakes of uneven width each weathered to its own
    #    grey or brown, joints only from close by
    "    else if (kind < 17.5) { float cy = q.y / 0.254, rw = floor(cy), u = q.x / 0.2 + h21(vec2(rw, 3.0)) * 7.0, id = floor(u), fx = fract(u), r = h21(vec2(id, rw)), w = 0.55 + 0.4 * r, fy = fract(cy + (r - 0.5) * 0.2);\n"
    "      pm = max((1.0 - smoothstep(0.014, 0.014 + px, min(fy, 1.0 - fy) * 0.254)) * 0.95 * midK, (1.0 - smoothstep(0.005, 0.005 + px, abs(fx - w) * 0.2)) * 0.75 * fineK);\n"
    "      lite = ((r - 0.5) * 0.5 * mix(0.55, 1.0, fineK) + (h21(vec2(id + 31.0, rw)) - 0.5) * 0.18 + (0.5 - fy) * 0.16) * midK; }\n"
    # 18 a built up roof under gravel: the 2 cm speckle of pea gravel from close by; from higher, the mottle of thick and thin
    #    gravel and the dark patches where it has scoured off the flood coat (smooth noise at 0.8 m and 2.6 m)
    "    else { vec2 gv = floor(q / 0.02), p1 = q / 0.8, i1 = floor(p1), f1 = fract(p1), p2 = q / 2.6 + 3.7, i2 = floor(p2), f2 = fract(p2); f1 = f1 * f1 * (3.0 - 2.0 * f1); f2 = f2 * f2 * (3.0 - 2.0 * f2);\n"
    "      float n1 = mix(mix(h21(i1), h21(i1 + vec2(1.0, 0.0)), f1.x), mix(h21(i1 + vec2(0.0, 1.0)), h21(i1 + vec2(1.0, 1.0)), f1.x), f1.y), n2 = mix(mix(h21(i2), h21(i2 + vec2(1.0, 0.0)), f2.x), mix(h21(i2 + vec2(0.0, 1.0)), h21(i2 + vec2(1.0, 1.0)), f2.x), f2.y), bare = smoothstep(0.6, 0.74, n1 * 0.45 + n2 * 0.55);\n"
    "      pm = max(step(0.6, h21(gv)) * 0.35 * fineK, bare * 0.5 * wideK); lite = (h21(gv + 4.0) - 0.5) * 0.3 * fineK + (n1 - 0.5) * 0.3 * wideK; }\n")

# ---- the dashboard asks the engine how many patterns it can draw ----
rep("lensRefresh() { lensGen++; legT = 0; lensSync(true); need(3); }", "lensPatterns: 18, lensRefresh() { lensGen++; legT = 0; lensSync(true); need(3); }")

open(sys.argv[2], 'w', encoding='utf-8').write(s)
print('views (California) ok:', n, 'anchors,', len(s), 'bytes')
