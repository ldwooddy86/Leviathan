#!/bin/bash
cd "$(dirname "$0")"
export NODE_PATH=/opt/node-tools/node_modules
run() { echo "== $2 ($3, $4, $5)" >> ../shots/run.log; timeout 1500 node shots.js ../out/tb.html "$2" ../shots/$1 $3 $4 "$5" 2>&1 | cut -c1-1900 >> ../shots/run.log; }
run la_110_fwy "1000 W Temple St, Los Angeles, CA" drone 15,3 fwy
run la_110_fwy "1000 W Temple St, Los Angeles, CA" drone 17 fwy
echo ALLDONE4 >> ../shots/run.log
