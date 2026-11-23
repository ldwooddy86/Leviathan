"""Shared helpers for the California hazard build. Import with:
    import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); from hazlib import *
All scripts run as `python3 -I NN_name.py` from any directory."""
import os, sys, json, csv, gzip, math, time

HERE = os.path.dirname(os.path.abspath(__file__))
CA = os.path.dirname(os.path.dirname(HERE))
H = os.path.join(CA, 'dl', 'hazard')
PEOPLE = os.path.join(CA, 'dl', 'people')
GEO = os.path.join(PEOPLE, 'geo', 'raw', 'ca')
OUT = os.path.join(HERE, 'out')
WORK = os.path.join(HERE, 'work')
for _d in (OUT, WORK):
    os.makedirs(_d, exist_ok=True)

COMPILED = '2026-11-19'

# the eleven regions of DESIGN.md
REGIONS = {
    'nc': ('North Coast', ['Del Norte', 'Humboldt', 'Mendocino', 'Lake']),
    'fn': ('Far North', ['Siskiyou', 'Modoc', 'Shasta', 'Lassen', 'Tehama', 'Trinity', 'Plumas']),
    'sv': ('Sacramento Valley', ['Butte', 'Glenn', 'Colusa', 'Sutter', 'Yuba', 'Yolo', 'Sacramento', 'Placer', 'El Dorado']),
    'si': ('Sierra', ['Sierra', 'Nevada', 'Amador', 'Calaveras', 'Tuolumne', 'Mariposa', 'Alpine', 'Mono', 'Inyo']),
    'ba': ('Bay Area', ['Alameda', 'Contra Costa', 'Marin', 'Napa', 'San Francisco', 'San Mateo', 'Santa Clara', 'Solano', 'Sonoma']),
    'cc': ('Central Coast', ['Santa Cruz', 'San Benito', 'Monterey', 'San Luis Obispo', 'Santa Barbara']),
    'sj': ('San Joaquin Valley', ['San Joaquin', 'Stanislaus', 'Merced', 'Madera', 'Fresno', 'Kings', 'Tulare', 'Kern']),
    'la': ('Los Angeles and Ventura', ['Los Angeles', 'Ventura']),
    'oc': ('Orange County', ['Orange']),
    'ie': ('Inland Empire', ['Riverside', 'San Bernardino']),
    'sd': ('San Diego and Imperial', ['San Diego', 'Imperial']),
}
REG_KEYS = list(REGIONS)
COUNTY_REG = {c: k for k, (n, cs) in REGIONS.items() for c in cs}
# three broad belts for the monthly rain vectors (my grouping, by region)
BELT = {'nc': 'north', 'fn': 'north', 'sv': 'north', 'si': 'north', 'ba': 'central', 'cc': 'central', 'sj': 'central',
        'la': 'south', 'oc': 'south', 'ie': 'south', 'sd': 'south'}


def jdump(obj, path, indent=None):
    tmp = path + '.tmp'
    with open(tmp, 'w') as f:
        json.dump(obj, f, separators=(',', ':') if indent is None else None, indent=indent, ensure_ascii=False)
    os.replace(tmp, path)
    return os.path.getsize(path)


def jload(path):
    with open(path) as f:
        return json.load(f)


def rcsv(path):
    op = gzip.open if path.endswith('.gz') else open
    with op(path, 'rt', newline='', encoding='utf-8', errors='replace') as f:
        return list(csv.DictReader(f))


def fnum(x, d=None):
    try:
        v = float(x)
        return d if v != v else v
    except Exception:
        return d


def hav_km(lat1, lon1, lat2, lon2):
    p = math.pi / 180
    a = math.sin((lat2 - lat1) * p / 2) ** 2 + math.cos(lat1 * p) * math.cos(lat2 * p) * math.sin((lon2 - lon1) * p / 2) ** 2
    return 12742.0 * math.asin(math.sqrt(a))


def rnd(x, n=1):
    if x is None:
        return None
    v = round(float(x), n)
    return int(v) if n == 0 else v


_T = None


def albers():
    """lon/lat (NAD83/WGS84) -> California Albers metres (EPSG:3310), as a function for shapely.ops.transform."""
    global _T
    if _T is None:
        from pyproj import Transformer
        _T = Transformer.from_crs('EPSG:4326', 'EPSG:3310', always_xy=True)
    return _T.transform


def to_albers(geom):
    from shapely.ops import transform
    return transform(albers(), geom)


def load_zctas(with_geom=True):
    """All 1,808 ZCTAs that touch California: dict zcta -> {zcta, fips, county, reg, lat, lon, aland, in_ca, geom}."""
    from shapely.geometry import shape
    xw = {r['zcta']: r for r in rcsv(os.path.join(PEOPLE, 'xwalk', 'raw', 'ca_zcta_crosswalk.csv'))}
    parts = rcsv(os.path.join(PEOPLE, 'xwalk', 'raw', 'ca_zcta_county_parts.csv'))
    out = {}
    gj = jload(os.path.join(GEO, 'ca_zcta520_2020_500k.geojson'))
    cn = {f['properties']['GEOID']: f['properties']['NAME'] for f in jload(os.path.join(GEO, 'ca_county_2024_5m.geojson'))['features']}
    best = {}
    for p in parts:
        z = p['zcta']
        fips = p['county_fips']
        if not fips.startswith('06'):
            continue
        a = fnum(p.get('arealand_part'), 0)
        if z not in best or a > best[z][1]:
            best[z] = (fips, a)
    for f in gj['features']:
        z = f['properties']['ZCTA5CE20']
        r = xw.get(z, {})
        fips = r.get('county_fips', '')
        if not fips.startswith('06'):
            fips = best.get(z, (fips, 0))[0]  # largest California part for the cross-state ZCTAs
        name = cn.get(fips, r.get('county_name', '').replace(' County', ''))
        d = {'zcta': z, 'fips': fips, 'county': name, 'reg': COUNTY_REG.get(name), 'lat': fnum(r.get('lat')), 'lon': fnum(r.get('lon')),
             'aland': fnum(r.get('aland_m2'), f['properties']['ALAND20']), 'in_ca': int(r.get('in_ca', '1') or 1)}
        if with_geom:
            g = shape(f['geometry'])
            if not g.is_valid:
                g = g.buffer(0)
            d['geom'] = g
            if d['lat'] is None:
                c = g.representative_point(); d['lat'], d['lon'] = c.y, c.x
        out[z] = d
    return out


# ---- the atlas map path format (contract_core section 3.3): M x y then relative "l dx dy", integers, z to close ----
def proj_xy(lon, lat, geo):
    return ((lon - geo['minx']) * geo['kx'] * geo['sx'], (geo['maxy'] - lat) * geo['sx'])


def encode_path(rings, geo, close=True):
    """rings: list of [[lon, lat], ...]; geo: {minx, maxy, kx, sx}. Returns the atlas path string."""
    out = []
    for ring in rings:
        pts = []
        for lon, lat in ring:
            x, y = proj_xy(lon, lat, geo)
            p = (int(round(x)), int(round(y)))
            if not pts or p != pts[-1]:
                pts.append(p)
        if close and len(pts) > 1 and pts[0] == pts[-1]:
            pts.pop()
        if len(pts) < (3 if close else 2):
            continue
        s = 'M%d %d' % pts[0]
        for a, b in zip(pts, pts[1:]):
            s += 'l%d %d' % (b[0] - a[0], b[1] - a[1])
        out.append(s + ('z' if close else ''))
    return ''.join(out)


# provisional projection constants, used only until CA/data/SCHEMA.md fixes the real ones (same formula as Louisiana:
# kx = cos(standard parallel), sx = W / ((maxx - minx) * kx)).
def provisional_geo(W=2400.0):
    minx, maxx, maxy, miny = -124.55, -114.05, 42.05, 32.45
    kx = math.cos(math.radians(37.25))
    sx = W / ((maxx - minx) * kx)
    return {'W': W, 'H': int(math.ceil((maxy - miny) * sx)), 'minx': minx, 'maxy': maxy, 'kx': kx, 'sx': sx, 'provisional': True}


def load_geo():
    """Projection constants: from the data job's output when it exists, else provisional."""
    for p in (os.path.join(CA, 'data', 'out', 'ca_atlas_data.json'), os.path.join(CA, 'data', 'out', 'geo.json'), os.path.join(CA, 'data', 'work', 'geo.json')):
        if os.path.exists(p) and os.path.getsize(p) < 400e6:
            try:
                d = jload(p)
                g = d.get('geo', d)
                if all(k in g for k in ('minx', 'maxy', 'kx', 'sx')):
                    return {k: g[k] for k in ('W', 'H', 'minx', 'maxy', 'kx', 'sx') if k in g}
            except Exception:
                pass
    return provisional_geo()


def log(*a):
    print(time.strftime('%H:%M:%S'), *a, flush=True)


# ---------------- NOAA Storm Events (California extract) ----------------
_MON = {m: i + 1 for i, m in enumerate(['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'])}


def _dmg(s):
    s = (s or '').strip().upper()
    if not s:
        return 0.0
    mult = {'K': 1e3, 'M': 1e6, 'B': 1e9, 'H': 1e2}.get(s[-1])
    try:
        return float(s[:-1] or 0) * mult if mult else float(s)
    except Exception:
        return 0.0


def load_stormevents():
    """List of dicts: one per California Storm Events row 1950-2026, parsed. Times are local standard time as NOAA files them."""
    import datetime
    rows = []
    for q in rcsv(os.path.join(H, 'stormevents', 'CA_StormEvents_details_1950_2026.csv.gz')):
        try:
            ym = q['BEGIN_YEARMONTH']; t = q['BEGIN_TIME'].zfill(4)
            b = datetime.datetime(int(ym[:4]), int(ym[4:6]), int(q['BEGIN_DAY']), min(23, int(t[:-2] or 0)), min(59, int(t[-2:])))
            ym = q['END_YEARMONTH']; t = q['END_TIME'].zfill(4)
            e = datetime.datetime(int(ym[:4]), int(ym[4:6]), int(q['END_DAY']), min(23, int(t[:-2] or 0)), min(59, int(t[-2:])))
        except Exception:
            continue
        mag = fnum(q['MAGNITUDE'])
        rows.append({'id': q['EVENT_ID'], 'ep': q['EPISODE_ID'], 'type': q['EVENT_TYPE'], 'b': b, 'e': max(b, e), 'y': b.year, 'm': b.month, 'czt': q['CZ_TYPE'],
                     'czf': int(q['CZ_FIPS'] or 0), 'czn': q['CZ_NAME'], 'wfo': q['WFO'], 'dmg': _dmg(q['DAMAGE_PROPERTY']), 'dd': int(q['DEATHS_DIRECT'] or 0),
                     'di': int(q['DEATHS_INDIRECT'] or 0), 'mag': mag, 'magt': q['MAGNITUDE_TYPE'], 'lat': fnum(q['BEGIN_LAT']), 'lon': fnum(q['BEGIN_LON']),
                     'loc': q['BEGIN_LOCATION'], 'src': q['SOURCE'], 'en': q['EVENT_NARRATIVE'], 'pn': q['EPISODE_NARRATIVE'], 'tor': q['TOR_F_SCALE']})
    return rows


def _nz(s):
    import re
    return re.sub(r'[^a-z0-9]+', ' ', (s or '').lower()).replace(' county', '').strip()


class ZoneIndex:
    """Dated NWS zone and county outlines (IEM history, half year snapshots 2005-2026) and which ZCTA town points fall in each."""

    def __init__(self, zctas=None):
        from shapely.geometry import shape
        import shapely
        import numpy as np
        fc = jload(os.path.join(H, 'nws_zones', 'CA_ugc_history_iem_2005_2026.geojson'))['features']
        self.v = []
        self.by = {}
        self.byname = {}
        for i, f in enumerate(fc):
            p = f['properties']
            g = shape(f['geometry'])
            if not g.is_valid:
                g = g.buffer(0)
            self.v.append({'i': i, 'ugc': p['ugc'], 'name': p['name'], 'wfo': p['wfo'], 'first': p['first_snapshot'], 'last': p['last_snapshot'], 'geom': g,
                           'clat': p['centroid_lat'], 'clon': p['centroid_lon'], 'ilat': p.get('inside_pt_lat'), 'ilon': p.get('inside_pt_lon'),
                           'counties': [(c.split()[0], int(c.split()[-1].rstrip('%') or 0)) for c in (p.get('counties') or '').replace(';', ',').split(',') if c.strip()]})
            self.by.setdefault(p['ugc'], []).append(i)
            self.byname.setdefault(_nz(p['name']), []).append(i)
        self.zl = None
        if zctas is not None:
            keys = list(zctas)
            pts = shapely.points([zctas[k]['lon'] for k in keys], [zctas[k]['lat'] for k in keys])
            tree = shapely.STRtree(pts)
            self.zl = []
            for v in self.v:
                idx = tree.query(v['geom'], predicate='contains')
                self.zl.append(sorted(int(i) for i in idx))
            self.keys = keys

    def find(self, czt, czf, czn, date, wfo=None):
        """Index of the outline version for a Storm Events county/zone code and name at a date, or None."""
        ugc = 'CA%s%03d' % ('C' if czt == 'C' else 'Z', czf)
        ds = date.strftime('%Y-%m-%d')
        cand = self.by.get(ugc, [])
        nm = _nz(czn)
        if czt == 'C':
            return cand[0] if cand else None
        if ds >= '2005-01-01':
            ok = [i for i in cand if self.v[i]['first'] <= ds and ds <= self.v[i]['last'][:4] + ('-12-31' if self.v[i]['last'][5:7] == '07' else '-06-30')]
            if len(ok) > 1:
                ok2 = [i for i in ok if _nz(self.v[i]['name']) == nm]
                ok = ok2 or ok
            if ok:
                return ok[0]
            # between snapshots: nearest version in time for that code
            if cand:
                same = [i for i in cand if _nz(self.v[i]['name']) == nm]
                if same:
                    return min(same, key=lambda i: abs(int(self.v[i]['first'][:4]) - date.year))
        # before the archive (or no dated match): accept only an outline whose name equals the event's zone name and,
        # when the caller gives the record's office, whose office is the same (the 1996 files carry wrong zone names)
        same = [i for i in cand if _nz(self.v[i]['name']) == nm] or self.byname.get(nm, [])
        if wfo:
            same = [i for i in same if self.v[i]['wfo'] == wfo]
        if same:
            return min(same, key=lambda i: self.v[i]['first'])
        return None
