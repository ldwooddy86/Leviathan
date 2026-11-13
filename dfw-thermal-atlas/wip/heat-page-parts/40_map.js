    /* ---------- map: l label, v value of a ZIP record, f formatter, g grade; cat lists the classes of a layer that is words, not numbers ---------- */
    const wxz = zip => (wk && wk.wx && wk.wx.ok && wk.wx.byZip ? wk.wx.byZip[zip] || null : null);
    const cellOf = (r, id) => (r && r.lines ? r.lines[id] || null : null);
    const HL = {
      share: { l: 'Budget share (% of the plan)', ramp: 'ember', g: GR.spend || 'C', v: r => (r.inPlan ? r.share * 100 : null), f: v => P(v, 1), note: 'Where the dollars are expected to land. Gray ZIPs are not in the plan.' },
      bid: { l: 'Location bid adjustment (%)', div: 1, g: GR.bid || 'D', v: r => (r.inPlan ? r.bid : null), f: sg, note: 'What a click is worth here against the campaign average. Cost decides whether a ZIP is bought; value decides the bid.' },
      tier: { l: 'Drive tier', g: GR.minutes || 'C', cat: HX.TIERS.map(t => [t.id, `${t.id}: ${t.words}`]), v: r => r.tier, note: 'Drive minutes are 5 plus the straight line kilometres from the dispatch point.' },
      conf: { l: 'Confidence that the return clears the cut', g: GR.conf || 'D', cat: HX.LABELS.map(t => [t.id, `${t.id}: ${t.words}`]), v: r => (r.inPlan ? r.label : null), note: 'The chance a funded ZIP still clears the cut once the doubt in its return is counted. Gray ZIPs are not in the plan.' },
      reach: { l: 'Reach, heating repair (1 at the door)', ramp: 'teal', g: GR.reach || 'D', v: r => { const c = cellOf(r, 'heat'); return c && c.R > 0 ? c.R : null; }, f: v => D(v, 2), note: 'The share of a repair lead\'s value left after the drive. Gray is past the reach cut: the line is not sold there.' },
      jobs: { l: 'Heating repair jobs this month an ad can reach', ramp: 'ember', g: GR.jobs || 'D', v: r => { const c = cellOf(r, 'heat'); return c ? c.J : null; }, f: v => N(v), note: 'Module 12 jobs, the month\'s season and the homes where an owner decides.' },
      furn20: { l: 'Gas furnaces past 20 years', ramp: 'ember', g: 'B', v: r => r.z.furn20, f: v => N(v), note: 'Module 02 stock model: the pool behind furnace replacement.' },
      fuel: { l: 'Fuel lead: which message a ZIP gets', g: 'A', cat: [['gas', 'Gas led: 45% or more of homes heat with gas'], ['electric', 'Electric led: 70% or more heat with electricity'], ['mixed', 'Mixed']], v: r => r.fuel, note: 'Census heating fuel. It decides the message and the keyword group, never the budget.' },
      cold: { l: 'Cold exposure (1 = metro mean)', ramp: 'blue', g: GR.exposure || 'C', v: r => r.x, f: v => D(v, 2), note: 'Normal heating degree days of the ZIP over the household weighted metro mean.' },
      wx: { l: 'This week: heating repair multiplier', ramp: 'blue', g: 'A/D', v: r => { const w = wxz(r.zip); return w ? w.W : null; }, f: mult, note: 'Seven forecast nights against the month\'s normal night. Gray everywhere means no usable forecast: the week runs at 1.' },
    };
    $('#h17Layer', root).innerHTML = Object.keys(HL).map(k => `<option value="${k}">${esc(HL[k].l)}</option>`).join('');
    if (!HL[st.layer]) st.layer = 'share';
    const catCols = k => (k === 'fuel' ? [cssv('--heat'), cssv('--cool'), cssv('--s7')] : (r => [r[6], r[4], r[2]])(ramp(k === 'conf' ? 'blue' : 'teal')));
    const map = new ZipMap($('#h17Map', root), { aria: 'Map of Dallas Fort Worth ZIP codes shaded by the selected Heat Desk layer, with the shop marked',
      onSelect: zip => pick(zip === st.sel ? null : zip),
      onHover: (zip, e) => { const z = ZI[zip], r = plan && plan.at[zip], o = HL[st.layer]; if (!z) return; const v = r ? o.v(r) : null;
        showTip(`<div class="tt">${esc(zip)} · ${esc(z.city)}</div><div class="ts">${esc(z.cty)} County${r ? ` · ${N(r.min)} minutes · ${esc(r.tier)}` : ''}</div>${tipRow(esc(o.l), v == null ? 'none' : o.cat ? esc((o.cat.find(c => c[0] === v) || [0, v])[1]) : o.f(v))}${r && r.inPlan ? tipRow('In the plan', `${usd(r.dollars)} · ${pc(r.share, 1)}`) + tipRow('Bid · confidence', `${sg(r.bid)} · ${esc(r.label)}`) : tipRow('In the plan', r ? 'no' : 'not scored')}<div class="tf">Click for the ZIP card</div>`, e); },
      onPinHover: (id, e) => showTip(`<div class="tt">The shop</div><div class="ts">${ec(plan.origin.label)}</div><div class="tf">Every drive time on this page starts here</div>`, e) });
    /* the shared map prints a minus sign on its zoom out button; draw both zoom marks instead so no dash sits on the page */
    $$('.maptools button', root).forEach(b => { if (b.dataset.z === 'in' || b.dataset.z === 'out') b.innerHTML = `<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M1 6h10${b.dataset.z === 'in' ? 'M6 1v10' : ''}" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`; });
    function drawMap() {
      const o = HL[st.layer], vals = plan.all.map(o.v), have = vals.filter(v => v != null && (o.cat || isN(v)));
      if (o.cat) { const cols = catCols(st.layer), ix = v => o.cat.findIndex(c => c[0] === v); map.fill(zip => { const r = plan.at[zip], i = r ? ix(o.v(r)) : -1; return i >= 0 ? cols[i] : null; });
        $('#h17Leg', root).innerHTML = `<div><div class="lt">${esc(o.l)}</div><div class="catleg">${o.cat.map((c, i) => `<span><i style="background:${cols[i]}"></i>${esc(c[1])} (${N(have.filter(v => v === c[0]).length)})</span>`).join('')}</div></div><div class="dn">${G(o.g)} ${esc(o.note)}</div>`; }
      else { const sc = o.div ? divScale(have, 0) : qScale(have, o.ramp, 1); map.fill(zip => { const r = plan.at[zip]; return r ? sc.f(o.v(r)) : null; });
        $('#h17Leg', root).innerHTML = have.length ? legendHTML({ title: esc(o.l), R: sc.R, lo: o.f(o.div ? sc.lo : Math.min(...have)), hi: o.f(o.div ? sc.hi : Math.max(...have)), note: `${G(o.g)} ${esc(o.note)} ${o.div ? 'Blue is under the campaign average, red over.' : `Higher values shade ${isDark() ? 'lighter' : 'darker'}.`} ${N(have.length)} ZIPs carry a value.` }) : `<div class="dn">${G(o.g)} ${esc(o.note)} No ZIP carries a value for this layer right now.</div>`; }
      map.select(st.sel && ZI[st.sel] ? st.sel : null);
      map.pins([{ id: 'shop', lat: plan.origin.lat, lon: plan.origin.lon, r: 7, fill: cssv('--bench'), shape: 'diamond', op: 1 }]);
    }

    /* ---------- ZIP card ---------- */
    const STATE = { small: 'under the minimum leads', under: 'return under the cut', out: 'past the reach cut' };
    function zipCard() {
      const name = $('#h17ZName', root), sub = $('#h17ZSub', root), body = $('#h17Zip', root);
      if (st.miss) { name.textContent = `ZIP ${st.miss}`; sub.textContent = 'Not in this atlas'; body.innerHTML = `<p class="hd-miss"><b>${esc(st.miss)}</b> is not one of the ${N(Z.length)} ZIP codes on this map. Check the number, or pick a ZIP on the map or in the ranked table. The plan itself is unchanged.</p>`; return; }
      const z = st.sel ? ZI[st.sel] : null, r = z ? plan.at[z.zip] : null;
      if (!z) { name.textContent = 'ZIP card'; sub.textContent = 'Click a ZIP on the map or a row in the table'; body.innerHTML = `<p class="mini">Every ZIP carries its four lines (jobs this month, reach, cost, return against the cut, dollars, bid), its furnaces and heat pumps, its fuel split, its cold exposure, this week's lows and the message it should get.</p>`; return; }
      name.textContent = `${z.zip} · ${z.city}`;
      if (!r) { sub.textContent = `${z.cty} County`; body.innerHTML = `<p class="hd-miss"><b>${esc(z.zip)} ${esc(z.city)}</b> is on the map, but too few households live there for the plan to score it. Nothing is spent there.</p>`; return; }
      sub.textContent = `${r.county} County · ${N(r.households)} households · ${N(r.min)} minutes from the shop · ${r.tier}${r.home ? ', home turf' : ''}`;
      const held = !r.inPlan ? (HX.held(plan).find(h => h.zip === r.zip) || plan.bench.find(b => b.zip === r.zip) || null) : null, bn = plan.bench.find(b => b.zip === r.zip);
      const status = r.blocked ? '<span class="hd-chip warn">Blocked by you</span> Nothing is spent here and it goes into the exclusions file.'
        : r.inPlan ? `<span class="hd-chip ok">In the plan</span> Rank ${N(r.rank)} of ${N(plan.T.zips)} · ${pc(r.share, 1)} of the money · <b>${usd(r.dollars)}</b> a month · bid ${sg(r.bid)} · ${esc(r.label)} (${pc(r.conf)}) ${G('C/D')}`
        : `<span class="hd-chip">Not in the plan</span> ${held ? ec(held.reason) + '.' : 'No line clears the cut here at this budget.'}${bn && isN(bn.enterAt) ? ` It enters at about ${usd(bn.enterAt)} a month.` : ''}`;
      const rows = IDS.map(id => { const c = cellOf(r, id), L = plan.line[id]; if (!c) return tr([[esc(SHORT[id]), 'l'], NA, NA, NA, NA, NA, NA, NA]);
        return tr([[esc(SHORT[id]), 'l'], n1(c.J), c.R > 0 ? D(c.R, 2) : 'out', D(c.cost, 2), c.R > 0 ? `$${D(c.rho, 2)}` : NA, isN(L.lambdaRaw) ? `$${D(L.lambdaRaw, 2)}` : NA, c.spend > 0 ? `<b>${usd(c.spend)}</b>` : `<span class="mini">${esc(STATE[c.state] || (c.capped ? 'cut by the ZIP cap' : 'not funded'))}</span>`, c.spend > 0 ? `${sg(c.bid)} · ${pc(c.conf)}` : NA]); });
      const w = wxz(r.zip), wr = wk && wk.plan && wk.plan.at ? wk.plan.at[r.zip] : null, zn = live().zipNormal(r.zip), lev = SLM.LEV[r.zip] || {}, hdd = plan.exposure && HX.exposure ? (HX.exposure().hdd || {})[r.zip] : null;
      const tags = [r.fuel === 'gas' ? 'Gas led: furnace, igniter and carbon monoxide copy' : r.fuel === 'electric' ? 'Electric led: heat pump, auxiliary heat and electric bill copy' : 'Mixed fuel: run both message sets', lev.es >= 15 ? `Spanish build, suggested share ${N(lev.es)}%` : '', lev.fin >= 60 ? 'Payment led: monthly payment creative belongs in the financing radius campaign' : ''].filter(Boolean);
      body.innerHTML = `<p class="hd-why">${status}</p>${r.inPlan && r.why ? `<p class="hd-why">${ec(r.why)}.</p>` : ''}
        <div class="dsec">The four lines this month ${G('D')}</div><div class="xscroll">${tbl([['Line', 1], ['Jobs', 0, 'Jobs this month a homeowner ad can reach'], ['Reach', 0, '1 at the door, 0.5 at the half value drive'], ['Cost', 0, 'Cost index: 1 is the metro'], ['Return', 0, 'Gross profit the first ad dollar brings back, pipeline included'], ['Cut', 0, 'What the line\'s last dollar brings back'], ['$ a month'], ['Bid · conf.', 0, 'The line\'s own bid adjustment and the chance the return clears the cut']], rows, 'keep')}</div>
        ${w ? `<div class="dsec">${sim() ? 'Simulated lows' : 'Forecast lows'} at this ZIP ${G(sim() ? 'D' : 'A')}</div><div class="hd-lows">${w.lows.map((t, i) => `<div>${esc(dshort((wk.wx.dates || [])[i] || '').split(' ').slice(0, 1).join(''))}<b>${isN(t) ? Math.round(t) + '°' : NA}</b></div>`).join('')}</div><div class="rowl" style="margin-top:6px"><span>Repair multiplier this week${w.first ? ' · first freeze' : ''}${w.alert ? ' · ' + ec(w.alert === true ? 'alert' : w.alert) : ''}${w.storm ? ' · storm reach' : ''}</span><b>${mult(w.W)}</b></div>${wr ? `<div class="rowl"><span>This week's dollars here</span><b>${usd(wr.dollars)}</b></div>` : ''}` : ''}
        <div class="dsec">What is in the homes</div>
        <div class="rowl"><span>Gas furnaces · past 20 years ${G('B')}</span><b>${N(z.furn)} · ${N(z.furn20)}</b></div><div class="rowl"><span>Heat pumps · electric furnaces ${G('B')}</span><b>${N(z.sys_hp)} · ${N(z.sys_ef)}</b></div>
        <div class="rowl"><span>Heating fuel: gas · electricity ${G('A')}</span><b>${P(z.gas_sh, 0)} · ${P(z.elec_sh, 0)}</b></div><div class="rowl"><span>Systems where a homeowner decides ${G('C')}</span><b>${pc(r.who)}</b></div>
        <div class="rowl"><span>Cold exposure${isN(hdd) ? ` · normal heating degree days` : ''} ${G(GR.exposure || 'C')}</span><b>${D(r.x, 2)}${isN(hdd) ? ' · ' + N(hdd) : ''}</b></div>${zn && isN(zn.fr32) ? `<div class="rowl"><span>Freeze nights in a normal year ${G('C')}</span><b>${D(zn.fr32, 0)}</b></div>` : ''}
        <div class="rowl"><span>Cost index · competitor pressure percentile ${G('D')}</span><b>${D(r.cost, 2)} · ${N(r.pressure)}</b></div>
        <div class="dsec">Message</div><div>${tags.map(t => `<span class="tag on">${esc(t)}</span>`).join('')}</div>
        <div class="rowl" style="margin-top:6px"><span>Google location criterion ID</span><b>${z.gid ? esc(z.gid) : 'by name'}</b></div>
        <div class="hd-acts"><button type="button" class="btn sm" data-act="${r.pinned ? 'unpin' : 'pin'}" data-zip="${esc(r.zip)}" aria-pressed="${!!r.pinned}">${r.pinned ? 'Unpin' : 'Pin'} ${esc(r.zip)}</button><button type="button" class="btn sec sm" data-act="${r.blocked ? 'unblock' : 'block'}" data-zip="${esc(r.zip)}" aria-pressed="${!!r.blocked}">${r.blocked ? 'Unblock' : 'Block'} ${esc(r.zip)}</button><button type="button" class="btn sec sm" data-act="zdesk" data-zip="${esc(r.zip)}">Campaign Desk ↗</button><button type="button" class="btn sec sm" data-act="zlines" data-zip="${esc(r.zip)}">Service Lines ↗</button></div>`;
    }
    function pick(zip, scroll) {
      zip = zip == null ? '' : String(zip).trim();
      if (!zip) { st.sel = null; st.miss = ''; }
      else if (!ZI[zip]) { st.sel = null; st.miss = zip.slice(0, 12); toast(`${st.miss} is not a ZIP code in this atlas`); }
      else { st.sel = zip; st.miss = ''; if (scroll) map.fitTo([zip]); }
      map.select(st.sel); zipCard(); table();
      if (scroll) setTimeout(() => { const c = $('#h17ZipCard', root); c.scrollIntoView({ block: 'start' }); c.focus({ preventScroll: true }); }, 0);
    }

    /* ---------- ranked ZIPs, with the bench on request ---------- */
    const tierLab = t => `<span class="hd-lab ${String(t).toLowerCase()}">${esc(t)}</span>`;
    const lineCell = c => (c && c.spend > 0 ? `${usd(c.spend)}<small>${sg(c.bid)}</small>` : '');
    function table() {
      const rows = plan.zips.map(r => ({ zip: r.zip, city: r.city, county: r.county, min: r.min, tier: r.tier, share: r.share * 100, dollars: r.dollars, bid: r.bid, conf: r.conf * 100, label: r.label, c: r.lines || {}, leads: r.leads, fuel: r.fuel, why: r.why, rank: r.rank, bench: false }))
        .concat(st.bench ? plan.bench.map(b => ({ zip: b.zip, city: b.city, county: b.county, min: b.min, tier: HX.tier(b.min), share: null, dollars: null, bid: null, conf: null, label: 'Bench', c: {}, leads: null, fuel: plan.at[b.zip] ? plan.at[b.zip].fuel : '', why: `Not in the plan at ${usd(plan.T.budget)}: ${b.reason}. ${isN(b.enterAt) ? `Enters at about ${usd(b.enterAt)} a month` : 'Enters at a larger budget'}${b.via && b.via.length ? ' through ' + list(b.via.map(id => WORD[id] || id)) : ''}`, rank: null, bench: true, enterAt: b.enterAt })) : []);
      dataTable($('#h17Tbl', root), [
        { k: 'rank', h: '#', f: v => (isN(v) ? N(v) : '') }, { k: 'zip', h: 'ZIP', l: 1, f: v => `<b>${esc(v)}</b>` }, { k: 'city', h: 'City', l: 1, f: v => esc(v) }, { k: 'county', h: 'County', l: 1, f: v => esc(v) },
        { k: 'min', h: 'Min', t: 'Drive minutes: 5 plus straight line kilometres (grade C)', f: v => N(v) }, { k: 'tier', h: 'Tier', l: 1, t: 'Drive tier: Core 20 minutes or less, Ring 20 to 35, Far over 35', f: (v, r) => (r.bench ? '<span class="hd-lab bench">Bench</span> ' : '') + tierLab(v) },
        { k: 'share', h: 'Share', t: 'Share of the plan\'s dollars (grade C)', f: v => (isN(v) ? `<span class="hd-sharebar"><i style="width:${clamp(v / Math.max(1, plan.zips[0] ? plan.zips[0].share * 100 : 1) * 100, 2, 100).toFixed(0)}%"></i></span>${P(v, 2)}` : '') },
        { k: 'dollars', h: '$ a month', f: (v, r) => (isN(v) ? usd(v) : isN(r.enterAt) ? `<span class="mini">at ${usd(r.enterAt)}</span>` : '') }, { k: 'bid', h: 'Bid', t: 'Blended location bid adjustment: value of a click here against the campaign average (grade D)', f: v => (isN(v) ? sg(v) : '') },
        { k: 'conf', h: 'Confidence', l: 1, t: 'Chance the return clears the cut, given the stated doubt: Firm 80% or more, Likely 50 to 80%, Test under 50% (grade D)', f: (v, r) => (isN(v) ? `<span class="hd-lab ${String(r.label).toLowerCase()}">${esc(r.label)}</span> ${P(v, 0)}` : '') },
      ].concat(IDS.map(id => ({ k: 'c_' + id, h: esc(SHORT[id]), t: `${NAMES[id]}: dollars a month and the line's own bid adjustment`, cls: 'hd-cell', v: r => (r.c[id] && r.c[id].spend > 0 ? r.c[id].spend : null), f: (v, r) => lineCell(r.c[id]) }))).concat([
        { k: 'leads', h: 'Leads', t: 'Expected leads a month (grade D)', f: v => (isN(v) ? D(v, 1) : '') }, { k: 'fuel', h: 'Fuel', l: 1, f: v => esc(v) }, { k: 'why', h: 'Why', l: 1, cls: 'hd-whyc', f: v => ec(v) },
      ]), rows, { sortKey: 'dollars', id: r => r.zip, onClick: zip => pick(zip === st.sel ? null : zip), rowClass: r => (r.zip === st.sel ? 'sel ' : '') + (r.bench ? 'hd-benchrow' : '') });
      const cr = plan.tiers.map(t => `${t.tier} (${t.words}) ${pc(t.share)} in ${plural(t.zips, 'ZIP')}`).join(' · ');
      $('#h17TblN', root).innerHTML = `<b>${plural(plan.T.zips, 'ZIP')} in the plan</b>${st.bench ? `, then ${plural(plan.bench.length, 'ZIP')} on the bench with the budget at which each enters` : ''}. ${cr}. Minutes ${G(GR.minutes || 'C')} share and dollars ${G(GR.spend || 'C')} bids, confidence and leads ${G('D')}. Each line cell shows dollars a month, then that line's own bid adjustment.`;
      CSV.zips = () => ['ranked-zips', ['rank', 'zip', 'city', 'county', 'drive_minutes', 'drive_tier', 'share_pct', 'monthly_usd', 'bid_adjustment_pct', 'confidence_pct', 'confidence_label'].concat(IDS.flatMap(id => [id + '_usd', id + '_bid_pct'])).concat(['leads', 'fuel_lead', 'enters_at_monthly_usd', 'why']),
        rows.map(r => [r.rank == null ? '' : r.rank, r.zip, r.city, r.county, Math.round(r.min), r.tier, r.bench ? 0 : r6(r.share.toFixed(3)), r.bench ? 0 : Math.round(r.dollars), r.bid == null ? '' : r.bid, r.conf == null ? '' : Math.round(r.conf), r.label].concat(IDS.flatMap(id => (r.c[id] && r.c[id].spend > 0 ? [Math.round(r.c[id].spend), r.c[id].bid] : ['', '']))).concat([r.leads == null ? '' : r6(r.leads.toFixed(2)), r.fuel, r.bench && isN(r.enterAt) ? Math.round(r.enterAt) : '', clean(r.why)])),
        `Heat Desk plan for ${plan.monthName} at ${usd(plan.T.budget)} a month. Minutes grade C; share and dollars grade C; bids, confidence and leads grade D. ZIP dollars are where spend is expected to land, not a platform setting.`];
    }

    /* ---------- close to the shop and not in the plan ---------- */
    function held() {
      const hs = HX.held(plan);
      $('#h17Held', root).innerHTML = hs.length ? `<div class="tscroll short">${tbl([['ZIP', 1], ['City', 1], ['Min'], ['Households'], ['Pressure', 0, 'Competitor paid pressure percentile for heating repair (grade C)'], ['Cost', 0, 'Cost index: 1 is the metro (grade D)'], ['Owner share', 0, 'Systems where a homeowner decides (grade C)'], ['Why it is held back', 1], ['Enters at', 0, 'Monthly budget at which the plan would buy it'], ['', 1]],
        hs.map(h => tr([[`<b>${esc(h.zip)}</b>`, 'l'], [esc(h.city), 'l'], N(h.min), N(h.households), n0(h.pressure), isN(h.cost) ? D(h.cost, 2) : NA, pc(h.who), [ec(h.reason), 'l hd-whyc'], isN(h.enterAt) ? usd(h.enterAt) : '', [h.code === 'blocked' ? `<button type="button" class="btn sec sm" data-act="unblock" data-zip="${esc(h.zip)}" aria-label="Unblock ${esc(h.zip)} ${esc(h.city)}">Unblock</button>` : `<button type="button" class="btn sec sm" data-act="pin" data-zip="${esc(h.zip)}" aria-label="Pin ${esc(h.zip)} ${esc(h.city)}">Pin</button>`, 'l']], h.zip === st.sel ? 'sel' : '')))}</div>` : '<p class="hd-empty">Every ZIP within 25 minutes of the shop is in the plan.</p>';
      CSV.held = () => ['held-back', ['zip', 'city', 'county', 'drive_minutes', 'households', 'pressure_percentile', 'cost_index', 'homeowner_share_pct', 'code', 'why_held', 'enters_at_monthly_usd'], hs.map(h => [h.zip, h.city, h.county, Math.round(h.min), Math.round(h.households), isN(h.pressure) ? Math.round(h.pressure) : '', isN(h.cost) ? r6(h.cost.toFixed(3)) : '', isN(h.who) ? Math.round(h.who * 100) : '', h.code, clean(h.reason), isN(h.enterAt) ? Math.round(h.enterAt) : '']), `ZIPs within 25 minutes of the shop that the plan holds back at ${usd(plan.T.budget)} a month in ${plan.monthName}. Reasons are the engine's own words.`];
    }
