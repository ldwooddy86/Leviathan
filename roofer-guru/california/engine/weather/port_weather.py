"""California engine, job "weather": takes the Louisiana storm scale out of the Scout Engine and puts California's weather
in (weather_engine.js: the wet scale dry to AR5, the dry offshore wind scale, snow above a snow level, marine layer, tule
fog and wildfire smoke). Also the surface shader's hooks (standing water on flat ground, runoff on gentler slopes, snow
cover), and the world's wiring and API. The flood plane and everything that read it are removed.
Every anchor must occur exactly once. The input is never written to.
  python3 -I port_weather.py <in.js> <out.js>"""
import os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
src, dst = sys.argv[1], sys.argv[2]
assert os.path.abspath(src) != os.path.abspath(dst), 'the input is never written to'
s = open(src, encoding='utf-8').read()
kit = open(os.path.join(HERE, 'weather_engine.js'), encoding='utf-8').read()
def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (s.count(a), a[:110])
    s = s.replace(a, b)
def sub(pat, new, n=1):
    """a pattern, for the few places the terrain job's port rewrites before this one runs: the count is still asserted"""
    global s
    s, k = re.subn(pat, lambda m: new, s)
    assert k == n, (k, pat[:110])
def cut(a, b, new):
    global s
    assert s.count(a) == 1 and s.count(b) == 1, (s.count(a), s.count(b), a[:60], b[:60])
    i, j = s.index(a), s.index(b); assert i < j
    s = s[:i] + new + s[j:]

# ---- materials: there is no flood water any more (Material's constructor, defines(), key()) ----
rep(" this.water = !!o.water;   /* water: flood water, its surface worked by the wind (see the surface shader) */", "")
rep(", WATER: !!this.water }; }", " }; }")
rep(" | (this.water ? 65536 : 0); }", "; }")

# ---- the surface shader (SURFACE_FS, readSurface): standing water, runoff, snow ----
rep("uniform vec4 u_rainK;   /* how hard it is raining now (0 to about 1), the wind (in 25 m/s), and which way it blows */",
    "uniform vec4 u_rainK;   /* how hard it is raining now (0 to about 1), the wind (in 25 m/s), and which way it blows */\n"
    "uniform vec4 u_snowK;   /* snow: how much has settled (0 to 1), the world height of the snow level, half the height the line is blurred over; and w: how much water stands on flat ground (0 to 1) */")
cut("#ifdef WATER\n  /* flood water: brown with silt", "  s.albedo = base.rgb; s.alpha = base.a; s.N = N; s.roughness = clamp(s.roughness, 0.03, 1.0);\n",
    """  /* rain: surfaces that face the sky darken and turn glossy, and water stands in the low places. While it falls
     (u_rainK.x) rings spread where drops land, the wet surface is pocked all over, and on a slope the water runs down it
     in sheets. Past the distance where a ring is smaller than a pixel all of that is let go, and the surface is only a
     little rougher: rain seen from far off dulls a wet roof's shine.
     In the heavy steps (u_snowK.w) the puddles on level faces grow and join into a shallow brown sheet: streets, yards
     and flat roofs under water that has nowhere to go. It is decided face by face from the slope alone, so on real
     terrain a hillside sheds it and a flat valley floor holds it. A picture of street flooding, not a flood map. And the
     water starts to run on gentler slopes: a street with any fall to it carries a stream. */
  { vec3 gN = normalize(v_normal); float up = smoothstep(0.35, 0.9, N.y) * u_wetness * u_wetMask, fw = max(length(dFdx(v_wpos.xz)), length(dFdy(v_wpos.xz))), pond = u_snowK.w * smoothstep(0.985, 0.9995, gN.y);
    if (up > 0.001) { float pt = 0.52 - 0.36 * pond, pud = up * smoothstep(pt, pt + 0.16, fbm(v_wpos.xz * 0.19)); base.rgb *= mix(1.0, 0.58, up); base.rgb = mix(base.rgb, vec3(0.2, 0.18, 0.14), pud * pond * 0.5); s.roughness = mix(mix(s.roughness, 0.16, up * 0.85), 0.035, pud); N = normalize(mix(N, vec3(0.0, 1.0, 0.0), pud * 0.9));
      if (u_rainK.x > 0.001) { vec2 p = v_wpos.xz; float nearK = 1.0 - smoothstep(0.02, 0.085, fw), k = u_rainK.x;
        if (nearK > 0.001) { vec3 rr = rainRings(p, u_time, k); float on = mix(0.3, 1.0, pud) * up * nearK; N = normalize(N + vec3(rr.x, 0.0, rr.y) * (0.55 * on)); base.rgb += vec3(0.5, 0.55, 0.6) * (rr.z * on * 0.22);
          float sl = length(gN.xz), s0 = mix(0.12, 0.03, u_snowK.w);
          if (sl > s0 && pud < 0.5) { vec2 dn = gN.xz / sl, ac = vec2(-dn.y, dn.x); float flow = vnoise(vec2(dot(p, ac) * 6.5, dot(p, dn) * 0.9 - u_time * (1.6 + 2.4 * k))), riv = smoothstep(0.52, 0.88, flow) * k * up * nearK * smoothstep(s0, s0 + 0.18, sl);
            s.roughness = mix(s.roughness, 0.05, riv * 0.8); N = normalize(N + vec3(ac.x, 0.0, ac.y) * ((vnoise(vec2(dot(p, ac) * 19.0, dot(p, dn) * 2.0 - u_time * 3.0)) - 0.5) * riv * 0.35)); } }
        s.roughness = mix(s.roughness, max(s.roughness, 0.12), k * (1.0 - nearK) * up * 0.6); } }
    /* snow: above the snow level, whatever faces the sky goes white, first in patches and then all over; steep faces and
       walls stay bare. The level is a world height (u_snowK.y), broken up a little so it is not a ruled line across a
       mountain. Snow is matte, and it hides the wet shine under it. */
    if (u_snowK.x > 0.001 && u_wetMask > 0.0) { float ln = smoothstep(u_snowK.y - u_snowK.z, u_snowK.y + u_snowK.z, v_wpos.y + (fbm(v_wpos.xz * 0.045) - 0.5) * 30.0);
      if (ln > 0.001) { float cov = clamp(ln * u_wetMask * smoothstep(0.15, 0.6, N.y) * smoothstep(0.0, 0.35, u_snowK.x * 1.5 - 0.5 * fbm(v_wpos.xz * 0.6)), 0.0, 1.0);
        base.rgb = mix(base.rgb, vec3(0.88, 0.9, 0.95) * (0.94 + 0.06 * vnoise(v_wpos.xz * 2.7)), cov); s.roughness = mix(s.roughness, 0.85, cov); s.metallic *= 1.0 - cov; N = normalize(mix(N, normalize(gN + vec3(0.0, 0.6, 0.0)), cov * 0.7)); } } }
""")
rep("u_wetness: env.wetness, u_rainK: env.rainK || ZERO4,", "u_wetness: env.wetness, u_rainK: env.rainK || ZERO4, u_snowK: env.snowK || ZERO4,")

# ---- the kit itself, in the place of the Louisiana one ----
cut("  /* ==== rooftop scout on the engine: the weather on a storm scale, from light rain to a Category 5 hurricane ==== */\n",
    "  /* ==== rooftop scout on the engine: two craft that fly in any weather, a flying saucer and the Tic Tac ==== */\n", kit)
rep("These two do not care: they are the way to a roof in a hurricane, and", "These two do not care: they are the way to a roof in an atmospheric river or a Santa Ana wind, and")

# ---- the world: the scales, the sky states, snow, and the Alta X's rule (setSun, grounded, setStorm; new: setWind, setSky, setSnowLevel, setElevation, wxHere, seaLevel, canFly, wxShort) ----
cut("    /* The storm scale: 0 is the weather chosen above; 1 to 9 run from light rain to a Category 5 hurricane (SE.STORM, and\n",
    "    /* lamp posts along the streets; after dark the nearest ones are real lights */\n",
    """    /* California's weather, three settings that do not depend on each other (SE.STORM, SE.WIND, SE.SKY, and the kit that
       draws them): the wet scale, 0 the weather chosen above and 1 to 8 from light rain to an AR5 atmospheric river; the
       dry offshore wind, 0 calm to 5 an extreme downslope windstorm; and a sky state, marine layer, tule fog or smoke.
       Snow falls and lies above the wet step's snow level, wherever the height of the ground is known. */
    const SK = SE.StormKit(engine, { ground: () => (typeof S.gy === 'function' ? S.gy(S.x, S.z) || 0 : 0) }); S.storm = 0; S.wind = 0; S.sky = 0; S.snowLevel = null; S.elev = null; S.y0msl = null; S.wxAt = null; S.wxName = '';
    /* How high the world's y = 0 stands above sea level here, in metres; null when nobody knows, and then no snow is
       drawn. Asked in this order: the terrain (S.elevAt(lat, lon), metres above sea level, with S.gy(x, z) for the
       ground's height in the world, when a build has them; or the terrain's datum S.y0, metres above sea level of y = 0), the module (env.elevation(lat, lon)), and a height given by
       hand for the ground under the camera (en.elevation(m)). */
    function seaLevel() {
      if (!S.ok) return null; if (typeof S.gy === 'function' && typeof S.y0 === 'number' && isFinite(S.y0) && typeof S.elevAt !== 'function') return S.y0;   /* the terrain job's datum: how high y = 0 stands */
      const ll = toLL(S.x, S.z); let e = null, g = 0;
      try { if (typeof S.gy === 'function') g = S.gy(S.x, S.z) || 0; if (typeof S.elevAt === 'function') e = S.elevAt(ll[0], ll[1]); if ((e == null || !isFinite(e)) && env.elevation) e = env.elevation(ll[0], ll[1]); } catch (err) { e = null; }
      if (e == null || !isFinite(e)) e = S.elev; return e == null || !isFinite(e) ? null : e - g;
    }
    const WX0 = () => WEATHER[gfx.weather] || WEATHER.clear;
    const wxOpts = () => { const ll = S.ok ? toLL(S.x, S.z) : [null, null], t = S.sunTime || new Date(), lo = ll[1] == null ? -120 : ll[1]; return { wind: S.wind, sky: S.sky, snowLevel: S.snowLevel, y0: S.y0msl, lat: ll[0], lon: ll[1], hour: (((t.getUTCHours() + t.getUTCMinutes() / 60 + lo / 15) % 24) + 24) % 24 }; };
    function setSun() {
      const la = S.lat0 || 38.58, lo = S.lon0 || -121.49, t = sunTime(gfx.sun, la, lo), p = solarPosition(t, la, lo); S.sunAlt = p.alt; S.sunTime = t;
      S.sunNote = p.alt < -1 ? 'The sun is down here at that hour: the scene is lit by the moon, the lamps and the windows.' : '';
      S.y0msl = seaLevel(); S.wxAt = [S.x, S.z]; const o2 = wxOpts(), sky = SK.set(S.storm, WX0(), o2); S.wxName = SK.windName || '';
      V3.copy(scene.env.sunDir, sunVector(p.alt, p.az)); Object.assign(scene.env, sky); scene.envChanged();
      lampsLit(); need(2);
    }
    /* the camera has moved a way, or better elevation has come in: the height of the ground and the name the wind goes by are asked again. The sky's light is not touched. */
    function wxHere() { const y0 = seaLevel(), nm = S.ok ? SE.windName.apply(null, toLL(S.x, S.z))[0] : ''; S.wxAt = [S.x, S.z]; if ((y0 == null) === (S.y0msl == null) && (y0 == null || Math.abs(y0 - S.y0msl) < 2) && nm === S.wxName) return; S.y0msl = y0; S.wxName = nm; SK.set(S.storm, WX0(), wxOpts()); need(2); if (env.onGraphics) env.onGraphics(graphics()); }
    /* The Alta X flies in the dry and in light rain, and in an offshore wind only up to its limit. Otherwise it comes down where it is, and will not take off. */
    const canFly = () => !!SE.STORM[S.storm].fly && !!SE.WIND[S.wind].fly;
    const wxShort = () => [S.storm ? SE.STORM[S.storm].s : '', S.wind ? SE.WIND[S.wind].s : '', S.sky ? SE.SKY[S.sky].s : ''].filter(Boolean).join(', ') || 'Dry';
    /* what state() says of the weather: the roof views ask it what this weather does to a roof */
    const wxState = () => { const wx = SK.info(); return { stormKey: wx.key, wind: S.wind, windKey: wx.wind.key, windName: wx.wind.local, sky: wx.sky.key, skyOn: wx.sky.on, weather: wx.text, sustainedMph: wx.sustainedMph, gustMph: wx.gustMph, rainMmH: wx.rainMmH, precip: wx.precip, snowLevelM: wx.snowLevelM, elevationM: wx.elevationM, visKm: wx.visKm, altaCanFly: wx.fly }; };
    function grounded() { const no = !canFly(); if (ALTA) ALTA.ground(no ? NOFLY : '', S.mode !== 'alta'); if (no && S.mode === 'alta' && ALTA && ALTA.state.mode !== 'Landed') alarm(NOFLY); return no; }
    function wxChanged(quiet) { setSun(); grounded(); engine.wake(); if (gfx.lens === 'storm' || gfx.lens === 'thermal') { lensGen++; legT = 0; lensSync(true); } if (!quiet && env.onGraphics) env.onGraphics(graphics()); }
    function setStorm(n, quiet) { n = SE.stormStep(n); if (n === S.storm) return; S.storm = n; wxChanged(quiet); }
    function setWind(n, quiet) { n = SE.windStep(n); if (n === S.wind) return; S.wind = n; wxChanged(quiet); }
    function setSky(n, quiet) { n = SE.skyStep(n); if (n === S.sky) return; S.sky = n; wxChanged(quiet); }
    const numOrNull = v => (v == null || v === '' || v === false || !isFinite(+v) ? null : +v);
    function setSnowLevel(m, quiet) { m = numOrNull(m); if (m === S.snowLevel) return; S.snowLevel = m; wxChanged(quiet); }   /* metres above sea level, in the place of the step's own; null gives the step's back */
    function setElevation(m, quiet) { m = numOrNull(m); if (m === S.elev) return; S.elev = m; wxChanged(quiet); }           /* the ground under the camera, metres above sea level, when nothing else knows */
""")
# the flood plane is gone from the cameras and the craft (placeCamera and the update handler). These four places are written
# two ways: as Louisiana left them, and as the terrain job's port leaves them (its surgeY()); either is taken, once.
FL = r"(?:SK\.now \? SK\.now\.surge : -9|surgeY\(\))"
sub(r"\(SK\.now \? SK\.now\.surge : -9\) \+ 0\.8, |surgeY\(\) \+ 0\.8, ", "")
sub(r"\n *\{ const fl = " + FL + r"; if \(fl > [^\n]*afloat on it \*/", "")
sub(r", fl = " + FL + r"; UAP\.update\(", "; UAP.update(")
rep("UAP.update(dt, { floor: (x, z) => Math.max(floorTop(x, z), fl), block: blockAt });", "UAP.update(dt, { floor: floorTop, block: blockAt });")
sub(r"floor: \(x, z\) => Math\.max\(floorTop\(x, z\), " + FL + r"\), block: blockAt,", "floor: floorTop, block: blockAt,")
sub(r"\n[^\n]*the flood's surface as a world height[^\n]*\n[^\n]*const surgeY = [^\n]*", "", n=s.count('const surgeY = '))
rep("      if (S.storm && S.surgeAt && Math.hypot(S.x - S.surgeAt[0], S.z - S.surgeAt[1]) > 700) surgeHere();\n",
    "      if (S.storm || S.wind) { const tn = performance.now(); if (!S.wxAt || tn - (S.wxT || 0) > 2500 || Math.hypot(S.x - S.wxAt[0], S.z - S.wxAt[1]) > 400) { S.wxT = tn; wxHere(); } }\n")
rep("ensureAt = null; ensureSoon(); surgeHere(); warpEl.className", "ensureAt = null; ensureSoon(); wxHere(); warpEl.className")

# ---- what the roof views, the heads-up display, state() and graphics() are told ----
rep("stormStep: SE.STORM[S.storm], surgeNote: S.surgeNote, weather: S.storm ? 'rain' : gfx.weather,", "stormStep: SE.STORM[S.storm], wind: S.wind, windStep: SE.WIND[S.wind], sky: SE.SKY[S.sky].k, wx: SK.info(), weather: S.storm ? 'rain' : gfx.weather,")
rep("weatherLabel: S.storm ? SE.STORM[S.storm].l.toLowerCase() : WLAB[gfx.weather] || gfx.weather }; }", "weatherLabel: S.storm || S.wind > 1 ? wxShort().toLowerCase() : WLAB[gfx.weather] || gfx.weather }; }")
rep("W = a.warp, sn = SE.STORM[S.storm];", "W = a.warp, sn = { s: wxShort() };")
rep("if (m === 'alta' && !SE.STORM[S.storm].fly) { alarm(NOFLY); return false; }", "if (m === 'alta' && !canFly()) { alarm(NOFLY); return false; }")
rep("pitch: S.pitch, mode: S.mode, storm: S.storm, uap: ", "pitch: S.pitch, mode: S.mode, storm: S.storm, ...wxState(), uap: ")
rep("storm: S.storm, stormInfo: SK.info(), surge: S.surge, surgeNote: S.surgeNote, trees: gfx.trees,", "storm: S.storm, wind: S.wind, skyState: SE.SKY[S.sky].k, snowLevel: S.snowLevel, elevation: S.elev, stormInfo: SK.info(), trees: gfx.trees,")
rep("if (o.storm != null) setStorm(o.storm, true);", "if (o.storm != null) setStorm(o.storm, true); if (o.wind != null) setWind(o.wind, true); if (o.skyState != null) setSky(o.skyState, true); if (o.snowLevel !== undefined) setSnowLevel(o.snowLevel, true); if (o.elevation !== undefined) setElevation(o.elevation, true);")
rep("      storm: n => { setStorm(n); return SK.info(); }, stormKit: SK, warn: alarm, NOFLY,",
    "      /* the weather: each takes a step's number or its id, and answers with the facts of what is now set (stormKit.info()) */\n"
    "      storm: n => { setStorm(n); return SK.info(); }, wind: n => { setWind(n); return SK.info(); }, sky: id => { setSky(id); return SK.info(); },\n"
    "      snowLevel: m => { setSnowLevel(m); return SK.info(); }, elevation: m => { setElevation(m); return SK.info(); }, weather: () => SK.info(), stormKit: SK, warn: alarm, NOFLY,")

# ---- nothing of the old scale may be left ----
for w in ('hurricane', 'surge', 'saffir', 'tropical storm', 'category 5', "cat:", 'flood water'):
    m = re.search(re.escape(w), s, re.I)
    assert not m, ('left in the engine', w, s[max(0, m.start() - 80):m.end() + 80])
open(dst, 'w', encoding='utf-8').write(s)
print('weather ok', len(s))
