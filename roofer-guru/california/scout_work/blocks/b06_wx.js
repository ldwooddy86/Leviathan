  /* ---------- California's weather and fire record at a ZIP: the hazard columns of the page's data ---------- */
  /* One place names every hazard column the module reads (the first name present wins; the second names are the
     data build's stand-ins from before the hazard job's schema was final). Days are days a year unless said.
       ar1..ar5   atmospheric river days by CW3E rank at the ZIP's latitude on the coast (the ERA5 landfall catalog)
       rd1, rd2   days with an inch and with two inches of rain (GHCN-Daily, 1996 to 2025); rainIn the 1991 to 2020 normal
       g40, g58, g75   days with a gust of 40, 58 and 75 mph at the nearest screened station (gustSt, gustKm away)
       sa         Santa Ana, Diablo or sundowner days (saKind names which)
       fhszVH, fhszH, fhszM   percent of the ZIP's area in each Fire Hazard Severity Zone; burn the percent inside a
                  fire perimeter since 1950; fireN the perimeters that touch it; dest, dmg, nodmg the structures CAL FIRE's
                  inspections record as destroyed, damaged and undamaged there (2013 to 2025)
       snow       ASCE 7-22 ground snow load, pounds a square foot; elev metres
       h100, h110 days at 100 F and 110 F; hd1 days with one inch hail within 25 miles; coast km to salt water */
  const HCOL = {
    ar1: ['ar1d'], ar2: ['ar2d'], ar3: ['ar3d'], ar4: ['ar4d'], ar5: ['ar5d'], arD: ['ar_d', 'ar_days'], arN: ['ar_n'], ar3n: ['ar3_n'], arMax: ['ar_max'],
    rainIn: ['rain_in'], rd1: ['rain_d1', 'rd1'], rd2: ['rain_d2', 'rd2'], rainRec: ['rain_rec_in'],
    g40: ['g40', 'wd40'], g58: ['g58', 'wd58'], g75: ['g75', 'wd75'], gustMax: ['gust_max'], gustKm: ['gust_km'],
    sa: ['sa_d', 'sa_days', 'sa_n', 'off_d'],
    fhszVH: ['fhsz_vh'], fhszH: ['fhsz_high'], fhszM: ['fhsz_mod'], fhszHV: ['fhsz_hv', 'fhsz_sh'], burn: ['burn_sh'], fireN: ['fire_n'], fireLastYr: ['fire_last_yr', 'lastfire'], fireBigYr: ['fire_big_yr'], fireBigAc: ['fire_big_ac'],
    dest: ['dins_dest', 'fire_dest'], dmg: ['dins_dmg', 'fire_dmg'], nodmg: ['dins_nodmg'], worstYr: ['dins_worst_yr'], worstDest: ['dins_worst_dest'],
    snow: ['snow_psf', 'pg_psf', 'snow_pg'], snow20: ['snow20_psf', 'pg20_psf'], elev: ['elev_pt_m', 'elev_m', 'elev_mean_m'],
    h90: ['h90'], h100: ['h100', 'heat100'], h110: ['h110', 'heat110'], tjul: ['tjul'],
    hd1: ['hd1', 'hail_d1'], hd175: ['hd175'], coast: ['coast_km'],
  };
  const HTXT = { arMaxDate: ['ar_max_date'], gustSt: ['gust_st'], gustMaxDate: ['gust_max_date'], saKind: ['sa_kind', 'sa_type', 'off_kind'], fireLast: ['fire_last'], fireBig: ['fire_big'], worst: ['dins_worst'], rainSt: ['rain_st'], rainRecDate: ['rain_rec_date'], fhszResp: ['fhsz_resp'], heatSt: ['heat_st'] };
  const wxCol = (z, k) => { if (!z) return null; const a = HCOL[k] || [k]; for (let i = 0; i < a.length; i++) { const v = z[a[i]]; if (v != null && v !== '' && isN(+v)) return +v; } return null; };
  const wxTxt = (z, k) => { if (!z) return ''; const a = HTXT[k] || [k]; for (let i = 0; i < a.length; i++) { const v = z[a[i]]; if (v != null && v !== '') return String(v); } return ''; };
  /* the ZIP's share of area in a High or Very High zone, from whichever columns the data carries */
  const fhszHV = z => { const a = wxCol(z, 'fhszVH'), b2 = wxCol(z, 'fhszH'); return a != null || b2 != null ? (a || 0) + (b2 || 0) : wxCol(z, 'fhszHV'); };
  /* the state's mean of a hazard column over its one unit roofs: what "more than most of California" is measured against */
  const WXMEAN = new Map();
  function wxMean(k) { if (WXMEAN.has(k)) return WXMEAN.get(k); let s = 0, n = 0; Z.forEach(z => { const v = wxCol(z, k), w = +z.roofs || 0; if (v != null && w > 0) { s += v * w; n += w; } }); const m = n > 0 ? s / n : null; WXMEAN.set(k, m); return m; }
  /* which columns the page's data really has, for the method's note and the tests */
  const WXHAS = k => Z.some(z => wxCol(z, k) != null);

  /* ---------- the reports around each building: the atlas's located weather reports of the last three years ---------- */
  /* Hail of an inch or more, thunderstorm wind of 50 knots (58 mph) or more and tornadoes of EF1 or more, from the atlas's
     located reports (DATA.pts: NOAA Storm Events and the Weather Service's local storm reports), indexed on a grid of
     0.05 degree cells. California's damaging wind is mostly not thunderstorm wind: the offshore wind and winter storm
     days are counted at the ZIP (the gust days above), not here. */
  const EVY = 3.2;
  const kt2mph = kt => Math.round(kt * 1.15078);
  const EVS = (typeof PTS !== 'undefined' && Array.isArray(PTS) ? PTS : []).map(p => ({ lat: +p.lat, lon: +p.lon, k: +p.k, mag: +p.mag, y: +p.y, m: +p.m, dw: p.dw, h: p.h, t: +p.y + ((+p.m || 6) - 0.5) / 12 }))
    .filter(p => isN(p.lat) && isN(p.lon) && NOW - p.t <= EVY && NOW - p.t >= -0.1 && ((p.k === 0 && p.mag >= 1) || (p.k === 1 && p.mag >= 50) || (p.k === 2 && p.mag >= 1)));
  const EVG = new Map(); EVS.forEach(p => { const k = Math.floor(p.lat * 20) + ':' + Math.floor(p.lon * 20); if (!EVG.has(k)) EVG.set(k, []); EVG.get(k).push(p); });
  function eventsNear(la, lo) {
    /* a cell is 5.6 km north to south but only 4.1 to 4.7 km east to west at California's latitudes, so two cells each way east and west */
    const out = [], i0 = Math.floor(la * 20), j0 = Math.floor(lo * 20);
    for (let i = i0 - 1; i <= i0 + 1; i++) for (let j = j0 - 2; j <= j0 + 2; j++) (EVG.get(i + ':' + j) || []).forEach(p => { const km = meters([la, lo], [p.lat, p.lon]) / 1000; if (km <= 5) out.push(Object.assign({ km, ago: NOW - p.t, dir: compass(bearing([la, lo], [p.lat, p.lon])) }, p)); });
    return out.sort((a, b) => a.ago - b.ago || a.km - b.km);
  }
  /* the chance a report's hail or wind damaged a roof enough for a roofer, before distance and time (judgment) */
  const hailDmg = in_ => in_ >= 2.5 ? 0.28 : in_ >= 1.75 ? 0.16 : in_ >= 1.25 ? 0.08 : 0.04;
  const windDmg = e => e.k === 1 ? (e.mag >= 65 ? 0.08 : 0.03) : e.mag >= 3 ? 0.6 : e.mag >= 2 ? 0.35 : 0.15;
  /* damage still open after a report: claims settle and roofs are fixed within a year or two */
  const recency = ago => ago <= 1 ? 1 : ago <= 2 ? 0.55 : ago <= 3.2 ? 0.3 : 0;
  const evLabel = e => e.k === 0 ? `${D(e.mag, 2).replace(/0$/, '')} inch hail` : e.k === 1 ? `${kt2mph(e.mag)} mph thunderstorm wind` : `an EF${e.mag} tornado`;
  const evWhen = e => `${MON[(e.m || 1) - 1]} ${e.y}`;

