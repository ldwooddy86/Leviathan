      /* ----- the pages the agent has built ----- */
      /* Two sets ride in this file. The city pages are blueprints on the Agent Desk (#lvp-data), compiled by Publish's
         own compiler. The heating pages for the service areas are whole page files, packed (#lvc-heat: gzip, base64) and
         unpacked once, the first time they are looked at; each comes back out byte for byte as the strategist wrote it.
         Either set goes to Publish through Publish's own import box, as drafts. A page is only ever drawn in a sealed
         frame. */
      const PV = (() => { const k = obj(store.get('lv.strategist.pages.v1', {})); return { set: k.set === 'heat' ? 'heat' : 'city', svc: typeof k.svc === 'string' ? k.svc : '', dem: typeof k.dem === 'string' ? k.dem : '', find: '', sel: '', csel: '', width: k.width === 'phone' ? 'phone' : 'desktop', sent: '', csent: '' }; })();
      const pvSave = () => store.set('lv.strategist.pages.v1', { set: PV.set, svc: PV.svc, dem: PV.dem, width: PV.width });
      let HEATP = null;
      const heatPages = () => HEATP || (HEATP = (async () => {
        const n = document.getElementById('lvc-heat'); if (!n) throw new Error('The heating pages are not in this file.');
        if (typeof DecompressionStream !== 'function') throw new Error('This browser cannot unpack them. A current Chrome, Edge, Firefox or Safari can.');
        const bin = atob(n.textContent.trim()), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        const H = JSON.parse(await new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream('gzip'))).text());
        if (!H || H.format !== 'integrity.heating-pages' || !Array.isArray(H.rows)) throw new Error('What is packed in this file is not the heating pages.');
        return H;
      })());
      const DEMAND = { found: 'Demand found', low: 'Low demand', none: 'No figures on file' };
      const frame = (cls, label) => `<div class="lvc-stage"><iframe class="lvc-frame${PV.width === 'phone' ? ' lvc-phone' : ''} ${cls || ''}" sandbox="" title="${esc(label)}"></iframe></div>`;
      const widthSeg = id => `<div class="seg" id="${id}"><button type="button" data-v="desktop" aria-pressed="${String(PV.width === 'desktop')}">Desktop</button><button type="button" data-v="phone" aria-pressed="${String(PV.width === 'phone')}">Phone</button></div>`;
      const inPublish = () => (window.IACC ? IACC.publishHas() : new Set());

      function pages() {
        const B = arr(S.built), hs = obj(S.heat), cp = obj(S.cityPages), kinds = obj(obj(S.site).kinds), bp = blueprints(), links = obj(hs.links);
        view.innerHTML = `<div class="kpis lvc-kpis">${kpiHTML([{ l: 'Built by the agent', v: N(B.length + (hs.pages || 0)), d: 'passed the gate, not yet live' }, { l: 'City pages, rewritten', v: N(B.length), d: bp.length ? 'ready for Publish, with their schema' : 'none carried in this file' }, { l: 'Heating pages', v: N(hs.pages || 0), d: `${N(arr(hs.services).length)} services across ${N(hs.cities || 0)} cities` }, { l: 'Sources linked', v: N((cp.sources || 0) + (links.toSources || 0)), d: 'each opens in another tab' }, { l: 'Live on the site', v: N(obj(S.site).pages || 0), d: Object.entries(kinds).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${v} ${k}`).join(' · ') }])}</div>
          <div class="seg lvc-sets" id="lvcSets" role="tablist" aria-label="Page sets"><button type="button" data-v="city" aria-pressed="${String(PV.set === 'city')}">City pages, rewritten (${N(B.length)})</button><button type="button" data-v="heat" aria-pressed="${String(PV.set === 'heat')}">Heating pages for every service area (${N(hs.pages || 0)})</button></div>
          <div id="lvcSet"></div>`;
        qa('#lvcSets button', view).forEach(b => { b.onclick = () => { PV.set = b.dataset.v; pvSave(); pages(); }; });
        (PV.set === 'heat' && hs.pages ? heatSet : citySet)(q('#lvcSet', view));
      }

      /* the 70 city pages: what the gate measured, a preview compiled the way Publish compiles it, and the way in */
      function citySet(host) {
        const B = arr(S.built), bp = blueprints(), cp = obj(S.cityPages);
        if (!B.length) { host.innerHTML = callout('note', 'Nothing built yet', 'Put works in an order on the Plan view and give the request to the content strategist agent. The pages it builds come back here.'); return; }
        const docOf = slug => { const b = bp.find(p => p.page.slug === slug); if (!b || typeof FORGE_COMPILE === 'undefined' || typeof CMS === 'undefined') return null; const r = FORGE_COMPILE.compile(b, {}), p = CMS.pageFromForge(b, r, {}, { label: 'preview', kind: 'blueprint' }); return CMS.fullHtml(Object.assign({}, p, { html: CMS.stripScripts(p.html) })); };
        host.innerHTML = `<div class="card"><div class="card-h"><h3>City pages, rewritten</h3><p>The ${N(B.length)} city pages under /service-area/, each rewritten from that city's own figures. Each passed the gate: reading grade, active voice, a homeowner's voice, live links, valid schema.${cp.sources ? ` Every named source is linked: ${N(cp.sources)} links${cp.census ? `, ${N(cp.census)} of them to the Census Bureau's own tables` : ''}, each opening in another tab.` : ''}</p></div><div class="card-b"><div class="lvc-row">${bp.length ? '<button type="button" class="btn" id="lvcSend">Send them to Publish as drafts</button>' : ''}${MODI.agents ? '<button type="button" class="btn sec" data-go="agents">Open the Agent Desk</button>' : ''}${MODI.publish ? '<button type="button" class="btn sec" data-go="publish">Open Publish</button>' : ''}</div><div id="lvcSent">${PV.csent}</div><p class="mini">Choose a row to read the page as Publish will compile it.</p><div class="xscroll lvc-scroll" id="lvcPages"></div></div></div><div id="lvcCityPrev"></div>`;
        const prev = () => {
          const at = q('#lvcCityPrev', host), p = B.find(x => x.slug === PV.csel); if (!at) return; if (!p) { at.innerHTML = ''; return; }
          let doc = null, err = ''; try { doc = docOf(p.slug); } catch (e) { err = String(e && e.message || e); }
          at.innerHTML = `<div class="card"><div class="card-h"><h3>${esc(p.title || p.slug)}</h3><p><span class="mono">${esc(pathOf(p.url))}</span> · ${esc(p.keyword || '')} · ${N(p.words)} words · reading grade ${esc(String(p.grade))}</p></div><div class="card-b">${doc ? `<div class="lvc-row lvc-row0"><span class="fl">Preview</span>${widthSeg('lvcCityW')}<button type="button" class="btn sm sec" id="lvcCitySave">↓ Save as a page file</button><button type="button" class="btn sm ghost" id="lvcCityClose">Close</button></div>${frame('', 'Preview of ' + (p.title || p.slug))}<p class="mini">Compiled here by the Site Forge's compiler, the one Publish uses, and drawn in a sealed frame. The site's own header, footer and theme wrap it after publishing.</p>` : callout('note', 'No preview here', esc(err || 'This build cannot compile the page on its own. Send it to Publish and preview it there.'))}</div></div>`;
          if (!doc) return; q('iframe', at).srcdoc = doc;
          qa('#lvcCityW button', at).forEach(b => { b.onclick = () => { PV.width = b.dataset.v; pvSave(); prev(); }; });
          q('#lvcCitySave', at).onclick = () => saveFile(p.slug + '.html', doc); q('#lvcCityClose', at).onclick = () => { PV.csel = ''; draw(); prev(); };
        };
        const draw = () => table(q('#lvcPages', host), [{ k: 'city', h: 'City', l: 1 }, { k: 'title', h: 'Page', l: 1, f: p => `${esc(p.title || p.slug)}<br><span class="mono mini">${esc(pathOf(p.url))}</span>` }, { k: 'keyword', h: 'Keyword', l: 1, f: p => `<span class="mono lvc-kw">${esc(p.keyword)}</span>` }, { k: 'words', h: 'Words' }, { k: 'grade', h: 'Reading grade' }], B, { sort: 'city', dir: 1, limit: 80, onMore: () => { }, id: p => p.slug, sel: p => p.slug === PV.csel, onRow: slug => { PV.csel = PV.csel === slug ? '' : slug; draw(); prev(); if (PV.csel) { const n = q('#lvcCityPrev', host); if (n && n.scrollIntoView) n.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } } });
        draw(); prev();
        const send = q('#lvcSend', host); if (send) send.onclick = async () => { send.disabled = true; const r = await toPublish(bp); send.disabled = false; PV.csent = callout(r.ok ? 'lvc-ok' : 'judg', r.ok ? 'In Publish, as drafts' : 'Publish did not take them', `${esc(r.why || '')}${r.ok ? ' Nothing reaches the site until you choose a target in Publish and send it. Publish keeps pages only while the dashboard is open.' : ''}${r.ok && MODI.publish ? ' <button type="button" class="lnk" data-go="publish">Open Publish</button>' : ''}`); const n = q('#lvcSent', host); if (n) n.innerHTML = PV.csent; };
      }

      /* the heating pages: every city against every heating service, each cell a page */
      function heatSet(host) {
        host.innerHTML = '<div class="card"><div class="card-b"><p class="mini">Unpacking the heating pages…</p></div></div>';
        heatPages().then(H => { if (PV.set === 'heat' && q('#lvcSet', view) === host) drawHeat(host, H); }, e => { HEATP = null; host.innerHTML = callout('', 'The heating pages could not be opened', esc(e && e.message || e)); });
      }
      function drawHeat(host, H) {
        const hs = obj(S.heat), links = obj(hs.links), tables = obj(links.sourceTables), like = Object.values(obj(hs.likeness)).map(x => x && x.typicalPair).filter(isN);
        const written = H.rows.filter(r => r.slug), cities = [...new Set(H.rows.map(r => r.c))], AT = Object.fromEntries(H.rows.map(r => [r.c + '|' + r.s, r])), BYSLUG = Object.fromEntries(written.map(r => [r.slug, r]));
        const SVC = Object.fromEntries(H.services.map(s => [s.id, s.label])), docOf = r => String(H.html[r.slug]).split(H.mark).join(H.css), fileOf = r => ({ name: r.slug + '.html', slug: r.slug, text: docOf(r) });
        const shows = r => (!PV.svc || r.s === PV.svc) && (!PV.dem || r.d === PV.dem), finds = c => { const f = PV.find.trim().toLowerCase(); return !f || c.toLowerCase().includes(f); };
        const inView = () => written.filter(r => shows(r) && finds(r.c));
        if (PV.svc && !SVC[PV.svc]) PV.svc = ''; if (PV.dem && !DEMAND[PV.dem]) PV.dem = ''; if (PV.sel && !BYSLUG[PV.sel]) PV.sel = '';
        host.innerHTML = `${callout('note', 'Before these are published', `Publish in stages, not all ${N(hs.pages)} at once: start with the cities and services where the dashboard finds demand. The ${N(obj(hs.demand).low)} pages marked low are for a service the dashboard sees little demand for in that city; they are written, and they are the last you need. The contact form at the top of every page is your main form (Gravity Forms, form 1) as its own WordPress block, and it has <b>not been tried on the live site</b>: publish one page first and send a test message. The same items wait on the owner as on the campaigns${MODI.paidads ? ': <button type="button" class="lnk" id="lvcToConfirm">see the list</button>' : ''}.`)}
          <div class="kpis lvc-kpis">${kpiHTML([{ l: 'Heating pages', v: N(hs.pages), d: `${N(hs.words)} words; ${N(hs.live)} more left to pages the site already has` }, { l: 'Demand found', v: N(obj(hs.demand).found), d: 'a trigger for that service in that city' }, { l: 'Low demand', v: N(obj(hs.demand).low), d: 'written, and last in line' }, { l: 'No figures on file', v: N(obj(hs.demand).none), d: 'five cities; their pages state none' }, { l: 'Dr. HVAC page check', v: hs.score100 === hs.pages ? '100' : N(hs.score100), d: hs.score100 === hs.pages ? `on all ${N(hs.pages)}, no blocking finding` : `pages scored 100 of ${N(hs.pages)}` }, { l: 'Census links', v: N(links.toSources), d: `on ${N(links.pagesThatCite)} pages: ${Object.keys(tables).join(', ')}` }, { l: 'Shared wording', v: like.length ? Math.round(100 * like.reduce((a, b) => a + b, 0) / like.length) + '%' : '—', d: 'a typical pair of cities, same service' }])}</div>
          <div class="controls">
            <div class="ctl"><label class="fl" for="lvcHSvc">Service</label><select id="lvcHSvc">${options(H.services.map(s => [s.id, s.label]), PV.svc, 'Every heating service')}</select></div>
            <div class="ctl"><label class="fl" for="lvcHDem">Demand in the dashboard</label><select id="lvcHDem">${options(Object.entries(DEMAND), PV.dem, 'Any')}</select></div>
            <div class="ctl"><label class="fl" for="lvcHFind">Find a city</label><input type="search" id="lvcHFind" value="${esc(PV.find)}" placeholder="Plano, Garland, …"></div>
          </div>
          <div class="card"><div class="card-h"><h3>Every city, every heating service</h3><p>Each cell is a page with an address of its own, such as <span class="mono">/heating-repair-plano-tx/</span>. Choose one to read it. <span class="lvc-key"><i class="lvc-cell lvc-found">Open</i> demand found <i class="lvc-cell lvc-low">Low</i> low demand <i class="lvc-cell lvc-none">Open</i> no figures on file <i class="lvc-cell lvc-live">Live ↗</i> the site already has this page</span></p></div><div class="card-b">
            <div class="lvc-row"><button type="button" class="btn" id="lvcHSend"></button><button type="button" class="btn sec" id="lvcHZip"></button><button type="button" class="btn sec" id="lvcHBlocks" title="What to paste into each of the ${N(cities.length)} city pages, so they link down to the new pages">↓ Link blocks for the city pages</button><button type="button" class="btn sec" id="lvcHCsv">↓ Manifest and link sheet</button>${MODI.publish ? '<button type="button" class="btn sec" data-go="publish">Open Publish</button>' : ''}</div>
            <div id="lvcHSent">${PV.sent}</div>
            <div class="lvc-mxwrap" id="lvcMx"></div>
            <p class="mini lvc-more">Every page links up to its city page and to /service-area/, across to that city's other heating pages and to the same service in the cities next door, and to the site's main page for that service: ${N(links.all)} links in all, each checked against the live sitemap and the new set. A check mark means Publish holds the page now.</p>
          </div></div><div id="lvcHPrev"></div>`;
        const mx = q('#lvcMx', host), sendBtn = q('#lvcHSend', host), zipBtn = q('#lvcHZip', host); let armed = false;
        function labels() { const n = inView().length, whole = n === written.length; armed = false; sendBtn.disabled = !n; zipBtn.disabled = !n; sendBtn.textContent = whole ? `Send all ${N(n)} pages to Publish as drafts` : `Send the ${N(n)} ${n === 1 ? 'page' : 'pages'} in view to Publish as drafts`; zipBtn.textContent = whole ? `↓ All ${N(n)} page files (.zip)` : `↓ The ${N(n)} in view (.zip)`; }
        function matrix() {
          const have = inPublish(), svcs = H.services.filter(s => !PV.svc || s.id === PV.svc), rows = cities.filter(finds);
          mx.innerHTML = `<table class="lvc-t lvc-mx keep"><thead><tr><th class="l">City</th>${svcs.map(s => `<th>${esc(s.label)}</th>`).join('')}</tr></thead><tbody>${rows.map(c => `<tr><th class="l" scope="row">${esc(c)}</th>${svcs.map(s => { const r = AT[c + '|' + s.id]; if (!r) return '<td></td>'; if (!r.slug) return `<td><a class="lvc-cell lvc-live" href="${esc(r.live)}" target="_blank" rel="noopener" title="${esc(r.note || 'The site already has this page')}">Live ↗</a></td>`; if (!shows(r)) return '<td><span class="lvc-off" aria-hidden="true">·</span></td>'; return `<td><button type="button" class="lvc-cell lvc-${esc(r.d)}" data-slug="${esc(r.slug)}" aria-pressed="${String(r.slug === PV.sel)}" title="${esc(`${r.t} · ${N(r.w)} words · grade ${r.g} · ${DEMAND[r.d]}`)}">${have.has(r.slug) ? '✓ ' : ''}${r.d === 'low' ? 'Low' : 'Open'}</button></td>`; }).join('')}</tr>`).join('') || `<tr><td class="l" colspan="${svcs.length + 1}">No city matches.</td></tr>`}</tbody></table>`;
          qa('button[data-slug]', mx).forEach(b => { b.onclick = () => { PV.sel = PV.sel === b.dataset.slug ? '' : b.dataset.slug; qa('button[data-slug]', mx).forEach(x => x.setAttribute('aria-pressed', String(x.dataset.slug === PV.sel))); prev(true); }; });
          labels();
        }
        function prev(scroll) {
          const at = q('#lvcHPrev', host), r = BYSLUG[PV.sel]; if (!at) return; if (!r) { at.innerHTML = ''; return; }
          const have = inPublish().has(r.slug);
          at.innerHTML = `<div class="card"><div class="card-h"><h3>${esc(r.t.replace(/\s*\|.*$/, ''))}</h3><p><span class="mono">${esc(pathOf(r.u))}</span> · ${esc(r.kw)} · ${N(r.w)} words · reading grade ${esc(String(r.g))} · Dr. HVAC check ${esc(r.chk)} · ${esc(DEMAND[r.d])}${r.note ? ' · ' + esc(r.note) : ''}</p></div><div class="card-b"><div class="lvc-row lvc-row0"><button type="button" class="btn" id="lvcHOne">${have ? 'Send this page to Publish again' : 'Send this page to Publish as a draft'}</button><button type="button" class="btn sec" id="lvcHSave">↓ Save the page file</button><span class="fl">Preview</span>${widthSeg('lvcHW')}<button type="button" class="btn sm ghost" id="lvcHClose">Close</button></div>${frame('', 'Preview of ' + r.t)}<p class="mini">The page file itself in a sealed frame: links and the form do nothing here. Where WordPress will show your contact form, the file shows a stand-in with the form's fields drawn. The fonts and the logo load from the web.</p></div></div>`;
          q('iframe', at).srcdoc = docOf(r);
          qa('#lvcHW button', at).forEach(b => { b.onclick = () => { PV.width = b.dataset.v; pvSave(); prev(); }; });
          q('#lvcHOne', at).onclick = () => send([r]); q('#lvcHSave', at).onclick = () => saveFile(r.slug + '.html', docOf(r)); q('#lvcHClose', at).onclick = () => { PV.sel = ''; matrix(); prev(); };
          if (scroll && at.scrollIntoView) at.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
        async function send(list) {
          if (!window.IACC || !list.length) return { ok: false, why: 'no door to Publish' };
          qa('#lvcHSend,#lvcHOne', host).forEach(b => { b.disabled = true; }); const was = sendBtn.textContent; sendBtn.textContent = `Sending ${N(list.length)}…`;
          const r = await IACC.publishHtml(list.map(fileOf));
          PV.sent = callout(r.ok ? 'lvc-ok' : 'judg', r.ok ? 'In Publish, as drafts' : 'Publish did not take all of it', r.ok ? `Publish lists ${list.length === 1 ? `<span class="mono">/${esc(list[0].slug)}/</span>` : `these ${N(list.length)} pages`} now. Nothing reaches the site until you choose a target there and send it. Publish keeps pages only while the dashboard is open, so send them again after it is closed or reloaded.${MODI.publish ? ' <button type="button" class="lnk" data-go="publish">Open Publish</button>' : ''}` : esc(r.why || 'No answer from Publish.'));
          say(r.ok ? `${N(list.length)} ${list.length === 1 ? 'page' : 'pages'} in Publish, as ${list.length === 1 ? 'a draft' : 'drafts'}` : 'Publish did not take the pages');
          if (PV.set === 'heat' && q('#lvcSet', view) === host) { const n = q('#lvcHSent', host); if (n) n.innerHTML = PV.sent; sendBtn.textContent = was; matrix(); prev(); }
          return r;
        }
        sendBtn.onclick = () => { const list = inView(); if (list.length > 100 && !armed) { armed = true; sendBtn.textContent = `${N(list.length)} pages at once. Press again to send them`; return; } send(list); };
        zipBtn.onclick = () => { const list = inView(); if (!list.length) return; saveFile(list.length === written.length ? 'service-area-heating-pages.zip' : 'service-area-heating-pages-in-view.zip', zipBlob(arr(H.files).map(f => ({ name: 'service-area-heating-pages/' + f.name, data: f.text })).concat(list.map(r => ({ name: `service-area-heating-pages/pages/${r.slug}.html`, data: docOf(r) }))))); };
        const fileBy = n => arr(H.files).find(f => f.name === n);
        q('#lvcHBlocks', host).onclick = () => { const f = fileBy('city-page-link-blocks.html'); if (f) saveFile(f.name, f.text); };
        q('#lvcHCsv', host).onclick = () => saveFile('service-area-heating-pages-sheets.zip', zipBlob(['READ-ME-FIRST.txt', 'manifest.csv', 'links-to-add.csv', 'checks.json'].map(fileBy).filter(Boolean).map(f => ({ name: f.name, data: f.text }))));
        q('#lvcHSvc', host).onchange = e => { PV.svc = e.target.value; pvSave(); matrix(); };
        q('#lvcHDem', host).onchange = e => { PV.dem = e.target.value; pvSave(); matrix(); };
        q('#lvcHFind', host).oninput = e => { PV.find = e.target.value; matrix(); };
        const tc = q('#lvcToConfirm', host); if (tc) tc.onclick = () => showModule('paidads', { view: 'confirm' });
        /* for the checks that drive this page: the pages in view, and the same door the buttons use */
        MODI[KEY].heatPages = { inView: () => inView().map(r => r.slug), send: slugs => send((slugs || inView().map(r => r.slug)).map(s => BYSLUG[s]).filter(Boolean)), doc: slug => (BYSLUG[slug] ? docOf(BYSLUG[slug]) : null) };
        matrix(); prev();
      }

