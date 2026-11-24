#!/bin/bash
# node --check for a part that may be wrapped in its <script> tag
t=$(mktemp --suffix=.js); sed '1{/^<script/d};${/^<\/script>/d}' "$1" > $t; node --check $t; r=$?; rm -f $t; exit $r
