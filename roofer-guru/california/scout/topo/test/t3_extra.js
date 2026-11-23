/* Refinements: snow, climate zone, salt air on the reading; profile; the panel; state view. node t3_extra.js */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || path.join(__dirname, 'page.html')), SHOTS = path.join(__dirname, '..', 'shots');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
  const browser = await chromium.launch({ proxy, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: 1250, height: 1000 }, deviceScaleFactor: 1 })).newPage();
  const errs = []; page.on('pageerror', e => errs.push('pageerror: ' + (e && e.stack || e)));
  await page.goto('file://' + FILE + '#rooftops', { waitUntil: 'load', timeout: 180000 }); await wait(2500);
  const clip = async (sel, name, maxH) => { const box = await page.evaluate(s => { const c = document.querySelector(s); if (!c) return null; c.scrollIntoView({ block: 'start' }); const r = c.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }, sel); if (!box) { console.log('no', sel); return; } await wait(500); await page.screenshot({ path: path.join(SHOTS, name), timeout: 120000, clip: { x: Math.max(0, box.x), y: Math.max(0, box.y), width: box.width, height: Math.min(maxH || 900, box.height) } }); };
  const SITES = [['San Francisco, Twin Peaks', 37.7544, -122.4477, '94131'], ['Mammoth Lakes', 37.6405, -118.9660, '93546'], ['Palm Springs', 33.8230, -116.5450, '92262'], ['Coronado', 32.6859, -117.1831, '92118'], ['Truckee', 39.3280, -120.1833, '96161'], ['Big Bear Lake', 34.2439, -116.9114, '92315'], ['Sacramento', 38.5816, -121.4944, '95814']];
  for (const [n, la, lo, zip] of SITES) {
    const r = await page.evaluate(([la, lo, zip]) => { const X = window.__SCOUT_TOPO_EXTRA__; return window.__SCOUT_TOPO__.api.siteAt(la, lo).then(r => { r.x.zip = r.x.zip || zip; r.x.cz = r.x.cz || X.cz(zip); return { elevFt: Math.round(r.elev * 3.28084), zipFromPage: r.x.zip, snow: r.x.snow && Math.round(r.x.snow.psf), cell: r.x.snow && r.x.snow.cellElev && Math.round(r.x.snow.cellElev * 3.28084), cls: r.x.snowClass, cz: r.x.cz, salt: r.x.salt, csv: X.csvRow(r), lines: X.lines(r).map(h => h.replace(/<[^>]+>/g, '')) }; }); }, [la, lo, zip]);
    console.log('\n' + n, JSON.stringify({ elevFt: r.elevFt, zip: r.zipFromPage, snow: r.snow, cellFt: r.cell, cls: r.cls, cz: r.cz, salt: r.salt }), '\n  csv:', r.csv.join(' | ')); r.lines.forEach(l => console.log('  -', l));
  }
  const pr = await page.evaluate(() => { const a = window.__SCOUT_TOPO__.api; a.set({ mode: 'tint', op: 0.85 }); a.map.setView([34.35, -118.2], 9, { animate: false }); return a.profile([34.05, -118.25], [34.70, -118.14]).then(r => ({ L: r.L, z: r.z, n: r.E.length, nul: r.E.filter(v => v == null).length, lo: Math.min(...r.E.filter(v => v != null)), hi: Math.max(...r.E.filter(v => v != null)), first: r.E[0], last: r.E[r.E.length - 1] })); });
  console.log('\nprofile Los Angeles to Lancaster:', JSON.stringify(pr)); await wait(3000);
  console.log('profile text:', (await page.evaluate(() => document.querySelector('.sc-topo-ps').innerText)).replace(/\n/g, ' · '));
  await page.evaluate(() => document.querySelectorAll('.sc-topo-n').forEach((d, i) => { if (i < 2 || i === 9) d.open = true; }));
  await clip('.sc-topo-card', '12_topography_panel.png', 1000); await clip('#scMap', '13_profile_line_on_map.png');
  await page.evaluate(() => window.__SCOUT_TOPO__.api.stateView()); await wait(4000); await page.click('#scTopoB'); await wait(600); await clip('#scMap', '01_state_tint.png');
  console.log('PAGE ERRORS:', errs.length ? errs.join('\n') : 'none');
  await browser.close();
})().catch(e => { console.error('ERROR', e); process.exit(2); });
