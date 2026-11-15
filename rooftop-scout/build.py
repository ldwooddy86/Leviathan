"""Insert Rooftop Scout (module 21) into a DFW Thermal Debt Atlas build.

The block goes after the Agent Desk's end marker and before the shell boot script, so the shell builds the rail with the
new module in it. Nothing else in the file changes. Run: python3 build.py SRC OUT
"""
import sys, os, re, hashlib

HERE = os.path.dirname(os.path.abspath(__file__))
SRC, OUT = sys.argv[1], sys.argv[2]
ANCHOR = '<!-- leviathan:agent-desk:end -->'
SHELL = '<!-- shell boot: builds the rail and shows the module in the hash -->'

html = open(SRC, encoding='utf-8').read()
if 'rooftop-scout:start' in html:
    sys.exit('this file already carries Rooftop Scout')
if html.count(ANCHOR) != 1 or html.count(SHELL) != 1 or html.index(ANCHOR) > html.index(SHELL):
    sys.exit('anchor not found exactly once before the shell')

read = lambda n: open(os.path.join(HERE, n), encoding='utf-8').read()
leaflet_css, leaflet_js, css, js = read('vendor/leaflet.css'), read('vendor/leaflet.min.js'), read('scout.css'), read('scout.js')
for name, text in [('leaflet.min.js', leaflet_js), ('scout.js', js), ('leaflet.css', leaflet_css), ('scout.css', css)]:
    low = text.lower()
    if '</script' in low or '</style' in low or '<!--' in text:
        sys.exit(name + ' holds a sequence that would end its tag early')
leaflet_js = leaflet_js.replace('//# sourceMappingURL=leaflet.js.map', '').rstrip()

block = (
    '\n<!-- rooftop-scout:start (module 21: the heatmaps on satellite imagery, Street View from the road, every building read) -->\n'
    '<style id="scout-leaflet-css">\n/* ==== vendor/leaflet.css (Leaflet 1.9.4, BSD 2 clause; the three image urls the module never shows removed) ==== */\n'
    + leaflet_css.strip() + '\n</style>\n'
    '<style id="scout-style">\n' + css.strip() + '\n</style>\n'
    '<script id="scout-leaflet">\n/* ==== vendor/leaflet.js (Leaflet 1.9.4, BSD 2 clause) ==== */\n' + leaflet_js + '\n'
    '/* kept private to Rooftop Scout: the global L goes back to what it was */\n'
    'window.__SCOUT_LEAFLET__ = window.L && typeof window.L.noConflict === "function" ? window.L.noConflict() : null;\n</script>\n'
    '<script id="scout-js">\n' + js.strip() + '\n</script>\n'
    '<!-- rooftop-scout:end -->'
)
i = html.index(ANCHOR) + len(ANCHOR)
out = html[:i] + block + html[i:]
open(OUT, 'w', encoding='utf-8').write(out)
print('wrote', OUT, len(out), 'bytes; added', len(out) - len(html), '; sha256', hashlib.sha256(out.encode()).hexdigest()[:16])
