/* ==== 23_m11_regions.js ==== */
/* ==== m11_regions ==== */
"use strict";
/* ============================ Module 11: California Regions ============================ */
/* Every figure on this tab is computed from the atlas data when the tab opens: county tables are summed, ZIP columns are averaged with
   homes or residents as weights, and a measure whose column is not in the data is left out rather than typed in. The only typed things
   are names: the Nielsen media markets and the cities they are named for. */
registerModule({
  key: 'regions', num: '11', title: 'California Regions', desc: 'Each region on its own: counties, people, homes and roofs, weather and fire, insurance, licenses and competition, media markets and languages',
  mount(root) {
    const st = { r: null, m: 'ra20' };
    const CUR = +String(META.compiled || '2026').slice(0, 4);
    const NR = REG_KEYS.length, NC = CO.length;
    /* first column of the ZIP table that exists under one of these names (hazard column names are the hazard build's to choose) */
    const col = (...names) => names.find(n => ZC.includes(n)) || names.find(n => Z.some(z => z[n] != null)) || null;
    const C = {
      rain: col('rain_in', 'rain_yr', 'prcp_in'), rd1: col('rd1', 'rain1', 'rday1', 'rain_d1'), ar: col('ar_days', 'ar2', 'ard', 'ar_yr'), gust: col('g58', 'gust58', 'gd58'), gust40: col('g40', 'gust40', 'gd40'), lsr: col('wd58'),
      heat: col('heat100', 'h100', 'hd100'), heat110: col('heat110', 'h110', 'hd110'), snow: col('snow_psf', 'snow_load', 'pg'), hail: col('hd1', 'hail1'),
      fhsz: col('fhsz_sh', 'fhsz_hv', 'fhsz_hvh'), vh: col('fhsz_vh', 'fhsz_vh_sh', 'vh_sh'), hi: col('fhsz_high', 'fhsz_h', 'fhsz_hi', 'fhsz_h_sh'), mod: col('fhsz_m', 'fhsz_mod', 'fhsz_m_sh'),
      dest: col('fire_dest'), dmgd: col('fire_dmg'), last: col('lastfire'), coast: col('coast_km', 'coastkm', 'dcoast', 'coast'),
      tile: col('tile_sh'), wood: col('wood_sh'), fair: col('fair_sh'), wfhi: col('wf_hi_sh'), prem: col('prem'),
    };
    /* media markets by principal city: the one table in 17_m05_paid.js (MEDIA_MARKETS, REG_MARKETS), shared with module 05 */
    const MKT = REG_MARKETS, BORDER = MEDIA_BORDER; const mktTxt = regMktTxt, mktShort = regMktShort;
    const INS = DATA.ins || {}; const IY = INS.years || [];
    const last = a => Array.isArray(a) && a.length ? a[a.length - 1] : null; const first = a => Array.isArray(a) && a.length ? a[0] : null;
    const maxKey = o => { const ks = Object.keys(o || {}).map(Number).filter(isN); return ks.length ? Math.max(...ks) : null; };
    const RG = REG_KEYS.map(k => {
      const ps = CO.filter(p => p.reg === k), pis = new Set(ps.map(p => p.i)), zs = ZR.filter(z => pis.has(z.pi)), zall = Z.filter(z => pis.has(z.pi));
      const s = f => sum(ps.map(p => p[f] || 0)); const has = f => ps.some(p => isN(p[f])); const sn = f => has(f) ? s(f) : null; const pop = s('pop'), hu = s('hu');
      const zsum = c => c ? sum(zall.map(z => z[c] || 0)) : null;
      const wm = (c, w) => { if (!c) return null; let a = 0, t = 0; zall.forEach(z => { const ww = z[w || 'hu']; if (isN(z[c]) && ww > 0) { a += z[c] * ww; t += ww; } }); return t ? a / t : null; };
      const zmax = c => { if (!c) return null; const v = zall.map(z => z[c]).filter(isN); return v.length ? Math.max(...v) : null; };
      const hist = {}; ps.forEach(p => Object.entries(p.hist || {}).forEach(([y, a]) => { const h = hist[y] = hist[y] || [0, 0]; h[0] += a[0] || 0; h[1] += a[1] || 0; }));
      const firms = COMP.filter(c => (c.offices || []).some(o => { if (!isN(o.lat)) return false; let best = null, bd = 1e9; CO.forEach(p => { const c2 = (GEO.pcent || {})[p.fips]; if (!c2) return; const d = kmLL(o.lat, o.lon, c2[1], c2[0]); if (d < bd) { bd = d; best = p; } }); return best && best.reg === k; }));
      const ib = (INS.region || {})[k] || (INS.region || {})[String(k)] || null;
      const fair = ib && last(ib.fair_pif) != null ? last(ib.fair_pif) : sn('fair_pif'); const fair0 = ib && first(ib.fair_pif) != null ? first(ib.fair_pif) : sn('fair_pif22');
      const ny = ib ? maxKey(ib.nonren) : null; const nonren = ib && ny ? ib.nonren[ny] : sn('nonren'); const renewed = ib && ny && ib.renewed ? ib.renewed[ny] : null;
      const lic = sn('lic') != null ? s('lic') : zsum(col('lic'));
      const o = { k, key: (META.model.REGK || {})[k] || '', name: REGN[k], ps, zs, zall, pop, hu, nzip: zs.length, nzall: zall.length, area: s('aland') / 2.58999e6,
        roofs: s('roofs'), ra20: s('ra20'), ra25: sn('ra25'), wave: s('wave'), nxt: s('nxt'), nxt_t: sn('nxt_t'), tile_n: sn('tile_n') != null ? s('tile_n') : zsum(col('tile_n')), mh: s('mh'), cru: s('cru'), seas: s('seas'), fema: s('fema_k'), hist,
        rain: wm(C.rain), rd1: wm(C.rd1), ar: wm(C.ar), gust: wm(C.gust), gust40: wm(C.gust40), heat: wm(C.heat), heat110: wm(C.heat110), snow: wm(C.snow), snowMax: zmax(col('snow_max_psf')) != null ? Math.max(zmax(col('snow_max_psf')), zmax(C.snow) || 0) : zmax(C.snow), lsr: wm(C.lsr), hail: wm(C.hail),
        fhsz: C.fhsz ? wm(C.fhsz) : (C.vh && C.hi ? wm(C.vh) + wm(C.hi) : null), vh: wm(C.vh), hi: wm(C.hi), mod: wm(C.mod), dest: zsum(C.dest), dmgd: zsum(C.dmgd), lastfire: zmax(C.last),
        coast: C.coast ? (() => { let a = 0, t = 0; zall.forEach(z => { if (isN(z[C.coast]) && z.hu > 0) { t += z.hu; if (z[C.coast] <= 5) a += z.hu; } }); return t ? a / t * 100 : null; })() : null,
        wood: wm(C.wood, 'roofs'), fair, fair0, fairX: fair0 > 0 ? fair / fair0 : null, fairR: hu ? fair / hu * 100 : null, nonren, nonrenY: ny || (sn('nonren') != null ? 2023 : null), nonrenSh: renewed != null && renewed + nonren > 0 ? nonren / (renewed + nonren) * 100 : wm(col('nonren_sh'), 'hu'),
        wfhi: ib && isN(ib.wf_hi_sh) ? ib.wf_hi_sh : wm(C.wfhi), prem: wm(C.prem), wfloss: sn('wf_loss'), wfclaims: sn('wf_claims'),
        bps25: sum(ps.map(p => ((p.bps || {})['2025'] || [])[1] || 0)), ytd26: s('ytd26'), ytd25: s('ytd25'),
        fees: sum(zs.map(z => z.fees || 0)), firms, cbp: s('cbp_roof'), cbpGaps: ps.filter(p => !isN(p.cbp_roof)).length, lic, adj: s('adjusters'), agents: s('ins_agents'),
        span: s('spanish') / Math.max(1, s('pop5')) * 100, chin: sn('chin') != null ? s('chin') / Math.max(1, s('pop5')) * 100 : null, viet: s('viet') / Math.max(1, s('pop5')) * 100, tagalog: sn('tagalog') != null ? s('tagalog') / Math.max(1, s('pop5')) * 100 : null, korean: sn('korean') != null ? s('korean') / Math.max(1, s('pop5')) * 100 : null,
        s65: s('a65p') / Math.max(1, pop) * 100, inc: median(ps.map(p => p.inc).filter(isN)), mort: wm(col('mort_sh'), 'hu'), own: s('own') / Math.max(1, s('occ')) * 100,
        cities: CITIES.filter(c => pis.has(c.pi)).sort((a, b) => b.pop - a.pop), dma: (META.model.DMA || {})[k], cpc: mean(zs.map(z => z.cpc_rel).filter(isN)) };
      o.ra20sh = o.roofs ? 100 * o.ra20 / o.roofs : null; o.ra25sh = o.roofs && o.ra25 != null ? 100 * o.ra25 / o.roofs : null; o.wavesh = o.roofs ? 100 * o.wave / o.roofs : null; o.nxtK = o.roofs ? 1000 * o.nxt / o.roofs : null; o.femaR = o.hu ? 100 * o.fema / o.hu : null;
      o.tileSh = o.roofs && o.tile_n != null ? 100 * o.tile_n / o.roofs : wm(C.tile, 'roofs'); o.destK = o.hu && o.dest != null ? 1000 * o.dest / o.hu : null; o.licK = pop && o.lic != null ? o.lic / pop * 1e4 : null; o.roofsPer = o.lic ? o.roofs / o.lic : null;
      o.lines = {}; LINE_KEYS.forEach(l => o.lines[l] = sum(zs.map(z => z['p_' + l] || 0)));
      return o;
    });
    const RGI = {}; RG.forEach(o => RGI[o.k] = o);
    const SP = sum(RG.map(o => o.pop)); const stLine = {}; LINE_KEYS.forEach(l => stLine[l] = sum(RG.map(o => o.lines[l])) / SP);
    const ST = { pop: SP, hu: sum(RG.map(o => o.hu)), roofs: sum(RG.map(o => o.roofs)), ra20: sum(RG.map(o => o.ra20)), fair: sum(RG.map(o => o.fair || 0)), dest: sum(RG.map(o => o.dest || 0)), lic: sum(RG.map(o => o.lic || 0)) };
    /* measures: label, value, format, grade. A measure with no value in any region is dropped from every menu and table */
    const RM0 = {
      ra20: { l: 'Roofs 20 years or older (% of one unit roofs, model)', f: o => o.ra20sh, fmt: v => P(v, 1), g: 'B' },
      ra25: { l: 'Roofs 25 years or older (% of one unit roofs, model)', f: o => o.ra25sh, fmt: v => P(v, 1), g: 'B' },
      wave: { l: 'Roofs reaching 20 within five years (% of one unit roofs, model)', f: o => o.wavesh, fmt: v => P(v, 1), g: 'B' },
      nxt: { l: 'Age driven replacements next 12 months per 1,000 roofs (model)', f: o => o.nxtK, fmt: v => D(v, 1), g: 'B' },
      tile: { l: 'Tile roofs (% of one unit roofs, model)', f: o => o.tileSh, fmt: v => P(v, 1), g: 'D' },
      rain: { l: 'Rain in a normal year (inches, home weighted)', f: o => o.rain, fmt: v => D(v, 1), g: 'A' },
      ar: { l: 'Atmospheric river days a year (home weighted)', f: o => o.ar, fmt: v => D(v, 1), g: 'B' },
      gust: { l: 'Days a year with gusts of 58 mph or more at the nearest screened station (home weighted)', f: o => o.gust, fmt: v => D(v, 2), g: 'B' },
      heat: { l: 'Days a year at 100 F or more (home weighted)', f: o => o.heat, fmt: v => D(v, 1), g: 'A' },
      snow: { l: 'Design ground snow load (pounds per square foot, home weighted)', f: o => o.snow, fmt: v => D(v, 0), g: 'C' },
      fhsz: { l: 'Share of ZIP area in High or Very High Fire Hazard Severity Zones (home weighted %)', f: o => o.fhsz, fmt: v => P(v, 1), g: 'A' },
      dest: { l: 'Structures destroyed by wildfire per 1,000 homes, on record', f: o => o.destK, fmt: v => D(v, 2), g: 'A' },
      fair: { l: 'FAIR Plan residential policies per 100 homes', f: o => o.fairR, fmt: v => D(v, 1), g: 'A' },
      nonren: { l: 'Policies not renewed (% of policies up for renewal)', f: o => o.nonrenSh, fmt: v => P(v, 1), g: 'A' },
      lic: { l: 'Active C-39 roofing licenses per 10,000 residents', f: o => o.licK, fmt: v => D(v, 2), g: 'A' },
      fees: { l: 'Gross profit pool per resident ($ a year, model)', f: o => o.fees / o.pop, fmt: v => M$(v), g: 'C' },
      cpc: { l: 'Mean relative cost per click', f: o => o.cpc, fmt: v => D(v, 2) + '×', g: 'D' },
      span: { l: 'Speak Spanish at home (%)', f: o => o.span, fmt: v => P(v, 1), g: 'A' } };
    const RM = {}; Object.entries(RM0).forEach(([k, m]) => { if (RG.some(o => isN(m.f(o)))) RM[k] = m; });
    if (!RM[st.m]) st.m = Object.keys(RM)[0];
    const rankOf = (f, o) => { const v = RG.map(f).filter(isN).sort((a, b) => b - a); const x = f(o); return isN(x) ? v.indexOf(x) + 1 : null; };
    const top = (f, dir) => RG.filter(o => isN(f(o))).sort((a, b) => dir * (f(b) - f(a)))[0];
    /* a region's roofing character: the measures on which it stands first or second among the regions, in words, with the figure */
    const TRAITS = [
      [o => o.rain, v => `wet: ${D(v, 0)} inches of rain in a normal year`], [o => o.ar, v => `${D(v, 0)} atmospheric river days a year`], [o => o.snowMax, v => `snow country: design ground snow loads up to ${N(v)} pounds per square foot`],
      [o => o.heat, v => `hot: ${D(v, 0)} days a year at 100 F or more`], [o => o.tileSh, v => `tile country: ${P(v, 0)} of one unit roofs are tile (model)`], [o => o.fhsz, v => `fire country: ${P(v, 0)} of the land around its homes is in a High or Very High fire zone`],
      [o => o.destK, (v, o) => `${N(o.dest)} structures destroyed by wildfire on record`], [o => o.gust, v => `windy: ${D(v, 1)} days a year with gusts of 58 mph or more`], [o => o.coast, v => `salt air: ${P(v, 0)} of homes are in ZIPs within 5 km of the coast`],
      [o => o.fairR, v => `${D(v, 1)} FAIR Plan policies per 100 homes`], [o => o.ra25sh != null ? o.ra25sh : o.ra20sh, (v, o) => `old roofs: ${P(v, 0)} are ${o.ra25sh != null ? 25 : 20} years or older (model)`], [o => o.span, v => `${P(v, 0)} speak Spanish at home`],
      [o => o.roofsPer, v => `a thin field: ${N(v)} one unit roofs for each roofing license`]];
    const traits = o => TRAITS.map(([f, t]) => { const r = rankOf(f, o); const v = f(o); return r && r <= 2 && v > 0 ? { r, t: t(v, o) } : null; }).filter(Boolean).sort((a, b) => a.r - b.r).slice(0, 4).map(x => x.t + (x.r === 1 ? ' (first of the regions)' : ' (second)'));
    const yW = top(o => o.wavesh, 1), yO = top(o => o.ra20sh, 1), yF = top(o => o.fairR, 1), yR = top(o => o.rain, 1), yT = top(o => o.tileSh, 1), yD = top(o => o.dest, 1);
    /* the fire years that put the most rebuild roofs into the model, found in the data */
    const histY = [...new Set(RG.flatMap(o => Object.keys(o.hist)))].sort(); const fireTot = y => sum(RG.map(o => (o.hist[y] || [0, 0])[1]));
    const FIRE_Y = histY.filter(y => fireTot(y) > 0).sort((a, b) => fireTot(b) - fireTot(a)).slice(0, 6).sort();
    const fireNames = y => { const L = typeof LEDG !== 'undefined' && LEDG && LEDG.fires ? LEDG.fires : []; return L.filter(f => f.dest > 0 && +y >= f.year + 1 && +y <= f.year + 4).sort((a, b) => b.dest - a.dest).slice(0, 2).map(f => f.name + ' ' + f.year).join(', '); };
    const intro = [yO ? `${esc(yO.name)} has the oldest roofs (${P(yO.ra20sh, 0)} at 20 years or older)` : '', yW ? `${esc(yW.name)} the largest share reaching 20 within five years (${P(yW.wavesh, 0)})` : '', yT && isN(yT.tileSh) ? `${esc(yT.name)} the most tile (${P(yT.tileSh, 0)} of one unit roofs)` : '', yR && isN(yR.rain) ? `${esc(yR.name)} the most rain (${D(yR.rain, 0)} inches in a normal year)` : '', yD && yD.dest > 0 ? `${esc(yD.name)} the most structures lost to wildfire on record (${N(yD.dest)})` : '', yF && isN(yF.fairR) ? `${esc(yF.name)} the most FAIR Plan policies per 100 homes (${D(yF.fairR, 1)})` : ''].filter(Boolean);
    root.innerHTML = mastHTML({ eyebrow: `Module 11 · California Regions · ${N(NR)} regions, ${N(NC)} counties`, title: 'California Regions',
      dek: `California is not one roofing market. The same re-roof is a tile lift and relay in a hot inland subdivision, a Class A assembly with ember resistant vents in a foothill fire zone, a snow load question in the mountains and a leak call on the wet north coast. Each region here is a group of whole counties with one climate, one housing stock and, as far as counties allow, one set of media markets. The tab sums the county tables and weights the ZIP columns for each region: people and homes, roof stock and age, rain, wind, heat, snow and fire, the insurance retreat (FAIR Plan policies and non-renewals), roofing licenses and employers, and the languages to build for.`,
      meta: [`<b>Regions</b> ${N(NR)} groups of whole counties`, '<b>Roof stock</b> ACS 2020 to 2024 and the roof age model', '<b>Hazards</b> station records, CAL FIRE, the atmospheric river catalog', '<b>Insurance</b> FAIR Plan and Department of Insurance by ZIP'],
      bar: 'California Regions', barsub: 'Each region on its own',
      actions: [{ id: 'r11Csv', label: '↓ Regions CSV' }, { id: 'r11Desk', label: 'Campaign Desk ↗', title: 'Send the top ZIPs of the selected region' }] }) +
      `<div class="wrap">
      ${callout('', 'Read this first: how to read the regions', `Each region sums its counties. Roof ages come from the roof age model (module 17); in California the model ages roofs with no storm resets, and only wildfire puts new roofs on whole neighborhoods at once. Weather, fire zone and insurance measures are ZIP columns averaged with homes as the weight, so a region's figure describes where its homes are, not its empty land. Today ${intro.join(', ') || 'the measures are not in this build of the data'}. A region card is the brief for a regional campaign: which lines run hot, how old the roofs are, what the weather and the fire maps do to them, how far insurers have pulled back, who is licensed to compete, and which languages to build for. Every figure is computed from the atlas data; where a column is missing the measure is left out.`)}
      <div class="regcards" id="r11Cards"></div>
      <div class="controls" style="margin-top:16px"><div class="ctl" style="flex:1 1 320px"><label class="fl" for="r11Met">Map measure (by region)</label><select id="r11Met">${Object.entries(RM).map(([k, m]) => `<option value="${k}">${esc(m.l)}</option>`).join('')}</select></div></div>
      <div class="grid2">
        <div class="card mapcard"><div id="r11Map"></div><div class="legend" id="r11Leg"></div></div>
        <div class="stack"><div class="card"><div class="card-h" style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start"><div><h3 id="r11Name">California</h3><p id="r11Sub">Click a region</p></div><span class="pill" id="r11Pill">State</span></div><div class="card-b" id="r11Detail"></div></div></div>
      </div>
      ${card('Regions side by side', 'People, roofs, weather and fire, insurance and the field for each region. Click a row to open the region.', '<div class="tscroll" id="r11Tbl"></div>', 'mt')}
      <div class="split">
        ${card('Weather and fire profile', 'What the sky and the fire maps do in each region, from the ZIP columns of the hazard build, weighted by homes.', '<div id="r11Haz"></div>')}
        ${card('Insurance profile', 'FAIR Plan residential policies and their growth, policies not renewed, and how insurers rate wildfire risk. The retreat of the voluntary market is what sells fire hardened roofs.', '<div id="r11Ins"></div>')}
      </div>
      <div class="split">
        ${card('Fire rebuild cohorts by region', 'Roofs the model puts on rebuilt homes after wildfire, in the years that carry the most of them, and the age driven replacements due this year.', '<div id="r11Trend"></div>')}
        ${card('Which lines run hot where', 'Each region\'s service line pool per resident against the state rate (1.0 = state). Darker cells run hotter.', '<div id="r11Lines"></div>')}
      </div>
      <div class="split">
        ${card('Media markets and languages', 'The television markets a regional campaign buys, named by their principal cities, and the languages spoken at home.', '<div id="r11Mkt"></div>')}
        ${card('Licenses and competition', 'Active C-39 Roofing licenses by mailing address, roofing employers, and the roofs behind each license.', '<div id="r11Lic"></div>')}
      </div>
      <div class="split">
        ${card('Gaps: what no public dataset fills', 'Where the next layer of truth sits, and who holds it.', '<div id="r11Gap"></div>')}
        ${card('How this tab is built', 'Sums, weights and the region to market mapping.', '<div id="r11How"></div>')}
      </div>
      <div class="foot" id="r11Foot"></div></div>`;
    const pick = k => { st.r = st.r === k ? null : k; if (st.r != null) map.fitCounties(RGI[k].ps.map(p => p.fips)); else map.reset(); render(); };
    const map = new ZipMap($('#r11Map', root), { segHit: 'none', roads: false, aria: 'Map of the California regions', onCounty: f => { if (COI[f]) pick(COI[f].reg); },
      onCountyHover: (f, e) => { const p = COI[f]; if (!p) return; const o = RGI[p.reg]; if (!o) return; const M = RM[st.m]; showTip(`<div class="tt">${esc(o.name)}</div><div class="ts">${esc(p.name)} County · ${N(o.pop)} residents in the region</div>${tipRow(esc(M.l), M.fmt(M.f(o)))}${tipRow('Roofs 20 years or older (model)', N(o.ra20))}${tipRow('Reaching 20 within five years', N(o.wave))}${isN(o.fair) ? tipRow('FAIR Plan residential policies', N(o.fair)) : ''}${o.dest != null ? tipRow('Structures destroyed by wildfire, on record', N(o.dest)) : ''}<div class="tf">Click to open the region</div>`, e); } });
    function render() {
      const M = RM[st.m]; const vals = RG.map(M.f); const sc = qScale(vals, 'green', 1); const fin = vals.filter(isN);
      map.fillCounty(f => { const p = COI[f]; const o = p ? RGI[p.reg] : null; return o ? sc.f(M.f(o)) : null; }); map.dimCounty(st.r != null ? new Set(CO.filter(p => p.reg === st.r).map(p => p.fips)) : null);
      $('#r11Leg', root).innerHTML = legendHTML({ title: M.l, R: sc.R, lo: fin.length ? M.fmt(Math.min(...fin)) : '—', hi: fin.length ? M.fmt(Math.max(...fin)) : '—', note: `<b>Each region is one value</b>: every county of a region takes its region's figure. ${G(M.g)}` });
      $$('.regcard', root).forEach(c => c.classList.toggle('sel', +c.dataset.k === st.r));
      drawDetail();
    }
    $('#r11Cards', root).innerHTML = RG.map(o => `<div class="regcard" data-k="${o.k}" role="button" tabindex="0"><h4>${esc(o.name)}</h4><div class="mini">${N(o.ps.length)} ${o.ps.length === 1 ? 'county' : 'counties'} · ${K(o.pop)} residents · ${esc(mktShort(o.k))}</div>
      <div class="rowl" style="margin-top:6px"><span>Roofs 20 or older (model)</span><b>${K(o.ra20)} · ${P(o.ra20sh, 0)}</b></div><div class="rowl"><span>Reaching 20 within five years</span><b>${K(o.wave)}</b></div>${isN(o.tileSh) ? `<div class="rowl"><span>Tile roofs (model)</span><b>${P(o.tileSh, 0)}</b></div>` : ''}${isN(o.fair) ? `<div class="rowl"><span>FAIR Plan policies${isN(o.fairX) ? ' · growth since ' + (IY[0] || 2022) : ''}</span><b>${K(o.fair)}${isN(o.fairX) ? ' · ' + D(o.fairX, 1) + '×' : ''}</b></div>` : ''}${o.dest != null ? `<div class="rowl"><span>Structures lost to wildfire, on record</span><b>${N(o.dest)}</b></div>` : ''}<div class="rowl"><span>Gross profit pool a year</span><b>${MM(o.fees)}</b></div></div>`).join('');
    $$('.regcard', root).forEach(c => { const go = () => pick(+c.dataset.k); c.onclick = go; c.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } }; });
    const row = (l, v) => `<div class="rowl"><span>${l}</span><b>${v}</b></div>`;
    const opt = (cond, l, v) => cond ? row(l, v) : '';
    function drawDetail() {
      const box = $('#r11Detail', root); const o = st.r != null ? RGI[st.r] : null;
      if (!o) { $('#r11Name', root).textContent = 'California'; $('#r11Sub', root).textContent = 'Click a region on the map or a card above'; $('#r11Pill', root).textContent = 'State';
        box.innerHTML = RG.slice().sort((a, b) => b.ra20 - a.ra20).map(x => `<div class="rowl"><span>${esc(x.name)}</span><b>${K(x.ra20)} old roofs · ${K(x.wave)} coming</b></div>`).join('') + '<p class="mini" style="margin-top:8px">Roofs 20 years or older · roofs reaching 20 within five years (model).</p>'; return; }
      $('#r11Name', root).textContent = o.name; $('#r11Sub', root).textContent = `${o.ps.map(p => p.name).join(', ')}`; $('#r11Pill', root).textContent = 'Region ' + o.k;
      const hot = LINE_KEYS.map(l => [l, stLine[l] > 0 ? o.lines[l] / o.pop / stLine[l] : null]).filter(x => isN(x[1])).sort((a, b) => b[1] - a[1]); const tr = traits(o);
      box.innerHTML = `<div class="big">${N(o.ra20)}<span style="font-size:13px;font-weight:500;color:var(--ink-3)"> roofs 20 years or older (model)</span></div><div class="mini" style="margin-bottom:10px">${P(o.ra20sh, 1)} of ${N(o.roofs)} one unit roofs · ${N(o.wave)} more reach 20 within five years · about ${N(o.nxt)} due from age alone in the next twelve months${isN(o.nxt_t) ? ', and ' + N(o.nxt_t) + ' tile underlayment jobs' : ''}</div>
        ${tr.length ? `<div class="dsec">Roofing character</div><p class="mini">${esc(cap1(tr.join('; ')))}.</p>` : ''}
        <div class="dsec">People and homes</div>
        ${row('Residents · ZIPs scored · square miles', `${N(o.pop)} · ${N(o.nzip)} · ${N(o.area)}`)}
        ${row('Homes · mobile homes · second homes · commercial roofs (estimate)', `${N(o.hu)} · ${N(o.mh)} · ${N(o.seas)} · ${N(o.cru)}`)}
        ${row('Owner occupied · with a mortgage · 65 and over · median county income', `${P(o.own, 0)} · ${P(o.mort, 0)} · ${P(o.s65, 0)} · ${M$(o.inc)}`)}
        ${row(`New housing units permitted, 2025 · ${CUR} to date against last year`, `${N(o.bps25)} · ${N(o.ytd26)} vs ${N(o.ytd25)}`)}
        <div class="dsec">Roofs</div>
        ${opt(isN(o.ra25sh), 'Roofs 25 years or older', `${N(o.ra25)} · ${P(o.ra25sh, 1)}`)}${opt(isN(o.tileSh), 'Tile roofs · wood shake and shingle (model shares)', `${P(o.tileSh, 1)} · ${P(o.wood, 1)}`)}
        <div class="dsec">Weather and fire</div>
        ${opt(isN(o.rain) || isN(o.ar), 'Rain in a normal year · atmospheric river days a year', `${isN(o.rain) ? D(o.rain, 1) + ' in' : '—'} · ${D(o.ar, 1)}`)}${opt(isN(o.gust) || isN(o.heat), 'Gust days at 58 mph · days at 100 F', `${D(o.gust, 2)} · ${D(o.heat, 1)}`)}${opt(isN(o.snowMax) && o.snowMax > 0, 'Design ground snow load, home weighted · highest ZIP', `${D(o.snow, 0)} · ${N(o.snowMax)} psf`)}
        ${opt(isN(o.fhsz), 'ZIP area in High or Very High fire zones (home weighted)', P(o.fhsz, 1))}${opt(o.dest != null, 'Structures destroyed · damaged by wildfire, on record', `${N(o.dest)} · ${N(o.dmgd)}`)}${opt(isN(o.lastfire), 'Latest year a wildfire destroyed or damaged structures', String(o.lastfire))}
        ${row(`FEMA roof or property registrations to ${CUR} · per 100 homes`, `${N(o.fema)} · ${D(o.femaR, 1)}`)}
        <div class="dsec">Insurance</div>
        ${opt(isN(o.fair), `FAIR Plan residential policies · per 100 homes${isN(o.fairX) ? ' · growth since ' + (IY[0] || 2022) : ''}`, `${N(o.fair)} · ${D(o.fairR, 1)}${isN(o.fairX) ? ' · ' + D(o.fairX, 2) + '×' : ''}`)}${opt(isN(o.nonren), `Policies not renewed${o.nonrenY ? ', ' + o.nonrenY : ''} · share of policies up for renewal`, `${N(o.nonren)} · ${P(o.nonrenSh, 1)}`)}${opt(isN(o.wfhi), 'Homeowners policies insurers rate High or Extreme wildfire risk', P(o.wfhi, 1))}
        <div class="dsec">Lines that run hot (× state per resident)</div>${hot.slice(0, 4).map(([l, v]) => row(esc((PLI[l] || {}).name || l), D(v, 2) + '×')).join('')}
        <div class="dsec">Market</div>
        ${row('Media markets named for cities here · cost factor (assumption)', `${esc(mktTxt(o.k))} · ${D(o.dma, 2)}`)}
        ${row('Active C-39 licenses · per 10,000 residents · roofing employers (CBP)', `${N(o.lic)} · ${D(o.licK, 2)} · ${N(o.cbp)}${o.cbpGaps ? ' in the ' + N(o.ps.length - o.cbpGaps) + ' counties published' : ''}`)}
        ${row('Insurance agents (ZBP) · adjusters', `${N(o.agents)} · ${N(o.adj)}`)}
        ${row('At home: Spanish · Chinese · Vietnamese · Tagalog · Korean', `${P(o.span, 1)} · ${P(o.chin, 1)} · ${P(o.viet, 1)} · ${P(o.tagalog, 1)} · ${P(o.korean, 1)}`)}
        ${row('Largest cities', o.cities.slice(0, 5).map(c => esc(c.name)).join(', ') || '—')}
        <p class="mini" style="margin-top:8px">Named companies with an office here: ${o.firms.map(c => esc(c.name)).join('; ') || 'none in the atlas data, which names only the few companies in its evidence'}.</p>
        <div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap"><button class="ibtn" id="r11Idx">Roof Demand Index for the region ↗</button><button class="ibtn" id="r11RD">Top ZIPs to the Desk ↗</button><button class="ibtn" id="r11Wx">Weather Desk ↗</button><button class="ibtn" id="r11Led">Weather and Fire Ledger ↗</button></div>`;
      $('#r11Idx', root).onclick = () => { goModule('index'); const s = $('#i1Reg'); if (s) { s.value = String(o.k); s.dispatchEvent(new Event('change')); } };
      $('#r11RD', root).onclick = () => goModule('desk', { zips: o.zs.slice().sort((a, b) => (b.effb || 0) - (a.effb || 0)).slice(0, 25).map(z => z.zip) });
      $('#r11Wx', root).onclick = () => goModule('weather', { reg: o.k }); $('#r11Led', root).onclick = () => goModule('storms', { reg: o.k });
    }
    /* side by side: only the columns the data can fill */
    const tcol = (k, h, f, t) => RM[k] ? [{ k: 'm_' + k, h, v: r => RM[k].f(r), f, t: t || RM[k].l }] : [];
    dataTable($('#r11Tbl', root), [{ k: 'name', h: 'Region', l: 1, f: v => `<b>${esc(v)}</b>` }, { k: 'pop', h: 'Residents', f: v => N(v) }, { k: 'roofs', h: 'One unit roofs', f: v => N(v) }, { k: 'ra20sh', h: 'Roofs 20+ %', f: v => P(v, 1) }, { k: 'wavesh', h: 'Reaching 20 %', f: v => P(v, 1) }, { k: 'nxtK', h: 'Due a year per 1k', f: v => D(v, 1) }]
      .concat(tcol('tile', 'Tile %', v => P(v, 0)), tcol('rain', 'Rain in', v => D(v, 1)), tcol('heat', '100 F days', v => D(v, 0)), tcol('fhsz', 'Fire zone %', v => P(v, 0)), tcol('dest', 'Lost to fire per 1k homes', v => D(v, 2)), tcol('fair', 'FAIR per 100 homes', v => D(v, 1)), tcol('nonren', 'Not renewed %', v => P(v, 1)), tcol('lic', 'Licenses per 10k', v => D(v, 2)))
      .concat([{ k: 'fees', h: 'Pool', f: v => MM(v) }, { k: 'cpc', h: 'Cost', f: v => D(v, 2) + '×' }, { k: 'span', h: 'Spanish %', f: v => P(v, 1) }, { k: 'mkt', h: 'Media markets', l: 1, v: r => mktShort(r.k) }]), RG, { sortKey: 'pop', id: r => r.k, onClick: k => { st.r = null; pick(+k); } });
    /* weather and fire profile */
    const hz = [['Rain in a normal year (in)', o => o.rain, v => D(v, 1)], ['Days a year with 1 inch of rain', o => o.rd1, v => D(v, 1)], ['Atmospheric river days a year', o => o.ar, v => D(v, 1)], ['Gust days at 40 mph', o => o.gust40, v => D(v, 1)], ['Gust days at 58 mph', o => o.gust, v => D(v, 2)], ['Days a 58 mph gust was measured within 25 miles', o => o.lsr, v => D(v, 1)], ['Days at 100 F', o => o.heat, v => D(v, 1)], ['Days at 110 F', o => o.heat110, v => D(v, 1)], ['Ground snow load, highest ZIP (psf)', o => o.snowMax, v => N(v)], ['Very High fire zone (% of ZIP area)', o => o.vh, v => P(v, 1)], ['High or Very High fire zone (%)', o => o.fhsz, v => P(v, 1)], ['Structures destroyed by wildfire', o => o.dest, v => N(v)], ['Latest fire with structures lost', o => o.lastfire, v => String(v)], ['Homes within 5 km of the coast (%)', o => o.coast, v => P(v, 0)]].filter(m => RG.some(o => isN(m[1](o))));
    const heatTbl = (ms, note) => { if (!ms.length) return '<p class="mini">These measures are not in this build of the data.</p>'; return `<div class="xscroll"><table class="heat"><thead><tr><th class="l">Region</th>${ms.map(m => `<th>${esc(m[0])}</th>`).join('')}</tr></thead><tbody>${RG.map(o => `<tr><td class="l"><b>${esc(o.name)}</b></td>${ms.map(m => { const v = m[1](o); if (!isN(v)) return '<td>·</td>'; const all = RG.map(m[1]).filter(isN); const sc = qScale(all, m[3] || 'green', 1); const c = m[4] ? null : sc.f(v); return c ? `<td style="background:${c};color:${textOn(c)}">${m[2](v)}</td>` : `<td>${m[2](v)}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div><p class="chartnote">${note}</p>`; };
    hz.forEach(m => { if (/Latest fire/.test(m[0])) m[4] = 1; });
    $('#r11Haz', root).innerHTML = heatTbl(hz, `Each column is shaded on its own scale across the ${N(NR)} regions. Rain, heat and gust days come from the nearest long record station to each ZIP; airport gust records are screened for sensor spikes, and ridge tops and canyons blow far harder than any airport. Fire zones are the State Fire Marshal's maps; structures destroyed are CAL FIRE damage inspections, which begin in 2013. ${G('B')}`);
    const insM = [['FAIR Plan residential policies', o => o.fair, v => N(v), 'teal'], ['Per 100 homes', o => o.fairR, v => D(v, 1), 'teal'], [`Growth since ${IY[0] || 2022} (×)`, o => o.fairX, v => D(v, 2), 'teal'], ['Policies not renewed', o => o.nonren, v => N(v), 'teal'], ['Not renewed (% of renewals)', o => o.nonrenSh, v => P(v, 1), 'teal'], ['Rated High or Extreme wildfire risk (%)', o => o.wfhi, v => P(v, 1), 'teal'], ['Average homeowners premium ($)', o => o.prem, v => M$(v), 'teal'], ['Fire and smoke losses paid ($ thousand)', o => o.wfloss, v => N(v), 'teal']].filter(m => RG.some(o => isN(m[1](o))));
    const nyAll = RG.map(o => o.nonrenY).filter(Boolean)[0];
    $('#r11Ins', root).innerHTML = heatTbl(insM, `FAIR Plan counts are the Plan's own residential policies in force at its fiscal year end${IY.length ? ' (' + IY[IY.length - 1] + ')' : ''}; non-renewals are the Department of Insurance's voluntary market file${nyAll ? ', ' + nyAll + ' being the newest year published' : ''}, which no longer separates insurer from owner decisions. A region where the Plan grows and insurers rate many homes High or Extreme is where a Class A roof, ember resistant vents and the paperwork for an insurer's discount are a reason to re-roof before the roof wears out. ${G('A')}`);
    const rs = (o, y) => ((o.hist[String(y)] || [0, 0])[1]); const ag = o => ((o.hist[String(CUR)] || [0, 0])[0]);
    $('#r11Trend', root).innerHTML = FIRE_Y.length ? `<div class="xscroll"><table><thead><tr><th class="l">Region</th>${FIRE_Y.map(y => `<th>${y}<br><span class="mini">${esc(fireNames(y))}</span></th>`).join('')}<th>Age driven, ${CUR}</th></tr></thead><tbody>${RG.slice().sort((a, b) => b.roofs - a.roofs).map(o => `<tr><td class="l"><b>${esc(o.name)}</b></td>${FIRE_Y.map(y => `<td>${N(rs(o, y))}</td>`).join('')}<td>${N(ag(o))}</td></tr>`).join('')}<tr><td class="l">California</td>${FIRE_Y.map(y => `<td><b>${N(sum(RG.map(o => rs(o, y))))}</b></td>`).join('')}<td><b>${N(sum(RG.map(ag)))}</b></td></tr></tbody></table></div><p class="chartnote">Rebuild roofs by the year the model puts them on: homes CAL FIRE recorded as destroyed re-enter the stock at age 0 over the four years after the fire, at the rebuild share the model assumes. The ${N(FIRE_Y.length)} years shown are the ones with the most rebuild roofs statewide; the fires named under a year are the largest of the four years before it. Against the age driven column, fire is a small share of roofing work everywhere and nearly all of it in a few counties. Grade C.</p>` : '<p class="mini">The roof age model in this build of the data carries no wildfire rebuild roofs.</p>';
    const allv = RG.flatMap(o => LINE_KEYS.map(l => stLine[l] > 0 ? o.lines[l] / o.pop / stLine[l] : 0)).filter(v => v > 0); const sc2 = divScale(allv.map(v => Math.log(v)), 0);
    $('#r11Lines', root).innerHTML = `<div class="xscroll"><table class="heat"><thead><tr><th class="l">Region</th>${LINE_KEYS.map(l => `<th>${esc((PLI[l] || {}).short || l)}</th>`).join('')}</tr></thead><tbody>${RG.map(o => `<tr><td class="l"><b>${esc(o.name)}</b></td>${LINE_KEYS.map(l => { const v = stLine[l] > 0 ? o.lines[l] / o.pop / stLine[l] : 0; if (!(v > 0)) return '<td>·</td>'; const c = sc2.f(Math.log(v)); return `<td style="background:${c};color:${textOn(c)}">${D(v, 2)}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div><p class="chartnote">Copper above the state rate, blue below, on a log scale centered at 1.0. Replacement, repair and tile relay rest on the roof stock and the roof age model; wildfire work rests on CAL FIRE damage inspections; fire hardening, solar, metal, commercial and coating lines lean on assumptions (grade D), so read their columns as relative exposure only.</p>`;
    $('#r11Mkt', root).innerHTML = `<div class="xscroll"><table><thead><tr><th class="l">Region</th><th class="l">Markets named for cities in the region</th><th>Cost factor</th><th>Spanish</th><th>Chinese</th><th>Vietnamese</th><th>Tagalog</th><th>Korean</th></tr></thead><tbody>${RG.map(o => `<tr><td class="l"><b>${esc(o.name)}</b></td><td class="l wrap">${esc(mktTxt(o.k))}</td><td>${D(o.dma, 2)}</td><td>${P(o.span, 1)}</td><td>${P(o.chin, 1)}</td><td>${P(o.viet, 1)}</td><td>${P(o.tagalog, 1)}</td><td>${P(o.korean, 1)}</td></tr>`).join('')}</tbody></table></div><p class="chartnote">A market is listed under a region when a city in its name lies in one of the region's counties; the cities in brackets are the ones that do when not all of them do. Which market each county belongs to is set by Nielsen and no county list is in the evidence behind this atlas, so none is given: a region with no market of its own (${esc(listAnd(RG.filter(o => !MKT[o.k].length).map(o => o.name)) || 'none')}) is bought from its neighbors, and ${esc(listAnd(BORDER))} reach counties on the Oregon and Nevada lines from outside the state. Check the county list with the station or the platform before buying. The cost factor is an assumption of the cost model (grade D). Languages are speakers at home as a share of residents aged 5 and over (ACS).</p>`;
    $('#r11Lic', root).innerHTML = heatTbl([['Active C-39 licenses', o => o.lic, v => N(v), 'lime'], ['Per 10,000 residents', o => o.licK, v => D(v, 2), 'lime'], ['Roofing employers (CBP)', o => o.cbp, v => N(v), 'lime'], ['One unit roofs per license', o => o.roofsPer, v => N(v), 'lime'], ['Pool per license ($)', o => o.lic ? o.fees / o.lic : null, v => MM(v), 'lime'], ['Insurance agents', o => o.agents, v => N(v), 'lime'], ['Adjusters', o => o.adj, v => N(v), 'lime']].filter(m => RG.some(o => isN(m[1](o)))), `Licenses are the Contractors State License Board's active C-39 Roofing licenses by mailing address: where a firm is, not where it works. Roofing employers are County Business Patterns establishments with payroll; the Census withholds small county cells, so a region sums only the counties published (${N(sum(RG.map(o => o.cbpGaps)))} of ${N(NC)} counties are withheld). There is no public measure of a California roofer's size, so the atlas ranks no company; module 13 holds the license field by city and a watchlist you build. ${G('A')}`);
    const PC = DATA.permits_city || {}; const pcN = Object.keys(PC);
    $('#r11Gap', root).innerHTML = proseTable([
      ['Insurance claims by ZIP', 'The Department of Insurance publishes fire and smoke claims, wildfire risk ratings and FAIR Plan counts by ZIP, which the atlas uses. Rain, wind and roof leak claims are not published at any level.', 'C'],
      ['Reroof permits', `${pcN.length ? 'The atlas carries re-roof permit counts for ' + esc(listAnd(pcN)) + ', the cities whose open data was read. ' : ''}Many California cities publish permits, each in its own format, and whether a re-roof needs a permit at all differs by city; no statewide count exists.`, 'D'],
      ['Roof age and material by address', 'Insurers, inspection firms and aerial imagery vendors hold it. The atlas models age by ZIP from year built, and material from a federal survey\'s state shares by era; CAL FIRE records the roof covering only for structures it inspected after a fire.', 'C'],
      ['Wind and rain by neighborhood', 'Airports and a few hundred long record stations stand for whole valleys. Most wind, snow and heat events are filed by forecast zone with no coordinates, and the Santa Ana index stops in 2018.', 'C'],
      ['Media market county lists', 'Nielsen sets them; none is in the evidence, so markets are named here by their cities only.', 'D'],
      ['Search demand by ZIP', 'Search engines report demand by metro and state, not ZIP. Account data (module 15) is the only ZIP level truth.', 'D'],
    ].map(r => [r[0], r[1], G(r[2])]));
    $('#r11How', root).innerHTML = `<p class="body">The ${N(NR)} regions are groups of whole counties chosen for this atlas by climate, housing and media market; they are not a state agency's scheme. Roof stock, roof ages, replacements and rebuild roofs sum the county tables of the roof age model (module 17); FEMA registrations, licenses, employers and languages sum by county; model pools sum the scored ZIPs, each assigned to the county holding most of its land. Weather, fire zone, tile and insurance rate measures are ZIP columns averaged with housing units as the weight (one unit roofs for the roof shares); structures destroyed are ZIP sums. FAIR Plan and non-renewal totals come from the insurance rollup by region when the data carries it, which counts every postal ZIP the source places in the county. A region's roofing character lists the measures on which it stands first or second among the regions, so it changes when the data does. A measure whose column is missing from the data is left out of every table.</p>`;
    $('#r11Foot', root).innerHTML = `<b style="color:var(--ink)">${esc(ATLAS.name)}</b>, module 11. Regions are groups of whole counties chosen for this atlas. Compiled ${esc(dateL(META.compiled))}.`;
    $('#r11Met', root).onchange = e => { st.m = e.target.value; render(); };
    $('#r11Csv', root).onclick = () => { const ms = Object.entries(RM); saveFile('california-roofing-regions.csv', toCSV(['region', 'counties', 'county_names', 'residents', 'homes', 'one_unit_roofs', 'roofs_20_plus_model', 'roofs_15_to_19_model', 'due_next_12_months_model', 'mobile_homes', 'fema_registrations_to_' + CUR, 'fair_plan_policies', 'policies_not_renewed', 'structures_destroyed_by_wildfire', 'active_c39_licenses', 'roofing_employers_cbp', 'gross_profit_pool_model', 'media_markets_by_city'].concat(ms.map(([k]) => 'measure_' + k), FIRE_Y.map(y => 'fire_rebuild_roofs_' + y)),
      RG.map(o => [o.name, o.ps.length, o.ps.map(p => p.name).join('; '), o.pop, o.hu, o.roofs, o.ra20, o.wave, Math.round(o.nxt), o.mh, o.fema, isN(o.fair) ? o.fair : '', isN(o.nonren) ? o.nonren : '', o.dest != null ? o.dest : '', isN(o.lic) ? o.lic : '', o.cbp, Math.round(o.fees), mktTxt(o.k)].concat(ms.map(([k, m]) => { const v = m.f(o); return isN(v) ? +(+v).toFixed(3) : ''; }), FIRE_Y.map(y => Math.round(rs(o, y))))), `${ATLAS.name}, module 11. Measure columns: ${ms.map(([k, m]) => k + ' = ' + m.l).join('; ')}. Roof ages and rebuild roofs are modeled (module 17). Media markets are named by city; no county list is given.`)); };
    $('#r11Desk', root).onclick = () => { const o = st.r != null ? RGI[st.r] : null; goModule('desk', { zips: (o ? o.zs : ZR).slice().sort((a, b) => (b.effb || 0) - (a.effb || 0)).slice(0, 25).map(z => z.zip) }); };
    BUS.on('theme', () => render());
    this.receive = p => { if (p && p.reg != null && RGI[+p.reg]) { st.r = null; pick(+p.reg); } };
    render();
  }
});
