/* ==== 09_sl_model.js ==== */
/* ==== service line model (keeps the SLM interface the connectors expect) ==== */
"use strict";
/* ---- hazard time series, read once for every module (names as HAZARD_SCHEMA.md section 3 fixes them) ----
   The data ships ts.month, ts.hour and ts.year empty until the hazard files are merged, so every series here is either
   twelve (or twenty four) numbers or null, and every reader tests before it draws.
   HZ.month.<role>  twelve numbers by calendar month, January first, or null
       ar        atmospheric river days at a coast point (ts.month.ar_days; else AR1 to AR5 landfalls summed)
       wind      Storm Events High Wind records (hw), else measured gusts of 58 mph or more (g58)
       offshore  Santa Ana days by month (sa_days, Scripps regional index 1948 to 2018)
       fire      structures destroyed by month of the fire (fire_dest), else perimeters started (fire_n), else wfire records
       rainev    heavy rain, flood and flash flood records summed
   HZ.rain          statewide normal precipitation by month, inches (ts.rain.state)
   HZ.rainR[reg]    the same for each region number 1 to 11 (ts.rain.reg by two letter key)
   HZ.hour.<role>   twenty four numbers by Pacific Standard Time hour, or null (wind = g58, rain = fflood, hail, tstm = tsw) */
const HZ = (() => {
  const TS = DATA.ts || {}; const TM = TS.month || {}; const TH = TS.hour || {};
  const ok = (a, n) => Array.isArray(a) && a.length === n && a.some(v => +v > 0) ? a.map(v => +v || 0) : null;
  const pick = (o, n, names) => { for (const k of names) { const a = ok(o[k], n); if (a) return a; } return null; };
  const addv = (o, n, names) => { const vs = names.map(k => ok(o[k], n)).filter(Boolean); return vs.length ? Array.from({ length: n }, (_, i) => sum(vs.map(a => a[i]))) : null; };
  const month = {
    ar: pick(TM, 12, ['ar_days']) || addv(TM, 12, ['ar1', 'ar2', 'ar3', 'ar4', 'ar5']),
    wind: pick(TM, 12, ['hw', 'g58', 'sw']),
    offshore: pick(TM, 12, ['sa_days']),
    fire: pick(TM, 12, ['fire_dest', 'fire_n', 'wfire']),
    rainev: addv(TM, 12, ['hrain', 'flood', 'fflood', 'debris']),
    hail: pick(TM, 12, ['hail']), heat: addv(TM, 12, ['xheat', 'heat']), snow: addv(TM, 12, ['hsnow', 'wstorm']), tstm: pick(TM, 12, ['tsw', 'wind']),
  };
  const RR = TS.rain || {}; const rainR = {}; const byKey = RR.reg || {};
  REG_KEYS.forEach(r => { const a = ok(byKey[REGK[r]] || byKey[r] || byKey[String(r)], 12); if (a) rainR[r] = a; });
  const wR = {}; Z.forEach(z => { const r = PA[z.pi] ? PA[z.pi].reg : z.reg; wR[r] = (wR[r] || 0) + (z.hu || 0); });
  let rain = ok(RR.state, 12);
  if (!rain && Object.keys(rainR).length) { const ks = Object.keys(rainR); const ws = sum(ks.map(r => wR[r] || 1)); rain = Array.from({ length: 12 }, (_, m) => sum(ks.map(r => rainR[r][m] * (wR[r] || 1))) / ws); }
  const belts = { north: ok(RR.north, 12), central: ok(RR.central, 12), south: ok(RR.south, 12) };
  const hour = { wind: pick(TH, 24, ['g58', 'hw']), rain: pick(TH, 24, ['fflood', 'hrain']), fire: pick(TH, 24, ['fire', 'wfire']), hail: pick(TH, 24, ['hail']), tstm: pick(TH, 24, ['tsw', 'wind']) };
  { const hs = [hour.wind, hour.rain, hour.fire, hour.hail, hour.tstm].filter(Boolean); hour.all = hs.length ? Array.from({ length: 24 }, (_, h) => sum(hs.map(a => a[h]))) : null; }
  return { month, rain, rainR, belts, hour, has: k => !!month[k], wetShare: a => a ? sum([10, 11, 0, 1, 2].map(i => a[i])) / (sum(a) || 1) * 100 : null };
})();
/* ---- hazard ZIP columns by role. The hazard data names them (HAZARD_SCHEMA.md); each role lists the names it may carry,
   first match wins, and a role with no column in the data is null, so every reader tests before it draws. ---- */
const zcol = (...names) => names.find(n => ZC.includes(n)) || null;
const HC = {
  gust: zcol('g58'), gust40: zcol('g40'), gust75: zcol('g75'), lsr58: zcol('wd58'), hw: zcol('hw_yr'),
  ar: zcol('ar_days', 'ar_d'), ar3: zcol('ar3_d'), rain: zcol('rain_in'), rain1: zcol('rain_d1'), rain2: zcol('rain_d2'),
  off: zcol('off_cls'), sa: zcol('sa_days'),
  fhsz: zcol('fhsz_sh'), fhszvh: zcol('fhsz_vh'), dest: zcol('fire_dest'), dmg: zcol('fire_dmg'), burn: zcol('burn_sh'),
  snow: zcol('snow_psf'), heat: zcol('h100'), heat90: zcol('h90'), hail: zcol('hail1_n25'),
  coast: zcol('coast_km'), elev: zcol('elev_pt_m'), solar: zcol('solar_sh'), stress: zcol('stress'),
};
/* what HC.ar counts, in words: the data carries AR2 or stronger days when the hazard merge is complete, all ranks until then */
const AR_WORDS = HC.ar === 'ar_days' ? 'AR2 or stronger' : 'all ranks';
const OFF_WORDS = { sa: 'Santa Ana', di: 'Diablo', su: 'sundowner' };
const SLM = (() => {
  const MONTHS = MO3.slice();
  const BLOCKS = ['12a to 6a', '6a to 9a', '9a to 12p', '12p to 5p', '5p to 9p', '9p to 12a'];
  /* Hour blocks as bid adjustment percentages (assumptions until account actuals replace them).
     SHAPE, for every reader: DAYPARTS[template] is ONE FLAT ROW of six numbers, one per entry of BLOCKS, the same for
     every day of the week. It is not a seven by six grid: ACCT.observedGrid() returns that, and a reader that wants a
     grid from a template calls SLM.daypartGrid(template), which repeats the row seven times. */
  const DAYPARTS = { emergency: [10, 15, 15, 10, 15, 5], retail: [-40, 0, 15, 10, 15, -10], b2b: [-60, 5, 25, 20, -20, -50] };
  const daypartGrid = t => Array.from({ length: 7 }, () => (DAYPARTS[t] || DAYPARTS.retail).slice());
  const blockOf = hr => hr < 6 ? 0 : hr < 9 ? 1 : hr < 12 ? 2 : hr < 17 ? 3 : hr < 21 ? 4 : 5;
  const norm12 = a => { const m = mean(a) || 1; return a.map(v => Math.round(100 * v / m)); };
  /* work follows weather: the month it happens and the two after (40, 35, 25 percent), as in the first edition */
  const lag = a => a.map((_, i) => 0.40 * a[i] + 0.35 * a[(i + 11) % 12] + 0.25 * a[(i + 10) % 12]);
  /* leaks are found the month it rains and the month after (60, 40 percent) */
  const lag2 = a => a.map((_, i) => 0.60 * a[i] + 0.40 * a[(i + 11) % 12]);
  const sh = a => { const t = sum(a) || 1; return a.map(v => v * 12 / t); };          /* a vector rescaled so its mean is 1 */
  const FLAT = Array(12).fill(1);
  /* California's year, built from the hazard data: the wet season (November to March) drives leaks and storm work;
     offshore wind (Santa Ana and Diablo) peaks in autumn and winter; fire losses follow the dry season; coatings and
     reroofs want dry weather. Where the data lacks a series its part falls back to an even year and the grade drops. */
  function seasons(rainIn) {
    const rain = rainIn ? sh(rainIn) : null, R = rain || FLAT;
    const ar = HZ.month.ar ? sh(HZ.month.ar) : R, wind = HZ.month.wind ? sh(HZ.month.wind) : (HZ.month.offshore ? sh(HZ.month.offshore) : R);
    const off = HZ.month.offshore ? sh(HZ.month.offshore) : wind, fire = HZ.month.fire ? sh(HZ.month.fire) : null;
    const rmax = Math.max(...R) || 1; const dry = R.map(v => 1 - 0.6 * v / rmax);                /* dry weather index: 1 in a rainless month, 0.4 in the wettest */
    const hol = [0.95, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0.97, 0.88];                                    /* holiday slack, an assumption */
    const reroof = norm12(dry.map((v, i) => v * hol[i]));
    const S = {
      replace: reroof,
      repair: norm12(lag2(R.map((v, i) => 0.8 * v + 0.2 * wind[i]))),
      storm: norm12(lag(ar.map((v, i) => 0.55 * v + 0.30 * wind[i] + 0.15 * off[i]))),
      fire: fire ? norm12(lag(fire)) : [70, 65, 65, 70, 80, 95, 115, 130, 135, 140, 125, 110],
      harden: [85, 90, 100, 110, 118, 120, 112, 105, 100, 95, 85, 80],
      tile: norm12(dry.map((v, i) => (0.75 * v + 0.25 * lag2(R)[i] / (Math.max(...lag2(R)) || 1)) * hol[i])),
      solar: reroof,
      metal: reroof,
      mh: norm12(lag2(R.map((v, i) => 0.6 * v + 0.4 * wind[i])).map(v => 0.6 * v + 0.4)),
      mf: [95, 95, 100, 104, 105, 105, 104, 104, 104, 102, 96, 86],
      comm: norm12(dry.map((v, i) => (0.5 + 0.5 * v) * hol[i])),
      coat: norm12(dry.map(v => Math.pow(v, 1.6))),
      newc: [92, 92, 100, 104, 106, 106, 104, 104, 102, 102, 98, 90],
    };
    return S;
  }
  const SEA = seasons(HZ.rain);
  const SEA_R = {}; REG_KEYS.forEach(r => { SEA_R[r] = HZ.rainR[r] ? seasons(HZ.rainR[r]) : SEA; });
  const hasRain = !!HZ.rain;
  /* grades: C where the shape is computed from the hazard record, D where it is a planning shape */
  const SEA_G = { replace: 'D', repair: hasRain ? 'C' : 'D', storm: HZ.month.ar || HZ.month.wind ? 'B' : (hasRain ? 'C' : 'D'), fire: HZ.month.fire ? 'C' : 'D', harden: 'D', tile: 'D', solar: 'D', metal: 'D', mh: hasRain ? 'C' : 'D', mf: 'D', comm: 'D', coat: 'D', newc: 'D' };
  /* where each row comes from, in words, for the notes that print it */
  const SEA_SRC = {
    replace: 'dry weather index from normal rain by month (a reroof wants a dry week), with a holiday dip; the weights are assumptions',
    repair: 'normal rain by month (80 percent) and high wind (20 percent), the month it happens and the month after',
    storm: 'atmospheric river days (55 percent), high wind (30 percent) and offshore wind (15 percent), spread over the month and the two after',
    fire: HZ.month.fire ? 'structures lost to wildfire by month, spread over the month and the two after; rebuilds themselves run for years' : 'a planning shape for the fire season; the data carries no monthly fire series',
    harden: 'a planning shape: owners act before fire season and at insurance renewal; no monthly evidence was found',
    tile: 'dry weather index, lifted in the wet months when a failed underlayment shows itself; the weights are assumptions',
    solar: 'follows the reroof it is part of', metal: 'follows the reroof season',
    mh: 'rain and wind, the month it happens and the month after, on a steady base',
    mf: 'a planning shape for budget years and dry months', comm: 'dry weather index on a steady base', coat: 'dry weather index, sharpened: coatings need dry, warm days to cure', newc: 'a planning shape for the building season',
  };
  const M = META.model; const REP = M.REP || {}, VAL = M.VAL || {};
  /* Paid search defaults. None of the click, lead or close figures is California evidence: no auction, keyword or
     account data was pulled for this build, and the evidence files hold no California click cost. The base click cost
     and the figures of the nine lines Louisiana also had are carried from that edition's planning figures; the four
     new lines are set beside the nearest of those (BASIS says which). All are grade D until account actuals replace
     them in module 15. */
  const LDEF = {
    replace: { cpcMul: 1.0, cvr: 9.0, close: 25 }, repair: { cpcMul: 0.65, cvr: 12.0, close: 55 }, storm: { cpcMul: 1.25, cvr: 12.0, close: 30 },
    fire: { cpcMul: 1.1, cvr: 8.0, close: 25 }, harden: { cpcMul: 0.55, cvr: 8.0, close: 35 }, tile: { cpcMul: 0.9, cvr: 9.0, close: 25 }, solar: { cpcMul: 0.7, cvr: 8.0, close: 30 },
    metal: { cpcMul: 0.75, cvr: 7.0, close: 20 }, mh: { cpcMul: 0.45, cvr: 11.0, close: 35 }, mf: { cpcMul: 0.8, cvr: 5.0, close: 15 }, comm: { cpcMul: 1.1, cvr: 5.0, close: 12 }, coat: { cpcMul: 0.7, cvr: 6.0, close: 18 }, newc: { cpcMul: 0.5, cvr: 4.0, close: 10 },
  };
  const BASIS = {
    cpc: 'Base cost per click: a planning figure carried from the first edition of this atlas (another state). No California auction or keyword data was pulled, so it is an assumption, grade D.',
    budget: 'Monthly budget: a round planning figure.', alpha: 'Concentration exponent: a choice; above 1 it concentrates money in the strongest ZIPs and lines.',
    fee: 'Gross margin: the data build\'s planning figure (meta.model.FEE). The 2022 Economic Census puts materials at 34 percent and payroll at 26 percent of California roofing revenue, which bounds it but does not measure it.',
    lines: {
      replace: 'carried from the first edition', repair: 'carried from the first edition', storm: 'carried from the first edition\'s storm line; California storm work is rarely claim funded, so the close rate may run lower',
      fire: 'no evidence; set beside the storm line with a lower lead rate (rebuilds are long, insurer led sales)', harden: 'no evidence; set at the first edition\'s figures for an upgrade roof bought for insurance reasons',
      tile: 'no evidence; set beside replacement with a slightly lower click cost', solar: 'no evidence; set between repair and replacement (the buyer already needs the reroof)',
      metal: 'carried from the first edition', mh: 'carried from the first edition', mf: 'carried from the first edition', comm: 'carried from the first edition', coat: 'carried from the first edition', newc: 'carried from the first edition',
    },
  };
  const DEF = { cpc: 38, budget: 15000, alpha: 1.2, fee: isN(M.FEE) ? M.FEE : 0.33, lines: {} };
  LINE_KEYS.forEach(k => { const d = LDEF[k] || { cpcMul: 1, cvr: 8, close: 25 }; DEF.lines[k] = { rep: isN(REP[k]) ? REP[k] : 0.5, val: isN(VAL[k]) ? VAL[k] : 0, cpcMul: d.cpcMul, cvr: d.cvr, close: d.close }; });
  const KEY = 'cg.slm.v1';
  const A = JSON.parse(JSON.stringify(DEF)); (() => { const s = store.get(KEY, null); if (s && typeof s === 'object') { Object.keys(s).forEach(k => { if (k === 'lines') Object.keys(s.lines || {}).forEach(l => { if (A.lines[l]) Object.assign(A.lines[l], s.lines[l]); }); else A[k] = s[k]; }); } })();
  /* line records: the content file's entry (PL) where it has the line, a plain stand in where it does not, so the model
     always carries exactly the thirteen lines in order */
  const NAME0 = { replace: ['Roof replacement', 'Replacement'], repair: ['Leaks and repairs', 'Repair'], storm: ['Wind and rain damage', 'Storm'], fire: ['Wildfire damage and rebuild roofing', 'Fire'], harden: ['Fire hardened roof', 'Harden'], tile: ['Tile lift and relay', 'Tile'], solar: ['Solar detach and reset', 'Solar'], metal: ['Metal roofing', 'Metal'], mh: ['Manufactured homes', 'Manufactured'], mf: ['Multifamily', 'Multifamily'], comm: ['Commercial', 'Commercial'], coat: ['Coatings', 'Coatings'], newc: ['New construction', 'New build'] };
  const PLX = {}; (typeof PL !== 'undefined' && Array.isArray(PL) ? PL : []).forEach(l => { PLX[l.key] = l; });
  const EMERG = ['storm', 'repair', 'mh', 'fire'];
  const LINES = LINE_KEYS.map(k => { const p = PLX[k] || {}; const n0 = NAME0[k] || [k, k]; return Object.assign({ key: k, name: n0[0], short: n0[1], unit: 'Jobs a year', what: '', g: (M.GRADE || {})[k] || 'D', law: [], kw: [], kwEs: [], neg: [], angles: [] }, p, { months: SEA[k], mg: SEA_G[k], dayparts: EMERG.includes(k) ? 'emergency' : COM_LINES.includes(k) ? 'b2b' : 'retail' }); });
  const LI = {}; LINES.forEach(l => LI[l.key] = l);
  function set(patch) { if (!patch) return; Object.keys(patch).forEach(k => { if (k === 'lines') Object.keys(patch.lines || {}).forEach(l => { if (A.lines[l]) Object.assign(A.lines[l], patch.lines[l]); }); else A[k] = patch[k]; }); store.set(KEY, A); topLines(); BUS.emit('slm'); }
  function reset() { const d = JSON.parse(JSON.stringify(DEF)); Object.keys(A).forEach(k => delete A[k]); Object.assign(A, d); store.set(KEY, A); topLines(); BUS.emit('slm'); }
  /* unit economics for a line at a ZIP's relative cost: cost per lead, cost per sold job, gross profit per job and its ratio to cost */
  function blended(L, z) { const p = A.lines[L.key]; const cpc = A.cpc * p.cpcMul * (z && isN(z.cpc_rel) ? z.cpc_rel : 1); const cvr = p.cvr / 100; const close = p.close / 100; const cpl = cpc / cvr; const cps = cpl / close; const feeCase = p.val * A.fee; return { cpc, cvr: p.cvr, cpl, close: p.close, cps, feeCase, roi: feeCase / cps }; }
  /* a ZIP's annual jobs, the jobs open to marketing, and the gross profit pool for a line under the current assumptions */
  function zipLine(z, k) { const p = A.lines[k]; if (!p) return { pool: 0, cases: 0, fees: 0, rev: 0, rate: null }; const pool = z['p_' + k] || 0; const cases = pool * p.rep; return { pool, cases, fees: cases * p.val * A.fee, rev: cases * p.val, rate: z['r_' + k] }; }
  function zipAll(z, keys) { keys = keys || LINE_KEYS; let pool = 0, cases = 0, fees = 0, rev = 0; keys.forEach(k => { const o = zipLine(z, k); pool += o.pool; cases += o.cases; fees += o.fees; rev += o.rev; }); return { pool, cases, fees, rev }; }
  /* budget allocation: share of budget proportional to (gross profit pool / relative cost) ^ alpha across the chosen ZIPs */
  function allocate(budget, keys, zips, alpha) { alpha = alpha == null ? A.alpha : alpha; const w = zips.map(z => { const f = zipAll(z, keys).fees; return Math.pow(Math.max(0, f) / Math.max(0.3, z.cpc_rel || 1), alpha); }); const s = sum(w) || 1; return zips.map((z, i) => ({ zip: z.zip, z, w: w[i] / s, budget: budget * w[i] / s })); }
  function unitEcon(k) { return blended(LI[k], null); }
  /* a line's year: statewide, or for a region when its number is given */
  function seasonFor(k, reg) { const S = reg != null && SEA_R[reg] ? SEA_R[reg] : SEA; return S[k] || S.replace; }
  const lineName = k => (LI[k] || {}).name || (k === 'unmapped' ? 'Unmapped' : k);
  /* top line by gross profit pool for each ZIP (used by the accounts module) */
  function topLines() { Z.forEach(z => { let best = null, bv = -1; LINE_KEYS.forEach(k => { const v = zipLine(z, k).fees; if (v > bv) { bv = v; best = k; } }); z.sl_top = best; }); }
  topLines();
  function layers() {
    const out = {};
    LINES.forEach(l => {
      if (!ZC.includes('r_' + l.key)) return;
      out['r_' + l.key] = { l: `${l.name}: jobs per 10,000 residents a year`, grp: 'Service line rates', dir: 1, ramp: 'green', g: l.g, f: v => D(v, 1), note: `${l.unit}, per 10,000 residents, shrunk toward the county rate for small ZIPs (a prior worth 2,500 residents). ${l.what}` };
      out['p_' + l.key] = { l: `${l.name}: jobs a year (count)`, grp: 'Service line volume', dir: 1, ramp: 'green', g: l.g, f: v => v < 10 ? D(v, 1) : N(v), note: `${l.unit}. Volume, not rate: large ZIPs shade darker.` };
    });
    return out;
  }
  return { A, DEF, BASIS, LINES, LI, MONTHS, BLOCKS, DAYPARTS, daypartGrid, blockOf, SEA, SEA_R, SEA_G, SEA_SRC, RAIN: HZ.rain, RAIN_R: HZ.rainR, set, reset, blended, zipLine, zipAll, allocate, unitEcon, seasonFor, lineName, layers };
})();
/* ============================ per line targeting helpers (modules 05, 07, 08, 09, 12) ============================
   They live here, before every module, so no module depends on another module's file being loaded first. */
const LINE_TIER = p => p >= 95 ? 'A+' : p >= 85 ? 'A' : p >= 65 ? 'B' : p >= 40 ? 'C' : p >= 15 ? 'D' : 'E';
const TIER_BID = { 'A+': 30, A: 20, B: 10, C: 0, D: -20, E: -50 };
/* a line's paid target ranking: gross profit pool for the line at the current assumptions divided by the ZIP's relative cost per click, as a percentile */
function lineTargets(k, rows) {
  rows = rows || ZR; const out = rows.map(z => { const o = SLM.zipLine(z, k); return { z, zip: z.zip, pool: o.pool, cases: o.cases, fees: o.fees, rate: z['r_' + k], eff: o.fees / Math.max(0.3, z.cpc_rel || 1) }; });
  const sorted = out.map(o => o.eff).sort((a, b) => a - b); const n = sorted.length;
  out.forEach(o => { let lo = 0, hi = n; while (lo < hi) { const m = (lo + hi) >> 1; if (sorted[m] < o.eff) lo = m + 1; else hi = m; } o.pct = n ? lo / n * 100 : 0; o.tier = LINE_TIER(o.pct); o.bid = TIER_BID[o.tier]; });
  return out;
}
/* cities ranked for a line (SEO page targets). comp = active C-39 licenses within 8 km of the city's centre. */
function lineCities(k) { return CITIES.map(c => { const zs = (c.zips || []).map(z => ZI[z]).filter(Boolean); let pool = 0, cases = 0, fees = 0; zs.forEach(z => { const o = SLM.zipLine(z, k); pool += o.pool; cases += o.cases; fees += o.fees; }); const pop = Math.max(1, c.pop || 0); return { c, name: c.name, pi: c.pi, pop: c.pop, nzip: zs.length, pool, cases, fees, comp: c.comp, roofers: c.roofers, lic: c.lic, span: (c.span || 0) / pop * 100, chin: (c.chin || 0) / pop * 100, viet: (c.viet || 0) / pop * 100, tagalog: (c.tagalog || 0) / pop * 100, korean: (c.korean || 0) / pop * 100 }; }); }
const LINE_FIRMS = k => COMP.filter(c => (c.lines || []).includes(k));
/* quadrant names shared by modules 01 and 05 */
const QN = ['Anchor', 'Whitespace', 'Niche', 'Avoid'];
