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
LEDGER_ACRES = 1000        # the ledger keeps every perimeter of 1,000 acres or more since 2000 (module 02's request)
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
    for i in np.where(~shapely.is_valid(ga))[0]:
        try:
            ga[i] = shapely.make_valid(ga[i])
        except Exception:
            ga[i] = ga[i].buffer(0)
        if ga[i].geom_type == 'GeometryCollection':
            ga[i] = shapely.union_all([x for x in ga[i].geoms if x.geom_type in ('Polygon', 'MultiPolygon')])
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
FC = os.path.join(WORK, 'fhsz_shares.npz')
if os.path.exists(FC):
    _c = np.load(FC); sh, resp = _c['sh'], _c['resp']
else:
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
    np.savez(FC, sh=sh, resp=resp)
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
RESID = ('Single Family', 'Single Famliy', 'Multi Family', 'Mobile Home', 'Mixed Commercial/Residential')   # same list as CA/data/03_hazard_in.py
for ft in read_nd(os.path.join(H, 'calfire', 'dins', 'DINS_POSTFIRE_MASTER.ndjson.gz')):
    p = ft['properties']; c = (ft.get('geometry') or {}).get('coordinates')
    if not c:
        continue
    ms = p.get('INCIDENTSTARTDATE')
    y = (datetime.datetime(1970, 1, 1) + datetime.timedelta(milliseconds=ms)).year if ms else None
    D.append({'dc': DC.get(p.get('DAMAGE'), 3), 'name': (p.get('INCIDENTNAME') or '').strip(), 'y': y, 'lon': c[0], 'lat': c[1], 'start': iso(ms),
              'res': (p.get('STRUCTURETYPE') or '').startswith(RESID)})
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

# per ZCTA totals and by year: [residences destroyed, residences damaged, all destroyed, all damaged]
zy = collections.defaultdict(lambda: collections.defaultdict(lambda: [0, 0, 0, 0]))
zins = collections.Counter()
zinc = collections.defaultdict(lambda: collections.defaultdict(lambda: [0, 0]))
for i, d in enumerate(D):
    if dz[i] < 0 or d['y'] is None:
        continue
    k = keys[dz[i]]
    c = d['dc']
    if d['y'] >= 2018 and c <= 2:
        zins[k] += 1
    if c <= 1:
        zy[k][d['y']][2 + c] += 1
        if d['res']:
            zy[k][d['y']][c] += 1
        zinc[k][(d['name'], d['y'])][c] += 1
for k in keys:
    o = out[k]
    yy = zy.get(k, {})
    o['fire_dest'] = sum(v[2] for v in yy.values()); o['fire_dmg'] = sum(v[3] for v in yy.values())
    o['fire_dest_res'] = sum(v[0] for v in yy.values()); o['fire_dmg_res'] = sum(v[1] for v in yy.values())
    o['fire_insp'] = zins.get(k, 0)
    o['lastfire'] = max(yy) if yy else None
    o['yrsfire'] = (2026 - max(yy)) if yy else None
    o['fire_years'] = {str(y): v for y, v in sorted(yy.items())}
    inc = zinc.get(k, {})
    if inc:
        (n, y), v = max(inc.items(), key=lambda t: (t[1][0], t[1][1]))
        o['fire_worst'] = n.title(); o['fire_worst_yr'] = y; o['fire_worst_dest'] = v[0]
    else:
        o['fire_worst'] = None; o['fire_worst_yr'] = None; o['fire_worst_dest'] = None

# km from the ZIP's town point to the nearest perimeter of 10 acres or more since 2000 (0 when inside one)
ZB = jload(os.path.join(WORK, 'zcta_base.json'))
tx, ty = T(np.array([ZB[k]['lon'] for k in keys]), np.array([ZB[k]['lat'] for k in keys]))
ZP = shapely.points(tx, ty)
big10 = np.where(PA >= COUNT_ACRES)[0]
t10 = shapely.STRtree(PG[big10])
nn = t10.nearest(ZP)
dkm = shapely.distance(ZP, PG[big10][nn]) / 1000.0
for j, k in enumerate(keys):
    out[k]['fire_km'] = rnd(float(dkm[j]), 1)
    out[k]['fire_near'] = pname(PP[big10[nn[j]]]); out[k]['fire_near_yr'] = int(PY[big10[nn[j]]])

# ---------------- (d) the fire ledger
fd = collections.defaultdict(lambda: [0, 0, 0, 0])              # perimeter -> destroyed, damaged, no damage, residences destroyed
fz = collections.defaultdict(lambda: collections.defaultdict(lambda: [0, 0]))   # perimeter -> zcta -> destroyed, damaged
fdn = collections.defaultdict(collections.Counter)
orphan = collections.defaultdict(lambda: {'n': [0, 0, 0, 0], 'lat': [], 'lon': [], 'z': collections.defaultdict(lambda: [0, 0]), 'start': None})
for i, d in enumerate(D):
    c = d['dc']
    if c > 2:
        continue
    j = int(dper[i])
    if j >= 0:
        fd[j][c] += 1; fdn[j][d['name']] += 1
        if c == 0 and d['res']:
            fd[j][3] += 1
        if c <= 1 and dz[i] >= 0:
            fz[j][keys[dz[i]]][c] += 1
    else:
        o = orphan[(d['name'], d['y'])]
        o['n'][c] += 1; o['start'] = o['start'] or d['start']
        if c == 0 and d['res']:
            o['n'][3] += 1
        if c <= 1:
            o['lat'].append(d['lat']); o['lon'].append(d['lon'])
            if dz[i] >= 0:
                o['z'][keys[dz[i]]][c] += 1
sel = [j for j in range(len(PG)) if PA[j] >= LEDGER_ACRES or (fd[j][0] + fd[j][1]) > 0]
log('ledger perimeters', len(sel), '(by size', int((PA >= LEDGER_ACRES).sum()), ', with inspected damage', sum(1 for j in fd if fd[j][0] + fd[j][1] > 0), ')')
from pyproj import Transformer
TI = Transformer.from_crs('EPSG:3310', 'EPSG:4326', always_xy=True).transform
GEOC = load_geo()


def rings_of(g, acres, k):
    """Simplified outer rings in lon/lat. Tolerance grows with the fire's size (about sqrt(area) / k), never under 60 m;
    holes are dropped; parts under 2 percent of the fire's area are dropped (at most 8 parts kept)."""
    tol = max(60.0, math.sqrt(acres * ACRE) / k)
    s_ = g.simplify(tol, preserve_topology=True)
    if s_.is_empty:
        s_ = g.convex_hull
    parts = [p for p in (s_.geoms if hasattr(s_, 'geoms') else [s_]) if p.geom_type == 'Polygon' and not p.is_empty]
    if not parts:
        parts = [g.convex_hull]
    tot = sum(p.area for p in parts)
    parts = sorted(parts, key=lambda p: -p.area)
    keep = [p for p in parts if p.area >= 0.02 * tot][:8] or parts[:1]
    out_ = []
    for p in keep:
        xs, ys = p.exterior.coords.xy
        lo, la = TI(np.array(xs), np.array(ys))
        out_.append([[round(float(x), 4), round(float(y), 4)] for x, y in zip(lo, la)])
    return out_


# choose the simplification so that all outlines together stay under about 480 KB as atlas paths
for kk in (40.0, 32.0, 26.0, 21.0, 17.0, 14.0, 11.0, 9.0):
    RINGS = {j: rings_of(PG[j], PA[j], kk) for j in sel}
    PATHS = {j: encode_path(RINGS[j], GEOC) for j in sel}
    size = sum(len(v) for v in PATHS.values())
    log('outline detail k', kk, 'path bytes', size, 'vertices', sum(len(r) for v in RINGS.values() for r in v))
    if size <= 480000:
        break
KSIMP = kk

zsel = collections.defaultdict(dict)
for j_, L in zf.items():
    for (i, x, g) in L:
        zsel[i][j_] = x
# ZIP points within 25 km of each ledger perimeter
stree = shapely.STRtree(PG[np.array(sel)])
na, nb = stree.query(ZP, predicate='dwithin', distance=25000.0)
nd = shapely.distance(ZP[na], PG[np.array(sel)][nb]) / 1000.0
near = collections.defaultdict(dict)
for zi_, si, d in zip(na.tolist(), nb.tolist(), nd.tolist()):
    near[sel[si]][zi_] = d
kidx = {k: i for i, k in enumerate(keys)}
fires = []
zfire = collections.defaultdict(list)
rings_out = {}
for j in sorted(sel, key=lambda j: (PY[j], PP[j].get('ALARM_DATE') or 0)):
    p = PP[j]
    c = PG[j].representative_point()
    lo, la = TI(c.x, c.y)
    has_dins = int(PY[j]) >= 2013
    d = fd.get(j) or [0, 0, 0, 0]
    major = d[0] >= 100 or PA[j] >= 50000
    fi = len(fires)
    zl = {}
    for zi_, x in zsel.get(j, {}).items():
        zl[zi_] = [0, 0, 0.0, rnd(min(100.0, 100 * x / ZA[zi_]), 1)]
    for k, v in (fz.get(j) or {}).items():
        e = zl.setdefault(kidx[k], [0, 0, None, 0.0]); e[0], e[1] = v[0], v[1]
    for zi_, dk in near.get(j, {}).items():
        if zi_ in zl:
            zl[zi_][2] = rnd(dk, 1)
        elif dk <= 10 or major:
            zl[zi_] = [0, 0, rnd(dk, 1), 0.0]
    fipset = set()
    for zi_, e in zl.items():
        if e[2] is None:
            e[2] = rnd(float(shapely.distance(ZP[zi_], PG[j])) / 1000.0, 1)
        zfire[keys[zi_]].append([fi] + e)
        if e[3] > 0 or e[0] or e[1]:
            fipset.add(Zs[keys[zi_]]['fips'])
    cause = p.get('CAUSE')
    st = iso(p.get('ALARM_DATE'))
    fid = 'F%d_%d' % (int(PY[j]), p.get('OBJECTID'))
    fires.append({'id': fid, 'name': pname(p), 'year': int(PY[j]), 'start': st, 'cont': iso(p.get('CONT_DATE')), 'month': int(st[5:7]) if st else None,
                  'acres': int(round(PA[j])), 'dest': d[0] if has_dins else None, 'dmg': d[1] if has_dins else None, 'dest_res': d[3] if has_dins else None,
                  'insp': (d[0] + d[1] + d[2]) if int(PY[j]) >= 2018 else None, 'dins': [n for n, c_ in fdn[j].most_common(3)] if j in fdn else [],
                  'note': None if has_dins else 'before the digital damage inspection records (2013): structure counts not known here',
                  'cause': dom['CAUSE'].get(str(cause)) if cause is not None else None, 'agency': p.get('AGENCY'), 'complex': (p.get('COMPLEX_NAME') or '').title() or None,
                  'fips': sorted(fipset), 'lat': round(la, 4), 'lon': round(lo, 4), 'd': PATHS[j]})
    rings_out[fid] = RINGS[j]
# incidents with inspected damage and no perimeter in the FRAP set
for (n, y), o in sorted(orphan.items(), key=lambda t: (t[0][1] or 0, t[0][0])):
    if o['n'][0] + o['n'][1] == 0:
        continue
    fi = len(fires)
    fipset = set()
    for k, v in o['z'].items():
        mla, mlo = float(np.mean(o['lat'])), float(np.mean(o['lon']))
        zfire[k].append([fi, v[0], v[1], rnd(hav_km(ZB[k]['lat'], ZB[k]['lon'], mla, mlo), 1), 0.0]); fipset.add(Zs[k]['fips'])
    fires.append({'id': 'D%s_%s' % (y, re.sub(r'[^A-Za-z0-9]+', '', n)[:14]), 'name': n.title(), 'year': y, 'start': o['start'], 'cont': None, 'month': int(o['start'][5:7]) if o['start'] else None,
                  'acres': None, 'dest': o['n'][0], 'dmg': o['n'][1], 'dest_res': o['n'][3], 'insp': (o['n'][0] + o['n'][1] + o['n'][2]) if (y or 0) >= 2018 else None, 'dins': [n],
                  'note': 'no perimeter matched in the FRAP set: placed at the mean of the inspected structures; the km in zfire is to that point', 'cause': None, 'agency': None, 'complex': None,
                  'fips': sorted(fipset), 'lat': round(float(np.mean(o['lat'])), 4), 'lon': round(float(np.mean(o['lon'])), 4), 'd': None})
log('ledger fires', len(fires), 'without perimeter', sum(1 for f in fires if f['d'] is None), 'zfire pairs', sum(len(v) for v in zfire.values()))
tot_d = sum(f['dest'] or 0 for f in fires); tot_m = sum(f['dmg'] or 0 for f in fires)
log('ledger destroyed', tot_d, 'damaged', tot_m, '| DINS file destroyed', sum(1 for d in D if d['dc'] == 0), 'damaged', sum(1 for d in D if d['dc'] == 1))

jdump(out, os.path.join(WORK, 'zcta_fire.json'))
mon = lambda p: int(iso(p.get('ALARM_DATE'))[5:7]) if iso(p.get('ALARM_DATE')) else None
PM = np.array([mon(p) or 0 for p in PP])
jdump({'fires': fires, 'zfire': zfire, 'ksimp': KSIMP, 'geo': GEOC,
       'dins_by_year': {str(y): [sum(1 for d in D if d['y'] == y and d['dc'] == 0), sum(1 for d in D if d['y'] == y and d['dc'] == 1), sum(1 for d in D if d['y'] == y and d['dc'] == 0 and d['res'])] for y in range(2013, 2026)},
       'dins_by_month': [[sum(1 for d in D if d['start'] and int(d['start'][5:7]) == m and d['dc'] == c) for c in (0, 1)] for m in range(1, 13)],
       'perims_by_year': {str(y): [int((PY == y).sum()), int(round(PA[PY == y].sum())), int(((PY == y) & (PA >= 1000)).sum())] for y in range(2000, 2026)},
       'perims_by_month': [int((PM == m).sum()) for m in range(1, 13)], 'acres_by_month': [int(round(PA[PM == m].sum())) for m in range(1, 13)],
       'fhsz_state_km2': {'moderate': rnd(sh[:, 0].sum() / 1e6, 0), 'high': rnd(sh[:, 1].sum() / 1e6, 0), 'very_high': rnd(sh[:, 2].sum() / 1e6, 0), 'zcta_total': rnd(ZA.sum() / 1e6, 0)}},
      os.path.join(WORK, 'fires.json'))
jdump(rings_out, os.path.join(OUT, 'fire_rings.json'))
for zc in ('95969', '90272', '91001', '95403', '95404', '96150'):
    o = out[zc]
    print(zc, {k: v for k, v in o.items() if k != 'fire_years'}, [(fires[e[0]]['name'], fires[e[0]]['year'], e[1:]) for e in sorted(zfire[zc], key=lambda e: -e[1])[:3]])
for f in sorted(fires, key=lambda f: -(f['dest'] or 0))[:10]:
    print(f['name'], f['year'], f['acres'], f['dest'], f['dmg'], f['dest_res'], f['start'], f['cause'], f['dins'], f['fips'], len(f['d'] or ''))
