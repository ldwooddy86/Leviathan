/* ==== 31_m17_stock.js ==== */
/* ==== m17 Roof Stock and Materials ==== */
"use strict";
/* gammaFn (the Weibull mean) lives in core, and every roof layer in the catalog of module 01, so this file defines no shared name. */
registerModule({
  key: 'stock', num: '17', title: 'Roof Stock and Materials', desc: 'How old California roofs are, what they are made of (shingle, tile, shake, membrane), what materials cost and what the code asks of a reroof',
  mount(root) {
    const st = { layer: 'ra20_sh', par: '', reg: '', sel: null };
    const KEYS = ['ra20_sh', 'ra25_sh', 'ra15_sh', 'ra20', 'ra25', 'wave', 'nxt', 'nxt_t', 'ra_med', 'yb_med', 'pre80_sh', 'own_yr', 'roofs', 'tile_sh', 'tile_n', 'tile25', 'tile25_sh', 'wood_sh', 'metal_sh', HC.solar, 'mh_sh', HC.fhsz, 'yrsfire', 'cru', 'mfb', 'value', 'own_sh', 'mort_sh'].filter(k => k && LAYERS[k]);
    const AH = DATA.ts.agehist; const AHT = DATA.ts.agehist_t || null; const MONL = MOL; const listAnd = joinAnd;
    const AM = (META.ahs || {}).metros || {}; const HD = META.harden || {}; const WBT = META.model.WBT || null;
    const MST = (META.mat || {}).state || {}; const ms = (k, d) => isN(MST[k]) ? (MST[k] <= 1 ? MST[k] * 100 : MST[k]) : d;
    const MS = { shingle: ms('shingle', 61.9), tile: ms('tile', 27.4), clay: ms('clay', 18.1), conc: ms('concrete', 9.3), wood: ms('wood', 5.4), metal: ms('metal', 2.2) };   /* RECS 2020, California single family; the data's own copy when it carries one */
    const tileTot = sum(Z.map(z => z.tile_n || 0)), tile25Tot = sum(Z.map(z => z.tile25 || 0));
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
    const AHS = META.ahs || {};
    const asL = PPI.asph[PPI.asph.length - 1], stL = PPI.steel[PPI.steel.length - 1];
    root.innerHTML = mastHTML({ eyebrow: 'Module 17 · Roof Stock and Materials · age, vintage, materials, prices and the code', title: 'Roof Stock and Materials',
      dek: `What is on California's roofs and how old it is. The atlas ages every one unit roof in the state from the decade each home was built, with tile on its own clock (the underlayment wears out, the tile goes back) and wildfire losses re entering as new roofs, on service lives fitted to the American Housing Survey, then counts the roofs coming due in each ZIP. Beside the stock sit the materials: shingle, tile, shake, metal and membrane, what a Class A assembly and the cool roof rule ask of a reroof, and what shingles and steel cost now.`,
      meta: [`<b>Roofs</b> ${K(META.roofs)} one unit roofs, ${K(META.mh)} mobile homes, about ${K(cruTot)} commercial roofs`, `<b>Homes</b> median year built ${META.yb_med}; ${P(pre80, 0)} built before 1980`, `<b>Prices</b> BLS producer price indexes through ${ymTxt(asL[0])}`, '<b>Grade</b> A housing counts, B roof ages, D roof covering'],
      bar: 'Roof Stock and Materials', barsub: 'Age, vintage, materials, prices and the code',
      actions: [{ id: 'k7Csv', label: '↓ ZIP roof stock CSV' }, { id: 'k7Desk', label: 'Campaign Desk ↗', title: 'Send the ZIPs with the most roofs coming due' }, { id: 'k7Lines', label: 'Service Lines ↗', title: 'Open the replacement line' }] }) +
      `<div class="wrap">
      ${callout('', 'Read this first: roof age and roof covering are modeled, not recorded', `No public register records when each California roof was last replaced or what covers it. The atlas builds roof ages from the decade each one unit home was built (Census) and two service lives: ${WB.L} years on average for shingle and other coverings (Weibull, shape ${WB.k})${WBT ? ` and ${WBT.L} years for the underlayment beneath tile` : ''}, then checks the result against the replacement rates owners in the West report to the American Housing Survey (table below). Which roofs are tile comes from a federal survey's shares by era built, not from a count. There is no storm reset: the only event that renews roofs in the model is a wildfire that destroyed them. A ZIP's roof ages are an estimate; where a city publishes re-roof permits (Los Angeles, San Francisco) they are the better count.`)}
      <div class="kpis" id="k7Kpis"></div>
      <div class="controls">
        <div class="ctl" style="flex:1 1 300px"><label class="fl" for="k7Layer">Map measure</label><select id="k7Layer">${KEYS.map(k => `<option value="${k}" ${k === st.layer ? 'selected' : ''}>${esc(LAYERS[k].l)}</option>`).join('')}</select></div>
        <div class="ctl"><label class="fl" for="k7Reg">Region</label><select id="k7Reg"><option value="">All ${numWord(NREG)} regions</option>${REG_KEYS.map(k => `<option value="${k}">${esc(REGN[k])}</option>`).join('')}</select></div>
        <div class="ctl"><label class="fl" for="k7Par">County</label><select id="k7Par"><option value="">All ${NCOUNTY} counties</option>${PA.slice().sort((a, b) => a.name.localeCompare(b.name)).map(p => `<option value="${p.fips}">${esc(p.name)}</option>`).join('')}</select></div>
      </div>
      <div class="grid2">
        <div class="card mapcard"><div id="k7Map"></div><div class="legend" id="k7Leg"></div></div>
        <div class="stack">
          <div class="card"><div class="card-h" style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start"><div><h3 id="k7Name">California</h3><p id="k7Sub">Click any ZIP</p></div><span class="pill" id="k7Pill">State</span></div><div class="card-b" id="k7Detail"></div></div>
          <div class="card"><div class="card-h"><h3>Roofs coming due</h3><p id="k7TopSub">ZIPs by roofs aged 15 to 19. Click a row for the ZIP.</p></div><div class="tscroll short" id="k7Top"></div></div>
        </div>
      </div>
      ${card('Roof age', 'One unit roofs by age in years for the area chosen (model, 2026). Tile roofs are drawn apart, by the age of the underlayment beneath the tile.', '<div id="k7Age"></div><p class="chartnote" id="k7AgeNote"></p>', 'mt')}
      <div class="split">
        ${card('Homes by decade built', 'Housing units by year built for the area chosen (ACS 2020 to 2024). Older homes mean older decks, older attachment and more reroofs that must be brought up to code.', '<div id="k7Yb"></div><p class="chartnote" id="k7YbNote"></p>')}
        ${card('What kind of roofs', 'Housing units by building type and the estimated commercial roofs in the area chosen. One unit homes carry the residential lines; 2 to 4 unit buildings count with them; 5 or more units are the multifamily line.', '<div id="k7Units"></div><p class="chartnote" id="k7UnitsNote"></p>')}
      </div>
      <div class="split">
        ${card('How long a roof lasts here', `The service lives the model uses: the share of roofs still on the house at each age, and the chance a roof of that age is replaced in the coming year, for shingle and other coverings and for the underlayment under tile.`, '<div id="k7Life"></div><div id="k7LifeLeg"></div><p class="chartnote" id="k7LifeNote"></p>')}
        ${card('The model against the American Housing Survey', 'Annual roof replacement rates by decade built: what owners in the West region report (AHS 2023) and what the model produces for the same homes.', '<div id="k7Ahs"></div><p class="chartnote" id="k7AhsNote"></p>')}
      </div>
      ${card('Materials and service lives', 'What covers California roofs, in what shares (Residential Energy Consumption Survey 2020, single family homes), and what sun, rain, salt air and fire do to each. Where no California life figure was found the table says so.', '<div id="k7Mat"></div>', 'mt')}
      <div class="split">
        ${card('Shingle and steel prices', 'Producer price indexes for asphalt roofing materials and steel mill products, January 2020 = 100 (BLS, monthly).', '<div id="k7Ppi"></div><div id="k7PpiLeg"></div><p class="chartnote" id="k7PpiNote"></p>')}
        ${card('What owners spend on roofs', 'Roof projects reported by owners of one unit homes in the American Housing Survey 2023 (San Jose 2021), with what two cities\' permit files add.', '<div id="k7Spend"></div>')}
      </div>
      <div class="split">
        ${card('The fire hardened roof: what Class A and the insurance rules add', 'What a roof in a fire zone must be, what the fires showed, and the money behind hardening in California.', '<div id="k7Fort"></div>')}
        ${card('Code and permits for a reroof', 'The rules a reroof meets in California, with how certain each one is. Module 03 has the citations.', '<div id="k7Code"></div>')}
      </div>
      <div class="split">
        ${card('New homes: building permits', 'Housing units authorized by building permits for the area chosen (Census Building Permits Survey). New homes feed the new construction line now and the replacement and tile lines a roof life on.', '<div id="k7Bps"></div><div id="k7BpsLeg"></div><p class="chartnote" id="k7BpsNote"></p>')}
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
      { l: 'Median roof age', g: 'B', v: N(medAge) + ' years', d: 'half of one unit roofs are this age or younger; no storm has reset the stock' },
      tileTot ? { l: 'Tile roofs', g: 'D', v: K(tileTot), d: `${P(tileTot / META.roofs * 100, 0)} of one unit roofs (model); ${K(tile25Tot)} with underlayment 25 years or older` } : null,
      { l: 'Roofs 20 years or older', g: 'B', v: K(META.ra20), d: `${P(META.ra20 / META.roofs * 100, 0)} of one unit roofs; ${K(META.ra15)} are 15 or older` },
      { l: 'The coming wave', g: 'B', v: K(META.wave), d: 'roofs aged 15 to 19 that cross 20 within five years' },
      { l: 'Due in the next 12 months', g: 'B', v: K(META.nxt), d: `age driven replacements${isN(META.nxt_t) ? ', plus ' + K(META.nxt_t) + ' tile relays' : ', tile relays apart'}` },
      { l: 'Asphalt roofing prices', g: 'A', v: S(since20(PPI.asph), 0) + '%', d: `since January 2020; ${S(yoy(PPI.asph), 1)}% in the year to ${ymTxt(asL[0])}` },
      { l: 'Homes built before 1980', g: 'A', v: P(pre80, 0), d: `of ${K(sum(ybState))} homes; median year built ${META.yb_med}` },
    ].filter(Boolean));
    const map = new ZipMap($('#k7Map', root), { roads: false, segHit: 'none', aria: 'Map of California ZIP codes shaded by roof stock', onSelect: z => select(z),
      onHover: (zz, e) => { const z = ZI[zz]; if (!z) return; const L = LAYERS[st.layer]; showTip(`<div class="tt">${esc(z.zip)} · ${esc(z.city)}</div><div class="ts">${esc(z.cty)} County</div>${tipRow(esc(L.l), z.res_ok ? L.f(z[st.layer]) : 'under 500 residents')}${tipRow('One unit roofs · 20 years or older', N(z.roofs) + ' · ' + P(z.ra20_sh, 0))}${tipRow('Aged 15 to 19 · due in 12 months', N(z.wave) + ' · ' + D(z.nxt, 0))}${tipRow('Tile roofs (model) · underlayment 25+', P(z.tile_sh, 0) + ' · ' + N(z.tile25))}${tipRow('Median year built', String(z.yb_med || '—'))}<div class="tf">Click for the ZIP</div>`, e); } });
    const inScope = z => (!st.par || z.fips === st.par) && (!st.reg || (PA[z.pi] && PA[z.pi].reg === +st.reg));
    const scopeN = () => st.par ? PNAME(st.par) + ' County' : st.reg ? REGN[st.reg] : ATLAS.state;
    const scopeZ = () => Z.filter(inScope);
    function render() {
      const L = LAYERS[st.layer]; const vals = ZR.map(z => z[st.layer]); const sc = qScale(vals, L.ramp, L.dir);
      map.fill(zz => { const z = ZI[zz]; if (!z || !z.res_ok) return null; return sc.f(z[st.layer]); });
      map.dim((st.par || st.reg) ? new Set(scopeZ().map(z => z.zip)) : null); map.select(st.sel);
      const v = vals.filter(isN);
      $('#k7Leg', root).innerHTML = legendHTML({ title: L.l, R: sc.R, lo: v.length ? L.f(Math.min(...v)) : '—', hi: v.length ? L.f(Math.max(...v)) : '—', note: `<b>${L.dir === -1 ? 'Lower' : 'Higher'} values shade darker.</b> Eight quantile classes across the ZIPs with 500 or more residents; gray ZIPs have fewer, and gray land with no ZIP is open country. ${G(L.g)}<br>${esc(L.note)}` });
      drawTop(); drawDetail(); drawScope();
    }
    function drawTop() {
      const rows = ZR.filter(inScope); const sk = ['ra20_sh', 'ra25_sh', 'ra15_sh', 'ra20', 'ra25', 'wave', 'nxt', 'nxt_t', 'ra_med', 'roofs', 'tile_n', 'tile25', 'tile_sh'].includes(st.layer) ? st.layer : 'wave';
      $('#k7TopSub', root).textContent = `${scopeN()}: ZIPs by ${LAYERS[sk].l.toLowerCase()}. Click a row for the ZIP.`;
      dataTable($('#k7Top', root), [{ k: 'zip', h: 'ZIP', l: 1, f: v => `<b>${esc(v)}</b>` }, { k: 'city', h: 'City', l: 1 }, { k: 'roofs', h: 'Roofs', f: v => N(v) }, { k: 'ra20_sh', h: '20 yrs+', f: v => P(v, 0) }, { k: 'wave', h: '15 to 19', f: v => N(v), t: 'Roofs aged 15 to 19' }, { k: 'tile25', h: 'Tile 25+', f: v => N(v), t: 'Tile roofs with underlayment 25 years or older (model)' }], rows, { sortKey: sk, limit: 400, id: r => r.zip, onClick: zz => select(zz), rowClass: r => r.zip === st.sel ? 'sel' : '' });
    }
    const unitsOf = zs => ({ u1: sum(zs.map(z => z.u1 || 0)), mf24: sum(zs.map(z => z.mf24 || 0)), mf5u: sum(zs.map(z => z.mf5u || 0)), mh: sum(zs.map(z => z.mh || 0)), hu: sum(zs.map(z => z.hu || 0)) });
    const ybOf = zs => YB_K.map(k => sum(zs.map(z => z[k] || 0)));
    const medYb = a => { const t = sum(a) / 2; let c = 0; for (let i = 0; i < a.length; i++) { if (c + a[i] >= t) { const lo = i === 0 ? 1920 : [1939, 1940, 1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020][i]; const span = i === 0 ? 20 : i === 9 ? 5 : 10; return Math.round(lo + span * (t - c) / Math.max(1, a[i])); } c += a[i]; } return null; };
    function drawDetail() {
      const box = $('#k7Detail', root); const z = st.sel ? ZI[st.sel] : null;
      if (z) {
        $('#k7Name', root).textContent = `${z.zip} · ${z.city}`; $('#k7Sub', root).textContent = `${z.cty} County · roof stock of the ZIP`; $('#k7Pill', root).textContent = 'ZIP';
        const a = DATA.agez[z.zip] || []; const U = unitsOf([z]);
        box.innerHTML = `<div class="big">${N(z.roofs)}<span style="font-size:13px;font-weight:500;color:var(--ink-3)"> one unit roofs</span></div><div class="mini" style="margin-bottom:10px">median roof age ${a.length ? medOf(a) : '—'} years · median home built ${z.yb_med || '—'} · ${P(z.pre80_sh, 0)} built before 1980</div>
          <div class="rowl"><span>20 years or older · 15 years or older</span><b>${N(z.ra20)} (${P(z.ra20_sh, 0)}) · ${N(z.ra15)} (${P(z.ra15_sh, 0)})</b></div>
          <div class="rowl"><span>Aged 15 to 19 · due in the next 12 months</span><b>${N(z.wave)} · ${D(z.nxt, 0)}</b></div>
          <div class="rowl"><span>25 years or older · tile roofs (model) · tile underlayment 25+</span><b>${N(z.ra25)} (${P(z.ra25_sh, 0)}) · ${N(z.tile_n)} (${P(z.tile_sh, 0)}) · ${N(z.tile25)}</b></div>
          <div class="rowl"><span>Wood shake roofs (model) · last wildfire with structure loss</span><b>${P(z.wood_sh, 1)} · ${z.lastfire ? z.lastfire + ' (' + z.yrsfire + ' years ago)' : 'none on record'}</b></div>
          <div class="rowl"><span>Mobile homes · 2 to 4 unit · 5+ unit homes</span><b>${N(U.mh)} · ${N(U.mf24)} · ${N(U.mf5u)}</b></div>
          <div class="rowl"><span>Commercial roofs (estimate) · metal share of reroofs (model)</span><b>${D(z.cru, 0)} · ${P(z.metal_sh, 0)}</b></div>
          <div class="rowl"><span>Owner occupied · owners with a mortgage</span><b>${P(z.own_sh, 0)} · ${P(z.mort_sh, 0)}</b></div>
          <div class="rowl"><span>Median home value · household income</span><b>${M$(z.value)} · ${M$(z.inc)}</b></div>
          <div class="dsec">Roof age in the ZIP</div><div id="k7ZAge"></div>
          <div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap"><button class="ibtn" id="k7ZIdx">Roof Demand Index ↗</button><button class="ibtn" id="k7ZStorm">Weather and fire ↗</button><button class="ibtn" id="k7ZDesk">ZIP to the Desk ↗</button><button class="ibtn" id="k7Clr">Clear</button></div>`;
        if (a.length) ageChart($('#k7ZAge', root), a, 150, (DATA.agez_t || {})[z.zip]);
        $('#k7ZIdx', root).onclick = () => goModule('index', { zip: z.zip }); $('#k7ZStorm', root).onclick = () => goModule('storms', { zip: z.zip }); $('#k7ZDesk', root).onclick = () => goModule('desk', { zips: [z.zip] });
        $('#k7Clr', root).onclick = () => { st.sel = null; map.reset(); render(); };
        return;
      }
      const zs = scopeZ(); const tot = k => sum(zs.map(r => r[k] || 0)); const roofs = tot('roofs'); const a = ageHist(zs.map(r => r.zip)); const U = unitsOf(zs);
      $('#k7Name', root).textContent = scopeN(); $('#k7Sub', root).textContent = 'Click any ZIP'; $('#k7Pill', root).textContent = st.par ? 'County' : st.reg ? 'Region' : 'State';
      box.innerHTML = `<div class="big">${N(roofs)}<span style="font-size:13px;font-weight:500;color:var(--ink-3)"> one unit roofs</span></div><div class="mini" style="margin-bottom:10px">median roof age ${medOf(a)} years · median home built about ${medYb(ybOf(zs)) || '—'}</div>
        <div class="rowl"><span>20 years or older · 15 years or older</span><b>${N(tot('ra20'))} (${P(tot('ra20') / Math.max(1, roofs) * 100, 0)}) · ${N(tot('ra15'))}</b></div>
        <div class="rowl"><span>Aged 15 to 19 · due in the next 12 months</span><b>${N(tot('wave'))} · ${N(tot('nxt'))}</b></div>
        <div class="rowl"><span>Tile roofs (model) · underlayment 25+ · relays due in 12 months</span><b>${N(tot('tile_n'))} · ${N(tot('tile25'))} · ${N(tot('nxt_t'))}</b></div>
        <div class="rowl"><span>Mobile homes · 2 to 4 unit · 5+ unit homes</span><b>${N(U.mh)} · ${N(U.mf24)} · ${N(U.mf5u)}</b></div>
        <div class="rowl"><span>Commercial roofs (estimate)</span><b>${N(tot('cru'))}</b></div>
        <div class="rowl"><span>Owner occupied homes</span><b>${N(sum(zs.map(r => (r.hh || 0) * (r.own_sh || 0) / 100)))}</b></div>
        <p class="mini" style="margin-top:10px">The roof age chart below and the vintage, building type, permit and commercial cards follow the area chosen.</p>`;
    }
    function drawScope() {
      const zs = st.sel ? [ZI[st.sel]] : scopeZ(); const nm = st.sel ? 'ZIP ' + st.sel : scopeN();
      const a = st.sel ? (DATA.agez[st.sel] || []) : (st.par || st.reg ? ageHist(zs.map(z => z.zip)) : AH);
      const zl = zs.map(z => z.zip); const at = st.sel ? ((DATA.agez_t || {})[st.sel] || null) : (st.par || st.reg ? ageHist(zl, 'agez_t') : AHT);
      ageChart($('#k7Age', root), a, 230, at);
      const tA = sum(a) || 1; const peaks = a.map((v, i) => ({ i, v })).filter(o => o.i > 0 && o.i < 40 && o.v > 1.5 * ((a[o.i - 1] + a[o.i + 1]) / 2)).sort((x, y) => y.v - x.v).slice(0, 4).sort((x, y) => x.i - y.i);
      const yNow = 2026; const tT = at ? sum(at) : 0;
      $('#k7AgeNote', root).innerHTML = `${esc(nm)}: median roof age <b>${medOf(a)} years</b>; <b>${P(sum(a.slice(20)) / tA * 100, 0)}</b> of roofs are 20 or older, <b>${P(sum(a.slice(25)) / tA * 100, 0)}</b> are 25 or older and <b>${P(sum(a.slice(15, 20)) / tA * 100, 0)}</b> are 15 to 19.${tT > 0 ? ` Tile is <b>${P(tT / tA * 100, 0)}</b> of these roofs, and <b>${P(sum(at.slice(25)) / tT * 100, 0)}</b> of the tile has underlayment 25 years or older.` : ''} ${peaks.length ? 'Spikes at ' + listAnd(peaks.map(o => `${o.i} years (${yNow - o.i})`)) + ' are years the model put many new roofs on at once: a decade of building entering together, its reroofs a roof life later, or a wildfire rebuild.' : 'The curve is smooth because nothing replaces California roofs all at once: no storm resets the stock.'} The last bar gathers every roof of 40 years or more. The model's ages are as of 2026. ${G('B')}`;
      const yb = ybOf(zs); const C = ramp('green');
      barChart($('#k7Yb', root), { cats: YB_L, series: [{ name: 'Housing units', color: C[5], values: yb }], H: 220, W: 560, L: 52, rot: true, fmt: v => K(v), highlight: i => i <= 4 ? C[6] : C[3], aria: 'Housing units by decade built' });
      const pre = sum(yb.slice(0, 5)) / Math.max(1, sum(yb)) * 100;
      $('#k7YbNote', root).innerHTML = `${esc(nm)}: ${P(pre, 0)} of homes were built before 1980 (darker bars) and the median home was built about ${medYb(yb) || '—'}. Pre 1980 homes often have spaced sheathing left from wood shakes, plank decking and more than one layer to strip; a reroof there usually needs new solid sheathing (one in five Los Angeles re-roof permits says so), which raises the ticket. ${G('A')}`;
      const U = unitsOf(zs); const cru = sum(zs.map(z => z.cru || 0));
      const ur = [{ l: 'One unit homes', v: U.u1, c: C[6] }, { l: 'Units in 2 to 4 unit buildings', v: U.mf24, c: C[4] }, { l: 'Units in 5+ unit buildings', v: U.mf5u, c: ramp('teal')[5] }, { l: 'Mobile homes', v: U.mh, c: ramp('lime')[5] }, { l: 'Commercial roofs (estimate)', v: cru, c: ramp('lime')[7] }];
      hbarChart($('#k7Units', root), ur.map(r => ({ l: r.l, v: r.v, t: K(r.v), color: r.c })), { W: 520, L: 190, R: 56, rowH: 26, aria: 'Housing units by building type and commercial roofs' });
      $('#k7UnitsNote', root).innerHTML = `${esc(nm)}: mobile homes are ${P(U.mh / Math.max(1, U.hu) * 100, 0)} of homes (the manufactured home line, module 12), and 5+ unit buildings hold ${P(U.mf5u / Math.max(1, U.hu) * 100, 0)} of units (the multifamily line). Commercial roofs are estimated from establishment counts weighted by how often each industry owns a separate building, scaled to about ${K(META.model.ANCH.cru)} statewide (grade D).`;
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
      $('#k7BpsNote', root).innerHTML = `${esc(scopeN())}: ${N(all[all.length - 1])} units permitted in ${yrs[yrs.length - 1]}, against a peak of ${N(Math.max(...all))} in ${pk}. January to September 2026: ${N(y26)} units, ${y25 ? S((y26 / y25 - 1) * 100, 0) + '% on the same months of 2025' : 'no 2025 comparison'}. These are new buildings only; reroofs do not appear in the Census survey. Every new roof in a fire zone must be a Class A assembly. ${G('A')}`;
    }
    function drawCom(zs, nm) {
      const T = k => sum(zs.map(z => z[k] || 0));
      const rows = [['Retail stores', 'retail'], ['Restaurants and bars', 'food'], ['Health care offices and facilities', 'health'], ['Offices (finance, professional, management)', 'office'], ['Religious congregations', 'church'], ['Manufacturing plants', 'mfg'], ['Schools and training', 'school'], ['Auto dealers', 'auto'], ['Hotels and lodging', 'lodging'], ['Apartment owners (lessors)', 'apts'], ['Commercial building owners (lessors)', 'nonres'], ['Warehouses', 'whse']].map(([l, k]) => ({ l, v: T(k) })).filter(r => r.v > 0);
      if (rows.length) hbarChart($('#k7Com', root), rows.map((r, i) => ({ l: r.l, v: r.v, t: N(r.v), color: ramp('lime')[i < 4 ? 6 : 5] })), { W: 520, L: 230, R: 56, rowH: 22, aria: 'Establishments by type' });
      else $('#k7Com', root).innerHTML = '<p class="mini">No establishments recorded in the area chosen.</p>';
      $('#k7ComNote', root).innerHTML = `${esc(nm)}: ${N(T('est'))} establishments in all and about ${N(T('cru'))} commercial roofs (estimate). Low slope membranes (modified bitumen, cap sheet, TPO, PVC, built up) dominate warehouses, plants, big box retail and schools; churches and smaller offices often carry steep slope shingle, tile or metal roofs. The atlas assumes a ${D(META.model.ANCH.comm_life, 0)} year membrane life and that about ${P(META.model.ANCH.coat * 100, 0)} of commercial roofs are restored, coated or put on maintenance a year (grade D). Warehouse counts are low because County Business Patterns files many distribution buildings under the owning company's industry.`;
    }
    function select(zz) { if (!ZI[zz]) return; st.sel = st.sel === zz ? null : zz; render(); }
    /* static cards (redrawn on a theme change so their colors follow) */
    function drawStatic() {
      const ages = [...Array(41).keys()];
      const lamT = WBT ? WBT.L / gammaFn(1 + 1 / WBT.k) : null; const SvT = t => Math.exp(-Math.pow(Math.max(0, t) / lamT, WBT.k)); const HzT = t => 1 - SvT(t + 1) / SvT(t);
      const lifeSer = [{ name: 'Shingle and other roofs still on the house (%)', color: ramp('green')[6], pts: ages.map(t => [t, Sv(t) * 100]), area: true }, { name: 'Replaced in the coming year (%)', color: ramp('green')[4], pts: ages.map(t => [t, Hz(t) * 100]), dash: '4 3' }].concat(WBT ? [{ name: 'Tile underlayment still in service (%)', color: ramp('teal')[5], pts: ages.map(t => [t, SvT(t) * 100]) }, { name: 'Tile relaid in the coming year (%)', color: ramp('teal')[3], pts: ages.map(t => [t, HzT(t) * 100]), dash: '4 3' }] : []);
      lineChart($('#k7Life', root), { W: 560, H: 240, L: 48, series: lifeSer, x: { min: 0, max: 40, ticks: [0, 5, 10, 15, 20, 25, 30, 35, 40], fmt: v => v + ' yrs' }, y: { min: 0, max: 100, fmt: v => v + '%' }, tipTitle: x => 'Roof age ' + x + ' years', aria: 'Roof survival and annual replacement chance by age' });
      $('#k7LifeLeg', root).innerHTML = legendRow(lifeSer.map(s => ({ name: s.name, color: s.color, dash: !!s.dash })));
      $('#k7LifeNote', root).innerHTML = `Mean life ${WB.L} years, Weibull shape ${WB.k} (scale ${D(lam, 1)} years). Half of roofs are replaced by about ${D(lam * Math.pow(Math.log(2), 1 / WB.k), 0)} years; at 15 years the chance of replacement in the coming year is ${P(Hz(15) * 100, 1)}, at 20 it is ${P(Hz(20) * 100, 1)} and at 25 it is ${P(Hz(25) * 100, 1)}. The life is fitted to what owners in the West report, net of the few jobs insurance paid for; it is long because California roofs are not torn off by storms and many outlive their rated life before an owner, a buyer or an insurer forces the job.${WBT ? ` Tile underlayment: mean life ${WBT.L} years, shape ${WBT.k}; half are relaid by about ${D(lamT * Math.pow(Math.log(2), 1 / WBT.k), 0)} years. That life is a planning figure (one consultant gives about 25 years for standard underlayment, a trade source 20 to 30), not a fit to any survey.` : ''} ${G('B')}`;
      const V = AHS.vint; const vk = Object.keys(V);
      $('#k7Ahs', root).innerHTML = `<div class="xscroll"><table><thead><tr><th class="l">Homes built</th><th>AHS 2023 (owners)</th><th>Model</th><th>Gap</th></tr></thead><tbody>${vk.map(k => `<tr><td class="l">${esc(k.replace(/(\d{4})\D+(\d{4})/, '$1 to $2'))}</td><td>${P(V[k][1], 2)}</td><td>${P(V[k][0], 2)}</td><td>${S(V[k][0] - V[k][1], 2)}</td></tr>`).join('')}</tbody></table></div>`;
      const rmse = Math.sqrt(mean(vk.map(k => Math.pow(V[k][0] - V[k][1], 2))));
      $('#k7AhsNote', root).innerHTML = `Share of homes replacing the roof in a year, owner occupied one unit homes in the West region. The model's root mean square error is ${D(rmse, 2)} points across the ${numWord(vk.length)} bands. Homes built since 2010 replace roofs rarely (about 1 percent a year), older homes at 3 to 5 percent: that step is the age engine behind the replacement and tile lines. The survey does not say what covers the roof, so tile relays and shingle reroofs are fitted together here and split by the model.${isN(WB.rho) ? ` The fit sets aside ${P(WB.rho * 100, 1)} a year for jobs not driven by wear.` : ''} ${G('B')}`;
      $('#k7Mat', root).innerHTML = proseTable([
        ['<b>Composition (asphalt) shingles</b>', `${P(MS.shingle, 1)} of single family roofs`, 'The default reroof outside the tile tracts. Makers claim 25 to 30 years; no California field study of shingle life was found, inland heat and sun shorten it, and the model\'s fitted life is the working figure. In the covered climate zones a steep slope reroof of more than half the roof needs an aged solar reflectance of 0.20 or better (Title 24, Part 6), and in fire zones a Class A assembly.', 'B'],
        ['<b>Clay and concrete tile</b>', `${P(MS.tile, 1)} (clay ${P(MS.clay, 1)}, concrete ${P(MS.conc, 1)})`, 'On 62 percent of homes built since 2000 and 43 percent of those from 1980 to 1999. The tile can outlast the house; the underlayment does not: about 25 years by one consultant\'s planning figure, 20 to 30 by a trade source, no test found. The job is a lift and relay: lift the tile, new underlayment and flashings, relay the same tile (the residential code allows sound tile to be reinstalled, R908.5), with about three in ten tiles broken in handling by the same consultant\'s figure. In fire zones tile on a wood deck needs a cap sheet or Class A underlayment and bird stops.', 'C'],
        ['<b>Wood shakes and shingles</b>', `${P(MS.wood, 1)}, about 466,000 homes`, 'Highest on homes from before 1960. New wood roofs are restricted statewide (Health and Safety Code 13132.7) and banned in Los Angeles and San Diego, so every shake roof is a replacement with another covering, and a covering laid over shakes needs a fire barrier layer first (R908.4). Spaced sheathing under old shakes means new solid decking in the price.', 'B'],
        ['<b>Metal, standing seam and stone coated</b>', `${P(MS.metal, 1)} of today\'s roofs`, 'Small in the stock, larger in reroofs where fire or snow decides: the foothills, the Sierra and the far north. Near salt water, panel and fastener warranties narrow with distance from the surf; no California specific life study was found. Steel prices move the quote (chart below).', 'C'],
        ['<b>Low slope membranes (modified bitumen, cap sheet, single ply, built up)</b>', 'The flat roof cities and every commercial roof', 'San Francisco is a low slope city: of the re-roof permits there that name a material, three in four are modified bitumen, torch down or cap sheet, one in six shingles, one in twenty single ply. A low slope reroof in the covered zones needs an aged reflectance of 0.63 (Title 24, Part 6) and usually added insulation. The survey behind the shares above has no category for these roofs.', 'B'],
        ['<b>Coatings (silicone, acrylic, urethane)</b>', 'No life figure found', 'Restore a sound membrane or metal roof and meet the cool roof rule without a tear off. The energy code credits a field applied coating with 65 percent of its initial reflectance gain after three years, against 70 percent for factory products. The coatings line (module 12).', 'C'],
        ['<b>Roof overs for manufactured homes</b>', `${P(AHS.w_mh_rate, 1)} of owners a year have roof work`, `Metal or membrane roof overs and coatings. In the West ${P(AHS.w_mh_diy, 0)} of mobile home roof jobs are done by the owner, and the median hired job is ${M$(AHS.w_mh_med)} (American Housing Survey, a thin sample of about 20 jobs).`, 'C'],
        ['<b>Solar on the roof</b>', 'A job beside the roof', 'A reroof under panels starts with taking the array off and ends with putting it back, by a contractor licensed for it. The detach and reset line (module 12) counts these; price it into the estimate before the owner hears it from someone else.', 'C'],
      ].map(r => [r[0], `<span class="mini">${r[1]}</span>`, r[2], G(r[3])]), ['Covering', 'Share or life', 'California notes', '']);
      const rb = s => { const b = ppiAt(s, '2020-01'); return s.map(([ym, v]) => { const [y, m] = ym.split('-'); return [+y + (+m - 1) / 12, v / b * 100]; }); };
      lineChart($('#k7Ppi', root), { W: 560, H: 240, L: 44, series: [{ name: 'Asphalt felts and coatings (shingles, underlayment)', color: ramp('green')[6], pts: rb(PPI.asph) }, { name: 'Steel mill products (metal panels, flashing)', color: ramp('teal')[5], pts: rb(PPI.steel) }], x: { min: 2019, max: 2026.7, ticks: [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026], fmt: v => String(Math.floor(v)) }, y: { fmt: v => N(v) }, hlines: [{ y: 100, label: 'January 2020' }], tipTitle: x => { const y = Math.floor(x + 1e-6), m = Math.round((x - y) * 12); return MONL[m] + ' ' + y; }, aria: 'Producer price indexes for asphalt roofing and steel' });
      $('#k7PpiLeg', root).innerHTML = legendRow([{ name: 'Asphalt felts and coatings (BLS WPU1361)', color: ramp('green')[6] }, { name: 'Steel mill products (BLS WPU1017)', color: ramp('teal')[5] }]);
      $('#k7PpiNote', root).innerHTML = `${ymTxt(asL[0])}: asphalt roofing materials stood ${S(since20(PPI.asph), 1)}% above January 2020 and ${S(yoy(PPI.asph), 1)}% above a year earlier; steel mill products ${S(since20(PPI.steel), 1)}% and ${S(yoy(PPI.steel), 1)}%. A price book from 2021 is under cost today. Producer prices lead distributor prices by a few months, so quotes need short validity periods; after an emergency declaration a contractor may not raise repair prices more than 10 percent for 180 days, except for documented cost increases (Penal Code 396). ${G('A')}`;
      const mrow = (n, a) => a && isN(a.med) ? `<tr><td class="l"><b>${esc(n)}</b></td><td>${P(a.rate, 2)}</td><td>${P(a.diy, 1)}</td><td>${M$(a.med)}</td><td>${M$(a.mean)}</td><td>${P(a.ins, 1)}</td></tr>` : '';
      $('#k7Spend', root).innerHTML = `<div class="xscroll"><table><thead><tr><th class="l">Owners of one unit homes</th><th>Roof job a year</th><th>By the owner</th><th>Median hired job</th><th>Mean</th><th>Paid by insurance</th></tr></thead><tbody>${mrow('Los Angeles metro', AM.la)}${mrow('San Francisco and Oakland', AM.sf)}${mrow('Riverside and San Bernardino', AM.riv)}${mrow('San Jose (2021)', AM.sj)}${mrow('Pacific division', { rate: AHS.pac_rate, diy: AHS.pac_diy, med: AHS.pac_med, mean: AHS.pac_mean, ins: AHS.pac_ins })}${mrow('United States', AHS.us)}</tbody></table></div>
        <div class="rowl" style="margin-top:8px"><span>Homes with a roof leak in the past year, Pacific division</span><b>${P(AHS.pac_leak, 2)}</b></div>
        <div class="rowl"><span>San Francisco: declared cost of a one or two family re-roof (permits, 2023 to 2025)</span><b>$15,000 median</b></div>
        <div class="rowl"><span>Typical house roof: Los Angeles · San Francisco (permits that state a size)</span><b>22 squares · 13 to 15 squares</b></div>
        <p class="chartnote">A California roof job costs about 40 percent more than the national median and insurance pays for a few percent of them, so price, financing and trust carry the sale. San Francisco's figure is what applicants declared for permit fees, mostly on low slope roofs, and likely runs low; Los Angeles permits carry a nominal $200 a square that is not a price and is not shown. No audited price series for California roofing was found. The atlas's default replacement ticket of ${M$(META.model.VAL.replace)} and tile relay ticket of ${M$(META.model.VAL.tile)} are planning figures you can change in module 12. ${G('A')}</p>`;
      $('#k7Fort', root).innerHTML = judgList([
        ['Class A, as an assembly', 'In a Fire Hazard Severity Zone a new roof, and the whole roof when half or more is replaced within a year, must be a Class A assembly: the covering with the underlayment and deck it was tested on, not the shingle alone. Outside the zones the statewide floor is Class C.'],
        ['The roof is not the only way in', 'In the January 2025 Los Angeles fires about nine in ten structures in CAL FIRE\'s inspection data already had Class A coverings. Embers entered through vents, gaps at the eave and under tile, and from debris in gutters. Ember and flame resistant vents, bird stops, metal drip edge and clean metal gutters are part of the roofing job.'],
        ['What older fires showed', 'In the 1990 Painted Cave fire 70 percent of homes with non-flammable roofs survived against 19 percent with flammable ones. In the 2018 Camp Fire 38.5 percent of homes built in 1997 or later survived against 11.5 percent of older ones.'],
        ['Tile and wood', 'Tile on a wood deck needs a 72 pound cap sheet or a Class A rated underlayment beneath it, with the ends of the tile closed. Wood shakes cannot go back on in most fire zones; each one is a replacement.'],
        ['The insurance side', `"Safer from Wildfires" (the Department of Insurance's regulation) requires insurers to recognize hardening in their rates, each with its own discount. The FAIR Plan takes up to ${D(HD.fair_disc, 1)} percent off the wildfire part of a dwelling premium for all twelve measures. Never state a discount size for an owner: it is the insurer's to give.`],
        ['Grants', `The California Safe Homes program (in force January 1, 2026, run by the Department of Insurance) is meant to help low and middle income owners pay for fire safe roofs and the five foot zone. ${MM(HD.safe_homes26)} had been secured and grant amounts were not set when this was compiled. The atlas sizes the hardening line from insurance pressure, not from grants (grade ${esc((META.model.GRADE || {}).harden || 'D')}).`],
      ]);
      const PC = DATA.permits_city || {};
      $('#k7Code', root).innerHTML = proseTable([
        ['<b>Permit</b>', `There is no statewide rule: whether a re-roof needs a permit depends on the city or county. ${Object.keys(PC).length ? 'Cities that publish theirs: ' + Object.keys(PC).map(c => { const y = PC[c].years || {}; const ks = Object.keys(y).map(Number).filter(v => v <= 2025).sort((a, b) => a - b); const l = ks[ks.length - 1]; return `${esc(c)} ${N(y[l])} re-roof permits in ${l}`; }).join('; ') + '.' : ''} Ask the building department before quoting.`, 'A'],
        ['<b>License</b>', 'A contractor\'s license is needed for any job of $1,000 or more in total, and for a smaller one that needs a permit or uses an employee. Roofing is the C-39 classification; the license number goes in every contract, bid and advertisement; a C-39 holder must carry workers\' compensation even with no employees.', 'A'],
        ['<b>Tear off or recover</b>', 'A roof replacement removes every layer down to the deck. A recover is not allowed over a wet or deteriorated roof, over slate, clay, cement or asbestos cement tile, or over two existing layers (California Residential Code R908.3). The 2025 code lets sound self adhered underlayment stay in place.', 'B'],
        ['<b>Cool roof</b>', 'Title 24, Part 6: when more than half of a house roof is replaced in the covered climate zones, a steep slope covering needs an aged solar reflectance of at least 0.20 and a low slope roof 0.63. Roofs weighing at least 25 pounds per square foot are exempt, and Los Angeles permits for a tile relay state that cool roof compliance is not required.', 'B'],
        ['<b>Fire class</b>', 'Class A in Fire Hazard Severity Zones for new roofs and for the whole roof when half or more is replaced in a year; Class C at least everywhere else.', 'B'],
        ['<b>The code freeze</b>', 'Assembly Bill 130 stops new state and local building standards for homes from October 1, 2025 to June 1, 2031, with exceptions for emergencies and for home hardening. The residential roofing rules here are likely to stand until mid 2031; wildfire rules can still change.', 'B'],
        ['<b>On the roof</b>', 'Cal/OSHA requires fall protection for residential roofing from 6 feet since July 1, 2025 (it was 15), and its heat rules apply on every summer job.', 'B'],
      ].map(r => [r[0], r[1], G(r[2])]));
    }
    drawStatic();
    $('#k7Play', root).innerHTML = proseTable([
      ['<b>Work the wave</b>', `Roofs aged 15 to 19 (${K(META.wave)} statewide) are next decade's replacement market. Sort the table above by roofs aged 15 to 19, send the ZIPs to the Desk, and lead with inspections and financing before the roof fails.`, 'B'],
      ['<b>Tile relays</b>', `${K(tile25Tot)} tile roofs are modeled with underlayment 25 years or older. Map the tile layers, walk the tracts, and sell the relay as what it is: new underlayment and flashings under the owner's own tile. The share is a model: confirm on the street before buying media.`, 'D'],
      ['<b>Roof age and insurance</b>', 'Insurers inspect roofs at renewal and non-renew on age and condition. A page explaining what an inspection looks for, and a fast written report when an owner gets a notice, catches the owner at the moment the decision is forced. Describe the process; do not interpret anyone\'s policy or negotiate a claim.', 'B'],
      ['<b>Fire zones</b>', 'Where the fire zone layer is dark, every reroof is a Class A job and vents, eaves and gutters belong in the estimate. Name the assembly, not just the shingle.', 'B'],
      ['<b>Pre 1980 neighborhoods</b>', `${P(pre80, 0)} of California homes were built before 1980. Expect spaced sheathing, layers to strip and deck repair; price it, show it in photos, and say so before the tear off.`, 'B'],
      ['<b>Cool roofs and coatings</b>', 'The reflectance rule turns every low slope reroof in the covered zones into a cool roof, and a coating can meet it on a sound roof. Lead commercial and multifamily copy with the rule and the energy bill.', 'C'],
      ['<b>Manufactured homes</b>', `${K(META.mh)} mobile homes, nearly half of their roof work done by owners, and a median hired job of ${M$(AHS.w_mh_med)}. Roof overs, coatings and leak repair are the offer.`, 'C'],
    ].map(r => [r[0], r[1], G(r[2])]));
    $('#k7Cav', root).innerHTML = proseTable([
      ['Ages are modeled', 'Roof ages come from the decade each home was built and two fitted service lives. A tract reroofed early (a hailstorm, a lender\'s requirement, a solar boom) will be younger than shown; one that kept its original tile underlayment will be older.'],
      ['Tile age means underlayment age', 'For a tile roof the atlas counts the age of the underlayment. The 40 years and over bar is heavy with tile because the model lets underlayment live long; the life itself rests on a consultant\'s figure, not a study.'],
      ['Covering is a model', 'Tile, wood and metal shares come from a federal survey\'s California sample by era built and a climate factor by region, not from a count of roofs (grade D).'],
      ['One roof per home', 'Each one unit home is one roof; attached townhomes are counted as separate roofs though they share one. Units in 2 to 4 unit buildings are counted separately.'],
      ['Fire resets start in 2013', 'Only structures in CAL FIRE\'s damage inspections re enter the stock as new roofs. Roofs replaced after older fires, and after the 1994 earthquake, are not reset.'],
      ['Commercial roofs are estimated', 'Establishments are not buildings: one plant may hold several roofs, one strip mall many businesses. The total is anchored to the national commercial building survey scaled to California by residents (grade D).'],
      ['Metro survey', 'The American Housing Survey reports for three California metros in 2023 and San Jose in 2021, on 60 to 71 roofing jobs each. San Diego and Sacramento are not sampled.'],
      ['Producer prices', 'The price indexes track manufacturers\' selling prices nationally, not distributor or installed prices in California, and include products beyond roofing.'],
    ]);
    $('#k7Src', root).innerHTML = `<p class="body">Each ZIP's one unit homes by decade built (ACS) are split into tile roofs and every other covering by the survey shares for the era, and both enter a cohort model run year by year from 1905 to 2026. Roofs other than tile fail with a Weibull hazard (mean ${WB.L} years, shape ${WB.k}); tile roofs fail at the underlayment${WBT ? ` (mean ${WBT.L} years, shape ${WBT.k})` : ''} and the same tile goes back. New homes enter at age zero, and structures destroyed by wildfire re enter as new roofs over the four years after the fire. The life of the non tile roof was fitted so the model reproduces the American Housing Survey's West region replacement rates by year built. Roofs 20 and older, roofs 15 to 19 and the coming year's replacements and tile relays come straight from the 2026 age distributions.</p>` + srcRows([
      ['Homes by year built and type', 'Census ACS 2020 to 2024 five year estimates, tables B25034, B25127 and B25024, by ZCTA', 'A', '2024 release', 'https://www.census.gov/programs-surveys/acs'],
      ['Roof projects and leaks', 'American Housing Survey 2023 national public use file and 2021 metropolitan file (roof replacement, leaks, cost and payer)', 'A', '2023', 'https://www.census.gov/programs-surveys/ahs.html'],
      ['Roof covering by era', 'Residential Energy Consumption Survey 2020, California sample (837 single family homes)', 'B', '2020', 'https://www.eia.gov/consumption/residential/data/2020/'],
      ['Wildfire losses', 'CAL FIRE damage inspections, 2013 on', 'A', '2026', 'https://www.fire.ca.gov/'],
      ['Material prices', 'BLS Producer Price Index, asphalt felts and coatings (WPU1361) and steel mill products (WPU1017), via FRED', 'A', 'through ' + ymTxt(asL[0]), 'https://fred.stlouisfed.org/series/WPU1361'],
      ['New homes', 'Census Building Permits Survey, county annual files 2005 to 2025 and 2026 year to date', 'A', '2026', 'https://www.census.gov/construction/bps/'],
      ['Re-roof permits', 'City of Los Angeles and City and County of San Francisco open data', 'B', 'November 2026', 'https://data.lacity.org/'],
      ['Commercial stock', 'Census County Business Patterns 2023, ZIP code detail; CBECS 2018 for the statewide anchor', 'A/D', '2023', 'https://www.census.gov/programs-surveys/cbp.html'],
      ['Code', 'California Residential Code R908 and R337, Building Code Chapter 7A (the 2025 edition gathers the wildfire rules in Part 7 of Title 24), Title 24 Part 6', 'B', '2025 edition', ''],
    ]);
    $('#k7Foot', root).innerHTML = `<b style="color:var(--ink)">${ATLAS.name}</b>, module 17. Housing from the Census Bureau, roof projects from the American Housing Survey, roof covering from the Residential Energy Consumption Survey, prices from the Bureau of Labor Statistics. Roof ages and coverings are modeled. Compiled ${COMPILED}.`;
    $('#k7Layer', root).onchange = e => { st.layer = e.target.value; render(); };
    $('#k7Reg', root).onchange = e => { st.reg = e.target.value; st.par = ''; $('#k7Par', root).value = ''; st.sel = null; if (st.reg) map.fitCounties(PA.filter(p => p.reg === +st.reg).map(p => p.fips)); else map.reset(); render(); };
    $('#k7Par', root).onchange = e => { st.par = e.target.value; st.reg = ''; $('#k7Reg', root).value = ''; st.sel = null; if (st.par) map.fitCounties([st.par]); else map.reset(); render(); };
    $('#k7Csv', root).onclick = () => { const rows = ZR.filter(inScope); saveFile(`${ATLAS.file}-roof-stock-by-zip.csv`, toCSV(['zip', 'city', 'county', 'one_unit_roofs', 'roofs_20_plus', 'share_20_plus', 'roofs_25_plus', 'roofs_15_plus', 'roofs_15_to_19', 'due_next_12_months', 'tile_relays_due_next_12_months', 'median_roof_age', 'median_year_built', 'built_before_1980_pct', 'tile_share_model', 'tile_roofs_model', 'tile_underlayment_25_plus', 'wood_share_model', 'metal_share_of_reroofs_assumed', 'mobile_homes', 'units_2_to_4', 'units_5_plus', 'commercial_roofs_est', 'last_wildfire_loss_year'], rows.map(z => [z.zip, z.city, z.cty, z.roofs, z.ra20, z.ra20_sh, z.ra25, z.ra15, z.wave, z.nxt, z.nxt_t, z.ra_med, z.yb_med, z.pre80_sh, z.tile_sh, z.tile_n, z.tile25, z.wood_sh, z.metal_sh, z.mh, z.mf24, z.mf5u, z.cru, z.lastfire || '']), `${ATLAS.name}, module 17. Roof ages are modeled (cohort model, mean life ${WB.L} years; tile by underlayment age); coverings are modeled from a survey; housing from ACS 2020 to 2024. ${scopeN()}.`)); };
    $('#k7Desk', root).onclick = () => goModule('desk', { zips: ZR.filter(inScope).sort((a, b) => (b.wave || 0) - (a.wave || 0)).slice(0, 25).map(z => z.zip), line: 'replace' });
    $('#k7Lines', root).onclick = () => goModule('lines', st.sel ? { zip: st.sel, line: 'replace' } : { line: 'replace' });
    BUS.on('theme', () => { render(); drawStatic(); });
    this.receive = p => { if (!p) return; if (p.zip && ZI[p.zip]) { st.sel = p.zip; map.fitTo([p.zip]); } if (p.layer && LAYERS[p.layer]) { st.layer = p.layer; $('#k7Layer', root).value = p.layer; } render(); };
    render();
  }
});
