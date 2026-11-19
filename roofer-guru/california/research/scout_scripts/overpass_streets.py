#!/usr/bin/env python3
"""Run the Scout street query on the public Overpass servers for a box, with Origin: null, and report tag completeness.
usage: overpass_streets.py <outdir> <name> <south> <west> <north> <east> [server]"""
import sys, json, math, time, urllib.request, urllib.parse, gzip, collections
OUT,name=sys.argv[1],sys.argv[2]; S,W,N,E=map(float,sys.argv[3:7])
server=sys.argv[7] if len(sys.argv)>7 else 'https://overpass-api.de/api/interpreter'
Q=f"""[out:json][timeout:90][bbox:{S},{W},{N},{E}];
(
  way["highway"];
  node["highway"~"^(traffic_signals|motorway_junction|stop)$"];
  way["railway"~"^(rail|light_rail|subway|tram|monorail|funicular|narrow_gauge|disused|abandoned)$"];
  node["railway"~"^(station|halt|tram_stop|level_crossing)$"];
  way["man_made"~"^(pier|quay|breakwater|bridge)$"];
  way["aeroway"];
  node["aeroway"~"^(helipad|aerodrome|navigationaid)$"];
  relation["aeroway"];
  relation["route"~"^(tram|light_rail|subway|train|ferry)$"];
);
out tags geom;"""
body=('data='+urllib.parse.quote(Q)).encode()
req=urllib.request.Request(server,data=body,headers={'Origin':'null','Content-Type':'application/x-www-form-urlencoded','User-Agent':'scout-probe/1.0 (research test)','Accept-Encoding':'gzip'})
t=time.time()
try:
    r=urllib.request.urlopen(req,timeout=150); raw=r.read(); hdr=dict((k.lower(),v) for k,v in r.getheaders()); st=r.status
except urllib.error.HTTPError as e:
    print('HTTP',e.code,e.headers.get('access-control-allow-origin'),e.read()[:300]); sys.exit(1)
dt=time.time()-t
wire=len(raw); data=gzip.decompress(raw) if hdr.get('content-encoding')=='gzip' else raw
j=json.loads(data); els=j.get('elements',[])
p=f'{OUT}/overpass_{name}.json'; open(p,'wb').write(data)
open(f'{OUT}/overpass_{name}.query.txt','w').write(f'POST {server}\nContent-Type: application/x-www-form-urlencoded\nbody: data=<url-encoded query>\n\n{Q}\n')
print(f'{name}: box S{S} W{W} N{N} E{E} | server {server} | HTTP {st} ACAO {hdr.get("access-control-allow-origin")} | {dt:.1f}s | wire {wire:,} B ({hdr.get("content-encoding")}) | json {len(data):,} B | elements {len(els):,} | osm_base {j.get("osm3s",{}).get("timestamp_osm_base")}')
def km(g):
    d=0
    for a,b in zip(g,g[1:]):
        x=math.radians(b['lon']-a['lon'])*math.cos(math.radians((a['lat']+b['lat'])/2)); y=math.radians(b['lat']-a['lat']); d+=math.hypot(x,y)*6371.0088
    return d
ways=[e for e in els if e['type']=='way']; nodes=[e for e in els if e['type']=='node']; rels=[e for e in els if e['type']=='relation']
print(f'  ways {len(ways):,} nodes {len(nodes):,} relations {len(rels):,}')
groups=[('motorway',('motorway',)),('motorway_link (ramps)',('motorway_link',)),('trunk/primary/secondary',('trunk','primary','secondary','trunk_link','primary_link','secondary_link')),('tertiary',('tertiary','tertiary_link')),('residential/unclassified',('residential','unclassified','living_street')),('service (alleys, drives)',('service',)),('foot/cycle/steps/path',('footway','path','cycleway','steps','pedestrian','track','bridleway'))]
stats={}
for label,cls in groups:
    ws=[w for w in ways if (w.get('tags') or {}).get('highway') in cls]
    if not ws: continue
    L=sum(km(w.get('geometry',[])) for w in ws) or 1e-9
    def share(k): 
        return sum(1 for w in ws if k in w['tags'])/len(ws), sum(km(w.get('geometry',[])) for w in ws if k in w['tags'])/L
    row={'ways':len(ws),'km':round(L,1)}
    for k in ('lanes','maxspeed','oneway','name','surface','bridge','tunnel','layer','turn:lanes','width'):
        c,l=share(k); row[k]={'ways_pct':round(100*c,1),'km_pct':round(100*l,1)}
    stats[label]=row
    print(f"  {label:26s} {len(ws):5d} ways {L:7.1f} km | lanes {row['lanes']['km_pct']:5.1f}% | maxspeed {row['maxspeed']['km_pct']:5.1f}% | oneway {row['oneway']['km_pct']:5.1f}% | name {row['name']['km_pct']:5.1f}% | surface {row['surface']['km_pct']:5.1f}%  (share of length)")
T=lambda w:(w.get('tags') or {})
hw=[w for w in ways if 'highway' in T(w)]
br=[w for w in ways if T(w).get('bridge') not in (None,'no')]; tu=[w for w in ways if T(w).get('tunnel') not in (None,'no')]
print(f"  bridges: {len(br)} ways ({sum(1 for w in br if 'highway' in T(w))} road, {sum(1 for w in br if 'railway' in T(w))} rail); with layer {sum(1 for w in br if 'layer' in T(w))}; with maxheight {sum(1 for w in br if 'maxheight' in T(w))}; with height {sum(1 for w in br if 'height' in T(w))}; bridge:structure {sum(1 for w in br if 'bridge:structure' in T(w))}; man_made=bridge outlines {sum(1 for w in ways if T(w).get('man_made')=='bridge')}")
clr=collections.Counter(k for w in ways for k in T(w) if any(s in k for s in ('maxheight','clearance','height','ele')))
print(f"  height/clearance style keys on all ways: {dict(clr.most_common(12))}")
print(f"  tunnels: {len(tu)} ways ({collections.Counter(T(w).get('highway') or ('rail:'+T(w).get('railway','?')) for w in tu).most_common(6)}); with layer {sum(1 for w in tu if 'layer' in T(w))}")
print(f"  oneway=yes road ways: {sum(1 for w in hw if T(w).get('oneway') in ('yes','-1','1','true'))}; maxspeed values: {collections.Counter(T(w).get('maxspeed') for w in hw if 'maxspeed' in T(w)).most_common(8)}")
print(f"  lanes values on motorways: {collections.Counter(T(w).get('lanes') for w in hw if T(w).get('highway')=='motorway').most_common(8)}")
print(f"  nodes: traffic_signals {sum(1 for n in nodes if T(n).get('highway')=='traffic_signals')}, motorway_junction {sum(1 for n in nodes if T(n).get('highway')=='motorway_junction')}, stop {sum(1 for n in nodes if T(n).get('highway')=='stop')}, rail stations/stops {sum(1 for n in nodes if T(n).get('railway') in ('station','halt','tram_stop'))}, level crossings {sum(1 for n in nodes if T(n).get('railway')=='level_crossing')}")
rw=collections.Counter(T(w).get('railway') for w in ways if 'railway' in T(w)); print(f"  railway ways: {dict(rw)}; tram detail: {collections.Counter((T(w).get('tram'),T(w).get('name')) for w in ways if T(w).get('railway')=='tram').most_common(6)}")
print(f"  railway key detail: gauge {sum(1 for w in ways if 'railway' in T(w) and 'gauge' in T(w))}, electrified {sum(1 for w in ways if 'railway' in T(w) and 'electrified' in T(w))}, usage {collections.Counter(T(w).get('usage') for w in ways if 'railway' in T(w) and 'usage' in T(w)).most_common(4)}")
print(f"  piers/quays/breakwaters: {dict(collections.Counter(T(w).get('man_made') for w in ways if T(w).get('man_made') in ('pier','quay','breakwater')))}; named piers: {[T(w).get('name') for w in ways if T(w).get('man_made')=='pier' and T(w).get('name')][:12]}")
aw=collections.Counter(T(w).get('aeroway') for w in ways if 'aeroway' in T(w)); print(f"  aeroway ways: {dict(aw)}; runways: {[(T(w).get('ref'),T(w).get('surface'),T(w).get('width'),T(w).get('length'),T(w).get('ele')) for w in ways if T(w).get('aeroway')=='runway']}")
print(f"  relations: {collections.Counter((T(r).get('type'),T(r).get('route') or T(r).get('aeroway')) for r in rels).most_common(8)}; names {[T(r).get('name') for r in rels][:14]}")
json.dump({'name':name,'box':[S,W,N,E],'server':server,'http':st,'acao':hdr.get('access-control-allow-origin'),'seconds':round(dt,1),'wire_bytes':wire,'encoding':hdr.get('content-encoding'),'json_bytes':len(data),'elements':len(els),'ways':len(ways),'nodes':len(nodes),'relations':len(rels),'osm_base':j.get('osm3s',{}).get('timestamp_osm_base'),'highway_stats':stats},open(f'{OUT}/overpass_{name}.stats.json','w'),indent=1)
