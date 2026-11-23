  /* ---------- the roof views of the Scout Engine: plane by plane ---------- */
  /* The engine cuts every roof near the camera into small triangles and asks, for each corner, what to draw there. It
     tells what it knows of the place: the plane's normal, how near the corner is to an eave, a roof corner or a ridge
     (ASCE 7 puts the hardest uplift there; on the ground IBHS found shingle damage after two 2008 storms about as often
     in the middle of a slope as along its edge, rarer but worse at corners, with hip and ridge caps the first thing
     lost, so the views lean on ridges and hips and only a little on edges), how much of the sun a tree or a neighbour
     blocks there at this hour, whether a crown hangs over it, and how light the roof shows in the photograph. The
     answers are numbers on fixed scales, so two roofs, two hours and two years compare. Row picks the colours. Marks are
     specks the engine scatters: 1 cover lost to wind, 2 hail hits, 3 worn patches, 4 moss or algae, 5 rust (and, in the
     Fire view, where embers lodge), 6 a leak; from 7 up the mark is the covering's own pattern. */
  const LENS_T = [40, 200];   /* the thermal scale, degrees Fahrenheit */
  const LENS_ROW = { thermal: 0, wear: 1, wind: 2, hail: 3, wear_t: 4, rain: 5, leak: 5, rust: 6, algae: 7, shingle: 8, metal: 9, tile: 10, low: 11, flat: 11, lowmf: 11, lowW: 12, mh: 13, mbldg: 14, tab3: 15, lam: 16, other: 17, storm: 18, wood: 19, fire: 20, fclass: 21, snow: 22, solar: 23, tileC: 24 };
  const LENS_PAL = [
    ['#05061a', '#1a0f5c', '#5b1392', '#a01d86', '#d53f58', '#f0752a', '#f9b223', '#fde96a', '#ffffff'],                /* heat: the ironbow of a thermal camera */
    ['#1d6b4a', '#4f9a4a', '#a8bf3f', '#f0c53a', '#ee8a2e', '#d94a2a', '#8c1d3a'],                                      /* wear: sound to worn out */
    ['#0c2233', '#12507a', '#1f86c9', '#58c0ff', '#d6f1ff'],                                                            /* wind */
    ['#1e1233', '#4a2584', '#8448d6', '#c08cff', '#f1e2ff'],                                                            /* hail */
    ['#33210c', '#7a4a12', '#c9801f', '#ffb347', '#fff0cf'],                                                            /* heat, sun and age */
    ['#0c2e2c', '#136b66', '#1fb3a8', '#6fe6da', '#dcfffb'],                                                            /* rain and leaks */
    ['#2e140c', '#7a2e13', '#c4501f', '#f0845a', '#ffe1d4'],                                                            /* rust */
    ['#16260f', '#35591f', '#5d9134', '#9fd06a', '#e9ffd4'],                                                            /* moss and algae */
    ['#2b3140', '#56627a', '#93a5cc'],                                                                                  /* covering: asphalt shingles */
    ['#0f3340', '#1f7f9a', '#62d6f0'],                                                                                  /* covering: metal on a house */
    ['#40180c', '#a8451f', '#f38d4c'],                                                                                  /* covering: clay tile */
    ['#2a2233', '#5d4a78', '#a98fd6'],                                                                                  /* covering: a dark low slope roof (cap sheet, built up, modified bitumen) */
    ['#5a5f66', '#b4bcc6', '#f5f8fb'],                                                                                  /* covering: a white membrane or cool coating */
    ['#33300f', '#7d7526', '#d9ce58'],                                                                                  /* covering: a manufactured home roof */
    ['#0f3326', '#218a63', '#63e0b0'],                                                                                  /* covering: metal building panels */
    ['#101c3a', '#2a57c0', '#82abff'],                                                                                  /* shingle style: three tab */
    ['#3a2408', '#c07a14', '#ffc85c'],                                                                                  /* shingle style: laminated */
    ['#1c1f24', '#3b4048', '#6a717c'],                                                                                  /* not shingles */
    ['#10202c', '#235a7a', '#d9c23a', '#ea7a28', '#cf2a22', '#7e1040'],                                                 /* the weather on the scales: untouched to stripped */
    ['#2e2114', '#6e4f2c', '#b98a52'],                                                                                  /* covering: wood shakes */
    ['#2a0d06', '#7a1f0c', '#d8421a', '#ff8a3c', '#ffe3b0'],                                                            /* wildfire */
    ['#1f7a4d', '#7fb23f', '#e6c53a', '#ea7a28', '#b3261e'],                                                            /* fire class: Class A to unrated */
    ['#0d1b2e', '#27507e', '#6fa3d8', '#cfe4f7', '#ffffff'],                                                            /* snow load: none to the design load */
    ['#141433', '#3b2f7d', '#8a4a9c', '#d9725a', '#f7c14a', '#fff7c2'],                                                 /* the sun a plane takes in a year */
    ['#3a2a22', '#8a6a58', '#cdb3a2'],                                                                                  /* covering: concrete tile */
  ];
  const CAUSE_COL = { wind: '#58c0ff', hail: '#c08cff', wear: '#ffb347', rain: '#6fe6da', leak: '#6fe6da', rust: '#f0845a', algae: '#9fd06a', fire: '#ff8a3c' };
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const faceOf = n => (n[1] > 0.985 ? 'level' : 'faces ' + compass((deg(Math.atan2(n[0], -n[2])) + 360) % 360));
  /* Laminated (architectural, dimensional) shingles' share of the asphalt shingles sold in the United States, by year:
     7 percent in 1984 and 23 in 1994 (Elcor's annual reports), 27 in 1996, 36 in 1998, 46 in 2000 and 59 in 2003 (GAF's),
     over 65 in 2006 (ElkCorp), 70 in 2010 (Fine Homebuilding), about 86 over 2015 to 2020, 91 in 2021, 93 in 2022 and
     2023 and 95 in 2024 and 2025 (Owens Corning; only the 95 is printed: its chart has no labels and gives 2015 to 2020
     as one average, which is spread here from 83 to 89, a judgment). 1980 is 5 (ARMA, at second hand) and is held for
     every year before it; 2002, 2004 and 2006 sit between two readings each; 2011 to 2014 were not found and are drawn
     straight between. The rest of each year's shingles are three tab strips. These are national figures: no split for
     California was found. Sacramento's permits name the shingle outright ("30yr Laminated Dimensional Composition"). */
  const LAM = [[1980, 0.05], [1984, 0.07], [1994, 0.23], [1996, 0.27], [1998, 0.36], [2000, 0.46], [2002, 0.53], [2003, 0.59], [2004, 0.61], [2006, 0.66], [2010, 0.70], [2015, 0.83], [2018, 0.86], [2021, 0.91], [2022, 0.93], [2023, 0.93], [2024, 0.95], [2025, 0.95]];
  const lamAt = y => { if (y <= LAM[0][0]) return LAM[0][1]; for (let i = 1; i < LAM.length; i++) if (y <= LAM[i][0]) { const a = LAM[i - 1], c = LAM[i]; return a[1] + (c[1] - a[1]) * (y - a[0]) / (c[0] - a[0]); } return LAM[LAM.length - 1][1]; };
  /* a roof's age today as a spread of chances, from the outlook's clock (O.older(n): the chance it is more than n years old), or its one likely age without one */
  function ageSpread(b, O, max) {
    const out = []; max = max || 90;
    if (O && O.older) { let prev = 1; for (let a = 0; a <= max; a++) { const nx = a === max ? 0 : clamp(O.older(a), 0, prev), w = prev - nx; if (w > 1e-5) out.push([a, w]); prev = nx; } }
    if (!out.length) out.push([clamp(Math.round((b.state && b.state.age) || 15), 0, max), 1]);
    const t = out.reduce((s, x) => s + x[1], 0) || 1; out.forEach(x => { x[1] /= t; }); return out;
  }
  /* which shingle: the chance it is laminated, by the years it may have gone on */
  function styleOf(b, O) { const sp = ageSpread(b, O); let lam = 0, yr = 0; sp.forEach(([a, w]) => { lam += w * lamAt(THIS_YEAR - a); yr += w * (THIS_YEAR - a); }); return { lam: clamp(lam, 0, 1), year: Math.round(yr) }; }
  /* The coverings the views tell apart: the row of colours each takes, and the pattern the Scout Engine draws in the plane
     of the roof, each at one common size of that covering: 7 three tab strips, 8 laminated shingles, 9 standing seam
     (seams at 16 inches), 10 ribbed panels with their screws showing, 11 barrel (mission) clay tile, 13 a white
     membrane (10 ft sheets), 14 a cap sheet or other dark roll roofing (metre wide rolls); and, where the engine
     carries California's patterns (ENGX.pat), 15 flat concrete tile (13 inches to the weather, 12 wide, courses broken
     half a tile), 16 S tile (the one piece clay or concrete S: 13 inch courses, crowns at 11 3/4 inches), 17 wood shakes
     (10 inch exposure, shakes 4 to 12 inches wide), 18 a gravel surfaced built up roof and 19 rooftop solar panels.
     Without them the nearest older pattern stands in. Sizes are from makers' data sheets. */
  const ENGX = { pat: 14 };   /* the highest pattern number the engine in the page can draw; the engine bar reads it from the engine */
  const patOf = p => (p <= ENGX.pat ? p : p === 15 || p === 16 ? 11 : p === 17 ? 8 : p === 18 ? 14 : 14);
  const COVER = {
    shingle: { row: 8, pat: 8, l: 'Asphalt shingles', s: 'shingles' },
    tile: { row: 10, pat: 16, l: 'Tile (clay or concrete)', s: 'tile', d: 'clay more often than concrete by the survey; drawn as S tile, or flat tile where concrete is the likelier' },
    wood: { row: 19, pat: 17, l: 'Wood shakes or shingles', s: 'wood shakes' },
    metal: { row: 9, pat: 9, l: 'Metal on a house', s: 'metal', d: 'drawn as standing seam; the records cannot tell it from ribbed panels or stone coated steel' },
    flat: { row: 11, pat: 14, l: 'Low slope roof on a house', s: 'a low slope roof', d: 'cap sheet, built up or single ply' },
    low: { row: 11, pat: 14, l: 'Low slope membrane', s: 'membrane' }, lowmf: { row: 11, pat: 14, l: 'Low slope membrane', s: 'membrane' },
    mh: { row: 13, pat: 10, l: 'Manufactured home roof', s: 'manufactured home roof', d: 'metal on older single wides, shingles on pitched double wides; drawn as ribbed metal' },
    mbldg: { row: 14, pat: 10, l: 'Metal building panels', s: 'metal panels', d: 'ribbed panels, their screws showing' },
  };
  const COVER_KEY = [['shingle', 'Asphalt shingles'], ['tile', 'Clay tile'], ['tileC', 'Concrete tile'], ['wood', 'Wood shakes or shingles'], ['metal', 'Metal on a house'], ['low', 'Low slope, dark (cap sheet, built up, modified bitumen)'], ['lowW', 'Low slope, white (TPO, PVC or a cool coating)'], ['mh', 'Manufactured home roof'], ['mbldg', 'Metal building panels']];
  const isLowK = k => k === 'low' || k === 'lowmf' || k === 'flat';
  const coverRow = (k, lum) => (isLowK(k) && isN(lum) && lum >= 0.55 ? 12 : (COVER[k] || COVER.shingle).row);
  const photoWord = lum => (!isN(lum) ? '' : lum < 0.3 ? 'dark' : lum < 0.42 ? 'mid toned' : lum < 0.58 ? 'light' : 'very light');

  /* ---------- the weather on the engine's scales, and what it would do to a roof ---------- */
  /* Two scales and a sky, as the Scout Engine runs them. The rain scale: dry, light rain, rain, a thunderstorm, and
     atmospheric rivers of rank 1 to 5 on the scale of Ralph and others (2019: the rank is set by the water vapour a
     storm carries and how long it stays, not by wind or rain at a street). The dry wind scale: calm, a breeze, and
     four steps of offshore wind (Santa Ana in the south, Diablo in the north) from an advisory to an extreme day. For
     the roof readings each step needs a gust and, for rain, a share of a year's leaks; the engine's own figures are
     used when it gives them, else these: gusts in mph, a judgment anchored on the Weather Service's usual criteria (a wind
     advisory from gusts of 46 mph, a high wind warning from 58) and on January 7, 2025, when Burbank Airport gusted
     to 84 mph and Saddle Peak to 98 (NOAA Storm Events). leak: the share of a year's leak calls a storm of that step
     brings (a judgment, grade D: no count of leak claims by storm was found; the one demand record is that Los
     Angeles issued 40 percent more re-roof permits in 2023, after the wet winter of 2022 to 2023, than in
     2022). swe: inches of water the storm leaves as snow above its snow level (judgment), and snowM that level in
     metres (warm, strong atmospheric rivers snow high). */
  const WX_RAIN = [
    { id: 'dry', l: 'Dry', t: 'Dry', gust: 0, leak: 0, swe: 0, snowM: 0 },
    { id: 'light', l: 'Light rain', t: 'Light', gust: 10, leak: 0.03, swe: 0.2, snowM: 1700 },
    { id: 'rain', l: 'Rain', t: 'Rain', gust: 20, leak: 0.10, swe: 0.8, snowM: 1600 },
    { id: 'tstorm', l: 'Thunderstorm', t: 'T-storm', gust: 50, leak: 0.08, swe: 0.4, snowM: 2400 },
    { id: 'ar1', l: 'Atmospheric river, rank 1 (weak)', t: 'AR 1', gust: 25, leak: 0.10, swe: 1.0, snowM: 1700 },
    { id: 'ar2', l: 'Atmospheric river, rank 2 (moderate)', t: 'AR 2', gust: 35, leak: 0.18, swe: 2.0, snowM: 1800 },
    { id: 'ar3', l: 'Atmospheric river, rank 3 (strong)', t: 'AR 3', gust: 45, leak: 0.30, swe: 3.5, snowM: 2000 },
    { id: 'ar4', l: 'Atmospheric river, rank 4 (extreme)', t: 'AR 4', gust: 55, leak: 0.45, swe: 5.5, snowM: 2200 },
    { id: 'ar5', l: 'Atmospheric river, rank 5 (exceptional)', t: 'AR 5', gust: 65, leak: 0.60, swe: 8.0, snowM: 2400 },
  ];
  const WX_WIND = [
    { id: 'calm', l: 'Calm', t: 'Calm', gust: 0 },
    { id: 'breeze', l: 'Breeze', t: 'Breeze', gust: 20 },
    { id: 'sa1', l: 'Offshore wind: advisory', t: 'Advisory', gust: 46 },
    { id: 'sa2', l: 'Offshore wind: high wind warning', t: 'Warning', gust: 62 },
    { id: 'sa3', l: 'Offshore wind: damaging', t: 'Damaging', gust: 78 },
    { id: 'sa4', l: 'Offshore wind: extreme', t: 'Extreme', gust: 95 },
  ];
  const WX_SKY = [['clear', 'Clear'], ['marine', 'Marine layer'], ['tule', 'Tule fog'], ['smoke', 'Wildfire smoke']];
  const rainStep = id => WX_RAIN.find(x => x.id === id) || WX_RAIN[0], windStep = id => WX_WIND.find(x => x.id === id) || WX_WIND[0];
  /* what the scales stand at: the engine bar keeps this as it sets them, and the engine's own word is read when it gives one */
  const WXNOW = { rain: 'dry', wind: 'calm', sky: 'clear', elev: null, engine: false };
  const stepId = (s, list) => (s && typeof s === 'object' && list.some(x => x.id === s.id) ? s.id : typeof s === 'string' && list.some(x => x.id === s) ? s : null);
  const gustOf = (own, eng) => { const g = eng && isN(+eng.gust) && +eng.gust > 5 && +eng.gust < 200 ? +eng.gust : null; return g != null ? g : own.gust; };
  function wxResolve(ctx) {
    ctx = ctx || {}; const rid = stepId(ctx.stormStep, WX_RAIN) || WXNOW.rain, wid = stepId(ctx.windStep, WX_WIND) || WXNOW.wind, r = rainStep(rid), w = windStep(wid);
    const rg = gustOf(r, stepId(ctx.stormStep, WX_RAIN) ? ctx.stormStep : null), wg = gustOf(w, stepId(ctx.windStep, WX_WIND) ? ctx.windStep : null), sky = (typeof ctx.sky === 'string' && WX_SKY.some(x => x[0] === ctx.sky) ? ctx.sky : WXNOW.sky) || 'clear';
    const snowM = ctx.stormStep && isN(+ctx.stormStep.snowLevel) && +ctx.stormStep.snowLevel > 0 ? +ctx.stormStep.snowLevel : r.snowM;
    return { rain: r, wind: w, sky, gust: Math.max(rg, wg), rainGust: rg, windGust: wg, snowM, elev: isN(ctx.elev) ? +ctx.elev : WXNOW.elev };
  }
  /* The share of roofs a day with that gust damages enough for a roofer (shingles of average age, one story): the atlas's
     stated rates at 58 and 75 mph (OC.wind), drawn through as a straight line on a log scale and carried on to 100 mph
     and back to 40 on the same line; nothing below 40, never over 5 percent. Past 75 mph it is an extrapolation with no
     count behind it: California's reports say "countless roofs" (October 21, 2007, gusts over 70 mph) and give no
     number. Grade D. */
  const gustDmg = mph => { if (!(mph >= 40)) return 0; const a = OC.wind[0][0], b2 = OC.wind[1][0], k = Math.log(b2 / a) / 17; return Math.min(0.05, a * Math.exp(k * (mph - 58))); };
  const gustRepl = mph => clamp(0.2 + (mph - 58) * 0.2 / 17, 0.1, 0.7);
  /* The fire class a roof most likely carries as an assembly, [Class A, Class B, Class C, unrated], by covering and by
     the age of the roof. Anchors: about 90 percent of structures inside the 2025 Palisades and Eaton perimeters had
     Class A coverings by CAL FIRE's inspections and 80 percent of those IBHS examined; clay and concrete tile, metal
     and slate count as Class A assemblies on the decks and underlayments the code names; fiberglass asphalt shingles
     are sold as Class A, the older organic felt shingles as Class C; wood shakes are Class B when pressure treated (A
     over a special underlayment) and unrated when not, and Los Angeles has restricted wood roofs since 1989 and now allows none. The split
     by age (a roof of 30 years or more is likelier to be of the older kind) is a judgment, grade D. */
  const FCLS = {
    shingle: [[0.93, 0.03, 0.04, 0], [0.62, 0.05, 0.33, 0]], tile: [[0.95, 0.03, 0.02, 0], [0.9, 0.05, 0.05, 0]], metal: [[0.92, 0.05, 0.03, 0], [0.88, 0.06, 0.06, 0]],
    wood: [[0.15, 0.65, 0.1, 0.1], [0.02, 0.18, 0.1, 0.7]], flat: [[0.85, 0.1, 0.05, 0], [0.7, 0.15, 0.15, 0]], low: [[0.88, 0.09, 0.03, 0], [0.75, 0.15, 0.1, 0]], lowmf: [[0.88, 0.09, 0.03, 0], [0.75, 0.15, 0.1, 0]],
    mh: [[0.6, 0.1, 0.25, 0.05], [0.45, 0.1, 0.35, 0.1]], mbldg: [[0.92, 0.05, 0.03, 0], [0.88, 0.06, 0.06, 0]],
  };
  function fireClass(b, O) {
    const types = typesOf(b), W = types.reduce((s, x) => s + x[1], 0) || 1, sp = ageSpread(b, O, 90), pOld = sp.reduce((s, [a, w]) => s + (a >= 30 ? w : 0), 0), out = [0, 0, 0, 0];
    types.forEach(([k, w]) => { const F = FCLS[k] || FCLS.shingle; for (let i = 0; i < 4; i++) out[i] += w / W * (F[0][i] * (1 - pOld) + F[1][i] * pOld); });
    return { p: out, pOld, below: clamp(out[1] * 0.4 + out[2] * 0.7 + out[3], 0, 1) };
  }
  /* the class a re-roof here must be: Class A in a Fire Hazard Severity Zone when half the roof or more is replaced in a
     year (the 2025 Wildland-Urban Interface Code, 507.1; the 2022 codes said "more than 50 percent"), and for any part
     repaired or replaced; outside the zones the statute's floor (Health and Safety Code 13132.7: Class C, Class B in
     State Responsibility Areas) */
  const reroofClass = b => (!b.fhsz ? null : b.fhsz.cls >= 1 ? { c: 'A', why: `it stands in a ${b.fhsz.l} Fire Hazard Severity Zone (${b.fhsz.ra === 'SRA' ? 'State' : 'Local'} Responsibility Area)` } : { c: 'C', why: 'it is outside the mapped Fire Hazard Severity Zones (the statute\'s floor; a city may ask more)' });
  /* Ember exposure, an index from 0 to 1 and not a chance: how open a roof is to wind borne embers on a day of dry
     offshore wind. By the zone it stands in (Very High 1, High 0.8, Moderate 0.6, none 0.35: embers carried the 2017
     and 2025 fires past the mapped zones), by how near the record puts fire (inside a perimeter since 1950, or
     structures destroyed within 300 m), by the wind on the scale, and by the roof: its chance of being below Class A,
     with a floor because a Class A roof still takes embers at its edges, vents and gutters (IBHS: only 6 to 10 percent
     of structures in the 2025 fires had vent screens of 1/8 inch or finer). Judgment, grade D. */
  function emberIx(b, fc, gust) {
    const zk = !b.fhsz ? 0.5 : [0.35, 0.6, 0.8, 1][clamp(b.fhsz.cls, 0, 3)], hist = (b.fire && b.fire.nIn ? 0.15 : 0) + (b.near && b.near.dest ? 0.15 : 0), wk = gust >= 40 ? clamp(0.5 + (gust - 40) / 80, 0.5, 1.2) : 0.35;
    return clamp((zk + hist) * wk * (0.3 + 0.7 * fc.below), 0, 1);
  }
  /* The weather now on the scales, on one building: over its coverings and the ages its roof may be, the chance it needs a
     roofer for wind (replaced, repaired), the chance of a leak call in this storm, the snow this storm adds against the
     ground snow load the code designs for there, and its ember exposure when the sky is smoke or the wind is offshore. */
  function wxOnRoof(b, O, wx) {
    const types = typesOf(b), W = types.reduce((s, x) => s + x[1], 0) || 1, sp = ageSpread(b, O, AGE_MAX), st = O ? O.st : 1, hz = O ? O.hz : hazardAt(b.zip || ''), d = gustDmg(wx.gust), rs = gustRepl(wx.gust);
    let rep = 0, fix = 0, leak = 0;
    types.forEach(([k, w]) => { const T = RTYPE[k] || RTYPE.shingle, wk = T.wind * OC.tall(st); sp.forEach(([a, pa]) => { const q = w / W * pa, x = clamp(d * windAgeK(a, T.ageK) * wk, 0, 0.95); rep += q * x * rs; fix += q * x * (1 - rs); leak += q * clamp(repRate(a) * T.leak * (hz ? hz.rainK : 1) * wx.rain.leak, 0, 0.6); }); });
    const z = b.z, pg = wxCol(z, 'snow'), el = wx.elev != null ? wx.elev : wxCol(z, 'elev'), snowing = wx.rain.id !== 'dry' && el != null && wx.snowM > 0 && el >= wx.snowM, add = snowing ? wx.rain.swe * 5.2 : 0;
    const fc = fireClass(b, O), ember = wx.sky === 'smoke' || /^sa/.test(wx.wind.id) ? emberIx(b, fc, wx.windGust) : 0;
    return { rep, fix, any: rep + fix, leak, d, gust: wx.gust, snowing, add, pg, snowR: snowing && pg > 0 ? clamp(add / pg, 0, 1.5) : snowing ? null : 0, el, ember, fc, kind: snowing ? 'snow' : wx.gust >= 40 ? 'wind' : wx.rain.id !== 'dry' ? 'rain' : ember > 0 ? 'ember' : 'dry' };
  }
  /* the sun a plane takes in a normal year, kWh a square metre: the Thermal reading's clear sky sunlight on the plane, hour
     by hour over twelve mid month days, with the sky clear the place's share of the time (clearShare); no shade counted */
  const SUNY = new Map();
  function sunYear(n, la, lo) {
    la = Math.round(la * 10) / 10; lo = Math.round(lo * 10) / 10; const tilt = Math.round(deg(Math.acos(clamp(n[1], -1, 1))) / 5) * 5, az = tilt < 3 ? 0 : Math.round(((deg(Math.atan2(n[0], -n[2])) + 360) % 360) / 22.5) * 22.5, key = [tilt, az, la.toFixed(1), lo.toFixed(1)].join('|'); let v = SUNY.get(key); if (v !== undefined) return v;
    const t = rad(tilt), a = rad(az), nn = [Math.sin(t) * Math.sin(a), Math.cos(t), -Math.sin(t) * Math.cos(a)], cs = clearShare(la, lo); let s = 0;
    for (let m = 0; m < 12; m++) for (let h = 0; h < 24; h++) { const sun = sunAt(MIDDOY[m], h + 0.5, la), sky = clearSky(sun.alt); s += (cs * planeSun(nn, sun, sky, SKYK.clear, 0) + (1 - cs) * planeSun(nn, sun, sky, SKYK.overcast, 0)) * 30.4; }
    v = s / 1000; if (SUNY.size > 6000) SUNY.clear(); SUNY.set(key, v); return v;
  }
  const SUN_SC = [600, 2300];   /* the Solar view's scale, kWh a square metre a year */

