/* ==== live/sources/acis_season.js ==== */
/* The heating season so far, as observed. NOAA's Regional Climate Centers (ACIS) answer five requests a week for the box
   around the 12 counties:
     W1  daily lows and highs since July 1 at the airports paired with the forecast points (the accumulation curve, the last nights)
     W2  per station: heating degree days since July 1 against the 1991 to 2020 normal, the last 7 and 30 days against normal,
         freeze and hard freeze nights, first and last freeze, the season minimum, and the missing day counts behind each
     W3  the same span in each of the 30 falls 1991 to 2020 (the rank of this season, freeze nights normal to date)
     G1  the PRISM grids (about 4 km) and county means of season heating degree days, freeze nights and the season minimum
     G2  the 30 fall mean of the same span for the grid and the counties
   About 40 KB on the wire and 80 to 115 KB stored. Every block stands alone: one that fails keeps last week's copy, with its
   own through date in data.stale. History is not asked for twice: W3 and G2 are reused when the day they cover is already stored. */
(function (root) {
  'use strict';
  const L = root.TDA_LIVE, API = 'https://data.rcc-acis.org/', V = 1;
  const BOX = '-98.3,32.0,-95.8,33.6', TZ = 'America/Chicago', DFW = '29755';
  /* PRISM (ACIS grid 21) over BOX: 40 rows from the south, 62 columns from the west, cell centres 1/24 of a degree apart */
  const GEOM = { ny: 40, nx: 62, lat0: 32.0, lon0: -98.333333, step: 0.0416666667 };
  /* one row per station in data.std, in this order; "ok" is the quality gate, applied here once */
  const COLS = ['hdd', 'hddNorm', 'hddOct', 'missOct', 'hdd7', 'miss7', 'hdd7Norm', 'hdd30', 'miss30', 'hdd30Norm', 'fr32', 'fr25', 'firstFreeze', 'lastFreeze', 'minT', 'minDate', 'min7', 'missJul', 'ok'];
  const I = {}; COLS.forEach((c, i) => { I[c] = i; });
  /* a second between calls; each answer must arrive inside 28 s (a service worker is stopped when a fetch takes 30) */
  const OPT = { gapMs: 1000, retries: 1, timeoutMs: 28000 };
  /* airports read daily besides the stations paired with a forecast point in live/geo.js */
  const EXTRA = ['KGPM'];

  /* ---------- dates ---------- */
  const localDate = now => { const p = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(now)).reduce((o, x) => (o[x.type] = x.value, o), {}); return `${p.year}-${p.month}-${p.day}`; };
  const addDays = (ymd, n) => new Date(Date.parse(ymd + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
  const dayDiff = (a, b) => Math.round((Date.parse(a + 'T12:00:00Z') - Date.parse(b + 'T12:00:00Z')) / 864e5);
  /* Everything the requests need for one through date. The heating season runs July 1 to June 30 and carries the year it starts
     in. y0 and y1 are the first and last of the 30 climatology years on the same month and day (1991 and 2020 in the fall,
     1992 and 2021 from January on; February 29 is asked as February 28). gateOct: the October gate applies (October to June). */
  function span(through) {
    const y = +through.slice(0, 4), m = +through.slice(5, 7), season = m < 7 ? y - 1 : y, start = season + '-07-01', md = through.slice(5) === '02-29' ? '02-28' : through.slice(5);
    return { through, season, start, n: dayDiff(through, start) + 1, md, y0: 1991 + y - season, y1: 2020 + y - season, gateOct: m >= 10 || m <= 6 };
  }
  /* the through date is yesterday in the metro's time zone */
  const dates = now => span(addDays(localDate(now), -1));

  /* ---------- the request bodies (each one verified against the live service on 2026-11-13) ---------- */
  const S = { interval: 'dly', duration: 'std', season_start: '07-01' }, Y = { interval: [1, 0, 0], duration: 'std', season_start: '07-01' }, D7 = { interval: 'dly', duration: 7 }, D30 = { interval: 'dly', duration: 30 };
  const MC = r => ({ reduce: r, add: 'mcnt' }), CM = { area_reduce: 'county_mean' }, SM = { smry: 'mean', smry_only: 1 };
  const el = (name, base, reduce, more) => Object.assign({ name }, base, { reduce }, more || {});
  const airports = geo => [...new Set(['KDFW'].concat(((geo && geo.points) || []).map(p => p.stn).filter(Boolean), EXTRA))];
  const body = {
    W1: (sp, sids) => ({ sids: sids.join(','), sdate: sp.start, edate: sp.through, meta: 'name,sids,ll,elev,county,uid', elems: [{ name: 'mint' }, { name: 'maxt' }] }),
    W2: sp => ({ bbox: BOX, date: sp.through, meta: 'name,sids,ll,elev,county,uid', elems: [
      el('hdd', S, MC('sum')), el('hdd', S, 'sum', { normal: '1' }), el('hdd', S, MC('sum'), { season_start: '10-01' }), el('hdd', D7, MC('sum')), el('hdd', D7, 'sum', { normal: '1' }), el('hdd', D30, MC('sum')), el('hdd', D30, 'sum', { normal: '1' }),
      el('mint', S, MC('cnt_le_32')), el('mint', S, 'cnt_le_25'), el('mint', S, 'first_le_32'), el('mint', { interval: 'dly', duration: 365 }, 'last_le_32'), el('mint', S, { reduce: 'min', add: 'date' }), el('mint', D7, 'min')] }),
    W3: sp => ({ bbox: BOX, sdate: sp.y0 + '-' + sp.md, edate: sp.y1 + '-' + sp.md, meta: 'name,sids,ll,county,uid', elems: [el('hdd', Y, MC('sum')), el('mint', Y, MC('cnt_le_32')), el('mint', Y, 'cnt_le_25'), el('mint', Y, 'min')] }),
    /* PRISM runs about two days behind: ask for the last three days of the season and take the newest complete one */
    G1: sp => ({ bbox: BOX, grid: '21', sdate: sp.n > 2 ? addDays(sp.through, -2) : sp.start, edate: sp.through, elems: [el('hdd', S, 'sum'), el('mint', S, 'cnt_le_32'), el('mint', S, 'min'), el('hdd', S, 'sum', CM), el('mint', S, 'cnt_le_32', CM), el('mint', S, 'min', { area_reduce: 'county_min' }), el('hdd', D7, 'sum', CM)] }),
    /* sp: the span of the PRISM day G1 chose. The freeze night grid is left out: its 30 fall mean comes back in whole nights, too coarse to use. */
    G2: sp => ({ bbox: BOX, grid: '21', sdate: sp.y0 + '-' + sp.md, edate: sp.y1 + '-' + sp.md, elems: [el('hdd', Y, 'sum', SM), el('hdd', Y, 'sum', Object.assign({}, CM, SM)), el('mint', Y, 'cnt_le_32', Object.assign({}, CM, SM))] }),
  };

  /* ---------- one call, three ways to fail ---------- */
  /* ACIS reports an error as HTTP 400 with a text body, as HTTP 200 with {"error": …}, or as HTTP 200 with nothing at all. */
  async function call(http, id, path, req, opt) {
    let t;
    try { t = await http.text(API + path, Object.assign({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req) }, OPT, opt || {})); }
    catch (e) { throw new Error(id + ': ' + (e && e.status ? 'ACIS answered HTTP ' + e.status + (e.body ? ' (' + String(e.body).replace(/\s+/g, ' ').trim().slice(0, 120) + ')' : '') : String((e && e.message) || e))); }
    if (!String(t).trim()) throw new Error(id + ': ACIS answered with an empty body');
    let j; try { j = JSON.parse(t); } catch (e) { throw new Error(id + ': ACIS did not answer in JSON (' + String(t).slice(0, 80).replace(/\s+/g, ' ') + ')'); }
    if (j && j.error) throw new Error(id + ': ACIS reported an error (' + String(j.error).slice(0, 120) + ')');
    return j;
  }

  /* ---------- parsers ---------- */
  /* station values arrive as strings: "M" is missing; anything that is not a plain number is unknown, never zero */
  const num = v => (typeof v === 'number' ? (Number.isFinite(v) ? v : null) : typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v.trim()) ? +v : null);
  const day = v => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  /* a reduction with an add on comes back as [value, extra]: ["29", 0] (missing days) or ["47", "2026-10-17"] (the date) */
  const pair = v => (Array.isArray(v) ? v : [v, null]);
  const round = (v, dp) => { const n = num(v); if (n == null) return null; const k = Math.pow(10, dp || 0); return Math.round(n * k) / k; };
  /* ids come as "<id> <type>": 5 is the airport code, 6 the GHCN daily id (the only one NCEI knows) */
  const sidOf = (m, type) => { const s = ((m && m.sids) || []).find(x => String(x).split(' ')[1] === String(type)); return s ? String(s).split(' ')[0] : null; };
  /* a name a person would use; the publisher's name stays beside it */
  const LABEL = { USW00003927: 'DFW Airport', USW00013960: 'Dallas Love Field', USW00003971: 'Dallas Executive Airport', USC00410058: 'Addison Airport', USW00053966: 'Mid Way Regional Airport (Midlothian)', USW00000448: 'Rockwall Municipal Airport', USW00013926: 'Greenville Majors Field', USW00003985: 'Fort Worth Spinks Airport', USC00413285: 'Fort Worth Weather Service Office', USR0000TLBJ: 'LBJ Road (fire weather station)', USR0000TGRE: 'Greenville (fire weather station)' };
  const WORD = { AP: 'Airport', ARPT: 'Airport', FLD: 'Field', FT: 'Fort', MUNI: 'Municipal', MUNICPAL: 'Municipal', RD: 'Road', PT: 'Point', CTR: 'Center', NAS: 'NAS', NAAF: 'NAAF', WSFO: 'WSFO', WB: 'WB', KGVL: 'KGVL', TEXAS: '', FAA: '', WSCMO: '' };
  function nice(name, ghcn) {
    if (ghcn && LABEL[ghcn]) return LABEL[ghcn];
    return String(name || '').replace(/,\s*TX US$/i, '').replace(/[-/]+/g, ' ').split(/\s+/).map(w => WORD[w] != null ? WORD[w] : /^\d+[NSEW]{1,3}$/.test(w) ? w.replace(/^(\d+)/, '$1 ') : /^[NSEW]{1,3}$/.test(w) ? w : w.charAt(0) + w.slice(1).toLowerCase()).filter(Boolean).join(' ').replace(/\bMc([a-z])/g, (x, c) => 'Mc' + c.toUpperCase());
  }
  function stationOf(m) { const ll = m.ll || [], ghcn = sidOf(m, 6); return { name: m.name || '', label: nice(m.name, ghcn), ghcn, icao: sidOf(m, 5), lat: round(ll[1], 5), lon: round(ll[0], 5), elev: round(m.elev, 0), fips: m.county || null }; }
  /* The quality gate: a station counts when at most 3 days are missing since October 1 (before October: at most 10 since July 1).
     ACIS never refuses a reduction for missing data, so a silent station reads "0 heating degree days" until this drops it. */
  const okHeat = (row, sp) => row[I.hdd] != null && (sp.gateOct ? row[I.missOct] != null && row[I.missOct] <= 3 : row[I.missJul] != null && row[I.missJul] <= 10);
  /* W2 → { stations: { uid: {...} }, rows: { uid: [values in COLS order] } }; stations with nothing observed this season are left out */
  function parseW2(j, sp) {
    const stations = {}, rows = {};
    for (const r of (j && j.data) || []) {
      const m = (r && r.meta) || {}, d = (r && r.data) || []; if (m.uid == null || d.length < 13) continue;
      const [hdd, missJul] = pair(d[0]), [hddOct, missOct] = pair(d[2]), [hdd7, miss7] = pair(d[3]), [hdd30, miss30] = pair(d[5]), [fr32] = pair(d[7]), [minT, minDate] = pair(d[11]);
      const row = [num(hdd), num(d[1]), num(hddOct), num(missOct), num(hdd7), num(miss7), num(d[4]), num(hdd30), num(miss30), num(d[6]), num(fr32), num(d[8]), day(d[9]), day(d[10]), num(minT), day(minDate), num(d[12]), num(missJul)];
      if (row[I.hdd] == null && row[I.minT] == null) continue;
      row.push(okHeat(row, sp) ? 1 : 0); stations[m.uid] = stationOf(m); rows[m.uid] = row;
    }
    return { stations, rows };
  }
  /* W1 → lows and highs per station, n days from the season start; a row carries no dates, the i th pair is the i th day */
  function parseDaily(j, n) {
    const stations = {}, tn = {}, tx = {};
    for (const r of (j && j.data) || []) {
      const m = (r && r.meta) || {}, d = (r && r.data) || []; if (m.uid == null) continue;
      const lo = Array.from({ length: n }, (_, i) => num((d[i] || [])[0])), hi = Array.from({ length: n }, (_, i) => num((d[i] || [])[1]));
      if (lo.every(v => v == null) && hi.every(v => v == null)) continue;
      stations[m.uid] = stationOf(m); tn[m.uid] = lo; tx[m.uid] = hi;
    }
    return { stations, tn, tx };
  }
  /* W3 → per station 30 values, 1991 first; a fall with more than 5 days missing (of heating degree days, the stricter count) is null
     in all four lists. keep: only these uids (when given) */
  function parseW3(j, keep) {
    const out = { hdd: {}, fr32: {}, fr25: {}, minT: {} };
    for (const r of (j && j.data) || []) {
      const u = ((r && r.meta) || {}).uid, d = (r && r.data) || []; if (u == null || d.length !== 30 || (keep && !keep[u])) continue;
      const h = [], f = [], g = [], t = [];
      for (const y of d) { if (!Array.isArray(y)) { h.push(null); f.push(null); g.push(null); t.push(null); continue; } const [hv, hm] = pair(y[0]), [fv, fm] = pair(y[1]), ok = num(hm) != null && hm <= 5 && num(fm) != null && fm <= 5; h.push(ok ? num(hv) : null); f.push(ok ? num(fv) : null); g.push(ok ? num(y[2]) : null); t.push(ok ? num(y[3]) : null); }
      if (h.some(v => v != null) || f.some(v => v != null)) { out.hdd[u] = h; out.fr32[u] = f; out.fr25[u] = g; out.minT[u] = t; }
    }
    return out;
  }
  /* a grid as ACIS sends it (rows from the south, each west to east; numbers, -999 missing) → one flat array, null for missing */
  function flat(g) {
    if (!Array.isArray(g) || g.length !== GEOM.ny || !g.every(r => Array.isArray(r) && r.length === GEOM.nx)) throw new Error('the grid is not ' + GEOM.ny + ' by ' + GEOM.nx);
    const out = []; for (const r of g) for (const v of r) out.push(typeof v === 'number' && v !== -999 && Number.isFinite(v) ? v : null);
    return out;
  }
  const byCounty = (o, dp) => { const out = {}; for (const f in o || {}) out[f] = round(o[f], dp); return out; };
  /* G1 → the newest day PRISM has finished: its grids and county values, or null when none of the days asked for is complete.
     A day PRISM has not produced is -999 in every cell, with an empty county object (its freeze count still says 0: ignore it). */
  function parseG1(j) {
    const rows = (j && j.data) || [];
    for (let k = rows.length - 1; k >= 0; k--) {
      const r = rows[k]; if (!Array.isArray(r) || !day(r[0]) || !Array.isArray(r[1]) || !Array.isArray(r[1][0]) || r[1][0][0] === -999 || !r[4] || !Object.keys(r[4]).length) continue;
      const hdd = byCounty(r[4], 2), fr32 = byCounty(r[5], 2), minT = byCounty(r[6], 1), hdd7 = byCounty(r[7], 1), county = {};
      for (const f in hdd) county[f] = { hdd: hdd[f], hdd7: hdd7[f] == null ? null : hdd7[f], fr32: fr32[f] == null ? null : fr32[f], minT: minT[f] == null ? null : minT[f] };
      return { date: r[0], hdd: flat(r[1]), fr32: flat(r[2]), minT: flat(r[3]), county };
    }
    return null;
  }
  /* G2 → the 30 fall mean: the first grid in the summary and the county objects that follow it (heating degree days, then freeze nights) */
  function parseG2(j) {
    const s = (j && j.smry) || [], grid = s.find(x => Array.isArray(x)), objs = s.filter(x => x && !Array.isArray(x) && typeof x === 'object');
    if (!grid || !objs.length) throw new Error('the 30 fall summary is incomplete');
    const h = byCounty(objs[0], 2), f = byCounty(objs[1] || {}, 2), county = {};
    for (const k in h) county[k] = { hddNorm: h[k], fr32Norm: f[k] == null ? null : f[k] };
    return { hddNorm: flat(grid), county };
  }

  L.register({
    id: 'acis_season', name: 'Heating season to date', publisher: 'NOAA Regional Climate Centers (ACIS), with PRISM grids from Oregon State University', page: 'https://www.rcc-acis.org/',
    about: 'Observed heating degree days since July 1 against the 1991 to 2020 normal at every reporting station in and around the 12 counties, freeze nights, first and last freeze, the same span in 30 past falls, and 4 km grids and county means of the season so far. Feeds the season line, the Heat Desk pacing and the season to date by county and ZIP.',
    hosts: ['data.rcc-acis.org'], cadence: 'weekly', cors: true, grade: 'A/C', timeoutMs: 200000,
    terms: 'Station data and normals: NOAA Regional Climate Centers (ACIS), public. Grids: PRISM Climate Group, Oregon State University, credit required. Recent days are preliminary.',
    labels: { hdd: ['DFW Airport heating degree days since July 1', 'int'], norm: ['Normal to the same date (1991 to 2020)', 'int'], pct: ['Percent of normal', 'pct'], fr32: ['Freeze nights at DFW Airport', 'int'], stations: ['Stations reporting', 'int'], freezeCounties: ['Counties with a freeze so far (of 12)', 'int'], through: ['Observed through', 'text'] },
    async run(ctx) {
      const prev = ctx.prev && ctx.prev.v === V && ctx.prev.blocks ? ctx.prev : null, ask = (id, path, req) => call(ctx.http, id, path, req);
      let sp = dates(ctx.now); const asked = sp.through;
      const blocks = {}, stale = {}, errs = {}, got = [], fresh = {};
      /* last week's copy of a block, when it is there and belongs to this season; the block is then marked stale with its own through date */
      const HAS = { W1: p => p.daily && p.daily.tn, W2: p => p.std && p.std.cols, W3: p => p.todate && p.todate.hdd, G1: p => p.grid && p.grid.hdd, G2: p => p.grid && p.grid.hddNorm };
      const kept = id => (prev && prev.blocks[id] && prev.blocks[id] >= sp.start && HAS[id](prev) ? prev.blocks[id] : null);
      const miss = (id, e) => { errs[id] = String((e && e.message) || e).slice(0, 200); stale[id] = blocks[id] = kept(id); return blocks[id]; };
      let daily = null, std = null, todate = null, g1 = null, g2 = null;

      /* W1: the airports day by day. It also shows whether yesterday has arrived: when DFW Airport or most of the airports do not
         have it yet, everything this run reads ends the day before. */
      try {
        const d = parseDaily(await ask('W1', 'MultiStnData', body.W1(sp, airports(ctx.geo))), sp.n), us = Object.keys(d.tn); if (!us.length) throw new Error('W1: no airport station answered');
        const absent = u => d.tn[u][sp.n - 1] == null || d.tx[u][sp.n - 1] == null;
        if (sp.n > 1 && ((d.tn[DFW] && absent(DFW)) || us.filter(absent).length > us.length / 2)) { sp = span(addDays(sp.through, -1)); us.forEach(u => { d.tn[u].pop(); d.tx[u].pop(); }); }
        daily = { start: sp.start, n: sp.n, tn: d.tn, tx: d.tx }; Object.assign(fresh, d.stations); blocks.W1 = sp.through; got.push('W1');
      } catch (e) { if (miss('W1', e)) daily = prev.daily; }

      /* W2: the station table. If DFW Airport has no value for the date (or, when the daily call did not answer, a day missing in its
         last seven), step back one day and ask once more. */
      try {
        let w = parseW2(await ask('W2', 'MultiStnData', body.W2(sp)), sp);
        const late = r => !r || r[I.hdd] == null || (got.indexOf('W1') < 0 && r[I.miss7] >= 1);
        if (late(w.rows[DFW]) && sp.through === asked && sp.n > 1) { sp = span(addDays(sp.through, -1)); w = parseW2(await ask('W2', 'MultiStnData', body.W2(sp)), sp); }
        if (!Object.keys(w.rows).length) throw new Error('W2: no station reported');
        std = Object.assign({ cols: COLS }, w.rows); Object.assign(fresh, w.stations); blocks.W2 = sp.through; got.push('W2');
      } catch (e) { if (miss('W2', e)) std = prev.std; }

      /* W3: the same span in 1991 to 2020 */
      if (prev && prev.todate && prev.blocks.W3 === sp.through) { todate = prev.todate; blocks.W3 = sp.through; }
      else try {
        const w = parseW3(await ask('W3', 'MultiStnData', body.W3(sp)), blocks.W2 === sp.through ? std : null); if (!Object.keys(w.hdd).length) throw new Error('W3: no station has the 30 falls');
        todate = Object.assign({ md: sp.md, years: Array.from({ length: 30 }, (_, i) => 1991 + i) }, w); blocks.W3 = sp.through; got.push('W3');
      } catch (e) { if (miss('W3', e)) todate = prev.todate; }

      /* G1: the grids and county means of the newest PRISM day */
      try {
        const g = parseG1(await ask('G1', 'GridData', body.G1(sp))); if (!g) throw new Error('G1: PRISM has not finished any of the last three days');
        g1 = g; blocks.G1 = g.date; got.push('G1');
      } catch (e) { if (miss('G1', e)) g1 = { date: prev.blocks.G1, hdd: prev.grid.hdd, fr32: prev.grid.fr32, minT: prev.grid.minT, county: prev.county || {} }; }

      /* G2: the 30 fall mean for that same PRISM day */
      const old2 = () => ({ hddNorm: prev.grid.hddNorm, county: prev.county || {} });
      if (g1 && prev && HAS.G2(prev) && prev.blocks.G2 === g1.date) { g2 = old2(); blocks.G2 = g1.date; }
      else if (g1 && got.indexOf('G1') >= 0) try { g2 = parseG2(await ask('G2', 'GridData', body.G2(span(g1.date)))); blocks.G2 = g1.date; got.push('G2'); } catch (e) { if (miss('G2', e)) g2 = old2(); }
      else if (miss('G2', new Error('G2: not asked, the grid it belongs to did not arrive')) && g1) g2 = old2();
      if (!g1) { g2 = null; if (blocks.G2) stale.G2 = blocks.G2 = null; }

      if (!got.length) throw new Error(errs.W2 || errs.W1 || errs.G1 || 'ACIS did not answer');
      const county = {};
      if (g1) for (const f in g1.county) { const a = g1.county[f]; county[f] = { hdd: a.hdd == null ? null : a.hdd, hdd7: a.hdd7 == null ? null : a.hdd7, fr32: a.fr32 == null ? null : a.fr32, minT: a.minT == null ? null : a.minT }; }
      if (g1 && g2) for (const f in g2.county) { const b = g2.county[f]; if (county[f]) { county[f].hddNorm = b.hddNorm == null ? null : b.hddNorm; county[f].fr32Norm = b.fr32Norm == null ? null : b.fr32Norm; } }
      /* names and places: this run's answers, over last week's when a station block was kept */
      const stations = Object.assign({}, prev && (stale.W1 || stale.W2 || stale.W3) ? prev.stations : {}, fresh);
      return { v: V, fetched: ctx.now.toISOString(), season: sp.season, through: blocks.W2 || sp.through, asked, stations, std, daily, todate,
        grid: g1 ? Object.assign({ date: g1.date }, GEOM, { hdd: g1.hdd, fr32: g1.fr32, minT: g1.minT, hddNorm: g2 ? g2.hddNorm : null }) : null, county: g1 ? county : null, blocks, stale, errs };
    },
    digest(d) {
      const row = (d.std && d.std[DFW]) || null, ok = !!(row && row[I.ok]), hdd = ok ? row[I.hdd] : null, norm = row ? row[I.hddNorm] : null, has = {};
      const uids = Object.keys(d.stations || {}).filter(u => d.std && Array.isArray(d.std[u]));
      /* a county has had a freeze when one of its stations recorded one, or the grid shows one somewhere inside it */
      uids.forEach(u => { const r = d.std[u]; if (r[I.firstFreeze] || r[I.fr32] > 0) has[d.stations[u].fips] = 1; });
      for (const f in d.county || {}) if (d.county[f].fr32 > 0) has[f] = 1;
      return { hdd, norm, pct: hdd != null && norm != null && norm >= 25 ? Math.round(100 * hdd / norm) : null, fr32: ok ? row[I.fr32] : null, stations: uids.filter(u => d.std[u][I.ok]).length, freezeCounties: ((L.geo && L.geo.counties) || []).filter(c => has[c.fips]).length, through: d.through || null };
    },
  });
  L.acis = { V, API, BOX, DFW, GEOM, COLS, OPT, EXTRA, localDate, addDays, dayDiff, span, dates, airports, body, call, num, day, pair, round, sidOf, nice, stationOf, okHeat, parseW2, parseDaily, parseW3, flat, parseG1, parseG2 };
})(typeof globalThis !== 'undefined' ? globalThis : self);
