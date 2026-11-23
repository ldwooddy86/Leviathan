#!/bin/bash
# California atlas data build. Usage: bash build_all.sh [first step, default 1]
# Steps: 1 people, 2 geometry, 3 hazard inputs, 4 roof model, 5 service lines, 6 assemble, 7 checks.
# Step 1b (solar, slow: reads a 1.1 GB archive) runs only when work/solar.json is missing.
set -e
cd "$(dirname "$0")"
FROM=${1:-1}
run() { echo "== $1"; python3 -I "$1"; }
[ "$FROM" -le 1 ] && run 01_people.py
[ -f work/solar.json ] || run 01b_solar.py
[ "$FROM" -le 2 ] && run 02_geo.py
[ "$FROM" -le 3 ] && run 03_hazard_in.py
[ "$FROM" -le 4 ] && run 04_roofmodel.py
[ "$FROM" -le 5 ] && run 05_lines.py
[ "$FROM" -le 6 ] && run 06_assemble.py
run 07_checks.py
