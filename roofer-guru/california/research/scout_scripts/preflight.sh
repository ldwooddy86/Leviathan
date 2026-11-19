#!/bin/bash
# usage: preflight.sh <url> [method] [headers]  -> the answer to a CORS preflight
url="$1"; m="${2:-GET}"; h="${3:-content-type}"
curl -sS -m 60 -X OPTIONS -H "Origin: null" -H "Access-Control-Request-Method: $m" -H "Access-Control-Request-Headers: $h" -D - -o /dev/null "$url" 2>&1 | tr -d '\r' | grep -i -E '^HTTP/|^access-control' | tr '\n' ' '; echo
