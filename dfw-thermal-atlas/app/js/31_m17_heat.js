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
    const n0 = v => isN(v) ? N(v) : NA, n1 = v => isN(v) ? D(v, 1) : NA;
    const usd = v => isN(v) ? (v < 0 ? '-' : '') + '$' + N(Math.abs(v)) : NA;                     // table cells; prose says "returns $43"
    const pc = (f, d) => isN(f) ? P(f * 100, d || 0) : NA;                                        // a fraction as a percent
    const sg = v => isN(v) ? (Math.round(v) > 0 ? '+' : '') + Math.round(v) + '%' : NA;           // a bid adjustment in a cell
    const sgw = v => !isN(v) ? NA : Math.round(v) === 0 ? 'no change' : (v > 0 ? 'plus ' : 'minus ') + Math.abs(Math.round(v)) + '%';
    const mult = v => isN(v) ? D(v, 2) + '×' : NA;
    const clean = s => String(s == null ? '' : s).replace(/([A-Za-z])[‐-―−-]+(?=[A-Za-z])/g, '$1 ').replace(/\s*[‐-―−]+\s*/g, ', ');     // engine and publisher text
    const ec = s => esc(clean(s));
    const day = ymd => /^\d{4}-\d{2}-\d{2}/.test(String(ymd)) ? MON[+String(ymd).slice(5, 7) - 1] + ' ' + (+String(ymd).slice(8, 10)) + ', ' + String(ymd).slice(0, 4) : NA;
    const dshort = ymd => { const d = new Date(String(ymd).slice(0, 10) + 'T12:00:00Z'); return isNaN(d) ? NA : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()] + ' ' + MON[d.getUTCMonth()].slice(0, 3) + ' ' + d.getUTCDate(); };
    const list = a => a.length <= 1 ? a.join('') : a.length === 2 ? a.join(' and ') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
    const plural = (n, one, many) => N(n) + ' ' + (Math.round(n) === 1 ? one : many || one + 's');
    const today = () => { try { return TDA_LIVE.derive.localDay(new Date(), TDA_LIVE.geo.tz); } catch (e) { return new Date().toISOString().slice(0, 10); } };
    const gp = (o, path) => path.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
    const sp = (o, path, v) => { const ks = path.split('.'); let a = o; ks.slice(0, -1).forEach(k => { if (!a[k] || typeof a[k] !== 'object' || Array.isArray(a[k])) a[k] = {}; a = a[k]; }); a[ks[ks.length - 1]] = v; };
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
      <section class="hd-answer" id="h17Answer" aria-labelledby="h17AnsH" aria-live="polite"></section>
      <div class="kpis" id="h17Kpis"></div>
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
    let PP, plan, bands, F0, F, wk, ex = null, fail = '', dirty = false, lt = 0; const CSV = {};
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
    function live() {
      const L = window.TDA_LIVE || {}, B = window.__CLIMATE_BASE__ || null, now = new Date();
      const safe = (f, d) => { try { const v = f(); return v == null ? d : v; } catch (e) { return d; } };
      const recs = safe(() => LIVE.all(), {}), has = id => !!(L.BY_ID && L.BY_ID[id]);
      const rec = id => (has(id) && recs[id] && recs[id].data != null ? recs[id] : null), data = id => (rec(id) ? rec(id).data : null), at = id => (rec(id) ? rec(id).at || null : null);
      const season = safe(() => { const d = data('acis_season'); if (!d) return null; const s = L.climate.status(d, B, now); return s && s.ok ? Object.assign({ headline: L.climate.headline(s), at: at('acis_season') }, s) : null; }, null);
      const yearAgo = new Date(+now - 365 * 864e5).toISOString().slice(0, 10);
      const recalls = safe(() => { const d = data('cpsc_recalls'); if (!d || !Array.isArray(d.recalls)) return null; return { at: at('cpsc_recalls'), all: d.recalls.length, central: d.recalls.filter(r => r && r.d >= yearAgo && ['furnace', 'heatpump', 'boiler'].indexOf(r.kind) >= 0) }; }, null);
      return { now, base: B, has, rec, data, at, season, recalls,
        /* normal freeze nights a year by county and by ZIP, from the climate baseline baked into the build */
        freezeNights: safe(() => { const out = {}; (L.geo.counties || []).forEach(c => { const p = B.prismCounty[c.fips]; if (p && isN(p.fr32)) out[c.name] = p.fr32; }); return Object.keys(out).length ? out : null; }, null),
        zipNormal: zip => safe(() => B.zip[zip] || null, null),
        outlook: safe(() => outlookOf(data('cpc_outlook'), at('cpc_outlook')), null),
        prices: safe(() => pricesOf(data('bls_energy'), at('bls_energy')), null),
        rules: safe(() => rulesOf(data('fedreg_rules'), at('fedreg_rules')), null),
        licences: safe(() => licencesOf(data('tdlr_licenses'), at('tdlr_licenses')), null),
        permits: safe(() => permitsOf(['permits_dallas', 'permits_fortworth', 'permits_irving'].map(id => ({ id, d: data(id), at: at(id) })).filter(x => x.d)), null) };
    }
    /* The collectors below were still being written when this page was built. Each reader takes the record by meaning and
       returns null unless it finds what it needs, so a record that is missing or shaped differently hides its row. */
    function outlookOf(d, at) { return null; }
    function pricesOf(d, at) { return null; }
    function rulesOf(d, at) { return null; }
    function licencesOf(d, at) { return null; }
    function permitsOf(list) { return null; }
    /* ---------- the plan: controls built once from the engine's own ranges, so no control can ask for a value the engine refuses ---------- */
    const cid = p => 'h17c_' + p.replace(/\W/g, '_'), k100 = p => (R[p] && R[p].pct ? 100 : 1), r6 = v => +(+v).toFixed(6);
    const unitOf = p => { const u = (R[p] || {}).unit || ''; return u === 'x' ? '×' : u; };
    const lab = (p, alt) => alt || ec((R[p] && R[p].label) || p);
    const shownV = (p, v) => (isN(v) ? r6(v * k100(p)) : '');
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
        <div class="hd-f"><div class="hd-lr"><span class="fl" id="h17BidL">Bidding mode</span></div><div class="seg" id="h17Bid" role="group" aria-labelledby="h17BidL"><button type="button" data-v="manual">Manual or Maximize clicks</button><button type="button" data-v="smart">Smart Bidding</button></div><span class="hd-hint" id="h17BidH"></span></div>
        <div class="hd-f"><div class="hd-lr"><span class="fl">Local Services Ads</span></div>${chkF('lsaLive', 'Local Services Ads are live')}<span class="hd-hint">Off by default: the August 2026 roster shows no Local Services badge for the client. Switch it on once the profile is verified.</span></div>
        ${rngF('half.heat', { l: 'Reach, heating repair', hint: 'Drive minutes at which a repair lead is worth half.' })}
        ${rngF('half.furnace', { l: 'Reach, replacement', also: 'half.heatpump', hint: 'Furnace and heat pump replacement move together.' })}
        ${rngF('half.maint', { l: 'Reach, tune up', hint: 'A small ticket cannot carry a long drive.' })}
        ${rngF('reserve', { l: 'Freeze reserve', hint: 'Share of the month held back for cold weeks.' })}
        <div class="hd-f wide"><div class="hd-lr"><span class="fl" id="h17ModeL">Line mix</span>${G('D')}</div><div class="seg" id="h17Mode" role="group" aria-labelledby="h17ModeL"><button type="button" data-v="auto">Auto</button>${Object.keys(HX.PRESETS || {}).map(k => `<button type="button" data-v="${esc(k)}">${ec(HX.PRESETS[k].name)}</button>`).join('')}<button type="button" data-v="custom">Custom</button></div>
          <div class="hd-mix" id="h17Mix">${IDS.map(id => `<label for="h17Mix_${id}">${esc(NAMES[id])} (%)<input type="number" id="h17Mix_${id}" data-mix="${id}" min="0" max="100" step="1" inputmode="numeric"></label>`).join('')}</div><span class="hd-hint" id="h17ModeH"></span></div>
        <div class="hd-f"><div class="hd-lr"><label class="fl" for="h17PinIn">Pin a ZIP</label></div><div class="hd-ziprow"><input type="text" id="h17PinIn" inputmode="numeric" maxlength="5" placeholder="75150" autocomplete="off"><button type="button" class="btn sec sm" data-act="addpin">Pin</button></div><div class="hd-ziplist" id="h17Pins"></div><span class="hd-hint">A pinned ZIP is kept in every line that can reach it.</span></div>
        <div class="hd-f"><div class="hd-lr"><label class="fl" for="h17BlkIn">Block a ZIP</label></div><div class="hd-ziprow"><input type="text" id="h17BlkIn" inputmode="numeric" maxlength="5" placeholder="75201" autocomplete="off"><button type="button" class="btn sec sm" data-act="addblock">Block</button></div><div class="hd-ziplist" id="h17Blocks"></div><span class="hd-hint">A blocked ZIP gets nothing and goes into the exclusions file.</span></div>
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
      $('#h17Bench', root).checked = st.bench;
    }
    /* ---------- notices above the answer: what is simulated, what is missing ---------- */
    function gate() {
      const out = [], miss = [];
      if (fail) out.push(callout('', 'The plan could not be computed', `The engine stopped with this message: ${esc(fail)}. What shows below is the last plan that worked. Reset every setting if this followed a change you made.`));
      if (sim()) out.push(callout('judg', 'Simulation, not a forecast', `${ec(wk.label || 'A simulated week')}. The week card, the Monday list and the week sheet show invented lows built from the live ones, to see what the cold rules would do. The month plan does not change. <button type="button" class="lnk" data-act="live">Back to the live forecast</button>`));
      if (!F0) miss.push('<b>The forecast.</b> No seven night forecast is stored, so the week runs as a normal week and no cold rule fires. Live Data fetches it.');
      else if (F0.stale) miss.push(`<b>A fresh forecast.</b> The stored one is from ${esc(stamp(F0.at))}, more than 36 hours old, so the week runs as a normal week until it refreshes.`);
      if (plan.exposure.source === 'none') miss.push('<b>Normal cold by ZIP.</b> The climate baseline is not in this build, so cold exposure is 1 in every ZIP. Near Mesquite the effect is small.');
      if (miss.length) out.push(callout('note', 'What is missing right now', `<ul class="hooks">${miss.map(m => `<li>${m}</li>`).join('')}</ul>`));
      $('#h17Gate', root).innerHTML = out.join('');
    }
    function meta() {
      const T = plan.T;
      $('#h17M1', root).innerHTML = `<b>${N(T.zips)}</b> ${T.zips === 1 ? 'ZIP' : 'ZIPs'} in the plan`;
      $('#h17M2', root).innerHTML = `<b>${N(T.households)}</b> households in them`;
      $('#h17M3', root).innerHTML = `<b>${pc(T.share20)}</b> of the money within 20 minutes of the shop`;
      $('#h17M4', root).innerHTML = F0 ? `<b>Forecast</b> fetched ${esc(LIVE.ago(F0.at))}${F0.baseline ? ', the copy baked into this build' : ''}` : '<b>Forecast</b> not stored yet';
    }

    /* ---------- the answer: where, on what, this week, on Monday. Every number is read from the same plan and week the tables print. ---------- */
    function whyMix(lead) {
      const h = plan.line.heat, f = plan.line.furnace;
      if (plan.T.mode === 'custom') return `The split is yours: a custom mix of ${list(IDS.map(id => `${WORD[id]} ${N(PP.mix[id])}%`))}, each line filled on its own.`;
      if (lead.id === 'heat') return `Repair leads because ${plan.monthName} is a cold month for no heat calls (season index ${N(h.season)}, where 100 is an average month) and ads can win about ${P(h.sigma * 100, 1)} of repair jobs against ${P(f.sigma * 100, 1)} of furnace replacements. The replacement ZIPs fill up first and the money moves on to repair.`;
      if (h.season < 100) return `${WORD[lead.id].charAt(0).toUpperCase() + WORD[lead.id].slice(1)} leads this month because heating repair is out of season (index ${N(h.season)}, where 100 is an average month). Repair takes over with the first cold nights.`;
      return `The fill puts ${WORD[lead.id]} first this month; the line table shows what each line returns.`;
    }
    function answer() {
      const T = plan.T, L = plan.lines.filter(l => l.dollars > 0).sort((a, b) => b.dollars - a.dollars), cs = plan.counties.filter(c => c.dollars > 0);
      const city = {}; plan.zips.forEach(r => { city[r.city] = (city[r.city] || 0) + r.dollars; }); const cities = Object.keys(city).sort((a, b) => city[b] - city[a]).slice(0, 3);
      let where, what, week;
      if (!T.zips || !L.length) { where = `No ZIP clears the plan at ${usd(T.budget)} a month in ${plan.monthName}. Raise the budget, widen the reach or clear the blocked ZIPs.`; what = 'With nothing in the plan there is no line mix to report.'; }
      else {
        const far = plan.zips.reduce((a, b) => (b.min > a.min ? b : a));
        where = `Spend it close to the shop. At ${usd(T.budget)} a month in ${plan.monthName} the plan buys <b>${plural(T.zips, 'ZIP')}</b>, with <b>${pc(T.share20)}</b> of the money within 20 minutes of the dispatch point and nothing past <b>${N(T.farthest)} minutes</b> (${esc(far.city)} ${esc(far.zip)}). `
          + (cs.length === 1 ? `All of it lands in <b>${esc(cs[0].county)} County</b>. ` : `<b>${esc(cs[0].county)} County</b> takes ${pc(cs[0].share)}, then ${list(cs.slice(1, 4).map(c => `${esc(c.county)} ${pc(c.share)}`))}. `)
          + `The cities that lead are ${list(cities.map(esc))}.`
          + (T.unspent > 0.5 ? ` ${usd(T.unspent)} stays unspent: ${isN(T.hurdleAt) ? `past ${usd(T.hurdleAt)} a month ` : ''}the last dollar would bring back less than $${D(T.hurdle, 2)} of gross profit.` : '') + ` ${G(GR.spend || 'C')}`;
        what = `<b>${esc(L[0].name)}</b> leads with ${pc(L[0].share)} of the money (${usd(L[0].dollars)})${L.length > 1 ? ', then ' + list(L.slice(1).map(l => `${WORD[l.id]} ${pc(l.share)}`)) : ''}. ${whyMix(L[0])} ${G('D')}`;
      }
      if (wk.src === 'normal') week = `${wk.missing || !F0 ? 'No forecast is stored' : 'The stored forecast is more than 36 hours old'}, so the week runs as a normal ${esc(wk.monthName)} week: ${usd(wk.T.normal)} across the four lines and nothing drawn from the reserve.`;
      else {
        const h = wk.lines.find(l => l.id === 'heat') || wk.lines[0], rs = wk.reserve;
        week = `${simTag()}${wk.head && wk.head.headline ? ec(wk.head.headline) + '. ' : ''}Heating repair runs ${over(chg(h))} a normal ${esc(wk.monthName)} week${h.paused ? ' (paused)' : ''}. The week comes to <b>${usd(wk.T.week)}</b> against a normal ${usd(wk.T.normal)}, `
          + (rs.draw > 0.5 ? `drawing ${usd(rs.draw)} from the freeze reserve` : rs.back > 0.5 ? `returning ${usd(rs.back)} to the freeze reserve` : 'with nothing moving in or out of the freeze reserve') + '. '
          + (wk.trigger ? 'A cold trigger is on, so the ZIP list is recut for the week.' : 'No cold trigger: the ZIP list and the bids stay as they are.') + ` ${G('A/D')}`;
      }
      const monday = wk.list && wk.list.length ? ec(wk.list[0].text) : 'Nothing to change. Hold the month plan as it stands.';
      $('#h17Answer', root).innerHTML = `<h2 id="h17AnsH">The answer: where to spend, on what, and what to do on Monday</h2>
        <dl class="hd-ans"><dt>Where</dt><dd data-a="where">${where}</dd><dt>On what</dt><dd data-a="what">${what}</dd><dt>This week</dt><dd data-a="week">${week}</dd><dt>On Monday</dt><dd data-a="monday">${monday}</dd></dl>
        <p class="hd-fine"><b>Measured:</b> homes, heating fuel and system ages, the normal cold of each ZIP, the forecast and the alerts. <b>Stated:</b> how far a lead is worth driving, lead costs, close rates and the size of every cold response, all grade D and all editable below. The dollar outcomes are what those benchmarks imply, shown with their range. They are not a promise.</p>`;
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
        { l: 'Monthly heating media', g: GR.spend || 'C', v: usd(T.spent), d: T.unspent > 0.5 ? `${usd(T.unspent)} of ${usd(T.budget)} left unspent under the hurdle${isN(T.hurdleAt) ? `, which starts at ${usd(T.hurdleAt)} a month` : ''}` : `all of ${usd(T.budget)} placed, nothing left unspent; the last dollar returns $${D(T.lambda, 2)} in decision weights against a hurdle of $${D(T.hurdle, 2)}` },
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
      const rs = wk.reserve || {}, hd = wk.head || {}, normal = wk.src === 'normal';
      const nights = (wk.days || []).map(d => `<div class="hd-night"><div class="hd-nd">${ec(d.label || dshort(d.date))}</div><div class="hd-nl"><b>${isN(d.low) ? Math.round(d.low) + '°F' : NA}</b><span>at the shop</span></div><div class="hd-nr">${isN(d.metroMin) && isN(d.metroMax) ? (Math.round(d.metroMin) === Math.round(d.metroMax) ? `${Math.round(d.metroMin)}°F` : `${Math.round(d.metroMin)} to ${Math.round(d.metroMax)}°F`) + ' across the metro' : 'no metro range'}</div><div>${d.tierName ? `<span class="hd-chip t${clamp(Math.round(d.tier) || 0, 0, 4)}">${ec(d.tierName)}</span>` : ''}${d.alert ? ` <span class="hd-chip warn">${ec(d.alert === true ? 'alert' : d.alert)}</span>` : ''}${d.ice ? ' <span class="hd-chip warn">ice</span>' : ''}</div><div class="hd-nb"><b>${usd(d.repair)}</b> repair that day${isN(d.capUp) && d.capUp > 0 ? ` · bid caps +${Math.round(d.capUp)}%` : ''}</div></div>`).join('');
      const rows = wk.lines.map(l => tr([[esc(l.name), 'l'], usd(l.normal), `<b>${usd(l.week)}</b>`, sd(l.week - l.normal), mult(l.mult), [[l.paused ? 'paused this week' : '', l.carried ? 'keeps the lift of last week\'s cold' : '', l.added ? `${N(l.added)} ZIPs added` : '', l.dropped ? `${N(l.dropped)} paused` : ''].filter(Boolean).join(' · ') || `${n0(l.zips)} ZIPs`, 'l']]));
      rows.push(tr([['Total', 'l'], usd(wk.T.normal), `<b>${usd(wk.T.week)}</b>`, sd(wk.T.week - wk.T.normal), mult(wk.T.mult), [`${n0(wk.T.zips)} ZIPs · ${n0(wk.T.leads)} leads expected ${G('D')}`, 'l']], 'hd-total'));
      const zl = a => list(a.map(x => `${esc(x.zip)} ${esc(x.city || '')}`.trim()));
      const extra = [wk.added && wk.added.length ? `Added this week: ${zl(wk.added)}.` : '', wk.paused && wk.paused.length ? `Paused this week: ${zl(wk.paused)}.` : '', wk.crew && wk.crew.text ? ec(wk.crew.text) : '', wk.month !== plan.month ? `The week uses the ${esc(wk.monthName)} plan and its normal night; the plan card is set to ${esc(plan.monthName)}.` : ''].concat((wk.notes || []).map(n => ec(n.text))).filter(Boolean);
      $('#h17Week', root).innerHTML = `<p class="hd-weekhead">${simTag()}${ec(hd.headline || (normal ? `A normal ${wk.monthName} week` : 'The next seven nights'))}</p><p class="hd-weeksub">${hd.eyebrow ? `<b>${ec(hd.eyebrow)}.</b> ` : ''}${ec(hd.sub || '')}${normal ? ` ${wk.missing || !F0 ? 'No forecast is stored' : 'The stored forecast is more than 36 hours old'}, so every multiplier is 1 and nothing is drawn from the reserve.` : ''}</p>
        ${nights ? `<div class="hd-nights">${nights}</div>` : ''}
        <div class="hd-week2"><div><div class="dsec">The week by line ${G('D')}</div><div class="xscroll">${tbl([['Line', 1], ['Normal week'], ['This week'], ['Change'], ['Multiplier', 0, 'This week against a normal week of the month, on the line\'s own ZIPs'], ['Note', 1]], rows)}</div>
          <p class="hd-reserve"><b>Freeze reserve:</b> ${ec(rs.text || `${pc(rs.share)} of the month, ${usd(rs.month)}.`)}${rs.toDate && rs.toDate.text ? ' ' + ec(rs.toDate.text) : ''} The desk keeps no ledger from week to week: track the reserve against what the account actually spent. ${G(GR.reserve || 'D')}</p>
          ${extra.length ? `<ul class="hooks">${extra.map(x => `<li>${x}</li>`).join('')}</ul>` : ''}</div>
          <div><div class="dsec">Do this on Monday${wk.monday ? ', ' + esc(day(wk.monday)) : ''}</div>${wk.list && wk.list.length ? `<ol class="hd-monday">${wk.list.map(x => `<li>${ec(x.text)}</li>`).join('')}</ol>` : '<p class="hd-empty">Nothing to change. Hold the month plan as it stands.</p>'}</div></div>`;
      CSV.week = () => ['week', ['section', 'label', 'date', 'normal_week_usd', 'this_week_usd', 'change_usd', 'multiplier', 'low_f_at_shop', 'metro_low_min_f', 'metro_low_max_f', 'threshold', 'repair_usd_that_day'],
        wk.lines.map(l => ['line', l.name, '', Math.round(l.normal), Math.round(l.week), Math.round(l.week - l.normal), r6(l.mult), '', '', '', '', '']).concat((wk.days || []).map(d => ['night', d.label || '', d.date || '', '', '', '', '', isN(d.low) ? Math.round(d.low) : '', isN(d.metroMin) ? Math.round(d.metroMin) : '', isN(d.metroMax) ? Math.round(d.metroMax) : '', d.tierName || '', Math.round(d.repair)])),
        `${sim() ? 'SIMULATION, not a forecast. ' : ''}Week of ${day(wk.monday || wk.today || today())}. Forecast lows grade A; multipliers and budgets grade D.`];
    }
    /* ---------- map: l label, v value of a ZIP record, f formatter, g grade; cat lists the classes of a layer that is words, not numbers ---------- */
    const wxz = zip => (wk && wk.wx && wk.wx.ok && wk.wx.byZip ? wk.wx.byZip[zip] || null : null);
    const cellOf = (r, id) => (r && r.lines ? r.lines[id] || null : null);
    const HL = {
      share: { l: 'Budget share (% of the plan)', ramp: 'ember', g: GR.spend || 'C', v: r => (r.inPlan ? r.share * 100 : null), f: v => P(v, 1), note: 'Where the dollars are expected to land. Gray ZIPs are not in the plan.' },
      bid: { l: 'Location bid adjustment (%)', div: 1, g: GR.bid || 'D', v: r => (r.inPlan ? r.bid : null), f: sg, note: 'What a click is worth here against the campaign average. Cost decides whether a ZIP is bought; value decides the bid.' },
      tier: { l: 'Drive tier', g: GR.minutes || 'C', cat: HX.TIERS.map(t => [t.id, `${t.id}: ${t.words}`]), v: r => r.tier, note: 'Drive minutes are 5 plus the straight line kilometres from the dispatch point.' },
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
      const rows = IDS.map(id => { const c = cellOf(r, id), L = plan.line[id]; if (!c) return tr([[esc(SHORT[id]), 'l'], NA, NA, NA, NA, NA, NA, NA]);
        return tr([[esc(SHORT[id]), 'l'], n1(c.J), c.R > 0 ? D(c.R, 2) : 'out', D(c.cost, 2), c.R > 0 ? `$${D(c.rho, 2)}` : NA, isN(L.lambdaRaw) ? `$${D(L.lambdaRaw, 2)}` : NA, c.spend > 0 ? `<b>${usd(c.spend)}</b>` : `<span class="mini">${esc(STATE[c.state] || (c.capped ? 'cut by the ZIP cap' : 'not funded'))}</span>`, c.spend > 0 ? `${sg(c.bid)} · ${pc(c.conf)}` : NA]); });
      const w = wxz(r.zip), wr = wk && wk.plan && wk.plan.at ? wk.plan.at[r.zip] : null, zn = live().zipNormal(r.zip), lev = SLM.LEV[r.zip] || {}, hdd = plan.exposure && HX.exposure ? (HX.exposure().hdd || {})[r.zip] : null;
      const tags = [r.fuel === 'gas' ? 'Gas led: furnace, igniter and carbon monoxide copy' : r.fuel === 'electric' ? 'Electric led: heat pump, auxiliary heat and electric bill copy' : 'Mixed fuel: run both message sets', lev.es >= 15 ? `Spanish build, suggested share ${N(lev.es)}%` : '', lev.fin >= 60 ? 'Payment led: monthly payment creative belongs in the financing radius campaign' : ''].filter(Boolean);
      body.innerHTML = `<p class="hd-why">${status}</p>${r.inPlan && r.why ? `<p class="hd-why">${ec(r.why)}.</p>` : ''}
        <div class="dsec">The four lines this month ${G('D')}</div><div class="xscroll">${tbl([['Line', 1], ['Jobs', 0, 'Jobs this month a homeowner ad can reach'], ['Reach', 0, '1 at the door, 0.5 at the half value drive'], ['Cost', 0, 'Cost index: 1 is the metro'], ['Return', 0, 'Gross profit the first ad dollar brings back, pipeline included'], ['Cut', 0, 'What the line\'s last dollar brings back'], ['$ a month'], ['Bid · conf.', 0, 'The line\'s own bid adjustment and the chance the return clears the cut']], rows, 'keep')}</div>
        ${w ? `<div class="dsec">${sim() ? 'Simulated lows' : 'Forecast lows'} at this ZIP ${G(sim() ? 'D' : 'A')}</div><div class="hd-lows">${w.lows.map((t, i) => `<div>${esc(dshort((wk.wx.dates || [])[i] || '').split(' ').slice(0, 1).join(''))}<b>${isN(t) ? Math.round(t) + '°' : NA}</b></div>`).join('')}</div><div class="rowl" style="margin-top:6px"><span>Repair multiplier this week${w.first ? ' · first freeze' : ''}${w.alert ? ' · ' + ec(w.alert === true ? 'alert' : w.alert) : ''}${w.storm ? ' · storm reach' : ''}</span><b>${mult(w.W)}</b></div>${wr ? `<div class="rowl"><span>This week's dollars here</span><b>${usd(wr.dollars)}</b></div>` : ''}` : ''}
        <div class="dsec">What is in the homes</div>
        <div class="rowl"><span>Gas furnaces · past 20 years ${G('B')}</span><b>${N(z.furn)} · ${N(z.furn20)}</b></div><div class="rowl"><span>Heat pumps · electric furnaces ${G('B')}</span><b>${N(z.sys_hp)} · ${N(z.sys_ef)}</b></div>
        <div class="rowl"><span>Heating fuel: gas · electricity ${G('A')}</span><b>${P(z.gas_sh, 0)} · ${P(z.elec_sh, 0)}</b></div><div class="rowl"><span>Systems where a homeowner decides ${G('C')}</span><b>${pc(r.who)}</b></div>
        <div class="rowl"><span>Cold exposure${isN(hdd) ? ` · normal heating degree days` : ''} ${G(GR.exposure || 'C')}</span><b>${D(r.x, 2)}${isN(hdd) ? ' · ' + N(hdd) : ''}</b></div>${zn && isN(zn.fr32) ? `<div class="rowl"><span>Freeze nights in a normal year ${G('C')}</span><b>${D(zn.fr32, 0)}</b></div>` : ''}
        <div class="rowl"><span>Cost index · competitor pressure percentile ${G('D')}</span><b>${D(r.cost, 2)} · ${N(r.pressure)}</b></div>
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
        { k: 'min', h: 'Min', t: 'Drive minutes: 5 plus straight line kilometres (grade C)', f: v => N(v) }, { k: 'tier', h: 'Tier', l: 1, t: 'Drive tier: Core 20 minutes or less, Ring 20 to 35, Far over 35', f: (v, r) => (r.bench ? '<span class="hd-lab bench">Bench</span> ' : '') + tierLab(v) },
        { k: 'share', h: 'Share', t: 'Share of the plan\'s dollars (grade C)', f: v => (isN(v) ? `<span class="hd-sharebar"><i style="width:${clamp(v / Math.max(1, plan.zips[0] ? plan.zips[0].share * 100 : 1) * 100, 2, 100).toFixed(0)}%"></i></span>${P(v, 2)}` : '') },
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
        hs.map(h => tr([[`<b>${esc(h.zip)}</b>`, 'l'], [esc(h.city), 'l'], N(h.min), N(h.households), n0(h.pressure), isN(h.cost) ? D(h.cost, 2) : NA, pc(h.who), [ec(h.reason), 'l hd-whyc'], isN(h.enterAt) ? usd(h.enterAt) : '', [h.code === 'blocked' ? `<button type="button" class="btn sec sm" data-act="unblock" data-zip="${esc(h.zip)}" aria-label="Unblock ${esc(h.zip)} ${esc(h.city)}">Unblock</button>` : `<button type="button" class="btn sec sm" data-act="pin" data-zip="${esc(h.zip)}" aria-label="Pin ${esc(h.zip)} ${esc(h.city)}">Pin</button>`, 'l']], h.zip === st.sel ? 'sel' : '')))}</div>` : '<p class="hd-empty">Every ZIP within 25 minutes of the shop is in the plan.</p>';
      CSV.held = () => ['held-back', ['zip', 'city', 'county', 'drive_minutes', 'households', 'pressure_percentile', 'cost_index', 'homeowner_share_pct', 'code', 'why_held', 'enters_at_monthly_usd'], hs.map(h => [h.zip, h.city, h.county, Math.round(h.min), Math.round(h.households), isN(h.pressure) ? Math.round(h.pressure) : '', isN(h.cost) ? r6(h.cost.toFixed(3)) : '', isN(h.who) ? Math.round(h.who * 100) : '', h.code, clean(h.reason), isN(h.enterAt) ? Math.round(h.enterAt) : '']), `ZIPs within 25 minutes of the shop that the plan holds back at ${usd(plan.T.budget)} a month in ${plan.monthName}. Reasons are the engine's own words.`];
    }
    /* ---------- by line and what to build ---------- */
    const rbar = (r, v) => { if (!r || !(r[2] > r[0])) return ''; const lo = r[0] * 0.8, hi = r[2] * 1.15, x = q => clamp((q - lo) / (hi - lo) * 100, 0, 100); return `<span class="hd-rng" aria-hidden="true"><i style="left:${x(r[0]).toFixed(1)}%;width:${(x(r[2]) - x(r[0])).toFixed(1)}%"></i><b style="left:calc(${x(isN(v) ? v : r[1]).toFixed(1)}% - 1px)"></b></span>`; };
    const platWords = pl => HX.PLATS.filter(p => pl && pl[p] > 0.004).map(p => `${HX.PLAT_NAMES[p]} ${pc(pl[p])}`).join(', ');
    function lines() {
      const T = plan.T, cust = T.mode === 'custom';
      const head = [['Line', 1], ['Share'], ['$ a month'], ['ZIPs'], ['Leads'], ['Leads, range', 0, '10th to 90th percentile of 120 replays'], ['Cost per lead'], ['Booked jobs'], ['Jobs, range'], ['Gross profit, direct'], ['Direct, range'], ['With pipeline'], ['With pipeline, range'], ['Farthest', 0, 'Minutes to the farthest funded ZIP'], ['Largest ZIP', 0, 'The largest ZIP as a share of the line'], ['Platforms', 1]];
      const row = (l, cls) => tr([[`<b>${esc(l.name)}</b>${cust && isN(l.target) ? ` <span class="mini">asked ${pc(l.target)}</span>` : ''}`, 'l'], pc(l.share), usd(l.dollars), n0(l.zips), n1(l.leads), rng(l.rl, n1), usd(l.cpl), n1(l.jobs), rng(l.rj, n1), usd(l.gpDirect), rng(l.rd, usd), usd(l.gp), rng(l.rg, usd), l.farthest == null ? '' : n0(l.farthest) + ' min', l.topShare == null ? '' : pc(l.topShare), [l.pw || '', 'l']], cls);
      const rows = plan.lines.map(l => row(Object.assign({}, l, { rl: lband(l.id, 'leads'), rj: lband(l.id, 'jobs'), rd: lband(l.id, 'gpDirect'), rg: lband(l.id, 'gp'), pw: esc(platWords(l.plat)) })));
      rows.push(row({ name: 'Total', share: T.budget ? T.spent / T.budget : 0, dollars: T.spent, zips: T.zips, leads: T.leads, rl: band('leads'), cpl: T.cpl, jobs: T.jobs, rj: band('jobs'), gpDirect: T.gpDirect, rd: band('gpDirect'), gp: T.gp, rg: band('gp'), farthest: T.farthest, topShare: plan.zips[0] ? plan.zips[0].share : null, pw: '' }, 'hd-total'));
      const notes = (plan.notes || []).map(n => ec(n.text));
      $('#h17LinesT', root).innerHTML = `<div class="xscroll">${tbl(head, rows)}</div><p class="hd-note">Every dollar outcome is grade D: module 12's stated lead costs, close rates, tickets and margins. ${G('D')} A repair ad pays back little in repair gross profit alone; most of its value is the replacement it may become, which is why the two gross profit columns are kept apart. ${cust ? 'Custom mix: each line is filled on its own.' : `The cut this month is $${D(T.lambda, 2)} in decision weights; each line's own last dollar returns ${list(plan.lines.filter(l => l.dollars > 0 && isN(l.lambdaRaw)).map(l => `$${D(l.lambdaRaw, 2)} (${WORD[l.id]})`))} of modeled gross profit.`}</p>${notes.length ? `<ul class="hooks">${notes.map(n => `<li>${n}</li>`).join('')}</ul>` : ''}`;
      CSV.lines = () => ['by-line', ['line', 'share_pct', 'monthly_usd', 'zips', 'leads', 'leads_p10', 'leads_p90', 'cost_per_lead_usd', 'booked_jobs', 'jobs_p10', 'jobs_p90', 'gross_profit_direct_usd', 'gp_direct_p10', 'gp_direct_p90', 'gross_profit_with_pipeline_usd', 'gp_pipeline_p10', 'gp_pipeline_p90', 'farthest_minutes', 'largest_zip_share_pct', 'platforms'],
        plan.lines.map(l => { const b = k => lband(l.id, k) || ['', '', '']; const q = v => (isN(v) ? r6((+v).toFixed(2)) : ''); return [l.name, q(l.share * 100), Math.round(l.dollars), l.zips, q(l.leads), q(b('leads')[0]), q(b('leads')[2]), q(l.cpl), q(l.jobs), q(b('jobs')[0]), q(b('jobs')[2]), Math.round(l.gpDirect), q(b('gpDirect')[0]), q(b('gpDirect')[2]), Math.round(l.gp), q(b('gp')[0]), q(b('gp')[2]), isN(l.farthest) ? Math.round(l.farthest) : '', q(l.topShare * 100), platWords(l.plat)]; }),
        `Heat Desk by line, ${plan.monthName}, ${usd(T.budget)} a month. Leads, jobs and gross profit grade D with the 10th and 90th percentile of 120 replays. Direct is the first ticket; with pipeline adds module 12's replacement credit.`];
      /* campaigns */
      const cs = plan.campaigns || [];
      $('#h17Camps', root).innerHTML = cs.length ? `<div class="xscroll">${tbl([['Campaign', 1], ['Lines', 1], ['Tier', 1], ['Platform', 1], ['ZIPs'], ['$ a month'], ['Daily budget'], ['Bid strategy', 1], ['First target cost per lead'], ['Bid cap'], ['Location bids'], ['Leads'], ['Status', 1], ['Note', 1]],
        cs.map(c => tr([[`<span class="mono">${esc(c.name)}</span>`, 'l'], [esc((c.lines || []).map(id => SHORT[id] || id).join(', ')), 'l'], [c.tier ? tierLab(c.tier) : 'all', 'l'], [esc(HX.PLAT_NAMES[c.platform] || c.platform || ''), 'l'], n0(c.zips), usd(c.budget), usd(c.daily), [ec(c.strategy || ''), 'l'], isN(c.targetCpa) ? usd(c.targetCpa) : '', isN(c.maxCpc) ? '$' + D(c.maxCpc, 2) : '', isN(c.bidMin) && isN(c.bidMax) && PP.bidding !== 'smart' ? `${sg(c.bidMin)} to ${sg(c.bidMax)}` : 'none', n1(c.leads), [ec(c.status || 'Paused'), 'l'], [ec(c.note || ''), 'l hd-whyc']])))}</div><p class="hd-note">${PP.bidding === 'smart' ? 'Smart Bidding mode: one campaign per drive tier, because budget and target are the only geographic levers Smart Bidding leaves. Switch a campaign over once it has 30 conversions in 30 days.' : 'Manual mode: one campaign per line with location bid adjustments by ZIP. Maximize conversions, target cost per lead and target return bidding ignore those adjustments.'} Every campaign is exported paused. ${G('D')}</p>` : '<p class="hd-empty">No campaign clears its minimum at this budget.</p>';
      CSV.camps = () => ['campaigns', ['campaign', 'lines', 'drive_tier', 'platform', 'zips', 'monthly_usd', 'daily_usd', 'bid_strategy', 'first_target_cost_per_lead_usd', 'max_cpc_usd', 'bid_min_pct', 'bid_max_pct', 'leads', 'status', 'note'], cs.map(c => [c.name, (c.lines || []).join(' '), c.tier || '', c.platform || '', c.zips, Math.round(c.budget), isN(c.daily) ? r6((+c.daily).toFixed(2)) : '', clean(c.strategy || ''), isN(c.targetCpa) ? Math.round(c.targetCpa) : '', isN(c.maxCpc) ? r6((+c.maxCpc).toFixed(2)) : '', isN(c.bidMin) ? c.bidMin : '', isN(c.bidMax) ? c.bidMax : '', isN(c.leads) ? r6((+c.leads).toFixed(1)) : '', c.status || 'Paused', clean(c.note || '')]), `Heat Desk campaigns for ${plan.monthName}, ${PP.bidding === 'smart' ? 'Smart Bidding' : 'manual bidding'} mode. Every campaign is paused. Budgets and targets grade D.`];
      /* platforms */
      const ps = plan.platforms || [];
      $('#h17Plats', root).innerHTML = `<div class="xscroll">${tbl([['Platform', 1], ['$ a month'], ['Share'], ['By line', 1], ['Minimum', 0, 'A platform under its monthly minimum folds into Google Search'], ['Folded', 1], ['How it is targeted', 1]],
        ps.map(p => tr([[`<b>${esc(p.name)}</b>`, 'l'], usd(p.dollars), pc(p.share), [esc(IDS.filter(id => p.lines && p.lines[id] > 0.5).map(id => `${SHORT[id]} ${usd(p.lines[id])}`).join(', ') || 'nothing this month'), 'l'], isN(p.min) && p.min > 0 ? usd(p.min) : 'none', [(p.folded || []).map(f => `${esc(SHORT[f.line] || f.line)} ${usd(f.dollars)} to ${esc(HX.PLAT_NAMES[f.to] || f.to)}: ${ec(f.why)}`).join('; ') || '', 'l hd-whyc'], [ec(p.how || ''), 'l hd-whyc']])))}</div>`;
      CSV.plats = () => ['platforms', ['platform', 'monthly_usd', 'share_pct', 'minimum_usd'].concat(IDS.map(id => id + '_usd')).concat(['folded', 'how_targeted']), ps.map(p => [p.name, Math.round(p.dollars), r6((p.share * 100).toFixed(2)), isN(p.min) ? p.min : ''].concat(IDS.map(id => Math.round((p.lines || {})[id] || 0))).concat([(p.folded || []).map(f => `${f.line} ${Math.round(f.dollars)} to ${f.to}: ${clean(f.why)}`).join('; '), clean(p.how || '')])), `Heat Desk platforms for ${plan.monthName}. Minimums are fold notes: they move a line's money between platforms and never change the ZIP money.`];
      /* Local Services: off until the badge is verified; say what switching it on is worth */
      const k = pkey(); if (st.lsaKey !== k) { st.lsaKey = k; st.lsaAdd = null; try { const q = HX.plan(HX.set(PP, 'lsaLive', !PP.lsaLive), { lite: true }); st.lsaAdd = { leads: q.T.leads, heat: q.line.heat.leads, cpl: q.line.heat.cpl }; } catch (e) { st.lsaAdd = null; } }
      const a = st.lsaAdd, h = plan.line.heat, lsa = ps.find(p => p.id === 'lsa');
      $('#h17Lsa', root).innerHTML = callout('note tight', PP.lsaLive ? 'Local Services Ads are in the plan' : 'Local Services Ads are off', PP.lsaLive
        ? `${lsa ? `${usd(lsa.dollars)} a month runs there. ` : ''}One profile, one service area, a weekly budget and a price per lead: no bid adjustment and no ZIP by line. The sheet in the files below lists the ZIPs, the job types and the verification steps.${a ? ` Without it the same money buys ${n1(a.heat)} repair leads a month at ${usd(a.cpl)} instead of ${n1(h.leads)} at ${usd(h.cpl)}.` : ''} ${G('D')}`
        : `The August 2026 roster shows no Local Services badge for the client, so the plan spends nothing there and folds that share into Google Search.${a ? ` Switched on, the same money would buy about ${n1(a.heat)} repair leads a month at ${usd(a.cpl)} instead of ${n1(h.leads)} at ${usd(h.cpl)}, and ${n0(a.leads)} leads in all against ${n0(T.leads)}.` : ''} Verify the profile, then tick the box in the plan. ${G('D')}`);
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
      const fz = LV.freezeNights, lic = LV.licences, perm = LV.permits, cs = plan.counties || [];
      const head = [['County', 1], ['Share'], ['$ a month'], ['ZIPs in the plan'], ['Leads'], ['ZIPs within 60 min', 0, 'ZIPs a truck reaches within 60 minutes, of all the county\'s ZIPs'], ['Median drive', 0, 'Median drive minutes of the county\'s ZIPs (grade C)'], ['Households'], ['Cold exposure', 0, '1 is the metro mean (grade C)']].concat(fz ? [['Freeze nights a year', 0, 'Normal nights at 32°F or lower, 1991 to 2020 grid (grade C)']] : []).concat([['Gas heat', 0, 'Homes heated with gas (grade A)']]).concat(lic ? [['Licensed contractors per 10,000 households', 0, 'State licence file (grade A)']] : []).concat(perm ? [['Observed heating season permits', 0, 'Where a city publishes them (grade A)']] : []);
      $('#h17Cty', root).innerHTML = `<div class="xscroll">${tbl(head, cs.map(c => tr([[`<b>${esc(c.county)}</b>`, 'l'], pc(c.share, 1), usd(c.dollars), n0(c.zips), n1(c.leads), `${n0(c.zipsReach)} of ${n0(c.zipsAll)}`, isN(c.medianMin) ? N(c.medianMin) + ' min' : NA, n0(c.households), isN(c.exposure) ? D(c.exposure, 2) : NA].concat(fz ? [isN(fz[c.county]) ? D(fz[c.county], 0) : NA] : []).concat([isN(c.gasPct) ? P(c.gasPct, 0) : NA]).concat(lic ? [isN(lic.by[c.county]) ? D(lic.by[c.county], 1) : NA] : []).concat(perm ? [isN(perm.by[c.county]) ? N(perm.by[c.county]) : 'none published'] : []), c.dollars > 0 ? '' : 'hd-benchrow')))}</div>`;
      const zero = cs.filter(c => !(c.dollars > 0)).sort((a, b) => b.households - a.households)[0], near = zero ? plan.all.filter(r => r.county === zero.county).reduce((a, b) => (!a || b.min < a.min ? b : a), null) : null;
      $('#h17CtyN', root).innerHTML = (zero && near ? `<b>Why nothing in ${esc(zero.county)} County</b> (${N(zero.households)} households): its closest ZIP, ${esc(near.city)} ${esc(near.zip)}, is ${N(near.min)} minutes from the shop and the median is ${n0(zero.medianMin)}; ${n0(zero.zipsReach)} of its ${n0(zero.zipsAll)} ZIPs are within 60 minutes. At this budget what is close is not used up, so the money does not travel. ` : 'Every county in reach has a ZIP in the plan. ') + `Shares and dollars ${G(GR.spend || 'C')} leads ${G('D')} drive minutes ${G('C')} gas heat ${G('A')}${lic ? '' : ' Licensed contractors by county appear here once the state licence record is stored.'}${perm ? '' : ' Observed permits appear once a city permit record is stored.'}`;
      CSV.counties = () => ['counties', ['county', 'share_pct', 'monthly_usd', 'zips_in_plan', 'leads', 'zips_within_60_min', 'zips_all', 'median_drive_minutes', 'households', 'cold_exposure', 'freeze_nights_normal_year', 'gas_heat_pct'], cs.map(c => [c.county, r6((c.share * 100).toFixed(2)), Math.round(c.dollars), c.zips, isN(c.leads) ? r6((+c.leads).toFixed(1)) : '', c.zipsReach, c.zipsAll, isN(c.medianMin) ? Math.round(c.medianMin) : '', Math.round(c.households), isN(c.exposure) ? r6((+c.exposure).toFixed(3)) : '', fz && isN(fz[c.county]) ? r6((+fz[c.county]).toFixed(1)) : '', isN(c.gasPct) ? Math.round(c.gasPct) : '']), `Heat Desk by county, ${plan.monthName}, ${usd(plan.T.budget)} a month. Shares grade C; leads grade D; cold exposure and freeze nights grade C; gas heat grade A.`];
    }

    /* ---------- cold rules ---------- */
    function rules() {
      const rs = (wk && wk.rules) || (HX.rules ? HX.rules(PP) : []);
      $('#h17Rules', root).innerHTML = rs.length ? `<div class="xscroll">${tbl([['Trigger', 1], ['Threshold', 1], ['Budget', 1], ['Bids', 1], ['Hours', 1], ['Creative', 1], ['Size', 1], ['Grade', 1], [sim() ? 'In this simulation' : 'This week', 1]],
        rs.map(r => tr([[`<b>${ec(r.trigger)}</b>`, 'l'], [ec(r.threshold), 'l'], [ec(r.budget), 'l'], [ec(r.bids), 'l'], [ec(r.hours), 'l'], [ec(r.creative), 'l'], [ec(r.size), 'l'], [r.grade ? ec(r.grade).split(/\s*,\s*|\s+and\s+/).map(g => (/^[A-D]$/.test(g) ? G(g) : g)).join(' ') : '', 'l'], [r.off ? `<span class="hd-chip">off</span>${typeof r.off === 'string' ? ' ' + ec(r.off) : ''}` : r.fired ? '<span class="hd-chip t3">fired</span>' : '<span class="mini">not fired</span>', 'l']])), 'prose')}</div><p class="hd-note">Location bid adjustments never change with the weather: cold raises what every click is worth by about the same factor everywhere, so the money moves through budgets and bid caps.</p>` : '<p class="hd-empty">The engine publishes no cold rule in this build.</p>';
      CSV.rules = () => ['cold-rules', ['trigger', 'threshold', 'budget', 'bids', 'hours', 'creative', 'size', 'grade', 'fired_this_week', 'off'], rs.map(r => [r.trigger, r.threshold, r.budget, r.bids, r.hours, r.creative, r.size, r.grade, r.fired ? 'yes' : 'no', r.off ? (typeof r.off === 'string' ? r.off : 'yes') : ''].map(v => (typeof v === 'string' ? clean(v) : v == null ? '' : v))), `Heat Desk cold rules${sim() ? ', SIMULATED week' : ''}. Thresholds grade C; forecast and alerts grade A; every size grade D.`];
    }
    /* ---------- prose: how it is built, the judgment calls, what is left out, caveats, sources ---------- */
    function prose(V) {
      const P = V.P, pctOf = v => Math.round(v * 100) + '%';
      $('#h17Meth', root).innerHTML = [
        `<b>One cell per ZIP per line.</b> Four lines (heating repair, gas furnace replacement, heat pump replacement, tune up and safety check) in each of the ${N(ZR.length)} residential ZIPs. Jobs this month are module 12's jobs a year, times the share of systems where a homeowner decides (an owner occupied house counts 1, a rented house 0.6, an apartment 0.25), times the month's season index and the ZIP's cold exposure. ${G('B/D')}`,
        `<b>Reach.</b> Drive minutes are 5 plus the straight line kilometres from the dispatch point (${esc(V.origin.label)}). A lead is worth full value at the door and half at the half value drive: ${N(P.half.heat)} minutes for repair, ${N(P.half.furnace)} for replacement, ${N(P.half.maint)} for a tune up. A line is not sold where reach falls under ${D(P.cut, 2)}. ${G('C/D')}`,
        `<b>What can be won.</b> Only jobs that start with a paid click can be bought (repair ${pctOf(P.paid.heat)}, furnace ${pctOf(P.paid.furnace)}, heat pump ${pctOf(P.paid.heatpump)}, tune up ${pctOf(P.paid.maint)}), and one advertiser wins at most ${pctOf(P.cap)} of those. That ceiling is why a ZIP gets dearer the more of it is already bought. ${G('D')}`,
        `<b>Cost per lead.</b> The line's metro cost per lead (module 12's platform costs, blended over the platforms in use) times a cost index for the ZIP: its relative click cost and the line's competitor pressure, each believed at ${D(P.trust, 2)} strength because both measure where competitor shops sit, not what an auction costs. ${G('D')}`,
        `<b>Return.</b> Gross profit per job (the first ticket plus ${pctOf(P.pipeCredit)} of module 12's replacement pipeline credit) times the close rate and reach, over the cost per lead: what the first ad dollar in the cell brings back. ${G('D')}`,
        `<b>One fill across the four lines.</b> Each next dollar goes where it earns most. The return is not known to better than about ${pctOf(P.doubt)}, so the fill averages over that doubt instead of betting on a ranking it cannot defend, and the gap between lines is believed at ${D(P.gamma, 2)} strength for the decision only. Reported gross profit is never shrunk. ${G('C')}`,
        `<b>Guards.</b> The last dollar must bring back ${M$(P.hurdle)} of gross profit or it stays unspent. No ZIP takes more than ${pctOf(P.zipCap)} of the plan. ZIPs within ${N(P.coreMin)} minutes stay in the repair and tune up buys. A ZIP that would get under ${D(P.depth, 1)} of a lead a month in a line is dropped from that line. Pins and blocks are honored first.`,
        `<b>Ranges.</b> The plan as solved is replayed in 120 seeded worlds in which lead costs, close rates, paid shares, the advertiser cap, the pipeline credit, reach and jobs all move inside stated bounds. The 10th and 90th percentile are the range printed beside every outcome; the same worlds are used for every plan, so two plans differ by their inputs and never by the dice. ${G('D')}`,
        `<b>The week.</b> Each forecast low gets a weight (a 40°F night is 1) and a ZIP's week is its seven nights against the month's normal night, read from its three nearest forecast points. Repair follows the cold one for one, replacement by a third to a half, tune ups the other way. Alerts set a floor by county. Anything above a normal week draws on the freeze reserve; anything below goes back. ${G('A/D')}`,
      ].map(x => `<li>${x}</li>`).join('');
      $('#h17Judg', root).innerHTML = judgList([
        ['Reach is a policy, not an estimate', 'The owner decides how far a truck goes for a no heat call. The three sliders are the first controls on the page and the held back table shows what each choice leaves out.'],
        ['Stated indexes enter at half strength', 'Relative click cost and competitor pressure are priors until the account measures them. At full strength they push the plan out to Forney and Rockwall; at zero they pull it into Lakewood and the Park Cities.'],
        ['The desk believes a quarter of the gap between lines', 'Module 12 makes a heat pump lead worth far more per dollar than a repair lead, on stated lead costs and close rates. Trusted in full that would starve repair in a freeze. The decision uses a quarter of the gap; the reported dollars use all of it.'],
        ['Pipeline is shown apart', 'Three quarters of the gross profit of a repair call is the replacement it may become. Every table prints direct gross profit and gross profit with pipeline in separate columns.'],
        ['Budgets follow the weather, bids follow value', 'Cold raises how many people search, not what a job is worth, so location bid adjustments never move with the forecast. The money moves through daily budgets and bid caps.'],
        ['No ZIP is lowered for who lives there', 'There is no income, race, ethnicity or age term anywhere in the scoring. The ticket by ZIP comes from permit valuations in module 12 and is the only place home value enters.'],
        ['A hurdle instead of spending to the last dollar', `Under ${M$(P.hurdle)} of gross profit on the last ad dollar the rest of the budget is left unspent and the page says how much.`],
        ['Local Services Ads stay off until verified', 'The August 2026 roster shows no Local Services badge for the client. The switch is in the plan; the sheet lists the steps still open.'],
        ['A ZIP list is frozen in a week without a cold trigger', 'Changing location targets every Monday resets learning for nothing. Without a trigger only the money moves; with one, ZIPs can join and leave only when a line is paused or out of reach.'],
        ['The reserve keeps no ledger', 'The week card shows what this week draws or returns against a normal week. What the account actually spent is the owner\'s number; the desk does not pretend to know it.'],
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
        ['Competition is the August 2026 roster', 'A ZIP with no mapped competitor is not a ZIP without competitors.'],
        ['The cold response has not been fitted to a call log', 'Night weights and line responses are shaped on degree days. The only measured anchors are the permit regressions in module 04 and a published heat wave study.'],
        ['Simulations are not forecasts', 'The scenario selector reruns the week on invented lows built from the live ones. It shows what the rules would do, not what the weather will.'],
      ]);
    }

    /* ---------- sections still to be filled: each draws nothing yet and never throws ---------- */
    function ladder() {}
    function season() {}
    function signals() {}
    function sure() {}
    function sources() {}

    /* ---------- one render: compute, then every block from the same plan and week ---------- */
    let LV = live();
    const BLOCKS = [gate, meta, answer, kpis, week, drawMap, zipCard, table, held, lines, filesCard, counties, ladder, rules, season, signals, sure, () => prose({ P: PP, origin: plan.origin }), sources];
    function render(force) {
      try { compute(); fail = ''; } catch (e) { console.error('heat desk compute', e); fail = e && e.message ? e.message : String(e); if (!plan) { $('#h17Gate', root).innerHTML = callout('', 'The plan could not be computed', `The engine stopped with this message: ${esc(fail)}. Reset every setting, or reload the page.`); return; } }
      LV = live(); syncUI(force);
      BLOCKS.forEach(f => { try { f(); } catch (e) { console.error('heat desk block', f.name, e); } });
    }
    const later = debounce(() => render(), 140);

    /* ---------- wiring: every event is bound here, none in the markup ---------- */
    root.addEventListener('input', e => { const el = e.target; if (el.dataset && el.dataset.p && el.type !== 'checkbox') { if (el.type === 'range') readout(el); if (commit(el)) later(); } });
    root.addEventListener('change', e => { const el = e.target; if (!el.dataset) return;
      if (el.dataset.p) { if (commit(el)) render(); else syncUI(true); }
      else if (el.dataset.mix) { setMix(el.dataset.mix, el.value); render(true); }
      else if (el.id === 'h17Month') { if (el.value === '') delete st.P.month; else st.P.month = +el.value; save(); render(); }
      else if (el.id === 'h17Layer') { st.layer = el.value; save(); drawMap(); }
      else if (el.id === 'h17Bench') { st.bench = el.checked; save(); table(); }
      else if (el.id === 'h17Find') find(el.value); });
    root.addEventListener('click', e => { const b = e.target.closest('button'); if (!b || !root.contains(b)) return; const d = b.dataset;
      if (d.csv) saveCsv(d.csv);
      else if (d.x) saveX(d.x);
      else if (d.act === 'addpin') { if (toggleZip('pins', $('#h17PinIn', root).value, true)) $('#h17PinIn', root).value = ''; }
      else if (d.act === 'addblock') { if (toggleZip('blocks', $('#h17BlkIn', root).value, true)) $('#h17BlkIn', root).value = ''; }
      else if (d.act === 'pin' || d.act === 'unpin') toggleZip('pins', d.zip, d.act === 'pin');
      else if (d.act === 'block' || d.act === 'unblock') toggleZip('blocks', d.zip, d.act === 'block');
      else if (d.act === 'live') { st.scn = 'live'; render(); }
      else if (d.act === 'zdesk') goModule('desk', Object.assign(HX.hand(plan, 'all'), { zips: [d.zip] }));
      else if (d.act === 'zlines') goModule('lines', { line: 'heat', zip: d.zip }); });
    wireSeg($('#h17Scn', root), v => { st.scn = F0 ? v : 'live'; render(); });
    wireSeg($('#h17Bid', root), v => { st.P.bidding = v; save(); render(); });
    wireSeg($('#h17Mode', root), v => {
      if (v === 'auto') { st.P.mode = 'auto'; st.mixSel = null; }
      else if (HX.PRESETS && HX.PRESETS[v]) { st.P.mode = 'custom'; st.P.mix = Object.assign({}, HX.PRESETS[v].mix); st.mixSel = v; }
      else { const m = {}; let acc = 0; IDS.forEach((id, i) => { m[id] = i === IDS.length - 1 ? Math.max(0, 100 - acc) : Math.round((PP.mode === 'custom' ? PP.mix[id] / 100 : plan.T.mix[id]) * 100); acc += m[id]; }); st.P.mode = 'custom'; st.P.mix = m; st.mixSel = 'custom'; }
      save(); render(true); });
    $('#h17Reset', root).onclick = () => { st.P = {}; st.scn = 'live'; st.mixSel = null; save(); render(true); toast('Every setting is back to its default'); };
    $('#h17Find', root).addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); find(e.target.value); } });
    ['h17PinIn', 'h17BlkIn'].forEach(id => $('#' + id, root).addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $(`[data-act="${id === 'h17PinIn' ? 'addpin' : 'addblock'}"]`, root).click(); } }));
    function find(q) { q = String(q || '').trim(); if (!q) return; if (/^\d{5}$/.test(q)) { pick(q, true); return; } const lc = q.toLowerCase(), hit = plan.all.filter(r => String(r.city).toLowerCase() === lc).concat(plan.all.filter(r => String(r.city).toLowerCase().indexOf(lc) === 0)).sort((a, b) => b.dollars - a.dollars || a.min - b.min)[0]; if (hit) pick(hit.zip, true); else { st.sel = null; st.miss = q.slice(0, 12); zipCard(); toast(`Nothing on this map matches ${st.miss}`); } }
    $('#h17XPack', root).onclick = () => saveX('pack');
    $('#h17XGoogle', root).onclick = () => saveX('googleLocations');
    $('#h17XWeek', root).onclick = () => saveX('week');
    $('#h17XPlan', root).onclick = () => saveX('planByZip');
    $('#h17Desk', root).onclick = () => goModule('desk', HX.hand(plan, 'all'));
    $('#h17Lines', root).onclick = () => goModule('lines', { line: 'heat' });
    $('#h17Wx', root).onclick = () => goModule('weather', { line: 'heat' });
    $('#h17Live', root).onclick = () => goModule('live');

    /* ---------- what the shell, the popup and the other modules send ---------- */
    this.receive = p => { if (p && p.zip != null) pick(String(p.zip), true); };
    this.fromRoute = arg => { if (arg != null && String(arg).trim()) pick(String(arg), true); };
    BUS.on('theme', () => { drawMap(); ladder(); });
    ['sl', 'live', 'brand'].forEach(ev => BUS.on(ev, () => render()));
    render(true);
  }
});
