/* Shared by the popup and the background worker: the search over modules and ZIP codes, and finding or opening the atlas tab.
   Classic script: popup.html loads it with a script tag, background.js with importScripts. Needs registry.js first. */
"use strict";
(function (root) {
  const C = root.chrome;
  const REG = () => root.TDA_REGISTRY || { modules: [], zips: [] };
  const PAGE = 'atlas.html';
  const pageUrl = route => C.runtime.getURL(PAGE) + (route ? '#' + route : '');
  const norm = s => String(s == null ? '' : s).toLowerCase().trim();

  /* everything that can be opened: the modules, and every ZIP (in the Heat Desk) */
  function search(q) {
    const words = norm(q).split(/\s+/).filter(Boolean); if (!words.length) return [];
    const R = REG(); const out = [];
    for (const m of R.modules) {
      const text = norm(m.title + ' ' + m.desc + ' ' + m.key + ' module ' + m.num), t = norm(m.title); let s = 0, ok = true;
      for (const w of words) { if (!text.includes(w)) { ok = false; break; } s += t.startsWith(w) ? 4 : t.includes(w) ? 3 : 1; }
      if (ok) out.push({ route: m.key, title: m.title, sub: 'Module ' + m.num + ' · ' + m.desc, score: s + 1 });
    }
    for (const z of R.zips) {
      const text = norm(z[0] + ' ' + z[1] + ' ' + z[2]); let s = 0, ok = true;
      for (const w of words) { if (!text.includes(w)) { ok = false; break; } s += z[0] === w ? 6 : z[0].startsWith(w) ? 3 : norm(z[1]).startsWith(w) ? 2 : 1; }
      if (ok) out.push({ route: 'heat.' + z[0], title: z[0] + ' · ' + z[1], sub: z[2] + ' County · open in the Heat Desk', score: s, zip: true });
    }
    return out.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  }
  function resolve(text) {
    const t = norm(text); if (!t) return '';
    const R = REG(); if (R.modules.some(m => m.key === t)) return t;
    const r = search(t); return r.length ? r[0].route : '';
  }
  /* the atlas tab that is already open, if any: { tabId, windowId } */
  async function whereIsAtlas() {
    try {
      if (!C.runtime.getContexts) return null;
      const ctx = await C.runtime.getContexts({ contextTypes: ['TAB'] });
      const hit = (ctx || []).find(c => c.documentUrl && c.documentUrl.indexOf(C.runtime.getURL(PAGE)) === 0 && c.tabId >= 0);
      return hit ? { tabId: hit.tabId, windowId: hit.windowId } : null;
    } catch (e) { return null; }
  }
  /* open a route: in the atlas tab that is already open (a hash change, so the page keeps its state), else in a new tab */
  async function openRoute(route, opts) {
    opts = opts || {}; const url = pageUrl(route || '');
    if (!opts.newTab) {
      const w = await whereIsAtlas();
      if (w) {
        try { await C.tabs.update(w.tabId, route ? { active: true, url } : { active: true }); if (typeof w.windowId === 'number' && w.windowId >= 0) { try { await C.windows.update(w.windowId, { focused: true }); } catch (e) { } } return 'reused'; }
        catch (e) { /* that tab is gone: fall through */ }
      }
    }
    if (opts.currentTab) { try { await C.tabs.update({ url }); return 'current'; } catch (e) { /* fall through */ } }
    await C.tabs.create({ url });
    return 'new';
  }
  root.TDA_OPEN = { pageUrl, search, resolve, whereIsAtlas, openRoute };
})(typeof globalThis !== 'undefined' ? globalThis : self);
