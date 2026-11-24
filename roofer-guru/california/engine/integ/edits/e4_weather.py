"""Integration edit 4 on the weather job (weather_engine.js and port_weather.py): weather on real terrain.
   - haze is measured from a base height (the ground under the camera; the top of the marine layer; the top of the tule fog)
     and no longer thickens without limit below it; the cloud layer is measured from the ground under the camera;
   - the marine layer and the tule fog are slabs with a top, so hills stand out of them, and the grey light is only under them;
   - the far ground takes snow (not wetness), and the snow line does not shimmer far off.
   python3 -I e4_weather.py"""
import os
HERE = os.path.dirname(os.path.abspath(__file__))
W = os.path.join(HERE, '..', '..', 'weather')
def edit(name, pairs):
    p = os.path.join(W, name); s = open(p, encoding='utf-8').read()
    for a, b in pairs:
        assert s.count(a) == 1, (name, s.count(a), a[:90])
        s = s.replace(a, b)
    open(p, 'w', encoding='utf-8').write(s)

# ---------------- the kit ----------------
edit('weather_engine.js', [
 ("The deck is drawn at the engine\\'s cloud height, higher than a real one (a few hundred metres). It is held off",
  "The layer is drawn as grey air from the sea up to 450 m above sea level (a choice: real decks top out between about 300 and 900 m), with the overcast above it only for someone under it: a hill or a craft higher than that stands in the sun over a white sea. It is held off"),
 ("so the roofs can still be seen, and about 60 m deep (a choice), so a craft climbs out of it.",
  "so the roofs can still be seen, and it fills the low ground to about 110 m over the lowest ground for some 12 km round (a choice), so a craft climbs out of it and the foothills stand clear."),
 ("K = { level: 0, windLevel: 0, sky: 0, y0: null, snowLine: null, held: '' };",
  "K = { level: 0, windLevel: 0, sky: 0, y0: null, snowLine: null, held: '', top: null, above: false, low: null };\n"
  "    /* the marine layer's top, metres above sea level, and how deep the tule fog lies over the lowest ground near (both choices) */\n"
  "    const MARINE_TOP = 450, TULE_DEEP = 110;"),
 ("ash: 0, ember: 0, temp: 0, sat: 0, expo: 0, bear: 340 };\n    let want = Object.assign({}, now),",
  "ash: 0, ember: 0, temp: 0, sat: 0, expo: 0, bear: 340, base: 0, cbase: 0 };\n    let want = Object.assign({}, now), baseSet = false,"),
 ("      const nm = SE.windName(o2.lat, o2.lon); K.windName = nm[0]; K.hour = o2.hour == null ? null : o2.hour;",
  "      const nm = SE.windName(o2.lat, o2.lon); K.windName = nm[0]; K.hour = o2.hour == null ? null : o2.hour; K.w0 = w0; K.o2 = o2; K.low = o2.low == null || !isFinite(o2.low) ? null : +o2.low;"),
 ("      if (sk === 1 && !K.held) { const m = marineAt(K.hour); K.burn = 1 - m; clouds = lerp(clouds, 1, m); sunI = lerp(sunI, 0.13, m); skyI = lerp(skyI, 1.45, m); turb = lerp(turb, 5, m); fog = Math.max(fog, 0.00065 * m); fogH = 260; dark = 0.16 * m; temp = -0.9 * m; sat = -0.1 * m; }\n"
  "      if (sk === 2 && !K.held) { fog = 3.912 / 200; fogH = 60; sunI *= 0.4; skyI = Math.max(skyI, 1.2); turb = 6; dark = 0.1; sat = -0.22; }",
  "      /* The marine layer and the tule fog are layers with a top (K.top, metres above sea level; with no height known, metres over y = 0). The haze\n"
  "         fills the air below the top and thins quickly over it; the grey light belongs to whoever is under it (K.above: the camera is over the top). */\n"
  "      K.top = null; const under = K.above ? 0 : 1;\n"
  "      if (sk === 1 && !K.held) { const m = marineAt(K.hour), mu = m * under; K.burn = 1 - m; K.top = MARINE_TOP; clouds = lerp(clouds, 1, mu); sunI = lerp(sunI, 0.13, mu); skyI = lerp(skyI, 1.45, mu); turb = lerp(turb, 5, mu); fog = Math.max(fog, 0.0011 * m); fogH = 55; dark = 0.16 * mu; temp = -0.9 * mu; sat = -0.1 * mu; }\n"
  "      if (sk === 2 && !K.held) { K.top = (K.low != null ? K.low : K.y0 != null ? K.y0 + (o.ground ? o.ground() : 0) : 0) + TULE_DEEP; fog = 3.912 / 200; fogH = 25; if (under) { sunI *= 0.4; skyI = Math.max(skyI, 1.2); turb = 6; dark = 0.1; sat = -0.22; } }\n"
  "      if (K.top == null) K.above = false;"),
 ("    function apply() { env.fogDensity = now.fog * (1 + 1.2 * snowAir); env.fogHeight = now.fogH;",
  "    function apply() { env.fogDensity = now.fog * (1 + 1.2 * snowAir); env.fogHeight = now.fogH; env.fogBase = now.base; env.cloudBase = now.cbase;"),
 ("      /* is it snow or rain where the camera is: snow above the snow level, rain below, a mix across about 80 m */\n      const cp = cam.position,",
  "      /* Where the haze is measured from: the ground under the camera, or the top of a layer; the clouds from the ground under the camera. Both slide, so nothing jumps as the ground changes. */\n"
  "      { const g = o.ground ? o.ground() || 0 : 0, tb = K.top != null ? K.top - (K.y0 != null ? K.y0 : 0) : g, kb = baseSet ? 1 - Math.exp(-dt / 2.5) : 1; baseSet = true; if (Math.abs(tb - now.base) > 0.3 || Math.abs(g - now.cbase) > 0.3) { now.base += (tb - now.base) * kb; now.cbase += (g - now.cbase) * kb; moving = true; }\n"
  "        /* over the top of the layer, or back under it: the light is worked out again (with some slack, so it does not flicker at the top) */\n"
  "        if (K.top != null && K.w0) { const c = (K.y0 != null ? K.y0 : 0) + cam.position[1], ab = K.above ? c > K.top - 15 : c > K.top + 60; if (ab !== K.above) { K.above = ab; const r = K.set(K.level, K.w0, K.o2); Object.assign(env, r); if (scene.envChanged) scene.envChanged(); moving = true; } } }\n"
  "      /* is it snow or rain where the camera is: snow above the snow level, rain below, a mix across about 80 m */\n      const cp = cam.position,"),
 ("on: !!skyOn, held: K.held, burn: +(K.burn || 0).toFixed(2), note: sk.note },",
  "on: !!skyOn, held: K.held, burn: +(K.burn || 0).toFixed(2), topM: K.top == null ? null : Math.round(K.top), above: !!K.above, note: sk.note },"),
])

# ---------------- the port ----------------
edit('port_weather.py', [
 # the shader: wetness only where the mask is positive; snow where it is not zero (a negative mask: snow, no wetness: the far ground)
 ("float up = smoothstep(0.35, 0.9, N.y) * u_wetness * u_wetMask, fw = max(length(dFdx(v_wpos.xz)), length(dFdy(v_wpos.xz))), pond = u_snowK.w * smoothstep(0.985, 0.9995, gN.y);",
  "float up = smoothstep(0.35, 0.9, N.y) * u_wetness * max(u_wetMask, 0.0), fw = max(length(dFdx(v_wpos.xz)), length(dFdy(v_wpos.xz))), pond = u_snowK.w * smoothstep(0.985, 0.9995, gN.y);"),
 ("       mountain. Snow is matte, and it hides the wet shine under it. It lies on what rain wets, and on the crowns of trees. */\n"
  "    bool leafy = u_shadeModel > 1.5 && u_shadeModel < 2.5; float snowOn = max(u_wetMask, leafy ? 0.9 : 0.0); vec3 sN = gN; float skyward = N.y;",
  "       mountain. Snow is matte, and it hides the wet shine under it. It lies on what rain wets, on the crowns of trees, and on\n"
  "       the far ground (a surface whose wet mask is negative takes snow and no wetness). Far off, where a pixel covers metres\n"
  "       of ground, the fine break-up is let go and a coarser one stands in, so the line does not shimmer. */\n"
  "    bool leafy = u_shadeModel > 1.5 && u_shadeModel < 2.5; float snowOn = max(abs(u_wetMask), leafy ? 0.9 : 0.0); vec3 sN = gN; float skyward = u_wetMask < 0.0 ? gN.y : N.y;"),
 ("float ln = smoothstep(u_snowK.y - u_snowK.z, u_snowK.y + u_snowK.z, v_wpos.y + (fbm(v_wpos.xz * 0.045) - 0.5) * 30.0);",
  "float nearF = 1.0 - smoothstep(1.5, 9.0, fw), ln = smoothstep(u_snowK.y - u_snowK.z, u_snowK.y + u_snowK.z, v_wpos.y + (fbm(v_wpos.xz * 0.045) - 0.5) * 30.0 * nearF + (vnoise(v_wpos.xz * 0.0021) - 0.5) * 70.0);"),
 ("smoothstep(0.0, 0.35, u_snowK.x * 1.5 - 0.5 * fbm(v_wpos.xz * 0.6)), 0.0, 1.0);",
  "smoothstep(0.0, 0.35, u_snowK.x * 1.5 - 0.5 * mix(0.5, fbm(v_wpos.xz * 0.6), 1.0 - smoothstep(0.3, 2.0, fw))), 0.0, 1.0);"),
 ("rep(\"u_wetness: env.wetness, u_rainK: env.rainK || ZERO4,\", \"u_wetness: env.wetness, u_rainK: env.rainK || ZERO4, u_snowK: env.snowK || ZERO4,\")\n",
  "rep(\"u_wetness: env.wetness, u_rainK: env.rainK || ZERO4,\", \"u_wetness: env.wetness, u_rainK: env.rainK || ZERO4, u_snowK: env.snowK || ZERO4,\")\n"
  "# the far ground and the wider city's ground take snow, not wetness (a negative wet mask)\n"
  "rep(\"mat = new Material({ name: 'Far ground', albedoMap: tex, roughness: 0.95, castShadow: false, wet: 0 });\", \"mat = new Material({ name: 'Far ground', albedoMap: tex, roughness: 0.95, castShadow: false, wet: -1 });\")\n"
  "rep(\"new Material({ name: 'Wider city: ground and lids', albedoMap: tex, roughness: 0.94, castShadow: false, wet: 0 });\", \"new Material({ name: 'Wider city: ground and lids', albedoMap: tex, roughness: 0.94, castShadow: false, wet: -1 });\")\n"
  "\n"
  "# ---- haze from a base height, and no thicker below it (the lighting chunk, both haze functions, the lit volume, the uniforms); clouds from a base height ----\n"
  "rep(\"uniform vec4 u_fog; uniform float u_frame;\\n\",\n"
  "    \"uniform vec4 u_fog; uniform float u_frame, u_fogB;\\n\"\n"
  "    \"/* how much haze lies along a line from the camera (height yc) to a point (height yp) dist away, as a length at full density: the haze is at its\\n\"\n"
  "    \"   full density up to the base height u_fogB (the ground under the camera, or the top of a fog layer) and thins above it with the scale 1 / u_fog.y */\\n\"\n"
  "    \"float fogPath(float yc, float yp, float dist) { float k = u_fog.y, a = yc - u_fogB, b = yp - u_fogB, lo = min(a, b), hi = max(a, b), span = hi - lo; if (span < 1e-3) return dist * exp(-max(lo, 0.0) * k);\\n\"\n"
  "    \"  float fb = lo < 0.0 ? (min(hi, 0.0) - lo) / span : 0.0, a0 = max(lo, 0.0), a1 = max(hi, 0.0), fa = a1 > a0 ? (exp(-k * a0) - exp(-k * a1)) / (k * span) : 0.0; return dist * (fb + fa); }\\n\")\n"
  "rep(\"float dy = d.y * u_fog.y, f = abs(dy) > 1e-3 ? (1.0 - exp(-dy)) / dy : 1.0, od = u_fog.x * exp(-max(u_camPos.y, 0.0) * u_fog.y) * dist * f\", \"float od = u_fog.x * fogPath(u_camPos.y, wpos.y, dist)\", 2)\n"
  "rep(\"float dens = u_fog.x * exp(-max(p.y, 0.0) * u_fog.y), Tr = exp(-dens * dt)\", \"float dens = u_fog.x * exp(-max(p.y - u_fogB, 0.0) * u_fog.y), Tr = exp(-dens * dt)\")\n"
  "rep(\"u_fog: [env.fogDensity, 1 / Math.max(env.fogHeight, 1), env.fogSun, s.fog ? 1 : 0],\", \"u_fog: [env.fogDensity, 1 / Math.max(env.fogHeight, 1), env.fogSun, s.fog ? 1 : 0], u_fogB: env.fogBase || 0,\")\n"
  "rep(\"float ry = RE + max(u_camPos.y, 0.0), b = ry * dir.y,\", \"float ry = RE + max(u_camPos.y - u_cl.w, 0.0), b = ry * dir.y,\")   # u_cl.w: the height the cloud layer is measured from\n"
  "rep(\"vec3 p = u_camPos + dir * (t0 + st * (float(i) + j));\", \"vec3 p = u_camPos - vec3(0.0, u_cl.w, 0.0) + dir * (t0 + st * (float(i) + j));\")\n"
  "rep(\"this.fresh || r.reset ? 0 : (r.camMoved ? 0.88 : 0.94), 0] });\", \"this.fresh || r.reset ? 0 : (r.camMoved ? 0.88 : 0.94), env.cloudBase || 0] });\")\n"),
 # the world: the lowest ground round about (for the tule fog), asked with the rest
 ("    const WX0 = () => WEATHER[gfx.weather] || WEATHER.clear;\n",
  "    const WX0 = () => WEATHER[gfx.weather] || WEATHER.clear;\n"
  "    /* the lowest ground within about 12 km, metres above sea level (the tule fog lies on it); null when no heights are known */\n"
  "    let wxLowAt = null, wxLowV = null; function regionLow() { if (!S.ok || typeof S.elevAt !== 'function') return null; if (wxLowAt && wxLowAt[2] === S.gen && Math.hypot(S.x - wxLowAt[0], S.z - wxLowAt[1]) < 2500 && performance.now() - wxLowAt[3] < 20000) return wxLowV;\n"
  "      const ll = toLL(S.x, S.z), dla = 3000 / S.ky, dlo = 3000 / S.kx; let lo = Infinity; try { for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++) { const e = S.elevAt(ll[0] + i * dla, ll[1] + j * dlo); if (e != null && isFinite(e) && e < lo) lo = e; } } catch (err) { lo = Infinity; } wxLowAt = [S.x, S.z, S.gen, performance.now()]; wxLowV = isFinite(lo) ? lo : null; return wxLowV; }\n"),
 ("return { wind: S.wind, sky: S.sky, snowLevel: S.snowLevel, y0: S.y0msl, lat: ll[0], lon: ll[1],",
  "return { wind: S.wind, sky: S.sky, snowLevel: S.snowLevel, y0: S.y0msl, low: S.sky === 2 ? regionLow() : null, lat: ll[0], lon: ll[1],"),
 ("S.wxAt = [S.x, S.z]; if ((y0 == null) === (S.y0msl == null) && (y0 == null || Math.abs(y0 - S.y0msl) < 2) && nm === S.wxName) return; S.y0msl = y0; S.wxName = nm;",
  "const low = S.sky === 2 ? regionLow() : null; S.wxAt = [S.x, S.z]; if ((y0 == null) === (S.y0msl == null) && (y0 == null || Math.abs(y0 - S.y0msl) < 2) && nm === S.wxName && (low == null) === (SK.low == null) && (low == null || Math.abs(low - SK.low) < 12)) return; S.y0msl = y0; S.wxName = nm;"),
 ("    \"      if (S.storm || S.wind) { const tn = performance.now();", "    \"      if (S.storm || S.wind || S.sky) { const tn = performance.now();"),
])
print('ok')
