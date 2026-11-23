const { chromium } = require('playwright'); const path = require('path');
(async () => { const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await p.goto('file://' + path.resolve(process.argv[2]) + '#ground', { waitUntil: 'load', timeout: 180000 }); await p.waitForTimeout(2500);
  await p.screenshot({ path: 'shot_ground.png', clip: { x: 0, y: 0, width: 1280, height: 900 } });
  await p.evaluate(() => { showModule('desk'); document.querySelector('#dkLangs').scrollIntoView({ block: 'center' }); }); await p.waitForTimeout(1500);
  await p.screenshot({ path: 'shot_desk.png' }); await b.close(); })();
