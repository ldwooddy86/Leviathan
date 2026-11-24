# Provinces and the coast line for the Scout tab's terrain block.
# Sources (fetched 2026-11-19, kept in dl/):
#   California Geological Survey, "GeoGems: Geomorphic Provinces" (layer 2 of
#     https://gis.conservation.ca.gov/server/rest/services/CGS/GeoGems/MapServer): the Survey's own outlines of the
#     eleven geomorphic provinces of CGS Note 36, plus its two coastline sub-provinces (thin strips along the shore,
#     folded here into the province behind them).
#   Census cartographic boundary 2024 (1:500,000): the state outline.
#   Natural Earth 1:10m coastline (public domain): the line "distance to the coast" is measured to.
# Output: topo_prov.js (window.__SCOUT_TOPO_PROV__) and work/prov.geojson for checking.
# python3 -I build_prov.py
import json, math, os, sys
from shapely.geometry import shape, Polygon, MultiPolygon, LineString, MultiLineString, box, mapping
from shapely.ops import unary_union
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from shpread import read_shp, read_dbf, to_shapely
TOL = 0.006                                                             # simplification, degrees (about 600 m)

st = os.path.join(HERE, '../../dl/people/geo/raw/cb_2024_us_state_500k/cb_2024_us_state_500k')
CA = [to_shapely(s) for r, s in zip(read_dbf(st + '.dbf'), read_shp(st + '.shp')) if r.get('STUSPS') == 'CA'][0].buffer(0)
CAs = CA.simplify(0.004)

raw = {}
for f in json.load(open(os.path.join(HERE, 'dl/prov/cgs_geomorphic.geojson')))['features']:
    raw[f['properties']['RANGE_NAME']] = shape(f['geometry']).buffer(0)
NOTE = {'Klamath Mountains': 22, 'Cascade Range': 24, 'Modoc Plateau': 26, 'Coast Ranges': 3, 'Great Valley': 28, 'Sierra Nevada': 30, 'Basin and Range': 36,
        'Transverse Ranges': 39, 'Mojave Desert': 43, 'Peninsular Ranges': 46, 'Colorado Desert': 53}
strips = [g for n, g in raw.items() if 'Coastline' in n]
provs = {n: g for n, g in raw.items() if 'Coastline' not in n}
assert sorted(provs) == sorted(NOTE), sorted(provs)
# A coastline strip runs the length of the shore past several provinces (the southern one from Point Conception to the
# border, wide enough to hold Santa Barbara, Ventura and Oxnard). It is cut into cells of 0.05 degree and each cell
# joins the province nearest to it (on land only), so the Santa Barbara and Ventura coast goes to the Transverse
# Ranges and the Los Angeles and San Diego coast to the Peninsular Ranges, as CGS Note 36 describes them.
from shapely.geometry import box
base = dict(provs); add = {n: [] for n in provs}; CELL = 0.05
for sg in strips:
    sg = sg.intersection(CAs.buffer(0.01))
    if sg.is_empty: continue
    x0, y0, x1, y1 = sg.bounds
    i = 0
    while x0 + i * CELL < x1:
        j = 0
        while y0 + j * CELL < y1:
            cell = sg.intersection(box(x0 + i * CELL, y0 + j * CELL, x0 + (i + 1) * CELL, y0 + (j + 1) * CELL)); j += 1
            if cell.is_empty or cell.area < 1e-8: continue
            best = min(base, key=lambda n: cell.distance(base[n]))
            add[best].append(cell.buffer(0.0005))
        i += 1
from shapely.ops import unary_union
for n in provs:
    if add[n]: provs[n] = unary_union([provs[n]] + add[n]).buffer(0)
P = [(n, 'CGS GeoGem Note %d' % NOTE[n], provs[n].intersection(CAs.buffer(0.02))) for n in ('Klamath Mountains', 'Cascade Range', 'Modoc Plateau', 'Coast Ranges', 'Great Valley', 'Sierra Nevada', 'Basin and Range', 'Transverse Ranges', 'Mojave Desert', 'Peninsular Ranges', 'Colorado Desert')]

def clean(g, min_area=0.0006):
    g = g.buffer(0).simplify(TOL)
    polys = [p for p in (g.geoms if isinstance(g, MultiPolygon) else [g]) if isinstance(p, Polygon) and p.area >= min_area]
    return polys

def enc(coords):                                                         # Google's polyline packing at 3 decimals (lat, lon)
    out = []; pl = [0, 0]
    for lo, la in coords:
        for i, v in enumerate((int(round(la * 1000)), int(round(lo * 1000)))):
            d = v - pl[i]; pl[i] = v; d = ~(d << 1) if d < 0 else d << 1
            while d >= 0x20: out.append(chr((0x20 | (d & 0x1f)) + 63)); d >>= 5
            out.append(chr(d + 63))
    return ''.join(out)

out = {'prov': [], 'coast': []}; feats = []
for name, usgs, g in P:
    polys = clean(g)
    big = max(polys, key=lambda p: p.area); rp = big.representative_point()
    out['prov'].append(dict(n=name, u=usgs, la=round(rp.y, 3), lo=round(rp.x, 3), r=[enc(p.exterior.coords) for p in polys]))
    feats.append(dict(type='Feature', properties=dict(n=name, kind='prov'), geometry=mapping(MultiPolygon(polys))))
    print('%-18s pieces %d, points %d, area %.2f' % (name, len(polys), sum(len(p.exterior.coords) for p in polys), sum(p.area for p in polys)))
print('state area %.2f, provinces together %.2f' % (CA.area, sum(shape(f['geometry']).area for f in feats)))

# the coast: Natural Earth's line inside the state's box, the mainland and bay shores (islands left out: a house on the
# mainland is measured to the mainland shore)
bx = box(-124.6, 32.5, -116.9, 42.02); lines = []
for f in json.load(open(os.path.join(HERE, 'dl/ne/coast.geojson')))['features']:
    g = shape(f['geometry'])
    if not g.intersects(bx): continue
    g = g.intersection(bx)
    for l in (g.geoms if isinstance(g, (MultiLineString,)) else [g]):
        if isinstance(l, LineString) and l.length > 0.6: lines.append(l.simplify(0.004))
for l in lines:
    out['coast'].append(enc(l.coords)); feats.append(dict(type='Feature', properties=dict(kind='coast'), geometry=mapping(l)))
print('coast lines', len(lines), 'points', sum(len(l.coords) for l in lines))
out['src'] = dict(prov='California Geological Survey, GeoGems: Geomorphic Provinces (CGS Note 36)', coast='Natural Earth 1:10m coastline')
js = '/* Generated by build_prov.py. Provinces: California Geological Survey geomorphic provinces (CGS Note 36), simplified; coast: Natural Earth 1:10m. Rings are polyline-packed at 3 decimals (lat, lon). */\n'
js += 'window.__SCOUT_TOPO_PROV__ = ' + json.dumps(out, separators=(',', ':')) + ';\n'
open(os.path.join(HERE, 'topo_prov.js'), 'w').write(js)
json.dump(dict(type='FeatureCollection', features=feats), open(os.path.join(HERE, 'work/prov.geojson'), 'w'))
print('wrote topo_prov.js', len(js), 'bytes')
