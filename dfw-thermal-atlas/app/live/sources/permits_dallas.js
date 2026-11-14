/* ==== live/sources/permits_dallas.js ==== */
/* City of Dallas building permits (dataset e7gq-4sah on the city's Socrata portal, replaced in full every day): two signals
   for a heating contractor. One: residential mechanical permits (heating, ventilation and air conditioning installed, replaced
   or altered in a home) by month and by ZIP code, with the ones whose description names heating equipment, counted by the
   rule every city shares (live/permits.js) so that Dallas sits beside Fort Worth in L.permits.summary. Two: gas tests, the
   residential plumbing permits for the pressure test a gas line must pass before service is restored, which climb as the
   heating season opens and cluster in south and east Dallas, next to Mesquite.
   Three requests a week, every one a server side aggregate: the newest permit date, both permit types by month, and both by
   ZIP code in the date windows of the record (the 12 complete months, the last eight weeks, the same weeks a year earlier).
   The file has three eras of field quality and the record carries them (eras, usable, zipPct): the old system to January
   2021, an interim feed to April 2025 that holds only a fraction of the permits before May 2024 and almost no ZIP code, and
   the current system, with a ZIP code and a description on nearly every permit from June 2025 and no contractor or value
   from October 2025. So the months start in May 2024, the ZIP table never reaches back before June 2025, and a count of
   heating words is not set beside one from before June 2025.
   Health gates (measured 2026-11-13; a snapshot that fails one is thrown away with the reason and the runner keeps the
   previous record): the newest permit is at most 7 days old; the months answer holds every complete month asked for (30
   of them on that day) and the newest has at least 200 mechanical and 500 plumbing permits; a ZIP code is on at least 95
   in 100 permits of that month; the ZIP answer holds 30 to 80 ZIP codes. Only the ZIP request may fail by itself: then the
   months are this run's, the ZIP blocks stay as the last good run left them, and the record says so. */
(function (root) {
  'use strict';
  const L = root.TDA_LIVE, P = L.permits, R = P.RULE;
  const API = 'https://www.dallasopendata.com/resource/e7gq-4sah.json', PAGE = 'https://www.dallasopendata.com/d/e7gq-4sah';
  const MECH = 'Residential Mechanical Permit', PLUMB = 'Residential Plumbing Permit';
  const VOLUME_FROM = '2024-05', FULL_FROM = '2025-06';              /* the first month with the full count of permits, and the first with a ZIP code and a description on nearly every one */
  const GATE = { days: 7, mech: 200, plumb: 500, zipShare: 0.95, zips: [30, 80] }, PARTIAL_UNDER = 25, TOP = 10, LIMIT = 5000;
  const OPT = { gapMs: 1100, retries: 1, timeoutMs: 28000 };         /* a second between calls; the file answers in 0.4 to 8 seconds */

  /* ---------- the three eras of the file (research of 2026-11-13) ---------- */
  const ERAS = [
    { key: 'A', from: '2018-01', to: '2021-01', text: 'January 2018 to January 2021, the old permit system: a ZIP code on about 9 mechanical permits in 10, contractor and value filled, short uniform descriptions.' },
    { key: 'B', from: '2021-02', to: '2025-04', text: 'February 2021 to April 2025, the interim feed: a ZIP code on fewer than 1 permit in 7, and until April 2024 only a fraction of the permits (19 to 228 a month) reached the file. That is a gap in the file, not a drop in work.' },
    { key: 'C', from: '2025-05', to: null, text: 'May 2025 on, the current system: a ZIP code and a description on nearly every permit from June 2025. Value is empty, and contractor is empty from October 2025 on.' },
  ];
  const USABLE = { counts: VOLUME_FROM, zip: FULL_FROM, words: FULL_FROM };
  const COVERAGE = 'City of Dallas only. A ZIP code with fewer than ' + PARTIAL_UNDER + ' permits in the 12 months is too thin to rate: it lies mostly outside the city limits or holds few homes.';
  /* What a month of the file ('YYYY-MM') can be used for. zip: a ZIP code on nearly every permit; full: the full count of
     permits; words: descriptions as full as today's, so counts of heating words and gas tests can be set beside later months. */
  function era(m) {
    const e = /^\d{4}-(0[1-9]|1[0-2])$/.test(String(m)) ? ERAS.find(x => m >= x.from && (!x.to || m <= x.to)) : null;
    return e ? { key: e.key, zip: e.key === 'A' || m >= FULL_FROM, full: e.key === 'A' || m >= VOLUME_FROM, words: m >= FULL_FROM, text: e.text } : null;
  }

  /* ---------- SoQL: the query builders ---------- */
  /* issued_date is text, MM/DD/YY, always eight characters: dates are compared as the six character key YYMMDD and months as
     YYMM, which sort right from 2000 to 2099. The heating rule is the shared one, word for word: a pattern that begins or ends
     with a space is matched against the description with a space added at each end, exactly as the page does it. */
  const YYMM = "substring(issued_date,7,2)||substring(issued_date,1,2)", DAYK = YYMM + "||substring(issued_date,4,2)", YM = "'20'||substring(issued_date,7,2)||'-'||substring(issued_date,1,2)";
  const UP = 'upper(work_description)', PAD = `(' '||${UP}||' ')`;
  const one = p => `${/^ | $/.test(p) ? PAD : UP} like '%${p}%'`, any = list => '(' + list.map(one).join(' OR ') + ')';
  const HEAT = `(${any(R.heat)} OR (${one(R.word)} AND NOT ${any(R.not)}))`, COOL = any(R.cool.concat(R.whole));
  /* words the city's applicants use (the 120 most common descriptions of each permit type, read on 2026-11-13) */
  const KW = {
    furnace: ['FURNACE'], heatPump: ['HEAT PUMP', 'HEATPUMP', 'HEAT-PUMP'], newBuild: ['NEW CONSTR', 'NEW BUILD', 'NSFD', 'NEW SINGLE', 'NEW RESIDEN', 'NEW HOME', 'NEW SFD'],
    gasTest: ['GAS TEST', 'GAS PRESSURE TEST', 'GAS RELEASE', 'METER RELEASE'], gasRepair: ['GAS LEAK', 'GAS REPAIR', 'GAS LINE REPAIR', 'GAS REPIPE', 'GAS RELAY', 'REPAIR GAS'],
  };
  const cnt = c => `sum(case(${c},1,true,0))`, is = t => `permit_type='${t}'`, BOTH = `permit_type in ('${MECH}','${PLUMB}')`;
  const key = ymd => ymd.slice(2, 4) + ymd.slice(5, 7) + ymd.slice(8, 10);                                     // '2026-11-12' as '261112'
  const fromKey = k => { const s = String(k == null ? '' : k); if (!/^\d{6}$/.test(s)) return null; const d = '20' + s.slice(0, 2) + '-' + s.slice(2, 4) + '-' + s.slice(4, 6), t = Date.parse(d + 'T00:00:00Z'); return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === d ? d : null; };
  const url = p => { const u = new URL(API); for (const k of Object.keys(p)) u.searchParams.set(k, p[k]); return u.toString(); };
  const q = {
    /* 1. the newest residential mechanical permit, and how many the file holds (zero would mean the city renamed the type); the
          upper bound keeps a mistyped future date from moving every window */
    newest: upTo => url({ $select: `max(${DAYK}) as kmax,count(*) as n`, $where: `${is(MECH)} AND (${DAYK})<='${key(upTo)}'` }),
    /* 2. both permit types by month from the month asked: mechanical permits (m), those with a description (md), naming heating
          (mh), naming heating and nothing else (mo); plumbing permits (p), gas tests (pgt), gas repairs (pgr); rows with a ZIP code (zn) of all rows (n) */
    months: asked => url({
      $select: `${YM} as ym,${cnt(is(MECH))} as m,${cnt(`${is(MECH)} AND work_description IS NOT NULL`)} as md,${cnt(`${is(MECH)} AND ${HEAT}`)} as mh,${cnt(`${is(MECH)} AND ${HEAT} AND NOT ${COOL}`)} as mo,${cnt(is(PLUMB))} as p,${cnt(`${is(PLUMB)} AND ${any(KW.gasTest)}`)} as pgt,${cnt(`${is(PLUMB)} AND ${any(KW.gasRepair)}`)} as pgr,count(zip_code) as zn,count(*) as n`,
      $where: `(${YYMM})>='${asked.slice(2, 4) + asked.slice(5, 7)}' AND ${BOTH}`, $group: 'ym', $order: 'ym', $limit: '200' }),
    /* 3. both permit types by ZIP code and by date segment (w: 0 from the first cut, 1 from the second, and so on; plan() says which
          segments make each window) */
    zips: pl => url({
      $select: `zip_code as z,case(${pl.cuts.slice(1).map((c, i) => `(${DAYK})>='${key(c)}','${i + 1}'`).reverse().join(',')},true,'0') as w,${cnt(is(MECH))} as m,${cnt(`${is(MECH)} AND work_description IS NOT NULL`)} as md,${cnt(`${is(MECH)} AND ${HEAT}`)} as mh,${cnt(`${is(MECH)} AND ${any(KW.furnace)}`)} as mf,${cnt(`${is(MECH)} AND ${any(KW.heatPump)}`)} as mhp,${cnt(`${is(MECH)} AND ${any(KW.newBuild)}`)} as mnc,${cnt(is(PLUMB))} as p,${cnt(`${is(PLUMB)} AND ${any(KW.gasTest)}`)} as pgt,${cnt(`${is(PLUMB)} AND ${any(KW.gasRepair)}`)} as pgr`,
      $where: `(${DAYK})>='${key(pl.cuts[0])}' AND (${DAYK})<='${key(pl.hi)}' AND ${BOTH}`, $group: 'z,w', $order: 'z,w', $limit: String(LIMIT) }),
  };
  /* the same word tests in the page, for the tests and for anyone reading a description */
  const has = (t, list) => { const x = String(t == null ? '' : t).toUpperCase(); return list.some(p => x.includes(p)); };
  const isGasTest = t => has(t, KW.gasTest), isGasRepair = t => has(t, KW.gasRepair);

  /* ---------- the windows of the ZIP request ---------- */
  /* Half open date ranges over the cuts the server labels 0, 1, 2 and so on: z the 12 complete months, cut to the months that
     carry ZIP codes (null until one is complete), r the last eight weeks through the newest permit, y the same weeks a year
     earlier. seg lists the segments that make each window; lastYear says whether those weeks sit in the current system. */
  function plan(through) {
    const W = P.windows(through), full = FULL_FROM + '-01', z0 = W.z0 < full ? full : W.z0, end = P.addDays(through, 1);
    const win = { z: z0 < W.z1 ? [z0, W.z1] : null, r: [W.r0, end], y: [W.y0, P.addDays(W.y1, 1)] }, pts = {};
    for (const k in win) if (win[k]) { pts[win[k][0]] = 1; pts[win[k][1]] = 1; }
    const cuts = Object.keys(pts).sort().filter(c => c < end), seg = {};
    for (const k in win) seg[k] = win[k] ? cuts.map((c, i) => c >= win[k][0] && c < win[k][1] ? i : -1).filter(i => i >= 0) : [];
    return { W, cuts, hi: through, seg, zipMonths: win.z ? [z0.slice(0, 7), W.last] : null, lastYear: W.y0 >= full };
  }

  /* ---------- parsers (every value in a Socrata answer is text) ---------- */
  const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const zipOk = v => { const z = P.zipOf(v); return z && /^7[56]/.test(z) ? z : null; };                      // a Dallas Fort Worth ZIP code; anything else joins the permits with none
  const parseNewest = rows => { const r = (Array.isArray(rows) && rows[0]) || {}; return { through: fromKey(r.kmax), rows: num(r.n) }; };
  /* by month: mech { 'YYYY-MM': { n, ds, ht, ho } } as L.permits.record reads it, gas { tests, repairs, of }, fill { zn, n } */
  function parseMonths(rows) {
    const mech = {}, gas = {}, fill = {};
    for (const r of rows || []) {
      const m = r && r.ym; if (!/^20\d\d-(0[1-9]|1[0-2])$/.test(String(m))) continue;
      mech[m] = { n: num(r.m), ds: num(r.md), ht: num(r.mh), ho: num(r.mo) }; gas[m] = { tests: num(r.pgt), repairs: num(r.pgr), of: num(r.p) }; fill[m] = { zn: num(r.zn), n: num(r.n) };
    }
    return { mech, gas, fill };
  }
  /* by ZIP code: zrows as L.permits.addZips reads them (permits, described, heating in each window), the gas tests and repairs
     of each window, the word counts of the 12 months, and how many ZIP codes the answer holds */
  function parseZips(rows, pl) {
    const by = {}, set = k => { const s = {}; for (const i of pl.seg[k]) s[i] = 1; return s; }, inZ = set('z'), inR = set('r'), inY = set('y');
    for (const r of rows || []) {
      if (!r) continue;
      const zip = zipOk(r.z) || '', w = String(r.w), m = num(r.m), md = num(r.md), mh = num(r.mh), gt = num(r.pgt), gx = num(r.pgr), pp = num(r.p);
      const e = by[zip] || (by[zip] = { n12: 0, d12: 0, h12: 0, nr: 0, dr: 0, hr: 0, ny: 0, dy: 0, hy: 0, f: 0, hp: 0, nb: 0, g12: 0, gr: 0, gy: 0, x12: 0, xr: 0, xy: 0, p12: 0, pr: 0, py: 0 });
      if (inZ[w]) { e.n12 += m; e.d12 += md; e.h12 += mh; e.f += num(r.mf); e.hp += num(r.mhp); e.nb += num(r.mnc); e.g12 += gt; e.x12 += gx; e.p12 += pp; }
      if (inR[w]) { e.nr += m; e.dr += md; e.hr += mh; e.gr += gt; e.xr += gx; e.pr += pp; }
      if (inY[w]) { e.ny += m; e.dy += md; e.hy += mh; e.gy += gt; e.xy += gx; e.py += pp; }
    }
    const zs = Object.keys(by).sort(), sum = k => zs.reduce((s, z) => s + by[z][k], 0), gasZip = {}, wordZip = {};
    for (const z of zs) { const e = by[z]; if (!z) continue; if (e.g12 + e.gr + e.gy > 0) gasZip[z] = [e.g12, e.gr, e.gy]; if (e.n12 > 0) wordZip[z] = [e.f, e.hp, e.nb]; }
    return { zrows: zs.map(z => Object.assign({ zip: z || null }, by[z])), zips: zs.filter(z => z).length,
      gas: { byZip12: gasZip, last12: { tests: sum('g12'), repairs: sum('x12'), of: sum('p12') }, recent: { tests: sum('gr'), repairs: sum('xr'), of: sum('pr') }, lastYear: { tests: sum('gy'), repairs: sum('xy'), of: sum('py') } },
      words: { furnace: sum('f'), heatPump: sum('hp'), newBuild: sum('nb'), byZip12: wordZip } };
  }

  /* ---------- the collector ---------- */
  const said = t => { const s = String(t == null ? '' : t), m = /"message"\s*:\s*"((?:[^"\\]|\\.)*)/.exec(s); return (m ? m[1] : s).replace(/\\(.)/g, '$1').replace(/\s+/g, ' ').split('; position')[0].slice(0, 140); };
  /* One aggregate. A refusal (HTTP 400 with a message, or a body that is not an array of rows) means the layout of the file
     changed: the text date and the two permit type names are what every query leans on. */
  async function ask(http, u, what) {
    let j;
    try { j = await http.json(u, OPT); }
    catch (e) { if (e && e.status === 400) throw new Error('the Dallas permit file refused the query for ' + what + ', so its layout may have changed: ' + said(e.body)); throw e; }
    if (!Array.isArray(j)) throw new Error('the Dallas permit file sent no rows for ' + what + ': ' + said(JSON.stringify(j)));
    return j;
  }
  const WHAT = 'Residential mechanical permits of the City of Dallas: heating, ventilation and air conditioning installed, replaced or altered in a home, new houses included (about 1 permit in 10 says new construction). One row of the file is one permit.';
  /* the ZIP request failed: the months are fresh, every ZIP block stays as the last good run left it */
  function keep(rec, prev, e) {
    P.keepZips(rec, prev, e); const g = (prev && prev.gas) || {};
    rec.gas.byZip12 = g.byZip12 || null; rec.gas.zipMonths = g.zipMonths || null; rec.gas.recent = g.recent || null; rec.words = (prev && prev.words) || null;
    rec.stale = rec.stale.concat(['gas.byZip12', 'gas.recent', 'words']); return rec;
  }
  async function run(ctx) {
    const t = P.today(ctx.now), cur = t.slice(0, 7), back = P.addMonths(cur, -P.LOOKBACK), asked = back > VOLUME_FROM ? back : VOLUME_FROM;

    /* 1. the newest permit date */
    const newest = parseNewest(await ask(ctx.http, q.newest(P.addDays(t, 1)), 'the newest permit date')), through = newest.through;
    if (!through) throw new Error('the Dallas permit file holds no residential mechanical permit: the city may have renamed the permit type');
    const late = Math.round((Date.parse(t) - Date.parse(through)) / 864e5);
    if (late > GATE.days) throw new Error('the newest Dallas permit is dated ' + through + ', ' + late + ' days back (' + GATE.days + ' at most expected): the city\'s file has stopped moving');

    /* 2. the months */
    const M = parseMonths(await ask(ctx.http, q.months(asked), 'the months')), W = P.windows(through);
    const want = []; for (let m = asked; m <= W.last; m = P.addMonths(m, 1)) want.push(m);
    const missing = want.filter(m => !M.mech[m]);                    /* every month here holds hundreds of permits: a month with no row is a broken answer, never a quiet month */
    if (missing.length) throw new Error('the Dallas permit file answered ' + (want.length - missing.length) + ' of the ' + want.length + ' months asked for (' + missing[0] + ' is missing)');
    const last = M.mech[W.last] || { n: 0 }, lastGas = M.gas[W.last] || { of: 0 }, f = M.fill[W.last] || { zn: 0, n: 0 };
    if (last.n < GATE.mech) throw new Error('the Dallas permit file holds ' + last.n + ' residential mechanical permits for ' + W.last + ' (' + GATE.mech + ' or more expected)');
    if (lastGas.of < GATE.plumb) throw new Error('the Dallas permit file holds ' + lastGas.of + ' residential plumbing permits for ' + W.last + ' (' + GATE.plumb + ' or more expected)');
    if (!(f.n > 0) || f.zn / f.n < GATE.zipShare) throw new Error('a ZIP code is on ' + (f.n > 0 ? Math.floor(f.zn / f.n * 100) : 0) + ' in 100 Dallas permits of ' + W.last + ' (' + Math.round(GATE.zipShare * 100) + ' or more expected): the ZIP table cannot be trusted');
    const rec = P.record({ city: 'Dallas', asked, through, months: M.mech, extra: null, told: true, what: WHAT, residentialOnly: true });
    rec.heatSince = FULL_FROM;
    rec.zipPct = rec.months.map(x => { const k = M.fill[x.m]; return k && k.n > 0 ? Math.round(k.zn / k.n * 100) : null; });
    rec.gas = { months: rec.months.map(x => Object.assign({ m: x.m }, M.gas[x.m] || { tests: 0, repairs: 0, of: 0 })), byZip12: null, zipMonths: null, recent: null };
    rec.words = null; rec.file = { rows: newest.rows }; rec.eras = ERAS.map(e => Object.assign({}, e)); rec.usable = Object.assign({}, USABLE); rec.coverage = COVERAGE;

    /* 3. the ZIP codes and the eight week windows */
    const pl = plan(through); let zr;
    try { zr = await ask(ctx.http, q.zips(pl), 'the ZIP codes'); } catch (e) { return keep(rec, ctx.prev, e); }
    if (zr.length >= LIMIT) throw new Error('the Dallas ZIP code answer runs past ' + LIMIT + ' rows');
    const Z = parseZips(zr, pl);
    if (Z.zips < GATE.zips[0] || Z.zips > GATE.zips[1]) throw new Error('the Dallas permit file answered ' + Z.zips + ' ZIP codes (' + GATE.zips[0] + ' to ' + GATE.zips[1] + ' expected)');
    P.addZips(rec, Z.zrows, null);
    rec.zipMonths = pl.zipMonths; if (!pl.zipMonths) rec.byZip12 = null;
    const ly = rec.recent.sameWeeksLastYear; if (!pl.lastYear) ly.heat = null; if (W.y0 < VOLUME_FROM + '-01') ly.mech = null;
    /* by ZIP code a window counts only where its weeks carry ZIP codes: no table at all before a month with them is complete */
    for (const z in Z.gas.byZip12) { if (W.r0 < FULL_FROM + '-01') Z.gas.byZip12[z][1] = null; if (!pl.lastYear) Z.gas.byZip12[z][2] = null; }
    rec.gas.byZip12 = pl.zipMonths ? Z.gas.byZip12 : null; rec.gas.zipMonths = pl.zipMonths;
    rec.gas.recent = Object.assign({ weeks: P.WEEKS, from: W.r0, to: W.r1 }, Z.gas.recent, { sameWeeksLastYear: Object.assign({ from: W.y0, to: W.y1 }, pl.lastYear ? Z.gas.lastYear : { tests: null, repairs: null, of: W.y0 < VOLUME_FROM + '-01' ? null : Z.gas.lastYear.of }) });
    rec.words = pl.zipMonths ? { zipMonths: pl.zipMonths, furnace: Z.words.furnace, heatPump: Z.words.heatPump, newBuild: Z.words.newBuild, byZip12: Z.words.byZip12 } : null;
    return rec;
  }

  /* ---------- reads ---------- */
  const GAS_WHAT = 'A gas test is a residential plumbing permit for a pressure test of a home\'s gas line, usually after a shut off, a meter release or a repair and before the gas is turned back on. It marks a home putting gas heat back in service: a lead indicator of heating demand by ZIP code, grade C as a demand proxy. It is not a heating job, and a home that never lost gas service does not appear.';
  const GAS_RULE = 'Gas test: a residential plumbing permit whose description says GAS TEST, GAS PRESSURE TEST, GAS RELEASE or METER RELEASE. Gas repair: GAS LEAK, GAS REPAIR, GAS LINE REPAIR, GAS REPIPE, GAS RELAY or REPAIR GAS.';
  const pct = (a, b) => a != null && b > 0 ? Math.round((a / b - 1) * 1000) / 10 : null;
  /* The gas test block as the Heat Desk shows it: months [{ m, tests, repairs, of (all residential plumbing permits) }], the last
     12 complete months against the 12 before (prior12 and yoyPct stay empty, with a note, until both years sit in the current
     system), the peak month of the last 12, the last eight weeks against the same weeks a year earlier with the change in
     percent, and the ZIP codes with the most tests in the 12 months: topZips [{ zip, tests12, recent, lastYear }] (recent and
     lastYear are the two eight week windows). Takes the record's data or the stored record around it; null when it holds no
     gas block. */
  function gasTests(rec) {
    const d = rec && rec.data !== undefined ? rec.data : rec, g = d && d.gas; if (!g || !Array.isArray(g.months)) return null;
    const ms = g.months, blk = l => l.reduce((a, x) => { a.tests += x.tests || 0; a.repairs += x.repairs || 0; return a; }, { tests: 0, repairs: 0 });
    const l12 = ms.slice(-12), last12 = ms.length >= 12 ? blk(l12) : null, p12 = ms.length >= 24 ? ms.slice(-24, -12) : null, prior12 = p12 && p12[0].m >= FULL_FROM ? blk(p12) : null;
    const peak = last12 ? l12.reduce((a, x) => x.tests > a.tests ? x : a, l12[0]) : null, r = g.recent || null, ly = r && r.sameWeeksLastYear;
    const zips = Object.keys(g.byZip12 || {}).map(z => ({ zip: z, tests12: g.byZip12[z][0], recent: g.byZip12[z][1], lastYear: g.byZip12[z][2] })).sort((a, b) => b.tests12 - a.tests12 || (a.zip < b.zip ? -1 : 1));
    const note = p12 && !prior12 ? 'Gas tests are comparable from ' + P.monthName(FULL_FROM) + ' on, when the city changed how the work is written down: there is no reading against the 12 months before until both years sit after it.' : null;
    return { city: d.city, through: d.through || null, grade: 'C', what: GAS_WHAT, rule: GAS_RULE, months: ms, last12, prior12, yoyPct: last12 && prior12 ? pct(last12.tests, prior12.tests) : null, comparableFrom: FULL_FROM, note,
      peak: peak ? { m: peak.m, tests: peak.tests } : null, recent: r ? Object.assign({}, r, { changePct: ly ? pct(r.tests, ly.tests) : null }) : null,
      topZips: zips.slice(0, TOP), zips: zips.filter(x => x.tests12 > 0).length, zipMonths: g.zipMonths || null, stale: (d.stale || []).filter(s => /^gas\./.test(s)) };
  }
  const LABELS = { mech12: P.LABELS.mech12, heat12: P.LABELS.heat12, yoyPct: P.LABELS.yoyPct, gas8w: ['Gas tests, last 8 weeks', 'int'], gas8wLastYear: ['Gas tests, same weeks last year', 'int'], through: P.LABELS.through, zips: P.LABELS.zips };
  const digest = d => { const g = P.digest(d), w = d && d.gas && d.gas.recent; return { mech12: g.mech12, heat12: g.heat12, yoyPct: g.yoyPct, gas8w: w ? w.tests : null, gas8wLastYear: w && w.sameWeeksLastYear ? w.sameWeeksLastYear.tests : null, through: g.through, zips: g.zips }; };

  L.permitsDallas = { API, PAGE, MECH, PLUMB, VOLUME_FROM, FULL_FROM, GATE, PARTIAL_UNDER, ERAS, USABLE, COVERAGE, KW, WHAT, GAS_WHAT, GAS_RULE, LABELS, soql: { HEAT, COOL, YYMM, DAYK, YM }, q, key, fromKey, plan, era, isGasTest, isGasRepair, parseNewest, parseMonths, parseZips, gasTests, digest, run };
  L.register({
    id: 'permits_dallas', name: 'Dallas mechanical permits and gas tests', publisher: 'City of Dallas, Dallas OpenData', page: PAGE,
    about: 'Residential heating and air conditioning permits of the City of Dallas by month and by ZIP code, the ones that name heating equipment, and gas tests: plumbing permits for a pressure test of a home\'s gas line, usually after a shut off, a meter release or a repair, which mark homes putting gas heat back in service (a lead indicator of heating demand by ZIP code, grade C, not a count of heating jobs). ZIP codes are usable from June 2025 on (and in 2018 to 2020), months before May 2024 are a gap in the city\'s file and are left out, and contractor and value are empty from October 2025 on.',
    hosts: ['www.dallasopendata.com'], cadence: 'weekly', cors: true, grade: 'B', timeoutMs: 180000, terms: 'Public permit records under the open data policy of the City of Dallas; the dataset carries no license. Credit: City of Dallas, Dallas OpenData, Building Permits (e7gq-4sah).',
    labels: LABELS, run, digest,
  });
})(typeof globalThis !== 'undefined' ? globalThis : self);
