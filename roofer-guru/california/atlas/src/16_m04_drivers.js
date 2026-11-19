/* ==== 16_m04_drivers.js ==== */
/* ==== m04 Demand Drivers ==== */
"use strict";
/* ============================ small statistics kit: weighted OLS, t tests, Shapley R² ============================ */
const STATS = (() => {
  function solve(A, b) { const n = A.length; const M = A.map((r, i) => r.concat([b[i]])); for (let c = 0; c < n; c++) { let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r; if (Math.abs(M[p][c]) < 1e-12) return null; [M[c], M[p]] = [M[p], M[c]]; for (let r = 0; r < n; r++) { if (r === c) continue; const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; } } return M.map((r, i) => r[n] / r[i]); }
  function inv(A) { const n = A.length; const out = []; for (let j = 0; j < n; j++) { const e = Array(n).fill(0); e[j] = 1; const c = solve(A, e); if (!c) return null; out.push(c); } return A.map((_, i) => out.map(c => c[i])); }
  function betacf(a, b, x) { const MAXIT = 200, EPS = 3e-12, FPMIN = 1e-300; let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap; if (Math.abs(d) < FPMIN) d = FPMIN; d = 1 / d; let h = d; for (let m = 1; m <= MAXIT; m++) { const m2 = 2 * m; let aa = m * (b - m) * x / ((qam + m2) * (a + m2)); d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN; d = 1 / d; h *= d * c; aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2)); d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < EPS) break; } return h; }
  function lgamma(x) { const g = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5]; let y = x, t = x + 5.5; t -= (x + 0.5) * Math.log(t); let s = 1.000000000190015; for (const c of g) s += c / ++y; return -t + Math.log(2.5066282746310005 * s / x); }
  function ibeta(a, b, x) { if (x <= 0) return 0; if (x >= 1) return 1; const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x)); return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b; }
  const pT = (t, df) => ibeta(df / 2, 0.5, df / (df + t * t));            // two sided p
  const tCrit = df => { let lo = 1, hi = 4; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (pT(m, df) > 0.05) lo = m; else hi = m; } return (lo + hi) / 2; };
  /* weighted least squares on standardized variables: y and X columns standardized with the weights */
  function zstd(v, w) { const sw = sum(w); const m = sum(v.map((x, i) => x * w[i])) / sw; const sd = Math.sqrt(sum(v.map((x, i) => w[i] * (x - m) ** 2)) / sw); return v.map(x => (x - m) / (sd || 1)); }
  function wls(y, X, w) {
    const n = y.length, k = X[0].length + 1; const Xa = X.map(r => [1].concat(r)); const W = w.map(x => x / mean(w));
    const XtX = Array.from({ length: k }, (_, i) => Array.from({ length: k }, (_, j) => sum(Xa.map((r, t) => W[t] * r[i] * r[j]))));
    const Xty = Array.from({ length: k }, (_, i) => sum(Xa.map((r, t) => W[t] * r[i] * y[t])));
    const b = solve(XtX, Xty); if (!b) return null;
    const res = y.map((v, t) => v - sum(Xa[t].map((x, i) => x * b[i]))); const ybar = sum(y.map((v, t) => W[t] * v)) / sum(W);
    const sse = sum(res.map((e, t) => W[t] * e * e)), sst = sum(y.map((v, t) => W[t] * (v - ybar) ** 2)); const df = n - k; const s2 = sse / df;
    const Vi = inv(XtX); const se = Vi ? Vi.map((r, i) => Math.sqrt(Math.max(0, r[i] * s2))) : b.map(() => NaN);
    return { b, se, df, r2: 1 - sse / sst, adj: 1 - (sse / df) / (sst / (n - 1)), n };
  }
  function shapley(y, X, w) {
    const p = X[0].length; const memo = {}; const r2 = mask => { if (memo[mask] != null) return memo[mask]; const cols = []; for (let j = 0; j < p; j++) if (mask & (1 << j)) cols.push(j); const v = cols.length ? (wls(y, X.map(r => cols.map(j => r[j])), w) || { r2: 0 }).r2 : 0; memo[mask] = v; return v; };
    const fact = n => n <= 1 ? 1 : n * fact(n - 1); const out = Array(p).fill(0);
    for (let mask = 0; mask < (1 << p); mask++) { const sz = mask.toString(2).split('').filter(c => c === '1').length; for (let j = 0; j < p; j++) { if (mask & (1 << j)) continue; out[j] += fact(sz) * fact(p - sz - 1) / fact(p) * (r2(mask | (1 << j)) - r2(mask)); } }
    return out;
  }
  return { wls, zstd, pT, tCrit, shapley };
})();
/* ten year projection of age driven replacements from the 2026 roof age distribution, with no new storms */
function ageProjection(hist, years, newPerYear) {
  const WB = META.model.WB; const lam = WB.L / gammaFn(1 + 1 / WB.k); const S = t => Math.exp(-Math.pow(Math.max(0, t) / lam, WB.k)); const H = t => 1 - S(t + 1) / S(t);
  let d = hist.slice(); const out = [];
  for (let y = 0; y <= years; y++) { const rep = d.reduce((s, v, a) => s + v * H(a), 0); out.push(rep); const nd = Array(d.length).fill(0); for (let a = 0; a < d.length - 1; a++) nd[a + 1] += d[a] * (1 - H(a)); nd[d.length - 1] += d[d.length - 1] * (1 - H(d.length - 1)); nd[0] = rep + (newPerYear || 0); d = nd; }
  return out;
}
/* ============================ Module 4: Demand Drivers ============================ */
registerModule({
  key: 'drivers', num: '04', title: 'Demand Drivers', desc: 'What drives roofing demand in Louisiana: hurricanes against hail, income and insurance, roof age, the seasons and the clock',
  mount(root) {
    const st = { y: 'fema' };
    const ZD = ZR.filter(z => isN(z.inc) && z.inc > 0 && isN(z.sqmi) && z.sqmi > 0 && isN(z.hur64) && isN(z.hd1));
    const PRED = [
      ['hur', 'Chance of hurricane force winds in a year (%)', z => z.hur64],
      ['hail', 'Hail days a year, 1 inch or larger', z => z.hd1],
      ['old', 'Homes built before 1980 (%)', z => z.pre80_sh],
      ['mh', 'Mobile homes (% of homes)', z => z.mh_sh],
      ['inc', 'Median household income (log)', z => Math.log10(z.inc)],
      ['own', 'Owner occupied homes (%)', z => z.own_sh],
      ['dens', 'Residents per square mile (log)', z => Math.log10(Math.max(1, z.pop) / z.sqmi)],
      ['age20', 'Roofs 20 years or older (%, model)', z => z.ra20_sh],
    ];
    const OUT = {
      fema: { l: 'FEMA roof and wind registrations per 100 homes, 2004 to 2026', s: 'Storm damage', f: z => z.fema_rate, log: true },
      lic: { l: 'Roofing license records per 10,000 residents (LSLBC)', s: 'Roofers', f: z => (z.lic || 0) / Math.max(1, z.pop) * 1e4, log: true },
      hailrep: { l: 'Hail reports of 1 inch or larger per 100 square miles, 2016 to 2026', s: 'Hail reports', f: z => (z.ev_h1 || 0) / z.sqmi * 100, log: true },
    };
    const pools = META.pools; const poolTot = sum(Object.values(pools)); const casesTot = sum(Object.values(META.cases));
    const proj = ageProjection(DATA.ts.agehist, 10, mean(Object.keys(DATA.ts.permits).map(Number).filter(y => y >= 2021).map(y => DATA.ts.permits[y][0])));
    const licLA = META.lic.inla || 0;
    root.innerHTML = mastHTML({ eyebrow: `Module 04 · Demand Drivers · ${N(ZD.length)} ZIPs, thirty years of storms`, title: 'Demand Drivers',
      dek: 'Why one ZIP files FEMA roof claims after every hurricane and another two hours north never does, why hail and hurricanes are different businesses, why roofers cluster in cities while roofs fail in the country, and when in the year and the day the work arrives. This module tests the obvious explanations against observed outcomes with a weighted regression across ZIPs, projects the age engine ten years out, reads the seasons and the clock from thirty years of storm reports, and records every problem found in the public data and how it was handled.',
      meta: [`<b>Units</b> ${N(ZD.length)} ZIPs with 500 or more residents, weighted by homes`, '<b>Outcomes</b> FEMA registrations, LSLBC license records, NOAA hail reports', '<b>Clock</b> SPC reports 1996 to 2025', '<b>Method</b> standardized WLS, Shapley R²'],
      bar: 'Demand Drivers', barsub: 'What predicts roofing demand',
      actions: [{ id: 'd4Csv', label: '↓ ZIP predictors CSV' }, { id: 'd4Ts', label: '↓ Seasons and hours CSV' }] }) +
      `<div class="wrap">
      ${callout('', 'Read this first: four findings that should change a media plan', '<b>1. Hurricanes and hail are two markets at opposite ends of the state.</b> FEMA roof and wind registrations rise with hurricane exposure and fall with hail days, because hail belongs to north Louisiana and rarely brings a federal declaration, while hurricanes belong to the south and usually do. A statewide roofer runs a hurricane business and a hail business, with different seasons, offers and crews. <b>2. Income decides who pays.</b> At the same hurricane exposure, lower income ZIPs file more FEMA roof registrations, a sign that more of their damage falls outside insurance. Those owners need repair first offers, financing and grant information; insured owners in higher income ZIPs carry the claim funded replacements. <b>3. Roofers live where people live.</b> License records follow population density, not storm exposure, so the rural parishes that take the hurricanes have the fewest local roofers, which is the opening for a regional company and for storm chasers. <b>4. Demand runs on two clocks.</b> Storms come in spring (hail and squall lines) and late summer (tropical), and every big storm schedules a replacement wave about twenty years later.')}
      <div class="kpis" id="d4Kpis"></div>
      <div class="split">
        ${card('What predicts the outcome', 'Standardized coefficients from a weighted regression across ZIPs (weights = homes; outcome logged). Bars are 95% intervals; filled dots are significant at 5%. Shapley R² splits the explained variance among predictors.', `<div class="seg" id="d4Y" style="margin-bottom:10px">${Object.entries(OUT).map(([k, o], i) => `<button data-v="${k}" aria-pressed="${i === 0}">${esc(o.s)}</button>`).join('')}</div><div id="d4Coef"></div><p class="chartnote" id="d4CoefN"></p>`)}
        ${card('How the predictors relate to each other', 'Pearson correlations across ZIPs. Strongly related predictors share credit in the regression; Shapley R² handles that fairly.', '<div id="d4Corr"></div>')}
      </div>
      <div class="split">
        ${card('The age engine, 2026 to 2036', 'Age driven one unit roof replacements a year if no new storm reset the stock: the 2026 roof age distribution aged forward with the model\'s service life, new homes entering at age zero.', '<div id="d4Proj"></div><p class="chartnote" id="d4ProjN"></p>')}
        ${card('Where the jobs come from', 'Roofing jobs a year statewide by service line (model, long run averages). Lines are carved so no job is counted twice.', '<div id="d4Anat"></div>')}
      </div>
      <div class="split">
        ${card('The hour of the day', 'Storm Prediction Center reports in Louisiana by hour, 1996 to 2025 (local standard time).', '<div id="d4Hour"></div><div id="d4HourLeg"></div><p class="chartnote" id="d4HourN"></p>')}
        ${card('The month of the year', 'Seasonal demand by service line (index, average month = 100) against hail and wind reports by month.', '<div id="d4Mon"></div><div id="d4MonLeg"></div><p class="chartnote" id="d4MonN"></p>')}
      </div>
      ${card('What this means for a roofing marketer', 'The findings translated into placements, pages, offers and crews.', '<div id="d4Mean"></div>', 'mt')}
      <div class="split">
        ${card('Data integrity: problems found in the public files and how each was handled', 'Every issue that would have changed a number if left alone.', '<div id="d4Int"></div>')}
        ${card('Judgment calls and sources', 'Choices that move the results, and where the data came from.', '<div id="d4Src"></div>')}
      </div>
      <div class="foot" id="d4Foot"></div></div>`;
    const W = ZD.map(z => z.hu || 1); const Xraw = PRED.map(([, , f]) => ZD.map(z => f(z)));
    const Xz = Xraw.map(col => STATS.zstd(col, W)); const X = ZD.map((_, i) => Xz.map(c => c[i]));
    const fits = {};
    function fitOf(k) {
      if (fits[k]) return fits[k];
      const O = OUT[k]; const yraw = ZD.map(z => O.f(z)); const pos = yraw.filter(v => v > 0).sort((a, b) => a - b); const floor = pos.length ? pos[0] / 2 : 0.01;
      const y = STATS.zstd(yraw.map(v => O.log ? Math.log(Math.max(floor, v)) : v), W);
      const fit = STATS.wls(y, X, W); const shp = STATS.shapley(y, X, W); const tc = STATS.tCrit(fit.df);
      const rows = PRED.map(([key, l], j) => { const b = fit.b[j + 1], se = fit.se[j + 1]; const t = b / se; return { key, l, b, lo: b - tc * se, hi: b + tc * se, p: STATS.pT(Math.abs(t), fit.df), shap: shp[j] }; });
      return (fits[k] = { fit, rows, zeros: yraw.filter(v => v <= 0).length });
    }
    const F0 = fitOf('fema');
    const hm = DATA.ts.month; const hailPk = hm.hail.indexOf(Math.max(...hm.hail)); const tm = DATA.ts.trop_month; const tropPk = tm.indexOf(Math.max(...tm));
    $('#d4Kpis', root).innerHTML = kpiHTML([
      { l: 'Roofing jobs a year (model)', g: 'C', v: K(poolTot), d: `${K(casesTot)} of them open to marketing, all eleven lines` },
      { l: 'Storm, wind and hail share', g: 'B', v: P((pools.storm + pools.hail) / poolTot * 100, 0), d: 'of jobs in a long run average year; far more in a storm year' },
      { l: 'Age driven, 2026 to 2031', g: 'B', v: `${K(proj[0])} to ${K(proj[5])}`, d: `a year with no new storm; ${K(proj[10])} by 2036` },
      { l: 'FEMA damage explained', g: 'A', v: P(F0.fit.r2 * 100, 0), d: `of the variation across ZIPs, by hurricane exposure, hail, income and ownership` },
      { l: 'Two storm seasons', g: 'A', v: `${MON3[hailPk]} and ${MON3[tropPk]}`, d: 'hail peak and tropical peak' },
      { l: 'Licensed roofers per 10,000', g: 'B', v: D(licLA / META.pop * 1e4, 1), d: `${N(licLA)} license records based in Louisiana, ${N(META.lic.out)} more out of state` },
    ]);
    function drawReg() {
      const O = OUT[st.y]; const { fit, rows, zeros } = fitOf(st.y);
      coefPlot($('#d4Coef', root), rows, { head: 'Effect in standard deviations, 95% interval', aria: 'Regression coefficients' });
      const sig = rows.filter(r => r.p < 0.05).sort((a, b) => b.shap - a.shap);
      $('#d4CoefN', root).innerHTML = `<b>${esc(O.l)}</b>. R² = ${D(fit.r2, 2)} (adjusted ${D(fit.adj, 2)}), n = ${fit.n} ZIPs, ${fit.df} degrees of freedom${zeros ? `; ${N(zeros)} ZIPs with none were set to half the smallest observed rate before logging` : ''}. ${sig.length ? 'Significant at 5%: ' + sig.map(r => `${esc(r.l.replace(/ \(.*\)$/, '').toLowerCase())} (${r.b > 0 ? '+' : '−'}${D(Math.abs(r.b), 2)}, Shapley ${D(r.shap, 2)})`).join('; ') + '.' : 'No predictor is significant at 5%.'} ${st.y === 'fema' ? 'Young roofs predict more FEMA damage, not less: storms reset the roofs of the ZIPs they hit, so roof age here is partly an effect of past damage.' : st.y === 'lic' ? 'Many ZIPs have no license record at all, so this fit describes where roofers base themselves, not where they work.' : 'Hail reports depend on who is there to report them; the 30 year hail day rate is the better guide to where hail falls.'} ZIP rates are ecological: they describe places, not households.`;
    }
    const lab = {}; const corr = {}; const short = { hur: 'Hurricane', hail: 'Hail days', old: 'Pre 1980', mh: 'Mobile homes', inc: 'Income', own: 'Owners', dens: 'Density', age20: 'Roofs 20+' };
    PRED.forEach(([k], i) => { lab[k] = short[k]; corr[k] = {}; PRED.forEach(([k2], j) => corr[k][k2] = pearson(Xraw[i], Xraw[j])); });
    $('#d4Corr', root).innerHTML = corrMatrix(PRED.map(p => p[0]), lab, corr) + `<p class="chartnote">Hurricane exposure and hail days run in opposite directions (r = ${DS(corr.hur.hail, 2)}): the coast takes the hurricanes and the north takes the hail, and the north's roofs are older because no hurricane has reset them (hail days and roofs 20 years or older, r = ${DS(corr.hail.age20, 2)}; hurricane exposure and roofs 20 years or older, r = ${DS(corr.hur.age20, 2)}). Mobile homes mark rural, owner occupied ZIPs (with density, r = ${DS(corr.mh.dens, 2)}); homes built before 1980 mark older towns and city neighborhoods with more renters and lower incomes (with income, r = ${DS(corr.old.inc, 2)}).</p>`;
    drawReg();
    function drawCharts() {
      const yrs = proj.map((_, i) => 2026 + i);
      lineChart($('#d4Proj', root), { series: [{ name: 'Age driven replacements a year', color: ramp('green')[6], pts: yrs.map((y, i) => [y, proj[i]]), area: true, dots: true, fmt: v => N(v) }], x: { ticks: yrs.filter(y => y % 2 === 0), fmt: v => String(v) }, y: { label: 'Roofs a year', fmt: v => K(v), zero: true }, H: 240, W: 620, tipTitle: v => String(v), aria: 'Projected age driven replacements' });
      $('#d4ProjN', root).innerHTML = `With no new storm, age driven replacements rise from about ${K(proj[0])} in 2026 to ${K(proj[5])} in 2031 and ${K(proj[10])} in 2036, ${P((proj[10] / proj[0] - 1) * 100, 0)} more, as the roofs the 2005 to 2008 storms installed pass twenty and the 2020 and 2021 storm roofs reach their teens. A major hurricane would replace tens of thousands of roofs at once, then push this curve down for a decade in the ZIPs it hit. New homes enter at about ${K(mean(Object.keys(DATA.ts.permits).map(Number).filter(y => y >= 2021).map(y => DATA.ts.permits[y][0])))} a year (permits, 2021 to 2025). ${G('B')}`;
      const AN = PL.map(l => ({ l: l.name, v: pools[l.key] || 0 })).sort((a, b) => b.v - a.v);
      hbarChart($('#d4Anat', root), AN.map(r => ({ l: r.l, v: r.v, t: K(r.v) + ' · ' + P(r.v / poolTot * 100, r.v / poolTot < 0.01 ? 1 : 0), color: ramp('green')[6] })), { W: 560, L: 200, R: 90, rowH: 22, aria: 'Roofing jobs a year by service line' });
      $('#d4Anat', root).insertAdjacentHTML('beforeend', `<p class="chartnote">Storm work (wind and tropical, replacements and repairs) is the largest pool in a long run average year, then repairs and age driven replacements. Counts are jobs, not dollars: a commercial reroof is one job worth many residential repairs, which module 12 weighs. Grades run from B for storm and age driven work to D for coatings and commercial, where the inputs are assumptions you can replace.</p>`);
      const H = DATA.ts.hour;
      lineChart($('#d4Hour', root), { series: [{ name: 'Hail', color: kindColor(0), pts: H.hail.map((v, h) => [h, v]), area: true, fmt: v => N(v) }, { name: 'Thunderstorm wind', color: kindColor(1), pts: H.wind.map((v, h) => [h, v]), fmt: v => N(v) }, { name: 'Tornado', color: kindColor(2), pts: H.torn.map((v, h) => [h, v]), fmt: v => N(v) }], x: { ticks: [0, 3, 6, 9, 12, 15, 18, 21], fmt: v => hourLab(v).replace(' a.m.', 'a').replace(' p.m.', 'p') }, y: { label: 'Reports, 1996 to 2025', zero: true }, H: 240, W: 620, tipTitle: v => hourLab(v), aria: 'Storm reports by hour' });
      $('#d4HourLeg', root).innerHTML = legendRow([{ name: 'Hail', color: kindColor(0) }, { name: 'Thunderstorm wind', color: kindColor(1) }, { name: 'Tornado', color: kindColor(2) }]);
      const aft = a => sum(a.slice(13, 20)) / sum(a) * 100; const ngt = a => (sum(a.slice(20)) + sum(a.slice(0, 6))) / sum(a) * 100;
      $('#d4HourN', root).innerHTML = `Hail and wind peak between 1 p.m. and 8 p.m. (${P(aft(H.hail), 0)} of hail and ${P(aft(H.wind), 0)} of wind reports), when the afternoon heat drives storms. Tornadoes spread across the clock: ${P(ngt(H.torn), 0)} come between 8 p.m. and 6 a.m., which is why overnight tornado damage fills the next morning's phones. Staff answering and emergency tarping for the evening and the morning after.`;
      const SEA = SLM.SEA; const lines = [['replace', 'Replacement (age driven)', ramp('green')[6], ''], ['storm', 'Storm and wind', catColor(3), ''], ['hail', 'Hail', kindColor(0), '6 4'], ['repair', 'Leak repair', ramp('lime')[6], '2 3']];
      const ix = a => { const m = mean(a); return a.map(v => v / m * 100); };
      const hw = ix(hm.hail.map((v, i) => v + hm.wind[i]));
      lineChart($('#d4Mon', root), { series: lines.map(([k, n, c, dsh]) => ({ name: n, color: c, pts: SEA[k].map((v, i) => [i + 1, v]), dash: dsh, fmt: v => D(v, 0) })).concat([{ name: 'Hail and wind reports', color: ramp('teal')[3], pts: hw.map((v, i) => [i + 1, v]), dash: '1 3', fmt: v => D(v, 0) }]), x: { ticks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], fmt: v => MON3[v - 1] }, y: { label: 'Index, average month = 100', fmt: v => D(v, 0) }, H: 260, W: 620, tipTitle: v => MONL[v - 1], aria: 'Seasonal demand by service line' });
      $('#d4MonLeg', root).innerHTML = legendRow(lines.map(([, n, c, dsh]) => ({ name: n, color: c, dash: !!dsh })).concat([{ name: 'Hail and wind reports', color: ramp('teal')[3], dash: 1 }]));
      const sPk = SEA.storm.indexOf(Math.max(...SEA.storm)), hPk = SEA.hail.indexOf(Math.max(...SEA.hail));
      $('#d4MonN', root).innerHTML = `Storm demand peaks in ${MONL[sPk]} and hail demand in ${MONL[hPk]}: each follows its storms by a month or two as inspections, claims and permits run their course (the model spreads each storm month's work over that month and the next two). Age driven replacement is steady with a spring and fall shoulder and a holiday dip; leak repairs follow the rain. The storm curves are built from the data (grade B); replacement, FORTIFIED and commercial seasons are assumptions (grade D) until your own job history replaces them in module 12.`;
    }
    drawCharts();
    $('#d4Mean', root).innerHTML = proseTable([
      ['<b>Two storm businesses</b>', 'Hurricane work in the south (tarps, emergency repair, FORTIFIED, insured replacement after a declaration) and hail work in the north (inspections after a hail day, impact rated shingles, insured replacement without any declaration). Separate pages, campaigns, crews and calendars; module 02 finds both.'],
      ['<b>Who pays decides the offer</b>', 'In lower income, owner occupied ZIPs storm damage often lands on owners without enough insurance: lead with repair, financing and the Fortify Homes grant. In higher income ZIPs the claim funded full replacement is the offer, inside the claim rules (module 03).'],
      ['<b>Go where the roofers are not</b>', 'Rural storm parishes have few licensed local roofers. A regional company with a local address, permits pulled in the parish and a license number on every ad wins there; module 07 maps the competition.'],
      ['<b>Budget for the waves</b>', 'Age driven demand is growing a few percent a year for the next decade as storm cohorts age. Fund replacement campaigns in the ZIPs where roofs aged 15 to 19 concentrate (module 17), and hold a storm reserve for the two seasons.'],
      ['<b>Time the day</b>', 'Afternoon storms mean evening and next morning calls. Put emergency ad groups and answering on the evening and early morning, not only office hours.'],
    ]);
    $('#d4Int', root).innerHTML = proseTable([
      ['Census API key', 'The Census API now requires a key for this volume of requests; the ACS 2020 to 2024 tables were read from the bulk summary files instead. ZIP sums match the state totals within 0.1 percent.'],
      ['ACS sentinel values', 'Medians the Census cannot estimate are published as large negative codes (such as −666,666,666); they were set to missing before any average, rate or regression.'],
      ['SPC yearly files', 'The Storm Prediction Center\'s single year report files for 2000 to 2007 are not posted (the links return an error page); its combined 2000 to 2004 and 2005 to 2007 files were used.'],
      ['FEMA roof flag', 'FEMA\'s roof damage field is zero for every registration from 2020 on. Verified real property loss without flood damage stands in, with its own multiplier in the damage curve (3.6 against 2.0).'],
      ['Storm Events zones', 'Hurricane, storm surge and high wind events are filed by forecast zone, not coordinates; zone names such as Upper Jefferson or Coastal Cameron were matched to parishes by removing the qualifier.'],
      ['Storm Events clock', 'NOAA records event times in local standard time all year; summer reports read an hour early on a daylight time clock. Times were kept as recorded.'],
      ['2026 hurricanes', 'HURDAT2 runs through 2025; the 2026 storms come from National Hurricane Center operational best track files and are marked preliminary.'],
      ['Wind radii before 2004', 'HURDAT2 carries wind radii only from 2004; earlier storms use a modified Rankine wind profile with the radius of maximum winds estimated from intensity and latitude (Willoughby).'],
      ['Business Patterns detail', 'ZIP level business patterns leave many establishments without detailed industry codes, so ZIP counts by industry run below county totals (roofers 152 against 267); statewide totals use the county file and commercial roofs are anchored to a statewide count.'],
    ]);
    $('#d4Src', root).innerHTML = proseTable([
      ['Weights', 'ZIPs are weighted by homes so a small ZIP\'s noisy rate counts less; unweighted fits give rural ZIPs more say and strengthen the hurricane effect.'],
      ['Logs', 'Outcomes, density and income are logged because they are skewed; ZIPs with a zero outcome are set to half the smallest observed rate. Coefficients are in standard deviations.'],
      ['Observed outcomes only', 'The modeled job counts are not used as outcomes here, because they are built from these same predictors; FEMA registrations, license records and hail reports are observed.'],
      ['Ecology', 'Associations between ZIP averages do not describe individual homeowners.'],
    ]) + srcRows([
      ['FEMA registrations', 'OpenFEMA Individuals and Households Program valid registrations, Louisiana disasters 2004 to 2026', 'A', 'v2', 'https://www.fema.gov/openfema-data-page/individuals-and-households-program-valid-registrations-v2'],
      ['License records', 'LSLBC roofing license records via a public mirror, 950 records', 'B', 'October 2026', 'https://lslbc.gov/'],
      ['Storm reports and rates', 'NOAA NCEI Storm Events 2016 to 2026; Storm Prediction Center 1996 to 2025', 'A', '2026', 'https://www.spc.noaa.gov/wcm/'],
      ['Predictors', 'ACS 2020 to 2024 (B25034, B25024, B25003, B19013, B01003); hurricane climatology from HURDAT2 1950 to 2025', 'A', '2026', 'https://www.census.gov/'],
    ]);
    $('#d4Foot', root).innerHTML = `<b style="color:var(--ink)">Uplift Louisiana Roofing Atlas</b>, module 04. Regressions computed in the page from the embedded ZIP data. Compiled ${esc(new Date(META.compiled + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }))}.`;
    wireSeg($('#d4Y', root), v => { st.y = v; drawReg(); });
    $('#d4Csv', root).onclick = () => saveFile('louisiana-zip-demand-predictors.csv', toCSV(['zip', 'city', 'parish', 'homes'].concat(PRED.map(p => p[0])).concat(Object.keys(OUT)), ZD.map((z, i) => [z.zip, z.city, z.cty, z.hu].concat(Xraw.map(c => +D(c[i], 4))).concat(Object.values(OUT).map(o => +D(o.f(z), 3)))), 'Uplift Louisiana Roofing Atlas, module 04. Raw predictor values (logs as labeled) and observed outcomes.'));
    $('#d4Ts', root).onclick = () => saveFile('louisiana-roofing-seasons-hours.csv', toCSV(['kind', 'index', 'hail_reports', 'wind_reports', 'tornado_reports', 'replace_index', 'storm_index', 'hail_index', 'repair_index'], MON3.map((m, i) => ['month', i + 1, hm.hail[i], hm.wind[i], hm.torn[i], SLM.SEA.replace[i], SLM.SEA.storm[i], SLM.SEA.hail[i], SLM.SEA.repair[i]]).concat(DATA.ts.hour.hail.map((v, h) => ['hour', h, v, DATA.ts.hour.wind[h], DATA.ts.hour.torn[h], '', '', '', ''])), 'Storm Prediction Center reports for Louisiana 1996 to 2025; seasonal indexes from the service line model.'));
    BUS.on('theme', () => { drawReg(); drawCharts(); });
  }
});
