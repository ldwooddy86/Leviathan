/* ==== 31_m17_stock.js ==== */
/* ==== m17 Roof Stock and Materials ==== */
"use strict";
if (!LAYERS.metal_sh) LAYERS.metal_sh = { l: 'Metal share of residential reroofs (%, model)', grp: 'Roof stock and age', dir: 1, ramp: 'teal', g: 'D', f: v => P(v, 0), note: 'An assumption, not a count: 12 percent statewide, scaled up in rural and higher income ZIPs. No public source records the roof covering on each home.' };
/* Lanczos gamma, for the Weibull roof life (mean = scale × Γ(1 + 1/shape)) */
function gammaFn(z) { const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7]; if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gammaFn(1 - z)); z -= 1; let x = c[0]; for (let i = 1; i < g + 2; i++) x += c[i] / (z + i); const t = z + g + 0.5; return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x; }
registerModule({
  key: 'stock', num: '17', title: 'Roof Stock and Materials', desc: 'How old Louisiana roofs are, what they are made of, what materials cost and what the code and FORTIFIED require',
  mount(root) {
    const st = { layer: 'ra20_sh', par: '', reg: '', sel: null };
    const KEYS = ['ra20_sh', 'ra15_sh', 'ra20', 'wave', 'nxt', 'ra_med', 'yrs64', 'yb_med', 'pre80_sh', 'roofs', 'mh_sh', 'metal_sh', 'cru', 'value', 'own_sh', 'mort_sh'].filter(k => LAYERS[k]);
    const AH = DATA.ts.agehist;
    const medOf = a => { const t = sum(a) / 2; let c = 0; for (let i = 0; i < a.length; i++) { c += a[i]; if (c >= t) return i; } return a.length - 1; };
    const medAge = medOf(AH);
    const PPI = DATA.ts.ppi; const ppiAt = (s, ym) => (s.find(x => x[0] === ym) || [])[1];
    const yoy = s => { const L = s[s.length - 1]; const [y, m] = L[0].split('-'); const prev = ppiAt(s, (+y - 1) + '-' + m); return prev ? (L[1] / prev - 1) * 100 : null; };
    const since20 = s => { const b = ppiAt(s, '2020-01'); return b ? (s[s.length - 1][1] / b - 1) * 100 : null; };
    const ymTxt = ym => { const [y, m] = String(ym).split('-'); return MONL[+m - 1] + ' ' + y; };
    const YB_K = ['ybold', 'yb40', 'yb50', 'yb60', 'yb70', 'yb80', 'yb90', 'yb00', 'yb10', 'yb20'];
    const YB_L = ['1939 or earlier', '1940s', '1950s', '1960s', '1970s', '1980s', '1990s', '2000s', '2010s', '2020 or later'];
    const YB_MID = [1930, 1945, 1955, 1965, 1975, 1985, 1995, 2005, 2015, 2022];
    const ybState = META.yb.slice().reverse(); const pre80 = sum(ybState.slice(0, 5)) / sum(ybState) * 100;
    const cruTot = sum(Z.map(z => z.cru || 0));
    const WB = META.model.WB; const lam = WB.L / gammaFn(1 + 1 / WB.k);
    const Sv = t => Math.exp(-Math.pow(Math.max(0, t) / lam, WB.k)); const Hz = t => 1 - Sv(t + 1) / Sv(t);
    const AHS = META.ahs; const FT = META.fort;
    const asL = PPI.asph[PPI.asph.length - 1], stL = PPI.steel[PPI.steel.length - 1];
    root.innerHTML = mastHTML({ eyebrow: 'Module 17 · Roof Stock and Materials · age, vintage, materials, prices and the code', title: 'Roof Stock and Materials',
      dek: `What is on Louisiana's roofs and how old it is. The atlas ages every one unit roof in the state from the decade each home was built, the storms that replaced roofs in waves, and a service life calibrated to the American Housing Survey, then counts the roofs coming due in each ZIP. Beside the stock sit the materials: how long each covering lasts in Gulf heat and wind, what the FORTIFIED standard adds, what the code asks of a reroof, and what shingles and steel cost now.`,
      meta: [`<b>Roofs</b> ${K(META.roofs)} one unit roofs, ${K(META.mh)} mobile homes, about ${K(cruTot)} commercial roofs`, `<b>Homes</b> median year built ${META.yb_med}; ${P(pre80, 0)} built before 1980`, `<b>Prices</b> BLS producer price indexes through ${ymTxt(asL[0])}`, '<b>Grade</b> A housing counts, B roof ages, D material mix'],
      bar: 'Roof Stock and Materials', barsub: 'Age, vintage, materials, prices and the code',
      actions: [{ id: 'k7Csv', label: '↓ ZIP roof stock CSV' }, { id: 'k7Desk', label: 'Campaign Desk ↗', title: 'Send the ZIPs with the most roofs coming due' }, { id: 'k7Lines', label: 'Service Lines ↗', title: 'Open the replacement line' }] }) +
      `<div class="wrap">
      ${callout('', 'Read this first: roof age is modeled, not recorded', `No public register records when each Louisiana roof was last replaced. The atlas builds roof ages from the decade each home was built (Census), a service life averaging ${WB.L} years with a realistic spread (Weibull, shape ${WB.k}), and the roofs each storm replaced (module 02), then checks the result against the replacement rates owners report to the American Housing Survey. The fit is close by decade built (table below), but a ZIP's roof ages are an estimate. Since August 1, 2025 every reroof needs a permit (Act 239 of 2025), so parish permit logs will turn this estimate into a count over the next few years.`)}
      <div class="kpis" id="k7Kpis"></div>
      <div class="controls">
        <div class="ctl" style="flex:1 1 300px"><label class="fl" for="k7Layer">Map measure</label><select id="k7Layer">${KEYS.map(k => `<option value="${k}" ${k === st.layer ? 'selected' : ''}>${esc(LAYERS[k].l)}</option>`).join('')}</select></div>
        <div class="ctl"><label class="fl" for="k7Reg">Region</label><select id="k7Reg"><option value="">All nine regions</option>${REG_KEYS.map(k => `<option value="${k}">${esc(REGN[k])}</option>`).join('')}</select></div>
        <div class="ctl"><label class="fl" for="k7Par">Parish</label><select id="k7Par"><option value="">All 64 parishes</option>${PA.slice().sort((a, b) => a.name.localeCompare(b.name)).map(p => `<option value="${p.fips}">${esc(p.name)}</option>`).join('')}</select></div>
      </div>
      <div class="grid2">
        <div class="card mapcard"><div id="k7Map"></div><div class="legend" id="k7Leg"></div></div>
        <div class="stack">
          <div class="card"><div class="card-h" style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start"><div><h3 id="k7Name">Louisiana</h3><p id="k7Sub">Click any ZIP</p></div><span class="pill" id="k7Pill">State</span></div><div class="card-b" id="k7Detail"></div></div>
          <div class="card"><div class="card-h"><h3>Roofs coming due</h3><p id="k7TopSub">ZIPs by roofs aged 15 to 19. Click a row for the ZIP.</p></div><div class="tscroll short" id="k7Top"></div></div>
        </div>
      </div>
      ${card('Roof age', 'One unit roofs by age in years for the area chosen (model, 2026). Bars past 15 years shade darker, past 20 darkest.', '<div id="k7Age"></div><p class="chartnote" id="k7AgeNote"></p>', 'mt')}
      <div class="split">
        ${card('Homes by decade built', 'Housing units by year built for the area chosen (ACS 2020 to 2024). Older homes mean older decks, older attachment and more reroofs that must be brought up to code.', '<div id="k7Yb"></div><p class="chartnote" id="k7YbNote"></p>')}
        ${card('What kind of roofs', 'Housing units by building type and the estimated commercial roofs in the area chosen. One unit homes carry the residential lines; 2 to 4 unit buildings count with them; 5 or more units are the multifamily line.', '<div id="k7Units"></div><p class="chartnote" id="k7UnitsNote"></p>')}
      </div>
      <div class="split">
        ${card('How long a roof lasts here', `The service life the model uses: the share of roofs still on the house at each age, and the chance a roof of that age is replaced in the coming year, before storms.`, '<div id="k7Life"></div><div id="k7LifeLeg"></div><p class="chartnote" id="k7LifeNote"></p>')}
        ${card('The model against the American Housing Survey', 'Annual roof replacement rates by decade built: what owners in the region report (AHS 2023) and what the model produces for the same homes.', '<div id="k7Ahs"></div><p class="chartnote" id="k7AhsNote"></p>')}
      </div>
      ${card('Materials and service lives', 'What goes on Louisiana roofs, how long it lasts and what Gulf weather does to it. Service lives are typical ranges, not warranties.', '<div id="k7Mat"></div>', 'mt')}
      <div class="split">
        ${card('Shingle and steel prices', 'Producer price indexes for asphalt roofing materials and steel mill products, January 2020 = 100 (BLS, monthly).', '<div id="k7Ppi"></div><div id="k7PpiLeg"></div><p class="chartnote" id="k7PpiNote"></p>')}
        ${card('What owners spend on roofs', 'Roof projects reported by owners in the American Housing Survey 2023, West South Central (Louisiana, Texas, Oklahoma, Arkansas) single family owners and Southern mobile homes.', '<div id="k7Spend"></div>')}
      </div>
      <div class="split">
        ${card('FORTIFIED Roof: what the standard adds', 'The IBHS FORTIFIED Roof designation over a code roof, and the money behind it in Louisiana.', '<div id="k7Fort"></div>')}
        ${card('Code and permits for a reroof', 'The rules a reroof meets in Louisiana, with how certain each one is.', '<div id="k7Code"></div>')}
      </div>
      <div class="split">
        ${card('New homes: building permits', 'Housing units authorized by building permits for the area chosen (Census Building Permits Survey). New homes feed the new construction line now and the replacement line twenty years on.', '<div id="k7Bps"></div><div id="k7BpsLeg"></div><p class="chartnote" id="k7BpsNote"></p>')}
        ${card('Commercial roof stock', 'Establishments by type in the area chosen (County Business Patterns 2023, ZIP detail) and the commercial roofs the atlas estimates from them.', '<div id="k7Com"></div><p class="chartnote" id="k7ComNote"></p>')}
      </div>
      ${card('From stock to campaign', 'How the roof stock turns into offers, pages and target lists, with the grade of each claim.', '<div id="k7Play"></div>', 'mt')}
      <div class="split">
        ${card('Caveats', 'What would change a conclusion drawn from this module.', '<div id="k7Cav"></div>')}
        ${card('Method and sources', 'How roof ages, stock and prices were built.', '<div id="k7Src"></div>')}
      </div>
      <div class="foot" id="k7Foot"></div></div>`;
    $('#k7Kpis', root).innerHTML = kpiHTML([
      { l: 'One unit roofs', g: 'A', v: K(META.roofs), d: `plus ${K(META.mh)} mobile homes and about ${K(cruTot)} commercial roofs` },
      { l: 'Median roof age', g: 'B', v: N(medAge) + ' years', d: 'half of one unit roofs are this age or younger; the 2020 and 2021 storms pulled it down' },
      { l: 'Roofs 20 years or older', g: 'B', v: K(META.ra20), d: `${P(META.ra20 / META.roofs * 100, 0)} of one unit roofs; ${K(META.ra15)} are 15 or older` },
      { l: 'The coming wave', g: 'B', v: K(META.wave), d: 'roofs aged 15 to 19 that cross 20 within five years' },
      { l: 'Due in the next 12 months', g: 'B', v: K(META.nxt), d: 'age driven replacements before any storm' },
      { l: 'Asphalt roofing prices', g: 'A', v: S(since20(PPI.asph), 0) + '%', d: `since January 2020; ${S(yoy(PPI.asph), 1)}% in the year to ${ymTxt(asL[0])}` },
      { l: 'Homes built before 1980', g: 'A', v: P(pre80, 0), d: `of ${K(sum(ybState))} homes; median year built ${META.yb_med}` },
    ]);
    const map = new ZipMap($('#k7Map', root), { roads: false, segHit: 'none', aria: 'Map of Louisiana ZIP codes shaded by roof stock', onSelect: z => select(z),
      onHover: (zz, e) => { const z = ZI[zz]; if (!z) return; const L = LAYERS[st.layer]; showTip(`<div class="tt">${esc(z.zip)} · ${esc(z.city)}</div><div class="ts">${esc(z.cty)} Parish</div>${tipRow(esc(L.l), z.res_ok ? L.f(z[st.layer]) : 'under 500 residents')}${tipRow('One unit roofs · 20 years or older', N(z.roofs) + ' · ' + P(z.ra20_sh, 0))}${tipRow('Aged 15 to 19 · due in 12 months', N(z.wave) + ' · ' + D(z.nxt, 0))}${tipRow('Median year built', String(z.yb_med || '—'))}<div class="tf">Click for the ZIP</div>`, e); } });
    const inScope = z => (!st.par || z.fips === st.par) && (!st.reg || PA[z.pi].reg === +st.reg);
    const scopeN = () => st.par ? PNAME(st.par) + ' Parish' : st.reg ? REGN[st.reg] : 'Louisiana';
    const scopeZ = () => Z.filter(inScope);
    function render() {
      const L = LAYERS[st.layer]; const vals = ZR.map(z => z[st.layer]); const sc = qScale(vals, L.ramp, L.dir);
      map.fill(zz => { const z = ZI[zz]; if (!z || !z.res_ok) return null; return sc.f(z[st.layer]); });
      map.dim((st.par || st.reg) ? new Set(scopeZ().map(z => z.zip)) : null); map.select(st.sel);
      const v = vals.filter(isN);
      $('#k7Leg', root).innerHTML = legendHTML({ title: L.l, R: sc.R, lo: L.f(Math.min(...v)), hi: L.f(Math.max(...v)), note: `<b>Higher values shade darker.</b> Eight quantile classes across the ZIPs with 500 or more residents; gray ZIPs have fewer. ${G(L.g)}<br>${esc(L.note)}` });
      drawTop(); drawDetail(); drawScope();
    }
    function drawTop() {
      const rows = ZR.filter(inScope); const sk = ['ra20_sh', 'ra15_sh', 'ra20', 'wave', 'nxt', 'ra_med', 'roofs'].includes(st.layer) ? st.layer : 'wave';
      $('#k7TopSub', root).textContent = `${scopeN()}: ZIPs by ${LAYERS[sk].l.toLowerCase()}. Click a row for the ZIP.`;
      dataTable($('#k7Top', root), [{ k: 'zip', h: 'ZIP', l: 1, f: v => `<b>${esc(v)}</b>` }, { k: 'city', h: 'City', l: 1 }, { k: 'roofs', h: 'Roofs', f: v => N(v) }, { k: 'ra20_sh', h: '20 yrs+', f: v => P(v, 0) }, { k: 'wave', h: '15 to 19', f: v => N(v), t: 'Roofs aged 15 to 19' }], rows, { sortKey: sk, id: r => r.zip, onClick: zz => select(zz), rowClass: r => r.zip === st.sel ? 'sel' : '' });
    }
    const unitsOf = zs => ({ u1: sum(zs.map(z => z.u1 || 0)), mf24: sum(zs.map(z => z.mf24 || 0)), mf5u: sum(zs.map(z => z.mf5u || 0)), mh: sum(zs.map(z => z.mh || 0)), hu: sum(zs.map(z => z.hu || 0)) });
    const ybOf = zs => YB_K.map(k => sum(zs.map(z => z[k] || 0)));
    const medYb = a => { const t = sum(a) / 2; let c = 0; for (let i = 0; i < a.length; i++) { if (c + a[i] >= t) { const lo = i === 0 ? 1920 : [1939, 1940, 1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020][i]; const span = i === 0 ? 20 : i === 9 ? 5 : 10; return Math.round(lo + span * (t - c) / Math.max(1, a[i])); } c += a[i]; } return null; };
    function drawDetail() {
      const box = $('#k7Detail', root); const z = st.sel ? ZI[st.sel] : null;
      if (z) {
        $('#k7Name', root).textContent = `${z.zip} · ${z.city}`; $('#k7Sub', root).textContent = `${z.cty} Parish · roof stock of the ZIP`; $('#k7Pill', root).textContent = 'ZIP';
        const a = DATA.agez[z.zip] || []; const U = unitsOf([z]);
        box.innerHTML = `<div class="big">${N(z.roofs)}<span style="font-size:13px;font-weight:500;color:var(--ink-3)"> one unit roofs</span></div><div class="mini" style="margin-bottom:10px">median roof age ${a.length ? medOf(a) : '—'} years · median home built ${z.yb_med || '—'} · ${P(z.pre80_sh, 0)} built before 1980</div>
          <div class="rowl"><span>20 years or older · 15 years or older</span><b>${N(z.ra20)} (${P(z.ra20_sh, 0)}) · ${N(z.ra15)} (${P(z.ra15_sh, 0)})</b></div>
          <div class="rowl"><span>Aged 15 to 19 · due in the next 12 months</span><b>${N(z.wave)} · ${D(z.nxt, 0)}</b></div>
          <div class="rowl"><span>Last hurricane force winds</span><b>${z.last64 ? z.last64 + ' (' + z.yrs64 + ' years ago)' : 'none modeled since 1950'}</b></div>
          <div class="rowl"><span>Mobile homes · 2 to 4 unit · 5+ unit homes</span><b>${N(U.mh)} · ${N(U.mf24)} · ${N(U.mf5u)}</b></div>
          <div class="rowl"><span>Commercial roofs (estimate) · metal share of reroofs (model)</span><b>${D(z.cru, 0)} · ${P(z.metal_sh, 0)}</b></div>
          <div class="rowl"><span>Owner occupied · owners with a mortgage</span><b>${P(z.own_sh, 0)} · ${P(z.mort_sh, 0)}</b></div>
          <div class="rowl"><span>Median home value · household income</span><b>${M$(z.value)} · ${M$(z.inc)}</b></div>
          <div class="dsec">Roof age in the ZIP</div><div id="k7ZAge"></div>
          <div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap"><button class="ibtn" id="k7ZIdx">Roof Demand Index ↗</button><button class="ibtn" id="k7ZStorm">Storm history ↗</button><button class="ibtn" id="k7ZDesk">ZIP to the Desk ↗</button><button class="ibtn" id="k7Clr">Clear</button></div>`;
        if (a.length) ageChart($('#k7ZAge', root), a, 150);
        $('#k7ZIdx', root).onclick = () => goModule('index', { zip: z.zip }); $('#k7ZStorm', root).onclick = () => goModule('storms', { zip: z.zip }); $('#k7ZDesk', root).onclick = () => goModule('desk', { zips: [z.zip] });
        $('#k7Clr', root).onclick = () => { st.sel = null; map.reset(); render(); };
        return;
      }
      const zs = scopeZ(); const tot = k => sum(zs.map(r => r[k] || 0)); const roofs = tot('roofs'); const a = ageHist(zs.map(r => r.zip)); const U = unitsOf(zs);
      $('#k7Name', root).textContent = scopeN(); $('#k7Sub', root).textContent = 'Click any ZIP'; $('#k7Pill', root).textContent = st.par ? 'Parish' : st.reg ? 'Region' : 'State';
      box.innerHTML = `<div class="big">${N(roofs)}<span style="font-size:13px;font-weight:500;color:var(--ink-3)"> one unit roofs</span></div><div class="mini" style="margin-bottom:10px">median roof age ${medOf(a)} years · median home built about ${medYb(ybOf(zs)) || '—'}</div>
        <div class="rowl"><span>20 years or older · 15 years or older</span><b>${N(tot('ra20'))} (${P(tot('ra20') / Math.max(1, roofs) * 100, 0)}) · ${N(tot('ra15'))}</b></div>
        <div class="rowl"><span>Aged 15 to 19 · due in the next 12 months</span><b>${N(tot('wave'))} · ${N(tot('nxt'))}</b></div>
        <div class="rowl"><span>Mobile homes · 2 to 4 unit · 5+ unit homes</span><b>${N(U.mh)} · ${N(U.mf24)} · ${N(U.mf5u)}</b></div>
        <div class="rowl"><span>Commercial roofs (estimate)</span><b>${N(tot('cru'))}</b></div>
        <div class="rowl"><span>Owner occupied homes</span><b>${N(sum(zs.map(r => (r.hh || 0) * (r.own_sh || 0) / 100)))}</b></div>
        <p class="mini" style="margin-top:10px">The roof age chart below and the vintage, building type, permit and commercial cards follow the area chosen.</p>`;
    }
    function drawScope() {
      const zs = st.sel ? [ZI[st.sel]] : scopeZ(); const nm = st.sel ? 'ZIP ' + st.sel : scopeN();
      const a = st.sel ? (DATA.agez[st.sel] || []) : (st.par || st.reg ? ageHist(zs.map(z => z.zip)) : AH);
      ageChart($('#k7Age', root), a, 230);
      const tA = sum(a) || 1; const peaks = a.map((v, i) => ({ i, v })).filter(o => o.i > 0 && o.i < 40 && o.v > 1.5 * ((a[o.i - 1] + a[o.i + 1]) / 2)).sort((x, y) => y.v - x.v).slice(0, 4).sort((x, y) => x.i - y.i);
      const yNow = 2026; const STORMY = { 2005: 'Katrina and Rita', 2008: 'Gustav and Ike', 2012: 'Isaac', 2020: 'Laura, Delta and Zeta', 2021: 'Ida', 2024: 'Francine', 2002: 'Lili and Isidore', 2019: 'Barry' };
      $('#k7AgeNote', root).innerHTML = `${esc(nm)}: median roof age <b>${medOf(a)} years</b>; <b>${P(sum(a.slice(20)) / tA * 100, 0)}</b> of roofs are 20 or older and <b>${P(sum(a.slice(15, 20)) / tA * 100, 0)}</b> are 15 to 19. ${peaks.length ? 'Spikes at ' + listAnd(peaks.map(o => `${o.i} years (${yNow - o.i}${STORMY[yNow - o.i] ? ', ' + STORMY[yNow - o.i] : ''})`)) + ' are storm years: a storm replaces thousands of roofs at once, and those roofs then age together.' : ''} The model's ages are as of 2026. ${G('B')}`;
      const yb = ybOf(zs); const C = ramp('green');
      barChart($('#k7Yb', root), { cats: YB_L, series: [{ name: 'Housing units', color: C[5], values: yb }], H: 220, W: 560, L: 52, rot: true, fmt: v => K(v), highlight: i => i <= 4 ? C[6] : C[3], aria: 'Housing units by decade built' });
      const pre = sum(yb.slice(0, 5)) / Math.max(1, sum(yb)) * 100;
      $('#k7YbNote', root).innerHTML = `${esc(nm)}: ${P(pre, 0)} of homes were built before 1980 (darker bars) and the median home was built about ${medYb(yb) || '—'}. Pre 1980 homes often have plank or thin decking and smooth shank nails; a reroof there usually needs deck repair and renailing, which raises the ticket and is exactly what FORTIFIED requires. ${G('A')}`;
      const U = unitsOf(zs); const cru = sum(zs.map(z => z.cru || 0));
      const ur = [{ l: 'One unit homes', v: U.u1, c: C[6] }, { l: 'Units in 2 to 4 unit buildings', v: U.mf24, c: C[4] }, { l: 'Units in 5+ unit buildings', v: U.mf5u, c: ramp('teal')[5] }, { l: 'Mobile homes', v: U.mh, c: ramp('lime')[5] }, { l: 'Commercial roofs (estimate)', v: cru, c: ramp('lime')[7] }];
      hbarChart($('#k7Units', root), ur.map(r => ({ l: r.l, v: r.v, t: K(r.v), color: r.c })), { W: 520, L: 190, R: 56, rowH: 26, aria: 'Housing units by building type and commercial roofs' });
      $('#k7UnitsNote', root).innerHTML = `${esc(nm)}: mobile homes are ${P(U.mh / Math.max(1, U.hu) * 100, 0)} of homes (the mobile home line, module 12), and 5+ unit buildings hold ${P(U.mf5u / Math.max(1, U.hu) * 100, 0)} of units (the multifamily line). Commercial roofs are estimated from establishment counts weighted by how often each industry owns a separate building, scaled to about ${K(META.model.ANCH.cru)} statewide (grade C).`;
      drawBps(); drawCom(zs, nm);
    }
    function drawBps() {
      const ps = st.par ? [PAI[st.par]] : st.reg ? PA.filter(p => p.reg === +st.reg) : null;
      const yrs = Object.keys(DATA.ts.permits).map(Number).sort((a, b) => a - b);
      const get = y => ps ? ps.reduce((o, p) => { const b = (p.bps || {})[y] || [0, 0, 0]; o[0] += b[0]; o[1] += b[1]; return o; }, [0, 0]) : DATA.ts.permits[y].slice(0, 2);
      const one = yrs.map(y => get(y)[0]), all = yrs.map(y => get(y)[1]);
      const C = ramp('green'); const ser = [{ name: 'One unit homes', color: C[6], values: one }, { name: 'Units in 2+ unit buildings', color: ramp('teal')[5], values: all.map((v, i) => Math.max(0, v - one[i])) }];
      barChart($('#k7Bps', root), { cats: yrs.map(String), series: ser, stacked: true, H: 220, W: 560, L: 52, rot: true, fmt: v => K(v), aria: 'Housing units permitted by year' });
      $('#k7BpsLeg', root).innerHTML = legendRow(ser.map(x => ({ name: x.name, color: x.color, sq: 1 })));
      const y26 = ps ? sum(ps.map(p => p.ytd26 || 0)) : DATA.ts.ytd26, y25 = ps ? sum(ps.map(p => p.ytd25 || 0)) : DATA.ts.ytd25;
      const pk = yrs[all.indexOf(Math.max(...all))];
      $('#k7BpsNote', root).innerHTML = `${esc(st.par ? PNAME(st.par) + ' Parish' : st.reg ? REGN[st.reg] : 'Louisiana')}: ${N(all[all.length - 1])} units permitted in ${yrs[yrs.length - 1]}, against a peak of ${N(Math.max(...all))} in ${pk}. January to August 2026: ${N(y26)} units, ${y25 ? S((y26 / y25 - 1) * 100, 0) + '% on the same months of 2025' : 'no 2025 comparison'}. These are new buildings only; reroofs do not appear in the Census survey, but since August 2025 they need a local permit. ${G('A')}`;
    }
    function drawCom(zs, nm) {
      const T = k => sum(zs.map(z => z[k] || 0));
      const rows = [['Retail stores', 'retail'], ['Restaurants and bars', 'food'], ['Health care offices and facilities', 'health'], ['Offices (finance, professional, management)', 'office'], ['Religious congregations', 'church'], ['Manufacturing plants', 'mfg'], ['Schools and training', 'school'], ['Auto dealers', 'auto'], ['Hotels and lodging', 'lodging'], ['Apartment owners (lessors)', 'apts'], ['Commercial building owners (lessors)', 'nonres'], ['Warehouses', 'whse']].map(([l, k]) => ({ l, v: T(k) })).filter(r => r.v > 0);
      if (rows.length) hbarChart($('#k7Com', root), rows.map((r, i) => ({ l: r.l, v: r.v, t: N(r.v), color: ramp('lime')[i < 4 ? 6 : 5] })), { W: 520, L: 230, R: 56, rowH: 22, aria: 'Establishments by type' });
      else $('#k7Com', root).innerHTML = '<p class="mini">No establishments recorded in the area chosen.</p>';
      $('#k7ComNote', root).innerHTML = `${esc(nm)}: ${N(T('est'))} establishments in all and about ${N(T('cru'))} commercial roofs (estimate). Low slope membranes (TPO, PVC, modified bitumen, built up) dominate warehouses, plants, big box retail and schools; churches and smaller offices often carry steep slope shingle or metal roofs. The atlas assumes a 22 year membrane life and that about ${P(META.model.ANCH.coat * 100, 0)} of commercial roofs are restored, coated or put on maintenance a year (grade D). Warehouse counts are low because County Business Patterns files many distribution buildings under the owning company's industry.`;
    }
    function select(zz) { if (!ZI[zz]) return; st.sel = st.sel === zz ? null : zz; render(); }
    /* static cards (redrawn on a theme change so their colors follow) */
    function drawStatic() {
      const ages = [...Array(41).keys()];
      lineChart($('#k7Life', root), { W: 560, H: 240, L: 48, series: [{ name: 'Still on the house (%)', color: ramp('green')[6], pts: ages.map(t => [t, Sv(t) * 100]), area: true }, { name: 'Replaced in the coming year (%)', color: ramp('teal')[5], pts: ages.map(t => [t, Hz(t) * 100]) }], x: { min: 0, max: 40, ticks: [0, 5, 10, 15, 20, 25, 30, 35, 40], fmt: v => v + ' yrs' }, y: { min: 0, max: 100, fmt: v => v + '%' }, tipTitle: x => 'Roof age ' + x + ' years', aria: 'Roof survival and annual replacement chance by age' });
      $('#k7LifeLeg', root).innerHTML = legendRow([{ name: 'Still on the house (%)', color: ramp('green')[6] }, { name: 'Replaced in the coming year (%)', color: ramp('teal')[5] }]);
      $('#k7LifeNote', root).innerHTML = `Mean life ${WB.L} years, Weibull shape ${WB.k} (scale ${D(lam, 1)} years). Half of roofs are replaced by about ${D(lam * Math.pow(Math.log(2), 1 / WB.k), 0)} years; at 15 years the chance of replacement in the coming year is ${P(Hz(15) * 100, 1)}, at 20 it is ${P(Hz(20) * 100, 1)} and at 25 it is ${P(Hz(25) * 100, 1)}. Storms come on top of this. The life is fitted to Southern owners' reports, slightly above the 20 years the National Association of Home Builders gives asphalt shingles, because many roofs outlive their rated life before owners replace them. ${G('B')}`;
      const V = AHS.vint; const vk = Object.keys(V);
      $('#k7Ahs', root).innerHTML = `<div class="xscroll"><table><thead><tr><th class="l">Homes built</th><th>AHS 2023 (owners)</th><th>Model</th><th>Gap</th></tr></thead><tbody>${vk.map(k => `<tr><td class="l">${esc(k.replace(/(\d{4})\D+(\d{4})/, '$1 to $2'))}</td><td>${P(V[k][1], 2)}</td><td>${P(V[k][0], 2)}</td><td>${S(V[k][0] - V[k][1], 2)}</td></tr>`).join('')}</tbody></table></div>`;
      const rmse = Math.sqrt(mean(vk.map(k => Math.pow(V[k][0] - V[k][1], 2))));
      $('#k7AhsNote', root).innerHTML = `Share of homes replacing the roof in a year, single family owner homes in the South. The model's root mean square error is ${D(rmse, 2)} points across the five decades. Homes built since 2010 replace roofs rarely (about 1 percent a year), homes from the 1960s to the 2000s at about 4 percent: that step is the age engine behind the replacement line. The calibration cohort assumes a Southern background of ${P(WB.rho * 100, 1)} a year of storm replacements; Louisiana ZIPs use their own storm footprints instead. ${G('B')}`;
      $('#k7Mat', root).innerHTML = proseTable([
        ['<b>Asphalt shingles, three tab</b>', '20 years (NAHB)', 'The cheapest roof and the most wind vulnerable: lighter mats and fewer nails hold less in a blow, and Gulf heat and humidity age the asphalt faster. Mostly replaced with architectural shingles now.', 'B'],
        ['<b>Asphalt shingles, architectural</b>', '20 to 30 years', 'The default Louisiana reroof. Look for wind ratings under ASTM D7158 (Class H) or D3161 (Class F) and the manufacturer\'s high wind nailing; algae resistant granules against the dark streaks that humid parishes get; impact rated (UL 2218 Class 4) versions for hail country in the north.', 'B'],
        ['<b>Metal, standing seam and exposed fastener</b>', '40 years or more', 'Growing in rural parishes and on camps, barns and mobile homes. Standing seam hides its fasteners; exposed fastener panels need screws and washers checked as they age. Near salt water use aluminum or coated steel rated for coastal exposure. Steel prices move the quote (chart below).', 'C'],
        ['<b>Clay and concrete tile, slate</b>', '50 years or more (NAHB)', 'Historic New Orleans and high end homes. Heavy, long lived and costly to repair after wind; the underlayment beneath usually fails long before the tile, so tile reroofs are often underlayment jobs that reuse sound tiles.', 'B'],
        ['<b>Wood shakes, fiber cement</b>', '30 and 25 years (NAHB)', 'Rare in Louisiana; humidity and rot shorten wood. Older asbestos cement shingles, common before the 1980s, change the tear off and disposal rules.', 'C'],
        ['<b>Low slope membranes (TPO, PVC, EPDM, modified bitumen, built up)</b>', '15 to 30 years', 'The commercial and multifamily roof. Life depends on the membrane, its thickness and the drainage; ponding water and roof top equipment traffic end most early. The atlas assumes 22 years.', 'C'],
        ['<b>Coatings (silicone, acrylic, urethane)</b>', '10 to 20 years per coat', 'Restore a sound membrane or metal roof instead of tearing it off; warranties follow the coating thickness. The coatings and maintenance line (module 12).', 'C'],
        ['<b>Roof over systems for mobile homes</b>', '20 years or more', 'Metal or membrane roof overs on manufactured homes; a common answer to leaking mobile home roofs, sold at about half the ticket of a site built reroof (AHS median $5,100).', 'C'],
      ].map(r => [r[0], `<span class="mini">${r[1]}</span>`, r[2], G(r[3])]), ['Covering', 'Typical life', 'Louisiana notes', '']);
      const rb = s => { const b = ppiAt(s, '2020-01'); return s.map(([ym, v]) => { const [y, m] = ym.split('-'); return [+y + (+m - 1) / 12, v / b * 100]; }); };
      lineChart($('#k7Ppi', root), { W: 560, H: 240, L: 44, series: [{ name: 'Asphalt felts and coatings (shingles, underlayment)', color: ramp('green')[6], pts: rb(PPI.asph) }, { name: 'Steel mill products (metal panels, flashing)', color: ramp('teal')[5], pts: rb(PPI.steel) }], x: { min: 2019, max: 2026.7, ticks: [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026], fmt: v => String(Math.floor(v)) }, y: { fmt: v => N(v) }, hlines: [{ y: 100, label: 'January 2020' }], tipTitle: x => { const y = Math.floor(x + 1e-6), m = Math.round((x - y) * 12); return MONL[m] + ' ' + y; }, aria: 'Producer price indexes for asphalt roofing and steel' });
      $('#k7PpiLeg', root).innerHTML = legendRow([{ name: 'Asphalt felts and coatings (BLS WPU1361)', color: ramp('green')[6] }, { name: 'Steel mill products (BLS WPU1017)', color: ramp('teal')[5] }]);
      $('#k7PpiNote', root).innerHTML = `${ymTxt(asL[0])}: asphalt roofing materials stood ${S(since20(PPI.asph), 1)}% above January 2020 and ${S(yoy(PPI.asph), 1)}% above a year earlier; steel mill products ${S(since20(PPI.steel), 1)}% and ${S(yoy(PPI.steel), 1)}%. A price book from 2021 is under cost today. Producer prices lead distributor prices by a few months, so quotes need short validity periods and an escalation clause on materials; after a declared emergency, documented cost increases are the one lawful reason to raise prices (R.S. 29:732). ${G('A')}`;
      $('#k7Spend', root).innerHTML = `<div class="rowl"><span>Single family owners with a roof project in a year</span><b>${P(AHS.wsc_rate, 2)}</b></div>
        <div class="rowl"><span>Projects the owner did without a contractor</span><b>${P(AHS.wsc_diy, 1)}</b></div>
        <div class="rowl"><span>Median professional roof job · mean</span><b>${M$(AHS.wsc_med)} · ${M$(AHS.wsc_mean)}</b></div>
        <div class="rowl"><span>Paid at least partly by insurance</span><b>${P(AHS.wsc_ins, 1)}</b></div>
        <div class="rowl"><span>Homes with a roof leak in the past year</span><b>${P(AHS.wsc_leak, 2)}</b></div>
        <div class="rowl"><span>Mobile homes (South): roof projects a year · do it yourself · median job</span><b>${P(AHS.s_mh_rate, 2)} · ${P(AHS.s_mh_diy, 1)} · ${M$(AHS.s_mh_med)}</b></div>
        <p class="chartnote">Four in ten owner roof projects in the region are paid at least partly by insurance, which is why claim rules shape roofing marketing in Louisiana (module 03). One in six roof projects is done by the owner; mobile home owners do more than a quarter themselves. The atlas's default replacement ticket of ${M$(META.model.VAL.replace)} sits above the regional median on purpose: it assumes a full tear off with deck work at 2026 material prices, and it is an assumption you can change in module 12. ${G('A')}</p>`;
      $('#k7Fort', root).innerHTML = judgList([
        ['Sealed roof deck', 'The seams of the roof deck are taped or covered by a fully adhered underlayment, so rain stays out when shingles blow off. Water through the deck, not the lost shingles, causes most interior hurricane damage.'],
        ['Re nailed deck', 'The deck is fastened with ring shank nails at close spacing, which resist uplift far better than the smooth nails in most older homes.'],
        ['Edges and starter strips', 'Drip edge and starter strips at the eaves and rakes, attached to resist the uplift that peels a roof from its edges.'],
        ['Rated covering, high wind install', 'Shingles or other coverings rated for high wind, installed to the manufacturer\'s high wind specification.'],
        ['Documented by an evaluator', 'A certified FORTIFIED evaluator photographs each stage; IBHS issues the designation, which the grant and insurer discounts depend on.'],
        ['The money in 2026', `Louisiana Fortify Homes Program grants of up to ${M$(FT.grant)} paid to the contractor after certification; a June round of ${N(FT.round26)} grants by lottery; about ${MM(FT.lfhp26)} for the program plus ${MM(FT.restore26)} of HUD money for coastal homes through Restore ROOF. The atlas assumes about ${N(FT.anchor)} FORTIFIED reroofs a year statewide (grade C). Insurer discounts vary by company; a bill to mandate 20 to 30 percent discounts (SB 222 of 2025) failed.`],
      ]);
      $('#k7Code', root).innerHTML = proseTable([
        ['<b>Permit and inspections</b>', 'Every roof and reroof on a residential or commercial building needs a permit from the parish or municipality and the required inspections, for projects starting on or after August 1, 2025 (Act 239 of 2025). Working without one is now a licensing violation (Act 422 of 2025).', 'A'],
        ['<b>License</b>', 'Residential roofing of $7,500 or more needs the Residential Roofing or Residential Construction classification since August 1, 2026, and advertising the work counts (Act 757 of 2026). Commercial work of $50,000 or more needs a commercial license with the roofing classification.', 'A'],
        ['<b>The building code</b>', 'The Louisiana State Uniform Construction Code adopts the International Residential and Building Codes with state amendments. Underlayment, flashing, drip edge and the covering\'s wind rating follow the design wind speed at the site, which rises from north Louisiana to the coast.', 'B'],
        ['<b>Recover or tear off</b>', 'Under the residential code a new covering may not go over an existing roof that already has two layers, that is water soaked or deteriorated, or that is slate, clay or cement tile (IRC R908.3.1.1). Most Louisiana reroofs are full tear offs, which is also the only way to inspect and renail the deck.', 'B'],
        ['<b>Insurance and roof age</b>', 'Act 9 of 2024 (HB 611) ended the rule that protected homeowners policies in force more than three years: insurers may file plans to nonrenew up to 5 percent of those policies, and from January 1, 2025 may raise deductibles or change coverage on them. Roof condition is a common reason for an insurer inspection, so older roofs in older ZIPs face more of it.', 'A'],
      ].map(r => [r[0], r[1], G(r[2])]));
    }
    drawStatic();
    $('#k7Play', root).innerHTML = proseTable([
      ['<b>Work the wave</b>', `Roofs aged 15 to 19 (${K(META.wave)} statewide) are next decade's replacement market, and the 2005 and 2008 storm cohorts are inside that window now. Sort the table above by roofs aged 15 to 19, send the ZIPs to the Desk, and lead with inspections and financing before the roof fails.`, 'B'],
      ['<b>Roof age and insurance</b>', `With the three year rule gone (Act 9 of 2024), insurers can act on older roofs at renewal. A page explaining what an insurer's roof inspection looks for, and a fast written estimate when an owner gets a notice, catches owners at the moment the decision is forced. Describe the process; do not interpret anyone's policy (R.S. 37:2159.1).`, 'B'],
      ['<b>FORTIFIED</b>', `Grants pay ${M$(FT.grant)} to the contractor after certification. Register with the Louisiana Fortify Homes Program and train with IBHS before marketing grant work; aim pages at owner occupied, homesteaded homes with older roofs, and never promise a grant (rounds are by lottery) or a discount size.`, 'B'],
      ['<b>Pre 1980 neighborhoods</b>', `${P(pre80, 0)} of Louisiana homes were built before 1980. Price deck repair and renailing into the estimate, show it in photos, and sell it as the FORTIFIED groundwork it is.`, 'B'],
      ['<b>Metal</b>', 'Rural and higher income ZIPs carry the highest modeled metal share. Steel prices swing more than shingles, so quote metal with a short validity period.', 'D'],
      ['<b>Mobile homes</b>', `${K(META.mh)} mobile homes, a quarter of their roof work done by owners, and a median professional job of ${M$(AHS.s_mh_med)}. Roof over systems and leak repair are the offer; Spanish language pages matter in many of these ZIPs (module 01, Language layers).`, 'C'],
      ['<b>Commercial</b>', 'Warehouses, plants, schools and congregations hold the low slope roofs. Restoration and maintenance contracts (coatings) keep a commercial roofer busy between storms; module 12 sizes both lines.', 'C'],
    ].map(r => [r[0], r[1], G(r[2])]));
    $('#k7Cav', root).innerHTML = proseTable([
      ['Ages are modeled', 'Roof ages come from the year each home was built, a calibrated service life and modeled storm resets. A ZIP where a hailstorm or a reroofing boom replaced roofs outside the model will be younger than shown.'],
      ['Storm resets lean on FEMA', 'The storm side of the model is fitted to FEMA registrations multiplied up to roofs (grade D), so the size of the 2020 and 2021 spikes, and the low statewide median age they produce, carry that uncertainty.'],
      ['One roof per home', 'Each one unit home is one roof; attached townhomes are counted as separate roofs though they share one. Units in 2 to 4 unit buildings are counted separately.'],
      ['Material mix is an assumption', 'No public source records roof coverings by home; the metal share is an assumption scaled by density and income (grade D).'],
      ['Commercial roofs are estimated', 'Establishments are not buildings: one plant may hold several roofs, one strip mall many businesses. The total is anchored to the national commercial building survey scaled to Louisiana (grade C).'],
      ['Regional survey', 'The American Housing Survey reports for the West South Central division and the South; Louisiana alone is too small a sample to report.'],
      ['Producer prices', 'The price indexes track manufacturers\' selling prices, not distributor or installed prices, and include products beyond roofing.'],
    ]);
    $('#k7Src', root).innerHTML = `<p class="body">Each ZIP's homes by decade built (ACS) enter a cohort model run year by year from 1905 to 2026: roofs fail with a Weibull hazard (mean ${WB.L} years, shape ${WB.k}), storms replace a share of surviving roofs at the modeled wind of every storm since 1950 (module 02), and new homes enter at age zero. The life and shape were fitted so that the model reproduces the AHS 2023 roof replacement rates by decade built. Roofs 20 and older, roofs 15 to 19 and the coming year's age driven replacements come straight from the model's 2026 age distribution.</p>` + srcRows([
      ['Homes by year built and type', 'Census ACS 2020 to 2024 five year estimates, tables B25034 and B25024, ZCTA', 'A', '2024 release', 'https://www.census.gov/programs-surveys/acs'],
      ['Roof projects and leaks', 'American Housing Survey 2023 public use file (roof replacement, roof leaks, project cost and payer)', 'A', '2023', 'https://www.census.gov/programs-surveys/ahs.html'],
      ['Material prices', 'BLS Producer Price Index, asphalt felts and coatings (WPU1361) and steel mill products (WPU1017), via FRED', 'A', 'through ' + ymTxt(asL[0]), 'https://fred.stlouisfed.org/series/WPU1361'],
      ['New homes', 'Census Building Permits Survey, county annual files 2005 to 2025 and 2026 year to date', 'A', 'August 2026', 'https://www.census.gov/construction/bps/'],
      ['Commercial stock', 'Census County Business Patterns 2023, ZIP code detail; CBECS 2018 for the statewide anchor', 'A/C', '2023', 'https://www.census.gov/programs-surveys/cbp.html'],
      ['Service lives', 'National Association of Home Builders, Study of Life Expectancy of Home Components (2007)', 'B', '2007', ''],
      ['FORTIFIED', 'IBHS FORTIFIED Roof standard; Louisiana Fortify Homes Program (LDI)', 'A', '2026', 'https://fortifiedhome.org/'],
      ['Code', 'Louisiana State Uniform Construction Code (La. R.S. 40:1730.21 et seq.); International Residential Code R908', 'B', 'current edition', ''],
    ]);
    $('#k7Foot', root).innerHTML = `<b style="color:var(--ink)">Uplift Louisiana Roofing Atlas</b>, module 17. Housing from the Census Bureau, roof projects from the American Housing Survey, prices from the Bureau of Labor Statistics. Roof ages are modeled. Compiled ${esc(new Date(META.compiled + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }))}.`;
    $('#k7Layer', root).onchange = e => { st.layer = e.target.value; render(); };
    $('#k7Reg', root).onchange = e => { st.reg = e.target.value; st.par = ''; $('#k7Par', root).value = ''; st.sel = null; if (st.reg) map.fitParishes(PA.filter(p => p.reg === +st.reg).map(p => p.fips)); else map.reset(); render(); };
    $('#k7Par', root).onchange = e => { st.par = e.target.value; st.reg = ''; $('#k7Reg', root).value = ''; st.sel = null; if (st.par) map.fitParishes([st.par]); else map.reset(); render(); };
    $('#k7Csv', root).onclick = () => { const rows = ZR.filter(inScope); saveFile('louisiana-roof-stock-by-zip.csv', toCSV(['zip', 'city', 'parish', 'one_unit_roofs', 'roofs_20_plus', 'share_20_plus', 'roofs_15_plus', 'roofs_15_to_19', 'due_next_12_months', 'median_roof_age', 'median_year_built', 'built_before_1980_pct', 'mobile_homes', 'units_2_to_4', 'units_5_plus', 'commercial_roofs_est', 'metal_share_model', 'last_hurricane_force_year'], rows.map(z => [z.zip, z.city, z.cty, z.roofs, z.ra20, z.ra20_sh, z.ra15, z.wave, z.nxt, z.ra_med, z.yb_med, z.pre80_sh, z.mh, z.mf24, z.mf5u, z.cru, z.metal_sh, z.last64 || '']), `Uplift Louisiana Roofing Atlas, module 17. Roof ages are modeled (cohort model, mean life ${WB.L} years); housing from ACS 2020 to 2024. ${scopeN()}.`)); };
    $('#k7Desk', root).onclick = () => goModule('desk', { zips: ZR.filter(inScope).sort((a, b) => (b.wave || 0) - (a.wave || 0)).slice(0, 25).map(z => z.zip), line: 'replace' });
    $('#k7Lines', root).onclick = () => goModule('lines', st.sel ? { zip: st.sel, line: 'replace' } : { line: 'replace' });
    BUS.on('theme', () => { render(); drawStatic(); });
    this.receive = p => { if (!p) return; if (p.zip && ZI[p.zip]) { st.sel = p.zip; map.fitTo([p.zip]); } if (p.layer && LAYERS[p.layer]) { st.layer = p.layer; $('#k7Layer', root).value = p.layer; } render(); };
    render();
  }
});
