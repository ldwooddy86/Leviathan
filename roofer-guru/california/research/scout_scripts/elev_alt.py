#!/usr/bin/env python3
"""Decode the alternative elevation tiles (Mapterhorn terrarium webp, Esri Terrain3D LERC) at the same test points.
usage: elev_alt.py <outdir>"""
import sys, io, math, json, urllib.request, time
sys.path.insert(0, sys.argv[2])
from PIL import Image
import numpy as np
try:
    import lerc
except Exception as e:
    lerc=None; print('no lerc module:',e)
OUT=sys.argv[1]
def tile(lat,lon,z,size=256):
    n=2**z; x=(lon+180)/360*n; y=(1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*n
    return int(x),int(y),(x-int(x))*size,(y-int(y))*size
def fetch(url):
    req=urllib.request.Request(url,headers={'Origin':'null','User-Agent':'Mozilla/5.0 scout-probe'})
    try:
        r=urllib.request.urlopen(req,timeout=60); b=r.read(); return r.status,r.headers.get('access-control-allow-origin'),b
    except urllib.error.HTTPError as e: return e.code,e.headers.get('access-control-allow-origin'),e.read()
P=[('Mount Whitney summit',36.578580,-118.291995,4421.0),('Badwater Basin (boardwalk)',36.229700,-116.767200,-85.5),('San Francisco, Ferry Building',37.795500,-122.393700,3.0),('Lake Tahoe, mid-lake',39.096800,-120.032400,1897.0),('Los Angeles, City Hall',34.0537,-118.2428,87.0)]
res=[]
print('--- Mapterhorn (terrarium, 512 px webp)')
for name,lat,lon,truth in P:
    for z in (12,13,14,15,16,17):
        x,y,px,py=tile(lat,lon,z,512); url=f'https://tiles.mapterhorn.com/{z}/{x}/{y}.webp'
        st,acao,b=fetch(url); h=None; size=None
        if st==200:
            im=Image.open(io.BytesIO(b)); a=np.asarray(im.convert('RGB')).astype(np.float64); H=a[:,:,0]*256+a[:,:,1]+a[:,:,2]/256-32768
            size=im.size; h=round(float(H[min(size[1]-1,int(py)),min(size[0]-1,int(px))]),1)
            if z==12: open(f'{OUT}/mapterhorn_{name.split(",")[0].split("(")[0].strip().lower().replace(" ","_")}_{z}_{x}_{y}.webp','wb').write(b)
        res.append({'service':'mapterhorn','place':name,'z':z,'url':url,'http':st,'acao':acao,'bytes':len(b),'height_m':h,'expected_m':truth})
        print(f'  {name[:30]:30s} z{z} {x}/{y}: http {st} ACAO {acao} {len(b)}B size {size} -> {h} m (expected {truth})')
print('--- Esri Terrain3D (LERC, 256 px... tile/{z}/{y}/{x})')
for name,lat,lon,truth in P:
    for z in (12,14,15,16):
        x,y,px,py=tile(lat,lon,z,256); url=f'https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer/tile/{z}/{y}/{x}'
        st,acao,b=fetch(url); h=None; shape=None
        if st==200 and lerc and len(b)>200:
            try:
                r=lerc.decode(b); arr=r[1]; shape=arr.shape
                # LERC elevation tiles are 257x257 (one shared edge row/column)
                i=min(arr.shape[0]-1,int(round(py*(arr.shape[0]-1)/256))); j=min(arr.shape[1]-1,int(round(px*(arr.shape[1]-1)/256)))
                h=round(float(arr[i,j]),1)
            except Exception as e: h='decode error '+str(e)[:60]
        res.append({'service':'esri_terrain3d','place':name,'z':z,'url':url,'http':st,'acao':acao,'bytes':len(b),'height_m':h,'expected_m':truth,'shape':list(shape) if shape else None})
        print(f'  {name[:30]:30s} z{z} {y}/{x}: http {st} ACAO {acao} {len(b)}B shape {shape} -> {h} m (expected {truth})')
json.dump(res,open(f'{OUT}/elevation_alternatives_tests.json','w'),indent=1)
