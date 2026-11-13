/* ==== live/derive.js ==== */
/* Pure reads of the live records, shared by the page, the popup and the background worker: the cold picture for the next
   seven nights (by night, by county, for the metro), the toolbar badge and the one line notice. No DOM, no network. */
(function (root) {
  'use strict';
  const L = root.TDA_LIVE;
  /* Night low thresholds in °F. cool: furnaces start cycling; cold: the first hard use, when weak igniters and sensors show up;
     freeze: sustained run time and heat pump auxiliary heat; hard: pipes, long run times, emergency volume. Planning values, grade C. */
  const TH = { cool: 50, cold: 40, freeze: 32, hard: 25 };
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
  const median = a => { const b = a.slice().sort((x, y) => x - y); const m = b.length >> 1; return b.length ? (b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2) : null; };
  const list = a => a.length <= 1 ? a.join('') : a.length === 2 ? a.join(' and ') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
  const nightName = (d, today) => d === today ? 'tonight' : dow(d) + ' night';

  /* The cold picture. recs: { nws_cold: record, ... }. Returns an object that is always safe to render. */
  function cold(recs, now, opt) {
    opt = opt || {}; const th = Object.assign({}, TH, opt.th || {});
    const rec = recs && recs.nws_cold, d = rec && rec.data;
    const empty = { ok: false, active: false, tier: 0, tierName: TIER[0], nights: [], byCounty: {}, points: [], alerts: [], coldAlerts: [], th, eyebrow: 'This week', headline: '', sub: '', actions: [], notice: null, at: rec && rec.at || null, stale: true };
    if (!d || !Array.isArray(d.points)) return empty;
    const today = localDay(now, (L.geo || {}).tz);
    const pts = d.points.map(p => Object.assign({}, p, { nights: (p.nights || []).filter(n => n.d >= today && n.lowF != null) })).filter(p => p.nights.length);
    if (!pts.length) return Object.assign(empty, { headline: 'The stored forecast has run out', sub: 'Refresh the live data to get the next seven nights.' });
    const dates = [...new Set(pts.flatMap(p => p.nights.map(n => n.d)))].sort().slice(0, 7);
    const nights = dates.map(dt => {
      const xs = pts.map(p => { const n = p.nights.find(q => q.d === dt); return n ? { f: n.lowF, p } : null; }).filter(Boolean);
      const lo = xs.reduce((a, b) => (b.f < a.f ? b : a)), hi = xs.reduce((a, b) => (b.f > a.f ? b : a));
      return { d: dt, name: nightName(dt, today), label: (dt === today ? 'Tonight' : dow(dt).slice(0, 3)) + ' ' + md(dt), minF: lo.f, minAt: lo.p.name, minCounty: lo.p.county, maxF: hi.f, medF: Math.round(median(xs.map(x => x.f))), n32: xs.filter(x => x.f <= th.freeze).length, n40: xs.filter(x => x.f <= th.cold).length, n: xs.length, tier: tierOf(lo.f, th), medTier: tierOf(median(xs.map(x => x.f)), th) };
    });
    const byCounty = {};
    ((L.geo || {}).counties || []).forEach(c => {
      const ps = pts.filter(p => p.county === c.name); if (!ps.length) return;
      const per = dates.map(dt => { const fs = ps.map(p => (p.nights.find(q => q.d === dt) || {}).lowF).filter(v => v != null); return fs.length ? { d: dt, f: Math.min(...fs) } : null; }).filter(Boolean);
      if (!per.length) return; const lo = per.reduce((a, b) => (b.f < a.f ? b : a));
      byCounty[c.name] = { minF: lo.f, night: lo.d, tier: tierOf(lo.f, th), n50: per.filter(x => x.f <= th.cool).length, n40: per.filter(x => x.f <= th.cold).length, n32: per.filter(x => x.f <= th.freeze).length, n25: per.filter(x => x.f <= th.hard).length, lows: per };
    });
    const end = +new Date(now);
    const alerts = (d.alerts || []).filter(a => !a.ends || +new Date(a.ends) > end);
    const coldAlerts = alerts.filter(a => a.cold);
    const worst = nights.reduce((a, b) => (b.minF < a.minF ? b : a));
    const tier = worst.tier, medTier = Math.max(...nights.map(n => n.medTier));
    const firstAt = t => nights.find(n => n.tier >= t) || null;
    const ageH = rec.at ? (end - +new Date(rec.at)) / 36e5 : Infinity; const stale = ageH > 36;
    /* ---- words ---- */
    const dallas = byCounty.Dallas ? byCounty.Dallas.lows.find(x => x.d === worst.d) : null;
    const core = dallas && worst.minCounty !== 'Dallas' && dallas.f !== worst.minF ? `; ${dallas.f}°F in Dallas County` : '';
    const spread = n => n.minF === n.maxF ? `${n.minF}°F` : `${n.minF} to ${n.maxF}°F`;
    let headline, sub; const actions = [];
    const tierNights = t => nights.filter(n => n.tier >= t).map(n => n.name);
    if (tier >= 4) headline = `Hard freeze ${worst.name}: ${worst.minF}°F at ${worst.minAt}${core}`;
    else if (tier === 3) headline = worst.medTier >= 3 ? `Freeze across the metro ${worst.name}: lows ${spread(worst)}` : `Freeze on the edges ${worst.name}: ${worst.minF}°F at ${worst.minAt}${core}`;
    else if (tier === 2) headline = `Cold nights ahead: ${worst.minF}°F ${worst.name} at ${worst.minAt}${core}`;
    else if (tier === 1) headline = `Cool nights, no cold trigger: lows bottom out at ${worst.minF}°F ${worst.name}`;
    else headline = `A mild week: no night below ${worst.minF}°F`;
    if (coldAlerts.length) { const a = coldAlerts[0]; headline = `${a.event} for ${list(a.counties.slice(0, 4))}${a.counties.length > 4 ? ' and ' + (a.counties.length - 4) + ' more' : ''}${a.counties.length === 1 ? ' County' : ' counties'}`; }
    const cn = Object.keys(byCounty); const cf = cn.filter(c => byCounty[c].n32 > 0), cc = cn.filter(c => byCounty[c].n40 > 0);
    sub = tier >= 3 ? `${cf.length} of ${cn.length} counties have at least one night at ${th.freeze}°F or lower in the next seven (${list(tierNights(3))}).`
      : tier === 2 ? `${cc.length} of ${cn.length} counties reach ${th.cold}°F or lower (${list(tierNights(2))}); no freeze in the forecast.`
      : tier === 1 ? `Furnaces will cycle at night but nothing in the next seven nights reaches ${th.cold}°F.`
      : `Lows stay above ${th.cool}°F through ${nights[nights.length - 1].label}. Heating demand runs at its seasonal base.`;
    if (tier >= 4) actions.push('Heating repair: emergency dayparts on, Local Services Ads budget uncapped for the event', 'Shift tune up and replacement prospecting money into no heat search for 72 hours', 'Check the board first: only buy the calls the crews can run');
    else if (tier === 3) actions.push(`Heating repair bids up from the afternoon before ${firstAt(3).name} through two days after`, 'Lead with the counties that freeze: ' + list(cf.slice(0, 5)), 'Furnace replacement quotes convert fastest in the week after a freeze');
    else if (tier === 2) actions.push(`Open or raise the heating repair campaigns before ${firstAt(2).name}`, 'First cold nights expose igniters and flame sensors: no heat and safety check messages', 'Keep the tune up offer running until the first freeze');
    else if (tier === 1) actions.push('Hold the base heating plan', 'Pre season tune up and furnace safety check offers while the schedule has room');
    else actions.push('Hold the base plan and bank budget for the first cold snap', 'Good week for tune ups, inspections and replacement quotes');
    /* ---- one line notice, keyed so it is sent once per trigger ---- */
    let notice = null;
    if (coldAlerts.length) { const a = coldAlerts[0]; notice = { key: 'alert:' + a.event + ':' + String(a.onset || '').slice(0, 10) + ':' + a.counties.join(','), title: a.event + ' in the forecast area', message: `${list(a.counties.slice(0, 6))}. Coldest forecast low ${worst.minF}°F ${worst.name}. Open the Heat Desk for the plan.` }; }
    else if (tier >= 3) { const f = firstAt(3); notice = { key: 'tier' + tier + ':' + f.d, title: tier >= 4 ? 'Hard freeze in the forecast' : 'Freeze in the forecast', message: `${headline}. ${sub}` }; }
    return { ok: true, active: tier >= 2 || coldAlerts.length > 0, tier, medTier, tierName: TIER[tier], th, today, nights, byCounty, points: pts, alerts, coldAlerts, worst, minLow: worst.minF, at: rec.at, updated: d.updated || null, stale, baseline: !!rec.baseline,
      eyebrow: stale ? `Forecast from ${dow(localDay(rec.at))} ${md(localDay(rec.at))} (refresh due)` : 'The next seven nights', headline, sub, actions, notice };
  }
  /* Everything worth one notification each, keyed so each is sent once: the freeze in the forecast, and every new alert
     product a heating and cooling shop acts on (cold and winter, heat, air quality, severe storms). */
  const ALERT_KINDS = [[/freeze|frost|cold|wind chill|winter|ice storm|blizzard|snow|sleet/i, 'heat'], [/heat/i, 'weather'], [/air quality/i, 'weather'], [/severe thunderstorm|tornado/i, 'weather']];
  function notices(recs, now, opt) {
    const c = cold(recs, now, opt), out = [], seen = {};
    if (!c.ok || c.stale) return out;
    c.alerts.forEach(a => {
      const kind = ALERT_KINDS.find(k => k[0].test(a.event)); if (!kind) return;
      const key = 'alert:' + a.event + ':' + String(a.onset || '').slice(0, 10); if (seen[key]) { seen[key].counties = [...new Set(seen[key].counties.concat(a.counties))]; return; }
      seen[key] = { key, event: a.event, counties: a.counties.slice(), route: kind[1] }; out.push(seen[key]);
    });
    out.forEach(n => { n.title = n.event; n.message = (n.counties.length >= 12 ? 'All 12 counties' : list(n.counties.slice(0, 6)) + (n.counties.length > 6 ? ' and ' + (n.counties.length - 6) + ' more' : '')) + '. ' + (n.route === 'heat' ? `Coldest forecast low ${c.minLow}°F ${c.worst.name}. Open the Heat Desk for the plan.` : 'Open the Weather Desk for the standing rule and the hours.'); delete n.event; delete n.counties; });
    if (c.tier >= 3 && !c.coldAlerts.length && c.notice) out.unshift(Object.assign({ route: 'heat' }, c.notice));
    return out;
  }
  /* The toolbar badge: the coldest forecast low once it reaches the cold threshold, nothing otherwise. */
  function badge(c) {
    if (!c || !c.ok || c.stale || c.minLow == null || c.minLow > c.th.cold) return { text: '', color: '#13243a', title: 'DFW Thermal Debt Atlas' + (c && c.ok && !c.stale ? ` · coldest forecast low this week ${c.minLow}°F` : '') };
    return { text: c.minLow + '°', color: c.minLow <= c.th.hard ? '#6d28d9' : c.minLow <= c.th.freeze ? '#1c5cab' : '#3e7fcf', title: `Coldest forecast low in the next seven nights: ${c.minLow}°F ${c.worst.name} at ${c.worst.minAt}. ${c.headline}` };
  }
  L.derive = Object.assign(L.derive || {}, { TH, TIER, tierOf, localDay, dow, md, list, cold, notices, badge });
})(typeof globalThis !== 'undefined' ? globalThis : self);
