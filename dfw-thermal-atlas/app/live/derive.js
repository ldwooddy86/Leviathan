/* ==== live/derive.js ==== */
/* Pure reads of the live records, shared by the page, the popup and the background worker: the cold picture for the next
   seven nights (by night, by county, for the metro), the heating load the forecast carries, the toolbar badge and the
   notices. No DOM, no network. Inputs are the publishers' own numbers (grade A); the thresholds and the words built on
   them are planning rules (grade C). */
(function (root) {
  'use strict';
  const L = root.TDA_LIVE;
  /* Night low thresholds in °F. cool: furnaces start cycling; cold: the first hard use, when weak igniters and sensors show up;
     freeze: sustained run time and heat pump auxiliary heat; hard: pipes, long run times, emergency volume. */
  const TH = { cool: 50, cold: 40, freeze: 32, hard: 25 };
  /* A day of 15 heating degree days averages 50°F: the heat runs most of the day even without a cold night. */
  const HEAT_ON_HDD = 15;
  const TIER = ['mild', 'cool', 'cold', 'freeze', 'hard freeze'];
  const tierOf = (f, th) => { th = th || TH; return f == null ? 0 : f <= th.hard ? 4 : f <= th.freeze ? 3 : f <= th.cold ? 2 : f <= th.cool ? 1 : 0; };
  const WD = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dow = d => WD[new Date(d + 'T12:00:00Z').getUTCDay()];
  const md = d => MO[+d.slice(5, 7) - 1] + ' ' + (+d.slice(8, 10));
  /* today's date in the metro's time zone, as YYYY-MM-DD */
  function localDay(now, tz) {
    try { const p = new Intl.DateTimeFormat('en-CA', { timeZone: tz || 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(now)).reduce((o, x) => (o[x.type] = x.value, o), {}); return `${p.year}-${p.month}-${p.day}`; }
    catch (e) { return new Date(now).toISOString().slice(0, 10); }
  }
  const sum = a => a.reduce((s, x) => s + x, 0);
  const mean = a => a.length ? sum(a) / a.length : null;
  const median = a => { const b = a.slice().sort((x, y) => x - y); const m = b.length >> 1; return b.length ? (b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2) : null; };
  const list = a => a.length <= 1 ? a.join('') : a.length === 2 ? a.join(' and ') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
  const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  const nightName = (d, today) => d === today ? 'tonight' : dow(d) + ' night';
  /* Normal heating degree days of a calendar day at DFW Airport: the NCEI 1991 to 2020 monthly normals (January first), spread
     evenly inside each month and interpolated between mid months. Checked against the Weather Service's own figure for
     November 6 to 12 (54): this gives 56. */
  const NORM_HDD = [582.0, 413.4, 246.2, 82.4, 9.9, 0.1, 0.0, 0.0, 3.4, 69.2, 285.2, 528.3], DIM = [31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  function normHdd(ymd) {
    const m = +ymd.slice(5, 7) - 1, day = +ymd.slice(8, 10), mid = DIM[m] / 2 + 0.5, rate = i => NORM_HDD[(i + 12) % 12] / DIM[(i + 12) % 12];
    return day >= mid ? rate(m) + (rate(m + 1) - rate(m)) * (day - mid) / ((DIM[m] + DIM[(m + 1) % 12]) / 2) : rate(m) + (rate(m - 1) - rate(m)) * (mid - day) / ((DIM[m] + DIM[(m + 11) % 12]) / 2);
  }
  /* The season so far, when the climate collector has run: { hdd, norm, firstFreeze, through } at DFW Airport, or null. */
  function seasonOf(recs, now, opt) {
    if (opt && opt.season !== undefined) return opt.season;
    try { const r = recs && recs.acis_season; if (!r || !r.data || !L.climate || !L.climate.status) return null; const s = L.climate.status(r.data, root.__CLIMATE_BASE__ || null, now); if (!s || !s.ok || !s.metro) return null; const ff = s.metro.firstFreeze; return { hdd: s.metro.hdd, norm: s.metro.norm, firstFreeze: ff && ff.state === 'occurred' ? ff.date : null, through: s.through }; }
    catch (e) { return null; }
  }

  /* The cold picture. recs: { nws_cold: record, acis_season: record (optional) }. Always returns an object that is safe to render. */
  function cold(recs, now, opt) {
    opt = opt || {}; const th = Object.assign({}, TH, opt.th || {});
    const rec = recs && recs.nws_cold, d = rec && rec.data;
    const empty = { ok: false, active: false, tier: 0, tierName: TIER[0], nights: [], days: [], byCounty: {}, points: [], alerts: [], coldAlerts: [], th, eyebrow: 'This week', headline: '', sub: '', actions: [], notice: null, at: rec && rec.at || null, stale: true };
    if (!d || !Array.isArray(d.points)) return empty;
    const today = localDay(now, (L.geo || {}).tz), end = +new Date(now);
    const pts = d.points.map(p => Object.assign({}, p, { nights: (p.nights || []).filter(n => n.d >= today && n.lowF != null), days: (p.days || []).filter(x => x.d >= today) })).filter(p => p.nights.length);
    if (!pts.length) return Object.assign(empty, { headline: 'The stored forecast has run out', sub: 'Refresh the live data to get the next seven nights.' });
    const dates = [...new Set(pts.flatMap(p => p.nights.map(n => n.d)))].sort().slice(0, 7);
    const at = (p, dt) => p.nights.find(q => q.d === dt) || null;
    /* ---- nights across the metro ---- */
    const nights = dates.map(dt => {
      const xs = pts.map(p => { const n = at(p, dt); return n ? { f: n.lowF, n, p } : null; }).filter(Boolean);
      const lo = xs.reduce((a, b) => (b.f < a.f ? b : a)), hi = xs.reduce((a, b) => (b.f > a.f ? b : a)), apps = xs.map(x => x.n.appF).filter(v => v != null), sn = xs.map(x => x.n.snowIn).filter(v => v != null), ic = xs.map(x => x.n.iceIn).filter(v => v != null);
      return { d: dt, name: nightName(dt, today), label: (dt === today ? 'Tonight' : dow(dt).slice(0, 3)) + ' ' + md(dt), minF: lo.f, minAt: lo.p.name, minCounty: lo.p.county, maxF: hi.f, medF: Math.round(median(xs.map(x => x.f))), appF: apps.length ? Math.min(...apps) : null, snowIn: sn.length ? Math.max(...sn) : null, iceIn: ic.length ? Math.max(...ic) : null, wintry: [...new Set(xs.flatMap(x => x.n.wx || []))], n32: xs.filter(x => x.f <= th.freeze).length, n40: xs.filter(x => x.f <= th.cold).length, n: xs.length, tier: tierOf(lo.f, th), medTier: tierOf(median(xs.map(x => x.f)), th) };
    });
    /* ---- days: the heating load ---- */
    const dayDates = [...new Set(pts.flatMap(p => p.days.filter(x => x.hdd != null).map(x => x.d)))].sort().slice(0, 7);
    const days = dayDates.map(dt => { const xs = pts.map(p => p.days.find(x => x.d === dt)).filter(x => x && x.hdd != null); return { d: dt, label: dow(dt).slice(0, 3) + ' ' + md(dt), hdd: Math.round(mean(xs.map(x => x.hdd))), hiMin: Math.min(...xs.map(x => x.hiF)), hiMax: Math.max(...xs.map(x => x.hiF)), norm: Math.round(normHdd(dt) * 10) / 10 }; });
    const hdd7 = days.length >= 5 ? sum(days.map(x => x.hdd)) : null, hddNorm7 = days.length >= 5 ? Math.round(sum(days.map(x => x.norm))) : null;
    const hddPeak = days.length ? days.reduce((a, b) => (b.hdd > a.hdd ? b : a)) : null;
    const loadPct = hdd7 != null && hddNorm7 >= 10 ? Math.round(100 * hdd7 / hddNorm7) : null;
    /* ---- alerts in effect or ahead ---- */
    const alerts = (d.alerts || []).filter(a => !a.ends || +new Date(a.ends) > end), coldAlerts = alerts.filter(a => a.cold);
    /* ---- counties: what most of the county gets (the mean of its points) and its cold edge (the coldest point) ---- */
    const byCounty = {};
    ((L.geo || {}).counties || []).forEach(c => {
      const ps = pts.filter(p => p.county === c.name); if (!ps.length) return;
      const lows = dates.map(dt => { const ns = ps.map(p => at(p, dt)).filter(Boolean); if (!ns.length) return null; const fs = ns.map(n => n.lowF), ap = ns.map(n => n.appF).filter(v => v != null); return { d: dt, f: Math.round(mean(fs)), c: Math.min(...fs), app: ap.length ? Math.min(...ap) : null }; }).filter(Boolean);
      if (!lows.length) return;
      const lo = lows.reduce((a, b) => (b.c < a.c ? b : a)), typ = lows.reduce((a, b) => (b.f < a.f ? b : a));
      const hd = dayDates.map(dt => { const xs = ps.map(p => p.days.find(x => x.d === dt)).filter(x => x && x.hdd != null); return xs.length ? { d: dt, hdd: Math.round(mean(xs.map(x => x.hdd))) } : null; }).filter(Boolean);
      const al = coldAlerts.filter(a => a.counties.indexOf(c.name) >= 0), apps = lows.map(x => x.app).filter(v => v != null);
      const tempTier = tierOf(typ.f, th), alertTier = al.length ? Math.max(...al.map(a => a.tier || 3)) : 0;
      byCounty[c.name] = { minF: lo.c, night: lo.d, typF: typ.f, typNight: typ.d, tempTier, edgeTier: tierOf(lo.c, th), alertTier, tier: Math.max(tempTier, alertTier), emergency: al.some(a => a.emergency) || typ.f <= 15 || (apps.length ? Math.min(...apps) <= 0 : false),
        n50: lows.filter(x => x.f <= th.cool).length, n40: lows.filter(x => x.f <= th.cold).length, n32: lows.filter(x => x.f <= th.freeze).length, n25: lows.filter(x => x.f <= th.hard).length, edge40: lows.filter(x => x.c <= th.cold && x.f > th.cold).length, edge32: lows.filter(x => x.c <= th.freeze && x.f > th.freeze).length,
        minApp: apps.length ? Math.min(...apps) : null, hdd7: hd.length >= 5 ? sum(hd.map(x => x.hdd)) : null, hddPeak: hd.length ? hd.reduce((a, b) => (b.hdd > a.hdd ? b : a)) : null, lows, days: hd, alerts: al.map(a => a.event), points: ps.length };
    });
    const worst = nights.reduce((a, b) => (b.minF < a.minF ? b : a));
    const tier = worst.tier, medTier = Math.max(...nights.map(n => n.medTier));
    const firstAt = t => nights.find(n => n.tier >= t) || null;
    const ageH = rec.at ? (end - +new Date(rec.at)) / 36e5 : Infinity, stale = ageH > 36;
    const emergency = coldAlerts.some(a => a.emergency) || Object.keys(byCounty).some(k => byCounty[k].emergency);
    /* ---- the season so far, and what this week adds to it ---- */
    const season = seasonOf(recs, now, opt);
    const heatOn = !!(hddPeak && hddPeak.hdd >= HEAT_ON_HDD);
    /* the first heating week: a season still under 150 heating degree days meets a week that at least doubles it */
    const firstHeatingWeek = !!(season && season.hdd != null && hdd7 != null && season.hdd < 150 && hdd7 >= Math.max(40, season.hdd));
    const ff = nights.find(n => n.minF <= th.freeze) || null;
    const firstFreezeAhead = ff && season && !season.firstFreeze ? { d: ff.d, name: ff.name, at: ff.minAt, f: ff.minF } : null;
    /* ---- words ---- */
    const cn = Object.keys(byCounty), cf = cn.filter(c => byCounty[c].n32 > 0 || byCounty[c].edge32 > 0), cc = cn.filter(c => byCounty[c].n40 > 0 || byCounty[c].edge40 > 0);
    const dallas = byCounty.Dallas ? byCounty.Dallas.lows.find(x => x.d === worst.d) : null;
    const core = dallas && worst.minCounty !== 'Dallas' && dallas.f !== worst.minF ? `; ${dallas.f}°F in Dallas County` : '';
    const spread = n => n.minF === n.maxF ? `${n.minF}°F` : `${n.minF} to ${n.maxF}°F`;
    const tierNights = t => nights.filter(n => n.tier >= t).map(n => n.name);
    const highs = x => x.hiMin === x.hiMax ? 'near ' + x.hiMin : x.hiMin + ' to ' + x.hiMax;
    const loadWords = hdd7 == null ? '' : `${hdd7} heating degree days in the next seven days${hddNorm7 ? `, ${loadPct >= 115 ? 'above' : loadPct <= 85 ? 'below' : 'about'} the normal ${hddNorm7} for these dates` : ''}`;
    const peakWords = hddPeak ? `${dow(hddPeak.d)} is the heaviest day (highs ${highs(hddPeak)}°F)` : '';
    let headline, sub; const actions = [];
    if (tier >= 4) headline = `Hard freeze ${worst.name}: ${worst.minF}°F at ${worst.minAt}${core}`;
    else if (tier === 3) headline = worst.medTier >= 3 ? `Freeze across the metro ${worst.name}: lows ${spread(worst)}` : `Freeze on the edges ${worst.name}: ${worst.minF}°F at ${worst.minAt}${core}`;
    else if (firstHeatingWeek) headline = `The first heating week of the season: ${hdd7} heating degree days ahead, against ${season.hdd} since July`;
    else if (tier === 2) headline = `Cold nights ahead: ${worst.minF}°F ${worst.name} at ${worst.minAt}${core}`;
    else if (heatOn) headline = `Heat on all day ${dow(hddPeak.d)}: highs ${highs(hddPeak)}°F, lows to ${worst.minF}°F`;
    else if (tier === 1) headline = `Cool nights, no cold trigger: lows bottom out at ${worst.minF}°F ${worst.name}`;
    else headline = `A mild week: no night below ${worst.minF}°F`;
    const where = cs => cs.length >= cn.length ? `all ${cn.length} counties` : cs.length > 4 ? cs.slice(0, 4).join(', ') + ' and ' + (cs.length - 4) + ' more counties' : list(cs) + (cs.length === 1 ? ' County' : ' counties');
    if (coldAlerts.length) { const a = coldAlerts.slice().sort((x, y) => (y.tier || 0) - (x.tier || 0))[0]; headline = `${a.event} for ${where(a.counties)}`; }
    sub = tier >= 3 ? `${cf.length} of ${cn.length} counties have at least one night at ${th.freeze}°F or lower in the next seven (${list(tierNights(3))}).${firstFreezeAhead ? ' It would be the first freeze of the season.' : ''}`
      : firstHeatingWeek ? `${cap(peakWords)}; lows bottom out at ${worst.minF}°F ${worst.name}${tier >= 2 ? ' at ' + worst.minAt : ''}. No freeze in the forecast. Furnaces that have not run since spring start this week.`
      : tier === 2 ? `${cc.length} of ${cn.length} counties reach ${th.cold}°F or lower (${list(tierNights(2))}); no freeze in the forecast.${loadWords ? ' ' + cap(loadWords) + '.' : ''}`
      : heatOn ? `${cap(loadWords)}. No night reaches ${th.cold}°F.`
      : tier === 1 ? `Furnaces will cycle at night but nothing in the next seven nights reaches ${th.cold}°F.${loadWords ? ' ' + cap(loadWords) + '.' : ''}`
      : `Lows stay above ${th.cool}°F through ${nights[nights.length - 1].label}. Heating demand runs at its seasonal base.`;
    if (emergency) actions.push('Heating repair: emergency dayparts on, Local Services Ads budget uncapped for the event', 'Shift tune up and replacement prospecting money into no heat search for 72 hours', 'Check the board first: buy only the calls the crews can run');
    else if (tier >= 4) actions.push('Heating repair: emergency dayparts on, Local Services Ads budget up for the event', 'Shift tune up and replacement prospecting money into no heat search for 72 hours', 'Check the board first: buy only the calls the crews can run');
    else if (tier === 3) actions.push(`Heating repair bids up from the afternoon before ${firstAt(3).name} through two days after`, 'Lead with the counties that freeze: ' + list(cf.slice(0, 5)), 'Furnace replacement quotes convert fastest in the week after a freeze');
    else if (firstHeatingWeek) actions.push(`Open the heating repair campaigns now and lift bids from ${dow(hddPeak.d)} morning: first starts expose igniters, flame sensors and dirty burners`, 'Last call for the tune up and furnace safety check offer before the board fills', 'No heat, heater not working and furnace repair terms on; cooling repair budgets down');
    else if (tier === 2) actions.push(`Open or raise the heating repair campaigns before ${firstAt(2).name}`, 'First cold nights expose igniters and flame sensors: no heat and safety check messages', 'Keep the tune up offer running until the first freeze');
    else if (heatOn) actions.push(`Raise heating repair bids for ${dow(hddPeak.d)} and the morning after`, 'Keep the tune up offer running until the first freeze');
    else if (tier === 1) actions.push('Hold the base heating plan', 'Pre season tune up and furnace safety check offers while the schedule has room');
    else actions.push('Hold the base plan and bank budget for the first cold snap', 'Good week for tune ups, inspections and replacement quotes');
    /* ---- the notice for the popup, keyed so it is sent once per trigger ---- */
    let notice = null;
    if (coldAlerts.length) { const a = coldAlerts[0]; notice = { key: 'alert:' + a.event + ':' + String(a.onset || '').slice(0, 10) + ':' + a.counties.join(','), title: a.event + ' in the forecast area', message: `${list(a.counties.slice(0, 6))}. Coldest forecast low ${worst.minF}°F ${worst.name}. Open the Heat Desk for the plan.` }; }
    else if (tier >= 3) { const f = firstAt(3); notice = { key: 'tier' + tier + ':' + f.d, title: tier >= 4 ? 'Hard freeze in the forecast' : 'Freeze in the forecast', message: `${headline}. ${sub}` }; }
    else if (firstHeatingWeek) notice = { key: 'firstheat:' + String(season.through || today).slice(0, 4), title: 'The first heating week of the season', message: `${hdd7} heating degree days in the next seven days against ${season.hdd} since July. ${cap(peakWords)}.` };
    return { ok: true, active: tier >= 2 || coldAlerts.length > 0 || firstHeatingWeek || heatOn, tier, medTier, tierName: TIER[tier], th, today, nights, days, byCounty, points: pts, alerts, coldAlerts, worst, minLow: worst.minF, emergency,
      hdd7, hddNorm7, loadPct, hddPeak, heatOn, firstHeatingWeek, firstFreezeAhead, season, at: rec.at, updated: d.updated || null, oldest: d.oldest || null, stale, baseline: !!rec.baseline,
      eyebrow: stale ? `Forecast from ${dow(localDay(rec.at))} ${md(localDay(rec.at))} (refresh due)` : 'The next seven nights', headline, sub, actions, notice };
  }
  /* Everything worth one notification each, keyed so each is sent once: the freeze or the first heating week in the forecast,
     and every new alert product a heating and cooling shop acts on (cold and winter, heat, air quality, severe storms). */
  const ALERT_KINDS = [[/freez|frost|cold|wind chill|winter|ice storm|blizzard|snow|sleet/i, 'heat'], [/heat/i, 'weather'], [/air quality/i, 'weather'], [/severe thunderstorm|tornado/i, 'weather']];
  function notices(recs, now, opt) {
    const c = cold(recs, now, opt), out = [], seen = {};
    if (!c.ok || c.stale) return out;
    c.alerts.forEach(a => {
      const kind = ALERT_KINDS.find(k => k[0].test(a.event)); if (!kind) return;
      const key = 'alert:' + a.event + ':' + String(a.onset || '').slice(0, 10); if (seen[key]) { seen[key].counties = [...new Set(seen[key].counties.concat(a.counties))]; return; }
      seen[key] = { key, event: a.event, counties: a.counties.slice(), route: kind[1] }; out.push(seen[key]);
    });
    out.forEach(n => { n.title = n.event; n.message = (n.counties.length >= 12 ? 'All 12 counties' : list(n.counties.slice(0, 6)) + (n.counties.length > 6 ? ' and ' + (n.counties.length - 6) + ' more' : '')) + '. ' + (n.route === 'heat' ? `Coldest forecast low ${c.minLow}°F ${c.worst.name}. Open the Heat Desk for the plan.` : 'Open the Weather Desk for the standing rule and the hours.'); delete n.event; delete n.counties; });
    if (!c.coldAlerts.length && c.notice) out.unshift(Object.assign({ route: 'heat' }, c.notice));
    return out;
  }
  /* The toolbar badge: the coldest forecast low once it reaches the cold threshold, nothing otherwise. */
  function badge(c) {
    if (!c || !c.ok || c.stale || c.minLow == null || c.minLow > c.th.cold) return { text: '', color: '#13243a', title: 'DFW Thermal Debt Atlas' + (c && c.ok && !c.stale ? ` · ${c.headline}` : '') };
    return { text: c.minLow + '°', color: c.minLow <= c.th.hard ? '#6d28d9' : c.minLow <= c.th.freeze ? '#1c5cab' : '#3e7fcf', title: `Coldest forecast low in the next seven nights: ${c.minLow}°F ${c.worst.name} at ${c.worst.minAt}. ${c.headline}` };
  }
  L.derive = Object.assign(L.derive || {}, { TH, TIER, HEAT_ON_HDD, tierOf, localDay, dow, md, list, normHdd, cold, notices, badge });
})(typeof globalThis !== 'undefined' ? globalThis : self);
