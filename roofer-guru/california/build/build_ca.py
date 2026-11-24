"""Assemble California Roofer Guru.

   The atlas's parts (ca/atlas/src, in manifest order) with California's data in place of the data script, then module 18:
   Leaflet and the Scout module in front of the shell boot script, the heavy parts (three.js, the tracing model, ONNX
   Runtime, TensorFlow.js, the detail model, the 3D view and the Scout Engine) at the end of the body. Vendor parts are
   the ones Louisiana's page carries (SP/dfw).

   python3 -I build_ca.py [out.html] [--data <atlas_data.json>] [--nws <nws_snapshot.json>] [--engine <engine.js>]"""
import sys, os, json, hashlib, re
HERE = os.path.dirname(os.path.abspath(__file__))
CA = os.path.dirname(HERE)
SP = os.path.dirname(CA)
DFW = os.path.join(SP, 'dfw')
args = sys.argv[1:]
def opt(name, default):
    if name in args:
        i = args.index(name); v = args[i + 1]; del args[i:i + 2]; return v
    return default
DATA = opt('--data', os.path.join(CA, 'data', 'out', 'ca_atlas_data.json'))
NWS = opt('--nws', os.path.join(CA, 'data', 'hazard', 'out', 'ca_nws_snapshot.json'))
ENGINE = opt('--engine', os.path.join(CA, 'engine', 'out', 'engine.js'))
ESTYLE = opt('--engine-style', os.path.join(CA, 'engine', 'out', 'engine-style.css'))
SCOUT = opt('--scout-dir', os.path.join(CA, 'scout'))
OUT = args[0] if args else '/home/user/Leviathan/california-roofer-guru.html'
def rd(p):
    with open(p, encoding='utf-8') as f: return f.read()
def nl(t): return t if t.endswith('\n') else t + '\n'

src = os.path.join(CA, 'atlas', 'src')
man = json.load(open(os.path.join(src, 'manifest.json'), encoding='utf-8'))
def js_safe(obj_text):
    # JSON inside a <script>: no closing tag, no line separators that end a JS line
    return obj_text.replace('</', '<\\/').replace('\u2028', '\\u2028').replace('\u2029', '\\u2029')
data = json.dumps(json.load(open(DATA, encoding='utf-8')), separators=(',', ':'), ensure_ascii=False)
nws = json.dumps(json.load(open(NWS, encoding='utf-8')), separators=(',', ':'), ensure_ascii=False)
parts = []
for m in man:
    if m['kind'] == 'data':
        parts.append('window.__ATLAS_DATA__ = ' + js_safe(data) + ';\nwindow.__NWS_SNAPSHOT__ = ' + js_safe(nws) + ';')
    else:
        parts.append(rd(os.path.join(src, m['file'])))
page = '\n'.join(parts)

def vendor(f):
    t = rd(os.path.join(DFW, f))
    if f == 'leaflet.js':
        nc = 'window.__SCOUT_LEAFLET__ = window.L && typeof window.L.noConflict === "function" ? window.L.noConflict() : null;'
        assert t.count(nc) == 1, 'leaflet noConflict line not found exactly once'
        t = t.replace(nc, nc + '\ntry { if (window.leaflet === window.__SCOUT_LEAFLET__) delete window.leaflet; if (window.L === undefined) delete window.L; } catch (e) { /* fine */ }')
    return nl(t)
def own(p): return nl(rd(p))
S = SCOUT
anchor = "<script>\nif (!document.documentElement.lang) document.documentElement.lang = 'en';\n/* ==== 99_shell.js ==== */"
assert page.count(anchor) == 1, 'shell anchor not found exactly once'
blk = ['<!-- rooftop-scout:start (module 18: the heatmaps on satellite imagery, Street View from the road, every roof read) -->\n',
       vendor('leaflet.css'), own(os.path.join(S, 'scout-style.css')), own(ESTYLE), vendor('leaflet.js'), own(os.path.join(S, 'scout.js')),
       '<!-- rooftop-scout:end (its 3D and AI parts are at the end of the body) -->\n']
end = ['<!-- rooftop-scout:3d-ai:start (module 18: the 3D view, the AI tracing and AI detail, parsed after the first module draws) -->\n',
       vendor('three.js'), vendor('data.js'), vendor('ort-wasm.js'), vendor('ort-webgpu.js'), own(os.path.join(S, 'trace.js')),
       vendor('tf.js'), vendor('sr.js'), own(os.path.join(S, 'scout3d.js')), own(ENGINE), '<!-- rooftop-scout:3d-ai:end -->\n']
page = page.replace(anchor, ''.join(blk) + anchor)
i = page.rfind('</body>')
assert i > 0 and page[i:].replace('\n', '') == '</body></html>', 'the closing body tag is not the last tag'
page = page[:i] + ''.join(end) + page[i:]
with open(OUT, 'w', encoding='utf-8') as f: f.write(page)
print('wrote', OUT, len(page.encode('utf-8')), 'bytes; sha1', hashlib.sha1(page.encode('utf-8')).hexdigest()[:12])
# words that must not be in a California page (reported, not fatal: vendor code and quoted law may hold some)
body = page
for w in ['Louisiana', 'parish', 'Parish', 'hurricane', 'Hurricane', 'LSLBC', 'FORTIFIED', 'New Orleans', 'Baton Rouge', 'Gulf Coast', "cf.", "'up."]:
    n = body.count(w)
    if n: print('  left in page:', repr(w), n)
