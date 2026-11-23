"""Sky job: the facts the kit carries, cut from the saved sources into one small table (sky_data.js).
   python3 -I build_data.py
   Reads  CA/dl/scout/airports/ca_15_named_airports.json   (OurAirports: runway ends, elevations, displaced thresholds)
          SP/research/ca/engine_txt/bts_ontime_2026_06_hourly.json   (BTS on-time file, June 2026: flights by hour)
          CA/dl/scout/navy/overpass_navy_san_diego_bay.json  (OpenStreetMap: piers, the Coronado Bridge, helipads)
          sky/dl/gg.json, bay.json, vt.json, ggroads.json, vtroads.json   (OpenStreetMap, pulled 19 Nov 2026: bridges)
   Writes sky_data.js: `SE.SKY_DATA = {...};`"""
import json, math, os
HERE = os.path.dirname(os.path.abspath(__file__)); CA = os.path.dirname(os.path.dirname(HERE)); SP = os.path.dirname(CA)
def J(p): return json.load(open(p, encoding='utf-8'))
def r5(v): return round(v, 5)
def dist(a, b):
    k = math.cos(math.radians((a[0] + b[0]) / 2)); return math.hypot((a[0] - b[0]) * 110950, (a[1] - b[1]) * 111320 * k)
def plen(L): return sum(dist(L[i], L[i + 1]) for i in range(len(L) - 1))
def resample(L, n):
    T = [0]
    for i in range(len(L) - 1): T.append(T[-1] + dist(L[i], L[i + 1]))
    out = []; j = 0
    for k in range(n):
        s = T[-1] * k / (n - 1)
        while j < len(L) - 2 and T[j + 1] < s: j += 1
        u = 0 if T[j + 1] == T[j] else (s - T[j]) / (T[j + 1] - T[j]); out.append([L[j][0] + (L[j + 1][0] - L[j][0]) * u, L[j][1] + (L[j + 1][1] - L[j][1]) * u])
    return out
def simplify(L, tol):
    if len(L) < 3: return L
    a, b = L[0], L[-1]; k = math.cos(math.radians(a[0])); ax, ay, bx, by = a[1] * 111320 * k, a[0] * 110950, b[1] * 111320 * k, b[0] * 110950
    dx, dy = bx - ax, by - ay; l = math.hypot(dx, dy) or 1; best, bi = 0, 0
    for i in range(1, len(L) - 1):
        px, py = L[i][1] * 111320 * k - ax, L[i][0] * 110950 - ay; d = abs(px * dy - py * dx) / l
        if d > best: best, bi = d, i
    if best <= tol: return [a, b]
    return simplify(L[:bi + 1], tol)[:-1] + simplify(L[bi:], tol)
def geom(e): return [[p['lat'], p['lon']] for p in e['geometry']]
def cen(e): g = geom(e); return [sum(p[0] for p in g) / len(g), sum(p[1] for p in g) / len(g)]
def nearest_on(L, p):
    k = math.cos(math.radians(p[0])); best = None
    for i in range(len(L) - 1):
        ax, ay, bx, by, px, py = L[i][1] * k, L[i][0], L[i + 1][1] * k, L[i + 1][0], p[1] * k, p[0]; dx, dy = bx - ax, by - ay; l2 = dx * dx + dy * dy or 1e-18
        u = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / l2)); q = [L[i][0] + (L[i + 1][0] - L[i][0]) * u, L[i][1] + (L[i + 1][1] - L[i][1]) * u]; d = dist(p, q)
        if best is None or d < best[0]: best = (d, q)
    return best
def mid2(A, B, n=60):
    """the line half way between two carriageways: each point of A with the nearest point of B"""
    out = []
    for p in resample(A, n):
        d, q = nearest_on(B, p); out.append([(p[0] + q[0]) / 2, (p[1] + q[1]) / 2])
    return out
def sep2(A, B): return round(sum(nearest_on(B, p)[0] for p in resample(A, 20)) / 20, 1)
def chain(ways, ids):
    """ways joined end to end in the order given, each turned to follow the last"""
    out = []
    for i in ids:
        g = geom(ways[i])
        if out:
            if dist(out[-1], g[-1]) < dist(out[-1], g[0]): g = g[::-1]
            out += g[1:] if dist(out[-1], g[0]) < 2 else g
        else: out = g
    if len(ids) > 1:
        g0 = geom(ways[ids[0]]); g1 = geom(ways[ids[1]])
        if min(dist(g0[0], g1[0]), dist(g0[0], g1[-1])) < min(dist(g0[-1], g1[0]), dist(g0[-1], g1[-1])):   # the first one was backwards
            out = g0[::-1]
            for i in ids[1:]:
                g = geom(ways[i])
                if dist(out[-1], g[-1]) < dist(out[-1], g[0]): g = g[::-1]
                out += g[1:] if dist(out[-1], g[0]) < 2 else g
    return out
def walk(roads, start, toward, far, refs=None):
    """follow one-way carriageways from a point, away from `toward`'s opposite: returns the line walked (up to `far` metres)"""
    used = set(); head = None; near = None
    for e in roads:
        if e['type'] != 'way': continue
        g = geom(e)
        for q in (g[0], g[-1]):
            d = dist(q, start)
            if d < 90 and (near is None or d < near[0]): near = (d, q)
    line = [start] if not near or near[0] < 4 else [start, near[1]]
    if toward is not None: head = (toward[0] - start[0], (toward[1] - start[1]) * math.cos(math.radians(start[0])))
    while plen(line) < far:
        best = None
        for e in roads:
            if e['id'] in used or e['type'] != 'way': continue
            t = e.get('tags', {})
            if refs and not any(r in (t.get('ref', '') + ' ' + t.get('name', '')) for r in refs): continue
            g = geom(e)
            for gg in (g, g[::-1]):
                if dist(gg[0], line[-1]) < 4:
                    d = (gg[min(len(gg) - 1, 2)][0] - gg[0][0], (gg[min(len(gg) - 1, 2)][1] - gg[0][1]) * math.cos(math.radians(start[0])))
                    dot = (d[0] * head[0] + d[1] * head[1]) / ((math.hypot(*d) or 1) * (math.hypot(*head) or 1)) if head else 1
                    if dot > 0.5 and (best is None or dot > best[0]): best = (dot, e['id'], gg)
        if not best: break
        used.add(best[1]); g = best[2]; line += g[1:]; head = (g[-1][0] - g[-2][0], (g[-1][1] - g[-2][1]) * math.cos(math.radians(start[0])))
    # cut to length
    out = [line[0]]; acc = 0
    for i in range(1, len(line)):
        d = dist(line[i - 1], line[i])
        if acc + d > far: u = (far - acc) / d; out.append([line[i - 1][0] + (line[i][0] - line[i - 1][0]) * u, line[i - 1][1] + (line[i][1] - line[i - 1][1]) * u]); break
        out.append(line[i]); acc += d
    return out
def pack(L, tol=1.5): return [[r5(p[0]), r5(p[1])] for p in simplify(L, tol)]

D = {'made': 'build_data.py, 19 Nov 2026'}

# ---------------- airports ----------------
AP = J(os.path.join(CA, 'dl', 'scout', 'airports', 'ca_15_named_airports.json')); D['airports'] = []
for a in AP:
    rws = []
    for r in a['runways']:
        if r.get('closed'): continue
        le, he = r['le'], r['he']
        if le.get('lat') is None or he.get('lat') is None: continue
        rws.append([le['id'], he['id'], r5(le['lat']), r5(le['lon']), r5(he['lat']), r5(he['lon']), round(le.get('elev_ft') or a['elev_ft']), round(he.get('elev_ft') or a['elev_ft']), round(le.get('displ_ft') or 0), round(he.get('displ_ft') or 0), round(r['len_ft']), round(r['wid_ft'])])
    D['airports'].append({'id': a['iata'] or a['ident'][1:], 'icao': a['ident'], 'name': a['name'], 'lat': r5(a['lat']), 'lon': r5(a['lon']), 'elev': round(a['elev_ft']), 'rw': rws})
H = J(os.path.join(SP, 'research', 'ca', 'engine_txt', 'bts_ontime_2026_06_hourly.json'))['airports']; D['hourly'] = {}
for k, v in H.items(): D['hourly'][k] = {'dep': [round(x, 1) for x in v['wd_dep_by_hour']], 'arr': [round(x, 1) for x in v['wd_arr_by_hour']]}

# ---------------- bridges ----------------
B = {}
def ways_of(p): return {e['id']: e for e in J(os.path.join(HERE, 'dl', p))['elements'] if e['type'] == 'way'}
# Golden Gate: both carriageways, south end to the north abutment
g = ways_of('gg.json'); R = J(os.path.join(HERE, 'dl', 'ggroads.json'))['elements']
sb = chain(g, [1557712987, 1560010147, 537838948])[::-1]; nb = chain(g, [595194543, 1560010146, 1557712986])
mid = mid2(nb, sb, 80)
tw = lambda ids: [sum(cen(g[i])[0] for i in ids) / len(ids), sum(cen(g[i])[1] for i in ids) / len(ids)]
ggS = tw([1329545860, 1329549315, 1329549317, 1329550017, 1329550151, 1329761876, 1329761878, 1329761879, 1329761880, 1329761881]); ggN = tw([1330832664, 1330832665, 1330832669, 1330832670, 1330832673, 1330832677, 1330832679, 1330832682, 1330832687, 1330832689])
south = walk(R, nb[0], [nb[0][0] - (nb[3][0] - nb[0][0]), nb[0][1] - (nb[3][1] - nb[0][1])], 900); north = walk(R, nb[-1], [nb[-1][0] + (nb[-1][0] - nb[-4][0]), nb[-1][1] + (nb[-1][1] - nb[-4][1])], 900)
B['gg'] = {'line': pack(mid), 'towers': [[r5(ggS[0]), r5(ggS[1])], [r5(ggN[0]), r5(ggN[1])]], 'south': pack(south, 3), 'north': pack(north, 3), 'lens': [round(plen(mid)), round(dist(ggS, ggN)), round(plen(south)), round(plen(north))]}
# Bay Bridge
b = ways_of('bay.json'); R = J(os.path.join(HERE, 'dl', 'bay.json'))['elements']; R80 = [e for e in R if e['type'] == 'way' and e.get('tags', {}).get('highway') in ('motorway',)]
W = {e['tags']['ref']: cen(e) for e in b.values() if e.get('tags', {}).get('ref') in ('W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7') and 'bridge:support' in e['tags']}
west = [W['W1'], W['W7']]
sfw = walk(R80, geom(b[8921938])[-1], [W['W1'][0] - (W['W7'][0] - W['W1'][0]), W['W1'][1] - (W['W7'][1] - W['W1'][1])], 900, ['I 80', 'Eisenhower'])
eb = chain(b, [1212176124, 237731428]); wb = chain(b, [236348361, 236348360, 929579737, 497579295])[::-1]
east = mid2(eb, wb, 120); et = cen(b[237735191])
ybi = [W['W7'], east[0]]
B['bay'] = {'west': pack(west), 'wt': {k: [r5(v[0]), r5(v[1])] for k, v in W.items()}, 'sf': pack(sfw, 3), 'ybi': pack(ybi), 'east': pack(east, 1.5), 'et': [r5(et[0]), r5(et[1])],
            'lens': [round(plen(west)), round(dist(W['W2'], W['W3'])), round(dist(W['W5'], W['W6'])), round(plen(sfw)), round(plen(east))], 'eastSep': sep2(eb, wb)}
# Vincent Thomas: the mapped outline's long axis through the two towers
v = ways_of('vt.json'); out = geom(v[1011852501]); t1, t2 = cen(v[1011852499]), cen(v[1011852500])   # east tower, west tower
ax = (t1[0] - t2[0], (t1[1] - t2[1]) * math.cos(math.radians(t1[0]))); al = math.hypot(*ax)
proj = lambda p: ((p[0] - t2[0]) * ax[0] + (p[1] - t2[1]) * math.cos(math.radians(t1[0])) * ax[1]) / al * 110950
ps = sorted(out, key=proj); wend = [sum(p[0] for p in ps[:2]) / 2, sum(p[1] for p in ps[:2]) / 2]; eend = [sum(p[0] for p in ps[-2:]) / 2, sum(p[1] for p in ps[-2:]) / 2]
try:
    VR = J(os.path.join(HERE, 'dl', 'vtroads.json'))['elements']
    vw = walk(VR, wend, [wend[0] - (t2[0] - wend[0]), wend[1] - (t2[1] - wend[1])], 400); ve = walk(VR, eend, [eend[0] + (eend[0] - t1[0]), eend[1] + (eend[1] - t1[1])], 400)
except Exception as ex: vw = ve = []; print('vt roads not used', ex)
B['vt'] = {'line': pack([wend, t2, t1, eend]), 'towers': [[r5(t2[0]), r5(t2[1])], [r5(t1[0]), r5(t1[1])]], 'lens': [round(plen([wend, t2, t1, eend])), round(dist(t1, t2))], 'outline': pack(out, 2), 'westRoad': pack(vw, 3), 'eastRoad': pack(ve, 3)}
# Coronado: both carriageways from the Coronado toll plaza to the San Diego end
N = J(os.path.join(CA, 'dl', 'scout', 'navy', 'overpass_navy_san_diego_bay.json'))['elements']; n = {e['id']: e for e in N if e['type'] == 'way'}
ebc = chain(n, [6055495, 1538967139, 5941511]); wbc = chain(n, [112951106, 153343716, 1538967144])[::-1]
cmid = mid2(ebc, wbc, 140); fog = [[e['lat'], e['lon']] for e in N if e['type'] == 'node' and 'Fog Signal' in e.get('tags', {}).get('name', '')]
B['cor'] = {'line': pack(cmid, 1.0), 'channel': [r5(sum(p[0] for p in fog) / len(fog)), r5(sum(p[1] for p in fog) / len(fog))], 'lens': [round(plen(cmid)), round(plen(geom(n[1538967145])) / 2)], 'sep': sep2(ebc, wbc)}
D['bridges'] = B

# ---------------- the Navy in San Diego Bay ----------------
NV = {'carrier': {'lat': 32.713154, 'lon': -117.189488, 'hdg': 119.1, 'how': 'measured on the Esri World Imagery photograph (zoom 18): the carrier lying at the quay, 333 m long'}}
piers = []
for e in N:
    t = e.get('tags', {})
    if e['type'] == 'way' and t.get('man_made') == 'pier' and t.get('name', '').startswith('Pier ') and 32.655 < e['geometry'][0]['lat'] < 32.695 and e['geometry'][0]['lon'] > -117.14:
        g = geom(e); a, c = g[0], g[-1]
        if a[1] < c[1]: a, c = c, a          # a: the shore end (east), c: the bay end (west)
        piers.append([int(t['name'].split()[1]), r5(a[0]), r5(a[1]), r5(c[0]), r5(c[1]), round(plen(g))])
NV['piers'] = sorted(piers)
nab = []
for e in N:
    t = e.get('tags', {})
    if e['type'] == 'way' and t.get('man_made') == 'pier' and len(e['geometry']) >= 5:
        g = geom(e); c = cen(e)
        if 32.6745 < c[0] < 32.6800 and -117.1650 < c[1] < -117.1590 and 180 < plen(g) < 260:
            far = max(g, key=lambda p: max(dist(p, q) for q in g)); far2 = max(g, key=lambda p: dist(p, far)); nab.append([r5(far[0]), r5(far[1]), r5(far2[0]), r5(far2[1])])
NV['nab'] = sorted(nab)
NV['helipads'] = sorted([[r5(cen(e)[0]), r5(cen(e)[1])] for e in N if e['type'] == 'way' and e.get('tags', {}).get('aeroway') == 'helipad' and 32.685 < cen(e)[0] < 32.715 and -117.225 < cen(e)[1] < -117.200])
D['navy'] = NV
js = '  /* ==== sky job: the facts the kit carries (made by CA/engine/sky/build_data.py from the saved sources; do not edit by hand) ==== */\n  SE.SKY_DATA = ' + json.dumps(D, separators=(',', ':'), ensure_ascii=False) + ';\n'
open(os.path.join(HERE, 'sky_data.js'), 'w', encoding='utf-8').write(js)
print('wrote sky_data.js', len(js), 'bytes')
for k, v in B.items(): print(k, v.get('lens'), {kk: len(vv) for kk, vv in v.items() if isinstance(vv, list)})
print('piers', NV['piers']); print('nab', len(nab), 'helipads', len(NV['helipads']))
