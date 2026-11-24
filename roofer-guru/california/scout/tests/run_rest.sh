#!/bin/bash
# layout, the 3D view, then Louisiana's suites as ported: one browser after another
cd "$(dirname "$0")"; export NODE_PATH=/opt/node-tools/node_modules; P=$(cd ../../scout_integ && pwd)/ca.html; O=../../scout_integ
run() { local name=$1 t=$2; shift 2; timeout $t "$@" > $name.out 2>&1; echo "exit $?" >> $name.out; }
run layout_bar 1500 node layout_bar.js $P $O/layout
run d3_ca 1000 node d3_ca.js $P $O/d3
cd la_port; mkdir -p out
run out/scout_open 300 node scout_open.js $P
run out/smoke 900 node smoke.js $P out/smoke
run out/smoke2 1200 node smoke2.js $P out/smoke2
run out/layout 600 node layout.js $P out
run out/keys_test 600 node keys_test.js $P
run out/unscored 600 node unscored.js $P
run out/mapclick 400 node mapclick.js $P
run out/inj8 500 node inj8.js $P; run out/inj8b 500 node inj8.js $P
run out/inj_sk 500 node inj_sk.js $P; run out/inj_skb 500 node inj_sk.js $P
run out/views_unit 400 node views_unit.js $P
run out/r11_smoke 1200 node r11_smoke.js $P out/r11
run out/review_fix_check2 900 node review_fix_check2.js $P
cd ..; echo ALLDONE > run_rest.done
