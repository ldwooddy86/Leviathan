/* ==== 24_m12_lines.js ==== */
/* ==== m12_lines ==== */
"use strict";
/* The per line targeting helpers (LINE_TIER, TIER_BID, lineTargets, lineCities, LINE_FIRMS) live in the model file, before
   every module, so load order cannot break a reader. */
/* ============================ Module 12: Service Lines ============================ */
registerModule({
  key: 'lines', num: '12', title: 'Service Lines', desc: `${capFirst(numWord(NLINE))} roofing lines resolved to the ZIP: jobs, jobs open to marketing, gross profit, seasons, rules, keywords, competitors and bid modifiers`,
  mount(root) {
    const st = { k: 'replace', metric: 'r', reg: '', par: '', sel: null };
    const lc = s => String(s || '').replace(/\b[A-Z][a-z]+\b/g, m => m.toLowerCase());
    const PL = SLM.LINES, PLI = SLM.LI;   /* the model's thirteen line records, in order (this module never reads the content file's list directly) */
    const nl = numWord(NLINE), Nl = capFirst(nl); const MONL = MOL; const listAnd = joinAnd;
    const AHS = META.ahs || {}; const AM = AHS.metros || {};
    root.innerHTML = mastHTML({ eyebrow: `Module 12 · Service Lines · ${nl} lines, every ZIP`, title: 'Service Lines', dek: `A California roofing company is ${nl} businesses that share a crew yard. Replacements come due as roofs age, in waves set by the decades the tracts were built; leaks and wind damage arrive with the wet season, November to March; wildfire work comes in rebuilds that run for years; fire hardened roofs are bought on an insurer's deadline; tile roofs need new underlayment while the tile itself goes back; a reroof under solar panels starts with taking them off; metal, manufactured home, multifamily, commercial, coating and new construction work each has its own buyer and season. Each line here has its own heatmap, statewide volume, jobs open to marketing, gross profit pool, season, rules, keywords, competitors and bid modifiers, with every assumption in plain view and editable.`,
      meta: [`<b>Lines</b> ${esc(PL.map(l => lc(l.short)).join(', '))}`, `<b>ZIPs</b> ${N(ZR.length)} scored`, '<b>Grades</b> B where the anchor is observed, C and D where it is an assumption', '<b>Assumptions</b> stored in this browser'],
      bar: 'Service Lines', barsub: 'Choose a line; everything below follows it',
      actions: [{ id: 'l12Csv', label: '↓ Line targets CSV' }, { id: 'l12CityCsv', label: '↓ City pages CSV' }, { id: 'l12Desk', label: 'Campaign Desk ↗', title: 'Send the top ZIPs for this line' }, { id: 'l12Forge', label: 'Site Forge ↗', title: 'Send the top cities for this line' }] }) +
      `<div class="wrap">
      ${callout('', 'Read this first: what a service line is here, and what the numbers are', `A line counts <b>roofing jobs a year</b> at each ZIP (the volume), the share an owner gives to a contractor found through search, ads, referrals or the door (jobs open to marketing), and those jobs times a default ticket times a ${P(SLM.A.fee * 100, 0)} gross margin (the gross profit pool). Replacement and tile start from the roof cohort model; repair from the American Housing Survey leak rate; storm from a state total (the survey's share of roof jobs paid by insurance) spread by each ZIP's roofs and its wind and atmospheric river exposure; fire from CAL FIRE's damage inspections; hardening from the homes insurers rate High or Extreme for wildfire and the FAIR Plan's policies; solar from the reroofs that sit under panels; new construction from Census building permits; metal, manufactured home, multifamily, commercial and coating lines from stated assumptions. Every default below is a placeholder until it is replaced with your own job history: change it and every module updates. Nothing here is a bid, a quote, a forecast for one company, or legal advice.`)}
      <div class="lpick" id="l12Pick"></div>
      <div class="kpis" id="l12Kpis"></div>
      <div class="controls">
        <div class="ctl"><span class="fl">Map metric</span><div class="seg" id="l12Met"><button data-v="r" aria-pressed="true">Per 10,000 residents</button><button data-v="p" aria-pressed="false">Jobs a year</button><button data-v="f" aria-pressed="false">Gross profit pool</button><button data-v="e" aria-pressed="false">Paid target tier</button></div></div>
        <div class="ctl"><label class="fl" for="l12Reg">Region</label><select id="l12Reg"><option value="">All ${numWord(NREG)} regions</option>${REG_KEYS.map(k => `<option value="${k}">${esc(REGN[k])}</option>`).join('')}</select></div>
        <div class="ctl"><label class="fl" for="l12Par">County</label><select id="l12Par"><option value="">All ${NCOUNTY} counties</option>${PA.slice().sort((a, b) => a.name.localeCompare(b.name)).map(p => `<option value="${p.fips}">${esc(p.name)}</option>`).join('')}</select></div>
        <div class="ctl"><label class="fl" for="l12Find">Find a ZIP or city</label><input type="search" id="l12Find" placeholder="92501 or Santa Rosa" autocomplete="off"></div>
      </div>
      <div class="grid2">
        <div class="card mapcard"><div id="l12Map"></div><div class="legend" id="l12Leg"></div></div>
        <div class="stack">
          <div class="card"><div class="card-h" style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start"><div><h3 id="l12Name"></h3><p id="l12Sub"></p></div><span class="pill" id="l12Pill"></span></div><div class="card-b" id="l12Detail"></div></div>
          <div class="card"><div class="card-h"><h3>Paid targets for this line</h3><p>ZIPs ranked by gross profit pool per relative click cost. Click a row to select it.</p></div><div class="tscroll short" id="l12Tbl"></div></div>
        </div>
      </div>
      <div class="split">
        ${card('The line in law', 'What California and federal rules do to this line\'s ads, contracts and jobs. Each item carries its citation; module 03 has the full register.', '<div id="l12Law"></div>')}
        ${card('Unit economics and assumptions', 'Change any number; the maps, tables and every module that reads the line follow. Stored in this browser.', '<div id="l12Econ"></div>')}
      </div>
      ${card('SEO page targets for this line', 'Cities ranked by this line\'s gross profit pool, with the competition already there. One page per city and line where the volume supports it; Spanish pages where a large share speaks Spanish at home.', '<div class="tscroll" id="l12Cities"></div>', 'mt')}
      <div class="split">
        ${card('Keywords, negatives and angles', 'Starting keyword set for the line, the negatives that keep job seekers, shoppers and do it yourself searches out, and the copy angles the Campaign Desk builds from. House style: no hyphens or dashes in copy.', '<div id="l12Kw"></div>')}
        ${card('Competitive pressure on this line', 'Who already sells this line: the license roll, employer establishments and the few companies named with public evidence.', '<div id="l12Comp"></div>')}
      </div>
      ${card('The year, line by line', 'Monthly shape of each line, 100 = an average month. Darker cells are busier months. Repair, storm, fire and manufactured home rows are computed from the rain, wind and fire record by month with a lag for the work that follows; reroof, tile and coating rows from a dry weather index; the rest are planning shapes (graded). Choose a region to see its own year.', '<div id="l12Sea"></div>', 'mt')}
      <div class="split">
        ${card('Portfolio: where a month of media should go', 'Your monthly budget split across lines by gross profit pool times season, divided by each line\'s click cost. Edit the budget in the assumptions card.', '<div id="l12Port"></div>')}
        ${card(`The ${nl} lines side by side`, 'Gross profit pool a year at the current assumptions, statewide. The selected line is dark.', '<div id="l12Mix"></div>')}
      </div>
      ${card('Dayparting templates', 'Bid adjustments by hour block for each line\'s template. They are assumptions until account data replaces them (module 15); the last row shows when the weather that drives the work is reported.', '<div id="l12Day"></div>', 'mt')}
      <div class="split">
        ${card('How the lines are built', 'Anchor, apportionment and grade for each line.', '<div id="l12Method"></div>')}
        ${card('Judgment calls and caveats', 'The choices that most move the numbers.', '<div id="l12Judg"></div>')}
      </div>
      <div class="foot" id="l12Foot"></div></div>`;
    const map = new ZipMap($('#l12Map', root), { segHit: 'none', roads: false, onSelect: z => { if (st.sel !== z && !(ZI[z] && ZI[z].res_ok)) return; st.sel = st.sel === z ? null : z; render(); }, onHover: (z, e) => { const r = ZI[z]; if (!r || !r.res_ok) return; const o = SLM.zipLine(r, st.k); const t = T.find(x => x.zip === z); showTip(`<div class="tt">${esc(r.zip)} · ${esc(r.city)}</div><div class="ts">${esc(r.cty)} County · ${N(r.pop)} residents</div>${tipRow(esc(L().short) + ' jobs a year', D(o.pool, o.pool < 10 ? 1 : 0))}${tipRow('Per 10,000 residents', D(r['r_' + st.k], 1))}${tipRow('Jobs open to marketing a year', D(o.cases, 1))}${tipRow('Gross profit pool a year', MM(o.fees))}${t ? tipRow('Paid tier · bid', t.tier + ' · ' + S(t.bid, 0) + '%') : ''}<div class="tf">Click for the ZIP ledger</div>`, e); } });
    const L = () => PLI[st.k]; let T = [];
    const inScope = z => (!st.par || z.fips === st.par) && (!st.reg || (PA[z.pi] && PA[z.pi].reg === +st.reg));
    const SEAv = k => SLM.seasonFor(k, st.reg ? +st.reg : null);   /* the year of a line, for the region in view when one is chosen */
    $('#l12Pick', root).innerHTML = `<div class="seg" id="l12Lines" style="margin-top:16px">${PL.map(l => `<button data-v="${l.key}" aria-pressed="${l.key === st.k}">${esc(l.name)}</button>`).join('')}</div>`;
    function kpis() {
      const k = st.k, l = L(), A = SLM.A.lines[k]; const pool = sum(ZR.map(z => z['p_' + k] || 0)); const cases = pool * A.rep; const fees = cases * A.val * SLM.A.fee;
      const sea = SEAv(k); const pk = sea.indexOf(Math.max(...sea));
      const par = PA.slice().sort((a, b) => (b['p_' + k] || 0) - (a['p_' + k] || 0))[0];
      const ue = SLM.blended(SLM.LI[k], null);
      $('#l12Kpis', root).innerHTML = kpiHTML([
        { l: 'Jobs a year', g: l.g, v: K(pool), d: esc(l.unit) },
        { l: 'Jobs open to marketing', g: 'D', v: K(cases), d: `${P(A.rep * 100, 0)} of the jobs go to a contractor found through search, ads, referrals or the door (assumption)` },
        { l: 'Gross profit pool a year', g: 'D', v: MM(fees), d: `${M$(A.val)} default ticket × ${P(SLM.A.fee * 100, 0)} gross margin` },
        { l: 'Cost per sold job', g: 'D', v: M$(ue.cps), d: `${M$(ue.cpc)} a click · ${D(ue.cvr, 1)}% to lead · ${D(ue.close, 0)}% sold` },
        { l: 'Return on paid', g: 'D', v: D(ue.roi, 1) + '×', d: 'gross profit per job ÷ cost per sold job, at the defaults' },
        { l: 'Peak month', g: SLM.LI[k].mg, v: SLM.MONTHS[pk], d: `${sea[pk]} against an average month of 100${st.reg ? ' in ' + esc(REGN[st.reg]) : ''}` },
        { l: 'Largest county', g: '', v: esc(par.name), d: `${par['p_' + k] < 100 ? D(par['p_' + k], 1) : N(par['p_' + k])} jobs a year` },
      ]);
    }
    function render() {
      const k = st.k; T = lineTargets(k); const TI = {}; T.forEach(t => TI[t.zip] = t);
      const met = st.metric; let sc, lab, lo, hi;
      if (met === 'e') { const TC = { 'A+': 7, A: 6, B: 5, C: 3, D: 2, E: 1 }; const R = ramp('green'); map.fill(zip => { const t = TI[zip]; return t ? R[TC[t.tier]] : null; }); lab = 'Paid target tier for the line'; $('#l12Leg', root).innerHTML = `<div><div class="lt">${esc(L().name)}: paid target tier</div><div class="ramp">${['E', 'D', 'C', 'B', 'A', 'A+'].map(t => `<i style="background:${R[TC[t]]}"></i>`).join('')}</div><div class="rlabs"><span>E · −50%</span><span>A+ · +30%</span></div></div><div class="dn"><b>Tiers rank gross profit pool per relative click cost</b> for this line: A+ is the top 5% of scored ZIPs (bid +30%), A the next 10% (+20%), B the next 20% (+10%), C 25% (0), D 25% (−20%), E the bottom 15% (−50%). ${G('D')}</div>`; }
      else {
        const key = met + '_' + k; const vals = ZR.map(z => met === 'f' ? TI[z.zip].fees : z[key]); sc = qScale(vals, 'green', 1); const v = vals.filter(isN);
        map.fill(zip => { const z = ZI[zip]; if (!z || !z.res_ok) return null; return sc.f(met === 'f' ? TI[zip].fees : z[key]); });
        lo = Math.min(...v); hi = Math.max(...v); const f = met === 'f' ? MM : met === 'p' ? (x => D(x, x < 10 ? 1 : 0)) : (x => D(x, 1));
        lab = met === 'r' ? 'jobs per 10,000 residents a year' : met === 'p' ? 'jobs a year' : 'gross profit pool a year';
        $('#l12Leg', root).innerHTML = legendHTML({ title: `${L().name}: ${lab}`, R: sc.R, lo: f(lo), hi: f(hi), note: `<b>Darker ZIPs carry more of the line ${met === 'r' ? 'per resident' : 'in total'}.</b> Eight quantile classes across ${N(ZR.length)} scored ZIPs; gray means fewer than 500 residents. ${G(L().g)}<br>${esc(L().what)}` });
      }
      map.dim((st.par || st.reg) ? new Set(Z.filter(inScope).map(z => z.zip)) : null); map.select(st.sel);
      kpis(); drawTable(TI); drawDetail(TI); drawCities(); drawStatic();
    }
    function drawTable(TI) {
      const rows = T.filter(t => inScope(t.z));
      dataTable($('#l12Tbl', root), [{ k: 'zip', h: 'ZIP', l: 1, f: v => `<b>${esc(v)}</b>` }, { k: 'city', h: 'City', l: 1, v: r => r.z.city }, { k: 'pool', h: 'Jobs', f: v => D(v, v < 10 ? 1 : 0) }, { k: 'rate', h: 'Per 10k', f: v => D(v, 1) }, { k: 'fees', h: 'Pool', f: v => MM(v) }, { k: 'pct', h: 'Pct', f: v => D(v, 0), t: 'Percentile of gross profit pool per relative click cost for this line' }, { k: 'tier', h: 'Tier', f: v => `<span class="tier t${String(v).replace('+', 'p')}">${esc(v)}</span>` }, { k: 'bid', h: 'Bid', f: v => S(v, 0) + '%' }],
        rows, { sortKey: 'pct', id: r => r.zip, onClick: z => { st.sel = st.sel === z ? null : z; render(); }, rowClass: r => r.zip === st.sel ? 'sel' : '' });
    }
    /* the ZIP facts that matter for each line */
    function lineRows(k, z) {
      const r = (l, v) => `<div class="rowl"><span>${l}</span><b>${v}</b></div>`; const hv = (c, d, u) => c ? D(z[c], d == null ? 1 : d) + (u || '') : '—';
      const age = r('One unit roofs · 20 or older · reaching 20 in five years (model)', `${N(z.roofs)} · ${P(z.ra20_sh, 0)} · ${N(z.wave)}`) + r('Median roof age · roofs 25 or older', `${isN(z.ra_med) ? D(z.ra_med, 0) : '—'} · ${N(z.ra25)} (${P(z.ra25_sh, 0)})`);
      const own = r('Owner occupied · with a mortgage · median home value', `${P(z.own_sh, 0)} · ${P(z.mort_sh, 0)} · ${M$(z.value)}`);
      const wx = r(`Normal rain a year · heavy rain days · atmospheric river days (${AR_WORDS})`, `${hv(HC.rain, 1, ' in')} · ${hv(HC.rain1, 1)} · ${hv(HC.ar, 1)}`) + r('Gust days a year, 58 mph or more · offshore wind days', `${hv(HC.gust, 2)} · ${hv(HC.sa, 1)}`) + r('FEMA storm and flood registrations · the 2023 winter storms', `${N(z.fema_storm)} · ${N(z.fema_w23)}`);
      const fire = r('Land in High or Very High fire zones', HC.fhsz ? P(z[HC.fhsz], 0) : '—') + r('Structures destroyed · damaged by wildfire · last year on record', `${HC.dest ? N(z[HC.dest]) : '—'} · ${HC.dmg ? N(z[HC.dmg]) : '—'} · ${z.lastfire || 'none'}`) + r('FEMA fire registrations · fire and smoke claims paid 2018 to 2023', `${N(z.fema_fire)} · ${N(z.wf_claims)}`);
      const ins = r('FAIR Plan home policies · per 100 homes · against 2022', `${N(z.fair_pif)} · ${D(z.fair_sh, 1)} · ${isN(z.fair_x) ? D(z.fair_x, 1) + '×' : '—'}`) + r('Non-renewed 2023 · share · rated High or Extreme wildfire risk', `${N(z.nonren)} · ${P(z.nonren_sh, 1)} · ${P(z.wf_hi_sh, 0)}`);
      const tile = r('Tile roofs (model) · share of roofs · underlayment 25 years or older', `${N(z.tile_n)} · ${P(z.tile_sh, 0)} · ${N(z.tile25)}`) + r('Tile underlayment jobs due in twelve months (model)', D(z.nxt_t, 0));
      const com = r('Commercial roofs (estimate) · warehouses · plants · retail · churches', `${D(z.cru, 0)} · ${N(z.whse)} · ${N(z.mfg)} · ${N(z.retail)} · ${N(z.church)}`);
      const heat = r('Days at 100°F or more · normal rain a year', `${hv(HC.heat, 1)} · ${hv(HC.rain, 1, ' in')}`);
      return {
        replace: age + own + r('Wood shake roofs (model) · metal share of reroofs (assumption)', `${P(z.wood_sh, 1)} · ${P(z.metal_sh, 0)}`),
        repair: age + r('Built before 1980 · median year built', `${P(z.pre80_sh, 0)} · ${isN(z.yb_med) ? D(z.yb_med, 0) : '—'}`) + wx,
        storm: wx + age, fire: fire + ins, harden: fire + ins + own, tile: tile + age + own,
        solar: (HC.solar ? r('Homes with rooftop solar', P(z[HC.solar], 0)) : '') + r('Reroofs due in twelve months · tile relays due (model)', `${D(z.nxt, 0)} · ${D(z.nxt_t, 0)}`) + r('Electrical contractors in the ZIP (ZBP)', N(z.solar_co)) + own,
        metal: age + own + r('Households earning $100,000 or more · metal share of reroofs (assumption)', `${P(z.hh100k_sh, 0)} · ${P(z.metal_sh, 0)}`) + r('Snow load · land in High or Very High fire zones', `${hv(HC.snow, 0, ' psf')} · ${HC.fhsz ? P(z[HC.fhsz], 0) : '—'}`),
        mh: r('Mobile homes · share of homes', `${N(z.mh)} · ${P(z.mh_sh, 0)}`) + wx + heat,
        mf: r('Homes in buildings of five or more units · buildings (estimate) · apartment lessors · property managers', `${N(z.mf5u)} · ${N(z.mfb)} · ${N(z.apts)} · ${N(z.pm)}`) + wx,
        comm: com + heat + r('FAIR Plan commercial policies', N(z.fair_com)), coat: com + heat,
        newc: r('Homes built since 2020 · since 2010', `${N(z.yb20)} · ${N((z.yb20 || 0) + (z.yb10 || 0))}`) + r('Builders and supply houses (ZBP)', `${N(z.builders)} · ${N(z.supply)}`) + (HC.fhsz ? r('Land in High or Very High fire zones (Class A on every new roof there)', P(z[HC.fhsz], 0)) : ''),
      }[k] || '';
    }
    function drawDetail(TI) {
      const l = L(), k = st.k; const z = st.sel ? ZI[st.sel] : null;
      if (!z || !z.res_ok) {
        const rows = ZR.filter(inScope); const nm = st.par ? PNAME(st.par) + ' County' : st.reg ? REGN[st.reg] : ATLAS.state;
        $('#l12Name', root).textContent = `${l.name} · ${nm}`; $('#l12Sub', root).textContent = 'Click a ZIP for its ledger'; $('#l12Pill', root).textContent = 'Grade ' + l.g;
        const pool = sum(rows.map(r => r['p_' + k] || 0)), pop = sum(rows.map(r => r.pop)); const tl = rows.map(r => TI[r.zip]).filter(Boolean);
        const byT = ['A+', 'A', 'B', 'C', 'D', 'E'].map(t => [t, tl.filter(x => x.tier === t).length, sum(tl.filter(x => x.tier === t).map(x => x.fees))]);
        const top = rows.slice().sort((a, b) => (b['p_' + k] || 0) - (a['p_' + k] || 0)); let acc = 0, n50 = 0; for (const r of top) { acc += r['p_' + k] || 0; n50++; if (acc >= pool * 0.5) break; }
        $('#l12Detail', root).innerHTML = `<div class="big">${pool < 100 ? D(pool, 1) : N(pool)}<span style="font-size:13px;font-weight:500;color:var(--ink-3)"> jobs a year</span></div><div class="mini" style="margin-bottom:10px">${D(pool / Math.max(1, pop) * 1e4, 1)} per 10,000 residents · half of them in ${N(n50)} of ${N(rows.length)} ZIPs</div>
          <div class="dsec">Paid tiers in view</div>${byT.map(([t, n, f]) => `<div class="rowl"><span><span class="tier t${t.replace('+', 'p')}">${t}</span> ${N(n)} ZIPs · bid ${S(TIER_BID[t], 0)}%</span><b>${MM(f)} pool</b></div>`).join('')}
          <div class="dsec">What the line counts</div><p class="mini">${esc(l.unit)}. ${esc(l.what)}</p>`;
        return;
      }
      const o = SLM.zipLine(z, k), t = TI[z.zip]; const pr = PA[z.pi]; const ue = SLM.blended(SLM.LI[k], z);
      $('#l12Name', root).textContent = `${z.zip} · ${z.city}`; $('#l12Sub', root).textContent = `${z.cty} County · ${N(z.pop)} residents · ${l.name}`; $('#l12Pill', root).textContent = 'Tier ' + t.tier;
      const prate = pr['p_' + k] / Math.max(1, pr.pop) * 1e4;
      $('#l12Detail', root).innerHTML = `<div class="big">${o.pool < 10 ? D(o.pool, 1) : N(o.pool)}<span style="font-size:13px;font-weight:500;color:var(--ink-3)"> jobs a year</span></div><div class="mini" style="margin-bottom:10px">${D(z['r_' + k], 1)} per 10,000 residents against ${D(prate, 1)} in ${esc(pr.name)} County · paid percentile ${D(t.pct, 0)}</div>
        <div class="rowl"><span>Jobs open to marketing a year</span><b>${o.cases < 10 ? D(o.cases, 1) : N(o.cases)}</b></div>
        <div class="rowl"><span>Gross profit pool a year</span><b>${MM(o.fees)}</b></div>
        <div class="rowl"><span>Relative click cost (region and competition)</span><b>${D(z.cpc_rel, 2)}×</b></div>
        <div class="rowl"><span>Click · lead · sold job</span><b>${M$(ue.cpc)} · ${M$(ue.cpl)} · ${M$(ue.cps)}</b></div>
        <div class="rowl"><span>Bid modifier for this line</span><b>${S(t.bid, 0)}%</b></div>
        <div class="rowl"><span>C-39 licenses within 25 km · competitive pressure</span><b>${N(z.comp_n25)} · ${D(z.comp_pct, 0)}th pct.</b></div>
        <div class="dsec">What drives this line here</div>${lineRows(k, z)}
        ${(z.span_lep_sh || 0) >= 10 ? callout('judg tight', 'Spanish build', `${P(z.span_sh, 0)} of residents speak Spanish at home, ${P(z.span_lep_sh, 0)} with limited English. Run the line's Spanish ad group and landing page here, with the license number and the office city in Spanish too, if someone at the company speaks Spanish with customers.`) : ''}
        <div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap"><button class="ibtn" id="l12ZIdx">Roof Demand Index ↗</button>${['storm', 'fire', 'harden', 'mh'].includes(k) ? '<button class="ibtn" id="l12ZSt">Weather and Fire Ledger ↗</button>' : '<button class="ibtn" id="l12ZSk">Roof stock ↗</button>'}<button class="ibtn" id="l12ZDesk">This ZIP to the Desk ↗</button></div>`;
      $('#l12ZIdx', root).onclick = () => goModule('index', { zip: z.zip }); if ($('#l12ZSt', root)) $('#l12ZSt', root).onclick = () => goModule('storms', { zip: z.zip }); if ($('#l12ZSk', root)) $('#l12ZSk', root).onclick = () => goModule('stock', { zip: z.zip }); $('#l12ZDesk', root).onclick = () => goModule('desk', { zips: [z.zip], line: k });
    }
    const pagePlan = c => c.cases >= 50 ? 'City page + landing page' : c.cases >= 15 ? 'City page' : c.cases >= 5 ? 'Section on the county page' : 'County page mention';
    function drawCities() {
      const k = st.k; const rows = lineCities(k).filter(c => (!st.par || (PA[c.pi] && PA[c.pi].fips === st.par)) && (!st.reg || (PA[c.pi] && PA[c.pi].reg === +st.reg)));
      const firms = LINE_FIRMS(k).length;
      dataTable($('#l12Cities', root), [
        { k: 'name', h: 'City', l: 1, f: v => `<b>${esc(v)}</b>` }, { k: 'par', h: 'County', l: 1, v: r => PA[r.pi] ? PA[r.pi].name : '' }, { k: 'pop', h: 'Residents', f: v => N(v) }, { k: 'nzip', h: 'ZIPs', f: v => N(v) },
        { k: 'pool', h: 'Jobs a year', f: v => D(v, v < 10 ? 1 : 0) }, { k: 'cases', h: 'Open to marketing', f: v => D(v, v < 10 ? 1 : 0) }, { k: 'fees', h: 'Pool', f: v => MM(v) },
        { k: 'comp', h: 'C-39 licenses within 8 km', f: v => N(v), t: 'Active C-39 roofing licenses whose mailing ZIP lies within 8 km of the city center (CSLB, November 2026)' }, { k: 'span', h: 'Spanish at home', f: v => P(v, 0) },
        { k: 'page', h: 'Page plan', l: 1, v: r => pagePlan(r), f: (v, r) => `${esc(v)}${r.span >= 25 ? ' · Spanish page' : ''}${r.chin >= 10 ? ' · Chinese page' : ''}${r.viet >= 10 ? ' · Vietnamese page' : ''}${r.korean >= 10 ? ' · Korean page' : ''}${r.tagalog >= 10 ? ' · Tagalog page' : ''}` },
      ], rows, { sortKey: 'fees', id: r => r.name });
    }
    let staticFor = null;
    function drawStatic() {
      const k = st.k, l = L(); if (staticFor === k + '|' + JSON.stringify(SLM.A)) return; staticFor = k + '|' + JSON.stringify(SLM.A);
      $('#l12Law', root).innerHTML = ((l.law || []).map(id => (typeof LAWX !== 'undefined' && LAWX.items ? LAWX.items : []).find(x => x.id === id)).filter(Boolean).length ? '' : '<p class="mini">No register item is linked to this line yet; module 03 holds the full register.</p>') + (l.law || []).map(id => (typeof LAWX !== 'undefined' && LAWX.items ? LAWX.items : []).find(x => x.id === id)).filter(Boolean).map(x => `<div class="lawi"><div class="lh"><b>${esc(x.t)}</b> ${G(x.g)}</div><div class="mini" style="margin:2px 0 4px">${x.url ? `<a href="${x.url}" target="_blank" rel="noopener">${esc(x.cite)}</a>` : esc(x.cite)} · ${esc(x.eff)}</div><p class="mini" style="color:var(--ink-2)">${esc(x.s)}</p></div>`).join('') + `<p class="mini" style="margin-top:8px">Read in November 2026 from the California codes (leginfo.legislature.ca.gov and transcriptions of it), the Contractors State License Board, the Department of Insurance, Title 24 and eCFR. Research material for marketing decisions, not legal advice; confirm with a California lawyer before relying on any item.</p>`;
      const A = SLM.A, p = A.lines[k];
      const fld = (id, lab, v, step, tip) => `<label class="efld" title="${esc(tip || '')}"><span>${lab}</span><input type="number" id="${id}" value="${v}" step="${step}" min="0"></label>`;
      const V0 = META.model.VAL; const tick = PL.map(x => `${lc(x.short)} ${M$(V0[x.key])}`);
      $('#l12Econ', root).innerHTML = `<div class="efgrid">${fld('l12Rep', 'Jobs open to marketing (%)', +(p.rep * 100).toFixed(2), 0.5, 'Share of the line\'s jobs a contractor wins through search, ads, referrals or the door')}${fld('l12Val', 'Default ticket ($)', p.val, 500, 'Average invoice per job')}${fld('l12CpcM', 'Click cost multiplier for the line', p.cpcMul, 0.05, 'Times the base cost per click')}${fld('l12Cvr', 'Click to lead (%)', p.cvr, 0.5)}${fld('l12Close', 'Lead to sold job (%)', p.close, 1)}</div>
        <div class="dsec">All lines</div><div class="efgrid">${fld('l12Cpc', 'Base cost per click ($)', A.cpc, 1)}${fld('l12Fee', 'Gross margin (%)', +(A.fee * 100).toFixed(1), 0.5)}${fld('l12Bud', 'Monthly budget ($)', A.budget, 1000)}</div>
        <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><button class="btn" id="l12Apply">Apply</button><button class="btn ghost" id="l12Reset">Reset every line to defaults</button></div>
        ${callout('judg tight', 'Judgment call: none of these defaults is a forecast', `Tickets are round planning numbers set by the data build, not measured: ${listAnd(tick)}. What is measured: the American Housing Survey's median hired roof job was ${M$((AM.la || {}).med)} in the Los Angeles metro, ${M$((AM.sf || {}).med)} in San Francisco and Oakland and ${M$((AM.riv || {}).med)} in Riverside and San Bernardino in 2023 (${M$(AHS.pac_med)} across the Pacific division), and San Francisco's permit files put the declared cost of a one or two family reroof at a median of $15,000. Those medians mix partial jobs with full reroofs. <b>Click costs, lead rates and close rates are not California evidence</b>: ${esc(SLM.BASIS.cpc)} For this line: ${esc(SLM.BASIS.lines[k] || 'an assumption')}. Replace every default with your own average invoices, close rates and margins.`)}`;
      $('#l12Apply', root).onclick = () => { const g = id => +$(id, root).value; const patch = { cpc: g('#l12Cpc'), fee: g('#l12Fee') / 100, budget: g('#l12Bud'), lines: {} }; patch.lines[k] = { rep: g('#l12Rep') / 100, val: g('#l12Val'), cpcMul: g('#l12CpcM'), cvr: g('#l12Cvr'), close: g('#l12Close') }; SLM.set(patch); toast('Assumptions applied'); };
      $('#l12Reset', root).onclick = () => { SLM.reset(); toast('Defaults restored'); };
      $('#l12Kw', root).innerHTML = `<div class="dsec" style="margin-top:0">Keywords (phrase and exact)</div><div class="chips">${l.kw.map(w => `<span class="chip">${esc(w)}</span>`).join('')}</div>
        <div class="dsec">Spanish</div><div class="chips">${(l.kwEs || []).map(w => `<span class="chip">${esc(w)}</span>`).join('') || '<span class="mini">None set</span>'}</div>
        <div class="dsec">Negatives for this line</div><div class="chips">${l.neg.map(w => `<span class="chip dim">${esc(w)}</span>`).join('')}</div>
        <div class="dsec">Negatives for every line</div><div class="chips">${NEG_COMMON.map(w => `<span class="chip dim">${esc(w)}</span>`).join('')}</div>
        <div class="dsec">Copy angles (filled with your company settings)</div>${l.angles.map(a => `<div class="adprev"><div class="ah">${esc(fillCopy(a.h))}</div><div class="ad">${esc(fillCopy(a.d))}</div><div class="mini">${a.lang === 'es' ? 'Spanish · ' : ''}${esc(a.id)}</div></div>`).join('')}
        <p class="mini" style="margin-top:8px">Location words in keywords ("near me", city names) come from the Campaign Desk's geo build. Avoid "best", "#1", "top rated", "lifetime" and "fireproof" in copy unless a named source, a listing or the written warranty backs it, put the license number in every ad (Business and Professions Code 7030.5), never offer to negotiate a claim (that is public adjusting, Insurance Code 15006) and never offer to pay or waive a deductible. The Satchel (module 10) screens copy against the full rule pack.</p>`;
      const fl = LINE_FIRMS(k); const tw = { statewide: 3, national: 2.5, regional: 1.5, local: 1 }; const LIC = META.lic || {}; const CBP = META.cbp || {};
      $('#l12Comp', root).innerHTML = `<div class="rowl"><span>C-39 roofing licenses, active (CSLB, November 2026)</span><b>${N(LIC.clear || LIC.n)}</b></div><div class="rowl"><span>Hold C-39 alone · out of state address</span><b>${N(LIC.only)} · ${N(LIC.out)}</b></div><div class="rowl"><span>Roofing employer establishments · employees (CBP 2023)</span><b>${N(CBP.est)} · ${N(CBP.emp)}</b></div>
        <p class="mini" style="margin:8px 0">A license says who may sell roofing, not which lines a firm sells: no public file records that, and no ranked list of California roofers by size exists. The companies below are only those named in public sources read for this build (${N(COMP.length)} in all); ${N(fl.length)} of them list ${esc(lc(l.name))}. Add the firms you meet in the field in module 13.</p><div class="xscroll"><table><thead><tr><th class="l">Company</th><th class="l">Reach</th><th class="l">Cities</th><th class="l">Lines</th></tr></thead><tbody>${fl.sort((a, b) => tw[b.tier] - tw[a.tier] || a.name.localeCompare(b.name)).map(c => `<tr><td class="l wrap"><b>${esc(c.name)}</b>${c.verified ? '' : ' <span class="pill" title="Not verified on the company\'s site; from public listings">listing</span>'}</td><td class="l">${esc(c.tier)}</td><td class="l wrap">${esc((c.cities || []).slice(0, 5).join(', '))}${(c.cities || []).length > 5 ? ' +' + ((c.cities || []).length - 5) : ''}</td><td class="l">${N((c.lines || []).length)}</td></tr>`).join('') || '<tr><td colspan="4" class="l mini">No named company lists this line.</td></tr>'}</tbody></table></div>
        <p class="mini" style="margin-top:8px">Module 07 maps license density and establishments by ZIP; module 13 watches the ads of the firms you add.</p>`;
      // seasons heat table
      const R = ramp('green'); const allv = PL.flatMap(x => SEAv(x.key)); const sc = qScale(allv, 'green', 1);
      const pkM = key => { const a = SEAv(key); const i = a.indexOf(Math.max(...a)); return { m: MONL[i], v: a[i], m2: MONL[a.map((v, j) => [v, j]).sort((x, y) => y[0] - x[0])[1][1]] }; };
      const sP = pkM('storm'), fP = pkM('fire'), rP = pkM('repair'), cP = pkM('coat'); const wet = HZ.wetShare(st.reg && HZ.rainR[+st.reg] ? HZ.rainR[+st.reg] : HZ.rain);
      $('#l12Sea', root).innerHTML = `<div class="xscroll"><table class="heat"><thead><tr><th class="l">Line</th>${SLM.MONTHS.map(m => `<th>${m}</th>`).join('')}<th>Grade</th></tr></thead><tbody>${PL.map(x => `<tr class="${x.key === k ? 'sel' : ''}"><td class="l"><b>${esc(x.short)}</b></td>${SEAv(x.key).map(v => { const c = sc.f(v); return `<td style="background:${c};color:${textOn(c)}">${v}</td>`; }).join('')}<td>${G(SLM.LI[x.key].mg)}</td></tr>`).join('')}</tbody></table></div>
        <p class="chartnote">${esc(st.reg ? REGN[st.reg] : ATLAS.state)}${wet != null ? `: ${P(wet, 0)} of the year's normal rain falls from November to March` : ''}. Leaks and repairs follow the rain and peak in ${rP.m}; wind and rain damage follows the atmospheric rivers and winter fronts with a lag, busiest in ${sP.m} and ${sP.m2} (${D(sP.v / 100, 1)} times an average month). Fire work peaks in ${fP.m} and ${fP.m2}, after the offshore wind season, though a rebuild runs for years. Reroofs, tile relays, solar and metal want dry weather; coatings most of all, peaking in ${cP.m}. Hardening is a planning shape ahead of fire season. Where each row comes from: ${PL.map(x => `<b>${esc(lc(x.short))}</b> ${esc(SLM.SEA_SRC[x.key] || '')} ${G(SLM.SEA_G[x.key])}`).join('; ')}. A flat part of a row means the data carried no series for it, not that the line has no season.</p>`;
      // portfolio
      const bud = SLM.A.budget; const lw = PL.map(x => { const pa = SLM.A.lines[x.key]; const pool = sum(ZR.map(z => z['p_' + x.key] || 0)); const fees = pool * pa.rep * pa.val * SLM.A.fee; const ue = SLM.blended(SLM.LI[x.key], null); return { x, fees, ue }; });
      const mw = SLM.MONTHS.map((_, m) => lw.map(o => Math.pow(Math.max(0, o.fees * SEAv(o.x.key)[m] / 100) / Math.max(1, o.ue.cpc), SLM.A.alpha)));
      const yr = lw.map((o, i) => sum(mw.map(w => bud * w[i] / sum(w)))); const ord = yr.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]);
      $('#l12Port', root).innerHTML = `<div class="xscroll"><table><thead><tr><th class="l">Line</th>${SLM.MONTHS.map(m => `<th>${m}</th>`).join('')}<th>Year</th></tr></thead><tbody>${lw.map((o, i) => { const row = mw.map(w => bud * w[i] / sum(w)); return `<tr class="${o.x.key === k ? 'sel' : ''}"><td class="l"><b>${esc(o.x.short)}</b></td>${row.map(v => `<td>${K(v)}</td>`).join('')}<td><b>${K(sum(row))}</b></td></tr>`; }).join('')}</tbody></table></div>
        <p class="chartnote">${M$(bud)} a month, split by gross profit pool × season ÷ cost per click, raised to ${D(SLM.A.alpha, 1)} (above 1 concentrates money in the strongest lines). ${esc(lw[ord[0][1]].x.name)} and ${esc(lc(lw[ord[1][1]].x.name))} take ${P(100 * (ord[0][0] + ord[1][0]) / Math.max(1, sum(yr)), 0)} of the year at the defaults because they carry the most pool per click; a company that does not do a line should zero its ticket in the assumptions card and the split follows.</p>`;
      const fx = lw.map(o => ({ l: o.x.short, v: o.fees, t: MM(o.fees), color: o.x.key === k ? cssv('--ink') : R[5] })).sort((a, b) => b.v - a.v);
      hbarChart($('#l12Mix', root), fx, { W: 520, L: 110, R: 60, aria: 'Gross profit pool a year by service line' });
      $('#l12Mix', root).insertAdjacentHTML('beforeend', `<p class="chartnote">${MM(sum(lw.map(o => o.fees)))} a year across the ${nl} lines at the current tickets, shares and margin: the market's gross profit, not one company's. For scale, the 2022 Economic Census counted $6.21 billion of revenue at California roofing contractors (2,781 establishments, 25,383 employees), with materials at 34 percent of revenue. Storm and fire are long run averages; a real year is either quiet or enormous.</p>`);
      const DP = SLM.DAYPARTS; const tplOf = t => listAnd(PL.filter(x => x.dayparts === t).map(x => lc(x.short))); const tpl = { emergency: capFirst(tplOf('emergency')) + ' (emergency)', retail: capFirst(tplOf('retail')) + ' (planned purchase)', b2b: capFirst(tplOf('b2b')) + ' (business hours)' };
      const all = HZ.hour.all; const blk = all ? [[0, 6], [6, 9], [9, 12], [12, 17], [17, 21], [21, 24]].map(([a, b]) => sum(all.slice(a, b)) / sum(all) * 100 / ((b - a) / 24 * 100)) : null;
      $('#l12Day', root).innerHTML = `<div class="xscroll"><table><thead><tr><th class="l">Template</th>${SLM.BLOCKS.map(b => `<th>${b}</th>`).join('')}</tr></thead><tbody>${Object.keys(tpl).map(t => `<tr class="${SLM.LI[k].dayparts === t ? 'sel' : ''}"><td class="l"><b>${tpl[t]}</b></td>${DP[t].map(v => `<td>${S(v, 0)}%</td>`).join('')}</tr>`).join('')}${blk ? `<tr><td class="l">Weather and fire reports by hour, index to an even spread</td>${blk.map(v => `<td>${D(v, 2)}×</td>`).join('')}</tr>` : ''}</tbody></table></div>
        <p class="chartnote">${blk ? `Located wind, rain and fire reports run ${D(blk[0], 1)} times an even spread overnight, ${D(blk[3], 1)} times from noon to 5 p.m. and ${D(blk[4], 1)} times from 5 to 9 p.m. ` : 'The data carries no reports by hour, so the last row is left out. '}California's roof weather is not an afternoon thunderstorm: an atmospheric river rains for a day or two and the wind often peaks at night, so owners find the leak in the morning. The emergency template keeps bids up from early morning to late evening; planned purchases are researched in the day and evening, and business buyers in office hours. Each template is one row of six blocks, the same every day of the week. Replace every template with the hour report from your accounts (module 15) after 60 days.</p>`;
      $('#l12Method', root).innerHTML = proseTable(PL.map(x => [`<b>${esc(x.name)}</b> ${G(x.g)}`, esc(x.what)]));
      const rep = PL.map(x => `${lc(x.short)} ${P(100 * META.model.REP[x.key], 0)}`);
      $('#l12Judg', root).innerHTML = proseTable([
        ['Counted where the roof is', 'Every line is counted at the ZIP of the building, which is usually where the owner searches from. Cabins and second homes count where they stand, though their owners often search from home.'],
        ['Jobs open to marketing', `The share of a line's jobs a contractor wins through search, ads, referrals or the door (${listAnd(rep)}) is an assumption; the rest go to repeat contractors, insurer programs, handymen or the owner. It is the most uncertain number on the page.`],
        ['The pool is not revenue', 'The gross profit pool is the whole market\'s margin at the defaults, not one company\'s share. A company\'s share depends on its crews, reviews, reputation and competition.'],
        ['Tier is relative', 'Paid tiers rank ZIPs against each other for one line; an A+ ZIP in a thin line can be worth less than a C ZIP in the replacement line.'],
        ['Lines do not double count', 'Tile relays count only in the tile line; metal and most hardening reroofs are carved out of replacement; solar detach and reset is counted once, beside the reroof it serves; mobile homes and buildings of five or more units count only in their own lines.'],
        ['Insurance pays for few roofs here', `Insurance paid for ${P((AM.la || {}).ins, 1)} of roof jobs in the Los Angeles metro, ${P((AM.sf || {}).ins, 1)} in San Francisco and Oakland and ${P((AM.riv || {}).ins, 1)} in Riverside and San Bernardino (American Housing Survey 2023), against 41 percent in the west south central states. The storm line is sized from that share, so it is small beside wear; do not plan a claim funded business from it.`],
        ['Storm and fire are averages', 'The storm line is an average year; a wet winter such as 2023 runs far above it (Los Angeles issued 40 percent more reroof permits that year). The fire line is an average of years that held the Camp, Tubbs, Palisades and Eaton fires and years that held none. Plan crews and cash for the average and keep a plan for the year it lands (module 14).'],
        ['Hardening rides on insurance, not on a grant', `The line counts owners in wildfire exposed homes acting on an insurer's or the FAIR Plan's terms (the Plan takes up to ${D((META.harden || {}).fair_disc, 1)} percent off its wildfire premium for all twelve measures). The California Safe Homes grant program had ${MM((META.harden || {}).safe_homes26)} secured and no grant amounts set when this was compiled: never promise a grant or a discount size.`],
      ]);
      $('#l12Foot', root).innerHTML = `<b style="color:var(--ink)">${ATLAS.name}</b>, module 12. Lines resolved to ${N(ZR.length)} scored ZIPs. Defaults are placeholders; assumptions you change are stored in this browser and flow to modules 01, 05, 08, 09 and 15.`;
    }
    // wiring
    wireSeg($('#l12Lines', root), v => { st.k = v; render(); });
    wireSeg($('#l12Met', root), v => { st.metric = v; render(); });
    $('#l12Reg', root).onchange = e => { st.reg = e.target.value; st.par = ''; $('#l12Par', root).value = ''; if (st.sel && !(ZI[st.sel] && inScope(ZI[st.sel]))) st.sel = null; if (st.reg) map.fitCounties(PA.filter(p => p.reg === +st.reg).map(p => p.fips)); else map.reset(); staticFor = null; render(); };
    $('#l12Par', root).onchange = e => { st.par = e.target.value; if (st.par && st.reg && PAI[st.par] && PAI[st.par].reg !== +st.reg) { st.reg = ''; $('#l12Reg', root).value = ''; } if (st.sel && !(ZI[st.sel] && inScope(ZI[st.sel]))) st.sel = null; if (st.par) map.fitCounties([st.par]); else map.reset(); staticFor = null; render(); };
    $('#l12Find', root).addEventListener('change', e => { const q = e.target.value.trim().toLowerCase(); if (!q) return; const hit = ZI[q] || ZR.filter(z => (z.city || '').toLowerCase().startsWith(q)).sort((a, b) => b.pop - a.pop)[0]; if (hit) { st.sel = hit.res_ok ? hit.zip : null; map.fitTo([hit.zip]); render(); if (!hit.res_ok) toast(`${hit.zip} has fewer than 500 residents, so the atlas does not score it`); } else toast('No ZIP or city matches'); });
    $('#l12Csv', root).onclick = () => { const rows = T.filter(t => inScope(t.z)).sort((a, b) => b.eff - a.eff); saveFile(`${ATLAS.file}-${slug(L().name)}-zip-targets.csv`, toCSV(['zip', 'city', 'county', 'residents', 'jobs_a_year', 'per_10k', 'jobs_open_to_marketing', 'gross_profit_pool', 'relative_cpc', 'percentile', 'tier', 'bid_modifier_pct'], rows.map(t => [t.zip, t.z.city, t.z.cty, t.z.pop, +D(t.pool, 2), +D(t.rate, 2), +D(t.cases, 2), Math.round(t.fees), +D(t.z.cpc_rel, 3), +D(t.pct, 1), t.tier, t.bid]), `${ATLAS.name}, module 12, ${L().name}. Defaults or your saved assumptions at ${new Date().toISOString().slice(0, 10)}.`)); };
    $('#l12CityCsv', root).onclick = () => { const rows = lineCities(st.k).sort((a, b) => b.fees - a.fees); const h1 = ((typeof FCOPY !== 'undefined' && FCOPY.AC ? FCOPY.AC[st.k] : null) || {}).h1 || (L().name + ' in {city}'); saveFile(`${ATLAS.file}-${slug(L().name)}-city-pages.csv`, toCSV(['city', 'county', 'residents', 'zips', 'jobs_a_year', 'jobs_open_to_marketing', 'gross_profit_pool', 'c39_licenses_within_8km', 'spanish_at_home_pct', 'page_plan', 'suggested_h1'], rows.map(r => [r.name, PA[r.pi] ? PA[r.pi].name : '', r.pop, r.nzip, +D(r.pool, 1), +D(r.cases, 2), Math.round(r.fees), r.comp, +D(r.span, 1), pagePlan(r), houseClean(h1.replace('{city}', r.name))]), `${ATLAS.name}, module 12, ${L().name}. H1s are starting points; verify internal links against the live sitemap.`)); };
    $('#l12Desk', root).onclick = () => goModule('desk', { zips: st.sel ? [st.sel] : T.filter(t => inScope(t.z)).sort((a, b) => b.eff - a.eff).slice(0, 25).map(t => t.zip), line: st.k });
    $('#l12Forge', root).onclick = () => { const cs = lineCities(st.k).filter(c => (!st.par || (PA[c.pi] && PA[c.pi].fips === st.par)) && (!st.reg || (PA[c.pi] && PA[c.pi].reg === +st.reg))).sort((a, b) => b.fees - a.fees).slice(0, 12); goModule('forge', { zips: cs.map(c => c.c.zips[0]).filter(Boolean), line: st.k }); };
    BUS.on('theme', () => { staticFor = null; render(); }); BUS.on('slm', () => { staticFor = null; render(); }); BUS.on('brand', () => { staticFor = null; render(); });
    this.receive = p => { if (!p) return; if (p.line && PLI[p.line]) { st.k = p.line; staticFor = null; $$('#l12Lines button', root).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === st.k))); } if (p.zip && ZI[p.zip]) { st.sel = ZI[p.zip].res_ok ? p.zip : null; map.fitTo([p.zip]); } render(); };
    render();
  }
});
