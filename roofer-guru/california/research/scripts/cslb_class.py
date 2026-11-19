import html,re,subprocess,sys,urllib.parse
UA="Mozilla/5.0 (compatible; research-downloader)"
url="https://www.cslb.ca.gov/OnlineServices/DataPortal/ListByClassification"
out=sys.argv[1]; cls=sys.argv[2]; jar=out+".cookies"
r=subprocess.run(["curl","-sS","--fail","-L","-m","120","-A",UA,"-c",jar,"-b",jar,url],capture_output=True)
page=r.stdout.decode("utf-8","replace")
f={}
for m in re.finditer(r'<input[^>]+type="hidden"[^>]*>',page,re.I):
    tag=m.group(0); n=re.search(r'name="([^"]*)"',tag); v=re.search(r'value="([^"]*)"',tag)
    if n: f[n.group(1)]=html.unescape(v.group(1)) if v else ""
f["__EVENTTARGET"]="ctl00$MainContent$btnSearch"; f["__EVENTARGUMENT"]=""
f["ctl00$MainContent$lbClassification"]=cls
body=urllib.parse.urlencode(f)
r=subprocess.run(["curl","-sS","-L","-m","600","-A",UA,"-c",jar,"-b",jar,"-H","Content-Type: application/x-www-form-urlencoded","-e",url,"--data-binary","@-","-D",out+".hdr","-o",out,"-w","%{http_code} %{size_download} %{content_type}",url],input=body.encode(),capture_output=True)
print(r.stdout.decode(),r.stderr.decode()[:300])
