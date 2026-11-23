/* ==== 11_nws_core.js ==== */
/* ==== nws_core ==== */
"use strict";
/* ============================ NWSX: National Weather Service reader, weather triggers and roofing work windows ============================ */
/* Sources: api.weather.gov (points, gridpoint forecast, hourly forecast, raw grid with rain amounts, wind gusts and direction, humidity,
   snowfall, thunder and weather attributes, and the active alerts for California), read live by Refresh. Station observations, forecast
   discussions from the ten offices that forecast for California (EKA, STO, MTR, HNX, LOX, SGX, MFR, REV, VEF, PSR), the Storm Prediction
   Center fire weather outlook, the Weather Prediction Center excessive rainfall outlook and the river forecast center's rain discussion
   come from the embedded snapshot only. One forecast point stands for each of the eleven regions. The snapshot keeps the desk working
   offline and inside the Claude viewer, whose network rules block live calls; outside the viewer, Refresh pulls the live forecast.
   All times are Pacific time (America/Los_Angeles); forecast hours are read as the local wall time the service prints. */
const NWSX = (() => {
  const SNAP = window.__NWS_SNAPSHOT__ || null;
  const TZ = 'America/Los_Angeles', TZL = 'Pacific';
  const AREA = 'CA';
  /* region number <-> two letter key (META.model.REGK); the fallback is the order of the region list */
  const RKEYS = ['nc', 'fn', 'sv', 'si', 'ba', 'cc', 'sj', 'la', 'oc', 'ie', 'sd'];
  const REGK = (META.model && META.model.REGK) || {};
  const regNo = k => { const hit = Object.keys(REGK).find(n => REGK[n] === k); return hit != null ? +hit : RKEYS.indexOf(k) + 1; };
  /* one forecast point per region: [city, lat, lon, region key]. Truckee stands for the Sierra because snow load is its roofing hazard */
  const PTS0 = [['Eureka', 40.8021, -124.1637, 'nc'], ['Redding', 40.5865, -122.3917, 'fn'], ['Sacramento', 38.5816, -121.4944, 'sv'], ['Truckee', 39.3280, -120.1833, 'si'],
    ['San Francisco', 37.7749, -122.4194, 'ba'], ['Santa Barbara', 34.4208, -119.6982, 'cc'], ['Fresno', 36.7378, -119.7871, 'sj'], ['Los Angeles', 34.0522, -118.2437, 'la'],
    ['Santa Ana', 33.7455, -117.8677, 'oc'], ['Riverside', 33.9806, -117.3755, 'ie'], ['San Diego', 32.7157, -117.1611, 'sd']];
  const REGOF = {}; PTS0.forEach(p => { REGOF[p[0]] = regNo(p[3]); });
  /* the ten forecast offices, in the order the discussion card lists them */
  const OFFICES = { EKA: 'Eureka', STO: 'Sacramento', MTR: 'San Francisco Bay Area and Monterey', HNX: 'Hanford and the San Joaquin Valley', LOX: 'Los Angeles and Oxnard', SGX: 'San Diego', MFR: 'Medford (Siskiyou and Modoc)', REV: 'Reno (eastern Sierra and Tahoe)', VEF: 'Las Vegas (Inyo and the Mojave)', PSR: 'Phoenix (Imperial and the lower desert)' };
  const blank = () => ({ fetched: null, tz: TZ, source: '', points: PTS0.map(([city, lat, lon, reg]) => ({ city, lat, lon, reg, periods: [], hourly: [], grid: {} })), alerts: [], obs: [], afd: {}, fire: {}, ero: {}, rain: {}, ar: {} });
  let D = SNAP ? Object.assign(blank(), JSON.parse(JSON.stringify(SNAP))) : blank();
  if (!D.points || !D.points.length) D.points = blank().points;
  let LIVE = false; let CACHE = {};
  const hh = h => { h = ((h % 24) + 24) % 24; return h === 0 ? '12a' : h < 12 ? h + 'a' : h === 12 ? '12p' : (h - 12) + 'p'; };
  const partsOf = iso => { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2})/); return m ? { y: +m[1], mo: +m[2], d: +m[3], h: +m[4], date: `${m[1]}-${m[2]}-${m[3]}` } : null; };
  const dowOf = date => new Date(date + 'T12:00:00').getDay();
  /* a time in Pacific time, for labels */
  const when = (iso, opt) => { try { return new Date(iso).toLocaleString('en-US', Object.assign({ timeZone: TZ, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }, opt || {})) + ' ' + TZL; } catch (e) { return String(iso || ''); } };
  /* ---------- crew calendar: holidays when crews are off and leads slow, 2026 and 2027 ---------- */
  /* Federal holidays, with the weekend they make, plus Cesar Chavez Day (a California state holiday, March 31). */
  const HOL = [['2026-01-01', '2026-01-04', 'New Year'], ['2026-01-17', '2026-01-19', 'Martin Luther King Jr. Day weekend'], ['2026-02-14', '2026-02-16', 'Presidents Day weekend'], ['2026-03-31', '2026-03-31', 'Cesar Chavez Day'],
    ['2026-05-23', '2026-05-25', 'Memorial Day weekend'], ['2026-06-19', '2026-06-21', 'Juneteenth'], ['2026-07-03', '2026-07-05', 'Independence Day'], ['2026-09-05', '2026-09-07', 'Labor Day weekend'],
    ['2026-10-10', '2026-10-12', 'Columbus Day and Indigenous Peoples Day weekend'], ['2026-11-11', '2026-11-11', 'Veterans Day'], ['2026-11-25', '2026-11-29', 'Thanksgiving'], ['2026-12-24', '2026-12-27', 'Christmas'],
    ['2026-12-31', '2027-01-03', 'New Year'], ['2027-01-16', '2027-01-18', 'Martin Luther King Jr. Day weekend'], ['2027-02-13', '2027-02-15', 'Presidents Day weekend'], ['2027-03-31', '2027-03-31', 'Cesar Chavez Day'],
    ['2027-05-29', '2027-05-31', 'Memorial Day weekend'], ['2027-06-18', '2027-06-20', 'Juneteenth'], ['2027-07-03', '2027-07-05', 'Independence Day'], ['2027-09-04', '2027-09-06', 'Labor Day weekend'],
    ['2027-10-09', '2027-10-11', 'Columbus Day and Indigenous Peoples Day weekend'], ['2027-11-11', '2027-11-11', 'Veterans Day'], ['2027-11-24', '2027-11-28', 'Thanksgiving'], ['2027-12-24', '2027-12-26', 'Christmas'], ['2027-12-31', '2028-01-02', 'New Year']];
  const holiday = date => { const h = HOL.find(([a, b]) => date >= a && date <= b); return h ? h[2] : ''; };
  /* ---------- the roofing seasons, from the record where the data holds one ---------- */
  /* Each season is a list of months (0 = January). Santa Ana months are the months with three or more Santa Ana days in an average year
     in the Scripps regional index, 1948 to 2018 (mean days by month, January to December). The rain, fire, heat and snow seasons are
     the fewest months that hold 80 percent of the record in the atlas time series, and are left out when the data has no such series. */
  const SA_DAYS = [11.9, 6.7, 2.8, 0.6, 0.1, 0.1, 0, 0, 0.4, 3.5, 7.8, 12.2];
  const topMonths = (a, share) => { if (!Array.isArray(a) || a.length !== 12) return null; const t = sum(a); if (!(t > 0)) return null; const idx = a.map((v, i) => [v, i]).sort((x, y) => y[0] - x[0]); const out = []; let acc = 0; for (const [v, i] of idx) { if (acc / t >= share) break; out.push(i); acc += v; } return out.sort((x, y) => x - y); };
  const SEASONS = (() => {
    /* monthly series of the hazard build (HAZARD_SCHEMA.md section 3); each is used only when the data carries it */
    const TM = (typeof DATA !== 'undefined' && DATA.ts && DATA.ts.month) || {}; const out = [];
    const ok = a => Array.isArray(a) && a.length === 12 && a.some(v => +v > 0) ? a.map(Number) : null;
    const plus = (...ks) => { const as = ks.map(k => ok(TM[k])).filter(Boolean); return as.length ? as[0].map((_, i) => sum(as.map(a => a[i]))) : null; };
    const add = (k, name, months, src, what) => { if (months && months.length) out.push({ k, name, months, src, what }); };
    const sa = ok(TM.sa_days);
    add('rain', 'Rain season', topMonths(ok(TM.ar_days) || plus('ar1', 'ar2', 'ar3', 'ar4', 'ar5') || plus('hrain', 'flood'), 0.8), ok(TM.ar_days) || ok(TM.ar1) ? 'atmospheric rivers by month (CW3E catalog)' : 'heavy rain and flood records by month', 'Leak calls, tarps and emergency repairs. Tear offs need a dry window; book re-roofs for the dry months before it.');
    add('wind', 'Santa Ana season', (sa || SA_DAYS).map((v, i) => v >= 3 ? i : -1).filter(i => i >= 0), 'Scripps Santa Ana winds regional index, mean days by month, 1948 to 2018', 'Dry offshore wind in the south: lifted shingles and tile, and the highest fire danger of the year.');
    add('fire', 'Fire season', topMonths(ok(TM.fire_ac) || ok(TM.fire_n) || ok(TM.fire_dest), 0.8), 'acres burned by month of ignition (CAL FIRE perimeters)', 'Hardening work sells before it; after a fire the disaster rules on price, licence and contracts apply.');
    add('heat', 'Heat season', topMonths(plus('xheat', 'heat'), 0.8), 'heat and excessive heat records by month', 'Inland crews start at first light; shade above 80 F and high heat procedures at 95 F are the law for outdoor work.');
    add('snow', 'Snow season', topMonths(plus('hsnow', 'wstorm'), 0.8), 'heavy snow and winter storm records by month', 'Mountain roofs: snow load, ice dams and short work days. Re-roofs wait for the melt.');
    return out;
  })();
  const seasonsOf = date => { const P = partsOf(String(date || '') + 'T00'); if (!P) return []; return SEASONS.filter(s => s.months.includes(P.mo - 1)); };
  /* ---------- the lead clock: share of roofing leads by day and hour, 1.0 = an average hour (assumption, grade D, until account actuals replace it) ---------- */
  const BASE = (() => { const day = [0.25, 0.15, 0.1, 0.1, 0.15, 0.35, 0.8, 1.4, 1.9, 2.0, 1.9, 1.8, 1.7, 1.7, 1.6, 1.6, 1.5, 1.4, 1.3, 1.1, 0.9, 0.7, 0.5, 0.35]; const dw = [0.55, 1.15, 1.15, 1.1, 1.1, 1.0, 0.8]; const g = dw.map(f => day.map(v => v * f)); const m = mean(g.flat()); return g.map(r => r.map(v => v / m)); })();
  const BASE_AI = BASE;
  /* grid values come as [validTime "start/duration", value]; find the value covering an hour */
  const durH = dur => { const m = String(dur || 'PT1H').match(/P(?:(\d+)D)?T?(?:(\d+)H)?/); return ((+(m && m[1]) || 0) * 24 + (+(m && m[2]) || 0)) || 1; };
  function gridAt(arr, iso) { if (!arr || !arr.length) return null; const t = Date.parse(iso); for (const [vt, v] of arr) { const [s, dur] = String(vt).split('/'); const t0 = Date.parse(s); const len = durH(dur) * 3600e3; if (t >= t0 && t < t0 + len) return v; } return null; }
  /* amounts (rain, snow) are totals over their period: the hourly rate is the total divided by the hours of the period */
  function gridRate(arr, iso) { if (!arr || !arr.length) return null; const t = Date.parse(iso); for (const [vt, v] of arr) { const [s, dur] = String(vt).split('/'); const t0 = Date.parse(s); const n = durH(dur); if (t >= t0 && t < t0 + n * 3600e3) return isN(v) ? v / n : null; } return null; }
  const kmh = v => isN(v) ? v / 1.609 : null;          /* kilometres an hour to miles an hour */
  const mmIn = v => isN(v) ? v / 25.4 : null;          /* millimetres to inches */
  /* wind from the land: a direction from north northwest round through east southeast (330 to 110 degrees) is offshore on this coast */
  const offshore = deg => isN(deg) && (deg >= 330 || deg <= 110);
  /* ---------- alerts that cover a forecast point (by forecast zone, fire weather zone or county code) ---------- */
  const fips5 = s => String(s || '').slice(-5);
  function alertsAt(pi) {
    const p = D.points[pi]; if (!p) return []; const codes = [p.zone, p.fireZone, p.county].filter(Boolean); const cf = p.county ? '06' + String(p.county).slice(-3) : '';
    /* an alert that lists zones is matched by zone only: its county list names every county a mountain or coast zone touches */
    return (D.alerts || []).filter(a => (a.zones || []).length ? a.zones.some(z => codes.includes(z)) : (cf && (a.fips || []).map(fips5).includes(cf)));
  }
  const alertOn = (a, t) => { const t0 = Date.parse(a.onset || a.sent || ''), t1 = Date.parse(a.ends || a.expires || ''); return (!isN(t0) || t >= t0) && (!isN(t1) || t < t1); };
  /* ---------- trigger weights (assumptions, grade C): what each sign of roof weather adds to a base of 1.0 ---------- */
  const TRIG = {
    rain: { l: 'Rain', rate0: 0.05, per: 0.25, cap: 1.2, day1: 1.5, add1: 0.3, day2: 3.0, add2: 0.6, ar: 0.2 },
    wind: { l: 'Wind', gust0: 30, per: 20, warn: 0.5, off: 0.3 },
    fire: { l: 'Fire weather', rh: 15, gust: 25, add: 0.6, flag: 0.8, watch: 0.4 },
    heat: { l: 'Heat', t1: 100, add1: 0.3, t2: 110, add2: 0.5 },
    snow: { l: 'Snow', rate0: 0.5, per: 1.0, cap: 1.0, tot: 24, add: 0.5, warn: 0.3 },
    storm: { l: 'Thunderstorm', thun0: 15, thun: 0.6, hail: 0.5, dwind: 0.5, ffw: 0.5 },
  };
  const KINDS = ['rain', 'wind', 'fire', 'heat', 'snow', 'storm'];
  /* ---------- per hour: weather trigger index (damage and demand potential that becomes roofing work in the days after) and the work window ---------- */
  function hourly(pi) {
    if (CACHE[pi]) return CACHE[pi];
    const p = D.points[pi]; if (!p) return []; const grid = p.grid || {}; const A = alertsAt(pi);
    const arNamed = !!(((D.ar || {}).afd_mentions || {})[p.office]);
    const rows = (p.hourly || []).map(h => { const P = partsOf(h.t); if (!P) return null; return { h, P, t: Date.parse(h.t), rain: mmIn(gridRate(grid.quantitativePrecipitation, h.t)) || 0, snow: mmIn(gridRate(grid.snowfallAmount, h.t)) || 0 }; }).filter(Boolean);
    /* totals ahead of each hour: rain over the next 24 hours, snow over the next 72 */
    const ahead = (i, n, k) => { let s = 0; for (let j = i; j < Math.min(rows.length, i + n); j++) s += rows[j][k]; return s; };
    const out = rows.map((r, i) => { const h = r.h, P = r.P; const dow = dowOf(P.date);
      const pop = +h.pop || 0; const thun = +gridAt(grid.probabilityOfThunder, h.t) || 0; const gust = kmh(gridAt(grid.windGust, h.t)); const dir = gridAt(grid.windDirection, h.t);
      const rhG = gridAt(grid.relativeHumidity, h.t); const rh = isN(h.rh) ? +h.rh : isN(rhG) ? +rhG : null;
      const wxs = String(gridAt(grid.weather, h.t) || '') + ' ' + String(h.short || '');
      const hail = /hail/i.test(wxs), dwind = /damaging_wind/i.test(wxs), smoke = /smoke/i.test(wxs), snowing = r.snow > 0.02 || /\bsnow|blizzard|sleet|freezing rain/i.test(String(h.short || ''));
      const rain24 = ahead(i, 24, 'rain'), snow72 = ahead(i, 72, 'snow');
      const live = A.filter(a => alertOn(a, r.t)); const has = re => live.some(a => re.test(a.event || ''));
      const why = []; const trig = {}; let risk = 1; const add = (k, v, w) => { if (!(v > 0)) return; risk += v; trig[k] = (trig[k] || 0) + v; if (w && !why.includes(w)) why.push(w); };
      /* rain: the hourly rate, the day's total, and an atmospheric river named by the forecasters */
      /* where it is snowing the forecast amount is the water in the snow, which the snow trigger counts */
      const wet = snowing ? 0 : r.rain;
      if (wet >= TRIG.rain.rate0) add('rain', Math.min(TRIG.rain.cap, wet / TRIG.rain.per), `rain ${D_(wet)} in an hour`);
      if (snowing) { /* counted as snow */ } else if (rain24 >= TRIG.rain.day2) add('rain', TRIG.rain.add2, `${D1(rain24)} in of rain in 24 hours`); else if (rain24 >= TRIG.rain.day1) add('rain', TRIG.rain.add1, `${D1(rain24)} in of rain in 24 hours`);
      if (arNamed && !snowing && rain24 >= 1) add('rain', TRIG.rain.ar, 'atmospheric river in the forecast discussion');
      /* wind: gusts, a High Wind Warning, and dry wind off the land (the Santa Ana, Diablo and sundowner pattern) */
      if (isN(gust) && gust >= TRIG.wind.gust0) add('wind', (gust - TRIG.wind.gust0) / TRIG.wind.per, `gusts ${Math.round(gust)} mph`);
      if (has(/High Wind Warning|Extreme Wind/i)) add('wind', TRIG.wind.warn, 'High Wind Warning');
      const dryOff = isN(gust) && gust >= 25 && isN(rh) && rh <= 30 && (dir == null || offshore(dir));
      if (dryOff && offshore(dir)) add('wind', TRIG.wind.off, 'dry offshore wind');
      /* fire weather: very dry air with wind, or a Red Flag Warning or Fire Weather Watch over the point */
      if (isN(rh) && rh <= TRIG.fire.rh && isN(gust) && gust >= TRIG.fire.gust) add('fire', TRIG.fire.add, `humidity ${Math.round(rh)}% with gusts ${Math.round(gust)} mph`);
      if (has(/Red Flag Warning/i)) add('fire', TRIG.fire.flag, 'Red Flag Warning'); else if (has(/Fire Weather Watch/i)) add('fire', TRIG.fire.watch, 'Fire Weather Watch');
      /* heat */
      if (isN(h.tempF) && h.tempF >= TRIG.heat.t2) add('heat', TRIG.heat.add2, `${Math.round(h.tempF)} F`); else if (isN(h.tempF) && h.tempF >= TRIG.heat.t1) add('heat', TRIG.heat.add1, `${Math.round(h.tempF)} F`);
      /* snow: the hourly rate, the load building over three days, and a Winter Storm Warning */
      if (r.snow >= TRIG.snow.rate0) add('snow', Math.min(TRIG.snow.cap, r.snow / TRIG.snow.per), `snow ${D1(r.snow)} in an hour`);
      if (snow72 >= TRIG.snow.tot) add('snow', TRIG.snow.add, `${Math.round(snow72)} in of snow in 72 hours`);
      if (snowing && has(/Winter Storm Warning|Blizzard/i)) add('snow', TRIG.snow.warn, 'Winter Storm Warning');
      /* thunderstorms (desert monsoon, dry lightning), hail, and flash flood warnings */
      if (thun >= TRIG.storm.thun0) add('storm', TRIG.storm.thun * thun / 100, `thunder ${thun}%`);
      if (hail) add('storm', TRIG.storm.hail, 'hail possible');
      if (dwind) add('storm', TRIG.storm.dwind, 'damaging wind possible');
      if (has(/Flash Flood Warning/i)) add('rain', TRIG.storm.ffw, 'Flash Flood Warning');
      const kinds = KINDS.filter(k => trig[k] > 0);
      /* the work window */
      const heat = isN(h.tempF) && isN(rh) ? heatIndex(h.tempF, rh) : h.tempF;
      let work = 'good'; const wwhy = []; const set = (lv, w) => { if (lv === 'blocked' || work === 'good') work = lv; if (!wwhy.includes(w)) wwhy.push(w); };
      if (pop >= 50) set('blocked', `rain ${pop}%`); else if (pop >= 25) set('marginal', `rain ${pop}%`);
      if (snowing) set('blocked', 'snow');
      if (thun >= 30) set('blocked', 'lightning');
      if (isN(gust) && gust >= 30) set('blocked', `gusts ${Math.round(gust)} mph`); else if (isN(gust) && gust >= 22) set('marginal', `gusts ${Math.round(gust)} mph`);
      if (isN(h.tempF) && h.tempF >= 95) set('marginal', `high heat procedures (${Math.round(h.tempF)} F)`);
      if (isN(h.tempF) && h.tempF <= 32) set('marginal', 'frost or ice on the deck');
      if (has(/Red Flag Warning/i)) set('marginal', 'Red Flag Warning: no torch or hot work');
      if (smoke || has(/Air Quality|Dense Smoke/i)) set('marginal', 'smoke');
      if (!h.isDay && work === 'good') work = 'night';
      const hol = holiday(P.date);
      return { t: h.t, date: P.date, h: P.h, dow, tempF: h.tempF, heat, rh, pop, thun, gust, dir: isN(dir) ? +dir : null, rain: r.rain, rain24, snow: r.snow, snow72, short: h.short, base: BASE[dow][P.h], ai: BASE[dow][P.h], wx: risk, hol: hol || '', why, risk, trig, kinds, work, wwhy, isDay: h.isDay, alerts: live.map(a => a.event) };
    });
    CACHE[pi] = out; return out;
  }
  /* NWS heat index (Rothfusz regression); in dry heat it sits near the air temperature */
  function heatIndex(T, R) { if (T < 80) return T; return -42.379 + 2.04901523 * T + 10.14333127 * R - 0.22475541 * T * R - 0.00683783 * T * T - 0.05481717 * R * R + 0.00122874 * T * T * R + 0.00085282 * T * R * R - 0.00000199 * T * T * R * R; }
  const level = r => r >= 2.0 ? 'high' : r >= 1.4 ? 'elevated' : r >= 0.8 ? 'normal' : 'low';
  /* windows: runs of trigger hours (demand after) per point, with the kinds of weather behind them */
  function windows(pi) {
    const H = hourly(pi); const out = []; let cur = null;
    H.forEach(x => { const hot = x.risk >= 1.4; if (hot && cur && x.date === cur.date && x.h === cur.end + 1) { cur.end = x.h; cur.peak = Math.max(cur.peak, x.risk); x.why.forEach(w => { if (!cur.why.includes(w)) cur.why.push(w); }); x.kinds.forEach(k => { cur.trig[k] = Math.max(cur.trig[k] || 0, x.trig[k]); }); } else if (hot) { cur = { date: x.date, dow: x.dow, start: x.h, end: x.h, peak: x.risk, why: x.why.slice(), trig: Object.assign({}, x.trig) }; out.push(cur); } });
    return out.map(w => { const kinds = KINDS.filter(k => w.trig[k] > 0).sort((a, b) => w.trig[b] - w.trig[a]); return Object.assign(w, { level: level(w.peak), bid: w.peak >= 2.0 ? 25 : 15, kinds, kind: kinds[0] || 'wind' }); });
  }
  function workDays(pi) {
    const H = hourly(pi).filter(x => x.isDay); const by = {};
    H.forEach(x => { const o = by[x.date] = by[x.date] || { date: x.date, dow: x.dow, good: 0, marginal: 0, blocked: 0, why: x.hol ? [x.hol] : [], hol: x.hol || '' }; o[x.work === 'night' ? 'good' : x.work] += 1; x.wwhy.forEach(w => { const k = w.split(' ')[0]; const j = o.why.findIndex(q => q.split(' ')[0] === k && /^(rain|gusts|high)$/.test(k)); if (j >= 0) { if ((parseFloat(w.replace(/[^0-9.]/g, '')) || 0) > (parseFloat(o.why[j].replace(/[^0-9.]/g, '')) || 0)) o.why[j] = w; } else if (!o.why.includes(w)) o.why.push(w); }); });
    return Object.values(by).map(o => Object.assign(o, { verdict: o.blocked >= 4 ? 'no tear offs' : o.blocked + o.marginal >= 4 ? 'repairs and inspections' : 'full production' }));
  }
  /* rain and snow ahead at a point, from the gridded forecast: inches in the next 24 and 72 hours, and the top gust */
  function totals(pi) { const H = hourly(pi); const s = (n, k) => sum(H.slice(0, n).map(x => x[k] || 0)); const g = H.slice(0, 72).map(x => x.gust).filter(isN); return { rain24: s(24, 'rain'), rain72: s(72, 'rain'), snow24: s(24, 'snow'), snow72: s(72, 'snow'), gust72: g.length ? Math.max(...g) : null, tmax72: Math.max(...H.slice(0, 72).map(x => isN(x.tempF) ? x.tempF : -99)), rhmin72: Math.min(...H.slice(0, 72).map(x => isN(x.rh) ? x.rh : 999)) }; }
  /* ---------- playbooks: what a roofer does when each kind of trigger fires. Law lines are from the California register (module 03). ---------- */
  const LAW = {
    gouge: 'After a federal, state or local emergency declaration a contractor may not charge more than 10 percent above its own price from before the declaration for repair or reconstruction for 180 days, and building materials are capped the same way for 30 days (Penal Code 396).',
    lic: 'Contracting without a licence on damage from a declared disaster can be charged as a felony (Business and Professions Code 7028.16).',
    cancel: 'A contract to repair a home damaged in a declared emergency carries a seven business day right to cancel; the ordinary right is three business days, five for a senior (Business and Professions Code 7159).',
    down: 'The down payment may not exceed $1,000 or 10 percent of the price, whichever is less, and no payment may run ahead of work done; in a declared disaster area the court must impose the maximum fine (Business and Professions Code 7159.5).',
    ded: 'Never offer or advertise a discount meant to offset the deductible, and never pay an agent, broker or adjuster for a referral (Penal Code 551).',
    adj: 'Negotiating a claim with the insurer for pay is public adjusting and needs that licence (Insurance Code 15006 and 15007). Write the estimate and the scope; do not offer to handle the claim.',
    heat: 'Outdoor heat rule: a quart of water an hour for each worker, shade when it is over 80 F, high heat procedures at 95 F or more (Title 8, section 3395).',
    fall: 'Residential roofing needs fall protection at 6 feet or more on slopes up to 7:12 and at any height on steeper roofs (Title 8, section 1731, since July 1, 2025).',
  };
  const PLAY = {
    rain: { name: 'Rain and atmospheric rivers', line: 'repair', lines: ['repair', 'storm'],
      before: 'Two to three days ahead: stock tarps, sandbags for flat roof drains, sealant and pumps; clear gutters and scuppers on open jobs; dry in every open deck by the night before, or do not start the tear off. Call customers with roofs on the leak watch list.',
      during: 'Crews stay off wet roofs. Staff the phones for leak calls and book them in order; tarp only where it can be done safely. Leak repair ads stay on; replacement ads keep running.',
      after: 'For 72 hours after the window: leak repair and inspection ads in the ZIPs the rain covered, with the bid lift. Leak calls keep coming for days because owners find stains late. Re-roof enquiries follow in the weeks after a wet winter.',
      law: [LAW.cancel, LAW.adj, LAW.ded] },
    wind: { name: 'Offshore wind and high wind', line: 'storm', lines: ['storm', 'repair'],
      before: 'Secure loose material, tie down or ground the stacks, pull dumpsters back from the eaves. No tear offs once gusts pass 30 mph. On tile and shake jobs, close the field before the wind arrives.',
      during: 'Crews stay off roofs in gusts over 30 mph. Dry offshore wind is also fire weather: no torch work, no cutting that throws sparks, a charged hose or extinguisher at every job.',
      after: 'For 72 hours: wind damage repair and inspection ads where gusts of 58 mph or more were measured (module 02 shows the reports). Lifted shingles, slipped tile, ridge caps and flashing are the calls. Offer inspections, not outcomes.',
      law: [LAW.adj, LAW.ded, LAW.fall] },
    fire: { name: 'Fire weather (Red Flag Warning)', line: 'harden', lines: ['harden'],
      before: 'A Red Flag Warning is a day for crew safety first: no hot work (torch applied membranes, kettles, grinding), vehicles off dry grass, and a plan to leave. Jobs in the warned zones should be closed up by the afternoon before.',
      during: 'Do not advertise into fear while a fire burns. Hardening messages (Class A assembly, ember resistant vents, gutters and the first five feet) run as education in the warned zones only when no fire is burning there, and stop the moment an evacuation is ordered.',
      after: 'After a fire: wait for the area to reopen, then inspections by request. Smoke and ember damage is repair work; total losses are rebuild work on a long clock. The disaster rules on price, licence, contracts and claims below apply from the declaration.',
      law: [LAW.gouge, LAW.lic, LAW.cancel, LAW.down, LAW.adj, LAW.ded] },
    heat: { name: 'Heat', line: 'coat', lines: ['coat', 'comm'],
      before: 'Shift the start to first light and plan the tear off to finish before early afternoon. Check water, shade and the written heat plan. Shingles scuff and sealant strips grab early in heat; adjust staging.',
      during: 'Follow the outdoor heat rule on every roof. At 95 F and above use the high heat procedures; watch new and returning workers closely.',
      after: 'No demand lift is assumed from heat alone. It is the season to talk about reflective re-roofs and coatings on low slope roofs inland, where the Energy Code already asks for them on a re-roof.',
      law: [LAW.heat] },
    snow: { name: 'Mountain snow', line: 'repair', lines: ['repair', 'storm'],
      before: 'Close every open roof before the storm. Tell mountain customers who to call for snow removal and what you will not do (judge the structure).',
      during: 'No roof work in falling snow or on iced decks. Take the calls: ice dams, leaks at valleys and penetrations, bent metal.',
      after: 'Once roads open: leak and damage repair in the snow towns, and structural worries go to an engineer first. The roof collapses of the winter of 2023 came after a series of storms, not after one.',
      law: [LAW.cancel, LAW.fall] },
    storm: { name: 'Thunderstorms and flash floods', line: 'storm', lines: ['storm', 'repair'],
      before: 'Rare outside the deserts and mountains. Close open decks; lightning ends roof work.',
      during: 'Crews off the roof at 30 percent thunder or more. Burn scars send debris flows downhill in short, heavy rain: keep crews and trucks out of the canyons below them.',
      after: 'Leak repair ads for 72 hours where warnings were issued. Hail large enough to damage a roof is reported about six days a year in the whole state: inspect only on request.',
      law: [LAW.adj, LAW.ded] },
  };
  /* ---------- alerts mapped to roofing actions (the first pattern that matches wins) ---------- */
  const ALERT_MAP = [
    [/Evacuation|Fire Warning|Shelter In Place|Civil Emergency|Law Enforcement/i, 'Evacuation', 'Stop all outreach to the area: no ads, no calls, no door knocking. Account for crews and get them out. Nothing is sold into an evacuation zone until it reopens.', 'fire'],
    [/Red Flag Warning|Fire Weather Watch/i, 'Fire weather', 'Crew safety first: no torch or kettle work and nothing that throws sparks, trucks off dry grass, close up jobs in the warned zones. Hardening messages may run as education where no fire is burning; never fear. If a fire follows, the disaster rules apply: prices held within 10 percent of the pre emergency price (Penal Code 396), a licence for every job (Business and Professions Code 7028.16), seven business days to cancel a disaster repair contract (7159).', 'fire'],
    [/High Wind|Wind Advisory|Extreme Wind|Lake Wind/i, 'Wind', 'Gusts over 30 mph: no tear offs, secure material and stacks. After the event, repair and inspection ads for lifted shingles and slipped tile in the warned zones; with dry offshore wind treat the day as fire weather too.', 'wind'],
    [/High Surf|Coastal Flood|Beach Hazards|Rip Current|Sneaker|Small Craft|Gale|Marine|Tsunami/i, 'Coast', 'No roofing effect inland of the beach. Salt spray days are hard on fresh coatings near the water.', ''],
    [/Flash Flood|Debris Flow/i, 'Flash flood and debris flow', 'Keep crews and trucks out of canyons and off roads below burn scars. Flood damage is not roof damage: no flood imagery. Short, heavy rain finds weak flashing, so leak repair ads earn their keep for the next 72 hours.', 'rain'],
    [/Flood Watch|Flood Warning|Flood Advisory|Flood Statement|Hydrologic|Atmospheric River/i, 'Rain and flood', 'An atmospheric river or a long rain: tarps and dry in on every open job before it arrives, phones staffed for leak calls during it, leak repair and inspection ads in the covered ZIPs for 72 hours after it. Keep replacement ads running.', 'rain'],
    [/Winter Storm|Blizzard|Winter Weather|Heavy Snow|Snow Squall|Ice Storm|Avalanche/i, 'Snow', 'No roof work in falling snow or on iced decks. In the snow towns expect ice dam and leak calls, and after many storms in a row, load worries: those go to an engineer before a roofer.', 'snow'],
    [/Heat Advisory|Excessive Heat|Extreme Heat/i, 'Heat', 'Start at first light and stop tear offs by early afternoon. Water, shade above 80 F and high heat procedures at 95 F or more are required for outdoor work (Title 8, section 3395).', 'heat'],
    [/Air Quality|Dense Smoke|Smoke|Dust|Ashfall/i, 'Smoke and air quality', 'Wildfire smoke or dust: shorten shifts, move strenuous work, offer respirators where the air is unhealthy, and reschedule coatings and adhesives that need clean, dry air. Not a time for sales messages about the fire.', 'fire'],
    [/Dense Fog|Freezing Fog/i, 'Fog', 'Tule fog and marine layer: late starts, wet decks until it burns off, slow drives. No roofing demand effect.', ''],
    [/Severe Thunderstorm|Tornado|Special Weather/i, 'Thunderstorm', 'Crews off the roof. Read the hail size and gust in the warning; with hail of 1 inch or more or gusts of 58 mph or more, log the warned ZIPs and offer inspections there once it passes.', 'storm'],
    [/Freeze|Frost|Cold Weather|Wind Chill/i, 'Frost', 'No work on frosted or iced decks; adhesives and sealant strips need warmth to bond. Start late.', ''],
  ];
  const actionFor = ev => { const m = ALERT_MAP.find(([re]) => re.test(ev)); return m ? { kind: m[1], text: m[2], play: m[3] || '' } : { kind: 'Other', text: 'Read the alert; no standing action.', play: '' }; };
  /* ---------- live refresh (outside the viewer only) ---------- */
  async function gj(u) { const r = await fetch(u, { headers: { Accept: 'application/geo+json' } }); if (!r.ok) throw new Error(r.status + ' ' + u); return r.json(); }
  const GRID_KEYS = ['probabilityOfThunder', 'quantitativePrecipitation', 'windGust', 'windSpeed', 'windDirection', 'probabilityOfPrecipitation', 'visibility', 'snowfallAmount', 'snowLevel', 'relativeHumidity', 'skyCover'];
  async function refresh(onStep) {
    if (inViewer()) throw new Error('The Claude viewer blocks live calls to api.weather.gov; showing the embedded snapshot.');
    const pts = [];
    for (const [city, lat, lon, reg] of PTS0) { onStep && onStep(city); const P = (await gj(`https://api.weather.gov/points/${lat},${lon}`)).properties; const tail = s => String(s || '').split('/').pop();
      const rec = { city, lat, lon, reg, office: P.gridId, gridX: P.gridX, gridY: P.gridY, zone: tail(P.forecastZone), county: tail(P.county), fireZone: tail(P.fireWeatherZone), radar: P.radarStation };
      const [f, h, g] = await Promise.all([gj(P.forecast), gj(P.forecastHourly), gj(P.forecastGridData)]);
      rec.updated = f.properties.updateTime || f.properties.updated; rec.periods = f.properties.periods.map(x => ({ name: x.name, start: x.startTime, end: x.endTime, isDay: x.isDaytime, tempF: x.temperature, short: x.shortForecast, pop: (x.probabilityOfPrecipitation || {}).value || 0, wind: x.windSpeed, detail: String(x.detailedForecast || '').slice(0, 300) }));
      rec.hourly = h.properties.periods.slice(0, 120).map(x => ({ t: x.startTime, tempF: x.temperature, rh: (x.relativeHumidity || {}).value, pop: (x.probabilityOfPrecipitation || {}).value || 0, wind: x.windSpeed, short: x.shortForecast, isDay: x.isDaytime }));
      const gp = g.properties; rec.grid = {}; GRID_KEYS.forEach(k => rec.grid[k] = ((gp[k] || {}).values || []).slice(0, 72).map(v => [v.validTime, v.value])); rec.grid.weather = ((gp.weather || {}).values || []).slice(0, 72).map(v => [v.validTime, [...new Set((v.value || []).map(w => (w.weather || '') + (w.intensity ? ':' + w.intensity : '') + (w.attributes && w.attributes.length ? '[' + w.attributes.join('|') + ']' : '')).filter(x => x && x !== 'null'))].join(', ')]);
      pts.push(rec); }
    const a = await gj(`https://api.weather.gov/alerts/active?area=${AREA}`);
    D = Object.assign({}, D, { fetched: new Date().toISOString(), source: 'api.weather.gov, live (forecast points and alerts); outlooks, observations and discussions from the embedded snapshot', points: pts, alerts: (a.features || []).map(x => { const p = x.properties; const prm = p.parameters || {}; const gc = p.geocode || {}; return { id: p.id, event: p.event, severity: p.severity, urgency: p.urgency, headline: p.headline, description: String(p.description || '').slice(0, 1500), instruction: String(p.instruction || '').slice(0, 800), onset: p.onset, ends: p.ends, expires: p.expires, areas: p.areaDesc, sent: p.sent, hail: (prm.maxHailSize || [null])[0], gust: (prm.maxWindGust || [null])[0], zones: gc.UGC || [], fips: (gc.SAME || []).map(fips5), sender: p.senderName }; }) });
    LIVE = true; CACHE = {}; BUS.emit('nws'); return D;
  }
  /* campaign token for a service line (the Desk and the Accounts importer read CA_<TOKEN>_ names) */
  const tokOf = line => { const l = (typeof PLI !== 'undefined' && PLI[line]) || null; return String((l && l.tok) || line || 'STORM').toUpperCase().replace(/[^A-Z]+/g, ''); };
  const campaign = (line, city) => `CA_${tokOf(line)}_GOOGLE_${String(REGN[REGOF[city]] || city).toUpperCase().replace(/[^A-Z]+/g, '_').replace(/^_|_$/g, '')}`;
  function scheduleCSV() {
    const rows = []; D.points.forEach((p, i) => windows(i).forEach(w => { const line = (PLAY[w.kind] || PLAY.wind).line; rows.push([campaign(line, p.city), p.city, REGN[REGOF[p.city]] || '', w.date, w.start, w.end + 1, w.level, w.bid, D_(w.peak), w.why.join('; '), w.kinds.join(' '), line]); }));
    return toCSV(['campaign', 'point', 'region', 'date', 'start_hour', 'end_hour', 'storm_level', 'bid_adjustment_pct_next_72h', 'peak_storm_index', 'reasons', 'trigger_kinds', 'service_line'], rows, `Weather trigger windows from the NWS forecast (${D.fetched || 'no snapshot'}). Bids apply to the 72 hours after a window passes, when owners look for roofers; hours are Pacific time. Fire weather windows are for crew safety and education only: no bid lift is applied to them in the Desk without a person's decision.`);
  }
  const D_ = v => +(+v).toFixed(2);
  const D1 = v => (+v).toFixed(1);
  return { get D() { return D; }, get live() { return LIVE; }, TZ, TZL, AREA, PTS0, REGOF, OFFICES, HOL, SEASONS, seasonsOf, TRIG, KINDS, PLAY, LAW, hh, partsOf, when, holiday, BASE, BASE_AI, hourly, windows, workDays, totals, alertsAt, level, actionFor, ALERT_MAP, refresh, scheduleCSV, campaign, gridAt, gridRate, offshore, heatIndex };
})();
