#!/usr/bin/env python3
"""Wind: Local Storm Report gust days, zone filed High Wind days, named offshore wind exposure per ZCTA, and the wind
event ledger (Santa Ana, Diablo, sundowner, Mono, winter high wind). Also the county table of zone filed events.
Run: python3 -I 05_wind_events.py"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hazlib import *
import numpy as np, shapely, pickle, collections, datetime, re

Zs = jload(os.path.join(WORK, 'zcta_base.json'))
keys = list(Zs)
zi = ZoneIndex(Zs)
SE = pickle.load(open(os.path.join(WORK, 'se.pkl'), 'rb'))
out = {k: {} for k in keys}
MPH = 1.15078
SOUTH = {'LOX', 'SGX', 'PSR', 'VEF'}

# ---------------- current zone of each ZIP
cur = [i for i, v in enumerate(zi.v) if v['last'] >= '2026' and v['ugc'][2] == 'Z']
zone_of = {}
for i in cur:
    for j in zi.zl[i]:
        zone_of[j] = zi.v[i]['ugc']
miss = [j for j in range(len(keys)) if j not in zone_of]
if miss:
    T = albers()
    cg = [to_albers(zi.v[i]['geom']) for i in cur]
    tr = shapely.STRtree(cg)
    for j in miss:
        x, y = T(Zs[keys[j]]['lon'], Zs[keys[j]]['lat'])
        zone_of[j] = zi.v[cur[int(tr.nearest(shapely.points(x, y)))]]['ugc']
for j, k in enumerate(keys):
    out[k]['zone'] = zone_of[j]
log('ZIPs outside every current zone outline (given the nearest):', len(miss))

# ---------------- Local Storm Reports: measured gusts
L = []
for q in rcsv(os.path.join(H, 'lsr', 'CA_lsr_1996_2026.csv')):
    if 'WND GST' not in q['TYPETEXT'] or q['QUALIFIER'] != 'M':
        continue
    mag = fnum(q['MAG']); la = fnum(q['LAT']); lo = fnum(q['LON'])
    if mag is None or la is None or mag < 40 or mag > 200:
        continue
    try:
        t = datetime.datetime.strptime(q['VALID'], '%Y%m%d%H%M') - datetime.timedelta(hours=8)   # UTC to Pacific Standard Time
    except Exception:
        continue
    L.append({'t': t, 'lat': la, 'lon': lo, 'mph': mag, 'city': q['CITY'].title(), 'county': q['COUNTY'].title(), 'ts': q['TYPETEXT'].startswith('TSTM'), 'wfo': q['WFO']})
log('measured gust reports', len(L), '58+', sum(1 for r in L if r['mph'] >= 58), '75+', sum(1 for r in L if r['mph'] >= 75))
pickle.dump(L, open(os.path.join(WORK, 'lsr_gust.pkl'), 'wb'))
la = np.array([r['lat'] for r in L]); lo = np.array([r['lon'] for r in L]); mp = np.array([r['mph'] for r in L])
dayn = np.array([r['t'].toordinal() for r in L]); yr = np.array([r['t'].year for r in L])
p = math.pi / 180
for j, k in enumerate(keys):
    z = Zs[k]
    a = np.sin((la - z['lat']) * p / 2) ** 2 + math.cos(z['lat'] * p) * np.cos(la * p) * np.sin((lo - z['lon']) * p / 2) ** 2
    d = 12742.0 * np.arcsin(np.sqrt(a))
    m = d <= 40.234
    w = m & (yr >= 2010) & (yr <= 2025)
    out[k]['wd58'] = rnd(len(set(dayn[w & (mp >= 58)].tolist())) / 16.0, 2)
    out[k]['wd75'] = rnd(len(set(dayn[w & (mp >= 75)].tolist())) / 16.0, 2)
    if m.any():
        i = int(np.argmax(np.where(m, mp, -1)))
        out[k]['lsr_max'] = int(round(L[i]['mph'])); out[k]['lsr_max_date'] = L[i]['t'].strftime('%Y-%m-%d'); out[k]['lsr_max_at'] = L[i]['city']
    else:
        out[k]['lsr_max'] = None; out[k]['lsr_max_date'] = None; out[k]['lsr_max_at'] = None

# ---------------- zone filed events 2006-2025: per zone version, then per ZIP
tags = {q['event_id']: q['tags'] for q in rcsv(os.path.join(H, 'santa_ana_diablo', 'stormevents_highwind_rows_tagged.csv'))}


def kind_of(q):
    t = tags.get(q['id'], '')
    for a, b in (('santa_ana', 'santa_ana'), ('diablo', 'diablo'), ('sundowner', 'sundowner'), ('mono_wind', 'mono')):
        if a in t:
            return b
    return 'winter' if q['m'] in (10, 11, 12, 1, 2, 3, 4) else 'other'


hwd = collections.defaultdict(set)                     # zone version -> dates with a High Wind record
ep = collections.defaultdict(lambda: collections.defaultdict(set))   # zone version -> kind -> episodes
zc = collections.defaultdict(collections.Counter)      # county fips -> type -> records (2006-2025)
wrows = []
nomatch = 0
for q in SE:
    if q['czt'] == 'M':
        continue
    v = zi.find(q['czt'], q['czf'], q['czn'], q['b'], wfo=q['wfo'] if q['y'] < 2005 else None)
    q['_v'] = v
    if 2006 <= q['y'] <= 2025:
        if q['czt'] == 'C':
            zc['06%03d' % q['czf']][q['type']] += 1
        elif v is not None and zi.v[v]['counties']:
            zc[max(zi.v[v]['counties'], key=lambda c: c[1])[0]][q['type']] += 1
    if q['type'] in ('High Wind', 'Strong Wind') and q['y'] >= 1996:
        q['_k'] = kind_of(q)
        wrows.append(q)
        if v is None:
            nomatch += 1
        elif 2006 <= q['y'] <= 2025:
            if q['type'] == 'High Wind':
                dd = q['b'].date()
                while dd <= q['e'].date() and (dd - q['b'].date()).days < 10:
                    hwd[v].add(dd.toordinal()); dd += datetime.timedelta(days=1)
            if q['_k'] in ('santa_ana', 'diablo', 'sundowner', 'mono'):
                ep[v][q['_k']].add(q['ep'])
log('wind rows', len(wrows), 'without a zone outline', nomatch, collections.Counter(q['_k'] for q in wrows))
zv_of = collections.defaultdict(list)
for i, l in enumerate(zi.zl):
    for j in l:
        zv_of[j].append(i)
for j, k in enumerate(keys):
    days = set(); e = collections.defaultdict(set)
    for v in zv_of.get(j, []):
        days |= hwd.get(v, set())
        for kk, s in ep.get(v, {}).items():
            e[kk] |= s
    o = out[k]
    o['hw_yr'] = rnd(len(days) / 20.0, 2)
    o['sa_ep'] = len(e['santa_ana']); o['di_ep'] = len(e['diablo']); o['su_ep'] = len(e['sundowner'])
    best = max((('sa', o['sa_ep']), ('di', o['di_ep']), ('su', o['su_ep'])), key=lambda t: t[1])
    o['off_kind'] = best[0] if best[1] > 0 else ''
    n = best[1]
    o['off_cls'] = 0 if n == 0 else 1 if n < 5 else 2 if n < 20 else 3
log('offshore class', collections.Counter((o['off_kind'], o['off_cls']) for o in out.values()))
jdump(out, os.path.join(WORK, 'zcta_wind.json'))

# ---------------- the wind event ledger
cname = {}
for z in Zs.values():
    cname[z['county'].lower()] = z['fips']
groups = collections.defaultdict(list)
for q in wrows:
    groups[(q['_k'], 'S' if q['wfo'] in SOUTH else 'N')].append(q)
events = []
for (kind, belt), rows in groups.items():
    rows.sort(key=lambda q: q['b'])
    cur_ = None
    pad = datetime.timedelta(days=1) if kind in ('santa_ana', 'diablo', 'sundowner', 'mono') else datetime.timedelta(0)
    for q in rows:
        if cur_ is not None and q['b'] <= cur_['e'] + pad and (q['b'] - cur_['b']).days <= 10:
            cur_['rows'].append(q); cur_['e'] = max(cur_['e'], q['e'])
        else:
            cur_ = {'kind': kind, 'belt': belt, 'b': q['b'], 'e': q['e'], 'rows': [q]}
            events.append(cur_)
log('wind events before selection', len(events), collections.Counter(e['kind'] for e in events))
L.sort(key=lambda r: r['t'])
lt = [r['t'] for r in L]
import bisect
led = []
used_v = {}
for e in events:
    rows = e['rows']
    dmg = sum(q['dmg'] for q in rows); deaths = sum(q['dd'] for q in rows)
    named = e['kind'] in ('santa_ana', 'diablo', 'sundowner', 'mono')
    if not (named or dmg >= 250000 or len(rows) >= 12 or deaths >= 1):
        continue
    fips = set(); vs = []
    for q in rows:
        v = q.get('_v')
        if v is not None:
            if v not in vs:
                vs.append(v)
            for c, shp in zi.v[v]['counties']:
                if shp >= 20:
                    fips.add(c)
    g = None
    for q in rows:
        if q['magt'] == 'MG' and q['mag']:
            mph = q['mag'] * MPH
            if g is None or mph > g[0]:
                v = q.get('_v')
                g = (mph, q['czn'].title(), (zi.v[v]['ilat'] or zi.v[v]['clat']) if v is not None else None, (zi.v[v]['ilon'] or zi.v[v]['clon']) if v is not None else None, 'Storm Events')
    n58 = None
    if e['b'].year >= 2004:
        i0 = bisect.bisect_left(lt, e['b'] - datetime.timedelta(hours=6)); i1 = bisect.bisect_right(lt, e['e'] + datetime.timedelta(hours=12))
        n58 = 0
        for r in L[i0:i1]:
            if r['ts'] or cname.get(r['county'].lower()) not in fips:
                continue
            if r['mph'] >= 58:
                n58 += 1
            if g is None or r['mph'] > g[0] + 0.5:
                g = (r['mph'], r['city'], r['lat'], r['lon'], 'Local Storm Report')
    if g is None and not named:
        continue
    zn = []
    for v in vs:
        if v not in used_v:
            used_v[v] = len(used_v)
        zn.append(used_v[v])
    led.append({'id': 'W' + e['b'].strftime('%Y%m%d') + e['kind'][:2] + e['belt'], 'kind': e['kind'], 'start': e['b'].strftime('%Y-%m-%d'), 'end': e['e'].strftime('%Y-%m-%d'),
                'year': e['b'].year, 'month': e['b'].month, 'gust': int(round(g[0])) if g else None, 'where': g[1] if g else None, 'lat': rnd(g[2], 3) if g and g[2] is not None else None,
                'lon': rnd(g[3], 3) if g and g[3] is not None else None, 'gust_src': g[4] if g else None, 'fips': sorted(fips), 'dmg': int(round(dmg)), 'deaths': deaths,
                'n': len(rows), 'n58': n58, 'zn': zn})
led.sort(key=lambda d: d['start'])
zones = [None] * len(used_v)
for v, i in used_v.items():
    zones[i] = {'i': i, 'ugc': zi.v[v]['ugc'], 'name': zi.v[v]['name'], 'zips': [keys[j] for j in zi.zl[v]]}
log('ledger wind events', len(led), collections.Counter(d['kind'] for d in led), 'zones', len(zones))
for d in sorted(led, key=lambda d: -(d['gust'] or 0))[:6] + sorted(led, key=lambda d: -d['dmg'])[:6]:
    print({k: d[k] for k in ('id', 'kind', 'start', 'end', 'gust', 'where', 'dmg', 'n', 'n58')})
jdump({'wind': led, 'zones': zones, 'zone_county': {f: dict(c) for f, c in sorted(zc.items())}}, os.path.join(WORK, 'wind_events.json'))
for k in ('91502', '92676', '90272', '94558', '93108', '95969', '92328'):
    print(k, out[k])
