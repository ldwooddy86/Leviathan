#!/bin/sh
# every test place, one after another (never two browsers at once). Run from CA/engine/terrain.
P=../../build/out/testbed_terrain.html; A="200 N Spring St, Los Angeles, CA"
run() { echo "== $1"; timeout 900 node tests/t_core.js $P "$A" $2 $3 $4 $5 shots/$1.png $6 $7 $8 2>&1 | grep -v "^ready\|^{" ; }
run sf_twin_peaks_drone 37.7513 -122.4475 262.1 8 drone 45 -8
run south_lake_tahoe_bird 38.9332 -119.9844 1901.6 6 bird 350 -6
run coronado_bird 32.6859 -117.1831 6.0 4 bird 215 -10
run mammoth_lakes_drone 37.6485 -118.9721 2399.2 8 drone 250 0
run truckee_street 39.3280 -120.1833 1773.1 8 street 180 2
run la_metro_north 34.0537 -118.2427 90.2 8 metro 10 -12
run lonepine_street_whitney 36.6060 -118.0629 1136 8 street 262 6
