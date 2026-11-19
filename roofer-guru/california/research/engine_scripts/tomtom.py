import re, html, json, sys
D='/tmp/claude-0/-home-user-Leviathan/3de4e742-518d-5f10-b5db-2b34e6723642/scratchpad/ca/dl/engine/'
T='/tmp/claude-0/-home-user-Leviathan/3de4e742-518d-5f10-b5db-2b34e6723642/scratchpad/research/ca/engine_txt/'
DAYS=['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY']
pat=re.compile(r'\{"time":\[0,"(MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY)-(\d+)"\],"c":\[0,([\d.]+)\],"v":\[0,([\d.]+)\],"fv":\[0,([\d.]+)\]\}')
res={}
show=len(sys.argv)>1
for city in ['la','sf','sd']:
    u=html.unescape(open(D+'tomtom_%s.html'%city,encoding='utf-8',errors='ignore').read())
    i=u.find('"traffic":[0,{"metro":')
    j=u.find('"trafficPrevious"',i)
    seg=u[i:j]
    k=seg.find('"center":[0,{')
    parts={'metro':seg[:k],'center':seg[k:]}
    res[city]={}
    for area,txt in parts.items():
        a0=txt.find('"all":[0,{'); h0=txt.find('"highways":[0,{'); n0=txt.find('"nonHighways":[0,{')
        blocks={'all':txt[a0:h0],'highways':txt[h0:n0],'nonHighways':txt[n0:]}
        info={}
        for bn,b in blocks.items():
            for key in ['base','am','pm','ampm']:
                m=re.search(r'"%s":\[0,\{([^}]*)\}\]'%key,b)
                if m:
                    kv=dict(re.findall(r'"([a-zA-Z0-9]+)":\[0,([-\d.]+)\]',m.group(1)))
                    info['%s.%s'%(bn,key)]=kv
        M={}
        for d,h,c,v,fv in pat.findall(blocks['all']):
            M[(d,int(h))]=(float(c),float(v),float(fv))
        res[city][area]={'summary':info,'weekHour':{'%s-%d'%k:v for k,v in M.items()}}
        print('==',city,area,'weekHour entries',len(M))
        for kk,vv in info.items(): print('   ',kk,vv)
        if show and len(M)>=168:
            print('  hour | weekday speed km/h (mph) | congestion % | free-flow km/h | weekend speed km/h (mph)')
            for h in range(24):
                wk=[M[(d,h)] for d in DAYS[:5]]; we=[M[(d,h)] for d in DAYS[5:]]
                v=sum(x[1] for x in wk)/5; c=sum(x[0] for x in wk)/5; fv=sum(x[2] for x in wk)/5; v2=sum(x[1] for x in we)/2
                print('  %02d | %.1f (%.1f) | %.0f | %.1f | %.1f (%.1f)'%(h,v,v*0.621371,c,fv,v2,v2*0.621371))
json.dump(res, open(T+'tomtom_2025_weekhours.json','w'))
