#!/bin/bash
# Phase B of the spine for each open target: money-set scan, schema tribunal, mobile render, render probe, DNS/RDAP, demand
export UW_USER_AGENT="OmegaWeapon/1.0 (declared site-audit bot; obeys robots.txt)"
U=/root/.claude/skills/synced/afeaaf00-9ba7-4c5e-b566-5a8a19e58f7d_1d2e556f-c9f2-430e-9f82-1e61548971a2/ultimaweapon/scripts
S=/tmp/claude-0/-home-user-Leviathan/0ea4246d-79da-5db9-bd3a-35149ef10175/scratchpad
cd $S
ONLY="$1"
python3 -I -c "import json;[print(r['domain']+'\t'+r['home']+'\t'+r['vertical']+'\t'+r['brand_terms']+'\t'+'|'.join(r['seeds'])) for r in json.load(open('omega_cache/_roster/roster.json')) if r['access']=='raw']" | while IFS=$'\t' read d h v b sd; do
  if [ -n "$ONLY" ] && [ "$ONLY" != "$d" ]; then continue; fi
  C=omega_cache/$d; echo "### $d $(date -u +%H:%M:%S)"
  python3 -I scripts/pick_money.py $d "$h" $v > $C/money.json || { echo "pick failed $d"; continue; }
  SCAN=$(python3 -I -c "import json;print(' '.join(json.load(open('$C/money.json'))['scan']))")
  REND=$(python3 -I -c "import json;m=json.load(open('$C/money.json'))['money'];print(' '.join(m[:2]))")
  timeout 400 python3 $U/justice_fetch.py --out $C/html --cache $C $SCAN 2>&1 | grep -v "^  honest" | cut -c1-140
  timeout 600 python3 $U/satchel_web.py scan --out $C/web --cache $C $SCAN 2>&1 | grep -v "^  honest\|wetware" | tail -4
  timeout 200 python3 $U/justice_schema.py $C/html/*.html --out $C/schema 2>&1 | tail -3
  timeout 300 python3 $U/google_crawler.py --cache $C --quiet render $REND --out $C/google_render.json --screenshots $C/google_shots --wait 6 2>&1 | tail -3
  timeout 300 python3 $U/satchel_render.py --out $C/render --cache $C --wait 6 "$h" 2>&1 | grep -v "^  honest" | tail -3
  timeout 120 python3 $U/satchel_web.py dns $d --out $C/dns 2>&1 | tail -2
  timeout 120 python3 $U/satchel_web.py rdap $d --out $C/rdap 2>&1 | tail -1
  mkdir -p $C/search; IFS='|' read -ra SEEDS <<< "$sd"; python3 -I scripts/demand.py $C/search/autocomplete.json "$b" "${SEEDS[@]}" 2>/dev/null | cut -c1-200
done
echo "### done $(date -u +%H:%M:%S)"
