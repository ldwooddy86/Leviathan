"""Insert Rooftop Scout (module 21) into a DFW Thermal Debt Atlas build.

The block goes after the Agent Desk's end marker and before the shell boot script, so the shell builds the rail with the
new module in it. Nothing else in the file changes. Run: python3 build.py SRC OUT
"""
import sys, os, re, hashlib, base64, json

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
three_js, js3d = read('vendor/three.bundle.min.js'), read('scout3d.js')
laz_js, lidar_js = read('vendor/lazperf.bundle.js'), read('scoutlidar.js')
tf_js, sr_js = read('vendor/tf.bundle.js'), read('scoutsr.js')
sr_w = base64.b64encode(open(os.path.join(HERE, 'vendor', 'sr', 'realesr-general-x4v3.f16.bin'), 'rb').read()).decode()
sr_meta = json.load(open(os.path.join(HERE, 'vendor', 'sr', 'realesr-general-x4v3.json'), encoding='utf-8'))
if '__WASM__' in laz_js:
    sys.exit('vendor/lazperf.bundle.js still has its wasm placeholder')
TEX = os.path.join(HERE, 'vendor', 'textures')
tex = {f[:-5]: 'data:image/webp;base64,' + base64.b64encode(open(os.path.join(TEX, f), 'rb').read()).decode() for f in sorted(os.listdir(TEX)) if f.endswith('.webp')}
lidar_index = json.load(open(os.path.join(HERE, 'vendor', 'dfw-lidar.json'), encoding='utf-8'))
data_js = ('window.__SCOUT_TEX__ = ' + json.dumps(tex, separators=(',', ':')) + ';\n'
           'window.__SCOUT_LIDAR_INDEX__ = ' + json.dumps(lidar_index, separators=(',', ':')) + ';\n'
           'window.__SCOUT_GLOGO__ = "data:image/png;base64,' + base64.b64encode(open(os.path.join(HERE, 'vendor', 'google-logo.png'), 'rb').read()).decode() + '";\n'
           'window.__SCOUT_SRW__ = { meta: ' + json.dumps(sr_meta, separators=(',', ':')) + ', bin: "' + sr_w + '" };')
for name, text in [('leaflet.min.js', leaflet_js), ('scout.js', js), ('leaflet.css', leaflet_css), ('scout.css', css), ('three.bundle.min.js', three_js), ('scout3d.js', js3d), ('lazperf.bundle.js', laz_js), ('scoutlidar.js', lidar_js), ('data', data_js), ('tf.bundle.js', tf_js), ('scoutsr.js', sr_js)]:
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
    '<script id="scout-three">\n/* ==== vendor/three.bundle.min.js (three.js r186 and the add-ons in vendor/three-entry.js, MIT): it hands itself to\n'
    '   Rooftop Scout as window.__SCOUT_THREE__ and sets no global THREE ==== */\n' + three_js.strip() + '\n</script>\n'
    '<script id="scout-laz">\n/* ==== vendor/lazperf.bundle.js (laz-perf, Apache-2.0, vendor/LAZPERF-LICENSE; its WebAssembly inline) ==== */\n' + laz_js.strip() + '\n</script>\n'
    '<script id="scout-data">\n/* ==== the 3D view\'s materials (CC0 photo-scanned textures from Poly Haven and ambientCG, vendor/textures/SOURCES.md) and the table of USGS lidar collections over DFW (vendor/dfw-lidar.json) ==== */\n' + data_js + '\n</script>\n'
    '<script id="scout-lidar">\n' + lidar_js.strip() + '\n</script>\n'
    '<script id="scout-tf">\n/* ==== vendor/tf.bundle.js (TensorFlow.js core and WebGL backend 4.22.0, Apache-2.0, vendor/TFJS-LICENSE) ==== */\n' + tf_js.strip() + '\n</script>\n'
    '<script id="scout-sr">\n' + sr_js.strip() + '\n</script>\n'
    '<script id="scout-3d">\n' + js3d.strip() + '\n</script>\n'
    '<script id="scout-js">\n' + js.strip() + '\n</script>\n'
    '<!-- rooftop-scout:end -->'
)
i = html.index(ANCHOR) + len(ANCHOR)
out = html[:i] + block + html[i:]
open(OUT, 'w', encoding='utf-8').write(out)
print('wrote', OUT, len(out), 'bytes; added', len(out) - len(html), '; sha256', hashlib.sha256(out.encode()).hexdigest()[:16])
