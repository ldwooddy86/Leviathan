/* ==== 18_m06_ground.js ==== */
/* ==== m06 Ground Truth ==== */
"use strict";
/* parish measures as observed by public agencies; rates use ACS 2020 to 2024 homes and residents and Census land area */
const sqmiP = p => Math.max(1, p.aland / 2.58999e6);
const FEMA_YR = {}; DATA.ts.fema_year.forEach(a => FEMA_YR[a[0]] = a[2]);
const femaSince = (p, y) => sum(Object.entries(p.fema || {}).filter(([dr]) => (FEMA_YR[dr] || 0) >= y).map(e => e[1]));
const PMET = {
  fema: { l: 'FEMA roof and wind registrations per 100 homes, 2004 to 2026', s: 'FEMA per 100 homes', f: p => p.fema_k / Math.max(1, p.hu) * 100, fmt: v => D(v, 1), g: 'A', note: `OpenFEMA Individuals and Households Program: registrations with roof damage (2004 to 2017 disasters) or verified wind loss (2020 on). Counts only people who applied for federal help; ${inTen(FEMA_INS.sh)} reported homeowners insurance, and most insured roof claims never reach FEMA.` },
  fema20: { l: 'FEMA wind loss registrations per 100 homes since 2020', s: 'FEMA since 2020 per 100', f: p => femaSince(p, 2020) / Math.max(1, p.hu) * 100, fmt: v => D(v, 1), g: 'A', note: 'Laura, Delta, Zeta, the 2021 winter and May storms, Ida, Francine and Arthur.' },
  h1: { l: 'Hail reports of 1 inch or larger per 100 square miles, 2016 to 2026', s: 'Hail 1 in per 100 sq mi', f: p => (p.ev.h1 || 0) / sqmiP(p) * 100, fmt: v => D(v, 2), g: 'A', note: 'NOAA Storm Events reports placed by coordinates. Reports follow people as well as hail.' },
  h175: { l: 'Hail reports of 1.75 inch or larger per 100 square miles, 2016 to 2026', s: 'Hail 1.75 in per 100 sq mi', f: p => (p.ev.h175 || 0) / sqmiP(p) * 100, fmt: v => D(v, 2), g: 'A', note: 'Golf ball hail, the size that damages most asphalt shingles.' },
  w58: { l: 'Damaging wind reports per 100 square miles, 2016 to 2026', s: 'Wind 58 mph per 100 sq mi', f: p => (p.ev.w58 || 0) / sqmiP(p) * 100, fmt: v => D(v, 1), g: 'A', note: 'Thunderstorm wind reports of 58 mph or more.' },
  torn: { l: 'Tornadoes per 1,000 square miles, 2016 to 2026', s: 'Tornadoes per 1,000 sq mi', f: p => (p.ev.t || 0) / sqmiP(p) * 1000, fmt: v => D(v, 1), g: 'A', note: 'Tornado touchdown points.' },
  dmg: { l: 'Storm damage NOAA estimated per home, 2016 to 2026 ($)', s: 'NOAA damage per home', f: p => (p.ev.dmg || 0) * 1000 / Math.max(1, p.hu), fmt: v => M$(v), g: 'B', note: 'Property damage estimates attached to located hail, wind and tornado reports; rough, and missing for many reports.' },
  trop: { l: 'Hurricane and tropical storm zone records since 2000', s: 'Tropical zone records', f: p => ((p.trop || {}).hurr || 0) + ((p.trop || {}).ts || 0), fmt: v => N(v), g: 'A', note: 'NOAA Storm Events records of hurricane or tropical storm conditions by forecast zone, matched to parishes. A parish split into several zones can count one storm more than once.' },
  surge: { l: 'Storm surge records since 2000', s: 'Surge records', f: p => (p.trop || {}).surge || 0, fmt: v => N(v), g: 'A', note: 'NOAA Storm Events storm surge and tide records by forecast zone.' },
  permits: { l: 'New homes permitted per 1,000 homes a year, 2021 to 2025', s: 'Permits per 1,000 homes', f: p => mean([2021, 2022, 2023, 2024, 2025].map(y => ((p.bps || {})[y] || [0, 0])[1])) / Math.max(1, p.hu) * 1000, fmt: v => D(v, 1), g: 'A', note: 'Census Building Permits Survey, housing units authorized, all building sizes.' },
  ytd: { l: 'Change in homes permitted, January to August 2026 against 2025 (%)', s: 'Permits 2026 vs 2025', f: p => p.ytd25 ? (p.ytd26 / p.ytd25 - 1) * 100 : null, fmt: v => isN(v) ? S(v, 0) + '%' : '—', g: 'A', div: true, note: 'Census Building Permits Survey year to date files. Small parishes swing widely.' },
  old: { l: 'Homes built before 1980 (%)', s: 'Built before 1980', f: p => sum((p.yb || []).slice(5)) / Math.max(1, sum(p.yb || [])) * 100, fmt: v => P(v, 0), g: 'A', note: 'ACS 2020 to 2024, year structure built.' },
  mh: { l: 'Mobile homes (% of homes)', s: 'Mobile homes %', f: p => (p.mh || 0) / Math.max(1, p.hu) * 100, fmt: v => P(v, 0), g: 'A', note: 'ACS 2020 to 2024, units in structure.' },
  roofers: { l: 'Roofing contractors per 10,000 residents (ZIP Business Patterns 2023)', s: 'Roofers per 10k', f: p => (p.roofers || 0) / p.pop * 1e4, fmt: v => D(v, 2), g: 'B', note: 'ZIP level counts summed to the parish. They run below the county file (152 against 267 statewide) because many ZIP records lack a detailed industry code.' },
  lic: { l: 'Roofing license records per 10,000 residents (LSLBC)', s: 'Licenses per 10k', f: p => (p.lic || 0) / p.pop * 1e4, fmt: v => D(v, 2), g: 'B', note: 'LSLBC roofing license records by the license holder\'s city, from a public mirror of the board\'s records.' },
  fees: { l: 'Gross profit pool per home, all eleven lines ($ a year)', s: 'Profit pool per home', f: p => p.fees / Math.max(1, p.hu), fmt: v => M$(v), g: 'D', note: 'Service line model at default assumptions (module 12).' },
};
/* ============================ Module 6: Ground Truth ============================ */
registerModule({
  key: 'ground', num: '06', title: 'Ground Truth', desc: 'The 64 parishes as observed: FEMA roof registrations, hail, wind and tornado reports, hurricane records, permits, housing and roofers',
  mount(root) {
    const st = { m: 'fema', sel: null };
    const T = k => sum(PA.map(p => k(p)));
    const femaAll = T(p => p.fema_k), fema20 = T(p => femaSince(p, 2020)); const huAll = T(p => p.hu || 0);
    const dmgAll = sum(PTS.map(p => p.dmg)) * 1000;
    const permY = DATA.ts.permits; const pYears = Object.keys(permY).map(Number).sort((a, b) => a - b); const lastY = pYears[pYears.length - 1];
    const lic = META.lic;
    root.innerHTML = mastHTML({ eyebrow: 'Module 06 · Ground Truth · 64 parishes as observed', title: 'Ground Truth',
      dek: 'Before any model, the record. FEMA counted every owner who registered roof or wind damage after a declared disaster; NOAA logged every hail stone, damaging gust, tornado, hurricane and surge its observers reported; the Census Bureau counted every home, its age and type, every building permit and every roofing contractor. This module lays those records side by side for the 64 parishes, so every modeled number elsewhere in the atlas can be checked against what was actually counted.',
      meta: [`<b>FEMA</b> ${N(femaAll)} roof and wind registrations, 18 disasters`, `<b>NOAA</b> ${N(PTS.length)} located storm reports and zone records since 2000`, '<b>Census</b> ACS 2020 to 2024, permits 2005 to 2026, Business Patterns 2023', '<b>Grade</b> A for counts, B where noted'],
      bar: 'Ground Truth', barsub: 'Observed parish records',
      actions: [{ id: 'g6Csv', label: '↓ Parishes CSV' }, { id: 'g6CiCsv', label: '↓ Cities CSV' }, { id: 'g6Paid', label: 'Paid ↗' }, { id: 'g6Cor', label: 'Storm Ledger ↗' }] }) +
      `<div class="wrap">
      ${callout('', 'Read this first: observed layers first, modeled layers second', 'Every measure on this tab except one was counted by a public agency: registrations by FEMA inspectors and caseworkers, storm reports by NOAA\'s observers and forecast offices, homes and permits by the Census Bureau, contractors by the Census Bureau and the LSLBC. Each has its own blind spot, listed below: FEMA sees only the damage people asked federal help for after declared disasters, storm reports follow people, and permits count new homes, not reroofs. The one modeled measure, the gross profit pool, is labeled grade D. Use these records to check every ZIP number in modules 01, 05 and 12.')}
      <div class="kpis" id="g6Kpis"></div>
      <div class="controls"><div class="ctl" style="flex:1 1 360px"><label class="fl" for="g6Met">Parish measure</label><select id="g6Met">${Object.entries(PMET).map(([k, m]) => `<option value="${k}">${esc(m.l)}</option>`).join('')}</select></div></div>
      <div class="grid2">
        <div class="card mapcard"><div id="g6Map"></div><div class="legend" id="g6Leg"></div></div>
        <div class="stack">
          <div class="card"><div class="card-h" style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start"><div><h3 id="g6Name">Louisiana</h3><p id="g6Sub">Click a parish for its record</p></div><span class="pill" id="g6Pill">State</span></div><div class="card-b" id="g6Detail"></div></div>
        </div>
      </div>
      ${card('Parishes', 'Every parish with its observed rates. Click a row to open the parish; click a header to sort.', '<div class="tscroll" id="g6Tbl"></div>', 'mt')}
      <div class="split">
        ${card('Hazard against the record', 'The atlas\'s hazard layers against what was observed, parish by parish: hurricane exposure against FEMA registrations, and the 30 year hail rate against recent hail reports.', '<div id="g6Sc1"></div><p class="chartnote" id="g6Sc1n"></p><div id="g6Sc2"></div><p class="chartnote" id="g6Sc2n"></p>')}
        ${card('Where storm damage concentrates', 'Parishes ranked by FEMA roof and wind registrations per 100 homes against the state rate, with the volume behind each.', '<div id="g6Out"></div>')}
      </div>
      ${card('Cities', 'USPS cities of 1,500 residents or more: roofs, the service line pools summed over their ZIPs, competition and language at home.', '<div class="tscroll short" id="g6Cities"></div>', 'mt')}
      <div class="split">
        ${card('How to read this module', 'What each record is and is not.', '<div id="g6Read"></div>')}
        ${card('Caveats and sources', 'Where the counts can mislead, and where they came from.', '<div id="g6Src"></div>')}
      </div>
      <div class="foot" id="g6Foot"></div></div>`;
    $('#g6Kpis', root).innerHTML = kpiHTML([
      { l: 'FEMA roof and wind registrations', g: 'A', v: K(femaAll), d: `2004 to 2026; ${K(fema20)} since 2020 · ${D(femaAll / huAll * 100, 1)} per 100 homes` },
      { l: 'Storm report damage, 2016 to 2026', g: 'B', v: MM(dmgAll), d: 'NOAA estimates for located hail, wind and tornado reports' },
      { l: 'Hurricane zone records since 2000', g: 'A', v: N(T(p => (p.trop || {}).hurr || 0)), d: `${N(T(p => (p.trop || {}).ts || 0))} tropical storm and ${N(T(p => (p.trop || {}).surge || 0))} surge records (NOAA)` },
      { l: `Homes permitted, ${lastY}`, g: 'A', v: N(permY[lastY][1]), d: `${N(DATA.ts.ytd26)} January to August 2026, ${S((DATA.ts.ytd26 / DATA.ts.ytd25 - 1) * 100, 0)}% on 2025` },
      { l: 'Roofing contractors', g: 'A', v: N(META.cbp.est), d: `${N(META.cbp.emp)} employees (CBP 2023); ${N(META.nes.est2381)} nonemployer exterior trades firms` },
      { l: 'Roofing license records', g: 'B', v: N(lic.n), d: `${N(lic.firms)} firms; ${P(lic.out / lic.n * 100, 0)} held out of state` },
    ]);
    const map = new ZipMap($('#g6Map', root), { segHit: 'none', roads: false, parishLabels: true, aria: 'Map of Louisiana parishes', onParish: f => { st.sel = st.sel === f ? null : f; render(); }, onParishHover: (f, e) => { const p = PAI[f]; const M = PMET[st.m]; showTip(parishTip(f, [[esc(M.s), M.fmt(M.f(p))], ['FEMA registrations since 2004', N(p.fema_k)], ['Hail 1 inch · wind 58 mph · tornadoes, 2016 to 2026', N(p.ev.h1) + ' · ' + N(p.ev.w58) + ' · ' + N(p.ev.t)], ['Homes built before 1980', P(PMET.old.f(p), 0)]]), e); } });
    function render() {
      const M = PMET[st.m]; const vals = PA.map(p => M.f(p));
      const sc = M.div ? divScale(vals, 0) : qScale(vals, 'green', 1);
      map.fillParish(f => sc.f(M.f(PAI[f]))); map.selectParish(st.sel);
      const v = vals.filter(isN);
      $('#g6Leg', root).innerHTML = legendHTML({ title: M.l, R: sc.R, lo: M.fmt(M.div ? sc.lo : Math.min(...v)), hi: M.fmt(M.div ? sc.hi : Math.max(...v)), note: `<b>${M.div ? 'Copper rose, blue fell' : 'Darker parishes rank higher'}.</b> ${M.div ? 'Diverging scale centered on zero.' : 'Eight quantile classes across the 64 parishes.'} ${G(M.g)}<br>${esc(M.note)}` });
      drawDetail(); drawTable();
    }
    function drawTable() {
      const cols = [{ k: 'name', h: 'Parish', l: 1, f: v => `<b>${esc(v)}</b>` }, { k: 'reg', h: 'Region', l: 1, v: r => REGN[r.reg] }, { k: 'hu', h: 'Homes', f: v => N(v) }]
        .concat(['fema', 'fema20', 'h1', 'w58', 'torn', 'trop', 'permits', 'old', 'mh', 'roofers', 'lic'].map(k => ({ k: 'm_' + k, h: PMET[k].s, v: r => PMET[k].f(r), f: v => PMET[k].fmt(v), t: PMET[k].l })));
      dataTable($('#g6Tbl', root), cols, PA, { sortKey: 'm_' + (cols.some(c => c.k === 'm_' + st.m) ? st.m : 'fema'), id: r => r.fips, onClick: f => { st.sel = f; render(); window.scrollTo({ top: $('#g6Map', root).getBoundingClientRect().top + scrollY - 120, behavior: 'smooth' }); }, rowClass: r => r.fips === st.sel ? 'sel' : '' });
    }
    const RY = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
    const femaByYear = (pf) => { const o = {}; DATA.ts.fema_year.forEach(a => { const n = pf ? ((pf.fema || {})[a[0]] || 0) : a[3]; o[a[2]] = (o[a[2]] || 0) + n; }); return o; };
    function drawDetail() {
      const p = st.sel ? PAI[st.sel] : null; const box = $('#g6Detail', root);
      const yearRows = pi => { const ps = PTS.filter(q => pi == null || q.pi === pi); const fy = femaByYear(pi == null ? null : PA[pi]); const bp = y => pi == null ? (y === 2026 ? DATA.ts.ytd26 : (permY[y] || [0, 0])[1]) : (y === 2026 ? PA[pi].ytd26 : ((PA[pi].bps || {})[y] || [0, 0])[1]);
        return [['Hail 1 inch or larger', y => ps.filter(q => q.y === y && ptHas(q, 'h1')).length], ['Wind 58 mph or more', y => ps.filter(q => q.y === y && ptHas(q, 'w58')).length], ['Tornadoes', y => ps.filter(q => q.y === y && q.k === 2).length], ['FEMA roof and wind registrations', y => fy[y] || 0], ['Homes permitted (2026 to August)', bp]]; };
      const yTable = (pi, title) => { const rows = yearRows(pi); const hd = ['Hail 1 in', 'Wind 58', 'Tornado', 'FEMA', 'Permits']; return `<div class="xscroll"><table class="keep compact"><thead><tr><th class="l">${esc(title)}</th>${hd.map((h, i) => `<th title="${esc(rows[i][0])}">${h}</th>`).join('')}</tr></thead><tbody>${RY.map(y => `<tr><td class="l">${y}${y === 2026 ? '*' : ''}</td>${rows.map(([, f]) => `<td>${N(f(y))}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p class="mini" style="margin-top:4px">FEMA counts sit in the year of the disaster. *2026 reports run through the latest month NOAA has posted; permits run through August.</p>`; };
      if (!p) {
        $('#g6Name', root).textContent = 'Louisiana'; $('#g6Sub', root).textContent = 'Click a parish for its record'; $('#g6Pill', root).textContent = 'State';
        const fy = femaByYear(null);
        box.innerHTML = yTable(null, 'Statewide') + `<p class="mini" style="margin-top:8px">Storm reports run through ${MONL[Math.max(1, ...PTS.filter(q => q.y === 2026).map(q => q.m)) - 1]} 2026. FEMA counts belong to the year of the disaster: ${N(fy[2020] || 0)} in 2020 (Laura, Delta, Zeta) and ${N(fy[2021] || 0)} in 2021 (Ida and the winter storms). Permits fell from ${N(permY[2021][1])} homes in 2021 to ${N(permY[lastY][1])} in ${lastY}, and January to August 2026 ran ${P(Math.abs((DATA.ts.ytd26 / DATA.ts.ytd25 - 1) * 100), 0)} ${DATA.ts.ytd26 < DATA.ts.ytd25 ? 'below' : 'above'} the same months of 2025.</p>`;
        return;
      }
      $('#g6Name', root).textContent = p.name + ' Parish'; $('#g6Sub', root).textContent = `${REGN[p.reg]} · ${N(p.hu)} homes · ${N(p.pop)} residents · ${N(p.nzip)} ZIPs`; $('#g6Pill', root).textContent = 'Parish';
      const fl = DATA.ts.fema_year.filter(a => (p.fema || {})[a[0]] > 0).sort((a, b) => b[2] - a[2]);
      const cs = CITIES.filter(x => x.pi === p.i).sort((a, b) => b.pop - a.pop).slice(0, 6);
      const svals = { fema: femaAll / huAll * 100, h1: T(x => x.ev.h1 || 0) / T(sqmiP) * 100, w58: T(x => x.ev.w58 || 0) / T(sqmiP) * 100, torn: T(x => x.ev.t || 0) / T(sqmiP) * 1000, permits: mean([2021, 2022, 2023, 2024, 2025].map(y => permY[y][1])) / huAll * 1000 };
      box.innerHTML = yTable(p.i, p.name) + `
        <div class="dsec">FEMA registrations by disaster</div>${fl.map(a => `<div class="rowl"><span>${esc(a[1])} (${a[2]}, DR ${esc(a[0])})</span><b>${N(p.fema[a[0]])} · ${D(p.fema[a[0]] / Math.max(1, p.hu) * 100, 1)} per 100 homes</b></div>`).join('') || '<p class="mini">No FEMA roof or wind registrations recorded for the parish.</p>'}
        <div class="dsec">NOAA records</div>
        <div class="rowl"><span>Zone records since 2000: hurricane · tropical storm · surge · high wind</span><b>${N(p.trop.hurr)} · ${N(p.trop.ts)} · ${N(p.trop.surge)} · ${N(p.trop.hw)}</b></div>
        <div class="rowl"><span>Located reports 2016 to 2026: hail 1.75 inch · wind 75 mph · EF1 or stronger</span><b>${N(p.ev.h175)} · ${N(p.ev.w75)} · ${N(p.ev.ef1)}</b></div>
        <div class="rowl"><span>Property damage NOAA estimated, 2016 to 2026</span><b>${MM((p.ev.dmg || 0) * 1000)}</b></div>
        <div class="dsec">Against the state</div>
        ${Object.entries(svals).map(([k, sv]) => { const M = PMET[k]; const v = M.f(p); return `<div class="rowl"><span>${esc(M.s)}</span><b>${M.fmt(v)} · ${D(v / sv, 2)}× state</b></div>`; }).join('')}
        <div class="dsec">Model, all eleven lines (default assumptions)</div>
        <div class="rowl"><span>One unit roofs · 20 years or older · aged 15 to 19</span><b>${N(p.roofs)} · ${N(p.ra20)} · ${N(p.wave)}</b></div>
        <div class="rowl"><span>Gross profit pool a year</span><b>${MM(p.fees)}</b></div>
        ${PL.map(l => `<div class="rowl"><span>${esc(l.name)}</span><b>${p['p_' + l.key] < 10 ? D(p['p_' + l.key], 1) : N(p['p_' + l.key])} jobs a year</b></div>`).join('')}
        <div class="dsec">Places and trades</div>
        <div class="rowl"><span>Largest cities</span><b>${cs.map(x => esc(x.name)).join(', ') || '—'}</b></div>
        <div class="rowl"><span>Roofing contractors: county file · ZIP file · license records</span><b>${p.cbp_roof != null ? N(p.cbp_roof) : 'not published'} · ${N(p.roofers)} · ${D(p.lic, 0)}</b></div>
        <div class="rowl"><span>Roofing supply wholesalers · insurance agencies · mapped competitor offices</span><b>${p.cbp_sup != null ? N(p.cbp_sup) : 'not published'} · ${N(p.ins_agents)} · ${N(p.comp)}</b></div>
        <div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap"><button class="ibtn" id="g6PIdx">Roof Demand Index ↗</button><button class="ibtn" id="g6PCor">Storm Ledger ↗</button><button class="ibtn" id="g6Clr">Clear</button></div>`;
      $('#g6PIdx', root).onclick = () => { goModule('index'); const sel = $('#i1Par'); if (sel) { sel.value = p.fips; sel.dispatchEvent(new Event('change')); } };
      $('#g6PCor', root).onclick = () => { goModule('storms'); const sel = $('#s2Par'); if (sel) { sel.value = p.fips; sel.dispatchEvent(new Event('change')); } };
      $('#g6Clr', root).onclick = () => { st.sel = null; render(); };
    }
    function drawStatic() {
      const pts1 = PA.map(p => ({ x: p.hur64, y: PMET.fema.f(p), r: 3 + Math.sqrt(p.hu / 1e4), c: ramp('green')[6], tip: `<div class="tt">${esc(p.name)}</div>${tipRow('Chance of hurricane force winds a year', P(p.hur64, 1))}${tipRow('FEMA registrations per 100 homes', D(PMET.fema.f(p), 1))}`, lab: PMET.fema.f(p) > 25 || p.hu > 150000 ? p.name : '' }));
      const r1 = scatter($('#g6Sc1', root), { pts: pts1, x: { label: 'Chance of hurricane force winds in a year (%, model from best tracks)', fmt: v => D(v, 0) }, y: { label: 'FEMA roof and wind registrations per 100 homes', fmt: v => D(v, 0) }, labels: 8, H: 300, aria: 'Hurricane exposure against FEMA registrations' });
      const resid = (xs, ys) => { const n = xs.length, mx = mean(xs), my = mean(ys); let sxy = 0, sxx = 0; xs.forEach((x, i) => { sxy += (x - mx) * (ys[i] - my); sxx += (x - mx) ** 2; }); const bb = sxy / (sxx || 1), aa = my - bb * mx; return ys.map((y, i) => y - (aa + bb * xs[i])); };
      const e1 = resid(PA.map(p => p.hur64), PA.map(p => PMET.fema.f(p))); const o1 = PA.map((p, i) => [p.name, e1[i]]).sort((a, b) => b[1] - a[1]);
      $('#g6Sc1n', root).innerHTML = `FEMA registrations rise with hurricane exposure (r = ${DS(r1.r, 2)}): the parishes that see hurricane force winds every few decades carry most of the record. Parishes furthest above the line (${esc(listAnd(o1.slice(0, 6).map(o => o[0])))}) took the brunt of a recent storm, Ida along the river and Laura in the southwest; parishes furthest below it (${esc(listAnd(o1.slice(-4).map(o => o[0])))}) carry similar long run exposure but registered far less, because recent storms passed them by or more of their owners were insured.`;
      const pts2 = PA.map(p => ({ x: p.hd1, y: PMET.h1.f(p), r: 3 + Math.sqrt(p.pop / 2e4), c: kindColor(0), tip: `<div class="tt">${esc(p.name)}</div>${tipRow('Hail days a year, 1 inch, 25 miles (SPC 1996 to 2025)', D(p.hd1, 2))}${tipRow('Hail reports per 100 sq mi, 2016 to 2026', D(PMET.h1.f(p), 2))}`, lab: PMET.h1.f(p) > 4 ? p.name : '' }));
      const r2 = scatter($('#g6Sc2', root), { pts: pts2, x: { label: 'Hail days a year, 1 inch or larger within 25 miles (1996 to 2025)', fmt: v => D(v, 1) }, y: { label: 'Hail reports per 100 square miles, 2016 to 2026', fmt: v => D(v, 1) }, labels: 6, H: 300, aria: 'Hail climatology against recent hail reports' });
      const e2 = resid(PA.map(p => p.hd1), PA.map(p => PMET.h1.f(p))); const o2 = PA.map((p, i) => [p.name, e2[i]]).sort((a, b) => b[1] - a[1]);
      $('#g6Sc2n', root).innerHTML = `Recent hail reports follow the 30 year rate (r = ${DS(r2.r, 2)}), so the hail layer is a fair guide to the next decade. Much of the scatter around the line is reporting: the parishes furthest above it (${esc(listAnd(o2.slice(0, 5).map(o => o[0])))}) are mostly urban, where more people see and report the same storms.`;
    }
    drawStatic();
    const sr = femaAll / huAll * 100; const out = PA.map(p => ({ p, v: PMET.fema.f(p), r: PMET.fema.f(p) / sr })).sort((a, b) => b.r - a.r);
    $('#g6Out', root).innerHTML = `<div class="xscroll"><table><thead><tr><th class="l">Parish</th><th>Per 100 homes</th><th>× state</th><th>Registrations</th><th>Since 2020</th></tr></thead><tbody>${out.slice(0, 12).map(o => `<tr><td class="l"><b>${esc(o.p.name)}</b></td><td>${D(o.v, 1)}</td><td>${D(o.r, 2)}×</td><td>${N(o.p.fema_k)}</td><td>${N(femaSince(o.p, 2020))}</td></tr>`).join('')}<tr><td class="l mini" colspan="5">Lowest</td></tr>${out.slice(-6).map(o => `<tr><td class="l">${esc(o.p.name)}</td><td>${D(o.v, 1)}</td><td>${D(o.r, 2)}×</td><td>${N(o.p.fema_k)}</td><td>${N(femaSince(o.p, 2020))}</td></tr>`).join('')}</tbody></table></div><p class="chartnote">The state rate is ${D(sr, 1)} FEMA roof and wind registrations per 100 homes over 2004 to 2026. The top of the list is the hurricane coast; the bottom is the north and northwest, where hail and tornado damage is real but rarely federally declared, so it reaches insurers and roofers without ever reaching FEMA. That is why this record understates the north and why module 02 adds the storm reports.</p>`;
    dataTable($('#g6Cities', root), [{ k: 'name', h: 'City', l: 1, f: v => `<b>${esc(v)}</b>` }, { k: 'par', h: 'Parish', l: 1, v: r => PA[r.pi] ? PA[r.pi].name : '' }, { k: 'pop', h: 'Residents', f: v => N(v) }, { k: 'roofs', h: 'Roofs', f: v => N(v) }, { k: 'ra20s', h: '20 yrs+', v: r => r.ra20 / Math.max(1, r.roofs) * 100, f: v => P(v, 0) }, { k: 'p_replace', h: 'Replace', f: v => N(v) }, { k: 'p_storm', h: 'Storm', f: v => N(v) }, { k: 'p_hail', h: 'Hail', f: v => N(v) }, { k: 'p_repair', h: 'Repair', f: v => N(v) }, { k: 'fees', h: 'Profit pool', f: v => MM(v) }, { k: 'comp', h: 'Mapped roofers', f: v => N(v) }, { k: 'lic', h: 'Licenses', f: v => D(v, 0) }, { k: 'spn', h: 'Spanish %', v: r => r.span / Math.max(1, r.pop) * 100, f: v => P(v, 1) }, { k: 'vtn', h: 'Vietnamese %', v: r => r.viet / Math.max(1, r.pop) * 100, f: v => P(v, 1) }], CITIES, { sortKey: 'fees' });
    $('#g6Read', root).innerHTML = proseTable([
      ['FEMA registrations', 'Owners and renters who applied for federal individual assistance after a declared disaster and showed roof damage (through 2017) or verified wind loss (2020 on). ' + `${cap1(inTen(FEMA_INS.sh))} registrants reported homeowners insurance; owners whose policy paid for the roof had little reason to apply, so the count leans to the uninsured and underinsured share of the damage.`],
      ['Storm reports', 'Hail, damaging wind and tornado reports placed by coordinates. They locate storms; their density also tracks population and roads.'],
      ['Zone records', 'Hurricane, tropical storm, surge and high wind records filed by NOAA forecast zone, matched to parishes. They show which parishes were under those conditions, not how bad it was.'],
      ['Permits', 'New housing units authorized by local permit offices, as reported to the Census Bureau. Reroofs are not in this survey; since August 2025 they need local permits, which parish offices hold.'],
      ['Contractors', 'County Business Patterns counts establishments with employees (published for 18 parishes for roofing); ZIP counts are less complete; license records count licenses by the holder\'s city, wherever the work is done.'],
      ['Gross profit pool', 'The only modeled measure on this tab (grade D), included so the record and the model sit side by side.'],
    ]);
    $('#g6Src', root).innerHTML = proseTable([
      ['Declared disasters only', 'Hail and most tornadoes never reach a federal declaration; FEMA undercounts the north.'],
      ['Small numbers', 'Tornadoes and large hail in a small parish swing year to year. Read ten year totals, not single years.'],
      ['Damage estimates', 'NOAA damage figures are estimates made at the time, often missing, and not insurance losses.'],
    ]) + srcRows([
      ['FEMA registrations', 'OpenFEMA Individuals and Households Program valid registrations, 18 Louisiana disasters 2004 to 2026', 'A', 'v2', 'https://www.fema.gov/openfema-data-page/individuals-and-households-program-valid-registrations-v2'],
      ['Storm reports and zone records', 'NOAA NCEI Storm Events Database, Louisiana, 2000 to 2026', 'A', '2026', 'https://www.ncdc.noaa.gov/stormevents/'],
      ['Homes', 'ACS 2020 to 2024 five year; Census 2024 Gazetteer for land area', 'A', '2026', 'https://www.census.gov/'],
      ['Permits', 'Census Building Permits Survey, county annual 2005 to 2025 and August 2026 year to date', 'A', '2026', 'https://www.census.gov/construction/bps/'],
      ['Contractors and suppliers', 'County and ZIP Business Patterns 2023 (NAICS 238160, 423330, 524210); Nonemployer Statistics 2024 (NAICS 2381)', 'A', '2023 and 2024', 'https://www.census.gov/programs-surveys/cbp.html'],
      ['License records', 'LSLBC roofing license records via a public mirror', 'B', 'October 2026', 'https://lslbc.gov/'],
    ]);
    $('#g6Foot', root).innerHTML = `<b style="color:var(--ink)">Uplift Louisiana Roofing Atlas</b>, module 06. Records as published by FEMA, NOAA, the Census Bureau and the LSLBC. Compiled ${esc(new Date(META.compiled + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }))}.`;
    $('#g6Met', root).onchange = e => { st.m = e.target.value; render(); };
    $('#g6Csv', root).onclick = () => { const ks = Object.keys(PMET); saveFile('louisiana-parish-records.csv', toCSV(['parish', 'fips', 'region', 'homes', 'residents'].concat(ks).concat(['fema_registrations', 'hail_1in_reports', 'wind_58mph_reports', 'tornadoes', 'cbp_roofing_establishments', 'license_records']), PA.map(p => [p.name, p.fips, REGN[p.reg], p.hu, p.pop].concat(ks.map(k => { const v = PMET[k].f(p); return isN(v) ? +D(v, 3) : ''; })).concat([p.fema_k, p.ev.h1, p.ev.w58, p.ev.t, p.cbp_roof != null ? p.cbp_roof : '', p.lic])), 'Uplift Louisiana Roofing Atlas, module 06. FEMA, NOAA, Census and LSLBC records by parish.')); };
    $('#g6CiCsv', root).onclick = () => saveFile('louisiana-cities.csv', toCSV(['city', 'parish', 'residents', 'zips', 'one_unit_roofs', 'roofs_20_plus', 'gross_profit_pool'].concat(LINE_KEYS.map(k => 'jobs_' + k)).concat(['mapped_roofers_within_8km', 'license_records', 'spanish_speakers', 'vietnamese_speakers']), CITIES.map(c => [c.name, PA[c.pi] ? PA[c.pi].name : '', c.pop, c.nzip, c.roofs, c.ra20, c.fees].concat(LINE_KEYS.map(k => c['p_' + k])).concat([c.comp, c.lic, c.span, c.viet])), 'Uplift Louisiana Roofing Atlas, module 06.'));
    $('#g6Paid', root).onclick = () => goModule('paid'); $('#g6Cor', root).onclick = () => goModule('storms');
    BUS.on('theme', () => { render(); drawStatic(); });
    this.receive = p => { if (p && p.fips && PAI[p.fips]) { st.sel = p.fips; render(); } };
    render();
  }
});
