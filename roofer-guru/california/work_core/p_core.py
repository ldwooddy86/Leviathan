import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from patchlib import patch
patch('00_core.js', [
 ("""const PA = DATA.parishes; const PAI = {}; PA.forEach((p, i) => { p.i = i; PAI[p.fips] = p; });
const FIPS = PA.map(p => p.fips);
const PNAME = f => (PAI[f] || {}).name || '';
const CNAME = PNAME;                       /* the parish is Louisiana's county */
const CO = PA;
const COI = PAI;
const REGN = META.model.REG;              /* region number -> name (LDH regions, which line up with the media markets) */
const REG_KEYS = Object.keys(REGN).map(Number);
""",
  """/* The 58 counties. The data key keeps its first name (SCHEMA.md section 0.1: too many readers to rename in one pass);
   on screen a county is always a County. PA is the array in FIPS order, PAI the same by FIPS ("06001" to "06115"). */
const PA = DATA['parishes']; const PAI = {}; PA.forEach((p, i) => { p.i = i; PAI[p.fips] = p; });
const FIPS = PA.map(p => p.fips);
const PNAME = f => (PAI[f] || {}).name || '';
const CNAME = PNAME;
const CO = PA;
const COI = PAI;
const NCOUNTY = PA.length;                 /* counted from the data, never typed */
const REGN = META.model.REG;              /* region number -> name: 1 North Coast to 11 San Diego and Imperial (DESIGN.md order) */
const REG_KEYS = Object.keys(REGN).map(Number).sort((a, b) => a - b);
const REGK = META.model.REGK || {};        /* region number -> two letter key (nc, fn, sv, si, ba, cc, sj, la, oc, ie, sd) */
const NREG = REG_KEYS.length;
"""),
 ("""const ZR = Z.filter(z => z.res_ok && z.idx != null);     // residential ZIPs scored by the models (500+ residents)
const CITIES = DATA.cities; const CITYI = {}; CITIES.forEach(c => CITYI[c.name] = c);
const PLACES = DATA.places;
const COMP = DATA.comp;
const BENCH = null;                        /* no company is assumed; set yours in the Company panel */
const RT = DATA.routes; const RTI = {}; RT.forEach(r => RTI[r.r] = r);   /* named storms 2002 to 2026 with a Louisiana wind footprint */
const RLIST = DATA.rlist;
const SIDS = DATA.sids;                    /* every storm in the ZIP footprints: [name, year, Louisiana category, peak Louisiana wind kt] */
const PTF = DATA.ptflags;                  /* storm report flag bit order */
/* NOAA Storm Events reports 2016 to 2026: k = 0 hail (mag inches), 1 thunderstorm wind (mag knots), 2 tornado (mag EF) */
const PTS = DATA.pts.map(a => ({ lat: a[0], lon: a[1], y: a[2], m: a[3], dw: a[4], h: a[5], k: a[6], mag: a[7], b: a[8], pi: a[9], zi: a[10], dmg: a[11] }));
const ptHas = (p, k) => { const i = PTF.indexOf(k); return i >= 0 && !!(p.b & (1 << i)); };
const LINE_KEYS = ['replace', 'repair', 'storm', 'hail', 'fortified', 'metal', 'mh', 'mf', 'comm', 'coat', 'newc'];
const RES_LINES = ['replace', 'repair', 'storm', 'hail', 'fortified', 'metal', 'mh'];
const COM_LINES = ['mf', 'comm', 'coat', 'newc'];
const YEARS_F = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
const routeLabel = r => String(r || '');
const routeShort = r => String(r || '');
const catLab = c => c == null || c < 0 ? 'below storm force' : c === 0 ? 'tropical storm' : 'Category ' + c;
const ktMph = kt => isN(kt) ? Math.round(kt * 1.15078) : null;
""",
  """const ZR = Z.filter(z => z.res_ok && z.idx != null);     // residential ZIPs scored by the models (500+ residents)
const CITIES = DATA.cities || []; const CITYI = {}; CITIES.forEach(c => CITYI[c.name] = c);
const PLACES = DATA.places || [];
const COMP = DATA.comp || [];              /* named roofing companies with public evidence only (SCHEMA.md section 8): a short list, not a roster */
const BENCH = null;                        /* no company is assumed; set yours in the Company panel */
/* Track structures have no California meaning (no tropical cyclones). The data ships them empty; they stay defined so a
   reader in another module does not throw, and nothing is drawn from them. */
const RT = DATA.routes || []; const RTI = {}; RT.forEach(r => RTI[r.r] = r);
const RLIST = DATA.rlist || [];
const SIDS = DATA.sids || [];
const PTF = DATA.ptflags || [];            /* located report flag bit order (hazard data) */
/* located weather and fire reports (hazard data; kinds and magnitudes are listed in HAZARD_SCHEMA.md and in PT_KINDS when the data carries it) */
const PTS = (DATA.pts || []).map(a => ({ lat: a[0], lon: a[1], y: a[2], m: a[3], dw: a[4], h: a[5], k: a[6], mag: a[7], b: a[8], pi: a[9], zi: a[10], dmg: a[11] }));
const ptHas = (p, k) => { const i = PTF.indexOf(k); return i >= 0 && !!(p.b & (1 << i)); };
/* the thirteen service lines, in the order every list is ordered (the data carries the same list; the typed copy is the fallback) */
const LINE_KEYS = (META.model.LINES && META.model.LINES.length ? META.model.LINES.slice() : ['replace', 'repair', 'storm', 'fire', 'harden', 'tile', 'solar', 'metal', 'mh', 'mf', 'comm', 'coat', 'newc']);
const COM_LINES = (META.model.COM && META.model.COM.length ? META.model.COM.slice() : ['mf', 'comm', 'coat', 'newc']).filter(k => LINE_KEYS.includes(k));
const RES_LINES = (META.model.RES && META.model.RES.length ? META.model.RES.slice() : LINE_KEYS.filter(k => !COM_LINES.includes(k))).filter(k => LINE_KEYS.includes(k));
const NLINE = LINE_KEYS.length;
/* one colour per line, in line order, for charts that show the lines together (light, dark) */
const LINE_COLORS = { replace: ['#b0522b', '#d98b5d'], repair: ['#3a77a0', '#64a0c4'], storm: ['#1d405a', '#a2c9e1'], fire: ['#9c2f2a', '#f07a6c'], harden: ['#d0892a', '#f0b45c'], tile: ['#8b3d1f', '#f2b892'], solar: ['#c9a227', '#e6cf6a'], metal: ['#6b735f', '#929a85'], mh: ['#7a5c8e', '#b79bcb'], mf: ['#2a5c7f', '#7eb0cd'], comm: ['#3a3f32', '#c2c8b6'], coat: ['#5693b8', '#3d7ba1'], newc: ['#868f7b', '#6f7663'] };
const lineColor = k => (LINE_COLORS[k] || ['#8d8578', '#9a9184'])[isDark() ? 1 : 0];
const YEARS_F = (() => { const ys = [...new Set((DATA.pts || []).map(a => a[2]))].filter(y => y > 1900).sort((a, b) => a - b); if (!ys.length) return []; const out = []; for (let y = ys[0]; y <= ys[ys.length - 1]; y++) out.push(y); return out; })();   /* the years the located reports cover, from the data */
const routeLabel = r => String(r || '');
const routeShort = r => String(r || '');
/* atmospheric river scale (CW3E, AR1 to AR5) in words; the name catLab is kept for readers that still call it */
const arLab = c => c == null || !(c >= 1) ? 'below AR1' : 'AR' + Math.min(5, Math.round(c));
const catLab = arLab;
const ktMph = kt => isN(kt) ? Math.round(kt * 1.15078) : null;
/* shared small things several modules need whatever order they load in */
const MO3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MOL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const hrLab = h => h < 0 ? 'hour unknown' : h === 0 ? '12 a.m.' : h < 12 ? h + ' a.m.' : h === 12 ? '12 p.m.' : (h - 12) + ' p.m.';
const joinAnd = a => { a = (a || []).filter(x => x != null && x !== ''); return a.length <= 1 ? (a[0] || '') : a.length === 2 ? a[0] + ' and ' + a[1] : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; };
const numWord = n => ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'][n] || String(n);
const capFirst = s => { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); };
/* the atlas's name and the words every module uses for the state, so no module types them */
const ATLAS = { name: 'California Roofer Guru', state: 'California', st: 'CA', county: 'County', tz: 'America/Los_Angeles', tzName: 'Pacific', file: 'california' };
/* Lanczos gamma, for the Weibull roof life (mean = scale x Gamma(1 + 1/shape)); read by modules 04 and 17 */
function gammaFn(z) { const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7]; if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gammaFn(1 - z)); z -= 1; let x = c[0]; for (let i = 1; i < g + 2; i++) x += c[i] / (z + i); const t = z + g + 0.5; return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x; }
"""),
 ("""/* dates for prose: October 6, 2026 and Oct 6 */""", """/* dates for prose: November 19, 2026 and Nov 19 */"""),
 ("""/* FEMA roof and wind registrants who reported homeowners insurance (OpenFEMA IHP), and a plain words share (about four in ten) */
const FEMA_INS = (() => { const F = (DATA.ts && DATA.ts.fema_year) || []; let n = 0, own = 0, ins = 0; F.forEach(a => { n += +a[3] || 0; own += +a[5] || 0; ins += +a[6] || 0; }); return { n, own, ins, sh: n ? ins / n * 100 : null, ownSh: own ? ins / own * 100 : null }; })();""",
  """/* FEMA household registrations in California disasters (OpenFEMA IHP): n = roof or property registrations, all = every
   registration, own and ins = owners and registrants reporting homeowners insurance among ALL registrations (SCHEMA.md
   section 7), so the insured share is ins / all. A plain words share comes from inTen. */
const FEMA_INS = (() => { const F = (DATA.ts && DATA.ts.fema_year) || []; let n = 0, own = 0, ins = 0, all = 0; F.forEach(a => { n += +a[3] || 0; own += +a[5] || 0; ins += +a[6] || 0; all += +(a[8] != null ? a[8] : a[3]) || 0; }); return { n, all, own, ins, sh: all ? ins / all * 100 : null, ownSh: own ? ins / own * 100 : null }; })();
const COMPILED = dateL(META.compiled || '2026-11-19');   /* "November 19, 2026", from the data */"""),
 (""".replace(/\\bI-(\\d+)\\b/g, 'Interstate $1').replace(/\\b(US|LA)-(\\d+)\\b/g, '$1 $2')""",
  """.replace(/\\bI-(\\d+)\\b/g, 'Interstate $1').replace(/\\b(US|CA|SR)-(\\d+)\\b/g, '$1 $2')"""),
 ("""store.set('up.theme', document.documentElement.dataset.theme)""", """store.set('cg.theme', document.documentElement.dataset.theme)"""),
])
