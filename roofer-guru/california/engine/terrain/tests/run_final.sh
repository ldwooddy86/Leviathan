#!/bin/sh
P=../../build/out/testbed_terrain.html
echo "== t_move";    timeout 1500 node tests/t_move.js $P shots 2>&1 | grep "^ok\|^FAIL\|ERROR"
echo "== t_blocked"; timeout 1500 node tests/t_blocked.js $P shots 2>&1 | grep "^ok\|^FAIL\|ERROR"
echo "== t_core San Francisco, Filbert at Hyde"; timeout 900 node tests/t_core.js $P "1000 Filbert St, San Francisco, CA" 37.80016 -122.41857 86.5 6 shots/sf_filbert_street.png street 90 0 2>&1 | grep "^ok\|^FAIL\|ERROR"
echo "== done"
