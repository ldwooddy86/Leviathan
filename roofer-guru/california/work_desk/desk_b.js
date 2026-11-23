registerModule({
  key: 'desk', num: '08', title: 'Campaign Desk', desc: 'Budgets, ZIP targets, keywords, ads with the CSLB license number built in, and bulk files for six ad platforms',
  mount(root) {
    const PRE = (typeof ACCT !== 'undefined' && ACCT.PREFIX) || 'CA_';
    const EV = deskEvents(); const EVI = {}; EV.forEach(e => EVI[e.id] = e);
    const hasCol = c => ZC.includes(c);
    const popAll = sum(ZR.map(z => z.pop || 0)) || 1;
    /* the languages this build's data can speak to, with the statewide share and the default threshold derived from it */
    const LANGS = DESK_LANGS.map(L => { const col = hasCol(L.lep) ? L.lep : hasCol(L.sh) ? L.sh : null; if (!col) return null; const basis = col === L.lep ? 'lep' : 'home'; const state = sum(ZR.map(z => (z.pop || 0) * (z[col] || 0))) / popAll; const floor = basis === 'lep' ? DESK_LANG_FLOOR : DESK_LANG_FLOOR * 2; return Object.assign({}, L, { col, basis, state, def: Math.max(floor, Math.round(DESK_LANG_MULT * state)) }); }).filter(Boolean);
    const LANGI = {}; LANGS.forEach(L => LANGI[L.k] = L);
    const REGS = REG_KEYS.map(k => [String(k), REGN[k]]);
    const regOf = z => z.reg != null ? z.reg : (PA[z.pi] || {}).reg;
    /* markets a budget can carry: one for every $500 a month, so the mean market gets a daily budget a platform can learn on; never more than the scored ZIPs */
    const nDefault = b => clamp(Math.round((+b || 0) / 500), 5, ZR.length);
    const blend0 = () => { const a = DESK_BLEND0.filter(k => PLI[k]); return a.length > 1 ? a : PL.slice(0, 5).map(l => l.key); };
    const defaults = () => { const budget = +SLM.A.budget || +SLM.DEF.budget || 15000; return { line: 'replace', lines: blend0(), budget, start: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10), weeks: 13, scope: 'top', counties: [], regions: [], picks: [], n: nDefault(budget), minpop: 2000, alpha: 1.2, langTh: {}, storm: '', event: '', url: '', mix: { ...(MIX0.replace) }, asm: JSON.parse(JSON.stringify(ASM0)) }; };
    let P = Object.assign(defaults(), store.get(DESK_KEY, {}) || {});
    function tidy() {
      if (!PLI[P.line] && P.line !== 'blend') P.line = PLI.replace ? 'replace' : PL[0].key;
      P.lines = (P.lines || []).filter(k => PLI[k]); if (!P.lines.length) P.lines = blend0();
      P.asm = Object.assign(JSON.parse(JSON.stringify(ASM0)), P.asm || {}); P.mix = Object.assign({ ...(MIX0[P.line] || MIX0.blend) }, P.mix || {});
      P.counties = Array.isArray(P.counties) ? P.counties : []; P.regions = Array.isArray(P.regions) ? P.regions.map(String) : []; P.picks = Array.isArray(P.picks) ? P.picks : [];
      P.langTh = P.langTh && typeof P.langTh === 'object' ? P.langTh : {}; P.n = clamp(Math.round(+P.n || nDefault(P.budget)), 1, ZR.length);
    }
    tidy();
    const save = () => store.set(DESK_KEY, P);
    const UI = { plat: 'google', grp: null, lang: 'en', tab: 'markets' };
    const L = () => P.line === 'blend' ? null : PLI[P.line];
    const lineKeys = () => (P.line === 'blend' ? P.lines : [P.line]).filter(k => PLI[k] && SLM.A.lines[k]);
    /* inside this module P is the plan, so the percent formatter has its own name */
    const pct = (v, d = 1) => isN(v) ? (+v).toFixed(d) + '%' : '—';
    const cap1d = s => String(s).charAt(0).toUpperCase() + String(s).slice(1);
    const socOf = k => SOC[k] || (PLI[k] ? PLI[k].name.toLowerCase() : k);
    /* ---------- language rule ---------- */
    const langTh = k => { const v = P.langTh[k]; return v !== '' && v != null && isN(v) ? +v : LANGI[k].def; };
    const langNeed = (z, k) => +z[LANGI[k].col] || 0;
    const langOk = (z, k) => { const v = langNeed(z, k); return v >= langTh(k) && v / 100 * (z.pop || 0) >= DESK_LANG_MIN; };
    const langsOf = z => LANGS.filter(Lg => langOk(z, Lg.k)).map(Lg => Lg.k);
    /* the share of the budget a built language gets: the allocation weighted share of residents in its markets who need it, kept between 5 and 40 percent */
    const langShare = (M, k) => { const ms = M.filter(m => m.langs.includes(k)); if (!ms.length) return 0; return clamp(sum(ms.map(m => m.share * langNeed(m.z, k) / 100)), 0.05, 0.40); };
    /* ---------- tier and bid for the plan's own lines (the stored tier and bid are for all thirteen lines at default assumptions) ---------- */
    let TIERS = {}, tiersKey = '';
    function planTiers() {
      const keys = lineKeys(); const k = keys.join(',') + '|' + JSON.stringify(SLM.A.lines) + '|' + SLM.A.fee; if (k === tiersKey) return; tiersKey = k; TIERS = {};
      if (typeof LINE_TIER !== 'function' || typeof TIER_BID === 'undefined') return;
      const R = ZR.map(z => ({ zip: z.zip, eff: SLM.zipAll(z, keys).fees / Math.max(0.3, z.cpc_rel || 1) })); const v = R.map(x => x.eff).sort((a, b) => a - b); const n = v.length;
      R.forEach(x => { let lo = 0, hi = n; while (lo < hi) { const m = (lo + hi) >> 1; if (v[m] < x.eff) lo = m + 1; else hi = m; } const pct = n ? lo / n * 100 : 0; const t = LINE_TIER(pct); TIERS[x.zip] = { tier: t, bid: TIER_BID[t], pct }; });
    }
    const tierOf = z => (TIERS[z.zip] || {}).tier || z.tier || '';
    const bidOf = z => (P.bids && isN(P.bids[z.zip])) ? +P.bids[z.zip] : TIERS[z.zip] ? TIERS[z.zip].bid : (z.bid || 0);
    /* ---------- event ad group ---------- */
    const evSel = () => {
      if (P.storm && EVI[P.storm]) { const e = EVI[P.storm]; return { id: e.id, name: e.name, year: e.year, kind: e.kind, label: e.name + (e.year && !String(e.name).includes(String(e.year)) ? ' ' + e.year : ''), named: true }; }
      if (P.event) { const m = /^kind:(\w+)$/.exec(P.event); const kind = m && DESK_EV[m[1]] ? m[1] : deskEvKind(P.event); return { id: 'event', name: '', year: null, kind, label: m ? DESK_EV[kind].label : String(P.event), named: false }; }
      return null;
    };
    const evLine = e => { const k = DESK_EV[e.kind].line; return PLI[k] ? k : PLI.storm ? 'storm' : PL[0].key; };
    const fireName = e => String(e.name || '').replace(/\s+fire$/i, '').trim();
    root.innerHTML = mastHTML({ eyebrow: 'Module 08 · Campaign Desk', title: 'Campaign Desk', dek: 'The atlas\'s ZIPs turned into media buys for a California roofing company: a budget allocated by ZIP and platform and paced to each line\'s season, targeting lists with each platform\'s identifiers and bid modifiers computed for the plan\'s own lines, keyword and negative sets, ads written to every platform\'s limits with the company name, the CSLB license number and an office city built in, event ad groups for heavy rain, high wind, wildfire rebuilding and mountain snow, Spanish where the ZIPs need it and plain advice for Chinese, Vietnamese, Tagalog and Korean, and a bulk file or build sheet for every ads manager.',
      meta: [`<b>${N(ZR.length)}</b> ZIPs available as markets`, `<b>${N(Z.filter(z => z.gid).length)}</b> with Google criterion IDs`, `<b>6</b> platforms · <b>${PL.length}</b> service lines · English and Spanish`, '<b>No keyword volumes pulled</b>'],
      bar: 'Campaign Desk', barsub: 'Plan, build, export', actions: [['dkPlanX', '↓ Plan'], ['dkG', '↓ Google'], ['dkL', '↓ LSA'], ['dkDg', '↓ YouTube'], ['dkM', '↓ Meta'], ['dkMs', '↓ Microsoft'], ['dkT', '↓ TikTok'], ['dkCr', '↓ Creative'], ['dkKw', '↓ Keywords'], ['dkSave', '⤓ Save'], ['dkLoad', '⤒ Load']].map(([id, label]) => ({ id, label })) }) +
      `<div class="wrap">
      ${callout('', 'Read this first: what the desk does and does not do', `Choose a service line (or a blend), a budget and a market scope. The desk picks ZIPs from the paid model, splits the money across Google Search, Local Services Ads, YouTube and Demand Gen, Meta, Microsoft and TikTok, paces it to the line's season, forecasts clicks, leads and sold jobs from assumptions you can edit, and writes what each platform expects: location targets with bid modifiers, keywords with match types and negatives, responsive search ads with the city filled in, social and video copy, and build sheets. Every ad set carries the company name, the CSLB license number and an office city, because California requires the license number in all forms of advertising (Business and Professions Code 7030.5). Nothing offers to waive or absorb a deductible (Penal Code 551), promises to negotiate a claim (Insurance Code 15006, 15007) or promises an insurance discount; copy has no hyphens or dashes. It connects to no platform, pulls no keyword volumes and spends no Ahrefs units. Exports set every object to paused. Fill the Company panel (top right) first: the desk refuses to invent a license number.`)}
      <div id="dkFirmWarn"></div>
      <div class="card mt"><div class="card-h"><h3>The plan</h3><p>Change anything; the desk rebuilds. Stored in this browser.</p></div><div class="card-b"><div class="plan">
        <div class="f"><label class="fl" for="dkLine">Service line</label><select id="dkLine"><option value="blend">Blend of lines</option>${PL.map(l => `<option value="${l.key}">${esc(l.name)}</option>`).join('')}</select></div>
        <div class="f" id="dkBlendF"><label class="fl">Lines in the blend</label><div class="chips" id="dkBlend">${PL.map(l => `<button type="button" class="chip" data-k="${l.key}">${esc(l.short)}</button>`).join('')}</div></div>
        <div class="f"><label class="fl" for="dkBud">Monthly budget ($)</label><input type="number" id="dkBud" min="500" step="500"><span class="hint">Media only.</span></div>
        <div class="f"><label class="fl" for="dkStart">Flight start · weeks</label><div style="display:flex;gap:6px"><input type="date" id="dkStart"><input type="number" id="dkWeeks" min="2" max="52" style="width:70px"></div></div>
        <div class="f"><label class="fl" for="dkScope">Market scope</label><select id="dkScope"><option value="top">Top ZIPs by efficiency, statewide</option><option value="region">Top ZIPs in selected regions</option><option value="county">Top ZIPs in selected counties</option><option value="picks">Hand picked ZIPs</option></select><span class="hint">California is several markets. A crew rarely serves more than one or two regions.</span></div>
        <div class="f"><label class="fl" for="dkRegs">Regions (for region scope)</label><select id="dkRegs" multiple size="4">${REGS.map(([k, n]) => `<option value="${esc(k)}">${esc(n)}</option>`).join('')}</select></div>
        <div class="f"><label class="fl" for="dkPars">Counties (for county scope)</label><select id="dkPars" multiple size="4">${PA.slice().sort((a, b) => a.name.localeCompare(b.name)).map(p => `<option value="${p.fips}">${esc(p.name)}</option>`).join('')}</select></div>
        <div class="f"><label class="fl" for="dkPicks">Hand picked ZIPs</label><input type="text" id="dkPicks" placeholder="${esc(ZR.slice(0, 3).map(z => z.zip).join(', '))}"><span class="hint">Other modules send ZIPs here.</span></div>
        <div class="f"><label class="fl" for="dkN">ZIPs to buy · minimum residents</label><div style="display:flex;gap:6px"><input type="number" id="dkN" min="1" max="${ZR.length}" style="width:80px"><select id="dkMin"><option value="0">any</option><option value="1000">1,000+</option><option value="2000">2,000+</option><option value="5000">5,000+</option><option value="10000">10,000+</option></select></div><span class="hint">Up to the ${N(ZR.length)} scored ZIPs. A new plan starts at one market for every $500 of monthly budget.</span></div>
        <div class="f"><label class="fl" for="dkAlpha">Concentration α <span id="dkAlphaV"></span></label><input type="range" id="dkAlpha" min="0.5" max="2.5" step="0.1"><span class="hint">1 spends in proportion to the profit pool; 2 concentrates on the best ZIPs.</span></div>
        <div class="f"><label class="fl" for="dkUrl">Landing URL base</label><input type="url" id="dkUrl" placeholder="https://www.yourroofingco.com"><span class="hint">Defaults to the Company panel website.</span></div>
        <div class="f"><label class="fl" for="dkCor">Event ad group (optional)</label><select id="dkCor"><option value="">None</option>${Object.entries(DESK_EV).map(([k, v]) => `<option value="kind:${k}">${esc(v.label)}</option>`).join('')}${EV.length ? `<optgroup label="Events on record">${EV.slice(0, 120).map(e => `<option value="${esc(e.id)}">${esc(e.name)}${e.year && !String(e.name).includes(String(e.year)) ? ' ' + e.year : ''} · ${esc(DESK_EV[e.kind].label.split(' (')[0].toLowerCase())}</option>`).join('')}</optgroup>` : ''}</select><span class="hint">Adds event keywords and headlines for rain, wind, wildfire rebuilding or snow.</span></div>
      </div>
      <div class="dsec" style="margin-top:16px">Platform mix (% of budget)</div><div class="mix" id="dkMix"></div><div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn sec sm" id="dkMixReset">Reset mix to line default</button></div>
      <div class="dsec" style="margin-top:16px">Platform assumptions (editable)</div><div class="xscroll" id="dkAsm"></div></div></div>
      <div class="kpis" id="dkKpis"></div>
      <div class="grid2">
        <div class="card mapcard"><div class="card-h"><h3>Markets in the buy</h3><p>Shaded by monthly allocation. Click a ZIP to add or drop it (switches scope to hand picked).</p></div><div id="dkMap"></div><div class="legend" id="dkLeg"></div></div>
        <div class="card"><div class="card-h"><h3>Plan summary</h3></div><div class="card-b"><div class="ptabs" id="dkTabs"><button data-v="markets" aria-pressed="true">Markets</button><button data-v="platforms" aria-pressed="false">Platforms</button><button data-v="flight" aria-pressed="false">Flight and pacing</button><button data-v="objects" aria-pressed="false">Campaign objects</button></div><div id="dkTab"></div></div></div>
      </div>
      ${card('Languages in this buy', 'Which markets need a language other than English, by a rule that looks at need, not at who speaks what at home.', '<div id="dkLangs"></div>', 'mt')}
      <div class="card mt"><div class="card-h"><h3>Platform builders: what will be created, and the file that creates it</h3><p>Structure, targeting, creative for the selected ad group with character counts and Satchel lint, and the rules that bind this buy.</p></div><div class="card-b"><div class="ptabs" id="dkPTabs">${PLATS.map((p, i) => `<button data-v="${p}" aria-pressed="${i === 0}">${PLAB[p]}</button>`).join('')}</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px"><div class="ctl"><label class="fl" for="dkAng">Ad group</label><select id="dkAng"></select></div><div class="ctl"><span class="fl">Language</span><div class="seg" id="dkLang"><button data-v="en" aria-pressed="true">English</button><button data-v="es" aria-pressed="false">Spanish</button></div></div><div class="ctl"><label class="fl" for="dkPrev">Preview market</label><select id="dkPrev"></select></div></div><div id="dkBuild"></div></div></div>
      <div class="split">
        ${card('Keyword desk: Google Search and Microsoft', 'Line keywords with match types, question terms and the city variants the export writes for each market city. Price the set in Keyword Planner inside the account; nothing here was priced by a keyword tool.', '<div class="ctl" style="margin-bottom:8px"><select id="dkKwA"></select></div><div id="dkKwOut"></div>')}
        ${card('Measurement, naming and operating rules', 'Conversion actions, naming and UTM scheme, and the pacing and kill rules derived from the assumptions.', '<div id="dkMeas"></div>')}
      </div>
      ${card('Compliance: the rules behind the lint', 'What binds this buy. ✔ primary text read this build; ◐ secondary or platform policy, verify before launch.', '<div id="dkComp"></div>', 'mt')}
      <div class="split">
        ${card('How the desk is built', '', '<ol class="meth" id="dkHow"></ol>')}
        ${card('Judgment calls', 'Places where the desk had to choose.', '<div id="dkJudg"></div>')}
      </div>
      <div class="foot">California Roofer Guru, module 08. Media plans are cold start priors built from public data and stated assumptions. Replace every assumption with account data after the first thirty to sixty days. Compiled ${esc(dateL(META.compiled || '2026-11-19'))}.</div></div>`;
    // ---------- model ----------
    function markets() {
      let pool = ZR.filter(z => z.pop >= P.minpop);
      if (P.scope === 'county' && P.counties.length) pool = pool.filter(z => P.counties.includes(z.fips));
      if (P.scope === 'region' && P.regions.length) pool = pool.filter(z => P.regions.includes(String(regOf(z))));
      const keys = lineKeys(); const val = z => SLM.zipAll(z, keys).fees; const eff = z => val(z) / Math.max(0.3, z.cpc_rel || 1);
      if (P.scope === 'picks') { const s = new Set(P.picks); pool = ZR.filter(z => s.has(z.zip)); }
      else pool = pool.sort((a, b) => eff(b) - eff(a)).slice(0, P.n);
      const w = pool.map(z => Math.pow(Math.max(1, eff(z)), P.alpha)); const ws = sum(w) || 1;
      return pool.map((z, i) => { const langs = langsOf(z); return { z, share: w[i] / ws, spend: P.budget * w[i] / ws, langs, es: langs.includes('es'), fees: val(z) }; });
    }
    const lineMix = () => { const keys = lineKeys(); const f = keys.map(k => sum(MKT.map(m => SLM.zipLine(m.z, k).fees))); const tot = sum(f); return keys.map((k, i) => ({ k, w: tot > 0 ? f[i] / tot : 1 / Math.max(1, keys.length) })); };
    function forecast(M) {
      const out = {}; const mixL = lineMix(); const close = sum(mixL.map(o => o.w * SLM.A.lines[o.k].close)) / 100; const cpcMul = sum(mixL.map(o => o.w * SLM.A.lines[o.k].cpcMul)) || 1; const val = sum(mixL.map(o => o.w * SLM.A.lines[o.k].val * SLM.A.fee)); const cpcK = (+SLM.A.cpc || SLM.DEF.cpc) / SLM.DEF.cpc; const cvrK = sum(mixL.map(o => o.w * SLM.A.lines[o.k].cvr)) / (sum(mixL.map(o => o.w * SLM.DEF.lines[o.k].cvr)) || 1) || 1; const obsCpl = q => { let w = 0, v = 0; mixL.forEach(o => { const x = SLM.A.lines[o.k][q]; if (isN(x) && x > 0) { w += o.w; v += o.w * x; } }); return w ? v / w : null; };
      PLATS.forEach(p => { const A = P.asm[p]; const spend = P.budget * (P.mix[p] || 0) / Math.max(1, sum(PLATS.map(q => P.mix[q] || 0))); if (!spend) { out[p] = { spend: 0, clicks: 0, leads: 0, cases: 0, fees: 0 }; return; }
        const cm = sum(M.map(m => m.share * (m.z.cpc_rel || 1))) || 1; let clicks = 0, leads = 0;
        if (A.basis === 'CPC') { const own = ASM0[p] || {}; clicks = spend / (A.cost * (+A.cost === own.cost ? cpcK : 1) * cpcMul * cm); leads = clicks * A.cvr * (+A.cvr === own.cvr ? cvrK : 1) / 100; }
        else if (A.basis === 'CPM') { const imp = spend / A.cost * 1000; clicks = imp * A.ctr / 100; const oc = p === 'meta' && +A.cost === ASM0.meta.cost && +A.ctr === ASM0.meta.ctr && +A.cvr === ASM0.meta.cvr ? obsCpl('metaCpl') : null; leads = oc ? spend / oc : clicks * A.cvr / 100; }
        else { leads = spend / ((p === 'lsa' && +A.cost === ASM0.lsa.cost && obsCpl('lsaCpl')) || A.cost); clicks = leads; }
        const cl = p === 'lsa' ? close : p === 'meta' || p === 'tiktok' ? close * 0.5 : p === 'dg' ? close * 0.6 : close;
        out[p] = { spend, clicks, leads, cases: leads * cl, fees: leads * cl * val }; });
      return out;
    }
    const firm = () => ({ name: brandSet() ? (BRAND.short || BRAND.name) : '', lic: String(BRAND.lic || '').replace(/^#/, '').trim(), office: brandOffices()[0] || '', phone: BRAND.phone || '', fin: BRAND.financing || '', warranty: BRAND.warranty || '', url: (P.url || BRAND.url || '').replace(/\/$/, '') });
    /* a line is commercial when its segment says so; the service line table writes 'com', older tables wrote 'comm': both are read */
    const isComSeg = s => s === 'com' || s === 'comm';
    const resPlan = () => lineKeys().some(k => !isComSeg((PLI[k] || {}).seg));
    const fit = (t, n) => { t = houseClean(t); return t && t.length <= n ? t : null; };
    const titleCase = t => String(t).replace(/\b([a-z])([a-z]*)/g, (m, a, b) => /^(and|or|of|the|to|in|on|a)$/.test(a + b) ? m : a.toUpperCase() + b);
    const ctxFor = z => ({ city: (z && z.city) || BRAND.city || 'California', county: (z && z.cty) || '' });
    /* the desk fills {County} itself, so its copy does not depend on which tokens the shared filler knows */
    const fill = (t, ctx) => fillCopy(String(t).replace(/\{County\}/g, ctx.county || ''), ctx);
    /* ad groups: one per angle for a single line, one per line for a blend, plus an optional event group */
    function groups() {
      const out = []; const keys = lineKeys();
      if (P.line === 'blend') keys.forEach(k => { const l = PLI[k]; out.push({ id: k, label: l.name, line: k, angles: l.angles || [] }); });
      else if (L()) ((L().angles || []).filter(a => a.lang !== 'es').length ? (L().angles || []).filter(a => a.lang !== 'es') : [{ id: 'core', h: titleCase(socOf(L().key)), d: '' }]).forEach(a => out.push({ id: L().key + ':' + a.id, label: L().short + ' · ' + titleCase(a.id), line: L().key, angles: [a] }));
      const e = evSel(); if (e) out.push({ id: e.named ? 'storm' : 'event', label: 'Event · ' + e.label, line: evLine(e), angles: [], ev: e });
      return out;
    }
    /* The license line. Business and Professions Code 7030.5: the license number goes in all forms of advertising. */
    const licLine = (lic, es) => es ? `Licencia CSLB #${lic}` : `CSLB License #${lic}`;
    function reqLines(lang) { const F = firm(); const es = lang === 'es'; const out = [];
      if (F.lic && F.office) out.push(es ? `${licLine(F.lic, 1)}. Oficina en ${F.office}.` : `${licLine(F.lic)}. Office in ${F.office}.`);
      else if (F.lic) out.push(licLine(F.lic, es) + '.');
      else if (F.office) out.push(es ? `Oficina en ${F.office}.` : `Local office in ${F.office}.`);
      return out; }
    function rsaFor(g, z, lang) {
      const ctx = ctxFor(z); const F = firm(); const es = lang === 'es'; const l = PLI[g.line];
      const unset = t => (/\{Lic\}/.test(t) && !F.lic) || (/\{Office\}/.test(t) && !F.office) || (/\{(Company|Firm)\}/.test(t) && !F.name) || (/\{Phone\}/.test(t) && !F.phone) || (/\{County\}/.test(t) && !ctx.county);
      const hs = [], seen = new Set(); const addH = t => { if (!t || unset(t)) return; const x = fit(fill(t, ctx), 30); if (x && !seen.has(x.toLowerCase()) && hs.length < 15) { seen.add(x.toLowerCase()); hs.push(x); } };
      const angs = g.angles.length ? g.angles : (l ? (l.angles || []).filter(a => a.lang !== 'es').slice(0, 1) : []);
      const esAngs = l ? (l.angles || []).filter(a => a.lang === 'es') : [];
      if (g.ev && !es) { const T = DESK_EV[g.ev.kind]; const nm = g.ev.kind === 'fire' && g.ev.named ? fireName(g.ev) : ''; T.h.forEach(h => { if (/\{Name\}/.test(h)) { if (nm) addH(h.replace('{Name}', nm)); } else addH(h); }); }
      if (es) { esAngs.forEach(a => addH(a.h)); (DESK_H_ES[g.line] || []).forEach(addH); addH('Techos en {City}'); addH('Hablamos Español'); addH('Oficina en {Office}'); addH('Reparación de Techos'); addH('Llame o Escriba Hoy'); if (F.lic) addH('Techador con Licencia CSLB'); addH('Presupuesto por Escrito'); }
      else { angs.forEach(a => addH(a.h)); (DESK_H[g.line] || []).forEach(addH); const nm = titleCase(socOf(g.line)); addH(`${nm} {City}`); addH(`${nm} in {City}`); addH('Roofing Company in {City}'); addH('California Roofing Company'); if (F.lic) addH('CSLB Licensed Roofer'); addH('Itemized Written Estimates'); addH('Permits Pulled Where Required'); addH('Office in {Office}'); if (F.name) addH(F.name); addH('Call or Message Us Today'); if (F.fin) addH('Financing Available'); addH('Roofing in {County} County'); addH('Serving {County} County'); }
      const ds = []; const addD = t => { if (!t || unset(t)) return; const x = fit(fill(t, ctx), 90); if (x && !ds.includes(x) && ds.length < 4) ds.push(x); };
      reqLines(lang).forEach(addD);
      if (g.ev && !es) { if (g.ev.kind === 'fire' && g.ev.named) addD(`After the ${fireName(g.ev)} Fire: Class A rebuild roofs by a licensed roofer with a local office.`); addD(DESK_EV[g.ev.kind].d); }
      (es ? esAngs : angs).forEach(a => addD(a.d));
      addD(es ? 'Techador con licencia en California. Inspección, presupuesto detallado y permisos.' : `${cap1d(socOf(g.line))} by a licensed California roofer. Itemized estimates.`);
      addD(es ? 'Llame o escriba hoy. Hablamos español y damos el presupuesto por escrito.' : 'Roof inspections, written estimates and permits pulled where the city requires them.');
      return { h: hs, d: ds };
    }
    const lint = (txt, extra) => satchelLint(txt, satCtx(Object.assign({ asset: true, res: resPlan() }, extra || {})));
    const lintSet = (texts, plat) => { const all = texts.join(' \n '); const f = lint(all, { platform: plat }); texts.forEach(t => satchelLint(t, { headline: true }).forEach(x => { if (x.rule.id === 'GADS1') f.push(x); })); return f; };
    /* social copy speaks about the service and the place, never about the reader's finances, insurance or hardship (Meta personal attributes policy) */
    function lsaBio(z) { const F = firm(); const ctx = ctxFor(z); return houseClean(fill(`${F.name || 'Our company'} replaces and repairs roofs across ${ctx.county ? '{County} County and ' : ''}California: ${lineKeys().map(k => socOf(k)).slice(0, 3).join(', ')}. Licensed by the Contractors State License Board${F.lic ? ' (' + licLine(F.lic) + ')' : ''}, with an office in ${F.office || 'California'}. Permits are pulled where the city or county requires them.`, ctx)); }
    function socialFor(g, z, lang, p) {
      const ctx = ctxFor(z); const l = PLI[g.line]; const es = lang === 'es'; const la = (l && l.angles) || []; const a = es ? (la.find(x => x.lang === 'es') || la[0]) : (g.angles[0] || la[0]);
      const req = reqLines(lang).join(' '); const nm = cap1d(socOf(g.line)); const e = g.ev;
      const evLead = e ? ({ rain: 'Roof leak repair near {City} after the rain. A licensed California roofer finds the source, tarps what is open and writes an itemized estimate.', wind: 'Wind damage roof repair near {City}. A licensed California roofer photographs the damage, tarps what is open and writes an itemized estimate.', fire: `Rebuild and fire damage roofing near {City}${e.named ? ' after the ' + fireName(e) + ' Fire' : ''}. A licensed California roofer builds Class A roofs to the wildfire code and writes an itemized estimate.`, snow: 'Snow and ice damage roof repair near {City}. A licensed California roofer inspects the roof and framing and writes an itemized estimate.' })[e.kind] : '';
      const lead = es ? 'Techador con licencia para {City} y toda California. Hablamos español. Inspección del techo, presupuesto detallado por escrito y permisos donde la ciudad los exige.' : e ? evLead : `${nm} for {City} from a licensed California roofer. ${SOCX[g.line] || 'Roof inspections, itemized written estimates and permits where the city requires them.'}`;
      const body = houseClean(fill(lead, ctx) + ' ' + req);
      const title = fit(fill(es ? 'Techos en {City}' : e ? `${titleCase(DESK_EV[e.kind].slug)} in {City}` : `${nm} in {City}`, ctx), p === 'meta' ? 40 : 60) || (a && fit(fill(a.h, ctx), 40)) || (l ? l.short : nm);
      return { body, title, desc: fit(es ? 'Hablamos español' : 'Licensed California roofer', 30) };
    }
