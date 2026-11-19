"""One-off: the code review's findings applied to round 11's sources (run once, in tests/r11).
   1 the storm draws into the lit picture whatever was bound before it; 2 no street maps are asked for at speed; 3 the
   storm's slide asks for frames itself; 4 sound stops with the view; 5 a warp is cancelled when the craft is put away;
   6 the drone's warning is cleared with the ban; 7 the storm slider keeps the keyboard; 8 the age spread is not a year
   young; 9 the on-screen pad serves the two craft; 10 the last step of drying is applied; 11 derivatives are taken
   outside the branches; 12 a craft keeps its target until it has the height too; 13 a grounded drone is not flown home;
   and hemisphere letters in typed coordinates, and craft and drone kept above the flood.
   python3 -I code_fix.py"""
def patch(path, pairs):
    s = open(path, encoding='utf-8').read()
    for a, b in pairs:
        assert s.count(a) == 1, (path, s.count(a), a[:100])
        s = s.replace(a, b)
    open(path, 'w', encoding='utf-8').write(s)
    print('ok', path)

patch('storm_engine.js', [
 # 10: the frame on which everything comes to rest is still applied; the air is left alone from the one after
 ("    let graded = false;\n", "    let graded = false, wasQuiet = false;\n"),
 ("      const held = !K.level && !moving; if (!held) apply(); waterOn(now.surge > -1.2);", "      const quiet = !K.level && !moving, held = quiet && wasQuiet; wasQuiet = quiet; if (!held) apply(); waterOn(now.surge > -1.2);"),
 # 3: 2 while the scene is still sliding to the step (frames are wanted whether or not motion is on), 1 while only the rain and wind move
 ("      K.now = now; return moving || (K.level > 0 && now.rain > 0.05);", "      K.now = now; return moving ? 2 : K.level > 0 && now.rain > 0.05 ? 1 : 0;"),
 ("    /* once a frame: slide toward the step, move the air, time the lightning. True while anything moves. */", "    /* once a frame: slide toward the step, move the air, time the lightning. 2 while the scene is still sliding to the step, 1 while only rain and wind move, 0 at rest. */"),
 # 1: drawn into the lit picture, whatever a layer before this one left bound
 ("        dev.state({ depthTest: false, cull: 'none', blend: 'alphaT' }); p.use().sets({ u_viewProj: cam.viewProj, u_view: cam.view, u_camPos: cam.position, u_depth: R.T.depth,", "        dev.bind(R.T.hdrFlatT); dev.state({ depthTest: false, cull: 'none', blend: 'alphaT' }); p.use().sets({ u_viewProj: cam.viewProj, u_view: cam.view, u_camPos: cam.position, u_depth: R.T.depth,"),
 ("        dev.state({ depthTest: false, cull: 'none', blend: 'addT' }); dev.vao(bvao);", "        dev.bind(R.T.hdrFlatT); dev.state({ depthTest: false, cull: 'none', blend: 'addT' }); dev.vao(bvao);"),
])

patch('uap_engine.js', [
 # 5: a warp ends when the craft is put somewhere or put away
 ("    U.place = (x, z, yaw, y) => { st.x = x; st.z = z; st.y = y; st.vx = st.vy = st.vz = 0; if (yaw != null) st.yaw = yaw; st.target = null; st.mode = 'Hover'; pose(); };",
  "    U.cancel = () => { const W = st.warp; st.warp = null; st.tilt = 0; st.jig = [0, 0, 0]; st.glow = 0; if (st.mode === 'Gravity warp') st.mode = 'Hover'; return W; };   /* a warp given up: the craft is level and still where it is */\n"
  "    U.place = (x, z, yaw, y) => { U.cancel(); st.x = x; st.z = z; st.y = y; st.vx = st.vy = st.vz = 0; if (yaw != null) st.yaw = yaw; st.target = null; st.mode = 'Hover'; pose(); };"),
 # 12: it has arrived when it has the height asked for too
 ("else { st.target = null; st.mode = 'Hover'; } if (t[2] != null) wantY = clamp((t[2] - st.y) * 1.5, -80, 80); }", "else if (t[2] == null || Math.abs(t[2] - st.y) < 0.8) { st.target = null; st.mode = 'Hover'; } if (t[2] != null) wantY = clamp((t[2] - st.y) * 1.5, -80, 80); }"),
])

patch('views_block.js', [
 # 8: O.older(n) is the chance the roof is MORE than n years old, so the chance it is exactly a is older(a - 1) - older(a)
 ("    if (O && O.older) { let prev = 1; for (let a = 0; a <= max; a++) { const nx = a === max ? 0 : clamp(O.older(a + 1), 0, prev), w = prev - nx; if (w > 1e-5) out.push([a, w]); prev = nx; } }",
  "    if (O && O.older) { let prev = 1; for (let a = 0; a <= max; a++) { const nx = a === max ? 0 : clamp(O.older(a), 0, prev), w = prev - nx; if (w > 1e-5) out.push([a, w]); prev = nx; } }"),
 ("  /* a roof's age today as a spread of chances, from the outlook's clock (O.older(n): the chance it is at least n years old), or its one likely age without one */", "  /* a roof's age today as a spread of chances, from the outlook's clock (O.older(n): the chance it is more than n years old), or its one likely age without one */"),
])

patch('port_storm.py', [
 # 6, 13: the ban lifted clears its warning; a hidden drone is brought down without a word; a grounded drone is not flown home
 ("A.grounded = ''; A.ground = msg => { A.grounded = msg || ''; if (msg && st.mode !== 'Landed') { st.mode = 'Landing'; st.target = null; refuse(); } };",
  "A.grounded = ''; A.ground = (msg, quiet) => { const was = A.grounded; A.grounded = msg || ''; if (!msg) { if (was && st.warn === was) st.warn = ''; return; } if (st.mode !== 'Landed') { st.mode = 'Landing'; st.target = null; if (!quiet) refuse(); } };"),
 ("    function grounded() { const no = !SE.STORM[S.storm].fly; if (ALTA) ALTA.ground(no ? NOFLY : ''); if (no && S.mode === 'alta' && ALTA && ALTA.state.mode !== 'Landed') alarm(NOFLY); return no; }",
  "    function grounded() { const no = !SE.STORM[S.storm].fly; if (ALTA) ALTA.ground(no ? NOFLY : '', S.mode !== 'alta'); if (no && S.mode === 'alta' && ALTA && ALTA.state.mode !== 'Landed') alarm(NOFLY); return no; }"),
 ('rep("    A.goTo = (x, z, yaw) => { st.target = [x, z]; st.targetYaw = yaw;", "    A.goTo = (x, z, yaw) => { if (A.grounded) { refuse(); return; } st.target = [x, z]; st.targetYaw = yaw;")',
  'rep("    A.goTo = (x, z, yaw) => { st.target = [x, z]; st.targetYaw = yaw;", "    A.goTo = (x, z, yaw) => { if (A.grounded) { refuse(); return; } st.target = [x, z]; st.targetYaw = yaw;")\n'
  'rep("    A.rtl = () => { if (st.mode !== \'Landed\') { st.mode = \'Return\'; st.target = [st.home[0], st.home[1]]; } };", "    A.rtl = () => { if (A.grounded) { refuse(); return; } if (st.mode !== \'Landed\') { st.mode = \'Return\'; st.target = [st.home[0], st.home[1]]; } };")\n'
  'rep("    A.place = (x, z, yaw, floorY) => { st.x = x; st.z = z;", "    A.place = (x, z, yaw, floorY) => { st.warn = \'\'; st.x = x; st.z = z;")'),
 # 3: frames while the scene slides to the step, with motion on or off
 ('    "      if (SK.update(dt, cam, engine.playing && engine.live) && engine.live && engine.playing && engine.onScreen) engine.wake();\\n"',
  '    "      { const moving = SK.update(dt, cam, engine.playing && engine.live); if (moving === 2) need(); if (moving && engine.live && engine.playing && engine.onScreen) engine.wake(); }\\n"'),
 # 11: the size of a pixel on the surface is measured before the branches, where a derivative is defined
 ("  { float up = smoothstep(0.35, 0.9, N.y) * u_wetness * u_wetMask;\n    if (up > 0.001) { float pud = up * smoothstep(0.52, 0.68, fbm(v_wpos.xz * 0.19)); base.rgb *= mix(1.0, 0.58, up); s.roughness = mix(mix(s.roughness, 0.16, up * 0.85), 0.035, pud); N = normalize(mix(N, vec3(0.0, 1.0, 0.0), pud * 0.9));\n      if (u_rainK.x > 0.001) { vec2 p = v_wpos.xz; float fw = max(length(dFdx(p)), length(dFdy(p))), nearK = 1.0 - smoothstep(0.02, 0.085, fw), k = u_rainK.x;",
  "  { float up = smoothstep(0.35, 0.9, N.y) * u_wetness * u_wetMask, fw = max(length(dFdx(v_wpos.xz)), length(dFdy(v_wpos.xz)));\n    if (up > 0.001) { float pud = up * smoothstep(0.52, 0.68, fbm(v_wpos.xz * 0.19)); base.rgb *= mix(1.0, 0.58, up); s.roughness = mix(mix(s.roughness, 0.16, up * 0.85), 0.035, pud); N = normalize(mix(N, vec3(0.0, 1.0, 0.0), pud * 0.9));\n      if (u_rainK.x > 0.001) { vec2 p = v_wpos.xz; float nearK = 1.0 - smoothstep(0.02, 0.085, fw), k = u_rainK.x;"),
 # 4: sound stops when the view is left and comes back with it
 ('rep("      dropCrate, engine, canvas: cv, kit: K, street: ST, world: S, hvac: HV,", "      storm: n => { setStorm(n); return SK.info(); }, stormKit: SK, warn: alarm, NOFLY,\\n      dropCrate, engine, canvas: cv, kit: K, street: ST, world: S, hvac: HV,")',
  'rep("      dropCrate, engine, canvas: cv, kit: K, street: ST, world: S, hvac: HV,", "      storm: n => { setStorm(n); return SK.info(); }, stormKit: SK, warn: alarm, NOFLY,\\n      dropCrate, engine, canvas: cv, kit: K, street: ST, world: S, hvac: HV,")\n'
  'rep("      start() { engine.start(); engine.resize(); need(3); }, stop() { engine.stop(); S.keys = {}; },", "      start() { engine.start(); engine.resize(); if (S.soundOn && engine.audio) engine.audio.enable(); need(3); }, stop() { engine.stop(); S.keys = {}; if (engine.audio) engine.audio.disable(); },   /* the storm is not heard once the view is left */")\n'
  'rep("      sound(on) { if (!engine.audio) return false; if (on) {", "      sound(on) { if (!engine.audio) return false; S.soundOn = !!on; if (on) {")\n'
  'rep("        o = o || {}; engine.start(); engine.resize(); if (o.mode && HEIGHT[o.mode]) S.mode = o.mode;", "        o = o || {}; engine.start(); engine.resize(); if (S.soundOn && engine.audio && !engine.audio.on) engine.audio.enable(); if (o.mode && HEIGHT[o.mode]) S.mode = o.mode;")\n'
  '# the drone stands on the flood, not under it\n'
  'rep("if (engine.playing && ALTA.update(dt, { floor: floorTop, block: blockAt,", "if (engine.playing && ALTA.update(dt, { floor: (x, z) => Math.max(floorTop(x, z), SK.now ? SK.now.surge : -9), block: blockAt,")'),
])

patch('port_uap.py', [
 # the open() anchor now carries the sound line that port_storm.py adds before this script runs
 ('rep("        o = o || {}; engine.start(); engine.resize(); if (o.mode && HEIGHT[o.mode]) S.mode = o.mode;", "        o = o || {}; if (S.ok && isUap(S.mode) && UAP && UAP.state.warp) { if (o.cur !== undefined) { S.cur = o.cur; highlight(); } return; }   /* it is on its way: the warp puts it down */\\n        engine.start(); engine.resize(); if (o.mode && HEIGHT[o.mode]) S.mode = o.mode;")',
  'rep("        o = o || {}; engine.start(); engine.resize(); if (S.soundOn", "        o = o || {}; if (S.ok && isUap(S.mode) && UAP && UAP.state.warp) { if (o.cur !== undefined) { S.cur = o.cur; highlight(); } return; }   /* it is on its way: the warp puts it down */\\n        engine.start(); engine.resize(); if (S.soundOn")'),
 # 2: at speed no street maps are asked for; one is, when it slows. The craft hangs over the flood, and its camera stays above it
 ("        if (engine.playing) { const px = S.x, pz = S.z, was = S.fast; UAP.update(dt, { floor: floorTop, block: blockAt });", "        if (engine.playing) { const px = S.x, pz = S.z, was = S.fast, fl = SK.now ? SK.now.surge : -9; UAP.update(dt, { floor: (x, z) => Math.max(floorTop(x, z), fl), block: blockAt });"),
 ("          if (was && !S.fast) { plan(); ensureAt = null; } after(", "          if (was && !S.fast) { plan(); ensureAt = null; loadRoads(); } after("),
 ("cx = Pn[0] - fx * d; cy = Math.max(0.6, Pn[1] + 2.5 - fy * d); cz = Pn[2] - fz * d; }", "cx = Pn[0] - fx * d; cy = Math.max(0.6, (SK.now ? SK.now.surge : -9) + 0.8, Pn[1] + 2.5 - fy * d); cz = Pn[2] - fz * d; }"),
 ('rep("if (Math.hypot(S.x, S.z) > 12000) { const [la, lo] = toLL(S.x, S.z); recenter(la, lo); }", "if (Math.hypot(S.x, S.z) > (S.fast ? 90000 : 12000)) { const [la, lo] = toLL(S.x, S.z); recenter(la, lo); }")',
  'rep("if (Math.hypot(S.x, S.z) > 12000) { const [la, lo] = toLL(S.x, S.z); recenter(la, lo); }", "if (Math.hypot(S.x, S.z) > (S.fast ? 90000 : 12000)) { const [la, lo] = toLL(S.x, S.z); recenter(la, lo); }")\n'
  'rep("if (S.roadsAt && Math.hypot(S.x - S.roadsAt[0], S.z - S.roadsAt[1]) > 230) loadRoads();", "if (!S.fast && S.roadsAt && Math.hypot(S.x - S.roadsAt[0], S.z - S.roadsAt[1]) > 230) loadRoads();")\n'
  '# the streets asked for last are the ones kept, whichever answer comes back last\n'
  'rep("      const gen = S.gen, [la, lo] = toLL(S.x, S.z); S.roadsAt = [S.x, S.z];", "      const gen = S.gen, ask = S.roadsAsk = (S.roadsAsk || 0) + 1, [la, lo] = toLL(S.x, S.z); S.roadsAt = [S.x, S.z];")\n'
  'rep("      try { const list = await env.roads(la, lo, 560); if (gen !== S.gen) return; setRoads(list);", "      try { const list = await env.roads(la, lo, 560); if (gen !== S.gen || ask !== S.roadsAsk) return; setRoads(list);")'),
 # 5: putting the craft away gives up a warp in flight
 ('    "      if (isUap(was) && !isUap(m) && UAP) { UAP.show(false); if (S.fast) { S.fast = false; ensureAt = null; } }\\n"',
  '    "      if (isUap(was) && !isUap(m) && UAP) { if (UAP.state.warp) warpOff(); UAP.show(false); if (S.fast) { S.fast = false; ensureAt = null; } }\\n"'),
 ("    function warpTo(lat, lon, o) {\n", "    function warpOff() { if (!UAP || !UAP.cancel()) return; warpEl.className = 'se-warp'; need(3); if (env.onWarp) env.onWarp('done', {}); }   /* a warp given up: the craft was put away before it left */\n    function warpTo(lat, lon, o) {\n"),
])

patch('gen_en.py', [
 # 7: the slider keeps the keyboard after the bar is drawn again
 ("sr.onchange = () => renderEnBar(); }", "sr.onchange = () => { const had = document.activeElement === sr; renderEnBar(); const n2 = $('#scEnStorm', enBar); if (had && n2) { try { n2.focus({ preventScroll: true }); } catch (e) { /* fine */ } } }; }"),
 # hemisphere letters are read: S and E are not Louisiana
 ("const m = /^\\\\s*(-?\\\\d{1,3}(?:\\\\.\\\\d+)?)\\\\s*°?\\\\s*[NnSs]?\\\\s*[,;\\\\s]\\\\s*(-?\\\\d{1,3}(?:\\\\.\\\\d+)?)\\\\s*°?\\\\s*[WwEe]?\\\\s*$/.exec(q);", "const m = /^\\\\s*(-?\\\\d{1,3}(?:\\\\.\\\\d+)?)\\\\s*°?\\\\s*([NnSs])?\\\\s*[,;\\\\s]\\\\s*(-?\\\\d{1,3}(?:\\\\.\\\\d+)?)\\\\s*°?\\\\s*([WwEe])?\\\\s*$/.exec(q);"),
 ("else if (m) { la = +m[1]; lo = +m[2]; if (Math.abs(la) > 60 && Math.abs(lo) < 60) { const t2 = la; la = lo; lo = t2; } if (lo > 0) lo = -lo; label = la.toFixed(4) + ', ' + lo.toFixed(4); }",
  "else if (m) { la = +m[1]; lo = +m[3]; const ns = (m[2] || '').toUpperCase(), ew = (m[4] || '').toUpperCase(); if (!ns && !ew && Math.abs(la) > 60 && Math.abs(lo) < 60) { const t2 = la; la = lo; lo = t2; } if (ns === 'S') la = -Math.abs(la); if (ew === 'W') lo = -Math.abs(lo); else if (ew === 'E') lo = Math.abs(lo); else if (lo > 0) lo = -lo; label = la.toFixed(4) + ', ' + lo.toFixed(4); }"),
 # 9: the on-screen pad's climb and descend buttons, and its keys, serve the two craft as they serve the drone
 ("rep(\"      let enGfxOpen = false, enPlayT = 0;\\n\", \"\"\"      let enGfxOpen = false, enPlayT = 0, warping = false, warpT = 0, warpQ = '', enSound = false;",
  "rep(\"$$('#scEnPad .sc-enalt', root).forEach(x => { x.hidden = stNow.mode !== 'alta'; });\", \"$$('#scEnPad .sc-enalt', root).forEach(x => { x.hidden = !(stNow.mode === 'alta' || stNow.mode === 'saucer' || stNow.mode === 'tictac'); });\")\nrep(\"if (en.state().mode === 'alta') { en.hold(k, true);\", \"if (['alta', 'saucer', 'tictac'].includes(en.state().mode)) { en.hold(k, true);\")\nrep(\"      let enGfxOpen = false, enPlayT = 0;\\n\", \"\"\"      let enGfxOpen = false, enPlayT = 0, warping = false, warpT = 0, warpQ = '', enSound = false;"),
])
