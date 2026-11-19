"""California edition, step 0 (run once): lay out the editable sources.

   - the Louisiana atlas as first supplied, with the fixes Louisiana's build applies to the original modules baked in,
     is cut at its <script> tags into ordered parts under ca/atlas/src/ (manifest.json lists them in page order);
     the data script (window.__ATLAS_DATA__ and window.__NWS_SNAPSHOT__) is not kept: California's is generated;
   - module 18's parts as Louisiana shipped them are copied to ca/scout/ and ca/engine/ as the bases to edit.

   python3 -I setup_ca.py            (refuses to overwrite an existing ca/atlas/src)"""
import os, re, json, sys, shutil
HERE = os.path.dirname(os.path.abspath(__file__))
CA = os.path.dirname(HERE)
SP = os.path.dirname(CA)
SRC = os.path.join(CA, 'la_atlas_source.html')
LB = os.path.join(SP, 'build')
def rd(p):
    with open(p, encoding='utf-8') as f: return f.read()
def wr(p, t):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, 'w', encoding='utf-8') as f: f.write(t)

la = rd(SRC)
FIX = [
    ("const desk = store.get('cf.desk.v1', {}) || {};", "const desk = store.get('up.desk.v1', {}) || {};"),
]
FIX += [(f['old'], f['new']) for f in json.load(open(os.path.join(LB, 'src_fixes.json'), encoding='utf-8'))]
for a, b in FIX:
    assert la.count(a) == 1, ('anchor not found exactly once', la.count(a), a[:80])
    la = la.replace(a, b)

out = os.path.join(CA, 'atlas', 'src')
if os.path.exists(out):
    sys.exit('ca/atlas/src exists already: not overwritten')
lines = la.split('\n')
parts, cur, kind = [], [], 'html'
for ln in lines:
    if ln == '<script>':
        assert kind == 'html'
        cur.append(ln); parts.append(('html', cur)); cur, kind = [], 'script'
    elif ln == '</script>' and kind == 'script':
        parts.append(('script', cur)); cur, kind = [ln], 'html'
    else:
        assert '<script' not in ln or kind == 'script' or ln.startswith('<script>') is False and '<script' in ln and False, ('unexpected script tag', ln[:120])
        cur.append(ln)
parts.append((kind, cur))
man, n, nh = [], 0, 0
for k, body in parts:
    text = '\n'.join(body)
    if k == 'html':
        name = 'html_%02d.html' % nh; nh += 1
    else:
        if body and body[0].startswith('window.__ATLAS_DATA__'):
            man.append({'kind': 'data'}); continue
        m = None
        for ln in body[:4]:
            m = re.match(r'/\* ==== (?:src/)?([A-Za-z0-9_/.]+)\.js ==== \*/', ln)
            if m: break
        if m: nm = m.group(1).replace('/', '_')
        elif 'FORGE_BRIDGE_PHP' in text[:400]: nm = '07_forge_bridge_raw'
        elif '99_shell.js' in text[:400]: nm = '99_shell'
        else: nm = 'script_%02d' % n
        name = '%s.js' % nm
        assert not any(x.get('file') == name for x in man), name
        n += 1
    wr(os.path.join(out, name), text)
    man.append({'kind': k, 'file': name, 'lines': len(body), 'bytes': len(text.encode('utf-8'))})
wr(os.path.join(out, 'manifest.json'), json.dumps(man, indent=1))
# check: the parts put back together are the fixed page, less the data script
back = []
for m in man:
    if m['kind'] == 'data': back.append('window.__ATLAS_DATA__'); continue
    back.append(rd(os.path.join(out, m['file'])))
print(len(man), 'parts;', sum(1 for m in man if m['kind'] == 'script'), 'scripts')
for m in man: print(' ', m)

for f in ('scout.js', 'scout-style.css', 'scout3d.js', 'trace.js'):
    shutil.copy(os.path.join(LB, f), os.path.join(CA, 'scout', f) if os.path.isdir(os.path.join(CA, 'scout')) else (os.makedirs(os.path.join(CA, 'scout')) or os.path.join(CA, 'scout', f)))
os.makedirs(os.path.join(CA, 'engine'), exist_ok=True)
for f in ('engine.js', 'engine-style.css'):
    shutil.copy(os.path.join(LB, f), os.path.join(CA, 'engine', 'la_' + f))
print('bases copied')
