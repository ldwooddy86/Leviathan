#!/usr/bin/env python3
"""Per ZCTA rain, heat and gust-day columns from stations, with distance and elevation care.
Inputs: 1991-2020 normals (768 stations), GHCN-Daily tables (922), screened gust tables (IEM airports and GHCN).
Run: python3 -I 02_stations.py"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hazlib import *
import numpy as np
import shapely
from shapely.geometry import Point

Zs = jload(os.path.join(WORK, 'zcta_base.json'))
coast = shapely.from_wkb(open(os.path.join(WORK, 'coast_albers.wkb'), 'rb').read())
T = albers()


def coast_km(lat, lon):
    x, y = T(lon, lat)
    return Point(x, y).distance(coast) / 1000


def qflag(d_eff, cuts):
    return 'A' if d_eff <= cuts[0] else 'B' if d_eff <= cuts[1] else 'C' if d_eff <= cuts[2] else 'D'


class Net:
    """A set of stations with values; lookup by effective distance.
    d_eff = horizontal km + |elevation difference in m| / ez + cw * |difference in capped coast distance|."""

    def __init__(self, rows, ez, cw=0.0):
        self.rows = rows
        self.lat = np.array([r['lat'] for r in rows]); self.lon = np.array([r['lon'] for r in rows])
        self.el = np.array([r['elev'] if r['elev'] is not None else np.nan for r in rows])
        self.ez, self.cw = ez, cw
        self.ck = np.array([min(60.0, coast_km(r['lat'], r['lon'])) for r in rows]) if cw else None

    def near(self, z, k=3):
        la, lo = z['lat'], z['lon']
        p = math.pi / 180
        a = np.sin((self.lat - la) * p / 2) ** 2 + math.cos(la * p) * np.cos(self.lat * p) * np.sin((self.lon - lo) * p / 2) ** 2
        d = 12742.0 * np.arcsin(np.sqrt(a))
        ze = z.get('elev_pt_m')
        dz = np.where(np.isnan(self.el) | (ze is None), 0.0, self.el - (ze or 0))
        de = d + np.abs(dz) / self.ez
        if self.cw:
            de = de + self.cw * np.abs(self.ck - min(60.0, z['coast_km']))
        idx = np.argsort(de)[:k]
        return [(int(i), float(d[i]), float(dz[i]), float(de[i])) for i in idx]

    def idw(self, z, key, k=3):
        nn = self.near(z, k)
        w = [1.0 / (de + 1.0) ** 2 for i, d, dz, de in nn]
        v = [self.rows[i][key] for i, d, dz, de in nn]
        return sum(a * b for a, b in zip(w, v)) / sum(w), nn


# ---------------- rain
ann = rcsv(os.path.join(H, 'normals', 'CA_normals_1991_2020_station_annual.csv'))
mon = {}
for r in rcsv(os.path.join(H, 'normals', 'CA_normals_1991_2020_monthly_long.csv')):
    v = fnum(r['MLY-PRCP-NORMAL'])
    if v is not None:
        mon.setdefault(r['station'], {})[int(r['month'])] = v
    t = fnum(r['MLY-TMAX-NORMAL'])
    if t is not None:
        mon.setdefault(r['station'] + '|T', {})[int(r['month'])] = t
gs = {r['station']: r for r in rcsv(os.path.join(H, 'ghcnd', 'CA_ghcnd_station_summary.csv'))}

rain_rows, day_rows, jul_rows = [], [], []
for r in ann:
    sid = r['station']
    base = {'id': sid, 'name': r['name'].replace(', CA US', '').strip().title(), 'lat': float(r['lat']), 'lon': float(r['lon']), 'elev': fnum(r['elev_m'])}
    a = fnum(r['ann_prcp_in'])
    m = mon.get(sid, {})
    if a is not None and len(m) == 12:
        rain_rows.append(dict(base, rain=a, **{'m%d' % k: m[k] for k in range(1, 13)}))
    d1, d2 = fnum(r['days_prcp_ge1.00']), fnum(r['days_prcp_ge2.00'])
    src = 'normals 1991-2020'
    if d1 is None or d2 is None:
        g = gs.get(sid)
        if g:
            for per in ('1991_2020', '1996_2025'):
                if (fnum(g['n_complete_prcp_years_' + per], 0) or 0) >= 10:
                    d1, d2, src = fnum(g['prcp_days_ge1in_per_yr_' + per]), fnum(g['prcp_days_ge2in_per_yr_' + per]), 'daily ' + per.replace('_', '-')
                    break
    if d1 is not None and d2 is not None:
        day_rows.append(dict(base, d1=d1, d2=d2, src=src))
    tj = mon.get(sid + '|T', {})
    if len(tj) == 12:
        jul_rows.append(dict(base, tjul=tj[7], tmaxw=max(tj.values())))
# GHCN stations without normals but with 10+ complete rain years: add their day counts
have = {r['id'] for r in day_rows}
for sid, g in gs.items():
    if sid in have:
        continue
    for per in ('1991_2020', '1996_2025'):
        if (fnum(g['n_complete_prcp_years_' + per], 0) or 0) >= 10:
            day_rows.append({'id': sid, 'name': g['name'].title(), 'lat': float(g['lat']), 'lon': float(g['lon']), 'elev': fnum(g['elev_m']),
                             'd1': fnum(g['prcp_days_ge1in_per_yr_' + per]), 'd2': fnum(g['prcp_days_ge2in_per_yr_' + per]), 'src': 'daily ' + per.replace('_', '-')})
            break
# record wettest day, full period of record, stations with 20+ years of 300+ daily values
rec = {}
yrs = {}
tmaxrec = {}
for r in rcsv(os.path.join(H, 'ghcnd', 'CA_ghcnd_days_by_station_year.csv')):
    if (fnum(r['n_prcp_values'], 0) or 0) >= 300:
        yrs[r['station']] = yrs.get(r['station'], 0) + 1
    v = fnum(r['max_daily_prcp_in'])
    if v is not None and (r['station'] not in rec or v > rec[r['station']][0]):
        rec[r['station']] = (v, r['max_prcp_date'])
    t = fnum(r['max_tmax_F'])
    if t is not None and (r['station'] not in tmaxrec or t > tmaxrec[r['station']][0]):
        tmaxrec[r['station']] = (t, r['max_tmax_date'])
rec_rows = []
for sid, (v, dt) in rec.items():
    g = gs.get(sid)
    if g and yrs.get(sid, 0) >= 20 and v < 30:
        rec_rows.append({'id': sid, 'name': g['name'].title(), 'lat': float(g['lat']), 'lon': float(g['lon']), 'elev': fnum(g['elev_m']), 'rec': v, 'date': dt, 'yrs': yrs[sid]})
log('rain stations', len(rain_rows), 'rain-day stations', len(day_rows), 'record-day stations', len(rec_rows), 'july tmax stations', len(jul_rows))

# ---------------- heat: GHCN-Daily 1996-2025, 10+ complete max temperature years
heat_rows = []
for sid, g in gs.items():
    n = fnum(g['n_complete_tmax_years_1996_2025'], 0) or 0
    # RAWS (USR) temperature records are left out: several carry impossible values (129 F at Beverly Hills, three
    # days a year of 100 F at 2,146 m), and NCEI's flag does not remove them
    if n >= 10 and fnum(g['tmax_days_ge100F_per_yr_1996_2025']) is not None and not sid.startswith('USR'):
        heat_rows.append({'id': sid, 'name': g['name'].title(), 'lat': float(g['lat']), 'lon': float(g['lon']), 'elev': fnum(g['elev_m']), 'h90': fnum(g['tmax_days_ge90F_per_yr_1996_2025']),
                          'h100': fnum(g['tmax_days_ge100F_per_yr_1996_2025']), 'h110': fnum(g['tmax_days_ge110F_per_yr_1996_2025']), 'n': int(n),
                          'rec': tmaxrec.get(sid, (None, None))[0], 'recd': tmaxrec.get(sid, (None, None))[1]})
log('heat stations', len(heat_rows))

# ---------------- gust days: screened tables; IEM airports (2002-2025 columns) and GHCN (1996-2025), one row per site
gust_rows = []
for r in rcsv(os.path.join(H, 'asos_daily', 'CA_gust_days_iem_asos_station_summary.csv')):
    n = fnum(r['n_complete_years_2002_2025'], 0) or 0
    if n >= 8 and fnum(r['qc_days_ge40mph_per_yr_2002_2025']) is not None:
        gust_rows.append({'id': r['station'], 'name': r['name'].title(), 'lat': float(r['lat']), 'lon': float(r['lon']), 'elev': fnum(r['elev_m']), 'g40': fnum(r['qc_days_ge40mph_per_yr_2002_2025']),
                          'g58': fnum(r['qc_days_ge58mph_per_yr_2002_2025']), 'g75': fnum(r['qc_days_ge75mph_per_yr_2002_2025']), 'n': int(n), 'max': fnum(r['max_gust_qc_mph_1996_2025']),
                          'maxd': r['max_gust_qc_date'], 'src': 'IEM airport daily 2002-2025'})
for r in rcsv(os.path.join(H, 'ghcnd', 'CA_gust_days_ghcnd_station_summary.csv')):
    n = fnum(r['n_complete_years_1996_2025(>=330 obs days)'], 0) or 0
    if n >= 8 and fnum(r['qc_days_ge40mph_per_yr_1996_2025']) is not None:
        la, lo = float(r['lat']), float(r['lon'])
        dup = [g for g in gust_rows if hav_km(la, lo, g['lat'], g['lon']) < 3]
        row = {'id': r['station'], 'name': r['name'].title(), 'lat': la, 'lon': lo, 'elev': fnum(r['elev_m']), 'g40': fnum(r['qc_days_ge40mph_per_yr_1996_2025']),
               'g58': fnum(r['qc_days_ge58mph_per_yr_1996_2025']), 'g75': fnum(r['qc_days_ge75mph_per_yr_1996_2025']), 'n': int(n), 'max': fnum(r['max_gust_qc_mph_1996_2025']),
               'maxd': r['max_gust_qc_date'], 'src': 'GHCN-Daily 1996-2025'}
        if dup:
            if n > dup[0]['n']:
                gust_rows[gust_rows.index(dup[0])] = row
        else:
            gust_rows.append(row)
# screened maxima that the sources file calls doubtful: cap the reported record at the value but mark it
log('gust stations', len(gust_rows))

NR = Net(rain_rows, ez=20.0)          # 100 m of elevation counts as 5 km
ND = Net(day_rows, ez=20.0)
NREC = Net(rec_rows, ez=20.0)
NH = Net(heat_rows, ez=10.0, cw=1.0)  # 100 m = 10 km; 1 km of difference in distance to the sea (capped at 60 km) = 1 km
NJ = Net(jul_rows, ez=10.0, cw=1.0)
NG = Net(gust_rows, ez=20.0, cw=0.5)

out = {}
for zc, z in Zs.items():
    o = {}
    # rain: inverse distance weighting of the three nearest stations (weight 1 / (d_eff + 1)^2)
    v, nn = NR.idw(z, 'rain')
    o['rain_in'] = rnd(v, 1)
    mv = [NR.idw(z, 'm%d' % k)[0] for k in range(1, 13)]
    o['rain_m'] = [rnd(x, 2) for x in mv]
    wm = int(np.argmax(mv)) + 1
    o['rain_wet_m'] = wm; o['rain_wet_in'] = rnd(mv[wm - 1], 1)
    i, d, dz, de = nn[0]
    o['rain_st'] = rain_rows[i]['name']; o['rain_km'] = rnd(d, 0); o['rain_dz'] = rnd(dz, 0); o['rain_q'] = qflag(de, (15, 30, 60))
    v1, n1 = ND.idw(z, 'd1'); v2, _ = ND.idw(z, 'd2')
    o['rain_d1'] = rnd(v1, 1); o['rain_d2'] = rnd(v2, 2)
    o['raind_q'] = qflag(n1[0][3], (15, 30, 60)); o['raind_km'] = rnd(n1[0][1], 0)
    i, d, dz, de = NREC.near(z, 1)[0]
    o['rain_rec_in'] = rnd(rec_rows[i]['rec'], 2); o['rain_rec_date'] = rec_rows[i]['date']; o['rain_rec_st'] = rec_rows[i]['name']; o['rain_rec_km'] = rnd(d, 0)
    o['rain_rec_yrs'] = rec_rows[i]['yrs']; o['rain_rec_q'] = qflag(de, (15, 30, 60))
    # heat
    v100, nn = NH.idw(z, 'h100'); v110, _ = NH.idw(z, 'h110'); v90, _ = NH.idw(z, 'h90')
    o['h90'] = rnd(v90, 1); o['h100'] = rnd(v100, 1); o['h110'] = rnd(v110, 2)
    i, d, dz, de = nn[0]
    o['heat_st'] = heat_rows[i]['name']; o['heat_km'] = rnd(d, 0); o['heat_dz'] = rnd(dz, 0); o['heat_q'] = qflag(de, (15, 30, 60)); o['heat_yrs'] = heat_rows[i]['n']
    o['heat_rec_f'] = rnd(heat_rows[i]['rec'], 0) if heat_rows[i]['rec'] is not None else None; o['heat_rec_date'] = heat_rows[i]['recd']
    vj, nj = NJ.idw(z, 'tjul')
    o['tjul'] = rnd(vj, 1); o['tjul_q'] = qflag(nj[0][3], (15, 30, 60))
    # gusts: the nearest screened station only (wind is too local to blend)
    i, d, dz, de = NG.near(z, 1)[0]
    g = gust_rows[i]
    o['g40'] = rnd(g['g40'], 1); o['g58'] = rnd(g['g58'], 2); o['g75'] = rnd(g['g75'], 2)
    # screened station maxima above 101 mph are withheld: the sources file calls them doubtful (Bicycle Lake 124, Point Mugu 121)
    ok = g['max'] is not None and g['max'] <= 101
    o['gust_max'] = rnd(g['max'], 0) if ok else None; o['gust_max_date'] = (g['maxd'] or None) if ok else None
    o['gust_st'] = g['name']; o['gust_km'] = rnd(d, 0); o['gust_dz'] = rnd(dz, 0); o['gust_yrs'] = g['n']; o['gust_q'] = qflag(de, (10, 25, 50))
    out[zc] = o

jdump(out, os.path.join(WORK, 'zcta_station.json'))
jdump({'rain': rain_rows, 'days': day_rows, 'rec': rec_rows, 'heat': heat_rows, 'gust': gust_rows, 'jul': jul_rows}, os.path.join(WORK, 'stations_used.json'))
import collections
for k in ('rain_q', 'raind_q', 'rain_rec_q', 'heat_q', 'gust_q'):
    print(k, sorted(collections.Counter(o[k] for o in out.values()).items()))
for zc in ('95501', '92328', '93546', '91502', '92676', '90272', '95969', '94102', '92262', '96161', '95814', '93401'):
    o = out[zc]
    print(zc, Zs[zc].get('po_name'), {k: o[k] for k in ('rain_in', 'rain_wet_m', 'rain_d1', 'rain_d2', 'rain_rec_in', 'rain_rec_date', 'rain_st', 'rain_km', 'rain_q', 'h100', 'h110', 'heat_st', 'heat_km', 'heat_q', 'tjul', 'g40', 'g58', 'g75', 'gust_max', 'gust_st', 'gust_km', 'gust_q')})
