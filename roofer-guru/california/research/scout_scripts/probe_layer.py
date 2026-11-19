#!/usr/bin/env python3
"""Probe an ArcGIS REST layer the way a browser page with origin "null" would.
usage: probe_layer.py <layerURL> <w,s,e,n> [sample_out.json] [--fields=a,b,c] [--where=...] [--all]
Prints: CORS header, name, record limit, interesting fields, count in the box, a sample record; saves a small sample."""
import sys, json, re, urllib.request, urllib.parse, ssl, time
args=[a for a in sys.argv[1:] if not a.startswith('--')]
opts=dict(a[2:].split('=',1) if '=' in a else (a[2:],'1') for a in sys.argv[1:] if a.startswith('--'))
url=args[0].rstrip('/'); box=args[1] if len(args)>1 else None; out=args[2] if len(args)>2 else None
def get(u, timeout=60):
    req=urllib.request.Request(u, headers={'Origin':'null','User-Agent':'Mozilla/5.0 (X11; Linux x86_64) scout-probe'})
    t=time.time()
    try:
        r=urllib.request.urlopen(req, timeout=timeout)
        body=r.read(); return r.status, dict((k.lower(),v) for k,v in r.getheaders()), body, time.time()-t
    except urllib.error.HTTPError as e:
        return e.code, dict((k.lower(),v) for k,v in e.headers.items()), e.read(), time.time()-t
st,h,b,dt=get(url+'?f=json')
print(f'LAYER {url}\n  meta HTTP {st} ACAO={h.get("access-control-allow-origin")!r} {len(b)}B {dt:.2f}s')
try: j=json.loads(b)
except Exception as e: print('  not JSON:',b[:200]); sys.exit(1)
if 'error' in j: print('  ERROR',j['error']); sys.exit(1)
if 'layers' in j and 'fields' not in j:
    print('  SERVICE with layers:', [(l['id'],l['name']) for l in j.get('layers',[])][:60], 'tables:', [(l['id'],l['name']) for l in j.get('tables',[])][:20]); print('  maxRecordCount',j.get('maxRecordCount'),'capabilities',j.get('capabilities')); sys.exit(0)
F=j.get('fields') or []
print(f"  name={j.get('name')!r} type={j.get('type')} geom={j.get('geometryType')} maxRecordCount={j.get('maxRecordCount')} formats={j.get('supportedQueryFormats')} caps={j.get('capabilities')} pagination={(j.get('advancedQueryCapabilities') or {}).get('supportsPagination')} sr={(j.get('extent') or {}).get('spatialReference')}")
ed=j.get('editingInfo') or {}
if ed: print('  lastEdit', {k:time.strftime('%Y-%m-%d',time.gmtime(v/1000)) for k,v in ed.items() if isinstance(v,(int,float))})
pat=re.compile(opts.get('pat', r'year|yr|built|blt|use|zon|situs|addr|stor|sq|area|unit|bed|roof|effect|class|desc|apn|ain|parcel|land|impr|age|date|type|value|val$|status|work|permit|issue|cost|lat|lon|x$|y$'), re.I)
names=[f['name'] for f in F]
print(f'  {len(F)} fields; interesting:', ', '.join(f"{f['name']}({f.get('alias')})" if f.get('alias') and f.get('alias')!=f['name'] else f['name'] for f in F if pat.search(f['name']) or pat.search(f.get('alias') or '')))
if opts.get('all'): print('  ALL:', ', '.join(f"{f['name']}:{f['type'].replace('esriFieldType','')}" for f in F))
if not box: sys.exit(0)
base={'where':opts.get('where','1=1'),'geometry':box,'geometryType':'esriGeometryEnvelope','inSR':'4326','spatialRel':'esriSpatialRelIntersects'}
st,h,b,dt=get(url+'/query?'+urllib.parse.urlencode(dict(base,returnCountOnly='true',f='json')))
try: cnt=json.loads(b)
except Exception: cnt=b[:200]
print(f'  COUNT in box {box}: HTTP {st} ACAO={h.get("access-control-allow-origin")!r} -> {cnt} {dt:.2f}s')
of=opts.get('fields','*')
for fmt in (['json','geojson'] if not opts.get('fmt') else [opts['fmt']]):
    q=dict(base,outFields=of,returnGeometry='true',outSR='4326',geometryPrecision='6',f=fmt)
    st,h,b,dt=get(url+'/query?'+urllib.parse.urlencode(q), 120)
    try: r=json.loads(b)
    except Exception: print(f'  QUERY f={fmt}: HTTP {st} not JSON {b[:160]!r}'); continue
    if 'error' in r: print(f'  QUERY f={fmt}: HTTP {st} ERROR {r["error"]}'); continue
    feats=r.get('features',[])
    exc=r.get('exceededTransferLimit') or (r.get('properties') or {}).get('exceededTransferLimit')
    print(f'  QUERY f={fmt}: HTTP {st} ACAO={h.get("access-control-allow-origin")!r} features={len(feats)} exceeded={exc} {len(b)}B {dt:.2f}s enc={h.get("content-encoding")}')
    if feats and fmt=='json':
        a=feats[0].get('attributes') or {}
        print('  SAMPLE', json.dumps({k:v for k,v in a.items() if v not in (None,'',' ')})[:1500])
        g=feats[0].get('geometry') or {}; print('  geom keys', list(g.keys()), 'first pt', (g.get('rings') or g.get('paths') or [[None]])[0][0] if (g.get('rings') or g.get('paths')) else (g.get('x'),g.get('y')))
        # completeness of interesting fields in the returned set
        comp={}
        for k in a.keys():
            if pat.search(k):
                nn=sum(1 for f in feats if f['attributes'].get(k) not in (None,'',' ',0,'0'))
                comp[k]=f'{nn}/{len(feats)}'
        print('  FILLED', comp if opts.get('filled') else {k:v for k,v in comp.items() if re.search(r'year|yr|built|blt|use|situs|addr|stor|eff|desc|type|date|val|cost', k, re.I)})
        yrs={}
        for k in a.keys():
            if re.search(r'year|yr|built|blt|eff|age', k, re.I):
                ok=0
                for f in feats:
                    v=f['attributes'].get(k)
                    try:
                        iv=int(float(str(v).strip()))
                        if 1800<=iv<=2027: ok+=1
                    except Exception: pass
                yrs[k]=f'{ok}/{len(feats)}'
        print('  VALID YEARS (1800-2027)', yrs)
        if out:
            r2=dict(r); r2['features']=feats[:25]; r2['_note']=f'first 25 of {len(feats)} features returned for box {box}; query: {url}/query?'+urllib.parse.urlencode(q)
            json.dump(r2, open(out,'w')); print('  saved', out)
