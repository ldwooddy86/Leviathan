# Test pages for the terrain block.
# 1. The port is applied to the current CA/scout/scout.js and stylesheet (test/scout.js, test/scout-style.css) and the
#    result is parse-checked: that is the proof the anchors still hold.
# 2. Because CA/scout/scout.js is mid-rewrite and may not run, the page the browser tests use is the test bed: the
#    Louisiana page with its place checks opened to California (CA/build/testbed.py), whose Scout script and stylesheet
#    are swapped for the port applied to the untouched originals (CA/scout/tools/scout.orig.js).
# python3 -I make_page.py
import os, re, subprocess, sys
T = os.path.dirname(os.path.abspath(__file__)); TOPO = os.path.dirname(T); S = os.path.dirname(TOPO); CA = os.path.dirname(S)
def run(*a):
    r = subprocess.run(list(a), capture_output=True, text=True); print(r.stdout.strip()[-400:], r.stderr.strip()[-600:]); assert r.returncode == 0
def rd(p): return open(p, encoding='utf-8').read()
def chk(p):
    q = os.path.join(T, '_chk.js'); open(q, 'w', encoding='utf-8').write(re.sub(r'</?script[^>]*>', '', rd(p))); run('node', '--check', q); print('parses:', p)
port = os.path.join(TOPO, 'port_topo.py')
run(sys.executable, '-I', port, os.path.join(S, 'scout.js'), os.path.join(T, 'scout.js'), os.path.join(S, 'scout-style.css'), os.path.join(T, 'scout-style.css')); chk(os.path.join(T, 'scout.js'))
run(sys.executable, '-I', port, os.path.join(S, 'tools/scout.orig.js'), os.path.join(T, 'scout.la.js'), os.path.join(S, 'tools/scout-style.orig.css'), os.path.join(T, 'scout-style.la.css')); chk(os.path.join(T, 'scout.la.js'))
bed = os.path.join(T, 'bed.html')
run(sys.executable, '-I', os.path.join(CA, 'build/testbed.py'), os.path.join(CA, 'engine/la_engine.js'), bed)
NAME = [('Rooftop Scout', 'Louisiana Roofer Guru'), ('louisiana-rooftop-scout-', 'louisiana-roofer-guru-')]
def named(t):
    for a, b in NAME: t = t.replace(a, b)
    return t if t.endswith('\n') else t + '\n'
page = rd(bed)
BED = [("const inLouisiana = (la, lo) => isN(la) && isN(lo) && la > 28.8 && la < 33.1 && lo > -94.1 && lo < -88.7 && (!LA_RINGS.length || inRings(la, lo, LA_RINGS));", "const inLouisiana = (la, lo) => isN(la) && isN(lo) && la > 32.4 && la < 42.1 && lo > -124.6 && lo < -114.0;"),
       ("searchExtent: '-94.1,28.9,-88.8,33.1', location: '-91.6,30.9'", "searchExtent: '-124.6,32.4,-114.0,42.1', location: '-119.4,36.8'"),
       ("c.location.y < 28.8 || c.location.y > 33.1 || c.location.x < -94.1 || c.location.x > -88.7", "c.location.y < 32.4 || c.location.y > 42.1 || c.location.x < -124.6 || c.location.x > -114.0"),
       ("maxBounds: [[28.3, -95.4], [33.7, -88.0]]", "maxBounds: [[31.9, -125.2], [42.6, -113.4]]")]
def bedded(t):
    for a, b in BED: t = t.replace(a, b)
    return t
for orig, new in (('tools/scout.orig.js', 'scout.la.js'), ('tools/scout-style.orig.css', 'scout-style.la.css')):
    old = bedded(named(rd(os.path.join(S, orig))))
    assert page.count(old) == 1, ('not found once in the test bed', orig, page.count(old))
    page = page.replace(old, bedded(named(rd(os.path.join(T, new)))))
open(os.path.join(T, 'page.html'), 'w', encoding='utf-8').write(page)
print('wrote', os.path.join(T, 'page.html'), len(page.encode()), 'bytes')
