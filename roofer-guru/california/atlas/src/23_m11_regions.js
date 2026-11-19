/* ==== 23_m11_regions.js ==== */
/* ==== m11_regions ==== */
"use strict";
/* ============================ Module 11: Louisiana Regions ============================ */
registerModule({
  key: 'regions', num: '11', title: 'Louisiana Regions', desc: 'The nine regions on their own: roof stock and age, storm resets, hail, FEMA, competition, media markets and languages',
  mount(root) {
    const st = { r: null, m: 'ra20' };
    const CUR = +String(META.compiled || '2026').slice(0, 4);
    const RESET_Y = [2005, 2008, 2012, 2020, 2021, 2024];
    const RG = REG_KEYS.map(k => {
      const ps = PA.filter(p => p.reg === k), pis = new Set(ps.map(p => p.i)), zs = ZR.filter(z => pis.has(z.pi)), zall = Z.filter(z => pis.has(z.pi));
      const s = f => sum(ps.map(p => p[f])); const pop = s('pop');
      const wm = f => { let a = 0, t = 0; zall.forEach(z => { if (isN(z[f]) && z.pop > 0) { a += z[f] * z.pop; t += z.pop; } }); return t ? a / t : null; };
      const ev = f => sum(ps.map(p => (p.ev || {})[f]));
      const hist = {}; ps.forEach(p => Object.entries(p.hist || {}).forEach(([y, a]) => { const h = hist[y] = hist[y] || [0, 0]; h[0] += a[0] || 0; h[1] += a[1] || 0; }));
      const foot = {}; zall.forEach(z => (DATA.zstorm[z.zip] || []).forEach(([si, kt]) => { if (!(si in foot) || kt > foot[si]) foot[si] = kt; }));
      const h64 = Object.entries(foot).filter(([si, kt]) => kt >= 64 && SIDS[si] && SIDS[si][1] >= 2002).map(([si]) => { const x = SIDS[si]; const r = RTI[x[0] + ' ' + x[1]]; return { name: x[0], year: x[1], month: r ? r.month : 6, lab: r ? stormName(r) : 'Hurricane ' + x[0] }; }).sort((a, b) => (b.year * 100 + b.month) - (a.year * 100 + a.month));
      const firms = COMP.filter(c => (c.offices || []).some(o => { let best = null, bd = 1e9; PA.forEach(p => { const c2 = GEO.pcent[p.fips]; if (!c2) return; const d = kmLL(o.lat, o.lon, c2[1], c2[0]); if (d < bd) { bd = d; best = p; } }); return best && best.reg === k; }));
      const o = { k, name: REGN[k], ps, zs, pop, nzip: zs.length, area: sum(ps.map(p => p.aland)) / 2.58999e6, hu: s('hu'),
        roofs: s('roofs'), ra20: s('ra20'), wave: s('wave'), nxt: s('nxt'), mh: s('mh'), cru: s('cru'), fema: s('fema_k'), seas: s('seas'),
        h1: ev('h1'), w58: ev('w58'), torn: ev('t'), hd1: wm('hd1'), hd175: wm('hd175'), hur64: wm('hur64'), h64, hist,
        bps25: sum(ps.map(p => ((p.bps || {})['2025'] || [])[1])), ytd26: s('ytd26'), ytd25: s('ytd25'),
        fees: sum(zs.map(z => z.fees)), firms, cbp: s('cbp_roof'), lic: s('lic'), adj: s('adjusters'), agents: s('ins_agents'),
        span: s('spanish') / Math.max(1, s('pop5')) * 100, viet: s('viet') / Math.max(1, s('pop5')) * 100, french: s('french') / Math.max(1, s('pop5')) * 100,
        s65: s('a65p') / Math.max(1, pop) * 100, inc: median(ps.map(p => p.inc)), mort: wm('mort_sh'), own: s('own') / Math.max(1, s('occ')) * 100,
        cities: CITIES.filter(c => pis.has(c.pi)).sort((a, b) => b.pop - a.pop), dma: META.model.DMA[k], cpc: mean(zs.map(z => z.cpc_rel)) };
      o.ra20sh = o.roofs ? 100 * o.ra20 / o.roofs : null; o.wavesh = o.roofs ? 100 * o.wave / o.roofs : null; o.nxtK = o.roofs ? 1000 * o.nxt / o.roofs : null; o.femaR = o.hu ? 100 * o.fema / o.hu : null;
      o.lines = {}; LINE_KEYS.forEach(l => o.lines[l] = sum(zs.map(z => z['p_' + l] || 0)));
      return o;
    });
    const RGI = {}; RG.forEach(o => RGI[o.k] = o);
    const SP = sum(RG.map(o => o.pop)); const stLine = {}; LINE_KEYS.forEach(l => stLine[l] = sum(RG.map(o => o.lines[l])) / SP);
    const RM = {
      ra20: { l: 'Roofs 20 years or older (% of one unit roofs, model)', f: o => o.ra20sh, fmt: v => P(v, 1) },
      wave: { l: 'Roofs reaching 20 within five years (% of one unit roofs, model)', f: o => o.wavesh, fmt: v => P(v, 1) },
      nxt: { l: 'Age driven replacements next 12 months per 1,000 roofs (model)', f: o => o.nxtK, fmt: v => D(v, 1) },
      fema: { l: `FEMA roof and wind registrations per 100 homes, 2004 to ${CUR}`, f: o => o.femaR, fmt: v => D(v, 1) },
      hail: { l: 'Hail days a year, 1 inch or larger within 25 miles (resident weighted)', f: o => o.hd1, fmt: v => D(v, 2) },
      hur: { l: 'Chance of hurricane force winds in a year (resident weighted %)', f: o => o.hur64, fmt: v => P(v, 1) },
      fees: { l: 'Gross profit pool per resident ($ a year, model)', f: o => o.fees / o.pop, fmt: v => M$(v) },
      cpc: { l: 'Mean relative cost per click', f: o => o.cpc, fmt: v => D(v, 2) + '×' },
      span: { l: 'Speak Spanish at home (%)', f: o => o.span, fmt: v => P(v, 1) } };
    const top = (f, dir) => RG.slice().sort((a, b) => dir * (f(b) - f(a)))[0];
    const yW = top(o => o.wavesh, 1), yY = top(o => o.ra20sh, -1), yH = top(o => o.hd1, 1);
    root.innerHTML = mastHTML({ eyebrow: 'Module 11 · Louisiana Regions · nine regions, 64 parishes', title: 'Louisiana Regions', dek: 'Louisiana is not one roofing market. Hurricanes reset the coast in waves: Ida and Francine left the Bayou and River Parishes with the youngest roofs in the state, Laura and Delta did the same for the Southwest, and the roofs put on after Katrina around New Orleans and the Northshore are now past twenty years, with Gustav\'s roofs in the Capital Region close behind. The Northwest and Northeast sit outside most hurricane tracks: roofs there simply age, and hail and thunderstorm wind do the damage. The regions are the Louisiana Department of Health\'s nine administrative regions, which line up with the media markets a roofer buys.',
      meta: ['<b>Regions</b> LDH administrative regions 1 to 9', '<b>Roof stock</b> ACS 2020 to 2024 and the roof age model', '<b>Storms</b> NHC tracks, NOAA reports, FEMA', '<b>Markets</b> main media market per region'],
      bar: 'Louisiana Regions', barsub: 'Each region on its own',
      actions: [{ id: 'r11Csv', label: '↓ Regions CSV' }, { id: 'r11Desk', label: 'Campaign Desk ↗', title: 'Send the top ZIPs of the selected region' }] }) +
      `<div class="wrap">
      ${callout('', 'Read this first: how to read the regions', `Each region sums its parishes. Roof ages come from the roof age model (module 17), which resets roofs wherever a storm's modeled winds reached; storm reports and FEMA registrations are observed. Read the age measures and the storm measures together: a region with few old roofs was usually reroofed by a recent hurricane, and its next wave is a decade or more away. Today ${esc(yW.name)} carries the largest share of roofs reaching 20 within five years (${P(yW.wavesh, 0)}), ${esc(yY.name)} the youngest roofs (${P(yY.ra20sh, 0)} at 20 or older) and ${esc(yH.name)} the most hail (${D(yH.hd1, 1)} days a year). A region card is the brief for a regional campaign: which lines run hot, how old the roofs are, which storms reset them, who already advertises, and which languages to build for.`)}
      <div class="regcards" id="r11Cards"></div>
      <div class="controls" style="margin-top:16px"><div class="ctl" style="flex:1 1 320px"><label class="fl" for="r11Met">Map measure (by region)</label><select id="r11Met">${Object.entries(RM).map(([k, m]) => `<option value="${k}">${esc(m.l)}</option>`).join('')}</select></div></div>
      <div class="grid2">
        <div class="card mapcard"><div id="r11Map"></div><div class="legend" id="r11Leg"></div></div>
        <div class="stack"><div class="card"><div class="card-h" style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start"><div><h3 id="r11Name">Louisiana</h3><p id="r11Sub">Click a region</p></div><span class="pill" id="r11Pill">State</span></div><div class="card-b" id="r11Detail"></div></div></div>
      </div>
      ${card('Regions side by side', 'Roof age, storm exposure, model pools and the market for each region.', '<div class="tscroll" id="r11Tbl"></div>', 'mt')}
      <div class="split">
        ${card('The storm resets by region', 'Roofs replaced after the big storm years (model), and the age driven replacements due this year. The resets are the waves that come due twenty years later.', '<div id="r11Trend"></div>')}
        ${card('Which lines run hot where', 'Each region\'s service line pool per resident against the state rate (1.0 = state). Darker cells run hotter.', '<div id="r11Lines"></div>')}
      </div>
      <div class="split">
        ${card('Gaps: what no public dataset fills', 'Where the next layer of truth sits, and who holds it.', '<div id="r11Gap"></div>')}
        ${card('How this tab is built', 'Sums, rates and the region to market mapping.', '<div id="r11How"></div>')}
      </div>
      <div class="foot" id="r11Foot"></div></div>`;
    const map = new ZipMap($('#r11Map', root), { segHit: 'none', roads: false, aria: 'Map of Louisiana regions', onParish: f => { const k = PAI[f].reg; st.r = st.r === k ? null : k; if (st.r) map.fitParishes(RGI[k].ps.map(p => p.fips)); else map.reset(); render(); },
      onParishHover: (f, e) => { const p = PAI[f]; const o = RGI[p.reg]; const M = RM[st.m]; showTip(`<div class="tt">${esc(o.name)}</div><div class="ts">${esc(p.name)} Parish · ${N(o.pop)} residents in the region</div>${tipRow(esc(M.l), M.fmt(M.f(o)))}${tipRow('Roofs 20 years or older (model)', N(o.ra20))}${tipRow('Reaching 20 within five years', N(o.wave))}${tipRow('Latest hurricane force storm', o.h64[0] ? esc(o.h64[0].lab + ', ' + o.h64[0].year) : 'none since 2002')}<div class="tf">Click to open the region</div>`, e); } });
    function render() {
      const M = RM[st.m]; const vals = RG.map(M.f); const sc = qScale(vals, 'green', 1);
      map.fillParish(f => sc.f(M.f(RGI[PAI[f].reg]))); map.dimParish(st.r ? new Set(PA.filter(p => p.reg === st.r).map(p => p.fips)) : null);
      map.roads(() => ({ hide: true }));
      $('#r11Leg', root).innerHTML = legendHTML({ title: M.l, R: sc.R, lo: M.fmt(Math.min(...vals)), hi: M.fmt(Math.max(...vals)), note: '<b>Each region is one value</b>; nine regions in eight classes.' });
      $$('.regcard', root).forEach(c => c.classList.toggle('sel', +c.dataset.k === st.r));
      drawDetail();
    }
    $('#r11Cards', root).innerHTML = RG.map(o => `<div class="regcard" data-k="${o.k}" role="button" tabindex="0"><h4>${esc(o.name)}</h4><div class="mini">${N(o.ps.length)} parishes · ${K(o.pop)} residents · ${esc(REG_MKT[o.k])}</div>
      <div class="rowl" style="margin-top:6px"><span>Roofs 20 or older (model)</span><b>${K(o.ra20)} · ${P(o.ra20sh, 0)}</b></div><div class="rowl"><span>Reaching 20 within five years</span><b>${K(o.wave)}</b></div><div class="rowl"><span>Latest hurricane force storm</span><b>${o.h64[0] ? esc(o.h64[0].name) + ' ' + o.h64[0].year : 'none since 2002'}</b></div><div class="rowl"><span>Gross profit pool a year</span><b>${MM(o.fees)}</b></div></div>`).join('');
    $$('.regcard', root).forEach(c => { const go = () => { const k = +c.dataset.k; st.r = st.r === k ? null : k; if (st.r) map.fitParishes(RGI[k].ps.map(p => p.fips)); else map.reset(); render(); }; c.onclick = go; c.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } }; });
    function drawDetail() {
      const box = $('#r11Detail', root); const o = st.r ? RGI[st.r] : null;
      if (!o) { $('#r11Name', root).textContent = 'Louisiana'; $('#r11Sub', root).textContent = 'Click a region on the map or a card above'; $('#r11Pill', root).textContent = 'State';
        box.innerHTML = RG.slice().sort((a, b) => b.ra20 - a.ra20).map(x => `<div class="rowl"><span>${esc(x.name)}</span><b>${K(x.ra20)} old roofs · ${K(x.wave)} coming</b></div>`).join('') + '<p class="mini" style="margin-top:8px">Roofs 20 years or older · roofs reaching 20 within five years (model).</p>'; return; }
      $('#r11Name', root).textContent = o.name; $('#r11Sub', root).textContent = `${o.ps.map(p => p.name).join(', ')}`; $('#r11Pill', root).textContent = 'Region ' + o.k;
      const hot = LINE_KEYS.map(l => [l, o.lines[l] / o.pop / stLine[l]]).sort((a, b) => b[1] - a[1]);
      box.innerHTML = `<div class="big">${N(o.ra20)}<span style="font-size:13px;font-weight:500;color:var(--ink-3)"> roofs 20 years or older (model)</span></div><div class="mini" style="margin-bottom:10px">${P(o.ra20sh, 1)} of ${N(o.roofs)} one unit roofs · ${N(o.wave)} more reach 20 within five years · about ${N(o.nxt)} due from age alone in the next twelve months</div>
        <div class="rowl"><span>Residents · ZIPs scored · square miles</span><b>${N(o.pop)} · ${N(o.nzip)} · ${N(o.area)}</b></div>
        <div class="rowl"><span>Mobile homes · camps and seasonal homes · commercial roofs (estimate)</span><b>${N(o.mh)} · ${N(o.seas)} · ${N(o.cru)}</b></div>
        <div class="rowl"><span>Hurricane force storms since 2002 · latest</span><b>${N(o.h64.length)} · ${o.h64[0] ? esc(o.h64[0].lab + ', ' + o.h64[0].year) : 'none'}</b></div>
        <div class="rowl"><span>FEMA roof and wind registrations, 2004 to ${CUR} · per 100 homes</span><b>${N(o.fema)} · ${D(o.femaR, 1)}</b></div>
        <div class="rowl"><span>Storm reports 2016 to ${CUR}: hail 1 inch+ · damaging wind · tornadoes</span><b>${N(o.h1)} · ${N(o.w58)} · ${N(o.torn)}</b></div>
        <div class="rowl"><span>Hail days a year (1 inch+, 1.75 inch+) · hurricane chance a year</span><b>${D(o.hd1, 2)} · ${D(o.hd175, 2)} · ${P(o.hur64, 1)}</b></div>
        <div class="rowl"><span>New housing units permitted, 2025 · ${CUR} to date against last year</span><b>${N(o.bps25)} · ${N(o.ytd26)} vs ${N(o.ytd25)}</b></div>
        <div class="dsec">Lines that run hot (× state per resident)</div>${hot.slice(0, 4).map(([l, v]) => `<div class="rowl"><span>${esc(PLI[l].name)}</span><b>${D(v, 2)}×</b></div>`).join('')}
        <div class="dsec">Market</div>
        <div class="rowl"><span>Main media market · cost factor</span><b>${esc(REG_MKT[o.k])} · ${D(o.dma, 2)}</b></div>
        <div class="rowl"><span>Mapped roofers with offices · roofing establishments (CBP) · license records</span><b>${N(o.firms.length)} · ${N(o.cbp)} · ${N(o.lic)}</b></div>
        <div class="rowl"><span>Insurance agents (ZBP) · adjusters</span><b>${N(o.agents)} · ${N(o.adj)}</b></div>
        <div class="rowl"><span>Spanish · Vietnamese · French at home</span><b>${P(o.span, 1)} · ${P(o.viet, 1)} · ${P(o.french, 1)}</b></div>
        <div class="rowl"><span>Owner occupied · with a mortgage · 65 and over · median income</span><b>${P(o.own, 0)} · ${P(o.mort, 0)} · ${P(o.s65, 0)} · ${M$(o.inc)}</b></div>
        <div class="rowl"><span>Largest cities</span><b>${o.cities.slice(0, 5).map(c => esc(c.name)).join(', ')}</b></div>
        <p class="mini" style="margin-top:8px">Roofers with an office here: ${o.firms.map(c => esc(c.name)).join('; ') || 'none mapped'}.</p>
        <div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap"><button class="ibtn" id="r11Idx">Roof Demand Index for the region ↗</button><button class="ibtn" id="r11RD">Top ZIPs to the Desk ↗</button></div>`;
      $('#r11Idx', root).onclick = () => { goModule('index'); const s = $('#i1Reg'); if (s) { s.value = String(o.k); s.dispatchEvent(new Event('change')); } };
      $('#r11RD', root).onclick = () => goModule('desk', { zips: o.zs.slice().sort((a, b) => (b.effb || 0) - (a.effb || 0)).slice(0, 25).map(z => z.zip) });
    }
    dataTable($('#r11Tbl', root), [{ k: 'name', h: 'Region', l: 1, f: v => `<b>${esc(v)}</b>` }, { k: 'pop', h: 'Residents', f: v => N(v) }, { k: 'roofs', h: 'One unit roofs', f: v => N(v) }, { k: 'ra20sh', h: 'Roofs 20+ %', f: v => P(v, 1) }, { k: 'wavesh', h: 'Reaching 20 %', f: v => P(v, 1) }, { k: 'nxtK', h: 'Due a year per 1k', f: v => D(v, 1) }, { k: 'femaR', h: 'FEMA per 100 homes', f: v => D(v, 1) }, { k: 'hd1', h: 'Hail days', f: v => D(v, 2) }, { k: 'hur64', h: 'Hurricane chance', f: v => P(v, 1) }, { k: 'fees', h: 'Pool', f: v => MM(v) }, { k: 'cpc', h: 'Cost', f: v => D(v, 2) + '×' }, { k: 'nf', h: 'Roofers', v: r => r.firms.length, f: v => N(v) }, { k: 'span', h: 'Spanish %', f: v => P(v, 1) }, { k: 'mkt', h: 'Media market', l: 1, v: r => REG_MKT[r.k] }], RG, { sortKey: 'pop', id: r => r.k, onClick: k => { st.r = +k; map.fitParishes(RGI[+k].ps.map(p => p.fips)); render(); } });
    const rs = (o, y) => ((o.hist[String(y)] || [0, 0])[1]); const ag = o => ((o.hist[String(CUR)] || [0, 0])[0]);
    const stName = y => listAnd(RT.filter(r => r.year === y && RTS[r.r] && RTS[r.r].est >= 5000).sort((a, b) => RTS[b.r].est - RTS[a.r].est).map(r => r.name)) || '';
    $('#r11Trend', root).innerHTML = `<div class="xscroll"><table><thead><tr><th class="l">Region</th>${RESET_Y.map(y => `<th>${y}<br><span class="mini">${esc(stName(y))}</span></th>`).join('')}<th>Age driven, ${CUR}</th></tr></thead><tbody>${RG.slice().sort((a, b) => b.roofs - a.roofs).map(o => `<tr><td class="l"><b>${esc(o.name)}</b></td>${RESET_Y.map(y => `<td>${N(rs(o, y))}</td>`).join('')}<td>${N(ag(o))}</td></tr>`).join('')}<tr><td class="l">Louisiana</td>${RESET_Y.map(y => `<td><b>${N(sum(RG.map(o => rs(o, y))))}</b></td>`).join('')}<td><b>${N(sum(RG.map(ag)))}</b></td></tr></tbody></table></div><p class="chartnote">Storm driven replacements in the year of the storm, from the roof age model: the modeled winds of every storm at each ZIP times the FEMA fitted damage curve. A reset of tens of thousands of roofs in one year comes due as a wave about twenty years later. Grade B.</p>`;
    const allv = RG.flatMap(o => LINE_KEYS.map(l => o.lines[l] / o.pop / stLine[l])).filter(v => v > 0); const sc2 = divScale(allv.map(v => Math.log(v)), 0);
    $('#r11Lines', root).innerHTML = `<div class="xscroll"><table class="heat"><thead><tr><th class="l">Region</th>${PL.map(l => `<th>${esc(l.short)}</th>`).join('')}</tr></thead><tbody>${RG.map(o => `<tr><td class="l"><b>${esc(o.name)}</b></td>${LINE_KEYS.map(l => { const v = o.lines[l] / o.pop / stLine[l]; if (!(v > 0)) return '<td>·</td>'; const c = sc2.f(Math.log(v)); return `<td style="background:${c};color:${textOn(c)}">${D(v, 2)}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div><p class="chartnote">Copper above the state rate, blue below, on a log scale centered at 1.0. Replacement, repair, storm and hail rest on the roof stock, the storm record and the FEMA fitted damage curve; FORTIFIED, metal, commercial, coating and new construction lines lean on assumptions (grade D), so read their columns as relative exposure only.</p>`;
    $('#r11Gap', root).innerHTML = proseTable([
      ['Insurance claims by ZIP', 'Insurers hold claim counts by property; the Department of Insurance publishes catastrophe claim totals by event, at best by parish.', 'D'],
      ['Reroof permits', 'Parish and city permit offices hold them, and every roof has needed one since August 2025; few publish a feed, and the Census permit survey counts new construction only.', 'X'],
      ['Roof age by address', 'Insurers, inspection firms and aerial imagery vendors hold it; the atlas models it by ZIP from year built and storm footprints.', 'C'],
      ['Where hail actually fell', 'Radar hail swaths map hail better than reports, which follow people; they are not built into this atlas.', 'D'],
      ['Search demand by ZIP', 'Search engines report demand by metro and state, not ZIP. Account data (module 15) is the only ZIP level truth.', 'D'],
    ].map(r => [r[0], r[1], G(r[2])]));
    $('#r11How', root).innerHTML = `<p class="body">Regions follow the Louisiana Department of Health's nine administrative regions, which line up with the main media markets. Roof stock, roof ages and replacements sum the parish tables of the roof age model (module 17); FEMA registrations and storm reports sum by parish; hurricane force storms count distinct storms with modeled sustained winds of 74 mph or more at any ZIP of the region since 2002; hail days and hurricane chances are resident weighted ZIP means; model pools sum the scored ZIPs, each assigned to the parish holding most of its residents; roofers count when any mapped office sits in a parish of the region. The media market named for each region is its main market for buying (grade C): northern parishes on the state line also receive stations from Mississippi, Arkansas and Texas.</p>`;
    $('#r11Foot', root).innerHTML = `<b style="color:var(--ink)">Uplift Louisiana Roofing Atlas</b>, module 11. Regions are the Louisiana Department of Health administrative regions. Compiled ${esc(new Date(META.compiled + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }))}.`;
    $('#r11Met', root).onchange = e => { st.m = e.target.value; render(); };
    $('#r11Csv', root).onclick = () => saveFile('louisiana-roofing-regions.csv', toCSV(['region', 'parishes', 'residents', 'one_unit_roofs', 'roofs_20_plus_model', 'roofs_15_to_19_model', 'due_next_12_months_model', 'mobile_homes', 'fema_registrations_2004_' + CUR, 'fema_per_100_homes', 'hail_reports_1in_2016_' + CUR, 'wind_reports_58mph', 'tornadoes', 'hail_days_1in', 'hurricane_chance_pct', 'hurricane_force_storms_since_2002', 'gross_profit_pool_model', 'mean_relative_cpc', 'mapped_roofers', 'roofing_establishments_cbp', 'spanish_pct', 'media_market'].concat(RESET_Y.map(y => 'storm_resets_' + y)),
      RG.map(o => [o.name, o.ps.length, o.pop, o.roofs, o.ra20, o.wave, Math.round(o.nxt), o.mh, o.fema, +D(o.femaR, 2), o.h1, o.w58, o.torn, +D(o.hd1, 3), +D(o.hur64, 2), o.h64.length, Math.round(o.fees), +D(o.cpc, 3), o.firms.length, o.cbp, +D(o.span, 2), REG_MKT[o.k]].concat(RESET_Y.map(y => Math.round(rs(o, y))))), 'Uplift Louisiana Roofing Atlas, module 11. Roof ages and resets are modeled (module 17).'));
    $('#r11Desk', root).onclick = () => { const o = st.r ? RGI[st.r] : null; goModule('desk', { zips: (o ? o.zs : ZR).slice().sort((a, b) => (b.effb || 0) - (a.effb || 0)).slice(0, 25).map(z => z.zip) }); };
    BUS.on('theme', () => render());
    render();
  }
});
