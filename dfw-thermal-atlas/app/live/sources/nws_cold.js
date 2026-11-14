/* ==== live/sources/nws_cold.js ==== */
/* National Weather Service, the cold side. For 20 points across the 12 counties it reads the forecaster grid itself
   (api.weather.gov/gridpoints): the official low of each of the next seven nights, the lowest apparent temperature and wind
   chill of the night, snow and ice amounts, wintry weather types, the highs, and from high and low the forecast heating
   degree days. One more request returns every active watch, warning and advisory for the 12 counties.
   21 requests, about 215 KB on the wire. Each point's grid cell is baked into live/geo.js; a point that fails keeps its
   last good nights, marked stale. */
(function (root) {
  'use strict';
  const L = root.TDA_LIVE, API = 'https://api.weather.gov';
  const TZ = 'America/Chicago', H = 36e5;
  /* a second between calls and three patient retries: the rate limit is not published, and errors are cached for a minute */
  const OPT = { headers: { Accept: 'application/geo+json' }, gapMs: 700, retries: 2, timeoutMs: 25000 };
  /* The run's own clock, so that it ends inside the 180 seconds the runner gives it whatever the host does (a host that
     hangs costs 78 seconds a request): three tries while 90 seconds are left, then one try no longer than what is left,
     and with under 5 seconds to go the request is not made and the point keeps its last good nights. */
  const LIMIT = 170000;
  const patience = t0 => { const left = LIMIT - (Date.now() - t0); if (left < 5000) throw new Error('not asked: the run was out of time'); return left > 90000 ? OPT : Object.assign({}, OPT, { retries: 0, timeoutMs: Math.min(OPT.timeoutMs, left) }); };
  const DATE_FMT = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
  const localDate = ms => DATE_FMT.format(new Date(ms));                                  // YYYY-MM-DD in the metro's time zone
  const prevDay = ymd => new Date(Date.parse(ymd + 'T12:00:00Z') - 864e5).toISOString().slice(0, 10);
  /* grid values are exact conversions of whole °F (6.666… °C is 44°F): convert first, round after */
  const c2f = c => c == null ? null : Math.round(c * 9 / 5 + 32);
  /* "start/duration" as the grid writes it: 2026-11-14T01:00:00+00:00/PT14H, P1DT6H … */
  const DUR = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/;
  function parseInterval(vt) {
    const s = String(vt), i = s.indexOf('/'); if (i < 0) return null;
    const t0 = Date.parse(s.slice(0, i)), m = DUR.exec(s.slice(i + 1)); if (Number.isNaN(t0) || !m) return null;
    const h = (+(m[1] || 0)) * 24 + (+(m[2] || 0)) + (+(m[3] || 0)) / 60 + (+(m[4] || 0)) / 3600;
    return { t0, t1: t0 + h * H, h };
  }
  const layer = (P, key) => ((P[key] || {}).values || []).map(v => { const iv = v ? parseInterval(v.validTime) : null; return iv ? { t0: iv.t0, t1: iv.t1, h: iv.h, v: v.value } : null; }).filter(Boolean);
  const overlap = (a, w) => Math.max(0, Math.min(a.t1, w.t1) - Math.max(a.t0, w.t0));
  const WINTRY = { snow: 1, snow_showers: 1, sleet: 1, freezing_rain: 1, freezing_drizzle: 1, ice_crystals: 1, blowing_snow: 1, freezing_fog: 1, frost: 1 };
  /* The raw grid of one cell → nights and days.
     night: d = the evening date ("the night of"), m = the morning the low happens, lowF the official forecast low, appF and wcF
     the lowest apparent temperature and wind chill inside the night, snowIn and iceIn (null when the layer does not reach that
     night), wx the wintry weather types, part true when most of the night is already over.
     day: hiF, and hdd = heating degree days base 65 from that day's high and its morning low, rounded the way the Weather Service does. */
  function gridNights(P, nowMs) {
    P = P || {};
    const minT = layer(P, 'minTemperature'), maxT = layer(P, 'maxTemperature'), app = layer(P, 'apparentTemperature'), wc = layer(P, 'windChill'), snow = layer(P, 'snowfallAmount'), ice = layer(P, 'iceAccumulation');
    const wx = ((P.weather || {}).values || []).map(v => { const iv = v ? parseInterval(v.validTime) : null; return iv ? { t0: iv.t0, t1: iv.t1, v: Array.isArray(v.value) ? v.value : [] } : null; }).filter(Boolean);
    const minOver = (Ly, w) => { let m = null; for (const a of Ly) if (a.v != null && overlap(a, w) > 0) m = m == null ? a.v : Math.min(m, a.v); return m; };
    const sumOver = (Ly, w) => { let s = 0, hit = false; for (const a of Ly) { const o = overlap(a, w); if (o > 0 && a.v != null) { hit = true; s += a.v * o / (a.t1 - a.t0); } } return hit ? s : null; };
    const inch = (mm, dp) => mm == null ? null : Math.round(mm / 25.4 * Math.pow(10, dp)) / Math.pow(10, dp);
    const nights = minT.filter(w => w.t1 > nowMs && w.v != null).map(w => {
      const types = {}; for (const a of wx) if (overlap(a, w) > 0) for (const x of a.v) if (x && WINTRY[x.weather]) types[x.weather] = 1;
      const m = localDate(w.t1 - 1), n = { d: prevDay(m), m, lowF: c2f(w.v), appF: c2f(minOver(app, w)), wcF: c2f(minOver(wc, w)), snowIn: inch(sumOver(snow, w), 1), iceIn: inch(sumOver(ice, w), 2), wx: Object.keys(types) };
      if (w.h < 10) n.part = true;
      return n;
    });
    const lowOn = {}; nights.forEach(n => { if (!n.part) lowOn[n.m] = n.lowF; });
    const days = maxT.filter(w => w.t1 > nowMs && w.v != null).map(w => { const d = localDate((w.t0 + w.t1) / 2), hiF = c2f(w.v), lo = lowOn[d]; return { d, hiF, hdd: lo == null ? null : Math.max(0, 65 - Math.floor((hiF + lo) / 2 + 0.5)) }; });
    return { upd: P.updateTime || null, nights, days };
  }

  /* ---------- alerts ---------- */
  /* Event names as the Weather Service sends them since the cold hazard renaming of October 2024 (Wind Chill and Hard Freeze
     products are retired; the old names stay in the pattern for stored records). tier is on the scale of live/derive.js. */
  const COLD_EVENT = /freez|frost|cold|wind chill|winter|ice storm|blizzard|snow|sleet/i;
  const EMERGENCY = /extreme cold|winter storm|ice storm|blizzard/i;
  const alertTier = ev => !COLD_EVENT.test(ev) ? 0 : EMERGENCY.test(ev) || /cold weather advisory|wind chill|hard freeze/i.test(ev) ? 4 : /frost/i.test(ev) ? 2 : 3;
  const VTEC = /^\/[OTEX]\.([A-Z]{3})\.[A-Z]{4}\.([A-Z]{2})\.([A-Z])\.\d{4}\./;
  function parseAlerts(j, byZone) {
    return ((j && j.features) || []).map(f => {
      const p = f.properties || {}, ugc = (p.geocode && p.geocode.UGC) || [], counties = [...new Set(ugc.map(z => byZone[z]).filter(Boolean))];
      if (!counties.length || !p.event || p.messageType === 'Cancel') return null;
      const v = VTEC.exec(((p.parameters || {}).VTEC || [])[0] || ''), ev = p.event, cold = COLD_EVENT.test(ev);
      const what = /\* WHAT\.\.\.([\s\S]*?)(?:\n\s*\n|\n\* |$)/.exec(p.description || '');
      /* the hazard runs from onset to ends; "expires" is when this message lapses, which can come before the hazard starts */
      return { id: p.id || f.id || '', event: ev, cold, tier: alertTier(ev), emergency: cold && EMERGENCY.test(ev), code: v ? v[2] + '.' + v[3] : '', action: v ? v[1] : '', severity: p.severity || '', urgency: p.urgency || '', sent: p.sent || null, onset: p.onset || p.effective || null, ends: p.ends || p.expires || null, headline: p.headline || '', what: what ? what[1].replace(/\s+/g, ' ').trim().slice(0, 220) : '', counties };
    }).filter(Boolean);
  }

  L.register({
    id: 'nws_cold', name: 'Forecast lows, heating load and alerts', publisher: 'National Weather Service, Fort Worth office (NOAA)', page: 'https://www.weather.gov/fwd/',
    about: 'The forecaster grid at 20 points across the 12 counties: the low of each of the next seven nights, wind chill, snow and ice, the highs and the forecast heating degree days, plus every active watch, warning and advisory. Drives the cold triggers in the Heat Desk, the toolbar badge and the notifications.',
    hosts: ['api.weather.gov'], cadence: 'daily', cors: true, grade: 'A', terms: 'U.S. Government work, public domain. Not an official product once derived.', timeoutMs: 180000,
    labels: { minLow: ['Coldest forecast low, next seven nights', 'degF'], hdd7: ['Forecast heating degree days, next seven days (mean of the points)', 'int'], freezePoints: ['Forecast points with a freeze (32°F or lower)', 'int'], coldAlerts: ['Active cold weather alerts', 'int'], alerts: ['All active alerts in the 12 counties', 'int'] },
    async run(ctx) {
      const G = ctx.geo, prev = ctx.prev || {}, grids = Object.assign({}, prev.grids || {}), now = +ctx.now;     /* grids: cells looked up again after a baked one went away */
      const old = {}, t0 = Date.now(); (prev.points || []).forEach(p => { old[p.id] = p; });
      const lookup = async pt => { const p = (await ctx.http.json(`${API}/points/${pt.lat},${pt.lon}`, patience(t0))).properties; return { wfo: p.gridId, x: p.gridX, y: p.gridY, czone: String(p.county || '').split('/').pop() }; };
      const zones = G.counties.map(c => c.zone).concat(G.counties.map(c => c.czone)).join(',');
      let alerts = prev.alerts || [], alertsErr = null;
      try { alerts = parseAlerts(await ctx.http.json(`${API}/alerts/active?zone=${zones}`, patience(t0)), G.byZone); } catch (e) { alertsErr = String((e && e.message) || e).slice(0, 120); if (prev.alertsAt && now - +new Date(prev.alertsAt) > 12 * H) alerts = []; }
      const out = []; let failed = 0, lastErr = null;
      for (const pt of G.points) {
        const rec = { id: pt.id, name: pt.name, lat: pt.lat, lon: pt.lon, county: pt.county, nights: [], days: [] };
        try {
          let g = grids[pt.id] || (pt.gx != null ? { wfo: 'FWD', x: pt.gx, y: pt.gy } : null), j;
          if (!g) g = grids[pt.id] = await lookup(pt);
          try { j = await ctx.http.json(`${API}/gridpoints/${g.wfo}/${g.x},${g.y}`, patience(t0)); }
          catch (e) { if (!(e && e.status === 404)) throw e; g = grids[pt.id] = await lookup(pt); j = await ctx.http.json(`${API}/gridpoints/${g.wfo}/${g.x},${g.y}`, patience(t0)); }       /* the grid moved: find the new cell and keep it */
          if (!j || !j.properties || !j.properties.minTemperature) throw new Error('the grid has no minimum temperature layer');
          const r = gridNights(j.properties, now); if (!r.nights.length) throw new Error('no night in the grid');
          rec.nights = r.nights; rec.days = r.days; rec.upd = r.upd; rec.grid = `${g.wfo}/${g.x},${g.y}`;
          if (g.czone && G.byZone[g.czone]) rec.county = G.byZone[g.czone];
        } catch (e) {
          failed++; if (!lastErr || !/^not asked/.test(String(e && e.message))) lastErr = e; rec.err = String((e && e.message) || e).slice(0, 120);
          const o = old[pt.id]; if (o && o.nights && o.nights.length) { rec.nights = o.nights; rec.days = o.days || []; rec.upd = o.upd || null; rec.grid = o.grid; rec.stale = true; }
        }
        out.push(rec);
      }
      if (failed === G.points.length) throw lastErr || new Error('no forecast point answered');
      const upds = out.filter(p => p.upd && !p.stale).map(p => p.upd).sort();
      /* The freeze spell the forecast is in: since, the evening of its first night, kept from run to run while freezing nights
         follow one another; last, the night the run of them ends on. live/derive.js keys the freeze notice by since, so a
         spell is announced once and not again every morning as its nights pass. */
      const fzF = (L.derive && L.derive.TH && L.derive.TH.freeze) || 32, from = prevDay(localDate(now)), next = d => new Date(Date.parse(d + 'T12:00:00Z') + 864e5).toISOString().slice(0, 10);
      const fz = [...new Set(out.flatMap(p => p.nights.filter(n => n.d >= from && n.lowF != null && n.lowF <= fzF).map(n => n.d)))].sort(), ps = prev.spell;
      let spell = null;
      if (fz.length) { let last = fz[0]; for (const d of fz) if (d <= next(last)) last = d; spell = { since: ps && ps.since && ps.last && fz[0] <= next(ps.last) ? ps.since : fz[0], last }; }
      else if (ps && ps.last >= from) spell = ps;                    /* a forecast that drops the freeze for a morning does not start the spell over */
      return { v: 2, updated: upds[upds.length - 1] || null, oldest: upds[0] || null, points: out, failed, alerts, alertsErr, alertsAt: alertsErr ? (prev.alertsAt || null) : ctx.now.toISOString(), grids, spell };
    },
    digest(d) {
      const live = d.points.filter(p => !p.err || p.stale), lows = live.flatMap(p => p.nights.filter(n => !n.part).map(n => n.lowF));
      const h7 = live.map(p => p.days.slice(0, 7).reduce((s, x) => s + (x.hdd || 0), 0)).filter((v, i) => live[i].days.length >= 5);
      return { minLow: lows.length ? Math.min(...lows) : null, hdd7: h7.length ? Math.round(h7.reduce((a, b) => a + b, 0) / h7.length) : null, freezePoints: live.filter(p => p.nights.some(n => n.lowF <= 32)).length, coldAlerts: d.alerts.filter(a => a.cold).length, alerts: d.alerts.length };
    },
  });
  L.COLD_EVENT = COLD_EVENT;
  L.nws = { gridNights, parseInterval, parseAlerts, alertTier, localDate, prevDay, c2f };
})(typeof globalThis !== 'undefined' ? globalThis : self);
