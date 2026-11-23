"""Traffic job: the road-reading lines of the dashboard script (scout.js), as a small anchored patch for its owner to apply.

What changes, and nothing else:
  1. The block from `const OVERPASS = [` to just before `const flatRoof = b =>` (osmKind, tigerKind, roads3d) is replaced
     by scout_roads.js: freeways and ramps become kinds of their own (`freeway`, `ramp`), every road carries `id, hw, ref,
     lanes, oneway, maxspeed (m/s), layer, bridge, tunnel, hov`, cable car tracks come as kind `cable`, the answer carries
     `signals` and `stops` (the map's own signal and stop sign points), answers are cached by the box asked for, and
     `roads3d(la, lo, r, { only: 'freeway' })` asks for motorways alone over a large box.
  2. The Census TIGER fallback also asks layer 2 (Primary Roads), where the freeway mainlines are.
New kinds the rest of scout.js may want words for: `freeway`, `ramp` (and `cable`, which is not a road to stand on).

  python3 -I port_traffic_scout.py <scout.js in> <scout.js out>"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
s = open(sys.argv[1], encoding='utf-8').read()
new = open(os.path.join(HERE, 'scout_roads.js'), encoding='utf-8').read()
A, B = "      const OVERPASS = ['https://overpass-api.de/api/interpreter'", "      const flatRoof = b =>"
assert s.count(A) == 1 and s.count(B) == 1, (s.count(A), s.count(B))
i, j = s.index(A), s.index(B); assert i < j
s = s[:i] + new + s[j:]
T = "t.roadsP = Promise.all([8, 6].map(L => getJSON(EP.roads + L + '/query?'"
assert s.count(T) == 1, s.count(T)
s = s.replace(T, "t.roadsP = Promise.all([8, 6, 2].map(L => getJSON(EP.roads + L + '/query?'")
open(sys.argv[2], 'w', encoding='utf-8').write(s)
print('wrote', sys.argv[2], len(s))
