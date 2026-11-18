
/* ==== command center: one door to Publish for page files ==== */
/* Page files (whole HTML documents) go into Publish the way a person would put them in: as files on Publish's own import
   box, so its own reader takes each one apart and its own list shows the result. What Publish then lists is read back.
   Used by the Paid Ads Strategist for the landing pages and by the Content Strategist for the heating pages.
   files: [{ name, slug, text }] -> { ok, listed, wanted, why } */
(function () {
  "use strict";
  if (typeof MODI === 'undefined' || window.IACC) return;
  const wait = (test, ms) => new Promise(done => { const t0 = Date.now(); (function tick() { let ok = false; try { ok = !!test(); } catch (e) { ok = false; } if (ok || Date.now() - t0 > ms) done(ok); else setTimeout(tick, 80); })(); });
  async function publishHtml(files) {
    const m = MODI.publish; if (!m) return { ok: false, why: 'This build has no Publish module.' };
    try { if (!m.mounted) { m.mounted = true; m.mount(document.querySelector('#mod-publish')); } } catch (e) { return { ok: false, why: 'Publish failed to open.' }; }
    const root = document.querySelector('#mod-publish'), input = root && root.querySelector('#p16iFile'), log = root && root.querySelector('#p16iLog'), T = document.querySelector('.toast');
    if (!input) return { ok: false, why: 'This build has no Publish import box.' };
    const before = log ? log.textContent : ''; if (T) T.textContent = '';
    try { const dt = new DataTransfer(); files.forEach(f => dt.items.add(new File([f.text], f.name, { type: 'text/html' }))); input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true })); }
    catch (e) { return { ok: false, why: 'This browser would not hand the pages to Publish.' }; }
    await wait(() => (log && log.textContent !== before) || (T && /imported/i.test(T.textContent || '')), 10000 + files.length * 250);
    const have = new Set(typeof m.pages === 'function' ? (m.pages() || []).map(p => p && p.slug) : []), listed = files.filter(f => have.has(f.slug)).length;
    return { ok: listed === files.length, listed, wanted: files.length, why: listed === files.length ? '' : `Publish lists ${listed} of the ${files.length}.` };
  }
  /* the pages Publish holds now, without opening it */
  const publishHas = () => { try { const m = MODI.publish; return m && m.mounted && typeof m.pages === 'function' ? new Set((m.pages() || []).map(p => p && p.slug)) : new Set(); } catch (e) { return new Set(); } };
  window.IACC = { publishHtml, publishHas };
})();

/* ==== command center: paid ads strategist ==== */
/* The Paid Ads Strategist: a module of its own, the paid side's counterpart of the Content Strategist. It holds the
   campaigns the paid ads strategist built, laid out to be read and approved: what each one costs and where it runs, every
   Google Search ad and every Meta ad the way it shows, the landing page each campaign sends its clicks to, what the owner
   has to confirm before anything is switched on, and every file for the ad accounts.

   The campaigns themselves ride on the Agent Desk (#lvp-data): this module reads them from there, so there is one copy.
   Its own data (#lvs-data) carries what a hand-off does not: the landing pages as built, the order and short names of the
   campaigns, the owner's list and the notes. A plan goes to the Campaign Desk through the Agent Desk's own button, and a
   landing page goes to Publish through Publish's own import box, as a draft. Nothing here spends money or publishes.

   Plain script in the dashboard's own style, using the dashboard's own helpers (registerModule, mastHTML, callout,
   kpiHTML, esc, store, toast, saveFile, zipBlob, satchelLint). Every string that came from the data is escaped before it
   reaches the page, and a landing page is only ever drawn inside a sandboxed frame. If the dashboard has no module
   system, or the data is not there, it does nothing at all. */
(function () {
  "use strict";
  if (typeof registerModule !== 'function' || typeof MODS === 'undefined' || typeof MODI === 'undefined' || MODI.paidads) return;
  const arr = v => (Array.isArray(v) ? v : []), obj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
  let DATA = null; try { const n = document.getElementById('lvs-data'); DATA = n ? JSON.parse(n.textContent) : null; } catch (e) { DATA = null; }
  if (!DATA || DATA.format !== 'integrity.paid-ads' || !Array.isArray(DATA.campaigns)) return;
  const BUNDLES = (() => { try { const n = document.getElementById('lvp-data'), d = n ? JSON.parse(n.textContent) : null; return Object.fromEntries(arr(d && d.bundles).filter(b => b && b.paid && typeof b.id === 'string').map(b => [b.id, b])); } catch (e) { return {}; } })();
  const PAGES = obj(DATA.pages), pageDoc = p => String(p.html).split(PAGES.mark).join(PAGES.css);
  const CAMPS = DATA.campaigns.filter(c => c && BUNDLES[c.id]).map(c => Object.assign({}, c, { b: BUNDLES[c.id], P: obj(BUNDLES[c.id].paid), page: arr(PAGES.list).find(p => p.slug === c.lp) || null }));
  if (!CAMPS.length) return;
  const KEY = 'paidads', STORE = 'lv.paidads.v1', NUM = String(Math.max(0, ...MODS.map(m => +m.num || 0)) + 1).padStart(2, '0');
  const q = (s, r) => (r || document).querySelector(s), qa = (s, r) => [...(r || document).querySelectorAll(s)];
  const BY = Object.fromEntries(CAMPS.map(c => [c.id, c]));
  const kept = obj(store.get(STORE, {}));
  const VIEWS = [['overview', 'Campaigns'], ['ads', 'Ad copy'], ['pages', 'Landing pages'], ['confirm', 'To confirm'], ['files', 'Files']];
  const ST = { view: VIEWS.some(v => v[0] === kept.view) ? kept.view : 'overview', sel: BY[kept.sel] ? kept.sel : CAMPS[0].id, width: kept.width === 'phone' ? 'phone' : 'desktop' };
  const save = () => store.set(STORE, { view: ST.view, sel: ST.sel, width: ST.width });

  /* ---------- small things ---------- */
  const money = v => (isN(v) ? '$' + N(v) : '—');
  const txt = x => (typeof x === 'string' ? x : x && typeof x.text === 'string' ? x.text : '');
  const pinOf = x => (x && typeof x === 'object' && +x.pin > 0 ? Math.round(+x.pin) : 0);
  const len = s => [...String(s).replace(/\{keyword:([^}]*)\}/gi, '$1')].length;
  const plural = (n, one, many) => `${N(n)} ${n === 1 ? one : (many || one + 's')}`;
  const pill = (text, cls, tip) => `<span class="pill ${cls || ''}"${tip ? ` title="${esc(tip)}"` : ''}>${esc(text)}</span>`;
  const md = t => esc(t).replace(/`([^`]+)`/g, '<span class="mono">$1</span>');
  const PLATFORM = { google: 'Google Search', lsa: 'Local Services', dg: 'Demand Gen', meta: 'Meta', microsoft: 'Microsoft', nextdoor: 'Nextdoor', yelp: 'Yelp', linkedin: 'LinkedIn' };
  const mixOf = c => Object.entries(obj(obj(c.P.plan).mix)).filter(([, v]) => +v > 0).map(([k, v]) => ({ k, label: PLATFORM[k] || k, share: +v, spend: (+v / 100) * (+c.P.plan.budget || 0) }));
  const splitText = c => mixOf(c).map(m => `${m.label} ${N(m.share)}%`).join(' · ');
  const groupsOf = c => arr(c.P.search).flatMap(s => arr(s.adGroups));
  const keywordsOf = c => groupsOf(c).reduce((n, g) => n + arr(g.keywords).length, 0);
  const metaOf = c => arr(c.P.ads).filter(a => a && a.channel === 'meta');
  const totalsOf = c => obj(obj(c.P.summary).totals);
  const host = (() => { try { return new URL(obj(CAMPS[0].P.plan).url).hostname; } catch (e) { return 'www.integrityairconditioning.com'; } })();
  const brandName = () => (typeof BRAND !== 'undefined' && BRAND && BRAND.name) || 'Integrity Air Conditioning & Heating';
  const SEVC = { error: 'var(--critical)', block: 'var(--critical)', warn: 'var(--warning)', note: 'var(--ink-3)' };
  /* this dashboard's own screen of an ad's copy: the rules the Emergency Satchel runs */
  const screen = (texts, platform, lic, search) => {
    if (typeof satchelLint !== 'function' || !texts.length) return null;
    try {
      const L = (t, extra) => satchelLint(t, Object.assign({ lic }, extra || {})), out = L(texts.join(' \n '), { needLic: true, platform }).map(x => ({ id: x.rule.id, name: x.rule.name, sev: x.rule.sev, ev: x.ev }));
      if (search) texts.forEach(t => L(t, { headline: true }).forEach(x => { if (x.rule.id === 'GGL1') out.push({ id: 'GGL1', name: x.rule.name, sev: x.rule.sev, ev: `${x.ev} in "${t}"` }); }));
      return out;
    } catch (e) { return null; }
  };
  const flags = list => (list == null ? '' : list.length ? list.map(f => `<span class="pill" style="border-color:${SEVC[f.sev] || 'var(--line-strong)'};color:${SEVC[f.sev] || 'var(--ink-2)'}" title="${esc(f.name + ': ' + f.ev)}">${esc(f.id)}</span>`).join(' ') : pill('clean by this dashboard\'s rules', 'st-connected'));
  const fileName = id => String(id).replace(/^[a-z]+:/, '').replace(/[^a-z0-9._-]+/gi, '-') || 'campaign';
  const OTHERS = Object.values(BUNDLES).filter(b => !BY[b.id]);
  const SUM = { budget: sum(CAMPS.map(c => c.P.plan.budget)), groups: sum(CAMPS.map(c => groupsOf(c).length)), keywords: sum(CAMPS.map(keywordsOf)), meta: sum(CAMPS.map(c => metaOf(c).length)), leads: sum(CAMPS.map(c => totalsOf(c).leads)), booked: sum(CAMPS.map(c => totalsOf(c).booked)), pages: CAMPS.filter(c => c.page).length };

  registerModule({
    key: KEY, num: NUM, title: 'Paid Ads Strategist', desc: 'The campaigns the paid ads strategist built: budgets and markets, every Google and Meta ad as it shows, the landing pages, what to confirm, and the files',
    /* for a check from outside: what the module holds and shows */
    state() { return { campaigns: CAMPS.length, monthly: SUM.budget, adGroups: SUM.groups, keywords: SUM.keywords, metaAds: SUM.meta, landingPages: SUM.pages, confirm: arr(DATA.confirm).length, view: ST.view, sel: ST.sel }; },
    mount(root) {
      const self = this, made = new Date(DATA.made);
      root.innerHTML = mastHTML({
        eyebrow: `Module ${NUM} · Paid Ads Strategist · ${esc(obj(CAMPS[0].P.plan).brand || 'Integrity Air')}`, title: 'Paid Ads Strategist',
        dek: 'The paid side of the plan, ready to read and approve. Each campaign has its budget and markets, its Google Search ads and Meta ads laid out the way they show, the landing page its clicks go to, and its files for the ad accounts. Nothing here is live: every campaign and every ad in the files is paused, the landing pages are drafts marked noindex, and nothing was sent to an ad account or to the website.',
        meta: [`<b>Campaigns</b> ${N(CAMPS.length)}`, `<b>Proposed</b> ${money(SUM.budget)} a month`, `<b>Ad groups</b> ${N(SUM.groups)} · <b>keywords</b> ${N(SUM.keywords)}`, `<b>Meta ads</b> ${N(SUM.meta)}`, `<b>Landing pages</b> ${N(SUM.pages)}`, `<b>Built</b> ${isNaN(made) ? '' : esc(made.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }))}`],
        bar: 'Paid Ads Strategist', barsub: 'Campaigns, ad copy, landing pages, what to confirm, files · everything paused',
        actions: [{ id: 'lvsAll', label: '↓ Everything (.zip)', title: 'Every campaign folder, the six landing pages and the page files, as one zip' }]
      }) + `<div class="wrap lvs"><div class="seg lvs-tabs" role="tablist" aria-label="Paid Ads Strategist views">${VIEWS.map(([v, t]) => `<button type="button" data-v="${v}" aria-pressed="${String(ST.view === v)}">${t}</button>`).join('')}</div><div id="lvsView"></div></div>`;
      const view = q('#lvsView', root);
      qa('.lvs-tabs button', root).forEach(b => { b.onclick = () => go(b.dataset.v); });
      function go(v, sel) { if (sel && BY[sel]) ST.sel = sel; ST.view = VIEWS.some(x => x[0] === v) ? v : 'overview'; save(); qa('.lvs-tabs button', root).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === ST.view))); ({ overview, ads, pages, confirm, files })[ST.view](); }
      const cur = () => BY[ST.sel] || CAMPS[0];
      /* the campaign picker the ad copy, landing page and file views share */
      const picker = () => `<div class="lvs-pick" role="group" aria-label="Campaign">${CAMPS.map((c, i) => `<button type="button" data-c="${esc(c.id)}" aria-pressed="${String(c.id === ST.sel)}"><span class="lvs-pn">${i + 1}</span><span class="lvs-pt">${esc(c.label)}</span><span class="lvs-pm">${money(c.P.plan.budget)} a month · ${esc(c.lp ? '/' + c.lp + '/' : '')}</span></button>`).join('')}</div>`;
      const wirePick = () => qa('.lvs-pick button', view).forEach(b => { b.onclick = () => go(ST.view, b.dataset.c); });
      const toDesk = c => { if (MODI.agents) showModule('agents', { open: c.id }); };
      const deskRow = c => `<div class="lvs-row">${MODI.agents ? `<button type="button" class="btn" data-desk="${esc(c.id)}">Load this plan on the Campaign Desk…</button>` : ''}<button type="button" class="btn sec" data-to="ads">Read the ad copy</button>${c.page ? '<button type="button" class="btn sec" data-to="pages">See the landing page</button>' : ''}<button type="button" class="btn sec" data-to="files">Files</button><span class="mini">${MODI.agents ? 'The plan loads from the Agent Desk, which asks before it replaces what the desk holds. ' : ''}A plan is a plan: nothing is bought.</span></div>`;
      const wireCommon = () => { qa('[data-desk]', view).forEach(b => { b.onclick = () => toDesk(BY[b.dataset.desk]); }); qa('[data-desk-open]', view).forEach(b => { b.onclick = () => showModule('agents', { open: b.dataset.deskOpen }); }); qa('[data-to]', view).forEach(b => { b.onclick = () => go(b.dataset.to); }); };

      /* ----- the campaigns at a glance, and one in full ----- */
      function overview() {
        const c = cur(), P = c.P, plan = obj(P.plan), s = obj(P.summary), T = totalsOf(c), h = obj(s.heat), fl = arr(s.flight).filter(f => !f.stub);
        const row = (l, v) => `<div class="rowl"><span>${l}</span><b>${v}</b></div>`;
        view.innerHTML = `${callout('note', 'Nothing here is live', 'Every campaign and every ad in the files is paused. Ad groups, keywords and assets inside them are enabled and serve nothing until a person switches the campaign on. The budgets are a proposal for the owner to set. The forecasts are the Campaign Desk\'s own benchmarks, graded C and D: a starting point, not a promise.')}
          <div class="kpis lvs-kpis">${kpiHTML([{ l: 'Campaigns', v: N(CAMPS.length), d: 'each with a landing page of its own' }, { l: 'Proposed media', v: money(SUM.budget), d: 'a month across all of them' }, { l: 'Search', v: N(SUM.groups), d: `ad groups, ${N(SUM.keywords)} keywords` }, { l: 'Meta ads', v: N(SUM.meta), d: 'Facebook and Instagram feed' }, { l: 'Leads a month', v: N(SUM.leads), d: `${N(SUM.booked)} booked jobs, by the desk's benchmarks` }, { l: 'To confirm', v: N(arr(DATA.confirm).length), d: 'items for the owner before launch' }])}</div>
          <div class="card"><div class="card-h"><h3>The campaigns at a glance</h3><p>Choose a row to see that campaign in full below.</p></div><div class="card-b"><div class="xscroll"><table class="lvs-t"><thead><tr><th class="l">Campaign</th><th>A month</th><th class="l">Where the money goes</th><th>ZIPs</th><th>Weeks</th><th>Ad groups</th><th>Keywords</th><th>Meta ads</th><th>Leads</th><th>Booked</th><th>Cost a booked job</th><th class="l">Landing page</th></tr></thead><tbody>${CAMPS.map((x, i) => { const t = totalsOf(x); return `<tr class="click${x.id === ST.sel ? ' on' : ''}" data-c="${esc(x.id)}" tabindex="0"><td class="l"><b>${i + 1}. ${esc(x.label)}</b></td><td>${money(x.P.plan.budget)}</td><td class="l">${esc(splitText(x))}</td><td>${N(arr(x.P.plan.picks).length)}</td><td>${N(x.P.plan.weeks)}</td><td>${N(groupsOf(x).length)}</td><td>${N(keywordsOf(x))}</td><td>${N(metaOf(x).length)}</td><td>${isN(t.leads) ? N(t.leads) : '—'}</td><td>${isN(t.booked) ? N(t.booked) : '—'}</td><td>${money(t.costPerBooked)}</td><td class="l mono">${esc(x.lp ? '/' + x.lp + '/' : '')}</td></tr>`; }).join('')}<tr class="lvs-sum"><td class="l"><b>All ${N(CAMPS.length)}</b></td><td><b>${money(SUM.budget)}</b></td><td></td><td></td><td></td><td><b>${N(SUM.groups)}</b></td><td><b>${N(SUM.keywords)}</b></td><td><b>${N(SUM.meta)}</b></td><td><b>${N(SUM.leads)}</b></td><td><b>${N(SUM.booked)}</b></td><td></td><td></td></tr></tbody></table></div><p class="mini lvs-hint">Each ad group carries 15 headlines and 4 descriptions, with the license line pinned to the first description. Leads and booked jobs are a month's figures for each plan as the Campaign Desk reckons them.</p>${OTHERS.length && MODI.agents ? `<p class="mini lvs-hint">Also on the Agent Desk, and not laid out here: ${OTHERS.map(b => `<button type="button" class="lnk" data-desk-open="${esc(b.id)}">${esc(b.title || b.id)}</button>`).join('; ')}.</p>` : ''}</div></div>
          <div class="card"><div class="card-h"><h3>${esc(c.label)}</h3><p>${esc(c.b.title || '')}</p></div><div class="card-b">${deskRow(c)}
            <div class="lvs-two lvs-plan"><div>
              ${row('Service line on the desk', esc(s.lineLabel || plan.line || ''))}
              ${row('Flight', `${N(plan.weeks)} weeks from ${esc(plan.start || '')}${s.end ? ' to ' + esc(s.end) : ''}`)}
              ${row('Budget', `${money(plan.budget)} a month, ${money(plan.budget / 30.4)} a day flat`)}
              ${row('A booked job', `${money(plan.jobVal)}, with ${N(plan.bookRate)}% of leads booked`)}
              ${isN(T.leads) ? row('Forecast a month', `${N(T.leads)} leads, ${N(T.booked)} booked jobs`) : ''}
              ${isN(T.costPerBooked) ? row('Cost a booked job', `${money(T.costPerBooked)}${isN(T.target) ? `, target ${money(T.target)}` : ''}`) : ''}
              ${row('Markets', `${plural(arr(plan.picks).length, 'ZIP code')}${arr(P.markets).length ? `, ${N(Math.max(...P.markets.map(m => +m.minutes || 0)))} minutes at the farthest` : ''}`)}
              ${c.google ? row('Name in Google Ads Editor', `<span class="mono lvs-name">${esc(c.google)}</span>`) : ''}
            </div><div>
              <div class="xscroll"><table class="lvs-t"><thead><tr><th class="l">Platform</th><th>Share</th><th>A month</th><th class="l">What it runs</th></tr></thead><tbody>${mixOf(c).map(m => `<tr><td class="l"><b>${esc(m.label)}</b></td><td>${N(m.share)}%</td><td>${money(m.spend)}</td><td class="l">${m.k === 'google' ? `${plural(groupsOf(c).length, 'ad group')}, ${plural(keywordsOf(c), 'keyword')}` : m.k === 'meta' ? plural(metaOf(c).length, 'feed ad') : m.k === 'lsa' ? 'the Local Services profile, by its build sheet' : ''}</td></tr>`).join('')}</tbody></table></div>
              ${fl.length > 1 ? `<p class="mini lvs-hint">The season would have the daily budget run ${fl.map(f => `${esc(f.month)} ${money(f.daily)}`).join(', ')}${s.pacedBy ? ` (${esc(s.pacedBy)})` : ''}. The files carry the flat figure.</p>` : ''}
              ${h.month ? callout('note tight', 'The Heat Desk', `The Heat Desk reckoned its own plan for ${esc(String(h.month))} (${N(h.zips)} ZIPs, ${money(h.spent)}) at ${N(h.leads)} leads and ${N(h.jobs)} booked jobs, ${money(h.costPerJob)} a job${h.grade ? ` (grade ${esc(String(h.grade))})` : ''}. It weighs drive time, cold and competition by ZIP, which the Campaign Desk does not, so for heating it is the better guide.${h.same === false ? ' This campaign changed that plan, so the figure is a reference.' : ''}${MODI.heat ? ' <button type="button" class="lnk" data-go="heat">Open the Heat Desk</button>' : ''}`) : ''}
            </div></div>
            ${arr(P.markets).length ? `<div class="xscroll lvs-tall"><table class="lvs-t"><thead><tr><th class="l">ZIP</th><th class="l">City</th><th class="l">County</th><th>Minutes from the shop</th><th>Bid</th><th>Desk $ a month</th><th class="l">Spanish</th></tr></thead><tbody>${P.markets.map(m => `<tr><td class="l mono">${esc(m.zip)}</td><td class="l">${esc(m.city)}</td><td class="l">${esc(m.county)}</td><td>${isN(m.minutes) ? N(m.minutes) : ''}</td><td>${isN(m.bid) ? (m.bid > 0 ? '+' : m.bid < 0 ? '−' : '') + N(Math.abs(m.bid)) + '%' : ''}</td><td>${money(m.spend)}</td><td class="l">${m.es ? 'yes' : ''}</td></tr>`).join('')}</tbody></table></div><p class="mini lvs-hint">Minutes are from the shop by the Heat Desk's rule of thumb. Dollars by ZIP are the desk's own weighting, a planning view: a search campaign has one budget and the bid adjustments steer it.</p>` : ''}
          </div></div>`;
        qa('tr[data-c]', view).forEach(tr => { const pick = () => { ST.sel = tr.dataset.c; save(); overview(); }; tr.onclick = pick; tr.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } }; });
        wireCommon();
      }

      /* ----- every ad, the way it shows ----- */
      function ads() {
        const c = cur(), P = c.P, lic = obj(P.plan).lic || '', out = [];
        const line = (t, max, pin) => `<div class="lvs-line"><span>${esc(t)}</span><span class="mini${max && len(t) > max ? ' lvs-over' : ''}">${pin ? `pinned ${pin} · ` : ''}${len(t)}${max ? '/' + max : ''}</span></div>`;
        for (const s of arr(P.search)) {
          out.push(`<h4 class="lvs-h">Google Search ads${s.lang === 'es' ? ' · Spanish' : ''}${c.google ? ` <span class="mono mini">${esc(c.google)}</span>` : ''}</h4>`);
          const sn = s.snippets && typeof s.snippets === 'object' ? s.snippets : null;
          out.push(`<div class="lvs-assets">${arr(s.callouts).length ? `<div><div class="fl">Callouts</div>${s.callouts.map(x => `<span class="tag">${esc(txt(x))}</span>`).join('')}</div>` : ''}${sn ? `<div><div class="fl">Structured snippet: ${esc(sn.header || '')}</div>${arr(sn.values).map(x => `<span class="tag">${esc(x)}</span>`).join('')}</div>` : ''}${arr(s.sitelinks).length ? `<div class="lvs-wide"><div class="fl">Sitelinks</div><div class="lvs-links">${s.sitelinks.map(x => `<div><b>${esc(x.text)}</b><span>${esc([x.d1, x.d2].filter(Boolean).join(' · '))}</span><span class="mono mini">${esc(x.path || '')}</span></div>`).join('')}</div></div>` : ''}${arr(s.negatives).length ? `<div class="lvs-wide"><details><summary class="mini">${plural(s.negatives.length, 'negative keyword')}, so the ads stay off searches the business does not want</summary><p class="mini">${esc(s.negatives.join(', '))}</p></details></div>` : ''}</div>`);
          for (const g of arr(s.adGroups)) {
            const ad = obj(g.ad), H = arr(ad.headlines), D2 = arr(ad.descriptions), texts = H.concat(D2).map(txt).filter(Boolean), kws = [...new Set(arr(g.keywords).map(k => k.text))];
            out.push(`<div class="lvs-group"><div class="lvs-gh"><h5>${esc(g.name || '')}</h5><span class="mini">${plural(arr(g.keywords).length, 'keyword')} · ${plural(H.length, 'headline')} · ${plural(D2.length, 'description')}</span><span class="lvs-flags">${flags(screen(texts, 'google', lic, true))}</span></div>
              <div class="lvs-two"><div>
                <div class="lvs-serp"><div class="lvs-sp">Sponsored</div><div class="lvs-site"><span class="lvs-fav" aria-hidden="true">${esc(brandName().slice(0, 1))}</span><div><div class="lvs-sn">${esc(brandName())}</div><div class="lvs-su">${esc(host)}${ad.path1 ? '/' + esc(ad.path1) : ''}${ad.path2 ? '/' + esc(ad.path2) : ''}</div></div></div><div class="lvs-st">${H.slice(0, 3).map(h => esc(txt(h))).join(' <i>|</i> ')}</div><div class="lvs-sd">${D2.slice(0, 2).map(d => esc(txt(d))).join(' ')}</div></div>
                <p class="mini lvs-hint">One of many mixes Google can show. It picks 2 or 3 headlines and 1 or 2 descriptions from the lists beside this.</p>
                <div class="fl lvs-gap">Lands on</div><div class="mono lvs-url">${esc(ad.url || '')}</div>
                <div class="fl lvs-gap">Keywords, each as exact and as phrase match</div><div class="mini">${kws.map(k => esc(k)).join(' · ')}</div>
              </div><div><div class="fl">Headlines · 30 characters at most</div>${H.map(h => line(txt(h), 30, pinOf(h))).join('')}<div class="fl lvs-gap">Descriptions · 90 characters at most</div>${D2.map(d => line(txt(d), 90, pinOf(d))).join('')}</div></div></div>`);
          }
        }
        const meta = metaOf(c), other = arr(P.ads).filter(a => a && a.channel !== 'meta');
        if (meta.length) out.push(`<h4 class="lvs-h">Meta ads <span class="mini">Facebook and Instagram feed</span></h4><div class="lvs-feed">${meta.map(a => `<div class="lvs-post"><div class="lvs-ph"><span class="lvs-fav" aria-hidden="true">${esc(brandName().slice(0, 1))}</span><div><div class="lvs-sn">${esc(brandName())}</div><div class="mini">Sponsored${a.lang === 'es' ? ' · Spanish' : ''}</div></div></div><div class="lvs-pp">${esc(a.primary || '')}</div><div class="lvs-media"><span>Photo or video goes here</span><b>${esc(a.name || '')}</b></div><div class="lvs-pf"><div><div class="lvs-dom">${esc(host.replace(/^www\./, ''))}</div><div class="lvs-hl">${esc(a.headline || '')}</div><div class="mini">${esc(a.description || '')}</div></div><span class="lvs-cta">${esc(a.cta || '')}</span></div><div class="lvs-meta"><span class="mini">Primary text ${N(len(a.primary || ''))} characters · headline ${N(len(a.headline || ''))} · lands on ${esc(a.url || '')}</span> ${flags(screen([a.primary, a.headline, a.description].filter(Boolean), 'meta', lic, false))}</div></div>`).join('')}</div>`);
        if (other.length) out.push(`<h4 class="lvs-h">Other channels</h4>${other.map(a => `<div class="lvs-group"><div class="lvs-gh"><h5>${esc(a.channel === 'lsa' ? 'Local Services Ads' : a.channel || '')}</h5><span class="mini">${esc(a.name || a.format || '')}</span></div>${Object.entries(obj(a)).filter(([k]) => !['channel', 'format', 'angle', 'lang', 'name', 'url', 'cta', 'seconds', 'jobTypes'].includes(k)).map(([k, v]) => `<div class="fl lvs-gap">${esc(k)}</div>${(Array.isArray(v) ? v : [v]).map(txt).filter(Boolean).map(t => line(t, 0, 0)).join('')}`).join('')}${arr(a.jobTypes).length ? `<div class="fl lvs-gap">Job types</div><div class="mini">${esc(a.jobTypes.join(', '))}</div>` : ''}</div>`).join('')}`);
        view.innerHTML = `${picker()}<div class="card"><div class="card-h"><h3>${esc(c.label)}: the ad copy</h3><p>${esc(c.b.title || '')}</p></div><div class="card-b">
          <p class="mini lvs-lead">Every ad as written, so it can be approved or marked up.${typeof satchelLint === 'function' ? ' Each one is screened here, as you read it, by this dashboard\'s own advertising rules, the ones the Emergency Satchel runs: hover a flag for what it found.' : ''} The review score in the copy (${esc(obj(DATA.reviews).line || '')}) is filled in from one figure on file, not typed.</p>
          ${out.join('') || '<p class="mini">This campaign carries a plan and no copy.</p>'}</div></div>`;
        wirePick();
      }

      /* ----- the landing page each campaign sends its clicks to ----- */
      let sent = null;
      function pages() {
        const c = cur(), p = c.page, have = window.IACC ? IACC.publishHas() : new Set(), all = CAMPS.filter(x => x.page);
        if (!p) { view.innerHTML = picker() + callout('note', 'No landing page on file', 'This campaign came without a page of its own.'); wirePick(); return; }
        view.innerHTML = `${picker()}
          <div class="card"><div class="card-h"><h3>${esc(p.h1 || p.title)}</h3><p>The page the ${esc(c.label.toLowerCase())} ads land on. Built by Dr. HVAC in this dashboard, with the request form, the license notice and the business schema.</p></div><div class="card-b">
            <div class="kpis lvs-kpis">${kpiHTML([{ l: 'Address', v: `<span class="mono lvs-addr">/${esc(p.slug)}/</span>`, d: p.noindex ? 'a draft, marked noindex' : 'indexable' }, { l: 'Dr. HVAC page check', v: `${N(p.score)}${p.grade ? ' <span class="lvs-grade">' + esc(p.grade) + '</span>' : ''}`, d: 'no blocking finding' }, { l: 'Words', v: N(p.words), d: 'on the page' }, { l: 'Sources linked', v: N(arr(p.sources).length), d: arr(p.sources).length ? 'Census tables, each opens in another tab' : 'the page names no outside source' }, { l: 'In Publish now', v: have.has(p.slug) ? 'Yes' : 'No', d: have.has(p.slug) ? 'as a draft' : 'not sent yet' }])}</div>
            <div class="lvs-row"><button type="button" class="btn" id="lvsSend">${have.has(p.slug) ? 'Send this page to Publish again' : 'Send this page to Publish as a draft'}</button><button type="button" class="btn sec" id="lvsSendAll">Send all ${N(all.length)} landing pages</button><button type="button" class="btn sec" id="lvsSave">↓ Save the page file</button>${MODI.publish ? '<button type="button" class="btn sec" data-go="publish">Open Publish</button>' : ''}<span class="mini">Pages land as drafts in this dashboard. Publish sends nothing to a site on its own.</span></div>
            <div id="lvsSent">${sent || ''}</div>
            ${arr(p.sources).length ? `<p class="mini lvs-hint">Where the page says “Census figures”, the words link to the Census Bureau's own table: ${[...new Map(p.sources.map(s => [s.url, s])).values()].map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc((/B\d{5}/.exec(s.url) || ['the table'])[0])}</a>`).join(', ')}. Lines that say “by one estimate” have no link: the dashboard works those out itself.</p>` : ''}
            <div class="lvs-row lvs-row0"><span class="fl">Preview</span><div class="seg" id="lvsWidth"><button type="button" data-v="desktop" aria-pressed="${String(ST.width === 'desktop')}">Desktop</button><button type="button" data-v="phone" aria-pressed="${String(ST.width === 'phone')}">Phone</button></div><span class="mini">${esc(p.title)}</span></div>
            <div class="lvs-stage"><iframe class="lvs-frame${ST.width === 'phone' ? ' lvs-phone' : ''}" sandbox="" title="Preview of the ${esc(c.label)} landing page" loading="lazy"></iframe></div>
            <p class="mini lvs-hint">The preview is the page file itself in a sealed frame: links and the form do nothing here. The brand styling rides inside the page. The fonts and the logo load from the web, so they need a connection.</p>
          </div></div>`;
        q('iframe', view).srcdoc = pageDoc(p);
        wirePick();
        qa('#lvsWidth button', view).forEach(b => { b.onclick = () => { ST.width = b.dataset.v; save(); pages(); }; });
        const fileOf = x => ({ name: x.slug + '.html', slug: x.slug, text: pageDoc(x) });
        const send = async list => { if (!window.IACC) return; qa('#lvsSend,#lvsSendAll', view).forEach(b => { b.disabled = true; }); const r = await IACC.publishHtml(list.map(fileOf)); sent = callout(r.ok ? 'lvs-ok' : 'judg', r.ok ? 'In Publish, as drafts' : 'Publish did not take all of it', r.ok ? `Publish lists ${list.length === 1 ? `<span class="mono">/${esc(list[0].slug)}/</span>` : `all ${N(list.length)} landing pages`} now. Nothing reaches the site until you choose a target there and send it. Publish keeps pages only while the dashboard is open, so send them again after it is closed or reloaded.` : esc(r.why || 'No answer from Publish.')); toast(r.ok ? `${plural(list.length, 'page')} in Publish, as ${list.length === 1 ? 'a draft' : 'drafts'}` : 'Publish did not take the pages'); if (ST.view === 'pages') pages(); };
        q('#lvsSend', view).onclick = () => send([p]);
        q('#lvsSendAll', view).onclick = () => send(all.map(x => x.page));
        q('#lvsSave', view).onclick = () => saveFile(p.slug + '.html', pageDoc(p));
      }

      /* ----- what the owner has to confirm before anything goes live ----- */
      function confirm() {
        const R = obj(DATA.reviews), N2 = obj(DATA.notes);
        view.innerHTML = `${callout('judg', 'Before anything goes live', 'The strategist will not vouch for a claim on its own. Each line below is in the ads or on the pages because it is on file or because someone asked for it. Confirm what is true, in its own terms, and say what to cut. Every campaign stays paused until a person switches it on.')}
          <div class="card"><div class="card-h"><h3>For the owner to confirm</h3><p>${plural(arr(DATA.confirm).length, 'item')}, across all ${N(CAMPS.length)} campaigns and their pages.</p></div><div class="card-b"><div class="xscroll"><table class="prose lvs-todo"><thead><tr><th class="l">What</th><th class="l">What the ads and pages say, and what to confirm</th></tr></thead><tbody>${arr(DATA.confirm).map(x => `<tr><td><b>${esc(x.t)}</b></td><td>${esc(x.d)}</td></tr>`).join('')}</tbody></table></div></div></div>
          <div class="card"><div class="card-h"><h3>Campaign by campaign</h3><p>What to check before each one is switched on, and how to run it after. From each campaign's own notes.</p></div><div class="card-b">${CAMPS.map((c, i) => `<details class="lvs-det"${c.id === ST.sel ? ' open' : ''}><summary><b>${i + 1}. ${esc(c.label)}</b> <span class="mini">${plural(arr(c.P.before).length, 'check')} before launch · ${plural(arr(c.P.running).length, 'note')} on running it</span></summary>${arr(c.P.before).length ? `<h4 class="lvs-h">Before anything is switched on</h4><ul class="lvs-ul">${c.P.before.map(x => `<li>${md(String(x))}</li>`).join('')}</ul>` : ''}${arr(c.P.running).length ? `<h4 class="lvs-h">Running it</h4><ul class="lvs-ul">${c.P.running.map(x => `<li>${md(String(x))}</li>`).join('')}</ul>` : ''}</details>`).join('')}
            <p class="mini lvs-hint">Where a note names <span class="mono">report.json</span> or <span class="mono">handoff.json</span>: those two files did not come with the campaign folders, so they are not under Files. Everything else a note names is.</p></div></div>
          <div class="card"><div class="card-h"><h3>The Google review score</h3><p>One figure on file, filled in everywhere: ${esc(R.line || '')}${R.asOf ? `, as of ${esc(R.asOf)}` : ''}.</p></div><div class="card-b"><p class="mini lvs-lead">Nobody types the score into a page or an ad. The copy carries a token and each build fills it from the one figure on file, so a change is made once.</p>${N2.reviews ? `<details class="lvs-det"><summary><b>How the figure is kept accurate</b> <span class="mini">the strategist's note</span></summary><pre class="lvs-pre">${esc(N2.reviews)}</pre></details>` : ''}</div></div>`;
      }

      /* ----- every file, for the ads person and the web person ----- */
      const allFiles = () => { const out = [{ name: 'heating-campaigns/FROM-THE-COMMAND-CENTER.txt', data: 'Saved from the Paid Ads Strategist module of the Integrity Air Conditioning & Heating Command Center.\n\nIn this zip: READ-ME-FIRST.txt and REVIEW-SCORE-TEMPLATE.txt as the strategist wrote them, campaign-files/ (one folder a campaign),\npages/ (the six landing pages) and page-files/ (each page\'s parts, for the web person).\n\nNot in this zip: ad-copy-for-review.html and the pictures/ folder that READ-ME-FIRST.txt names. The module shows the same ads\nand the same pages live, under Ad copy and Landing pages.\n' }]; const N2 = obj(DATA.notes); if (N2.readme) out.push({ name: 'heating-campaigns/READ-ME-FIRST.txt', data: N2.readme }); if (N2.reviews) out.push({ name: 'heating-campaigns/REVIEW-SCORE-TEMPLATE.txt', data: N2.reviews }); CAMPS.forEach(c => arr(c.P.files).forEach(f => { if (f && f.text != null) out.push({ name: `heating-campaigns/campaign-files/${fileName(c.id)}/${f.name}`, data: f.text }); })); CAMPS.forEach(c => { if (c.page) out.push({ name: `heating-campaigns/pages/${c.page.slug}.html`, data: pageDoc(c.page) }); }); arr(DATA.pageFiles).forEach(f => out.push({ name: 'heating-campaigns/' + f.name, data: f.text })); return out; };
      function files() {
        const c = cur(), fs = arr(c.P.files), mine = arr(DATA.pageFiles).filter(f => c.lp && f.name.indexOf('/' + c.lp + '/') > 0);
        view.innerHTML = `${picker()}
          <div class="card"><div class="card-h"><h3>${esc(c.label)}: files for the ad accounts</h3><p>Everything the strategist built for this campaign. Every campaign and every ad in the files is paused; nothing was sent to any ad account.</p></div><div class="card-b"><div class="lvs-row lvs-row0"><button type="button" class="btn sec" id="lvsZip">↓ This campaign as one .zip</button>${MODI.agents ? `<button type="button" class="btn sec" data-desk="${esc(c.id)}">Open it on the Agent Desk</button>` : ''}</div>
            <div class="xscroll"><table class="prose"><thead><tr><th class="l">File</th><th class="l">What it is for</th><th></th></tr></thead><tbody>${fs.map((f, i) => `<tr><td class="mono">${esc(f.name)}</td><td>${esc(f.what || '')}</td><td class="lvs-r">${f.text != null ? `<button type="button" class="btn sm sec" data-file="${i}">↓ Save</button>` : ''}</td></tr>`).join('')}</tbody></table></div></div></div>
          ${c.page ? `<div class="card"><div class="card-h"><h3>${esc(c.label)}: files for the website</h3><p>The landing page as one file, and its parts for the web person: the section markup, the schema, the check results and the blueprint Dr. HVAC compiled. One stylesheet serves all the landing pages.</p></div><div class="card-b"><div class="xscroll"><table class="prose"><thead><tr><th class="l">File</th><th class="l">What it is</th><th></th></tr></thead><tbody><tr><td class="mono">pages/${esc(c.page.slug)}.html</td><td>The whole page, with its styling inside it. Open it in a browser, or drop it on Publish's import box.</td><td class="lvs-r"><button type="button" class="btn sm sec" id="lvsPageFile">↓ Save</button></td></tr>${mine.map(f => `<tr><td class="mono">${esc(f.name)}</td><td>${esc(/blueprint/.test(f.name) ? 'The blueprint Dr. HVAC compiled the page from.' : /schema/.test(f.name) ? 'The page\'s JSON-LD: the business, the page and the service.' : /checks/.test(f.name) ? 'What Dr. HVAC\'s page check measured, for the source and for the finished page.' : 'The section markup alone, for a page builder.')}</td><td class="lvs-r"><button type="button" class="btn sm sec" data-pf="${esc(f.name)}">↓ Save</button></td></tr>`).join('')}<tr><td class="mono">page-files/landing-page-styles.css</td><td>The one stylesheet all the landing pages share.</td><td class="lvs-r"><button type="button" class="btn sm sec" data-pf="page-files/landing-page-styles.css">↓ Save</button></td></tr></tbody></table></div></div></div>` : ''}`;
        wirePick(); wireCommon();
        qa('[data-file]', view).forEach(b => { b.onclick = () => { const f = fs[+b.dataset.file]; if (f && f.text != null) saveFile(f.name, f.text); }; });
        qa('[data-pf]', view).forEach(b => { b.onclick = () => { const f = arr(DATA.pageFiles).find(x => x.name === b.dataset.pf); if (f) saveFile(f.name.split('/').pop(), f.text); }; });
        const pf = q('#lvsPageFile', view); if (pf) pf.onclick = () => saveFile(c.page.slug + '.html', pageDoc(c.page));
        q('#lvsZip', view).onclick = () => { const list = fs.filter(f => f && f.text != null).map(f => ({ name: f.name, data: f.text })); if (c.page) list.push({ name: `landing-page/${c.page.slug}.html`, data: pageDoc(c.page) }); if (list.length) saveFile(fileName(c.id) + '.zip', zipBlob(list)); };
      }
      const all = q('#lvsAll', root); if (all) all.onclick = () => saveFile('heating-campaigns.zip', zipBlob(allFiles()));

      /* for other modules and for the checks that drive this page */
      self.receive = p => { if (p && (BY[p.open] || p.view)) go(p.view || ST.view, p.open); };
      self.show = (v, id) => go(v, id);
      self.files = () => allFiles().map(f => ({ name: f.name, bytes: f.data.length }));
      self.sendPages = () => (window.IACC ? IACC.publishHtml(CAMPS.filter(c => c.page).map(c => ({ name: c.page.slug + '.html', slug: c.page.slug, text: pageDoc(c.page) }))) : Promise.resolve({ ok: false, why: 'no door to Publish' }));
      /* coming back from Publish, the landing page view says what Publish holds now */
      let fresh = true; self.onShow = () => { if (fresh) { fresh = false; return; } if (ST.view === 'pages') pages(); };
      go(ST.view);
    },
  });
})();
