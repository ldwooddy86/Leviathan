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
/* ten year projection of age driven replacements from a 2026 roof age distribution, wear only. WBx = {L, k} is the
   service life to use (the model's life for roofs other than tile when left out; pass the tile underlayment life for
   the tile part). */
function ageProjection(hist, years, newPerYear, WBx) {
  const WB = WBx || META.model.WB; const lam = WB.L / gammaFn(1 + 1 / WB.k); const S = t => Math.exp(-Math.pow(Math.max(0, t) / lam, WB.k)); const H = t => 1 - S(t + 1) / S(t);
  let d = hist.slice(); const out = [];
  for (let y = 0; y <= years; y++) { const rep = d.reduce((s, v, a) => s + v * H(a), 0); out.push(rep); const nd = Array(d.length).fill(0); for (let a = 0; a < d.length - 1; a++) nd[a + 1] += d[a] * (1 - H(a)); nd[d.length - 1] += d[d.length - 1] * (1 - H(d.length - 1)); nd[0] = rep + (newPerYear || 0); d = nd; }
  return out;
}
/* Shapley split of R² from one weighted cross product matrix: every subset is a small solve, so ten predictors over
   every scored California ZIP cost a few milliseconds (the direct method refits the regression 1,024 times). */
function shapleyGram(y, X, w) {
  const n = y.length, p = X[0].length, k = p + 1; const W = w.map(x => x / mean(w)); const G = Array.from({ length: k }, () => Array(k).fill(0)); const g = Array(k).fill(0); let yy = 0, sw = 0, sy = 0;
  for (let t = 0; t < n; t++) { const r = [1].concat(X[t]); const wt = W[t]; for (let i = 0; i < k; i++) { g[i] += wt * r[i] * y[t]; for (let j = i; j < k; j++) G[i][j] += wt * r[i] * r[j]; } yy += wt * y[t] * y[t]; sw += wt; sy += wt * y[t]; }
  for (let i = 0; i < k; i++) for (let j = 0; j < i; j++) G[i][j] = G[j][i];
  const sst = yy - sy * sy / sw; const memo = {};
  const solve = (A, b) => { const m = A.length; const M = A.map((r, i) => r.concat([b[i]])); for (let c = 0; c < m; c++) { let q = c; for (let r = c + 1; r < m; r++) if (Math.abs(M[r][c]) > Math.abs(M[q][c])) q = r; if (Math.abs(M[q][c]) < 1e-12) return null; [M[c], M[q]] = [M[q], M[c]]; for (let r = 0; r < m; r++) { if (r === c) continue; const f = M[r][c] / M[c][c]; for (let z = c; z <= m; z++) M[r][z] -= f * M[c][z]; } } return M.map((r, i) => r[m] / r[i]); };
  const r2 = mask => { if (memo[mask] != null) return memo[mask]; const ix = [0]; for (let j = 0; j < p; j++) if (mask & (1 << j)) ix.push(j + 1); let v = 0; if (ix.length > 1) { const b = solve(ix.map(i => ix.map(j => G[i][j])), ix.map(i => g[i])); if (b) v = 1 - (yy - sum(b.map((c, i) => c * g[ix[i]]))) / sst; } memo[mask] = v; return v; };
  const fact = [1]; for (let i = 1; i <= p; i++) fact[i] = fact[i - 1] * i; const bits = m => { let c = 0; while (m) { c += m & 1; m >>= 1; } return c; }; const out = Array(p).fill(0);
  for (let mask = 0; mask < (1 << p); mask++) { const sz = bits(mask); for (let j = 0; j < p; j++) { if (mask & (1 << j)) continue; out[j] += fact[sz] * fact[p - sz - 1] / fact[p] * (r2(mask | (1 << j)) - r2(mask)); } }
  return out;
}
/* figures typed from the evidence file because the data block does not carry them; each names its source where it prints */
const CA_FACTS = {
  econ22: { rcpt: 6206850e3, firm: 2762, estab: 2781, emp: 25383, pay: 1588092e3, mat: 2115814e3, sub: 346456e3, us: 69906202e3 },   /* 2022 Economic Census, EC2223BASIC, NAICS 238160, California */
  wscIns: 41.4,        /* American Housing Survey 2023, West South Central division: share of roof jobs paid by insurance (the first edition's division) */
  laPermit23: 40,      /* City of Los Angeles re-roof permits, 2023 over 2022, percent */
};
/* ============================ Module 4: Demand Drivers ============================ */
registerModule({
  key: 'drivers', num: '04', title: 'Demand Drivers', desc: 'What drives roofing demand in California: roof age and building booms, rain and wind, wildfire, insurance, income, the seasons and the clock',
  mount(root) {
    const PL = SLM.LINES; const nl = numWord(NLINE); const AHS = META.ahs || {}; const AM = AHS.metros || {}; const INS = DATA.ins || {}; const IS = INS.state || {}; const TS = DATA.ts || {};
    const ZD = ZR.filter(z => isN(z.inc) && z.inc > 0 && isN(z.sqmi) && z.sqmi > 0);
    const PRED = [
      HC.fhsz ? ['fhsz', 'Homes in High or Very High fire zones (%)', z => z[HC.fhsz] || 0, 'Fire zone'] : null,
      HC.rain ? ['rain', 'Normal rain a year (inches)', z => z[HC.rain], 'Rain'] : null,
      HC.gust ? ['gust', 'Gust days a year, 58 mph or more', z => z[HC.gust], 'Gust days'] : null,
      ['old', 'Homes built before 1980 (%)', z => z.pre80_sh, 'Pre 1980'],
      ZC.includes('tile_sh') ? ['tile', 'Tile roofs (%, model)', z => z.tile_sh, 'Tile'] : null,
      ['mh', 'Mobile homes (% of homes)', z => z.mh_sh, 'Mobile homes'],
      ['inc', 'Median household income (log)', z => Math.log10(z.inc), 'Income'],
      ['own', 'Owner occupied homes (%)', z => z.own_sh, 'Owners'],
      ['dens', 'Residents per square mile (log)', z => Math.log10(Math.max(1, z.pop) / z.sqmi), 'Density'],
      ZC.includes('ra25_sh') ? ['age25', 'Roofs 25 years or older (%, model)', z => z.ra25_sh, 'Roofs 25+'] : ['age20', 'Roofs 20 years or older (%, model)', z => z.ra20_sh, 'Roofs 20+'],
    ].filter(Boolean);
    const OUTALL = {
      fair: ['fair_sh', { l: 'FAIR Plan home policies per 100 housing units, September 2026', s: 'FAIR Plan', f: z => z.fair_sh, log: true, why: 'The FAIR Plan follows the fire map: it is where the voluntary market stopped writing. Tile and newer stock sit in the same foothill tracts, so read the fire zone bar first.' }],
      nonren: ['nonren_sh', { l: 'Policies non-renewed in 2023, percent of policies up for renewal', s: 'Non-renewals', f: z => z.nonren_sh, log: true, why: 'The file counts insurer and owner initiated non-renewals together, so part of this is owners moving house or shopping, which follows density and renting, not risk.' }],
      fema: ['fema_rate', { l: 'FEMA roof or property registrations per 100 homes, 2003 to 2025', s: 'Disaster damage', f: z => z.fema_rate, log: true, why: 'Most California ZIPs have none, and the count mixes fires, floods and two earthquakes, so this fit mostly separates the places a declared disaster reached from those it did not.' }],
      lic: ['lic', { l: 'C-39 roofing licenses per 10,000 residents (CSLB)', s: 'Roofers', f: z => (z.lic || 0) / Math.max(1, z.pop) * 1e4, log: true, why: 'Many ZIPs have no license at all, so this fit describes where roofers base themselves, not where they work.' }],
    };
    const OUT = {}; Object.keys(OUTALL).forEach(k => { if (ZC.includes(OUTALL[k][0])) OUT[k] = OUTALL[k][1]; });
    const st = { y: Object.keys(OUT)[0] };
    const pools = META.pools || {}; const poolTot = sum(Object.values(pools)); const casesTot = sum(Object.values(META.cases || {}));
    const PERM = TS.permits || {}; const newHomes = mean(Object.keys(PERM).map(Number).filter(y => y >= 2021).map(y => PERM[y][0])) || 0;
    const tileNew = (((META.mat || {}).era || {})['2000'] != null ? (META.mat.era['2000'].tile != null ? META.mat.era['2000'].tile : null) : null); const tileNewSh = isN(tileNew) ? (tileNew > 1 ? tileNew / 100 : tileNew) : 0.622;   /* tile share of homes built since 2000 (RECS 2020) */
    const AH = TS.agehist || [], AHT = TS.agehist_t || null; const WB = META.model.WB, WBT = META.model.WBT;
    const projN = ageProjection(AHT ? AH.map((v, i) => Math.max(0, v - (AHT[i] || 0))) : AH, 10, newHomes * (AHT ? 1 - tileNewSh : 1), WB);
    const projT = AHT && WBT ? ageProjection(AHT, 10, newHomes * tileNewSh, WBT) : null;
    const LIC = META.lic || {}; const licCA = LIC.inca != null ? LIC.inca : (LIC.clear || LIC.n || 0);
    const wet = HZ.wetShare(HZ.rain);
    root.innerHTML = mastHTML({ eyebrow: `Module 04 · Demand Drivers · ${N(ZD.length)} ZIPs`, title: 'Demand Drivers',
      dek: 'Why California roofs are replaced on a clock set by the builder and not by the weather, why the same winter that floods the phones with leaks pays for almost no roofs through insurance, why an insurer\'s letter now sells more roofs than a storm does in the foothills, why roofers cluster in cities while the fire zones sit in the hills, and when in the year the work arrives. This module tests the obvious explanations against observed outcomes with a weighted regression across ZIPs, projects the age engine ten years out with tile on its own clock, reads the seasons from the rain, wind and fire record, sizes the market from the Economic Census and the license roll, and records how every California column was built.',
      meta: [`<b>Units</b> ${N(ZD.length)} ZIPs with 500 or more residents, weighted by homes`, `<b>Outcomes</b> ${esc(joinAnd(Object.values(OUT).map(o => o.s.toLowerCase())))}`, '<b>Survey</b> American Housing Survey 2023 metros', '<b>Method</b> standardized WLS, Shapley R²'],
      bar: 'Demand Drivers', barsub: 'What predicts roofing demand',
      actions: [{ id: 'd4Csv', label: '↓ ZIP predictors CSV' }, { id: 'd4Ts', label: '↓ Seasons CSV' }] }) +
      `<div class="wrap">
      ${callout('', 'Read this first: five findings that should change a media plan', `<b>1. Wear, not weather, replaces California roofs.</b> No storm resets the stock here. Owners in the Los Angeles metro replaced ${P((AM.la || {}).rate * 2, 1)} of roofs in two years, San Francisco and Oakland ${P((AM.sf || {}).rate * 2, 1)}, San Jose ${P((AM.sj || {}).rate * 2, 1)}, Riverside and San Bernardino ${P((AM.riv || {}).rate * 2, 1)} (American Housing Survey), and the timing follows the decade the tract was built. <b>2. Insurance pays for almost none of it.</b> Insurance paid for ${P((AM.la || {}).ins, 1)} of roof jobs in Los Angeles, ${P((AM.sf || {}).ins, 1)} in San Francisco, ${P((AM.sj || {}).ins, 1)} in San Jose and ${P((AM.riv || {}).ins, 1)} in Riverside, against ${P(CA_FACTS.wscIns, 0)} in the west south central states. Claim funded copy fits few jobs; financing and price do the work. <b>3. Insurance still drives demand, from the other side.</b> ${IS.fair_pif ? `FAIR Plan home policies went from ${N(IS.fair_pif[0])} to ${N(IS.fair_pif[IS.fair_pif.length - 1])} between September ${(INS.years || [2022])[0]} and ${(INS.years || [0, 0, 0, 0, 2026])[(INS.years || [0, 0, 0, 0, 2026]).length - 1]}. ` : ''}An owner who is non-renewed, or who wants off the FAIR Plan, is asked about the age and fire class of the roof: a deadline no ad could create. <b>4. Tile runs on a second clock.</b> The tile itself outlasts the house; the underlayment does not. The tracts of the 1980s and 1990s are due now, and the job is a lift and relay, not a new roof. <b>5. The year has one wet season.</b> ${wet != null ? `${P(wet, 0)} of the normal rain falls November to March. ` : ''}Leak and storm calls arrive then; reroofs, tile and coatings are sold then and built in the dry months.`)}
      <div class="kpis" id="d4Kpis"></div>
      <div class="split">
        ${card('What predicts the outcome', 'Standardized coefficients from a weighted regression across ZIPs (weights = homes; outcome logged). Bars are 95% intervals; filled dots are significant at 5%. Shapley R² splits the explained variance among predictors.', `<div class="seg" id="d4Y" style="margin-bottom:10px">${Object.entries(OUT).map(([k, o], i) => `<button data-v="${k}" aria-pressed="${i === 0}">${esc(o.s)}</button>`).join('')}</div><div id="d4Coef"></div><p class="chartnote" id="d4CoefN"></p>`)}
        ${card('How the predictors relate to each other', 'Pearson correlations across ZIPs. Strongly related predictors share credit in the regression; Shapley R² handles that fairly.', '<div id="d4Corr"></div>')}
      </div>
      <div class="split">
        ${card('The age engine, 2026 to 2036', 'Age driven one unit roof replacements a year, and tile underlayment jobs, if nothing but wear acts on the stock: the 2026 roof age distributions aged forward with the model\'s two service lives, new homes entering at age zero.', '<div id="d4Proj"></div><div id="d4ProjLeg"></div><p class="chartnote" id="d4ProjN"></p>')}
        ${card('Where the jobs come from', 'Roofing jobs a year statewide by service line (model, long run averages). Lines are carved so no job is counted twice.', '<div id="d4Anat"></div>')}
      </div>
      <div class="split">
        ${card('Building booms: the stock by decade built', 'One unit homes by decade built (ACS 2020 to 2024). Without storm resets, each decade\'s homes come due together a roof life later, and again a roof life after that.', '<div id="d4Boom"></div><p class="chartnote" id="d4BoomN"></p>')}
        ${card('Replacements by year, and the wildfire rebuild cohorts', 'The cohort model run back to 2000: age driven replacements (tile relays included) and roofs rebuilt after wildfire, by year.', '<div id="d4Hist"></div><div id="d4HistLeg"></div><p class="chartnote" id="d4HistN"></p>')}
      </div>
      <div class="split">
        ${card('Who replaces, who pays: the housing survey', 'Owner occupied one unit homes, American Housing Survey 2023 (San Jose 2021). Roofing jobs in the two years before the interview.', '<div id="d4Ahs"></div><p class="chartnote" id="d4AhsN"></p>')}
        ${card('Insurance as a driver', 'FAIR Plan home policies at each September 30, and residential policies non-renewed by year (California FAIR Plan Association; Department of Insurance).', '<div id="d4Ins"></div><p class="chartnote" id="d4InsN"></p><div id="d4Ins2"></div><p class="chartnote" id="d4Ins2N"></p>')}
      </div>
      <div class="split">
        ${card('The month of the year', 'Seasonal demand by service line (index, average month = 100) against normal rain by month.', '<div id="d4Mon"></div><div id="d4MonLeg"></div><p class="chartnote" id="d4MonN"></p>')}
        ${card('The hour of the day', 'Located weather and fire reports by local hour, where the hazard record carries the hour.', '<div id="d4Hour"></div><div id="d4HourLeg"></div><p class="chartnote" id="d4HourN"></p>')}
      </div>
      ${card('How big the market is', 'The roofing trade in California as the Census and the license board count it. These are counts of firms and dollars, set beside the model\'s jobs as a check of scale.', '<div id="d4Mkt"></div>', 'mt')}
      ${card('What this means for a roofing marketer', 'The findings translated into placements, pages, offers and crews.', '<div id="d4Mean"></div>', 'mt')}
      <div class="split">
        ${card('Build record: how California\'s columns were made, and what was found on the way', 'Every choice in the data build that would have changed a number, and every assumption with no evidence behind it.', '<div id="d4Int"></div>')}
        ${card('Judgment calls and sources', 'Choices that move the results, and where the data came from.', '<div id="d4Src"></div>')}
      </div>
      <div class="foot" id="d4Foot"></div></div>`;
    const W = ZD.map(z => z.hu || 1);
    const fill = col => { const m = mean(col); return col.map(v => isN(v) ? +v : m); };   /* a missing predictor value takes the mean, so no ZIP is dropped for one gap */
    const Xraw = PRED.map(([, , f]) => fill(ZD.map(z => f(z))));
    const Xz = Xraw.map(col => STATS.zstd(col, W)); const X = ZD.map((_, i) => Xz.map(c => c[i]));
    const fits = {};
    function fitOf(k) {
      if (fits[k]) return fits[k];
      const O = OUT[k]; const keep = ZD.map((z, i) => isN(O.f(z)) ? i : -1).filter(i => i >= 0); const yraw = keep.map(i => O.f(ZD[i])); const Wk = keep.map(i => W[i]); const Xk = keep.map(i => X[i]);
      const pos = yraw.filter(v => v > 0).sort((a, b) => a - b); const floor = pos.length ? pos[0] / 2 : 0.01;
      const y = STATS.zstd(yraw.map(v => O.log ? Math.log(Math.max(floor, v)) : v), Wk);
      const fit = STATS.wls(y, Xk, Wk); if (!fit) return (fits[k] = { fit: null, rows: [], zeros: 0 });
      const shp = shapleyGram(y, Xk, Wk); const tc = STATS.tCrit(fit.df);
      const rows = PRED.map(([key, l], j) => { const b = fit.b[j + 1], se = fit.se[j + 1]; const t = b / se; return { key, l, b, lo: b - tc * se, hi: b + tc * se, p: STATS.pT(Math.abs(t), fit.df), shap: shp[j] }; });
      return (fits[k] = { fit, rows, zeros: yraw.filter(v => v <= 0).length });
    }
    const F0 = st.y ? fitOf(st.y) : { fit: null };
    const wearKeys = ['replace', 'repair', 'tile'].filter(k => k in pools), wxKeys = ['storm', 'fire'].filter(k => k in pools);
    $('#d4Kpis', root).innerHTML = kpiHTML([
      { l: 'Roofing jobs a year (model)', g: 'C', v: K(poolTot), d: `${K(casesTot)} of them open to marketing, all ${nl} lines` },
      { l: 'Wear and leaks', g: 'B', v: P(sum(wearKeys.map(k => pools[k])) / (poolTot || 1) * 100, 0), d: `of jobs: ${joinAnd(wearKeys.map(k => SLM.lineName(k).toLowerCase()))}` },
      { l: 'Weather and fire', g: 'C', v: P(sum(wxKeys.map(k => pools[k])) / (poolTot || 1) * 100, 0), d: 'of jobs in a long run average year; far more after a wet winter or a fire' },
      { l: 'Age driven, 2026 to 2031', g: 'B', v: `${K(projN[0])} to ${K(projN[5])}`, d: projT ? `a year, plus ${K(projT[0])} to ${K(projT[5])} tile relays` : 'a year from wear alone' },
      { l: 'Paid by insurance', g: 'A', v: P(AHS.pac_ins, 1), d: `of roof jobs, Pacific division; ${P(CA_FACTS.wscIns, 0)} in the west south central states` },
      F0.fit ? { l: esc(OUT[st.y].s) + ' explained', g: 'A', v: P(F0.fit.r2 * 100, 0), d: 'of the variation across ZIPs, by the predictors below' } : null,
      { l: 'C-39 licenses per 10,000 residents', g: 'A', v: D(licCA / Math.max(1, META.pop) * 1e4, 1), d: `${N(licCA)} with a California address${isN(LIC.out) ? ', ' + N(LIC.out) + ' more out of state' : ''}` },
    ].filter(Boolean));
    function drawReg() {
      if (!st.y) { $('#d4Coef', root).innerHTML = '<p class="mini">The data carries no observed outcome to fit.</p>'; return; }
      const O = OUT[st.y]; const { fit, rows, zeros } = fitOf(st.y);
      if (!fit) { $('#d4Coef', root).innerHTML = '<p class="mini">This fit could not be computed (the predictors are collinear in this data).</p>'; $('#d4CoefN', root).innerHTML = ''; return; }
      coefPlot($('#d4Coef', root), rows, { head: 'Effect in standard deviations, 95% interval', aria: 'Regression coefficients' });
      const sig = rows.filter(r => r.p < 0.05).sort((a, b) => b.shap - a.shap);
      $('#d4CoefN', root).innerHTML = `<b>${esc(O.l)}</b>. R² = ${D(fit.r2, 2)} (adjusted ${D(fit.adj, 2)}), n = ${N(fit.n)} ZIPs, ${N(fit.df)} degrees of freedom${zeros ? `; ${N(zeros)} ZIPs with none were set to half the smallest observed rate before logging` : ''}. ${sig.length ? 'Significant at 5%, largest share of R² first: ' + sig.map(r => `${esc(r.l.replace(/ \(.*\)$/, '').toLowerCase())} (${r.b > 0 ? '+' : '−'}${D(Math.abs(r.b), 2)}, Shapley ${D(r.shap, 2)})`).join('; ') + '.' : 'No predictor is significant at 5%.'} ${esc(O.why)} ZIP rates are ecological: they describe places, not households.`;
    }
    const lab = {}; const corr = {};
    PRED.forEach(([k, , , sh], i) => { lab[k] = sh; corr[k] = {}; PRED.forEach(([k2], j) => corr[k][k2] = pearson(Xraw[i], Xraw[j])); });
    const cr = (a, b) => corr[a] && isN(corr[a][b]) ? corr[a][b] : null; const crs = (a, b, txt) => cr(a, b) != null ? `${txt} (r = ${DS(cr(a, b), 2)})` : '';
    const ageK = corr.age25 ? 'age25' : 'age20';
    $('#d4Corr', root).innerHTML = corrMatrix(PRED.map(p => p[0]), lab, corr) + `<p class="chartnote">${[crs('fhsz', 'dens', 'Fire zones are the thinly settled edge of the map: fire zone share against density'), crs('tile', 'old', 'Tile marks the tracts built since 1980: tile share against homes built before 1980'), crs('old', ageK, 'Old homes are not the same thing as old roofs, because an old home has been reroofed: pre 1980 homes against old roofs'), crs('tile', ageK, 'Tile roofs read old because the underlayment is counted, not the tile: tile share against old roofs'), crs('inc', 'own', 'Income and ownership move together'), crs('mh', 'dens', 'Mobile homes mark rural ZIPs: with density'), crs('rain', 'fhsz', 'Rain and fire zones overlap in the north and the mountains')].filter(Boolean).join('. ')}.</p>`;
    drawReg();
    const OK = ['o20', 'o10', 'o00', 'o90', 'o80', 'o70', 'o60', 'o50', 'o40', 'oold'].every(k => ZC.includes(k)); const DK = OK ? ['oold', 'o40', 'o50', 'o60', 'o70', 'o80', 'o90', 'o00', 'o10', 'o20'] : ['ybold', 'yb40', 'yb50', 'yb60', 'yb70', 'yb80', 'yb90', 'yb00', 'yb10', 'yb20'];
    const DL = ['Before 1940', '1940s', '1950s', '1960s', '1970s', '1980s', '1990s', '2000s', '2010s', '2020 on'];
    function drawCharts() {
      const yrs = projN.map((_, i) => 2026 + i); const G6 = ramp('green')[6], T5 = ramp('teal')[5];
      const ser = [{ name: 'Age driven replacements a year (tile apart)', color: G6, pts: yrs.map((y, i) => [y, projN[i]]), area: true, dots: true, fmt: v => N(v) }]; if (projT) ser.push({ name: 'Tile underlayment jobs a year', color: T5, pts: yrs.map((y, i) => [y, projT[i]]), dots: true, fmt: v => N(v) });
      lineChart($('#d4Proj', root), { series: ser, x: { ticks: yrs.filter(y => y % 2 === 0), fmt: v => String(v) }, y: { label: 'Roofs a year', fmt: v => K(v), zero: true }, H: 240, W: 620, tipTitle: v => String(v), aria: 'Projected age driven replacements' });
      $('#d4ProjLeg', root).innerHTML = legendRow(ser.map(s => ({ name: s.name, color: s.color })));
      $('#d4ProjN', root).innerHTML = `From wear alone, replacements of shingle and other roofs go from about ${K(projN[0])} in 2026 to ${K(projN[5])} in 2031 and ${K(projN[10])} in 2036 (${S((projN[10] / projN[0] - 1) * 100, 0)}%)${projT ? `; tile underlayment jobs from ${K(projT[0])} to ${K(projT[5])} and ${K(projT[10])} (${S((projT[10] / projT[0] - 1) * 100, 0)}%) as the tracts of the 1980s, 1990s and 2000s pass the underlayment's life` : ''}. Nothing resets this curve statewide; a wildfire resets it in the ZIPs it burns, and an insurer's inspection pulls individual roofs forward without changing the total much. New one unit homes enter at about ${K(newHomes)} a year (permits, 2021 to 2025), ${P(tileNewSh * 100, 0)} of them taken as tile (the survey's share for homes built since 2000). ${G('B')}`;
      const AN = PL.map(l => ({ l: l.name, k: l.key, v: pools[l.key] || 0 })).sort((a, b) => b.v - a.v);
      hbarChart($('#d4Anat', root), AN.map(r => ({ l: r.l, v: r.v, t: K(r.v) + ' · ' + P(r.v / (poolTot || 1) * 100, r.v / (poolTot || 1) < 0.01 ? 1 : 0), color: lineColor(r.k) })), { W: 560, L: 230, R: 90, rowH: 22, aria: 'Roofing jobs a year by service line' });
      $('#d4Anat', root).insertAdjacentHTML('beforeend', `<p class="chartnote">${esc(AN[0].l)} is the largest pool, then ${esc(AN[1].l.toLowerCase())} and ${esc(AN[2].l.toLowerCase())}. Counts are jobs, not dollars: a commercial reroof is one job worth many residential repairs, which module 12 weighs. Grades run from B for the lines built on housing counts to D for the lines whose anchor is an assumption you can replace.</p>`);
      const dec = DK.map(k => sum(Z.map(z => z[k] || 0))); const dt = sum(dec) || 1; const C = ramp('green');
      barChart($('#d4Boom', root), { cats: DL, series: [{ name: OK ? 'One unit homes' : 'Housing units', color: C[5], values: dec }], H: 230, W: 600, L: 52, rot: true, fmt: v => K(v), highlight: i => (i === 5 || i === 6) ? ramp('teal')[5] : C[i <= 4 ? 6 : 3], aria: 'Homes by decade built' });
      const big = dec.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]);
      $('#d4BoomN', root).innerHTML = `${OK ? 'One unit homes' : 'Housing units'} by decade built: the ${DL[big[0][1]].toLowerCase()} and the ${DL[big[1][1]].toLowerCase()} are the largest cohorts (${P(big[0][0] / dt * 100, 0)} and ${P(big[1][0] / dt * 100, 0)}); ${P(sum(dec.slice(0, 5)) / dt * 100, 0)} were built before 1980 and are on their third roof or later. The 1980s and 1990s (blue) are the tile era: the 2020 federal energy survey found tile on 43 percent of California single family homes of those decades and on 62 percent of those built since 2000, against 7 percent of homes from before 1960. Those tile tracts never had a first reroof; their first job is the underlayment. ${G('A')}`;
      const RH = TS.replace_hist || {}; const hy = Object.keys(RH).map(Number).sort((a, b) => a - b);
      if (hy.length) {
        const s2 = [{ name: 'Age driven replacements, tile relays included', color: G6, pts: hy.map(y => [y, RH[y][0]]), area: true, fmt: v => N(v) }, { name: 'Roofs rebuilt after wildfire', color: lineColor('fire'), pts: hy.map(y => [y, RH[y][1] || 0]), dots: true, fmt: v => N(v) }];
        lineChart($('#d4Hist', root), { series: s2, x: { ticks: hy.filter(y => y % 4 === 0), fmt: v => String(v) }, y: { label: 'Roofs a year', fmt: v => K(v), zero: true }, H: 240, W: 620, tipTitle: v => String(v), aria: 'Replacements and wildfire rebuild roofs by year' });
        $('#d4HistLeg', root).innerHTML = legendRow(s2.map(s => ({ name: s.name, color: s.color })));
        const fmax = hy.map(y => [RH[y][1] || 0, y]).sort((a, b) => b[0] - a[0]); const ftot = sum(hy.map(y => RH[y][1] || 0)), atot = sum(hy.map(y => RH[y][0] || 0));
        $('#d4HistN', root).innerHTML = `Wear replaced about ${K(atot)} one unit roofs from ${hy[0]} to ${hy[hy.length - 1]} in the model; wildfire rebuilds put back ${K(ftot)} (${P(ftot / Math.max(1, atot + ftot) * 100, 1)} of the total). The rebuild years with the most roofs are ${joinAnd(fmax.slice(0, 3).filter(r => r[0] > 0).map(r => `${r[1]} (${N(r[0])})`)) || 'none on record'}: each destroyed structure CAL FIRE recorded leaves the stock and comes back as a new roof over the four years after the fire, at the rebuild share the data build assumes (${P(((META.model.ANCH || {}).fire_rb || 0) * 100, 0)}). A burned neighborhood is therefore a cohort of young Class A roofs, and its next age driven wave is two decades out. ${G('C')}`;
      } else $('#d4Hist', root).innerHTML = '<p class="mini">The data carries no replacement history by year.</p>';
      // housing survey
      const rowsA = [['Los Angeles, Long Beach, Anaheim', AM.la], ['San Francisco, Oakland', AM.sf], ['Riverside, San Bernardino', AM.riv], ['San Jose (2021)', AM.sj], ['The three 2023 metros pooled', AM.pool], ['Pacific division', { rate: AHS.pac_rate, diy: AHS.pac_diy, med: AHS.pac_med, mean: AHS.pac_mean, ins: AHS.pac_ins, leak: AHS.pac_leak }], ['United States', AHS.us]].filter(r => r[1] && isN(r[1].rate));
      $('#d4Ahs', root).innerHTML = rowsA.length ? `<div class="xscroll"><table><thead><tr><th class="l">Area</th><th>Roof replaced in two years</th><th>Done by the owner</th><th>Median hired job</th><th>Paid by insurance</th><th>Leak in 12 months</th></tr></thead><tbody>${rowsA.map(([n, a]) => `<tr><td class="l"><b>${esc(n)}</b>${isN(a.jobs) ? `<div class="mini">${N(a.jobs)} roofing jobs sampled</div>` : ''}</td><td>${P(a.rate * 2, 1)}</td><td>${P(a.diy, 1)}</td><td>${M$(a.med)}</td><td>${P(a.ins, 1)}</td><td>${P(a.leak, 2)}</td></tr>`).join('')}<tr><td class="l">West south central states, for contrast</td><td>—</td><td>—</td><td>—</td><td>${P(CA_FACTS.wscIns, 1)}</td><td>—</td></tr></tbody></table></div>` : '<p class="mini">The data carries no housing survey block.</p>';
      $('#d4AhsN', root).innerHTML = `Each metro cell rests on 60 to 71 sampled roofing jobs, so read each figure as plus or minus a third; no sampling errors were computed. San Diego and Sacramento are not sampled as metros and take the Pacific division figures. Two things hold across every California row: insurance pays for a few percent of roof jobs at most, and more homes report a leak in a year than replace a roof in one. The first is why this atlas has no claim driven line the size of a hurricane state's; the second is why the repair line is the widest door into a household. ${G('A')}`;
      // insurance
      const C5 = ramp('green');
      if (IS.fair_pif && IS.fair_pif.length) { const ys = INS.years || IS.fair_pif.map((_, i) => 2022 + i); barChart($('#d4Ins', root), { cats: ys.map(String), series: [{ name: 'FAIR Plan home policies in force', color: C5[6], values: IS.fair_pif }], H: 200, W: 560, L: 56, fmt: v => K(v), aria: 'FAIR Plan residential policies by year' }); const a = IS.fair_pif[0], b = IS.fair_pif[IS.fair_pif.length - 1]; const dz = sum(Z.map(z => z.fair_dist || 0));
        $('#d4InsN', root).innerHTML = `FAIR Plan home policies: ${N(a)} on September 30, ${ys[0]} and ${N(b)} on September 30, ${ys[ys.length - 1]} (${D(b / Math.max(1, a), 1)} times)${IS.fair_tiv ? `; exposure $${N(IS.fair_tiv[IS.fair_tiv.length - 1] / 1000)} billion` : ''}${dz ? `. The Plan flags ${N(dz)} of the atlas's ZIPs as distressed areas` : ''}. The Plan is the insurer of last resort: basic fire cover, bought when no admitted insurer will write the home. It takes up to ${D((META.harden || {}).fair_disc, 1)} percent off its wildfire premium for all twelve hardening measures, a Class A roof among them. ${G('A')}`; }
      else $('#d4Ins', root).innerHTML = '<p class="mini">The data carries no FAIR Plan totals by year.</p>';
      const NR = IS.nonren || {}, NI = IS.insnr || {}; const ny = Object.keys(NR).map(Number).sort((a, b) => a - b);
      if (ny.length) { barChart($('#d4Ins2', root), { cats: ny.map(String), series: [{ name: 'Insurer initiated (reported to 2021)', color: ramp('teal')[5], values: ny.map(y => NI[y] || 0) }, { name: 'Owner initiated, or not split', color: C5[4], values: ny.map(y => Math.max(0, (NR[y] || 0) - (NI[y] || 0))) }], stacked: true, H: 200, W: 560, L: 56, fmt: v => K(v), aria: 'Residential policies non-renewed by year' }); const last = ny[ny.length - 1]; const iy = Object.keys(NI).map(Number).sort((a, b) => a - b); const il = iy[iy.length - 1];
        $('#d4Ins2N', root).innerHTML = `Residential policies non-renewed: ${N(NR[last])} in ${last} against ${N(NR[ny[0]])} in ${ny[0]}. ${il ? `Insurers themselves ended ${N(NI[il])} in ${il} (${P(NI[il] / Math.max(1, NR[il]) * 100, 0)} of that year's non-renewals); the Department's later file does not separate the insurer's decision from the owner's, so the bars after ${il} are one colour. ` : ''}After a declared wildfire emergency the Commissioner may bar non-renewals in and beside the fire perimeter for a year (Insurance Code 675.1); that moratorium delays the letters, it does not stop them. ${G('A')}`; }
      // month
      const lines = ['replace', 'repair', 'storm', 'fire', 'tile', 'coat'].filter(k => SLM.SEA[k]); const dash = { replace: '', repair: '2 3', storm: '', fire: '6 4', tile: '4 2', coat: '1 3' };
      const ix = a => { const m = mean(a) || 1; return a.map(v => v / m * 100); };
      const ms = lines.map(k => ({ name: SLM.lineName(k), color: lineColor(k), pts: SLM.SEA[k].map((v, i) => [i + 1, v]), dash: dash[k], fmt: v => D(v, 0) })); if (HZ.rain) ms.push({ name: 'Normal rain', color: ramp('teal')[3], pts: ix(HZ.rain).map((v, i) => [i + 1, v]), dash: '1 3', area: true, fmt: v => D(v, 0) });
      lineChart($('#d4Mon', root), { series: ms, x: { ticks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], fmt: v => MO3[v - 1] }, y: { label: 'Index, average month = 100', fmt: v => D(v, 0) }, H: 260, W: 620, tipTitle: v => MOL[v - 1], aria: 'Seasonal demand by service line' });
      $('#d4MonLeg', root).innerHTML = legendRow(ms.map(s => ({ name: s.name, color: s.color, dash: !!s.dash })));
      const pk = k => MOL[SLM.SEA[k].indexOf(Math.max(...SLM.SEA[k]))]; const lo = k => MOL[SLM.SEA[k].indexOf(Math.min(...SLM.SEA[k]))];
      $('#d4MonN', root).innerHTML = `${HZ.rain ? `Statewide normal rain peaks in ${MOL[HZ.rain.indexOf(Math.max(...HZ.rain))]} and all but stops in ${MOL[HZ.rain.indexOf(Math.min(...HZ.rain))]} (roof weighted mean of the regions' station normals). ` : 'The data carries no rain normals by month, so the rain led rows are flat. '}Leak repairs peak in ${pk('repair')}, storm work in ${pk('storm')}; reroofs are lowest in ${lo('replace')} and coatings peak in ${pk('coat')}. Fire work peaks in ${pk('fire')}. The regions differ: the north coast is wet for seven months, the desert for none, and module 12 shows each region's own year. Rows computed from the weather record are graded C or B; planning shapes are D until your own job history replaces them.`;
      // hour
      const HH = HZ.hour; const hs = [['wind', 'High wind', lineColor('storm')], ['rain', 'Heavy rain and flood', ramp('teal')[5]], ['fire', 'Fire', lineColor('fire')], ['hail', 'Hail', ramp('lime')[5]], ['tstm', 'Thunderstorm', ramp('lime')[7]]].filter(r => HH[r[0]]);
      if (hs.length) { lineChart($('#d4Hour', root), { series: hs.map(([k, n, c], i) => ({ name: n, color: c, pts: HH[k].map((v, h) => [h, v]), area: i === 0, fmt: v => N(v) })), x: { ticks: [0, 3, 6, 9, 12, 15, 18, 21], fmt: v => hrLab(v).replace(' a.m.', 'a').replace(' p.m.', 'p') }, y: { label: 'Reports', zero: true }, H: 240, W: 620, tipTitle: v => hrLab(v), aria: 'Reports by hour' }); $('#d4HourLeg', root).innerHTML = legendRow(hs.map(([, n, c]) => ({ name: n, color: c })));
        const ngt = a => (sum(a.slice(20)) + sum(a.slice(0, 6))) / (sum(a) || 1) * 100; $('#d4HourN', root).innerHTML = `${hs.map(([k, n]) => `${n}: ${P(ngt(HH[k]), 0)} of reports between 8 p.m. and 6 a.m.`).join('. ')}. California's roof weather keeps no office hours: fronts and atmospheric rivers run through the night and offshore wind peaks before dawn, so the damage is found at first light. Staff the phones and the emergency ad groups for the early morning.`; }
      else { $('#d4Hour', root).innerHTML = '<p class="mini">The hazard record in this build carries no reports by hour.</p>'; $('#d4HourN', root).innerHTML = ''; }
    }
    drawCharts();
    const E = META.econ22 || CA_FACTS.econ22; const CBP = META.cbp || {}; const NES = META.nes || {}; const PC = DATA.permits_city || {};
    const pcRow = c => { const y = (PC[c] || {}).years || {}; const ks = Object.keys(y).map(Number).filter(v => v <= 2025).sort((a, b) => a - b); return ks.length ? `${N(y[ks[ks.length - 1]])} in ${ks[ks.length - 1]}${ks.length > 3 ? `, ${N(y[ks[ks.length - 3]])} in ${ks[ks.length - 3]}` : ''}` : null; };
    $('#d4Mkt', root).innerHTML = `<div class="split" style="margin-top:0"><div>
      <div class="rowl"><span>Revenue of California roofing contractors, 2022</span><b>${MM(E.rcpt)}</b></div>
      <div class="rowl"><span>Firms · establishments · employees</span><b>${N(E.firm)} · ${N(E.estab)} · ${N(E.emp)}</b></div>
      <div class="rowl"><span>Payroll · materials · work subcontracted out (share of revenue)</span><b>${P(E.pay / E.rcpt * 100, 1)} · ${P(E.mat / E.rcpt * 100, 0)} · ${P(E.sub / E.rcpt * 100, 1)}</b></div>
      <div class="rowl"><span>Revenue per establishment · per employee</span><b>${MM(E.rcpt / E.estab)} · ${MM(E.rcpt / E.emp)}</b></div>
      <div class="rowl"><span>California's share of United States roofing revenue</span><b>${P(E.rcpt / E.us * 100, 1)}</b></div>
      <p class="mini" style="margin-top:6px">2022 Economic Census, NAICS 238160 (table EC2223BASIC). ${G('A')}</p></div><div>
      <div class="rowl"><span>Employer establishments · employees, 2023 (County Business Patterns)</span><b>${N(CBP.est)} · ${N(CBP.emp)}</b></div>
      <div class="rowl"><span>Firms without employees, foundation and exterior trades, 2024 · receipts</span><b>${N(NES.est2381)} · ${isN(NES.rcpt2381) ? MM(NES.rcpt2381 * 1000) : '—'}</b></div>
      <div class="rowl"><span>C-39 roofing licenses on the renewed roll · active · C-39 alone</span><b>${N(LIC.n)} · ${N(LIC.clear)} · ${N(LIC.only)}</b></div>
      ${Object.keys(PC).map(c => pcRow(c) ? `<div class="rowl"><span>Re-roof permits, ${esc(c)}</span><b>${pcRow(c)}</b></div>` : '').join('')}
      <div class="rowl"><span>The model's gross profit pool · implied revenue at the default margin</span><b>${MM(META.fees_tot)} · ${MM(META.fees_tot / Math.max(0.01, META.model.FEE || 0.33))}</b></div>
      <p class="mini" style="margin-top:6px">Business Patterns and Nonemployer Statistics (the nonemployer code 2381 covers roofing with framing, masonry, siding and glass, so it bounds the one person roofers and does not count them); CSLB, November 2026; the cities' open permit data. ${G('A')}</p></div></div>
      <p class="chartnote">Read the last row against the first: the model's pool is the gross profit on jobs <i>open to marketing</i>, so its implied revenue should sit below the Census revenue, which also holds repeat, builder and public work. If it sits above, the default tickets or the open shares in module 12 are too generous for your market. Licenses outnumber employer establishments about two to one: roughly half the licenses belong to firms with no payroll or to firms whose main trade is something else.</p>`;
    $('#d4Mean', root).innerHTML = proseTable([
      ['<b>Sell the clock, not the storm</b>', 'Replacement demand follows the decade a tract was built. Fund replacement and tile campaigns in the ZIPs where roofs aged 15 to 19 and tile underlayment past 25 years concentrate (module 17), with inspections and financing as the offer. Nobody is waiting for an adjuster.'],
      ['<b>Use the wet season twice</b>', 'From November to March leak and storm calls arrive on their own: answer fast, repair, and document the roof. The same visit is the best lead for a dry season reroof or relay. Budget emergency search for the winter and planned purchase search for late winter through summer.'],
      ['<b>Meet the insurance letter</b>', 'In fire zone and high FAIR Plan ZIPs the buying moment is a non-renewal notice or an inspection. A page that explains what an insurer looks for in a roof (age, Class A, vents, gutters), a fast written report, and the fire hardened roof line catch owners at that moment. Describe the process; do not interpret anyone\'s policy or promise a discount.'],
      ['<b>Tile is its own business</b>', 'Lift and relay needs crews who can handle tile without breaking a third of it, and copy that says the tile stays. Aim it at the 1980s and 1990s tracts of the Inland Empire, Orange County, the Sacramento suburbs and the Central Valley, where the model puts the most tile past 25 years.'],
      ['<b>Go where the roofers are not</b>', 'Licenses follow population, not fire zones or rain. Foothill and mountain ZIPs with old roofs and few local licenses are the opening for a regional company with a local address and a license number on every ad; module 07 maps the field.'],
      ['<b>After a fire, slow down</b>', 'Rebuild roofing runs for years, under a seven business day right to cancel, a 10 percent price cap for 180 days after the declaration and felony exposure for unlicensed work in the disaster area. Build pages and relationships with builders, not a tent in the parking lot.'],
    ]);
    const ASSUME = META.assume || [];
    $('#d4Int', root).innerHTML = proseTable([
      ['Which ZIPs are in', `One row per populated 2020 ZIP Code Tabulation Area whose largest land share is in California and where the ACS shows one resident or more: ${N(META.nzip || Z.length)} rows. Areas that are mostly Nevada or Oregon are out. Model columns are blank under 500 residents (${N(ZR.length)} ZIPs are scored).`],
      ['County of a ZIP', 'A ZIP that crosses a county line is given to the county with its largest land share; the data keeps the number of counties each ZIP touches.'],
      ['ACS medians the Census cannot estimate', 'Published as large negative codes; set to missing before any average, rate or regression.'],
      ['One unit homes by decade', 'The roof model needs one unit homes by decade built. The ACS publishes them in six wide year bands by tenure; each band was split into decades in proportion to all homes by decade in the same ZIP, then scaled to the one unit total.'],
      ['Roof covering', 'No file records what covers each roof. Tile, wood and metal shares are the 2020 Residential Energy Consumption Survey\'s California sample by era built (837 single family homes), with a climate factor by region for tile, rescaled to the survey\'s statewide shares. Grade D.'],
      ['Two roof clocks', `Roofs other than tile wear on a Weibull life with a mean of ${D((WB || {}).L, 1)} years (shape ${D((WB || {}).k, 2)}), refitted to the American Housing Survey West region replacement rates by year built, net of the jobs insurance paid for. Tile wears on the life of its underlayment (mean ${D((WBT || {}).L, 1)} years), after which the same tile goes back. For a tile roof every age in the atlas is the age of the underlayment.`],
      ['No storm reset', 'The first edition of this model reset roofs after every hurricane. California\'s has one reset only: structures CAL FIRE recorded as destroyed leave the stock in the fire year and re enter as new roofs over the next four years.'],
      ['FEMA\'s roof flag', 'FEMA\'s roof damage field is empty for every registration from 2020 on. Verified real property loss without flood damage stands in from 2020; the COVID declaration is left out everywhere. Owner and insurance counts in the yearly table are counted on all registrations, not only the damaged ones.'],
      ['Non-renewals', 'The Department of Insurance file for 2020 to 2023 does not separate the insurer\'s decision from the owner\'s; the 2015 to 2021 file does, so insurer initiated non-renewals stop at 2021.'],
      ['Licenses', 'C-39 licenses are counted at their mailing ZIP, whole numbers, active and unsuspended. Competition near a ZIP counts licenses within 25 km and a distance weighted sum. The first edition counted named company offices; California has no public list of roofers by size.'],
      ['Business Patterns', 'ZIP cells under three establishments are withheld, so small towns read zero roofers; postal ZIPs that are not tabulation areas are counted in county totals only. State totals use the county file.'],
      ['Weather columns', 'Rain, heat and gust days come from the nearest stations to each ZIP\'s town point, with distance weighted for elevation difference and for distance from the coast, because a coastal station says little about a canyon ten miles inland.'],
      ['Zero rates', 'A California ZIP can have a rate of zero on the fire line; 0.01 is added before the logarithm so the index can still be computed.'],
      ['Housing survey reach', 'The survey samples Los Angeles, San Francisco and Riverside in 2023 and San Jose in 2021. San Diego and Sacramento take the Pacific division figures.'],
    ].concat(ASSUME.map((s, i) => [`Assumption ${i + 1}`, esc(s)])));
    const SRCS = META.src || [];
    $('#d4Src', root).innerHTML = proseTable([
      ['Weights', 'ZIPs are weighted by homes so a small ZIP\'s noisy rate counts less.'],
      ['Logs', 'Outcomes, density and income are logged because they are skewed; ZIPs with a zero outcome are set to half the smallest observed rate. Coefficients are in standard deviations.'],
      ['Observed outcomes only', 'The modeled job counts are not used as outcomes here, because they are built from these same predictors; FAIR Plan policies, non-renewals, FEMA registrations and licenses are observed.'],
      ['Missing predictor values', 'A ZIP with one missing predictor takes the mean for that predictor, so it is not dropped.'],
      ['Ecology', 'Associations between ZIP averages do not describe individual homeowners.'],
      ['Typed figures', 'The Economic Census totals and the west south central insurance share are typed from the evidence file, with their table named beside them; every other figure on this page is computed from the embedded data.'],
    ]) + (SRCS.length ? srcRows(SRCS.map(s => [esc(s.k || ''), esc(s.name || ''), s.grade || '', esc(s.vintage || ''), s.url || ''])) : srcRows([
      ['Insurance', 'California FAIR Plan Association ZIP files; California Department of Insurance non-renewal and wildfire risk files', 'A', '2026', 'https://www.insurance.ca.gov/'],
      ['Licenses', 'Contractors State License Board, C-39 list by classification', 'A', 'November 2026', 'https://www.cslb.ca.gov/'],
      ['Housing survey', 'American Housing Survey 2023 national and 2021 metropolitan public use files', 'A', '2023', 'https://www2.census.gov/programs-surveys/ahs/2023/'],
      ['Market size', '2022 Economic Census; County Business Patterns 2023; Nonemployer Statistics 2024', 'A', '2022 to 2024', 'https://www.census.gov/'],
      ['Predictors', 'ACS 2020 to 2024; CAL FIRE Fire Hazard Severity Zones; NOAA normals and station records', 'A', '2026', 'https://www.census.gov/'],
    ]));
    $('#d4Foot', root).innerHTML = `<b style="color:var(--ink)">${ATLAS.name}</b>, module 04. Regressions computed in the page from the embedded ZIP data. Compiled ${COMPILED}.`;
    if (st.y) wireSeg($('#d4Y', root), v => { st.y = v; drawReg(); });
    $('#d4Csv', root).onclick = () => saveFile(`${ATLAS.file}-zip-demand-predictors.csv`, toCSV(['zip', 'city', 'county', 'homes'].concat(PRED.map(p => p[0])).concat(Object.keys(OUT)), ZD.map((z, i) => [z.zip, z.city, z.cty, z.hu].concat(Xraw.map(c => +D(c[i], 4))).concat(Object.values(OUT).map(o => isN(o.f(z)) ? +D(o.f(z), 3) : ''))), `${ATLAS.name}, module 04. Raw predictor values (logs as labeled) and observed outcomes.`));
    $('#d4Ts', root).onclick = () => saveFile(`${ATLAS.file}-roofing-seasons.csv`, toCSV(['month', 'normal_rain_in'].concat(LINE_KEYS.map(k => k + '_index')), MO3.map((m, i) => [m, HZ.rain ? +D(HZ.rain[i], 2) : ''].concat(LINE_KEYS.map(k => SLM.SEA[k][i]))), 'Seasonal indexes from the service line model (average month = 100) and statewide normal rain by month.'));
    BUS.on('theme', () => { drawReg(); drawCharts(); });
  }
});
