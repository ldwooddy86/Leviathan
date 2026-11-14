/* ==== live/permits.js ==== */
/* City permits for mechanical (heating and air conditioning) work. Permits are the only observed count of replacement jobs
   by ZIP code that any public source holds, so they calibrate the replacement model and show where the work is really done.
   This file is what every city collector shares and makes no request by itself: the heating keyword rule (one definition,
   run as SQL on the city's server and as plain JavaScript here), the date windows, the ArcGIS statistics queries and their
   parser, the record every city stores, and L.permits.summary, the read the modules call.
   The record of one city: { v, city, through (latest permit date), months: [{ m, mech, heat, heatOnly }] (up to 36 complete
   months, oldest first), byZip12: { zip: [mech, heat] } and zipMonths: [first, last] (the last 12 complete months), recent:
   { weeks: 8, from, to, mech, heat, sameWeeksLastYear: { from, to, mech, heat } }, described: { n, of }, multi, rule, what,
   residentialOnly, stale: [blocks kept from the previous run] }. heat and heatOnly are null wherever the city does not write
   down what was installed: null means unknown, never zero. A city whose descriptions changed in kind adds heatSince, the first
   month whose heating counts can be set beside today's: a 12 month heating total that reaches back before it stays unknown.
   A collector may add blocks of its own (Dallas adds its gas tests and the eras of its file); the reads here ignore them. */
(function (root) {
  'use strict';
  const L = root.TDA_LIVE, DAY = 864e5;
  const KEEP = 36, LOOKBACK = 40, WEEKS = 8, MIN_DESC = 0.5;        /* months kept, months asked for, the recent window, and the share of permits that must carry a description before heating is counted */

  /* ---------- dates: plain 'YYYY-MM-DD' and 'YYYY-MM' strings ---------- */
  const FMT = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' });
  const today = now => FMT.format(new Date(now));                                         // the calendar day in Dallas Fort Worth
  const month = now => today(now).slice(0, 7);                                            // and its month key
  const utcDay = ms => new Date(ms).toISOString().slice(0, 10);
  /* A permit date as the cities store it: milliseconds at midnight UTC of the permit's day (Fort Worth) or at local midnight
     written in UTC, five or six hours later (Irving), or a plain date string. The UTC calendar day is the permit's day in each. */
  const day = v => typeof v === 'number' && Number.isFinite(v) ? utcDay(v) : typeof v === 'string' && /^\d{4}-\d\d-\d\d/.test(v) ? v.slice(0, 10) : null;
  const addDays = (ymd, k) => utcDay(Date.parse(ymd + 'T00:00:00Z') + k * DAY);
  const addMonths = (ym, k) => { const t = (+ym.slice(0, 4)) * 12 + (+ym.slice(5, 7)) - 1 + k; return Math.floor(t / 12) + '-' + String(t % 12 + 1).padStart(2, '0'); };
  const monthKey = (y, m) => Number.isInteger(y) && Number.isInteger(m) && m >= 1 && m <= 12 ? y + '-' + String(m).padStart(2, '0') : null;
  /* The windows of a record, anchored on the latest permit the feed holds and not on the clock, so a feed that runs late
     never shows a half filled month as a drop: a month is complete once the feed holds a later permit. */
  function windows(through) {
    const cur = through.slice(0, 7), r0 = addDays(through, 1 - WEEKS * 7);
    return { cur, last: addMonths(cur, -1), z0: addMonths(cur, -12) + '-01', z1: cur + '-01', r0, r1: through, y0: addDays(r0, -364), y1: addDays(through, -364) };
  }

  /* ---------- the heating keyword rule ---------- */
  /* Every test is a plain substring test on the upper cased description with one space added at each end: exactly what SQL
     LIKE does, so the rule gives the same answer on the city's server and in the page. Wording as the cities write it: Irving
     2022 to 2025, Fort Worth 2008 to 2012 and a 2026 sample of nine other Dallas Fort Worth cities.
     heat: the description names heating equipment. heatOnly: it does, and names no cooling equipment and no whole system
     (a furnace or heater replaced by itself, the job the cold weather causes). */
  const RULE = {
    heat: ['FURNACE', ' FURN ', 'BOILER', ' HP/AH', 'TON HP '],
    word: 'HEAT', not: ['WATER HEAT', 'POOL HEAT', 'THEAT', 'WHEAT', 'HEATH'],
    cool: ['CONDENS', ' COND ', 'CONDITION', 'COIL', 'EVAP', ' AC ', ' AC/', '/AC ', 'A/C', ' C/U ', 'COOL', 'COMPRESSOR', 'SEER', 'OUTDOOR', 'HEAT PUMP', 'HEATPUMP', ' HP/', 'TON HP ', 'AND AIR', '& AIR'],
    whole: ['SYSTEM', ' SYS ', 'HVAC', 'HAVC', 'COMPLETE', 'SPLIT', 'PACKAGE', 'ROOFTOP', ' RTU', 'HANDLER', ' AH ', '/AH '],
  };
  const RULE_TEXT = 'Heating: the work description names a furnace (FURNACE, FURN), a boiler, a heat pump (also HP/AH, TON HP) or any heater or heating (HEAT, unless it is a water heater, a pool heater, or part of THEATER, WHEAT or HEATH). Heating only: the same, with no cooling equipment (condenser, coil, AC, heat pump) and no whole system (SYSTEM, HVAC, COMPLETE, SPLIT, PACKAGE, air handler) named.';
  const pad = t => ' ' + String(t == null ? '' : t).toUpperCase() + ' ';
  const hasAny = (x, list) => list.some(p => x.includes(p));
  const isHeat = t => { const x = pad(t); return hasAny(x, RULE.heat) || (x.includes(RULE.word) && !hasAny(x, RULE.not)); };
  const isHeatOnly = t => { const x = pad(t); return isHeat(t) && !hasAny(x, RULE.cool) && !hasAny(x, RULE.whole); };
  const isDescribed = (t, blank) => { const s = String(t == null ? '' : t).trim(); return s !== '' && !(blank || []).includes(s); };
  /* the same three tests as SQL over a text field */
  const padSql = f => `CONCAT(CONCAT(' ', UPPER(${f})), ' ')`;
  const likeAny = (f, list) => '(' + list.map(p => `${padSql(f)} LIKE '%${p}%'`).join(' OR ') + ')';
  const heatSql = f => `(${likeAny(f, RULE.heat)} OR (${likeAny(f, [RULE.word])} AND NOT ${likeAny(f, RULE.not)}))`;
  const heatOnlySql = f => `(${heatSql(f)} AND NOT ${likeAny(f, RULE.cool.concat(RULE.whole))})`;
  const describedSql = (f, blank) => `(${f} IS NOT NULL AND ${f} <> ''` + ((blank || []).length ? ` AND ${f} NOT IN (${blank.map(b => "'" + String(b).replace(/'/g, "''") + "'").join(', ')})` : '') + ')';

  /* ---------- ArcGIS statistics queries ---------- */
  const stat = (type, on, as) => ({ statisticType: type, onStatisticField: on, outStatisticFieldName: as });
  const sumIf = (cond, as) => stat('sum', `CASE WHEN ${cond} THEN 1 ELSE 0 END`, as);
  const maxIf = (cond, as) => stat('max', `CASE WHEN ${cond} THEN 1 ELSE 0 END`, as);
  const form = p => Object.keys(p).filter(k => p[k] != null && p[k] !== '').map(k => encodeURIComponent(k) + '=' + encodeURIComponent(typeof p[k] === 'string' ? p[k] : JSON.stringify(p[k]))).join('&');
  /* The rows of a statistics answer. ArcGIS reports a refused query with HTTP 200 and an error object in the body. */
  function rows(j) {
    if (!j || typeof j !== 'object') throw new Error('the permit service sent no answer');
    if (j.error) throw new Error('the permit service refused the query: ' + [j.error.code, j.error.message].concat(j.error.details || []).filter(Boolean).join(' ').slice(0, 160));
    if (!Array.isArray(j.features)) throw new Error('the permit service sent no rows');
    return j.features.map(f => (f && f.attributes) || {});
  }
  /* One statistics query, sent as a form post: the heating rule makes the query longer than a URL should be. A second between
     calls, 28 seconds for an answer and one more try after a busy or failed one, so three requests fit the time a source is given. */
  const POST = { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, gapMs: 1000, retries: 1, timeoutMs: 28000 };
  const query = (http, layer, p) => http.json(layer + '/query', Object.assign({}, POST, { body: form(Object.assign({}, p, { f: 'json' })) }));
  /* every page of a grouped answer (the service returns 1,000 groups at a time) */
  async function queryAll(http, layer, p, maxPages) {
    let out = [];
    for (let i = 0; i < (maxPages || 5); i++) {
      const j = await query(http, layer, out.length ? Object.assign({}, p, { resultOffset: out.length }) : p), r = rows(j);
      out = out.concat(r); if (!j.exceededTransferLimit || !r.length) return out;
    }
    throw new Error('the permit service answer runs past ' + out.length + ' rows');
  }
  const zipOf = v => { const m = /^(\d{5})(?:\D|$)/.exec(String(v == null ? '' : v).trim()); return m && m[1] !== '00000' ? m[1] : null; };

  /* ---------- the record, built from counts (the same for every source: ArcGIS here, Socrata for Dallas) ---------- */
  /* o: { city, asked (the first month asked for, 'YYYY-MM'), through (the latest permit date), months: { 'YYYY-MM': { n, ds, ht, ho } }
          (rows, rows with a description, heating rows, heating only rows), extra: [{ x, d, zip, ds, ht, ho }] (a permit that fills
          several rows: x rows too many, dated d, with 1 or 0 for described, heating, heating only) or null when a row is a permit,
          told (the file has a work description field), what, residentialOnly }
     Months are complete months only, oldest first, gaps filled with zero; a feed that begins inside the window loses its first
     month, which may be partial. Heating is counted only where at least half the permits say what was done. */
  function record(o) {
    const W = windows(o.through), extra = o.extra || [], byM = {}, zero = { n: 0, ds: 0, ht: 0, ho: 0 };
    for (const m of Object.keys(o.months || {})) byM[m] = Object.assign({}, zero, o.months[m]);
    for (const u of extra) { const b = byM[u.d.slice(0, 7)]; if (b) { b.n -= u.x; b.ds -= u.x * u.ds; b.ht -= u.x * u.ht; b.ho -= u.x * u.ho; } }
    let ms = Object.keys(byM).sort().filter(m => m < W.cur); if (ms.length && ms[0] > o.asked) ms = ms.slice(1);
    const all = []; if (ms.length) for (let m = ms[0]; m <= W.last; m = addMonths(m, 1)) all.push(Object.assign({ m }, byM[m] || zero));
    const kept = all.slice(-KEEP), described = kept.slice(-12).reduce((a, x) => { a.n += x.ds; a.of += x.n; return a; }, { n: 0, of: 0 }), told = teller(o.told ? described : null);
    const months = kept.map(x => { const k = told(x.n, x.ds); return { m: x.m, mech: x.n, heat: k ? x.ht : null, heatOnly: k ? x.ho : null }; });
    return { v: 1, city: o.city, through: o.through, months, byZip12: null, zipMonths: null, recent: null, described: o.told ? described : null, multi: o.extra ? { permits: extra.length, rows: extra.reduce((s, u) => s + u.x, 0) } : null, rule: RULE_TEXT, what: o.what || '', residentialOnly: !!o.residentialOnly, stale: [] };
  }
  /* is heating known for a group of n permits of which ds carry a description? An empty group follows the city's last 12 months. */
  const teller = described => (n, ds) => !!described && (n > 0 ? ds / n >= MIN_DESC : described.of > 0 && described.n / described.of >= MIN_DESC);
  /* The ZIP table of the last 12 complete months and the two eight week windows, added to a record from counts by ZIP code:
     zrows [{ zip, n12, d12, h12, nr, dr, hr, ny, dy, hy }] (permits, described, heating in each window of windows(rec.through)). */
  function addZips(rec, zrows, extra) {
    const W = windows(rec.through), told = teller(rec.described), zs = {}, S = { n12: 0, d12: 0, h12: 0, nr: 0, dr: 0, hr: 0, ny: 0, dy: 0, hy: 0 };
    for (const r of zrows || []) { for (const k in S) S[k] += r[k] || 0; const z = zipOf(r.zip); if (z) { const e = zs[z] || (zs[z] = [0, 0]); e[0] += r.n12 || 0; e[1] += r.h12 || 0; } }
    for (const u of extra || []) {
      if (u.d >= W.z0 && u.d < W.z1) { S.n12 -= u.x; S.d12 -= u.x * u.ds; S.h12 -= u.x * u.ht; if (u.zip && zs[u.zip]) { zs[u.zip][0] -= u.x; zs[u.zip][1] -= u.x * u.ht; } }
      if (u.d >= W.r0 && u.d <= W.r1) { S.nr -= u.x; S.dr -= u.x * u.ds; S.hr -= u.x * u.ht; }
      if (u.d >= W.y0 && u.d <= W.y1) { S.ny -= u.x; S.dy -= u.x * u.ds; S.hy -= u.x * u.ht; }
    }
    const k12 = told(S.n12, S.d12); rec.byZip12 = {};
    for (const z of Object.keys(zs).sort()) if (zs[z][0] > 0) rec.byZip12[z] = [zs[z][0], k12 ? zs[z][1] : null];
    rec.zipMonths = [W.z0.slice(0, 7), W.last];
    rec.recent = { weeks: WEEKS, from: W.r0, to: W.r1, mech: S.nr, heat: told(S.nr, S.dr) ? S.hr : null, sameWeeksLastYear: { from: W.y0, to: W.y1, mech: S.ny, heat: told(S.ny, S.dy) ? S.hy : null } };
    return rec;
  }
  /* the ZIP query failed: the months are fresh, the ZIP table and the recent weeks stay as the last good run left them, and the record says so */
  function keepZips(rec, prev, e) {
    prev = prev || {}; rec.byZip12 = prev.byZip12 || null; rec.zipMonths = prev.zipMonths || null; rec.recent = prev.recent || null;
    rec.stale = ['byZip12', 'recent']; rec.err = String((e && e.message) || e).slice(0, 160); return rec;
  }

  /* ---------- the collector every ArcGIS city shares ---------- */
  /* cfg: { city, layer (the layer URL), date (the permit date field), base (the where clause that means mechanical work),
            zip (a field, or an SQL expression that yields the ZIP code; null when the file has none), id (the permit number,
            when one permit can fill several rows; null when a row is a permit), desc (the work description field or null),
            blank: [texts that stand for no description], residentialOnly, what (one sentence: which permits are counted) }
     Three requests, every one a server side aggregate: months, the permits that fill several rows, ZIP codes with the windows.
     Without the first two there is no honest count, so either failing fails the run; the third failing leaves a partial record. */
  async function arcgisRun(cfg, ctx) {
    const D = cfg.date, T = cfg.desc || null, Z = cfg.zip || null, zKey = Z && /^\w+$/.test(Z) ? Z : 'EXPR_1';
    const t = today(ctx.now), asked = addMonths(month(ctx.now), -LOOKBACK);
    /* the upper bound keeps a mistyped future date from moving every window */
    const base = `${cfg.base} AND ${D} >= DATE '${asked}-01' AND ${D} < DATE '${addDays(t, 2)}'`;
    const desc = T ? describedSql(T, cfg.blank) : null, heat = T ? heatSql(T) : null, only = T ? heatOnlySql(T) : null;
    const ym = `EXTRACT(YEAR FROM ${D}),EXTRACT(MONTH FROM ${D})`;

    /* 1. permits by month, and the latest permit date */
    const months = {}; let through = null;
    for (const r of rows(await query(ctx.http, cfg.layer, { where: base, outStatistics: [stat('count', D, 'n'), stat('max', D, 'mx')].concat(T ? [sumIf(desc, 'ds'), sumIf(heat, 'ht'), sumIf(only, 'ho')] : []), groupByFieldsForStatistics: ym, orderByFields: ym }))) {
      const m = monthKey(r.EXPR_1, r.EXPR_2), d = day(r.mx); if (!m || !(r.n > 0)) continue;
      months[m] = { n: r.n, ds: r.ds || 0, ht: r.ht || 0, ho: r.ho || 0 }; if (d && (!through || d > through)) through = d;
    }
    if (!through) throw new Error('the ' + cfg.city + ' permit file holds no mechanical permit since ' + asked);

    /* 2. a permit on several parcels or with several owners fills several rows: find those, so each permit counts once per ZIP code */
    const extra = !cfg.id ? null : (await queryAll(ctx.http, cfg.layer, { where: base, outStatistics: [stat('count', D, 'n'), stat('min', D, 'd')].concat(T ? [maxIf(desc, 'ds'), maxIf(heat, 'ht'), maxIf(only, 'ho')] : []), groupByFieldsForStatistics: cfg.id + (Z ? ',' + Z : ''), having: `COUNT(${D}) > 1`, orderByFields: cfg.id }))
      .map(r => ({ x: r.n - 1, d: day(r.d), zip: Z ? zipOf(r[zKey]) : null, ds: r.ds ? 1 : 0, ht: r.ht ? 1 : 0, ho: r.ho ? 1 : 0 })).filter(u => u.x > 0 && u.d);
    const rec = record({ city: cfg.city, asked, through, months, extra, told: !!T, what: cfg.what, residentialOnly: cfg.residentialOnly });

    /* 3. the last 12 complete months by ZIP code, the last eight weeks and the same weeks a year earlier: one grouped query */
    try {
      const W = windows(through), win = (a, b) => `${D} >= DATE '${a}' AND ${D} < DATE '${b}'`, c12 = win(W.z0, W.z1), cr = win(W.r0, addDays(W.r1, 1)), cy = win(W.y0, addDays(W.y1, 1));
      const st = [sumIf(c12, 'n12'), sumIf(cr, 'nr'), sumIf(cy, 'ny')].concat(T ? [sumIf(`${c12} AND ${desc}`, 'd12'), sumIf(`${c12} AND ${heat}`, 'h12'), sumIf(`${cr} AND ${desc}`, 'dr'), sumIf(`${cr} AND ${heat}`, 'hr'), sumIf(`${cy} AND ${desc}`, 'dy'), sumIf(`${cy} AND ${heat}`, 'hy')] : []);
      const zr = await queryAll(ctx.http, cfg.layer, Object.assign({ where: `${cfg.base} AND ${D} >= DATE '${W.y0 < W.z0 ? W.y0 : W.z0}' AND ${D} < DATE '${addDays(through, 1)}'`, outStatistics: st }, Z ? { groupByFieldsForStatistics: Z, orderByFields: Z } : {}));
      addZips(rec, zr.map(r => Object.assign({}, r, { zip: Z ? r[zKey] : null })), extra);
    } catch (e) { keepZips(rec, ctx.prev, e); }
    return rec;
  }

  /* ---------- reads ---------- */
  const sumOf = (list, k) => list.reduce((s, x) => s == null || x[k] == null ? null : s + x[k], 0);
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthName = ym => MONTHS[+ym.slice(5, 7) - 1] + ' ' + ym.slice(0, 4), thousands = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  /* Why a heating count is missing, as one plain sentence to print beside the gap (null when nothing is missing): the city
     does not write the work down, or its 12 months reach back before the month its heating counts became comparable. */
  function heatNote(d, ms, last12, prior12) {
    if (!ms.length) return null;
    const c = d.city, hs = d.heatSince || null, ds = d.described, since = hs ? 'Heating permits in ' + c + ' are comparable from ' + monthName(hs) + ' on, when the city changed how the work is written down: ' : '';
    if (ms[ms.length - 1].heat == null) return ds && ds.of > 0 ? c + ' wrote down the work on ' + thousands(ds.n) + ' of ' + thousands(ds.of) + ' permits in the last 12 months, too few to tell heating from cooling: the heating count is unknown, not zero.' : c + ' does not publish what each permit was for: the heating count is unknown, not zero.';
    if (last12 && last12.heat == null) return hs && ms[Math.max(0, ms.length - 12)].m < hs ? since + 'a 12 month count needs 12 complete months since then.' : 'Some of the last 12 months in ' + c + ' carry too few descriptions to count heating: the 12 month heating count is unknown, not zero.';
    if (prior12 && prior12.heat == null && hs && ms[Math.max(0, ms.length - 24)].m < hs) return since + 'there is no reading against the year before until both years sit after it.';
    return null;
  }
  /* one city's record as the modules read it: the last 12 complete months against the 12 before */
  function cityView(id, d) {
    const ms = Array.isArray(d.months) ? d.months : [], hs = d.heatSince || null;
    /* a 12 month heating total is given only where all 12 months count heating the same way */
    const blk = l => { const ok = !hs || l[0].m >= hs; return { mech: sumOf(l, 'mech'), heat: ok ? sumOf(l, 'heat') : null, heatOnly: ok ? sumOf(l, 'heatOnly') : null }; };
    const last12 = ms.length >= 12 ? blk(ms.slice(-12)) : null, prior12 = ms.length >= 24 ? blk(ms.slice(-24, -12)) : null;
    const yoyPct = last12 && prior12 && prior12.mech > 0 ? Math.round((last12.mech / prior12.mech - 1) * 1000) / 10 : null;
    return { id, city: d.city, through: d.through || null, months: ms, last12, prior12, yoyPct, recent: d.recent || null, zips: d.byZip12 ? Object.keys(d.byZip12).length : null, zipMonths: d.zipMonths || null, described: d.described || null, heatSince: hs, heatNote: heatNote(d, ms, last12, prior12), residentialOnly: !!d.residentialOnly, what: d.what || '', stale: d.stale || [] };
  }
  /* Every city permit record merged, for any number of cities. recs: the stored records by source id ({ id: { data } }, as
     LIVE.all() returns them) or the data objects themselves. Nothing is counted twice: where two sources hold the same city,
     only the one with the later permit is read; a permit sits in one city's file only, so a ZIP code two cities reach into
     appears once and carries the sum, under the city with more permits there, with each city's part beside it (parts). A
     known heating count plus an unknown one is unknown. zips counts each ZIP code once however many cities share it; grades are
     the evidence grades of the two kinds of figure (GRADES); heatRef are the fixed references below, each with its dated label. */
  function summary(recs) {
    const pick = {}, cities = [], byZip = {}; let through = null;
    for (const id of Object.keys(recs || {}).sort()) {
      const r = recs[id], d = r && r.data !== undefined ? r.data : r;
      if (!/^permits_/.test(id) || !d || typeof d !== 'object' || !d.city || !Array.isArray(d.months)) continue;
      const k = String(d.city).trim().toLowerCase(), was = pick[k]; if (!was || String(d.through || '') > String(was.d.through || '')) pick[k] = { id, d };
    }
    for (const k of Object.keys(pick).sort((a, b) => pick[a].id < pick[b].id ? -1 : 1)) {
      const id = pick[k].id, d = pick[k].d;
      cities.push(cityView(id, d)); if (d.through && (!through || d.through > through)) through = d.through;
      for (const zip of Object.keys(d.byZip12 || {})) {
        const v = d.byZip12[zip] || [], mech = v[0] || 0, heat = v[1] == null ? null : v[1], z = byZip[zip], part = { city: d.city, mech12: mech, heat12: heat };
        if (!z) byZip[zip] = { city: d.city, mech12: mech, heat12: heat, top: mech, parts: [part] };
        else { z.shared = true; z.heat12 = z.heat12 == null || heat == null ? null : z.heat12 + heat; z.mech12 += mech; z.parts.push(part); if (mech > z.top) { z.top = mech; z.city = d.city; } }
      }
    }
    for (const zip in byZip) { delete byZip[zip].top; if (!byZip[zip].shared) delete byZip[zip].parts; }
    return { cities, byZip, zips: Object.keys(byZip).length, through, grades: Object.assign({}, GRADES), heatRef: ref() };
  }
  /* The grade to print beside each figure. Permit counts are the city's own, but permits capture only a share of the work: B.
     The heating split reads free text with a keyword rule and counts only the permits that name the equipment (most changeouts
     are written up as a whole system), so it is a floor: C. */
  const GRADES = { mech: 'B', heat: 'C' };
  const LABELS = { mech12: ['Mechanical permits, last 12 full months', 'int'], heat12: ['Permits that name heating, last 12 full months', 'int'], yoyPct: ['Change against the prior 12 months', 'pct'], through: ['Latest permit date', 'text'], zips: ['ZIP codes with permits', 'int'] };
  const digest = d => { const c = cityView('', d); return { mech12: c.last12 ? c.last12.mech : null, heat12: c.last12 ? c.last12.heat : null, yoyPct: c.yoyPct, through: c.through, zips: c.zips }; };

  /* ---------- what share of mechanical permits is heating work ---------- */
  /* Measured twice, where a city wrote down what was installed, by the rule above on the city's own server on 2026-11-13
     (the answers are kept in tests/fixtures/permits and a test holds these numbers to them). Counts by month of the year,
     January first, three years summed. Fixed references, not live readings: Irving stopped publishing on 2025-02-28 and
     Fort Worth stopped recording the work description in 2014. The permit counts are grade B and the heating split grade C,
     as everywhere in this file. ref() gives each one a label that carries its dates: print that label wherever the numbers
     show, so a reader never takes them for this year's. */
  const REF = [
    { city: 'Irving', what: 'residential mechanical permits pulled outside a building permit', from: '2022-03', to: '2025-02', residentialOnly: true, described: [1699, 1700], measured: '2026-11-13', grade: 'B', heatGrade: 'C',
      note: 'A fixed reference, not a live reading: the City of Irving stopped publishing this file on 2025-02-28.',
      mech: [94, 76, 112, 154, 184, 199, 221, 191, 124, 132, 100, 113], heat: [31, 18, 16, 18, 28, 20, 21, 10, 16, 19, 17, 24], heatOnly: [27, 6, 6, 0, 2, 0, 0, 1, 3, 4, 8, 11] },
    { city: 'Fort Worth', what: 'mechanical permits pulled outside a building permit, homes and businesses together', from: '2010-01', to: '2012-12', residentialOnly: false, described: [10030, 12612], measured: '2026-11-13', grade: 'B', heatGrade: 'C',
      note: 'A fixed reference, not a live reading: Fort Worth stopped writing the work on its permits in 2014.',
      mech: [747, 711, 982, 1162, 1112, 1405, 1302, 1456, 1135, 942, 819, 839], heat: [140, 101, 130, 164, 145, 174, 178, 186, 164, 136, 114, 133], heatOnly: [49, 33, 25, 23, 24, 21, 19, 22, 35, 40, 48, 43] },
  ];
  /* the references with their label (city and dates), totals and shares: heating as a share of all mechanical permits, heating only likewise, and the share of the heating only permits pulled November to February */
  function ref() {
    const s = a => a.reduce((x, y) => x + y, 0), p = (a, b) => b > 0 ? Math.round(a / b * 1000) / 10 : null;
    return REF.map(r => { const mech = s(r.mech), heat = s(r.heat), only = s(r.heatOnly); return Object.assign({}, r, { label: r.city + ', ' + monthName(r.from) + ' to ' + monthName(r.to), mechTotal: mech, heatTotal: heat, heatOnlyTotal: only, heatPct: p(heat, mech), heatOnlyPct: p(only, mech), heatOnlyNovToFebPct: p(r.heatOnly[10] + r.heatOnly[11] + r.heatOnly[0] + r.heatOnly[1], only) }); });
  }

  L.permits = { KEEP, LOOKBACK, WEEKS, MIN_DESC, RULE, RULE_TEXT, REF, GRADES, LABELS, today, month, day, addDays, addMonths, monthKey, windows, zipOf, isHeat, isHeatOnly, isDescribed, heatSql, heatOnlySql, describedSql, record, addZips, keepZips, arcgis: { stat, sumIf, maxIf, form, rows, query, queryAll, run: arcgisRun }, monthName, heatNote, cityView, summary, digest, ref };
})(typeof globalThis !== 'undefined' ? globalThis : self);
