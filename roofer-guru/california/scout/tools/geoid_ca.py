"""NGS GEOID18 geoid heights on a half degree grid over California, from the National Geodetic Survey's own service
(https://geodesy.noaa.gov/api/geoid/ght). Writes tools/geoid_ca.json: {lat0, lon0, step, nlat, nlon, h: [[...]]} with
null where the service gives no value (open ocean past the model's edge).  python3 -I geoid_ca.py"""
import json, os, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
HERE = os.path.dirname(os.path.abspath(__file__))
LAT0, LON0, STEP, NLAT, NLON = 32.0, -125.0, 0.5, 21, 23
def one(ij):
    i, j = ij; la, lo = LAT0 + i * STEP, LON0 + j * STEP
    for _ in range(3):
        try:
            r = subprocess.run(['curl', '-sS', '-m', '25', 'https://geodesy.noaa.gov/api/geoid/ght?lat=%.4f&lon=%.4f' % (la, lo)], capture_output=True, text=True, timeout=40)
            d = json.loads(r.stdout)
            v = d.get('geoidHeight')
            return (i, j, float(v) if v is not None else None)
        except Exception:
            continue
    return (i, j, None)
with ThreadPoolExecutor(6) as ex:
    res = list(ex.map(one, [(i, j) for i in range(NLAT) for j in range(NLON)]))
h = [[None] * NLON for _ in range(NLAT)]
for i, j, v in res: h[i][j] = v
json.dump({'lat0': LAT0, 'lon0': LON0, 'step': STEP, 'nlat': NLAT, 'nlon': NLON, 'h': h, 'src': 'NGS GEOID18, geodesy.noaa.gov/api/geoid/ght'}, open(os.path.join(HERE, 'geoid_ca.json'), 'w'))
print('points', NLAT * NLON, 'with a value', sum(1 for r in res if r[2] is not None))
