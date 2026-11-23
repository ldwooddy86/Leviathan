import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from patchlib import patch, SRC
p = os.path.join(SRC, '09_sl_model.js'); t = open(p, encoding='utf-8').read()
a = t.find('const HZ = (() => {'); b = t.find('const zcol = ')
c = t.rfind('/* ---- hazard time series', 0, a); d = t.rfind('/* ---- hazard ZIP columns by role', 0, b)
assert c >= 0 and d > c
NEW = r"""/* ---- hazard time series, read once for every module (names as HAZARD_SCHEMA.md section 3 fixes them) ----
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
"""
t = t[:c] + NEW + t[d:]
open(p, 'w', encoding='utf-8').write(t)
patch('09_sl_model.js', [
 ("""const HC = {
  gust: zcol('wd58', 'gd58', 'g58', 'gust58'), gust40: zcol('wd40', 'gd40', 'g40', 'gust40'), gust75: zcol('wd75', 'gd75', 'g75'),
  ar: zcol('ar_days', 'ard', 'ar2_days', 'ar_d'), rain: zcol('rain_in', 'prcp_in', 'rain_norm'), rain1: zcol('rd1', 'rain_d1', 'rain1', 'd1', 'prcp_d1'), rain2: zcol('rd2', 'rain_d2', 'rain2', 'd2'),
  sa: zcol('sa_days', 'saw_days', 'offshore_days', 'sa_d'),
  fhsz: zcol('fhsz_sh', 'fhsz_hv_sh'), fhszvh: zcol('fhsz_vh_sh', 'vhfhsz_sh', 'fhsz_vh'), dest: zcol('fire_dest', 'dins_dest'), dmg: zcol('fire_dmg', 'dins_dmg'),
  snow: zcol('snow_psf', 'pg_psf', 'snow'), heat: zcol('heat100', 'h100', 'hd100'), heat90: zcol('heat90', 'h90'), hail: zcol('hd1', 'hail_d1'),
  coast: zcol('coast_km', 'coast_mi'), elev: zcol('elev_ft', 'elev_m'), solar: zcol('solar_sh', 'pv_sh', 'solar_pct'),
};""",
  """const HC = {
  gust: zcol('g58'), gust40: zcol('g40'), gust75: zcol('g75'), lsr58: zcol('wd58'), hw: zcol('hw_yr'),
  ar: zcol('ar_days', 'ar_d'), ar3: zcol('ar3_d'), rain: zcol('rain_in'), rain1: zcol('rain_d1'), rain2: zcol('rain_d2'),
  off: zcol('off_cls'), sa: zcol('sa_days'),
  fhsz: zcol('fhsz_sh'), fhszvh: zcol('fhsz_vh'), dest: zcol('fire_dest'), dmg: zcol('fire_dmg'), burn: zcol('burn_sh'),
  snow: zcol('snow_psf'), heat: zcol('h100'), heat90: zcol('h90'), hail: zcol('hail1_n25'),
  coast: zcol('coast_km'), elev: zcol('elev_pt_m'), solar: zcol('solar_sh'), stress: zcol('stress'),
};
/* what HC.ar counts, in words: the data carries AR2 or stronger days when the hazard merge is complete, all ranks until then */
const AR_WORDS = HC.ar === 'ar_days' ? 'AR2 or stronger' : 'all ranks';
const OFF_WORDS = { sa: 'Santa Ana', di: 'Diablo', su: 'sundowner' };"""),
])
