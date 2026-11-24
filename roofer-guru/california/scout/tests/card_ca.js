/* The card and the data behind it at a spread of California addresses: the 15-year outlook, "California's weather on
   record at this roof", parcel year and permits where published, the topography section (once), and the CSV export
   with every column filled. No engine: the map side only. node card_ca.js <page.html> <outdir> [first] [count] */
const L = require('./lib.js'), path = require('path'), fs = require('fs');
const FILE = process.argv[2], OUT = path.resolve(process.argv[3] || '.'), FIRST = +process.argv[4] || 0, COUNT = +process.argv[5] || 99;
const ADDR = ['1626 N Las Palmas Ave, Los Angeles, CA', '2500 Mission St, San Francisco, CA', '5700 Almond St, Paradise, CA', '1100 Lincoln Ave, San Jose, CA', '500 S Anaheim Blvd, Anaheim, CA', '600 4th St, Santa Rosa, CA', '400 E Main St, Stockton, CA', '1500 N Main St, Walnut Creek, CA', '2100 E Main St, Ventura, CA', '437 Old Mammoth Rd, Mammoth Lakes, CA', '1500 Orange Ave, Coronado, CA', '2300 J St, Sacramento, CA', '3900 Main St, Riverside, CA', '200 N Spring St, Los Angeles, CA',
  '300 S Palm Canyon Dr, Palm Springs, CA', '220 E Mountain View St, Barstow, CA', '1500 Market St, Redding, CA', '500 5th St, Eureka, CA', '1275 W Main St, El Centro, CA', '3150 Main St, Mammoth Lakes, CA', '1000 Orange Ave, Coronado, CA', '627 E Calaveras St, Altadena, CA'];
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const { page, errs, close, ctx } = await L.launch({ w: 1200, h: 900, hard: 28, ctx: { acceptDownloads: true } }); const wait = L.wait, C = L.checker(), rows = [];
  await L.openPage(page, FILE);
  for (const a of ADDR.slice(FIRST, FIRST + COUNT)) {
    const e0 = errs.length; let st = null; try { st = await L.find(page, a, 150000); } catch (e) { console.log('find failed', a, String(e).slice(0, 120)); }
    await wait(2500);
    const r = await page.evaluate(async () => {
      const api = MODI.rooftops.api, q = s => document.querySelector(s), dt = q('#scDetail'), txt = dt ? dt.innerText : '', bs = api.buildings(), name = q('#scName').textContent, sub = q('#scSub').textContent;
      const sec = re => { const m = re.exec(txt); return m ? m[0] : ''; };
      const topo = [...dt.querySelectorAll('.sc-topo-sec')].map(e => e.innerText.replace(/\s+/g, ' '));
      const heads = [...dt.querySelectorAll('h4, h5, .sc-sech, .sc-sec > b:first-child, summary')].map(e => e.textContent.trim().slice(0, 60));
      const st2 = api.status();
      return { name, sub, n: bs.length, tilesOk: st2.tiles.filter(t => t.st === 'ok').length, errors: st2.errors.slice(0, 4), cardLen: txt.length, heads: heads.slice(0, 40),
        outlook: sec(/The next 15 years[\s\S]{0,900}/i) || sec(/15[- ]year[\s\S]{0,700}/i), wx: sec(/California's weather on record at this roof[\s\S]{0,3200}/i), text: txt, year: sec(/(Built|Year built)[^\n]{0,200}/i), permits: sec(/[^\n]{0,80}permit[^\n]{0,220}/i), topoN: topo.length, topo: topo.map(t => t.slice(0, 900)), undef: (txt.match(/\bundefined\b|\bNaN\b|\[object Object\]|\bnull\b/g) || []).length,
        ybBy: bs.reduce((o, b) => { o[b.ybSrc || 'model'] = (o[b.ybSrc || 'model'] || 0) + 1; return o; }, {}), withPermits: bs.filter(b => b.permits.length).length };
    }).catch(e => ({ err: String(e).slice(0, 200) }));
    r.addr = a; r.pageErrs = errs.slice(e0); rows.push(r);
    C.ok(!r.err && r.n > 0 && !r.undef && r.topoN === 1 && (r.cardLen < 2500 || (/weather on record/i.test(r.wx) && r.outlook)) && !r.pageErrs.length, a, { name: r.name, n: r.n, card: r.cardLen, undef: r.undef, topoN: r.topoN, ybBy: r.ybBy, permits: r.withPermits, errors: r.errors, pageErrs: r.pageErrs.length });
    fs.writeFileSync(path.join(OUT, 'card_ca.json'), JSON.stringify(rows, null, 1));
  }
  /* the CSV of the last place: every column has a value in at least one row, and no row is short */
  try {
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click('#scCsv')]);
    const p = path.join(OUT, 'card_ca_last.csv'); await dl.saveAs(p); const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/), hi = lines.findIndex(l => /^"?status/.test(l));
    const parse = l => { const o = []; let c = '', q = false; for (let i = 0; i < l.length; i++) { const ch = l[i]; if (q) { if (ch === '"' && l[i + 1] === '"') { c += '"'; i++; } else if (ch === '"') q = false; else c += ch; } else if (ch === '"') q = true; else if (ch === ',') { o.push(c); c = ''; } else c += ch; } o.push(c); return o; };
    const H = parse(lines[hi]), data = lines.slice(hi + 1).filter(l => l.trim() && !/^#/.test(l)).map(parse).filter(r => r.length > 5), empty = H.filter((h, i) => !data.some(r => (r[i] || '').trim() !== '')), short = data.filter(r => r.length !== H.length).length;
    C.ok(hi >= 0 && data.length > 5 && !short, 'CSV: header and ' + data.length + ' rows of ' + H.length + ' columns', { file: await dl.suggestedFilename(), short, header: H.join(',').slice(0, 1500) });
    C.ok(empty.length === 0, 'CSV: every column filled in at least one row', { empty });
    const fill = H.map((h, i) => [h, data.filter(r => (r[i] || '').trim() !== '').length]).filter(x => x[1] < data.length * 0.5).map(x => x[0] + ' ' + x[1] + '/' + data.length); console.log('     columns filled in under half the rows:', fill.join('; '));
    console.log('     notes:', lines.slice(0, hi).join(' | ').slice(0, 1500)); console.log('     row 1:', lines[hi + 1].slice(0, 900));
    const bad = data.filter(r => r.some(v => /undefined|NaN|\[object/.test(v))).length; C.ok(!bad, 'CSV: no undefined or NaN in a cell', bad);
  } catch (e) { C.ok(false, 'CSV download', String(e).slice(0, 200)); }
  console.log('PAGE ERRORS:', errs.length ? errs.length + '\n' + [...new Set(errs)].slice(0, 8).join('\n') : 'none'); console.log(C.bad ? C.bad + ' FAILED' : 'all pass');
  await close(); process.exit(C.bad ? 1 : 0);
})().catch(e => { console.error('ERROR', e); process.exit(2); });
