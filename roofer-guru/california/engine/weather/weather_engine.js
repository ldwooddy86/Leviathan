  /* ==== rooftop scout on the engine: California's weather. Rain up to an AR5 atmospheric river, dry offshore wind, snow, fog and smoke ==== */
  /* Three things can be set, and they are independent: a wet scale (SE.STORM), a dry offshore wind scale (SE.WIND) and a
     sky state (SE.SKY). What is drawn follows from each step's numbers, and every step says in its note where its numbers
     come from. Where a number is this picture's choice and not a measurement, the note says so.
       The wet scale   Dry, light rain, steady rain, a thunderstorm, then atmospheric rivers AR1 to AR5. The AR scale is
                  CW3E's (Ralph and others 2019, Bulletin of the American Meteorological Society 100, 269): a rank is set
                  by the strongest vapor transport over a point (IVT, 3 hour mean, thresholds 250, 500, 750, 1,000 and
                  1,250 kg per metre per second) and by how long it stays at or above 250 (24 to 48 hours keeps the rank,
                  under 24 lowers it one, over 48 raises it one). The scale says nothing about rain rate or wind at a
                  roof. Those two figures are chosen here for each rank, and anchored to California storms whose rank at
                  the nearest coast point is in CW3E's landfall catalogue and whose gusts or rain rates are in the
                  Weather Service's Storm Events narratives or airport records. A real AR2 can blow harder than a real
                  AR4: on 14 December 2024 an AR2 gave San Francisco airport its strongest screened gust in 30 years,
                  83 mph.
       The rain   Millimetres an hour. The federal observing handbook calls rain light to 2.5 and heavy over 7.6. From the
                  rate come the size of the drops (Marshall and Palmer: the median drop by volume is
                  3.67 / (4.1 R^-0.21) mm across), how fast they fall (Atlas, Srivastava and Sekhon's fit to Gunn and
                  Kinzer: 9.65 - 10.3 exp(-0.6 D) m/s) and how far one can see through it (a rule of thumb, about
                  12.5 R^-0.67 km).
       The dry wind   Santa Ana in the south, Diablo in the north, sundowner on the Santa Barbara coast: the same thing
                  for a roof, a dry wind that comes down the lee of the mountains toward the sea. Six steps from calm to
                  an extreme downslope windstorm. The gusts are from Storm Events narratives and the Local Storm Reports;
                  the strongest are from ridge and canyon sensors, not from rooftops in towns, and the notes say so.
       Snow       Each wet step has a snow level in metres above sea level (a choice inside the range the narratives give,
                  from 1,500 ft in a cold storm to above 9,000 ft in a warm one). Above it the precipitation falls as snow
                  and a white cover builds on ground and roofs; below it, rain. The kit must be told how high the scene
                  stands (see StormKit's options); told nothing, it draws no snow.
       The sky    Marine layer (June gloom), tule fog and wildfire smoke. No measurement of the marine layer was collected
                  for this atlas, so all of its figures are choices. Tule fog's visibility is from Storm Events (down to
                  200 ft, and 50 ft, in the San Joaquin Valley); it is drawn at an eighth of a mile so that the picture
                  can still be read.
     A drop falls at its speed and travels sideways with the wind. Streaks are as long as a drop travels in a thirtieth of
     a second. Roofs, roads and yards turn wet and glossy, rings spread where drops land, water runs down slopes, and in the
     heavy steps it stands on flat ground. Trees lean and thrash; cloud covers the sky and races; lightning lights the scene
     and its thunder comes later by the distance.
     What is not physics, and is said so in the view: the count of drops and flakes (thousands are drawn where the air holds
     millions), the path of a bolt, the leaves, fronds and roofing in the air, how fast snow builds and melts (minutes here,
     hours in life), the standing water (a picture of street flooding on flat ground, not a flood map for an address), the
     flicker of a power line arcing in the distance (the records tell of lines blown down, not of how often they flash),
     and the ash and embers under a smoke sky. */
  const ALTA_GUST_MS = 15;   /* the Alta X flies in wind gusting to this and no more. Freefly publishes no wind limit for it (see the r11 evidence file, C5); 15 m/s is the speed its maker says the Gen2 "operates normally in forward flight" at with a full payload, taken here as the limit: a choice */
  const STORM = [
    { k: 'dry', l: 'Dry', s: 'Dry', mph: 0, gust: 0, rain: 0, fly: true, snow: null,
      note: 'No rain. The sky and the air are the ones chosen under Weather.' },
    { k: 'light', l: 'Light rain', s: 'Light rain', mph: 8, gust: 14, rain: 2, fly: true, sun: 0.22, sky: 1.35, snow: 1700,
      note: 'Rain drawn at 2 mm an hour, inside the federal observing handbook\'s light rain (up to 2.5). Wind and snow level (1,700 m, about 5,600 ft) are choices. The Alta X is rated for light rain (IP43) and flies.' },
    { k: 'rain', l: 'Steady rain', s: 'Steady rain', mph: 15, gust: 25, rain: 6, sun: 0.12, sky: 1.25, snow: 1500,
      note: 'Rain drawn at 6 mm an hour, the handbook\'s moderate rain (2.6 to 7.6): an ordinary winter front. Wind and snow level (1,500 m, about 4,900 ft; Storm Events narratives put winter snow levels at 3,500 to 5,000 ft in many storms) are choices.' },
    { k: 'tstorm', l: 'Thunderstorm', s: 'Thunderstorm', mph: 30, gust: 58, rain: 40, bolt: 9, sun: 0.05, sky: 0.8, snow: 2400,
      note: 'Gusts at the Weather Service\'s severe mark, 58 mph. Rain drawn at 40 mm an hour; a Kern County desert storm on 11 July 1999 gave half an inch in 15 minutes (51 mm an hour) in Storm Events. Thunderstorms are uncommon in California: 1,369 thunderstorm wind reports since 1955. Sustained wind, flash rate and snow level are choices.' },   /* bolt: seconds between flashes, on average */
    { k: 'ar1', l: 'Atmospheric river, AR1 (weak)', s: 'AR1', ar: 1, ivt: [250, 500], cw3e: 'weak: primarily beneficial', mph: 20, gust: 35, rain: 4, sun: 0.12, sky: 1.25, snow: 1800,
      note: 'CW3E rank 1: strongest vapor transport 250 to 500 kg/m/s lasting 24 to 48 hours (or 500 to 750 for under 24). About 11 a year reach the California coast (CW3E landfall catalogue, water years 1960 to 2025, my count). Rain rate, wind and snow level are choices: the scale sets none. A real AR1 can do damage: the one of 17 February 2017 at 32.5 N downed hundreds of trees across coastal San Diego County.' },
    { k: 'ar2', l: 'Atmospheric river, AR2 (moderate)', s: 'AR2', ar: 2, ivt: [500, 750], cw3e: 'moderate: mostly beneficial, also hazardous', mph: 25, gust: 45, rain: 7, sun: 0.1, sky: 1.2, snow: 2000,
      note: 'CW3E rank 2: 500 to 750 kg/m/s for 24 to 48 hours. About 7 a year on the California coast. Rain rate, wind and snow level are choices. For scale: the AR2 of 4 to 5 February 2024 at 34 N left 7.03 inches on downtown Los Angeles in two days (a secondary report), which averages under 4 mm an hour; the AR2 of 14 December 2024 at 37.5 N gusted to 83 mph at San Francisco airport.' },
    { k: 'ar3', l: 'Atmospheric river, AR3 (strong)', s: 'AR3', ar: 3, ivt: [750, 1000], cw3e: 'strong: balance of beneficial and hazardous', mph: 32, gust: 55, rain: 12, bolt: 420, sun: 0.08, sky: 1.1, snow: 2200,
      note: 'CW3E rank 3: 750 to 1,000 kg/m/s for 24 to 48 hours. About 4 a year on the California coast. Rain rate, wind and snow level are choices. The storm of 4 to 5 January 2023 was an AR3 at 37.5 N, and so was that of 4 to 5 February 2024 at 36.5 N, when a ridge sensor in the southern Sierra (Upper Bull) read 120 mph; towns saw far less.' },
    { k: 'ar4', l: 'Atmospheric river, AR4 (extreme)', s: 'AR4', ar: 4, ivt: [1000, 1250], cw3e: 'extreme: mostly hazardous, also beneficial', mph: 40, gust: 70, rain: 18, bolt: 300, sun: 0.07, sky: 1.0, snow: 2400,
      note: 'CW3E rank 4: 1,000 to 1,250 kg/m/s for 24 to 48 hours. About 1.4 a year on the California coast, and 10 in 66 years on the south coast (32.5 to 34.5 N). Wind is anchored to the AR4 of 3 to 5 January 2008 at 38 N: 71 mph near Elk Grove and 69 mph at Sacramento Executive Airport (Storm Events). The same storm rained at about an inch an hour on the San Luis Obispo foothills; 18 mm an hour is drawn as a rate that lasts. Snow level is a choice.' },
    { k: 'ar5', l: 'Atmospheric river, AR5 (exceptional)', s: 'AR5', ar: 5, ivt: [1250, null], cw3e: 'exceptional: primarily hazardous', mph: 45, gust: 80, rain: 25, bolt: 240, sun: 0.06, sky: 0.92, snow: 2700,
      note: 'CW3E rank 5: 1,250 kg/m/s and up for 24 hours or more, or 1,000 to 1,250 for over 48. About one every three years on the California coast (109 point records in 66 years, none at 34 N). The New Year storm of 30 December 1996 to 3 January 1997 was an AR5 at 39 N (89 hours); radar then showed half an inch to an inch and a half an hour over Monterey County (13 to 38 mm; 25 is drawn). 24 to 25 October 2021 and 7 to 9 January 2017 were AR5 at 38 N. Gusts of 80 mph are a choice near the top of what airports record (San Francisco 83 mph). Snow level 2,700 m (about 9,000 ft), as in the warm storm of November 2002.' },
  ];
  STORM.forEach((s, i) => {
    s.i = i; s.ms = s.mph * 0.44704; s.gustMs = s.gust * 0.44704; s.rainIn = +(s.rain / 25.4).toFixed(2);
    s.dropMm = s.rain ? 3.67 / (4.1 * Math.pow(s.rain, -0.21)) : 0; s.fall = s.rain ? 9.65 - 10.3 * Math.exp(-0.6 * s.dropMm) : 0;
    s.visKm = s.rain ? 12.5 * Math.pow(s.rain, -0.67) : null; s.fog = s.rain ? Math.max(0.0009, 3.912 / (s.visKm * 1000)) : 0; s.sway = 0.35 + s.gustMs * 0.055;   /* how hard the trees are worked: by the gusts */
    s.dark = [0, 0.15, 0.28, 0.75, 0.3, 0.4, 0.5, 0.62, 0.72][i];   /* how far the picture is graded toward a storm's: darker, greyer, colder */
  });
  SE.STORM = STORM;

  /* Dry offshore wind. dust: how much blowing dust is drawn; leaf: how many leaves and fronds are in the air. */
  const WIND = [
    { k: 'calm', l: 'Calm', s: 'Calm', mph: 0, gust: 0, dust: 0, leaf: 0,
      note: 'No offshore wind. The air moves as the wet scale and the weather say.' },
    { k: 'breeze', l: 'Offshore breeze', s: 'Offshore breeze', mph: 12, gust: 20, dust: 0, leaf: 0,
      note: 'A light, dry wind off the land: 12 mph gusting 20, a choice. The Alta X still flies.' },
    { k: 'sa1', l: 'Offshore wind, advisory level', s: 'Offshore advisory', mph: 25, gust: 45, dust: 0.12, leaf: 40,
      note: 'Gusts of 45 mph, under the 58 mph at which the Weather Service files a High Wind report: the level of a wind advisory, chosen. Santa Ana days come about 46 a year in the Scripps regional index (1948 to 2018), most of them in November to February.' },
    { k: 'sa2', l: 'Offshore wind, high wind', s: 'Offshore high wind', mph: 35, gust: 65, dust: 0.35, leaf: 110,
      note: 'Gusts of 65 mph. On 30 November to 1 December 2011 the Santa Fe Dam sensor read 58 to 68 mph and spotters in Pasadena over 60 (Storm Events). In those narratives roof damage begins to be reported at gusts of about 60 to 70 mph (a reading of the narratives, not a published threshold).' },
    { k: 'sa3', l: 'Offshore wind, damaging', s: 'Offshore damaging', mph: 45, gust: 80, dust: 0.7, leaf: 220, arc: 95,
      note: 'Gusts of 80 mph. On 25 November 1996 Storm Events gives sustained northeast winds of 35 to 45 mph in the Santa Ana; on 21 October 2007 gusts over 70 mph "damaged countless roofs" in the Inland Empire and San Diego County; Mount Diablo read 75 mph in the Diablo wind of 8 October 2017, and Montecito 70 mph in a sundowner on 9 May 2022.' },
    { k: 'sa4', l: 'Offshore wind, extreme downslope windstorm', s: 'Offshore extreme', mph: 60, gust: 100, dust: 1, leaf: 340, arc: 50,
      note: 'Gusts of 100 mph, the strongest measured in rows that name the wind: 100 mph at Mount Lukens Truck Trail and 103 to 104 at Marshall Peak on 7 January 2025, 105 at Johnson Valley on 6 March 2012. These are ridge and canyon sensors; a street in town sees less, and this step shows the worst case. The sustained 60 mph is a choice.' },
  ];
  WIND.forEach((w, i) => { w.i = i; w.ms = w.mph * 0.44704; w.gustMs = w.gust * 0.44704; w.fly = w.gustMs <= ALTA_GUST_MS; w.sway = 0.35 + w.gustMs * 0.055; });
  SE.WIND = WIND;
  /* which name the dry wind goes by at a place, and the way it blows (the bearing it blows toward, degrees from north).
     North of about Monterey it is the Diablo wind, out of the north and northeast; on the Santa Barbara south coast the
     sundowner, down the Santa Ynez range out of the north; elsewhere in the south the Santa Ana, out of the northeast. The
     boundaries are this picture's. */
  SE.windName = (lat, lon) => lat == null ? ['Santa Ana', 232] : lat > 35.8 ? ['Diablo', 205] : (lat > 34.3 && lat < 34.65 && lon < -119.4 && lon > -120.55) ? ['sundowner', 180] : ['Santa Ana', 232];

  /* Sky states. vis: how far one can see, km, as drawn. */
  const SKY = [
    { k: 'none', l: 'As the weather sets it', s: 'None', note: 'No sky state: the sky is the one chosen under Weather, or the storm\'s.' },
    { k: 'marine', l: 'Marine layer (June gloom)', s: 'Marine layer', vis: 6,
      note: 'A low stratus deck off the ocean: flat, cool, grey light and no rain. It is full at night and in the morning, thins from mid morning and is gone by early afternoon on most days, then comes back in the evening (drawn by the sun\'s hour: full before 9:30, gone by 13:00, back from 17:30). No record of the marine layer was collected for this atlas: every figure here is a choice. The deck is drawn at the engine\'s cloud height, higher than a real one (a few hundred metres). It is held off while rain or offshore wind is set: an offshore wind pushes it out to sea.' },
    { k: 'tule', l: 'Tule fog', s: 'Tule fog', vis: 0.2,
      note: 'The Central Valley\'s winter ground fog, under a strong inversion in still air. Storm Events gives visibility under a quarter mile at Merced, Madera, Fresno and Visalia, under 200 ft in many places, and 50 ft at worst. It is drawn at an eighth of a mile (200 m) so the roofs can still be seen, and about 60 m deep (a choice), so a craft climbs out of it. It is held off while rain or offshore wind is set: it does not survive wind.' },
    { k: 'smoke', l: 'Wildfire smoke', s: 'Smoke', vis: 2.4,
      note: 'A sky under wildfire smoke: orange light, a dimmed sun, visibility drawn at about 2.4 km, ash falling, and embers blowing through in the two strongest offshore wind steps. It is a picture of a smoke day, not of a fire at this address; every figure is a choice. Embers are what take most houses in a wind driven fire (the roofing evidence file, C1).' },
  ];
  SKY.forEach((s, i) => { s.i = i; });
  SE.SKY = SKY;
  const stepOf = (T, v) => { if (typeof v === 'string' && isNaN(+v)) { const j = T.findIndex(s => s.k === v.toLowerCase()); return j < 0 ? 0 : j; } return clamp(Math.round(+v || 0), 0, T.length - 1); };
  SE.stormStep = v => stepOf(STORM, v); SE.windStep = v => stepOf(WIND, v); SE.skyStep = v => stepOf(SKY, v);

  const STORM_VS = `
layout(location=0) in vec2 a_corner;
uniform mat4 u_viewProj, u_view; uniform vec3 u_camPos, u_ext, u_vel; uniform vec3 u_off[4];
uniform vec4 u_p;   /* what is drawn (0 rain, 1 spray or dust, 2 leaves and roofing, 3 a snowflake or a flake of ash, 4 an ember), its size, the exposure, the width of a pixel a metre away */
uniform vec4 u_q;   /* time, the floor of the band spray and debris keep to, opacity, a seed */
uniform vec2 u_mix; /* of the debris: the share that is roofing, the share that is palm frond */
out vec2 v_uv; out float v_viewZ; out float v_a; out vec3 v_h; out float v_kind;
vec3 h3(float n) { vec3 p = fract(vec3(n) * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
void main() {
  float id = float(gl_InstanceID) + u_q.w * 131.0; vec3 h = h3(id), h2 = h3(id + 0.37); int c = gl_InstanceID & 3; float cm = 0.82 + 0.126 * float(c);
  bool band = u_p.x > 0.5 && u_p.x < 2.5; vec3 box = u_ext * 2.0, p = h * box + u_off[c], rel; v_kind = 0.0;
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
  } else if (u_p.x < 1.5) {     /* spray or dust: a soft shred drawn out along the wind */
    vec3 ax = normalize(vec3(u_vel.x, 0.0, u_vel.z) + vec3(1e-4, 0.0, 0.0)), side = normalize(cross(ax, toC) + vec3(1e-5)); float s = u_p.y * (0.55 + 0.9 * h2.x);
    w += ax * (a_corner.x * s * 2.8) + side * (a_corner.y * s); v_a *= smoothstep(1.5, 9.0, dist) * smoothstep(0.0, 0.12, rel.y / box.y) * (1.0 - smoothstep(0.55, 1.0, rel.y / box.y));
  } else if (u_p.x < 2.5) {     /* debris: a leaf, a palm frond or a tab of roofing, tumbling */
    float t = u_q.x, a1 = t * (5.0 + 9.0 * h2.x) + h2.y * 6.2832, a2 = t * (3.0 + 7.0 * h2.z) + h.x * 6.2832; bool roof = h2.x < u_mix.x, frond = !roof && h2.z > 1.0 - u_mix.y; v_kind = roof ? 1.0 : frond ? 2.0 : 0.0;
    vec3 e1 = vec3(cos(a1), sin(a1) * cos(a2), sin(a1) * sin(a2)), e2 = normalize(cross(e1, vec3(sin(a2), cos(a2), 0.31))); float s = u_p.y * (0.5 + 1.3 * h2.x) * (frond ? 5.5 : roof ? 1.6 : 1.0);
    w.y += sin(t * (1.3 + h2.y) + h.z * 6.2832) * 1.6; w += e1 * (a_corner.x * s) + e2 * (a_corner.y * s * (frond ? 0.2 : 0.62));
  } else {                      /* a snowflake, a flake of ash or an ember: a soft dot that flutters as it falls, drawn out a little along its path when the wind is hard */
    float t = u_q.x; vec3 v = u_vel * cm; float sp = length(v); vec3 ax = v / max(sp, 1e-3), side = normalize(cross(ax, toC) + vec3(1e-5));
    w.xz += vec2(sin(t * (1.1 + 1.7 * h2.y) + h.z * 6.2832), cos(t * (0.9 + 1.3 * h2.z) + h.x * 6.2832)) * (0.1 + 0.16 * h2.x);
    float hw = u_p.y * (0.6 + 0.8 * h2.y), mn = dist * u_p.w * 0.7; v_a *= min(1.0, hw / max(mn, 1e-6)); hw = max(hw, mn); float hl = max(hw, 0.5 * sp * u_p.z);
    v_a *= clamp(hw / hl * 1.6, 0.3, 1.0); w += side * (a_corner.x * hw) + ax * (a_corner.y * hl);
  }
  vec4 vp = u_view * vec4(w, 1.0); v_viewZ = -vp.z; v_uv = a_corner; gl_Position = u_viewProj * vec4(w, 1.0);
}`;
  const STORM_FS = `
#include <common>
in vec2 v_uv; in float v_viewZ; in float v_a; in vec3 v_h; in float v_kind; out vec4 o_color;
uniform sampler2D u_depth; uniform vec2 u_res, u_nearFar; uniform vec4 u_p, u_q; uniform vec3 u_light;
uniform vec4 u_col;   /* the color: lit by the scene's light (w 0) or giving its own (w 1, an ember) */
float linZ(float d) { float z = d * 2.0 - 1.0; return 2.0 * u_nearFar.x * u_nearFar.y / (u_nearFar.y + u_nearFar.x - z * (u_nearFar.y - u_nearFar.x)); }
void main() {
  float sz = linZ(textureLod(u_depth, gl_FragCoord.xy / u_res, 0.0).r), soft = u_p.x > 0.5 && u_p.x < 1.5 ? 2.6 : 0.3, fade = clamp((sz - v_viewZ) / soft, 0.0, 1.0); if (fade <= 0.0) discard;
  float a = 1.0; vec3 col = u_col.w > 0.5 ? u_col.rgb * (0.45 + 1.1 * v_h.x) : u_light * u_col.rgb;
  if (u_p.x < 0.5) a = (1.0 - v_uv.x * v_uv.x) * smoothstep(1.0, 0.5, abs(v_uv.y)) * (0.75 + 0.5 * v_h.z);
  else if (u_p.x < 1.5) { float r = length(v_uv); if (r > 1.0) discard; a = pow(1.0 - r, 1.25) * (0.3 + 1.0 * fbm(v_uv * 1.7 + v_h.xy * 31.0 + u_q.x * 0.55)); }
  else if (u_p.x < 2.5) col = u_light * (v_kind > 1.5 ? mix(vec3(0.13, 0.1, 0.05), vec3(0.09, 0.1, 0.04), v_h.y) : v_kind > 0.5 ? vec3(0.05, 0.05, 0.055) : mix(vec3(0.12, 0.085, 0.04), vec3(0.055, 0.1, 0.035), v_h.y * u_col.r));
  else { float r = dot(v_uv, v_uv); if (r > 1.0) discard; a = (1.0 - r) * (0.7 + 0.3 * v_h.z); }
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

  /* o: { ground() -> the world height of the ground under the camera (0 when not given) }.
     K.set(level, w0, o2) takes the rest: o2 = { wind, sky, hour, lat, lon, y0, snowLevel }, where y0 is how high the world's
     y = 0 stands above sea level in metres (null when nobody knows: then no snow is drawn) and snowLevel, if given, takes
     the place of the step's own. */
  function StormKit(engine, o) {
    o = o || {}; const dev = engine.device, gl = dev.gl, scene = engine.scene, env = scene.env, K = { level: 0, windLevel: 0, sky: 0, y0: null, snowLine: null, held: '' };
    const COUNT = { ultra: 30000, high: 20000, medium: 12000, low: 5000 }, SPRAY = { ultra: 900, high: 620, medium: 340, low: 130 }, DEBRIS = { ultra: 1, high: 0.8, medium: 0.5, low: 0.28 };
    /* what is on the screen now, eased toward what the steps ask for, so the scales slide */
    const RS = engine.renderer.settings, G0 = { exposure: RS.exposure || 0, saturation: RS.saturation, temperature: RS.temperature || 0, contrast: RS.contrast };
    const now = { dark: 0, rain: 0, ms: 0, gf: 1, fall: 6, fog: env.fogDensity, fogH: env.fogHeight || 90, clouds: env.clouds, wet: env.wetness, sway: env.wind, spray: 0, dust: 0, debris: 0, roofing: 0, frond: 0, snow: 0, pond: 0, ash: 0, ember: 0, temp: 0, sat: 0, expo: 0, bear: 340 };
    let want = Object.assign({}, now), dir = [0.8, 0.6], gustT = 0, phase = 0, started = false, snowAir = 0;
    const offs = [0, 1, 2, 3, 4, 5].map(() => [0, 1, 2, 3].map(() => [0, 0, 0])), drift = [0, 0], vel = [[0, -6, 0], [0, 0.3, 0], [0, -1.2, 0], [0, -1.2, 0], [0, -0.7, 0], [0, 0.5, 0]];
    /* one quad, drawn many times: each copy finds its own place from its number */
    const vao = gl.createVertexArray(), quad = gl.createBuffer(); dev.vao(vao); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); dev.vao(null);
    const bvao = gl.createVertexArray(), bbuf = gl.createBuffer(); dev.vao(bvao); gl.bindBuffer(gl.ARRAY_BUFFER, bbuf); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0); dev.vao(null);
    const rnd = rng(90210);
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
    let flash = null, nextBolt = 0, nextArc = 0, boltData = new Float32Array(4096);
    function strike(cam) {
      const cp = cam.position, inv = cam.invView, fx = -inv[8], fz = -inv[10], ya = Math.atan2(fx, -fz) + (rnd() < 0.7 ? (rnd() - 0.5) * 2.6 : rnd() * TAU), d = 900 + rnd() * rnd() * 6500, x = cp[0] + Math.sin(ya) * d, z = cp[2] - Math.cos(ya) * d;
      const g0 = o.ground ? o.ground() : 0, cloud = rnd() < 0.36, segs = [], top = [x + (rnd() - 0.5) * 500, g0 + 1480, z + (rnd() - 0.5) * 500];
      if (!cloud) { const walk = (a, b, disp, depth, bright) => {
          if (!depth) { segs.push(a, b, bright); return; } const m = [(a[0] + b[0]) / 2 + (rnd() - 0.5) * disp, (a[1] + b[1]) / 2 + (rnd() - 0.5) * disp * 0.4, (a[2] + b[2]) / 2 + (rnd() - 0.5) * disp];
          walk(a, m, disp / 2, depth - 1, bright); walk(m, b, disp / 2, depth - 1, bright);
          if (depth > 2 && bright > 0.3 && rnd() < 0.32) { const L = Math.hypot(m[0] - a[0], m[1] - a[1], m[2] - a[2]); walk(m, [m[0] + (m[0] - a[0]) * 0.6 + (rnd() - 0.5) * L * 1.4, m[1] - L * (0.3 + rnd() * 0.55), m[2] + (m[2] - a[2]) * 0.6 + (rnd() - 0.5) * L * 1.4], disp / 2, depth - 2, bright * 0.38); } };
        walk(top, [x, g0, z], 330, 6, 1); }
      const strokes = [[0, 1]]; let t = 0; const n = 1 + Math.floor(rnd() * 3.4); for (let i = 0; i < n; i++) { t += 0.05 + rnd() * 0.11; strokes.push([t, 0.35 + rnd() * 0.6]); }
      const dx = top[0] - cp[0], dy = g0 + (cloud ? 1480 : 700) - cp[1], dz = top[2] - cp[2], dl = Math.hypot(dx, dy, dz) || 1;
      flash = { t: 0, strokes, segs, dir: [dx / dl, dy / dl, dz / dl], dist: Math.hypot(dx, dz), power: cloud ? 0.55 : 1, tint: [0.78, 0.86, 1], end: t + 0.45 }; thunder(flash.dist, flash.power);
    }
    /* a power line arcing somewhere out in the wind: a few quick blue-green pulses low on the horizon, and no sound. A
       picture: the records tell of poles snapped and lines blown down in these winds, not of how often they flash. */
    function arc(cam) {
      const ya = rnd() * TAU, el = 0.02 + rnd() * 0.05, strokes = []; let t = 0; const n = 3 + Math.floor(rnd() * 5); for (let i = 0; i < n; i++) { strokes.push([t, 0.4 + rnd() * 0.6]); t += 0.04 + rnd() * 0.16; }
      flash = { t: 0, strokes, segs: [], dir: [Math.sin(ya) * Math.cos(el), Math.sin(el), -Math.cos(ya) * Math.cos(el)], dist: 1500 + rnd() * 5000, power: 0.2, tint: [0.3, 0.9, 1], arc: true, end: t + 0.3 };
    }
    const flashNow = f => { let s = 0; for (const [t0, a] of f.strokes) if (f.t >= t0) s += a * Math.exp(-(f.t - t0) / 0.05); return s; };
    /* the marine layer by the sun's hour: 1 is a full deck, 0 is burned off */
    const marineAt = h => h == null ? 1 : 1 - smoothstep(9.5, 13, h) * (1 - smoothstep(17.5, 20, h));

    /* The steps asked for, over the weather the scene had: w0 is { clouds, fogDensity, wetness, turbidity, sunIntensity,
       skyIntensity }. Returns what the sky needs set at once (its light is worked out afresh when these change); the rest
       slides. */
    K.set = (level, w0, o2) => {
      o2 = o2 || {}; level = stepOf(STORM, level); const wl = stepOf(WIND, o2.wind), sk = stepOf(SKY, o2.sky), s = STORM[level], w = WIND[wl], first = !started; started = true; K.level = level; K.windLevel = wl; K.sky = sk;
      K.y0 = o2.y0 == null || !isFinite(o2.y0) ? null : +o2.y0; K.snowOver = o2.snowLevel == null || !isFinite(o2.snowLevel) ? null : +o2.snowLevel; K.snowLine = level ? (K.snowOver != null ? K.snowOver : s.snow) : null;
      const nm = SE.windName(o2.lat, o2.lon); K.windName = nm[0]; K.hour = o2.hour == null ? null : o2.hour;
      const dryWind = wl >= 2 && !level, gust = Math.max(s.gustMs, w.gustMs), ms = Math.max(s.ms, w.ms);
      let fog = w0.fogDensity, fogH = 90, clouds = w0.clouds, turb = w0.turbidity, sunI = w0.sunIntensity, skyI = w0.skyIntensity, dark = 0, temp = 0, sat = 0, expo = 0, ash = 0, ember = 0;
      /* a dry offshore wind: the air is clear and the sky nearly bare, until the dust is up */
      if (dryWind) { fog = Math.min(fog, 0.00014) + 0.0005 * w.dust * w.dust; clouds = Math.min(clouds, 0.06); turb = 1.9 + 2.2 * w.dust; sunI = Math.max(sunI, 1); skyI = 1; temp = 0.35 * w.dust; }
      if (level) { fog = Math.max(s.fog, fog); fogH = 420; clouds = 1; turb = 5 + level * 0.35; sunI = s.sun; skyI = s.sky; dark = s.dark; }
      K.held = ''; K.burn = 0;
      if (sk === 1 || sk === 2) { if (level) K.held = 'held off while it rains'; else if (wl >= 2) K.held = sk === 1 ? 'pushed out to sea by the offshore wind' : 'it does not survive wind'; }
      if (sk === 1 && !K.held) { const m = marineAt(K.hour); K.burn = 1 - m; clouds = lerp(clouds, 1, m); sunI = lerp(sunI, 0.13, m); skyI = lerp(skyI, 1.45, m); turb = lerp(turb, 5, m); fog = Math.max(fog, 0.00065 * m); fogH = 260; dark = 0.16 * m; temp = -0.9 * m; sat = -0.1 * m; }
      if (sk === 2 && !K.held) { fog = 3.912 / 200; fogH = 60; sunI *= 0.4; skyI = Math.max(skyI, 1.2); turb = 6; dark = 0.1; sat = -0.22; }
      if (sk === 3) { fog = Math.max(fog, 3.912 / 2400); fogH = Math.max(fogH, 800); turb = 11; sunI *= 0.3; skyI *= 0.62; clouds *= 0.6; dark = Math.max(dark, 0.22); temp += 2.6; sat -= 0.05; ash = 1; ember = wl >= 4 ? (wl - 3) / 2 : 0; }
      want = { dark, rain: s.rain, ms, gf: ms > 0.1 ? Math.max(1, gust / ms) : 1, fall: s.fall || 6, fog, fogH, clouds, wet: level ? 1 : w0.wetness, sway: Math.max(level ? s.sway : 0.35, w.sway),
        spray: level ? clamp((gust - 20) / 40, 0, 1) : 0, dust: dryWind ? w.dust : 0, debris: level ? (gust > 22 ? clamp((gust - 22) / 14, 0, 1) * 130 : 0) : w.leaf, roofing: gust >= 44 ? 0.4 : gust >= 35 ? 0.25 : gust >= 29 ? 0.1 : 0, frond: level ? 0.06 : 0.22,
        snow: level && K.y0 != null ? 1 : 0, pond: clamp((s.rain - 10) / 15, 0, 1), ash, ember, temp, sat, expo, bear: !level && wl ? nm[1] : 340 };
      if (level && s.bolt) nextBolt = 1.5 + rnd() * s.bolt * 0.6; else nextBolt = 0; nextArc = w.arc && !level ? 6 + rnd() * w.arc : 0;
      if (first) { Object.assign(now, want); now.snow = 0; now.pond = 0; apply(); }
      if (level || wl) sounds(); engine.requestRender(4);
      return { turbidity: turb, sunIntensity: sunI, skyIntensity: skyI };
    };
    let graded = false, wasQuiet = false;
    function apply() { env.fogDensity = now.fog * (1 + 1.2 * snowAir); env.fogHeight = now.fogH; env.clouds = now.clouds; env.wetness = now.wet;
      env.snowK = [now.snow, K.y0 != null && K.snowLine != null ? K.snowLine - K.y0 : 1e9, 45, now.pond];
      const d = now.dark, on = d > 0.001 || Math.abs(now.temp) > 0.001 || Math.abs(now.sat) > 0.001 || Math.abs(now.expo) > 0.001;
      if (on) { graded = true; RS.exposure = G0.exposure - 0.95 * d + now.expo; RS.saturation = G0.saturation - 0.3 * d + now.sat; RS.temperature = G0.temperature - 0.1 * d + now.temp; RS.contrast = G0.contrast + 0.07 * d; }
      else if (graded) { graded = false; RS.exposure = G0.exposure; RS.saturation = G0.saturation; RS.temperature = G0.temperature; RS.contrast = G0.contrast; } }   /* the last of the grade is let go exactly, so nothing of a storm is left in the picture */
    /* once a frame: slide toward the steps, move the air, time the lightning. 2 while the scene is still sliding, 1 while only rain, snow, dust or ash move, 0 at rest. */
    K.update = (dt, cam, live) => {
      if (!started) return false; const s = STORM[K.level], w = WIND[K.windLevel], k = 1 - Math.exp(-dt / 1.1), kw = 1 - Math.exp(-dt / (want.wet > now.wet ? 2.5 : 14)); let moving = false;
      for (const f of ['dark', 'rain', 'ms', 'gf', 'fall', 'fog', 'fogH', 'clouds', 'sway', 'spray', 'dust', 'debris', 'roofing', 'frond', 'ash', 'ember', 'temp', 'sat', 'expo']) { const d = want[f] - now[f]; if (Math.abs(d) > Math.abs(want[f]) * 0.002 + 1e-5) { now[f] += d * k; moving = true; } else now[f] = want[f]; }
      { const d = want.wet - now.wet; if (Math.abs(d) > 0.004) { now.wet += d * kw; moving = true; } else now.wet = want.wet; }
      /* snow builds in a minute or so and melts in two; water gathers on flat ground in half a minute and drains in one: sped up, and said so */
      { const d = want.snow - now.snow; if (Math.abs(d) > 0.004) { now.snow += d * (1 - Math.exp(-dt / (d > 0 ? 22 : 30))); moving = true; } else now.snow = want.snow; }
      { const d = want.pond - now.pond; if (Math.abs(d) > 0.004) { now.pond += d * (1 - Math.exp(-dt / (d > 0 ? 9 : 16))); moving = true; } else now.pond = want.pond; }
      { let d = want.bear - now.bear; d -= Math.round(d / 360) * 360; if (Math.abs(d) > 0.3) { now.bear += d * k; moving = true; } else now.bear = want.bear; }
      /* is it snow or rain where the camera is: snow above the snow level, rain below, a mix across about 80 m */
      const cp = cam.position, line = K.y0 != null && K.snowLine != null ? K.snowLine - K.y0 : 1e9; snowAir = K.level ? smoothstep(line - 40, line + 40, cp[1]) : 0; K.snowAir = snowAir;
      /* with nothing set and nothing sliding, the air is left alone: the editor's world settings stay as a person set them */
      const any = K.level || K.windLevel || K.sky, quiet = !any && !moving, held = quiet && wasQuiet; wasQuiet = quiet; if (!held) apply();
      const sim = live ? dt : 0; gustT += sim;
      /* gusts: the wind rises to the step's gust figure and falls back under its sustained one, and backs and veers a little */
      const g = any ? (0.6 * Math.sin(gustT * 0.21) + 0.3 * Math.sin(gustT * 0.57 + 1.3) + 0.2 * Math.sin(gustT * 1.31 + 0.4)) : 0, gk = g > 0 ? 1 + Math.min(1, g) * (now.gf - 1) : 1 + g * 0.22, veer = 0.18 * Math.sin(gustT * 0.083) + 0.08 * Math.sin(gustT * 0.31 + 2), b0 = now.bear * Math.PI / 180 + veer;
      dir = [Math.sin(b0), -Math.cos(b0)]; if (!held) { env.windDir = dir; env.wind = Math.max(0.2, now.sway * (any ? 0.62 + 0.38 * gk / Math.max(1, now.gf) : 1)); } K.wind = now.ms * gk; K.dir = dir;
      const wx = dir[0] * K.wind, wz = dir[1] * K.wind; vel[0] = [wx, -now.fall, wz]; vel[1] = [wx * 0.8, 0.35, wz * 0.8]; vel[2] = [wx * 0.7, -1.3, wz * 0.7]; vel[3] = [wx * 0.9, -1.2, wz * 0.9]; vel[4] = [wx * 0.8 + 0.3, -0.7, wz * 0.8 + 0.2]; vel[5] = [wx * 0.9, 0.5, wz * 0.9];
      for (let L = 0; L < 6; L++) for (let c = 0; c < 4; c++) { const m = 0.82 + 0.126 * c, O = offs[L][c]; O[0] += vel[L][0] * m * sim; O[1] += vel[L][1] * m * sim; O[2] += vel[L][2] * m * sim; }
      /* the cloud deck travels with the wind aloft, faster than the wind at the roofs */
      const c0 = env.cloudSpeed == null ? 1 : env.cloudSpeed, cs = c0 * 14 + now.ms * 1.6; drift[0] += dir[0] * cs * sim; drift[1] += dir[1] * cs * sim; env.cloudDrift = drift; phase += (c0 + now.ms * 0.115) * sim; env.cloudPhase = phase;
      env.rainK = [now.wet > 0.02 ? clamp(Math.sqrt(now.rain / 50), 0, 1.15) * (1 - snowAir) : 0, clamp(K.wind / 25, 0, 3.5), dir[0], dir[1]];
      /* lightning, and the far flicker of a power line */
      if (flash) { if (K.freezeFlash) flash.t = 0.03; else flash.t += sim || dt; const f = flashNow(flash), am = engine.renderer.sky.ambient, lum = Math.max(0.5, (am[0] + am[1] + am[2]) / 3 * 9) * flash.power * clamp(1.25 - flash.dist / 9000, 0.3, 1.1), tc = flash.tint; env.flash = [tc[0] * f * lum, tc[1] * f * lum, tc[2] * f * lum, f]; env.flashDir = flash.dir; flash.now = f; if (flash.t > flash.end) { flash = null; env.flash = null; } moving = true; }
      else if (s.bolt && live && K.level) { nextBolt -= sim; if (nextBolt <= 0) { strike(cam); nextBolt = s.bolt * (0.35 + rnd() * 1.3); } }
      else if (w.arc && live && !K.level) { nextArc -= sim; if (nextArc <= 0) { arc(cam); nextArc = w.arc * (0.4 + rnd() * 1.4); } }
      if (aRain) { aRain.volume = clamp(Math.sqrt(now.rain / 60), 0, 1) * 0.55 * (1 - 0.85 * snowAir); aWind.volume = clamp(K.wind / 45, 0, 1) * 0.9 + (K.level || K.windLevel > 1 ? 0.06 : 0); }
      K.now = now; return moving ? 2 : (K.level > 0 && now.rain > 0.05) || now.dust > 0.01 || now.debris > 0.5 || now.ash > 0.01 ? 1 : 0;
    };
    /* drawn over the lit picture, tested against its depth: the far rain, the near rain, the snow, the spray and dust, the debris, the ash and embers, the bolt */
    K.draw = (R, cam) => {
      if (!started || R.refused.has('rain') || R.settings.viewMode !== 'lit') return; const tier = engine.quality, rk = clamp(Math.sqrt(now.rain / 60), 0, 1.1) * (1 - snowAir), nk = now.rain > 0.05 ? clamp(Math.sqrt(now.rain / 14), 0.3, 1.15) * snowAir : 0, sky = R.sky, am = sky.ambient, lc = sky.lightColor, fl = env.flash || [0, 0, 0, 0];
      const pix = 2 / (cam.proj[5] * R.h), time = engine.time.now, light = [am[0] * 2.5 + lc[0] * 0.1 + fl[0] * 0.9 + 0.012, am[1] * 2.5 + lc[1] * 0.1 + fl[1] * 0.9 + 0.013, am[2] * 2.5 + lc[2] * 0.1 + fl[2] * 0.9 + 0.016], WHITE = [1, 1, 1, 0];
      let p = null;
      const layer = (L, ext, n, mode, size, expo, floor, alpha, seed, col) => { if (n < 1) return; const O = offs[L], fo = []; for (let c = 0; c < 4; c++) for (let a = 0; a < 3; a++) { const wd = ext[a] * 2; fo.push(((O[c][a] % wd) + wd) % wd); }
        p.sets({ u_ext: ext, u_vel: vel[L], u_off: fo, u_p: [mode, size, expo, pix], u_q: [time, floor, alpha, seed], u_col: col || WHITE }); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, Math.floor(n)); R.stats.draws++; R.stats.instances += Math.floor(n); R.stats.tris += Math.floor(n) * 2; };
      if (rk > 0.01 || nk > 0.01 || now.spray > 0.01 || now.dust > 0.01 || now.debris > 0.5 || now.ash > 0.01) {
        try { p = dev.program('storm', STORM_VS, STORM_FS); } catch (e) { R.refuse('rain', e); return; }
        dev.bind(R.T.hdrFlatT); dev.state({ depthTest: false, cull: 'none', blend: 'alphaT' }); p.use().sets({ u_viewProj: cam.viewProj, u_view: cam.view, u_camPos: cam.position, u_depth: R.T.depth, u_res: [R.w, R.h], u_nearFar: [cam.near, cam.far], u_light: light, u_mix: [now.roofing, now.frond] }); dev.vao(vao);
        const C = COUNT[tier] || 12000, SP = SPRAY[tier] || 300, hw = 0.0012 + (STORM[K.level].dropMm || 1.4) * 0.0006, gy = o.ground ? o.ground() : 0;
        if (rk > 0.01) { layer(0, [44, 26, 44], C * rk * 0.75, 0, hw * 1.3, 0.033, 0, 0.36, 1); layer(0, [15, 10, 15], C * rk, 0, hw, 0.033, 0, 0.6, 2); }
        if (nk > 0.01) { const SNOW = [1.5, 1.55, 1.65, 0]; layer(3, [40, 24, 40], C * nk * 0.8, 3, 0.02, 0.033, 0, 0.8, 6, SNOW); layer(3, [13, 9, 13], C * nk * 0.55, 3, 0.011, 0.033, 0, 0.95, 7, SNOW); }
        if (rk > 0.4) layer(1, [26, 0.42, 26], SP * 0.7 * rk, 1, 0.42, 0, gy, 0.06 * rk, 5);   /* heavy rain: spray standing just above the pavement */
        if (now.spray > 0.01 && rk > 0.01) layer(1, [72, 9, 72], SP * 0.6 * now.spray, 1, 2.1, 0, gy, 0.02 + 0.035 * now.spray, 3);
        if (now.dust > 0.01) layer(1, [80, 7, 80], SP * 0.75 * now.dust, 1, 2.6, 0, gy, 0.03 + 0.05 * now.dust, 8, [1.25, 1.02, 0.72, 0]);   /* dust lifted off dry ground */
        if (now.debris > 0.5) layer(2, [64, 22, 64], now.debris * (DEBRIS[tier] || 0.5), 2, 0.085, 0, gy, 1, 4, [K.level ? 1 : 0.35, 1, 1, 0]);   /* in the dry season the leaves in the air are mostly brown */
        if (now.ash > 0.01) layer(4, [34, 22, 34], C * 0.05 * now.ash, 3, 0.012, 0.033, 0, 0.8, 9, [0.75, 0.74, 0.72, 0]);
        if (now.ember > 0.01) { const e = Math.max(0.6, (am[0] + am[1] + am[2]) * 3) * 9; layer(5, [50, 12, 50], SP * 0.5 * now.ember, 4, 0.016, 0.033, 0, 1, 10, [e, e * 0.36, e * 0.05, 1]); }
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
    /* the world moved its origin: a bolt's path was in the old one */
    K.reset = () => { flash = null; env.flash = null; };
    /* The facts of what is set, for a reader and for the roof views. Speeds in mph, rain in mm an hour, heights in metres above sea level. */
    K.info = () => {
      const s = STORM[K.level], w = WIND[K.windLevel], sk = SKY[K.sky], n1 = v => +(+v).toFixed(1), ft = m => m == null ? null : Math.round(m * 3.28084 / 100) * 100, wet = K.level > 0, mph = Math.max(s.mph, w.mph), gust = Math.max(s.gust, w.gust), fly = !!s.fly && w.fly;
      const camM = K.y0 != null && engine.camera ? K.y0 + engine.camera.position[1] : null, grdM = K.y0 != null ? K.y0 + (o.ground ? o.ground() : 0) : null, snowGround = wet && grdM != null && K.snowLine != null ? clamp((grdM - (K.snowLine - 40)) / 80, 0, 1) : 0;
      const precip = !wet ? 'none' : snowGround > 0.66 ? 'snow' : snowGround > 0.33 ? 'rain and snow' : 'rain', skyOn = K.sky && !K.held;
      const visKm = Math.min(s.visKm == null ? 99 : s.visKm / (1 + 1.2 * snowGround), skyOn && sk.vis ? (K.sky === 1 ? lerp(40, sk.vis, 1 - (K.burn || 0)) : sk.vis) : 99, !wet && w.dust ? 3.912 / (0.00014 + 0.0005 * w.dust * w.dust) / 1000 : 99);
      const parts = [];
      if (wet) parts.push(`${s.l}: wind drawn at ${s.mph} mph gusting ${s.gust}, ${precip === 'snow' ? 'snow' : precip === 'rain' ? 'rain' : 'rain and snow'} at ${s.rain} mm an hour (${s.rainIn} in)${K.snowLine != null ? `, snow above ${Math.round(K.snowLine).toLocaleString('en-US')} m (${ft(K.snowLine).toLocaleString('en-US')} ft)${grdM == null ? ', not drawn here: the height of this ground is not known' : ''}` : ''}`);
      if (K.windLevel) parts.push(`${w.l} (${K.windName || 'Santa Ana'}): ${w.mph} mph gusting ${w.gust}, dry air`);
      if (K.sky) parts.push(sk.l + (K.held ? ' (' + K.held + ')' : K.sky === 1 && K.burn > 0.05 ? (K.burn > 0.95 ? ' (burned off at this hour)' : ' (burning off)') : ''));
      if (!parts.length) parts.push('Dry and calm');
      return { level: K.level, key: s.k, name: s.l, short: s.s, ar: s.ar || 0, ivt: s.ivt || null, cw3e: s.cw3e || '', mph: s.mph, gust: s.gust, rain: s.rain, rainIn: s.rainIn, bolt: s.bolt || 0, dropMm: +s.dropMm.toFixed(2), fall: n1(s.fall), note: s.note,
        snowLevelM: K.snowLine, snowLevelFt: ft(K.snowLine), snowLevelStepM: s.snow, snowForced: K.snowOver != null, elevationM: grdM == null ? null : Math.round(grdM), cameraM: camM == null ? null : Math.round(camM), precip, snowCover: +now.snow.toFixed(2) * (snowGround > 0.5 ? 1 : 0), snowInAir: +(K.snowAir || 0).toFixed(2), pond: +now.pond.toFixed(2),
        wind: { level: K.windLevel, key: w.k, name: w.l, short: w.s, local: K.windName || 'Santa Ana', mph: w.mph, gust: w.gust, fly: w.fly, note: w.note },
        sky: { level: K.sky, key: sk.k, name: sk.l, short: sk.s, on: !!skyOn, held: K.held, burn: +(K.burn || 0).toFixed(2), note: sk.note },
        /* what a roof here is under: the stronger of the two winds, and the rain that reaches it */
        sustainedMph: mph, gustMph: gust, rainMmH: precip === 'snow' ? 0 : s.rain, rainInH: precip === 'snow' ? 0 : s.rainIn, snowing: precip !== 'rain' && precip !== 'none', windNowMph: n1((K.wind || 0) / 0.44704), windToward: Math.round(((now.bear % 360) + 360) % 360), visKm: visKm >= 99 ? null : +visKm.toFixed(2),
        fly, flyWhy: fly ? '' : !s.fly ? 'past light rain' : `gusts over the ${Math.round(ALTA_GUST_MS / 0.44704)} mph taken as its wind limit`, altaGustLimitMph: Math.round(ALTA_GUST_MS / 0.44704), flash: !!flash, text: parts.join('. ') + '. ' + (fly ? 'The Alta X can fly.' : 'The Alta X stays down.') };
    };
    K.strike = cam => strike(cam); K.arc = cam => arc(cam);   /* for tests */
    K.dispose = () => { gl.deleteVertexArray(vao); gl.deleteBuffer(quad); gl.deleteVertexArray(bvao); gl.deleteBuffer(bbuf); };
    return K;
  }
  SE.StormKit = StormKit;

