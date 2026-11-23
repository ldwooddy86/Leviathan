const { chromium } = require('playwright'); const path = require('path');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 1300, height: 900 } }); await ctx.route(/^https?:\/\//, r => r.abort());
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + path.resolve(process.argv[2]) + '#storms', { waitUntil: 'load', timeout: 240000 }); await wait(3500);
  const shot = async (sel, name) => { const el = await p.$(sel); await el.scrollIntoViewIfNeeded(); await wait(500); await el.screenshot({ path: path.join(__dirname, 'out', name), timeout: 120000 }); };
  await shot('#mod-storms .grid2', 'map_state.png');
  await p.fill('#s2Zip', '91001'); await p.click('#s2ZipGo'); await wait(1500); await shot('#mod-storms .grid2', 'map_zip.png');
  await p.evaluate(() => goModule('weather')); await wait(2500); await shot('#mod-weather .grid2', 'wx_map.png');
  await p.evaluate(() => goModule('regions')); await wait(2500); await shot('#mod-regions .grid2', 'reg_map.png');
  console.log('errors', errs.length, errs.join('\n')); await b.close();
})();
