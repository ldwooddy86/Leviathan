"""Anchored edits to CA/scout files: python3 -I ed.py <file> <edits.json>   edits: [[old, new], ...] each old exactly once."""
import sys, json
f, e = sys.argv[1], sys.argv[2]
s = open(f, encoding='utf-8').read()
for i, (a, b) in enumerate(json.load(open(e, encoding='utf-8'))):
    c = s.count(a)
    if c != 1:
        sys.exit('edit %d: anchor found %d times: %r' % (i, c, a[:100]))
    s = s.replace(a, b)
open(f, 'w', encoding='utf-8').write(s)
print('ok', f)
