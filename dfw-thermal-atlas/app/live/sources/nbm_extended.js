/* ==== live/sources/nbm_extended.js ==== */
/* National Blend of Models station guidance, read from the Iowa Environmental Mesonet's copy of the Weather Service text
   bulletins (NBE with NBX folded in): the low of every night and the high of every day out to day 11 at six airports, each
   with the blend's own spread. It carries numbers four days past the seven day forecast, which is where a first freeze shows
   up before any outlook map says "below normal". One request, about 118 KB on the wire (the service does not compress); the
   record keeps only mornings 6 to 11 days out, about 6 KB, because the nearer days belong to the official forecast in
   live/sources/nws_cold.js. Model guidance, not the official forecast. */
(function (root) {
  'use strict';
  const L = root.TDA_LIVE, API = 'https://mesonet.agron.iastate.edu/api/1/mos.json';
  /* one request, one patient retry, and no request waits past 25 seconds (the browser stops the background worker at 30); the
     run itself is given longer, because on a weekly day the archive pulls of live/sources/iem_cold.js queue on the same host */
  const OPT = { gapMs: 1000, retries: 1, timeoutMs: 25000 }, DAY = 864e5, TZ = 'America/Chicago';
  /* the service takes at most six stations a request: DFW Airport, Dallas Love Field, Fort Worth Meacham, McKinney, Denton, Mesquite */
  const STATIONS = ['KDFW', 'KDAL', 'KFTW', 'KTKI', 'KDTO', 'KHQZ'];
  const FROM = 6, EXT = 8;                                      /* mornings kept: 6 days out and later; from day 8 on they lie past the official forecast */
  /* Grades: the lows, highs and spreads are the blend's own numbers (B: model guidance, not the forecast of record); the chance
     of a freeze is this atlas's reading of mean and spread through a normal curve (C). */
  const GRADE = { guidance: 'B', chance: 'C' };
  const DATE_FMT = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
  const localDate = ms => DATE_FMT.format(new Date(ms));                                  // YYYY-MM-DD in the metro's time zone
  const ymd = ms => new Date(ms).toISOString().slice(0, 10);
  const num = v => typeof v === 'number' && Number.isFinite(v);
  /* the night thresholds of live/derive.js when it is loaded (it loads after the sources, so ask at run time) */
  const thresholds = () => { const t = (L.derive && L.derive.TH) || {}; return { freeze: num(t.freeze) ? t.freeze : 32, cold: num(t.cold) ? t.cold : 40, hard: num(t.hard) ? t.hard : 25 }; };
  /* standard normal distribution function (Abramowitz and Stegun 7.1.26, error under 1.5e-7) */
  function phi(z) { const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2), y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z / 2); return z >= 0 ? (1 + y) / 2 : (1 - y) / 2; }
  /* chance, in percent, that a low forecast as `mean` with standard deviation `sd` ends at or under `at` (whole degrees);
     null when either is unknown. A spread under one degree is read as one. */
  const chance = (mean, sd, at) => !num(mean) || !num(sd) ? null : Math.round(100 * phi((at + 0.5 - mean) / Math.max(1, sd)));
  /* "2026-11-13T12:00:00.000" or "2026-11-13 12:00", both UTC without saying so → milliseconds, null when unreadable */
  const utc = s => { const t = Date.parse(String(s == null ? '' : s).trim().replace(' ', 'T').replace(/(?:\.\d+)?Z?$/, '') + 'Z'); return Number.isNaN(t) ? null : t; };
  /* Rows of one station → nights and days of its newest run. A 12Z row carries the low of the night that ends that morning; a
     00Z row carries the high of the day that just ended (00Z is 6 pm Central the evening before).
     night: m the morning the low happens, d the evening before (the convention of live/sources/nws_cold.js), lead the number
     of mornings counted from the local date of the run, lowF and its spread sd, p32, p40 and p25 the chance in percent of a low
     at or under the freeze, cold and hard freeze thresholds, ext true from day 8 on.
     day: the high and its spread, the low of that morning, and heating degree days base 65 rounded the way the Weather Service does. */
  function stationOf(id, rows, th) {
    th = th || thresholds();
    const rs = (rows || []).map(r => ({ r, f: utc(r.ftime_utc || r.ftime), run: utc(r.runtime_utc || r.runtime) })).filter(x => x.f != null && x.run != null && num(x.r.txn));
    if (!rs.length) return null;
    const run = Math.max(...rs.map(x => x.run)), runDay = Date.parse(localDate(run)), nights = [], hi = {}, once = {};
    rs.filter(x => x.run === run).sort((a, b) => a.f - b.f).forEach(x => {
      if (once[x.f]) return; once[x.f] = 1;                         /* one row a forecast time, whatever the answer repeats */
      const h = new Date(x.f).getUTCHours(), sd = num(x.r.xnd) ? x.r.xnd : null;
      if (h === 12) { const m = ymd(x.f), lead = Math.round((Date.parse(m) - runDay) / DAY); nights.push({ m, d: ymd(x.f - DAY), lead, lowF: x.r.txn, sd, p32: chance(x.r.txn, sd, th.freeze), p40: chance(x.r.txn, sd, th.cold), p25: chance(x.r.txn, sd, th.hard), ext: lead >= EXT }); }
      else if (h === 0) hi[ymd(x.f - DAY)] = { hiF: x.r.txn, sd };
    });
    if (!nights.length) return null;
    const days = nights.filter(n => hi[n.m]).map(n => ({ d: n.m, lead: n.lead, hiF: hi[n.m].hiF, hiSd: hi[n.m].sd, lowF: n.lowF, hdd: Math.max(0, 65 - Math.floor((hi[n.m].hiF + n.lowF) / 2 + 0.5)) }));
    return { id, run: new Date(run).toISOString(), nights, days };
  }
  /* the whole answer → one entry per station, every lead the bulletin carries */
  function parse(j, th) {
    const by = {}; ((j && j.data) || []).forEach(r => { if (r && typeof r.station === 'string' && r.station) (by[r.station] = by[r.station] || []).push(r); });
    return Object.keys(by).filter(id => STATIONS.indexOf(id) >= 0).sort().map(id => stationOf(id, by[id], th)).filter(Boolean);      /* the six asked for, whatever else comes back */
  }
  /* The record: { v, model, run (ISO, the newest run), from (the first lead kept), th: { freeze, cold, hard },
       stations: [{ id, name, county, run, nights: [{ m, d, lead, lowF, sd, p32, p40, p25, ext }], days: [{ d, lead, hiF, hiSd, lowF, hdd }] }] } */
  const url = () => API + '?' + STATIONS.map(s => 'station=' + s).join('&') + '&model=NBE';
  const runLabel = run => String(run).slice(0, 10) + ' ' + String(run).slice(11, 13) + 'Z';
  L.register({
    id: 'nbm_extended', name: 'Blend lows and highs, days 6 to 11', publisher: 'National Weather Service blend of models, served by the Iowa Environmental Mesonet', page: 'https://mesonet.agron.iastate.edu/mos/',
    about: 'The National Blend of Models station bulletins for six airports: each night\'s low and each day\'s high 6 to 11 days out, with the spread between the models. Bridges the seven day forecast and the 8 to 14 day outlook, and puts a number on the chance of a freeze in days 8 to 11, where a first freeze shows before any outlook map does.',
    hosts: ['mesonet.agron.iastate.edu'], cadence: 'daily', cors: true, grade: GRADE.guidance, terms: 'Weather Service guidance, public domain; archive and service by Iowa State University, free for any lawful use, credit appreciated. Model guidance, not the official forecast.', timeoutMs: 150000,
    labels: { minLow: ['Lowest blend low, mornings 6 to 11 days out', 'degF'], pFreeze: ['Highest chance of a freeze at any of the six airports, 6 to 11 days out', 'pct'], minLowExt: ['Lowest blend low past the seven day forecast (days 8 to 11)', 'degF'], pFreezeExt: ['Highest chance of a freeze past the seven day forecast (days 8 to 11)', 'pct'], hddExt: ['Blend heating degree days, days 8 to 10 at DFW Airport', 'int'], run: ['Model run', 'text'] },
    async run(ctx) {
      const th = thresholds(), now = +ctx.now, G = ctx.geo || {};
      const all = parse(await ctx.http.json(url(), OPT), th);
      if (!all.length) throw new Error('no blend rows came back for the six airports');
      const run = all.map(s => s.run).sort().pop();
      if (!(now - +new Date(run) <= 2 * DAY)) throw new Error('the newest blend run is more than two days old (' + runLabel(run) + ')');
      const at = id => (G.points || []).find(p => p.stn === id) || {};
      /* a station still on an older run than the others by more than a day is left out; days nearer than six belong to the official forecast */
      const stations = all.filter(s => +new Date(run) - +new Date(s.run) <= DAY).map(s => ({ id: s.id, name: at(s.id).name || s.id, county: at(s.id).county || null, run: s.run, nights: s.nights.filter(n => n.lead >= FROM), days: s.days.filter(x => x.lead >= FROM) })).filter(s => s.nights.length);
      if (!stations.length) throw new Error('the blend guidance does not reach day ' + FROM);
      return { v: 1, model: 'NBE', run, from: FROM, th, stations };
    },
    digest(d) {
      const all = d.stations.flatMap(s => s.nights), ext = all.filter(n => n.ext), dfw = d.stations.find(s => s.id === 'KDFW'), hx = dfw ? dfw.days.filter(x => x.lead >= EXT && x.hdd != null) : [];
      const min = a => (a.length ? Math.min(...a) : null), max = a => (a.length ? Math.max(...a) : null), ps = a => a.map(n => n.p32).filter(v => v != null);
      return { minLow: min(all.map(n => n.lowF)), pFreeze: max(ps(all)), minLowExt: min(ext.map(n => n.lowF)), pFreezeExt: max(ps(ext)), hddExt: hx.length ? hx.reduce((s, x) => s + x.hdd, 0) : null, run: runLabel(d.run) };
    },
  });
  L.nbm = { GRADE, STATIONS, FROM, EXT, url, parse, stationOf, chance, phi, utc, thresholds };
})(typeof globalThis !== 'undefined' ? globalThis : self);
