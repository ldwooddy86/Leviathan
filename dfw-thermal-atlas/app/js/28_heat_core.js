/* ==== 28_heat_core.js ==== */
/* ==== heat_core ==== */
"use strict";
/* ============================ HEAT DESK ENGINE (HEATX) ============================ */
/* Where a heating ad dollar spent from the dispatch point earns the most gross profit, and what this week's forecast changes.
   Four lines (heating repair, furnace replacement, heat pump replacement, tune up) in every residential ZIP: one cell each.
   A cell has the jobs a homeowner ad can reach this month (module 12's jobs, who decides, the season, cold exposure), the share
   of them one advertiser can win (the paid share of the line times the one advertiser cap), a cost per lead (the platform blend
   times a cost index held at half strength), a value per lead that falls with the drive, and a response that saturates.
   The month is a water fill across the cells with stated doubt: one fill over the four lines with line trust (automatic mix) or
   one per line (custom mix), a hurdle under which money stays unspent, home turf floors, a ZIP cap, pins, blocks and a minimum
   of leads per cell. The week keeps the month's ZIPs and moves the money with the forecast lows; a cold trigger pours it again.
   No income, race, ethnicity or age enters anywhere. Pure: no DOM, no storage, no network, nothing computed at load. Reads SLM,
   ZR, BRAND, TDA_LIVE, LIVE and the climate baseline; writes to none of them. Every function takes malformed arguments
   without throwing. Module 17 (31_m17_heat.js) is the page; tests/page/20-heat-core.page.mjs holds the checks. Every modeled
   dollar is grade D.

   What it returns (the field by field list is HEAT-API.md, kept with the build notes):
     IDS, NAMES, SHORT, PLATS, PLAT_NAMES, TIERS, LABELS, PRESETS, SCENARIOS, GRADES, MONTHS, DEF, RANGES     constants
     params(P)            defaults merged with saved values, clamped to RANGES; month null means the current month in the metro
     get(P, path), set(P, path, value)                          one dotted path of P ('half.heat', 'plat.heat.google')
     origin()             { lat, lon, label, src }             the dispatch point: the brand panel's, else the live layer's office
     exposure()           { byZip, hdd, source, mean, label }  cold exposure per ZIP; source 'grid' | 'stations' | 'none'
     plan(P, opt)         { P, month, monthName, period, scale, T, lines, line, zips, all, at, cells, counties, tiers,
                            platforms, campaigns, bench, notes, exposure, origin, crew, ms }
                          opt: budget, lite, costScale, and for a week: wx, scale, lineBudgets, hold, keep, reachScale, crewCap
                          T: budget, spent, unspent, lambda, hurdle, atHurdle, hurdleAt, leads, jobs, gp, gpDirect, gpPipe, cpl,
                             cpj, gpPerDollar, share20, farthest, households, zips, cells, mode, mix, capUsed, capLoosened,
                             crewCut, leadsOver (always 0), leadsPlanned
                          a line: id, name, share, dollars, target, zips, leads, cpl, jobs, cpj, gp, gpDirect, gpPipe, farthest,
                             avgMin, topShare, lambda, lambdaRaw, shrink, mean, season, cpl0, close, sigma, plat, platDollars,
                             folded, leadsOver, hurdleAt, vbar, rows, platRun, cplRun0, leadShare, leadsPlanned, runWhy
                          a ZIP row: zip, z, city, county, households, min, km, tier, x, fuel, who, cost, pressure, home, pinned,
                             blocked, inPlan, lines, dollars, share, rank, bid, conf, label, top, leads, jobs, gp, gpDirect, why
                          a cell: zip, id, z, zi, li, min, R, dm, x, w, cost, cpl, close, J, g, gd, gpipe, rho, rhoD, K, vpc, floor,
                             core, spend, state, capped, y, conf, fill, leads, jobs, gp, gpDirect, bid, valueRule, sigma, cplRun, KRun
                          Honest outcomes: the fill places the money at each line's planned platform mix (cpl, K, rho); a platform share
                          under its minimum then runs on Google Search, and leads, jobs, gross profit and the ranges are priced at the
                          mix that runs (cplRun, KRun). With no fold the two are the same numbers; the ZIP money never moves for a fold
     bands(plan)          { n, seed, leads, jobs, gpDirect, gp, gpPerDollar, cpl, cpj, lines, ms }   each { p10, p50, p90 }
     forecast(now, recs)  F: { ok, src, sim, label, at, ageH, stale, baseline, today, month, dates, mornings, points, alerts,
                            firstFreeze, observed, head } or null; never throws
     scenario(F, name)    a simulated F: 'rim' | 'first' | 'arctic'; any other name hands F back
     weather(F, P, plan)  { ok, stale, sim, month, normLow, wn, dates, nights, byZip, range, lines, own, lastW, carried, trigger,
                            triggerWhy, storm, alerts, origin, metro, mult(zip, id) }
     week(P, F, opt)      { ok, src, sim, label, stale, missing, at, ageH, today, monday, month, monthName, dim, scale, head,
                            season, plan, wx, trigger, triggerWhy, hold, storm, reach, lines, T, reserve, days, crew, added,
                            paused, schedule, creative, list, rules, notes, ms }      opt: month, season, now
     rules(P, wk)         the cold rules table, with what fired when a week is given
     ladder(P, list), months(P, list), variants(P), lsaGain(P)    what a budget buys, the mix by month, one at a time changes
     why(zrec, plan), held(plan), bench(plan, n), hand(plan, line)   words for a ZIP, ZIPs held back, the next to enter, the Campaign Desk hand off
     exports(plan, wk, P, opt), pack(ex)                          { key: { name, text, note, group, main } } and the zip list
     nightW(lowF, P), normLow(month), minutes(zipRow), reach(min, half, cut), label(conf), tier(min), fuel(zipRow)   small helpers */
const HEATX = (() => {
  const IDS = ['heat', 'furnace', 'heatpump', 'maint'];
  const NAMES = { heat: 'Heating repair', furnace: 'Furnace replacement', heatpump: 'Heat pump replacement', maint: 'Tune up and safety check' };
  const SHORT = { heat: 'Repair', furnace: 'Furnace', heatpump: 'Heat pump', maint: 'Tune up' };
  const PLATS = ['google', 'lsa', 'microsoft', 'meta', 'nextdoor'];
  const PLAT_NAMES = { google: 'Google Search', lsa: 'Local Services Ads', microsoft: 'Microsoft Advertising', meta: 'Meta', nextdoor: 'Nextdoor' };
  const PLAT_HOW = { google: 'ZIP targets with Google criterion ids, presence only; location bid adjustments in manual mode', lsa: 'one service area for the profile (a ZIP list), a weekly budget, no bids by ZIP', microsoft: 'the Google ZIP targets under _MS campaign names', meta: 'ZIP keys by line and fuel; financing creative goes to a special ad category campaign on a 15 mile radius', nextdoor: 'ZIP lists by line' };
  const TIERS = [{ id: 'Core', max: 20, words: '20 minutes or less' }, { id: 'Ring', max: 35, words: '20 to 35 minutes' }, { id: 'Far', max: Infinity, words: 'over 35 minutes' }];
  const LABELS = [{ id: 'Firm', min: 0.8, words: '80% or more' }, { id: 'Likely', min: 0.5, words: '50 to 80%' }, { id: 'Test', min: 0, words: 'under 50%' }];
  const PRESETS = { repair: { name: 'Repair first', mix: { heat: 45, furnace: 25, heatpump: 20, maint: 10 } }, replace: { name: 'Replacement first', mix: { heat: 25, furnace: 35, heatpump: 30, maint: 10 } } };
  const SCENARIOS = [{ id: 'live', name: 'Live forecast' }, { id: 'rim', name: 'Freeze on the rim', sim: true }, { id: 'first', name: 'First freeze metro wide', sim: true }, { id: 'arctic', name: 'Arctic outbreak', sim: true }];
  const GRADES = { minutes: 'C', reach: 'D', exposure: 'C', jobs: 'D', cost: 'D', value: 'D', spend: 'C', leads: 'D', jobsBooked: 'D', gp: 'D', conf: 'D', bid: 'D', forecast: 'A', thresholds: 'C', weights: 'D', reserve: 'D', ranges: 'D' };
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const DIM = [31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], DOWL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const SEED = 17, WORLDS_N = 120;

  /* ---------- defaults and ranges ---------- */
  const DEF = {
    budget: 10000, month: null,                                                  // monthly heating media; null: the current month
    half: { heat: 30, furnace: 40, heatpump: 40, maint: 22 },                    // drive minutes at which a lead is worth half
    mode: 'auto', mix: { heat: 45, furnace: 25, heatpump: 20, maint: 10 },       // one fill across the lines, or four stated shares
    lsaLive: false, bidding: 'manual', reserve: 0.20, pins: [], blocks: [], crewCap: null,
    hours: { open: 7, close: 20, sunday: false, onCall: false },                 // phones answered: Monday to Saturday 7 am to 8 pm
    cut: 0.25, trust: 0.5, doubt: 0.25, gamma: 0.25, hurdle: 3.0, pipeCredit: 1.0,
    paid: { heat: 0.18, furnace: 0.08, heatpump: 0.08, maint: 0.06 }, cap: 0.30,   // share of jobs that start with a paid click; most of those one advertiser wins
    depth: 0.5, zipCap: 0.15, lineMin: 1000, coreMin: 12, dmw: [1, 0.6, 0.25],
    coldExp: { heat: 0.7, furnace: 0.3, heatpump: 0.5, maint: 0 },
    plat: { heat: { google: 55, lsa: 35, microsoft: 5, meta: 5, nextdoor: 0 }, furnace: { google: 50, lsa: 15, microsoft: 5, meta: 25, nextdoor: 5 }, heatpump: { google: 50, lsa: 15, microsoft: 5, meta: 25, nextdoor: 5 }, maint: { google: 25, lsa: 15, microsoft: 0, meta: 45, nextdoor: 15 } },
    platMin: { lsa: 300, microsoft: 150, meta: 450, nextdoor: 300 },
    nightW: [0.30, 0.60, 1.00, 1.60, 2.20, 3.00],                                // a night's weight at 60, 50, 40, 32, 25 and 15°F
    resp: { furnace: 0.35, heatpump: 0.50, maint: 0.50 }, maintPause: 2.5,
    alertFloor: [1.5, 2.0, 3.0], firstFreeze: 1.25, trigger: 1.3, radiusFloor: 0.7, stormReach: 0.6
  };
  const RANGES = (() => {
    const R = {}, add = (path, min, max, step, unit, label, where, grade, more) => { R[path] = Object.assign({ min, max, step, unit, label, where, grade: grade || 'D' }, more || {}); };
    add('budget', 1000, 100000, 500, '$', 'Monthly heating media', 'plan', 'A'); add('month', 0, 11, 1, '', 'Month', 'plan', 'A', { nullable: true });
    add('half.heat', 15, 60, 1, 'min', 'Reach, repair: half value drive', 'plan'); add('half.furnace', 20, 90, 1, 'min', 'Reach, furnace replacement: half value drive', 'plan'); add('half.heatpump', 20, 90, 1, 'min', 'Reach, heat pump replacement: half value drive', 'plan'); add('half.maint', 10, 45, 1, 'min', 'Reach, tune up: half value drive', 'plan');
    IDS.forEach(id => add('mix.' + id, 0, 100, 1, '%', NAMES[id] + ' share of the month', 'plan'));
    add('reserve', 0, 0.4, 0.01, '%', 'Freeze reserve, share of the month', 'plan', 'D', { pct: true }); add('crewCap', 1, 500, 1, 'jobs', 'Crew cap: paid booked jobs a week', 'plan', 'A', { nullable: true });
    add('hours.open', 0, 12, 1, '', 'Phones answered from (hour)', 'plan', 'A'); add('hours.close', 12, 24, 1, '', 'Phones answered until (hour)', 'plan', 'A');
    add('cut', 0.1, 0.5, 0.05, '', 'Reach cut', 'advanced'); add('trust', 0, 1, 0.05, '', 'Trust in the modeled auction cost', 'advanced'); add('doubt', 0, 0.6, 0.05, '', 'Doubt in the return estimate', 'advanced');
    add('gamma', 0, 1, 0.05, '', 'Line trust: share of the modeled gap between lines that is believed', 'advanced'); add('hurdle', 0, 10, 0.25, '$', 'Hurdle: gross profit the last ad dollar must return', 'advanced'); add('pipeCredit', 0, 1, 0.05, '%', 'Pipeline credit', 'advanced', 'D', { pct: true });
    IDS.forEach(id => add('paid.' + id, 0.02, 0.4, 0.01, '%', 'Jobs that start with a paid click: ' + NAMES[id].toLowerCase(), 'advanced', 'D', { pct: true }));
    add('cap', 0.1, 0.6, 0.01, '%', 'Most of those one advertiser wins', 'advanced', 'D', { pct: true }); add('depth', 0.25, 2, 0.25, 'leads', 'Minimum leads a month per ZIP per line', 'advanced'); add('zipCap', 0.05, 0.4, 0.01, '%', 'ZIP cap, share of the plan', 'advanced', 'D', { pct: true });
    add('lineMin', 0, 3000, 100, '$', 'Campaign minimum a month', 'advanced'); add('coreMin', 0, 25, 1, 'min', 'Home turf', 'advanced');
    ['Owner occupied house', 'Rented house', 'Apartment'].forEach((l, i) => add('dmw.' + i, 0, 1, 0.05, '', 'Who decides: ' + l.toLowerCase(), 'advanced', 'C'));
    IDS.forEach(id => add('coldExp.' + id, 0, 1.5, 0.1, '', 'Cold exposure weight: ' + NAMES[id].toLowerCase(), 'advanced', 'C'));
    IDS.forEach(id => PLATS.forEach(p => add('plat.' + id + '.' + p, 0, 100, 5, '%', NAMES[id] + ' on ' + PLAT_NAMES[p], 'advanced')));
    PLATS.slice(1).forEach(p => add('platMin.' + p, 0, 2000, 50, '$', PLAT_NAMES[p] + ' minimum a month', 'advanced'));
    [[60, 0.1, 1], [50, 0.2, 1.5], [40, 0.5, 2], [32, 1, 3], [25, 1, 4], [15, 1.5, 5]].forEach((k, i) => add('nightW.' + i, k[1], k[2], 0.05, 'x', 'Night weight at ' + k[0] + '°F', 'cold'));
    add('resp.furnace', 0, 1, 0.05, '', 'Furnace replacement: share of the repair lift', 'cold'); add('resp.heatpump', 0, 1, 0.05, '', 'Heat pump replacement: share of the repair lift', 'cold'); add('resp.maint', 0, 1, 0.05, '', 'Tune up: cut as a share of the repair lift', 'cold');
    add('maintPause', 1.5, 3, 0.1, 'x', 'Tune ups pause at a repair multiplier of', 'cold'); ['Freeze Warning class', 'Cold Weather Advisory class', 'Extreme Cold and Winter Storm Warning class'].forEach((l, i) => add('alertFloor.' + i, 1, 3, 0.1, 'x', 'Alert floor: ' + l, 'cold'));
    add('firstFreeze', 1, 1.5, 0.05, 'x', 'First freeze bonus', 'cold'); add('trigger', 1.1, 2, 0.05, 'x', 'Cold trigger: repair multiplier over', 'cold'); add('radiusFloor', 0.5, 1, 0.05, 'x', 'Reach floor in a cold trigger week', 'cold'); add('stormReach', 0.3, 1, 0.05, 'x', 'Reach in ice or a storm warning', 'cold');
    return R;
  })();
  const okNum = v => v != null && v !== '' && typeof v !== 'boolean' && isN(v);
  const get = (P, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), P);
  const put = (P, path, v) => { const ks = path.split('.'); let o = P; ks.slice(0, -1).forEach(k => { o = o[k]; }); o[ks[ks.length - 1]] = v; };
  const zipSet = () => { if (!zipSet.s || zipSet.n !== ZR.length) { zipSet.s = new Set(ZR.map(z => z.zip)); zipSet.n = ZR.length; } return zipSet.s; };
  /* defaults merged with saved values, clamped to the ranges; shares rescaled to 100; a ZIP both pinned and blocked is blocked */
  function params(Pin) {
    const S = Pin && typeof Pin === 'object' ? Pin : {}, P = JSON.parse(JSON.stringify(DEF));
    Object.keys(RANGES).forEach(path => { const r = RANGES[path], v = get(S, path); if (okNum(v)) put(P, path, clamp(+v, r.min, r.max)); else if (r.nullable && v === null) put(P, path, null); });
    P.month = P.month == null ? +localDay(new Date()).slice(5, 7) - 1 : Math.round(P.month); if (P.crewCap != null) P.crewCap = Math.round(P.crewCap);
    P.mode = S.mode === 'custom' ? 'custom' : 'auto'; P.bidding = S.bidding === 'smart' ? 'smart' : 'manual'; P.lsaLive = !!S.lsaLive;
    if (S.hours && typeof S.hours === 'object') { P.hours.sunday = !!S.hours.sunday; P.hours.onCall = !!S.hours.onCall; }
    const to100 = (o, keys, d) => { const t = sum(keys.map(k => o[k])); keys.forEach(k => { o[k] = t > 0 ? o[k] * 100 / t : d[k]; }); };
    to100(P.mix, IDS, DEF.mix); IDS.forEach(id => to100(P.plat[id], PLATS, DEF.plat[id]));
    for (let i = 1; i < 6; i++) P.nightW[i] = Math.max(P.nightW[i], P.nightW[i - 1]);                   // a colder night never weighs less
    const ok = zipSet(), list = a => [...new Set((Array.isArray(a) ? a : []).map(String).filter(z => ok.has(z)))];
    P.blocks = list(S.blocks); P.pins = list(S.pins).filter(z => !P.blocks.includes(z));
    return P;
  }
  const set = (P, path, v) => { const Q = JSON.parse(JSON.stringify(P || {})); const ks = path.split('.'); let o = Q; ks.slice(0, -1).forEach(k => { if (o[k] == null || typeof o[k] !== 'object') o[k] = {}; o = o[k]; }); o[ks[ks.length - 1]] = v; return params(Q); };

  /* ---------- small tools ---------- */
  const SQ2PI = 2.5066282746310002;
  const PHI = t => { const a = Math.abs(t), k = 1 / (1 + 0.2316419 * a), p = Math.exp(-a * a / 2) / SQ2PI * k * (0.31938153 + k * (-0.356563782 + k * (1.781477937 + k * (-1.821255978 + k * 1.330274429)))); return t >= 0 ? 1 - p : p; };
  const soft = (y, s) => { const t = y / s; return t < -9 ? 0 : y * PHI(t) + s * Math.exp(-t * t / 2) / SQ2PI; };      // E max(0, y + s ε): the water fill rule averaged over the doubt
  const hav = (a, b, c, d) => { const r = Math.PI / 180, x = Math.sin((c - a) * r / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin((d - b) * r / 2) ** 2; return 12742 * Math.asin(Math.sqrt(x)); };
  const reach = (min, half, cut) => { const r = Math.max(0, 1 - min / (2 * half)); return r < cut ? 0 : r; };
  const tier = min => (min <= 20 ? 'Core' : min <= 35 ? 'Ring' : 'Far');
  const label = conf => (conf >= 0.8 ? 'Firm' : conf >= 0.5 ? 'Likely' : 'Test');
  const fuel = z => ((z.gas_sh || 0) >= 45 ? 'gas' : (z.elec_sh || 0) >= 70 ? 'electric' : 'mixed');
  const nf = v => Math.round(v).toLocaleString('en-US'), usd = v => '$' + nf(v), pc = (v, d) => (v * 100).toFixed(d || 0) + '%', x2 = v => (+v).toFixed(2);
  const words = a => (a.length <= 1 ? a.join('') : a.length === 2 ? a.join(' and ') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);
  const clock = h => (h === 0 || h === 24 ? 'midnight' : h === 12 ? 'noon' : h < 12 ? h + ' am' : (h - 12) + ' pm');
  const stamp = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
  const LV = () => (typeof window !== 'undefined' && window.TDA_LIVE) || null;
  const TH = () => { const L = LV(); return (L && L.derive && L.derive.TH) || { cool: 50, cold: 40, freeze: 32, hard: 25 }; };
  const TIERN = ['mild', 'cool', 'cold', 'freeze', 'hard freeze'];
  const tierOf = f => { const t = TH(); return f == null ? 0 : f <= t.hard ? 4 : f <= t.freeze ? 3 : f <= t.cold ? 2 : f <= t.cool ? 1 : 0; };
  const when = now => { const d = now == null ? new Date() : new Date(now); return Number.isNaN(+d) ? new Date() : d; };      // a moment, or now when it is not one
  const localDay = now => { const L = LV(), d = when(now); if (L && L.derive && L.derive.localDay) return L.derive.localDay(d, (L.geo || {}).tz); return d.toISOString().slice(0, 10); };
  const addDays = (ymd, n) => new Date(Date.parse(ymd + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
  const dowOf = ymd => new Date(ymd + 'T12:00:00Z').getUTCDay();
  const monthOk = v => (okNum(v) && +v >= 0 && +v <= 11 ? Math.round(+v) : null);
  const isYmd = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T12:00:00Z'));
  const daysBetween = (a, b) => Math.round((Date.parse(a + 'T12:00:00Z') - Date.parse(b + 'T12:00:00Z')) / 864e5);      // a minus b, in days
  const isPlan = p => !!(p && typeof p === 'object' && p.P && p.T && p.at && p.line && Array.isArray(p.cells) && Array.isArray(p.zips) && Array.isArray(p.all));      // what plan() returns
  /* a forecast this engine can read: what forecast() and scenario() return; anything else counts as no forecast */
  const okF = F => !!(F && typeof F === 'object' && F.ok && Array.isArray(F.points) && Array.isArray(F.dates) && F.dates.length > 0 && F.dates.every(isYmd) && Array.isArray(F.mornings) && F.mornings.length === F.dates.length && F.mornings.every(isYmd) && isYmd(F.today) && monthOk(F.month) != null);
  const dayLabel = ymd => DOW[dowOf(ymd)] + ' ' + MONTHS[+ymd.slice(5, 7) - 1].slice(0, 3) + ' ' + (+ymd.slice(8, 10));
  const longDay = ymd => MONTHS[+ymd.slice(5, 7) - 1] + ' ' + (+ymd.slice(8, 10));
  const near3 = (lat, lon, pts) => { const L = LV(); if (L && L.geo && L.geo.nearest) return L.geo.nearest(lat, lon, pts, 3); const d = pts.map(p => ({ p, km: hav(lat, lon, p.lat, p.lon) })).sort((a, b) => a.km - b.km).slice(0, 3); if (!d.length) return []; if (d[0].km < 1) return [{ p: d[0].p, km: d[0].km, w: 1 }]; const t = sum(d.map(x => 1 / (x.km * x.km))); return d.map(x => ({ p: x.p, km: x.km, w: 1 / (x.km * x.km) / t })); };

  /* ---------- the dispatch point ---------- */
  function origin() {
    const B = typeof BRAND !== 'undefined' ? BRAND : null, L = LV(), off = (L && L.geo && L.geo.office) || { name: 'Mesquite', lat: 32.8063, lon: -96.6609 };
    if (B && okNum(B.lat) && okNum(B.lon) && +B.lat > 25 && +B.lat < 40 && +B.lon < -90 && +B.lon > -105) return { lat: +B.lat, lon: +B.lon, label: houseClean([B.street, B.city].filter(Boolean).join(', ')) || 'the dispatch point', src: 'brand' };
    return { lat: off.lat, lon: off.lon, label: off.name || 'the office', src: 'office' };
  }
  const minutes = z => { const o = origin(); return 5 + (isN(z.lat) && isN(z.lon) ? hav(o.lat, o.lon, z.lat, z.lon) : (z.km_integrity || 0)); };      // 5 minutes to roll, a minute a straight line km (grade C)

  /* ---------- cold exposure: a ZIP's normal heating degree days over the household weighted metro mean ---------- */
  let EXPO = null;
  function exposure() {
    const L = LV(), B = (typeof window !== 'undefined' && window.__CLIMATE_BASE__) || null, rec = typeof LIVE !== 'undefined' && LIVE.rec ? LIVE.rec('acis_season') : null;
    const key = (B ? 'b' + (B.built || '') : 'x') + '|' + ZR.length + '|' + (rec && rec.at || '');
    if (EXPO && EXPO.key === key && EXPO.base === B) return EXPO;
    let hdd = {}, source = 'none';
    /* 1 the climate baseline: the ZIP table, or the normals grid read at the centroid */
    if (B && L && L.climate && L.climate.zip) { try { ZR.forEach(z => { const v = L.climate.zip(z.lat, z.lon, null, B, z.zip).normHdd; if (v > 0) hdd[z.zip] = v; }); } catch (e) { hdd = {}; } if (Object.keys(hdd).length >= 0.9 * ZR.length) source = 'grid'; else hdd = {}; }
    /* 2 station normals, read at each ZIP from its three nearest stations (annual normals; failing those, the normal to date) */
    if (source === 'none' && L && L.climate && L.climate.status && rec && rec.data) {
      try { const st = L.climate.status(rec.data, B, new Date()).stations.filter(s => isN(s.lat) && isN(s.lon)); let pts = st.filter(s => s.normHdd > 0).map(s => ({ lat: s.lat, lon: s.lon, v: s.normHdd })); if (pts.length < 3) pts = st.filter(s => s.hddNorm >= 100).map(s => ({ lat: s.lat, lon: s.lon, v: s.hddNorm }));
        if (pts.length >= 3) { ZR.forEach(z => { hdd[z.zip] = sum(near3(z.lat, z.lon, pts).map(n => n.w * n.p.v)); }); source = 'stations'; } } catch (e) { hdd = {}; source = 'none'; }
    }
    const has = ZR.filter(z => hdd[z.zip] > 0), m = has.length ? sum(has.map(z => z.occ * hdd[z.zip])) / sum(has.map(z => z.occ)) : null, byZip = {};
    ZR.forEach(z => { byZip[z.zip] = m && hdd[z.zip] > 0 ? hdd[z.zip] / m : 1; });
    const lab = source === 'grid' ? `Cold exposure reads the 1991 to 2020 normals grid: each ZIP against the household weighted metro mean of ${nf(m)} heating degree days a year.` : source === 'stations' ? 'Cold exposure reads station normals at the three stations nearest each ZIP; the normals grid is not loaded.' : 'No climate normals are loaded: cold exposure is 1 in every ZIP.';
    EXPO = { byZip, hdd, source, mean: m, label: lab }; Object.defineProperty(EXPO, 'key', { value: key }); Object.defineProperty(EXPO, 'base', { value: B });      // the memo's own keys stay out of the listed fields
    return EXPO;
  }

  /* ---------- the static cell table: everything that comes from module 12, the ZIP ledger, the dispatch point and the normals ---------- */
  let BASE = null;
  function base() {
    const o = origin(), X = exposure(), ref = SLM.SLZ[ZR[0].zip].heat, A = SLM.A;
    const key = o.lat + ',' + o.lon + '|' + X.key + '|' + JSON.stringify([A.cpc, IDS.map(id => A.lines[id]), A.lines.replace.margin]);
    if (BASE && BASE.ref === ref && BASE.key === key) return BASE;                                   // module 12 makes new rows on every recompute
    const n = ZR.length, Zb = ZR.map((z, i) => { const km = isN(z.lat) && isN(z.lon) ? hav(o.lat, o.lon, z.lat, z.lon) : (z.km_integrity || 0); return { i, z, zip: z.zip, km, min: 5 + km, x: X.byZip[z.zip], own: z.sys_ownsf || 0, rent: z.sys_rentsf || 0, mf: z.sys_mf || 0, fuel: fuel(z) }; });
    const lines = IDS.map(id => { const L = SLM.LI[id], c0 = SLM.cplByPlatform(L, null), jobs = new Float64Array(n), press = new Float64Array(n), pct = new Float64Array(n), gd = new Float64Array(n), gpipe = new Float64Array(n), goog = new Float64Array(n), ms = new Float64Array(n); let close = 0;
      ZR.forEach((z, i) => { const r = SLM.SLZ[z.zip][id], u = SLM.unitEcon(L, z), c = SLM.cplByPlatform(L, z.cpc_rel); jobs[i] = r.jobs; pct[i] = r.presspct; press[i] = 0.55 + 0.9 * r.presspct / 100; gd[i] = u.gpDirect; gpipe[i] = u.gpPipe; goog[i] = c.google; ms[i] = c.microsoft; close = u.close / 100; });
      return { id, L, c0, jobs, press, pct, gd, gpipe, goog, ms, close }; });
    return (BASE = { ref, key, n, Z: Zb, lines, X, origin: o });
  }
  /* platform shares of a line as the cost per lead sees them: Local Services folds into Google Search while it is not live */
  function platShares(P, id, c0) {
    const s = Object.assign({}, P.plat[id]); if (!P.lsaLive) { s.google += s.lsa; s.lsa = 0; }
    PLATS.forEach(p => { if (p !== 'google' && s[p] > 0 && c0 && !isN(c0[p])) { s.google += s[p]; s[p] = 0; } });        // a platform module 12 gives no lead cost for
    const T = sum(PLATS.map(p => s[p])) || 1; PLATS.forEach(p => { s[p] /= T; }); if (!(s.google > 0) && !PLATS.some(p => s[p] > 0)) s.google = 1; return s;
  }
  /* weight of a night by its low, a 40°F night = 1; straight lines between the knots (the middle four are the live layer's thresholds) */
  function nightW(t, P) {
    const w = (P && P.nightW) || DEF.nightW, h = TH(), k = [60, h.cool, h.cold, h.freeze, h.hard, 15];
    if (t >= k[0]) return w[0]; if (t <= k[5]) return w[5];
    for (let i = 0; i < 5; i++) if (t <= k[i] && t >= k[i + 1]) return w[i] + (w[i + 1] - w[i]) * (k[i] - t) / (k[i] - k[i + 1]);
    return w[2];
  }
  const normLow = m => 65 - SLM.NORM.hdd[m] / DIM[m] - 10.5;                                         // normal daily low from the monthly heating degree day normal

  /* ---------- one cell per ZIP per line ---------- */
  function build(P, opt) {
    const B = base(), scale = opt.scale || 1, wx = opt.wx && opt.wx.ok ? opt.wx : null, blk = new Set(P.blocks), pin = new Set(P.pins);
    const rsIn = opt.reachScale, rs = rsIn == null ? null : okNum(rsIn) ? { heat: +rsIn, maint: +rsIn } : typeof rsIn === 'object' ? rsIn : null, rsOf = (id, zip) => { const k = rs.zip && rs.zip[zip] != null ? rs.zip[zip] : rs[id]; return okNum(k) && +k > 0 ? +k : 1; };
    const keep = opt.keep ? new Set(opt.keep.cells.filter(c => c.spend > 0).map(c => c.id + c.zip)) : null, cs = opt.costScale && typeof opt.costScale === 'object' ? opt.costScale : null;
    const cells = [], by = {}, info = {};
    B.lines.forEach((Lb, li) => { const id = Lb.id, s = platShares(P, id, Lb.c0), c0 = Lb.c0, sig = P.paid[id] * P.cap, e = P.coldExp[id], season = Lb.L.months[P.month], close = Lb.close, w3 = P.dmw, soc = (s.lsa > 0 ? s.lsa / c0.lsa : 0) + (s.meta > 0 ? s.meta / c0.meta : 0) + (s.nextdoor > 0 ? s.nextdoor / c0.nextdoor : 0);
      const cpl0 = 1 / ((s.google > 0 ? s.google / c0.google : 0) + (s.microsoft > 0 ? s.microsoft / c0.microsoft : 0) + soc), rows = by[id] = [], stretch = rs && (id === 'heat' || id === 'maint');
      /* the same lead cost for any other platform mix of the line (what runs after the minimum folds): the metro blend, and the cell's own with its cost index */
      const part = (v, c) => (v > 0 && isN(c) && c > 0 ? v / c : 0), socOf = sh => part(sh.lsa, c0.lsa) + part(sh.meta, c0.meta) + part(sh.nextdoor, c0.nextdoor);
      const runCost = sh => { const so = socOf(sh), m = 1 / (part(sh.google, c0.google) + part(sh.microsoft, c0.microsoft) + so); return { cpl0: m, of: (i, zip) => m * Math.pow(1 / (part(sh.google, Lb.goog[i]) + part(sh.microsoft, Lb.ms[i]) + so) / m * Lb.press[i], P.trust) * (cs && okNum(cs[zip]) && +cs[zip] > 0 ? +cs[zip] : 1) }; };
      info[id] = { plat: s, cpl0, close, sigma: sig, season, c0, runCost };
      for (let i = 0; i < B.n; i++) { const zb = B.Z[i]; if (blk.has(zb.zip)) continue;
        const half = P.half[id] * (stretch ? rsOf(id, zb.zip) : 1), R = reach(zb.min, half, P.cut);
        const tot = zb.own + zb.rent + zb.mf, dm = id === 'maint' ? 1 : tot > 0 ? (zb.own * w3[0] + zb.rent * w3[1] + zb.mf * w3[2]) / tot : 1;       // who decides: a tune up pool is already owner occupied homes
        const xf = e ? Math.pow(zb.x, e) : 1, w = wx ? wx.mult(zb.zip, id) : 1;
        const cost = Math.pow(1 / ((s.google > 0 ? s.google / Lb.goog[i] : 0) + (s.microsoft > 0 ? s.microsoft / Lb.ms[i] : 0) + soc) / cpl0 * Lb.press[i], P.trust) * (cs && okNum(cs[zb.zip]) && +cs[zb.zip] > 0 ? +cs[zb.zip] : 1);   // modeled auction cost, shrunk toward the metro (costScale: a what if on one ZIP)
        const cpl = cpl0 * cost, J = Lb.jobs[i] * dm * season / 1200 * xf * w * scale, g = Lb.gd[i] + P.pipeCredit * Lb.gpipe[i], rho = R > 0 ? close * R * g / cpl : 0;
        const c = { zip: zb.zip, id, z: zb.z, zi: i, li, min: zb.min, R, dm, x: xf, w, cost, cpl, close, J, g, gd: Lb.gd[i], gpipe: Lb.gpipe[i], rho, rhoD: rho, K: sig * J * cpl / close, vpc: R * g, floor: 0,
          core: R > 0 && ((zb.min <= P.coreMin && (id === 'heat' || id === 'maint')) || pin.has(zb.zip) || !!(keep && keep.has(id + zb.zip))), spend: 0, state: R > 0 ? 'under' : 'out', capped: false, y: null, conf: 0, fill: 0, leads: 0, jobs: 0, gp: 0, gpDirect: 0, bid: null, valueRule: null, sigma: sig, cplRun: cpl, KRun: sig * J * cpl / close };
        rows.push(c); cells.push(c); }
    });
    return { B, cells, by, info };
  }

  /* ---------- the fill ---------- */
  /* A cell answers spend x with jobs = σ J R (1 − exp(−x / K)), so the best split of a budget is x = K ln(ρ / λ) where ρ clears λ.
     The desk does not know ρ to better than its stated doubt s, so each cell gets the average of that rule over a normal error
     in ln ρ: x = K (y Φ(y / s) + s φ(y / s)), y = ln(ρ / λ). λ is found by bisection and never goes under the hurdle. Home turf,
     pinned and kept cells are floored (what the minimum leads cost at the line's metro lead cost), no ZIP takes more than the cap,
     cells under the minimum leads are dropped a third at a time. */
  const floorOf = (c, fs) => Math.min(fs * c.cpl, 0.69 * c.K) / c.cost;      // the minimum leads priced at the line's metro lead cost, never more than half the cell's saturation: a dearer auction never raises a floor
  function fill(rows, Bud, P, scale, wide) {
    const n = rows.length, s = Math.max(1e-4, P.doubt), fs = P.depth * scale, lnH = Math.log(Math.max(1e-9, P.hurdle)), out = { lnLam: lnH, lam: Math.exp(lnH), cap: P.zipCap, loosened: false, atHurdle: false, spent: 0 };
    rows.forEach(c => { c.spend = 0; c.y = null; c.capped = false; });
    if (!n || !(Bud > 0)) return out;
    const lr = new Float64Array(n), K = new Float64Array(n), fl = new Float64Array(n), th = new Float64Array(n), raw = new Float64Array(n), sp = new Float64Array(n), on = new Uint8Array(n), zi = new Int32Array(n), slot = new Map(), zips = [];
    let nz = 0, lrMax = -Infinity; rows.forEach((c, k) => { lr[k] = Math.log(c.rhoD); K[k] = c.K; if (lr[k] > lrMax) lrMax = lr[k]; let j = slot.get(c.zip); if (j == null) { j = nz++; slot.set(c.zip, j); zips.push(c.zip); } zi[k] = j; });
    /* the ZIP cap is a share of the group's own budget. A week of a one fill month is poured line by line: it hands in the whole week as
       the base and what each ZIP has left of its cap after the lines poured before (wide), so the cap still holds for the ZIP as a whole */
    const capBase = wide ? wide.base : Bud, cap0 = new Float64Array(nz), cap = new Float64Array(nz), zt = new Float64Array(nz), zf = new Float64Array(nz); let mul = 1, lnLam = lnH;
    for (let j = 0; j < nz; j++) cap0[j] = wide && wide.left.has(zips[j]) ? Math.max(0, Math.min(P.zipCap * capBase, wide.left.get(zips[j]))) : P.zipCap * capBase;
    const total = l => { zt.fill(0); for (let k = 0; k < n; k++) { if (!on[k]) continue; const y = lr[k] - l, t = y / s; let v = 0;
        if (t >= -9) { const a = t < 0 ? -t : t, q = 1 / (1 + 0.2316419 * a), e = Math.exp(-a * a / 2) / SQ2PI, p = e * q * (0.31938153 + q * (-0.356563782 + q * (1.781477937 + q * (-1.821255978 + q * 1.330274429)))); v = K[k] * (y * (t >= 0 ? 1 - p : p) + s * e); }
        if (v < fl[k]) v = fl[k]; raw[k] = v; zt[zi[k]] += v; }
      let T = 0; for (let j = 0; j < nz; j++) T += zt[j] > cap[j] ? cap[j] : zt[j]; return T; };
    const solve = it => { let T = total(lnH); if (T <= Bud) { lnLam = lnH; return T; } let lo = lnH, hi = Math.max(lnH, lrMax) + 4 + 12 * s; for (let i = 0; i < it; i++) { const mid = (lo + hi) / 2; if (total(mid) > Bud) lo = mid; else hi = mid; } lnLam = hi; return total(hi); };
    /* a capped ZIP keeps its floors and shares the rest of its cap in proportion */
    const spread = () => { for (let k = 0; k < n; k++) { const j = zi[k]; sp[k] = !on[k] ? 0 : zt[j] > cap[j] ? fl[k] + (raw[k] - fl[k]) * (cap[j] - zf[j]) / (zt[j] - zf[j]) : raw[k]; } };
    let T = 0;
    for (let relax = 0; relax < 12; relax++) {
      for (let j = 0; j < nz; j++) cap[j] = cap0[j] * mul;
      on.fill(1); zf.fill(0);
      for (let k = 0; k < n; k++) { const c = rows[k]; th[k] = Math.min(fs * c.cpl, 0.5 * cap[zi[k]]); fl[k] = c.core ? floorOf(c, fs) : 0; zf[zi[k]] += fl[k]; }
      for (let k = 0; k < n; k++) if (fl[k] > 0 && zf[zi[k]] > 0.5 * cap[zi[k]]) fl[k] *= 0.5 * cap[zi[k]] / zf[zi[k]];      // a ZIP's floors never take more than half its cap
      let need = 0; for (let k = 0; k < n; k++) need += fl[k]; if (need > 0.5 * Bud) for (let k = 0; k < n; k++) fl[k] *= 0.5 * Bud / need;      // and all floors together never more than half the budget
      zf.fill(0); for (let k = 0; k < n; k++) zf[zi[k]] += fl[k];
      for (let pass = 0; pass < 60; pass++) {
        T = solve(22); spread();
        const weak = []; for (let k = 0; k < n; k++) if (on[k] && !rows[k].core && sp[k] < th[k]) weak.push(k);
        if (!weak.length) break;
        weak.sort((a, b) => sp[a] / rows[a].cpl - sp[b] / rows[b].cpl); for (let i = 0, m = Math.max(1, Math.ceil(weak.length / 3)); i < m; i++) on[weak[i]] = 0;
      }
      T = solve(46); spread();
      let hit = false; for (let j = 0; j < nz; j++) if (zt[j] > cap[j] * (1 + 1e-9)) { hit = true; break; }
      if (T >= 0.995 * Bud || !hit) break;                                                                         // placed, or held back by the hurdle and not by the cap
      mul *= 1.3; out.loosened = true;                                                                              // too few ZIPs for the cap: loosen it a step
    }
    let spent = 0; rows.forEach((c, k) => { c.spend = sp[k] > 0 ? sp[k] : 0; c.floor = fl[k]; c.y = lr[k] - lnLam; c.capped = !!on[k] && zt[zi[k]] > cap[zi[k]] * (1 + 1e-9); spent += c.spend; });
    out.lnLam = lnLam; out.lam = Math.exp(lnLam); out.cap = P.zipCap * mul; out.spent = spent; out.atHurdle = lnLam === lnH && spent < Bud * 0.9995;
    return out;
  }
  /* dollars a group of cells takes at a given cut with no cap: the budget at which the hurdle starts to bind, and the budget at which a ZIP on the bench comes in */
  function takes(rows, lnLam, P, scale) { const s = Math.max(1e-4, P.doubt), fs = P.depth * scale; let T = 0; for (const c of rows) { if (!(c.rhoD > 0 && c.K > 0)) continue; const v = c.K * soft(Math.log(c.rhoD) - lnLam, s), f = c.core ? floorOf(c, fs) : 0; if (c.core) T += Math.max(v, f); else if (v >= fs * c.cpl) T += v; } return T; }
  /* the cut at which a cell would first hold the minimum leads (null: never, its ceiling is too small) */
  function entry(c, P, scale) { const s = Math.max(1e-4, P.doubt), want = P.depth * scale * c.cpl / c.K; if (!(c.rhoD > 0 && c.K > 0)) return null; let lo = -(4 + 12 * s), hi = want + 1; if (hi > 12) return null; for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (soft(mid, s) < want) lo = mid; else hi = mid; } return Math.log(c.rhoD) - hi; }
  /* what the money buys, at the lead cost of the platforms that run (KRun; the fill placed the money at the planned mix, K) */
  const outcome = c => { c.fill = c.spend > 0 && c.KRun > 0 ? 1 - Math.exp(-c.spend / c.KRun) : 0; c.leads = c.sigma * c.J * c.fill / c.close; c.jobs = c.sigma * c.J * c.R * c.fill; c.gp = c.jobs * c.g; c.gpDirect = c.jobs * c.gd; };

  /* ---------- the plan ---------- */
  /* opt: wx (a weather result), reachScale ({ heat, maint, zip } or a number), budget, scale (period over a month), lineBudgets
     ({ line: dollars }: one fill per line), hold (a month plan: its ZIPs and bids stay, only the money moves), keep (a month
     plan whose funded cells stay in), crewCap (booked jobs the period can run), costScale ({ zip: factor } on the cost index: a what if), lite (skip the
     bench and the words). Anything malformed is ignored */
  function plan(Pin, opt) {
    const t0 = stamp(); opt = Object.assign({}, opt && typeof opt === 'object' ? opt : {});
    opt.scale = okNum(opt.scale) && +opt.scale > 0 ? +opt.scale : 1; opt.hold = isPlan(opt.hold) ? opt.hold : null; opt.keep = !opt.hold && isPlan(opt.keep) ? opt.keep : null; opt.lineBudgets = opt.lineBudgets && typeof opt.lineBudgets === 'object' ? opt.lineBudgets : null;
    const P = params(Pin), scale = opt.scale, s = Math.max(1e-4, P.doubt), ref = opt.hold || opt.keep || null, lb = id => (okNum(opt.lineBudgets[id]) ? Math.max(0, +opt.lineBudgets[id]) : 0);
    const Bud = opt.lineBudgets ? sum(IDS.map(lb)) : okNum(opt.budget) ? Math.max(0, +opt.budget) : P.budget;
    const custom = !!opt.lineBudgets || P.mode === 'custom', bl = id => (opt.lineBudgets ? lb(id) : Bud * P.mix[id] / 100);
    const { B, cells, by, info } = build(P, opt), live = id => by[id].filter(c => c.rho > 0 && c.K > 0), notes = [], note = (kind, text) => notes.push({ kind, text });
    /* line trust: each line's mean return is pulled toward the mean of the four, so stated lead costs and close rates (grade D) do not pick the mix alone */
    const lm = {}, shrink = {}; IDS.forEach(id => { let a = 0, t = 0; for (const c of by[id]) if (c.rho > 0 && c.K > 0) { const k = c.K * c.R; a += k * Math.log(c.rho); t += k; } lm[id] = t > 0 ? Math.exp(a / t) : null; });
    const have = IDS.filter(id => lm[id] != null), all = have.length ? Math.exp(sum(have.map(id => Math.log(lm[id]))) / have.length) : 1;
    /* a week poured again line by line keeps the month's line trust, so the hurdle means in the week what it meant in the month */
    IDS.forEach(id => { shrink[id] = opt.lineBudgets && ref && ref.line[id] && ref.line[id].shrink > 0 ? ref.line[id].shrink : !custom && lm[id] != null ? Math.pow(all / lm[id], 1 - P.gamma) : 1; for (const c of by[id]) c.rhoD = c.rho * shrink[id]; });
    /* fill: one pour across the four lines, or one per line with its own dollars */
    const groups = [], lam = {}, wide = opt.lineBudgets && ref && P.mode !== 'custom' ? Bud : 0; let capUsed = P.zipCap, loosened = false;      // wide: a week of a one fill month keeps the cap a share of the whole week, as it was of the whole month
    if (opt.hold) {
      IDS.forEach(id => { const b = bl(id); let T = 0; for (const c of by[id]) { const m = opt.hold.at[c.zip], was = m && m.lines[id] ? m.lines[id].spend : 0; c.wt = was * c.w; T += c.wt; if (m && m.lines[id]) { c.y = m.lines[id].y; c.floor = 0; } } for (const c of by[id]) c.spend = T > 0 ? b * c.wt / T : 0; lam[id] = opt.hold.line[id].lambda; shrink[id] = opt.hold.line[id].shrink; });
    } else if (custom) {
      const left = wide ? new Map() : null;
      IDS.forEach(id => { const rows = live(id), f = fill(rows, bl(id), P, scale, wide ? { base: wide, left } : null); if (left) rows.forEach(c => { if (c.spend > 0) left.set(c.zip, (left.has(c.zip) ? left.get(c.zip) : P.zipCap * wide) - c.spend); }); groups.push({ ids: [id], rows, f, budget: bl(id) }); lam[id] = f.lam; capUsed = Math.max(capUsed, f.cap); loosened = loosened || f.loosened; });
    } else {
      const rows = [].concat(...IDS.map(live)), f = fill(rows, Bud, P, scale); groups.push({ ids: IDS, rows, f, budget: Bud }); IDS.forEach(id => { lam[id] = f.lam; }); capUsed = f.cap; loosened = f.loosened;
    }
    /* what runs. A platform share under its minimum runs on Google Search instead (a fold): the ZIP money stays where the fill put it, at the
       lead cost of the planned mix, and every outcome (leads, jobs, gross profit, the ranges) is priced at the lead cost of the mix that
       runs. With no fold the two are the same numbers. Local Services is one profile with one budget: its minimum is met by the lines together */
    const mixRun = () => { const lsaAll = sum(IDS.map(id => sum(by[id].map(c => c.spend)) * info[id].plat.lsa));
      IDS.forEach(id => { const I = info[id], d = sum(by[id].map(c => c.spend)), pd = {}, folded = []; PLATS.forEach(p => { pd[p] = d * I.plat[p]; });
        PLATS.forEach(p => { if (p !== 'google' && pd[p] > 0 && (p === 'lsa' ? lsaAll : pd[p]) < (P.platMin[p] || 0) * scale) { folded.push({ line: id, platform: p, dollars: pd[p], to: 'google', leadsOver: 0, why: '' }); pd.google += pd[p]; pd[p] = 0; } });
        I.d = d; I.pd = pd; I.folded = folded; I.lsaAll = lsaAll;
        if (!folded.length || !(d > 0)) { I.run = I.plat; I.cplRun0 = I.cpl0; for (const c of by[id]) { c.cplRun = c.cpl; c.KRun = c.K; } }
        else { const sh = {}; PLATS.forEach(p => { sh[p] = Math.round(pd[p] / d * 1e12) / 1e12; }); const rc = I.runCost(sh); I.run = sh; I.cplRun0 = rc.cpl0; for (const c of by[id]) { c.cplRun = rc.of(c.zi, c.zip); c.KRun = c.sigma * c.J * c.cplRun / c.close; } }
        /* the share of the line's leads each platform brings: its dollars over its own lead cost */
        const lw = {}; let lt = 0; PLATS.forEach(p => { lw[p] = I.run[p] > 0 && isN(I.c0[p]) && I.c0[p] > 0 ? I.run[p] / I.c0[p] : 0; lt += lw[p]; }); PLATS.forEach(p => { lw[p] = lt > 0 ? lw[p] / lt : p === 'google' ? 1 : 0; }); I.leadShare = lw; }); };
    mixRun();
    /* the crew cap: more booked jobs than the crews can run comes out of the Far tier first, then the Ring, then the Core */
    let crew = null;
    if (opt.crewCap != null && opt.crewCap >= 0) {
      const none = new Set();
      for (let pass = 0; pass < 3; pass++) {                                                             // a cut can push a platform under its minimum: the lead cost follows what runs, and the cap is checked again
        const funded = cells.filter(c => c.spend > 0), jobsAt = (set, f) => { let j = 0; for (const c of funded) { const x = set.has(c) ? c.spend * f : c.spend; j += c.sigma * c.J * c.R * (1 - Math.exp(-x / c.KRun)); } return j; }, before = jobsAt(none, 1);
        if (!(before > opt.crewCap * (pass ? 1.0001 : 1))) { if (crew) crew.after = before; break; }
        if (!crew) crew = { cap: opt.crewCap, jobs: before, after: before, cut: 0, tiers: [] };
        for (const tr of ['Far', 'Ring', 'Core']) { const setT = new Set(funded.filter(c => tier(c.min) === tr)); if (!setT.size) continue; let f = 0;
          if (jobsAt(setT, 0) < opt.crewCap) { let lo = 0, hi = 1; for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (jobsAt(setT, mid) > opt.crewCap) hi = mid; else lo = mid; } f = lo; }
          setT.forEach(c => { crew.cut += c.spend * (1 - f); c.spend *= f; }); const was = crew.tiers.find(x => x.tier === tr); if (was) was.kept *= f; else crew.tiers.push({ tier: tr, kept: f }); crew.after = jobsAt(none, 1); if (crew.after <= opt.crewCap * 1.0001) break; }
        mixRun();
      }
    }
    /* outcomes, confidence, states */
    cells.forEach(c => { if (!(c.spend > 0)) c.spend = 0; outcome(c); c.conf = c.y == null ? 0 : PHI(c.y / s); c.state = c.spend > 0 ? 'in' : c.R > 0 ? (c.y != null && c.y >= 0 ? 'small' : 'under') : 'out'; });
    if (crew) crew.after = sum(cells.map(c => c.jobs));
    /* bids: what a lead is worth here against the spend weighted average of the line's buy; cost decides how much is bought, value decides the bid */
    const vbar = {}; IDS.forEach(id => { const inb = by[id].filter(c => c.spend > 0), sp = sum(inb.map(c => c.spend)); vbar[id] = ref && ref.line[id].vbar ? ref.line[id].vbar : sp > 0 ? sum(inb.map(c => c.vpc * c.spend)) / sp : 0;
      inb.forEach(c => { const m = ref && ref.at[c.zip] && ref.at[c.zip].lines[id], r = vbar[id] > 0 ? c.vpc / vbar[id] : 1; c.bid = m && m.bid != null ? m.bid : clamp(Math.round((r - 1) * 20) * 5, -50, 50); c.valueRule = m && m.valueRule != null ? m.valueRule : clamp(Math.round(r * 100) / 100, 0.5, 1.5); }); });
    /* roll up by ZIP */
    const blk = new Set(P.blocks), pin = new Set(P.pins), at = {}, allZ = B.Z.map(zb => { const z = zb.z, h = SLM.SLZ[z.zip].heat, tot = zb.own + zb.rent + zb.mf;
      return (at[zb.zip] = { zip: zb.zip, z, city: z.city, county: z.cty, households: z.occ, min: zb.min, km: zb.km, tier: tier(zb.min), x: zb.x, fuel: zb.fuel, who: tot > 0 ? (zb.own * P.dmw[0] + zb.rent * P.dmw[1] + zb.mf * P.dmw[2]) / tot : 1, cost: 1, pressure: h.presspct, home: zb.min <= P.coreMin, pinned: pin.has(zb.zip), blocked: blk.has(zb.zip), inPlan: false, lines: {}, dollars: 0, share: 0, rank: null, bid: null, conf: 0, label: null, top: null, leads: 0, jobs: 0, gp: 0, gpDirect: 0, why: '' }); });
    cells.forEach(c => { const r = at[c.zip]; r.lines[c.id] = c; if (c.id === 'heat') r.cost = c.cost; if (c.spend > 0) { r.dollars += c.spend; r.leads += c.leads; r.jobs += c.jobs; r.gp += c.gp; r.gpDirect += c.gpDirect; if (c.conf > r.conf) r.conf = c.conf; if (!r.top || c.spend > r.lines[r.top].spend) r.top = c.id; } });
    const zips = allZ.filter(r => r.dollars > 0).sort((a, b) => b.dollars - a.dollars), spent = sum(zips.map(r => r.dollars)) || 0;
    zips.forEach((r, i) => { r.inPlan = true; r.rank = i + 1; r.share = r.dollars / spent; r.label = label(r.conf); r.bid = clamp(Math.round(sum(IDS.map(id => (r.lines[id] && r.lines[id].spend > 0 ? r.lines[id].bid * r.lines[id].spend : 0))) / r.dollars / 5) * 5, -50, 50); });
    /* by line */
    const lineRows = IDS.map(id => { const inb = by[id].filter(c => c.spend > 0).sort((a, b) => b.spend - a.spend), d = sum(inb.map(c => c.spend)), leads = sum(inb.map(c => c.leads)), jobs = sum(inb.map(c => c.jobs)), gp = sum(inb.map(c => c.gp)), gpd = sum(inb.map(c => c.gpDirect)), I = info[id];
      /* a platform under its minimum is a fold: the ZIP money stays as planned, the outcomes above are priced at what runs, and the words say what that costs against the planned mix */
      const pd = I.pd, folded = I.folded, planned = sum(inb.map(c => (c.K > 0 ? c.sigma * c.J * (1 - Math.exp(-c.spend / c.K)) / c.close : 0))), lost = planned - leads, min$ = p => usd((P.platMin[p] || 0) * scale);
      folded.forEach(f => { const p = f.platform, c = I.c0[p]; f.why = (p === 'lsa' ? `${PLAT_NAMES[p]} would get ${usd(I.lsaAll)} from the four lines together, under its ${min$(p)} minimum: the ${usd(f.dollars)} from ${NAMES[id].toLowerCase()} runs on Google Search` : `${PLAT_NAMES[p]} would get ${usd(f.dollars)} from ${NAMES[id].toLowerCase()}, under its ${min$(p)} minimum: that share runs on Google Search`) + (isN(c) && Math.abs(I.c0.google - c) >= 0.5 ? `, where a lead is modeled at ${usd(I.c0.google)} against ${usd(c)}` : ''); });
      const runWhy = !folded.length || !(d > 0) ? '' : `${NAMES[id]} runs on ${words(PLATS.filter(p => pd[p] > 0).map(p => PLAT_NAMES[p]))}${PLATS.filter(p => pd[p] > 0).length === 1 ? ' alone' : ''} after the folds: a lead is priced at ${usd(I.cplRun0)} before the ZIP's cost index, against ${usd(I.cpl0)} at the planned mix` + (Math.abs(lost) >= 0.5 ? `, about ${Math.abs(lost) >= 10 ? Math.round(Math.abs(lost)) : +Math.abs(lost).toFixed(1)} ${lost > 0 ? 'fewer' : 'more'} leads a ${scale === 1 ? 'month' : 'week'}` : '') + ' (grade D).';
      return { id, name: NAMES[id], share: spent > 0 ? d / spent : 0, dollars: d, target: custom ? (Bud > 0 ? bl(id) / Bud : 0) : null, zips: inb.length, leads, cpl: leads > 0 ? d / leads : null, jobs, cpj: jobs > 0 ? d / jobs : null, gp, gpDirect: gpd, gpPipe: gp - gpd,
        farthest: inb.length ? Math.max(...inb.map(c => c.min)) : 0, avgMin: d > 0 ? sum(inb.map(c => c.min * c.spend)) / d : 0, topShare: d > 0 ? inb[0].spend / d : 0, lambda: lam[id], lambdaRaw: lam[id] / (shrink[id] || 1), shrink: shrink[id], mean: lm[id], season: I.season, cpl0: I.cpl0, close: I.close, sigma: I.sigma,
        plat: I.plat, platDollars: pd, folded, leadsOver: 0, hurdleAt: null, vbar: vbar[id], rows: inb, platRun: I.run, cplRun0: I.cplRun0, leadShare: I.leadShare, leadsPlanned: planned, runWhy }; });
    const line = {}; lineRows.forEach(r => { line[r.id] = r; });
    /* totals */
    const leads = sum(lineRows.map(r => r.leads)), jobs = sum(lineRows.map(r => r.jobs)), gp = sum(lineRows.map(r => r.gp)), gpd = sum(lineRows.map(r => r.gpDirect)), left = Bud - spent - (crew ? crew.cut : 0), unspent = left > 0.005 ? left : 0;
    const atHurdle = groups.some(g => g.f.atHurdle) && unspent > 0.5 * scale, mix = {}; IDS.forEach(id => { mix[id] = line[id].share; });
    let hurdleAt = null;
    if (!opt.hold && scale === 1 && !opt.lite) { const lnH = Math.log(Math.max(1e-9, P.hurdle)); if (custom) { let best = Infinity; groups.forEach(g => { const id = g.ids[0], t = takes(by[id], lnH, P, scale); line[id].hurdleAt = t; if (g.budget > 0 && Bud > 0) best = Math.min(best, t / (g.budget / Bud)); }); hurdleAt = Number.isFinite(best) ? best : null; } else hurdleAt = takes(cells, lnH, P, scale); }
    const T = { budget: Bud, spent, unspent, lambda: custom ? (spent > 0 ? Math.exp(sum(lineRows.map(r => r.dollars * Math.log(r.lambda))) / spent) : P.hurdle) : lam.heat, hurdle: P.hurdle, atHurdle, hurdleAt, leads, jobs, gp, gpDirect: gpd, gpPipe: gp - gpd, cpl: leads > 0 ? spent / leads : null, cpj: jobs > 0 ? spent / jobs : null, gpPerDollar: spent > 0 ? gp / spent : null,
      share20: spent > 0 ? sum(zips.filter(r => r.min <= 20).map(r => r.dollars)) / spent : 0, farthest: zips.length ? Math.max(...zips.map(r => r.min)) : 0, households: sum(zips.map(r => r.households)), zips: zips.length, cells: cells.filter(c => c.spend > 0).length, mode: P.mode, mix, capUsed, capLoosened: loosened, crewCut: crew ? crew.cut : 0, leadsOver: 0, leadsPlanned: sum(lineRows.map(r => r.leadsPlanned)) };
    /* tiers, counties, platforms, campaigns */
    const tiers = TIERS.map(t => { const zs = zips.filter(r => r.tier === t.id), d = sum(zs.map(r => r.dollars)); return { tier: t.id, words: t.words, zips: zs.length, share: spent > 0 ? d / spent : 0, dollars: d, households: sum(zs.map(r => r.households)), leads: sum(zs.map(r => r.leads)) }; });
    const cm = {}; allZ.forEach(r => { const c = cm[r.county] = cm[r.county] || { county: r.county, share: 0, dollars: 0, zips: 0, leads: 0, jobs: 0, zipsAll: 0, zipsReach: 0, mins: [], households: 0, xw: 0, gw: 0 }; c.zipsAll++; if (r.min <= 60) c.zipsReach++; c.mins.push(r.min); c.households += r.households; c.xw += r.x * r.households; c.gw += (r.z.gas_sh || 0) * r.households; if (r.dollars > 0) { c.dollars += r.dollars; c.zips++; c.leads += r.leads; c.jobs += r.jobs; } });
    const counties = Object.values(cm).map(c => ({ county: c.county, share: spent > 0 ? c.dollars / spent : 0, dollars: c.dollars, zips: c.zips, leads: c.leads, jobs: c.jobs, zipsAll: c.zipsAll, zipsReach: c.zipsReach, medianMin: median(c.mins), households: c.households, exposure: c.households > 0 ? c.xw / c.households : 1, gasPct: c.households > 0 ? c.gw / c.households : 0 })).sort((a, b) => b.dollars - a.dollars || a.medianMin - b.medianMin);
    const platforms = PLATS.map(p => { const ls = {}; IDS.forEach(id => { ls[id] = line[id].platDollars[p]; }); const d = sum(IDS.map(id => ls[id])); return { id: p, name: PLAT_NAMES[p], dollars: d, share: spent > 0 ? d / spent : 0, min: p === 'google' ? 0 : (P.platMin[p] || 0) * scale, lines: ls, folded: [].concat(...lineRows.map(r => r.folded.filter(f => f.platform === p))), how: PLAT_HOW[p] }; });
    lineRows.forEach(r => r.folded.forEach(f => note('platform', f.why + '.'))); lineRows.forEach(r => { if (r.runWhy) note('run', r.runWhy); });
    const res = { P, month: P.month, monthName: MONTHS[P.month], period: scale === 1 ? 'month' : 'week', scale, T, lines: lineRows, line, zips, all: allZ, at, cells, counties, tiers, platforms, campaigns: [], bench: [], notes, exposure: { source: B.X.source, mean: B.X.mean, label: B.X.label }, origin: B.origin, crew, ms: 0 };
    Object.defineProperty(res, 'ctx', { value: { groups, by, custom, Bud, scale, bl }, enumerable: false });
    res.campaigns = campaigns(res, opt.structure || (ref && ref.fold) || null);
    Object.defineProperty(res, 'fold', { value: foldOf(res, opt.structure || (ref && ref.fold) || null), enumerable: false });
    foldNotes(res).forEach(t => note('fold', t));
    if (loosened) note('cap', `Too few ZIPs can take this budget under the ${pc(P.zipCap)} cap: the cap was loosened to ${pc(capUsed)} of ${custom && !wide ? 'a line' : 'the plan'} to place it.`);
    const pipeWords = P.pipeCredit <= 0.001 ? 'the first ticket alone, since the pipeline credit is 0' : P.pipeCredit >= 0.999 ? 'pipeline included' : `${pc(P.pipeCredit)} of the pipeline included`;
    if (atHurdle && custom) groups.filter(g => g.f.atHurdle && g.budget - line[g.ids[0]].dollars > 0.5 * scale).forEach(g => { const L = line[g.ids[0]]; note('hurdle', `${usd(g.budget - L.dollars)} of the ${usd(g.budget)} set for ${L.name.toLowerCase()} is left unspent: past ${usd(L.dollars)} its next ad dollar is modeled to return under ${usd2(P.hurdle)} of gross profit, ${pipeWords} (grade D).`); });
    else if (atHurdle) note('hurdle', `${usd(unspent)} is left unspent: past ${usd(spent)} the next ad dollar is modeled to return under ${usd2(P.hurdle)} of gross profit, ${pipeWords}, as the plan weighs the four lines (grade D).${hurdleAt ? ` That begins at about ${usd(hurdleAt)} a month.` : ''}`);
    groups.forEach(g => { if (g.budget > 0.5 * scale && !g.rows.length) note('block', custom ? `${NAMES[g.ids[0]]} has no ZIP it can buy in ${MONTHS[P.month]}: the ${usd(g.budget)} set for it stays unspent.` : `No ZIP can be bought: ${cells.some(c => c.R > 0) ? 'no line has jobs a homeowner ad can reach in ' + MONTHS[P.month] : P.blocks.length ? 'every ZIP inside the reach cut is blocked' : 'none is inside the reach cut'}. Nothing is placed.`); });
    if (!P.lsaLive) note('lsa', `Local Services Ads are planned off: the competitor roster of ${rosterDate()} shows no badge. Their share runs on Google Search until the profile is verified.`);
    P.pins.forEach(zp => { const r = at[zp]; if (r && !IDS.some(id => r.lines[id] && r.lines[id].R > 0)) note('pin', `${zp} ${r.city} is pinned but sits past the reach cut on every line (${Math.round(r.min)} minutes): no money goes there.`); });
    if (B.X.source !== 'grid') note('exposure', B.X.label);
    if (!opt.lite) { zips.forEach(r => { r.why = why(r, res); }); if (!opt.hold) res.bench = bench(res); }
    res.ms = stamp() - t0; return res;
  }
  const usd2 = v => '$' + (+v).toFixed(2);
  const rosterDate = () => { const d = typeof DATA !== 'undefined' && DATA.comp_generated; return d && /^\d{4}-\d{2}/.test(d) ? MONTHS[+d.slice(5, 7) - 1] + ' ' + d.slice(0, 4) : 'August 2026'; };

  /* ---------- campaigns ---------- */
  /* Campaign minimums are fold notes: under the minimum the tune up offer rides on the repair campaign as a promotion asset and
     furnace and heat pump share one replacement campaign as two ad groups. The ZIP money does not change. A week keeps the month's structure. */
  function foldOf(pl, fixed) { if (fixed) return fixed; const min = pl.P.lineMin * pl.scale, d = id => pl.line[id].dollars; return { maint: d('maint') > 0 && d('maint') < min, joint: (d('furnace') > 0 && d('furnace') < min) || (d('heatpump') > 0 && d('heatpump') < min) }; }
  function foldNotes(pl) { const f = pl.fold, out = []; if (f.maint && pl.line.maint.dollars > 0) out.push(`Tune up is under the campaign minimum of ${usd(pl.P.lineMin)} a month: no campaign of its own. The offer runs as a promotion asset on the repair campaign and its ZIP money stays where the plan put it.`); if (f.joint && (pl.line.furnace.dollars > 0 || pl.line.heatpump.dollars > 0)) out.push('Furnace and heat pump replacement share one campaign and one budget, as two ad groups: one of them is under the campaign minimum.'); return out; }
  const campName = (ids, tr, plat) => 'DFW_' + ids.map(id => id.toUpperCase()).join('_') + (plat === 'google' || plat === 'microsoft' ? '_SEARCH' : '_' + plat.toUpperCase()) + (tr ? '_' + tr.toUpperCase() : '') + (plat === 'microsoft' ? '_MS' : '');
  /* a campaign's leads are the line's leads its platform brings (dollars over that platform's own lead cost), so leads times cost per lead is its budget */
  function campaigns(pl, fixed) {
    const P = pl.P, f = foldOf(pl, fixed), out = [], smart = P.bidding === 'smart', A = SLM.A;
    /* a day's budget: the month over 30.4 less the freeze reserve (a week plan is already net of it: a seventh). Repair runs only on the days the phones are answered */
    const perDay = b => (pl.scale === 1 ? b * (1 - P.reserve) / 30.4 : b / 7), open = P.hours.sunday ? 1 : 7 / 6;
    const sets = [f.maint ? ['heat', 'maint'] : ['heat']].concat(f.joint ? [['furnace', 'heatpump']] : [['furnace'], ['heatpump']]).concat(f.maint ? [] : [['maint']]);
    ['google', 'microsoft'].forEach(plat => sets.forEach(ids => { const lead = f.maint && ids[0] === 'heat' ? ['heat'] : ids;
      (smart ? TIERS.map(t => t.id) : [null]).forEach(tr => { const cs = [].concat(...ids.map(id => pl.line[id].rows.filter(c => !tr || tier(c.min) === tr))); if (!cs.length) return;
        const share = c => (pl.line[c.id].dollars > 0 ? pl.line[c.id].platDollars[plat] / pl.line[c.id].dollars : 0), bud = sum(cs.map(c => c.spend * share(c))); if (!(bud > 0)) return;
        const d = sum(cs.map(c => c.spend)), leads = sum(cs.map(c => c.leads * (pl.line[c.id].leadShare[plat] || 0))), zs = new Set(cs.map(c => c.zip)), bids = cs.map(c => c.bid), rel = sum(cs.map(c => c.spend * (c.z.cpc_rel || 1))) / d, mult = sum(cs.map(c => c.spend * A.lines[c.id].cpcMult)) / d;
        out.push({ name: campName(lead, tr, plat), kind: 'search', lines: ids, tier: tr, platform: plat, zips: zs.size, budget: bud, daily: perDay(bud) * (ids[0] === 'heat' ? open : 1), strategy: smart ? 'Target CPA' : 'Maximize clicks', targetCpa: leads > 0 ? bud / leads : null,
          maxCpc: Math.round(1.2 * A.cpc * mult * rel * (plat === 'microsoft' ? 0.67 : 1) * 20) / 20, bidMin: smart ? null : Math.min(...bids), bidMax: smart ? null : Math.max(...bids), leads, cpl: leads > 0 ? bud / leads : null, status: 'Paused',
          note: (smart ? 'Smart Bidding ignores location bid adjustments: the tier, its budget and its first target are the levers' + (bud < 0.25 * P.lineMin * pl.scale ? '; this tier is too small for a target of its own, so run its ZIPs in the next tier in until it grows' : '') : f.maint && ids[0] === 'heat' ? 'carries the tune up offer as a promotion asset' : ids.length > 1 ? 'two ad groups, one budget' : '') + (ids[0] === 'heat' && open > 1 ? (smart || f.maint ? '; ' : '') + 'runs Monday to Saturday, the days the phones are answered' : '') }); }); }));
    ['meta', 'nextdoor'].forEach(plat => IDS.forEach(id => { const bud = pl.line[id].platDollars[plat], leads = pl.line[id].leads * (pl.line[id].leadShare[plat] || 0); if (bud > 0) out.push({ name: campName([id], null, plat), kind: 'social', lines: [id], tier: null, platform: plat, zips: pl.line[id].zips, budget: bud, daily: perDay(bud), strategy: 'Lowest cost', targetCpa: null, maxCpc: null, bidMin: null, bidMax: null, leads, cpl: leads > 0 ? bud / leads : null, status: 'Paused', note: plat === 'meta' ? 'ZIP keys by fuel; financing creative in a special ad category campaign' : 'ZIP list' }); }));
    const lsa = sum(IDS.map(id => pl.line[id].platDollars.lsa)), lsaLeads = sum(IDS.map(id => pl.line[id].leads * (pl.line[id].leadShare.lsa || 0))); if (lsa > 0) out.push({ name: 'Local Services profile', kind: 'lsa', lines: IDS.filter(id => pl.line[id].platDollars.lsa > 0), tier: null, platform: 'lsa', zips: new Set([].concat(...['heat', 'maint'].map(id => pl.line[id].rows.map(c => c.zip)))).size, budget: lsa, daily: null, strategy: 'Price per lead set by the platform', targetCpa: null, maxCpc: null, bidMin: null, bidMax: null, leads: lsaLeads, cpl: lsaLeads > 0 ? lsa / lsaLeads : null, status: 'Paused', note: 'one service area, a weekly budget of ' + usd(perDay(lsa) * 7) });
    return out;
  }

  /* ---------- words ---------- */
  /* why a ZIP is in the plan */
  function why(r, pl) {
    if (!r || !(r.dollars > 0) || !r.z || !r.lines || !r.top || !r.label) return '';
    const z = r.z, b = [], fund = IDS.filter(id => r.lines[id] && r.lines[id].spend > 0), top = NAMES[r.top].toLowerCase();
    b.push(Math.round(r.min) + ' minutes from the shop' + (r.home ? ' (home turf)' : ''));
    b.push(fund.length === 4 ? 'all four lines, most to ' + top : fund.length === 1 ? top + ' only' : 'led by ' + top);
    if ((z.furn20 || 0) >= 900) b.push(nf(z.furn20) + ' gas furnaces past 20 years'); else if ((z.sys_hp || 0) + (z.sys_ef || 0) >= 12000 && (z.elec_sh || 0) >= 65) b.push(nf(z.sys_hp + z.sys_ef) + ' electric heat systems');
    if (r.pressure <= 40) b.push('quiet auction'); else if (r.pressure >= 85) b.push('crowded auction');
    if (r.who <= 0.6) b.push('apartment heavy, counted at ' + Math.round(r.who * 100) + '%');
    if ((z.ticket || 0) >= 1.15 * SLM.TICK_MED) b.push('high tickets');
    if (r.x >= 1.04) b.push(Math.round((r.x - 1) * 100) + '% colder than the metro');
    if (r.pinned) b.push('pinned by you');
    b.push(r.label.toLowerCase() + ': ' + Math.round(r.conf * 100) + '% chance its return clears the cut');
    return b.join('; ');
  }
  const leadWords = d => (d === 0.5 ? 'half a lead' : d === 0.25 ? 'a quarter of a lead' : d === 1 ? 'one lead' : d + ' leads');
  /* why a ZIP is not in the plan: { code, reason }. The first that applies, in the order an owner would ask: blocked, out of reach, apartment
     heavy, crowded, too small, just under the cut, low return */
  function heldWhy(r, pl) {
    const P = pl.P; if (r.blocked) return { code: 'blocked', reason: 'blocked by you' };
    const cs = IDS.map(id => r.lines[id]).filter(c => c && c.R > 0);
    if (!cs.length) return { code: 'reach', reason: `past the reach cut on every line at ${Math.round(r.min)} minutes` };
    const best = cs.filter(c => c.y != null).sort((a, b) => b.y - a.y)[0];
    if (!best) return { code: 'low', reason: 'no money in its lines this period' };
    if (r.who <= 0.55) return { code: 'apartments', reason: `apartment heavy: ${Math.round(r.who * 100)}% of systems count as homeowner decisions` };
    if (r.pressure >= 85) return { code: 'crowded', reason: `crowded and costly: competitor pressure in the top ${Math.max(1, Math.round(100 - r.pressure))}%` };
    if (best.y >= 0) return { code: 'small', reason: `too small for ${leadWords(P.depth)} a month in any one line` };
    if (best.y >= -0.2) return { code: 'near', reason: `return just under the cut (${NAMES[best.id].toLowerCase()} comes within ${Math.max(1, Math.round((1 - Math.exp(best.y)) * 100))}%)` };
    return { code: 'low', reason: r.min > 25 ? `low return at ${Math.round(r.min)} minutes: the drive takes ${Math.round((1 - best.R) * 100)}% off a lead's value` : `low return: ${NAMES[best.id].toLowerCase()}, its best line here, is modeled ${Math.round((1 - Math.exp(best.y)) * 100)}% under the cut` };
  }
  /* the budget at which a ZIP outside the plan comes in, and through which lines */
  function enterOf(r, pl) {
    if (!pl.ctx) return { enterAt: null, via: [] };                                                    // a copy of a plan carries no working set
    const { by, custom, Bud, scale, bl } = pl.ctx, P = pl.P, lnH = Math.log(Math.max(1e-9, P.hurdle)); let best = null;
    IDS.forEach(id => { const c = r.lines[id]; if (!c || !(c.R > 0) || c.spend > 0) return; const l = entry(c, P, scale); if (l == null || l < lnH) return;
      const share = custom ? (Bud > 0 ? bl(id) / Bud : 0) : 1; if (!(share > 0)) return; const b = takes(custom ? by[id] : pl.cells, l, P, scale) / share / scale;
      if (!best || b < best.b * 0.98) best = { b, via: [id] }; else if (b <= best.b * 1.02) best.via.push(id); });
    return best ? { enterAt: Math.max(Math.ceil(best.b / 500) * 500, Math.floor(P.budget / 500) * 500 + 500), via: best.via } : { enterAt: null, via: [] };
  }
  function bench(pl, n) {
    const P = pl.P, scale = pl.ctx.scale, cand = pl.all.filter(r => !r.inPlan && !r.blocked).map(r => { let l = -Infinity; IDS.forEach(id => { const c = r.lines[id]; if (c && c.R > 0) { const e = entry(c, P, scale); if (e != null && e > l) l = e; } }); return { r, l }; }).filter(x => x.l > -Infinity).sort((a, b) => b.l - a.l).slice(0, pl.ctx.custom ? 40 : (n || 12) + 6);
    return cand.map(x => Object.assign({ zip: x.r.zip, city: x.r.city, county: x.r.county, min: x.r.min }, enterOf(x.r, pl), heldWhy(x.r, pl))).filter(b => b.enterAt != null).sort((a, b) => a.enterAt - b.enterAt || a.min - b.min).slice(0, n || 12);
  }
  /* close to the shop and not in the plan */
  function held(pl, within) { if (!isPlan(pl)) return []; const lim = okNum(within) && +within > 0 ? +within : 25; return pl.all.filter(r => !r.inPlan && r.min <= lim).sort((a, b) => a.min - b.min).map(r => Object.assign({ zip: r.zip, city: r.city, county: r.county, min: r.min, households: r.households, pressure: r.pressure, cost: r.cost, who: r.who }, heldWhy(r, pl), r.blocked ? { enterAt: null, via: [] } : enterOf(r, pl))); }
  /* the Campaign Desk hand off: the desk knows two heating lines, 'heat' (repair and replacement) and 'maint' */
  function hand(pl, lineId) { if (!isPlan(pl)) return { zips: [], line: lineId === 'maint' ? 'maint' : 'heat', bids: {} }; const ids = IDS.includes(lineId) ? [lineId] : IDS, zs = pl.zips.filter(r => ids.some(id => r.lines[id] && r.lines[id].spend > 0)), bids = {}; zs.forEach(r => { const cs = ids.map(id => r.lines[id]).filter(c => c && c.spend > 0), d = sum(cs.map(c => c.spend)); bids[r.zip] = clamp(Math.round(sum(cs.map(c => c.bid * c.spend)) / d / 5) * 5, -50, 50); }); return { zips: zs.map(r => r.zip), line: lineId === 'maint' ? 'maint' : 'heat', bids }; }

  /* ---------- outcome ranges ---------- */
  /* The plan as solved, read in 120 seeded and mirrored worlds; no re solve inside a world. Each world moves, around the stated value:
     cost per lead by line (log normal σ 0.30), close rate by line (0.20), paid sourced share by line (0.40), the one advertiser cap
     (two thirds to four thirds of it), pipeline credit (half to all of it), the half value drives (one shared factor, σ 0.25), jobs by
     cell (0.15) and cost per lead by cell (0.20). The same worlds for every plan, so two plans differ by their inputs and never by the dice. */
  let WORLDS = null; const BANDS = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  function worlds(n) {
    if (WORLDS && WORLDS.n === n) return WORLDS;
    let a = SEED >>> 0; const R = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const G = () => { let u = 0, v = 0; while (!u) u = R(); while (!v) v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    const W = []; for (let k = 0; k < WORLDS_N / 2; k++) { const r = { cpl: IDS.map(G), close: IDS.map(G), paid: IDS.map(G), cap: R(), pipe: R(), half: G(), zj: Float32Array.from({ length: n * 4 }, G), zc: Float32Array.from({ length: n * 4 }, G) };
      [1, -1].forEach(sg => { const u = x => (sg > 0 ? x : 1 - x); W.push({ cpl: r.cpl.map(x => Math.exp(sg * 0.30 * x)), close: r.close.map(x => Math.exp(sg * 0.20 * x)), paid: r.paid.map(x => Math.exp(sg * 0.40 * x)), cap: 2 / 3 + 2 / 3 * u(r.cap), pipe: 0.5 + 0.5 * u(r.pipe), half: Math.exp(sg * 0.25 * r.half), sg, zj: r.zj, zc: r.zc }); }); }
    W.n = n; return (WORLDS = W);
  }
  function bands(pl) {
    if (!isPlan(pl)) return null; if (BANDS && BANDS.has(pl)) return BANDS.get(pl);
    const t0 = stamp(), P = pl.P, cs = pl.cells.filter(c => c.spend > 0), W = worlds(ZR.length), spent = pl.T.spent, keys = ['leads', 'jobs', 'gpDirect', 'gp'];
    const tot = keys.map(() => new Float64Array(W.length)), byL = IDS.map(() => keys.map(() => new Float64Array(W.length)));
    W.forEach((w, n) => { for (const c of cs) { const i = c.zi * 4 + c.li, li = c.li, cpl = c.cplRun * w.cpl[li] * Math.exp(w.sg * 0.20 * w.zc[i]), close = Math.min(0.95, c.close * w.close[li]), sj = c.sigma * w.paid[li] * w.cap * c.J * Math.exp(w.sg * 0.15 * w.zj[i]);
        const R = c.R > 0 ? reach(c.min, c.min / (2 * (1 - c.R)) * w.half, P.cut) : 0, f = 1 - Math.exp(-c.spend * close / (sj * cpl)), leads = sj * f / close, jobs = sj * R * f, v = [leads, jobs, jobs * c.gd, jobs * (c.gd + P.pipeCredit * w.pipe * c.gpipe)];
        for (let k = 0; k < 4; k++) { tot[k][n] += v[k]; byL[li][k][n] += v[k]; } } });
    const q = (a, p) => { const b = Array.from(a).sort((x, y) => x - y), i = (b.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return b[lo] + (b[hi] - b[lo]) * (i - lo); }, band = a => ({ p10: q(a, 0.1), p50: q(a, 0.5), p90: q(a, 0.9) });
    const res = { n: W.length, seed: SEED }; keys.forEach((k, i) => { res[k] = band(tot[i]); });
    res.gpPerDollar = band(tot[3].map(v => (spent > 0 ? v / spent : 0))); res.cpl = band(tot[0].map(v => (v > 0 ? spent / v : 0))); res.cpj = band(tot[1].map(v => (v > 0 ? spent / v : 0)));
    res.lines = {}; IDS.forEach((id, li) => { res.lines[id] = {}; keys.forEach((k, i) => { res.lines[id][k] = band(byL[li][i]); }); });
    res.ms = stamp() - t0; if (BANDS) BANDS.set(pl, res); return res;
  }

  /* ---------- the forecast: one adapter over the live records ---------- */
  /* F or null; never throws. Nights flagged part are skipped; local dates, thresholds and the 36 hour rule are the live layer's own,
     so the popup, the notices and the desk tell one story. */
  function forecast(now, recs) {
    try {
      const L = LV(); now = when(now); recs = recs && typeof recs === 'object' ? recs : (typeof LIVE !== 'undefined' && LIVE.all ? LIVE.all() : null);
      const rec = recs && recs.nws_cold, d = rec && rec.data; if (!L || !L.derive || !d || !Array.isArray(d.points)) return null;
      const today = localDay(now), num = v => (okNum(v) ? +v : null);
      /* a point needs a place; a night needs a date from today on and a low, and a night flagged part is skipped */
      const pts = d.points.filter(p => p && okNum(p.lat) && okNum(p.lon)).map(p => ({ p, nights: (Array.isArray(p.nights) ? p.nights : []).filter(n => n && !n.part && typeof n.d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(n.d) && n.d >= today && okNum(n.lowF)) })).filter(x => x.nights.length);
      if (!pts.length) return null;
      const dates = [...new Set([].concat(...pts.map(x => x.nights.map(n => n.d))))].sort().slice(0, 7), mornings = dates.map(dt => addDays(dt, 1));
      const points = pts.map(x => { const at = {}; x.nights.forEach(n => { at[n.d] = n; }); const col = k => dates.map(dt => (at[dt] ? num(at[dt][k]) : null)); return { id: x.p.id || null, name: x.p.name || null, lat: +x.p.lat, lon: +x.p.lon, county: x.p.county || null, lows: col('lowF'), ice: col('iceIn'), snow: col('snowIn') }; });
      const end = +new Date(now), t = rec.at ? +new Date(rec.at) : NaN, ageH = Number.isFinite(t) ? (end - t) / 36e5 : null;                       // no reading time: the age is unknown and the record counts as stale
      const alerts = (Array.isArray(d.alerts) ? d.alerts : []).filter(a => a && a.cold && (!a.ends || +new Date(a.ends) > end)).map(a => ({ event: String(a.event || 'Cold alert'), counties: (Array.isArray(a.counties) ? a.counties : []).filter(c => typeof c === 'string'), tier: okNum(a.tier) ? +a.tier : 0, emergency: !!a.emergency, ends: a.ends || null }));
      let c = null; try { c = L.derive.cold(recs, now); } catch (e) { c = null; }
      const lo = Math.round(Math.min(...[].concat(...points.map(p => p.lows.filter(v => v != null)))));
      const head = c && c.ok && c.headline ? { eyebrow: c.eyebrow || 'The next seven nights', headline: c.headline, sub: c.sub || '', tier: c.tier || 0, tierName: c.tierName || TIERN[0], minLow: c.minLow == null ? lo : c.minLow } : { eyebrow: 'The next seven nights', headline: `Forecast lows bottom out at ${lo}°F`, sub: '', tier: tierOf(lo), tierName: TIERN[tierOf(lo)], minLow: lo };
      return { ok: true, src: 'live', sim: null, label: 'Live forecast', at: rec.at || null, ageH, stale: !(ageH != null && ageH <= 36), baseline: !!rec.baseline, today, month: +mornings[Math.min(3, mornings.length - 1)].slice(5, 7) - 1, dates, mornings, points, alerts,
        firstFreeze: firstFreeze(recs, now, today), observed: observed(recs), head };
    } catch (e) { return null; }
  }
  /* has the season's first freeze happened. By place: the season record says it county by county (outer counties freeze two to three weeks
     before DFW Airport), so a ZIP asks its own county first (byCounty), then the metro status (done: DFW Airport), and with no season
     record the calendar (not before December 1, yes after). metro says where done comes from */
  function firstFreeze(recs, now, today) {
    const m = +today.slice(5, 7), cal = { src: 'calendar', done: !(m >= 7 && m <= 11), date: null, byCounty: {}, metro: 'calendar' };
    try { const L = LV(), r = recs && recs.acis_season; if (!L || !L.climate || !L.climate.status || !r || !r.data) return cal;
      const s = L.climate.status(r.data, (typeof window !== 'undefined' && window.__CLIMATE_BASE__) || null, now); if (!s || !s.ok) return cal;
      const ff = s.metro && s.metro.firstFreeze && typeof s.metro.firstFreeze === 'object' ? s.metro.firstFreeze : null, by = {};
      (Array.isArray(s.counties) ? s.counties : []).forEach(c => { if (c && typeof c.name === 'string' && c.firstFreeze && typeof c.firstFreeze === 'object' && (c.firstFreeze.state === 'occurred' || c.firstFreeze.state === 'pending')) by[c.name] = c.firstFreeze.state === 'occurred'; });
      if (!ff && !Object.keys(by).length) return cal;
      return { src: 'season', done: ff ? ff.state === 'occurred' : cal.done, date: ff && ff.state === 'occurred' && isYmd(ff.date) ? ff.date : null, byCounty: by, metro: ff ? 'season' : 'calendar' };
    } catch (e) { return cal; }
  }
  /* observed lows of the last five weeks at the airports the season record reads daily, or null */
  function observed(recs) {
    try { const L = LV(), r = recs && recs.acis_season; if (!L || !L.climate || !L.climate.nights || !r || !r.data) return null;
      const st = r.data.stations || {}, pts = L.climate.nights(r.data, 35).map(a => { const s = st[a.uid] || {}; return { id: a.icao || a.uid, name: a.name, lat: s.lat, lon: s.lon, county: a.county, nights: a.nights.filter(n => n && typeof n.d === 'string' && okNum(n.tn)).map(n => ({ d: n.d, low: +n.tn })) }; }).filter(p => okNum(p.lat) && okNum(p.lon) && p.nights.length >= 5);
      if (pts.length < 3) return null; return { through: pts.map(p => p.nights[p.nights.length - 1].d).sort().pop(), points: pts };
    } catch (e) { return null; }
  }
  /* a simulated week built on the live lows: the same drop at every point, night by night, and the alerts that would come with it */
  const SIMS = { rim: { off: [-2, -9, -10, -6, -2, 0, 0], event: 'Freeze Warning', rim: true, done: false, name: 'freeze on the rim' }, first: { off: [-4, -14, -15, -8, -3, 0, 0], event: 'Freeze Warning', done: false, name: 'first freeze metro wide' }, arctic: { off: [-10, -27, -31, -29, -20, -12, -8], event: 'Extreme Cold Warning', done: true, name: 'arctic outbreak' } };
  function scenario(F, name) {
    const S = typeof name === 'string' && Object.prototype.hasOwnProperty.call(SIMS, name) ? SIMS[name] : null; if (!S) return F || null; if (!okF(F)) return null;
    F = Object.assign({}, F, { points: F.points.filter(p => p && okNum(p.lat) && okNum(p.lon) && Array.isArray(p.lows)) });
    const L = LV(), all = [...new Set(((L && L.geo && L.geo.counties) || []).map(c => c.name).concat(F.points.map(p => p.county)).filter(Boolean))], o = origin();
    /* the rim: the counties whose forecast points sit farthest from the dispatch point */
    const far = all.map(cn => { const ps = F.points.filter(p => p.county === cn); return { cn, km: ps.length ? Math.min(...ps.map(p => hav(o.lat, o.lon, p.lat, p.lon))) : 0 }; }).sort((a, b) => b.km - a.km);
    const counties = S.rim ? ['Collin', 'Denton', 'Wise', 'Parker', 'Hunt'].filter(c => all.includes(c)).concat(all.includes('Collin') ? [] : far.slice(0, 5).map(x => x.cn)) : all;
    const points = F.points.map(p => Object.assign({}, p, { lows: p.lows.map((v, i) => (v == null ? null : Math.max(-10, v + (S.off[i] || 0)))) }));
    const nb = near3(o.lat, o.lon, points), lows = F.dates.map((_, i) => { let a = 0, w = 0; nb.forEach(x => { if (x.p.lows[i] != null) { a += x.w * x.p.lows[i]; w += x.w; } }); return w ? Math.round(a / w) : null; }).filter(v => v != null), lo = lows.length ? Math.min(...lows) : null;
    return Object.assign({}, F, { src: 'sim', sim: name, label: 'Simulation: ' + S.name, stale: false, points, alerts: [{ event: S.event, counties, tier: S.event === 'Extreme Cold Warning' ? 4 : 3, emergency: S.event === 'Extreme Cold Warning', ends: null }], firstFreeze: { src: 'simulation', done: S.done, date: null, byCounty: {} },
      head: { eyebrow: 'Simulation, not a forecast', headline: `Simulation: ${S.name}` + (lo != null ? `, ${lo}°F at the dispatch point on the coldest night` : ''), sub: `${S.event} for ${counties.length >= all.length ? 'all ' + all.length + ' counties' : words(counties) + ' counties'}. Built by lowering the live forecast lows by the same amount at every point; it shows what the cold rules would do.`, tier: tierOf(lo), tierName: TIERN[tierOf(lo)], minLow: lo } });
  }

  /* ---------- the week's weather: a multiplier per ZIP and line against a normal week of the month ---------- */
  const ALERTW = [[/Extreme Cold Warning|Winter Storm Warning|Ice Storm Warning|Blizzard Warning/i, 2], [/Cold Weather Advisory|Extreme Cold Watch|Hard Freeze|Wind Chill/i, 1], [/Freeze Warning|Freeze Watch|Winter Weather Advisory|Winter Storm Watch/i, 0]];
  const STORM = /Winter Storm Warning|Ice Storm Warning|Blizzard Warning/i;
  const lineW = (id, W, P) => (id === 'heat' ? W : id === 'maint' ? (W >= P.maintPause ? 0 : clamp(1 - P.resp.maint * (W - 1), 0.25, 1.25)) : 1 + P.resp[id] * (W - 1));
  function weather(F, Pin, season) {
    const P = params(Pin); F = okF(F) ? F : null; season = season && season.line && Array.isArray(season.zips) && monthOk(season.month) != null ? season : null;
    const pts = F ? F.points.filter(p => p && okNum(p.lat) && okNum(p.lon) && Array.isArray(p.lows)) : [], live = !!(F && !F.stale && pts.length);
    const month = season ? season.month : live ? F.month : P.month, nl = normLow(month), wn = nightW(nl, P), th = TH();
    const out = { ok: live, stale: !!(F && F.stale), sim: (F && F.sim) || null, month, normLow: nl, wn, dates: live ? F.dates.slice(0, 7) : [], nights: live ? Math.min(7, F.dates.length) : 0, byZip: {}, range: [1, 1], lines: { heat: 1, furnace: 1, heatpump: 1, maint: 1 }, own: { heat: 1, furnace: 1, heatpump: 1, maint: 1 }, lastW: null, carried: false, trigger: false, triggerWhy: [], storm: { any: false, zips: 0, counties: [], why: '' }, alerts: {}, origin: { lows: [], min: null }, metro: { min: [], max: [] } };
    out.mult = (zip, id) => { const r = out.byZip[zip]; return r ? r.m[id] : 1; };
    if (!live) return out;
    const nN = out.nights, stormC = {};
    (Array.isArray(F.alerts) ? F.alerts : []).forEach(a => { if (!a) return; const ev = String(a.event || ''), k = ALERTW.find(x => x[0].test(ev)); (Array.isArray(a.counties) ? a.counties : []).forEach(cn => { if (k && P.alertFloor[k[1]] > ((out.alerts[cn] || {}).floor || 0)) out.alerts[cn] = { floor: P.alertFloor[k[1]], event: ev }; if (STORM.test(ev)) stormC[cn] = ev; }); });
    const at = (nb, key, i) => { let a = 0, w = 0; nb.forEach(x => { const v = (x.p[key] || [])[i]; if (okNum(v)) { a += x.w * v; w += x.w; } }); return w ? a / w : null; };
    let lo = Infinity, hi = -Infinity, iceAny = false; const ffz = F.firstFreeze && typeof F.firstFreeze === 'object' ? F.firstFreeze : { done: true, byCounty: {} };
    ZR.forEach(z => { const nb = near3(z.lat, z.lon, pts), lows = []; let ws = 0, n = 0; for (let i = 0; i < nN; i++) { const v = at(nb, 'lows', i); lows.push(v); if (v != null) { ws += nightW(v, P); n++; } }
      let W = clamp((ws + (7 - n) * wn) / 7 / wn, 0.5, 3); const rl = lows.filter(v => v != null).map(Math.round), n32 = rl.filter(t => t <= th.freeze).length;      // a night the forecast does not hold counts as a normal night of the month
      const done = ffz.byCounty && ffz.byCounty[z.cty] != null ? !!ffz.byCounty[z.cty] : !!ffz.done, first = !done && n32 > 0; if (first) W = Math.min(3, W * P.firstFreeze);                // the first freeze of the season finds every weak igniter at once
      const al = out.alerts[z.cty], alert = al && al.floor > W ? al.event : null; if (alert) W = al.floor;
      const ice = nb.some(x => (x.p.ice || []).some(v => okNum(v) && +v >= 0.1)), storm = ice || !!stormC[z.cty]; if (ice) iceAny = true;
      out.byZip[z.zip] = { W, lows, min: rl.length ? Math.min(...rl) : null, n40: rl.filter(t => t <= th.cold).length, n32, n25: rl.filter(t => t <= th.hard).length, first, alert, ice, storm, m: { heat: W, furnace: lineW('furnace', W, P), heatpump: lineW('heatpump', W, P), maint: lineW('maint', W, P) } };
      if (W < lo) lo = W; if (W > hi) hi = W; });
    out.range = lo <= hi ? [lo, hi] : [1, 1];
    const o = origin(), nbo = near3(o.lat, o.lon, pts); for (let i = 0; i < nN; i++) { const v = at(nbo, 'lows', i); out.origin.lows.push(v == null ? null : Math.round(v)); const xs = pts.map(p => p.lows[i]).filter(okNum); out.metro.min.push(xs.length ? Math.min(...xs) : null); out.metro.max.push(xs.length ? Math.max(...xs) : null); }
    out.origin.min = out.origin.lows.filter(v => v != null).length ? Math.min(...out.origin.lows.filter(v => v != null)) : null;
    /* each line's multiplier on its own buy; replacement quotes follow the cold by a week when observed lows say last week was cold */
    const pl = season || plan(month === P.month ? P : Object.assign({}, P, { month })), buy = {}; IDS.forEach(id => { const L = pl.line[id]; out.own[id] = out.lines[id] = L.dollars > 0 ? sum(L.rows.map(c => c.spend * out.byZip[c.zip].m[id])) / L.dollars : 1; L.rows.forEach(c => { buy[c.zip] = 1; }); });
    /* last week's repair multiplier on the buy, from observed lows of the seven days the season record ends on (a record that ends more than four days back is not last week: the rule is off) */
    const ob = F.observed && Array.isArray(F.observed.points) && isYmd(F.observed.through) ? F.observed : null, gap = ob ? daysBetween(F.today, ob.through) : null;
    if (ob && gap >= 0 && gap <= 4 && pl.line.heat.dollars > 0) { const ds = Array.from({ length: 7 }, (_, i) => addDays(ob.through, -i)), op = ob.points.filter(p => p && okNum(p.lat) && okNum(p.lon) && Array.isArray(p.nights)).map(p => { const m = {}; p.nights.forEach(n => { if (n && okNum(n.low)) m[n.d] = +n.low; }); return { lat: +p.lat, lon: +p.lon, m }; }); let a = 0, got = 0;
      if (op.length) pl.line.heat.rows.forEach(c => { const nb = near3(c.z.lat, c.z.lon, op); let ws = 0, n = 0; ds.forEach(d => { let v = 0, w = 0; nb.forEach(x => { const t = x.p.m[d]; if (t != null) { v += x.w * t; w += x.w; } }); if (w) { ws += nightW(v / w, P); n++; } }); if (n >= 4) got += c.spend; a += c.spend * (n >= 4 ? clamp(ws / n / wn, 0.5, 3) : 1); });
      if (got >= 0.5 * pl.line.heat.dollars) out.lastW = a / pl.line.heat.dollars; }
    /* replacement quotes follow the cold by a week: furnace and heat pump keep the lift of the colder of the two weeks. No observed lows, no rule */
    if (out.lastW != null) { const carry = Math.max(out.own.heat, out.lastW); ['furnace', 'heatpump'].forEach(id => { const c = lineW(id, carry, P); if (c > out.lines[id]) { out.lines[id] = c; if (out.lastW > out.own.heat) out.carried = true; } }); }
    /* storm, trigger */
    const stormZ = ZR.filter(z => out.byZip[z.zip].storm), inBuy = stormZ.filter(z => buy[z.zip]), evs = [...new Set(stormZ.map(z => stormC[z.cty]).filter(Boolean))];
    out.storm = { any: inBuy.length > 0, zips: stormZ.length, counties: [...new Set(stormZ.map(z => z.cty))], why: !stormZ.length ? '' : words(evs.concat(iceAny ? ['forecast ice of a tenth of an inch or more'] : [])) };
    const buyC = new Set(pl.zips.map(r => r.county)), alC = Object.keys(out.alerts).filter(cn => buyC.has(cn));
    if (out.own.heat > P.trigger) out.triggerWhy.push(`repair demand on the buy runs ${x2(out.own.heat)} times a normal ${MONTHS[month]} week`);
    if (alC.length) out.triggerWhy.push(`${words([...new Set(alC.map(cn => out.alerts[cn].event))])} in ${alC.length === 1 ? alC[0] + ' County' : words(alC) + ' counties'}, where the plan buys`);
    if (out.storm.any) out.triggerWhy.push(`${out.storm.why} in ${inBuy.length} ${inBuy.length === 1 ? 'ZIP' : 'ZIPs'} of the plan`);
    out.trigger = out.triggerWhy.length > 0;
    return out;
  }

  /* ---------- the week ---------- */
  /* A normal week spends (1 − reserve) of the month over its days. Each line's week is its normal week times its multiplier on its own
     buy. What the week asks above normal comes out of the freeze reserve, never more than the month's reserve; what it leaves goes back.
     Nothing is remembered between weeks: the owner tracks the reserve against what the account actually spent. */
  function week(Pin, F, opt) {
    const t0 = stamp(); opt = opt && typeof opt === 'object' ? opt : {}; F = okF(F) ? F : null; const P0 = params(Pin), now = opt.now || new Date(), mo = monthOk(opt.month);
    const month = mo != null ? mo : F ? monthOk(F.month) : P0.month, P = month === P0.month ? P0 : Object.assign({}, P0, { month }), dim = DIM[month], scale = 7 / dim;
    const season = opt.season && opt.season.line && opt.season.at && opt.season.month === month && opt.season.period === 'month' ? opt.season : plan(P), wx = weather(F, P, season), live = wx.ok, notes = [];
    const base = {}, want = {}; IDS.forEach(id => { base[id] = season.line[id].dollars * (1 - P.reserve) * scale; want[id] = base[id] * (id === 'maint' ? wx.lines[id] : clamp(wx.lines[id], 0.75, 3)); });
    const baseT = sum(IDS.map(id => base[id])), up = sum(IDS.map(id => Math.max(0, want[id] - base[id]))), down = sum(IDS.map(id => Math.max(0, base[id] - want[id]))), pool = season.T.spent * P.reserve;
    const wanted = Math.max(0, up - down), release = Math.min(pool, wanted), limited = wanted > release + 0.5;
    if (limited && up > 0) { const k = (release + down) / up; IDS.forEach(id => { if (want[id] > base[id]) want[id] = base[id] + (want[id] - base[id]) * k; }); }
    /* no cold trigger: the month's ZIPs and bids stay and only the money moves with the weather. A trigger pours again on the week's demand
       with the month's ZIPs kept; a full board shortens the worthwhile drive for repair and tune ups, and ice shortens it more */
    const hold = !wx.trigger, tight = wx.trigger ? clamp(1 / Math.sqrt(Math.max(1, wx.own.heat)), P.radiusFloor, 1) : 1, stormZ = {}; let nStorm = 0;
    if (wx.trigger) ZR.forEach(z => { if (wx.byZip[z.zip] && wx.byZip[z.zip].storm) { stormZ[z.zip] = Math.min(tight, P.stormReach); nStorm++; } });
    const wp = hold ? plan(P, { hold: season, wx, scale, lineBudgets: want, crewCap: P.crewCap }) : plan(P, { keep: season, wx, scale, lineBudgets: want, reachScale: { heat: tight, maint: tight, zip: stormZ }, crewCap: P.crewCap });
    const B = wp.T.spent, back = Math.max(0, baseT - B), draw = Math.max(0, B - baseT), short = Math.max(0, sum(IDS.map(id => want[id])) - B);      // short: asked by the rules and not placed (the hurdle, or the crew cap)
    /* days: always seven mornings. The repair money follows each morning's low (60%) and the night coming (40%) and runs only on the days the
       phones are answered; a morning the forecast does not reach weighs as a normal night of the month; the other lines run flat */
    const today = F ? F.today : localDay(now), first = live ? F.mornings[0] : addDays(today, 1), idx = {}, th = TH(); if (live) F.mornings.slice(0, wx.nights).forEach((m, i) => { if (idx[m] == null) idx[m] = i; });
    const mornings = Array.from({ length: 7 }, (_, i) => addDays(first, i)), lows = mornings.map(m => (idx[m] != null && wx.origin.lows[idx[m]] != null ? wx.origin.lows[idx[m]] : null));
    const alertOn = cn => (wx.alerts[cn] ? wx.alerts[cn].event : null), oc = (() => { const o = season.origin; let best = null, km = Infinity; ZR.forEach(z => { const k = hav(o.lat, o.lon, z.lat, z.lon); if (k < km) { km = k; best = z; } }); return best ? best.cty : 'Dallas'; })();
    const answered = mornings.map(d => dowOf(d) !== 0 || P.hours.sunday || (P.hours.onCall && live && !!alertOn(oc))), wOf = i => (lows[i] != null ? nightW(lows[i], P) : live ? wx.wn : 1);
    const wRep = wp.line.heat.dollars, dw = mornings.map((_, i) => (answered[i] ? 0.6 * wOf(i) + 0.4 * wOf(Math.min(i + 1, 6)) : 0)), dT = sum(dw) || 1, other = (B - wRep) / 7;
    const days = mornings.map((d, i) => { const low = lows[i], t = low == null ? null : tierOf(low), k = idx[d], nbIce = live && k != null ? Math.max(0, ...F.points.map(p => (p && Array.isArray(p.ice) && okNum(p.ice[k]) ? +p.ice[k] : 0))) : 0, rep = wRep * dw[i] / dT;
      return { date: d, dow: DOW[dowOf(d)], label: dayLabel(d), night: addDays(d, -1), low, metroMin: live && k != null ? wx.metro.min[k] : null, metroMax: live && k != null ? wx.metro.max[k] : null, tier: t, tierName: t == null ? null : TIERN[t], weight: low == null ? null : nightW(low, P), answered: answered[i], repair: rep, other, total: rep + other, capUp: low == null || !answered[i] ? 0 : low <= th.hard ? 40 : low <= th.freeze ? 25 : 0, ice: nbIce, alert: live ? alertOn(oc) : null }; });
    /* by line, and the ZIP list against the month */
    const lines = IDS.map(id => { const m = season.line[id], w = wp.line[id], was = new Set(m.rows.map(c => c.zip)), is = new Set(w.rows.map(c => c.zip)); return { id, name: NAMES[id], mult: wx.lines[id], normal: base[id], week: w.dollars, change: w.dollars - base[id], changePct: base[id] > 0 ? (w.dollars / base[id] - 1) * 100 : 0, paused: base[id] > 0 && !(w.dollars > 0), carried: (id === 'furnace' || id === 'heatpump') && wx.carried, zips: w.zips, added: [...is].filter(z => !was.has(z)), dropped: [...was].filter(z => !is.has(z)) }; });
    const added = wp.zips.filter(r => !season.at[r.zip].inPlan).map(r => ({ zip: r.zip, city: r.city, via: IDS.filter(id => r.lines[id] && r.lines[id].spend > 0) }));
    const paused = season.zips.filter(r => !wp.at[r.zip].inPlan).map(r => ({ zip: r.zip, city: r.city, why: IDS.filter(id => r.lines[id] && r.lines[id].spend > 0).every(id => id === 'maint') && lines[3].paused ? 'tune ups are paused this week' : wp.crew ? 'cut to fit the crew cap' : 'out of reach this week' }));
    const mName = MONTHS[month], sim = live && F.sim ? F.sim : null, src = !live ? 'normal' : sim ? 'sim' : 'live', stale = !!(F && F.stale), missing = !live && !stale, monday = (() => { const k = dowOf(today); return addDays(today, (8 - k) % 7); })(), fh = (F && F.head) || {};
    const res = { ok: true, src, sim, label: !live ? 'A normal week' : F.label || 'Live forecast', stale, missing, at: F ? F.at || null : null, ageH: F && okNum(F.ageH) ? +F.ageH : null, today, monday, month, monthName: mName, dim, scale,
      head: live ? { eyebrow: fh.eyebrow || 'The next seven nights', headline: fh.headline || 'The forecast for the next seven nights', sub: fh.sub || '' } : { eyebrow: 'This week', headline: missing ? 'No forecast is stored: the week runs at normal' : okNum(F.ageH) ? 'The forecast is older than 36 hours: the week runs at normal' : 'The stored forecast carries no reading time: the week runs at normal', sub: 'Nothing is released from the reserve and no ZIP or bid changes until the live data is refreshed.' },
      season, plan: wp, wx, trigger: wx.trigger, triggerWhy: wx.triggerWhy, hold, storm: wx.storm, reach: { heat: tight, maint: tight, stormZips: nStorm }, lines,
      T: { normal: baseT, week: B, change: B - baseT, mult: wx.lines.heat, leads: wp.T.leads, jobs: wp.T.jobs, gp: wp.T.gp, gpDirect: wp.T.gpDirect, zips: wp.T.zips },
      reserve: { share: P.reserve, month: pool, normalWeek: baseT, thisWeek: B, draw, back, wanted, limited, short, text: '', toDate: null }, days, crew: null, added, paused, schedule: [], creative: [], list: [], rules: [], notes, ms: 0 };
    const wkWords = sim ? 'Simulation: this week' : 'This week';
    res.reserve.text = (draw > 0.5 ? `${wkWords} draws ${usd(draw)} from the freeze reserve of ${usd(pool)} for ${mName}` + (limited ? `; the rules asked for ${usd(wanted)}, more than the reserve holds` : '') : back > 0.5 ? `${wkWords} returns ${usd(back)} to the freeze reserve of ${usd(pool)} for ${mName}` : `${wkWords} runs at normal: nothing moves in or out of the freeze reserve of ${usd(pool)} for ${mName}`)
      + (short > 0.5 ? `; ${usd(short)} of what the week asked is not spent, because ${wp.crew ? 'the crew cap takes it out' : 'no ZIP inside this week\'s reach returns the hurdle on it'}` : '') + '. No ledger is kept here: track the reserve against what the account actually spent.';
    res.reserve.toDate = toDate(F, P, season, wx, month);
    if (wp.crew) { const c = wp.crew; res.crew = { cap: c.cap, jobs: c.jobs, after: c.after, cut: c.cut, tiers: c.tiers, text: `${sim ? 'Simulation: the' : 'The'} week would book ${c.jobs.toFixed(1)} paid jobs against a crew cap of ${c.cap}: ${usd(c.cut)} comes out, the ${words(c.tiers.map(t => t.tier))} ${c.tiers.length === 1 ? 'tier' : 'tiers'} first, and goes back to the reserve.` }; }
    if (month !== P0.month) notes.push({ kind: 'month', text: `The week runs on ${mName}, the month of the forecast; the plan controls are set to ${MONTHS[P0.month]}.` });
    if (sim) notes.push({ kind: 'sim', text: 'This is a simulation built on the live lows, not a forecast. Do not load its budgets.' });
    if (live && wx.nights < 7) notes.push({ kind: 'short', text: `The forecast holds ${wx.nights} of the next seven nights: ${7 - wx.nights === 1 ? 'the last one counts as a normal ' + mName + ' night' : 'the other ' + (7 - wx.nights) + ' count as normal ' + mName + ' nights'}.` });
    res.schedule = schedule(res, P); res.creative = creative(res, P); res.rules = rules(P, res); res.list = monday_(res, P);
    res.ms = stamp() - t0; return res;
  }
  /* what the same rules would have drawn so far this month, read at the dispatch point from observed lows: context, never account spend */
  function toDate(F, P, season, wx, month) {
    if (!F || !F.observed || F.sim || !Array.isArray(F.observed.points)) return null;
    try { const o = season.origin, mm = F.today.slice(0, 5) + String(month + 1).padStart(2, '0'), pts = F.observed.points.filter(p => p && okNum(p.lat) && okNum(p.lon) && Array.isArray(p.nights)).map(p => { const at = {}; p.nights.forEach(n => { if (n && isYmd(n.d) && okNum(n.low)) at[n.d] = +n.low; }); return { lat: +p.lat, lon: +p.lon, at }; }), nb = near3(o.lat, o.lon, pts);
      const ds = [...new Set([].concat(...pts.map(p => Object.keys(p.at))))].filter(d => d.slice(0, 7) === mm && d < F.today).sort(); if (ds.length < 3) return null;
      const day = {}; IDS.forEach(id => { day[id] = season.line[id].dollars * (1 - P.reserve) / DIM[month]; }); let normal = 0, computed = 0, n = 0;
      ds.forEach(d => { let v = 0, w = 0; nb.forEach(x => { if (x.p.at[d] != null) { v += x.w * x.p.at[d]; w += x.w; } }); if (!w) return; const W = clamp(nightW(v / w, P) / wx.wn, 0.5, 3); n++;
        IDS.forEach(id => { const m = lineW(id, W, P); normal += day[id]; computed += day[id] * (id === 'maint' ? m : clamp(m, 0.75, 3)); }); });
      if (n < 3) return null; const pool = season.T.spent * P.reserve, net = computed - normal, draw = Math.min(pool, Math.max(0, net)), back = Math.max(0, -net);
      return { days: n, from: ds[0], through: ds[ds.length - 1], normal, computed, draw, back, text: `Computed from observed lows at the dispatch point, ${longDay(ds[0])} to ${longDay(ds[ds.length - 1])}: the same night weights would have ${draw > 0.5 ? 'drawn ' + usd(draw) + ' from the reserve' : back > 0.5 ? 'returned ' + usd(back) + ' to the reserve' : 'left the reserve as it was'} so far this month. This is a calculation, not what the account spent.` };
    } catch (e) { return null; }
  }
  /* ad schedule windows for the seven days: module 12's daypart template of the line, repair only while the phones are answered, freeze mornings and evenings lifted */
  const BLK = [0, 6, 9, 12, 17, 21, 24];
  function schedule(wk, P) {
    const out = [], smart = P.bidding === 'smart', th = TH();
    wk.plan.campaigns.filter(c => c.kind === 'search' && c.platform === 'google').forEach(c => { const id = c.lines[0], tpl = SLM.DAYPARTS[SLM.LI[id].dayparts] || SLM.DAYPARTS.considered, calls = id === 'heat';
      wk.days.forEach(d => { const k = dowOf(d.date), row = tpl[(k + 6) % 7], frz = d.low != null && d.low <= th.freeze, onCall = P.hours.onCall && !!d.alert, open = onCall ? Math.min(6, P.hours.open) : P.hours.open, close = onCall ? Math.max(22, P.hours.close) : P.hours.close;
        if (calls && d.answered === false) return;                                                      // nobody answers: no repair ads that day
        const cuts = [...new Set(BLK.concat(calls ? [open, close] : []).concat(frz && calls ? [5, 22] : []))].sort((a, b) => a - b), win = [];
        for (let i = 0; i < cuts.length - 1; i++) { const a = cuts[i], b = cuts[i + 1]; if (calls && (a < open || b > close)) continue; const bi = BLK.findIndex((x, j) => a >= x && a < BLK[j + 1]); let adj = row[bi] + (frz && calls ? (a >= 5 && b <= 9 ? 30 : a >= 17 && b <= 22 ? 25 : 0) : 0); adj = smart ? 0 : clamp(adj, -90, 100);
          const last = win[win.length - 1]; if (last && last.end === a && last.adj === adj) last.end = b; else win.push({ start: a, end: b, adj }); }
        /* the platform takes six windows a day: past that the two neighbors closest in adjustment become one */
        while (win.length > 6) { let j = -1, gap = Infinity; for (let i = 0; i < win.length - 1; i++) { if (win[i].end !== win[i + 1].start) continue; const g = Math.abs(win[i].adj - win[i + 1].adj); if (g < gap) { gap = g; j = i; } } if (j < 0) { win.length = 6; break; }
          const a = win[j], b = win[j + 1]; a.adj = Math.round((a.adj * (a.end - a.start) + b.adj * (b.end - b.start)) / (b.end - a.start) / 5) * 5; a.end = b.end; win.splice(j + 1, 1); }
        win.forEach(w => out.push({ campaign: c.name, line: id, day: d.dow, date: d.date, start: w.start, end: w.end, adj: w.adj })); }); });
    return out;
  }
  /* the creative set by the coldest thing the week holds */
  function creative(wk, P) {
    const out = [], lows = wk.days.map(d => d.low).filter(v => v != null), lo = lows.length ? Math.min(...lows) : null, th = TH(), ev = Object.values(wk.wx.alerts).map(a => a.event), extreme = (lo != null && lo <= 15) || ev.some(e => /Extreme Cold Warning|Winter Storm Warning|Ice Storm|Blizzard/i.test(e));
    const first = wk.plan.zips.some(r => wk.wx.byZip[r.zip] && wk.wx.byZip[r.zip].first);
    if (lo == null) out.push({ when: 'A normal week', set: 'season', lines: ['Safety check and tune up before the first freeze', 'Is the furnace past 20? Have it checked', 'Heat back on today'] });
    else if (extreme) out.push({ when: 'Extreme cold or a storm warning', set: 'emergency', lines: ['Emergency only: hours, arrival window and the license number', 'No replacement prospecting copy until it passes', 'Auxiliary heat and frozen line copy where electric heat leads'] });
    else if (lo <= th.hard) out.push({ when: `Hard freeze: ${lo}°F at the dispatch point`, set: 'hard freeze', lines: ['Heat back on today', 'Carbon monoxide test on every visit', 'Heat pump blowing cold air: auxiliary heat and frozen line copy where electric heat leads'] });
    else if (lo <= th.freeze) out.push({ when: `Freeze: ${lo}°F at the dispatch point`, set: 'freeze', lines: ['Heat back on today', 'Carbon monoxide test on every visit', 'Heat pump blowing cold air'] });
    else if (lo <= th.cold) out.push({ when: `Cold nights: ${lo}°F at the dispatch point`, set: 'cold nights', lines: ['No heat on the first start of the season', 'A burning smell on the first start is normal; a furnace that will not light is not', 'Igniter and flame sensor priced before the work'] });
    else out.push({ when: lo <= th.cool ? `Cool nights: no night under ${lo}°F at the dispatch point` : 'A mild week', set: 'season', lines: ['Safety check and tune up before the first freeze', 'Is the furnace past 20? Have it checked', 'Replacement quotes in writing'] });
    if (first && !extreme) out.push({ when: 'First freeze of the season in the plan', set: 'first freeze', lines: ['The first cold night of the year', 'Have the heat checked before it is needed'] });
    return out;
  }
  /* the cold rules, with this week's status when a week is given */
  function rules(Pin, wk) {
    wk = wk && wk.plan && wk.plan.P && wk.wx && wk.T && wk.reach && Array.isArray(wk.days) ? wk : null;
    const P = wk ? wk.plan.P : params(Pin), th = TH(), w = P.nightW, lows = wk ? wk.days.map(d => d.low).filter(v => v != null) : [], lo = lows.length ? Math.min(...lows) : null, wn = nightW(normLow(P.month), P), mN = MONTHS[P.month], WX = wk ? wk.wx : null;
    const has = t => lo != null && lo <= t, fl = k => (WX ? Object.values(WX.alerts).some(a => a.floor === P.alertFloor[k]) : false), r = (id, trigger, threshold, budget, bids, hours, creative, size, grade, fired, off) => ({ id, trigger, threshold, budget, bids, hours, creative, size, grade, fired: !!fired, off: off || null });
    return [
      r('mild', 'Mild or cool week', 'week multiplier under 1', 'repair down to no less than 0.75 of normal, the difference goes back to the reserve; tune up up to 1.25', 'no change; ZIP list frozen', 'standard', 'safety check and tune up before the first freeze; furnace past 20', '0.75 to 1', 'A/D', wk && wk.src !== 'normal' && wk.T.mult < 1),
      r('cold', 'Cold nights', `a night at ${th.cold}°F or lower`, `follows the night weight, ${x2(w[2])} at ${th.cold}°F against ${x2(wn)} for a normal ${mN} night`, 'no change', 'standard', 'no heat, first start of the season, igniter and flame sensor', x2(w[2] / wn) + ' times a normal ' + mN + ' day', 'C/D', has(th.cold)),
      r('freeze', 'Freeze', `a night at ${th.freeze}°F or lower`, `weight ${x2(w[3])}; replacement takes ${pc(P.resp.furnace)} (furnace) and ${pc(P.resp.heatpump)} (heat pump) of the repair lift`, 'raise max CPC caps 25% for the freeze days', '5 am to 9 am up 30 points, 5 pm to 10 pm up 25, nothing in hours nobody answers', 'heat back on today, carbon monoxide test on every visit, heat pump blowing cold air', x2(w[3]), 'C/D', has(th.freeze)),
      r('hard', 'Hard freeze', `a night at ${th.hard}°F or lower`, `weight ${x2(w[4])}; tune up cut by ${pc(P.resp.maint)} of the lift`, 'caps up 40%', 'the same, plus on call hours if switched on', 'add auxiliary heat and frozen line copy where electric heat leads', x2(w[4]), 'D', has(th.hard)),
      r('extreme', 'Extreme', '15°F or lower, or an Extreme Cold, Winter Storm, Ice Storm or Blizzard Warning', `weight or floor ${x2(Math.max(w[5], P.alertFloor[2]))}; the whole reserve may go; tune ups pause at a multiplier of ${P.maintPause}`, 'caps up 40%', 'all answered hours', 'emergency only: hours, arrival, license', x2(P.alertFloor[2]), 'A/D', has(15) || fl(2)),
      r('first', 'First freeze of the season', `no freeze yet this season in the ZIP's own county (the season record, county by county; DFW Airport or the calendar where it has none) and a night at ${th.freeze}°F or lower in the ZIP's forecast`, `times ${x2(P.firstFreeze)} that week`, 'no change', 'freeze hours', 'the first cold night of the year', x2(P.firstFreeze), 'D', WX && Object.values(WX.byZip).some(z => z.first)),
      r('alert', 'Cold alert in a county', `Freeze Warning, Freeze Watch or Winter Weather Advisory ${x2(P.alertFloor[0])}; Cold Weather Advisory ${x2(P.alertFloor[1])}`, 'a floor on the multiplier of every ZIP in the county while the alert is active', 'no change', 'freeze hours', 'by the tier above', x2(P.alertFloor[0]) + ' or ' + x2(P.alertFloor[1]), 'A/D', fl(0) || fl(1)),
      r('trigger', 'Cold trigger', `repair multiplier on the buy over ${x2(P.trigger)}, a cold alert on a county where the plan buys, or ice or a storm warning in a ZIP of the plan`, "ZIP list poured again on the week's demand, the month's ZIPs kept", 'location adjustments do not change', '', '', `reach of repair and tune up times 1 / √W, never under ${x2(P.radiusFloor)}`, 'D', wk && wk.trigger),
      r('storm', 'Ice or a storm warning', 'forecast ice of 0.1 inch or more at any of the three forecast points of a ZIP, or a Winter Storm or Ice Storm Warning on its county', 'the pour runs on the shorter reach', 'no change', '', 'emergency only', `reach of repair and tune up times ${x2(P.stormReach)} in those ZIPs`, 'A/D', wk && wk.reach.stormZips > 0),
      r('after', 'Week after a freeze', "last week's repair multiplier over this week's, from observed lows", 'furnace and heat pump keep the lift of the colder of the two weeks', 'no change', 'considered template', 'repair or replace in writing; financing in the radius campaign', `${pc(P.resp.furnace)} and ${pc(P.resp.heatpump)} of the repair lift`, 'C', WX && WX.carried, WX && WX.ok && WX.lastW == null ? 'Off: the season record has no observed lows for the last seven days.' : null),
      r('crew', 'Crew cap', 'planned paid jobs over the cap', 'cut the Far tier first, then the Ring, then the Core', 'none', 'none', 'none', P.crewCap == null ? 'no cap set' : P.crewCap + ' booked jobs a week', 'A', wk && !!wk.crew, P.crewCap == null ? 'Off: no crew cap is set.' : null),
      r('stale', 'Stale forecast', 'forecast record older than 36 hours, or none stored', 'the week runs at normal; nothing is released', 'none', 'none', 'none', 'none', 'A', wk && wk.src === 'normal')
    ];
  }
  /* "Do this on Monday": plain sentences with the changes behind each */
  function monday_(wk, P) {
    const L = [], add = (k, text, changes) => L.push({ k, text, changes: changes || [] }), g = wk.plan.campaigns.filter(c => c.kind === 'search' && c.platform === 'google'), rep = g.filter(c => c.lines[0] === 'heat'), mN = wk.monthName, dayN = d => DOWL[dowOf(d.date)];
    if (wk.src === 'normal') add('stale', wk.head.headline.replace(': the week runs at normal', '') + ': run the week at normal, release nothing from the reserve and refresh the live data before changing any budget.');
    if (wk.sim) add('sim', 'This list is a simulation of ' + wk.label.replace('Simulation: ', '') + '. Use it to agree the rules before the cold arrives; do not load it.');
    /* repair by day: the line's money on the days the phones are answered; each repair campaign takes its share of the day (the same split the week sheet carries) */
    const open = wk.days.filter(d => d.answered), dark = wk.days.filter(d => !d.answered), nOpen = open.length || 7, normDay = wk.lines[0].normal / nOpen, repT = sum(wk.days.map(d => d.repair)) || 1, fold = wk.plan.fold || {};
    const darkWords = dark.length ? `No repair ads on ${words(dark.map(dayN))}: the phones are not answered. ` : '';
    if (rep.length) add('budget', wk.src === 'normal' ? `Keep the heating repair budget at ${usd(wk.lines[0].week / nOpen)} a day across its campaigns, the normal ${mN} day${dark.length ? ' on the ' + nOpen + ' days the phones are answered' : ''}.` : `Set the heating repair budget day by day: ${open.map(d => d.dow + ' ' + usd(d.repair)).join(', ')}. ${darkWords}A normal ${mN} day is ${usd(normDay)}.`,
      [].concat(...rep.map(c => wk.days.map(d => ({ campaign: c.name, date: d.date, day: d.dow, daily: c.budget * d.repair / repT })))));
    const oth = wk.lines.slice(1).filter(l => l.normal > 0), move = l => (Math.abs(l.changePct) < 0.5 ? 'normal' : (l.changePct > 0 ? 'up ' : 'down ') + Math.abs(l.changePct).toFixed(0) + '% on a normal week');
    if (oth.length) add('lines', oth.map(l => (l.paused ? `${l.name} is paused for the week` : l.id === 'maint' && fold.maint ? `${l.name} has no campaign of its own: its ${usd(l.week / 7)} a day rides on the repair campaign (${move(l)})` : `${l.name} runs at ${usd(l.week / 7)} a day (${move(l)})`)).join('; ') + '.', oth.map(l => ({ line: l.id, daily: l.week / 7, normal: l.normal / 7, mult: l.mult })));
    const capDays = wk.days.filter(d => d.capUp > 0);
    add('caps', capDays.length ? `Raise the max CPC caps on ${words(capDays.map(d => dayN(d) + ' (' + d.capUp + '%)'))}, the freeze ${capDays.length === 1 ? 'day' : 'days'}, and take them back the day after.` : 'Leave the max CPC caps where they are: no freeze at the dispatch point this week.', capDays.map(d => ({ date: d.date, day: d.dow, capUp: d.capUp })));
    const onCall = P.hours.onCall && wk.days.some(d => d.alert);
    add('hours', `Run repair ads only while the phones are answered: ${P.hours.sunday ? 'every day' : 'Monday to Saturday'} ${clock(P.hours.open)} to ${clock(P.hours.close)}` + (onCall ? `, and on call while the cold alert is active, every day ${clock(Math.min(6, P.hours.open))} to ${clock(Math.max(22, P.hours.close))}` : '') + (capDays.length ? `; on the freeze ${capDays.length === 1 ? 'day' : 'days'} lift 5 am to 9 am by 30 points and 5 pm to 10 pm by 25 inside those hours.` : '.'), []);
    if (wk.creative.length) add('creative', `Creative: switch on the ${wk.creative.map(c => c.set).join(' and the ')} set (${wk.creative[0].lines[0].toLowerCase()}; ${wk.creative[0].lines[1].toLowerCase()}).`, wk.creative);
    const lsa = sum(IDS.map(id => wk.plan.line[id].platDollars.lsa));
    add('lsa', P.lsaLive ? `Set the Local Services weekly budget to ${usd(lsa)}.` : 'Local Services stays off until the badge is verified; nothing to set there.', P.lsaLive ? [{ weekly: lsa }] : []);
    if (wk.hold) add('zips', wk.src === 'normal' ? 'Leave the ZIP list and the location bid adjustments as the month plan has them.' : 'No cold trigger: leave the ZIP list and the location bid adjustments alone. Only the budgets move.', []);
    else add('zips', `Cold trigger (${wk.triggerWhy.join('; ')}). ` + (wk.added.length ? `Add ${wk.added.length} ${wk.added.length === 1 ? 'ZIP' : 'ZIPs'} for the week: ${wk.added.slice(0, 8).map(a => a.zip + ' ' + a.city).join(', ')}${wk.added.length > 8 ? ' and ' + (wk.added.length - 8) + ' more' : ''}. ` : 'No ZIP joins. ') + (wk.paused.length ? `Pause ${wk.paused.slice(0, 8).map(a => a.zip + ' ' + a.city).join(', ')}${wk.paused.length > 8 ? ' and ' + (wk.paused.length - 8) + ' more' : ''}. ` : '') + (wk.reach.heat < 0.995 ? `Repair and tune up reach is ${pc(wk.reach.heat)} of normal` + (wk.reach.stormZips ? `, ${pc(Math.min(wk.reach.heat, P.stormReach))} where ice or a storm warning is forecast.` : '.') : '') + ' Location bid adjustments stay as they are.', wk.added.map(a => Object.assign({ change: 'add' }, a)).concat(wk.paused.map(a => Object.assign({ change: 'pause' }, a))));
    add('reserve', wk.reserve.text, [{ draw: wk.reserve.draw, back: wk.reserve.back, month: wk.reserve.month }]);
    if (wk.crew) add('crew', wk.crew.text, wk.crew.tiers);
    return L;
  }

  /* ---------- what a budget buys, the mix by month, one change at a time ---------- */
  function ladder(Pin, list) {
    const P = params(Pin), bs = [...new Set((Array.isArray(list) ? list : [2000, 3000, 4000, 5000, 6000, 8000, 10000, 12000, 15000, 20000, 25000, 30000, 40000]).filter(okNum).map(Number).concat([P.budget, 3 * P.budget]))].filter(b => b > 0).sort((a, b) => a - b);
    return bs.map(b => { const Q = plan(P, { budget: b, lite: true }), tr = {}; Q.tiers.forEach(t => { tr[t.tier] = t.share; });
      return { budget: b, own: b === P.budget, spent: Q.T.spent, unspent: Q.T.unspent, lambda: Q.T.lambda, zips: Q.T.zips, campaigns: Q.campaigns.filter(c => c.kind === 'search' && c.platform === 'google').length, leads: Q.T.leads, jobs: Q.T.jobs, gp: Q.T.gp, gpDirect: Q.T.gpDirect, cpl: Q.T.cpl, farthest: Q.T.farthest, share20: Q.T.share20, mix: Q.T.mix, tiers: tr, counties: Q.counties.filter(c => c.dollars > 0).map(c => ({ county: c.county, share: c.share })), top: Q.zips.slice(0, 12).map(r => ({ zip: r.zip, city: r.city, dollars: r.dollars })) }; });
  }
  function months(Pin, list) {
    const P = params(Pin); return (Array.isArray(list) ? list : [9, 10, 11, 0, 1, 2]).map(monthOk).filter(m => m != null).map(m => { const Q = plan(Object.assign({}, P, { month: m }), { lite: true }), se = {}; IDS.forEach(id => { se[id] = Q.line[id].season; }); return { month: m, name: MONTHS[m], mix: Q.T.mix, season: se, zips: Q.T.zips, leads: Q.T.leads, jobs: Q.T.jobs, gp: Q.T.gp, repairLed: IDS.every(id => Q.T.mix.heat >= Q.T.mix[id]) }; });
  }
  function variants(Pin) {
    const P = params(Pin), Q0 = plan(P, { lite: true }), z0 = {}, sm = (Q, f) => sum(Q.zips.filter(f).map(r => r.dollars)) / (Q.T.spent || 1); Q0.zips.forEach(r => { z0[r.zip] = r.share; });
    const row = Q => ({ zips: Q.T.zips, leads: Q.T.leads, jobs: Q.T.jobs, gp: Q.T.gp, dallas: sm(Q, r => r.county === 'Dallas') }), mul = (k, f) => { const o = {}; IDS.forEach(id => { o[id] = P[k][id] * f; }); return o; }, one = (k, id, f) => Object.assign({}, P[k], { [id]: P[k][id] * f });
    const V = [['Trust in the auction cost: 0', 'cost', { trust: 0 }], ['Trust in the auction cost: 1', 'cost', { trust: 1 }], ['Doubt 0.1', 'fill', { doubt: 0.1 }], ['Doubt 0.4', 'fill', { doubt: 0.4 }], ['Line trust 0', 'mix', { gamma: 0 }], ['Line trust 0.6', 'mix', { gamma: 0.6 }],
      ['One advertiser cap 20%', 'volume', { cap: 0.2 }], ['One advertiser cap 40%', 'volume', { cap: 0.4 }], ['Paid share of repair halved', 'volume', { paid: one('paid', 'heat', 0.5) }], ['Paid share of repair doubled', 'volume', { paid: one('paid', 'heat', 2) }],
      ['Paid share of furnace doubled', 'volume', { paid: one('paid', 'furnace', 2) }], ['Paid share of heat pump doubled', 'volume', { paid: one('paid', 'heatpump', 2) }], ['Paid share of tune up doubled', 'volume', { paid: one('paid', 'maint', 2) }],
      ['Reach tight (a fifth shorter)', 'reach', { half: mul('half', 0.8) }], ['Reach wide (a quarter longer)', 'reach', { half: mul('half', 1.25) }], ['Pipeline credit 50%', 'value', { pipeCredit: 0.5 }], ['Pipeline credit 0', 'value', { pipeCredit: 0 }], ['Hurdle off', 'fill', { hurdle: 0 }],
      ['Cold exposure off', 'cold', { coldExp: { heat: 0, furnace: 0, heatpump: 0, maint: 0 } }], ['Cold exposure doubled', 'cold', { coldExp: mul('coldExp', 2) }], ['Local Services live', 'platform', { lsaLive: true }], ['Who decides off', 'pool', { dmw: [1, 1, 1] }], ['Home turf off', 'fill', { coreMin: 0 }],
      ['Minimum a quarter of a lead', 'fill', { depth: 0.25 }], ['Minimum one lead', 'fill', { depth: 1 }], ['ZIP cap 10%', 'fill', { zipCap: 0.10 }], ['Repair first mix', 'mix', { mode: 'custom', mix: PRESETS.repair.mix }], ['Replacement first mix', 'mix', { mode: 'custom', mix: PRESETS.replace.mix }], ['Budget halved', 'budget', { budget: P.budget / 2 }], ['Budget doubled', 'budget', { budget: P.budget * 2 }]];
    const rows = V.map(([name, group, patch]) => { const Q = plan(Object.assign({}, P, patch), { lite: true }); return Object.assign({ name, group, patch, overlap: sum(Q.zips.map(r => Math.min(r.share, z0[r.zip] || 0))), mixMoved: sum(IDS.map(id => Math.abs(Q.T.mix[id] - Q0.T.mix[id]))) / 2, top5: Q.zips.slice(0, 5).map(r => r.zip) }, row(Q)); }).sort((a, b) => a.overlap - b.overlap);
    return { base: row(Q0), rows };
  }
  /* what switching Local Services on would change */
  function lsaGain(Pin) { const P = params(Pin), a = plan(Object.assign({}, P, { lsaLive: false }), { lite: true }), b = plan(Object.assign({}, P, { lsaLive: true }), { lite: true }), r = Q => ({ leads: Q.T.leads, cpl: Q.T.cpl, repairLeads: Q.line.heat.leads, repairCpl: Q.line.heat.cpl, zips: Q.T.zips, lsaDollars: Q.platforms[1].dollars }); return { off: r(a), on: r(b), roster: rosterDate() }; }

  /* ---------- exports: the text of every file; the page only saves it ---------- */
  function exports_(pl, wk, Pin, opt) {
    opt = opt && typeof opt === 'object' ? opt : {}; pl = isPlan(pl) ? pl : plan(Pin); wk = wk && wk.plan && wk.wx && wk.reserve && Array.isArray(wk.days) && Array.isArray(wk.lines) ? wk : null;
    const P = pl.P, date = localDay(opt.now || new Date()), mon = wk ? wk.monday : date, ex = {}, put = (key, name, text, note, group, main) => { ex[key] = { name, text, note: note || '', group, main: !!main }; };
    const csvOut = (h, rows, note) => { const text = toCSV(h, rows, note); return rows.length ? text : text.replace(/\n\n$/, '\n'); };      // a file with no rows is its header line alone
    const pct = v => (v > 0 ? '+' : '') + v + '%', loc = z => z + ', Texas, United States', search = pl.campaigns.filter(c => c.kind === 'search'), smart = P.bidding === 'smart';
    const rowsOf = c => { const m = {}; c.lines.forEach(id => pl.line[id].rows.forEach(x => { if (c.tier && tier(x.min) !== c.tier) return; const r = m[x.zip] = m[x.zip] || { zip: x.zip, z: x.z, d: 0, b: 0, v: 0, min: x.min }; r.d += x.spend; r.b += x.bid * x.spend; r.v += x.valueRule * x.spend; })); return Object.values(m).sort((a, b) => b.d - a.d).map(r => Object.assign(r, { bid: clamp(Math.round(r.b / r.d / 5) * 5, -50, 50), rule: clamp(Math.round(r.v / r.d * 100) / 100, 0.5, 1.5) })); };
    /* 1 Google locations, 6 Microsoft locations */
    const GL = ['Campaign', 'Location', 'ID', 'Bid Modifier', 'Criterion Type', 'Status'];
    const locs = plat => [].concat(...search.filter(c => c.platform === plat).map(c => rowsOf(c).map(r => [c.name, loc(r.zip), plat === 'google' ? (r.z.gid || '') : '', smart ? '' : pct(r.bid), 'Location', 'Enabled'])));
    const noId = [...new Set(pl.zips.filter(r => !r.z.gid).map(r => r.zip))];
    put('googleLocations', `heat-desk_google-locations_${date}.csv`, csvOut(GL, locs('google')), (smart ? 'Smart Bidding ignores location bid adjustments, so the Bid Modifier column is empty: the tier campaigns, their budgets and their first targets are the levers. ' : 'Location bid adjustments are what a lead is worth in the ZIP against the campaign average. ') + 'Load the campaigns file first: it creates every campaign paused. Set location options to presence only.' + (noId.length ? ` ${noId.length === 1 ? 'ZIP ' + noId[0] + ' has' : 'ZIPs ' + words(noId) + ' have'} no Google criterion id in the atlas: the editor matches by name.` : ''), 'google', true);
    put('microsoft', `heat-desk_microsoft-locations_${date}.csv`, csvOut(GL, locs('microsoft')), locs('microsoft').length ? 'The Google locations under _MS campaign names, without ids: Microsoft Advertising matches the ZIP by name.' : 'Microsoft Advertising is under its monthly minimum in every line: its share runs on Google Search and this file has no rows.', 'microsoft', true);
    /* 2 Google campaigns */
    const start = wk ? wk.monday : date;
    put('googleCampaigns', `heat-desk_google-campaigns_${date}.csv`, csvOut(['Campaign', 'Campaign Type', 'Networks', 'Budget', 'Budget type', 'Bid Strategy Type', 'Target CPA', 'Start Date', 'Campaign Status'], search.filter(c => c.platform === 'google').map(c => [c.name, 'Search', 'Google search', c.daily.toFixed(2), 'Daily', c.strategy, smart && c.targetCpa ? c.targetCpa.toFixed(2) : '', start, 'Paused'])),
      `Daily budget is the month over 30.4 less the ${pc(P.reserve)} freeze reserve. ` + (P.hours.sunday ? '' : 'Repair campaigns run Monday to Saturday, the days the phones are answered, so their daily budget is seven sixths of that. ') + (smart ? 'Target CPA starts at the planned cost per lead of the tier (grade D); switch a campaign to it after 30 conversions in 30 days.' : 'Maximize clicks with a max CPC cap: ' + search.filter(c => c.platform === 'google').map(c => c.name + ' ' + usd2(c.maxCpc)).join(', ') + ' (grade D).') + ' Every campaign is paused.', 'google', true);
    /* 3 the week change sheet */
    if (wk) { const H = ['section', 'campaign', 'day', 'date', 'daily_budget', 'max_cpc_cap_change_pct', 'start_hour', 'end_hour', 'bid_adjustment_pct', 'item', 'value'], rows = [], g = wk.plan.campaigns.filter(c => c.kind === 'search');
      g.forEach(c => { const wkB = c.budget, heat = c.lines[0] === 'heat', dT = sum(wk.days.map(d => d.repair)) || 1; wk.days.forEach(d => rows.push(['budget', c.name, d.dow, d.date, (heat ? wkB * d.repair / dT : wkB / 7).toFixed(2), heat ? d.capUp : 0, '', '', '', '', ''])); });
      wk.schedule.forEach(s => rows.push(['schedule', s.campaign, s.day, s.date, '', '', s.start, s.end, s.adj, '', '']));
      const kv = (item, value) => rows.push(['week', '', '', '', '', '', '', '', '', item, value]);
      kv('week of', wk.monday); kv('source', wk.label); kv('month', wk.monthName); kv('forecast nights read', wk.wx.nights + ' of 7'); kv('cold trigger', wk.trigger ? 'yes: ' + wk.triggerWhy.join('; ') : 'no'); kv('ZIP list', wk.hold ? 'frozen' : 'poured again, month ZIPs kept');
      const dark = wk.days.filter(d => d.answered === false); if (dark.length) kv('repair ads off', words(dark.map(d => DOWL[dowOf(d.date)])) + ': the phones are not answered'); wk.notes.forEach(n => kv('note', n.text));
      wk.lines.forEach(l => kv(l.name + ' multiplier', x2(l.mult))); wk.lines.forEach(l => kv(l.name + ' week dollars', Math.round(l.week))); kv('normal week dollars', Math.round(wk.T.normal)); kv('this week dollars', Math.round(wk.T.week));
      kv('reserve for the month', Math.round(wk.reserve.month)); kv('drawn from the reserve', Math.round(wk.reserve.draw)); kv('returned to the reserve', Math.round(wk.reserve.back)); if (wk.reserve.short > 0.5) kv('asked by the rules and not spent', Math.round(wk.reserve.short)); kv('repair reach against normal', pc(wk.reach.heat));
      wk.creative.forEach(c => kv('creative set: ' + c.set, c.lines.join(' | '))); wk.added.forEach(a => kv('add ZIP', a.zip + ' ' + a.city + ' (' + a.via.map(id => SHORT[id]).join(', ') + ')')); wk.paused.forEach(a => kv('pause ZIP', a.zip + ' ' + a.city + ': ' + a.why));
      wk.rules.filter(r => r.fired).forEach(r => kv('rule fired', r.trigger)); if (wk.crew) kv('crew cap', wk.crew.text);
      put('week', `heat-desk_week_${mon}.csv`, csvOut(H, rows), (wk.sim ? 'A simulation, not a forecast: do not load it. ' : '') + 'The change sheet for the week: daily budgets by campaign, max CPC cap changes on freeze days, the ad schedule windows, then the triggers, creative, ZIP changes and the reserve. Grade D sizes on grade A weather.', 'week', true); }
    /* 4 Local Services */
    const lz = [...new Set([].concat(...['heat', 'maint'].map(id => pl.line[id].rows.map(c => c.zip))))].sort(), B = typeof BRAND !== 'undefined' && BRAND ? BRAND : {}, lsaOf = p => (P.lsaLive ? sum(IDS.map(id => p.line[id].platDollars.lsa)) : sum(IDS.map(id => p.line[id].dollars * (P.plat[id].lsa / 100)))), lsaW = wk ? lsaOf(wk.plan) : lsaOf(pl) * (1 - P.reserve) * 7 / 30.4;
    put('lsa', `heat-desk_lsa-sheet_${date}.csv`, csvOut(['Field', 'Value'], [['Status', P.lsaLive ? 'Live in the plan; the profile and its budget stay paused until a person turns them on' : 'Planned off: the roster of ' + rosterDate() + ' shows no badge'], ['Business name', B.name || ''], ['TDLR license', B.lic || ''], ['Phone', typeof phoneFmt === 'function' ? phoneFmt(B.phone || '') : (B.phone || '')],
      ['Service ZIPs (repair and tune up buys)', lz.join(' ')], ['Job types', 'Furnace repair; Heating system repair; Heat pump repair; Furnace installation; Heat pump installation; Furnace maintenance'], ['Weekly budget this week', Math.round(lsaW)], ['Weekly budget basis', P.lsaLive ? 'the Local Services share of each line this week' : 'what the Local Services share of each line would be if it were live'],
      ['Hours', P.hours.sunday ? `Every day ${clock(P.hours.open)} to ${clock(P.hours.close)}` : `Monday to Saturday ${clock(P.hours.open)} to ${clock(P.hours.close)}, Sunday off`], ['Bid mode', 'Maximize leads; the platform sets the price per lead'], ['Verification still open', 'Background check for the owner and field staff; license check against TDLR; insurance certificate; Google Business Profile match; reviews linked'], ['Ranking levers', 'proximity, reviews, hours and answer rate: answer every call inside the hours above']]),
      'One service area per profile: the union of the repair and tune up ZIPs. No bids by ZIP exist on this platform.', 'lsa', true);
    /* 5 Meta, 7 Nextdoor */
    const msg = { gas: 'gas led: furnace, igniter and carbon monoxide copy', electric: 'electric led: heat pump, auxiliary heat and electric bill copy', mixed: 'mixed fuel: both sets' }, es = z => ((SLM.LEV[z] || {}).es || 0), metaRows = [];
    IDS.forEach(id => { if (!(pl.line[id].platDollars.meta > 0)) return; ['gas', 'electric'].forEach(fu => { const cs = pl.line[id].rows.filter(c => { const f = fuel(c.z); return f === fu || (f === 'mixed' && (fu === 'gas') === ((c.z.gas_sh || 0) >= (c.z.elec_sh || 0))); }); if (!cs.length) return;
        put(`meta_${id}_${fu}`, `heat-desk_meta-zips_${id}_${fu}.csv`, csvOut(['Zip', 'zip', 'city', 'message'], cs.map(c => ['US:' + c.zip, c.zip, c.z.city, msg[fuel(c.z)]])), `${NAMES[id]}, ${fu} side. Financing creative goes to a special ad category campaign with a 15 mile radius around the shop and no ZIPs.`, 'meta', false); });
      pl.line[id].rows.forEach(c => metaRows.push(['US:' + c.zip, c.zip, c.z.city, id, fuel(c.z), msg[fuel(c.z)], es(c.zip)])); });
    put('meta', `heat-desk_meta-zips_${date}.csv`, csvOut(['Zip', 'zip', 'city', 'line', 'fuel', 'message', 'spanish_share_pct'], metaRows), metaRows.length ? 'ZIP keys for the lines that hold a Meta share. Financing creative goes to a special ad category campaign with a 15 mile radius around the shop and no ZIPs.' : 'Meta is under its monthly minimum in every line at this budget: no rows. Its share runs on Google Search.', 'meta', true);
    const ndRows = []; IDS.forEach(id => { if (pl.line[id].platDollars.nextdoor > 0) pl.line[id].rows.forEach(c => ndRows.push([c.zip, c.z.city, c.z.cty, id, Math.round(c.spend * pl.line[id].platDollars.nextdoor / pl.line[id].dollars)])); });
    put('nextdoor', `heat-desk_nextdoor-zips_${date}.csv`, csvOut(['zip', 'city', 'county', 'line', 'monthly_usd'], ndRows), ndRows.length ? 'ZIP lists for the lines that hold a Nextdoor share.' : 'Nextdoor is under its monthly minimum in every line at this budget: no rows.', 'nextdoor', true);
    /* 8 exclusions: everything blocked or past the reach cut, for a campaign built on a radius */
    const exRows = pl.all.filter(r => !r.inPlan).map(r => { const h = heldWhy(r, pl); return h.code === 'blocked' || h.code === 'reach' ? ['(every radius campaign)', loc(r.zip), r.z.gid || '', 'Negative Location', 'Enabled', h.code === 'blocked' ? 'blocked by you' : `past the reach cut at ${Math.round(r.min)} minutes`] : null; }).filter(Boolean);
    put('exclusions', `heat-desk_exclusions_${date}.csv`, csvOut(['Campaign', 'Location', 'ID', 'Criterion Type', 'Status', 'reason'], exRows), 'ZIPs to add as negative locations when a campaign is built on a radius: everything blocked or past the reach cut on every line. Put the name of the radius campaign in the first column before loading.', 'google', true);
    /* 9 plain ZIP lists */
    put('zipList', 'heat-desk_zip-list_all.txt', pl.zips.map(r => r.zip).sort().join('\n') + '\n', 'Every ZIP in the plan, one a line, for any bulk location box.', 'lists', true);
    IDS.forEach(id => { if (pl.line[id].rows.length) put('zipList_' + id, `heat-desk_zip-list_${id}.txt`, pl.line[id].rows.map(c => c.zip).sort().join('\n') + '\n', NAMES[id] + ' ZIPs, one a line.', 'lists', false); });
    /* 10 plan by ZIP: every scored cell with every factor */
    const r3 = v => (v == null || !isN(v) ? '' : +(+v).toFixed(3)), r1 = v => (v == null || !isN(v) ? '' : +(+v).toFixed(1));
    put('planByZip', `heat-desk_plan-by-zip_${date}.csv`, csvOut(['zip', 'city', 'county', 'line', 'state', 'minutes', 'tier', 'reach', 'who_decides', 'cold_exposure', 'cold_factor', 'weather_multiplier', 'pressure_pct', 'cost_index', 'cost_per_lead_usd', 'cost_per_lead_after_folds_usd', 'close_rate', 'jobs_in_period', 'winnable_share', 'gp_per_job_usd', 'gp_direct_per_job_usd', 'return_first_dollar', 'return_as_weighed', 'cut', 'confidence', 'saturation_usd', 'saturation_after_folds_usd', 'floor_usd', 'dollars', 'share_of_plan', 'bid_adjustment_pct', 'value_rule', 'leads', 'booked_jobs', 'gross_profit_usd', 'gross_profit_direct_usd', 'fuel', 'spanish_share_pct', 'pinned', 'google_criterion_id'],
      pl.cells.map(c => { const r = pl.at[c.zip]; return [c.zip, c.z.city, c.z.cty, c.id, c.state, r1(c.min), r.tier, r3(c.R), r3(c.dm), r3(r.x), r3(c.x), r3(c.w), r1(r.z && SLM.SLZ[c.zip][c.id].presspct), r3(c.cost), r1(c.cpl), r1(c.cplRun), r3(c.close), r3(c.J), r3(c.sigma), Math.round(c.g), Math.round(c.gd), r3(c.rho), r3(c.rhoD), r3(pl.line[c.id].lambda), c.R > 0 && c.y != null ? r3(c.conf) : '', Math.round(c.K), Math.round(c.KRun), r1(c.floor), r1(c.spend), pl.T.spent > 0 ? r3(c.spend / pl.T.spent * 100) : 0, c.bid == null ? '' : c.bid, c.valueRule == null ? '' : c.valueRule, r3(c.leads), r3(c.jobs), Math.round(c.gp), Math.round(c.gpDirect), r.fuel, es(c.zip), r.pinned ? 1 : 0, c.z.gid || '']; }),
      `DFW Thermal Debt Atlas, module 17 Heat Desk. ${pl.monthName}, ${usd(pl.T.budget)} a ${pl.period}, ${pl.T.mode} mix. One row per ZIP per line, funded or not. The money is placed at cost_per_lead_usd, the line's planned platform mix; leads, booked jobs and gross profit are priced at cost_per_lead_after_folds_usd, the platforms that run once a share under its minimum has moved to Google Search. Minutes grade C; reach, cost, returns, leads, jobs and gross profit grade D; cold exposure inputs grade A. Dollars by ZIP are where spend is expected to land, not a platform setting.`), 'Every scored ZIP and line with every factor, for audit. Carries a note at the top; it is not a platform file.', 'audit', true);
    /* 11 conversion value rules by location, for accounts on value based bidding */
    put('valueRules', `heat-desk_value-rules_${date}.csv`, csvOut(['Campaign', 'Location', 'ID', 'Value rule', 'Multiplier'], [].concat(...search.filter(c => c.platform === 'google').map(c => rowsOf(c).map(r => [c.name, loc(r.zip), r.z.gid || '', 'Multiply', r.rule.toFixed(2)])))), 'The same value ratios as conversion value rules by location, limited to 0.5 to 1.5. Use them only where a campaign bids on value; location bid adjustments are ignored there. Enter them under Conversions, Value rules.', 'google', true);
    /* 12 assumptions */
    const ages = {}; try { if (typeof LIVE !== 'undefined' && LIVE.all) Object.keys(LIVE.all()).forEach(id => { const r = LIVE.rec(id); ages[id] = { at: r.at || null, ok: r.ok !== false, baseline: !!r.baseline }; }); } catch (e) { }
    put('assumptions', 'heat-desk_assumptions.json', JSON.stringify({ module: 'Heat Desk (module 17), DFW Thermal Debt Atlas', written: date, stockCompiled: (typeof META !== 'undefined' && META.compiled) || null, liveBaselineBuilt: (typeof window !== 'undefined' && window.__LIVE_BASELINE__ && window.__LIVE_BASELINE__.built) || null, dispatch: pl.origin, coldExposure: { source: pl.exposure.source, metroMean: pl.exposure.mean }, controls: P,
      week: wk ? { monday: wk.monday, source: wk.label, month: wk.monthName, trigger: wk.trigger, multipliers: Object.fromEntries(wk.lines.map(l => [l.id, +x2(l.mult)])), forecastAt: wk.at } : null, liveRecords: ages, serviceLineAssumptions: { cpc: SLM.A.cpc, lines: Object.fromEntries(IDS.map(id => [id, SLM.A.lines[id]])) }, totals: { budget: pl.T.budget, spent: Math.round(pl.T.spent), unspent: Math.round(pl.T.unspent), zips: pl.T.zips, cut: +pl.T.lambda.toFixed(3), leads: +pl.T.leads.toFixed(1), leadsIfEveryPlatformShareRan: +pl.T.leadsPlanned.toFixed(1), bookedJobs: +pl.T.jobs.toFixed(1) }, outcomesPricedAt: 'the platforms that run after the platform minimums', grades: GRADES }, null, 1) + '\n', 'Every control as saved, the age of each live record and the build dates: enough to rebuild the plan.', 'audit', true);
    /* the order to load them, for the pack */
    put('readme', 'heat-desk_read-me.txt', ['Heat Desk Monday pack, written ' + longDay(date) + ', ' + date.slice(0, 4) + '.', '', 'Every campaign in these files is paused. Nothing spends until a person turns it on.', 'Dollar figures are what the atlas benchmarks imply (grade D). They are planning figures.', '', 'Order:'].concat(Object.keys(ex).map((k, i) => (i + 1) + '. ' + ex[k].name + ': ' + ex[k].note)).join('\n') + '\n', 'What each file is and the order to load them.', 'pack', false);
    return ex;
  }
  const pack = ex0 => { const ex = ex0 && typeof ex0 === 'object' ? ex0 : {}; return { name: (ex.week ? ex.week.name.replace('heat-desk_week_', 'heat-desk_monday-pack_').replace(/\.csv$/, '') : 'heat-desk_monday-pack') + '.zip', files: Object.keys(ex).filter(k => ex[k] && typeof ex[k].text === 'string').map(k => ({ name: ex[k].name, data: /\.csv$/.test(ex[k].name) && ex[k].text.charCodeAt(0) !== 0xFEFF ? '\uFEFF' + ex[k].text : ex[k].text })) }; };      // a CSV in the pack starts with the byte order mark a single download gets, so the two are the same bytes

  return { IDS, NAMES, SHORT, PLATS, PLAT_NAMES, TIERS, LABELS, PRESETS, SCENARIOS, GRADES, MONTHS, DEF, RANGES, params, get, set, origin, exposure, plan, bands, forecast, scenario, weather, week, rules, ladder, months, variants, lsaGain, why, held, hand, exports: exports_, pack,
    /* the small helpers, safe on anything: a weight or a normal low of something that is not a number is null */
    nightW: (t, P) => (okNum(t) ? nightW(+t, P && Array.isArray(P.nightW) && P.nightW.length === 6 && P.nightW.every(okNum) ? P : null) : null), normLow: m => (monthOk(m) == null ? null : normLow(monthOk(m))), minutes: z => minutes(z && typeof z === 'object' ? z : {}),
    reach: (min, half, cut) => (okNum(min) && okNum(half) && +half > 0 ? reach(+min, +half, okNum(cut) ? +cut : DEF.cut) : 0), label: c => label(okNum(c) ? +c : 0), tier: m => tier(okNum(m) ? +m : Infinity), fuel: z => fuel(z && typeof z === 'object' ? z : {}), bench: (pl, n) => (isPlan(pl) && pl.ctx ? bench(pl, okNum(n) && +n > 0 ? Math.round(+n) : undefined) : []) };
})();
