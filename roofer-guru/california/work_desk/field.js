/* ==== 19_m07_field.js ==== */
/* ==== src/19_m07_field.js ==== */
/* ==== m07_field (California) ==== */
"use strict";
/* Reads: ZIP columns zip, city, pi, lat, lon, pop, roofs, fees, res_ok, lic, lic_all, roofers, comp_n25 (active C-39 licenses within 25 km),
   comp_pct, roof_per10k; counties name, reg, pop, hu, cbp_roof, roofers, lic, lic_all, comp; DATA.comp (named companies, few in California);
   DATA.lic_city [[city, county index, active C-39, all C-39]]; META.lic {n, clear, inca, out, only, susp, top}; META.cbp; META.nes.
   Calls LINE_FIRMS (module 12) at mount, with a fallback if it is not there. */
/* reach weights for named companies; a tier the table does not know counts as local */
const TIERW = { statewide: 3, national: 2.5, multiregion: 2, regional: 1.5, local: 1 };
const firmLinks = c => { const q = encodeURIComponent(String(c.name || '').replace(/,? (LLC|L\.L\.C\.|Inc|Incorporated|Corp|Corporation|Co|LP)\.?$/i, '')); return [['Meta Ad Library', `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=US&q=${q}&search_type=keyword_unordered`], ['Google Ads Transparency', `https://adstransparency.google.com/?region=US&domain=${encodeURIComponent(c.domain || '')}`], ['Website', c.url]].filter(a => a[1] && (a[0] !== 'Google Ads Transparency' || c.domain)); };
const SEG_L = { res: 'Residential', comm: 'Commercial', com: 'Commercial', both: 'Residential and commercial' };
/* ============================ Module 7: Competitive Field ============================ */
registerModule({
  key: 'field', num: '07', title: 'Competitive Field', desc: 'Who is already there: the C-39 license roll by ZIP and city, roofing establishments, pressure by ZIP, the named companies on record and the ground between them',
  mount(root) {
    const km = (a, b, c, d) => { const x = (d - b) * Math.cos((a + c) / 2 * Math.PI / 180), y = c - a; return Math.sqrt(x * x + y * y) * 111.32; };
    const andList = a => a.length <= 1 ? (a[0] || '') : a.length === 2 ? a[0] + ' and ' + a[1] : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
    const compiled = dateL(META.compiled || '2026-11-19');
    const FIRMS = (Array.isArray(COMP) ? COMP : []).map(c => Object.assign({ offices: [], lines: [], cities: [], cert: [] }, c, { offices: (c.offices || []).filter(o => isN(o.lat) && isN(o.lon)), lines: c.lines || [], cities: c.cities || [], cert: c.cert || [], tier: c.tier || 'local' }));
    const lineFirms = k => typeof LINE_FIRMS === 'function' ? LINE_FIRMS(k) : FIRMS.filter(c => c.lines.includes(k));
    const tiersIn = Object.keys(TIERW).filter(t => FIRMS.some(c => c.tier === t));
    const st = { layer: 'comp_pct', tiers: new Set(tiersIn), line: '', seg: '', sel: null, zip: null };
    const offN = sum(FIRMS.map(c => c.offices.length)); const ver = FIRMS.filter(c => c.verified);
    const L = META.lic || {}; const licAct = isN(L.clear) ? L.clear : (isN(L.n) ? L.n : sum(Z.map(z => z.lic || 0))); const licRoll = isN(L.n) ? L.n : null;
    const LC = Array.isArray(DATA.lic_city) ? DATA.lic_city.slice().sort((a, b) => b[2] - a[2]) : (Array.isArray(L.top) ? L.top.map(([c, n]) => [c, null, n, null]) : []);
    const est = (META.cbp || {}).est;
    /* thin field: scored ZIPs at or below the tenth percentile of licensed roofers within 25 km. The cut is read from the data. */
    const n25 = ZR.map(z => z.comp_n25 || 0).sort((a, b) => a - b); const thin = n25.length ? n25[Math.floor((n25.length - 1) * 0.10)] : 0;
    const isThin = z => (z.comp_n25 || 0) <= thin; const ws = ZR.filter(isThin);
    const perLic = z => (z.fees || 0) / (1 + (z.comp_n25 || 0));
    const hasSpan = FIRMS.some(c => c.spanish === true || c.spanish === false);
    const LAYERS = { comp_pct: 'Competitive pressure percentile', comp_n25: 'Active C-39 licenses within 25 km', roof_per10k: 'Roofing establishments and licenses per 10,000 residents', lic: 'Active C-39 licenses mailed to the ZIP', ws: 'Profit pool per licensed roofer within 25 km' };
    root.innerHTML = mastHTML({ eyebrow: 'Module 07 · Competitive Field · the license roll, roofing establishments and named companies', title: 'Competitive Field',
      dek: `California roofing is a long tail with no public ranking. ${N(licAct)} active C-39 Roofing licenses${isN(est) ? ` stand against ${N(est)} roofing establishments with employees, about ${D(licAct / Math.max(1, est), 1)} licenses for each` : ''}: many licensees have no payroll, and no public file says how big any of them is. So this module reads the field from what is counted: every licensed roofer by the ZIP and city where the license gets its mail, the establishments the Census Bureau counts, a pressure surface by ZIP built from both, and the ground where licensed roofers are few. ${FIRMS.length ? `The ${N(FIRMS.length)} named compan${FIRMS.length === 1 ? 'y' : 'ies'} on record ${FIRMS.length === 1 ? 'is' : 'are'} only those a public source names; ${FIRMS.length === 1 ? 'it is' : 'they are'} not a roster of the market.` : 'No named company list could be built honestly for this edition.'}`,
      meta: [`<b>Licenses</b> ${N(licAct)} active C-39${licRoll && licRoll !== licAct ? ` of ${N(licRoll)} on the renewed roll` : ''}`, isN(est) ? `<b>Establishments</b> ${N(est)} with employees` : '', `<b>Named companies</b> ${N(FIRMS.length)}, ${N(ver.length)} read on their own sites`, '<b>Grade</b> A for license counts, C for named companies'].filter(Boolean),
      bar: 'Competitive Field', barsub: 'Who is already there',
      actions: [{ id: 'f7LicCsv', label: '↓ Licenses by city CSV' }, { id: 'f7Csv', label: '↓ Companies CSV' }, { id: 'f7Watch', label: 'Competitor Watch ↗', title: 'Ads and pages for the selected company (module 13)' }] }) +
      `<div class="wrap">
      ${callout('', 'Read this first: three counts, three denominators', `<b>License records</b> (${N(licAct)} active and unsuspended C-39 Roofing licenses in the Contractors State License Board's master file) show who may legally sell roofing: a license is needed for any job of $1,000 or more (Business and Professions Code 7048). A license is counted where it gets its mail, which is where the firm is, not where it works. <b>Roofing contractors</b>${isN(est) ? ` (${N(est)} establishments with employees in County Business Patterns, NAICS 238160${META.nes ? `, and ${N(META.nes.est2381)} nonemployer firms in the exterior trades` : ''})` : ''} measure the trade with a payroll. <b>Named companies</b> (${N(FIRMS.length)}) are only those a public source names; fields nobody read on a company's own site are blank and flagged. <b>Competitive pressure</b> blends licenses near a ZIP (60%, weighted by distance) with roofing establishments (40%). None of this measures size or ad spend; module 13 watches the ads themselves.`)}
      <div class="kpis" id="f7Kpis"></div>
      <div class="controls">
        <div class="ctl"><label class="fl" for="f7Layer">Map layer</label><select id="f7Layer">${Object.entries(LAYERS).filter(([k]) => k === 'ws' || ZC.includes(k)).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select></div>
        ${FIRMS.length ? `<div class="ctl"><label class="fl" for="f7Seg">Named companies: market</label><select id="f7Seg"><option value="">Residential and commercial</option><option value="res">Residential roofers</option><option value="comm">Commercial roofers</option></select></div>
        <div class="ctl"><label class="fl" for="f7Line">Named companies marketing</label><select id="f7Line"><option value="">Any line</option>${PL.map(l => `<option value="${l.key}">${esc(l.name)}</option>`).join('')}</select></div>
        <div class="ctl"><span class="fl">Reach</span><div class="chips" id="f7Tiers">${tiersIn.map(t => `<button type="button" class="chip on" data-t="${t}" aria-pressed="true">${t}</button>`).join('')}</div></div>` : ''}
      </div>
      <div class="grid2">
        <div class="card mapcard"><div id="f7Map"></div><div class="legend" id="f7Leg"></div></div>
        <div class="stack">
          <div class="card"><div class="card-h" style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start"><div><h3 id="f7Name">The field</h3><p id="f7Sub">Click a ZIP${FIRMS.length ? ' or an office marker' : ''}</p></div><span class="pill" id="f7Pill"></span></div><div class="card-b" id="f7Detail"></div></div>
        </div>
      </div>
      ${card('Named companies on record', 'Companies a public source names. Not a ranking and not the market: there is no public measure of a California roofer\'s size. Click a row to open it.', '<div class="tscroll" id="f7Tbl"></div>', 'mt')}
      <div class="split">
        ${card('Thin field: job value where licensed roofers are few', `Scored ZIPs with ${N(thin)} or fewer active C-39 licenses within 25 km (the lowest tenth of scored ZIPs), ranked by gross profit pool.`, '<div class="tscroll short" id="f7Ws"></div>')}
        ${card('The local trade by county', 'Roofing establishments, active C-39 licenses and both per 10,000 residents.', '<div class="tscroll short" id="f7Par"></div>')}
      </div>
      <div class="split">
        ${card('The license roll', 'Active C-39 Roofing licenses by the city where the license gets its mail.', '<div id="f7Lic"></div><p class="chartnote" id="f7LicN"></p>')}
        ${card(ver.length ? 'Certifications, financing and Spanish' : 'What the roll says about the trade', ver.length ? 'What the companies read on their own sites show.' : 'Read from the license file and the Census counts.', '<div id="f7Cert"></div><p class="chartnote" id="f7CertN"></p>')}
      </div>
      <div class="split">
        ${card('What the field means for a campaign', 'How to read pressure, licenses and thin ground.', '<div id="f7Mean"></div>')}
        ${card('Judgment calls and sources', 'How the counts were built and what they miss.', '<div id="f7Src"></div>')}
      </div>
      <div class="foot" id="f7Foot"></div></div>`;
    const kp = [{ l: 'Active C-39 Roofing licenses', g: 'A', v: N(licAct), d: `${licRoll ? N(licRoll) + ' on the renewed roll' : 'CSLB master file'}${isN(L.susp) ? ` · ${N(L.susp)} suspended` : ''}` }];
    if (isN(L.only) && licRoll) kp.push({ l: 'Roofing specialists', g: 'A', v: P(L.only / licRoll * 100, 0), d: `${N(L.only)} hold C-39 and no other class` });
    if (isN(est)) kp.push({ l: 'Licenses per employer establishment', g: 'B', v: D(licAct / Math.max(1, est), 1), d: `${N(est)} roofing establishments with employees${(META.cbp || {}).emp ? ', ' + N(META.cbp.emp) + ' employees' : ''}` });
    if (LC.length) kp.push({ l: 'Cities with a licensed roofer', g: 'A', v: N(LC.filter(a => a[2] > 0).length), d: `${esc(andList(LC.slice(0, 3).map(a => `${a[0]} (${N(a[2])})`)))} lead` });
    if (isN(L.out) && licRoll) kp.push({ l: 'Out of state addresses', g: 'A', v: P(L.out / licRoll * 100, 0), d: `${N(L.out)} of ${N(licRoll)} licenses on the roll` });
    kp.push({ l: 'Thin field ZIPs', g: 'B', v: N(ws.length), d: `${N(sum(ws.map(z => z.pop)))} residents with ${N(thin)} or fewer licensed roofers within 25 km` });
    kp.push({ l: 'Named companies on record', g: 'C', v: N(FIRMS.length), d: `${N(ver.length)} read on their own sites · ${N(offN)} offices placed` });
    $('#f7Kpis', root).innerHTML = kpiHTML(kp.slice(0, 7));
    const firmOk = c => (!st.tiers.size || st.tiers.has(c.tier) || !tiersIn.includes(c.tier)) && (!st.line || c.lines.includes(st.line)) && (!st.seg || c.seg === st.seg || (st.seg === 'comm' && c.seg === 'com') || c.seg === 'both');
    const map = new ZipMap($('#f7Map', root), { segHit: 'none', roads: false, onSelect: z => { st.zip = st.zip === z ? null : z; st.sel = null; render(); },
      onHover: (z, e) => { const r = ZI[z]; if (!r || !r.res_ok) return; showTip(`<div class="tt">${esc(r.zip)} · ${esc(r.city)}</div><div class="ts">${esc(r.cty)} County</div>${tipRow('Competitive pressure percentile', D(r.comp_pct, 0))}${tipRow('Active C-39 licenses: in the ZIP · within 25 km', N(r.lic) + ' · ' + N(r.comp_n25))}${tipRow('Roofing establishments in the ZIP', N(r.roofers))}${tipRow('Gross profit pool a year', MM(r.fees))}`, e); },
      onPin: id => { st.sel = +String(id).split(':')[0]; st.zip = null; render(); }, onPinHover: (id, e) => { const [ci, oi] = String(id).split(':').map(Number); const c = FIRMS[ci], o = c.offices[oi]; showTip(`<div class="tt">${esc(c.name)}</div><div class="ts">${esc(o.city)} · ${esc(c.tier)}${o.hq ? ' · headquarters' : ''}</div>${tipRow('Market', SEG_L[c.seg] || '')}${tipRow('Offices placed', N(c.offices.length))}<div class="tf">${c.verified ? 'Read on the company\'s site' : 'Named in a public source; details not read'}</div>`, e); } });
    function render() {
      const ly = st.layer; const val = ly === 'ws' ? perLic : (z => z[ly]); const vals = ZR.map(val); const sc = qScale(vals, ly === 'ws' ? 'green' : 'teal', 1);
      map.fill(zip => { const z = ZI[zip]; if (!z || !z.res_ok) return null; return sc.f(val(z)); });
      const f = ly === 'ws' ? MM : ly === 'roof_per10k' ? (v => D(v, 1)) : (v => D(v, 0)); const v = vals.filter(isN);
      $('#f7Leg', root).innerHTML = legendHTML({ title: LAYERS[ly], R: sc.R, lo: f(Math.min(...v)), hi: f(Math.max(...v)), note: ly === 'ws' ? `<b>Darker is more job value for each licensed roofer nearby.</b> The ZIP's gross profit pool divided by one plus the active C-39 licenses within 25 km. ${G('D')}` : `<b>Darker is more crowded.</b> ${ly === 'comp_n25' ? 'Licenses are placed at their mailing ZIP.' : ly === 'lic' ? 'A license sits where the firm gets its mail.' : ''}${FIRMS.length && offN ? ' Diamonds are headquarters of named companies, circles other offices.' : ''} ${G(ly === 'comp_pct' ? 'B' : 'A')}` });
      map.select(st.zip);
      map.pins(FIRMS.flatMap((c, i) => firmOk(c) ? c.offices.map((o, j) => ({ id: i + ':' + j, lat: o.lat, lon: o.lon, r: 2.6 + (TIERW[c.tier] || 1) * 0.9, fill: i === st.sel ? cssv('--accent') : cssv('--ink'), shape: o.hq ? 'diamond' : '', op: i === st.sel ? 1 : .78, sel: i === st.sel })) : []));
      drawDetail(); drawTable();
    }
    function drawTable() {
      const host = $('#f7Tbl', root);
      if (!FIRMS.length) { host.innerHTML = '<p class="mini" style="padding:10px">No named companies in this build. The license roll and the establishment counts carry the field.</p>'; return; }
      const rows = FIRMS.map((c, i) => ({ c, i, name: c.name, tier: c.tier, seg: SEG_L[c.seg] || '—', hq: c.hq || '—', off: c.offices.length, cities: c.cities.length, cert: c.cert.join(', '), fin: c.fin, sp: c.spanish, ver: c.verified, licno: c.lic_no || '' })).filter(r => firmOk(r.c));
      dataTable(host, [{ k: 'name', h: 'Company', l: 1, f: (v, r) => `<b>${esc(v)}</b>${r.ver ? '' : ' <span class="pill">named only</span>'}` }, { k: 'licno', h: 'CSLB license', l: 1, f: v => esc(v || '—') }, { k: 'tier', h: 'Reach', l: 1 }, { k: 'seg', h: 'Market', l: 1 }, { k: 'hq', h: 'Headquarters', l: 1 }, { k: 'off', h: 'Offices', f: v => N(v) }, { k: 'cities', h: 'Cities served', f: v => v ? N(v) : '—' }, { k: 'ln', h: 'Marketed lines', l: 1, v: r => r.c.lines.map(k => PLI[k] ? PLI[k].short : k).join(', '), f: v => `<span class="mini">${esc(v || '—')}</span>` }, { k: 'cert', h: 'Manufacturer programs', l: 1, f: v => `<span class="mini">${esc(v || '—')}</span>` }, { k: 'fin', h: 'Financing', f: (v, r) => r.ver ? (v ? 'Yes' : 'none shown') : '—' }, { k: 'sp', h: 'Spanish', f: (v, r) => r.ver ? (v ? 'Yes' : 'none found') : '—' }],
        rows, { sortKey: 'off', id: r => r.i, onClick: i => { st.sel = +i; st.zip = null; render(); window.scrollTo({ top: $('#f7Map', root).getBoundingClientRect().top + scrollY - 120, behavior: 'smooth' }); }, rowClass: r => r.i === st.sel ? 'sel' : '' });
    }
    function drawDetail() {
      const box = $('#f7Detail', root); const row = (a, b) => `<div class="rowl"><span>${a}</span><b style="white-space:normal">${b}</b></div>`;
      if (st.sel != null && FIRMS[st.sel]) {
        const c = FIRMS[st.sel]; $('#f7Name', root).textContent = c.name; $('#f7Sub', root).textContent = [c.hq, c.tier, SEG_L[c.seg], c.offices.length ? `${N(c.offices.length)} office${c.offices.length === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · '); $('#f7Pill', root).textContent = c.verified ? 'Read on site' : 'Named only';
        const reach = c.offices.length ? ZR.filter(z => c.offices.some(o => km(z.lat, z.lon, o.lat, o.lon) <= 25)) : [];
        box.innerHTML = `${c.url ? row('Website', `<a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.domain || c.url)}</a>`) : ''}
          ${c.lic_no ? row('CSLB license number', esc(c.lic_no)) : ''}${c.src ? row('Named in', esc(c.src)) : ''}
          ${c.offices.length ? row('Offices', esc(c.offices.map(o => o.city + (o.hq ? ' (HQ)' : '')).join(', '))) : ''}
          ${c.lines.length ? row('Lines marketed', esc(c.lines.map(k => PLI[k] ? PLI[k].short : k).join(', '))) : ''}
          ${c.cities.length ? row('Cities it says it serves', esc(c.cities.join(', '))) : ''}
          ${c.verified ? row('Manufacturer programs · financing · Spanish pages', `${esc(c.cert.join(', ') || 'none shown')} · ${c.fin ? 'yes' : 'none shown'} · ${c.spanish ? 'yes' : 'none found'}`) : '<p class="mini">Nobody read this company\'s own site for this build, so its lines, programs, financing and languages are not known here. Confirm everything before use.</p>'}
          ${c.phone ? row('Phone on the site', esc(c.phone)) : ''}
          ${reach.length ? row('Scored ZIPs within 25 km of an office', `${N(reach.length)} · ${MM(sum(reach.map(z => z.fees)))} profit pool`) : ''}
          ${c.title ? `<div class="dsec">Their site, as read ${esc(c.asof ? dateL(c.asof) : '')}</div><div class="adprev"><div class="ah">${esc(c.title)}</div><div class="ad">${esc(c.desc || '')}</div>${c.h1 ? `<div class="mini">H1: ${esc(String(c.h1).replace(/\s+/g, ' '))}</div>` : ''}</div>` : ''}
          ${c.notes ? `<p class="mini" style="margin-top:6px">${esc(c.notes)}</p>` : ''}
          ${(c.social || []).filter(x => !/facebook\.com\/tr\b/.test(x)).length ? `<p class="mini">${(c.social || []).filter(x => !/facebook\.com\/tr\b/.test(x)).map(esc).join(' · ')}</p>` : ''}
          <div class="dsec">Watch their ads</div><div style="display:flex;gap:6px;flex-wrap:wrap">${firmLinks(c).map(([l, u]) => `<a class="ibtn" href="${esc(u)}" target="_blank" rel="noopener">${esc(l)} ↗</a>`).join('')}<button class="ibtn" id="f7W">Competitor Watch ↗</button></div>
          <p class="mini" style="margin-top:8px">Claims on competitor sites (years in business, ratings, certifications, warranties) are theirs, quoted as found. Never use a competitor's name, slogan or certification in your own ads; a comparison must be true and provable, and a manufacturer certification may be named only as its program allows (module 03 and the Satchel). Check any license on the CSLB license search before relying on it.</p>`;
        $('#f7W', root).onclick = () => goModule('watch', { comp: st.sel });
        return;
      }
      if (st.zip && ZI[st.zip]) {
        const z = ZI[st.zip]; $('#f7Name', root).textContent = `${z.zip} · ${z.city}`; $('#f7Sub', root).textContent = `${z.cty} County`; $('#f7Pill', root).textContent = 'ZIP';
        const near = FIRMS.filter(c => c.offices.length).map((c, i) => ({ c, i, d: Math.min(...c.offices.map(o => km(z.lat, z.lon, o.lat, o.lon))) })).filter(o => o.d <= 60).sort((a, b) => a.d - b.d);
        const serves = FIRMS.filter(c => c.cities.includes(z.city)); const cityRow = LC.find(a => a[0] === z.city);
        box.innerHTML = `${row('Competitive pressure percentile', D(z.comp_pct, 0))}${row('Active C-39 licenses mailed to the ZIP' + (isN(z.lic_all) ? ' · all on the roll' : ''), N(z.lic) + (isN(z.lic_all) ? ' · ' + N(z.lic_all) : ''))}${row('Active C-39 licenses within 25 km', N(z.comp_n25) + (isThin(z) ? ' · thin field' : ''))}${row('Roofing establishments in the ZIP (Business Patterns)', N(z.roofers))}${row('Establishments and licenses per 10,000 residents', D(z.roof_per10k, 1))}${row('Gross profit pool · per licensed roofer within 25 km', MM(z.fees) + ' · ' + MM(perLic(z)))}${cityRow ? row(`Active C-39 licenses mailed to ${esc(z.city)}`, N(cityRow[2])) : ''}${near.length ? `<div class="dsec">Named companies within 60 km</div>${near.map(o => row(esc(o.c.name), D(o.d, 0) + ' km')).join('')}` : ''}${serves.length ? `<div class="dsec">Named companies that list ${esc(z.city)} as a service city</div><p class="mini">${serves.map(c => esc(c.name)).join(', ')}</p>` : ''}<p class="mini" style="margin-top:8px">Cells under three establishments are withheld in the ZIP business file, so a small town can read zero and still have roofers.</p>`;
        return;
      }
      $('#f7Name', root).textContent = 'The field'; $('#f7Sub', root).textContent = `Click a ZIP${FIRMS.length ? ', an office marker or a company' : ''}`; $('#f7Pill', root).textContent = 'State';
      const byReg = REG_KEYS.map(k => { const ps = PA.filter(p => p.reg === k); return { n: REGN[k], lic: sum(ps.map(p => p.lic || 0)), pop: sum(ps.map(p => p.pop || 0)) }; }).filter(o => o.pop).sort((a, b) => b.lic - a.lic);
      box.innerHTML = `<div class="dsec" style="margin-top:0">Active C-39 licenses by region · per 10,000 residents</div>${byReg.map(o => row(esc(o.n), `${N(o.lic)} · ${D(o.lic / o.pop * 1e4, 2)}`)).join('')}${FIRMS.some(c => c.lines.length) ? `<div class="dsec">Lines marketed by the named companies</div>${PL.map(l => row(esc(l.name), N(lineFirms(l.key).length))).join('')}` : ''}`;
    }
    dataTable($('#f7Ws', root), [{ k: 'zip', h: 'ZIP', l: 1, f: v => `<b>${esc(v)}</b>` }, { k: 'city', h: 'City', l: 1 }, { k: 'cty', h: 'County', l: 1 }, { k: 'roofs', h: 'Roofs', f: v => N(v) }, { k: 'fees', h: 'Profit pool', f: v => MM(v) }, { k: 'comp_n25', h: 'C-39 within 25 km', f: v => N(v) }, { k: 'lic', h: 'In the ZIP', f: v => N(v) }], ws, { sortKey: 'fees', id: r => r.zip, onClick: z => { st.zip = z; st.sel = null; map.fitTo([z]); render(); } });
    const nPub = PA.filter(p => p.cbp_roof != null).length;
    const parRows = PA.map(p => ({ p, name: p.name, pop: p.pop, cbp: p.cbp_roof, zbp: p.roofers, lic: p.lic, per: ((p.cbp_roof != null ? p.cbp_roof : (p.roofers || 0)) + (p.lic || 0)) / Math.max(1, p.pop) * 1e4 }));
    dataTable($('#f7Par', root), [{ k: 'name', h: 'County', l: 1, f: v => `<b>${esc(v)}</b>` }, { k: 'pop', h: 'Residents', f: v => N(v) }, { k: 'cbp', h: 'Establishments (county file)', f: v => v != null ? N(v) : '—', t: `County Business Patterns, NAICS 238160; published for ${nPub} of ${PA.length} counties` }, { k: 'lic', h: 'Active C-39', f: v => N(v) }, { k: 'per', h: 'Both per 10k', f: v => D(v, 1) }], parRows, { sortKey: 'per' });
    const LT = LC.slice(0, 15);
    if (LT.length) hbarChart($('#f7Lic', root), LT.map(a => ({ l: a[0], v: a[2], t: N(a[2]), color: ramp('teal')[5] })).concat(isN(L.out) ? [{ l: 'Out of state address', v: L.out, t: N(L.out), color: ramp('green')[5] }] : []), { W: 520, L: 150, R: 50, rowH: 21, aria: 'Active C-39 Roofing licenses by mailing city' });
    else $('#f7Lic', root).innerHTML = '<p class="mini">No license counts by city in this build.</p>';
    const top4 = sum(LT.slice(0, 4).map(a => a[2]));
    $('#f7LicN', root).innerHTML = `${N(licAct)} C-39 Roofing licenses are active and unsuspended${licRoll && licRoll !== licAct ? `, of ${N(licRoll)} on the renewed roll` : ''}${isN(L.susp) ? `; ${N(L.susp)} are suspended, most often for a lapsed workers' compensation certificate` : ''}. ${LT.length >= 4 ? `The four largest mailing cities (${esc(andList(LT.slice(0, 4).map(a => a[0])))}) hold ${P(top4 / Math.max(1, licAct) * 100, 0)} of them: the roll is spread thin across ${N(LC.filter(a => a[2] > 0).length)} cities. ` : ''}${isN(L.out) && licRoll ? `${N(L.out)} licenses (${P(L.out / licRoll * 100, 0)}) have an out of state address. ` : ''}Every licensee must show the license number in all advertising (Business and Professions Code 7030.5), which makes any roofing ad checkable against the roll. After a declared disaster, contracting without a license in the disaster area can be charged as a felony (Business and Professions Code 7028.16). ${G('A')}`;
    if (ver.length) {
      const cc = {}; ver.forEach(c => c.cert.forEach(x => cc[x] = (cc[x] || 0) + 1));
      const crow = [['Any manufacturer program', ver.filter(c => c.cert.length).length]].concat(Object.entries(cc).sort((a, b) => b[1] - a[1])).concat([['Financing offered', ver.filter(c => c.fin).length], ['Spanish pages', ver.filter(c => c.spanish).length], ['Residential lines', ver.filter(c => c.seg !== 'comm' && c.seg !== 'com').length], ['Commercial lines', ver.filter(c => c.seg !== 'res').length]]);
      hbarChart($('#f7Cert', root), crow.map(([l, n]) => ({ l, v: n, t: `${N(n)} of ${N(ver.length)}`, color: ramp('green')[6] })), { W: 520, L: 190, R: 70, rowH: 22, max: ver.length, aria: 'Certifications, financing and Spanish among companies read on their own sites' });
      $('#f7CertN', root).innerHTML = `Of the ${N(ver.length)} companies read on their own sites, ${N(ver.filter(c => c.cert.length).length)} show a manufacturer program, ${N(ver.filter(c => c.fin).length)} advertise financing and ${N(ver.filter(c => c.spanish).length)} have Spanish pages. Too few to speak for the state. Claim a certification only while it is current and in the program's own words. Financing ads need Regulation Z disclosures (module 03).`;
    } else {
      $('#f7Cert', root).innerHTML = proseTable([
        ['<b>Mostly small</b>', `${isN(est) ? `${N(est)} roofing establishments have employees${(META.cbp || {}).emp ? ` (${N(META.cbp.emp)} workers, about ${D(META.cbp.emp / Math.max(1, est), 0)} each)` : ''}; ` : ''}the license roll is about ${isN(est) ? D(licAct / Math.max(1, est), 1) : 'two'} times as long, so roughly half the licenses belong to firms with no payroll or to firms whose main trade is something else.`],
        ['<b>Specialists</b>', isN(L.only) && licRoll ? `${N(L.only)} of ${N(licRoll)} licenses on the roll (${P(L.only / licRoll * 100, 0)}) hold C-39 and nothing else; the rest pair roofing with other classes.` : 'The share holding C-39 alone is not in this build.'],
        ['<b>Workers\' compensation</b>', 'A C-39 licensee must keep a workers\' compensation certificate on file even with no employees, and the insurer must audit the payroll in person every year (Business and Professions Code 7125; Insurance Code 11665). It is the commonest reason a roofing license is suspended.'],
        ['<b>Bond</b>', 'Every licensee carries a $25,000 contractor\'s bond (Business and Professions Code 7071.6).'],
        ['<b>Sales staff</b>', 'Anyone who solicits or signs home improvement contracts for a licensee must be a registered home improvement salesperson (Business and Professions Code 7152).'],
      ]);
      $('#f7CertN', root).innerHTML = 'Certifications, financing and Spanish pages were not read from company sites for this edition, so nothing is said about them. Module 13 is where to read a competitor\'s own pages and ads.';
    }
    const regThin = REG_KEYS.map(k => [k, ws.filter(z => (PA[z.pi] || {}).reg === k).length]).sort((a, b) => b[1] - a[1]).filter(a => a[1]).slice(0, 3);
    const span4 = CITIES.filter(c => isN(c.span)).slice().sort((a, b) => b.span - a.span).slice(0, 4);
    const thinLines = FIRMS.some(c => c.lines.length) ? PL.map(l => [l, lineFirms(l.key).length]).sort((a, b) => a[1] - b[1]).slice(0, 3) : [];
    const hot = PA.filter(p => isN(p.lic) && p.pop).map(p => [p.name, p.lic / p.pop * 1e4]).sort((a, b) => b[1] - a[1]);
    $('#f7Mean', root).innerHTML = proseTable([
      ['<b>Crowded and open counties</b>', hot.length ? `Active C-39 licenses per 10,000 residents run highest in ${esc(andList(hot.slice(0, 3).map(a => `${a[0]} (${D(a[1], 1)})`)))} and lowest in ${esc(andList(hot.slice(-3).map(a => `${a[0]} (${D(a[1], 1)})`)))}. A high rate can mean a crowded market or a county whose roofers work the next one over: read it with the pressure surface.` : 'County license rates are not in this build.'],
      ['<b>Thin ground</b>', `${N(ws.length)} scored ZIPs have ${N(thin)} or fewer licensed roofers within 25 km${regThin.length ? `, most of them in ${esc(andList(regThin.map(([k, n]) => `${REGN[k]} (${n})`)))}` : ''}. Job flow there is smaller per ZIP and the drive is long, but a roofer with a local address has few rivals, and in fire country the work is specialized.`],
      ['<b>Spanish</b>', `${hasSpan ? `${N(FIRMS.filter(c => c.spanish).length)} of the named companies show Spanish pages. ` : 'Whether competitors publish in Spanish was not measured for this edition. '}${span4.length ? `${esc(andList(span4.map(c => `${c.name} (${K(c.span)})`)))} hold the most residents who speak Spanish at home. ` : ''}The Campaign Desk builds Spanish only where limited English is common, with the license number in Spanish.`],
      thinLines.length ? ['<b>Thin lines</b>', `${thinLines.map(([l, n]) => `${esc(l.name)} (${n} compan${n === 1 ? 'y' : 'ies'})`).join(', ')} are marketed by the fewest named companies. With so few companies read, treat this as a hint.`] : ['<b>Lines</b>', 'Which lines competitors market is not known from this build: too few company sites were read. The license roll does not say what a roofer sells.'],
      ['<b>Pressure is not price</b>', 'The pressure surface feeds the cost model in module 05; actual auction prices arrive with account data (module 15). After a large storm or fire, crews and advertisers arrive from other counties and prices jump for weeks.'],
    ]);
    $('#f7Src', root).innerHTML = proseTable([
      ['License counts', 'Every license in the CSLB master file whose classifications include C-39, counted at the mailing ZIP and city on the license. Active means status clear. The file lists renewed licenses only, so the roll is not everyone who ever held the class.'],
      ['Within 25 km', 'Licenses are placed at the center of their mailing ZIP and counted within 25 km of each ZIP\'s center. The distance was carried over from the first edition; in a large metro nearly every ZIP has many, which is why the thin field is defined by the lowest tenth and not by zero.'],
      ['Named companies', `${N(FIRMS.length)} compan${FIRMS.length === 1 ? 'y is' : 'ies are'} listed, only those a public source names. ${N(ver.length)} ${ver.length === 1 ? 'was' : 'were'} read on ${ver.length === 1 ? 'its' : 'their'} own site${ver.length === 1 ? '' : 's'}. A ranked California roster could not be built honestly: no public file measures size.`],
      ['Offices', 'Offices of named companies sit at the city or ZIP center, not the street address.'],
      ['Missing', 'Size, revenue, crews, reviews and ad spend of any roofer. Unlicensed operators are, by definition, not on the roll.'],
    ]) + srcRows([
      ['Licenses', 'Contractors State License Board, License Master file; check any company on the CSLB license search', 'A', esc(compiled), 'https://www.cslb.ca.gov/onlineservices/dataportal/ContractorList.aspx'],
      ['Contractors', 'County and ZIP Business Patterns, NAICS 238160 Roofing Contractors; Nonemployer Statistics, NAICS 2381', 'A', '', 'https://www.census.gov/programs-surveys/cbp.html'],
      ['Named companies', 'Public sources named on each record; company websites where read', 'C', esc(compiled), ''],
    ]);
    $('#f7Foot', root).innerHTML = `<b style="color:var(--ink)">California Roofer Guru</b>, module 07. License counts from the Contractors State License Board; company names and claims are quoted from public sources for competitive research. Compiled ${esc(compiled)}.`;
    $('#f7Layer', root).onchange = e => { st.layer = e.target.value; render(); };
    if ($('#f7Line', root)) $('#f7Line', root).onchange = e => { st.line = e.target.value; render(); };
    if ($('#f7Seg', root)) $('#f7Seg', root).onchange = e => { st.seg = e.target.value; render(); };
    $$('#f7Tiers [data-t]', root).forEach(b => b.onclick = () => { const t = b.dataset.t; if (st.tiers.has(t)) { if (st.tiers.size > 1) st.tiers.delete(t); } else st.tiers.add(t); $$('#f7Tiers [data-t]', root).forEach(x => { const on = st.tiers.has(x.dataset.t); x.classList.toggle('on', on); x.setAttribute('aria-pressed', String(on)); }); render(); });
    const csvFirms = () => ({ head: ['company', 'cslb_license', 'domain', 'reach', 'market', 'headquarters', 'offices', 'office_cities', 'service_cities', 'lines', 'manufacturer_programs', 'financing', 'spanish_pages', 'read_on_site', 'as_of', 'source'], rows: FIRMS.map(c => [c.name, c.lic_no || '', c.domain || '', c.tier, SEG_L[c.seg] || '', c.hq || '', c.offices.length, c.offices.map(o => o.city).join('; '), c.cities.join('; '), c.lines.join('; '), c.cert.join('; '), c.verified ? (c.fin ? 'yes' : 'no') : '', c.verified ? (c.spanish ? 'yes' : 'no') : '', c.verified ? 'yes' : 'named only', c.asof || '', c.src || '']) });
    const csvLic = () => ({ head: ['city', 'county', 'c39_active', 'c39_all_on_roll'], rows: LC.map(a => [a[0], a[1] != null && PA[a[1]] ? PA[a[1]].name : '', a[2], a[3] != null ? a[3] : '']) });
    $('#f7Csv', root).onclick = () => { const o = csvFirms(); saveFile('california-roofing-companies.csv', toCSV(o.head, o.rows, 'California Roofer Guru, module 07. Public sources; companies marked named only were not read on their own sites.')); };
    $('#f7LicCsv', root).onclick = () => { const o = csvLic(); saveFile('california-c39-licenses-by-city.csv', toCSV(o.head, o.rows, 'California Roofer Guru, module 07. CSLB License Master file, C-39 Roofing, by mailing city.')); };
    $('#f7Watch', root).onclick = () => goModule('watch', st.sel != null ? { comp: st.sel } : {});
    BUS.on('theme', () => render());
    this.receive = p => { if (p && p.comp != null && FIRMS[p.comp]) { st.sel = +p.comp; st.zip = null; render(); } else if (p && p.zip && ZI[p.zip]) { st.zip = p.zip; st.sel = null; render(); } };
    this.api = { thin: () => ({ cut: thin, zips: ws.map(z => z.zip) }), csvFirms, csvLic, firms: () => FIRMS };
    render();
  }
});
