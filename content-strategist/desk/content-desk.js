/* ==== leviathan content strategist ==== */
/* The Content Strategist: a module of its own in a Thermal Debt atlas, put there by the content strategist's toolkit
   (content-strategist/cli.mjs desk, through dashboard-link's panel block). It is the content plan with a page around it:
   what to write, for which city and which service, the keyword for each piece, the competition around it, and the pages
   the agent has built so far.

   The plan is worked out by the toolkit from everything the dashboard holds (lib/strategy.mjs): the heatmaps and city
   records, the Service Lines model (jobs, gross profit, season, priority and pressure by ZIP and line), Competitor
   Watch, the click costs behind Paid Acquisition, the keyword library, and the client's own sitemap. It rides in this
   file as data (#lvc-data). This script draws it, lets a person filter it, read a city, find the keyword for a piece,
   look at who they are up against, and put chosen works into an order for the agent. Built pages go to Publish through
   Publish's own import box, as drafts. It publishes nothing itself.

   Plain script in the dashboard's own style, using the dashboard's own helpers (registerModule, mastHTML, callout,
   kpiHTML, esc, store, toast, saveFile). Every string that came from the data is escaped before it reaches the page. If
   the dashboard has no module system, or the data is not there, it does nothing at all. */
(function () {
  "use strict";
  if (typeof registerModule !== 'function' || typeof MODS === 'undefined' || typeof MODI === 'undefined' || MODI.strategist) return;
  let S = null; try { const n = document.getElementById('lvc-data'); S = n ? JSON.parse(n.textContent) : null; } catch (e) { S = null; }
  if (!S || S.format !== 'leviathan.content-strategy' || !Array.isArray(S.works)) return;
  const KEY = 'strategist', STORE = 'lv.strategist.v1', NUM = String(Math.max(0, ...MODS.map(m => +m.num || 0)) + 1).padStart(2, '0');
  const arr = v => (Array.isArray(v) ? v : []), obj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
  const q = (s, r) => (r || document).querySelector(s), qa = (s, r) => [...(r || document).querySelectorAll(s)];
  const say = msg => { try { if (typeof toast === 'function') toast(msg); } catch (e) { /* no toast in this build */ } };
  const LINE = Object.fromEntries(arr(S.lines).map(l => [l.id, l])), ANGLE = Object.fromEntries(arr(S.angles).map(a => [a.id, a])), NEED = Object.fromEntries(arr(S.needs).map(n => [n.id, n]));
  const CITY = Object.fromEntries(arr(S.cities).map(c => [c.name, c])), COMP = Object.fromEntries(arr(S.competitors).map(c => [c.i, c])), WORK = Object.fromEntries(S.works.map(w => [w.id, w]));
  const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'], mon = m => (m ? MONTH[(m - 1 + 12) % 12] : '');
  const TYPE = { city: 'City page', 'service-city': 'Service page for a city', service: 'Service page', post: 'Post' };
  const STATUS = { gap: 'Nothing on the site', hub: 'A section of the city page', page: 'A page holds it', built: 'Built, not yet live' }, SHORT = { gap: 'Open', hub: 'Section only', page: 'Has a page', built: 'Built' }, STCLS = { gap: 'lvc-gap', hub: 'st-configured', page: 'st-connected', built: 'lvc-built' };
  const money = v => (v == null ? '—' : v >= 1e9 ? '$' + (Math.round(v / 1e8) / 10) + 'B' : v >= 1e6 ? '$' + (Math.round(v / 1e5) / 10) + 'M' : v >= 1e3 ? '$' + Math.round(v / 1e3) + 'k' : '$' + Math.round(v));
  const count = v => (v == null ? '—' : v >= 1e4 ? Math.round(v / 1e3) + 'k' : v >= 1000 ? (Math.round(v / 100) / 10) + 'k' : String(Math.round(v)));
  const pushes = (x, keys) => (x && x.intel ? keys.map(k => x.intel[k]).filter(v => v && !/^[-–—\s·]*$/.test(String(v))) : []);
  const pathOf = u => { try { return u ? new URL(u).pathname : ''; } catch (e) { return String(u || ''); } };
  const title = w => { const l = LINE[w.l]; return w.t === 'city' ? 'City page: ' + w.c : w.t === 'service-city' ? (l ? l.name : w.a) + ' in ' + w.c : w.t === 'service' ? (l ? l.name : w.a) : 'Post: ' + w.kw; };
  const stPill = w => `<span class="pill ${STCLS[w.st] || ''}" title="${esc(STATUS[w.st] + (w.u ? ': ' + pathOf(w.u) : ''))}">${esc(SHORT[w.st] || w.st)}</span>`;
  const pill = (text, cls, tip) => `<span class="pill ${cls || ''}"${tip ? ` title="${esc(tip)}"` : ''}>${esc(text)}</span>`;
  const bar = (v, tip) => (v == null ? '—' : `<span class="lvc-bar" title="${esc(tip || '')}"><i style="width:${Math.max(0, Math.min(100, v))}%"></i></span><span class="lvc-n">${v}</span>`);
  const kept = obj(store.get(STORE, {}));
  const ST = { view: typeof kept.view === 'string' ? kept.view : 'plan', type: kept.type || '', line: kept.line || '', status: kept.status || '', served: kept.served !== false, find: '', city: CITY[kept.city] ? kept.city : '', sel: '', order: arr(kept.order).filter(id => WORK[id]), kind: kept.kind || 'service-city', angle: ANGLE[kept.angle] ? kept.angle : (S.angles[0] || {}).id, kcity: CITY[kept.kcity] ? kept.kcity : '', cline: kept.cline || '', ccity: CITY[kept.ccity] ? kept.ccity : '', sort: { k: 'sc', d: -1 }, more: 60 };
  const save = () => store.set(STORE, { view: ST.view, type: ST.type, line: ST.line, status: ST.status, served: ST.served, city: ST.city, order: ST.order.slice(0, 200), kind: ST.kind, angle: ST.angle, kcity: ST.kcity, cline: ST.cline, ccity: ST.ccity });
  const servedCities = arr(S.cities).filter(c => c.served).map(c => c.name), firstCity = () => ST.city || servedCities.slice().sort()[0] || (S.cities[0] || {}).name || '';

  /* why a work stands where it does */
  function why(w) {
    const l = LINE[w.l], c = CITY[w.c], out = [];
    if (w.jobs != null) out.push(`${w.t === 'city' ? 'The four services a city page covers' : l ? l.name : 'This service'} ${w.c ? 'in ' + w.c : 'across the market'}: about ${count(w.jobs)} jobs a year and ${money(w.gp)} in gross profit across every company, by the Service Lines model. That ranks above ${w.val}% of the works in this plan.`);
    else out.push(`${w.c} lies outside the mapped area, so the dashboard has no figures for it.`);
    if (w.pri != null) out.push(`The dashboard's own priority for it here is ${w.pri} of 100. Competitive pressure is ${w.prs} of 100${w.prs <= 40 ? ', a thin field' : w.prs >= 70 ? ', a crowded field' : ''}.`);
    if (w.cn != null) out.push(w.c ? `${w.cn} compan${w.cn === 1 ? 'y' : 'ies'} in reach of ${w.c} ${w.l ? 'sell this service' : 'work the city'}.` : `${w.cn} companies on the roster sell this service.`);
    if (l && l.peak) out.push(`${l.name} peaks in ${mon(l.peak)}, so the page should be live by ${mon(l.publishBy)}.`);
    if (l && l.offered === false) out.push('You do not list this service among your own. Confirm it before a page is written.');
    if (c && c.cpc && c.cpc >= 1.15) out.push(`A paid click here costs about ${Math.round(100 * (c.cpc - 1))}% more than across the market, so a page that ranks is worth more.`);
    out.push(w.st === 'gap' ? 'No live page holds this keyword.' : w.st === 'hub' ? 'Today it is only a section of the city page. A page of its own is a split, and that is your call.' : w.st === 'built' ? 'The agent has built it. It is not live yet.' : 'A live page already holds it, so this would be a rewrite, and it scores lower for that.');
    return out;
  }
  /* the keyword set for a piece of a given kind, service angle and city */
  function keywords(kind, angleId, city) {
    const a = ANGLE[angleId] || { kw: { core: [], city: [], questions: [], negatives: [] }, label: angleId }, C = city || '', fill = k => k.replace(/\{city\}/gi, C).toLowerCase().trim();
    const core = arr(a.kw.core), local = C ? arr(a.kw.city).map(fill) : [], qs = arr(a.kw.questions);
    let primary = '', support = [];
    if (kind === 'post') { primary = (qs[0] || core[0] || '').toLowerCase(); support = qs.slice(1, 5); }
    else if (kind === 'service') { primary = (core[0] || '').toLowerCase(); support = core.slice(1, 6); }
    else if (kind === 'city') { const hub = C && CITY[C] && arr(CITY[C].pages).some(p => p.angle === 'repair'); primary = C ? (hub ? 'hvac ' : 'ac repair ') + C.toLowerCase() : ''; support = ['repair', 'heatrepair', 'heatpump', 'furnace'].map(id => ANGLE[id]).filter(Boolean).flatMap(x => arr(x.kw.city).slice(0, 1).map(fill)).filter(k => k !== primary); }
    else { primary = local[0] || (core[0] ? (core[0] + ' ' + C).toLowerCase().trim() : ''); support = [...local.slice(1), ...core.slice(0, 4)]; }
    return { primary, support: [...new Set(support)].filter(k => k && k !== primary), questions: kind === 'post' ? [] : qs.slice(0, 5), negatives: [...arr(a.kw.negatives), ...arr(obj(S.negatives).NEG_CUSTOMER).slice(0, 12)] };
  }
  const workFor = (kind, angleId, city) => S.works.find(w => w.t === kind && (kind === 'city' ? w.c === city : kind === 'service-city' ? w.c === city && w.a === angleId : kind === 'service' ? w.a === angleId : false)) || null;

  /* a table that sorts on its headers; cols: [{k, h, l (left), f (cell html), v (value), t (tip)}] */
  function table(host, cols, rows, o) {
    o = o || {}; const st = host._st || (host._st = { k: o.sort || cols[0].k, d: o.dir || -1 }), val = (r, c) => (c.v ? c.v(r) : r[c.k]);
    const c0 = cols.find(c => c.k === st.k) || cols[0], sorted = rows.slice().sort((a, b) => { const x = val(a, c0), y = val(b, c0); if (typeof x === 'string' || typeof y === 'string') return st.d * String(x || '').localeCompare(String(y || '')); if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1; return st.d * (x - y); });
    const shown = o.limit ? sorted.slice(0, o.limit) : sorted;
    host.innerHTML = `<table class="lvc-t"><thead><tr>${cols.map(c => `<th class="${c.l ? 'l' : ''}${c.k ? ' sort' : ''}"${c.k ? ` data-k="${esc(c.k)}" tabindex="0" aria-sort="${st.k === c.k ? (st.d < 0 ? 'descending' : 'ascending') : 'none'}"` : ''} title="${esc(c.t || '')}">${esc(c.h)}${st.k === c.k ? (st.d < 0 ? ' ↓' : ' ↑') : ''}</th>`).join('')}</tr></thead><tbody>${shown.map(r => `<tr${o.id ? ` data-id="${esc(o.id(r))}"` : ''} class="${o.onRow ? 'click' : ''}${o.sel && o.sel(r) ? ' on' : ''}"${o.onRow ? ' tabindex="0"' : ''}>${cols.map(c => `<td class="${c.l ? 'l' : ''}">${c.f ? c.f(r) : esc(val(r, c) == null ? '—' : val(r, c))}</td>`).join('')}</tr>`).join('') || `<tr><td class="l" colspan="${cols.length}">${esc(o.empty || 'Nothing matches.')}</td></tr>`}</tbody></table>${o.limit && sorted.length > shown.length ? `<p class="mini lvc-more"><button type="button" class="lnk" data-more="1">Show ${Math.min(sorted.length - shown.length, 100)} more</button> of ${sorted.length - shown.length} below.</p>` : ''}`;
    qa('th.sort', host).forEach(th => { const go = () => { const k = th.dataset.k; st.d = st.k === k ? -st.d : ((cols.find(c => c.k === k) || {}).l ? 1 : -1); st.k = k; table(host, cols, rows, o); }; th.onclick = go; th.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } }; });
    if (o.onRow) qa('tbody tr[data-id]', host).forEach(tr => { tr.onclick = e => { if (e.target.closest('button,a,input')) return; o.onRow(tr.dataset.id); }; tr.onkeydown = e => { if (e.target === tr && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); o.onRow(tr.dataset.id); } }; });
    const m = q('[data-more]', host); if (m && o.onMore) m.onclick = o.onMore;
    if (o.after) o.after(host);
  }
  const options = (list, sel, all) => (all != null ? `<option value="">${esc(all)}</option>` : '') + list.map(([v, t]) => `<option value="${esc(v)}"${v === sel ? ' selected' : ''}>${esc(t)}</option>`).join('');
  const cityOptions = (sel, all) => { const names = arr(S.cities).map(c => c.name).sort((a, b) => a.localeCompare(b)), mine = names.filter(n => CITY[n].served), rest = names.filter(n => !CITY[n].served); return (all != null ? `<option value="">${esc(all)}</option>` : '') + `<optgroup label="Cities with a page on the site">${mine.map(n => `<option${n === sel ? ' selected' : ''}>${esc(n)}</option>`).join('')}</optgroup><optgroup label="Other cities in the atlas">${rest.map(n => `<option${n === sel ? ' selected' : ''}>${esc(n)}</option>`).join('')}</optgroup>`; };
  const lineOptions = (sel, all) => options(arr(S.lines).map(l => [l.id, l.name]), sel, all);

  /* ---------- the work order: what a person has chosen for the agent ---------- */
  const orderWorks = () => ST.order.map(id => WORK[id]).filter(Boolean);
  function orderText() {
    const W = orderWorks(); if (!W.length) return '';
    return ['Use the leviathan-content-strategist agent to write these pieces from the content plan. For each one: run `brief` for its city, check the keyword against the sitemap, write it for the homeowner, and build it through the gate. Hand the built pages back to the dashboard when they pass.', '',
      ...W.map((w, i) => `${i + 1}. ${TYPE[w.t]}: ${title(w)}\n   keyword: ${w.kw}${w.c ? '\n   city: ' + w.c : ''}${w.l && LINE[w.l] ? '\n   service line: ' + LINE[w.l].name + (LINE[w.l].publishBy ? ' (live by ' + mon(LINE[w.l].publishBy) + ')' : '') : ''}\n   on the site now: ${STATUS[w.st].toLowerCase()}${w.u ? ' (' + pathOf(w.u) + ')' : ''}${w.st === 'hub' ? '. Splitting it out changes what the city page targets: confirm with the client first.' : ''}`)].join('\n');
  }
  const orderFile = () => ({ format: 'leviathan.content-order', v: 1, made: new Date().toISOString(), client: obj(S.client).short || '', atlas: obj(S.atlas).name || '', works: orderWorks().map(w => ({ id: w.id, type: w.t, title: title(w), keyword: w.kw, city: w.c || '', line: w.l || '', angle: w.a || '', status: w.st, url: w.u || '', liveBy: LINE[w.l] && LINE[w.l].publishBy ? mon(LINE[w.l].publishBy) : '' })) });

  /* ---------- the Publish door: built pages go in through Publish's own import box, as drafts ---------- */
  const blueprints = () => { try { const n = document.getElementById('lvp-data'), d = n ? JSON.parse(n.textContent) : null, b = arr(d && d.bundles).filter(x => x && x.content && Array.isArray(x.content.pages)).sort((x, y) => String(y.made).localeCompare(String(x.made)))[0]; return b ? b.content.pages.filter(p => p && p.page && typeof p.page.slug === 'string' && Array.isArray(p.sections)) : []; } catch (e) { return []; } };
  const wait = (test, ms) => new Promise(done => { const t0 = Date.now(); (function tick() { let ok = false; try { ok = !!test(); } catch (e) { ok = false; } if (ok || Date.now() - t0 > ms) done(ok); else setTimeout(tick, 80); })(); });
  async function toPublish(pages) {
    const m = MODI.publish; if (!m) return { ok: false, why: 'This build has no Publish module.' };
    try { if (!m.mounted) { m.mounted = true; m.mount(q('#mod-publish')); } } catch (e) { return { ok: false, why: 'Publish failed to open.' }; }
    const root = q('#mod-publish'), input = q('#p16iFile', root), log = q('#p16iLog', root); if (!input) return { ok: false, why: 'This build has no Publish import box.' };
    const before = log ? log.textContent : '';
    try { const dt = new DataTransfer(); dt.items.add(new File([JSON.stringify({ pages })], 'pages-from-the-content-strategist.json', { type: 'application/json' })); input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) { return { ok: false, why: 'This browser would not hand the pages to Publish.' }; }
    await wait(() => log && log.textContent !== before, 8000);
    const first = ((log && log.textContent) || '').split('\n')[0] || '', listed = typeof m.pages === 'function' ? arr(m.pages()).length : null;
    return { ok: /:\s*\d+ pages? \(/.test(first), why: first.replace(/^\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?\s*/i, ''), listed };
  }

  registerModule({
    key: KEY, num: NUM, title: 'Content Strategist', desc: 'What to write, for which city and service: the plan drawn from every tab, the keyword for each piece, the competition around it, and the pages built so far',
    /* for a check from outside: what the module holds and shows */
    state() { return { works: S.works.length, cities: S.cities.length, competitors: arr(S.competitors).length, built: arr(S.built).length, view: ST.view, order: ST.order.length, rows: qa('#lvcBody tbody tr').length }; },
    mount(root) {
      const R = S.reads || {}, gaps = S.works.filter(w => w.st === 'gap').length, made = new Date(S.made);
      root.innerHTML = mastHTML({ eyebrow: `Module ${NUM} · Content Strategist${obj(S.client).short ? ' · ' + esc(S.client.short) : ''}`, title: 'Content Strategist',
        dek: 'Every other tab says something about what is worth writing: where the systems are aging, which service pays and when it peaks, who is already there, where a click costs too much. This module puts them together into one plan, gives each piece its keyword, and keeps the pages the agent has built.',
        meta: [`<b>Plan</b> ${N(S.works.length)} works across ${N(S.cities.length)} cities`, `<b>Nothing on the site yet</b> ${N(gaps)}`, `<b>Competitors read</b> ${N(arr(S.competitors).length)}`, `<b>Site</b> ${N(obj(S.site).pages || 0)} live URLs`, `<b>Worked out</b> ${isNaN(made) ? '' : esc(made.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }))}`],
        bar: 'Content Strategist', barsub: 'The plan, the keywords, the competition and the pages · from every tab', actions: [{ id: 'lvcCsv', label: '↓ Plan CSV', title: 'The works in view, as a spreadsheet' }] })
        + `<div class="wrap lvc"><div class="seg lvc-tabs" role="tablist" aria-label="Content Strategist views">${[['plan', 'Plan'], ['city', 'City'], ['keywords', 'Keywords'], ['competition', 'Competition'], ['pages', 'Pages'], ['sources', 'What it reads']].map(([v, t]) => `<button type="button" data-v="${v}" aria-pressed="${String(ST.view === v)}">${t}</button>`).join('')}</div><div id="lvcView"></div></div>`;
      const view = q('#lvcView', root);
      qa('.lvc-tabs button', root).forEach(b => { b.onclick = () => go(b.dataset.v); });
      const csv = q('#lvcCsv', root); if (csv) csv.onclick = () => { const cell = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; saveFile('content-plan.csv', ['Score,Work,Type,City,Service line,Keyword,Jobs a year,Gross profit a year,Priority,Pressure,Competitors,On the site,URL,Live by', ...planRows().map(w => [w.sc, title(w), TYPE[w.t], w.c, LINE[w.l] ? LINE[w.l].name : '', w.kw, w.jobs, w.gp, w.pri, w.prs, w.cn, STATUS[w.st], w.u, LINE[w.l] ? mon(LINE[w.l].publishBy) : ''].map(cell).join(','))].join('\n') + '\n'); };
      function go(v, then) { ST.view = v; save(); qa('.lvc-tabs button', root).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === v))); ({ plan, city, keywords: keywordsView, competition, pages, sources }[v] || plan)(); if (then) then(); }
      const toggle = id => { const i = ST.order.indexOf(id); if (i >= 0) ST.order.splice(i, 1); else ST.order.push(id); save(); };
      const addBtn = w => `<button type="button" class="btn ghost lvc-add" data-add="${esc(w.id)}" aria-pressed="${String(ST.order.includes(w.id))}" title="Put this work in the order for the agent">${ST.order.includes(w.id) ? '✓ In the order' : '+ Order'}</button>`;

      /* ----- the plan ----- */
      function planRows() { const f = ST.find.trim().toLowerCase(); return S.works.filter(w => (!ST.type || w.t === ST.type) && (!ST.line || w.l === ST.line) && (!ST.status || w.st === ST.status) && (!ST.served || !w.c || (CITY[w.c] && CITY[w.c].served)) && (!f || (w.c + ' ' + w.kw + ' ' + title(w)).toLowerCase().includes(f))); }
      function plan() {
        view.innerHTML = `${callout('note', 'How to read the plan', `Each row is one piece of content. <b>Jobs</b> and <b>gross profit</b> are what the whole market does there in a year, by the Service Lines model: every company's work, not yours alone. <b>Priority</b> and <b>pressure</b> are the dashboard's own, by ZIP and line. The <b>score</b> is half the money in the work, three tenths the priority, two tenths how thin the competition is, marked down when the site already holds the keyword. The dashboard has no search volumes, so none are shown.`)}
          <div id="lvcDue"></div>
          <div class="kpis lvc-kpis" id="lvcKpis"></div>
          <div class="controls">
            <div class="ctl"><label class="fl" for="lvcType">Kind of piece</label><select id="lvcType">${options(Object.entries(TYPE), ST.type, 'Every kind')}</select></div>
            <div class="ctl"><label class="fl" for="lvcLine">Service line</label><select id="lvcLine">${lineOptions(ST.line, 'Every line')}</select></div>
            <div class="ctl"><label class="fl" for="lvcStatus">On the site</label><select id="lvcStatus">${options(Object.entries(STATUS), ST.status, 'Any')}</select></div>
            <div class="ctl" style="flex:1 1 220px"><label class="fl" for="lvcFind">Find a city or a keyword</label><input type="search" id="lvcFind" placeholder="Plano or furnace" autocomplete="off" value="${esc(ST.find)}"></div>
            <label class="chk"><input type="checkbox" id="lvcServed"${ST.served ? ' checked' : ''}> Only cities with a page on the site</label>
          </div>
          <div class="lvc-two"><div class="card"><div class="card-h"><h3>Works, best first</h3><p id="lvcCount"></p></div><div class="card-b"><div class="xscroll" id="lvcBody"></div></div></div>
          <div class="lvc-side"><div class="card" id="lvcDetail"></div><div class="card" id="lvcOrder"></div></div></div>`;
        /* what the calendar asks for: a page goes live two months before its line peaks, so these are due now */
        const m0 = new Date().getMonth() + 1, due = arr(S.lines).filter(l => l.publishBy && !l.b2b && [0, 1].includes((l.publishBy - m0 + 12) % 12)).sort((a, b) => ((a.publishBy - m0 + 12) % 12) - ((b.publishBy - m0 + 12) % 12));
        q('#lvcDue', view).innerHTML = due.length ? callout('judg tight', `Due now, by season (${esc(MONTH[m0 - 1])})`, due.map(l => `<button type="button" class="lnk" data-due="${esc(l.id)}">${esc(l.name)}</button> peaks in ${esc(mon(l.peak))}, so its pages should be live by ${esc(mon(l.publishBy))}`).join(' · ') + '.') : '';
        qa('[data-due]', view).forEach(b => { b.onclick = () => { ST.line = b.dataset.due; ST.status = ''; ST.more = 60; save(); plan(); }; });
        const set = (id, key, ev) => { const n = q(id, view); n[ev || 'onchange'] = () => { ST[key] = n.type === 'checkbox' ? n.checked : n.value; ST.more = 60; save(); draw(); }; };
        set('#lvcType', 'type'); set('#lvcLine', 'line'); set('#lvcStatus', 'status'); set('#lvcServed', 'served'); set('#lvcFind', 'find', 'oninput');
        function draw() {
          const rows = planRows(), g = rows.filter(w => w.st === 'gap'), best = g.slice().sort((a, b) => (b.gp || 0) - (a.gp || 0))[0];
          q('#lvcKpis', view).innerHTML = kpiHTML([{ l: 'Works in view', v: N(rows.length), d: `${N(S.works.length)} in the whole plan` }, { l: 'Nothing on the site', v: N(g.length), d: 'a keyword no live page holds' }, { l: 'Only a section today', v: N(rows.filter(w => w.st === 'hub').length), d: 'covered on a city page, no page of its own' }, { l: 'Built, not yet live', v: N(rows.filter(w => w.st === 'built').length), d: 'waiting on the Pages view' }, { l: 'Largest open work', v: best ? money(best.gp) : '—', d: best ? esc(title(best)) : 'nothing open in view' }]);
          q('#lvcCount', view).textContent = `${N(rows.length)} works${ST.served ? ' in the cities you have a page for' : ''}. Choose a row to read it.`;
          table(q('#lvcBody', view), [
            { k: 'sc', h: 'Score', t: 'Half the money, three tenths priority, two tenths thin competition; marked down when the site holds it', f: w => `<b>${w.sc}</b>` },
            { k: 'title', h: 'Work', l: 1, v: title, f: w => `<span class="lvc-w">${esc(title(w))}</span><span class="mini">${esc(TYPE[w.t])}</span>` },
            { k: 'kw', h: 'Keyword', l: 1, f: w => `<span class="mono lvc-kw">${esc(w.kw)}</span>` },
            { k: 'jobs', h: 'Jobs / yr', t: 'Every company\'s jobs there in a year, by the Service Lines model', f: w => count(w.jobs) },
            { k: 'gp', h: 'Gross profit', t: 'Gross profit in those jobs, at the line\'s ticket and margin', f: w => money(w.gp) },
            { k: 'pri', h: 'Priority', t: 'The dashboard\'s own priority for the line in those ZIP codes', f: w => bar(w.pri, 'priority') },
            { k: 'prs', h: 'Pressure', t: 'The dashboard\'s competitive pressure for the line in those ZIP codes', f: w => bar(w.prs, 'pressure') },
            { k: 'cn', h: 'Rivals', t: 'Companies in reach that sell it', f: w => (w.cn == null ? '—' : String(w.cn)) },
            { k: 'st', h: 'On the site', l: 1, f: stPill },
            { k: 'pub', h: 'Live by', l: 1, t: 'Two months before the line peaks', v: w => w.pub || 99, f: w => `<span title="${esc(mon(w.pub))}">${esc(mon(w.pub).slice(0, 3) || '—')}</span>` },
            { h: '', f: addBtn }], rows, { sort: ST.sort.k, dir: ST.sort.d, limit: ST.more, id: w => w.id, sel: w => w.id === ST.sel, onRow: id => { ST.sel = id; draw(); }, onMore: () => { ST.more += 100; draw(); }, empty: 'No work matches. Clear a filter.',
            after: host => qa('[data-add]', host).forEach(b => { b.onclick = () => { toggle(b.dataset.add); draw(); }; }) });
          detail(); order();
        }
        function detail() {
          const w = WORK[ST.sel], host = q('#lvcDetail', view); if (!w) { host.innerHTML = '<div class="card-h"><h3>The work</h3><p>Choose a row to see why it stands where it does, its keywords and who is there.</p></div>'; return; }
          const k = keywords(w.t, w.a, w.c), c = CITY[w.c], rivals = c && c.comp ? c.comp.top.map(([i, d]) => [COMP[i], d]).filter(([x]) => x && (!w.l || arr(x.lines).includes(w.l))).slice(0, 5) : [];
          host.innerHTML = `<div class="card-h"><h3>${esc(title(w))}</h3><p>${esc(TYPE[w.t])} · score ${w.sc} · ${esc(STATUS[w.st].toLowerCase())}${w.u ? ` · <span class="mono">${esc(pathOf(w.u))}</span>` : ''}</p></div><div class="card-b">
            <ul class="lvc-ul">${why(w).map(s => `<li>${esc(s)}</li>`).join('')}</ul>
            <p class="fl">Keyword</p><p class="mono lvc-big">${esc(w.kw)}</p>
            ${k.support.length ? `<p class="fl">Supporting terms</p><p class="lvc-chips">${k.support.map(x => `<span class="tag">${esc(x)}</span>`).join('')}</p>` : ''}
            ${k.questions.length ? `<p class="fl">Questions to answer on the page</p><p class="lvc-chips">${k.questions.map(x => `<span class="tag">${esc(x)}</span>`).join('')}</p>` : ''}
            ${arr(w.n).length ? `<p class="fl">What the area needs, from the heatmaps</p><ul class="lvc-ul">${w.n.map(id => NEED[id]).filter(Boolean).map(n => `<li><b>${esc(n.title)}.</b> ${esc(n.owner || n.tech)}</li>`).join('')}</ul>` : ''}
            ${rivals.length ? `<p class="fl">Who is there</p><ul class="lvc-ul">${rivals.map(([x, d]) => `<li><b>${esc(x.name)}</b> · ${esc(x.city)}${d != null ? `, ${d} mi` : ''} · ${count(x.reviews)} reviews${x.paid ? ' · paid search' : ''}${pushes(x, ['promos', 'financing']).length ? `<br><span class="mini">pushes: ${esc(pushes(x, ['promos', 'financing']).join(' · '))}</span>` : ''}</li>`).join('')}</ul>` : ''}
            <div class="lvc-row">${addBtn(w)}${w.c && c && c.inAtlas ? `<button type="button" class="btn sec" id="lvcToCity">Read ${esc(w.c)}</button>` : ''}</div></div>`;
          const a = q('[data-add]', host); if (a) a.onclick = () => { toggle(a.dataset.add); draw(); };
          const t = q('#lvcToCity', host); if (t) t.onclick = () => { ST.city = w.c; go('city'); };
        }
        function order() {
          const W = orderWorks(), host = q('#lvcOrder', view);
          host.innerHTML = `<div class="card-h"><h3>The order for the agent</h3><p>${W.length ? `${N(W.length)} work${W.length === 1 ? '' : 's'} chosen. Give the request to the content strategist agent.` : 'Nothing chosen yet. Use + Order on a work.'}</p></div><div class="card-b">${W.length ? `<ol class="lvc-ol">${W.map(w => `<li>${esc(title(w))} <span class="mono mini">${esc(w.kw)}</span> <button type="button" class="lnk" data-drop="${esc(w.id)}">remove</button></li>`).join('')}</ol><div class="lvc-row"><button type="button" class="btn" id="lvcCopy">Copy the request</button><button type="button" class="btn sec" id="lvcSave">Save the order (.json)</button><button type="button" class="btn ghost" id="lvcClear">Clear</button></div><textarea class="lvc-req" id="lvcReq" readonly rows="6" aria-label="The request for the agent">${esc(orderText())}</textarea>` : '<p class="mini">The agent writes each piece from its city\'s brief, checks the keyword against the sitemap and builds the page through the gate. Its pages come back to the Pages view.</p>'}</div>`;
          qa('[data-drop]', host).forEach(b => { b.onclick = () => { toggle(b.dataset.drop); draw(); }; });
          const cp = q('#lvcCopy', host); if (cp) cp.onclick = () => { const t = orderText(); const done = () => say('The request is on the clipboard. Paste it to the content strategist agent.'); try { navigator.clipboard.writeText(t).then(done, () => { q('#lvcReq', host).select(); document.execCommand('copy'); done(); }); } catch (e) { q('#lvcReq', host).select(); try { document.execCommand('copy'); done(); } catch (e2) { say('Select the text below and copy it.'); } } };
          const sv = q('#lvcSave', host); if (sv) sv.onclick = () => saveFile('content-order.json', JSON.stringify(orderFile(), null, 1));
          const cl = q('#lvcClear', host); if (cl) cl.onclick = () => { ST.order = []; save(); draw(); };
        }
        draw();
      }

      /* ----- one city ----- */
      function city() {
        const name = firstCity(), c = CITY[name];
        view.innerHTML = `<div class="controls"><div class="ctl" style="flex:1 1 280px"><label class="fl" for="lvcCity">City</label><select id="lvcCity">${cityOptions(name)}</select></div></div><div id="lvcCityBody"></div>`;
        q('#lvcCity', view).onchange = e => { ST.city = e.target.value; save(); city(); };
        const host = q('#lvcCityBody', view); if (!c) { host.innerHTML = callout('judg', 'No city', 'The plan holds no city.'); return; }
        const pages = [c.hub ? `<li>City page: <a href="${esc(c.hub)}" target="_blank" rel="noopener">${esc(pathOf(c.hub))}</a></li>` : '', ...arr(c.pages).map(p => `<li>${esc(p.topic)}: <a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(pathOf(p.url))}</a></li>`)].filter(Boolean).join('');
        if (!c.inAtlas) { host.innerHTML = callout('judg', `${esc(c.name)} lies outside the mapped area`, 'The dashboard has no heatmap, no service line model and no competitor read for it. A page there is written from the trade, with no local figure.') + `<div class="card"><div class="card-h"><h3>On the site</h3></div><div class="card-b"><ul class="lvc-ul">${pages || '<li>No page.</li>'}</ul></div></div>`; return; }
        const need = id => { const n = NEED[id]; return n ? `<div class="lvc-need"><h4>${esc(n.title)}</h4>${n.owner ? `<p><span class="fl">Tell the owner</span>${esc(n.owner)}</p>` : ''}<p><span class="fl">The trade detail</span>${esc(n.tech)}</p></div>` : ''; };
        const names = ids => arr(ids).map(id => NEED[id]).filter(n => n && n.copy !== false).map(n => n.title), h = c.heating || {};
        host.innerHTML = `<div class="kpis lvc-kpis">${kpiHTML([{ l: 'Typical home', v: esc(String(c.built || '—')), d: 'Census figures' }, { l: 'Heating', v: h.lead === 'gas' ? 'Gas leads' : h.lead === 'electric' ? 'Electric leads' : 'Split', d: `${Math.round(h.gas)}% gas · ${Math.round(h.electric)}% electric · ${Math.round(h.heatPumps)}% heat pumps` }, { l: 'Central systems', v: N(c.systems), d: 'by one estimate' }, { l: 'Rivals in reach', v: N(c.comp.near + c.comp.metro), d: `${c.comp.inTown} based in town · ${c.comp.paid} on paid search` }, { l: 'From the shop', v: c.miles == null ? '—' : c.miles + ' mi', d: c.cpc ? `a paid click costs ${c.cpc >= 1 ? Math.round(100 * (c.cpc - 1)) + '% more' : Math.round(100 * (1 - c.cpc)) + '% less'} than the market` : '' }])}</div>
          ${c.wider ? callout('judg tight', 'Shared ZIP codes', `Only about ${Math.round(100 * c.coverage)}% of the homes in ${esc(c.name)}'s ZIP codes are in ${esc(c.name)}. What follows is judged from the city's own figures. A point read from one ZIP is true of that ZIP, not of the city.`) : ''}
          <div class="lvc-two"><div>
            <div class="card"><div class="card-h"><h3>What sets ${esc(c.name)} apart</h3><p>Lead the page with these, in this order. ${esc(c.means || '')}</p></div><div class="card-b">${arr(c.lead).map(need).join('') || '<p class="mini">Nothing stands above the market here. Write from the trade and the city\'s own figures.</p>'}
              ${names(c.also).length ? `<p class="fl">Also true here</p><p>${esc(names(c.also).join(' · '))}</p>` : ''}${arr(c.pockets).length ? `<p class="fl">${c.wider ? 'True of a ZIP code, not of the city' : 'True in part of town'}</p><p>${arr(c.pockets).filter(([id]) => NEED[id] && NEED[id].copy !== false).map(([id, z]) => `${esc(NEED[id].title)} <span class="mono mini">${esc(arr(z).join(' '))}</span>`).join(' · ')}</p>` : ''}${names(c.quiet).length ? `<p class="fl">Not the story here</p><p class="mini">${esc(names(c.quiet).join(' · '))}</p>` : ''}</div></div>
            <div class="card"><div class="card-h"><h3>Service lines in ${esc(c.name)}</h3><p>What each is worth here in a year across every company, how crowded it is, and what the site holds.</p></div><div class="card-b"><div class="xscroll" id="lvcCityLines"></div></div></div>
            <div class="card"><div class="card-h"><h3>By ZIP</h3><p>What a homeowner in each one is likely living with.</p></div><div class="card-b"><div class="xscroll"><table class="lvc-t"><thead><tr><th class="l">ZIP</th><th>${c.wider ? 'Share of these ZIPs' : 'Share of the city'}</th><th>Typical home</th><th class="l">What runs hot there</th></tr></thead><tbody>${arr(c.zips).map(z => `<tr><td class="l mono">${esc(z.zip)}</td><td>${z.share}%</td><td>${esc(String(z.built || '—'))}</td><td class="l">${esc(names(z.needs).join(' · ') || 'nothing above the market')}</td></tr>`).join('')}</tbody></table></div></div></div>
          </div><div class="lvc-side">
            <div class="card"><div class="card-h"><h3>Who is there</h3><p>${c.comp.inTown} based in town, ${c.comp.near} within ${S.reach} miles, ${c.comp.metro} more working the whole metro.</p></div><div class="card-b"><ul class="lvc-ul">${c.comp.top.map(([i, d]) => [COMP[i], d]).filter(([x]) => x).map(([x, d]) => `<li><b>${esc(x.name)}</b><br><span class="mini">${esc(x.city)}${d != null ? `, ${d} mi` : ''}${x.scope === 'metro-wide' ? ' · metro wide' : ''} · ${count(x.reviews)} reviews${x.rating ? ' at ' + x.rating : ''}${x.paid ? ' · paid search' : ''}</span>${pushes(x, ['promos', 'financing', 'membership']).length ? `<br><span class="mini">pushes: ${esc(pushes(x, ['promos', 'financing', 'membership']).join(' · '))}</span>` : ''}</li>`).join('')}</ul><p class="mini">Read it to choose what a page leads with. A page never names a competitor.</p></div></div>
            <div class="card"><div class="card-h"><h3>On the site</h3></div><div class="card-b"><ul class="lvc-ul">${pages || '<li>No page for this city yet.</li>'}</ul>${arr(c.neighbors).length ? `<p class="fl">Next door</p><p>${esc(c.neighbors.join(' · '))}</p>` : ''}</div></div>
            <div class="card"><div class="card-h"><h3>Figures, as a person says them</h3></div><div class="card-b"><ul class="lvc-ul">${arr(c.facts).map(f => `<li><b>${esc(f[0])}</b> ${esc(f[1])} <span class="mini">(${esc(f[2])}; ${esc(f[3])})</span></li>`).join('')}</ul></div></div>
          </div></div>`;
        const rows = arr(S.lines).filter(l => c.lines && c.lines[l.id]).map(l => { const v = c.lines[l.id], w = S.works.find(x => x.t === 'service-city' && x.c === c.name && x.l === l.id) || null; return { id: l.id, name: l.name, jobs: v[0], gp: v[1], prs: v[2], pri: v[3], cn: c.comp.byLine[l.id] || 0, w, pub: l.publishBy }; });
        table(q('#lvcCityLines', host), [{ k: 'name', h: 'Service line', l: 1 }, { k: 'jobs', h: 'Jobs / yr', f: r => count(r.jobs) }, { k: 'gp', h: 'Gross profit', f: r => money(r.gp) }, { k: 'pri', h: 'Priority', f: r => bar(r.pri) }, { k: 'prs', h: 'Pressure', f: r => bar(r.prs) }, { k: 'cn', h: 'Rivals', f: r => String(r.cn) }, { k: 'st', h: 'On the site', l: 1, v: r => (r.w ? r.w.st : ''), f: r => (r.w ? stPill(r.w) : '<span class="mini">no page planned here</span>') }, { k: 'pub', h: 'Live by', l: 1, v: r => r.pub || 99, f: r => esc(mon(r.pub) || '—') }, { h: '', f: r => (r.w ? addBtn(r.w) : '') }], rows, { sort: 'gp', dir: -1, after: hst => qa('[data-add]', hst).forEach(b => { b.onclick = () => { toggle(b.dataset.add); city(); }; }) });
      }

      /* ----- the keyword for a piece ----- */
      function keywordsView() {
        if (!ST.kcity) ST.kcity = firstCity();
        view.innerHTML = `${callout('note', 'One keyword for each piece', 'A page stands for one keyword. The terms come from the dashboard\'s own keyword library, by service angle. The check against the site is the plan\'s; the agent runs it again against a fresh sitemap before it writes.')}
          <div class="controls"><div class="ctl"><label class="fl" for="lvcKind">Kind of piece</label><select id="lvcKind">${options(Object.entries(TYPE), ST.kind)}</select></div>
          <div class="ctl" style="flex:1 1 260px"><label class="fl" for="lvcAngle">Service</label><select id="lvcAngle">${options(arr(S.angles).map(a => [a.id, a.label]), ST.angle)}</select></div>
          <div class="ctl"><label class="fl" for="lvcKCity">City</label><select id="lvcKCity">${cityOptions(ST.kcity)}</select></div></div><div id="lvcKw"></div>`;
        const bind = (id, key) => { q(id, view).onchange = e => { ST[key] = e.target.value; save(); draw(); }; }; bind('#lvcKind', 'kind'); bind('#lvcAngle', 'angle'); bind('#lvcKCity', 'kcity');
        function draw() {
          const local = ST.kind === 'city' || ST.kind === 'service-city', cn = local ? ST.kcity : '', c = CITY[cn], a = ANGLE[ST.angle] || {}, k = keywords(ST.kind, ST.angle, cn), w = workFor(ST.kind, ST.angle, cn), l = arr(S.lines).find(x => x.angle === ST.angle) || null;
          q('#lvcKCity', view).disabled = !local; q('#lvcAngle', view).disabled = ST.kind === 'city';
          const fires = c && c.fires ? c.fires[ST.angle] : null, v = c && c.lines && l ? c.lines[l.id] : null;
          q('#lvcKw', view).innerHTML = `<div class="lvc-two"><div class="card"><div class="card-h"><h3>${esc(ST.kind === 'city' ? 'City page: ' + cn : (a.label || ST.angle) + (cn ? ' in ' + cn : ''))}</h3><p>${esc(TYPE[ST.kind])}${a.why && ST.kind !== 'city' ? ' · when it applies: ' + esc(a.why) : ''}</p></div><div class="card-b">
              <p class="fl">Primary keyword</p><p class="mono lvc-big">${esc(k.primary || '—')}</p>
              <p class="fl">On the site</p><p>${w ? pill(STATUS[w.st], STCLS[w.st]) + (w.u ? ` <a href="${esc(w.u)}" target="_blank" rel="noopener" class="mono">${esc(pathOf(w.u))}</a>` : '') : '<span class="mini">Not weighed in the plan. The agent checks it against the sitemap before writing.</span>'}</p>
              ${k.support.length ? `<p class="fl">Supporting terms, from the same service</p><p class="lvc-chips">${k.support.map(x => `<span class="tag">${esc(x)}</span>`).join('')}</p>` : ''}
              ${k.questions.length ? `<p class="fl">Questions to answer</p><p class="lvc-chips">${k.questions.map(x => `<span class="tag">${esc(x)}</span>`).join('')}</p>` : ''}
              ${k.negatives.length ? `<p class="fl">Searches the business does not want</p><p class="mini">${esc(k.negatives.join(' · '))}</p>` : ''}
              ${w ? `<div class="lvc-row">${addBtn(w)}</div>` : ''}</div></div>
            <div class="lvc-side"><div class="card"><div class="card-h"><h3>What stands behind it</h3></div><div class="card-b"><ul class="lvc-ul">
              ${local && c && c.inAtlas && ST.kind !== 'city' ? `<li>${fires ? `The dashboard finds demand for it in ${fires}% of ${esc(cn)}'s ZIP codes.` : `The dashboard finds <b>no demand trigger</b> for it in ${esc(cn)}. Say so before a page is built.`}</li>` : ''}
              ${v ? `<li>${esc(l.name)} in ${esc(cn)}: about ${count(v[0])} jobs and ${money(v[1])} gross profit a year across every company. Priority ${v[3]}, pressure ${v[2]}.</li>` : l && l.totals && !local ? `<li>${esc(l.name)} across the market: about ${count(l.totals.jobs)} jobs a year. ${N(l.totals.competitors)} companies sell it, ${N(l.totals.competitorsPaid)} with paid search.</li>` : ''}
              ${l && l.unit ? `<li>A typical job: ${money(l.unit.ticket)} ticket at a ${l.unit.margin}% margin. A paid lead costs about ${money(l.unit.cpl)}.</li>` : ''}
              ${l && l.peak ? `<li>It peaks in ${mon(l.peak)}. Have the page live by ${mon(l.publishBy)}.</li>` : ''}
              ${local && c && c.comp && l ? `<li>${c.comp.byLine[l.id] || 0} companies in reach of ${esc(cn)} sell it.</li>` : ''}
              ${w ? why(w).slice(-1).map(s => `<li>${esc(s)}</li>`).join('') : ''}</ul>${l && arr(l.hooks).length ? `<p class="fl">What the paid side leads with for this line</p><p class="mini">${esc(l.hooks.join(' · '))}</p><p class="mini">Any claim among these needs the client's word before it goes on a page.</p>` : ''}</div></div></div></div>`;
          const b = q('[data-add]', view); if (b) b.onclick = () => { toggle(b.dataset.add); draw(); };
        }
        draw();
      }

      /* ----- the competition ----- */
      function competition() {
        const L = arr(S.competitors);
        view.innerHTML = `<div class="kpis lvc-kpis">${kpiHTML([{ l: 'Companies read', v: N(L.length), d: obj(R.asOf).competitors ? 'Competitor Watch, as of ' + esc(R.asOf.competitors) : 'Competitor Watch' }, { l: 'With offers on file', v: N(L.filter(c => c.intel).length), d: 'financing, promotions, plans' }, { l: 'On paid search', v: N(L.filter(c => c.paid).length), d: 'seen buying keywords' }, { l: 'Working the whole metro', v: N(L.filter(c => c.scope === 'metro-wide').length), d: 'in reach of every city' }])}</div>
          <div class="controls"><div class="ctl"><label class="fl" for="lvcCCity">In reach of</label><select id="lvcCCity">${cityOptions(ST.ccity, 'Every city')}</select></div><div class="ctl"><label class="fl" for="lvcCLine">Sells</label><select id="lvcCLine">${lineOptions(ST.cline, 'Any service line')}</select></div></div>
          <div class="card"><div class="card-h"><h3>Who you are up against</h3><p id="lvcCNote"></p></div><div class="card-b"><div class="xscroll" id="lvcCTable"></div></div></div>
          <div class="card"><div class="card-h"><h3>Where the field is thin</h3><p id="lvcWNote"></p></div><div class="card-b"><div class="xscroll" id="lvcWTable"></div></div></div>`;
        q('#lvcCCity', view).onchange = e => { ST.ccity = e.target.value; save(); draw(); }; q('#lvcCLine', view).onchange = e => { ST.cline = e.target.value; save(); draw(); };
        function draw() {
          const c = CITY[ST.ccity], near = c && c.comp ? new Map(c.comp.top) : null;
          let rows = L.map(x => ({ x, d: near && near.has(x.i) ? near.get(x.i) : null })).filter(r => (!ST.cline || arr(r.x.lines).includes(ST.cline)) && (!c || !c.comp || near.has(r.x.i)));
          q('#lvcCNote', view).textContent = c && c.comp ? `The largest in reach of ${c.name}: based there, within ${S.reach} miles, or working the whole metro.` : 'The whole roster. Choose a city to see who is in reach of it.';
          table(q('#lvcCTable', view), [{ k: 'name', h: 'Company', l: 1, v: r => r.x.name }, { k: 'city', h: 'Based in', l: 1, v: r => r.x.city }, { k: 'd', h: 'Miles', v: r => r.d }, { k: 'reviews', h: 'Reviews', v: r => r.x.reviews, f: r => count(r.x.reviews) }, { k: 'rating', h: 'Rating', v: r => r.x.rating }, { k: 'paid', h: 'Paid search', l: 1, v: r => (r.x.paid ? 'yes' : ''), f: r => (r.x.paid ? pill('paid search', 'st-configured') : '') }, { k: 'nl', h: 'Lines sold', v: r => arr(r.x.lines).length }, { h: 'What they push', l: 1, f: r => `<span class="mini lvc-push">${esc(pushes(r.x, ['tagline', 'promos', 'financing', 'membership']).join(' · '))}</span>` }], rows, { sort: 'reviews', dir: -1, limit: 40, onMore: () => { }, empty: 'No company matches.' });
          /* the same line across the cities: most work, least pressure */
          const lid = ST.cline || 'replace', l = LINE[lid], thin = arr(S.cities).filter(x => x.served && x.lines && x.lines[lid]).map(x => ({ name: x.name, jobs: x.lines[lid][0], gp: x.lines[lid][1], prs: x.lines[lid][2], pri: x.lines[lid][3], cn: x.comp.byLine[lid] || 0, w: S.works.find(w => w.t === 'service-city' && w.c === x.name && w.l === lid) || null }));
          q('#lvcWNote', view).textContent = `${l ? l.name : lid} in the cities you have a page for, lowest pressure first.`;
          table(q('#lvcWTable', view), [{ k: 'name', h: 'City', l: 1 }, { k: 'prs', h: 'Pressure', f: r => bar(r.prs) }, { k: 'pri', h: 'Priority', f: r => bar(r.pri) }, { k: 'cn', h: 'Rivals', f: r => String(r.cn) }, { k: 'jobs', h: 'Jobs / yr', f: r => count(r.jobs) }, { k: 'gp', h: 'Gross profit', f: r => money(r.gp) }, { k: 'st', h: 'On the site', l: 1, v: r => (r.w ? r.w.st : ''), f: r => (r.w ? stPill(r.w) : '') }, { h: '', f: r => (r.w ? addBtn(r.w) : '') }], thin, { sort: 'prs', dir: 1, limit: 25, onMore: () => { }, after: hst => qa('[data-add]', hst).forEach(b => { b.onclick = () => { toggle(b.dataset.add); draw(); }; }) });
        }
        draw();
      }

      /* ----- the pages the agent has built ----- */
      function pages() {
        const B = arr(S.built), bp = blueprints(), kinds = obj(obj(S.site).kinds);
        view.innerHTML = `<div class="kpis lvc-kpis">${kpiHTML([{ l: 'Built by the agent', v: N(B.length), d: 'passed the gate, not yet live' }, { l: 'Ready for Publish', v: N(bp.length), d: bp.length ? 'in this file, with their schema' : 'none carried in this file' }, { l: 'Live on the site', v: N(obj(S.site).pages || 0), d: Object.entries(kinds).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${v} ${k}`).join(' · ') }])}</div>
          ${B.length ? `<div class="card"><div class="card-h"><h3>Built pages</h3><p>Each passed the gate: reading grade, active voice, a homeowner's voice, live links, valid schema.</p></div><div class="card-b"><div class="lvc-row">${bp.length ? '<button type="button" class="btn" id="lvcSend">Send them to Publish as drafts</button>' : ''}${MODI.agents ? '<button type="button" class="btn sec" data-go="agents">Open the Agent Desk</button>' : ''}</div><div id="lvcSent"></div><div class="xscroll" id="lvcPages"></div></div></div>` : callout('note', 'Nothing built yet', 'Put works in an order on the Plan view and give the request to the content strategist agent. The pages it builds come back here.')}`;
        if (B.length) table(q('#lvcPages', view), [{ k: 'city', h: 'City', l: 1 }, { k: 'title', h: 'Page', l: 1, f: p => `${esc(p.title || p.slug)}<br><span class="mono mini">${esc(pathOf(p.url))}</span>` }, { k: 'keyword', h: 'Keyword', l: 1, f: p => `<span class="mono lvc-kw">${esc(p.keyword)}</span>` }, { k: 'words', h: 'Words' }, { k: 'grade', h: 'Reading grade' }], B, { sort: 'city', dir: 1, limit: 80, onMore: () => { } });
        const send = q('#lvcSend', view); if (send) send.onclick = async () => { send.disabled = true; const r = await toPublish(bp); send.disabled = false; q('#lvcSent', view).innerHTML = callout(r.ok ? 'lvc-ok' : 'judg', r.ok ? 'In Publish, as drafts' : 'Publish did not take them', `${esc(r.why || '')}${r.ok ? ' Nothing reaches the site until you choose a target in Publish and send it. Publish keeps pages only while the dashboard is open.' : ''}${r.ok && MODI.publish ? ' <button type="button" class="lnk" data-go="publish">Open Publish</button>' : ''}`); };
      }

      /* ----- what the plan reads ----- */
      function sources() {
        const tab = re => MODS.find(m => re.test(m.title || '')), link = (re, label) => { const m = tab(re); return m ? `<button type="button" class="lnk" data-go="${esc(m.key)}">${esc(label || m.title)} (module ${esc(m.num)})</button>` : esc(label || ''); };
        const rows = [
          ['The heatmaps and the city records', link(/thermal debt index/i), R.heatmaps ? 'What each area needs: system age, the decade the homes went up, heating fuel, hail, new owners, ZIP by ZIP, and each city\'s own figures.' : 'Not read.'],
          ['Jobs, gross profit, season, priority and pressure', link(/service lines/i), R.lines ? `${arr(S.lines).length} service lines by ZIP: what the work is worth, when it peaks, and how the dashboard itself ranks each line in each ZIP.` : 'Not read: the plan has no money, priority or pressure figures. Connect the dashboard on a machine with a browser.'],
          ['Who is there and what they push', link(/competitor watch/i), R.competitors ? `${N(R.competitors)} companies: where each is based, its reviews, the services it sells, whether it buys search ads, and the offers on file.` : 'Not read.'],
          ['What a click costs', link(/paid acquisition/i), R.paid ? 'Relative click cost by ZIP: where paid search is dear, a page that ranks is worth more.' : 'Not read.'],
          ['The keyword for each piece', link(/campaign desk/i, 'The keyword library'), `${arr(S.angles).length} service angles with core, city and question terms, and the searches the business does not want.`],
          ['The page plan and the rules', link(/site forge/i), 'The pages the Site Forge plans, and the advertising rules every page is held to.'],
          ['The services you sell', link(/service lines/i, 'Your own record and the brand file'), arr(S.lines).some(l => l.offered === false) ? `Not listed among your services: ${arr(S.lines).filter(l => l.offered === false).map(l => l.name).join(', ')}. Works for those lines say so.` : 'Every service line in the plan is one you list.'],
          ['What the site already holds', esc(obj(S.client).url || ''), R.sitemap ? `${N(obj(S.site).pages)} live URLs from the client's sitemap, so no keyword is planned twice.` : 'No sitemap was read, so every work shows as open.'],
          ['What the agent has built', link(/agent desk/i), `${N(arr(S.built).length)} built pages, with what the gate measured.`]];
        view.innerHTML = `${callout('note', 'One plan from every tab', 'Nothing here is typed in by hand. The toolkit reads the dashboard file and the client\'s sitemap, works the plan out, and writes it into this copy. When the dashboard, the site or the built pages change, the agent writes the copy again.')}
          <div class="card"><div class="card-h"><h3>What it reads</h3></div><div class="card-b"><div class="xscroll"><table class="lvc-t"><thead><tr><th class="l">What</th><th class="l">From</th><th class="l">How it is used</th></tr></thead><tbody>${rows.map(r => `<tr><td class="l"><b>${esc(r[0])}</b></td><td class="l">${r[1]}</td><td class="l">${esc(r[2])}</td></tr>`).join('')}</tbody></table></div></div></div>
          <div class="card"><div class="card-h"><h3>What it does not know</h3></div><div class="card-b"><ul class="lvc-ul"><li>Search volumes and rankings. The dashboard holds none, so the plan ranks by the work to be won, not by searches.</li><li>Your own share. Jobs and gross profit are the whole market's in that place.</li><li>Whether a claim about the company is true. The agent asks before it writes one.</li><li>Competitors' own pages. The roster says who is there and what they sell and push, not what their sites rank for.</li></ul><p class="mini">Worked out ${isNaN(made) ? '' : esc(made.toLocaleString())}${obj(obj(S.atlas).source).file ? ` from ${esc(S.atlas.source.file)}` : ''}.</p></div></div>`;
      }
      go(ST.view);
    },
  });
})();
