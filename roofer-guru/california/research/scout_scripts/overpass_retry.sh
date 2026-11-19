#!/bin/bash
# keep trying one Overpass box until it is saved (the path from this sandbox to overpass-api.de fails most of the time)
SP=/tmp/claude-0/-home-user-Leviathan/3de4e742-518d-5f10-b5db-2b34e6723642/scratchpad; D=$SP/ca/dl/scout/streets
name=$1; shift
for i in $(seq 1 30); do
  for srv in http://overpass-api.de/api/interpreter https://overpass-api.de/api/interpreter https://maps.mail.ru/osm/tools/overpass/api/interpreter; do
    timeout 200 python3 $SP/research/ca/scout_scripts/overpass_streets.py $D $name "$@" $srv > $D/_log_$name.txt 2>&1
    if [ -s $D/overpass_$name.json ]; then echo "OK $name attempt $i via $srv $(date -u +%H:%M:%S)"; cat $D/_log_$name.txt | cut -c1-1700; exit 0; fi
  done
  sleep 15
done
echo "FAILED $name after 30 rounds; last error:"; tail -2 $D/_log_$name.txt | cut -c1-300
