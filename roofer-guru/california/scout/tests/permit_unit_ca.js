/* Rooftop Scout, California: how re-roof permits are read (the weight a permit's words carry, the covering they name, the
   squares they state, and the address key), on the wordings California's permit files use. Needs the page only, no
   network. node permit_unit_ca.js <page.html> */
const { chromium } = require('playwright');
const path = require('path');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ args: ['--disable-gpu'] });
  const page = await (await browser.newContext({ viewport: { width: 900, height: 700 } })).newPage();
  const errs = []; page.on('pageerror', e => errs.push('pageerror: ' + String((e && e.stack) || e).slice(0, 500)));
  await page.goto('file://' + path.resolve(process.argv[2]) + '#rooftops', { waitUntil: 'load', timeout: 180000 });
  for (let i = 0; i < 30; i++) { if (await page.evaluate(() => typeof MODI !== 'undefined' && !!(MODI.rooftops && MODI.rooftops.api))) break; await wait(1500); }
  const out = await page.evaluate(() => {
    const api = MODI.rooftops.api, fails = [], rows = [];
    /* [kind, text, least weight, most weight, covering key or '-', squares] */
    const C = [
      ['reroof', 'Re-roof with Class A or B roof covering material weighing less than 6 pounds per sq. ft. over existing solid sheathing ( 22 ) Squares', 0.9, 1, '!tile', 22],
      ['reroof', 'Re-roof with Class A or B roof covering material weighing less than 6 pounds per sq. ft. over new solid sheathing 13 Squares', 0.9, 1, '!tile', 13],
      ['reroof', 'Remove existing roof tiles, apply new underlayment and reset roof tiles (Cool roof compliance is not required)', 0.9, 1, 'tile*', 0],
      ['roofwork', 'Install 5.2 kW roof mounted solar photovoltaic system, 14 modules', 0, 0.15, '-', 0],
      ['roofwork', 'Roof mount residential solar 6.4 KW with main panel upgrade', 0, 0.15, '-', 0],
      ['reroof', 'reroofing- install class a modified bitumen roofing system 3800 sq ft. (hot work torch down).', 0.9, 1, 'flat', 0],
      ['reroof', 'reroofing', 0.9, 1, '-', 0],
      ['reroof', 'Tear Off - Yes, Resheet - No, 1 layer(s), 21 squares of 30yr Laminated Dimensional Composition', 0.9, 1, 'shingle', 21],
      ['reroof', 'Tear Off - Yes, Resheet - Yes, 2 layer(s), 45 squares of TPO Single Ply', 0.9, 1, 'flat', 45],
      ['reroof', 'Re-roof detached garage only', 0, 0.2, '-', 0],
      ['roofwork', 'Kitchen and bath remodel; replace 2 windows; patch roof at new vent', 0, 0.45, '-', 0],
      ['reroof', 'Partial reroof of rear section, 6 squares', 0.3, 0.5, '-', 6],
      ['roofwork', 'Remove wood shake roof and install composition shingles, 28 squares', 0.6, 1, 'shingle', 28],
      ['roofwork', 'Replace existing tile roof with standing seam metal roof', 0.6, 1, 'metal', 0],
      ['roofwork', 'Tear off existing built-up roof and install new cap sheet roofing, 30 squares', 0.6, 1, 'flat', 30],
      ['roofwork', 'Install rooftop HVAC unit on existing curb', 0, 0.15, '-', 0],
      ['roofwork', 'Roof repair: replace 10 broken tiles', 0.2, 0.5, '-', 0],
      ['roofwork', 'New patio cover with roofing at rear of single family dwelling', 0, 0.2, '-', 0],
      ['newc', 'New 2-story single family dwelling with attached garage', 1, 1, '-', 0],
    ];
    C.forEach(([kind, desc, lo, hi, cov, sq]) => { const w = api.permitW({ kind, desc, type: '' }), c = api.permitCover(desc), s = api.permitSquares(desc), ck = !c ? '-' : c.not ? '!' + c.not : c.k + (c.relay ? '*' : '');
      rows.push([+w.toFixed(2), ck, s, desc.slice(0, 60)]); if (!(w >= lo - 1e-9 && w <= hi + 1e-9)) fails.push(`weight ${w.toFixed(2)} outside ${lo} to ${hi}: ${desc}`); if (kind !== 'newc' && ck !== cov) fails.push(`covering ${ck}, expected ${cov}: ${desc}`); if (s !== sq) fails.push(`squares ${s}, expected ${sq}: ${desc}`); });
    /* addresses: one key for the same place written five ways */
    const K = [['200 N SPRING ST', '200|SPRING'], ['200 North Spring Street, Los Angeles, CA 90012', '200|SPRING'], ['627 E CALAVERAS ST, ALTADENA, CA 91001', '627|CALAVERAS'], ['1234 1/2 W 5TH ST', '1234|5TH'], ['2824-26 Mission St', '2824|MISSION'], ['1030 Larkin St Apt B', '1030|LARKIN'], ['5718 ALMOND ST PARADISE CA 95969', null], ['123 Via De La Valle', '123|VIA DE LA VALLE'], ['4500 El Camino Real #210', '4500|EL CAMINO REAL']];
    K.forEach(([a, k]) => { const g = api.addrParts(a).key; if (k && g !== k) fails.push(`address key ${g}, expected ${k}: ${a}`); });
    const p = api.addrParts('5718 ALMOND ST PARADISE CA 95969', 'Paradise').key; if (p !== '5718|ALMOND') fails.push('address with the city named: ' + p);
    return { rows, fails };
  });
  out.rows.forEach(r => console.log(r.join(' | ')));
  console.log(out.fails.length ? 'FAIL ' + out.fails.length + '\n' + out.fails.join('\n') : 'PASS', '· PAGE ERRORS:', errs.length ? errs.join('\n') : 'none');
  await browser.close();
})().catch(e => { console.error('ERROR', e); process.exit(2); });
