"""Harness page: the atlas parts in manifest order with a data file, no Scout. Other people's parts come from a private
   snapshot (work_desk/snap, taken on first run) so the page stays stable; my six files are always read live.
   python3 -I harness_build.py <data.json> <out.html> [--live]   (--live: read every part from atlas/src)"""
import sys, os, json, shutil
HERE = os.path.dirname(os.path.abspath(__file__)); CA = os.path.dirname(HERE)
SRC = os.path.join(CA, 'atlas', 'src'); SNAP = os.path.join(HERE, 'snap')
MINE = {'18_m06_ground.js', '19_m07_field.js', '20_m08_desk.js', '12_accounts_core.js', '27_m15_accounts.js', '30_m16_publish.js'}
data_path, out = sys.argv[1], sys.argv[2]; live = '--live' in sys.argv
if not os.path.isdir(SNAP): shutil.copytree(SRC, SNAP)
man = json.load(open(os.path.join(SRC, 'manifest.json'), encoding='utf-8'))
def rd(p): return open(p, encoding='utf-8').read()
def safe(t): return t.replace('</', '<\\/').replace('\u2028', '\\u2028').replace('\u2029', '\\u2029')
data = json.dumps(json.load(open(data_path, encoding='utf-8')), separators=(',', ':'), ensure_ascii=False)
nws_p = os.path.join(CA, 'data', 'hazard', 'out', 'ca_nws_snapshot.json')
nws = json.dumps(json.load(open(nws_p, encoding='utf-8')), separators=(',', ':'), ensure_ascii=False) if os.path.exists(nws_p) else 'null'
parts = []
for m in man:
    if m['kind'] == 'data':
        parts.append('window.__ATLAS_DATA__ = ' + safe(data) + ';\nwindow.__NWS_SNAPSHOT__ = ' + safe(nws) + ';')
    else:
        f = m['file']; parts.append(rd(os.path.join(SRC if (live or f in MINE) else SNAP, f)))
open(out, 'w', encoding='utf-8').write('\n'.join(parts))
print('wrote', out, os.path.getsize(out), 'bytes;', 'live' if live else 'snapshot + my six files')
