/* California port of tests/smoke2.js (CA/scout/tests/la_port/port_suites.py) */
/* The heavier paths: address search, the 3D street view, AI detail past zoom 19, the CSV export, the hand-offs.
   node smoke2.js <atlas.html> <outdir> */
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const FILE = path.resolve(process.argv[2]), OUT = path.resolve(process.argv[3] || '.');
fs.mkdirSync(OUT, { recursive: true });
const wait = ms => new Promise(r => setTimeout(r, ms));
const __hard = setTimeout(() => { console.log('HARD TIMEOUT'); process.exit(3); }, (+process.env.HARD || 14) * 60000);
(async () => {
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
  const browser = await chromium.launch({ proxy, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1, acceptDownloads: true });
  const page = await ctx.newPage();
  const errs = [], logs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + (e && e.stack || e)));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text().slice(0, 300)); });
  await page.goto('file://' + FILE + '#rooftops', { waitUntil: 'load', timeout: 240000 });
  await wait(4000);
  const settle = async (max) => { const t0 = Date.now(); while (Date.now() - t0 < (max || 120000)) { await wait(2000); const st = await page.evaluate(() => MODI.rooftops.api.status()); if (!(st.queued + st.running) && !st.tiles.some(t => t.st === 'load' || t.st === 'queued') && st.tiles.some(t => t.st === 'ok' || t.st === 'err')) return st; } return null; };

  /* 1. address search through the Esri geocoder */
  await page.fill('#scFind', '2300 J St, Sacramento, CA');
  await page.press('#scFind', 'Enter');
  await settle(150000); await wait(2500);
  const picked = await page.evaluate(() => { const t = document.querySelector('#scName'); return t && t.textContent; });
  console.log('search picked:', picked);
  const card = await page.evaluate(() => document.querySelector('#scDetail').innerText.slice(0, 1800));
  console.log('card:\n' + card);
  await page.screenshot({ path: path.join(OUT, '10-search-sacramento.png') });

  /* 2. CSV export */
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }).catch(() => null), page.click('#scCsv')]);
  if (dl) { const p = path.join(OUT, await dl.suggestedFilename()); await dl.saveAs(p); const txt = fs.readFileSync(p, 'utf8'); const lines = txt.split('\n'); console.log('CSV', path.basename(p), lines.length, 'lines; header:', lines.find(l => l.startsWith('status')).slice(0, 300)); console.log('CSV row 1:', (lines[lines.findIndex(l => l.startsWith('status')) + 1] || '').slice(0, 400)); }
  else console.log('CSV: no download event');

  /* 3. AI detail past zoom 19 */
  await page.evaluate(() => { MODI.rooftops.api.map().setZoom(21); });
  await wait(20000);
  const ai = await page.evaluate(() => MODI.rooftops.api.ai());
  const aictl = await page.evaluate(() => { const d = document.querySelector('.sc-aictl'); return d && d.innerText; });
  console.log('AI detail:', JSON.stringify(ai), '|', aictl);
  /* Real-ESRGAN on SwiftShader (no GPU here) holds the main thread for a long time: switch it off before going on */
  await page.evaluate(() => { const b = document.querySelector('.sc-aictl button'); if (b && /On/.test(b.textContent)) b.click(); });
  await wait(8000);
  await page.evaluate(() => { MODI.rooftops.api.map().setZoom(18); });
  await wait(4000);
  await page.screenshot({ path: path.join(OUT, '11-z18-after-ai.png'), timeout: 90000 }).catch(e => console.log('screenshot skipped:', e.message.split('\n')[0]));

  /* 4. the 3D street view for the selected building */
  const id = await page.evaluate(() => { const bs = MODI.rooftops.api.buildings().filter(b => b.cls === 'sf').sort((a, b) => b.sc.score - a.sc.score); return bs[0] && bs[0].id; });
  await page.evaluate(id => { const b = MODI.rooftops.api.buildings().find(x => x.id === id); MODI.rooftops.api.open3D({ lat: b.lat, lon: b.lon, street: b.street, b }); }, id);
  let st3 = null; const t0 = Date.now();
  while (Date.now() - t0 < 240000) { await wait(5000); st3 = await page.evaluate(() => { const d = MODI.rooftops.api.d3(); if (!d) return { none: true }; const s = d.state(), g = d.graphics ? d.graphics() : {}; return { built: s.built, roads: s.roads, mode: s.mode, road: s.road, note: (document.querySelector('#sc3dNote') || {}).textContent, trace: g.traceDate, traceSource: g.traceSource, q: g.label }; }); if (st3 && st3.built > 0 && st3.roads && /Traced by AI|did not run|No satellite photo/.test(st3.note || '')) break; }
  console.log('3D:', JSON.stringify(st3));
  await page.screenshot({ path: path.join(OUT, '12-3d-street.png') });
  const bar = await page.evaluate(() => (document.querySelector('#sc3dBar') || {}).innerText);
  console.log('3D bar:', (bar || '').slice(0, 600));
  /* bird height */
  await page.evaluate(() => { const d = MODI.rooftops.api.d3(); if (d) d.setHeight('bird'); });
  await wait(6000);
  await page.screenshot({ path: path.join(OUT, '13-3d-bird.png') });
  /* glTF export */
  const glb = await page.evaluate(async () => { const d = MODI.rooftops.api.d3(); if (!d || !d.exportGLB) return 'no exporter'; try { const b = await d.exportGLB(); return 'glb bytes ' + b.size; } catch (e) { return 'export failed: ' + e.message; } });
  console.log('GLB:', glb);

  /* 5. hand-offs to other modules */
  await page.evaluate(() => { const b = MODI.rooftops.api.buildings()[0]; goModule('lines', { zip: b.zip, line: 'replace' }); });
  await wait(1500);
  const linesShown = await page.evaluate(() => !document.querySelector('#mod-lines').hidden);
  await page.evaluate(() => goModule('rooftops', { zip: '95816' }));
  await wait(4000);
  const back = await page.evaluate(() => ({ shown: !document.querySelector('#mod-rooftops').hidden, name: document.querySelector('#scName').textContent, z: MODI.rooftops.api.map().getZoom() }));
  console.log('hand-off to lines shown:', linesShown, '| back to scout with ZIP:', JSON.stringify(back));
  await page.screenshot({ path: path.join(OUT, '14-zip-95816.png') });

  console.log('\nPAGE ERRORS:', errs.length ? errs.join('\n') : 'none');
  console.log('CONSOLE errors/warnings:', logs.length ? logs.slice(0, 40).join('\n') : 'none');
  await browser.close(); clearTimeout(__hard);
})().catch(e => { console.error('TEST FAILED', e); process.exit(1); });
