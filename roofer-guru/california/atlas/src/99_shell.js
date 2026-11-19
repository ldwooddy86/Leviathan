if (!document.documentElement.lang) document.documentElement.lang = 'en';
/* ==== 99_shell.js ==== */
/* ==== src/99_shell.js ==== */
/* ==== shell ==== */
(function boot() {
  const t = store.get('up.theme', null); if (t === 'dark' || t === 'light') document.documentElement.dataset.theme = t;
  BRANDX.apply();
  const rail = document.querySelector('#rail .in');
  rail.innerHTML = MODS.map(m => `<button type="button" id="tab-${m.key}" role="tab" aria-selected="false" aria-controls="mod-${m.key}"><span class="n">${m.num}</span><span class="t">${esc(m.title)}</span><span class="d">${esc(m.desc)}</span></button>`).join('');
  document.getElementById('modules').innerHTML = MODS.map(m => `<section class="module" id="mod-${m.key}" role="tabpanel" aria-labelledby="tab-${m.key}" hidden></section>`).join('');
  $$('#rail button').forEach(b => b.addEventListener('click', () => showModule(b.id.slice(4))));
  document.getElementById('shellFacts').insertAdjacentHTML('afterend', '<button class="tbtn" id="brandBtn" title="Company settings: name, LSLBC license, qualifying party, offices, service area, colors">⚙ Company</button>'); document.getElementById('brandBtn').onclick = () => BRANDX.panel();
  document.getElementById('shellFacts').innerHTML = `<span><b>64</b> parishes</span><span><b>${K(META.roofs)}</b> one unit roofs</span><span><b>${K(META.ra20)}</b> roofs 20+ years old</span><span><b>${N(META.nstorm)}</b> storms tracked</span><span><b>${K(META.npts)}</b> hail, wind and tornado reports</span><span><b>${PL.length}</b> service lines</span><span><b>${COMP.length}</b> roofers watched</span>`;
  const h = (location.hash || '').slice(1); showModule(MODI[h] ? h : 'index');
  window.addEventListener('hashchange', () => { const k = (location.hash || '').slice(1); if (MODI[k] && $('#mod-' + k).hidden) showModule(k); });
})();