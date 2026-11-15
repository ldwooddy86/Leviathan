import base64, gzip, json, re, sys, os
src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
with open(src, encoding='utf-8') as f:
    lines = f.read().split('\n')
for i, l in enumerate(lines):
    if l.startswith('<script type="application/json" id="lv-data">'):
        lv = json.loads(l[l.index('>')+1:l.rindex('</script>')])
        json.dump(lv, open(os.path.join(out, 'lv-data.json'), 'w'), indent=1)
        print('lv-data keys', list(lv.keys()))
    m = re.match(r'<script type="text/plain" id="lvp-([^"]+)">', l)
    if m:
        mid = m.group(1)
        b64 = l[l.index('>')+1:l.rindex('</script>')]
        try:
            txt = gzip.decompress(base64.b64decode(re.sub(r'\s', '', b64))).decode('utf-8')
        except Exception as e:
            print('fail', mid, e); continue
        open(os.path.join(out, f'{mid}.html'), 'w').write(txt)
        print(mid, len(txt))
