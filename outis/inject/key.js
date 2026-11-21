/* Outis seed. Runs in the extension's isolated world at document_start, registered just ahead of inject/shield.js.
   The fingerprint noise must stay the same on one site for a whole browser session (or sites see it flicker and
   break) yet differ between sites and between sessions (or it becomes an identifier itself). The page script cannot
   read extension storage in time, so this script derives the seed and leaves it on <html> for the shield, which
   runs next, removes it and keeps it out of the page's reach.
   The secret is the id Chrome gives this extension's web-accessible files for the current browser session (it
   changes on every restart); the site is the top-level page's host, so frames on one page agree and the same
   embedded tracker sees different noise on different sites. Only the derived number reaches the page. */
(() => {
  /* The shield's safety alerts (a hidden clipboard command, a Windows-tool link) reach the toolbar button through here:
     the page's world cannot call the extension. A page can fake one of these events, which only adds a note to the
     popup, so each frame passes on at most 20 and only of the known kinds. */
  let relayed = 0;
  const KINDS = ['clipboard', 'pastejack', 'applink'];
  document.addEventListener('outis-alert', e => {
    const d = typeof e.detail === 'string' ? e.detail : '';
    const nl = d.indexOf('\n');
    const kind = nl > 0 ? d.slice(0, nl) : d;
    if (!KINDS.includes(kind) || ++relayed > 20) return;
    try { chrome.runtime.sendMessage({ type: 'alert', kind, detail: nl > 0 ? d.slice(nl + 1, nl + 161) : '' }).catch(() => {}); } catch (err) { /* extension reloaded */ }
  }, true);

  const SEED_ATTR = 'data-outis-seed', MARK_ATTR = 'data-outis-shield';
  const root = document.documentElement;
  if (!root) return;
  if (root.hasAttribute(MARK_ATTR)) { root.removeAttribute(MARK_ATTR); return; }   // the shield ran first and chose its own
  let session = '';
  try { session = new URL(chrome.runtime.getURL('inject/k')).host; } catch (e) { /* ignore */ }
  if (!session || session === chrome.runtime.id) {
    /* No per-session id in this Chrome: fall back to the install id and the UTC day. */
    session = chrome.runtime.id + '|' + Math.floor(Date.now() / 86400000);
  }
  let top = '';
  try {
    const a = location.ancestorOrigins;
    const o = a && a.length ? a[a.length - 1] : location.origin;
    top = o && o !== 'null' ? new URL(o).hostname : '';
  } catch (e) { /* ignore */ }
  if (!top) top = location.hostname || 'opaque';
  root.setAttribute(SEED_ATTR, String(cyrb53(session + '|' + top)));

  /* 53-bit string hash (public domain cyrb53). */
  function cyrb53(str) {
    let h1 = 0xdeadbeef ^ 0x9e3779b9, h2 = 0x41c6ce57 ^ 0x2545f491;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0) || 1;
  }
})();
