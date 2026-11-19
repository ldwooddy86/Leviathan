#!/bin/bash
# usage: g.sh <name> <regex> [context]  -> grep text version
SP=/tmp/claude-0/-home-user-Leviathan/3de4e742-518d-5f10-b5db-2b34e6723642/scratchpad
T=$SP/research/ca/engine_txt
grep -n -i -E -C "${3:-0}" -- "$2" "$T/$1.txt" | cut -c1-600
