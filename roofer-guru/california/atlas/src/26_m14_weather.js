/* ==== 26_m14_weather.js ==== */
/* ==== m14_weather ==== */
"use strict";
/* ============================ Module 14: Storm Desk ============================ */
registerModule({
  key: 'weather', num: '14', title: 'Storm Desk', desc: 'National Weather Service forecasts, SPC and NHC outlooks and alerts for nine Louisiana regions, turned into storm triggers for ads and work windows for crews',
  mount(root) {
    const st = { pi: 0, layer: 'spc1' };
    const SPCL = ['None', 'General thunder', 'Marginal', 'Slight', 'Enhanced', 'Moderate', 'High'];
    root.innerHTML = mastHTML({ eyebrow: 'Module 14 · Storm Desk · nine forecast points, one per region', title: 'Storm Desk', dek: 'Roofing work follows the weather twice: storms make the jobs, and dry, calm days let crews do them. This desk reads the National Weather Service forecast for one point in each region, the Storm Prediction Center\'s severe weather outlooks by parish and the National Hurricane Center\'s tropical outlook, and turns them into two clocks: a storm trigger index that marks the hours when hail, damaging wind or tropical weather may damage roofs, which set the ads and bids for the days after, and a work window that marks the days crews can tear off, the days for repairs and inspections, and the days to stay off roofs.',
      meta: ['<b>Forecast</b> api.weather.gov, nine points', '<b>Outlooks</b> SPC days 1 to 3 by parish, NHC Atlantic', '<b>Triggers</b> thunder, gusts, hail, damaging wind, tropical (grade C)', '<b>Snapshot</b> embedded for offline use'],
      bar: 'Storm Desk', barsub: 'Forecast to triggers, work windows and actions',
      actions: [{ id: 'w14Ref', label: '↻ Refresh from NWS' }, { id: 'w14Csv', label: '↓ Storm windows CSV' }, { id: 'w14WCsv', label: '↓ Work days CSV' }, { id: 'w14Desk', label: 'Campaign Desk ↗' }, { id: 'w14Led', label: 'Storm Ledger ↗' }, { id: 'w14Acct', label: 'Accounts ↗' }] }) +
      `<div class="wrap">
      ${callout('', 'Read this first: the storm trigger index and the work window', 'The storm trigger index starts at 1.0 and adds for each sign of roof damaging weather in the hourly forecast: thunder probability (up to 0.6), wind gusts above 30 mph (one point for every 20 mph more), hail in the forecast weather (1.0), damaging wind (0.8) and tropical storm or hurricane conditions (1.5). Elevated is 1.4 or more and high is 2.0 or more; the weights are assumptions graded C. The work window marks daylight hours as good, marginal (rain chance of 25 to 49 percent, gusts of 22 mph or more, or a heat index of 105 or more) or blocked (rain chance of 50 percent or more, thunder of 30 percent or more, or gusts of 30 mph or more); a day with four or more blocked hours is a day for no tear offs. Owners look for a roofer in the days after damage, so storm actions run after the window, never during it, and every storm message follows module 10: no claim help, no deductible offers, and prices frozen at pre storm levels during a declared emergency.')}
      <div id="w14Snap"></div>
      <div class="kpis" id="w14Kpis"></div>
      ${card('Tropical outlook', 'Active storms and the Atlantic tropical weather outlook from the National Hurricane Center, as of the snapshot or the latest refresh.', '<div id="w14Trop"></div>', 'mt')}
      <div class="controls"><div class="ctl"><span class="fl">Forecast point</span><div class="seg" id="w14Pt">${NWSX.PTS0.map((p, i) => `<button data-v="${i}" aria-pressed="${i === 0}">${esc(p[0])}</button>`).join('')}</div></div>
        <div class="ctl"><span class="fl">Map</span><div class="seg" id="w14Lay"><button data-v="spc1" aria-pressed="true">SPC day 1</button><button data-v="spc2" aria-pressed="false">Day 2</button><button data-v="spc3" aria-pressed="false">Day 3</button><button data-v="trig" aria-pressed="false">Trigger peak by region</button></div></div></div>
      <div class="grid2">
        <div class="card mapcard"><div id="w14Map"></div><div class="legend" id="w14Leg"></div></div>
        <div class="stack"><div class="card"><div class="card-h"><h3 id="w14Name"></h3><p id="w14Sub"></p></div><div class="card-b" id="w14Detail"></div></div></div>
      </div>
      ${card('The next four days, hour by hour', 'Storm trigger index for the selected point, the chance of rain, and the crew work window under it. Shaded: night.', '<div id="w14Chart"></div><div id="w14ChartLeg"></div><div id="w14Strip" style="margin-top:6px"></div><div id="w14Pop" style="margin-top:8px"></div><p class="chartnote" id="w14ChartN"></p>', 'mt')}
      <div class="split">
        ${card('Storm windows and actions, every region', 'Runs of elevated (1.4 or more) and high (2.0 or more) trigger hours, with the bid lift for the 72 hours after each.', '<div class="tscroll short" id="w14Win"></div>')}
        ${card('Work days, every region', 'Daylight hours that are good, marginal or blocked for roofing, and the call for the day.', '<div class="tscroll short" id="w14Work"></div>')}
      </div>
      <div class="split">
        ${card('Active alerts for Louisiana', 'NWS alerts in the snapshot or the latest refresh, with the standing roofing action for each.', '<div id="w14Alerts"></div>')}
        ${card('Seven day forecast', 'NWS periods for the selected point.', '<div class="tscroll short" id="w14Per"></div>')}
      </div>
      <div class="split">
        ${card('Observations', 'Latest station reports in the snapshot: temperature, wind, gusts and visibility.', '<div class="tscroll short" id="w14Obs"></div>')}
        ${card('When storms make roofing work', 'Hail, damaging wind and tornado reports by month (SPC 1996 to 2025), with the months of Louisiana\'s tropical cyclones (NHC best tracks).', '<div id="w14Rec"></div>')}
      </div>
      ${card('Forecast discussion', 'The forecasters\' own reasoning from the New Orleans, Lake Charles and Shreveport offices.', '<div class="seg" id="w14Afd" style="margin-bottom:8px"></div><pre id="w14AfdT" class="mini" style="white-space:pre-wrap;max-height:360px;overflow:auto;background:var(--sunk);padding:10px;border-radius:8px"></pre>', 'mt')}
      ${card('Method and sources', '', '<div id="w14Src"></div>', 'mt')}
      <div class="foot">Uplift Louisiana Roofing Atlas, module 14. Forecasts from the National Weather Service, the Storm Prediction Center and the National Hurricane Center; the trigger index and the work window are planning tools, not predictions about any roof.</div></div>`;
    const map = new ZipMap($('#w14Map', root), { segHit: 'none', roads: false, aria: 'Map of the nine forecast points and the severe weather outlook', onPin: id => { st.pi = +id; sync(); render(); },
      onParishHover: (f, e) => { const lv = spcLevel(f); const reg = PAI[f].reg; const i = NWSX.D.points.findIndex(p => NWSX.REGOF[p.city] === reg); const pk = i >= 0 ? peak(i) : null; showTip(`<div class="tt">${esc(PAI[f].name)} Parish</div><div class="ts">${esc(REGN[reg] || '')}</div>${tipRow('SPC outlook, ' + (st.layer === 'trig' ? 'day 1' : 'day ' + st.layer.slice(-1)), esc(SPCL[lv] || 'None'))}${tipRow('Trigger peak, next 72 hours (region point)', isN(pk) ? D(pk, 2) + '× · ' + NWSX.level(pk) : '—')}`, e); },
      onPinHover: (id, e) => { const p = NWSX.D.points[+id]; const pk = peak(+id); const wd = NWSX.workDays(+id).slice(0, 3); showTip(`<div class="tt">${esc(p.city)}</div><div class="ts">${esc(REGN[NWSX.REGOF[p.city]] || '')}</div>${tipRow('Trigger peak, next 72 hours', isN(pk) ? D(pk, 2) + '× · ' + NWSX.level(pk) : '—')}${tipRow('Now', p.hourly && p.hourly[0] ? `${p.hourly[0].tempF}°F, ${esc(p.hourly[0].short)}` : '—')}${wd.map(w => tipRow(DOW3[w.dow] + ' ' + dateS(w.date), esc(w.verdict))).join('')}<div class="tf">Click to open</div>`, e); } });
    const sync = () => $$('#w14Pt button', root).forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.v === st.pi)));
    const peak = i => { const H = NWSX.hourly(i).slice(0, 72); return H.length ? Math.max(...H.map(x => x.risk)) : null; };
    const spcDay = () => st.layer === 'trig' ? '1' : st.layer.slice(-1);
    const spcLevel = (f, d) => { const o = (NWSX.D.spc || {})[d || spcDay()]; return o && o.levels ? (o.levels[f] || 0) : 0; };
    /* the Atlantic outlook: systems with their formation chances, parsed from the NHC text */
    function twoSystems() {
      const t = String(((NWSX.D.nhc || {}).two || {}).text || ''); const out = []; const re = /\n([^\n]*?\((AL\d{2})\)):?\s*\n([\s\S]*?)\* Formation chance through 48 hours\.\.\.(\w+)\.\.\.(\d+) percent\.\s*\n\* Formation chance through 7 days\.\.\.(\w+)\.\.\.(\d+) percent/g; let m;
      while ((m = re.exec(t))) out.push({ where: m[1].replace(/\s*\(AL\d{2}\)\s*$/, '').trim(), id: m[2], text: m[3].replace(/\s+/g, ' ').trim(), c48: +m[5], c7: +m[7], l7: m[6] });
      return out;
    }
    function render() {
      const Dd = NWSX.D; const R = ramp('green');
      $('#w14Snap', root).innerHTML = callout('judg tight', NWSX.live ? 'Live forecast' : 'Embedded snapshot', NWSX.live ? `Pulled from api.weather.gov ${new Date(Dd.fetched).toLocaleString()}.` : `Forecast as of ${Dd.fetched ? new Date(Dd.fetched).toLocaleString('en-US', { timeZone: 'America/Chicago', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' Central' : 'unknown'} (${esc(Dd.source || '')}). Refresh pulls the live forecast when the atlas is opened outside the Claude viewer; inside it, the snapshot stands and every window below should be read against its date.`);
      const peaks = Dd.points.map((p, i) => peak(i) || 0);
      const wins = Dd.points.flatMap((p, i) => NWSX.windows(i).map(w => Object.assign({ p, i }, w)));
      const days = Dd.points.flatMap((p, i) => NWSX.workDays(i).map(w => Object.assign({ p, i }, w)));
      const sys = twoSystems(); const storms = ((Dd.nhc || {}).storms || []); const atl = storms.filter(s => /^al/i.test(s.id || ''));
      const lv1 = Object.values(((Dd.spc || {})['1'] || {}).levels || {}); const mx1 = lv1.length ? Math.max(...lv1) : 0;
      $('#w14Kpis', root).innerHTML = kpiHTML([
        { l: 'Active alerts', g: 'A', v: N(Dd.alerts.length), d: Dd.alerts.length ? [...new Set(Dd.alerts.map(a => a.event))].slice(0, 3).join(', ') : 'none for Louisiana in this read' },
        { l: 'Tropical outlook', g: 'A', v: sys.length ? `${sys[0].c7}%` : atl.length ? N(atl.length) : 'Quiet', d: sys.length ? `${esc(sys[0].id)}, ${esc(sys[0].where)}: chance of forming in 7 days` : atl.length ? 'active Atlantic storms' : 'no Atlantic system in the outlook' },
        { l: 'Severe outlook today', g: 'A', v: esc(SPCL[mx1]), d: mx1 ? `${N(lv1.filter(v => v === mx1).length)} parishes at that level, SPC day 1` : 'no thunder area over Louisiana' },
        { l: 'Storm trigger windows', g: 'C', v: N(wins.length), d: `${N(wins.filter(w => w.level === 'high').length)} high, ${N(wins.filter(w => w.level === 'elevated').length)} elevated, across nine points` },
        { l: 'Highest trigger, next 72 hours', g: 'C', v: D(Math.max(...peaks), 2) + '×', d: esc(Dd.points[peaks.indexOf(Math.max(...peaks))].city) },
        { l: 'Full production days ahead', g: 'C', v: `${N(days.filter(d => d.verdict === 'full production').length)} of ${N(days.length)}`, d: 'point days with room for tear offs' },
        { l: 'Crew calendar', g: '', v: NWSX.holiday((Dd.points[0].hourly[0] || {}).t ? NWSX.partsOf(Dd.points[0].hourly[0].t).date : '') || 'No holiday', d: 'in the forecast period' },
      ]);
      tropical(sys, storms);
      if (st.layer === 'trig') { map.fillParish(f => { const reg = PAI[f].reg; const i = Dd.points.findIndex(p => NWSX.REGOF[p.city] === reg); const pk = i >= 0 ? peaks[i] : null; return pk == null ? null : pk >= 2.0 ? R[6] : pk >= 1.4 ? R[4] : R[2]; });
        $('#w14Leg', root).innerHTML = `<div><div class="lt">Storm trigger peak, next 72 hours, by region</div><div class="ramp"><i style="background:${R[2]}"></i><i style="background:${R[4]}"></i><i style="background:${R[6]}"></i></div><div class="rlabs"><span>under 1.4×</span><span>2.0× or more</span></div></div><div class="dn">The highest hourly trigger index at each region's forecast point. ${G('C')}</div>`; }
      else { const d = spcDay(); const col = [null, R[1], R[3], R[4], R[5], R[6], R[7]]; map.fillParish(f => col[spcLevel(f, d)] || null); const o = (Dd.spc || {})[d] || {};
        $('#w14Leg', root).innerHTML = `<div><div class="lt">SPC convective outlook, day ${d}${o.valid ? ', valid ' + esc(String(o.valid).replace(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})$/, '$2/$3 $4:$5 UTC')) : ''}</div><div class="ramp">${col.slice(1).map(c => `<i style="background:${c}"></i>`).join('')}</div><div class="rlabs"><span>general thunder</span><span>high</span></div></div><div class="dn">Categories by parish: general thunder, marginal, slight, enhanced, moderate and high risk of severe storms (hail of 1 inch or more, gusts of 58 mph or more, or tornadoes). Uncolored parishes sit outside every outlook area. ${G('A')}</div>`; }
      map.pins(Dd.points.map((p, i) => ({ id: String(i), lat: p.lat, lon: p.lon, r: i === st.pi ? 8 : 6, fill: i === st.pi ? cssv('--accent') : cssv('--ink'), shape: 'diamond', sel: i === st.pi })));
      detail(); chart(); windowsTbl(wins); workTbl(days); alerts(); periods(); obs();
    }
    function tropical(sys, storms) {
      const two = ((NWSX.D.nhc || {}).two || {}).text || ''; const body = (two.match(/For the North Atlantic[\s\S]*?(?=\$\$|$)/) || [''])[0].trim();
      $('#w14Trop', root).innerHTML = `${sys.length ? sys.map(s => `<div class="asset ${s.c7 >= 60 ? 'bad' : 'warn'}"><b>${esc(s.id)} · ${esc(s.where)}</b> <span class="mini">formation chance ${s.c48}% in 48 hours, ${s.c7}% in 7 days</span><div class="mini" style="margin-top:4px">${esc(s.text)}</div></div>`).join('') : '<p class="mini">No Atlantic system in the outlook.</p>'}
        ${storms.length ? `<div class="dsec">Active storms</div>${storms.map(s => `<div class="rowl"><span>${esc(s.name)} (${esc(String(s.id || '').toUpperCase())}) · ${esc({ HU: 'hurricane', TS: 'tropical storm', TD: 'tropical depression', STS: 'subtropical storm', PTC: 'potential tropical cyclone' }[s.cls] || s.cls || '')}${/^ep/i.test(s.id || '') ? ' · eastern Pacific, no Louisiana effect expected' : ''}</span><b>${isN(+s.intensity) ? N(ktMph(+s.intensity)) + ' mph' : ''}</b></div>`).join('')}` : ''}
        <div class="dsec">What to do with it</div><p class="mini">A system in the Gulf with a high formation chance is the time to check tarp and crew capacity, freeze price books at today's levels, line up the storm ad groups in the Campaign Desk without launching them, and keep replacement ads running until a watch is issued. Messages before landfall talk about preparation and capacity, never fear; after it, the Storm Ledger (module 02) shows the footprint as soon as the track is in.</p>
        ${body ? `<details style="margin-top:8px"><summary class="mini">NHC outlook text</summary><pre class="mini" style="white-space:pre-wrap;background:var(--sunk);padding:10px;border-radius:8px;max-height:280px;overflow:auto">${esc(body)}</pre></details>` : ''}`;
    }
    function detail() {
      const p = NWSX.D.points[st.pi]; const H = NWSX.hourly(st.pi); const W = NWSX.windows(st.pi); const WD = NWSX.workDays(st.pi); const reg = NWSX.REGOF[p.city];
      $('#w14Name', root).textContent = p.city; $('#w14Sub', root).textContent = `${REGN[reg] || ''} · NWS ${p.office || ''} grid ${p.gridX || ''},${p.gridY || ''} · zone ${p.zone || ''}`;
      const now = H[0]; const grid = (typeof ACCT !== 'undefined' && ACCT.settings && ACCT.settings().useObserved && ACCT.observedGrid) ? ACCT.observedGrid() : null; const dp = grid ? grid[0] : SLM.DAYPARTS.emergency; const dpSrc = grid ? 'the observed hours in module 15' : 'the emergency template (module 12)';
      $('#w14Detail', root).innerHTML = now ? `<div class="big">${D(now.risk, 2)}×<span style="font-size:13px;font-weight:500;color:var(--ink-3)"> storm trigger now · ${NWSX.level(now.risk)}</span></div><div class="mini" style="margin-bottom:10px">${now.tempF}°F, ${esc(now.short)} · rain ${now.pop}%${isN(now.gust) ? ' · gusts ' + Math.round(now.gust) + ' mph' : ''} · work window ${esc(now.work)}</div>
        <div class="dsec">Storm windows ahead</div>${W.slice(0, 6).map(w => `<div class="rowl"><span>${DOW3[w.dow]} ${dateS(w.date)}, ${NWSX.hh(w.start)} to ${NWSX.hh(w.end + 1)} · ${esc(w.why.join(', '))}</span><b>${D(w.peak, 2)}× ${w.level}</b></div>`).join('') || '<p class="mini">No elevated storm windows in the forecast.</p>'}
        <div class="dsec">Work days ahead</div>${WD.slice(0, 6).map(w => `<div class="rowl"><span>${DOW3[w.dow]} ${dateS(w.date)} · ${N(w.good)} good, ${N(w.marginal)} marginal, ${N(w.blocked)} blocked hours${w.why.length ? ' · ' + esc(w.why.slice(0, 3).join(', ')) : ''}</span><b>${esc(w.verdict)}</b></div>`).join('') || '<p class="mini">No daylight hours in the forecast.</p>'}
        <div class="dsec">Action</div><p class="mini">${W.some(w => w.level === 'high') ? `After each high window, run storm inspection and tarp ads in the ${esc(REGN[reg])} ZIPs with the most storm exposure and raise storm and hail bids 25% for the 72 hours after it.` : W.length ? `After each elevated window, raise storm and hail bids 15% in ${esc(REGN[reg])} for 72 hours and watch the NWS storm reports; launch inspection ads only where hail of 1 inch or more or gusts of 58 mph or more are reported.` : 'No storm action; run the standard dayparting templates.'} ${WD.some(w => w.verdict === 'no tear offs') ? 'On no tear off days, book inspections and small repairs, and move material deliveries.' : 'Every day ahead allows production work.'}</p>
        <div class="dsec">Hour blocks for the bid lift</div><p class="mini">${SLM.BLOCKS.map((bl, i) => `${esc(bl)} ${S(dp[i], 0)}%`).join(' · ')}, from ${dpSrc}, on top of the window's lift.</p>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px"><button class="ibtn" id="w14RD">Region's storm ZIPs to the Desk ↗</button></div>` : '<p class="mini">No hourly forecast for this point.</p>';
      const b = $('#w14RD', root); if (b) b.onclick = () => goModule('desk', { zips: ZR.filter(z => PA[z.pi] && PA[z.pi].reg === reg).sort((a, b2) => (b2.p_storm || 0) + (b2.p_hail || 0) - (a.p_storm || 0) - (a.p_hail || 0)).slice(0, 25).map(z => z.zip), line: 'storm' });
    }
    function chart() {
      const H = NWSX.hourly(st.pi).slice(0, 96); if (!H.length) { $('#w14Chart', root).innerHTML = '<p class="mini">No hourly forecast.</p>'; $('#w14Strip', root).innerHTML = ''; return; }
      const R = ramp('green'); const xs = H.map((x, i) => i);
      const bands = []; let b0 = null; H.forEach((x, i) => { const night = !x.isDay; if (night && b0 == null) b0 = i; if ((!night || i === H.length - 1) && b0 != null) { bands.push({ x0: b0, x1: i }); b0 = null; } });
      lineChart($('#w14Chart', root), { series: [{ name: 'Storm trigger index', color: R[6], pts: H.map((x, i) => [i, x.risk]), width: 2.4, fmt: v => D(v, 2) + '×' }], x: { ticks: xs.filter(i => H[i].h === 0 || (i === 0 && H[0].h > 0 && H[0].h <= 17)), fmt: i => H[i] ? DOW3[H[i].dow] + ' ' + NWSX.hh(H[i].h) : '' }, y: { label: 'Index, 1.0 = no storm signal', fmt: v => D(v, 1), min: 0.8 }, hlines: [{ y: 1.4, label: 'elevated' }, { y: 2.0, label: 'high' }], bands, H: 260, W: 900, tipTitle: i => H[i] ? `${DOW[H[i].dow]} ${dateS(H[i].date)}, ${NWSX.hh(H[i].h)} · ${H[i].tempF}°F, ${H[i].short}${H[i].why.length ? ' · ' + H[i].why.join(', ') : ''}` : '', aria: 'Storm trigger index by hour' });
      $('#w14ChartLeg', root).innerHTML = legendRow([{ name: 'Storm trigger index', color: R[6] }]);
      const WC = { good: ramp('teal')[3], marginal: cssv('--judg'), blocked: cssv('--critical'), night: cssv('--sunk-2') };
      $('#w14Strip', root).innerHTML = `<div class="mini" style="margin-bottom:3px">Work window by hour</div><div style="display:grid;grid-template-columns:repeat(${H.length},1fr);gap:1px;height:14px">${H.map(x => `<i title="${esc(DOW3[x.dow] + ' ' + NWSX.hh(x.h) + ': ' + x.work + (x.wwhy.length ? ' (' + x.wwhy.join(', ') + ')' : ''))}" style="background:${WC[x.work]};display:block"></i>`).join('')}</div>${legendRow([{ name: 'Good', color: WC.good, sq: 1 }, { name: 'Marginal', color: WC.marginal, sq: 1 }, { name: 'Blocked', color: WC.blocked, sq: 1 }, { name: 'Night', color: WC.night, sq: 1 }])}`;
      barChart($('#w14Pop', root), { cats: H.map(x => DOW3[x.dow] + ' ' + NWSX.hh(x.h)), series: [{ name: 'Chance of precipitation', color: ramp('teal')[5], values: H.map(x => x.pop) }], H: 120, W: 900, maxLabels: 8, fmt: v => v + '%', yLabel: 'Chance of rain (%)', aria: 'Precipitation chance by hour' });
      const top = H.slice().sort((a, b) => b.risk - a.risk)[0]; const blocked = H.filter(x => x.work === 'blocked').length, good = H.filter(x => x.work === 'good').length;
      $('#w14ChartN', root).innerHTML = top.risk > 1.05 ? `Peak trigger: ${DOW[top.dow]} ${NWSX.hh(top.h)} at ${D(top.risk, 2)}× (${esc(top.why.join(', '))}). ${N(good)} good and ${N(blocked)} blocked work hours in the next ${N(H.length)}.` : `No storm signal in the next ${N(H.length)} hours. ${N(good)} good and ${N(blocked)} blocked work hours.`;
    }
    function windowsTbl(wins) {
      dataTable($('#w14Win', root), [{ k: 'city', h: 'Point', l: 1, v: w => w.p.city, f: v => `<b>${esc(v)}</b>` }, { k: 'date', h: 'Date', l: 1, f: (v, w) => `${DOW3[w.dow]} ${dateS(v)}` }, { k: 'start', h: 'Hours', l: 1, f: (v, w) => `${NWSX.hh(w.start)} to ${NWSX.hh(w.end + 1)}` }, { k: 'peak', h: 'Peak', f: v => D(v, 2) + '×' }, { k: 'level', h: 'Level', l: 1 }, { k: 'bid', h: 'Next 72h bid', f: v => '+' + v + '%' }, { k: 'why', h: 'Why', l: 1, v: w => w.why.join(', ') }], wins, { sortKey: 'peak', id: w => w.i, onClick: i => { st.pi = +i; sync(); render(); } });
      if (!wins.length) $('#w14Win', root).innerHTML = '<p class="mini">No elevated or high storm windows at any point in this forecast.</p>';
    }
    function workTbl(days) {
      dataTable($('#w14Work', root), [{ k: 'city', h: 'Point', l: 1, v: w => w.p.city, f: v => `<b>${esc(v)}</b>` }, { k: 'date', h: 'Date', l: 1, f: (v, w) => `${DOW3[w.dow]} ${dateS(v)}` }, { k: 'verdict', h: 'Call', l: 1, f: v => v === 'no tear offs' ? `<b style="color:var(--critical)">${esc(v)}</b>` : v === 'repairs and inspections' ? `<b style="color:var(--judg)">${esc(v)}</b>` : esc(v) }, { k: 'good', h: 'Good', f: v => N(v) }, { k: 'marginal', h: 'Marginal', f: v => N(v) }, { k: 'blocked', h: 'Blocked', f: v => N(v) }, { k: 'why', h: 'Why', l: 1, v: w => w.why.slice(0, 3).join(', ') }], days, { sortKey: 'date', sortDir: 1, id: w => w.i + '|' + w.date, onClick: k => { st.pi = +String(k).split('|')[0]; sync(); render(); } });
    }
    function alerts() {
      const A = NWSX.D.alerts || [];
      $('#w14Alerts', root).innerHTML = A.length ? A.map(a => { const act = NWSX.actionFor(a.event); return `<div class="asset ${/Hurricane|Tropical|Tornado|Severe/i.test(a.event) ? 'bad' : 'warn'}"><b>${esc(a.event)}</b> <span class="mini">${esc(a.severity || '')} · until ${a.ends || a.expires ? new Date(a.ends || a.expires).toLocaleString() : 'unknown'}${a.hail ? ' · hail up to ' + esc(String(a.hail)) : ''}${a.gust ? ' · gusts to ' + esc(String(a.gust)) : ''}</span><div class="mini">${esc(a.areas || '')}</div><span class="why">${esc(act.kind)}: ${esc(act.text)}</span></div>`; }).join('') : `<p class="mini">No active NWS alerts for Louisiana in this read. Standing actions when they arrive:</p>${proseTable(NWSX.ALERT_MAP.map(([re, k, t]) => [`<b>${esc(k)}</b>`, esc(t)]))}`;
    }
    function periods() { const p = NWSX.D.points[st.pi]; $('#w14Per', root).innerHTML = `<table><thead><tr><th class="l">Period</th><th>Temp</th><th>Rain</th><th class="l">Wind</th><th class="l">Forecast</th></tr></thead><tbody>${(p.periods || []).map(x => `<tr><td class="l"><b>${esc(x.name)}</b></td><td>${x.tempF}°</td><td>${x.pop}%</td><td class="l">${esc(houseClean(x.wind || ''))}</td><td class="l wrap">${esc(x.short)}</td></tr>`).join('')}</tbody></table>`; }
    function obs() { const O = NWSX.D.obs || []; $('#w14Obs', root).innerHTML = O.length ? `<table><thead><tr><th class="l">Station</th><th>Temp</th><th>Wind</th><th>Gust</th><th>Visibility</th><th class="l">Sky</th><th class="l">Time</th></tr></thead><tbody>${O.map(o => `<tr><td class="l"><b>${esc(o.id)}</b></td><td>${isN(o.tempF) ? D(o.tempF, 0) + '°' : '—'}</td><td>${isN(o.windMph) ? D(o.windMph, 0) + ' mph' : '—'}</td><td>${isN(o.gustMph) ? D(o.gustMph, 0) + ' mph' : '—'}</td><td>${isN(o.visMi) ? D(o.visMi, 1) + ' mi' : '—'}</td><td class="l">${esc(o.text || '')}</td><td class="l mini">${o.time ? new Date(o.time).toLocaleTimeString('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit' }) : ''}</td></tr>`).join('')}</tbody></table>` : '<p class="mini">No observations in this read.</p>'; }
    const offs = Object.keys(NWSX.D.afd || {});
    $('#w14Afd', root).innerHTML = offs.map((o, i) => `<button data-v="${o}" aria-pressed="${i === 0}">${esc({ LIX: 'New Orleans and Baton Rouge', LCH: 'Lake Charles', SHV: 'Shreveport', JAN: 'Jackson' }[o] || o)}</button>`).join('');
    const showAfd = o => { const a = (NWSX.D.afd || {})[o]; $('#w14AfdT', root).textContent = a ? `Issued ${a.issued}\n\n${String(a.text || '').trim()}` : 'No discussion in this read.'; };
    wireSeg($('#w14Afd', root), showAfd); if (offs.length) showAfd(offs[0]);
    function record() {
      const TM = DATA.ts.month, TR = DATA.ts.trop_month; const R = ramp('green');
      barChart($('#w14Rec', root), { cats: MON3, series: [{ name: 'Hail', color: R[6], values: TM.hail }, { name: 'Damaging wind', color: R[4], values: TM.wind }, { name: 'Tornado', color: R[2], values: TM.torn }], stacked: true, H: 220, W: 560, fmt: v => N(v), aria: 'Storm reports by month' });
      const pk = (a, n) => a.map((v, i) => [v, i]).sort((x, y) => y[0] - x[0]).slice(0, n).map(x => MONL[x[1]]); const tp = pk(TR, 3);
      $('#w14Rec', root).insertAdjacentHTML('beforeend', legendRow([{ name: 'Hail', color: R[6], sq: 1 }, { name: 'Damaging wind', color: R[4], sq: 1 }, { name: 'Tornado', color: R[2], sq: 1 }]) + `<p class="chartnote">Hail reports peak in ${pk(TM.hail, 1)[0]}, damaging wind from ${pk(TM.wind, 1)[0]} into early summer, and tornadoes in ${pk(TM.torn, 1)[0]}. ${N(sum(TR))} tropical cyclones brought modeled tropical storm force winds to Louisiana from 1950 to 2025, most in ${tp[0]}, ${tp[1]} and ${tp[2]}. The service line seasons in module 12 follow these with a lag, because owners call after they find the damage.</p>`);
    }
    $('#w14Src', root).innerHTML = judgList([
      ['Forecast', 'api.weather.gov points, forecast, hourly forecast and raw gridpoint data (thunder probability, wind gusts and the weather attributes that flag hail and damaging wind) for nine points; alerts for Louisiana with their hail and gust parameters; the latest station observations; area forecast discussions from LIX, LCH and SHV.'],
      ['Outlooks', 'SPC day 1 to 3 categorical convective outlooks, intersected with parish boundaries; the NHC Atlantic tropical weather outlook and active storms.'],
      ['Trigger weights', 'Assumptions (grade C): thunder up to 0.6, gusts above 30 mph one point per 20 mph, hail 1.0, damaging wind 0.8, tropical 1.5, on a base of 1.0.'],
      ['Work window', 'Common roofing practice and manufacturer guidance: no tear offs with rain likely, lightning nearby or gusts over 30 mph; heat index of 105 or more slows crews (grade C).'],
      ['Crew calendar', 'Holiday weekends from the federal calendar plus Mardi Gras and the opening of hurricane season.']]) + srcRows([['National Weather Service API', 'api.weather.gov', 'A', 'snapshot Oct 6, 2026', 'https://www.weather.gov/documentation/services-web-api'], ['Storm Prediction Center outlooks', 'Day 1 to 3 categorical outlooks', 'A', 'snapshot Oct 6, 2026', 'https://www.spc.noaa.gov/products/outlook/'], ['National Hurricane Center', 'Atlantic tropical weather outlook and active storms', 'A', 'snapshot Oct 6, 2026', 'https://www.nhc.noaa.gov/'], ['Storm reports by month', 'SPC severe report database 1996 to 2025; HURDAT2 best tracks', 'A', '2025', 'https://www.spc.noaa.gov/wcm/']]);
    wireSeg($('#w14Pt', root), v => { st.pi = +v; render(); });
    wireSeg($('#w14Lay', root), v => { st.layer = v; render(); });
    $('#w14Ref', root).onclick = async () => { const b = $('#w14Ref', root); b.disabled = true; try { await NWSX.refresh(c => toast('Reading ' + c)); toast('Live forecast loaded'); render(); } catch (e) { toast(e.message.slice(0, 120)); } b.disabled = false; };
    $('#w14Csv', root).onclick = () => saveFile('louisiana-storm-trigger-windows.csv', NWSX.scheduleCSV());
    $('#w14WCsv', root).onclick = () => { const rows = NWSX.D.points.flatMap((p, i) => NWSX.workDays(i).map(w => [p.city, REGN[NWSX.REGOF[p.city]] || '', w.date, w.verdict, w.good, w.marginal, w.blocked, w.why.join('; ')])); saveFile('louisiana-roofing-work-days.csv', toCSV(['point', 'region', 'date', 'call', 'good_hours', 'marginal_hours', 'blocked_hours', 'reasons'], rows, `Roofing work windows from the NWS hourly forecast (${NWSX.D.fetched || 'no snapshot'}); daylight hours only.`)); };
    $('#w14Desk', root).onclick = () => goModule('desk'); $('#w14Led', root).onclick = () => goModule('storms'); $('#w14Acct', root).onclick = () => goModule('accounts');
    BUS.on('theme', () => { render(); record(); }); BUS.on('nws', () => render()); BUS.on('acct', () => { if (root.isConnected) detail(); });
    render(); record();
  }
});
