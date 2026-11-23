# Heights for the gazetteer: the USGS 3DEP elevation service read at every GNIS summit, gap and wanted feature of
# California (getSamples, 100 points a request, bilinear off the best data the service holds: 1 m lidar where it exists).
# Resumable: work/elev_3dep.json maps GNIS feature id -> metres.
# python3 -I sample_3dep.py
import csv, json, os, sys, time, urllib.request, urllib.parse
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'dl/gnis/x/Text/DomesticNames_CA.txt')
OUT = os.path.join(HERE, 'work/elev_3dep.json')
URL = 'https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/getSamples'
done = json.load(open(OUT)) if os.path.exists(OUT) else {}
want_ids = set(f['id'] for f in json.load(open(os.path.join(HERE, 'work/gaz_found.json')))['found'])
pts = []
with open(SRC, encoding='utf-8-sig') as f:
    for r in csv.DictReader(f, delimiter='|'):
        if r['feature_id'] in done: continue
        if r["feature_id"] not in want_ids: continue
        try: la, lo = float(r['prim_lat_dec']), float(r['prim_long_dec'])
        except ValueError: continue
        if la and lo: pts.append((r['feature_id'], lo, la))
print('to sample', len(pts), 'already', len(done))
N = int(os.environ.get("N3", "25"))
for i in range(0, len(pts), N):
    chunk = pts[i:i + N]
    body = urllib.parse.urlencode({'geometry': json.dumps({'points': [[p[1], p[2]] for p in chunk], 'spatialReference': {'wkid': 4326}}),
                                   'geometryType': 'esriGeometryMultipoint', 'returnFirstValueOnly': 'true', 'interpolation': 'RSP_BilinearInterpolation', 'f': 'json'}).encode()
    for attempt in range(4):
        try:
            req = urllib.request.Request(URL, data=body, headers={'User-Agent': 'Mozilla/5.0 (compatible; research-client)'})
            d = json.loads(urllib.request.urlopen(req, timeout=120).read())
            for s in d['samples']:
                v = s.get('value')
                try: done[chunk[s['locationId']][0]] = round(float(v), 1)
                except (TypeError, ValueError): done[chunk[s['locationId']][0]] = None
            break
        except Exception as e:
            print('retry', i, e); time.sleep(5 + 10 * attempt)
    json.dump(done, open(OUT, 'w'))
    if i % 1000 == 0: print(i, len(done), flush=True)
print('done', len(done), 'with a value', sum(1 for v in done.values() if v is not None))
