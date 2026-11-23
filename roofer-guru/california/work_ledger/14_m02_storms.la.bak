/* ==== 14_m02_storms.js ==== */
/* ==== m02 Storm Ledger ==== */
"use strict";
/* ============================ storm record helpers shared by modules 02, 04, 11 and 14 ============================ */
const ZIX = {}; Z.forEach((z, i) => ZIX[z.zip] = i);
const kmLL = (a, b, c, d) => { const x = (d - b) * Math.cos((a + c) / 2 * Math.PI / 180), y = c - a; return Math.sqrt(x * x + y * y) * 111.32; };
const routeCopy = r => String(r || '');
const routeQuery = r => String(r || '').toLowerCase();
const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DOW3 = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const hourLab = h => h < 0 ? 'hour unknown' : h === 0 ? '12 a.m.' : h < 12 ? h + ' a.m.' : h === 12 ? '12 p.m.' : (h - 12) + ' p.m.';
const listAnd = a => a.length <= 1 ? (a[0] || '') : a.length === 2 ? a[0] + ' and ' + a[1] : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
const cap1 = s => String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1);
/* storm report filters over the NOAA points: t = counts toward the filter; clim = the matching 30 year rate column */
const KIND_L = ['Hail', 'Thunderstorm wind', 'Tornado'];
const SF = {
  all: { l: 'All storm reports', s: 'storm reports', t: () => true, clim: 'hd1' },
  hail: { l: 'Hail, any size', s: 'hail reports', t: p => p.k === 0, clim: 'hd1' },
  h1: { l: 'Hail 1 inch or larger', s: 'reports of hail 1 inch or larger', t: p => ptHas(p, 'h1'), clim: 'hd1', line: 'hail' },
  h175: { l: 'Hail 1.75 inch or larger (golf ball)', s: 'reports of hail 1.75 inch or larger', t: p => ptHas(p, 'h175'), clim: 'hd175', line: 'hail' },
  h2: { l: 'Hail 2 inch or larger', s: 'reports of hail 2 inch or larger', t: p => ptHas(p, 'h2'), clim: 'hd2', line: 'hail' },
  wind: { l: 'Thunderstorm wind, any speed', s: 'thunderstorm wind reports', t: p => p.k === 1, clim: 'wd50' },
  w58: { l: 'Wind 58 mph or more', s: 'reports of wind 58 mph or more', t: p => ptHas(p, 'w58'), clim: 'wd50', line: 'storm' },
  w75: { l: 'Wind 75 mph or more', s: 'reports of wind 75 mph or more', t: p => ptHas(p, 'w75'), clim: 'wd65', line: 'storm' },
  torn: { l: 'Tornado, any strength', s: 'tornadoes', t: p => p.k === 2, clim: 'td1', line: 'storm' },
  ef1: { l: 'Tornado EF1 or stronger', s: 'tornadoes rated EF1 or stronger', t: p => ptHas(p, 'ef1'), clim: 'td1', line: 'storm' },
  dmg: { l: 'Property damage of $10,000 or more', s: 'reports with $10,000 or more in damage', t: p => ptHas(p, 'dmg'), clim: 'hd175' },
  night: { l: 'After dark (8 p.m. to 6 a.m.)', s: 'reports after dark', t: p => ptHas(p, 'night'), clim: 'wd50' },
};
const sfOk = (k, p) => (SF[k] || SF.all).t(p);
const CLIM_L = { hd1: 'Hail days a year, 1 inch or larger within 25 miles', hd175: 'Hail days a year, 1.75 inch or larger within 25 miles', hd2: 'Hail days a year, 2 inch or larger within 25 miles', wd50: 'Wind days a year, 58 mph or more within 25 miles', wd65: 'Wind days a year, 75 mph or more within 25 miles', td1: 'Tornado days a year, EF1 or stronger within 25 miles' };
/* Saffir Simpson class of a sustained wind in knots (-1 below tropical storm force) */
const catOfKt = kt => !isN(kt) || kt < 34 ? -1 : kt < 64 ? 0 : kt < 83 ? 1 : kt < 96 ? 2 : kt < 113 ? 3 : kt < 137 ? 4 : 5;
const CATC_L = ['#8d8578', '#d0892a', '#d36a22', '#b84a1c', '#9c2f2a', '#741c35', '#4f2366'];
const CATC_D = ['#9a9184', '#f0b45c', '#f39a55', '#f07a4a', '#f0605a', '#e0466f', '#c77dd8'];
const catColor = c => (isDark() ? CATC_D : CATC_L)[Math.max(0, Math.min(6, (isN(c) ? c : -1) + 1))];
const CAT_SHORT = ['Below storm force', 'Tropical storm', 'Category 1', 'Category 2', 'Category 3', 'Category 4', 'Category 5'];
const kindColor = k => k === 0 ? ramp('teal')[isDark() ? 6 : 5] : k === 1 ? ramp('green')[isDark() ? 6 : 5] : catColor(4);
const stormKind = r => { const v = (r && (r.life || r.vmax)) || 0; return v >= 64 ? 'Hurricane' : v >= 34 ? 'Tropical Storm' : 'Tropical Depression'; };
const stormName = r => r ? stormKind(r) + ' ' + r.name : '';
const SIDX = {}; SIDS.forEach((s, i) => { SIDX[s[0] + ' ' + s[1]] = i; });
/* every storm's modeled footprint: sid index -> {zip: peak sustained wind in knots}, built once from the per ZIP lists */
let FOOT = null;
function stormFoot(si) { if (!FOOT) { FOOT = {}; Object.entries(DATA.zstorm).forEach(([zz, a]) => a.forEach(([i, kt]) => { (FOOT[i] = FOOT[i] || {})[zz] = kt; })); } return (si != null && FOOT[si]) || {}; }
/* share of roofs a storm damages enough to replace at a given sustained wind (logistic curve fitted to FEMA registrations, module 01) */
const dmgShare = kt => { const d = META.model.DMG; return isN(kt) && kt >= 34 ? d.smax / (1 + Math.exp(-(kt - d.v50) / d.w)) : 0; };
const hailTxt = v => String(Math.round(v * 100) / 100);
const ptMag = p => p.k === 0 ? (p.mag > 0 ? hailTxt(p.mag) + ' inch hail' : 'hail') : p.k === 1 ? (p.mag >= 30 ? N(ktMph(p.mag)) + ' mph wind' : 'damaging wind') : (p.mag >= 1 ? 'EF' + p.mag + ' tornado' : 'EF0 or unrated tornado');
const STAT_L = { TD: 'tropical depression', TS: 'tropical storm', HU: 'hurricane', EX: 'post tropical cyclone', SS: 'subtropical storm', SD: 'subtropical depression', LO: 'remnant low', DB: 'disturbance', WV: 'tropical wave' };
const legTime = t => { try { return new Date(t + ':00:00Z').toLocaleString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric' }) + ' Central'; } catch (e) { return String(t); } };
/* nearest labeled place to a point (for "near Lafayette" style descriptions) */
/* each place gets a radius that grows with population (about 16 km for New Orleans, 2 km for a town of 4,000); the place with the smallest distance to radius ratio wins */
function nearPlace(lat, lon, maxKm) { let best = null, bq = 1e9, bd = 0; PLACES.forEach(c => { if (!isN(c.lat)) return; const d = kmLL(lat, lon, c.lat, c.lon), rad = 1.2 * Math.sqrt(Math.max(2500, c.pop) / 2000), q = d / rad; if (q < bq) { bq = q; best = c; bd = d; } }); if (!best) return null; return bq <= 1 ? { name: best.name, km: bd, inside: true } : bd <= (maxKm || 18) ? { name: best.name, km: bd, inside: false } : null; }
/* fixed breaks for small counts: at most five classes, the darkest steps of a ramp */
function stretchClasses(max) { const b = [...new Set([1, Math.ceil(max * 0.15), Math.ceil(max * 0.3), Math.ceil(max * 0.55)].filter(x => x >= 1 && x < max))].sort((a, b2) => a - b2); b.push(Infinity); return b.slice(-5); }
const stretchIdx = (b, v) => { let i = 0; while (i < b.length - 1 && v > b[i]) i++; return i; };
function stretchColors(b, rn) { const R = ramp(rn || 'green'); return b.map((_, i) => R[7 - (b.length - 1 - i)]); }
const stretchLab = (b, i, d) => { const lo = i === 0 ? 0 : b[i - 1]; const hi = b[i]; const f = v => d ? D(v, 1) : N(v); if (hi === Infinity) return 'over ' + f(lo); if (i === 0) return d ? 'up to ' + f(hi) : (hi === 1 ? '1' : '1 to ' + f(hi)); return d ? f(lo) + ' to ' + f(hi) : (lo + 1 === hi ? f(hi) : f(lo + 1) + ' to ' + f(hi)); };
/* wind bands for storm footprints (knots) and their copy in mph */
const WBANDS = [[34, 50, '39 to 57 mph', '39 to 57'], [50, 64, '58 to 73 mph', '58 to 73'], [64, 83, '74 to 95 mph (Category 1)', '74 to 95 (Cat 1)'], [83, 96, '96 to 110 mph (Category 2)', '96 to 110 (Cat 2)'], [96, 999, '111 mph or more (Category 3 or stronger)', '111+ (Cat 3 or more)']];
/* a storm's footprint totals over the ZIPs that pass ok(z): ZIP counts by wind, homes in strong winds, modeled roofs damaged and the peak wind */
function footStats(label, ok) { const foot = stormFoot(SIDX[label]); let n34 = 0, n50 = 0, n64 = 0, hu50 = 0, hu64 = 0, est = 0, vmax = 0; Object.entries(foot).forEach(([zz, kt]) => { const z = ZI[zz]; if (!z || (ok && !ok(z))) return; if (kt >= 34) n34++; if (kt >= 50) { n50++; hu50 += z.hu || 0; } if (kt >= 64) { n64++; hu64 += z.hu || 0; } est += dmgShare(kt) * (z.roofs || 0); vmax = Math.max(vmax, kt); }); return { n34, n50, n64, hu50, hu64, est, vmax }; }
const RTS = {}; RT.forEach(r => { RTS[r.r] = footStats(r.r); });
/* coastal landmarks for describing a landfall the way the Hurricane Center does */
const LANDMARKS = [['Port Fourchon', 29.11, -90.20], ['Grand Isle', 29.24, -89.99], ['Cocodrie', 29.25, -90.66], ['Dulac', 29.39, -90.71], ['Morgan City', 29.70, -91.21], ['Marsh Island', 29.56, -91.87], ['Intracoastal City', 29.79, -92.15], ['Pecan Island', 29.65, -92.44], ['Creole', 29.81, -93.11], ['Cameron', 29.80, -93.33], ['Holly Beach', 29.77, -93.46], ['Johnson Bayou', 29.75, -93.62], ['Buras', 29.36, -89.53], ['Venice', 29.28, -89.35], ['Pointe a la Hache', 29.58, -89.80], ['the mouth of the Mississippi River', 29.00, -89.25]];
const COMPASS = ['north', 'north northeast', 'northeast', 'east northeast', 'east', 'east southeast', 'southeast', 'south southeast', 'south', 'south southwest', 'southwest', 'west southwest', 'west', 'west northwest', 'northwest', 'north northwest'];
function landfallWhere(lat, lon) { let best = null, bd = 1e9; LANDMARKS.forEach(l => { const d = kmLL(lat, lon, l[1], l[2]); if (d < bd) { bd = d; best = l; } }); if (!best || bd > 90) return D(lat, 1) + ' N, ' + D(-lon, 1) + ' W'; if (bd <= 9) return 'near ' + best[0]; const ang = (Math.atan2((lon - best[2]) * Math.cos(lat * Math.PI / 180), lat - best[1]) * 180 / Math.PI + 360) % 360; return `about ${N(bd / 1.609)} miles ${COMPASS[Math.round(ang / 22.5) % 16]} of ${best[0]}`; }
const lfClock = t => { try { return new Date(String(t).replace(/Z?$/, 'Z')).toLocaleString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' Central'; } catch (e) { return String(t); } };
const wbandOf = kt => WBANDS.findIndex(b => kt >= b[0] && kt < b[1]);

/* ============================ Module 2: Storm Ledger ============================ */
registerModule({
  key: 'storms', num: '02', title: 'Storm Ledger', desc: 'Every hurricane track, hail report, damaging gust and tornado, with modeled roof damage by storm and ZIP',
  mount(root) {
    const st = { filt: 'all', view: 'both', shade: 'rate', y0: 2002, y1: 2026, par: '', reg: '', storm: '', sel: null, pt: null, zip: null, hm: 'count' };
    const YRS = []; for (let y = 2002; y <= 2026; y++) YRS.push(y);
    const R0 = 2016, R1 = 2026;                                   /* located storm reports cover 2016 to 2026 */
    const last26 = Math.max(1, ...PTS.filter(p => p.y === 2026).map(p => p.m));
    const PIDX = PTS.map((p, i) => i);
    const RH = DATA.ts.replace_hist; const rhY = Object.keys(RH).map(Number).sort((a, b) => a - b);
    const ageTot = sum(rhY.map(y => RH[y][0])), stormTot = sum(rhY.map(y => RH[y][1]));
    const byEst = RT.slice().sort((a, b) => RTS[b.r].est - RTS[a.r].est); const topStorm = byEst[0];
    const nHu = RT.filter(r => r.n64 > 0).length; const ops = RT.filter(r => r.op);
    const cntF = f => PTS.filter(p => ptHas(p, f)).length;
    const nTorn = PTS.filter(p => p.k === 2).length;
    const hailMon = Array(12).fill(0); PTS.forEach(p => { if (p.k === 0 && p.m >= 1) hailMon[p.m - 1]++; }); const hailPeak = hailMon.indexOf(Math.max(...hailMon));
    let PNEAR = null;   /* nearest place for each report, computed on first use */
    const pnear = i => { if (!PNEAR) PNEAR = PTS.map(p => { const n = nearPlace(p.lat, p.lon, 8); return n ? n.name : null; }); return PNEAR[i]; };
    const stormOpt = r => `<option value="${esc(r.r)}">${esc(r.r)} · ${esc(r.cat >= 1 ? 'Category ' + r.cat : r.cat === 0 ? 'tropical storm' : 'depression')} · ${K(RTS[r.r].est)} roofs</option>`;
    const decades = [[2020, 2026, '2020s'], [2010, 2019, '2010s'], [2002, 2009, '2000s']];
    root.innerHTML = mastHTML({ eyebrow: 'Module 02 · Storm Ledger · hurricanes, hail, damaging wind and tornadoes', title: 'Storm Ledger',
      dek: `Where storms hit roofs. Every named storm whose winds reached Louisiana from 2002 to 2026 is drawn on its track and colored by strength, with a modeled footprint of the wind each ZIP felt and the roofs it likely damaged. Every hail, damaging wind and tornado report NOAA located in Louisiana from 2016 to 2026 sits at its coordinates. This is the view for storm response: which ZIPs to work after an event, when hail and wind season peaks, and how two decades of storms reset the roof stock that module 01 ages.`,
      meta: [`<b>Storms</b> ${N(RT.length)} named storms, ${N(SEGS.length)} track legs (NHC best track)`, `<b>Reports</b> ${N(PTS.length)} hail, wind and tornado reports, 2016 to 2026 (NOAA)`, '<b>Footprints</b> modeled sustained wind at every ZIP, 1950 to 2026', '<b>Grade</b> A observed reports, B modeled footprints'],
      bar: 'Storm Ledger', barsub: 'Tracks, footprints and storm reports',
      actions: [{ id: 's2Csv', label: '↓ Storms CSV' }, { id: 's2RCsv', label: '↓ Reports CSV' }, { id: 's2Desk', label: 'Campaign Desk ↗', title: 'Send the ZIPs hit by the selected storm, or the ZIPs with the most reports' }, { id: 's2Forge', label: 'Site Forge ↗', title: 'Send a storm page and its ZIPs to the Site Forge' }] }) +
      `<div class="wrap">
      ${callout('', 'Read this first: a storm report is not a damaged roof', `A storm report is a place where a spotter, a member of the public, an emergency manager or an instrument recorded hail, damaging wind or a tornado. Reports cluster along roads and in towns, so a rural parish with few dots may have had the same storm; the 30 year rate behind the map smooths that by counting storm days within 25 miles of each ZIP. Hurricane footprints are modeled from the National Hurricane Center best track and its wind radii, and the roofs each storm damaged come from a damage curve fitted to FEMA registrations (module 01 method). Use reports to place a storm, footprints to size the roof market it left, and neither as proof that a given roof was damaged.`)}
      <div class="kpis" id="s2Kpis"></div>
      <div class="controls">
        <div class="ctl" style="flex:1 1 230px"><label class="fl" for="s2Filt">Report type</label><select id="s2Filt">${Object.entries(SF).map(([k, f]) => `<option value="${k}">${esc(f.l)}</option>`).join('')}</select></div>
        <div class="ctl" style="flex:1 1 230px"><label class="fl" for="s2Storm">Named storm</label><select id="s2Storm"><option value="">All storms in the years chosen</option>${decades.map(([a, b, l]) => `<optgroup label="${l}">${RT.filter(r => r.year >= a && r.year <= b).sort((x, y) => y.year - x.year || y.month - x.month).map(stormOpt).join('')}</optgroup>`).join('')}</select></div>
        <div class="ctl"><label class="fl" for="s2Y0">Years</label><div style="display:flex;gap:6px;align-items:center"><select id="s2Y0">${YRS.map(y => `<option ${y === st.y0 ? 'selected' : ''}>${y}</option>`).join('')}</select><span class="mini">to</span><select id="s2Y1">${YRS.map(y => `<option ${y === st.y1 ? 'selected' : ''}>${y}</option>`).join('')}</select></div></div>
        <div class="ctl"><label class="fl" for="s2Reg">Region</label><select id="s2Reg"><option value="">All nine regions</option>${REG_KEYS.map(k => `<option value="${k}">${esc(REGN[k])}</option>`).join('')}</select></div>
        <div class="ctl"><label class="fl" for="s2Par">Parish</label><select id="s2Par"><option value="">All 64 parishes</option>${PA.slice().sort((a, b) => a.name.localeCompare(b.name)).map(p => `<option value="${p.fips}">${esc(p.name)}</option>`).join('')}</select></div>
        <div class="ctl"><span class="fl">Show</span><div class="seg" id="s2View"><button data-v="tracks" aria-pressed="false">Tracks</button><button data-v="both" aria-pressed="true">Tracks and reports</button><button data-v="reports" aria-pressed="false">Reports</button></div></div>
        <div class="ctl"><span class="fl">Shade ZIPs by</span><div class="seg" id="s2Shade"><button data-v="rate" aria-pressed="true">30 year rate</button><button data-v="count" aria-pressed="false">Reports</button><button data-v="none" aria-pressed="false">None</button></div></div>
      </div>
      <div class="grid2">
        <div class="card mapcard"><div id="s2Map"></div><div class="legend" id="s2Leg"></div></div>
        <div class="stack">
          <div class="card"><div class="card-h" style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start"><div><h3 id="s2Name">Louisiana</h3><p id="s2Sub">Click a track, a report or a ZIP</p></div><span class="pill" id="s2Pill">State</span></div><div class="card-b" id="s2Detail"></div></div>
          <div class="card"><div class="card-h"><h3 id="s2TopH">The hardest hit ZIPs</h3><p id="s2TopSub"></p></div><div class="tscroll short" id="s2Top"></div></div>
        </div>
      </div>
      ${card('Storms ranked', 'Every named storm from 2002 to 2026 whose modeled winds reached tropical storm force at a Louisiana ZIP, for the years and area chosen above. Roofs damaged is the footprint model: the share of one unit roofs a storm replaces at the wind each ZIP felt, summed. Click a row to open the storm.', '<div class="tscroll" id="s2Storms"></div>', 'mt')}
      <div class="split">
        ${card('Roofs damaged, by storm', 'Modeled roofs damaged in the area chosen, the twelve largest storms in the years chosen.', '<div id="s2HV"></div>')}
        ${card('Homes in hurricane force winds', 'Homes in ZIPs where the modeled sustained wind reached 74 mph, the twelve largest storms in the years chosen.', '<div id="s2HR"></div>')}
      </div>
      ${card('When storms strike', 'Day of week by hour of day for the report type, years and area chosen above (NOAA Storm Events, 2016 to 2026). Darker cells hold more reports. This is the grid for staging crews, tarps and emergency ad budgets.', `<div class="seg" id="s2HmMode" style="margin-bottom:10px"><button data-v="count" aria-pressed="true">Count</button><button data-v="share" aria-pressed="false">Share of the week</button></div><div id="s2Heat"></div><div id="s2HeatNote" class="chartnote"></div><div style="margin-top:8px"><button class="ibtn" id="s2HeatCsv">↓ Grid CSV</button></div>`, 'mt')}
      <div class="split">
        ${card('By month', 'Reports by month of the year for the selection, stacked by type; below, named storms that brought tropical storm force winds to Louisiana by month since 1950.', '<div id="s2Mon"></div><div id="s2MonLeg"></div><div id="s2Trop" style="margin-top:14px"></div>')}
        ${card('By year and type', 'Located reports by year for the selection, stacked by type, with the 30 year statewide record from the Storm Prediction Center below.', '<div id="s2Yr"></div><div id="s2YrLeg"></div><div id="s2Spc" style="margin-top:14px"></div>')}
      </div>
      <div class="split">
        ${card('Storm resets: roofs replaced by storms and by age', 'Modeled one unit roof replacements in Louisiana each year, split into replacements driven by wear and those driven by storm damage (module 01 cohort model).', '<div id="s2Reset"></div><div id="s2ResetLeg"></div><p class="chartnote" id="s2ResetNote"></p>')}
        ${card('FEMA roof and wind registrations by disaster', 'OpenFEMA Individuals and Households Program registrations in Louisiana with roof damage or verified wind loss, by declared disaster.', '<div class="tscroll short" id="s2Fema"></div><p class="chartnote" id="s2FemaNote"></p>')}
      </div>
      <div class="split">
        ${card('Hail size, wind speed and tornado strength', 'The size distribution of the reports in the years and area chosen above, all report types.', '<div id="s2Size"></div><p class="chartnote" id="s2SizeNote"></p>')}
        ${card('Places hit again and again', 'Towns with the most reports of the type chosen above, by the nearest town to each report, with the number of separate years they were hit.', '<div class="tscroll short" id="s2Places"></div>')}
      </div>
      ${card('From storm to campaign', 'How the storm record turns into pages, placements and crews, with the Louisiana rules that bound each use.', '<div id="s2Play"></div>', 'mt')}
      <div class="split">
        ${card('Caveats', 'What would change a conclusion drawn from this map.', '<div id="s2Cav"></div>')}
        ${card('Method and sources', 'How tracks, footprints, damage and reports were built.', '<div id="s2Src"></div>')}
      </div>
      <div class="foot" id="s2Foot"></div></div>`;
    $('#s2Kpis', root).innerHTML = kpiHTML([
      { l: 'Named storms with Louisiana winds', g: 'A', v: N(RT.length), d: `2002 to 2026; ${N(nHu)} put modeled hurricane force winds over Louisiana ZIPs` },
      { l: 'Storm share of roof replacements', g: 'B', v: P(stormTot / (stormTot + ageTot) * 100, 0), d: `${K(stormTot)} roofs replaced after storms since 2000, against ${K(ageTot)} replaced for age` },
      { l: 'Most destructive storm', g: 'B', v: esc(topStorm.r), d: `about ${K(RTS[topStorm.r].est)} roofs damaged (model)${topStorm.fema ? '; ' + K(topStorm.fema) + ' FEMA roof registrations' : ''}` },
      { l: 'Hail 1 inch or larger', g: 'A', v: N(cntF('h1')), d: `reports 2016 to 2026; ${N(cntF('h175'))} of golf ball size or larger; peak month ${MONL[hailPeak]}` },
      { l: 'Damaging wind reports', g: 'A', v: N(cntF('w58')), d: `58 mph or more, 2016 to 2026; ${N(cntF('w75'))} of 75 mph or more` },
      { l: 'Tornadoes', g: 'A', v: N(nTorn), d: `2016 to 2026; ${N(cntF('ef1'))} rated EF1 or stronger` },
      { l: '2026 so far', g: 'A', v: N(ops.length) + ' storms', d: `${esc(listAnd(ops.map(r => stormName(r))))}; ${N(PTS.filter(p => p.y === 2026).length)} storm reports through ${MONL[last26 - 1]}` },
    ]);
    let curFoot = {}, zipCnt = {};
    const map = new ZipMap($('#s2Map', root), { roads: true, segHit: 'wide', parishLabels: false, aria: 'Map of Louisiana with hurricane tracks and storm reports',
      onSelect: z => selectZip(z),
      onHover: (z, e) => zipHover(z, e),
      onParish: f => { st.par = st.par === f ? '' : f; st.reg = ''; $('#s2Par', root).value = st.par; $('#s2Reg', root).value = ''; if (st.par) map.fitParishes([st.par]); else map.reset(); render(); },
      onParishHover: (f, e) => { const p = PAI[f]; const ev = p.ev || {}; showTip(parishTip(f, [['Storm reports 2016 to 2026', N(ev.n)], ['Hail 1 inch or larger · 1.75 inch or larger', N(ev.h1) + ' · ' + N(ev.h175)], ['Wind 58 mph or more · tornadoes', N(ev.w58) + ' · ' + N(ev.t)], ['FEMA roof and wind registrations since 2004', N(p.fema_k)], ['Chance of hurricane force winds in a year', P(p.hur64, 1)]]).replace(/<div class="tf">[\s\S]*?<\/div>$/, '<div class="tf">Click to focus this parish</div>'), e); },
      onSegHover: (i, e) => { const s = SEGS[i]; const r = RTI[s.r]; showTip(`<div class="tt">${esc(r ? stormName(r) + ' (' + r.year + ')' : s.r)}</div><div class="ts">${esc(legTime(s.t))}</div>${tipRow('Sustained wind', N(ktMph(s.v)) + ' mph (' + N(s.v) + ' knots)')}${tipRow('Status', esc(cap1(STAT_L[s.stc] || s.stc)) + (s.cat >= 1 ? ', Category ' + s.cat : ''))}${isN(s.p) && s.p > 0 ? tipRow('Central pressure', N(s.p) + ' mb') : ''}${r ? tipRow('Roofs damaged in Louisiana (model)', N(RTS[r.r].est)) : ''}<div class="tf">Click to open the storm</div>`, e); },
      onSeg: i => openStorm(SEGS[+i].r, +i),
      onPtHover: (i, e) => showTip(ptTip(PTS[i]), e),
      onPt: i => { st.pt = +i; drawDetail(); } });
    const yrsTxt = () => st.y0 === st.y1 ? String(st.y0) : st.y0 + ' to ' + st.y1;
    const ry0 = () => Math.max(R0, st.y0), ry1 = () => Math.min(R1, st.y1);
    const rptYears = () => Math.max(0, ry1() - ry0() + 1);
    const rptYrsTxt = () => rptYears() <= 0 ? 'no report years in range' : ry0() === ry1() ? String(ry0()) : ry0() + ' to ' + ry1();
    const scopeN = () => st.par ? PNAME(st.par) + ' Parish' : st.reg ? REGN[st.reg] : 'Louisiana';
    const inScopeP = pi => (!st.par || (PA[pi] && PA[pi].fips === st.par)) && (!st.reg || (PA[pi] && PA[pi].reg === +st.reg));
    const inScopeZ = z => !!z && (!st.par || z.fips === st.par) && (!st.reg || (PA[z.pi] && PA[z.pi].reg === +st.reg));
    const scoped = () => !!(st.par || st.reg);
    const ptOk = p => p.y >= st.y0 && p.y <= st.y1 && inScopeP(p.pi);
    const cnt = (arr, kf) => { const o = {}; arr.forEach(x => { const k = kf(x); if (k != null) o[k] = (o[k] || 0) + 1; }); return o; };
    function ptTip(p) {
      const z = p.zi >= 0 ? Z[p.zi] : null;
      return `<div class="tt">${esc(cap1(ptMag(p)))}</div><div class="ts">${MON3[p.m - 1] || ''} ${p.y} · ${DOW[p.dw - 1] || ''} · ${hourLab(p.h)} CST · ${esc(PA[p.pi] ? PA[p.pi].name + ' Parish' : '')}</div>${z ? tipRow('ZIP', esc(z.zip + ' · ' + z.city)) : ''}${p.dmg > 0 ? tipRow('Property damage NOAA estimated', MM(p.dmg * 1000)) : ''}${p.k === 1 ? tipRow('Speed', ptHas(p, 'measured') ? 'measured by an instrument' : 'estimated by the observer') : ''}${ptHas(p, 'night') ? tipRow('Time', 'after dark') : ''}<div class="tf">NOAA Storm Events record</div>`;
    }
    /* storm statistics in the area chosen: footprint counts, homes in strong winds and modeled roofs damaged */
    function stormStats() {
      const sc = scoped();
      return RT.filter(r => r.year >= st.y0 && r.year <= st.y1).map(r => {
        const f = sc ? footStats(r.r, inScopeZ) : RTS[r.r];
        return Object.assign({ r: r.r, o: r, year: r.year, month: r.month, fema: r.fema, dr: r.dr, op: r.op, lf: r.lf }, f, { cat: sc ? catOfKt(f.vmax) : r.cat, vmax: sc ? f.vmax : r.vmax });
      }).filter(o => o.n34 > 0);
    }
    function compute() {
      zipCnt = {}; PTS.forEach(p => { if (p.zi < 0 || !ptOk(p) || !sfOk(st.filt, p)) return; const zz = Z[p.zi].zip; zipCnt[zz] = (zipCnt[zz] || 0) + 1; });
      curFoot = st.storm ? stormFoot(SIDX[st.storm]) : {};
    }
    function zipHover(zz, e) {
      const z = ZI[zz]; if (!z) return; let rows = '';
      if (st.storm) { const kt = curFoot[zz]; rows = tipRow('Modeled peak sustained wind', isN(kt) ? N(ktMph(kt)) + ' mph, ' + catLab(catOfKt(kt)) : 'below storm force') + tipRow('Roofs damaged (model)', isN(kt) ? N(dmgShare(kt) * z.roofs) + ' of ' + N(z.roofs) : '0 of ' + N(z.roofs)); }
      else { const ck = SF[st.filt].clim; rows = tipRow(esc(cap1(SF[st.filt].s)) + ', ' + rptYrsTxt(), N(zipCnt[zz] || 0)) + tipRow(CLIM_L[ck], D(z[ck], 2)) + tipRow('Chance of hurricane force winds in a year', P(z.hur64, 1)) + tipRow('Last hurricane force winds', z.last64 ? String(z.last64) : 'none since 1950'); }
      showTip(`<div class="tt">${esc(z.zip)} · ${esc(z.city)}</div><div class="ts">${esc(z.cty)} Parish · ${N(z.roofs)} one unit roofs</div>${rows}<div class="tf">Click for the ZIP storm history</div>`, e);
    }
    /* quantile classes on the lightest n steps of the slate ramp, so report dots stay legible on top */
    function lightQ(vals, n) { const R = ramp('lime').slice(0, n); const v = vals.filter(isN).map(Number).sort((a, b) => a - b); if (!v.length) return { f: () => null, R, lo: null, hi: null }; const br = R.map((_, i) => v[Math.min(v.length - 1, Math.ceil(v.length * (i + 1) / n) - 1)]); return { f: x => { if (!isN(x)) return null; let i = 0; while (i < n - 1 && x > br[i]) i++; return R[i]; }, R, lo: v[0], hi: v[v.length - 1] }; }
    function render() {
      compute();
      const F = SF[st.filt]; const R = ramp('lime'); let legShade = '';
      if (st.storm) {
        const C = ramp('green'); const bc = [C[1], C[3], C[5], C[6], C[7]];
        map.fill(zz => { const z = ZI[zz]; if (!inScopeZ(z) && scoped()) return cssv('--nbr'); const kt = curFoot[zz]; const b = isN(kt) ? wbandOf(kt) : -1; return b >= 0 ? bc[b] : cssv('--sunk'); });
        map.dim(scoped() ? new Set(Z.filter(inScopeZ).map(z => z.zip)) : null);
        legShade = `<div><div class="lt">Modeled peak sustained wind, ${esc(st.storm)}</div><div class="ramp">${bc.map(c => `<i style="background:${c}"></i>`).join('')}</div><div class="rlabs" style="gap:4px">${WBANDS.map(b => `<span>${esc(b[2].replace(/ \(.*\)$/, ''))}</span>`).join('')}</div></div>`;
      } else if (st.shade === 'rate') {
        const ck = F.clim; const sc = lightQ(Z.filter(inScopeZ).map(z => z[ck]), st.view === 'tracks' ? 8 : 6);
        map.fill(zz => { const z = ZI[zz]; if (!inScopeZ(z)) return cssv('--nbr'); return sc.f(z[ck]) || cssv('--nodata'); });
        map.dim(scoped() ? new Set(Z.filter(inScopeZ).map(z => z.zip)) : null);
        legShade = `<div><div class="lt">${esc(CLIM_L[ck])}, 1996 to 2025</div><div class="ramp">${sc.R.map(c => `<i style="background:${c}"></i>`).join('')}</div><div class="rlabs"><span>${D(sc.lo, 2)}</span><span>${D(sc.hi, 2)}</span></div></div>`;
      } else if (st.shade === 'count') {
        const mx = Math.max(1, ...Object.entries(zipCnt).filter(([zz]) => inScopeZ(ZI[zz])).map(e => e[1])); const B = stretchClasses(mx); const C = stretchColors(B, 'lime');
        map.fill(zz => { const z = ZI[zz]; if (!inScopeZ(z)) return cssv('--nbr'); const v = zipCnt[zz] || 0; return v > 0 ? C[stretchIdx(B, v)] : cssv('--sunk'); });
        map.dim(scoped() ? new Set(Z.filter(inScopeZ).map(z => z.zip)) : null);
        legShade = `<div><div class="lt">${esc(cap1(F.s))} in the ZIP, ${rptYrsTxt()}</div><div class="ramp">${C.map(c => `<i style="background:${c}"></i>`).join('')}</div><div class="rlabs" style="gap:4px">${B.map((_, i) => `<span>${stretchLab(B, i, false)}</span>`).join('')}</div></div>`;
      } else {
        map.fillParish(f => inScopeP(PAI[f].i) ? cssv('--sunk') : cssv('--nbr')); map.dimParish(null); map.selectParish(st.par || null);
      }
      if (st.shade !== 'none' || st.storm) map.select(st.zip || null);
      const showTracks = st.view !== 'reports';
      map.roads(s => {
        if (!showTracks) return { hide: true };
        const r = RTI[s.r];
        if (st.storm) { if (s.r !== st.storm) return { hide: true }; return { c: catColor(s.cat), w: 2.6 + Math.max(0, s.cat) * 0.55, z: s.v }; }
        if (!r || r.year < st.y0 || r.year > st.y1) return { hide: true };
        return { c: catColor(s.cat), w: 1.1 + Math.max(0, s.cat + 1) * 0.42, z: s.v };
      });
      map.selectSeg(st.sel);
      const showPts = st.view !== 'tracks' && !st.storm;
      const plist = showPts ? PIDX.filter(i => { const p = PTS[i]; return ptOk(p) && sfOk(st.filt, p); }).map(i => { const p = PTS[i]; const big = st.view === 'reports'; const m = p.k === 0 ? (p.mag >= 2 ? 3 : p.mag >= 1.75 ? 2.4 : p.mag >= 1 ? 1.8 : 1.3) : p.k === 1 ? (p.mag >= 65 ? 2.6 : p.mag >= 55 ? 1.9 : 1.4) : (p.mag >= 2 ? 3.2 : p.mag >= 1 ? 2.5 : 1.8); return { i, lat: p.lat, lon: p.lon, r: big ? 1.25 * (1 + m) : 0.7 + 0.8 * m, fill: kindColor(p.k), op: big ? .85 : .72 }; }) : [];
      map.points(plist);
      map.pins(st.pt != null && PTS[st.pt] ? [{ id: 'pt', lat: PTS[st.pt].lat, lon: PTS[st.pt].lon, r: 7, fill: cssv('--accent'), shape: 'diamond', sel: true }] : []);
      const catsUsed = [-1, 0, 1, 2, 3, 4, 5];
      $('#s2Leg', root).innerHTML = (legShade || '') + (showTracks ? `<div><div class="lt">Track strength</div><div class="chartleg">${catsUsed.map(c => `<span><i style="background:${catColor(c)}"></i>${esc(CAT_SHORT[c + 1])}</span>`).join('')}</div></div>` : '') + (showPts ? `<div><div class="lt">Reports</div><div class="chartleg">${[0, 1, 2].map(k => `<span><i style="background:${kindColor(k)}"></i>${esc(KIND_L[k])}</span>`).join('')}</div></div>` : '') +
        `<div class="dn">${st.storm ? `<b>${esc(stormName(RTI[st.storm]))}, ${esc(MONL[RTI[st.storm].month - 1])} ${RTI[st.storm].year}.</b> ZIPs are shaded by the modeled peak sustained wind; gray ZIPs stayed below 39 mph. Gusts ran higher than the sustained winds shown. ${G('B')}` : `<b>Tracks are every named storm with Louisiana winds, ${yrsTxt()}; dots are ${N(plist.length)} ${esc(F.s)}, ${rptYrsTxt()}.</b> ${st.shade === 'rate' ? 'ZIP shading is the long run rate within 25 miles, which corrects for reports clustering in towns.' : st.shade === 'count' ? 'ZIP shading counts the reports located inside each ZIP.' : ''} Larger dots are bigger hail, faster wind and stronger tornadoes. ${G('A')}`}</div>`;
      drawTop(); drawStorms(); drawDetail(); drawCharts();
    }
    function drawTop() {
      const host = $('#s2Top', root);
      if (st.storm) {
        const rows = Object.entries(curFoot).map(([zz, kt]) => ({ zip: zz, z: ZI[zz], kt })).filter(o => o.z && inScopeZ(o.z) && o.kt >= 34).map(o => ({ zip: o.zip, city: o.z.city, par: o.z.cty, kt: o.kt, roofs: o.z.roofs, est: dmgShare(o.kt) * (o.z.roofs || 0), sh: dmgShare(o.kt) * 100 }));
        if (host._mode !== 'storm') { host._st = null; host._mode = 'storm'; }
        $('#s2TopH', root).textContent = 'The hardest hit ZIPs'; $('#s2TopSub', root).textContent = `${st.storm}: ZIPs by modeled roofs damaged${scoped() ? ' in ' + scopeN() : ''}. Click a row for the ZIP storm history.`;
        dataTable(host, [{ k: 'zip', h: 'ZIP', l: 1, f: v => `<b>${esc(v)}</b>` }, { k: 'city', h: 'City', l: 1 }, { k: 'kt', h: 'Wind mph', f: v => N(ktMph(v)), t: 'Modeled peak sustained wind at the ZIP' }, { k: 'roofs', h: 'Roofs', f: v => N(v) }, { k: 'est', h: 'Damaged', f: v => N(v), t: 'Modeled roofs damaged' }, { k: 'sh', h: 'Share', f: v => P(v, 0) }], rows, { sortKey: 'est', id: r => r.zip, onClick: zz => selectZip(zz), rowClass: r => r.zip === st.zip ? 'sel' : '' });
        return;
      }
      const agg = {}; PTS.forEach(p => { if (p.zi < 0 || !ptOk(p)) return; const z = Z[p.zi]; const o = agg[z.zip] = agg[z.zip] || { zip: z.zip, city: z.city, n: 0, h1: 0, h175: 0, w58: 0, t: 0, dmg: 0 }; if (sfOk(st.filt, p)) o.n++; if (ptHas(p, 'h1')) o.h1++; if (ptHas(p, 'h175')) o.h175++; if (ptHas(p, 'w58')) o.w58++; if (p.k === 2) o.t++; o.dmg += p.dmg; });
      const rows = Object.values(agg).filter(o => o.n > 0);
      if (host._mode !== 'rep') { host._st = null; host._mode = 'rep'; }
      $('#s2TopH', root).textContent = 'ZIPs with the most reports'; $('#s2TopSub', root).textContent = `${SF[st.filt].l}, ${rptYrsTxt()}, ${scopeN()}. Reports located inside each ZIP. Click a row for the ZIP storm history.`;
      dataTable(host, [{ k: 'zip', h: 'ZIP', l: 1, f: v => `<b>${esc(v)}</b>` }, { k: 'city', h: 'City', l: 1 }, { k: 'n', h: 'Selection', f: v => N(v) }, { k: 'h1', h: 'Hail 1 in+', f: v => N(v) }, { k: 'w58', h: 'Wind 58+', f: v => N(v) }, { k: 't', h: 'Tornado', f: v => N(v) }], rows, { sortKey: 'n', id: r => r.zip, onClick: zz => selectZip(zz), rowClass: r => r.zip === st.zip ? 'sel' : '' });
      if (!rows.length) host.innerHTML = '<p class="mini" style="padding:10px">No located reports of this type in the years and area chosen. Reports start in 2016.</p>';
    }
    function lfTxt(lf) { if (!lf) return 'none; its winds reached the state from offshore or across a state line'; return `${landfallWhere(lf.lat, lf.lon)}, ${lfClock(lf.t)}, ${N(ktMph(lf.v))} mph`; }
    function drawStorms() {
      const S = stormStats(); const host = $('#s2Storms', root);
      dataTable(host, [
        { k: 'r', h: 'Storm', l: 1, f: (v, o) => `<b>${esc(v)}</b>${o.op ? ' <span class="mini">2026 preliminary</span>' : ''}` }, { k: 'month', h: 'Month', l: 1, f: v => MON3[v - 1] },
        { k: 'cat', h: 'Louisiana strength', l: 1, v: o => o.cat, f: v => esc(CAT_SHORT[v + 1]), t: 'Saffir Simpson class of the strongest modeled sustained wind over the area chosen' },
        { k: 'vmax', h: 'Peak mph', f: v => N(ktMph(v)) }, { k: 'n34', h: 'ZIPs 39 mph+', f: v => N(v) }, { k: 'n64', h: 'ZIPs 74 mph+', f: v => N(v) },
        { k: 'hu50', h: 'Homes 58 mph+', f: v => N(v) }, { k: 'hu64', h: 'Homes 74 mph+', f: v => N(v) },
        { k: 'est', h: 'Roofs damaged (model)', f: v => N(v) }, { k: 'dr', h: 'FEMA', l: 1, f: v => v ? 'DR ' + esc(v) : '—' }, { k: 'fema', h: 'FEMA roof regs', f: v => isN(v) ? N(v) : '—', t: 'Statewide registrations with roof damage or verified wind loss' },
      ], S, { sortKey: 'est', id: o => o.r, onClick: r => openStorm(r), rowClass: o => o.r === st.storm ? 'sel' : '' });
      if (!S.length) host.innerHTML = '<p class="mini" style="padding:10px">No named storm reached tropical storm force in the area and years chosen.</p>';
      const top = S.slice().sort((a, b) => b.est - a.est).slice(0, 12);
      if (top.length) hbarChart($('#s2HV', root), top.map(o => ({ l: o.r, v: o.est, t: K(o.est), color: o.r === st.storm ? cssv('--ink') : catColor(o.cat), tip: `<div class="tt">${esc(stormName(o.o))} (${o.year})</div>${tipRow('Roofs damaged (model)', N(o.est))}${tipRow('Homes in 74 mph winds', N(o.hu64))}${o.fema ? tipRow('FEMA roof registrations, statewide', N(o.fema)) : ''}` })), { W: 560, L: 110, R: 54, aria: 'Storms by modeled roofs damaged' });
      else $('#s2HV', root).innerHTML = '<p class="mini">No storm in the selection.</p>';
      const hh = S.filter(o => o.hu64 > 0).sort((a, b) => b.hu64 - a.hu64).slice(0, 12);
      if (hh.length) hbarChart($('#s2HR', root), hh.map(o => ({ l: o.r, v: o.hu64, t: K(o.hu64), color: o.r === st.storm ? cssv('--ink') : catColor(o.cat), tip: `<div class="tt">${esc(stormName(o.o))} (${o.year})</div>${tipRow('Homes in 74 mph winds', N(o.hu64))}${tipRow('Homes in 58 mph winds', N(o.hu50))}${tipRow('ZIPs at hurricane force', N(o.n64))}` })), { W: 560, L: 110, R: 54, aria: 'Storms by homes in hurricane force winds' });
      else $('#s2HR', root).innerHTML = '<p class="mini">No storm in the selection brought hurricane force winds to the area chosen.</p>';
      const huYrs = [...new Set(S.filter(o => o.n64 > 0).map(o => o.year))];
      $('#s2HR', root).insertAdjacentHTML('beforeend', `<p class="chartnote">${N(huYrs.length)} of the ${N(st.y1 - st.y0 + 1)} seasons in ${yrsTxt()} brought hurricane force winds to ${esc(scopeN())}. Large storms reset thousands of roofs at once, which is why replacement demand comes in waves (see the storm reset chart below and module 01's roof age histogram).</p>`);
    }
    function zipsOfStorm(r, n) { const foot = stormFoot(SIDX[r]); return Object.entries(foot).filter(([zz]) => inScopeZ(ZI[zz]) && ZI[zz].res_ok).map(([zz, kt]) => [zz, dmgShare(kt) * (ZI[zz].roofs || 0)]).filter(e => e[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, n || 25).map(e => e[0]); }
    function zipsOfReports(n) { return Object.entries(zipCnt).filter(([zz]) => ZI[zz] && ZI[zz].res_ok && inScopeZ(ZI[zz])).sort((a, b) => b[1] - a[1]).slice(0, n || 25).map(e => e[0]); }
    function stormCities(r, n) { const foot = stormFoot(SIDX[r]); const c = {}; Object.entries(foot).forEach(([zz, kt]) => { const z = ZI[zz]; if (!z || !z.city) return; c[z.city] = (c[z.city] || 0) + dmgShare(kt) * (z.roofs || 0); }); return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, n || 3).map(e => e[0]); }
    function drawDetail() {
      const box = $('#s2Detail', root);
      if (st.pt != null && PTS[st.pt]) {
        const p = PTS[st.pt]; const z = p.zi >= 0 ? Z[p.zi] : null;
        $('#s2Name', root).textContent = cap1(ptMag(p)); $('#s2Sub', root).textContent = `${MONL[p.m - 1] || ''} ${p.y} · ${PA[p.pi] ? PA[p.pi].name + ' Parish' : ''}`; $('#s2Pill', root).textContent = 'Report';
        const near = PIDX.filter(i => i !== st.pt && PTS[i].y === p.y && PTS[i].m === p.m && kmLL(p.lat, p.lon, PTS[i].lat, PTS[i].lon) <= 40);
        box.innerHTML = ptTip(p).replace(/<div class="tf">.*<\/div>$/, '') + `<div class="dsec">Same month within 25 miles</div><div class="rowl"><span>Hail · wind · tornado reports</span><b>${N(near.filter(i => PTS[i].k === 0).length)} · ${N(near.filter(i => PTS[i].k === 1).length)} · ${N(near.filter(i => PTS[i].k === 2).length)}</b></div>
          <p class="mini" style="margin-top:10px">One record from the NOAA Storm Events Database. It locates the storm, not a damaged roof: canvass and advertise to the ZIPs around it, and confirm damage roof by roof with the owner's permission.</p><div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap">${z ? `<button class="ibtn" id="s2PZip">Open ZIP ${esc(z.zip)}</button>` : ''}<button class="ibtn" id="s2PDesk">ZIPs within 10 miles to the Desk ↗</button><button class="ibtn" id="s2Clr">Clear</button></div>`;
        if (z) $('#s2PZip', root).onclick = () => selectZip(z.zip);
        $('#s2PDesk', root).onclick = () => goModule('desk', { zips: Z.filter(q => q.res_ok && isN(q.lat) && kmLL(p.lat, p.lon, q.lat, q.lon) <= 16).sort((a, b) => kmLL(p.lat, p.lon, a.lat, a.lon) - kmLL(p.lat, p.lon, b.lat, b.lon)).slice(0, 25).map(q => q.zip), event: cap1(ptMag(p)) + ', ' + MONL[p.m - 1] + ' ' + p.y });
        $('#s2Clr', root).onclick = () => { st.pt = null; render(); };
        return;
      }
      if (st.storm && RTI[st.storm]) {
        const r = RTI[st.storm]; const o = stormStats().find(x => x.r === st.storm) || { n34: 0, n50: 0, n64: 0, hu50: 0, hu64: 0, est: 0, vmax: 0, cat: -1 };
        const foot = curFoot; const bands = WBANDS.map(() => ({ roofs: 0, est: 0, n: 0 }));
        Object.entries(foot).forEach(([zz, kt]) => { const z = ZI[zz]; if (!inScopeZ(z)) return; const b = wbandOf(kt); if (b < 0) return; bands[b].roofs += z.roofs || 0; bands[b].est += dmgShare(kt) * (z.roofs || 0); bands[b].n++; });
        const zips = zipsOfStorm(st.storm, 25); const leg = st.sel != null && SEGS[st.sel] && SEGS[st.sel].r === st.storm ? SEGS[st.sel] : null;
        $('#s2Name', root).textContent = stormName(r) + ' (' + r.year + ')'; $('#s2Sub', root).textContent = `${MONL[r.month - 1]} ${r.year}${r.op ? ' · 2026 operational best track, preliminary' : ''}${scoped() ? ' · ' + scopeN() : ''}`; $('#s2Pill', root).textContent = 'Storm';
        box.innerHTML = `<div class="big">${N(o.est)}<span style="font-size:13px;font-weight:500;color:var(--ink-3)"> roofs damaged (model)${scoped() ? ' in ' + esc(scopeN()) : ' in Louisiana'}</span></div><div class="mini" style="margin-bottom:10px">Peak modeled sustained wind ${N(ktMph(o.vmax))} mph over ${esc(scoped() ? scopeN() : 'Louisiana')} (${esc(CAT_SHORT[o.cat + 1])}) · lifetime peak ${N(ktMph(r.life))} mph</div>
          <div class="rowl"><span>Louisiana landfall</span><b style="text-align:right;white-space:normal;max-width:64%">${esc(lfTxt(r.lf))}</b></div>
          <div class="rowl"><span>ZIPs at 39 · 58 · 74 mph or more</span><b>${N(o.n34)} · ${N(o.n50)} · ${N(o.n64)}</b></div>
          <div class="rowl"><span>Homes in 58 mph · 74 mph winds</span><b>${N(o.hu50)} · ${N(o.hu64)}</b></div>
          <div class="rowl"><span>FEMA declaration · roof and wind registrations</span><b>${r.dr ? 'DR ' + esc(r.dr) + ' · ' + N(r.fema) : 'none for individual assistance'}</b></div>
          ${leg ? `<div class="rowl"><span>Track point clicked</span><b>${esc(legTime(leg.t))}, ${N(ktMph(leg.v))} mph</b></div>` : ''}
          <div class="dsec">Footprint by wind band${scoped() ? ', ' + esc(scopeN()) : ''}</div>
          <div class="xscroll"><table class="keep"><thead><tr><th class="l">Sustained wind, mph</th><th>ZIPs</th><th>Roofs</th><th>Damaged</th></tr></thead><tbody>${WBANDS.map((b, i) => `<tr><td class="l">${esc(b[3])}</td><td>${N(bands[i].n)}</td><td>${N(bands[i].roofs)}</td><td>${N(bands[i].est)}</td></tr>`).join('')}</tbody></table></div>
          <div class="dsec">Parishes with the most homes in 58 mph winds</div>
          ${r.pars.length ? r.pars.map(([pi, n]) => `<div class="rowl"><span>${esc(PA[pi] ? PA[pi].name : '')} Parish</span><b>${N(n)} homes</b></div>`).join('') : '<p class="mini">No parish saw modeled sustained winds of 58 mph.</p>'}
          <div class="dsec">Storm page brief</div>${brief(r, zips)}
          <div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap"><button class="ibtn" id="s2SDesk">${N(Math.min(25, zips.length))} footprint ZIPs to the Desk ↗</button><button class="ibtn" id="s2SForge">Storm page to the Forge ↗</button><button class="ibtn" id="s2Brief">Copy brief</button><button class="ibtn" id="s2Clr">Clear</button></div>`;
        $('#s2SDesk', root).onclick = () => goModule('desk', { zips, storm: st.storm });
        $('#s2SForge', root).onclick = () => goModule('forge', { zips: zips.slice(0, 12), storm: st.storm });
        $('#s2Brief', root).onclick = e => copyText($('#s2BriefTxt', root).innerText, e.currentTarget);
        $('#s2Clr', root).onclick = () => closeStorm();
        return;
      }
      if (st.zip && ZI[st.zip]) {
        const z = ZI[st.zip]; const zi = ZIX[st.zip]; const ks = PTS.filter(p => p.zi === zi);
        const list = (DATA.zstorm[st.zip] || []).map(([si, kt]) => ({ si, kt, s: SIDS[si] })).filter(o => o.s).sort((a, b) => b.s[1] - a.s[1] || b.kt - a.kt);
        $('#s2Name', root).textContent = `${z.zip} · ${z.city}`; $('#s2Sub', root).textContent = `${z.cty} Parish · storm history of the ZIP`; $('#s2Pill', root).textContent = 'ZIP';
        box.innerHTML = `<div class="big">${N(list.filter(o => o.kt >= 64).length)}<span style="font-size:13px;font-weight:500;color:var(--ink-3)"> storms with modeled hurricane force winds since 1950</span></div><div class="mini" style="margin-bottom:10px">${N(list.length)} with tropical storm force winds · last hurricane force winds ${z.last64 ? z.last64 + ' (' + z.yrs64 + ' years ago)' : 'none since 1950'} · ${N(z.roofs)} one unit roofs</div>
          <div class="rowl"><span>Hail days a year, 1 inch · 1.75 inch (25 miles)</span><b>${D(z.hd1, 2)} · ${D(z.hd175, 2)}</b></div>
          <div class="rowl"><span>Wind days a year 58 mph · EF1 tornado days</span><b>${D(z.wd50, 1)} · ${D(z.td1, 2)}</b></div>
          <div class="rowl"><span>Chance of hurricane force winds in a year</span><b>${P(z.hur64, 1)}</b></div>
          <div class="rowl"><span>Reports in the ZIP 2016 to 2026: hail 1 in · wind 58 mph · tornado</span><b>${N(z.ev_h1)} · ${N(z.ev_w58)} · ${N(z.ev_t)}</b></div>
          <div class="rowl"><span>FEMA roof and wind registrations since 2004 · since 2020</span><b>${N(z.fema_k)} · ${N(z.fema_20)}</b></div>
          <div class="dsec">Roof replacements by year: wear and storms (model)</div><div id="s2ZHist"></div><div id="s2ZHistLeg"></div>
          <div class="dsec">Every storm with tropical storm force winds at the ZIP</div>
          <div class="xscroll" style="max-height:260px;overflow:auto"><table class="keep"><thead><tr><th class="l">Storm</th><th>Wind mph</th><th class="l">Class at the ZIP</th><th>Roofs damaged</th></tr></thead><tbody>${list.map(o => { const lab = o.s[0] + ' ' + o.s[1]; const has = !!RTI[lab]; return `<tr${has ? ` class="click" data-storm="${esc(lab)}"` : ''}><td class="l">${has ? '<b>' + esc(lab) + '</b>' : esc(lab)}</td><td>${N(ktMph(o.kt))}</td><td class="l">${esc(CAT_SHORT[catOfKt(o.kt) + 1])}</td><td>${P(dmgShare(o.kt) * 100, 0)}</td></tr>`; }).join('') || '<tr><td class="l" colspan="4">No modeled tropical storm force winds since 1950.</td></tr>'}</tbody></table></div>
          <p class="mini" style="margin-top:8px">${N(ks.length)} located storm reports in the ZIP from 2016 to 2026. Roofs damaged is the modeled share of roofs a storm of that strength replaces; storms since 2002 open in this module.</p>
          <div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap"><button class="ibtn" id="s2ZIdx">Open in the Roof Demand Index ↗</button><button class="ibtn" id="s2ZStock">Roof stock ↗</button><button class="ibtn" id="s2ZDesk">ZIP to the Desk ↗</button><button class="ibtn" id="s2Clr">Clear</button></div>`;
        const h = DATA.rhist[st.zip];
        if (h) { const C = ramp('green'); barChart($('#s2ZHist', root), { cats: rhY.map(String), series: [{ name: 'Wear', color: ramp('lime')[4], values: h.map(a => +D(a[0], 0)) }, { name: 'Storms', color: C[6], values: h.map(a => +D(a[1], 0)) }], stacked: true, H: 170, W: 470, L: 40, rot: true, fmt: v => N(v), aria: 'Modeled roof replacements by year in ' + st.zip }); $('#s2ZHistLeg', root).innerHTML = legendRow([{ name: 'Wear', color: ramp('lime')[4], sq: 1 }, { name: 'Storms', color: C[6], sq: 1 }]); }
        $$('[data-storm]', box).forEach(el => el.onclick = () => openStorm(el.dataset.storm));
        $('#s2ZIdx', root).onclick = () => goModule('index', { zip: st.zip }); $('#s2ZStock', root).onclick = () => goModule('stock', { zip: st.zip }); $('#s2ZDesk', root).onclick = () => goModule('desk', { zips: [st.zip] });
        $('#s2Clr', root).onclick = () => { st.zip = null; map.reset(); render(); };
        return;
      }
      const ps = PTS.filter(ptOk); const sel = ps.filter(p => sfOk(st.filt, p)); const yrs = rptYears();
      $('#s2Name', root).textContent = scopeN(); $('#s2Sub', root).textContent = 'Click a track, a report or a ZIP'; $('#s2Pill', root).textContent = st.par ? 'Parish' : st.reg ? 'Region' : 'State';
      const S = stormStats().sort((a, b) => b.est - a.est).slice(0, 6);
      const k0 = ps.filter(p => p.k === 0), k1 = ps.filter(p => p.k === 1), k2 = ps.filter(p => p.k === 2);
      const has = (a, f) => a.filter(p => ptHas(p, f)).length;
      const P0 = st.par ? PAI[st.par] : null;
      box.innerHTML = `<div class="big">${N(sel.length)}<span style="font-size:13px;font-weight:500;color:var(--ink-3)"> ${esc(SF[st.filt].s)}, ${rptYrsTxt()}</span></div><div class="mini" style="margin-bottom:10px">${yrs ? D(sel.length / yrs, 1) + ' a year · ' : ''}${MM(sum(sel.map(p => p.dmg)) * 1000)} in property damage NOAA estimated</div>
        <div class="rowl"><span>Hail: all · 1 inch · 1.75 inch</span><b>${N(k0.length)} · ${N(has(k0, 'h1'))} · ${N(has(k0, 'h175'))}</b></div>
        <div class="rowl"><span>Wind: all · 58 mph · 75 mph</span><b>${N(k1.length)} · ${N(has(k1, 'w58'))} · ${N(has(k1, 'w75'))}</b></div>
        <div class="rowl"><span>Tornadoes: all · EF1 or stronger</span><b>${N(k2.length)} · ${N(has(k2, 'ef1'))}</b></div>
        <div class="dsec">The most destructive storms, ${yrsTxt()}</div>
        ${S.map(o => `<div class="rowl click" data-storm="${esc(o.r)}" style="cursor:pointer"><span><b>${esc(o.r)}</b> · ${esc(CAT_SHORT[o.cat + 1])}</span><b>${K(o.est)} roofs</b></div>`).join('') || '<p class="mini">No named storm in the years chosen.</p>'}
        ${P0 ? `<div class="dsec">${esc(P0.name)} Parish ledger</div><div class="rowl"><span>NOAA zone events since 2000: hurricane · tropical storm · surge · high wind</span><b>${N((P0.trop || {}).hurr)} · ${N((P0.trop || {}).ts)} · ${N((P0.trop || {}).surge)} · ${N((P0.trop || {}).hw)}</b></div><div class="rowl"><span>FEMA roof and wind registrations since 2004</span><b>${N(P0.fema_k)}</b></div><div class="rowl"><span>Hurricane force storms since 2000 · strongest modeled wind</span><b>${N(P0.n64_00)} · ${N(ktMph(P0.vmax_00))} mph</b></div><div class="rowl"><span>Roofs replaced after storms, 2000 to 2026 (model)</span><b>${N(sum(Object.values(P0.hist || {}).map(a => a[1])))}</b></div>`
          : `<div class="dsec">Statewide record (Storm Prediction Center, 1996 to 2025)</div><div class="rowl"><span>Hail reports a year: all · 1 inch · 2 inch</span><b>${N(mean(SPCY.map(y => SPC[y].hail)))} · ${N(mean(SPCY.map(y => SPC[y].hail1)))} · ${D(mean(SPCY.map(y => SPC[y].hail2)), 1)}</b></div><div class="rowl"><span>Wind reports a year: all · 75 mph</span><b>${N(mean(SPCY.map(y => SPC[y].wind)))} · ${N(mean(SPCY.map(y => SPC[y].wind65)))}</b></div><div class="rowl"><span>Tornadoes a year</span><b>${N(mean(SPCY.map(y => SPC[y].torn)))}</b></div>`}
        <p class="mini" style="margin-top:10px">Pick a storm above or click a track for its footprint, the ZIPs it hit hardest and a storm page brief.</p>`;
      $$('[data-storm]', box).forEach(el => el.onclick = () => openStorm(el.dataset.storm));
    }
    const SPC = DATA.ts.year; const SPCY = Object.keys(SPC).map(Number).filter(y => y >= 1996 && y <= 2025).sort((a, b) => a - b);
    function brief(r, zips) {
      const cities = stormCities(r.r, 3); const c0 = cities[0] || (PA[(r.pars[0] || [0])[0]] || {}).name || 'Louisiana'; const c1 = cities[1];
      const nm = stormName(r); const lc = s => String(s).toLowerCase(); const T = RTS[r.r];
      const lines = [
        `H1: ${houseClean(`Roof Repair After ${nm} in ${c0}${c1 ? ' and ' + c1 : ''}`)}`,
        `Title: ${houseClean(`${nm} Roof Damage Repair | ${c0}, Louisiana`)}`,
        `Lead fact: ${houseClean(`${nm} brought modeled sustained winds of about ${N(ktMph(r.vmax))} mph to Louisiana in ${MONL[r.month - 1]} ${r.year}, ` + (T.hu50 ? `and about ${K(T.hu64 || T.hu50)} homes sat in ZIP codes where its winds reached ${T.hu64 ? 'hurricane force' : '58 mph'}.` : `with tropical storm force winds over ${N(T.n34)} Louisiana ZIP codes.`))}`,
        r.fema ? `Second fact: ${houseClean(`FEMA recorded ${N(r.fema)} Louisiana registrations with roof damage or verified wind loss after ${r.name}, and most insured damage never reaches FEMA at all.`)}` : '',
        `Sections: how to protect a damaged roof today (tarp, photographs, stay off the roof); how to confirm a roofer's Louisiana license and insurance; why every reroof needs a permit and inspections; why the deductible is yours to pay under Louisiana law; how FORTIFIED roofs and the Louisiana Fortify Homes grants work; the towns we serve.`,
        `Query cluster: ${[lc(nm) + ' roof damage', 'roof repair ' + lc(c0), 'emergency roof tarp ' + lc(c0), 'storm damage roof repair ' + lc(c1 || c0), 'roof replacement after hurricane ' + lc(c0)].join('; ')}`,
        `Internal links: the city pages for ${listAnd(cities) || c0}, the storm damage page and the FORTIFIED page (verify each against your live sitemap before linking).`,
        `Never advertise as an insurance claims specialist or offer to interpret or handle the claim (R.S. 37:2159.1(7), (8)); never offer to pay, waive or rebate a deductible (R.S. 51:451); keep prices at pre storm levels while an emergency declaration stands (R.S. 29:732).`,
      ].filter(Boolean);
      return `<div class="mini" id="s2BriefTxt" style="line-height:1.55">${lines.map(l => `<div style="margin-bottom:4px">${esc(l)}</div>`).join('')}</div><div class="mini" style="margin-top:4px">Footprint ZIPs by roofs damaged: ${zips.slice(0, 12).map(esc).join(', ') || '—'}</div>`;
    }
    function drawCharts() {
      const ps = PTS.filter(p => ptOk(p) && sfOk(st.filt, p)); const F = SF[st.filt];
      const g = Array.from({ length: 7 }, () => Array(24).fill(0)); ps.forEach(p => { if (p.h >= 0 && p.h < 24 && p.dw >= 1) g[p.dw - 1][p.h] += 1; });
      const tot = sum(g.flat()); const mode = st.hm || 'count'; const val = v => mode === 'share' ? (tot ? v / tot * 100 : 0) : v;
      const sc = qScale(g.flat().map(val), 'teal', 1);
      const W = 820, H = 250, L = 46, T = 22, cw = (W - L - 8) / 24, ch = (H - T - 26) / 7;
      const s = chartFrame($('#s2Heat', root), W, H, 'Storm reports by day of week and hour');
      for (let h = 0; h < 24; h += 3) s.appendChild(svgEl('text', { x: L + h * cw + cw / 2, y: 14, class: 'ax', 'text-anchor': 'middle' }, hourLab(h).replace(' a.m.', 'a').replace(' p.m.', 'p')));
      g.forEach((row, d) => { s.appendChild(svgEl('text', { x: L - 8, y: T + d * ch + ch / 2 + 4, class: 'ax', 'text-anchor': 'end' }, DOW3[d]));
        row.forEach((v, h) => { const r = svgEl('rect', { x: L + h * cw + 1, y: T + d * ch + 1, width: cw - 2, height: ch - 2, rx: 3, fill: (v > 0 && sc.f(val(v))) || cssv('--nodata') }); r.addEventListener('mousemove', e => showTip(`<div class="tt">${DOW[d]}, ${hourLab(h)} CST</div>${tipRow(esc(cap1(F.s)), N(v))}${tipRow('Share of the week', P(tot ? v / tot * 100 : 0, 2))}${tipRow('Versus an even spread', D(tot ? v / (tot / 168) : 0, 2) + '×')}`, e)); r.addEventListener('mouseleave', hideTip); s.appendChild(r); }); });
      s.appendChild(svgEl('text', { x: L, y: H - 6, class: 'axl' }, `${F.l}, ${rptYrsTxt()}, ${N(tot)} reports. Hours are Central Standard Time as NOAA records them.`));
      const hrs = Array(24).fill(0); g.forEach(row => row.forEach((v, h) => hrs[h] += v));
      const cells = []; g.forEach((row, d) => row.forEach((v, h) => cells.push({ d, h, v }))); cells.sort((a, b) => b.v - a.v);
      const top17 = cells.slice(0, 17); const topShare = tot ? sum(top17.map(c => c.v)) / tot * 100 : 0;
      const aft = tot ? sum(hrs.slice(12, 20)) / tot * 100 : 0; const ngt = tot ? (sum(hrs.slice(20)) + sum(hrs.slice(0, 6))) / tot * 100 : 0;
      $('#s2HeatNote', root).innerHTML = tot ? `Noon to 8 p.m. (a third of the day) holds <b>${P(aft, 0)}</b> of these reports and 8 p.m. to 6 a.m. holds <b>${P(ngt, 0)}</b>. The busiest 10 percent of the week's hours (17 of 168) hold <b>${P(topShare, 0)}</b>; an even spread would hold 10 percent. Peak cells: ${top17.slice(0, 5).map(c => `${DOW3[c.d]} ${hourLab(c.h)}`).join(', ')}. Day of week carries little signal for weather; the hour does. Storm time is not search time: leak and tarp searches spike the same evening and the next morning, inspection and replacement searches follow for weeks. Use the grid to stage crews and emergency budgets, not to switch ads off.` : 'No reports in the selection.';
      $('#s2HeatCsv', root).onclick = () => saveFile('louisiana-storm-reports-day-hour.csv', toCSV(['day'].concat([...Array(24).keys()].map(h => 'h' + h)), g.map((row, d) => [DOW[d]].concat(row)), `NOAA Storm Events located reports, Louisiana, ${F.l}, ${rptYrsTxt()}, ${scopeN()}. Hours are Central Standard Time.`));
      const kinds = [0, 1, 2].filter(k => ps.some(p => p.k === k));
      const mo = kinds.map(k => { const a = Array(12).fill(0); ps.forEach(p => { if (p.k === k && p.m >= 1) a[p.m - 1]++; }); return { name: KIND_L[k], color: kindColor(k), values: a }; });
      if (mo.length) { barChart($('#s2Mon', root), { cats: MON3, series: mo, stacked: true, H: 220, W: 560, L: 40, fmt: v => N(v), aria: 'Storm reports by month' }); $('#s2MonLeg', root).innerHTML = legendRow(mo.map(x => ({ name: x.name, color: x.color, sq: 1 }))); }
      else { $('#s2Mon', root).innerHTML = '<p class="mini">No reports in the selection.</p>'; $('#s2MonLeg', root).innerHTML = ''; }
      const yy = []; for (let y = ry0(); y <= ry1(); y++) yy.push(y);
      const ys = kinds.map(k => ({ name: KIND_L[k], color: kindColor(k), values: yy.map(y => ps.filter(p => p.k === k && p.y === y).length) }));
      if (ys.length && yy.length) { barChart($('#s2Yr', root), { cats: yy.map(y => y === 2026 ? '2026*' : String(y)), series: ys, stacked: true, H: 220, W: 560, L: 40, fmt: v => N(v), aria: 'Storm reports by year and type' }); $('#s2YrLeg', root).innerHTML = legendRow(ys.map(x => ({ name: x.name, color: x.color, sq: 1 }))) + (yy.includes(2026) ? `<p class="chartnote">2026 runs through ${MONL[last26 - 1]}; NOAA posts each month about three months after it ends.</p>` : ''); }
      else { $('#s2Yr', root).innerHTML = '<p class="mini">No reports in the selection. Located reports start in 2016.</p>'; $('#s2YrLeg', root).innerHTML = ''; }
      drawSize(); drawPlaces();
    }
    function drawSize() {
      const ps = PTS.filter(ptOk);
      const rows = [
        { l: 'Hail under 1 inch', k: 0, t: p => p.k === 0 && p.mag < 1 }, { l: 'Hail 1 to 1.74 inch', k: 0, t: p => p.k === 0 && p.mag >= 1 && p.mag < 1.75 }, { l: 'Hail 1.75 to 1.99 inch', k: 0, t: p => p.k === 0 && p.mag >= 1.75 && p.mag < 2 }, { l: 'Hail 2 inch or larger', k: 0, t: p => p.k === 0 && p.mag >= 2 },
        { l: 'Wind under 58 mph', k: 1, t: p => p.k === 1 && p.mag < 50 }, { l: 'Wind 58 to 74 mph', k: 1, t: p => p.k === 1 && p.mag >= 50 && p.mag < 65 }, { l: 'Wind 75 mph or more', k: 1, t: p => p.k === 1 && p.mag >= 65 },
        { l: 'Tornado EF0 or unrated', k: 2, t: p => p.k === 2 && p.mag < 1 }, { l: 'Tornado EF1', k: 2, t: p => p.k === 2 && p.mag === 1 }, { l: 'Tornado EF2 or stronger', k: 2, t: p => p.k === 2 && p.mag >= 2 },
      ].map(r => Object.assign(r, { v: ps.filter(r.t).length }));
      hbarChart($('#s2Size', root), rows.map(r => ({ l: r.l, v: r.v, t: N(r.v), color: kindColor(r.k) })), { W: 520, L: 170, R: 50, rowH: 22, aria: 'Storm reports by size and strength' });
      const h = ps.filter(p => p.k === 0), w = ps.filter(p => p.k === 1);
      const meas = w.filter(p => ptHas(p, 'measured')).length;
      $('#s2SizeNote', root).innerHTML = h.length || w.length ? `${P(h.length ? h.filter(p => p.mag >= 1).length / h.length * 100 : null, 0)} of hail reports are 1 inch or larger, the size at which asphalt shingles begin to bruise and shed granules; ${P(h.length ? h.filter(p => p.mag >= 1.75).length / h.length * 100 : null, 0)} reach 1.75 inch (golf ball), the size that damages most asphalt shingles. ${P(w.length ? meas / w.length * 100 : null, 0)} of wind speeds were measured by an instrument; the rest are observer estimates, which cluster at 58 mph because that is the warning threshold. Tornado ratings come from damage surveys, so an EF0 in an empty field and an EF0 through a subdivision read the same here.` : 'No reports in the selection.';
    }
    function drawPlaces() {
      const ag = {}; PIDX.forEach(i => { const p = PTS[i]; if (!ptOk(p) || !sfOk(st.filt, p)) return; const nm = pnear(i); if (!nm) return; const k = nm + '|' + p.pi; const o = ag[k] = ag[k] || { nm, pi: p.pi, n: 0, h1: 0, h175: 0, w58: 0, t: 0, ys: new Set() }; o.n++; if (ptHas(p, 'h1')) o.h1++; if (ptHas(p, 'h175')) o.h175++; if (ptHas(p, 'w58')) o.w58++; if (p.k === 2) o.t++; o.ys.add(p.y); });
      const rows = Object.values(ag).map(o => Object.assign(o, { yrs: o.ys.size }));
      dataTable($('#s2Places', root), [{ k: 'nm', h: 'Town', l: 1, f: (v, r) => `<b>${esc(v)}</b> <span class="mini">${esc(PA[r.pi] ? PA[r.pi].name : '')}</span>` }, { k: 'n', h: 'Reports', f: v => N(v) }, { k: 'yrs', h: 'Years hit', f: v => N(v) }, { k: 'h175', h: 'Hail 1.75 in+', f: v => N(v) }, { k: 'w58', h: 'Wind 58+', f: v => N(v) }, { k: 't', h: 'Tornado', f: v => N(v) }], rows, { sortKey: 'n' });
      if (!rows.length) $('#s2Places', root).innerHTML = '<p class="mini" style="padding:10px">No reports in the selection.</p>';
    }
    function selectZip(zz) { if (!ZI[zz]) return; st.zip = st.zip === zz && !st.storm ? null : zz; st.pt = null; if (st.storm) { st.storm = ''; st.sel = null; $('#s2Storm', root).value = ''; } render(); }
    function openStorm(r, seg) { if (!RTI[r]) return; st.storm = r; st.sel = seg != null ? seg : null; st.pt = null; st.zip = null; $('#s2Storm', root).value = r; const y = RTI[r].year; if (y < st.y0 || y > st.y1) { st.y0 = Math.min(st.y0, y); st.y1 = Math.max(st.y1, y); $('#s2Y0', root).value = st.y0; $('#s2Y1', root).value = st.y1; } if (st.view === 'reports') { st.view = 'both'; $$('#s2View button', root).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === 'both'))); } render(); if (!scoped()) map.fitRoute(r); }
    function closeStorm() { st.storm = ''; st.sel = null; $('#s2Storm', root).value = ''; map.reset(); render(); }
    /* static cards (redrawn on a theme change so their colors follow) */
    function drawStatic() {
      const C = ramp('green'); const ser = [{ name: 'Wear (age driven)', color: ramp('lime')[4], values: rhY.map(y => RH[y][0]) }, { name: 'Storm damage', color: C[6], values: rhY.map(y => RH[y][1]) }];
      barChart($('#s2Reset', root), { cats: rhY.map(String), series: ser, stacked: true, H: 240, W: 560, L: 52, rot: true, fmt: v => K(v), aria: 'Modeled roof replacements by year, wear and storms' });
      $('#s2ResetLeg', root).innerHTML = legendRow(ser.map(x => ({ name: x.name, color: x.color, sq: 1 })));
      const big = rhY.filter(y => RH[y][1] > 50000).map(y => `${y} (${K(RH[y][1])})`);
      const avgAge = mean(rhY.filter(y => y >= 2022).map(y => RH[y][0]));
      $('#s2ResetNote', root).innerHTML = `Storms replaced about <b>${K(stormTot)}</b> one unit roofs from 2000 to 2026, ${P(stormTot / (stormTot + ageTot) * 100, 0)} of all replacements. Most of it came in a handful of years: ${listAnd(big)}. A storm year replaces many times the normal wear volume of about ${K(avgAge)} roofs, then suppresses wear replacements for years because the stock is young, which is why age driven demand dropped after 2005 and again after 2021. The cohorts those storms installed come due together twenty or so years later. ${G('B')}`;
      const FY = DATA.ts.fema_year;
      dataTable($('#s2Fema', root), [{ k: 'dr', h: 'DR', l: 1, f: v => esc(v) }, { k: 'nm', h: 'Event', l: 1, f: v => `<b>${esc(v)}</b>` }, { k: 'y', h: 'Year', f: v => String(v) }, { k: 'n', h: 'Registrations', f: v => N(v) }, { k: 'own', h: 'Owners', f: v => P(v, 0) }, { k: 'ins', h: 'Insured', f: v => P(v, 0), t: 'Share of registrants reporting homeowners insurance' }, { k: 'm', h: 'Measure', l: 1 }],
        FY.map(a => ({ dr: a[0], nm: a[1], y: a[2], n: a[3], own: a[3] ? a[5] / a[3] * 100 : null, ins: a[3] ? a[6] / a[3] * 100 : null, m: a[4] ? 'roof damage' : 'wind loss' })), { sortKey: 'y' });
      const pre = FY.filter(a => a[4]), post = FY.filter(a => !a[4]);
      $('#s2FemaNote', root).innerHTML = `Through 2017, FEMA inspectors flagged roof damage directly (${N(sum(pre.map(a => a[3])))} registrations). From 2020 the flag is gone, so the atlas counts registrations with verified real property loss and no flood damage (${N(sum(post.map(a => a[3])))}), which is mostly wind and mostly roofs. FEMA counts only people who applied for federal help: ${P(FEMA_INS.sh, 0)} of these registrants (${P(FEMA_INS.ownSh, 0)} of the owners) reported homeowners insurance, and owners whose policy paid for the roof had little reason to apply, so insured roof claims after the same storms ran larger still. ${G('A')}`;
      const tm = DATA.ts.trop_month; barChart($('#s2Trop', root), { cats: MON3, series: [{ name: 'Named storms with Louisiana winds, 1950 to 2025', color: catColor(1), values: tm }], H: 150, W: 560, L: 40, fmt: v => N(v), aria: 'Named storms with Louisiana winds by month since 1950' });
      $('#s2Trop', root).insertAdjacentHTML('beforeend', `<p class="chartnote">${N(sum(tm))} storms brought tropical storm force winds to Louisiana from 1950 to 2025; ${P(sum(tm.slice(7, 9)) / sum(tm) * 100, 0)} came in August and September. Hail peaks in ${MONL[hailPeak]}, so the two storm seasons barely overlap: spring is hail and squall lines, late summer is tropical.</p>`);
      const spcS = [{ name: 'Hail', color: kindColor(0), values: SPCY.map(y => SPC[y].hail) }, { name: 'Thunderstorm wind', color: kindColor(1), values: SPCY.map(y => SPC[y].wind) }, { name: 'Tornado', color: kindColor(2), values: SPCY.map(y => SPC[y].torn) }];
      barChart($('#s2Spc', root), { cats: SPCY.map(String), series: spcS, stacked: true, H: 170, W: 560, L: 40, rot: true, fmt: v => N(v), aria: 'Storm Prediction Center reports in Louisiana by year, 1996 to 2025' });
      $('#s2Spc', root).insertAdjacentHTML('beforeend', `<p class="chartnote">Storm Prediction Center reports for Louisiana, 1996 to 2025. Report counts rise over time partly because more people report (spotter networks, phones, social media), so compare decades with care.</p>`);
    }
    drawStatic();
    const lic = META.lic;
    $('#s2Play', root).innerHTML = proseTable([
      ['<b>Storm pages</b>', `One page per named storm and the towns it hit hardest, published within a day or two of landfall and updated as damage comes in. Lead with the National Hurricane Center facts and the footprint, then what to do to protect a damaged roof, how to check a license, permits and inspections, and the deductible law. Open a storm above for a ready brief. Do not dress the page up as claims help: since August 1, 2025 a contractor may not advertise as an insurance claims specialist or offer claim or policy interpretation services (Act 144 of 2025, R.S. 37:2159.1(7), (8)).`, 'A'],
      ['<b>Hail days</b>', `Switch the report type to hail 1.75 inch or larger, pick the year, and send the ZIPs with reports and the ZIPs around them to the Desk. Hail of that size damages most asphalt shingles, and 1 inch hail begins to. Offer inspections, not outcomes: a contractor may not interpret coverage, adjust the claim or take an assignment of benefits before the work is done and the insurer has inspected (R.S. 37:2159.1, Act 734 of 2022).`, 'A'],
      ['<b>Canvassing</b>', `Door to door sales of $25 or more carry the federal three day right to cancel with the written notice the rule prescribes (16 CFR Part 429), and storm canvassing does not fit the emergency exception. Check the parish or city solicitation ordinance and carry the license card. Never quote a price that waives, absorbs or rebates the deductible (R.S. 51:451); contracts of $1,000 or more paid from a claim need the bold deductible notice (R.S. 51:452).`, 'A'],
      ['<b>After a declaration</b>', `While a state of emergency stands, prices for tarping, repairs and materials may not exceed pre emergency prices except for documented cost increases (R.S. 29:732). Keep a dated price book from before the season. Since August 1, 2026 anyone who advertises, solicits, bids or performs residential roofing of $7,500 or more needs the Residential Roofing or Residential Construction license (Act 757 of 2026), and every reroof needs a permit and inspections (Act 239 of 2025).`, 'A'],
      ['<b>Out of state crews</b>', `${N(lic.out)} of the ${N(lic.n)} roofing license records on file (${P(lic.out / lic.n * 100, 0)}) belong to out of state firms, and they arrive with the storms. A local address, a license number on every ad and permits pulled in the homeowner's parish are the trust signals that beat them. Module 07 has the roster.`, 'B'],
      ['<b>Wind season and hail season</b>', `Hail peaks in ${MONL[hailPeak]} and tropical winds in August and September (charts above). Budget for two storm seasons a year: retail replacement spend in winter and early spring, storm reserves from March to May and from August to October. Module 05 plans the budget; module 14 watches the next 72 hours.`, 'B'],
      ['<b>What never to publish</b>', `The address, photo or name of a specific damaged home or owner without written permission; "free roof", "we pay your deductible", "we handle your claim" or "insurance approved"; storm footprints presented as proof that a particular roof was damaged. Use storm level facts with their source.`, 'A'],
    ].map(r => [r[0], r[1], G(r[2])]));
    $('#s2Cav', root).innerHTML = proseTable([
      ['Reports follow people', 'Storm reports cluster in towns and along highways; a hail swath over farmland may produce one report or none. The 30 year rates count storm days within 25 miles of each ZIP, which smooths the gaps but cannot fill them.'],
      ['Sizes are estimates', 'Most hail sizes are judged against coins and balls, and most wind speeds are estimated; observers round to the warning thresholds of 1 inch hail and 58 mph wind.'],
      ['Footprints are modeled', 'Sustained one minute winds at 10 meters over open ground, from best track positions interpolated hourly and the published wind radii (2004 on) or a fitted wind profile before that. Gusts run higher, trees and buildings slow winds inland, and tornadoes inside hurricanes are not in the footprint.'],
      ['Damage is a scale, not a count', 'The damage curve is fitted to FEMA registrations multiplied up to roofs; FEMA misses most insured owners, so the multiplier is the weakest assumption in the chain (grade D). Rank storms and ZIPs with it; do not quote it as a count of claims.'],
      ['Single storms can miss', `The curve ranks storm and ZIP pairs well (rank correlation ${D(META.model.DMG.rho, 2)}) but misses individual storms. Rita is the clearest case: about ${K((RTS['Rita 2005'] || {}).est)} modeled roofs against ${K((RTI['Rita 2005'] || {}).fema)} FEMA roof registrations, 86 percent of them in the Lake Charles and Lafayette ZIP areas (705 and 706), so Rita's real roof damage in southwest Louisiana and Acadiana ran well above what its modeled winds predict.`],
      ['Since 2020, wind loss stands in for roof damage', 'FEMA stopped publishing its roof damage flag after 2017. Verified real property loss without flood damage is mostly roofs after a hurricane, but it also includes siding, windows and fallen trees.'],
      ['2026 is preliminary', 'The 2026 tracks are operational best tracks, revised after the season; the 2026 reports run through the most recent month NOAA has published.'],
      ['Tornado points are touchdowns', 'Each tornado is drawn where it began; tracks can run miles beyond the dot.'],
    ]);
    $('#s2Src', root).innerHTML = `<p class="body">Reports are NOAA Storm Events records for Louisiana with coordinates, typed as hail (1,198), thunderstorm wind (3,174) and tornado (743), placed in ZIPs and parishes by their coordinates. Tracks are HURDAT2 six hourly best track positions interpolated to hourly legs; each ZIP's peak sustained wind is the strongest wind any hour of the storm put over the ZIP's center, from the quadrant wind radii where published and a modified Rankine profile elsewhere. Roofs damaged = the logistic damage share at that wind (fitted to ${N(META.model.DMG.n)} ZIP and storm pairs of FEMA registrations, rank correlation ${D(META.model.DMG.rho, 2)}) × one unit roofs (ACS). Storm resets come from the module 01 cohort model. The 30 year rates are Storm Prediction Center storm days within 25 miles of each ZIP center.</p>` + srcRows([
      ['Storm reports', 'NOAA NCEI Storm Events Database, Louisiana details files 2016 to 2026', 'A', 'through ' + MONL[last26 - 1] + ' 2026', 'https://www.ncdc.noaa.gov/stormevents/'],
      ['30 year rates and yearly record', 'NOAA Storm Prediction Center severe weather database (hail, wind, tornado), 1996 to 2025', 'A', '2025 files', 'https://www.spc.noaa.gov/wcm/'],
      ['Tracks and wind radii', 'NHC HURDAT2 Atlantic best track, 1851 to 2025; 2026 operational best tracks', 'A', 'HURDAT2 2025 release; 2026 preliminary', 'https://www.nhc.noaa.gov/data/'],
      ['Wind and roof damage', 'OpenFEMA Individuals and Households Program valid registrations, Louisiana disasters 2004 to 2026', 'A', 'v2', 'https://www.fema.gov/openfema-data-page/individuals-and-households-program-valid-registrations-v2'],
      ['Homes and roofs', 'Census ACS 2020 to 2024 five year estimates, ZCTA', 'A', '2024 release', 'https://www.census.gov/programs-surveys/acs'],
    ]);
    $('#s2Foot', root).innerHTML = `<b style="color:var(--ink)">Uplift Louisiana Roofing Atlas</b>, module 02. Storm reports from NOAA NCEI and SPC, tracks from the National Hurricane Center, registrations from OpenFEMA. No homeowner names or addresses are kept. Compiled ${esc(new Date(META.compiled + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }))}.`;
    // wiring
    $('#s2Filt', root).onchange = e => { st.filt = e.target.value; render(); };
    $('#s2Storm', root).onchange = e => { if (e.target.value) openStorm(e.target.value); else closeStorm(); };
    const yfix = () => { if (st.y0 > st.y1) { const t = st.y0; st.y0 = st.y1; st.y1 = t; $('#s2Y0', root).value = st.y0; $('#s2Y1', root).value = st.y1; } if (st.storm && (RTI[st.storm].year < st.y0 || RTI[st.storm].year > st.y1)) { st.storm = ''; st.sel = null; $('#s2Storm', root).value = ''; } };
    $('#s2Y0', root).onchange = e => { st.y0 = +e.target.value; yfix(); render(); };
    $('#s2Y1', root).onchange = e => { st.y1 = +e.target.value; yfix(); render(); };
    $('#s2Reg', root).onchange = e => { st.reg = e.target.value; st.par = ''; $('#s2Par', root).value = ''; if (st.reg) map.fitParishes(PA.filter(p => p.reg === +st.reg).map(p => p.fips)); else map.reset(); render(); };
    $('#s2Par', root).onchange = e => { st.par = e.target.value; st.reg = ''; $('#s2Reg', root).value = ''; if (st.par) map.fitParishes([st.par]); else map.reset(); render(); };
    wireSeg($('#s2View', root), v => { st.view = v; render(); });
    wireSeg($('#s2Shade', root), v => { st.shade = v; render(); });
    wireSeg($('#s2HmMode', root), v => { st.hm = v; drawCharts(); });
    $('#s2Csv', root).onclick = () => { const S = stormStats().sort((a, b) => b.est - a.est); saveFile('louisiana-storms.csv', toCSV(['storm', 'year', 'month', 'strength_in_area', 'peak_wind_mph', 'zips_39mph', 'zips_58mph', 'zips_74mph', 'homes_58mph', 'homes_74mph', 'roofs_damaged_model', 'fema_disaster', 'fema_registrations_statewide', 'preliminary'], S.map(o => [o.r, o.year, o.month, CAT_SHORT[o.cat + 1], ktMph(o.vmax), o.n34, o.n50, o.n64, o.hu50, o.hu64, Math.round(o.est), o.dr || '', isN(o.fema) ? o.fema : '', o.op ? 'yes' : '']), `Uplift Louisiana Roofing Atlas, module 02. Named storms with modeled tropical storm force winds at a Louisiana ZIP, ${yrsTxt()}, ${scopeN()}. Winds are modeled sustained winds from NHC best tracks; roofs damaged is the FEMA fitted damage curve times one unit roofs.`)); };
    $('#s2RCsv', root).onclick = () => { const ps = PTS.filter(p => ptOk(p) && sfOk(st.filt, p)); saveFile('louisiana-storm-reports.csv', toCSV(['year', 'month', 'weekday', 'hour_cst', 'type', 'magnitude', 'unit', 'parish', 'zip', 'lat', 'lon', 'damage_usd', 'measured', 'after_dark'], ps.map(p => [p.y, p.m, DOW[p.dw - 1] || '', p.h, KIND_L[p.k], p.k === 1 ? ktMph(p.mag) : p.mag, p.k === 0 ? 'inches' : p.k === 1 ? 'mph' : 'EF', PA[p.pi] ? PA[p.pi].name : '', p.zi >= 0 ? Z[p.zi].zip : '', p.lat, p.lon, Math.round(p.dmg * 1000), ptHas(p, 'measured') ? 'yes' : '', ptHas(p, 'night') ? 'yes' : '']), `Uplift Louisiana Roofing Atlas, module 02. NOAA Storm Events located reports, ${SF[st.filt].l}, ${rptYrsTxt()}, ${scopeN()}.`)); };
    $('#s2Desk', root).onclick = () => { if (st.storm) goModule('desk', { zips: zipsOfStorm(st.storm, 25), storm: st.storm }); else if (st.zip) goModule('desk', { zips: [st.zip] }); else goModule('desk', { zips: zipsOfReports(25), event: SF[st.filt].l + ', ' + rptYrsTxt() }); };
    $('#s2Forge', root).onclick = () => { const r = st.storm || (stormStats().sort((a, b) => b.est - a.est)[0] || {}).r || topStorm.r; goModule('forge', { zips: zipsOfStorm(r, 12), storm: r }); };
    BUS.on('theme', () => { render(); drawStatic(); });
    this.receive = p => { if (!p) return; if (p.filt && SF[p.filt]) { st.filt = p.filt; $('#s2Filt', root).value = p.filt; }
      if (p.seg != null && SEGS[p.seg]) openStorm(SEGS[p.seg].r, +p.seg);
      else if ((p.storm || p.route) && RTI[p.storm || p.route]) openStorm(p.storm || p.route);
      else if (p.zip && ZI[p.zip]) { st.zip = p.zip; st.storm = ''; st.sel = null; st.pt = null; $('#s2Storm', root).value = ''; if (st.shade === 'none') { st.shade = 'rate'; $$('#s2Shade button', root).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === 'rate'))); } map.fitTo([p.zip]); render(); }
      else render(); };
    render();
  }
});
