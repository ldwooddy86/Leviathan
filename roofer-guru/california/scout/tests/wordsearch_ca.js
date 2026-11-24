/* The last word search of module 18 as a reader meets it: every text, tooltip and label of the Rooftop Scout tab with a
   building picked, then of the Scout Engine's bar, HUD and each roof view's legend, searched for anything Louisiana,
   hurricane or surge. node wordsearch_ca.js <page.html> */
const L = require('./lib.js');
const BAN = /louisiana|parish|hurricane|\bsurge\b|\bgulf\b|new orleans|baton rouge|lake charles|lafayette|bayou|tropical (storm|depression|outlook)|levee|fortified|lslbc|category [1-5]\b|\btexas\b|dallas|contraflow|\bida\b|katrina|laura\b|named storm|saffir|storm tide|coastal zone/i;
(async () => {
  const { page, errs, close } = await L.launch({ w: 1200, h: 900, hard: 12 }); const wait = L.wait, C = L.checker();
  await L.openPage(page, process.argv[2]); await L.find(page, '627 E Calaveras St, Altadena, CA'); await wait(3000);
  const grab = sel => page.evaluate(sel => { const root = document.querySelector(sel); if (!root) return ''; root.querySelectorAll('details').forEach(d => { d.open = true; }); const out = [root.innerText]; root.querySelectorAll('[title], [aria-label], [placeholder], option').forEach(e => { ['title', 'aria-label', 'placeholder'].forEach(a => { const v = e.getAttribute(a); if (v) out.push(v); }); if (e.tagName === 'OPTION') out.push(e.textContent); }); return out.join('\n'); }, sel);
  const scan = (name, t) => { const hits = []; let m; const re = new RegExp(BAN.source, 'gi'); while ((m = re.exec(t)) && hits.length < 12) hits.push(t.slice(Math.max(0, m.index - 70), m.index + 70).replace(/\s+/g, ' ')); C.ok(!hits.length, name + ' (' + t.length + ' characters)', hits.length ? hits : undefined); };
  scan('the Rooftop Scout tab with a building picked', await grab('#mod-rooftops'));
  scan('the rail tab', await page.evaluate(() => (document.querySelector('#tab-rooftops') || {}).innerText || ''));
  await L.engine(page, { life: true });
  for (const m of ['street', 'alta', 'saucer', 'm3']) { await page.evaluate(m => MODI.rooftops.api.en().setHeight(m), m); await wait(3500); scan('engine bar and view, ' + m, await grab('#scEnW')); }
  await page.evaluate(() => { const api = MODI.rooftops.api; api.setRain('ar4'); api.setWind('sa3'); api.setSky('smoke'); api.en().setHeight('drone'); }); await wait(2500);
  for (const l of ['cover', 'style', 'thermal', 'wear', 'storm', 'fire', 'solar', 'time']) { await page.evaluate(k => document.querySelector('#scEnBar [data-lens="' + k + '"]').click(), l); for (let i = 0; i < 12; i++) { await wait(2500); const g = await page.evaluate(() => { const g = MODI.rooftops.api.en().graphics(); return [g.lensN, g.lensPending]; }); if (g[0] > 0 && !g[1]) break; } await wait(1500); scan('roof view ' + l + ': bar, legend, labels', await grab('#scEnW')); }
  const eng = await page.evaluate(() => { const SE = window.__SCOUT_ENGINE__ || {}, en = MODI.rooftops.api.en(), out = []; ['STORM', 'WIND', 'SKY'].forEach(k => (SE[k] || []).forEach(r => out.push([r.l, r.s, r.note].join(' ')))); out.push(en.car.note, en.car.keys, en.car.short, en.NOFLY, JSON.stringify(en.air.info().what), en.weather().text); return out.join('\n'); });
  scan('the engine\'s own tables and notes (weather steps, the car, the aircraft kit)', eng);
  console.log('PAGE ERRORS:', errs.length ? errs.length + '\n' + [...new Set(errs)].slice(0, 8).join('\n') : 'none'); console.log(C.bad ? C.bad + ' FAILED' : 'all pass');
  await close(); process.exit(C.bad || errs.length ? 1 : 0);
})().catch(e => { console.error('ERROR', e); process.exit(2); });
