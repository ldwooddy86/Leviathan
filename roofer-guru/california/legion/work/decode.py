import base64, gzip, json, sys
p=open('work/pack.raw.js',encoding='utf-8').read()
i=p.index('"'); j=p.rindex('"')
b=base64.b64decode(p[i+1:j])
print('gz bytes',len(b))
w=gzip.decompress(b)
print('json bytes',len(w))
open('work/world.json','wb').write(w)
ws=open('work/worker.raw.js',encoding='utf-8').read()
i=ws.index('='); 
src=json.loads(ws[i+1:].rstrip().rstrip(';'))
open('work/worker.min.js','w',encoding='utf-8').write(src)
print('worker',len(src))
