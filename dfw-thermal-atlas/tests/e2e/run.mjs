/* End to end run of the DFW Thermal Debt Atlas browser app in headless Chromium (Playwright).
   Loads app/ as an unpacked extension and checks the whole chain a person would touch:
     1. the service worker starts, sets its alarms and loads the same live layer as the page;
     2. atlas.html runs under the extension page policy (no inline script, no eval): every module mounts with no error;
     3. the live layer: a refresh run from the page (or the worker) fills the store, the page hears it, the Heat Desk and
        Live Data modules draw from it, the badge follows the forecast;
     4. the popup paints its status and finds modules and ZIP codes; routes open in the tab that is already open.
   Screenshots land in tests/e2e/. Exits 1 on a failed check.
     node tests/e2e/run.mjs [--offline]      --offline skips the checks that call the public data sources
   Needs Playwright (pre installed in the cloud sandbox; elsewhere: npm install, npx playwright install chromium).
   The default headless shell cannot load extensions; the full chromium channel with the new headless mode can. */
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const APP = path.join(ROOT, 'app'), DIR = path.join(ROOT, 'tests', 'e2e');
const OFFLINE = process.argv.includes('--offline');

const checks = []; let failed = 0;
const ok = (cond, label, extra) => { checks.push(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra !== undefined ? '  (' + String(extra).replace(/\s+/g, ' ').slice(0, 300) + ')' : ''}`); if (!cond) failed++; return !!cond; };
const note = m => checks.push('NOTE  ' + m);
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, timeout, every) { const t0 = Date.now(); let v; while (Date.now() - t0 < timeout) { try { v = await fn(); } catch (e) { v = undefined; } if (v) return v; await sleep(every || 200); } return v; }

const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
async function launch() {
  const base = { headless: true, args: ['--headless=new', '--disable-extensions-except=' + APP, '--load-extension=' + APP, '--no-sandbox'], viewport: { width: 1440, height: 1000 } };
  if (proxy) base.proxy = { server: proxy };
  try { return await chromium.launchPersistentContext('', Object.assign({ channel: 'chromium' }, base)); }
  catch (e) { console.log('channel chromium failed, retrying with the default build: ' + e.message.split('\n')[0]); return chromium.launchPersistentContext('', base); }
}
const context = await launch();
let sw = context.serviceWorkers()[0]; if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 30000 });
const id = new URL(sw.url()).host;
const errors = [], blocked = [];
const watch = (page, name) => {
  page.on('pageerror', e => errors.push(`${name} pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() !== 'error') return; const t = m.text(), u = (m.location() || {}).url || ''; if (/^Failed to load resource: net::ERR_/.test(t) && !u.startsWith('chrome-extension://')) blocked.push(u); else errors.push(`${name} console.error: ${t.slice(0, 300)} ${u}`); });
};

try {
  ok(/^[a-p]{32}$/.test(id), 'extension id from the service worker', id);

  /* ---- 1. the worker ---- */
  const w = await until(() => sw.evaluate(async () => ({ live: !!globalThis.TDA_LIVE, sources: globalThis.TDA_LIVE ? globalThis.TDA_LIVE.SOURCES.map(s => s.id) : [], alarms: (await chrome.alarms.getAll()).map(a => a.name).sort(), reg: (globalThis.TDA_REGISTRY || {}).modules ? globalThis.TDA_REGISTRY.modules.length : 0 })).then(v => v.alarms.length ? v : null), 15000);
  ok(w && w.live, 'the worker loads the live layer');
  ok(w && w.alarms.includes('tda-weekly'), 'the weekly refresh alarm is set', w && w.alarms.join(', '));
  ok(w && w.alarms.includes('tda-daily'), 'the daily weather pulse alarm is set');
  const wk = await sw.evaluate(async () => { const a = await chrome.alarms.get('tda-weekly'); const d = new Date(a.scheduledTime); return { dow: d.getDay(), hour: d.getHours(), inDays: (a.scheduledTime - Date.now()) / 864e5 }; });
  ok(wk.dow === 1 && wk.hour === 6 && wk.inDays > 0 && wk.inDays <= 7, 'the weekly alarm is due next Monday at 6 am', JSON.stringify(wk));

  /* ---- 2. the atlas page under the extension page policy ---- */
  const page = await context.newPage(); watch(page, 'atlas');
  /* installing opens the Heat Desk in a tab of its own; close it so the checks own the only atlas tab */
  await sleep(500); for (const p of context.pages()) if (p !== page && /atlas\.html/.test(p.url())) await p.close();
  await page.goto(`chrome-extension://${id}/atlas.html`, { waitUntil: 'load' });
  await page.waitForSelector('#rail button', { timeout: 30000 });
  const boot = await page.evaluate(() => ({ mods: MODS.map(m => m.key), live: typeof LIVE === 'object', env: LIVE.env, ext: LIVE.ext, inline: document.querySelectorAll('script:not([src])').length, fonts: [...document.fonts].length }));
  ok(boot.mods.length >= 16, 'the rail lists the modules', boot.mods.length + ': ' + boot.mods.join(' '));
  ok(boot.inline === 0, 'the page carries no inline script');
  ok(boot.live && boot.ext && boot.env === 'extension', 'the live layer sees the browser app runtime', JSON.stringify({ env: boot.env }));
  ok(await page.evaluate(() => document.fonts.ready.then(() => document.fonts.check('600 14px "IBM Plex Sans"'))), 'the bundled typefaces load from the app');
  const visited = [];
  for (const k of boot.mods) {
    const before = errors.length;
    const r = await page.evaluate(key => { showModule(key); const s = document.getElementById('mod-' + key); const c = s.querySelector('.callout .ct'); return { len: s.innerHTML.length, failed: !!(c && /failed to load/i.test(c.textContent)), hash: location.hash }; }, k);
    await sleep(250);
    visited.push(`${k}${r.failed ? ' FAILED' : ''}${errors.length > before ? ' ERR' : ''}`);
    if (r.failed || errors.length > before || r.len < 2000 || r.hash !== '#' + k) ok(false, `module ${k} mounts cleanly`, JSON.stringify(r) + ' ' + errors.slice(before).join(' | '));
  }
  ok(visited.every(v => !/FAILED|ERR/.test(v)), 'every module mounts with no error under the extension page policy', visited.length + ' modules');
  await page.evaluate(() => showModule('index')); await sleep(300);
  await page.screenshot({ path: path.join(DIR, 'atlas.png') });

  /* ---- 3. the live layer ---- */
  const srcs = await page.evaluate(() => LIVE.sources.map(s => ({ id: s.id, cadence: s.cadence, cors: s.cors, hosts: s.hosts })));
  ok(JSON.stringify(srcs.map(s => s.id)) === JSON.stringify(w.sources), 'the page and the worker register the same sources', srcs.length + ' sources');
  const man = JSON.parse(await (await page.request.get(`chrome-extension://${id}/manifest.json`).catch(() => ({ text: async () => '{}' }))).text().catch(() => '{}'));
  if (man.host_permissions) { const allowed = man.host_permissions.map(h => h.replace(/^https:\/\//, '').replace(/\/\*$/, '')); const missing = [...new Set(srcs.flatMap(s => s.hosts))].filter(h => !allowed.includes(h)); ok(!missing.length, 'the manifest grants every host a source calls', missing.join(', ') || allowed.length + ' hosts'); }
  if (!OFFLINE && srcs.length) {
    /* installing the app starts the first full refresh in the worker: wait for it rather than starting a second one */
    const t0 = Date.now();
    const st = await until(() => sw.evaluate(async () => { const all = await chrome.storage.local.get(null); const s = all['tda.live.state'] || {}; if (!s.lastWeekly || s.running) return null; const ks = Object.keys(all).filter(k => k.startsWith('tda.live.src.')); return { keys: ks.length, bytes: JSON.stringify(Object.fromEntries(ks.map(k => [k, all[k]]))).length, run: (s.runs || [])[0], ok: ks.filter(k => all[k].ok).map(k => all[k].id), bad: ks.filter(k => all[k].ok === false).map(k => `${all[k].id}: ${(all[k].err || {}).msg}`), skipped: ks.filter(k => all[k].skipped && !all[k].ok).map(k => `${all[k].id}: ${all[k].skipped.why}`) }; }), 240000, 1000);
    ok(st && st.run && st.run.by === 'extension', 'the worker ran the first full refresh on its own after install', st ? `${st.ok.length} ok, ${st.bad.length} failed, ${st.skipped.length} skipped in ${(st.run.ms / 1000).toFixed(1)} s (waited ${((Date.now() - t0) / 1000).toFixed(0)} s)` : 'no run within four minutes');
    if (st) {
      const al = await sw.evaluate(async () => (await chrome.alarms.getAll()).map(a => a.name).sort());
      /* a clean run clears its retry alarm; a run that left a source failed keeps it armed, to ask that source again in a few minutes */
      ok(al.includes('tda-retry') === (st.bad.length > 0) && al.includes('tda-weekly') && al.includes('tda-daily'), st.bad.length ? 'the run left a source failed, so its retry alarm stays armed beside the schedule' : 'the finished run cleared its retry alarm and left the schedule in place', al.join(', '));
      ok(st.ok.length >= Math.ceil(srcs.length * 0.7), 'most sources answered', `${st.ok.length} of ${srcs.length}`);
      if (st.bad.length) note('failed sources: ' + st.bad.join(' | '));
      if (st.skipped.length) note('skipped sources: ' + st.skipped.join(' | '));
      ok(st.bytes < 4 * 1048576, 'the live store stays small', `${st.keys} records, ${(st.bytes / 1024).toFixed(0)} KB`);
    }
    const heard = await until(() => page.evaluate(() => LIVE.state().lastWeekly && Object.values(LIVE.all()).filter(r => r.ok).length), 8000);
    ok(st && heard >= st.ok.length, 'the open page hears the worker\'s refresh through the store', heard);
    const ann = await sw.evaluate(async () => { const L = globalThis.TDA_LIVE; if (!L.derive || !L.derive.cold) return null; const c = L.derive.cold(await L.snapshot(L.chromeStore(chrome.storage.local), null), new Date()); return { ok: c.ok, headline: c.headline, sub: c.sub, nights: c.nights.length, counties: Object.keys(c.byCounty).length, badge: L.derive.badge(c), badgeShown: await chrome.action.getBadgeText({}) }; });
    if (ann) { ok(ann.ok && !!ann.headline && ann.nights >= 5 && ann.counties === 12, 'the worker derives the cold picture: seven nights, twelve counties', `${ann.headline} | ${ann.sub}`); ok(ann.badgeShown === (ann.badge.text || ''), 'the toolbar badge follows the forecast', JSON.stringify(ann.badge.text) + ' ' + ann.badge.title); }
    /* ---- 3b. a freeze in the store: badge and one notification, sent once ---- */
    const real = await sw.evaluate(async () => (await chrome.storage.local.get('tda.live.src.nws_cold'))['tda.live.src.nws_cold']);
    const cold = JSON.parse(JSON.stringify(real)); const kd = cold.data.points.find(p => p.id === 'KDTO'); kd.nights[2].lowF = 30; cold.data.points.find(p => p.id === 'KLUD').nights[2].lowF = 31;
    const say = () => page.evaluate(() => new Promise(res => chrome.runtime.sendMessage({ type: 'tda.live.announce', notify: true }, r => res(r))));
    /* the worker's own first refresh may already have announced something true of today (the first heating week of the season, an alert):
       note it, then start the freeze check from a clean slate */
    const own = await sw.evaluate(async () => ({ notes: await new Promise(res => chrome.notifications.getAll(n => res(Object.keys(n)))), sent: ((await chrome.storage.local.get('tda.live.notified'))['tda.live.notified'] || {}).keys || [] }));
    ok(own.notes.length <= 3 && own.notes.length === Math.min(3, own.sent.length), 'the first refresh announced each real trigger once, three at most', JSON.stringify(own.sent));
    await sw.evaluate(async rec => { await new Promise(res => chrome.notifications.getAll(n => Promise.all(Object.keys(n).map(id => new Promise(r => chrome.notifications.clear(id, r)))).then(res))); await chrome.storage.local.set({ 'tda.live.src.nws_cold': rec }); await chrome.storage.local.remove('tda.live.notified'); }, cold);
    await say();
    await until(() => sw.evaluate(() => new Promise(res => chrome.notifications.getAll(n => res(Object.keys(n).length)))), 4000);      // creating a notification is asynchronous
    const n1 = await sw.evaluate(async () => ({ badge: await chrome.action.getBadgeText({}), title: await chrome.action.getTitle({}), notes: await new Promise(res => chrome.notifications.getAll(n => res(Object.keys(n)))), sent: (await chrome.storage.local.get('tda.live.notified'))['tda.live.notified'] }));
    ok(n1.badge === '30°' && /30°F/.test(n1.title), 'a freeze in the forecast sets the badge to the coldest low', `${n1.badge} · ${n1.title}`);
    ok(n1.notes.length === 1 && n1.sent && /^tier3:/.test(n1.sent.keys[0]), 'and sends one notification', JSON.stringify(n1.sent));
    ok(n1.notes.length === 1 && /^tda-cold\|[a-z]+(\.\d{5})?\|/.test(n1.notes[0]), 'whose id carries the page it opens, so a click works after the worker has slept', n1.notes[0]);
    await say();
    const n2 = await sw.evaluate(() => new Promise(res => chrome.notifications.getAll(n => res(Object.keys(n).length))));
    ok(n2 === 1, 'the same trigger is not announced twice', n2);
    const hd = await until(() => page.evaluate(() => { const c = TDA_LIVE.derive.cold(LIVE.all(), new Date()); return c.minLow === 30 ? document.getElementById('shellFacts').innerText : null; }), 5000);
    ok(/30°F/.test(hd || ''), 'the open page shows the new coldest low in its header', (hd || '').replace(/\n/g, ' · '));
    await sw.evaluate(async rec => { await chrome.storage.local.set({ 'tda.live.src.nws_cold': rec }); for (const id of Object.keys(await new Promise(res => chrome.notifications.getAll(res)))) chrome.notifications.clear(id); }, real);
    await say();
    /* ---- 3c. the schedule: settings move the alarm; a due alarm runs the pulse and re arms ---- */
    await page.evaluate(() => LIVE.saveSettings({ weeklyDow: 3, weeklyHour: 9 }));
    const moved = await until(() => sw.evaluate(async () => { const a = await chrome.alarms.get('tda-weekly'); const d = new Date(a.scheduledTime); return d.getDay() === 3 && d.getHours() === 9 ? { when: d.toString() } : null; }), 5000);
    ok(!!moved, 'changing the refresh day in the page moves the worker\'s alarm', moved && moved.when);
    await page.evaluate(() => LIVE.saveSettings({ weeklyDow: 1, weeklyHour: 6 }));
    const armed = Date.now();
    await sw.evaluate(async () => { const s = (await chrome.storage.local.get('tda.live.state'))['tda.live.state']; const ago = new Date(Date.now() - 30 * 36e5).toISOString(); s.lastWeekly = ago; s.lastDaily = ago; await chrome.storage.local.set({ 'tda.live.state': s }); await chrome.alarms.create('tda-daily', { when: Date.now() + 400 }); });
    /* the pulse is the daily run made since the alarm was armed; when a weekly source is in a failed state the worker asks it again right after, as a run of its own */
    const pulse = await until(() => sw.evaluate(async since => { const s = (await chrome.storage.local.get('tda.live.state'))['tda.live.state']; const r = (s.runs || []).find(x => x.scope === 'daily' && +new Date(x.at) >= since); return r && !s.running ? { r, next: new Date((await chrome.alarms.get('tda-daily')).scheduledTime).toString(), after: (s.runs || []).filter(x => +new Date(x.at) >= since && x.scope !== 'daily').map(x => x.scope + ':' + x.ok) } : null; }, armed), 120000, 1000);
    ok(pulse && pulse.r.by === 'extension' && pulse.r.ok >= 1, 'a due daily alarm runs the weather pulse in the worker', pulse ? `${pulse.r.ok} source(s) in ${(pulse.r.ms / 1000).toFixed(1)} s` : 'no pulse within two minutes');
    ok(pulse && +new Date(pulse.next) > Date.now() + 36e5, 'and the alarm is armed again for the next morning', pulse && pulse.next);
    if (pulse && pulse.after.length) note('after the pulse the worker asked again for the weekly source that had failed: ' + pulse.after.join(', '));
  } else note(OFFLINE ? 'offline: the live refresh was not exercised' : 'no live sources registered yet');
  for (const k of ['heat', 'live']) {
    if (!boot.mods.includes(k)) { note(`module ${k} is not registered yet`); continue; }
    const before = errors.length;
    await page.evaluate(key => showModule(key), k); await sleep(900);
    const r = await page.evaluate(key => { const s = document.getElementById('mod-' + key); return { len: s.innerHTML.length, text: s.innerText.slice(0, 200) }; }, k);
    ok(r.len > 5000 && errors.length === before, `the ${k} module draws from the live store`, r.text);
    await page.screenshot({ path: path.join(DIR, k + '.png'), fullPage: true });
  }

  /* ---- 4. the popup and routes ---- */
  const pop = await context.newPage(); watch(pop, 'popup');
  await pop.setViewportSize({ width: 392, height: 600 });
  await pop.goto(`chrome-extension://${id}/popup.html`, { waitUntil: 'load' });
  await pop.waitForSelector('#list .row', { timeout: 10000 });
  const rows = await pop.locator('#list .row').count();
  ok(rows >= 16, 'the popup lists the modules', rows);
  ok((await pop.locator('#status').innerText()).includes('Next full refresh'), 'the popup shows the refresh status');
  await pop.fill('#q', '75150'); await sleep(150);
  ok(/75150/.test(await pop.locator('#list .row').first().innerText()), 'the popup finds a ZIP code', (await pop.locator('#list .row').first().innerText()).replace(/\n/g, ' · '));
  await pop.fill('#q', 'weather'); await sleep(150);
  ok(/Weather Desk/.test(await pop.locator('#list .row').first().innerText()), 'the popup finds a module');
  await pop.screenshot({ path: path.join(DIR, 'popup.png') });
  const tabsBefore = context.pages().length;
  await pop.evaluate(() => globalThis.TDA_OPEN.openRoute('weather'));
  const routed = await until(() => page.evaluate(() => location.hash === '#weather' && !document.getElementById('mod-weather').hidden), 5000);
  ok(routed && context.pages().length === tabsBefore, 'a route opens in the atlas tab that is already open');
  if (!pop.isClosed()) await pop.close();

  if (blocked.length) note(`${[...new Set(blocked)].length} resource(s) off the sandbox allowlist did not load (ignored): ${[...new Set(blocked)].slice(0, 3).join(', ')}`);
  ok(!errors.length, 'no page error, policy violation or console error anywhere', errors.slice(0, 6).join(' || '));
} catch (e) { ok(false, 'the run completed', e.stack || e.message); }
finally { await context.close(); }
console.log(checks.join('\n'));
console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);
