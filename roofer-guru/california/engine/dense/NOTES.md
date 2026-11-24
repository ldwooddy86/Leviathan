# Dense downtowns (the downtown Los Angeles "crash"): notes

STATE (04:20): finished. Port written, applied, proved. Nothing is running. The report has been handed back.

## In short
- Cause: not a crash, not memory, not geometry. The engine hands frames to the GPU process faster than the software
  renderer draws them and nothing holds it back (headless Chromium does not hold requestAnimationFrame back): the
  queue of undrawn frames grows without bound (317 s of drawing queued after 26 s), and the page freezes whenever
  something waits for the picture: the engine's own black-picture watch (readPixels, 47.8 s in one call), the tree
  reader's getImageData, a screenshot. The test's `timeout 500` then ends node, Playwright closes the browser, and the
  pending call reports "Target page, context or browser has been closed". Downtown LA "fails" where Coronado
  "passes" only because testbed_open.js leaves its wait loop early when `built > 20` and this address has exactly 20
  buildings in reach, so all 30 rounds run behind a frozen page.
- Fix (port_dense.py, 12 anchors, each once): Engine._frame holds the draw while frames are in flight (fence gate,
  the update still runs); the watch reads through a pixel buffer and a fence; the photo canvases are made with
  willReadFrequently; a lost context is said in the view and the engine stops drawing.
- Files: port_dense.py, dense_engine.js, dense_world.js, build_pages.sh, tests/ (diag.js and probes), out/ (logs,
  pictures, pages; out/runs.txt lists every run of the lead's testbed_open.js).
- For the lead: add `dense` after `views` in build/assemble_ca.sh's two job lists (the path rule $E/$j/port_$j.py
  already fits). It must come before build/finish_engine.py.

## Log (times are my clock, not the machine's)
## Found
(nothing yet)

## Done
- 01:03 folder made, notes started.

## Next
1. tests/diag.js: open the base test page at the address with crash / disconnected / console listeners, browser
   stderr kept, JS heap and process memory sampled until death.
2. Tell apart: renderer crash, out of memory, engine loop, SwiftShader limit.

### 01:10 first finding (run out/d1.log, base page, steps one by one)
- The browser does NOT crash. No `crash` event, no disconnect, memory small the whole time (JS heap 65 MB, renderer
  284 MB, GPU process 469 MB, 13 GB free). After `setHeight('drone')` the page's main thread stops answering:
  page.evaluate answers only about once in 40 s. The "closed" in the bisect logs is `timeout 500` sending SIGTERM to
  node: Playwright closes its browser on SIGTERM and the pending call then reports "Target page ... has been closed"
  (each bis_*.log was written 500 s after its build log). So the fault is a hang or frames that take tens of seconds.
- Street mode at the same place before that: 293 draws, 1,211,292 triangles a frame, 12 cells, 20 buildings, far 149.
- Next: is the long frame JS (update) or GL (render)? Step by hand, time each, profile.

### 01:16 second finding (out/d2.log, tests/probe_frames.js: engine stopped, frames stepped by hand)
- The time is in JavaScript, in `engine.emit('update')`: 1.4 to 2.8 s EVERY frame at downtown LA, in street mode as
  well as drone (draw calls return in 2 to 12 ms, gl.finish 0 to 3 ms, 650k triangles, no GL error, context not lost).
  Only 12 cells and 18 to 20 buildings are built there. So: a runaway per-frame computation, not memory, not the GPU.
- Next: CPU profile of the update (CDP Profiler) to name the function.

### 01:27 third finding (out/d3.log profile, out/d4.log tests/probe_parts.js)
- Stepped by hand with nothing else running, every part of a frame is quick in JS (update 0.2 to 75 ms, draw calls
  3 to 40 ms, layout 0.9 ms, DOM 1,843 elements). The 1.5 to 2.8 s "update" of d2 is not repeatable as pure JS:
  the CPU profile shows 735 ms of 1,172 in "(program)" (native, not JS). But the page still takes 10 to 40 s to answer
  a call while the engine's own loop runs. So the main thread is blocked in native code: most likely waiting on the
  GPU process (SwiftShader) at a synchronous call (readPixels in the watch, getImageData of the tree reader, getError).
- Next: measure real GPU time per frame (render then a 1 pixel readPixels to force the wait), then switch parts of
  the scene off one at a time (shadows, far tiles, wide city, cells, streets) to find what costs; compare Coronado.

### 01:33 fourth finding (out/d5.log, tests/probe_gpu.js; machine load average 10 to 12 from other jobs' browsers)
- Real graphics cost of one frame at downtown LA (draw, then read one pixel): 1.7 to 2.7 s in street and in drone,
  1.27 to 1.32 million triangles, 307 to 346 draws, 165 to 200 shadow draws. Slow, but not the 30 to 40 s stalls.
  No single group (cells, far tiles, wide city, streets, lights) owns it: each off still leaves 1.3 to 2.2 s.
- The stalls are separate and long: `setGraphics({life:false})` took 38 s and 44 s to return (d1, d2: it calls
  buildRoads()); `setHeight('drone')` took 33 s (d4: it calls plan()), and the page then answered once in 40 s.
- Next: CPU profile across setHeight('drone') and across life:false to name what runs for 30 s.

### 01:40 THE STALL NAMED (out/d6.log, CPU profile across setHeight('drone') for 37 s)
- 54,639 ms of 55,941 ms are inside `gl.readPixels`, called from `Engine._watch` (the black-picture watch), called
  from `_frame`. JS itself is 1 %. `_watch` reads the canvas once every 24 frames (12 times after each quality
  change); the draw calls of a frame return in 3 to 10 ms, so frames are handed to the GPU process far faster than
  SwiftShader draws them (about 2 s each here); the 24th frame's readPixels then waits for all the queued frames:
  24 x 2 s = 48 s with the page's main thread frozen. That is the "page that does not answer", and the test's
  `timeout 500` then kills it ("browser has been closed"). No crash, no memory growth, no engine loop.
- Still to explain: why a frame costs 2 s here and the test passes at Coronado. Next: tests/probe_gpu.js at Coronado.

### 01:45 queue measured (out/d8.log phase A, tests/probe_pace.js; Coronado compared in out/d7.log)
- Coronado costs the same per frame as downtown LA (2.0 to 2.8 s, 1.37 to 1.78 M triangles): the frame cost is not
  special to downtown, and the page freezes the same way at Coronado (same busy pattern in the MEM lines).
- LA, engine as it is, camera turning for 62 s: 33 frames started, the page's main thread frozen for 43 s at a
  stretch, 2 calls of the watch took 54.5 s between them.
- Why LA "fails" and Coronado "passes" in testbed_open.js: its wait loop leaves early only when `built > 20`; downtown
  LA has exactly 20 buildings in reach, so it runs all 30 rounds, each behind a frozen page, and `timeout 500` ends it.
- Plan of the fix: (1) the watch reads its pixels without waiting (pixel buffer + fence, answer read a few frames
  later); (2) a fence gate in Engine._frame: no new frame is started until the one before has been drawn, so the
  queue is one frame deep whatever a frame costs; (3) context loss said in words; (4) check dense geometry anyway.

### 01:58 the queue has no bound (out/d9.log)
- Phase A again: 23 frames started, one watch call froze the page 47.8 s.
- Phase B (watch off, nothing else changed): 236 frames started in 26 s; at the end ONE readPixels took 316.9 s:
  that is 317 s of frames handed over and not yet drawn. Chromium (headless, SwiftShader) does not hold
  requestAnimationFrame back when the GPU process is behind, and the engine does not either. Anything that waits for
  the GPU (screenshot, readPixels, the tab being shown) waits for the whole queue. This is the fault.
- Next: phase C alone (fence gate) to see the queue held at one frame; then write the port.

### 02:03 the gate tried live (out/d10.log, phase C)
- Fence gate + watch off, camera turning 30 s: 21 frames started (1.43 s a frame, the real rate), 1,760 animation
  turns skipped, longest freeze of the main thread 119 ms (was 47,878), queue at the end 1.15 s (was 316.9 s).
- Design settled: hold the DRAW, keep the update (input, physics, traffic) running each turn so the simulation keeps
  real time as before; allow 2 frames in flight on fast cards (so a 20 ms card is not halved to 30 fps), 1 when a
  frame takes over 100 ms; a valve: after 8 s held, draw anyway; watch reads through a pixel buffer and a fence.

## Done
- 02:20 dense_engine.js (Engine._held, _fence, pacing, _watchAsk, _watchRead, _ctxGone), dense_world.js (lost and
  restored said in the view), port_dense.py written. Applies (every anchor once) to la_engine.js, to the full stack
  CA/engine/out/stack_views.js (copied to out/stack_in.js), to terrain/out/engine_terrain.js and car/out/engine_car.js.
  Outputs: out/base_dense.js, out/stack_dense.js.
## Next
- build out/testbed_dense.html (build/testbed.py) and out/ca_dense.html (finish_engine.py + build_ca.py into my own
  folder, never CA/engine/out), then run tests/diag.js on them: LA drone/street/bird, pace probe, SF, SD, Coronado.
- 02:32 FIRST PROOF (out/e1.log, out/testbed_dense.html = la_engine.js + port, downtown LA, machine load 2 to 4):
  the engine opened in 30 s (was 65 to 95 s), every one of 120 once-a-second calls to the page answered (before: most
  "busy"), camera turning 30 s: 36 frames drawn, longest main thread freeze 109 ms (was 47,878), queue at the end
  0.79 s (was 316.9 s), the watch 3 ms (was 47,792). pacing(): 1 frame in flight, frame 832 ms, 3,613 turns held.
  The picture step failed for a reason of my script (it picked a hidden canvas); fixed in tests/diag.js.
- 02:36 THE REPRODUCE COMMAND PASSES on out/testbed_dense.html, drone: exit 0, 2 min 16 s, "PAGE ERRORS: none",
  picture out/la_base_drone.png (the Civic Center from 38 m). Next: street, bird on base; then the stacked page.
- 02:42 base page, street: exit 0 in 136 s (out/la_base_street.png); bird: exit 0 in 144 s (out/la_base_bird.png).
  Machine load 8.5 during both. Results are appended to out/runs.txt by tests/run_open.sh.
- Next: the stacked California page out/ca_dense.html (stack_views.js of 01:52 + port), drone, street, bird.
- 02:46 STACKED page out/ca_dense.html, drone: exit 0 in 173 s, clean, out/la_stack_drone.png. Next: stacked street, bird.
- 02:53 STACKED street: exit 0 in 175 s (out/la_stack_street.png); bird: exit 0 in 165 s (out/la_stack_bird.png). All six LA runs pass. Next: cell numbers probe, SF, SD, Coronado, context loss test, control run of out/ca_in.html (no port).
- 03:00 cell numbers at downtown LA (out/f_la.log, tests/probe_cells.js, ported base page): 12 cells, 20 buildings,
  6,202 triangles and 844 KB in all the cells' own meshes; heaviest cell 44972/104671: 1,406 triangles, 193 KB,
  10 meshes; rebuilding all 20 buildings 28 ms of K.addBuilding in total, slowest building 14.2 ms, longest update
  17.4 ms; JS heap 75 MB. The port does not touch cell building, so these are the same before and after.
  (The 1.3 M triangles a frame are instances and shadow passes: trees, cars, lamps, drawn again in each cascade.)
- 03:08 downtown SF (555 California St) and SD (600 W Broadway) open on the ported base page (out/f_sf.log, f_sd.log,
  pictures out/f_sf.png, out/f_sd.png). SF: 121 buildings, 14 cells, 18,333 triangles, 2.56 MB in the cells; heaviest
  cell 3,317 triangles, 465 KB; all buildings 66 ms; slowest 17.9 ms; heap 126 to 149 MB. SD: 41 buildings, 14 cells,
  13,625 triangles, 1.78 MB; heaviest cell 2,536 triangles, 325 KB; all buildings 38 ms; heap 82 to 130 MB.
- Left to explain: at SD three updates of about 1.5 s each during the rebuild, though K.addBuilding took 38 ms in all,
  and 6 or 7 of about 65 once-a-second calls answered late. Suspect: getImageData of the tree reader waiting for the
  one frame in flight. Next: profile it (profon, probe_cells, profoff at SD).
- 03:16 the slow updates explained (out/g_sd.log profile): getImageData in K.detectTrees (growTrees, pump): 7,819 ms of
  8,623 ms of _frame time. The photo canvases live on the card, so each read waits for the GPU process (one frame
  with the gate, the whole queue before). Added to the port: WorldKit's cvs() makes its canvases with
  willReadFrequently (one anchor, present once in base, stack, terrain, car outputs).
- 03:22 with the canvas change (out/g_sd2.log, SD): getImageData gone from the profile (was 7,819 ms), no Canvas2D
  warnings, longest update 18.1 ms (was 1,588), 2 of 70 calls late (was 6 of 67). Picture out/g_sd2.png fine.
  Pages rebuilt with the final port (build_pages.sh). The six LA runs above were made BEFORE the canvas change:
  rerun at least drone on base and stack with the final port, then Coronado, context loss, control.
- 03:28 FINAL PORT: LA drone base exit 0 in 127 s (load 12.7), LA drone stack exit 0 in 143 s (load 10.7); out/la_base_drone_final.png, out/la_stack_drone_final.png. Next: Coronado, context loss, control.
- 03:33 Coronado on the ported base page: testbed_open drone exit 0 in 64 s, built 219, clean (out/cor_base_drone.png);
  13 cells, 219 buildings, as before the port (out/d7.log). Cells there: 50,626 triangles, 6.6 MB, heaviest cell
  5,886 triangles, 705 KB, slowest building 72 ms, all buildings 261 ms, heap 170 to 196 MB (out/f_cor.log): an
  ordinary neighbourhood is heavier than any of the three downtowns.
- 03:40 context loss test (tests/probe_lost.js, out/lost_testbed_dense.log, out/lost_ca_dense.log): after loseContext
  the note and the alert say so; after restoreContext the note says to reload; engine.broken set (now kept through a
  quality change: one more anchor, `this.quality = q; this.broken = null;`); the page's timers run (20 ticks a second);
  no page error. On the stacked page 8 console errors "shader ... did not build" at the moment of loss (programs asked
  for while there was no context): words only. No automatic rebuild: said in the report.
- 03:50 CONTROL: out/ca_in.html (the same stack, no port), same command, drone: exit 124 after 500 s, no picture,
  "page.evaluate: Target page, context or browser has been closed" (out/la_stack_noport_drone.log). With the port the
  same stack passes in 143 to 173 s.
- Next: final-port runs of street and bird on base and stack (4 runs), drone on stack once more; then report.
- 03:58 FINAL PORT on the stack: drone 151 s, street 146 s, bird 144 s, all exit 0 and clean (load 12 to 13). Next: base street and bird (final), SF and SD on the stack, then report.
- 04:05 FINAL PORT on base: street 127 s, bird 125 s, exit 0, clean. SF on the stack, drone: exit 0 in 76 s, 121 buildings (out/sf_stack_drone.png). Next: SD and Coronado on the stack; port check against the newest stack; report.
- 04:10 settle cap exempted while the watch is in doubt; pages rebuilt; port applies to every stage (stack_terrain,
  weather, traffic, car, sky, views, terrain/out/engine_terrain.js, car/out/engine_car.js, la_engine.js).
- 04:18 last runs with the final port: LA drone stack 140 s, base 127 s, exit 0, clean. Pacing on the stack
  (out/e2.log): 14 frames drawn in 30 s (2.2 s a frame at load 11, 1.9 M triangles), longest freeze 387 ms, queue at
  the end 1.18 s, watch 4 ms; JS heap 363 MB, renderer 726 MB, GPU process 623 MB.

## Not done
- No rebuild of the engine after the browser gives a lost context back (the view says to reload).
- No cut of the software renderer's cost per frame (0.6 to 2.2 s here): it is the renderer's limit.
- Not tried on a real graphics card (none here): the gate's behaviour there is reasoned, not measured.
