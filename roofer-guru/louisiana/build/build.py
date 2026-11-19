"""Assemble the Uplift Louisiana Roofing Atlas with Rooftop Scout (module 18).
Leaflet and the module go in front of the shell boot script, so the module registers with the others; the heavy parts
(three.js, the 3D materials, ONNX Runtime, the AI tracing, TensorFlow.js, the AI detail, the 3D view and the Scout Engine) go at the end of
the body, so they parse after the shell has drawn the first module and no other module waits for them. Vendor parts are
verbatim from the DFW build; the adapted parts (style, engine style, trace, 3d, engine, module) come from this folder."""
import sys, os, re, hashlib, json
SP = os.path.dirname(os.path.abspath(__file__))
DFW = os.path.join(os.path.dirname(SP), 'dfw')
SRC = '/root/.claude/uploads/3de4e742-518d-5f10-b5db-2b34e6723642/3de810ec-uplift-louisiana-roofing-atlas_2.html'
OUT = sys.argv[1] if len(sys.argv) > 1 else '/home/user/Leviathan/louisiana-roofer-guru.html'
def rd(p):
    with open(p, encoding='utf-8') as f: return f.read()
# Round 11: module 18's name. The module was Rooftop Scout; it is Louisiana Roofer Guru, wherever it names itself (its
# tab, its header and foot, its CSV, its notes). The atlas's other modules keep the atlas's name.
NAME = [('Rooftop Scout', 'Louisiana Roofer Guru'), ('louisiana-rooftop-scout-', 'louisiana-roofer-guru-')]
def part(d, f):
    t = rd(os.path.join(DFW if d == 'dfw' else SP, f))
    if d != 'dfw':
        for a, b in NAME: t = t.replace(a, b)
    if f == 'leaflet.js':
        # Leaflet's UMD header also sets globalThis.leaflet, and noConflict leaves an own window.L of undefined: remove both,
        # so the library stays private to the module as its header says
        nc = 'window.__SCOUT_LEAFLET__ = window.L && typeof window.L.noConflict === "function" ? window.L.noConflict() : null;'
        assert t.count(nc) == 1, 'leaflet noConflict line not found exactly once'
        t = t.replace(nc, nc + '\ntry { if (window.leaflet === window.__SCOUT_LEAFLET__) delete window.leaflet; if (window.L === undefined) delete window.L; } catch (e) { /* fine */ }')
    return t if t.endswith('\n') else t + '\n'
la = rd(SRC)
# fixes to the source atlas itself, each anchored on text that must occur exactly once
SRC_FIXES = [
    # module 15 (Accounts) read the Campaign Desk's plan under the key of the atlas it was built from (the Contraflow
    # Injury Atlas), so its pacing never saw this atlas's budget
    ("const desk = store.get('cf.desk.v1', {}) || {};", "const desk = store.get('up.desk.v1', {}) || {};"),
    # the accounts, CMS and Publish stores still used the Contraflow keys, which that atlas reads and writes too when both
    # are opened from disk or from one site: this atlas's own keys, the first read copying what the old key holds so
    # nothing saved is lost
    ("const KEY = 'cf.accounts.v1';", "const KEY = 'up.accounts.v1', OLD_KEY = 'cf.accounts.v1';"),
    ("const readyP = kv.get(KEY, null).then(v => { if (v && typeof v === 'object') S = Object.assign(S, v); ready = true; BUS.emit('acct'); });",
     "const readyP = kv.get(KEY, null).then(v => v != null ? v : kv.get(OLD_KEY, null).then(o => { if (o != null) kv.set(KEY, o); return o; })).then(v => { if (v && typeof v === 'object') S = Object.assign(S, v); ready = true; BUS.emit('acct'); });"),
    ("const KEY = 'cf.cms.v1';", "const KEY = 'up.cms.v1', OLD_KEY = 'cf.cms.v1';"),
    ("kv.get(KEY, null).then(v => { if (v && typeof v === 'object') { S = Object.assign(S, v); S.cfg = S.cfg || {};",
     "kv.get(KEY, null).then(v => v != null ? v : kv.get(OLD_KEY, null).then(o => { if (o != null) kv.set(KEY, o); return o; })).then(v => { if (v && typeof v === 'object') { S = Object.assign(S, v); S.cfg = S.cfg || {};"),
    ("const CK = 'cf.publish.composer';", "const CK = 'up.publish.composer';"),
    # the composer copies a draft held under the old key once, so a later draft of the other atlas does not show here
    ("clean: true }, store.get(CK, {}) || {});", "clean: true }, store.get(CK, null) || (o => { if (o && typeof o === 'object') store.set(CK, o); return o; })(store.get('cf.publish.composer', null)) || {});"),
    ("store.set('cf.publish.loaded', {", "store.set('up.publish.loaded', {"),
    ("store.get('cf.publish.loaded', null)", "store.get('up.publish.loaded', null)"),
    # round 11: the page takes the dashboard's final name
    ('<title>Uplift Roofing Atlas</title>', '<title>Louisiana Roofer Guru</title>'),
    ("document.title = brandSet() ? `${brandShort()} · Uplift Roofing Atlas` : 'Uplift Roofing Atlas';", "document.title = brandSet() ? `${brandShort()} · Louisiana Roofer Guru` : 'Louisiana Roofer Guru';"),
]
# the fifth review's integration audit of the original modules: each entry names the module, the finding and the reason
SRC_FIXES += [(f['old'], f['new']) for f in json.load(open(os.path.join(SP, 'src_fixes.json'), encoding='utf-8'))]
for a, b in SRC_FIXES:
    assert la.count(a) == 1, ('source fix anchor not found exactly once', la.count(a), a[:80])
    la = la.replace(a, b)
left = sorted(set(re.findall(r"'(cf\.[a-z.0-9]+)'", la)))
assert left == ['cf.accounts.v1', 'cf.cms.v1', 'cf.publish.composer'], ('a Contraflow storage key is left besides the fallbacks', left)
# the shell boot script: the <script> whose body starts with the lang guard and 99_shell.js
anchor = "<script>\nif (!document.documentElement.lang) document.documentElement.lang = 'en';\n/* ==== 99_shell.js ==== */"
assert la.count(anchor) == 1, 'shell anchor not found exactly once'
assert 'rooftop-scout:start' not in la, 'the source already carries a scout block'
head = [('dfw', 'leaflet.css'), ('build', 'scout-style.css'), ('build', 'engine-style.css'), ('dfw', 'leaflet.js'), ('build', 'scout.js')]
tail = [('dfw', 'three.js'), ('dfw', 'data.js'), ('dfw', 'ort-wasm.js'), ('dfw', 'ort-webgpu.js'), ('build', 'trace.js'),
        ('dfw', 'tf.js'), ('dfw', 'sr.js'), ('build', 'scout3d.js'), ('build', 'engine.js')]
blk = ['<!-- rooftop-scout:start (module 18: the heatmaps on satellite imagery, Street View from the road, every roof read) -->\n']
blk += [part(d, f) for d, f in head]
blk.append('<!-- rooftop-scout:end (its 3D and AI parts are at the end of the body) -->\n')
end = ['<!-- rooftop-scout:3d-ai:start (module 18: the 3D view, the AI tracing and AI detail, parsed after the first module draws) -->\n']
end += [part(d, f) for d, f in tail]
end.append('<!-- rooftop-scout:3d-ai:end -->\n')
out = la.replace(anchor, ''.join(blk) + anchor)
i = out.rfind('</body>')
assert i > 0 and out[i:].replace('\n', '') == '</body></html>', 'the closing body tag is not the last tag'
out = out[:i] + ''.join(end) + out[i:]
with open(OUT, 'w', encoding='utf-8') as f: f.write(out)
print('wrote', OUT, len(out.encode('utf-8')), 'bytes; sha1', hashlib.sha1(out.encode('utf-8')).hexdigest()[:12])
