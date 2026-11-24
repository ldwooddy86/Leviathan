import json,sys
w=json.load(open('world.json'))
def desc(v,depth=0,key='',maxd=4):
    ind='  '*depth
    if isinstance(v,dict):
        ks=list(v.keys())
        print(f"{ind}{key}: dict[{len(ks)}] keys={ks[:14]}{'...' if len(ks)>14 else ''}")
        if depth<maxd:
            # if many homogeneous keys, sample first
            if len(ks)>40:
                desc(v[ks[0]],depth+1,ks[0]+' (sample)',maxd)
            else:
                for k in ks: desc(v[k],depth+1,k,maxd)
    elif isinstance(v,list):
        t=type(v[0]).__name__ if v else 'empty'
        s=json.dumps(v[:6])[:150]
        print(f"{ind}{key}: list[{len(v)}] of {t}  {s}")
        if v and isinstance(v[0],(dict,list)) and depth<maxd:
            desc(v[0],depth+1,'[0]',maxd)
    else:
        print(f"{ind}{key}: {type(v).__name__} = {json.dumps(v)[:150]}")
desc(w,0,'world',int(sys.argv[1]) if len(sys.argv)>1 else 3)
