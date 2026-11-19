#!/bin/bash
# usage: cors.sh <url> [outfile]   -> prints status, ACAO, content-type, size; saves body to outfile if given
# GET with Origin: null (a page opened from disk); also reports the answer to a preflight OPTIONS
url="$1"; out="${2:-/dev/null}"
hdr=$(mktemp)
code=$(curl -sS -m 90 -H "Origin: null" -D "$hdr" -o "$out" -w '%{http_code} %{size_download}B %{time_total}s' "$url" 2>&1)
acao=$(grep -i '^access-control-allow-origin:' "$hdr" | tr -d '\r' | head -1)
ct=$(grep -i '^content-type:' "$hdr" | tr -d '\r' | head -1)
ce=$(grep -i '^content-encoding:' "$hdr" | tr -d '\r' | head -1)
echo "GET  $code | ${acao:-NO ACAO} | $ct $ce"
rm -f "$hdr"
