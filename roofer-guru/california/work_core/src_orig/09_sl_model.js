/* ==== 09_sl_model.js ==== */
/* ==== service line model (keeps the SLM interface the connectors expect) ==== */
"use strict";
const SLM = (() => {
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const BLOCKS = ['12a to 6a', '6a to 9a', '9a to 12p', '12p to 5p', '5p to 9p', '9p to 12a'];
  /* hour blocks as bid adjustment percentages (assumptions until account actuals replace them) */
  const DAYPARTS = { emergency: [10, 15, 15, 10, 15, 5], retail: [-40, 0, 15, 10, 15, -10], b2b: [-60, 5, 25, 20, -20, -50] };
  DAYPARTS.crash = DAYPARTS.emergency;
  /* monthly shape from the data where it exists: storm events spread over the month they happen and the two after (40, 35, 25 percent) */
  const norm12 = a => { const m = mean(a) || 1; return a.map(v => Math.round(100 * v / m)); };
  const lag = a => a.map((_, i) => 0.40 * a[i] + 0.35 * a[(i + 11) % 12] + 0.25 * a[(i + 10) % 12]);
  const TM = DATA.ts.month; const TROP = DATA.ts.trop_month;
  const tropN = norm12(TROP.map(v => v + 0.2)), windN = norm12(TM.wind), tornN = norm12(TM.torn);
  const RAIN = [5.4, 4.6, 4.6, 4.9, 5.1, 6.1, 5.9, 5.6, 4.6, 4.1, 4.2, 5.0];   /* Louisiana statewide normal precipitation, inches (NOAA 1991 to 2020, rounded) */
  const SEA = {
    replace: [82, 86, 104, 110, 110, 100, 95, 95, 100, 110, 106, 82],
    repair: norm12(RAIN.map((r, i) => r * 0.7 + (windN[i] / 100) * 1.5)),
    storm: norm12(lag(tropN.map((t, i) => 0.7 * t + 0.25 * windN[i] + 0.05 * tornN[i]))),
    hail: norm12(lag(TM.hail)),
    fortified: [70, 70, 85, 95, 105, 120, 120, 115, 110, 110, 100, 100],
    metal: [82, 86, 104, 110, 110, 100, 95, 95, 100, 110, 106, 82],
    mh: norm12(lag(tropN.map((t, i) => 0.4 * t + 0.4 * windN[i] + 0.2 * 100 * RAIN[i] / 5))),
    mf: [95, 100, 105, 105, 105, 100, 100, 100, 100, 100, 95, 95],
    comm: [90, 95, 105, 105, 105, 100, 100, 100, 105, 105, 100, 90],
    coat: [80, 85, 100, 110, 115, 110, 105, 105, 105, 105, 95, 80],
    newc: [90, 90, 105, 105, 105, 105, 100, 100, 100, 100, 100, 100],
  };
  const SEA_G = { replace: 'D', repair: 'C', storm: 'B', hail: 'B', fortified: 'D', metal: 'D', mh: 'C', mf: 'D', comm: 'D', coat: 'D', newc: 'D' };
  const M = META.model;
  const DEF = {
    cpc: 38, budget: 15000, alpha: 1.2, fee: M.FEE,
    lines: {
      replace: { rep: M.REP.replace, val: M.VAL.replace, cpcMul: 1.0, cvr: 9.0, close: 25 },
      repair: { rep: M.REP.repair, val: M.VAL.repair, cpcMul: 0.65, cvr: 12.0, close: 55 },
      storm: { rep: M.REP.storm, val: M.VAL.storm, cpcMul: 1.25, cvr: 12.0, close: 30 },
      hail: { rep: M.REP.hail, val: M.VAL.hail, cpcMul: 1.2, cvr: 10.0, close: 28 },
      fortified: { rep: M.REP.fortified, val: M.VAL.fortified, cpcMul: 0.55, cvr: 8.0, close: 35 },
      metal: { rep: M.REP.metal, val: M.VAL.metal, cpcMul: 0.75, cvr: 7.0, close: 20 },
      mh: { rep: M.REP.mh, val: M.VAL.mh, cpcMul: 0.45, cvr: 11.0, close: 35 },
      mf: { rep: M.REP.mf, val: M.VAL.mf, cpcMul: 0.8, cvr: 5.0, close: 15 },
      comm: { rep: M.REP.comm, val: M.VAL.comm, cpcMul: 1.1, cvr: 5.0, close: 12 },
      coat: { rep: M.REP.coat, val: M.VAL.coat, cpcMul: 0.7, cvr: 6.0, close: 18 },
      newc: { rep: M.REP.newc, val: M.VAL.newc, cpcMul: 0.5, cvr: 4.0, close: 10 },
    },
  };
  const KEY = 'up.slm.v1';
  const A = JSON.parse(JSON.stringify(DEF)); (() => { const s = store.get(KEY, null); if (s && typeof s === 'object') { Object.keys(s).forEach(k => { if (k === 'lines') Object.keys(s.lines || {}).forEach(l => { if (A.lines[l]) Object.assign(A.lines[l], s.lines[l]); }); else A[k] = s[k]; }); } })();
  const LINES = PL.map(l => Object.assign({}, l, { months: SEA[l.key], mg: SEA_G[l.key], dayparts: ['storm', 'repair', 'mh'].includes(l.key) ? 'emergency' : ['comm', 'coat', 'mf', 'newc'].includes(l.key) ? 'b2b' : 'retail' }));
  const LI = {}; LINES.forEach(l => LI[l.key] = l);
  function set(patch) { if (!patch) return; Object.keys(patch).forEach(k => { if (k === 'lines') Object.keys(patch.lines || {}).forEach(l => { if (A.lines[l]) Object.assign(A.lines[l], patch.lines[l]); }); else A[k] = patch[k]; }); store.set(KEY, A); topLines(); BUS.emit('slm'); }
  function reset() { const d = JSON.parse(JSON.stringify(DEF)); Object.keys(A).forEach(k => delete A[k]); Object.assign(A, d); store.set(KEY, A); topLines(); BUS.emit('slm'); }
  /* unit economics for a line at a ZIP's relative cost: cost per lead, cost per sold job, gross profit per job and its ratio to cost */
  function blended(L, z) { const p = A.lines[L.key]; const cpc = A.cpc * p.cpcMul * (z && isN(z.cpc_rel) ? z.cpc_rel : 1); const cvr = p.cvr / 100; const close = p.close / 100; const cpl = cpc / cvr; const cps = cpl / close; const feeCase = p.val * A.fee; return { cpc, cvr: p.cvr, cpl, close: p.close, cps, feeCase, roi: feeCase / cps }; }
  /* a ZIP's annual jobs, the jobs open to marketing, and the gross profit pool for a line under the current assumptions */
  function zipLine(z, k) { const p = A.lines[k]; const pool = z['p_' + k] || 0; const cases = pool * p.rep; return { pool, cases, fees: cases * p.val * A.fee, rev: cases * p.val, rate: z['r_' + k] }; }
  function zipAll(z, keys) { keys = keys || LINE_KEYS; let pool = 0, cases = 0, fees = 0, rev = 0; keys.forEach(k => { const o = zipLine(z, k); pool += o.pool; cases += o.cases; fees += o.fees; rev += o.rev; }); return { pool, cases, fees, rev }; }
  /* budget allocation: share of budget proportional to (gross profit pool / relative cost) ^ alpha across the chosen ZIPs */
  function allocate(budget, keys, zips, alpha) { alpha = alpha == null ? A.alpha : alpha; const w = zips.map(z => { const f = zipAll(z, keys).fees; return Math.pow(Math.max(0, f) / Math.max(0.3, z.cpc_rel || 1), alpha); }); const s = sum(w) || 1; return zips.map((z, i) => ({ zip: z.zip, z, w: w[i] / s, budget: budget * w[i] / s })); }
  function unitEcon(k) { return blended(LI[k], null); }
  function seasonFor(k) { return (LI[k] || LI.replace).months; }
  const lineName = k => (LI[k] || {}).name || (k === 'unmapped' ? 'Unmapped' : k);
  /* top line by gross profit pool for each ZIP (used by the accounts module) */
  function topLines() { Z.forEach(z => { let best = null, bv = -1; LINE_KEYS.forEach(k => { const v = zipLine(z, k).fees; if (v > bv) { bv = v; best = k; } }); z.sl_top = best; }); }
  topLines();
  function layers() {
    const out = {};
    LINES.forEach(l => {
      out['r_' + l.key] = { l: `${l.name}: jobs per 10,000 residents a year`, grp: 'Service line rates', dir: 1, ramp: 'green', g: l.g, f: v => D(v, 1), note: `${l.unit}, per 10,000 residents, shrunk toward the parish rate for small ZIPs (prior of 2,500 residents). ${l.what}` };
      out['p_' + l.key] = { l: `${l.name}: jobs a year (count)`, grp: 'Service line volume', dir: 1, ramp: 'green', g: l.g, f: v => v < 10 ? D(v, 1) : N(v), note: `${l.unit}. Volume, not rate: large ZIPs shade darker.` };
    });
    return out;
  }
  return { A, DEF, LINES, LI, MONTHS, BLOCKS, DAYPARTS, SEA, SEA_G, set, reset, blended, zipLine, zipAll, allocate, unitEcon, seasonFor, lineName, layers };
})();
