#!/bin/bash
cd "$(dirname "$0")/dl"
q(){ B="$2"; Q="[out:json][timeout:90];(way($B)[highway~\"^(motorway|trunk|motorway_link)$\"];);out tags geom;"
 for i in 1 2 3 4 5 6 7 8; do for U in https://maps.mail.ru/osm/tools/overpass/api/interpreter https://overpass-api.de/api/interpreter https://overpass.private.coffee/api/interpreter; do
  curl -sS -m 120 -o $1.tmp --data-urlencode "data=$Q" $U 2>/dev/null; if grep -q '"elements"' $1.tmp 2>/dev/null; then mv $1.tmp $1.json; echo "$1 ok $U"; return; fi; sleep 15; done; done; echo "$1 FAILED"; }
q vtroads "33.738,-118.30,33.762,-118.245"; q corroads "32.685,-117.175,32.705,-117.135"
