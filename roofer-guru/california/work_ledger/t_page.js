/* Browser test of modules 02, 11, 13, 14: node t_page.js <page.html> [net]   (net: also try the live weather refresh) */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2]); const NET = process.argv[3] === 'net';
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
  const browser = await chromium.launch({ proxy, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  let blocked = 0, block = true;
  await ctx.route(/^https?:\/\//, r => { if (block) { blocked++; return r.abort(); } return r.continue(); });
  const errs = []; page.on('pageerror', e => errs.push(String(e && e.stack || e).slice(0, 600)));
  page.on('console', m => { if (m.type() === 'error' && !/net::ERR|Failed to load resource/.test(m.text())) errs.push('console: ' + m.text().slice(0, 300)); });
  const t0 = Date.now();
  await page.goto('file://' + FILE + '#storms', { waitUntil: 'load', timeout: 240000 }); await wait(4000);
  console.log('loaded in', Date.now() - t0, 'ms; errors so far', errs.length);
  const go = async k => { const n = errs.length; const t = Date.now(); await page.evaluate(k2 => goModule(k2), k); await wait(2500); const txt = await page.evaluate(k2 => { const s = document.querySelector('#mod-' + k2); return s ? { len: s.innerText.length, hidden: s.hidden, h1: (s.querySelector('h1, h2') || {}).innerText } : null; }, k); console.log('MODULE', k, JSON.stringify(txt), 'ms', Date.now() - t, 'new errors', errs.length - n); return txt; };
  /* ---- module 02 ---- */
  await go('storms');
  const m2 = await page.evaluate(() => { const r = document.querySelector('#mod-storms'); const svg = r.querySelector('#s2Map svg'); const per = [...svg.querySelectorAll('path')].filter(p => p.dataset.pt && +p.dataset.pt >= 1e6); return { perims: per.length, shown: per.filter(p => p.style.display !== 'none').length, dots: svg.querySelectorAll('circle.pt').length, pins: svg.querySelectorAll('[data-pin]').length, kpis: [...r.querySelectorAll('#s2Kpis .kpi')].map(k => k.innerText.replace(/\s+/g, ' ').slice(0, 110)), leg: r.querySelector('#s2Leg .dn').innerText.slice(0, 200), fires: r.querySelectorAll('#s2Storms tbody tr').length, cal: r.querySelectorAll('#s2Cal svg').length, yk: r.querySelectorAll('#s2YK option').length, roofRows: r.querySelectorAll('#s2Roof table tr').length }; });
  console.log('M02', JSON.stringify(m2, null, 1));
  for (const z of ['95969', '90272', '91001', '96150', '99999']) {
    await page.fill('#s2Zip', z); await page.click('#s2ZipGo'); await wait(1200);
    const d = await page.evaluate(() => ({ name: document.querySelector('#s2Name').innerText, big: (document.querySelector('#s2Detail .big') || {}).innerText, fires: [...document.querySelectorAll('#s2Detail table tbody tr')].slice(0, 4).map(t => t.innerText.replace(/\s+/g, ' ')), rows: document.querySelectorAll('#s2Detail .rowl').length, chart: !!document.querySelector('#s2ZY svg') }));
    console.log('ZIP', z, JSON.stringify(d));
  }
  /* open the top fire through the menu, then a wind event and a landfall through the tables */
  const fsel = await page.evaluate(() => { const o = [...document.querySelectorAll('#s2Storm option')].find(x => /Camp 2018/.test(x.textContent)) || document.querySelectorAll('#s2Storm option')[1]; if (!o) return null; const s = document.querySelector('#s2Storm'); s.value = o.value; s.dispatchEvent(new Event('change')); return o.textContent; }); await wait(1500);
  console.log('FIRE', fsel, JSON.stringify(await page.evaluate(() => ({ name: document.querySelector('#s2Name').innerText, big: (document.querySelector('#s2Detail .big') || {}).innerText, zips: document.querySelectorAll('#s2Top tbody tr').length, brief: (document.querySelector('#s2BriefTxt') || {}).innerText && document.querySelector('#s2BriefTxt').innerText.slice(0, 160) }))));
  await page.evaluate(() => { const s = document.querySelector('#s2Storm'); s.value = ''; s.dispatchEvent(new Event('change')); }); await wait(800);
  for (const id of ['#s2WT', '#s2ArT']) { const ok = await page.evaluate(i => { const r = document.querySelector(i + ' tbody tr'); if (!r) return false; r.click(); return true; }, id); await wait(900); console.log('EVENT', id, ok, JSON.stringify(await page.evaluate(() => ({ name: document.querySelector('#s2Name').innerText, big: (document.querySelector('#s2Detail .big') || {}).innerText })))); }
  await page.screenshot({ path: path.join(__dirname, 'out', 'm02_' + path.basename(FILE, '.html') + '.png'), timeout: 180000, clip: { x: 0, y: 0, width: 1200, height: 800 } }).catch(e => console.log('shot failed', e.message));
  /* ---- module 11 ---- */
  await go('regions');
  console.log('M11', JSON.stringify(await page.evaluate(() => { const r = document.querySelector('#mod-regions'); const c = r.querySelector('.regcard'); return { cards: r.querySelectorAll('.regcard').length, card0: c ? c.innerText.replace(/\s+/g, ' ').slice(0, 260) : null, measures: r.querySelectorAll('#r11Met option').length, tbl: r.querySelectorAll('#r11Tbl tbody tr').length, haz: r.querySelectorAll('#r11Haz th').length, ins: r.querySelectorAll('#r11Ins th').length, mkt: [...r.querySelectorAll('#r11Mkt tbody tr')].map(t => t.children[0].innerText + ': ' + t.children[1].innerText), trend: r.querySelector('#r11Trend').innerText.slice(0, 200) }; }), null, 1));
  await page.evaluate(() => document.querySelectorAll('#mod-regions .regcard')[3].click()); await wait(1200);
  console.log('M11 region', JSON.stringify(await page.evaluate(() => ({ name: document.querySelector('#r11Name').innerText, rows: document.querySelectorAll('#r11Detail .rowl').length, character: (document.querySelector('#r11Detail p.mini') || {}).innerText }))));
  /* ---- module 13 ---- */
  await go('watch');
  console.log('M13', JSON.stringify(await page.evaluate(() => { const r = document.querySelector('#mod-watch'); return { kpis: [...r.querySelectorAll('#w13Kpis .kpi')].map(k => k.innerText.replace(/\s+/g, ' ').slice(0, 90)), watch: r.querySelectorAll('#w13Tbl tbody tr').length, fld: r.querySelectorAll('#w13Fld tbody tr').length, cty: r.querySelectorAll('#w13Cty tbody tr').length, samples: [...r.querySelectorAll('#w13BSam .asset')].map(a => a.querySelector('b').innerText + ' -> ' + a.querySelector('.why').innerText.slice(0, 120)), dig: r.querySelector('#w13Dig').innerText.slice(0, 400) }; }), null, 1));
  await page.fill('#w13AN', 'Test Roofing Co'); await page.fill('#w13AH', 'Fresno'); await page.click('#w13AddCo'); await wait(800);
  await page.fill('#w13BT', 'We pay your deductible and handle your insurance claim. Free roof!'); await page.click('#w13BRun'); await wait(500);
  console.log('M13 add+bench', JSON.stringify(await page.evaluate(() => ({ watch: document.querySelectorAll('#w13Tbl tbody tr').length, sel: document.querySelector('#w13Name').innerText, bench: document.querySelector('#w13BOut').innerText.slice(0, 300) }))));
  await page.evaluate(() => { try { localStorage.removeItem('cg.watch.v1'); } catch (e) { } });
  /* ---- module 14 with the network blocked ---- */
  await go('weather');
  const m14 = () => page.evaluate(() => { const r = document.querySelector('#mod-weather'); return { snap: r.querySelector('#w14Snap').innerText.slice(0, 160), kpis: [...r.querySelectorAll('#w14Kpis .kpi')].map(k => k.innerText.replace(/\s+/g, ' ').slice(0, 100)), pts: r.querySelectorAll('#w14Pt button').length, win: r.querySelectorAll('#w14Win tbody tr').length, work: r.querySelectorAll('#w14Work tbody tr').length, alerts: r.querySelectorAll('#w14Alerts .asset').length, chart: !!r.querySelector('#w14Chart svg'), cal: r.querySelectorAll('#w14Cal tbody tr').length, play: r.querySelectorAll('#w14Play details').length, afd: r.querySelectorAll('#w14Afd button').length, afdLen: r.querySelector('#w14AfdT').innerText.length, rec: r.querySelector('#w14Rec').innerText.slice(0, 120), detail: r.querySelector('#w14Detail').innerText.replace(/\s+/g, ' ').slice(0, 260) }; });
  console.log('M14 offline', JSON.stringify(await m14(), null, 1), 'requests blocked', blocked);
  for (const lay of ['ero1', 'fire1', 'trig', 'alerts']) { await page.click(`#w14Lay button[data-v="${lay}"]`); await wait(400); }
  await page.click('#w14Pt button[data-v="3"]'); await wait(800);
  console.log('M14 Truckee', (await page.evaluate(() => document.querySelector('#w14Detail').innerText.replace(/\s+/g, ' ').slice(0, 300))));
  await page.click('#w14Ref'); await wait(2500);
  console.log('M14 refresh while blocked -> still', (await page.evaluate(() => document.querySelector('#w14Snap').innerText.slice(0, 40))));
  if (NET) { block = false; await page.click('#w14Ref'); let live = ''; for (let i = 0; i < 40; i++) { await wait(3000); live = await page.evaluate(() => document.querySelector('#w14Snap').innerText.slice(0, 120)); if (/^Live/.test(live)) break; }
    console.log('M14 live:', live); console.log('M14 after refresh', JSON.stringify(await m14(), null, 1)); }
  console.log('PAGE ERRORS (' + errs.length + '):', errs.length ? '\n' + [...new Set(errs)].join('\n---\n') : 'none');
  await browser.close();
})().catch(e => { console.error('ERROR', e); process.exit(2); });
