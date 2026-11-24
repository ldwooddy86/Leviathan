#!/bin/bash
# Dense job: build the two test pages into CA/engine/dense/out (nothing shared is written).
#   bash build_pages.sh            base page (Louisiana page + la_engine.js + port_dense) and the stacked California page
#   STACK=<stacked.js> bash ...    use another stacked engine than CA/engine/out/stack_views.js
set -e
SP=/tmp/claude-0/-home-user-Leviathan/3de4e742-518d-5f10-b5db-2b34e6723642/scratchpad
CA=$SP/ca; E=$CA/engine; D=$E/dense; O=$D/out
cd $D
python3 -I port_dense.py $E/la_engine.js $O/base_dense.js
python3 -I $CA/build/testbed.py $O/base_dense.js $O/testbed_dense.html | tail -1
cp ${STACK:-$E/out/stack_views.js} $O/stack_in.js
python3 -I port_dense.py $O/stack_in.js $O/stack_dense.js
# the stacked page with and without the port, same scout parts (the lead's assembly, read only)
for v in in dense; do
  python3 -I $CA/build/finish_engine.py $O/stack_$v.js $O/engine_$v.js $E/la_engine-style.css $O/engine-style.css | head -1
  bash $CA/build/jscheck.sh $O/engine_$v.js
  python3 -I $CA/build/build_ca.py $O/ca_$v.html --engine $O/engine_$v.js --engine-style $O/engine-style.css --scout-dir $CA/build/out/scout | head -1
done
node $SP/tests/syntax.js $O/ca_dense.html 2>&1 | tail -1
