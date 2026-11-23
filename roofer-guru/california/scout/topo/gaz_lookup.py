# Step 1 of the gazetteer: look each wanted name up in the USGS GNIS Domestic Names file for California and write
# work/gaz_found.json (name, kind, tier, class, county, lat, lon, GNIS id) and the list of names GNIS does not carry.
# python3 -I gaz_lookup.py
import csv, json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from gaz_wanted import WANT
SRC = os.path.join(HERE, 'dl/gnis/x/Text/DomesticNames_CA.txt')
rows = []
with open(SRC, encoding='utf-8-sig') as f:
    for r in csv.DictReader(f, delimiter='|'):
        try:
            r['lat'] = float(r['prim_lat_dec']); r['lon'] = float(r['prim_long_dec'])
        except ValueError:
            continue
        if not r['lat'] or not r['lon']:
            continue
        rows.append(r)
by = {}
for r in rows:
    by.setdefault(r['feature_name'].lower(), []).append(r)
found, missing, amb = [], [], []
for kind, lst in WANT.items():
    for name, classes, county, tier in lst:
        c = [r for r in by.get(name.lower(), []) if r['feature_class'] in classes]
        ca = [r for r in c if r['state_name'] == 'California']
        c = ca or c
        if isinstance(county, tuple):                                    # a rough position, to pick one of several namesakes
            c.sort(key=lambda r: (r['lat'] - county[0]) ** 2 + (r['lon'] - county[1]) ** 2); c = c[:1]
        elif county:
            cc = [r for r in c if r['county_name'] == county]
            c = cc or c
        if not c:
            missing.append([kind, name, sorted(set(r['feature_class'] + '/' + r['state_name'] for r in by.get(name.lower(), [])))])
            continue
        if len(c) > 1:
            amb.append([kind, name, [(r['feature_class'], r['county_name'], r['lat'], r['lon']) for r in c]])
            c.sort(key=lambda r: classes.index(r['feature_class']))
        r = c[0]
        found.append(dict(n=r['feature_name'], k=kind, t=tier, cls=r['feature_class'], county=r['county_name'], state=r['state_name'], lat=r['lat'], lon=r['lon'], id=r['feature_id'], slat=float(r['source_lat_dec'] or 0), slon=float(r['source_long_dec'] or 0)))
os.makedirs(os.path.join(HERE, 'work'), exist_ok=True)
json.dump(dict(found=found, missing=missing, ambiguous=amb), open(os.path.join(HERE, 'work/gaz_found.json'), 'w'), indent=0)
print('found', len(found), 'missing', len(missing), 'ambiguous', len(amb))
for m in missing: print('MISSING', m)
for a in amb: print('AMBIG', a)
