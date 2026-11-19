import sys,re,html
t=open(sys.argv[1],errors='ignore').read()
t=re.sub(r'(?s)<script.*?</script>|<style.*?</style>|<!--.*?-->','',t)
t=re.sub(r'(?i)<(br|/p|/div|/h\d|/li|/tr)[^>]*>','\n',t)
t=html.unescape(re.sub(r'<[^>]+>',' ',t))
t=re.sub(r'[ \t\r\f\v]+',' ',t); t=re.sub(r'\n\s*\n+','\n',t)
if len(sys.argv)>2:
    k=sys.argv[2]; w=int(sys.argv[3]) if len(sys.argv)>3 else 1500
    for m in re.finditer(k,t):
        i=m.start(); print('...',t[max(0,i-200):i+w],'...\n-----')
        if len(sys.argv)>4 and sys.argv[4]=='1': break
else:
    print(t)
