/* The method, caveats and sources as the page renders them: the sentences whose numbers the page computes. node docs_check.js <atlas.html> */
const { chromium } = require('playwright'), path = require('path');
(async () => {
  const browser = await chromium.launch(); const page = await browser.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(String(e && e.stack || e).slice(0, 400)));
  await page.route(/^https?:/, r => r.abort());
  await page.goto('file://' + path.resolve(process.argv[2]) + '#rooftops', { waitUntil: 'load', timeout: 180000 }); await page.waitForTimeout(1500);
  const out = await page.evaluate(() => {
    const L = [], meth = [...document.querySelectorAll('#scMeth li')].map(li => li.textContent), pick = (re, n) => { const t = meth.find(x => re.test(x)) || ''; return t; };
    const o = pick(/^The next 15 years/), grab = (t, re) => { const m = t.match(re); return m ? m[0] : 'NOT FOUND: ' + re; };
    L.push('entries: ' + meth.map(x => x.slice(0, 34)).join(' | '));
    [/scaled by how FEMA's counts[^.]*\./, /A ZIP's own record counts[^.]*\./, /Statewide the first[^;]*;/, /about three more for each one[^(]*/, /a shingle roof under four years old takes[^,]*,/, /over roofs past five years old the model gives[^(]*/, /membranes and metal buildings take wind[^.]*\./, /the days a year with wind[^.]*\./, /the days with hail[^(]*\([^)]*\)/].forEach(re => L.push('  ' + grab(o, re)));
    const th = pick(/^Roof view: Thermal/); L.push('thermal: ' + th.length + ' chars; ' + grab(th, /It gives heat back[^,]*,[^,]*,/));
    L.push('caveats: ' + [...document.querySelectorAll('#scCav tr')].slice(-5).map(tr => tr.textContent.slice(0, 60)).join(' | '));
    L.push('sources: ' + [...document.querySelectorAll('#scSrc tr')].slice(-8).map(tr => tr.textContent.slice(0, 40)).join(' | '));
    L.push('grades in headings: ' + [...document.querySelectorAll('#scMeth li b')].map(b => b.textContent.replace(/\s+/g, ' ').trim()).slice(-7).join(' | '));
    return L.join('\n');
  });
  console.log(out); console.log('PAGE ERRORS:', errs.length ? errs.join('\n') : 'none');
  await browser.close();
})().catch(e => { console.error('ERROR', e); process.exit(2); });
