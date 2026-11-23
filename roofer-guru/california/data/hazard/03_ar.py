#!/usr/bin/env python3
"""Atmospheric rivers: per ZCTA exposure columns and the landfall event ledger.
Source: CW3E U.S. West Coast AR Landfall Catalog (ERA5), the 20 California coast points 32.5N to 42.0N, water years
1960 to 2025; Storm Events and FEMA declarations are tied to the strongest landfalls by date and latitude.
Run: python3 -I 03_ar.py"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hazlib import *
import datetime, pickle, collections

WY0, WY1 = 1960, 2025
NY = WY1 - WY0 + 1
LATS = [32.5 + 0.5 * i for i in range(20)]
# my labels for the coast points (nearest landmark to each catalogue point; not CW3E's names)
PTNAME = ['San Diego and the border', 'Oceanside', 'Dana Point', 'Santa Monica Bay', 'Santa Barbara', 'Point Sal', 'Morro Bay and Cambria', 'Big Sur', 'Monterey',
          'Santa Cruz', 'Half Moon Bay and San Francisco', 'Point Reyes', 'Sonoma coast', 'Point Arena', 'Fort Bragg', 'Shelter Cove', 'Cape Mendocino and Eureka',
          'Trinidad', 'Klamath', 'Crescent City and the Oregon line']


def ts(s):
    s = str(s)
    return datetime.datetime(int(s[:4]), int(s[4:6]), int(s[6:8]), int(s[8:10]))


def wy(d):
    return d.year + 1 if d.month >= 10 else d.year


ev = []
for r in rcsv(os.path.join(H, 'atmospheric_rivers', 'CW3E_AR_events_all_points.csv')):
    lat = float(r['lat'])
    if lat < 32.5 or lat > 42.0:
        continue
    ev.append({'pi': int(round((lat - 32.5) * 2)), 'lat': lat, 'lon': float(r['lon']), 's': ts(r['start_utc']), 'e': ts(r['end_utc']), 'tm': ts(r['max_ivt_time_utc']),
               'dur': float(r['duration_h']), 'ivt': float(r['max_ivt']), 'rk': int(r['ar_scale']), 'dir': fnum(r['max_ivt_dir_deg'])})
log('California point events', len(ev), collections.Counter(e['rk'] for e in ev))
ptlon = {}
for e in ev:
    ptlon[e['pi']] = e['lon']

# ---- per point climatology, water years 1960-2025
P = [{'n': [0] * 6, 'd': [0.0] * 6, 'max': 0, 'maxivt': 0, 'maxdate': None} for _ in LATS]
bywy = collections.defaultdict(lambda: [0.0] * 6)       # statewide AR days by water year by rank (mean over the 20 points)
bywy_n = collections.defaultdict(lambda: [0] * 6)
bymon = [[0.0] * 6 for _ in range(12)]
for e in ev:
    w = wy(e['s'])
    if w < WY0 or w > WY1:
        continue
    p = P[e['pi']]
    p['n'][e['rk']] += 1; p['d'][e['rk']] += e['dur'] / 24.0
    if (e['rk'], e['ivt']) > (p['max'], p['maxivt']):
        p['max'], p['maxivt'], p['maxdate'] = e['rk'], e['ivt'], e['tm'].strftime('%Y-%m-%d')
    bywy[w][e['rk']] += e['dur'] / 24.0 / 20
    bymon[e['s'].month - 1][e['rk']] += e['dur'] / 24.0 / 20 / NY
for p in P:
    p['n'] = [x / NY for x in p['n']]; p['d'] = [x / NY for x in p['d']]

# ---- per ZCTA: linear interpolation in latitude between the two bracketing coast points
Zs = jload(os.path.join(WORK, 'zcta_base.json'))
out = {}
for zc, z in Zs.items():
    f = min(19.0, max(0.0, (z['lat'] - 32.5) * 2))
    i0 = min(18, int(f)); w = f - i0
    a, b = P[i0], P[i0 + 1]
    o = {}
    d = [a['d'][k] * (1 - w) + b['d'][k] * w for k in range(6)]
    n = [a['n'][k] * (1 - w) + b['n'][k] * w for k in range(6)]
    for k in range(1, 6):
        o['ar%dd' % k] = rnd(d[k], 2)
    o['ar_d'] = rnd(sum(d[1:]), 1); o['ar_n'] = rnd(sum(n[1:]), 1); o['ar3_n'] = rnd(sum(n[3:]), 2); o['ar45_dec'] = rnd(sum(n[4:]) * 10, 1)
    pi = int(round(f)); o['ar_pt'] = pi
    o['ar_max'] = P[pi]['max']; o['ar_max_date'] = P[pi]['maxdate']
    c = z['coast_km']
    o['ar_q'] = 'A' if c <= 50 else 'B' if c <= 150 else 'C'
    out[zc] = o
jdump(out, os.path.join(WORK, 'zcta_ar.json'))

# ---- storms: merge point events at neighbouring points that overlap in time
ev.sort(key=lambda e: e['s'])
par = list(range(len(ev)))


def find(i):
    while par[i] != i:
        par[i] = par[par[i]]; i = par[i]
    return i


act = []
for i, e in enumerate(ev):
    act = [j for j in act if ev[j]['e'] >= e['s']]
    for j in act:
        if abs(ev[j]['pi'] - e['pi']) <= 1:
            a, b = find(i), find(j)
            if a != b:
                par[a] = b
    act.append(i)
grp = collections.defaultdict(list)
for i in range(len(ev)):
    grp[find(i)].append(ev[i])
storms = []
for g in grp.values():
    pr = [0] * 20
    for e in g:
        pr[e['pi']] = max(pr[e['pi']], e['rk'])
    top = max(g, key=lambda e: (e['rk'], e['ivt']))
    storms.append({'s': min(e['s'] for e in g), 'e': max(e['e'] for e in g), 'rk': top['rk'], 'ivt': top['ivt'], 'tm': top['tm'], 'tpi': top['pi'], 'pr': pr,
                   'lat0': min(e['lat'] for e in g), 'lat1': max(e['lat'] for e in g), 'dur': max(e['dur'] for e in g), 'dir': top['dir']})
storms.sort(key=lambda s: s['s'])
cnt = collections.Counter((wy(s['s']) >= WY0 and wy(s['s']) <= WY1, s['rk']) for s in storms)
log('merged storms', len(storms), 'by rank WY1960-2025', sorted((k[1], v) for k, v in cnt.items() if k[0]))
storm_wy = collections.defaultdict(lambda: [0] * 6)
storm_mon = [[0] * 6 for _ in range(12)]
for s in storms:
    w = wy(s['s'])
    if WY0 <= w <= WY1:
        storm_wy[w][s['rk']] += 1; storm_mon[s['s'].month - 1][s['rk']] += 1

# ---- Storm Events and FEMA declarations tied to each storm
SE = pickle.load(open(os.path.join(WORK, 'se.pkl'), 'rb'))
zi = ZoneIndex()
TYPES = {'Flood', 'Flash Flood', 'Heavy Rain', 'Debris Flow', 'High Wind', 'Strong Wind', 'Winter Storm', 'Heavy Snow', 'Blizzard', 'Coastal Flood', 'High Surf', 'Thunderstorm Wind', 'Tornado', 'Avalanche', 'Landslide'}
se = []
for q in SE:
    if q['type'] not in TYPES or q['y'] < 1996:
        continue
    lat = q['lat']
    if lat is None:
        i = zi.find(q['czt'], q['czf'], q['czn'], q['b'])
        lat = zi.v[i]['clat'] if i is not None else None
    q['_lat'] = lat
    se.append(q)
se.sort(key=lambda q: q['b'])
import bisect
seb = [q['b'] for q in se]

fema = collections.OrderedDict()
for r in rcsv(os.path.join(PEOPLE, 'fema', 'raw', 'DisasterDeclarationsSummaries_CA.csv')):
    k = r['disasterNumber']
    d = fema.setdefault(k, {'dr': int(k), 'type': r['declarationType'], 'kind': r['incidentType'], 'title': r['declarationTitle'].title(), 'declared': r['declarationDate'][:10],
                            'begin': r['incidentBeginDate'][:10], 'end': (r['incidentEndDate'] or r['incidentBeginDate'])[:10], 'counties': set(), 'ia': 0})
    if r['fipsCountyCode'] not in ('000', ''):
        d['counties'].add(r['fipsCountyCode'])
    d['ia'] = max(d['ia'], int(r['ihProgramDeclared'] or 0), int(r['iaProgramDeclared'] or 0))
WET = {'Flood', 'Severe Storm', 'Mud/Landslide', 'Winter Storm', 'Coastal Storm', 'Dam/Levee Break', 'Snowstorm', 'Severe Ice Storm', 'Tornado', 'Freezing'}


def tie(s):
    b0 = s['s'] - datetime.timedelta(hours=14)   # catalogue times are UTC; Storm Events are local standard time (UTC-8)
    b1 = s['e'] + datetime.timedelta(hours=24)
    lo, hi = s['lat0'] - 0.75, s['lat1'] + 0.75
    i0 = bisect.bisect_left(seb, b0); i1 = bisect.bisect_right(seb, b1)
    n = 0; dmg = 0.0; dd = 0; gust = None; byt = collections.Counter(); eps = set()
    for q in se[i0:i1]:
        if q['_lat'] is None or q['_lat'] < lo or q['_lat'] > hi:
            continue
        n += 1; dmg += q['dmg']; dd += q['dd']; byt[q['type']] += 1; eps.add(q['ep'])
        if q['type'] in ('High Wind', 'Strong Wind') and q['magt'] == 'MG' and q['mag']:
            mph = q['mag'] * 1.15078
            if gust is None or mph > gust[0]:
                gust = (mph, q['czn'].title(), q['b'].strftime('%Y-%m-%d'))
    drs = []
    for d in fema.values():
        if d['kind'] in WET and d['type'] in ('DR', 'EM'):
            fb = datetime.datetime.strptime(d['begin'], '%Y-%m-%d'); fe = datetime.datetime.strptime(d['end'], '%Y-%m-%d')
            if fb <= s['e'] + datetime.timedelta(days=3) and fe >= s['s'] - datetime.timedelta(days=3):
                drs.append(d['dr'])
    return {'se_n': n, 'se_dmg': int(round(dmg)), 'se_deaths': dd, 'se_types': dict(byt.most_common(6)), 'gust': ([int(round(gust[0])), gust[1], gust[2]] if gust else None), 'dr': drs,
            'se_ok': s['s'].year >= 1996}


def stretch(s):
    lab = []
    if s['lat0'] <= 34.5:
        lab.append('South Coast')
    if s['lat0'] <= 37.0 and s['lat1'] >= 35.0:
        lab.append('Central Coast')
    if s['lat1'] >= 37.5:
        lab.append('North Coast')
    return ' and '.join(lab) if len(lab) < 3 else 'whole coast'


led = []
for s in storms:
    t = tie(s)
    notable3 = s['rk'] == 3 and s['s'].year >= 1996 and (t['se_dmg'] >= 10e6 or (t['dr'] and t['se_n'] >= 20) or t['se_deaths'] >= 2)
    if s['rk'] >= 4 or notable3:
        d = {'id': 'AR' + s['s'].strftime('%Y%m%d'), 'kind': 'ar', 'start': s['s'].strftime('%Y-%m-%dT%H'), 'end': s['e'].strftime('%Y-%m-%dT%H'), 'peak': s['tm'].strftime('%Y-%m-%dT%H'),
             'year': s['s'].year, 'month': s['s'].month, 'wy': wy(s['s']), 'rank': s['rk'], 'ivt': int(round(s['ivt'])), 'dur_h': int(s['dur']), 'dir': rnd(s['dir'], 0),
             'lat0': s['lat0'], 'lat1': s['lat1'], 'peak_lat': LATS[s['tpi']], 'peak_at': PTNAME[s['tpi']], 'stretch': stretch(s), 'pr': ''.join(str(x) for x in s['pr']),
             'notable3': bool(notable3)}
        d.update(t)
        led.append(d)
log('ledger AR events', len(led), collections.Counter(d['rank'] for d in led), 'with FEMA', sum(1 for d in led if d['dr']))
for d in sorted(led, key=lambda d: -d['se_dmg'])[:8]:
    print(d['id'], d['rank'], d['stretch'], d['peak_at'], d['se_n'], d['se_dmg'], d['dr'], d['gust'])

jdump({'events': led, 'points': [{'i': i, 'lat': LATS[i], 'lon': ptlon.get(i), 'name': PTNAME[i], 'n_yr': [rnd(x, 2) for x in P[i]['n'][1:]], 'days_yr': [rnd(x, 2) for x in P[i]['d'][1:]],
                                  'max': P[i]['max'], 'max_date': P[i]['maxdate'], 'max_ivt': int(round(P[i]['maxivt']))} for i in range(20)],
       'days_by_wy': {str(w): [rnd(x, 2) for x in bywy[w][1:]] for w in range(WY0, WY1 + 1)},
       'storms_by_wy': {str(w): storm_wy[w][1:] for w in range(WY0, WY1 + 1)},
       'storms_by_month': [m[1:] for m in storm_mon], 'days_by_month': [[rnd(x, 3) for x in m[1:]] for m in bymon],
       'fema': [dict(d, counties=sorted(d['counties'])) for d in fema.values()], 'wy': [WY0, WY1]}, os.path.join(WORK, 'ar_events.json'))
for zc in ('95501', '94102', '90012', '92101', '95969'):
    print(zc, out[zc])
