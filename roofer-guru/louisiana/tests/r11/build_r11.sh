#!/bin/bash
# Round 11: the Louisiana module and engine from their sources, then the page.
#   bash tests/r11/build_r11.sh <out.html>
set -e
S=/tmp/claude-0/-home-user-Leviathan/3de4e742-518d-5f10-b5db-2b34e6723642/scratchpad
cd "$S"
python3 -I tests/r11/gen_lens.py
python3 -I tests/r11/gen_en.py
python3 -I tests/r11/port_engine.py
python3 -I tests/r11/port_card.py
python3 -I tests/r11/port_css.py
python3 -I tests/r11/port_docs.py
python3 -I tests/r11/port_docs2.py
python3 -I tests/r11/port_lens.py
python3 -I tests/r11/port_storm.py
python3 -I tests/r11/port_uap.py
python3 -I tests/r11/port_views.py
python3 -I build/build.py "$1" | tail -1
node tests/syntax.js "$1" | tail -1
