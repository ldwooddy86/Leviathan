/* Outis background service worker.
   Turns settings (lib/settings.js, chrome.storage.local) into browser state, every time they change:
     request rules     the tracker list and link cleaning (static rulesets), the privacy headers and paused sites
                       (dynamic rules: lib/rules.js)
     Chrome settings   third-party cookies, related-website sets, WebRTC routing, ad topics, ad measurement,
                       hyperlink pings (chrome.privacy), location refused (chrome.contentSettings), the proxy
     page scripts      inject/key.js and inject/shield.js, registered for every frame at document_start with the
                       generated option files for the current settings, paused sites excluded
   and forgets sites: when the last tab of a site closes, after a short delay, its cookies and storage are deleted
   (chrome.browsingData), unless the site is kept or paused. Chrome reverts every setting Outis changed if Outis is
   switched off or removed. Nothing here talks to any server. */
import { DEFAULTS, load, save, shieldFiles, shieldNeeded } from './lib/settings.js';
import { siteOfUrl, patternsFor, contentPatternFor, baseOrigins, normalizeSite } from './lib/sites.js';
import { dynamicRules } from './lib/rules.js';
import { categoryOfUrl } from './lib/trackers.js';

const SCRIPT_IDS = ['outis-key', 'outis-shield'];
const ICON = { 16: 'icons/icon16.png', 32: 'icons/icon32.png', 48: 'icons/icon48.png', 128: 'icons/icon128.png' };
const ICON_OFF = { 16: 'icons/off16.png', 32: 'icons/off32.png', 48: 'icons/off48.png', 128: 'icons/off128.png' };
const DATA_TYPES = { cookies: true, localStorage: true, indexedDB: true, cacheStorage: true, serviceWorkers: true, fileSystems: true, cache: true };

/* One thing at a time: settings changes and tab events touch the same state. */
let chain = Promise.resolve();
function queue(fn) {
  const run = chain.then(fn, fn);
  chain = run.catch(e => { const m = String((e && e.message) || e); if (!/shutting down/i.test(m)) console.warn('Outis:', m); });
  return run;
}

/* ================= applying settings ================= */
function applyAll() {
  return queue(async () => {
    const s = await load();
    const steps = { rulesets, dynamic, privacy, location, proxy, scripts, icons, visits };
    const names = Object.keys(steps);
    const results = await Promise.allSettled(names.map(n => steps[n](s)));
    const failed = {};
    results.forEach((r, i) => { if (r.status === 'rejected') failed[names[i]] = String((r.reason && r.reason.message) || r.reason); });
    await chrome.storage.session.set({ applied: { at: Date.now(), failed } });
    return failed;
  });
}

/* Without forgetting there is no reason to keep any record of visited sites. */
async function visits(s) {
  if (!s.enabled || !s.forget) await chrome.storage.local.remove('seen');
}

async function rulesets(s) {
  const want = { trackers: s.enabled && s.trackers, params: s.enabled && s.links };
  const on = await chrome.declarativeNetRequest.getEnabledRulesets();
  const enableRulesetIds = Object.keys(want).filter(k => want[k] && !on.includes(k));
  const disableRulesetIds = Object.keys(want).filter(k => !want[k] && on.includes(k));
  if (enableRulesetIds.length || disableRulesetIds.length) await chrome.declarativeNetRequest.updateEnabledRulesets({ enableRulesetIds, disableRulesetIds });
}

async function dynamic(s) {
  const old = await chrome.declarativeNetRequest.getDynamicRules();
  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: old.map(r => r.id), addRules: dynamicRules(s) });
}

/* Chrome settings: set when wanted, cleared (back to the person's own choice) when not. */
async function pref(setting, value) {
  if (!setting) return null;
  if (value === undefined) { await setting.clear({}); return (await setting.get({})).levelOfControl; }
  const cur = await setting.get({});
  if (cur.levelOfControl === 'not_controllable' || cur.levelOfControl === 'controlled_by_other_extensions') return cur.levelOfControl;
  if (cur.value !== value || cur.levelOfControl !== 'controlled_by_this_extension') await setting.set({ value });
  return 'controlled_by_this_extension';
}
async function privacy(s) {
  const P = chrome.privacy, on = s.enabled, control = {};
  control.webrtc = await pref(P.network.webRTCIPHandlingPolicy, on && s.webrtc ? (s.proxy.on ? 'disable_non_proxied_udp' : 'default_public_interface_only') : undefined);
  control.cookies = await pref(P.websites.thirdPartyCookiesAllowed, on && s.cookies ? false : undefined);
  await pref(P.websites.relatedWebsiteSetsEnabled, on && s.cookies ? false : undefined);
  for (const k of ['hyperlinkAuditingEnabled', 'topicsEnabled', 'fledgeEnabled', 'adMeasurementEnabled']) {
    await pref(P.websites[k], on && s.trackers ? false : undefined);
  }
  await chrome.storage.session.set({ control });
}

/* Location: refused for every site (paused sites go back to asking). Fake mode refuses too: the page script answers
   with the place's coordinates and the real position is never read. */
async function location(s) {
  const cs = chrome.contentSettings.location;
  await cs.clear({});
  if (!s.enabled || s.location === 'off') return;
  await cs.set({ primaryPattern: '<all_urls>', setting: 'block' });
  for (const site of s.paused) {
    const p = contentPatternFor(site);
    if (p) { try { await cs.set({ primaryPattern: p, setting: 'ask' }); } catch (e) { /* an unusual host name */ } }
  }
}

async function proxy(s) {
  const p = s.proxy;
  if (s.enabled && p.on) {
    await chrome.proxy.settings.set({
      scope: 'regular',
      value: { mode: 'fixed_servers', rules: { singleProxy: { scheme: p.scheme, host: p.host, port: p.port }, bypassList: ['<local>'] } }
    });
  } else {
    await chrome.proxy.settings.clear({ scope: 'regular' });
  }
}

async function scripts(s) {
  const existing = (await chrome.scripting.getRegisteredContentScripts()).filter(x => SCRIPT_IDS.includes(x.id));
  if (!shieldNeeded(s)) {
    if (existing.length) await chrome.scripting.unregisterContentScripts({ ids: existing.map(x => x.id) });
    return;
  }
  const base = {
    matches: ['<all_urls>'], excludeMatches: s.paused.flatMap(patternsFor), runAt: 'document_start',
    allFrames: true, matchOriginAsFallback: true, persistAcrossSessions: true
  };
  /* The key script must come first: it leaves the seed the shield picks up. */
  const want = [
    Object.assign({ id: 'outis-key', js: ['inject/key.js'], world: 'ISOLATED' }, base),
    Object.assign({ id: 'outis-shield', js: shieldFiles(s), world: 'MAIN' }, base)
  ];
  const same = existing.length === 2 && want.every(w => {
    const e = existing.find(x => x.id === w.id);
    return e && JSON.stringify(e.js) === JSON.stringify(w.js) && JSON.stringify(e.excludeMatches || []) === JSON.stringify(w.excludeMatches);
  });
  if (same) return;
  if (existing.length) await chrome.scripting.unregisterContentScripts({ ids: existing.map(x => x.id) });
  await chrome.scripting.registerContentScripts(want);
}

async function icons(s) {
  await chrome.declarativeNetRequest.setExtensionActionOptions({ displayActionCountAsBadgeText: false });
  await chrome.action.setBadgeBackgroundColor({ color: '#2b6f62' });
  if (chrome.action.setBadgeTextColor) await chrome.action.setBadgeTextColor({ color: '#ffffff' });
  await chrome.action.setIcon({ path: s.enabled ? ICON : ICON_OFF });
  for (const t of await chrome.tabs.query({})) if (t.id >= 0) await tabIcon(t.id, t.url || t.pendingUrl || '', s);
}
async function tabIcon(tabId, url, s) {
  const site = siteOfUrl(url);
  const off = !s.enabled || (site && s.paused.includes(site));
  const title = !s.enabled ? 'Outis is off' : off ? `Outis is paused on ${site}` : 'Outis';
  try {
    await chrome.action.setIcon({ tabId, path: off ? ICON_OFF : ICON });
    await chrome.action.setTitle({ tabId, title });
    if (off) await chrome.action.setBadgeText({ tabId, text: '' });
  } catch (e) { /* the tab closed */ }
}

/* ================= trackers blocked per tab ================= */
/* Counted from what actually failed to load: a blocked request (net::ERR_BLOCKED_BY_CLIENT) or a redirect to one of
   the stand-ins, kept only when the address is on the tracker list. Listening to every rule match instead would wake
   this worker for every request (the header rules match them all), and getMatchedRules allows 20 calls in 10 minutes. */
const tabCounts = new Map();   // tabId -> { total, cats: {key: n}, hosts: {host: n} }
let countsReady = null;
function counts() {
  if (!countsReady) countsReady = chrome.storage.session.get('counts').then(({ counts: c = {} }) => { for (const k of Object.keys(c)) if (!tabCounts.has(+k)) tabCounts.set(+k, c[k]); return tabCounts; });
  return countsReady;
}
let countsTimer = null;
function persistCounts() {
  if (countsTimer) return;
  countsTimer = setTimeout(() => { countsTimer = null; chrome.storage.session.set({ counts: Object.fromEntries(tabCounts) }); }, 800);
}
let badgeTimer = null;
const dirtyTabs = new Set();
function badgeSoon(tabId) {
  dirtyTabs.add(tabId);
  if (badgeTimer) return;
  badgeTimer = setTimeout(async () => {
    badgeTimer = null;
    const ids = [...dirtyTabs]; dirtyTabs.clear();
    const s = await load(), m = await counts();
    for (const id of ids) {
      const n = s.enabled && s.trackers ? ((m.get(id) || {}).total || 0) : 0;
      try { await chrome.action.setBadgeText({ tabId: id, text: n ? (n > 999 ? '999+' : String(n)) : '' }); } catch (e) { /* closed */ }
    }
  }, 400);
}
function blocked(tabId, url) {
  const cat = categoryOfUrl(url);
  if (!cat) return;
  counts().then(m => {
    let c = m.get(tabId);
    if (!c) m.set(tabId, c = { total: 0, cats: {}, hosts: {} });
    c.total++;
    c.cats[cat] = (c.cats[cat] || 0) + 1;
    let host = '';
    try { host = new URL(url).hostname; } catch (e) { /* ignore */ }
    if (host && (c.hosts[host] || Object.keys(c.hosts).length < 60)) c.hosts[host] = (c.hosts[host] || 0) + 1;
    badgeSoon(tabId);
    persistCounts();
  });
}
chrome.webRequest.onErrorOccurred.addListener(d => { if (d.tabId >= 0 && d.error === 'net::ERR_BLOCKED_BY_CLIENT') blocked(d.tabId, d.url); }, { urls: ['<all_urls>'] });
chrome.webRequest.onBeforeRedirect.addListener(d => { if (d.tabId >= 0 && String(d.redirectUrl).startsWith(chrome.runtime.getURL('surrogates/'))) blocked(d.tabId, d.url); }, { urls: ['<all_urls>'] });
/* A new page in a tab starts its count again. */
chrome.webRequest.onBeforeRequest.addListener(d => {
  if (d.tabId >= 0 && d.frameId === 0) counts().then(m => { if (m.delete(d.tabId)) { badgeSoon(d.tabId); persistCounts(); } });
}, { urls: ['<all_urls>'], types: ['main_frame'] });

/* ================= proxy sign-in ================= */
const authTries = new Map();
chrome.webRequest.onAuthRequired.addListener((details, callback) => {
  if (!details.isProxy) { callback({}); return; }
  load().then(s => {
    const p = s.proxy;
    const n = (authTries.get(details.requestId) || 0) + 1;
    authTries.set(details.requestId, n);
    if (authTries.size > 500) authTries.clear();
    if (s.enabled && p.on && p.user && n <= 2) callback({ authCredentials: { username: p.user, password: p.pass } });
    else callback({});
  }, () => callback({}));
}, { urls: ['<all_urls>'] }, ['asyncBlocking']);

/* ================= forgetting sites ================= */
/* storage.session: tabs {tabId: site}, pending {site: due time}. storage.local: seen {site: {o: [origins], t}}, the
   origins whose storage to clear, kept only while forgetting is on and only until the site is forgotten; stats
   {forgotten, last}: a count and a time, never which sites. */
async function getSession() {
  const { tabs = {}, pending = {} } = await chrome.storage.session.get(['tabs', 'pending']);
  return { tabs, pending };
}
const setSession = st => chrome.storage.session.set({ tabs: st.tabs, pending: st.pending });
async function getSeen() { const { seen = {} } = await chrome.storage.local.get('seen'); return seen; }
const setSeen = seen => chrome.storage.local.set({ seen });

async function remember(site, url, s) {
  if (!s.enabled || !s.forget || s.kept.includes(site) || s.paused.includes(site)) return;
  let origin = '';
  try { origin = new URL(url).origin; } catch (e) { return; }
  const seen = await getSeen();
  const e = seen[site] || { o: [], t: 0 };
  const fresh = !e.o.includes(origin);
  if (!fresh && Date.now() - e.t < 3600000) return;
  if (fresh) { e.o.push(origin); if (e.o.length > 24) e.o.splice(0, e.o.length - 24); }
  e.t = Date.now();
  seen[site] = e;
  const keys = Object.keys(seen);
  if (keys.length > 3000) { keys.sort((a, b) => seen[a].t - seen[b].t); for (const k of keys.slice(0, keys.length - 3000)) delete seen[k]; }
  await setSeen(seen);
}

function wantsForget(site, s) {
  return !!site && s.enabled && s.forget && !s.kept.includes(site) && !s.paused.includes(site);
}

async function schedule(site, s, st) {
  if (!wantsForget(site, s) || s.forgetDelay < 0) return;
  const delay = s.forgetDelay * 1000;
  st.pending[site] = Date.now() + delay;
  setTimeout(() => queue(() => sweep(false)), delay + 250);
  await chrome.alarms.create('outis-forget', { when: Date.now() + Math.max(30000, delay) + 500 });
}

async function openSites() {
  const open = new Set();
  for (const t of await chrome.tabs.query({})) {
    if (t.incognito) continue;
    for (const u of [t.url, t.pendingUrl]) { const x = siteOfUrl(u || ''); if (x) open.add(x); }
  }
  return open;
}

async function sweep(all) {
  const s = await load();
  const st = await getSession();
  const open = await openSites();
  const now = Date.now();
  let next = Infinity;
  for (const site of Object.keys(st.pending)) {
    if (open.has(site) || !wantsForget(site, s)) { delete st.pending[site]; continue; }
    if (!all && st.pending[site] > now + 200) { next = Math.min(next, st.pending[site]); continue; }
    delete st.pending[site];
    await forgetSite(site);
  }
  await setSession(st);
  if (next < Infinity) await chrome.alarms.create('outis-forget', { when: Math.max(next, now + 30000) });
}

async function forgetSite(site) {
  if (!site) return;
  const seen = await getSeen();
  const origins = new Set(baseOrigins(site));
  for (const o of (seen[site] && seen[site].o) || []) origins.add(o);
  await chrome.browsingData.remove({ origins: [...origins] }, DATA_TYPES);
  /* Cookies an embedded service kept in this site's partition (CHIPS) are not covered by the origins above. */
  try {
    for (const scheme of ['https://', 'http://']) {
      const list = await chrome.cookies.getAll({ partitionKey: { topLevelSite: scheme + site } });
      for (const c of list) {
        if (!c.partitionKey) continue;
        const host = c.domain.replace(/^\./, '');
        await chrome.cookies.remove({ url: (c.secure ? 'https://' : 'http://') + host + c.path, name: c.name, storeId: c.storeId, partitionKey: c.partitionKey });
      }
    }
  } catch (e) { /* partitioned cookies are not supported here */ }
  delete seen[site];
  await setSeen(seen);
  const { stats = {} } = await chrome.storage.local.get('stats');
  await chrome.storage.local.set({ stats: { forgotten: (stats.forgotten || 0) + 1, last: Date.now() } });
}

async function onTab(tabId, tab) {
  const s = await load();
  const url = (tab && (tab.url || tab.pendingUrl)) || '';
  await tabIcon(tabId, url, s);
  if (!tab || tab.incognito) return;
  const site = siteOfUrl(url);
  const st = await getSession();
  const prev = st.tabs[tabId];
  if (site) { st.tabs[tabId] = site; await remember(site, url, s); } else delete st.tabs[tabId];
  if (prev && prev !== site) await schedule(prev, s, st);
  if (site) delete st.pending[site];
  await setSession(st);
}
async function onTabGone(tabId) {
  const s = await load();
  const st = await getSession();
  const prev = st.tabs[tabId];
  delete st.tabs[tabId];
  if (prev) await schedule(prev, s, st);
  await setSession(st);
}
/* Tabs already open when Outis starts. */
async function seedTabs() {
  const s = await load();
  const st = await getSession();
  for (const t of await chrome.tabs.query({})) {
    if (t.incognito || !(t.id >= 0)) continue;
    const site = siteOfUrl(t.url || t.pendingUrl || '');
    if (site) { st.tabs[t.id] = site; await remember(site, t.url || t.pendingUrl, s); }
  }
  await setSession(st);
}
/* After a browser start: every site seen before that is not open again (session restore had its chance) and is
   not kept is forgotten now. This is also when "forget at the next start" happens. */
async function startupSweep() {
  const s = await load();
  if (!s.enabled || !s.forget) return;
  const st = await getSession();
  for (const site of Object.keys(await getSeen())) if (wantsForget(site, s)) st.pending[site] = 0;
  await setSession(st);
  await sweep(true);
}

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.url || info.status === 'loading') queue(() => onTab(tabId, tab));
});
chrome.tabs.onRemoved.addListener(tabId => {
  counts().then(m => { if (m.delete(tabId)) persistCounts(); });
  queue(() => onTabGone(tabId));
});
chrome.tabs.onReplaced.addListener((added, removed) => queue(async () => {
  await onTabGone(removed);
  try { await onTab(added, await chrome.tabs.get(added)); } catch (e) { /* gone */ }
}));
chrome.alarms.onAlarm.addListener(a => {
  if (a.name === 'outis-forget') queue(() => sweep(false));
  if (a.name === 'outis-startup') queue(startupSweep);
});

/* ================= lifecycle and messages ================= */
chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  await chrome.storage.session.set({ installed: { reason, at: Date.now() } });
  const got = await chrome.storage.local.get('settings');
  if (!got.settings) await save(DEFAULTS);
  await applyAll();
  await queue(seedTabs);
  if (reason === 'install') await chrome.tabs.create({ url: chrome.runtime.getURL('options.html#welcome') });
});
chrome.runtime.onStartup.addListener(async () => {
  await applyAll();
  await queue(seedTabs);
  await chrome.alarms.create('outis-startup', { when: Date.now() + 20000 });
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.settings) applyAll();
});
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (!msg || sender.id !== chrome.runtime.id || !String(sender.url || '').startsWith(chrome.runtime.getURL(''))) return false;
  if (msg.type === 'forget') {
    const site = normalizeSite(msg.site);
    queue(() => forgetSite(site)).then(() => reply({ ok: true, site }), e => reply({ ok: false, error: String((e && e.message) || e) }));
    return true;
  }
  if (msg.type === 'apply') {
    applyAll().then(failed => reply({ ok: true, failed }), e => reply({ ok: false, error: String(e) }));
    return true;
  }
  if (msg.type === 'count') {
    counts().then(m => reply({ ok: true, counts: m.get(msg.tabId) || { total: 0, cats: {}, hosts: {} } }));
    return true;
  }
  return false;
});

/* Test hook: the end-to-end suite drives these directly from the service worker. */
self.outis = { applyAll, sweep: all => queue(() => sweep(all)), forgetSite: site => queue(() => forgetSite(site)), startupSweep: () => queue(startupSweep), seedTabs: () => queue(seedTabs) };
