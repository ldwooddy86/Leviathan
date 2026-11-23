/* The card, the CSV and a dead tile service. node t2_card.js [page.html]   (NODE_PATH=/opt/node-tools/node_modules) */
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const FILE = path.resolve(process.argv[2] || path.join(__dirname, 'page.html')), SHOTS = path.join(__dirname, '..', 'shots');
const wait = ms => new Promise(r => setTimeout(r, ms));
const ADDR = [['sf', '1 Crestline Dr, San Francisco, CA 94131'], ['mammoth', '437 Old Mammoth Rd, Mammoth Lakes, CA 93546'], ['palmsprings', '300 S Palm Canyon Dr, Palm Springs, CA 92262'], ['coronado', '1100 Orange Ave, Coronado, CA 92118']];
(async () => {
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
  const browser = await chromium.launch({ proxy, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 1250, height: 1000 }, deviceScaleFactor: 1, acceptDownloads: true });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push('pageerror: ' + (e && e.stack || e)));
  await page.goto('file://' + FILE + '#rooftops', { waitUntil: 'load', timeout: 180000 }); await wait(2500);
  const settle = async (max) => { const t0 = Date.now(); while (Date.now() - t0 < (max || 90000)) { await wait(2000); const st = await page.evaluate(() => MODI.rooftops.api.status()); if (!(st.queued + st.running) && !st.tiles.some(t => t.st === 'load' || t.st === 'queued') && st.tiles.some(t => t.st === 'ok' || t.st === 'err')) return st; } return null; };
  for (const [key, addr] of (process.env.ONLY ? ADDR.filter(a => a[0] === process.env.ONLY) : ADDR)) {
    await page.fill('#scFind', addr); await page.press('#scFind', 'Enter'); const st = await settle(); await wait(2500);
    let sec = await page.evaluate(() => { const e = document.querySelector('#scDetail .sc-topo-sec'); return e ? e.innerText : null; });
    const head = await page.evaluate(() => document.querySelector('#scName').textContent + ' | ' + document.querySelector('#scSub').textContent);
    for (let i = 0; i < 10 && sec && /Reading the terrain/.test(sec); i++) { await wait(1500); sec = await page.evaluate(() => { const e = document.querySelector('#scDetail .sc-topo-sec'); return e ? e.innerText : null; }); }
    console.log(`\n== ${addr}\n   card: ${head}\n   buildings tiles: ${st ? st.tiles.length : 'not settled'}\n${sec ? sec.split('\n').map(l => '   ' + l).join('\n') : '   NO TERRAIN SECTION'}`);
    const box = await page.evaluate(() => { const c = document.querySelector('#scDetail .sc-topo-sec'); if (!c) return null; c.scrollIntoView({ block: 'center' }); const r = c.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
    if (box) { await wait(400); await page.screenshot({ path: path.join(SHOTS, `10_card_${key}.png`), timeout: 120000, clip: { x: Math.max(0, box.x - 8), y: Math.max(0, box.y - 8), width: box.width + 16, height: Math.min(900, box.height + 16) } }); }
  }
  /* the CSV of the last view */
  try {
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.click('#scCsv')]);
    const p = path.join(__dirname, 'export.csv'); await dl.saveAs(p); const t = fs.readFileSync(p, 'utf8'), lines = t.split(/\r?\n/);
    const hi = lines.findIndex(l => /(^|,)status,score/.test(l) || /ground_elev_ft/.test(l)), H = lines[hi].split(','), i0 = H.indexOf('ground_elev_ft');
    console.log(`\nCSV: ${lines.length} lines; header at line ${hi + 1} with ${H.length} columns; terrain columns from ${i0}: ${H.slice(i0).join(' | ')}`);
    const parse = l => { const o = []; let c = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { o.push(c); c = ''; } else c += ch; } o.push(c); return o; };
    for (let k = 1; k <= 3; k++) console.log('  row', k, parse(lines[hi + k] || '').slice(i0).join(' | '));
    const rows = lines.slice(hi + 1).filter(l => l && !/^[A-Z][a-z]+ columns|^Terrain|^Rooftop|^Score|^Sources|^p_/.test(l)).map(parse).filter(r => r.length === H.length);
    console.log('  rows with all columns:', rows.length, '| with an elevation:', rows.filter(r => r[i0] !== '').length, '| from tiles:', rows.filter(r => /tiles/.test(r[i0 + 2])).length);
    console.log('  note tail:', t.slice(-420).replace(/\n/g, ' / '));
  } catch (e) { console.log('CSV: failed', e.message); }
  console.log('PAGE ERRORS:', errs.length ? errs.join('\n') : 'none');
  await page.close();

  /* a dead terrain service: every tile request fails */
  const p2 = await ctx.newPage(); const e2 = []; p2.on('pageerror', e => e2.push('pageerror: ' + (e && e.stack || e)));
  await p2.route(/elevation-tiles-prod/, r => r.abort());
  await p2.goto('file://' + FILE + '#rooftops', { waitUntil: 'load', timeout: 180000 }); await wait(2500);
  await p2.evaluate(() => { const a = window.__SCOUT_TOPO__.api; a.set({ mode: 'tint', op: 0.9, contours: true }); a.map.setView([34.1, -117.6], 10, { animate: false }); }); await wait(7000);
  const r = await p2.evaluate(() => window.__SCOUT_TOPO__.api.siteAt(34.1083, -117.2898).then(r => ({ elev: r.elev, src: r.src, slope: r.slope, prov: r.prov && r.prov.n })));
  await p2.click('#scTopoB'); await wait(500);
  console.log('\ndead tile service: state', JSON.stringify(await p2.evaluate(() => window.__SCOUT_TOPO__.api.state())), '| site', JSON.stringify(r), '| note:', await p2.evaluate(() => document.querySelector('#scTopoNote').textContent));
  const box = await p2.evaluate(() => { const c = document.querySelector('#scMap'); c.scrollIntoView({ block: 'center' }); const r = c.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }); await wait(500);
  await p2.screenshot({ path: path.join(SHOTS, '11_dead_tiles_grid_standin.png'), timeout: 120000, clip: { x: Math.max(0, box.x), y: Math.max(0, box.y), width: box.width, height: box.height } });
  console.log('PAGE ERRORS (dead service):', e2.length ? e2.join('\n') : 'none');
  await browser.close();
})().catch(e => { console.error('ERROR', e); process.exit(2); });
