import json,math
d=json.load(open('../../dl/scout/navy/overpass_navy_san_diego_bay.json'))
E=d['elements']
def L(g): return sum(math.hypot((g[i+1]['lat']-g[i]['lat'])*110900,(g[i+1]['lon']-g[i]['lon'])*93700) for i in range(len(g)-1))
for e in E:
    t=e.get('tags',{})
    if t.get('man_made')=='pier' and 'name' in t and e['type']=='way':
        g=e['geometry']; 
        if 32.655<g[0]['lat']<32.695 and g[0]['lon']>-117.14:
            print(t['name'],len(g),round(L(g)),'%.5f,%.5f -> %.5f,%.5f'%(g[0]['lat'],g[0]['lon'],g[-1]['lat'],g[-1]['lon']), t.get('area'))
for e in E:
    if e['id']==31929333:
        g=e['geometry']
        for i,p in enumerate(g):
            if p['lat']>32.698 and p['lon']>-117.20: print(i,p['lat'],p['lon'])
    t=e.get('tags',{})
    if t.get('name') in('Quay Road',) : print('QUAY', [(p['lat'],p['lon']) for p in e['geometry']])
    if e['type']=='way' and t.get('aeroway')=='helipad': 
        g=e['geometry']; print('HELI way', g[0]['lat'],g[0]['lon'], t.get('name'),t.get('ref'))
    if e['type']=='node' and t.get('aeroway')=='helipad': print('HELI', e['lat'],e['lon'], t.get('name'), t.get('ref'))
