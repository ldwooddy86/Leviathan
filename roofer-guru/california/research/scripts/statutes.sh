#!/bin/bash
SP=/tmp/claude-0/-home-user-Leviathan/3de4e742-518d-5f10-b5db-2b34e6723642/scratchpad
D=$SP/ca/dl/law/statutes
UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
while read code sec; do
  [ -z "$code" ] && continue
  out="$D/wb_${code}_${sec}.html"
  # skip if already good, or already logged as 404 (no capture)
  if [ -s "$out" ] && [ $(stat -c %s "$out") -ge 20000 ]; then continue; fi
  if grep -qP "\t${code} ${sec//./\\.}\t[0-9]*\t404\t" $D/_log.tsv 2>/dev/null; then continue; fi
  u="https://web.archive.org/web/2026/https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=${code}&sectionNum=${sec}"
  r=$(curl -sS -L --max-time 120 --compressed -A "$UA" -o "$out" -w "%{http_code}\t%{url_effective}" "$u" 2>/dev/null)
  printf "%s\t%s\t%s\t%s\n" "$(date -u +%FT%TZ)" "$code $sec" "$(stat -c %s "$out" 2>/dev/null)" "$r" >> $D/_log.tsv
  sleep 2
done < "$1"
echo DONE >> $D/_log.tsv
