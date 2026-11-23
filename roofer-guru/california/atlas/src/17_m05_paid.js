/* ==== 17_m05_paid.js ==== */
/* ==== src/17_m05_paid.js ==== */
/* ==== m05_paid ==== */
"use strict";
/* the main television and search media market each region buys through (a description by the editor of this atlas, not
   a file of market boundaries: several regions straddle two markets). The cost factor of each region is in the data
   (meta.model.DMA, an assumption, grade D). Region numbers follow DESIGN.md: 1 North Coast to 11 San Diego and Imperial. */
const REG_MKT = { 1: 'Eureka; San Francisco for Mendocino and Lake', 2: 'Chico and Redding', 3: 'Sacramento; Chico for Butte and Glenn', 4: 'Sacramento, Fresno and Reno', 5: 'San Francisco, Oakland and San Jose', 6: 'Monterey and Salinas; Santa Barbara and San Luis Obispo', 7: 'Fresno and Bakersfield; Sacramento for Stockton and Modesto', 8: 'Los Angeles', 9: 'Los Angeles', 10: 'Los Angeles; Palm Springs for the Coachella Valley', 11: 'San Diego; Yuma and El Centro for Imperial' };
const QUAD_PLAY = [
  ['Anchor', 'High job flow, crowded field', 'Defend: exact and phrase match on the line terms, brand plus city ad groups, highest bids only where the tier is A or better. Organic: city pages with local roof age, weather, fire zone and insurance facts, reviews, photos of local jobs and pages in the languages the city speaks; these markets are won on trust and coverage, not on bids.'],
  ['Whitespace', 'High job flow, thin field', 'Expand first: the cheapest sold jobs in the state sit here. Broader match, radius around the ZIP cluster, Local Services Ads where available, and a city page for every town in the cluster. This is the first money of any new budget.'],
  ['Niche', 'Low job flow, thin field', 'Maintain: low bids and county level pages; let organic, maps and referrals carry the volume. Raise the line that is unusually strong in the ZIP (module 12), not the whole account.'],
  ['Avoid', 'Low job flow, crowded field', 'Exclude or bid down 50%: clicks priced by roofers chasing the neighboring metro. Keep the brand terms on.'],
];
/* quadrant colors stay in the atlas palette: dark green anchor, teal whitespace, neutral niche, magenta avoid */
const quadColor = q => [ramp('green')[7], ramp('teal')[4], cssv('--line-strong'), ramp('div')[1]][q];
/* ============================ Module 5: Paid Acquisition ============================ */
registerModule({
  key: 'paid', num: '05', title: 'Paid Acquisition', desc: 'Where an ad dollar reaches the most sold jobs: gross profit pool per click cost, quadrants, tiers and bid modifiers by ZIP',
  mount(root) {
    const st = { lines: new Set(LINE_KEYS), metric: 'tier', reg: '', par: '', sel: null, set: 'A', n: 40 };
    const PL = SLM.LINES, PLI = SLM.LI; const nl = numWord(NLINE); const DMA = META.model.DMA || {};
    const dmaS = REG_KEYS.filter(k => isN(DMA[k])).sort((a, b) => DMA[b] - DMA[a]); const dHi = dmaS[0], dLo = dmaS[dmaS.length - 1];
    const dmaSpan = dmaS.length ? `${REGN[dHi]} ${D(DMA[dHi], 2)} down to ${REGN[dLo]} ${D(DMA[dLo], 2)}` : 'set in the data';
    const licTop = ((META.lic || {}).top || []).slice(0, 3).map(r => r[0]);
    root.innerHTML = mastHTML({ eyebrow: 'Module 05 · Paid Acquisition · every scored ZIP', title: 'Paid Acquisition', dek: 'Job flow is not the same as a good place to spend. Los Angeles, Orange County, the Bay Area and San Diego carry the most roofs and the most expensive clicks, because every large roofer and every lead seller buys them. This module divides each ZIP\'s gross profit pool by what a click is likely to cost there, splits the state into four quadrants of demand and competition, and turns the ranking into tiers and bid modifiers the Campaign Desk can upload.',
      meta: [`<b>ZIPs</b> ${N(ZR.length)} scored`, '<b>Cost</b> modeled from region and competition (grade D)', `<b>Lines</b> choose any mix of the ${nl}`, '<b>Output</b> tiers, bid modifiers, budget split'],
      bar: 'Paid Acquisition', barsub: 'Gross profit pool per relative click cost',
      actions: [{ id: 'p5Csv', label: '↓ Bid modifiers CSV' }, { id: 'p5ParCsv', label: '↓ County rollup CSV' }, { id: 'p5Desk', label: 'Campaign Desk ↗', title: 'Send the planned ZIPs to the Campaign Desk' }] }) +
      `<div class="wrap">
      ${callout('', 'Read this first: what this module claims and does not', `Efficiency here is <b>gross profit pool a year ÷ relative cost per click</b>, ranked across the scored ZIPs. The gross profit pool comes from the service line model at your assumptions (module 12). The relative cost is a stated model, not a keyword pull: a regional factor for each media market (${esc(dmaSpan)}; assumptions) times a competition term from the C-39 roofing licenses and the roofing employers nearby (0.8 to 1.2). No keyword planner, auction or Ahrefs data was used. When your accounts are connected (module 15), actual cost per click and cost per sold job replace the model ZIP by ZIP.`)}
      <div class="kpis" id="p5Kpis"></div>
      <div class="controls">
        <div class="ctl" style="flex:1 1 100%"><span class="fl">Service lines in the plan</span><div class="chips" id="p5Lines">${PL.map(l => `<button type="button" class="chip on" data-k="${l.key}" aria-pressed="true">${esc(l.short)}</button>`).join('')}<button type="button" class="chip" id="p5All">All</button><button type="button" class="chip" id="p5Crash">Weather and fire lines only</button><button type="button" class="chip" id="p5Res">Residential only</button><button type="button" class="chip" id="p5Com">Commercial only</button></div></div>
        <div class="ctl"><label class="fl" for="p5Met">Map layer</label><select id="p5Met"><option value="tier">Paid tier and bid modifier</option><option value="quad">Quadrant</option><option value="eff">Efficiency percentile</option><option value="fees">Gross profit pool a year</option><option value="cpc">Relative cost per click</option><option value="comp">Competitive pressure</option></select></div>
        <div class="ctl"><label class="fl" for="p5Reg">Region</label><select id="p5Reg"><option value="">All ${numWord(NREG)} regions</option>${REG_KEYS.map(k => `<option value="${k}">${esc(REGN[k])}</option>`).join('')}</select></div>
        <div class="ctl"><label class="fl" for="p5Par">County</label><select id="p5Par"><option value="">All ${NCOUNTY} counties</option>${PA.slice().sort((a, b) => a.name.localeCompare(b.name)).map(p => `<option value="${p.fips}">${esc(p.name)}</option>`).join('')}</select></div>
      </div>
      <div class="grid2">
        <div class="card mapcard"><div id="p5Map"></div><div class="legend" id="p5Leg"></div></div>
        <div class="stack">
          <div class="card"><div class="card-h" style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start"><div><h3 id="p5Name"></h3><p id="p5Sub"></p></div><span class="pill" id="p5Pill"></span></div><div class="card-b" id="p5Detail"></div></div>
          <div class="card"><div class="card-h"><h3>Ranking by efficiency</h3><p>Gross profit pool per relative click cost. Click a row to select it.</p></div><div class="tscroll short" id="p5Tbl"></div></div>
        </div>
      </div>
      <div class="split">
        ${card('The four quadrants', 'Job flow (gross profit pool percentile) against competitive pressure, split at the 60th percentile of each. Each quadrant gets a different play.', '<div id="p5Quad"></div>')}
        ${card('Demand against competition', 'Every scored ZIP. Upper left is whitespace: high job flow, few roofers.', '<div id="p5Sc"></div><div id="p5ScLeg"></div>')}
      </div>
      ${card('What a ZIP set costs to own', 'A monthly budget spread across a target set by gross profit pool per click cost, with the clicks, leads, sold jobs and gross profit it buys at your assumptions. Change the inputs; the table follows.', '<div id="p5Plan"></div>', 'mt')}
      <div class="split">
        ${card('Coherence check: this map disagrees with module 01, on purpose', 'Module 01 ranks job flow per resident. This module ranks gross profit per dollar of clicks. Where they disagree is where the budget decision lives.', '<div id="p5Coh"></div>')}
        ${card('Region cost factors', 'The regional half of the cost model, by main media market. Replace with account actuals as they arrive.', '<div id="p5Reg2"></div>')}
      </div>
      ${card('County rollup: where the money sits', 'Gross profit pool, cost and tiers by county for the lines in the plan.', '<div class="tscroll" id="p5Pars"></div>', 'mt')}
      ${card('City rollup', 'The same by city (postal city name, 1,500 residents or more).', '<div class="tscroll short" id="p5Cities"></div>', 'mt')}
      <div class="split">
        ${card('How the model is built', 'Every step from gross profit pool to bid modifier.', '<div id="p5Method"></div>')}
        ${card('Judgment calls, exclusions and caveats', 'What the module deliberately does not use, and why.', '<div id="p5Judg"></div>')}
      </div>
      <div class="foot" id="p5Foot"></div></div>`;
    let R = [], RI = {};
    const inScope = z => (!st.par || z.fips === st.par) && (!st.reg || (PA[z.pi] && PA[z.pi].reg === +st.reg));
    function compute() {
      const keys = [...st.lines];
      R = ZR.map(z => { const a = SLM.zipAll(z, keys); return { z, zip: z.zip, fees: a.fees, cases: a.cases, pool: a.pool, cpc: z.cpc_rel || 1, comp: z.comp_pct, eff: a.fees / Math.max(0.3, z.cpc_rel || 1) }; });
      const rank = (k, o) => { const v = R.map(x => x[k]).sort((a, b) => a - b); const n = v.length; R.forEach(x => { let lo = 0, hi = n; while (lo < hi) { const m = (lo + hi) >> 1; if (v[m] < x[k]) lo = m + 1; else hi = m; } x[o] = lo / n * 100; }); };
      rank('eff', 'pct'); rank('fees', 'opp');
      R.forEach(x => { x.tier = LINE_TIER(x.pct); x.bid = TIER_BID[x.tier]; const hd = x.opp >= 60, hc = (x.comp || 0) >= 60; x.quad = hd && hc ? 0 : hd ? 1 : !hc ? 2 : 3; });
      RI = {}; R.forEach(x => RI[x.zip] = x);
    }
    const map = new ZipMap($('#p5Map', root), { segHit: 'none', roads: false, onSelect: z => { st.sel = st.sel === z ? null : z; render(); },
      onHover: (z, e) => { const x = RI[z]; if (!x) return; showTip(`<div class="tt">${esc(z)} · ${esc(x.z.city)}</div><div class="ts">${esc(x.z.cty)} County · ${QN[x.quad]}</div>${tipRow('Gross profit pool a year', MM(x.fees))}${tipRow('Relative cost per click', D(x.cpc, 2) + '×')}${tipRow('Efficiency percentile', D(x.pct, 0))}${tipRow('Tier · bid modifier', x.tier + ' · ' + S(x.bid, 0) + '%')}<div class="tf">Click for the ZIP ledger</div>`, e); },
      onPin: id => goModule('field', { comp: +String(id).split(':')[0] }) });
    function render() {
      compute(); const R8 = ramp('green');
      if (st.metric === 'tier') { const TC = { 'A+': 7, A: 6, B: 5, C: 3, D: 2, E: 1 }; map.fill(zip => RI[zip] ? R8[TC[RI[zip].tier]] : null); $('#p5Leg', root).innerHTML = `<div><div class="lt">Paid tier and bid modifier</div><div class="ramp">${['E', 'D', 'C', 'B', 'A', 'A+'].map(t => `<i style="background:${R8[TC[t]]}"></i>`).join('')}</div><div class="rlabs"><span>E −50%</span><span>A+ +30%</span></div></div><div class="dn"><b>Darker ZIPs return more gross profit per click dollar</b> for the lines in the plan. A+ top 5% (+30%), A next 10% (+20%), B next 20% (+10%), C 25% (0), D 25% (−20%), E bottom 15% (−50%). ${G('D')}</div>`; }
      else if (st.metric === 'quad') { map.fill(zip => RI[zip] ? quadColor(RI[zip].quad) : null); $('#p5Leg', root).innerHTML = `<div><div class="lt">Quadrant</div><div class="chartleg" style="margin:4px 0 0">${QN.map((q, i) => `<span><i class="sq" style="background:${quadColor(i)}"></i>${q}</span>`).join('')}</div></div><div class="dn"><b>Demand against competition</b>, each split at the 60th percentile. Whitespace is high job flow with a thin field: the first money of any budget. ${G('C')}</div>`; }
      else { const key = { eff: 'pct', fees: 'fees', cpc: 'cpc', comp: 'comp' }[st.metric]; const rp = st.metric === 'cpc' || st.metric === 'comp' ? 'teal' : 'green'; const vals = R.map(x => x[key]); const sc = qScale(vals, rp, 1); map.fill(zip => RI[zip] ? sc.f(RI[zip][key]) : null); const f = st.metric === 'fees' ? MM : st.metric === 'cpc' ? (v => D(v, 2) + '×') : (v => D(v, 0)); const lab = { eff: 'Efficiency percentile', fees: 'Gross profit pool a year', cpc: 'Relative cost per click', comp: 'Competitive pressure percentile' }[st.metric];
        $('#p5Leg', root).innerHTML = legendHTML({ title: lab, R: sc.R, lo: f(Math.min(...vals)), hi: f(Math.max(...vals)), note: `<b>${st.metric === 'cpc' ? 'Darker ZIPs cost more per click' : st.metric === 'comp' ? 'Darker ZIPs face more roofing licenses and employers nearby' : 'Darker ZIPs carry more'}.</b> Eight quantile classes; gray means fewer than 500 residents. ${G(st.metric === 'fees' ? 'D' : 'C')}` }); }
      map.dim((st.par || st.reg) ? new Set(Z.filter(inScope).map(z => z.zip)) : null); map.select(st.sel);
      map.pins(st.metric === 'comp' ? COMP.flatMap((c, i) => (c.offices || []).map((o, j) => ({ id: i + ':' + j, lat: o.lat, lon: o.lon, r: c.tier === 'statewide' ? 5 : c.tier === 'national' ? 4.4 : c.tier === 'regional' ? 3.6 : 2.8, fill: cssv('--ink'), shape: o.hq ? 'diamond' : '', op: .85 }))) : []);
      kpis(); drawTable(); drawDetail(); drawQuad(); drawPlan(); drawRoll(); drawCoh();
    }
    function kpis() {
      const tot = sum(R.map(x => x.fees)); const top = R.filter(x => x.tier === 'A+' || x.tier === 'A'); const ws = R.filter(x => x.quad === 1);
      const keys = [...st.lines]; const ue = keys.map(k => SLM.blended(SLM.LI[k], null)); const fw = keys.map(k => sum(ZR.map(z => SLM.zipLine(z, k).fees))); const fs = sum(fw) || 1;
      const cps = sum(ue.map((u, i) => u.cps * fw[i])) / fs, roi = sum(ue.map((u, i) => u.roi * fw[i])) / fs;
      $('#p5Kpis', root).innerHTML = kpiHTML([
        { l: 'Gross profit pool in the plan', g: 'D', v: MM(tot), d: `${N(keys.length)} line${keys.length === 1 ? '' : 's'} · ${N(R.length)} ZIPs` },
        { l: 'Tier A+ and A ZIPs', g: 'D', v: N(top.length), d: `${P(sum(top.map(x => x.fees)) / tot * 100, 0)} of the gross profit pool in ${P(top.length / R.length * 100, 0)} of ZIPs` },
        { l: 'Whitespace ZIPs', g: 'C', v: N(ws.length), d: `${MM(sum(ws.map(x => x.fees)))} gross profit pool with a thin field` },
        { l: 'Cost per sold job', g: 'D', v: M$(cps), d: 'blended across the plan at state average click cost' },
        { l: 'Return on paid', g: 'D', v: D(roi, 1) + '×', d: 'gross profit per job ÷ cost per sold job' },
        { l: 'Click cost spread', g: 'D', v: D(Math.max(...R.map(x => x.cpc)) / Math.min(...R.map(x => x.cpc)), 1) + '×', d: 'most to least expensive ZIP, modeled' },
      ]);
    }
    function drawTable() {
      dataTable($('#p5Tbl', root), [{ k: 'zip', h: 'ZIP', l: 1, f: v => `<b>${esc(v)}</b>` }, { k: 'city', h: 'City', l: 1, v: r => r.z.city }, { k: 'fees', h: 'Profit pool', f: v => MM(v) }, { k: 'cpc', h: 'Cost', f: v => D(v, 2) + '×' }, { k: 'pct', h: 'Pct', f: v => D(v, 0) }, { k: 'tier', h: 'Tier', f: v => `<span class="tier t${v.replace('+', 'p')}">${v}</span>` }, { k: 'bid', h: 'Bid', f: v => S(v, 0) + '%' }],
        R.filter(x => inScope(x.z)), { sortKey: 'pct', id: r => r.zip, onClick: z => { st.sel = st.sel === z ? null : z; render(); }, rowClass: r => r.zip === st.sel ? 'sel' : '' });
    }
    function drawDetail() {
      const x = st.sel ? RI[st.sel] : null;
      if (!x) {
        const rows = R.filter(r => inScope(r.z)); const nm = st.par ? PNAME(st.par) + ' County' : st.reg ? REGN[st.reg] : ATLAS.state;
        $('#p5Name', root).textContent = nm; $('#p5Sub', root).textContent = 'Click a ZIP for its cost ledger'; $('#p5Pill', root).textContent = st.par ? 'County' : st.reg ? 'Region' : 'State';
        $('#p5Detail', root).innerHTML = `<div class="big">${MM(sum(rows.map(r => r.fees)))}<span style="font-size:13px;font-weight:500;color:var(--ink-3)"> gross profit pool a year</span></div><div class="mini" style="margin-bottom:10px">${N(rows.length)} ZIPs · mean relative click cost ${D(mean(rows.map(r => r.cpc)), 2)}×</div>
          ${QN.map((q, i) => { const a = rows.filter(r => r.quad === i); return `<div class="rowl"><span><i class="qsw" style="background:${quadColor(i)}"></i>${q} · ${N(a.length)} ZIPs</span><b>${MM(sum(a.map(r => r.fees)))}</b></div>`; }).join('')}
          <div class="dsec">Tiers</div>${['A+', 'A', 'B', 'C', 'D', 'E'].map(t => { const a = rows.filter(r => r.tier === t); return `<div class="rowl"><span><span class="tier t${t.replace('+', 'p')}">${t}</span> ${N(a.length)} ZIPs · bid ${S(TIER_BID[t], 0)}%</span><b>${MM(sum(a.map(r => r.fees)))}</b></div>`; }).join('')}`;
        return;
      }
      const z = x.z; const reg = PA[z.pi].reg; const dma = DMA[reg] || 1; const cterm = x.cpc / dma;
      $('#p5Name', root).textContent = `${z.zip} · ${z.city}`; $('#p5Sub', root).textContent = `${z.cty} County · ${REGN[reg]} · ${N(z.pop)} residents`; $('#p5Pill', root).textContent = QN[x.quad];
      $('#p5Detail', root).innerHTML = `<div class="big">${x.tier}<span style="font-size:13px;font-weight:500;color:var(--ink-3)"> tier · bid ${S(x.bid, 0)}%</span></div><div class="mini" style="margin-bottom:10px">Efficiency percentile ${D(x.pct, 0)} · profit pool percentile ${D(x.opp, 0)} · pressure ${D(x.comp, 0)}</div>
        <div class="rowl"><span>Gross profit pool a year (plan lines)</span><b>${MM(x.fees)}</b></div>
        <div class="rowl"><span>Jobs open to marketing a year</span><b>${D(x.cases, 1)}</b></div>
        <div class="rowl"><span>Relative click cost</span><b>${D(x.cpc, 2)}× = ${D(dma, 2)} region × ${D(cterm, 2)} competition</b></div>
        <div class="rowl"><span>C-39 licenses within 25 km · in the ZIP · roofing employers in the ZIP</span><b>${N(z.comp_n25)} · ${N(z.lic)} · ${N(z.roofers)}</b></div>
        <div class="dsec">Gross profit pool by line</div>${[...st.lines].map(k => { const o = SLM.zipLine(z, k); return `<div class="rowl"><span>${esc(PLI[k].name)}</span><b>${MM(o.fees)}</b></div>`; }).join('')}
        <p class="mini" style="margin-top:10px">${esc(QUAD_PLAY[x.quad][2])}</p>
        <div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap"><button class="ibtn" id="p5ZL">Service Lines ↗</button><button class="ibtn" id="p5ZD">This ZIP to the Desk ↗</button></div>`;
      $('#p5ZL', root).onclick = () => goModule('lines', { zip: z.zip }); $('#p5ZD', root).onclick = () => goModule('desk', Object.assign({ zips: [z.zip] }, st.lines.size === 1 ? { line: [...st.lines][0] } : {}));
    }
    function drawQuad() {
      const tot = sum(R.map(x => x.fees)), pop = sum(R.map(x => x.z.pop));
      $('#p5Quad', root).innerHTML = `<div class="xscroll"><table><thead><tr><th class="l">Quadrant</th><th>ZIPs</th><th>Residents</th><th>Profit pool</th><th>Cost</th></tr></thead><tbody>${QUAD_PLAY.map((q, i) => { const a = R.filter(x => x.quad === i); return `<tr><td class="l"><i class="qsw" style="background:${quadColor(i)}"></i><b>${q[0]}</b><div class="mini">${q[1]}</div></td><td>${N(a.length)}</td><td>${P(sum(a.map(x => x.z.pop)) / pop * 100, 0)}</td><td>${P(sum(a.map(x => x.fees)) / tot * 100, 0)}</td><td>${D(median(a.map(x => x.cpc)), 2)}×</td></tr>`; }).join('')}</tbody></table></div>` + proseTable(QUAD_PLAY.map((q, i) => [`<i class="qsw" style="background:${quadColor(i)}"></i><b>${q[0]}</b>`, esc(q[2])]));
      const pts = R.map(x => ({ x: x.comp, y: x.opp, c: quadColor(x.quad), r: 3.2 + Math.min(5, Math.sqrt(x.fees / 4e5)), op: .7, tip: `<div class="tt">${x.zip} · ${esc(x.z.city)}</div>${tipRow('Quadrant', QN[x.quad])}${tipRow('Gross profit pool a year', MM(x.fees))}${tipRow('Pressure percentile', D(x.comp, 0))}${tipRow('Profit pool percentile', D(x.opp, 0))}`, onClick: () => { st.sel = x.zip; map.fitTo([x.zip]); render(); } }));
      scatter($('#p5Sc', root), { pts, x: { label: 'Competitive pressure percentile', min: 0, max: 100, fmt: v => D(v, 0) }, y: { label: 'Gross profit pool percentile', min: 0, max: 100, fmt: v => D(v, 0) }, fit: false, hlines: [{ y: 60, label: '60th' }], vlines: [{ x: 60, label: '60th' }], H: 340, aria: 'Demand against competition by ZIP' });
      $('#p5ScLeg', root).innerHTML = legendRow(QN.map((q, i) => ({ name: q, color: quadColor(i), sq: 1 })));
    }
    function planSet() {
      const rows = R.filter(x => inScope(x.z));
      if (st.set === 'A') return rows.filter(x => x.tier === 'A+' || x.tier === 'A');
      if (st.set === 'W') return rows.filter(x => x.quad === 1 || x.tier === 'A+');
      return rows.slice().sort((a, b) => b.pct - a.pct).slice(0, st.n);
    }
    function drawPlan() {
      const set = planSet(); const bud = SLM.A.budget; const keys = [...st.lines]; const alpha = SLM.A.alpha;
      const w = set.map(x => Math.pow(Math.max(0, x.fees) / Math.max(0.3, x.cpc), alpha)); const ws = sum(w) || 1;
      const rows = set.map((x, i) => { const b = bud * w[i] / ws; const f = keys.map(k => SLM.zipLine(x.z, k).fees); const fsum = sum(f) || 1; let clicks = 0, leads = 0, cases = 0, fee = 0;
        keys.forEach((k, j) => { const bl = b * f[j] / fsum; const u = SLM.blended(SLM.LI[k], x.z); const c = bl / u.cpc; clicks += c; leads += c * u.cvr / 100; cases += c * u.cvr / 100 * u.close / 100; fee += c * u.cvr / 100 * u.close / 100 * u.feeCase; });
        return { x, zip: x.zip, b, clicks, leads, cases, fee, cap: x.cases / 12 }; });
      rows.forEach(r => { if (r.cases > r.cap) { const k = r.cap / r.cases; r.over = true; r.cases *= k; r.fee *= k; } });
      const T = k => sum(rows.map(r => r[k]));
      $('#p5Plan', root).innerHTML = `<div class="calc"><label class="efld"><span>Monthly budget ($)</span><input type="number" id="p5Bud" value="${bud}" step="1000" min="0"></label><label class="efld"><span>Target set</span><select id="p5Set"><option value="A" ${st.set === 'A' ? 'selected' : ''}>Tiers A+ and A in view</option><option value="W" ${st.set === 'W' ? 'selected' : ''}>Whitespace plus A+ in view</option><option value="N" ${st.set === 'N' ? 'selected' : ''}>Top ZIPs by efficiency in view</option></select></label><label class="efld"><span>How many (top set)</span><input type="number" id="p5N" value="${st.n}" min="5" max="400" step="5"></label><label class="efld"><span>Concentration (alpha)</span><input type="number" id="p5Al" value="${alpha}" min="0" max="3" step="0.1"></label></div>
        <div class="calcout">${N(rows.length)} ZIPs · <b>${M$(T('b'))}</b> a month buys about <b>${N(T('clicks'))}</b> clicks, <b>${N(T('leads'))}</b> leads and <b>${D(T('cases'), 1)}</b> sold jobs worth <b>${MM(T('fee'))}</b> in gross profit at your assumptions: ${M$(T('b') / Math.max(0.01, T('cases')))} per sold job. ${rows.some(r => r.over) ? `Some ZIPs hit their job ceiling (a twelfth of the year's jobs open to marketing); their budget buys clicks without more jobs, so spread wider or lower the budget.` : ''}</div>
        <div class="tscroll short" id="p5PlanT" style="margin-top:10px"></div>`;
      dataTable($('#p5PlanT', root), [{ k: 'zip', h: 'ZIP', l: 1, f: v => `<b>${esc(v)}</b>` }, { k: 'city', h: 'City', l: 1, v: r => r.x.z.city }, { k: 'b', h: 'Budget', f: v => M$(v) }, { k: 'clicks', h: 'Clicks', f: v => N(v) }, { k: 'leads', h: 'Leads', f: v => D(v, 1) }, { k: 'cases', h: 'Jobs', f: (v, r) => D(v, 2) + (r.over ? ' ▲' : '') }, { k: 'fee', h: 'Profit', f: v => MM(v) }, { k: 'bid', h: 'Bid', v: r => r.x.bid, f: v => S(v, 0) + '%' }], rows, { sortKey: 'b' });
      $('#p5Bud', root).onchange = e => SLM.set({ budget: Math.max(0, +e.target.value || 0) }); $('#p5Al', root).onchange = e => SLM.set({ alpha: clamp(+e.target.value || 0, 0, 3) });
      $('#p5Set', root).onchange = e => { st.set = e.target.value; drawPlan(); }; $('#p5N', root).onchange = e => { st.n = clamp(+e.target.value || 40, 5, 400); drawPlan(); };
    }
    function drawRoll() {
      const par = PA.map(p => { const a = R.filter(x => x.z.pi === p.i); const f = sum(a.map(x => x.fees)); return { p, name: p.name, reg: REGN[p.reg], n: a.length, pop: sum(a.map(x => x.z.pop)), fees: f, cpc: f ? sum(a.map(x => x.cpc * x.fees)) / f : null, top: a.filter(x => x.tier === 'A+' || x.tier === 'A').length, ws: a.filter(x => x.quad === 1).length, eff: f / Math.max(0.3, f ? sum(a.map(x => x.cpc * x.fees)) / f : 1) }; }).filter(o => (!st.reg || o.p.reg === +st.reg));
      dataTable($('#p5Pars', root), [{ k: 'name', h: 'County', l: 1, f: v => `<b>${esc(v)}</b>` }, { k: 'reg', h: 'Region', l: 1 }, { k: 'n', h: 'ZIPs', f: v => N(v) }, { k: 'pop', h: 'Residents', f: v => N(v) }, { k: 'fees', h: 'Profit pool', f: v => MM(v) }, { k: 'cpc', h: 'Cost', f: v => D(v, 2) + '×' }, { k: 'eff', h: 'Profit per cost unit', f: v => MM(v) }, { k: 'top', h: 'A+ and A ZIPs', f: v => N(v) }, { k: 'ws', h: 'Whitespace ZIPs', f: v => N(v) }], par, { sortKey: 'fees', id: r => r.p.fips, onClick: f => { st.par = f; $('#p5Par', root).value = f; map.fitCounties([f]); render(); } });
      const cs = CITIES.map(c => { const a = (c.zips || []).map(z => RI[z]).filter(Boolean); const f = sum(a.map(x => x.fees)); return { name: c.name, par: PA[c.pi] ? PA[c.pi].name : '', pi: c.pi, pop: c.pop, n: a.length, fees: f, cpc: f ? sum(a.map(x => x.cpc * x.fees)) / f : null, comp: c.comp, top: a.filter(x => x.tier === 'A+' || x.tier === 'A').length }; }).filter(o => o.n && (!st.reg || (PA[o.pi] && PA[o.pi].reg === +st.reg)) && (!st.par || (PA[o.pi] && PA[o.pi].fips === st.par)));
      dataTable($('#p5Cities', root), [{ k: 'name', h: 'City', l: 1, f: v => `<b>${esc(v)}</b>` }, { k: 'par', h: 'County', l: 1 }, { k: 'pop', h: 'Residents', f: v => N(v) }, { k: 'n', h: 'ZIPs', f: v => N(v) }, { k: 'fees', h: 'Profit pool', f: v => MM(v) }, { k: 'cpc', h: 'Cost', f: v => D(v, 2) + '×' }, { k: 'comp', h: 'C-39 licenses within 8 km', f: v => N(v) }, { k: 'top', h: 'A+ and A ZIPs', f: v => N(v) }], cs, { sortKey: 'fees', limit: 500 });
    }
    function drawCoh() {
      const xs = R.map(x => x.z.idx), ys = R.map(x => x.pct); const r = pearson(xs, ys);
      const rk = a => { const o = a.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]); const out = Array(a.length); o.forEach(([, i], j) => out[i] = j); return out; };
      const ra = rk(xs), rb = rk(ys); const rs = pearson(ra, rb);
      const d = R.map((x, i) => ({ x, d: rb[i] - ra[i] })).sort((a, b) => b.d - a.d);
      const li = a => a.map(o => `${o.x.zip} ${esc(o.x.z.city)} (index ${D(o.x.z.idx, 0)}, efficiency ${D(o.x.pct, 0)})`).join('; ');
      $('#p5Coh', root).innerHTML = `<p class="body">Across ${N(R.length)} ZIPs the index and the efficiency percentile correlate r = ${DS(r, 2)} (Spearman ${D(rs, 2)}). They agree on the broad picture and part ways on two kinds of ZIP.</p>
        <p class="body"><b>Rises here</b> (large ZIPs where the roof count is big and the modeled click is cheaper): ${li(d.slice(0, 5))}.</p>
        <p class="body"><b>Falls here</b> (high job flow per resident but few residents, or a crowded field): ${li(d.slice(-5).reverse())}.</p>
        ${callout('judg tight', 'Judgment call: buy volume per dollar, write pages for rates', 'Paid media pays for clicks, so it should follow gross profit per click (this module). Organic pages earn rank by relevance, so a small town with old roofs, a fire zone or a wet winter and no competitor page is often the better SEO target (module 01 and the city table in module 12).')}`;
      $('#p5Reg2', root).innerHTML = `<div class="xscroll"><table><thead><tr><th class="l">Region</th><th class="l">Main media market</th><th>Factor</th><th>Mean cost in region</th><th>Profit pool</th></tr></thead><tbody>${REG_KEYS.map(k => { const a = R.filter(x => PA[x.z.pi].reg === k); return `<tr><td class="l"><b>${esc(REGN[k])}</b></td><td class="l">${esc(REG_MKT[k])}</td><td>${D(DMA[k], 2)}</td><td>${D(mean(a.map(x => x.cpc)), 2)}×</td><td>${MM(sum(a.map(x => x.fees)))}</td></tr>`; }).join('')}</tbody></table></div><p class="chartnote">Region factors are assumptions (grade D), highest to lowest: ${esc(joinAnd(dmaS.map(k => REGN[k] + ' ' + D(DMA[k], 2))))}. They follow where roofing licenses are thickest (${esc(joinAnd(licTop)) || 'the large metros'} hold the most C-39 licenses by mailing city), not a price file: no California click cost was measured for this build. The competition term adds up to 20% where many roofers sit nearby and subtracts up to 20% where few do. After a wildfire or in the week of a strong atmospheric river, clicks in the affected area can cost well above these levels while every roofer and lead seller bids in.</p>`;
    }
    $('#p5Method', root).innerHTML = proseTable([
      ['1 · Gross profit pool', 'For each ZIP and each line in the plan: jobs a year × share open to marketing × default job value × gross margin (module 12 assumptions), summed over the lines chosen.'],
      ['2 · Relative cost', `Region factor (${esc(dmaSpan)}) × (0.8 + 0.4 × competitive pressure percentile ÷ 100). Pressure is 60% the distance weighted count of active C-39 roofing licenses (each license counts 1 ÷ (1 + (distance ÷ 10 km)²), by mailing ZIP, CSLB November 2026) and 40% roofing employer establishments weighted the same way (ZIP Code Business Patterns 2023), as a percentile across the scored ZIPs. The first edition of this atlas weighed named company offices; California has no honest roster of companies by size, so licenses stand in.`],
      ['3 · Efficiency', 'Gross profit pool ÷ relative cost, ranked as a percentile across the scored ZIPs.'],
      ['4 · Tiers and bids', 'A+ at the 95th percentile and up (+30%), A 85th (+20%), B 65th (+10%), C 40th (0), D 15th (−20%), E below (−50%). Upload as location bid adjustments; never above +30% until account data confirms the ZIP.'],
      ['5 · Quadrants', 'Gross profit pool percentile and competitive pressure percentile, each split at 60.'],
      ['6 · Budget', 'Share of budget ∝ (gross profit pool ÷ cost)^alpha within the target set; clicks, leads and jobs from each line\'s click cost, conversion and close rates; capped at a twelfth of the ZIP\'s jobs open to marketing a year.'],
    ]);
    $('#p5Judg', root).innerHTML = proseTable([
      ['No keyword data', 'No search volume, auction or Ahrefs data was pulled for this build. Search volume by ZIP does not exist publicly; Google reports it by metro and state.'],
      ['Long run, not this week', 'ZIPs are ranked by their roofs, weather and fire record over the long run. After a specific storm or fire, the record in module 02 and the Weather Desk (module 14) override this ranking for weeks.'],
      ['Competition is counted in licenses', `${N((META.lic || {}).clear || (META.lic || {}).n)} active C-39 licenses and ${N((META.cbp || {}).est)} roofing employer establishments stand for the field. A license is an address without a size: a one truck roofer and a 200 person firm count the same, and general (B) contractors who roof are not counted. Only ${N(COMP.length)} companies are named, from public sources.`],
      ['Not used: demographics as targeting', 'Race, ethnicity, religion and similar attributes are not inputs, and the Desk never targets by them. Language spoken at home is used only to decide where to add ads and pages in Spanish, Chinese, Vietnamese, Korean, Tagalog or another language the company serves.'],
      ['Not used: single homes as targets', 'Lists of specific damaged or burned homes, owners named in claim, FEMA or non-renewal records, and geofences drawn around one property are excluded. Target ZIPs and event areas, and confirm damage roof by roof with the owner\'s permission.'],
      ['Caveat: job values', 'Default job values are placeholders. A company that does not sell commercial or metal work should switch those lines off, and one with a higher ticket should raise the replacement value, before trusting the ranking.'],
    ]);
    $('#p5Foot', root).innerHTML = `<b style="color:var(--ink)">${ATLAS.name}</b>, module 05. Costs are modeled (grade D) until account actuals replace them in module 15. Compiled ${COMPILED}.`;
    // wiring
    const syncChips = () => $$('#p5Lines [data-k]', root).forEach(b => { const on = st.lines.has(b.dataset.k); b.classList.toggle('on', on); b.classList.toggle('dim', !on); b.setAttribute('aria-pressed', String(on)); });
    $$('#p5Lines [data-k]', root).forEach(b => b.onclick = () => { const k = b.dataset.k; if (st.lines.has(k)) { if (st.lines.size > 1) st.lines.delete(k); } else st.lines.add(k); syncChips(); render(); });
    $('#p5All', root).onclick = () => { st.lines = new Set(LINE_KEYS); syncChips(); render(); };
    $('#p5Crash', root).onclick = () => { st.lines = new Set(['storm', 'fire', 'repair'].filter(k => LINE_KEYS.includes(k))); syncChips(); render(); };
    $('#p5Res', root).onclick = () => { st.lines = new Set(RES_LINES); syncChips(); render(); };
    $('#p5Com', root).onclick = () => { st.lines = new Set(COM_LINES); syncChips(); render(); };
    $('#p5Met', root).onchange = e => { st.metric = e.target.value; render(); };
    $('#p5Reg', root).onchange = e => { st.reg = e.target.value; st.par = ''; $('#p5Par', root).value = ''; if (st.sel && !(ZI[st.sel] && inScope(ZI[st.sel]))) st.sel = null; if (st.reg) map.fitCounties(PA.filter(p => p.reg === +st.reg).map(p => p.fips)); else map.reset(); render(); };
    $('#p5Par', root).onchange = e => { st.par = e.target.value; if (st.par && st.reg && PAI[st.par] && PAI[st.par].reg !== +st.reg) { st.reg = ''; $('#p5Reg', root).value = ''; } if (st.sel && !(ZI[st.sel] && inScope(ZI[st.sel]))) st.sel = null; if (st.par) map.fitCounties([st.par]); else map.reset(); render(); };
    $('#p5Csv', root).onclick = () => saveFile(`${ATLAS.file}-zip-bid-modifiers.csv`, toCSV(['zip', 'city', 'county', 'region', 'gross_profit_pool', 'relative_cpc', 'efficiency_pct', 'tier', 'bid_modifier_pct', 'quadrant'], R.slice().sort((a, b) => b.pct - a.pct).map(x => [x.zip, x.z.city, x.z.cty, REGN[PA[x.z.pi].reg], Math.round(x.fees), +D(x.cpc, 3), +D(x.pct, 1), x.tier, x.bid, QN[x.quad]]), `${ATLAS.name}, module 05. Lines: ${[...st.lines].join(', ')}. Bid modifiers are location adjustments; costs modeled (grade D).`));
    $('#p5ParCsv', root).onclick = () => { const rows = PA.map(p => { const a = R.filter(x => x.z.pi === p.i); const f = sum(a.map(x => x.fees)); return [p.name, REGN[p.reg], a.length, Math.round(f), f ? +D(sum(a.map(x => x.cpc * x.fees)) / f, 3) : '', a.filter(x => x.tier === 'A+' || x.tier === 'A').length, a.filter(x => x.quad === 1).length]; }); saveFile(`${ATLAS.file}-county-paid-rollup.csv`, toCSV(['county', 'region', 'zips', 'gross_profit_pool', 'profit_weighted_relative_cpc', 'a_plus_and_a_zips', 'whitespace_zips'], rows, `${ATLAS.name}, module 05.`)); };
    $('#p5Desk', root).onclick = () => goModule('desk', Object.assign({ zips: planSet().sort((a, b) => b.pct - a.pct).slice(0, 60).map(x => x.zip), lines: [...st.lines] }, st.lines.size === 1 ? { line: [...st.lines][0] } : {}));
    BUS.on('theme', () => render()); BUS.on('slm', () => { if (!root.hidden) render(); else st.dirty = true; });
    this.onShow = () => { if (st.dirty) { st.dirty = false; render(); } };
    this.receive = p => { if (p && p.zip && RI[p.zip]) { st.sel = p.zip; map.fitTo([p.zip]); render(); } };
    render();
  }
});