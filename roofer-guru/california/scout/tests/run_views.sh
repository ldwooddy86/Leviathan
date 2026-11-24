#!/bin/bash
# the roof-view pictures at the other four places, one browser after another
cd "$(dirname "$0")"; export NODE_PATH=/opt/node-tools/node_modules HARD=14; P=../../scout_integ/ca.html; S=../../scout_integ/shots
run() { timeout 900 node views_shots.js $P "$1" $2 $S plans/$2.json > views_$2.out 2>&1; echo "exit $?" >> views_$2.out; }
run "25 Woodleaf, Irvine, CA" irvine
run "1500 Walnut St, Berkeley, CA" berkeley
run "627 E Calaveras St, Altadena, CA" altadena
run "437 Old Mammoth Rd, Mammoth Lakes, CA" mammoth
run "1100 Orange Ave, Coronado, CA" coronado
echo ALLDONE > run_views.done
