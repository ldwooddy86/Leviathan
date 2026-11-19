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

