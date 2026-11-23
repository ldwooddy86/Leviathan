import math,sys,subprocess
from PIL import Image
lat,lon,z,n,out=float(sys.argv[1]),float(sys.argv[2]),int(sys.argv[3]),int(sys.argv[4]),sys.argv[5]
N=2**z
fx=(lon+180)/360*N; fy=(1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*N
x0=int(fx-n/2+0.5); y0=int(fy-n/2+0.5)
im=Image.new('RGB',(256*n,256*n))
for i in range(n):
  for j in range(n):
    p='t%d_%d_%d.jpg'%(z,x0+i,y0+j)
    subprocess.run(['curl','-sS','-m','40','-o',p,'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/%d/%d/%d'%(z,y0+j,x0+i)])
    try: im.paste(Image.open(p),(i*256,j*256))
    except Exception as e: print('bad',p,e)
im.save(out)
t2lat=lambda y: math.degrees(math.atan(math.sinh(math.pi*(1-2*y/N))))
print('lon',x0/N*360-180,(x0+n)/N*360-180,'lat',t2lat(y0),t2lat(y0+n))
