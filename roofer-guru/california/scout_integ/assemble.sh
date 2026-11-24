#!/bin/bash
# California Roofer Guru: stack the engine ports, patch the Scout script, assemble the page.
#   bash assemble_ca.sh <out.html> [jobs...]      jobs default: terrain weather traffic car sky views
# The engine is the Louisiana engine with each job's port applied in this order: terrain, weather, traffic, car, sky,
# views. Naming a shorter list builds without the others (used while a job is unfinished).
set -e
SP=/tmp/claude-0/-home-user-Leviathan/3de4e742-518d-5f10-b5db-2b34e6723642/scratchpad
CA=$SP/ca; E=$CA/engine; W=$CA/scout_integ/w; S=$CA/scout
OUT=${1:-/home/user/Leviathan/california-roofer-guru.html}; shift || true
JOBS=${@:-terrain weather traffic car sky views dense}
mkdir -p $W $CA/scout_integ/d
cur=$E/la_engine.js
for j in terrain weather traffic car sky views dense; do
  case " $JOBS " in *" $j "*) ;; *) continue;; esac
  if [ $j = views ]; then port=$E/views/port_views_ca.py; else port=$E/$j/port_$j.py; fi
  nxt=$W/stack_$j.js
  ( cd $(dirname $port) && python3 -I $port $cur $nxt ) > $W/port_$j.log 2>&1 || { echo "PORT FAILED: $j"; tail -5 $W/port_$j.log; exit 1; }
  bash $CA/build/jscheck.sh $nxt || { echo "does not parse after $j"; exit 1; }
  echo "applied $j"; cur=$nxt
done
python3 -I $CA/build/finish_engine.py $cur $W/engine.js $E/la_engine-style.css $W/engine-style.css
bash $CA/build/jscheck.sh $W/engine.js
# the Scout script: the traffic job's road reader, then the topography block
D=$CA/scout_integ/d
cp $S/scout3d.js $S/trace.js $D/
( cd $E/traffic && python3 -I port_traffic_scout.py $S/scout.js $D/scout.1.js ) > $W/port_scout_traffic.log 2>&1 || { echo "PORT FAILED: scout traffic"; tail -5 $W/port_scout_traffic.log; exit 1; }
( cd $S/topo && python3 -I port_topo.py $D/scout.1.js $D/scout.js $S/scout-style.css $D/scout-style.css ) > $W/port_scout_topo.log 2>&1 || { echo "PORT FAILED: scout topo"; tail -5 $W/port_scout_topo.log; exit 1; }
echo "scout patched"
python3 -I $CA/build/build_ca.py $OUT --engine $W/engine.js --engine-style $W/engine-style.css --scout-dir $D
node $SP/tests/syntax.js $OUT 2>&1 | tail -3
