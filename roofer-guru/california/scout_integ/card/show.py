import json, re, sys
R = json.load(open('card_ca.json'))
def grab(t, pat, n=420):
    m = re.search(pat, t, re.I | re.S); return (m.group(0)[:n].replace('\n', ' / ') if m else '-')
sel = sys.argv[1:] 
for r in R:
    if sel and not any(s.lower() in r['addr'].lower() for s in sel): continue
    t = r.get('text', '')
    print('#####', r['addr'], '->', r['name'], '|', r['sub'][:90])
    print('  OUT :', grab(t, r'THE NEXT 15 YEARS.{0,330}', 330))
    print('  WX  :', grab(t, r"weather on record at this roof.{0,%d}" % (int(sys.argv[0] == 'x') or 620), 620))
    print('  YEAR:', grab(t, r'[^\n]*(year built|built in |built about|built around)[^\n]*', 230))
    print('  PERM:', grab(t, r'[^\n]*(roof permit|re-roof permit|permit on file)[^\n]*', 230))
    print('  TOPO:', (r['topo'][0][:300] if r['topo'] else '-'))
