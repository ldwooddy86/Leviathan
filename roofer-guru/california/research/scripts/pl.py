# print public.law section text: pl.py DIR CODE:SEC [maxlen]
import sys,re,html,os
D=sys.argv[1]; maxlen=int(os.environ.get('MAXLEN','3000'))
for arg in sys.argv[2:]:
    code,sec=arg.split(':')
    fn=os.path.join(D,f'pl_{code}_{sec}.html')
    if not os.path.exists(fn): print(f'#### PL {code} {sec}: NO FILE'); continue
    t=open(fn,errors='ignore').read()
    t=re.sub(r'(?s)<script.*?</script>|<style.*?</style>|<!--.*?-->','',t)
    t=html.unescape(re.sub(r'<[^>]+>',' ',t)); t=re.sub(r'\s+',' ',t)
    m=re.search(r'§\s*'+re.escape(sec)+r'\s+(.*?)\s+Source:\s+Section',t)
    upd=re.search(r'\(updated ([^;]+); accessed ([^)]+)\)',t)
    body=m.group(1) if m else '[NOT PARSED] '+t[:300]
    print(f'#### PL {code} {sec} [public.law; {upd.group(0) if upd else "no date"}] len={len(body)}')
    print(body[:maxlen]); 
    if len(body)>maxlen: print(f'... [TRUNCATED {len(body)-maxlen}]')
    print()
