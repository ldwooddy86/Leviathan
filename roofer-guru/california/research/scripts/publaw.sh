#!/bin/bash
SP=/tmp/claude-0/-home-user-Leviathan/3de4e742-518d-5f10-b5db-2b34e6723642/scratchpad
D=$SP/ca/dl/law/publaw
UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
slug(){ case "$1" in BPC) echo ca_bus_and_prof_code_section_;; CIV) echo ca_civ_code_section_;; CCP) echo ca_civ_proc_code_section_;; PEN) echo ca_penal_code_section_;; INS) echo ca_ins_code_section_;; HSC) echo ca_health_and_safety_code_section_;; PRC) echo ca_pub_res_code_section_;; GOV) echo "ca_gov't_code_section_";; LAB) echo ca_lab_code_section_;; PUC) echo ca_pub_util_code_section_;; RTC) echo ca_rev_and_tax_code_section_;; esac; }
while read code sec; do
  [ -z "$code" ] && continue
  out="$D/pl_${code}_${sec}.html"
  if [ ! -s "$out" ]; then
    u="https://california.public.law/codes/$(slug $code)${sec}"
    r=$(curl -sS -L --max-time 60 --compressed -A "$UA" -o "$out" -w "%{http_code}" "$u" 2>/dev/null)
    printf "%s\t%s\t%s\t%s\t%s\n" "$(date -u +%FT%TZ)" "$code $sec" "$(stat -c %s "$out" 2>/dev/null)" "$r" "$u" >> $D/_log.tsv
    sleep 1.5
  fi
done < "$1"
echo DONE >> $D/_log.tsv
