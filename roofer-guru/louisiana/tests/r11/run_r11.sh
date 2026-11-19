#!/bin/bash
# Round 10: the module's browser suites and the reviewers' scripts that touch Rooftop Scout, on one build; one browser at a
# time after the first pair. Resumable: a log that already ends its run is kept.
#   bash tests/r11/run_r11.sh <atlas.html> <outdir>
S=/tmp/claude-0/-home-user-Leviathan/3de4e742-518d-5f10-b5db-2b34e6723642/scratchpad
A=$(readlink -f "$1"); O=$(readlink -f "$2"); T=$S/tests; R=$S/review
mkdir -p $O
run() { local log=$1; shift; grep -q -- "--- exit" $log 2>/dev/null && return 0; rm -f $log; echo "=== $*" >> $log; timeout 1700 "$@" >> $log 2>&1; echo "--- exit $?" >> $log; }
( cd $T/r11 && run $O/model.log node model.js $A )
( cd $T && run $O/smoke.log node smoke.js $A $O/smoke ) &
( cd $T && run $O/smoke2.log node smoke2.js $A $O/smoke2 ) &
wait
( cd $T && run $O/layout.log node layout.js $A $O/layout )
( cd $R/r8check/permit18 && run $O/inj8.log node inj8.js $A )
( cd $R/r8check/permits8_skeptic && run $O/inj_sk.log node inj_sk.js $A )
( cd $T/r6 && run $O/keys.log node keys_test.js $A )
( cd $R/r6check/edgecases && run $O/scout_open.log node scout_open.js $A )
( cd $T/r7 && run $O/unscored.log node unscored.js $A; run $O/mapclick.log node mapclick.js $A )
( cd $T/r11 && run $O/engine.log node engine_smoke.js $A $O/engine )
( cd $T/r11 && run $O/lens.log node lens_smoke.js $A $O/lens )
echo done > $O/all_done
