/* ==== live/climate.js ==== */
/* Pure reads of the climate records: the heating season to date against normal (metro, counties, stations), where the first
   freeze stands, the cold exposure of a place, and one honest sentence about it. Inputs are the weekly record of the
   acis_season collector (data) and the static baseline baked into the build (base: window.__CLIMATE_BASE__, written by
   tools/climate-base.mjs). No DOM, no network; runs in the page, the background worker and Node. Every function is safe on
   missing input: null means unknown, never zero.
   Grades: station observations and official normals are the publishers' own numbers (A); ranks, first freeze chances and
   borrowed climatology rest on them with known gaps (B); anything read from the PRISM grid is modeled (C). */
(function (root) {
  'use strict';
  const L = root.TDA_LIVE;
  const DFW = '29755', DAY = 864e5, TZ = 'America/Chicago';
  /* PRISM (ACIS grid 21) over the metro box: 40 rows from the south, 62 columns from the west, cell centres 1/24 degree apart */
  const GEOM = { ny: 40, nx: 62, lat0: 32.0, lon0: -98.333333, step: 1 / 24 };
  const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  /* counties next to the 12 that have a station inside the box (FIPS as ACIS returns them) */
  const NEAR = { '48143': 'Erath', '48213': 'Henderson', '48217': 'Hill', '48223': 'Hopkins', '48237': 'Jack', '48337': 'Montague', '48349': 'Navarro', '48363': 'Palo Pinto', '48379': 'Rains', '48425': 'Somervell', '48467': 'Van Zandt' };
  const WHAT = { W1: 'daily lows and highs at the airports', W2: 'the station table', W3: 'the same span in 30 past falls', G1: 'the grids and county means', G2: 'the 30 fall mean for the grids' };
  const GRADES = { metro: 'A', stations: 'A', series: 'A', rank: 'B', firstFreeze: 'B', counties: 'C', zip: 'C' };
  const CREDIT = ['NOAA Regional Climate Centers, ACIS', 'NOAA National Centers for Environmental Information, U.S. Climate Normals 1991 to 2020', 'PRISM Climate Group, Oregon State University'];

  /* ---------- small tools ---------- */
  const fin = v => typeof v === 'number' && Number.isFinite(v);
  const nn = v => (v == null || (typeof v === 'number' && !Number.isFinite(v)) ? null : v);
  const rd = (v, dp) => { if (!fin(v)) return null; const k = Math.pow(10, dp || 0); return Math.round(v * k) / k; };
  const isDay = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
  const ms = ymd => Date.parse(ymd + 'T12:00:00Z');
  const addDays = (ymd, n) => new Date(ms(ymd) + n * DAY).toISOString().slice(0, 10);
  const between = (a, b) => Math.round((ms(a) - ms(b)) / DAY);                                   /* a minus b, in days */
  const seasonOf = ymd => +ymd.slice(0, 4) - (+ymd.slice(5, 7) < 7 ? 1 : 0);
  const leap = y => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  /* "11/24" or "11-24" as a date inside the season that starts July 1 of `season` */
  const inSeason = (md, season) => { const m = md.slice(0, 2), y = +m >= 7 ? season : season + 1, d = m === '02' && md.slice(3, 5) === '29' && !leap(y) ? '28' : md.slice(3, 5); return y + '-' + m + '-' + d; };
  const dos = ymd => between(ymd, seasonOf(ymd) + '-07-01');                                      /* day of season, July 1 = 0 */
  const fromDos = (n, season) => addDays(season + '-07-01', n);
  const pretty = ymd => (isDay(ymd) ? MONTH[+ymd.slice(5, 7) - 1] + ' ' + (+ymd.slice(8, 10)) : '');
  function localDay(now) {
    try { const p = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(now)).reduce((o, x) => (o[x.type] = x.value, o), {}); return `${p.year}-${p.month}-${p.day}`; }
    catch (e) { return new Date(now).toISOString().slice(0, 10); }
  }
  const mean = a => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
  /* of a sorted list: the median (the mean of the middle two when the count is even) and the value at the nearest rank of a quantile */
  const median = b => (b.length ? (b.length % 2 ? b[(b.length - 1) / 2] : (b[b.length / 2 - 1] + b[b.length / 2]) / 2) : null);
  const rankAt = (b, q) => (b.length ? b[Math.round(q * (b.length - 1))] : null);
  /* a half rounds to the even neighbour, so a median between two dates and a chance of 22.5 do not always round the same way */
  const rhe = x => { const f = Math.floor(x), r = x - f; return r > 0.5 ? f + 1 : r < 0.5 ? f : f % 2 ? f + 1 : f; };
  const km = (a, b, c, d) => { const R = 6371, p = Math.PI / 180, x = Math.sin((c - a) * p / 2) ** 2 + Math.cos(a * p) * Math.cos(c * p) * Math.sin((d - b) * p / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
  const ORD = ['', '', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];
  const nth = k => (k === 1 ? '' : ORD[k] || k + (k % 10 === 1 && k % 100 !== 11 ? 'st' : k % 10 === 2 && k % 100 !== 12 ? 'nd' : k % 10 === 3 && k % 100 !== 13 ? 'rd' : 'th'));
  /* a day's heating degree days the way ACIS and the Weather Service count them: the mean of high and low rounded half up first */
  const hddOf = (tn, tx) => (fin(tn) && fin(tx) ? Math.max(0, 65 - Math.floor((tx + tn) / 2 + 0.5)) : null);
  /* index of a calendar day in a 366 value list that starts January 1 and holds February 29 */
  const CUM = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];
  const doy366 = ymd => CUM[+ymd.slice(5, 7) - 1] + (+ymd.slice(8, 10)) - 1;

  /* ---------- grids ---------- */
  /* A stored grid is one flat list, row by row from the south, each row west to east (see GEOM; a block's own ny, nx, lat0,
     lon0 and step can be passed as geom). sample: the value at a place, interpolated between the four cell centres around
     it; null outside the box the grid covers, or where a cell around it is missing. cell: the one cell the place falls in. */
  function locate(g, lat, lon, geom) {
    const q = geom && geom.ny && geom.nx ? geom : GEOM, s = q.step || GEOM.step;
    if (!Array.isArray(g) || g.length !== q.ny * q.nx || !fin(lat) || !fin(lon)) return null;
    const fy = (lat - q.lat0) / s, fx = (lon - q.lon0) / s;
    return fy < -0.5 || fy > q.ny - 0.5 || fx < -0.5 || fx > q.nx - 0.5 ? null : { fy, fx, ny: q.ny, nx: q.nx };
  }
  function sample(g, lat, lon, geom) {
    const p = locate(g, lat, lon, geom); if (!p) return null;
    const j = Math.max(0, Math.min(p.ny - 2, Math.floor(p.fy))), i = Math.max(0, Math.min(p.nx - 2, Math.floor(p.fx))), ty = Math.min(1, Math.max(0, p.fy - j)), tx = Math.min(1, Math.max(0, p.fx - i));
    const a = g[j * p.nx + i], b = g[j * p.nx + i + 1], c = g[(j + 1) * p.nx + i], d = g[(j + 1) * p.nx + i + 1];
    if (!fin(a) || !fin(b) || !fin(c) || !fin(d) || a === -999 || b === -999 || c === -999 || d === -999) return null;
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  }
  function cell(g, lat, lon, geom) {
    const p = locate(g, lat, lon, geom); if (!p) return null;
    const v = g[Math.max(0, Math.min(p.ny - 1, Math.round(p.fy))) * p.nx + Math.max(0, Math.min(p.nx - 1, Math.round(p.fx)))];
    return fin(v) && v !== -999 ? v : null;
  }

  /* ---------- the weekly record ---------- */
  const read = data => (data && data.v === 1 && data.blocks && typeof data.blocks === 'object' ? data : null);
  const baseOf = base => base || root.__CLIMATE_BASE__ || null;
  function rowsOf(d) {
    const cols = (d && d.std && d.std.cols) || [];
    return u => { const r = d && d.std ? d.std[u] : null; if (!Array.isArray(r)) return null; const o = {}; cols.forEach((c, i) => { o[c] = nn(r[i]); }); return o; };
  }
  /* stations that pass the quality gate, with a place: what the nearest station rules choose from */
  function okStations(d) {
    const row = rowsOf(d), out = [];
    for (const u of Object.keys((d && d.stations) || {})) { const st = d.stations[u], s = row(u); if (s && s.ok && fin(st.lat) && fin(st.lon)) out.push({ uid: u, st, s }); }
    return out;
  }
  /* the three nearest of a list to a place, weight 1 / max(km, 1)² */
  function nearest3(list, lat, lon) {
    if (!fin(lat) || !fin(lon)) return [];
    return list.map(x => ({ x, km: km(lat, lon, x.st.lat, x.st.lon) })).sort((a, b) => a.km - b.km).slice(0, 3).map(o => ({ x: o.x, km: o.km, w: 1 / Math.pow(Math.max(o.km, 1), 2) }));
  }
  const idw = (near, get) => { let s = 0, w = 0; for (const o of near) { const v = get(o.x); if (fin(v)) { s += v * o.w; w += o.w; } } return w ? s / w : null; };

  /* ---------- first freeze climatology ---------- */
  /* Where the first 32°F of autumn usually falls at a station, for the season in hand. In order: the official NCEI dates by which
     it has happened in 10, 20 … 90 percent of years; the station's own 30 seasons from ACIS when at least 10 are usable; the
     official dates of the nearest normals station within 40 km (and the result says whose they are). */
  function climOf(base, st, uid, season) {
    if (!base || season == null) return null;
    const dec = n => (n && Array.isArray(n.first32) && n.first32.length === 9 && n.first32.every(x => typeof x === 'string' && x.length === 5) ? n.first32.map(x => inSeason(x, season)) : null);
    const own = st && st.ghcn && base.ncei ? dec(base.ncei[st.ghcn]) : null;
    if (own) return { src: 'NCEI', from: null, dec: own, median: own[4], p10: own[0], p90: own[8], n: 30 };
    const f = base.freeze && uid != null ? base.freeze[uid] : null;
    if (f && Array.isArray(f.first) && Array.isArray(f.miss)) {
      const use = f.miss.map((m, k) => (m != null && m <= 10 ? k : -1)).filter(k => k >= 0), offs = use.filter(k => isDay(f.first[k])).map(k => between(f.first[k], (1991 + k) + '-07-01')).sort((a, b) => a - b);
      if (use.length >= 10 && offs.length >= 10) return { src: 'ACIS', from: null, offs, n: use.length, median: fromDos(rhe(median(offs)), season), p10: fromDos(rankAt(offs, 0.1), season), p90: fromDos(rankAt(offs, 0.9), season) };
    }
    if (st && fin(st.lat) && fin(st.lon) && base.ncei) {
      let best = null;
      for (const g of Object.keys(base.ncei)) { const n = base.ncei[g], d = dec(n); if (!d || !fin(n.lat) || !fin(n.lon)) continue; const k = km(st.lat, st.lon, n.lat, n.lon); if (k <= 40 && (!best || k < best.km)) best = { km: k, n, d }; }
      if (best) return { src: 'NCEI nearby', from: best.n.label || best.n.name || null, km: rd(best.km, 0), dec: best.d, median: best.d[4], p10: best.d[0], p90: best.d[8], n: 30 };
    }
    return null;
  }
  /* The share of years (percent) in which the first freeze had happened by a date: read between the decile dates, or counted
     in the station's own seasons. Before the 10 percent date and after the 90 percent date only the bound is known. */
  function chanceBy(c, date) {
    if (!c || !isDay(date)) return { v: null, text: null };
    if (c.dec) {
      const d = c.dec; if (date < d[0]) return { v: null, text: 'under 10' }; if (date > d[8]) return { v: null, text: 'over 90' };
      let k = 0; while (k < 7 && date >= d[k + 1]) k++;
      const w = between(d[k + 1], d[k]), v = rhe(10 * (k + 1) + (w > 0 ? 10 * Math.min(1, between(date, d[k]) / w) : 10));
      return { v, text: String(v) };
    }
    if (c.offs && c.n) { const x = dos(date), v = rhe(100 * c.offs.filter(o => o <= x).length / c.n); return { v, text: String(v) }; }
    return { v: null, text: null };
  }
  /* First freeze status of one station (spec section 8, item 6). s: its row, ok: it passes the gate, T: the through date. */
  function freezeOf(base, st, uid, s, ok, T, season) {
    if (!s || !isDay(T)) return null;
    const c = climOf(base, st, uid, season), clim = { median: c ? c.median : null, p10: c ? c.p10 : null, p90: c ? c.p90 : null, src: c ? c.src : null, from: c ? c.from : null, seasons: c ? c.n : null };
    if (isDay(s.firstFreeze)) return Object.assign({ state: 'occurred', date: s.firstFreeze, daysVsMedian: c ? between(s.firstFreeze, c.median) : null, climChance: null, climText: null, daysToMedian: null }, clim);
    if (!ok) return null;                                             /* gaps: "none reported" is not "none happened" */
    const next = addDays(T, 1), ch = chanceBy(c, next);
    return Object.assign({ state: 'pending', date: null, daysVsMedian: null, climChance: ch.v, climText: ch.text, daysToMedian: c ? between(c.median, next) : null }, clim);
  }

  /* ---------- the accumulation curve ---------- */
  /* One station's season day by day: low, high, that day's heating degree days, the running total and (where the baseline has
     daily normals for the station: DFW Airport) the running normal. uid: an ACIS station number, default DFW Airport. */
  function series(data, base, uid) {
    const d = read(data), B = baseOf(base), u = String(uid == null ? DFW : uid), D = d && d.daily;
    const tn = D && D.tn ? D.tn[u] : null, tx = D && D.tx ? D.tx[u] : null; if (!Array.isArray(tn) || !Array.isArray(tx) || !isDay(D.start)) return null;
    const st = (d.stations && d.stations[u]) || {}, N = B && B.dailyNormHdd && Array.isArray(B.dailyNormHdd.byDay) && B.dailyNormHdd.byDay.length === 366 && st.ghcn && B.dailyNormHdd.station === st.ghcn ? B.dailyNormHdd.byDay : null;
    const days = []; let cum = 0, norm = 0, missing = 0;
    for (let i = 0; i < tn.length; i++) {
      const day = addDays(D.start, i), h = hddOf(tn[i], tx[i]); if (h == null) missing++; else cum += h;
      if (N) norm += N[doy366(day)] || 0;
      days.push({ d: day, tn: nn(tn[i]), tx: nn(tx[i]), hdd: h, cum, normCum: N ? rd(norm, 1) : null });
    }
    return { station: st.label || st.name || null, uid: u, start: D.start, through: days.length ? days[days.length - 1].d : null, days, total: cum, normTotal: N ? rd(norm, 1) : null, missing };
  }
  /* The last n observed nights at every airport the collector reads daily: [{ uid, name, icao, county, nights: [{ d, tn, tx }] }] */
  function nights(data, n) {
    const d = read(data), D = d && d.daily, G = L.geo || {}, names = {}; (G.counties || []).forEach(c => { names[c.fips] = c.name; });
    if (!D || !D.tn || !isDay(D.start)) return [];
    return Object.keys(D.tn).map(u => { const st = (d.stations && d.stations[u]) || {}, lo = D.tn[u] || [], hi = (D.tx && D.tx[u]) || [], from = Math.max(0, lo.length - (n || 14)); return { uid: u, name: st.label || st.name || null, icao: st.icao || null, county: names[st.fips] || NEAR[st.fips] || null, nights: lo.slice(from).map((v, i) => ({ d: addDays(D.start, from + i), tn: nn(v), tx: nn(hi[from + i]) })) }; });
  }

  /* ---------- the season to date ---------- */
  function status(data, base, now) {
    base = baseOf(base);
    const d = read(data), B = d ? d.blocks : {}, G = L.geo || {}, C12 = {}; (G.counties || []).forEach(c => { C12[c.fips] = c.name; });
    const T = d && isDay(B.W2) ? B.W2 : null, season = d && fin(d.season) ? d.season : null, row = rowsOf(d);
    const gateOct = T ? +T.slice(5, 7) >= 10 || +T.slice(5, 7) <= 6 : true, falls = d && d.todate && B.W3 && B.W3 === B.W2 ? d.todate : null;
    const gridOn = !!(d && d.county && isDay(B.G1)), normOn = gridOn && B.G2 === B.G1;
    const today = now != null ? localDay(now) : null, through = d ? (T || nn(d.through)) : null, ageDays = isDay(through) && today ? between(today, through) : null;
    const P = base && base.prism && Array.isArray(base.prism.hdd) ? base.prism : null, metroHdd = base && base.metro && fin(base.metro.hdd) ? base.metro.hdd : null;
    const dfwSt = (d && d.stations && d.stations[DFW]) || (base && base.stations && base.stations[DFW]) || { lat: 32.89744, lon: -97.02196, ghcn: 'USW00003927' };
    const dfwN = base && base.ncei ? base.ncei[dfwSt.ghcn] || null : null, dfwP = P ? sample(P.hdd, dfwSt.lat, dfwSt.lon, P) : null, dfwPf = P ? sample(P.fr32, dfwSt.lat, dfwSt.lon, P) : null;

    /* one station, every definition of spec section 8 */
    function one(u) {
      const st = (d && d.stations && d.stations[u]) || {}, s = row(u) || {}, ok = !!s.ok, n = base && base.ncei && st.ghcn ? base.ncei[st.ghcn] || null : null;
      const hdd = ok ? nn(s.hdd) : null, norm = nn(s.hddNorm), ok7 = s.miss7 != null && s.miss7 <= 1, ok30 = s.miss30 != null && s.miss30 <= 3;
      const hdd7 = ok7 ? nn(s.hdd7) : null, hdd30 = ok30 ? nn(s.hdd30) : null, pctOf = (v, nm) => (v != null && nm != null && nm >= 25 ? Math.round(100 * v / nm) : null);
      /* rank among the usable falls 1991 to 2020 and this one: 1 is the lowest heating total to this date */
      let rank = null;
      const H = falls && falls.hdd && Array.isArray(falls.hdd[u]) ? falls.hdd[u].map((v, i) => (fin(v) ? { v, y: (falls.years || [])[i] } : null)).filter(Boolean) : [];
      if (hdd != null && H.length >= 10) {
        const lo = H.reduce((a, b) => (b.v < a.v ? b : a)), hi = H.reduce((a, b) => (b.v > a.v ? b : a)), below = 1 + H.filter(x => x.v < hdd).length, above = 1 + H.filter(x => x.v > hdd).length;
        rank = { n: below, of: H.length + 1, text: below <= above ? (nth(below) + ' lowest').trim() : (nth(above) + ' highest').trim(), mean: rd(mean(H.map(x => x.v)), 1), low: lo.v, lowYear: nn(lo.y), high: hi.v, highYear: nn(hi.y) };
      }
      /* freeze nights normal to date: the station's own falls when at least 15 are usable, else the county's grid value */
      const F = falls && falls.fr32 && Array.isArray(falls.fr32[u]) ? falls.fr32[u].filter(fin) : [], cw = normOn && d.county[st.fips] ? d.county[st.fips] : null;
      const fr32Norm = F.length >= 15 ? rd(mean(F), 2) : cw && fin(cw.fr32Norm) ? cw.fr32Norm : null;
      const pr = !n && P && fin(st.lat) ? sample(P.hdd, st.lat, st.lon, P) : null, pf = !n && P && fin(st.lat) ? sample(P.fr32, st.lat, st.lon, P) : null;
      const fz = base && base.freeze ? base.freeze[u] : null, record = fz && Array.isArray(fz.fr32) ? fz.fr32.filter(fin).length : null;      /* usable seasons of the 30, 1991 to 2020 */
      return { uid: String(u), name: st.label || st.name || null, acisName: st.name || null, icao: st.icao || null, ghcn: st.ghcn || null, county: C12[st.fips] || NEAR[st.fips] || null, metro: !!C12[st.fips], fips: st.fips || null, lat: nn(st.lat), lon: nn(st.lon), elev: nn(st.elev),
        ok, miss: gateOct ? nn(s.missOct) : nn(s.missJul), missSeason: nn(s.missJul), record,
        hdd, hddNorm: norm, pct: pctOf(hdd, norm), dep: hdd != null && norm != null ? hdd - norm : null, rank,
        hdd7, hdd7Norm: nn(s.hdd7Norm), pct7: pctOf(hdd7, nn(s.hdd7Norm)), hdd30, hdd30Norm: nn(s.hdd30Norm), pct30: pctOf(hdd30, nn(s.hdd30Norm)),
        fr32: ok ? nn(s.fr32) : null, fr25: ok ? nn(s.fr25) : null, fr32Norm, fr32NormFrom: F.length >= 15 ? 'station' : fr32Norm != null ? 'county' : null, freezeBy: F.length >= 15 ? { n: F.filter(v => v > 0).length, of: F.length } : null,
        minT: nn(s.minT), minDate: nn(s.minDate), min7: ok7 ? nn(s.min7) : null,
        firstFreeze: freezeOf(base, st, u, row(u), ok, T, season), lastFreeze: nn(s.lastFreeze), daysSinceFreeze: isDay(s.lastFreeze) && T ? between(T, s.lastFreeze) : null,
        normHdd: n && fin(n.hdd) ? n.hdd : null, normFr32: n && fin(n.d32) ? n.d32 : null,
        /* cold exposure against DFW Airport: official normals where the station has them, else the PRISM grid at both places */
        exposure: n && fin(n.hdd) && dfwN && fin(dfwN.hdd) ? { ratio: rd(n.hdd / dfwN.hdd, 3), freeze: fin(n.d32) && fin(dfwN.d32) && dfwN.d32 ? rd(n.d32 / dfwN.d32, 2) : null, src: 'NCEI' } : pr != null && dfwP ? { ratio: rd(pr / dfwP, 3), freeze: pf != null && dfwPf ? rd(pf / dfwPf, 2) : null, src: 'PRISM' } : null };
    }
    const uids = d && d.stations ? Object.keys(d.stations).filter(u => row(u)) : [];
    const stations = uids.map(one).sort((a, b) => (a.metro === b.metro ? 0 : a.metro ? -1 : 1) || String(a.county).localeCompare(String(b.county)) || String(a.name).localeCompare(String(b.name)));

    /* a county's first freeze: the earliest freeze any of its stations recorded; else the complete station there with the best
       climatology behind it (official dates first, then the longest record); else the nearest complete station outside it (nearby: true) */
    const grade = s => { const f = s.firstFreeze; return (f && f.src === 'NCEI' ? 300 : f && f.src === 'ACIS' ? 200 : f && f.src ? 100 : 0) + (s.record || 0) - (s.miss || 0) / 100; };
    function countyFreeze(c) {
      const inC = stations.filter(s => s.fips === c.fips), hit = inC.filter(s => s.firstFreeze && s.firstFreeze.state === 'occurred').sort((a, b) => (a.firstFreeze.date < b.firstFreeze.date ? -1 : 1));
      const okC = inC.filter(s => s.ok), meta = { stationsOk: okC.length, stationsWithFreeze: hit.length };
      if (hit.length) return Object.assign({}, hit[0].firstFreeze, { station: hit[0].name, uid: hit[0].uid, nearby: false, km: null }, meta);
      const pend = okC.filter(s => s.firstFreeze).sort((a, b) => grade(b) - grade(a));
      if (pend.length) return Object.assign({}, pend[0].firstFreeze, { station: pend[0].name, uid: pend[0].uid, nearby: false, km: null }, meta);
      const pts = (G.points || []).filter(p => p.county === c.name), ref = pts.length ? { lat: mean(pts.map(p => p.lat)), lon: mean(pts.map(p => p.lon)) } : inC.length ? { lat: mean(inC.map(s => s.lat)), lon: mean(inC.map(s => s.lon)) } : null;
      const out = ref ? stations.filter(s => s.ok && s.firstFreeze && fin(s.lat) && s.fips !== c.fips).map(s => ({ s, km: km(ref.lat, ref.lon, s.lat, s.lon) })).sort((a, b) => a.km - b.km)[0] : null;
      return out ? Object.assign({}, out.s.firstFreeze, { station: out.s.name, uid: out.s.uid, nearby: true, km: rd(out.km, 0) }, meta) : null;
    }
    const counties = (G.counties || []).map(c => {
      const w = (gridOn && d.county[c.fips]) || {}, p = (base && base.prismCounty && base.prismCounty[c.fips]) || {}, h = (base && base.homes && base.homes[c.fips]) || {};
      const hdd = nn(w.hdd), hddNorm = normOn ? nn(w.hddNorm) : null;
      return { name: c.name, fips: c.fips, hdd: rd(hdd, 1), hddNorm: rd(hddNorm, 1), pct: hdd != null && hddNorm != null && hddNorm >= 25 ? Math.round(100 * hdd / hddNorm) : null, dep: hdd != null && hddNorm != null ? rd(hdd - hddNorm, 1) : null, hdd7: nn(w.hdd7),
        fr32: nn(w.fr32), fr32Norm: normOn ? nn(w.fr32Norm) : null, minT: nn(w.minT),
        normHdd: fin(p.hdd) ? Math.round(p.hdd) : null, normFr32: fin(p.fr32) ? rd(p.fr32, 1) : null, normFr25: fin(p.fr25) ? rd(p.fr25, 1) : null,
        /* exposure: the county's normal over the metro mean; exposureHomes: the same ratio weighted by where the housing units are */
        exposure: fin(p.hdd) && metroHdd ? rd(p.hdd / metroHdd, 3) : null, exposureHomes: fin(h.ratio) ? h.ratio : null, firstFreeze: countyFreeze(c) };
    }).sort((a, b) => (a.hdd != null && b.hdd != null ? b.hdd - a.hdd : a.hdd != null ? -1 : b.hdd != null ? 1 : (b.normHdd || 0) - (a.normHdd || 0)) || a.name.localeCompare(b.name));

    const m = one(DFW);
    return { ok: !!(d && (T || gridOn)), through, season, today, ageDays, overdue: ageDays != null && ageDays > 9, gridThrough: gridOn ? B.G1 : null, gridNormal: normOn,
      stale: d ? Object.keys(d.stale || {}).map(id => ({ id, what: WHAT[id] || id, through: nn(d.stale[id]), why: (d.errs && d.errs[id]) || null })) : [],
      metro: Object.assign(m, { station: m.name || 'DFW Airport', norm: m.hddNorm }), counties, stations, series: series(d, base, DFW), grades: GRADES, credit: CREDIT };
  }

  /* ---------- one place ---------- */
  /* The cold exposure and the season to date at a latitude and longitude (a ZIP centroid). exposure is the baked ratio for the
     ZIP when zipCode is given and the baseline has it, else the normals grid sampled at the place over the metro mean. The
     season values come from the weekly grids; when no grid is stored they fall back to the three nearest complete stations
     (from: 'stations'), and a share of normal is then built only from stations that have a normal. */
  function zip(lat, lon, data, base, zipCode) {
    base = baseOf(base);
    const d = read(data), B = d ? d.blocks : {}, P = base && base.prism && Array.isArray(base.prism.hdd) ? base.prism : null, M = (base && base.metro) || {};
    const z = base && base.zip && zipCode != null ? base.zip[String(zipCode)] || null : null;
    const nH = z && fin(z.hdd) ? z.hdd : P ? sample(P.hdd, lat, lon, P) : null, nF = z && fin(z.fr32) ? z.fr32 : P ? sample(P.fr32, lat, lon, P) : null;
    const out = { exposure: z && fin(z.ratio) ? z.ratio : nH != null && fin(M.hdd) && M.hdd ? rd(nH / M.hdd, 3) : null, freezeExposure: nF != null && fin(M.fr32) && M.fr32 ? rd(nF / M.fr32, 2) : null, normHdd: rd(nH, 0), normFr32: rd(nF, 1),
      hddToDate: null, hddNormToDate: null, pct: null, fr32ToDate: null, seasonMin: null, through: null, from: null, firstFreezeNearby: null, lastFreeze: null, near: [], grade: GRADES.zip };
    const pct = (v, n) => (v != null && n != null && n >= 25 ? Math.round(100 * v / n) : null);
    const g = d && d.grid && isDay(B.G1) && Array.isArray(d.grid.hdd) ? d.grid : null, ok = okStations(d), near = nearest3(ok, lat, lon);
    if (g) {
      const h = sample(g.hdd, lat, lon, g), n = B.G2 === B.G1 && Array.isArray(g.hddNorm) ? sample(g.hddNorm, lat, lon, g) : null;
      if (h != null) Object.assign(out, { hddToDate: rd(h, 0), hddNormToDate: rd(n, 0), pct: pct(h, n), fr32ToDate: Array.isArray(g.fr32) ? rd(sample(g.fr32, lat, lon, g), 1) : null, seasonMin: Array.isArray(g.minT) ? rd(sample(g.minT, lat, lon, g), 0) : null, through: B.G1, from: 'grid' });
    } else if (near.length) {
      const withNorm = nearest3(ok.filter(x => fin(x.s.hddNorm)), lat, lon), h = idw(near, x => x.s.hdd), hn = idw(withNorm, x => x.s.hdd), n = idw(withNorm, x => x.s.hddNorm);
      Object.assign(out, { hddToDate: rd(h, 0), hddNormToDate: rd(n, 0), pct: pct(hn, n), fr32ToDate: rd(idw(near, x => x.s.fr32), 1), seasonMin: rd(idw(near, x => x.s.minT), 0), through: isDay(B.W2) ? B.W2 : null, from: 'stations' });
    }
    if (near.length) {
      const first = near.map(o => o.x.s.firstFreeze).filter(isDay).sort()[0];
      out.firstFreezeNearby = first || null; out.lastFreeze = nn(near[0].x.s.lastFreeze); out.near = near.map(o => ({ name: o.x.st.label || o.x.st.name || null, uid: o.x.uid, km: rd(o.km, 1) }));
    }
    return out;
  }

  /* ---------- one sentence ---------- */
  function headline(s) {
    if (!s || !s.ok || !s.metro) return '';
    const m = s.metro, f = m.firstFreeze, words = isDay(s.through) && +s.through.slice(5, 7) >= 7 ? 'falls' : 'seasons', days = n => n + (n === 1 ? ' day' : ' days');
    let a;
    if (m.hdd == null) a = `no complete reading at ${m.station} this week`;
    else {
      a = `${m.hdd} heating degree ${m.hdd === 1 ? 'day' : 'days'} at ${m.station}`;
      if (m.norm != null) a += ` against a normal of ${m.norm}` + (m.pct != null ? ` (${m.pct}%)` : '');
      if (m.rank) a += `, ${m.rank.text} to this date among ${m.rank.of} ${words}`;
    }
    let b = '';
    if (f && f.state === 'occurred') b = `first freeze ${pretty(f.date)}` + (f.daysVsMedian == null ? '' : f.daysVsMedian === 0 ? ', on the median date' : `, ${days(Math.abs(f.daysVsMedian))} ${f.daysVsMedian < 0 ? 'ahead of' : 'after'} the median date`) + (m.fr32 != null ? `, ${m.fr32} freeze ${m.fr32 === 1 ? 'night' : 'nights'} so far` : '');
    else if (f && f.state === 'pending') b = 'no freeze yet' + (f.median ? (f.daysToMedian >= 0 ? `, the median first freeze is ${pretty(f.median)}` : `, ${days(-f.daysToMedian)} past the median first freeze of ${pretty(f.median)}`) : '');
    return `Heating season to date: ${a}${b ? '; ' + b : ''}.` + (s.overdue && isDay(s.through) ? ` Observed through ${pretty(s.through)}; a refresh is due.` : '');
  }

  L.climate = { DFW, GEOM, GRADES, sample, cell, status, zip, headline, series, nights, climOf, chanceBy, hddOf, inSeason, pretty };
})(typeof globalThis !== 'undefined' ? globalThis : self);
