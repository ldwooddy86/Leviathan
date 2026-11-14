/* ==== src/32_m18_live.js ==== */
/* ==== m18_live ==== */
"use strict";
/* ============================ Module 18: Live Data ============================ */
/* The control room for the live layer (live/core.js): every public source the atlas refreshes, when it last answered, what it
   returned, what changed since the week before, the schedule and the settings. In the browser app the background worker keeps
   the schedule; opened as a single file, the page refreshes when it is opened and a run is due. */
registerModule({
  key: 'live', num: '18', title: 'Live Data', desc: 'The public sources the atlas refreshes every week: status, schedule, what changed since last week, settings',
  mount(root) {
    const L = window.TDA_LIVE;
    const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const hourLabel = h => (h % 12 || 12) + (h < 12 ? ' am' : ' pm');
    const kb = b => isN(b) ? (b >= 1048576 ? D(b / 1048576, 1) + ' MB' : b >= 1024 ? N(b / 1024) + ' KB' : N(b) + ' B') : '—';
    const secs = ms => isN(ms) ? (ms >= 10000 ? N(ms / 1000) : D(ms / 1000, 1)) + ' s' : '—';
    const HEALTH = { fresh: ['var(--good)', 'Current'], aging: ['var(--warning)', 'Aging'], stale: ['var(--critical)', 'Stale'] };
    const keyNames = () => { const out = []; LIVE.sources.forEach(s => { if (s.key && !out.some(k => k.key === s.key)) out.push({ key: s.key, label: s.keyLabel || s.key, required: !!s.keyRequired, url: s.keyUrl || '', by: LIVE.sources.filter(x => x.key === s.key).map(x => x.name) }); }); return out; };
    const where = LIVE.ext ? 'the browser app' : 'this file';
    root.innerHTML = mastHTML({
      eyebrow: `Module 18 · Live Data · ${LIVE.sources.length} public ${LIVE.sources.length === 1 ? 'source' : 'sources'}`,
      title: 'Live Data',
      dek: `The stock model in this atlas (who has which system, how old, in which ZIP) is compiled from the Census and changes once a year. Everything that moves faster is here: the forecast lows and cold alerts, the heating season to date against normal, the two week outlooks, city permits, state licenses, recalls and federal rules. ${LIVE.ext ? 'The browser app refreshes all of it once a week in the background and takes a light weather pulse every morning, whether or not this page is open.' : 'Opened as a single file, the atlas refreshes these when the file is opened and a run is due; the browser app does it in the background on a schedule.'} Every source is public, free and named below. The refresh sends plain read requests and nothing about you.`,
      meta: [`<b>${LIVE.sources.length}</b> ${LIVE.sources.length === 1 ? 'source' : 'sources'} · <b>${LIVE.sources.filter(s => s.cadence === 'daily').length}</b> on the daily weather pulse`, `<b>${[...new Set(LIVE.sources.flatMap(s => s.hosts))].length}</b> hosts called, all listed`, 'Stock model <b>compiled ' + esc(META.compiled || '') + '</b> · rebuilt when a new Census vintage lands', `Running as <b>${LIVE.ext ? 'the browser app' : LIVE.canFetch() ? 'a single file' : 'a preview (network calls are blocked here)'}</b>`],
      bar: 'Live Data', barsub: 'Status, schedule, changes, settings',
      actions: [{ id: 'lvRefresh', label: '⟳ Refresh everything', title: 'Run every source now' }, { id: 'lvPulse', label: '⟳ Weather pulse', title: 'Run only the daily weather sources' }, { id: 'lvExport', label: '↓ Live data JSON', title: 'Every record as stored, for audit' }]
    }) + `<div class="wrap">
      ${LIVE.canFetch() ? '' : callout('', 'This preview cannot reach the network', 'The viewer this page is open in blocks outside requests, so the figures below are the snapshot baked into the build. Download the file and open it in a browser, or install the browser app, and the sources refresh on their own.')}
      <div class="kpis" id="lvKpis"></div>
      <div class="card mt"><div class="card-h"><h3>Refresh and schedule</h3><p>${LIVE.ext ? 'The background worker runs the schedule. It also catches up when the browser starts after a missed run.' : 'A single file has no background worker: it checks the schedule each time it is opened and refreshes when a run is due. Sources that do not allow calls from a web page are marked; the browser app can read them.'}</p></div>
        <div class="card-b"><div id="lvProg" class="mini" role="status" aria-live="polite" style="margin-bottom:10px" hidden></div>
          <div class="plan">
            <div class="f"><label class="fl" for="lvDow">Full refresh day</label><select id="lvDow">${DOW.map((d, i) => `<option value="${i}">${d}</option>`).join('')}</select><span class="hint">Every source, once a week.</span></div>
            <div class="f"><label class="fl" for="lvHour">Full refresh time</label><select id="lvHour">${Array.from({ length: 24 }, (_, h) => `<option value="${h}">${hourLabel(h)}</option>`).join('')}</select><span class="hint">Local time on this computer.</span></div>
            <div class="f"><label class="fl" for="lvDailyHour">Weather pulse time</label><select id="lvDailyHour">${Array.from({ length: 24 }, (_, h) => `<option value="${h}">${hourLabel(h)}</option>`).join('')}</select><span class="hint">Forecast lows and alerts only, a handful of requests.</span></div>
            <div class="f"><span class="fl">Options</span>
              <label class="chk"><input type="checkbox" id="lvDaily"> Take the weather pulse every day</label>
              ${LIVE.ext ? '<label class="chk"><input type="checkbox" id="lvNotify"> Notify me when a cold trigger appears in the forecast</label>' : '<label class="chk"><input type="checkbox" id="lvAuto"> Refresh when this file is opened and a run is due</label>'}
            </div>
          </div>
          <div id="lvKeys"></div>
        </div></div>
      <div class="card mt"><div class="card-h"><h3>Sources</h3><p>One row per collector. A source that fails keeps its last good data and says so. Turn a source off and it is skipped; its last data stays. Grades follow the atlas: A measured by the publisher, B measured with a known gap, C modeled from measurements, D stated.</p></div><div class="xscroll" id="lvTbl"></div></div>
      <div class="split">
        ${card('What changed since the last full refresh', 'The headline numbers each source reported, against the same numbers at the previous refresh at least six days earlier (twenty hours for the daily sources).', '<div id="lvDelta"></div>')}
        ${card('Run log', 'The most recent runs, newest first.', '<div class="tscroll short" id="lvRuns"></div>')}
      </div>
      <div class="split">
        ${card('What refreshes and what does not', '', `<dl class="dl"><dt>Weekly and daily</dt><dd>Everything in the table above. The Heat Desk, the Weather Desk and the header read these records; nothing else in the atlas changes when they do.</dd><dt>Yearly</dt><dd>The stock model: housing by year built, heating fuel, system counts and ages, incomes and the service line pools come from the Census American Community Survey and the fitted lifetimes, compiled ${esc(META.compiled || '')}. A new five year vintage is published each winter; the model is rebuilt from it rather than patched week to week.</dd><dt>When you log it</dt><dd>Competitor ads and offers in Competitor Watch, and the account actuals in Accounts, change when you record or pull them.</dd><dt>Never sent</dt><dd>The refresh is a set of read requests to the hosts listed here. No cookies, no account, no ZIP list of yours, no brand settings leave the browser. API keys you add below are stored in ${where} only and are sent only to the service they belong to.</dd></dl>`)}
        ${card('Hosts the refresh calls', 'The complete list, from the collectors themselves.', '<div id="lvHosts"></div>')}
      </div>
      <div class="foot">DFW Thermal Debt Atlas, module 18. Live figures are the publishers' own numbers at the time shown on each row; derived figures built on them carry the grade shown in the module that uses them.</div></div>`;

    /* ---------- actions ---------- */
    const run = async (scope, label) => {
      if (LIVE.busy()) { toast('A refresh is already running'); return; }
      if (!LIVE.canFetch()) { toast('This preview cannot reach the network'); return; }
      const r = await LIVE.refresh(scope, true);
      if (r && r.locked) toast('The background worker is refreshing right now');
      else if (r) toast(`${label}: ${r.ran.length} refreshed${r.failed.length ? ', ' + r.failed.length + ' failed' : ''}${r.skipped.length ? ', ' + r.skipped.length + ' skipped' : ''}`);
    };
    $('#lvRefresh', root).onclick = () => run('weekly', 'Full refresh');
    $('#lvPulse', root).onclick = () => run('daily', 'Weather pulse');
    $('#lvExport', root).onclick = () => saveFile(`dfw-thermal-atlas-live-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ exported: new Date().toISOString(), state: LIVE.state(), records: LIVE.all() }, null, 1));
    const bind = (id, key, get) => { const e = $('#' + id, root); if (e) e.onchange = () => LIVE.saveSettings({ [key]: get(e) }).then(() => toast('Saved')); };
    bind('lvDow', 'weeklyDow', e => +e.value); bind('lvHour', 'weeklyHour', e => +e.value); bind('lvDailyHour', 'dailyHour', e => +e.value);
    bind('lvDaily', 'daily', e => e.checked); bind('lvNotify', 'notify', e => e.checked); bind('lvAuto', 'auto', e => e.checked);
    $('#lvTbl', root).addEventListener('click', e => { const b = e.target.closest('button[data-src]'); if (b) run([b.dataset.src], LIVE.byId[b.dataset.src].name); });
    $('#lvTbl', root).addEventListener('change', e => { const c = e.target.closest('input[data-toggle]'); if (!c) return; const d = Object.assign({}, LIVE.settings().disabled); if (c.checked) delete d[c.dataset.toggle]; else d[c.dataset.toggle] = true; LIVE.saveSettings({ disabled: d }); });
    $('#lvKeys', root).addEventListener('change', e => { const i = e.target.closest('input[data-key]'); if (!i) return; const k = Object.assign({}, LIVE.settings().keys); const v = i.value.trim(); if (v) k[i.dataset.key] = v; else delete k[i.dataset.key]; LIVE.saveSettings({ keys: k }).then(() => toast(v ? 'Key saved in ' + where : 'Key removed')); });

    /* ---------- render ---------- */
    function fmtVal(v, kind) {
      if (v == null || v === '') return '—';
      if (kind === 'text' || typeof v === 'string') return esc(v);
      if (kind === 'degF') return D(v, 0) + '°F'; if (kind === 'pct') return P(v, 0); if (kind === 'f1') return D(v, 1); if (kind === 'usd') return M$(v); if (kind === 'idx') return D(v, 1);
      return N(v);
    }
    function deltaHTML() {
      const blocks = LIVE.sources.map(s => {
        const r = LIVE.rec(s.id); if (!r || !r.digest || !s.labels) return '';
        const rows = Object.keys(s.labels).filter(k => r.digest[k] != null).map(k => {
          const [label, kind] = s.labels[k]; const now = r.digest[k], was = r.prev && r.prev.digest ? r.prev.digest[k] : null;
          const num = isN(now) && typeof now !== 'string' && isN(was) && typeof was !== 'string'; const d = num ? now - was : null;
          const chg = was == null ? '<span class="mini">first reading</span>' : num ? (Math.abs(d) < 1e-9 ? '<span class="mini">no change</span>' : `<b style="color:${d > 0 ? 'var(--heat)' : 'var(--cool)'}">${d > 0 ? '+' : '−'}${fmtVal(Math.abs(d), kind === 'degF' ? 'degF' : kind === 'pct' ? 'pct' : kind === 'f1' || kind === 'idx' ? 'f1' : kind === 'usd' ? 'usd' : 'int')}</b>`) : (String(now) === String(was) ? '<span class="mini">no change</span>' : '<span class="mini">was ' + fmtVal(was, kind) + '</span>');
          return `<div class="rowl"><span>${esc(label)}</span><b>${fmtVal(now, kind)} <span style="font-weight:400;margin-left:8px">${chg}</span></b></div>`;
        }).join('');
        return rows ? `<div class="dsec">${esc(s.name)}${r.prev && r.prev.at ? ` <span style="font-weight:400;letter-spacing:0;text-transform:none;color:var(--ink-3)">against ${esc(LIVE.stamp(r.prev.at))}</span>` : ''}</div>${rows}` : '';
      }).join('');
      return blocks || '<p class="mini">Nothing to compare yet. The comparison fills in after the second weekly refresh.</p>';
    }
    function render() {
      const S = LIVE.settings(), st = LIVE.state(), nx = LIVE.nextRuns(), recs = LIVE.all();
      const ids = LIVE.sources.map(s => s.id);
      const cur = ids.filter(id => LIVE.health(id) === 'fresh').length, failed = ids.filter(id => recs[id] && recs[id].ok === false), never = ids.filter(id => !recs[id] || recs[id].data == null);
      const last = (st.runs || [])[0];
      const tot = ids.reduce((a, id) => { const r = recs[id]; if (r && r.ok) { a.n += r.n || 0; a.b += r.bytes || 0; } return a; }, { n: 0, b: 0 });
      $('#lvKpis', root).innerHTML = kpiHTML([
        { l: 'Last full refresh', v: st.lastWeekly ? esc(LIVE.ago(st.lastWeekly)) : (LIVE.baseline ? 'Baked in' : 'Not yet'), d: st.lastWeekly ? esc(LIVE.stamp(st.lastWeekly)) : (LIVE.baseline && LIVE.baseline.built ? 'Snapshot from the build of ' + esc(LIVE.stamp(LIVE.baseline.built)) : 'Use Refresh everything above') },
        { l: 'Next full refresh', v: esc(nx.weekly.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })), d: `${hourLabel(S.weeklyHour)} ${LIVE.ext ? 'by the background worker' : 'or the next time this file is opened after that'}` },
        { l: 'Sources current', v: `${cur} of ${ids.length}`, d: failed.length ? `<span style="color:var(--critical)">${failed.length} failed on the last run</span>` : never.length ? `${never.length} not fetched yet` : 'All inside their schedule' },
        { l: 'Weather pulse', v: S.daily === false ? 'Off' : (st.lastDaily ? esc(LIVE.ago(st.lastDaily)) : 'Not yet'), d: S.daily === false ? 'Forecast refreshes weekly only' : 'Daily at ' + hourLabel(S.dailyHour) },
        { l: 'Weight of a full refresh', v: tot.n ? N(tot.n) + ' requests' : '—', d: tot.n ? kb(tot.b) + ' read in total' + (last && isN(last.ms) ? ', last run ' + secs(last.ms) : '') : 'Counted after the first run' },
      ]);
      $('#lvDow', root).value = S.weeklyDow; $('#lvHour', root).value = S.weeklyHour; $('#lvDailyHour', root).value = S.dailyHour; $('#lvDaily', root).checked = S.daily !== false;
      const n = $('#lvNotify', root); if (n) n.checked = S.notify !== false; const a = $('#lvAuto', root); if (a) a.checked = S.auto !== false;
      const keys = keyNames();
      $('#lvKeys', root).innerHTML = keys.length ? `<div class="dsec" style="margin-top:16px">API keys (${keys.some(k => k.required) ? 'needed where marked' : 'optional'})</div><div class="plan">${keys.map(k => `<div class="f"><label class="fl" for="lvKey_${esc(k.key)}">${esc(k.label)}${k.required ? ' (required)' : ''}</label><input type="password" id="lvKey_${esc(k.key)}" data-key="${esc(k.key)}" value="${esc((S.keys || {})[k.key] || '')}" autocomplete="off" spellcheck="false" placeholder="Paste the key"><span class="hint">Used by ${esc(k.by.join(', '))}. ${k.url ? `<a href="${esc(k.url)}" target="_blank" rel="noopener">Get a free key</a>. ` : ''}Stored in ${where} only.</span></div>`).join('')}</div>` : '';
      $('#lvTbl', root).innerHTML = `<table><thead><tr><th class="l">Source</th><th class="l">What it feeds</th><th class="l">Cadence</th><th class="l">Status</th><th>Last run</th><th class="l">Grade</th><th class="l">On</th><th></th></tr></thead><tbody>${LIVE.sources.map(s => {
        const r = recs[s.id], h = LIVE.health(s.id), off = !!(S.disabled || {})[s.id];
        const state = off ? '<span class="mini">Turned off</span>' : !r || r.data == null ? `<span class="sev" style="background:var(--critical)"></span>Not fetched yet` : `<span class="sev" style="background:${HEALTH[h][0]}"></span>${HEALTH[h][1]} · ${esc(LIVE.ago(r.at))}${r.baseline ? ' <span class="mini">(baked into the build)</span>' : ''}`;
        const prob = r && r.ok === false && r.err ? `<div class="mini" style="color:var(--critical);white-space:normal;max-width:300px">Failed ${esc(LIVE.ago(r.err.at))}: ${esc(r.err.msg)}</div>` : r && r.skipped && !off && (!r.at || +new Date(r.skipped.at) > +new Date(r.at)) ? `<div class="mini" style="color:var(--judg);white-space:normal;max-width:300px">Skipped: ${esc(r.skipped.why)}</div>` : '';
        return `<tr><td class="l wrap" style="min-width:220px"><b>${s.page ? `<a href="${esc(s.page)}" target="_blank" rel="noopener">${esc(s.name)}</a>` : esc(s.name)}</b><div class="mini">${esc(s.publisher)}${s.cors ? '' : ' · browser app only'}${s.key ? (s.keyRequired ? ' · needs a key' : ' · key optional') : ''}</div></td><td class="l wrap" style="min-width:240px;max-width:380px"><span class="mini">${esc(s.about || '')}</span></td><td class="l">${s.cadence === 'daily' ? 'Daily' : 'Weekly'}</td><td class="l">${state}${prob}</td><td>${r && r.ok && isN(r.n) ? `${N(r.n)} req · ${kb(r.bytes)} · ${secs(r.ms)}` : '—'}</td><td class="l">${s.grade ? G(s.grade) : ''}</td><td class="l"><input type="checkbox" data-toggle="${esc(s.id)}" aria-label="Refresh ${esc(s.name)}" ${off ? '' : 'checked'}></td><td><button class="btn sec" type="button" data-src="${esc(s.id)}" ${off || LIVE.busy() ? 'disabled' : ''}>Refresh</button></td></tr>`;
      }).join('') || '<tr><td class="l" colspan="8">No sources are registered in this build.</td></tr>'}</tbody></table>`;
      $('#lvDelta', root).innerHTML = deltaHTML();
      $('#lvRuns', root).innerHTML = (st.runs || []).length ? `<table><thead><tr><th class="l">Started</th><th class="l">Scope</th><th class="l">By</th><th>Refreshed</th><th>Failed</th><th>Skipped</th><th>Took</th></tr></thead><tbody>${st.runs.map(r => `<tr><td class="l">${esc(LIVE.stamp(r.at))}</td><td class="l">${esc(r.scope === 'weekly' ? 'Full refresh' : r.scope === 'daily' ? 'Weather pulse' : (LIVE.byId[r.scope] || {}).name || r.scope)}</td><td class="l">${r.by === 'extension' ? 'Browser app' : r.by === 'page' ? 'This page' : esc(r.by)}</td><td>${N(r.ok)}</td><td title="${esc((r.failed || []).join(', '))}">${(r.failed || []).length ? `<b style="color:var(--critical)">${r.failed.length}</b>` : '0'}</td><td title="${esc((r.skipped || []).join(', '))}">${(r.skipped || []).length}</td><td>${secs(r.ms)}</td></tr>`).join('')}</tbody></table>` : '<p class="mini" style="padding:12px 16px">No run yet.</p>';
      const hosts = {}; LIVE.sources.forEach(s => s.hosts.forEach(h => (hosts[h] = hosts[h] || []).push(s.name)));
      $('#lvHosts', root).innerHTML = Object.keys(hosts).sort().map(h => `<div class="rowl"><span><code>${esc(h)}</code></span><b style="font-weight:400;white-space:normal">${esc(hosts[h].join(', '))}</b></div>`).join('') || '<p class="mini">None.</p>';
      progress(LIVE.progress());
      $$('#lvRefresh,#lvPulse', root).forEach(b => b.disabled = LIVE.busy() || !LIVE.canFetch());
    }
    function progress(p) {
      const e = $('#lvProg', root); if (!e) return;
      if (!LIVE.busy() || !p) { e.hidden = true; e.innerHTML = ''; return; }
      e.hidden = false; const pct = p.total ? Math.round(100 * p.done / p.total) : 0;
      e.innerHTML = `Refreshing: ${p.done || 0} of ${p.total || '…'}${p.name ? ' · last finished: ' + esc(p.name) + (p.status === 'failed' ? ' (failed)' : p.status === 'skipped' ? ' (skipped)' : '') : ''}<div class="hbar" style="margin-top:6px"><i style="width:${pct}%"></i></div>`;
    }
    BUS.on('live', () => render()); BUS.on('live:progress', p => progress(p));
    render();
  }
});

