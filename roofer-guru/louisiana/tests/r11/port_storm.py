"""Round 11: the storm scale in the Scout Engine. Reads build/engine.js as port_lens.py left it and writes it back with
the storm kit (tests/r11/storm_engine.js), the shader hooks it needs (rain on wet surfaces, flood water, lightning's
flash, wind that bends trees harder, cloud that travels with the wind) and the world's wiring (the scale, the flood on
the coast, the Alta X grounded past light rain). Every anchor must occur exactly once.
  python3 -I tests/r11/port_storm.py"""
import os
SP = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
P = os.path.join(SP, 'build', 'engine.js')
s = open(P, encoding='utf-8').read()
kit = open(os.path.join(SP, 'tests', 'r11', 'storm_engine.js'), encoding='utf-8').read()
def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (s.count(a), a[:110])
    s = s.replace(a, b)
def cut(a, b, new):
    global s
    assert s.count(a) == 1 and s.count(b) == 1, (s.count(a), s.count(b), a[:60], b[:60])
    i, j = s.index(a), s.index(b); assert i < j
    s = s[:i] + new + s[j:]

# ---- wind: a storm's wind holds a tree bent and shakes it faster (the frequencies are fixed, so a rising wind never skips a beat) ----
cut("  CHUNKS.wind = `vec3 windSway(vec3 origin, vec3 wp, float weight, float t, vec3 wind) {\n", "  const SURFACE_VS = `\n",
    """  CHUNKS.wind = `vec3 windSway(vec3 origin, vec3 wp, float weight, float t, vec3 wind) {
  float ph = dot(origin.xz, vec2(0.113, 0.071)), w = min(wind.z, 3.3), hard = smoothstep(1.0, 2.6, w);
  float gust = sin(t * 0.9 + ph) * 0.6 + sin(t * 2.3 + ph * 2.7) * 0.25 + sin(t * 4.3 + ph * 1.9) * 0.24 * hard;
  float flutter = sin(t * 5.3 + wp.x * 1.7 + wp.y * 2.1 + wp.z * 1.3) * 0.12 + sin(t * 11.7 + wp.x * 2.9 + wp.y * 3.3 + wp.z * 2.3) * 0.09 * hard;
  return vec3(wind.x, 0.0, wind.y) * ((gust * mix(1.0, 0.5, hard) + 0.35 + 0.5 * hard) * weight * w) + vec3(flutter, flutter * 0.4, -flutter) * weight * w * 0.35;
}`;
""")

# ---- materials: flood water is a surface of its own ----
rep("      this.wind = o.wind || 0; this.wet = o.wet == null ? 1 : o.wet;", "      this.wind = o.wind || 0; this.wet = o.wet == null ? 1 : o.wet; this.water = !!o.water;   /* water: flood water, its surface worked by the wind (see the surface shader) */")
rep("GROUND_PBR: !!this.groundPBR, CAR: !!this.car }; }", "GROUND_PBR: !!this.groundPBR, CAR: !!this.car, WATER: !!this.water }; }")
rep("| (this.groundPBR ? 16384 : 0) | (this.car ? 32768 : 0); }", "| (this.groundPBR ? 16384 : 0) | (this.car ? 32768 : 0) | (this.water ? 65536 : 0); }")

# ---- the surface shader: rain as it falls ----
rep("uniform float u_alpha, u_roughness, u_metallic, u_normalScale, u_alphaTest, u_wetness, u_wetMask, u_night, u_nightGlow, u_shadeModel, u_time, u_lodBias;",
    "uniform float u_alpha, u_roughness, u_metallic, u_normalScale, u_alphaTest, u_wetness, u_wetMask, u_night, u_nightGlow, u_shadeModel, u_time, u_lodBias;\nuniform vec4 u_rainK;   /* how hard it is raining now (0 to about 1), the wind (in 25 m/s), and which way it blows */")
rep("Surface readSurface() {\n", """/* where drops land on standing water: a ring spreads from a point in each cell of two grids, and more cells are struck as
   the rain grows. xy: how the rings tilt the surface; z: the white of the splash itself */
vec3 rainRings(vec2 p, float t, float k) {
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 2; i++) {
    float sc = i == 0 ? 0.46 : 0.29; vec2 g = p / sc + float(i) * 17.3, id = floor(g), f = fract(g) - 0.5, h = hash22(id + float(i) * 7.1);
    float tt = t * (1.1 + 0.9 * h.x) + h.y * 9.0, ph = fract(tt), live = step(h.x * 1.25, k + 0.12);
    vec2 d = f - (hash22(id * 1.7 + floor(tt)) - 0.5) * 0.5; float r = length(d), R = ph * 0.46;
    float ring = sin((r - R) * 52.0) * smoothstep(0.075, 0.0, abs(r - R)) * (1.0 - ph) * (1.0 - ph) * live;
    acc.xy += d / max(r, 1e-3) * ring; acc.z += smoothstep(0.05, 0.0, r) * smoothstep(0.16, 0.0, ph) * live;
  }
  return acc;
}
Surface readSurface() {
""")
rep("""  /* rain: surfaces that face the sky darken and turn glossy, and water stands in the low places */
  { float up = smoothstep(0.35, 0.9, N.y) * u_wetness * u_wetMask;
    if (up > 0.001) { float pud = up * smoothstep(0.52, 0.68, fbm(v_wpos.xz * 0.19)); base.rgb *= mix(1.0, 0.58, up); s.roughness = mix(mix(s.roughness, 0.16, up * 0.85), 0.035, pud); N = normalize(mix(N, vec3(0.0, 1.0, 0.0), pud * 0.9)); } }
""", """#ifdef WATER
  /* flood water: brown with silt, its surface worked by the wind into short waves that run before it, foam drawn out in
     lines along the wind when it blows hard, and pocked by the rain */
  { vec2 wd = normalize(u_rainK.zw + vec2(1e-4, 0.0)), p = v_wpos.xz, g = vec2(0.0); float t = u_time, k = clamp(u_rainK.y, 0.3, 3.5), amp = 1.0, fr = 0.22, hh = 0.0;
    for (int i = 0; i < 5; i++) { float a = float(i) * 1.13 - 2.26; vec2 d = normalize(wd + vec2(cos(a), sin(a)) * 0.6); float ph = dot(p, d) * fr - t * sqrt(9.81 * fr) + float(i) * 1.7; g += d * (cos(ph) * amp); hh += sin(ph) * amp; amp *= 0.72; fr *= 1.83; }
    float fw = max(length(dFdx(p)), length(dFdy(p))), nearK = 1.0 - smoothstep(0.15, 1.2, fw);
    vec2 ch = (vec2(vnoise(p * 2.1 - wd * t * 2.2), vnoise(p * 2.1 + 31.7 - wd * t * 1.7)) - 0.5) * nearK;
    N = normalize(vec3(-(g.x * 0.045 + ch.x * 0.22) * k, 1.0, -(g.y * 0.045 + ch.y * 0.22) * k));
    /* foam: drawn out in lines along a hard wind, and breaking on the crests */
    float hard = smoothstep(0.9, 2.2, k), far2 = 1.0 - smoothstep(1.5, 6.0, fw), foam = max(smoothstep(0.5, 0.74, fbm(vec2(dot(p, wd) * 0.045 - t * 0.35, dot(p, vec2(-wd.y, wd.x)) * 0.55))) * hard, smoothstep(0.9, 2.1, hh) * hard * (0.35 + 0.65 * vnoise(p * 1.4 - wd * t * 3.0)) * far2);
    base.rgb *= 0.86 + 0.1 * hh * far2; base.rgb = mix(base.rgb, vec3(0.62, 0.6, 0.55), foam * 0.6); s.roughness = mix(0.07, 0.55, foam); s.metallic = 0.0;
    if (u_rainK.x > 0.001) { vec3 rr = rainRings(p, t, u_rainK.x); N = normalize(N + vec3(rr.x, 0.0, rr.y) * (0.5 * nearK)); s.roughness += 0.1 * u_rainK.x * (1.0 - nearK); } }
#endif
  /* rain: surfaces that face the sky darken and turn glossy, and water stands in the low places. While it falls
     (u_rainK.x) rings spread where drops land, the wet surface is pocked all over, and on a slope the water runs down it
     in sheets. Past the distance where a ring is smaller than a pixel all of that is let go, and the surface is only a
     little rougher: rain seen from far off dulls a wet roof's shine. */
  { float up = smoothstep(0.35, 0.9, N.y) * u_wetness * u_wetMask, fw = max(length(dFdx(v_wpos.xz)), length(dFdy(v_wpos.xz)));
    if (up > 0.001) { float pud = up * smoothstep(0.52, 0.68, fbm(v_wpos.xz * 0.19)); base.rgb *= mix(1.0, 0.58, up); s.roughness = mix(mix(s.roughness, 0.16, up * 0.85), 0.035, pud); N = normalize(mix(N, vec3(0.0, 1.0, 0.0), pud * 0.9));
      if (u_rainK.x > 0.001) { vec2 p = v_wpos.xz; float nearK = 1.0 - smoothstep(0.02, 0.085, fw), k = u_rainK.x;
        if (nearK > 0.001) { vec3 rr = rainRings(p, u_time, k); float on = mix(0.3, 1.0, pud) * up * nearK; N = normalize(N + vec3(rr.x, 0.0, rr.y) * (0.55 * on)); base.rgb += vec3(0.5, 0.55, 0.6) * (rr.z * on * 0.22);
          vec3 gN = normalize(v_normal); float sl = length(gN.xz);
          if (sl > 0.12 && pud < 0.5) { vec2 dn = gN.xz / sl, ac = vec2(-dn.y, dn.x); float flow = vnoise(vec2(dot(p, ac) * 6.5, dot(p, dn) * 0.9 - u_time * (1.6 + 2.4 * k))), riv = smoothstep(0.52, 0.88, flow) * k * up * nearK * smoothstep(0.12, 0.3, sl);
            s.roughness = mix(s.roughness, 0.05, riv * 0.8); N = normalize(N + vec3(ac.x, 0.0, ac.y) * ((vnoise(vec2(dot(p, ac) * 19.0, dot(p, dn) * 2.0 - u_time * 3.0)) - 0.5) * riv * 0.35)); } }
        s.roughness = mix(s.roughness, max(s.roughness, 0.12), k * (1.0 - nearK) * up * 0.6); } } }
""")
rep("u_wind: wind, u_wetness: env.wetness,", "u_wind: wind, u_wetness: env.wetness, u_rainK: env.rainK || ZERO4,")
rep("      const wind = [env.windDir ? env.windDir[0] : 0.8, env.windDir ? env.windDir[1] : 0.6, env.wind];\n", "      const wind = [env.windDir ? env.windDir[0] : 0.8, env.windDir ? env.windDir[1] : 0.6, env.wind], ZERO4 = [0, 0, 0, 0];\n")

# ---- the lighting pass: a lightning flash lights every surface, the cloud and the rain filled air for an instant ----
rep("uniform vec3 u_trueSun, u_moonDir; uniform vec4 u_sunDisc; uniform float u_time; uniform int u_viewMode;\n",
    "uniform vec3 u_trueSun, u_moonDir; uniform vec4 u_sunDisc; uniform float u_time; uniform int u_viewMode;\nuniform vec4 u_flash; uniform vec3 u_flashDir;   /* lightning now: its light, and where it stands */\n")
rep("    o_color = vec4(finite(sc), 1.0);", "    if (u_flash.a > 0.0) sc += u_flash.rgb * (0.22 + 1.3 * pow(max(dot(Vd, u_flashDir), 0.0), 7.0));\n    o_color = vec4(finite(sc), 1.0);")
rep("  vec3 c = model < 0.5 ? g2.rgb : shadeSurface(g0.rgb, N, -Vd, rough, g0.a, ao, wpos, viewZ, gl_FragCoord.xy, model, bounce, ssr) + g2.rgb;\n",
    "  vec3 c = model < 0.5 ? g2.rgb : shadeSurface(g0.rgb, N, -Vd, rough, g0.a, ao, wpos, viewZ, gl_FragCoord.xy, model, bounce, ssr) + g2.rgb;\n  if (u_flash.a > 0.0 && model > 0.5) c += g0.rgb * u_flash.rgb * ((0.3 + 0.7 * max(dot(N, u_flashDir), 0.0)) * ao);\n")
rep("  c = finite(c); o_color = vec4(c, 1.0);", "  if (u_flash.a > 0.0) c += u_flash.rgb * (0.13 * (1.0 - exp(-viewZ * u_fog.x * 2.5)));\n  c = finite(c); o_color = vec4(c, 1.0);")
rep("u_time: time, u_viewMode: Math.max(0, VIEW_MODES.indexOf(s.viewMode)) });", "u_time: time, u_viewMode: Math.max(0, VIEW_MODES.indexOf(s.viewMode)), u_flash: env.flash || ZERO4, u_flashDir: env.flashDir || [0, 1, 0] });")
# the flat cloud layer (machines without the clouds with depth) and the cloud deck drift by a distance kept by the storm kit, so a change of wind never jumps them
rep("vec2(u_time * 0.004 * u_skyParams.y, u_time * 0.0017 * u_skyParams.y)", "vec2(0.004, 0.0017) * u_skyParams.y")
rep("u_skyParams: [env.clouds, env.cloudSpeed, env.stars, sky.night]", "u_skyParams: [env.clouds, env.cloudPhase != null ? env.cloudPhase : env.cloudSpeed * time, env.stars, sky.night]")
rep("    params(env, time) { const sp = (env.cloudSpeed == null ? 1 : env.cloudSpeed) * 14, wd = env.windDir || [0.8, 0.6]; return [env.clouds, wd[0] * sp * time, wd[1] * sp * time, time]; }",
    "    params(env, time) { if (env.cloudDrift) return [env.clouds, env.cloudDrift[0], env.cloudDrift[1], time]; const sp = (env.cloudSpeed == null ? 1 : env.cloudSpeed) * 14, wd = env.windDir || [0.8, 0.6]; return [env.clouds, wd[0] * sp * time, wd[1] * sp * time, time]; }")

# ---- the kit itself, before the world ----
rep("  /* ==== rooftop scout on the engine: the neighborhood, streamed around the camera ==== */\n", kit + "  /* ==== rooftop scout on the engine: the neighborhood, streamed around the camera ==== */\n")

# ---- the Alta X is grounded past light rain ----
rep("    A.takeoff = h => { if (st.mode === 'Landed') { st.mode = 'Taking off'; st.climbTo = st.y + (h || 30); } };",
    "    /* weather it may not fly in: said once for each try, and it comes down if it is up */\n    const refuse = () => { const t = performance.now(); if (st.warn === A.grounded && t - (st.warnAt || 0) < 2500) return; st.warnAt = t; st.warn = A.grounded; st.warnN = (st.warnN || 0) + 1; };\n    A.grounded = ''; A.ground = (msg, quiet) => { const was = A.grounded; A.grounded = msg || ''; if (!msg) { if (was && st.warn === was) st.warn = ''; return; } if (st.mode !== 'Landed') { st.mode = 'Landing'; st.target = null; if (!quiet) refuse(); } };\n    A.takeoff = h => { if (A.grounded) { refuse(); return; } if (st.mode === 'Landed') { st.mode = 'Taking off'; st.climbTo = st.y + (h || 30); } };")
rep("    A.goTo = (x, z, yaw) => { st.target = [x, z]; st.targetYaw = yaw;", "    A.goTo = (x, z, yaw) => { if (A.grounded) { refuse(); return; } st.target = [x, z]; st.targetYaw = yaw;")
rep("    A.rtl = () => { if (st.mode !== 'Landed') { st.mode = 'Return'; st.target = [st.home[0], st.home[1]]; } };", "    A.rtl = () => { if (A.grounded) { refuse(); return; } if (st.mode !== 'Landed') { st.mode = 'Return'; st.target = [st.home[0], st.home[1]]; } };")
rep("    A.place = (x, z, yaw, floorY) => { st.x = x; st.z = z;", "    A.place = (x, z, yaw, floorY) => { st.warn = ''; st.x = x; st.z = z;")
rep("if (sticks && (st.mode === 'Go to' || st.mode === 'Return' || st.mode === 'Landing') && st.battery > 0.06) { st.mode = 'Position hold'; st.target = null; }",
    "if (sticks && (st.mode === 'Go to' || st.mode === 'Return' || st.mode === 'Landing') && st.battery > 0.06 && !A.grounded) { st.mode = 'Position hold'; st.target = null; }")

# ---- the world: the scale ----
rep("if (!['today', 'summer', 'fall', 'winter', 'spring'].includes(gfx.day)) gfx.day = 'today';", "if (!['today', 'summer', 'fall', 'winter', 'spring'].includes(gfx.day)) gfx.day = 'today'; if (gfx.weather === 'rain') gfx.weather = 'overcast';   /* rain is on the storm scale now */")
rep("    const hudEl = document.createElement('div'); hudEl.className = 'se-hud'; hudEl.hidden = true; hudEl.setAttribute('role', 'status'); host.appendChild(hudEl);\n",
    "    const hudEl = document.createElement('div'); hudEl.className = 'se-hud'; hudEl.hidden = true; hudEl.setAttribute('role', 'status'); host.appendChild(hudEl);\n"
    "    /* a warning laid over the view, for a few seconds */\n"
    "    const warnEl = document.createElement('div'); warnEl.className = 'se-warn'; warnEl.hidden = true; warnEl.setAttribute('role', 'alert'); host.appendChild(warnEl); let warnOff = 0;\n"
    "    function alarm(t) { warnEl.textContent = t; warnEl.hidden = false; clearTimeout(warnOff); warnOff = setTimeout(() => { warnEl.hidden = true; }, 6500); if (env.onWarn) env.onWarn(t); }\n"
    "    const NOFLY = \"Don't waste a $40,000 drone, stupid. Use the UAPs.\";\n")
cut("    let rainE = null;\n", "    /* lamp posts along the streets; after dark the nearest ones are real lights */\n",
    """    /* The storm scale: 0 is the weather chosen above; 1 to 9 run from light rain to a Category 5 hurricane (SE.STORM, and
       the storm kit that draws them). The flood belongs to the coast: the module says how deep the surge of this storm
       would stand where the camera is (env.surge), which is nowhere below Category 3 and nowhere far from the Gulf. */
    const SK = SE.StormKit(engine, {}); S.storm = 0; S.surge = 0; S.surgeNote = ''; S.surgeAt = null;
    function surgeHere(quiet) {
      const st = SE.STORM[S.storm]; let d = 0, nt = ''; if (S.ok && S.storm && st.surgeFt && env.surge) { const [la, lo] = toLL(S.x, S.z), sg = env.surge(la, lo, S.storm); if (sg) { d = sg.depth > 0 ? sg.depth : 0; nt = sg.note || ''; } }
      S.surgeAt = [S.x, S.z]; if (d === S.surge && nt === S.surgeNote) return; S.surge = d; S.surgeNote = nt; SK.setSurge(d); if (!quiet && env.onGraphics) env.onGraphics(graphics());
    }
    function setSun() {
      const la = S.lat0 || 30.45, lo = S.lon0 || -91.19, t = sunTime(gfx.sun, la, lo), p = solarPosition(t, la, lo), w = WEATHER[gfx.weather] || WEATHER.clear; S.sunAlt = p.alt; S.sunTime = t;
      S.sunNote = p.alt < -1 ? 'The sun is down here at that hour: the scene is lit by the moon, the lamps and the windows.' : '';
      surgeHere(true); const sky = SK.set(S.storm, w, { surge: S.surge });
      V3.copy(scene.env.sunDir, sunVector(p.alt, p.az)); Object.assign(scene.env, sky); scene.envChanged();
      lampsLit(); need(2);
    }
    /* past light rain the Alta X does not fly: it comes down where it is, and will not take off */
    function grounded() { const no = !SE.STORM[S.storm].fly; if (ALTA) ALTA.ground(no ? NOFLY : '', S.mode !== 'alta'); if (no && S.mode === 'alta' && ALTA && ALTA.state.mode !== 'Landed') alarm(NOFLY); return no; }
    function setStorm(n, quiet) { n = clamp(Math.round(+n || 0), 0, SE.STORM.length - 1); if (n === S.storm) return; S.storm = n; setSun(); grounded(); engine.wake(); if (!quiet && env.onGraphics) env.onGraphics(graphics()); }
""")
rep("      if (rainE) rainE.transform.setPosition(S.x + Math.sin(Rd(S.yaw)) * 9, cam.entity.transform.position[1] + 13, S.z - Math.cos(Rd(S.yaw)) * 9);\n",
    "      /* the storm: its rain, wind and lightning move whether or not the camera does, so while one is on the engine stays awake */\n"
    "      { const moving = SK.update(dt, cam, engine.playing && engine.live); if (moving === 2) need(); if (moving && engine.live && engine.playing && engine.onScreen) engine.wake(); }\n"
    "      if (S.storm && S.surgeAt && Math.hypot(S.x - S.surgeAt[0], S.z - S.surgeAt[1]) > 700) surgeHere();\n")
# where flood water stands deeper than the eye, the eye is kept above it: on the street or on foot one is afloat
rep("      else if (m === 'walk') eye = S.y + HEIGHT.walk.eye; else eye = HEIGHT[m].eye;\n",
    "      else if (m === 'walk') eye = S.y + HEIGHT.walk.eye; else eye = HEIGHT[m].eye;\n"
    "      { const fl = SK.now ? SK.now.surge : -9; if (fl > 0 && eye < fl + (m === 'orbit' ? 0.8 : 1.6)) eye = fl + (m === 'orbit' ? 0.8 : 1.6); }   /* flood water deeper than the eye: afloat on it */\n")
rep("    let hudT = 0, warnT = 0, warnTxt = '';", "    let hudT = 0, warnT = 0, warnTxt = '', warnN = 0;")
rep("if (a.warn && a.warn !== warnTxt) { warnTxt = a.warn; warnT = now; if (env.onNote) env.onNote(a.warn); }",
    "if (a.warn && (a.warn !== warnTxt || (a.warnN || 0) !== warnN)) { warnTxt = a.warn; warnN = a.warnN || 0; warnT = now; if (a.warn === NOFLY) alarm(NOFLY); else if (env.onNote) env.onNote(a.warn); }")
rep("      if (!HEIGHT[m] || m === S.mode) return; const was = S.mode; S.mode = m; S.tween = null;",
    "      if (!HEIGHT[m] || m === S.mode) return; if (m === 'alta' && !SE.STORM[S.storm].fly) { alarm(NOFLY); return false; }\n      const was = S.mode; S.mode = m; S.tween = null;")
rep("      if (m === 'alta') { if (!ALTA) ALTA = AltaKit(engine, K); ALTA.place(", "      if (m === 'alta') { if (!ALTA) ALTA = AltaKit(engine, K); ALTA.ground(''); ALTA.place(")
rep("if (o.weather && WEATHER[o.weather] && o.weather !== gfx.weather) { gfx.weather = o.weather; setSun(); }", "if (o.weather && WEATHER[o.weather] && o.weather !== 'rain' && o.weather !== gfx.weather) { gfx.weather = o.weather; setSun(); } if (o.storm != null) setStorm(o.storm, true);")
rep("sun: gfx.sun, weather: gfx.weather, trees: gfx.trees,", "sun: gfx.sun, weather: gfx.weather, storm: S.storm, stormInfo: SK.info(), surge: S.surge, surgeNote: S.surgeNote, trees: gfx.trees,")
rep("'x-ray': 'the x-ray layer', 'roof views': 'the roof views' };", "'x-ray': 'the x-ray layer', 'roof views': 'the roof views', rain: 'the falling rain' };")
rep("S.gen++; lensClear(); HV.clear();", "S.gen++; SK.reset(); lensClear(); HV.clear();")
rep("      dropCrate, engine, canvas: cv, kit: K, street: ST, world: S, hvac: HV,", "      storm: n => { setStorm(n); return SK.info(); }, stormKit: SK, warn: alarm, NOFLY,\n      dropCrate, engine, canvas: cv, kit: K, street: ST, world: S, hvac: HV,")
rep("      start() { engine.start(); engine.resize(); need(3); }, stop() { engine.stop(); S.keys = {}; },", "      start() { engine.start(); engine.resize(); if (S.soundOn && engine.audio) engine.audio.enable(); need(3); }, stop() { engine.stop(); S.keys = {}; if (engine.audio) engine.audio.disable(); },   /* the storm is not heard once the view is left */")
rep("      sound(on) { if (!engine.audio) return false; if (on) {", "      sound(on) { if (!engine.audio) return false; S.soundOn = !!on; if (on) {")
rep("        o = o || {}; engine.start(); engine.resize(); if (o.mode && HEIGHT[o.mode]) S.mode = o.mode;", "        o = o || {}; engine.start(); engine.resize(); if (S.soundOn && engine.audio && !engine.audio.on) engine.audio.enable(); if (o.mode && HEIGHT[o.mode]) S.mode = o.mode;")
# the drone stands on the flood, not under it
rep("if (engine.playing && ALTA.update(dt, { floor: floorTop, block: blockAt,", "if (engine.playing && ALTA.update(dt, { floor: (x, z) => Math.max(floorTop(x, z), SK.now ? SK.now.surge : -9), block: blockAt,")

open(P, 'w', encoding='utf-8').write(s)
print('storm ok', len(s))
