#!/usr/bin/env python3
"""Fetch AWS terrarium tiles with Origin: null, record the CORS header, decode heights at known points.
height_m = R*256 + G + B/256 - 32768.   usage: terrarium.py <outdir>"""
import sys, io, math, json, urllib.request, time
from PIL import Image
import numpy as np
OUT=sys.argv[1]
BASE='https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'
def tile(lat,lon,z):
    n=2**z; x=(lon+180)/360*n; y=(1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*n
    return int(x),int(y),(x-int(x))*256,(y-int(y))*256
def fetch(url):
    req=urllib.request.Request(url,headers={'Origin':'null','User-Agent':'Mozilla/5.0 scout-probe'})
    t=time.time()
    try:
        r=urllib.request.urlopen(req,timeout=60); b=r.read(); return r.status,dict((k.lower(),v) for k,v in r.getheaders()),b,time.time()-t
    except urllib.error.HTTPError as e: return e.code,dict((k.lower(),v) for k,v in e.headers.items()),e.read(),time.time()-t
def decode(b):
    im=Image.open(io.BytesIO(b)); a=np.asarray(im.convert('RGB')).astype(np.float64)
    return a[:,:,0]*256+a[:,:,1]+a[:,:,2]/256-32768, im
P=[('Mount Whitney summit',36.578580,-118.291995,4421.0,'USGS/NGS: 4,421 m (14,505 ft, NAVD88)'),
   ('Badwater Basin (boardwalk)',36.229700,-116.767200,-85.5,'-85.5 m (-282 ft) at the lowest point nearby'),
   ('San Francisco, Twin Peaks (south peak)',37.751300,-122.447500,281.0,'about 281 m (922 ft)'),
   ('San Francisco, Ferry Building',37.795500,-122.393700,3.0,'near sea level'),
   ('Lake Tahoe, mid-lake surface',39.096800,-120.032400,1897.0,'natural rim 1,897 m (6,223 ft); lake surface about 1,897 to 1,899 m'),
   ('South Lake Tahoe (airport)',38.893900,-119.995300,1909.0,'KTVL field elevation 1,909 m (6,264 ft)')]
res=[]
for name,lat,lon,truth,note in P:
    for z in (10,12,14,15):
        x,y,px,py=tile(lat,lon,z); url=BASE.format(z=z,x=x,y=y)
        st,h,b,dt=fetch(url)
        rec={'place':name,'lat':lat,'lon':lon,'z':z,'x':x,'y':y,'url':url,'http':st,'acao':h.get('access-control-allow-origin'),'content_type':h.get('content-type'),'bytes':len(b),'seconds':round(dt,2),'expected_m':truth,'expected_note':note}
        if st==200:
            H,im=decode(b); i,j=min(255,int(py)),min(255,int(px))
            rec.update(size=list(im.size),mode=im.mode,height_m=round(float(H[i,j]),1),rgb=[int(v) for v in np.asarray(im.convert('RGB'))[i,j]],tile_min=round(float(H.min()),1),tile_max=round(float(H.max()),1))
            if z in (12,15): open(f'{OUT}/terrarium_{name.split(",")[0].split("(")[0].strip().lower().replace(" ","_")}_{z}_{x}_{y}.png','wb').write(b)
        res.append(rec)
        print(f"{name[:34]:34s} z{z} {x}/{y} http {st} ACAO {rec['acao']} {rec['bytes']}B {rec.get('mode')} -> {rec.get('height_m')} m (expected {truth}); rgb {rec.get('rgb')}; tile min/max {rec.get('tile_min')}/{rec.get('tile_max')}")
# largest zoom over California
print('--- zoom ladder at Mount Whitney and downtown Los Angeles')
for name,lat,lon in (('Mount Whitney',36.578580,-118.291995),('Los Angeles downtown',34.0522,-118.2437),('Badwater',36.2297,-116.7672)):
    for z in range(13,19):
        x,y,px,py=tile(lat,lon,z); st,h,b,dt=fetch(BASE.format(z=z,x=x,y=y))
        hm=None
        if st==200:
            H,im=decode(b); hm=round(float(H[min(255,int(py)),min(255,int(px))]),1)
            # is it real detail or an upsampled coarser tile? count distinct heights
            distinct=len(np.unique(np.round(H,2)))
        print(f"  {name:22s} z{z}: http {st} {len(b)}B height {hm} distinct heights in tile {distinct if st==200 else None} x-amz-meta/last-modified {h.get('last-modified')}")
        res.append({'place':name+' zoom ladder','z':z,'http':st,'bytes':len(b),'height_m':hm,'distinct_heights':int(distinct) if st==200 else None})
json.dump(res,open(f'{OUT}/terrarium_tests.json','w'),indent=1)
