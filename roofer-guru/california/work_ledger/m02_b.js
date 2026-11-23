
/* ============================ Module 2: Weather and Fire Ledger ============================ */
registerModule({
  key: 'storms', num: '02', title: 'Weather and Fire Ledger', desc: 'Every wildfire perimeter with the structures it destroyed, atmospheric river landfalls by rank, Santa Ana, Diablo and sundowner wind events, and every located flood, debris flow, hail, wind and tornado report, by ZIP',
  mount(root) {
    const L = LEDG; const TS = DATA.ts || {}; const TM = TS.month || {}; const TY = TS.year || {};
    const CUR = +String(META.compiled || '2026').slice(0, 4);
    const fy = L.fires.map(f => f.year).filter(isN); const Y0 = fy.length ? Math.min(2000, ...fy) : 2000; const Y1 = CUR;
    const YRS = []; for (let y = Y0; y <= Y1; y++) YRS.push(y);
    const st = { lay: { fire: true, ar: true, wind: true, pts: true }, filt: 'all', shade: '', y0: Math.max(Y0, 2013), y1: Y1, par: '', reg: '', fire: null, ar: null, wind: null, pt: null, zip: null, hm: 'count', yk: '' };
    const has = c => ZC.includes(c);
    /* ZIP shadings: only the columns this build of the data carries */
    const SH = [['fhsz_sh', 'Share of the ZIP in a High or Very High Fire Hazard Severity Zone (%)', v => P(v, 0), 'A'], ['fhsz_vh', 'Share of the ZIP in a Very High Fire Hazard Severity Zone (%)', v => P(v, 0), 'A'], ['burn_sh', 'Share of the ZIP inside a fire perimeter since 2000 (%)', v => P(v, 0), 'A'], ['fire_dest', 'Structures destroyed by wildfire in the ZIP, 2013 to 2025', v => N(v), 'A'],
      ['ar_days', 'Atmospheric river days a year, AR2 or stronger (at the ZIP\'s stretch of coast)', v => D(v, 1), 'B'], ['rain_d1', 'Days a year with 1 inch of rain or more', v => D(v, 1), 'A'], ['rain_in', 'Rain in a normal year (inches)', v => D(v, 1), 'A'], ['g58', 'Days a year with a gust of 58 mph or more at the nearest screened station', v => D(v, 2), 'B'], ['wd58', CLIM_L.wd58, v => D(v, 1), 'B'],
      ['h100', 'Days a year at 100 F or more', v => D(v, 0), 'A'], ['snow_psf', 'Design ground snow load at the town (pounds per square foot)', v => N(v), 'B'], ['hd1', CLIM_L.hd1, v => D(v, 2), 'A'], ['stress', CLIM_L.stress, v => N(v), 'D']].filter(s => has(s[0]));
    const SHI = {}; SH.forEach(s => { SHI[s[0]] = s; }); st.shade = SH.length ? SH[0][0] : 'none';
    const yearKinds = () => { const ks = {}; Object.values(TY).forEach(o => Object.keys(o || {}).forEach(k => { ks[k] = 1; })); return ks; };
    /* ---------- headline numbers, all from the data ---------- */
    const fDest = L.fires.filter(f => isN(f.dest)); const totDest = sum(fDest.map(f => f.dest)), totDmg = sum(fDest.map(f => f.dmg || 0));
    const topFire = fDest.slice().sort((a, b) => b.dest - a.dest)[0] || null;
    const pal = L.find('Palisades 2025'), eat = L.find('Eaton 2025');
    const arWY = TS.ar_wy || {}; const arYears = Object.keys(arWY).filter(y => +y <= CUR - 1); const arMean = arYears.length ? sum(arYears.map(y => sum(arWY[y]))) / arYears.length : (L.ar.length ? null : null);
    const ar45 = L.ar.filter(a => a.rank >= 4);
    const named = L.wind.filter(w => w.kind !== 'winter' && w.kind !== 'other'); const topGust = named.filter(w => isN(w.gust)).sort((a, b) => b.gust - a.gust)[0] || null;
    const FD = (TS.fema_decl || L.fema || []); const fdY = TS.fema_decl_year || {}; const fd00 = Object.keys(fdY).filter(y => +y >= 2000); const fdSum = k => sum(fd00.map(y => (fdY[y] || {})[k] || 0)); const fdAll = sum(['fire', 'storm', 'flood', 'quake', 'other'].map(fdSum));
    const cntK = k => PTS.filter(p => p.k === k).length; const ptY = PTS.map(p => p.y).filter(isN); const PY0 = ptY.length ? Math.min(...ptY) : null, PY1 = ptY.length ? Math.max(...ptY) : null;
    const fireOpt = f => `<option value="${f.i}">${esc(f.label)} · ${isN(f.dest) ? N(f.dest) + ' destroyed' : isN(f.acres) ? N(f.acres) + ' acres' : 'no count'}</option>`;
    const decades = []; for (let d = Math.floor(Y1 / 10) * 10; d >= Math.floor(Y0 / 10) * 10; d -= 10) decades.push([d, d + 9, d + 's']);
    const fireMenu = a => a.slice().sort((x, y) => (y.dest || 0) - (x.dest || 0) || (y.acres || 0) - (x.acres || 0)).slice(0, 40);
    root.innerHTML = mastHTML({ eyebrow: 'Module 02 · Weather and Fire Ledger · wildfire, atmospheric rivers, offshore wind, flood, hail', title: 'Weather and Fire Ledger',
      dek: `Where weather and fire hit roofs. Every wildfire perimeter of 1,000 acres or more since ${Y0}, and every fire that damaged a structure, is drawn on the map with the structures CAL FIRE's inspectors found destroyed and damaged. Atmospheric river landfalls sit on the coast by their rank on the AR1 to AR5 scale, Santa Ana, Diablo, sundowner and winter wind events at the place of their strongest measured gust, and every flood, debris flow, hail, wind and tornado report that carries coordinates at its own point. Type a ZIP to read what has touched it. This is the view for response: which ZIPs to work after an event, when each kind of weather peaks, and what the record says each does to a roof.`,
      meta: [`<b>Fires</b> ${N(L.fires.length)} on the ledger, ${N(L.fires.filter(f => f.d).length)} with a perimeter (CAL FIRE)`, `<b>Atmospheric rivers</b> ${N(L.ar.length)} landfalls, ${N(L.arBig.length)} described (CW3E catalog)`, `<b>Wind events</b> ${N(L.wind.length)} (NOAA Storm Events)`, `<b>Reports</b> ${N(PTS.length)} with coordinates${PY0 ? ', ' + PY0 + ' to ' + PY1 : ''}`, '<b>Grade</b> A observed records, B derived by a stated rule'],
      bar: 'Weather and Fire Ledger', barsub: 'Fires, atmospheric rivers, wind events and located reports',
      actions: [{ id: 's2Csv', label: '↓ Fires CSV' }, { id: 's2ECsv', label: '↓ AR and wind CSV' }, { id: 's2RCsv', label: '↓ Reports CSV' }, { id: 's2Desk', label: 'Campaign Desk ↗', title: 'Send the ZIPs of the selected fire or ZIP, or the ZIPs with the most reports' }, { id: 's2Forge', label: 'Site Forge ↗', title: 'Send an event page and its ZIPs to the Site Forge' }] }) +
      `<div class="wrap">
      ${callout('', 'Read this first: a record is not a damaged roof', `Four kinds of record are on this map and each is read differently. A <b>fire perimeter</b> is the mapped edge of a burn; the structure counts inside it are CAL FIRE damage inspections, which begin in 2013 and from 2018 also list the buildings that survived. An <b>atmospheric river landfall</b> is ranked by the water vapor it carried across the coast, not by the rain that fell on a town. A <b>wind event</b> is a set of forecast zone records; the gust shown is the strongest one measured, often on a ridge or in a canyon, not at rooftops in town. A <b>located report</b> is a place where someone or an instrument recorded flood, debris flow, hail, wind or a tornado. Most California weather is filed by forecast zone with no coordinates (high wind, heavy snow, heat, most wildfire records), so the dots are thin exactly where the weather matters most: use the ZIP shading and the ZIP lookup for those. Use the record to place an event and size the roof market it left, and never as proof that a given roof was damaged.`)}
      <div class="kpis" id="s2Kpis"></div>
      <div class="controls">
        <div class="ctl"><span class="fl">Show</span><div id="s2Lay" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">${[['fire', 'Fire perimeters'], ['ar', 'Atmospheric rivers'], ['wind', 'Wind events'], ['pts', 'Located reports']].map(([k, l]) => `<label class="chk"><input type="checkbox" data-lay="${k}" checked> ${l}</label>`).join('')}</div></div>
        <div class="ctl" style="flex:1 1 220px"><label class="fl" for="s2Storm">Wildfire</label><select id="s2Storm"><option value="">All fires in the years chosen</option>${decades.map(([a, b, l]) => { const fs = fireMenu(L.fires.filter(f => f.year >= a && f.year <= b)); return fs.length ? `<optgroup label="${l}, by structures destroyed">${fs.map(fireOpt).join('')}</optgroup>` : ''; }).join('')}</select></div>
        <div class="ctl" style="flex:1 1 200px"><label class="fl" for="s2Filt">Report type</label><select id="s2Filt">${Object.entries(SF).map(([k, f]) => `<option value="${k}">${esc(f.l)}</option>`).join('')}</select></div>
        <div class="ctl"><label class="fl" for="s2Y0">Years</label><div style="display:flex;gap:6px;align-items:center"><select id="s2Y0">${YRS.map(y => `<option ${y === st.y0 ? 'selected' : ''}>${y}</option>`).join('')}</select><span class="mini">to</span><select id="s2Y1">${YRS.map(y => `<option ${y === st.y1 ? 'selected' : ''}>${y}</option>`).join('')}</select></div></div>
        <div class="ctl"><label class="fl" for="s2Reg">Region</label><select id="s2Reg"><option value="">All ${N(REG_KEYS.length)} regions</option>${REG_KEYS.map(k => `<option value="${k}">${esc(REGN[k])}</option>`).join('')}</select></div>
        <div class="ctl"><label class="fl" for="s2Par">County</label><select id="s2Par"><option value="">All ${N(CO.length)} counties</option>${CO.slice().sort((a, b) => a.name.localeCompare(b.name)).map(p => `<option value="${p.fips}">${esc(p.name)}</option>`).join('')}</select></div>
        <div class="ctl" style="flex:1 1 240px"><label class="fl" for="s2Shade">Shade ZIPs by</label><select id="s2Shade">${SH.map(s => `<option value="${s[0]}">${esc(s[1])}</option>`).join('')}<option value="none">Nothing (county outlines)</option></select></div>
        <div class="ctl"><label class="fl" for="s2Zip">ZIP lookup</label><div style="display:flex;gap:6px"><input type="text" id="s2Zip" inputmode="numeric" maxlength="5" placeholder="95969" style="width:90px"><button class="ibtn" id="s2ZipGo">Look up</button></div></div>
      </div>
      <div class="grid2">
        <div class="card mapcard"><div id="s2Map"></div><div class="legend" id="s2Leg"></div></div>
        <div class="stack">
          <div class="card"><div class="card-h" style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start"><div><h3 id="s2Name">California</h3><p id="s2Sub">Click a fire, a landfall, a wind event, a report or a ZIP</p></div><span class="pill" id="s2Pill">State</span></div><div class="card-b" id="s2Detail"></div></div>
          <div class="card"><div class="card-h"><h3 id="s2TopH">ZIPs</h3><p id="s2TopSub"></p></div><div class="tscroll short" id="s2Top"></div></div>
        </div>
      </div>
      ${card('Wildfires ranked', `Every fire on the ledger for the years and area chosen above. Structures are CAL FIRE damage inspections tied to the perimeter; fires before 2013 have no inspection record and show no count. Click a row to open the fire.`, '<div class="tscroll" id="s2Storms"></div>', 'mt')}
      <div class="split">
        ${card('Atmospheric river landfalls', 'Landfalls on the California coast by water year and rank (a water year runs October to September), and the extreme and notable ones with what was recorded under them. Click a row to open the landfall.', '<div id="s2ArY"></div><div id="s2ArYLeg"></div><div class="tscroll short" id="s2ArT" style="margin-top:10px"></div><p class="chartnote" id="s2ArN"></p>')}
        ${card('Santa Ana, Diablo, sundowner and winter wind events', 'Wind events in the years and area chosen, with the strongest gust measured in each. Click a row to open the event.', '<div id="s2WK"></div><div class="tscroll short" id="s2WT" style="margin-top:10px"></div><p class="chartnote" id="s2WN"></p>')}
      </div>
      ${card('Timeline by year', 'One kind of record at a time, by year. Reporting practice changed over these years, so a rising count is not by itself a rising hazard.', `<div class="controls" style="margin:0 0 8px;padding:0;border:0;box-shadow:none;background:none"><div class="ctl" style="flex:1 1 320px"><label class="fl" for="s2YK">Kind</label><select id="s2YK"></select></div></div><div id="s2Yr"></div><p class="chartnote" id="s2YrN"></p>`, 'mt')}
      ${card('Calendar by month', 'When each kind of weather and fire comes, as its share of the year by month. Each small chart is one kind on its own scale.', '<div id="s2Cal" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:14px"></div><p class="chartnote" id="s2CalN"></p>', 'mt')}
      <div class="split">
        ${card('FEMA declarations by year and kind', 'Every federal declaration for California since 2000: major disasters, emergencies and fire management assistance, by the year declared.', '<div id="s2Fd"></div><div id="s2FdLeg"></div><p class="chartnote" id="s2FdN"></p>')}
        ${card('FEMA household registrations by disaster', 'OpenFEMA Individuals and Households Program registrations in California with roof damage or verified property loss, by declared disaster.', '<div class="tscroll short" id="s2Fema"></div><p class="chartnote" id="s2FemaNote"></p>')}
      </div>
      ${card('When located reports come in', 'Day of week by hour of day for the report type, years and area chosen above. Darker cells hold more reports. Hours are Pacific Standard Time.', `<div class="seg" id="s2HmMode" style="margin-bottom:10px"><button data-v="count" aria-pressed="true">Count</button><button data-v="share" aria-pressed="false">Share of the week</button></div><div id="s2Heat"></div><div id="s2HeatNote" class="chartnote"></div><div style="margin-top:8px"><button class="ibtn" id="s2HeatCsv">↓ Grid CSV</button></div>`, 'mt')}
      <div class="split">
        ${card('Report sizes', 'The size of the located reports in the years and area chosen, all types.', '<div id="s2Size"></div><p class="chartnote" id="s2SizeNote"></p>')}
        ${card('Places hit again and again', 'Towns with the most reports of the type chosen above, by the nearest town to each report, with the number of separate years they were hit.', '<div class="tscroll short" id="s2Places"></div>')}
      </div>
      ${card('The scales explained', 'What the ranks, zones and thresholds on this tab mean, and where each comes from.', '<div id="s2Scales"></div>', 'mt')}
      ${card('What each kind does to roofs, by covering', 'What the record supports, and no more. The inspection table is a raw count: read the caveat under it before quoting a share.', '<div id="s2Roof"></div>', 'mt')}
      ${card('From event to campaign', 'How the record turns into pages, placements and crews, with the California rules that bound each use.', '<div id="s2Play"></div>', 'mt')}
      <div class="split">
        ${card('Caveats', 'What would change a conclusion drawn from this map.', '<div id="s2Cav"></div>')}
        ${card('Method and sources', 'How fires, landfalls, wind events and reports were built.', '<div id="s2Src"></div>')}
      </div>
      <div class="foot" id="s2Foot"></div></div>`;
    $('#s2Shade', root).value = st.shade;
    $('#s2Kpis', root).innerHTML = kpiHTML([
      { l: 'Wildfires on the ledger', g: 'A', v: N(L.fires.length), d: `${Y0} to ${fy.length ? Math.max(...fy) : Y1}; ${N(L.fires.filter(f => f.dest > 0).length)} destroyed at least one structure` },
      { l: 'Structures destroyed by wildfire', g: 'A', v: K(totDest), d: `CAL FIRE inspections 2013 to 2025; ${K(totDmg)} more damaged` },
      { l: 'Most destructive fire', g: 'A', v: topFire ? esc(topFire.label) : '—', d: topFire ? `${N(topFire.dest)} structures destroyed${isN(topFire.acres) ? ', ' + N(topFire.acres) + ' acres' : ''}` : 'no inspection counts in the data' },
      { l: 'Palisades and Eaton, January 2025', g: 'A', v: pal && eat ? N((pal.dest || 0) + (eat.dest || 0)) : '—', d: pal && eat ? `structures destroyed in the inspections tied to the two perimeters: Palisades ${N(pal.dest)}, Eaton ${N(eat.dest)}` : 'not in this build of the data' },
      { l: 'Atmospheric river landfalls a year', g: 'B', v: isN(arMean) ? D(arMean, 1) : (L.ar.length ? N(L.ar.length) : '—'), d: `${arYears.length ? 'water years ' + arYears[0] + ' to ' + arYears[arYears.length - 1] : 'all years'}; ${N(ar45.length)} ranked AR4 or AR5` },
      { l: 'Strongest gust in a named offshore wind event', g: 'A', v: topGust ? N(topGust.gust) + ' mph' : '—', d: topGust ? `${esc(WKIND[topGust.kind])}, ${esc(hzDate(topGust.start))}, ${esc(topGust.where || '')}; ${N(named.length)} named events on record` : 'no wind events in the data' },
      { l: 'Federal declarations since 2000', g: 'A', v: fdAll ? N(fdAll) : N(FD.length), d: fdAll ? `${N(fdSum('fire'))} for fire (${P(fdSum('fire') / fdAll * 100, 0)}), ${N(fdSum('storm') + fdSum('flood'))} for storm and flood` : 'by kind in the chart below' },
      { l: 'Hail of 1 inch or more', g: 'A', v: N(PTS.filter(p => SF.h1.t(p)).length), d: `located reports${PY0 ? ' ' + PY0 + ' to ' + PY1 : ''}, the whole state; ${N(cntK(2))} tornadoes. Hail is not a roofing market here` },
    ]);
    /* ---------- scope and filters ---------- */
    const yrsTxt = () => st.y0 === st.y1 ? String(st.y0) : st.y0 + ' to ' + st.y1;
    const scoped = () => !!(st.par || st.reg);
    const scopeN = () => st.par ? CNAME(st.par) + ' County' : st.reg ? REGN[st.reg] : 'California';
    const fipsIn = f => { const c = COI[f]; return !!c && (!st.par || f === st.par) && (!st.reg || c.reg === +st.reg); };
    const inScopeP = pi => !!CO[pi] && fipsIn(CO[pi].fips);
    const inScopeZ = z => !!z && inScopeP(z.pi);
    const inY = y => y >= st.y0 && y <= st.y1;
    const fireOk = f => inY(f.year) && (!scoped() || f.fips.some(fipsIn));
    const windOk = w => inY(w.year != null ? w.year : +String(w.start).slice(0, 4)) && (!scoped() || w.fips.some(fipsIn));
    const arOk = a => inY(a.year != null ? a.year : +String(a.start).slice(0, 4));
    const ptOk = p => inY(p.y) && (!scoped() || inScopeP(p.pi));
    const cities = fl => listAnd([...new Set(fl.map(f => CNAME(f)).filter(Boolean))].slice(0, 5));
    /* ---------- tooltips ---------- */
    const fireTip = f => `<div class="tt">${esc(f.name)} Fire, ${f.year}</div><div class="ts">${f.start ? esc(hzDate(f.start)) : ''}${f.fips.length ? ' · ' + esc(cities(f.fips)) + (f.fips.length === 1 ? ' County' : ' counties') : ''}</div>${tipRow('Acres', isN(f.acres) ? N(f.acres) : 'no perimeter on file')}${tipRow('Structures destroyed · damaged', isN(f.dest) ? N(f.dest) + ' · ' + N(f.dmg) : 'no inspection record (before 2013)')}${f.cause ? tipRow('Cause on record', esc(f.cause)) : ''}<div class="tf">Click to open the fire</div>`;
    const arTip = a => `<div class="tt">Atmospheric river, ${esc(CAT_SHORT[a.rank] || '')}</div><div class="ts">${esc(hzDate(a.start))} · ${esc(a.stretch || '')}${a.summer ? ' · summer: moisture from the south' : ''}</div>${tipRow('Peak water vapor transport', N(a.ivt) + ' kg per metre per second')}${tipRow('Hours at the longest point', N(a.dur_h))}${a.se_ok ? tipRow('Storm Events records · reported damage', N(a.se_n) + ' · ' + MM(a.se_dmg)) : ''}<div class="tf">Click to open the landfall</div>`;
    const windTip = w => `<div class="tt">${esc(WKIND[w.kind] || 'High wind')}</div><div class="ts">${esc(hzDate(w.start))}${w.end && w.end !== w.start ? ' to ' + esc(hzDate(w.end)) : ''}</div>${tipRow('Strongest measured gust', isN(w.gust) ? N(w.gust) + ' mph' + (w.where ? ', ' + esc(w.where) : '') : 'none measured')}${tipRow('Zone records · reported damage', N(w.n) + ' · ' + MM(w.dmg))}<div class="tf">Click to open the event</div>`;
    function ptTip(p) {
      const z = p.zi >= 0 ? Z[p.zi] : null;
      return `<div class="tt">${esc(cap1(ptMag(p)))}</div><div class="ts">${MON3[p.m - 1] || ''} ${p.y} · ${DOW[p.dw - 1] || ''} · ${hourLab(p.h)}${p.h >= 0 ? ' PST' : ''} · ${esc(CO[p.pi] ? CO[p.pi].name + ' County' : '')}</div>${z ? tipRow('ZIP', esc(z.zip + ' · ' + z.city)) : ''}${p.dmg > 0 ? tipRow('Property damage NOAA estimated', MM(p.dmg * 1000)) : ''}${isWindK(p.k) ? tipRow('Speed', ptHas(p, 'measured') ? 'measured by an instrument' : 'estimated by the observer') : ''}${ptHas(p, 'burn') ? tipRow('Setting', 'below a burn scar') : ''}${ptHas(p, 'night') ? tipRow('Time', 'after dark') : ''}<div class="tf">${p.k >= 6 ? 'NWS Local Storm Report' : 'NOAA Storm Events record'}</div>`;
    }
    function zipHover(zz, e) {
      const z = ZI[zz]; if (!z) return; const s = SHI[st.shade]; const zf = L.zfire(zz);
      showTip(`<div class="tt">${esc(z.zip)} · ${esc(z.city)}</div><div class="ts">${esc(z.cty)} County · ${N(z.roofs)} one unit roofs</div>${s ? tipRow(esc(s[1]), s[2](z[s[0]])) : ''}${tipRow('Fires on the ledger at or near the ZIP', N(zf.length))}${isN(z.fire_dest) ? tipRow('Structures destroyed · damaged in the ZIP', N(z.fire_dest) + ' · ' + N(z.fire_dmg)) : ''}${tipRow('Located reports in the ZIP, ' + yrsTxt(), N(zipCnt[zz] || 0))}<div class="tf">Click for what has touched this ZIP</div>`, e);
    }
    /* ---------- the map: ZipMap plus a layer of fire outlines drawn here ---------- */
    let zipCnt = {}, firesV = [], windV = [], arV = [];
    const clearSel = () => { st.fire = null; st.ar = null; st.wind = null; st.pt = null; st.zip = null; $('#s2Storm', root).value = ''; };
    const map = new ZipMap($('#s2Map', root), { roads: false, segHit: 'none', countyLabels: false, aria: 'Map of California with wildfire perimeters, atmospheric river landfalls, wind events and located weather reports',
      onSelect: z => selectZip(z), onHover: (z, e) => zipHover(z, e),
      onCounty: f => { st.par = st.par === f ? '' : f; st.reg = ''; $('#s2Par', root).value = st.par; $('#s2Reg', root).value = ''; if (st.par) map.fitCounties([st.par]); else map.reset(); render(); },
      onCountyHover: (f, e) => { const c = COI[f]; if (!c) return; const fs = L.fires.filter(x => inY(x.year) && x.fips.includes(f)); const zc = (TS.zone_county || {})[f] || {}; showTip(countyTip(f, [['Fires on the ledger, ' + yrsTxt(), N(fs.length)], ['Structures destroyed in them (whole fires)', N(sum(fs.map(x => x.dest || 0)))], ['High Wind zone records, 2006 to 2025', N(zc['High Wind'] || zc.hw)], ['Flood and flash flood records', N((zc.Flood || zc.flood || 0) + (zc['Flash Flood'] || zc.fflood || 0))]]).replace(/<div class="tf">[\s\S]*?<\/div>$/, '<div class="tf">Click to focus this county</div>'), e); },
      onPtHover: (i, e) => { if (i >= 1e6) { const f = L.fires[i - 1e6]; if (f) showTip(fireTip(f), e); } else if (PTS[i]) showTip(ptTip(PTS[i]), e); },
      onPt: i => { if (i >= 1e6) openFire(i - 1e6); else { clearSel(); st.pt = +i; render(); } },
      onPinHover: (id, e) => { const k = String(id)[0], n = +String(id).slice(1); if (k === 'f' && L.fires[n]) showTip(fireTip(L.fires[n]), e); else if (k === 'a' && L.arBig[n]) showTip(arTip(L.arBig[n]), e); else if (k === 'w' && L.wind[n]) showTip(windTip(L.wind[n]), e); else if (k === 'c' && L.arPts[n]) { const p = L.arPts[n]; showTip(`<div class="tt">Coast point ${D(p.lat, 1)} N${p.name ? ', ' + esc(p.name) : ''}</div><div class="ts">CW3E landfall catalog, water years 1960 to 2025</div>${tipRow('Landfalls a year, AR1 · AR2 · AR3 · AR4 · AR5', (p.n_yr || []).map(v => D(v, 2)).join(' · '))}${tipRow('Strongest on record', p.max ? 'AR' + p.max + (p.max_date ? ', ' + esc(hzDate(p.max_date)) : '') : '—')}`, e); } },
      onPin: id => { const k = String(id)[0], n = +String(id).slice(1); if (k === 'f') openFire(n); else if (k === 'a') { clearSel(); st.ar = n; render(); } else if (k === 'w') { clearSel(); st.wind = n; render(); } } });
    const vp = map.vp || $('svg g', $('#s2Map', root)); const gF = svgEl('g', { 'aria-label': 'Wildfire perimeters' });
    if (vp) { if (map.gT && map.gT.parentNode === vp) vp.insertBefore(gF, map.gT); else vp.appendChild(gF); }
    const fpaths = {};
    L.fires.filter(f => f.d).sort((a, b) => (b.acres || 0) - (a.acres || 0)).forEach(f => { const p = svgEl('path', { d: f.d }); p.dataset.pt = String(1e6 + f.i); p.style.cssText = 'fill-opacity:.5;stroke-width:1;vector-effect:non-scaling-stroke;cursor:pointer;display:none'; gF.appendChild(p); fpaths[f.i] = p; });
    function drawFires() {
      const on = st.lay.fire; const ink = cssv('--ink');
      L.fires.forEach(f => { const p = fpaths[f.i]; if (!p) return; const show = on && (st.fire != null ? f.i === st.fire : fireOk(f)); p.style.display = show ? '' : 'none'; if (!show) return; const c = fireColor(f.dest); p.style.fill = c; p.style.stroke = f.i === st.fire ? ink : c; p.style.strokeWidth = f.i === st.fire ? 2.2 : 1; p.style.fillOpacity = f.dest == null ? .22 : .5; });
      if (st.fire != null && fpaths[st.fire]) gF.appendChild(fpaths[st.fire]);
    }
    function fitFire(f) { const p = fpaths[f.i]; let bb = null; try { bb = p ? p.getBBox() : null; } catch (e) { bb = null; } if (bb && bb.width + bb.height > 0) map.fitBox([bb.x, bb.x + bb.width], [bb.y, bb.y + bb.height], 60 * (typeof GEO_U !== 'undefined' ? GEO_U : 1)); else if (isN(f.lat)) map.fitLL([[f.lat, f.lon]]); }
    /* light quantile classes, so outlines and dots stay legible on top */
    function lightQ(vals, n) { const R = ramp('lime').slice(0, n); const v = vals.filter(isN).map(Number).sort((a, b) => a - b); if (!v.length) return { f: () => null, R, lo: null, hi: null }; const pos = v.filter(x => x > 0); const br = R.map((_, i) => i === 0 ? 0 : pos.length ? pos[Math.min(pos.length - 1, Math.ceil(pos.length * i / (n - 1)) - 1)] : 0); return { f: x => { if (!isN(x)) return null; if (!(x > 0)) return R[0]; let i = 1; while (i < n - 1 && x > br[i]) i++; return R[i]; }, R, lo: v[0], hi: v[v.length - 1] }; }
    function render() {
      zipCnt = {}; PTS.forEach(p => { if (p.zi < 0 || !Z[p.zi] || !ptOk(p) || !sfOk(st.filt, p)) return; const zz = Z[p.zi].zip; zipCnt[zz] = (zipCnt[zz] || 0) + 1; });
      firesV = L.fires.filter(fireOk); windV = L.wind.filter(windOk); arV = L.arBig.filter(arOk);
      const F = SF[st.filt]; const s = SHI[st.shade]; let legShade = '';
      if (s) { const sc = lightQ(Z.filter(inScopeZ).map(z => z[s[0]]), 6);
        map.fill(zz => { const z = ZI[zz]; if (!inScopeZ(z)) return cssv('--nbr'); return sc.f(z[s[0]]) || cssv('--nodata'); });
        map.dim(scoped() ? new Set(Z.filter(inScopeZ).map(z => z.zip)) : null); map.select(st.zip || null);
        legShade = `<div><div class="lt">${esc(s[1])}</div><div class="ramp">${sc.R.map(c => `<i style="background:${c}"></i>`).join('')}</div><div class="rlabs"><span>${s[2](sc.lo)}</span><span>${s[2](sc.hi)}</span></div></div>`;
      } else { map.fillCounty(f => fipsIn(f) ? cssv('--sunk') : cssv('--nbr')); map.dimCounty(null); map.selectCounty(st.par || null); }
      drawFires();
      const pins = [];
      if (st.lay.fire) firesV.filter(f => !f.d && isN(f.lat) && (st.fire == null || st.fire === f.i)).forEach(f => pins.push({ id: 'f' + f.i, lat: f.lat, lon: f.lon, r: 3.5 + Math.max(0, fireClass(f.dest)), fill: fireColor(f.dest), sel: st.fire === f.i, title: f.label }));
      if (st.lay.ar) { L.arPts.forEach((p, i) => pins.push({ id: 'c' + i, lat: p.lat, lon: p.lon, r: 2 + Math.sqrt(sum(p.n_yr || [])) * 0.9, fill: catColor(1), op: .55 }));
        const seen = {}; arV.slice().sort((a, b) => String(a.start).localeCompare(String(b.start))).forEach(a => { const la = isN(a.peak_lat) ? a.peak_lat : (a.lat0 + a.lat1) / 2; const key = D(la, 1); const k = seen[key] = (seen[key] || 0) + 1; pins.push({ id: 'a' + a.i, lat: la, lon: L.coastLon(la) - 0.2 - 0.13 * k, r: a.rank >= 5 ? 6 : a.rank >= 4 ? 5 : 4, fill: catColor(a.rank), shape: 'diamond', sel: st.ar === a.i }); }); }
      if (st.lay.wind) windV.filter(w => isN(w.lat)).forEach(w => pins.push({ id: 'w' + w.i, lat: w.lat, lon: w.lon, r: w.gust >= 100 ? 6 : w.gust >= 75 ? 5 : 4, fill: wkindColor(w.kind), shape: 'square', sel: st.wind === w.i, op: .8 }));
      if (st.pt != null && PTS[st.pt]) pins.push({ id: 'pt', lat: PTS[st.pt].lat, lon: PTS[st.pt].lon, r: 7, fill: cssv('--accent'), shape: 'diamond', sel: true });
      map.pins(pins);
      const plist = st.lay.pts && st.fire == null ? PTS.map((p, i) => i).filter(i => { const p = PTS[i]; return ptOk(p) && sfOk(st.filt, p); }).map(i => { const p = PTS[i]; const m = p.k === 0 ? (p.mag >= 1.75 ? 2.6 : p.mag >= 1 ? 1.9 : 1.3) : isWindK(p.k) ? (p.mag >= 75 ? 2.6 : p.mag >= 58 ? 1.8 : 1.3) : p.k === 2 ? (p.mag >= 2 ? 3 : p.mag >= 1 ? 2.3 : 1.7) : p.k === 5 ? 2 : 1.4; return { i, lat: p.lat, lon: p.lon, r: 0.7 + 0.75 * m, fill: kindColor(p.k), op: .72 }; }) : [];
      map.points(plist);
      const kindsUsed = [...new Set(plist.map(o => PTS[o.i].k))].sort((a, b) => a - b); const wk = [...new Set(windV.map(w => w.kind))];
      $('#s2Leg', root).innerHTML = legShade +
        (st.lay.fire ? `<div><div class="lt">Fire perimeters by structures destroyed</div><div class="chartleg">${FIRE_BL.map((l, i) => `<span><i style="background:${ramp('green')[2 + i]}"></i>${l}</span>`).join('')}<span><i style="background:${cssv('--ink-3')};opacity:.4"></i>no inspection record</span></div></div>` : '') +
        (st.lay.ar ? `<div><div class="lt">Atmospheric river landfalls (diamonds, set out to sea from the coast point of their peak)</div><div class="chartleg">${[3, 4, 5].map(r => `<span><i style="background:${catColor(r)}"></i>${esc(CAT_SHORT[r])}</span>`).join('')}<span><i style="background:${catColor(1)};opacity:.55"></i>coast point, sized by landfalls a year</span></div></div>` : '') +
        (st.lay.wind && wk.length ? `<div><div class="lt">Wind events (squares, at the strongest measured gust)</div><div class="chartleg">${wk.map(k => `<span><i style="background:${wkindColor(k)}"></i>${esc(WKIND[k] || k)}</span>`).join('')}</div></div>` : '') +
        (plist.length ? `<div><div class="lt">Located reports</div><div class="chartleg">${kindsUsed.map(k => `<span><i style="background:${kindColor(k)}"></i>${esc(KIND_L[k])}</span>`).join('')}</div></div>` : '') +
        `<div class="dn"><b>${N(firesV.length)} fires, ${N(arV.length)} described landfalls, ${N(windV.length)} wind events and ${N(plist.length)} ${esc(F.s)}, ${yrsTxt()}, ${esc(scopeN())}.</b> Landfalls are a coast record and are not narrowed by region or county. Dots are thin by nature: most wind, snow, heat and fire weather records are filed by forecast zone and have no point to draw. ${G('A')}</div>`;
      drawTop(); drawFireTbl(); drawDetail(); drawEvents(); drawCharts();
    }
