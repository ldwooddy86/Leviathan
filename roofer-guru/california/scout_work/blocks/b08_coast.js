  /* Salt water, for salt air on metal: the Pacific shore from the atlas's own state outline (about 200 m to a step; the
     land borders with Oregon, Nevada, Arizona and Mexico are cut out by a line drawn inland of the coast), and the bay
     shores from a short list of points placed by hand along San Francisco, San Pablo and San Diego bays, Humboldt Bay,
     Morro Bay, Mission Bay, Newport Bay, Marina del Rey and the Los Angeles and Long Beach harbor (good to about a
     kilometre: the first salt step, half a kilometre, is approximate beside a bay). Suisun Bay and the Delta are
     brackish and are not counted (a judgment). */
  const COAST_EAST = [[32.4, -116.95], [33.0, -117.05], [33.5, -117.35], [34.0, -117.9], [34.5, -119.0], [35.0, -120.2], [36.0, -121.0], [37.0, -121.6], [38.0, -122.2], [39.0, -123.2], [40.0, -123.6], [41.0, -123.7], [42.1, -123.8]];
  const coastEast = la => { const C = COAST_EAST; if (la <= C[0][0]) return C[0][1]; for (let i = 1; i < C.length; i++) if (la <= C[i][0]) return C[i - 1][1] + (C[i][1] - C[i - 1][1]) * (la - C[i - 1][0]) / (C[i][0] - C[i - 1][0]); return C[C.length - 1][1]; };
  const BAYS = [[37.80, -122.39], [37.76, -122.38], [37.72, -122.36], [37.67, -122.38], [37.62, -122.37], [37.57, -122.25], [37.51, -122.21], [37.46, -122.10], [37.43, -121.97], [37.50, -122.03], [37.56, -122.09], [37.63, -122.15], [37.70, -122.19], [37.71, -122.22], [37.77, -122.28], [37.80, -122.32], [37.84, -122.30], [37.87, -122.31], [37.91, -122.36], [37.96, -122.40], [38.01, -122.36], [38.02, -122.28], [38.06, -122.22], [38.02, -122.13], [38.05, -122.15], [38.10, -122.26], [38.10, -122.50], [38.03, -122.50], [37.97, -122.49], [37.92, -122.48], [37.87, -122.45], [37.86, -122.48],
    [32.71, -117.23], [32.72, -117.18], [32.71, -117.17], [32.69, -117.15], [32.66, -117.11], [32.62, -117.10], [32.60, -117.11], [32.63, -117.14], [32.69, -117.17], [32.78, -117.23], [33.62, -117.89], [33.61, -117.91], [33.74, -118.25], [33.76, -118.20], [33.75, -118.22], [33.98, -118.45], [40.80, -124.17], [40.86, -124.09], [40.75, -124.21], [35.34, -120.85], [35.37, -120.86]];
  const SHORE = (() => { const pts = []; try { pathRings(G0.outline).forEach(r => r.forEach(([la, lo]) => { if (la < 41.99 && la > 32.535 && lo < coastEast(la)) pts.push([la, lo]); })); } catch (e) { /* no outline: the bays alone */ } return pts.concat(BAYS); })();
  const coastMemo = new Map();
  function coastKm(la, lo) {
    if (!isN(la) || !isN(lo) || !SHORE.length) return 999; const k = la.toFixed(4) + ',' + lo.toFixed(4); let v = coastMemo.get(k);   /* to about 10 m: the salt steps begin at half a kilometre */
    if (v === undefined) { let best = 1e18; const kx = Math.cos(rad(la)) * 111.32; for (const p of SHORE) { const dy = (p[0] - la) * 110.9, dx = (p[1] - lo) * kx, d = dx * dx + dy * dy; if (d < best) best = d; } v = Math.sqrt(best); if (coastMemo.size > 20000) coastMemo.clear(); coastMemo.set(k, v); }
    return v;
  }
