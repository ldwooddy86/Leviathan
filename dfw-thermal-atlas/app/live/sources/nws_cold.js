/* ==== live/sources/nws_cold.js ==== */
/* National Weather Service: the next seven nights of forecast lows at 19 points across the 12 counties, and the active
   watches, warnings and advisories for those counties. One small forecast request per point (12 hour periods) and one
   alerts request: 20 requests and about 300 KB. Each point's grid cell is baked into live/geo.js. */
(function (root) {
  'use strict';
  const L = root.TDA_LIVE, API = 'https://api.weather.gov';
  const H = { headers: { Accept: 'application/geo+json' } };
  /* the local calendar date (America/Chicago) of an ISO timestamp that carries its own offset: the first ten characters */
  const localDate = iso => String(iso || '').slice(0, 10);
  /* events that mean heating demand; matched on the event name the Weather Service sends */
  const COLD_EVENT = /freeze|frost|cold|wind chill|winter|ice storm|blizzard|snow|sleet/i;
  L.COLD_EVENT = COLD_EVENT;
  function parseForecast(j) {
    const P = (j && j.properties) || {}; const periods = P.periods || [];
    const nights = [], days = [];
    periods.forEach(p => {
      if (p.temperature == null) return; const f = p.temperatureUnit === 'C' ? p.temperature * 9 / 5 + 32 : p.temperature;
      if (p.isDaytime) days.push({ d: localDate(p.startTime), hiF: Math.round(f) });
      else nights.push({ d: localDate(p.startTime), name: p.name, lowF: Math.round(f), wx: p.shortForecast || '', pop: p.probabilityOfPrecipitation && p.probabilityOfPrecipitation.value != null ? p.probabilityOfPrecipitation.value : null });
    });
    return { updated: P.updateTime || P.generatedAt || null, nights, days };
  }
  function parseAlerts(j, byZone) {
    return ((j && j.features) || []).map(f => {
      const p = f.properties || {}; const ugc = (p.geocode && p.geocode.UGC) || [];
      const counties = [...new Set(ugc.map(z => byZone[z]).filter(Boolean))];
      return { id: p.id || f.id || '', event: p.event || '', severity: p.severity || '', urgency: p.urgency || '', onset: p.onset || p.effective || null, ends: p.ends || p.expires || null, headline: p.headline || '', counties, cold: COLD_EVENT.test(p.event || '') };
    }).filter(a => a.counties.length && a.event);
  }
  L.register({
    id: 'nws_cold', name: 'Forecast lows and cold alerts', publisher: 'National Weather Service (NOAA)', page: 'https://www.weather.gov/fwd/',
    about: 'Seven nights of forecast low temperatures at 19 points across the 12 counties, plus every active watch, warning and advisory. Drives the cold triggers in the Heat Desk, the toolbar badge and the notification.',
    hosts: ['api.weather.gov'], cadence: 'daily', cors: true, grade: 'A', terms: 'U.S. Government work, public domain',
    labels: { minLow: ['Coldest forecast low, next seven nights', 'degF'], freezePoints: ['Forecast points with a freeze (32°F or lower)', 'int'], coldAlerts: ['Active cold weather alerts', 'int'], alerts: ['All active alerts in the 12 counties', 'int'] },
    async run(ctx) {
      const G = ctx.geo, prev = ctx.prev || {}; const grids = Object.assign({}, prev.grids || {});      /* grids: cells looked up again after the baked one went away */
      const lookup = async pt => { const p = (await ctx.http.json(`${API}/points/${pt.lat},${pt.lon}`, H)).properties; return { wfo: p.gridId, x: p.gridX, y: p.gridY, czone: String(p.county || '').split('/').pop() }; };
      const out = []; let failed = 0, lastErr = null, updated = null;
      for (const pt of G.points) {
        const rec = { id: pt.id, name: pt.name, lat: pt.lat, lon: pt.lon, county: pt.county, nights: [], days: [] };
        try {
          let g = grids[pt.id] || (pt.gx != null ? { wfo: 'FWD', x: pt.gx, y: pt.gy } : null), f;
          if (!g) g = grids[pt.id] = await lookup(pt);
          try { f = await ctx.http.json(`${API}/gridpoints/${g.wfo}/${g.x},${g.y}/forecast`, H); }
          catch (e) { if (!(e && e.status === 404)) throw e; g = grids[pt.id] = await lookup(pt); f = await ctx.http.json(`${API}/gridpoints/${g.wfo}/${g.x},${g.y}/forecast`, H); }       /* the grid moved: find the new cell and keep it */
          const r = parseForecast(f); rec.nights = r.nights; rec.days = r.days; rec.grid = `${g.wfo}/${g.x},${g.y}`;
          if (g.czone && G.byZone[g.czone]) rec.county = G.byZone[g.czone];
          if (r.updated && (!updated || r.updated > updated)) updated = r.updated;
          if (!r.nights.length) throw new Error('no night periods in the forecast');
        } catch (e) { failed++; lastErr = e; rec.err = String((e && e.message) || e).slice(0, 120); }
        out.push(rec);
      }
      if (failed === G.points.length) throw lastErr || new Error('no forecast point answered');
      const zones = G.counties.map(c => c.zone).concat(G.counties.map(c => c.czone)).join(',');
      let alerts = [], alertsErr = null;
      try { alerts = parseAlerts(await ctx.http.json(`${API}/alerts/active?zone=${zones}`, H), G.byZone); } catch (e) { alertsErr = String((e && e.message) || e).slice(0, 120); }
      return { updated, points: out, failed, alerts, alertsErr, grids };
    },
    digest(d) {
      const lows = d.points.flatMap(p => p.nights.map(n => n.lowF)); const minLow = lows.length ? Math.min(...lows) : null;
      return { minLow, freezePoints: d.points.filter(p => p.nights.some(n => n.lowF <= 32)).length, coldAlerts: d.alerts.filter(a => a.cold).length, alerts: d.alerts.length };
    },
  });
  L.nws = { parseForecast, parseAlerts, localDate };
})(typeof globalThis !== 'undefined' ? globalThis : self);
