#!/usr/bin/env python3
"""Step 2. Map geometry in the atlas format (contract_core 3.3).
x = (lon - minx) * kx * sx ; y = (maxy - lat) * sx ; paths 'M x y' + 'l dx dy'... + 'z', integers.
County and ZCTA layers are each cut into shared arcs (a topology), each arc is simplified once
(Douglas-Peucker, end points fixed) and the rings are put back together, so neighbours share
the same simplified border: no slivers, no gaps. The state outline is the set of county arcs
used by one county only.
Writes work/geo.json.   Usage: python3 -I 02_geo.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
import collections

G = os.path.join(DL, 'geo', 'raw', 'ca')
W = 4800
MINX, MAXX, MAXY, MINY = -124.6, -113.9, 42.1, 32.4
KX = math.cos(math.radians(37.25))
SX = W / ((MAXX - MINX) * KX)
H = int(round((MAXY - MINY) * SX))
EPS_Z, EPS_C, EPS_W, EPS_N = 0.3, 0.3, 0.5, 0.8     # simplification tolerances, view box units (1 unit = about 197 m)


def proj(lon, lat):
    return ((lon - MINX) * KX * SX, (MAXY - lat) * SX)


def rings_of(geom):
    if geom['type'] == 'Polygon':
        return [geom['coordinates']]
    return geom['coordinates']


def dp(pts, eps):
    """Douglas-Peucker on projected float points; returns indexes kept"""
    n = len(pts)
    if n <= 2:
        return list(range(n))
    keep = [False] * n
    keep[0] = keep[-1] = True
    st = [(0, n - 1)]
    e2 = eps * eps
    while st:
        a, b = st.pop()
        if b <= a + 1:
            continue
        ax, ay = pts[a]
        bx, by = pts[b]
        dx, dy = bx - ax, by - ay
        L = dx * dx + dy * dy
        mx, mi = -1.0, -1
        for i in range(a + 1, b):
            px, py = pts[i]
            if L == 0:
                d = (px - ax) ** 2 + (py - ay) ** 2
            else:
                t = ((px - ax) * dx + (py - ay) * dy) / L
                t = 0 if t < 0 else 1 if t > 1 else t
                d = (px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2
            if d > mx:
                mx, mi = d, i
        if mx > e2:
            keep[mi] = True
            st.append((a, mi))
            st.append((mi, b))
    return [i for i in range(n) if keep[i]]


def area2(r):
    s = 0
    for i in range(len(r)):
        x1, y1 = r[i]
        x2, y2 = r[(i + 1) % len(r)]
        s += x1 * y2 - x2 * y1
    return s


def topo_layer(feats, eps):
    """feats: {key: [polygon[ring[(lon,lat)]]]} -> {key: [ring[(x,y) ints]]}, plus arcs used once (outer boundary)"""
    # 1. rings as tuples of lon/lat without the closing point
    rings = []          # (key, [pts])
    for k, polys in feats.items():
        for poly in polys:
            for ring in poly:
                pts = [(round(p[0], 6), round(p[1], 6)) for p in ring]
                if pts[0] == pts[-1]:
                    pts = pts[:-1]
                # drop consecutive duplicates
                q = [pts[0]]
                for p in pts[1:]:
                    if p != q[-1]:
                        q.append(p)
                if len(q) >= 3:
                    rings.append((k, q))
    # 2. junctions: a vertex whose neighbour pair differs between occurrences
    nb = {}
    junction = set()
    for k, pts in rings:
        n = len(pts)
        for i, p in enumerate(pts):
            a, b = pts[i - 1], pts[(i + 1) % n]
            pair = (a, b) if a <= b else (b, a)
            old = nb.get(p)
            if old is None:
                nb[p] = pair
            elif old != pair:
                junction.add(p)
    # 3. cut rings into arcs
    arcs = {}           # canonical key -> simplified int points
    use = collections.Counter()
    ring_arcs = []      # (key, [(canon, reversed)])
    for k, pts in rings:
        n = len(pts)
        jx = [i for i, p in enumerate(pts) if p in junction]
        segs = []
        if not jx:
            # closed arc: rotate to the smallest point so both copies agree
            m = min(range(n), key=lambda i: pts[i])
            cyc = pts[m:] + pts[:m] + [pts[m]]
            segs.append(cyc)
        else:
            for a, b in zip(jx, jx[1:] + [jx[0] + n]):
                segs.append([pts[i % n] for i in range(a, b + 1)])
        lst = []
        for s in segs:
            t = tuple(s)
            r = tuple(reversed(s))
            closed = s[0] == s[-1]
            if closed:
                # orientation independent key for a closed arc
                r2 = (r[0],) + r[1:]
                canon, rev = (t, False) if t <= r2 else (r2, True)
            else:
                canon, rev = (t, False) if t <= r else (r, True)
            if canon not in arcs:
                pp = [proj(*p) for p in canon]
                keep = dp(pp, eps)
                if closed and len(keep) < 4 and len(pp) >= 4:
                    # keep a closed arc a polygon: add the points farthest from the first
                    far = sorted(range(1, len(pp) - 1), key=lambda i: -((pp[i][0] - pp[0][0]) ** 2 + (pp[i][1] - pp[0][1]) ** 2))[:2]
                    keep = sorted(set(keep) | set(far))
                arcs[canon] = [(int(round(pp[i][0])), int(round(pp[i][1]))) for i in keep]
            use[canon] += 1
            lst.append((canon, rev))
        ring_arcs.append((k, lst))
    # 4. reassemble
    out = collections.defaultdict(list)
    raw_area = collections.Counter()
    for (k, lst), (_, pts) in zip(ring_arcs, rings):
        pr = []
        for canon, rev in lst:
            a = arcs[canon]
            a = a[::-1] if rev else a
            pr.extend(a[:-1])
        q = []
        for p in pr:
            if not q or p != q[-1]:
                q.append(p)
        while len(q) > 1 and q[0] == q[-1]:
            q.pop()
        raw_area[k] += abs(area2([proj(*p) for p in pts])) / 2
        out[k].append(q)
    outer = [arcs[c] for c in arcs if use[c] == 1]
    return out, outer, raw_area, len(arcs), len(junction)


def path(rings):
    s = []
    for r in rings:
        if len(r) < 3:
            continue
        s.append('M%d %d' % r[0])
        px, py = r[0]
        for x, y in r[1:]:
            s.append('l%d %d' % (x - px, y - py))
            px, py = x, y
        s.append('z')
    return ''.join(s)


def clean(rings, min_area=1.5):
    """drop collapsed rings; keep the largest ring always"""
    good = []
    for r in rings:
        a = abs(area2(r)) / 2 if len(r) >= 3 else 0
        good.append((a, r))
    good.sort(key=lambda t: -t[0])
    keep = [r for a, r in good if a >= min_area]
    if not keep and good and good[0][0] > 0:
        keep = [good[0][1]]
    return keep


def chain(arcs):
    """join open arcs end to end into closed rings"""
    rings = []
    ends = collections.defaultdict(list)
    openarcs = []
    for a in arcs:
        if a[0] == a[-1]:
            rings.append(a[:-1])
        else:
            openarcs.append(a)
    for i, a in enumerate(openarcs):
        ends[a[0]].append(i)
        ends[a[-1]].append(i)
    used = [False] * len(openarcs)
    for i in range(len(openarcs)):
        if used[i]:
            continue
        used[i] = True
        cur = list(openarcs[i])
        while cur[0] != cur[-1]:
            nxt = None
            for j in ends[cur[-1]]:
                if not used[j]:
                    nxt = j
                    break
            if nxt is None:
                break
            used[nxt] = True
            a = openarcs[nxt]
            cur.extend(a[1:] if a[0] == cur[-1] else a[::-1][1:])
        if cur[0] == cur[-1]:
            cur = cur[:-1]
        q = []
        for p in cur:
            if not q or p != q[-1]:
                q.append(p)
        rings.append(q)
    return rings


def clip_box(ring, x0, x1, y0, y1):
    """Sutherland-Hodgman against a lon/lat box"""
    def cl(pts, inside, inter):
        out = []
        for i in range(len(pts)):
            a, b = pts[i - 1], pts[i]
            ia, ib = inside(a), inside(b)
            if ia and ib:
                out.append(b)
            elif ia and not ib:
                out.append(inter(a, b))
            elif not ia and ib:
                out.append(inter(a, b))
                out.append(b)
        return out
    def ix(v):
        return lambda a, b: (v, a[1] + (b[1] - a[1]) * (v - a[0]) / (b[0] - a[0]))
    def iy(v):
        return lambda a, b: (a[0] + (b[0] - a[0]) * (v - a[1]) / (b[1] - a[1]), v)
    p = list(ring)
    for inside, inter in ((lambda q: q[0] >= x0, ix(x0)), (lambda q: q[0] <= x1, ix(x1)),
                          (lambda q: q[1] >= y0, iy(y0)), (lambda q: q[1] <= y1, iy(y1))):
        if not p:
            break
        p = cl(p, inside, inter)
    return p


def simp_ring(ring, eps):
    pp = [proj(*p) for p in ring]
    if pp[0] != pp[-1]:
        pp.append(pp[0])
    keep = dp(pp, eps)
    q = []
    for i in keep[:-1]:
        p = (int(round(pp[i][0])), int(round(pp[i][1])))
        if not q or p != q[-1]:
            q.append(p)
    return q


base = load('base.json')
zset = {d['zip'] for d in base['zips']}

# ---- counties and outline
cj = json.load(open(os.path.join(G, 'ca_county_2024_500k.geojson')))
cf = {f['properties']['GEOID']: rings_of(f['geometry']) for f in cj['features']}
crings, outer, craw, narc, njun = topo_layer(cf, EPS_C)
parish = {}
for k in sorted(crings):
    parish[k] = path(clean(crings[k]))
outline_rings = clean(chain(outer), 1.0)
outline = path(sorted(outline_rings, key=lambda r: -abs(area2(r))))
print('counties', len(parish), 'arcs', narc, 'junctions', njun, 'bytes', sum(map(len, parish.values())), 'outline rings', len(outline_rings), len(outline))

# ---- ZCTAs
zj = json.load(open(os.path.join(G, 'ca_zcta520_2020_500k.geojson')))
zf = {f['properties']['ZCTA5CE20']: rings_of(f['geometry']) for f in zj['features'] if f['properties']['ZCTA5CE20'] in zset}
zrings, _, zraw, narc, njun = topo_layer(zf, EPS_Z)
zcta = {}
area_ratio = {}
fallback = []
for k in sorted(zrings):
    rr = clean(zrings[k])
    a = sum(abs(area2(r)) / 2 for r in rr)
    if not rr or a <= 0:
        # collapsed: a 2 x 2 square on the centre of the raw shape
        pts = [proj(*p) for poly in zf[k] for ring in poly for p in ring]
        cx = int(round(sum(p[0] for p in pts) / len(pts)))
        cy = int(round(sum(p[1] for p in pts) / len(pts)))
        rr = [[(cx - 1, cy - 1), (cx + 1, cy - 1), (cx + 1, cy + 1), (cx - 1, cy + 1)]]
        fallback.append(k)
        a = 4
    zcta[k] = path(rr)
    area_ratio[k] = round(a / zraw[k], 3) if zraw[k] > 0 else None
print('zcta', len(zcta), 'arcs', narc, 'junctions', njun, 'bytes', sum(map(len, zcta.values())), 'fallback squares', fallback)
missing = sorted(zset - set(zcta))
print('rows without a shape', missing)

# ---- water (USGS 1:1,000,000 water bodies; lakes and reservoirs of 8 sq km or more, plus the named ones)
wj = json.load(open(os.path.join(G, 'ca_usgs_waterbodies_1m.geojson')))
MUST = {'Lake Tahoe', 'Salton Sea', 'Mono Lake', 'Clear Lake'}
wl = []
for f in wj['features']:
    p = f['properties']
    if p['Feature'] not in ('Lake', 'Reservoir'):
        continue
    sq = p.get('Area_sq_mi') or 0
    if sq * 2.59 < 8 and p['Name'] not in MUST:
        continue
    rr = []
    for poly in rings_of(f['geometry']):
        r = simp_ring(poly[0], EPS_W)       # outer ring only (islands in lakes dropped)
        if len(r) >= 3 and abs(area2(r)) / 2 >= 2:
            rr.append(r)
    if rr:
        wl.append((sq, p['Name'] or '', path(rr)))
wl.sort(key=lambda t: -t[0])
# bays: TIGER area water polygons named as bays, where they lie inside the county shapes
bays = []
try:
    tj = json.load(open(os.path.join(G, 'ca_areawater_tl2025_major.geojson')))
    for f in tj['features']:
        nm = (f['properties'].get('FULLNAME') or '')
        aw = (f['properties'].get('AWATER') or 0) / 1e6
        if aw >= 15 and any(w in nm for w in ('Bay', 'Strait', 'Slough')) and 'Pacific' not in nm:
            rr = []
            for poly in rings_of(f['geometry']):
                r = simp_ring(poly[0], EPS_W)
                if len(r) >= 3 and abs(area2(r)) / 2 >= 4:
                    rr.append(r)
            if rr:
                bays.append((aw / 2.59, nm, path(rr)))
except Exception as e:
    print('bays not read:', e)
bays.sort(key=lambda t: -t[0])
print('lakes', len(wl), [w[1] for w in wl[:12]], 'bays', [(b[1], round(b[0])) for b in bays[:20]])
water = [w[2] for w in bays] + [w[2] for w in wl]
wname = [w[1] for w in bays] + [w[1] for w in wl]

# ---- neighbours
nj = json.load(open(os.path.join(G, 'ca_neighbors_2024_5m.geojson')))
neighbors = {}
# Baja California first, so Arizona and California are drawn over its northern edge (see SCHEMA.md section 6)
baja = [(-117.125, 32.534), (-117.08, MINY), (-114.50, MINY), (-114.50, 32.80), (-114.72, 32.76), (-117.10, 32.56)]
neighbors['Baja California'] = path([[(int(round(x)), int(round(y))) for x, y in (proj(*p) for p in baja)]])
for nm in ('Oregon', 'Nevada', 'Arizona'):
    f = [x for x in nj['features'] if x['properties']['NAME'] == nm][0]
    rr = []
    for poly in rings_of(f['geometry']):
        c = clip_box(poly[0], MINX, MAXX, MINY, MAXY)
        if len(c) >= 3:
            r = simp_ring(c, EPS_N)
            if len(r) >= 3:
                rr.append(r)
    neighbors[nm] = path(rr)
print('neighbors', {k: len(v) for k, v in neighbors.items()})

pcent = {c['fips']: [round(c['lon'], 4), round(c['lat'], 4)] for c in base['counties']}
geo = {'W': W, 'H': H, 'minx': MINX, 'maxy': MAXY, 'kx': KX, 'sx': SX, 'u': 2, 'outline': outline, 'neighbors': neighbors,
       'parish': parish, 'zcta': zcta, 'water': water, 'wname': wname, 'pcent': pcent}
tot = len(json.dumps(geo, separators=(',', ':')))
print('geo bytes', tot, {k: len(json.dumps(v, separators=(',', ':'))) for k, v in geo.items() if k in ('outline', 'neighbors', 'parish', 'zcta', 'water')})
ar = sorted(v for v in area_ratio.values() if v is not None)
print('zcta area kept: min %.3f p5 %.3f median %.3f max %.3f' % (ar[0], ar[len(ar) // 20], ar[len(ar) // 2], ar[-1]))
save('geo.json', {'geo': geo, 'area_ratio': area_ratio, 'fallback': fallback, 'missing': missing,
                  'eps': {'zcta': EPS_Z, 'county': EPS_C, 'water': EPS_W, 'neighbors': EPS_N}})
