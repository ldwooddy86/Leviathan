"""Round 11: the flying saucer and the Tic Tac in the Scout Engine. Reads build/engine.js as port_storm.py left it and
writes it back with the craft kit (tests/r11/uap_engine.js) and the world's wiring: two more ways to move, their camera,
controls and read-out, gravity warp to a place, and a world that does not try to build every street it is flown over at
thousands of miles an hour. Every anchor must occur exactly once.   python3 -I tests/r11/port_uap.py"""
import os
SP = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
P = os.path.join(SP, 'build', 'engine.js')
s = open(P, encoding='utf-8').read()
kit = open(os.path.join(SP, 'tests', 'r11', 'uap_engine.js'), encoding='utf-8').read()
def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (s.count(a), a[:110])
    s = s.replace(a, b)

rep("  /* ==== rooftop scout on the engine: the neighborhood, streamed around the camera ==== */\n", kit + "  /* ==== rooftop scout on the engine: the neighborhood, streamed around the camera ==== */\n")

# ---- two more ways to move ----
rep("alta: { eye: 30, pitch: -14 }, metro: { eye: 1400, pitch: -36 } };", "alta: { eye: 30, pitch: -14 }, metro: { eye: 1400, pitch: -36 }, saucer: { eye: 60, pitch: -12 }, tictac: { eye: 60, pitch: -12 } };")
rep("let ALTA = null; S.chase = { yaw: 0, pitch: -16, dist: 7.5 }; S.altaCam = 'chase';",
    "let ALTA = null; S.chase = { yaw: 0, pitch: -16, dist: 7.5 }; S.altaCam = 'chase';\n"
    "    /* the flying saucer and the Tic Tac (SE.UapKit): made the first time one is asked for. S.fast: it is going too fast for the near world to be built under it */\n"
    "    let UAP = null; const isUap = m => m === 'saucer' || m === 'tictac'; S.uchase = { yaw: 0, pitch: -12, dist: 28 }; S.uapCam = 'chase'; S.fast = false;")

# ---- the camera: behind the craft, or looking down from under it ----
rep("      if (m === 'alta' && ALTA) { const a = ALTA.state; S.x = a.x; S.z = a.z; let cx, cy, cz;",
    """      if (isUap(m) && UAP) { const a = UAP.state, Pn = UAP.anchor(), W = a.warp; S.x = Pn[0]; S.z = Pn[2]; let cx, cy, cz;
        if (S.uapCam === 'belly' && !W) { S.yaw = (a.yaw + a.pan + 360) % 360; S.pitch = a.gimbal; cx = Pn[0]; cy = Pn[1] - 1.4; cz = Pn[2]; }
        else { const yw = a.yaw + S.uchase.yaw, y = Rd(yw), pp = Rd(S.uchase.pitch), fx = Math.sin(y) * Math.cos(pp), fy = Math.sin(pp), fz = -Math.cos(y) * Math.cos(pp), d = S.uchase.dist; S.yaw = (yw + 3600) % 360; S.pitch = S.uchase.pitch; cx = Pn[0] - fx * d; cy = Math.max(0.6, (SK.now ? SK.now.surge : -9) + 0.8, Pn[1] + 2.5 - fy * d); cz = Pn[2] - fz * d; }
        t.setPosition(cx, cy, cz); Q.fromEuler(t.rotation, Rd(S.pitch), -Rd(S.yaw), 0); t.dirty(); cam.fov = S.fov + (W && W.out ? 40 * W.out : 0); cam.near = S.uapCam === 'belly' && !W ? clamp(Pn[1] * 0.03, 0.4, 5) : 0.5;
        const sd3 = (QUALITY[engine.quality] || QUALITY.high).shadowDistance * (Pn[1] > 600 ? 9 : Pn[1] > 90 ? 2.4 : 1.5); if (R.settings.shadowDistance !== sd3) R.settings.shadowDistance = sd3; return; }
      if (m === 'alta' && ALTA) { const a = ALTA.state; S.x = a.x; S.z = a.z; let cx, cy, cz;""")

# ---- the sticks ----
rep("      if (pad && S.mode !== 'alta') { fwd -= pad.ly;", "      if (pad && S.mode !== 'alta' && !isUap(S.mode)) { fwd -= pad.ly;")
rep("      if (S.mode === 'alta' && ALTA) { const A = ALTA.input, foc = document.activeElement === cv;",
    """      if (isUap(S.mode) && UAP) { const A = UAP.input, foc = document.activeElement === cv;
        A.fwd = (k.fwd ? 1 : 0) - (k.back ? 1 : 0) + (foc ? I.axis('KeyS', 'KeyW') : 0); A.right = foc ? I.axis('KeyA', 'KeyD') : 0; A.yaw = (k.right ? 1 : 0) - (k.left ? 1 : 0) + (foc ? I.axis('ArrowLeft', 'ArrowRight') + I.axis('KeyQ', 'KeyE') : 0); A.up = (k.up ? 1 : 0) - (k.down ? 1 : 0) + (foc ? I.axis('ArrowDown', 'ArrowUp') + I.axis('KeyF', 'KeyR') : 0); A.boost = foc && !!(I.key('ShiftLeft') || I.key('ShiftRight'));
        if (pad) { A.fwd -= pad.ly; A.right += pad.lx; A.yaw += pad.rx; A.up -= pad.ry; } A.fwd = clamp(A.fwd, -1, 1); A.right = clamp(A.right, -1, 1); A.yaw = clamp(A.yaw, -1, 1); A.up = clamp(A.up, -1, 1);
        if (engine.playing) { const px = S.x, pz = S.z, was = S.fast, fl = SK.now ? SK.now.surge : -9; UAP.update(dt, { floor: (x, z) => Math.max(floorTop(x, z), fl), block: blockAt }); const Pn = UAP.anchor(); S.x = Pn[0]; S.z = Pn[2]; S.fast = Math.hypot(UAP.state.vx, UAP.state.vz) > 170 || !!UAP.state.warp;
          if (was && !S.fast) { plan(); ensureAt = null; loadRoads(); } after(Math.hypot(S.x - px, S.z - pz) < 0.02); need(); } }
      else if (S.mode === 'alta' && ALTA) { const A = ALTA.input, foc = document.activeElement === cv;""")

# ---- a world flown over fast: the far ground only, no streets and roofs asked for, and its origin left alone until the craft slows ----
rep("if (Math.hypot(S.x, S.z) > 12000) { const [la, lo] = toLL(S.x, S.z); recenter(la, lo); }", "if (Math.hypot(S.x, S.z) > (S.fast ? 90000 : 12000)) { const [la, lo] = toLL(S.x, S.z); recenter(la, lo); }")
rep("if (S.roadsAt && Math.hypot(S.x - S.roadsAt[0], S.z - S.roadsAt[1]) > 230) loadRoads();", "if (!S.fast && S.roadsAt && Math.hypot(S.x - S.roadsAt[0], S.z - S.roadsAt[1]) > 230) loadRoads();")
# the streets asked for last are the ones kept, whichever answer comes back last
rep("      const gen = S.gen, [la, lo] = toLL(S.x, S.z); S.roadsAt = [S.x, S.z];", "      const gen = S.gen, ask = S.roadsAsk = (S.roadsAsk || 0) + 1, [la, lo] = toLL(S.x, S.z); S.roadsAt = [S.x, S.z];")
rep("      try { const list = await env.roads(la, lo, 560); if (gen !== S.gen) return; setRoads(list);", "      try { const list = await env.roads(la, lo, 560); if (gen !== S.gen || ask !== S.roadsAsk) return; setRoads(list);")
rep("[S.x, S.z] = toL(keepLL[0], keepLL[1]); if (ALTA) {", "[S.x, S.z] = toL(keepLL[0], keepLL[1]); if (UAP && isUap(S.mode) && !UAP.state.warp) { UAP.state.x = S.x; UAP.state.z = S.z; UAP.state.target = null; } if (ALTA) {")
rep("if (!env.ensure || !S.ok) return;", "if (!env.ensure || !S.ok || S.fast) return;")
rep("S.planCell = cX + '/' + cY; queue.length = 0;", "S.planCell = cX + '/' + cY; queue.length = 0;\n      if (S.fast) { CELLS.forEach(c => { if (Math.hypot(c.cx - S.x, c.cz - S.z) > Rm + size * 1.6) dropCell(c); }); farTiles(); need(); return; }")
rep("      FARZ.forEach(L => { const size = ", "      FARZ.forEach(L => { if (S.fast && L.z === 17) return; const size = ")
rep("const inner = L.inner === 1 ? WIDE.reach : L.inner;", "const inner = S.fast ? 0 : L.inner === 1 ? WIDE.reach : L.inner;")

# ---- taking the craft out, putting it away ----
rep("      if (was === 'alta' && ALTA) ALTA.show(false);",
    "      if (was === 'alta' && ALTA) ALTA.show(false);\n"
    "      if (isUap(was) && !isUap(m) && UAP) { if (UAP.state.warp) warpOff(); UAP.show(false); if (S.fast) { S.fast = false; ensureAt = null; } }\n"
    "      if (isUap(m)) { if (!UAP) UAP = SE.UapKit(engine); UAP.use(m); if (!isUap(was)) UAP.place(S.x, S.z, S.yaw, Math.max(floorTop(S.x, S.z) + 34, was === 'metro' ? 900 : was === 'bird' ? 120 : 48)); UAP.show(true); engine.playing = true; S.fov = 65; }")
rep("mode: S.mode, alta: S.mode === 'alta' && ALTA ? {", "mode: S.mode, storm: S.storm, uap: isUap(S.mode) && UAP ? { kind: UAP.kind, mode: UAP.state.mode, alt: UAP.state.y, speed: Math.hypot(UAP.state.vx, UAP.state.vz), warp: UAP.state.warp ? UAP.state.warp.phase : null, cam: S.uapCam } : null, alta: S.mode === 'alta' && ALTA ? {")
rep("altaCam: S.altaCam,", "altaCam: S.altaCam, uapCam: S.uapCam,")

# ---- its read-out ----
rep("      const on = S.mode === 'alta' && !!ALTA; if (hudEl.hidden !== !on) hudEl.hidden = !on; if (!on) return;",
    """      if (isUap(S.mode) && UAP) { if (hudEl.hidden) hudEl.hidden = false; const now = performance.now(); if (now - hudT < 160) return; hudT = now;
        const a = UAP.state, sp = Math.hypot(a.vx, a.vz), agl = Math.max(0, a.y - floorTop(a.x, a.z)), ll = toLL(a.x, a.z), W = a.warp, sn = SE.STORM[S.storm];
        const h = `<span class="se-hud-row"><b>${esc(UAP.SPEC[UAP.kind].name)}</b><i>${esc(a.mode)}</i>${W ? `<span class="se-hud-warp">${W.phase === 'turn' ? 'TURNING TO IT' : W.phase === 'tilt' ? 'STANDING ON ITS EDGE' : 'GRAVITY WARP SPEED'}</span>` : ''}<span>ALT <b>${agl.toFixed(0)} m</b> ${Math.round(agl * 3.281).toLocaleString('en-US')} ft</span><span>SPD <b>${Math.round(sp * 2.237).toLocaleString('en-US')} mph</b>${sp > 343 ? ' Mach ' + (sp / 343).toFixed(1) : ''}</span><span>HDG <b>${String(Math.round(a.yaw) % 360).padStart(3, '0')}°</b></span><span>AT <b>${ll[0].toFixed(4)}, ${ll[1].toFixed(4)}</b></span><span>WEATHER <b>${esc(sn.s)}</b></span><span>CAM <b>${S.uapCam === 'belly' ? 'looking down ' + Math.round(a.gimbal) + '°' : 'chase'}</b></span><span>ROOF VIEW <b>${gfx.lens === 'off' ? 'off' : esc(gfx.lens) + (gfx.lens === 'time' ? ' +' + S.year : '')}</b></span></span>` +
          `<span class="se-hud-keys">W S A D fly · ← → turn · ↑ ↓ or R F climb and descend · Shift faster · C camera · X roof views · G gravity warp to an address or coordinates · click the ground to go there, double click a roof to hang over it</span>`;
        if (hudEl._h !== h) { hudEl.innerHTML = h; hudEl._h = h; } return; }
      const on = S.mode === 'alta' && !!ALTA; if (hudEl.hidden !== !on) hudEl.hidden = !on; if (!on) return;""")

# ---- the mouse and the keys ----
rep("const lookNow = () => (S.mode === 'orbit' ? [S.orbit.yaw, S.orbit.pitch] : S.mode === 'alta' && ALTA ?", "const lookNow = () => (S.mode === 'orbit' ? [S.orbit.yaw, S.orbit.pitch] : isUap(S.mode) && UAP ? (S.uapCam === 'belly' ? [UAP.state.pan, UAP.state.gimbal] : [S.uchase.yaw, S.uchase.pitch]) : S.mode === 'alta' && ALTA ?")
rep("        if (S.mode === 'alta' && ALTA) { if (S.altaCam === 'payload') { ALTA.state.pan = clamp(drag.yaw - dx * f, -175, 175);",
    "        if (isUap(S.mode) && UAP) { if (S.uapCam === 'belly') { UAP.state.pan = clamp(drag.yaw - dx * f, -175, 175); UAP.state.gimbal = clamp(drag.pitch + dy * f, -90, 10); } else { S.uchase.yaw = drag.yaw - dx * 0.3; S.uchase.pitch = clamp(drag.pitch + dy * 0.25, -86, 20); } }\n"
    "        else if (S.mode === 'alta' && ALTA) { if (S.altaCam === 'payload') { ALTA.state.pan = clamp(drag.yaw - dx * f, -175, 175);")
rep("if (h.ground && S.mode === 'alta' && ALTA) { ALTA.goTo(h.ground[0], h.ground[2]); engine.playing = true; need(); }", "if (h.ground && isUap(S.mode) && UAP) { UAP.goTo(h.ground[0], h.ground[2]); engine.playing = true; need(); } else if (h.ground && S.mode === 'alta' && ALTA) { ALTA.goTo(h.ground[0], h.ground[2]); engine.playing = true; need(); }")
rep("if (h && h.b && S.mode === 'alta' && ALTA) { standOff(h.b); return; }", "if (h && h.b && isUap(S.mode) && UAP) { const q = toL(h.b.lat, h.b.lon); UAP.goTo(q[0], q[1], Math.max(2.4, env.height(h.b)) + 30); engine.playing = true; need(); return; } if (h && h.b && S.mode === 'alta' && ALTA) { standOff(h.b); return; }")
rep("else if (S.mode === 'alta' && S.altaCam !== 'payload') S.chase.dist =", "else if (isUap(S.mode) && S.uapCam !== 'belly') S.uchase.dist = clamp(S.uchase.dist * (1 + dy * 0.0011), 16, 420); else if (S.mode === 'alta' && S.altaCam !== 'payload') S.chase.dist =")
rep("if (S.mode === 'alta' && ALTA) { if (code === 'KeyC') {", "if (isUap(S.mode) && UAP) { if (code === 'KeyC') { S.uapCam = S.uapCam === 'belly' ? 'chase' : 'belly'; need(); if (env.onGraphics) env.onGraphics(graphics()); } else if (code === 'KeyG') { if (env.onWarpAsk) env.onWarpAsk(); } engine.playing = true; return; } if (S.mode === 'alta' && ALTA) { if (code === 'KeyC') {")
rep("      if (S.mode === 'alta' && ALTA) { const a = ALTA.state; a.yaw = (DEG * Math.atan2(x - a.x, -(z - a.z)) + 360) % 360; a.pan = 0;",
    "      if (isUap(S.mode) && UAP) { const a = UAP.state; if (!a.warp) { a.yaw = (DEG * Math.atan2(x - a.x, -(z - a.z)) + 360) % 360; a.pan = 0; if (S.uapCam === 'belly') a.gimbal = clamp(DEG * Math.atan2(h * 0.5 - a.y, Math.max(1, Math.hypot(x - a.x, z - a.z))), -90, 10); else S.uchase.yaw = 0; } need(); if (env.onMove) env.onMove(state()); return; }\n"
    "      if (S.mode === 'alta' && ALTA) { const a = ALTA.state; a.yaw = (DEG * Math.atan2(x - a.x, -(z - a.z)) + 360) % 360; a.pan = 0;")

# ---- being sent somewhere: near, it flies there; far, it is put there (the dashboard's own moves; warp is below) ----
rep("        { const p1 = toL(lat, lon); if (S.mode === 'alta' && ALTA && !far) {",
    "        { const p1 = toL(lat, lon); if (isUap(S.mode) && UAP && !far) { const d = Math.hypot(p1[0] - UAP.state.x, p1[1] - UAP.state.z); if (d < 2500 && d > 3) { const tb = o.cur != null ? env.byId(o.cur) : null, q2 = tb ? toL(tb.lat, tb.lon) : p1; UAP.goTo(q2[0], q2[1], tb ? Math.max(2.4, env.height(tb)) + 34 : null);   /* over the building itself, not the kerb in front of it */ engine.playing = true; if (o.cur !== undefined) S.cur = o.cur; index(); plan(); highlight(); need(3); if (env.onMove) env.onMove(state()); return; } }\n"
    "          if (S.mode === 'alta' && ALTA && !far) {")
rep("        o = o || {}; engine.start(); engine.resize(); if (S.soundOn", "        o = o || {}; if (S.ok && isUap(S.mode) && UAP && UAP.state.warp) { if (o.cur !== undefined) { S.cur = o.cur; highlight(); } return; }   /* it is on its way: the warp puts it down */\n        engine.start(); engine.resize(); if (S.soundOn")
rep("if (S.mode === 'alta' && ALTA) { ALTA.place(S.x, S.z, yaw != null ? yaw : S.yaw, 0); ALTA.takeoff(28); }", "if (isUap(S.mode)) { if (!UAP) UAP = SE.UapKit(engine); UAP.use(S.mode); UAP.show(true); UAP.place(S.x, S.z, yaw != null ? yaw : S.yaw, 60); S.fast = false; } if (S.mode === 'alta' && ALTA) { ALTA.place(S.x, S.z, yaw != null ? yaw : S.yaw, 0); ALTA.takeoff(28); }")

# ---- gravity warp ----
rep("    engine.start();\n    return {\n", """    /* Gravity warp: to a latitude and longitude anywhere the module allows. The craft turns to the place (the saucer then
       stands on its edge), leaves faster than the eye follows, and the world is rebuilt round where it went: it comes in to
       a stop 60 m over the place. o.cur: the building to select there. Returns false if no craft is out or one is on its way. */
    const warpEl = document.createElement('div'); warpEl.className = 'se-warp'; warpEl.setAttribute('aria-hidden', 'true'); host.appendChild(warpEl);
    function warpOff() { if (!UAP || !UAP.cancel()) return; warpEl.className = 'se-warp'; need(3); if (env.onWarp) env.onWarp('done', {}); }   /* a warp given up: the craft was put away before it left */
    function warpTo(lat, lon, o) {
      o = o || {}; if (!isUap(S.mode) || !UAP || UAP.state.warp || !S.ok) return false; const a = UAP.state, p1 = toL(lat, lon), km = Math.hypot(p1[0] - a.x, p1[1] - a.z) / 1000, yaw = km > 0.02 ? (DEG * Math.atan2(p1[0] - a.x, -(p1[1] - a.z)) + 360) % 360 : a.yaw;
      S.uchase.yaw = 0; if (S.uchase.pitch < -40) S.uchase.pitch = -12; engine.playing = true; engine.wake();
      UAP.warp({ yaw, km,
        onStart: () => { warpEl.className = 'se-warp go'; if (env.onWarp) env.onWarp('go', { lat, lon, km }); },
        onJump: () => {
          if (Math.hypot(...toL(lat, lon)) > 9000) recenter(lat, lon, [lat, lon]); const q = toL(lat, lon); S.x = q[0]; S.z = q[1]; S.on = null; S.tween = null; S.fast = false;
          UAP.arriveAt(q[0], Math.max(floorTop(q[0], q[1]) + 34, 60), q[1]); if (o.cur !== undefined) S.cur = o.cur; index(); plan(); highlight(); R.reset = true; ensureAt = null; ensureSoon(); surgeHere(); warpEl.className = 'se-warp in'; need(6); if (env.onWarp) env.onWarp('there', { lat, lon, km }); },
        onDone: () => { warpEl.className = 'se-warp'; need(3); if (env.onMove) env.onMove(state()); if (env.onWarp) env.onWarp('done', { lat, lon, km }); } });
      need(3); if (env.onMove) env.onMove(state()); return true;
    }

    engine.start();
    return {
""")
rep("      storm: n => { setStorm(n); return SK.info(); }, stormKit: SK, warn: alarm, NOFLY,",
    "      storm: n => { setStorm(n); return SK.info(); }, stormKit: SK, warn: alarm, NOFLY,\n"
    "      /* the flying saucer and the Tic Tac */\n"
    "      uap: { get craft() { return UAP; }, spec: () => (UAP ? UAP.SPEC : null), warp: (lat, lon, o) => warpTo(lat, lon, o), camera(c) { S.uapCam = c || (S.uapCam === 'belly' ? 'chase' : 'belly'); need(); return S.uapCam; }, get warping() { return !!(UAP && UAP.state.warp); } },")

open(P, 'w', encoding='utf-8').write(s)
print('uap ok', len(s))
