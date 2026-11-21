/* End to end: Outis loaded into Chromium (Playwright, new headless) against real pages.
   A local HTTPS server answers for every host name (Chromium resolves them all to 127.0.0.1), so tracker domains,
   cross-site links and third-party frames behave as on the web, and the server's log shows exactly which requests
   left the browser and with which headers. The browser runs in America/Chicago with a French UI, so a value the
   page sees can only be UTC or en-US because Outis made it so.
   Covers: install state; the first page script's view (time zone, Temporal, language, device, screen, GPC, no
   leftovers); fresh about:blank frames; canvas, WebGL and audio noise (stable on a site, different across sites,
   untouched for single pixels and flat fills, same seed in a cross-site frame); location refused and pretended;
   request headers and client hints; tracker blocking with stand-ins and the count; link cleaning; referrers;
   third-party cookies; pausing a site; switching off; forgetting (delay, kept, still open, at next start); the popup
   and the settings page (screenshots in tests/e2e/); the proxy setting; a new session key after a restart.
   Run: node tests/e2e/run.mjs   (Playwright from /opt/node22 or npm; Chromium under /opt/pw-browsers; openssl).
   Exits 1 on any failed check. */
import https from 'node:https';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
let chromium;
try { ({ chromium } = await import('playwright')); } catch (e) { ({ chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs')); }

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = path.join(ROOT, 'tests', 'e2e');
const TMP = fs.mkdtempSync(path.join(process.env.OUTIS_TMP || os.tmpdir(), 'outis-e2e-'));
const PROFILE = path.join(TMP, 'profile');

const checks = [];
let failed = 0;
const ok = (cond, label, extra) => {
  checks.push(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra !== undefined ? '  (' + String(typeof extra === 'string' ? extra : JSON.stringify(extra)).replace(/\s+/g, ' ').slice(0, 300) + ')' : ''}`);
  if (!cond) failed++;
  return !!cond;
};
const note = m => checks.push('NOTE  ' + m);
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, timeout = 10000, every = 200) {
  const t0 = Date.now();
  let v;
  while (Date.now() - t0 < timeout) { try { v = await fn(); } catch (e) { v = undefined; } if (v) return v; await sleep(every); }
  return v;
}

/* ---------------- the server ---------------- */
const log = [];
const TRACKERS = ['www.google-analytics.com', 'www.googletagmanager.com', 'connect.facebook.net', 'www.facebook.com', 'fpjs.io', 'static.hotjar.com', 'www.google.com', 'securepubads.g.doubleclick.net', 'bat.bing.com', 'snap.licdn.com'];
/* A test certificate Chromium trusts by its key (--ignore-certificate-errors-spki-list), so pages are secure contexts
   without certificate errors: Chrome only sends the client hints a site asks for over a trusted connection. */
const SAN = ['*.test', '*.site-a.test', '*.site-b.test', 'check.torproject.org', ...TRACKERS].map(h => 'DNS:' + h).join(',');
execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', path.join(TMP, 'key.pem'), '-out', path.join(TMP, 'cert.pem'), '-days', '2', '-subj', '/CN=outis.test', '-addext', 'subjectAltName=' + SAN], { stdio: 'ignore' });
const pub = execFileSync('openssl', ['x509', '-in', path.join(TMP, 'cert.pem'), '-pubkey', '-noout']);
const der = execFileSync('openssl', ['pkey', '-pubin', '-outform', 'der'], { input: pub });
const SPKI = execFileSync('openssl', ['dgst', '-sha256', '-binary'], { input: der }).toString('base64');
const html = (res, body, headers) => { res.writeHead(200, Object.assign({ 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }, headers || {})); res.end(body); };
const js = (res, body) => { res.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'no-store', 'access-control-allow-origin': '*' }); res.end(body); };

const PROBE = `
function hashStr(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); }
function drawPrint() {
  const c = document.createElement('canvas'); c.width = 240; c.height = 60;
  const x = c.getContext('2d');
  x.textBaseline = 'top'; x.font = '16px Arial';
  x.fillStyle = '#f60'; x.fillRect(100, 1, 62, 20);
  x.fillStyle = '#069'; x.fillText('Cwm fjordbank glyphs vext quiz', 2, 15);
  x.fillStyle = 'rgba(102, 204, 0, 0.7)'; x.fillText('Cwm fjordbank glyphs vext quiz', 4, 17);
  const g = x.createLinearGradient(0, 0, 240, 0); g.addColorStop(0, '#123029'); g.addColorStop(1, '#7fe6c4'); x.fillStyle = g; x.fillRect(0, 40, 240, 20);
  x.beginPath(); x.arc(200, 30, 18, 0, Math.PI * 2); x.strokeStyle = '#c33'; x.lineWidth = 3; x.stroke();
  return c;
}
window.probe = async function () {
  const o = {};
  const safe = async (k, f) => { try { o[k] = await f(); } catch (e) { o[k] = 'ERR ' + e.name + ': ' + e.message; } };
  await safe('canvas', () => hashStr(drawPrint().toDataURL()));
  await safe('blob', () => new Promise(r => drawPrint().toBlob(b => b.arrayBuffer().then(a => r(hashStr(String.fromCharCode(...new Uint8Array(a))))))));
  await safe('imageData', () => { const c = drawPrint(); return hashStr(Array.from(c.getContext('2d').getImageData(0, 0, 240, 60).data).join(',')); });
  await safe('pixel', () => Array.from(drawPrint().getContext('2d').getImageData(130, 8, 1, 1).data));
  await safe('flat', () => { const c = document.createElement('canvas'); c.width = 50; c.height = 50; const x = c.getContext('2d'); x.fillStyle = '#336699'; x.fillRect(0, 0, 50, 50); return hashStr(c.toDataURL()); });
  await safe('offscreen', async () => { const oc = new OffscreenCanvas(240, 60); const x = oc.getContext('2d'); x.font = '16px Arial'; x.fillStyle = '#069'; x.fillText('Cwm fjordbank glyphs vext quiz', 2, 30); const b = await oc.convertToBlob(); return hashStr(String.fromCharCode(...new Uint8Array(await b.arrayBuffer()))); });
  await safe('webgl', () => { const gl = document.createElement('canvas').getContext('webgl'); if (!gl) return null; const e = gl.getExtension('WEBGL_debug_renderer_info'); return [gl.getParameter(e ? e.UNMASKED_VENDOR_WEBGL : gl.VENDOR), gl.getParameter(e ? e.UNMASKED_RENDERER_WEBGL : gl.RENDERER)]; });
  await safe('readPixels', () => {
    const c = document.createElement('canvas'); c.width = 64; c.height = 64;
    const gl = c.getContext('webgl', { preserveDrawingBuffer: true }); if (!gl) return null;
    gl.enable(gl.SCISSOR_TEST);
    for (let i = 0; i < 8; i++) { gl.scissor(i * 8, 0, 8, 64); gl.clearColor(i / 8, 1 - i / 8, 0.5, 1); gl.clear(gl.COLOR_BUFFER_BIT); }
    const px = new Uint8Array(64 * 64 * 4); gl.readPixels(0, 0, 64, 64, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return hashStr(Array.from(px).join(','));
  });
  await safe('audio', async () => {
    const ctx = new OfflineAudioContext(1, 5000, 44100);
    const osc = ctx.createOscillator(); osc.type = 'triangle'; osc.frequency.value = 10000;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -50; comp.knee.value = 40; comp.ratio.value = 12; comp.attack.value = 0; comp.release.value = 0.25;
    osc.connect(comp); comp.connect(ctx.destination); osc.start(0);
    const buf = await ctx.startRendering();
    const d = buf.getChannelData(0); let s = 0; for (let i = 4500; i < 5000; i++) s += Math.abs(d[i]);
    return s.toString();
  });
  await safe('hints', () => navigator.userAgentData.getHighEntropyValues(['platformVersion', 'architecture', 'bitness', 'model', 'fullVersionList', 'wow64']).then(v => ({ platformVersion: v.platformVersion, architecture: v.architecture, bitness: v.bitness, model: v.model, wow64: v.wow64, full: v.fullVersionList.map(b => b.version) })));
  await safe('battery', () => navigator.getBattery().then(b => [b.charging, b.level, b.chargingTime, b.dischargingTime]));
  await safe('idle', () => IdleDetector.requestPermission());
  await safe('keyboard', () => navigator.keyboard.getLayoutMap().then(m => 'map ' + m.size));
  await safe('fonts', () => window.queryLocalFonts().then(f => 'fonts ' + f.length));
  await safe('quota', () => navigator.storage.estimate().then(e => e.quota));
  await safe('geoState', () => navigator.permissions.query({ name: 'geolocation' }).then(s => s.state));
  await safe('geo', () => new Promise(r => navigator.geolocation.getCurrentPosition(p => r({ lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy, json: JSON.stringify(p) }), e => r({ code: e.code, message: e.message }), { timeout: 4000 })));
  return o;
};`;

const FP = `<!doctype html><html><head><meta charset="utf-8"><title>fp</title><script>
window.__early = (() => {
  const o = {};
  const safe = (k, f) => { try { o[k] = f(); } catch (e) { o[k] = 'ERR ' + e.message; } };
  safe('attrs', () => document.documentElement.getAttributeNames());
  safe('cfg', () => typeof window.__outis_cfg);
  safe('tz', () => Intl.DateTimeFormat().resolvedOptions().timeZone);
  safe('offset', () => new Date(Date.UTC(2026, 0, 15)).getTimezoneOffset());
  safe('str', () => String(new Date(Date.UTC(2026, 6, 4, 16))));
  safe('comp', () => new Date(2026, 0, 15, 10, 30).toISOString());
  safe('temporal', () => typeof Temporal === 'undefined' ? 'none' : Temporal.Now.timeZoneId());
  safe('temporalHour', () => typeof Temporal === 'undefined' ? 'none' : Temporal.Now.plainDateTimeISO().hour === new Date().getHours());
  safe('langs', () => navigator.languages.join(','));
  safe('locale', () => Intl.NumberFormat().resolvedOptions().locale);
  safe('num', () => (1234.5).toLocaleString());
  safe('cores', () => navigator.hardwareConcurrency);
  safe('memory', () => navigator.deviceMemory);
  safe('gpc', () => navigator.globalPrivacyControl);
  safe('screen', () => [screen.width, screen.height, screen.availWidth, screen.availHeight, screen.colorDepth, window.screenX, window.screenY]);
  safe('outer', () => [outerWidth, outerHeight, innerWidth, innerHeight]);
  safe('conn', () => navigator.connection ? [navigator.connection.effectiveType, navigator.connection.rtt, navigator.connection.downlink] : null);
  safe('native', () => [Function.prototype.toString.call(Date.prototype.getHours), String(Object.getOwnPropertyDescriptor(Navigator.prototype, 'hardwareConcurrency').get), String(Date), String(Intl.DateTimeFormat), String(HTMLCanvasElement.prototype.toDataURL)]);
  safe('illegal', () => { try { Object.getOwnPropertyDescriptor(Navigator.prototype, 'hardwareConcurrency').get.call({}); return 'no throw'; } catch (e) { return e.constructor.name; } });
  safe('blank', () => { const f = document.createElement('iframe'); document.documentElement.appendChild(f); const w = f.contentWindow; const r = [w.Intl.DateTimeFormat().resolvedOptions().timeZone, w.navigator.hardwareConcurrency, w.navigator.language, String(w.Date.prototype.getHours), w.document.documentElement.getAttributeNames().join()]; f.remove(); return r; });
  safe('referrer', () => document.referrer);
  return o;
})();
</script></head><body><p>fingerprint page</p><script>${PROBE}</script></body></html>`;

function handle(req, res) {
  const host = (req.headers.host || '').replace(/:\d+$/, '').toLowerCase();
  const url = new URL(req.url, 'https://' + host);
  log.push({ host, path: url.pathname, search: url.search, headers: req.headers, method: req.method, at: Date.now() });
  const p = url.pathname;
  if (host === 'check.torproject.org' && p === '/api/ip') { res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' }); res.end('{"IsTor":false,"IP":"198.51.100.7"}'); return; }
  if (TRACKERS.includes(host) && !/^\/(land|page)$/.test(p)) {
    js(res, `window.realTrackers = (window.realTrackers || []).concat(${JSON.stringify(host + p)});`);
    return;
  }
  switch (p) {
    case '/fp': return html(res, FP);
    case '/fpframe': return html(res, `<!doctype html><p>frame</p><script>${PROBE}</script>`);
    case '/framed': return html(res, `<!doctype html><p>framed</p><iframe id="f" src="https://site-b.test/fpframe" width="300" height="80"></iframe>`);
    case '/headers': return html(res, '<!doctype html><p>headers</p>', { 'accept-ch': 'Sec-CH-UA-Platform-Version, Sec-CH-UA-Full-Version-List, Sec-CH-UA-Arch, Sec-CH-UA-Model, Sec-CH-UA-Bitness, Device-Memory, Sec-CH-Device-Memory, DPR, Viewport-Width', 'critical-ch': 'Sec-CH-UA-Platform-Version, Sec-CH-UA-Full-Version-List, Sec-CH-UA-Arch, Sec-CH-UA-Model' });
    case '/track': return html(res, `<!doctype html><html><head><script>
      window.dataLayer = window.dataLayer || [];
      window.googletag = { cmd: [] };
      </script>
      <script src="https://www.googletagmanager.com/gtm.js?id=GTM-TEST1"></script>
      <script src="https://www.google-analytics.com/analytics.js"></script>
      <script src="https://securepubads.g.doubleclick.net/tag/js/gpt.js"></script>
      <script src="https://connect.facebook.net/en_US/fbevents.js"></script>
      <script src="https://fpjs.io/agent.js"></script>
      <script src="https://static.hotjar.com/c/hotjar-1.js"></script>
      <script src="https://cdn.site-b.test/lib.js"></script>
      <script src="/app.js"></script>
      </head><body>
      <img src="https://www.facebook.com/tr?id=1&ev=PageView" width="1" height="1">
      <img src="https://www.google.com/pagead/1p-conversion/1/?x=1" width="1" height="1">
      <img src="https://bat.bing.com/action/0?ti=1" width="1" height="1">
      <script>
        window.cbFired = false; window.gaHit = false; window.gptRan = false; window.gptEmpty = false;
        dataLayer.push({ event: 'click', eventCallback: function () { window.cbFired = true; } });
        try { ga('create', 'UA-1-1', 'auto'); ga('send', 'event', 'x', 'y', { hitCallback: function () { window.gaHit = true; } }); } catch (e) { window.gaError = String(e); }
        googletag.cmd.push(function () { window.gptRan = true; googletag.pubads().addEventListener('slotRenderEnded', function (e) { window.gptEmpty = e.isEmpty; }); googletag.defineSlot('/1/x', [300, 250], 'ad').addService(googletag.pubads()); googletag.enableServices(); googletag.display('ad'); });
      </script></body></html>`);
    case '/app.js': return js(res, 'window.firstParty = true;');
    case '/lib.js': return js(res, 'window.thirdPartyLib = true;');
    case '/from': return html(res, `<!doctype html><a id="cross" href="https://site-b.test/land?from=a">cross</a> <a id="same" href="https://www.site-a.test/land?from=a">same</a>`);
    case '/land': return html(res, '<!doctype html><p>landed</p><script>window.ref = document.referrer;</script>');
    case '/embed': return html(res, `<!doctype html><iframe id="set" src="https://site-b.test/setcookie"></iframe><script>
      document.getElementById('set').onload = () => { const f = document.createElement('iframe'); f.src = 'https://site-b.test/check'; f.onload = () => { window.done = true; }; document.body.appendChild(f); };</script>`);
    case '/setcookie': return html(res, '<!doctype html><p>set</p>', { 'set-cookie': 'tp=1; Path=/; Secure; SameSite=None; Max-Age=3600' });
    case '/check': return html(res, '<!doctype html><p>check</p>');
    case '/cookie': return html(res, '<!doctype html><p>cookie</p><script>localStorage.setItem("k", "v"); document.cookie = "js=1; path=/; max-age=3600; secure";</script>', { 'set-cookie': 'fp=1; Path=/; Secure; SameSite=Lax; Max-Age=3600' });
    case '/storage': return html(res, '<!doctype html><p>storage</p><script>window.stored = localStorage.getItem("k");</script>');
    default: return html(res, '<!doctype html><p>ok</p>');
  }
}
const server = https.createServer({ key: fs.readFileSync(path.join(TMP, 'key.pem')), cert: fs.readFileSync(path.join(TMP, 'cert.pem')) }, handle);
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(443, '127.0.0.1', resolve); });
const U = (host, p) => `https://${host}${p}`;
const seen = (host, pathname) => log.filter(l => l.host === host && (!pathname || l.path === pathname));

/* ---------------- the browser ---------------- */
const env = Object.assign({}, process.env, { TZ: 'America/Chicago' });
for (const k of Object.keys(env)) if (/_proxy$/i.test(k)) delete env[k];
async function launch() {
  const opts = {
    headless: true, env, viewport: { width: 1280, height: 860 },
    args: ['--headless=new', `--disable-extensions-except=${ROOT}`, `--load-extension=${ROOT}`, '--no-sandbox', '--host-resolver-rules=MAP * 127.0.0.1', `--ignore-certificate-errors-spki-list=${SPKI}`, '--lang=fr-FR', '--no-first-run']
  };
  try { return await chromium.launchPersistentContext(PROFILE, Object.assign({ channel: 'chromium' }, opts)); }
  catch (e) { note('channel chromium failed, retrying with the default build: ' + e.message.split('\n')[0]); return chromium.launchPersistentContext(PROFILE, opts); }
}
let context = await launch();
let id = '';
async function sw() {
  for (let i = 0; i < 100; i++) {
    const w = context.serviceWorkers().find(x => x.url().startsWith('chrome-extension://') && x.url().endsWith('/background.js'));
    if (w) { try { await w.evaluate(() => 1); return w; } catch (e) { /* restarting */ } }
    if (i === 0 && !context.serviceWorkers().length) { try { await context.waitForEvent('serviceworker', { timeout: 15000 }); } catch (e) { /* retry */ } }
    await sleep(150);
  }
  throw new Error('no service worker');
}
const bg = async (fn, arg) => (await sw()).evaluate(fn, arg);
const settings = () => bg(() => chrome.storage.local.get('settings').then(r => r.settings));
async function set(patch) {
  await bg(async p => { const { settings: s } = await chrome.storage.local.get('settings'); await chrome.storage.local.set({ settings: Object.assign(s, p) }); await self.outis.applyAll(); }, patch);
  await sleep(150);
}
async function tabIdOf(page) { const u = page.url(); return bg(async url => ((await chrome.tabs.query({})).find(t => t.url === url) || {}).id, u); }

const errors = [];
function watch(page, label) {
  page.on('pageerror', e => errors.push(`${label}: ${e.message}`));
  /* Chrome's own report that the probe asked for location inside a cross-site frame (frames need allow="geolocation")
     is the test's doing, not an error in Outis. */
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_BLOCKED_BY_CLIENT|ERR_CONNECTION|net::ERR_|Geolocation access has been blocked because of a permissions policy/.test(m.text())) errors.push(`${label}: ${m.text()}`); });
}

try {
  /* ---------------- 1. installed ---------------- */
  const w0 = await sw();
  id = new URL(w0.url()).host;
  ok(/^[a-p]{32}$/.test(id), 'extension loaded, service worker running', id);
  w0.on('console', m => { if (m.type() === 'error' || /Outis:/.test(m.text())) errors.push('background: ' + m.text()); });
  const welcome = await until(() => context.pages().find(p => p.url().includes('options.html#welcome')), 10000);
  ok(!!welcome, 'the welcome page opens on install');
  await until(() => bg(() => chrome.storage.session.get('applied').then(r => r.applied)), 10000);
  const st = await bg(async () => ({
    applied: (await chrome.storage.session.get('applied')).applied,
    scripts: (await chrome.scripting.getRegisteredContentScripts()).map(s => ({ id: s.id, world: s.world, js: s.js, allFrames: s.allFrames, runAt: s.runAt, fallback: s.matchOriginAsFallback })),
    rulesets: await chrome.declarativeNetRequest.getEnabledRulesets(),
    dynamic: (await chrome.declarativeNetRequest.getDynamicRules()).map(r => r.id),
    cookies: await chrome.privacy.websites.thirdPartyCookiesAllowed.get({}),
    rtc: await chrome.privacy.network.webRTCIPHandlingPolicy.get({}),
    pings: await chrome.privacy.websites.hyperlinkAuditingEnabled.get({}),
    topics: chrome.privacy.websites.topicsEnabled ? await chrome.privacy.websites.topicsEnabled.get({}) : null,
    loc: await chrome.contentSettings.location.get({ primaryUrl: 'https://site-a.test/' }),
    settings: (await chrome.storage.local.get('settings')).settings
  }));
  ok(st.applied && Object.keys(st.applied.failed).length === 0, 'every protection applied without errors', st.applied);
  ok(st.scripts.length === 2 && st.scripts[0].id === 'outis-key' && st.scripts[0].world === 'ISOLATED' && st.scripts[1].id === 'outis-shield' && st.scripts[1].world === 'MAIN', 'the seed script and then the shield are registered', st.scripts);
  ok(st.scripts.every(s => s.allFrames && s.runAt === 'document_start' && s.fallback), 'both run at document_start in every frame, about:blank included');
  ok(JSON.stringify(st.scripts[1].js) === JSON.stringify(['inject/places/nowhere.js', 'inject/shield.js']), 'the default shield files: place Nowhere', st.scripts[1].js);
  ok(st.rulesets.includes('trackers') && st.rulesets.includes('params'), 'tracker and link-cleaning rulesets on', st.rulesets);
  ok(JSON.stringify(st.dynamic.sort()) === '[1,2,3,4]', 'header and referrer rules in place', st.dynamic);
  ok(st.cookies.value === false && st.cookies.levelOfControl === 'controlled_by_this_extension', 'third-party cookies off (Chrome setting)', st.cookies);
  ok(st.rtc.value === 'default_public_interface_only', 'WebRTC limited to the public interface', st.rtc);
  ok(st.pings.value === false, 'hyperlink pings off');
  if (st.topics) ok(st.topics.value === false, 'ad topics off'); else note('this Chrome has no Topics setting');
  ok(st.loc.setting === 'block', 'location refused for every site (content setting)', st.loc);
  ok(st.settings && st.settings.enabled === true && st.settings.place === 'nowhere', 'default settings saved');

  /* the real values, from an extension page Outis leaves alone */
  const realPage = await context.newPage();
  await realPage.goto(`chrome-extension://${id}/options.html`);
  await realPage.addScriptTag({ content: PROBE }).catch(() => null);
  const real = await realPage.evaluate(async () => ({
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone, offset: new Date(Date.UTC(2026, 0, 15)).getTimezoneOffset(),
    langs: navigator.languages.join(','), cores: navigator.hardwareConcurrency, screen: [screen.width, screen.height],
    probe: typeof window.probe === 'function' ? await window.probe() : null
  }));
  if (!real.probe) {
    /* extension pages refuse inline scripts; inject the probe as a function instead */
    real.probe = await realPage.evaluate(new Function(`${PROBE}; return window.probe();`));
  }
  ok(/^America\/Chicago$/.test(real.tz) && real.offset === 360, 'the browser itself is in America/Chicago', real.tz);
  note(`real: languages ${real.langs}, ${real.cores} cores, screen ${real.screen.join('x')}, GPU ${real.probe && JSON.stringify(real.probe.webgl)}`);
  await realPage.close();

  /* ---------------- 2. what the page's first script sees ---------------- */
  const page = await context.newPage();
  watch(page, 'site-a');
  await page.goto(U('site-a.test', '/fp'));
  const e = await page.evaluate(() => window.__early);
  ok(Array.isArray(e.attrs) && e.attrs.length === 0 && e.cfg === 'undefined', 'nothing of Outis is left for the page (no seed attribute, no settings global)', e);
  ok(e.tz === 'UTC' && e.offset === 0, 'time zone: UTC, offset 0', [e.tz, e.offset]);
  ok(e.str === 'Sat Jul 04 2026 16:00:00 GMT+0000 (Coordinated Universal Time)', 'Date strings read UTC', e.str);
  ok(e.comp === '2026-01-15T10:30:00.000Z', 'local dates are UTC dates', e.comp);
  ok(e.temporal === 'UTC' || e.temporal === 'none', 'Temporal.Now reports UTC', e.temporal);
  if (e.temporal !== 'none') ok(e.temporalHour === true, 'Temporal and Date agree on the hour');
  ok(e.langs === 'en-US,en' && e.locale === 'en-US' && e.num === '1,234.5', 'language: en-US, en; the default locale is en-US', [e.langs, e.locale, e.num]);
  ok(e.cores === 8 && e.memory === 8, 'device: 8 cores, 8 GB', [e.cores, e.memory]);
  ok(e.gpc === true, 'navigator.globalPrivacyControl is true');
  ok(e.screen[0] === Math.max(e.outer[0], e.outer[2]) && e.screen[1] === Math.max(e.outer[1], e.outer[3]) && e.screen[4] === 24 && e.screen[5] === 0 && e.screen[6] === 0, 'screen: the window size, colour depth 24, window at 0,0', [e.screen, e.outer]);
  ok(Array.isArray(e.conn) && e.conn.join() === '4g,50,10', 'connection: 4g, 50 ms, 10 Mbps', e.conn);
  ok(e.native.every(s => /^function (get )?\w+\(\) \{ \[native code\] \}$/.test(s)), 'replaced functions still look native', e.native);
  ok(e.illegal === 'TypeError', 'a replaced getter still refuses a wrong receiver');
  ok(Array.isArray(e.blank) && e.blank[0] === 'UTC' && e.blank[1] === 8 && e.blank[2] === 'en-US' && /native code/.test(e.blank[3]) && e.blank[4] === '', 'a fresh about:blank frame, read at once, is shielded too', e.blank);
  if (real.cores !== 8) ok(real.cores !== e.cores, 'and those values are not the real ones', [real.cores, e.cores]);

  /* ---------------- 3. fingerprint noise ---------------- */
  const a1 = await page.evaluate(() => window.probe());
  await page.reload();
  const a2 = await page.evaluate(() => window.probe());
  const pb = await context.newPage();
  watch(pb, 'site-b');
  await pb.goto(U('site-b.test', '/fp'));
  const b1 = await pb.evaluate(() => window.probe());
  const r = real.probe;
  ok(a1.canvas !== r.canvas && a1.imageData !== r.imageData && a1.blob !== r.blob, 'canvas readouts differ from the real ones (toDataURL, getImageData, toBlob)', [a1.canvas, r.canvas]);
  ok(a1.canvas === a2.canvas && a1.imageData === a2.imageData && a1.blob === a2.blob && a1.offscreen === a2.offscreen, 'and stay the same on this site for the session');
  ok(a1.canvas !== b1.canvas && a1.imageData !== b1.imageData, 'and differ on another site', [a1.canvas, b1.canvas]);
  ok(a1.offscreen !== r.offscreen && a1.offscreen !== b1.offscreen, 'OffscreenCanvas too');
  ok(JSON.stringify(a1.pixel) === JSON.stringify(r.pixel) && JSON.stringify(a1.pixel) === '[255,102,0,255]', 'a single-pixel read is exact (colour pickers keep working)', a1.pixel);
  ok(a1.flat === r.flat, 'a flat fill is untouched');
  ok(Array.isArray(a1.webgl) && a1.webgl[0] === 'Google Inc. (Intel)' && /^ANGLE \(Intel/.test(a1.webgl[1]) && JSON.stringify(a1.webgl) !== JSON.stringify(r.webgl), 'WebGL reports a common graphics card', [a1.webgl, r.webgl]);
  if (typeof a1.readPixels === 'string' && !a1.readPixels.startsWith('ERR')) ok(a1.readPixels !== r.readPixels && a1.readPixels === a2.readPixels && a1.readPixels !== b1.readPixels, 'WebGL readPixels noised per site', [a1.readPixels, r.readPixels]);
  ok(a1.audio !== r.audio && a1.audio === a2.audio && a1.audio !== b1.audio, 'audio readout noised per site, stable on the site', [a1.audio, r.audio, b1.audio]);
  await page.goto(U('site-a.test', '/framed'));
  const fr = await until(() => page.frames().find(f => f.url().includes('/fpframe')), 8000);
  const inFrame = fr ? await fr.evaluate(() => window.probe()) : null;
  ok(inFrame && inFrame.canvas === a1.canvas, 'a frame from another site on this page gets the same noise as the page (the top site decides)', inFrame && inFrame.canvas);
  ok(inFrame && inFrame.canvas !== b1.canvas, 'so an embedded tracker sees different noise on every site that embeds it');

  /* ---------------- 4. device APIs ---------------- */
  ok(a1.hints && a1.hints.platformVersion === '' && a1.hints.architecture === 'x86' && a1.hints.bitness === '64' && a1.hints.model === '' && a1.hints.full.every(v => /^\d+\.0\.0\.0$/.test(v)), 'high-entropy client hints masked', a1.hints);
  ok(JSON.stringify(a1.battery) === '[true,1,0,null]', 'battery: full and charging', a1.battery);
  ok(a1.idle === 'denied', 'idle detection refused', a1.idle);
  ok(/^ERR (SecurityError|NotAllowedError)/.test(a1.keyboard), 'keyboard layout refused', a1.keyboard);
  ok(/^ERR NotAllowedError/.test(a1.fonts) || /is not a function/.test(a1.fonts), 'local fonts refused', a1.fonts);
  ok(typeof a1.quota === 'number' && a1.quota >= 2147483648, 'disk quota rounded', a1.quota);

  /* ---------------- 5. location ---------------- */
  ok(a1.geoState === 'denied' && a1.geo && a1.geo.code === 1, 'location requests refused', [a1.geoState, a1.geo]);
  await set({ location: 'fake', place: 'tokyo' });
  await page.goto(U('site-a.test', '/fp'));
  const tk = await page.evaluate(async () => ({ early: window.__early, p: await window.probe() }));
  ok(tk.p.geo && Math.abs(tk.p.geo.lat - 35.6762) < 0.02 && Math.abs(tk.p.geo.lon - 139.6503) < 0.02 && tk.p.geo.acc >= 30, 'pretend mode: a position in Tokyo', tk.p.geo);
  ok(tk.p.geo && /"latitude":35\./.test(tk.p.geo.json), 'the pretend position serializes like a real one', tk.p.geo && tk.p.geo.json);
  ok(tk.p.geoState === 'granted', 'and the permission reads granted', tk.p.geoState);
  ok(/^Asia\/Tokyo$/.test(tk.early.tz) && tk.early.offset === -540 && tk.early.comp === '2026-01-15T01:30:00.000Z', 'the place sets the time zone too: Tokyo', [tk.early.tz, tk.early.offset, tk.early.comp]);
  await set({ location: 'block', place: 'nowhere' });

  /* ---------------- 6. headers ---------------- */
  const hp = await context.newPage();
  await hp.goto(U('site-a.test', '/headers'));
  await hp.reload();
  const hreq = seen('site-a.test', '/headers').slice(-1)[0].headers;
  ok(hreq['sec-gpc'] === '1', 'Sec-GPC: 1 sent', hreq['sec-gpc']);
  ok(hreq['accept-language'] === 'en-US,en;q=0.9', 'Accept-Language: en-US', hreq['accept-language']);
  const hinted = Object.keys(hreq).filter(k => /^(sec-ch-ua-(platform-version|full-version-list|arch|model|bitness)|sec-ch-device-memory|device-memory|dpr|viewport-width)$/.test(k));
  ok(hinted.length === 0 && 'sec-ch-ua' in hreq && 'sec-ch-ua-platform' in hreq, 'high-entropy client hints removed, the ordinary ones kept', Object.keys(hreq).filter(k => k.startsWith('sec-ch')));
  ok(await hp.evaluate(() => window.isSecureContext), 'the test pages are trusted secure contexts');
  await set({ device: false });
  await hp.goto(U('site-a.test', '/headers?again'));
  await hp.reload();
  const hreq2 = seen('site-a.test', '/headers').slice(-1)[0].headers;
  ok('sec-ch-ua-platform-version' in hreq2 || 'sec-ch-ua-full-version-list' in hreq2, 'control: with device masking off, Chrome sends those hints (so the removal is real)', Object.keys(hreq2).filter(k => k.startsWith('sec-ch')));
  await set({ device: true });
  await hp.close();

  /* ---------------- 7. trackers ---------------- */
  const tp = await context.newPage();
  watch(tp, 'track');
  const before = log.length;
  await tp.goto(U('site-a.test', '/track'));
  await tp.waitForLoadState('load');
  await sleep(600);
  const hit = log.slice(before).filter(l => TRACKERS.includes(l.host)).map(l => l.host + l.path);
  ok(hit.length === 0, 'no tracker request reached the network', hit);
  ok(log.slice(before).some(l => l.host === 'cdn.site-b.test' && l.path === '/lib.js') && log.slice(before).some(l => l.host === 'site-a.test' && l.path === '/app.js'), 'ordinary first- and third-party scripts load');
  const tv = await tp.evaluate(() => ({ cb: window.cbFired, ga: typeof window.ga, gaLoaded: window.ga && window.ga.loaded, gaHit: window.gaHit, gaError: window.gaError, gpt: window.gptRan, gptEmpty: window.gptEmpty, real: window.realTrackers, first: window.firstParty, lib: window.thirdPartyLib }));
  ok(tv.cb === true, 'Tag Manager stand-in runs the page\'s eventCallback', tv);
  ok(tv.ga === 'function' && tv.gaLoaded === true && tv.gaHit === true && !tv.gaError, 'Analytics stand-in answers ga() and runs hitCallback', tv);
  ok(tv.gpt === true && tv.gptEmpty === true, 'ad tag stand-in runs googletag.cmd and reports empty slots', tv);
  ok(!tv.real && tv.first && tv.lib, 'no real tracker script ran');
  const tabId = await tabIdOf(tp);
  const cnt = await until(async () => { const c = await bg(async t => { const m = await chrome.storage.session.get('counts'); return (m.counts || {})[t]; }, tabId); return c && c.total >= 9 ? c : null; }, 8000);
  ok(cnt && cnt.total >= 9, 'the blocked requests are counted for the tab', cnt);
  ok(cnt && ['analytics', 'ads', 'social', 'identity', 'replay'].every(k => cnt.cats[k] > 0), 'in every category', cnt && cnt.cats);
  const badge = await until(() => bg(t => chrome.action.getBadgeText({ tabId: t }), tabId).then(b => (b && +b >= 9 ? b : null)), 6000);
  ok(!!badge, 'and shown on the toolbar button', badge);
  const direct = await context.newPage();
  await direct.goto('https://www.google-analytics.com/page');
  ok(seen('www.google-analytics.com', '/page').length === 1, 'a tracker company\'s own page still opens when you go there');
  await direct.close();

  /* ---------------- 8. links, referrers, cookies ---------------- */
  const lp = await context.newPage();
  await lp.goto(U('site-b.test', '/land?utm_source=news&id=7&fbclid=abc&gclid=q&mc_eid=1&_hsenc=x&oft_c=9&ttclid=t&page=2'));
  ok(lp.url() === U('site-b.test', '/land?id=7&page=2'), 'tracking tags stripped from the address', lp.url());
  ok(seen('site-b.test', '/land').some(l => l.search === '?id=7&page=2') && !seen('site-b.test', '/land').some(l => /utm_|fbclid/.test(l.search)), 'and the server never saw them');
  await lp.goto(U('site-a.test', '/from'));
  await Promise.all([lp.waitForNavigation(), lp.click('#cross')]);
  const cross = seen('site-b.test', '/land').slice(-1)[0];
  ok(cross && !cross.headers.referer && (await lp.evaluate(() => window.ref)) === '', 'a cross-site link sends no referrer, and document.referrer is empty', cross && cross.headers.referer);
  await lp.goto(U('site-a.test', '/from'));
  await Promise.all([lp.waitForNavigation(), lp.click('#same')]);
  const same = seen('www.site-a.test', '/land').slice(-1)[0];
  ok(same && /site-a\.test/.test(same.headers.referer || '') && /site-a\.test/.test(await lp.evaluate(() => window.ref)), 'a same-site link keeps it', same && same.headers.referer);
  await lp.goto(U('site-a.test', '/embed'));
  await until(() => lp.evaluate(() => window.done), 8000);
  const chk = seen('site-b.test', '/check').slice(-1)[0];
  ok(chk && !chk.headers.cookie, 'a third-party frame cannot keep a cookie', chk && chk.headers.cookie);
  await lp.goto(U('site-b.test', '/setcookie'));
  await lp.goto(U('site-b.test', '/check'));
  ok(/tp=1/.test(seen('site-b.test', '/check').slice(-1)[0].headers.cookie || ''), 'control: the same cookie works first-party');
  await lp.close();

  /* ---------------- 9. pause one site ---------------- */
  await set({ paused: ['site-a.test'] });
  await page.goto(U('site-a.test', '/fp'));
  const pe = await page.evaluate(async () => ({ e: window.__early, p: await window.probe() }));
  ok(pe.e.tz === real.tz && pe.e.cores === real.cores && pe.e.gpc === undefined, 'paused: the site sees the real values', [pe.e.tz, pe.e.cores, pe.e.gpc]);
  ok(pe.p.canvas === real.probe.canvas, 'paused: no canvas noise');
  const pb2 = log.length;
  await tp.goto(U('site-a.test', '/track'));
  await sleep(500);
  ok(log.slice(pb2).some(l => TRACKERS.includes(l.host)), 'paused: trackers load');
  ok(!seen('site-a.test', '/track').slice(-1)[0].headers['sec-gpc'], 'paused: no privacy headers');
  const pl = await bg(() => chrome.contentSettings.location.get({ primaryUrl: 'https://www.site-a.test/' }));
  ok(pl.setting === 'ask', 'paused: location goes back to asking', pl);
  const title = await bg(t => chrome.action.getTitle({ tabId: t }), await tabIdOf(page));
  ok(/paused on site-a\.test/.test(title), 'paused: the toolbar button says so', title);
  await pb.reload();
  ok((await pb.evaluate(() => window.__early.tz)) === 'UTC', 'other sites stay protected');
  await set({ paused: [] });
  await page.goto(U('site-a.test', '/fp'));
  ok((await page.evaluate(() => window.__early.tz)) === 'UTC', 'unpaused: protected again');

  /* ---------------- 10. off everywhere ---------------- */
  await set({ enabled: false });
  const offState = await bg(async () => ({
    scripts: (await chrome.scripting.getRegisteredContentScripts()).length, rulesets: await chrome.declarativeNetRequest.getEnabledRulesets(),
    dynamic: (await chrome.declarativeNetRequest.getDynamicRules()).length, cookies: await chrome.privacy.websites.thirdPartyCookiesAllowed.get({}),
    /* a site never visited: Chrome records the person's own answers to location prompts per site */
    loc: await chrome.contentSettings.location.get({ primaryUrl: 'https://never-visited.test/' })
  }));
  ok(offState.scripts === 0 && offState.rulesets.length === 0 && offState.dynamic === 0, 'off: no page scripts, no request rules', offState);
  ok(offState.cookies.levelOfControl !== 'controlled_by_this_extension' && offState.loc.setting !== 'block', 'off: Chrome settings handed back', offState);
  await page.goto(U('site-a.test', '/fp'));
  ok((await page.evaluate(() => window.__early.tz)) === real.tz, 'off: pages see the real time zone');
  await set({ enabled: true });
  await page.goto(U('site-a.test', '/fp'));
  ok((await page.evaluate(() => window.__early.tz)) === 'UTC', 'on again');

  /* ---------------- 11. forgetting ---------------- */
  const cookiesOf = host => bg(h => chrome.cookies.getAll({ domain: h }).then(c => c.map(x => x.name).sort().join(',')), host);
  const visit = async host => { const p = await context.newPage(); await p.goto(U(host, '/cookie')); await sleep(300); return p; };
  const c1 = await visit('site-c.test');
  ok((await cookiesOf('site-c.test')) === 'fp,js', 'a site stores cookies while open', await cookiesOf('site-c.test'));
  await c1.close();
  const t0 = Date.now();
  const gone = await until(async () => (await cookiesOf('site-c.test')) === '', 50000, 1000);
  ok(gone, 'closing its last tab forgets it (cookies deleted after the delay)', `${Math.round((Date.now() - t0) / 1000)} s`);
  const c2 = await context.newPage();
  await c2.goto(U('site-c.test', '/storage'));
  ok((await c2.evaluate(() => window.stored)) === null, 'its local storage too');
  await c2.close();
  await set({ kept: ['site-d.test'] });
  (await visit('site-d.test')).close();
  const e1 = await visit('site-e.test');
  const e2 = await visit('site-e.test');
  await e1.close();
  await sleep(500);
  await bg(() => self.outis.sweep(true));
  ok((await cookiesOf('site-d.test')) === 'fp,js', 'a kept site is not forgotten');
  ok((await cookiesOf('site-e.test')) === 'fp,js', 'a site still open in another tab is not forgotten');
  await e2.close();
  await set({ forgetDelay: -1 });
  (await visit('site-g.test')).close();
  await sleep(1500);
  await bg(() => self.outis.sweep(true));
  ok((await cookiesOf('site-g.test')) === 'fp,js', '"at the next start" waits');
  await bg(() => self.outis.startupSweep());
  ok((await cookiesOf('site-g.test')) === '', 'and forgets at the next start');
  const stats = await bg(() => chrome.storage.local.get('stats').then(r => r.stats));
  ok(stats && stats.forgotten >= 2 && typeof stats.last === 'number' && !JSON.stringify(stats).includes('site-'), 'forgotten sites are counted, and not named', stats);
  const seenAfter = await bg(() => chrome.storage.local.get('seen').then(r => Object.keys(r.seen || {})));
  ok(!seenAfter.includes('site-c.test') && !seenAfter.includes('site-g.test'), 'a forgotten site leaves no trace in Outis either', seenAfter);
  await set({ forgetDelay: 15, kept: [] });

  /* ---------------- 12. the popup ---------------- */
  await tp.goto(U('site-a.test', '/track'));
  await sleep(800);
  const popup = await context.newPage({ viewport: { width: 372, height: 760 }, deviceScaleFactor: 2 });
  watch(popup, 'popup');
  await popup.goto(`chrome-extension://${id}/popup.html?tab=${await tabIdOf(tp)}`);
  await popup.waitForSelector('#host');
  await until(() => popup.evaluate(() => +document.getElementById('whoBig').textContent >= 9), 6000);
  const pv = await popup.evaluate(() => ({ host: document.getElementById('host').textContent, pill: document.getElementById('sitePill').textContent, who: document.getElementById('whoBig').textContent, where: document.getElementById('whereBig').textContent, when: document.getElementById('whenBig').textContent, siteOn: document.getElementById('siteOn').checked, forget: document.getElementById('siteForget').checked }));
  ok(pv.host === 'site-a.test' && pv.pill === 'Protected' && pv.siteOn && pv.forget, 'popup: the site and its switches', pv);
  ok(+pv.who >= 9 && pv.where === 'Hidden' && pv.when === 'UTC', 'popup: who, where, when', pv);
  await popup.click('#sees summary');
  await until(() => popup.evaluate(() => document.querySelectorAll('#seesTable tbody tr').length >= 9), 8000);
  const rows = await popup.evaluate(() => { const t = c => c.textContent.replace(/\u200b/g, ''); return Object.fromEntries([...document.querySelectorAll('#seesTable tbody tr')].map(tr => [t(tr.cells[0]), [t(tr.cells[1]), t(tr.cells[2]), tr.cells[1].className]])); });
  ok(rows['Time zone'] && rows['Time zone'][0] === 'UTC' && rows['Time zone'][1] === real.tz && rows['Time zone'][2] === 'hid', 'popup: "what this site sees" against the real values', rows['Time zone']);
  ok(rows['Canvas print'] && rows['Canvas print'][0] !== rows['Canvas print'][1] && rows['Location'][0] === 'Refused', 'popup: canvas differs, location refused', [rows['Canvas print'], rows['Location']]);
  await popup.click('#blocked summary');
  const listed = await popup.evaluate(() => [...document.querySelectorAll('#blockedList li span:first-child')].map(s => s.textContent));
  ok(listed.includes('www.google-analytics.com') && listed.includes('connect.facebook.net'), 'popup: the blocked hosts are listed', listed);
  await popup.click('#ipCheck');
  const ipText = await until(() => popup.evaluate(() => { const t = document.getElementById('ipResult').textContent; return /Sites see|Could not/.test(t) ? t : null; }), 6000);
  ok(ipText === 'Sites see 198.51.100.7', 'popup: the IP check asks once and reports the address', ipText);
  const cdp = await context.newCDPSession(popup);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 372, height: 600, deviceScaleFactor: 2, mobile: false });
  await sleep(300);
  await popup.screenshot({ path: path.join(OUT, 'popup.png'), fullPage: true });
  await cdp.send('Emulation.clearDeviceMetricsOverride');
  await popup.click('#siteOn');
  const pausedNow = await until(() => settings().then(s => s.paused.includes('site-a.test')), 5000);
  ok(pausedNow, 'popup: switching the site off pauses it');
  await popup.click('#siteOn');
  ok(await until(() => settings().then(s => !s.paused.length), 5000), 'popup: and back on');
  await popup.click('#siteForget');
  ok(await until(() => settings().then(s => s.kept.includes('site-a.test')), 5000), 'popup: "forget this site" off keeps it');
  await popup.click('#siteForget');
  ok(await until(() => settings().then(s => !s.kept.length), 5000), 'popup: and back on');
  await popup.close();

  /* ---------------- 13. the settings page ---------------- */
  const op = await context.newPage({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 2 });
  watch(op, 'options');
  const ocdp = await context.newCDPSession(op);
  await ocdp.send('Emulation.setDeviceMetricsOverride', { width: 1100, height: 900, deviceScaleFactor: 2, mobile: false });
  await op.goto(`chrome-extension://${id}/options.html#welcome`);
  await op.waitForSelector('#welcome:not([hidden])');
  ok(true, 'settings: the welcome card shows on #welcome');
  await op.click('[data-welcome="tz-keep"]');
  ok(await until(() => settings().then(s => s.timezone === false), 5000), 'welcome: "keep my real time zone"');
  await op.click('[data-welcome="tz-hide"]');
  ok(await until(() => settings().then(s => s.timezone === true), 5000), 'welcome: "hide it"');
  await op.screenshot({ path: path.join(OUT, 'welcome.png') });
  await op.click('#welcomeDone');
  await op.selectOption('#place', 'london');
  ok(await until(() => settings().then(s => s.place === 'london'), 5000), 'settings: choose a place');
  ok(/London/.test(await op.textContent('#tzName')), 'settings: the time zone line follows');
  await op.check('input[name="location"][value="fake"]');
  ok(await until(() => settings().then(s => s.location === 'fake'), 5000), 'settings: pretend location');
  await op.check('input[name="location"][value="block"]');
  await op.selectOption('#place', 'nowhere');
  await op.uncheck('[data-key="audio"]');
  ok(await until(() => bg(async () => (await chrome.scripting.getRegisteredContentScripts()).find(s => s.id === 'outis-shield').js.includes('inject/opt/no-audio.js')), 5000), 'settings: a switch reaches the page script registration');
  await op.check('[data-key="audio"]');
  await op.fill('form[data-list="kept"] input', 'https://mail.example.com/inbox');
  await op.click('form[data-list="kept"] button');
  ok(await until(() => settings().then(s => s.kept.includes('example.com')), 5000), 'settings: add a kept site (typed as an address)');
  ok((await op.textContent('ul[data-list="kept"]')).includes('example.com'), 'settings: and it is listed');
  await op.fill('form[data-list="paused"] input', 'not a site!');
  await op.click('form[data-list="paused"] button');
  ok(await until(() => op.evaluate(() => /doesn't look like a site/.test(document.getElementById('toast').textContent)), 3000), 'settings: nonsense is refused');
  await op.click('[data-preset="tor-browser"]');
  await op.click('#proxySave');
  await op.click('#proxyOn');
  const px = await until(() => bg(async () => { const p = await chrome.proxy.settings.get({}); return p.levelOfControl === 'controlled_by_this_extension' && p.value.mode === 'fixed_servers' ? { p: p.value, rtc: (await chrome.privacy.network.webRTCIPHandlingPolicy.get({})).value } : null; }), 5000);
  ok(px && px.p.rules.singleProxy.host === '127.0.0.1' && px.p.rules.singleProxy.port === 9150 && px.p.rules.singleProxy.scheme === 'socks5', 'proxy: Tor Browser preset applied', px);
  ok(px && px.rtc === 'disable_non_proxied_udp', 'proxy: WebRTC must then go through it', px && px.rtc);
  await op.click('#proxyOn');
  ok(await until(() => bg(() => chrome.proxy.settings.get({})).then(p => p.levelOfControl !== 'controlled_by_this_extension'), 5000), 'proxy: off again, Chrome\'s own setting back');
  await op.evaluate(() => { window.scrollTo(0, 0); document.getElementById('toast').hidden = true; });
  await op.fill('form[data-list="paused"] input', '');
  await op.screenshot({ path: path.join(OUT, 'options.png'), fullPage: true });
  await set({ kept: [] });
  await op.close();

  /* ---------------- 14. a new session ---------------- */
  await page.goto(U('site-a.test', '/fp'));
  const beforeRestart = await page.evaluate(() => window.probe().then(p => p.canvas));
  await context.close();
  context = await launch();
  const tr = Date.now();
  await sw();
  const immediately = await bg(async () => (await chrome.scripting.getRegisteredContentScripts()).map(s => s.id));
  const again = await until(() => bg(async () => { const ids = (await chrome.scripting.getRegisteredContentScripts()).map(s => s.id); return ids.length === 2 ? ids : null; }), 15000);
  const how = await bg(() => chrome.storage.session.get('installed').then(r => r.installed));
  note(`after the restart: scripts ${immediately.length ? 'still registered' : 'registered again'} within ${Date.now() - tr} ms; onInstalled: ${JSON.stringify(how)}`);
  ok(JSON.stringify(again) === '["outis-key","outis-shield"]', 'after a restart the page scripts are registered', again);
  const p2 = await context.newPage();
  watch(p2, 'restart');
  await p2.goto(U('site-a.test', '/fp'));
  const afterRestart = await p2.evaluate(() => window.probe().then(p => p.canvas));
  await p2.reload();
  const afterReload = await p2.evaluate(() => window.probe().then(p => p.canvas));
  ok(afterRestart !== beforeRestart && afterRestart === afterReload, 'a new browser session brings new noise for the same site (and it holds within the session)', [beforeRestart, afterRestart, afterReload]);
  ok((await p2.evaluate(() => window.__early.tz)) === 'UTC', 'and the time zone is still hidden');

  ok(errors.length === 0, 'no script errors in pages, the popup, the settings page or the background', errors);
} catch (err) {
  ok(false, 'the run finished', err && err.stack);
} finally {
  try { await context.close(); } catch (e) { /* closed */ }
  server.close();
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* ignore */ }
}
console.log(checks.join('\n'));
console.log(`\n${checks.filter(c => c.startsWith('PASS')).length} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
