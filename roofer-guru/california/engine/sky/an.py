import json,sys,math
f=sys.argv[1]; pat=sys.argv[2:] 
d=json.load(open(f))
for e in d['elements']:
    t=e.get('tags',{})
    s=json.dumps(t)
    if e['type']=='node':
        print('NODE',e['id'],e['lat'],e['lon'],s[:200]); continue
    if not ('bridge' in s or 'tower' in s): continue
    g=e.get('geometry',[])
    L=sum(math.hypot((g[i+1]['lat']-g[i]['lat'])*111000,(g[i+1]['lon']-g[i]['lon'])*88000) for i in range(len(g)-1))
    print(e['type'],e['id'],len(g),round(L),'%.5f,%.5f -> %.5f,%.5f'%(g[0]['lat'],g[0]['lon'],g[-1]['lat'],g[-1]['lon']) if g else '', {k:t[k] for k in t if k in('name','bridge:name','highway','man_made','bridge','layer','ref','oneway','lanes','bridge:structure','bridge:support','height','ele','level','tunnel','building')})
