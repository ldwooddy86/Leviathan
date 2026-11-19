"""Section by section, how two engine files differ: sizes, and how many lines changed. python3 -I secdiff.py a.js b.js"""
import sys, re, difflib
def secs(p):
    s = open(p, encoding='utf-8').read(); out = {}; order = []
    ms = list(re.finditer(r'/\* ==== ([^=]*?) ==== \*/', s))
    for i, m in enumerate(ms):
        e = ms[i + 1].start() if i + 1 < len(ms) else len(s)
        out[m.group(1)] = s[m.start():e]; order.append(m.group(1))
    return out, order
a, oa = secs(sys.argv[1]); b, ob = secs(sys.argv[2])
for k in ob:
    if k not in a: print(f'NEW      {len(b[k]):>7}  {k[:90]}'); continue
    if a[k] == b[k]: print(f'same     {len(b[k]):>7}  {k[:90]}'); continue
    la, lb = a[k].split('\n'), b[k].split('\n'); sm = difflib.SequenceMatcher(None, la, lb, autojunk=False)
    ch = sum(max(i2 - i1, j2 - j1) for tag, i1, i2, j1, j2 in sm.get_opcodes() if tag != 'equal')
    print(f'changed  {len(a[k]):>7} -> {len(b[k]):>7}  lines {len(la)} -> {len(lb)}, {ch} changed  {k[:70]}')
for k in oa:
    if k not in b: print('GONE', k)
