/* ==== live/sources/cpc_outlook.js ==== */
/* Climate Prediction Center, the look past the seven day forecast. One collector, five parts; a part that fails keeps its
   last good value and leaves its error in errs under its own name:
     ext     the 6 to 10 day and 8 to 14 day temperature outlooks at the 12 counties, precipitation at the office     (map service, daily)
     haz     the hazards areas for days 3 to 7 and 8 to 14: hazardous cold, frost or freeze, heavy snow, ice           (map service, daily)
     winter  the probabilistic Winter Storm Severity Index, days 1 to 7, at the 12 counties                            (map service, daily)
     text    the forecasters' discussions: confidence, the North Texas row, the hazards they name, the ENSO status    (api.weather.gov, daily; ENSO weekly)
     long    the monthly outlook and the 13 three month outlooks at the office                                         (map service, weekly)
   A quiet day costs 13 requests and about 11 KB on the wire; the weekly parts add 3 requests and 3 KB; a metro split between
   two probability bands adds 12 point requests for that outlook. The run fails as a whole only when neither outlook can be
   read. The expected heating load needs L.cpcClass (live/cpc_class.js); without it the load fields are null and the rest works. */
(function (root) {
  'use strict';
  const L = root.TDA_LIVE;
  const MS = 'https://mapservices.weather.noaa.gov/vector/rest/services', NWS = 'https://api.weather.gov';
  /* a second between calls and one patient retry; queries answer in under a second, and no request waits past 20 seconds
     (the browser stops the background worker when a single fetch runs longer than 30) */
  const ARC = { gapMs: 1100, retries: 1, timeoutMs: 20000 };
  const TXT = { headers: { Accept: 'application/ld+json' }, gapMs: 700, retries: 1, timeoutMs: 20000 };
  const DAY = 864e5, T3 = 100 / 3, TZ = 'America/Chicago';
  /* Grades: the probabilities, the hazard areas and the discussions are the forecasters' own, read at one point a county and by
     band (B); the heating load built on them comes from the atlas's own class table (C). */
  const GRADE = { outlook: 'B', hazards: 'B', text: 'B', load: 'C' };
  const DATE_FMT = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
  const localDay = ms => DATE_FMT.format(new Date(ms));                                      // YYYY-MM-DD in the metro's time zone
  const num = v => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 8.64e15;
  /* date fields are epoch milliseconds stamped at 00:00 UTC of the calendar date: read them in UTC, never in local time */
  const ymd = ms => num(ms) ? new Date(ms).toISOString().slice(0, 10) : null;
  const iso = ms => num(ms) ? new Date(ms).toISOString() : null;
  const r1 = x => Math.round(x * 10) / 10;
  const say = e => String((e && e.message) || e).replace(/[<>]/g, ' ').slice(0, 140);
  /* A discussion shares its host with the forecast collector, whose requests may be queued ahead of it: it never holds the
     run longer than 45 seconds. Past that the last good text stays and the outlooks already read are not lost. */
  const TEXT_LIMIT = 45000;
  const within = (p, what) => { let t; return Promise.race([p, new Promise((_, rej) => { t = setTimeout(() => rej(new Error(what + ' did not answer in ' + TEXT_LIMIT / 1000 + ' seconds')), TEXT_LIMIT); })]).finally(() => clearTimeout(t)); };
  /* a forecaster's paragraph, kept whole: when it runs past n characters it ends at its last full sentence */
  const whole = (s, n) => { if (s.length <= n) return s; const i = s.lastIndexOf('. ', n - 1); return i > 0 ? s.slice(0, i + 1) : s.slice(0, n); };

  /* ---------- geometry ---------- */
  /* one point per county: the first forecast point of that county in live/geo.js */
  const countyPoints = G => ((G && G.counties) || []).map(c => { const p = (G.points || []).find(q => q.county === c.name); return p ? { county: c.name, lat: p.lat, lon: p.lon } : null; }).filter(Boolean);
  const multipoint = pts => encodeURIComponent(JSON.stringify({ points: pts.map(p => [+p.lon.toFixed(4), +p.lat.toFixed(4)]), spatialReference: { wkid: 4326 } }));
  const TAIL = '&inSR=4326&spatialRel=esriSpatialRelIntersects&returnGeometry=false&f=json';
  const qMulti = (path, fields, pts) => `${MS}/${path}/query?geometry=${multipoint(pts)}&geometryType=esriGeometryMultipoint${TAIL}&outFields=${fields}`;
  const qPoint = (path, fields, p) => `${MS}/${path}/query?geometry=${p.lon.toFixed(4)},${p.lat.toFixed(4)}&geometryType=esriGeometryPoint${TAIL}&outFields=${fields}`;
  const qAll = (path, fields) => `${MS}/${path}/query?where=1%3D1&returnGeometry=false&f=json&outFields=${fields}`;
  const qIdentify = (path, p) => `${MS}/${path}/identify?geometry=${p.lon.toFixed(4)},${p.lat.toFixed(4)}&geometryType=esriGeometryPoint&sr=4326&layers=all&tolerance=1&mapExtent=${(p.lon - 1).toFixed(2)},${(p.lat - 1).toFixed(2)},${(p.lon + 1).toFixed(2)},${(p.lat + 1).toFixed(2)}&imageDisplay=400,400,96&returnGeometry=false&f=json`;
  const F_EXT = 'fcst_date,start_date,end_date,cat,prob,idp_filedate', F_HAZ = 'label,start_date,end_date,idp_filedate', F_WIN = 'prob,impact,validstartdatetime,validenddatetime,idp_filedate', F_MON = 'fcst_date,valid_seas,cat,prob,idp_filedate';
  /* the map server answers HTTP 200 with {"error":{…}} when it rejects a query */
  async function arc(ctx, url) { const j = await ctx.http.json(url, ARC); if (!j || j.error) throw new Error('the map service refused the query: ' + String((j && j.error && (j.error.message || j.error.code)) || 'empty answer').slice(0, 80)); return j; }

  /* ---------- outlook bands ---------- */
  /* prob is the lower edge of the shaded band the place sits in: 33 (33 to 40), 40 (40 to 50), 50, 60, 70, 80, 90. The areas
     do not nest: a place is inside exactly one band. */
  const BAND_TOP = { 33: 40, 40: 50, 50: 60, 60: 70, 70: 80, 80: 90, 90: 100 };
  const code = b => !b || !b.cat ? '' : b.cat === 'EC' ? 'EC' : b.cat.charAt(0) + b.prob;                     /* A50, B40, N36, EC */
  /* The distinct bands in a query answer, newest issue only (during the daily swap two issues can be present for a moment). */
  function bandsOf(j) {
    const fs = ((j && j.features) || []).map(f => (f && f.attributes) || {}).filter(a => a.cat && typeof a.cat === 'string');
    if (!fs.length) return null;
    const newest = Math.max(...fs.map(a => (num(a.fcst_date) ? a.fcst_date : 0))), cur = fs.filter(a => (num(a.fcst_date) ? a.fcst_date : 0) === newest), seen = {}, bands = [];
    cur.forEach(a => { const b = { cat: a.cat, prob: num(a.prob) ? Math.round(a.prob) : null }; if (!seen[code(b)]) { seen[code(b)] = 1; bands.push(b); } });
    const a0 = cur[0], files = cur.map(a => a.idp_filedate).filter(num);
    return { issued: ymd(a0.fcst_date), start: ymd(a0.start_date), end: ymd(a0.end_date), valid: a0.valid_seas || null, file: files.length ? iso(Math.max(...files)) : null, bands };
  }
  /* The three class probabilities (percent) behind a mapped band, by the rule the Climate Prediction Center documents: the
     favored class takes the mapped probability, near normal stays at 33.3 and the opposite class gives up the difference
     until it reaches its floor of 3.3 (favored at 63.3 or more); past that, near normal shrinks. mid: use the middle of the
     band (45 for the 40 to 50 band) instead of its lower edge. An approximation by the Center's own description. */
  function classProbs(cat, prob, mid) {
    if (!cat || cat === 'EC') return { b: T3, n: T3, a: T3 };
    if (cat === 'Normal') { const n = prob || 36; return { b: (100 - n) / 2, n, a: (100 - n) / 2 }; }
    let p = mid && BAND_TOP[prob] ? (prob + BAND_TOP[prob]) / 2 : prob;
    p = Math.max(T3, Math.min(96.7, p || 0));
    const o = Math.max(10 / 3, 2 * T3 - p), n = 100 - p - o;
    return cat === 'Below' ? { b: p, n, a: o } : { b: o, n, a: p };
  }
  /* The class table row for a window: rows are [doy, tLo, tHi, hdd, hddB, hddN, hddA], seven days apart by window start. */
  function classRow(tbl, start, len) {
    const rows = tbl && (len <= 5 ? tbl.w5 : tbl.w7), t = Date.parse(String(start) + 'T00:00:00Z'); if (!rows || !rows.length || Number.isNaN(t)) return null;
    const d = new Date(t), y = d.getUTCFullYear(), leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    let doy = Math.round((t - Date.UTC(y, 0, 1)) / DAY) + 1; if (leap && doy > 59) doy--;
    const gap = r => { const g = Math.abs(r[0] - doy); return Math.min(g, 365 - g); };
    return rows.reduce((a, b) => (gap(b) < gap(a) ? b : a));
  }
  /* What the outlook means in heating degree days at DFW Airport: the class probabilities times the 1991 to 2020 mean load of
     each class for that calendar window. idx: percent of the normal load (100 = normal). coldBelowF: the mean temperature the
     window has to stay under to count as below normal; warmAboveF: the mean it has to pass to count as above normal. */
  function loadOf(tbl, o) {
    if (!o || !o.start || !o.end || !o.cat) return null;
    const days = Math.round((Date.parse(o.end) - Date.parse(o.start)) / DAY) + 1, r = classRow(tbl, o.start, days); if (!r) return null;
    const p = classProbs(o.cat, o.prob, true), exp = (p.b * r[4] + p.n * r[5] + p.a * r[6]) / 100;
    return { days, normHdd: r[3], expHdd: r1(exp), idx: r[3] >= 1 ? Math.round(100 * exp / r[3]) : null, coldBelowF: r[1], coldHdd: r[4], nearHdd: r[5], warmAboveF: r[2], warmHdd: r[6] };
  }
  /* One extended range outlook at the 12 counties. One request when every county sits in the same band, 1 + 12 when the
     metro is split: then each county is asked on its own and the headline is the band most counties share (the office's
     county breaks a tie). */
  async function outlookAt(ctx, path, pts, homeCounty) {
    const o = bandsOf(await arc(ctx, qMulti(path, F_EXT, pts))); if (!o) throw new Error('no outlook area covers the 12 counties');
    let counties = null, head = o.bands[0];
    if (o.bands.length > 1) {
      counties = {};
      for (const p of pts) { const one = bandsOf(await arc(ctx, qPoint(path, F_EXT, p))); if (one && one.issued === o.issued) counties[p.county] = one.bands[0]; }
      const names = Object.keys(counties), n = {}; if (!names.length) throw new Error('the metro is split between bands and no county could be read');
      names.forEach(c => { const k = code(counties[c]); n[k] = (n[k] || 0) + 1; });
      const most = Math.max(...Object.keys(n).map(k => n[k])), tied = Object.keys(n).filter(k => n[k] === most), home = counties[homeCounty] ? code(counties[homeCounty]) : '';
      const top = tied.indexOf(home) >= 0 ? home : tied[0];
      head = names.map(c => counties[c]).find(b => code(b) === top);
    }
    const p = classProbs(head.cat, head.prob, true);
    return { issued: o.issued, start: o.start, end: o.end, file: o.file, cat: head.cat, prob: head.prob, uniform: o.bands.length === 1, bands: o.bands, counties, pB: r1(p.b), pN: r1(p.n), pA: r1(p.a) };
  }

  /* ---------- hazards areas ---------- */
  /* layers of the hazards service: days 3 to 7 come from the Weather Prediction Center, days 8 to 14 from the Climate Prediction Center */
  const HAZ = [{ id: 1, win: 'd3_7', kind: 'temp' }, { id: 3, win: 'd8_14', kind: 'temp' }, { id: 4, win: 'd3_7', kind: 'precip' }, { id: 6, win: 'd8_14', kind: 'precip' }];
  const COLD_HAZ = /hazardous cold|much below normal|frost|freeze|heavy snow|freezing rain|heavy ice/i;
  const hazRow = (h, a) => ({ win: h.win, kind: h.kind, label: String(a.label), start: ymd(a.start_date), end: ymd(a.end_date), cold: COLD_HAZ.test(a.label) });
  const uniq = rows => { const seen = {}; return rows.filter(r => { const k = [r.win, r.kind, r.label, r.start, r.end].join('|'); if (seen[k]) return false; seen[k] = 1; return true; }); };
  const attrs = j => ((j && j.features) || []).map(f => (f && f.attributes) || {});
  /* national: every area drawn in the country (context, and the newest file date of each window); metro: the cold areas that
     touch at least one of the 12 counties. The counties are asked about only inside a layer that holds a cold area somewhere. */
  async function hazards(ctx, pts) {
    const HP = 'hazards/cpc_weather_hazards/MapServer', national = [], metro = [], file = {};
    for (const h of HAZ) {
      const fs = attrs(await arc(ctx, qAll(`${HP}/${h.id}`, F_HAZ))).filter(a => a.label && typeof a.label === 'string');
      fs.forEach(a => { national.push(hazRow(h, a)); const t = iso(a.idp_filedate); if (t && (!file[h.win] || t > file[h.win])) file[h.win] = t; });
      if (fs.some(a => COLD_HAZ.test(a.label))) attrs(await arc(ctx, qMulti(`${HP}/${h.id}`, F_HAZ, pts))).forEach(a => { if (a.label && typeof a.label === 'string' && COLD_HAZ.test(a.label)) metro.push(hazRow(h, a)); });
    }
    return { file, national: uniq(national).slice(0, 60), metro: uniq(metro) };
  }

  /* ---------- winter storm impacts, days 1 to 7 ---------- */
  /* 24 hour windows that start every six hours, one probability band per window and place: keep the highest probability of
     each window that touches any of the 12 counties (the right answer whether the bands nest or not). */
  async function winterOdds(ctx, pts) {
    const out = { file: null };
    for (const [key, id] of [['minor', 1], ['moderate', 2]]) {
      const by = {};
      attrs(await arc(ctx, qMulti(`outlooks/wpc_wssi_p/MapServer/${id}`, F_WIN, pts))).forEach(a => {
        const k = a.validstartdatetime; if (!num(k) || !num(a.prob)) return;
        if (!by[k] || a.prob > by[k].prob) by[k] = { start: iso(k), end: iso(a.validenddatetime), prob: Math.round(a.prob) };
        const t = iso(a.idp_filedate); if (t && (!out.file || t > out.file)) out.file = t;
      });
      out[key] = Object.keys(by).sort((a, b) => a - b).map(k => by[k]);
    }
    return out;
  }

  /* ---------- the discussions ---------- */
  const MON = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  /* "Nov 23" beside an issue date → YYYY-MM-DD, rolling into the next year when the month is far behind the issue month */
  function dateNear(mon, day, issued) {
    const m = MON[String(mon).slice(0, 3).toLowerCase()], t = new Date(issued); if (m == null || Number.isNaN(+t) || !(+day >= 1 && +day <= 31)) return null;
    return new Date(Date.UTC(t.getUTCFullYear() + (m < t.getUTCMonth() - 6 ? 1 : 0), m, +day)).toISOString().slice(0, 10);
  }
  /* The 6 to 10 and 8 to 14 day discussion (FXUS06 KWBC, PMDMRD): the forecaster's confidence in each outlook (a word and a
     number from 1 to 5; the word speaks of the confidence, not of the temperature), the North Texas row of each state table
     (A above, N near, B below; a state average and a cross check on the map), and the date of the next long lead release. */
  function parseMrd(text) {
    const t = String(text || ''), flat = t.replace(/\s+/g, ' ');
    const conf = w => { const m = new RegExp('FORECAST CONFIDENCE FOR THE ' + w + ' DAY PERIOD:?\\s*([A-Za-z ]+?),\\s*(\\d)\\s*out\\s*(?:of\\s*)?5', 'i').exec(flat); return m ? { word: m[1].trim(), n: +m[2] } : null; };
    const row = head => { const i = t.indexOf(head); if (i < 0) return null; const m = /\bN TEXAS\s+([ANB])\s+([ANB])\b/.exec(t.slice(i, i + 2600)); return m ? { temp: m[1], pcpn: m[2] } : null; };
    const next = /long-lead monthly and seasonal outlooks will be released on\s+([A-Za-z]+\s+\d{1,2})/i.exec(flat);
    return { conf610: conf('6-10'), conf814: conf('8-14'), nTexas610: row('6-10 DAY OUTLOOK TABLE'), nTexas814: row('8-14 DAY OUTLOOK TABLE'), nextLongLead: next ? next[1] : null };
  }
  /* The hazards discussion (FXUS21 KWNC, PMDTHR), days 8 to 14: every "Slight | Moderate | High risk of X for AREA, Day-Day,
     Mon D-D" sentence. hazard, area, days and text are the forecaster's own words (text is the whole sentence, to be shown as
     a quote). kind: the cold season hazard it names in the atlas's words, null when it is not one; cold: kind is set; freeze:
     a freeze is mentioned; near: the area names Texas or the Southern Plains (a mention, not a boundary). Returns null when
     the product has no HAZARDS section. */
  const KIND = [['temps', /below[- ]normal temp/i], ['ice', /freezing (?:rain|drizzle)|\bic(?:e|ing)\b/i], ['snow', /\bsnow\b/i], ['chill', /wind chill/i], ['freeze', /freez/i], ['frost', /\bfrost\b/i], ['cold', /\bcold\b/i]];
  const kindOf = hazard => { const k = KIND.find(x => x[1].test(hazard)); return k ? k[0] : null; };
  const PLAINS = /((?:(?:the|northern|central|southern|eastern|western|north|south|high|great|and|to)\s+)*)plains/gi;
  function nearTexas(area) {
    const s = String(area || '').replace(/\//g, ' and ');
    if (/\btexas\b/i.test(s) || /south[- ]central\s+(?:conus|u\.?\s?s\.?|united states|states|plains)/i.test(s)) return true;
    let m; PLAINS.lastIndex = 0;
    while ((m = PLAINS.exec(s))) if (/south/i.test(m[1])) return true;
    return false;
  }
  const WD = '(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*', MN = '(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\\.?';
  const THR_ITEM = new RegExp('^(Slight|Moderate|High) risk (?:of|for) (.+?),\\s*(' + WD + '(?:\\s*-\\s*' + WD + ')?),\\s*' + MN + '\\s+(\\d{1,2})(?:\\s*-\\s*(?:' + MN + '\\s+)?(\\d{1,2}))?');
  function parseThr(text, issued) {
    const flat = String(text || '').replace(/\s+/g, ' ');
    const syn = /SYNOPSIS:\s*(.*?)\s*HAZARDS\b/.exec(flat), sec = /\bHAZARDS\b(.*?)(?:\bDETAILED SUMMARY\b|\bFORECASTER\b|\$\$|$)/.exec(flat), items = [];
    if (!sec) return null;
    /* one sentence per hazard, wherever the line breaks fall; the forecasters write "for" an area, now and then "from", "across" or "over" */
    sec[1].split(/(?=(?:Slight|Moderate|High) risk (?:of|for) )/).forEach(s => {
      const m = THR_ITEM.exec(s.trim()); if (!m) return;
      const k = m[2].search(/ (?:for|from|across|over) /), hazard = (k < 0 ? m[2] : m[2].slice(0, k)).trim(), area = k < 0 ? '' : m[2].slice(k).replace(/^ (?:for|from|across|over) /, '').trim();
      const start = dateNear(m[4], m[5], issued), end = m[7] ? dateNear(m[6] || m[4], m[7], issued) : start, kind = kindOf(hazard);
      if (!start || !end) return;
      items.push({ risk: m[1], hazard, area, days: m[3].replace(/\s+/g, ''), start, end, kind, cold: !!kind, freeze: /\bfreezes?\b|freezing temperatures/i.test(hazard), near: nearTexas(area), text: m[0].trim().slice(0, 400) });
    });
    return { synopsis: syn ? whole(syn[1], 900) : '', items: items.slice(0, 24) };
  }
  /* The ENSO discussion (FXUS24 KWNC, PMDENS), monthly: the alert status line, the synopsis and the date of the next one. */
  function parseEnso(text) {
    const t = String(text || ''), st = /ENSO Alert System Status:\s*(.+)/.exec(t), sy = /Synopsis:\s*([\s\S]*?)\n\s*\n/.exec(t), nx = /next ENSO Diagnostics? Discussion is scheduled for\s+(\d{1,2} [A-Za-z]+ \d{4})/i.exec(t.replace(/\s+/g, ' '));
    return { status: st ? st[1].trim().slice(0, 80) : null, synopsis: sy ? whole(sy[1].replace(/\s+/g, ' ').trim(), 600) : '', next: nx ? nx[1] : null };
  }
  const DISC = { MRD: 'outlook', THR: 'hazards', ENS: 'ENSO' };
  async function product(ctx, loc) { const j = await within(ctx.http.json(`${NWS}/products/types/PMD/locations/${loc}/latest`, TXT), 'the ' + DISC[loc] + ' discussion'); if (!j || typeof j.productText !== 'string' || !j.productText) throw new Error('no ' + DISC[loc] + ' discussion in the answer'); return j; }

  /* ---------- the long leads ---------- */
  /* The month and the 13 overlapping seasons at the office. Context only: a three month lean says nothing about a given week. */
  async function longLead(ctx, home) {
    const mo = bandsOf(await arc(ctx, qPoint('outlooks/cpc_mthly_temp_outlk/MapServer/0', F_MON, home)));
    /* identify answers for all 13 lead layers in one request; its attributes are text ("10/15/2026", "33") */
    const id = await arc(ctx, qIdentify('outlooks/cpc_sea_temp_outlk/MapServer', home));
    const mdy = s => { const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(String(s || '')); return m ? `${m[3]}-${('0' + m[1]).slice(-2)}-${('0' + m[2]).slice(-2)}` : null; };
    const seasons = (id.results || []).map(r => { const a = (r && r.attributes) || {}; return { lead: r.layerId + 1, valid: a.valid_seas || null, issued: mdy(a.fcst_date), cat: a.cat || null, prob: a.prob == null || a.prob === '' || Number.isNaN(+a.prob) ? null : Math.round(+a.prob) }; }).filter(s => s.valid && s.cat && s.lead >= 1).sort((a, b) => a.lead - b.lead).slice(0, 13);
    if (!mo && !seasons.length) throw new Error('no monthly or seasonal outlook area covers the office');
    return { month: mo ? { valid: mo.valid, issued: mo.issued, cat: mo.bands[0].cat, prob: mo.bands[0].prob } : null, seasons };
  }

  /* The record:
       { v, day (the Dallas date of the run),
         ext: { d610, d814: { issued, start, end, file, cat ('Above' | 'Below' | 'Normal'), prob (the floor of the band), uniform, bands, counties (by name when the
                metro is split, else null), pB, pN, pA, load: { days, normHdd, expHdd, idx, coldBelowF, coldHdd, nearHdd, warmAboveF, warmHdd } | null, pcp: { cat, prob } | null } | null },
         haz: { file: { d3_7, d8_14 }, national: [{ win, kind, label, start, end, cold }], metro: [the same, cold areas that touch a county] } | null,
         winter: { file, minor: [{ start, end, prob }], moderate: [the same] } | null,
         text: { mrd: { issued, conf610, conf814, nTexas610, nTexas814, nextLongLead }, thr: { issued, synopsis, items: [{ risk, hazard, area, days, start, end, kind, cold, freeze, near, text }] },
                 enso: { at, issued, status, synopsis, next } }   (each null until first read; synopsis, hazard, area, days and text are the forecaster's own words),
         long: { at, month: { valid, issued, cat, prob }, seasons: [{ lead, valid, issued, cat, prob }] } | null,
         hist: [{ issued, d610: 'A50', d814: 'B40' }] newest first, errs: { part: what went wrong this run } } */
  const EXT = [['d610', 'outlooks/cpc_6_10_day_outlk/MapServer'], ['d814', 'outlooks/cpc_8_14_day_outlk/MapServer']];
  L.register({
    id: 'cpc_outlook', name: 'Two week outlooks and cold hazards', publisher: 'NOAA Climate Prediction Center and Weather Prediction Center', page: 'https://www.cpc.ncep.noaa.gov/products/predictions/814day/',
    about: 'Where the seven day forecast stops: the odds of a colder or warmer than normal stretch 6 to 10 and 8 to 14 days out for the 12 counties, cold and winter hazard areas drawn for days 3 to 14, winter storm impact odds for the coming week, the hazards the forecasters name in their discussions, and the monthly and seasonal lean. Sets how early the Heat Desk stages heating repair and no heat budgets.',
    hosts: ['mapservices.weather.noaa.gov', 'api.weather.gov'], cadence: 'daily', cors: true, grade: GRADE.outlook, terms: 'U.S. Government work, public domain. The probabilities are the forecasters\' own; the heating load built on them is an estimate of this atlas.', timeoutMs: 180000,
    labels: { below814: ['Chance days 8 to 14 run colder than normal', 'pct'], below610: ['Chance days 6 to 10 run colder than normal', 'pct'], idx814: ['Expected heating load, days 8 to 14 (normal = 100)', 'int'], idx610: ['Expected heating load, days 6 to 10 (normal = 100)', 'int'], coldHazards: ['Cold or winter hazards drawn over the counties or named for North Texas, days 3 to 14', 'int'], winterProb: ['Highest chance of winter storm impacts, next seven days', 'pct'], issued: ['Outlook issued', 'text'] },
    async run(ctx) {
      const G = ctx.geo || {}, prev = ctx.prev || {}, now = +ctx.now, pts = countyPoints(G), tbl = L.cpcClass || null, errs = {};
      if (!pts.length) throw new Error('no county points to ask about');
      const home = G.office || pts[0], near = G.nearest ? G.nearest(home.lat, home.lon, G.points || [], 1)[0] : null, homeCounty = near ? near.p.county : pts[0].county;
      const part = async (key, fn, keep) => { try { return await fn(); } catch (e) { errs[key] = say(e); return keep; } };
      /* ---- extended range: temperature at the 12 counties, then precipitation at the office (cold plus wet is the ice set up) ---- */
      const ext = {}, was = prev.ext || {};
      for (const [key, svc] of EXT) {
        const o = await part(key, () => outlookAt(ctx, svc + '/0', pts, homeCounty), null);
        if (!o) { ext[key] = was[key] || null; continue; }
        o.load = loadOf(tbl, o);
        const pc = await part(key + 'p', async () => bandsOf(await arc(ctx, qPoint(svc + '/1', F_EXT, home))), undefined);
        o.pcp = pc === undefined ? (was[key] && was[key].issued === o.issued ? was[key].pcp || null : null) : pc && pc.issued === o.issued ? pc.bands[0] : null;
        ext[key] = o;
      }
      if (errs.d610 && errs.d814) throw new Error('neither outlook could be read: ' + errs.d814);
      /* ---- hazards areas, winter storm impacts, discussions ---- */
      const haz = await part('haz', () => hazards(ctx, pts), prev.haz || null);
      const winter = await part('winter', () => winterOdds(ctx, pts), prev.winter || null);
      const old = prev.text || {}, text = {};
      text.mrd = await part('mrd', async () => { const j = await product(ctx, 'MRD'), m = parseMrd(j.productText); if (!m.conf610 && !m.conf814 && !m.nTexas610 && !m.nTexas814) throw new Error('the outlook discussion did not read as expected'); return Object.assign({ issued: j.issuanceTime || null }, m); }, old.mrd || null);
      text.thr = await part('thr', async () => { const j = await product(ctx, 'THR'), t = parseThr(j.productText, j.issuanceTime || ctx.now); if (!t) throw new Error('the hazards discussion has no hazards section'); return Object.assign({ issued: j.issuanceTime || null }, t); }, old.thr || null);
      /* ---- weekly parts: issued monthly, so once every six days is plenty ---- */
      const due = at => !at || !(now - +new Date(at) <= 6 * DAY);
      let long = prev.long || null;
      if (due(long && long.at)) { const l = await part('long', () => longLead(ctx, home), null); if (l) long = Object.assign({ at: ctx.now.toISOString() }, l); }
      text.enso = old.enso || null;
      if (due(text.enso && text.enso.at)) { const e = await part('enso', async () => { const j = await product(ctx, 'ENS'); return Object.assign({ at: ctx.now.toISOString(), issued: j.issuanceTime || null }, parseEnso(j.productText)); }, null); if (e) text.enso = e; }
      /* ---- the trail of issues seen, newest first, one line per issue date: { issued, d610: 'A50', d814: 'B40' } ---- */
      const hist = (prev.hist || []).filter(h => h && h.issued).map(h => Object.assign({}, h));
      for (const [key] of EXT) { const o = ext[key]; if (!o || errs[key] || !o.issued) continue; let h = hist.find(x => x.issued === o.issued); if (!h) { h = { issued: o.issued }; hist.push(h); } h[key] = code(o); }
      hist.sort((a, b) => (a.issued < b.issued ? 1 : a.issued > b.issued ? -1 : 0));
      return { v: 1, day: localDay(now), ext, haz, winter, text, long, hist: hist.slice(0, 30), errs };
    },
    digest(d) {
      const e = d.ext || {}, a = e.d610, b = e.d814, live = x => !d.day || !x.end || x.end >= d.day, thr = d.text && d.text.thr, w = d.winter;
      const named = thr ? (thr.items || []).filter(x => x.cold && x.near && live(x)).length : null, drawn = d.haz ? (d.haz.metro || []).filter(x => x.cold && live(x)).length : null;
      const wp = w ? [].concat(w.minor || [], w.moderate || []).map(x => x.prob) : null;
      return { below814: b ? Math.round(b.pB) : null, below610: a ? Math.round(a.pB) : null, idx814: b && b.load ? b.load.idx : null, idx610: a && a.load ? a.load.idx : null,
        coldHazards: named == null && drawn == null ? null : (named || 0) + (drawn || 0), winterProb: wp ? (wp.length ? Math.max(...wp) : 0) : null, issued: [a, b].filter(x => x && x.issued).map(x => x.issued).sort().pop() || null };
    },
  });
  L.cpc = { GRADE, BAND_TOP, COLD_HAZ, bandsOf, classProbs, classRow, loadOf, parseMrd, parseThr, parseEnso, dateNear, nearTexas, kindOf, code, countyPoints, localDay, url: { multi: qMulti, point: qPoint, all: qAll, identify: qIdentify } };
})(typeof globalThis !== 'undefined' ? globalThis : self);
