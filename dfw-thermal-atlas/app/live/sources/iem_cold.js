/* ==== live/sources/iem_cold.js ==== */
/* Iowa Environmental Mesonet: every dated cold hazard product (freeze, frost, hard freeze, extreme cold, cold weather, wind
   chill, winter storm, ice storm, winter weather, freezing fog) that the National Weather Service office in Fort Worth issued
   for the 12 county forecast zones. One request a week asks for the running season (July 1 to June 30) as CSV and replaces
   that season's rows, because end times move when a product is extended or cancelled. The first run also pulls the ten
   winters before it, one season a request (about 600 KB in all, once), and each July the season that just ended is pulled
   once more. Kept as a compact list: about 7 KB for ten winters.
   The service selects rows by start time (checked 2026-11-13), so each request asks for a whole season: a warning issued
   today for tomorrow night is already in the answer, where a request that ends today would miss it. */
(function (root) {
  'use strict';
  const L = root.TDA_LIVE, HOST = 'mesonet.agron.iastate.edu', API = 'https://' + HOST + '/cgi-bin/request/gis/watchwarn.py';
  const V = 1, WINTERS = 10, BUDGET_MS = 70000;
  /* the products asked for, phenomenon and significance (W warning, A watch, Y advisory) paired the way the service wants them */
  const PAIRS = 'FZ.W FZ.A HZ.W HZ.A FR.Y EC.W EC.A CW.Y WC.Y WC.W WC.A WS.W WS.A WW.Y IS.W ZR.Y BZ.W BZ.A ZF.Y SN.Y IP.Y HS.W IP.W SB.Y'.split(' ');
  /* Product names exactly as the Mesonet's own event lists give them (read 2026-11-13: the Dallas County list for fifteen, the
     Fort Worth 2018 event for the Hard Freeze Watch, a Des Moines 2022 event for the Blizzard Warning). The other seven codes in
     the request are retired products that returned nothing in ten winters; a code without a name here is shown as the code. */
  const NAMES = { 'FZ.W': 'Freeze Warning', 'FZ.A': 'Freeze Watch', 'FR.Y': 'Frost Advisory', 'HZ.W': 'Hard Freeze Warning', 'HZ.A': 'Hard Freeze Watch', 'EC.W': 'Extreme Cold Warning', 'EC.A': 'Extreme Cold Watch', 'CW.Y': 'Cold Weather Advisory', 'WC.W': 'Wind Chill Warning', 'WC.A': 'Wind Chill Watch', 'WC.Y': 'Wind Chill Advisory', 'WS.W': 'Winter Storm Warning', 'WS.A': 'Winter Storm Watch', 'WW.Y': 'Winter Weather Advisory', 'IS.W': 'Ice Storm Warning', 'ZF.Y': 'Freezing Fog Advisory', 'BZ.W': 'Blizzard Warning' };
  /* On October 1, 2024 the Weather Service renamed the wind chill products and folded the hard freeze products into the freeze ones */
  const RENAMED = { 'HZ.W': 'FZ.W', 'HZ.A': 'FZ.A', 'WC.W': 'EC.W', 'WC.A': 'EC.A', 'WC.Y': 'CW.Y' };
  /* Grades: the list is the Mesonet's processed copy of the official products (B: measured, with that gap); counts and days read
     straight from it are B; averages over ten winters are a short record used for planning (C). */
  const GRADE = { record: 'B', counts: 'B', climatology: 'C' };
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const nameOf = code => NAMES[code] || String(code);
  const url = s => `${API}?accept=csv&sts=${s}-07-01T00:00Z&ets=${s + 1}-07-01T00:00Z&location_group=wfo&wfo=FWD&limitps=1&phenomena=${PAIRS.map(p => p.slice(0, 2)).join(',')}&significance=${PAIRS.map(p => p.slice(3)).join(',')}`;
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  /* ---------- time: minutes since 1970 in UTC, calendar dates in the metro's time zone ---------- */
  const minOf = t => Math.floor(+new Date(t) / 6e4);
  const stamp = min => new Date(min * 6e4).toISOString().slice(0, 16) + 'Z';
  /* "2026-01-25 00:00" (UTC) to minutes; null when it is not a date */
  const minutes = s => { const m = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])[ T]([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?Z?$/.exec(s || ''); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) / 6e4 : null; };
  let fmt = null;
  function localDate(min) {
    const d = new Date(min * 6e4);
    try { fmt = fmt || new Intl.DateTimeFormat('en-CA', { timeZone: (L.geo && L.geo.tz) || 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }); const p = {}; fmt.formatToParts(d).forEach(x => { p[x.type] = x.value; }); return `${p.year}-${p.month}-${p.day}`; }
    catch (e) { return new Date(+d - 6 * 36e5).toISOString().slice(0, 10); }                          /* no time zone data: Central Standard Time */
  }
  const dayNo = d => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 864e5;
  const dayStr = n => new Date(n * 864e5).toISOString().slice(0, 10);
  /* "2026-11-17" or "11-17" to "November 17" */
  const monthDay = d => { const m = /(\d\d)-(\d\d)$/.exec(d || ''); return m ? MONTHS[+m[1] - 1] + ' ' + (+m[2]) : ''; };
  /* A season runs July 1 to June 30 and carries the year of its July 1. An event belongs to the season its start falls in (UTC,
     the clock the requests are cut on); "now" belongs to the season of today's date in the metro. */
  const seasonOf = min => { const d = new Date(min * 6e4); return d.getUTCFullYear() - (d.getUTCMonth() < 6 ? 1 : 0); };
  const seasonAt = now => { const d = localDate(minOf(now)); return +d.slice(0, 4) - (d.slice(5, 7) < '07' ? 1 : 0); };
  const label = s => `${s} to ${s + 1}`;

  /* ---------- the CSV ---------- */
  /* records of a CSV text: quoted fields, doubled quotes, commas and line breaks inside quotes, either line ending */
  function csv(text) {
    const out = []; let row = [], f = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c !== '"') f += c; else if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
      else if (c === '"') q = true;
      else if (c === ',') { row.push(f); f = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); f = ''; out.push(row); row = []; }
      else f += c;
    }
    if (f !== '' || row.length) { row.push(f); out.push(row); }
    return out.filter(r => r.length > 1 || r[0].trim() !== '');
  }
  const COLS = ['utc_issue', 'utc_expire', 'phenomena', 'significance', 'eventid', 'ugc', 'vtec_year'];
  const got = t => !t.trim() ? 'an empty file' : /^\s*</.test(t) ? 'a web page' : 'text that starts "' + t.trim().slice(0, 40).replace(/[^\w ,.:]+/g, ' ').trim() + '"';
  /* The download as rows { y: VTEC year, code: "FZ.W", id: event number, ugc: zone, b: start, e: end } for every zone the office
     covers; b and e are minutes UTC and e is at or before b when the product was replaced or cancelled before it began. Columns are
     found by name. A row that does not parse is skipped and counted in rows.bad. A header with no rows is a real answer (nothing was
     issued); anything without the header is not, and throws. */
  function parse(text) {
    const t = String(text == null ? '' : text).replace(/^\uFEFF/, ''), recs = csv(t), head = (recs[0] || []).map(h => h.trim().toLowerCase()), at = {};
    COLS.forEach(k => { at[k] = head.indexOf(k); });
    const lost = COLS.filter(k => at[k] < 0);
    if (lost.length) throw new Error(lost.length < COLS.length ? `the cold hazard table from ${HOST} no longer has ${lost.length > 1 ? 'the columns' : 'the column'} ${lost.join(', ')}` : `${HOST} did not send the cold hazard table: got ${got(t)} instead`);
    const rows = []; rows.bad = 0;
    for (let i = 1; i < recs.length; i++) {
      const r = recs[i], g = k => (r[at[k]] || '').trim(), b = minutes(g('utc_issue')), e = minutes(g('utc_expire')), ph = g('phenomena'), sig = g('significance'), id = g('eventid'), y = g('vtec_year'), ugc = g('ugc');
      if (r.length !== head.length || b == null || e == null || !/^[A-Z]{2}$/.test(ph) || !/^[A-Z]$/.test(sig) || !/^\d{1,5}$/.test(id) || !/^(19|20)\d\d$/.test(y) || !/^[A-Z]{2}[CZ]\d{3}$/.test(ugc)) { rows.bad++; continue; }
      rows.push({ y: +y, code: ph + '.' + sig, id: +id, ugc, b, e });
    }
    return rows;
  }
  /* An answer the collector will store: only the products it asked for (the list above, whatever else the service might send), and
     not at all when half of its rows or more do not parse, because the table has then changed and an empty season would be a lie. */
  function read(text) {
    const all = parse(text); if (all.bad && all.bad >= all.length) throw new Error(`the cold hazard table from ${HOST} could not be read: ${all.bad} of ${all.bad + all.length} rows did not parse`);
    const rows = all.filter(r => PAIRS.includes(r.code)); rows.bad = all.bad; return rows;
  }
  /* by start, a warning before an advisory before a watch at the same minute, then by code, year, number and end */
  const rank = c => ('WYA'.indexOf(c[3]) + 4) % 4;
  const order = (a, b) => a[3] - b[3] || rank(a[1]) - rank(b[1]) || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0) || a[0] - b[0] || a[2] - b[2] || a[4] - b[4];
  const geoZones = () => ((L.geo && L.geo.counties) || []).map(c => c.zone);
  /* Rows to the stored list: [vtecYear, code, eventid, beginMinutesUTC, endMinutesUTC, zoneBitmask], one entry per product and
     distinct pair of times; bit i of the mask is zones[i] (the order of the counties in live/geo.js). Rows for any other zone drop
     out here. A zone that left a product and came back keeps both intervals. */
  function compact(rows, zones) {
    zones = zones || geoZones(); const by = {};
    (rows || []).forEach(r => { const i = zones.indexOf(r.ugc); if (i < 0) return; const k = [r.y, r.code, r.id, r.b, r.e].join('|'); if (by[k]) by[k][5] |= 1 << i; else by[k] = [r.y, r.code, r.id, r.b, r.e, 1 << i]; });
    return Object.values(by).sort(order);
  }
  /* distinct products by season and code over every zone of the office: { 2025: { 'FZ.W': 4, ... } } */
  function tally(rows) {
    const seen = {}, out = {};
    (rows || []).forEach(r => { const s = seasonOf(r.b), k = [s, r.y, r.code, r.id].join('|'); if (seen[k]) return; seen[k] = 1; const o = out[s] = out[s] || {}; o[r.code] = (o[r.code] || 0) + 1; });
    return out;
  }

  /* ---------- reads (pure; every one is safe on missing data) ---------- */
  const safe = d => d && Array.isArray(d.events) ? d : { events: [], seasons: [], office: {}, season: null, stale: {} };
  const zonesOf = d => d.zones && d.zones.length ? d.zones : geoZones();
  const countyOf = z => (L.geo && L.geo.byZone && L.geo.byZone[z]) || z;
  const zonesIn = (mask, zones) => (zones || geoZones()).filter((z, i) => mask & (1 << i));
  const countiesIn = (mask, zones) => zonesIn(mask, zones).map(countyOf);
  const maskOf = (d, county) => { const z = zonesOf(d); if (county == null) return Math.pow(2, z.length) - 1; const i = z.findIndex(x => countyOf(x) === county); return i < 0 ? 0 : 1 << i; };
  const of = (d, s) => d.events.filter(e => seasonOf(e[3]) === s);
  const total = o => Object.keys(o).reduce((t, k) => t + o[k], 0);
  /* One season's list folded into counts for the zones in `mask`. A cold hazard day is a calendar date in the metro on which a
     warning or an advisory (not a watch) was in effect, counted from the start to one minute before the end; `cap`, a minute
     stamp, stops the count at that moment. The first Freeze Warning is the first of the fall (a start from July to December):
     the Weather Service issues freeze products only in the growing season, so the spring ones mark late freezes, not first ones. */
  function fold(evs, mask, cap) {
    const seen = {}, byCode = {}, days = new Set(); let n = 0, first = null, fw = null;
    evs.forEach(e => {
      if (!(e[5] & mask)) return;
      const k = e[0] + e[1] + e[2]; if (!seen[k]) { seen[k] = 1; n++; byCode[e[1]] = (byCode[e[1]] || 0) + 1; }
      if (e[4] <= e[3]) return;                                                                        /* replaced or cancelled before it began: issued, never in effect */
      if (!first) first = e;
      if (fw == null && e[1] === 'FZ.W' && localDate(e[3]).slice(5, 7) >= '07') fw = e[3];
      const end = cap == null ? e[4] : Math.min(e[4], cap);
      if (/[WY]$/.test(e[1]) && end > e[3]) for (let a = dayNo(localDate(e[3])), z = dayNo(localDate(end - 1)); a <= z; a++) days.add(a);
    });
    return { events: n, days: days.size, byCode, first: first && { date: localDate(first[3]), code: first[1], name: nameOf(first[1]) }, firstFreezeWarning: fw == null ? null : localDate(fw) };
  }
  /* Every season held, oldest first: [{ season, label, complete, events, days, byCode, first: { date, code, name } | null,
     firstFreezeWarning: date | null, office: { events, byCode } | null }]. Counts are for the 12 counties (opt.county: one county);
     office is the same count over the whole Fort Worth office area. opt.now caps the day count of a season still running. */
  function seasons(data, opt) {
    const d = safe(data), o = opt || {}, mask = maskOf(d, o.county), cap = o.now == null ? null : minOf(o.now);
    if (!mask) return [];
    return (d.seasons || []).slice().sort((a, b) => a - b).map(s => { const off = d.office && d.office[s]; return Object.assign({ season: s, label: label(s), complete: d.season != null && s < d.season }, fold(of(d, s), mask, cap), { office: off ? { events: total(off), byCode: off } : null }); });
  }
  /* One season county by county: { Dallas: { days, events, byCode, firstFreezeWarning }, ... }. The running season when `season`
     is left out. A season that is not held answers null counts, never zeros. */
  function byCounty(data, season, now) {
    const d = safe(data), s = season == null ? d.season : +season, held = (d.seasons || []).includes(s), evs = held ? of(d, s) : [], cap = now == null ? null : minOf(now), out = {};
    zonesOf(d).forEach((z, i) => { const f = fold(evs, 1 << i, cap); out[countyOf(z)] = held ? { days: f.days, events: f.events, byCode: f.byCode, firstFreezeWarning: f.firstFreezeWarning } : { days: null, events: null, byCode: {}, firstFreezeWarning: null }; });
    return out;
  }
  /* The season `now` falls in: { season, label, held, events: [{ code, name, year, id, begin, end, date, counties, withdrawn }],
     days (so far), first, firstFreezeWarning, fallOver, byCode, active: [in effect at now], upcoming: [issued, start still ahead],
     through }. One entry per product: begin and end span the zones it was in effect for (ISO, UTC), date is the local date of
     the start, withdrawn marks a product replaced or cancelled before it began. fallOver: January has come, so a missing first
     Freeze Warning is final. held false means this season has not been pulled yet (its counts are null, not zero). */
  function thisSeason(data, now) {
    const d = safe(data), t = minOf(now == null ? new Date() : now), S = seasonAt(t * 6e4), held = (d.seasons || []).includes(S), evs = held ? of(d, S) : [], f = fold(evs, maskOf(d), t), by = {}, list = [];
    evs.forEach(e => { const k = e[0] + e[1] + e[2]; if (!by[k]) list.push(by[k] = { e, g: [] }); by[k].g.push(e); });
    const shape = (p, g) => { const b = Math.min(...g.map(e => e[3])), en = Math.max(...g.map(e => e[4])); return { code: p.e[1], name: nameOf(p.e[1]), year: p.e[0], id: p.e[2], begin: stamp(b), end: stamp(en), date: localDate(b), counties: countiesIn(g.reduce((m, e) => m | e[5], 0), zonesOf(d)), withdrawn: en <= b }; };
    const pick = test => list.map(p => { const g = p.g.filter(test); return g.length ? shape(p, g) : null; }).filter(Boolean);
    return { season: S, label: label(S), held, events: list.map(p => { const g = p.g.filter(e => e[4] > e[3]); return shape(p, g.length ? g : p.g); }), days: held ? f.days : null, first: f.first, firstFreezeWarning: f.firstFreezeWarning, fallOver: localDate(t).slice(5, 7) < '07', byCode: f.byCode,
      active: pick(e => e[3] <= t && t < e[4]), upcoming: pick(e => e[3] > t && e[4] > e[3]), through: d.archiveThrough || null, grade: GRADE.counts };
  }
  /* The complete seasons held, for planning: { seasons: n, from, to, meanDays, meanEvents, freezeWarningSeasons, firsts: [{ season,
     date, day }], medianFirstFreezeWarning: "MM-DD", earliestFirst, latestFirst (dates), byCode: { code: mean a season }, renamed:
     the same means with the retired codes counted under the names that replaced them, grade }. opt.county: one county. */
  function climatology(data, opt) {
    const all = seasons(data, { county: opt && opt.county }).filter(s => s.complete), n = all.length, r1 = x => Math.round(10 * x) / 10;
    const firsts = all.filter(s => s.firstFreezeWarning).map(s => ({ season: s.season, date: s.firstFreezeWarning, day: dayNo(s.firstFreezeWarning) - dayNo(s.season + '-07-01') })).sort((a, b) => a.day - b.day), m = firsts.length;
    const sum = {}, ren = {}, byCode = {}, renamed = {};
    all.forEach(s => Object.keys(s.byCode).forEach(c => { sum[c] = (sum[c] || 0) + s.byCode[c]; const to = RENAMED[c] || c; ren[to] = (ren[to] || 0) + s.byCode[c]; }));
    Object.keys(sum).sort().forEach(c => { byCode[c] = r1(sum[c] / n); }); Object.keys(ren).sort().forEach(c => { renamed[c] = r1(ren[c] / n); });
    const med = m ? Math.round(m % 2 ? firsts[(m - 1) / 2].day : (firsts[m / 2 - 1].day + firsts[m / 2].day) / 2) : null;
    return { seasons: n, from: n ? all[0].season : null, to: n ? all[n - 1].season : null, meanDays: n ? r1(all.reduce((t, s) => t + s.days, 0) / n) : null, meanEvents: n ? r1(all.reduce((t, s) => t + s.events, 0) / n) : null, freezeWarningSeasons: m, firsts,
      medianFirstFreezeWarning: med == null ? null : dayStr(dayNo('2001-07-01') + med).slice(5), earliestFirst: m ? firsts[0].date : null, latestFirst: m ? firsts[m - 1].date : null, byCode, renamed, grade: GRADE.climatology };
  }
  /* In how many of the complete seasons the first Freeze Warning of the fall had begun by a month and day ("11-15"): { n, of } */
  function firstBy(data, md, opt) { const c = climatology(data, opt), lim = dayNo((md < '07' ? '2002-' : '2001-') + md) - dayNo('2001-07-01'); return { n: c.firsts.filter(f => f.day <= lim).length, of: c.seasons }; }

  const I = L.iem = { V, HOST, PAIRS, NAMES, RENAMED, GRADE, WINTERS, pace: 700, url, nameOf, parse, read, compact, tally, csv, minutes, localDate, monthDay, seasonOf, seasonAt, zonesIn, countiesIn, seasons, byCounty, thisSeason, climatology, firstBy };
  L.register({
    id: 'iem_cold', name: 'Cold watches, warnings and advisories issued', publisher: 'Iowa Environmental Mesonet, Iowa State University', page: 'https://' + HOST + '/request/gis/watchwarn.phtml',
    about: 'Every dated freeze, frost, extreme cold, wind chill, winter storm, ice storm and winter weather product the National Weather Service in Fort Worth issued for the 12 counties, ten winters back and this season to date. Feeds the cold season record: products and cold hazard days by county, and how early the first Freeze Warning usually comes.',
    hosts: [HOST], cadence: 'weekly', cors: true, grade: GRADE.record, terms: 'Public domain, free for any lawful purpose, no warranty of accuracy; credit to the Iowa Environmental Mesonet of Iowa State University is appreciated', timeoutMs: 180000,
    labels: { products: ['Cold hazard products this season', 'int'], days: ['Cold hazard days this season (any of the 12 counties)', 'int'], firstFreezeWarning: ['First Freeze Warning this season', 'text'], active: ['Cold hazard products in effect now', 'int'], seasons: ['Complete seasons in the archive', 'int'] },
    async run(ctx) {
      const t0 = Date.now(), now = ctx.now || new Date(), S = seasonAt(now), zones = ctx.geo.counties.map(c => c.zone), p = ctx.prev;
      const ok = !!p && p.v === V && Array.isArray(p.events) && Array.isArray(p.seasons) && Array.isArray(p.zones) && p.zones.join() === zones.join();
      let events = ok ? p.events.slice() : [], why = '';
      const held = new Set(ok ? p.seasons : []), office = Object.assign({}, ok ? p.office : null), bad = Object.assign({}, ok ? p.bad : null), was = (ok && p.stale) || {}, stale = {};
      const take = (s, rows) => { events = events.filter(e => seasonOf(e[3]) !== s).concat(compact(rows, zones).filter(e => seasonOf(e[3]) === s)); office[s] = tally(rows)[s] || {}; if (rows.bad) bad[s] = rows.bad; else delete bad[s]; held.add(s); };
      /* the running season is the one request that has to answer: when it fails the run fails and the last good record stays */
      take(S, read(await ctx.http.text(url(S))));
      /* then, newest first, each of the ten winters before it that is not held, was left stale, or was still running at the last
         pull. The first failure, or 70 seconds on the clock, ends the pulls for this run; what is missing is named in stale and
         asked for again next time. */
      for (let s = S - 1; s >= S - WINTERS; s--) {
        if (held.has(s) && !(s in was) && !(ok && p.season <= s)) continue;
        if (!why && Date.now() - t0 > BUDGET_MS) why = 'the pull of the archive ran long; the rest follows at the next refresh';
        if (!why) { try { if (I.pace) await sleep(I.pace); take(s, read(await ctx.http.text(url(s)))); continue; } catch (e) { why = String((e && e.message) || e).replace(/[<>]/g, ' ').slice(0, 140); } }
        stale[s] = held.has(s) ? (was[s] || p.archiveThrough || null) : null;                           /* the date the rows kept run through; null: nothing held */
      }
      const seasons = [...held].sort((a, b) => a - b), t = minOf(now);
      return Object.assign({ v: V, fetched: stamp(t), season: S, zones, events: events.sort(order), seasons, office, archiveFrom: seasons[0] + '-07-01', archiveThrough: localDate(t), bad, stale }, why ? { staleWhy: why } : {});
    },
    digest(d) {
      const t = thisSeason(d, d.fetched);
      return { products: t.events.length, days: t.days, firstFreezeWarning: t.firstFreezeWarning ? monthDay(t.firstFreezeWarning) : t.fallOver ? 'none in the fall' : 'none yet', active: t.active.length, seasons: (d.seasons || []).filter(s => s < d.season).length };
    },
  });
})(typeof globalThis !== 'undefined' ? globalThis : self);
