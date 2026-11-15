import json, re, sys, os
src = sys.argv[1]; out = sys.argv[2]
t = open(src, encoding='utf-8').read()
for sid in ['omega-data','omega-engine','omega-frame-css','omega-frame-html']:
    m = re.search(r'<script type="[^"]+" id="%s">' % sid, t)
    if not m: print('missing', sid); continue
    a = m.end(); b = t.index('</script>', a)
    body = t[a:b]
    open(os.path.join(out, sid + '.txt'), 'w').write(body)
    print(sid, len(body))
d = json.loads(open(os.path.join(out,'omega-data.txt')).read())
print(type(d), list(d.keys())[:50] if isinstance(d, dict) else len(d))
json.dump(d, open(os.path.join(out,'omega-data.json'),'w'), indent=1)
