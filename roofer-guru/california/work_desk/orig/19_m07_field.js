/* ==== 19_m07_field.js ==== */
/* ==== src/19_m07_field.js ==== */
/* ==== m07_field ==== */
"use strict";
const TIERW = { statewide: 3, national: 2.5, regional: 1.5, local: 1 };
const firmLinks = c => { const q = encodeURIComponent(c.name.replace(/,? (LLC|LLP|PLC|APLC|Inc)\.?$/i, '')); return [['Meta Ad Library', `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=US&q=${q}&search_type=keyword_unordered`], ['Google Ads Transparency', `https://adstransparency.google.com/?region=US&domain=${encodeURIComponent(c.domain || '')}`], ['Website', c.url]]; };
const SEG_L = { res: 'Residential', comm: 'Commercial', both: 'Residential and commercial' };
/* ============================ Module 7: Competitive Field ============================ */
registerModule({
  key: 'field', num: '07', title: 'Competitive Field', desc: 'The roofing companies already in the market: offices, reach, lines, certifications, the license roster, pressure by ZIP and the whitespace between them',
  mount(root) {
    const st = { layer: 'comp_pct', tiers: new Set(['statewide', 'national', 'regional', 'local']), line: '', seg: '', sel: null, zip: null };
    const offN = sum(COMP.map(c => c.offices.length));
    const ws = ZR.filter(z => (z.comp_n25 || 0) === 0);
    root.innerHTML = mastHTML({ eyebrow: 'Module 07 · Competitive Field · mapped roofing companies, contractors and licenses', title: 'Competitive Field', dek: 'Louisiana roofing is a long tail: a few statewide and national residential brands headquartered around Baton Rouge, the Northshore and Monroe, commercial specialists in Baton Rouge, New Orleans and Lafayette, hundreds of local contractors, and a third of all roofing license records held by companies based out of state, most of which arrive with the storms. This module maps the companies, their offices, lines and certifications, reads the license roster, turns the footprint into a pressure surface by ZIP, and shows where the field thins out.',
      meta: [`<b>Companies</b> ${N(COMP.length)} mapped, ${N(META.ncomp_ver)} verified on their own sites October 6, 2026`, `<b>Offices</b> ${N(offN)} mapped`, `<b>Licenses</b> ${N(META.lic.n)} roofing license records, ${N(META.lic.out)} out of state`, '<b>Grade</b> C: public listings, partial'],
      bar: 'Competitive Field', barsub: 'Who is already there',
      actions: [{ id: 'f7Csv', label: '↓ Companies CSV' }, { id: 'f7Watch', label: 'Competitor Watch ↗', title: 'Ads and pages for the selected company (module 13)' }] }) +
      `<div class="wrap">
      ${callout('', 'Read this first: three counts, three denominators', `The <b>${N(COMP.length)} mapped companies</b> are roofers that market across a city, a region or the state; ${N(META.ncomp_ver)} were checked against their own websites on October 6, 2026 (offices, service cities, lines, certifications, financing, Spanish pages), the rest come from public listings and are flagged. <b>Roofing contractors</b> (${N(META.cbp.est)} establishments with employees in County Business Patterns 2023, NAICS 238160, and ${N(META.nes.est2381)} nonemployer firms in the exterior trades) measure the whole local trade. <b>License records</b> (${N(META.lic.n)} roofing records held by ${N(META.lic.firms)} companies) show who may legally sell residential roofing of $7,500 or more, wherever they are based. <b>Competitive pressure</b> blends the mapped companies (60%, weighted by reach and distance) with the local contractors and licenses (40%). None of this measures ad spend; module 13 watches the ads themselves.`)}
      <div class="kpis" id="f7Kpis"></div>
      <div class="controls">
        <div class="ctl"><label class="fl" for="f7Layer">Map layer</label><select id="f7Layer"><option value="comp_pct">Competitive pressure percentile</option><option value="comp_n25">Mapped roofers within 25 km</option><option value="roof_per10k">Roofing contractors and licenses per 10,000 residents</option><option value="ws">Whitespace: profit pool where few roofers reach</option></select></div>
        <div class="ctl"><label class="fl" for="f7Seg">Market</label><select id="f7Seg"><option value="">Residential and commercial</option><option value="res">Residential roofers</option><option value="comm">Commercial roofers</option></select></div>
        <div class="ctl"><label class="fl" for="f7Line">Companies marketing</label><select id="f7Line"><option value="">Any line</option>${PL.map(l => `<option value="${l.key}">${esc(l.name)}</option>`).join('')}</select></div>
        <div class="ctl"><span class="fl">Reach</span><div class="chips" id="f7Tiers">${['statewide', 'national', 'regional', 'local'].map(t => `<button type="button" class="chip on" data-t="${t}" aria-pressed="true">${t}</button>`).join('')}</div></div>
      </div>
      <div class="grid2">
        <div class="card mapcard"><div id="f7Map"></div><div class="legend" id="f7Leg"></div></div>
        <div class="stack">
          <div class="card"><div class="card-h" style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start"><div><h3 id="f7Name">The field</h3><p id="f7Sub">Click an office marker or a company</p></div><span class="pill" id="f7Pill"></span></div><div class="card-b" id="f7Detail"></div></div>
        </div>
      </div>
      ${card('The companies', 'Every mapped roofing company. Click a row to open it. Reach weights the pressure surface: statewide 3, national 2.5, regional 1.5, local 1.', '<div class="tscroll" id="f7Tbl"></div>', 'mt')}
      <div class="split">
        ${card('Whitespace: job flow the field does not reach', 'Scored ZIPs with no mapped roofer office within 25 km, ranked by gross profit pool. Most are rural; a few are suburbs between metros.', '<div class="tscroll short" id="f7Ws"></div>')}
        ${card('The local trade by parish', 'Roofing contractors, license records and mapped company offices by parish.', '<div class="tscroll short" id="f7Par"></div>')}
      </div>
      <div class="split">
        ${card('The license roster', 'LSLBC roofing license records by the license holder\'s city: who may sell residential roofing of $7,500 or more, and where they are based.', '<div id="f7Lic"></div><p class="chartnote" id="f7LicN"></p>')}
        ${card('Certifications, financing and Spanish', 'What the verified companies show on their own sites.', '<div id="f7Cert"></div><p class="chartnote" id="f7CertN"></p>')}
      </div>
      <div class="split">
        ${card('What the field means for a campaign', 'How to read pressure, reach and whitespace.', '<div id="f7Mean"></div>')}
        ${card('Judgment calls and sources', 'How the list was built and what it misses.', '<div id="f7Src"></div>')}
      </div>
      <div class="foot" id="f7Foot"></div></div>`;
    $('#f7Kpis', root).innerHTML = kpiHTML([
      { l: 'Mapped roofing companies', g: 'C', v: N(COMP.length), d: `${N(META.ncomp_ver)} verified; ${N(COMP.filter(c => c.seg === 'comm').length)} commercial specialists` },
      { l: 'Statewide and national', g: 'C', v: N(COMP.filter(c => c.tier === 'statewide' || c.tier === 'national').length), d: 'the brands on television, billboards and trucks' },
      { l: 'Offices mapped', g: 'C', v: N(offN), d: `in ${N(new Set(COMP.flatMap(c => c.offices.map(o => o.city))).size)} cities` },
      { l: 'Out of state licenses', g: 'B', v: P(META.lic.out / META.lic.n * 100, 0), d: `${N(META.lic.out)} of ${N(META.lic.n)} roofing license records` },
      { l: 'Companies with Spanish pages', g: 'C', v: N(COMP.filter(c => c.spanish).length), d: 'of the mapped sites; an open lane' },
      { l: 'Whitespace ZIPs', g: 'C', v: N(ws.length), d: `${N(sum(ws.map(z => z.pop)))} residents with no mapped office within 25 km` },
    ]);
    const firmOk = c => st.tiers.has(c.tier) && (!st.line || (c.lines || []).includes(st.line)) && (!st.seg || c.seg === st.seg || c.seg === 'both');
    const map = new ZipMap($('#f7Map', root), { segHit: 'none', roads: false, onSelect: z => { st.zip = st.zip === z ? null : z; st.sel = null; render(); },
      onHover: (z, e) => { const r = ZI[z]; if (!r || !r.res_ok) return; showTip(`<div class="tt">${esc(r.zip)} · ${esc(r.city)}</div><div class="ts">${esc(r.cty)} Parish</div>${tipRow('Competitive pressure percentile', D(r.comp_pct, 0))}${tipRow('Mapped roofers within 25 km', N(r.comp_n25))}${tipRow('Roofing contractors in the ZIP', N(r.roofers))}${tipRow('Gross profit pool a year', MM(r.fees))}`, e); },
      onPin: id => { st.sel = +String(id).split(':')[0]; st.zip = null; render(); }, onPinHover: (id, e) => { const [ci, oi] = String(id).split(':').map(Number); const c = COMP[ci], o = c.offices[oi]; showTip(`<div class="tt">${esc(c.name)}</div><div class="ts">${esc(o.city)} · ${esc(c.tier)}${o.hq ? ' · headquarters' : ''}</div>${tipRow('Market', SEG_L[c.seg] || '')}${tipRow('Offices', N(c.offices.length))}${tipRow('Lines marketed', N((c.lines || []).length))}<div class="tf">${c.verified ? 'Verified on the company\'s site' : 'From public listings; confirm before use'}</div>`, e); } });
    function render() {
      let sc, f, lab, note, g = 'C';
      if (st.layer === 'ws') { const vals = ZR.map(z => (z.comp_n25 || 0) <= 1 ? z.fees : null); sc = qScale(vals, 'green', 1); map.fill(zip => { const z = ZI[zip]; if (!z || !z.res_ok) return null; return (z.comp_n25 || 0) <= 1 ? sc.f(z.fees) : cssv('--sunk'); }); f = MM; lab = 'Gross profit pool where at most one mapped roofer reaches (25 km)'; note = 'ZIPs with two or more mapped roofers within 25 km are drawn flat.'; g = 'D'; const v = vals.filter(isN); $('#f7Leg', root).innerHTML = legendHTML({ title: lab, R: sc.R, lo: f(Math.min(...v)), hi: f(Math.max(...v)), note: `<b>Darker is more job value with a thin field.</b> ${note} ${G(g)}` }); }
      else { const vals = ZR.map(z => z[st.layer]); sc = qScale(vals, 'teal', 1); map.fill(zip => { const z = ZI[zip]; if (!z || !z.res_ok) return null; return sc.f(z[st.layer]); }); f = st.layer === 'roof_per10k' ? (v => D(v, 1)) : (v => D(v, 0)); lab = { comp_pct: 'Competitive pressure percentile', comp_n25: 'Mapped roofers within 25 km', roof_per10k: 'Roofing contractors and license records per 10,000 residents' }[st.layer]; const v = vals.filter(isN); $('#f7Leg', root).innerHTML = legendHTML({ title: lab, R: sc.R, lo: f(Math.min(...v)), hi: f(Math.max(...v)), note: `<b>Darker is more crowded.</b> Diamonds are headquarters, circles other offices; size follows reach. ${G(st.layer === 'roof_per10k' ? 'B' : 'C')}` }); }
      map.select(st.zip);
      map.pins(COMP.flatMap((c, i) => firmOk(c) ? c.offices.map((o, j) => ({ id: i + ':' + j, lat: o.lat, lon: o.lon, r: 2.6 + TIERW[c.tier] * 0.9, fill: i === st.sel ? cssv('--accent') : cssv('--ink'), shape: o.hq ? 'diamond' : '', op: i === st.sel ? 1 : .78, sel: i === st.sel })) : []));
      drawDetail(); drawTable();
    }
    function drawTable() {
      const rows = COMP.map((c, i) => ({ c, i, name: c.name, tier: c.tier, seg: SEG_L[c.seg] || '', hq: c.hq, off: c.offices.length, cities: (c.cities || []).length, lines: (c.lines || []).length, cert: (c.cert || []).join(', '), fin: c.fin, sp: c.spanish, ver: c.verified })).filter(r => firmOk(r.c));
      dataTable($('#f7Tbl', root), [{ k: 'name', h: 'Company', l: 1, f: (v, r) => `<b>${esc(v)}</b>${r.ver ? '' : ' <span class="pill">listing</span>'}` }, { k: 'tier', h: 'Reach', l: 1 }, { k: 'seg', h: 'Market', l: 1 }, { k: 'hq', h: 'Headquarters', l: 1 }, { k: 'off', h: 'Offices', f: v => N(v) }, { k: 'cities', h: 'Cities served', f: v => N(v) }, { k: 'ln', h: 'Marketed lines', l: 1, v: r => (r.c.lines || []).map(k => PLI[k] ? PLI[k].short : k).join(', '), f: v => `<span class="mini">${esc(v)}</span>` }, { k: 'cert', h: 'Manufacturer programs', l: 1, f: v => `<span class="mini">${esc(v || '—')}</span>` }, { k: 'fin', h: 'Financing', f: v => v ? 'Yes' : '—' }, { k: 'sp', h: 'Spanish', f: v => v ? 'Yes' : '—' }],
        rows, { sortKey: 'off', id: r => r.i, onClick: i => { st.sel = +i; st.zip = null; render(); window.scrollTo({ top: $('#f7Map', root).getBoundingClientRect().top + scrollY - 120, behavior: 'smooth' }); }, rowClass: r => r.i === st.sel ? 'sel' : '' });
    }
    function drawDetail() {
      const box = $('#f7Detail', root);
      if (st.sel != null) {
        const c = COMP[st.sel]; $('#f7Name', root).textContent = c.name; $('#f7Sub', root).textContent = `${c.hq} · ${c.tier} · ${SEG_L[c.seg] || ''} · ${N(c.offices.length)} office${c.offices.length === 1 ? '' : 's'}`; $('#f7Pill', root).textContent = c.verified ? 'Verified' : 'Listing';
        const reach = ZR.filter(z => c.offices.some(o => kmLL(z.lat, z.lon, o.lat, o.lon) <= 25)); const fees = sum(reach.map(z => z.fees));
        box.innerHTML = `<div class="rowl"><span>Website</span><b><a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.domain)}</a></b></div>
          <div class="rowl"><span>Offices</span><b style="white-space:normal">${esc(c.offices.map(o => o.city + (o.hq ? ' (HQ)' : '')).join(', '))}</b></div>
          <div class="rowl"><span>Lines marketed</span><b style="white-space:normal">${esc((c.lines || []).map(k => PLI[k] ? PLI[k].short : k).join(', '))}</b></div>
          ${(c.cities || []).length ? `<div class="rowl"><span>Cities it says it serves</span><b style="white-space:normal">${esc((c.cities || []).join(', '))}</b></div>` : ''}
          <div class="rowl"><span>Manufacturer programs · financing · Spanish pages</span><b style="white-space:normal">${esc((c.cert || []).join(', ') || 'none shown')} · ${c.fin ? 'yes' : 'none shown'} · ${c.spanish ? 'yes' : 'none found'}</b></div>
          ${c.phone ? `<div class="rowl"><span>Phone on the site</span><b>${esc(c.phone)}</b></div>` : ''}
          <div class="rowl"><span>Scored ZIPs within 25 km of an office</span><b>${N(reach.length)} · ${MM(fees)} profit pool</b></div>
          ${c.title ? `<div class="dsec">Their site, as read ${esc(c.asof || '')}</div><div class="adprev"><div class="ah">${esc(c.title)}</div><div class="ad">${esc(c.desc || '')}</div>${c.h1 ? `<div class="mini">H1: ${esc(String(c.h1).replace(/\s+/g, ' '))}</div>` : ''}</div>` : ''}
          ${c.notes ? `<p class="mini" style="margin-top:6px">${esc(c.notes)}</p>` : ''}
          ${(c.social || []).filter(x => !/facebook\.com\/tr\b/.test(x)).length ? `<p class="mini">${(c.social || []).filter(x => !/facebook\.com\/tr\b/.test(x)).map(esc).join(' · ')}</p>` : ''}
          <div class="dsec">Watch their ads</div><div style="display:flex;gap:6px;flex-wrap:wrap">${firmLinks(c).map(([l, u]) => `<a class="ibtn" href="${esc(u)}" target="_blank" rel="noopener">${esc(l)} ↗</a>`).join('')}<button class="ibtn" id="f7W">Competitor Watch ↗</button></div>
          <p class="mini" style="margin-top:8px">Claims on competitor sites (years in business, ratings, certifications, warranties) are theirs, quoted as found. Never use a competitor's name, slogan or certification in your own ads; comparisons need substantiation (R.S. 51:1405), and a manufacturer certification may be named only as its program allows (Satchel CERT1).</p>`;
        $('#f7W', root).onclick = () => goModule('watch', { comp: st.sel });
        return;
      }
      if (st.zip && ZI[st.zip]) {
        const z = ZI[st.zip]; $('#f7Name', root).textContent = `${z.zip} · ${z.city}`; $('#f7Sub', root).textContent = `${z.cty} Parish`; $('#f7Pill', root).textContent = 'ZIP';
        const near = COMP.map((c, i) => ({ c, i, d: Math.min(...c.offices.map(o => kmLL(z.lat, z.lon, o.lat, o.lon))) })).filter(o => o.d <= 60).sort((a, b) => a.d - b.d);
        const serves = COMP.filter(c => (c.cities || []).includes(z.city));
        box.innerHTML = `<div class="rowl"><span>Competitive pressure percentile</span><b>${D(z.comp_pct, 0)}</b></div><div class="rowl"><span>Roofing contractors and licenses per 10,000 residents</span><b>${D(z.roof_per10k, 1)}</b></div><div class="rowl"><span>Contractors in the ZIP (Business Patterns) · license records</span><b>${N(z.roofers)} · ${D(z.lic, 0)}</b></div><div class="dsec">Mapped roofers within 60 km</div>${near.map(o => `<div class="rowl"><span>${esc(o.c.name)}</span><b>${D(o.d, 0)} km</b></div>`).join('') || '<p class="mini">None within 60 km.</p>'}${serves.length ? `<div class="dsec">Companies that list ${esc(z.city)} as a service city</div><p class="mini">${serves.map(c => esc(c.name)).join(', ')}</p>` : ''}`;
        return;
      }
      $('#f7Name', root).textContent = 'The field'; $('#f7Sub', root).textContent = 'Click an office marker, a ZIP or a company'; $('#f7Pill', root).textContent = 'State';
      const byHQ = {}; COMP.forEach(c => byHQ[c.hq] = (byHQ[c.hq] || 0) + 1);
      box.innerHTML = `<div class="dsec" style="margin-top:0">Headquarters</div>${Object.entries(byHQ).sort((a, b) => b[1] - a[1]).map(([h, n]) => `<div class="rowl"><span>${esc(h)}</span><b>${N(n)}</b></div>`).join('')}<div class="dsec">Lines marketed by the mapped companies</div>${PL.map(l => `<div class="rowl"><span>${esc(l.name)}</span><b>${N(LINE_FIRMS(l.key).length)}</b></div>`).join('')}`;
    }
    dataTable($('#f7Ws', root), [{ k: 'zip', h: 'ZIP', l: 1, f: v => `<b>${esc(v)}</b>` }, { k: 'city', h: 'City', l: 1 }, { k: 'cty', h: 'Parish', l: 1 }, { k: 'roofs', h: 'Roofs', f: v => N(v) }, { k: 'fees', h: 'Profit pool', f: v => MM(v) }, { k: 'near', h: 'Nearest roofer', v: z => Math.min(...COMP.flatMap(c => c.offices.map(o => kmLL(z.lat, z.lon, o.lat, o.lon)))), f: v => D(v, 0) + ' km' }], ZR.filter(z => (z.comp_n25 || 0) === 0), { sortKey: 'fees', id: r => r.zip, onClick: z => { st.zip = z; st.sel = null; map.fitTo([z]); render(); } });
    const parRows = PA.map(p => ({ p, name: p.name, pop: p.pop, cbp: p.cbp_roof, zbp: p.roofers, lic: p.lic, per: ((p.cbp_roof != null ? p.cbp_roof : p.roofers) + (p.lic || 0)) / p.pop * 1e4, off: p.comp }));
    dataTable($('#f7Par', root), [{ k: 'name', h: 'Parish', l: 1, f: v => `<b>${esc(v)}</b>` }, { k: 'pop', h: 'Residents', f: v => N(v) }, { k: 'cbp', h: 'Contractors (county)', f: v => v != null ? N(v) : '—', t: 'County Business Patterns 2023, NAICS 238160; published for 18 parishes' }, { k: 'lic', h: 'Licenses', f: v => D(v, 0) }, { k: 'per', h: 'Per 10k', f: v => D(v, 1) }, { k: 'off', h: 'Mapped offices', f: v => N(v) }], parRows, { sortKey: 'per' });
    const LT = META.lic.top.slice(0, 15);
    hbarChart($('#f7Lic', root), LT.map(([c, n]) => ({ l: c, v: n, t: N(n), color: ramp('teal')[5] })).concat([{ l: 'Out of state', v: META.lic.out, t: N(META.lic.out), color: catColor(4) }]), { W: 520, L: 130, R: 50, rowH: 21, aria: 'Roofing license records by city of the holder' });
    $('#f7LicN', root).innerHTML = `${N(META.lic.n)} roofing license records are held by ${N(META.lic.firms)} companies; ${N(META.lic.inla)} records belong to Louisiana addresses and ${N(META.lic.out)} (${P(META.lic.out / META.lic.n * 100, 0)}) to companies based out of state, more than Baton Rouge, Metairie, New Orleans and Shreveport combined. Out of state holders are legal when licensed, but they are the storm chasers owners fear: a local office, local references, permits pulled in the parish and the license number on every ad are the answer (Satchel STORM1). Since August 1, 2026 even advertising residential roofing of $7,500 or more requires the license. ${G('B')}`;
    const ver = COMP.filter(c => c.verified); const cc = {}; ver.forEach(c => (c.cert || []).forEach(x => cc[x] = (cc[x] || 0) + 1));
    const crow = [['Any manufacturer program', ver.filter(c => (c.cert || []).length).length]].concat(Object.entries(cc).sort((a, b) => b[1] - a[1])).concat([['Financing offered', ver.filter(c => c.fin).length], ['Spanish pages', ver.filter(c => c.spanish).length], ['Residential lines', ver.filter(c => c.seg !== 'comm').length], ['Commercial lines', ver.filter(c => c.seg !== 'res').length]]);
    hbarChart($('#f7Cert', root), crow.map(([l, n]) => ({ l, v: n, t: `${N(n)} of ${N(ver.length)}`, color: ramp('green')[6] })), { W: 520, L: 190, R: 70, rowH: 22, max: ver.length, aria: 'Certifications, financing and Spanish among verified companies' });
    $('#f7CertN', root).innerHTML = `Of the ${N(ver.length)} verified companies, ${N(ver.filter(c => (c.cert || []).length).length)} show a manufacturer program (shingle maker certifications that carry longer warranties), ${N(ver.filter(c => c.fin).length)} advertise financing and ${N(ver.filter(c => c.spanish).length)} have Spanish pages. Certifications are a trust signal owners recognize; claim one only while it is current and in the program's own words. Financing ads need Regulation Z disclosures (module 03).`;
    $('#f7Mean', root).innerHTML = proseTable([
      ['<b>The statewide tier</b>', `${COMP.filter(c => c.tier === 'statewide' || c.tier === 'national').map(c => c.name).join(', ')} market across several metros and are the most visible roofing brands in the state. Competing on volume terms ("roofing company", "roof replacement") in their home cities buys the most contested clicks; compete on the lines, towns and languages they underserve, and check where they actually buy in module 13.`],
      ['<b>Spanish is open</b>', `${N(COMP.filter(c => c.spanish).length)} of the mapped roofers show Spanish pages, while ${CITIES.slice().sort((a, b) => b.span - a.span).slice(0, 4).map(c => `${c.name} (${K(c.span)})`).join(', ')} hold the most residents who speak Spanish at home. A complete Spanish build, with the license number and the deductible and cancellation notices in Spanish, is a clear opening.`],
      ['<b>Thin lines</b>', `${PL.map(l => [l, LINE_FIRMS(l.key).length]).sort((a, b) => a[1] - b[1]).slice(0, 3).map(([l, n]) => `${l.name} (${n} compan${n === 1 ? 'y' : 'ies'})`).join(', ')} are marketed by the fewest mapped companies. These lines reward a strong page and builder, property manager or insurer agent relationships more than bids.`],
      ['<b>Where the whitespace is</b>', `Whitespace ZIPs (no mapped office within 25 km) concentrate in ${REG_KEYS.map(k => [k, ws.filter(z => PA[z.pi].reg === k).length]).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => `${REGN[k]} (${n})`).join(', ')}. Rural job flow is smaller per ZIP, but roofs there are often older, mobile homes and metal are common, and the next storm brings out of state crews; a regional company with a local address wins them.`],
      ['<b>Pressure is not price</b>', 'The pressure surface feeds the cost model in module 05; actual auction prices arrive with account data (module 15). After a hurricane, storm crews flood the footprint and prices jump for weeks.'],
    ]);
    $('#f7Src', root).innerHTML = proseTable([
      ['Verified companies', `${N(META.ncomp_ver)} company websites were read on October 6, 2026 for offices, service cities, lines, certifications, financing and Spanish pages; titles and descriptions are quoted as found.`],
      ['Listing companies', 'The rest are known roofers whose sites blocked automated reads or were not checked; their offices come from public listings and are flagged "listing".'],
      ['Office geocodes', 'Offices sit at the city center, not the street address; distances are city to ZIP centroid.'],
      ['Missing companies', 'Hundreds of local roofers are not mapped individually; the Business Patterns and license counts carry them.'],
      ['License roster', 'Records come from a public mirror of LSLBC license data, grouped by the holder\'s mailing city. A company can hold several records (classifications and related entities), so records outnumber companies.'],
    ]) + srcRows([
      ['Company sites', 'Roofing company websites as read October 6, 2026', 'C', 'Oct 2026', ''],
      ['Contractors', 'County and ZIP Business Patterns 2023, NAICS 238160 Roofing Contractors; Nonemployer Statistics 2024, NAICS 2381', 'A', '2023 and 2024', 'https://www.census.gov/programs-surveys/cbp.html'],
      ['Licenses', 'LSLBC roofing license records via a public mirror; check any company on the LSLBC contractor search', 'B', 'Oct 2026', 'https://lslbc.gov/'],
    ]);
    $('#f7Foot', root).innerHTML = `<b style="color:var(--ink)">Uplift Louisiana Roofing Atlas</b>, module 07. Company names and claims are quoted from public sources for competitive research. Compiled October 6, 2026.`;
    $('#f7Layer', root).onchange = e => { st.layer = e.target.value; render(); };
    $('#f7Line', root).onchange = e => { st.line = e.target.value; render(); };
    $('#f7Seg', root).onchange = e => { st.seg = e.target.value; render(); };
    $$('#f7Tiers [data-t]', root).forEach(b => b.onclick = () => { const t = b.dataset.t; if (st.tiers.has(t)) { if (st.tiers.size > 1) st.tiers.delete(t); } else st.tiers.add(t); $$('#f7Tiers [data-t]', root).forEach(x => { const on = st.tiers.has(x.dataset.t); x.classList.toggle('on', on); x.setAttribute('aria-pressed', String(on)); }); render(); });
    $('#f7Csv', root).onclick = () => saveFile('louisiana-roofing-companies.csv', toCSV(['company', 'domain', 'reach', 'market', 'headquarters', 'offices', 'office_cities', 'service_cities', 'lines', 'manufacturer_programs', 'financing', 'spanish_pages', 'verified', 'as_of'], COMP.map(c => [c.name, c.domain, c.tier, SEG_L[c.seg] || '', c.hq, c.offices.length, c.offices.map(o => o.city).join('; '), (c.cities || []).join('; '), (c.lines || []).join('; '), (c.cert || []).join('; '), c.fin ? 'yes' : 'no', c.spanish ? 'yes' : 'no', c.verified ? 'yes' : 'listing', c.asof || '']), 'Uplift Louisiana Roofing Atlas, module 07. Public sources; listing companies not verified.'));
    $('#f7Watch', root).onclick = () => goModule('watch', st.sel != null ? { comp: st.sel } : {});
    BUS.on('theme', () => render());
    this.receive = p => { if (p && p.comp != null && COMP[p.comp]) { st.sel = +p.comp; st.zip = null; render(); } };
    render();
  }
});