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
- fix7: lane-end lookahead (s.end), cable cap; re-ported. running shots batch (shots/run.log)
- fix8: caps raised (far cars as boxes by day, lamps by night), TIGER not cached. NOT yet in out/tb.html (batch running on older build)
- shots so far: shots/sd_i5_17.png la_4level_15.png la_4level_03.png (camera on buildings; freeway at edge). batch 3 aims the camera along the road (tests/shots.js arg 7).
- fix: sources are rate-based (headway of the hour's flow); SD 3h jam gone. re-ported + tb.html rebuilt
- port chain terrain->weather->traffic->car applies (scratchpad/chain); carPut goes through terrain's onGround wrapper when present

## State for hand-back (11-23, late)
Files: traffic_core.js (SE.TrafficData, SE.RoadPrep, SE.Flow), traffic_kit.js (SE.TrafficKit, SE.carPut, SE.streetPaint),
aadt_table.js (SE.AADT, built by build_aadt.py), traffic_engine.js (= the three packed; written by the port),
port_traffic.py, scout_roads.js + port_traffic_scout.py, tests/ (lib.js, test_flow.js, test_street.js, shots.js, batch.sh),
out/engine_traffic.js (port on la_engine.js), out/tb.html (test page with both patches), shots/*.png + shots/run.log.
Port chain checked: terrain -> weather -> traffic -> car all apply and parse (scratchpad/chain).
Interface: S.hero {x,z,yaw deg cw from north,speed,len,wid,on} read each frame (on:false = a parked obstacle);
S.trafficHit(x,z,yaw[, {stop:false}]) -> null | {nx,nz,depth,x,z,v,hx,hz,hl,hw,kind,car}; S.traffic = kit (flow, debug(), hour(), roads, streets);
env.roads(la,lo,r[, {only:'freeway'}]) -> roads with id,hw,ref,lanes,oneway,maxspeed,layer,bridge,tunnel,hov + list.signals/stops/osm/tiger.
Touched in la_engine.js: Traffic (top helpers grid/nearList/dkAt/laneKm, setNetwork lanes+dead, extendOnce, place, freeAt, roomAt,
spawn, enter, populate, step: signal clock, extras, obstacle scan, parked scan, level/deck, contact pass, tow threshold, grid reset);
StreetKit (network: hw, n.signal; TT + exports; X.build: raised ways skipped, lane paint; X.update: TT[c.ty], car placement line);
world (WALK line + tf(), setRoads, buildRoads: r.up skip, r.w width, cars; loadRoads; after; update handler: moving + tf().update; lamps).
Known limits: see report.
- trees kept off freeways (mask patch + replan hook); ask() waits up to 5 s for freeways. needs one more browser sanity run
- FINAL (11-23 23:40): all tests rerun on final code; pictures in shots/ (la_110_fwy_16, la_110_fwy_03, la_4level_15/03, sd_i5_fwy_15/03, sd_i5_17, sf_market_st_15); handing back. Open: LA 17:00 picture (browser crash/timeouts under machine load), 405/10 and Van Ness not shot, live Overpass and TIGER fallback not exercised, terrain+car chain applies but was not run in a browser.
