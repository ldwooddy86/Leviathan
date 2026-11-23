/* Rooftop Scout, California: opens the page on module 18, goes to an address, waits for the buildings, picks the one at
   the address and reports what the module read (buildings, parcels, permits, CAL FIRE, climate zone, the card, the
   outlook). node smoke_ca.js <page.html> "<address>" [shot.png]
   Prints one JSON line of facts and "PAGE ERRORS: none" when the page threw nothing. */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2]), ADDR = process.argv[3] || '200 N Spring St, Los Angeles, CA', SHOT = process.argv[4] || '';
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
  const browser = await chromium.launch({ proxy, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 1 })).newPage();
  const errs = []; page.on('pageerror', e => errs.push('pageerror: ' + String((e && e.stack) || e).slice(0, 600)));
  await page.goto('file://' + FILE + '#rooftops', { waitUntil: 'load', timeout: 180000 }); await wait(2000);
  let mounted = false; for (let i = 0; i < 20 && !mounted; i++) { mounted = await page.evaluate(() => !!(typeof MODI !== "undefined" && MODI.rooftops && MODI.rooftops.api)); if (!mounted) await wait(1500); }
  if (!mounted) { console.log(JSON.stringify({ mounted: false })); console.log('PAGE ERRORS:', errs.length ? errs.join('\n') : 'none'); await browser.close(); return; }
  const settle = async (max) => { const t0 = Date.now(); while (Date.now() - t0 < (max || 120000)) { await wait(2000); const st = await page.evaluate(() => MODI.rooftops.api.status()); if (!(st.queued + st.running) && !st.tiles.some(t => t.st === 'load' || t.st === 'queued') && st.tiles.some(t => t.st === 'ok' || t.st === 'err')) return st; } return null; };
  await page.fill('#scFind', ADDR); await page.press('#scFind', 'Enter'); const st = await settle(180000); await wait(4000);
  const out = await page.evaluate(() => {
    const api = MODI.rooftops.api, bs = api.buildings(), cnt = (f) => bs.filter(f).length, by = {};
    bs.forEach(b => { by[b.ybSrc || 'zip'] = (by[b.ybSrc || 'zip'] || 0) + 1; });
    const name = document.querySelector('#scName').textContent, sub = document.querySelector('#scSub').textContent, card = document.querySelector('#scDetail').innerText;
    const cur = bs.find(b => (b.addr || '').toLowerCase() && name.toLowerCase().startsWith(String(b.addr).toLowerCase().slice(0, 8))) || null;
    const pick = cur || bs.slice().sort((a, b) => b.permits.length - a.permits.length)[0] || null; let O = null; try { O = pick ? api.outlook(pick, {}) : null; } catch (e) { O = { err: String(e) }; }
    const st2 = api.status();
    return { n: bs.length, tiles: st2.tiles.length, errors: st2.errors, ybBy: by, addr: cnt(b => b.addr), addrBy: bs.reduce((o, b) => { if (b.addr) o[b.addrSrc] = (o[b.addrSrc] || 0) + 1; return o; }, {}), height: cnt(b => b.h > 0), permits: cnt(b => b.permits.length), strong: cnt(b => b.strong), fhsz: bs.reduce((o, b) => { const k = b.fhsz ? (b.fhsz.l || 'none') : 'unread'; o[k] = (o[k] || 0) + 1; return o; }, {}), fire: cnt(b => b.fire && b.fire.nIn), dins: cnt(b => b.dins), cz: [...new Set(bs.map(b => api.czOf(b)))], cover: cnt(b => b.cover), status: bs.reduce((o, b) => { o[b.status] = (o[b.status] || 0) + 1; return o; }, {}),
      top: bs.reduce((o, b) => { const k = b.roof && b.roof.mat; o[k] = (o[k] || 0) + 1; return o; }, {}),
      name, sub, cardLen: card.length, cardHead: card.slice(0, 500), wx: (card.match(/California's weather on record[\s\S]{0,900}/) || [''])[0],
      pick: pick && { addr: pick.addr, cls: pick.cls, yb: pick.yb, ybSrc: pick.ybSrc, zip: pick.zip, roof: pick.roof.short, keys: pick.roof.keys.map(k => [k[0], +k[1].toFixed(2)]), score: pick.sc.score, need: pick.need.l, lines: pick.lines, permits: pick.permits.slice(0, 3).map(p => [p.d, p.kind, +p.w.toFixed(2), p.src, String(p.desc).slice(0, 70)]), age: +pick.state.age.toFixed(1) },
      out: O && O.all ? { any15: +O.all.any[15].toFixed(3), rep15: +O.all.rep[15].toFixed(3), wind: +O.all.C.wind[15].toFixed(3), rain: +O.all.C.rain[15].toFixed(3), fire: +O.all.C.fire[15].toFixed(4), wear: +O.all.C.wear[15].toFixed(3), hail: +O.all.C.hail[15].toFixed(4), clim: +O.clim.toFixed(2), fk: O.fk, km: +O.km.toFixed(1) } : O };
  });
  out.settled = !!st;
  console.log(JSON.stringify(out));
  if (SHOT) await page.screenshot({ path: SHOT, timeout: 120000, fullPage: false });
  console.log('PAGE ERRORS:', errs.length ? errs.join('\n') : 'none');
  await browser.close();
})().catch(e => { console.error('ERROR', e); process.exit(2); });
