// Legion · population: every Californian in the pack as a pure function of (seed, ZIP, household, member).
//
// Nothing is stored. Household h of ZIP zi is drawn from per-ZIP models that are built lazily from the pack's
// Census tables and cached; the same (seed, zi, h, m) gives the same person everywhere.
//
// Layer 0 (householdCore) is what the GPU crowd needs, and it has to cost a few microseconds:
//   * Household structure. A household is one of ~1,400 "components": a type (B11001), a size, the
//     householder's five-year age band and sex, and a variant (nuclear, multigenerational, extended, partner).
//     Each component carries a fixed analytic kernel: the expected number of members it adds to each of the 46
//     B01001 age-sex brackets (spouses near the householder's age, children 15 to 50 years younger, parents
//     15 to 50 years older, roommates mostly young adults). Per ZIP an EM fit picks the component weights that
//     reproduce the household types exactly, the mean household size exactly and the age-sex pyramid as
//     closely as the structure allows (kernels factor by role, so a fit is a few dozen thousand
//     multiply-adds). Group quarters residents (dorms, barracks, prisons, nursing homes) are not in households;
//     their estimated pyramid is subtracted from B01001 first (the excess over neighboring ZIPs).
//   * Heritage. Race (B03002) refined by Hispanic origin (B03001), Asian group (B02015) and ancestry
//     (B04006, as relative weights) into the shared heritage keys. Household heritage depends mildly on
//     household size; the size propensities are recalibrated per ZIP so that persons reproduce B03002.
//     Spouses, children, relatives and roommates mix by simple rules mirrored in that calibration.
//   * Tenure, dwelling and vehicles: logistic tenure by type and age calibrated to own_sh; dwelling by IPF of
//     tenure against sfd_sh/mf5_sh/mh_sh; vehicles by IPF of size class against B25044 within tenure.
//   * School (B14001 rates by single year of age), work (B23025 by a national age-sex profile shifted to the
//     ZIP), active duty, occupation (C24010 by sex, IPF against an age profile), commute mode (B08301, split by
//     car access) and time (B08303, IPF of mode against time), workplace by a gravity model over ZIPs
//     weighted by establishments in distance bands consistent with the trip, and departure times from the
//     occupation group's shift pattern (occupations.mjs).
//
// Layer 1 (household, person) conditions on layer 0 and never contradicts it: nativity and arrival (B05012),
// language and English ability (C16001), education (B15003), marital status (B12001), veterans (B21001),
// household income (B19001, by rank of earning power), names (names.mjs), job titles (occupations.mjs) and
// the highway a driver takes. Those are calibrated on a synthetic sample of the ZIP's own households.

import { Rng, hash2, hash3, mix32, u01, clamp } from './rng.mjs';
import { surname, givenName, nickname } from './names.mjs';
import { OCC_GROUPS, GROUP_PROFILES, pickOccupation } from './occupations.mjs';

/** The default population seed (the year California became a state). */
export const LEGION_SEED = 1849;

/** The year "now" is in the population (the ACS 2020-2024 tables and the 2026 weather snapshot). */
export const POPULATION_YEAR = 2026;

const YEAR = POPULATION_YEAR;
const MAX_AGE = 99;

// ------------------------------------------------------------------ small numeric helpers

const sigmoid = x => 1 / (1 + Math.exp(-x));
const logit = p => Math.log(p / (1 - p));
const sum = a => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return s; };

// scratch space for building alias tables (no allocation per table beyond the table itself)
let SCR_W = new Float64Array(1024), SCR_S = new Int32Array(1024), SCR_L = new Int32Array(1024);

/** Vose alias table in compact typed arrays (up to 65,535 entries): draw(u1, u2) -> index in O(1). */
class Table {
  constructor(weights) {
    const n = weights.length;
    this.n = n;
    this.prob = new Float32Array(n);
    this.alias = new Uint16Array(n);
    let tot = 0;
    for (let i = 0; i < n; i++) if (weights[i] > 0) tot += weights[i];
    this.total = tot;
    this.empty = !(tot > 0);
    if (this.empty) { this.prob.fill(1); for (let i = 0; i < n; i++) this.alias[i] = i; return; }
    if (SCR_W.length < n) { SCR_W = new Float64Array(n); SCR_S = new Int32Array(n); SCR_L = new Int32Array(n); }
    const scaled = SCR_W, small = SCR_S, large = SCR_L;
    let ns = 0, nl = 0;
    for (let i = 0; i < n; i++) { scaled[i] = (weights[i] > 0 ? weights[i] : 0) * n / tot; if (scaled[i] < 1) small[ns++] = i; else large[nl++] = i; }
    while (ns && nl) {
      const s = small[--ns], l = large[--nl];
      this.prob[s] = scaled[s]; this.alias[s] = l;
      scaled[l] += scaled[s] - 1;
      if (scaled[l] < 1) small[ns++] = l; else large[nl++] = l;
    }
    while (nl) { const l = large[--nl]; this.prob[l] = 1; this.alias[l] = l; }
    while (ns) { const s = small[--ns]; this.prob[s] = 1; this.alias[s] = s; }
  }
  draw(u1, u2) { const i = Math.min(this.n - 1, (u1 * this.n) | 0); return u2 < this.prob[i] ? i : this.alias[i]; }
  pick(rng) { return this.draw(rng.float(), rng.float()); }
}

/** Iterative proportional fitting of a rows x cols prior to row and column totals (column totals rescaled to the rows'). */
function ipf(prior, rows, cols, rowT, colT, iters = 16) {
  const m = Float64Array.from(prior);
  const rt = sum(rowT), ct = sum(colT), cs = ct > 0 ? rt / ct : 0;
  for (let it = 0; it < iters; it++) {
    for (let i = 0; i < rows; i++) {
      let s = 0; for (let j = 0; j < cols; j++) s += m[i * cols + j];
      const f = s > 0 ? rowT[i] / s : 0; for (let j = 0; j < cols; j++) m[i * cols + j] *= f;
    }
    for (let j = 0; j < cols; j++) {
      let s = 0; for (let i = 0; i < rows; i++) s += m[i * cols + j];
      const f = s > 0 ? colT[j] * cs / s : 0; for (let i = 0; i < rows; i++) m[i * cols + j] *= f;
    }
  }
  return m;
}

/** alpha such that sum_i n[i] * sigmoid(alpha + off[i]) = target (Newton from a weighted-logit start, bisection safeguards). */
function solveShift(n, off, target) {
  let tot = 0, mo = 0;
  for (let i = 0; i < n.length; i++) if (n[i] > 0) { tot += n[i]; mo += n[i] * off[i]; }
  if (!(tot > 0)) return 0;
  const goal = clamp(target, tot * 1e-5, tot * (1 - 1e-5));
  let lo = -40, hi = 40, a = logit(goal / tot) - mo / tot;
  for (let it = 0; it < 40; it++) {
    let f = -goal, d = 0;
    for (let i = 0; i < n.length; i++) { const ni = n[i]; if (!(ni > 0)) continue; const p = 1 / (1 + Math.exp(-(a + off[i]))); f += ni * p; d += ni * p * (1 - p); }
    if (Math.abs(f) < 1e-7 * tot) break;
    if (f > 0) hi = a; else lo = a;
    let next = d > 1e-12 ? a - f / d : (lo + hi) / 2;
    if (!(next > lo && next < hi)) next = (lo + hi) / 2;
    a = next;
  }
  return a;
}

/** Standard normal CDF (Abramowitz-Stegun 7.1.26, |error| < 1.5e-7). */
function normCdf(x) {
  const z = Math.abs(x) / Math.SQRT2, t = 1 / (1 + 0.3275911 * z);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z);
  return x >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
}

// ------------------------------------------------------------------ ages (B01001 brackets)

const AGE_LO = [0, 5, 10, 15, 18, 20, 21, 22, 25, 30, 35, 40, 45, 50, 55, 60, 62, 65, 67, 70, 75, 80, 85];
const AGE_HI = [4, 9, 14, 17, 19, 20, 21, 24, 29, 34, 39, 44, 49, 54, 59, 61, 64, 66, 69, 74, 79, 84, 99];
const NB = 23, NB2 = 46;
const BR = new Uint8Array(MAX_AGE + 1);
for (let b = 0; b < NB; b++) for (let a = AGE_LO[b]; a <= AGE_HI[b]; a++) BR[a] = b;
// share of a bracket's people at each single year (85+ thins out)
const YEAR_SHARE = new Float64Array(MAX_AGE + 1);
for (let b = 0; b < NB; b++) {
  let t = 0;
  for (let a = AGE_LO[b]; a <= AGE_HI[b]; a++) t += b === NB - 1 ? Math.pow(0.82, a - 85) : 1;
  for (let a = AGE_LO[b]; a <= AGE_HI[b]; a++) YEAR_SHARE[a] = (b === NB - 1 ? Math.pow(0.82, a - 85) : 1) / t;
}

// ------------------------------------------------------------------ household components (static)

const TYPES = ['married', 'father', 'mother', 'alone', 'roommates'];
const T_MARRIED = 0, T_FATHER = 1, T_MOTHER = 2, T_ALONE = 3, T_ROOM = 4;

// householder bands
const BAND_LO = [15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85];
const BAND_HI = [19, 24, 29, 34, 39, 44, 49, 54, 59, 64, 69, 74, 79, 84, 99];
const NBAND = 15;
const A0 = 15, NA = MAX_AGE - A0 + 1;
const BAND_CUM = BAND_LO.map((lo, k) => {
  const hi = BAND_HI[k], w = [];
  for (let a = lo; a <= hi; a++) w.push(k === 0 ? [0, 0.03, 0.07, 0.35, 0.55][a - lo] : k === NBAND - 1 ? Math.pow(0.8, a - lo) : 1);
  const t = w.reduce((x, y) => x + y, 0);
  let c = 0;
  return Float64Array.from(w, v => (c += v / t));
});
const bandAge = (band, u) => { const cum = BAND_CUM[band]; let i = 0; while (i < cum.length - 1 && u >= cum[i]) i++; return BAND_LO[band] + i; };

// roles: 0 householder, 1 spouse, 2 partner, 3 child, 4 grandchild, 5 parent, 6 sibling, 7 relative, 8 roommate,
// 9 second parent (the other half of a parent couple; reported as 'parent')
const ROLE_NAMES = ['householder', 'spouse', 'partner', 'child', 'grandchild', 'parent', 'sibling', 'relative', 'roommate', 'parent'];
const R_HH = 0, R_SPOUSE = 1, R_PARTNER = 2, R_CHILD = 3, R_GRAND = 4, R_PARENT = 5, R_SIB = 6, R_REL = 7, R_ROOM = 8, R_PARENT2 = 9;
const NROLE = 10;

// member age paths relative to the householder's exact age a (x = member's age)
const P_SP_M = 0, P_SP_F = 1, P_SP_S = 2, P_PA_M = 3, P_PA_F = 4, P_PA_S = 5, P_CH_M = 6, P_CH_F = 7, P_GC = 8, P_PAR = 9, P_SIB = 10, P_REL = 11, P_ROOM = 12;
const NPATH = 13;
const gw = (x, mu, sd) => { const z = (x - mu) / sd; return Math.exp(-0.5 * z * z); };

function pathWeights(p, a) {
  const w = new Float64Array(MAX_AGE + 1);
  const rel = (sign, mu, sd, lo, hi, scale = 1) => {
    let t = 0; for (let d = lo; d <= hi; d++) t += gw(d, mu, sd);
    for (let d = lo; d <= hi; d++) { const x = a + sign * d; if (x >= 0 && x <= MAX_AGE) w[x] += scale * gw(d, mu, sd) / t; }
  };
  switch (p) {
    case P_SP_M: rel(-1, 2.3, 4.0, -12, 18); break;           // wife of a male householder, ~2 years younger
    case P_SP_F: rel(1, 2.3, 4.0, -12, 18); break;            // husband of a female householder
    case P_SP_S: rel(1, 0, 5, -15, 15); break;                // same-sex spouse
    case P_PA_M: rel(-1, 1.8, 4.8, -14, 18); break;
    case P_PA_F: rel(1, 1.8, 4.8, -14, 18); break;
    case P_PA_S: rel(1, 0, 5.5, -15, 15); break;
    case P_CH_M: rel(-1, 31.5, 6.5, 17, 60); break;           // fathers are older at a birth than mothers
    case P_CH_F: rel(-1, 28.5, 6.2, 15, 50); break;
    case P_GC: rel(-1, 53, 7.5, 34, 80); break;
    case P_PAR: rel(1, 28.5, 6.5, 15, 50); break;
    case P_SIB: rel(1, 0, 6.5, -22, 22); break;
    case P_REL: rel(-1, 25, 8, 10, 50, 0.45); rel(1, 0, 10, -25, 25, 0.35); rel(1, 25, 7, 10, 45, 0.2); break;
    case P_ROOM: {
      rel(1, 0, 4.5, -14, 14, 0.72);
      let t = 0; for (let x = 18; x <= 75; x++) t += gw(x, 30, 12);
      for (let x = 18; x <= 75; x++) w[x] += 0.28 * gw(x, 30, 12) / t;
      break;
    }
  }
  const lo = (p <= P_PA_S || p === P_ROOM) ? 18 : p === P_SIB ? 3 : 0;
  for (let x = 0; x < lo; x++) w[x] = 0;
  let t = 0; for (let x = 0; x <= MAX_AGE; x++) t += w[x];
  if (t > 1e-9) for (let x = 0; x <= MAX_AGE; x++) w[x] /= t;
  return t > 1e-6 ? w : null;
}

// PATH_OK[p*NA + a-15]; PATH_CUM: cumulative over member age (Float32, last positive entry exactly 1); PATH_K: bracket kernel
const PATH_OK = new Uint8Array(NPATH * NA);
const PATH_CUM = new Float32Array(NPATH * NA * (MAX_AGE + 1));
const PATH_K = new Float64Array(NPATH * NA * NB);
for (let p = 0; p < NPATH; p++) for (let a = A0; a <= MAX_AGE; a++) {
  const w = pathWeights(p, a), q = p * NA + a - A0;
  if (!w) continue;
  PATH_OK[q] = 1;
  let c = 0, last = 0;
  for (let x = 0; x <= MAX_AGE; x++) { if (w[x] > 0) last = x; PATH_K[q * NB + BR[x]] += w[x]; }
  for (let x = 0; x <= MAX_AGE; x++) { c += w[x]; PATH_CUM[q * (MAX_AGE + 1) + x] = x >= last ? 1 : c; }
}
function drawPathAge(p, a, u) {
  const off = (p * NA + a - A0) * (MAX_AGE + 1);
  let lo = 0, hi = MAX_AGE;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (PATH_CUM[off + mid] > u) hi = mid; else lo = mid + 1; }
  return lo;
}

// a role's (path, P(member male)) options given the householder's sex hs (0 male, 1 female)
function roleOptions(role, hs) {
  const opp = hs === 0 ? 0 : 1;
  switch (role) {
    case R_SPOUSE: return [[hs === 0 ? P_SP_M : P_SP_F, opp, 0.985], [P_SP_S, 1 - opp, 0.015]];
    case R_PARTNER: return [[hs === 0 ? P_PA_M : P_PA_F, opp, 0.93], [P_PA_S, 1 - opp, 0.07]];
    case R_CHILD: return [[hs === 0 ? P_CH_M : P_CH_F, 0.515, 1]];
    case R_GRAND: return [[P_GC, 0.515, 1]];
    case R_PARENT: return [[P_PAR, 0.34, 1]];
    case R_PARENT2: return [[P_PAR, 0.66, 1]];
    case R_SIB: return [[P_SIB, 0.5, 1]];
    case R_REL: return [[P_REL, 0.5, 1]];
    case R_ROOM: return [[P_ROOM, hs === 0 ? 0.62 : 0.38, 1]];
  }
  return null;
}
const roleFeasible = (role, hs, a) => roleOptions(role, hs).every(o => PATH_OK[o[0] * NA + a - A0]);

// slot mixtures (roles a slot can take, with probabilities)
const MIXES = [
  [[R_SPOUSE, 1]], [[R_PARTNER, 1]], [[R_CHILD, 1]], [[R_PARENT, 1]], [[R_ROOM, 1]],
  [[R_PARENT2, 0.35], [R_CHILD, 0.65]],                                              // 5: maybe the other parent
  [[R_GRAND, 0.42], [R_REL, 0.33], [R_SIB, 0.15], [R_ROOM, 0.10]],                    // 6: first extended slot (couple)
  [[R_CHILD, 0.5], [R_GRAND, 0.25], [R_REL, 0.15], [R_SIB, 0.05], [R_ROOM, 0.05]],   // 7: further extended slots (couple)
  [[R_PARENT, 0.33], [R_SIB, 0.3], [R_GRAND, 0.27], [R_REL, 0.1]],                    // 8: first extended slot (single parent)
  [[R_CHILD, 0.45], [R_GRAND, 0.25], [R_REL, 0.15], [R_SIB, 0.1], [R_PARENT, 0.05]], // 9: further extended slots (single)
];
const X_SPOUSE = 0, X_PARTNER = 1, X_CHILD = 2, X_PARENT = 3, X_ROOM = 4, X_P2 = 5, X_EXT1 = 6, X_EXTN = 7, X_FEXT1 = 8, X_FEXTN = 9;
const MIX_CUM = MIXES.map(m => { let c = 0; const t = m.reduce((a, r) => a + r[1], 0); return m.map(r => [r[0], (c += r[1] / t)]); });

// component catalog
const BAND_PRIOR = [
  [0.001, 0.015, 0.05, 0.09, 0.11, 0.115, 0.11, 0.105, 0.1, 0.09, 0.075, 0.06, 0.04, 0.022, 0.012],
  [0.004, 0.03, 0.06, 0.08, 0.1, 0.105, 0.105, 0.1, 0.09, 0.08, 0.07, 0.06, 0.05, 0.035, 0.03],
  [0.004, 0.03, 0.06, 0.08, 0.1, 0.105, 0.105, 0.1, 0.09, 0.08, 0.07, 0.06, 0.05, 0.035, 0.03],
  [0.002, 0.03, 0.07, 0.08, 0.07, 0.06, 0.06, 0.07, 0.08, 0.09, 0.09, 0.08, 0.07, 0.06, 0.07],
  [0.03, 0.18, 0.22, 0.15, 0.1, 0.07, 0.055, 0.05, 0.045, 0.04, 0.03, 0.015, 0.008, 0.004, 0.003],
];
const MU_MARRIED = [0.5, 0.7, 0.9, 1.3, 1.7, 1.8, 1.6, 1.15, 0.75, 0.5, 0.35, 0.3, 0.25, 0.25, 0.25];
const NU_FAMILY = [0.3, 0.45, 0.6, 0.75, 0.8, 0.8, 0.7, 0.55, 0.45, 0.4, 0.35, 0.3, 0.3, 0.3, 0.3];
const ALONE_F = [0.45, 0.45, 0.45, 0.45, 0.45, 0.45, 0.45, 0.45, 0.45, 0.52, 0.56, 0.6, 0.66, 0.7, 0.74];
const MAX_FAMILY = 10, MAX_ROOMS = 7;
const pois = (k, mu) => { let p = Math.exp(-mu); for (let i = 1; i <= k; i++) p *= mu / i; return p; };

const COMPS = (() => {
  const list = [];
  const rep = (x, n) => Array(Math.max(0, n)).fill(x);
  // size distributions: nuclear families by the householder's age; multigenerational and extended households are bigger
  const sizeP = (s, min, mu) => s < min ? 0 : pois(s - min, mu);
  for (let b = 0; b < NBAND; b++) {
    const old = b >= 8;
    const m1 = BAND_LO[b] <= 64 ? 0.045 : 0, m2 = old ? 0.1 : 0.06;
    const f1 = 0.1, f2 = old ? 0.3 : 0.2;
    for (let s = 2; s <= MAX_FAMILY; s++) {
      list.push({ type: T_MARRIED, size: s, band: b, hs: -1, v: 0, slots: [X_SPOUSE, ...rep(X_CHILD, s - 2)], prior: (1 - m1 - m2) * sizeP(s, 2, MU_MARRIED[b]) });
      if (s >= 3 && m1 > 0) list.push({ type: T_MARRIED, size: s, band: b, hs: -1, v: 1, slots: [X_SPOUSE, X_PARENT, ...(s >= 5 ? [X_P2, ...rep(X_CHILD, s - 4)] : rep(X_CHILD, s - 3))], prior: m1 * sizeP(s, 3, 0.9) });
      if (s >= 3) list.push({ type: T_MARRIED, size: s, band: b, hs: -1, v: 2, slots: [X_SPOUSE, X_EXT1, ...rep(X_EXTN, s - 3)], prior: m2 * sizeP(s, 3, 1.4) });
      for (const [t, hs] of [[T_FATHER, 0], [T_MOTHER, 1]]) {
        list.push({ type: t, size: s, band: b, hs, v: 0, slots: rep(X_CHILD, s - 1), prior: (1 - f1 - f2) * sizeP(s, 2, NU_FAMILY[b]) });
        if (s >= 3) list.push({ type: t, size: s, band: b, hs, v: 1, slots: [X_PARTNER, ...rep(X_CHILD, s - 2)], prior: f1 * sizeP(s, 3, 0.7) });
        list.push({ type: t, size: s, band: b, hs, v: 2, slots: [X_FEXT1, ...rep(X_FEXTN, s - 2)], prior: f2 * sizeP(s, 2, 1.0) });
      }
      if (s <= MAX_ROOMS) {
        list.push({ type: T_ROOM, size: s, band: b, hs: -1, v: 0, slots: rep(X_ROOM, s - 1), prior: 0.6 * sizeP(s, 2, b <= 2 ? 0.55 : 0.3) });
        list.push({ type: T_ROOM, size: s, band: b, hs: -1, v: 1, slots: [X_PARTNER, ...rep(X_ROOM, s - 2)], prior: 0.4 * sizeP(s, 2, 0.2) });
      }
    }
    list.push({ type: T_ALONE, size: 1, band: b, hs: 0, v: 0, slots: [], prior: 1 - ALONE_F[b] });
    list.push({ type: T_ALONE, size: 1, band: b, hs: 1, v: 0, slots: [], prior: ALONE_F[b] });
  }
  for (const c of list) c.prior *= BAND_PRIOR[c.type][c.band];
  for (let t = 0; t < 5; t++) { const s = list.filter(c => c.type === t).reduce((a, c) => a + c.prior, 0); for (const c of list) if (c.type === t) c.prior /= s; }
  // components no ZIP could plausibly need (a tilt would have to raise them a million-fold) are left out
  const kept = list.filter(c => c.prior >= 1e-9);
  kept.sort((a, b) => a.type - b.type || a.band - b.band || a.size - b.size || a.v - b.v || a.hs - b.hs);
  return kept;
})();
const NCOMP = COMPS.length;
const C_TYPE = Uint8Array.from(COMPS, c => c.type), C_SIZE = Uint8Array.from(COMPS, c => c.size), C_BAND = Uint8Array.from(COMPS, c => c.band);
const C_HS = Int8Array.from(COMPS, c => c.hs), C_PRIOR = Float64Array.from(COMPS, c => c.prior);
const C_SLOT_OFF = new Uint32Array(NCOMP + 1);
const C_SLOTS = Uint8Array.from(COMPS.flatMap(c => c.slots));
COMPS.forEach((c, i) => { C_SLOT_OFF[i + 1] = C_SLOT_OFF[i] + c.slots.length; });
const T_START = new Int32Array(6);
for (let t = 0, c = 0; t < 5; t++) { T_START[t] = c; while (c < NCOMP && C_TYPE[c] === t) c++; T_START[t + 1] = c; }

// factorized kernels: group g = band*3 + hsMode (0 male, 1 female, 2 either) -> householder kernel and a kernel per role
const NG = NBAND * 3;
const C_GROUP = Uint8Array.from(COMPS, c => c.band * 3 + (c.hs >= 0 ? c.hs : 2));
const KERNELS = (() => {
  const KH = new Float64Array(NG * NB2), KR = new Float64Array(NG * NROLE * NB2);
  for (let band = 0; band < NBAND; band++) for (const hs of [0, 1]) {
    const cum = BAND_CUM[band];
    for (let i = 0; i < cum.length; i++) {
      const a = BAND_LO[band] + i, pa = cum[i] - (i ? cum[i - 1] : 0);
      if (!(pa > 0)) continue;
      for (const g of [band * 3 + hs, band * 3 + 2]) {
        const f0 = g % 3 === 2 ? 0.5 : 1;
        KH[g * NB2 + hs * NB + BR[a]] += pa * f0;
        for (let role = 1; role < NROLE; role++) {
          const opts = roleFeasible(role, hs, a) ? roleOptions(role, hs) : roleOptions(R_REL, hs);
          const off = (g * NROLE + role) * NB2;
          for (const [p, pm, wo] of opts) {
            const base = (p * NA + a - A0) * NB, f = f0 * pa * wo;
            for (let b = 0; b < NB; b++) { const v = PATH_K[base + b]; if (v) { KR[off + b] += f * pm * v; KR[off + NB + b] += f * (1 - pm) * v; } }
          }
        }
      }
    }
  }
  const sparse = (arr, n) => {
    const off = new Uint32Array(n + 1), idx = [], val = [];
    for (let k = 0; k < n; k++) {
      let s = 0; for (let j = 0; j < NB2; j++) s += arr[k * NB2 + j];
      const start = idx.length;
      for (let j = 0; j < NB2; j++) { const v = arr[k * NB2 + j]; if (v > 1e-5 * s) { idx.push(j); val.push(v); } }
      let s2 = 0; for (let q = start; q < idx.length; q++) s2 += val[q];
      if (s2 > 0) for (let q = start; q < idx.length; q++) val[q] *= s / s2;
      off[k + 1] = idx.length;
    }
    return { off, idx: Uint8Array.from(idx), val: Float64Array.from(val) };
  };
  const H = sparse(KH, NG), R = sparse(KR, NG * NROLE);
  // expected role counts per component, sparse
  const roleOff = new Uint32Array(NCOMP + 1), roleId = [], roleN = [];
  for (let c = 0; c < NCOMP; c++) {
    const n = new Float64Array(NROLE);
    for (let k = C_SLOT_OFF[c]; k < C_SLOT_OFF[c + 1]; k++) for (const [r, p] of MIXES[C_SLOTS[k]]) n[r] += p;
    for (let r = 1; r < NROLE; r++) if (n[r] > 0) { roleId.push(r); roleN.push(n[r]); }
    roleOff[c + 1] = roleId.length;
  }
  // per-component moments used to tilt the fit: children (0-17) and seniors (65+) per household
  const kids = new Float64Array(NCOMP), seniors = new Float64Array(NCOMP);
  const moment = (c, test) => {
    const g = C_GROUP[c];
    let s = 0;
    for (let k = H.off[g]; k < H.off[g + 1]; k++) if (test(H.idx[k] % NB)) s += H.val[k];
    for (let k = roleOff[c]; k < roleOff[c + 1]; k++) { const q = g * NROLE + roleId[k]; for (let j = R.off[q]; j < R.off[q + 1]; j++) if (test(R.idx[j] % NB)) s += roleN[k] * R.val[j]; }
    return s;
  };
  for (let c = 0; c < NCOMP; c++) { kids[c] = moment(c, b => b < 4); seniors[c] = moment(c, b => b >= 17); }
  return { H, R, roleOff, roleId: Uint8Array.from(roleId), roleN: Float64Array.from(roleN), moments: [Float64Array.from(C_SIZE), kids, seniors] };
})();

// ------------------------------------------------------------------ the fit of household components to a ZIP

/** Solve the k x k system A x = b in place (k <= 3, Gaussian elimination with partial pivoting); false if singular. */
function solveSmall(A, b, k) {
  for (let i = 0; i < k; i++) {
    let p = i;
    for (let r = i + 1; r < k; r++) if (Math.abs(A[r * k + i]) > Math.abs(A[p * k + i])) p = r;
    if (!(Math.abs(A[p * k + i]) > 1e-14)) return false;
    if (p !== i) { for (let c = 0; c < k; c++) { const t = A[i * k + c]; A[i * k + c] = A[p * k + c]; A[p * k + c] = t; } const t = b[i]; b[i] = b[p]; b[p] = t; }
    for (let r = i + 1; r < k; r++) { const f = A[r * k + i] / A[i * k + i]; for (let c = i; c < k; c++) A[r * k + c] -= f * A[i * k + c]; b[r] -= f * b[i]; }
  }
  for (let i = k - 1; i >= 0; i--) { let s = b[i]; for (let c = i + 1; c < k; c++) s -= A[i * k + c] * b[c]; b[i] = s / A[i * k + i]; }
  return true;
}

/**
 * Exponential tilt of the weights within each type, w_c * exp(theta . m_c), so the household means of three moments
 * (size, children and seniors per household) hit their targets while the type shares stay fixed. theta minimizes
 * the convex dual F = sum_t P_t log Z_t(theta) - theta . target by Newton steps with an Armijo line search; a
 * target the household structure cannot reach leaves theta at its bound instead of diverging.
 */
function tiltMoments(w, typeShare, targets, maxIter = 10) {
  const [m0, m1, m2] = KERNELS.moments;
  const t0 = targets[0] - 2, t1 = targets[1], t2 = targets[2];
  // evaluation state: F, mean (3) and covariance (lower triangle, 6) at theta
  const cur = new Float64Array(10), nxt = new Float64Array(10);
  const evaluate = (a, b, c3, out) => {
    let F = 0, e0 = 0, e1 = 0, e2 = 0, v00 = 0, v10 = 0, v11 = 0, v20 = 0, v21 = 0, v22 = 0;
    for (let ty = 0; ty < 5; ty++) {
      const P = typeShare[ty]; if (!(P > 0)) continue;
      let s0 = 0, s1 = 0, s2 = 0, s3 = 0, q00 = 0, q10 = 0, q11 = 0, q20 = 0, q21 = 0, q22 = 0;
      for (let c = T_START[ty]; c < T_START[ty + 1]; c++) {
        const wc = w[c]; if (!(wc > 0)) continue;
        const x0 = m0[c] - 2, x1 = m1[c], x2 = m2[c];
        const e = wc * Math.exp(a * x0 + b * x1 + c3 * x2);
        s0 += e; s1 += e * x0; s2 += e * x1; s3 += e * x2;
        q00 += e * x0 * x0; q10 += e * x1 * x0; q11 += e * x1 * x1; q20 += e * x2 * x0; q21 += e * x2 * x1; q22 += e * x2 * x2;
      }
      if (!(s0 > 0)) continue;
      const u0 = s1 / s0, u1 = s2 / s0, u2 = s3 / s0;
      F += P * Math.log(s0);
      e0 += P * u0; e1 += P * u1; e2 += P * u2;
      v00 += P * (q00 / s0 - u0 * u0); v10 += P * (q10 / s0 - u1 * u0); v11 += P * (q11 / s0 - u1 * u1);
      v20 += P * (q20 / s0 - u2 * u0); v21 += P * (q21 / s0 - u2 * u1); v22 += P * (q22 / s0 - u2 * u2);
    }
    out[0] = F - a * t0 - b * t1 - c3 * t2;
    out[1] = e0; out[2] = e1; out[3] = e2; out[4] = v00; out[5] = v10; out[6] = v11; out[7] = v20; out[8] = v21; out[9] = v22;
  };
  let a = 0, b = 0, c3 = 0;
  evaluate(a, b, c3, cur);
  const Hs = new Float64Array(9), st = new Float64Array(3);
  for (let it = 0; it < maxIter; it++) {
    const g0 = cur[1] - t0, g1 = cur[2] - t1, g2 = cur[3] - t2;
    if (Math.max(Math.abs(g0), Math.abs(g1), Math.abs(g2)) < 1e-5) break;
    Hs[0] = cur[4] + 1e-9; Hs[1] = cur[5]; Hs[2] = cur[7];
    Hs[3] = cur[5]; Hs[4] = cur[6] + 1e-9; Hs[5] = cur[8];
    Hs[6] = cur[7]; Hs[7] = cur[8]; Hs[8] = cur[9] + 1e-9;
    st[0] = -g0; st[1] = -g1; st[2] = -g2;
    if (!solveSmall(Hs, st, 3)) { st[0] = -g0; st[1] = -g1; st[2] = -g2; }
    const gd = g0 * st[0] + g1 * st[1] + g2 * st[2];
    if (!(gd < 0)) break;
    let alpha = 1, ok = false, na = a, nb = b, nc = c3;
    for (let ls = 0; ls < 16; ls++) {
      na = clamp(a + alpha * st[0], -6, 6); nb = clamp(b + alpha * st[1], -6, 6); nc = clamp(c3 + alpha * st[2], -6, 6);
      evaluate(na, nb, nc, nxt);
      if (nxt[0] <= cur[0] + 1e-4 * alpha * gd) { ok = true; break; }
      alpha *= 0.5;
    }
    if (!ok) break;
    a = na; b = nb; c3 = nc; cur.set(nxt);
  }
  for (let ty = 0; ty < 5; ty++) {
    let s0 = 0;
    for (let c = T_START[ty]; c < T_START[ty + 1]; c++) {
      if (!(w[c] > 0)) continue;
      w[c] *= Math.exp(a * (m0[c] - 2) + b * m1[c] + c3 * m2[c]); s0 += w[c];
    }
    if (s0 > 0) { const f = typeShare[ty] / s0; for (let c = T_START[ty]; c < T_START[ty + 1]; c++) w[c] *= f; }
  }
}

/**
 * Component weights for one ZIP: the household type shares exactly, mean size, children and seniors per household
 * exactly, and the rest of the age-sex pyramid t (persons per household in each of the 46 brackets) as closely as
 * the structure allows, by a constrained EM between two moment tilts.
 */
function fitComponents(t, typeShare, iters = 7) {
  const { H, R, roleOff, roleId, roleN } = KERNELS;
  const w = new Float64Array(NCOMP);
  for (let c = 0; c < NCOMP; c++) w[c] = C_PRIOR[c] * typeShare[C_TYPE[c]];
  const targets = [0, 0, 0];
  for (let b = 0; b < NB2; b++) { targets[0] += t[b]; if (b % NB < 4) targets[1] += t[b]; else if (b % NB >= 17) targets[2] += t[b]; }
  tiltMoments(w, typeShare, targets, 6);
  const W = new Float64Array(NG), N = new Float64Array(NG * NROLE), HG = new Float64Array(NG), RG = new Float64Array(NG * NROLE);
  const pred = new Float64Array(NB2), ratio = new Float64Array(NB2), mu = new Float64Array(5), f = new Float64Array(5).fill(1);
  for (let it = 0; it < iters; it++) {
    W.fill(0); N.fill(0); pred.fill(0);
    for (let c = 0; c < NCOMP; c++) {
      const wc = w[c] * f[C_TYPE[c]]; w[c] = wc;
      if (!(wc > 0)) continue;
      const g = C_GROUP[c]; W[g] += wc;
      for (let k = roleOff[c]; k < roleOff[c + 1]; k++) N[g * NROLE + roleId[k]] += wc * roleN[k];
    }
    for (let g = 0; g < NG; g++) {
      const wg = W[g]; if (!(wg > 0)) continue;
      for (let k = H.off[g]; k < H.off[g + 1]; k++) pred[H.idx[k]] += wg * H.val[k];
      for (let r = 1; r < NROLE; r++) {
        const q = g * NROLE + r, n = N[q]; if (!(n > 0)) continue;
        for (let k = R.off[q]; k < R.off[q + 1]; k++) pred[R.idx[k]] += n * R.val[k];
      }
    }
    for (let b = 0; b < NB2; b++) ratio[b] = pred[b] > 1e-12 ? t[b] / pred[b] : 1;
    for (let g = 0; g < NG; g++) {
      if (!(W[g] > 0)) continue;
      let s = 0; for (let k = H.off[g]; k < H.off[g + 1]; k++) s += H.val[k] * ratio[H.idx[k]];
      HG[g] = s;
      for (let r = 1; r < NROLE; r++) {
        const q = g * NROLE + r; if (!(N[q] > 0)) continue;
        let v = 0; for (let k = R.off[q]; k < R.off[q + 1]; k++) v += R.val[k] * ratio[R.idx[k]];
        RG[q] = v;
      }
    }
    // EM update with each type's Lagrange multiplier for the size direction (one lagged Newton step per pass);
    // the type renormalization is applied at the start of the next pass
    for (let ty = 0; ty < 5; ty++) {
      const P = typeShare[ty]; if (!(P > 0)) continue;
      const m = mu[ty];
      let tot = 0, ds = 0;
      for (let c = T_START[ty]; c < T_START[ty + 1]; c++) {
        const wc = w[c]; if (!(wc > 0)) continue;
        const g = C_GROUP[c];
        let s = HG[g];
        for (let k = roleOff[c]; k < roleOff[c + 1]; k++) s += roleN[k] * RG[g * NROLE + roleId[k]];
        const d = C_SIZE[c] + m, v = wc * s / d;
        w[c] = v; tot += v; ds += v / d;
      }
      if (ds > 0) mu[ty] = clamp(m + (tot - P) / ds, (ty === T_ALONE ? 1 : 2) * -1 + 0.5, 50);
      f[ty] = tot > 0 ? P / tot : 1;
    }
  }
  for (let c = 0; c < NCOMP; c++) w[c] *= f[C_TYPE[c]];
  tiltMoments(w, typeShare, targets, 10);
  return w;
}

// ------------------------------------------------------------------ heritage vocabulary

const RACES = ['white', 'black', 'aian', 'asian', 'nhpi', 'other', 'multi', 'hispanic'];  // B03002 order
const G_WHITE = 0, G_BLACK = 1, G_AIAN = 2, G_ASIAN = 3, G_NHPI = 4, G_OTHER = 5, G_MULTI = 6, G_HISP = 7;
const NRACE = 8;
const HERITAGE = [
  ['mexican', G_HISP], ['salvadoran', G_HISP], ['guatemalan', G_HISP], ['honduran', G_HISP], ['nicaraguan', G_HISP],
  ['puertorican', G_HISP], ['cuban', G_HISP], ['dominican', G_HISP], ['southamerican', G_HISP], ['spanish', G_HISP], ['latino', G_HISP],
  ['chinese', G_ASIAN], ['filipino', G_ASIAN], ['vietnamese', G_ASIAN], ['korean', G_ASIAN], ['japanese', G_ASIAN], ['indian', G_ASIAN],
  ['hmong', G_ASIAN], ['cambodian', G_ASIAN], ['lao', G_ASIAN], ['thai', G_ASIAN], ['pakistani', G_ASIAN], ['bangladeshi', G_ASIAN],
  ['sikh', G_ASIAN], ['afghan', G_ASIAN], ['burmese', G_ASIAN], ['indonesian', G_ASIAN], ['asian', G_ASIAN],
  ['african-american', G_BLACK], ['ethiopian', G_BLACK], ['nigerian', G_BLACK], ['caribbean', G_BLACK], ['african', G_BLACK],
  ['armenian', G_WHITE], ['iranian', G_WHITE], ['arab', G_WHITE], ['assyrian', G_WHITE], ['russian', G_WHITE], ['ukrainian', G_WHITE],
  ['polish', G_WHITE], ['irish', G_WHITE], ['italian', G_WHITE], ['german', G_WHITE], ['english', G_WHITE], ['scottish', G_WHITE],
  ['french', G_WHITE], ['portuguese', G_WHITE], ['dutch', G_WHITE], ['scandinavian', G_WHITE], ['greek', G_WHITE], ['european', G_WHITE],
  ['american', G_WHITE], ['native', G_AIAN], ['pacific', G_NHPI], ['multiracial', G_MULTI], ['other', G_OTHER],
];
/** Heritage keys shared by names, lexicon, persona and dialogue (CONTRACTS section 5). */
export const HERITAGE_KEYS = HERITAGE.map(h => h[0]);
const NH = HERITAGE.length;
const H_GROUP = Uint8Array.from(HERITAGE, h => h[1]);
const H_INDEX = Object.fromEntries(HERITAGE_KEYS.map((k, i) => [k, i]));
const H_MULTI = H_INDEX.multiracial;
const HISP_TO = ['mexican', 'puertorican', 'cuban', 'dominican', 'guatemalan', 'honduran', 'nicaraguan', 'salvadoran', 'latino', 'southamerican', 'spanish', 'latino'].map(k => H_INDEX[k]);
const ASIAN_TO = ['chinese', 'filipino', 'vietnamese', 'korean', 'japanese', 'indian', 'hmong', 'cambodian', 'lao', 'thai', 'pakistani', 'bangladeshi', 'sikh', 'afghan', 'burmese', 'indonesian', 'asian'].map(k => H_INDEX[k]);
// B04006 ancestries reported (mostly) by non-Hispanic white people; Egyptian and Lebanese are inside the Arab total
const ANC_WHITE_TO = {
  armenian: 'armenian', iranian: 'iranian', arab: 'arab', assyrian: 'assyrian', russian: 'russian', ukrainian: 'ukrainian',
  polish: 'polish', irish: 'irish', italian: 'italian', german: 'german', english: 'english', scottish: 'scottish',
  scotchirish: 'scottish', french: 'french', portuguese: 'portuguese', dutch: 'dutch', swedish: 'scandinavian',
  norwegian: 'scandinavian', danish: 'scandinavian', greek: 'greek', basque: 'european', turkish: 'european',
  american: 'american', israeli: 'european', brazilian: 'portuguese', australian: 'european', canadian: 'european',
  swiss: 'european', hungarian: 'european', czech: 'european', romanian: 'european',
};
// household heritage propensity by household size (1..10) for each race group; recalibrated per ZIP to B03002
const RHO = [
  [1.3, 1.2, 0.92, 0.85, 0.72, 0.62, 0.55, 0.5, 0.5, 0.5],
  [1.2, 1.0, 1.0, 0.92, 0.9, 0.88, 0.85, 0.85, 0.85, 0.85],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [0.72, 0.95, 1.08, 1.15, 1.2, 1.25, 1.3, 1.3, 1.3, 1.3],
  [0.7, 0.9, 1.0, 1.1, 1.2, 1.3, 1.35, 1.4, 1.4, 1.4],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [0.55, 0.75, 1.0, 1.2, 1.35, 1.45, 1.5, 1.55, 1.55, 1.55],
];
// a spouse of the same race group shares the householder's exact heritage with this probability
const Q_KEY = [0.45, 0.85, 0.8, 0.88, 0.8, 0.8, 0.6, 0.82];

// ------------------------------------------------------------------ layer-0 behavior tables

const DWELLINGS = ['house', 'small-apartment', 'apartment', 'mobile-home'];
const DW_PRIOR = [1.0, 0.30, 0.08, 1.0, 0.30, 1.0, 1.0, 0.45];   // own row, rent row
const VEH_PRIOR = [
  [0.18, 0.62, 0.15, 0.04, 0.01, 0.003],
  [0.06, 0.32, 0.45, 0.13, 0.03, 0.01],
  [0.05, 0.22, 0.40, 0.23, 0.07, 0.03],
  [0.05, 0.20, 0.38, 0.24, 0.09, 0.04],
  [0.05, 0.17, 0.32, 0.25, 0.13, 0.08],
];
const TEN_TYPE = [1.0, 0.0, -0.1, -0.35, -1.1];
const TEN_BAND = [-2.6, -2.2, -1.5, -0.9, -0.45, -0.1, 0.15, 0.35, 0.55, 0.7, 0.85, 0.95, 1.0, 0.95, 0.8];

// employment-population ratios by single year of age (national shape; shifted per ZIP to B23025)
const EMP_LOGIT = (() => {
  const pts = { M: [[16, 0.18], [18, 0.42], [20, 0.62], [22, 0.74], [25, 0.84], [30, 0.87], [45, 0.85], [55, 0.77], [60, 0.68], [62, 0.55], [65, 0.40], [67, 0.30], [70, 0.20], [75, 0.11], [80, 0.05], [85, 0.02], [99, 0.01]],
    F: [[16, 0.19], [18, 0.43], [20, 0.60], [22, 0.69], [25, 0.75], [30, 0.74], [45, 0.74], [55, 0.66], [60, 0.57], [62, 0.46], [65, 0.32], [67, 0.23], [70, 0.14], [75, 0.07], [80, 0.03], [85, 0.01], [99, 0.005]] };
  const out = new Float64Array(2 * (MAX_AGE + 1)).fill(-40);
  ['M', 'F'].forEach((s, si) => {
    const p = pts[s];
    for (let a = 16; a <= MAX_AGE; a++) {
      let k = 0; while (k < p.length - 2 && a >= p[k + 1][0]) k++;
      const [a0, v0] = p[k], [a1, v1] = p[k + 1];
      const v = v0 + (v1 - v0) * clamp((a - a0) / (a1 - a0), 0, 1);
      out[si * (MAX_AGE + 1) + a] = logit(clamp(v, 1e-3, 0.999));
    }
  });
  return out;
})();
const STUDENT_WORK = -0.6;   // log-odds of working while in college or graduate school
const MIL_LOGIT = a => a < 17 ? -40 : a <= 21 ? 0 : a <= 24 ? -0.2 : a <= 29 ? -0.7 : a <= 34 ? -1.3 : a <= 39 ? -1.9 : a <= 44 ? -2.6 : a <= 54 ? -3.6 : -7;

// occupation propensity by age band (16-24, 25-34, 35-54, 55-64, 65+), relative within band
const OCC_AGE = {
  management: [0.15, 0.7, 1.2, 1.3, 1.25], business: [0.4, 1.1, 1.05, 1.0, 0.9], computer: [0.5, 1.4, 1.05, 0.75, 0.5],
  engineering: [0.4, 1.15, 1.05, 1.0, 0.7], science: [0.6, 1.3, 1.0, 0.85, 0.7], social: [0.6, 1.0, 1.0, 1.05, 1.0],
  legal: [0.25, 0.9, 1.1, 1.15, 1.3], education: [0.7, 0.95, 1.05, 1.05, 1.0], arts: [1.0, 1.2, 0.95, 0.9, 1.1],
  practitioner: [0.25, 1.0, 1.1, 1.05, 0.9], healthtech: [0.7, 1.15, 1.0, 0.95, 0.7], healthsupport: [1.3, 1.1, 0.95, 0.95, 0.9],
  firefighting: [0.8, 1.2, 1.1, 0.7, 0.2], police: [0.8, 1.2, 1.1, 0.8, 0.5], food: [3.2, 1.1, 0.65, 0.55, 0.6],
  cleaning: [0.9, 0.85, 1.0, 1.15, 1.3], personalcare: [1.6, 1.0, 0.85, 0.95, 1.2], sales: [1.9, 1.0, 0.85, 0.9, 1.25],
  office: [1.1, 1.0, 0.95, 1.05, 1.1], farming: [1.2, 1.0, 0.95, 0.95, 1.1], construction: [0.9, 1.05, 1.05, 0.9, 0.6],
  repair: [0.8, 1.0, 1.05, 1.05, 0.8], production: [0.9, 1.0, 1.05, 1.0, 0.8], transport: [0.7, 0.9, 1.0, 1.15, 1.4],
  moving: [1.7, 1.1, 0.85, 0.8, 0.7],
};
const occBand = a => a < 25 ? 0 : a < 35 ? 1 : a < 55 ? 2 : a < 65 ? 3 : 4;

// commute modes (B08301 order) and the travel-time brackets (B08303)
const MODES = ['drive', 'carpool', 'bus', 'rail', 'ferry', 'taxi', 'motorcycle', 'bike', 'walk', 'other', 'wfh'];
const M_DRIVE = 0, M_CARPOOL = 1, M_BUS = 2, M_RAIL = 3, M_TAXI = 5, M_MOTO = 6, M_BIKE = 7, M_WALK = 8, M_WFH = 10;
const NMODE = 11;
const NOCAR_PRIOR = [0.06, 1.3, 6, 5, 3, 4, 0.2, 3.5, 4.5, 2];
// working from home by occupation group (national log-odds, shifted per ZIP to its B08301 share); index 25 armed forces
const WFH_LOGIT = Float64Array.from([-0.62, -0.41, 0, -1.27, -1.1, -1.73, -0.85, -2.44, -0.85, -2.44, -3.18, -2.94, -3.89, -4.6, -4.18, -3.48,
  -2.44, -1.73, -1.39, -2.75, -3.18, -3.48, -3.89, -3.89, -4.18, -4.6]);
const CT_LO = [1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 60, 90];
const CT_HI = [4, 9, 14, 19, 24, 29, 34, 39, 44, 59, 89, 150];
const NCT = 12;
const TIME_PRIOR = [
  [2, 7, 11, 13, 12, 6, 13, 4, 5, 10, 9, 3],          // drive
  [1.5, 5, 9, 11, 11, 6, 14, 5, 6, 12, 12, 4],         // carpool
  [0.2, 1, 3, 5, 7, 6, 14, 6, 9, 20, 22, 7],           // bus
  [0.1, 0.5, 1.5, 3, 5, 5, 12, 6, 10, 22, 28, 8],      // rail
  [0.05, 0.2, 0.5, 1, 2, 3, 10, 5, 10, 25, 33, 10],    // ferry
  [3, 15, 22, 18, 13, 6, 10, 2, 3, 4, 3, 1],           // taxi
  [2, 7, 11, 13, 12, 6, 13, 4, 5, 10, 9, 3],           // motorcycle
  [4, 18, 24, 20, 14, 5, 8, 1.5, 1.5, 2, 1, 0.5],      // bike
  [18, 32, 22, 12, 7, 2, 4, 0.7, 0.7, 0.8, 0.5, 0.3],  // walk
  [2, 6, 10, 12, 11, 6, 12, 4, 6, 12, 12, 5],          // other
];
// door-to-door speed (km/h) and fixed overhead (minutes) by mode, used to turn a trip time into a distance
const SPEED = [42, 38, 14, 28, 22, 26, 45, 14, 4.8, 20];
const OVERHEAD = [3, 5, 10, 12, 15, 5, 2, 2, 0, 5];
// workplace distance bands (km)
const BAND_EDGES = [0, 2.5, 5, 8, 12, 17, 23, 31, 41, 55, 75, 100, 125];
const NWB = BAND_EDGES.length - 1;
const WORK_RADIUS = 125;

const SHIFT_KEYS = ['early', 'day', 'mid', 'evening', 'night', 'h24'];
const PROFILE_CUM = Object.fromEntries(Object.entries(GROUP_PROFILES).map(([k, p]) => {
  const w = SHIFT_KEYS.map(s => p.shifts[s] || 0), t = w.reduce((a, b) => a + b, 0);
  let c = 0;
  return [k, Float64Array.from(w, v => (c += v / t))];
}));
// runs of consecutive work days that include a weekend day, for n = 3, 4, 5, 6
const WEEKEND_RUNS = [0, 0, 0, 3, 4, 5, 6].map(n => {
  const out = [];
  if (!n) return out;
  for (let s = 0; s < 7; s++) {
    let mask = 0, wk = false;
    for (let d = 0; d < n; d++) { const dow = (s + d) % 7; mask |= 1 << dow; if (dow === 0 || dow === 6) wk = true; }
    if (wk) out.push(mask);
  }
  return out;
});

// feasibility of each role for a householder of sex hs and exact age a (else the slot becomes 'relative')
const ROLE_OK = new Uint8Array(NROLE * 2 * NA);
for (let role = 1; role < NROLE; role++) for (let hs = 0; hs < 2; hs++) for (let a = A0; a <= MAX_AGE; a++) ROLE_OK[(role * 2 + hs) * NA + a - A0] = roleFeasible(role, hs, a) ? 1 : 0;

/** A child's heritage from the householder's (H) and the spouse's or partner's (S); mirrored in the calibration. */
function childHeritage(H, S, r) {
  if (S === H) return H;
  const gH = H_GROUP[H], gS = H_GROUP[S];
  if (gH === gS) return r.float() < 0.6 ? H : S;
  if (gH === G_HISP) return r.float() < 0.7 ? H : S;
  if (gS === G_HISP) return r.float() < 0.7 ? S : H;
  const u = r.float();
  return u < 0.5 ? H_MULTI : u < 0.8 ? H : S;
}

const OCC_IDX = Object.fromEntries(OCC_GROUPS.map((g, i) => [g, i]));
const popcount = m => { let n = 0; for (; m; m &= m - 1) n++; return n; };

/** Commute-day mask (Sun = 1 ... Sat = 64) for a work pattern. */
function workDays(prof, shift, partTime, long, r) {
  if (shift === 'h24') { const s = r.int(3); let mask = 0; for (let d = s; d < 7; d += 3) mask |= 1 << d; return mask; }
  const n = partTime ? 3 + r.int(2) : long ? 3 : r.float() < 0.06 ? 4 : 5;
  if (r.float() < prof.weekend) { const runs = WEEKEND_RUNS[n]; return runs[r.int(runs.length)]; }
  if (n === 5) return 62;
  const s = 1 + r.int(6 - n);
  let mask = 0; for (let d = 0; d < n; d++) mask |= 1 << (s + d);
  return mask;
}

/** Minutes at work for a pattern (a 24-hour shift, 12-hour shifts, 4x10s, part time or a regular day). */
function dwellFor(gkey, shift, partTime, long, nDays, r) {
  if (shift === 'h24') return 1440;
  if (partTime) return 240 + 30 * r.int(4);
  if (long) return 735 + 15 * r.int(3);
  if (gkey === 'military') return 540 + 15 * r.int(5);
  if (nDays === 4) return 630;
  return 480 + 15 * r.int(6);
}

/** Shift start (minutes after midnight), on a quarter-hour grid. */
function startMinute(shift, gkey, r) {
  switch (shift) {
    case 'early': return gkey === 'farming' ? 300 + 15 * r.int(7) : gkey === 'construction' ? 345 + 15 * r.int(5) : gkey === 'education' ? 405 + 15 * r.int(4) : 270 + 15 * r.int(11);
    case 'day': return 420 + 15 * (r.int(6) + r.int(6));
    case 'mid': return 600 + 15 * r.int(9);
    case 'evening': return 840 + 15 * r.int(13);
    case 'night': return 1260 + 15 * r.int(9);
    case 'h24': return 420 + 15 * r.int(5);
  }
  return 480;
}

/** Typical one-way distance (km) covered by a mode in a given time; driving is slower in dense places. */
function tripKm(mi, minutes, urban) {
  const v = SPEED[mi] * (mi === M_DRIVE || mi === M_CARPOOL || mi === M_MOTO || mi === M_TAXI ? 1 - 0.3 * urban : 1);
  return v * Math.max(1, minutes - OVERHEAD[mi]) / 60;
}

// ------------------------------------------------------------------ layer 1 data: origins, languages, birthplaces

// Home-language keys by C16001 bucket (1 spanish ... 12 other; 0 is English only).
const LANG_BUCKETS = ['english', 'spanish', 'french', 'german', 'slavic', 'indoeuro', 'korean', 'chinese', 'vietnamese', 'tagalog', 'asianpi', 'arabic', 'other'];
const LANG_BUCKET_OF = {};
for (const [b, list] of Object.entries({
  0: 'english', 1: 'spanish', 2: 'french haitian', 3: 'german dutch yiddish afrikaans',
  4: 'russian ukrainian polish serbian croatian czech bulgarian',
  5: 'portuguese italian greek armenian farsi dari pashto hindi urdu punjabi gujarati bengali marathi nepali sinhala romanian albanian swedish norwegian danish catalan',
  6: 'korean', 7: 'cantonese mandarin taishanese hokkien', 8: 'vietnamese', 9: 'tagalog',
  10: 'japanese hmong khmer lao mien thai telugu tamil malayalam kannada burmese karen indonesian malay ilocano cebuano samoan tongan chamorro fijian hawaiian marshallese mongolian',
  11: 'arabic',
  12: 'assyrian amharic tigrinya oromo somali hebrew turkish hungarian yoruba igbo swahili twi wolof navajo mixtec zapotec kiche mam qanjobal basque finnish uzbek',
})) for (const k of list.split(' ')) LANG_BUCKET_OF[k] = +b;

// origin: [heritage, label, foreign-born share, home-language retention beyond the second generation,
//          home-language use among immigrants and their children (relative), earliest arrival year,
//          languages 'key:weight ...', birthplaces 'Place:weight@langs|...', share of US-born adults born in a territory]
const ORIGIN_ROWS = {
  mexican: ['mexican', 'Mexican American', 0.36, 0.22, 1, 1900, 'spanish:1 mixtec:.014 zapotec:.009', 'Guadalajara, Jalisco:10|Morelia, Michoacán:6|Uruapan, Michoacán:3|Zamora, Michoacán:3|León, Guanajuato:5|Celaya, Guanajuato:3|Mexico City:6|Zacatecas, Zacatecas:4|Fresnillo, Zacatecas:2|Oaxaca, Oaxaca:3@zapotec,mixtec|Santiago Juxtlahuaca, Oaxaca:2@mixtec|Tijuana, Baja California:4|Mexicali, Baja California:3|Culiacán, Sinaloa:3|Mazatlán, Sinaloa:2|Acapulco, Guerrero:2|Puebla, Puebla:3|Aguascalientes, Aguascalientes:2|San Luis Potosí, San Luis Potosí:2|Querétaro, Querétaro:1|Durango, Durango:2|Tepic, Nayarit:2|Colima, Colima:1|Hermosillo, Sonora:2|Chihuahua, Chihuahua:1|Monterrey, Nuevo León:1|Toluca, State of Mexico:1|Veracruz, Veracruz:1'],
  salvadoran: ['salvadoran', 'Salvadoran American', 0.55, 0.18, 1, 1965, 'spanish:1', 'San Salvador, El Salvador:6|Santa Ana, El Salvador:3|San Miguel, El Salvador:3|Usulután, El Salvador:2|La Unión, El Salvador:2|Chalatenango, El Salvador:1|Sonsonate, El Salvador:1'],
  guatemalan: ['guatemalan', 'Guatemalan American', 0.6, 0.18, 1, 1970, 'spanish:.86 kiche:.06 mam:.05 qanjobal:.03', 'Guatemala City, Guatemala:6|Quetzaltenango, Guatemala:3@kiche|Huehuetenango, Guatemala:3@mam,qanjobal|San Marcos, Guatemala:2@mam|Totonicapán, Guatemala:1@kiche|Escuintla, Guatemala:1'],
  honduran: ['honduran', 'Honduran American', 0.6, 0.18, 1, 1970, 'spanish:1', 'Tegucigalpa, Honduras:4|San Pedro Sula, Honduras:4|La Ceiba, Honduras:2|Choluteca, Honduras:1'],
  nicaraguan: ['nicaraguan', 'Nicaraguan American', 0.55, 0.18, 1, 1960, 'spanish:1', 'Managua, Nicaragua:6|León, Nicaragua:2|Granada, Nicaragua:2|Chinandega, Nicaragua:1'],
  puertorican: ['puertorican', 'Puerto Rican American', 0, 0.2, 0.95, 1900, 'spanish:1', '', 0.38],
  cuban: ['cuban', 'Cuban American', 0.5, 0.18, 1, 1959, 'spanish:1', 'Havana, Cuba:6|Santiago de Cuba, Cuba:2|Matanzas, Cuba:1|Camagüey, Cuba:1|Santa Clara, Cuba:1'],
  dominican: ['dominican', 'Dominican American', 0.5, 0.18, 1, 1965, 'spanish:1', 'Santo Domingo, Dominican Republic:5|Santiago, Dominican Republic:2|San Pedro de Macorís, Dominican Republic:1'],
  colombian: ['southamerican', 'Colombian American', 0.6, 0.15, 1, 1960, 'spanish:1', 'Bogotá, Colombia:4|Medellín, Colombia:3|Cali, Colombia:2|Barranquilla, Colombia:1'],
  peruvian: ['southamerican', 'Peruvian American', 0.6, 0.15, 1, 1960, 'spanish:1', 'Lima, Peru:6|Arequipa, Peru:1|Trujillo, Peru:1'],
  argentinian: ['southamerican', 'Argentine American', 0.6, 0.12, 0.95, 1950, 'spanish:1', 'Buenos Aires, Argentina:6|Córdoba, Argentina:1|Rosario, Argentina:1|Mendoza, Argentina:1'],
  ecuadorian: ['southamerican', 'Ecuadorian American', 0.6, 0.15, 1, 1960, 'spanish:1', 'Guayaquil, Ecuador:4|Quito, Ecuador:3|Cuenca, Ecuador:2'],
  venezuelan: ['southamerican', 'Venezuelan American', 0.7, 0.12, 1, 1980, 'spanish:1', 'Caracas, Venezuela:5|Maracaibo, Venezuela:2|Valencia, Venezuela:2'],
  chilean: ['southamerican', 'Chilean American', 0.6, 0.12, 0.95, 1960, 'spanish:1', 'Santiago, Chile:5|Valparaíso, Chile:2|Concepción, Chile:1'],
  bolivian: ['southamerican', 'Bolivian American', 0.6, 0.15, 1, 1960, 'spanish:1', 'La Paz, Bolivia:3|Cochabamba, Bolivia:3|Santa Cruz, Bolivia:2'],
  uruguayan: ['southamerican', 'Uruguayan American', 0.6, 0.12, 0.95, 1960, 'spanish:1', 'Montevideo, Uruguay:1'],
  paraguayan: ['southamerican', 'Paraguayan American', 0.6, 0.15, 1, 1960, 'spanish:1', 'Asunción, Paraguay:1'],
  spanish: ['spanish', 'Spanish American', 0.15, 0.08, 0.85, 1900, 'spanish:.95 catalan:.05', 'Madrid, Spain:4|Barcelona, Spain:2@catalan|Seville, Spain:1|Valencia, Spain:1|Málaga, Spain:1'],
  latino: ['latino', 'Latino', 0.12, 0.2, 0.9, 1900, 'spanish:1', 'Guadalajara, Jalisco:2|San Salvador, El Salvador:1|Guatemala City, Guatemala:1|Tegucigalpa, Honduras:1|Lima, Peru:1'],
  costarican: ['latino', 'Costa Rican American', 0.55, 0.15, 1, 1960, 'spanish:1', 'San José, Costa Rica:4|Alajuela, Costa Rica:1|Limón, Costa Rica:1'],
  panamanian: ['latino', 'Panamanian American', 0.45, 0.15, 0.95, 1960, 'spanish:1', 'Panama City, Panama:4|Colón, Panama:1|David, Panama:1'],
  centralamerican: ['latino', 'Central American', 0.55, 0.15, 1, 1965, 'spanish:1', 'San Salvador, El Salvador:1|Guatemala City, Guatemala:1|Tegucigalpa, Honduras:1|Managua, Nicaragua:1|Belize City, Belize:1'],
  chinese: ['chinese', 'Chinese American', 0.6, 0.12, 1, 1850, 'cantonese:1 mandarin:1 taishanese:.05', 'Guangzhou, Guangdong:6@cantonese|Taishan, Guangdong:2@taishanese,cantonese|Hong Kong:6@cantonese|Shenzhen, Guangdong:2@cantonese|Macau:1@cantonese|Shanghai:4@mandarin|Beijing:4@mandarin|Fuzhou, Fujian:2@mandarin|Chengdu, Sichuan:2@mandarin|Wuhan, Hubei:1@mandarin|Nanjing, Jiangsu:1@mandarin|Harbin, Heilongjiang:1@mandarin|Xi\'an, Shaanxi:1@mandarin'],
  taiwanese: ['chinese', 'Taiwanese American', 0.65, 0.1, 1, 1960, 'mandarin:.85 hokkien:.15', 'Taipei, Taiwan:6|Kaohsiung, Taiwan:2|Taichung, Taiwan:2|Tainan, Taiwan:1|Hsinchu, Taiwan:1'],
  filipino: ['filipino', 'Filipino American', 0.52, 0.05, 0.75, 1900, 'tagalog:.78 ilocano:.13 cebuano:.09', 'Manila, Philippines:6@tagalog|Quezon City, Philippines:4@tagalog|San Fernando, Pampanga:2@tagalog|Batangas City, Philippines:2@tagalog|Cavite City, Philippines:2@tagalog|Laoag, Ilocos Norte:2@ilocano|Vigan, Ilocos Sur:1@ilocano|Baguio, Philippines:1@ilocano|Cebu City, Philippines:2@cebuano|Davao City, Philippines:1@cebuano|Iloilo City, Philippines:1'],
  vietnamese: ['vietnamese', 'Vietnamese American', 0.6, 0.15, 1, 1975, 'vietnamese:.96 cantonese:.04', 'Saigon, Vietnam:8|Hanoi, Vietnam:2|Da Nang, Vietnam:2|Hue, Vietnam:1|Nha Trang, Vietnam:1|Can Tho, Vietnam:1|Vung Tau, Vietnam:1'],
  korean: ['korean', 'Korean American', 0.62, 0.1, 1, 1903, 'korean:1', 'Seoul, South Korea:8|Busan, South Korea:3|Incheon, South Korea:2|Daegu, South Korea:2|Gwangju, South Korea:1|Daejeon, South Korea:1'],
  japanese: ['japanese', 'Japanese American', 0.28, 0.03, 0.9, 1885, 'japanese:1', 'Tokyo, Japan:5|Osaka, Japan:2|Yokohama, Japan:2|Nagoya, Japan:1|Fukuoka, Japan:1|Hiroshima, Japan:1|Sapporo, Japan:1'],
  okinawan: ['japanese', 'Okinawan American', 0.3, 0.03, 0.85, 1900, 'japanese:1', 'Naha, Okinawa:1'],
  indian: ['indian', 'Indian American', 0.65, 0.08, 0.85, 1950, 'hindi:.30 punjabi:.20 telugu:.15 tamil:.10 gujarati:.09 malayalam:.05 marathi:.03 bengali:.03 kannada:.03 urdu:.02', 'Ludhiana, Punjab, India:2@punjabi|Jalandhar, Punjab, India:2@punjabi|Amritsar, Punjab, India:1@punjabi|New Delhi, India:4@hindi,punjabi|Lucknow, India:1@hindi,urdu|Jaipur, India:1@hindi|Mumbai, India:3@hindi,marathi|Pune, India:1@marathi|Hyderabad, India:3@telugu,urdu|Vijayawada, India:1@telugu|Bengaluru, India:3@kannada,tamil,telugu|Chennai, India:3@tamil|Coimbatore, India:1@tamil|Ahmedabad, Gujarat, India:2@gujarati|Vadodara, Gujarat, India:1@gujarati|Kolkata, India:1@bengali|Kochi, Kerala, India:1@malayalam'],
  sikh: ['sikh', 'Punjabi Sikh American', 0.6, 0.12, 1, 1900, 'punjabi:1', 'Ludhiana, Punjab, India:3|Jalandhar, Punjab, India:3|Amritsar, Punjab, India:2|Hoshiarpur, Punjab, India:2|Patiala, Punjab, India:1'],
  hmong: ['hmong', 'Hmong American', 0.35, 0.3, 1, 1976, 'hmong:1', 'Xieng Khouang, Laos:3|Luang Prabang, Laos:2|Long Cheng, Laos:1|Ban Vinai refugee camp, Thailand:3|Chiang Kham refugee camp, Thailand:1'],
  cambodian: ['cambodian', 'Cambodian American', 0.45, 0.15, 1, 1975, 'khmer:1', 'Phnom Penh, Cambodia:4|Battambang, Cambodia:3|Siem Reap, Cambodia:1|Kampong Cham, Cambodia:1|Khao-I-Dang refugee camp, Thailand:2'],
  lao: ['lao', 'Lao American', 0.45, 0.15, 1, 1975, 'lao:1', 'Vientiane, Laos:4|Savannakhet, Laos:2|Pakse, Laos:1|Luang Prabang, Laos:1|Nong Khai refugee camp, Thailand:1'],
  mien: ['lao', 'Iu Mien American', 0.45, 0.2, 1, 1978, 'mien:1', 'Nan Province, Thailand:2|Luang Namtha, Laos:2|Phou Kao refugee camp, Thailand:1'],
  thai: ['thai', 'Thai American', 0.62, 0.08, 0.9, 1965, 'thai:1', 'Bangkok, Thailand:5|Chiang Mai, Thailand:1|Udon Thani, Thailand:1|Khon Kaen, Thailand:1'],
  pakistani: ['pakistani', 'Pakistani American', 0.6, 0.1, 0.9, 1965, 'urdu:.6 punjabi:.3 pashto:.1', 'Karachi, Pakistan:4@urdu|Lahore, Pakistan:3@punjabi,urdu|Islamabad, Pakistan:2@urdu|Faisalabad, Pakistan:1@punjabi|Peshawar, Pakistan:1@pashto'],
  bangladeshi: ['bangladeshi', 'Bangladeshi American', 0.65, 0.1, 0.95, 1975, 'bengali:1', 'Dhaka, Bangladesh:4|Chittagong, Bangladesh:2|Sylhet, Bangladesh:2'],
  afghan: ['afghan', 'Afghan American', 0.6, 0.15, 1, 1979, 'dari:.65 pashto:.35', 'Kabul, Afghanistan:5@dari,pashto|Herat, Afghanistan:2@dari|Mazar-i-Sharif, Afghanistan:1@dari|Kandahar, Afghanistan:1@pashto|Jalalabad, Afghanistan:1@pashto|Peshawar, Pakistan:1@pashto,dari'],
  burmese: ['burmese', 'Burmese American', 0.75, 0.12, 1, 1985, 'burmese:.75 karen:.25', 'Yangon, Myanmar:4@burmese|Mandalay, Myanmar:2@burmese|Hpa-an, Myanmar:1@karen|Mae La refugee camp, Thailand:1@karen'],
  indonesian: ['indonesian', 'Indonesian American', 0.7, 0.08, 0.85, 1965, 'indonesian:1', 'Jakarta, Indonesia:4|Surabaya, Indonesia:2|Bandung, Indonesia:1|Medan, Indonesia:1|Manado, Indonesia:1'],
  nepali: ['asian', 'Nepali American', 0.75, 0.1, 0.95, 1990, 'nepali:1', 'Kathmandu, Nepal:3|Pokhara, Nepal:1'],
  srilankan: ['asian', 'Sri Lankan American', 0.7, 0.08, 0.9, 1975, 'sinhala:.75 tamil:.25', 'Colombo, Sri Lanka:3|Kandy, Sri Lanka:1@sinhala|Jaffna, Sri Lanka:1@tamil'],
  malaysian: ['asian', 'Malaysian American', 0.7, 0.08, 0.8, 1975, 'malay:.55 cantonese:.45', 'Kuala Lumpur, Malaysia:3|Penang, Malaysia:1@cantonese|Johor Bahru, Malaysia:1'],
  mongolian: ['asian', 'Mongolian American', 0.75, 0.1, 1, 1992, 'mongolian:1', 'Ulaanbaatar, Mongolia:1'],
  singaporean: ['asian', 'Singaporean American', 0.7, 0.05, 0.6, 1970, 'mandarin:.6 malay:.2 tamil:.2', 'Singapore:1'],
  bhutanese: ['asian', 'Bhutanese American', 0.8, 0.15, 1, 2008, 'nepali:1', 'Beldangi refugee camp, Nepal:2|Thimphu, Bhutan:1'],
  uzbek: ['asian', 'Uzbek American', 0.75, 0.1, 1, 1992, 'uzbek:.6 russian:.4', 'Tashkent, Uzbekistan:2|Samarkand, Uzbekistan:1'],
  asianamerican: ['asian', 'Asian American', 0.35, 0.05, 0.6, 1900, 'mandarin:.3 tagalog:.2 korean:.2 vietnamese:.15 hindi:.15', 'Manila, Philippines:1|Taipei, Taiwan:1|Seoul, South Korea:1|Saigon, Vietnam:1|New Delhi, India:1'],
  africanamerican: ['african-american', 'African American', 0.02, 0, 0, 1900, '', 'Kingston, Jamaica:1|Lagos, Nigeria:1|Accra, Ghana:1'],
  ethiopian: ['ethiopian', 'Ethiopian American', 0.65, 0.12, 1, 1980, 'amharic:.7 oromo:.18 tigrinya:.12', 'Addis Ababa, Ethiopia:6@amharic,oromo|Gondar, Ethiopia:1@amharic|Bahir Dar, Ethiopia:1@amharic|Mekelle, Ethiopia:1@tigrinya|Adama, Ethiopia:1@oromo|Dire Dawa, Ethiopia:1@amharic,oromo'],
  nigerian: ['nigerian', 'Nigerian American', 0.55, 0.03, 0.55, 1975, 'yoruba:.5 igbo:.5', 'Lagos, Nigeria:5@yoruba|Ibadan, Nigeria:2@yoruba|Abuja, Nigeria:2|Enugu, Nigeria:2@igbo|Owerri, Nigeria:1@igbo|Port Harcourt, Nigeria:1@igbo|Benin City, Nigeria:1'],
  jamaican: ['caribbean', 'Jamaican American', 0.55, 0, 0, 1950, '', 'Kingston, Jamaica:4|Montego Bay, Jamaica:1|Spanish Town, Jamaica:1'],
  haitian: ['caribbean', 'Haitian American', 0.6, 0.1, 0.85, 1960, 'haitian:1', 'Port-au-Prince, Haiti:4|Cap-Haïtien, Haiti:1'],
  trinidadian: ['caribbean', 'Trinidadian American', 0.6, 0, 0, 1960, '', 'Port of Spain, Trinidad and Tobago:2|San Fernando, Trinidad and Tobago:1'],
  barbadian: ['caribbean', 'Barbadian American', 0.6, 0, 0, 1960, '', 'Bridgetown, Barbados:1'],
  belizean: ['caribbean', 'Belizean American', 0.6, 0.05, 0.3, 1960, 'spanish:1', 'Belize City, Belize:2|Belmopan, Belize:1'],
  westindian: ['caribbean', 'West Indian American', 0.55, 0, 0, 1950, '', 'Nassau, Bahamas:1|Georgetown, Guyana:1|Castries, Saint Lucia:1'],
  eritrean: ['african', 'Eritrean American', 0.65, 0.12, 1, 1985, 'tigrinya:1', 'Asmara, Eritrea:4|Keren, Eritrea:1|Massawa, Eritrea:1'],
  somali: ['african', 'Somali American', 0.65, 0.15, 1, 1991, 'somali:1', 'Mogadishu, Somalia:3|Hargeisa, Somalia:1|Kismayo, Somalia:1|Dadaab refugee camp, Kenya:1'],
  kenyan: ['african', 'Kenyan American', 0.65, 0.05, 0.6, 1975, 'swahili:1', 'Nairobi, Kenya:4|Mombasa, Kenya:1|Kisumu, Kenya:1'],
  ghanaian: ['african', 'Ghanaian American', 0.65, 0.05, 0.6, 1975, 'twi:1', 'Accra, Ghana:3|Kumasi, Ghana:2'],
  southafrican: ['african', 'South African American', 0.7, 0.03, 0.3, 1965, 'afrikaans:1', 'Johannesburg, South Africa:3|Cape Town, South Africa:2|Durban, South Africa:1|Pretoria, South Africa:1'],
  cameroonian: ['african', 'Cameroonian American', 0.7, 0.05, 0.7, 1985, 'french:1', 'Douala, Cameroon:2|Yaoundé, Cameroon:2|Bamenda, Cameroon:1'],
  sudanese: ['african', 'Sudanese American', 0.7, 0.1, 0.9, 1990, 'arabic:1', 'Khartoum, Sudan:3|Omdurman, Sudan:1'],
  ugandan: ['african', 'Ugandan American', 0.7, 0.03, 0.4, 1975, 'swahili:1', 'Kampala, Uganda:2|Entebbe, Uganda:1'],
  liberian: ['african', 'Liberian American', 0.7, 0, 0, 1985, '', 'Monrovia, Liberia:2'],
  senegalese: ['african', 'Senegalese American', 0.75, 0.08, 0.9, 1985, 'wolof:.6 french:.4', 'Dakar, Senegal:3|Thiès, Senegal:1'],
  armenian: ['armenian', 'Armenian American', 0.6, 0.2, 1, 1900, 'armenian:.9 russian:.1', 'Yerevan, Armenia:6@armenian,russian|Gyumri, Armenia:2|Vanadzor, Armenia:1|Tehran, Iran:3@armenian,farsi|Beirut, Lebanon:2@armenian,arabic|Aleppo, Syria:2@armenian,arabic|Baku, Azerbaijan:1@armenian,russian|Moscow, Russia:1@russian'],
  iranian: ['iranian', 'Iranian American', 0.65, 0.1, 0.95, 1960, 'farsi:1', 'Tehran, Iran:8|Shiraz, Iran:2|Isfahan, Iran:2|Mashhad, Iran:1|Tabriz, Iran:1|Rasht, Iran:1'],
  egyptian: ['arab', 'Egyptian American', 0.6, 0.1, 0.9, 1960, 'arabic:1', 'Cairo, Egypt:4|Alexandria, Egypt:2|Asyut, Egypt:1'],
  lebanese: ['arab', 'Lebanese American', 0.5, 0.1, 0.85, 1900, 'arabic:1', 'Beirut, Lebanon:4|Tripoli, Lebanon:1|Zahle, Lebanon:1|Sidon, Lebanon:1'],
  iraqi: ['arab', 'Iraqi American', 0.65, 0.12, 0.95, 1970, 'arabic:1', 'Baghdad, Iraq:4|Basra, Iraq:2|Mosul, Iraq:1'],
  syrian: ['arab', 'Syrian American', 0.6, 0.1, 0.95, 1960, 'arabic:1', 'Damascus, Syria:3|Aleppo, Syria:2|Homs, Syria:1'],
  palestinian: ['arab', 'Palestinian American', 0.55, 0.12, 0.95, 1950, 'arabic:1', 'Ramallah, West Bank:2|Nablus, West Bank:1|Gaza City, Gaza:1|Amman, Jordan:1'],
  jordanian: ['arab', 'Jordanian American', 0.6, 0.1, 0.95, 1960, 'arabic:1', 'Amman, Jordan:3|Irbid, Jordan:1|Zarqa, Jordan:1'],
  yemeni: ['arab', 'Yemeni American', 0.65, 0.15, 1, 1965, 'arabic:1', 'Sanaa, Yemen:2|Ibb, Yemen:1|Aden, Yemen:1'],
  arab: ['arab', 'Arab American', 0.5, 0.1, 0.9, 1900, 'arabic:1', 'Beirut, Lebanon:1|Cairo, Egypt:1|Baghdad, Iraq:1|Damascus, Syria:1|Amman, Jordan:1'],
  assyrian: ['assyrian', 'Assyrian American', 0.6, 0.2, 1, 1900, 'assyrian:.85 arabic:.15', 'Baghdad, Iraq:3|Kirkuk, Iraq:1|Mosul, Iraq:1|Urmia, Iran:2|Tehran, Iran:2|Qamishli, Syria:1'],
  chaldean: ['assyrian', 'Chaldean American', 0.6, 0.2, 1, 1950, 'assyrian:.6 arabic:.4', 'Baghdad, Iraq:3@arabic,assyrian|Telkaif, Iraq:2@assyrian|Mosul, Iraq:1|Alqosh, Iraq:1@assyrian'],
  russian: ['russian', 'Russian American', 0.5, 0.06, 0.95, 1900, 'russian:1', 'Moscow, Russia:5|Saint Petersburg, Russia:3|Novosibirsk, Russia:1|Yekaterinburg, Russia:1|Vladivostok, Russia:1|Kazan, Russia:1'],
  ukrainian: ['ukrainian', 'Ukrainian American', 0.55, 0.06, 0.95, 1900, 'ukrainian:.55 russian:.45', 'Kyiv, Ukraine:4|Kharkiv, Ukraine:2@russian|Odesa, Ukraine:2@russian|Lviv, Ukraine:2@ukrainian|Dnipro, Ukraine:1'],
  polish: ['polish', 'Polish American', 0.18, 0.02, 0.85, 1900, 'polish:1', 'Warsaw, Poland:3|Kraków, Poland:2|Gdańsk, Poland:1|Wrocław, Poland:1'],
  irish: ['irish', 'Irish American', 0.02, 0, 0, 1850, '', 'Dublin, Ireland:3|Cork, Ireland:2|Galway, Ireland:1|Limerick, Ireland:1'],
  italian: ['italian', 'Italian American', 0.05, 0.01, 0.75, 1880, 'italian:1', 'Rome, Italy:2|Naples, Italy:2|Palermo, Sicily:2|Milan, Italy:2|Genoa, Italy:1|Lucca, Tuscany:1|Turin, Italy:1'],
  german: ['german', 'German American', 0.04, 0.005, 0.7, 1850, 'german:1', 'Munich, Germany:2|Berlin, Germany:2|Hamburg, Germany:2|Frankfurt, Germany:1|Stuttgart, Germany:1|Cologne, Germany:1'],
  english: ['english', 'English American', 0.04, 0, 0, 1850, '', 'London, England:5|Manchester, England:1|Birmingham, England:1|Leeds, England:1|Bristol, England:1'],
  scottish: ['scottish', 'Scottish American', 0.03, 0, 0, 1850, '', 'Glasgow, Scotland:3|Edinburgh, Scotland:2|Aberdeen, Scotland:1'],
  scotchirish: ['scottish', 'Scotch-Irish American', 0.01, 0, 0, 1850, '', 'Belfast, Northern Ireland:2|Derry, Northern Ireland:1'],
  french: ['french', 'French American', 0.06, 0.01, 0.7, 1850, 'french:1', 'Paris, France:4|Lyon, France:1|Marseille, France:1|Bordeaux, France:1|Toulouse, France:1'],
  portuguese: ['portuguese', 'Portuguese American', 0.18, 0.06, 0.9, 1870, 'portuguese:1', 'Ponta Delgada, Azores:3|Angra do Heroísmo, Azores:2|Horta, Azores:1|Lisbon, Portugal:2|Porto, Portugal:1|Funchal, Madeira:1'],
  brazilian: ['portuguese', 'Brazilian American', 0.65, 0.08, 0.95, 1965, 'portuguese:1', 'São Paulo, Brazil:4|Rio de Janeiro, Brazil:3|Belo Horizonte, Brazil:2|Curitiba, Brazil:1|Goiânia, Brazil:1'],
  dutch: ['dutch', 'Dutch American', 0.06, 0.005, 0.6, 1850, 'dutch:1', 'Amsterdam, Netherlands:3|Rotterdam, Netherlands:1|Utrecht, Netherlands:1'],
  swedish: ['scandinavian', 'Swedish American', 0.04, 0.003, 0.6, 1850, 'swedish:1', 'Stockholm, Sweden:3|Gothenburg, Sweden:1|Malmö, Sweden:1'],
  norwegian: ['scandinavian', 'Norwegian American', 0.04, 0.003, 0.6, 1850, 'norwegian:1', 'Oslo, Norway:3|Bergen, Norway:1|Stavanger, Norway:1'],
  danish: ['scandinavian', 'Danish American', 0.04, 0.003, 0.6, 1850, 'danish:1', 'Copenhagen, Denmark:3|Aarhus, Denmark:1'],
  greek: ['greek', 'Greek American', 0.15, 0.04, 0.85, 1890, 'greek:1', 'Athens, Greece:4|Thessaloniki, Greece:2|Heraklion, Crete:1|Patras, Greece:1'],
  basque: ['european', 'Basque American', 0.15, 0.04, 0.8, 1870, 'basque:.4 spanish:.6', 'Bilbao, Spain:2|San Sebastián, Spain:1|Pamplona, Spain:1|Bayonne, France:1'],
  turkish: ['european', 'Turkish American', 0.6, 0.1, 0.9, 1965, 'turkish:1', 'Istanbul, Turkey:4|Ankara, Turkey:2|Izmir, Turkey:1'],
  israeli: ['european', 'Israeli American', 0.6, 0.08, 0.9, 1960, 'hebrew:1', 'Tel Aviv, Israel:3|Jerusalem, Israel:2|Haifa, Israel:1'],
  australian: ['european', 'Australian American', 0.6, 0, 0, 1900, '', 'Sydney, Australia:3|Melbourne, Australia:2|Brisbane, Australia:1|Perth, Australia:1'],
  canadian: ['european', 'Canadian American', 0.5, 0.02, 0.2, 1900, 'french:1', 'Toronto, Ontario:3|Vancouver, British Columbia:3|Montreal, Quebec:2@french|Calgary, Alberta:1|Ottawa, Ontario:1'],
  swiss: ['european', 'Swiss American', 0.25, 0.01, 0.6, 1870, 'german:.6 french:.3 italian:.1', 'Zurich, Switzerland:2@german|Geneva, Switzerland:1@french|Bern, Switzerland:1@german|Lugano, Switzerland:1@italian'],
  hungarian: ['european', 'Hungarian American', 0.25, 0.02, 0.8, 1900, 'hungarian:1', 'Budapest, Hungary:3|Debrecen, Hungary:1'],
  czech: ['european', 'Czech American', 0.2, 0.01, 0.8, 1900, 'czech:1', 'Prague, Czech Republic:3|Brno, Czech Republic:1'],
  romanian: ['european', 'Romanian American', 0.45, 0.05, 0.9, 1950, 'romanian:1', 'Bucharest, Romania:3|Cluj-Napoca, Romania:1|Timișoara, Romania:1|Iași, Romania:1'],
  european: ['european', 'European American', 0.25, 0.02, 0.8, 1900, 'serbian:.3 croatian:.2 bulgarian:.2 albanian:.15 finnish:.15', 'Belgrade, Serbia:1@serbian|Zagreb, Croatia:1@croatian|Sofia, Bulgaria:1@bulgarian|Tirana, Albania:1@albanian|Helsinki, Finland:1@finnish|Vienna, Austria:1'],
  american: ['american', 'American', 0.01, 0, 0, 1900, '', 'Toronto, Ontario:1|London, England:1'],
  native: ['native', 'Native American', 0.03, 0.04, 0.5, 1900, 'navajo:1', 'Oaxaca, Oaxaca:1|Gallup, New Mexico:1'],
  samoan: ['pacific', 'Samoan American', 0.15, 0.15, 0.95, 1950, 'samoan:1', 'Apia, Samoa:1', 0.3],
  tongan: ['pacific', 'Tongan American', 0.4, 0.15, 1, 1965, 'tongan:1', "Nuku'alofa, Tonga:3|Neiafu, Tonga:1"],
  nativehawaiian: ['pacific', 'Native Hawaiian', 0.02, 0.02, 0.3, 1900, 'hawaiian:1', '', 0.45],
  chamorro: ['pacific', 'Chamorro American', 0.05, 0.05, 0.6, 1950, 'chamorro:1', '', 0.5],
  fijian: ['pacific', 'Fijian American', 0.6, 0.12, 0.95, 1970, 'hindi:.55 fijian:.45', 'Suva, Fiji:3@fijian,hindi|Lautoka, Fiji:2@hindi|Nadi, Fiji:1@hindi'],
  marshallese: ['pacific', 'Marshallese American', 0.7, 0.2, 1, 1990, 'marshallese:1', 'Majuro, Marshall Islands:2|Ebeye, Marshall Islands:1'],
  pacificislander: ['pacific', 'Pacific Islander American', 0.3, 0.1, 0.8, 1950, 'samoan:.5 tongan:.5', 'Apia, Samoa:1|Suva, Fiji:1'],
  multiracial: ['multiracial', 'Multiracial', 0.1, 0, 0, 1900, '', 'Manila, Philippines:1|Mexico City:1|Seoul, South Korea:1|London, England:1'],
  otherrace: ['other', 'American', 0.3, 0.05, 0.5, 1900, 'spanish:.5 portuguese:.5', 'São Paulo, Brazil:1|Mexico City:1|Lima, Peru:1'],
};
const TERRITORY_BIRTH = {
  puertorican: 'San Juan, Puerto Rico:4|Bayamón, Puerto Rico:2|Ponce, Puerto Rico:2|Carolina, Puerto Rico:1|Mayagüez, Puerto Rico:1',
  samoan: 'Pago Pago, American Samoa:1',
  nativehawaiian: 'Honolulu, Hawaii:4|Hilo, Hawaii:1|Kahului, Hawaii:1',
  chamorro: 'Hagåtña, Guam:2|Dededo, Guam:1|Saipan, Northern Mariana Islands:1',
};
// heritage -> origins with default weights (a ZIP's own ancestry counts refine some of them)
const HERITAGE_ORIGINS = {
  mexican: 'mexican', salvadoran: 'salvadoran', guatemalan: 'guatemalan', honduran: 'honduran', nicaraguan: 'nicaraguan',
  puertorican: 'puertorican', cuban: 'cuban', dominican: 'dominican', spanish: 'spanish',
  southamerican: 'colombian:20 peruvian:18 argentinian:12 ecuadorian:8 venezuelan:8 chilean:8 bolivian:4 uruguayan:2 paraguayan:1',
  latino: 'latino:5 costarican:1 panamanian:1 centralamerican:0.5',
  chinese: 'chinese:85 taiwanese:15', filipino: 'filipino', vietnamese: 'vietnamese', korean: 'korean', japanese: 'japanese:95 okinawan:5',
  indian: 'indian', hmong: 'hmong', cambodian: 'cambodian', lao: 'lao:80 mien:20', thai: 'thai', pakistani: 'pakistani', bangladeshi: 'bangladeshi',
  sikh: 'sikh', afghan: 'afghan', burmese: 'burmese', indonesian: 'indonesian',
  asian: 'nepali:20 srilankan:18 malaysian:12 mongolian:8 singaporean:4 bhutanese:3 uzbek:3 asianamerican:30',
  'african-american': 'africanamerican', ethiopian: 'ethiopian', nigerian: 'nigerian',
  caribbean: 'jamaican:4 haitian:3 trinidadian:2 belizean:1.5 barbadian:0.8 westindian:1',
  african: 'eritrean:14 somali:12 kenyan:12 ghanaian:10 southafrican:10 cameroonian:8 sudanese:6 ugandan:5 liberian:4 senegalese:3',
  armenian: 'armenian', iranian: 'iranian', arab: 'egyptian:3 lebanese:3 iraqi:3 syrian:2 palestinian:2 jordanian:2 yemeni:2 arab:2',
  assyrian: 'assyrian:60 chaldean:40', russian: 'russian', ukrainian: 'ukrainian', polish: 'polish', irish: 'irish', italian: 'italian',
  german: 'german', english: 'english', scottish: 'scottish:2 scotchirish:1', french: 'french', portuguese: 'portuguese:3 brazilian:1',
  dutch: 'dutch', scandinavian: 'swedish:3 norwegian:3 danish:2', greek: 'greek',
  european: 'basque:1 turkish:1 israeli:1 australian:1 canadian:2 swiss:1 hungarian:1 czech:1 romanian:1 european:2',
  american: 'american', native: 'native', pacific: 'samoan:30 tongan:18 nativehawaiian:22 chamorro:12 fijian:12 marshallese:3 pacificislander:3',
  multiracial: 'multiracial', other: 'otherrace',
};
// ancestry columns that refine an origin's weight in a ZIP (B04006 counts)
const ORIGIN_ANC = {
  egyptian: 'egyptian', lebanese: 'lebanese', jamaican: 'jamaican', scottish: 'scottish', scotchirish: 'scotchirish',
  portuguese: 'portuguese', brazilian: 'brazilian', swedish: 'swedish', norwegian: 'norwegian', danish: 'danish',
  basque: 'basque', turkish: 'turkish', israeli: 'israeli', australian: 'australian', canadian: 'canadian', swiss: 'swiss',
  hungarian: 'hungarian', czech: 'czech', romanian: 'romanian',
};

const parseWeights = s => s ? s.split(/\s+/).filter(Boolean).map(p => { const [k, v] = p.split(':'); return [k, v === undefined ? 1 : +v]; }) : [];
const parsePlaces = s => s ? s.split('|').map(p => { const [rest, tags] = p.split('@'); const i = rest.lastIndexOf(':'); return { name: rest.slice(0, i), w: +rest.slice(i + 1), tags: tags ? tags.split(',') : [] }; }) : [];

/** Origins (fine-grained heritage detail): key, heritage, label, foreign-born logit, languages, birthplaces. */
const ORIGINS = Object.entries(ORIGIN_ROWS).map(([key, r], index) => {
  const langs = parseWeights(r[6]).filter(([k]) => LANG_BUCKET_OF[k] !== undefined && k !== 'english');
  const lt = langs.reduce((a, l) => a + l[1], 0);
  return {
    key, index, heritage: r[0], label: r[1], fb: r[2], beta: logit(clamp(r[2], 0.002, 0.95)) - 0.3, retain: r[3], use: r[4], since: r[5],
    langs: langs.map(([k, v]) => ({ key: k, w: v / (lt || 1), bucket: LANG_BUCKET_OF[k] })),
    places: parsePlaces(r[7]), territory: r[8] || 0, territoryPlaces: parsePlaces(TERRITORY_BIRTH[key] || ''),
  };
});
const ORIGIN_INDEX = Object.fromEntries(ORIGINS.map(o => [o.key, o.index]));
const HERITAGE_ORIGIN_LIST = HERITAGE_KEYS.map(k => parseWeights(HERITAGE_ORIGINS[k] || k).map(([o, wgt]) => [ORIGIN_INDEX[o], wgt]));

// US-born outside California: states by how many Californians were born there; older African American
// Californians were often born in the Great Migration states.
const US_STATES = parsePlaces('Texas:8|New York:7|Illinois:5|Washington:5|Arizona:5|Oregon:4|Nevada:3|Florida:4|Ohio:4|Michigan:4|Pennsylvania:4|New Jersey:3|Massachusetts:3|Colorado:3|Hawaii:3|Utah:2|Virginia:2|North Carolina:2|Georgia:2|Minnesota:2|Missouri:2|Louisiana:2|Oklahoma:2|Indiana:2|Wisconsin:1.5|Tennessee:1.5|Maryland:1.5|New Mexico:1.5|Kansas:1|Iowa:1|Idaho:1|Alabama:1|Mississippi:1|Kentucky:1|Arkansas:1|Connecticut:1|South Carolina:1|Nebraska:0.7|Montana:0.5|Alaska:0.5|West Virginia:0.4|Maine:0.4|New Hampshire:0.4|Rhode Island:0.3|District of Columbia:0.3|Vermont:0.2|Delaware:0.2|Wyoming:0.2|North Dakota:0.2|South Dakota:0.2');
const GREAT_MIGRATION = { Texas: 3, Louisiana: 6, Mississippi: 4, Arkansas: 3, Oklahoma: 2, Alabama: 2 };

// ------------------------------------------------------------------ layer 1: stage functions shared by calibration and households
//
// Every layer-1 draw is a hashed uniform of (household seed, member, attribute), so the per-ZIP calibration can
// re-run a stage on its synthetic households with new parameters and the same random numbers, and a real
// household gets exactly the stage the calibration measured.

const KA = { ORIGIN: 1, NAT: 2, NATH: 3, ARR: 4, GEN: 5, BORN: 6, BORN2: 7, LCHOICE: 8, LANG: 9, LANGH: 10, CROSS: 11, LEP: 12, EDU: 13, EDU2: 14, MAR: 15, MAR2: 16, VET: 17, UNEMP: 18, STATUS: 19, INC: 20, OCC: 21, NAME: 22, MOVED: 23, BUILT: 24, BDAY: 25, LIST: 26, SPAN: 27, TERR: 28, BORN3: 29, ROAD: 30 };
const uni = (hs, m, k) => u01(hash3(hs, m, k));
const gaussOf = (hs, m, k) => Math.sqrt(-2 * Math.log(Math.max(1e-12, uni(hs, m, k)))) * Math.cos(2 * Math.PI * uni(hs, m, k + 4096));
const ROLE_ID = Object.fromEntries(ROLE_NAMES.map((r, i) => [r, i === 9 ? R_PARENT : i]));
const natAge = a => a < 5 ? -3 : a < 10 ? -2.3 : a < 15 ? -1.7 : a < 18 ? -1.2 : a < 25 ? -0.3 : a < 35 ? 0.2 : a < 65 ? 0.35 : 0.2;
// age at arrival: mostly young adults, some children with their parents
const ARR_CUM = (() => {
  const w = x => gw(x, 24, 9) + 0.25 * gw(x, 7, 5) + 0.06;
  return Array.from({ length: MAX_AGE + 1 }, (_, a) => { let c = 0; const out = new Float64Array(a + 1); for (let x = 0; x <= a; x++) out[x] = (c += w(x)); for (let x = 0; x <= a; x++) out[x] /= c; return out; });
})();
function arrivalYearOf(age, u, since) {
  const cum = ARR_CUM[Math.min(age, MAX_AGE)];
  let x = 0; while (x < cum.length - 1 && cum[x] < u) x++;
  let y = YEAR - age + x;
  if (y < since) y = since + Math.floor(u * 6);
  return clamp(y, YEAR - age, YEAR);
}

/** Nativity inputs that do not depend on the calibrated shift (latent uniforms, offsets, who derives from whom). */
function natPrep(core, ori, hs) {
  const mem = core.members, n = mem.length, zH = gaussOf(hs, 99, KA.NATH);
  const P = { n, role: new Uint8Array(n), age: new Uint8Array(n), U: new Float64Array(n), off: new Float64Array(n), arrY: new Int16Array(n), arrT: new Int16Array(n), genU: new Float64Array(n), terr: new Uint8Array(n), fb: new Float64Array(n), g2: new Float64Array(n), spouse: -1, childList: [], grandList: [] };
  const g0 = H_GROUP[H_INDEX[ORIGINS[ori[0]].heritage]];
  for (let i = 0; i < n; i++) {
    const p = mem[i], role = ROLE_ID[p.role], o = ORIGINS[ori[i]];
    P.role[i] = role; P.age[i] = p.age;
    if ((role === R_SPOUSE || role === R_PARTNER) && P.spouse < 0) P.spouse = i;
    const same = H_GROUP[H_INDEX[o.heritage]] === g0;
    const rho = i === 0 ? 1 : same && role !== R_ROOM && role !== R_CHILD && role !== R_GRAND ? 0.7 : 0;
    P.U[i] = normCdf(rho * zH + Math.sqrt(1 - rho * rho) * gaussOf(hs, i, KA.NAT));
    P.off[i] = o.beta + natAge(p.age);
    const au = uni(hs, i, KA.ARR);
    P.arrY[i] = arrivalYearOf(p.age, au, o.since); P.arrT[i] = arrivalYearOf(p.age, au, 1945);
    P.genU[i] = uni(hs, i, KA.GEN);
    P.terr[i] = o.territory > 0 && p.age >= 18 && uni(hs, i, KA.TERR) < o.territory * (p.age >= 25 ? 1 : 0.5) ? 1 : 0;
    P.fb[i] = o.fb;
    P.g2[i] = Math.min(0.9, o.fb * 1.3 * (p.age < 18 ? 1.3 : p.age < 45 ? 1.15 : p.age < 65 ? 0.9 : 0.55));
  }
  for (let i = 0; i < n; i++) if (P.role[i] === R_CHILD) P.childList.push(i); else if (P.role[i] === R_GRAND) P.grandList.push(i);
  return P;
}

/**
 * Nativity for a household at shift alpha: nat 1 = foreign born; out 1 = born outside the 50 states (abroad or in a
 * territory); arrival = year of arrival (or of the move to the mainland); gen 1 / 2 / 3 (3 = third or more).
 * Children and grandchildren follow their parents: born before a parent arrived means they arrived too.
 */
function natDecide(P, alpha, R) {
  const n = P.n, nat = R.nat, out = R.out, arr = R.arr, gen = R.gen, age = P.age, sp = P.spouse;
  nat.fill(0); out.fill(0); arr.fill(0); gen.fill(3);
  for (let i = 0; i < n; i++) {
    const role = P.role[i];
    if (role === R_CHILD || role === R_GRAND) continue;
    let p = 1 / (1 + Math.exp(-(alpha + P.off[i])));
    if (i > 0 && (role === R_PARENT || role === R_SIB) && nat[0]) p = 1 - (1 - p) * 0.1;
    if (P.U[i] < p) { nat[i] = 1; out[i] = 1; arr[i] = P.arrY[i]; gen[i] = 1; }
    else if (P.terr[i]) { out[i] = 1; arr[i] = P.arrT[i]; gen[i] = 1; }
  }
  // children of the householder and spouse or partner: born before a parent arrived means they arrived with them
  for (let k = 0; k < P.childList.length; k++) {
    const i = P.childList[k];
    let earliest = 9999, foreignParent = 0, any = false;
    if (out[0] && age[0] >= age[i] + 14) { any = true; earliest = arr[0]; foreignParent = nat[0]; }
    if (sp >= 0 && out[sp] && age[sp] >= age[i] + 14) { any = true; if (arr[sp] < earliest) { earliest = arr[sp]; foreignParent = nat[sp]; } }
    if (!any) { gen[i] = 3; continue; }
    if (age[i] > YEAR - earliest) { out[i] = 1; nat[i] = foreignParent; arr[i] = earliest; gen[i] = 1; } else gen[i] = 2;
  }
  // grandchildren: their parents are the household's children, when they live here
  for (let k = 0; k < P.grandList.length; k++) {
    const i = P.grandList[k];
    let earliest = 9999, foreignParent = 0, any = false;
    for (let q = 0; q < P.childList.length; q++) { const j = P.childList[q]; if (out[j] && age[j] >= age[i] + 14 && arr[j] < earliest) { any = true; earliest = arr[j]; foreignParent = nat[j]; } }
    if (any) { if (age[i] > YEAR - earliest) { out[i] = 1; nat[i] = foreignParent; arr[i] = earliest; gen[i] = 1; } else gen[i] = 2; continue; }
    gen[i] = out[0] || (sp >= 0 && out[sp]) ? 3 : P.genU[i] < Math.min(0.9, P.fb[i] * 1.3) ? 2 : 3;
  }
  // US-born people not living with their parents: second generation by their origin's immigrant share and age
  for (let i = 0; i < n; i++) {
    const role = P.role[i];
    if (out[i] || role === R_CHILD || role === R_GRAND) continue;
    let g2 = P.g2[i];
    if (i === 0) for (let j = 1; j < n; j++) if (P.role[j] === R_PARENT && out[j]) g2 = 1;
    gen[i] = P.genU[i] < g2 ? 2 : 3;
  }
  return R;
}
const natResult = n => ({ nat: new Uint8Array(n), out: new Uint8Array(n), arr: new Int16Array(n), gen: new Uint8Array(n) });

// education classes: 0-24 occupation groups, 25 armed forces, 26-28 not working at 25-44, 45-64, 65+
const OCC_INDEX = Object.fromEntries(OCC_GROUPS.map((g, i) => [g, i]));
const EDU_PRIOR = [
  [4, 14, 16, 8, 36, 17, 3, 2], [2, 9, 14, 8, 46, 18, 2, 1], [1, 5, 10, 8, 48, 24, 1, 3], [1, 6, 11, 10, 45, 21, 2, 4],
  [1, 4, 7, 6, 34, 26, 4, 18], [2, 9, 14, 7, 38, 26, 2, 2], [1, 6, 12, 8, 20, 5, 47, 1], [2, 7, 10, 6, 38, 30, 2, 5],
  [3, 12, 17, 8, 43, 13, 2, 2], [1, 3, 5, 20, 33, 14, 18, 6], [3, 17, 29, 25, 20, 5, 0.5, 0.5], [12, 33, 30, 11, 11, 2, 0.5, 0.5],
  [7, 33, 30, 11, 15, 3, 0.5, 0.5], [2, 18, 31, 15, 27, 6, 0.5, 0.5], [25, 38, 20, 6, 9, 1.5, 0.25, 0.25], [40, 33, 14, 5, 6, 1.5, 0.25, 0.25],
  [15, 30, 25, 10, 16, 3.5, 0.25, 0.25], [8, 30, 22, 8, 26, 5, 0.5, 0.5], [6, 30, 26, 11, 22, 4, 0.5, 0.5], [62, 22, 8, 3, 4, 0.8, 0.1, 0.1],
  [38, 35, 15, 5, 6, 1, 0.25, 0.25], [15, 40, 22, 11, 10, 1.5, 0.25, 0.25], [30, 38, 16, 7, 7, 1.5, 0.25, 0.25], [20, 42, 20, 7, 9, 1.5, 0.25, 0.25],
  [30, 40, 17, 5, 7, 1, 0.25, 0.25], [2, 30, 30, 12, 20, 5, 0.5, 0.5], [22, 30, 18, 7, 15, 5, 1.5, 1.5], [25, 30, 18, 7, 13, 5, 1, 1],
  [22, 28, 18, 7, 14, 7, 2, 2],
];
const NEDU = 8, NECLASS = EDU_PRIOR.length;
const EDU_YOUNG = [0.12, 0.52, 0.28, 0.05, 0.03, 0, 0, 0];
const eduClass = p => p.worker ? (p.military ? 25 : OCC_INDEX[p.occ] ?? 18) : p.age < 45 ? 26 : p.age < 65 ? 27 : 28;
/** Draw from a probability row restricted to [lo, hi] with a uniform. */
function drawRow(row, lo, hi, u) {
  let t = 0; for (let k = lo; k <= hi; k++) t += row[k];
  if (!(t > 0)) return lo;
  let x = u * t;
  for (let k = lo; k <= hi; k++) { x -= row[k]; if (x < 0) return k; }
  return hi;
}
/** Education index per member (-1 child under 18 not in school, -2 in school under 25). */
function eduDecide(core, hs, rows) {
  const mem = core.members, out = new Int8Array(mem.length);
  for (let i = 0; i < mem.length; i++) {
    const p = mem[i], u = uni(hs, i, KA.EDU);
    if (p.age < 18) out[i] = p.student ? -2 : -1;
    else if (p.age < 25) out[i] = p.student ? -2 : drawRow(EDU_YOUNG, 0, 7, u);
    else {
      const row = rows[eduClass(p)];
      out[i] = p.student === 'grad' ? drawRow(row, 4, 7, u) : p.student === 'college' ? drawRow(row, 1, 4, u) : drawRow(row, 0, 7, u);
    }
  }
  return out;
}
const eduLevel = e => e >= 0 ? e : e === -2 ? 2 : 1;   // numeric level for language and wages

/** Language inputs that do not depend on the calibrated bucket scales. */
function langPrep(core, ori, N, edu, hs, F) {
  const mem = core.members, n = mem.length, zL = gaussOf(hs, 98, KA.LANGH);
  const L = { n, age: new Uint8Array(n), role: new Uint8Array(n), U: new Float64Array(n), cross: new Float64Array(n), span: new Float64Array(n), base: new Float64Array(n), x: new Float64Array(n), choiceOf: new Int8Array(n).fill(-1), choices: [], spouse: -1 };
  // one language choice per origin present in the household, shared by its members
  const byOrigin = new Map();
  for (let i = 0; i < n; i++) {
    const o = ORIGINS[ori[i]];
    if (!o.langs.length) continue;
    let ci = byOrigin.get(o.index);
    if (ci === undefined) {
      let langs = o.langs;
      if (o.key === 'chinese') {
        // Cantonese for the older waves, Mandarin for the recent ones
        const era = N.out[i] ? N.arr[i] : YEAR - mem[i].age + 25;
        const wc = era < 1995 ? 0.8 : era < 2010 ? 0.5 : 0.25;
        langs = [{ key: 'cantonese', w: wc, bucket: 7 }, { key: 'mandarin', w: 1 - wc, bucket: 7 }, { key: 'taishanese', w: era < 1970 ? 0.1 : 0.02, bucket: 7 }];
      } else if (o.key === 'indian' && F.punjabi > 1) langs = langs.map(l => l.key === 'punjabi' ? { ...l, w: l.w * F.punjabi } : l);
      ci = L.choices.length;
      L.choices.push({ langs, u: uni(hs, 200 + o.index % 50, KA.LCHOICE), pick: null });
      byOrigin.set(o.index, ci);
    }
    L.choiceOf[i] = ci;
  }
  for (let i = 1; i < n; i++) if (mem[i].role === 'spouse' || mem[i].role === 'partner') { L.spouse = i; break; }
  const outParent = N.out[0] || (L.spouse >= 0 && N.out[L.spouse]);
  for (let i = 0; i < n; i++) {
    const p = mem[i], o = ORIGINS[ori[i]];
    L.age[i] = p.age; L.role[i] = ROLE_ID[p.role];
    L.U[i] = normCdf(0.6 * zL + 0.8 * gaussOf(hs, i, KA.LANG));
    L.cross[i] = uni(hs, i, KA.CROSS); L.span[i] = uni(hs, i, KA.SPAN);
    if (L.choiceOf[i] >= 0) {
      const g = N.gen[i], withParent = p.role === 'grandchild' || (p.role === 'child' && outParent);
      L.base[i] = g === 1 ? (p.age >= 18 ? 0.93 : 0.85) * o.use : g === 2 ? (withParent ? 0.66 : 0.42) * o.use : o.retain;
    }
    // log-odds of limited English for someone who speaks another language at home
    const e = eduLevel(edu[i]);
    let x = N.gen[i] === 1 ? 0.9 + 0.045 * Math.max(0, p.age - (YEAR - N.arr[i]) - 15) - 0.045 * Math.min(YEAR - N.arr[i], 40) - 0.22 * Math.max(0, e - 1)
      : N.gen[i] === 2 ? -1.8 - 0.2 * Math.max(0, e - 1) : -2.6;
    if (p.age >= 65) x += 0.6;
    if (p.age < 18) x -= 0.6;
    L.x[i] = x;
  }
  return L;
}

/** Home language (and its C16001 bucket) per member at bucket scales lambda (1..12) and the extra Spanish rate kappa. */
function langDecide(L, lambda, kappa, R) {
  const n = L.n, home = R.home, bucket = R.bucket, cross = R.crossed;
  for (let c = 0; c < L.choices.length; c++) {
    const ch = L.choices[c], langs = ch.langs;
    let t = 0; for (let k = 0; k < langs.length; k++) t += langs[k].w * lambda[langs[k].bucket];
    let x = ch.u * t, pick = langs[langs.length - 1];
    for (let k = 0; k < langs.length; k++) { x -= langs[k].w * lambda[langs[k].bucket]; if (x < 0) { pick = langs[k]; break; } }
    ch.pick = pick;
  }
  for (let i = 0; i < n; i++) {
    home[i] = null; bucket[i] = 0; cross[i] = 0;
    const ci = L.choiceOf[i];
    if (ci < 0) continue;
    const l = L.choices[ci].pick;
    if (L.U[i] < Math.min(0.985, L.base[i] * lambda[l.bucket])) { home[i] = l.key; bucket[i] = l.bucket; }
  }
  // others in a household that speaks another language often speak it too
  const lead = home[0] ? 0 : L.spouse >= 0 && home[L.spouse] ? L.spouse : -1;
  for (let i = 0; i < n; i++) {
    if (home[i]) continue;
    const role = L.role[i];
    if (lead >= 0 && i !== 0) {
      const p = role === R_SPOUSE || role === R_PARTNER ? 0.35 : role === R_CHILD || role === R_GRAND ? 0.6 : role === R_ROOM ? 0.08 : 0.45;
      if (L.cross[i] < p) { home[i] = home[lead]; bucket[i] = bucket[lead]; cross[i] = 1; continue; }
    }
    if (kappa > 0 && L.age[i] >= 5 && L.span[i] < kappa) { home[i] = 'spanish'; bucket[i] = 1; cross[i] = 1; }
  }
  return R;
}
const langResult = n => ({ home: new Array(n).fill(null), bucket: new Uint8Array(n), crossed: new Uint8Array(n) });

// marital status: 0 never, 1 married, 2 separated, 3 married spouse absent, 4 widowed, 5 divorced
const MARITAL = ['never', 'married', 'separated', 'absent', 'widowed', 'divorced'];
const MAR_PRIOR = [
  [0.96, 0.01, 0.015, 0.0, 0.015], [0.78, 0.04, 0.05, 0.005, 0.125], [0.5, 0.07, 0.08, 0.02, 0.33], [0.35, 0.07, 0.07, 0.05, 0.46],
  [0.25, 0.05, 0.06, 0.14, 0.5], [0.15, 0.03, 0.05, 0.37, 0.4], [0.08, 0.015, 0.04, 0.68, 0.185],
];
const marBand = a => a < 25 ? 0 : a < 35 ? 1 : a < 45 ? 2 : a < 55 ? 3 : a < 65 ? 4 : a < 75 ? 5 : 6;
/** Who is married to whom by household structure: returns marital codes, -1 for people still to draw, 'p' flag for partners. */
function maritalFixed(core) {
  const mem = core.members, n = mem.length, out = new Int8Array(n).fill(-1), partner = new Uint8Array(n);
  for (let i = 0; i < n; i++) if (mem[i].age < 15) out[i] = 0;
  const sp = mem.findIndex(p => p.role === 'spouse');
  if (sp > 0) { out[0] = 1; out[sp] = 1; }
  const pa = mem.findIndex(p => p.role === 'partner');
  if (pa > 0) { partner[0] = 1; partner[pa] = 1; }
  const parents = []; for (let i = 0; i < n; i++) if (mem[i].role === 'parent') parents.push(i);
  if (parents.length >= 2 && mem[parents[0]].sex !== mem[parents[1]].sex) { out[parents[0]] = 1; out[parents[1]] = 1; }
  // an adult child living with their spouse (the relative of the other sex and about the same age)
  for (let i = 0; i < n; i++) {
    if (mem[i].role !== 'child' || mem[i].age < 20 || out[i] >= 0) continue;
    const j = mem.findIndex((q, k) => k !== i && q.role === 'relative' && out[k] < 0 && q.sex !== mem[i].sex && q.age >= 20 && Math.abs(q.age - mem[i].age) <= 8);
    if (j >= 0) { out[i] = 1; out[j] = 1; break; }
  }
  return { out, partner };
}
function maritalDecide(core, hs, F) {
  const { out, partner } = maritalFixed(core), mem = core.members;
  for (let i = 0; i < mem.length; i++) {
    if (out[i] >= 0) continue;
    const p = mem[i], row = F.marRows[(p.sex === 'F' ? 7 : 0) + marBand(p.age)];
    const u = uni(hs, i, KA.MAR);
    // statuses 0 never, 1 separated, 2 absent, 3 widowed, 4 divorced in the rows
    let k;
    if (partner[i]) { const r2 = [row[0], row[1], 0, row[3], row[4]]; k = drawRow(r2, 0, 4, u); }
    else k = drawRow(row, 0, 4, u);
    out[i] = [0, 2, 3, 4, 5][k];
  }
  return out;
}

const EDU_WAGE = [0.75, 0.85, 0.95, 1.0, 1.25, 1.45, 1.8, 1.7];
/** Earning power of a worker (dollars a year before the household's income rank is applied). */
function workerPotential(p, eduIdx) {
  const base = p.military ? GROUP_PROFILES.military.median : GROUP_PROFILES[p.occ] ? GROUP_PROFILES[p.occ].median : 50000;
  const hours = p.days ? popcount(p.days) * Math.min(p.dwellMin || 480, 720) / 60 : 40;
  const exp = p.age < 18 ? 0.5 : 0.6 + 0.4 * Math.min(1, (p.age - 18) / 20);
  return base * EDU_WAGE[eduLevel(eduIdx)] * Math.min(1, hours / 38) * exp;
}

const SYN_N = 700, SYN_BASE = 0x3f000000;   // synthetic calibration households live past every real household index
const EDUCATION_KEYS = ['nohs', 'hs', 'somecollege', 'associate', 'bachelor', 'master', 'professional', 'doctorate'];
// chance a married spouse keeps their own surname (custom varies; most take the household's name)
const SURNAME_KEEP = { korean: 0.6, chinese: 0.5, vietnamese: 0.5, mexican: 0.3, salvadoran: 0.35, guatemalan: 0.35, honduran: 0.35, nicaraguan: 0.35, southamerican: 0.35, spanish: 0.35, latino: 0.3, iranian: 0.3, arab: 0.3 };

/** A household's earning-power score (log dollars plus household luck), the ranking behind B19001. */
function householdScore(core, edu, hs) {
  let s = 2000;
  core.members.forEach((p, i) => {
    if (p.worker) s += workerPotential(p, edu[i]);
    else if (p.age >= 62) s += 24000 * Math.pow(EDU_WAGE[eduLevel(edu[i])], 0.8);
    else if (p.age >= 18) s += 3000;
  });
  return Math.log(s) + 0.35 * gaussOf(hs, 97, KA.INC);
}

const HINC_LO = [0, 10000, 15000, 20000, 25000, 30000, 35000, 40000, 45000, 50000, 60000, 75000, 100000, 125000, 150000, 200000];
const HINC_HI = [10000, 15000, 20000, 25000, 30000, 35000, 40000, 45000, 50000, 60000, 75000, 100000, 125000, 150000, 200000, Infinity];
/** Household income at quantile q of a ZIP's B19001 distribution (linear within brackets, a Pareto tail above $200k). */
function incomeAt(cum, q) {
  let b = 0;
  while (b < 15 && cum[b] < q) b++;
  const prev = b ? cum[b - 1] : 0, span = cum[b] - prev, within = span > 0 ? clamp((q - prev) / span, 0, 1) : 0.5;
  let v;
  if (b === 15) v = Math.min(2.5e6, 200000 / Math.pow(1 - 0.995 * within, 1 / 2.1));
  else if (b === 0) v = 1500 + within * 8500;
  else v = HINC_LO[b] + within * (HINC_HI[b] - HINC_LO[b]);
  return Math.round(v / 100) * 100;
}
const hincBracket = y => { let b = 0; while (b < 15 && y >= HINC_HI[b]) b++; return b; };

/** Activity status from layer 0 (work, school) and layer-1 draws (unemployment, retirement, keeping house). */
function statusOf(p, core, hs, i, F) {
  if (p.worker) return p.military ? 'military' : 'employed';
  if (p.age < 5) return 'child';
  if (p.student) return 'student';
  if (p.age < 16) return 'child';
  if (p.age < 65 && uni(hs, i, KA.UNEMP) < Math.min(0.95, F.unemp * (p.age < 25 ? 1.6 : p.age < 55 ? 1 : 0.6))) return 'unemployed';
  if (p.age < 18) return 'not working';
  const ret = p.age < 50 ? 0 : p.age < 55 ? 0.1 : p.age < 60 ? 0.3 : p.age < 62 ? 0.55 : p.age < 65 ? 0.75 : 0.96;
  if (uni(hs, i, KA.STATUS) < ret) return 'retired';
  const young = core.members.some(q => q.age < 6);
  const hm = p.age >= 20 && (p.role === 'householder' || p.role === 'spouse' || p.role === 'partner') ? (p.sex === 'F' ? 0.55 : 0.15) + (young ? 0.25 : 0) : 0.1;
  return uni(hs, i, KA.STATUS + 64) < hm ? 'homemaker' : 'not working';
}

/** School level for a student: preschool, elementary (with kindergarten), middle, high, college, grad. */
function schoolOf(p) {
  switch (p.student) {
    case 'preschool': return 'preschool';
    case 'k12': return p.age <= 10 ? 'elementary' : p.age <= 13 ? 'middle' : 'high';
    case 'college': return 'college';
    case 'grad': return 'grad';
  }
  return null;
}

/** A place name drawn by weight, preferring places tagged with a language, optionally reweighted by name. */
function pickPlace(places, u, lang, boost) {
  let t = 0;
  const wt = pl => pl.w * (!lang || !pl.tags.length ? 1 : pl.tags.includes(lang) ? 4 : 0.2) * (boost && boost[pl.name] ? boost[pl.name] : 1);
  for (const pl of places) t += wt(pl);
  let x = u * t;
  for (const pl of places) { x -= wt(pl); if (x < 0) return pl.name; }
  return places[places.length - 1].name;
}
const pickCum = ({ names, cum }, u) => { const x = u * cum[cum.length - 1]; let lo = 0, hi = cum.length - 1; while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] > x) hi = mid; else lo = mid + 1; } return names[lo]; };

// Census labels for the validation tables
const HISP_LABEL = { mexican: 'mexican', puertorican: 'puertorican', cuban: 'cuban', dominican: 'dominican', guatemalan: 'guatemalan', honduran: 'honduran', nicaraguan: 'nicaraguan', salvadoran: 'salvadoran', southamerican: 'southam', spanish: 'spanish' };
const ASIAN_LABEL = { asian: 'otherasian' };
const CT_EDGES = [5, 10, 15, 20, 25, 30, 35, 40, 45, 60, 90];
const SCH_LABEL = p => !p.student ? 'none' : p.student === 'preschool' ? 'preschool' : p.student === 'college' ? 'undergrad' : p.student === 'grad' ? 'grad' : p.age <= 5 ? 'kindergarten' : p.age <= 9 ? 'g1-4' : p.age <= 13 ? 'g5-8' : 'g9-12';

// school enrollment shapes by single year of age (scaled per ZIP to B14001)
const COL_SHAPE = new Float64Array(MAX_AGE + 1), GRAD_SHAPE = new Float64Array(MAX_AGE + 1);
for (let a = 0; a <= MAX_AGE; a++) {
  COL_SHAPE[a] = a < 18 ? 0 : a <= 24 ? [0.55, 0.62, 0.6, 0.55, 0.4, 0.25, 0.18][a - 18] : a <= 29 ? 0.09 : a <= 34 ? 0.05 : a <= 39 ? 0.035 : a <= 49 ? 0.022 : a <= 59 ? 0.01 : a <= 69 ? 0.004 : 0;
  GRAD_SHAPE[a] = a < 21 ? 0 : a <= 24 ? [0.01, 0.05, 0.08, 0.09][a - 21] : a <= 29 ? 0.08 : a <= 34 ? 0.045 : a <= 39 ? 0.025 : a <= 49 ? 0.012 : a <= 64 ? 0.004 : 0;
}
const STUDENT_KEYS = [null, 'preschool', 'k12', 'college', 'grad'];

let defaultWorld = null;

/**
 * Parse a household id "94110-123" or a person id "94110-123-0".
 * @param {string} id
 * @param {object} [world] resolves zi (defaults to the world of the most recently created Population)
 * @returns {{zip: string, zi: number, h: number, m: number|null} | null} zi is -1 when no world is known or the ZIP is not in it
 */
export function parseId(id, world = defaultWorld) {
  const r = /^(\d{5})-(\d{1,9})(?:-(\d{1,3}))?$/.exec(String(id ?? '').trim());
  if (!r) return null;
  return { zip: r[1], zi: world ? world.indexOf(r[1]) : -1, h: +r[2], m: r[3] === undefined ? null : +r[3] };
}

/** A small least-recently-used cache. */
class LRU {
  constructor(cap) { this.cap = cap; this.map = new Map(); }
  get(k) { const v = this.map.get(k); if (v !== undefined) { this.map.delete(k); this.map.set(k, v); } return v; }
  set(k, v) { this.map.set(k, v); if (this.map.size > this.cap) this.map.delete(this.map.keys().next().value); return v; }
  clear() { this.map.clear(); }
}

/**
 * Every Californian in the pack as a deterministic NPC. See CONTRACTS.md section 5.
 * @example const pop = new Population(world, { seed: LEGION_SEED }); pop.householdCore(world.indexOf('94110'), 0);
 */
export class Population {
  /**
   * @param {import('./world.mjs').World} world
   * @param {{seed?: number, cache?: number}} [options] cache: how many layer-1 households to keep (default 4096)
   */
  constructor(world, { seed = LEGION_SEED, cache = 4096 } = {}) {
    if (!world || !world.z || typeof world.acs !== 'function') throw new Error('Population needs a Legion world');
    this.world = world;
    this.seed = seed >>> 0;
    const N = world.N;
    this._cores = new Array(N);
    this._fulls = new Array(N);
    this._bandsCache = new Array(N);
    this._siteCache = new Array(N);
    this._schoolCache = new Array(N);
    this._collegeCache = new Array(N);
    this._baseCache = new Array(N);
    this._countyZipList = null;
    this._countyRawCache = new Map();
    this._countyColCache = new Map();
    this._grid = null;
    this._milCounts = null;
    this._hhLru = new LRU(Math.max(16, cache | 0));
    this._personLru = new LRU(Math.max(64, (cache | 0) * 4));
    defaultWorld = world;
  }

  /** Number of households in ZIP zi. */
  householdCount(zi) { return (zi >= 0 && zi < this.world.N && this.world.z.hh[zi]) || 0; }

  /** Expected household population of ZIP zi (hh x hhsize). */
  expectedPersons(zi) { const z = this.world.z; return Math.round((z.hh[zi] || 0) * (z.hhsize[zi] || 0)); }

  /** Parse an id against this population's world. */
  parseId(id) { return parseId(id, this.world); }

  // ---------------------------------------------------------------- ZIP inputs

  _countyZips(ci) {
    if (!this._countyZipList) {
      this._countyZipList = this.world.counties.map(() => []);
      for (let i = 0; i < this.world.N; i++) { const c = this.world.z.county[i]; if (this._countyZipList[c]) this._countyZipList[c].push(i); }
    }
    return this._countyZipList[ci] || [];
  }

  _countyRaw(ci, block) {
    const key = ci + ':' + block;
    let v = this._countyRawCache.get(key);
    if (!v) {
      const L = this.world.acsLayout[block][1];
      v = new Float64Array(L);
      for (const i of this._countyZips(ci)) { const a = this.world.acs(i, block); for (let k = 0; k < L; k++) v[k] += a[k]; }
      if (!(sum(v) > 0)) for (let i = 0; i < this.world.N; i++) { const a = this.world.acs(i, block); for (let k = 0; k < L; k++) v[k] += a[k]; }
      this._countyRawCache.set(key, v);
    }
    return v;
  }

  /** A Census block for ZIP zi; small ZIPs borrow pseudo-counts from their county so their shares stay sane. */
  _blk(zi, block, k = 60) {
    const raw = this.world.acs(zi, block), out = Float64Array.from(raw);
    const tot = sum(out);
    if (tot >= k) return out;
    const cty = this._countyRaw(this.world.z.county[zi], block), ct = sum(cty);
    if (ct > 0) { const m = (k - tot) / ct; for (let j = 0; j < out.length; j++) out[j] += m * cty[j]; }
    return out;
  }

  /** A numeric ZIP column, or its county's household-weighted mean when missing, or a fallback. */
  _col(zi, name, fallback) {
    const v = this.world.z[name][zi];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    const ci = this.world.z.county[zi], key = ci + ':' + name;
    let m = this._countyColCache.get(key);
    if (m === undefined) {
      let s = 0, n = 0;
      for (const i of this._countyZips(ci)) { const x = this.world.z[name][i], wgt = this.world.z.hh[i] || 0; if (typeof x === 'number' && Number.isFinite(x) && wgt > 0) { s += x * wgt; n += wgt; } }
      m = n > 0 ? s / n : null;
      this._countyColCache.set(key, m);
    }
    return m === null ? fallback : m;
  }

  /**
   * The household population's age-sex pyramid: B01001 minus an estimate of the group-quarters residents
   * (pop - hh x hhsize), taken from the brackets where the ZIP exceeds the shape of its neighbors.
   */
  _householdPyramid(zi, A, hhPop) {
    const w = this.world, pop = sum(A), G = pop - hhPop, T = Float64Array.from(A);
    let gq = 0;
    if (G > Math.max(25, 0.02 * pop)) {
      const S = new Float64Array(NB2);
      for (const radius of [25, 60]) {
        S.fill(0);
        for (const [j] of w.zipsNear(w.z.tx[zi], w.z.ty[zi], radius)) {
          if (j === zi) continue;
          const a = w.acs(j, 'age'); for (let b = 0; b < NB2; b++) S[b] += a[b];
        }
        if (sum(S) >= 5000) break;
      }
      const st = sum(S);
      if (st > 0) {
        const base = pop - G, ex = new Float64Array(NB2);
        let X = 0;
        for (let b = 0; b < NB2; b++) { ex[b] = Math.max(0, A[b] - base * S[b] / st); X += ex[b]; }
        for (let b = 0; b < NB2; b++) T[b] = Math.max(0, A[b] - (X >= G ? G * ex[b] / X : ex[b] + (G - X) * A[b] / pop));
        gq = G;
      }
    }
    const s = sum(T);
    if (s > 0) for (let b = 0; b < NB2; b++) T[b] *= hhPop / s;
    return { T, gq: Math.max(0, gq) };
  }

  // ---------------------------------------------------------------- the per-ZIP core model (layer 0)

  _core(zi) { return this._cores[zi] || (this._cores[zi] = this._buildCore(zi)); }

  _buildCore(zi) {
    const w = this.world, z = w.z;
    const hh = z.hh[zi] || 0;
    const A = this._blk(zi, 'age', 500);
    const pop = sum(A);
    let hhsize = z.hhsize[zi];
    if (!(hhsize > 0)) hhsize = hh > 0 && pop > 0 ? pop / hh : 2.6;
    hhsize = clamp(hhsize, 1, 9.5);
    const hhPop = hh > 0 ? hh * hhsize : Math.max(pop, 1);
    const { T, gq } = this._householdPyramid(zi, A, hhPop);
    const nh = hh > 0 ? hh : hhPop / hhsize;
    const t = Float64Array.from(T, v => v / nh);
    const hht = this._blk(zi, 'hht', 150);
    let typeShare = Float64Array.from(hht, v => v / (sum(hht) || 1));
    if (!(sum(typeShare) > 0)) typeShare = Float64Array.from([0.48, 0.06, 0.12, 0.24, 0.1]);
    const cw = fitComponents(t, typeShare);
    const M = { zi, hh, hhsize, hhPop, pop, gq, A, T, typeShare, cw, comp: new Table(cw), maxSize: 1 };
    for (let c = 0; c < NCOMP; c++) if (cw[c] > 0 && C_SIZE[c] > M.maxSize) M.maxSize = C_SIZE[c];

    // tenure by household type and householder age band, shifted to own_sh
    const WTB = new Float64Array(5 * NBAND), offT = new Float64Array(5 * NBAND);
    for (let c = 0; c < NCOMP; c++) WTB[C_TYPE[c] * NBAND + C_BAND[c]] += cw[c];
    for (let ty = 0; ty < 5; ty++) for (let b = 0; b < NBAND; b++) offT[ty * NBAND + b] = TEN_TYPE[ty] + TEN_BAND[b];
    const own = clamp(this._col(zi, 'own_sh', 55) / 100, 0.002, 0.998);
    M.own = own;
    const aOwn = solveShift(WTB, offT, own * sum(WTB));
    M.pOwn = Float32Array.from(offT, o => sigmoid(aOwn + o));
    const scOwn = new Float64Array(5), scRent = new Float64Array(5);
    for (let c = 0; c < NCOMP; c++) { const p = M.pOwn[C_TYPE[c] * NBAND + C_BAND[c]], sc = Math.min(C_SIZE[c], 5) - 1; scOwn[sc] += cw[c] * p; scRent[sc] += cw[c] * (1 - p); }
    const pOwnAll = sum(scOwn);

    // dwelling by tenure (housing-unit shares; owners mostly in houses)
    const sfd = clamp(this._col(zi, 'sfd_sh', 60), 0, 100), mf5 = clamp(this._col(zi, 'mf5_sh', 15), 0, 100), mh = clamp(this._col(zi, 'mh_sh', 4), 0, 100);
    const dwCols = [sfd, Math.max(0, 100 - sfd - mf5 - mh), mf5, mh];
    M.dwShares = dwCols.map(v => v / (sum(dwCols) || 1));
    const dm = ipf(DW_PRIOR, 2, 4, [pOwnAll, 1 - pOwnAll], dwCols);
    M.dw = [0, 1].map(r => { const tb = new Table(dm.subarray(r * 4, r * 4 + 4)); return tb.empty ? new Table(dwCols) : tb; });

    // vehicles by tenure and size class (B25044)
    const veh = this._blk(zi, 'veh', 60);
    M.veh = []; M.vZero = [];
    for (const [rows, cols] of [[scOwn, veh.subarray(0, 6)], [scRent, veh.subarray(6, 12)]]) {
      const vm = ipf(VEH_PRIOR.flat(), 5, 6, rows, cols);
      for (let sc = 0; sc < 5; sc++) {
        const row = vm.subarray(sc * 6, sc * 6 + 6), rs = sum(row), tb = new Table(row);
        M.veh.push(tb.empty ? new Table(VEH_PRIOR[sc]) : tb);
        M.vZero.push(rs > 0 ? row[0] / rs : VEH_PRIOR[sc][0]);
      }
    }

    this._buildHeritage(zi, M);
    this._buildActivity(zi, M);
    M.cw = null; M.A = null;   // only needed while building
    return M;
  }

  /** Person-level heritage targets and household heritage tables per size, calibrated to B03002 and the detail tables. */
  _buildHeritage(zi, M) {
    const w = this.world;
    const race = this._blk(zi, 'race', 60), rTot = sum(race) || 1;
    const r = Float64Array.from(race, v => v / rTot);
    const pi = new Float64Array(NH);
    const spread = (gShare, weights, map) => {
      const t = sum(weights);
      if (!(gShare > 0)) return;
      if (!(t > 0)) { pi[map[map.length - 1]] += gShare; return; }
      for (let k = 0; k < weights.length; k++) pi[map[k]] += gShare * weights[k] / t;
    };
    spread(r[G_HISP], this._blk(zi, 'hisp', 40), HISP_TO);
    spread(r[G_ASIAN], this._blk(zi, 'asian', 40), ASIAN_TO);
    const anc = this._blk(zi, 'anc', 80), ancL = w.acsLabels('anc'), A = {};
    ancL.forEach((k, j) => { A[k] = anc[j]; });
    const wl = [], wm = [];
    for (const [k, to] of Object.entries(ANC_WHITE_TO)) { wl.push(A[k] || 0); wm.push(H_INDEX[to]); }
    if (!(sum(wl) > 0)) { wl.push(1); wm.push(H_INDEX.european); }
    spread(r[G_WHITE], wl, wm);
    const eth = A.ethiopian || 0, nig = A.nigerian || 0, afr = Math.max(0, (A.african || 0) - eth - nig), car = A.westindian || 0;
    const blackN = race[G_BLACK];
    const aa = Math.max(0.1 * blackN, blackN - 0.9 * (eth + nig + afr + car));
    spread(r[G_BLACK], [aa, eth, nig, car, afr], ['african-american', 'ethiopian', 'nigerian', 'caribbean', 'african'].map(k => H_INDEX[k]));
    pi[H_INDEX.native] += r[G_AIAN]; pi[H_INDEX.pacific] += r[G_NHPI]; pi[H_INDEX.multiracial] += r[G_MULTI]; pi[H_INDEX.other] += r[G_OTHER];
    const pt = sum(pi); for (let k = 0; k < NH; k++) pi[k] /= pt;
    M.pi = pi;

    // mixing vectors per race group
    let simpson = 0; for (let g = 0; g < NRACE; g++) simpson += r[g] * r[g];
    const qRace = 1 - clamp(0.03 + 0.18 * (1 - simpson), 0.03, 0.2);
    M.qRace = qRace;
    const within = [], notG = [], nonHispOther = [];
    for (let g = 0; g < NRACE; g++) {
      const a = new Float64Array(NH), b = new Float64Array(NH), c = new Float64Array(NH);
      for (let k = 0; k < NH; k++) { if (H_GROUP[k] === g) a[k] = pi[k]; else { b[k] = pi[k]; if (H_GROUP[k] !== G_HISP) c[k] = pi[k]; } }
      const sa = sum(a), sb = sum(b), sc = sum(c);
      if (sa > 0) for (let k = 0; k < NH; k++) a[k] /= sa; else a[HERITAGE.findIndex(h => h[1] === g)] = 1;
      if (sb > 0) for (let k = 0; k < NH; k++) b[k] /= sb; else b[H_INDEX.american] = 1;
      if (sc > 0) for (let k = 0; k < NH; k++) c[k] /= sc; else c[H_INDEX.american] = 1;
      within.push(a); notG.push(b); nonHispOther.push(c);
    }
    let hispOfNotG = new Float64Array(NRACE);
    for (let g = 0; g < NRACE; g++) { let s = 0; for (let k = 0; k < NH; k++) if (H_GROUP[k] === G_HISP) s += notG[g][k]; hispOfNotG[g] = s; }
    // per group: SP(H) = s_g d_H + V_g ; KID_with_partner(H) = c_g d_H + U_g ; ROOM(H) = 0.45 within_g + 0.55 pi
    const sG = new Float64Array(NRACE), cG = new Float64Array(NRACE), V = [], U = [];
    for (let g = 0; g < NRACE; g++) {
      const Q = Q_KEY[g];
      sG[g] = qRace * Q;
      const v = new Float64Array(NH), u = new Float64Array(NH);
      for (let k = 0; k < NH; k++) v[k] = qRace * (1 - Q) * within[g][k] + (1 - qRace) * notG[g][k];
      if (g === G_HISP) {
        cG[g] = qRace * Q + qRace * (1 - Q) * 0.6 + (1 - qRace) * 0.7;
        for (let k = 0; k < NH; k++) u[k] = qRace * (1 - Q) * 0.4 * within[g][k] + (1 - qRace) * 0.3 * notG[g][k];
      } else {
        const hg = hispOfNotG[g];
        cG[g] = qRace * Q + qRace * (1 - Q) * 0.6 + (1 - qRace) * (hg * 0.3 + (1 - hg) * 0.3);
        for (let k = 0; k < NH; k++) u[k] = qRace * (1 - Q) * 0.4 * within[g][k] + (1 - qRace) * (hg * 0.7 * within[G_HISP][k] + (1 - hg) * 0.2 * nonHispOther[g][k]);
        u[H_MULTI] += (1 - qRace) * (1 - hg) * 0.5;
      }
      V.push(v); U.push(u);
    }
    // expected member counts by household size (1..10) from the fitted components
    const NS = MAX_FAMILY;
    const Ws = new Float64Array(NS), nSp = new Float64Array(NS), nKidSp = new Float64Array(NS), nKidNo = new Float64Array(NS), nRelSp = new Float64Array(NS), nRelNo = new Float64Array(NS), nRoom = new Float64Array(NS);
    const { roleOff, roleId, roleN } = KERNELS;
    for (let c = 0; c < NCOMP; c++) {
      const wc = M.cw[c]; if (!(wc > 0)) continue;
      const s = C_SIZE[c] - 1;
      let sp = 0, kid = 0, rel = 0, room = 0;
      for (let k = roleOff[c]; k < roleOff[c + 1]; k++) {
        const ro = roleId[k], n = roleN[k];
        if (ro === R_SPOUSE || ro === R_PARTNER) sp += n; else if (ro === R_CHILD || ro === R_GRAND) kid += n; else if (ro === R_ROOM) room += n; else rel += n;
      }
      Ws[s] += wc; nSp[s] += wc * sp; nRoom[s] += wc * room;
      if (sp > 0) { nKidSp[s] += wc * kid; nRelSp[s] += wc * rel; } else { nKidNo[s] += wc * kid; nRelNo[s] += wc * rel; }
    }
    // calibrate P(H | size) = pi_H rho_g(size) m_H so the expected persons match pi
    const m = new Float64Array(NH).fill(1), P = new Float64Array(NS * NH), gen = new Float64Array(NH);
    const fillP = () => {
      for (let s = 0; s < NS; s++) {
        let t = 0;
        for (let k = 0; k < NH; k++) { const v = pi[k] * RHO[H_GROUP[k]][s] * m[k]; P[s * NH + k] = v; t += v; }
        if (t > 0) for (let k = 0; k < NH; k++) P[s * NH + k] /= t;
      }
    };
    const Ag = new Float64Array(NRACE), Bg = new Float64Array(NRACE), Cg = new Float64Array(NRACE), Dg = new Float64Array(NRACE);
    for (let it = 0; it < 5; it++) {
      fillP();
      gen.fill(0); Ag.fill(0); Bg.fill(0); Cg.fill(0); Dg.fill(0);
      for (let s = 0; s < NS; s++) {
        if (!(Ws[s] > 0)) continue;
        const sp = nSp[s], ks = nKidSp[s], kn = nKidNo[s], rs = nRelSp[s], rn = nRelNo[s], ro = nRoom[s];
        for (let k = 0; k < NH; k++) {
          const mass = Ws[s] * P[s * NH + k]; if (!(mass > 0)) continue;
          const g = H_GROUP[k];
          gen[k] += mass * (1 + (sp * sG[g] + ks * cG[g] + rs * (0.9 + 0.1 * sG[g])) / Ws[s] + (kn + rn) / Ws[s]);
          Ag[g] += mass * (sp + 0.1 * rs) / Ws[s]; Bg[g] += mass * ks / Ws[s]; Cg[g] += mass * 0.45 * ro / Ws[s]; Dg[g] += mass * 0.55 * ro / Ws[s];
        }
      }
      for (let g = 0; g < NRACE; g++) {
        if (!(Ag[g] > 0 || Bg[g] > 0 || Cg[g] > 0 || Dg[g] > 0)) continue;
        for (let k = 0; k < NH; k++) gen[k] += Ag[g] * V[g][k] + Bg[g] * U[g][k] + Cg[g] * within[g][k] + Dg[g] * pi[k];
      }
      const gt = sum(gen);
      if (!(gt > 0)) break;
      for (let k = 0; k < NH; k++) if (pi[k] > 0 && gen[k] > 0) m[k] *= pi[k] * gt / gen[k];
    }
    fillP();
    M.herHH = []; for (let s = 0; s < NS; s++) M.herHH.push(new Table(P.subarray(s * NH, s * NH + NH)));
    M.herWithin = within.map(v => new Table(v));
    M.herNotG = notG.map(v => new Table(v));
    M.herPi = new Table(pi);
  }

  /** School, work, military, occupation, commute mode and time tables. */
  _buildActivity(zi, M) {
    const z = this.world.z;
    // single-year populations: all residents (A) and the household population (T)
    const popA = new Float64Array(2 * (MAX_AGE + 1)), popT = new Float64Array(2 * (MAX_AGE + 1));
    for (let s = 0; s < 2; s++) for (let a = 0; a <= MAX_AGE; a++) { popA[s * 100 + a] = M.A[s * NB + BR[a]] * YEAR_SHARE[a]; popT[s * 100 + a] = M.T[s * NB + BR[a]] * YEAR_SHARE[a]; }
    const allA = new Float64Array(MAX_AGE + 1);
    for (let a = 0; a <= MAX_AGE; a++) allA[a] = popA[a] + popA[100 + a];
    // school enrollment (B14001): rates by single year from all residents, applied to household members
    const sch = this._blk(zi, 'sch', 60);
    const p34 = allA[3] + allA[4];
    let p517 = 0; for (let a = 5; a <= 17; a++) p517 += allA[a];
    M.preRate = p34 > 0 ? clamp(sch[0] / p34, 0, 0.95) : 0.5;
    M.k12Rate = p517 > 0 ? clamp((sch[1] + sch[2] + sch[3] + sch[4]) / p517, 0.5, 0.995) : 0.97;
    // scale an age shape so the enrolled count matches, each age capped (bisection on the scale)
    const scaleRate = (shape, target, cap) => {
      if (!(target > 0)) return 0;
      let lo = 0, hi = 50;
      for (let it = 0; it < 32; it++) {
        const mid = (lo + hi) / 2;
        let s = 0; for (let a = 18; a <= MAX_AGE; a++) if (shape[a] > 0) s += allA[a] * Math.min(cap[a], mid * shape[a]);
        if (s < target) lo = mid; else hi = mid;
      }
      return (lo + hi) / 2;
    };
    const capCol = new Float64Array(MAX_AGE + 1).fill(0.97);
    const kc = scaleRate(COL_SHAPE, sch[5], capCol);
    M.colRate = Float32Array.from(COL_SHAPE, v => Math.min(0.97, kc * v));
    const capGrad = Float64Array.from(M.colRate, v => Math.max(0, 0.95 - v));
    const kg = scaleRate(GRAD_SHAPE, sch[6], capGrad);
    M.gradRate = Float32Array.from(GRAD_SHAPE, (v, a) => Math.min(capGrad[a], kg * v));

    // workers (employed civilians + armed forces among 16+, B23025)
    const emp = this._blk(zi, 'emp', 60), e16 = sum(emp) || 1;
    M.empShares = Float64Array.from(emp, v => v / e16);
    const n = [], off = [];
    for (let s = 0; s < 2; s++) for (let a = 16; a <= MAX_AGE; a++) {
      const p = popT[s * 100 + a], st = a >= 17 ? M.colRate[a] + M.gradRate[a] : 0;
      n.push(p * (1 - st), p * st); off.push(EMP_LOGIT[s * 100 + a], EMP_LOGIT[s * 100 + a] + STUDENT_WORK);
    }
    const nTot = n.reduce((x, y) => x + y, 0);
    const aWork = solveShift(n, off, nTot * (emp[0] + emp[2]) / e16);
    M.pWork = new Float32Array(400);
    for (let st = 0; st < 2; st++) for (let s = 0; s < 2; s++) for (let a = 16; a <= MAX_AGE; a++) M.pWork[st * 200 + s * 100 + a] = sigmoid(aWork + EMP_LOGIT[s * 100 + a] + (st ? STUDENT_WORK : 0));
    M.pMil = null;
    const milTarget = nTot * emp[2] / e16;
    const workers = new Float64Array(200);
    for (let s = 0; s < 2; s++) for (let a = 16; a <= MAX_AGE; a++) {
      const p = popT[s * 100 + a], st = a >= 17 ? M.colRate[a] + M.gradRate[a] : 0;
      workers[s * 100 + a] = p * ((1 - st) * M.pWork[s * 100 + a] + st * M.pWork[200 + s * 100 + a]);
    }
    if (milTarget > 0.5) {
      const mo = Float64Array.from({ length: 200 }, (_, i) => MIL_LOGIT(i % 100) + (i >= 100 ? -1.7 : 0));
      const b = solveShift(workers, mo, Math.min(milTarget, 0.9 * sum(workers)));
      M.pMil = Float32Array.from(mo, o => sigmoid(b + o));
    }

    // occupation by sex and age band (C24010 against an age profile)
    const occ = this._blk(zi, 'occ', 60);
    M.occ = [];
    for (let s = 0; s < 2; s++) {
      const rows = new Float64Array(5);
      for (let a = 16; a <= MAX_AGE; a++) rows[occBand(a)] += workers[s * 100 + a] * (M.pMil ? 1 - M.pMil[s * 100 + a] : 1);
      let cols = occ.subarray(s * 25, s * 25 + 25);
      if (!(sum(cols) > 0)) cols = occ.subarray((1 - s) * 25, (1 - s) * 25 + 25);
      const prior = new Float64Array(5 * 25);
      for (let b = 0; b < 5; b++) OCC_GROUPS.forEach((g, j) => { prior[b * 25 + j] = OCC_AGE[g][b]; });
      const om = ipf(prior, 5, 25, rows, cols);
      for (let b = 0; b < 5; b++) { const tb = new Table(om.subarray(b * 25, b * 25 + 25)); M.occ.push(tb.empty ? new Table(cols.length && sum(cols) > 0 ? cols : new Float64Array(25).fill(1)) : tb); }
    }

    // commute mode by car access, and time by mode (B08301 x B08303)
    const comm = this._blk(zi, 'comm', 60), ctime = this._blk(zi, 'ctime', 60), cTot = sum(comm) || 1;
    // who works from home: by occupation group, shifted so the ZIP's share matches B08301
    const ng = new Float64Array(26);
    for (let s = 0; s < 2; s++) for (let a = 16; a <= MAX_AGE; a++) {
      const wk = workers[s * 100 + a], mil = M.pMil ? M.pMil[s * 100 + a] : 0, T = M.occ[s * 5 + occBand(a)];
      ng[25] += wk * mil;
      if (T.empty) continue;
      // the alias table's own probabilities: entry j is chosen with prob[j]/n directly plus the aliases pointing at it
      for (let j = 0; j < T.n; j++) { ng[j] += wk * (1 - mil) * T.prob[j] / T.n; ng[T.alias[j]] += wk * (1 - mil) * (1 - T.prob[j]) / T.n; }
    }
    const gWfh = solveShift(ng, WFH_LOGIT, sum(ng) * comm[M_WFH] / cTot);
    M.pWfh = Float32Array.from(WFH_LOGIT, v => sigmoid(gWfh + v));
    // the other modes by car access (B08301 without working from home)
    const pw0 = this._zeroCarWorkerShare(M);
    const go = comm.subarray(0, NMODE - 1);
    const mm = ipf([...new Array(NMODE - 1).fill(1), ...NOCAR_PRIOR], 2, NMODE - 1, [1 - pw0, pw0], go);
    M.modeCar = new Table(mm.subarray(0, NMODE - 1)); M.modeNoCar = new Table(mm.subarray(NMODE - 1));
    if (M.modeCar.empty) M.modeCar = new Table([0.8, 0.1, 0.02, 0.01, 0, 0.01, 0.005, 0.01, 0.03, 0.015]);
    if (M.modeNoCar.empty) M.modeNoCar = M.modeCar;
    M.commShares = Float64Array.from(comm, v => v / cTot);
    const tm = ipf(TIME_PRIOR.flat(), NMODE - 1, NCT, comm.subarray(0, NMODE - 1), ctime);
    M.time = [];
    for (let k = 0; k < NMODE - 1; k++) { const tb = new Table(tm.subarray(k * NCT, k * NCT + NCT)); M.time.push(tb.empty ? new Table(TIME_PRIOR[k]) : tb); }
    const dens = z.density[zi] || 0;
    M.urban = clamp((Math.log10(Math.max(dens, 1)) - 2.7) / 1.5, 0, 1);   // 0 below ~500/sq mi, 1 above ~16,000
  }

  /** Expected share of workers who live in a household without a vehicle, from the fitted model itself. */
  _zeroCarWorkerShare(M) {
    const { H, R, roleOff, roleId, roleN } = KERNELS;
    // expected worker probability of a person in each age-sex bracket
    const pw = new Float64Array(NB2);
    for (let s = 0; s < 2; s++) for (let a = 16; a <= MAX_AGE; a++) {
      const st = M.colRate[a] + M.gradRate[a];
      pw[s * NB + BR[a]] += YEAR_SHARE[a] * ((1 - st) * M.pWork[s * 100 + a] + st * M.pWork[200 + s * 100 + a]);
    }
    const HW = new Float64Array(NG), RW = new Float64Array(NG * NROLE);
    for (let g = 0; g < NG; g++) {
      let s = 0; for (let k = H.off[g]; k < H.off[g + 1]; k++) s += H.val[k] * pw[H.idx[k]];
      HW[g] = s;
      for (let r = 1; r < NROLE; r++) { const q = g * NROLE + r; let v = 0; for (let k = R.off[q]; k < R.off[q + 1]; k++) v += R.val[k] * pw[R.idx[k]]; RW[q] = v; }
    }
    let all = 0, zero = 0;
    for (let c = 0; c < NCOMP; c++) {
      const wc = M.cw[c]; if (!(wc > 0)) continue;
      const g = C_GROUP[c];
      let wk = HW[g];
      for (let k = roleOff[c]; k < roleOff[c + 1]; k++) wk += roleN[k] * RW[g * NROLE + roleId[k]];
      const po = M.pOwn[C_TYPE[c] * NBAND + C_BAND[c]], sc = Math.min(C_SIZE[c], 5) - 1;
      all += wc * wk;
      zero += wc * wk * (po * M.vZero[sc] + (1 - po) * M.vZero[5 + sc]);
    }
    return all > 0 ? clamp(zero / all, 0, 0.95) : 0;
  }

  // ---------------------------------------------------------------- geography: nearby ZIPs, workplaces, schools

  /** ZIPs whose town point lies within km of ZIP zi's town point, nearest first: {ids, km}. */
  _near(zi, km) {
    const w = this.world, z = w.z;
    if (!this._grid) {
      const cell = 20 * w.kmUnit, map = new Map();
      for (let i = 0; i < w.N; i++) {
        const k = Math.floor(z.tx[i] / cell) * 65536 + Math.floor(z.ty[i] / cell);
        let b = map.get(k); if (!b) map.set(k, b = []); b.push(i);
      }
      this._grid = { cell, map };
    }
    const { cell, map } = this._grid, x = z.tx[zi], y = z.ty[zi], reach = km * w.kmUnit * 1.12;
    const out = [];
    for (let cx = Math.floor((x - reach) / cell); cx <= Math.floor((x + reach) / cell); cx++) {
      for (let cy = Math.floor((y - reach) / cell); cy <= Math.floor((y + reach) / cell); cy++) {
        const b = map.get(cx * 65536 + cy); if (!b) continue;
        for (const j of b) { const d = w.distKm(x, y, z.tx[j], z.ty[j]); if (d <= km) out.push([j, d]); }
      }
    }
    out.sort((p, q) => p[1] - q[1] || p[0] - q[0]);
    return { ids: Uint16Array.from(out, p => p[0]), km: Float32Array.from(out, p => p[1]) };
  }

  /** Per home ZIP: candidate workplace ZIPs in distance bands, each band with cumulative establishment weights. */
  _workBands(zi) {
    let B = this._bandsCache[zi];
    if (B) return B;
    const z = this.world.z, near = this._near(zi, WORK_RADIUS), n = near.ids.length;
    const cum = new Float32Array(n), start = new Int32Array(NWB + 1);
    let i = 0;
    for (let b = 0; b < NWB; b++) {
      start[b] = i;
      let c = 0;
      while (i < n && near.km[i] < BAND_EDGES[b + 1]) {
        const j = near.ids[i];
        c += (z.est[j] || 0) + 0.004 * (z.hh[j] || 0) + 0.05;
        cum[i++] = c;
      }
    }
    start[NWB] = i;
    B = { ids: near.ids, cum, start };
    return (this._bandsCache[zi] = B);
  }

  /** A workplace ZIP for a trip of about D km from ZIP zi (gravity by establishments within the band holding D). */
  _pickWorkZip(zi, D, u) {
    const B = this._workBands(zi);
    let b = 0;
    while (b < NWB - 1 && D >= BAND_EDGES[b + 1]) b++;
    for (let step = 0; step < NWB; step++) {
      for (let side = 0; side < (step ? 2 : 1); side++) {
        const bb = side ? b + step : b - step;
        if (bb < 0 || bb >= NWB) continue;
        const s = B.start[bb], e = B.start[bb + 1];
        if (e <= s) continue;
        const x = u * B.cum[e - 1];
        let lo = s, hi = e - 1;
        while (lo < hi) { const mid = (lo + hi) >> 1; if (B.cum[mid] > x) hi = mid; else lo = mid + 1; }
        return B.ids[lo];
      }
    }
    return zi;
  }

  /**
   * Fixed workplace points of ZIP j, more where there are more establishments: anywhere on the ZIP's land in
   * built-up ZIPs; around the town and the Census places inside it in rural ones (jobs are in town).
   */
  _sites(j) {
    let s = this._siteCache[j];
    if (s) return s;
    const w = this.world, z = w.z, R = w.raster(), cells = w.zipCells(j);
    const K = clamp(Math.round(4 + Math.sqrt(z.est[j] || 0)), 4, 48);
    const rng = new Rng(hash2(0x517e5, j));
    s = new Float32Array(2 * K);
    const rural = (z.density[j] || 0) < 1500;
    const places = rural ? w.placesIn(j) : [];
    let pc = null;
    if (places.length) { let c = 0; pc = Float64Array.from(places, p => (c += Math.max(50, p.pop))); }
    const inside = (x, y) => { const c = Math.floor(x / R.cell), r = Math.floor(y / R.cell); return c >= 0 && r >= 0 && c < R.W && r < R.H && R.grid[r * R.W + c] === j + 1; };
    for (let k = 0; k < K; k++) {
      let x = NaN, y = NaN;
      if (rural) {
        let cx = z.tx[j], cy = z.ty[j];
        if (pc && rng.float() < 0.6) { const u = rng.float() * pc[pc.length - 1]; let i = 0; while (pc[i] <= u) i++; cx = places[i].x; cy = places[i].y; }
        for (let t = 0; t < 6; t++) { const px = cx + rng.gauss() * 1.2 * w.kmUnit, py = cy + rng.gauss() * 1.2 * w.kmUnit; if (inside(px, py)) { x = px; y = py; break; } }
      }
      if (!(x === x)) {
        if (cells.length) { const c = cells[rng.int(cells.length)]; x = ((c % R.W) + rng.float()) * R.cell; y = (Math.floor(c / R.W) + rng.float()) * R.cell; }
        else { x = z.tx[j]; y = z.ty[j]; }
      }
      s[2 * k] = x; s[2 * k + 1] = y;
    }
    return (this._siteCache[j] = s);
  }

  /** School sites of ZIP zi: [elementary (with preschools), middle, high], each a Float32Array of points, sized by enrollment. */
  _schools(zi) {
    let S = this._schoolCache[zi];
    if (S) return S;
    const M = this._core(zi), w = this.world;
    const kids = (lo, hi) => { let s = 0; for (let a = lo; a <= hi; a++) s += (M.T[BR[a]] + M.T[NB + BR[a]]) * YEAR_SHARE[a]; return s; };
    const counts = [clamp(Math.round(kids(3, 10) / 450), 1, 10), clamp(Math.round(kids(11, 13) / 800), 1, 5), clamp(Math.round(kids(14, 17) / 1600), 1, 4)];
    S = counts.map((K, level) => {
      const pts = new Float32Array(2 * K);
      for (let k = 0; k < K; k++) { const p = w.homeFor(zi, 0x5C400000 + level * 64 + k); pts[2 * k] = p.x; pts[2 * k + 1] = p.y; }
      return pts;
    });
    return (this._schoolCache[zi] = S);
  }

  /** Colleges within reach of ZIP zi: ZIPs weighted by school establishments and distance. */
  _colleges(zi) {
    let C = this._collegeCache[zi];
    if (C) return C;
    const z = this.world.z, near = this._near(zi, 60), ids = [], wts = [];
    for (let i = 0; i < near.ids.length; i++) { const j = near.ids[i], s = z.school[j] || 0; if (s > 0) { ids.push(j); wts.push(s * Math.exp(-near.km[i] / 16)); } }
    if (!ids.length) { ids.push(zi); wts.push(1); }
    C = { ids: Uint16Array.from(ids), table: new Table(wts) };
    return (this._collegeCache[zi] = C);
  }

  /** Where active-duty members living in ZIP zi report: ZIPs where many service members live (bases), by distance. */
  _bases(zi) {
    let B = this._baseCache[zi];
    if (B !== undefined) return B;
    if (!this._milCounts) { this._milCounts = new Float32Array(this.world.N); for (let i = 0; i < this.world.N; i++) this._milCounts[i] = this.world.acs(i, 'emp')[2]; }
    const near = this._near(zi, 110), ids = [], wts = [];
    for (let i = 0; i < near.ids.length; i++) { const j = near.ids[i], m = this._milCounts[j]; if (m >= 50) { ids.push(j); wts.push(m * Math.exp(-near.km[i] / 35)); } }
    B = ids.length ? { ids: Uint16Array.from(ids), table: new Table(wts) } : null;
    return (this._baseCache[zi] = B);
  }

  // ---------------------------------------------------------------- layer 0

  /** Persons in household h of ZIP zi, in O(1) once the ZIP's model is built; always equals householdCore(zi, h).size. */
  householdSize(zi, h) {
    const M = this._cores[zi] || this._core(zi), hk = hash3(this.seed, zi, h);
    return C_SIZE[M.comp.draw(u01(hk), u01(mix32(hk ^ 0x68e31da4)))];
  }

  /** The crowd's deterministic household sample: true for about `rate` of households. */
  includes(zi, h, rate) { return u01(hash3(this.seed ^ 0xC0, zi, h)) < rate; }

  /**
   * Layer 0: everything the crowd needs for household h of ZIP zi (CONTRACTS section 5, HouseholdCore).
   * PersonCore also carries `shift` ('early' | 'day' | 'mid' | 'evening' | 'night' | 'h24' | null), the work shift
   * behind departMin. The commute of a K-12 student (even one with a part-time job) is the school trip.
   * @param {number} zi ZIP index
   * @param {number} h household index, 0 <= h < world.z.hh[zi]
   */
  householdCore(zi, h) {
    const w = this.world, M = this._cores[zi] || this._core(zi);
    const hk = hash3(this.seed, zi, h);
    const ci = M.comp.draw(u01(hk), u01(mix32(hk ^ 0x68e31da4)));
    const r = new Rng(mix32(hk + 0x1b873593));
    const type = C_TYPE[ci], size = C_SIZE[ci], band = C_BAND[ci];
    const hs = C_HS[ci] >= 0 ? C_HS[ci] : (r.float() < 0.5 ? 0 : 1);
    const a0 = bandAge(band, r.float());
    const own = r.float() < M.pOwn[type * NBAND + band];
    const dwelling = M.dw[own ? 0 : 1].pick(r);
    const vehicles = M.veh[(own ? 0 : 5) + (size < 5 ? size : 5) - 1].pick(r);
    const H = M.herHH[size - 1].pick(r), g = H_GROUP[H];

    // who lives here
    const roles = [R_HH], sexes = [hs], ages = [a0], hers = [H];
    let spouseHer = -1, firstParentSex = -1;
    for (let k = C_SLOT_OFF[ci]; k < C_SLOT_OFF[ci + 1]; k++) {
      const mix = MIX_CUM[C_SLOTS[k]];
      let role = mix[0][0];
      if (mix.length > 1) { const u = r.float(); for (let q = 0; q < mix.length; q++) { role = mix[q][0]; if (u < mix[q][1]) break; } }
      if (!ROLE_OK[(role * 2 + hs) * NA + a0 - A0]) role = R_REL;
      let path, sex;
      switch (role) {
        case R_SPOUSE: if (r.float() < 0.985) { path = hs ? P_SP_F : P_SP_M; sex = 1 - hs; } else { path = P_SP_S; sex = hs; } break;
        case R_PARTNER: if (r.float() < 0.93) { path = hs ? P_PA_F : P_PA_M; sex = 1 - hs; } else { path = P_PA_S; sex = hs; } break;
        case R_CHILD: path = hs ? P_CH_F : P_CH_M; sex = r.float() < 0.515 ? 0 : 1; break;
        case R_GRAND: path = P_GC; sex = r.float() < 0.515 ? 0 : 1; break;
        case R_PARENT: path = P_PAR; sex = r.float() < 0.66 ? 1 : 0; if (firstParentSex < 0) firstParentSex = sex; break;
        case R_PARENT2: path = P_PAR; sex = firstParentSex >= 0 ? 1 - firstParentSex : (r.float() < 0.66 ? 0 : 1); break;
        case R_SIB: path = P_SIB; sex = r.float() < 0.5 ? 0 : 1; break;
        case R_ROOM: path = P_ROOM; sex = r.float() < 0.62 ? hs : 1 - hs; break;
        default: path = P_REL; sex = r.float() < 0.5 ? 0 : 1;
      }
      const age = drawPathAge(path, a0, r.float());
      let her;
      if (role === R_SPOUSE || role === R_PARTNER) {
        her = r.float() < M.qRace ? (r.float() < Q_KEY[g] ? H : M.herWithin[g].pick(r)) : M.herNotG[g].pick(r);
        if (spouseHer < 0) spouseHer = her;
      } else if (role === R_CHILD || role === R_GRAND) her = spouseHer < 0 ? H : childHeritage(H, spouseHer, r);
      else if (role === R_ROOM) her = r.float() < 0.45 ? M.herWithin[g].pick(r) : M.herPi.pick(r);
      else her = spouseHer >= 0 && r.float() < 0.1 ? spouseHer : H;
      roles.push(role); sexes.push(sex); ages.push(age); hers.push(her);
    }

    // what each of them does on a weekday
    const members = new Array(size);
    for (let m = 0; m < size; m++) {
      const age = ages[m], sex = sexes[m];
      let st = 0;
      const us = r.float();
      if (age >= 3 && age <= 4) { if (us < M.preRate) st = 1; }
      else if (age >= 5 && age <= 17) { if (us < M.k12Rate) st = 2; }
      else if (age >= 18) { const c = M.colRate[age]; if (us < c) st = 3; else if (us < c + M.gradRate[age]) st = 4; }
      let worker = false, military = false, occ = null;
      if (age >= 16 && r.float() < M.pWork[(st >= 3 ? 200 : 0) + sex * 100 + age]) {
        worker = true;
        if (M.pMil && r.float() < M.pMil[sex * 100 + age]) military = true;
        else occ = OCC_GROUPS[M.occ[sex * 5 + occBand(age)].pick(r)];
      }
      const p = { m, role: ROLE_NAMES[roles[m]], sex: sex ? 'F' : 'M', age, heritage: HERITAGE_KEYS[hers[m]], worker, military, occ, student: STUDENT_KEYS[st], mode: null, commuteMin: 0, departMin: null, dwellMin: 0, days: 0, workZi: -1, work: null, shift: null };
      if (st === 1 || st === 2) this._schoolTrip(p, zi, hk, M, vehicles, r);
      else if (worker) this._workTrip(p, zi, hk, M, vehicles, r);
      else if (st >= 3) this._collegeTrip(p, zi, hk, M, vehicles, r);
      members[m] = p;
    }
    return { zi, h, id: w.zips[zi] + '-' + h, size, type: TYPES[type], tenure: own ? 'own' : 'rent', dwelling: DWELLINGS[dwelling], vehicles, home: w.homeFor(zi, h), heritage: HERITAGE_KEYS[H], members };
  }

  _schoolTrip(p, zi, hk, M, vehicles, r) {
    const level = p.age <= 10 ? 0 : p.age <= 13 ? 1 : 2;
    const S = this._schools(zi)[level], K = S.length >> 1;
    const site = (mix32(hk ^ Math.imul(level + 1, 0x9e3779b9)) >>> 0) % K;  // siblings at one level share a school
    p.workZi = zi; p.work = { x: S[2 * site], y: S[2 * site + 1] };
    const u = r.float(), urb = M.urban;
    let mode;
    if (p.student === 'preschool') mode = u < 0.05 + 0.2 * urb ? 'walk' : 'carpool';
    else {
      const walk = (level ? 0.1 : 0.07) + 0.3 * urb, bike = level ? 0.03 + 0.05 * urb : 0.01 + 0.02 * urb;
      const bus = (level === 2 ? 0.2 : 0.1) + 0.18 * (1 - urb), drive = p.age >= 16 && vehicles >= 2 ? 0.18 : 0;
      mode = u < walk ? 'walk' : u < walk + bike ? 'bike' : u < walk + bike + bus ? 'bus' : u < walk + bike + bus + drive ? 'drive' : 'carpool';
    }
    p.mode = mode;
    p.commuteMin = mode === 'walk' ? 4 + r.int(13) : mode === 'bike' ? 4 + r.int(9) : mode === 'bus' ? 12 + r.int(24) : 5 + r.int(14);
    const start = p.student === 'preschool' ? 450 + 15 * r.int(7) : 480 + 10 * ((mix32(hash2(zi, level * 64 + site)) % 5) - 2);
    p.departMin = start - p.commuteMin - r.int(6);
    p.dwellMin = p.student === 'preschool' ? (r.float() < 0.5 ? 180 + 15 * r.int(5) : 480 + 15 * r.int(7)) : [390, 405, 420][level] + (r.float() < 0.3 ? 60 + 15 * r.int(7) : 0);
    p.days = 62;
    if (p.worker) p.shift = 'evening';
  }

  _workTrip(p, zi, hk, M, vehicles, r) {
    const gkey = p.military ? 'military' : p.occ, prof = GROUP_PROFILES[gkey], pc = PROFILE_CUM[gkey];
    const us = r.float();
    let si = 0;
    while (si < SHIFT_KEYS.length - 1 && us >= pc[si]) si++;
    const shift = SHIFT_KEYS[si];
    const partTime = shift !== 'h24' && r.float() < prof.partTime * (p.age < 25 || p.age >= 65 ? 1.6 : 1);
    const long = !partTime && shift !== 'h24' && r.float() < prof.long;
    p.shift = shift;
    p.days = workDays(prof, shift, partTime, long, r);
    p.dwellMin = dwellFor(gkey, shift, partTime, long, popcount(p.days), r);
    if (r.float() < M.pWfh[p.military ? 25 : OCC_IDX[p.occ]]) { p.mode = 'wfh'; return; }
    const mi = (vehicles > 0 ? M.modeCar : M.modeNoCar).pick(r);
    p.mode = MODES[mi];
    const tb = M.time[mi].pick(r);
    p.commuteMin = tb === NCT - 1 ? Math.min(150, 90 + Math.floor(-Math.log(1 - r.float()) * 22)) : CT_LO[tb] + r.int(CT_HI[tb] - CT_LO[tb] + 1);
    const B = p.military ? this._bases(zi) : null;
    if (B) p.workZi = B.ids[B.table.pick(r)];
    else p.workZi = this._pickWorkZip(zi, tripKm(mi, p.commuteMin, M.urban) * Math.exp(0.35 * r.gauss()), r.float());
    const S = this._sites(p.workZi), k = (mix32(hk + Math.imul(p.m + 1, 0x2545f491)) >>> 0) % (S.length >> 1);
    p.work = { x: S[2 * k], y: S[2 * k + 1] };
    p.departMin = (((startMinute(shift, gkey, r) - p.commuteMin - r.int(8)) % 1440) + 1440) % 1440;
  }

  _collegeTrip(p, zi, hk, M, vehicles, r) {
    const mi = (vehicles > 0 ? M.modeCar : M.modeNoCar).pick(r);
    p.mode = MODES[mi];
    const tb = M.time[mi].pick(r);
    p.commuteMin = Math.min(75, CT_LO[tb] + r.int(CT_HI[tb] - CT_LO[tb] + 1));
    const C = this._colleges(zi);
    p.workZi = C.ids[C.table.pick(r)];
    const S = this._sites(p.workZi), k = (mix32(hk + Math.imul(p.m + 1, 0x2545f491)) >>> 0) % (S.length >> 1);
    p.work = { x: S[2 * k], y: S[2 * k + 1] };
    p.departMin = 480 + 30 * r.int(8) - p.commuteMin - r.int(10);
    if (p.student === 'grad') { p.dwellMin = 360 + 30 * r.int(6); p.days = 62; }
    else { p.dwellMin = 180 + 30 * r.int(8); const u = r.float(); p.days = u < 0.6 ? 62 : u < 0.8 ? 42 : 20; }
  }

  // ---------------------------------------------------------------- layer 1: the per-ZIP calibration

  /** Household seed for layer-1 draws. */
  _hseed(zi, h) { return hash3(this.seed ^ 0x1a1e5, zi, h); }

  /** Origin tables per heritage key for ZIP zi (static weights refined by the ZIP's own B04006 and B03001 counts). */
  _originTables(zi) {
    const w = this.world, anc = this._blk(zi, 'anc', 80), A = {};
    w.acsLabels('anc').forEach((k, j) => { A[k] = anc[j]; });
    const hisp = this._blk(zi, 'hisp', 40), hl = w.acsLabels('hisp');
    const centralam = hisp[hl.indexOf('centralam')], otherhisp = hisp[hl.indexOf('otherhisp')];
    return HERITAGE_ORIGIN_LIST.map((list, k) => {
      const key = HERITAGE_KEYS[k];
      let weights = list.map(([oi, wt]) => wt);
      if (key === 'arab') {
        const eg = A.egyptian || 0, lb = A.lebanese || 0, rest = Math.max(0, (A.arab || 0) - eg - lb), base = list.reduce((s, x) => s + x[1], 0);
        if (eg + lb + rest > 0) weights = list.map(([oi, wt]) => { const o = ORIGINS[oi].key; return o === 'egyptian' ? eg : o === 'lebanese' ? lb : rest * wt / (base - 6) + 0.01; });
      } else if (key === 'caribbean') {
        const jm = A.jamaican || 0, rest = Math.max(0, (A.westindian || 0) - jm);
        if (jm + rest > 0) weights = list.map(([oi, wt]) => ORIGINS[oi].key === 'jamaican' ? jm : rest * wt / 8.3 + 0.01);
      } else if (key === 'latino') {
        if (centralam + otherhisp > 0) weights = list.map(([oi]) => { const o = ORIGINS[oi].key; return o === 'latino' ? otherhisp + 0.01 : o === 'centralamerican' ? 0.2 * centralam : 0.4 * centralam; });
      } else {
        const refined = list.map(([oi, wt]) => { const col = ORIGIN_ANC[ORIGINS[oi].key]; return col ? A[col] || 0 : null; });
        if (refined.some(v => v !== null) && refined.reduce((s, v) => s + (v || 0), 0) > 0) {
          const t = refined.reduce((s, v) => s + (v || 0), 0);
          weights = list.map(([oi, wt], j) => refined[j] === null ? 0.1 * t * wt / 10 + 0.01 : refined[j] + 0.01);
        }
      }
      return { ids: list.map(x => x[0]), table: new Table(weights) };
    });
  }

  /** Origin index per member: one origin per heritage within a household. */
  _origins(core, hs, F) {
    return core.members.map(p => {
      const k = H_INDEX[p.heritage], T = F.origin[k];
      return T.ids[T.table.draw(uni(hs, 300 + k, KA.ORIGIN), uni(hs, 360 + k, KA.ORIGIN))];
    });
  }

  _full(zi) { return this._fulls[zi] || (this._fulls[zi] = this._buildFull(zi)); }

  /**
   * Layer-1 parameters for ZIP zi, calibrated on SYN_N synthetic households of the ZIP (household indices past the
   * real ones): the nativity shift (B05012), education by occupation class (B15003), language bucket scales and
   * English ability (C16001), unemployment (B23025), marital status by sex and age (B12001), veterans (B21001) and
   * the household income ranking (B19001).
   */
  _buildFull(zi) {
    const w = this.world, M = this._core(zi), F = { zi };
    F.origin = this._originTables(zi);
    const asian = this._blk(zi, 'asian', 40), al = w.acsLabels('asian');
    const ind = asian[al.indexOf('indian')], sik = asian[al.indexOf('sikh')];
    // Sikh write-ins (B02015) mark Punjabi Sikh communities: Indian households there speak Punjabi more often
    F.punjabi = 1 + 50 * sik / Math.max(1, ind + sik);
    const syn = [];
    for (let s = 0; s < SYN_N; s++) { const h = SYN_BASE + s, core = this.householdCore(zi, h), hs = this._hseed(zi, h); syn.push({ core, hs, ori: this._origins(core, hs, F) }); }

    // nativity: one shift alpha so the foreign-born share matches B05012
    const nat = this._blk(zi, 'nat', 60), fTarget = nat[1] / ((nat[0] + nat[1]) || 1);
    for (const x of syn) { x.P = natPrep(x.core, x.ori, x.hs); x.N = natResult(x.core.size); }
    const foreignShare = a => { let f = 0, t = 0; for (const x of syn) { natDecide(x.P, a, x.N); for (let i = 0; i < x.core.size; i++) { t++; f += x.N.nat[i]; } } return t ? f / t : 0; };
    let lo = -10, hi = 10;
    for (let it = 0; it < 18; it++) { const mid = (lo + hi) / 2; if (foreignShare(mid) < fTarget) lo = mid; else hi = mid; }
    F.alpha = (lo + hi) / 2;
    for (const x of syn) natDecide(x.P, F.alpha, x.N);

    // education 25+ by class (IPF of a national prior against B15003)
    const edu = this._blk(zi, 'edu', 60), rows = new Float64Array(NECLASS);
    for (const x of syn) for (const p of x.core.members) if (p.age >= 25) rows[eduClass(p)]++;
    const prior = new Float64Array(NECLASS * NEDU);
    EDU_PRIOR.forEach((r, c) => { const t = sum(r); r.forEach((v, k) => { prior[c * NEDU + k] = v / t; }); });
    const em = ipf(prior, NECLASS, NEDU, rows, edu, 30);
    F.eduRows = [];
    for (let c = 0; c < NECLASS; c++) {
      const r = em.subarray(c * NEDU, c * NEDU + NEDU), t = sum(r);
      F.eduRows.push(t > 0 ? Float64Array.from(r, v => v / t) : prior.slice(c * NEDU, c * NEDU + NEDU));
    }
    for (const x of syn) x.edu = eduDecide(x.core, x.hs, F.eduRows);

    // language at home: bucket scales so the 12 non-English shares match C16001 among people 5+
    const lang = this._blk(zi, 'lang', 60), tot5 = sum(lang.subarray(0, 13)) || 1;
    const target = Float64Array.from({ length: 13 }, (_, b) => lang[b] / tot5);
    for (const x of syn) { x.L = langPrep(x.core, x.ori, x.N, x.edu, x.hs, F); x.LR = langResult(x.core.size); }
    const lambda = new Float64Array(13).fill(1);
    let kappa = 0;
    const shares = () => {
      const g = new Float64Array(13); let t = 0;
      for (const x of syn) { langDecide(x.L, lambda, kappa, x.LR); for (let i = 0; i < x.core.size; i++) { if (x.L.age[i] < 5) continue; t++; g[x.LR.bucket[i]]++; } }
      if (t) for (let b = 0; b < 13; b++) g[b] /= t;
      return g;
    };
    for (let it = 0; it < 9; it++) {
      const g = shares();
      for (let b = 1; b < 13; b++) {
        if (target[b] <= 0) lambda[b] = Math.max(0.02, lambda[b] * 0.3);
        else lambda[b] = clamp(lambda[b] * (g[b] > 0 ? Math.pow(target[b] / g[b], 0.85) : 3), 0.02, 25);
      }
    }
    for (let it = 0; it < 4; it++) {
      const g = shares(), deficit = target[1] - g[1];
      if (Math.abs(deficit) < 0.002 || (deficit < 0 && kappa === 0)) break;
      kappa = clamp(kappa + deficit / Math.max(0.05, g[0]), 0, 0.25);
    }
    F.lambda = lambda; F.kappa = kappa;
    shares();
    // limited English by bucket (C16001 counts of those who speak English less than very well)
    F.delta = new Float64Array(13).fill(-1);
    for (let b = 1; b < 13; b++) {
      const n = [], off = [];
      for (const x of syn) for (let i = 0; i < x.core.size; i++) { if (x.L.age[i] >= 5 && x.LR.bucket[i] === b) { n.push(1); off.push(x.L.x[i] + (x.LR.crossed[i] ? -2 : 0)); } }
      const rate = lang[b] > 0 ? clamp(lang[12 + b] / lang[b], 0, 0.97) : 0.3;
      if (n.length) F.delta[b] = solveShift(n, off, rate * n.length);
    }

    // unemployment among those not working (B23025)
    const emp = this._blk(zi, 'emp', 60), uShare = emp[1] / (sum(emp) || 1);
    let n16 = 0; const elig = [];
    for (const x of syn) for (const p of x.core.members) { if (p.age >= 16) n16++; if (p.age >= 16 && p.age < 65 && !p.worker && !p.student) elig.push(p.age < 25 ? 1.6 : p.age < 55 ? 1 : 0.6); }
    const uTarget = uShare * n16;
    lo = 0; hi = 10;
    for (let it = 0; it < 30; it++) { const mid = (lo + hi) / 2; let s = 0; for (const e of elig) s += Math.min(0.95, mid * e); if (s < uTarget) lo = mid; else hi = mid; }
    F.unemp = (lo + hi) / 2;

    // marital status of people not married by household structure (B12001, by sex and age band)
    const mar = this._blk(zi, 'mar', 60);
    F.marRows = [];
    for (let s = 0; s < 2; s++) {
      const rowsM = new Float64Array(7);
      for (const x of syn) { const { out } = maritalFixed(x.core); x.core.members.forEach((p, i) => { if (out[i] < 0 && (p.sex === 'F') === (s === 1)) rowsM[marBand(p.age)]++; }); }
      const cols = [0, 2, 3, 4, 5].map(k => mar[s * 6 + k]);
      const mm = ipf(MAR_PRIOR.flat(), 7, 5, rowsM, cols, 30);
      for (let b = 0; b < 7; b++) { const r = mm.subarray(b * 5, b * 5 + 5), t = sum(r); F.marRows.push(t > 0 ? Float64Array.from(r, v => v / t) : Float64Array.from(MAR_PRIOR[b])); }
    }

    // veterans by sex and age band (B21001 rates)
    const vet = this._blk(zi, 'vet', 60);
    F.vetRate = new Float64Array(10);
    for (let s = 0; s < 2; s++) for (let b = 0; b < 5; b++) { const v = vet[s * 10 + b], nv = vet[s * 10 + 5 + b]; F.vetRate[s * 5 + b] = v + nv > 0 ? v / (v + nv) : 0; }

    // household income: the rank of a household's earning power among the ZIP's households maps to B19001
    const scores = syn.map(x => householdScore(x.core, x.edu, x.hs));
    F.incScores = Float64Array.from(scores).sort();
    const hinc = this._blk(zi, 'hinc', 60), ht = sum(hinc) || 1;
    let c = 0;
    F.hincCum = Float64Array.from(hinc, v => (c += v / ht));
    for (const x of syn) { x.P = x.L = x.LR = null; }
    return F;
  }

  // ---------------------------------------------------------------- layer 1: households and people

  /** Everything layer 1 knows about household h of ZIP zi (cached). */
  _detail(zi, h) {
    const key = zi * 67108864 + h;
    const hit = this._hhLru.get(key);
    if (hit) return hit;
    const w = this.world, F = this._full(zi), core = this.householdCore(zi, h), hs = this._hseed(zi, h), n = core.size, mem = core.members;
    const ori = this._origins(core, hs, F);
    const N = natDecide(natPrep(core, ori, hs), F.alpha, natResult(n));
    const edu = eduDecide(core, hs, F.eduRows);
    const L = langPrep(core, ori, N, edu, hs, F), LR = langDecide(L, F.lambda, F.kappa, langResult(n));
    const marital = maritalDecide(core, hs, F);
    const D = { zi, h, core, hs, ori, N, edu, L, LR, marital, english: [], langs: [], veteran: [], status: [], occupation: [], income: [], names: [], birthYear: [], birthplace: [] };
    for (let i = 0; i < n; i++) {
      const p = mem[i], home = LR.home[i];
      // English ability
      if (!home) { D.english.push('only'); D.langs.push(['english']); }
      else {
        const b = LANG_BUCKET_OF[home], limited = uni(hs, i, KA.LEP) < sigmoid(F.delta[b] + L.x[i] + (LR.crossed[i] ? -2 : 0));
        D.english.push(limited ? 'limited' : 'very well');
        const list = [home];
        const o = ORIGINS[ori[i]];
        if (N.gen[i] === 1 && o.langs.length > 1 && uni(hs, i, KA.LIST) < 0.25) { const second = o.langs.find(l => l.key !== home); if (second) list.push(second.key); }
        if (!limited || uni(hs, i, KA.LIST + 64) < 0.7) list.push('english');
        D.langs.push(list);
      }
      D.veteran.push(p.age >= 18 && !p.military && uni(hs, i, KA.VET) < F.vetRate[(p.sex === 'F' ? 5 : 0) + (p.age < 35 ? 0 : p.age < 55 ? 1 : p.age < 65 ? 2 : p.age < 75 ? 3 : 4)]);
      D.status.push(statusOf(p, core, hs, i, F));
      const by = YEAR - p.age - (uni(hs, i, KA.BDAY) < 0.11 ? 1 : 0);
      D.birthYear.push(by);
    }
    // jobs and incomes
    let potTotal = 0;
    const pot = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const p = mem[i];
      if (p.worker) {
        const o = pickOccupation(new Rng(hash2(hs, i * 64 + KA.OCC)), { group: p.military ? 'military' : p.occ, world: w, zi: p.workZi >= 0 ? p.workZi : zi, sex: p.sex, age: p.age, education: edu[i] >= 0 ? EDUCATION_KEYS[edu[i]] : 'in school', shift: p.shift || 'day', wfh: p.mode === 'wfh' });
        const hours = popcount(p.days || 62) * Math.min(p.dwellMin || 480, 720) / 60;
        pot[i] = o.wage * Math.min(1, hours / 38);
        D.occupation.push(o);
      } else {
        D.occupation.push(null);
        const st = D.status[i];
        pot[i] = st === 'retired' ? 24000 * Math.pow(EDU_WAGE[eduLevel(edu[i])], 0.8) : st === 'unemployed' ? 6000 : p.age >= 18 ? 1500 : 0;
      }
      potTotal += pot[i];
    }
    const Y = this._householdIncome(F, householdScore(core, edu, hs));
    D.householdIncome = Y;
    for (let i = 0; i < n; i++) {
      const inc = potTotal > 0 ? Y * pot[i] / potTotal : i === 0 ? Y : 0;
      D.income.push(Math.round(inc / 100) * 100);
      if (D.occupation[i]) D.occupation[i].wage = Math.max(1000, Math.round(inc / 500) * 500);
    }
    this._names(D);
    this._birthplaces(D);
    this._dwellingYears(D);
    return this._hhLru.set(key, D);
  }

  _householdIncome(F, score) {
    const s = F.incScores;
    let lo = 0, hi = s.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (s[mid] < score) lo = mid + 1; else hi = mid; }
    const q = clamp((lo + 0.5) / (s.length + 1), 0.0005, 0.9995);
    return incomeAt(F.hincCum, q);
  }

  /** Names from names.mjs: the household's surname, married names, children's surnames from their father's side. */
  _names(D) {
    const mem = D.core.members, hs = D.hs;
    const rng = i => new Rng(hash2(hs, i * 64 + KA.NAME));
    const her = mem.map(p => p.heritage);
    const famLast = surname(rng(0), her[0]);
    const sp = mem.findIndex(p => p.role === 'spouse' || p.role === 'partner');
    const last = new Array(mem.length);
    last[0] = famLast;
    if (sp > 0) {
      const r = rng(sp), keepsOwn = mem[sp].role === 'partner' || r.chance(SURNAME_KEEP[her[sp]] ?? 0.25);
      last[sp] = keepsOwn ? surname(r, her[sp]) : famLast;
    }
    const fatherLast = sp > 0 && mem[sp].sex === 'M' && mem[0].sex === 'F' && mem[sp].role === 'spouse' ? last[sp] : famLast;
    for (let i = 1; i < mem.length; i++) {
      if (i === sp) continue;
      const r = rng(i), role = mem[i].role;
      last[i] = role === 'child' ? (mem[i].heritage === her[0] || mem[i].heritage === 'multiracial' || r.chance(0.8) ? fatherLast : famLast)
        : role === 'grandchild' ? (r.chance(0.5) ? famLast : surname(r, her[i]))
          : role === 'parent' ? (r.chance(0.6) ? famLast : surname(r, her[i]))
            : role === 'sibling' ? (r.chance(0.75) ? famLast : surname(r, her[i]))
              : role === 'relative' ? (r.chance(0.35) ? famLast : surname(r, her[i]))
                : surname(r, her[i]);
    }
    D.names = mem.map((p, i) => {
      const r = new Rng(hash2(hs, i * 64 + KA.NAME + 32));
      const first = givenName(r, { heritage: p.heritage, sex: p.sex, birthYear: D.birthYear[i], generation: D.N.gen[i], nativity: D.N.nat[i] ? 'foreign' : 'native' });
      const nick = nickname(r, first, { heritage: p.heritage, age: p.age }) || null;
      return { first, last: last[i], full: `${first} ${last[i]}`, display: `${nick || first} ${last[i]}`, nick };
    });
  }

  /** Where each member was born: abroad (by origin and language), a territory, elsewhere in California or another state. */
  _birthplaces(D) {
    const w = this.world, z = w.zip(D.zi), mem = D.core.members, hs = D.hs;
    D.birthplace = mem.map((p, i) => {
      const o = ORIGINS[D.ori[i]], u = uni(hs, i, KA.BORN), u2 = uni(hs, i, KA.BORN2);
      const lang = D.LR.home[i] || (o.langs[0] && o.langs[0].key);
      if (D.N.nat[i]) {
        const places = o.places.length ? o.places : ORIGINS[ORIGIN_INDEX.latino].places;
        const pl = pickPlace(places, u, lang);
        return pl.replace(/^Saigon,/, D.birthYear[i] > 1976 ? 'Ho Chi Minh City,' : 'Saigon,');
      }
      if (D.N.out[i] && o.territoryPlaces.length) return pickPlace(o.territoryPlaces, u, null);
      // US-born: California for most, the more so for children and the children of immigrants
      const inCA = p.age < 18 ? 0.92 : D.N.gen[i] === 2 ? 0.85 : p.age < 35 ? 0.72 : p.age < 65 ? 0.6 : 0.48;
      if (u < inCA) {
        if (u2 < 0.5 || !this._caPlaces) return `${z.city}, California`;
        return `${pickCum(this._caPlaces(), (u2 - 0.5) * 2)}, California`;
      }
      const boost = p.heritage === 'african-american' && p.age >= 50 ? GREAT_MIGRATION : null;
      return pickPlace(US_STATES, u2, null, boost);
    });
  }

  /** California places by population, for natives born elsewhere in the state. */
  _caPlaces() {
    if (this._caPlaceCum) return this._caPlaceCum;
    const pl = this.world.places.filter(p => p.pop >= 5000 && !p.cdp);
    let c = 0;
    this._caPlaceCum = { names: pl.map(p => p.name), cum: Float64Array.from(pl, p => (c += p.pop)) };
    return this._caPlaceCum;
  }

  /** When the household's home was built and when the household moved in. */
  _dwellingYears(D) {
    const z = this.world.z, zi = D.zi, core = D.core, hs = D.hs;
    const yb = z.yb_med[zi] || this._col(zi, 'yb_med', 1975);
    let built = Math.round(yb + 14 * gaussOf(hs, 90, KA.BUILT));
    if (core.dwelling === 'mobile-home') built = clamp(built, 1962, 2022);
    built = clamp(built, 1885, YEAR - 1);
    const owner = core.tenure === 'own';
    const median = owner ? Math.max(1.5, YEAR - (z.own_yr[zi] || this._col(zi, 'own_yr', 2008))) : clamp(2.5 + 6 * (1 - (this._col(zi, 'moved10_sh', 60)) / 100), 1.5, 9);
    const years = median * Math.exp((owner ? 0.8 : 0.85) * gaussOf(hs, 91, KA.MOVED));
    let moved = Math.round(YEAR - years);
    const hh = core.members[0];
    moved = Math.max(moved, YEAR - hh.age + 18, built, D.N.out[0] ? D.N.arr[0] : 0);
    D.yearBuilt = built;
    D.yearMoved = Math.min(moved, YEAR);
  }

  /**
   * Layer 1 household: the core plus income, the years built and moved in, the home's lat/lon, and the members'
   * names. Cached.
   */
  household(zi, h) {
    const D = this._detail(zi, h), c = D.core, ll = this.world.unproject(c.home.x, c.home.y);
    return {
      id: c.id, zi, h, zip: this.world.zips[zi], size: c.size, type: c.type, tenure: c.tenure, dwelling: c.dwelling, vehicles: c.vehicles,
      heritage: c.heritage, income: D.householdIncome, yearMoved: D.yearMoved, yearBuilt: D.yearBuilt,
      home: { x: c.home.x, y: c.home.y, lat: +ll.lat.toFixed(5), lon: +ll.lon.toFixed(5) },
      members: c.members.map((p, i) => ({ m: p.m, role: p.role, name: D.names[i].display, first: D.names[i].first, age: p.age, sex: p.sex })),
    };
  }

  /**
   * Layer 1 person: the full NPC record of CONTRACTS section 5 (consistent with householdCore member m).
   * Extra fields: origin (a finer heritage key, e.g. 'taiwanese'), commute.road for drivers (a world.roadsNear
   * record) and household.members[].first.
   */
  person(zi, h, m) {
    const key = (zi * 67108864 + h) * 16 + m;
    const hit = this._personLru.get(key);
    if (hit) return hit;
    const D = this._detail(zi, h), c = D.core, p = c.members[m];
    if (!p) return null;
    const w = this.world, z = w.zip(zi), o = ORIGINS[D.ori[m]], hh = this.household(zi, h);
    const edu = D.edu[m];
    const npc = {
      id: `${c.id}-${m}`, hid: c.id, zip: z.zip, zi, h, m,
      role: p.role, sex: p.sex, age: p.age, birthYear: D.birthYear[m], pronouns: p.sex === 'F' ? 'she/her' : 'he/him',
      race: RACES[H_GROUP[H_INDEX[p.heritage]]], heritage: p.heritage, heritageLabel: o.label, origin: o.key,
      nativity: D.N.nat[m] ? 'foreign' : 'native', generation: D.N.gen[m], arrivalYear: D.N.out[m] ? D.N.arr[m] : null, birthplace: D.birthplace[m],
      name: { ...D.names[m] },
      languages: { home: D.LR.home[m] || 'english', english: D.english[m], list: D.langs[m].slice() },
      education: edu >= 0 ? EDUCATION_KEYS[edu] : edu === -2 ? 'in school' : 'child',
      school: schoolOf(p),
      status: D.status[m],
      occupation: D.occupation[m] ? { ...D.occupation[m] } : null,
      income: D.income[m], householdIncome: D.householdIncome,
      commute: {
        mode: p.mode, minutes: p.commuteMin, departMin: p.departMin, dwellMin: p.dwellMin, days: p.days,
        workZi: p.workZi, workZip: p.workZi >= 0 ? w.zips[p.workZi] : null, workCity: p.workZi >= 0 ? w.z.city[p.workZi] : null,
        work: p.work ? { x: p.work.x, y: p.work.y } : null, road: this._roadFor(c, p),
      },
      marital: MARITAL[D.marital[m]], veteran: D.veteran[m],
      household: { id: c.id, size: c.size, type: c.type, tenure: c.tenure, dwelling: c.dwelling, vehicles: c.vehicles, yearMoved: D.yearMoved, yearBuilt: D.yearBuilt, home: hh.home, members: hh.members },
      place: { zip: z.zip, city: z.city, place: z.placeName, countyName: z.countyName, countyFips: z.countyFips, region: z.regionKey, regionName: z.regionName, province: z.provinceName, zone: z.zoneTitle },
      seed: hash3(hash2(this.seed ^ 0x9e75, zi), h, m),
    };
    return this._personLru.set(key, npc);
  }

  /** The state highway a driver takes: one near home that also runs near the workplace, else the busiest near home. */
  _roadFor(c, p) {
    if (!p.work || !(p.mode === 'drive' || p.mode === 'carpool' || p.mode === 'motorcycle' || p.mode === 'taxi')) return null;
    const w = this.world, km = w.distKm(c.home.x, c.home.y, p.work.x, p.work.y);
    if (km < 5) return null;
    const near = w.roadsNear(c.home.x, c.home.y, 6);
    if (!near.length) return null;
    const atWork = new Set(w.roadsNear(p.work.x, p.work.y, 6).map(r => r.route));
    const shared = near.filter(r => atWork.has(r.route));
    const pool = shared.length ? shared : km > 12 ? near.filter(r => r.distKm <= 3.5) : [];
    if (!pool.length) return null;
    return pool.reduce((a, b) => (b.aadt > a.aadt ? b : a));
  }

  /** The NPC for a person id "94110-123-0" (a household id gives the householder), or null. */
  get(id) {
    const p = parseId(id, this.world);
    if (!p || p.zi < 0 || p.h >= this.householdCount(p.zi)) return null;
    const m = p.m === null ? 0 : p.m;
    if (m >= this.householdSize(p.zi, p.h)) return null;
    return this.person(p.zi, p.h, m);
  }

  /** All the NPCs of household h of ZIP zi. */
  members(zi, h) { const n = this.householdSize(zi, h), out = []; for (let m = 0; m < n; m++) out.push(this.person(zi, h, m)); return out; }

  // ---------------------------------------------------------------- sampling

  /**
   * n distinct NPCs of ZIP zi, uniform over its persons (households drawn in proportion to their size).
   * The same (zi, seed) gives the same sequence; a smaller n is a prefix of a larger one.
   */
  sample(zi, n, seed = 1) {
    const H = this.householdCount(zi), out = [];
    if (!H || !(n > 0)) return out;
    const M = this._core(zi), r = new Rng(hash3(this.seed ^ 0x5a3e, zi, seed)), seen = new Set();
    const cap = Math.min(n, Math.max(1, this.expectedPersons(zi)));
    for (let tries = 0; out.length < cap && tries < cap * 80 + 200; tries++) {
      const h = r.int(H), size = this.householdSize(zi, h);
      if (r.float() * M.maxSize >= size) continue;
      const m = r.int(size), key = h * 16 + m;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(this.person(zi, h, m));
    }
    return out;
  }

  /** n distinct NPCs from the whole state, uniform over persons (ZIPs by household population). */
  sampleState(n, seed = 1) {
    const w = this.world, out = [];
    if (!(n > 0)) return out;
    if (!this._stateTable) this._stateTable = new Table(Float64Array.from({ length: w.N }, (_, i) => (w.z.hh[i] || 0) * (w.z.hhsize[i] || 0)));
    const r = new Rng(hash2(this.seed ^ 0x57a7e, seed)), seen = new Set();
    for (let tries = 0; out.length < n && tries < n * 80 + 200; tries++) {
      const zi = this._stateTable.pick(r), H = this.householdCount(zi);
      if (!H) continue;
      const h = r.int(H), size = this.householdSize(zi, h);
      if (r.float() * MAX_FAMILY >= size) continue;
      const m = r.int(size), key = `${zi}:${h}:${m}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(this.person(zi, h, m));
    }
    return out;
  }

  // ---------------------------------------------------------------- fidelity

  /**
   * Generated versus Census share tables for ZIP zi over its first `households` households (default 2000).
   * Shares are fractions (0..1). `acs` holds the Census shares as published; `target` the shares the generator
   * aims at for the household population: the same except the age pyramid and school enrollment, which leave out
   * the ZIP's estimated group-quarters residents (dorms, barracks, prisons, nursing homes; `gq`), and heritage,
   * whose target is the mix built from B03002, B03001, B02015 and B04006. Tables: hht, tenure, veh, dwelling, hinc,
   * sex, age, race, hisp, asian, heritage, nat, lang, lep, emp, comm, ctime, occM, occF, edu, mar, vet, sch;
   * scalars: hhsize, medianAge, under18, over65, foreign, own.
   * @returns {{zi:number, zip:string, city:string, households:number, persons:number, gq:{persons:number, share:number}, generated:object, acs:object, target:object, scalars:object}}
   */
  validate(zi, households = 2000) {
    const w = this.world, z = w.z, M = this._core(zi), K = Math.min(households, this.householdCount(zi));
    const G = {}, inc = (t, k, v = 1) => { const o = G[t] || (G[t] = {}); o[k] = (o[k] || 0) + v; };
    const ages = [];
    let persons = 0, sizeSum = 0;
    const occL = w.acsLabels('occ'), ageL = w.acsLabels('age'), langL = w.acsLabels('lang');
    for (let h = 0; h < K; h++) {
      const D = this._detail(zi, h), c = D.core;
      sizeSum += c.size;
      inc('hht', c.type); inc('tenure', c.tenure); inc('dwelling', c.dwelling);
      inc('veh', (c.tenure === 'own' ? 'own' : 'rent') + (c.vehicles >= 5 ? '5+' : c.vehicles));
      inc('hinc', w.acsLabels('hinc')[hincBracket(D.householdIncome)]);
      c.members.forEach((p, i) => {
        persons++; ages.push(p.age);
        const sx = p.sex === 'F' ? 'f' : 'm';
        inc('sex', p.sex); inc('age', sx + ageL[BR[p.age]]);
        const g = H_GROUP[H_INDEX[p.heritage]];
        inc('race', RACES[g]); inc('heritage', p.heritage);
        const o = ORIGINS[D.ori[i]];
        if (g === G_HISP) inc('hisp', HISP_LABEL[p.heritage] || (o.key === 'latino' ? 'otherhisp' : 'centralam'));
        if (g === G_ASIAN) inc('asian', ASIAN_LABEL[p.heritage] || p.heritage);
        inc('nat', D.N.nat[i] ? 'foreign' : 'native');
        if (p.age >= 5) {
          const home = D.LR.home[i], b = home ? LANG_BUCKET_OF[home] : 0;
          inc('lang', langL[b]);
          if (home && D.english[i] === 'limited') inc('lep', langL[b] + '_lep');
          inc('lep', '_pop', 1);
        }
        if (p.age >= 16) inc('emp', p.worker ? (p.military ? 'military' : 'employed') : D.status[i] === 'unemployed' ? 'unemployed' : 'nilf');
        if (p.worker && p.student !== 'k12') {
          inc('comm', p.mode === 'drive' ? 'drove' : p.mode);
          if (p.mode !== 'wfh') { let b = 0; while (b < CT_EDGES.length && p.commuteMin >= CT_EDGES[b]) b++; inc('ctime', w.acsLabels('ctime')[b]); }
        }
        if (p.occ) inc(p.sex === 'F' ? 'occF' : 'occM', p.occ);
        if (p.age >= 25 && D.edu[i] >= 0) inc('edu', EDUCATION_KEYS[D.edu[i]]);
        if (p.age >= 15) inc('mar', `${sx === 'f' ? 'f' : 'm'}_${MARITAL[D.marital[i]]}`);
        if (p.age >= 18) inc('vet', `${sx}_${D.veteran[i] ? 'vet' : 'non'}${p.age < 35 ? '18-34' : p.age < 55 ? '35-54' : p.age < 65 ? '55-64' : p.age < 75 ? '65-74' : '75+'}`);
        if (p.age >= 3) inc('sch', SCH_LABEL(p));
      });
    }
    const norm = o => { const t = Object.values(o || {}).reduce((a, b) => a + b, 0); const r = {}; for (const [k, v] of Object.entries(o || {})) r[k] = t > 0 ? v / t : 0; return r; };
    const generated = {};
    for (const [t, o] of Object.entries(G)) if (t !== 'lep') generated[t] = norm(o);
    const lepPop = (G.lep && G.lep._pop) || 1;
    generated.lep = {}; for (const [k, v] of Object.entries(G.lep || {})) if (k !== '_pop') generated.lep[k] = v / lepPop;
    // the Census side
    const named = b => w.acsNamed(zi, b), acs = {};
    acs.hht = norm(Object.fromEntries(Object.entries(named('hht')).map(([k, v]) => [{ male: 'father', female: 'mother' }[k] || k, v])));
    acs.tenure = { own: (z.own_sh[zi] || 0) / 100, rent: 1 - (z.own_sh[zi] || 0) / 100 };
    acs.dwelling = { house: M.dwShares[0], 'small-apartment': M.dwShares[1], apartment: M.dwShares[2], 'mobile-home': M.dwShares[3] };
    acs.veh = norm(named('veh'));
    acs.hinc = norm(named('hinc'));
    const ageN = named('age');
    acs.age = norm(ageN);
    acs.sex = { M: 0, F: 0 }; for (const [k, v] of Object.entries(acs.age)) acs.sex[k[0] === 'm' ? 'M' : 'F'] += v;
    acs.race = norm(named('race'));
    acs.hisp = norm(named('hisp')); acs.asian = norm(named('asian'));
    acs.nat = norm(named('nat'));
    const ln = named('lang'), l5 = langL.reduce((a, k) => a + ln[k], 0) || 1;
    acs.lang = {}; acs.lep = {};
    for (const k of langL) acs.lang[k] = ln[k] / l5;
    for (const k of w.acsLabels('lang_lep')) acs.lep[k + '_lep'] = ln[k + '_lep'] / l5;
    acs.emp = norm(named('emp')); acs.comm = norm(named('comm')); acs.ctime = norm(named('ctime'));
    const on = named('occ');
    acs.occM = norm(Object.fromEntries(occL.map(k => [k, on['m_' + k]]))); acs.occF = norm(Object.fromEntries(occL.map(k => [k, on['f_' + k]])));
    acs.edu = norm(named('edu')); acs.mar = norm(named('mar')); acs.vet = norm(named('vet')); acs.sch = norm(named('sch'));
    // targets for the household population
    const target = { ...acs };
    const T = M.T, tN = {};
    ageL.forEach((k, b) => { tN['m' + k] = T[b]; tN['f' + k] = T[NB + b]; });
    target.age = norm(tN);
    target.sex = { M: 0, F: 0 }; for (const [k, v] of Object.entries(target.age)) target.sex[k[0] === 'm' ? 'M' : 'F'] += v;
    const sch = { preschool: 0, kindergarten: 0, 'g1-4': 0, 'g5-8': 0, 'g9-12': 0, undergrad: 0, grad: 0, none: 0 };
    for (let a = 3; a <= MAX_AGE; a++) {
      const pa = (T[BR[a]] + T[NB + BR[a]]) * YEAR_SHARE[a];
      let pre = 0, k12 = 0, col = 0, grad = 0;
      if (a <= 4) pre = M.preRate; else if (a <= 17) k12 = M.k12Rate; else { col = M.colRate[a]; grad = M.gradRate[a]; }
      sch.preschool += pa * pre; sch.undergrad += pa * col; sch.grad += pa * grad;
      if (k12) sch[a <= 5 ? 'kindergarten' : a <= 9 ? 'g1-4' : a <= 13 ? 'g5-8' : 'g9-12'] += pa * k12;
      sch.none += pa * (1 - pre - k12 - col - grad);
    }
    target.sch = norm(sch);
    target.heritage = Object.fromEntries(HERITAGE_KEYS.map((k, i) => [k, M.pi[i]]).filter(([, v]) => v > 0));
    // scalars
    ages.sort((a, b) => a - b);
    const medCont = list => { if (!list.length) return 0; const half = list.length / 2; let lo = Math.floor(half); const a = list[Math.min(lo, list.length - 1)]; let below = 0; while (below < list.length && list[below] < a) below++; let at = 0; while (below + at < list.length && list[below + at] === a) at++; return a + (half - below) / Math.max(1, at); };
    const medBins = o => { const L = ageL, c = L.map(k => (o['m' + k] || 0) + (o['f' + k] || 0)), t = c.reduce((a, b) => a + b, 0); let s = 0; for (let b = 0; b < NB; b++) { if (s + c[b] >= t / 2) return AGE_LO[b] + (t / 2 - s) / (c[b] || 1) * (AGE_HI[b] + 1 - AGE_LO[b]); s += c[b]; } return 0; };
    const shareOf = (o, test) => Object.entries(o).reduce((a, [k, v]) => a + (test(ageL.indexOf(k.slice(1))) ? v : 0), 0);
    const kids = b => b >= 0 && b < 4, old = b => b >= 17;
    const scalars = {
      hhsize: { generated: K ? sizeSum / K : 0, acs: z.hhsize[zi] || 0, target: M.hhsize },
      medianAge: { generated: medCont(ages), acs: medBins(acs.age), target: medBins(target.age) },
      under18: { generated: ages.filter(a => a < 18).length / (ages.length || 1), acs: shareOf(acs.age, kids), target: shareOf(target.age, kids) },
      over65: { generated: ages.filter(a => a >= 65).length / (ages.length || 1), acs: shareOf(acs.age, old), target: shareOf(target.age, old) },
      foreign: { generated: (generated.nat && generated.nat.foreign) || 0, acs: acs.nat.foreign || 0, target: acs.nat.foreign || 0 },
      own: { generated: (generated.tenure && generated.tenure.own) || 0, acs: acs.tenure.own, target: acs.tenure.own },
    };
    return { zi, zip: w.zips[zi], city: z.city[zi], households: K, persons, gq: { persons: Math.round(M.gq), share: M.pop > 0 ? M.gq / M.pop : 0 }, generated, acs, target, scalars };
  }
}
