  /* ==== rooftop scout on the engine: the weather on a storm scale, from light rain to a Category 5 hurricane ==== */
  /* Ten steps. Each is a wind and a rain rate, and what is drawn follows from those two numbers.
       The wind   The tropical storm and the five hurricane steps are the Saffir-Simpson Hurricane Wind Scale's sustained
                  winds (39 to 73 mph, then 74, 96, 111, 130 and 157 mph and up; the middle of each range is drawn, and
                  165 mph for Category 5, which has no top). Below them: a light rain, a heavy rain, and a severe
                  thunderstorm with gusts at the Weather Service's 58 mph mark. Gusts are taken a quarter over the
                  sustained wind, the figure for wind coming off the sea (Harper, Kepert and Ginger for the WMO: 1.23;
                  1.49 well inland; in Laura three stations in southwest Louisiana read 1.15 to 1.36). The winds
                  of the three steps below a tropical storm are chosen.
       The rain   Millimetres an hour. The federal observing handbook calls rain light to 2.5 and heavy over 7.6. In a
                  hurricane the rate averaged right round the storm is small (about 3 for a tropical storm, 7 for
                  Categories 1 and 2, 12 for 3 and up: Lonfat, Marks and Chen), and one radar pass caught a feeder band at
                  over 89 and the eyewall at over 143 (NASA's GPM satellite over Hurricane Lane, 2018). The rate of each
                  step is chosen between those: a judgment, not a typical figure anyone publishes. From the rate come the size
                  of the drops (Marshall and Palmer's distribution: the median drop by volume is 3.67 / (4.1 R^-0.21) mm
                  across), how fast they fall (Atlas, Srivastava and Sekhon's fit to Gunn and Kinzer's measurements:
                  9.65 - 10.3 exp(-0.6 D) m/s), and how far one can see through it (a rule of thumb, about
                  12.5 R^-0.67 km, shortened in a hurricane by spray: a judgment).
       Lightning  Often in the thunderstorm. Seldom in the hurricane steps, as in a real hurricane's core: about a dozen
                  strikes an hour or fewer round the eyewall (NOAA's Hurricane Research Division).
     A drop falls at that speed and travels sideways with the wind, so a hurricane's rain is drawn nearly level. The streaks
     are as long as a drop travels in a thirtieth of a second. Roofs, roads and yards turn wet and glossy, rings spread where
     drops land, and water runs down the slopes; in heavy rain spray stands inches high above the pavement (the
     handbook sees it from moderate rain up); trees lean and thrash; cloud covers the sky and races; lightning lights the scene, the cloud and the rain, and
     its thunder comes later by the distance. From a tropical storm up, spray tears along near the ground and leaves and
     roofing fly.
     What is not physics, and is said so in the view: the count of drops (thousands are drawn where the air holds millions),
     the path of a bolt, the debris, and the flood water, which is a picture of storm surge and not a forecast for an address. */
  const STORM = [
    { k: 'dry', l: 'No storm', s: 'Dry', mph: 0, rain: 0, fly: true },
    { k: 'light', l: 'Light rain', s: 'Light rain', mph: 8, rain: 2, fly: true, sun: 0.22, sky: 1.35 },
    { k: 'heavy', l: 'Heavy rain', s: 'Heavy rain', mph: 18, rain: 16, sun: 0.1, sky: 1.2 },
    { k: 'tstorm', l: 'Severe thunderstorm', s: 'Thunderstorm', mph: 35, gust: 58, rain: 45, bolt: 7, sun: 0.05, sky: 0.8 },   /* bolt: seconds between flashes, on average */
    { k: 'ts', l: 'Tropical storm', s: 'Tropical storm', mph: 56, range: [39, 73], rain: 22, bolt: 110, sun: 0.07, sky: 0.95 },
    { k: 'c1', l: 'Category 1 hurricane', s: 'Category 1', cat: 1, mph: 85, range: [74, 95], rain: 30, bolt: 300, sun: 0.06, sky: 0.9 },
    { k: 'c2', l: 'Category 2 hurricane', s: 'Category 2', cat: 2, mph: 103, range: [96, 110], rain: 38, bolt: 300, sun: 0.055, sky: 0.85 },
    { k: 'c3', l: 'Category 3 hurricane', s: 'Category 3', cat: 3, mph: 120, range: [111, 129], rain: 48, bolt: 300, sun: 0.05, sky: 0.8, surgeFt: [9, 12] },
    { k: 'c4', l: 'Category 4 hurricane', s: 'Category 4', cat: 4, mph: 143, range: [130, 156], rain: 60, bolt: 300, sun: 0.045, sky: 0.72, surgeFt: [13, 18] },
    { k: 'c5', l: 'Category 5 hurricane', s: 'Category 5', cat: 5, mph: 165, range: [157, null], rain: 75, bolt: 300, sun: 0.04, sky: 0.65, surgeFt: [18, null] },
  ];
  STORM.forEach((s, i) => {
    s.i = i; s.ms = s.mph * 0.44704; s.kt = s.mph / 1.15078; if (!s.gust) s.gust = Math.round(s.mph * 1.23);
    s.dropMm = s.rain ? 3.67 / (4.1 * Math.pow(s.rain, -0.21)) : 0; s.fall = s.rain ? 9.65 - 10.3 * Math.exp(-0.6 * s.dropMm) : 0;
    s.visKm = s.rain ? 12.5 * Math.pow(s.rain, -0.67) * (s.cat ? 1 - 0.09 * s.cat : 1) : null;
    s.fog = s.rain ? Math.max(0.0009, 3.912 / (s.visKm * 1000)) : 0; s.sway = 0.35 + s.ms * 0.045;
    s.dark = [0, 0.15, 0.32, 0.8, 0.55, 0.66, 0.74, 0.82, 0.91, 1][i];   /* how far the picture is graded toward a storm's: darker, greyer, colder */
  });
  SE.STORM = STORM;

  const STORM_VS = `
layout(location=0) in vec2 a_corner;
uniform mat4 u_viewProj, u_view; uniform vec3 u_camPos, u_ext, u_vel; uniform vec3 u_off[4];
uniform vec4 u_p;   /* what is drawn (0 rain, 1 spray, 2 debris), its size, the exposure, the width of a pixel a metre away */
uniform vec4 u_q;   /* time, the floor of the band spray and debris keep to, opacity, a seed */
out vec2 v_uv; out float v_viewZ; out float v_a; out vec3 v_h;
vec3 h3(float n) { vec3 p = fract(vec3(n) * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
void main() {
  float id = float(gl_InstanceID) + u_q.w * 131.0; vec3 h = h3(id), h2 = h3(id + 0.37); int c = gl_InstanceID & 3; float cm = 0.82 + 0.126 * float(c);
  bool band = u_p.x > 0.5; vec3 box = u_ext * 2.0, p = h * box + u_off[c], rel;
  /* each drop keeps its place in the world and the camera moves through them: the field wraps round the camera */
  rel.xz = mod(p.xz - u_camPos.xz, box.xz) - u_ext.xz; rel.y = band ? mod(p.y, box.y) : mod(p.y - u_camPos.y, box.y) - u_ext.y;
  vec3 w = vec3(u_camPos.x + rel.x, band ? u_q.y + rel.y : u_camPos.y + rel.y, u_camPos.z + rel.z);
  float edge = 1.0 - smoothstep(0.82, 1.0, max(abs(rel.x) / u_ext.x, abs(rel.z) / u_ext.z)); if (!band) edge *= 1.0 - smoothstep(0.8, 1.0, abs(rel.y) / u_ext.y);
  vec3 toC = normalize(u_camPos - w); float dist = distance(u_camPos, w); v_a = edge; v_h = h2;
  if (u_p.x < 0.5) {            /* a streak: as long as the drop travels while the shutter is open, never thinner than half a pixel */
    vec3 v = u_vel * cm; float sp = length(v); vec3 ax = v / max(sp, 1e-3), side = normalize(cross(ax, toC) + vec3(1e-5));
    float len = sp * u_p.z * (0.7 + 0.6 * h2.x), hw = u_p.y * (0.6 + 0.8 * h2.y), mn = dist * u_p.w * 0.55;
    v_a *= clamp(0.4 / max(len, 1e-3), 0.28, 1.0);   /* a drop's light is spread along its streak: the longer the streak, the fainter */
    v_a *= sqrt(min(1.0, hw / max(mn, 1e-6))); hw = max(hw, mn);   /* thinner than that it fades, but by the root: a streak far off still reads as rain */ w += side * (a_corner.x * hw) + ax * (a_corner.y * 0.5 * len);
  } else if (u_p.x < 1.5) {     /* spray: a soft shred drawn out along the wind */
    vec3 ax = normalize(vec3(u_vel.x, 0.0, u_vel.z) + vec3(1e-4, 0.0, 0.0)), side = normalize(cross(ax, toC) + vec3(1e-5)); float s = u_p.y * (0.55 + 0.9 * h2.x);
    w += ax * (a_corner.x * s * 2.8) + side * (a_corner.y * s); v_a *= smoothstep(1.5, 9.0, dist) * smoothstep(0.0, 0.12, rel.y / box.y) * (1.0 - smoothstep(0.55, 1.0, rel.y / box.y));
  } else {                      /* debris: a leaf or a tab of roofing, tumbling */
    float t = u_q.x, a1 = t * (5.0 + 9.0 * h2.x) + h2.y * 6.2832, a2 = t * (3.0 + 7.0 * h2.z) + h.x * 6.2832;
    vec3 e1 = vec3(cos(a1), sin(a1) * cos(a2), sin(a1) * sin(a2)), e2 = normalize(cross(e1, vec3(sin(a2), cos(a2), 0.31))); float s = u_p.y * (0.5 + 1.3 * h2.x);
    w.y += sin(t * (1.3 + h2.y) + h.z * 6.2832) * 1.6; w += e1 * (a_corner.x * s) + e2 * (a_corner.y * s * 0.62);
  }
  vec4 vp = u_view * vec4(w, 1.0); v_viewZ = -vp.z; v_uv = a_corner; gl_Position = u_viewProj * vec4(w, 1.0);
}`;
  const STORM_FS = `
#include <common>
in vec2 v_uv; in float v_viewZ; in float v_a; in vec3 v_h; out vec4 o_color;
uniform sampler2D u_depth; uniform vec2 u_res, u_nearFar; uniform vec4 u_p, u_q; uniform vec3 u_light;
float linZ(float d) { float z = d * 2.0 - 1.0; return 2.0 * u_nearFar.x * u_nearFar.y / (u_nearFar.y + u_nearFar.x - z * (u_nearFar.y - u_nearFar.x)); }
void main() {
  float sz = linZ(textureLod(u_depth, gl_FragCoord.xy / u_res, 0.0).r), soft = u_p.x > 0.5 && u_p.x < 1.5 ? 2.6 : 0.3, fade = clamp((sz - v_viewZ) / soft, 0.0, 1.0); if (fade <= 0.0) discard;
  float a = 1.0; vec3 col = u_light;
  if (u_p.x < 0.5) a = (1.0 - v_uv.x * v_uv.x) * smoothstep(1.0, 0.5, abs(v_uv.y)) * (0.75 + 0.5 * v_h.z);
  else if (u_p.x < 1.5) { float r = length(v_uv); if (r > 1.0) discard; a = pow(1.0 - r, 1.25) * (0.3 + 1.0 * fbm(v_uv * 1.7 + v_h.xy * 31.0 + u_q.x * 0.55)); }
  else col = u_light * (v_h.x < 0.45 ? vec3(0.05, 0.05, 0.055) : mix(vec3(0.1, 0.075, 0.04), vec3(0.055, 0.1, 0.035), v_h.y));
  a *= v_a * u_q.z * fade * clamp((v_viewZ - u_nearFar.x) * 2.0, 0.0, 1.0); if (a < 0.003) discard;
  o_color = vec4(col, a);
}`;
  const BOLT_VS = `
layout(location=0) in vec4 a_pos;
uniform mat4 u_viewProj, u_view; out float v_b; out float v_viewZ;
void main() { vec4 vp = u_view * vec4(a_pos.xyz, 1.0); v_viewZ = -vp.z; v_b = a_pos.w; gl_Position = u_viewProj * vec4(a_pos.xyz, 1.0); }`;
  const BOLT_FS = `
in float v_b; in float v_viewZ; out vec4 o_color;
uniform sampler2D u_depth; uniform vec2 u_res, u_nearFar; uniform vec3 u_color;
float linZ(float d) { float z = d * 2.0 - 1.0; return 2.0 * u_nearFar.x * u_nearFar.y / (u_nearFar.y + u_nearFar.x - z * (u_nearFar.y - u_nearFar.x)); }
void main() { float sz = linZ(textureLod(u_depth, gl_FragCoord.xy / u_res, 0.0).r); if (sz < v_viewZ) discard; o_color = vec4(u_color * v_b, 1.0); }`;

  function StormKit(engine, o) {
    o = o || {}; const dev = engine.device, gl = dev.gl, scene = engine.scene, env = scene.env, K = { level: 0, surge: 0 };
    const COUNT = { ultra: 30000, high: 20000, medium: 12000, low: 5000 }, SPRAY = { ultra: 900, high: 620, medium: 340, low: 130 }, DEBRIS = { ultra: 1, high: 0.8, medium: 0.5, low: 0.28 }, DEB = [0, 0, 0, 0, 26, 80, 140, 220, 320, 420];
    /* what is on the screen now, eased toward what the step asks for, so the scale slides */
    const RS = engine.renderer.settings, G0 = { exposure: RS.exposure || 0, saturation: RS.saturation, temperature: RS.temperature || 0, contrast: RS.contrast };
    const now = { dark: 0, rain: 0, ms: 0, fall: 6, fog: env.fogDensity, fogH: env.fogHeight || 90, clouds: env.clouds, wet: env.wetness, sway: env.wind, spray: 0, debris: 0, surge: -1.5 };
    let want = Object.assign({}, now), base = null, dir = [0.8, 0.6], gustT = 0, phase = 0, started = false;
    const offs = [0, 1, 2].map(() => [0, 1, 2, 3].map(() => [0, 0, 0])), drift = [0, 0], vel = [[0, -6, 0], [0, 0.3, 0], [0, -1.2, 0]];
    /* one quad, drawn many times: each copy finds its own place from its number */
    const vao = gl.createVertexArray(), quad = gl.createBuffer(); dev.vao(vao); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); dev.vao(null);
    const bvao = gl.createVertexArray(), bbuf = gl.createBuffer(); dev.vao(bvao); gl.bindBuffer(gl.ARRAY_BUFFER, bbuf); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0); dev.vao(null);
    const rnd = rng(90210);
    /* the flood: one sheet of brown water, laid over the ground at the depth asked for */
    let water = null;
    function waterOn(on) {
      if (on && !water) { water = scene.createEntity('Storm surge (an illustration)', { transient: true }); const mr = water.add('MeshRenderer'); mr.setShape({ kind: 'plane', args: [600000, 600000, 1] }); mr.material = new Material({ name: 'Flood water', albedo: '#4a4334', roughness: 0.09, castShadow: false, wet: 0, water: 1 }); mr.castShadow = false; mr.pickable = false; }
      if (water && water.active !== !!on) water.setActive(!!on);
    }
    /* sound, once a person has turned it on: the rain and the wind as shaped noise, thunder as a low burst */
    let aRain = null, aWind = null;
    function sounds() {
      if (!engine.audio || aRain) return; aRain = scene.createEntity('Storm rain', { transient: true }).add('AudioSource', { kind: 'rain', volume: 0, ambient: true }); aWind = scene.createEntity('Storm wind', { transient: true }).add('AudioSource', { kind: 'wind', volume: 0, ambient: true });
    }
    function thunder(dist, power) {
      const A = engine.audio; if (!A || !A.on) return; const c = A.ctx, wait = dist / 343;
      setTimeout(() => { if (!A.on) return; try { const t = c.currentTime, n = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), near = clamp(1 - dist / 6000, 0.12, 1);
        n.buffer = A._noise(); n.loop = true; f.type = 'lowpass'; f.frequency.setValueAtTime(lerp(160, 900, near * near), t); f.frequency.exponentialRampToValueAtTime(70, t + 4.5); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(2.6 * near * power, t + 0.05 + (1 - near) * 0.5);
        g.gain.exponentialRampToValueAtTime(0.5 * near * power, t + 1.1); g.gain.exponentialRampToValueAtTime(0.0001, t + 6.5); n.connect(f); f.connect(g); g.connect(A.master); n.start(t, Math.random() * 2); n.stop(t + 7); } catch (e) { /* no thunder */ } }, wait * 1000);
    }
    /* lightning: a path from the cloud base to the ground, broken at its middle again and again, with forks */
    let flash = null, nextBolt = 0, boltN = 0, boltData = new Float32Array(4096);
    function strike(cam) {
      const cp = cam.position, inv = cam.invView, fx = -inv[8], fz = -inv[10], ya = Math.atan2(fx, -fz) + (rnd() < 0.7 ? (rnd() - 0.5) * 2.6 : rnd() * TAU), d = 900 + rnd() * rnd() * 6500, x = cp[0] + Math.sin(ya) * d, z = cp[2] - Math.cos(ya) * d;
      const cloud = rnd() < 0.36, segs = [], top = [x + (rnd() - 0.5) * 500, 1480, z + (rnd() - 0.5) * 500];
      if (!cloud) { const walk = (a, b, disp, depth, bright) => {
          if (!depth) { segs.push(a, b, bright); return; } const m = [(a[0] + b[0]) / 2 + (rnd() - 0.5) * disp, (a[1] + b[1]) / 2 + (rnd() - 0.5) * disp * 0.4, (a[2] + b[2]) / 2 + (rnd() - 0.5) * disp];
          walk(a, m, disp / 2, depth - 1, bright); walk(m, b, disp / 2, depth - 1, bright);
          if (depth > 2 && bright > 0.3 && rnd() < 0.32) { const L = Math.hypot(m[0] - a[0], m[1] - a[1], m[2] - a[2]); walk(m, [m[0] + (m[0] - a[0]) * 0.6 + (rnd() - 0.5) * L * 1.4, m[1] - L * (0.3 + rnd() * 0.55), m[2] + (m[2] - a[2]) * 0.6 + (rnd() - 0.5) * L * 1.4], disp / 2, depth - 2, bright * 0.38); } };
        walk(top, [x, 0, z], 330, 6, 1); }
      const strokes = [[0, 1]]; let t = 0; const n = 1 + Math.floor(rnd() * 3.4); for (let i = 0; i < n; i++) { t += 0.05 + rnd() * 0.11; strokes.push([t, 0.35 + rnd() * 0.6]); }
      const dx = top[0] - cp[0], dy = (cloud ? 1480 : 700) - cp[1], dz = top[2] - cp[2], dl = Math.hypot(dx, dy, dz) || 1;
      flash = { t: 0, strokes, segs, dir: [dx / dl, dy / dl, dz / dl], dist: Math.hypot(dx, dz), power: cloud ? 0.55 : 1, end: t + 0.45 }; thunder(flash.dist, flash.power);
    }
    const flashNow = f => { let s = 0; for (const [t0, a] of f.strokes) if (f.t >= t0) s += a * Math.exp(-(f.t - t0) / 0.05); return s; };

    /* the step asked for, over the weather the scene had: w0 is { clouds, fogDensity, wetness, turbidity, sunIntensity, skyIntensity }.
       Returns what the sky needs set at once (its light is worked out afresh when these change); the rest slides. */
    K.set = (level, w0, o2) => {
      level = clamp(Math.round(+level || 0), 0, STORM.length - 1); const s = STORM[level], first = !started; started = true; K.level = level; base = w0;
      want = { dark: s.dark, rain: s.rain, ms: s.ms, fall: s.fall || 6, fog: level ? Math.max(s.fog, w0.fogDensity) : w0.fogDensity, fogH: level ? 420 : 90, clouds: level ? 1 : w0.clouds, wet: level ? 1 : w0.wetness, sway: level ? s.sway : 0.35,
        spray: level >= 4 ? clamp((s.ms - 18) / 52, 0, 1) : 0, debris: DEB[level] || 0, surge: (o2 && o2.surge > 0.05) ? o2.surge : -1.5 };
      K.surge = want.surge > 0 ? want.surge : 0; if (level && s.bolt) nextBolt = 1.5 + rnd() * s.bolt * 0.6; else nextBolt = 0;
      if (first) { Object.assign(now, want); now.surge = -1.5; apply(); }
      if (level) sounds(); engine.requestRender(4);
      return level ? { turbidity: 5 + level * 0.35, sunIntensity: s.sun, skyIntensity: s.sky } : { turbidity: w0.turbidity, sunIntensity: w0.sunIntensity, skyIntensity: w0.skyIntensity };
    };
    let graded = false, wasQuiet = false;
    function apply() { env.fogDensity = now.fog; env.fogHeight = now.fogH; env.clouds = now.clouds; env.wetness = now.wet;
      if (now.dark > 0.001 || graded) { const d = now.dark; graded = d > 0.001; RS.exposure = G0.exposure - 0.95 * d; RS.saturation = G0.saturation - 0.3 * d; RS.temperature = G0.temperature - 0.1 * d; RS.contrast = G0.contrast + 0.07 * d; } }
    /* once a frame: slide toward the step, move the air, time the lightning. 2 while the scene is still sliding to the step, 1 while only rain and wind move, 0 at rest. */
    K.update = (dt, cam, live) => {
      if (!started) return false; const s = STORM[K.level], k = 1 - Math.exp(-dt / 1.1), kw = 1 - Math.exp(-dt / (want.wet > now.wet ? 2.5 : 14)); let moving = false;
      for (const f of ['dark', 'rain', 'ms', 'fall', 'fog', 'fogH', 'clouds', 'sway', 'spray', 'debris']) { const d = want[f] - now[f]; if (Math.abs(d) > Math.abs(want[f]) * 0.002 + 1e-5) { now[f] += d * k; moving = true; } else now[f] = want[f]; }
      { const d = want.wet - now.wet; if (Math.abs(d) > 0.004) { now.wet += d * kw; moving = true; } else now.wet = want.wet; }
      { const d = want.surge - now.surge; if (Math.abs(d) > 0.01) { now.surge += d * (1 - Math.exp(-dt / 3.5)); moving = true; } else now.surge = want.surge; }
      /* with no storm on and nothing sliding, the air is left alone: the editor's world settings stay as a person set them */
      const quiet = !K.level && !moving, held = quiet && wasQuiet; wasQuiet = quiet; if (!held) apply(); waterOn(now.surge > -1.2); if (water && water.active) { const cp = cam.position; water.transform.setPosition(Math.round(cp[0] / 50) * 50, now.surge, Math.round(cp[2] / 50) * 50); }
      const sim = live ? dt : 0; gustT += sim;
      /* gusts: the wind rises and falls by a quarter or so and backs and veers a little */
      const g = K.level ? (0.6 * Math.sin(gustT * 0.21) + 0.3 * Math.sin(gustT * 0.57 + 1.3) + 0.2 * Math.sin(gustT * 1.31 + 0.4)) : 0, gk = 1 + g * (K.level >= 3 ? 0.3 : 0.15), veer = 0.18 * Math.sin(gustT * 0.083) + 0.08 * Math.sin(gustT * 0.31 + 2), b0 = Math.atan2(0.8, -0.6) + veer;
      dir = [Math.sin(b0), -Math.cos(b0)]; if (!held) { env.windDir = dir; env.wind = Math.max(0.2, now.sway * (K.level ? gk : 1)); } K.wind = now.ms * gk; K.dir = dir;
      const wx = dir[0] * K.wind, wz = dir[1] * K.wind; vel[0] = [wx, -now.fall, wz]; vel[1] = [wx * 0.8, 0.35, wz * 0.8]; vel[2] = [wx * 0.7, -1.3, wz * 0.7];
      for (let L = 0; L < 3; L++) for (let c = 0; c < 4; c++) { const m = 0.82 + 0.126 * c, O = offs[L][c]; O[0] += vel[L][0] * m * sim; O[1] += vel[L][1] * m * sim; O[2] += vel[L][2] * m * sim; }
      /* the cloud deck travels with the wind aloft, faster than the wind at the roofs */
      const c0 = env.cloudSpeed == null ? 1 : env.cloudSpeed, cs = c0 * 14 + now.ms * 1.6; drift[0] += dir[0] * cs * sim; drift[1] += dir[1] * cs * sim; env.cloudDrift = drift; phase += (c0 + now.ms * 0.115) * sim; env.cloudPhase = phase;
      env.rainK = [now.wet > 0.02 ? clamp(Math.sqrt(now.rain / 50), 0, 1.15) : 0, clamp(K.wind / 25, 0, 3.5), dir[0], dir[1]];
      /* lightning */
      if (flash) { if (K.freezeFlash) flash.t = 0.03; else flash.t += sim || dt; const f = flashNow(flash), am = engine.renderer.sky.ambient, lum = Math.max(0.5, (am[0] + am[1] + am[2]) / 3 * 9) * flash.power * clamp(1.25 - flash.dist / 9000, 0.3, 1.1); env.flash = [0.78 * f * lum, 0.86 * f * lum, 1.0 * f * lum, f]; env.flashDir = flash.dir; flash.now = f; if (flash.t > flash.end) { flash = null; env.flash = null; } moving = true; }
      else if (s.bolt && live && K.level) { nextBolt -= sim; if (nextBolt <= 0) { strike(cam); nextBolt = s.bolt * (0.35 + rnd() * 1.3); } }
      if (aRain) { aRain.volume = clamp(Math.sqrt(now.rain / 60), 0, 1) * 0.55; aWind.volume = clamp(K.wind / 45, 0, 1) * 0.9 + (K.level ? 0.06 : 0); }
      K.now = now; return moving ? 2 : K.level > 0 && now.rain > 0.05 ? 1 : 0;
    };
    /* drawn over the lit picture, tested against its depth: the far rain, the near rain, the spray, the debris, the bolt */
    K.draw = (R, cam) => {
      if (!started || R.refused.has('rain') || R.settings.viewMode !== 'lit') return; const tier = engine.quality, rk = clamp(Math.sqrt(now.rain / 60), 0, 1.1), sky = R.sky, am = sky.ambient, lc = sky.lightColor, fl = env.flash || [0, 0, 0, 0];
      const pix = 2 / (cam.proj[5] * R.h), time = engine.time.now, light = [am[0] * 2.5 + lc[0] * 0.1 + fl[0] * 0.9 + 0.012, am[1] * 2.5 + lc[1] * 0.1 + fl[1] * 0.9 + 0.013, am[2] * 2.5 + lc[2] * 0.1 + fl[2] * 0.9 + 0.016];
      const layer = (p, L, ext, n, mode, size, expo, floor, alpha, seed) => { if (n < 1) return; const O = offs[L], fo = []; for (let c = 0; c < 4; c++) for (let a = 0; a < 3; a++) { const w = ext[a] * 2; fo.push(((O[c][a] % w) + w) % w); }
        p.sets({ u_ext: ext, u_vel: vel[L], u_off: fo, u_p: [mode, size, expo, pix], u_q: [time, floor, alpha, seed] }); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, Math.floor(n)); R.stats.draws++; R.stats.instances += Math.floor(n); R.stats.tris += Math.floor(n) * 2; };
      if (rk > 0.01 || now.spray > 0.01 || now.debris > 0.5) {
        let p; try { p = dev.program('storm', STORM_VS, STORM_FS); } catch (e) { R.refuse('rain', e); return; }
        dev.bind(R.T.hdrFlatT); dev.state({ depthTest: false, cull: 'none', blend: 'alphaT' }); p.use().sets({ u_viewProj: cam.viewProj, u_view: cam.view, u_camPos: cam.position, u_depth: R.T.depth, u_res: [R.w, R.h], u_nearFar: [cam.near, cam.far], u_light: light }); dev.vao(vao);
        const N = (COUNT[tier] || 12000) * rk, hw = 0.0012 + (STORM[K.level].dropMm || 1.4) * 0.0006, gy = o.ground ? o.ground() : 0;
        if (rk > 0.01) { layer(p, 0, [44, 26, 44], N * 0.75, 0, hw * 1.3, 0.033, 0, 0.36, 1); layer(p, 0, [15, 10, 15], N, 0, hw, 0.033, 0, 0.6, 2); }
        if (rk > 0.4) layer(p, 1, [26, 0.42, 26], (SPRAY[tier] || 300) * 0.7 * rk, 1, 0.42, 0, gy, 0.06 * rk, 5);   /* heavy rain: spray standing just above the pavement */
        if (now.spray > 0.01) layer(p, 1, [72, 9, 72], (SPRAY[tier] || 300) * 0.6 * now.spray, 1, 2.1, 0, gy, 0.02 + 0.035 * now.spray, 3);
        if (now.debris > 0.5) layer(p, 2, [64, 22, 64], now.debris * (DEBRIS[tier] || 0.5), 2, 0.085, 0, gy, 1, 4);
      }
      if (flash && flash.segs.length && flash.now > 0.04) {
        let pb; try { pb = dev.program('storm-bolt', BOLT_VS, BOLT_FS); } catch (e) { R.refuse('rain', e); return; }
        const S2 = flash.segs, n = S2.length / 3, cp = cam.position; if (boltData.length < n * 24) boltData = new Float32Array(n * 24); let k = 0;
        for (let i = 0; i < n; i++) { const a = S2[i * 3], b = S2[i * 3 + 1], br = S2[i * 3 + 2], mx = (a[0] + b[0]) / 2 - cp[0], my = (a[1] + b[1]) / 2 - cp[1], mz = (a[2] + b[2]) / 2 - cp[2], dd = Math.hypot(mx, my, mz), ax = b[0] - a[0], ay = b[1] - a[1], az = b[2] - a[2];
          let sx = ay * mz - az * my, sy = az * mx - ax * mz, sz = ax * my - ay * mx; const sl = Math.hypot(sx, sy, sz) || 1, hw = Math.max(0.9 * br, dd * pix * (0.5 + 0.7 * br)); sx *= hw / sl; sy *= hw / sl; sz *= hw / sl;
          const put = (q, sg) => { boltData[k++] = q[0] + sx * sg; boltData[k++] = q[1] + sy * sg; boltData[k++] = q[2] + sz * sg; boltData[k++] = br; }; put(a, -1); put(a, 1); put(b, 1); put(a, -1); put(b, 1); put(b, -1); }
        dev.bind(R.T.hdrFlatT); dev.state({ depthTest: false, cull: 'none', blend: 'addT' }); dev.vao(bvao); gl.bindBuffer(gl.ARRAY_BUFFER, bbuf); gl.bufferData(gl.ARRAY_BUFFER, boltData.subarray(0, k), gl.DYNAMIC_DRAW);
        const am2 = Math.max(0.6, (am[0] + am[1] + am[2]) * 3) * flash.now * 26; pb.use().sets({ u_viewProj: cam.viewProj, u_view: cam.view, u_depth: R.T.depth, u_res: [R.w, R.h], u_nearFar: [cam.near, cam.far], u_color: [0.8 * am2, 0.88 * am2, am2] });
        gl.drawArrays(gl.TRIANGLES, 0, k / 4); R.stats.draws++; R.stats.tris += k / 12;
      }
      dev.vao(null);
    };
    engine.on('renderTransparent', (R, cam) => K.draw(R, cam));
    K.setSurge = d => { want.surge = d > 0.05 ? d : -1.5; K.surge = d > 0.05 ? d : 0; engine.requestRender(2); };
    /* the world moved its origin: a bolt's path was in the old one */
    K.reset = () => { flash = null; env.flash = null; };
    K.info = () => { const s = STORM[K.level]; return { level: K.level, key: s.k, name: s.l, short: s.s, cat: s.cat || 0, mph: s.mph, gust: s.gust, range: s.range || null, rain: s.rain, dropMm: +s.dropMm.toFixed(2), fall: +s.fall.toFixed(1), visKm: s.visKm ? +s.visKm.toFixed(2) : null, fly: !!s.fly, surge: K.surge, surgeFt: s.surgeFt || null, wind: K.wind || 0, flash: !!flash }; };
    K.strike = cam => strike(cam);   /* for tests */
    K.dispose = () => { gl.deleteVertexArray(vao); gl.deleteBuffer(quad); gl.deleteVertexArray(bvao); gl.deleteBuffer(bbuf); if (water) water.destroy(); };
    return K;
  }
  SE.StormKit = StormKit;

