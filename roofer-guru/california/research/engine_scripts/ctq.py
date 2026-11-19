import sys, re
T='/tmp/claude-0/-home-user-Leviathan/3de4e742-518d-5f10-b5db-2b34e6723642/scratchpad/research/ca/engine_txt/'
def rows(f):
    L=open(T+f).read().split('\n'); h=L[0].split('\t')
    return h,[l.split('\t') for l in L[1:] if l.strip()]
def n(x):
    try: return float(str(x).replace(',',''))
    except: return 0
mode=sys.argv[1]
if mode=='vol':   # vol RTE CNTY(s) [regex|TOPn]
    h,R=rows('caltrans_2024_volumes.tsv')
    rte=sys.argv[2].zfill(3); cn=sys.argv[3].split(','); pat=sys.argv[4] if len(sys.argv)>4 else None
    S=[r for r in R if r[1]==rte and r[3] in cn]
    if pat and pat.startswith('TOP'):
        S=sorted(S,key=lambda r:-max(n(r[10]),n(r[13])))[:int(pat[3:])]
    elif pat: S=[r for r in S if re.search(pat,r[7],re.I)]
    for r in S: print('%s %s %s%s | %-46s | back: pk hr %s, AADT %s | ahead: pk hr %s, AADT %s'%(r[1],r[3],r[4],r[5],r[7][:46],r[8],r[10],r[11],r[13]))
elif mode=='trk':
    h,R=rows('caltrans_2024_truck.tsv')
    rte=sys.argv[2].zfill(3); cn=sys.argv[3].split(','); pat=sys.argv[4] if len(sys.argv)>4 else None
    S=[r for r in R if r[0]==rte and r[3] in cn]
    if pat and pat.startswith('TOP'): S=sorted(S,key=lambda r:-n(r[9]))[:int(pat[3:])]
    elif pat: S=[r for r in S if re.search(pat,r[8],re.I)]
    for r in S: print('%s %s %s%s leg %s | %-40s | veh AADT %s | trucks %s (%s%%) | 2ax %s%% 3ax %s%% 4ax %s%% 5+ax %s%% | est yr %s'%(r[0],r[3],r[4],r[5],r[7],r[8][:40],r[9],r[10],r[11],r[13],r[15],r[17],r[19],r[21]))
elif mode=='pk':
    h,R=rows('caltrans_2024_peak.tsv')
    if len(sys.argv)<3: print(h); sys.exit()
    rte=sys.argv[2].zfill(3); cn=sys.argv[3].split(',')
    S=[r for r in R if r[1]==rte and r[3] in cn]
    print(h)
    for r in S: print(' | '.join(r))
