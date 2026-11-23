# traffic job notes
- started: read DESIGN, survey, evidence C/D/E/F, sources streets+AADT.
- plan: keep old Traffic for surface streets (patched: oneway, lanes, limits, layer, grid, actors, signal cycles);
  new lane-based Freeway sim for motorway + motorway_link; freeway ribbons with per-road width and deck height.
- files: traffic_engine.js, port_traffic.py, port_traffic_scout.py, build_aadt.py, tests/
- (resumed 11-23) on disk: traffic_core.js (TrafficData, RoadPrep, Flow: tested in Node, tests/test_flow.js quick ok),
  traffic_kit.js (written, NOT yet run; needs RP.high + RP.ground in core), scout_roads.js + port_traffic_scout.py (written, not applied).
- next: add RP.high/ground; write port_traffic.py (anchors listed in my head: setRoads, buildRoads, loadRoads, after, update line,
  StreetKit network/build/update, Traffic setNetwork/extendOnce/step/populate); node --check; node test street; testbed 3 cities.
- fix5 applied (RP.high, RP.ground, hit returns nx,nz,depth); traffic_engine.js = cat aadt_table.js traffic_core.js traffic_kit.js
- port_traffic.py written; applies to la_engine.js -> out/engine_traffic.js
- street test ok (tests/test_street.js quick: contacts 0, wrong-way 0). obstacles gated by deck height dk (not lv). next: browser test via testbed + route-mocked Overpass (tests/shots.js)
- browser: out/tb.html = testbed.py(out/engine_traffic.js) + port_traffic_scout.py; tests/shots.js mocks Overpass from saved boxes.
  first run at LA four-level worked (286 pieces, 240 flow cars at low quality, 48 street cars, no page errors) - screenshots pending.
- REPORT must list: interface (S.hero in; S.trafficHit -> {nx,nz,depth,x,z,...}; S.traffic = kit; env.roads(la,lo,r,{only:'freeway'}); road fields),
  functions touched (Traffic: top helpers, setNetwork, extendOnce, place, freeAt, roomAt, spawn, enter, populate, step; StreetKit: network, TT, X.build, X.update;
  world: WALK line, setRoads, buildRoads, loadRoads, after, update handler, lamps).
- todo after shots: SF + SD shots; look at pictures; cable cars drawn? demand `within` 350 at low quality (cap 240) is small.
