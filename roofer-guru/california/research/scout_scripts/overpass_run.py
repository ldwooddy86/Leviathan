#!/usr/bin/env python3
"""POST one Overpass query (form-encoded, Origin: null) to the first public server that answers; save the JSON.
usage: overpass_run.py <query.txt> <out.json> [rounds]"""
import sys, json, time, gzip, urllib.request, urllib.parse
q=open(sys.argv[1]).read(); out=sys.argv[2]; rounds=int(sys.argv[3]) if len(sys.argv)>3 else 12
SERVERS=['https://maps.mail.ru/osm/tools/overpass/api/interpreter','https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter','http://overpass-api.de/api/interpreter']
log=[]
for rnd in range(rounds):
    for s in SERVERS:
        req=urllib.request.Request(s,data=('data='+urllib.parse.quote(q)).encode(),headers={'Origin':'null','Content-Type':'application/x-www-form-urlencoded','User-Agent':'scout-probe/1.0 (research test)','Accept-Encoding':'gzip'})
        t=time.time()
        try:
            r=urllib.request.urlopen(req,timeout=180); raw=r.read(); h=dict((k.lower(),v) for k,v in r.getheaders())
            data=gzip.decompress(raw) if h.get('content-encoding')=='gzip' else raw
            j=json.loads(data)
            if 'elements' not in j: raise ValueError('no elements: '+str(data[:120]))
            open(out,'wb').write(data)
            print(json.dumps({'server':s,'http':r.status,'acao':h.get('access-control-allow-origin'),'seconds':round(time.time()-t,1),'wire_bytes':len(raw),'encoding':h.get('content-encoding'),'json_bytes':len(data),'elements':len(j['elements']),'osm_base':j.get('osm3s',{}).get('timestamp_osm_base'),'remark':j.get('remark'),'failed_before':log}))
            sys.exit(0)
        except Exception as e:
            log.append(f'{s.split("/")[2]} {type(e).__name__} {str(e)[:60]} after {time.time()-t:.0f}s')
    time.sleep(12)
print(json.dumps({'failed':log[-8:]})); sys.exit(1)
