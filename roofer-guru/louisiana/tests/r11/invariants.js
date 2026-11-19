/* The outlook's own rules, over every ZIP with roofs, every kind of roof, several ages, both records and three heats:
   every chance within 0 and 1 and never falling from year to year; replaced is one minus today's roof still on; a roofer
   needed is at least replaced and at least every cause; a cause is at least its replacements and its repairs; no NaN.
   node invariants.js <atlas.html> */
const { chromium } = require('playwright'), path = require('path');
(async () => {
  const browser = await chromium.launch(); const page = await browser.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(String(e && e.stack || e).slice(0, 400)));
  await page.route(/^https?:/, r => r.abort());
  await page.goto('file://' + path.resolve(process.argv[2]) + '#rooftops', { waitUntil: 'load', timeout: 180000 }); await page.waitForTimeout(1200);
  const out = await page.evaluate(() => {
    const A = MODI.rooftops.api, bad = [], T = ['shingle', 'metal', 'tile', 'mh', 'low', 'lowmf', 'mbldg'], C = ['hur', 'ts', 'hail', 'wear', 'leak'], eps = 1e-9; let n = 0, worst = 0;
    const zips = Z.filter(z => z.roofs > 0).map(z => z.zip).concat(['00000', '']), t0 = performance.now();
    const chk = (cond, msg) => { if (!cond && bad.length < 25) bad.push(msg); };
    zips.forEach((zip, zi) => { T.forEach(type => { [0, 3, 9, 16, 28, 45, 60].forEach((age, ai) => { if ((zi + ai) % 3 && zip) return; ['mid', 'recent', 'long'].forEach(rec => { [0.5, 1, 1.6].forEach(heat => { if (heat !== 1 && (zi % 7 || rec !== 'mid')) return;
      let o; try { o = A.outlookType(type, zip, age, { rec, heat, st: 1 + zi % 3 }); } catch (e) { chk(false, `throws ${type} ${zip} ${age}: ${e.message}`); return; } n++; const tag = `${type} ${zip} age ${age} ${rec} heat ${heat}`;
      for (let t = 0; t <= 15; t++) { const all = [o.rep[t], o.any[t], o.keep[t], o.alg[t]].concat(C.flatMap(c => [o.C[c][t], o.R[c][t], o.F[c][t]])).concat(o.rust.map(r => r[t]));
        chk(all.every(v => Number.isFinite(v) && v >= -eps && v <= 1 + eps), `${tag} t ${t}: out of range ${all.map(v => +v.toFixed(4)).join(',')}`);
        chk(Math.abs(o.rep[t] + o.keep[t] - 1) < 1e-9, `${tag} t ${t}: replaced ${o.rep[t]} + still on ${o.keep[t]}`);
        chk(o.any[t] >= o.rep[t] - eps, `${tag} t ${t}: any ${o.any[t]} < rep ${o.rep[t]}`);
        C.forEach(c => { chk(o.any[t] >= o.C[c][t] - eps, `${tag} t ${t}: any < ${c}`); chk(o.C[c][t] >= Math.max(o.R[c][t], o.F[c][t]) - eps, `${tag} t ${t}: ${c} ${o.C[c][t]} < its parts ${o.R[c][t]}, ${o.F[c][t]}`); chk(o.rep[t] >= o.R[c][t] - eps, `${tag} t ${t}: rep < R.${c}`);
          if (t) { chk(o.C[c][t] >= o.C[c][t - 1] - eps && o.R[c][t] >= o.R[c][t - 1] - eps && o.F[c][t] >= o.F[c][t - 1] - eps, `${tag} t ${t}: ${c} falls`); } });
        if (t) chk(o.any[t] >= o.any[t - 1] - eps && o.rep[t] >= o.rep[t - 1] - eps, `${tag} t ${t}: any or rep falls`);
        /* the union of the causes' replacements is every replacement, so their sum is at least it */
        const sumR = C.reduce((s, c) => s + o.R[c][t], 0); chk(sumR >= o.rep[t] - 1e-6, `${tag} t ${t}: causes' replacements ${sumR} < replaced ${o.rep[t]}`); worst = Math.max(worst, o.rep[t] - sumR);
        chk(Number.isFinite(o.age[t]) && o.age[t] >= 0 && o.age[t] < 140, `${tag} t ${t}: age ${o.age[t]}`); }
      chk(o.rep[0] === 0 && o.any[0] === 0 && o.keep[0] === 1, `${tag}: year 0 not clean`); }); }); }); }); });
    /* hazards and the record */
    Z.forEach(z => { if (!(z.roofs > 0)) return; const h = A.hazardAt(z.zip); ['long', 'recent', 'mid'].forEach(r => chk(Number.isFinite(h[r].rep) && h[r].rep >= 0 && h[r].rep < 0.5 && Number.isFinite(h[r].fix) && h[r].fix >= 0 && h[r].fix < 0.5, `hazard ${z.zip} ${r} ${JSON.stringify(h[r])}`)); A.yearsOf(z.zip).forEach(e => chk(e.d >= 0 && e.d <= 0.95 && e.y >= 1990 && e.y <= 2025, `year ${z.zip} ${JSON.stringify(e)}`)); });
    [0.0004, 0.01, 0.3, 0.95, 1.2].forEach(d => [0, 2.5, 40, 80].forEach(a => [0, 0.6, 1, 'hard'].forEach(k => { const s = A.stormOn(d, a, k); chk(s.every(v => Number.isFinite(v) && v >= 0 && v <= 1) && s[0] + s[1] <= 1 + 1e-9, `stormOn ${d} ${a} ${k}: ${s}`); })));
    return { n, zips: zips.length, bad, ms: Math.round(performance.now() - t0), worst };
  });
  console.log(`outlooks checked: ${out.n} over ${out.zips} ZIPs in ${out.ms} ms; failures: ${out.bad.length}`); out.bad.forEach(b => console.log('  ' + b.slice(0, 300)));
  console.log('PAGE ERRORS:', errs.length ? errs.join('\n') : 'none'); await browser.close(); process.exit(out.bad.length || errs.length ? 1 : 0);
})().catch(e => { console.error('ERROR', e); process.exit(2); });
