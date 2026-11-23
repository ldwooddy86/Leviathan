#!/usr/bin/env python3
"""Assemble the four data files from the work tables:
out/zcta_hazard.json, out/hazard_events.json, out/hazard_ts.json, out/hazard_pts.json.
Run: python3 -I 07_assemble.py (after steps 01 to 06)."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hazlib import *
import numpy as np, shapely, pickle, collections, datetime, re
from shapely.geometry import shape

W = lambda n: jload(os.path.join(WORK, n))
base, st, ar, fire, wind, sh = W('zcta_base.json'), W('zcta_station.json'), W('zcta_ar.json'), W('zcta_fire.json'), W('zcta_wind.json'), W('zcta_snow_hail.json')
are, fj, wj = W('ar_events.json'), W('fires.json'), W('wind_events.json')
keys = list(base)

# =====================================================================  1. ZIP columns
COLS = ['zip', 'fips', 'county', 'reg', 'in_ca', 'lat', 'lon', 'pt_src', 'area_km2', 'elev_m', 'elev_min_m', 'elev_max_m', 'elev_pt_m', 'coast_km', 'coast_min_km', 'zone',
        'ar_n', 'ar_d', 'ar1d', 'ar2d', 'ar3d', 'ar4d', 'ar5d', 'ar_days', 'ar3_d', 'ar3_n', 'ar45_dec', 'ar_max', 'ar_max_date', 'ar_pt', 'ar_q',
        'rain_in', 'rain_wet_m', 'rain_wet_in', 'rain_d1', 'rain_d2', 'rain_rec_in', 'rain_rec_date', 'rain_rec_st', 'rain_rec_km', 'rain_rec_yrs', 'rain_st', 'rain_km', 'rain_dz',
        'rain_q', 'raind_q', 'rain_rec_q',
        'g40', 'g58', 'g75', 'gust_max', 'gust_max_date', 'gust_st', 'gust_km', 'gust_dz', 'gust_yrs', 'gust_q', 'wd58', 'wd75', 'lsr_max', 'lsr_max_date', 'lsr_max_at',
        'hw_yr', 'sa_ep', 'di_ep', 'su_ep', 'off_kind', 'off_cls', 'asce_wind', 'asce_swr',
        'fhsz_vh', 'fhsz_high', 'fhsz_mod', 'fhsz_sh', 'fhsz_any', 'fhsz_resp', 'fire_n', 'fire_big', 'fire_big_yr', 'fire_big_ac', 'fire_last', 'fire_last_yr', 'fire_since',
        'burn_sh', 'fire_km', 'fire_near', 'fire_near_yr', 'fire_dest', 'fire_dmg', 'fire_dest_res', 'fire_dmg_res', 'fire_insp', 'lastfire', 'yrsfire', 'fire_worst',
        'fire_worst_yr', 'fire_worst_dest',
        'snow_psf', 'snow20_psf', 'snow_max_psf', 'snow_q', 'apr1_swe_in', 'apr1_st', 'apr1_km', 'apr1_yrs', 'snowfall_in',
        'h90', 'h100', 'h110', 'heat_rec_f', 'heat_rec_date', 'heat_st', 'heat_km', 'heat_dz', 'heat_yrs', 'heat_q', 'tjul',
        'hail_n25', 'hail1_n25', 'hd1', 'hail_max_in', 'hail_max_date', 'tsw_n25', 'tor_n25', 'flood_n10',
        'salt_cls', 'marine_cls', 'st_rain', 'st_wind', 'st_fire', 'st_heat', 'st_snow', 'st_salt', 'stress', 'st_top']
rows = []
recs = {}
for k in keys:
    d = {}
    for t in (base[k], st[k], ar[k], fire[k], wind[k], sh[k]):
        d.update(t)
    d['zip'] = k; d['elev_m'] = d['elev_mean_m']
    d['ar_days'] = rnd(d['ar2d'] + d['ar3d'] + d['ar4d'] + d['ar5d'], 2); d['ar3_d'] = rnd(d['ar3d'] + d['ar4d'] + d['ar5d'], 2)
    d['fhsz_sh'] = rnd(min(100.0, d['fhsz_vh'] + d['fhsz_high']), 1)
    c = d['coast_km']; e = d['elev_pt_m'] or 0; tj = d['tjul']
    d['salt_cls'] = 3 if c <= 0.5 else 2 if c <= 1.6 else 1 if c <= 5 else 0   # steel panel makers' warranty distances: see roof_hazard_model.md section 6
    d['marine_cls'] = 3 if (c <= 8 and e < 300 and tj < 76) else 2 if (c <= 30 and e < 500 and tj < 84) else 1 if (c <= 60 and e < 600 and tj < 90) else 0
    sr = 100 * (min(1, d['rain_d1'] / 15.0) + min(1, d['ar3_d'] / 5.0)) / 2
    sw = 100 * (0.5 * min(1, d['g58'] / 2.0) + 0.3 * min(1, d['wd58'] / 15.0) + 0.2 * d['off_cls'] / 3.0)
    sf = 100 * min(1, 0.6 * (d['fhsz_vh'] + 0.5 * d['fhsz_high'] + 0.2 * d['fhsz_mod']) / 100.0 + 0.25 * min(1, d['burn_sh'] / 30.0) + 0.15 * (1 if d['fire_dest'] > 0 else 0))
    shh = 100 * min(1, d['h100'] / 60.0)
    ss = 100 * min(1, (d['snow_psf'] or 0) / 300.0)
    sa = 100 * max(0, 1 - c / 5.0)
    parts = {'rain': sr, 'wind': sw, 'fire': sf, 'heat': shh, 'snow': ss, 'salt': sa}
    for n, v in parts.items():
        d['st_' + n] = int(round(v))
    d['stress'] = int(round(0.25 * sr + 0.25 * sw + 0.25 * sf + 0.10 * shh + 0.10 * ss + 0.05 * sa))
    d['st_top'] = max(parts, key=lambda n: parts[n])
    recs[k] = d
    rows.append([d.get(c_) for c_ in COLS])
nulls = {c_: sum(1 for r in rows if r[i] is None) for i, c_ in enumerate(COLS)}
NULL_WHY = {'gust_max': 'screened station maximum above 101 mph withheld as doubtful, or the station has none', 'gust_max_date': 'as gust_max',
            'lsr_max': 'no measured gust report within 25 miles since 2004', 'lsr_max_date': 'as lsr_max', 'lsr_max_at': 'as lsr_max',
            'asce_swr': 'outside the small area where ASCE serves a special wind region speed (parts of Kern County and the Indian Wells Valley)',
            'fire_big': 'no perimeter of 10 acres or more touched the ZIP since 2000', 'fire_big_yr': 'as fire_big', 'fire_big_ac': 'as fire_big', 'fire_last': 'as fire_big',
            'fire_last_yr': 'as fire_big', 'fire_since': 'as fire_big', 'lastfire': 'no destroyed or damaged structure in the damage inspections 2013 to 2025', 'yrsfire': 'as lastfire',
            'fire_worst': 'as lastfire', 'fire_worst_yr': 'as lastfire', 'fire_worst_dest': 'as lastfire',
            'snow_max_psf': 'no 0.05 degree grid point falls inside the ZCTA (small ZIPs): use snow_psf', 'apr1_swe_in': 'no CDEC snow sensor within 25 km at the elevation of the ZIP',
            'apr1_st': 'as apr1_swe_in', 'apr1_km': 'as apr1_swe_in', 'apr1_yrs': 'as apr1_swe_in', 'snowfall_in': 'no station with a snowfall normal within 30 km effective distance',
            'hail_max_in': 'no hail report within 25 miles since 1955', 'hail_max_date': 'as hail_max_in', 'heat_rec_f': 'nearest heat station has no record value', 'heat_rec_date': 'as heat_rec_f',
            'reg': 'cross border ZCTA whose California county could not be read', 'snow_psf': 'ASCE gave no value (offshore or outside its raster)', 'snow20_psf': 'as snow_psf',
            'asce_wind': 'as snow_psf'}
bad = {c_: n for c_, n in nulls.items() if n and c_ not in NULL_WHY}
log('columns', len(COLS), 'rows', len(rows), 'columns with nulls', {c_: n for c_, n in nulls.items() if n}, 'UNEXPLAINED', bad)
n1 = jdump({'compiled': COMPILED, 'n': len(rows), 'cols': COLS, 'rows': rows, 'nulls': {c_: [n, NULL_WHY.get(c_, '')] for c_, n in nulls.items() if n},
            'notes': {'schema': 'CA/data/hazard/HAZARD_SCHEMA.md section 1', 'point': 'values are taken at the town point (lat, lon)', 'stress': 'grade D ranking aid; recipe in the schema'}},
           os.path.join(OUT, 'zcta_hazard.json'))

# =====================================================================  2. events
fires = fj['fires']
fema = are['fema']
for d in fema:   # FEMA files two California declarations for Tropical Storm Hilary (August 2023) and one 2005 evacuation under the incident type "Hurricane"
    if d['kind'] == 'Hurricane':
        if d['dr'] == 3248:
            d['kind'] = 'Other'; d['title'] = 'Evacuation From An Out Of State Disaster'
        else:
            d['kind'] = 'Severe Storm'
nmz = lambda s: re.sub(r'[^a-z0-9]+', ' ', (s or '').lower()).strip()
GENERIC = {'fire', 'fires', 'complex', 'the', 'wildfire', 'wildfires', 'lightning', 'unnamed', 'and', 'lake', 'creek', 'valley', 'river', 'canyon', 'mountain', 'point', 'hill', 'park'}
for f in fires:
    f['dr'] = []
    if not f['start']:
        continue
    fs = datetime.datetime.strptime(f['start'], '%Y-%m-%d')
    toks = [t for t in nmz(f['name']).split() if t not in GENERIC and len(t) >= 4]
    c3 = {x[2:] for x in f['fips']}
    for d in fema:
        if d['kind'] != 'Fire' or not d['begin']:
            continue
        fb = datetime.datetime.strptime(d['begin'], '%Y-%m-%d'); fe = datetime.datetime.strptime(d['end'] or d['begin'], '%Y-%m-%d')
        if abs((fb - fs).days) > 21 and not (fb <= fs <= fe):
            continue
        cty = bool(c3 & set(d['counties'])) or not d['counties']
        tt = nmz(d['title']).split()
        named = bool(toks) and all(t in tt for t in toks)
        big = (f['dest'] or 0) >= 50 or (f['acres'] or 0) >= 20000
        if cty and (named or (d['type'] in ('DR', 'EM') and big and fb - datetime.timedelta(days=3) <= fs <= fe + datetime.timedelta(days=3))):
            f['dr'].append(d['dr'])
log('fires', len(fires), 'with a FEMA number', sum(1 for f in fires if f['dr']))
# compact records: optional keys are left out when empty (dest and dmg stay, null = not known)
for f in fires:
    f.pop('agency', None); f.pop('month', None)
    if f.get('dins') and all(nmz(n) == nmz(f['name']) for n in f['dins']):
        f['dins'] = []
    for k_ in ('cont', 'cause', 'complex', 'dins', 'dr', 'dest_res', 'insp', 'note', 'd'):
        if f.get(k_) in (None, [], ''):
            f.pop(k_, None)
    if f['year'] < 2013:
        f.pop('note', None); f['q'] = 1      # q 1: before the inspection records, structure counts not known
    elif 'd' not in f:
        f.pop('note', None); f['q'] = 2      # q 2: inspection incident with no perimeter in the FRAP set, placed at the mean of its damaged structures

ARL = are['events']
# all merged landfalls, compact rows: rebuilt here from the catalogue the same way as step 03
import importlib.util
ar_rows = W('ar_rows.json') if os.path.exists(os.path.join(WORK, 'ar_rows.json')) else None

# roof, eaves, vents table (residences, incidents of 2018 and later)
RESID = ('Single Family', 'Single Famliy', 'Multi Family', 'Mobile Home', 'Mixed Commercial/Residential')
DK = {'Destroyed (>50%)': 'dest', 'Major (25-50%)': 'major', 'Minor (10-25%)': 'minor', 'Affected (>0-10%)': 'affected', 'Affected (1-9%)': 'affected', 'No Damage': 'none'}
RK = {'Asphalt': 'asphalt', 'Metal': 'metal', 'Tile': 'tile', 'Concrete': 'concrete', 'Wood': 'wood', 'Other': 'other', 'Unknown': 'unknown'}
EK = {'Enclosed': 'enclosed', 'Unenclosed': 'unenclosed', 'No Eaves': 'none', 'Unknown': 'unknown'}
VK = {'Mesh Screen <= 1/8"': 'mesh_fine', 'Mesh Screen > 1/8"': 'mesh_coarse', 'Unscreened': 'unscreened', 'No Vents': 'none', 'Unknown': 'unknown', 'Screened': 'screened_old'}
blank = lambda: {'dest': 0, 'major': 0, 'minor': 0, 'affected': 0, 'none': 0, 'total': 0}
roof = collections.defaultdict(blank); eav = collections.defaultdict(blank); ven = collections.defaultdict(blank)
roof_all = collections.defaultdict(blank)
roof_era = collections.defaultdict(lambda: collections.defaultdict(blank))
nres = 0
with open(os.path.join(H, 'calfire', 'dins', 'DINS_POSTFIRE_MASTER_attributes.csv'), newline='', encoding='utf-8-sig') as f:
    for r in csv.DictReader(f):
        dk = DK.get(r['DAMAGE'])
        if not dk or r['INCIDENTSTARTDATE_iso'][:4] < '2018':
            continue
        rk = RK.get(r['ROOFCONSTRUCTION'].strip(), 'unknown' if not r['ROOFCONSTRUCTION'].strip() else 'other')
        roof_all[rk][dk] += 1; roof_all[rk]['total'] += 1
        if not r['STRUCTURETYPE'].startswith(RESID):
            continue
        nres += 1
        for tab, kk in ((roof, rk), (eav, EK.get(r['EAVES'].strip(), 'unknown')), (ven, VK.get(r['VENTSCREEN'].strip(), 'unknown'))):
            tab[kk][dk] += 1; tab[kk]['total'] += 1
        yb = fnum(r.get('YEARBUILT'))
        era = 'unknown' if not yb or yb < 1800 else 'pre1980' if yb < 1980 else '1980_2007' if yb < 2008 else '2008on'
        roof_era[era][rk][dk] += 1; roof_era[era][rk]['total'] += 1
roofT = dict(roof); roofT['eaves'] = dict(eav); roofT['vents'] = dict(ven); roofT['all_structures'] = dict(roof_all)
roofT['by_era'] = {e: dict(v) for e, v in roof_era.items()}
roofT['n_residences'] = nres
roofT['note'] = 'CAL FIRE damage inspections, residences (single family, multi family, mobile home, mixed use), incidents of 2018 and later, when undamaged structures were recorded too. Raw cross tabulation: not adjusted for fire intensity, spacing or age. screened_old is the pre-2020 category "Screened" with no mesh size.'
log('roof table residences 2018 on', nres, {k: (v['dest'], v['total']) for k, v in roof.items()})

zdins = {k: fire[k]['fire_years'] for k in keys if fire[k]['fire_years']}
fs_km = fj['fhsz_state_km2']
hz = {'compiled': COMPILED, 'geo': fj['geo'], 'fires': fires, 'zfire': fj['zfire'], 'zdins': zdins,
      'ar_cols': ['start', 'hours', 'rank', 'ivt', 'peak_lat', 'lat0', 'lat1'], 'ar': None, 'ar_pts': are['points'], 'ar_big': ARL,
      'wind': wj['wind'], 'zones': wj['zones'], 'roof': roofT,
      'fhsz': dict(fs_km, zips_any_vh=sum(1 for k in keys if fire[k]['fhsz_vh'] > 0), zips_any=sum(1 for k in keys if fire[k]['fhsz_any'] > 0),
                   note='km2 of ZCTA land in each class: State Responsibility Area map effective 1 April 2024 plus Local Responsibility Area map of 24 March 2025'),
      'fema': [[d['dr'], d['type'], d['declared'], d['kind'], d['title'], len(d['counties'])] for d in fema]}

# all landfalls (compact): redo the merge of step 03 on the catalogue
LATS = [32.5 + 0.5 * i for i in range(20)]
ev = []
for r in rcsv(os.path.join(H, 'atmospheric_rivers', 'CW3E_AR_events_all_points.csv')):
    lat = float(r['lat'])
    if 32.5 <= lat <= 42.0:
        t = lambda s: datetime.datetime(int(s[:4]), int(s[4:6]), int(s[6:8]), int(s[8:10]))
        ev.append((t(r['start_utc']), t(r['end_utc']), int(round((lat - 32.5) * 2)), float(r['duration_h']), float(r['max_ivt']), int(r['ar_scale'])))
ev.sort()
par = list(range(len(ev)))


def find(i):
    while par[i] != i:
        par[i] = par[par[i]]; i = par[i]
    return i


act = []
for i, e in enumerate(ev):
    act = [j for j in act if ev[j][1] >= e[0]]
    for j in act:
        if abs(ev[j][2] - e[2]) <= 1:
            a, b = find(i), find(j)
            if a != b:
                par[a] = b
    act.append(i)
grp = collections.defaultdict(list)
for i in range(len(ev)):
    grp[find(i)].append(ev[i])
arr = []
for g in grp.values():
    top = max(g, key=lambda e: (e[5], e[4]))
    arr.append([min(e[0] for e in g).strftime('%Y-%m-%d'), int(max(e[3] for e in g)), top[5], int(round(top[4])), LATS[top[2]], LATS[min(e[2] for e in g)], LATS[max(e[2] for e in g)]])
arr.sort()
hz['ar'] = arr
for d in ARL:
    d['summer'] = d['month'] in (6, 7, 8, 9)
log('AR landfalls', len(arr), collections.Counter(a[2] for a in arr), 'ar_big', len(ARL), 'wind', len(hz['wind']))
n2 = jdump(hz, os.path.join(OUT, 'hazard_events.json'))
sizes = {k: len(json.dumps(v, separators=(',', ':'))) for k, v in hz.items()}
log('hazard_events.json', n2, {k: v for k, v in sizes.items() if v > 2000})

# =====================================================================  3. located points
SE = pickle.load(open(os.path.join(WORK, 'se.pkl'), 'rb'))
LSR = pickle.load(open(os.path.join(WORK, 'lsr_gust.pkl'), 'rb'))
Zg = load_zctas()
zkeys = list(Zg)
ztree = shapely.STRtree(np.array([Zg[k]['geom'] for k in zkeys], dtype=object))
cfeat = jload(os.path.join(GEO, 'ca_county_2024_5m.geojson'))['features']
cfips = [f['properties']['GEOID'] for f in cfeat]
ctree = shapely.STRtree(np.array([shape(f['geometry']).buffer(0) for f in cfeat], dtype=object))
bp = os.path.join(CA, 'data', 'work', 'base.json')
if os.path.exists(bp):
    bj = jload(bp)
    zorder = {d['zip']: i for i, d in enumerate(bj['zips'])}; corder = {d['fips']: i for i, d in enumerate(bj['counties'])}
    osrc = 'CA/data/work/base.json'
else:
    zorder = {k: i for i, k in enumerate(keys)}; corder = {f: i for i, f in enumerate(sorted(cfips))}
    osrc = 'hazard job order (zcta_hazard.json rows; counties by FIPS)'
FLAGS = ['h1', 'h175', 'w58', 'w75', 'ef1', 'dmg', 'night', 'measured', 'burn']
FB = {f: 1 << i for i, f in enumerate(FLAGS)}
BURN = re.compile(r'burn scar|burn area|burned area|fire scar|recent(ly)? burn|\b[A-Z][a-z]+ [Ff]ire (burn|scar|area)| fire burn', re.I)
P = []
KSE = {'Hail': 0, 'Thunderstorm Wind': 1, 'Tornado': 2, 'Flood': 3, 'Flash Flood': 4, 'Debris Flow': 5}
for q in SE:
    k = KSE.get(q['type'])
    if k is None or q['lat'] is None or q['lon'] is None or q['y'] < 1996 or (k in (3, 4) and q['y'] < 2016):
        continue
    if not (32.3 <= q['lat'] <= 42.1 and -124.6 <= q['lon'] <= -114.0):
        continue
    mag = 0; b = 0
    if k == 0:
        mag = rnd(q['mag'] or 0, 2); b |= (FB['h1'] if mag >= 1 else 0) | (FB['h175'] if mag >= 1.75 else 0)
    elif k == 1:
        mag = int(round((q['mag'] or 0) * 1.15078)); b |= (FB['w58'] if mag >= 58 else 0) | (FB['w75'] if mag >= 75 else 0) | (FB['measured'] if q['magt'] in ('MG', 'MS') else 0)
    elif k == 2:
        m = re.search(r'(\d)', q['tor'] or ''); mag = int(m.group(1)) if m else -1; b |= FB['ef1'] if mag >= 1 else 0
    if q['dmg'] >= 10000:
        b |= FB['dmg']
    if k in (4, 5) and BURN.search((q['en'] or '') + ' ' + (q['pn'] or '')):
        b |= FB['burn']
    P.append([q['lat'], q['lon'], q['b'], k, mag, b, round(q['dmg'] / 1000.0, 1)])
nse = len(P)
# Local Storm Reports: non thunderstorm gusts of 58 mph or more and heavy rain of 3 inches or more, 2010 on, thinned
cell = {}
for r in LSR:
    if r['ts'] or r['mph'] < 58 or r['t'].year < 2016:
        continue
    kk = (r['t'].date(), int(r['lat'] * 2), int(r['lon'] * 2))
    if kk not in cell or r['mph'] > cell[kk]['mph']:
        cell[kk] = r
for r in cell.values():
    m = int(round(r['mph']))
    P.append([r['lat'], r['lon'], r['t'], 7, m, FB['w58'] | (FB['w75'] if m >= 75 else 0) | FB['measured'], 0])
ngust = len(P) - nse
cell = {}
for q in rcsv(os.path.join(H, 'lsr', 'CA_lsr_1996_2026.csv')):
    if q['TYPETEXT'] != 'HEAVY RAIN':
        continue
    mag = fnum(q['MAG']); la = fnum(q['LAT']); lo = fnum(q['LON'])
    if mag is None or la is None or mag < 3 or mag > 40:
        continue
    try:
        t = datetime.datetime.strptime(q['VALID'], '%Y%m%d%H%M') - datetime.timedelta(hours=8)
    except Exception:
        continue
    if t.year < 2016:
        continue
    kk = (t.date(), int(la * 2), int(lo * 2))
    if kk not in cell or mag > cell[kk][4]:
        cell[kk] = [la, lo, t, 6, rnd(mag, 2), FB['measured'] if q['QUALIFIER'] == 'M' else 0, 0]
P.extend(cell.values())
nrain = len(P) - nse - ngust
P.sort(key=lambda p: p[2])
pg = shapely.points([p[1] for p in P], [p[0] for p in P])
zi_ = np.full(len(P), -1); ci_ = np.full(len(P), -1)
a, b = ztree.query(pg, predicate='within'); zi_[a] = b
a, b = ctree.query(pg, predicate='within'); ci_[a] = b
pts = []
for i, p in enumerate(P):
    t = p[2]
    hour = t.hour
    b = p[5] | (FB['night'] if (hour >= 20 or hour <= 5) else 0)
    zi = zorder.get(zkeys[zi_[i]], -1) if zi_[i] >= 0 else -1
    pi = corder.get(cfips[ci_[i]], -1) if ci_[i] >= 0 else -1
    pts.append([round(p[0], 3), round(p[1], 3), t.year, t.month, (t.weekday() + 1) % 7 + 1, hour, p[3], p[4], b, pi, zi, p[6]])
ptk = [{'k': 0, 'name': 'Hail', 'unit': 'inches', 'src': 'NOAA Storm Events 1996 to 2026'}, {'k': 1, 'name': 'Thunderstorm wind', 'unit': 'mph', 'src': 'NOAA Storm Events 1996 to 2026'},
       {'k': 2, 'name': 'Tornado', 'unit': 'EF', 'src': 'NOAA Storm Events 1996 to 2026'}, {'k': 3, 'name': 'Flood', 'unit': '', 'src': 'NOAA Storm Events 2016 to 2026'},
       {'k': 4, 'name': 'Flash flood', 'unit': '', 'src': 'NOAA Storm Events 2016 to 2026'}, {'k': 5, 'name': 'Debris flow', 'unit': '', 'src': 'NOAA Storm Events 1996 to 2026'},
       {'k': 6, 'name': 'Heavy rain', 'unit': 'inches', 'src': 'NWS Local Storm Reports 2016 to 2026, 3 inches or more, highest per day and half degree cell'},
       {'k': 7, 'name': 'Wind gust (not thunderstorm)', 'unit': 'mph', 'src': 'NWS Local Storm Reports 2016 to 2026, measured, 58 mph or more, highest per day and half degree cell'}]
kc = collections.Counter(p[6] for p in pts)
n4 = jdump({'compiled': COMPILED, 'ptkinds': ptk, 'ptflags': FLAGS, 'pts': pts, 'counts': {str(k): kc[k] for k in sorted(kc)},
            'order': {'src': osrc, 'n_zips': len(zorder), 'n_counties': len(corder)}, 'tz': 'Pacific Standard Time (UTC-8) all year, as NOAA files Storm Events; Local Storm Reports converted from UTC'},
           os.path.join(OUT, 'hazard_pts.json'))
log('pts', len(pts), dict(kc), 'bytes', n4, 'no zip', int(sum(1 for p in pts if p[10] < 0)), 'burn flag', sum(1 for p in pts if p[8] & FB['burn']))

# =====================================================================  4. time series
YRS = [str(y) for y in range(1996, 2026)]
month = collections.defaultdict(lambda: [0] * 12)
year = {y: collections.Counter() for y in YRS}
hour = collections.defaultdict(lambda: [0] * 24)
for name, kind in (('CA_spc_hail_1955-2025.csv', 'hail'), ('CA_spc_wind_1955-2025.csv', 'tsw'), ('CA_spc_torn_1950-2025.csv', 'torn')):
    for r in rcsv(os.path.join(H, 'spc', name)):
        y = int(r['yr'])
        if 1996 <= y <= 2025:
            month[kind][int(r['mo']) - 1] += 1; year[str(y)][kind] += 1
            hh = (int(r['time'][:2]) - 2) % 24   # SPC times are Central Standard; Pacific Standard is two hours earlier
            hour[kind][hh] += 1
            if kind == 'hail' and fnum(r['mag'], 0) >= 1:
                year[str(y)]['hail1'] += 1
SEK = {'High Wind': 'hw', 'Strong Wind': 'sw', 'Heavy Rain': 'hrain', 'Flood': 'flood', 'Flash Flood': 'fflood', 'Debris Flow': 'debris', 'Heavy Snow': 'hsnow', 'Winter Storm': 'wstorm',
       'Excessive Heat': 'xheat', 'Heat': 'heat', 'Wildfire': 'wfire'}
for q in SE:
    k = SEK.get(q['type'])
    if k and 1996 <= q['y'] <= 2025:
        month[k][q['m'] - 1] += 1; year[str(q['y'])][k] += 1
        if k == 'fflood':
            hour[k][q['b'].hour] += 1
for r in LSR:
    if r['mph'] >= 58:
        y = r['t'].year
        if 2010 <= y <= 2025:
            month['g58'][r['t'].month - 1] += 1; hour['g58'][r['t'].hour] += 1
        if 2004 <= y <= 2025:
            year[str(y)]['g58'] += 1
            if r['mph'] >= 75:
                year[str(y)]['g75'] += 1
month['fire_n'] = fj['perims_by_month']; month['fire_ac'] = fj['acres_by_month']
month['fire_dest'] = [m[0] for m in fj['dins_by_month']]; month['fire_dmg'] = [m[1] for m in fj['dins_by_month']]
fire_year = {}
for y in range(2000, 2026):
    pn, pa, p1k = fj['perims_by_year'][str(y)]
    dd = fj['dins_by_year'].get(str(y))
    fire_year[str(y)] = [pn, pa, p1k, dd[0] if dd else None, dd[1] if dd else None, dd[2] if dd else None]
    year[str(y)]['fire_n'] = pn; year[str(y)]['fire_ac'] = pa
    if dd:
        year[str(y)]['fire_dest'] = dd[0]; year[str(y)]['fire_dmg'] = dd[1]; year[str(y)]['fire_dest_res'] = dd[2]
for i in range(5):
    month['ar%d' % (i + 1)] = [m[i] for m in are['storms_by_month']]
month['ar_days'] = [rnd(sum(m), 2) for m in are['days_by_month']]
sa_year = {}
sam = [0.0] * 12
sr = rcsv(os.path.join(H, 'santa_ana_diablo', 'SAWRI_daily_days_by_year_month.csv'))
for r in sr:
    sa_year[r['year']] = int(r['SAW_days'])
    for m in range(12):
        sam[m] += int(r['m%02d' % (m + 1)]) / len(sr)
month['sa_days'] = [rnd(x, 1) for x in sam]
month['wind'] = month['tsw']; hour['wind'] = hour['tsw']
# monthly rain vectors, weighted by housing units
hu = {r['geoid'][-5:]: fnum(r['hu'], 0) or 0 for r in rcsv(os.path.join(PEOPLE, 'acs', 'derived', 'ca_zcta_acs_columns.csv'))}
acc = collections.defaultdict(lambda: [np.zeros(12), 0.0])
for k in keys:
    w = hu.get(k, 0)
    if not w or not base[k]['reg'] or not base[k]['in_ca']:
        continue
    v = np.array(st[k]['rain_m'])
    for g in ('state', BELT[base[k]['reg']], 'reg:' + base[k]['reg']):
        acc[g][0] += v * w; acc[g][1] += w
rain = {'reg': {}}
for g, (v, w) in acc.items():
    vec = [rnd(x, 2) for x in (v / w)]
    if g.startswith('reg:'):
        rain['reg'][g[4:]] = vec
    else:
        rain[g] = vec
rain['note'] = 'normal monthly precipitation 1991 to 2020, inches, mean of ZIP values weighted by housing units (ACS 2020 to 2024); north = nc, fn, sv, si; central = ba, cc, sj; south = la, oc, ie, sd'
dow = [[0] * 24 for _ in range(7)]
for p in pts:
    dow[p[4] - 1][p[5]] += 1
KMAP = {'Fire': 'fire', 'Flood': 'flood', 'Earthquake': 'quake', 'Severe Storm': 'storm', 'Winter Storm': 'storm', 'Coastal Storm': 'storm', 'Mud/Landslide': 'storm', 'Snowstorm': 'storm',
        'Freezing': 'storm', 'Tornado': 'storm', 'Severe Ice Storm': 'storm', 'Dam/Levee Break': 'flood'}
fdy = collections.defaultdict(lambda: {'fire': 0, 'storm': 0, 'flood': 0, 'quake': 0, 'other': 0})
for d in fema:
    fdy[d['declared'][:4]][KMAP.get(d['kind'], 'other')] += 1
ts = {'compiled': COMPILED, 'month': {k: v for k, v in month.items()}, 'year': {y: dict(c) for y, c in year.items()}, 'hour': dict(hour), 'dowhour': dow,
      'ar_wy': are['storms_by_wy'], 'ar_days_wy': are['days_by_wy'], 'sa_year': sa_year, 'rain': rain,
      'fema_decl': hz['fema'], 'fema_decl_year': {y: fdy[y] for y in sorted(fdy)}, 'zone_county': wj['zone_county'], 'fire_year': fire_year,
      'periods': {'month': 'SPC and Storm Events kinds 1996 to 2025; g58 2010 to 2025; fire_n and fire_ac 2000 to 2025; fire_dest and fire_dmg 2013 to 2025; ar1 to ar5 and ar_days water years 1960 to 2025; sa_days 1948 to 2018',
                  'hour': 'Pacific Standard Time'}}
n3 = jdump(ts, os.path.join(OUT, 'hazard_ts.json'))
log('hazard_ts.json', n3, 'month kinds', sorted(ts['month']))
print('rain north', rain['north'], 'central', rain['central'], 'south', rain['south'])
print('sa_days', month['sa_days'], 'fire_dest month', month['fire_dest'], 'hw', month['hw'])
print('fema since 2000', sum(sum(v.values()) for y, v in fdy.items() if y >= '2000'), 'fire', sum(v['fire'] for y, v in fdy.items() if y >= '2000'))
log('sizes', {'zcta_hazard': n1, 'events': n2, 'ts': n3, 'pts': n4})
