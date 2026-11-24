/* second half of the mount test: back to the map, the host untouched, settings, unmount, mount again */
const wait = ms => new Promise(r => setTimeout(r, ms));
const clean = s => String(s || '').replace(/\s+/g, ' ').trim();
const out = { checks: [] }; const ok = (c, m, d) => out.checks.push([!!c, m, d === undefined ? null : d]);
const cs = (sel, prop) => getComputedStyle(document.querySelector(sel))[prop];
const mem = () => performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null;
const L = window.__LEGION__, h = L.mounted, FD = h.frame.contentDocument, FW = h.window, FL = h.legion, host0 = arg.host0;
if (arg.phase === 'street-close') {
  FD.dispatchEvent(new FW.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await wait(1200);
  ok(!FL.street && !FD.body.hasAttribute('data-street-open'), 'Escape inside the frame closes the street view');
  ok(HOST.keys === 0, 'keys pressed inside the frame do not reach the host document', HOST.keys);
  FL.npcPanel.close(); await wait(300); FL.place('90012'); await wait(1500); FL.stage.flyToBBox([2840, 4515, 2862, 4540], { ms: 0, maxScale: 60 }); await wait(2500);
  return out;
}
/* the host is as it was */
const host1 = { title: document.title, h1: cs('#host-title', 'color'), btn: cs('#host-button', 'backgroundColor'), font: cs('body', 'fontFamily'), bg: cs('body', 'backgroundColor'), panel: cs('#host-note', 'backgroundColor'), topbar: cs('#topbar', 'backgroundColor'),
  mapSize: HOST.map.getSize().x + 'x' + HOST.map.getSize().y, attrs: [...document.documentElement.attributes].map(a => a.name).join(','), bodyAttrs: [...document.body.attributes].map(a => a.name).join(','), kids: document.body.children.length, toasts: document.querySelector('#toasts').children.length };
ok(JSON.stringify(host1) === JSON.stringify(host0), "the host's title, styles, <html> and <body> attributes, #toasts and child count are unchanged", host1);
ok(location.hash === '#rooftops', "the host's hash is its own (Legion writes its hash in the frame)", { host: location.hash, frame: FW.location.hash, frameHref: FW.location.href.slice(0, 40) });
const c0 = HOST.map.getCenter(); HOST.map.panBy([120, 40], { animate: false }); const c1 = HOST.map.getCenter(); HOST.map.setZoom(16, { animate: false });
ok(Math.abs(c0.lng - c1.lng) > 1e-5 && HOST.map.getZoom() === 16 && HOST.layer.getLayers().length > 20, 'the host Leaflet map still pans, zooms and holds its layer', { zoom: HOST.map.getZoom(), layers: HOST.layer.getLayers().length });
ok(!window.legion && document.querySelectorAll('#stage').length === 1 && document.querySelectorAll('#topbar').length === 1 && !document.querySelector('#place-panel') && !document.querySelector('.boot'), "none of Legion's markup or globals is in the host document", { legion: typeof window.legion });
ok(!document.querySelector('style[data-legion]') && [...document.styleSheets].length === arg.sheets, 'no stylesheet was added to the host document', [...document.styleSheets].length);
ok(HOST.errors.length === 0, 'no error reached the host window', HOST.errors);
/* settings: the dashboard's key, in the frame and in the library */
FD.querySelector('#theme-button').click(); await wait(500);
const ls = Object.keys(localStorage).sort();
ok(ls.includes('cg.legion.v1') && !ls.some(k => k.startsWith('legion.')) && ls.includes('cg.host.v1'), 'the frame keeps its settings under cg.legion.v1, nothing under legion.*, the host key untouched', ls);
ok(L.settings.get().theme === 'light' && FD.documentElement.getAttribute('data-theme') === 'light' && !document.documentElement.hasAttribute('data-theme'), 'a theme changed in the frame is what settings.get() reads; the host <html> has no theme attribute', L.settings.get());
const s2 = L.settings.set({ theme: 'dark', density: 0.01 }); await wait(400);
ok(s2.theme === 'dark' && s2.density === 0.01 && FL.settings.values.density === 0.01 && FD.documentElement.getAttribute('data-theme') === 'dark', 'settings.set() from the host is stored and reaches the mounted view', s2);
let threw = false; try { L.settings.set({ claude: { apiKey: 'x' } }); } catch (e) { threw = true; }
ok(threw && !('apiKey' in L.settings.get().claude), 'the library neither takes nor gives a key', L.settings.get().claude);
L.settings.set({ density: 0.025 });
const idb = indexedDB.databases ? (await indexedDB.databases()).map(d => d.name).sort() : null;
ok(!idb || (idb.includes('cg.legion.crowd') && !idb.includes('legion-crowd')), 'the built crowd is cached in IndexedDB cg.legion.crowd, not legion-crowd', idb);
out.mem = { beforeUnmount: mem() };
/* unmount */
ok(L.unmount() === true && !document.querySelector('iframe') && L.mounted === null, 'unmount() removes the frame');
await wait(1500); out.mem.afterUnmount = mem();
ok(HOST.map.getSize().x === 420 && L.npc('90012-0-0').name.display === 'Kamla Jindal', 'the host map and the library work after unmount');
/* mount again, another place, and unmount */
const h2 = L.mount(document.querySelector('#legion-host'), { zip: '92277' }); await h2.ready; await wait(1500);
ok(clean((h2.frame.contentDocument.querySelector('#place-panel h2') || {}).textContent) === 'Twentynine Palms' && document.querySelectorAll('iframe').length === 1, 'mount() again works (one frame, on 92277)', clean((h2.frame.contentDocument.querySelector('#place-panel h2') || {}).textContent));
out.stats = L.stats();
return out;
