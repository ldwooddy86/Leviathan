#!/bin/bash
# one run of the lead's testbed_open.js, timed, under its 500 s limit:  run_open.sh <page.html> "<address>" <name> <mode>
D=/tmp/claude-0/-home-user-Leviathan/3de4e742-518d-5f10-b5db-2b34e6723642/scratchpad/ca/engine/dense
cd $D/../../build
t0=$(date +%s)
timeout 500 node testbed_open.js "$1" "$2" $D/out/$3.png $4 > $D/out/$3.log 2>&1; rc=$?
echo "$3 [$4] exit $rc in $(( $(date +%s) - t0 )) s; load $(cut -d' ' -f1 /proc/loadavg); $(grep -c 'PAGE ERRORS: none' $D/out/$3.log) clean; png $(ls -la $D/out/$3.png 2>/dev/null | awk '{print $5}'); $(grep -o 'engine {.*' $D/out/$3.log | cut -c1-90) $(grep -o 'ERROR.*\|pageerror.*' $D/out/$3.log | head -2 | cut -c1-200)" | tee -a $D/out/runs.txt
