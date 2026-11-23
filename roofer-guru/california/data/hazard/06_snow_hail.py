#!/usr/bin/env python3
"""Snow (ASCE 7-22 ground snow load, CDEC 1 April snow water, normal snowfall), ASCE design wind, and the thin
thunderstorm record (hail, thunderstorm wind, tornado, located floods) per ZCTA.
Network: ASCE's image service is sampled once at the 1,808 town points (cached in work/asce_zip.json); without the
network the 0.05 degree grid on disk is used. Run: python3 -I 06_snow_hail.py"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hazlib import *
import numpy as np, collections, pickle, datetime, urllib.request, urllib.parse
import shapely

Zs = jload(os.path.join(WORK, 'zcta_base.json'))
keys = list(Zs)
out = {k: {} for k in keys}
B = 'https://gis.asce.org/arcgis/rest/services/ASCE722/%s/ImageServer/getSamples'
SV = ['s2022_RiskCategory2', 's2022_20yrMRI', 'w2022_mri700', 'w2022_SWR_CA']


def samples(svc, pts):
    geom = {'points': [[p[1], p[0]] for p in pts], 'spatialReference': {'wkid': 4326}}
    data = urllib.parse.urlencode({'geometry': json.dumps(geom), 'geometryType': 'esriGeometryMultipoint', 'returnFirstValueOnly': 'true', 'f': 'json'}).encode()
    for k in range(3):
        try:
            j = json.loads(urllib.request.urlopen(urllib.request.Request(B % svc, data=data, headers={'User-Agent': 'roof-weather-atlas/1.0'}), timeout=120).read())
            if 'error' in j:
                raise RuntimeError(str(j['error'])[:160])
            v = [None] * len(pts)
            for s in j.get('samples', []):
                x = s.get('value', '')
                v[s['locationId']] = None if x in ('NoData', '', None) else fnum(x.split()[0])
            return v
        except Exception as e:
            err = e; time.sleep(2 + 2 * k)
    log('ASCE sample failed', svc, str(err)[:120])
    return None


AC = os.path.join(WORK, 'asce_zip.json')
if os.path.exists(AC):
    asce = jload(AC)
else:
    asce = {s: {} for s in SV}
    P = [(Zs[k]['lat'], Zs[k]['lon']) for k in keys]
    for s in SV:
        for i in range(0, len(P), 300):
            v = samples(s, P[i:i + 300])
            if v is None and s == 'w2022_SWR_CA':   # this service rejects a request with points outside its extent: ask one by one for the south-central box
                v = []
                for (la, lo) in P[i:i + 300]:
                    if 34.3 <= la <= 36.6 and -119.6 <= lo <= -116.8:
                        r = samples(s, [(la, lo)]); v.append(r[0] if r else None)
                    else:
                        v.append(None)
            if v is None:
                continue
            for k, x in zip(keys[i:i + 300], v):
                asce[s][k] = x
        log('ASCE', s, 'answers', sum(1 for x in asce[s].values() if x is not None))
    if sum(len(v) for v in asce.values()):
        jdump(asce, AC)

# grid on disk (fallback and the ZCTA maximum)
G = [r for r in rcsv(os.path.join(H, 'asce7', 'ASCE722_grid_0p05deg.csv')) if r['s2022_RiskCategory2'] not in ('', 'ERR')]
glat = np.array([float(r['lat']) for r in G]); glon = np.array([float(r['lon']) for r in G])
gs = np.array([fnum(r['s2022_RiskCategory2'], np.nan) for r in G]); g20 = np.array([fnum(r['s2022_20yrMRI'], np.nan) for r in G]); gw = np.array([fnum(r['w2022_mri700'], np.nan) for r in G])
ZG = load_zctas()
gp = shapely.points(glon, glat)
tree = shapely.STRtree(gp)
nlive = 0
for k in keys:
    z = Zs[k]; o = out[k]
    i = int(np.argmin((glat - z['lat']) ** 2 + ((glon - z['lon']) * math.cos(math.radians(z['lat']))) ** 2))
    s = asce['s2022_RiskCategory2'].get(k); s20 = asce['s2022_20yrMRI'].get(k); w = asce['w2022_mri700'].get(k)
    live = s is not None
    nlive += live
    if s is None:
        s = None if np.isnan(gs[i]) else float(gs[i])
    if s20 is None:
        s20 = None if np.isnan(g20[i]) else float(g20[i])
    if w is None:
        w = None if np.isnan(gw[i]) else float(gw[i])
    o['snow_psf'] = rnd(s, 0) if s is not None else None; o['snow20_psf'] = rnd(s20, 0) if s20 is not None else None
    o['asce_wind'] = rnd(w, 0) if w is not None else None
    sw = asce['w2022_SWR_CA'].get(k) if asce['w2022_SWR_CA'] else None
    o['asce_swr'] = (1 if (sw is not None and 0 < sw < 300000) else 0) if asce['w2022_SWR_CA'] else None
    inside = tree.query(ZG[k]['geom'], predicate='contains')
    vals = gs[inside]; vals = vals[~np.isnan(vals)]
    o['snow_max_psf'] = rnd(float(vals.max()), 0) if len(vals) else None
    span = (z['elev_max_m'] or 0) - (z['elev_min_m'] or 0)
    o['snow_q'] = ('A' if span < 300 else 'B') if live else 'C'
log('ASCE live samples used for', nlive, 'ZIPs')

# ---------------- CDEC 1 April snow water content
st = {r['id']: r for r in rcsv(os.path.join(H, 'snow', 'CDEC_snow_stations.csv'))}
ap = collections.defaultdict(list)
for r in rcsv(os.path.join(H, 'snow', 'CDEC_snow_annual_peaks_by_station_wateryear.csv')):
    kk = [c for c in r if c.startswith('sensor')][0]
    v = fnum(r['april_1_value'])
    if r[kk] == '3' and v is not None and 1996 <= int(r['water_year']) <= 2025 and 0 <= v <= 150:
        ap[r['station']].append(v)
cd = [(s, float(st[s]['lat']), float(st[s]['lon']), float(st[s]['elev_ft']) * 0.3048, sum(v) / len(v), len(v), st[s]['name'].title()) for s, v in ap.items() if s in st and len(v) >= 10]
log('CDEC sensors with 10+ April 1 values', len(cd))
# ---------------- normal snowfall
sn = []
for r in rcsv(os.path.join(H, 'normals', 'CA_normals_1991_2020_station_annual.csv')):
    v = fnum(r['ann_snow_in'])
    if v is not None:
        sn.append((float(r['lat']), float(r['lon']), fnum(r['elev_m'], 0), v))
for k in keys:
    z = Zs[k]; o = out[k]
    best = None
    for (s, la, lo, el, v, n, name) in cd:
        d = hav_km(z['lat'], z['lon'], la, lo)
        if d <= 25 and (z['elev_min_m'] - 150) <= el <= (z['elev_max_m'] + 150) and (best is None or d < best[0]):
            best = (d, v, name, n)
    o['apr1_swe_in'] = rnd(best[1], 1) if best else None; o['apr1_st'] = best[2] if best else None; o['apr1_km'] = rnd(best[0], 0) if best else None; o['apr1_yrs'] = best[3] if best else None
    bs = None
    for (la, lo, el, v) in sn:
        de = hav_km(z['lat'], z['lon'], la, lo) + abs((el or 0) - (z['elev_pt_m'] or 0)) / 20.0
        if de <= 30 and (bs is None or de < bs[0]):
            bs = (de, v)
    o['snowfall_in'] = rnd(bs[1], 1) if bs else None

# ---------------- SPC hail, thunderstorm wind, tornado within 25 miles; located floods within 10 km
def spc(name):
    rows = []
    for r in rcsv(os.path.join(H, 'spc', name)):
        la, lo = fnum(r['slat']), fnum(r['slon'])
        if la and lo:
            rows.append((la, lo, int(r['yr']), r['date'], fnum(r['mag'], 0)))
    return rows


hail = spc('CA_spc_hail_1955-2025.csv'); tsw = spc('CA_spc_wind_1955-2025.csv'); tor = spc('CA_spc_torn_1950-2025.csv')
SE = pickle.load(open(os.path.join(WORK, 'se.pkl'), 'rb'))
fl = [(q['lat'], q['lon']) for q in SE if q['type'] in ('Flood', 'Flash Flood', 'Debris Flow') and q['lat'] and q['lon'] and 1996 <= q['y'] <= 2025]


def arr(rows, i):
    return np.array([r[i] for r in rows])


def dist(z, la, lo):
    p = math.pi / 180
    a = np.sin((la - z['lat']) * p / 2) ** 2 + math.cos(z['lat'] * p) * np.cos(la * p) * np.sin((lo - z['lon']) * p / 2) ** 2
    return 12742.0 * np.arcsin(np.sqrt(a))


hla, hlo, hy, hm = arr(hail, 0), arr(hail, 1), arr(hail, 2), arr(hail, 4)
tla, tlo = arr(tsw, 0), arr(tsw, 1); ola, olo = arr(tor, 0), arr(tor, 1); fla, flo = arr(fl, 0), arr(fl, 1)
R = 40.234
for k in keys:
    z = Zs[k]; o = out[k]
    m = dist(z, hla, hlo) <= R
    o['hail_n25'] = int(m.sum()); o['hail1_n25'] = int((m & (hm >= 1.0)).sum())
    days = {hail[i][3] for i in np.where(m & (hm >= 1.0) & (hy >= 1996) & (hy <= 2025))[0]}
    o['hd1'] = rnd(len(days) / 30.0, 3)
    if m.any():
        i = int(np.argmax(np.where(m, hm, -1)))
        o['hail_max_in'] = rnd(hail[i][4], 2); o['hail_max_date'] = hail[i][3]
    else:
        o['hail_max_in'] = None; o['hail_max_date'] = None
    o['tsw_n25'] = int((dist(z, tla, tlo) <= R).sum()); o['tor_n25'] = int((dist(z, ola, olo) <= R).sum())
    o['flood_n10'] = int((dist(z, fla, flo) <= 10).sum())
jdump(out, os.path.join(WORK, 'zcta_snow_hail.json'))
log('hail rows', len(hail), 'ZIPs with no hail within 25 miles', sum(1 for o in out.values() if o['hail_n25'] == 0), 'with apr1', sum(1 for o in out.values() if o['apr1_swe_in'] is not None))
for k in ('93546', '96161', '96150', '92314', '92352', '95501', '90012', '93555', '96067'):
    print(k, Zs[k].get('po_name'), out[k])
