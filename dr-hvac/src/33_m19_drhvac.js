/* ==== src/33_m19_drhvac.js ==== */
/* ==== m19_drhvac ==== */
"use strict";
/* ============================ Module 19: Dr. HVAC ============================ */
/* The web developer on call. The agent itself lives in src/dr/ (DRHVAC): this module is its room in the atlas. On the
   left the conversation, with every tool call as a card and every change to a website as a question the person answers;
   on the right the workbench, where what the agent builds can be seen, checked, downloaded and handed to Publish.
   Nothing here talks to the model or to a site directly: it sends text to DRHVAC.agent, draws what DRHVAC.bus reports
   and answers the approval cards. No DOM work at load time beyond registerModule and the header button. */
registerModule({
  key: 'drhvac', num: '19', title: 'Dr. HVAC', desc: 'The web developer on call: builds landing pages and whole sites from the atlas, reworks Elementor templates, edits the live site as drafts, and plans hosting moves',
  mount(root) {
    const D = DRHVAC, A = D.agent, TL = D.tools, self = this;
    const st = { tab: 'preview', view: 'desktop', live: null, attach: [], ctx: null, stick: true, docSel: '', findings: null, running: {}, asks: {} };
    const $r = s => $(s, root); const hhmm = t => new Date(t || Date.now()).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const usd = v => (v >= 1 ? '$' + v.toFixed(2) : v >= 0.01 ? '$' + v.toFixed(2) : v > 0 ? 'under $0.01' : '$0.00');
    const label = n => { const s = String(n || '').replace(/_/g, ' '); return s.charAt(0).toUpperCase() + s.slice(1); };

    root.innerHTML = mastHTML({ eyebrow: 'Module 19 · Dr. HVAC · the web developer on call', title: 'Dr. HVAC', dek: 'A web developer and designer that works inside the atlas. Ask for a landing page and it reads the city\'s numbers, writes the page, checks it against the advertising rules and shows it to you. Give it an Elementor template and it builds new pages on that design. Connect the WordPress site and it changes existing pages as drafts, with a backup before every write. Tell it you are changing hosts and it reads the DNS, writes the runbook and checks the move page by page. It asks before anything reaches a website, and nothing goes live without your click.',
      meta: [`<b>Runs in</b> ${esc(D.ENV_NAME[D.ENV] || D.ENV)}`, `<b>Tools</b> ${TL.list().length}, from the atlas data to WordPress and DNS`, '<b>Default</b> drafts; a live change always asks', '<b>Storage</b> the key and the conversations stay in this browser'],
      bar: 'Dr. HVAC', barsub: 'Conversation, workbench, the site', actions: [{ id: 'd19New', label: '＋ New conversation', title: 'Start a new conversation; this one is kept in History' }, { id: 'd19Hist', label: 'History', title: 'Earlier conversations in this browser' }, { id: 'd19Plugin', label: '↓ Connector plugin', title: 'drhvac-connector.zip: the WordPress plugin that lets Dr. HVAC read and edit existing Elementor pages, with backups' }, { id: 'd19Settings', label: '⚙ Settings', title: 'The Anthropic API key, the model, and what may run without asking' }] }) +
      `<div class="wrap">
      <div id="d19Env"></div>
      <div class="kpis" id="d19Kpis"></div>
      <div class="dr-work">
        <section class="card dr-chat" aria-label="Conversation with Dr. HVAC">
          <div class="card-h"><div><h3>Conversation</h3><p id="d19Sub">Say what you need in plain words. Attach an Elementor template export, a screenshot, a sitemap or a brief.</p></div></div>
          <div class="dr-log" id="d19Log" role="log" aria-live="polite" aria-label="Messages" tabindex="0"></div>
          <div class="dr-compose">
            <div class="dr-files" id="d19Att"></div>
            <label class="fl" for="d19In" style="position:absolute;left:-9999px">Message to Dr. HVAC</label>
            <textarea id="d19In" placeholder="For example: build a furnace repair landing page for Frisco and send it to WordPress as a draft" spellcheck="true"></textarea>
            <div class="cact"><button class="btn" id="d19Send">Send</button><button class="btn sec" id="d19Stop" hidden>Stop</button><button class="btn ghost" id="d19File" title="Attach an Elementor template (.json), HTML, CSS, text, a sitemap or images">Attach</button><input type="file" id="d19FileIn" multiple hidden accept=".json,.html,.htm,.css,.txt,.md,.csv,.xml,image/png,image/jpeg,image/webp,image/gif"><span class="mini" id="d19State"></span></div>
          </div>
        </section>
        <section class="card dr-bench" aria-label="Workbench">
          <div class="card-h"><h3>Workbench</h3><p>What Dr. HVAC has built in this browser: pages with their preview and checks, Elementor documents, and the files it prepared for you. Nothing here is on a website until it is published.</p></div>
          <div class="card-b"><div class="ptabs" id="d19Tabs"><button type="button" data-v="preview" aria-pressed="true">Preview</button><button type="button" data-v="pages" aria-pressed="false">Pages</button><button type="button" data-v="elementor" aria-pressed="false">Elementor</button><button type="button" data-v="files" aria-pressed="false">Files</button><button type="button" data-v="activity" aria-pressed="false">Activity</button></div><div id="d19Pane"></div></div>
        </section>
      </div>
      ${card('How it works', '', '<ol class="meth" id="d19Meth"></ol>', 'mt')}
      <div class="split">${card('Judgment calls', '', '<div id="d19Judg"></div>')}${card('Source register', '', '<div id="d19Src"></div>')}</div>
      <div class="foot">DFW Thermal Debt Atlas, module 19. Dr. HVAC writes and prepares; you decide what reaches the site. It runs on Claude through your own Anthropic API key (or, inside the Claude viewer, on your Claude account); page copy it writes is a draft for a person to read before it is published.</div></div>`;

    /* ---------- markdown, safely: the text is escaped first, then only these marks become tags ---------- */
    function md(src) {
      const keep = []; const hold = h => { keep.push(h); return `\u0001${keep.length - 1}\u0001`; };
      let s = String(src == null ? '' : src).replace(/\r/g, '').replace(/```[^\n`]*\n([\s\S]*?)(?:```|$)/g, (m, code) => hold(`<pre class="dr-code"><code>${esc(code.replace(/\n$/, ''))}</code></pre>`));
      s = esc(s).replace(/`([^`\n]+)`/g, (m, c) => hold(`<code>${c}</code>`));
      const inline = t => t.replace(/\[([^\]\n]+)\]\(((?:https?:\/\/|mailto:|tel:|#)[^\s)]+)\)/g, (m, a, u) => `<a href="${u}"${/^https?:/.test(u) ? ' target="_blank" rel="noopener noreferrer"' : ''}>${a}</a>`).replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>').replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>');
      const out = []; const lines = s.split('\n'); let i = 0;
      const isUl = l => /^\s*[-*•]\s+/.test(l), isOl = l => /^\s*\d+[.)]\s+/.test(l), isTb = l => /^\s*\|.*\|\s*$/.test(l);
      while (i < lines.length) {
        const l = lines[i];
        if (!l.trim()) { i++; continue; }
        if (/^\u0001\d+\u0001$/.test(l.trim())) { out.push(l.trim()); i++; continue; }
        let m = l.match(/^(#{1,4})\s+(.*)$/); if (m) { const lv = Math.min(6, m[1].length + 3); out.push(`<h${lv}>${inline(m[2])}</h${lv}>`); i++; continue; }
        if (/^\s*([-*_])\s*\1\s*\1[\s\-*_]*$/.test(l)) { out.push('<hr>'); i++; continue; }
        if (/^\s*&gt;\s?/.test(l)) { const q = []; while (i < lines.length && /^\s*&gt;\s?/.test(lines[i])) q.push(lines[i++].replace(/^\s*&gt;\s?/, '')); out.push(`<blockquote>${inline(q.join(' '))}</blockquote>`); continue; }
        if (isUl(l) || isOl(l)) { const ol = isOl(l); const items = []; while (i < lines.length && (isUl(lines[i]) || isOl(lines[i]) || (/^\s{2,}\S/.test(lines[i]) && items.length))) { if (isUl(lines[i]) || isOl(lines[i])) items.push(lines[i].replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '')); else items[items.length - 1] += ' ' + lines[i].trim(); i++; } out.push(`<${ol ? 'ol' : 'ul'}>${items.map(x => `<li>${inline(x)}</li>`).join('')}</${ol ? 'ol' : 'ul'}>`); continue; }
        if (isTb(l) && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[i + 1])) { const cells = r => r.trim().replace(/^\||\|$/g, '').split('|').map(c => inline(c.trim())); const head = cells(l); i += 2; const rows = []; while (i < lines.length && isTb(lines[i])) rows.push(cells(lines[i++])); out.push(`<table><thead><tr>${head.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`); continue; }
        const p = []; while (i < lines.length && lines[i].trim() && !/^(#{1,4})\s+/.test(lines[i]) && !isUl(lines[i]) && !isOl(lines[i]) && !/^\u0001\d+\u0001$/.test(lines[i].trim()) && !/^\s*&gt;\s?/.test(lines[i])) p.push(lines[i++]);
        out.push(`<p>${inline(p.join('<br>'))}</p>`);
      }
      return out.join('').replace(/\u0001(\d+)\u0001/g, (m, n) => keep[+n]);
    }
    self.md = md;

    /* ---------- the log ---------- */
    const fileChips = fs => (fs && fs.length ? `<div class="dr-files">${fs.map(f => `<span class="dr-file"><b>${esc(f.name)}</b></span>`).join('')}</div>` : '');
    function toolCard(b) {
      const m = b.meta || {}; const run = st.running[b.id]; const done = b.result != null; const state = !done ? (run === 'wait' ? 'wait' : 'run') : (b.isError ? 'err' : 'ok');
      const risk = m.risk && m.risk !== 'read' && m.risk !== 'local' ? `<span class="dr-risk ${m.risk}">${m.risk === 'live' ? 'live change' : m.risk === 'settings' ? 'atlas setting' : 'draft'}</span>` : '';
      const sub = !done ? (run === 'wait' ? 'waiting for your answer' : (st.running[b.id + ':p'] || 'working')) : (m.summary || (b.isError ? 'did not run' : 'done'));
      const res = done ? (typeof b.result === 'string' ? b.result : JSON.stringify(b.result)) : '';
      return `<details class="dr-tool" data-tool="${esc(b.id)}"><summary><span class="dr-dot ${state}" aria-hidden="true"></span><span class="dr-tn">${esc(label(b.name))}</span>${risk}<span class="dr-ts">${esc(sub)}</span><span class="dr-tm">${done && m.ms != null ? (m.ms < 1000 ? m.ms + ' ms' : (m.ms / 1000).toFixed(1) + ' s') : ''}</span></summary><div class="dr-tb"><div><div class="dr-tl">Asked for</div><pre>${esc(D.clip(JSON.stringify(b.input, null, 1), 3000, 'the input'))}</pre></div>${done ? `<div><div class="dr-tl">${b.isError ? 'Came back with' : 'Result'}</div><pre>${esc(D.clip(res, 5000, 'the result'))}</pre></div>` : ''}</div></details>`;
    }
    function blockHTML(b) {
      if (b.type === 'text') return `<div class="dr-md">${md(b.text)}</div>`;
      if (b.type === 'thinking') return `<div class="dr-think">${esc(b.text)}</div>`;
      if (b.type === 'tool') return toolCard(b);
      if (b.type === 'server') return `<div class="dr-tool"><div class="dr-th"><span class="dr-dot ok" aria-hidden="true"></span><span class="dr-tn">${esc(label(b.name))}</span><span class="dr-ts">${esc((b.input && (b.input.query || b.input.url)) || '')}</span></div></div>`;
      return '';
    }
    function askHTML(p) {
      const a = p.ask; const live = a.kind === 'live' || a.danger;
      if (a.kind === 'question') return `<div class="dr-ask" data-ask="${esc(p.id)}"><div class="dr-ak">Dr. HVAC asks</div><div class="dr-at">${esc(a.title)}</div><div class="cact">${(a.options || []).map((o, n) => `<button class="btn sm sec" data-opt="${n}">${esc(o)}</button>`).join('')}</div><div class="cact"><input type="text" data-own placeholder="Or type your own answer" aria-label="Your own answer"><button class="btn sm" data-ownok>Answer</button><button class="btn sm ghost" data-no>Skip</button></div></div>`;
      const kind = a.kind === 'origin' ? 'Site access' : live ? 'Live change · needs your approval' : a.kind === 'settings' ? 'Atlas setting · needs your approval' : 'Draft · needs your approval';
      const yes = a.kind === 'origin' ? 'Allow access' : live ? 'Yes, do it' : a.kind === 'settings' ? 'Change it' : 'Approve';
      return `<div class="dr-ask${live ? ' live' : ''}" data-ask="${esc(p.id)}"><div class="dr-ak">${kind}</div><div class="dr-at">${esc(a.title || a.tool || 'Approve this step?')}</div><div class="dr-ad">${esc(a.detail || '')}</div><div class="cact"><button class="btn sm" data-yes>${yes}</button><button class="btn sm sec" data-no>${a.kind === 'origin' ? 'Not now' : 'No'}</button>${a.kind === 'draft' ? '<button class="btn sm ghost" data-yes-all title="Run draft writes without asking until this page is closed. Live changes still ask.">Approve drafts until I close this page</button>' : ''}</div></div>`;
    }
    function emptyHTML() {
      const t = D.transport(); const noKey = t === 'none';
      return `<div class="dr-empty"><h4>${noKey ? 'Connect Dr. HVAC to Claude first' : 'What are we building?'}</h4><p>${noKey ? 'Dr. HVAC thinks with Claude through your own Anthropic API key. Paste it once in Settings; it stays in this browser and is sent only to Anthropic.' : 'Pick a starting point or write your own. Dr. HVAC reads the atlas, asks what it cannot find out, builds in the workbench on the right, and asks before anything reaches the site.'}</p>${noKey ? '<button class="btn" data-open-settings>Open Settings</button>' : `<div class="dr-starts">${D.knowledge.STARTERS.map(([l, p], n) => `<button type="button" data-start="${n}">${esc(l)}<span>${esc(p.split('. ')[0])}.</span></button>`).join('')}</div>`}</div>`;
    }
    function renderLog() {
      const log = $r('#d19Log'); const tr = A.transcript(); const pend = A.pending();
      let h = tr.map((it, n) => {
        if (it.kind === 'user') return `<div class="dr-msg user">${esc(it.text)}${it.images ? `<div class="mini">${it.images} image${it.images === 1 ? '' : 's'} attached</div>` : ''}${fileChips(it.files)}</div>`;
        if (it.kind === 'assistant') return `<div class="dr-msg bot">${n && tr[n - 1].kind === 'assistant' ? '' : '<div class="dr-who">Dr. HVAC</div>'}${it.blocks.map(blockHTML).join('')}</div>`;
        return `<div class="dr-note ${esc(it.note)}">${esc(it.text)}</div>`;
      }).join('');
      if (!tr.length) h = emptyHTML();
      if (st.live) h += `<div class="dr-msg bot" id="d19Live">${tr.length && tr[tr.length - 1].kind === 'assistant' ? '' : '<div class="dr-who">Dr. HVAC</div>'}<div id="d19LiveB">${liveHTML()}</div></div>`;
      h += pend.map(askHTML).join('');
      log.innerHTML = h; wireLog(log); if (st.stick) log.scrollTop = log.scrollHeight;
    }
    /* the reply being written: blocks as they stream */
    function liveHTML() {
      const L = st.live; if (!L) return ''; const parts = L.blocks.filter(Boolean).map(b => {
        if (b.type === 'text') return b.text ? `<div class="dr-md">${md(b.text)}</div>` : '';
        if (b.type === 'thinking') return b.text ? `<div class="dr-think">${esc(b.text)}</div>` : '';
        if (b.type === 'tool_use') return `<div class="dr-tool"><div class="dr-th"><span class="dr-dot run" aria-hidden="true"></span><span class="dr-tn">${esc(label(b.name))}</span><span class="dr-ts">${b.chars ? `writing the request, ${N(b.chars)} characters` : 'preparing'}</span></div></div>`;
        if (b.type === 'server_tool_use') return `<div class="dr-tool"><div class="dr-th"><span class="dr-dot run" aria-hidden="true"></span><span class="dr-tn">${esc(label(b.name))}</span><span class="dr-ts">on Anthropic's side</span></div></div>`;
        return '';
      }).join('');
      return parts || '<div class="dr-think">Thinking…</div>';
    }
    let liveT = 0; const paintLive = () => { if (liveT) return; liveT = requestAnimationFrame(() => { liveT = 0; const h = $r('#d19LiveB'); if (h && st.live) { h.innerHTML = liveHTML(); const log = $r('#d19Log'); if (st.stick) log.scrollTop = log.scrollHeight; } }); };
    function wireLog(log) {
      $$('[data-start]', log).forEach(b => b.onclick = () => { const p = D.knowledge.STARTERS[+b.dataset.start]; $r('#d19In').value = p[1]; send(); });
      $$('[data-open-settings]', log).forEach(b => b.onclick = settingsPanel);
      $$('.dr-ask', log).forEach(card => {
        const id = card.dataset.ask; const p = A.pending().find(x => x.id === id); if (!p) return; const a = p.ask;
        const yes = async all => { $$('button', card).forEach(b => b.disabled = true); if (a.kind === 'origin') { const ok = await D.net.request(a.origins || a.origin); if (!ok) toast('Access to ' + D.hostOf(a.origin) + ' was not granted'); A.answer(id, ok); } else A.answer(id, true, all ? { sessionDrafts: true } : undefined); };
        const y = $('[data-yes]', card); if (y) y.onclick = () => yes(false); const ya = $('[data-yes-all]', card); if (ya) ya.onclick = () => yes(true);
        const n = $('[data-no]', card); if (n) n.onclick = () => A.answer(id, a.kind === 'question' ? null : false);
        $$('[data-opt]', card).forEach(b => b.onclick = () => A.answer(id, a.options[+b.dataset.opt]));
        const own = $('[data-own]', card), ok = $('[data-ownok]', card); if (own && ok) { const go = () => { const v = own.value.trim(); if (v) A.answer(id, v); }; ok.onclick = go; own.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); go(); } }; }
      });
      /* the keyboard lands on the card: on No for a live change, so a stray Enter cannot approve it; on the first choice otherwise */
      const first = $('.dr-ask.live [data-no]', log) || $('.dr-ask [data-yes], .dr-ask [data-opt]', log); if (first && document.activeElement !== $r('#d19In')) { try { first.focus({ preventScroll: true }); } catch (e) { } }
    }
    $r('#d19Log').addEventListener('scroll', () => { const l = $r('#d19Log'); st.stick = l.scrollHeight - l.scrollTop - l.clientHeight < 60; });

    /* ---------- environment, KPIs ---------- */
    function env() {
      const h = $r('#d19Env'); const t = D.transport();
      if (D.ENV === 'viewer') { h.innerHTML = callout('judg', 'Inside the Claude viewer', 'Outbound calls are blocked here, so Dr. HVAC cannot reach a website, WordPress or DNS, and it thinks through your own Claude account when this page was published with that access. It can still read the atlas, build and check pages, rework an Elementor template you attach and write a move runbook. Install the browser app for the full set of tools.'); return; }
      if (t === 'none') { h.innerHTML = callout('note', 'One step before the first message', `Dr. HVAC needs an Anthropic API key to think. Create one at console.anthropic.com, then paste it in <a href="#" data-open-settings>Settings</a>. It is stored in ${esc(D.RT ? 'the extension\'s storage' : 'this browser')} and sent only to api.anthropic.com; usage is billed to your Anthropic account.`); $$('[data-open-settings]', h).forEach(a => a.onclick = e => { e.preventDefault(); settingsPanel(); }); return; }
      h.innerHTML = D.ENV === 'file' ? callout('note', 'Opened as a file', 'Claude is reachable from here. A website only answers when it allows this page\'s origin: WordPress does once this origin is on the FORGE bridge\'s allowed list, most public sites do not. The browser app has no such limit.') : '';
    }
    function kpis() {
      const S = D.settings(); const m = D.MODEL(S.model) || D.MODELS[0]; const t = D.transport(); const c = A.current(); const u = (c && c.usage) || { requests: 0, input: 0, output: 0, read: 0, write: 0, usd: 0 }; const W = TL.summary();
      const wp = D.wp && D.wp.configured() ? D.hostOf(D.wp.site()) : '';
      $r('#d19Kpis').innerHTML = kpiHTML([
        { l: 'Claude', v: t === 'api' ? 'Connected' : t === 'viewer' ? 'Your Claude' : 'No key yet', d: t === 'api' ? 'your Anthropic API key, in this browser' : t === 'viewer' ? 'through the Claude viewer' : 'add one in Settings' },
        { l: 'Model', v: esc(t === 'viewer' ? 'Chosen by the viewer' : m.name.replace('Claude ', '')), d: t === 'viewer' ? 'the most capable tier it offers' : `effort ${esc(S.effort)} · web research ${S.webResearch ? 'on' : 'off'}` },
        { l: 'WordPress', v: wp ? esc(wp) : 'Not connected', d: wp ? 'credentials from the Publish module; ask Dr. HVAC to check the site' : 'the Publish module holds the WordPress card' },
        { l: 'Workshop', v: `${N(W.pages)} page${W.pages === 1 ? '' : 's'}`, d: `${N(W.docs)} Elementor document${W.docs === 1 ? '' : 's'} · ${N(W.files)} file${W.files === 1 ? '' : 's'}` },
        { l: 'This conversation', v: u.requests ? usd(u.usd) : '—', d: u.requests ? `${N(u.requests)} model requests · ${K(u.input + u.read + u.write)} tokens in, ${K(u.output)} out · estimate at list prices` : 'nothing sent yet' },
      ]);
    }

    /* ---------- the workbench ---------- */
    const pagesList = () => Object.values(TL.WS.pages).sort((a, b) => String(b.updated).localeCompare(String(a.updated)));
    /* the preview frame runs nothing: scripts other than JSON-LD, inline handlers and javascript: addresses are taken out before it is shown */
    const cleanPreview = h => String(h).replace(/<script(?![^>]*application\/ld\+json)[^>]*>[\s\S]*?<\/script>/gi, '').replace(/\son(?:click|dblclick|submit|reset|load|error|change|input|focus|blur|select|toggle|scroll|wheel|drop|play|pause|ended|mouse[a-z]+|key[a-z]+|touch[a-z]+|pointer[a-z]+|drag[a-z]*|animation[a-z]+|transition[a-z]+)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '').replace(/\b(href|src|action)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '$1=$2#$2');
    function download(f) { const b = TL.fileBlob(f.id); saveFile(f.name, b || f.text || ''); }
    function pane() {
      const host = $r('#d19Pane'); $$('#d19Tabs button', root).forEach(x => x.setAttribute('aria-pressed', String(x.dataset.v === st.tab)));
      const W = TL.WS;
      if (st.tab === 'preview') {
        const ps = pagesList(); const cur = W.pages[W.current] || ps[0];
        if (!cur) { host.innerHTML = '<p class="mini">No page yet. Ask Dr. HVAC for one, or copy a Site Forge page into the workshop, and its preview shows here.</p>'; return; }
        let b = null, err = ''; try { b = TL.build(cur); } catch (e) { err = e.message; }
        host.innerHTML = `<div class="dr-bar"><div class="ctl"><label class="fl" for="d19Pg">Page</label><select id="d19Pg">${ps.map(p => `<option value="${esc(p.id)}" ${p.id === cur.id ? 'selected' : ''}>/${esc(p.slug)}/ · ${esc(p.kind)}</option>`).join('')}</select></div><div class="ptabs" style="margin:0;border:0" id="d19View"><button type="button" data-v="desktop" aria-pressed="${st.view === 'desktop'}">Desktop</button><button type="button" data-v="mobile" aria-pressed="${st.view === 'mobile'}">Mobile</button></div><span class="spacer"></span><button class="btn sm sec" id="d19Chk">Run the checks</button><button class="btn sm sec" id="d19DlH">↓ HTML</button><button class="btn sm sec" id="d19DlE">↓ Elementor</button><button class="btn sm" id="d19ToPub" title="Put this page in the Publish module's list">Send to Publish</button></div>
          ${b ? `<div class="mini" style="margin-bottom:8px"><b>${esc((cur.page && cur.page.title) || cur.title || '')}</b> · ${N(b.words)} words · ${b.checks.block ? `<b style="color:var(--critical)">${b.checks.block} blocking</b>` : 'no blocking findings'} · ${b.checks.warn} warnings${cur.kind === 'elementor' ? ' · an approximate rendering: Elementor and the theme draw the real page' : ''}</div><div class="dr-stage ${st.view === 'mobile' ? 'mobile' : 'desktop'}" id="d19Stage"><iframe class="prev" sandbox="allow-same-origin" title="Page preview, ${st.view === 'mobile' ? 'at phone width' : 'at desktop width, scaled to fit'}" id="d19Frame"></iframe></div><div class="dr-findings" id="d19Find"></div>` : `<div class="msg err">This page could not be built: ${esc(err)}</div>`}`;
        if (b) { $r('#d19Frame').srcdoc = cleanPreview(b.preview); fitStage(); findings(cur, b); }
        $r('#d19Pg').onchange = e => { TL.setCurrent(e.target.value); st.findings = null; pane(); };
        wireSeg($r('#d19View'), v => { st.view = v; pane(); });
        if (b) { $r('#d19Chk').onclick = () => runChecks(cur); $r('#d19DlH').onclick = () => saveFile(cur.slug + '.preview.html', b.preview);
          $r('#d19DlE').onclick = () => { const t = cur.kind === 'blueprint' ? b.template : cur.kind === 'elementor' ? D.elementor.toTemplate(Object.assign({}, cur.doc, { title: cur.title })) : null; if (!t) { toast('An HTML page has no Elementor template'); return; } saveFile(cur.slug + '.elementor-template.json', JSON.stringify(t)); };
          $r('#d19ToPub').onclick = () => { if (b.checks.block) { toast('Fix the blocking findings first'); return; } try { const m = MODI.publish; if (!m.mounted) { m.mounted = true; m.mount($('#mod-publish')); } m.receive({ pages: [b.portable()], source: 'drhvac' }); toast('Sent to the Publish module'); } catch (e) { toast('Could not hand over: ' + e.message); } }; }
        return;
      }
      if (st.tab === 'pages') {
        const ps = pagesList(); if (!ps.length) { host.innerHTML = '<p class="mini">The workshop has no pages yet.</p>'; return; }
        host.innerHTML = `<div class="tscroll"><table><thead><tr><th class="l">Page</th><th class="l">Kind</th><th>Words</th><th>Checks</th><th class="l">From</th><th class="l">Updated</th><th class="l"></th></tr></thead><tbody>${ps.map(p => { const br = TL.brief(p); return `<tr data-id="${esc(p.id)}"><td class="l"><b>${esc(br.title || p.slug)}</b><div class="mini mono">/${esc(p.slug)}/${br.noindex ? ' · noindex' : ''}</div></td><td class="l">${esc(p.kind)}</td><td>${br.words == null ? '—' : N(br.words)}</td><td>${br.checks ? (br.checks.block ? `<b style="color:var(--critical)">${br.checks.block} block</b>` : 'clean') + (br.checks.warn ? ` · ${br.checks.warn} warn` : '') : esc(br.error || '—')}</td><td class="l mini">${esc(p.source || '')}</td><td class="l mini">${esc(hhmm(p.updated))}</td><td class="l"><div class="cact"><button class="btn sm sec" data-a="open">Preview</button><button class="btn sm ghost" data-a="del">Remove</button></div></td></tr>`; }).join('')}</tbody></table></div>`;
        $$('tr[data-id]', host).forEach(tr => { $('[data-a="open"]', tr).onclick = () => { TL.setCurrent(tr.dataset.id); st.tab = 'preview'; st.findings = null; pane(); }; $('[data-a="del"]', tr).onclick = () => { TL.removePage(tr.dataset.id); toast('Removed from the workshop'); }; });
        return;
      }
      if (st.tab === 'elementor') {
        const ds = Object.values(W.docs); if (!ds.length) { host.innerHTML = '<p class="mini">No Elementor document loaded. Attach a template export (in WordPress: Templates, Saved Templates, Export) and ask Dr. HVAC to load it, or ask it to read a page from the connected site.</p>'; return; }
        const cur = W.docs[st.docSel] || ds[ds.length - 1]; const v = D.elementor.validate(cur.elements);
        host.innerHTML = `<div class="dr-bar"><div class="ctl"><label class="fl" for="d19Doc">Document</label><select id="d19Doc">${ds.map(d => `<option value="${esc(d.id)}" ${d.id === cur.id ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}</select></div><span class="spacer"></span><button class="btn sm sec" id="d19DocDl">↓ Template JSON</button><button class="btn sm ghost" id="d19DocRm">Remove</button></div>
          <div class="mini" style="margin-bottom:8px">From ${esc(cur.source ? cur.source.kind + (cur.source.ref ? ' ' + cur.source.ref : '') : 'unknown')} · ${N(v.stats.widgets)} widgets in ${N(v.stats.containers + v.stats.sections)} containers · ${N(v.stats.words)} words · ${v.ok ? 'valid' : `<b style="color:var(--critical)">${v.errors.length} structural problems</b>`}${v.stats.pro.length ? ` · needs Elementor Pro for ${esc(v.stats.pro.join(', '))}` : ''}</div><pre class="dr-out">${esc(D.elementor.outline(cur.elements, { max: 400 }))}</pre>`;
        $r('#d19Doc').onchange = e => { st.docSel = e.target.value; pane(); };
        $r('#d19DocDl').onclick = () => saveFile(slug(cur.name || 'template') + '.elementor-template.json', JSON.stringify(D.elementor.toTemplate(cur)));
        $r('#d19DocRm').onclick = () => { TL.removeDoc(cur.id); st.docSel = ''; toast('Removed from the workshop'); };
        return;
      }
      if (st.tab === 'files') {
        const fs = Object.values(W.files).sort((a, b) => String(b.at).localeCompare(String(a.at))); if (!fs.length) { host.innerHTML = '<p class="mini">No files yet. What you attach and what Dr. HVAC prepares for you (templates, runbooks, redirect maps, site zips) is listed here.</p>'; return; }
        host.innerHTML = `<div class="tscroll"><table><thead><tr><th class="l">File</th><th class="l">Kind</th><th>Size</th><th class="l">Note</th><th class="l"></th></tr></thead><tbody>${fs.map(f => `<tr data-id="${esc(f.id)}"><td class="l"><b>${esc(f.name)}</b></td><td class="l">${f.kind === 'attachment' ? 'you attached' : 'prepared for you'}</td><td>${esc(D.fmtBytes(f.size))}</td><td class="l mini">${esc(f.note || '')}</td><td class="l"><div class="cact"><button class="btn sm sec" data-a="dl">↓ Download</button><button class="btn sm ghost" data-a="del">Remove</button></div></td></tr>`).join('')}</tbody></table></div>`;
        $$('tr[data-id]', host).forEach(tr => { const f = W.files[tr.dataset.id]; $('[data-a="dl"]', tr).onclick = () => download(f); $('[data-a="del"]', tr).onclick = () => TL.removeFile(f.id); });
        return;
      }
      const c = A.current(); const rows = c ? Object.entries(c.toolMeta).map(([id, m]) => Object.assign({ id }, m)).sort((a, b) => String(b.at).localeCompare(String(a.at))) : [];
      host.innerHTML = rows.length ? `<div class="tscroll"><table><thead><tr><th class="l">Time</th><th class="l">Tool</th><th class="l">Gate</th><th>Took</th><th class="l">Outcome</th></tr></thead><tbody>${rows.map(m => `<tr><td class="l mini">${esc(hhmm(m.at))}</td><td class="l mono">${esc(m.name)}</td><td class="l">${m.risk === 'live' ? '<span class="pill">live · asked</span>' : m.risk === 'draft' || m.risk === 'settings' ? `<span class="pill">${m.risk === 'settings' ? 'setting' : 'draft'}${m.approved === false ? ' · declined' : ' · asked'}</span>` : esc(m.risk || 'read')}</td><td>${m.ms == null ? '…' : N(m.ms) + ' ms'}</td><td class="l mini">${m.ok === false ? '<b style="color:var(--critical)">did not run</b> ' : ''}${esc(m.summary || '')}</td></tr>`).join('')}</tbody></table></div>` : '<p class="mini">Every tool Dr. HVAC runs in this conversation is listed here with what it was allowed to do and how it ended.</p>';
    }
    /* Desktop is the page at a desktop width, scaled down to fit the column, so the layout on screen is the desktop one
       (a narrow frame would trigger the page's own phone styles). Mobile is a phone's width at full size. */
    function fitStage() { const stg = $r('#d19Stage'), fr = $r('#d19Frame'); if (!stg || !fr) return; if (st.view === 'mobile') { fr.style.cssText = ''; return; } const W = 1280, k = Math.min(1, stg.clientWidth / W) || 1; fr.style.width = W + 'px'; fr.style.height = Math.round(stg.clientHeight / k) + 'px'; fr.style.transform = k < 1 ? `scale(${k})` : ''; }
    if (typeof ResizeObserver === 'function') new ResizeObserver(() => fitStage()).observe($r('#d19Pane'));
    function findings(p, b) {
      const host = $r('#d19Find'); if (!host) return; const F = st.findings && st.findings.id === p.id ? st.findings : null;
      const lines = b.checks.issues.map(i => ({ sev: i.sev, text: `${i.id}: ${i.msg}${i.ev ? ' [' + i.ev + ']' : ''}`, fix: i.fix || '' })).concat(F ? F.audit.findings.map(f => ({ sev: f.sev, text: `${f.id}: ${f.msg}${f.evidence ? ' [' + f.evidence + ']' : ''}`, fix: f.fix || '', info: !!f.info })) : []);
      host.innerHTML = (F ? `<div class="dr-score">${F.audit.score}<small>of 100 on the page audit (search, accessibility, speed, conversion, schema)</small></div>` : '') + (lines.length ? lines.map(l => `<div class="issue ${esc(l.sev)}"><b>${esc(String(l.sev).toUpperCase())}</b> ${esc(l.text)}${l.fix ? `<br><span class="mini">${esc(l.fix)}</span>` : ''}</div>`).join('') : '<div class="msg ok">No findings from the compiler and the compliance rules. Run the checks for the full page audit.</div>');
    }
    function runChecks(p) { try { const b = TL.build(p); st.findings = { id: p.id, audit: TL.auditPage(p, b) }; findings(p, b); toast(`Audit score ${st.findings.audit.score} of 100`); } catch (e) { toast('The checks could not run: ' + e.message); } }
    wireSeg($r('#d19Tabs'), v => { st.tab = v; pane(); });

    /* ---------- attachments ---------- */
    const TEXT_EXT = /\.(json|html?|css|txt|md|csv|xml)$/i;
    async function imageBlock(file) {
      const bmp = await createImageBitmap(file); const r = Math.min(1, 1568 / Math.max(bmp.width, bmp.height)); const cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * r); cv.height = Math.round(bmp.height * r); cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
      const blob = await new Promise(res => cv.toBlob(res, 'image/jpeg', 0.85)); const buf = new Uint8Array(await blob.arrayBuffer()); let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000)); return { mime: 'image/jpeg', data: btoa(bin) };
    }
    async function addFiles(files) {
      await TL.ready();
      for (const f of files) {
        try {
          if (TEXT_EXT.test(f.name) || /^text\//.test(f.type) || f.type === 'application/json') { if (f.size > 6 * 1024 * 1024) { toast(f.name + ' is over 6 MB'); continue; } const text = await f.text(); const isEl = /\.json$/i.test(f.name) && /"elType"\s*:/.test(text.slice(0, 200000)); const rec = TL.addFile({ name: f.name, text, mime: f.type || 'text/plain', kind: 'attachment', note: isEl ? 'Elementor template export' : '' }); st.attach.push({ id: rec.id, name: rec.name, size: rec.size, kind: isEl ? 'Elementor template export' : (f.type || 'text') }); }
          else if (/^image\//.test(f.type)) { if (st.attach.filter(a => a.image).length >= 4) { toast('Four images per message'); continue; } const rec = TL.addFile({ name: f.name, blob: f, mime: f.type, kind: 'attachment', note: 'Image' }); let img = null; try { img = await imageBlock(f); } catch (e) { img = null; } st.attach.push({ id: rec.id, name: rec.name, size: rec.size, kind: 'image, usable as page media with source "file:' + rec.id + '"', image: img }); }
          else toast(f.name + ': attach JSON, HTML, CSS, text or images');
        } catch (e) { toast('Could not read ' + f.name); }
      }
      drawAttach();
    }
    function drawAttach() { const h = $r('#d19Att'); h.innerHTML = st.attach.map((a, n) => `<span class="dr-file"><b>${esc(a.name)}</b> ${esc(D.fmtBytes(a.size))}<button type="button" data-rm="${n}" aria-label="Remove ${esc(a.name)}">×</button></span>`).join(''); $$('[data-rm]', h).forEach(b => b.onclick = () => { st.attach.splice(+b.dataset.rm, 1); drawAttach(); }); }
    $r('#d19File').onclick = () => $r('#d19FileIn').click();
    $r('#d19FileIn').onchange = e => { addFiles([...e.target.files]); e.target.value = ''; };
    const inp = $r('#d19In');
    inp.addEventListener('dragover', e => { e.preventDefault(); }); inp.addEventListener('drop', e => { if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) { e.preventDefault(); addFiles([...e.dataTransfer.files]); } });
    inp.addEventListener('paste', e => { const fs = [...((e.clipboardData && e.clipboardData.files) || [])]; if (fs.length) { e.preventDefault(); addFiles(fs); } });

    /* ---------- sending ---------- */
    function busy() { const s = A.state(); $r('#d19Send').disabled = s !== 'idle'; $r('#d19Stop').hidden = s === 'idle'; $r('#d19State').textContent = s === 'running' ? 'Dr. HVAC is working…' : s === 'waiting' ? 'Waiting for your answer above.' : (D.transport() === 'none' ? 'Add an API key in Settings to start.' : 'Enter sends · Shift+Enter for a new line'); }
    async function send() {
      const text = inp.value.trim(); if (!text || A.state() !== 'idle') return;
      if (D.transport() === 'none') { settingsPanel(); toast('Add an Anthropic API key first'); return; }
      const files = st.attach.map(a => ({ id: a.id, name: a.name, size: a.size, kind: a.kind })); const images = st.attach.map(a => a.image).filter(Boolean); const context = st.ctx; st.ctx = null;
      inp.value = ''; st.attach = []; drawAttach(); st.stick = true; st.findings = null;
      try { await A.send(text, { files, images, context }); } catch (e) { if (e && e.kind !== 'no_key') console.error(e); }
    }
    $r('#d19Send').onclick = send; $r('#d19Stop').onclick = () => A.stop();
    inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); } });

    /* ---------- what the agent reports ---------- */
    D.bus.on('agent', e => {
      if (e.type === 'state') { busy(); if (e.state !== 'waiting') renderLog(); return; }
      if (e.type === 'stream_start') { st.live = { blocks: [] }; renderLog(); return; }
      if (e.type === 'stream') { const L = st.live; if (!L) return; const v = e.ev; if (v.type === 'block') L.blocks[v.index] = { type: v.block.type, name: v.block.name, text: v.block.text || v.block.thinking || '', chars: 0 }; else if (v.type === 'delta' && L.blocks[v.index]) { if (v.kind === 'input') L.blocks[v.index].chars += v.text.length; else L.blocks[v.index].text += v.text; } paintLive(); return; }
      if (e.type === 'stream_end') { st.live = null; if (e.discarded) renderLog(); return; }
      if (e.type === 'tool_start') { st.running[e.id] = 'run'; return; }
      if (e.type === 'tool_progress') { st.running[e.id + ':p'] = e.text; const c = $(`[data-tool="${e.id}"] .dr-ts`, root); if (c) c.textContent = e.text; return; }
      if (e.type === 'ask') { if (e.ask && e.ask.toolUseId) { st.running[e.ask.toolUseId] = 'wait'; st.asks[e.id] = e.ask.toolUseId; } st.stick = true; renderLog(); return; }
      if (e.type === 'answered') { const t = st.asks[e.id]; if (t) { delete st.asks[e.id]; if (st.running[t] === 'wait') st.running[t] = 'run'; } }
      if (e.type === 'tool_end') { delete st.running[e.id]; delete st.running[e.id + ':p']; if (st.tab === 'activity') pane(); return; }
      if (e.type === 'usage') { kpis(); return; }
      if (e.type === 'opened') { st.live = null; st.running = {}; renderLog(); kpis(); pane(); busy(); return; }
      if (['user', 'assistant', 'results', 'note', 'answered', 'turn_end'].includes(e.type)) { renderLog(); if (e.type === 'turn_end') { kpis(); busy(); } }
    });
    D.bus.on('workshop', e => { kpis(); if (e.kind === 'page' || e.kind === 'current' || e.kind === 'all') { if (st.tab !== 'pages' && e.kind !== 'all' && TL.WS.pages[e.id]) st.tab = 'preview'; st.findings = null; } if (e.kind === 'doc' && TL.WS.docs[e.id]) st.docSel = e.id; pane(); });
    D.bus.on('settings', () => { env(); kpis(); busy(); if (!A.transcript().length) renderLog(); });
    BUS.on('brand', () => { if (!A.transcript().length) renderLog(); });

    /* ---------- settings ---------- */
    function overlay(id, title, sub, body) {
      let ov = document.getElementById(id); if (ov) ov.remove();
      ov = el('div', { id, class: 'overlay', role: 'dialog', 'aria-modal': 'true', tabindex: '-1', 'aria-label': title });
      ov.innerHTML = `<div class="panel"><div class="card-h" style="display:flex;gap:10px;align-items:center"><div style="flex:1"><h3>${title}</h3><p>${sub}</p></div><button class="ibtn" data-close>Close</button></div><div class="card-b">${body}</div></div>`;
      document.body.appendChild(ov); const opener = document.activeElement; const close = () => { ov.remove(); if (opener && opener.focus) opener.focus(); };
      ov.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); close(); return; } if (e.key !== 'Tab') return; const fs = $$('button,input,select,textarea,a[href]', ov).filter(x => !x.disabled && x.offsetParent !== null); if (!fs.length) return; const a = document.activeElement; if (e.shiftKey && (a === fs[0] || a === ov)) { e.preventDefault(); fs[fs.length - 1].focus(); } else if (!e.shiftKey && a === fs[fs.length - 1]) { e.preventDefault(); fs[0].focus(); } });
      $('[data-close]', ov).onclick = close; ov.addEventListener('click', e => { if (e.target === ov) close(); }); return { ov, close };
    }
    function settingsPanel() {
      const S = D.settings(); const viewer = D.ENV === 'viewer';
      const { ov, close } = overlay('d19SetPanel', 'Dr. HVAC settings', 'How it reaches Claude, which model does the work, and what may run without asking. Saved in this browser.', `
        ${viewer ? callout('note', 'Inside the Claude viewer', 'There is no key to set here: Dr. HVAC uses the Claude account of whoever views this page, when the page was published with that access. The settings below apply in the browser app or a downloaded copy.') : ''}
        <div class="dsec">Claude</div>
        <div class="dr-key"><div class="f"><label class="fl" for="d19Key">Anthropic API key</label><input type="password" id="d19Key" autocomplete="off" spellcheck="false" placeholder="sk-ant-…" value="${esc(S.apiKey || '')}"><span class="hint">From console.anthropic.com, API keys. Kept in ${esc(D.RT ? 'extension storage' : 'this browser\'s storage')} on this machine; sent only to Anthropic. Anyone with this browser profile can use it until you remove it.</span></div><button class="btn sec" id="d19KeyTest">Test the key</button><button class="btn ghost" id="d19KeyRm">Remove</button></div>
        <div class="status mt" id="d19KeyMsg" hidden></div>
        <div class="plan mt">
          <div class="f"><label class="fl" for="d19Model">Model</label><select id="d19Model">${D.MODELS.map(m => `<option value="${m.id}" ${m.id === S.model ? 'selected' : ''}>${esc(m.name)} · $${m.inUsd} in, $${m.outUsd} out per million tokens</option>`).join('')}</select><span class="hint" id="d19ModelNote"></span></div>
          <div class="f"><label class="fl" for="d19Effort">Effort</label><select id="d19Effort">${D.EFFORTS.map(x => `<option value="${x}" ${x === S.effort ? 'selected' : ''}>${x}</option>`).join('')}</select><span class="hint">How much the model thinks before it acts. High suits building and migrations; medium is quicker and cheaper for routine edits.</span></div>
          <div class="f"><label class="fl" for="d19Steps">Model requests per message</label><input type="number" id="d19Steps" min="4" max="120" value="${esc(S.maxSteps)}"><span class="hint">A long build is many requests. The loop stops here and tells you.</span></div>
          <div class="f"><label class="fl" for="d19Wp">WordPress credentials come from</label><select id="d19Wp"><option value="wp_elementor" ${S.wpTarget !== 'wp_headless' ? 'selected' : ''}>The WordPress · Elementor card in Publish</option><option value="wp_headless" ${S.wpTarget === 'wp_headless' ? 'selected' : ''}>The WordPress · Headless card in Publish</option></select><span class="hint">The site URL, username and Application Password are entered in module 16, never in the chat.</span></div>
          <div class="f wide"><div class="chips"><label class="chk"><input type="checkbox" id="d19Web" ${S.webResearch ? 'checked' : ''}> Web research (Anthropic's web search and web fetch, billed per search)</label><label class="chk"><input type="checkbox" id="d19Auto" ${S.autoDrafts ? 'checked' : ''}> Let draft writes to a site run without asking each time</label><label class="chk"><input type="checkbox" id="d19Compat" ${S.compat ? 'checked' : ''}> Compatibility mode (send no beta features)</label></div><span class="hint">A change that visitors can see (publishing, editing a live page, restoring a backup) always asks, whatever is ticked here. Web research and the model apply to new conversations.</span></div>
          <div class="f wide"><label class="fl" for="d19Base">API base URL <span class="mini">optional</span></label><input type="url" id="d19Base" placeholder="https://api.anthropic.com" value="${esc(S.baseUrl || '')}"><span class="hint">Only for a company gateway in front of the Anthropic API. The key is sent as an Authorization bearer credential.</span></div>
        </div>
        <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap"><button class="btn" id="d19SetSave">Save</button><span class="spacer" style="flex:1"></span><button class="btn ghost" id="d19ClrWs">Empty the workshop</button><button class="btn ghost" id="d19ClrConv">Delete every conversation</button></div>
        <p class="mini" style="margin-top:10px">Conversations and the workshop are kept in ${esc(D.big.where())}. Each message sends the conversation so far, a short status line (the date, the brand name, city, domain and phone, and what is connected), the tool results and what you attached to Anthropic's API under your key. Atlas data leaves this browser only as far as a tool result quotes it; passwords and keys are never part of a message.</p>`);
      const note = () => { const m = D.MODEL($('#d19Model', ov).value); $('#d19ModelNote', ov).textContent = m ? m.note + '.' : ''; }; note(); $('#d19Model', ov).onchange = note;
      const read = () => ({ apiKey: $('#d19Key', ov).value.trim(), model: $('#d19Model', ov).value, effort: $('#d19Effort', ov).value, maxSteps: +$('#d19Steps', ov).value || 40, wpTarget: $('#d19Wp', ov).value, webResearch: $('#d19Web', ov).checked, autoDrafts: $('#d19Auto', ov).checked, compat: $('#d19Compat', ov).checked, baseUrl: $('#d19Base', ov).value.trim() });
      const msg = (t, bad) => { const m = $('#d19KeyMsg', ov); m.hidden = false; m.style.color = bad ? 'var(--critical)' : ''; m.textContent = t; };
      $('#d19SetSave', ov).onclick = async () => { await D.saveSettings(read()); D.llm.reset(); if (D.wp) D.wp.reset(); toast('Dr. HVAC settings saved'); close(); };
      $('#d19KeyTest', ov).onclick = async () => { const b = $('#d19KeyTest', ov); b.disabled = true; msg('Asking Anthropic…'); try { await D.saveSettings(read()); D.llm.reset(); const r = await D.llm.test(); msg(`The key works. ${r.name} is available to it.`); } catch (e) { msg(D.llm.words(e), true); } finally { b.disabled = false; } };
      $('#d19KeyRm', ov).onclick = async () => { $('#d19Key', ov).value = ''; await D.saveSettings({ apiKey: '' }); D.llm.reset(); msg('The key was removed from this browser.'); };
      let armed = {}; const twice = (btn, key, fn) => { if (armed[key]) { armed[key] = false; fn(); return; } armed[key] = true; const t = btn.textContent; btn.textContent = 'Click again to confirm'; setTimeout(() => { armed[key] = false; if (btn.isConnected) btn.textContent = t; }, 4000); };
      $('#d19ClrWs', ov).onclick = e => twice(e.target, 'ws', async () => { await TL.clearWorkshop(); toast('The workshop is empty'); close(); });
      $('#d19ClrConv', ov).onclick = e => twice(e.target, 'cv', async () => { for (const c of A.list()) await A.remove(c.id); await A.fresh(); toast('Conversations deleted'); close(); });
      $(viewer ? '#d19Model' : '#d19Key', ov).focus();
    }
    function historyPanel() {
      const rows = A.list(); const cur = A.current();
      const { ov, close } = overlay('d19HistPanel', 'Conversations', 'Kept in this browser. Opening one brings back its messages and its usage; the workshop is shared by all of them.', rows.length ? `<div class="tscroll"><table><thead><tr><th class="l">Conversation</th><th class="l">Last message</th><th class="l">Model</th><th class="l"></th></tr></thead><tbody>${rows.map(c => `<tr data-id="${esc(c.id)}"><td class="l">${cur && cur.id === c.id ? '<span class="pill">open</span> ' : ''}<b>${esc(c.title)}</b></td><td class="l mini">${esc(new Date(c.updated).toLocaleString())}</td><td class="l mini">${esc(((D.MODEL(c.model) || {}).name || c.model || '').replace('Claude ', ''))}</td><td class="l"><div class="cact"><button class="btn sm sec" data-a="open">Open</button><button class="btn sm ghost" data-a="del">Delete</button></div></td></tr>`).join('')}</tbody></table></div>` : '<p class="mini">No earlier conversations.</p>');
      $$('tr[data-id]', ov).forEach(tr => { $('[data-a="open"]', tr).onclick = async () => { await A.open(tr.dataset.id); close(); }; $('[data-a="del"]', tr).onclick = async () => { await A.remove(tr.dataset.id); tr.remove(); }; });
    }
    $r('#d19Settings').onclick = settingsPanel; $r('#d19Hist').onclick = historyPanel;
    $r('#d19New').onclick = async () => { if (A.state() !== 'idle') A.stop(); await A.fresh(); inp.focus(); };
    $r('#d19Plugin').onclick = () => { try { saveFile('drhvac-connector.zip', zipBlob(D.wp.connectorZipEntries())); } catch (e) { toast(e.message); } };

    /* ---------- method, judgment, sources ---------- */
    $r('#d19Meth').innerHTML = [
      '<b>An agent, not a form.</b> You say what you need; Dr. HVAC decides which of its tools to use, runs them here in the page, reads what comes back and carries on until the job is done or a decision is yours. Each tool call is a card in the conversation: open it to see exactly what was asked and what came back.',
      '<b>It reads the atlas before it writes.</b> City and county numbers, service angles, competitors and the brand come from the atlas\'s own data, with the public source the Site Forge prints beside every figure. It is told never to invent a fact, a review, a price or a response time, and to word model estimates as estimates.',
      '<b>Three kinds of page.</b> A new page is a FORGE blueprint, the same format the Site Forge uses, compiled here to Elementor containers, semantic HTML and JSON-LD. A page based on an existing design is an Elementor document: a template export you attach, a saved template or a page read from the site, edited slot by slot so the design stays intact. Anything else is plain HTML and CSS, which also packages as a static site.',
      '<b>Checked before it is shown as done.</b> Every page runs the compiler\'s checks, the Emergency Satchel rule pack (TDLR, FTC and Texas deceptive practices, lending and texting rules), house style, and an audit for search, accessibility, speed, conversion and schema. A blocking finding stops a page from being published.',
      '<b>Gates.</b> Reading and working in this browser run at once. Writing a draft to a site asks you first, unless Settings allows drafts. A change to what you have saved in the atlas (the brand, the Site Forge\'s settings) is shown to you and asks every time. Anything a visitor can see (publishing, changing a live page, restoring a backup) always asks, with the page named and the change listed in words. The first time a tool needs a site the browser asks you to allow that site.',
      '<b>The live site.</b> With the Dr. HVAC connector plugin on WordPress it reads a page\'s Elementor content, writes changes back with a backup taken first, refuses to overwrite a page someone else changed in the meantime, and can restore any of the last ten backups. With only the FORGE bridge it creates and updates pages as drafts and saves templates to the library. With neither it still audits public pages and works from template files.',
      '<b>Hosting moves.</b> It looks up public DNS, fingerprints the current stack, reads the WordPress inventory, and writes a runbook that keeps mail, rankings and forms working, with a worksheet of which DNS records to keep and which to change. It never asks for registrar or hosting passwords and cannot change DNS: you make the change, it verifies the result page by page.',
    ].map(x => `<li>${x}</li>`).join('');
    $r('#d19Judg').innerHTML = judgList([
      ['It can be wrong', 'A language model writes the plans and the copy. The checks catch rule violations and structural mistakes, not a wrong claim about your business. Read a page before it goes live; the preview and the draft link exist for that.'],
      ['Your key, your bill', 'Each message sends the conversation, a short status line (the date, the brand name, city, domain and phone, and what is connected), the tool results and your attachments to Anthropic under your API key. The dollar figure on this page is an estimate from list prices; the Anthropic Console is the record. A long build is dozens of requests.'],
      ['The key sits in this browser', 'Like the CMS credentials in Publish, the API key is stored in this browser profile so the next session works without retyping. Remove it in Settings; anyone with this profile can use it until then.'],
      ['Estimates stay estimates', 'System ages, R22 counts and replacement volumes come from the atlas\'s renewal model (grade C). Pages say "estimated" and print the source. The grade stays in the atlas.'],
      ['The connector is new code on your site', 'It is a small plugin with capability checks on every route and a backup before every write, tested here against a stand in for WordPress. Install it on a staging copy first, and review it as you would any plugin.'],
      ['Elementor previews are approximate', 'The workbench renders an Elementor document with its own simple styles. Elementor and the theme draw the real page, so judge layout on the draft link, not here.'],
      ['Host specifics go stale', 'Runbooks state what must be done and why; the exact button on a given host changes. Where a step depends on a host\'s current product it says to confirm it.'],
      ['Web pages are read, not obeyed', 'A fetched page or an attached file is treated as information. Text inside one that tries to give Dr. HVAC instructions is not followed, and a live change still needs your click.'],
    ]);
    $r('#d19Src').innerHTML = srcRows([
      ['Anthropic API, Messages', 'Streaming, tool use, adaptive thinking, prompt caching; called through the official TypeScript SDK', 'A', 'SDK ' + ((globalThis.AnthropicSDK && AnthropicSDK.VERSION) || 'not loaded'), 'https://platform.claude.com/docs/en/api/messages'],
      ['Anthropic, models', 'Model IDs and list prices used for the cost estimate', 'A', 'November 2026', 'https://platform.claude.com/docs/en/about-claude/models/overview'],
      ['WordPress REST API', 'Application Passwords; the routes the connector and the bridge add', 'A', 'wp/v2', 'https://developer.wordpress.org/rest-api/'],
      ['Elementor developers', 'The document and template JSON format the Elementor tools read and write', 'B', '', 'https://developers.elementor.com/docs/data-structure/'],
      ['WCAG 2.2', 'The accessibility checks in the page audit', 'A', 'W3C Recommendation', 'https://www.w3.org/TR/WCAG22/'],
      ['schema.org', 'HVACBusiness, Service, FAQPage', 'A', '', 'https://schema.org/HVACBusiness'],
      ['TDLR advertising rule', '16 Tex. Admin. Code §75.71, through the Emergency Satchel rule pack', 'A', '', 'https://www.law.cornell.edu/regulations/texas/16-Tex-Admin-Code-SS-75-71'],
      ['DNS over HTTPS', 'Public resolvers used for the DNS lookups (Cloudflare, Google)', 'A', 'JSON API', 'https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/make-api-requests/dns-json/'],
    ]);

    /* ---------- hooks ---------- */
    self.receive = p => { if (!p) return; if (p.from) st.ctx = { module: p.from }; if (p.ask) { inp.value = p.ask; if (p.send) booted.then(send); else inp.focus(); } };
    self.fromRoute = arg => { if (arg === 'settings') settingsPanel(); else if (arg === 'new') booted.then(() => { if (A.transcript().length) return A.fresh(); }); };
    self.onShow = () => { if (self.cameFrom) { st.ctx = { module: self.cameFrom }; self.cameFrom = ''; } env(); kpis(); busy(); };
    self.settings = settingsPanel;

    /* ---------- boot ---------- */
    env(); kpis(); pane(); busy(); renderLog();
    const cmsReady = () => (typeof CMS !== 'undefined' && typeof CMS.ready === 'function' ? CMS.ready() : null);
    const booted = Promise.all([D.ready(), TL.ready(), cmsReady()]).then(() => A.load()).then(() => { env(); kpis(); pane(); busy(); renderLog(); }).catch(e => { console.error(e); toast('Dr. HVAC storage did not load: ' + e.message); });
  }
});

/* ---------- the way in from anywhere: a button in the header beside Live data and Brand ---------- */
(function headerButton() {
  if (typeof document === 'undefined') return;
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', headerButton, { once: true }); return; }
  const facts = document.getElementById('shellFacts'); if (!facts || document.getElementById('drBtn')) return;
  const b = document.createElement('button'); b.className = 'tbtn'; b.id = 'drBtn'; b.type = 'button'; b.title = 'Dr. HVAC: the web developer agent. Build or change a page, rework an Elementor template, plan a hosting move.'; b.innerHTML = '<b aria-hidden="true">✚</b>Dr. HVAC';
  facts.insertAdjacentElement('afterend', b);
  /* which module the person was reading when they turned to Dr. HVAC, noted before the shell switches (capture phase) */
  const onScreen = () => { const cur = MODS.find(m => { const s = document.getElementById('mod-' + m.key); return s && !s.hidden; }); return cur && cur.key !== 'drhvac' ? cur.title : ''; };
  const rail = document.getElementById('rail'); if (rail) rail.addEventListener('click', e => { if (e.target && e.target.closest && e.target.closest('#tab-drhvac')) MODI.drhvac.cameFrom = onScreen(); }, true);
  b.onclick = () => { MODI.drhvac.cameFrom = onScreen(); showModule('drhvac'); };
})();
