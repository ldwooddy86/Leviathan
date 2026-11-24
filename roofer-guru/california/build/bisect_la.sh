#!/bin/bash
# Which engine job makes downtown Los Angeles close the test browser? Builds the page with subsets of the jobs and opens each.
SP=/tmp/claude-0/-home-user-Leviathan/3de4e742-518d-5f10-b5db-2b34e6723642/scratchpad
cd $SP/ca/build
ADDR="200 N Spring St, Los Angeles, CA"
run() { name=$1; shift
  bash assemble_ca.sh out/bis_$name.html "$@" > out/bis_$name.build.log 2>&1 || { echo "$name: BUILD FAILED"; return; }
  timeout 500 node testbed_open.js out/bis_$name.html "$ADDR" out/bis_$name.png drone > out/bis_$name.log 2>&1
  echo "$name [$*]: $(grep -c 'PAGE ERRORS: none' out/bis_$name.log) ok-marker; $(grep -o 'ERROR.*\|TimeoutError' out/bis_$name.log | head -1); png $(ls out/bis_$name.png 2>/dev/null | wc -l)"
}
run none views
run weather weather views
run traffic traffic views
run sky sky views
