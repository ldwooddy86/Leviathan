import json,math
d=json.load(open('../../dl/scout/navy/overpass_navy_san_diego_bay.json'))
E=d['elements']
def L(g): return sum(math.hypot((g[i+1]['lat']-g[i]['lat'])*110900,(g[i+1]['lon']-g[i]['lon'])*93700) for i in range(len(g)-1))
n=0
for e in E:
    t=e.get('tags',{})
    if t.get('man_made')=='pier' and e['type']=='way':
        g=e['geometry']; la=sum(p['lat'] for p in g)/len(g); lo=sum(p['lon'] for p in g)/len(g)
        if 32.668<la<32.682 and -117.175<lo<-117.155: n+=1; print('NAB', round(la,5),round(lo,5),len(g),round(L(g)), t.get('name'))
    if e['id']==554351629: g=e['geometry']; print('NAB outline', min(p['lat'] for p in g),max(p['lat'] for p in g),min(p['lon'] for p in g),max(p['lon'] for p in g))
    if t.get('aeroway')=='runway': g=e['geometry']; print('RW', t.get('ref'), g[0], g[-1])
