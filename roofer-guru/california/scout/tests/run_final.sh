#!/bin/bash
# the final build's verification: the word search, then the three bar tests (one browser at a time)
cd "$(dirname "$0")"; export NODE_PATH=/opt/node-tools/node_modules; P=../../scout_integ/ca.html; S=../../scout_integ/shots
run() { local name=$1 t=$2; shift 2; timeout $t "$@" > $name.out 2>&1; echo "exit $?" >> $name.out; }
run wordsearch_ca 700 node wordsearch_ca.js $P
run bar_m3 900 node bar_m3.js $P "1100 Orange Ave, Coronado, CA" $S
run bar_wx 900 node bar_wx.js $P "1100 Orange Ave, Coronado, CA" $S
run bar_warp 1400 node bar_warp.js $P $S
echo ALLDONE > run_final.done
