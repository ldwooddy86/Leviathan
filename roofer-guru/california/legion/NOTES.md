# Legion foundation: notes (resume here)

Folder: CA/legion. Original: orig/Legion.html (never edited).

## Done
- work/: parts cut out of the original (style.css, pack.raw.js, worker.raw.js, bundle.min.js), decoded
  (world.json 4.9 MB, worker.min.js), pretty-printed with prettier (bundle.pretty.js 86k lines, worker.pretty.js 14k).
  work/decode.py, work/schema.py remake them.

## Found
- Legion.html layout: head (theme script reading legion.settings.v1, one <style>), body markup with fixed ids,
  then three <script>s: __LEGION_PACK__ (gz+b64 world.json), __LEGION_WORKER_SRC__ (JSON string), the bundle IIFE
  ending `goe();})();`.
- World pack is built FROM the California Roofer Guru atlas (sources[0].k == 'atlas', compiled 2026-11-19), keyed on
  the same 1,762 ZIPs (z.zip), columnar (zcols 146 columns), + acs.rows (306 ints per ZIP).

- Bundle map (minified name = plain name; lines are in work/bundle.pretty.js):
  goe=boot (85781), yoe=app glue (85820; publishes window.legion = {services,bus,settings,clock,stage,...}),
  Xa=services (Ane() 80979): init/npc/residents/persona/activityAt/dayPlan/bark/streetView/weather/createMap/createCrowd,
  y1=World (1340), TI=makeWorld, b1=unpack, xy=Population (11505; householdCore 12392, household 13465, person 13505,
  get 13592, sample 13604), Ay=parseId, $g=Crowd (78806), NE=crowd chunk generator (77874), zE=agent position at
  minute/dow (78128), Bg=agent state (77975), Iv=agent id (77952), CE=road net (77182), L3=time->minute,dow (77155),
  Sv=MapView (75990), e1=Stage (82914), t1=PlacePanel (83663), s1=NpcPanel (84594), Yv=Settings (81830),
  Zv=Clock (82190), Cv=mind store (79749), Fa=bus, ka=event names, Dg/yi/Ss/tne=localStorage get/set/remove/keys.
- Id = `${zip}-${household}-${member}`; home is a POINT (world.homeFor(zi,h), sampled inside the ZIP polygon).
- Crowd is closed form: agent arrays (home,dest,timing,days,mode,route,errand,eoff; 32 B/agent) + (minute, dow)
  -> state/position. No stepping. Drawn as GL points in a vertex shader. Default sample rate 0.025, max 5e6 agents.
- Worker protocol: prepare/build/topup/stats/droptopup/adopt/cancel -> prepared/loaded/chunk/progress/done/error/
  topchunk/topdone/toperror/stats.
- Storage: localStorage legion.settings.v1, legion.claude.apiKey (only when "remember"), legion.mind.*, legion.osm.v2.*;
  IndexedDB legion-crowd. Network off by default (settings.network claude/nws/osm all false).
- mount decision: same-origin iframe from the parts (app glue uses document-level key listeners, window error
  toasts, history.replaceState on the hash, html[data-theme], body[data-*], viewport media queries, a never-ending
  rAF loop and no teardown).

## Next
- read bundle: boot, worker protocol, generator, crowd, panels, voice; write LEGION_CONTRACT.md in pieces
- port_legion.py; test pages

## Done (2)
- legion_api.js (the library, body of __LG_API__) and port_legion.py written; port runs: out/ has the parts,
  legion.embed.html (lazy block for the host page), Legion.patched.html, names.json. Bundle grew 37.5 KB.
- test/probe.js (harness: blocks and lists all network), test/s_orig1.js, s_orig2.js (probes of the original).
- LEGION_CONTRACT.md sections 1-2 written (file, world pack, join with the dashboard).

## Next (2)
- test page (test/build_test.py -> test/out/test.html: own Leaflet map with #map + embed block), then tests:
  t_api.js (ready, places, npcsOf vs original, npc stable, crowd counts 03:00/08:00/12:00/17:30, mount 900x600),
  t_same.js (patched vs original with flag unset)
- contract sections 3-10
- TESTED OK: test/out/cmp.txt (s_cmp.js in the original and in the library page, cmp.js): the twelve residents of the
  place panel, two NPC panels as drawn, 94 people field for field, for 90012, 93546, 92277; same after a reload.
- test/s_api1.js run OK (ready 0.5 s, places 1762, npcsOf, whereIs, plan, trip, describe, say, settings key cg.legion.v1).
- TESTED OK: test/out/same.txt (s_same.js in orig and in out/Legion.patched.html, same.js): 37 of 37 the same
  (crowd 961,346, stats at 08:00, panels, tabs, offline talk, storage keys legion.*, IDB legion-crowd, street view).
- TESTED OK: test/out/crowd.json (s_crowd.js): 4 boxes x 4 hours, same answer twice, housing() deterministic.
- test/t_mount.js + s_mount.js + s_mount2.js written (mount in 900x600 beside a Leaflet #map).
- TESTED OK: test/out/mount.txt (t_mount.js): 29 checks, pictures test/out/mount_map.png, mount_street.png.
  test/out/leak.txt: V8 heap 14 MB ready, 34 mounted, 14 after unmount, twice. test/out/worker_mem.txt, cost.json.
- LEGION_CONTRACT.md sections 1-7 written. NEXT: sections 8 (library API), 9 (names+anchors), 10 (recommendations),
  11 (limits), 12 (files, tests); then final check of port + rerun nothing else; hand back.

## State at hand-back (2026-11-24)
- FINAL build of out/ made by `python3 -I port_legion.py orig/Legion.html out` (embed block 5,332,400 bytes).
- All tests rerun on the final build: test/out/same.txt 37 ok, cmp.txt 24 ok, mount.txt 32 ok, crowd.json, api1.json,
  say.json, cost.json, leak.txt, worker_mem.txt; pictures test/out/mount_map.png, mount_street.png.
- LEGION_CONTRACT.md complete (sections 1 to 12). Nothing left half done.
- To rerun: cd test; python3 -I build_test.py ../out /home/user/Leviathan/roofer-guru/vendor/dfw out/test.html;
  node probe.js out/test.html s_api1.js --wait "typeof window.__LEGION_LOAD__ === 'function' && !!window.HOST";
  node t_mount.js out/test.html out; (same/cmp: see the commands in LEGION_CONTRACT.md section 12 and the s_*.js heads)
- Open for the integrators: put out/legion.embed.html through assemble_ca.sh; try mount inside the real page;
  feed housing() with Scout's own footprints; real graphics card.
