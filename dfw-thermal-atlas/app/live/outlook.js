/* ==== live/outlook.js ==== */
/* The two week cold outlook: one reading of everything that looks past the seven day forecast (the records cpc_outlook,
   nbm_extended and ercot_grid). Pure: no DOM, no network, never a throw; a missing or stale record takes its leg out of the
   reading and is named in notes. The inputs are the publishers' own numbers (grades A and B); the tiers and thresholds are
   planning rules of this atlas (grade C) and sit in RULES so the Heat Desk can show and tune them. No budget multiplier
   lives here: the Heat Desk owns the money.
     tier 0  no cold signal   nothing beyond the ordinary odds (lean 'warm' when both outlooks favor warmth at 50 percent or more)
     tier 1  lean cold        the odds of a cold stretch are raised, or a cold hazard is named as a slight risk: stage, do not spend
     tier 2  cold favored     a cold stretch is more likely than not, a cold area is drawn over a county, or the grid is on watch
     tier 3  cold hazard      hazardous cold, snow or ice is drawn or likely for a county, or the grid is in an emergency
   Loads after live/derive.js and live/climate.js, and adds one notice to L.derive.more when the tier reaches 2 or 3. */
(function (root) {
  'use strict';
  const L = root.TDA_LIVE, DAY = 864e5, HOUR = 36e5;
  /* night thresholds shared with the rest of the live layer (live/derive.js) */
  const TH = Object.assign({ cool: 50, cold: 40, freeze: 32, hard: 25 }, (L.derive && L.derive.TH) || {});
  const TIER = ['no cold signal', 'lean cold', 'cold favored', 'cold hazard'];
  /* what each tier is for, in one sentence: staging, never spending (the seven day cold watch and the Heat Desk decide the money) */
  const USE = ['Hold the base plan.', 'Stage for the window: ready the cold weather creative and the crews, and check the outlook daily; no spend moves on this alone.', 'Prepare for the window: creative approved, the reserve held, call hours planned; spend follows when the seven day forecast shows the lows.', 'Be on an emergency footing before the window opens; the seven day cold watch makes the day by day calls.'];
  const USE_WARM = 'Hold the base plan; a mild stretch favors tune ups, replacement quotes and financing offers.';
  /* grade of each kind of evidence and of what is built on it */
  const GRADES = { tier: 'C', load: 'C', outlook: 'B', hazard: 'B', named: 'B', winter: 'B', blend: 'B', chance: 'C', grid: 'A' };
  const RULES = {
    leanBelow: 40,                         /* 6 to 10 or 8 to 14 day outlook below normal at 40 percent or more (the floor of the band) → tier 1 */
    favoredBelow: 50,                      /* 8 to 14 day below normal at 50 or more, or 6 to 10 at 50 or more with 8 to 14 at 40 or more → tier 2 */
    hazardBelow: 70,                       /* 8 to 14 day below normal at 70 or more → tier 3 */
    leanFreeze: 20,                        /* blend guidance, mornings 6 to 11 days out: chance of a freeze at any airport, percent → tier 1 */
    favoredFreeze: 50,                     /* … → tier 2 */
    hardLowF: TH.hard,                     /* a blend low at or under this on a morning 6 to 11 days out → tier 3 */
    winterMinor: 60, winterModerate: 30,   /* winter storm impact odds (percent) for any county in the next seven days → tier 3 */
    warmAbove: 50,                         /* both outlooks above normal at 50 or more and nothing cold → lean warm */
    seasonHdd: 8,                          /* the cold third of the window must average this many heating degree days a day, else it is not heating weather */
    staleDays: 3,                          /* an outlook issued longer ago than this raises nothing; hazard areas and named risks get one day more */
    blendDays: 2,                          /* blend guidance from a run older than this is ignored */
    gridHours: 36,                         /* a grid condition read longer ago than this raises nothing */
    fromDay: 6,                            /* blend mornings nearer than this belong to the seven day cold watch */
  };
  const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const isDay = d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
  const md = d => MO[+d.slice(5, 7) - 1] + ' ' + (+d.slice(8, 10));
  const span = (a, b) => !a ? '' : !b || a === b ? md(a) : a.slice(0, 7) === b.slice(0, 7) ? md(a) + ' to ' + (+b.slice(8, 10)) : md(a) + ' to ' + md(b);
  const addDays = (d, n) => new Date(Date.parse(d + 'T12:00:00Z') + n * DAY).toISOString().slice(0, 10);
  const daysFrom = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);
  const age = (t, at) => { const x = +new Date(at); return at && Number.isFinite(x) ? t - x : Infinity; };
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  /* the same sentence after a colon: lower case unless it opens with an acronym */
  const lower = s => /^[A-Z]{2,}\b/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1);
  const an = s => (/^[aeiou]/i.test(s) ? 'an ' : 'a ') + s;
  const degF = f => (f < 0 ? 'minus ' + Math.abs(f) : String(f)) + '°F';
  /* a mapped probability is the floor of its band: 40 means 40 to 50 percent */
  const TOP = { 33: 40, 36: 40, 40: 50, 50: 60, 60: 70, 70: 80, 80: 90 };
  const band = p => (TOP[p] ? p + ' to ' + TOP[p] + ' percent' : p + ' percent or more');
  /* today's date in the metro's time zone (live/derive.js), as YYYY-MM-DD */
  const localDay = (t, tz) => { try { if (L.derive && L.derive.localDay) return L.derive.localDay(t, tz); } catch (e) { } return new Date(t).toISOString().slice(0, 10); };
  /* Is it heating weather on that date? The cold third of the seven day window that starts there must average seasonHdd heating
     degree days a day (late October to late March at DFW Airport). Without the class table: November through March. */
  function inSeason(day, R) {
    try { const r = L.cpc && L.cpc.classRow && L.cpcClass ? L.cpc.classRow(L.cpcClass, day, 7) : null; if (r) return r[4] >= (R || RULES).seasonHdd; } catch (e) { }
    const m = +String(day).slice(5, 7); return m >= 11 || m <= 3;
  }
  /* the tier the two outlook maps carry on their own; x and y: the below normal probability of days 6 to 10 and of days 8 to 14 (0 when not below) */
  const mapTier = (x, y, R) => y >= R.hazardBelow ? 3 : y >= R.favoredBelow || (x >= R.favoredBelow && y >= R.leanBelow) ? 2 : y >= R.leanBelow || x >= R.leanBelow ? 1 : 0;
  const belowOf = s => { const m = /^B(\d+)$/.exec(String(s || '')); return m ? +m[1] : 0; };
  /* the cold hazards the forecasters name, in the atlas's words (the kind set by live/sources/cpc_outlook.js) */
  const NAMED = { temps: 'much below normal temperatures', ice: 'ice or freezing rain', snow: 'heavy snow', chill: 'dangerous wind chill', freeze: 'a freeze', frost: 'frost', cold: 'hazardous cold' };

  /* What outlook() returns, always whole:
       ok, reason (why not, when ok is false), stale (no fresh outlook map), tier 0 to 3, tierName, lean ('cold' | 'warm' | 'neutral'),
       window { start, end } of the top tier, anchor (the first day of that window when the call was first made: the notice key),
       evidence [{ tier, kind ('outlook' | 'hazard' | 'named' | 'winter' | 'blend' | 'grid'), text (the atlas's words), start, end, issued, g (grade),
                   quote (the forecaster's own sentence, named risks only), since, issues, first, label (by kind) }] highest tier first,
       d610, d814 (the stored outlooks when fresh, else null), persist (issues in a row with days 8 to 14 below normal),
       blend { run, freeze, coldest } (the best freeze chance and the lowest low 6 days out or later, each a stored night with stn and name),
       grid { level, name, state, prcMw, at, since, stale, why } | null, season and seasonNow (heating weather in the window, and today),
       headline, sub, use (what the tier is for), notes [a sentence for each leg missing or stale], inputs { id: { state: 'ok' | 'stale' | 'missing', at, … } },
       today (the Dallas date read for), rules, grades */
  const blank = (R, today) => ({ ok: false, reason: '', stale: true, tier: 0, tierName: TIER[0], lean: 'neutral', window: null, anchor: null, evidence: [], d610: null, d814: null, persist: 0,
    blend: { run: null, freeze: null, coldest: null }, grid: null, season: false, seasonNow: false, headline: 'No two week outlook on hand', sub: '', use: '', notes: [], inputs: { cpc_outlook: { state: 'missing', at: null }, nbm_extended: { state: 'missing', at: null }, ercot_grid: { state: 'missing', at: null } }, today, rules: R, grades: GRADES });

  function read(recs, now, opt) {
    const R = Object.assign({}, RULES, (opt && opt.rules) || {}), t0 = +new Date(now), t = Number.isFinite(t0) ? t0 : Date.now(), tz = (L.geo || {}).tz, today = localDay(t, tz), nowIso = new Date(t).toISOString();
    const rec = id => { const r = recs && recs[id]; return r && r.data && typeof r.data === 'object' ? r : null; };
    const C = rec('cpc_outlook'), N = rec('nbm_extended'), G = rec('ercot_grid'), c = C && C.data, n = N && N.data, g = G && G.data;
    const out = blank(R, today), ev = out.evidence, notes = out.notes;
    /* one piece of evidence: its tier, its kind, a sentence in the atlas's words, the dates it speaks of, when the publisher issued it and its grade */
    const add = (tier, kind, grade, text, start, end, more) => ev.push(Object.assign({ tier, kind, text, start: start || null, end: end || start || null, issued: null, g: grade }, more || {}));
    out.seasonNow = out.season = inSeason(today, R);

    /* ---- the outlook maps ---- */
    const ext = (c && c.ext) || {};
    const fresh = o => !!(o && isDay(o.issued) && isDay(o.start) && isDay(o.end) && o.cat && daysFrom(o.issued, today) <= R.staleDays && o.end >= today);
    const a = fresh(ext.d610) ? ext.d610 : null, b = fresh(ext.d814) ? ext.d814 : null, ref = b || a;
    out.d610 = a; out.d814 = b; out.stale = !ref;
    out.inputs.cpc_outlook = { state: !c ? 'missing' : ref ? 'ok' : 'stale', at: (C && C.at) || null, issued: (ref || ext.d814 || ext.d610 || {}).issued || null };
    /* is it heating weather at all in that window? */
    if (ref) out.season = ref.load && typeof ref.load.coldHdd === 'number' ? ref.load.coldHdd >= R.seasonHdd : inSeason(ref.start, R);
    const below = o => (o && o.cat === 'Below' && o.prob > 0 ? o.prob : 0), above = o => (o && o.cat === 'Above' && o.prob > 0 ? o.prob : 0);
    const mt = out.season ? mapTier(below(a), below(b), R) : 0;
    if (mt) {
      const text = mt === 3 ? `Days 8 to 14 colder than normal at ${band(b.prob)}`
        : mt === 2 ? (below(b) >= R.favoredBelow ? `Days 8 to 14 favor a colder than normal stretch (${band(b.prob)})` : `Days 6 to 10 (${band(a.prob)}) and days 8 to 14 (${band(b.prob)}) favor a colder than normal stretch`)
        : below(b) >= R.leanBelow ? `Days 8 to 14 lean colder than normal (${band(b.prob)})` : `Days 6 to 10 lean colder than normal (${band(a.prob)})`;
      const first = mt === 3 ? b : mt === 2 ? (below(a) ? a : b) : below(b) >= R.leanBelow ? b : a, last = mt >= 2 ? b : first;
      /* the same call over a row of issues: since which issue, and where the window started on that first issue */
      const hist = ((c && c.hist) || []).filter(h => h && isDay(h.issued)), i0 = hist.findIndex(h => h.issued === ref.issued);
      let since = ref.issued, issues = 1;
      if (i0 >= 0) for (let i = i0 + 1; i < hist.length; i++) { const h = hist[i]; if (mapTier(belowOf(h.d610), belowOf(h.d814), R) < mt || daysFrom(h.issued, hist[i - 1].issued) > R.staleDays) break; since = h.issued; issues++; }
      add(mt, 'outlook', GRADES.outlook, text, first.start, last.end, { issued: ref.issued, since, issues, first: addDays(first.start, -daysFrom(since, ref.issued)) });
    }

    /* ---- cold hazard areas drawn over the counties: they count until their end date, from a file no older than four days ---- */
    const haz = (c && c.haz) || null, hazFile = w => (haz && haz.file && haz.file[w]) || (C && C.at) || null;
    ((haz && haz.metro) || []).filter(h => h && h.cold && h.label && isDay(h.end) && h.end >= today && age(t, hazFile(h.win)) / DAY <= R.staleDays + 1)
      .forEach(h => add(/much below normal|frost|\bfreeze\b/i.test(h.label) ? 2 : 3, 'hazard', GRADES.hazard, `A ${h.label} area is drawn over at least one of the 12 counties`, isDay(h.start) ? h.start : h.end, h.end, { issued: hazFile(h.win), label: h.label }));

    /* ---- cold hazards the forecasters name for the Southern Plains or Texas, until their end date ---- */
    const thr = c && c.text && c.text.thr;
    if (thr && thr.issued && age(t, thr.issued) / DAY <= R.staleDays + 1) (thr.items || []).filter(x => x && x.cold && x.near && isDay(x.start) && isDay(x.end) && x.end >= today)
      .forEach(x => add(x.risk === 'High' ? 3 : x.risk === 'Moderate' ? 2 : 1, 'named', GRADES.named, `Forecasters name a ${x.risk === 'High' ? 'high' : x.risk === 'Moderate' ? 'moderate' : 'slight'} risk of ${NAMED[x.kind] || 'a cold hazard'}${x.freeze && x.kind !== 'freeze' ? ', with a possible freeze,' : ''} for the Southern Plains or Texas`, x.start, x.end, { issued: thr.issued, quote: String(x.text || `${x.risk} risk of ${x.hazard} for ${x.area}`) }));

    /* ---- winter storm impacts in the coming week ---- */
    const w = (c && c.winter) || null;
    if (w && age(t, w.file || (C && C.at)) / DAY <= R.staleDays) {
      const top = arr => (Array.isArray(arr) ? arr : []).filter(x => x && typeof x.prob === 'number' && typeof x.start === 'string' && typeof x.end === 'string' && x.end > nowIso).reduce((m, x) => (!m || x.prob > m.prob ? x : m), null), mod = top(w.moderate), min = top(w.minor);
      const one = mod && mod.prob >= R.winterModerate ? [mod, 'moderate'] : min && min.prob >= R.winterMinor ? [min, 'minor'] : null;
      if (one) add(3, 'winter', GRADES.winter, `${one[0].prob} percent chance of ${one[1]} winter storm impacts in at least one of the 12 counties`, localDay(+new Date(one[0].start), tz), localDay(+new Date(one[0].end) - 1, tz), { issued: w.file || null });
    }

    /* ---- blend guidance, mornings 6 to 11 days out ---- */
    const runAge = n && n.run ? age(t, n.run) / DAY : Infinity; let freeze = null, coldest = null;
    if (n && Array.isArray(n.stations) && runAge <= R.blendDays) {
      const from = addDays(today, R.fromDay);
      n.stations.forEach(s => ((s && s.nights) || []).filter(x => x && isDay(x.m) && x.m >= from && typeof x.lowF === 'number').forEach(x => { const y = Object.assign({ stn: s.id, name: s.name || s.id }, x); if (typeof x.p32 === 'number' && (!freeze || x.p32 > freeze.p32)) freeze = y; if (!coldest || x.lowF < coldest.lowF) coldest = y; }));
      const chance = f => `${f.p32} percent chance of a freeze at ${f.name} on the morning of ${md(f.m)} (blend low ${degF(f.lowF)})`;
      if (coldest && coldest.lowF <= R.hardLowF) add(3, 'blend', GRADES.blend, `Blend low of ${degF(coldest.lowF)} at ${coldest.name} on the morning of ${md(coldest.m)}`, coldest.m, coldest.m, { issued: n.run });
      else if (freeze && freeze.p32 >= R.favoredFreeze) add(2, 'blend', GRADES.chance, chance(freeze), freeze.m, freeze.m, { issued: n.run });
      else if (freeze && freeze.p32 >= R.leanFreeze) add(1, 'blend', GRADES.chance, chance(freeze), freeze.m, freeze.m, { issued: n.run });
    }
    const haveBlend = !!coldest;
    out.blend = { run: haveBlend ? n.run : null, freeze, coldest };
    out.inputs.nbm_extended = { state: !n ? 'missing' : haveBlend ? 'ok' : 'stale', at: (N && N.at) || null, run: (n && n.run) || null };

    /* ---- the grid operator: a condition counts only while its last read is fresh, and only in heating weather ---- */
    const cond = g && g.cond && typeof g.cond === 'object' ? g.cond : null;
    if (cond) {
      const seen = cond.updated || cond.at || null, level = typeof cond.level === 'number' ? cond.level : 0, name = String(cond.name || 'an unnamed condition');
      const why = g.condStale ? 'the last read of the grid condition failed' : G.ok === false ? 'the last refresh of the grid source failed' : !(age(t, seen) / HOUR <= R.gridHours) ? `the grid condition was read more than ${R.gridHours} hours ago` : '';
      out.grid = { level, name, state: cond.state || '', prcMw: typeof cond.prcMw === 'number' ? cond.prcMw : null, at: seen, since: cond.since || null, stale: !!why, why };
      if (!why && out.seasonNow && level >= 2) add(level >= 4 ? 3 : 2, 'grid', GRADES.grid, `The Texas grid operator has declared ${an(name)}`, today, today, { issued: seen, first: cond.since && Number.isFinite(+new Date(cond.since)) ? localDay(+new Date(cond.since), tz) : today });
    }
    out.inputs.ercot_grid = { state: !cond ? 'missing' : out.grid.stale ? 'stale' : 'ok', at: (G && G.at) || null };

    /* ---- the reading ---- */
    ev.sort((x, y) => y.tier - x.tier || String(x.start).localeCompare(String(y.start)));
    out.tier = ev.length ? ev[0].tier : 0; out.tierName = TIER[out.tier];
    const lead = ev.filter(x => x.tier === out.tier && x.start);
    if (lead.length) { out.window = { start: lead.map(x => x.start).sort()[0], end: lead.map(x => x.end || x.start).sort().pop() }; out.anchor = lead.map(x => x.first || x.start).sort()[0]; }
    out.lean = out.tier >= 1 ? 'cold' : above(a) >= R.warmAbove && above(b) >= R.warmAbove ? 'warm' : 'neutral';
    /* how many issues in a row the 8 to 14 day outlook has said "below" (issues this collector saw) */
    if (ref) for (const h of ((c && c.hist) || [])) { if (!h || h.d814 == null) continue; if (/^B/.test(h.d814)) out.persist++; else break; }
    out.ok = !!ref || haveBlend || ev.length > 0;
    if (!c) notes.push('No outlook record is stored yet.'); else if (!ref) notes.push(`The stored outlook maps were issued more than ${R.staleDays} days ago or their windows have passed.`);
    if (!n) notes.push('No blend guidance is stored yet.'); else if (!haveBlend) notes.push(`The stored blend guidance is more than ${R.blendDays} days old or stops short of day ${R.fromDay}.`);
    if (!cond) notes.push('No grid reading is stored (the grid source runs in the browser app only).'); else if (out.grid.stale) notes.push(`The grid reading is stale: ${out.grid.why}.`);
    if (!out.ok) out.reason = !c && !n && !g ? 'No outlook, blend guidance or grid reading is stored yet. Refresh the live data.' : 'Nothing stored is fresh enough to judge the two weeks ahead. Refresh the live data.';
    const say = o => !o ? 'not available' : o.cat === 'EC' ? 'equal chances' : `${o.cat === 'Normal' ? 'near' : o.cat === 'Below' ? 'below' : 'above'} normal${o.prob == null ? '' : ' at ' + band(o.prob)}${o.uniform === false ? ' in most counties' : ''}`;
    const loadSay = o => o && o.load && typeof o.load.idx === 'number' ? `, about ${o.load.idx} percent of the normal heating load` : '';
    out.headline = !out.ok ? 'No two week outlook on hand'
      : out.tier ? `${cap(TIER[out.tier])}${out.window ? ', ' + span(out.window.start, out.window.end) : ''}: ${lower(ev[0].text)}`
      : !ref ? 'No freeze signal in the blend guidance out to day 11'
      : out.lean === 'warm' ? 'Mild through week two: no cold signal past the seven day forecast' : 'No cold signal past the seven day forecast';
    out.use = !out.ok ? '' : out.tier === 0 && out.lean === 'warm' ? USE_WARM : USE[out.tier];
    out.sub = !out.ok ? out.reason : `Days 6 to 10 (${a ? span(a.start, a.end) : 'no data'}): ${say(a)}${loadSay(a)}. Days 8 to 14 (${b ? span(b.start, b.end) : 'no data'}): ${say(b)}${loadSay(b)}.`;
    return out;
  }
  /* recs: { cpc_outlook, nbm_extended, ercot_grid } as records of the live store (any may be missing); now: a Date or milliseconds;
     opt.rules overrides RULES. Always returns the same complete object: ok false with a reason when nothing stored is usable. */
  function outlook(recs, now, opt) {
    try { return read(recs, now, opt); }
    catch (e) { const o = blank(Object.assign({}, RULES, (opt && opt.rules) || {}), new Date(Number.isFinite(+new Date(now)) ? +new Date(now) : Date.now()).toISOString().slice(0, 10)); o.reason = o.sub = 'The stored outlook records could not be read. Refresh the live data.'; return o; }
  }
  /* One notice when the tier is 2 or 3, none below. The key holds the tier and the first day of the window as it stood when
     this call was first made (anchor: the same as window.start except while a call rests on the daily outlook maps or on the
     grid condition, whose dates move every day), so one cold spell is announced once. */
  function notice(recs, now) {
    const o = outlook(recs, now); if (!o.ok || o.tier < 2 || !o.window) return [];
    return [{ key: 'outlook:' + o.tier + ':' + (o.anchor || o.window.start), title: (o.tier === 3 ? 'Cold hazard' : 'Cold favored') + ' in the two week outlook', message: o.headline + '.', route: 'heat' }];
  }
  L.derive = Object.assign(L.derive || {}, { outlook, outlookNotice: notice, OUTLOOK_RULES: RULES, OUTLOOK_TIER: TIER, OUTLOOK_USE: USE, OUTLOOK_GRADES: GRADES, inHeatingSeason: inSeason });
  /* an older live/derive.js has no hook for more notices: then the reading is still there, only the notice is not sent */
  if (Array.isArray(L.derive.more)) L.derive.more.push(notice);
})(typeof globalThis !== 'undefined' ? globalThis : self);
