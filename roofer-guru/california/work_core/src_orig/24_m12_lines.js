/* ==== 24_m12_lines.js ==== */
/* ==== m12_lines ==== */
"use strict";
/* ============================ per line targeting helpers (modules 05, 07, 08, 09, 12) ============================ */
const LINE_TIER = p => p >= 95 ? 'A+' : p >= 85 ? 'A' : p >= 65 ? 'B' : p >= 40 ? 'C' : p >= 15 ? 'D' : 'E';
const TIER_BID = { 'A+': 30, A: 20, B: 10, C: 0, D: -20, E: -50 };
/* a line's paid target ranking: gross profit pool for the line at the current assumptions divided by the ZIP's relative cost per click, as a percentile */
function lineTargets(k, rows) {
  rows = rows || ZR; const out = rows.map(z => { const o = SLM.zipLine(z, k); return { z, zip: z.zip, pool: o.pool, cases: o.cases, fees: o.fees, rate: z['r_' + k], eff: o.fees / Math.max(0.3, z.cpc_rel || 1) }; });
  const sorted = out.map(o => o.eff).sort((a, b) => a - b); const n = sorted.length;
  out.forEach(o => { let lo = 0, hi = n; while (lo < hi) { const m = (lo + hi) >> 1; if (sorted[m] < o.eff) lo = m + 1; else hi = m; } o.pct = n ? lo / n * 100 : 0; o.tier = LINE_TIER(o.pct); o.bid = TIER_BID[o.tier]; });
  return out;
}
/* cities ranked for a line (SEO page targets) */
function lineCities(k) { return CITIES.map(c => { const zs = c.zips.map(z => ZI[z]).filter(Boolean); let pool = 0, cases = 0, fees = 0; zs.forEach(z => { const o = SLM.zipLine(z, k); pool += o.pool; cases += o.cases; fees += o.fees; }); return { c, name: c.name, pi: c.pi, pop: c.pop, nzip: zs.length, pool, cases, fees, comp: c.comp, roofers: c.roofers, span: c.span / Math.max(1, c.pop) * 100 }; }); }
const LINE_FIRMS = k => COMP.filter(c => (c.lines || []).includes(k));
/* ============================ Module 12: Service Lines ============================ */
registerModule({
  key: 'lines', num: '12', title: 'Service Lines', desc: 'Eleven roofing lines resolved to the ZIP: jobs, jobs open to marketing, gross profit, seasons, rules, keywords, competitors and bid modifiers',
  mount(root) {
    const st = { k: 'replace', metric: 'r', reg: '', par: '', sel: null };
    const lc = s => String(s || '').replace(/\b[A-Z][a-z]+\b/g, m => m.toLowerCase());
    root.innerHTML = mastHTML({ eyebrow: 'Module 12 · Service Lines · eleven lines, every ZIP', title: 'Service Lines', dek: 'A Louisiana roofing company is eleven businesses that share a crew yard. Replacements come due as roofs age, in waves set by the hurricanes that reroofed whole parishes at once; storm and hail work arrives in bursts after the weather; repairs and leaks are steady and small; FORTIFIED roofs ride a grant drawn by lottery; metal, mobile home, multifamily, commercial, coating and new construction work each has its own buyer and season. Each line here has its own heatmap, statewide volume, jobs open to marketing, gross profit pool, season, rules, keywords, competitors and bid modifiers, with every assumption in plain view and editable.',
      meta: ['<b>Lines</b> replacement, repair, storm, hail, FORTIFIED, metal, mobile home, multifamily, commercial, coatings, new construction', `<b>ZIPs</b> ${N(ZR.length)} scored`, '<b>Grades</b> B where the anchor is observed, C and D where it is an assumption', '<b>Assumptions</b> stored in this browser'],
      bar: 'Service Lines', barsub: 'Choose a line; everything below follows it',
      actions: [{ id: 'l12Csv', label: '↓ Line targets CSV' }, { id: 'l12CityCsv', label: '↓ City pages CSV' }, { id: 'l12Desk', label: 'Campaign Desk ↗', title: 'Send the top ZIPs for this line' }, { id: 'l12Forge', label: 'Site Forge ↗', title: 'Send the top cities for this line' }] }) +
      `<div class="wrap">
      ${callout('', 'Read this first: what a service line is here, and what the numbers are', `A line counts <b>roofing jobs a year</b> at each ZIP (the volume), the share an owner gives to a contractor found through search, ads, referrals or the door (jobs open to marketing), and those jobs times a default ticket times a ${P(SLM.A.fee * 100, 0)} gross margin (the gross profit pool). Replacement starts from the roof age model; storm from every storm's modeled winds and the damage curve fitted to FEMA registrations; hail from the hail record; repair from the American Housing Survey leak rate; new construction from Census building permits; FORTIFIED from the state grant program; metal, mobile home, multifamily, commercial and coating lines from stated assumptions. Every default below is a placeholder until it is replaced with your own job history: change it and every module updates. Nothing here is a bid, a quote, a forecast for one company, or legal advice.`)}
      <div class="lpick" id="l12Pick"></div>
      <div class="kpis" id="l12Kpis"></div>
      <div class="controls">
        <div class="ctl"><span class="fl">Map metric</span><div class="seg" id="l12Met"><button data-v="r" aria-pressed="true">Per 10,000 residents</button><button data-v="p" aria-pressed="false">Jobs a year</button><button data-v="f" aria-pressed="false">Gross profit pool</button><button data-v="e" aria-pressed="false">Paid target tier</button></div></div>
        <div class="ctl"><label class="fl" for="l12Reg">Region</label><select id="l12Reg"><option value="">All nine regions</option>${REG_KEYS.map(k => `<option value="${k}">${esc(REGN[k])}</option>`).join('')}</select></div>
        <div class="ctl"><label class="fl" for="l12Par">Parish</label><select id="l12Par"><option value="">All 64 parishes</option>${PA.slice().sort((a, b) => a.name.localeCompare(b.name)).map(p => `<option value="${p.fips}">${esc(p.name)}</option>`).join('')}</select></div>
        <div class="ctl"><label class="fl" for="l12Find">Find a ZIP or city</label><input type="search" id="l12Find" placeholder="70001 or Houma" autocomplete="off"></div>
      </div>
      <div class="grid2">
        <div class="card mapcard"><div id="l12Map"></div><div class="legend" id="l12Leg"></div></div>
        <div class="stack">
          <div class="card"><div class="card-h" style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start"><div><h3 id="l12Name"></h3><p id="l12Sub"></p></div><span class="pill" id="l12Pill"></span></div><div class="card-b" id="l12Detail"></div></div>
          <div class="card"><div class="card-h"><h3>Paid targets for this line</h3><p>ZIPs ranked by gross profit pool per relative click cost. Click a row to select it.</p></div><div class="tscroll short" id="l12Tbl"></div></div>
        </div>
      </div>
      <div class="split">
        ${card('The line in law', 'What Louisiana and federal rules do to this line\'s ads, contracts and jobs. Each item carries its citation; module 03 has the full register.', '<div id="l12Law"></div>')}
        ${card('Unit economics and assumptions', 'Change any number; the maps, tables and every module that reads the line follow. Stored in this browser.', '<div id="l12Econ"></div>')}
      </div>
      ${card('SEO page targets for this line', 'Cities ranked by this line\'s gross profit pool, with the competition already there. One page per city and line where the volume supports it; Spanish pages where a large share speaks Spanish at home.', '<div class="tscroll" id="l12Cities"></div>', 'mt')}
      <div class="split">
        ${card('Keywords, negatives and angles', 'Starting keyword set for the line, the negatives that keep job seekers, shoppers and do it yourself searches out, and the copy angles the Campaign Desk builds from. House style: no hyphens or dashes in copy.', '<div id="l12Kw"></div>')}
        ${card('Competitive pressure on this line', 'Mapped Louisiana roofing companies that market this line, by reach.', '<div id="l12Comp"></div>')}
      </div>
      ${card('The year, line by line', 'Monthly shape of each line, 100 = an average month. Darker cells are busier months. Storm, hail, repair and mobile home rows come from the storm record by month with a lag for the work that follows; the rest are planning shapes (graded).', '<div id="l12Sea"></div>', 'mt')}
      <div class="split">
        ${card('Portfolio: where a month of media should go', 'Your monthly budget split across lines by gross profit pool times season, divided by each line\'s click cost. Edit the budget in the assumptions card.', '<div id="l12Port"></div>')}
        ${card('The eleven lines side by side', 'Gross profit pool a year at the current assumptions, statewide. The selected line is dark.', '<div id="l12Mix"></div>')}
      </div>
      ${card('Dayparting templates', 'Bid adjustments by hour block for each line\'s template. They are assumptions until account data replaces them (module 15); the storm report row shows when the weather that drives the work arrives.', '<div id="l12Day"></div>', 'mt')}
      <div class="split">
        ${card('How the lines are built', 'Anchor, apportionment and grade for each line.', '<div id="l12Method"></div>')}
        ${card('Judgment calls and caveats', 'The choices that most move the numbers.', '<div id="l12Judg"></div>')}
      </div>
      <div class="foot" id="l12Foot"></div></div>`;
    const map = new ZipMap($('#l12Map', root), { segHit: 'none', roads: false, onSelect: z => { if (st.sel !== z && !(ZI[z] && ZI[z].res_ok)) return; st.sel = st.sel === z ? null : z; render(); }, onHover: (z, e) => { const r = ZI[z]; if (!r || !r.res_ok) return; const o = SLM.zipLine(r, st.k); const t = T.find(x => x.zip === z); showTip(`<div class="tt">${esc(r.zip)} · ${esc(r.city)}</div><div class="ts">${esc(r.cty)} Parish · ${N(r.pop)} residents</div>${tipRow(esc(L().short) + ' jobs a year', D(o.pool, o.pool < 10 ? 1 : 0))}${tipRow('Per 10,000 residents', D(r['r_' + st.k], 1))}${tipRow('Jobs open to marketing a year', D(o.cases, 1))}${tipRow('Gross profit pool a year', MM(o.fees))}${t ? tipRow('Paid tier · bid', t.tier + ' · ' + S(t.bid, 0) + '%') : ''}<div class="tf">Click for the ZIP ledger</div>`, e); } });
    const L = () => PLI[st.k]; let T = [];
    const inScope = z => (!st.par || z.fips === st.par) && (!st.reg || PA[z.pi].reg === +st.reg);
    $('#l12Pick', root).innerHTML = `<div class="seg" id="l12Lines" style="margin-top:16px">${PL.map(l => `<button data-v="${l.key}" aria-pressed="${l.key === st.k}">${esc(l.name)}</button>`).join('')}</div>`;
    function kpis() {
      const k = st.k, l = L(), A = SLM.A.lines[k]; const pool = sum(ZR.map(z => z['p_' + k] || 0)); const cases = pool * A.rep; const fees = cases * A.val * SLM.A.fee;
      const sea = SLM.SEA[k]; const pk = sea.indexOf(Math.max(...sea));
      const par = PA.slice().sort((a, b) => (b['p_' + k] || 0) - (a['p_' + k] || 0))[0];
      const ue = SLM.blended(SLM.LI[k], null);
      $('#l12Kpis', root).innerHTML = kpiHTML([
        { l: 'Jobs a year', g: l.g, v: K(pool), d: esc(l.unit) },
        { l: 'Jobs open to marketing', g: 'D', v: K(cases), d: `${P(A.rep * 100, 0)} of the jobs go to a contractor found through search, ads, referrals or the door (assumption)` },
        { l: 'Gross profit pool a year', g: 'D', v: MM(fees), d: `${M$(A.val)} default ticket × ${P(SLM.A.fee * 100, 0)} gross margin` },
        { l: 'Cost per sold job', g: 'D', v: M$(ue.cps), d: `${M$(ue.cpc)} a click · ${D(ue.cvr, 1)}% to lead · ${D(ue.close, 0)}% sold` },
        { l: 'Return on paid', g: 'D', v: D(ue.roi, 1) + '×', d: 'gross profit per job ÷ cost per sold job, at the defaults' },
        { l: 'Peak month', g: SLM.LI[k].mg, v: SLM.MONTHS[pk], d: `${sea[pk]} against an average month of 100` },
        { l: 'Largest parish', g: '', v: esc(par.name), d: `${par['p_' + k] < 100 ? D(par['p_' + k], 1) : N(par['p_' + k])} jobs a year` },
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
      const r = (l, v) => `<div class="rowl"><span>${l}</span><b>${v}</b></div>`;
      const age = r('One unit roofs · 20 or older · reaching 20 in five years (model)', `${N(z.roofs)} · ${P(z.ra20_sh, 0)} · ${N(z.wave)}`) + r('Median roof age · years since hurricane force winds', `${isN(z.ra_med) ? D(z.ra_med, 0) : '—'} · ${isN(z.yrs64) ? D(z.yrs64, 0) : 'none since 1950'}`);
      const own = r('Owner occupied · with a mortgage · median home value', `${P(z.own_sh, 0)} · ${P(z.mort_sh, 0)} · ${M$(z.value)}`);
      const wind = r('Hurricane force storms since 2000 · chance a year', `${N(z.n64_00)} · ${P(z.hur64, 1)}`) + r('FEMA roof and wind registrations · per 100 homes', `${N(z.fema_k)} · ${isN(z.fema_rate) ? D(z.fema_rate, 1) : '—'}`) + r('Damaging wind days a year · tornado days', `${D(z.wd50, 1)} · ${D(z.td1, 2)}`);
      const hail = r('Hail days a year, 1 inch+ · 1.75 inch+ · recent decade', `${D(z.hd1, 2)} · ${D(z.hd175, 2)} · ${D(z.hd1_10, 2)}`) + r('Hail reports in the ZIP, 1 inch+ · 1.75 inch+', `${N(z.ev_h1)} · ${N(z.ev_h175)}`);
      const com = r('Commercial roofs (estimate) · warehouses · plants · retail · churches', `${D(z.cru, 0)} · ${N(z.whse)} · ${N(z.mfg)} · ${N(z.retail)} · ${N(z.church)}`);
      return { replace: age + own, repair: age + r('Built before 1980 · median year built', `${P(z.pre80_sh, 0)} · ${isN(z.yb_med) ? D(z.yb_med, 0) : '—'}`), storm: wind + age, hail: hail + age, fortified: age + own + wind,
        metal: age + own + r('Households earning $100,000 or more · metal share (model)', `${P(z.hh100k_sh, 0)} · ${P(z.metal_sh, 0)}`), mh: r('Mobile homes · share of homes', `${N(z.mh)} · ${P(z.mh_sh, 0)}`) + wind,
        mf: r('Homes in buildings of five or more units · apartment lessors', `${N(z.mf5u)} · ${N(z.apts)}`) + wind, comm: com + wind + hail, coat: com, newc: r('Homes built since 2020 · since 2010', `${N(z.yb20)} · ${N((z.yb20 || 0) + (z.yb10 || 0))}`) + r('Builders and supply houses (ZBP)', `${N(z.builders)} · ${N(z.supply)}`) }[k] || '';
    }
    function drawDetail(TI) {
      const l = L(), k = st.k; const z = st.sel ? ZI[st.sel] : null;
      if (!z || !z.res_ok) {
        const rows = ZR.filter(inScope); const nm = st.par ? PNAME(st.par) + ' Parish' : st.reg ? REGN[st.reg] : 'Louisiana';
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
      $('#l12Name', root).textContent = `${z.zip} · ${z.city}`; $('#l12Sub', root).textContent = `${z.cty} Parish · ${N(z.pop)} residents · ${l.name}`; $('#l12Pill', root).textContent = 'Tier ' + t.tier;
      const prate = pr['p_' + k] / Math.max(1, pr.pop) * 1e4;
      $('#l12Detail', root).innerHTML = `<div class="big">${o.pool < 10 ? D(o.pool, 1) : N(o.pool)}<span style="font-size:13px;font-weight:500;color:var(--ink-3)"> jobs a year</span></div><div class="mini" style="margin-bottom:10px">${D(z['r_' + k], 1)} per 10,000 residents against ${D(prate, 1)} in ${esc(pr.name)} Parish · paid percentile ${D(t.pct, 0)}</div>
        <div class="rowl"><span>Jobs open to marketing a year</span><b>${o.cases < 10 ? D(o.cases, 1) : N(o.cases)}</b></div>
        <div class="rowl"><span>Gross profit pool a year</span><b>${MM(o.fees)}</b></div>
        <div class="rowl"><span>Relative click cost (region and competition)</span><b>${D(z.cpc_rel, 2)}×</b></div>
        <div class="rowl"><span>Click · lead · sold job</span><b>${M$(ue.cpc)} · ${M$(ue.cpl)} · ${M$(ue.cps)}</b></div>
        <div class="rowl"><span>Bid modifier for this line</span><b>${S(t.bid, 0)}%</b></div>
        <div class="rowl"><span>Mapped roofers within 25 km · competitive pressure</span><b>${N(z.comp_n25)} · ${D(z.comp_pct, 0)}th pct.</b></div>
        <div class="dsec">What drives this line here</div>${lineRows(k, z)}
        ${(z.span_sh || 0) >= 8 ? callout('judg tight', 'Spanish build', `${P(z.span_sh, 0)} of residents speak Spanish at home. Run the line's Spanish ad group and landing page here, with the license number and the office city in Spanish too, if someone at the company speaks Spanish with customers.`) : ''}
        <div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap"><button class="ibtn" id="l12ZIdx">Roof Demand Index ↗</button>${['storm', 'hail', 'mh'].includes(k) ? '<button class="ibtn" id="l12ZSt">Storm Ledger ↗</button>' : '<button class="ibtn" id="l12ZSk">Roof stock ↗</button>'}<button class="ibtn" id="l12ZDesk">This ZIP to the Desk ↗</button></div>`;
      $('#l12ZIdx', root).onclick = () => goModule('index', { zip: z.zip }); if ($('#l12ZSt', root)) $('#l12ZSt', root).onclick = () => goModule('storms', { zip: z.zip }); if ($('#l12ZSk', root)) $('#l12ZSk', root).onclick = () => goModule('stock', { zip: z.zip }); $('#l12ZDesk', root).onclick = () => goModule('desk', { zips: [z.zip], line: k });
    }
    const pagePlan = c => c.cases >= 50 ? 'City page + landing page' : c.cases >= 15 ? 'City page' : c.cases >= 5 ? 'Section on the parish page' : 'Parish page mention';
    function drawCities() {
      const k = st.k; const rows = lineCities(k).filter(c => (!st.par || (PA[c.pi] && PA[c.pi].fips === st.par)) && (!st.reg || (PA[c.pi] && PA[c.pi].reg === +st.reg)));
      const firms = LINE_FIRMS(k).length;
      dataTable($('#l12Cities', root), [
        { k: 'name', h: 'City', l: 1, f: v => `<b>${esc(v)}</b>` }, { k: 'par', h: 'Parish', l: 1, v: r => PA[r.pi] ? PA[r.pi].name : '' }, { k: 'pop', h: 'Residents', f: v => N(v) }, { k: 'nzip', h: 'ZIPs', f: v => N(v) },
        { k: 'pool', h: 'Jobs a year', f: v => D(v, v < 10 ? 1 : 0) }, { k: 'cases', h: 'Open to marketing', f: v => D(v, v < 10 ? 1 : 0) }, { k: 'fees', h: 'Pool', f: v => MM(v) },
        { k: 'comp', h: 'Mapped roofers nearby', f: v => N(v), t: `Of the ${COMP.length} mapped roofing companies; ${firms} of them market this line` }, { k: 'span', h: 'Spanish at home', f: v => P(v, 0) },
        { k: 'page', h: 'Page plan', l: 1, v: r => pagePlan(r), f: (v, r) => `${esc(v)}${r.span >= 8 ? ' · Spanish page' : ''}` },
      ], rows, { sortKey: 'fees', id: r => r.name });
    }
    let staticFor = null;
    function drawStatic() {
      const k = st.k, l = L(); if (staticFor === k + '|' + JSON.stringify(SLM.A)) return; staticFor = k + '|' + JSON.stringify(SLM.A);
      $('#l12Law', root).innerHTML = l.law.map(id => LAWX.items.find(x => x.id === id)).filter(Boolean).map(x => `<div class="lawi"><div class="lh"><b>${esc(x.t)}</b> ${G(x.g)}</div><div class="mini" style="margin:2px 0 4px">${x.url ? `<a href="${x.url}" target="_blank" rel="noopener">${esc(x.cite)}</a>` : esc(x.cite)} · ${esc(x.eff)}</div><p class="mini" style="color:var(--ink-2)">${esc(x.s)}</p></div>`).join('') + `<p class="mini" style="margin-top:8px">Read October 5 and 6, 2026 from the enrolled acts, legis.la.gov, the LSLBC and eCFR. Research material for marketing decisions, not legal advice; confirm with a Louisiana lawyer before relying on any item.</p>`;
      const A = SLM.A, p = A.lines[k];
      const fld = (id, lab, v, step, tip) => `<label class="efld" title="${esc(tip || '')}"><span>${lab}</span><input type="number" id="${id}" value="${v}" step="${step}" min="0"></label>`;
      const V0 = META.model.VAL; const tick = PL.map(x => `${lc(x.short)} ${M$(V0[x.key])}`);
      $('#l12Econ', root).innerHTML = `<div class="efgrid">${fld('l12Rep', 'Jobs open to marketing (%)', +(p.rep * 100).toFixed(2), 0.5, 'Share of the line\'s jobs a contractor wins through search, ads, referrals or the door')}${fld('l12Val', 'Default ticket ($)', p.val, 500, 'Average invoice per job')}${fld('l12CpcM', 'Click cost multiplier for the line', p.cpcMul, 0.05, 'Times the base cost per click')}${fld('l12Cvr', 'Click to lead (%)', p.cvr, 0.5)}${fld('l12Close', 'Lead to sold job (%)', p.close, 1)}</div>
        <div class="dsec">All lines</div><div class="efgrid">${fld('l12Cpc', 'Base cost per click ($)', A.cpc, 1)}${fld('l12Fee', 'Gross margin (%)', +(A.fee * 100).toFixed(1), 0.5)}${fld('l12Bud', 'Monthly budget ($)', A.budget, 1000)}</div>
        <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><button class="btn" id="l12Apply">Apply</button><button class="btn ghost" id="l12Reset">Reset every line to defaults</button></div>
        ${callout('judg tight', 'Judgment call: none of these defaults is a forecast', `Tickets are round planning numbers chosen by judgment, not measured: ${listAnd(tick)}. The replacement ticket sits above the American Housing Survey median of ${M$((META.ahs || {}).wsc_med)} for a professional roof job in the West South Central states on purpose, because that median mixes partial jobs and repairs with full reroofs. Click costs are graded D until account actuals arrive (module 15). Replace every default with your own average invoices, close rates and margins.`)}`;
      $('#l12Apply', root).onclick = () => { const g = id => +$(id, root).value; const patch = { cpc: g('#l12Cpc'), fee: g('#l12Fee') / 100, budget: g('#l12Bud'), lines: {} }; patch.lines[k] = { rep: g('#l12Rep') / 100, val: g('#l12Val'), cpcMul: g('#l12CpcM'), cvr: g('#l12Cvr'), close: g('#l12Close') }; SLM.set(patch); toast('Assumptions applied'); };
      $('#l12Reset', root).onclick = () => { SLM.reset(); toast('Defaults restored'); };
      $('#l12Kw', root).innerHTML = `<div class="dsec" style="margin-top:0">Keywords (phrase and exact)</div><div class="chips">${l.kw.map(w => `<span class="chip">${esc(w)}</span>`).join('')}</div>
        <div class="dsec">Spanish</div><div class="chips">${(l.kwEs || []).map(w => `<span class="chip">${esc(w)}</span>`).join('') || '<span class="mini">None set</span>'}</div>
        <div class="dsec">Negatives for this line</div><div class="chips">${l.neg.map(w => `<span class="chip dim">${esc(w)}</span>`).join('')}</div>
        <div class="dsec">Negatives for every line</div><div class="chips">${NEG_COMMON.map(w => `<span class="chip dim">${esc(w)}</span>`).join('')}</div>
        <div class="dsec">Copy angles (filled with your company settings)</div>${l.angles.map(a => `<div class="adprev"><div class="ah">${esc(fillCopy(a.h))}</div><div class="ad">${esc(fillCopy(a.d))}</div><div class="mini">${a.lang === 'es' ? 'Spanish · ' : ''}${esc(a.id)}</div></div>`).join('')}
        <p class="mini" style="margin-top:8px">Location words in keywords ("near me", city names) come from the Campaign Desk's geo build. Avoid "best", "#1", "top rated", "lifetime" and "hurricane proof" in copy unless a named source or the written warranty backs it (La. R.S. 51:1405), and never offer claim help or anything toward a deductible (R.S. 37:2159.1, R.S. 51:451).</p>`;
      const fl = LINE_FIRMS(k); const tw = { statewide: 3, national: 2.5, regional: 1.5, local: 1 };
      $('#l12Comp', root).innerHTML = `<p class="mini" style="margin-bottom:8px">${N(fl.length)} of ${N(COMP.length)} mapped roofing companies market ${esc(lc(l.name))}: ${N(fl.filter(c => c.tier === 'statewide' || c.tier === 'national').length)} statewide or national, ${N(fl.filter(c => c.tier === 'regional').length)} regional, ${N(fl.filter(c => c.tier === 'local').length)} local.</p><div class="xscroll"><table><thead><tr><th class="l">Company</th><th class="l">Reach</th><th class="l">Cities</th><th class="l">Lines</th></tr></thead><tbody>${fl.sort((a, b) => tw[b.tier] - tw[a.tier] || a.name.localeCompare(b.name)).map(c => `<tr><td class="l wrap"><b>${esc(c.name)}</b>${c.verified ? '' : ' <span class="pill" title="Not verified on the company\'s site; from public listings">listing</span>'}</td><td class="l">${esc(c.tier)}</td><td class="l wrap">${esc((c.cities || []).slice(0, 5).join(', '))}${(c.cities || []).length > 5 ? ' +' + ((c.cities || []).length - 5) : ''}</td><td class="l">${N((c.lines || []).length)}</td></tr>`).join('') || '<tr><td colspan="4" class="l mini">No mapped company markets this line.</td></tr>'}</tbody></table></div>
        <p class="mini" style="margin-top:8px">Fewer companies market the thin lines, which is the opening: ${esc(listAnd(PL.map(x => [x, LINE_FIRMS(x.key).length]).sort((a, b) => a[1] - b[1]).slice(0, 4).map(([x]) => lc(x.name))))} face the thinnest mapped competition, but each needs crews that do that work. Module 07 maps the field; module 13 watches their ads.</p>`;
      // seasons heat table
      const R = ramp('green'); const allv = PL.flatMap(x => SLM.SEA[x.key]); const sc = qScale(allv, 'green', 1);
      const pkM = key => { const a = SLM.SEA[key]; const i = a.indexOf(Math.max(...a)); return { m: MONL[i], v: a[i], m2: MONL[a.map((v, j) => [v, j]).sort((x, y) => y[0] - x[0])[1][1]] }; };
      const sP = pkM('storm'), hP = pkM('hail'), rP = pkM('repair');
      $('#l12Sea', root).innerHTML = `<div class="xscroll"><table class="heat"><thead><tr><th class="l">Line</th>${SLM.MONTHS.map(m => `<th>${m}</th>`).join('')}<th>Grade</th></tr></thead><tbody>${PL.map(x => `<tr class="${x.key === k ? 'sel' : ''}"><td class="l"><b>${esc(x.short)}</b></td>${SLM.SEA[x.key].map(v => { const c = sc.f(v); return `<td style="background:${c};color:${textOn(c)}">${v}</td>`; }).join('')}<td>${G(SLM.LI[x.key].mg)}</td></tr>`).join('')}</tbody></table></div>
        <p class="chartnote">Storm work follows the hurricane season with a lag: ${sP.m} and ${sP.m2} are the busiest months, ${sP.m} at ${D(sP.v / 100, 1)} times an average month. Hail jobs follow the spring hail by a month or so and peak in ${hP.m} and ${hP.m2}. Repairs follow rain and thunderstorm wind and peak in ${rP.m}. Replacement, metal and coating rows are planning shapes for the drier, milder months; FORTIFIED follows the grant rounds. A flat row means no seasonal evidence was found, not that the line has none.</p>`;
      // portfolio
      const bud = SLM.A.budget; const lw = PL.map(x => { const pa = SLM.A.lines[x.key]; const pool = sum(ZR.map(z => z['p_' + x.key] || 0)); const fees = pool * pa.rep * pa.val * SLM.A.fee; const ue = SLM.blended(SLM.LI[x.key], null); return { x, fees, ue }; });
      const mw = SLM.MONTHS.map((_, m) => lw.map(o => Math.pow(Math.max(0, o.fees * SLM.SEA[o.x.key][m] / 100) / Math.max(1, o.ue.cpc), SLM.A.alpha)));
      const yr = lw.map((o, i) => sum(mw.map(w => bud * w[i] / sum(w)))); const ord = yr.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]);
      $('#l12Port', root).innerHTML = `<div class="xscroll"><table><thead><tr><th class="l">Line</th>${SLM.MONTHS.map(m => `<th>${m}</th>`).join('')}<th>Year</th></tr></thead><tbody>${lw.map((o, i) => { const row = mw.map(w => bud * w[i] / sum(w)); return `<tr class="${o.x.key === k ? 'sel' : ''}"><td class="l"><b>${esc(o.x.short)}</b></td>${row.map(v => `<td>${K(v)}</td>`).join('')}<td><b>${K(sum(row))}</b></td></tr>`; }).join('')}</tbody></table></div>
        <p class="chartnote">${M$(bud)} a month, split by gross profit pool × season ÷ cost per click, raised to ${D(SLM.A.alpha, 1)} (above 1 concentrates money in the strongest lines). ${esc(lw[ord[0][1]].x.name)} and ${esc(lc(lw[ord[1][1]].x.name))} take ${P(100 * (ord[0][0] + ord[1][0]) / Math.max(1, sum(yr)), 0)} of the year at the defaults because they carry the most pool per click; a company that does not do a line should zero its ticket in the assumptions card and the split follows.</p>`;
      const fx = lw.map(o => ({ l: o.x.short, v: o.fees, t: MM(o.fees), color: o.x.key === k ? cssv('--ink') : R[5] })).sort((a, b) => b.v - a.v);
      hbarChart($('#l12Mix', root), fx, { W: 520, L: 110, R: 60, aria: 'Gross profit pool a year by service line' });
      $('#l12Mix', root).insertAdjacentHTML('beforeend', `<p class="chartnote">${MM(sum(lw.map(o => o.fees)))} a year across the eleven lines at the current tickets, shares and margin: the market's gross profit, not one company's. Storm is a long run average over 75 years of storms; a real year is either quiet or enormous.</p>`);
      const DP = SLM.DAYPARTS; const tpl = { emergency: 'Storm, repair and mobile home (emergency)', retail: 'Replacement, hail, FORTIFIED and metal (planned purchase)', b2b: 'Commercial, multifamily, coatings and new construction (business hours)' };
      const hrs = DATA.ts.hour; const all = hrs.hail.map((v, i) => v + hrs.wind[i] + hrs.torn[i]); const blk = [[0, 6], [6, 9], [9, 12], [12, 17], [17, 21], [21, 24]].map(([a, b]) => sum(all.slice(a, b)) / sum(all) * 100 / ((b - a) / 24 * 100));
      $('#l12Day', root).innerHTML = `<div class="xscroll"><table><thead><tr><th class="l">Template</th>${SLM.BLOCKS.map(b => `<th>${b}</th>`).join('')}</tr></thead><tbody>${Object.keys(tpl).map(t => `<tr class="${SLM.LI[k].dayparts === t ? 'sel' : ''}"><td class="l"><b>${tpl[t]}</b></td>${DP[t].map(v => `<td>${S(v, 0)}%</td>`).join('')}</tr>`).join('')}<tr><td class="l">NOAA storm reports by hour, index to an even spread</td>${blk.map(v => `<td>${D(v, 2)}×</td>`).join('')}</tr></tbody></table></div>
        <p class="chartnote">Hail, damaging wind and tornado reports run ${D(blk[3], 1)} times an even spread from noon to 5 p.m. and ${D(blk[4], 1)} times from 5 to 9 p.m., and ${D(blk[0], 1)} times overnight. Owners find the damage that evening or the next morning, so the emergency template keeps bids up from early morning to late evening; planned purchases are researched in the day and evening, and business buyers in office hours. Replace every template with the hour report from your accounts (module 15) after 60 days.</p>`;
      $('#l12Method', root).innerHTML = proseTable(PL.map(x => [`<b>${esc(x.name)}</b> ${G(x.g)}`, esc(x.what)]));
      const rep = PL.map(x => `${lc(x.short)} ${P(100 * META.model.REP[x.key], 0)}`);
      $('#l12Judg', root).innerHTML = proseTable([
        ['Counted where the roof is', 'Every line is counted at the ZIP of the building, which is usually where the owner searches from. Camps and seasonal homes count where they stand, though their owners often search from home.'],
        ['Jobs open to marketing', `The share of a line's jobs a contractor wins through search, ads, referrals or the door (${listAnd(rep)}) is an assumption; the rest go to repeat contractors, insurer programs, handymen or the owner. It is the most uncertain number on the page.`],
        ['The pool is not revenue', 'The gross profit pool is the whole market\'s margin at the defaults, not one company\'s share. A company\'s share depends on its crews, reviews, reputation and competition.'],
        ['Tier is relative', 'Paid tiers rank ZIPs against each other for one line; an A+ ZIP in a thin line can be worth less than a C ZIP in the replacement line.'],
        ['Lines do not double count', 'Metal and FORTIFIED reroofs are carved out of replacement, storm and hail; mobile homes and buildings of five or more units count only in their own lines.'],
        ['Storm is an average', 'The storm line is the average year over 75 years of storms; a real year is either quiet or enormous. Plan crews and cash for the average and keep a storm plan for the year it lands (module 14).'],
      ]);
      $('#l12Foot', root).innerHTML = `<b style="color:var(--ink)">Uplift Louisiana Roofing Atlas</b>, module 12. Lines resolved to ${N(ZR.length)} scored ZIPs. Defaults are placeholders; assumptions you change are stored in this browser and flow to modules 01, 05, 08, 09 and 15.`;
    }
    // wiring
    wireSeg($('#l12Lines', root), v => { st.k = v; render(); });
    wireSeg($('#l12Met', root), v => { st.metric = v; render(); });
    $('#l12Reg', root).onchange = e => { st.reg = e.target.value; st.par = ''; $('#l12Par', root).value = ''; if (st.sel && !(ZI[st.sel] && inScope(ZI[st.sel]))) st.sel = null; if (st.reg) map.fitParishes(PA.filter(p => p.reg === +st.reg).map(p => p.fips)); else map.reset(); render(); };
    $('#l12Par', root).onchange = e => { st.par = e.target.value; if (st.par && st.reg && PAI[st.par] && PAI[st.par].reg !== +st.reg) { st.reg = ''; $('#l12Reg', root).value = ''; } if (st.sel && !(ZI[st.sel] && inScope(ZI[st.sel]))) st.sel = null; if (st.par) map.fitParishes([st.par]); else map.reset(); render(); };
    $('#l12Find', root).addEventListener('change', e => { const q = e.target.value.trim().toLowerCase(); if (!q) return; const hit = ZI[q] || ZR.filter(z => (z.city || '').toLowerCase().startsWith(q)).sort((a, b) => b.pop - a.pop)[0]; if (hit) { st.sel = hit.res_ok ? hit.zip : null; map.fitTo([hit.zip]); render(); if (!hit.res_ok) toast(`${hit.zip} has fewer than 500 residents, so the atlas does not score it`); } else toast('No ZIP or city matches'); });
    $('#l12Csv', root).onclick = () => { const rows = T.filter(t => inScope(t.z)).sort((a, b) => b.eff - a.eff); saveFile(`louisiana-${slug(L().name)}-zip-targets.csv`, toCSV(['zip', 'city', 'parish', 'residents', 'jobs_a_year', 'per_10k', 'jobs_open_to_marketing', 'gross_profit_pool', 'relative_cpc', 'percentile', 'tier', 'bid_modifier_pct'], rows.map(t => [t.zip, t.z.city, t.z.cty, t.z.pop, +D(t.pool, 2), +D(t.rate, 2), +D(t.cases, 2), Math.round(t.fees), +D(t.z.cpc_rel, 3), +D(t.pct, 1), t.tier, t.bid]), `Uplift Louisiana Roofing Atlas, module 12, ${L().name}. Defaults or your saved assumptions at ${new Date().toISOString().slice(0, 10)}.`)); };
    $('#l12CityCsv', root).onclick = () => { const rows = lineCities(st.k).sort((a, b) => b.fees - a.fees); const h1 = (FCOPY.AC[st.k] || {}).h1 || (L().name + ' in {city}'); saveFile(`louisiana-${slug(L().name)}-city-pages.csv`, toCSV(['city', 'parish', 'residents', 'zips', 'jobs_a_year', 'jobs_open_to_marketing', 'gross_profit_pool', 'mapped_roofers_nearby', 'spanish_at_home_pct', 'page_plan', 'suggested_h1'], rows.map(r => [r.name, PA[r.pi] ? PA[r.pi].name : '', r.pop, r.nzip, +D(r.pool, 1), +D(r.cases, 2), Math.round(r.fees), r.comp, +D(r.span, 1), pagePlan(r), houseClean(h1.replace('{city}', r.name))]), `Uplift Louisiana Roofing Atlas, module 12, ${L().name}. H1s are starting points; verify internal links against the live sitemap.`)); };
    $('#l12Desk', root).onclick = () => goModule('desk', { zips: st.sel ? [st.sel] : T.filter(t => inScope(t.z)).sort((a, b) => b.eff - a.eff).slice(0, 25).map(t => t.zip), line: st.k });
    $('#l12Forge', root).onclick = () => { const cs = lineCities(st.k).filter(c => (!st.par || (PA[c.pi] && PA[c.pi].fips === st.par)) && (!st.reg || (PA[c.pi] && PA[c.pi].reg === +st.reg))).sort((a, b) => b.fees - a.fees).slice(0, 12); goModule('forge', { zips: cs.map(c => c.c.zips[0]).filter(Boolean), line: st.k }); };
    BUS.on('theme', () => { staticFor = null; render(); }); BUS.on('slm', () => { staticFor = null; render(); }); BUS.on('brand', () => { staticFor = null; render(); });
    this.receive = p => { if (!p) return; if (p.line && PLI[p.line]) { st.k = p.line; $$('#l12Lines button', root).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === st.k))); } if (p.zip && ZI[p.zip]) { st.sel = ZI[p.zip].res_ok ? p.zip : null; map.fitTo([p.zip]); } render(); };
    render();
  }
});
