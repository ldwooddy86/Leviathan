#!/bin/bash
# California hazard build. Usage: bash build_hazard.sh [--live]
# Steps 01 to 09 rebuild every output from CA/dl (01 and 06 use the network once and cache: elevation tiles, ASCE samples).
# --live also refetches the weather snapshot (10). All Python runs with -I.
set -e
cd "$(dirname "$0")"
for s in 01_zcta_base 02_stations; do echo "== $s"; python3 -I $s.py > work/$s.log 2>&1; tail -1 work/$s.log; done
python3 -I -c "import sys; sys.path.insert(0,'.'); from hazlib import *; import pickle; pickle.dump(load_stormevents(), open(os.path.join(WORK,'se.pkl'),'wb'))"
for s in 03_ar 04_fire 05_wind_events 06_snow_hail 07_assemble 08_roof_model; do echo "== $s"; python3 -I $s.py > work/$s.log 2>&1; tail -1 work/$s.log; done
if [ "$1" = "--live" ]; then echo "== 10_nws_snapshot"; python3 -I 10_nws_snapshot.py > work/10_snapshot.log 2>&1; tail -1 work/10_snapshot.log; fi
echo "== 09_checks"; python3 -I 09_checks.py | tail -1
