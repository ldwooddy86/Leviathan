import sys,re,html,os
D=sys.argv[1]
log={}
for line in open(os.path.join(D,'_log.tsv'),errors='ignore'):
    p=line.rstrip('\n').split('\t')
    if len(p)>=5:
        m=re.search(r'/web/(\d{14})',p[4]); log[p[1]]=(p[3],m.group(1) if m else '?')
maxlen=int(os.environ.get('MAXLEN','6000'))
for arg in sys.argv[2:]:
    code,sec=arg.split(':')
    fn=os.path.join(D,f'wb_{code}_{sec}.html')
    if not os.path.exists(fn): print(f'#### {code} {sec}: NO FILE'); continue
    t=open(fn,errors='ignore').read()
    t=re.sub(r'(?s)<script.*?</script>|<style.*?</style>|<!--.*?-->','',t)
    t=re.sub(r'(?i)<(br|/p|/div|/h\d|/li|/tr)[^>]*>','\n',t)
    t=html.unescape(re.sub(r'<[^>]+>',' ',t))
    t=re.sub(r'[ \t\r\f\v]+',' ',t); t=re.sub(r'\n\s*\n+','\n',t)
    i=t.find('Code Text')
    body=t[i+9:] if i>=0 else t[-3000:]
    # start at the section number
    j=body.find(sec+'.')
    if j>=0: body=body[j:]
    st=log.get(f'{code} {sec}',('?','?'))
    print(f'#### {code} {sec}  [http {st[0]}, wayback capture {st[1]}]  len={len(body)}')
    print(body[:maxlen].strip())
    if len(body)>maxlen: print(f'... [TRUNCATED {len(body)-maxlen} chars]')
    print()
