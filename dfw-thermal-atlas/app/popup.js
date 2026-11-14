/* The toolbar popup: this week's heating read, the state of the live data, and a launcher for modules and ZIP codes. */
"use strict";
(function () {
  const C = chrome, L = globalThis.TDA_LIVE, O = globalThis.TDA_OPEN, R = globalThis.TDA_REGISTRY || { modules: [], zips: [] };
  const $ = id => document.getElementById(id);
  const store = L.chromeStore(C.storage.local);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const when = t => t ? new Date(t).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'never';
  function ago(t) { if (!t) return 'never'; const m = (Date.now() - +new Date(t)) / 6e4; if (!(m >= 2)) return 'just now'; if (m < 90) return Math.round(m) + ' minutes ago'; const h = m / 60; if (h < 36) return Math.round(h) + ' hours ago'; const d = h / 24; return d < 14 ? Math.round(d) + ' days ago' : Math.round(d / 7) + ' weeks ago'; }
  const open = (route, e) => O.openRoute(route, { newTab: !!(e && (e.ctrlKey || e.metaKey)) }).then(() => window.close());

  $('ver').textContent = 'Build ' + (R.version || '') + (R.compiled ? ' · stock model compiled ' + R.compiled : '');
  $('goHeat').onclick = e => open('heat', e); $('goAtlas').onclick = e => open('', e); $('goLive').onclick = e => open('live', e);

  /* ---------- this week and the live status ---------- */
  async function paint() {
    const [state, settings, recs] = [await L.getState(store), await L.getSettings(store), await L.snapshot(store, null)];
    const ids = L.SOURCES.map(s => s.id);
    /* this week */
    let cold = null; try { cold = L.derive && L.derive.cold ? L.derive.cold(recs, new Date()) : null; } catch (e) { cold = null; }
    const week = $('week'), list = $('weekList'); list.textContent = ''; list.hidden = true;
    if (cold && cold.headline) {
      week.classList.toggle('cold', !!cold.active);
      $('weekEyebrow').textContent = cold.eyebrow || 'This week'; $('weekHead').textContent = cold.headline; $('weekSub').textContent = cold.sub || '';
      (cold.actions || []).slice(0, 3).forEach(a => list.appendChild(el('li', '', a))); list.hidden = !list.children.length;
    } else {
      week.classList.remove('cold'); $('weekEyebrow').textContent = 'This week';
      $('weekHead').textContent = state.lastWeekly ? 'No forecast in the store yet' : 'The first refresh has not run yet';
      $('weekSub').textContent = 'Refresh the live data to get the forecast lows, the cold triggers and this week\'s heating plan.';
    }
    /* the season so far and the two weeks ahead, when those records are in the store */
    const more = $('weekMore'); more.textContent = '';
    const line = (k, text) => { if (!text) return; const p = el('p'); p.appendChild(el('b', '', k + ' ')); p.appendChild(document.createTextNode(text)); more.appendChild(p); };
    try { if (L.climate && L.climate.headline && recs.acis_season && recs.acis_season.data) line('Season so far.', L.climate.headline(recs.acis_season.data, null, new Date())); } catch (e) { }
    try { const o = L.derive && L.derive.outlook ? L.derive.outlook(recs, new Date()) : null; if (o && o.ok && !o.stale && o.headline) line('Two weeks ahead.', o.headline); } catch (e) { }
    more.hidden = !more.children.length;
    /* status */
    const st = $('status'); st.textContent = '';
    const add = (k, v, cls) => { st.appendChild(el('span', '', k)); const b = el('b'); if (cls) { const d = el('span', 'dot ' + cls); b.appendChild(d); } b.appendChild(document.createTextNode(v)); st.appendChild(b); };
    const age = state.lastWeekly ? Date.now() - +new Date(state.lastWeekly) : Infinity;
    add('Full refresh', state.lastWeekly ? when(state.lastWeekly) + ' (' + ago(state.lastWeekly) + ')' : 'not yet', age <= L.WEEK * 1.15 ? '' : age <= L.WEEK * 2.2 ? 'aging' : 'stale');
    if (settings.daily !== false) add('Weather pulse', state.lastDaily ? ago(state.lastDaily) : 'not yet');
    add('Next full refresh', when(L.nextWeekly(new Date(), settings.weeklyDow, settings.weeklyHour)));
    /* current means what it means in Live Data: fetched without a failure and still inside its schedule (a week, or a day for the weather sources) */
    const inside = id => { const r = recs[id]; return !!(r && r.data != null && r.ok !== false && r.at && Date.now() - +new Date(r.at) <= (L.BY_ID[id].cadence === 'daily' ? L.DAY : L.WEEK) * 1.15); };
    const good = ids.filter(inside).length, failed = ids.filter(id => recs[id] && recs[id].ok === false);
    add('Sources', ids.length ? good + ' of ' + ids.length + ' current' : 'none registered');
    const note = $('liveNote'); note.textContent = '';
    if (state.running && Date.now() - +new Date(state.running.since) < 6 * L.MIN) note.appendChild(el('div', 'note busy', 'A refresh is running now.'));
    else if (failed.length) note.appendChild(el('div', 'note bad', failed.length + (failed.length === 1 ? ' source' : ' sources') + ' failed on the last run and ' + (failed.some(id => recs[id].data != null) ? 'kept their previous data' : 'have no data yet') + ': ' + failed.map(id => L.BY_ID[id].name).join(', ') + '.'));
    $('refresh').disabled = !!(state.running && Date.now() - +new Date(state.running.since) < 6 * L.MIN);
  }
  $('refresh').onclick = () => {
    $('refresh').disabled = true; $('refresh').textContent = 'Refreshing in the background';
    try { C.runtime.sendMessage({ type: 'tda.live.refresh', scope: 'weekly' }, () => { void C.runtime.lastError; $('refresh').textContent = 'Refresh everything now'; paint(); }); } catch (e) { paint(); }
    setTimeout(paint, 400);
  };
  C.storage.onChanged.addListener((ch, area) => { if (area === 'local' && Object.keys(ch).some(k => k.indexOf('tda.live.') === 0)) paint(); });
  paint();

  /* ---------- launcher ---------- */
  const listEl = $('list');
  function row(r) {
    const b = el('button', 'row'); b.type = 'button'; b.setAttribute('role', 'listitem');
    b.appendChild(el('span', 'k', r.zip ? 'ZIP' : (r.num || ''))); const d = el('div'); d.appendChild(el('div', 't', r.title)); d.appendChild(el('div', 's', r.sub)); b.appendChild(d);
    b.onclick = e => open(r.route, e); return b;
  }
  function draw(q) {
    listEl.textContent = '';
    const rows = q ? O.search(q).slice(0, 12).map(r => Object.assign({ num: (R.modules.find(m => m.key === r.route) || {}).num }, r)) : R.modules.map(m => ({ route: m.key, title: m.title, sub: m.desc, num: m.num }));
    if (!rows.length) { listEl.appendChild(el('p', 'empty', 'Nothing matches. Try a module name, a city or a five digit ZIP code.')); return; }
    rows.forEach(r => listEl.appendChild(row(r)));
  }
  $('q').addEventListener('input', e => draw(e.target.value.trim()));
  $('q').addEventListener('keydown', e => { if (e.key === 'Enter') { const first = listEl.querySelector('.row'); if (first) first.click(); } });
  draw('');
})();
