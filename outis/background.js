/* Outis background service worker.
   Turns settings (lib/settings.js, chrome.storage.local) into browser state, every time they change:
     request rules     the tracker list and link cleaning (static rulesets), the privacy headers and paused sites
                       (dynamic rules: lib/rules.js)
     Chrome settings   third-party cookies, related-website sets, WebRTC routing, ad topics, ad measurement,
                       hyperlink pings (chrome.privacy), location refused (chrome.contentSettings), the proxy
     page scripts      inject/key.js and inject/shield.js, registered for every frame at document_start with the
                       generated option files for the current settings, paused sites excluded
   and forgets sites: when the last tab of a site closes, after a short delay, its cookies and storage are deleted
   (chrome.browsingData), unless the site is kept or paused.
   Safety: the malware ruleset, Safe Browsing kept on, notification and clipboard-reading requests refused and
   automatic downloads blocked (chrome.contentSettings), every page upgraded to HTTPS with a warning page when a site
   has none, downloads checked before they can be opened, and the shield's alerts (clipboard, Windows-tool links)
   recorded per tab and shown with a red badge. Kept sites are trusted: they get a shield without the hardening.
   Chrome reverts every setting Outis changed if Outis is switched off or removed. Nothing here talks to any server. */
import { DEFAULTS, load, save, shieldFiles, shieldNeeded } from './lib/settings.js';
import { siteOfUrl, patternsFor, contentPatternFor, baseOrigins, normalizeSite } from './lib/sites.js';
import { dynamicRules, SESSION, ALLOW_PRIORITY } from './lib/rules.js';
import { categoryOfUrl, SUBRESOURCE_TYPES } from './lib/trackers.js';
import { malwareKeyOfUrl, malwareOfHost } from './lib/malware.js';
import { judgeDownload } from './lib/safety.js';

const SCRIPT_IDS = ['outis-key', 'outis-shield', 'outis-shield-trusted'];
const ALERT_KINDS = ['clipboard', 'pastejack', 'applink'];
const BADGE = '#2b6f62', BADGE_ALERT = '#c0392b';
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
    const steps = { rulesets, dynamic, privacy, content, proxy, scripts, icons, visits };
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
  const want = { trackers: s.enabled && s.trackers, params: s.enabled && s.links, malware: s.enabled && s.malware };
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
  control.safeBrowsing = await pref(P.services && P.services.safeBrowsingEnabled, on && s.safeBrowsing ? true : undefined);
  await chrome.storage.session.set({ control });
}

/* Site permissions: refused for every site, with some sites going back to asking.
     location            refused (paused sites ask). Fake mode refuses too: the page script answers with the place's
                         coordinates and the real position is never read.
     notifications       refused: "click Allow to prove you're not a robot" turns into a stream of scam alerts.
                         Trusted and paused sites ask.
     clipboard           reading the clipboard (and writing it without a click) refused. Trusted and paused sites ask.
     automaticDownloads  a site cannot start several downloads at once. Paused sites ask. */
async function contentRule(name, block, askFor) {
  const cs = chrome.contentSettings[name];
  if (!cs) return;
  await cs.clear({});
  if (!block) return;
  await cs.set({ primaryPattern: '<all_urls>', setting: 'block' });
  for (const site of askFor) {
    const p = contentPatternFor(site);
    if (p) { try { await cs.set({ primaryPattern: p, setting: 'ask' }); } catch (e) { /* an unusual host name */ } }
  }
}
async function content(s) {
  const on = s.enabled, trusted = [...new Set([...s.kept, ...s.paused])];
  await contentRule('location', on && s.location !== 'off', s.paused);
  await contentRule('notifications', on && s.notifications, trusted);
  await contentRule('clipboard', on && s.clipboard, trusted);
  await contentRule('automaticDownloads', on && s.downloads, s.paused);
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
  const paused = s.paused.flatMap(patternsFor);
  const trusted = s.kept.filter(k => !s.paused.includes(k));
  const base = { matches: ['<all_urls>'], runAt: 'document_start', allFrames: true, matchOriginAsFallback: true, persistAcrossSessions: true };
  /* The key script must come first: it leaves the seed the shields pick up. Trusted (kept) sites get their own shield
     registration, the same files plus the "trusted" flag that leaves the hardening out. */
  const want = [
    Object.assign({ id: 'outis-key', js: ['inject/key.js'], world: 'ISOLATED' }, base, { excludeMatches: paused }),
    Object.assign({ id: 'outis-shield', js: shieldFiles(s), world: 'MAIN' }, base, { excludeMatches: [...paused, ...trusted.flatMap(patternsFor)] })
  ];
  if (trusted.length) want.push(Object.assign({ id: 'outis-shield-trusted', js: shieldFiles(s, true), world: 'MAIN' }, base, { matches: trusted.flatMap(patternsFor), excludeMatches: paused }));
  const key = x => JSON.stringify([x.id, x.js, x.matches, x.excludeMatches || []]);
  const same = existing.length === want.length && want.every((w, i) => existing[i] && key(existing[i]) === key(w));
  if (same) return;
  if (existing.length) await chrome.scripting.unregisterContentScripts({ ids: existing.map(x => x.id) });
  await chrome.scripting.registerContentScripts(want);
}

async function icons(s) {
  await chrome.declarativeNetRequest.setExtensionActionOptions({ displayActionCountAsBadgeText: false });
  await chrome.action.setBadgeBackgroundColor({ color: BADGE });
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
      const alert = s.enabled && tabAlerts.has(id);
      try {
        await chrome.action.setBadgeBackgroundColor({ tabId: id, color: alert ? BADGE_ALERT : BADGE });
        await chrome.action.setBadgeText({ tabId: id, text: alert ? '!' : n ? (n > 999 ? '999+' : String(n)) : '' });
      } catch (e) { /* closed */ }
    }
  }, 400);
}
function blocked(tabId, url) {
  const cat = categoryOfUrl(url) || malwareKeyOfUrl(url);
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
chrome.webRequest.onErrorOccurred.addListener(d => {
  if (d.tabId < 0) return;
  if (d.error === 'net::ERR_BLOCKED_BY_CLIENT') blocked(d.tabId, d.url);
  if (d.type === 'main_frame') httpsFailed(d);
}, { urls: ['<all_urls>'] });
chrome.webRequest.onBeforeRedirect.addListener(d => {
  if (d.tabId < 0) return;
  const to = String(d.redirectUrl);
  if (to.startsWith(chrome.runtime.getURL('surrogates/'))) blocked(d.tabId, d.url);
  else if (d.type === 'main_frame' && to === chrome.runtime.getURL('blocked.html')) { blocked(d.tabId, d.url); queue(() => malwareBlocked(d.tabId, d.url)); }
  else if (d.type === 'main_frame' && /^http:\/\//i.test(d.url) && to === 'https://' + d.url.slice(7)) upgraded.set(d.tabId, { from: d.url, to, at: Date.now() });
}, { urls: ['<all_urls>'] });
/* A new page in a tab starts its count, and its safety notes, again. */
chrome.webRequest.onBeforeRequest.addListener(d => {
  if (!(d.tabId >= 0) || d.frameId !== 0) return;
  counts().then(m => { if (m.delete(d.tabId)) persistCounts(); badgeSoon(d.tabId); });
  if (tabAlerts.delete(d.tabId)) badgeSoon(d.tabId);
  queue(() => clearEvents(d.tabId));
}, { urls: ['<all_urls>'], types: ['main_frame'] });

/* ================= safety ================= */
/* Per tab, in storage.session: events {tabId: [{kind, detail, at}]} (what was stopped, for the popup); blocks {tabId:
   record} (the navigation the warning page explains); tokens {token: record} (stopped downloads, which open the
   warning page in a tab of their own); allowed {http: [hosts], malware: [hosts]} (what you chose to open anyway this
   session, as session rules). */
const tabAlerts = new Set();
const upgraded = new Map();   // tabId -> the http address Outis just upgraded to https
async function addEvent(tabId, kind, detail) {
  if (!(tabId >= 0)) return;
  const { events = {} } = await chrome.storage.session.get('events');
  const list = events[tabId] || [];
  if (list.length >= 30) return;
  list.push({ kind, detail: String(detail || '').slice(0, 200), at: Date.now() });
  events[tabId] = list;
  await chrome.storage.session.set({ events });
  tabAlerts.add(tabId);
  badgeSoon(tabId);
}
async function clearEvents(tabId) {
  const { events = {} } = await chrome.storage.session.get('events');
  if (events[tabId]) { delete events[tabId]; await chrome.storage.session.set({ events }); }
}
async function setBlock(tabId, record) {
  const { blocks = {} } = await chrome.storage.session.get('blocks');
  blocks[tabId] = Object.assign({ at: Date.now() }, record);
  await chrome.storage.session.set({ blocks });
}
const hostOf = url => { try { return new URL(url).hostname.toLowerCase(); } catch (e) { return ''; } };

/* A known malware, scam-ad or mining site: the rule sent the tab to blocked.html; remember what it was. */
async function malwareBlocked(tabId, url) {
  const host = hostOf(url), c = malwareOfHost(host);
  await setBlock(tabId, { kind: 'malware', url, host, label: c ? c.label : 'Dangerous site' });
  await addEvent(tabId, 'malware', host);
}

/* HTTPS: Outis upgraded the address and the secure version failed. Unless the name doesn't resolve at all (then plain
   HTTP fails too and Chrome's own error page says so), show the warning page and let the person choose. */
function httpsFailed(d) {
  const u = upgraded.get(d.tabId);
  if (!u || d.url !== u.to) return;
  upgraded.delete(d.tabId);
  if (/ERR_ABORTED|ERR_BLOCKED_BY_CLIENT|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_NETWORK_CHANGED|ERR_NETWORK_ACCESS_DENIED/.test(d.error)) return;
  queue(async () => {
    const s = await load();
    if (!s.enabled || !s.https) return;
    const host = hostOf(u.from);
    await setBlock(d.tabId, { kind: 'insecure', url: u.from, host, error: d.error });
    await addEvent(d.tabId, 'insecure', host);
    try { await chrome.tabs.update(d.tabId, { url: chrome.runtime.getURL('blocked.html') }); } catch (e) { /* the tab closed */ }
  });
}

/* Session rules for what the person chose to open anyway: an HTTP-only site, or a blocked site (its own page and the
   files it loads from itself; it stays blocked inside other sites). */
async function sessionRules() {
  const { allowed = { http: [], malware: [] } } = await chrome.storage.session.get('allowed');
  const rules = [];
  if (allowed.http.length) rules.push({ id: SESSION.HTTP_ALLOWED, priority: ALLOW_PRIORITY, action: { type: 'allow' }, condition: { urlFilter: '|http://', requestDomains: allowed.http, resourceTypes: ['main_frame', 'sub_frame'] } });
  if (allowed.malware.length) {
    rules.push({ id: SESSION.MALWARE_ALLOWED, priority: ALLOW_PRIORITY, action: { type: 'allow' }, condition: { requestDomains: allowed.malware, resourceTypes: ['main_frame'] } });
    rules.push({ id: SESSION.MALWARE_ALLOWED + 1, priority: ALLOW_PRIORITY, action: { type: 'allow' }, condition: { requestDomains: allowed.malware, initiatorDomains: allowed.malware, resourceTypes: SUBRESOURCE_TYPES } });
  }
  const old = await chrome.declarativeNetRequest.getSessionRules();
  await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: old.map(r => r.id), addRules: rules });
}
async function blockedInfo(sender, token) {
  const { blocks = {}, tokens = {} } = await chrome.storage.session.get(['blocks', 'tokens']);
  const rec = token ? tokens[token] : (sender.tab ? blocks[sender.tab.id] : null);
  if (!rec || Date.now() - rec.at > 30 * 60000) return { ok: false };
  return {
    ok: true,
    record: { kind: rec.kind, url: rec.kind === 'download' ? '' : rec.url, host: rec.host || '', label: rec.label || '', error: rec.error || '', name: rec.name || '', reasons: rec.reasons || [], canRetry: rec.kind === 'download' ? !!rec.url && !rec.used : true }
  };
}
async function blockedContinue(sender) {
  const tabId = sender.tab && sender.tab.id;
  const { blocks = {}, allowed = { http: [], malware: [] } } = await chrome.storage.session.get(['blocks', 'allowed']);
  const rec = blocks[tabId];
  if (!rec || Date.now() - rec.at > 30 * 60000 || (rec.kind !== 'insecure' && rec.kind !== 'malware') || !/^https?:\/\//i.test(rec.url)) return { ok: false };
  const list = rec.kind === 'insecure' ? allowed.http : allowed.malware;
  if (rec.host && !list.includes(rec.host)) list.push(rec.host);
  delete blocks[tabId];
  await chrome.storage.session.set({ allowed, blocks });
  await sessionRules();
  return { ok: true, url: rec.url };
}

/* Downloads: judged when Chrome asks for the file name (before anything is written) and again once the name is known
   (some downloads skip the first step). A stopped download is cancelled, or deleted if it had already finished, and a
   warning page explains it; "download anyway" fetches it once more, past the check. */
const judged = new Set();
const allowOnce = new Set();
let lastWarning = 0;
async function guardDownload(item, s) {
  if (!item || judged.has(item.id)) return false;
  judged.add(item.id);
  if (judged.size > 2000) judged.clear();
  if (item.byExtensionId === chrome.runtime.id && allowOnce.has(item.url)) { allowOnce.delete(item.url); return false; }
  if (!s.enabled || !s.downloads) return false;
  const v = judgeDownload(item);
  if (!v.block) return false;
  try { await chrome.downloads.cancel(item.id); } catch (e) { /* already finished */ }
  try { const [d] = await chrome.downloads.search({ id: item.id }); if (d && d.state === 'complete' && d.exists) await chrome.downloads.removeFile(item.id); } catch (e) { /* gone */ }
  const src = String(item.finalUrl || item.url || '');
  const token = crypto.randomUUID();
  const { tokens = {} } = await chrome.storage.session.get('tokens');
  const keys = Object.keys(tokens);
  if (keys.length > 40) for (const k of keys.slice(0, keys.length - 40)) delete tokens[k];
  tokens[token] = { kind: 'download', name: v.name, reasons: v.reasons, host: /^blob:/i.test(src) ? hostOf(src.slice(5)) : /^data:/i.test(src) ? 'the page itself' : hostOf(src), url: src.length < 2000000 ? src : '', at: Date.now() };
  await chrome.storage.session.set({ tokens });
  let tabId = -1;
  try {
    const tabs = await chrome.tabs.query({});
    const t = tabs.find(x => item.referrer && x.url === item.referrer) || tabs.find(x => x.active);
    if (t) tabId = t.id;
  } catch (e) { /* no tabs */ }
  await addEvent(tabId, 'download', v.name);
  if (Date.now() - lastWarning > 8000) {
    lastWarning = Date.now();
    try { await chrome.tabs.create({ url: chrome.runtime.getURL('blocked.html') + '#d=' + token, active: true }); } catch (e) { /* no window */ }
  }
  return true;
}
async function downloadAnyway(token) {
  const { tokens = {} } = await chrome.storage.session.get('tokens');
  const rec = tokens[token];
  if (!rec || rec.kind !== 'download' || !rec.url || rec.used) return { ok: false };
  rec.used = true;
  await chrome.storage.session.set({ tokens });
  allowOnce.add(rec.url);
  try { await chrome.downloads.download({ url: rec.url, filename: rec.name.replace(/[\u202a-\u202e\u2066-\u2069\u200e\u200f]/g, ''), conflictAction: 'uniquify' }); return { ok: true }; }
  catch (e) {
    try { await chrome.downloads.download({ url: rec.url, conflictAction: 'uniquify' }); return { ok: true }; }
    catch (e2) { allowOnce.delete(rec.url); return { ok: false, error: String((e2 && e2.message) || e2) }; }
  }
}
if (chrome.downloads) {
  chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
    load().then(s => guardDownload(item, s)).then(stopped => { if (!stopped) { try { suggest(); } catch (e) { /* settled */ } } }, () => { try { suggest(); } catch (e) { /* settled */ } });
    return true;
  });
  chrome.downloads.onChanged.addListener(delta => {
    if (!delta.filename || !delta.filename.current || judged.has(delta.id)) return;
    chrome.downloads.search({ id: delta.id }).then(([item]) => item && load().then(s => guardDownload(item, s))).catch(() => {});
  });
}

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
  tabAlerts.delete(tabId);
  upgraded.delete(tabId);
  queue(async () => {
    await onTabGone(tabId);
    const { events = {}, blocks = {} } = await chrome.storage.session.get(['events', 'blocks']);
    if (events[tabId] || blocks[tabId]) { delete events[tabId]; delete blocks[tabId]; await chrome.storage.session.set({ events, blocks }); }
  });
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
  if (!msg || sender.id !== chrome.runtime.id) return false;
  if (!String(sender.url || '').startsWith(chrome.runtime.getURL(''))) {
    /* From a page (inject/key.js): only the shield's safety alerts, of the known kinds, and only as notes. */
    if (msg.type === 'alert' && sender.tab && ALERT_KINDS.includes(msg.kind)) queue(() => addEvent(sender.tab.id, msg.kind, typeof msg.detail === 'string' ? msg.detail : ''));
    return false;
  }
  if (msg.type === 'blocked-info') { blockedInfo(sender, typeof msg.token === 'string' ? msg.token : '').then(reply, () => reply({ ok: false })); return true; }
  if (msg.type === 'blocked-continue' && String(sender.url).startsWith(chrome.runtime.getURL('blocked.html'))) { queue(() => blockedContinue(sender)).then(reply, () => reply({ ok: false })); return true; }
  if (msg.type === 'download-anyway' && typeof msg.token === 'string') { queue(() => downloadAnyway(msg.token)).then(reply, () => reply({ ok: false })); return true; }
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
self.outis = { applyAll, sweep: all => queue(() => sweep(all)), forgetSite: site => queue(() => forgetSite(site)), startupSweep: () => queue(startupSweep), seedTabs: () => queue(seedTabs), sessionRules: () => queue(sessionRules) };
