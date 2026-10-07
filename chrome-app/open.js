/* Shared by the popup and the background: the registry search, and finding or opening the console tab.
   Classic script: popup.html loads it with a script tag, background.js with importScripts. Needs registry.js first. */
"use strict";
(function () {
  const B = globalThis.browser || globalThis.chrome;
  const REG = () => globalThis.LV_REGISTRY || { modules: [], wings: [], views: [] };
  const APP = 'app.html', SETTINGS = 'leviathan.popup.v1';
  const appUrl = route => B.runtime.getURL(APP) + (route ? '#' + route : '');
  const norm = s => String(s == null ? '' : s).toLowerCase();

  /* titles the way the console's spine shows them */
  function modTitle(m) { return m.id === 'core' ? 'OmegaWeapon' : m.wing === 'core' ? m.short : (m.navTitle || m.vertical || m.short); }
  function modSub(m) {
    if (m.id === 'core') return 'Agency Radar · Horus · Offshore · Targets';
    if (m.wing === 'core') return [m.name, (m.facts || [])[0]].filter(Boolean).join(' · ');
    return [m.short, m.scope].filter(Boolean).join(' · ');
  }
  /* everything that can be opened: the console views, the wings, the atlases, their modules */
  function entries() {
    const R = REG(); const out = [];
    for (const v of (R.views || [])) out.push({ route: v.route, title: v.title, sub: v.sub, view: true, text: norm(v.title + ' ' + v.sub) });
    for (const w of (R.wings || [])) if (w.id !== 'core') out.push({ route: w.id, title: w.label, sub: 'Wing · ' + w.mods.length + (w.mods.length === 1 ? ' atlas' : ' atlases'), view: true, wing: w.id, text: norm(w.label + ' wing') });
    for (const m of (R.modules || [])) {
      const title = modTitle(m), sub = modSub(m);
      out.push({ route: m.id, title, sub, id: m.id, wing: m.wing, text: norm([m.short, m.name, m.title, m.vertical, m.navTitle, m.wingLabel, m.scope, m.sub].join(' ')) });
      for (const x of (m.mods || [])) out.push({ route: m.id + '.' + x.key, title: x.title, sub: title + (x.num ? ' · module ' + x.num : ''), id: m.id, key: x.key, wing: m.wing, text: norm([x.title, x.desc, m.short, m.vertical].join(' ')) });
    }
    return out;
  }
  function search(q) {
    const words = norm(q).split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    return entries().map(e => {
      let s = 0; const t = norm(e.title);
      for (const w of words) { if (!e.text.includes(w)) return null; s += t.startsWith(w) ? 3 : t.includes(w) ? 2 : 1; }
      if (!e.key) s += 1;
      return Object.assign({ score: s }, e);
    }).filter(Boolean).sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  }
  /* a route the console understands, passed through as typed; anything else is searched */
  function isRoute(t) {
    if (entries().some(e => e.route === t)) return true;
    return /^convergence\.\d{5}$/.test(t) || /^agencies\.\S+$/.test(t);
  }
  function resolve(text) {
    const t = String(text || '').trim();
    if (!t) return 'command';
    if (isRoute(t)) return t;
    const r = search(t); return r.length ? r[0].route : 'command';
  }

  const tell = msg => new Promise(res => { try { B.runtime.sendMessage(msg, r => { void (B.runtime.lastError); res(r); }); } catch (e) { res(undefined); } });
  /* an open wrapper tab answers {tabId, windowId}; none answering within 400 ms means there is none */
  function whereIsConsole() {
    return Promise.race([tell({ lv: 'where' }), new Promise(res => setTimeout(() => res(null), 400))])
      .then(r => (r && typeof r.tabId === 'number' ? r : null));
  }
  async function newTabSetting() { try { const r = await B.storage.local.get(SETTINGS); return !!(r && r[SETTINGS] && r[SETTINGS].newTab); } catch (e) { return false; } }
  /* Open a route. Unless the popup's "Open in a new tab" setting (or opts.newTab) says otherwise, the console tab that is
     already open takes it, so its live atlases stay live: the wrapper page navigates and brings its own tab and window forward
     (a popup that focused another window would be closed before it could finish). An empty route only brings the console forward.
     opts.currentTab navigates the current tab instead of creating one; opts.active false opens the new tab in the background. */
  async function openRoute(route, opts) {
    opts = opts || {}; route = route || '';
    const newTab = typeof opts.newTab === 'boolean' ? opts.newTab : await newTabSetting();
    if (!newTab) {
      const w = await whereIsConsole();
      if (w) { const r = await tell({ lv: 'go', route, tabId: w.tabId, focus: true }); if (r && r.ok) return 'reused'; }
    }
    if (opts.currentTab) { try { await B.tabs.update({ url: appUrl(route) }); return 'current'; } catch (e) { /* fall through */ } }
    await B.tabs.create({ url: appUrl(route), active: opts.active !== false });
    return 'new';
  }
  globalThis.LV_OPEN = { appUrl, modTitle, modSub, entries, search, isRoute, resolve, whereIsConsole, openRoute };
})();
