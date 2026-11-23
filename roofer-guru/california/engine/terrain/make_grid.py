"""Makes terrain_grid.js: a small relief grid of California and 125 km round it, carried in the page, so the Scout
Engine has a horizon before any elevation tile arrives and when none can be fetched.

Source: AWS terrarium tiles, zoom 6 (https://s3.amazonaws.com/elevation-tiles-prod/terrarium/6/{x}/{y}.png,
metres = R * 256 + G + B / 256 - 32768). The grid is the zoom 6 pixels themselves (about 1.9 km at 37 north), cropped to
longitude -126.0 to -112.6 and latitude 31.3 to 43.2. The sea is set to 0 (the tiles carry the sea bed); land below sea
level is kept inside the boxes INLAND (Death Valley, the Salton trough, the Delta), the same rule the engine applies to
the tiles it fetches. Heights are in steps of Q metres, stored as differences from the pixel to the left (the first of a row
from the one above), zigzag, one to three bytes each (a 0 byte is followed by one more: how many pixels in a row, less one, do not change), then base64.

  python3 -I make_grid.py [cache_dir]     writes terrain_grid.js beside this file; tiles are kept in cache_dir
"""
import sys, os, io, math, base64, json, urllib.request
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'grid_cache')
Z = 6
Q = 4          # metres to a step
W, E, N, S = -126.0, -112.6, 43.2, 31.3
INLAND = [(35.5, 37.1, -117.7, -116.2), (32.2, 33.95, -116.45, -114.9), (37.6, 38.45, -121.95, -121.2)]   # s, n, w, e

def lon2p(lo): return (lo + 180.0) / 360.0 * (256 << Z)
def lat2p(la):
    r = math.radians(la); return (1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * (256 << Z)
def p2lon(x): return x / (256 << Z) * 360.0 - 180.0
def p2lat(y): return math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / (256 << Z)))))

def tile(x, y):
    os.makedirs(CACHE, exist_ok=True)
    p = os.path.join(CACHE, '%d_%d_%d.png' % (Z, x, y))
    if not os.path.exists(p):
        url = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/%d/%d/%d.png' % (Z, x, y)
        with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'grid-builder'}), timeout=60) as r: data = r.read()
        with open(p, 'wb') as f: f.write(data)
    a = np.asarray(Image.open(p).convert('RGB'), dtype=np.float64)
    return a[:, :, 0] * 256 + a[:, :, 1] + a[:, :, 2] / 256 - 32768

x0, x1 = int(math.floor(lon2p(W))), int(math.ceil(lon2p(E)))
y0, y1 = int(math.floor(lat2p(N))), int(math.ceil(lat2p(S)))
w, h = x1 - x0, y1 - y0
tx0, tx1, ty0, ty1 = x0 >> 8, (x1 - 1) >> 8, y0 >> 8, (y1 - 1) >> 8
mos = np.zeros(((ty1 - ty0 + 1) * 256, (tx1 - tx0 + 1) * 256))
for ty in range(ty0, ty1 + 1):
    for tx in range(tx0, tx1 + 1):
        mos[(ty - ty0) * 256:(ty - ty0 + 1) * 256, (tx - tx0) * 256:(tx - tx0 + 1) * 256] = tile(tx, ty)
g = mos[y0 - ty0 * 256:y1 - ty0 * 256, x0 - tx0 * 256:x1 - tx0 * 256].copy()
lons = np.array([p2lon(x0 + i + 0.5) for i in range(w)]); lats = np.array([p2lat(y0 + j + 0.5) for j in range(h)])
inl = np.zeros((h, w), dtype=bool)
for (s, n, we, ea) in INLAND:
    inl |= ((lats[:, None] >= s) & (lats[:, None] <= n)) & ((lons[None, :] >= we) & (lons[None, :] <= ea))
g[(g < 0) & ~inl] = 0
g[g < -90] = -90          # the coarse tiles dip below California's lowest ground (-86 m) in places
q = np.rint(g / Q).astype(np.int32)
out = bytearray(); run = 0
def flush():
    global run
    while run > 0:
        k = min(run, 256); out.append(0); out.append(k - 1); run -= k
for j in range(h):
    for i in range(w):
        prev = q[j, i - 1] if i else (q[j - 1, 0] if j else 0)
        d = int(q[j, i] - prev); u = (d << 1) ^ (d >> 31)
        if u == 0: run += 1; continue
        flush()
        while True:
            b = u & 0x7f; u >>= 7
            if u: out.append(b | 0x80)
            else: out.append(b); break
flush()
b64 = base64.b64encode(bytes(out)).decode('ascii')
meta = {'z': Z, 'q': Q, 'x0': x0, 'y0': y0, 'w': w, 'h': h, 'min': int(q.min()) * Q, 'max': int(q.max()) * Q}
js = ("  /* California's relief, carried in the page: zoom 6 pixels of the AWS terrarium tiles (about 1.9 km), in steps of 4 m, the sea at 0.\n"
      "     Made by engine/terrain/make_grid.py; " + json.dumps(meta) + " */\n"
      "  SE.TERRAIN_GRID = { z: %d, q: %d, x0: %d, y0: %d, w: %d, h: %d, d: '%s' };\n" % (Z, Q, x0, y0, w, h, b64))
with open(os.path.join(HERE, 'terrain_grid.js'), 'w', encoding='utf-8') as f: f.write(js)
print('grid', meta, 'bytes', len(out), 'base64', len(b64))
# a few known places, read back from the grid (nearest pixel)
for name, la, lo in [('Mount Whitney', 36.5786, -118.2920), ('Badwater', 36.2297, -116.7672), ('Lake Tahoe', 39.0968, -120.0324), ('Los Angeles City Hall', 34.0537, -118.2427), ('Mount Shasta', 41.4092, -122.1949), ('Salton Sea', 33.3, -115.8), ('Pacific off Monterey', 36.6, -122.4)]:
    i, j = int(lon2p(lo)) - x0, int(lat2p(la)) - y0
    print('  %-24s %6d m' % (name, q[j, i] * Q))
