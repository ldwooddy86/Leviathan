import json, sys, re
D='/tmp/claude-0/-home-user-Leviathan/3de4e742-518d-5f10-b5db-2b34e6723642/scratchpad/ca/dl/engine/'
name=sys.argv[1]; rte=sys.argv[2]; pat=sys.argv[3] if len(sys.argv)>3 else None
d=json.load(open(D+'caltrans_aadt_%s.json'%name))
rows=[f['attributes'] for f in d['features']]
def num(x):
    try: return int(str(x).replace(',','').strip())
    except: return None
sel=[r for r in rows if r['RTE'].lstrip('0')==rte.lstrip('0')]
if pat=='TOP':
    sel=sorted(sel, key=lambda r: -(max(num(r['BACK_AADT']) or 0, num(r['AHEAD_AADT']) or 0)))[:int(sys.argv[4])]
elif pat:
    sel=[r for r in sel if re.search(pat, r['DESCRIPTION'] or '', re.I)]
for r in sel:
    print('%s %s %s%s%s | %-48s | back pk %s aadt %s | ahead pk %s aadt %s' % (r['RTE'], r['CNTY'], (r['PM_PFX'] or '').strip(), r['PM'], (r['PM_SFX'] or '').strip(), (r['DESCRIPTION'] or '')[:48], r['BACK_PEAK_HOUR'], r['BACK_AADT'], r['AHEAD_PEAK_HOUR'], r['AHEAD_AADT']))
