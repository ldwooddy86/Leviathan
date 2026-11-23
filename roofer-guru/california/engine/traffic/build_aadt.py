"""Builds the compact table of Caltrans traffic count points the Scout Engine's traffic reads.

Source: Caltrans Traffic Census, 2024 annual average daily traffic (AADT), the GIS layer
CHhighway/Traffic_AADT (14,080 count points on the state highway system), saved whole in
CA/dl/scout/traffic/caltrans_aadt_points.csv. AADT is both directions added together, vehicles a day.

What is kept: one point per route per cell of 0.01 degree (about 1 km) in the three metros and 0.03 degree elsewhere, the larger of the count's "back" and "ahead"
legs. Points under 8,000 a day outside the three metros are
dropped (a road that quiet reads the same as the default). Ten characters a point, base 36:
  lat (3): round((lat - 32) * 1000)      lon (3): round((lon + 125) * 1000)
  aadt (2): thousands a day              route (2): the route number

  python3 -I build_aadt.py <caltrans_aadt_points.csv> <out aadt_table.js>"""
import csv, sys
B = '0123456789abcdefghijklmnopqrstuvwxyz'
def b36(n, w):
    s = ''
    for _ in range(w): s = B[n % 36] + s; n //= 36
    assert n == 0
    return s
def num(v):
    try: return float(v)
    except ValueError: return 0.0
METRO = [(33.3, 34.5, -119.0, -117.3), (37.2, 38.1, -122.7, -121.7), (32.5, 33.3, -117.4, -116.8)]
best = {}
rows = 0
with open(sys.argv[1], encoding='utf-8') as f:
    for r in csv.DictReader(f):
        rows += 1
        la, lo = num(r['lat']), num(r['lon'])
        a = max(num(r['BACK_AADT']), num(r['AHEAD_AADT']))
        if not (32 <= la <= 42.2 and -125 <= lo <= -114) or a <= 0: continue
        try: rt = int(r['RTE'])
        except ValueError: continue
        metro = any(m[0] < la < m[1] and m[2] < lo < m[3] for m in METRO)
        if a < 8000 and not metro: continue
        g = 100 if metro else 33
        k = (rt, round(la * g), round(lo * g))
        if k not in best or a > best[k][2]: best[k] = (la, lo, a, rt)
pts = sorted(best.values(), key=lambda p: (p[3], p[0], p[1]))
d = ''.join(b36(round((la - 32) * 1000), 3) + b36(round((lo + 125) * 1000), 3) + b36(min(1295, round(a / 1000)), 2) + b36(rt, 2) for la, lo, a, rt in pts)
out = ("  /* Caltrans Traffic Census 2024, annual average daily traffic at %d count points (of %d in the layer); built by\n"
       "     build_aadt.py. Ten characters a point, base 36: latitude, longitude (thousandths of a degree from 32 N, 125 W),\n"
       "     thousands of vehicles a day (both directions), route number. Measured counts, grade A. */\n"
       "  SE.AADT = { year: 2024, n: %d, d: '%s' };\n") % (len(pts), rows, len(pts), d)
open(sys.argv[2], 'w', encoding='utf-8').write(out)
print('rows', rows, 'kept', len(pts), 'bytes', len(out))
top = sorted(pts, key=lambda p: -p[2])[:3]
print('busiest', top)
