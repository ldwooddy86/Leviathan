"""Align the hazard columns with the hazard job's final names (HAZARD_SCHEMA.md, 2026-11-23) and the reports' units."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import F
f = F()
f.rep("    g40: ['g40', 'wd40'], g58: ['g58', 'wd58'], g75: ['g75', 'wd75'], gustMax: ['gust_max'], gustKm: ['gust_km'],\n    sa: ['sa_d', 'sa_days', 'sa_n', 'off_d'],",
      "    g40: ['g40'], g58: ['g58'], g75: ['g75'], gustMax: ['gust_max'], gustKm: ['gust_km'], lsr58: ['wd58'], lsr75: ['wd75'], lsrMax: ['lsr_max'], hwYr: ['hw_yr'],\n    offCls: ['off_cls'], saEp: ['sa_ep'], diEp: ['di_ep'], suEp: ['su_ep'],")
f.rep("    dest: ['dins_dest', 'fire_dest'], dmg: ['dins_dmg', 'fire_dmg'], nodmg: ['dins_nodmg'], worstYr: ['dins_worst_yr'], worstDest: ['dins_worst_dest'],",
      "    dest: ['fire_dest', 'dins_dest'], dmg: ['fire_dmg', 'dins_dmg'], insp: ['fire_insp'], fireKm: ['fire_km'], worstYr: ['fire_worst_yr', 'dins_worst_yr'], worstDest: ['fire_worst_dest', 'dins_worst_dest'],")
f.rep("    snow: ['snow_psf', 'pg_psf', 'snow_pg'], snow20: ['snow20_psf', 'pg20_psf'], elev: ['elev_pt_m', 'elev_m', 'elev_mean_m'],", "    snow: ['snow_psf'], snow20: ['snow20_psf'], snowMax: ['snow_max_psf'], elev: ['elev_pt_m', 'elev_m', 'elev_mean_m'], solar: ['solar_sh'],")
f.rep("fhszVH: ['fhsz_vh'], fhszH: ['fhsz_high'], fhszM: ['fhsz_mod'], fhszHV: ['fhsz_hv', 'fhsz_sh'],", "fhszVH: ['fhsz_vh'], fhszH: ['fhsz_high'], fhszM: ['fhsz_mod'], fhszHV: ['fhsz_sh', 'fhsz_hv'],")
f.rep("saKind: ['sa_kind', 'sa_type', 'off_kind'], fireLast: ['fire_last'], fireBig: ['fire_big'], worst: ['dins_worst'],", "offKind: ['off_kind'], lsrAt: ['lsr_max_at'], lsrDate: ['lsr_max_date'], fireLast: ['fire_last'], fireBig: ['fire_big'], worst: ['fire_worst', 'dins_worst'],")
f.rep("""       g40, g58, g75   days with a gust of 40, 58 and 75 mph at the nearest screened station (gustSt, gustKm away)
       sa         Santa Ana, Diablo or sundowner days (saKind names which)""",
"""       g40, g58, g75   days with a gust of 40, 58 and 75 mph at the nearest screened station (gustSt, gustKm away);
                  lsr58, lsr75 the days a gust that strong was measured anywhere within 25 miles (Local Storm Reports,
                  2010 to 2025: mountain and canyon sensors dominate), lsrMax the highest; hwYr High Wind days in the zone
       offCls     offshore wind exposure, 0 to 3, from the Storm Events episodes of 2006 to 2025 that name a Santa Ana,
                  Diablo or sundowner wind in the ZIP's forecast zone (saEp, diEp, suEp; offKind names the commonest)""")
# the located reports: thunderstorm wind is in mph in California's file; kind 7 is a measured gust that was not a thunderstorm's
f.rep("""  /* Hail of an inch or more, thunderstorm wind of 50 knots (58 mph) or more and tornadoes of EF1 or more, from the atlas's
     located reports (DATA.pts: NOAA Storm Events and the Weather Service's local storm reports), indexed on a grid of
     0.05 degree cells. California's damaging wind is mostly not thunderstorm wind: the offshore wind and winter storm
     days are counted at the ZIP (the gust days above), not here. */""",
"""  /* Hail of an inch or more, wind of 58 mph or more (kind 1 a thunderstorm's, kind 7 a measured gust that was not: both
     in miles an hour in California's file) and tornadoes of EF1 or more, from the atlas's located reports (DATA.pts:
     NOAA Storm Events, and the Weather Service's Local Storm Reports thinned to the highest a day in each quarter
     degree), indexed on a grid of 0.05 degree cells. Most of California's damaging wind leaves no point here: the
     offshore wind and winter storm days are counted at the ZIP (the gust days above). */""")
f.rep("const kt2mph = kt => Math.round(kt * 1.15078);\n", "")
f.rep("((p.k === 0 && p.mag >= 1) || (p.k === 1 && p.mag >= 50) || (p.k === 2 && p.mag >= 1)));", "((p.k === 0 && p.mag >= 1) || ((p.k === 1 || p.k === 7) && p.mag >= 58) || (p.k === 2 && p.mag >= 1)));")
f.rep("const windDmg = e => e.k === 1 ? (e.mag >= 65 ? 0.08 : 0.03) : e.mag >= 3 ? 0.6 : e.mag >= 2 ? 0.35 : 0.15;", "const windDmg = e => e.k !== 2 ? (e.mag >= 75 ? 0.08 : 0.03) : e.mag >= 3 ? 0.6 : e.mag >= 2 ? 0.35 : 0.15;")
f.rep("e.k === 1 ? `${kt2mph(e.mag)} mph thunderstorm wind` : `an EF${e.mag} tornado`;", "e.k === 1 ? `${Math.round(e.mag)} mph thunderstorm wind` : e.k === 7 ? `a ${Math.round(e.mag)} mph gust` : `an EF${e.mag} tornado`;")
f.rep("  const AW = (ANCH.wind && ANCH.wind.length >= 2 ? ANCH.wind : null);", "  const AW = ANCH.storm_w && isN(ANCH.storm_w.g58) && isN(ANCH.storm_w.g75) ? [+ANCH.storm_w.g58, +ANCH.storm_w.g75] : ANCH.wind && ANCH.wind.length >= 2 ? ANCH.wind : null;")
f.rep("       where the data carries them, else 3 and 15 roofs in 10,000: a judgment, grade D;", "       where the data carries them (module 12's storm line: ANCH.storm_w), else 3 and 15 roofs in 10,000: a judgment, grade D;")
# the sky's ids are the engine's: none, marine, tule, smoke
f.rep("const WX_SKY = [['clear', 'Clear'], ['marine', 'Marine layer'], ['tule', 'Tule fog'], ['smoke', 'Wildfire smoke']];", "const WX_SKY = [['none', 'Clear'], ['marine', 'Marine layer'], ['tule', 'Tule fog'], ['smoke', 'Wildfire smoke']];")
f.rep("const WXNOW = { rain: 'dry', wind: 'calm', sky: 'clear', elev: null, engine: false };", "const WXNOW = { rain: 'dry', wind: 'calm', sky: 'none', elev: null, engine: false };")
f.rep("sky = (typeof ctx.sky === 'string' && WX_SKY.some(x => x[0] === ctx.sky) ? ctx.sky : WXNOW.sky) || 'clear';", "cs = ctx.sky && typeof ctx.sky === 'object' ? ctx.sky.id : ctx.sky, sky = (typeof cs === 'string' && WX_SKY.some(x => x[0] === cs) ? cs : WXNOW.sky) || 'none', ew = ctx.wx && typeof ctx.wx === 'object' ? ctx.wx : {};")
f.rep("    const snowM = ctx.stormStep && isN(+ctx.stormStep.snowLevel) && +ctx.stormStep.snowLevel > 0 ? +ctx.stormStep.snowLevel : r.snowM;\n    return { rain: r, wind: w, sky, gust: Math.max(rg, wg), rainGust: rg, windGust: wg, snowM, elev: isN(ctx.elev) ? +ctx.elev : WXNOW.elev };",
      "    const snowM = isN(ew.snowLevelM) && +ew.snowLevelM > 0 ? +ew.snowLevelM : ctx.stormStep && isN(+ctx.stormStep.snowLevel) && +ctx.stormStep.snowLevel > 0 ? +ctx.stormStep.snowLevel : r.snowM;\n    return { rain: r, wind: w, sky, gust: Math.max(rg, wg), rainGust: rg, windGust: wg, snowM, elev: isN(ew.elevationM) ? +ew.elevationM : isN(ctx.elev) ? +ctx.elev : WXNOW.elev };")
f.rep("wx.sky !== 'clear' ? (WX_SKY.find", "wx.sky !== 'none' ? (WX_SKY.find")
# the climate zone: the Energy Commission's list by ZIP where the page carries it (the terrain block's data), else the commission's map at the building
f.rep("  const czOf = b => { const v = b && (b.cz || (b.z && (b.z.cz || b.z.cz16))); const n = parseInt(v, 10); return n >= 1 && n <= 16 ? n : null; };",
"""  let CZZ = null;
  const czZip = zip => { if (!CZZ) { CZZ = {}; try { const X = window.__SCOUT_TOPO_XD__; if (X && X.cz) Object.keys(X.cz).forEach(k => { const s = X.cz[k]; for (let i = 0; i < s.length; i += 3) CZZ[String(90000 + parseInt(s.substr(i, 3), 36))] = +k; }); } catch (e) { CZZ = {}; } } return CZZ[zip] || null; };
  const czOf = b => { const v = b && (czZip(b.zip) || (b.z && (b.z.cz || b.z.cz16)) || b.cz); const n = parseInt(v, 10); return n >= 1 && n <= 16 ? n : null; };
  const czSrc = b => (b && czZip(b.zip) ? 'the Energy Commission\\'s list by ZIP code' : 'the Energy Commission\\'s climate zone map at the building');""")
f.save()
