"""California engine test bed: the shipped Louisiana page with (a) its place checks opened to California and (b) its
   engine swapped for the engine file given. It is a tool for testing engine work before California's own data and
   Scout module exist; it is never shipped. ZIPs in California are unscored in it (Louisiana's table), which the
   Scout module handles.

   python3 -I testbed.py <engine.js> <out.html> [<engine-style.css>]"""
import sys, os
HERE = os.path.dirname(os.path.abspath(__file__))
CA = os.path.dirname(HERE)
LA_PAGE = '/home/user/Leviathan/louisiana-roofer-guru.html'
NAME = [('Rooftop Scout', 'Louisiana Roofer Guru'), ('louisiana-rooftop-scout-', 'louisiana-roofer-guru-')]
def rd(p):
    with open(p, encoding='utf-8') as f: return f.read()
def named(t):
    for a, b in NAME: t = t.replace(a, b)
    return t if t.endswith('\n') else t + '\n'
page = rd(LA_PAGE)
def sub(a, b, n=1):
    global page
    assert page.count(a) == n, ('anchor count', page.count(a), a[:90])
    page = page.replace(a, b)
BOX = "la > 32.4 && la < 42.1 && lo > -124.6 && lo < -114.0"
sub("const inLouisiana = (la, lo) => isN(la) && isN(lo) && la > 28.8 && la < 33.1 && lo > -94.1 && lo < -88.7 && (!LA_RINGS.length || inRings(la, lo, LA_RINGS));",
    "const inLouisiana = (la, lo) => isN(la) && isN(lo) && " + BOX + ";")
sub("searchExtent: '-94.1,28.9,-88.8,33.1', location: '-91.6,30.9'", "searchExtent: '-124.6,32.4,-114.0,42.1', location: '-119.4,36.8'", 2)
sub("c.location.y < 28.8 || c.location.y > 33.1 || c.location.x < -94.1 || c.location.x > -88.7", "c.location.y < 32.4 || c.location.y > 42.1 || c.location.x < -124.6 || c.location.x > -114.0")
sub("maxBounds: [[28.3, -95.4], [33.7, -88.0]]", "maxBounds: [[31.9, -125.2], [42.6, -113.4]]")
old = named(rd(os.path.join(CA, 'engine', 'la_engine.js')))
assert page.count(old) == 1, ('the Louisiana engine is not in the page exactly once', page.count(old))
page = page.replace(old, named(rd(sys.argv[1])))
if len(sys.argv) > 3:
    oc = named(rd(os.path.join(CA, 'engine', 'la_engine-style.css')))
    assert page.count(oc) == 1, 'engine style not found once'
    page = page.replace(oc, named(rd(sys.argv[3])))
with open(sys.argv[2], 'w', encoding='utf-8') as f: f.write(page)
print('wrote', sys.argv[2], len(page.encode('utf-8')), 'bytes')
