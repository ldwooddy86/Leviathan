/* Headless check of the core parts and modules 01, 04, 05, 12, 17 of California Roofer Guru.
   node test_core.js <page.html> <outdir> */
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const FILE = path.resolve(process.argv[2]), OUT = path.resolve(process.argv[3] || 'out');
fs.mkdirSync(OUT, { recursive: true });
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 1 })).newPage();
  const errs = []; page.on('pageerror', e => errs.push('pageerror: ' + String(e && e.stack || e).slice(0, 600)));
  const cons = []; page.on('console', m => { if (m.type() === 'error') cons.push(m.text().slice(0, 400)); });
  await page.goto('file://' + FILE + '#index', { waitUntil: 'load', timeout: 240000 }); await wait(2500);
  const info = await page.evaluate(() => ({ title: document.title, brand: document.querySelector('.brandmark').innerText, facts: document.getElementById('shellFacts').innerText.replace(/\n/g, ' | '), foot: document.querySelector('.shell-foot').innerText.slice(0, 120), desc: document.querySelector('meta[name=description]').content.slice(0, 120),
    rail: [...document.querySelectorAll('#rail button')].map(b => b.querySelector('.n').textContent + ' ' + b.querySelector('.t').textContent), lines: LINE_KEYS.join(','), res: RES_LINES.length, com: COM_LINES.length, nz: Z.length, nzr: ZR.length, nc: PA.length, nreg: REG_KEYS.length, slm: SLM.LINES.length, layers: Object.keys(LAYERS).length,
    geo: [GEO.W, GEO.H, GEO_U], cities: MAP_CITIES.length, tiers: [0, 1, 2, 3, 4].map(t => MAP_CITIES.filter(c => c.tier === t).length), water: MAP_WATER.map(w => w.name).join(', ').slice(0, 300), hc: JSON.stringify(HC), hz: JSON.stringify({ rain: !!HZ.rain, rr: Object.keys(HZ.rainR).length, m: Object.keys(HZ.month).filter(k => HZ.month[k]) }), sea: JSON.stringify({ repair: SLM.SEA.repair, storm: SLM.SEA.storm, replace: SLM.SEA.replace, coat: SLM.SEA.coat }), dp: JSON.stringify(SLM.DAYPARTS), def: JSON.stringify(SLM.DEF).slice(0, 300) }));
  console.log(JSON.stringify(info, null, 1));
  const failed = async key => page.evaluate(k => { const s = document.getElementById('mod-' + k); return { hidden: s.hidden, fail: /This module failed to load/.test(s.innerText) ? s.innerText.slice(0, 300) : '', len: s.innerText.length, undef: (s.innerText.match(/undefined|NaN|\[object Object\]/g) || []).length, la: (s.innerText.match(/Louisiana|[Pp]arish|[Hh]urricane|FORTIFIED|Gulf|New Orleans|Baton Rouge|LSLBC/g) || []).length, zpaths: s.querySelectorAll('.mapsvg path.z').length, cty: s.querySelectorAll('.mapsvg path.cty').length, charts: s.querySelectorAll('svg.chart').length, tables: s.querySelectorAll('table').length }; }, key);
  for (const key of ['index', 'drivers', 'paid', 'lines', 'stock']) {
    const n0 = errs.length; await page.evaluate(k => showModule(k), key); await wait(3500);
    const r = await failed(key); console.log('MODULE', key, JSON.stringify(r), 'new errors:', errs.length - n0, cons.splice(0).join(' || ').slice(0, 800));
    if (r.undef) console.log('  undefined/NaN samples:', await page.evaluate(k => { const s = document.getElementById('mod-' + k).innerText; const out = []; const re = /.{60}(undefined|NaN|\[object Object\]).{40}/g; let m; while ((m = re.exec(s)) && out.length < 8) out.push(m[0].replace(/\n/g, ' ')); return out; }, key));
    await page.screenshot({ path: path.join(OUT, 'mod-' + key + '.png'), timeout: 120000 }).catch(e => console.log('shot failed', e.message.split('\n')[0]));
  }
  // module 01: every layer draws with a legend and a note
  await page.evaluate(() => showModule('index')); await wait(1500);
  const lay = await page.evaluate(async () => { const sel = document.getElementById('i1Layer'); const out = { n: 0, bad: [], empty: [] }; const keys = [...sel.options].map(o => o.value);
    for (const k of keys) { sel.value = k; try { sel.onchange({ target: sel }); } catch (e) { out.bad.push(k + ': ' + e.message); continue; } out.n++; const leg = document.getElementById('i1Leg'); const title = leg.querySelector('.lt') ? leg.querySelector('.lt').textContent : ''; const note = leg.querySelector('.dn') ? leg.querySelector('.dn').textContent : ''; const ramp = leg.querySelectorAll('.ramp i').length;
      const nd = getComputedStyle(document.documentElement).getPropertyValue('--nodata').trim(); let filled = 0; document.querySelectorAll('#i1Map path.z').forEach(p => { if (p.style.fill && p.style.fill !== nd) filled++; }); const vals = ZR.filter(z => z[k] != null && isFinite(+z[k])).length;
      if (!title || note.length < 60 || ramp < 5 || /undefined|NaN/.test(leg.textContent)) out.bad.push(k + ' legend: ' + leg.textContent.slice(0, 120)); if (vals < ZR.length * 0.5) out.empty.push(k + ':' + vals); if (filled < 10 && vals > 10) out.bad.push(k + ' filled ' + filled); }
    sel.value = 'idx'; sel.onchange({ target: sel }); return out; });
  console.log('LAYERS drawn', lay.n, 'bad', JSON.stringify(lay.bad), 'sparse (under half the scored ZIPs have a value)', JSON.stringify(lay.empty));
  // map: click a ZIP (Sacramento 95814 by its path), a county via the menu, zoom labels
  const click = await page.evaluate(async () => { const m = document.querySelector('#i1Map svg'); m.scrollIntoView({ block: 'center' }); const r = m.getBoundingClientRect(); return { w: r.width, h: r.height, vb: m.getAttribute('viewBox') }; });
  console.log('map box', JSON.stringify(click));
  for (const zip of ['95814', '90011', '96150']) {
    await page.evaluate(z => { document.getElementById('i1Find').value = z; document.getElementById('i1Find').dispatchEvent(new Event('change')); }, zip); await wait(900);
    const pt = await page.evaluate(z => { const p = document.querySelector('#i1Map path.z[data-zip="' + z + '"]'); p.scrollIntoView({ block: 'center' }); const r = p.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height, name: document.getElementById('i1Name').textContent }; }, zip);
    await page.evaluate(() => { document.getElementById('i1Find').value = ''; }); // deselect by clicking the ZIP itself, then click again to select
    await page.mouse.click(pt.x, pt.y); await wait(500); const a = await page.evaluate(() => document.getElementById('i1Name').textContent);
    await page.mouse.click(pt.x, pt.y); await wait(500); const b = await page.evaluate(() => ({ name: document.getElementById('i1Name').textContent, sub: document.getElementById('i1Sub').textContent, rows: document.querySelectorAll('#i1Detail .rowl').length, bars: document.querySelectorAll('#i1Detail .zbar').length, tr: document.querySelectorAll('#i1Detail table.keep tbody tr').length }));
    await page.mouse.move(pt.x + 1, pt.y + 1); await wait(300); const tip = await page.evaluate(() => document.getElementById('tip').innerText.replace(/\n/g, ' | ').slice(0, 260));
    console.log('ZIP', zip, 'found:', pt.name, '| path px', Math.round(pt.w), 'x', Math.round(pt.h), '| after click 1:', a, '| after click 2:', JSON.stringify(b), '| tip:', tip);
  }
  await page.evaluate(() => { const s = document.getElementById('i1Par'); s.value = '06037'; s.onchange({ target: s }); }); await wait(800);
  const cty = await page.evaluate(() => ({ name: document.getElementById('i1Name').textContent, dim: document.querySelectorAll('#i1Map path.z.dim').length, labels: [...document.querySelectorAll('#i1Map .lab')].filter(t => t.parentNode.style.display !== 'none').map(t => t.textContent).slice(0, 40).join(', ') }));
  console.log('COUNTY 06037', JSON.stringify(cty));
  await page.locator('#i1Map').screenshot({ path: path.join(OUT, 'map-la-county.png'), timeout: 120000 }).catch(e => console.log('shot failed', e.message.split('\n')[0]));
  await page.evaluate(() => { const s = document.getElementById('i1Par'); s.value = ''; s.onchange({ target: s }); document.getElementById('i1CtyLab').click(); }); await wait(800);
  const full = await page.evaluate(() => [...document.querySelectorAll('#i1Map .lab')].filter(t => t.parentNode.style.display !== 'none').map(t => t.textContent).join(', '));
  console.log('FULL VIEW labels:', full.slice(0, 900));
  await page.locator('#i1Map').screenshot({ path: path.join(OUT, 'map-state.png'), timeout: 120000 }).catch(e => console.log('shot failed', e.message.split('\n')[0]));
  // service lines: thirteen in every table of module 12; storage keys
  await page.evaluate(() => showModule('lines')); await wait(1500);
  const sl = await page.evaluate(() => ({ pick: document.querySelectorAll('#l12Lines button').length, sea: document.querySelectorAll('#l12Sea tbody tr').length, port: document.querySelectorAll('#l12Port tbody tr').length, method: document.querySelectorAll('#l12Method tbody tr').length, mix: document.querySelectorAll('#l12Mix svg text').length, day: document.querySelector('#l12Day').innerText.slice(0, 260).replace(/\n/g, ' | ') }));
  console.log('LINES tables', JSON.stringify(sl));
  for (const k of ['fire', 'tile', 'solar', 'harden', 'comm']) { await page.evaluate(k => { const b = document.querySelector('#l12Lines button[data-v="' + k + '"]'); b.click(); }, k); await wait(700); const r = await page.evaluate(() => ({ kpi: document.querySelector('#l12Kpis').innerText.replace(/\n/g, ' ').slice(0, 160), leg: document.querySelector('#l12Leg .lt').textContent, law: document.querySelectorAll('#l12Law .lawi').length, kw: document.querySelectorAll('#l12Kw .chip').length })); console.log(' line', k, JSON.stringify(r)); }
  await page.evaluate(() => { toggleTheme(); SLM.set({ budget: 20000 }); BRANDX.save({ name: 'Test Roofing Co', lic: '1234567', city: 'Sacramento' }); }); await wait(1500);
  const keys = await page.evaluate(() => ({ keys: Object.keys(localStorage), title: document.title, brand: document.querySelector('.brandmark').innerText.replace(/\n/g, ' | ') }));
  console.log('STORAGE', JSON.stringify(keys));
  console.log('\nPAGE ERRORS:', errs.length ? errs.join('\n') : 'none');
  console.log('CONSOLE ERRORS:', cons.length ? cons.slice(0, 20).join('\n') : 'none');
  await browser.close();
})().catch(e => { console.error('TEST FAILED', e); process.exit(1); });
