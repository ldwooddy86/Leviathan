#!/bin/bash
# Phase A of the spine for each open target: robots + sitemap inventory, then the Google Crawl (bounded)
export UW_USER_AGENT="OmegaWeapon/1.0 (declared site-audit bot; obeys robots.txt)"
U=/root/.claude/skills/synced/afeaaf00-9ba7-4c5e-b566-5a8a19e58f7d_1d2e556f-c9f2-430e-9f82-1e61548971a2/ultimaweapon/scripts
cd /tmp/claude-0/-home-user-Leviathan/0ea4246d-79da-5db9-bd3a-35149ef10175/scratchpad
for row in $(python3 -I -c "import json;[print(r['domain']+'|'+r['home']) for r in json.load(open('omega_cache/_roster/roster.json')) if r['access']=='raw']"); do
  d=${row%%|*}; h=${row#*|}; C=omega_cache/$d; mkdir -p $C
  echo "### $d $(date -u +%H:%M:%S)"
  timeout 300 python3 $U/justice_fetch.py --robots --out $C/html --cache $C "$h" 2>&1 | grep -v "^  honest" | cut -c1-150
  timeout 900 python3 $U/google_crawler.py --cache $C --quiet crawl "$h" --out $C/google_crawl --follow-links --max-pages 30 --max-sitemaps 10 --sample-families 2>&1 | tail -3
done
echo "### done $(date -u +%H:%M:%S)"
