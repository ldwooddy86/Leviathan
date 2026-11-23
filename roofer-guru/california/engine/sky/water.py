import math,sys,subprocess,os
from PIL import Image
z=15; N=2**z; cache={}
def px(lat,lon):
    fx=(lon+180)/360*N; fy=(1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*N
    x,y=int(fx),int(fy); p='w%d_%d_%d.jpg'%(z,x,y)
    if not os.path.exists(p): subprocess.run(['curl','-sS','-m','40','-o',p,'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/%d/%d/%d'%(z,y,x)])
    im=cache.get(p) or Image.open(p).convert('RGB'); cache[p]=im
    cx,cy=int((fx-x)*256),int((fy-y)*256); s=[im.getpixel((min(255,max(0,cx+i)),min(255,max(0,cy+j)))) for i in(-3,0,3) for j in(-3,0,3)]
    r=sum(a[0] for a in s)/9; g=sum(a[1] for a in s)/9; b=sum(a[2] for a in s)/9
    return (round(r),round(g),round(b)), ('WATER' if r<70 and g<90 and b<95 and max(r,g,b)-min(r,g,b)<45 else 'land?')
pts=eval(sys.argv[1])
for i in range(len(pts)-1):
    a,b=pts[i],pts[i+1]
    for k in range(6):
        la=a[0]+(b[0]-a[0])*k/6; lo=a[1]+(b[1]-a[1])*k/6; print(i,k,round(la,4),round(lo,4),*px(la,lo))
