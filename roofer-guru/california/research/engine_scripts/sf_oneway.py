import json, math, collections
D='/tmp/claude-0/-home-user-Leviathan/3de4e742-518d-5f10-b5db-2b34e6723642/scratchpad/ca/dl/engine/datasf_streets/'
R=json.load(open(D+'streets_active.json'))
def length(line):
    if not line: return 0
    cs=line['coordinates']
    parts=cs if line['type']=='MultiLineString' else [cs]
    t=0
    for cs in parts:
        for (x1,y1),(x2,y2) in zip(cs,cs[1:]):
            dx=(x2-x1)*math.cos(math.radians((y1+y2)/2))*111320; dy=(y2-y1)*110540
            t+=math.hypot(dx,dy)
    return t
S=[r for r in R if r.get('layer')=='STREETS']
for r in S: r['len']=length(r.get('line'))
def share(rows):
    n=len(rows); L=sum(r['len'] for r in rows)
    ow=[r for r in rows if r.get('oneway') in ('F','T')]
    return n, L/1609.344, 100*len(ow)/max(n,1), 100*sum(r['len'] for r in ow)/max(L,1)
print('layer STREETS, active: segments %d, miles %.0f, one-way share by count %.1f%%, by length %.1f%%'%share(S))
by=collections.defaultdict(list)
for r in S: by[r.get('analysis_neighborhood')].append(r)
rows=[]
for k,v in by.items():
    n,mi,pc,pl=share(v); rows.append((pl,k,n,mi,pc))
for pl,k,n,mi,pc in sorted(rows,reverse=True)[:14]:
    print('  %-34s segs %5d miles %6.1f one-way by count %5.1f%% by length %5.1f%%'%(k,n,mi,pc,pl))
dt=[r for r in S if r.get('analysis_neighborhood') in ('Financial District/South Beach','South of Market','Tenderloin','Chinatown','Nob Hill')]
print('Downtown group (FiDi/South Beach, SoMa, Tenderloin, Chinatown, Nob Hill): segs %d miles %.0f one-way by count %.1f%% by length %.1f%%'%share(dt))
# by classcode
cc=collections.defaultdict(list)
for r in S: cc[r.get('classcode')].append(r)
for k in sorted(cc): print('  classcode',k,'segs %d miles %.0f one-way by count %.1f%% by length %.1f%%'%share(cc[k]))
