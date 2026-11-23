"""California roof views, engine side: four more roofing patterns in the roof view shader (flat concrete tile, S tile,
wood shakes, a gravel surfaced built up roof), and a number the dashboard reads to know the engine can draw them.
The views themselves (Covering, Shingle style, Thermal, Wear, Weather, Fire, Solar and cool roof, Time) are the
dashboard's (CA/scout/scout.js: LENS): the engine takes their list, colours and readings from env.lens, so nothing
else in the engine changes for them. Applied last, after the terrain, weather, traffic, car and sky ports; every
anchor is inside the lens code and must occur exactly once.

  python3 -I port_views_ca.py <in.js> <out.js>

Patterns, in the plane of the roof (q.x along the eave, q.y up the slope, metres), at common nominal sizes:
  15 flat concrete tile   14 inches (0.356 m) to the weather, 12 inches (0.305 m) wide, each course half a tile over
  16 S tile               14 inch courses, crowns at 11 3/4 inches (0.298 m): a round crown beside a flat pan
  17 wood shakes          10 inch (0.254 m) exposure, shakes of uneven width (about 4 to 12 inches), butts uneven
  18 built up, gravel     pea gravel as a 2 cm speckle over the plies
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
    "    else if (kind < 15.5) { float cy = q.y / 0.356, rw = floor(cy), fy = fract(cy), cx = q.x / 0.305 + 0.5 * mod(rw, 2.0), fx = fract(cx);\n"
    "      pm = max((1.0 - smoothstep(0.012, 0.012 + px, min(fy, 1.0 - fy) * 0.356)) * 0.95, (1.0 - smoothstep(0.004, 0.004 + px, min(fx, 1.0 - fx) * 0.305)) * 0.7) * midK; lite = (h21(vec2(floor(cx), rw)) - 0.5) * 0.14 * midK; }\n"
    "    else if (kind < 16.5) { float fy = fract(q.y / 0.356), u = fract(q.x / 0.298), sw = sin(u * 6.2832);\n"
    "      pm = max((1.0 - smoothstep(0.014, 0.014 + px, min(fy, 1.0 - fy) * 0.356)) * 0.9, max((0.5 - 0.5 * sw) * step(0.5, u) * 0.6, (1.0 - smoothstep(0.0, 0.05, abs(u - 0.5))) * 0.45)) * midK; lite = max(sw, 0.0) * 0.28 * midK; }\n"
    "    else if (kind < 17.5) { float cy = q.y / 0.254, rw = floor(cy), u = q.x / 0.2 + h21(vec2(rw, 3.0)) * 7.0, id = floor(u), fx = fract(u), r = h21(vec2(id, rw)), w = 0.55 + 0.4 * r, fy = fract(cy + (r - 0.5) * 0.12);\n"
    "      pm = max((1.0 - smoothstep(0.01, 0.01 + px, min(fy, 1.0 - fy) * 0.254)) * 0.9, (1.0 - smoothstep(0.006, 0.006 + px, abs(fx - w) * 0.2)) * 0.8) * fineK; lite = (r - 0.5) * 0.35 * fineK; }\n"
    "    else { vec2 gv = floor(q / 0.02); pm = step(0.6, h21(gv)) * 0.35 * fineK; lite = (h21(gv + 4.0) - 0.5) * 0.3 * fineK; }\n")

# ---- the dashboard asks the engine how many patterns it can draw ----
rep("lensRefresh() { lensGen++; legT = 0; lensSync(true); need(3); }", "lensPatterns: 18, lensRefresh() { lensGen++; legT = 0; lensSync(true); need(3); }")

open(sys.argv[2], 'w', encoding='utf-8').write(s)
print('views (California) ok:', n, 'anchors,', len(s), 'bytes')
