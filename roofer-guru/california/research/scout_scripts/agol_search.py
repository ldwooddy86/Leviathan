#!/usr/bin/env python3
"""ArcGIS Online public item search. usage: agol_search.py "<query>" [num] [--views]"""
import sys,json,time,urllib.request,urllib.parse
q=sys.argv[1]; n=int(sys.argv[2]) if len(sys.argv)>2 and sys.argv[2].isdigit() else 12
p={'q':q+' (type:"Feature Service" OR type:"Map Service")','num':n,'f':'json'}
if '--views' in sys.argv: p.update(sortField='numviews',sortOrder='desc')
j=json.load(urllib.request.urlopen(urllib.request.Request('https://www.arcgis.com/sharing/rest/search?'+urllib.parse.urlencode(p),headers={'User-Agent':'Mozilla/5.0'}),timeout=60))
print(f'## {q} -> total {j.get("total")}')
for r in j.get('results',[]):
    print(f"- {r.get('title')} | {r.get('type')} | {r.get('owner')} | views {r.get('numViews')} | mod {time.strftime('%Y-%m-%d',time.gmtime(r.get('modified',0)/1000))}\n    {r.get('url')}")
