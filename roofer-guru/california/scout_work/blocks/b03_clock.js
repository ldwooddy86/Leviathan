  /* ---------- roof life: module 17's roof lives, and the wildfires that rebuilt roofs ---------- */
  const lanczos = z => { const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7]; if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * lanczos(1 - z)); z -= 1; let x = c[0]; for (let i = 1; i < g + 2; i++) x += c[i] / (z + i); const t = z + g + 0.5; return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x; };
  const MODEL = (META && META.model) || {}, ANCH = MODEL.ANCH || {};
  /* module 17's two lives: every covering but tile on one Weibull life, refitted to the American Housing Survey's West
     region; tile on the life of the underlayment under it, about 25 years by a reserve study consultant's figure and a
     trade site's (neither a test nor a field study), after which the same tile is lifted and relaid */
  const WB = MODEL.WB || { L: 22, k: 3 }, WBT = MODEL.WBT || { L: 25, k: 3 };
  /* L: mean life in years; k: Weibull shape. Shingles, wood and a house's low slope roof carry the atlas's life for
     coverings other than tile (module 17 keeps them in one cohort: no California field study of shingle or shake life
     was found); tile the underlayment's; membranes and metal buildings the atlas's commercial and multifamily lives
     (module 12); metal homes 40 years and manufactured home roofs 20 (the atlas's stated figures; their shapes are
     judgment). */
  const LIFE = {
    shingle: { L: +WB.L || 22, k: +WB.k || 3, l: 'asphalt shingles' },
    tile: { L: +WBT.L || 25, k: +WBT.k || 3, l: 'tile (the underlayment under it)' },
    wood: { L: +WB.L || 22, k: +WB.k || 3, l: 'wood shakes or shingles' },
    flat: { L: +WB.L || 22, k: +WB.k || 3, l: 'a low slope roof on a house' },
    metal: { L: 40, k: 3, l: 'metal' },
    mh: { L: 20, k: 2.5, l: 'a manufactured home roof' },
    low: { L: +ANCH.comm_life || 22, k: 3, l: 'a low slope membrane' },
    lowmf: { L: +ANCH.mf_life || +ANCH.comm_life || 22, k: 3, l: 'a low slope membrane' },
    mbldg: { L: +ANCH.comm_life || 22, k: 3, l: 'a metal building roof' },
  };
  Object.values(LIFE).forEach(p => { p.lam = p.L / lanczos(1 + 1 / p.k); });
  const mphOf = ms => Math.round(ms * 2.23694);
  /* The fire resets, exactly as module 17's cohort model made them: from 2000 on, each year's wildfire rebuild roofs in
     the ZIP (DATA.rhist, second number: the structures CAL FIRE's damage inspections record as destroyed, coming back
     as new roofs over the four years after the fire at the atlas's rebuild share), as a share of the ZIP's one unit
     roofs standing that year (today's one unit homes built before it). California has no other reset: no storm here
     replaces a neighbourhood's roofs at once. CAL FIRE's digital inspections begin in 2013, so earlier fires (Oakland
     1991, the Cedar fire of 2003, Witch 2007) reset nothing here unless the atlas's file carries them. */
  const RH0 = +MODEL.RH0 || 2000, RH = DATA.rhist || {};
  const OBK = ['o20', 'o10', 'o00', 'o90', 'o80', 'o70', 'o60', 'o50', 'o40', 'oold'];
  function standing(z, y) {
    let w = OBK.map(k => Math.max(0, +z[k] || 0)); if (!(sum(w) > 0)) w = YBK.map(k => Math.max(0, +z[k] || 0)); const W = sum(w); if (!W) return 1;
    let s = 0; w.forEach((v, i) => { const [a, b] = BINS[i], lo = i === BINS.length - 1 ? 1900 : a, hi = b + 1; s += v * clamp((y - lo) / (hi - lo), 0, 1); });
    return clamp(s / W, 0.02, 1);
  }
  const RYEARS = new Map();
  function resetsAt(zip) {
    if (RYEARS.has(zip)) return RYEARS.get(zip);
    const z = ZI[zip], rh = RH[zip], out = [];
    if (rh && z && z.roofs > 0) rh.forEach((r, i) => { const n = r ? +r[1] || 0 : 0; if (!(n > 0)) return; const y = RH0 + i, d = clamp(n / (z.roofs * standing(z, y)), 0, 0.95); if (d > 0.0005) out.push({ y, d, n }); });
    RYEARS.set(zip, out); return out;
  }
  /* repair calls a year by roof age: shaped by age (judgment) and scaled so the state's roofs, at module 17's ages, make the
     atlas's own count of paid repair jobs (the repair line's pool) */
  const REP_SHAPE = a => a < 5 ? 0.35 : a < 10 ? 0.6 : a < 15 ? 0.95 : a < 20 ? 1.35 : a < 25 ? 1.7 : 2.0;
  const REP_TARGET = META.pools && META.roofs ? clamp(META.pools.repair / META.roofs, 0.005, 0.08) : 0.027;
  const AGEH = (DATA.ts && DATA.ts.agehist) || [], AGEH_T = (DATA.ts && DATA.ts.agehist_t) || [];
  const REP_BASE = (() => { let n = 0, s = 0; AGEH.forEach((v, a) => { n += +v || 0; s += (+v || 0) * REP_SHAPE(a); }); return n && s ? REP_TARGET * n / s : REP_TARGET; })();
  const repRate = a => REP_BASE * REP_SHAPE(a);
  /* the score of the average California roof at module 17's ages (tile on its underlayment's life, every other covering on
     the shingle life, no other evidence), for the method's note on the cut points */
  const AVG_SCORE = (() => { let n = 0, s = 0; const one = (H, L0, sign) => { const S = a => Math.exp(-Math.pow(a / L0.lam, L0.k)); H.forEach((v, a) => { const w = sign * (+v || 0), p5 = 1 - S(a + 5) / S(a), rp = repRate(a); n += w; s += w * (1 - (1 - p5) * (1 - rp)); }); };
    one(AGEH, LIFE.shingle, 1); if (AGEH_T.length) { one(AGEH_T, LIFE.shingle, -1); one(AGEH_T, LIFE.tile, 1); } return n > 0 ? Math.round(s / n * 100) : null; })();
  /* The roof in place, for a clock started in year y0 at a ZIP: year by year the roof wears out on its Weibull life and is
     replaced (for tile: lifted and relaid on new underlayment), and every fire year resets the share of the surviving
     roofs the fire's rebuilds made new. Out come the chance the roof is still the first one, 15 or older, 20 or older,
     25 or older, replaced within five years (age driven) and within twelve months, a repair call within twelve months,
     its mean age, and the fire years today's roof most likely dates from. */
  const HMAX = 125, SMEMO = new Map();
  function rstate(mat, zip, y0) {
    const mk = mat + '|' + zip + '|' + y0; if (SMEMO.has(mk)) return SMEMO.get(mk);
    const p = LIFE[mat] || LIFE.shingle, lam = p.lam, kk = p.k, S = a => Math.exp(-Math.pow(a / lam, kk));
    const T = clamp(THIS_YEAR - y0, 0, HMAX), y00 = THIS_YEAR - T, sm = new Map(resetsAt(zip).map(s => [s.y, s]));
    let dist = new Float64Array(T + 2); dist[0] = 1; const coh = [];
    for (let i = 1; i <= T; i++) {
      const y = y00 + i, nd = new Float64Array(T + 2); let rep = 0;
      for (let a = 0; a < i; a++) { const v = dist[a]; if (!v) continue; const surv = S(a + 1) / S(a); nd[a + 1] += v * surv; rep += v * (1 - surv); }
      nd[0] += rep;
      coh.forEach(c => { c.m *= S(c.a + 1) / S(c.a); c.a++; });
      const st = sm.get(y);
      if (st && st.d > 0) { const d = clamp(st.d, 0, 0.95); let moved = 0; for (let a = 1; a <= i; a++) { const v = nd[a] * d; nd[a] -= v; moved += v; } nd[0] += moved; coh.forEach(c => { c.m *= 1 - d; }); if (moved > 0.002) coh.push({ y, st, m: moved, a: 0 }); }
      dist = nd;
    }
    let pOld15 = 0, pOld20 = 0, pOld25 = 0, age = 0, p5 = 0, p1 = 0, rep = 0;
    for (let a = 0; a <= T; a++) { const v = dist[a]; if (!v) continue; const s0 = S(a); if (a >= 15) pOld15 += v; if (a >= 20) pOld20 += v; if (a >= 25) pOld25 += v; age += v * a; p5 += v * (1 - S(a + 5) / s0); p1 += v * (1 - S(a + 1) / s0); rep += v * repRate(a); }
    const fires = coh.filter(c => c.m > 0.01).sort((a, b) => b.m - a.m).slice(0, 3).map(c => ({ y: c.y, share: c.m }));
    const o = { pOrig: dist[T], pOld15, pOld20, pOld25, p5: clamp(p5, 0, 1), p1: clamp(p1, 0, 1), rep, age, t: T, fires, dist };
    SMEMO.set(mk, o); return o;
  }
  const ST_KEYS = ['pOrig', 'pOld15', 'pOld20', 'pOld25', 'p5', 'p1', 'rep', 'age', 't'];
  const ZERO = { pOrig: 0, pOld15: 0, pOld20: 0, pOld25: 0, p5: 0, p1: 0, rep: 0, age: 0, t: 0, fires: [] };
  function mixStates(list) {
    const o = {}; ST_KEYS.forEach(k => o[k] = 0); let W = 0; const sy = new Map();
    list.forEach(([s, w]) => { W += w; ST_KEYS.forEach(k => o[k] += s[k] * w); (s.fires || []).forEach(x => { const e = sy.get(x.y) || { y: x.y, share: 0 }; e.share += x.share * w; sy.set(x.y, e); }); });
    if (W > 0) { ST_KEYS.forEach(k => o[k] /= W); sy.forEach(e => e.share /= W); }
    o.fires = [...sy.values()].sort((a, b) => b.share - a.share).slice(0, 3); return o;
  }

