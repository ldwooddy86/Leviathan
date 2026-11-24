#!/bin/bash
# second round of roof-view pictures, after the fixes
cd "$(dirname "$0")"; export NODE_PATH=/opt/node-tools/node_modules HARD=16; P=../../scout_integ/ca.html; S=../../scout_integ/shots
run() { timeout 1000 node views_shots.js $P "$1" $2 $S plans/$3.json > views_$2.out 2>&1; echo "exit $?" >> views_$2.out; }
run "33.7003,-117.7555 sf" pat pat
run "37.8560,-122.2530 sf" berkeley2 berkeley2
run "37.6480,-118.9720 " mammoth2 mammoth2
run "627 E Calaveras St, Altadena, CA" altadena2 altadena2
run "1100 Orange Ave, Coronado, CA" coronado2 coronado2
echo ALLDONE > run_views2.done
