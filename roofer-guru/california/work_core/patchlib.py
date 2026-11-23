"""Anchored replacements on a part file: each old text must occur exactly n times (default 1)."""
import os, sys
SRC = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'atlas', 'src')
def patch(fname, reps):
    p = os.path.join(SRC, fname)
    with open(p, encoding='utf-8') as f: t = f.read()
    bad = 0
    for r in reps:
        old, new = r[0], r[1]; n = r[2] if len(r) > 2 else 1
        c = t.count(old)
        if (n == -1 and c < 1) or (n != -1 and c != n):
            print('  MISS', fname, 'count', c, 'want', n, ':', repr(old[:90])); bad += 1; continue
        t = t.replace(old, new)
    if bad:
        print(fname, 'NOT written,', bad, 'misses'); sys.exit(1)
    with open(p, 'w', encoding='utf-8') as f: f.write(t)
    print(fname, 'patched,', len(reps), 'replacements')
