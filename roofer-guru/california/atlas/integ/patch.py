"""Tiny anchored-replace helper for the integration pass: python3 -I patch.py <edits.json>
   edits.json: [{"file": "name in atlas/src", "old": "...", "new": "...", "count": 1}]"""
import sys, json, os
SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src')
ed = json.load(open(sys.argv[1], encoding='utf-8'))
txt = {}
for e in ed:
    f = e['file']
    if f not in txt: txt[f] = open(os.path.join(SRC, f), encoding='utf-8').read()
    n = txt[f].count(e['old']); want = e.get('count', 1)
    assert n == want, '%s: anchor found %d times, wanted %d: %r' % (f, n, want, e['old'][:90])
    txt[f] = txt[f].replace(e['old'], e['new'])
for f, t in txt.items():
    open(os.path.join(SRC, f), 'w', encoding='utf-8').write(t)
    print('patched', f)
