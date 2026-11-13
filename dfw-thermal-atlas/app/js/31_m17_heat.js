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
  }
});
