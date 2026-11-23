# A check picture: the provinces (or any geojson) over the statewide grid's hillshade. python3 -I check_prov.py [geojson] [out.png]
import json, math, os, sys
import numpy as np
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__))
src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'work/prov.geojson')
dst = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, 'work/prov_check.png')
m = json.load(open(os.path.join(HERE, 'work/grid_meta.json'))); ele = np.load(os.path.join(HERE, 'work/grid_ele.npy')).astype(float)
Z = m['z']
def wx(lon): return (lon + 180) / 360 * 256 * 2 ** Z - m['x0']
def wy(lat):
    s = math.sin(math.radians(lat)); return (0.5 - math.log((1 + s) / (1 - s)) / (4 * math.pi)) * 256 * 2 ** Z - m['y0']
gy, gx = np.gradient(ele, 1000.0); sh = np.clip(0.7 + 2.2 * (gx - gy) / math.sqrt(2), 0.15, 1.2)
g = np.clip(sh * 170 + 40, 0, 255).astype(np.uint8); g[ele <= 0] = 205
im = Image.fromarray(np.dstack([g, g, g]), 'RGB'); d = ImageDraw.Draw(im, 'RGBA')
cols = [(230, 60, 60), (60, 130, 230), (40, 170, 80), (230, 160, 30), (160, 70, 200), (30, 180, 190), (220, 90, 160), (120, 120, 40), (90, 90, 220), (200, 120, 60), (60, 60, 60)]
for i, f in enumerate(json.load(open(src))['features']):
    c = cols[i % len(cols)]; gm = f['geometry']; k = f['properties'].get('kind')
    if gm['type'] == 'MultiPolygon':
        for poly in gm['coordinates']:
            pts = [(wx(x), wy(y)) for x, y in poly[0]]
            if k == 'prov': d.polygon(pts, fill=c + (70,), outline=c + (255,))
            else: d.line(pts + pts[:1], fill=(0, 0, 0, 255), width=2)
        if k == 'prov':
            x, y = np.mean([p for poly in gm['coordinates'] for p in poly[0]], axis=0); d.text((wx(x) - 30, wy(y)), f['properties']['n'], fill=(0, 0, 0, 255))
    elif gm['type'] == 'LineString':
        d.line([(wx(x), wy(y)) for x, y in gm['coordinates']], fill=(0, 90, 255, 255), width=2)
    elif gm['type'] == 'Point':
        x, y = gm['coordinates']; d.ellipse([wx(x) - 2, wy(y) - 2, wx(x) + 2, wy(y) + 2], fill=(255, 0, 0, 255)); d.text((wx(x) + 4, wy(y) - 5), f['properties']['n'], fill=(0, 0, 0, 255))
im.save(dst); print(dst, im.size)
