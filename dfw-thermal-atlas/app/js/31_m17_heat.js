/* ==== src/31_m17_heat.js ==== */
/* ==== m17_heat ==== */
"use strict";
/* ============================ Module 17: Heat Desk ============================ */
/* Where a heating ad dollar spent from the shop earns the most, and what this week's cold changes. The page only reads and
   draws: every plan number comes from the engine (HEATX, 28_heat_core.js) through view(), every live record through
   live(), and the files are the engine's own text. Nothing here scores a ZIP. */
registerModule({
  key: 'heat', num: '17', title: 'Heat Desk', desc: 'Where to spend on heating this week: ZIPs, lines, bids, budgets and the cold triggers',
  mount(root) {
    const HX = typeof HEATX !== 'undefined' && HEATX && typeof HEATX.plan === 'function' ? HEATX : null;
    const KEY = 'tda.heat.v1';
    /* ---------- words and numbers: no dash of any kind reaches the page, a missing value reads n/a ---------- */
    const NA = 'n/a', MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const ROSTER = (() => { const d = typeof DATA !== 'undefined' && DATA && DATA.comp_generated; return d && /^\d{4}-\d{2}/.test(d) ? MON[+String(d).slice(5, 7) - 1] + ' ' + String(d).slice(0, 4) : 'August 2026'; })();     // the month of the competitor roster
    const n0 = v => isN(v) ? N(v) : NA, n1 = v => isN(v) ? D(v, 1) : NA;
    const usd = v => isN(v) ? (v < 0 ? '-' : '') + '$' + N(Math.abs(v)) : NA;                     // table cells; prose says "returns $43"
    const pc = (f, d) => isN(f) ? P(f * 100, d || 0) : NA;                                        // a fraction as a percent
    const sg = v => isN(v) ? (Math.round(v) > 0 ? '+' : '') + Math.round(v) + '%' : NA;           // a bid adjustment in a cell
    const mult = v => isN(v) ? D(v, 2) + '×' : NA;
    const clean = s => String(s == null ? '' : s).replace(/\b([Ll])icence/g, '$1icense').replace(/\b([Ff])avour/g, '$1avor').replace(/(\d)\s*[‐-―−]\s*(?=\$?\d)/g, '$1 to ').replace(/\bR-(?=\d)/g, 'R').replace(/([A-Za-z])[‐-―−-]+(?=[A-Za-z])/g, '$1 ').replace(/(\d)-(?=[A-Za-z])/g, '$1 ').replace(/([A-Za-z])-(?=\d)/g, '$1 ').replace(/\s*[‐-―−]+\s*/g, ', ');     // engine and publisher text: house spelling, no hyphen between words, no dash
    const ec = s => esc(clean(s));
    const day = ymd => /^\d{4}-\d{2}-\d{2}/.test(String(ymd)) ? MON[+String(ymd).slice(5, 7) - 1] + ' ' + (+String(ymd).slice(8, 10)) + ', ' + String(ymd).slice(0, 4) : NA;
    const dshort = ymd => { const d = new Date(String(ymd).slice(0, 10) + 'T12:00:00Z'); return isNaN(d) ? NA : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()] + ' ' + MON[d.getUTCMonth()].slice(0, 3) + ' ' + d.getUTCDate(); };
    const list = a => a.length <= 1 ? a.join('') : a.length === 2 ? a.join(' and ') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
    const plural = (n, one, many) => N(n) + ' ' + (Math.round(n) === 1 ? one : many || one + 's');
    const today = () => { try { return TDA_LIVE.derive.localDay(new Date(), TDA_LIVE.geo.tz); } catch (e) { return new Date().toISOString().slice(0, 10); } };
    const th = (h, l, t) => `<th scope="col"${l ? ' class="l"' : ''}${t ? ` title="${esc(t)}"` : ''}>${h}</th>`;
    const tbl = (head, rows, cls) => `<table${cls ? ` class="${cls}"` : ''}><thead><tr>${head.map(h => th(h[0], h[1], h[2])).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>`;
    const tr = (cells, cls) => `<tr${cls ? ` class="${cls}"` : ''}>${cells.map(c => Array.isArray(c) ? `<td class="${c[1]}">${c[0]}</td>` : `<td>${c}</td>`).join('')}</tr>`;
    const csvBtn = (k, label) => `<button type="button" class="ibtn" data-csv="${k}" title="Download this table">↓ ${label || 'CSV'}</button>`;
    const hcard = (title, sub, tools, body, id) => `<div class="card mt"${id ? ` id="${id}"` : ''}><div class="card-h hd-cardh"><div><h3>${title}</h3>${sub ? `<p>${sub}</p>` : ''}</div>${tools ? `<div class="hd-tools">${tools}</div>` : ''}</div><div class="card-b">${body}</div></div>`;
    const rng = (r, f) => r && isN(r[0]) && isN(r[2]) ? `${f(r[0])} to ${f(r[2])}` : NA;

    /* ---------- markup, once ---------- */
    root.innerHTML = mastHTML({
      eyebrow: 'Module 17 · Heat Desk · four heating lines, one dispatch point', title: 'Heat Desk',
      dek: 'Where a heating ad dollar spent from the shop earns the most gross profit, and what this week\'s forecast changes. Every ZIP is scored for heating repair, furnace replacement, heat pump replacement and tune ups by what the next dollar returns there, cut down by how far the truck has to drive. The answer comes first in plain words; the map, the tables and the files for the ad accounts follow.',
      meta: ['<span id="h17M1"></span>', '<span id="h17M2"></span>', '<span id="h17M3"></span>', '<span id="h17M4"></span>'],
      bar: 'Heat Desk', barsub: 'Where, on what, this week, on Monday',
      actions: [{ id: 'h17XPack', label: '↓ Monday pack', title: 'Every file below in one zip' }, { id: 'h17XGoogle', label: '↓ Google locations', title: 'Google Ads Editor location rows, paused' }, { id: 'h17XWeek', label: '↓ Week sheet', title: 'This week\'s budgets by day and what to switch' }, { id: 'h17XPlan', label: '↓ Plan by ZIP', title: 'Every scored ZIP and line with every factor' }, { id: 'h17Desk', label: 'Campaign Desk ↗', title: 'Send the plan\'s ZIPs and bid adjustments to the desk' }, { id: 'h17Lines', label: 'Service Lines ↗' }, { id: 'h17Wx', label: 'Weather Desk ↗' }, { id: 'h17Live', label: 'Live Data ↗' }]
    }) + `<div class="wrap">
      <div id="h17Gate"></div>
      <section class="hd-answer" id="h17Answer" aria-labelledby="h17AnsH"></section>
      <div class="kpis" id="h17Kpis"></div>
      <div id="h17Miss"></div>
      <div class="card mt" id="h17WeekCard"><div class="card-h hd-cardh"><div><h3>This week</h3><p>Seven nights of National Weather Service lows, turned into this week's budgets by line and by day. The lows are the forecaster's own numbers ${G('A')}; the size of every response is stated ${G('D')}.</p></div>
        <div class="hd-tools"><span class="fl" id="h17ScnL">Week to show</span><div class="seg" id="h17Scn" role="group" aria-labelledby="h17ScnL"><button type="button" data-v="live" aria-pressed="true">Live forecast</button><button type="button" data-v="rim" aria-pressed="false">Freeze on the rim</button><button type="button" data-v="first" aria-pressed="false">First freeze metro wide</button><button type="button" data-v="arctic" aria-pressed="false">Arctic outbreak</button></div>${csvBtn('week', 'Week CSV')}</div></div>
        <div class="card-b" id="h17Week"></div></div>
      <div class="card mt" id="h17PlanCard"><div class="card-h hd-cardh"><div><h3>The plan</h3><p>The few numbers the owner sets. The page recomputes as you type and keeps every setting in this browser.</p></div><div class="hd-tools"><button type="button" class="btn sec sm" id="h17Reset">Reset every setting</button></div></div>
        <div class="card-b" id="h17Plan"></div></div>
      <div class="hd-grid2">
        <div class="card mapcard"><div class="hd-maptop"><div class="ctl"><label class="fl" for="h17Layer">Map layer</label><select id="h17Layer"></select></div><div class="ctl" style="flex:0 1 220px"><label class="fl" for="h17Find">Find a ZIP or city</label><input type="search" id="h17Find" placeholder="75150 or Mesquite" autocomplete="off"></div></div><div id="h17Map"></div><div class="legend" id="h17Leg"></div></div>
        <div class="card hd-zipcard" id="h17ZipCard" tabindex="-1"><div class="card-h"><h3 id="h17ZName">ZIP card</h3><p id="h17ZSub">Click a ZIP on the map or a row in the table</p></div><div class="card-b" id="h17Zip"></div></div>
      </div>
      ${hcard('Ranked ZIPs', 'Where the money goes, largest first. Share is where the dollars are expected to land. Bid is what a click is worth there against the campaign average, so a large, cheap ZIP can carry a minus bid. Click a row for its card.', `<label class="chk"><input type="checkbox" id="h17Bench"> show the bench: the next ZIPs to enter</label>${csvBtn('zips')}`, '<div class="tscroll" id="h17Tbl"></div><p class="hd-note" id="h17TblN"></p>')}
      ${hcard('Close to the shop and not in the plan', 'The rows an owner questions first. Each is held back for a stated reason. If you know you win there, pin it: a pinned ZIP is kept in every line that can reach it.', csvBtn('held'), '<div id="h17Held"></div>')}
      ${hcard('By line and what to build', 'Direct gross profit is the first ticket alone. With pipeline adds the share of repair and tune up visits that module 12 says become a replacement within a year. Read the two apart. Ranges are the 10th to 90th percentile of 120 replays of this plan.', csvBtn('lines', 'Lines CSV') + csvBtn('camps', 'Campaigns CSV') + csvBtn('plats', 'Platforms CSV'), '<div id="h17LinesT"></div><div class="dsec">Campaigns to build</div><div id="h17Camps"></div><div class="dsec">Platforms</div><div id="h17Plats"></div><div id="h17Lsa"></div>')}
      ${hcard('Files for the ad accounts', 'Every object is exported paused. A ZIP is a targeting unit, not a budget unit: what gets uploaded is the list, the bid adjustment and the campaign budget. File names carry the date.', '', '<div class="hd-files" id="h17Files"></div>')}
      ${hcard('Counties', 'Why a county gets what it gets: how many of its ZIPs a truck can reach, how far they are and how cold they run.', csvBtn('counties'), '<div id="h17Cty"></div><p class="hd-note" id="h17CtyN"></p>')}
      ${hcard('What a budget buys', 'The same plan at other monthly budgets. More money buys depth first, then distance.', csvBtn('ladder'), '<div id="h17LadC"></div><p class="chartnote" id="h17LadN"></p><div class="hd-cols3" id="h17Cols"></div>')}
      ${hcard('Cold rules', `Agree the rules before the first freeze, not during it. The night thresholds are the live layer's own ${G('C')}; every size is stated ${G('D')} and the weights below can be edited.`, csvBtn('rules'), '<div id="h17Rules"></div><div class="dsec">Night weights and line responses</div><div id="h17RuleEd"></div>')}
      ${hcard('Season', 'The line mix by month from October to March, the heating season so far against normal, and the outlooks.', csvBtn('season'), '<div id="h17SeasT"></div><p class="hd-note" id="h17SeasN"></p><div class="dsec">Season to date</div><div id="h17SeasLive"></div><div id="h17Outlook"></div>')}
      ${hcard('Signals that change the message, never the budget', 'Recalls, prices and rules decide what an ad says. None of them moves a dollar in the plan.', '', '<div id="h17Sig"></div>')}
      ${hcard('How sure is this', 'Where to spend is firmer than how to split it between lines. Every dollar outcome is stated arithmetic, shown as a range and never a promise.', csvBtn('ranges', 'Ranges CSV') + '<button type="button" class="btn sec sm" id="h17SensGo">Run the one at a time table</button>', '<div id="h17Sure"></div><div id="h17Sens"></div>')}
      ${card('How it is built', 'Nine steps. Each is a measured count times a stated rate, and every stated rate is a control on this page.', '<ol class="meth" id="h17Meth"></ol>', 'mt')}
      <div class="split">${card('Judgment calls', 'Where the desk had to choose.', '<div id="h17Judg"></div>')}${card('What it does not use', '', '<div id="h17Not"></div>')}</div>
      <div class="split">${card('Caveats', '', '<div id="h17Cav"></div>')}${card('Source register', '', '<div id="h17Src"></div>')}</div>
      <div class="foot">DFW Thermal Debt Atlas, module 17. Stock, fuel, normals and forecasts are measured; reach, lead costs, close rates and every cold multiplier are stated, graded and editable. Replace them with the account's own cost per booked job by drive tier after sixty days.</div></div>`;
    if (!HX) { $('#h17Gate', root).innerHTML = callout('', 'The planning engine is not loaded', 'This page draws what the Heat Desk engine computes, and the engine script is missing from this build. Nothing below can be shown until it loads. The other modules are not affected.'); $$('.wrap > section, .wrap > .kpis, .wrap > .card, .wrap > .hd-grid2, .wrap > .split', root).forEach(e => { e.style.display = 'none'; }); return; }
    /* ---------- state: a sparse patch of the owner's settings; the engine fills in and clamps the rest ---------- */
    const IDS = HX.IDS, NAMES = HX.NAMES, SHORT = HX.SHORT || NAMES, R = HX.RANGES || {}, GR = HX.GRADES || {};
    const WORD = { heat: 'heating repair', furnace: 'furnace replacement', heatpump: 'heat pump replacement', maint: 'tune ups' };
    const SV = (s => (s && typeof s === 'object' ? s : {}))(store.get(KEY, null));
    const st = { P: SV.P && typeof SV.P === 'object' && !Array.isArray(SV.P) ? SV.P : {}, layer: typeof SV.layer === 'string' ? SV.layer : 'share', bench: SV.bench === true, scn: 'live', sel: null, miss: '', mixSel: null, sens: null, sensKey: '', lad: null, ladKey: '', mon: null, monKey: '', lsaKey: '', lsaAdd: null };
    const save = () => store.set(KEY, { v: 1, P: st.P, layer: st.layer, bench: st.bench });
    /* what was saved is data from outside: keep only keys the engine knows, at the values the engine accepts */
    (() => { let full; try { full = HX.params(st.P); } catch (e) { st.P = {}; return; } const out = {}; Object.keys(st.P).forEach(k => { if (k in HX.DEF && st.P[k] != null) out[k] = full[k]; }); ['pins', 'blocks'].forEach(k => { if (out[k]) out[k] = (Array.isArray(out[k]) ? out[k] : []).map(String).filter(z => ZI[z]); }); st.P = out; })();
    /* PP: the full parameters (the global P is the percent formatter); plan, bands, F, wk: the engine's answers for them */
    let PP, plan, bands, F0, F, wk, ex = null, fail = '', dirty = false; const CSV = {};
    function compute() {
      PP = HX.params(st.P); plan = HX.plan(PP); bands = HX.bands(plan);
      F0 = HX.forecast(new Date()); if (!F0) st.scn = 'live';
      F = st.scn === 'live' ? F0 : HX.scenario(F0, st.scn);
      wk = HX.week(PP, F); ex = null;
    }
    const files = () => ex || (ex = HX.exports(plan, wk, PP));
    const pkey = () => JSON.stringify(PP) + '|' + plan.origin.lat + ',' + plan.origin.lon + '|' + plan.exposure.source;
    const sim = () => !!(wk && wk.src === 'sim');
    const simTag = () => (sim() ? '<span class="hd-sim">Simulation</span>' : '');
    const band = k => (bands && bands[k] ? [bands[k].p10, bands[k].p50, bands[k].p90] : null);
    const lband = (id, k) => (bands && bands.lines && bands.lines[id] && bands.lines[id][k] ? [bands.lines[id][k].p10, bands.lines[id][k].p50, bands.lines[id][k].p90] : null);
    const stamp = t => { const d = new Date(t); return isNaN(d) ? NA : d.toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }); };
    const sd = v => (!isN(v) ? NA : Math.round(v) === 0 ? '$0' : (v > 0 ? '+' : '-') + '$' + N(Math.abs(v)));                // a signed change in a cell
    const chg = l => (isN(l.changePct) ? l.changePct : l.normal ? (l.week / l.normal - 1) * 100 : 0);
    const over = p => (Math.round(p) === 0 ? 'level with' : Math.abs(Math.round(p)) + '% ' + (p > 0 ? 'over' : 'under'));

    /* ---------- the live records, read by meaning in one place. A missing or failed record gives null and its row hides. ---------- */
    const num = v => typeof v === 'number' && Number.isFinite(v), isDay = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v);
    function live() {
      const L = window.TDA_LIVE || {}, B = window.__CLIMATE_BASE__ || null, now = new Date();
      const safe = (f, d) => { try { const v = f(); return v == null ? d : v; } catch (e) { if (e instanceof ReferenceError || e instanceof SyntaxError) console.error('heat desk adapter', e); return d; } };
      const recs = safe(() => LIVE.all(), {}), has = id => !!(L.BY_ID && L.BY_ID[id]);
      const rec = id => (has(id) && recs[id] && recs[id].data != null ? recs[id] : null), data = id => (rec(id) ? rec(id).data : null), at = id => (rec(id) ? rec(id).at || null : null);
      const season = safe(() => { const d = data('acis_season'); if (!d) return null; const s = L.climate.status(d, B, now); return s && s.ok && s.metro ? Object.assign({ headline: L.climate.headline(s), at: at('acis_season') }, s) : null; }, null);
      const yearAgo = new Date(+now - 365 * 864e5).toISOString().slice(0, 10);
      const recalls = safe(() => { const d = data('cpsc_recalls'); if (!d || !Array.isArray(d.recalls)) return null; const ok = d.recalls.filter(r => r && isDay(r.d) && typeof r.title === 'string' && r.title); return { at: at('cpsc_recalls'), all: ok.length, since: isDay(d.since) ? d.since : null, central: ok.filter(r => r.d >= yearAgo && ['furnace', 'heatpump', 'boiler'].indexOf(r.kind) >= 0), other: ok.filter(r => r.d >= yearAgo && ['room', 'alarm'].indexOf(r.kind) >= 0) }; }, null);
      const permitIds = Object.keys(L.BY_ID || {}).filter(id => /^permits_/.test(id));
      return { now, base: B, has, rec, data, at, season, recalls, def: id => (has(id) ? L.BY_ID[id] : null), permitIds,
        /* normal freeze nights a year by county and by ZIP, from the climate baseline baked into the build */
        freezeNights: safe(() => { const out = {}; (L.geo.counties || []).forEach(c => { const p = B.prismCounty[c.fips]; if (p && isN(p.fr32)) out[c.name] = p.fr32; }); return Object.keys(out).length ? out : null; }, null),
        zipNormal: zip => safe(() => B.zip[zip] || null, null),
        outlook: safe(() => outlookOf(data('cpc_outlook'), at('cpc_outlook'), now), null),
        prices: safe(() => pricesOf(data('bls_energy'), at('bls_energy')), null),
        rules: safe(() => rulesOf(data('fedreg_rules'), at('fedreg_rules'), now), null),
        licenses: safe(() => licensesOf(data('tdlr_licenses'), at('tdlr_licenses')), null),
        permits: safe(() => permitsOf(permitIds.map(id => ({ id, d: data(id), at: at(id) })).filter(x => x.d)), null) };
    }
    /* Some of these collectors were still being written when this page was built. Each reader takes the record by meaning and
       returns null unless it finds what it needs, so a record that is missing, empty or shaped differently hides its row. */
    /* the 6 to 10 and 8 to 14 day temperature outlooks: which way they lean, how firmly, and the heating load they imply */
    function outlookOf(d, at, now) {
      if (!d || typeof d !== 'object') return null;
      const ext = d.ext && typeof d.ext === 'object' ? d.ext : d, LEAN = { A: 'above', B: 'below', N: 'near', E: 'equal' }, t = today();
      const one = (o, name) => { if (!o || typeof o !== 'object' || !isDay(o.start) || !isDay(o.end) || o.end.slice(0, 10) < t) return null;      /* a window that has already passed says nothing */ const c = String(o.cat == null ? '' : o.cat).trim().charAt(0).toUpperCase(); if (!LEAN[c]) return null;
        return { name, start: o.start.slice(0, 10), end: o.end.slice(0, 10), issued: isDay(o.issued) ? o.issued.slice(0, 10) : null, lean: LEAN[c], prob: num(o.prob) && o.prob > 0 && o.prob <= 100 ? o.prob : null, load: o.load && num(o.load.idx) && o.load.idx > 0 ? o.load.idx : null }; };
      const wins = [one(ext.d610, '6 to 10 days'), one(ext.d814, '8 to 14 days')].filter(Boolean); if (!wins.length) return null;
      let read = null; try { const f = window.TDA_LIVE && TDA_LIVE.derive && TDA_LIVE.derive.outlook, r = typeof f === 'function' ? f(LIVE.all(), now) : null; if (r && r.ok && typeof r.headline === 'string' && r.headline) read = { tier: num(r.tier) ? r.tier : null, name: typeof r.tierName === 'string' ? r.tierName : '', headline: r.headline, sub: typeof r.sub === 'string' ? r.sub : '', stale: !!r.stale }; } catch (e) { read = null; }
      return { at, wins, read };
    }
    /* Dallas Fort Worth price indexes: the change over 12 months of electricity and piped gas */
    function pricesOf(d, at) {
      if (!d || typeof d !== 'object') return null;
      const S = d.series && typeof d.series === 'object' ? d.series : {}, Y = d.yoy && typeof d.yoy === 'object' ? d.yoy : {};
      const yoy = k => { if (num(Y[k])) return Y[k]; const pts = S[k] && Array.isArray(S[k].points) ? S[k].points.filter(p => p && num(p.v) && typeof p.p === 'string') : []; if (pts.length < 2) return null; const last = pts[pts.length - 1], prev = pts.find(p => p.p === (+last.p.slice(0, 4) - 1) + last.p.slice(4)); return prev && prev.v > 0 ? (last.v / prev.v - 1) * 100 : null; };
      const e = yoy('electricity'), g = yoy('gas'); if (e == null && g == null) return null;
      return { at, through: typeof d.through === 'string' && /^\d{4}-\d{2}/.test(d.through) ? d.through.slice(0, 7) : null, electricity: e, gas: g };
    }
    /* Federal Register documents on furnaces, heat pumps, refrigerants, credits and advertising: what is new and which dates are ahead */
    function rulesOf(d, at, now) {
      if (!d || !Array.isArray(d.docs)) return null;
      const docs = d.docs.filter(x => x && typeof x.title === 'string' && x.title && isDay(x.d)); if (!docs.length) return null;
      const t = today(), cut = new Date(+now - 90 * 864e5).toISOString().slice(0, 10); let up = null;
      try { up = TDA_LIVE.fedreg.upcoming(d, now); } catch (e) { up = null; }
      if (!Array.isArray(up)) up = docs.filter(x => isDay(x.effective) && x.effective >= t && x.type !== 'Proposed Rule').map(x => Object.assign({}, x, { what: 'effective', on: x.effective })).sort((a, b) => (a.on < b.on ? -1 : 1));
      return { at, n: docs.length, recent: docs.filter(x => x.d >= cut), next: up.filter(u => u && isDay(u.on) && typeof u.title === 'string' && u.title).slice(0, 3), newest: docs.slice().sort((a, b) => (a.d < b.d ? 1 : -1))[0] };
    }
    /* active air conditioning contractor licenses by county, from the state file */
    function licensesOf(d, at) {
      if (!d || !Array.isArray(d.counties)) return null;
      const by = {}; d.counties.forEach(c => { if (c && typeof c.name === 'string' && num(c.contractors)) by[c.name] = c.contractors; });
      return Object.keys(by).length ? { at, asOf: isDay(d.asOfDay) ? d.asOfDay : isDay(d.asOf) ? d.asOf.slice(0, 10) : null, by, total: sum(Object.keys(by).map(k => by[k])) } : null;
    }
    /* city mechanical permits of the last 12 full months, summed by county and kept by ZIP; a city that does not publish is simply absent */
    function permitsOf(list) {
      if (!list.length) return null; const recs = {}; list.forEach(x => { recs[x.id] = { data: x.d }; });
      const s = TDA_LIVE.permits.summary(recs); if (!s || !Array.isArray(s.cities) || !s.cities.length || !s.byZip) return null;
      const by = {}, zip = {}; Object.keys(s.byZip).forEach(z => { const v = s.byZip[z], zr = ZI[z]; if (!zr || !v || !num(v.mech12)) return; by[zr.cty] = (by[zr.cty] || 0) + v.mech12; zip[z] = { n: v.mech12, city: typeof v.city === 'string' ? v.city : '' }; });
      return Object.keys(zip).length ? { at: list.map(x => x.at).filter(Boolean).sort().pop() || null, by, zip, cities: s.cities.map(c => c.city).filter(Boolean), through: isDay(s.through) ? s.through : null } : null;
    }

    /* ---------- the plan: controls built once from the engine's own ranges, so no control can ask for a value the engine refuses ---------- */
    const cid = p => 'h17c_' + p.replace(/\W/g, '_'), k100 = p => (R[p] && R[p].pct ? 100 : 1), r6 = v => +(+v).toFixed(6);
    const unitOf = p => { const u = (R[p] || {}).unit || ''; return u === 'x' ? '×' : u; };
    const lab = (p, alt) => alt || ec((R[p] && R[p].label) || p);
    const decOf = p => { const st = String(r6(((R[p] || {}).step || 1) * k100(p))), i = st.indexOf('.'); return Math.min(6, (i < 0 ? 0 : st.length - i - 1) + 1); };                 // one decimal more than the step shows
    const shownV = (p, v) => (isN(v) ? +(v * k100(p)).toFixed(decOf(p)) : '');
    const attrs = p => { const r = R[p] || {}, k = k100(p); return `${isN(r.min) ? ` min="${r6(r.min * k)}"` : ''}${isN(r.max) ? ` max="${r6(r.max * k)}"` : ''} step="${isN(r.step) ? r6(r.step * k) : 'any'}"`; };
    const lrow = (p, o, extra) => `<div class="hd-lr"><label class="fl" for="${cid(p)}">${lab(p, o.l)}${unitOf(p) && !o.nounit ? ' (' + esc(unitOf(p)) + ')' : ''}</label>${G((R[p] || {}).grade || o.g || 'D')}${extra || ''}</div>`;
    const numF = (p, o) => { o = o || {}; return `<div class="hd-f">${lrow(p, o)}<input type="number" id="${cid(p)}" data-p="${p}" inputmode="decimal"${attrs(p)}>${o.hint ? `<span class="hd-hint">${o.hint}</span>` : ''}</div>`; };
    const rngF = (p, o) => { o = o || {}; return `<div class="hd-f">${lrow(p, Object.assign({ nounit: 1 }, o), `<span class="hd-val" id="${cid(p)}_v"></span>`)}<input type="range" id="${cid(p)}" data-p="${p}"${o.also ? ` data-also="${o.also}"` : ''}${attrs(p)}>${o.hint ? `<span class="hd-hint">${o.hint}</span>` : ''}</div>`; };
    const chkF = (p, text) => `<label class="chk"><input type="checkbox" id="${cid(p)}" data-p="${p}"> ${text}</label>`;
    const PLACED = ['budget', 'reserve', 'month'];                                     // drawn by hand in the plan card; half.* and mix.* too
    const GROUPS = [['Fill and guards', ['cut', 'trust', 'doubt', 'gamma', 'hurdle', 'depth', 'zipCap', 'lineMin', 'coreMin']], ['What ads can win, and what a job is worth', ['paid', 'cap', 'pipeCredit']], ['Who decides, and cold exposure', ['dmw', 'coldExp']], ['Platform minimums ($ a month): a platform under its minimum folds into Google Search', ['platMin']], ['Crews and phones', ['crewCap', 'hours']]];
    const rkeys = Object.keys(R), top = p => p.split('.')[0];
    const advKeys = rkeys.filter(p => R[p].where !== 'cold' && PLACED.indexOf(p) < 0 && ['half', 'mix', 'plat', 'nightW', 'resp', 'alertFloor'].indexOf(top(p)) < 0);
    const grouped = GROUPS.map(([t, ks]) => [t, advKeys.filter(p => ks.indexOf(top(p)) >= 0)]).concat([['Other', advKeys.filter(p => !GROUPS.some(g => g[1].indexOf(top(p)) >= 0))]]).filter(g => g[1].length);
    const platRows = rkeys.some(p => top(p) === 'plat') ? `<div class="hd-advg">Platform mix by line (%): where each line's money runs before minimums fold it</div><div class="xscroll"><table class="hd-plat"><thead><tr>${th('Line', 1)}${HX.PLATS.map(pl => th(esc(HX.PLAT_NAMES[pl]))).join('')}</tr></thead><tbody>${IDS.map(id => `<tr><td class="l">${esc(NAMES[id])}</td>${HX.PLATS.map(pl => { const p = `plat.${id}.${pl}`; return `<td>${R[p] ? `<input type="number" id="${cid(p)}" data-p="${p}" aria-label="${esc(NAMES[id])} on ${esc(HX.PLAT_NAMES[pl])}, percent"${attrs(p)}>` : ''}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div><p class="hd-hint">Each row is rescaled to add to 100. ${G('D')}</p>` : '';
    const monthOpts = `<option value="">This month (${MON[new Date().getMonth()]})</option>` + MON.map((m, i) => `<option value="${i}">${m}</option>`).join('');
    $('#h17Plan', root).innerHTML = `<div class="hd-plan">
        ${numF('budget', { l: 'Monthly heating media', hint: 'Dollars for the month: all four lines, every platform.' })}
        <div class="hd-f"><div class="hd-lr"><label class="fl" for="h17Month">Month</label>${G('B')}</div><select id="h17Month">${monthOpts}</select><span class="hd-hint">Sets each line's season. The week card always uses the month the forecast falls in.</span></div>
        ${rngF('reserve', { l: 'Freeze reserve', hint: 'Share of the month held back for cold weeks.' })}
        <div class="hd-f"><div class="hd-lr"><span class="fl" id="h17BidL">Bidding mode</span></div><div class="seg" id="h17Bid" role="group" aria-labelledby="h17BidL"><button type="button" data-v="manual">Manual or Maximize clicks</button><button type="button" data-v="smart">Smart Bidding</button></div><span class="hd-hint" id="h17BidH"></span></div>
        <div class="hd-f"><div class="hd-lr"><span class="fl">Local Services Ads</span></div>${chkF('lsaLive', 'Local Services Ads are live')}<span class="hd-hint">Off by default: the ${ROSTER} roster shows no Local Services badge for the client. Switch it on once the profile is verified.</span></div>
        ${rngF('half.heat', { l: 'Reach, heating repair', hint: 'Drive minutes at which a repair lead is worth half.' })}
        ${rngF('half.furnace', { l: 'Reach, replacement', also: 'half.heatpump', hint: 'Furnace and heat pump replacement move together.' })}
        ${rngF('half.maint', { l: 'Reach, tune up', hint: 'A small ticket cannot carry a long drive.' })}
        <div class="hd-f"><div class="hd-lr"><label class="fl" for="h17PinIn">Pin a ZIP</label></div><div class="hd-ziprow"><input type="text" id="h17PinIn" inputmode="numeric" maxlength="5" placeholder="75150" autocomplete="off"><button type="button" class="btn sec sm" data-act="addpin">Pin</button></div><div class="hd-ziplist" id="h17Pins"></div><span class="hd-hint">A pinned ZIP is kept in every line that can reach it.</span></div>
        <div class="hd-f"><div class="hd-lr"><label class="fl" for="h17BlkIn">Block a ZIP</label></div><div class="hd-ziprow"><input type="text" id="h17BlkIn" inputmode="numeric" maxlength="5" placeholder="75201" autocomplete="off"><button type="button" class="btn sec sm" data-act="addblock">Block</button></div><div class="hd-ziplist" id="h17Blocks"></div><span class="hd-hint">A blocked ZIP gets nothing and goes into the exclusions file.</span></div>
        <div class="hd-f wide"><div class="hd-lr"><span class="fl" id="h17ModeL">Line mix</span>${G('D')}</div><div class="seg" id="h17Mode" role="group" aria-labelledby="h17ModeL"><button type="button" data-v="auto">Auto</button>${Object.keys(HX.PRESETS || {}).map(k => `<button type="button" data-v="${esc(k)}">${ec(HX.PRESETS[k].name)}</button>`).join('')}<button type="button" data-v="custom">Custom</button></div>
          <div class="hd-mix" id="h17Mix">${IDS.map(id => `<label for="h17Mix_${id}">${esc(NAMES[id])} (%)<input type="number" id="h17Mix_${id}" data-mix="${id}" min="0" max="100" step="1" inputmode="numeric"></label>`).join('')}</div><span class="hd-hint" id="h17ModeH"></span></div>
      </div>
      <details class="hd-adv" id="h17Adv"><summary>Advanced: every other assumption, with its grade</summary>
        ${grouped.map(([t, ks]) => `<div class="hd-advg">${t}</div><div class="hd-plan">${ks.map(p => numF(p)).join('')}${t === 'Crews and phones' && HX.DEF.hours ? `<div class="hd-f"><div class="hd-lr"><span class="fl">Phones</span></div>${'sunday' in HX.DEF.hours ? chkF('hours.sunday', 'Phones are answered on Sunday') : ''}${'onCall' in HX.DEF.hours ? chkF('hours.onCall', 'On call during cold alerts, 6 am to 10 pm every day') : ''}</div>` : ''}</div>`).join('')}
        ${platRows}
      </details>`;
    const coldKeys = rkeys.filter(p => R[p].where === 'cold' || ['nightW', 'resp', 'alertFloor'].indexOf(top(p)) >= 0);
    $('#h17RuleEd', root).innerHTML = coldKeys.length ? `<div class="hd-plan hd-cold">${coldKeys.map(p => numF(p)).join('')}</div><p class="hd-hint">A 40°F night weighs 1. Repair follows the week's multiplier one for one; the replacement lines take the stated share of its lift and tune ups give the same share back.</p>` : '<p class="hd-empty">The engine publishes no editable cold rule in this build.</p>';
    const nullable = p => { try { return HX.get(HX.DEF, p) === null; } catch (e) { return false; } };
    const readout = el => { const o = $('#' + el.id + '_v', root); if (!o) return; const u = (R[el.dataset.p] || {}).unit; o.textContent = u === 'min' ? el.value + ' min' : u === '%' ? el.value + '%' : u === '$' ? usd(+el.value) : el.value; };
    function readCtl(el) { const p = el.dataset.p; if (el.type === 'checkbox') return el.checked; if (el.value.trim() === '') return nullable(p) ? null : undefined; const v = +el.value; return isN(v) ? v / k100(p) : undefined; }
    /* one control into the saved patch: the engine clamps it, and only the top level key it belongs to is stored */
    function commit(el) {
      const p = el.dataset.p, v = readCtl(el); if (v === undefined) return false;
      let P2; try { P2 = HX.set(PP, p, v); (el.dataset.also || '').split(',').filter(Boolean).forEach(q => { P2 = HX.set(P2, q, v); }); } catch (e) { return false; }
      st.P[top(p)] = P2[top(p)]; save(); return true;
    }
    function setMix(id, v) {
      v = clamp(Math.round(+v) || 0, 0, 100); const rest = IDS.filter(x => x !== id), cur = rest.map(x => +PP.mix[x] || 0), s = sum(cur), left = 100 - v, out = { [id]: v }; let acc = 0;
      rest.forEach((x, i) => { out[x] = Math.max(0, i === rest.length - 1 ? left - acc : Math.round(s > 0 ? left * cur[i] / s : left / rest.length)); acc += out[x]; });
      st.P.mode = 'custom'; st.P.mix = out; st.mixSel = 'custom'; save();
    }
    function toggleZip(kind, zip, on) {
      zip = String(zip == null ? '' : zip).trim();
      if (!ZI[zip]) { toast(zip ? `${zip.slice(0, 10)} is not a ZIP code in this atlas` : 'Type a five digit ZIP code first'); return false; }
      if (on && !plan.at[zip]) { toast(`${zip} has too few households to plan`); return false; }
      const cur = { pins: (PP.pins || []).filter(z => z !== zip), blocks: (PP.blocks || []).filter(z => z !== zip) }; if (on) cur[kind].push(zip);
      st.P.pins = cur.pins; st.P.blocks = cur.blocks; save(); render();
      toast(`${zip} ${ZI[zip].city} ${on ? (kind === 'pins' ? 'pinned' : 'blocked') : (kind === 'pins' ? 'unpinned' : 'unblocked')}`); return true;
    }
    function syncUI(force) {
      const act = document.activeElement;
      $$('[data-p]', root).forEach(el => { if (!force && el === act) return; const v = HX.get(PP, el.dataset.p); if (el.type === 'checkbox') el.checked = !!v; else { el.value = v == null ? '' : shownV(el.dataset.p, v); if (el.type === 'range') readout(el); } });
      const m = $('#h17Month', root); if (force || m !== act) m.value = st.P.month == null ? '' : String(PP.month);
      const preset = Object.keys(HX.PRESETS || {}).find(k => IDS.every(id => Math.round(HX.PRESETS[k].mix[id]) === Math.round(PP.mix[id])));
      const mode = PP.mode !== 'custom' ? 'auto' : st.mixSel && (st.mixSel === 'custom' || st.mixSel === preset) ? st.mixSel : preset || 'custom';
      $$('#h17Mode button', root).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === mode)));
      $$('#h17Bid button', root).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === PP.bidding)));
      IDS.forEach(id => { const i = $('#h17Mix_' + id, root); i.disabled = PP.mode !== 'custom'; if (force || i !== act) i.value = Math.round(PP.mode === 'custom' ? PP.mix[id] : plan.T.mix[id] * 100); });
      $('#h17ModeH', root).innerHTML = PP.mode === 'custom' ? 'Custom: each line is filled on its own with its share of the budget. Change one share and the other three rescale so the four add to 100.' : `Auto: one fill across the four lines decides the split, and the boxes show how it came out this month. Pick Custom to set it yourself.`;
      $('#h17BidH', root).innerHTML = PP.bidding === 'smart' ? 'Smart Bidding ignores location bid adjustments, so the plan builds one campaign per drive tier, each with its own budget and first target cost per lead.' : 'Location bid adjustments by ZIP are exported. They work with manual bidding and Maximize clicks only.';
      const zt = (zip, kind) => `<span class="hd-zt${kind === 'blocks' ? ' blk' : ''}">${esc(zip)} ${esc((ZI[zip] || {}).city || '')}<button type="button" data-act="${kind === 'pins' ? 'unpin' : 'unblock'}" data-zip="${esc(zip)}" aria-label="Remove ${esc(zip)} from the ${kind === 'pins' ? 'pinned' : 'blocked'} ZIP codes">×</button></span>`;
      $('#h17Pins', root).innerHTML = (PP.pins || []).length ? PP.pins.map(z => zt(z, 'pins')).join('') : '<span class="hd-hint">None pinned.</span>';
      $('#h17Blocks', root).innerHTML = (PP.blocks || []).length ? PP.blocks.map(z => zt(z, 'blocks')).join('') : '<span class="hd-hint">None blocked.</span>';
      $$('#h17Scn button', root).forEach(b => { b.setAttribute('aria-pressed', String(b.dataset.v === st.scn)); b.disabled = b.dataset.v !== 'live' && !F0; });
      $('#h17Bench', root).checked = st.bench; if (force || $('#h17Layer', root) !== act) $('#h17Layer', root).value = st.layer;
    }
    /* ---------- notices above the answer: what is simulated, what is missing ---------- */
    function gate() {
      const out = [], miss = [];
      if (fail) out.push(callout('', 'The plan could not be computed', `The engine stopped with this message: ${esc(fail)}. What shows below is the last plan that worked. Reset every setting if this followed a change you made.`));
      if (sim()) out.push(callout('judg', 'Simulation, not a forecast', `${ec(wk.label || 'A simulated week')}. The week card, the Monday list and the week sheet show invented lows built from the live ones, to see what the cold rules would do. The month plan does not change. <button type="button" class="lnk" data-act="live">Back to the live forecast</button>`));
      if (!F0) miss.push('<b>The forecast.</b> No seven night forecast is stored, so the week runs as a normal week and no cold rule fires. Live Data fetches it.');
      else if (F0.stale) miss.push(`<b>A fresh forecast.</b> The stored one is from ${esc(stamp(F0.at))}, more than 36 hours old, so the week runs as a normal week until it refreshes.`);
      if (plan.exposure.source === 'none') miss.push('<b>Normal cold by ZIP.</b> The climate baseline is not in this build, so cold exposure is 1 in every ZIP. Near Mesquite the effect is small.');
      const un = [['acis_season', 'the heating season to date'], ['cpc_outlook', 'the 6 to 10 and 8 to 14 day outlooks'], ['cpsc_recalls', 'heating equipment recalls'], ['bls_energy', 'gas and electricity price indexes'], ['fedreg_rules', 'federal rules'], ['tdlr_licenses', 'contractor licenses by county']].filter(r => LV.has(r[0]) && !LV.rec(r[0])).map(r => r[1]).concat((ids => (ids.length ? ['mechanical permits of ' + list(ids.map(id => ((LV.def(id) || {}).config || {}).city || String((LV.def(id) || {}).name || id).replace(/ mechanical.*$/i, '')))] : []))(LV.permitIds.filter(id => !LV.rec(id))));
      if (un.length) miss.push(`<b>Records not stored yet:</b> ${list(un.map(esc))}. Their rows stay hidden until Live Data fetches them. The plan itself does not wait for any of them.`);
      /* what is simulated or broken goes above the answer; what is merely missing goes under the headline numbers, so the answer stays the first thing on the page */
      $('#h17Miss', root).innerHTML = miss.length ? callout('note', 'What is missing right now', `<ul class="hooks">${miss.map(m => `<li>${m}</li>`).join('')}</ul><button type="button" class="lnk" data-act="golive">Open Live Data</button>`) : '';
      $('#h17Gate', root).innerHTML = out.join('');
    }
    function meta() {
      const T = plan.T;
      $('#h17M1', root).innerHTML = `<b>${N(T.zips)}</b> ${T.zips === 1 ? 'ZIP' : 'ZIPs'} in the plan`;
      $('#h17M2', root).innerHTML = `<b>${N(T.households)}</b> households in them`;
      $('#h17M3', root).innerHTML = `<b>${pc(T.share20)}</b> of the money within 20 minutes of the shop`;
      $('#h17M4', root).innerHTML = F0 ? `<b>Forecast</b> fetched ${esc(LIVE.ago(F0.at))}${F0.baseline ? ', the copy baked into this build' : ''}` : '<b>Forecast</b> not stored yet';
    }

    /* ---------- the answer: where, on what, this week, on Monday. Every number is read from the same plan and week the tables print, in the same rounding. ---------- */
    const shr = f => (isN(f) ? P(f * 100, f > 0 && f < 0.0995 ? 1 : 0) : NA);                    // a share of the money: one decimal under 10%, the same in the answer and in the tables
    const cap1 = s => s.charAt(0).toUpperCase() + s.slice(1);
    function whyMix(lead) {
      const h = plan.line.heat;
      if (plan.T.mode === 'custom') return 'The split is the one you set: a custom mix, each line filled on its own with its share of the budget.';
      if (lead.id === 'heat') return `Repair leads because ${plan.monthName} is inside the heating season (repair season index ${N(h.season)}, where 100 is an average month) and a paid click starts about ${pc(PP.paid.heat)} of repair jobs against ${pc(PP.paid.furnace)} of furnace replacements, so the replacement ZIPs fill up first and the money moves on to repair.`;
      if (h.season < 100) return `${cap1(WORD[lead.id])} leads because heating repair is out of season in ${plan.monthName} (repair season index ${N(h.season)}, where 100 is an average month). Repair takes over with the first cold nights.`;
      return `The fill puts ${WORD[lead.id]} first this month; the line table shows what each line returns.`;
    }
    function answer() {
      const T = plan.T, L = plan.lines.filter(l => l.dollars > 0).sort((a, b) => b.dollars - a.dollars), cs = plan.counties.filter(c => c.dollars > 0);
      const city = {}; plan.zips.forEach(r => { city[r.city] = (city[r.city] || 0) + r.dollars; }); const cities = Object.keys(city).sort((a, b) => city[b] - city[a]).slice(0, 3);
      let where, what, week;
      if (!T.zips || !L.length) { where = `No ZIP clears the plan at ${usd(T.budget)} a month in ${plan.monthName}. Raise the budget, widen the reach or clear the blocked ZIPs.`; what = 'With nothing in the plan there is no line mix to report.'; }
      else {
        const far = plan.zips.reduce((a, b) => (b.min > a.min ? b : a)), z1 = plan.zips[0];
        where = `Spend it close to the shop. At ${usd(T.budget)} a month in ${plan.monthName} the plan buys <b>${plural(T.zips, 'ZIP')}</b>, with <b>${pc(T.share20)}</b> of the money within 20 minutes of the dispatch point and nothing past <b>${N(T.farthest)} minutes</b> (${esc(far.city)} ${esc(far.zip)}). `
          + (cs.length === 1 ? `All of it lands in <b>${esc(cs[0].county)} County</b>. ` : `<b>${esc(cs[0].county)} County</b> takes ${shr(cs[0].share)}, then ${list(cs.slice(1, 4).map(c => `${esc(c.county)} ${shr(c.share)}`))}${cs.length > 4 ? `, and ${plural(cs.length - 4, 'more county', 'more counties')} the rest` : ''}. `)
          + `The ${cities.length === 1 ? 'city that leads is' : 'cities that lead are'} ${list(cities.map(esc))}; the largest single ZIP is ${esc(z1.zip)} ${esc(z1.city)} at ${usd(z1.dollars)} a month.`
          + (T.unspent > 0.5 ? ` <b>${usd(T.unspent)} stays unspent</b>: ${isN(T.hurdleAt) ? `past ${usd(T.hurdleAt)} a month ` : ''}the last dollar would bring back less than $${D(T.hurdle, 2)} of gross profit.` : '') + ` ${G(GR.spend || 'C')}`;
        what = `<b>${esc(L[0].name)}</b> leads with ${shr(L[0].share)} of the money (${usd(L[0].dollars)} a month)${L.length > 1 ? ', then ' + list(L.slice(1).map(l => `${WORD[l.id]} ${shr(l.share)} (${usd(l.dollars)})`)) : ''}. ${whyMix(L[0])} ${G('D')}`;
      }
      if (wk.src === 'normal') week = `${wk.missing || !F0 ? 'No forecast is stored' : 'The stored forecast is more than 36 hours old'}, so the week runs as a normal ${esc(wk.monthName)} week: <b>${usd(wk.T.normal)}</b> across the four lines, every multiplier at 1 and nothing drawn from the freeze reserve. Refresh the live data before changing a budget. ${G('D')}`;
      else {
        const h = wk.lines.find(l => l.id === 'heat') || wk.lines[0], rs = wk.reserve;
        week = `${simTag()}${wk.head && wk.head.headline ? ec(wk.head.headline) + '. ' : ''}Heating repair runs ${over(chg(h))} a normal ${esc(wk.monthName)} week${h.paused ? ' (paused)' : ''}. The week comes to <b>${usd(wk.T.week)}</b> against a normal ${usd(wk.T.normal)}, `
          + (rs.draw > 0.5 ? `drawing ${usd(rs.draw)} from the freeze reserve` : rs.back > 0.5 ? `returning ${usd(rs.back)} to the freeze reserve` : 'with nothing moving in or out of the freeze reserve') + '. '
          + (wk.trigger ? 'A cold trigger is on, so the ZIP list is poured again for the week.' : 'No cold trigger: the ZIP list and the bids stay as they are.')
          + (wk.crew && isN(wk.crew.cap) ? ` The crew cap of ${N(wk.crew.cap)} paid booked jobs a week holds the week down.` : '')
          + (wk.month !== plan.month ? ` The week is planned on ${esc(wk.monthName)}, the month the forecast falls in, not on the ${esc(plan.monthName)} the plan is set to.` : '') + ` ${G(sim() ? 'D' : 'A/D')}`;
      }
      const todo = wk.list || [], first = todo.find(x => x.k !== 'sim') || todo[0];
      const monday = (first ? ec(first.text) : 'Nothing to change. Hold the month plan as it stands.') + (todo.length > 1 ? ` <span class="hd-more">${plural(todo.length - 1, 'more step')} for ${wk.monday ? esc(day(wk.monday)) : 'Monday'} in This week, below; the Monday pack holds the files.</span>` : '');
      $('#h17Answer', root).innerHTML = `<h2 id="h17AnsH">The answer: where to spend, on what, and what to do on Monday</h2>
        <dl class="hd-ans"><dt>Where</dt><dd data-a="where">${where}</dd><dt>On what</dt><dd data-a="what">${what}</dd><dt>This week</dt><dd data-a="week">${week}</dd><dt>On Monday</dt><dd data-a="monday">${monday}</dd></dl>
        <p class="hd-fine"><b>Measured:</b> homes, heating fuel, system ages, the normal cold of each ZIP, the forecast and the alerts. <b>Stated:</b> how far a lead is worth driving, lead costs, close rates and the size of every cold response (grade D, all editable below), so the dollar outcomes are benchmark arithmetic shown with a range and never a promise.</p>`;
    }

    /* ---------- KPI row ---------- */
    function nextTrigger() {
      if (wk.src === 'normal' || !F) return 'No usable forecast: the week runs as a normal week.';
      if (wk.trigger) return `Cold trigger on${wk.triggerWhy && wk.triggerWhy.length ? ': ' + ec(list(wk.triggerWhy)) : ''}.`;
      const TH = (window.TDA_LIVE && TDA_LIVE.derive && TDA_LIVE.derive.TH) || { cold: 40, freeze: 32, hard: 25 }, lo = F.head ? F.head.minLow : null;
      const nx = [['cold nights', TH.cold], ['a freeze', TH.freeze], ['a hard freeze', TH.hard], ['extreme cold', 15]].find(s => isN(lo) && lo > s[1]);
      return nx ? `No cold trigger. The next threshold is ${nx[0]} at ${nx[1]}°F, ${Math.round(lo - nx[1])}°F below the coldest night ahead.` : 'Every night threshold is already crossed this week.';
    }
    function kpis() {
      const T = plan.T, tiers = plan.tiers.map(t => `${t.tier} ${pc(t.share)}`).join(', '), lo = F && F.head && isN(F.head.minLow) ? F.head.minLow : null;
      $('#h17Kpis', root).innerHTML = kpiHTML([
        { l: 'Monthly heating media', g: GR.spend || 'C', v: usd(T.spent), d: T.unspent > 0.5 ? `${usd(T.unspent)} of ${usd(T.budget)} left unspent: the last dollar would bring back less than the hurdle of $${D(T.hurdle, 2)} of gross profit${isN(T.hurdleAt) ? `, which starts to bind at ${usd(T.hurdleAt)} a month` : ''}` : `all of ${usd(T.budget)} placed, nothing left unspent${isN(T.hurdleAt) ? `; money would start to stay unspent at about ${usd(T.hurdleAt)} a month` : ''}` },
        { l: 'ZIPs in the plan', g: GR.spend || 'C', v: N(T.zips), d: `${N(T.households)} households · ${N(T.cells)} ZIP by line cells funded` },
        { l: 'Within 20 minutes', g: GR.minutes || 'C', v: pc(T.share20), d: `of the money; farthest ZIP ${n0(T.farthest)} minutes · ${tiers}` },
        { l: 'Leads a month', g: GR.leads || 'D', v: n0(T.leads), d: `${usd(T.cpl)} a lead · range ${rng(band('leads'), n0)} leads, 10th to 90th percentile` },
        { l: 'Booked jobs a month', g: GR.jobsBooked || 'D', v: n1(T.jobs), d: `${usd(T.cpj)} a job · range ${rng(band('jobs'), n1)}` },
        { l: 'Gross profit, direct', g: GR.gp || 'D', v: usd(T.gpDirect), d: `range ${rng(band('gpDirect'), usd)} · with pipeline ${usd(T.gp)}, range ${rng(band('gp'), usd)} · benchmark arithmetic, not a forecast` },
        { l: sim() ? 'Coldest low, simulated' : 'Coldest forecast low', g: sim() ? 'D' : GR.forecast || 'A', v: lo == null ? NA : Math.round(lo) + '°F', d: nextTrigger() },
      ]);
    }

    /* ---------- this week ---------- */
    function week() {
      const rs = wk.reserve || {}, hd = wk.head || {}, normal = wk.src === 'normal', WX = wk.wx || {}, why = wk.missing || !F0 ? 'No forecast is stored' : 'The stored forecast is more than 36 hours old';
      const nights = (wk.days || []).map(d => `<div class="hd-night"><div class="hd-nd">${ec(d.label || dshort(d.date))}</div>`
        + (isN(d.low) ? `<div class="hd-nl"><b>${Math.round(d.low)}°F</b><span>low at the shop</span></div><div class="hd-nr">${isN(d.metroMin) && isN(d.metroMax) ? (Math.round(d.metroMin) === Math.round(d.metroMax) ? `${Math.round(d.metroMin)}°F` : `${Math.round(d.metroMin)} to ${Math.round(d.metroMax)}°F`) + ' across the metro' : 'no metro range'}</div>` : '<div class="hd-nl"><b>n/a</b><span>no forecast low</span></div><div class="hd-nr">runs as a normal day</div>')
        + `<div class="hd-nc">${d.tierName ? `<span class="hd-chip t${clamp(Math.round(d.tier) || 0, 0, 4)}">${ec(d.tierName)}</span>` : ''}${d.alert ? ` <span class="hd-chip warn">${ec(d.alert === true ? 'alert' : d.alert)}</span>` : ''}${isN(d.ice) && d.ice >= 0.1 ? ` <span class="hd-chip warn">ice ${D(d.ice, 1)} in</span>` : ''}</div><div class="hd-nb"><b>${usd(d.repair)}</b> repair that day${isN(d.capUp) && d.capUp > 0 ? ` · bid caps +${Math.round(d.capUp)}%` : ''}</div></div>`).join('');
      const lastCold = isN(WX.lastW) && WX.own && WX.lastW > WX.own.heat;
      const lnote = l => [l.paused ? 'paused this week' : '', l.carried ? (lastCold ? `keeps the lift of last week's cold, ${mult(WX.lastW)} on repair` : 'held at a normal week: replacement does not follow a mild week down') : '', (l.added || []).length ? `${plural(l.added.length, 'ZIP')} added` : '', (l.dropped || []).length ? `${plural(l.dropped.length, 'ZIP')} paused` : ''].filter(Boolean).join(' · ') || plural(l.zips, 'ZIP');
      const delta = (a, b) => [`${sd(a - b)}${b > 0 ? `<small>${sg((a / b - 1) * 100)}</small>` : ''}`, 'hd-cell'];
      const rows = wk.lines.map(l => tr([[esc(l.name), 'l'], usd(l.normal), `<b>${usd(l.week)}</b>`, delta(l.week, l.normal), mult(l.mult), [lnote(l), 'l wrap']]));
      rows.push(tr([['Total', 'l'], usd(wk.T.normal), `<b>${usd(wk.T.week)}</b>`, delta(wk.T.week, wk.T.normal), '', [`${plural(wk.T.zips, 'ZIP')} · ${n0(wk.T.leads)} leads expected ${G('D')}`, 'l wrap']], 'hd-total'));
      const zl = a => list(a.map(x => `${esc(x.zip)} ${esc(x.city || '')}`.trim()));
      const extra = [wk.added && wk.added.length ? `Added this week: ${zl(wk.added)}.` : '', wk.paused && wk.paused.length ? `Paused this week: ${zl(wk.paused)}.` : '', wk.crew && wk.crew.text ? ec(wk.crew.text) : ''].concat((wk.notes || []).filter(n => n && n.kind !== 'sim').map(n => ec(n.text))).filter(Boolean);
      $('#h17Week', root).innerHTML = `<p class="hd-weekhead">${simTag()}${ec(hd.headline || (normal ? `A normal ${wk.monthName} week` : 'The next seven nights'))}</p><p class="hd-weeksub">${hd.eyebrow ? `<b>${ec(hd.eyebrow)}.</b> ` : ''}${ec(hd.sub || '')}${normal ? ` ${why}, so every multiplier is 1.` : ''}</p>
        ${nights ? `<div class="hd-nights">${nights}</div>` : ''}
        <div class="hd-week2"><div><div class="dsec">The week by line ${G('D')}</div><div class="xscroll">${tbl([['Line', 1], ['Normal week', 0, 'The month less the freeze reserve, over the days of the month, times seven'], ['This week'], ['Change'], ['Multiplier', 0, 'This week against a normal week of the month, on the line\'s own ZIPs'], ['Note', 1]], rows)}</div>
          <p class="hd-reserve"><b>Freeze reserve:</b> ${ec(rs.text || `${pc(rs.share)} of the month, ${usd(rs.month)}. No ledger is kept here: track the reserve against what the account actually spent.`)}${rs.toDate && rs.toDate.text ? ' ' + ec(rs.toDate.text) : ''} ${G(GR.reserve || 'D')}</p>
          ${extra.length ? `<ul class="hooks">${extra.map(x => `<li>${x}</li>`).join('')}</ul>` : ''}</div>
          <div><div class="dsec">Do this on Monday${wk.monday ? ', ' + esc(day(wk.monday)) : ''}</div>${wk.list && wk.list.length ? `<ol class="hd-monday">${wk.list.map(x => `<li>${ec(x.text)}</li>`).join('')}</ol>` : '<p class="hd-empty">Nothing to change. Hold the month plan as it stands.</p>'}</div></div>`;
      CSV.week = () => ['week', ['section', 'label', 'date', 'normal_week_usd', 'this_week_usd', 'change_usd', 'multiplier', 'low_f_at_shop', 'metro_low_min_f', 'metro_low_max_f', 'threshold', 'repair_usd_that_day'],
        wk.lines.map(l => ['line', l.name, '', Math.round(l.normal), Math.round(l.week), Math.round(l.week - l.normal), r6(l.mult), '', '', '', '', '']).concat([['total', 'Total', '', Math.round(wk.T.normal), Math.round(wk.T.week), Math.round(wk.T.week - wk.T.normal), '', '', '', '', '', '']]).concat((wk.days || []).map(d => ['night', d.label || '', d.date || '', '', '', '', '', isN(d.low) ? Math.round(d.low) : '', isN(d.metroMin) ? Math.round(d.metroMin) : '', isN(d.metroMax) ? Math.round(d.metroMax) : '', d.tierName || '', Math.round(d.repair)])),
        `${sim() ? 'SIMULATION, not a forecast. ' : ''}${normal ? why + ': a normal week. ' : ''}Week of ${day(wk.monday || wk.today || today())}. Forecast lows grade A; multipliers and budgets grade D.`];
    }

    /* ---------- map: l label, v value of a ZIP record, f formatter, g grade; cat lists the classes of a layer that is words, not numbers ---------- */
    const wxz = zip => (wk && wk.wx && wk.wx.ok && wk.wx.byZip ? wk.wx.byZip[zip] || null : null);
    const cellOf = (r, id) => (r && r.lines ? r.lines[id] || null : null);
    const HL = {
      share: { l: 'Budget share (% of the plan)', ramp: 'ember', g: GR.spend || 'C', v: r => (r.inPlan ? r.share * 100 : null), f: v => P(v, 1), note: 'Where the dollars are expected to land. Gray ZIPs are not in the plan.' },
      bid: { l: 'Location bid adjustment (%)', div: 1, g: GR.bid || 'D', v: r => (r.inPlan ? r.bid : null), f: sg, note: 'What a click is worth here against the campaign average. Cost decides whether a ZIP is bought; value decides the bid.' },
      tier: { l: 'Drive tier', g: GR.minutes || 'C', cat: HX.TIERS.map(t => [t.id, `${t.id}: ${t.words}`]), v: r => r.tier, note: 'Drive minutes are 5 plus the straight line kilometers from the dispatch point.' },
      conf: { l: 'Confidence that the return clears the cut', g: GR.conf || 'D', cat: HX.LABELS.map(t => [t.id, `${t.id}: ${t.words}`]), v: r => (r.inPlan ? r.label : null), note: 'The chance a funded ZIP still clears the cut once the doubt in its return is counted. Gray ZIPs are not in the plan.' },
      reach: { l: 'Reach, heating repair (1 at the door)', ramp: 'teal', g: GR.reach || 'D', v: r => { const c = cellOf(r, 'heat'); return c && c.R > 0 ? c.R : null; }, f: v => D(v, 2), note: 'The share of a repair lead\'s value left after the drive. Gray is past the reach cut: the line is not sold there.' },
      jobs: { l: 'Heating repair jobs this month an ad can reach', ramp: 'ember', g: GR.jobs || 'D', v: r => { const c = cellOf(r, 'heat'); return c ? c.J : null; }, f: v => N(v), note: 'Module 12 jobs, the month\'s season and the homes where an owner decides.' },
      furn20: { l: 'Gas furnaces past 20 years', ramp: 'ember', g: 'B', v: r => r.z.furn20, f: v => N(v), note: 'Module 02 stock model: the pool behind furnace replacement.' },
      fuel: { l: 'Fuel lead: which message a ZIP gets', g: 'A', cat: [['gas', 'Gas led: 45% or more of homes heat with gas'], ['electric', 'Electric led: 70% or more heat with electricity'], ['mixed', 'Mixed']], v: r => r.fuel, note: 'Census heating fuel. It decides the message and the keyword group, never the budget.' },
      cold: { l: 'Cold exposure (1 = metro mean)', ramp: 'blue', g: GR.exposure || 'C', v: r => r.x, f: v => D(v, 2), note: 'Normal heating degree days of the ZIP over the household weighted metro mean.' },
      wx: { l: 'This week: heating repair multiplier', ramp: 'blue', g: 'A/D', v: r => { const w = wxz(r.zip); return w ? w.W : null; }, f: mult, note: 'Seven forecast nights against the month\'s normal night. Gray everywhere means no usable forecast: the week runs at 1.' },
    };
    $('#h17Layer', root).innerHTML = Object.keys(HL).map(k => `<option value="${k}">${esc(HL[k].l)}</option>`).join('');
    if (!HL[st.layer]) st.layer = 'share';
    const catCols = k => (k === 'fuel' ? [cssv('--heat'), cssv('--cool'), cssv('--s7')] : (r => [r[6], r[4], r[2]])(ramp(k === 'conf' ? 'blue' : 'teal')));
    const map = new ZipMap($('#h17Map', root), { aria: 'Map of Dallas Fort Worth ZIP codes shaded by the selected Heat Desk layer, with the shop marked',
      onSelect: zip => pick(zip === st.sel ? null : zip),
      onHover: (zip, e) => { const z = ZI[zip], r = plan && plan.at[zip], o = HL[st.layer]; if (!z) return; const v = r ? o.v(r) : null;
        showTip(`<div class="tt">${esc(zip)} · ${esc(z.city)}</div><div class="ts">${esc(z.cty)} County${r ? ` · ${N(r.min)} minutes · ${esc(r.tier)}` : ''}</div>${tipRow(esc(o.l), v == null ? 'none' : o.cat ? esc((o.cat.find(c => c[0] === v) || [0, v])[1]) : o.f(v))}${r && r.inPlan ? tipRow('In the plan', `${usd(r.dollars)} · ${pc(r.share, 1)}`) + tipRow('Bid · confidence', `${sg(r.bid)} · ${esc(r.label)}`) : tipRow('In the plan', r ? 'no' : 'not scored')}<div class="tf">Click for the ZIP card</div>`, e); },
      onPinHover: (id, e) => showTip(`<div class="tt">The shop</div><div class="ts">${ec(plan.origin.label)}</div><div class="tf">Every drive time on this page starts here</div>`, e) });
    /* the shared map prints a minus sign on its zoom out button; draw both zoom marks instead so no dash sits on the page */
    $$('.maptools button', root).forEach(b => { if (b.dataset.z === 'in' || b.dataset.z === 'out') b.innerHTML = `<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M1 6h10${b.dataset.z === 'in' ? 'M6 1v10' : ''}" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`; });
    function drawMap() {
      const o = HL[st.layer], vals = plan.all.map(o.v), have = vals.filter(v => v != null && (o.cat || isN(v)));
      if (o.cat) { const cols = catCols(st.layer), ix = v => o.cat.findIndex(c => c[0] === v); map.fill(zip => { const r = plan.at[zip], i = r ? ix(o.v(r)) : -1; return i >= 0 ? cols[i] : null; });
        $('#h17Leg', root).innerHTML = `<div><div class="lt">${esc(o.l)}</div><div class="catleg">${o.cat.map((c, i) => `<span><i style="background:${cols[i]}"></i>${esc(c[1])} (${N(have.filter(v => v === c[0]).length)})</span>`).join('')}</div></div><div class="dn">${G(o.g)} ${esc(o.note)}</div>`; }
      else { const sc = o.div ? divScale(have, 0) : qScale(have, o.ramp, 1); map.fill(zip => { const r = plan.at[zip]; return r ? sc.f(o.v(r)) : null; });
        $('#h17Leg', root).innerHTML = have.length ? legendHTML({ title: esc(o.l), R: sc.R, lo: o.f(o.div ? sc.lo : Math.min(...have)), hi: o.f(o.div ? sc.hi : Math.max(...have)), note: `${G(o.g)} ${esc(o.note)} ${o.div ? 'Blue is under the campaign average, red over.' : `Higher values shade ${isDark() ? 'lighter' : 'darker'}.`} ${N(have.length)} ZIPs carry a value.` }) : `<div class="dn">${G(o.g)} ${esc(o.note)} No ZIP carries a value for this layer right now.</div>`; }
      map.select(st.sel && ZI[st.sel] ? st.sel : null);
      map.pins([{ id: 'shop', lat: plan.origin.lat, lon: plan.origin.lon, r: 7, fill: cssv('--bench'), shape: 'diamond', op: 1 }]);
    }

    /* ---------- ZIP card ---------- */
    const STATE = { small: 'under the minimum leads', under: 'return under the cut', out: 'past the reach cut' };
    function zipCard() {
      const name = $('#h17ZName', root), sub = $('#h17ZSub', root), body = $('#h17Zip', root);
      if (st.miss) { name.textContent = `ZIP ${st.miss}`; sub.textContent = 'Not in this atlas'; body.innerHTML = `<p class="hd-miss"><b>${esc(st.miss)}</b> is not one of the ${N(Z.length)} ZIP codes on this map. Check the number, or pick a ZIP on the map or in the ranked table. The plan itself is unchanged.</p>`; return; }
      const z = st.sel ? ZI[st.sel] : null, r = z ? plan.at[z.zip] : null;
      if (!z) { name.textContent = 'ZIP card'; sub.textContent = 'Click a ZIP on the map or a row in the table'; body.innerHTML = `<p class="mini">Every ZIP carries its four lines (jobs this month, reach, cost, return against the cut, dollars, bid), its furnaces and heat pumps, its fuel split, its cold exposure, this week's lows and the message it should get.</p>`; return; }
      name.textContent = `${z.zip} · ${z.city}`;
      if (!r) { sub.textContent = `${z.cty} County`; body.innerHTML = `<p class="hd-miss"><b>${esc(z.zip)} ${esc(z.city)}</b> is on the map, but too few households live there for the plan to score it. Nothing is spent there.</p>`; return; }
      sub.textContent = `${r.county} County · ${N(r.households)} households · ${N(r.min)} minutes from the shop · ${r.tier}${r.home ? ', home turf' : ''}`;
      const held = !r.inPlan ? (HX.held(plan).find(h => h.zip === r.zip) || plan.bench.find(b => b.zip === r.zip) || null) : null, bn = plan.bench.find(b => b.zip === r.zip);
      const status = r.blocked ? '<span class="hd-chip warn">Blocked by you</span> Nothing is spent here and it goes into the exclusions file.'
        : r.inPlan ? `<span class="hd-chip ok">In the plan</span> Rank ${N(r.rank)} of ${N(plan.T.zips)} · ${pc(r.share, 1)} of the money · <b>${usd(r.dollars)}</b> a month · bid ${sg(r.bid)} · ${esc(r.label)} (${pc(r.conf)}) ${G('C/D')}`
        : `<span class="hd-chip">Not in the plan</span> ${held ? ec(held.reason) + '.' : 'No line clears the cut here at this budget.'}${bn && isN(bn.enterAt) ? ` It enters at about ${usd(bn.enterAt)} a month.` : ''}`;
      const rows = IDS.map(id => { const c = cellOf(r, id), L = plan.line[id]; if (!c) return tr([[esc(SHORT[id]), 'l'], NA, NA, NA, NA, NA]);
        return tr([[esc(SHORT[id]), 'l'], n1(c.J), c.R > 0 ? D(c.R, 2) : 'out', c.R > 0 ? two(`$${D(c.rho, 2)}`, isN(L.lambdaRaw) && L.dollars > 0 ? `cut $${D(L.lambdaRaw, 2)}` : '') : NA, c.spend > 0 ? `<b>${usd(c.spend)}</b>` : [`<span class="mini">${esc(c.capped ? 'cut by the ZIP cap' : STATE[c.state] || 'not funded')}</span>`, 'wrap'], c.spend > 0 ? two(sg(c.bid), pc(c.conf)) : NA]); });
      const w = wxz(r.zip), wr = wk && wk.plan && wk.plan.at ? wk.plan.at[r.zip] : null, zn = LV.zipNormal(r.zip), pz = LV.permits && LV.permits.zip[r.zip] ? LV.permits.zip[r.zip] : null, lev = (SLM.LEV || {})[r.zip] || {}, hdd = plan.exposure && HX.exposure ? (HX.exposure().hdd || {})[r.zip] : null;
      const tags = [r.fuel === 'gas' ? 'Gas led: furnace, igniter and carbon monoxide copy' : r.fuel === 'electric' ? 'Electric led: heat pump, auxiliary heat and electric bill copy' : 'Mixed fuel: run both message sets', lev.es >= 15 ? `Spanish build, suggested share ${N(lev.es)}%` : '', lev.fin >= 60 ? 'Payment led: monthly payment creative belongs in the financing radius campaign' : ''].filter(Boolean);
      body.innerHTML = `<p class="hd-why">${status}</p>${r.inPlan && r.why ? `<p class="hd-why">${ec(r.why)}.</p>` : ''}
        <div class="dsec">The four lines this month ${G('D')}</div><div class="xscroll">${tbl([['Line', 1], ['Jobs', 0, 'Jobs this month a homeowner ad can reach'], ['Reach', 0, '1 at the door, 0.5 at the half value drive'], ['Return', 0, 'Gross profit the first ad dollar brings back here, pipeline included; under it the cut, what the line\'s last dollar brings back'], ['$ a month'], ['Bid', 0, 'The line\'s own bid adjustment here; under it, the chance the return clears the cut']], rows, 'keep')}</div>
        ${w ? `<div class="dsec">${sim() ? 'Simulated lows' : 'Forecast lows'} at this ZIP ${G(sim() ? 'D' : 'A')}</div><div class="hd-lows">${w.lows.map((t, i) => `<div>${esc(((wk.days || [])[i] || {}).dow || dshort((wk.wx.dates || [])[i] || '').split(' ')[0])}<b>${isN(t) ? Math.round(t) + '°' : NA}</b></div>`).join('')}</div><div class="rowl" style="margin-top:6px"><span>Repair multiplier this week${w.first ? ' · first freeze' : ''}${w.alert ? ' · ' + ec(w.alert === true ? 'alert' : w.alert) : ''}${w.storm ? ' · storm reach' : ''}</span><b>${mult(w.W)}</b></div>${wr ? `<div class="rowl"><span>This week's dollars here</span><b>${usd(wr.dollars)}</b></div>` : ''}` : ''}
        <div class="dsec">What is in the homes</div>
        <div class="rowl"><span>Gas furnaces · past 20 years ${G('B')}</span><b>${N(z.furn)} · ${N(z.furn20)}</b></div><div class="rowl"><span>Heat pumps · electric furnaces ${G('B')}</span><b>${N(z.sys_hp)} · ${N(z.sys_ef)}</b></div>
        <div class="rowl"><span>Heating fuel: gas · electricity ${G('A')}</span><b>${P(z.gas_sh, 0)} · ${P(z.elec_sh, 0)}</b></div><div class="rowl"><span>Systems where a homeowner decides ${G('C')}</span><b>${pc(r.who)}</b></div>
        <div class="rowl"><span>Cold exposure${isN(hdd) ? ` · normal heating degree days` : ''} ${G(GR.exposure || 'C')}</span><b>${D(r.x, 2)}${isN(hdd) ? ' · ' + N(hdd) : ''}</b></div>${zn && isN(zn.fr32) ? `<div class="rowl"><span>Freeze nights in a normal year ${G('C')}</span><b>${D(zn.fr32, 0)}</b></div>` : ''}
        <div class="rowl"><span>Cost index · competitor pressure percentile ${G('D')}</span><b>${D(r.cost, 2)} · ${N(r.pressure)}</b></div>${pz ? `<div class="rowl"><span>Mechanical permits here, last 12 full months${pz.city ? ' · ' + esc(pz.city) : ''} ${G('B')}</span><b>${N(pz.n)}</b></div>` : ''}
        <div class="dsec">Message</div><div>${tags.map(t => `<span class="tag on">${esc(t)}</span>`).join('')}</div>
        <div class="rowl" style="margin-top:6px"><span>Google location criterion ID</span><b>${z.gid ? esc(z.gid) : 'by name'}</b></div>
        <div class="hd-acts"><button type="button" class="btn sm" data-act="${r.pinned ? 'unpin' : 'pin'}" data-zip="${esc(r.zip)}" aria-pressed="${!!r.pinned}">${r.pinned ? 'Unpin' : 'Pin'} ${esc(r.zip)}</button><button type="button" class="btn sec sm" data-act="${r.blocked ? 'unblock' : 'block'}" data-zip="${esc(r.zip)}" aria-pressed="${!!r.blocked}">${r.blocked ? 'Unblock' : 'Block'} ${esc(r.zip)}</button><button type="button" class="btn sec sm" data-act="zdesk" data-zip="${esc(r.zip)}">Campaign Desk ↗</button><button type="button" class="btn sec sm" data-act="zlines" data-zip="${esc(r.zip)}">Service Lines ↗</button></div>`;
    }
    function pick(zip, scroll) {
      zip = zip == null ? '' : String(zip).trim();
      if (!zip) { st.sel = null; st.miss = ''; }
      else if (!ZI[zip]) { st.sel = null; st.miss = zip.slice(0, 12); toast(`${st.miss} is not a ZIP code in this atlas`); }
      else { st.sel = zip; st.miss = ''; if (scroll) map.fitTo([zip]); }
      map.select(st.sel); zipCard(); table();
      if (scroll) setTimeout(() => { const c = $('#h17ZipCard', root); c.scrollIntoView({ block: 'start' }); c.focus({ preventScroll: true }); }, 0);
    }

    /* ---------- ranked ZIPs, with the bench on request ---------- */
    const tierLab = t => `<span class="hd-lab ${String(t).toLowerCase()}">${esc(t)}</span>`;
    const lineCell = c => (c && c.spend > 0 ? `${usd(c.spend)}<small>${sg(c.bid)}</small>` : '');
    function table() {
      const rows = plan.zips.map(r => ({ zip: r.zip, city: r.city, county: r.county, min: r.min, tier: r.tier, share: r.share * 100, dollars: r.dollars, bid: r.bid, conf: r.conf * 100, label: r.label, c: r.lines || {}, leads: r.leads, fuel: r.fuel, why: r.why, rank: r.rank, bench: false }))
        .concat(st.bench ? plan.bench.map(b => ({ zip: b.zip, city: b.city, county: b.county, min: b.min, tier: HX.tier(b.min), share: null, dollars: null, bid: null, conf: null, label: 'Bench', c: {}, leads: null, fuel: plan.at[b.zip] ? plan.at[b.zip].fuel : '', why: `Not in the plan at ${usd(plan.T.budget)}: ${b.reason}. ${isN(b.enterAt) ? `Enters at about ${usd(b.enterAt)} a month` : 'Enters at a larger budget'}${b.via && b.via.length ? ' through ' + list(b.via.map(id => WORD[id] || id)) : ''}`, rank: null, bench: true, enterAt: b.enterAt })) : []);
      dataTable($('#h17Tbl', root), [
        { k: 'rank', h: '#', f: v => (isN(v) ? N(v) : '') }, { k: 'zip', h: 'ZIP', l: 1, f: v => `<b>${esc(v)}</b>` }, { k: 'city', h: 'City', l: 1, f: v => esc(v) }, { k: 'county', h: 'County', l: 1, f: v => esc(v) },
        { k: 'min', h: 'Min', t: 'Drive minutes: 5 plus straight line kilometers (grade C)', f: v => N(v) }, { k: 'tier', h: 'Tier', l: 1, t: 'Drive tier: Core 20 minutes or less, Ring 20 to 35, Far over 35', f: (v, r) => (r.bench ? '<span class="hd-lab bench">Bench</span> ' : '') + tierLab(v) },
        { k: 'share', h: 'Share', t: 'Share of the plan\'s dollars (grade C)', f: v => (isN(v) ? `<span class="hd-sharebar"><i style="width:${clamp(v / Math.max(0.01, plan.zips[0] ? plan.zips[0].share * 100 : 1) * 100, 2, 100).toFixed(0)}%"></i></span>${shr(v / 100)}` : '') },
        { k: 'dollars', h: '$ a month', f: (v, r) => (isN(v) ? usd(v) : isN(r.enterAt) ? `<span class="mini">at ${usd(r.enterAt)}</span>` : '') }, { k: 'bid', h: 'Bid', t: 'Blended location bid adjustment: value of a click here against the campaign average (grade D)', f: v => (isN(v) ? sg(v) : '') },
        { k: 'conf', h: 'Confidence', l: 1, t: 'Chance the return clears the cut, given the stated doubt: Firm 80% or more, Likely 50 to 80%, Test under 50% (grade D)', f: (v, r) => (isN(v) ? `<span class="hd-lab ${String(r.label).toLowerCase()}">${esc(r.label)}</span> ${P(v, 0)}` : '') },
      ].concat(IDS.map(id => ({ k: 'c_' + id, h: esc(SHORT[id]), t: `${NAMES[id]}: dollars a month and the line's own bid adjustment`, cls: 'hd-cell', v: r => (r.c[id] && r.c[id].spend > 0 ? r.c[id].spend : null), f: (v, r) => lineCell(r.c[id]) }))).concat([
        { k: 'leads', h: 'Leads', t: 'Expected leads a month (grade D)', f: v => (isN(v) ? D(v, 1) : '') }, { k: 'fuel', h: 'Fuel', l: 1, f: v => esc(v) }, { k: 'why', h: 'Why', l: 1, cls: 'hd-whyc', f: v => ec(v) },
      ]), rows, { sortKey: 'dollars', id: r => r.zip, onClick: zip => pick(zip === st.sel ? null : zip), rowClass: r => (r.zip === st.sel ? 'sel ' : '') + (r.bench ? 'hd-benchrow' : '') });
      const cr = plan.tiers.map(t => `${t.tier} (${t.words}) ${pc(t.share)} in ${plural(t.zips, 'ZIP')}`).join(' · ');
      $('#h17TblN', root).innerHTML = `<b>${plural(plan.T.zips, 'ZIP')} in the plan</b>${st.bench ? `, then ${plural(plan.bench.length, 'ZIP')} on the bench with the budget at which each enters` : ''}. ${cr}. Minutes ${G(GR.minutes || 'C')} share and dollars ${G(GR.spend || 'C')} bids, confidence and leads ${G('D')}. Each line cell shows dollars a month, then that line's own bid adjustment.`;
      CSV.zips = () => ['ranked-zips', ['rank', 'zip', 'city', 'county', 'drive_minutes', 'drive_tier', 'share_pct', 'monthly_usd', 'bid_adjustment_pct', 'confidence_pct', 'confidence_label'].concat(IDS.flatMap(id => [id + '_usd', id + '_bid_pct'])).concat(['leads', 'fuel_lead', 'enters_at_monthly_usd', 'why']),
        rows.map(r => [r.rank == null ? '' : r.rank, r.zip, r.city, r.county, Math.round(r.min), r.tier, r.bench ? 0 : r6(r.share.toFixed(3)), r.bench ? 0 : Math.round(r.dollars), r.bid == null ? '' : r.bid, r.conf == null ? '' : Math.round(r.conf), r.label].concat(IDS.flatMap(id => (r.c[id] && r.c[id].spend > 0 ? [Math.round(r.c[id].spend), r.c[id].bid] : ['', '']))).concat([r.leads == null ? '' : r6(r.leads.toFixed(2)), r.fuel, r.bench && isN(r.enterAt) ? Math.round(r.enterAt) : '', clean(r.why)])),
        `Heat Desk plan for ${plan.monthName} at ${usd(plan.T.budget)} a month. Minutes grade C; share and dollars grade C; bids, confidence and leads grade D. ZIP dollars are where spend is expected to land, not a platform setting.`];
    }

    /* ---------- close to the shop and not in the plan ---------- */
    function held() {
      const hs = HX.held(plan);
      $('#h17Held', root).innerHTML = hs.length ? `<div class="tscroll short">${tbl([['ZIP', 1], ['City', 1], ['Min'], ['Households'], ['Pressure', 0, 'Competitor paid pressure percentile for heating repair (grade C)'], ['Cost', 0, 'Cost index: 1 is the metro (grade D)'], ['Owner share', 0, 'Systems where a homeowner decides (grade C)'], ['Why it is held back', 1], ['Enters at', 0, 'Monthly budget at which the plan would buy it'], ['', 1]],
        hs.map(h => tr([[`<b>${esc(h.zip)}</b>`, 'l'], [esc(h.city), 'l'], N(h.min), N(h.households), n0(h.pressure), isN(h.cost) ? D(h.cost, 2) : NA, pc(h.who), [ec(h.reason), 'l hd-whyc'], isN(h.enterAt) ? usd(h.enterAt) : h.code === 'blocked' ? '' : '<span class="mini" title="Its best line returns less than the hurdle at any budget">under the hurdle</span>', [h.code === 'blocked' ? `<button type="button" class="btn sec sm" data-act="unblock" data-zip="${esc(h.zip)}" aria-label="Unblock ${esc(h.zip)} ${esc(h.city)}">Unblock</button>` : `<button type="button" class="btn sec sm" data-act="pin" data-zip="${esc(h.zip)}" aria-label="Pin ${esc(h.zip)} ${esc(h.city)}">Pin</button>`, 'l']], h.zip === st.sel ? 'sel' : '')))}</div>` : '<p class="hd-empty">Every ZIP within 25 minutes of the shop is in the plan.</p>';
      CSV.held = () => ['held-back', ['zip', 'city', 'county', 'drive_minutes', 'households', 'pressure_percentile', 'cost_index', 'homeowner_share_pct', 'code', 'why_held', 'enters_at_monthly_usd'], hs.map(h => [h.zip, h.city, h.county, Math.round(h.min), Math.round(h.households), isN(h.pressure) ? Math.round(h.pressure) : '', isN(h.cost) ? r6(h.cost.toFixed(3)) : '', isN(h.who) ? Math.round(h.who * 100) : '', h.code, clean(h.reason), isN(h.enterAt) ? Math.round(h.enterAt) : '']), `ZIPs within 25 minutes of the shop that the plan holds back at ${usd(plan.T.budget)} a month in ${plan.monthName}. Reasons are the engine's own words.`];
    }
    /* ---------- by line and what to build ---------- */
    const rbar = (r, v) => { if (!r || !(r[2] > r[0])) return ''; const lo = r[0] * 0.8, hi = r[2] * 1.15, x = q => clamp((q - lo) / (hi - lo) * 100, 0, 100); return `<span class="hd-rng" aria-hidden="true"><i style="left:${x(r[0]).toFixed(1)}%;width:${(x(r[2]) - x(r[0])).toFixed(1)}%"></i><b style="left:calc(${x(isN(v) ? v : r[1]).toFixed(1)}% - 1px)"></b></span>`; };
    const platWords = pl => HX.PLATS.filter(p => pl && pl[p] > 0.004).map(p => `${HX.PLAT_NAMES[p]} ${pc(pl[p])}`).join(', ');
    const two = (v, r) => [`${v}${r && r !== NA ? `<small>${r}</small>` : ''}`, 'hd-two'];              // a figure with its 10th to 90th percentile under it
    function lines() {
      const T = plan.T, cust = T.mode === 'custom', RT = 'under it, the 10th to 90th percentile of 120 replays of this plan (grade D)';
      const head = [['Line', 1], ['Share'], ['$ a month'], ['ZIPs'], ['Leads', 0, 'Expected leads a month; ' + RT], ['Cost per lead'], ['Booked jobs', 0, 'Expected booked jobs a month; ' + RT], ['Gross profit, direct', 0, 'The first ticket alone; ' + RT], ['With pipeline', 0, 'Direct plus the replacement work module 12 credits to repair and tune up visits; ' + RT], ['Farthest', 0, 'Minutes to the farthest funded ZIP'], ['Largest ZIP', 0, 'The largest ZIP as a share of the line'], ['Platforms', 1, 'Where the line\'s money runs after minimums fold it']];
      const row = (l, cls) => tr([[`<b>${esc(l.name)}</b>${cust && isN(l.target) ? `<small>asked ${pc(l.target)}</small>` : ''}`, 'l hd-two'], shr(l.share), usd(l.dollars), n0(l.zips), two(n1(l.leads), rng(l.rl, n1)), l.leads > 0 ? usd(l.cpl) : NA, two(n1(l.jobs), rng(l.rj, n1)), two(usd(l.gpDirect), rng(l.rd, usd)), two(usd(l.gp), rng(l.rg, usd)), l.farthest == null || !(l.dollars > 0) ? '' : n0(l.farthest) + ' min', l.topShare == null || !(l.dollars > 0) ? '' : pc(l.topShare), [l.pw || '', 'l wrap hd-pw']], cls);
      const rows = plan.lines.map(l => row(Object.assign({}, l, { rl: lband(l.id, 'leads'), rj: lband(l.id, 'jobs'), rd: lband(l.id, 'gpDirect'), rg: lband(l.id, 'gp'), pw: esc(platWords(l.plat)) })));
      rows.push(row({ name: 'Total', share: T.spent > 0 ? 1 : 0, dollars: T.spent, zips: T.zips, leads: T.leads, rl: band('leads'), cpl: T.cpl, jobs: T.jobs, rj: band('jobs'), gpDirect: T.gpDirect, rd: band('gpDirect'), gp: T.gp, rg: band('gp'), farthest: T.farthest, topShare: plan.zips[0] ? plan.zips[0].share : null, pw: '' }, 'hd-total'));
      const notes = (plan.notes || []).filter(n => n && n.kind !== 'platform').map(n => ec(n.text));
      $('#h17LinesT', root).innerHTML = `<div class="xscroll">${tbl(head, rows)}</div><p class="hd-note">Under each outcome is its range: the 10th to 90th percentile of 120 replays of this plan. Every dollar outcome is grade D: module 12's stated lead costs, close rates, tickets and margins. ${G('D')} A repair ad pays back little in repair gross profit alone; most of its value is the replacement it may become, which is why the two gross profit columns are kept apart. ${cust ? 'Custom mix: each line is filled on its own.' : `The last dollar of each line returns ${list(plan.lines.filter(l => l.dollars > 0 && isN(l.lambdaRaw)).map(l => `$${D(l.lambdaRaw, 2)} (${WORD[l.id]})`))} of modeled gross profit, pipeline included; the fill believes ${D(PP.gamma, 2)} of the gap between lines.`}</p>${notes.length ? `<ul class="hooks">${notes.map(n => `<li>${n}</li>`).join('')}</ul>` : ''}`;
      CSV.lines = () => ['by-line', ['line', 'share_pct', 'monthly_usd', 'zips', 'leads', 'leads_p10', 'leads_p90', 'cost_per_lead_usd', 'booked_jobs', 'jobs_p10', 'jobs_p90', 'gross_profit_direct_usd', 'gp_direct_p10', 'gp_direct_p90', 'gross_profit_with_pipeline_usd', 'gp_pipeline_p10', 'gp_pipeline_p90', 'farthest_minutes', 'largest_zip_share_pct', 'platforms'],
        plan.lines.map(l => { const b = k => lband(l.id, k) || ['', '', '']; const q = v => (isN(v) && v !== '' ? r6((+v).toFixed(2)) : ''); return [l.name, q(l.share * 100), Math.round(l.dollars), l.zips, q(l.leads), q(b('leads')[0]), q(b('leads')[2]), l.leads > 0 ? q(l.cpl) : '', q(l.jobs), q(b('jobs')[0]), q(b('jobs')[2]), Math.round(l.gpDirect), q(b('gpDirect')[0]), q(b('gpDirect')[2]), Math.round(l.gp), q(b('gp')[0]), q(b('gp')[2]), isN(l.farthest) && l.dollars > 0 ? Math.round(l.farthest) : '', l.dollars > 0 ? q(l.topShare * 100) : '', platWords(l.plat)]; }),
        `Heat Desk by line, ${plan.monthName}, ${usd(T.budget)} a month. Leads, jobs and gross profit grade D with the 10th and 90th percentile of 120 replays. Direct is the first ticket; with pipeline adds module 12's replacement credit.`];
      /* campaigns */
      const cs = plan.campaigns || [], smart = PP.bidding === 'smart';
      $('#h17Camps', root).innerHTML = cs.length ? `<div class="xscroll">${tbl([['Campaign', 1], ['Lines', 1], ['Tier', 1, 'Drive tier the campaign covers'], ['Platform', 1], ['ZIPs'], ['$ a month'], ['Daily', 0, 'The daily budget the campaigns file carries: the month less the freeze reserve, spread over the days the campaign runs'], ['Bid strategy', 1], ['First target', 0, 'First target cost per lead: what the plan expects a lead to cost here (grade D)'], ['Bid cap', 0, 'Max CPC cap (grade D)'], ['Location bids', 0, 'The range of location bid adjustments inside the campaign'], ['Leads'], ['Note', 1]],
        cs.map(c => tr([[`<span class="mono">${esc(c.name)}</span>`, 'l'], [esc((c.lines || []).map(id => SHORT[id] || id).join(', ')), 'l'], [c.tier ? tierLab(c.tier) : 'all', 'l'], [esc(HX.PLAT_NAMES[c.platform] || c.platform || ''), 'l'], n0(c.zips), usd(c.budget), isN(c.daily) ? usd(c.daily) : '', [ec(c.strategy || ''), 'l'], isN(c.targetCpa) ? usd(c.targetCpa) : '', isN(c.maxCpc) ? '$' + D(c.maxCpc, 2) : '', isN(c.bidMin) && isN(c.bidMax) && !smart ? `${sg(c.bidMin)} to ${sg(c.bidMax)}` : 'none', isN(c.leads) ? n1(c.leads) : '', [ec(c.note || ''), 'l wrap hd-pw']])))}</div><p class="hd-note">${smart ? 'Smart Bidding mode: one campaign per drive tier, because budget and target are the only geographic levers Smart Bidding leaves. Switch a campaign over once it has 30 conversions in 30 days.' : 'Manual mode: one campaign per line with location bid adjustments by ZIP. Maximize conversions, target cost per lead and target return bidding ignore those adjustments.'} Every campaign is exported paused. ${G('D')}</p>` : '<p class="hd-empty">No campaign clears its minimum at this budget.</p>';
      CSV.camps = () => ['campaigns', ['campaign', 'lines', 'drive_tier', 'platform', 'zips', 'monthly_usd', 'daily_usd', 'bid_strategy', 'first_target_cost_per_lead_usd', 'max_cpc_usd', 'bid_min_pct', 'bid_max_pct', 'leads', 'status', 'note'], cs.map(c => [c.name, (c.lines || []).join(' '), c.tier || '', c.platform || '', c.zips, Math.round(c.budget), isN(c.daily) ? r6((+c.daily).toFixed(2)) : '', clean(c.strategy || ''), isN(c.targetCpa) ? Math.round(c.targetCpa) : '', isN(c.maxCpc) ? r6((+c.maxCpc).toFixed(2)) : '', isN(c.bidMin) ? c.bidMin : '', isN(c.bidMax) ? c.bidMax : '', isN(c.leads) ? r6((+c.leads).toFixed(1)) : '', c.status || 'Paused', clean(c.note || '')]), `Heat Desk campaigns for ${plan.monthName}, ${smart ? 'Smart Bidding' : 'manual bidding'} mode. Every campaign is paused. Budgets and targets grade D.`];
      /* platforms */
      const ps = plan.platforms || [];
      const fold = p => { const fs = (p.folded || []).filter(f => f && f.dollars > 0.5); if (!fs.length) return ''; const to = [...new Set(fs.map(f => HX.PLAT_NAMES[f.to] || f.to))]; return `${list(fs.map(f => `${esc(SHORT[f.line] || f.line)} ${usd(f.dollars)}`))} ${fs.length === 1 ? 'runs' : 'run'} on ${esc(list(to))} instead${isN(p.min) && p.min > 0 ? `: each is under the ${usd(p.min)} minimum` : ''}`; };
      $('#h17Plats', root).innerHTML = `<div class="xscroll">${tbl([['Platform', 1], ['$ a month'], ['Share'], ['By line', 1], ['Minimum', 0, 'A line\'s share of a platform under this many dollars a month folds into Google Search'], ['Folded', 1], ['How it is targeted', 1]],
        ps.map(p => tr([[`<b>${esc(p.name)}</b>`, 'l'], usd(p.dollars), shr(p.share), [esc(IDS.filter(id => p.lines && p.lines[id] > 0.5).map(id => `${SHORT[id]} ${usd(p.lines[id])}`).join(', ') || 'nothing this month'), 'l wrap hd-pw'], isN(p.min) && p.min > 0 ? usd(p.min) : 'none', [fold(p), 'l wrap hd-pw'], [ec(p.how || ''), 'l wrap hd-pw']], p.dollars > 0 ? '' : 'hd-benchrow')))}</div><p class="hd-note">Minimums are fold notes: they move a line's money between platforms and never change the ZIP money.${num(T.leadsOver) && T.leadsOver >= 0.5 ? ` The lead counts on this page keep each line's planned platform mix; a lead is modeled dearer on Google Search, so with these folds count about ${T.leadsOver >= 10 ? N(T.leadsOver) : D(T.leadsOver, 1)} fewer leads a month.` : ''} ${G('D')}</p>`;
      CSV.plats = () => ['platforms', ['platform', 'monthly_usd', 'share_pct', 'minimum_usd'].concat(IDS.map(id => id + '_usd')).concat(['folded', 'how_targeted']), ps.map(p => [p.name, Math.round(p.dollars), r6((p.share * 100).toFixed(2)), isN(p.min) ? p.min : ''].concat(IDS.map(id => Math.round((p.lines || {})[id] || 0))).concat([(p.folded || []).map(f => `${f.line} ${Math.round(f.dollars)} to ${f.to}`).join('; '), clean(p.how || '')])), `Heat Desk platforms for ${plan.monthName}. Minimums are fold notes: they move a line's money between platforms and never change the ZIP money.`];
      /* Local Services: off until the badge is verified; say what switching it on is worth */
      const k = pkey(); if (st.lsaKey !== k) { st.lsaKey = k; st.lsaAdd = null; try { const q = HX.plan(HX.set(PP, 'lsaLive', !PP.lsaLive), { lite: true }); st.lsaAdd = { leads: q.T.leads, heat: q.line.heat.leads, cpl: q.line.heat.cpl }; } catch (e) { st.lsaAdd = null; } }
      const a = st.lsaAdd, h = plan.line.heat, lsa = ps.find(p => p.id === 'lsa');
      $('#h17Lsa', root).innerHTML = callout('note tight', PP.lsaLive ? 'Local Services Ads are in the plan' : 'Local Services Ads are off', PP.lsaLive
        ? `${lsa ? `${usd(lsa.dollars)} a month runs there. ` : ''}One profile, one service area, a weekly budget and a price per lead: no bid adjustment and no ZIP by line. The sheet in the files below lists the ZIPs, the job types and the verification steps.${a && h.leads > 0 ? ` Without it the same money buys ${n1(a.heat)} repair leads a month at ${usd(a.cpl)} instead of ${n1(h.leads)} at ${usd(h.cpl)}.` : ''} ${G('D')}`
        : `The ${ROSTER} roster shows no Local Services badge for the client, so the plan spends nothing there and folds that share into Google Search.${a && h.leads > 0 ? ` Switched on, the same money would buy about ${n1(a.heat)} repair leads a month at ${usd(a.cpl)} instead of ${n1(h.leads)} at ${usd(h.cpl)}, and ${n0(a.leads)} leads in all against ${n0(T.leads)}.` : ''} Verify the profile, then tick the box in the plan. ${G('D')}`);
    }

    /* ---------- files: the engine writes the text, the page only saves it ---------- */
    const FILE = { googleLocations: 'Google locations', googleCampaigns: 'Google campaigns', week: 'Week change sheet', lsa: 'Local Services sheet', meta: 'Meta ZIPs by line and fuel', microsoft: 'Microsoft locations', nextdoor: 'Nextdoor ZIPs', exclusions: 'Exclusions', zipList: 'Plain ZIP list', planByZip: 'Plan by ZIP, every factor', valueRules: 'Conversion value rules by location', assumptions: 'Assumptions', readme: 'Read me' };
    const fileLabel = k => FILE[k] || k.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase());
    function filesCard() {
      let x; try { x = files(); } catch (e) { console.error('heat desk exports', e); $('#h17Files', root).innerHTML = `<p class="hd-empty">The files could not be written: ${esc(e.message)}.</p>`; return; }
      const keys = Object.keys(x), main = keys.filter(k => x[k] && x[k].main !== false && (x[k].main || !/_/.test(k)) && k !== 'readme');
      $('#h17Files', root).innerHTML = `<button type="button" class="hd-file pack" data-x="pack"><b>↓ Monday pack</b><span>All ${N(keys.length)} files in one zip, with a read me that says what each is and the order to load them.</span></button>`
        + main.map(k => `<button type="button" class="hd-file" data-x="${esc(k)}" title="${esc(x[k].name)}"><b>↓ ${esc(fileLabel(k))}</b><span>${ec(x[k].note || '')}</span></button>`).join('');
    }
    function saveX(k) {
      let x; try { x = files(); } catch (e) { console.error('heat desk exports', e); toast('The files could not be written'); return; }
      if (k === 'pack') { const p = HX.pack(x); saveFile(p.name, zipBlob(p.files)); return; }
      if (x[k] && typeof x[k].text === 'string') saveFile(x[k].name, x[k].text); else toast('That file is not in this plan');
    }
    function saveCsv(k) { if (!CSV[k]) return; const [name, header, rows, note] = CSV[k](); saveFile(`heat-desk_${name}_${today()}.csv`, toCSV(header, rows, `DFW Thermal Debt Atlas, module 17 Heat Desk. ${note}`)); }

    /* ---------- counties: why a county gets what it gets ---------- */
    function counties() {
      const fz = LV.freezeNights, lic = LV.licenses, perm = LV.permits, cs = plan.counties || [], per10k = c => (lic && num(lic.by[c.county]) && c.households > 0 ? lic.by[c.county] / c.households * 1e4 : null);
      const head = [['County', 1], ['Share'], ['$ a month'], ['ZIPs in the plan'], ['Leads'], ['ZIPs within 60 min', 0, 'ZIPs a truck reaches within 60 minutes, of all the county\'s ZIPs'], ['Median drive', 0, 'Median drive minutes of the county\'s ZIPs (grade C)'], ['Households'], ['Cold exposure', 0, '1 is the metro mean (grade C)']].concat(fz ? [['Freeze nights a year', 0, 'Normal nights at 32°F or lower, 1991 to 2020 grid (grade C)']] : []).concat([['Gas heat', 0, 'Homes heated with gas (grade A)']]).concat(lic ? [['Licensed contractors per 10,000 households', 0, `Active air conditioning contractor licenses in the state license file${lic.asOf ? ' of ' + day(lic.asOf) : ''}, over the households of the county's scored ZIPs (grade A)`]] : []).concat(perm ? [['Mechanical permits, 12 months', 0, `Heating and air conditioning permits of the last 12 full months in the cities that publish them: ${list(perm.cities)} (grade B)`]] : []);
      $('#h17Cty', root).innerHTML = `<div class="xscroll">${tbl(head, cs.map(c => tr([[`<b>${esc(c.county)}</b>`, 'l'], shr(c.share), usd(c.dollars), n0(c.zips), n1(c.leads), `${n0(c.zipsReach)} of ${n0(c.zipsAll)}`, isN(c.medianMin) ? N(c.medianMin) + ' min' : NA, n0(c.households), isN(c.exposure) ? D(c.exposure, 2) : NA].concat(fz ? [isN(fz[c.county]) ? D(fz[c.county], 0) : NA] : []).concat([isN(c.gasPct) ? P(c.gasPct, 0) : NA]).concat(lic ? [per10k(c) == null ? NA : D(per10k(c), 1)] : []).concat(perm ? [num(perm.by[c.county]) ? N(perm.by[c.county]) : 'none published'] : []), c.dollars > 0 ? '' : 'hd-benchrow')))}</div>`;
      const zero = cs.filter(c => !(c.dollars > 0)).sort((a, b) => b.households - a.households)[0], near = zero ? plan.all.filter(r => r.county === zero.county).reduce((a, b) => (!a || b.min < a.min ? b : a), null) : null;
      $('#h17CtyN', root).innerHTML = (zero && near ? `<b>Why nothing in ${esc(zero.county)} County</b> (${N(zero.households)} households): its closest ZIP, ${esc(near.city)} ${esc(near.zip)}, is ${N(near.min)} minutes from the shop and the median is ${n0(zero.medianMin)}; ${n0(zero.zipsReach)} of its ${n0(zero.zipsAll)} ZIPs are within 60 minutes. At this budget what is close is not used up, so the money does not travel. ` : 'Every county in reach has a ZIP in the plan. ') + `Shares and dollars ${G(GR.spend || 'C')} leads ${G('D')} drive minutes ${G('C')} gas heat ${G('A')}`
        + (lic ? ` licensed contractors ${G('A')}` : LV.has('tdlr_licenses') ? ' Licensed contractors by county appear here once the state license record is stored.' : '') + (perm ? ` permits ${G('B')} Permits count heating and cooling work together, through ${perm.through ? esc(day(perm.through)) : 'the latest permit'}; a county with no publishing city shows none.` : LV.permitIds.length ? ' Observed permits appear here once a city permit record is stored.' : '');
      CSV.counties = () => ['counties', ['county', 'share_pct', 'monthly_usd', 'zips_in_plan', 'leads', 'zips_within_60_min', 'zips_all', 'median_drive_minutes', 'households', 'cold_exposure', 'freeze_nights_normal_year', 'gas_heat_pct', 'licensed_contractors', 'licensed_contractors_per_10k_households', 'mechanical_permits_12_months'], cs.map(c => [c.county, r6((c.share * 100).toFixed(2)), Math.round(c.dollars), c.zips, isN(c.leads) ? r6((+c.leads).toFixed(1)) : '', c.zipsReach, c.zipsAll, isN(c.medianMin) ? Math.round(c.medianMin) : '', Math.round(c.households), isN(c.exposure) ? r6((+c.exposure).toFixed(3)) : '', fz && isN(fz[c.county]) ? r6((+fz[c.county]).toFixed(1)) : '', isN(c.gasPct) ? Math.round(c.gasPct) : '', lic && num(lic.by[c.county]) ? lic.by[c.county] : '', per10k(c) == null ? '' : r6(per10k(c).toFixed(1)), perm && num(perm.by[c.county]) ? perm.by[c.county] : '']), `Heat Desk by county, ${plan.monthName}, ${usd(plan.T.budget)} a month. Shares grade C; leads grade D; cold exposure and freeze nights grade C; gas heat grade A; licenses grade A and permits grade B where those live records are stored, blank where they are not.`];
    }

    /* ---------- cold rules ---------- */
    function rules() {
      const rs = (wk && wk.rules) || (HX.rules ? HX.rules(PP) : []), gr = g => (/^[A-D](\/[A-D])*$/.test(String(g || '').trim()) ? G(String(g).trim()) : ec(g || ''));
      $('#h17Rules', root).innerHTML = rs.length ? `<div class="xscroll">${tbl([['Trigger', 1], ['Threshold', 1], ['Budget', 1], ['Bids', 1], ['Hours', 1], ['Creative', 1], ['Size', 1], ['Grade', 1], [sim() ? 'In this simulation' : 'This week', 1]],
        rs.map(r => tr([[`<b>${ec(r.trigger)}</b>`, 'l'], [ec(r.threshold), 'l'], [ec(r.budget), 'l'], [ec(r.bids), 'l'], [ec(r.hours), 'l'], [ec(r.creative), 'l'], [ec(r.size), 'l'], [gr(r.grade), 'l hd-gr'], [r.off ? `<span class="hd-chip">off</span> ${ec(typeof r.off === 'string' ? r.off.replace(/^Off:\s*/, '') : '')}` : r.fired ? '<span class="hd-chip t3">fired</span>' : '<span class="mini">not fired</span>', 'l']], r.fired && !r.off ? 'hd-fired' : '')), 'prose')}</div><p class="hd-note">Location bid adjustments never change with the weather: cold raises what every click is worth by about the same factor everywhere, so the money moves through budgets and bid caps. ${wk && wk.src === 'normal' ? 'No usable forecast is stored, so no weather rule can fire this week.' : ''}</p>` : '<p class="hd-empty">The engine publishes no cold rule in this build.</p>';
      CSV.rules = () => ['cold-rules', ['trigger', 'threshold', 'budget', 'bids', 'hours', 'creative', 'size', 'grade', 'fired_this_week', 'off'], rs.map(r => [r.trigger, r.threshold, r.budget, r.bids, r.hours, r.creative, r.size, r.grade, r.fired && !r.off ? 'yes' : 'no', r.off ? (typeof r.off === 'string' ? r.off : 'yes') : ''].map(v => (typeof v === 'string' ? clean(v) : v == null ? '' : v))), `Heat Desk cold rules${sim() ? ', SIMULATED week' : ''}. Thresholds grade C; forecast and alerts grade A; every size grade D.`];
    }

    /* ---------- prose: how it is built, the judgment calls, what is left out, caveats ---------- */
    function prose() {
      const Q = PP, pctOf = v => Math.round(v * 100) + '%', h = plan.line.heat, d2 = v => '$' + D(v, 2);
      $('#h17Meth', root).innerHTML = [
        `<b>One cell per ZIP per line.</b> Four lines (heating repair, gas furnace replacement, heat pump replacement, tune up and safety check) in each of the ${N(ZR.length)} residential ZIPs. Jobs this month are module 12's jobs a year, times the share of systems where a homeowner decides (an owner occupied house counts ${r6(Q.dmw[0])}, a rented house ${r6(Q.dmw[1])}, an apartment ${r6(Q.dmw[2])}), times the month's season index and the ZIP's cold exposure. ${G('B/D')}`,
        `<b>Reach.</b> Drive minutes are 5 plus the straight line kilometers from the dispatch point (${ec(plan.origin.label)}). A lead is worth full value at the door and half at the half value drive: ${N(Q.half.heat)} minutes for repair, ${N(Q.half.furnace)} for furnace replacement, ${N(Q.half.heatpump)} for heat pump replacement, ${N(Q.half.maint)} for a tune up. A line is not sold where reach falls under ${D(Q.cut, 2)}. ${G('C/D')}`,
        `<b>What can be won.</b> Only jobs that start with a paid click can be bought (repair ${pctOf(Q.paid.heat)}, furnace ${pctOf(Q.paid.furnace)}, heat pump ${pctOf(Q.paid.heatpump)}, tune up ${pctOf(Q.paid.maint)}), and one advertiser wins at most ${pctOf(Q.cap)} of those. That ceiling is why a ZIP gets dearer the more of it is already bought. ${G('D')}`,
        `<b>Cost per lead.</b> The line's metro cost per lead (module 12's platform costs, blended over the platforms in use) times a cost index for the ZIP: its relative click cost and the line's competitor pressure, each believed at ${D(Q.trust, 2)} strength because both measure where competitor shops sit, not what an auction costs. ${G('D')}`,
        `<b>Return.</b> Gross profit per job (the first ticket plus ${pctOf(Q.pipeCredit)} of module 12's replacement pipeline credit) times the close rate and reach, over the cost per lead: what the first ad dollar in the cell brings back. ${G('D')}`,
        Q.mode === 'custom' ? `<b>One fill per line.</b> The mix is set by hand, so each line is filled on its own with its share of the budget: each next dollar of a line goes to the ZIP where it earns most. The return is not known to better than about ${pctOf(Q.doubt)}, so the fill averages over that doubt instead of betting on a ranking it cannot defend. ${G('C')}`
          : `<b>One fill across the four lines.</b> Each next dollar goes where it earns most. The return is not known to better than about ${pctOf(Q.doubt)}, so the fill averages over that doubt instead of betting on a ranking it cannot defend, and the gap between lines is believed at ${D(Q.gamma, 2)} strength for the decision only. Reported gross profit is never shrunk. ${G('C')}`,
        `<b>Guards.</b> The last dollar must bring back ${d2(Q.hurdle)} of gross profit or it stays unspent. No ZIP takes more than ${pctOf(Q.zipCap)} of the plan. ZIPs within ${N(Q.coreMin)} minutes stay in the repair and tune up buys. A ZIP that would get under ${r6(Q.depth)} of a lead a month in a line is dropped from that line. Pins and blocks are honored first.`,
        `<b>Ranges.</b> The plan as solved is replayed in ${N((bands && bands.n) || 120)} seeded worlds in which lead costs, close rates, paid shares, the advertiser cap, the pipeline credit, reach and jobs all move inside stated bounds. The 10th and 90th percentile are the range printed beside every outcome; the same worlds are used for every plan, so two plans differ by their inputs and never by the dice. ${G('D')}`,
        `<b>The week.</b> Each forecast low gets a weight (a ${N(((window.TDA_LIVE || {}).derive || {}).TH ? TDA_LIVE.derive.TH.cold : 40)}°F night is ${r6(Q.nightW[2])}) and a ZIP's week is its seven nights against the month's normal night, read from its three nearest forecast points. Repair follows the cold one for one, furnace replacement takes ${pctOf(Q.resp.furnace)} of the lift and heat pump replacement ${pctOf(Q.resp.heatpump)}, tune ups move the other way. Alerts set a floor by county. Anything above a normal week draws on the freeze reserve; anything below goes back. ${G('A/D')}`,
      ].map(x => `<li>${x}</li>`).join('');
      $('#h17Judg', root).innerHTML = judgList([
        ['Reach is a policy, not an estimate', 'The owner decides how far a truck goes for a no heat call. The reach sliders are among the first controls on the page and the held back table shows what each choice leaves out.'],
        [`Stated indexes enter at ${D(Q.trust, 2)} strength`, 'Relative click cost and competitor pressure are priors until the account measures them. The one at a time table under How sure is this shows what full trust and no trust do to the ZIP list.'],
        [`The desk believes ${D(Q.gamma, 2)} of the gap between lines`, 'Module 12 makes a replacement lead worth far more per dollar than a repair lead, on stated lead costs and close rates. Trusted in full that would starve repair in a freeze. The decision uses a part of the gap; the reported dollars use all of it.'],
        ['Pipeline is shown apart', `${h.gp > 0 && isN(h.gpPipe) ? `${pctOf(h.gpPipe / h.gp)} of the gross profit of heating repair in this plan is the replacement work a repair visit may become.` : 'Most of the gross profit of a repair call is the replacement it may become.'} Every table prints direct gross profit and gross profit with pipeline apart.`],
        ['Budgets follow the weather, bids follow value', 'Cold raises how many people search, not what a job is worth, so location bid adjustments never move with the forecast. The money moves through daily budgets and bid caps.'],
        ['No ZIP is lowered for who lives there', 'There is no income, race, ethnicity or age term anywhere in the scoring. The ticket by ZIP comes from permit valuations in module 12 and is the only place home value enters.'],
        ['A hurdle instead of spending to the last dollar', `Under ${d2(Q.hurdle)} of gross profit on the last ad dollar the rest of the budget is left unspent and the page says how much.`],
        ['Local Services Ads stay off until verified', `The ${ROSTER} roster shows no Local Services badge for the client. The switch is in the plan; the sheet lists the steps still open.`],
        ['A ZIP list is frozen in a week without a cold trigger', 'Changing location targets every Monday resets learning for nothing. Without a trigger only the money moves; with one, ZIPs can join and leave only when a line is paused or out of reach.'],
        ['The reserve keeps no ledger', 'The week card shows what this week draws or returns against a normal week. What the account actually spent is the owner\'s number; the desk does not pretend to know it.'],
        ['Outlooks, recalls, prices and rules never move money', 'They change what is staged and what an ad says. Only the seven night forecast and the alerts move a budget.'],
      ]);
      $('#h17Not', root).innerHTML = judgList([
        ['Keyword volumes', 'No keyword tool was queried. Demand is the stock model\'s jobs, not search counts.'],
        ['Competitor spend', 'No estimate of what any competitor spends. Pressure counts mapped competitors nearby and what they sell.'],
        ['Customer or account data', 'Nothing from the client\'s own leads, calls or invoices. Module 15 holds the account connectors; none of it feeds this plan yet.'],
        ['Income, race, ethnicity or age', 'None is an input to any score, reach, bid or budget on this page.'],
        ['Traffic or drive time tables', 'Minutes are straight line distance plus five. A lake or a toll road changes the real drive.'],
      ]);
      $('#h17Cav', root).innerHTML = judgList([
        ['Dollar outcomes are benchmark arithmetic', 'Leads, jobs and gross profit follow module 12\'s stated lead costs, close rates, tickets and margins (grade D). Use them to compare ZIPs and budgets, not to forecast the bank balance.'],
        ['ZIP dollars are where spend is expected to land', 'No platform takes a budget by ZIP. What is uploaded is the list, the bid adjustment and the campaign budget; the ZIP dollars are a tripwire for the location report.'],
        ['Small numbers', 'A replacement line at this budget expects a handful of jobs a month. Judge months, not weeks.'],
        ['Straight line minutes', 'Rockwall is across the bridge on Interstate 30 and Sunnyvale is closer than it looks. Pin or block a ZIP when the map and the road disagree.'],
        [`Competition is the ${ROSTER} roster`, 'A ZIP with no mapped competitor is not a ZIP without competitors.'],
        ['The cold response has not been fitted to a call log', 'Night weights and line responses are shaped on degree days. The only measured anchors are the permit regressions in module 04 and a published heat wave study.'],
        ['Simulations are not forecasts', 'The scenario selector reruns the week on invented lows built from the live ones. It shows what the rules would do, not what the weather will.'],
      ]);
    }
    /* ---------- source register: the atlas's own layers, then every live record this page reads, with its age ---------- */
    function sources() {
      const B = LV.base, live = id => { const d = LV.def(id); if (!d) return null; const r = LV.rec(id); return [ec(d.name || id), ec(d.publisher || ''), /^[A-D]$/.test(d.grade || '') ? d.grade : '', r ? `fetched ${esc(LIVE.ago(r.at))}${r.baseline ? ', the copy baked into this build' : ''}` : 'not stored yet', /^https:\/\//.test(d.page || '') ? esc(d.page) : '']; };
      const ids = ['nws_cold', 'acis_season', 'cpc_outlook', 'cpsc_recalls', 'bls_energy', 'fedreg_rules', 'tdlr_licenses'].concat(LV.permitIds);
      $('#h17Src', root).innerHTML = srcRows([
        ['Homes, heating fuel, who decides', 'U.S. Census Bureau, American Community Survey 2020 to 2024 five year tables, through the ZIP ledger', 'A', '2024', 'https://www.census.gov/programs-surveys/acs'],
        ['Heating systems and their ages', 'Module 02 stock model: Census housing age and fuel, lifetimes fitted to EIA RECS 2020 Texas', 'B', '2020', 'https://www.eia.gov/consumption/residential/data/2020/'],
        ['Jobs, tickets, margins, season by line', 'Module 12 Service Lines: stock model jobs, permit valuations for the ticket by ZIP, season from permits and climate', 'B', 'as set in module 12', ''],
        ['Lead costs, close rates, paid shares', 'Stated benchmarks in module 12 and on this page; every one is a control', 'D', 'stated', ''],
        ['Competitor pressure and relative click cost', `Module 13 roster of mapped competitors and module 05 cost index`, 'C', esc(ROSTER), ''],
        ['Drive minutes', `5 plus straight line kilometers from ${ec(plan.origin.label)}`, 'C', plan.origin.src === 'brand' ? 'the brand panel\'s dispatch point' : 'the office in the live layer', ''],
        ['Normal cold by ZIP', plan.exposure.source === 'none' ? 'Not in this build: cold exposure is 1 in every ZIP' : ec(plan.exposure.label || ''), plan.exposure.source === 'none' ? '' : GR.exposure || 'C', B && B.normalsPeriod ? ec(String(B.normalsPeriod)) : plan.exposure.source === 'none' ? 'missing' : '1991 to 2020', 'https://www.ncei.noaa.gov/products/land-based-station/us-climate-normals'],
      ].concat(ids.map(live).filter(Boolean)));
    }

    /* ---------- what a budget buys: the same plan at other budgets, computed once per setting ---------- */
    const LADDER = [2000, 3000, 4000, 5000, 6000, 8000, 10000, 12000, 15000, 20000, 25000, 30000, 40000];
    function ladderData() {
      const k = pkey(); if (st.ladKey === k && st.lad) return st.lad;
      const B = PP.budget, cols = (B === 3000 ? [1500, 3000, 9000] : B === 1000 ? [1000, 3000, 9000] : [3000, B, 3 * B]).sort((a, b) => a - b);
      st.lad = { rows: HX.ladder(PP, LADDER.concat(cols)), cols }; st.ladKey = k; return st.lad;
    }
    function ladder() {
      const host = $('#h17LadC', root); let Ld;
      try { Ld = ladderData(); } catch (e) { console.error('heat desk ladder', e); host.innerHTML = '<p class="hd-empty">The ladder could not be computed with these settings.</p>'; $('#h17LadN', root).textContent = ''; $('#h17Cols', root).innerHTML = ''; return; }
      const rows = Ld.rows, B = PP.budget, i = rows.findIndex(r => r.budget === B), own = rows[i], nx = rows[i + 1], xmax = Math.max(...rows.map(r => r.budget)), kd = v => (v >= 1000 ? '$' + r6((v / 1000).toFixed(1)) + 'K' : '$' + N(v));
      host.innerHTML = legendRow([{ name: 'Leads a month', color: cssv('--accent') }, { name: 'ZIPs in the plan', color: cssv('--s2'), dash: 1 }]) + '<div id="h17LadS"></div>';
      const slim = window.innerWidth < 760; st.slim = slim;                                        /* a phone gets a chart drawn for its width, so the axis text stays readable */
      lineChart($('#h17LadS', root), { W: slim ? 700 : 1180, H: slim ? 330 : 300, series: [{ name: 'Leads a month', color: cssv('--accent'), pts: rows.map(r => [r.budget, r.leads]), dots: true, width: 2.2, fmt: v => D(v, 1) }, { name: 'ZIPs in the plan', color: cssv('--s2'), pts: rows.map(r => [r.budget, r.zips]), dash: '5 4', width: 1.6, fmt: v => N(v) }],
        x: { min: 0, max: xmax, fmt: kd, label: 'Monthly heating media' }, y: { zero: true, fmt: v => N(v), label: 'Leads a month and ZIPs in the plan' },
        vlines: [{ x: B, label: 'your budget' }], marks: own ? [{ x: B, y: own.leads, color: cssv('--bench'), label: `${n0(own.leads)} leads`, dx: 8, dy: 14 }] : [], tipTitle: x => usd(x) + ' a month',
        aria: `Leads a month and ZIPs in the plan at monthly budgets from ${usd(rows[0].budget)} to ${usd(xmax)}, with the budget of ${usd(B)} marked` });
      const lo = rows[0], hi = rows[rows.length - 1];
      const grows = (a, b, f, what, unit) => (f(a) === f(b) ? `${what} stays at ${f(a)}${unit}` : `${what} grows from ${f(a)} to ${f(b)}${unit}`);
      $('#h17LadN', root).innerHTML = (own ? `At ${usd(B)} a month the plan ${own.unspent > 0.5 ? `places ${usd(own.spent)} of it and ` : ''}buys <b>${n0(own.leads)} leads</b> at ${own.leads > 0 ? usd(own.cpl) : NA} each in ${plural(own.zips, 'ZIP')}.${nx && nx.leads - own.leads > 0.05 ? ` The next ${usd(nx.budget - B)} would add about ${n1(nx.leads - own.leads)} leads at ${usd((nx.spent - own.spent) / (nx.leads - own.leads))} each: every step up the ladder costs more per lead.` : ''} ` : '')
        + `From ${usd(lo.budget)} to ${usd(hi.budget)} ${grows(lo.farthest, hi.farthest, n0, 'the farthest drive', ' minutes')} and ${grows(lo.cpl, hi.cpl, usd, 'the cost per lead', '')}.${isN(plan.T.hurdleAt) ? ` Past about ${usd(plan.T.hurdleAt)} a month the last dollar would bring back under $${D(PP.hurdle, 2)} of gross profit and the rest stays unspent.` : ''} ${G('D')}`;
      const col = r => `<div class="hd-col${r.budget === B ? ' own' : ''}"><h4>${usd(r.budget)}</h4><div class="hd-colsub">${r.budget === B ? 'your budget, a month' : 'a month'}${r.unspent > 0.5 ? ` · ${usd(r.unspent)} stays unspent` : ''}</div>
        <div class="rowl"><span>ZIPs in the plan · farthest drive</span><b>${N(r.zips)} · ${n0(r.farthest)} min</b></div><div class="rowl"><span>Money within 20 minutes</span><b>${pc(r.share20)}</b></div>
        <div class="rowl"><span>Leads a month · cost per lead ${G('D')}</span><b>${n0(r.leads)} · ${r.leads > 0 ? usd(r.cpl) : NA}</b></div><div class="rowl"><span>Booked jobs a month ${G('D')}</span><b>${n1(r.jobs)}</b></div>
        <div class="rowl"><span>Gross profit: direct · with pipeline ${G('D')}</span><b>${usd(r.gpDirect)} · ${usd(r.gp)}</b></div>
        <div class="rowl"><span>Mix: repair · furnace · heat pump · tune up</span><b>${IDS.map(id => shr(r.mix[id])).join(' · ')}</b></div>
        <div class="rowl"><span>Counties</span><b>${(r.counties || []).slice(0, 3).map(c => `${esc(c.county)} ${shr(c.share)}`).join(', ') || 'none'}</b></div>
        <div class="rowl"><span>Largest ZIPs</span><b>${(r.top || []).slice(0, 3).map(t => `${esc(t.zip)} ${esc(t.city)}`).join(', ') || 'none'}</b></div></div>`;
      const all = tbl([['$ a month', 0], ['Unspent'], ['ZIPs'], ['Farthest'], ['Within 20 min'], ['Leads'], ['Cost per lead'], ['Booked jobs'], ['Gross profit, direct'], ['With pipeline'], ['Repair'], ['Furnace'], ['Heat pump'], ['Tune up']],
        rows.map(r => tr([`<b>${usd(r.budget)}</b>`, r.unspent > 0.5 ? usd(r.unspent) : '$0', n0(r.zips), n0(r.farthest) + ' min', pc(r.share20), n1(r.leads), r.leads > 0 ? usd(r.cpl) : NA, n1(r.jobs), usd(r.gpDirect), usd(r.gp)].concat(IDS.map(id => shr(r.mix[id]))), r.budget === B ? 'sel' : '')));
      $('#h17Cols', root).innerHTML = Ld.cols.map(c => rows.find(r => r.budget === c)).filter(Boolean).map(col).join('') + `<details class="hd-adv hd-all"><summary>Every budget on the ladder</summary><div class="xscroll">${all}</div><p class="hd-note">Each row is the whole plan solved again at that budget, with every other setting as it is now. Leads, jobs and gross profit ${G('D')}</p></details>`;
      CSV.ladder = () => ['budget-ladder', ['monthly_budget_usd', 'your_budget', 'spent_usd', 'unspent_usd', 'zips', 'search_campaigns', 'farthest_minutes', 'share_within_20_min_pct', 'leads', 'cost_per_lead_usd', 'booked_jobs', 'gross_profit_direct_usd', 'gross_profit_with_pipeline_usd'].concat(IDS.map(id => id + '_share_pct')).concat(['core_pct', 'ring_pct', 'far_pct', 'counties', 'largest_zips']),
        rows.map(r => [r.budget, r.budget === B ? 'yes' : '', Math.round(r.spent), Math.round(r.unspent), r.zips, r.campaigns, isN(r.farthest) ? Math.round(r.farthest) : '', Math.round(r.share20 * 100), r6(r.leads.toFixed(1)), r.leads > 0 ? Math.round(r.cpl) : '', r6(r.jobs.toFixed(1)), Math.round(r.gpDirect), Math.round(r.gp)].concat(IDS.map(id => Math.round(r.mix[id] * 100))).concat(['Core', 'Ring', 'Far'].map(t => Math.round(((r.tiers || {})[t] || 0) * 100))).concat([(r.counties || []).map(c => `${c.county} ${Math.round(c.share * 100)}%`).join('; '), (r.top || []).slice(0, 5).map(t => t.zip).join(' ')])),
        `Heat Desk budget ladder, ${plan.monthName}: the plan solved again at each monthly budget with every other setting as saved. Leads, jobs and gross profit grade D.`];
    }

    /* ---------- season: the mix by month, the season so far, the outlooks ---------- */
    const lineCols = () => [cssv('--heat'), cssv('--s4'), cssv('--s1'), cssv('--s3')];
    function season() {
      const k = pkey(); if (st.monKey !== k || !st.mon) { try { st.mon = HX.months(PP); } catch (e) { console.error('heat desk months', e); st.mon = []; } st.monKey = k; }
      const ms = st.mon, cols = lineCols(), host = $('#h17SeasT', root);
      if (!ms.length) { host.innerHTML = '<p class="hd-empty">The mix by month could not be computed with these settings.</p>'; $('#h17SeasN', root).textContent = ''; }
      else {
        host.innerHTML = `<div class="hd-seas"><div>${legendRow(IDS.map((id, i) => ({ name: NAMES[id], color: cols[i], sq: 1 })))}<div id="h17SeasC"></div></div><div class="xscroll">${tbl([['Month', 1], ['Repair'], ['Furnace'], ['Heat pump'], ['Tune up'], ['Repair season', 0, 'Module 12 season index of heating repair: 100 is an average month'], ['ZIPs'], ['Leads'], ['Leads the mix', 1]],
          ms.map(m => { const lead = IDS.reduce((a, b) => (m.mix[b] > m.mix[a] ? b : a)); return tr([[`<b>${esc(m.name)}</b>`, 'l']].concat(IDS.map(id => shr(m.mix[id]))).concat([m.season && isN(m.season.heat) ? N(m.season.heat) : NA, n0(m.zips), n0(m.leads), [esc(SHORT[lead]), 'l']]), m.month === plan.month ? 'sel' : ''); }))}</div></div>`;
        barChart($('#h17SeasC', root), { W: 640, H: 280, L: 46, T: 28, cats: ms.map(m => m.name.slice(0, 3)), stacked: true, yMax: 100, fmt: v => P(v, 0), yLabel: 'Share of the month\'s heating media', series: IDS.map((id, i) => ({ name: NAMES[id], color: cols[i], values: ms.map(m => m.mix[id] * 100) })), aria: `Line mix by month from ${ms[0].name} to ${ms[ms.length - 1].name}: ${ms.map(m => `${m.name} heating repair ${shr(m.mix.heat)}`).join(', ')}` });
        const led = ms.filter(m => m.repairLed).map(m => m.name), not = ms.filter(m => !m.repairLed).map(m => m.name);
        $('#h17SeasN', root).innerHTML = `Each month is this plan solved again with only the month changed: ${usd(PP.budget)}, the same reach and guards${PP.mode === 'custom' ? ', and the custom mix you set, so the split does not move' : ''}. ${PP.mode === 'custom' ? '' : `${led.length ? `Repair leads in ${list(led)}` : 'Repair leads in no month'}${not.length ? `; in ${list(not)} the replacement lines or tune ups lead because repair is out of season` : ''}. `}The row of the plan's month is marked. ${G('D')}`;
        CSV.season = () => ['season-mix', ['month', 'repair_pct', 'furnace_pct', 'heatpump_pct', 'tuneup_pct', 'repair_season_index', 'zips', 'leads', 'booked_jobs', 'gross_profit_with_pipeline_usd', 'repair_led'], ms.map(m => [m.name].concat(IDS.map(id => r6((m.mix[id] * 100).toFixed(1)))).concat([m.season && isN(m.season.heat) ? Math.round(m.season.heat) : '', m.zips, r6(m.leads.toFixed(1)), r6(m.jobs.toFixed(1)), Math.round(m.gp), m.repairLed ? 'yes' : 'no'])), `Heat Desk line mix by month at ${usd(PP.budget)} a month, every other setting as saved. Grade D.`];
      }
      /* season to date: the airports' own numbers when the season record is stored, the calendar rule when it is not */
      const S = LV.season, ff = F0 && F0.firstFreeze ? F0.firstFreeze : null, expo = `<p class="hd-statline"><b>Normal cold by ZIP.</b> ${ec(plan.exposure.label || (plan.exposure.source === 'none' ? 'The climate baseline is not in this build, so cold exposure is 1 in every ZIP.' : ''))} ${plan.exposure.source === 'none' ? '' : G(GR.exposure || 'C')}</p>`;
      if (S) {
        const m = S.metro, f = m.firstFreeze || null, vs = (a, b, p) => (isN(a) ? `${N(a)}${isN(b) ? ` against a normal ${N(b)}${isN(p) ? ` (${N(p)}%)` : ''}` : ''}` : NA);
        const fr = !f ? NA : f.state === 'occurred' ? `${f.date ? esc(day(f.date)) : 'already seen'}${isN(f.daysVsMedian) ? (f.daysVsMedian === 0 ? ', on the median date' : `, ${plural(Math.abs(f.daysVsMedian), 'day')} ${f.daysVsMedian < 0 ? 'ahead of' : 'after'} the median date`) : ''}` : `not yet${f.median ? `; the median first freeze is ${esc(day(f.median))}` : ''}`;
        $('#h17SeasLive', root).innerHTML = `<p class="hd-statline">${ec(S.headline || '')} ${G('A')}</p><div class="hd-stat">
          <div class="rowl"><span>Heating degree days since July 1 at ${ec(m.station || 'DFW Airport')} ${G('A')}</span><b>${vs(m.hdd, m.hddNorm, m.pct)}</b></div>
          <div class="rowl"><span>Last 30 days ${G('A')}</span><b>${vs(m.hdd30, m.hdd30Norm, m.pct30)}</b></div><div class="rowl"><span>Last 7 days ${G('A')}</span><b>${vs(m.hdd7, m.hdd7Norm, m.pct7)}</b></div>
          <div class="rowl"><span>Freeze nights so far ${G('A')}</span><b>${isN(m.fr32) ? N(m.fr32) : NA}${isN(m.fr32Norm) ? ` against a normal ${D(m.fr32Norm, 1)} to this date` : ''}</b></div>
          <div class="rowl"><span>First freeze ${G('B')}</span><b>${fr}</b></div>
          <div class="rowl"><span>Coldest low so far ${G('A')}</span><b>${isN(m.minT) ? Math.round(m.minT) + '°F' + (m.minDate ? ' on ' + esc(day(m.minDate)) : '') : NA}</b></div></div>
          <p class="hd-note">Observed through ${S.through ? esc(day(S.through)) : 'an unknown date'}; the record was fetched ${esc(LIVE.ago(S.at))}.${S.overdue ? ' A refresh is due.' : ''} ${ff ? (ff.src === 'season' ? `The first freeze rule reads this record: ${ff.done ? 'the first freeze has been seen, so the bonus is off' : 'no freeze yet, so the first freezing night gets the bonus'}.` : 'The first freeze rule still follows the calendar: this record does not say whether a freeze has been seen.') : ''} The season so far tells what is already in the homes; it moves no budget.</p>${expo}`;
      } else {
        $('#h17SeasLive', root).innerHTML = `<p class="hd-empty">${LV.has('acis_season') ? (LV.rec('acis_season') ? 'The season to date record that is stored cannot be read, so it is left out. Live Data fetches a new one every week.' : 'The season to date record is not stored in this browser yet. Live Data fetches it every week.') : 'This build carries no season to date collector.'} Until it is there the first freeze rule follows the calendar: not yet seen before December 1, seen after${ff ? ` (today: ${ff.done ? 'seen' : 'not yet seen'})` : ''}.</p>${expo}`;
      }
      /* outlooks: a reason to stage and to hold the reserve, never to spend */
      const O = LV.outlook, span = (a, b) => { const x = day(a), y = day(b); return x.slice(-4) === y.slice(-4) ? `${x.slice(0, -6)} to ${y}` : `${x} to ${y}`; };
      $('#h17Outlook', root).innerHTML = !O ? '' : `<div class="dsec">Outlooks: stage, do not spend</div>${O.read ? `<p class="hd-statline"><b>${ec(O.read.headline)}.</b> ${ec(O.read.sub)}</p>` : ''}`
        + O.wins.map(w => `<div class="hd-sig"><span class="hd-chip${w.lean === 'below' ? ' t3' : ''}">${esc(w.name)}</span><div><b>${esc(span(w.start, w.end))}:</b> ${w.lean === 'equal' ? 'equal chances of above, near and below normal temperatures' : `${w.lean} normal temperatures favored${w.prob ? ` at ${N(w.prob)}%` : ''}`}${w.load ? `, about ${N(w.load)}% of the normal heating load for those days` : ''}.${w.issued ? ` Issued ${esc(day(w.issued))}.` : ''} ${G('B')}</div></div>`).join('')
        + `<p class="hd-note">${O.wins.some(w => w.lean === 'below') ? 'A cold lean is a reason to stage the freeze creative, check the phones and keep the freeze reserve whole.' : 'No cold lean: stage the tune up and replacement creative and leave the reserve alone.'} An outlook never moves a dollar here: budgets move on the seven night forecast and the alerts only. Fetched ${esc(LIVE.ago(O.at))}.</p>`;
    }

    /* ---------- signals that change the message, never the budget: one line each, hidden when its record is missing ---------- */
    function signals() {
      const out = [], R = LV.recalls, PR = LV.prices, RU = LV.rules, ym = p => (/^\d{4}-\d{2}$/.test(String(p)) ? MON[+String(p).slice(5, 7) - 1] + ' ' + String(p).slice(0, 4) : ''), up = v => (!num(v) ? NA : Math.abs(v) < 0.05 ? 'level' : (v > 0 ? 'up ' : 'down ') + D(Math.abs(v), 1) + '%');
      const row = (chip, body, say, grade, at) => `<div class="hd-sig"><span class="hd-chip">${chip}</span><div>${body} <span class="hd-say"><b>In the ad:</b> ${say}</span> ${G(grade)}${at ? ` <span class="mini">fetched ${esc(LIVE.ago(at))}</span>` : ''}</div></div>`;
      if (R) { const c = R.central, kinds = { furnace: 'furnaces and coils', heatpump: 'heat pumps', boiler: 'boilers' }, by = Object.keys(kinds).map(k => [k, c.filter(r => r.kind === k).length]).filter(x => x[1] > 0), new1 = c[0];
        out.push(row('Recalls', c.length ? `<b>${plural(c.length, 'recall')} of central heating equipment in the last 12 months</b> (${list(by.map(x => `${N(x[1])} of ${kinds[x[0]]}`))}). The newest, ${esc(day(new1.d))}: ${new1.url && /^https:\/\//.test(new1.url) ? `<a href="${esc(new1.url)}" target="_blank" rel="noopener">${ec(new1.title)}</a>` : ec(new1.title)}${isN(new1.units) && new1.units > 0 ? `, about ${N(new1.units)} units` : ''}.` : `<b>No recall of central heating equipment in the last 12 months</b> among the ${N(R.all)} heating recalls on file${R.since ? ' since ' + esc(day(R.since)) : ''}.${R.other.length ? ` ${plural(R.other.length, 'recall')} of room heaters or carbon monoxide alarms in the same months.` : ''}`,
          c.length ? 'offer to read the model number against open recalls on every heating visit. A recall is a fact about a model: never tell a homeowner their unit is recalled before the model number is read.' : 'nothing to add. Keep the carbon monoxide test on every visit in the safety copy.', 'A', R.at)); }
      if (PR) out.push(row('Prices', `<b>Dallas Fort Worth price indexes${PR.through && ym(PR.through) ? ', ' + esc(ym(PR.through)) : ''}:</b> ${[num(PR.electricity) ? `electricity ${up(PR.electricity)}` : '', num(PR.gas) ? `piped gas ${up(PR.gas)}` : ''].filter(Boolean).join(', ')} over 12 months.`,
        'say which way bills have moved and what a tune up or a newer system does to run time, in plain words. Never print a savings figure and never promise one.', 'A', PR.at));
      if (RU) { const n = RU.next[0], WHAT = { effective: 'takes effect', comments: 'closes for comment', compliance: 'has its compliance date' };
        out.push(row('Rules', `<b>${plural(RU.recent.length, 'federal document')} in the last 90 days</b> on furnaces, heat pumps, refrigerants, credits or advertising claims, of ${N(RU.n)} on file.${n ? ` Next date: ${esc(day(n.on))}, when this ${WHAT[n.what] || 'comes due'}: ${n.url && /^https:\/\//.test(n.url) ? `<a href="${esc(n.url)}" target="_blank" rel="noopener">${ec(n.title)}</a>` : ec(n.title)}.` : RU.newest ? ` The newest, ${esc(day(RU.newest.d))}: ${ec(RU.newest.title)}.` : ''}`,
          'quote a rule only by its published title and date, and have every equipment, credit or review claim checked against it before it runs. A rule changes the wording of an offer, not where the money goes.', 'A', RU.at)); }
      const known = [['cpsc_recalls', 'heating equipment recalls'], ['bls_energy', 'gas and electricity price indexes'], ['fedreg_rules', 'federal rules']], missing = known.filter(k => LV.has(k[0]) && !LV.rec(k[0])).map(k => k[1]), absent = known.filter(k => !LV.has(k[0])).map(k => k[1]);
      $('#h17Sig', root).innerHTML = (out.join('') || '<p class="hd-empty">No signal record is stored in this browser yet, so there is nothing to show here.</p>')
        + (missing.length || absent.length ? `<p class="hd-note">${missing.length ? `Not stored yet: ${list(missing)}. Live Data fetches them every week and each gets its line here.` : ''}${absent.length ? ` Not collected in this build: ${list(absent)}.` : ''}</p>` : '');
    }

    /* ---------- how sure is this: the ranges, the labels, and one assumption changed at a time ---------- */
    function sure() {
      const T = plan.T, d2 = v => '$' + D(v, 2);
      const defs = [['Leads a month', T.leads, band('leads'), n1], ['Booked jobs a month', T.jobs, band('jobs'), n1], ['Cost per lead', T.cpl, band('cpl'), usd], ['Cost per booked job', T.cpj, band('cpj'), usd], ['Gross profit, direct', T.gpDirect, band('gpDirect'), usd], ['Gross profit with pipeline', T.gp, band('gp'), usd], ['Gross profit per ad dollar, pipeline included', T.gpPerDollar, band('gpPerDollar'), d2]].filter(x => x[2]);
      const labs = HX.LABELS.map(l => { const zs = plan.zips.filter(r => r.label === l.id); return { id: l.id, words: l.words, n: zs.length, share: sum(zs.map(r => r.share)) }; });
      $('#h17Sure', root).innerHTML = (defs.length ? `<div class="xscroll">${tbl([['Outcome for the month', 1], ['The plan'], ['10th percentile'], ['Median'], ['90th percentile'], ['Where the plan sits in its range', 1]], defs.map(([l, v, r, f]) => tr([[esc(l), 'l'], `<b>${isN(v) ? f(v) : NA}</b>`, f(r[0]), f(r[1]), f(r[2]), [rbar(r, v), 'l']])))}</div>
        <p class="hd-note">${N((bands && bands.n) || 120)} replays of the plan as solved, each with its own lead costs, close rates, paid shares, advertiser cap, pipeline credit, reach and jobs, all inside stated bounds. The plan's own figure uses every stated value as it stands; the replays let the pipeline credit fall as low as half, which is why the median with pipeline sits under the plan. Ranges are what the benchmarks allow, not a forecast of the account. ${G(GR.ranges || 'D')}</p>` : '<p class="hd-empty">No range could be computed for this plan.</p>')
        + (T.zips ? `<p class="hd-statline"><b>Where is firmer than how to split it.</b> ${list(labs.filter(l => l.n).map(l => `${plural(l.n, 'ZIP')} with ${shr(l.share)} of the money ${l.n === 1 ? 'is' : 'are'} ${esc(l.id)} (${esc(l.words)} chance the return clears the cut)`))}. Which ZIPs get money rests mostly on measured homes, fuel and drive time; how the money splits between the four lines rests on stated lead costs and close rates, so the split is the softer part. The one at a time table measures both. ${G(GR.conf || 'D')}</p>` : '');
      const V = st.sens, fresh = V && st.sensKey === pkey(), go = $('#h17SensGo', root); go.textContent = V ? 'Run the one at a time table again' : 'Run the one at a time table';
      if (!V) { $('#h17Sens', root).innerHTML = '<p class="hd-empty">The one at a time table changes a single assumption, solves the plan again and shows how much of the money stays in the same ZIPs. It solves about thirty plans, so it runs on the button above.</p>'; return; }
      const b = V.base, rows = V.rows || [], most = rows.slice(0, 3), mix = rows.slice().sort((x, y) => y.mixMoved - x.mixMoved).slice(0, 2), least = rows.slice(-3).reverse();
      $('#h17Sens', root).innerHTML = `<div class="dsec hd-dsecrow"><span>One assumption changed at a time${fresh ? '' : ' <span class="hd-chip warn">settings changed since this ran</span>'}</span>${csvBtn('sens', 'One at a time CSV')}</div>
        <p class="hd-statline"><b>What would change the plan most.</b> ${list(most.map(r => `${ec(r.name)} keeps ${pc(r.overlap)} of the money in the same ZIPs`))}. The split between lines moves most with ${list(mix.map(r => `${ec(r.name)} (${pc(r.mixMoved)} of the money changes line)`))}. Least sensitive: ${list(least.map(r => `${ec(r.name)} (${pc(r.overlap)})`))}. ${G('D')}</p>
        <div class="tscroll short">${tbl([['Change', 1], ['Kind', 1], ['Money that stays in the same ZIPs', 0, 'Share of the plan\'s dollars that lands in a ZIP that already had it'], ['Money that changes line'], ['ZIPs'], ['Leads'], ['Gross profit with pipeline'], ['Dallas County share'], ['Largest five ZIPs', 1]],
          [tr([['<b>The plan as set</b>', 'l'], ['', 'l'], '100%', '0%', n0(b.zips), n0(b.leads), usd(b.gp), pc(b.dallas), [esc(plan.zips.slice(0, 5).map(r => r.zip).join(' ')), 'l mono']], 'hd-total')].concat(rows.map(r => tr([[ec(r.name), 'l'], [esc(r.group || ''), 'l'], `<b>${pc(r.overlap)}</b>`, pc(r.mixMoved), n0(r.zips), n0(r.leads), usd(r.gp), pc(r.dallas), [esc((r.top5 || []).join(' ')), 'l mono']]))))}</div>`;
      CSV.sens = () => ['one-at-a-time', ['change', 'kind', 'money_in_same_zips_pct', 'money_that_changes_line_pct', 'zips', 'leads', 'gross_profit_with_pipeline_usd', 'dallas_county_share_pct', 'largest_five_zips'], [['The plan as set', '', 100, 0, b.zips, r6(b.leads.toFixed(1)), Math.round(b.gp), Math.round(b.dallas * 100), plan.zips.slice(0, 5).map(r => r.zip).join(' ')]].concat(rows.map(r => [clean(r.name), r.group || '', r6((r.overlap * 100).toFixed(1)), r6((r.mixMoved * 100).toFixed(1)), r.zips, r6(r.leads.toFixed(1)), Math.round(r.gp), Math.round(r.dallas * 100), (r.top5 || []).join(' ')])), `Heat Desk, one assumption changed at a time, ${plan.monthName}, ${usd(PP.budget)} a month${fresh ? '' : ' (run before the latest change of settings)'}. Grade D.`];
    }
    CSV.ranges = () => ['outcome-ranges', ['outcome', 'the_plan', 'p10', 'median', 'p90'], [['leads', 'leads'], ['booked_jobs', 'jobs'], ['cost_per_lead_usd', 'cpl'], ['cost_per_booked_job_usd', 'cpj'], ['gross_profit_direct_usd', 'gpDirect'], ['gross_profit_with_pipeline_usd', 'gp'], ['gross_profit_per_ad_dollar', 'gpPerDollar']].filter(x => band(x[1])).map(([l, k]) => [l].concat([plan.T[k]].concat(band(k)).map(v => (isN(v) ? r6((+v).toFixed(2)) : '')))).concat(IDS.flatMap(id => ['leads', 'jobs', 'gpDirect', 'gp'].filter(k => lband(id, k)).map(k => [`${id}_${k}`].concat([plan.line[id][k]].concat(lband(id, k)).map(v => (isN(v) ? r6((+v).toFixed(2)) : '')))))),
      `Heat Desk outcome ranges, ${plan.monthName}, ${usd(PP.budget)} a month: 10th, 50th and 90th percentile of ${(bands && bands.n) || 120} seeded replays of the plan as solved. Grade D: what the stated benchmarks allow, not a forecast.`];

    /* ---------- one render: compute, then every block from the same plan and week ---------- */
    /* The blocks above the fold and the tables that state the plan are drawn at once. The blocks that solve the plan again
       (the ladder, the months) and the long prose follow a moment later, so a slider or a number box never waits for them. */
    let LV = live();
    const FAST = [gate, meta, answer, kpis, week, drawMap, zipCard, table, held, lines, filesCard, counties, rules], SLOW = [ladder, season, signals, sure, prose, sources];
    const run = f => { try { f(); } catch (e) { console.error('heat desk block ' + f.name, e); } };
    const slow = debounce(() => { if (plan) SLOW.forEach(run); }, 200);
    function render(force, whole) {
      try { compute(); fail = ''; } catch (e) { console.error('heat desk compute', e); fail = e && e.message ? e.message : String(e); if (!plan) { $('#h17Gate', root).innerHTML = callout('', 'The plan could not be computed', `The engine stopped with this message: ${esc(fail)}. Reset every setting, or reload the page.`); return; } }
      LV = live(); dirty = false; syncUI(force); FAST.forEach(run);
      if (whole) SLOW.forEach(run); else slow();
    }
    const later = debounce(() => render(), 140);
    /* something outside changed (live records, service line assumptions, the brand's dispatch point): draw now when shown, on the next show when hidden */
    const outside = debounce(() => { if (root.hidden) dirty = true; else render(); }, 200);

    /* ---------- wiring: every event is bound here, none in the markup ---------- */
    root.addEventListener('input', e => { const el = e.target; if (el.dataset && el.dataset.p && el.type !== 'checkbox') { if (el.type === 'range') readout(el); if (commit(el)) later(); } });
    root.addEventListener('change', e => { const el = e.target; if (!el.dataset) return;
      if (el.dataset.p) { if (commit(el)) render(); else syncUI(true); }
      else if (el.dataset.mix) { setMix(el.dataset.mix, el.value); render(true); }
      else if (el.id === 'h17Month') { if (el.value === '') delete st.P.month; else st.P.month = +el.value; save(); render(); }
      else if (el.id === 'h17Layer') { st.layer = el.value; save(); drawMap(); }
      else if (el.id === 'h17Bench') { st.bench = el.checked; save(); table(); } });
    root.addEventListener('click', e => { const b = e.target.closest('button'); if (!b || !root.contains(b)) return; const d = b.dataset;
      if (d.csv) saveCsv(d.csv);
      else if (d.x) saveX(d.x);
      else if (d.act === 'addpin') { if (toggleZip('pins', $('#h17PinIn', root).value, true)) $('#h17PinIn', root).value = ''; }
      else if (d.act === 'addblock') { if (toggleZip('blocks', $('#h17BlkIn', root).value, true)) $('#h17BlkIn', root).value = ''; }
      else if (d.act === 'pin' || d.act === 'unpin') toggleZip('pins', d.zip, d.act === 'pin');
      else if (d.act === 'block' || d.act === 'unblock') toggleZip('blocks', d.zip, d.act === 'block');
      else if (d.act === 'live') { st.scn = 'live'; render(); }
      else if (d.act === 'golive') goModule('live');
      else if (d.act === 'zdesk') { const hd = HX.hand(plan, 'all'), b = {}; if (isN(hd.bids[d.zip])) b[d.zip] = hd.bids[d.zip]; goModule('desk', { zips: [d.zip], line: hd.line, bids: b, note: `Heat Desk: ${d.zip} ${(ZI[d.zip] || {}).city || ''}`.trim() }); }
      else if (d.act === 'zlines') goModule('lines', { line: 'heat', zip: d.zip }); });
    wireSeg($('#h17Scn', root), v => { st.scn = F0 ? v : 'live'; render(); });
    wireSeg($('#h17Bid', root), v => { st.P.bidding = v; save(); render(); });
    wireSeg($('#h17Mode', root), v => {
      if (v === 'auto') { st.P.mode = 'auto'; st.mixSel = null; }
      else if (HX.PRESETS && HX.PRESETS[v]) { st.P.mode = 'custom'; st.P.mix = Object.assign({}, HX.PRESETS[v].mix); st.mixSel = v; }
      else { const m = {}; let acc = 0; IDS.forEach((id, i) => { m[id] = i === IDS.length - 1 ? Math.max(0, 100 - acc) : Math.round((PP.mode === 'custom' ? PP.mix[id] / 100 : plan.T.mix[id]) * 100); acc += m[id]; }); st.P.mode = 'custom'; st.P.mix = m; st.mixSel = 'custom'; }
      save(); render(true); });
    $('#h17Reset', root).onclick = () => { st.P = {}; st.scn = 'live'; st.mixSel = null; save(); render(true); toast('Every setting is back to its default'); };
    $('#h17SensGo', root).onclick = e => { const b = e.currentTarget; if (b.disabled) return; b.disabled = true; b.textContent = 'Solving about thirty plans';
      setTimeout(() => { try { st.sens = HX.variants(PP); st.sensKey = pkey(); } catch (err) { console.error('heat desk variants', err); toast('The one at a time table could not be computed'); } b.disabled = false; run(sure); }, 30); };
    $('#h17Find', root).addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); find(e.target.value); } });
    ['h17PinIn', 'h17BlkIn'].forEach(id => $('#' + id, root).addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $(`[data-act="${id === 'h17PinIn' ? 'addpin' : 'addblock'}"]`, root).click(); } }));
    function find(q) { q = String(q || '').trim(); if (!q) return; if (/^\d{5}$/.test(q)) { pick(q, true); return; } const lc = q.toLowerCase(), hit = plan.all.filter(r => String(r.city).toLowerCase() === lc).concat(plan.all.filter(r => String(r.city).toLowerCase().indexOf(lc) === 0)).sort((a, b) => b.dollars - a.dollars || a.min - b.min)[0]; if (hit) pick(hit.zip, true); else { st.sel = null; st.miss = q.slice(0, 12); zipCard(); toast(`Nothing on this map matches ${st.miss}`); } }
    $('#h17XPack', root).onclick = () => saveX('pack');
    $('#h17XGoogle', root).onclick = () => saveX('googleLocations');
    $('#h17XWeek', root).onclick = () => saveX('week');
    $('#h17XPlan', root).onclick = () => saveX('planByZip');
    $('#h17Desk', root).onclick = () => { if (!plan.T.zips) { toast('No ZIP is in the plan to send'); return; } goModule('desk', Object.assign(HX.hand(plan, 'all'), { note: `Heat Desk plan for ${plan.monthName}: ${plan.T.zips} ZIPs with their bid adjustments` })); };
    $('#h17Lines', root).onclick = () => goModule('lines', { line: 'heat' });
    $('#h17Wx', root).onclick = () => goModule('weather', { line: 'heat' });
    $('#h17Live', root).onclick = () => goModule('live');

    /* ---------- what the shell, the popup and the other modules send ---------- */
    this.receive = p => { if (p && p.zip != null) pick(String(p.zip), true); };
    this.fromRoute = arg => { if (arg != null && String(arg).trim()) pick(String(arg), true); };
    this.onShow = () => { if (dirty) render(); };
    BUS.on('theme', () => { if (!plan) return; [drawMap, ladder, season].forEach(run); });
    BUS.on('sl', outside); BUS.on('brand', outside);
    window.addEventListener('resize', debounce(() => { if (plan && (window.innerWidth < 760) !== st.slim) run(ladder); }, 150));          /* the ladder chart is drawn again when the window crosses the phone width */
    BUS.on('live', d => { if (d && (d.why === 'start' || d.why === 'settings')) return; outside(); });
    render(true, true);
  }
});
