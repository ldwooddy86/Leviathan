#!/bin/bash
# usage: fetch.sh URL OUTNAME   -> saves under SP/ca/dl/law/OUTNAME, logs to _log.tsv
SP=/tmp/claude-0/-home-user-Leviathan/3de4e742-518d-5f10-b5db-2b34e6723642/scratchpad
D=$SP/ca/dl/law
url="$1"; out="$2"
code=$(curl -sS -L --max-time 90 --compressed -A "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36" -H "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,application/pdf,*/*;q=0.8" -H "Accept-Language: en-US,en;q=0.9" -o "$D/$out" -w "%{http_code}" "$url" 2>"$D/.err")
sz=$(stat -c %s "$D/$out" 2>/dev/null || echo 0)
printf "%s\t%s\t%s\t%s\t%s\t%s\n" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$code" "$sz" "$out" "$url" "$(tr '\n' ' ' < $D/.err)" >> "$D/_log.tsv"
echo "$code $sz $out"
