// Re-bake the Weather Desk's National Weather Service snapshot (app/data/nws-snapshot.js) by running the page's own
// fetch code (NWSX.refresh in js/11_nws_core.js) in headless Chromium, so the baked copy is the same shape the page caches.
//   node tools/snapshot.mjs [--file <single-file.html>] [--out <path>] [--dry]
// The snapshot is what the Weather Desk shows before its first live refresh, and all it can show inside viewers that
// block network calls. Run it at release time; needs the public NWS and SPC hosts.
import { createRequire } from 'node:module';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const a = process.argv.slice(2), opt = (k, d) => { const i = a.indexOf('--' + k); return i >= 0 ? a[i + 1] : d; };
const file = resolve(opt('file', join(ROOT, 'dist', 'DFW_Thermal_Debt_Atlas.html')));
const out = resolve(opt('out', join(ROOT, 'app', 'data', 'nws-snapshot.js')));
if (!existsSync(file)) { console.error(`no such file: ${file} (run "node build.mjs" first)`); process.exit(2); }

const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
const browser = await chromium.launch(proxy ? { proxy: { server: proxy } } : {});
const page = await browser.newPage();
await page.addInitScript(() => { try { localStorage.setItem('tda.live.settings', JSON.stringify({ auto: false })); } catch (e) { } });
await page.goto(pathToFileURL(file).href, { waitUntil: 'load' });
const r = await page.evaluate(async () => { const s = await NWSX.refresh(true); return { live: s.live, error: s.error, fetched: s.fetched, json: s.live ? NWSX.snapshotJSON() : null }; });
await browser.close();
if (!r.live || !r.json) { console.error('the live fetch failed: ' + (r.error || 'no data') + '. The snapshot was left as it is.'); process.exit(1); }
const snap = JSON.parse(r.json);
/* sanity: the parts the Weather Desk draws from */
const need = { forecast: snap.forecast && snap.forecast.periods && snap.forecast.periods.length >= 10, hourly: Array.isArray(snap.hourly) && snap.hourly.length >= 100, grid: snap.grid && Array.isArray(snap.grid.minTemperature) && snap.grid.minTemperature.length > 0, stations: snap.obs && snap.obs.stations && snap.obs.stations.length >= 8, point: snap.point && snap.point.office };
const missing = Object.keys(need).filter(k => !need[k]);
if (missing.length) { console.error('the live answer is incomplete (' + missing.join(', ') + '). The snapshot was left as it is.'); process.exit(1); }
if (/<\/script/i.test(r.json)) { console.error('the snapshot holds a literal </script; refusing to write it'); process.exit(1); }
const old = existsSync(out) ? readFileSync(out, 'utf8') : '';
const was = (/"fetched":"([^"]+)"/.exec(old) || [])[1];
console.log(`fetched ${snap.fetched} (was ${was || 'none'}): ${snap.forecast.periods.length} periods, ${snap.hourly.length} hours, ${snap.obs.stations.length} stations, ${snap.alerts.length} alerts, ${(r.json.length / 1024).toFixed(0)} KB`);
console.log(`now: ${snap.forecast.periods.slice(0, 2).map(p => `${p.name} ${p.tempF}°F ${p.short}`).join('; ')}`);
if (a.includes('--dry')) process.exit(0);
writeFileSync(out, `/* ==== nws-snapshot.js ==== */\nwindow.__NWS_SNAPSHOT__ = ${r.json};\n\n`);
console.log('wrote ' + out);
