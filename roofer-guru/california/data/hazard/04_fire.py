#!/usr/bin/env python3
"""Wildfire: Fire Hazard Severity Zone shares, CAL FIRE damage inspections and fire perimeters per ZCTA, and the fire ledger.
Run: python3 -I 04_fire.py"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hazlib import *
import numpy as np, shapely, collections, re, datetime
from shapely.geometry import shape

T = albers()
ACRE = 4046.8564224
LEDGER_ACRES = 5000        # CAL FIRE's own "recent large fire" layer uses 5,000 acres
TOUCH_M2 = ACRE            # a perimeter "touches" a ZCTA when at least one acre of it lies inside
COUNT_ACRES = 10           # per ZCTA fire counts use perimeters of 10 acres or more (agencies' minimum sizes differ below that)


def alb(g):
    return shapely.transform(g, lambda c: np.column_stack(T(c[:, 0], c[:, 1])))


def read_nd(path):
    with gzip.open(path, 'rt') as f:
        for ln in f:
            if ln.strip():
                yield json.loads(ln)


def geoms_of(path, keep=None):
    gs, props = [], []
    for ft in read_nd(path):
        if not ft.get('geometry'):
            continue
        p = ft['properties']
        if keep and not keep(p):
            continue
        gs.append(shape(ft['geometry'])); props.append(p)
    ga = alb(np.array(gs, dtype=object))
    bad = ~shapely.is_valid(ga)
    if bad.any():
        ga[bad] = shapely.make_valid(ga[bad])
    return ga, props


def nm(s):
    return re.sub(r'[^a-z0-9]+', ' ', (s or '').lower()).strip()


Zs = load_zctas()
keys = list(Zs)
ZG = alb(np.array([Zs[k]['geom'] for k in keys], dtype=object))
ZG = shapely.make_valid(ZG)
ZA = shapely.area(ZG)
ztree = shapely.STRtree(ZG)
out = {k: {} for k in keys}
log('zctas', len(keys))

# ---------------- (a) Fire Hazard Severity Zones: share of ZCTA area
sh = np.zeros((len(keys), 4))  # moderate, high, very high, non wildland (LRA only)
resp = np.zeros((len(keys), 2))  # SRA area, LRA area (zoned)
for path, kind in ((os.path.join(H, 'calfire', 'fhsz', 'FHSZ_SRA_23_3_effective_2024-04-01.ndjson.gz'), 0), (os.path.join(H, 'calfire', 'fhsz', 'FHSZ_LRA25_v1_All.ndjson.gz'), 1)):
    ga, props = geoms_of(path)
    cls = np.array([{'moderate': 0, 'high': 1, 'very high': 2, 'nonwildland': 3, 'non-wildland': 3}.get((p.get('FHSZ_Description') or '').lower().strip(), -1) for p in props])
    log(os.path.basename(path), len(ga), collections.Counter(cls.tolist()))
    a, b = ztree.query(ga, predicate='intersects')
    ar = shapely.area(shapely.intersection(ga[a], ZG[b]))
    for i, j, x in zip(a, b, ar):
        c = cls[i]
        if c >= 0:
            sh[j, c] += x
            if c < 3:
                resp[j, kind] += x
for j, k in enumerate(keys):
    o = out[k]
    m, h, v = (min(100.0, 100 * sh[j, c] / ZA[j]) for c in (0, 1, 2))
    o['fhsz_mod'] = rnd(m, 1); o['fhsz_high'] = rnd(h, 1); o['fhsz_vh'] = rnd(v, 1); o['fhsz_any'] = rnd(min(100.0, m + h + v), 1)
    o['fhsz_resp'] = '' if resp[j].sum() < 1 else 'SRA' if resp[j, 1] < 0.05 * resp[j].sum() else 'LRA' if resp[j, 0] < 0.05 * resp[j].sum() else 'mixed'
log('FHSZ done; ZCTAs with any zone', sum(1 for k in keys if out[k]['fhsz_any'] > 0))

# ---------------- (b) perimeters since 2000
dom = jload(os.path.join(H, 'calfire', 'perimeters', 'CA_fire_perimeters_coded_domains.json'))


def yr(p):
    try:
        return int(float(p.get('YEAR_')))
    except Exception:
        return None


PG, PP = geoms_of(os.path.join(H, 'calfire', 'perimeters', 'CA_fire_perimeters_all_fullres.ndjson.gz'), keep=lambda p: (yr(p) or 0) >= 2000 and p.get('STATE') == 'CA')
PA = shapely.area(PG) / ACRE
PY = np.array([yr(p) for p in PP])
log('perimeters 2000 on', len(PG), 'acres', int(PA.sum()))


def iso(ms):
    if ms in (None, ''):
        return None
    try:
        d = datetime.datetime(1970, 1, 1) + datetime.timedelta(milliseconds=float(ms))
        return d.strftime('%Y-%m-%d') if 1999 <= d.year <= 2026 else None
    except Exception:
        return None


def pname(p):
    n = (p.get('FIRE_NAME') or '').strip()
    return n.title() if n else 'Unnamed'


a, b = ztree.query(PG, predicate='intersects')
ia = shapely.intersection(PG[a], ZG[b])
iarea = shapely.area(ia)
zf = collections.defaultdict(list)   # zcta index -> [(perimeter index, overlap m2, geom)]
for i, j, x, g in zip(a, b, iarea, ia):
    if x >= TOUCH_M2:
        zf[int(j)].append((int(i), float(x), g))
for j, k in enumerate(keys):
    o = out[k]
    L = [t for t in zf.get(j, []) if PA[t[0]] >= COUNT_ACRES]
    o['fire_n'] = len(L)
    if L:
        big = max(L, key=lambda t: PA[t[0]]); last = max(L, key=lambda t: (PY[t[0]], PA[t[0]]))
        o['fire_big'] = pname(PP[big[0]]); o['fire_big_yr'] = int(PY[big[0]]); o['fire_big_ac'] = int(round(PA[big[0]]))
        o['fire_last'] = pname(PP[last[0]]); o['fire_last_yr'] = int(PY[last[0]]); o['fire_since'] = 2026 - int(PY[last[0]])
        u = shapely.union_all(np.array([t[2] for t in L], dtype=object))
        o['burn_sh'] = rnd(min(100.0, 100 * u.area / ZA[j]), 1)
    else:
        o.update({'fire_big': None, 'fire_big_yr': None, 'fire_big_ac': None, 'fire_last': None, 'fire_last_yr': None, 'fire_since': None, 'burn_sh': 0.0})
log('perimeter overlay done; ZCTAs touched', sum(1 for k in keys if out[k]['fire_n']))

# ---------------- (c) damage inspections (DINS)
pts, D = [], []
DC = {'Destroyed (>50%)': 0, 'Major (25-50%)': 1, 'Minor (10-25%)': 1, 'Affected (>0-10%)': 1, 'Affected (1-9%)': 1, 'No Damage': 2, 'Inaccessible': 3}
for ft in read_nd(os.path.join(H, 'calfire', 'dins', 'DINS_POSTFIRE_MASTER.ndjson.gz')):
    p = ft['properties']; c = (ft.get('geometry') or {}).get('coordinates')
    if not c:
        continue
    ms = p.get('INCIDENTSTARTDATE')
    y = (datetime.datetime(1970, 1, 1) + datetime.timedelta(milliseconds=ms)).year if ms else None
    D.append({'dc': DC.get(p.get('DAMAGE'), 3), 'name': (p.get('INCIDENTNAME') or '').strip(), 'y': y, 'lon': c[0], 'lat': c[1], 'start': iso(ms)})
    pts.append((c[0], c[1]))
xy = np.array(pts)
X, Y = T(xy[:, 0], xy[:, 1])
DP = shapely.points(X, Y)
log('DINS points', len(D), collections.Counter(d['dc'] for d in D))
# ZCTA of each point
pi, zi_ = ztree.query(DP, predicate='within')
dz = np.full(len(D), -1)
dz[pi] = zi_
miss = np.where(dz < 0)[0]
if len(miss):
    nn = ztree.nearest(DP[miss])
    dd = shapely.distance(DP[miss], ZG[nn])
    dz[miss[dd < 500]] = nn[dd < 500]
log('DINS points with no ZCTA', int((dz < 0).sum()))
# perimeter of each point: same year (or the year after or before), within 1 km; prefer a name match, then the nearest
ptree = shapely.STRtree(PG)
qa, qb = ptree.query(DP, predicate='dwithin', distance=1000.0)
qd = shapely.distance(DP[qa], PG[qb])
best = {}
for i, j, d in zip(qa.tolist(), qb.tolist(), qd.tolist()):
    y = D[i]['y']
    if y is None or abs(int(PY[j]) - y) > 1:
        continue
    n1 = nm(D[i]['name']); n2 = nm(PP[j].get('FIRE_NAME')); n3 = nm(PP[j].get('COMPLEX_NAME'))
    match = 1 if n1 and (n1 == n2 or n1 in n2 or n2 in n1 or (n3 and (n1 in n3 or n3 in n1))) else 0
    sc = (match, int(PY[j]) == y, -d)
    if i not in best or sc > best[i][0]:
        best[i] = (sc, j)
dper = np.full(len(D), -1)
for i, (sc, j) in best.items():
    # without a name match accept only points inside or within 150 m (the inspection rule is 300 ft)
    if sc[0] or -sc[2] <= 150:
        dper[i] = j
log('DINS points tied to a perimeter', int((dper >= 0).sum()), 'of', len(D))

# per ZCTA totals and by year
zy = collections.defaultdict(lambda: collections.defaultdict(lambda: [0, 0, 0]))
zinc = collections.defaultdict(lambda: collections.defaultdict(lambda: [0, 0]))
for i, d in enumerate(D):
    if dz[i] < 0 or d['y'] is None:
        continue
    k = keys[dz[i]]
    c = d['dc']
    if c <= 2:
        zy[k][d['y']][c] += 1
    if c <= 1:
        zinc[k][(d['name'], d['y'])][c] += 1
for k in keys:
    o = out[k]
    yy = zy.get(k, {})
    o['dins_dest'] = sum(v[0] for v in yy.values()); o['dins_dmg'] = sum(v[1] for v in yy.values())
    o['dins_nodmg'] = sum(v[2] for y, v in yy.items() if y >= 2018)
    o['dins_years'] = {str(y): [v[0], v[1]] for y, v in sorted(yy.items()) if v[0] or v[1]}
    inc = zinc.get(k, {})
    if inc:
        (n, y), v = max(inc.items(), key=lambda t: (t[1][0], t[1][1]))
        o['dins_worst'] = n.title(); o['dins_worst_yr'] = y; o['dins_worst_dest'] = v[0]
    else:
        o['dins_worst'] = None; o['dins_worst_yr'] = None; o['dins_worst_dest'] = None

# ---------------- (d) the fire ledger
fd = collections.defaultdict(lambda: [0, 0, 0])              # perimeter -> destroyed, damaged, no damage
fz = collections.defaultdict(lambda: collections.defaultdict(lambda: [0, 0]))   # perimeter -> zcta -> destroyed, damaged
fdn = collections.defaultdict(collections.Counter)
orphan = collections.defaultdict(lambda: {'n': [0, 0, 0], 'lat': [], 'lon': [], 'z': collections.defaultdict(lambda: [0, 0]), 'start': None})
for i, d in enumerate(D):
    c = d['dc']
    if c > 2:
        continue
    j = int(dper[i])
    if j >= 0:
        fd[j][c] += 1; fdn[j][d['name']] += 1
        if c <= 1 and dz[i] >= 0:
            fz[j][keys[dz[i]]][c] += 1
    else:
        o = orphan[(d['name'], d['y'])]
        o['n'][c] += 1; o['start'] = o['start'] or d['start']
        if c <= 1:
            o['lat'].append(d['lat']); o['lon'].append(d['lon'])
            if dz[i] >= 0:
                o['z'][keys[dz[i]]][c] += 1
sel = [j for j in range(len(PG)) if PA[j] >= LEDGER_ACRES or (fd[j][0] + fd[j][1]) > 0]
log('ledger perimeters', len(sel), '(by size', int((PA >= LEDGER_ACRES).sum()), ', with inspected damage', sum(1 for j in fd if fd[j][0] + fd[j][1] > 0), ')')
inv = shapely.transform  # back to lon/lat for the stored rings
from pyproj import Transformer
TI = Transformer.from_crs('EPSG:3310', 'EPSG:4326', always_xy=True).transform


def rings_of(g, acres):
    tol = max(40.0, math.sqrt(acres * ACRE) / 45.0)
    s = g.simplify(tol, preserve_topology=True)
    if s.is_empty:
        s = g.convex_hull
    parts = [p for p in (s.geoms if hasattr(s, 'geoms') else [s]) if p.geom_type == 'Polygon' and not p.is_empty]
    if not parts:
        parts = [g.convex_hull]
    tot = sum(p.area for p in parts)
    parts = sorted(parts, key=lambda p: -p.area)
    keep = [p for p in parts if p.area >= 0.02 * tot][:12] or parts[:1]
    out_ = []
    for p in keep:
        xs, ys = p.exterior.coords.xy
        lo, la = TI(np.array(xs), np.array(ys))
        out_.append([[round(float(x), 4), round(float(y), 4)] for x, y in zip(lo, la)])
    return out_


zsel = collections.defaultdict(dict)
for j_, L in zf.items():
    for (i, x, g) in L:
        zsel[i][keys[j_]] = x
fires = []
for j in sorted(sel, key=lambda j: (PY[j], PP[j].get('ALARM_DATE') or 0)):
    p = PP[j]
    c = PG[j].centroid
    lo, la = TI(c.x, c.y)
    has_dins = int(PY[j]) >= 2013
    d = fd.get(j)
    zl = []
    for k, x in zsel.get(j, {}).items():
        v = fz[j].get(k, [0, 0]) if j in fz else [0, 0]
        zl.append([k, rnd(min(100.0, 100 * x / ZA[keys.index(k)]), 1), v[0], v[1]])
    for k, v in (fz.get(j) or {}).items():   # structures inspected just outside the perimeter, in a ZCTA it does not touch
        if k not in zsel.get(j, {}):
            zl.append([k, 0.0, v[0], v[1]])
    zl.sort(key=lambda t: (-t[2], -t[1]))
    cause = p.get('CAUSE')
    fires.append({'id': 'F%d_%d' % (int(PY[j]), p.get('OBJECTID')), 'kind': 'fire', 'name': pname(p), 'year': int(PY[j]), 'start': iso(p.get('ALARM_DATE')), 'cont': iso(p.get('CONT_DATE')),
                  'month': (int(iso(p.get('ALARM_DATE'))[5:7]) if iso(p.get('ALARM_DATE')) else None), 'acres': int(round(PA[j])), 'gis_acres': rnd(fnum(p.get('GIS_ACRES')), 0),
                  'destroyed': (d[0] if d else 0) if has_dins else None, 'damaged': (d[1] if d else 0) if has_dins else None, 'nodamage': (d[2] if d else 0) if int(PY[j]) >= 2018 else None,
                  'dins': [n for n, c_ in fdn[j].most_common(3)] if j in fdn else [],
                  'dins_note': None if has_dins else 'before the digital damage inspection records (2013)',
                  'cause': dom['CAUSE'].get(str(cause)) if cause is not None else None, 'agency': p.get('AGENCY'), 'unit': p.get('UNIT_ID'),
                  'complex': (p.get('COMPLEX_NAME') or '').title() or None, 'lat': round(la, 4), 'lon': round(lo, 4), 'ring': rings_of(PG[j], PA[j]), 'z': zl})
# incidents with inspected damage and no perimeter in the FRAP set
for (n, y), o in sorted(orphan.items(), key=lambda t: (t[0][1] or 0, t[0][0])):
    if o['n'][0] + o['n'][1] == 0:
        continue
    fires.append({'id': 'D%s_%s' % (y, re.sub(r'[^A-Za-z0-9]+', '', n)[:14]), 'kind': 'fire', 'name': n.title(), 'year': y, 'start': o['start'], 'cont': None, 'month': int(o['start'][5:7]) if o['start'] else None,
                  'acres': None, 'gis_acres': None, 'destroyed': o['n'][0], 'damaged': o['n'][1], 'nodamage': o['n'][2] if (y or 0) >= 2018 else None, 'dins': [n],
                  'dins_note': 'no perimeter matched in the FRAP set: placed at the mean of the inspected structures', 'cause': None, 'agency': None, 'unit': None, 'complex': None,
                  'lat': round(float(np.mean(o['lat'])), 4), 'lon': round(float(np.mean(o['lon'])), 4), 'ring': None,
                  'z': sorted([[k, 0.0, v[0], v[1]] for k, v in o['z'].items()], key=lambda t: -t[2])})
log('ledger fires', len(fires), 'without perimeter', sum(1 for f in fires if f['ring'] is None), 'ring vertices', sum(len(r) for f in fires if f['ring'] for r in f['ring']))
tot_d = sum(f['destroyed'] or 0 for f in fires); tot_m = sum(f['damaged'] or 0 for f in fires)
log('ledger destroyed', tot_d, 'damaged', tot_m, '| DINS file destroyed', sum(1 for d in D if d['dc'] == 0), 'damaged', sum(1 for d in D if d['dc'] == 1))

jdump({k: v for k, v in out.items()}, os.path.join(WORK, 'zcta_fire.json'))
jdump({'fires': fires, 'by_year': {str(y): [sum(1 for d in D if d['y'] == y and d['dc'] == 0), sum(1 for d in D if d['y'] == y and d['dc'] == 1)] for y in range(2013, 2026)},
       'perims_by_year': {str(y): [int((PY == y).sum()), int(round(PA[PY == y].sum())), int(((PY == y) & (PA >= 1000)).sum())] for y in range(2000, 2026)},
       'perims_by_month': [int(sum(1 for p in PP if iso(p.get('ALARM_DATE')) and int(iso(p.get('ALARM_DATE'))[5:7]) == m)) for m in range(1, 13)],
       'acres_by_month': [int(round(sum(PA[i] for i, p in enumerate(PP) if iso(p.get('ALARM_DATE')) and int(iso(p.get('ALARM_DATE'))[5:7]) == m))) for m in range(1, 13)],
       'dins_by_month': [[sum(1 for d in D if d['start'] and int(d['start'][5:7]) == m and d['dc'] == c) for c in (0, 1)] for m in range(1, 13)]},
      os.path.join(WORK, 'fires.json'))
for zc in ('95969', '90272', '91001', '95403', '95404', '94102', '96161'):
    o = out[zc]
    print(zc, {k: v for k, v in o.items()})
for f in sorted(fires, key=lambda f: -(f['destroyed'] or 0))[:10]:
    print(f['name'], f['year'], f['acres'], f['destroyed'], f['damaged'], f['start'], f['cause'], f['dins'], len(f['z']), sum(len(r) for r in f['ring']) if f['ring'] else None)
