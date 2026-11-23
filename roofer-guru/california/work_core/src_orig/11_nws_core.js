/* ==== 11_nws_core.js ==== */
/* ==== nws_core ==== */
"use strict";
/* ============================ NWSX: National Weather Service reader, storm triggers and roofing work windows ============================ */
/* Sources: api.weather.gov (points, gridpoint forecast, hourly forecast, raw grid with wind gusts, thunder and weather attributes,
   alerts with hail and gust parameters, station observations, forecast discussions), the NHC Atlantic tropical weather outlook and
   active storms, and the SPC day 1 to 3 convective outlooks, for nine Louisiana points, one per region. A snapshot taken October 6,
   2026 is embedded so the desk works offline and inside the Claude viewer, whose network rules block live calls; outside the viewer,
   Refresh pulls the live forecast. */
const NWSX = (() => {
  const SNAP = window.__NWS_SNAPSHOT__ || null;
  const REGOF = { 'New Orleans': 1, 'Baton Rouge': 2, 'Houma': 3, 'Lafayette': 4, 'Lake Charles': 5, 'Alexandria': 6, 'Shreveport': 7, 'Monroe': 8, 'Hammond': 9 };
  const PTS0 = [['New Orleans', 29.9511, -90.0715], ['Baton Rouge', 30.4515, -91.1871], ['Lafayette', 30.2241, -92.0198], ['Lake Charles', 30.2266, -93.2174], ['Shreveport', 32.5252, -93.7502], ['Monroe', 32.5093, -92.1193], ['Alexandria', 31.3113, -92.4451], ['Houma', 29.5958, -90.7195], ['Hammond', 30.5044, -90.4612]];
  let D = SNAP ? JSON.parse(JSON.stringify(SNAP)) : { fetched: null, source: '', points: PTS0.map(([city, lat, lon]) => ({ city, lat, lon, periods: [], hourly: [], grid: {} })), alerts: [], obs: [], afd: {}, nhc: {}, spc: {} };
  let LIVE = false;
  const hh = h => { h = ((h % 24) + 24) % 24; return h === 0 ? '12a' : h < 12 ? h + 'a' : h === 12 ? '12p' : (h - 12) + 'p'; };
  const partsOf = iso => { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2})/); return m ? { y: +m[1], mo: +m[2], d: +m[3], h: +m[4], date: `${m[1]}-${m[2]}-${m[3]}` } : null; };
  const dowOf = date => new Date(date + 'T12:00:00').getDay();
  /* ---------- crew calendar: holiday weekends when crews are off and leads slow ---------- */
  const HOL = [['2026-10-09', '2026-10-12', 'Columbus Day weekend'], ['2026-11-25', '2026-11-29', 'Thanksgiving'], ['2026-12-23', '2026-12-27', 'Christmas'], ['2026-12-31', '2027-01-03', 'New Year'], ['2027-02-05', '2027-02-09', 'Mardi Gras'], ['2027-05-28', '2027-05-31', 'Memorial Day weekend'], ['2027-06-01', '2027-06-01', 'Hurricane season opens'], ['2027-07-02', '2027-07-05', 'Independence Day'], ['2027-09-03', '2027-09-06', 'Labor Day weekend']];
  const holiday = date => { const h = HOL.find(([a, b]) => date >= a && date <= b); return h ? h[2] : ''; };
  /* ---------- the lead clock: share of roofing leads by day and hour, 1.0 = an average hour (assumption, grade D, until account actuals replace it) ---------- */
  const BASE = (() => { const day = [0.25, 0.15, 0.1, 0.1, 0.15, 0.35, 0.8, 1.4, 1.9, 2.0, 1.9, 1.8, 1.7, 1.7, 1.6, 1.6, 1.5, 1.4, 1.3, 1.1, 0.9, 0.7, 0.5, 0.35]; const dw = [0.55, 1.15, 1.15, 1.1, 1.1, 1.0, 0.8]; const g = dw.map(f => day.map(v => v * f)); const m = mean(g.flat()); return g.map(r => r.map(v => v / m)); })();
  const BASE_AI = BASE;
  /* grid values come as [validTime "start/duration", value]; find the value covering an hour */
  function gridAt(arr, iso) { if (!arr || !arr.length) return null; const t = Date.parse(iso); for (const [vt, v] of arr) { const [s, dur] = String(vt).split('/'); const t0 = Date.parse(s); const m = String(dur || 'PT1H').match(/P(?:(\d+)D)?T?(?:(\d+)H)?/); const len = ((+(m && m[1]) || 0) * 24 + (+(m && m[2]) || 0) || 1) * 3600e3; if (t >= t0 && t < t0 + len) return v; } return null; }
  const kmh = v => isN(v) ? v / 1.609 : null;
  /* ---------- per hour: storm demand index (damage potential that becomes roofing work in the days after) and the work window ---------- */
  function hourly(pi) {
    const p = D.points[pi]; if (!p) return []; const grid = p.grid || {};
    return (p.hourly || []).map(h => { const P = partsOf(h.t); if (!P) return null; const dow = dowOf(P.date);
      const pop = +h.pop || 0; const thun = +gridAt(grid.probabilityOfThunder, h.t) || 0; const gust = kmh(gridAt(grid.windGust, h.t)); const wx = String(gridAt(grid.weather, h.t) || '') + ' ' + String(h.short || '');
      const hail = /large_hail|hail/i.test(wx), dwind = /damaging_wind/i.test(wx), trop = /tropical storm|hurricane/i.test(wx);
      const why = []; let risk = 1;
      if (thun >= 15) { risk += 0.6 * thun / 100; why.push(`thunder ${thun}%`); }
      if (isN(gust) && gust >= 30) { risk += (gust - 30) / 20; why.push(`gusts ${Math.round(gust)} mph`); }
      if (hail) { risk += 1.0; why.push('hail possible'); }
      if (dwind) { risk += 0.8; why.push('damaging wind possible'); }
      if (trop) { risk += 1.5; why.push('tropical conditions'); }
      const heat = isN(h.tempF) && isN(h.rh) ? heatIndex(h.tempF, h.rh) : h.tempF;
      let work = 'good'; const wwhy = [];
      if (pop >= 50) { work = 'blocked'; wwhy.push(`rain ${pop}%`); } else if (pop >= 25) { work = 'marginal'; wwhy.push(`rain ${pop}%`); }
      if (thun >= 30) { work = 'blocked'; wwhy.push('lightning'); }
      if (isN(gust) && gust >= 30) { work = 'blocked'; wwhy.push(`gusts ${Math.round(gust)} mph`); } else if (isN(gust) && gust >= 22 && work === 'good') { work = 'marginal'; wwhy.push(`gusts ${Math.round(gust)} mph`); }
      if (isN(heat) && heat >= 105 && work === 'good') { work = 'marginal'; wwhy.push(`heat index ${Math.round(heat)}`); }
      if (!h.isDay && work === 'good') work = 'night';
      const hol = holiday(P.date);
      return { t: h.t, date: P.date, h: P.h, dow, tempF: h.tempF, heat, pop, thun, gust, short: h.short, base: BASE[dow][P.h], ai: BASE[dow][P.h], wx: risk, hol: hol || '', why, risk, work, wwhy, isDay: h.isDay };
    }).filter(Boolean);
  }
  function heatIndex(T, R) { if (T < 80) return T; return -42.379 + 2.04901523 * T + 10.14333127 * R - 0.22475541 * T * R - 0.00683783 * T * T - 0.05481717 * R * R + 0.00122874 * T * T * R + 0.00085282 * T * R * R - 0.00000199 * T * T * R * R; }
  const level = r => r >= 2.0 ? 'high' : r >= 1.4 ? 'elevated' : r >= 0.8 ? 'normal' : 'low';
  /* windows: runs of storm trigger hours (demand after) and runs of blocked work hours (crews) per point */
  function windows(pi) {
    const H = hourly(pi); const out = []; let cur = null;
    H.forEach(x => { const hot = x.risk >= 1.4; if (hot && cur && x.date === cur.date && x.h === cur.end + 1) { cur.end = x.h; cur.peak = Math.max(cur.peak, x.risk); x.why.forEach(w => { if (!cur.why.includes(w)) cur.why.push(w); }); } else if (hot) { cur = { date: x.date, dow: x.dow, start: x.h, end: x.h, peak: x.risk, why: x.why.slice() }; out.push(cur); } });
    return out.map(w => Object.assign(w, { level: level(w.peak), bid: w.peak >= 2.0 ? 25 : 15 }));
  }
  function workDays(pi) {
    const H = hourly(pi).filter(x => x.isDay); const by = {};
    H.forEach(x => { const o = by[x.date] = by[x.date] || { date: x.date, dow: x.dow, good: 0, marginal: 0, blocked: 0, why: x.hol ? [x.hol] : [], hol: x.hol || '' }; o[x.work === 'night' ? 'good' : x.work] += 1; x.wwhy.forEach(w => { if (!o.why.includes(w)) o.why.push(w); }); });
    return Object.values(by).map(o => Object.assign(o, { verdict: o.blocked >= 4 ? 'no tear offs' : o.blocked + o.marginal >= 4 ? 'repairs and inspections' : 'full production' }));
  }
  /* ---------- alerts mapped to roofing actions ---------- */
  const ALERT_MAP = [
    [/Hurricane|Tropical Storm|Storm Surge/i, 'Tropical', 'Before landfall: run preparation and tarp capacity messages, never fear; pause replacement ads in the warned parishes while the storm passes. After it: emergency tarping and inspection ads in the hit ZIPs (module 02 shows the footprint), price books frozen at pre storm levels (R.S. 29:732), no claim help or deductible language (R.S. 37:2159.1, 51:451), three day notice on every sale at the home (16 CFR 429).'],
    [/Severe Thunderstorm/i, 'Severe storm', 'Read the hail size and gust in the warning. With hail of 1 inch or more or gusts of 58 mph or more, log the warned ZIPs and launch hail or wind inspection ads there once the storm passes, for 30 days; raise bids 15 to 25 percent for the first 72 hours.'],
    [/Tornado/i, 'Tornado', 'After the event: tarp and inspection ads in the path ZIPs once the NWS damage survey is out; no canvassing without the three day cancellation notice; keep crews off damaged structures until cleared.'],
    [/Flash Flood|Flood Warning|Flood Watch|Flood Advisory/i, 'Flood', 'Flood damage is not roof damage: keep roofing ads on, avoid flood imagery. Heavy rain finds weak flashing, so leak repair ads earn their keep for the next 72 hours.'],
    [/Wind Advisory|High Wind|Lake Wind/i, 'Wind', 'Gusts over 30 mph: no tear offs. After the event, repair ads for lifted and missing shingles in the advisory area.'],
    [/Heat Advisory|Excessive Heat|Extreme Heat/i, 'Heat', 'Crew safety: start tear offs at first light and stop by early afternoon; hydration breaks; shingles scuff in heat.'],
    [/Winter Storm|Ice|Freez|Cold Weather|Wind Chill|Sleet/i, 'Freeze', 'No work on iced or frosted decks. After a hard freeze, attic pipe leaks look like roof leaks: repair ads with diagnosis language, not storm language.'],
    [/Dense Fog/i, 'Fog', 'No roofing effect beyond early starts.'],
  ];
  const actionFor = ev => { const m = ALERT_MAP.find(([re]) => re.test(ev)); return m ? { kind: m[1], text: m[2] } : { kind: 'Other', text: 'Read the alert; no standing action.' }; };
  /* ---------- live refresh (outside the viewer only) ---------- */
  async function gj(u) { const r = await fetch(u, { headers: { Accept: 'application/geo+json' } }); if (!r.ok) throw new Error(r.status + ' ' + u); return r.json(); }
  async function refresh(onStep) {
    if (inViewer()) throw new Error('The Claude viewer blocks live calls to api.weather.gov; showing the embedded snapshot.');
    const pts = [];
    for (const [city, lat, lon] of PTS0) { onStep && onStep(city); const P = (await gj(`https://api.weather.gov/points/${lat},${lon}`)).properties; const rec = { city, lat, lon, office: P.gridId, gridX: P.gridX, gridY: P.gridY, zone: String(P.forecastZone || '').split('/').pop(), county: String(P.county || '').split('/').pop(), radar: P.radarStation };
      const [f, h, g] = await Promise.all([gj(P.forecast), gj(P.forecastHourly), gj(P.forecastGridData)]);
      rec.updated = f.properties.updateTime || f.properties.updated; rec.periods = f.properties.periods.map(x => ({ name: x.name, start: x.startTime, end: x.endTime, isDay: x.isDaytime, tempF: x.temperature, short: x.shortForecast, pop: (x.probabilityOfPrecipitation || {}).value || 0, wind: x.windSpeed, detail: String(x.detailedForecast || '').slice(0, 300) }));
      rec.hourly = h.properties.periods.slice(0, 120).map(x => ({ t: x.startTime, tempF: x.temperature, rh: (x.relativeHumidity || {}).value, pop: (x.probabilityOfPrecipitation || {}).value || 0, wind: x.windSpeed, short: x.shortForecast, isDay: x.isDaytime }));
      const gp = g.properties; rec.grid = {}; ['probabilityOfThunder', 'quantitativePrecipitation', 'windGust', 'windSpeed', 'probabilityOfPrecipitation', 'visibility'].forEach(k => rec.grid[k] = ((gp[k] || {}).values || []).slice(0, 72).map(v => [v.validTime, v.value])); rec.grid.weather = ((gp.weather || {}).values || []).slice(0, 72).map(v => [v.validTime, [...new Set((v.value || []).map(w => (w.weather || '') + (w.intensity ? ':' + w.intensity : '') + (w.attributes && w.attributes.length ? '[' + w.attributes.join('|') + ']' : '')).filter(x => x && x !== 'null'))].join(', ')]);
      pts.push(rec); }
    const a = await gj('https://api.weather.gov/alerts/active?area=LA');
    D = Object.assign({}, D, { fetched: new Date().toISOString(), source: 'api.weather.gov, live', points: pts, alerts: (a.features || []).map(x => { const p = x.properties; const prm = p.parameters || {}; return { id: p.id, event: p.event, severity: p.severity, urgency: p.urgency, headline: p.headline, description: String(p.description || '').slice(0, 1500), instruction: String(p.instruction || '').slice(0, 800), onset: p.onset, ends: p.ends, expires: p.expires, areas: p.areaDesc, sent: p.sent, hail: (prm.maxHailSize || [null])[0], gust: (prm.maxWindGust || [null])[0] }; }) });
    LIVE = true; BUS.emit('nws'); return D;
  }
  function scheduleCSV() {
    const rows = []; D.points.forEach((p, i) => windows(i).forEach(w => rows.push([`LA_STORM_GOOGLE_${(REGN[REGOF[p.city]] || p.city).toUpperCase().replace(/[^A-Z]+/g, '_')}`, p.city, REGN[REGOF[p.city]] || '', w.date, w.start, w.end + 1, w.level, w.bid, D_(w.peak), w.why.join('; ')])));
    return toCSV(['campaign', 'point', 'region', 'date', 'start_hour', 'end_hour', 'storm_level', 'bid_adjustment_pct_next_72h', 'peak_storm_index', 'reasons'], rows, `Storm trigger windows from the NWS forecast (${D.fetched || 'no snapshot'}). Bids apply to the 72 hours after a window passes, when owners look for roofers; times are local.`);
  }
  const D_ = v => +(+v).toFixed(2);
  return { get D() { return D; }, get live() { return LIVE; }, PTS0, REGOF, hh, partsOf, holiday, BASE, BASE_AI, hourly, windows, workDays, level, actionFor, ALERT_MAP, refresh, scheduleCSV, gridAt };
})();
