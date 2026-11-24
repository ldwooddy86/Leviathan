# Dense downtowns (the downtown Los Angeles crash): notes for resuming

Job: find why the Scout Engine closes the headless browser at "200 N Spring St, Los Angeles, CA", fix it as
port_dense.py <in.js> <out.js> (anchored, applies to la_engine.js alone and at the end of the full stack), prove it.

Rules I keep: one browser at a time, every run under `timeout`, the browser capped
(--js-flags=--max-old-space-size=2048), never a browser left in the background, `free -m` watched.
The container restarted once already just after I began (maybe memory pressure from the crashing browser).

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
