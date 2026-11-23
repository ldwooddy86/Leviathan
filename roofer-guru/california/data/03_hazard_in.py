#!/usr/bin/env python3
"""Step 3. Hazard inputs for the roof and line models.
(a) Own count, kept as a cross-check and as the fallback: CAL FIRE damage inspection (DINS) points
    2013 to 2025 placed in ZCTAs by point in polygon -> work/fire_own.json
(b) If the hazard job's out/zcta_hazard.json exists it is read and its columns carried whole;
    its fire losses by year are used in place of (a) when it has them.
Writes work/haz.json: {src, cols, by_zip: {zip: {...}}, fire_year: {zip: {year: [res destroyed, res damaged, all destroyed]}}}
Usage: python3 -I 03_hazard_in.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
import collections, datetime

base = load('base.json')
zset = {d['zip'] for d in base['zips']}
own_p = os.path.join(WORK, 'fire_own.json')
DINS = os.path.join(CA, 'dl', 'hazard', 'calfire', 'dins', 'DINS_POSTFIRE_MASTER_attributes.csv')

if not os.path.exists(own_p):
    zj = json.load(open(os.path.join(DL, 'geo', 'raw', 'ca', 'ca_zcta520_2020_500k.geojson')))
    polys = []      # (zip, bbox, rings)
    CELL = 0.1
    grid = collections.defaultdict(list)
    for f in zj['features']:
        z = f['properties']['ZCTA5CE20']
        g = f['geometry']
        for poly in ([g['coordinates']] if g['type'] == 'Polygon' else g['coordinates']):
            xs = [p[0] for p in poly[0]]
            ys = [p[1] for p in poly[0]]
            bb = (min(xs), min(ys), max(xs), max(ys))
            i = len(polys)
            polys.append((z, bb, poly))
            for gx in range(int(math.floor(bb[0] / CELL)), int(math.floor(bb[2] / CELL)) + 1):
                for gy in range(int(math.floor(bb[1] / CELL)), int(math.floor(bb[3] / CELL)) + 1):
                    grid[(gx, gy)].append(i)

    def inring(x, y, ring):
        c = False
        j = len(ring) - 1
        for i in range(len(ring)):
            xi, yi = ring[i][0], ring[i][1]
            xj, yj = ring[j][0], ring[j][1]
            if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
                c = not c
            j = i
        return c

    def locate(x, y):
        for i in grid.get((int(math.floor(x / CELL)), int(math.floor(y / CELL))), ()):
            z, bb, poly = polys[i]
            if bb[0] <= x <= bb[2] and bb[1] <= y <= bb[3] and inring(x, y, poly[0]) and not any(inring(x, y, h) for h in poly[1:]):
                return z
        return None

    RESID = ('Single Family', 'Single Famliy', 'Multi Family', 'Mobile Home', 'Mixed Commercial/Residential')
    fy = collections.defaultdict(lambda: collections.defaultdict(lambda: [0, 0, 0, 0]))
    names = collections.defaultdict(lambda: collections.defaultdict(collections.Counter))
    tot = collections.Counter()
    with open(DINS, newline='', encoding='utf-8-sig') as f:
        for row in csv.DictReader(f):
            dmg = row['DAMAGE']
            if dmg in ('No Damage', 'Inaccessible', ''):
                continue
            try:
                x, y = float(row['pt_lon']), float(row['pt_lat'])
            except ValueError:
                tot['no point'] += 1
                continue
            yr = row['INCIDENTSTARTDATE_iso'][:4]
            z = locate(x, y)
            if z is None:
                tot['outside every ZCTA'] += 1
                continue
            res = row['STRUCTURETYPE'].startswith(RESID)
            dest = dmg.startswith('Destroyed')
            a = fy[z][yr]
            if dest:
                a[2] += 1
                a[0] += res
            else:
                a[3] += 1
                a[1] += res
            names[z][yr][row['INCIDENTNAME'].strip().title()] += 1
            tot['placed'] += 1
            tot['res destroyed'] += res and dest
            tot['res damaged'] += res and not dest
    out = {'fire_year': {z: {y: v for y, v in d.items()} for z, d in fy.items()},
           'names': {z: {y: c.most_common(1)[0][0] for y, c in d.items()} for z, d in names.items()}, 'totals': dict(tot)}
    save('fire_own.json', out)
own = load('fire_own.json')
print('own DINS count', own['totals'], 'zips', len(own['fire_year']))

haz = {'src': 'stub', 'cols': [], 'by_zip': {}, 'fire_year': own['fire_year'], 'fire_names': own['names'], 'fire_src': 'own DINS point in polygon'}
hz = os.path.join(HAZ, 'zcta_hazard.json')
if os.path.exists(hz):
    h = json.load(open(hz))
    cols = h['cols']
    zi = cols.index('zip') if 'zip' in cols else cols.index('zcta') if 'zcta' in cols else 0
    for r in h['rows']:
        if r[zi] in zset:
            haz['by_zip'][r[zi]] = {c: v for c, v in zip(cols, r)}
    haz['cols'] = [c for i, c in enumerate(cols) if i != zi]
    haz['src'] = 'hazard job'
    haz['hazard_notes'] = h.get('notes')
    print('hazard job columns', len(cols), 'rows matched', len(haz['by_zip']))
else:
    # interim: the hazard job's work tables, read as they stand (replaced by zcta_hazard.json when it exists)
    used = []
    for nm in ('zcta_station', 'zcta_ar', 'zcta_fire', 'zcta_wind', 'zcta_snow_hail', 'zcta_base'):
        p = os.path.join(HERE, 'hazard', 'work', nm + '.json')
        if not os.path.exists(p):
            continue
        try:
            t = json.load(open(p))
        except Exception as e:
            print('could not read', nm, e)
            continue
        used.append(nm)
        for z, v in t.items():
            if z in zset and isinstance(v, dict):
                haz['by_zip'].setdefault(z, {}).update({k: x for k, x in v.items() if not isinstance(x, (list, dict))})
    if used:
        haz['src'] = 'hazard job work tables (interim): ' + ', '.join(used)
        cols = set()
        for v in haz['by_zip'].values():
            cols |= set(v)
        haz['cols'] = sorted(cols)
    print('interim hazard tables', used, len(haz['by_zip']))
save('haz.json', haz)
