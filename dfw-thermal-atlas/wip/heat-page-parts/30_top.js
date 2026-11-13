    /* ---------- notices above the answer: what is simulated, what is missing ---------- */
    function gate() {
      const out = [], miss = [];
      if (fail) out.push(callout('', 'The plan could not be computed', `The engine stopped with this message: ${esc(fail)}. What shows below is the last plan that worked. Reset every setting if this followed a change you made.`));
      if (sim()) out.push(callout('judg', 'Simulation, not a forecast', `${ec(wk.label || 'A simulated week')}. The week card, the Monday list and the week sheet show invented lows built from the live ones, to see what the cold rules would do. The month plan does not change. <button type="button" class="lnk" data-act="live">Back to the live forecast</button>`));
      if (!F0) miss.push('<b>The forecast.</b> No seven night forecast is stored, so the week runs as a normal week and no cold rule fires. Live Data fetches it.');
      else if (F0.stale) miss.push(`<b>A fresh forecast.</b> The stored one is from ${esc(stamp(F0.at))}, more than 36 hours old, so the week runs as a normal week until it refreshes.`);
      if (plan.exposure.source === 'none') miss.push('<b>Normal cold by ZIP.</b> The climate baseline is not in this build, so cold exposure is 1 in every ZIP. Near Mesquite the effect is small.');
      if (miss.length) out.push(callout('note', 'What is missing right now', `<ul class="hooks">${miss.map(m => `<li>${m}</li>`).join('')}</ul>`));
      $('#h17Gate', root).innerHTML = out.join('');
    }
    function meta() {
      const T = plan.T;
      $('#h17M1', root).innerHTML = `<b>${N(T.zips)}</b> ${T.zips === 1 ? 'ZIP' : 'ZIPs'} in the plan`;
      $('#h17M2', root).innerHTML = `<b>${N(T.households)}</b> households in them`;
      $('#h17M3', root).innerHTML = `<b>${pc(T.share20)}</b> of the money within 20 minutes of the shop`;
      $('#h17M4', root).innerHTML = F0 ? `<b>Forecast</b> fetched ${esc(LIVE.ago(F0.at))}${F0.baseline ? ', the copy baked into this build' : ''}` : '<b>Forecast</b> not stored yet';
    }

    /* ---------- the answer: where, on what, this week, on Monday. Every number is read from the same plan and week the tables print. ---------- */
    function whyMix(lead) {
      const h = plan.line.heat, f = plan.line.furnace;
      if (plan.T.mode === 'custom') return `The split is yours: a custom mix of ${list(IDS.map(id => `${WORD[id]} ${N(PP.mix[id])}%`))}, each line filled on its own.`;
      if (lead.id === 'heat') return `Repair leads because ${plan.monthName} is a cold month for no heat calls (season index ${N(h.season)}, where 100 is an average month) and ads can win about ${P(h.sigma * 100, 1)} of repair jobs against ${P(f.sigma * 100, 1)} of furnace replacements. The replacement ZIPs fill up first and the money moves on to repair.`;
      if (h.season < 100) return `${WORD[lead.id].charAt(0).toUpperCase() + WORD[lead.id].slice(1)} leads this month because heating repair is out of season (index ${N(h.season)}, where 100 is an average month). Repair takes over with the first cold nights.`;
      return `The fill puts ${WORD[lead.id]} first this month; the line table shows what each line returns.`;
    }
    function answer() {
      const T = plan.T, L = plan.lines.filter(l => l.dollars > 0).sort((a, b) => b.dollars - a.dollars), cs = plan.counties.filter(c => c.dollars > 0);
      const city = {}; plan.zips.forEach(r => { city[r.city] = (city[r.city] || 0) + r.dollars; }); const cities = Object.keys(city).sort((a, b) => city[b] - city[a]).slice(0, 3);
      let where, what, week;
      if (!T.zips || !L.length) { where = `No ZIP clears the plan at ${usd(T.budget)} a month in ${plan.monthName}. Raise the budget, widen the reach or clear the blocked ZIPs.`; what = 'With nothing in the plan there is no line mix to report.'; }
      else {
        const far = plan.zips.reduce((a, b) => (b.min > a.min ? b : a));
        where = `Spend it close to the shop. At ${usd(T.budget)} a month in ${plan.monthName} the plan buys <b>${plural(T.zips, 'ZIP')}</b>, with <b>${pc(T.share20)}</b> of the money within 20 minutes of the dispatch point and nothing past <b>${N(T.farthest)} minutes</b> (${esc(far.city)} ${esc(far.zip)}). `
          + (cs.length === 1 ? `All of it lands in <b>${esc(cs[0].county)} County</b>. ` : `<b>${esc(cs[0].county)} County</b> takes ${pc(cs[0].share)}, then ${list(cs.slice(1, 4).map(c => `${esc(c.county)} ${pc(c.share)}`))}. `)
          + `The cities that lead are ${list(cities.map(esc))}.`
          + (T.unspent > 0.5 ? ` ${usd(T.unspent)} stays unspent: ${isN(T.hurdleAt) ? `past ${usd(T.hurdleAt)} a month ` : ''}the last dollar would bring back less than $${D(T.hurdle, 2)} of gross profit.` : '') + ` ${G(GR.spend || 'C')}`;
        what = `<b>${esc(L[0].name)}</b> leads with ${pc(L[0].share)} of the money (${usd(L[0].dollars)})${L.length > 1 ? ', then ' + list(L.slice(1).map(l => `${WORD[l.id]} ${pc(l.share)}`)) : ''}. ${whyMix(L[0])} ${G('D')}`;
      }
      if (wk.src === 'normal') week = `${wk.missing || !F0 ? 'No forecast is stored' : 'The stored forecast is more than 36 hours old'}, so the week runs as a normal ${esc(wk.monthName)} week: ${usd(wk.T.normal)} across the four lines and nothing drawn from the reserve.`;
      else {
        const h = wk.lines.find(l => l.id === 'heat') || wk.lines[0], rs = wk.reserve;
        week = `${simTag()}${wk.head && wk.head.headline ? ec(wk.head.headline) + '. ' : ''}Heating repair runs ${over(chg(h))} a normal ${esc(wk.monthName)} week${h.paused ? ' (paused)' : ''}. The week comes to <b>${usd(wk.T.week)}</b> against a normal ${usd(wk.T.normal)}, `
          + (rs.draw > 0.5 ? `drawing ${usd(rs.draw)} from the freeze reserve` : rs.back > 0.5 ? `returning ${usd(rs.back)} to the freeze reserve` : 'with nothing moving in or out of the freeze reserve') + '. '
          + (wk.trigger ? 'A cold trigger is on, so the ZIP list is recut for the week.' : 'No cold trigger: the ZIP list and the bids stay as they are.') + ` ${G('A/D')}`;
      }
      const monday = wk.list && wk.list.length ? ec(wk.list[0].text) : 'Nothing to change. Hold the month plan as it stands.';
      $('#h17Answer', root).innerHTML = `<h2 id="h17AnsH">The answer: where to spend, on what, and what to do on Monday</h2>
        <dl class="hd-ans"><dt>Where</dt><dd data-a="where">${where}</dd><dt>On what</dt><dd data-a="what">${what}</dd><dt>This week</dt><dd data-a="week">${week}</dd><dt>On Monday</dt><dd data-a="monday">${monday}</dd></dl>
        <p class="hd-fine"><b>Measured:</b> homes, heating fuel and system ages, the normal cold of each ZIP, the forecast and the alerts. <b>Stated:</b> how far a lead is worth driving, lead costs, close rates and the size of every cold response, all grade D and all editable below. The dollar outcomes are what those benchmarks imply, shown with their range. They are not a promise.</p>`;
    }

    /* ---------- KPI row ---------- */
    function nextTrigger() {
      if (wk.src === 'normal' || !F) return 'No usable forecast: the week runs as a normal week.';
      if (wk.trigger) return `Cold trigger on${wk.triggerWhy && wk.triggerWhy.length ? ': ' + ec(list(wk.triggerWhy)) : ''}.`;
      const TH = (window.TDA_LIVE && TDA_LIVE.derive && TDA_LIVE.derive.TH) || { cold: 40, freeze: 32, hard: 25 }, lo = F.head ? F.head.minLow : null;
      const nx = [['cold nights', TH.cold], ['a freeze', TH.freeze], ['a hard freeze', TH.hard], ['extreme cold', 15]].find(s => isN(lo) && lo > s[1]);
      return nx ? `No cold trigger. The next threshold is ${nx[0]} at ${nx[1]}°F, ${Math.round(lo - nx[1])}°F below the coldest night ahead.` : 'Every night threshold is already crossed this week.';
    }
    function kpis() {
      const T = plan.T, tiers = plan.tiers.map(t => `${t.tier} ${pc(t.share)}`).join(', '), lo = F && F.head && isN(F.head.minLow) ? F.head.minLow : null;
      $('#h17Kpis', root).innerHTML = kpiHTML([
        { l: 'Monthly heating media', g: GR.spend || 'C', v: usd(T.spent), d: T.unspent > 0.5 ? `${usd(T.unspent)} of ${usd(T.budget)} left unspent under the hurdle${isN(T.hurdleAt) ? `, which starts at ${usd(T.hurdleAt)} a month` : ''}` : `all of ${usd(T.budget)} placed, nothing left unspent; the last dollar returns $${D(T.lambda, 2)} in decision weights against a hurdle of $${D(T.hurdle, 2)}` },
        { l: 'ZIPs in the plan', g: GR.spend || 'C', v: N(T.zips), d: `${N(T.households)} households · ${N(T.cells)} ZIP by line cells funded` },
        { l: 'Within 20 minutes', g: GR.minutes || 'C', v: pc(T.share20), d: `of the money; farthest ZIP ${n0(T.farthest)} minutes · ${tiers}` },
        { l: 'Leads a month', g: GR.leads || 'D', v: n0(T.leads), d: `${usd(T.cpl)} a lead · range ${rng(band('leads'), n0)} leads, 10th to 90th percentile` },
        { l: 'Booked jobs a month', g: GR.jobsBooked || 'D', v: n1(T.jobs), d: `${usd(T.cpj)} a job · range ${rng(band('jobs'), n1)}` },
        { l: 'Gross profit, direct', g: GR.gp || 'D', v: usd(T.gpDirect), d: `range ${rng(band('gpDirect'), usd)} · with pipeline ${usd(T.gp)}, range ${rng(band('gp'), usd)} · benchmark arithmetic, not a forecast` },
        { l: sim() ? 'Coldest low, simulated' : 'Coldest forecast low', g: sim() ? 'D' : GR.forecast || 'A', v: lo == null ? NA : Math.round(lo) + '°F', d: nextTrigger() },
      ]);
    }

    /* ---------- this week ---------- */
    function week() {
      const rs = wk.reserve || {}, hd = wk.head || {}, normal = wk.src === 'normal';
      const nights = (wk.days || []).map(d => `<div class="hd-night"><div class="hd-nd">${ec(d.label || dshort(d.date))}</div><div class="hd-nl"><b>${isN(d.low) ? Math.round(d.low) + '°F' : NA}</b><span>at the shop</span></div><div class="hd-nr">${isN(d.metroMin) && isN(d.metroMax) ? (Math.round(d.metroMin) === Math.round(d.metroMax) ? `${Math.round(d.metroMin)}°F` : `${Math.round(d.metroMin)} to ${Math.round(d.metroMax)}°F`) + ' across the metro' : 'no metro range'}</div><div>${d.tierName ? `<span class="hd-chip t${clamp(Math.round(d.tier) || 0, 0, 4)}">${ec(d.tierName)}</span>` : ''}${d.alert ? ` <span class="hd-chip warn">${ec(d.alert === true ? 'alert' : d.alert)}</span>` : ''}${d.ice ? ' <span class="hd-chip warn">ice</span>' : ''}</div><div class="hd-nb"><b>${usd(d.repair)}</b> repair that day${isN(d.capUp) && d.capUp > 0 ? ` · bid caps +${Math.round(d.capUp)}%` : ''}</div></div>`).join('');
      const rows = wk.lines.map(l => tr([[esc(l.name), 'l'], usd(l.normal), `<b>${usd(l.week)}</b>`, sd(l.week - l.normal), mult(l.mult), [[l.paused ? 'paused this week' : '', l.carried ? 'keeps the lift of last week\'s cold' : '', l.added ? `${N(l.added)} ZIPs added` : '', l.dropped ? `${N(l.dropped)} paused` : ''].filter(Boolean).join(' · ') || `${n0(l.zips)} ZIPs`, 'l']]));
      rows.push(tr([['Total', 'l'], usd(wk.T.normal), `<b>${usd(wk.T.week)}</b>`, sd(wk.T.week - wk.T.normal), mult(wk.T.mult), [`${n0(wk.T.zips)} ZIPs · ${n0(wk.T.leads)} leads expected ${G('D')}`, 'l']], 'hd-total'));
      const zl = a => list(a.map(x => `${esc(x.zip)} ${esc(x.city || '')}`.trim()));
      const extra = [wk.added && wk.added.length ? `Added this week: ${zl(wk.added)}.` : '', wk.paused && wk.paused.length ? `Paused this week: ${zl(wk.paused)}.` : '', wk.crew && wk.crew.text ? ec(wk.crew.text) : '', wk.month !== plan.month ? `The week uses the ${esc(wk.monthName)} plan and its normal night; the plan card is set to ${esc(plan.monthName)}.` : ''].concat((wk.notes || []).map(n => ec(n.text))).filter(Boolean);
      $('#h17Week', root).innerHTML = `<p class="hd-weekhead">${simTag()}${ec(hd.headline || (normal ? `A normal ${wk.monthName} week` : 'The next seven nights'))}</p><p class="hd-weeksub">${hd.eyebrow ? `<b>${ec(hd.eyebrow)}.</b> ` : ''}${ec(hd.sub || '')}${normal ? ` ${wk.missing || !F0 ? 'No forecast is stored' : 'The stored forecast is more than 36 hours old'}, so every multiplier is 1 and nothing is drawn from the reserve.` : ''}</p>
        ${nights ? `<div class="hd-nights">${nights}</div>` : ''}
        <div class="hd-week2"><div><div class="dsec">The week by line ${G('D')}</div><div class="xscroll">${tbl([['Line', 1], ['Normal week'], ['This week'], ['Change'], ['Multiplier', 0, 'This week against a normal week of the month, on the line\'s own ZIPs'], ['Note', 1]], rows)}</div>
          <p class="hd-reserve"><b>Freeze reserve:</b> ${ec(rs.text || `${pc(rs.share)} of the month, ${usd(rs.month)}.`)}${rs.toDate && rs.toDate.text ? ' ' + ec(rs.toDate.text) : ''} The desk keeps no ledger from week to week: track the reserve against what the account actually spent. ${G(GR.reserve || 'D')}</p>
          ${extra.length ? `<ul class="hooks">${extra.map(x => `<li>${x}</li>`).join('')}</ul>` : ''}</div>
          <div><div class="dsec">Do this on Monday${wk.monday ? ', ' + esc(day(wk.monday)) : ''}</div>${wk.list && wk.list.length ? `<ol class="hd-monday">${wk.list.map(x => `<li>${ec(x.text)}</li>`).join('')}</ol>` : '<p class="hd-empty">Nothing to change. Hold the month plan as it stands.</p>'}</div></div>`;
      CSV.week = () => ['week', ['section', 'label', 'date', 'normal_week_usd', 'this_week_usd', 'change_usd', 'multiplier', 'low_f_at_shop', 'metro_low_min_f', 'metro_low_max_f', 'threshold', 'repair_usd_that_day'],
        wk.lines.map(l => ['line', l.name, '', Math.round(l.normal), Math.round(l.week), Math.round(l.week - l.normal), r6(l.mult), '', '', '', '', '']).concat((wk.days || []).map(d => ['night', d.label || '', d.date || '', '', '', '', '', isN(d.low) ? Math.round(d.low) : '', isN(d.metroMin) ? Math.round(d.metroMin) : '', isN(d.metroMax) ? Math.round(d.metroMax) : '', d.tierName || '', Math.round(d.repair)])),
        `${sim() ? 'SIMULATION, not a forecast. ' : ''}Week of ${day(wk.monday || wk.today || today())}. Forecast lows grade A; multipliers and budgets grade D.`];
    }
