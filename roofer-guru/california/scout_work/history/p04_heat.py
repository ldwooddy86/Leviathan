"""California: the Thermal reading's air (70 stations, elevation), coverings and sky."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import F
f = F()
f.rep("month, blended by distance from seven Louisiana stations, shaped through the day.", "month, blended from California's nearest stations by distance and by height (70 stations from the coast to the high\n     Sierra and the deserts; 100 m of height counts as 10 km, and what height is left over is taken at 6.5 C a\n     kilometre), shaped through the day.")
f.block("  const CLIM = [", "  const f2c = ", f.blk('b09_clim.js'))
f.block("  const climAt = (la, lo) => {", "  const climMemo = new Map()", """  /* the ground's height at a place: its ZIP's, where the page's data has it (the hazard job's elevation at the town point) */
  const elevAt = (la, lo) => { const zp = zipAt(la, lo), z = zp ? ZI[zp] : null; return z ? wxCol(z, 'elev') : null; };
  const climAt = (la, lo) => { const el = elevAt(la, lo), near = { d: 1e9, n: '' }, rows = CLIM.map(s => { const km = meters([la, lo], [s.lat, s.lon]) / 1000, d = km + (el == null ? 0 : Math.abs(el - s.el) / 10); if (d < near.d) { near.d = d; near.n = s.n; near.km = km; } return [d, s]; }).sort((x, y) => x[0] - y[0]).slice(0, 4);
    let W = 0, ez = 0; const hi = new Array(12).fill(0), lw = new Array(12).fill(0); rows.forEach(([d, s]) => { const w = 1 / Math.pow(Math.max(d, 4), 2); W += w; ez += s.el * w; for (let m = 0; m < 12; m++) { hi[m] += s.hi[m] * w; lw[m] += s.lo[m] * w; } });
    const adj = el == null ? 0 : -(el - ez / W) * 0.0065 * 1.8; return { hi: hi.map(v => v / W + adj), lo: lw.map(v => v / W + adj), near: near.n, km: near.km, el }; };
""")
f.rep("     to 0.25, slate 0.1 to 0.2; membranes from dark modified bitumen at 0.08 to white TPO and PVC at 0.70 after three years\n     (Cool Roof Rating Council; less where the Gulf's damp soils them); bare 55 percent aluminium zinc steel reflects",
      "     to 0.25, slate 0.1 to 0.2; membranes from dark modified bitumen at 0.08 to white TPO and PVC at 0.70 after three years\n     (Cool Roof Rating Council); the Energy Code's own default for an unrated asphalt shingle is an aged reflectance of\n     0.08, and 0.10 for any other unrated product; bare 55 percent aluminium zinc steel reflects")
f.rep("so it runs hotter than its brightness suggests, and metal\n     building roofs here are a mix of that and paint */", "so it runs hotter than its brightness suggests, and metal\n     building roofs here are a mix of that and paint. Wood shakes are taken with mid toned shingles and a house's low\n     slope roof with the membranes (no measurement of either was found). */")
f.rep("const ROOFOPT = { shingle: { sr: [0.04, 0.26], e: 0.91 }, metal:", "const ROOFOPT = { shingle: { sr: [0.04, 0.26], e: 0.91 }, wood: { sr: [0.1, 0.3], e: 0.9 }, flat: { sr: [0.08, 0.68], e: 0.88 }, metal:")
f.rep("""averaged over every hour of twelve mid month days with the
     sky clear six tenths of the time (Louisiana's share of possible sunshine). No shade is counted: the yearly rate
     knows the plane's slope, its bearing and the roof's colour, not the trees round it. */""",
"""averaged over every hour of twelve mid month days with the
     sky clear a share of the time that falls with the place's rain: nine tenths less a hundredth for each inch of
     normal yearly rain, held between a half and nine tenths (a judgment: the page's data carries no sunshine record;
     the deserts come out near 0.85, Los Angeles 0.75, San Francisco 0.67, Eureka 0.5). No shade is counted: the
     yearly rate knows the plane's slope, its bearing and the roof's colour, not the trees round it. */
  const clearShare = (la, lo) => { const zp = zipAt(la, lo), r = zp && ZI[zp] ? wxCol(ZI[zp], 'rainIn') : null; return r == null ? 0.7 : clamp(0.9 - r / 100, 0.5, 0.9); };""")
f.rep("    /* the answer is for the rounded place and colour the memo is keyed by (half a degree; a hundredth), so it does not depend on which roof asked first */\n    sr = Math.round(sr * 100) / 100; e = Math.round(e * 100) / 100; la = Math.round(la * 2) / 2; lo = Math.round(lo * 2) / 2;",
      "    /* the answer is for the rounded place and colour the memo is keyed by (a tenth of a degree, about 10 km: California's air changes that fast between the beach, the valley and the pass; a hundredth), so it does not depend on which roof asked first */\n    sr = Math.round(sr * 100) / 100; e = Math.round(e * 100) / 100; la = Math.round(la * 10) / 10; lo = Math.round(lo * 10) / 10; const cs = clearShare(la, lo);")
f.rep("[[SKYK.clear, 0.6, 10], [SKYK.overcast, 0.4, 3]].forEach(", "[[SKYK.clear, cs, 10], [SKYK.overcast, 1 - cs, 3]].forEach(")
f.rep("if (HEATM.size > 4000) HEATM.clear();", "if (HEATM.size > 12000) HEATM.clear();")
f.rep("const heatRef = (type, la, lo) => { const o = ROOFOPT[type] || ROOFOPT.shingle, sr = reflectOf(type, null), low = type === 'low' || type === 'lowmf' || type === 'mbldg',", "const heatRef = (type, la, lo) => { const o = ROOFOPT[type] || ROOFOPT.shingle, sr = reflectOf(type, null), low = type === 'low' || type === 'lowmf' || type === 'mbldg' || type === 'flat',")
# the state's mean heat: one ZIP in eight, by its roofs (the sum over every ZIP costs seconds)
f.rep("Z.forEach(z => { const w = +z.roofs || 0; if (!(w > 0) || !isN(z.lat)) return; s += w * heatRef(type, z.lat, z.lon); n += w; });", "Z.forEach((z, i) => { const w = +z.roofs || 0; if (i % 8 || !(w > 0) || !isN(z.lat)) return; s += w * heatRef(type, z.lat, z.lon); n += w; });")
f.rep("against the average California roof of that kind (by one unit roofs):", "against the average California roof of that kind (by one unit roofs, over a sample of one ZIP in eight):")
f.save()
