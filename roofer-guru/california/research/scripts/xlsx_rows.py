import zipfile,re,html,sys
def rows(fn):
    z=zipfile.ZipFile(fn)
    strs=[]
    if 'xl/sharedStrings.xml' in z.namelist():
        ss=re.sub(r'<(/?)x:',r'<\1',z.read('xl/sharedStrings.xml').decode('utf8','ignore'))
        strs=[html.unescape(''.join(re.findall(r'<t[^>]*>(.*?)</t>',s,flags=re.S))) for s in re.findall(r'<si>(.*?)</si>',ss,flags=re.S)]
    sheet=[n for n in z.namelist() if n.startswith('xl/worksheets/sheet')][0]
    x=re.sub(r'<(/?)x:',r'<\1',z.read(sheet).decode('utf8','ignore'))
    out=[]
    for rm in re.finditer(r'<row[^>]*>(.*?)</row>',x,flags=re.S):
        r={}
        for cm in re.finditer(r'<c r="([A-Z]+)\d+"([^>]*?)(?:/>|>(.*?)</c>)',rm.group(1),flags=re.S):
            col,attr,inner=cm.group(1),cm.group(2),cm.group(3) or ''
            v=re.search(r'<v>(.*?)</v>',inner,flags=re.S); t=re.search(r'<t[^>]*>(.*?)</t>',inner,flags=re.S)
            if 't="s"' in attr and v: val=strs[int(v.group(1))]
            elif t: val=html.unescape(t.group(1))
            elif v: val=html.unescape(v.group(1))
            else: val=''
            r[col]=val
        out.append(r)
    return out
if __name__=='__main__':
    import collections
    rs=rows(sys.argv[1]); print('rows',len(rs)); hdr=rs[0]; print(hdr)
    cols=sorted(hdr,key=lambda c:(len(c),c)); name={c:hdr[c] for c in cols}
    data=rs[1:]
    def col(label):
        for c,n in name.items():
            if n.strip().lower()==label.lower(): return c
    for lab in ['PrimaryStatus','Primary Status','County','BusinessType','Business Type','State']:
        c=col(lab)
        if c:
            cnt=collections.Counter(r.get(c,'') for r in data); print(lab,len(cnt),cnt.most_common(25))
    cc=[c for c,n in name.items() if 'lassif' in n][0]
    multi=collections.Counter()
    for r in data:
        k=[x.strip() for x in re.split(r'[|,;/ ]+',r.get(cc,'')) if x.strip()]
        multi['C-39 only' if len(k)==1 else 'C-39 plus other class(es)']+=1
    print(multi); print('sample',data[0])
