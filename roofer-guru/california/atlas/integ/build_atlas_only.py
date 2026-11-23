"""The seventeen atlas modules alone (no module 18, no vendor parts): python3 -I build_atlas_only.py <out.html>
   Used to show the atlas does not depend on the Scout tab."""
import sys, os, json
HERE = os.path.dirname(os.path.abspath(__file__)); CA = os.path.dirname(os.path.dirname(HERE))
src = os.path.join(CA, 'atlas', 'src'); man = json.load(open(os.path.join(src, 'manifest.json'), encoding='utf-8'))
def js_safe(t): return t.replace('</', '<\\/').replace('\u2028', '\\u2028').replace('\u2029', '\\u2029')
data = json.dumps(json.load(open(os.path.join(CA, 'data', 'out', 'ca_atlas_data.json'), encoding='utf-8')), separators=(',', ':'), ensure_ascii=False)
nws = json.dumps(json.load(open(os.path.join(CA, 'data', 'hazard', 'out', 'ca_nws_snapshot.json'), encoding='utf-8')), separators=(',', ':'), ensure_ascii=False)
parts = []
for m in man:
    if m['kind'] == 'data': parts.append('window.__ATLAS_DATA__ = ' + js_safe(data) + ';\nwindow.__NWS_SNAPSHOT__ = ' + js_safe(nws) + ';')
    else: parts.append(open(os.path.join(src, m['file']), encoding='utf-8').read())
open(sys.argv[1], 'w', encoding='utf-8').write('\n'.join(parts)); print('wrote', sys.argv[1])
