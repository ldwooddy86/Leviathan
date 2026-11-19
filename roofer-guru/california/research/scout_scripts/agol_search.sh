#!/bin/bash
# usage: agol_search.sh "<query>" [num]  -> ArcGIS Online public item search (feature/map services)
q="$1"; n="${2:-15}"
curl -sS -m 60 -G 'https://www.arcgis.com/sharing/rest/search' --data-urlencode "q=$q" --data-urlencode "num=$n" --data-urlencode 'sortField=numviews' --data-urlencode 'sortOrder=desc' --data-urlencode 'f=json' | python3 -I -c "
import json,sys,time
j=json.load(sys.stdin)
print('total',j.get('total'))
for r in j.get('results',[]):
    print('-',r.get('title'),'|',r.get('type'),'|',r.get('owner'),'| views',r.get('numViews'),'| mod',time.strftime('%Y-%m-%d',time.gmtime(r.get('modified',0)/1000)),'|',r.get('access'),'\n   ',r.get('url'))"
