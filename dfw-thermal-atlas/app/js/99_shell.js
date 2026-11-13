/* ==== src/99_shell.js ==== */
/* ==== shell ==== */
(function boot() {
  const t = store.get('tda.theme', null); if (t === 'dark' || t === 'light') document.documentElement.dataset.theme = t;
  BRANDX.apply();
  const rail = document.querySelector('#rail .in');
  rail.innerHTML = MODS.map(m => `<button type="button" id="tab-${m.key}" role="tab" aria-selected="false" aria-controls="mod-${m.key}"><span class="n">${m.num}</span><span class="t">${esc(m.title)}</span><span class="d">${esc(m.desc)}</span></button>`).join('');
  document.getElementById('modules').innerHTML = MODS.map(m => `<section class="module" id="mod-${m.key}" role="tabpanel" aria-labelledby="tab-${m.key}" hidden></section>`).join('');
  $$('#rail button').forEach(b => b.addEventListener('click', () => showModule(b.id.slice(4))));
  const Y = DATA.climate.ytd;
  document.getElementById('shellFacts').insertAdjacentHTML('afterend', '<button class="tbtn" id="liveBtn" title="Live data: the sources, the schedule and what changed"></button><button class="tbtn" id="brandBtn" title="Brand settings">⚙ Brand</button>'); document.getElementById('brandBtn').onclick = () => BRANDX.panel();
  /* ---------- header facts: the stock, and the season's weather fact (cold side from October to March) ---------- */
  const coolSeason = () => { const m = new Date().getMonth(); return m >= 9 || m <= 2; };
  function facts() {
    let wx = `<span><b>${Y.d100}</b> days at 100°F in ${String(Y.through).slice(0, 4)}</span>`;
    if (coolSeason() && typeof LIVE !== 'undefined' && window.TDA_LIVE && TDA_LIVE.derive) {
      let c = null; try { c = TDA_LIVE.derive.cold(LIVE.all(), new Date()); } catch (e) { c = null; }
      if (c && c.ok && !c.stale) wx = `<span data-go="${MODI.heat ? 'heat' : 'weather'}" style="cursor:pointer" title="${esc(c.headline)}"><b>${c.minLow}°F</b> coldest low in the next seven nights</span>`;
    }
    document.getElementById('shellFacts').innerHTML = `<span><b>${K(META.sys)}</b> central systems</span><span><b>${K(META.ge15)}</b> aged 15 or older</span><span><b>${K(META.rep)}</b> replacements a year</span><span><b>${SLM.LINES.length}</b> service lines</span><span><b>${WATCH.COMPANIES.length - 1}</b> competitors watched</span>${wx}`;
  }
  /* ---------- the live data chip: how fresh the public sources are, and the way into module 18 ---------- */
  function liveChip() {
    const b = document.getElementById('liveBtn'); if (!b || typeof LIVE === 'undefined') { if (b) b.hidden = true; return; }
    const st = LIVE.state(), p = LIVE.progress(), last = st.lastWeekly || (LIVE.baseline && LIVE.baseline.built) || null;
    const age = last ? Date.now() - +new Date(last) : Infinity, W = TDA_LIVE.WEEK;
    const col = age <= W * 1.15 ? '#4ade80' : age <= W * 2.2 ? '#fbbf24' : '#f87171';
    b.innerHTML = LIVE.busy() ? `⟳ Refreshing${p && p.total ? ' ' + p.done + ' of ' + p.total : ''}` : `<span aria-hidden="true" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${col};margin-right:6px;vertical-align:1px"></span>Live data ${esc(last ? LIVE.ago(last) : 'not fetched yet')}`;
  }
  document.getElementById('liveBtn').onclick = () => showModule(MODI.live ? 'live' : 'weather');
  facts(); liveChip();
  BUS.on('live', () => { facts(); liveChip(); }); BUS.on('live:progress', liveChip);
  setInterval(liveChip, 5 * 60 * 1000);
  /* ---------- routes: #key shows a module; #key.argument also hands the argument to a module that takes one
     (fromRoute: a ZIP code for the Heat Desk). The popup, the address bar keyword and bookmarks all arrive this way. ---------- */
  const route = () => { let h = (location.hash || '').slice(1); try { h = decodeURIComponent(h); } catch (e) { } const i = h.indexOf('.'); return i > 0 ? { key: h.slice(0, i), arg: h.slice(i + 1) } : { key: h, arg: '' }; };
  const go = first => {
    const r = route(), m = MODI[r.key]; if (!m) { if (first) showModule('index'); return; }
    if (first || r.arg || $('#mod-' + r.key).hidden) showModule(r.key);
    if (r.arg && typeof m.fromRoute === 'function') { try { m.fromRoute(r.arg); } catch (e) { console.error(e); } }
  };
  go(true);
  window.addEventListener('hashchange', () => go(false));
})();

