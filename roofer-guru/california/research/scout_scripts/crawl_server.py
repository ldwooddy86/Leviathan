#!/usr/bin/env python3
"""Crawl an ArcGIS REST services root and report layers whose fields look like year built / use / permit.
usage: crawl_server.py <servicesRoot> [--svc=regex for service names] [--fld=regex for fields] [--max=N services] [--list]"""
import sys, json, re, urllib.request, urllib.parse, time, concurrent.futures as cf
args=[a for a in sys.argv[1:] if not a.startswith('--')]
opts=dict(a[2:].split('=',1) if '=' in a else (a[2:],'1') for a in sys.argv[1:] if a.startswith('--'))
root=args[0].rstrip('/')
svc_re=re.compile(opts.get('svc', r'parcel|assess|property|cadast|landuse|land_use|tax|apn|permit|build|address|situs'), re.I)
fld_re=re.compile(opts.get('fld', r'year.?b|yr.?b|built|yrblt|yearblt|eff.?y|constr.?y|^age$|bldg.?y|struct.?y|usecode|use_?c|use_?d|landuse|land_use'), re.I)
mx=int(opts.get('max','60'))
def get(u, timeout=40):
    req=urllib.request.Request(u, headers={'Origin':'null','User-Agent':'Mozilla/5.0 scout-probe'})
    try:
        r=urllib.request.urlopen(req, timeout=timeout); return json.loads(r.read()), r.headers.get('access-control-allow-origin')
    except Exception as e:
        return {'error':str(e)[:120]}, None
j,acao=get(root+'?f=json')
if 'error' in j: print('ROOT ERROR',root,j['error']); sys.exit(1)
print(f'ROOT {root} ACAO={acao!r} version={j.get("currentVersion")} folders={j.get("folders")}')
services=[(s['name'],s['type']) for s in j.get('services',[])]
for f in j.get('folders',[]) or []:
    jj,_=get(root+'/'+urllib.parse.quote(f)+'?f=json')
    services+=[(s['name'],s['type']) for s in jj.get('services',[])] if 'error' not in jj else []
print(f'  {len(services)} services')
if opts.get('list'):
    for n,t in services: print('   ',n,t)
cand=[(n,t) for n,t in services if t in ('MapServer','FeatureServer') and svc_re.search(n)]
print(f'  {len(cand)} candidate services matching {svc_re.pattern!r}:', ', '.join(n+'/'+t for n,t in cand[:80]))
def layers(st):
    n,t=st; u=f'{root}/{urllib.parse.quote(n)}/{t}'
    jj,_=get(u+'/layers?f=json', 60)
    out=[]
    if 'error' in jj: return [(u,None,'ERR '+str(jj['error'])[:80],[])]
    for L in (jj.get('layers') or [])+(jj.get('tables') or []):
        flds=[f['name'] for f in (L.get('fields') or [])]
        hit=[f for f in flds if fld_re.search(f)]
        out.append((u+'/'+str(L['id']), L.get('name'), len(flds), hit, L.get('maxRecordCount')))
    return out
with cf.ThreadPoolExecutor(4) as ex:
    for res in ex.map(layers, cand[:mx]):
        for r in res:
            if r[1] is None: print('   ',r[0],r[2]); continue
            if r[3] or opts.get('alllayers'): print(f'    {r[0]} | {r[1]} | {r[2]} fields | max {r[4]} | HITS {r[3]}')
