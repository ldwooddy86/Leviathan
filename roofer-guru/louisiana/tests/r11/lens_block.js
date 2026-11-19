  /* ---------- heat: what the sun does to a roof ---------- */
  /* A roof plane's temperature from an energy balance at its surface: the sunlight it absorbs (its slope and bearing
     against the sun, the covering's solar reflectance) leaves as heat carried off by the air (a film coefficient that
     rises with wind) and as long wave radiation to a sky colder than the air (the covering's emittance). Clear sky
     sunlight is Meinel's fit to air mass with Kasten and Young's air mass; the air is the 1991 to 2020 normal for the
     month, blended by distance from seven Louisiana stations, shaped through the day. It is a steady balance: a light roof with a
     vented attic under it follows the sun within minutes. The film is set at 12 W per square metre and
     kelvin, the low end of the 12 to 20 Berdahl and others give for roofs (written below as McAdams's 5.7 + 3.8 v at 1.65
     m/s). It is a calibration, not a measured wind: the air a hand above Florida's test shingles moved at 0.4 m/s, a
     sixth of the mast's speed, and McAdams's film at that speed would put a dark shingle near 190 F. At 12 a dark shingle
     in July sun stands near 170 F over 90 F air, where the Florida Solar Energy Center (179 F at most in a summer), IBHS
     (about 165 F on a June day) and Oak Ridge (165 F) measured it, a white roof near 115 F (Oak Ridge: white painted
     metal, about 115 F) and bare aluminium zinc steel between. */
  const CLIM = [
    /* NOAA NCEI 1991 to 2020 normals, by-station files: daily maximum and minimum by month, degrees Fahrenheit */
    { n: 'New Orleans', lat: 29.9933, lon: -90.2511, hi: [62.5, 66.4, 72.3, 78.5, 85.3, 90.0, 91.4, 91.3, 88.1, 80.6, 71.2, 64.8], lo: [46.1, 49.7, 55.3, 61.7, 69.0, 74.7, 76.5, 76.6, 73.5, 64.3, 53.7, 48.4] },
    { n: 'Baton Rouge', lat: 30.5372, lon: -91.1469, hi: [62.3, 66.6, 73.0, 79.1, 85.8, 90.5, 91.9, 92.2, 88.7, 80.9, 71.0, 64.3], lo: [41.6, 45.3, 51.0, 56.9, 65.1, 71.5, 73.8, 73.3, 68.9, 58.1, 47.8, 43.3] },
    { n: 'Lafayette', lat: 30.2050, lon: -91.9875, hi: [62.2, 66.1, 72.6, 79.0, 85.9, 90.2, 91.5, 92.3, 89.0, 81.3, 71.5, 64.4], lo: [43.5, 47.4, 53.3, 59.3, 67.2, 73.1, 75.1, 74.7, 70.4, 60.1, 50.2, 45.3] },
    { n: 'Lake Charles', lat: 30.1250, lon: -93.2158, hi: [63.0, 66.7, 73.1, 79.0, 85.4, 90.5, 92.2, 92.8, 89.4, 82.1, 72.2, 65.3], lo: [43.4, 47.1, 53.1, 59.3, 67.3, 73.7, 75.6, 75.1, 70.7, 60.4, 50.6, 45.3] },
    { n: 'Alexandria', lat: 31.3928, lon: -92.2956, hi: [59.9, 64.2, 71.5, 78.1, 85.1, 90.8, 93.1, 93.6, 89.2, 80.0, 69.4, 61.9], lo: [36.8, 40.2, 46.8, 53.0, 61.3, 68.2, 71.0, 70.1, 64.6, 52.9, 43.0, 38.3] },
    { n: 'Shreveport', lat: 32.4506, lon: -93.8411, hi: [58.4, 62.6, 70.4, 77.5, 84.6, 91.1, 94.3, 94.9, 89.6, 79.3, 67.9, 59.9], lo: [37.3, 41.0, 47.7, 54.3, 63.5, 70.6, 73.5, 73.0, 67.0, 55.4, 45.3, 39.0] },
    { n: 'Monroe', lat: 32.5156, lon: -92.0406, hi: [57.0, 61.1, 69.1, 76.8, 84.4, 90.5, 93.2, 93.6, 88.7, 78.8, 67.3, 59.0], lo: [36.7, 40.2, 47.2, 54.2, 63.1, 70.1, 72.5, 71.4, 65.5, 53.7, 43.9, 38.6] },
  ];
  const f2c = f => (f - 32) / 1.8, c2f = c => c * 1.8 + 32;
  const climAt = (la, lo) => { let W = 0; const hi = new Array(12).fill(0), lw = new Array(12).fill(0), near = { d: 1e9, n: '' }; CLIM.forEach(s => { const d = meters([la, lo], [s.lat, s.lon]) / 1000, w = 1 / Math.pow(Math.max(d, 8), 2); W += w; for (let m = 0; m < 12; m++) { hi[m] += s.hi[m] * w; lw[m] += s.lo[m] * w; } if (d < near.d) { near.d = d; near.n = s.n; } }); return { hi: hi.map(v => v / W), lo: lw.map(v => v / W), near: near.n }; };
  const climMemo = new Map(), climOf = (la, lo) => { const k = la.toFixed(1) + ',' + lo.toFixed(1); let v = climMemo.get(k); if (!v) { v = climAt(la, lo); climMemo.set(k, v); } return v; };
  /* the air through the day: coolest at six by the sun, warmest at three (degrees Celsius) */
  function airC(la, lo, month, hour) { const c = climOf(la, lo), hi = f2c(c.hi[month]), lw = f2c(c.lo[month]), h = ((hour % 24) + 24) % 24, f = h >= 6 && h <= 15 ? 0.5 - 0.5 * Math.cos(Math.PI * (h - 6) / 9) : 0.5 + 0.5 * Math.cos(Math.PI * ((h < 6 ? h + 24 : h) - 15) / 15); return lw + (hi - lw) * f; }
  /* the sun by the day of the year and the hour by the sun: its height, and its direction as the engine's axes have it (x east, y up, z south) */
  function sunAt(doy, hour, la) { const dec = rad(23.44) * Math.sin(2 * Math.PI * (284 + doy) / 365), ha = rad(15 * (hour - 12)), p = rad(la), sa = Math.sin(p) * Math.sin(dec) + Math.cos(p) * Math.cos(dec) * Math.cos(ha), alt = Math.asin(clamp(sa, -1, 1)), ca = Math.cos(alt) || 1e-9;
    const e = -Math.cos(dec) * Math.sin(ha) / ca, n = (Math.sin(dec) - Math.sin(p) * sa) / (Math.cos(p) * ca || 1e-9); return { alt: deg(alt), dir: [e * ca, sa, -n * ca] }; }
  /* clear sky sunlight on a plane facing the sun, and scattered light on level ground (W per square metre) */
  function clearSky(altDeg) { if (!(altDeg > 0)) return { dn: 0, dh: 0 }; const am = 1 / (Math.sin(rad(altDeg)) + 0.50572 * Math.pow(altDeg + 6.07995, -1.6364)), dn = 1353 * Math.pow(0.7, Math.pow(am, 0.678)); return { dn, dh: 0.1 * dn }; }
  /* what the engine's weather does to that sunlight: the share of the direct beam that arrives, and the scattered light as a share of the clear beam */
  const SKYK = { clear: [1, 0.1], haze: [0.75, 0.17], cloudy: [0.5, 0.26], overcast: [0.08, 0.3], rain: [0.04, 0.2] };
  const SIGMA = 5.670374e-8;
  /* the surface temperature (Celsius) of a plane that absorbs q watts per square metre of sunlight: emittance e, air ta, wind v (m/s), sky colder than the air by dsky */
  function surfaceC(q, e, ta, v, dsky) { const hc = 5.7 + 3.8 * (isN(v) ? v : 1.65), Ta = ta + 273.15, Ts4 = Math.pow(Ta - (isN(dsky) ? dsky : 10), 4); let T = Ta + q / (hc + 6); for (let i = 0; i < 6; i++) { const f = hc * (T - Ta) + e * SIGMA * (Math.pow(T, 4) - Ts4) - q, d = hc + 4 * e * SIGMA * T * T * T; T -= f / d; } return T - 273.15; }
  /* how much sunlight each covering sends back (dark to light) and how well it sheds heat as radiation, as measured:
     shingles 0.03 to 0.10 dark, 0.12 to 0.22 mid, 0.25 to 0.31 white, emittance 0.91 (Florida Solar Energy Center);
     painted metal 0.06 to 0.13 dark, 0.55 to 0.69 white, emittance 0.83 to 0.90; clay tile about 0.35, concrete tile 0.16
     to 0.25, slate 0.1 to 0.2; membranes from dark modified bitumen at 0.08 to white TPO and PVC at 0.70 after three years
     (Cool Roof Rating Council; less where the Gulf's damp soils them); bare 55 percent aluminium zinc steel reflects
     0.65 but its emittance is only 0.08 to 0.28 (Oak Ridge; Florida Solar Energy Center), so it runs hotter than its brightness suggests, and metal
     building roofs here are a mix of that and paint */
  const ROOFOPT = { shingle: { sr: [0.04, 0.26], e: 0.91 }, metal: { sr: [0.08, 0.62], e: 0.85 }, tile: { sr: [0.12, 0.4], e: 0.9 }, mh: { sr: [0.2, 0.65], e: 0.8 }, low: { sr: [0.08, 0.68], e: 0.88 }, lowmf: { sr: [0.08, 0.68], e: 0.88 }, mbldg: { sr: [0.25, 0.62], e: 0.4 } };
  /* the reflectance a roof most likely has: the middle of its covering's range, moved by how light the roof shows in the
     satellite photo (lum, 0 to 1 as displayed; the photo's brightness is not a measurement, so it only places the roof within the range) */
  function reflectOf(type, lum) { const r = (ROOFOPT[type] || ROOFOPT.shingle).sr; if (!isN(lum)) return r[0] + (r[1] - r[0]) * 0.35; const t = clamp((lum - 0.22) / 0.5, 0, 1); return r[0] + (r[1] - r[0]) * t * t * (3 - 2 * t); }
  const optOf = (types, lum) => { let sr = 0, e = 0, W = 0; types.forEach(([k, w]) => { const o = ROOFOPT[k] || ROOFOPT.shingle; sr += reflectOf(k, lum) * w; e += o.e * w; W += w; }); return W ? { sr: sr / W, e: e / W } : { sr: 0.12, e: 0.9 }; };
  /* sunlight on a plane (normal n, unit length): direct by the cosine, scattered light by how much sky it sees, a little off the ground */
  const planeSun = (n, sun, sky, k, shade) => { const cs = Math.max(0, n[0] * sun.dir[0] + n[1] * sun.dir[1] + n[2] * sun.dir[2]), up = (1 + n[1]) / 2, gh = sky.dn * k[0] * Math.max(0, sun.dir[1]) + sky.dn * k[1]; return sky.dn * k[0] * cs * (1 - (shade || 0)) + sky.dn * k[1] * up + 0.2 * gh * (1 - up); };
  /* how fast heat ages a plane over a normal year, against a plane held at 25 C: the rate doubles for each 10 C (the rule of
     thumb for the oxidation that hardens asphalt and plastics), averaged over every hour of twelve mid month days with the
     sky clear six tenths of the time (Louisiana's share of possible sunshine). No shade is counted: the yearly rate
     knows the plane's slope, its bearing and the roof's colour, not the trees round it. */
  const HEATM = new Map(), MIDDOY = [15, 46, 75, 106, 136, 167, 197, 228, 259, 289, 320, 350];
  function heatRate(sr, e, n, la, lo) {
    /* the answer is for the rounded place and colour the memo is keyed by (half a degree; a hundredth), so it does not depend on which roof asked first */
    sr = Math.round(sr * 100) / 100; e = Math.round(e * 100) / 100; la = Math.round(la * 2) / 2; lo = Math.round(lo * 2) / 2;
    const tilt = Math.round(deg(Math.acos(clamp(n[1], -1, 1))) / 5) * 5, az = tilt < 3 ? 0 : Math.round(((deg(Math.atan2(n[0], -n[2])) + 360) % 360) / 22.5) * 22.5, key = [sr.toFixed(2), e.toFixed(2), tilt, az, la.toFixed(1), lo.toFixed(1)].join('|'); let v = HEATM.get(key); if (v !== undefined) return v;
    const t = rad(tilt), a = rad(az), nn = [Math.sin(t) * Math.sin(a), Math.cos(t), -Math.sin(t) * Math.cos(a)]; let s = 0, c = 0;
    for (let m = 0; m < 12; m++) for (let h = 0; h < 24; h++) { const sun = sunAt(MIDDOY[m], h + 0.5, la), sky = clearSky(sun.alt), ta = airC(la, lo, m, h + 0.5);
      [[SKYK.clear, 0.6, 10], [SKYK.overcast, 0.4, 3]].forEach(([k, w, ds]) => { const T = surfaceC((1 - sr) * planeSun(nn, sun, sky, k, 0), e, ta, 1.65, ds); s += w * Math.pow(2, (T - 25) / 10); c += w; }); }
    v = s / c; if (HEATM.size > 4000) HEATM.clear(); HEATM.set(key, v); return v;
  }
  /* the average roof of a kind here: a 6 in 12 slope facing every way in turn (2 degrees for the low slope kinds), about a
     third of the way up its range of colours */
  const heatRef = (type, la, lo) => { const o = ROOFOPT[type] || ROOFOPT.shingle, sr = reflectOf(type, null), low = type === 'low' || type === 'lowmf' || type === 'mbldg', t = rad(low ? 2 : 26.6); let s = 0; for (let k = 0; k < 8; k++) { const a = rad(k * 45); s += heatRate(sr, o.e, [Math.sin(t) * Math.sin(a), Math.cos(t), -Math.sin(t) * Math.cos(a)], la, lo); } return s / 8; };

  /* ---------- the roof views of the Scout Engine: heat, wear, and the next fifteen years, plane by plane ---------- */
  /* The engine cuts every roof near the camera into small triangles and asks, for each corner, what to draw there. It
     tells what it knows of the place: the plane's normal, how near the corner is to an eave, a roof corner or a ridge
     (ASCE 7 puts the hardest uplift there; on the ground IBHS found shingle damage after Gustav and Ike about as often in
     the middle of a slope as along its edge, rarer but worse at corners, with hip and ridge caps the first thing lost, so
     the views lean on ridges and hips and only a little on edges), how much of the sun a
     tree or a neighbour blocks there at this hour, whether a crown hangs over it, and how light the roof shows in the
     photograph. The answers are numbers on fixed scales, so two roofs, two hours and two years compare. Row picks the
     colours: 0 heat, 1 wear, 2 and up one cause each. Marks are specks the engine scatters: 1 tabs lost to wind, 2 hail
     hits, 3 worn patches, 4 algae streaks, 5 rust, 6 a leak. */
  const LENS_T = [40, 200];   /* the thermal scale, degrees Fahrenheit */
  const LENS_ROW = { thermal: 0, wear: 1, hur: 2, ts: 2, hail: 3, wear_t: 4, leak: 5, rust: 6, algae: 7, shingle: 8, metal: 9, tile: 10, low: 11, lowW: 12, mh: 13, mbldg: 14, tab3: 15, lam: 16, other: 17, storm: 18 };
  const LENS_PAL = [
    ['#05061a', '#1a0f5c', '#5b1392', '#a01d86', '#d53f58', '#f0752a', '#f9b223', '#fde96a', '#ffffff'],                /* heat: the ironbow of a thermal camera */
    ['#1d6b4a', '#4f9a4a', '#a8bf3f', '#f0c53a', '#ee8a2e', '#d94a2a', '#8c1d3a'],                                      /* wear: sound to worn out */
    ['#0c2233', '#12507a', '#1f86c9', '#58c0ff', '#d6f1ff'],                                                            /* wind */
    ['#1e1233', '#4a2584', '#8448d6', '#c08cff', '#f1e2ff'],                                                            /* hail */
    ['#33210c', '#7a4a12', '#c9801f', '#ffb347', '#fff0cf'],                                                            /* heat, sun and age */
    ['#0c2e2c', '#136b66', '#1fb3a8', '#6fe6da', '#dcfffb'],                                                            /* leaks */
    ['#2e140c', '#7a2e13', '#c4501f', '#f0845a', '#ffe1d4'],                                                            /* rust */
    ['#16260f', '#35591f', '#5d9134', '#9fd06a', '#e9ffd4'],                                                            /* algae */
    ['#2b3140', '#56627a', '#93a5cc'],                                                                                  /* covering: asphalt shingles */
    ['#0f3340', '#1f7f9a', '#62d6f0'],                                                                                  /* covering: metal on a house */
    ['#40180c', '#a8451f', '#f38d4c'],                                                                                  /* covering: tile or slate */
    ['#2a2233', '#5d4a78', '#a98fd6'],                                                                                  /* covering: a dark membrane */
    ['#5a5f66', '#b4bcc6', '#f5f8fb'],                                                                                  /* covering: a white membrane */
    ['#33300f', '#7d7526', '#d9ce58'],                                                                                  /* covering: a manufactured home roof */
    ['#0f3326', '#218a63', '#63e0b0'],                                                                                  /* covering: metal building panels */
    ['#101c3a', '#2a57c0', '#82abff'],                                                                                  /* shingle style: three tab */
    ['#3a2408', '#c07a14', '#ffc85c'],                                                                                  /* shingle style: laminated */
    ['#1c1f24', '#3b4048', '#6a717c'],                                                                                  /* not shingles */
    ['#10202c', '#235a7a', '#d9c23a', '#ea7a28', '#cf2a22', '#7e1040'],                                                 /* a storm: untouched to stripped */
  ];
  const CAUSE_COL = { hur: '#58c0ff', ts: '#58c0ff', wind: '#58c0ff', hail: '#c08cff', wear: '#ffb347', leak: '#6fe6da', rust: '#f0845a', algae: '#9fd06a' };
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const faceOf = n => (n[1] > 0.985 ? 'level' : 'faces ' + compass((deg(Math.atan2(n[0], -n[2])) + 360) % 360));
  /* the storms today's roof has most likely been through: each storm year of 50 knots or more at the ZIP, by the chance the
     roof was already on (older: the chance today's roof is more than that many years old, from the spread of its ages),
     with the share of the ZIP's roofs that year cost, as the outlook counts it */
  function stormsSeen(zip, older) { const out = []; stormsAt(zip).forEach(s => { const x = s.list[0]; if (!x || x.kt < 50) return; const ago = THIS_YEAR - s.y; if (ago < 0) return; const p = clamp(older(ago), 0, 1); if (p > 0.05) out.push({ si: x.si, s: x.s, kt: x.kt, ago, p, d: costOf(s) }); }); return out.sort((a, c) => c.d * c.p - a.d * a.p || c.kt * c.p - a.kt * a.p); }
  /* ---------- three more roof views: what covers each roof, which shingle it is, and what a storm of the chosen strength would do to it ---------- */
  /* Laminated (architectural, dimensional) shingles' share of the asphalt shingles sold in the United States, by year:
     7 percent in 1984 and 23 in 1994 (Elcor's annual reports), 27 in 1996, 36 in 1998, 46 in 2000 and 59 in 2003 (GAF's),
     over 65 in 2006 (ElkCorp), 70 in 2010 (Fine Homebuilding), about 86 over 2015 to 2020, 91 in 2021, 93 in 2022 and
     2023 and 95 in 2024 and 2025 (Owens Corning; only the 95 is printed: its chart has no labels and gives 2015 to 2020
     as one average, which is spread here from 83 to 89, a judgment). 1980 is 5 (ARMA, at second hand) and is held for
     every year before it; 2002, 2004 and 2006 sit between two readings each; 2011 to 2014 were not found and are drawn
     straight between. The rest of each year's shingles are three tab strips. These are national figures: no split for
     Louisiana was found, and Louisiana's rules set a wind class (ASTM D3161 Class F or D7158 Class H; New Orleans also
     takes Class G), not a style. Two records point the other way for roofs already on: a 2018 homeowner survey found
     three tab still the commonest choice for a replacement roof (Home Innovation Research Labs), and in 2023 three tab
     was on 64 percent of the shingle roofs in Georgia's insurance claims (Nearmap; Louisiana is not in its list). */
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
     of the roof (its LENS_FS), each at one common size of that covering: 7 three tab strips (the 36 inch shingle: 12
     inch tabs at a 5 inch exposure, courses offset half a tab; metric three tabs run 13 1/8 inch tabs at 5 5/8), 8
     laminated shingles (5 5/8 inch exposure, tabs of uneven width over a darker layer), 9 standing seam (seams at 16
     inches; also sold at 12), 10 ribbed panels with their screws showing (ribs at 12 inches: 5V crimp, R panel), 11
     barrel tile (8 1/4 by 10 1/4 inches to the weather, Ludowici's Spanish tile), 13 a white membrane (10 ft sheets:
     one of the four widths TPO comes in), 14 a dark membrane (the metre wide rolls of a modified bitumen cap sheet).
     The sizes are from makers' data sheets; 12 (slate) is in the shader and no covering here asks for it. */
  const COVER = {
    shingle: { row: 8, pat: 8, l: 'Asphalt shingles', s: 'shingles' },
    metal: { row: 9, pat: 9, l: 'Metal on a house', s: 'metal', d: 'drawn as standing seam; the records cannot tell it from 5V crimp or ribbed panels' },
    tile: { row: 10, pat: 11, l: 'Tile or slate', s: 'tile or slate', d: 'drawn as barrel tile' },
    low: { row: 11, pat: 14, l: 'Low slope membrane', s: 'membrane' }, lowmf: { row: 11, pat: 14, l: 'Low slope membrane', s: 'membrane' },
    mh: { row: 13, pat: 10, l: 'Manufactured home roof', s: 'manufactured home roof', d: 'metal on older single wides, shingles on pitched double wides; drawn as ribbed metal' },
    mbldg: { row: 14, pat: 10, l: 'Metal building panels', s: 'metal panels', d: 'ribbed panels, their screws showing' },
  };
  const COVER_KEY = [['shingle', 'Asphalt shingles'], ['metal', 'Metal on a house'], ['tile', 'Tile or slate'], ['low', 'Membrane, dark (modified bitumen, built up, EPDM)'], ['lowW', 'Membrane, white (TPO, PVC or a coating)'], ['mh', 'Manufactured home roof'], ['mbldg', 'Metal building panels']];
  const coverRow = (k, lum) => ((k === 'low' || k === 'lowmf') && isN(lum) && lum >= 0.55 ? 12 : (COVER[k] || COVER.shingle).row);
  const photoWord = lum => (!isN(lum) ? '' : lum < 0.3 ? 'dark' : lum < 0.42 ? 'mid toned' : lum < 0.58 ? 'light' : 'very light');
  /* The share of a ZIP's roofs one storm with that sustained wind replaces. To 112 knots, the top of Category 3, it is the
     atlas's own damage curve (module 02, fitted to FEMA's counts), scaled to what FEMA's counts have come to against it
     since 2004 (curveK: about all of it below hurricane force, a half to four fifths above). The curve is flat past
     about 95 knots, because Louisiana's record holds few stronger winds over many roofs; so above 112 knots it is
     carried up on one anchor from another state: in the South Florida neighbourhoods surveyed after Andrew, where 3
     second gusts likely passed 155 mph and may have reached 175, 23 to 30 percent of homes lost a third to two thirds of
     their roof cover and 36 to 47 percent lost more (NAHB Research Center 1993, as IBHS quotes it): 59 to 77 percent
     together, which is this atlas's sum. By the storm scale's own gust figure (1.23) those gusts go with the Category 4
     step, so the middle, 68 percent, is set there (124 knots, 143 mph), and the top, 77 percent, at the Category 5 step
     (143 knots, 165 mph), for which no survey was found. Grade D above Category 3: judgment on one storm's survey. */
  const CURVE_AT = [42, 57, 72, 90];   /* the middle of each band of wind the ratios were counted in (34 to 49, 50 to 63, 64 to 79, 80 knots and up): the ratio is drawn straight between them, so the share never steps down as the wind rises */
  const curveKAt = kt => { const K = curveK(); if (kt <= CURVE_AT[0]) return K[0]; for (let i = 1; i < 4; i++) if (kt <= CURVE_AT[i]) return K[i - 1] + (K[i] - K[i - 1]) * (kt - CURVE_AT[i - 1]) / (CURVE_AT[i] - CURVE_AT[i - 1]); return K[3]; };
  const stormShare = kt => { if (!(kt >= 34)) return 0; const k = Math.min(kt, 112), base = dmgShare(k) * (curveKAt(k) || 1); const c4 = Math.max(base, 0.68); return kt <= 112 ? base : kt <= 124 ? base + (c4 - base) * (kt - 112) / 12 : c4 + (Math.max(c4, 0.77) - c4) * clamp((kt - 124) / 19, 0, 1); };
  /* that storm on one building: the chance its roof must be replaced, and the chance it is damaged and repaired, over its
     coverings and the ages it may be; kind 'wind' for a tropical storm or hurricane, 'ts' for one severe thunderstorm
     (58 mph gusts: the atlas's stated rate for such a day, module 12), 'rain' for rain without wind: no storm damage,
     and what rain finds is the leaks a roof already has (the repair line's calls a year at its age) */
  function stormOnRoof(b, O, level, step) {
    const types = typesOf(b), W = types.reduce((s, x) => s + x[1], 0) || 1, sp = ageSpread(b, O, AGE_MAX), st = O ? O.st : 1, kind = level >= 4 ? 'wind' : level === 3 ? 'ts' : level >= 1 ? 'rain' : 'dry', d = kind === 'wind' && step ? stormShare(step.kt) : 0; let rep = 0, fix = 0, leak = 0;
    types.forEach(([k, w]) => { const T = RTYPE[k] || RTYPE.shingle, wk = T.wind * OC.tall(st); sp.forEach(([a, pa]) => { const q = w / W * pa;
      if (kind === 'wind') { const x = stormOn(d, a, T.ageK), r = clamp(x[0] * wk, 0, 0.97), f = Math.min(1 - r, x[1] * wk); rep += q * r; fix += q * f; }
      else if (kind === 'ts') { const x = OC.ts[0][0] * windAgeK(a, T.ageK) * wk; rep += q * x * OC.ts[0][1]; fix += q * x * (1 - OC.ts[0][1]); }
      else if (kind === 'rain') leak += q * clamp(repRate(a) * T.leak, 0, 0.5); }); });
    return { kind, d, rep, fix, any: rep + fix, leak };
  }
  /* the strongest wind on record at a ZIP since the file resolves storms (1990), for the Storm view's note */
  const topWind = zip => { let best = null; yearsOf(zip).forEach(y => { if (!best || y.kt > best.kt) best = y; }); return best; };
  /* Storm surge, as a picture for the Scout Engine. The height at the open shore is the old Saffir-Simpson scale's for the
     category (9 to 12 ft, 13 to 18 ft, over 18 ft; the middle of each and 20 ft for Category 5: the Hurricane Center took
     surge off the scale in 2010, because the shape of the coast decides it as much as the wind does; 20 ft is a
     judgment, the old scale saying only more than 18). It thins inland to nothing a little past the farthest the
     Hurricane Center's reports put surge in southwest Louisiana: Rita, Category 3 at landfall, reached Interstate 10 at
     Lake Charles (about 25 nautical miles by the report, about 50 km from the open shore as this atlas measures it) and
     left up to 6 ft there; Laura, Category 4, went 20 to 30 nautical miles in. So 56 km is taken for Category 3, 65 for
     Category 4 and, a judgment, 75 for Category 5. The ground is taken a metre above the sea, which is true of no
     address in particular. Levees and floodwalls are not in it, nor the lakes, bayous and ship channels that carry
     surge farther (Ida left 8 ft at LaPlace, by Lake Pontchartrain). Below Category 3 none is drawn: a choice of the
     picture, not of the weather (the old scale gave 4 to 5 ft for Category 1 and 6 to 8 for Category 2). */
  const SURGE = { 7: [3.2, 56], 8: [4.7, 65], 9: [6.1, 75] };
  function surgeAt(la, lo, level) {
    const s = SURGE[level]; if (!s) return null; const km = coastKm(la, lo); if (!(km < 900)) return { depth: 0, km, note: '' };
    const depth = km < s[1] ? Math.max(0, (s[0] - 1) * (1 - Math.pow(km / s[1], 2))) : 0;
    return { depth, km, note: depth > 0.05 ? `Storm surge is drawn ${D(depth * 3.281, 0)} ft deep here, ${D(km, 0)} km from the Gulf's open shore: a picture from the old Saffir-Simpson surge heights, not a forecast. Levees, floodwalls and the lie of the ground are not in it.` : `No surge is drawn here, ${D(km, 0)} km from the Gulf's open shore. That is where this picture stops, not where water stops: real surge has gone farther up lakes, rivers and ship channels. Not a flood map.` };
  }

  /* what the lens holds for one building: everything that does not change from corner to corner */
  function lensBegin(lens, b, ctx) {
    if (!b || !b.roof || !b.sc) return null; const types = typesOf(b); if (!types.length) return null;
    ctx = ctx || {}; const la = b.lat, lo = b.lon, zip = b.zip || b.zipF || '', opt = optOf(types, ctx.lum), low = b.roof.slope === 'low', year = clamp(Math.round(+ctx.year || 0), 0, OUT_Y);
    const ref = types.reduce((s, [k, w]) => s + heatRef(k, la, lo) * w, 0) / types.reduce((s, [, w]) => s + w, 0);
    const hr = n => heatRate(opt.sr, opt.e, n, la, lo), R = { lens, b, types, opt, low, year, zip, la, lo, ref, hr, canopy: +ctx.canopy || 0, lum: ctx.lum, planes: [], storm: clamp(Math.round(+ctx.storm || 0), 0, 9), step: ctx.stormStep || null, surgeNote: ctx.surgeNote || '' };
    /* the whole roof's heat against the average roof of its kind here: the engine gives the planes it drew (normal, area) */
    R.setPlanes = planes => { let A = 0, s = 0; planes.forEach(p => { A += p.area; s += hr(p.n) * p.area; }); R.planes = planes; R.heat = A > 0 && ref > 0 ? clamp(s / A / ref, 0.5, 1.6) : 1; R.roofHeat = A > 0 ? s / A : ref; if (A > 0 && ref > 0 && (b.heatK == null || Math.abs(b.heatK - R.heat) >= 0.005)) { b.heatK = R.heat; if (LENS.onHeat) { try { LENS.onHeat(b); } catch (e) { /* the card can wait */ } } } return R; };
    if (lens === 'thermal') {
      const sun = ctx.sun || { alt: 45, dir: [0.5, 0.7, 0.5] }, k = SKYK[ctx.weather] || SKYK.clear, sky = clearSky(sun.alt), month = isN(ctx.month) ? ctx.month : NOWD.getMonth(), hour = isN(ctx.hour) ? ctx.hour : 15, ta = airC(la, lo, month, hour), ds = ctx.weather === 'overcast' || ctx.weather === 'rain' ? 3 : ctx.weather === 'cloudy' ? 6 : 10;
      R.air = ta; R.month = month; R.hour = hour; R.sunAlt = sun.alt; R.tmin = 1e9; R.tmax = -1e9; R.hot = null; R.cool = null;
      let pn = null, memo = null; R.vertex = (n, zone, shade) => { if (n !== pn) { pn = n; memo = new Map(); } let F = memo.get(shade); if (F === undefined) { F = c2f(surfaceC((1 - opt.sr) * planeSun(n, sun, sky, k, shade), opt.e, ta, 1.65, ds)); memo.set(shade, F); } if (F > R.tmax) { R.tmax = F; R.hot = { n, shade }; } if (F < R.tmin) { R.tmin = F; R.cool = { n, shade }; } return [clamp((F - LENS_T[0]) / (LENS_T[1] - LENS_T[0]), 0, 1), 0, 0, 0]; };
      return R;
    }
    return R;
  }
  /* wear and time need the roof's planes first (the roof's heat), so their corner readings are made after setPlanes */
  function lensReady(R) {
    if (R.lens === 'thermal') return R;
    if (R.lens === 'cover') {
      /* the covering the building most likely carries (its kind, size and height, and its ZIP's share of metal roofs: the
         card's own odds), in that covering's colour, stronger the surer it is, with its pattern drawn at real size */
      const top = R.types[0], k = top[0], W = R.types.reduce((s, x) => s + x[1], 0) || 1, share = top[1] / W, C = COVER[k] || COVER.shingle, white = coverRow(k, R.lum) === 12;
      /* shingles are drawn in the style their likely years make more probable, as in the Shingle style view */
      const sty = k === 'shingle' ? styleOf(R.b, outlookOf(R.b, { heat: R.heat })) : null;
      R.cover = { k, share, white, lam: sty ? sty.lam : null, pat: k === 'shingle' ? (sty.lam >= 0.5 ? 8 : 7) : white ? 13 : C.pat }; const cv = [clamp(0.2 + 0.8 * (share - 0.3) / 0.7, 0.2, 1), 1, R.cover.pat, coverRow(k, R.lum)];
      R.vertex = () => cv; return R;
    }
    R.out = outlookOf(R.b, { heat: R.heat });
    if (R.lens === 'style') {
      /* which shingle: three tab or laminated, by the years the roof may have gone on (the share of each sold that year);
         a roof that is most likely not shingles is drawn grey, with its own pattern */
      const top = R.types[0], k = top[0], W = R.types.reduce((s, x) => s + x[1], 0) || 1, shS = (R.types.find(x => x[0] === 'shingle') || [0, 0])[1] / W, sty = styleOf(R.b, R.out); R.style = Object.assign({ shingle: shS, top: k }, sty);
      const lam = sty.lam >= 0.5, sure = lam ? sty.lam : 1 - sty.lam, C = COVER[k] || COVER.shingle;
      const cv = k === 'shingle' ? [clamp(0.25 + 1.5 * (sure - 0.5), 0.25, 1), 1, lam ? 8 : 7, lam ? LENS_ROW.lam : LENS_ROW.tab3] : [0.55, 1, coverRow(k, R.lum) === 12 ? 13 : C.pat, LENS_ROW.other];
      R.vertex = () => cv; return R;
    }
    if (R.lens === 'storm') {
      /* the storm on the scale, on this roof: the chance it needs a roofer, hardest at the ridge and hips and a little at
         the edges, as in the Time view; in rain without wind, the chance it calls with a leak this year */
      const S0 = stormOnRoof(R.b, R.out, R.storm, R.step); R.st = S0;
      if (S0.kind === 'rain') { const v = clamp(S0.leak / 0.1, 0, 1); R.vertex = (n, zone) => [clamp(v * (0.6 + 0.6 * zone.edge + 0.5 * zone.ridge), 0, 1), v * 0.5, 6, LENS_ROW.leak]; }
      else { const a = S0.any; R.vertex = (n, zone) => { const zk = 0.2 * zone.edge + 0.1 * zone.corner + 0.5 * zone.ridge, v = clamp(a * (0.78 + zk), 0, 1); return [v, clamp(v * 1.1, 0, 1), 1, LENS_ROW.storm]; }; }
      return R;
    } const age0 = R.b.state ? R.b.state.age : 0; R.seen = stormsSeen(R.zip, R.out ? R.out.older : n => clamp((age0 - n + 2.5) / 5, 0, 1));
    const b = R.b, O = R.out, t = R.year, st = b.state || ZERO, lifeL = R.types.reduce((s, [k, w]) => s + (LIFE[RTYPE[k].life] || LIFE.shingle).L * w, 0) / R.types.reduce((s, [, w]) => s + w, 0);
    const algaeK = R.types.reduce((s, [k, w]) => s + RTYPE[k].algae * w, 0), rustK = R.types.reduce((s, [k, w]) => s + RTYPE[k].rust * w, 0), km = O ? O.km : coastKm(b.lat, b.lon);
    if (R.lens === 'wear') {
      /* wear to date: the share of its service life the roof has used (its likely age over the mean life of its kind: at
         1 half of such roofs have been replaced), worked harder or easier on each plane by the heat it takes, plus what
         the weather has left on it: the storms it has stood through, each by what it cost the ZIP (most at the ridge and edges),
         hail and wind reported near it in the last three years and still open, algae where it stays damp, rust near salt water */
      const used = clamp(st.age / lifeL, 0, 1.2), seenW = clamp(R.seen.reduce((s, x) => s + x.p * clamp(0.05 + 0.5 * x.d, 0.05, 0.3), 0), 0, 0.6), open = clamp((b.sc.HAIL || 0) + (b.sc.WIND || 0), 0, 0.6), rust = rustAt(st.age, rustK, km);
      R.parts = { used, seenW, open, algae: algaeAt(st.age, algaeK, 1 + R.canopy * 0.8), rust, lifeL, age: st.age }; R.wmin = 1e9; R.wmax = -1e9; R.wsum = 0; R.wn = 0;
      const scW = b.sc.WIND || 0, scH = b.sc.HAIL || 0; let pn = null, hk = 1, nf = 0.5, alO = 0, alU = 0;   /* by plane: its heat against the roof's, how far it faces north (1) or south (0), and its algae in the open and under a crown */
      R.vertex = (n, zone, shade, under) => { if (n !== pn) { pn = n; hk = clamp(R.hr(n) / (R.roofHeat || 1), 0.75, 1.35); const hzl = Math.hypot(n[0], n[2]) || 1; nf = n[1] > 0.985 ? 0.5 : clamp(0.5 - 0.5 * n[2] / hzl, 0, 1); alO = algaeAt(st.age, algaeK, 0.6 + nf); alU = algaeAt(st.age, algaeK, (0.6 + nf) * 1.7); } const zk = 0.2 * zone.edge + 0.1 * zone.corner + 0.5 * zone.ridge;
        const al = under ? alU : alO, w = clamp(used * hk + seenW * (0.3 + zk) + open * 0.5 + al * 0.1 + rust * 0.4 * (0.5 + zone.edge), 0, 1);
        if (w > R.wmax) R.wmax = w; if (w < R.wmin) R.wmin = w; R.wsum += w; R.wn++;
        let md = seenW * (0.4 + 1.8 * zk) + scW * 1.2, mk = 1, x = scH * 2; if (x > md) { md = x; mk = 2; } x = Math.max(0, used - 0.45) * hk * 0.9; if (x > md) { md = x; mk = 3; } x = al * 0.8; if (x > md) { md = x; mk = 4; } x = rust * (0.6 + zone.edge); if (x > md) { md = x; mk = 5; }
        return [w, clamp(md, 0, 1), mk, 1]; };
    } else if (R.lens === 'time') {
      /* the years ahead: at each spot, the cause most likely to have damaged it by that year. Wind takes the ridge and hip
         caps first and a little more at the edges than in the field; heat and age work hardest on the planes that run hottest; hail falls on every plane alike
         (which way a hailstorm drives is not on record here); leaks start at the edges of things. */
      if (!O) return null; const A = O.all, wind = 1 - (1 - A.C.hur[t]) * (1 - A.C.ts[t]), hail = A.C.hail[t], wear = A.C.wear[t], leak = A.C.leak[t], rust = O.slow.rust[t], algae = O.slow.algae[t];
      R.now = { wind, hail, wear, leak, rust, algae, any: A.any[t], rep: A.rep[t], keep: A.keep[t] }; R.rusty = rustK >= 0.5;
      const hailV = clamp(hail, 0, 1); let pn = null, hk = 1;
      R.vertex = (n, zone, shade, under) => { if (n !== pn) { pn = n; hk = clamp(R.hr(n) / (R.roofHeat || 1), 0.75, 1.35); } const zk = 0.2 * zone.edge + 0.1 * zone.corner + 0.5 * zone.ridge;
        let v = clamp(wind * (0.8 + zk), 0, 1), mk = 1, row = LENS_ROW.hur, x = hailV; if (x > v) { v = x; mk = 2; row = LENS_ROW.hail; } x = clamp(wear * hk, 0, 1); if (x > v) { v = x; mk = 3; row = LENS_ROW.wear_t; }
        x = clamp(leak * (0.5 + 0.7 * zone.edge + 0.5 * zone.ridge), 0, 1) * 0.8; if (x > v) { v = x; mk = 6; row = LENS_ROW.leak; } if (R.rusty) { x = clamp(rust * (0.6 + zone.edge), 0, 1); if (x > v) { v = x; mk = 5; row = LENS_ROW.rust; } }
        return [v, clamp(v * 1.15, 0, 1), mk, row]; };
    }
    return R;
  }
  const pc1 = v => (v < 0.005 ? 'under 1%' : v > 0.995 ? 'over 99%' : Math.round(v * 100) + '%');
  const ramp = (row, a, b2, ticks) => `<span class="se-ramp" style="background:linear-gradient(90deg,${LENS_PAL[row].join(',')})"></span><span class="se-ticks">${ticks.map(x => `<i>${esc(x)}</i>`).join('')}</span>`;
  /* the key and the reading the engine shows beside a roof view */
  function lensLegend(lens, R, ctx) {
    ctx = ctx || {}; const b = R && R.b, addr = b ? (b.addr ? title(b.addr) : 'The building picked') : '', kinds = R ? R.types.filter(x => x[1] >= 0.03).map(([k, w]) => `${RTYPE[k].l} ${pct(w)}`).join(' · ') : '';
    if (lens === 'thermal') {
      const hm = Math.round(((((isN(ctx.hour) ? ctx.hour : 15) % 24) + 24) % 24) * 60) % 1440, when = `${ctx.dayLabel || 'Today'}, ${String(Math.floor(hm / 60)).padStart(2, '0')}:${String(hm % 60).padStart(2, '0')} by the sun, ${esc(ctx.weatherLabel || 'clear sky')}`;
      let h = `<b>Thermal: how hot each roof plane runs</b><span class="se-leg-note">${when}${R && isN(R.air) ? ` · air ${Math.round(c2f(R.air))}°F, the ${MONTHS[R.month]} normal here (NOAA's stations blended; the nearest is ${esc(climOf(R.la, R.lo).near)})` : ''}${ctx.sunAlt != null && ctx.sunAlt <= 0 ? ' · the sun is down: roofs cool below the air under a clear sky' : ''}</span>${ramp(0, 0, 0, ['40°F', '80', '120', '160', '200°F'])}<span class="se-leg-note">From an energy balance on each plane: the sun it takes at this hour (its slope and bearing, the trees and buildings that shade it), the covering's reflectance (its kind, and how light it shows in the satellite photo) and the normal air temperature. A model, not a thermal camera.</span>`;
      if (R && R.tmax > -1e8) h += `<span class="se-leg-cur"><b>${esc(addr)}</b>${esc(kinds)}<br>Reflects about ${pct(R.opt.sr)} of sunlight${isN(R.lum) ? ` (it shows ${R.lum < 0.38 ? 'dark' : R.lum < 0.48 ? 'mid toned' : 'light'} in the photo)` : ''}<br>Hottest plane <b>${Math.round(R.tmax)}°F</b>${R.hot ? ' (' + faceOf(R.hot.n) + (R.hot.shade > 0.3 ? ', part shaded' : '') + ')' : ''} · coolest ${Math.round(R.tmin)}°F${R.cool ? ' (' + faceOf(R.cool.n) + (R.cool.shade > 0.5 ? ', shaded' : '') + ')' : ''}<br>Over a normal year heat ages this roof <b>${D(R.heat, 2)} times</b> as fast as the average ${esc(RTYPE[R.types[0][0]].s)} roof here${R.heat > 1.08 ? ': a darker colour, or planes turned to the sun, cost it years' : R.heat < 0.93 ? ': a lighter colour, or planes turned from the sun, save it years' : ''} (shade is not counted in the yearly rate).</span>`;
      else h += '<span class="se-leg-cur">Click a building to read its roof.</span>';
      return h;
    }
    if (lens === 'wear') {
      let h = `<b>Wear: what age and weather have taken so far</b><span class="se-leg-note">Today. The share of its service life each roof has used, worked harder on the planes that run hottest, plus the storms it has stood through, wind and hail reported near it, damp and salt.</span>${ramp(1, 0, 0, ['sound', '', 'half worn', '', 'worn out'])}<span class="se-leg-marks"><span><i class="m1"></i>wind at ridge and edges</span><span><i class="m2"></i>hail</span><span><i class="m3"></i>worn patches</span><span><i class="m4"></i>algae</span><span><i class="m5"></i>rust</span></span>`;
      if (R && R.parts) { const p = R.parts, top = R.seen.filter(x => x.p >= 0.5).slice(0, 2).map(x => `${stormName(x.s)}, when the record has about ${pc1(x.d)} of this ZIP's roofs replaced`);
        h += `<span class="se-leg-cur"><b>${esc(addr)}</b>${esc(kinds)}<br>About <b>${D(p.age, 0)} year${Math.round(p.age) === 1 ? '' : 's'}</b> of a ${D(p.lifeL, 0)} year mean life used (${pct(clamp(p.used, 0, 1))})${top.length ? '<br>More likely than not it stood through ' + esc(top.join('; and ')) : ''}${p.open > 0.03 ? `<br>Wind or hail reported near it in the last three years: ${pct(p.open)} chance of damage still open` : ''}${p.algae > 0.15 ? `<br>Algae streaks likely on the shaded and north planes (${pct(p.algae)})` : ''}${p.rust > 0.1 ? `<br>Rust likely at edges and fasteners (${pct(p.rust)}; ${D(R.out ? R.out.km : 0, 0)} km from the Gulf's open shore)` : ''}<br>Worn about <b>${pct(clamp(R.wn ? R.wsum / R.wn : R.wmax, 0, 1))}</b> on the whole; from ${pct(clamp(R.wmin, 0, 1))} to ${pct(clamp(R.wmax, 0, 1))} across its planes</span>`; }
      else h += '<span class="se-leg-cur">Click a building to read its roof.</span>';
      return h + '<span class="se-leg-note">A model of the odds from records, not an inspection: a roofer on the roof decides.</span>';
    }
    const chip = (row, l, extra) => `<span class="se-leg-row"><i style="background:${LENS_PAL[row][LENS_PAL[row].length - 1]}"></i>${esc(l)}${extra || ''}</span>`;
    if (lens === 'cover') {
      let h = `<b>Covering: what each roof is most likely made of</b><span class="se-leg-note">Each roof takes its covering's colour, stronger the surer it is, and its pattern at a common size of that covering: fly close and the courses, seams and ribs show.</span>${COVER_KEY.map(([k, l]) => chip(LENS_ROW[k], l)).join('')}`;
      if (R && R.cover) { const C = COVER[R.cover.k] || COVER.shingle, pw = photoWord(R.lum);
        h += `<span class="se-leg-cur"><b>${esc(addr)}</b>Most likely <b>${esc(C.l.toLowerCase())}</b> (${pct(R.cover.share)})${R.types.length > 1 ? '; else ' + esc(R.types.slice(1).filter(x => x[1] >= 0.02).map(([k, w]) => `${(COVER[k] || COVER.shingle).s} ${pct(w)}`).join(', ')) : ''}${C.d ? '<br>' + esc(C.d.charAt(0).toUpperCase() + C.d.slice(1)) + '.' : ''}${pw ? `<br>It shows ${pw} in the satellite photo${(R.cover.k === 'low' || R.cover.k === 'lowmf') ? (R.cover.white ? ': drawn as a white membrane or coating' : ': drawn as a dark membrane') : ''}.` : ''}</span>`; }
      else h += '<span class="se-leg-cur">Click a building to read its roof.</span>';
      return h + '<span class="se-leg-note">The odds are the card\'s: from the building\'s kind, size and height and its ZIP\'s share of metal roofs. No one has looked at the roof.</span>';
    }
    if (lens === 'style') {
      let h = `<b>Shingle style: three tab or laminated</b><span class="se-leg-note">Laminated (architectural) shingles were 7% of those sold in 1984, 46% in 2000, about 70% in 2010 and 95% in 2025 (makers' filings and investor reports; Fine Homebuilding for 2010; national). Each shingle roof takes the style its likely years of roofing make more probable.</span>${chip(LENS_ROW.tab3, 'Three tab strip: 12 inch tabs, 5 inch exposure')}${chip(LENS_ROW.lam, 'Laminated: uneven tabs, 5 5/8 inch exposure')}${chip(LENS_ROW.other, 'Most likely not shingles (its own pattern)')}`;
      if (R && R.style) { const s = R.style;
        h += `<span class="se-leg-cur"><b>${esc(addr)}</b>${s.top === 'shingle' ? `By its likely age the shingles went on around <b>${s.year}</b><br>Laminated <b>${pct(s.lam)}</b> · three tab <b>${pct(1 - s.lam)}</b>${s.shingle < 0.97 ? `<br>If it is shingles at all (${pct(s.shingle)})` : ''}` : `Most likely ${esc((COVER[s.top] || COVER.shingle).s)}, not shingles${s.shingle > 0.02 ? ` (shingles ${pct(s.shingle)}: if so, laminated ${pct(s.lam)})` : ''}`}</span>`; }
      else h += '<span class="se-leg-cur">Click a building to read its roof.</span>';
      return h + '<span class="se-leg-note">From the roof\'s likely age and national sales, not from the photo. No split for Louisiana was found, and older roofs here may be three tab more often than national sales suggest.</span>';
    }
    if (lens === 'storm') {
      const lv = R ? R.storm : clamp(Math.round(+ctx.storm || 0), 0, 9), sp = (R && R.step) || ctx.stormStep || null, nm = sp ? sp.l : 'No storm';
      let h = `<b>Storm: ${esc(nm)}${sp && sp.mph ? `, ${sp.range ? (sp.range[1] ? sp.range[0] + ' to ' + sp.range[1] : sp.range[0] + ' and up') : 'about ' + sp.mph} mph` : ''}</b>`;
      if (lv === 0) h += '<span class="se-leg-note">Slide the storm scale off Dry to see what each step would do to each roof.</span>';
      else if (lv <= 2) h += `<span class="se-leg-note">Rain without wind does not take roofs. It finds the leaks they have: each roof shows its chance of a leak call this year, from the repair line's calls at its age.</span>${ramp(LENS_ROW.leak, 0, 0, ['0', '', '5%', '', '10% a year'])}`;
      else h += `<span class="se-leg-note">${lv === 3 ? 'One severe thunderstorm with 58 mph gusts: the atlas\'s stated rate for such a day, about 3 roofs in 10,000 within 25 miles.' : `A wind like this replaces about <b>${pc1(stormShare(sp.kt))}</b> of a ZIP's roofs: the atlas's damage curve, scaled to what FEMA's counts have come to${lv >= 8 ? ', and carried past Category 3 on one survey after Andrew: a judgment' : ''}.`} Each roof shows its own chance of needing a roofer, by its covering and age.</span>${ramp(LENS_ROW.storm, 0, 0, ['untouched', '', 'half', '', 'near certain'])}<span class="se-leg-marks"><span><i class="m1"></i>cover lost at ridge, hips and edges</span></span>`;
      if (R && R.st && lv > 0) { const s = R.st, T0 = RTYPE[R.types[0][0]] || RTYPE.shingle, tw = topWind(R.zip);
        h += `<span class="se-leg-cur"><b>${esc(addr)}</b>${esc(kinds)}<br>${s.kind === 'rain' ? `A leak call this year: <b>${pc1(s.leak)}</b>` : `Needs a roofer <b>${pc1(s.any)}</b> · replaced <b>${pc1(s.rep)}</b> · repaired ${pc1(s.fix)}${lv >= 4 ? '<br>' + esc(T0.does.hur) + '.' : ''}`}${tw && lv >= 4 ? `<br>The strongest wind on record at this ZIP since ${OC.recFrom}: ${ktMph0(tw.kt)} mph, ${esc(stormName(SIDS[tw.si]))}.` : ''}${R.surgeNote ? '<br>' + esc(R.surgeNote) : ''}</span>`; }
      else if (lv > 0) h += '<span class="se-leg-cur">Click a building to read its roof.</span>';
      return h + '<span class="se-leg-note">Odds from records and stated judgments, not a forecast of a storm, and not an inspection.</span>';
    }
    /* time */
    const y = R ? R.year : clamp(Math.round(+ctx.year || 0), 0, OUT_Y), key = [['hur', 'Wind (hurricanes, thunderstorms, tornadoes)'], ['hail', 'Hail'], ['wear', 'Heat, sun and age'], ['leak', 'Leaks and flashing'], ['rust', 'Rust (metal, salt air)']];
    let h = `<b>Time: ${THIS_YEAR + y}${y ? `, ${y} year${y === 1 ? '' : 's'} from now` : ', today'}</b><span class="se-leg-note">Each roof takes the colour of the damage most likely to have reached each part of it by then, brighter as the chance grows. From the storms, hail and wind on record for this ZIP and those round it, and the roof's age and kind.</span>${key.map(([c, l]) => `<span class="se-leg-row"><i style="background:${CAUSE_COL[c]}"></i>${esc(l)}${R && R.now ? ` <b>${pc1(c === 'hur' ? R.now.wind : R.now[c])}</b>` : ''}</span>`).join('')}`;
    if (R && R.now && R.out) { const O = R.out, rk = causeRank(O.all, Math.max(1, y)), topC = rk[0], T0 = RTYPE[R.types[0][0]];
      h += `<span class="se-leg-cur"><b>${esc(addr)}</b>${esc(kinds)}<br>By ${THIS_YEAR + y}: a roofer needed <b>${pc1(R.now.any)}</b> · the roof replaced <b>${pc1(R.now.rep)}</b>${y ? `<br>Most likely: <b>${esc(causeText(topC))}</b>. ${esc(T0.does[topC.sub] || '')}.` : '<br>Move the year, or press Play.'}${R.now.algae > 0.2 ? `<br>Algae streaks on the roof then in place: ${pc1(R.now.algae)}` : ''}<br><span class="se-leg-note">Hurricanes here replace ${D(O.hz.long.rep * 100, 1)}% of roofs a year at the pace of the years since ${OC.longFrom} and ${D(O.hz.recent.rep * 100, 1)}% at the pace since ${OC.recFrom}; the outlook uses ${O.rec === 'mid' ? 'their mean' : O.rec === 'recent' ? 'the record since ' + OC.recFrom : 'the record since ' + OC.longFrom}.</span></span>`; }
    else h += '<span class="se-leg-cur">Click a building to read its roof.</span>';
    return h + '<span class="se-leg-note">Odds from records, not a prediction of any one storm, and not an inspection.</span>';
  }
  const LENS = {
    YEARS: OUT_Y, T: LENS_T, pal: LENS_PAL, rows: LENS_ROW, names: { cover: 'Covering', style: 'Shingle style', thermal: 'Thermal', wear: 'Wear', storm: 'Storm', time: 'Time' },
    list: [['off', 'Off', 'The scene as it looks'],
      ['cover', 'Covering', 'What each roof is most likely made of: asphalt shingles, metal, tile or slate, a membrane, a manufactured home roof or metal building panels, each in its colour with its pattern drawn at a common size of that covering'],
      ['style', 'Shingle style', 'Three tab strips or laminated (architectural) shingles: which is more likely on each shingle roof, from the years it may have gone on and the share of each sold then, with the courses drawn at their size'],
      ['thermal', 'Thermal', 'How hot each roof plane runs at the chosen day and hour: an energy balance from the sun it takes, the covering and the air. Dark shingles in full July sun pass 160 degrees'],
      ['wear', 'Wear', 'What age and weather have taken from each roof so far: the life it has used, worked harder where it runs hottest, the storms it has stood through, hail and wind reported near it, algae and rust'],
      ['storm', 'Storm', 'What the storm on the storm scale would do to each roof: its chance of needing a roofer, by its covering and age, from the atlas\'s damage record; in rain without wind, its chance of a leak call'],
      ['time', 'Time', 'The next 15 years: the damage most likely to reach each roof by each year (wind, hail, heat and age, leaks, rust), from this ZIP\'s storm, hail and wind record and the roof\'s age and kind']],
    begin: lensBegin, ready: lensReady, legend: lensLegend, surge: surgeAt, stormShare, stormOnRoof, styleOf, lamAt, cover: COVER,
    /* the few words over a building while a roof view is on */
    label: (lens, R) => { if (!R) return ''; if (lens === 'cover') return R.cover ? (R.cover.white ? 'White membrane' : (COVER[R.cover.k] || COVER.shingle).l.replace(' on a house', '')) + ' ' + pct(R.cover.share) : ''; if (lens === 'style') return R.style ? (R.style.top !== 'shingle' ? 'Not shingles' : R.style.lam >= 0.5 ? 'Laminated ' + pct(R.style.lam) : 'Three tab ' + pct(1 - R.style.lam)) : ''; if (lens === 'storm') return R.st ? (R.st.kind === 'dry' ? '' : R.st.kind === 'rain' ? 'Leak ' + pc1(R.st.leak) : pc1(R.st.any)) : ''; if (lens === 'thermal') return R.tmax > -1e8 ? Math.round(R.tmax) + '°F' : ''; if (lens === 'wear') return R.wn ? pct(clamp(R.wsum / R.wn, 0, 1)) + ' worn' : ''; if (!R.now) return ''; if (!R.year) return 'Today'; const t = [['Wind', R.now.wind], ['Hail', R.now.hail], ['Age', R.now.wear], ['Leak', R.now.leak]].concat(R.rusty ? [['Rust', R.now.rust]] : []).sort((x, y) => y[1] - x[1])[0]; return t[0] + ' ' + pc1(t[1]); },
    /* sun and air for the engine: the month and the hour by the sun for a date at a longitude */
    solar: (date, lon) => { const t = new Date(date.getTime() + (lon / 15) * 3600e3); return { month: t.getUTCMonth(), hour: t.getUTCHours() + t.getUTCMinutes() / 60, doy: Math.floor((Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()) - Date.UTC(t.getUTCFullYear(), 0, 0)) / 864e5) }; },
  };

