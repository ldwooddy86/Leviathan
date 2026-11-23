#!/bin/bash
# the trimmed plan, one place to a browser (a browser lost under load then costs one place only), with the checks after the first
cd "$(dirname "$0")"
node shots.js out/testbed.html plan_b.json shots 0 > out/log_b0.txt 2>&1
node checks.js out/testbed.html > out/log_checks.txt 2>&1
for i in 1 2 3 4; do node shots.js out/testbed.html plan_b.json shots $i > out/log_b$i.txt 2>&1; done
echo done
