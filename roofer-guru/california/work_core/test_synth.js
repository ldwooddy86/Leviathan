const { chromium } = require('playwright'); const path = require('path');
const FILE = path.resolve(process.argv[2]); const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 860 } })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e && e.stack || e).slice(0, 500)));
  await page.goto('file://' + FILE + '#lines', { waitUntil: 'load', timeout: 240000 }); await wait(3000);
  console.log(await page.evaluate(() => JSON.stringify({ sea: SLM.SEA, g: SLM.SEA_G, nc: SLM.SEA_R[1].repair, sd: SLM.SEA_R[11].repair, wet: HZ.wetShare(HZ.rain), hours: !!HZ.hour.all })));
  console.log('SEA note:', await page.evaluate(() => document.querySelector('#l12Sea .chartnote').innerText.slice(0, 700)));
  console.log('DAY note:', await page.evaluate(() => document.querySelector('#l12Day').innerText.slice(-600)));
  await page.evaluate(() => { const s = document.getElementById('l12Reg'); s.value = '1'; s.onchange({ target: s }); }); await wait(1500);
  console.log('North Coast kpi+note:', await page.evaluate(() => document.querySelector('#l12Kpis').innerText.replace(/\n/g, ' ').slice(-200) + ' || ' + document.querySelector('#l12Sea .chartnote').innerText.slice(0, 160)));
  await page.evaluate(() => showModule('drivers')); await wait(3000);
  console.log('M04 month:', await page.evaluate(() => document.getElementById('d4MonN').innerText.slice(0, 500)), '\nM04 hour:', await page.evaluate(() => document.getElementById('d4HourN').innerText.slice(0, 300)), '\nM04 coef:', await page.evaluate(() => document.getElementById('d4CoefN').innerText.slice(0, 600)));
  await page.locator('#mod-drivers .kpis').screenshot({ path: 'out/m04-kpis.png' }).catch(() => {});
  console.log('ERRORS:', errs.length ? errs.join('\n') : 'none'); await browser.close();
})();
