# A small reader for polygon shapefiles (.shp + .dbf), enough for the Census and USGS files used here.
import struct


def read_dbf(path):
    f = open(path, 'rb'); h = f.read(32); n, hl, rl = struct.unpack('<IHH', h[4:12]); flds = []
    while True:
        d = f.read(32)
        if d[0] == 0x0d: break
        flds.append((d[:11].split(b'\0')[0].decode(), d[16]))
    f.seek(hl); out = []
    for _ in range(n):
        r = f.read(rl); o = 1; row = {}
        for nm, l in flds:
            row[nm] = r[o:o + l].decode('latin1').strip(); o += l
        out.append(row)
    return out


def read_shp(path):
    """Yields a list of rings (each a list of (x, y)) per record; None for a null shape."""
    b = open(path, 'rb').read(); o = 100; out = []
    while o < len(b):
        _, clen = struct.unpack('>ii', b[o:o + 8]); o += 8; rec = b[o:o + clen * 2]; o += clen * 2
        st = struct.unpack('<i', rec[:4])[0]
        if st not in (5, 15, 25):
            out.append(None); continue
        nparts, npts = struct.unpack('<ii', rec[36:44])
        parts = list(struct.unpack('<%di' % nparts, rec[44:44 + 4 * nparts])) + [npts]
        p0 = 44 + 4 * nparts
        pts = struct.unpack('<%dd' % (2 * npts), rec[p0:p0 + 16 * npts])
        out.append([[(pts[2 * i], pts[2 * i + 1]) for i in range(parts[k], parts[k + 1])] for k in range(nparts)])
    return out


def to_shapely(rings):
    """Rings to a shapely (multi)polygon: shapefile outer rings are clockwise, holes counter-clockwise."""
    from shapely.geometry import Polygon
    from shapely.ops import unary_union
    def area2(r): return sum(r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1] for i in range(len(r) - 1))
    outer = [Polygon(r) for r in rings if len(r) >= 4 and area2(r) < 0]
    holes = [Polygon(r) for r in rings if len(r) >= 4 and area2(r) > 0]
    g = unary_union([p.buffer(0) for p in outer])
    if holes: g = g.difference(unary_union([p.buffer(0) for p in holes]))
    return g
