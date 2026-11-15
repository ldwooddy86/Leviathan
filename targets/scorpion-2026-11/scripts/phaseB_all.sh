#!/bin/bash
S=/tmp/claude-0/-home-user-Leviathan/0ea4246d-79da-5db9-bd3a-35149ef10175/scratchpad
cd $S
for d in $(python3 -I -c "import json;[print(r['domain']) for r in json.load(open('omega_cache/_roster/roster.json')) if r['access']=='raw']"); do
  for i in $(seq 1 120); do [ -f omega_cache/$d/google_crawl/crawl_report.md ] && break; sleep 10; done
  bash scripts/phaseB.sh $d
done
