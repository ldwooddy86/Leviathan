#!/bin/bash
# usage: get.sh <name> <url>   -> saves raw to dl/engine/<name>, text to engine_txt/<name>.txt
SP=/tmp/claude-0/-home-user-Leviathan/3de4e742-518d-5f10-b5db-2b34e6723642/scratchpad
D=$SP/ca/dl/engine
T=$SP/research/ca/engine_txt
S=$SP/research/ca/engine_scripts
name="$1"; url="$2"
code=$(curl -sS -L -m 90 --compressed -A "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36" -H "Accept: text/html,application/xhtml+xml,application/pdf,*/*;q=0.8" -H "Accept-Language: en-US,en;q=0.9" -o "$D/$name" -w "%{http_code} %{size_download} %{content_type} %{url_effective}" "$url" 2>&1)
echo "[$name] $code"
if [ -f "$D/$name" ]; then
  ft=$(file -b "$D/$name" | cut -c1-40)
  case "$ft" in
    PDF*) pdftotext -layout "$D/$name" "$T/$name.txt" 2>/dev/null ;;
    *HTML*|*XML*|*ASCII*|*UTF-8*|*text*) python3 -I "$S/h2t.py" "$D/$name" > "$T/$name.txt" 2>/dev/null ;;
    *) : ;;
  esac
  [ -f "$T/$name.txt" ] && echo "   text: $(wc -c < "$T/$name.txt") bytes  ($ft)"
fi
