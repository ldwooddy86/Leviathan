#!/usr/bin/env python3
"""ZCTA base table: county, region, centre, area, distance to salt water, elevation (mean, range) from terrarium tiles.
Network: AWS terrarium elevation tiles at zoom 10 (cached in work/terrarium). Run: python3 -I 01_zcta_base.py"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hazlib import *
import urllib.request, io, concurrent.futures as cf
import numpy as np
import shapely
from shapely.geometry import shape, LineString, MultiLineString, Point
from shapely.ops import unary_union

Z = 10
TD = os.path.join(WORK, 'terrarium', str(Z)); os.makedirs(TD, exist_ok=True)
UA = {'User-Agent': 'roof-weather-atlas/1.0'}


def lonlat_to_tile(lon, lat, z=Z):
    n = 2 ** z
    x = (lon + 180.0) / 360.0 * n
    y = (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n
    return x, y


def fetch(xy):
    x, y = xy
    p = os.path.join(TD, '%d_%d.png' % (x, y))
    if os.path.exists(p) and os.path.getsize(p) > 100:
        return True
    url = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/%d/%d/%d.png' % (Z, x, y)
    for k in range(4):
        try:
            b = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read()
            open(p, 'wb').write(b)
            return True
        except Exception as e:
            time.sleep(1 + k)
    return False


_cache = {}


def tile(x, y):
    k = (x, y)
    if k not in _cache:
        from PIL import Image
        p = os.path.join(TD, '%d_%d.png' % (x, y))
        try:
            a = np.asarray(Image.open(p).convert('RGB'), dtype=np.float32)
            _cache[k] = a[:, :, 0] * 256 + a[:, :, 1] + a[:, :, 2] / 256 - 32768
        except Exception:
            _cache[k] = None
        if len(_cache) > 400:
            for kk in list(_cache)[:200]:
                del _cache[kk]
    return _cache[k]


def coastline():
    """Salt water shore: the Census cartographic state outline (it follows the Pacific shore and cuts out San Francisco,
    San Pablo and Suisun bays, Humboldt, Tomales, Morro, San Diego and other bays, and the islands) with the land borders
    removed: any outline segment within 4 km of Oregon, Nevada or Arizona (5m outlines), and within 1.5 km of the Mexican border line."""
    st = shape(jload(os.path.join(GEO, 'ca_state_2024_500k.geojson'))['features'][0]['geometry'])
    nb = unary_union([shape(f['geometry']) for f in jload(os.path.join(GEO, 'ca_neighbors_2024_5m.geojson'))['features']])
    mex = to_albers(LineString([(-117.125, 32.534), (-114.719, 32.7186)])).buffer(1500)
    cut = to_albers(nb).buffer(4000).union(mex)
    polys = st.geoms if hasattr(st, 'geoms') else [st]
    ml = to_albers(MultiLineString([list(pg.exterior.coords) for pg in polys]))
    ml = ml.difference(cut)
    return ml


def main():
    Zs = load_zctas()
    log('zctas', len(Zs))
    # ---- coast distance
    coast = coastline()
    shapely.prepare(coast)
    log('coast length km', round(coast.length / 1000))
    open(os.path.join(WORK, 'coast_albers.wkb'), 'wb').write(shapely.to_wkb(coast))
    T = albers()
    # town point: the GeoNames postal point of the ZIP (post office or settlement) when it lies in or within 2 km of the
    # ZCTA, else the Census internal point. Stations, elevation at the town and coast distance use this point, because the
    # internal point of a large mountain or desert ZCTA can sit far from (and far above) its homes.
    gn = {}
    for ln in open(os.path.join(PEOPLE, 'xwalk', 'raw', 'geonames_US', 'US.txt'), encoding='utf-8'):
        f = ln.rstrip('\n').split('\t')
        if len(f) > 10 and f[4] == 'CA':
            gn[f[1]] = (float(f[9]), float(f[10]), f[2])
    ntown = 0
    for z, d in Zs.items():
        gA = to_albers(d['geom'])
        d['_gA'] = gA
        d['ilat'], d['ilon'] = d['lat'], d['lon']
        d['pt_src'] = 'census'
        if z in gn:
            x, y = T(gn[z][1], gn[z][0])
            if gA.distance(Point(x, y)) <= 2000:
                d['lat'], d['lon'], d['pt_src'] = gn[z][0], gn[z][1], 'geonames'; ntown += 1
            d['po_name'] = gn[z][2]
        x, y = T(d['lon'], d['lat'])
        d['coast_km'] = round(Point(x, y).distance(coast) / 1000, 1)
        d['coast_min_km'] = round(gA.distance(coast) / 1000, 1)
        d['area_km2'] = round(gA.area / 1e6, 2)
    # ---- elevation tiles
    need = set()
    for d in Zs.values():
        minx, miny, maxx, maxy = d['geom'].bounds
        x0, y0 = lonlat_to_tile(minx, maxy); x1, y1 = lonlat_to_tile(maxx, miny)
        for x in range(int(x0), int(x1) + 1):
            for y in range(int(y0), int(y1) + 1):
                need.add((x, y))
    log('tiles needed', len(need))
    with cf.ThreadPoolExecutor(8) as ex:
        ok = list(ex.map(fetch, sorted(need)))
    log('tiles fetched', sum(ok), 'failed', len(ok) - sum(ok))
    nfail = 0
    for i, (z, d) in enumerate(Zs.items()):
        g = d['geom']
        minx, miny, maxx, maxy = g.bounds
        fx0, fy0 = lonlat_to_tile(minx, maxy); fx1, fy1 = lonlat_to_tile(maxx, miny)
        px0, py0, px1, py1 = int(fx0 * 256), int(fy0 * 256), int(fx1 * 256) + 1, int(fy1 * 256) + 1
        step = max(1, int(math.sqrt((px1 - px0) * (py1 - py0) / 60000.0)))
        xs = np.arange(px0, px1 + 1, step); ys = np.arange(py0, py1 + 1, step)
        X, Y = np.meshgrid(xs, ys)
        n = 2 ** Z * 256
        lon = (X + 0.5) / n * 360 - 180
        lat = np.degrees(np.arctan(np.sinh(np.pi * (1 - 2 * (Y + 0.5) / n))))
        m = shapely.contains_xy(g, lon, lat)
        if m.sum() < 4:  # tiny ZCTA: take the pixels around the centre
            cx, cy = lonlat_to_tile(d['lon'], d['lat'])
            X = np.array([[int(cx * 256) + dx for dx in (-1, 0, 1)] for dy in (-1, 0, 1)]); Y = np.array([[int(cy * 256) + dy for dx in (-1, 0, 1)] for dy in (-1, 0, 1)])
            m = np.ones(X.shape, bool)
        vals = []
        Xs, Ys = X[m], Y[m]
        tx, ty = Xs // 256, Ys // 256
        for k in set(zip(tx.tolist(), ty.tolist())):
            a = tile(*k)
            if a is None:
                continue
            sel = (tx == k[0]) & (ty == k[1])
            vals.append(a[Ys[sel] % 256, Xs[sel] % 256])
        if vals:
            v = np.concatenate(vals)
            if d['coast_min_km'] < 5:  # the tiles carry sea floor depths: water inside a coastal ZCTA counts as 0 m
                v = np.maximum(v, 0)
            d['elev_mean_m'] = int(round(float(v.mean()))); d['elev_min_m'] = int(round(float(v.min()))); d['elev_max_m'] = int(round(float(v.max())))
            d['elev_p10_m'] = int(round(float(np.percentile(v, 10)))); d['elev_p90_m'] = int(round(float(np.percentile(v, 90)))); d['elev_n'] = int(v.size)
        else:
            nfail += 1
            for k in ('elev_mean_m', 'elev_min_m', 'elev_max_m', 'elev_p10_m', 'elev_p90_m'):
                d[k] = None
            d['elev_n'] = 0
        cx, cy = lonlat_to_tile(d['lon'], d['lat'])
        a = tile(int(cx), int(cy))
        d['elev_pt_m'] = None if a is None else int(round(float(a[int(cy * 256) % 256, int(cx * 256) % 256])))
        if i % 300 == 0:
            log('elev', i, z, d.get('elev_mean_m'))
    log('no elevation for', nfail, 'town points from geonames', ntown)
    out = {}
    for z, d in Zs.items():
        out[z] = {k: v for k, v in d.items() if k not in ('geom', '_gA')}
    n = jdump(out, os.path.join(WORK, 'zcta_base.json'))
    log('wrote zcta_base.json', n)
    for z in ('95969', '90272', '91001', '93546', '92328', '95501', '94102', '96161', '92314'):
        if z in out:
            print(z, out[z])


if __name__ == '__main__':
    main()
