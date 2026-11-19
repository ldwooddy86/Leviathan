/* The roof views' readings without the engine: real buildings from the map (network), each read by the three views at three
   years with a hip roof's planes; every corner reading finite and within range, every legend and label free of NaN and
   undefined; the card's outlook for each. node lens_unit.js <atlas.html> [lat lon] */
const { chromium } = require('playwright'), path = require('path');
(async () => {
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined, browser = await chromium.launch({ proxy });
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage(); const errs = [];
  page.on('pageerror', e => errs.push(String(e && e.stack || e).slice(0, 500)));
  await page.goto('file://' + path.resolve(process.argv[2]) + '#rooftops', { waitUntil: 'load', timeout: 180000 }); await page.waitForTimeout(1500);
  const la = +(process.argv[3] || 30.3859), lo = +(process.argv[4] || -91.1431);
  await page.evaluate(([a, b]) => MODI.rooftops.api.goTo(a, b, 18), [la, lo]);
  for (let i = 0; i < 30; i++) { await page.waitForTimeout(2000); const n = await page.evaluate(() => MODI.rooftops.api.buildings().filter(b => b.sc).length); if (n > 150 && i > 4) break; }
  const out = await page.evaluate(() => {
    const A = MODI.rooftops.api, L = A.lens, bs = A.buildings().filter(b => b.sc), bad = [], t0 = performance.now(); let n = 0, withRoof = 0; const kinds = {};
    const s = Math.SQRT1_2, hip = [{ n: [0, s, -s], area: 40 }, { n: [0, s, s], area: 40 }, { n: [s, s, 0], area: 25 }, { n: [-s, s, 0], area: 25 }], flat = [{ n: [0, 1, 0], area: 300 }];
    const zones = [{ edge: 0, corner: 0, ridge: 0 }, { edge: 1, corner: 0, ridge: 0 }, { edge: 1, corner: 1, ridge: 0 }, { edge: 0, corner: 0, ridge: 1 }], chk = (c, m) => { if (!c && bad.length < 25) bad.push(m); };
    const sunUp = { alt: 50, dir: [-0.6, 0.766, 0.23] }, ctxs = { thermal: [{ sun: sunUp, weather: 'clear', month: 6, hour: 15, sunAlt: 50, lum: 0.4 }, { sun: { alt: -20, dir: [0.5, -0.34, 0.8] }, weather: 'rain', month: 0, hour: 2, sunAlt: -20 }], wear: [{ lum: 0.2, canopy: 0.4 }, {}], time: [{ year: 0 }, { year: 7, lum: 0.7 }, { year: 15, canopy: 1 }, { year: 99 }] };
    bs.forEach(b => { const has = !!(b.roof && b.roof.keys && b.roof.keys.length); if (has) withRoof++; kinds[b.cls] = (kinds[b.cls] || 0) + 1;
      ['thermal', 'wear', 'time'].forEach(lens => ctxs[lens].forEach(ctx => { let R = null; try { R = L.begin(lens, b, Object.assign({ dayLabel: 'July 21', weatherLabel: 'clear sky' }, ctx)); if (R) { R.setPlanes(b.roof && b.roof.slope === 'low' ? flat : hip); R = L.ready(R); } } catch (e) { chk(false, `${lens} ${b.cls} "${b.addr || ''}" throws: ${e.message}`); return; }
        if (!has) { chk(!R || !R.vertex, `${lens}: a building without a roof was read`); return; } if (!R || !R.vertex) { chk(lens !== 'thermal' && !(b.mix && b.mix.length), `${lens} ${b.cls} "${b.addr || ''}": no reading (mix ${b.mix ? b.mix.length : 'none'})`); return; } n++;
        (b.roof.slope === 'low' ? flat : hip).forEach(p => zones.forEach(z => [0, 0.8, 1].forEach(sh => [0, 1].forEach(u => { let v; try { v = R.vertex(p.n, z, sh, u); } catch (e) { chk(false, `${lens} vertex throws: ${e.message}`); return; } chk(Array.isArray(v) && v.length === 4 && v.every(Number.isFinite) && v[0] >= 0 && v[0] <= 1 && v[1] >= 0 && v[1] <= 1, `${lens} ${b.cls} vertex ${JSON.stringify(v)}`); }))));
        let leg = '', lab = ''; try { leg = L.legend(lens, R, Object.assign({ dayLabel: 'July 21', weatherLabel: 'clear sky' }, ctx)); lab = L.label(lens, R); } catch (e) { chk(false, `${lens} legend throws: ${e.message}`); return; }
        chk(leg && !/NaN|undefined|Infinity|null/.test(leg.replace(/<[^>]+>/g, ' ')), `${lens} ${b.cls} legend: ${leg.replace(/<[^>]+>/g, ' ').match(/.{0,60}(NaN|undefined|Infinity|null).{0,60}/)}`); chk(lab && !/NaN|undefined/.test(lab), `${lens} ${b.cls} label "${lab}"`); }));
      if (has) { let O = null; try { O = A.outlook(b, {}); } catch (e) { chk(false, `outlook throws for ${b.cls}: ${e.message}`); } if (O) { chk(Math.abs(O.all.rep[15] + O.all.keep[15] - 1) < 1e-9 && O.all.any[15] >= O.all.rep[15] - 1e-9 && O.all.any[15] <= 1 + 1e-9, `outlook ${b.cls}: ${O.all.any[15]} ${O.all.rep[15]} ${O.all.keep[15]}`); [0, 3, 12, 40].forEach(k => { const p = O.older(k); chk(p >= 0 && p <= 1, `older(${k}) = ${p}`); }); chk(O.older(0) >= O.older(12) - 1e-9, 'older not falling'); } else chk(!(b.mix && b.mix.length && b.zip), `no outlook for ${b.cls} "${b.addr || ''}" with a mix`); } });
    const samp = bs.filter(b => b.roof && b.roof.keys && b.roof.keys.length).slice(0, 3).map(b => { const R = L.ready(L.begin('wear', b, {}).setPlanes(hip)); return `${b.cls} age ${b.state.age.toFixed(1)}: ${L.label('wear', R)}; ${L.legend('wear', R, {}).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').match(/About.{0,330}/)}`; });
    return { buildings: bs.length, withRoof, readings: n, kinds, bad, ms: Math.round(performance.now() - t0), samp };
  });
  console.log(`buildings ${out.buildings} (with a roof ${out.withRoof}), readings ${out.readings} in ${out.ms} ms, kinds ${JSON.stringify(out.kinds)}; failures: ${out.bad.length}`); out.bad.forEach(b => console.log('  ' + String(b).slice(0, 320))); out.samp.forEach(x => console.log('  e.g. ' + x.slice(0, 520)));
  console.log('PAGE ERRORS:', errs.length ? errs.join('\n') : 'none'); await browser.close(); process.exit(out.bad.length || errs.length ? 1 : 0);
})().catch(e => { console.error('ERROR', e); process.exit(2); });
