#!/bin/bash
cd "$(dirname "$0")"
export NODE_PATH=/opt/node-tools/node_modules
run() { echo "== $2 ($3, $4, $5)" >> ../shots/run.log; timeout 1700 node shots.js ../out/tb.html "$2" ../shots/$1 $3 $4 "$5" 2>&1 | cut -c1-1900 >> ../shots/run.log; }
run la_110_fwy "1000 W Temple St, Los Angeles, CA" drone 16 fwy
HERO=1 run sf_market_st "865 Market St, San Francisco, CA" bird 15 "Market Street"
echo ALLDONE6 >> ../shots/run.log
