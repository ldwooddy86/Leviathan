#!/bin/bash
# the three bar tests, one after another (one browser at a time)
cd "$(dirname "$0")"; export NODE_PATH=/opt/node-tools/node_modules; P=../../scout_integ/ca.html; S=../../scout_integ/shots
TAIL=1 timeout 700 node bar_wx.js $P "1100 Orange Ave, Coronado, CA" $S > bar_wx_tail.out 2>&1; echo "exit $?" >> bar_wx_tail.out
timeout 900 node bar_m3.js $P "1100 Orange Ave, Coronado, CA" $S > bar_m3.out 2>&1; echo "exit $?" >> bar_m3.out
timeout 1400 node bar_warp.js $P $S > bar_warp.out 2>&1; echo "exit $?" >> bar_warp.out
echo ALLDONE > run_bar.done
