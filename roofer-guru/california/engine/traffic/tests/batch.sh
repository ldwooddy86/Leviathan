#!/bin/bash
cd "$(dirname "$0")"
export NODE_PATH=/opt/node-tools/node_modules
run() { echo "== $2 ($3, $4)" >> ../shots/run.log; timeout 1500 node shots.js ../out/tb.html "$2" ../shots/$1 $3 $4 2>&1 | cut -c1-1600 >> ../shots/run.log; }
run la_4level "1000 W Temple St, Los Angeles, CA" bird 17,3
run sf_market "865 Market St, San Francisco, CA" drone 17
run sd_i5 "1955 Logan Ave, San Diego, CA" bird 17
echo ALLDONE >> ../shots/run.log
