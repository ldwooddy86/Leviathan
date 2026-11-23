/* Core check of the terrain block in the assembled test page: page errors, decoded heights, relief at state, region and
   street zoom, names, the site reading at four places. node t1_core.js [page.html]
   NODE_PATH=/opt/node-tools/node_modules */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || path.join(__dirname, 'page.html')), SHOTS = path.join(__dirname, '..', 'shots');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
  const browser = await chromium.launch({ proxy, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 1 })).newPage();
  const errs = []; page.on('pageerror', e => errs.push('pageerror: ' + (e && e.stack || e)));
  await page.goto('file://' + FILE + '#rooftops', { waitUntil: 'load', timeout: 180000 }); await wait(3000);
  const has = await page.evaluate(() => !!(window.__SCOUT_TOPO__ && window.__SCOUT_TOPO__.api));
  console.log('topo api present:', has, '| errors so far:', errs.length); if (!has) { console.log(errs.join('\n')); await browser.close(); process.exit(1); }
  const settle = async (max) => { const t0 = Date.now(); let s; while (Date.now() - t0 < (max || 40000)) { await wait(1500); s = await page.evaluate(() => window.__SCOUT_TOPO__.api.state()); if (!s.pending) break; } return s; };
  const shot = async (name) => { const box = await page.evaluate(() => { const c = document.querySelector('#scMap'); c.scrollIntoView({ block: 'center' }); const r = c.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }); await wait(600); await page.screenshot({ path: path.join(SHOTS, name), timeout: 120000, clip: { x: Math.max(0, box.x), y: Math.max(0, box.y), width: box.width, height: box.height } }); };

  /* heights against the research table (sources_scout_live.md section 4a) */
  const PTS = [['Mount Whitney summit', 36.57858, -118.291995, 4411.8, 4421], ['Badwater Basin boardwalk', 36.2297, -116.7672, -77.8, -85.5], ['Lake Tahoe, mid lake', 39.0968, -120.0324, 1897.6, 1897], ['SF Twin Peaks', 37.7513, -122.4475, 259.0, 281], ['SF Ferry Building', 37.7955, -122.3937, 2.0, 3.3], ['Coronado, Naval Air Station North Island', 32.6990, -117.2100, null, null], ['Coronado, Hotel del Coronado', 32.6808, -117.1783, null, null]];
  for (const [n, la, lo, z14, known] of PTS) {
    const r = await page.evaluate(([la, lo]) => Promise.all([window.__SCOUT_TOPO__.eleAt(la, lo, 14), window.__SCOUT_TOPO__.eleAt(la, lo, 12)]).then(v => ({ z14: v[0], z12: v[1], grid: window.__SCOUT_TOPO__.gridAt(la, lo) })), [la, lo]);
    console.log(`height ${n}: z14 ${r.z14.toFixed(1)} m, z12 ${r.z12.toFixed(1)} m, statewide grid ${isNaN(r.grid) ? 'none' : r.grid.toFixed(0)} m | research z14 ${z14}, known ${known}${z14 != null ? ' | diff ' + (r.z14 - z14).toFixed(1) : ''}`);
  }
  /* state view */
  await page.evaluate(() => window.__SCOUT_TOPO__.api.stateView()); let s = await settle(); await wait(1500);
  console.log('state view', JSON.stringify(s), 'zoom', await page.evaluate(() => window.__SCOUT_TOPO__.api.map.getZoom())); await shot('01_state_tint.png');
  await page.evaluate(() => window.__SCOUT_TOPO__.api.set({ mode: 'shade', op: 0.8 })); await settle(); await wait(1200); await shot('02_state_shade.png');
  /* region */
  await page.evaluate(() => { const a = window.__SCOUT_TOPO__.api; a.set({ mode: 'tint', op: 0.85, contours: false }); a.map.setView([34.2, -117.9], 9, { animate: false }); }); s = await settle(); await wait(2500); console.log('region LA', JSON.stringify(s)); await shot('03_region_la_tint.png');
  await page.evaluate(() => { const a = window.__SCOUT_TOPO__.api; a.set({ mode: 'shade', op: 0.8 }); a.map.setView([36.6, -118.0], 9, { animate: false }); }); await settle(); await wait(3500); await shot('04_region_sierra_owens_shade.png');
  await page.evaluate(() => { const a = window.__SCOUT_TOPO__.api; a.set({ mode: 'tint', op: 0.9, contours: true }); a.map.setView([37.8, -122.25], 11, { animate: false }); }); await settle(); await wait(3500); await shot('05_bay_tint_contours.png');
  /* street */
  await page.evaluate(() => { const a = window.__SCOUT_TOPO__.api; a.set({ mode: 'shade', op: 0.8, contours: true }); a.map.setView([37.7513, -122.4475], 16, { animate: false }); }); await settle(); await wait(5000); await shot('06_street_twin_peaks_shade_contours.png');
  await page.evaluate(() => { const a = window.__SCOUT_TOPO__.api; a.set({ mode: 'slope', op: 0.7, contours: false }); a.map.setView([37.7513, -122.4475], 15, { animate: false }); }); await settle(); await wait(4000); await shot('07_twin_peaks_slope.png');
  await page.evaluate(() => { const a = window.__SCOUT_TOPO__.api; a.set({ mode: 'esri', op: 0.8 }); a.map.setView([37.65, -119.03], 12, { animate: false }); }); await wait(6000); await shot('08_mammoth_esri_hillshade.png');
  /* the site reading at four places */
  const SITES = [['San Francisco, 501 Twin Peaks Blvd', 37.7544, -122.4477], ['San Francisco, Marina (Chestnut St)', 37.8005, -122.4370], ['Mammoth Lakes, Old Mammoth Rd', 37.6405, -118.9660], ['Palm Springs, downtown', 33.8230, -116.5450], ['Coronado, Orange Ave', 32.6859, -117.1831], ['Wrightwood (Cajon Pass country)', 34.3608, -117.6334]];
  for (const [n, la, lo] of SITES) {
    const r = await page.evaluate(([la, lo]) => window.__SCOUT_TOPO__.api.siteAt(la, lo).then(r => ({ elev: r.elev, src: r.src, slope: r.slope, aspect: r.aspect, tpi: r.tpi, pos: r.pos, prov: r.prov && r.prov.n, near: r.prov && r.prov.near, range: r.range && [r.range.n, +r.range.km.toFixed(1), r.range.dir], low: r.low && [r.low.n, +r.low.km.toFixed(1), r.low.dir], peak: r.peak && [r.peak.n, r.peak.m, +r.peak.km.toFixed(1)], pass: r.pass && [r.pass.n, +r.pass.km.toFixed(1)], coast: r.coast, x: r.x || null })), [la, lo]);
    console.log('site', n, JSON.stringify(r));
  }
  console.log('final state', JSON.stringify(await page.evaluate(() => window.__SCOUT_TOPO__.api.state())));
  console.log('PAGE ERRORS:', errs.length ? errs.join('\n') : 'none');
  await browser.close();
})().catch(e => { console.error('ERROR', e); process.exit(2); });
