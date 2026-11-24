/* California port of tests/smoke.js (CA/scout/tests/la_port/port_suites.py) */
/* Smoke test for California's Rooftop Scout: mount, load buildings at three places, join permits and parcels, screenshot.
   node smoke.js <atlas.html> <outdir> */
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const FILE = path.resolve(process.argv[2]), OUT = path.resolve(process.argv[3] || '.');
fs.mkdirSync(OUT, { recursive: true });
const PLACES = [
  { name: 'los-angeles-hollywood', lat: 34.1008, lon: -118.3362, z: 18 },
  { name: 'san-francisco-mission', lat: 37.7570, lon: -122.4187, z: 18 },
  { name: 'sacramento-midtown', lat: 38.5763, lon: -121.4767, z: 18 },
];
const __hard = setTimeout(() => { console.log('HARD TIMEOUT'); process.exit(3); }, (+process.env.HARD || 14) * 60000);
(async () => {
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
  const browser = await chromium.launch({ proxy, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errs = [], logs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + (e && e.stack || e)));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text().slice(0, 300)); });
  page.on('requestfailed', r => { const u = r.url(); if (!/tile|arcgisonline|googleapis/.test(u)) logs.push('requestfailed: ' + u.slice(0, 160) + ' ' + (r.failure() && r.failure().errorText)); });
  await page.goto('file://' + FILE + '#rooftops', { waitUntil: 'load', timeout: 240000 });
  await page.waitForTimeout(4000);
  const rail = await page.evaluate(() => [...document.querySelectorAll('#rail button')].map(b => b.querySelector('.n').textContent + ' ' + b.querySelector('.t').textContent));
  console.log('rail:', rail.length, rail.slice(-3).join(' | '));
  const mounted = await page.evaluate(() => !!(MODI.rooftops && MODI.rooftops.mounted && MODI.rooftops.api));
  console.log('mounted:', mounted);
  await page.screenshot({ path: path.join(OUT, '00-state.png') });
  for (const P of PLACES) {
    await page.evaluate(p => MODI.rooftops.api.goTo(p.lat, p.lon, p.z), P);
    const t0 = Date.now(); let st = null;
    while (Date.now() - t0 < 150000) {
      await page.waitForTimeout(2500);
      st = await page.evaluate(() => MODI.rooftops.api.status());
      const busy = st.queued + st.running, loading = st.tiles.filter(t => t.st === 'load' || t.st === 'queued').length;
      if (!busy && !loading && st.tiles.some(t => t.st === 'ok' || t.st === 'err')) break;
    }
    await page.waitForTimeout(1500);
    const sum = await page.evaluate(() => {
      const bs = MODI.rooftops.api.buildings(), m = MODI.rooftops.api.map(), bd = m.getBounds();
      const v = bs.filter(b => bd.contains([b.lat, b.lon]));
      const cnt = { g: 0, o: 0, r: 0 }; v.forEach(b => cnt[b.status]++);
      const cls = {}; v.forEach(b => cls[b.cls] = (cls[b.cls] || 0) + 1);
      const perm = v.filter(b => b.permits.length), reroof = v.filter(b => b.permits.some(p => p.kind === 'reroof')), yb = v.filter(b => b.ybSrc);
      const sc = v.map(b => b.sc.score).sort((a, b) => a - b), q = f => sc.length ? sc[Math.floor(f * (sc.length - 1))] : null;
      const ex = v.slice().sort((a, b) => b.sc.score - a.sc.score).slice(0, 3).map(b => ({ addr: b.addr, cls: b.cls, score: b.sc.score, st: b.status, need: b.need.l, age: +b.state.age.toFixed(1), p5: +b.sc.P5.toFixed(3), rep: +b.sc.REP.toFixed(3), wind: +(b.sc.WIND || 0).toFixed(3), hail: +(b.sc.HAIL || 0).toFixed(3), fire: b.sc.FIRE != null ? +(+b.sc.FIRE).toFixed(3) : undefined, fhsz: b.fhsz ? b.fhsz.l : '', yb: b.yb, ybSrc: b.ybSrc, ybMid: b.ybMid, resets: (b.state.storms || b.state.resets || []).length, lines: b.lines.join(','), permits: b.permits.slice(0, 2).map(p => p.kind + ' ' + p.d + ' w' + p.w + ' ' + p.desc.slice(0, 40)) }));
      const lo = v.slice().sort((a, b) => a.sc.score - b.sc.score).slice(0, 2).map(b => ({ addr: b.addr, cls: b.cls, score: b.sc.score, need: b.need.l, age: +b.state.age.toFixed(1), yb: b.yb, ybMid: b.ybMid, permits: b.permits.slice(0, 2).map(p => p.kind + ' ' + p.d + ' w' + p.w) }));
      return { inView: v.length, cnt, cls, withPermits: perm.length, withReroof: reroof.length, withYb: yb.length, ybSrc: [...new Set(yb.map(b => b.ybSrc))], quantiles: [q(0.1), q(0.25), q(0.5), q(0.75), q(0.9)], top: ex, bottom: lo, errors: MODI.rooftops.api.status().errors };
    });
    console.log('\n== ' + P.name, JSON.stringify(sum, null, 1).slice(0, 4000));
    // select the top building to render its card
    await page.evaluate(() => { const bs = MODI.rooftops.api.buildings(), m = MODI.rooftops.api.map(), bd = m.getBounds(); const v = bs.filter(b => bd.contains([b.lat, b.lon])).sort((a, b) => b.sc.score - a.sc.score); if (v[0]) MODI.rooftops.api.pick(v[0].id); });
    await page.waitForTimeout(2500);
    await page.locator('.sc-grid').screenshot({ path: path.join(OUT, P.name + '.png'), timeout: 60000 }).catch(e => console.log('shot failed', e.message.split('\n')[0]));
    const card = await page.evaluate(() => document.querySelector('#scDetail') && document.querySelector('#scDetail').innerText.slice(0, 2500));
    console.log('-- card:\n' + card);
  }
  console.log('\nPAGE ERRORS:', errs.length ? errs.join('\n') : 'none');
  console.log('CONSOLE errors/warnings:', logs.length ? logs.slice(0, 30).join('\n') : 'none');
  await browser.close(); clearTimeout(__hard);
})().catch(e => { console.error('TEST FAILED', e); process.exit(1); });
