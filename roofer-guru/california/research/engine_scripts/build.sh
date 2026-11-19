#!/bin/bash
# Concatenate the part files into the evidence file.
SP=/tmp/claude-0/-home-user-Leviathan/3de4e742-518d-5f10-b5db-2b34e6723642/scratchpad
P=$SP/research/ca/engine_parts
cat $P/00_header.md $P/A_car.md $P/B_air.md $P/C_la.md $P/D_sf.md $P/E_sd.md $P/F_bridges.md $P/Z_notfound.md > $SP/research/ca/engine_evidence.md 2>/dev/null
wc -c -l $SP/research/ca/engine_evidence.md
