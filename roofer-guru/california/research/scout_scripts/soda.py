#!/usr/bin/env python3
"""Socrata helper with Origin: null. usage: soda.py cols <host> <id> | soda.py q <host> <id> key=value ... [--save=path]"""
import sys, json, time, urllib.request, urllib.parse
def get(u):
    req=urllib.request.Request(u,headers={'Origin':'null','User-Agent':'Mozilla/5.0 scout-probe'})
    t=time.time()
    try:
        r=urllib.request.urlopen(req,timeout=120); b=r.read(); return r.status,r.headers.get('access-control-allow-origin'),b,time.time()-t
    except urllib.error.HTTPError as e: return e.code,e.headers.get('access-control-allow-origin'),e.read(),time.time()-t
mode,host,did=sys.argv[1:4]
if mode=='cols':
    st,acao,b,dt=get(f'https://{host}/api/views/{did}.json'); j=json.loads(b)
    print(f"{host} {did}: {j.get('name')} | rows updated {time.strftime('%Y-%m-%d',time.gmtime(j.get('rowsUpdatedAt',0)))} | ACAO {acao}")
    print('  columns:',', '.join(c['fieldName']+':'+c['dataTypeName'] for c in j.get('columns',[]) if not c['fieldName'].startswith(':@')))
else:
    args=[a for a in sys.argv[4:] if not a.startswith('--')]; save=[a[7:] for a in sys.argv[4:] if a.startswith('--save=')]
    p=dict(a.split('=',1) for a in args); u=f'https://{host}/resource/{did}.json?'+urllib.parse.urlencode(p,quote_via=urllib.parse.quote)
    st,acao,b,dt=get(u)
    try: j=json.loads(b)
    except Exception: j=b[:300]
    n=len(j) if isinstance(j,list) else None
    print(f'HTTP {st} ACAO {acao} {len(b)}B {dt:.2f}s rows {n}\n  URL {u}')
    if isinstance(j,list):
        for r in j[:int(p.get('_show',3)) if False else 3]: print('  ',json.dumps(r)[:700])
        if save: json.dump(j[:40],open(save[0],'w'),indent=0)
    else: print('  ',str(j)[:500])
