# kw.py CODE:SEC width 'kw1|kw2|...'  -> prints context around first match of each keyword, from public.law (pl) and history line from wayback (wb)
import sys,re,html,os
SP='/tmp/claude-0/-home-user-Leviathan/3de4e742-518d-5f10-b5db-2b34e6723642/scratchpad'
PL=SP+'/ca/dl/law/publaw'; WB=SP+'/ca/dl/law/statutes'
def clean(t):
    t=re.sub(r'(?s)<script.*?</script>|<style.*?</style>|<!--.*?-->','',t)
    t=html.unescape(re.sub(r'<[^>]+>',' ',t)); return re.sub(r'\s+',' ',t)
def pl(code,sec):
    fn=f'{PL}/pl_{code}_{sec}.html'
    if not os.path.exists(fn) or os.path.getsize(fn)<12000: return None,None
    t=clean(open(fn,errors='ignore').read())
    m=re.search(r'§\s*'+re.escape(sec)+r'\s+(.*?)\s+Source:\s+Section',t)
    upd=re.search(r'\(updated ([^;]+); accessed ([^)]+)\)',t)
    return (m.group(1) if m else None),(upd.group(0) if upd else '')
def wb(code,sec):
    fn=f'{WB}/wb_{code}_{sec}.html'
    if not os.path.exists(fn) or os.path.getsize(fn)<20000: return None,None,None
    raw=open(fn,errors='ignore').read()
    cap=re.search(r'/web/(\d{14})/https://leginfo',raw)
    t=clean(raw); i=t.find('Code Text'); body=t[i+9:] if i>=0 else ''
    j=body.find(sec+'.'); body=body[j:] if j>=0 else body
    h=re.findall(r'\((?:Amended|Added|Repealed|Enacted)[^()]*(?:\([^()]*\)[^()]*)*\)',body)
    return body,(cap.group(1) if cap else '?'),(h[-1] if h else '')
code,sec=sys.argv[1].split(':'); w=int(sys.argv[2]); kws=sys.argv[3].split('|') if len(sys.argv)>3 else []
pb,upd=pl(code,sec); wbody,cap,hist=wb(code,sec)
print(f'#### {code} {sec} | public.law {upd if pb else "MISSING"} len={len(pb) if pb else 0} | wayback capture {cap} len={len(wbody) if wbody else 0} | history: {hist}')
if pb and wbody:
    n=lambda s: re.sub(r'[^a-z0-9]','',s.lower())
    a=n(pb.replace('Business and Professions Code section','').replace('Civil Code section','')); b=n(wbody)
    # crude sameness: is the last 300 normalized chars of pl body inside wb body
    tail=a[-300:] if len(a)>300 else a; mid=a[len(a)//2:len(a)//2+200]
    print('   same-text check: tail', tail in b, '| mid', mid in b)
body=pb or wbody or ''
if not kws: print(body[:w])
for k in kws:
    m=re.search(k,body)
    if m: print(f'  >> [{k}] ...{body[max(0,m.start()-int(w*0.25)):m.start()+w]}...')
    else: print(f'  >> [{k}] NOT FOUND')
