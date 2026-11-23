import json, sys, collections
for box in ['la_central', 'sf_northeast', 'coronado']:
    j = json.load(open(sys.argv[1] + '/overpass_%s.json' % box))
    ways = [e for e in j['elements'] if e['type'] == 'way' and 'highway' in e.get('tags', {})]
    c = collections.Counter(e['tags']['highway'] for e in ways)
    print(box, len(ways), c.most_common(8))
    for e in ways:
        t = e['tags']
        if 'Coronado Bridge' in t.get('name', '') or (t.get('highway') == 'motorway' and box == 'la_central' and t.get('ref') == 'CA 110' and 'bridge' in t):
            print({k: v for k, v in t.items() if not k.startswith('tiger') and k not in ('source',)}); break
    refs = collections.Counter(e['tags'].get('ref', '?') for e in ways if e['tags']['highway'] == 'motorway')
    print(' refs', refs.most_common(10))
    lanes = collections.Counter(e['tags'].get('lanes', '?') for e in ways if e['tags']['highway'] == 'motorway')
    print(' lanes', lanes.most_common(10), 'hov', sum(1 for e in ways if 'hov' in e['tags'] or 'hov:lanes' in e['tags']))
    tr = [e for e in j['elements'] if e['type'] == 'way' and e.get('tags', {}).get('railway') == 'tram']
    print(' tram', len(tr), collections.Counter(e['tags'].get('name', '?') for e in tr if 'cable_tram' in e['tags']).most_common(6))
    if tr: print(' ', [ {k:v for k,v in e['tags'].items()} for e in tr if 'cable_tram' in e['tags']][:1])
    print(' layers of motorway bridges', collections.Counter((e['tags'].get('bridge','-'), e['tags'].get('layer','-')) for e in ways if e['tags']['highway'] in ('motorway','motorway_link')).most_common(8))
    print(' bus', sum(1 for e in ways if e['tags'].get('highway')=='busway' or 'bus' in e['tags'].get('access','')), collections.Counter(e['tags'].get('oneway','-') for e in ways if e['tags']['highway'] in ('primary','secondary','tertiary','residential')).most_common(4))
