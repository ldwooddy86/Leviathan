import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from patchlib import patch
patch('09_sl_model.js', [
 ("""const SLM = (() => {
  const MONTHS = MO3.slice();""",
  """/* ---- hazard ZIP columns by role. The hazard data names them (HAZARD_SCHEMA.md); each role lists the names it may carry,
   first match wins, and a role with no column in the data is null, so every reader tests before it draws. ---- */
const zcol = (...names) => names.find(n => ZC.includes(n)) || null;
const HC = {
  gust: zcol('wd58', 'gd58', 'g58', 'gust58'), gust40: zcol('wd40', 'gd40', 'g40', 'gust40'), gust75: zcol('wd75', 'gd75', 'g75'),
  ar: zcol('ar_days', 'ard', 'ar2_days', 'ar_d'), rain: zcol('rain_in', 'prcp_in', 'rain_norm'), rain1: zcol('rd1', 'rain_d1', 'rain1', 'd1', 'prcp_d1'), rain2: zcol('rd2', 'rain_d2', 'rain2', 'd2'),
  sa: zcol('sa_days', 'saw_days', 'offshore_days', 'sa_d'),
  fhsz: zcol('fhsz_sh', 'fhsz_hv_sh'), fhszvh: zcol('fhsz_vh_sh', 'vhfhsz_sh', 'fhsz_vh'), dest: zcol('fire_dest', 'dins_dest'), dmg: zcol('fire_dmg', 'dins_dmg'),
  snow: zcol('snow_psf', 'pg_psf', 'snow'), heat: zcol('heat100', 'h100', 'hd100'), heat90: zcol('heat90', 'h90'), hail: zcol('hd1', 'hail_d1'),
  coast: zcol('coast_km', 'coast_mi'), elev: zcol('elev_ft', 'elev_m'), solar: zcol('solar_sh', 'pv_sh', 'solar_pct'),
};
const SLM = (() => {
  const MONTHS = MO3.slice();"""),
])
