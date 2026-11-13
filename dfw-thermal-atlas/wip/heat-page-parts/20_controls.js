    /* ---------- the plan: controls built once from the engine's own ranges, so no control can ask for a value the engine refuses ---------- */
    const cid = p => 'h17c_' + p.replace(/\W/g, '_'), k100 = p => (R[p] && R[p].pct ? 100 : 1), r6 = v => +(+v).toFixed(6);
    const unitOf = p => { const u = (R[p] || {}).unit || ''; return u === 'x' ? '×' : u; };
    const lab = (p, alt) => alt || ec((R[p] && R[p].label) || p);
    const shownV = (p, v) => (isN(v) ? r6(v * k100(p)) : '');
    const attrs = p => { const r = R[p] || {}, k = k100(p); return `${isN(r.min) ? ` min="${r6(r.min * k)}"` : ''}${isN(r.max) ? ` max="${r6(r.max * k)}"` : ''} step="${isN(r.step) ? r6(r.step * k) : 'any'}"`; };
    const lrow = (p, o, extra) => `<div class="hd-lr"><label class="fl" for="${cid(p)}">${lab(p, o.l)}${unitOf(p) && !o.nounit ? ' (' + esc(unitOf(p)) + ')' : ''}</label>${G((R[p] || {}).grade || o.g || 'D')}${extra || ''}</div>`;
    const numF = (p, o) => { o = o || {}; return `<div class="hd-f">${lrow(p, o)}<input type="number" id="${cid(p)}" data-p="${p}" inputmode="decimal"${attrs(p)}>${o.hint ? `<span class="hd-hint">${o.hint}</span>` : ''}</div>`; };
    const rngF = (p, o) => { o = o || {}; return `<div class="hd-f">${lrow(p, Object.assign({ nounit: 1 }, o), `<span class="hd-val" id="${cid(p)}_v"></span>`)}<input type="range" id="${cid(p)}" data-p="${p}"${o.also ? ` data-also="${o.also}"` : ''}${attrs(p)}>${o.hint ? `<span class="hd-hint">${o.hint}</span>` : ''}</div>`; };
    const chkF = (p, text) => `<label class="chk"><input type="checkbox" id="${cid(p)}" data-p="${p}"> ${text}</label>`;
    const PLACED = ['budget', 'reserve', 'month'];                                     // drawn by hand in the plan card; half.* and mix.* too
    const GROUPS = [['Fill and guards', ['cut', 'trust', 'doubt', 'gamma', 'hurdle', 'depth', 'zipCap', 'lineMin', 'coreMin']], ['What ads can win, and what a job is worth', ['paid', 'cap', 'pipeCredit']], ['Who decides, and cold exposure', ['dmw', 'coldExp']], ['Platform minimums ($ a month): a platform under its minimum folds into Google Search', ['platMin']], ['Crews and phones', ['crewCap', 'hours']]];
    const rkeys = Object.keys(R), top = p => p.split('.')[0];
    const advKeys = rkeys.filter(p => R[p].where !== 'cold' && PLACED.indexOf(p) < 0 && ['half', 'mix', 'plat', 'nightW', 'resp', 'alertFloor'].indexOf(top(p)) < 0);
    const grouped = GROUPS.map(([t, ks]) => [t, advKeys.filter(p => ks.indexOf(top(p)) >= 0)]).concat([['Other', advKeys.filter(p => !GROUPS.some(g => g[1].indexOf(top(p)) >= 0))]]).filter(g => g[1].length);
    const platRows = rkeys.some(p => top(p) === 'plat') ? `<div class="hd-advg">Platform mix by line (%): where each line's money runs before minimums fold it</div><div class="xscroll"><table class="hd-plat"><thead><tr>${th('Line', 1)}${HX.PLATS.map(pl => th(esc(HX.PLAT_NAMES[pl]))).join('')}</tr></thead><tbody>${IDS.map(id => `<tr><td class="l">${esc(NAMES[id])}</td>${HX.PLATS.map(pl => { const p = `plat.${id}.${pl}`; return `<td>${R[p] ? `<input type="number" id="${cid(p)}" data-p="${p}" aria-label="${esc(NAMES[id])} on ${esc(HX.PLAT_NAMES[pl])}, percent"${attrs(p)}>` : ''}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div><p class="hd-hint">Each row is rescaled to add to 100. ${G('D')}</p>` : '';
    const monthOpts = `<option value="">This month (${MON[new Date().getMonth()]})</option>` + MON.map((m, i) => `<option value="${i}">${m}</option>`).join('');
    $('#h17Plan', root).innerHTML = `<div class="hd-plan">
        ${numF('budget', { l: 'Monthly heating media', hint: 'Dollars for the month: all four lines, every platform.' })}
        <div class="hd-f"><div class="hd-lr"><label class="fl" for="h17Month">Month</label>${G('B')}</div><select id="h17Month">${monthOpts}</select><span class="hd-hint">Sets each line's season. The week card always uses the month the forecast falls in.</span></div>
        <div class="hd-f"><div class="hd-lr"><span class="fl" id="h17BidL">Bidding mode</span></div><div class="seg" id="h17Bid" role="group" aria-labelledby="h17BidL"><button type="button" data-v="manual">Manual or Maximize clicks</button><button type="button" data-v="smart">Smart Bidding</button></div><span class="hd-hint" id="h17BidH"></span></div>
        <div class="hd-f"><div class="hd-lr"><span class="fl">Local Services Ads</span></div>${chkF('lsaLive', 'Local Services Ads are live')}<span class="hd-hint">Off by default: the August 2026 roster shows no Local Services badge for the client. Switch it on once the profile is verified.</span></div>
        ${rngF('half.heat', { l: 'Reach, heating repair', hint: 'Drive minutes at which a repair lead is worth half.' })}
        ${rngF('half.furnace', { l: 'Reach, replacement', also: 'half.heatpump', hint: 'Furnace and heat pump replacement move together.' })}
        ${rngF('half.maint', { l: 'Reach, tune up', hint: 'A small ticket cannot carry a long drive.' })}
        ${rngF('reserve', { l: 'Freeze reserve', hint: 'Share of the month held back for cold weeks.' })}
        <div class="hd-f wide"><div class="hd-lr"><span class="fl" id="h17ModeL">Line mix</span>${G('D')}</div><div class="seg" id="h17Mode" role="group" aria-labelledby="h17ModeL"><button type="button" data-v="auto">Auto</button>${Object.keys(HX.PRESETS || {}).map(k => `<button type="button" data-v="${esc(k)}">${ec(HX.PRESETS[k].name)}</button>`).join('')}<button type="button" data-v="custom">Custom</button></div>
          <div class="hd-mix" id="h17Mix">${IDS.map(id => `<label for="h17Mix_${id}">${esc(NAMES[id])} (%)<input type="number" id="h17Mix_${id}" data-mix="${id}" min="0" max="100" step="1" inputmode="numeric"></label>`).join('')}</div><span class="hd-hint" id="h17ModeH"></span></div>
        <div class="hd-f"><div class="hd-lr"><label class="fl" for="h17PinIn">Pin a ZIP</label></div><div class="hd-ziprow"><input type="text" id="h17PinIn" inputmode="numeric" maxlength="5" placeholder="75150" autocomplete="off"><button type="button" class="btn sec sm" data-act="addpin">Pin</button></div><div class="hd-ziplist" id="h17Pins"></div><span class="hd-hint">A pinned ZIP is kept in every line that can reach it.</span></div>
        <div class="hd-f"><div class="hd-lr"><label class="fl" for="h17BlkIn">Block a ZIP</label></div><div class="hd-ziprow"><input type="text" id="h17BlkIn" inputmode="numeric" maxlength="5" placeholder="75201" autocomplete="off"><button type="button" class="btn sec sm" data-act="addblock">Block</button></div><div class="hd-ziplist" id="h17Blocks"></div><span class="hd-hint">A blocked ZIP gets nothing and goes into the exclusions file.</span></div>
      </div>
      <details class="hd-adv" id="h17Adv"><summary>Advanced: every other assumption, with its grade</summary>
        ${grouped.map(([t, ks]) => `<div class="hd-advg">${t}</div><div class="hd-plan">${ks.map(p => numF(p)).join('')}${t === 'Crews and phones' && HX.DEF.hours ? `<div class="hd-f"><div class="hd-lr"><span class="fl">Phones</span></div>${'sunday' in HX.DEF.hours ? chkF('hours.sunday', 'Phones are answered on Sunday') : ''}${'onCall' in HX.DEF.hours ? chkF('hours.onCall', 'On call during cold alerts, 6 am to 10 pm every day') : ''}</div>` : ''}</div>`).join('')}
        ${platRows}
      </details>`;
    const coldKeys = rkeys.filter(p => R[p].where === 'cold' || ['nightW', 'resp', 'alertFloor'].indexOf(top(p)) >= 0);
    $('#h17RuleEd', root).innerHTML = coldKeys.length ? `<div class="hd-plan hd-cold">${coldKeys.map(p => numF(p)).join('')}</div><p class="hd-hint">A 40°F night weighs 1. Repair follows the week's multiplier one for one; the replacement lines take the stated share of its lift and tune ups give the same share back.</p>` : '<p class="hd-empty">The engine publishes no editable cold rule in this build.</p>';
    const nullable = p => { try { return HX.get(HX.DEF, p) === null; } catch (e) { return false; } };
    const readout = el => { const o = $('#' + el.id + '_v', root); if (!o) return; const u = (R[el.dataset.p] || {}).unit; o.textContent = u === 'min' ? el.value + ' min' : u === '%' ? el.value + '%' : u === '$' ? usd(+el.value) : el.value; };
    function readCtl(el) { const p = el.dataset.p; if (el.type === 'checkbox') return el.checked; if (el.value.trim() === '') return nullable(p) ? null : undefined; const v = +el.value; return isN(v) ? v / k100(p) : undefined; }
    /* one control into the saved patch: the engine clamps it, and only the top level key it belongs to is stored */
    function commit(el) {
      const p = el.dataset.p, v = readCtl(el); if (v === undefined) return false;
      let P2; try { P2 = HX.set(PP, p, v); (el.dataset.also || '').split(',').filter(Boolean).forEach(q => { P2 = HX.set(P2, q, v); }); } catch (e) { return false; }
      st.P[top(p)] = P2[top(p)]; save(); return true;
    }
    function setMix(id, v) {
      v = clamp(Math.round(+v) || 0, 0, 100); const rest = IDS.filter(x => x !== id), cur = rest.map(x => +PP.mix[x] || 0), s = sum(cur), left = 100 - v, out = { [id]: v }; let acc = 0;
      rest.forEach((x, i) => { out[x] = Math.max(0, i === rest.length - 1 ? left - acc : Math.round(s > 0 ? left * cur[i] / s : left / rest.length)); acc += out[x]; });
      st.P.mode = 'custom'; st.P.mix = out; st.mixSel = 'custom'; save();
    }
    function toggleZip(kind, zip, on) {
      zip = String(zip == null ? '' : zip).trim();
      if (!ZI[zip]) { toast(zip ? `${zip.slice(0, 10)} is not a ZIP code in this atlas` : 'Type a five digit ZIP code first'); return false; }
      if (on && !plan.at[zip]) { toast(`${zip} has too few households to plan`); return false; }
      const cur = { pins: (PP.pins || []).filter(z => z !== zip), blocks: (PP.blocks || []).filter(z => z !== zip) }; if (on) cur[kind].push(zip);
      st.P.pins = cur.pins; st.P.blocks = cur.blocks; save(); render();
      toast(`${zip} ${ZI[zip].city} ${on ? (kind === 'pins' ? 'pinned' : 'blocked') : (kind === 'pins' ? 'unpinned' : 'unblocked')}`); return true;
    }
    function syncUI(force) {
      const act = document.activeElement;
      $$('[data-p]', root).forEach(el => { if (!force && el === act) return; const v = HX.get(PP, el.dataset.p); if (el.type === 'checkbox') el.checked = !!v; else { el.value = v == null ? '' : shownV(el.dataset.p, v); if (el.type === 'range') readout(el); } });
      const m = $('#h17Month', root); if (force || m !== act) m.value = st.P.month == null ? '' : String(PP.month);
      const preset = Object.keys(HX.PRESETS || {}).find(k => IDS.every(id => Math.round(HX.PRESETS[k].mix[id]) === Math.round(PP.mix[id])));
      const mode = PP.mode !== 'custom' ? 'auto' : st.mixSel && (st.mixSel === 'custom' || st.mixSel === preset) ? st.mixSel : preset || 'custom';
      $$('#h17Mode button', root).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === mode)));
      $$('#h17Bid button', root).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === PP.bidding)));
      IDS.forEach(id => { const i = $('#h17Mix_' + id, root); i.disabled = PP.mode !== 'custom'; if (force || i !== act) i.value = Math.round(PP.mode === 'custom' ? PP.mix[id] : plan.T.mix[id] * 100); });
      $('#h17ModeH', root).innerHTML = PP.mode === 'custom' ? 'Custom: each line is filled on its own with its share of the budget. Change one share and the other three rescale so the four add to 100.' : `Auto: one fill across the four lines decides the split, and the boxes show how it came out this month. Pick Custom to set it yourself.`;
      $('#h17BidH', root).innerHTML = PP.bidding === 'smart' ? 'Smart Bidding ignores location bid adjustments, so the plan builds one campaign per drive tier, each with its own budget and first target cost per lead.' : 'Location bid adjustments by ZIP are exported. They work with manual bidding and Maximize clicks only.';
      const zt = (zip, kind) => `<span class="hd-zt${kind === 'blocks' ? ' blk' : ''}">${esc(zip)} ${esc((ZI[zip] || {}).city || '')}<button type="button" data-act="${kind === 'pins' ? 'unpin' : 'unblock'}" data-zip="${esc(zip)}" aria-label="Remove ${esc(zip)} from the ${kind === 'pins' ? 'pinned' : 'blocked'} ZIP codes">×</button></span>`;
      $('#h17Pins', root).innerHTML = (PP.pins || []).length ? PP.pins.map(z => zt(z, 'pins')).join('') : '<span class="hd-hint">None pinned.</span>';
      $('#h17Blocks', root).innerHTML = (PP.blocks || []).length ? PP.blocks.map(z => zt(z, 'blocks')).join('') : '<span class="hd-hint">None blocked.</span>';
      $$('#h17Scn button', root).forEach(b => { b.setAttribute('aria-pressed', String(b.dataset.v === st.scn)); b.disabled = b.dataset.v !== 'live' && !F0; });
      $('#h17Bench', root).checked = st.bench;
    }
